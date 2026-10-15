import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const A = '00000000-0000-4000-a000-000000000001';
const B = '00000000-0000-4000-a000-000000000002';
const P = '00000000-0000-4000-b000-000000000001';
const U = '00000000-0000-4000-c000-000000000001';
const G = '00000000-0000-4000-d000-000000000001';
const migration = await readFile(new URL('../../supabase/migrations/20261015013759_whatsapp_observacion_solo_lectura.sql', import.meta.url), 'utf8');
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),deleted_at timestamptz);
  create table public.growth_workspaces(id uuid primary key);
  create table public.growth_prospects(id uuid primary key,workspace_id uuid,phone text,email text,app_user_id uuid,datos jsonb default '{}',status text default 'uncontacted',do_not_contact boolean default false,consent text default 'unknown',registered_at timestamptz,activated_at timestamptz,contact_count integer default 0);
  create table public.growth_app_users(id uuid,workspace_id uuid,prospect_id uuid,external_user_id text);
  create table public.proveedores(user_id uuid,telefono text,demo boolean);
  create table public.growth_timeline(workspace_id uuid,prospect_id uuid,type text,title text,detail jsonb,actor text);
  create table public.growth_messages(id uuid); create table public.growth_workflow_runs(id uuid); create table public.growth_wa_queue(id uuid);
  create function public.growth_is_member(ws uuid) returns boolean language sql stable as $$select ws=nullif(current_setting('test.workspace',true),'')::uuid$$;
  grant usage on schema public to service_role,authenticated,anon;
  grant all on all tables in schema public to service_role;
  insert into public.growth_workspaces values('${A}'),('${B}');
  insert into auth.users(id,email) values('${U}','business@example.invalid');
  insert into public.growth_prospects(id,workspace_id,phone,email,app_user_id,datos,status,registered_at,activated_at)
  values('${P}','${A}','+5491100000001','business@example.invalid','${G}','{"whatsapp_manual":{"fecha_lista":"2026-10-14"}}','registered','2026-10-14','2026-10-14');
  insert into public.growth_app_users values('${G}','${A}','${P}','${U}');`);
  await db.exec(migration);
  await db.exec(`insert into public.growth_wa_observer_config(workspace_id) values('${A}'),('${B}');`);
  return db;
}
async function enabled(db) {
  await db.exec(`update public.growth_wa_observer_config set receiving_enabled=true,waba_id='12345',phone_number_id='123',business_phone='+5491100000000',owner_authorized_at=now(),coexistence_verified_at=now() where workspace_id='${A}';`);
}
function event(id, direction='out', body='Hola', extra={}) {
  return { waba_id:'12345',phone_number_id:'123',key: 'message:'+id,kind:'message',external_id:id,phone:'5491100000001',direction,source:direction==='out'?'smb_message_echoes':'messages',body,text_available:true,message_type:'text',timestamp:String(Math.floor(Date.now()/1000)-300),...extra };
}
async function ingest(db,e,ws=A) { return (await db.query('select public.growth_wa_observer_ingest($1,$2::jsonb) as value',[ws,JSON.stringify(e)])).rows[0].value; }
async function summary(db) { return (await db.query(`select datos#>'{whatsapp_manual,seguimiento_meta}' as value from growth_prospects where id='${P}'`)).rows[0].value; }
test('apagado no guarda; firmas/direcciones se validan en el receptor antes de este RPC', async () => {
 const db=await fixture(); try {
  assert.equal((await ingest(db,event('off'))).reason,'disabled');
  assert.equal((await db.query('select count(*)::integer as n from growth_wa_observer_events')).rows[0].n,0);
  await assert.rejects(db.exec(`update growth_wa_observer_config set receiving_enabled=true where workspace_id='${A}'`));
 } finally { await db.close(); }
});
test('duplicados/history y baja preservan cuenta; no ejecutan motor comercial', async () => {
 const db=await fixture(); try {
  await enabled(db);
  await db.exec('set role service_role');
  assert.equal((await ingest(db,event('first'))).stored,true);
  assert.equal((await ingest(db,event('first'))).reason,'duplicate');
  await db.exec(`update growth_wa_observer_config set history_shared=true where workspace_id='${A}'`);
  assert.equal((await ingest(db,event('first','out','Hola',{source:'history'}))).reason,'duplicate');
  await ingest(db,event('no','in','No me contacten', {timestamp:String(Math.floor(Date.now()/1000)-200)}));
  const p=(await db.query(`select * from growth_prospects where id='${P}'`)).rows[0];
  assert.equal(p.status,'registered'); assert.equal(p.app_user_id,G); assert.ok(p.registered_at); assert.ok(p.activated_at);
  assert.equal(p.consent,'opt_out'); assert.equal(p.do_not_contact,true); assert.equal(p.contact_count,0);
  assert.equal((await summary(db)).respuesta,'respondio');
  assert.equal((await summary(db)).registro.estado,'registrado_verificado');
  const counts=(await db.query('select (select count(*) from growth_messages)::integer as messages,(select count(*) from growth_workflow_runs)::integer as runs,(select count(*) from growth_wa_queue)::integer as queue,(select count(*) from growth_timeline)::integer as timeline')).rows[0];
  assert.deepEqual(counts,{messages:0,runs:0,queue:0,timeline:2});
 } finally { await db.close(); }
});
test('sin cobertura no infiere silencio; responder antes del último saliente no se pierde', async () => {
 const db=await fixture(); try {
  await enabled(db); await ingest(db,event('first'));
  assert.equal((await summary(db)).respuesta,'pendiente_de_comprobar');
  await db.exec(`update growth_wa_observer_config set coverage_gap=false,coverage_since=now()-interval '1 day',coverage_through=now() where workspace_id='${A}'; select growth_wa_observer_refresh('${A}',now());`);
  assert.equal((await summary(db)).respuesta,'sin_respuesta_observada_al_corte');
  await ingest(db,event('reply','in','Ya estoy',{timestamp:String(Math.floor(Date.now()/1000)-200)}));
  await ingest(db,event('later','out','Gracias',{timestamp:String(Math.floor(Date.now()/1000)-100)}));
  assert.equal((await summary(db)).respuesta,'respondio');
  await ingest(db,{waba_id:'12345',phone_number_id:'123',key:'disconnect-test',kind:'account_update',event:'PARTNER_REMOVED'});
  const reason=(await db.query(`select last_account_event,last_account_event_at from growth_wa_observer_config where workspace_id='${A}'`)).rows[0];
  assert.equal(reason.last_account_event,'PARTNER_REMOVED'); assert.ok(reason.last_account_event_at);
  assert.equal((await ingest(db,event('after'))).reason,'disabled');
 } finally { await db.close(); }
});
test('un no ambiguo o una baja histórica requieren revisión; sólo una baja explícita actual excluye', async () => {
 const db=await fixture(); try {
  await enabled(db);
  await ingest(db,event('ambiguous-no','in','no'));
  let p=(await db.query(`select do_not_contact,consent from growth_prospects where id='${P}'`)).rows[0];
  assert.deepEqual(p,{do_not_contact:false,consent:'unknown'});
  assert.equal((await summary(db)).baja_pendiente_revision,true);
  await db.exec(`update growth_wa_observer_config set history_shared=true where workspace_id='${A}'`);
  await ingest(db,event('history-stop','in','No me escriban más',{source:'history'}));
  p=(await db.query(`select do_not_contact,consent from growth_prospects where id='${P}'`)).rows[0];
  assert.deepEqual(p,{do_not_contact:false,consent:'unknown'});
  const historical=(await db.query(`select detail from growth_wa_observer_events where external_id='history-stop'`)).rows[0];
  assert.equal(historical.detail.opt_out_review_required,true);
  await ingest(db,event('current-stop','in','No me escriban más'));
  p=(await db.query(`select do_not_contact,consent,status from growth_prospects where id='${P}'`)).rows[0];
  assert.deepEqual(p,{do_not_contact:true,consent:'opt_out',status:'registered'});
 } finally { await db.close(); }
});
test('negocio ambiguo/otro workspace/no listado no se incorpora', async () => {
 const db=await fixture(); try {
  await enabled(db);
  assert.equal((await ingest(db,event('stale','out','Hola',{phone_number_id:'old-phone'}))).reason,'configuration_changed');
  assert.equal((await ingest(db,event('other','out','Hola',{phone:'5491100000002'}))).reason,'unknown_or_ambiguous_business');
  assert.equal((await ingest(db,event('cross'),'00000000-0000-4000-a000-000000000099')).reason,'disabled');
  await db.exec(`insert into growth_prospects(id,workspace_id,phone,datos) values(gen_random_uuid(),'${A}','+541100000001','{}');`);
  assert.equal((await ingest(db,event('ambiguous'))).reason,'unknown_or_ambiguous_business');
  await db.exec(`delete from growth_prospects where id<>'${P}'; update growth_prospects set datos='{}' where id='${P}';`);
  assert.equal((await ingest(db,event('not-listed'))).reason,'outside_manual_lists');
 } finally { await db.close(); }
});
test('Auth real y coincidencia única: no acepta cuenta borrada ni afirmación por texto', async () => {
 const db=await fixture(); try {
  await enabled(db);
  await db.exec(`update auth.users set deleted_at=now() where id='${U}'`);
  await ingest(db,event('claim','in','Ya me registré'));
  assert.equal((await summary(db)).registro.estado,'sin_registro_detectado_al_corte');
  assert.equal((await db.query(`select status from growth_prospects where id='${P}'`)).rows[0].status,'registered');
 } finally { await db.close(); }
});
test('RLS de lectura por workspace y RPC/escrituras inaccesibles desde navegador', async () => {
 const db=await fixture(); try {
  await enabled(db); await ingest(db,event('visible'));
  await db.exec(`set role authenticated; set test.workspace='${B}'`);
  assert.equal((await db.query('select count(*)::integer as n from growth_wa_observer_events')).rows[0].n,0);
  await assert.rejects(ingest(db,event('forbidden')));
  await assert.rejects(db.exec(`update growth_wa_observer_config set receiving_enabled=false where workspace_id='${A}'`));
  await assert.rejects(db.query(`select growth_wa_private.registration('${A}','${P}')`));
  await db.exec(`set test.workspace='${A}'`);
  assert.equal((await db.query('select count(*)::integer as n from growth_wa_observer_events')).rows[0].n,1);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from growth_wa_observer_events'));
 } finally { await db.close(); }
});
