/* Service worker de Tratto. Solo existe para poder recibir notificaciones push
   con la pestaña cerrada: no cachea nada, así que nunca sirve una versión
   vieja de index.html. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let datos = {};
  try{ datos = e.data ? e.data.json() : {}; }catch(err){ datos = {}; }
  const titulo = datos.titulo || 'Tratto';
  const opciones = {
    body: datos.cuerpo || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: datos.url || '/' },
    tag: datos.tag || undefined
  };
  e.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for(const c of clientes){
      if('focus' in c){ await c.focus(); if('navigate' in c) c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
