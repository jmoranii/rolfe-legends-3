// Rolfe Legends 2 — predictive prefetch: instant boot AND no pop-in.
// The game boots on ~350KB, then this queue quietly warms what's PROBABLY
// next (act art on the title, reachable enemies on the map, your anthem when
// the final boss starts). Fetches run one at a time during idle moments so
// they never compete with something the player is actually waiting on, and
// every byte lands in the service worker's cache — so prefetch doubles as
// offline install. Misses cost ~100-250KB. Each URL is only ever tried once.

const queued = new Set();
const q = [];
let running = false;

export function prefetch(urls) {
  for (const u of urls) {
    if (!queued.has(u)) { queued.add(u); q.push(u); }
  }
  pump();
}

function pump() {
  if (running || !q.length) return;
  running = true;
  const idle = (fn) => ('requestIdleCallback' in window)
    ? requestIdleCallback(fn, { timeout: 3000 })
    : setTimeout(fn, 800);
  idle(() => next());
}

function next() {
  const u = q.shift();
  if (!u) { running = false; return; }
  fetch(u).catch(() => {}).finally(() => setTimeout(next, 120));
}
