import { createClient } from 'npm:@supabase/supabase-js@2.117.0';
import { handleWebhook } from './core.ts';
import { handleInternal } from './internal.ts';

Deno.serve((req: Request) => {
  const route = new URL(req.url).pathname.split('/').pop() || '';
  if (route === 'health' || route === 'dispatch') return handleInternal(req, route,
    () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } }),
    { serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), token: Deno.env.get('WHATSAPP_TOKEN') });
  return handleWebhook(req, {
  appSecret: Deno.env.get('TRATTO_WA_APP_SECRET'),
  verifyToken: Deno.env.get('TRATTO_WA_VERIFY_TOKEN'),
}, {
  async configurations(waba: string, phone?: string) {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    let query = db.from('growth_wa_config').select('workspace_id,waba_id,phone_number_id').eq('waba_id', waba);
    if (phone !== undefined) query = query.eq('phone_number_id', phone);
    const { data, error } = await query;
    if (error) throw new Error('configuration_unavailable');
    return data || [];
  },
  async record(workspace: string, event) {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { error } = await db.rpc('growth_wa_event', { p_workspace: workspace, p_event: event });
    if (error) throw new Error('storage_unavailable');
  },
});
});
