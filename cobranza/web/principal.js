// Entrada de la app real: las pantallas hablan con el servidor de esta misma
// instalación (el Worker de Cloudflare del negocio).
import { iniciar } from './app.js';

iniciar({
  async pedir(metodo, ruta, cuerpo) {
    let r;
    try {
      r = await fetch(ruta, {
        method: metodo,
        credentials: 'same-origin',
        headers: metodo === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Cobranza': '1' },
        body: metodo === 'GET' ? undefined : JSON.stringify(cuerpo ?? {}),
      });
    } catch { return { estado: 503, datos: { error: 'No hay conexión. Revisá internet y probá de nuevo.' } }; }
    let datos = {};
    try { datos = await r.json(); } catch { datos = {}; }
    return { estado: r.status, datos };
  },
});
