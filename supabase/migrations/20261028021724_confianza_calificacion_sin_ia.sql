-- Una opinión escrita por el cliente no requiere enviar su conversación a IA.
-- El trabajo y las partes se obtienen en el servidor, nunca del cuerpo del cliente.
create or replace function public.servicio_calificar(
  p_match_id bigint, p_puntaje integer, p_comentario text default ''
) returns public.reputacion language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); cliente uuid; proveedor uuid;
  resultado public.reputacion;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and deleted_at is null) then
    raise exception 'Necesitás iniciar sesión.' using errcode='42501';
  end if;
  if p_puntaje is null or p_puntaje not between 1 and 5 or p_comentario is null or char_length(p_comentario)>300 then
    raise exception 'Elegí de 1 a 5 estrellas y un comentario de hasta 300 caracteres.' using errcode='22023';
  end if;
  select s.user_id,v.user_id into cliente,proveedor
  from public.matches m join public.solicitudes s on s.id=m.solicitud_id
    join public.proveedores v on v.id=m.proveedor_id where m.id=p_match_id for update of m;
  if cliente is null or proveedor is null or actor<>cliente or actor=proveedor then
    raise exception 'Solo el cliente del trabajo puede calificar.' using errcode='42501';
  end if;
  select * into resultado from public.reputacion where match_id=p_match_id;
  if found then
    if resultado.cliente_user_id=actor and resultado.puntaje=p_puntaje and coalesce(resultado.comentario,'')=trim(p_comentario) then
      return resultado;
    end if;
    raise exception 'Este trabajo ya tiene una calificación.' using errcode='22023';
  end if;
  if not exists(select 1 from public.mensajes where match_id=p_match_id and tipo='presupuesto'
    and estado_presupuesto='aceptado' and trabajo_estado='terminado') then
    raise exception 'Podés calificar cuando se haya terminado un trabajo acordado.' using errcode='22023';
  end if;
  insert into public.reputacion(match_id,proveedor_user_id,cliente_user_id,puntaje,atributos,resumen,comentario)
    values(p_match_id,proveedor,actor,p_puntaje,'[]'::jsonb,null,trim(p_comentario)) returning * into resultado;
  return resultado;
end;
$$;
revoke all on function public.servicio_calificar(bigint,integer,text) from public,anon;
grant execute on function public.servicio_calificar(bigint,integer,text) to authenticated;
comment on function public.servicio_calificar(bigint,integer,text) is
  'Calificación humana de un trabajo terminado. No consulta chats ni requiere consentimiento de IA.';
