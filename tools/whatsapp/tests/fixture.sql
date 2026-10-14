-- Datos sintéticos: ejecutar sólo en una base local descartable.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create table auth.users(id uuid default gen_random_uuid(),email text,phone text);
create table public.growth_workspaces(id uuid primary key default gen_random_uuid(),slug text);
create table public.growth_prospects(id uuid primary key default gen_random_uuid(),workspace_id uuid,kind text default 'provider',phone text,email text,company text,first_name text,city text,source_id uuid,created_at timestamptz default now(),
  do_not_contact boolean default false,consent text default 'unknown',status text default 'new',app_user_id uuid,registered_at timestamptz,
  rubro text,zona text,entrada text,datos jsonb default '{}'::jsonb);
create table public.growth_mkt_rotacion(workspace_id uuid,rubro text,activo boolean default true);
create table public.growth_conversations(id uuid primary key default gen_random_uuid(),workspace_id uuid,prospect_id uuid,channel text);
create table public.growth_messages(id uuid primary key default gen_random_uuid(),workspace_id uuid,prospect_id uuid,conversation_id uuid,channel text,direction text,body text,status text,provider text,external_id text,error text);
create table public.growth_mkt_items(id uuid primary key default gen_random_uuid(),workspace_id uuid,departamento text,tipo text,titulo text,resumen text,cuerpo text,canal text,estado text,datos jsonb,creado_por text);
create table public.growth_sources(id uuid primary key default gen_random_uuid(),workspace_id uuid,key text);
grant usage on schema public,auth to service_role;
grant select,insert,update,delete on all tables in schema public,auth to service_role;
revoke select on auth.users from service_role;
insert into public.growth_workspaces values('00000000-0000-4000-8000-000000000001','tratto'),('00000000-0000-4000-8000-000000000002','otro');
insert into public.growth_mkt_rotacion values('00000000-0000-4000-8000-000000000001','Pintura',true);
insert into public.growth_prospects(id,workspace_id,phone,company,rubro,zona) values
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','5491100000001','Proveedor ficticio A','Pintura','CABA'),
 ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000001','5491100000002','Proveedor ficticio B','Pintura','CABA'),
 ('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000001','5491100000003','Proveedor ficticio C','Pintura','CABA');
