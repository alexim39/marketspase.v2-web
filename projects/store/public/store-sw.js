// MarketSpase Store service worker: installable shell + graceful offline reads.
// API traffic is never cached; navigations fall back to the cached store shell.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    try { data = { body: event.data.text() }; } catch (ignored) { /* keep defaults */ }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'MarketSpase Store', {
      body: data.body || '',
      tag: data.tag || 'marketspase-store',
      data: { url: data.url || '/support' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/support';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('navigate' in client) return client.navigate(url).then(() => client.focus());
      }
      return clients.openWindow(url);
    }),
  );
});

const SHELL_CACHE = 'ms-store-shell-v1';
const SHELL_CORE = ['/', '/index.html', '/manifest.webmanifest', '/stores', '/support'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_CORE)).catch(() => null)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/v1/') || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy)).catch(() => null);
        }
        return res;
      }).catch(() => hit);
      return hit || fresh;
    }),
  );
});
