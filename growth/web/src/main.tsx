import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WorkspaceProvider } from './lib/workspace';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* En producción el panel vive en trattoapp.com.ar/crm/ (vite --base /crm/) */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </BrowserRouter>
  </StrictMode>,
);
