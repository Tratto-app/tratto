// Menú lateral del panel (lo usan el Layout y el smoke test).
export type IconKey = 'dash' | 'users' | 'flag' | 'source' | 'link' | 'inbox' | 'flow' | 'ai' | 'app' | 'seg' | 'ret' | 'chart' | 'funnel' | 'cohort' | 'store' | 'book' | 'plug' | 'gear';

export const NAV: { group: string; items: { to: string; label: string; icon: IconKey }[] }[] = [
  { group: '', items: [{ to: '/', label: 'Dashboard', icon: 'dash' }] },
  { group: 'Acquisition', items: [
    { to: '/prospects', label: 'Prospects', icon: 'users' }, { to: '/campaigns', label: 'Campaigns', icon: 'flag' },
    { to: '/sources', label: 'Sources', icon: 'source' }, { to: '/links', label: 'Tracking Links', icon: 'link' }] },
  { group: 'Engagement', items: [
    { to: '/inbox', label: 'Inbox', icon: 'inbox' }, { to: '/automations', label: 'Automations', icon: 'flow' }, { to: '/agent', label: 'AI Agent', icon: 'ai' }] },
  { group: 'Users', items: [
    { to: '/users', label: 'App Users', icon: 'app' }, { to: '/segments', label: 'Segments', icon: 'seg' }, { to: '/retention', label: 'Retention', icon: 'ret' }] },
  { group: 'Analytics', items: [
    { to: '/analytics', label: 'Overview', icon: 'chart' }, { to: '/analytics/funnel', label: 'Funnel', icon: 'funnel' },
    { to: '/analytics/campaigns', label: 'Campaigns', icon: 'flag' }, { to: '/analytics/cohorts', label: 'Cohorts', icon: 'cohort' }] },
  { group: 'App', items: [
    { to: '/app', label: 'App Overview', icon: 'app' }, { to: '/app/stores', label: 'Store Links', icon: 'store' }, { to: '/app/knowledge', label: 'Knowledge Base', icon: 'book' }] },
  { group: 'Settings', items: [
    { to: '/settings/ai', label: 'AI', icon: 'ai' }, { to: '/settings/integrations', label: 'Integrations', icon: 'plug' }, { to: '/settings/workspace', label: 'Workspace', icon: 'gear' }] },
];
