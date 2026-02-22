const CACHE = 'caca-v13';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './logo.png',
  './css/styles.css',
  './js/jokes.js',
  './js/achievements.js',
  './js/predictions.js',
  './js/charts.js',
  './js/sounds.js',
  './js/animations.js',
  './js/supabase-client.js',
  './js/social.js'
];

// ---- Install : pré-cache tous les assets, activation immédiate ----
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ---- Activate : purge les anciens caches, prend le contrôle ----
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

// ---- Message : page demande au SW de s'activer tout de suite ----
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// ---- Fetch ----
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne pas intercepter les requêtes cross-origin (CDN, Supabase, etc.)
  if (url.origin !== self.location.origin) return;

  // NETWORK-FIRST pour les navigations HTML
  // → le téléphone reçoit toujours la dernière version de index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // CACHE-FIRST pour les autres ressources same-origin (JS, CSS, images…)
  e.respondWith(
    caches.match(e.request).then(r => {
      if (r) return r;
      return fetch(e.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});
