const CACHE_NAME = 'polar-elite-cache-v12';
// v12 sustituye a v11 (y a cualquier caché anterior, incluida v8-notas-comidas).
// Al activarse se borran las demás para que la PWA de iOS/Safari cargue esta versión.
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './polar-logo.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './styles.css',
  './styles.css?v=11',
  './app.js',
  './app.js?v=12',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&display=swap'
];

// 1. INSTALACIÓN: si un recurso falla, no se cae toda la instalación
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS_TO_CACHE.map((url) => {
        const destino = new URL(url, self.location).href;
        const req = destino.startsWith(self.location.origin)
          ? new Request(destino, { cache: 'reload' })
          : destino;
        return cache.add(req).catch((e) => console.warn('No se pudo cachear', url, e));
      }))
    )
  );
});

// 2. ACTIVACIÓN: borra cualquier caché que no sea v12 y recarga las ventanas
//    que seguían mostrando una versión anterior.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const viejas = names.filter((n) => n !== CACHE_NAME);
    await Promise.all(viejas.map((n) => caches.delete(n)));
    await self.clients.claim();
    if (!viejas.length) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // navigate() dentro de activate es rechazado por Chrome ("Cannot navigate to URL")
    // hasta que el evento termina. Se dispara justo después, sin esperarlo aquí.
    const recargar = () => {
      for (const client of windows) {
        if (typeof client.navigate !== 'function') continue;
        const destino = new URL('./index.html', client.url).href;
        client.navigate(destino).catch((e) => console.warn('No se pudo recargar', destino, String(e)));
      }
    };
    setTimeout(recargar, 0);
  })());
});

// 3. FETCH
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // nunca interceptar POST (login, etc.)
  const url = new URL(req.url);
  if (url.hostname.includes('supabase.co')) return;       // Supabase siempre directo a la red

  const guardar = (res) => {
    if (res && (res.status === 200 || res.type === 'opaque')) {
      const copia = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, copia)).catch(() => {});
    }
    return res;
  };

  if (url.origin === self.location.origin) {
    // Red primero y sin caché HTTP: GitHub Pages manda max-age=600 y, si no,
    // el teléfono seguiría viendo el app.js truncado.
    const fresco = new Request(req.url, { cache: 'reload', credentials: 'same-origin' });
    event.respondWith(
      fetch(fresco).then(guardar).catch(() =>
        caches.match(req).then((r) => r || caches.match('./index.html'))
      )
    );
  } else {
    // Librerías externas: caché primero
    event.respondWith(caches.match(req).then((r) => r || fetch(req).then(guardar)));
  }
});

// 4. NOTIFICACIONES PUSH
self.addEventListener('push', (event) => {
  let data = { title: 'Alerta Polar', body: 'Notificación del sistema Polar', icon: 'icon-192.png' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: 'icon-192.png',
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
      return clients.openWindow('./');
    })
  );
});
