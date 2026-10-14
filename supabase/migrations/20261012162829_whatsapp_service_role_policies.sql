-- Políticas explícitas de operación interna. No conceden acceso a anon ni authenticated.
create policy "Operación interna WhatsApp" on public.growth_wa_config for all to service_role using (true) with check (true);
create policy "Operación interna WhatsApp" on public.growth_wa_contacts for all to service_role using (true) with check (true);
create policy "Operación interna WhatsApp" on public.growth_wa_queue for all to service_role using (true) with check (true);
create policy "Operación interna WhatsApp" on public.growth_wa_events for all to service_role using (true) with check (true);
