-- Negociar el precio (idea del 28/10/2026, tomada de Clickie). Sobre un
-- presupuesto pendiente, el cliente propone otro monto (hasta dos veces por
-- presupuesto). Quien lo mandó lo acepta o mantiene su precio:
--   - si lo acepta, el presupuesto pasa a ese monto y queda aceptado (el trato
--     se cierra al precio que propuso el cliente);
--   - si no, el presupuesto sigue pendiente con su precio original.
-- Cada paso deja un mensaje en el chat, así llega el aviso de siempre.

create table public.contraofertas (
 id bigint generated always as identity primary key,
 presupuesto_id bigint not null references public.mensajes(id) on delete cascade,
 match_id bigint not null references public.matches(id) on delete cascade,
 monto numeric not null check(monto>0),
 monto_original numeric not null check(monto_original>0),
 nota text check(nota is null or length(nota)<=300),
 estado text not null default 'propuesta' check(estado in('propuesta','aceptada','rechazada')),
 created_at timestamptz not null default now(),
 respondida_at timestamptz
);
create index contraofertas_match on public.contraofertas(match_id,id);
create unique index contraofertas_una_abierta on public.contraofertas(presupuesto_id) where estado='propuesta';
alter table public.contraofertas enable row level security;
revoke all on public.contraofertas from public,anon,authenticated;
grant select on public.contraofertas to authenticated;
grant all on public.contraofertas to service_role;
create policy contraofertas_partes on public.contraofertas for select to authenticated using(
 exists(select 1 from public.matches m
        left join public.solicitudes s on s.id=m.solicitud_id
        left join public.proveedores p on p.id=m.proveedor_id
        where m.id=contraofertas.match_id and (s.user_id=auth.uid() or p.user_id=auth.uid())));

-- $ 45.000
create or replace function privado.pesos(n numeric)
returns text language sql immutable set search_path='' as $$
 select '$'||replace(to_char(round(n),'FM999,999,999,999'),',','.');
$$;

create or replace function public.contraoferta_proponer(p_presupuesto_id bigint,p_monto numeric,p_nota text default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare x public.mensajes; v_cliente uuid; v_monto numeric:=round(coalesce(p_monto,0)); v_nota text:=nullif(trim(coalesce(p_nota,'')),''); v_id bigint;
begin
 select * into x from public.mensajes m where m.id=p_presupuesto_id;
 select s.user_id into v_cliente from public.matches m join public.solicitudes s on s.id=m.solicitud_id where m.id=x.match_id;
 if x.id is null or x.tipo<>'presupuesto' or v_cliente is distinct from auth.uid() then
  raise exception 'Ese presupuesto no es para vos.' using errcode='42501';end if;
 if x.estado_presupuesto<>'pendiente' then raise exception 'Ese presupuesto ya fue respondido.';end if;
 if v_monto<=0 or v_monto>=x.monto then raise exception 'Proponé un monto menor al del presupuesto.';end if;
 if v_monto<x.monto*0.1 then raise exception 'Ese monto es demasiado bajo para este trabajo.';end if;
 if v_nota ~ '[<>]' or length(coalesce(v_nota,''))>300 then raise exception 'Revisá el comentario (sin código HTML, hasta 300 letras).';end if;
 perform pg_advisory_xact_lock(hashtextextended('contraoferta:'||x.id::text,0));
 if exists(select 1 from public.contraofertas c where c.presupuesto_id=x.id and c.estado='propuesta') then
  raise exception 'Ya le propusiste otro precio. Esperá que te responda.';end if;
 if (select count(*) from public.contraofertas c where c.presupuesto_id=x.id)>=2 then
  raise exception 'Ya propusiste otro precio dos veces. Aceptá o rechazá el presupuesto, o seguí la charla por el chat.';end if;
 insert into public.contraofertas(presupuesto_id,match_id,monto,monto_original,nota)
 values(x.id,x.match_id,v_monto,x.monto,v_nota) returning id into v_id;
 insert into public.mensajes(match_id,remitente_tipo,tipo,contenido,leido)
 values(x.match_id,'cliente','texto','Te propongo '||privado.pesos(v_monto)||' en vez de '||privado.pesos(x.monto)||'.'
  ||coalesce(' '||v_nota,''),false);
 return v_id;
end $$;

create or replace function public.contraoferta_responder(p_id bigint,p_acepta boolean)
returns text language plpgsql security definer set search_path='' as $$
declare c public.contraofertas; x public.mensajes; v_prov uuid;
begin
 select * into c from public.contraofertas k where k.id=p_id;
 select p.user_id into v_prov from public.matches m join public.proveedores p on p.id=m.proveedor_id where m.id=c.match_id;
 if c.id is null or v_prov is distinct from auth.uid() then raise exception 'Esa propuesta no es para vos.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('contraoferta:'||c.presupuesto_id::text,0));
 select * into c from public.contraofertas k where k.id=p_id;
 if c.estado<>'propuesta' then raise exception 'Esa propuesta ya fue respondida.';end if;
 select * into x from public.mensajes m where m.id=c.presupuesto_id;
 if x.estado_presupuesto<>'pendiente' then raise exception 'Ese presupuesto ya fue respondido.';end if;
 update public.contraofertas set estado=case when p_acepta then 'aceptada' else 'rechazada' end,respondida_at=now() where id=c.id;
 if p_acepta then
  update public.mensajes set monto=c.monto,contenido='Presupuesto: '||privado.pesos(c.monto),estado_presupuesto='aceptado'
  where id=x.id;
  insert into public.mensajes(match_id,remitente_tipo,tipo,contenido,leido)
  values(c.match_id,'proveedor','texto','Acepto tu propuesta de '||privado.pesos(c.monto)||'. Trato cerrado.',false);
  return 'aceptada';
 end if;
 insert into public.mensajes(match_id,remitente_tipo,tipo,contenido,leido)
 values(c.match_id,'proveedor','texto','Prefiero mantener mi precio de '||privado.pesos(x.monto)||'.',false);
 return 'rechazada';
end $$;

revoke all on function privado.pesos(numeric) from public,anon,authenticated;
revoke all on function public.contraoferta_proponer(bigint,numeric,text),public.contraoferta_responder(bigint,boolean) from public,anon;
grant execute on function public.contraoferta_proponer(bigint,numeric,text),public.contraoferta_responder(bigint,boolean) to authenticated;
