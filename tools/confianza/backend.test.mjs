import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=await readFile(new URL('../../supabase/migrations/20261028021451_servicio_acuerdos_reclamos.sql',import.meta.url),'utf8');
const C='10000000-0000-4000-8000-000000000001',P='20000000-0000-4000-8000-000000000002',X='30000000-0000-4000-8000-000000000003';
const IMG=`${P}/1/40000000-0000-4000-8000-000000000004.jpg`;
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema privado;
 create table auth.users(id uuid primary key,deleted_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to public;
 create table public.solicitudes(id bigint primary key,user_id uuid);
 create table public.proveedores(id bigint primary key,user_id uuid);
 create table public.matches(id bigint primary key,solicitud_id bigint references public.solicitudes,proveedor_id bigint references public.proveedores,estado text default 'aceptado');
 create table public.mensajes(id bigint generated always as identity primary key,match_id bigint references public.matches on delete cascade,remitente_tipo text,tipo text,contenido text,monto numeric,incluye text,plazo text,estado_presupuesto text,trabajo_estado text,pago_estado text,pago_id text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now(),primary key(bucket_id,name));
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated,service_role;grant select,insert,delete on storage.objects to authenticated;grant all on storage.objects to service_role;
 create table public.bloqueos(a uuid,b uuid);
 create function privado.hay_bloqueo(c uuid,p uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.bloqueos where (a=c and b=p) or (a=p and b=c))$$;
 insert into auth.users(id) values('${C}'),('${P}'),('${X}');insert into solicitudes values(1,'${C}'),(2,'${X}');insert into proveedores values(1,'${P}');insert into matches values(1,1,1,'aceptado'),(2,2,1,'aceptado');
 insert into mensajes(match_id,remitente_tipo,tipo,contenido,monto,incluye,plazo,estado_presupuesto) values(1,'proveedor','presupuesto','Trabajo original',10000,'Mano de obra','Esta semana','aceptado'),(2,'proveedor','presupuesto','Otro trabajo',10000,'Mano de obra','Esta semana','aceptado');`);
 await db.exec(migration);
 const as=async(user,sql,args=[])=>{await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);try{return await db.query(sql,args);}finally{await db.exec('reset role');}};
 return {db,as};
}
const visit=()=>({nombre_visitante:'Ana Pérez',dia:new Date(Date.now()+86400000).toISOString().slice(0,10),franja:'De 10 a 12',nota:'Voy personalmente'});
const extra=()=>({descripcion:'Reparar otra puerta',monto:2500,incluye:'Mano de obra sin materiales',plazo:'Dos días',presupuesto_base_id:1});
const withdrawal=()=>({equipo:'Lavarropas',marca:'Marca',modelo:'Modelo',serie:'ABC123',estado_equipo:'No enciende, con tapa sana',accesorios:'Cable y manguera',devolucion_prevista:new Date(Date.now()+172800000).toISOString().slice(0,10),fotos:[]});
async function propose(f,tipo,datos=tipo==='visita'?visit():tipo==='adicional'?extra():withdrawal(),replaces=null){return (await f.as(P,'select * from public.servicio_proponer($1,$2,$3,$4)',[1,tipo,JSON.stringify(datos),replaces])).rows[0];}
async function respond(f,id,version=1,accept=true){return (await f.as(C,'select * from public.servicio_responder($1,$2,$3)',[id,accept,version])).rows[0];}

test('participant RLS, author role and direct-write isolation',async()=>{const f=await fixture();try{
 const a=await propose(f,'visita');
 assert.equal((await f.as(C,'select count(*)::int n from servicio_acuerdos')).rows[0].n,1);
 assert.equal((await f.as(X,'select count(*)::int n from servicio_acuerdos')).rows[0].n,0);
 await assert.rejects(f.as(X,'select * from servicio_responder($1,true,1)',[a.id]),/No sos parte/);
 await assert.rejects(f.as(P,'select * from servicio_responder($1,true,1)',[a.id]),/Solo el cliente/);
 await assert.rejects(f.as(C,'select * from servicio_proponer(1,\'visita\',$1)',[JSON.stringify(visit())]),/El proveedor/);
 await assert.rejects(f.as(P,"update servicio_acuerdos set estado='aceptado'"),/permission denied/);
 await assert.rejects(f.as(C,"select * from servicio_soporte_reclamo(gen_random_uuid(),'resuelto','Se resolvió',1)"),/permission denied/);
 await f.db.exec('set role anon');await assert.rejects(f.db.query('select * from servicio_acuerdos'),/permission denied/);await f.db.exec('reset role');
}finally{await f.db.close();}});

test('visitor changes require new acceptance and preserve history; stale version rejected',async()=>{const f=await fixture();try{
 let a=await propose(f,'visita');a=await respond(f,a.id);
 await assert.rejects(f.as(P,"select * from servicio_cambiar_estado($1,'en_camino',1)",[a.id]),/El acuerdo cambió/);
 a=(await f.as(P,"select * from servicio_cambiar_estado($1,'en_camino',$2)",[a.id,a.version])).rows[0];
 const b=await propose(f,'visita',{...visit(),nombre_visitante:'Luisa Gómez'},a.id);
 assert.equal(b.estado,'propuesta');assert.equal(b.respondido_por,null);
 assert.equal((await f.db.query('select estado from servicio_acuerdos where id=$1',[a.id])).rows[0].estado,'reemplazado');
 await assert.rejects(f.as(P,"select * from servicio_cambiar_estado($1,'llego',$2)",[a.id,a.version+1]),/No podés/);
 const accepted=await respond(f,b.id);assert.equal(accepted.datos.nombre_visitante,'Luisa Gómez');
 const old=(await f.db.query('select datos from servicio_acuerdos where id=$1',[a.id])).rows[0];assert.equal(old.datos.nombre_visitante,'Ana Pérez');
}finally{await f.db.close();}});

test('additional creates one separate accepted budget and never changes original or payment',async()=>{const f=await fixture();try{
 const a=await propose(f,'adicional');const b=await respond(f,a.id);assert.ok(b.presupuesto_id);
 await respond(f,a.id,1);
 const all=(await f.db.query('select * from mensajes where match_id=1 order by id')).rows;
 assert.equal(all.length,2);assert.equal(Number(all[0].monto),10000);assert.equal(Number(all[1].monto),2500);
 assert.equal(all[1].estado_presupuesto,'aceptado');assert.equal(all[1].pago_id,null);assert.equal(all[1].pago_estado,null);assert.equal(all[1].trabajo_estado,null);
 await assert.rejects(propose(f,'adicional',extra(),a.id),/no se modifica/);
 await f.db.exec("update mensajes set trabajo_estado='terminado' where id=1");
 await assert.rejects(propose(f,'adicional'),/ya no admite/);
}finally{await f.db.close();}});

test('input validation: external photos, cross-match base, HTML and length rejected',async()=>{const f=await fixture();try{
 await assert.rejects(propose(f,'visita',{...visit(),nombre_visitante:'<script>x</script>'}),/Revisá/);
 await assert.rejects(propose(f,'visita',{...visit(),foto_ref:'https://evil.test/a.jpg'}),/Foto no válida/);
 await assert.rejects(propose(f,'visita',{...visit(),nota:'a'.repeat(1001)}),/Revisá/);
 await assert.rejects(propose(f,'visita',{...visit(),verificado:true}),/Campo de acuerdo/);
 await assert.rejects(propose(f,'adicional',{...extra(),presupuesto_base_id:2}),/ya no admite/);
 await assert.rejects(propose(f,'adicional',{...extra(),monto:-1}),/precio/);
 await assert.rejects(propose(f,'adicional',{...extra(),monto:2.555}),/precio/);
 await assert.rejects(propose(f,'retiro',{...withdrawal(),fotos:Array(6).fill(IMG)}),/cinco fotos/);
}finally{await f.db.close();}});

test('private Storage enforces owner/match and immutable referenced evidence',async()=>{const f=await fixture();try{
 await f.as(P,"insert into storage.objects(bucket_id,name) values('servicio-evidencias',$1)",[IMG]);
 await assert.rejects(f.as(X,"insert into storage.objects(bucket_id,name) values('servicio-evidencias',$1)",[`${X}/1/50000000-0000-4000-8000-000000000005.jpg`]),/row-level security/);
 await assert.rejects(f.as(P,"insert into storage.objects(bucket_id,name) values('servicio-evidencias',$1)",[`${P}/1/a.svg`]),/row-level security/);
 const a=await propose(f,'visita',{...visit(),foto_ref:IMG});assert.equal(a.datos.foto_ref,IMG);
 assert.equal((await f.as(X,"select count(*)::int n from storage.objects")).rows[0].n,0);
 assert.equal((await f.as(C,"select count(*)::int n from storage.objects")).rows[0].n,1);
 await f.as(P,"delete from storage.objects where name=$1",[IMG]);assert.equal((await f.db.query('select count(*)::int n from storage.objects')).rows[0].n,1);
 const bucket=(await f.db.query("select * from storage.buckets where id='servicio-evidencias'")).rows[0];assert.equal(bucket.public,false);assert.equal(bucket.file_size_limit,5242880);
}finally{await f.db.close();}});

test('withdrawal state transitions require provider/client and survive payment completion',async()=>{const f=await fixture();try{
 let a=await propose(f,'retiro');a=await respond(f,a.id);
 await assert.rejects(f.as(C,"select * from servicio_cambiar_estado($1,'retiro_realizado',$2)",[a.id,a.version]),/No podés/);
 a=(await f.as(P,"select * from servicio_cambiar_estado($1,'retiro_realizado',$2)",[a.id,a.version])).rows[0];
 await f.db.exec("update mensajes set trabajo_estado='terminado',pago_estado='approved' where id=1");
 a=(await f.as(P,"select * from servicio_cambiar_estado($1,'devolucion_informada',$2)",[a.id,a.version])).rows[0];
 a=(await f.as(C,"select * from servicio_cambiar_estado($1,'devuelto',$2)",[a.id,a.version])).rows[0];assert.equal(a.estado,'devuelto');
}finally{await f.db.close();}});

test('claims are shared only by participants, remain available after block and require support to resolve',async()=>{const f=await fixture();try{
 await f.db.exec(`insert into bloqueos values('${C}','${P}')`);
 await assert.rejects(propose(f,'visita'),/cerrada/);
 let r=(await f.as(C,"select * from servicio_abrir_reclamo(1,'Daño en el equipo','El equipo quedó dañado y necesito resolverlo.')")).rows[0];
 const twice=(await f.as(C,"select * from servicio_abrir_reclamo(1,'Daño en el equipo','El equipo quedó dañado y necesito resolverlo.')")).rows[0];assert.equal(twice.id,r.id);
 await f.as(P,'select * from servicio_comentar_reclamo($1,$2)',[r.id,'Propongo revisar el equipo el lunes.']);
 assert.equal((await f.as(X,'select count(*)::int n from servicio_reclamos')).rows[0].n,0);
 assert.equal((await f.as(P,'select count(*)::int n from servicio_reclamo_eventos')).rows[0].n,1);
 await f.db.exec('set role service_role');r=(await f.db.query("select * from servicio_soporte_reclamo($1,'en_revision','Estamos revisando la documentación.',1)",[r.id])).rows[0];await f.db.exec('reset role');assert.equal(r.estado,'en_revision');
 assert.equal((await f.as(C,'select count(*)::int n from servicio_reclamo_eventos')).rows[0].n,2);
}finally{await f.db.close();}});

test('account deletion snapshots minimal open cases/withdrawals and queues files; purge180days',async()=>{const f=await fixture();try{
 await f.as(P,"insert into storage.objects(bucket_id,name) values('servicio-evidencias',$1)",[IMG]);
 const a=await propose(f,'retiro',{...withdrawal(),fotos:[IMG]});await respond(f,a.id);
 await f.as(C,"select * from servicio_abrir_reclamo(1,'Equipo pendiente','Quedó pendiente la devolución del equipo.')");
 await f.db.exec('delete from mensajes where match_id=1;delete from matches where id=1;');
 assert.equal((await f.db.query('select count(*)::int n from servicio_acuerdos')).rows[0].n,0);
 const archives=(await f.db.query('select * from privado.servicio_resguardos')).rows;assert.equal(archives.length,2);
 const txt=JSON.stringify(archives);assert.ok(!txt.includes(IMG));assert.ok(!txt.includes(C));assert.ok(!txt.includes(P));assert.ok(!txt.includes('nombre_visitante'));
 const ttl=(new Date(archives[0].eliminar_at)-new Date(archives[0].created_at))/86400000;assert.equal(ttl,180);
 await f.db.exec('set role service_role');const pending=(await f.db.query('select * from servicio_evidencias_pendientes_borrado()')).rows;await f.db.exec('reset role');assert.deepEqual(pending,[{nombre:IMG}]);
 await assert.rejects(f.as(C,'select * from privado.servicio_resguardos'),/permission denied/);
 await f.db.exec("update privado.servicio_resguardos set eliminar_at=now()-interval '1 day';select privado.purgar_resguardos_servicio()");
 assert.equal((await f.db.query('select count(*)::int n from privado.servicio_resguardos')).rows[0].n,0);
}finally{await f.db.close();}});

test('a stale token cannot read, propose or upload after Auth account deletion',async()=>{const f=await fixture();try{
 await propose(f,'visita');
 await f.db.exec(`update auth.users set deleted_at=now() where id='${P}'`);
 assert.equal((await f.as(P,'select count(*)::int n from servicio_acuerdos')).rows[0].n,0);
 await assert.rejects(propose(f,'visita'),/Iniciá sesión/);
 await assert.rejects(f.as(P,"insert into storage.objects(bucket_id,name) values('servicio-evidencias',$1)",[IMG]),/row-level security/);
 assert.equal((await f.as(C,'select count(*)::int n from servicio_acuerdos')).rows[0].n,1);
}finally{await f.db.close();}});

test('acceptance rechecks unfinished original budget; rejects additional after payment',async()=>{const f=await fixture();try{
 const a=await propose(f,'adicional');
 await f.db.exec("update mensajes set pago_estado='cobrado',pago_id='external-proof' where id=1");
 await assert.rejects(respond(f,a.id),/ya no admite/);
 assert.equal((await f.db.query('select count(*)::int n from mensajes where match_id=1')).rows[0].n,1);
 assert.equal((await f.db.query('select estado from servicio_acuerdos where id=$1',[a.id])).rows[0].estado,'propuesta');
}finally{await f.db.close();}});

test('private cleanup retries lost acknowledgements, excludes referenced files and prevents republishing',async()=>{const f=await fixture();try{
 await f.as(P,"insert into storage.objects(bucket_id,name) values('servicio-evidencias',$1)",[IMG]);
 await f.db.exec("update storage.objects set created_at=now()-interval '2 days'");
 await f.db.exec('set role service_role');
 assert.deepEqual((await f.db.query('select * from servicio_evidencias_pendientes_borrado()')).rows,[{nombre:IMG}]);
 await f.db.exec('reset role');
 await assert.rejects(propose(f,'visita',{...visit(),foto_ref:IMG}),/Foto no válida/);
 // Fixture emulates a Storage API removal whose caller lost its acknowledgement.
 await f.db.exec("delete from storage.objects where name='"+IMG+"';set role service_role");
 assert.deepEqual((await f.db.query('select * from servicio_evidencias_pendientes_borrado()')).rows,[{nombre:IMG}]);
 assert.equal((await f.db.query('select servicio_evidencias_borradas($1) n',[[IMG]])).rows[0].n,1);
 assert.equal((await f.db.query('select servicio_evidencias_borradas($1) n',[[IMG]])).rows[0].n,0);
 await f.db.exec('reset role');
 const other=`${P}/1/50000000-0000-4000-8000-000000000005.jpg`;
 await f.as(P,"insert into storage.objects(bucket_id,name) values('servicio-evidencias',$1)",[other]);
 await propose(f,'retiro',{...withdrawal(),fotos:[other]});
 await f.db.exec("update storage.objects set created_at=now()-interval '2 days';set role service_role");
 assert.equal((await f.db.query('select * from servicio_evidencias_pendientes_borrado()')).rows.length,0);
 await f.db.exec('reset role');
}finally{await f.db.close();}});

test('support closure locks comments and purge removes only expired closed cases and events',async()=>{const f=await fixture();try{
 const r=(await f.as(C,"select * from servicio_abrir_reclamo(1,'Equipo pendiente','Necesito resolver la devolución del equipo.')")).rows[0];
 await f.db.exec('set role service_role');
 await f.db.query("select * from servicio_soporte_reclamo($1,'resuelto','Se documentó la solución acordada.',1)",[r.id]);
 await f.db.exec('reset role');
 await assert.rejects(f.as(P,'select * from servicio_comentar_reclamo($1,$2)',[r.id,'Intento posterior al cierre.']),/está cerrado/);
 const newer=(await f.as(C,"select * from servicio_abrir_reclamo(1,'Nuevo inconveniente','Quedó otro inconveniente pendiente de revisar.')")).rows[0];
 assert.notEqual(newer.id,r.id);
 await f.db.exec("update servicio_reclamos set updated_at=now()-interval '181 days';select privado.purgar_resguardos_servicio()");
 const cases=(await f.as(C,'select id from servicio_reclamos')).rows;assert.deepEqual(cases,[{id:newer.id}]);
 assert.equal((await f.db.query('select count(*)::int n from servicio_reclamo_eventos')).rows[0].n,0);
}finally{await f.db.close();}});

test('all exposed RPCs and cleanup functions deny anon; authenticated cannot bypass cleanup permissions',async()=>{const f=await fixture();try{
 const acl=(await f.db.query(`select proname,
 has_function_privilege('anon',p.oid,'EXECUTE') anon,
 has_function_privilege('authenticated',p.oid,'EXECUTE') usuario
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and proname like 'servicio_%' order by proname`)).rows;
 assert.equal(acl.length,8);
 assert.ok(acl.every(x=>x.anon===false));
 assert.ok(acl.filter(x=>/soporte|evidencias/.test(x.proname)).every(x=>x.usuario===false));
 assert.ok(acl.filter(x=>!/soporte|evidencias/.test(x.proname)).every(x=>x.usuario===true));
 await assert.rejects(f.as(C,'select * from servicio_evidencias_pendientes_borrado()'),/permission denied/);
 await assert.rejects(f.as(P,'select servicio_evidencias_borradas($1)',[[IMG]]),/permission denied/);
}finally{await f.db.close();}});
