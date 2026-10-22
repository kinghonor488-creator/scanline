// Offline support: every app file is cached on install and kept up to date while online.
// Bump VERSION (and BUILD in js/version.js) on every deploy.
const VERSION = 'scanline-v11';
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
  'js/version.js',
  'assets/characters/custom.json',
  'assets/characters/yuexian.webp',
  'assets/characters/qingdai.webp',
  'assets/characters/shuanglan.webp',
  'assets/characters/zidie.webp',
  'assets/characters/sakumi.webp',
  'assets/characters/feiwu.webp',
  'assets/characters/moyu.webp',
  'assets/characters/fenghua.webp',
  'assets/fonts/mplus-rounded-1c-500.woff2',
  'assets/fonts/mplus-rounded-1c-700.woff2',
  'assets/fonts/mplus-rounded-1c-800.woff2',
  'assets/fonts/mplus-rounded-1c-900.woff2',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
];

// Fetch past the browser's HTTP cache (GitHub Pages lets it keep files for 10 minutes), otherwise an
// update installed right after a deploy could store the previous files.
const fresh = (url) => fetch(new Request(url, { cache: 'no-cache' }));

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(ASSETS.map((url) => fresh(url).then((res) => res.ok && c.put(url, res)))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Online: always the newest files (a cheap revalidation, usually a 304), copied into the cache.
// Offline or very slow network: the cached copy. Character art rarely changes, so it is served from
// the cache first.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate';
  const key = isPage ? 'index.html' : req;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: isPage });
      if (cached && url.pathname.includes('/assets/characters/') && url.pathname.endsWith('.webp')) return cached;
      const network = fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (!cached) return (await network) || new Response('Offline and not cached yet.', { status: 503 });
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3000));
      return (await Promise.race([network, timeout])) || cached;
    }),
  );
});
