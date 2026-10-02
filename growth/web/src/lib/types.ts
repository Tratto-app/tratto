export interface Workspace { id: string; name: string; slug: string; is_demo: boolean; created_at: string }
export interface AppSettings {
  workspace_id: string; app_name: string; description: string | null; logo_url: string | null;
  play_store_url: string | null; app_store_url: string | null; website: string | null; category: string | null;
  audience: string | null; value_prop: string | null; features: string | null; benefits: string | null;
  price: string | null; monetization: string | null; deep_link_base: string | null;
  activation_event: string; active_window_days: number;
}
export interface Prospect {
  id: string; workspace_id: string; ref: string; first_name: string | null; last_name: string | null; company: string | null;
  instagram: string | null; facebook: string | null; tiktok: string | null; email: string | null; phone: string | null;
  city: string | null; country: string | null; source_id: string | null; campaign_id: string | null; segment_label: string | null;
  status: string; score: number; score_manual: boolean; ai_score: number | null; ai_summary: string | null; next_action: string | null;
  interest: string; tags: string[]; consent: string; consent_source: string | null; do_not_contact: boolean;
  contact_count: number; last_contact_at: string | null; next_contact_at: string | null; last_reply_at: string | null; last_reply_text: string | null;
  contacted_at: string | null; replied_at: string | null; interested_at: string | null; link_sent_at: string | null; clicked_at: string | null;
  installed_at: string | null; registered_at: string | null; activated_at: string | null; app_user_id: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export interface Source { id: string; key: string; name: string; kind: string }
export interface Campaign {
  id: string; name: string; description: string | null; segment_id: string | null; workflow_id: string | null;
  goal_metric: string; goal_target: number | null; status: string; budget: number | null; start_date: string | null; end_date: string | null; created_at: string;
}
export interface TrackingLink {
  id: string; slug: string; name: string; campaign_id: string | null; source_id: string | null; destination: string;
  custom_url: string | null; utm_medium: string | null; utm_content: string | null; archived: boolean; created_at: string;
}
export interface Conversation { id: string; prospect_id: string; channel: string; status: string; unread: number; ai_summary: string | null; last_message_at: string | null }
export interface Message {
  id: string; conversation_id: string; prospect_id: string; direction: 'in' | 'out'; channel: string; body: string; status: string;
  provider: string | null; error: string | null; ai_generated: boolean; template_key: string | null; intent: string | null; created_at: string;
}
export interface Workflow { id: string; name: string; description: string | null; trigger: string; trigger_filter: Record<string, unknown>; active: boolean; created_at: string }
export interface Step { id?: string; position: number; type: string; config: Record<string, unknown>; on_true: number | null; on_false: number | null }
export interface AppUser {
  id: string; external_user_id: string | null; prospect_id: string | null; name: string | null; email: string | null; platform: string | null;
  source_id: string | null; campaign_id: string | null; link_id: string | null; installed_at: string | null; first_open_at: string | null;
  registered_at: string | null; onboarded_at: string | null; first_action_at: string | null; activated_at: string | null; last_seen_at: string | null;
  sessions_count: number; revenue: number; is_paying: boolean; created_at: string;
}
export interface Segment { id: string; name: string; description: string | null; entity: 'prospect' | 'app_user'; rules: Record<string, unknown>; is_system: boolean }
export interface Notification { id: string; type: string; title: string; body: string | null; prospect_id: string | null; app_user_id: string | null; campaign_id: string | null; read: boolean; created_at: string }
export interface TimelineItem { id: number; type: string; title: string; detail: Record<string, unknown>; actor: string; created_at: string }
export interface KpiSet {
  prospects: number; contacted: number; replies: number; replied: number; interested: number; links_sent: number;
  clicks_play: number; clicks_appstore: number; clicks_web: number; installs: number; registrations: number; activations: number;
  active_users: number; retained: number; paying_users: number; revenue: number; spend: number; cohort_activated: number;
}
export interface Kpis { cur: KpiSet; prev?: KpiSet; active_window_days: number }
export interface FunnelRow { stage: string; label: string; n: number; prev_n: number; last_at: string | null }
export interface Breakdown {
  key: string | null; name: string; prospects: number; contacted: number; replied: number; interested: number; clicks: number;
  installs: number; registrations: number; activations: number; active: number; spend: number; revenue: number;
}
export interface Daily { day: string; prospects: number; contacted: number; replies: number; clicks: number; installs: number; registrations: number; activations: number; active_users: number; revenue: number }
