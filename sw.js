const CACHE_NAME = 'polar-elite-cache-v8-notas-comidas';
const ASSETS_TO_CACHE = ['./', './index.html', './manifest.json', './polar-logo.png', './styles.css?v=7', './app.js?v=7', './supabase.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('polar-elite-cache-') && name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.hostname.endsWith('.supabase.co')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok || response.type === 'opaque') await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const page = await cache.match('./index.html');
        if (page) return page;
      }
      return Response.error();
    }
  })());
});

// 4. NOTIFICACIONES PUSH
self.addEventListener('push', (event) => {
  let data = { title: 'Alerta Polar', body: 'Notificación del sistema Polar', icon: 'polar-logo.png' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: 'polar-logo.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'polar-alert',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length > 0) return windowClients[0].focus();
      return clients.openWindow('/');
    })
  );
});

