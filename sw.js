const CACHE = 'caca-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
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

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne pas intercepter les requêtes cross-origin (CDN, Supabase API, etc.)
  // Sinon un fichier HTML serait renvoyé à la place des scripts CDN → crash
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(r => {
      if (r) return r;
      return fetch(e.request).then(response => {
        // Mettre en cache les nouvelles ressources same-origin
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback : renvoyer index.html uniquement pour les navigations HTML
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
