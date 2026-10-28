-- "Si nadie te responde, te lo buscamos" (idea del 28/10/2026, tomada de
-- Clickie). Por dentro ya lo hacíamos: cuando entra un pedido de un rubro o una
-- zona sin nadie, "Trabajo listo" (growth_trabajo_listo) les escribe a los
-- contactos del CRM de ese oficio. Ahora el cliente lo ve y, si pasó un rato y
-- nadie le respondió, lo puede pedir con un botón: el equipo recibe un aviso en
-- la cola del CRM y un mail, con cuánta gente de ese oficio hay a mano.

create table public.pedido_ayuda (
 solicitud_id bigint primary key references public.solicitudes(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index pedido_ayuda_usuario on public.pedido_ayuda(user_id,created_at);
alter table public.pedido_ayuda enable row level security;
revoke all on public.pedido_ayuda from public,anon,authenticated;
grant all on public.pedido_ayuda to service_role;

-- Lo que ve el cliente: si ya lo pidió y si la búsqueda automática está andando.
create or replace function public.pedido_ayuda_estado(p_solicitud_id bigint)
returns table(pedida_at timestamptz, automatica boolean)
language plpgsql stable security definer set search_path='' as $$
declare s public.solicitudes;
begin
 select * into s from public.solicitudes x where x.id=p_solicitud_id;
 if s.id is null or s.user_id is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo.' using errcode='42501';end if;
 return query select
  (select a.created_at from public.pedido_ayuda a where a.solicitud_id=s.id),
  exists(select 1 from public.growth_trabajo_listo t where t.solicitud_id=s.id and t.estado='buscando');
end $$;

create or replace function public.pedido_te_lo_buscamos(p_solicitud_id bigint)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare s public.solicitudes; r public.pedido_ayuda; v_app int; v_mail int; v_tel int;
begin
 select * into s from public.solicitudes x where x.id=p_solicitud_id;
 if s.id is null or s.user_id is distinct from auth.uid() then raise exception 'Ese pedido no es tuyo.' using errcode='42501';end if;
 select * into r from public.pedido_ayuda a where a.solicitud_id=s.id;
 if r.solicitud_id is not null then return r.created_at;end if;
 if s.estado='vencida' then raise exception 'Ese pedido ya venció. Publicalo de nuevo y te lo buscamos.';end if;
 if s.created_at>now()-interval '30 minutes' then
  raise exception 'Recién lo publicaste: dale media hora. Si nadie te responde, te lo buscamos.';end if;
 if exists(select 1 from public.mensajes m join public.matches x on x.id=m.match_id
           where x.solicitud_id=s.id and m.tipo='presupuesto' and m.estado_presupuesto='aceptado') then
  raise exception 'Ya cerraste un trato por este pedido.';end if;
 perform pg_advisory_xact_lock(hashtextextended('ayuda:'||auth.uid()::text,0));
 if (select count(*) from public.pedido_ayuda a where a.user_id=auth.uid() and a.created_at>now()-interval '1 day')>=3 then
  raise exception 'Hoy ya nos pediste varios. Te avisamos apenas tengamos novedades.';end if;
 insert into public.pedido_ayuda(solicitud_id,user_id) values(s.id,auth.uid()) returning * into r;
 if coalesce(s.demo,false) then return r.created_at;end if;

 -- Con qué cuenta el equipo para buscar: gente en la app de ese oficio o de uno
 -- afín, y contactos del CRM de ese oficio que todavía no están en la app.
 select count(distinct p.user_id) into v_app from public.proveedores p
  where not coalesce(p.demo,false) and p.user_id is not null
    and (p.rubro=s.servicio_necesitado
         or exists(select 1 from public.rubros_afines a where a.rubro=s.servicio_necesitado and a.afin=p.rubro));
 select count(*) filter(where coalesce(p.email,'') like '%@%'), count(*) filter(where coalesce(p.phone,'')<>'')
   into v_mail,v_tel
  from public.growth_prospects p
  where p.kind='provider' and p.rubro=s.servicio_necesitado and not coalesce(p.do_not_contact,false)
    and p.app_user_id is null;

 insert into public.growth_mkt_items(workspace_id,departamento,tipo,estado,prioridad,creado_por,titulo,resumen,datos)
 values(public.crm_ws(),'operaciones','alerta','para_aprobar',1,'automation',
  'Te lo buscamos: '||s.servicio_necesitado||coalesce(' en '||s.zona,''),
  'El cliente del pedido #'||s.id||' ('||coalesce(s.urgencia,'sin apuro')||') tocó "Buscámelo": nadie le respondió. '
  ||'En la app hay '||v_app||' de ese oficio o uno afín; en el CRM, '||v_mail||' con mail y '||v_tel||' con teléfono. '
  ||'Avisale por mail cuando tengas a alguien.',
  jsonb_build_object('clave','te_lo_buscamos','solicitud_id',s.id));
 perform privado.avisar('te_lo_buscamos_'||s.id::text,'Te lo buscamos: '||s.servicio_necesitado||coalesce(' en '||s.zona,''),
  'Un cliente pidió que le busquemos a alguien para su pedido #'||s.id||' ('||s.servicio_necesitado
  ||coalesce(', '||s.zona,'')||', '||coalesce(s.urgencia,'sin apuro')||'). Está en la cola del equipo en el CRM, '
  ||'con cuánta gente de ese oficio hay a mano.');
 return r.created_at;
end $$;

revoke all on function public.pedido_ayuda_estado(bigint),public.pedido_te_lo_buscamos(bigint) from public,anon;
grant execute on function public.pedido_ayuda_estado(bigint),public.pedido_te_lo_buscamos(bigint) to authenticated;
