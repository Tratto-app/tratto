-- Radar de redes: cuentas sugeridas cada día para seguir A MANO desde
-- Instagram y TikTok (gente que comentó reels/videos parecidos con intención
-- de pedir un servicio). Lo llena el workflow de n8n "RADAR - 50 cuentas por
-- red" (tools/n8n/workflows/radar-50-cuentas-por-red.json). Sirve para no
-- repetir sugerencias. Solo datos públicos y mínimos (usuario, el comentario
-- que motivó la sugerencia y el link al post); el workflow borra lo de más de
-- 60 días. Aplicada el 2026-10-07.
create table if not exists public.radar_redes (
  id bigint generated always as identity primary key,
  red text not null check (red in ('instagram','tiktok')),
  usuario text not null,
  comentario text,
  post_url text,
  puntaje int,
  creado_en timestamptz not null default now(),
  unique (red, usuario)
);
alter table public.radar_redes enable row level security;
revoke all on public.radar_redes from anon, authenticated;
create index if not exists radar_redes_creado_en on public.radar_redes (creado_en);
