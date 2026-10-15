import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const A='00000000-0000-4000-a000-000000000001';
const B='00000000-0000-4000-a000-000000000002';
const BOARD='00000000-0000-4000-b000-000000000001';
const MSG='00000000-0000-4000-c000-000000000001';
const migration=await readFile(new URL('../../supabase/migrations/20261015233946_codex_chat_eventos.sql',import.meta.url),'utf8');
async function fixture() {
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema vault;create schema net;
 create table vault.decrypted_secrets(name text,decrypted_secret text);
 create table net.requests(id bigserial primary key,url text,headers jsonb,body jsonb);
 create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)
 returns bigint language sql as $$insert into net.requests(url,headers,body)values(url,headers,body)returning id$$;
 create table public.growth_workspaces(id uuid primary key);
 create table public.growth_mkt_items(id uuid primary key,workspace_id uuid,estado text default 'hecho',creado_por text,datos jsonb default '{}');
 insert into public.growth_workspaces values('${A}'),('${B}');
 insert into public.growth_mkt_items(id,workspace_id,estado,creado_por) values('${BOARD}','${A}','programado','codex');`);
 await db.exec(migration);
 await db.exec(`insert into growth_agent_private.codex_config(workspace_id,board_id)values('${A}','${BOARD}');`);
 return db;
}
async function message(db,extra={},ws=A,author='claude',id=MSG) {
 const data={clave:'mensaje_agentes',de:'claude',para:'codex',leido:false,...extra};
 await db.query('insert into public.growth_mkt_items(id,workspace_id,creado_por,datos)values($1,$2,$3,$4)',[id,ws,author,JSON.stringify(data)]);
}
async function enabled(db) {
 await db.exec(`insert into vault.decrypted_secrets values('codex_chat_webhook','local-test-only-not-a-real-credential');
 update growth_agent_private.codex_config set enabled=true,receiver_url='https://receiver.example.invalid/events/claude' where workspace_id='${A}';`);
}
async function outbox(db) {return (await db.query('select * from growth_agent_private.codex_outbox')).rows;}
test('new real message is retained without a receiver; not marked read or replied',async()=>{
 const db=await fixture();try{
  await message(db);
  assert.equal((await outbox(db))[0].delivery_status,'waiting_receiver');
  assert.equal((await db.query(`select datos->>'leido' as leido from growth_mkt_items where id='${MSG}'`)).rows[0].leido,'false');
  assert.equal((await db.query('select count(*)::int as n from net.requests')).rows[0].n,0);
 }finally{await db.close();}
});
test('one event -> authenticated request with IDs only; edits and duplicate dispatch do not notify',async()=>{
 const db=await fixture();try{
  await enabled(db);await message(db);
  const e=(await outbox(db))[0];assert.equal(e.delivery_status,'dispatch_requested');
  await db.exec(`select growth_agent_private.codex_dispatch('${MSG}');
    update growth_mkt_items set datos=datos||'{"leido":true}'::jsonb where id='${MSG}';
    update growth_mkt_items set estado='hecho' where id='${MSG}';`);
  const r=(await db.query('select * from net.requests')).rows;assert.equal(r.length,1);
  assert.deepEqual(r[0].body,{version:1,event_id:'codex:'+MSG,workspace_id:A,message_id:MSG,board_id:BOARD});
  assert.equal(Object.hasOwn(r[0].body,'texto'),false);
  assert.ok(r[0].headers.Authorization.startsWith('Bearer '));
  assert.equal((await outbox(db))[0].read_at,null);
 }finally{await db.close();}
});
test('paused board holds messages; explicit resume drains them once',async()=>{
 const db=await fixture();try{
  await enabled(db);await db.exec(`update growth_mkt_items set estado='cambios' where id='${BOARD}'`);
  await message(db);assert.equal((await outbox(db))[0].delivery_status,'held_by_pause');
  assert.equal((await db.query('select count(*)::int n from net.requests')).rows[0].n,0);
  await db.exec(`update growth_mkt_items set estado='programado' where id='${BOARD}'`);
  assert.equal((await db.query('select count(*)::int n from net.requests')).rows[0].n,1);
  await db.exec(`update growth_mkt_items set datos='{"latido":"ignored"}' where id='${BOARD}'`);
  assert.equal((await db.query('select count(*)::int n from net.requests')).rows[0].n,1);
 }finally{await db.close();}
});
test('other recipients, tests, other sender, read messages, and other workspace do not wake Codex',async()=>{
 const cases=[{extra:{para:'claude'}},{extra:{prueba:true}},{extra:{es_prueba:true}},
  {extra:{test:true}},{extra:{leido:true}},{extra:{de:'codex'}},{extra:{},ws:B}];
 for(const c of cases){const db=await fixture();try{
  await enabled(db);await message(db,c.extra,c.ws||A,c.author||'claude');
  assert.equal((await outbox(db)).length,0);
 }finally{await db.close();}}
});
test('legacy creator metadata does not discard a genuine Claude-addressed CRM message',async()=>{
 const db=await fixture();try{
  await enabled(db);await message(db,{},A,'persona');
  assert.equal((await outbox(db))[0].delivery_status,'dispatch_requested');
 }finally{await db.close();}
});
test('HTTP enqueue failure cannot prevent source chat insert; can retry a request never created',async()=>{
 const db=await fixture();try{
  await enabled(db);
  await db.exec(`create or replace function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)
    returns bigint language plpgsql as $$begin raise exception 'test_transport_failure';end$$;`);
  await message(db);assert.equal((await outbox(db))[0].delivery_status,'dispatch_error');
  assert.equal((await db.query(`select count(*)::int n from growth_mkt_items where id='${MSG}'`)).rows[0].n,1);
 }finally{await db.close();}
});
test('private config/outbox and privileged functions are unavailable to client roles',async()=>{
 const db=await fixture();try{
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   await assert.rejects(db.exec('select * from growth_agent_private.codex_config'));
   await assert.rejects(db.exec('select * from growth_agent_private.codex_outbox'));
   await assert.rejects(db.exec(`select growth_agent_private.codex_dispatch_pending('${A}',100)`));
   await db.exec('reset role');
  }
 }finally{await db.close();}
});
