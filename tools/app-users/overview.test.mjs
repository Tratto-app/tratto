import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db, fixtureDay; const ws='00000000-0000-0000-0000-000000000010';
const uid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,created_at timestamptz,deleted_at timestamptz,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
 create table public.proveedores(user_id uuid,demo boolean,nombre text,rubro text,rubro_personalizado text);
 create table public.push_subscripciones(user_id uuid,endpoint text);
 create table public.publicaciones(user_id uuid,tipo text,estado text);
 create table public.solicitudes(user_id uuid,demo boolean);
 create table public.growth_app_users(id uuid,workspace_id uuid,external_user_id text,created_at timestamptz,name text,kind text,activated_at timestamptz);
 create function public.crm_ws() returns uuid language sql as $$select '${ws}'::uuid$$;
 create function public.growth_is_member(uuid) returns boolean language sql as $$select $1='${ws}'::uuid and auth.uid()='${uid(1)}'::uuid$$;`);
 await db.exec(await readFile(new URL('../../supabase/migrations/20261020004423_app_users_visual_overview.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261105231159_crm_social_names_phone_matching.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261106012212_crm_social_identity_sync.sql',import.meta.url),'utf8'));
 fixtureDay=(await db.query("select to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD') d")).rows[0].d;
 for(const [n,rol,rubro,demo,deleted] of [[1,'cliente',null,false,false],[2,'proveedor','Pintura',false,false],[3,'proveedor','Cerrajería',false,false],[4,'cliente',null,true,false],[5,'proveedor','Pintura',true,false],[6,'proveedor','Pintura',false,true],[7,'cliente',null,false,false]]){
  await db.query('insert into auth.users values($1,$2,$3,$4,$5,$6)',[uid(n),`test${n}@example.invalid`,n===3?`${fixtureDay}T03:01:00Z`:`${fixtureDay}T02:59:00Z`,deleted?'2026-10-20T00:00:00Z':null,{nombre:`Persona ${n}`,rol,rubro},{demo}]);
 }
 await db.exec(`insert into proveedores values('${uid(2)}',false,'Pintor','Pintura',null),('${uid(2)}',false,'Pintor','Pintura',null),('${uid(7)}',false,'Negocio','Carpintería',null);
 insert into push_subscripciones values('${uid(2)}','device1'),('${uid(2)}','device2'),('${uid(3)}','device3'),('${uid(7)}','');
 insert into publicaciones values('${uid(2)}','trabajo','publicado'),('${uid(2)}','trabajo','borrador'),('${uid(3)}','novedad','publicado');
 insert into solicitudes values('${uid(1)}',false),('${uid(1)}',true);`);
});
after(async()=>db?.close());
async function call({member=true,workspace=ws,query='',kind=null,stage=null,rubro=null,page=0}={}){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[member?uid(1):uid(2)]);
 return (await db.query('select public.growth_app_users_overview($1,$2,$3,$4,$5,$6) result',[workspace,query,kind,stage,rubro,page])).rows[0].result;
}
test('cuentas sin evento CRM, demos/eliminados fuera y sin duplicar dispositivos/servicios',async()=>{
 const d=await call();assert.equal(d.totales.usuarios,4);assert.equal(d.totales.proveedores,3);assert.equal(d.totales.clientes,1);
 assert.equal(d.totales.proveedores_push,2);assert.equal(d.totales.proveedores_publicados,2);assert.equal(d.totales.proveedores_pendientes,1);assert.equal(d.totales.servicios,3);assert.equal(d.totales.trabajos,1);
 assert.equal(d.usuarios.find(u=>u.user_id===uid(2)).dispositivos,2);
 assert.equal(d.usuarios.find(u=>u.user_id===uid(1)).pedidos,1);
 assert.equal(d.rubros.find(r=>r.rubro==='Pintura').registrados,1);
 assert.equal(d.usuarios.find(u=>u.user_id===uid(3)).crm_id,null);
 assert.ok(!JSON.stringify(d).includes('device1'));
});
test('rol actual o servicio publicado y filtros no alteran totales',async()=>{
 const d=await call({stage:'pending'});assert.equal(d.total_filtrado,1);assert.equal(d.usuarios[0].rubros[0],'Cerrajería');assert.equal(d.totales.usuarios,4);
 assert.equal((await call({kind:'customer'})).total_filtrado,1);
 assert.equal((await call({query:'Persona 2',rubro:'Pintura'})).total_filtrado,1);
 assert.equal((await call({query:'%'})).total_filtrado,0);
});
test('altas según día Buenos Aires, incluyendo cerrajero de hoy y sin confundir cambio de rol',async()=>{
 const d=await call();const x=d.altas.find(a=>a.dia===fixtureDay);assert.ok(x);assert.equal(x.proveedores,1);const prev=d.altas.find(a=>a.dia===new Date(Date.parse(fixtureDay+'T12:00:00Z')-86400000).toISOString().slice(0,10));assert.equal(prev.proveedores,2);assert.equal(prev.clientes,1);
});
test('paginación vacía, parámetros inválidos y miembros ajenos rechazados',async()=>{
 assert.equal((await call({page:1})).usuarios.length,0);await assert.rejects(call({page:-1}),/Página inválida/);
 await assert.rejects(call({member:false}),/permiso/);await assert.rejects(call({workspace:uid(999)}),/permiso/);
 await assert.rejects(call({kind:'admin'}),/Tipo inválido/);
 await db.exec("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(db.query('select public.growth_app_users_overview($1)',[ws]),/permiso/);
});
test('RPC sin permiso anónimo y helper privado sin acceso autenticado',async()=>{
 const r=await db.query("select has_function_privilege('anon','public.growth_app_users_overview(uuid,text,text,text,text,integer)','execute') anon,has_schema_privilege('authenticated','growth_users_private','usage') helper,has_function_privilege('authenticated','public.growth_app_users_overview(uuid,text,text,text,text,integer)','execute') member");
 assert.deepEqual(r.rows[0],{anon:false,helper:false,member:true});
});
test('páginas completas sin omitir ni duplicar cuentas con misma fecha',async()=>{
 await db.exec('begin');
 try{
  for(let n=100;n<153;n++) await db.query('insert into auth.users values($1,$2,now(),null,$3,$4)',[uid(n),`p${n}@example.invalid`,{nombre:'Alta de prueba',rol:'cliente'},{}]);
  const a=await call(),b=await call({page:1});assert.equal(a.total_filtrado,57);assert.equal(a.usuarios.length,50);assert.equal(b.usuarios.length,7);assert.equal(new Set([...a.usuarios,...b.usuarios].map(x=>x.user_id)).size,57);
 }finally{await db.exec('rollback');}
});
test('Google y Apple cuentan como cuentas reales y conservan el rol pendiente',async()=>{
 await db.exec('begin');
 try{
  for(const [n,meta,provider] of [[201,{full_name:'Nombre de Google'},'google'],[202,{name:'Segundo nombre'},'google'],[203,{},'apple'],[204,{nombre:'Nombre elegido',full_name:'Nombre social',rol:'cliente'},'google']]){
   await db.query('insert into auth.users values($1,$2,now(),null,$3,$4)',[uid(n),`social${n}@example.invalid`,meta,{provider}]);
  }
  const d=await call();assert.equal(d.totales.usuarios,8);assert.equal(d.totales.sin_tipo,3);
  const account=n=>d.usuarios.find(u=>u.user_id===uid(n));
  assert.equal(account(201).nombre,'Nombre de Google');assert.equal(account(202).nombre,'Segundo nombre');
  assert.equal(account(203).nombre,'Nombre no informado');assert.equal(account(203).metodo_ingreso,'apple');
  assert.equal(account(204).nombre,'Nombre elegido');assert.equal(account(204).tipo,'customer');
  assert.equal((await call({query:'Nombre de Google'})).total_filtrado,1);
  assert.ok([201,202,203].every(n=>account(n).tipo==='unknown'));
 }finally{await db.exec('rollback');}
});
test('el nombre social se guarda en la ficha existente y se conserva el nombre manual',async()=>{
 await db.exec('begin');try{
  await db.exec(`create function public.test_capture_user() returns trigger language plpgsql as $$begin insert into growth_app_users(id,workspace_id,external_user_id,created_at,kind,activated_at)values(new.id,'${ws}',new.id::text,now(),'provider','2026-10-01');return new;end$$;
   create trigger crm_registro after insert on auth.users for each row execute function public.test_capture_user();`);
  await db.query('insert into auth.users values($1,$2,now(),null,$3,$4)',[uid(301),'google@example.invalid',{full_name:'Nombre Google'},{provider:'google'}]);
  let g=(await db.query('select name,kind,activated_at from growth_app_users where id=$1',[uid(301)])).rows[0];
  assert.equal(g.name,'Nombre Google');assert.equal(g.kind,'provider');assert.ok(g.activated_at);
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{nombre:'Nombre completado',rol:'proveedor'},uid(301)]);
  assert.equal((await db.query('select name from growth_app_users where id=$1',[uid(301)])).rows[0].name,'Nombre completado');
  await db.query('update growth_app_users set name=$1 where id=$2',['Nombre manual CRM',uid(301)]);
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{nombre:'Otro nombre',rol:'proveedor'},uid(301)]);
  assert.equal((await db.query('select name from growth_app_users where id=$1',[uid(301)])).rows[0].name,'Nombre manual CRM');
  await db.query('insert into auth.users values($1,$2,now(),null,$3,$4)',[uid(302),'apple@example.invalid',{}, {provider:'apple'}]);
  assert.equal((await db.query('select name from growth_app_users where id=$1',[uid(302)])).rows[0].name,null);
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{full_name:'Nombre Apple'},uid(302)]);
  assert.equal((await db.query('select name from growth_app_users where id=$1',[uid(302)])).rows[0].name,'Nombre Apple');
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{},uid(302)]);
  await db.query('update growth_app_users set name=$1 where id=$2',['Nombre confirmado en CRM',uid(302)]);
  assert.equal((await call({query:'Nombre confirmado en CRM'})).usuarios[0].nombre,'Nombre confirmado en CRM');
  assert.equal((await call({query:'Nombre confirmado en CRM'})).usuarios[0].tipo,'unknown');
  assert.equal((await db.query("select has_function_privilege('authenticated','growth_users_private.sync_identity_name()','execute') allowed")).rows[0].allowed,false);
 }finally{await db.exec('rollback');}
});
