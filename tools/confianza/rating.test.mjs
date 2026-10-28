// PostgreSQL aislado (PGlite), con la migración real y roles participantes.
// El esquema mínimo reproduce los tipos de reputacion consultados en producción;
// no usa filas de personas ni invoca n8n, IA, avisos o pagos.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db;
const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
before(async()=>{
  db=new PGlite();
  await db.exec(`
    create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key,deleted_at timestamptz,raw_user_meta_data jsonb);
    create table public.solicitudes(id bigint primary key,user_id uuid);
    create table public.proveedores(id bigint primary key,user_id uuid);
    create table public.matches(id bigint primary key,solicitud_id bigint,proveedor_id bigint);
    create table public.mensajes(id bigint primary key,match_id bigint,tipo text,estado_presupuesto text,trabajo_estado text);
    create table public.reputacion(id bigint generated always as identity primary key,created_at timestamptz default now(),match_id bigint unique,proveedor_user_id uuid not null,cliente_user_id uuid,puntaje integer,atributos jsonb,resumen text,comentario text);
    insert into auth.users values('${uid(1)}',null,'{"rol":"cliente","ia_permiso":false}'),('${uid(2)}',null,'{"rol":"proveedor","ia_permiso":false}'),('${uid(3)}',null,'{"rol":"cliente","ia_permiso":true}'),('${uid(4)}',now(),'{}');
    insert into solicitudes values(1,'${uid(1)}'),(2,'${uid(3)}'),(3,'${uid(2)}');
    insert into proveedores values(1,'${uid(2)}');
    insert into matches values(1,1,1),(2,1,1),(3,2,1),(4,3,1);
    insert into mensajes values(1,1,'presupuesto','aceptado','terminado'),(2,2,'presupuesto','aceptado',null),(3,3,'presupuesto','aceptado','terminado'),(4,4,'presupuesto','aceptado','terminado');
    revoke all on auth.users,solicitudes,proveedores,matches,mensajes,reputacion from public,anon,authenticated;
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261028021724_confianza_calificacion_sin_ia.sql',import.meta.url),'utf8'));
});
after(async()=>db?.close());

async function rate({actor=uid(1),match=1,stars=5,comment='Muy buen trabajo',role='authenticated'}={}){
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor||'']);
  await db.exec('set role '+role);
  try{return(await db.query('select to_jsonb(public.servicio_calificar($1,$2,$3)) result',[match,stars,comment])).rows[0].result;}
  finally{await db.exec('reset role');}
}

test('cliente del trabajo terminado califica con IA desactivada; idempotencia y mínima reputación',async()=>{
  const r=await rate();assert.equal(r.match_id,1);assert.equal(r.puntaje,5);assert.equal(r.proveedor_user_id,uid(2));assert.equal(r.cliente_user_id,uid(1));assert.deepEqual(r.atributos,[]);assert.equal(r.resumen,null);
  const twice=await rate();assert.equal(twice.id,r.id);
  assert.equal((await db.query('select count(*)::integer n from reputacion where match_id=1')).rows[0].n,1);
  await assert.rejects(rate({stars:4}),/ya tiene una calificación/);
});
test('proveedor, extraño, usuario eliminado y sin sesión no califican',async()=>{
  for(const actor of [uid(2),uid(3),uid(4),null])await assert.rejects(rate({actor}),/cliente|sesión/);
  await assert.rejects(rate({actor:uid(2),match:4}),/cliente/,'No se permite autocalificación ni siquiera cuando coincide con ambos roles');
});
test('metadatos editables no convierten al proveedor en cliente del trabajo',async()=>{
  await db.query('update auth.users set raw_user_meta_data=$2 where id=$1',[uid(2),{rol:'cliente',ia_permiso:true}]);
  await assert.rejects(rate({actor:uid(2)}),/cliente/);
});
test('presupuesto aceptado sin terminar y trabajo de otro cliente no habilitan calificar',async()=>{
  await assert.rejects(rate({match:2}),/terminado/);
  await assert.rejects(rate({match:3}),/cliente/);
  await assert.rejects(rate({match:999}),/cliente/);
});
test('valida puntaje y largo, conserva comentario como texto sin generar etiquetas',async()=>{
  for(const stars of [0,6,null])await assert.rejects(rate({match:3,actor:uid(3),stars}),/1 a 5/);
  await assert.rejects(rate({match:3,actor:uid(3),comment:'a'.repeat(301)}),/300/);
  const text='<img src=x onerror=alert(1)>';
  const r=await rate({match:3,actor:uid(3),comment:text});assert.equal(r.comentario,text);assert.deepEqual(r.atributos,[]);assert.equal(r.resumen,null);
});
test('RPC no se concede a anónimo y participantes no escriben directamente reputación',async()=>{
  const r=(await db.query("select has_function_privilege('anon','public.servicio_calificar(bigint,integer,text)','execute') anon,has_function_privilege('authenticated','public.servicio_calificar(bigint,integer,text)','execute') auth,has_table_privilege('authenticated','public.reputacion','insert') direct")).rows[0];
  assert.deepEqual(r,{anon:false,auth:true,direct:false});
  await assert.rejects(rate({role:'anon'}),/permission denied/);
});
