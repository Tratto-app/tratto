import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const WS='00000000-0000-4000-a000-000000000001', USER='00000000-0000-4000-b000-000000000001', RUN='00000000-0000-4000-c000-000000000001';
const migration=await readFile(new URL('../../supabase/migrations/20261016163321_whatsapp_observer_owner_link.sql',import.meta.url),'utf8');
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create table growth_workspaces(id uuid primary key);
 create table growth_members(workspace_id uuid,user_id uuid,role text);
 create table growth_mkt_items(workspace_id uuid,datos jsonb,estado text);
 create table growth_mkt_ajustes(workspace_id uuid,clave text,valor jsonb,updated_at timestamptz);
 create table growth_wa_observer_config(workspace_id uuid primary key,receiving_enabled boolean,waba_id text,phone_number_id text,business_phone text,owner_authorized_at timestamptz,coexistence_verified_at timestamptz,coverage_gap boolean,coverage_since timestamptz,coverage_through timestamptz,history_shared boolean,updated_at timestamptz);
 create table growth_prospects(status text,registered_at timestamptz,contact_count integer);
 create table growth_wa_config(enabled boolean,daily_limit integer);
 insert into growth_workspaces values('${WS}');
 insert into growth_members values('${WS}','${USER}','owner');
 insert into growth_mkt_items values('${WS}','{"clave":"coordinacion_codex_claude"}','programado');
 insert into growth_mkt_ajustes values('${WS}','whatsapp_seguimiento_meta','{"app_id":"111111","embedded_signup_config_id":"222222","business_phone_objetivo":"+5491100000001","preservar":"si"}',now());
 insert into growth_prospects values('registered',now(),7);
 insert into growth_wa_config values(false,0);
 grant usage on schema public to service_role,anon,authenticated;
 grant all on all tables in schema public to service_role;`);
 await db.exec(migration);
 await db.exec(`insert into growth_wa_setup_sessions(id,workspace_id,user_id,app_id,config_id,state_hash,verify_hash,status,expires_at) values('${RUN}','${WS}','${USER}','111111','222222',repeat('a',64),repeat('b',64),'processing',now()+interval '15 minutes');`);
 return db;
}
const link=(db,{user=USER,phone='+541100000001',missing='[]',receiving=true}={})=>db.query('select growth_wa_observer_owner_link($1,$2,$3,$4,$5,$6,$7,$8::jsonb) as result',[WS,user,RUN,'333333','444444',phone,receiving,missing]);
test('vínculo válido mantiene envíos, registro y métricas; cobertura sigue pendiente',async()=>{
 const db=await fixture();try{
  await db.exec('set role service_role');await link(db);
  const c=(await db.query('select * from growth_wa_observer_config')).rows[0];
  assert.equal(c.receiving_enabled,true);assert.equal(c.coverage_gap,true);assert.equal(c.coverage_through,null);assert.equal(c.history_shared,false);
  assert.deepEqual((await db.query('select * from growth_wa_config')).rows[0],{enabled:false,daily_limit:0});
  const p=(await db.query('select * from growth_prospects')).rows[0];assert.equal(p.status,'registered');assert.equal(p.contact_count,7);assert.ok(p.registered_at);
  const settings=(await db.query('select valor from growth_mkt_ajustes')).rows[0].valor;assert.equal(settings.preservar,'si');assert.equal(settings.estado,'vinculado_pendiente_prueba_real');
 }finally{await db.close();}
});
test('pausa, otro titular, otra configuración y otro número no producen vínculo',async()=>{
 for(const scenario of ['pause','user','config','phone']){
  const db=await fixture();try{
   if(scenario==='pause')await db.exec("update growth_mkt_items set estado='cambios'");
   if(scenario==='config')await db.exec("update growth_mkt_ajustes set valor=valor||'{\"embedded_signup_config_id\":\"999999\"}'");
   await db.exec('set role service_role');
   await assert.rejects(link(db,scenario==='user'?{user:RUN}:scenario==='phone'?{phone:'+541100000002'}:{}));
   assert.equal((await db.query('select count(*)::integer as n from growth_wa_observer_config')).rows[0].n,0);
  }finally{await db.close();}
 }
});
test('sesión vencida y webhook incompleto no habilitan recepción',async()=>{
 const db=await fixture();try{
  await db.exec('set role service_role');await assert.rejects(link(db,{missing:'["history"]'}));
  await link(db,{receiving:false,missing:'["callback_url"]'});
  assert.equal((await db.query('select receiving_enabled from growth_wa_observer_config')).rows[0].receiving_enabled,false);
  await db.exec("update growth_wa_setup_sessions set expires_at=now()-interval '1 minute'");await assert.rejects(link(db));
 }finally{await db.close();}
});
test('anon y authenticated no leen hashes ni pueden ejecutar el RPC privilegiado',async()=>{
 const db=await fixture();try{
  for(const role of ['anon','authenticated']){
   await db.exec('reset role; set role '+role);
   await assert.rejects(db.query('select * from growth_wa_setup_sessions'));
   await assert.rejects(link(db));
  }
 }finally{await db.close();}
});
