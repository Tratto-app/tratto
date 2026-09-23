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
  const pedida = (e.notification.data && e.notification.data.url) || '/';
  /* La URL viaja dentro del payload del push. Si algún día se filtra la clave
     VAPID privada, no queremos que un push falso pueda mandar a un usuario a
     un sitio ajeno: solo navegamos dentro del propio origen. */
  let url = '/';
  try{
    const resuelta = new URL(pedida, self.location.origin);
    if(resuelta.origin === self.location.origin) url = resuelta.pathname + resuelta.search + resuelta.hash;
  }catch(err){}
  e.waitUntil((async () => {
    const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for(const c of clientes){
      if('focus' in c){ await c.focus(); if('navigate' in c) c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
