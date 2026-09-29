-- Reportes de contenido ("Reportar" en perfiles y publicaciones).
--
-- La app ya tenía el botón y el formulario desde la primera versión, pero la
-- tabla donde se guardan nunca se había creado: cada reporte fallaba. Google
-- Play y la App Store exigen que el reporte funcione en apps con contenido de
-- usuarios.
--
-- Cada usuario puede cargar reportes a su nombre y nada más: no puede leer
-- los suyos ni los de otros. Los revisa el equipo desde el panel de Supabase
-- (Table editor → reportes). Cada reporte nuevo manda un mail al equipo
-- (privado.avisar: como mucho uno cada 6 horas; el mail dice cuántos hay sin
-- revisar).

create table if not exists public.reportes (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  reportante  uuid default auth.uid() references auth.users(id) on delete set null,
  tipo        text not null check (tipo in ('perfil', 'publicacion', 'mensaje', 'usuario')),
  referencia  bigint,
  perfil_id   uuid,
  motivo      text not null check (motivo in ('copyright', 'ofensivo', 'falso', 'contacto', 'otro')),
  detalle     text check (char_length(detalle) <= 1000),
  estado      text not null default 'nuevo' check (estado in ('nuevo', 'revisado', 'descartado'))
);
create index if not exists reportes_reportante_creado_idx on public.reportes (reportante, created_at);
create index if not exists reportes_estado_idx on public.reportes (estado) where estado = 'nuevo';

alter table public.reportes enable row level security;
revoke all on public.reportes from anon, authenticated;
grant insert (reportante, tipo, referencia, perfil_id, motivo, detalle) on public.reportes to authenticated;

drop policy if exists "reportes: cada uno carga los suyos" on public.reportes;
create policy "reportes: cada uno carga los suyos" on public.reportes
  for insert to authenticated
  with check (reportante = (select auth.uid()));

-- Tope anti-abuso, igual que en el resto de las tablas.
drop trigger if exists limite_reportes on public.reportes;
create trigger limite_reportes before insert on public.reportes
  for each row execute function privado.limitar_por_usuario('10', '1 day', 'reportante',
    'Ya mandaste 10 reportes hoy. Si hay algo urgente, escribinos a trattoapp1@gmail.com.');

-- Aviso al equipo.
create or replace function privado.avisar_reporte()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pendientes int;
begin
  select count(*) into pendientes from public.reportes where estado = 'nuevo';
  perform privado.avisar('reporte', 'Hay ' || pendientes || ' reporte(s) de contenido sin revisar',
    'Llegó un reporte nuevo (motivo: ' || new.motivo || ', sobre: ' || new.tipo || '). '
    || 'Hay ' || pendientes || ' sin revisar. Revisalos en Supabase → Table editor → reportes; '
    || 'cuando lo resuelvas, cambiá el estado a "revisado" o "descartado".');
  return new;
exception when others then
  return new;   -- un problema con el mail nunca puede impedir que el reporte se guarde
end $$;
revoke all on function privado.avisar_reporte() from public, anon, authenticated;

drop trigger if exists avisar_reporte on public.reportes;
create trigger avisar_reporte after insert on public.reportes
  for each row execute function privado.avisar_reporte();
