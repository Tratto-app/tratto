-- Entrar con Google o Apple (28/10/2026): la cuenta se crea sin rol, nombre ni
-- teléfono, y la persona los completa después en "Completá tu cuenta"
-- (PUT /auth/v1/user). En ese momento se la vuelve a pasar al CRM con lo que
-- cargó, igual que en un alta con email (crm_registrar_usuario es idempotente:
-- el evento de registro no se duplica).
create or replace function public.crm_desde_completar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  begin
    perform public.crm_registrar_usuario(new);
  exception when others then
    raise warning 'CRM (completar): %', sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists crm_completar on auth.users;
create trigger crm_completar after update of raw_user_meta_data on auth.users
  for each row when ((old.raw_user_meta_data->>'rol') is null and (new.raw_user_meta_data->>'rol') is not null)
  execute function public.crm_desde_completar();

revoke all on function public.crm_desde_completar() from public, anon, authenticated;
