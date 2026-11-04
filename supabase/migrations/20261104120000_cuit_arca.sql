-- CUIL o CUIT confirmado con ARCA (fundador, 04/11/2026: "que solamente te
-- deje avanzar si coincide el CUIL con el nombre, o el CUIT y el nombre de la
-- empresa"). Reemplaza a la foto del DNI: el padrón de ARCA (ws_sr_padron_a13)
-- es gratis y dice si ese nombre y ese número van juntos.
--
-- Qué guarda:
--   · privado.arca: el certificado de Tratto, el pedido del certificado y el
--     ticket de acceso (12 horas). La clave privada está en Vault.
--   · privado.cuit_consultas: cada consulta, para el límite de intentos y para
--     no preguntarle a ARCA dos veces lo mismo. Del nombre escrito se guarda
--     solo una huella (hash); de ARCA no se guarda nada.
--   · privado.cuit_estado: cómo quedó cada cuenta que ofrece servicios.
--   · public.distintivos tipo 'cuit': el sello público "CUIL verificado".
-- La función validar-cuit (Edge Function) hace las consultas; estas RPC solo
-- le responden al servidor, salvo cuit_mi_estado (la de cada cuenta).

-- ── Sello público ───────────────────────────────────────────────────────────
alter table public.distintivos drop constraint distintivos_tipo_check;
alter table public.distintivos add constraint distintivos_tipo_check check(tipo in('identidad','cuit'));

-- ── Certificado y ticket ────────────────────────────────────────────────────
create table privado.arca (
 id smallint primary key default 1 check(id=1),
 cuit text check(cuit ~ '^[0-9]{11}$'),
 pedido_pem text,
 certificado_pem text,
 clave_secreto uuid,
 token text,
 sign text,
 ticket_vence timestamptz,
 updated_at timestamptz not null default now()
);
alter table privado.arca enable row level security;
revoke all on privado.arca from public,anon,authenticated;

-- ── Consultas y estado de cada cuenta ───────────────────────────────────────
create table privado.cuit_consultas (
 id bigserial primary key,
 created_at timestamptz not null default now(),
 cuit text not null check(cuit ~ '^[0-9]{11}$'),
 tipo text not null check(tipo in('persona','empresa')),
 nombre_hash text not null check(nombre_hash ~ '^[0-9a-f]{64}$'),
 resultado text not null check(resultado in('coincide','no_coincide','inactiva','no_existe','tipo_distinto','pendiente')),
 origen text not null,
 user_id uuid references auth.users(id) on delete set null,
 detalle text
);
create index cuit_consultas_cuit on privado.cuit_consultas(cuit,created_at desc);
create index cuit_consultas_origen on privado.cuit_consultas(origen,created_at desc);
alter table privado.cuit_consultas enable row level security;
revoke all on privado.cuit_consultas from public,anon,authenticated;

create table privado.cuit_estado (
 user_id uuid primary key references auth.users(id) on delete cascade,
 resultado text not null check(resultado in('coincide','no_coincide','inactiva','no_existe','tipo_distinto','pendiente','sin_cuit')),
 cuit text,
 tipo text,
 intentos integer not null default 0,
 proximo timestamptz,
 updated_at timestamptz not null default now()
);
alter table privado.cuit_estado enable row level security;
revoke all on privado.cuit_estado from public,anon,authenticated;

-- ── RPC del servidor ────────────────────────────────────────────────────────
create function public.arca_credencial()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a privado.arca; clave text;
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 select * into a from privado.arca where id=1;
 if a.clave_secreto is not null then
  select decrypted_secret into clave from vault.decrypted_secrets where id=a.clave_secreto;
 end if;
 return jsonb_build_object('cuit',a.cuit,'certificado',a.certificado_pem,'clave',clave,
  'token',a.token,'sign',a.sign,'vence',a.ticket_vence);
end $$;

create function public.arca_guardar_ticket(p_token text,p_sign text,p_vence timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 update privado.arca set token=p_token,sign=p_sign,ticket_vence=p_vence,updated_at=now() where id=1;
end $$;

-- Clave nueva: el certificado anterior (si había) deja de servir.
create function public.arca_guardar_pedido(p_cuit text,p_clave text,p_pedido text)
returns void language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 if p_cuit !~ '^[0-9]{11}$' or p_clave !~ ('^-----BEGIN '||'PRIVATE KEY-----') or p_pedido !~ '^-----BEGIN CERTIFICATE REQUEST-----' then
  raise exception 'Datos del certificado inválidos.';end if;
 select id into sid from vault.secrets where name='arca_clave_privada';
 if sid is null then
  sid := vault.create_secret(p_clave,'arca_clave_privada','Clave del certificado de ARCA (padrón A13). La genera la función validar-cuit.');
 else
  perform vault.update_secret(sid,p_clave);
 end if;
 insert into privado.arca(id,cuit,pedido_pem,certificado_pem,clave_secreto,token,sign,ticket_vence,updated_at)
 values(1,p_cuit,p_pedido,null,sid,null,null,null,now())
 on conflict(id) do update set cuit=excluded.cuit,pedido_pem=excluded.pedido_pem,certificado_pem=null,
  clave_secreto=excluded.clave_secreto,token=null,sign=null,ticket_vence=null,updated_at=now();
end $$;

-- Antes de preguntarle a ARCA: ¿está configurado?, ¿ya lo preguntamos hace
-- poco? y ¿se pasó del límite? Límites: 12 consultas por hora por conexión
-- (o cuenta) y 5 nombres distintos por hora para un mismo número, así nadie
-- puede probar nombres hasta adivinar de quién es un CUIL.
create function public.cuit_antes_de_consultar(p_cuit text,p_tipo text,p_nombre_hash text,p_origen text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare conf boolean; cache text; por_origen integer; nombres integer;
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 select (a.certificado_pem is not null and a.clave_secreto is not null and a.cuit is not null) into conf from privado.arca a where a.id=1;
 if not coalesce(conf,false) then return jsonb_build_object('configurada',false);end if;
 select c.resultado into cache from privado.cuit_consultas c
  where c.cuit=p_cuit and c.tipo=p_tipo and c.nombre_hash=p_nombre_hash and c.resultado<>'pendiente'
    and c.created_at>now()-interval '24 hours' order by c.created_at desc limit 1;
 if cache is not null then return jsonb_build_object('configurada',true,'cache',cache);end if;
 if p_origen='revision' then return jsonb_build_object('configurada',true,'limite',false);end if;
 select count(*) into por_origen from privado.cuit_consultas c where c.origen=p_origen and c.created_at>now()-interval '1 hour';
 select count(distinct c.nombre_hash) into nombres from privado.cuit_consultas c
  where c.cuit=p_cuit and c.created_at>now()-interval '1 hour' and c.nombre_hash<>p_nombre_hash;
 return jsonb_build_object('configurada',true,'limite',por_origen>=12 or nombres>=5);
end $$;

create function public.cuit_anotar_consulta(p_cuit text,p_tipo text,p_nombre_hash text,p_resultado text,p_origen text,p_user uuid,p_detalle text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 insert into privado.cuit_consultas(cuit,tipo,nombre_hash,resultado,origen,user_id,detalle)
 values(p_cuit,p_tipo,p_nombre_hash,p_resultado,left(p_origen,80),p_user,left(p_detalle,300));
end $$;

create function public.cuit_marcar_verificado(p_user uuid,p_cuit text,p_tipo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 insert into privado.cuit_estado(user_id,resultado,cuit,tipo,intentos,proximo,updated_at)
 values(p_user,'coincide',p_cuit,p_tipo,0,null,now())
 on conflict(user_id) do update set resultado='coincide',cuit=excluded.cuit,tipo=excluded.tipo,
  intentos=0,proximo=null,updated_at=now();
 insert into public.distintivos(user_id,tipo,desde) values(p_user,'cuit',current_date)
 on conflict(user_id,tipo) do nothing;
end $$;

-- Pendiente (ARCA no respondió): se reintenta con espera creciente, hasta un
-- día. El resto queda así hasta que la persona lo corrija desde la app. Una
-- cuenta ya verificada no pierde el sello por un intento posterior.
create function public.cuit_marcar_estado(p_user uuid,p_resultado text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 insert into privado.cuit_estado(user_id,resultado,intentos,proximo,updated_at)
 values(p_user,p_resultado,1,case when p_resultado='pendiente' then now()+interval '1 hour' end,now())
 on conflict(user_id) do update set resultado=excluded.resultado,
  intentos=case when excluded.resultado='pendiente' then privado.cuit_estado.intentos+1 else 0 end,
  proximo=case when excluded.resultado='pendiente'
   then now()+least(interval '24 hours',interval '1 hour'*power(2,least(privado.cuit_estado.intentos,5))) end,
  updated_at=now()
 where privado.cuit_estado.resultado<>'coincide';
end $$;

-- Quienes ofrecen servicios y todavía hay que chequear: sin estado, o
-- pendientes cuyo turno llegó. Las cuentas de muestra no cuentan.
create function public.cuit_pendientes_lote(p_limite integer default 20)
returns table(user_id uuid,cuit text,tipo text,nombre text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not privado.es_servidor() then raise exception 'Solo el servidor.' using errcode='42501';end if;
 return query
 select u.id,regexp_replace(coalesce(u.raw_user_meta_data->>'cuit',''),'\D','','g'),
  nullif(u.raw_user_meta_data->>'cuit_tipo',''),coalesce(u.raw_user_meta_data->>'nombre','')
 from auth.users u
 left join privado.cuit_estado e on e.user_id=u.id
 where u.raw_user_meta_data->>'rol'='proveedor'
   and coalesce((u.raw_app_meta_data->>'demo')::boolean,false)=false
   and (e.user_id is null or (e.resultado='pendiente' and e.proximo<=now()))
 order by u.created_at desc
 limit greatest(1,least(coalesce(p_limite,20),50));
end $$;

revoke all on function public.arca_credencial() from public,anon,authenticated;
revoke all on function public.arca_guardar_ticket(text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.arca_guardar_pedido(text,text,text) from public,anon,authenticated;
revoke all on function public.cuit_antes_de_consultar(text,text,text,text) from public,anon,authenticated;
revoke all on function public.cuit_anotar_consulta(text,text,text,text,text,uuid,text) from public,anon,authenticated;
revoke all on function public.cuit_marcar_verificado(uuid,text,text) from public,anon,authenticated;
revoke all on function public.cuit_marcar_estado(uuid,text) from public,anon,authenticated;
revoke all on function public.cuit_pendientes_lote(integer) from public,anon,authenticated;
grant execute on function public.arca_credencial() to service_role;
grant execute on function public.arca_guardar_ticket(text,text,timestamptz) to service_role;
grant execute on function public.arca_guardar_pedido(text,text,text) to service_role;
grant execute on function public.cuit_antes_de_consultar(text,text,text,text) to service_role;
grant execute on function public.cuit_anotar_consulta(text,text,text,text,text,uuid,text) to service_role;
grant execute on function public.cuit_marcar_verificado(uuid,text,text) to service_role;
grant execute on function public.cuit_marcar_estado(uuid,text) to service_role;
grant execute on function public.cuit_pendientes_lote(integer) to service_role;

-- ── La de cada cuenta: para el aviso "Confirmá tu CUIL" del panel ──────────
-- Solo si ARCA está configurado: sin eso no hay nada que pedirle a nadie.
create function public.cuit_mi_estado()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare conf boolean; e privado.cuit_estado;
begin
 if auth.uid() is null then raise exception 'Iniciá sesión.' using errcode='42501';end if;
 select (a.certificado_pem is not null and a.clave_secreto is not null) into conf from privado.arca a where a.id=1;
 select * into e from privado.cuit_estado where user_id=auth.uid();
 return jsonb_build_object('activa',coalesce(conf,false),'resultado',e.resultado);
end $$;
revoke all on function public.cuit_mi_estado() from public,anon;
grant execute on function public.cuit_mi_estado() to authenticated;

-- ── Llamadas de la base a la función (con la firma del servidor) ───────────
-- La firma no se imprime ni queda en el SQL del cron: se lee de Vault al
-- ejecutar, igual que limpieza de evidencias.
create function privado.validar_cuit_llamar(p_cuerpo jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare destino text; firma text; solicitud bigint;
begin
 select valor into destino from privado.config where clave='url_funciones';
 if destino is null or destino !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/?$' then
  raise exception 'Falta la URL de las funciones.';end if;
 select decrypted_secret into firma from vault.decrypted_secrets where name='push_firma_quick_service';
 if nullif(firma,'') is null then raise exception 'Falta la firma del servidor.';end if;
 select net.http_post(
  url:=rtrim(destino,'/')||'/validar-cuit',
  headers:=jsonb_build_object('Content-Type','application/json','x-tratto-firma',firma),
  body:=p_cuerpo,timeout_milliseconds:=60000
 ) into solicitud;
 return solicitud;
end $$;
revoke all on function privado.validar_cuit_llamar(jsonb) from public,anon,authenticated,service_role;

-- Cada hora: cuentas nuevas que no pasaron por "confirmar", las viejas y las
-- que quedaron pendientes. Sin certificado cargado la función no hace nada.
select cron.schedule('validar-cuit-revisar','23 * * * *',
 $$select privado.validar_cuit_llamar('{"accion":"revisar","limite":20}'::jsonb)$$);
