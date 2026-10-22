// Offline support: every app file is cached on install, then served cache-first while a fresh copy
// is fetched in the background (so updates show up on the next launch). Bump VERSION to force a refresh.
const VERSION = 'scanline-v3';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'css/fonts.css',
  'js/main.js',
  'js/audio.js',
  'js/analyzer.js',
  'js/chart.js',
  'js/game.js',
  'js/fx.js',
  'js/storage.js',
  'js/calibrate.js',
  'js/characters.js',
  'js/scenes.js',
  'js/player.js',
  'js/intro.js',
  'js/soundpanel.js',
  'assets/characters/custom.json',
  'assets/fonts/mplus-rounded-1c-500.woff2',
  'assets/fonts/mplus-rounded-1c-700.woff2',
  'assets/fonts/mplus-rounded-1c-800.woff2',
  'assets/fonts/mplus-rounded-1c-900.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate';
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(isPage ? 'index.html' : req, { ignoreSearch: isPage });
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(isPage ? 'index.html' : req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        e.waitUntil(fresh);
        return cached;
      }
      return (await fresh) || new Response('Offline and not cached yet.', { status: 503 });
    }),
  );
});
