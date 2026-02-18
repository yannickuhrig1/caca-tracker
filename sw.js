const CACHE = 'caca-v2';
const ASSETS = ['./', './index.html', './manifest.json', './js/jokes.js', './js/achievements.js', './js/predictions.js', './js/charts.js', './js/sounds.js', './js/animations.js', './js/supabase-client.js', './js/social.js', './css/styles.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
