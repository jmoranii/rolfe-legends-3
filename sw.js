// Rolfe Legends 2 — service worker: play offline after the first visit.
// Shell (html/css/js) = network-first with cache fallback, so online players
// always get the newest deploy and offline players get the last one they had.
// Art + music = cache-first, filled lazily as fetched during play (precaching
// the full set would punish the first visit; emoji/silence fallbacks already
// handle anything not yet cached when offline). RL1 sw.js pattern.
const CACHE = 'rolfe-legends-2-v33';
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.json',
  'js/game.js', 'js/combat.js', 'js/run.js', 'js/map.js', 'js/cards.js',
  'js/enemies.js', 'js/relics.js', 'js/events.js', 'js/rng.js',
  'js/sfx.js', 'js/music.js', 'js/credits.js', 'js/prefetch.js', 'js/tips.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // icons are drop-in art: cache what exists, never fail install over them
      .then((c) => c.addAll(SHELL).then(() =>
        Promise.allSettled(['assets/ui/icon-192.png', 'assets/ui/icon-512.png', 'assets/ui/apple-touch-icon.png'].map((u) => c.add(u)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isAsset = url.pathname.includes('/assets/');
  if (isAsset) {
    // cache-first: art + music never change without a rename; fill as we go
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => Response.error())) // offline + uncached → emoji/silence fallback
    );
  } else {
    // network-first: fresh code when online, last-known-good when offline
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))
      )
    );
  }
});
