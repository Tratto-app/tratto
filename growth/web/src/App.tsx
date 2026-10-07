import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { configOk } from './lib/supabase';
import { useWs } from './lib/workspace';
import Login from './pages/Login';
import NuevoWorkspace from './pages/NuevoWorkspace';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Equipo = lazy(() => import('./pages/Equipo'));
const Prospects = lazy(() => import('./pages/Prospects'));
const ProspectDetail = lazy(() => import('./pages/ProspectDetail'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Sources = lazy(() => import('./pages/Sources'));
const Links = lazy(() => import('./pages/Links'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Automations = lazy(() => import('./pages/Automations'));
const Agent = lazy(() => import('./pages/Agent'));
const AppUsers = lazy(() => import('./pages/AppUsers'));
const AppUserDetail = lazy(() => import('./pages/AppUserDetail'));
const Segments = lazy(() => import('./pages/Segments'));
const Retention = lazy(() => import('./pages/Retention'));
const AnalyticsOverview = lazy(() => import('./pages/AnalyticsOverview'));
const AnalyticsFunnel = lazy(() => import('./pages/AnalyticsFunnel'));
const AnalyticsCampaigns = lazy(() => import('./pages/AnalyticsCampaigns'));
const AnalyticsCohorts = lazy(() => import('./pages/AnalyticsCohorts'));
const AppOverview = lazy(() => import('./pages/AppOverview'));
const StoreLinks = lazy(() => import('./pages/StoreLinks'));
const Knowledge = lazy(() => import('./pages/Knowledge'));
const SettingsAI = lazy(() => import('./pages/SettingsAI'));
const SettingsIntegrations = lazy(() => import('./pages/SettingsIntegrations'));
const SettingsWorkspace = lazy(() => import('./pages/SettingsWorkspace'));

export default function App() {
  const { session, ready, workspaces } = useWs();
  if (!configOk) {
    return (
      <div className="login"><div className="card">
        <h2>Falta configurar el panel</h2>
        <p className="texto-2">Copiá <code>growth/web/.env.example</code> a <code>.env</code> y completá <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (la clave pública del proyecto).</p>
      </div></div>
    );
  }
  if (!session) return <Login />;
  if (!ready) return <Loading />;
  if (!workspaces.length) return <NuevoWorkspace />;
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="equipo" element={<Equipo />} />
          <Route path="prospects" element={<Prospects />} />
          <Route path="prospects/:id" element={<ProspectDetail />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="sources" element={<Sources />} />
          <Route path="links" element={<Links />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="automations" element={<Automations />} />
          <Route path="agent" element={<Agent />} />
          <Route path="users" element={<AppUsers />} />
          <Route path="users/:id" element={<AppUserDetail />} />
          <Route path="segments" element={<Segments />} />
          <Route path="retention" element={<Retention />} />
          <Route path="analytics" element={<AnalyticsOverview />} />
          <Route path="analytics/funnel" element={<AnalyticsFunnel />} />
          <Route path="analytics/campaigns" element={<AnalyticsCampaigns />} />
          <Route path="analytics/cohorts" element={<AnalyticsCohorts />} />
          <Route path="app" element={<AppOverview />} />
          <Route path="app/stores" element={<StoreLinks />} />
          <Route path="app/knowledge" element={<Knowledge />} />
          <Route path="settings/ai" element={<SettingsAI />} />
          <Route path="settings/integrations" element={<SettingsIntegrations />} />
          <Route path="settings/workspace" element={<SettingsWorkspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
