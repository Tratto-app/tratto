import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { handleWebhook } from './core.ts';

Deno.serve((req: Request) => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  return handleWebhook(req, { appSecret: Deno.env.get('TRATTO_WA_APP_SECRET'), verifyToken: Deno.env.get('TRATTO_WA_VERIFY_TOKEN') }, {
    async verifySetupToken(token) {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const digest = [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
      const { data, error } = await db.from('growth_wa_setup_sessions').select('workspace_id')
        .eq('verify_hash', digest).gt('expires_at', new Date().toISOString()).maybeSingle();
      if (error) throw new Error('configuration_unavailable');
      if (!data) return false;
      const board = await db.from('growth_mkt_items').select('estado').eq('workspace_id', data.workspace_id)
        .eq('datos->>clave', 'coordinacion_codex_claude').maybeSingle();
      if (board.error) throw new Error('configuration_unavailable');
      return board.data?.estado === 'programado';
    },
    async configurations(waba, phone) {
      let q = db.from('growth_wa_observer_config').select('workspace_id,waba_id,phone_number_id,business_phone,history_shared').eq('receiving_enabled', true).eq('waba_id', waba);
      if (phone !== undefined) q = q.eq('phone_number_id', phone);
      const { data, error } = await q;
      if (error) throw new Error('configuration_unavailable');
      return data || [];
    },
    async record(workspace, event) {
      const { error } = await db.rpc('growth_wa_observer_ingest', { p_workspace: workspace, p_event: event });
      if (error) throw new Error('storage_unavailable');
    },
  });
});
