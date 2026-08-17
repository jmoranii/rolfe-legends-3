// Rolfe Legends 3 — UI layer. Renders state from the pure engine (combat.js/run.js)
// plus the persistent FARM meta-layer (farm.js): title → farm hub → world select →
// expedition → settlement → back to the farm. Art + music are drop-in layers:
// PNGs in assets/ (emoji fallback), MP3s in assets/audio/ (silence fallback).

import { makeRng, randomSeed } from './rng.js';
import { HEROES, CARDS, DIAPERS, cardInfo, makeCard, upgradableCards, nValue } from './cards.js';
import { RELICS } from './relics.js';
import { EVENTS } from './events.js';
import { scoutFor } from './scout.js';
import * as C from './combat.js';
import * as R from './run.js';
import * as F from './farm.js';
import { PETS, barnBookPets, petIntent, petDeckCards } from './pets.js';
import { MAP_FLOORS, BOSS_ID } from './map.js';
import { sfx, setEnabled as setSfx, isEnabled as sfxOn } from './sfx.js';
import * as music from './music.js';
import { creditsRoll } from './credits.js';
import { prefetch } from './prefetch.js';
import { nextTip, nextLossLine } from './tips.js';
import { EVENT_KEYS } from './events.js';

const $app = document.getElementById('app');
const SAVE_KEY = 'rl3_run';
const PROFILE_KEY = 'rl3_profile';
const TIPS_KEY = 'rl3_tips';
const FARM_KEY = 'rl3_farm';

const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Animation pacing: 'slow' (default — big, readable cause-and-effect for
// learning) or 'fast' (settings toggle, once the game is understood).
const ANIM_KEY = 'rl3_anim';
let animMode = localStorage.getItem(ANIM_KEY) || 'slow';
function fxScale() { return REDUCED ? 0.01 : (animMode === 'fast' ? 0.55 : 1.9); }
function stepMs() { return REDUCED ? 30 : (animMode === 'fast' ? 420 : 1350); }  // enemy-turn beat
function applyFxScale() { document.documentElement.style.setProperty('--fx', String(REDUCED ? 0.01 : fxScale())); }
applyFxScale();

let run = null;
let combat = null;
let combatKind = 'fight';
let selectedCard = null;
let prevSnap = null;                   // combat diff snapshot → floaties/shakes

// ---------- profile, farm & save ----------
// Profile = hero win counts + flags. Farm = the persistent meta-layer (pets,
// coins, upgrades, world ladder) with its own key + validated (de)serializer.
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || { wins: {}, bonusSeen: false }; }
  catch { return { wins: {}, bonusSeen: false }; }
}
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }
let farm = F.deserializeFarm(localStorage.getItem(FARM_KEY)) || F.newFarm();
function saveFarm() { localStorage.setItem(FARM_KEY, F.serializeFarm(farm)); }
function saveRun() { if (run) localStorage.setItem(SAVE_KEY, R.serializeRun(run)); }
function clearSave() { localStorage.removeItem(SAVE_KEY); }

// ---------- tiny dom helpers ----------
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function screen(cls) {
  $app.innerHTML = '';
  document.querySelectorAll('.coach-bubble').forEach((b) => b.remove()); // tips die with their screen
  resetTips();
  resetTips();
  const s = el('div', `screen ${cls || 'plain'} screen-enter`);
  $app.appendChild(s);
  return s;
}
let $toasts = null;
function toast(msg, ms = 2600) {
  if (!$toasts || !$toasts.isConnected) {
    $toasts = el('div', 'toast-stack');
    document.body.appendChild($toasts);
  }
  // duration follows reading speed (the boys read slowly): ~320ms/word,
  // never less than the caller's ask, capped at 9s — and a tap dismisses
  const words = String(msg).replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
  const dur = Math.min(9000, Math.max(ms, 2600, words * 320));
  const t = el('div', 'toast', msg);
  const dismiss = () => {
    if (!t.isConnected) return;
    t.classList.add('gone');
    setTimeout(() => t.remove(), 260);
  };
  t.onclick = dismiss;
  $toasts.appendChild(t);
  setTimeout(dismiss, dur);
}
function modal(title, buildFn, { dismissable = true } = {}) {
  const veil = el('div', 'modal-veil');
  const m = el('div', 'modal');
  if (title) m.appendChild(el('h2', '', title));
  veil.appendChild(m);
  if (dismissable) veil.addEventListener('click', (ev) => { if (ev.target === veil) veil.remove(); });
  document.body.appendChild(veil);
  buildFn(m, () => veil.remove());
  return veil;
}
function actCls() { return run ? `act-${run.act}` : 'plain'; }

// A stop screen with the person/place as a big painted banner (Dad in his
// shop, Granny on her porch…), title overlaid, choices beneath.
function sceneScreen(artPath, emoji, titleText) {
  const s = screen(actCls());
  s.classList.add('scene-screen');
  const banner = el('div', 'scene-banner');
  banner.appendChild(artImg(artPath, emoji, 'scene-banner-art'));
  banner.appendChild(el('div', 'scene-banner-shade'));
  banner.appendChild(el('h2', 'scene-banner-title', titleText));
  s.appendChild(banner);
  const body = el('div', 'scene-body');
  // decision support: healing/removing/buying decisions need your HP and your
  // deck in view (James's playtest note)
  if (run) {
    const strip = el('div', 'scene-status');
    strip.appendChild(el('span', 'scene-stat stat-hp', `❤️ ${run.hp}/${run.maxHp}`));
    strip.appendChild(el('span', 'scene-stat stat-gold', `💰 ${run.gold}`));
    const deckB = el('button', 'pilebtn', `🎴 My Deck (${run.deck.length})`);
    deckB.onclick = () => showDeckModal(run.deck);
    strip.appendChild(deckB);
    body.appendChild(strip);
  }
  s.appendChild(body);
  return body;
}

// ---------- drop-in art (PNG with emoji fallback) ----------
const missingArt = new Map(); // path -> last failure time; retry after a beat
const MISSING_RETRY_MS = 12000;
function artImg(path, emoji, cls = '') {
  const wrap = el('span', `art-slot ${cls}`);
  const failedAt = missingArt.get(path);
  if (failedAt && Date.now() - failedAt < MISSING_RETRY_MS) {
    wrap.textContent = emoji;
    wrap.classList.add('art-emoji');
    return wrap;
  }
  const img = document.createElement('img');
  img.src = path;
  img.alt = '';
  img.draggable = false;
  img.onload = () => missingArt.delete(path);
  img.onerror = () => { missingArt.set(path, Date.now()); wrap.textContent = emoji; wrap.classList.add('art-emoji'); };
  wrap.appendChild(img);
  return wrap;
}
function bgLayer(path, cls = 'scene-bg') {
  const d = el('div', cls);
  const failedAt = missingArt.get(path);
  if (!failedAt || Date.now() - failedAt >= MISSING_RETRY_MS) {
    const probe = new Image();
    probe.onload = () => { missingArt.delete(path); d.style.backgroundImage = `url("${path}")`; d.classList.add('has-art'); };
    probe.onerror = () => missingArt.set(path, Date.now());
    probe.src = path;
  }
  return d;
}

// ---------- Coach James onboarding tips (one per moment, never twice) ----------
function tipsSeen() { try { return JSON.parse(localStorage.getItem(TIPS_KEY)) || {}; } catch { return {}; } }
const tipQueue = [];
let tipActive = false;
function coachTip(key, text) {
  const seen = tipsSeen();
  if (seen[key]) return;
  seen[key] = 1;
  localStorage.setItem(TIPS_KEY, JSON.stringify(seen));
  tipQueue.push(text);
  pumpTips();
}
function pumpTips() {
  if (tipActive || !tipQueue.length) return;
  tipActive = true;
  const text = tipQueue.shift();
  const b = el('div', 'coach-bubble tappable');
  b.appendChild(artImg('assets/ui/portrait_coach.jpg', '🧢', 'coach-face'));
  b.appendChild(el('span', 'coach-text', `<b>Coach James:</b> ${text}<br><span class="tip-tap">(tap to close)</span>`));
  document.body.appendChild(b);
  const done = () => {
    if (!b.isConnected) { tipActive = false; pumpTips(); return; }
    b.classList.add('gone');
    setTimeout(() => { b.remove(); tipActive = false; pumpTips(); }, 350);
  };
  b.onclick = done;
}
function resetTips() {
  tipQueue.length = 0;
  tipActive = false;
}

// ---------- predictive prefetch bundles ----------
function actArtUrls(act) {
  const keys = new Set();
  const enc = R.ENCOUNTERS[act];
  for (const pool of [enc.easy, enc.hard, enc.elite, enc.boss]) {
    for (const group of pool) for (const k of group) keys.add(k);
  }
  // alternate forms aren't in the encounter pools, but they appear mid-fight — so
  // prefetch them too, or the transformation stalls waiting on an uncached image
  if (act === 1) { keys.add('rolling_pumpkin_curled'); keys.add('compost_blob_s'); }
  if (act === 3) keys.add('brick_pile');
  if (act === 4) { keys.add('sand_blob_s'); keys.add('magnet_core'); }
  const urls = [...keys].map((k) => `assets/enemies/${k}.jpg`);
  urls.push(`assets/backgrounds/battle${act}.jpg`, `assets/backgrounds/map${act}.jpg`);
  return urls;
}
function prefetchActBundle(act) {
  prefetch([...actArtUrls(act), `assets/backgrounds/actcard${act}.jpg`, `assets/audio/map${act}.mp3`, 'assets/audio/battle.mp3']);
}

// ---------- title ----------
// Screen Wake Lock: tablets auto-dim while a kid reads a hand mid-fight (James
// saw it in playtesting). Held from fight start until back on the map/title, so
// fights, victory beats, rewards, and the credits roll stay lit. The OS
// reclaims the lock whenever the tab hides; re-grab on return while wanted.
let wakeLock = null, wakeWanted = false;
function holdScreen() {
  wakeWanted = true;
  if (!('wakeLock' in navigator) || wakeLock) return;
  navigator.wakeLock.request('screen')
    .then((wl) => { wakeLock = wl; wl.addEventListener('release', () => { wakeLock = null; }); })
    .catch(() => {}); // low battery / policy refusal — dimming returns, game unaffected
}
function releaseScreen() {
  wakeWanted = false;
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeWanted) holdScreen();
});

// ---------- fullscreen (the Amazon Kids browser has no install/standalone
// mode, so a ⛶ button is how the toolbar gets out of the way — James's ask) ----------
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
function fsAvailable() {
  const d = document.documentElement;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen);
}
async function toggleFullscreen() {
  const d = document.documentElement;
  try {
    if (fsEl()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
    else await (d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen());
  } catch { /* some webviews refuse fullscreen; the button just no-ops */ }
}
const fsLabel = () => `⛶ Full screen: ${fsEl() ? 'ON' : 'OFF'}`;
for (const evName of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(evName, () => {
    document.querySelectorAll('.fs-toggle').forEach((b) => { b.textContent = fsLabel(); });
  });
}

function showTitle() {
  releaseScreen();
  music.play('title');
  const s = screen('act-1 title-screen');
  const art = bgLayer('assets/ui/title.jpg', 'title-art');
  s.appendChild(art);
  const inner = el('div', 'title-inner');
  inner.appendChild(el('h1', 'title-logo', '👽 ROLFE LEGENDS 3 🦆'));
  inner.appendChild(el('p', 'subtitle title-sub', '<b>WORLD OF WEIRDOS</b><br>a Legends of Rolfe adventure — by Wyatt, Aaron & Uncle James'));
  const btns = el('div', 'title-buttons');
  const saved = R.deserializeRun(localStorage.getItem(SAVE_KEY));
  if (saved) {
    const b = el('button', 'btn gold', `▶️ Continue — ${HEROES[saved.hero].name}, ${R.WORLD_INFO[saved.act].name}`);
    b.onclick = () => { sfx.tap(); run = saved; showMap(); };
    btns.appendChild(b);
  }
  const nb = el('button', 'btn', '🚜 Go to the Farm');
  nb.onclick = () => { sfx.tap(); showFarm(); };
  btns.appendChild(nb);
  const p = loadProfile();
  // victory stars: one ⭐ per hero win (RL2 tradition, kept)
  const star = (n) => (n <= 5 ? '⭐'.repeat(n) : `⭐×${n}`);
  const winBits = ['wyatt', 'aaron', 'liam'].filter((h) => p.wins[h] > 0)
    .map((h) => `${HEROES[h].emoji} ${HEROES[h].name.split(' ')[0]} ${star(p.wins[h])}`);
  if (winBits.length) btns.appendChild(el('p', 'subtitle wins-shelf', winBits.join('<br>')));
  const settings = el('button', 'btn secondary', '⚙️ Settings');
  settings.onclick = showSettings;
  btns.appendChild(settings);
  inner.appendChild(btns);
  s.appendChild(inner);

  if (fsAvailable()) {
    const fs = el('button', 'fs-btn', '⛶');
    fs.setAttribute('aria-label', 'Full screen');
    fs.onclick = () => { sfx.tap(); toggleFullscreen(); };
    s.appendChild(fs);
  }

  // warm what a fresh run touches first: act 1, the heroes, the event banners
  prefetchActBundle(1);
  prefetch([
    'assets/ui/portrait_wyatt.jpg', 'assets/ui/portrait_aaron.jpg', 'assets/ui/portrait_coach.jpg',
    ...EVENT_KEYS.map((k) => `assets/events/${k}.jpg`),
    'assets/events/shop_jacob.jpg', 'assets/events/rest_granny.jpg', 'assets/events/treasure_rusty.jpg',
  ]);
}

// ---------- THE FARM (persistent hub — the heart of RL3) ----------
function petFace(id, cls = 'pet-face') {
  return artImg(`assets/pets/${id}.jpg`, PETS[id].emoji, cls);
}

function showFarm() {
  releaseScreen();
  clearSave(); run = null; // reaching the farm means no expedition is in flight
  music.play('farm');
  const s = screen('act-1 farm-screen');
  s.appendChild(bgLayer('assets/ui/farm.jpg', 'scene-bg'));
  s.appendChild(el('h2', '', '🚜 The Farm'));
  s.appendChild(el('p', 'subtitle', `💰 ${farm.coins} Farm Coins · 🛖 ${F.petsIn(farm, 'barn').length}/${F.barnCapacity(farm)} · 🌊 ${F.petsIn(farm, 'pool').length}/${F.poolCapacity(farm)}`));

  // equipped battle buddy (once Battle Buddies is bought)
  if (farm.upgrades.petBattle) {
    const eq = el('div', 'equip-row');
    if (farm.equipped) {
      eq.appendChild(petFace(farm.equipped, 'pet-face pet-face-sm'));
      eq.appendChild(el('span', '', `Battle buddy: <b>${PETS[farm.equipped].name}</b>`));
    } else {
      eq.appendChild(el('span', '', 'No battle buddy picked.'));
    }
    const ch = el('button', 'btn secondary btn-sm', farm.equipped ? 'Change' : 'Pick one');
    ch.onclick = showEquipPicker;
    eq.appendChild(ch);
    s.appendChild(eq);
  }

  const out = el('button', 'btn gold', '🗺️ Head out and fight some weirdos!');
  out.onclick = () => { sfx.tap(); showWorldSelect(); };
  const barn = el('button', 'btn', '🛖 Visit the Barn');
  barn.onclick = () => { sfx.tap(); showBarn(); };
  const book = el('button', 'btn', '📖 Barn Book');
  book.onclick = () => { sfx.tap(); showBarnBook(); };
  const shop = el('button', 'btn', `🛒 Farm Shop`);
  shop.onclick = () => { sfx.tap(); showFarmShop(); };
  const back = el('button', 'btn secondary', '← Title');
  back.onclick = showTitle;
  s.append(out, barn, book, shop, back);
  coachTip('farm', 'This is home! Everything you win stays here.');
}

function showEquipPicker() {
  modal('⚔️ Pick your battle buddy', (m, close) => {
    const none = el('button', 'btn secondary', '🚫 Go alone');
    none.onclick = () => { F.equipPet(farm, null); saveFarm(); close(); showFarm(); };
    m.appendChild(none);
    for (const id of farm.pets) {
      const p = PETS[id];
      const b = el('button', 'btn' + (farm.equipped === id ? ' gold' : ''));
      b.appendChild(petFace(id, 'pet-face pet-face-sm'));
      const cardBits = petDeckCards(id).map((c) => cardInfo(c).name);
      b.appendChild(el('span', '', `<b>${p.name}</b><br><span class="subtitle">${p.companion.desc}${cardBits.length ? ` · adds ${cardBits.join(' + ')}` : ''}</span>`));
      b.onclick = () => { F.equipPet(farm, id); saveFarm(); close(); showFarm(); };
      m.appendChild(b);
    }
  });
}

// The barn visit. Pats have no effect. Pats are mandatory. (INSPIRATION.md #11)
// It's a living barnyard now (the boys' ask): pets wander, bob, and do little
// antics; Barn Toys from the shop sit in the scene for them to hang out with.
const MOODS = ['❤️', '💤', '🎵', '🦋', '⭐', '🍎', '😊'];
function showBarn() {
  const s = screen('act-1 farm-screen');
  s.appendChild(bgLayer('assets/ui/barn.jpg', 'scene-bg'));
  s.appendChild(el('h2', '', '🛖 The Barn'));
  const patChain = []; // this visit's pat order (the ritual listens — silently)
  const ducksOwned = ['brownie', 'diver', 'harmless'].every((d) => farm.pets.includes(d));

  // deterministic scatter: same pet lands in the same spot each visit (it's HIS spot)
  const spotFor = (key, i, n) => {
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    // spread first (even columns, alternating rows), personality second (jitter):
    // nobody ever stacks, but everyone still has THEIR spot
    const cols = Math.max(1, Math.min(4, Math.ceil(n / 2)));
    const col = i % cols, row = Math.floor(i / cols);
    return {
      left: 4 + col * (74 / Math.max(1, cols - 0.4)) + (hash % 9),
      top: 6 + row * 44 + ((hash >> 2) % 14),
      dx: (hash % 2 ? 1 : -1) * (10 + (hash % 16)),
      dy: ((hash >> 3) % 2 ? 1 : -1) * (5 + (hash % 9)),
      dur: 6 + (hash % 7),
    };
  };
  const section = (title, ids, cap, habitat, minH) => {
    s.appendChild(el('h3', 'barn-section', `${title} (${ids.length}/${cap})`));
    const yard = el('div', 'barnyard' + (REDUCED ? ' no-motion' : ''));
    yard.style.minHeight = `${minH}px`;
    if (!ids.length) yard.appendChild(el('p', 'subtitle barnyard-empty', 'Nobody home yet — go win some fights!'));
    const toys = (farm.toys || []).filter((t) => F.TOYS[t].habitat === habitat);
    toys.forEach((tid, i) => {
      const toy = F.TOYS[tid];
      const t = el('div', 'barn-toy', toy.emoji);
      t.style.left = `${6 + i * (80 / Math.max(1, toys.length))}%`;
      t.style.bottom = '4px';
      t.onclick = () => { sfx.tap(); toast(`${toy.emoji} ${toy.name}: ${toy.desc}`, 2200); };
      yard.appendChild(t);
    });
    ids.forEach((id, i) => {
      const p = PETS[id];
      const c = el('div', 'barn-pet');
      const spot = spotFor(id, i, ids.length);
      c.style.left = `${spot.left}%`; c.style.top = `${spot.top}%`;
      c.style.setProperty('--dx', `${spot.dx}px`);
      c.style.setProperty('--dy', `${spot.dy}px`);
      c.style.setProperty('--wd', `${spot.dur}s`);
      c.appendChild(petFace(id));
      c.appendChild(el('div', 'barn-pet-name', p.name));
      c.onclick = () => {
        sfx.tap();
        floaty(c, '❤️', 'floaty-heart');
        toast(`${p.emoji} ${p.blurb}`, 2200);
        c.classList.remove('antic'); void c.offsetWidth; c.classList.add('antic');
        patChain.push(id);
        maybeSummonGoldie();
      };
      yard.appendChild(c);
    });
    s.appendChild(yard);
  };
  section('The Barn', F.petsIn(farm, 'barn'), F.barnCapacity(farm), 'barn', 260);
  section('🌊 The Fish Pool', F.petsIn(farm, 'pool'), F.poolCapacity(farm), 'pool', 230);

  // antics: every few seconds somebody does a little something (never in reduced motion)
  if (!REDUCED) {
    const anticTick = setInterval(() => {
      const yardPets = document.querySelectorAll('.barnyard .barn-pet');
      if (!yardPets.length) { clearInterval(anticTick); return; }
      const pet = yardPets[Math.floor(Math.random() * yardPets.length)];
      pet.classList.remove('antic'); void pet.offsetWidth; pet.classList.add('antic');
      const mood = el('div', 'mood-bubble', MOODS[Math.floor(Math.random() * MOODS.length)]);
      pet.appendChild(mood);
      setTimeout(() => mood.remove(), 1700);
    }, 3200);
  }

  // The ritual: all three ducks home, patted in world order — Brownie, Diver,
  // Harmless — with nothing in between, in one visit. Then someone appears at
  // the gate. Nothing renders, hints, or logs before that moment.
  const maybeSummonGoldie = () => {
    if (!ducksOwned || farm.pets.includes('goldie')) return;
    const t = patChain.slice(-3).join(',');
    if (t !== 'brownie,diver,harmless') return;
    if (s.querySelector('.goldie-gate')) return;
    const g = el('div', 'goldie-gate', '🦙');
    let taps = 0;
    g.onclick = () => {
      taps += 1;
      sfx.tap();
      if (taps < 3) return;
      farm.pets.push('goldie'); // the gate is hers; a full barn never turns her away
      farm.stats.petsWon += 1;
      saveFarm();
      sfx.win();
      modal(null, (m, close) => {
        m.appendChild(el('div', 'event-emoji', '🦙'));
        m.appendChild(el('div', 'speaker-line', 'The ducks all look at the gate at once. Goldie has been watching. Goldie has ALWAYS been watching.'));
        m.appendChild(el('div', 'crown', '👑'));
        m.appendChild(el('h2', '', 'GOLDIE joins the farm!'));
        m.appendChild(el('p', 'subtitle', 'The legendary llama. She spits with ancient precision. She knows things.'));
        const b = el('button', 'btn gold', 'WHOA. →');
        b.onclick = () => { close(); showBarn(); };
        m.appendChild(b);
      }, { dismissable: false });
    };
    s.appendChild(g);
  };

  const back = el('button', 'btn secondary', '← Farm');
  back.onclick = showFarm;
  s.appendChild(back);
  coachTip('barn', 'Tap a pet to say hi. They missed you.');
}

function showBarnBook() {
  const s = screen('act-1 farm-screen');
  s.appendChild(el('h2', '', '📖 The Barn Book'));
  const known = barnBookPets({ farm });
  const owned = known.filter((k) => farm.pets.includes(k)).length;
  s.appendChild(el('p', 'subtitle', `${owned} of ${known.length} pets found`));
  const grid = el('div', 'barn-grid book-grid');
  const RARITY_BADGE = { common: '⚪', uncommon: '🟢', rare: '🔵', legendary: '🟡' };
  for (const id of known) {
    const p = PETS[id];
    const have = farm.pets.includes(id);
    const c = el('div', 'barn-pet' + (have ? '' : ' book-unknown'));
    if (have) {
      c.appendChild(petFace(id));
      c.appendChild(el('div', 'barn-pet-name', `${RARITY_BADGE[p.rarity]} ${p.name}`));
      c.onclick = () => modal(`${p.emoji} ${p.name}`, (m) => {
        m.appendChild(petFace(id));
        m.appendChild(el('p', '', p.blurb));
        m.appendChild(el('p', '', `<b>In battle:</b> ${p.companion.desc}`));
        const cardBits = petDeckCards(id).map((cc) => cardInfo(cc));
        for (const info of cardBits) m.appendChild(miniCard(info));
        if (id === 'bear') m.appendChild(el('p', 'subtitle', 'Bruno hands you his card himself. Every turn. He insists.'));
      });
    } else {
      c.appendChild(el('div', 'pet-face pet-mystery', '❓'));
      c.appendChild(el('div', 'barn-pet-name', `${RARITY_BADGE[p.rarity]} ???`));
      c.onclick = () => toast(p.source === 'boss' ? '👑 A boss guards this one…' : `${RARITY_BADGE[p.rarity]} Win more fights to meet this one!`);
    }
    grid.appendChild(c);
  }
  s.appendChild(grid);
  const back = el('button', 'btn secondary', '← Farm');
  back.onclick = showFarm;
  s.appendChild(back);
}

function showFarmShop() {
  const s = sceneScreen('assets/events/shop_jacob.jpg', '🛒', "The Farm Shop");
  s.appendChild(el('p', 'subtitle', `💰 ${farm.coins} Farm Coins`));
  const stock = F.shopStock(farm);
  if (!stock.length) s.appendChild(el('p', '', 'All stocked up! The farm is fully upgraded. 🎉'));
  for (const item of stock) {
    const b = el('button', 'btn' + (farm.coins >= item.price ? '' : ' unaffordable'));
    b.innerHTML = `${item.emoji} <b>${item.name}</b> — 💰${item.price}<br><span class="subtitle">${item.desc}</span>`;
    b.onclick = () => {
      if (!F.shopBuy(farm, item.id)) return toast(`Not enough coins yet — win some fights! (💰${item.price})`);
      saveFarm();
      sfx.relic();
      toast(`${item.emoji} ${item.name} — yours!`);
      showFarmShop();
    };
    s.appendChild(b);
  }
  // Barn Toys — furnish the barnyard; pets hang out with what you buy
  const unownedToys = Object.entries(F.TOYS).filter(([id]) => !(farm.toys || []).includes(id));
  if (unownedToys.length) {
    s.appendChild(el('h3', 'barn-section', '🧸 Barn Toys'));
    for (const [id, toy] of unownedToys) {
      const b = el('button', 'btn' + (farm.coins >= toy.price ? '' : ' unaffordable'));
      b.innerHTML = `${toy.emoji} <b>${toy.name}</b> — 💰${toy.price} <span class="subtitle">(${toy.habitat === 'pool' ? 'fish pool' : 'barn'})</span><br><span class="subtitle">${toy.desc}</span>`;
      b.onclick = () => {
        const r = F.buyToy(farm, id);
        if (!r.ok) return toast(r.reason === 'coins' ? `Not enough coins yet (💰${toy.price})` : 'Already in the barn!');
        saveFarm(); sfx.relic(); toast(`${toy.emoji} ${toy.name} delivered to the ${toy.habitat === 'pool' ? 'pool' : 'barnyard'}!`);
        showFarmShop();
      };
      s.appendChild(b);
    }
  }

  // the Deck Workshop — permanent starter-deck changes, per hero (the boys' ask)
  s.appendChild(el('h3', 'barn-section', '🃏 Deck Workshop'));
  for (const heroId of ['wyatt', 'aaron', 'liam']) {
    const h = HEROES[heroId];
    const b = el('button', 'btn');
    b.innerHTML = `${h.emoji} <b>${h.name.split(' ')[0]}'s Deck</b><br><span class="subtitle">Train or trim the starting deck — forever.</span>`;
    b.onclick = () => showDeckWorkshop(heroId);
    s.appendChild(b);
  }
  const back = el('button', 'btn secondary', '← Farm');
  back.onclick = showFarm;
  s.appendChild(back);
  coachTip('shop_farm', 'Coins stay yours forever — win or lose.');
}

function showDeckWorkshop(heroId) {
  const h = HEROES[heroId];
  modal(`${h.emoji} ${h.name.split(' ')[0]}'s Starting Deck`, (m, close) => {
    const render = () => {
      m.innerHTML = '';
      m.appendChild(el('p', 'subtitle', `💰 ${farm.coins} · ✂️ trims used ${F.trimsUsed(farm, heroId)}/${F.TRIM_MAX}`));
      const deck = F.moddedStarter(farm, heroId);
      // one row per distinct card: count, upgraded count, the two levers
      const byId = {};
      for (const c of deck) { byId[c.id] = byId[c.id] || { n: 0, up: 0 }; byId[c.id].n += 1; if (c.up) byId[c.id].up += 1; }
      const trainP = F.trainPrice(farm, heroId);
      const trimP = F.trimPrice(farm, heroId);
      for (const [id, info] of Object.entries(byId)) {
        const def = CARDS[id];
        const row = el('div', 'workshop-row');
        row.appendChild(el('span', 'workshop-name', `${def.emoji} <b>${def.name}</b> ×${info.n}${info.up ? ` (⭐${info.up} trained)` : ''}`));
        const canTrain = info.n - info.up > 0 && def.up;
        const tb = el('button', 'btn btn-sm' + (canTrain && farm.coins >= trainP ? '' : ' unaffordable'), `🏋️ 💰${trainP}`);
        tb.onclick = () => {
          const r = F.trainCard(farm, heroId, id);
          if (!r.ok) return toast(r.reason === 'coins' ? `Not enough coins (💰${trainP})` : 'Nothing left to train on that one!');
          saveFarm(); sfx.relic(); toast(`⭐ ${def.name} is TRAINED — upgraded in every run, forever!`); render();
        };
        const canTrim = F.trimsUsed(farm, heroId) < F.TRIM_MAX;
        const xb = el('button', 'btn btn-sm secondary' + (canTrim && farm.coins >= trimP ? '' : ' unaffordable'), `✂️ 💰${trimP}`);
        xb.onclick = () => {
          const r = F.trimCard(farm, heroId, id);
          if (r.ok) { saveFarm(); sfx.relic(); toast(`✂️ A ${def.name} left the deck. Leaner. Meaner.`); return render(); }
          toast(r.reason === 'coins' ? `Not enough coins (💰${trimP})` : r.reason === 'max' ? `Max ${F.TRIM_MAX} trims per hero!` : 'None of those left!');
        };
        const btns = el('span', 'workshop-btns');
        btns.append(tb, xb);
        row.appendChild(btns);
        m.appendChild(row);
      }
      m.appendChild(el('p', 'subtitle', '🏋️ Train: that card is upgraded in EVERY run. ✂️ Trim: it leaves the deck for good (fewer cards = your best ones come up more).'));
      const done = el('button', 'btn secondary', 'Done');
      done.onclick = close;
      m.appendChild(done);
    };
    render();
  });
}

// ---------- world select (the ladder) ----------
let chosenWorld = 1;
function showWorldSelect() {
  const s = screen('act-1 farm-screen');
  s.appendChild(el('h2', '', '🗺️ Where to today?'));

  // the WEIRDNESS ladder — opens the first time the Magnet falls
  if (farm.weirdnessUnlocked) {
    const wrow = el('div', 'equip-row weirdness-row');
    const label = el('span', '', `🌀 <b>Weirdness ${farm.weirdness}</b>${farm.weirdness ? ` — weirdos +${farm.weirdness * 7}% ❤️, +${farm.weirdness * 5}% ⚔️` : ' — normal'}`);
    const minus = el('button', 'btn secondary btn-sm', '−');
    const plus = el('button', 'btn secondary btn-sm', '+');
    minus.onclick = () => { if (farm.weirdness > 0) { farm.weirdness -= 1; saveFarm(); showWorldSelect(); } };
    plus.onclick = () => { if (farm.weirdness < 10) { farm.weirdness += 1; saveFarm(); showWorldSelect(); } };
    wrow.append(minus, label, plus);
    s.appendChild(wrow);
    coachTip('weirdness', 'The worlds can always get weirder. How far can you climb?');
  }

  for (let w = 1; w <= R.WORLDS; w++) {
    const info = R.WORLD_INFO[w];
    const open = w <= farm.worlds.unlocked;
    const beaten = farm.worlds.beaten.includes(w);
    const best = farm.weirdnessBest[w];
    const badge = beaten ? (best > 0 ? ` ⭐<span class="weird-badge">🌀${best}</span>` : ' ⭐') : '';
    const c = el('div', 'world-card' + (open ? '' : ' world-locked'));
    const guard = w === 4 ? '🧲 Something magnetic waits at the end…' : `🦆 Boss: ${info.duck} the duck`;
    c.innerHTML = `<div class="world-emoji">${open ? info.emoji : '🔒'}</div>
      <div><b>World ${w}: ${open ? info.name : '???'}</b>${badge}<br>
      <span class="subtitle">${open ? guard : 'Beat the world before it to unlock!'}</span></div>`;
    if (open) c.onclick = () => { sfx.tap(); chosenWorld = w; showHeroSelect(); };
    s.appendChild(c);
  }
  const back = el('button', 'btn secondary', '← Farm');
  back.onclick = showFarm;
  s.appendChild(back);
}

// ---------- new pet celebration ----------
function showPetPop(petId, onDone) {
  const p = PETS[petId];
  sfx.relic();
  modal(null, (m, close) => {
    m.appendChild(el('div', 'crown', '🎉'));
    m.appendChild(el('h2', '', 'A NEW PET!'));
    m.appendChild(petFace(petId));
    m.appendChild(el('h3', '', `${p.emoji} ${p.name}`));
    m.appendChild(el('p', '', p.blurb));
    m.appendChild(el('p', 'subtitle', `${p.habitat === 'pool' ? '🌊 Heads for the fish pool' : '🛖 Heads for the barn'} when you get home.`));
    const b = el('button', 'btn gold', p.rarity === 'legendary' ? 'NO WAY!! →' : 'YES! →');
    b.onclick = () => { close(); onDone(); };
    m.appendChild(b);
  }, { dismissable: false });
}

// ---------- expedition settlement (every run ends at the farm) ----------
// Split in two so the world-4 victory can settle IMMEDIATELY (before the long
// credits roll — closing the tab mid-anthem must never lose banked progress),
// then render the summary after the crown screen.
function settleExpedition(won) {
  const worldNum = run.act;
  const weirdness = run.weirdness || 0;
  const openedBefore = farm.worlds.unlocked;
  const ladderOpenBefore = farm.weirdnessUnlocked;
  const summary = F.settleRun(farm, run, won);
  summary.weirdness = weirdness;
  summary.ladderJustOpened = !ladderOpenBefore && farm.weirdnessUnlocked;
  if (won) F.beatWorld(farm, worldNum);
  const opened = farm.worlds.unlocked > openedBefore ? farm.worlds.unlocked : null;
  saveFarm();
  clearSave();
  run = null;
  return { won, worldNum, summary, opened };
}

function renderSettlement(data) {
  const info = R.WORLD_INFO[data.worldNum];
  const s = screen('act-1 farm-screen');
  s.appendChild(el('h2', '', data.won ? `🌟 ${info.name} — SAVED!` : '🏡 Back home safe'));
  const lines = el('div', 'settle-lines');
  lines.appendChild(el('p', '', `💰 Banked <b>${data.summary.banked}</b> Farm Coins (${farm.coins} total)`));
  for (const id of data.summary.movedIn) {
    lines.appendChild(el('p', '', `${PETS[id].emoji} <b>${PETS[id].name}</b> moved into the ${PETS[id].habitat === 'pool' ? 'fish pool' : 'barn'}!`));
  }
  for (const id of data.summary.turnedAway) {
    lines.appendChild(el('p', '', `😢 ${PETS[id].emoji} ${PETS[id].name} found the ${PETS[id].habitat === 'pool' ? 'pool' : 'barn'} FULL… (the shop sells expansions!)`));
  }
  if (data.opened && R.WORLD_INFO[data.opened]) lines.appendChild(el('p', '', `🗺️ <b>World ${data.opened}: ${R.WORLD_INFO[data.opened].name}</b> is now open!`));
  if (data.won && data.summary.weirdness > 0) lines.appendChild(el('p', '', `🌀 <b>Weirdness ${data.summary.weirdness}</b> conquered!`));
  if (data.summary.ladderJustOpened) lines.appendChild(el('p', '', `🌀 <b>THE WEIRDNESS LADDER IS OPEN!</b> The worlds can get weirder now — check "Head out."`));
  s.appendChild(lines);
  const b = el('button', 'btn gold', '🚜 Back to the Farm');
  b.onclick = showFarm;
  s.appendChild(b);
}

function showRunEnd(won) { renderSettlement(settleExpedition(won)); }

function showSettings() {
  modal('⚙️ Settings', (m, close) => {
    const mus = el('button', 'btn', `🎵 Music: ${music.isEnabled() ? 'ON' : 'OFF'}`);
    mus.onclick = () => { music.setEnabled(!music.isEnabled()); mus.textContent = `🎵 Music: ${music.isEnabled() ? 'ON' : 'OFF'}`; };
    const sx = el('button', 'btn', `🔔 Sounds: ${sfxOn() ? 'ON' : 'OFF'}`);
    sx.onclick = () => { setSfx(!sfxOn()); sx.textContent = `🔔 Sounds: ${sfxOn() ? 'ON' : 'OFF'}`; };
    const animLabel = () => `🎬 Animations: ${animMode === 'slow' ? 'SLOW & CLEAR' : 'FAST'}`;
    const anim = el('button', 'btn', animLabel());
    anim.onclick = () => {
      animMode = animMode === 'slow' ? 'fast' : 'slow';
      localStorage.setItem(ANIM_KEY, animMode);
      applyFxScale();
      anim.textContent = animLabel();
      toast(animMode === 'fast' ? '🎬 Fast animations — for pros!' : '🎬 Slow & clear — see every hit land.');
    };
    const a2hs = el('button', 'btn secondary', '📲 Put it on your home screen');
    a2hs.onclick = () => { close(); showA2HS(); };
    const reset = el('button', 'btn danger', '🗑️ Abandon current run');
    reset.onclick = () => { clearSave(); run = null; close(); showTitle(); };
    if (fsAvailable()) {
      const fs = el('button', 'btn fs-toggle', fsLabel());
      fs.onclick = () => toggleFullscreen();
      m.append(mus, sx, anim, fs, a2hs, reset);
    } else m.append(mus, sx, anim, a2hs, reset);
    m.appendChild(el('p', 'subtitle', `Rolfe Legends 3 · made by Wyatt, Aaron & Uncle James<br><span style="opacity:.55;font-size:.72rem">version: ${new Date(document.lastModified).toLocaleString()}</span>`));
  });
}

function showA2HS() {
  modal('📲 Home screen', (m) => {
    if (deferredInstall) {
      const b = el('button', 'btn gold', '⬇️ Install the game');
      b.onclick = () => { deferredInstall.prompt(); deferredInstall = null; };
      m.appendChild(b);
    }
    m.appendChild(el('p', '', '<b>iPad / iPhone (Safari):</b> tap the Share button <span style="font-size:1.1em">⬆️</span>, then <b>"Add to Home Screen"</b>.'));
    m.appendChild(el('p', '', '<b>Android (Chrome):</b> tap the ⋮ menu, then <b>"Add to home screen"</b>.'));
    m.appendChild(el('p', '', '<b>Amazon Fire kids tablet:</b> a grown-up adds this website at <b>parents.amazon.com</b> (Add Web Content) — it becomes a tile in your library. Then tap ⛶ on the title screen to go full screen.'));
    m.appendChild(el('p', 'subtitle', 'Then the farm gets its own icon — and works even with no internet.'));
  });
}
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });

// ---------- hero select & boon ----------
function showHeroSelect() {
  const s = screen('act-1');
  const winfo = R.WORLD_INFO[chosenWorld];
  s.appendChild(el('h2', '', `Who heads to ${winfo.name}?`));
  const row = el('div', 'hero-pick');
  for (const id of ['wyatt', 'aaron', 'liam']) { // all three Legends, front and center
    const h = HEROES[id];
    const c = el('div', 'hero-card');
    c.appendChild(artImg(`assets/ui/portrait_${id}.jpg`, h.emoji, 'hero-face'));
    c.appendChild(el('h3', '', h.name));
    c.appendChild(el('p', '', h.tagline));
    c.appendChild(el('p', '', `❤️ ${h.hp} HP · ${RELICS[h.relic].emoji} ${RELICS[h.relic].name}`));
    c.onclick = () => { sfx.play(); startRun(id); };
    row.appendChild(c);
  }
  s.appendChild(row);
  if (farm.upgrades.petBattle && farm.equipped) {
    s.appendChild(el('p', 'subtitle', `${PETS[farm.equipped].emoji} ${PETS[farm.equipped].name} is coming along!`));
  }
  const back = el('button', 'btn secondary', '← Back');
  back.onclick = showWorldSelect;
  s.appendChild(back);
}

function startRun(heroId) {
  run = R.newRun(heroId, randomSeed(), { world: chosenWorld, pet: farm.upgrades.petBattle ? farm.equipped : null, weirdness: farm.weirdnessUnlocked ? farm.weirdness : 0, starter: F.moddedStarter(farm, heroId) });
  run.ownedPets = [...farm.pets]; // drop-roll dedupe: never re-win a pet you own
  showBoon();
}

function showBoon() {
  const s = sceneScreen('assets/ui/portrait_coach.jpg', '🧢', 'Coach James');
  s.appendChild(el('div', 'speaker-line', '"Big day, kid. That world\'s full of weirdos. Take one of these before you head out."'));
  const rng = makeRng(run.seed ^ 777);
  for (const boon of R.coachBoons(run, rng)) {
    const b = el('button', 'btn', boon.label);
    b.onclick = () => { sfx.relic(); boon.apply(run, rng); saveRun(); showActCard(run.act, showMap); };
    s.appendChild(b);
  }
}

// ---------- world weather (James's pick #2: each world's air does something) ----------
// A pointer-less particle layer on the map screen. Pure CSS animation; skipped
// entirely under reduced motion.
const WEATHER = {
  1: { n: 12, make: (i) => (i % 5 === 0 ? el('span', 'wp firefly', '✦') : el('span', 'wp pollen')) },
  2: { n: 12, make: (i) => (i % 6 === 0 ? el('span', 'wp butterfly', '🦋') : el('span', 'wp petal', '🌸')) },
  3: { n: 12, make: (i) => { const b = el('span', 'wp brickbit'); b.style.background = ['#e2504c', '#3a7bd5', '#f4c430', '#4caf50'][i % 4]; return b; } },
  4: { n: 14, make: (i) => (i % 7 === 0 ? el('span', 'wp spark', '⚡') : el('span', 'wp glitter', '✦')) },
};
function weatherLayer(act) {
  const w = el('div', `weather weather-${act}`);
  if (REDUCED) return w;
  const spec = WEATHER[act] || WEATHER[1];
  for (let i = 0; i < spec.n; i++) {
    const p = spec.make(i);
    p.style.setProperty('--wl', `${(i * 83 + act * 29) % 100}%`);
    p.style.setProperty('--wt', `${6 + ((i * 47) % 9)}s`);
    p.style.setProperty('--wdel', `${-((i * 13) % 11)}s`);
    p.style.setProperty('--ws', `${0.6 + ((i * 31) % 10) / 12}`);
    w.appendChild(p);
  }
  return w;
}

// ---------- the map (StS node graph) ----------
const NODE_META = {
  fight: { ico: '⚔️', name: 'Trouble', desc: "Something's bothering the farm. Fight it!" },
  elite: { ico: '💀', name: 'BIG Trouble', desc: 'A serious foe — big risk, and it drops a Farm Treasure.' },
  boss: { ico: '👑', name: 'THE BOSS', desc: 'The big one at the top of the map.' },
  shop: { ico: '🛒', name: "Dad's Farm Supply", desc: 'Spend gold on cards and treasures.' },
  rest: { ico: '🍪', name: "Granny Rockie's Porch", desc: 'Cookies (heal) or Practice (upgrade a card).' },
  event: { ico: '❓', name: 'Something Happens…', desc: 'You never know, out in the fields.' },
  treasure: { ico: '🐕', name: 'Here Comes Rusty!', desc: 'He brings you a Farm Treasure. Good boy.' },
};

const ROW_H = 96;          // px per floor
const MAP_PAD = 40;        // canvas top/bottom padding

function nodeXY(node, W) {
  // cols 0..3 spread across the canvas width; higher floors sit higher up
  const x = W * (0.14 + node.c * 0.24);
  const y = MAP_PAD + (MAP_FLOORS - node.f) * ROW_H + 20;
  return { x, y };
}

function showMap() {
  releaseScreen();
  music.play(`map${run.act}`);
  saveRun();
  const s = screen(actCls());
  s.classList.add('map-screen');
  s.appendChild(weatherLayer(run.act));
  const info = R.WORLD_INFO[run.act];

  // top bar
  const bar = el('div', 'map-topbar');
  bar.appendChild(el('h2', 'map-title', `${info.emoji} World ${run.act}: ${info.name}`));
  bar.appendChild(el('div', 'floor-meter', `Floor ${run.floor} / ${MAP_FLOORS} · ❤️ ${run.hp}/${run.maxHp} · 💰 ${run.gold}`));
  const shelf = el('div', 'relic-shelf');
  for (const rid of run.relics) {
    const pin = el('span', 'relic-pin', RELICS[rid].emoji);
    pin.title = `${RELICS[rid].name} — ${RELICS[rid].text}`;
    pin.onclick = () => toast(`${RELICS[rid].emoji} ${RELICS[rid].name}: ${RELICS[rid].text}`, 2400);
    shelf.appendChild(pin);
  }
  const deckBtn = el('button', 'pilebtn', `🎴 ${run.deck.length}`);
  deckBtn.onclick = () => showDeckModal(run.deck);
  const helpBtn = el('button', 'pilebtn', '📖');
  helpBtn.onclick = showHelpModal;
  const menuBtn = el('button', 'pilebtn', '⚙️');
  menuBtn.onclick = showSettings;
  shelf.append(deckBtn, helpBtn, menuBtn);
  bar.appendChild(shelf);
  s.appendChild(bar);

  // scrollable node graph
  const wrap = el('div', 'map-wrap');
  const canvas = el('div', 'map-canvas');
  const H = MAP_PAD * 2 + MAP_FLOORS * ROW_H + 40;
  canvas.style.height = `${H}px`;
  // the mural lives INSIDE the canvas so it spans the whole trail and scrolls
  // with it, StS-parchment style (James's pick, Tue 2026-08-05) — it used to be
  // viewport-anchored and slid away, leaving bare gradient
  canvas.appendChild(bgLayer(`assets/backgrounds/map${run.act}.jpg`, 'map-bg'));
  // wide screens: the canvas caps at 560px, so a blurred copy of the same mural
  // fills the side gutters (letterbox-blur) instead of bare act gradient
  const wide = bgLayer(`assets/backgrounds/map${run.act}.jpg`, 'map-bg-wide');
  wide.style.height = `${H}px`;
  wrap.appendChild(wide);
  s.appendChild(wrap);
  wrap.appendChild(canvas);
  $app.appendChild(s); // ensure laid out for width

  const W = Math.min(wrap.clientWidth || 390, 560);
  canvas.style.width = `${W}px`;

  const map = run.map;
  const reach = new Set(R.nextNodes(run).map((n) => n.id));
  const onTrail = new Set(run.trail);

  // edges (SVG under the nodes)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.classList.add('map-edges');
  const trailPairs = new Set();
  for (let i = 0; i < run.trail.length - 1; i++) trailPairs.add(`${run.trail[i]}>${run.trail[i + 1]}`);
  for (const [from, tos] of Object.entries(map.edges)) {
    for (const to of tos) {
      const a = nodeXY(map.nodes[from], W);
      const b = nodeXY(map.nodes[to], W);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const midY = (a.y + b.y) / 2;
      path.setAttribute('d', `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`);
      path.classList.add('edge');
      if (trailPairs.has(`${from}>${to}`)) path.classList.add('edge-taken');
      else if (run.pos === from) path.classList.add('edge-open');
      svg.appendChild(path);
    }
  }
  canvas.appendChild(svg);

  // nodes
  let currentEl = null;
  let eliteReachable = false;
  for (const [id, node] of Object.entries(map.nodes)) {
    const meta = NODE_META[node.type];
    const { x, y } = nodeXY(node, W);
    const isReach = reach.has(id);
    const cls = ['map-spot', `spot-${node.type}`];
    if (id === BOSS_ID) cls.push('spot-boss-big');
    if (isReach) cls.push('map-node', 'reachable');
    if (onTrail.has(id)) cls.push('visited');
    if (run.pos === id) cls.push('current');
    const d = el('div', cls.join(' '));
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    d.innerHTML = `<span class="spot-ico">${meta.ico}</span>`;
    d.title = meta.name;
    if (isReach) {
      if (node.type === 'elite') eliteReachable = true;
      d.onclick = () => { sfx.tap(); const res = R.enterMapNode(run, id); if (res) enterNode(res); };
    } else {
      // any spot identifies itself on tap (kids learn the icons by poking)
      d.onclick = () => toast(`${meta.ico} ${meta.name} — ${NODE_META[node.type].desc}`, 2600);
    }
    canvas.appendChild(d);
    if (run.pos === id) currentEl = d;
  }
  // "you are here" marker at act start
  if (!run.pos) {
    const start = el('div', 'map-start-hint', '⬆️ Pick your first stop');
    start.style.top = `${MAP_PAD + MAP_FLOORS * ROW_H + 8}px`;
    canvas.appendChild(start);
  }

  // scroll: keep current position (or the bottom) in view
  requestAnimationFrame(() => {
    const target = currentEl ? currentEl.offsetTop - wrap.clientHeight * 0.62 : canvas.scrollHeight;
    wrap.scrollTo({ top: Math.max(0, target), behavior: REDUCED ? 'auto' : 'smooth' });
  });

  coachTip('map', 'Pick your path — you can see the whole climb.');
  if (eliteReachable) coachTip('elite', '💀 is BIG trouble… and big treasure. Your call.');

  prefetchActBundle(run.act);
  if (eliteReachable) prefetch(['assets/audio/elite.mp3']);
  prefetch([`assets/audio/battle${run.act}.mp3`]);
  if (run.floor >= 8) prefetch(['assets/audio/boss.mp3', 'assets/audio/victory.mp3']);
}

function enterNode(node) {
  saveRun();
  switch (node.type) {
    case 'fight': case 'elite': case 'boss': return startCombatUI(node.enemies, node.type);
    case 'shop': return showShop(node.shop);
    case 'rest': return showRest();
    case 'event': return showEvent(node.event);
    case 'treasure': return showTreasure(node.relic);
    case 'skipped': return showSkipped();
    default: return showMap();
  }
}

function showSkipped() {
  const s = sceneScreen('assets/events/tractor_ride.jpg', '🚜', 'The tractor rumbles past it all.');
  s.appendChild(el('div', 'speaker-line', '"Told ya I was headed this way." — Poppa Flaj'));
  const b = el('button', 'btn', 'Onward! →');
  b.onclick = showMap;
  s.appendChild(b);
}

// ---------- combat ----------
let lastBossKeys = [];
function startCombatUI(enemyKeys, kind) {
  combatKind = kind;
  if (kind === 'boss') lastBossKeys = enemyKeys;
  combat = C.startCombat(run, enemyKeys, makeRng(randomSeed()), { kind });
  lastPulseTurn = -1;
  holdScreen();
  music.play(kind === 'boss' ? (run.act === R.WORLDS ? 'finalboss' : 'duckboss') : kind === 'elite' ? 'elite' : `battle${run.act}`); // every world fights to its own tune
  selectedCard = null;
  prevSnap = null;
  renderCombat();
  coachTip('energy', 'You get 3 ⚡ each turn. Every card costs some!');
  coachTip('intent', "Those bubbles show each enemy's next move!");
  if (kind === 'boss' && run.act === R.WORLDS) {
    // a win is likely — have the ending ready the instant it happens
    const p = loadProfile();
    const wants = [`assets/audio/anthem_${run.hero}.mp3`, `assets/audio/anthem_${run.hero}.lrc`, 'assets/ui/title.jpg'];
    const other = run.hero === 'wyatt' ? 'aaron' : 'wyatt';
    if (['wyatt', 'aaron'].includes(run.hero) && p.wins[other] > 0 && !p.bonusSeen) {
      wants.push('assets/audio/anthem_both.mp3', 'assets/audio/anthem_both.lrc');
    }
    prefetch(wants);
  }
}

// Every status is tap-to-explain (kids can't hover) — see the delegated
// click handler at boot.
const STATUS_INFO = {
  block: '🛡️ Block: soaks up that much damage, then wears off next turn.',
  strength: '💪 Strength: every attack hits that much harder.',
  tempStr: '💪⏳ Temporary Strength: extra attack damage this turn only.',
  dexterity: '🩰 Dexterity: block cards give that much MORE Block.',
  poison: '☠️ Poison: takes that much damage at the start of its turn, then shrinks by 1. Goes right through Block and shells!',
  weak: '😩 Weak: attacks deal 25% LESS damage.',
  vulnerable: '💔 Vulnerable: takes 50% MORE damage from attacks.',
  frail: '🦴 Frail: block cards give 25% less Block.',
  thorns: '🌵 Thorns: anyone who attacks it takes that much damage back.',
  intangible: '👻 Intangible: takes at most 1 damage from ANYTHING right now.',
  focus: '😆 Giggle Power: all floating diapers get that much stronger.',
};

const SEENFX_KEY = 'rl3_seenfx';
function seenFx() { try { return JSON.parse(localStorage.getItem(SEENFX_KEY)) || {}; } catch { return {}; } }
function markFxSeen(k) {
  const seen = seenFx();
  seen[k] = 1;
  localStorage.setItem(SEENFX_KEY, JSON.stringify(seen));
}

function statusChips(cr) {
  const chips = [];
  const seen = seenFx();
  const add = (k, label) => chips.push(`<span class="chip${seen[k] ? '' : ' chip-new'}" data-status="${k}">${label}</span>`);
  if (cr.block) add('block', `🛡️${cr.block}`);
  if (cr.strength) add('strength', `💪${cr.strength}`);
  if (cr.tempStr) add('tempStr', `💪${cr.tempStr}⏳`);
  if (cr.dexterity) add('dexterity', `🩰${cr.dexterity}`);
  if (cr.poison) add('poison', `☠️${cr.poison}`);
  if (cr.weak) add('weak', `😩${cr.weak}`);
  if (cr.vulnerable) add('vulnerable', `💔${cr.vulnerable}`);
  if (cr.frail) add('frail', `🦴${cr.frail}`);
  if (cr.thorns) add('thorns', `🌵${cr.thorns}`);
  if (cr.intangible) add('intangible', '👻');
  if (cr.focus) add('focus', `😆${cr.focus}`);
  return chips.join('');
}

// active powers (Tornado Form, Birthday Boy…) get chips + tap-explanations —
// they used to vanish from view the moment they were played
const POWER_INFO = {
  tornado_form: { emoji: '🌪️', text: (n) => `Tornado Form: +${n} Strength at the start of EVERY turn!` },
  tough_skin: { emoji: '🦬', text: (n) => `Tough Skin: +${n} Block at the end of every turn.` },
  fortify: { emoji: '🏚️', text: () => 'Fortify the Barn: your Block no longer wears off between turns!' },
  sleight_of_hand: { emoji: '🎩', text: () => 'Sleight of Hand: draw 1 extra card every turn, then discard 1.' },
  ball_machine: { emoji: '🎾', text: () => 'Ball Machine: a free Soccer Ball appears in your hand every turn.' },
  afterimage: { emoji: '👥', text: () => 'Afterimage: +1 Block every time you play a card.' },
  max_stink: { emoji: '🌫️', text: () => 'MAXIMUM STINK: your Stinky Diapers hit ALL enemies at once.' },
  birthday_boy: { emoji: '🎂', text: () => 'Birthday Boy: +1 Giggle Power at the start of every turn.' },
};
function powerChips(h) {
  const seen = seenFx();
  return Object.entries(h.powers || {})
    .filter(([k, v]) => v && POWER_INFO[k])
    .map(([k, v]) => `<span class="chip chip-power${seen['p_' + k] ? '' : ' chip-new'}" data-power="${k}">${POWER_INFO[k].emoji}${Number.isFinite(v) ? v : ''}</span>`)
    .join('');
}

const INTENT_KIND_INFO = {
  attack: (name, dmg) => `⚔️ Next move — ${name}: it will attack you for ${dmg} after your turn!`,
  defend: (name) => `🛡️ Next move — ${name}: it will protect itself with Block.`,
  buff: (name) => `⬆️ Next move — ${name}: it will power itself (or its friends) up.`,
  debuff: (name) => `🌀 Next move — ${name}: it will hit YOU with something nasty.`,
  sleep: (name) => `😴 ${name} — it's just… standing there. For now.`,
  flee: (name) => `🪽 Next move — ${name}: it's about to run away!`,
  summon: (name) => `➕ Next move — ${name}: it will call in friends.`,
  countdown: (name) => `⏳ ${name}: something BIG is charging up. The number is the countdown.`,
  special: (name) => `✨ Next move — ${name}.`,
};

function intentLabel(state, e) {
  const it = e.intent;
  if (!it) return '';
  if (it.dmg != null) {
    const p = C.intentPreview(state, e);
    const t = p.times > 1 ? `×${p.times}` : '';
    const total = p.per * p.times;
    return `<span class="intent attack" data-intent="attack" data-name="${it.name}" data-dmg="${p.per}${t} (${total} total)">⚔️ ${p.per}${t}</span>`;
  }
  const icons = { defend: '🛡️', buff: '⬆️', debuff: '🌀', sleep: '😴', flee: '🪽', summon: '➕', countdown: '⏳', special: '✨' };
  return `<span class="intent ${it.kind}" data-intent="${it.kind}" data-name="${it.name}">${icons[it.kind] || '❔'} ${it.name}</span>`;
}

// mini card used anywhere the player is CHOOSING or BUYING a card — always
// shows cost, name, and full text (James's readability pass, Fri 2026-08-01)
function miniCard(info, { extraCls = '', price = null } = {}) {
  const cost = info.cost;
  const d = el('div', `reward-card mini-card rarity-${info.rarity} type-${info.type} ${extraCls}`);
  d.innerHTML = `${cost === null ? '' : `<div class="cost">${cost === 'X' ? 'X' : cost}</div>`}
    <div class="art">${info.emoji}</div><b class="mc-name">${info.name}</b>
    <div class="ctx mc-text">${cardText(info, false)}</div>
    ${price != null ? `<div class="price-tag">💰${price}</div>` : ''}`;
  return d;
}

function snapCombat(st) {
  const snap = { heroHp: st.hero.hp, heroBlock: st.hero.block, enemies: {}, count: st.enemies.length };
  st.enemies.forEach((e, i) => {
    // artKey + name are what a form change actually shows up as. Spawned enemies are
    // pushed onto the array, so "index >= previous count" identifies a fresh split.
    snap.enemies[i] = {
      hp: e.hp, block: e.block, dead: e.hp <= 0, artKey: e.artKey, name: e.name,
      strength: e.strength || 0, debuffs: (e.weak || 0) + (e.vulnerable || 0),
    };
  });
  return snap;
}

// Tap an enemy mid-fight and Coach James gives you the read on it: what it does —
// and ONLY what it does (no counter-advice; many answers is the point, James's
// rule Sun 2026-08-03). Also surfaces the live numbers, so the kid doesn't have
// to squint at the chips to know what's stuck on it.
function showScout(e) {
  sfx.tap();
  modal(null, (m, close) => {
    const head = el('div', 'scout-head');
    head.appendChild(artImg(`assets/enemies/${e.artKey}.jpg`, e.emoji, 'face scout-face'));
    const who = el('div', 'scout-who');
    who.appendChild(el('div', 'scout-name', e.name));
    who.appendChild(el('div', 'scout-hp', `❤️ ${Math.max(0, e.hp)} / ${e.maxHp}`));
    head.appendChild(who);
    m.appendChild(head);

    const facts = [];
    if (e.block > 0) facts.push(`🛡️ ${e.block} Block right now`);
    if (e.strength) facts.push(`💪 ${e.strength} Strength`);
    if (e.thorns) facts.push(`🌵 ${e.thorns} spikes — hitting it hurts you back`);
    if (e.intangible) facts.push('👻 Ghostly this turn — your hits barely land');
    if (e.poison) facts.push(`🧪 ${e.poison} Poison ticking on it`);
    if (e.weak) facts.push(`😵 Weak for ${e.weak} — it hits softer`);
    if (e.vulnerable) facts.push(`🎯 Vulnerable for ${e.vulnerable} — it takes extra`);
    if (facts.length) m.appendChild(el('div', 'scout-facts', facts.join('<br>')));

    const line = el('div', 'speaker-line scout-line');
    line.appendChild(artImg('assets/ui/portrait_coach.jpg', '🧢', 'coach-face'));
    line.appendChild(el('span', 'scout-say', `<b>Coach James:</b> ${scoutFor(e.key, e.artKey)}`));
    m.appendChild(line);
    const ok = el('button', 'btn', "👍 Got it, Coach");
    ok.onclick = close;
    m.appendChild(ok);
  });
}

// THE BIG TWISTER's re-form — the act-3 signature moment gets its own sequence
// (James, Sun 2026-08-03): double lightning flash, board quake + gust lean, the
// card convulses and GROWS through the art swap, debris scatters, and the label
// says exactly what happened.
function reformFx(enemyEl, oldArtKey, emoji) {
  if (window.__RL2) window.__RL2._reforms = (window.__RL2._reforms || 0) + 1;
  if (!enemyEl) return;
  sfx.boom();
  sfx.whoosh(true);
  setTimeout(() => sfx.bossDefeat(), Math.round(300 * fxScale()));
  if (REDUCED) { floaty(enemyEl, '🌪️ IT RE-FORMS… BIGGER!', 'formshift'); return; }
  const flash = el('div', 'storm-flash');
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), Math.round(1200 * fxScale()));
  const app = document.getElementById('app');
  app.classList.add('quake', 'gust');
  setTimeout(() => app.classList.remove('quake', 'gust'), Math.round(950 * fxScale()));
  enemyEl.classList.add('reforming');
  const ms = Math.round(2200 * fxScale());
  const face = enemyEl.querySelector('.face');
  if (face && oldArtKey) {
    const ghost = artImg(`assets/enemies/${oldArtKey}.jpg`, emoji, 'face form-ghost');
    ghost.style.animationDuration = `${ms}ms`;
    face.appendChild(ghost);
    setTimeout(() => ghost.remove(), ms + 60);
  }
  windScatter(enemyEl, 10);
  floaty(enemyEl, '🌪️ IT RE-FORMS… BIGGER!', 'formshift');
  setTimeout(() => enemyEl.classList.remove('reforming'), ms + 60);
}

// A form change used to be a hard art swap on the next render — the new picture just
// appeared. Now the outgoing form is kept as a ghost layered over the incoming one and
// cross-fades out, so there's a visible beat of "it's changing" first (James's ask).
function formShiftFx(enemyEl, oldArtKey, emoji) {
  if (!enemyEl) return;
  const face = enemyEl.querySelector('.face');
  if (!face) return;
  enemyEl.classList.add('form-shifting');
  const ms = Math.round(900 * fxScale());
  if (!REDUCED && oldArtKey) {
    const ghost = artImg(`assets/enemies/${oldArtKey}.jpg`, emoji, 'face form-ghost');
    ghost.style.animationDuration = `${ms}ms`;
    face.appendChild(ghost);
    setTimeout(() => ghost.remove(), ms + 60);
  }
  floaty(enemyEl, '✨ CHANGING FORM!', 'formshift');
  sfx.boom();
  setTimeout(() => enemyEl.classList.remove('form-shifting'), ms + 60);
}

// A split used to be text-only. The new half now peels out of its parent so the
// "one became two" reads visually.
function splitInFx(enemyEl) {
  if (!enemyEl || REDUCED) return;
  const ms = Math.round(760 * fxScale());
  enemyEl.classList.add('splitting-in');
  enemyEl.style.animationDuration = `${ms}ms`;
  floaty(enemyEl, '✂️ IT SPLIT!', 'formshift');
  sfx.slash();
  setTimeout(() => enemyEl.classList.remove('splitting-in'), ms + 60);
}

// Fleeing is NOT dying. Dying topples down and drains gray; fleeing lifts off —
// a buffet against the gust, then the whole card streaks away on the wind. The
// distinction is the point: the Passing Squall wasn't beaten, it was OUTLASTED
// (and the Magpie still has your gold). A fled enemy used to simply vanish
// between renders; now it gets one last render wearing .fleeing.
const fleeSeen = new WeakSet();
function fleeLine(e) {
  if (e.key === 'dust_bunny') return '💨 It drifted away!';
  if (e.key === 'dust_devil') return '💨 poof';
  if (e.stolen) return `💨 It got away with your 💰${e.stolen}!`;
  return '💨 It got away!';
}
function fleeOutEl(e) {
  fleeSeen.add(e);
  if (window.__RL2) window.__RL2._fleesShown = (window.__RL2._fleesShown || 0) + 1; // e2e observability: reduced motion makes the exit too fast to catch in the DOM
  const d = el('div', `enemy fleeing${e.isBoss ? ' boss-foe' : ''}${e.isElite && !e.isBoss ? ' elite-foe' : ''}`);
  d.appendChild(artImg(`assets/enemies/${e.artKey}.jpg`, e.emoji, 'face'));
  d.insertAdjacentHTML('beforeend', `<div class="nm">${e.name}</div>
    <div class="hpbar"><div style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></div></div>
    <div class="hpnum">❤️ ${Math.max(0, e.hp)}/${e.maxHp}</div>`);
  const big = false; // no outlast-storm fight in RL3; thieves still flee small
  requestAnimationFrame(() => {
    floaty(d, fleeLine(e), big ? 'formshift' : 'windy');
    windScatter(d, big ? 10 : 4);
    sfx.whoosh(big);
    if (big && !REDUCED) {
      const app = document.getElementById('app');
      app.classList.add('gust');
      setTimeout(() => app.classList.remove('gust'), Math.round(950 * fxScale()));
    }
  });
  return d;
}

// leaves and dust shaken loose by the departure, scattering downwind
function windScatter(fromEl, count) {
  if (REDUCED || !fromEl) return;
  const a = fromEl.getBoundingClientRect();
  const ms = Math.round(700 * fxScale());
  for (let i = 0; i < count; i++) {
    const f = el('span', 'fling', ['🍃', '💨', '🌾'][i % 3]);
    f.style.left = `${a.left + a.width * (0.2 + Math.random() * 0.6)}px`;
    f.style.top = `${a.top + a.height * (0.15 + Math.random() * 0.6)}px`;
    f.style.transitionDuration = `${ms}ms`;
    f.style.transitionDelay = `${Math.round(Math.random() * 180 * fxScale())}ms`;
    document.body.appendChild(f);
    requestAnimationFrame(() => {
      f.style.transform = `translate(${90 + Math.random() * 190}px, ${-70 + Math.random() * 95}px) rotate(${120 + Math.random() * 240}deg) scale(${0.7 + Math.random() * 0.7})`;
      f.style.opacity = '0';
    });
    setTimeout(() => f.remove(), ms + 260);
  }
}

function floaty(target, text, cls, leftPct) {
  if (!target || REDUCED) return;
  const f = el('span', `floaty ${cls}`, text);
  f.style.left = `${leftPct ?? 22 + Math.random() * 46}%`;
  const ms = Math.round(950 * fxScale());
  f.style.animationDuration = `${ms}ms`;
  target.appendChild(f);
  setTimeout(() => f.remove(), ms + 60);
}

// a little emoji projectile from cause → target (diaper zaps, etc.)
function flingEmoji(fromEl, toEl, emoji) {
  if (REDUCED || !fromEl || !toEl) return 0;
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const f = el('span', 'fling', emoji);
  f.style.left = `${a.left + a.width / 2}px`;
  f.style.top = `${a.top + a.height / 2}px`;
  const ms = Math.round(430 * fxScale());
  f.style.transitionDuration = `${ms}ms`;
  document.body.appendChild(f);
  requestAnimationFrame(() => {
    f.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(1.35)`;
    f.style.opacity = '0.15';
  });
  setTimeout(() => f.remove(), ms + 40);
  return ms;
}

// tick-damage attribution: WHY that number just happened (James's ask —
// poison and diaper zaps were mystery damage after END TURN)
const SRC_FX = {
  poison: { ico: '☠️', cls: 'poison', sound: () => sfx.poison(), flash: 'poison-flash' },
  stinky: { ico: '💩', cls: 'dmg', sound: () => sfx.pop(), fromOrb: 'stinky' },
  blowout: { ico: '🌋', cls: 'dmg big', sound: () => sfx.boom(), fromOrb: 'blowout' },
  thorns: { ico: '🌵', cls: 'dmg', sound: () => sfx.slashTick(2) },
  hailstone: { ico: '🧊', cls: 'dmg', sound: () => sfx.shieldClink() },
  constrict: { ico: '🌊', cls: 'dmg', sound: () => sfx.debuff() },
  ivy: { ico: '🌿', cls: 'poison', sound: () => sfx.poison() },
  effort: { ico: '😮‍💨', cls: 'dmg', sound: () => {} },
};

// Compare current combat state to prevSnap and decorate the fresh DOM with
// floaties + shakes. HP-loss floaties come from the engine's per-hit damage
// log so a ×3 flurry or an X-cost spin visibly lands as 3 separate hits
// (staggered), not one lump. Called at the end of every renderCombat.
let lastLogIdx = 0;
function animateDiffs(s, enemyEls, heroEl) {
  const st = combat;
  if (!prevSnap || !st) {
    prevSnap = st ? snapCombat(st) : null;
    lastLogIdx = st ? st.log.length : 0;
    return;
  }
  const prev = prevSnap;
  // per-hit events since last render → staggered floaties (multi-hit clarity)
  const events = st.log.slice(lastLogIdx);
  lastLogIdx = st.log.length;
  let delay = 0;
  let sawOrbBlock = false;
  const stagger = Math.max(90, Math.round(190 * fxScale()));
  for (const ev of events) {
    if (ev.t === 'addCard') {
      const card = CARDS[ev.id];
      if (card && (card.type === 'status' || card.type === 'curse')) {
        const pile = ev.to === 'draw' ? 'shuffled into your DRAW pile' : ev.to === 'hand' ? 'jammed into your hand' : 'tossed onto your DISCARD pile';
        toast(`${card.emoji} ${ev.n > 1 ? ev.n + '× ' : ''}${card.name} got ${pile}! (It vanishes after the fight.)`, 3000);
      }
      continue;
    }
    if (ev.t === 'relic') {
      const pin = document.querySelector(`.belt-pin[data-relic="${ev.id}"]`);
      if (pin) { pin.classList.remove('proc'); void pin.offsetWidth; pin.classList.add('proc'); }
      continue;
    }
    if (ev.t === 'grow') {
      // the whole family of copies just got stronger — announce it (Claw joy)
      const card = CARDS[ev.id];
      if (card) floaty(heroEl, `${card.emoji} ${card.name}s +${ev.n}!`, 'formshift');
      sfx.powerUp();
      continue;
    }
    if (ev.t === 'pet') {
      // the battle buddy acted — announce it from its chip (pets are as legible
      // as enemy intents: nothing a pet does is invisible)
      const petEl = document.querySelector('.pet-chip') || heroEl;
      const pd = PETS[ev.pet];
      if (pd) {
        floaty(petEl, `${pd.emoji} ${pd.name}!`, 'formshift');
        if (petEl.classList) { petEl.classList.remove('proc'); void petEl.offsetWidth; petEl.classList.add('proc'); }
      }
      sfx.pop();
      continue;
    }
    if (ev.t === 'mystery') {
      const petEl = document.querySelector('.pet-chip') || heroEl;
      floaty(petEl, ev.roll === 'dmg' ? '🎁 → ⚔️!' : ev.roll === 'block' ? '🎁 → 🛡️!' : '🎁 → ❤️!', 'formshift');
      continue;
    }
    if (ev.t === 'orbblock') {
      const orbEl = s.querySelector && s.querySelector('.orb[data-orb="fresh"]');
      if (orbEl && heroEl) flingEmoji(orbEl, heroEl, '🩲');
      floaty(heroEl, `🩲 +${ev.amount} 🛡️`, 'blk');
      sawOrbBlock = true;
      continue;
    }
    if (ev.t === 'evoke') {
      const orbRow = s.querySelector && s.querySelector('.orb-row');
      const d = DIAPERS[ev.orb];
      if (orbRow && d) { floaty(orbRow, `${d.emoji} POP!`, 'heal'); if (ev.orb === 'blowout') sfx.boom(); else sfx.pop(); }
      continue;
    }
    const target = ev.target === 'hero' ? heroEl : enemyEls[ev.target];
    if (!target) continue;
    const hitIdx = delay / stagger;
    const srcFx = ev.src && SRC_FX[ev.src];
    const show = () => {
      if (ev.t === 'dmg') {
        if (srcFx) {
          // attributed tick: emoji-prefixed floaty in the source's color, the
          // source flings itself at the target, poison flashes the victim green
          let wait = 0;
          if (srcFx.fromOrb) {
            const orbEl = document.querySelector(`.orb[data-orb="${srcFx.fromOrb}"]`);
            wait = flingEmoji(orbEl, target, srcFx.ico);
          }
          setTimeout(() => {
            floaty(target, `${srcFx.ico} -${ev.amount}`, srcFx.cls + (ev.amount >= 12 ? ' big' : ''));
            target.classList.remove('shake'); void target.offsetWidth; target.classList.add('shake');
            if (srcFx.flash) { target.classList.remove(srcFx.flash); void target.offsetWidth; target.classList.add(srcFx.flash); }
            srcFx.sound();
          }, REDUCED ? 0 : wait);
        } else {
          floaty(target, `-${ev.amount}`, 'dmg' + (ev.amount >= 12 ? ' big' : ''));
          target.classList.remove('shake'); void target.offsetWidth; target.classList.add('shake');
          if (ev.target === 'hero') sfx.hurt();
          else if (ev.amount >= 15) sfx.boom();
          else if (ev.amount >= 8) sfx.slash();
          else sfx.slashTick(hitIdx);
        }
      } else if (ev.t === 'blocked') {
        floaty(target, '🛡️ Blocked!', 'blk');
        sfx.shieldClink();
      }
    };
    if (REDUCED || delay === 0) show();
    else setTimeout(show, delay);
    delay += stagger;
  }
  st.enemies.forEach((e, i) => {
    const elx = enemyEls[i];
    if (!elx) return;
    const p = prev.enemies[i];
    if (!p) {
      // No previous entry at this index = it just appeared. Splits are the only way
      // that happens mid-fight, so play the "peels off the parent" arrival.
      if (i >= prev.count) splitInFx(elx);
      return;
    }
    if (e.hp <= 0 && !p.dead) {
      elx.classList.add('dying');
      if (e.isBoss) {
        elx.classList.add('dying-boss');
        floaty(elx, '💥 DOWN!', 'formshift');
        sfx.bossDefeat();
        document.getElementById('app').classList.add('quake');
        setTimeout(() => document.getElementById('app').classList.remove('quake'), 900);
      } else {
        sfx.defeat();
      }
    }
    if (e.block > p.block) floaty(elx, `🛡️+${e.block - p.block}`, 'blk');
    // every silent tell announces itself (James, Sun 2026-08-03):
    if (e.hp > p.hp && !p.dead && e.artKey === p.artKey) {
      floaty(elx, `💚+${e.hp - p.hp}`, 'heal'); // possum nuzzles, any enemy heal
    }
    if ((e.strength || 0) > p.strength) {
      const gain = (e.strength || 0) - p.strength;
      floaty(elx, `💪+${gain}`, 'formshift'); // rallies, speeches, Inhale, FURY
      if ((e.key === 'boss_brownie' || e.key === 'boss_harmless') && gain >= 2) {
        elx.classList.add('fury-flash');
        floaty(elx, '👑 ROYAL FURY!', 'formshift');
        sfx.boom();
      }
    }
    if (p.debuffs - ((e.weak || 0) + (e.vulnerable || 0)) > 2) {
      floaty(elx, '😤 Shook it ALL off!', 'blk'); // a cleanse, not the natural tick-down
    }
    if (e.artKey !== p.artKey) {
      if (e.artKey === 'magnet_core') reformFx(elx, p.artKey, e.emoji); // THE SAND FALLS AWAY — the shed is the signature moment
      else formShiftFx(elx, p.artKey, e.emoji);
    } else if (e.name !== p.name) formShiftFx(elx, null, e.emoji); // split-in-place: same art, new identity
  });
  if (st.hero.hp > prev.heroHp) floaty(heroEl, `+${st.hero.hp - prev.heroHp}`, 'heal');
  if (!sawOrbBlock && st.hero.block > prev.heroBlock) floaty(heroEl, `🛡️+${st.hero.block - prev.heroBlock}`, 'blk');
  prevSnap = snapCombat(st);
}

let lastPulseTurn = -1;
function renderCombat(actedEnemy = null) {
  const s = screen(actCls());
  s.classList.add('combat');
  s.classList.remove('screen-enter'); // combat re-renders constantly; no re-entry flash
  const st = combat;
  // danger telegraph: under 25% HP the screen edges pulse red and a heartbeat
  // thumps once per turn — death should never arrive as a surprise
  if (st.hero.hp > 0 && st.hero.hp <= st.hero.maxHp * 0.25) {
    s.classList.add('danger');
    if (st.turn !== lastPulseTurn) { lastPulseTurn = st.turn; sfx.heartbeat(); }
  }
  s.appendChild(bgLayer(`assets/backgrounds/battle${run.act}.jpg`, 'battle-bg'));
  const inner = el('div', 'combat-inner');
  s.appendChild(inner);

  // enemies
  const row = el('div', 'enemy-row');
  const enemyEls = [];
  st.enemies.forEach((e, i) => {
    if (e.gone || (e.fled && fleeSeen.has(e))) { enemyEls[i] = null; return; }
    if (e.fled) { row.appendChild(fleeOutEl(e)); enemyEls[i] = null; return; }
    const dead = e.hp <= 0;
    const d = el('div', `enemy${dead ? ' dead' : ''}${e.isBoss ? ' boss-foe' : ''}${e.isElite && !e.isBoss ? ' elite-foe' : ''}`);
    // world-signature entrance, once per fight: sprout / hop / assemble / rise
    if (!st._spawnFxDone && !REDUCED) {
      d.classList.add(`spawn-w${Math.min(4, Math.max(1, run.act))}`);
      d.style.setProperty('--si', String(i));
    }
    if (!dead) {
      // Intent etiquette (James, Mon 2026-08-04): a telegraphed move VANISHES the
      // moment the enemy makes it, and the fresh telegraph waits for the start of
      // YOUR turn — mid-phase an acted enemy just shows "…", like StS.
      const spent = st.phase === 'enemy' && !st.queue.includes(e);
      d.insertAdjacentHTML('beforeend', spent
        ? '<div class="intent-slot"><span class="next-label">NEXT MOVE</span><span class="intent thinking">…</span></div>'
        : `<div class="intent-slot"><span class="next-label">NEXT MOVE</span>${intentLabel(st, e)}</div>`);
    }
    const face = artImg(`assets/enemies/${e.artKey}.jpg`, e.emoji, 'face');
    d.appendChild(face);
    d.insertAdjacentHTML('beforeend', `<div class="nm">${e.name}</div>
      <div class="hpbar"><div style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></div></div>
      <div class="hpnum">❤️ ${Math.max(0, e.hp)}/${e.maxHp}</div>
      <div class="chips">${statusChips(e)}</div>`);
    if (!dead && selectedCard && cardWantsTarget(selectedCard)) {
      d.classList.add('targetable');
      d.onclick = () => playSelected(e, d);
    } else if (!dead) {
      // Not aiming a card? Then a tap means "what IS this thing?" — Coach James scouts it.
      d.classList.add('scoutable');
      d.onclick = () => showScout(e);
    }
    if (e === actedEnemy) d.classList.add('lunge');
    row.appendChild(d);
    enemyEls[i] = d;
  });
  st._spawnFxDone = true; // entrances play exactly once per fight
  inner.appendChild(row);

  // floating diapers (Liam)
  if (st.hero.orbs && (st.hero.orbs.length || run.hero === 'liam')) {
    const orbRow = el('div', 'orb-row');
    for (const orb of st.hero.orbs) {
      const d = DIAPERS[orb.type];
      const val = orb.type === 'blowout' ? orb.stored
        : orb.type === 'stinky' ? d.passive + st.hero.focus
        : orb.type === 'fresh' ? d.passive + st.hero.focus
        : '⚡';
      const o = el('span', 'orb', `${d.emoji}<small>${val}</small>`);
      o.dataset.orb = orb.type;
      if (orb.type === 'blowout') o.dataset.stored = orb.stored;
      orbRow.appendChild(o);
    }
    for (let i = st.hero.orbs.length; i < st.hero.orbSlots; i++) {
      const o = el('span', 'orb empty', '◌');
      o.dataset.orb = 'empty';
      orbRow.appendChild(o);
    }
    if (orbRow.children.length) inner.appendChild(orbRow);
  }

  // hero strip
  const h = st.hero;
  const hero = HEROES[run.hero];
  const strip = el('div', 'hero-strip');
  strip.appendChild(artImg(`assets/ui/portrait_${run.hero}.jpg`, hero.emoji, 'face hero-face-combat'));
  const stats = el('div', 'stats');
  stats.innerHTML = `<b>${hero.name}</b>
      <div class="hpbar"><div style="width:${h.hp / h.maxHp * 100}%"></div></div>
      <div class="hpnum">❤️ ${h.hp}/${h.maxHp} ${h.block ? `· 🛡️ ${h.block}` : ''}</div>
      <div class="chips">${statusChips(h)}${powerChips(h)}</div>`;
  strip.appendChild(stats);
  const orb = el('div', 'energy-orb', `${h.energy}<small>⚡</small>`);
  strip.appendChild(orb);
  inner.appendChild(strip);

  // the battle buddy chip: the pet fights beside you, and telegraphs its next
  // move exactly like an enemy intent (pet legibility canon)
  if (st.petId && PETS[st.petId]) {
    const pd = PETS[st.petId];
    const chip = el('button', 'pet-chip');
    chip.appendChild(artImg(`assets/pets/${st.petId}.jpg`, pd.emoji, 'pet-face pet-face-sm'));
    chip.appendChild(el('span', 'pet-chip-txt', `<b>${pd.name}</b><br><span class="pet-intent">${petIntent(st.petId, st.turn + (st.phase === 'enemy' ? 1 : 0))}</span>`));
    chip.onclick = () => toast(`${pd.emoji} ${pd.name} — ${pd.companion.desc}`, 2600);
    inner.appendChild(chip);
  }

  // the belt: labeled FARM TREASURES right under the health bar —
  // pins jiggle when a treasure procs, so its work is visible (James's ask)
  const belt = el('div', 'belt-row');
  if (run.relics.length) {
    const relicGroup = el('div', 'belt-group belt-treasures');
    relicGroup.appendChild(el('div', 'belt-label', 'FARM TREASURES'));
    const pins = el('div', 'belt-pins');
    for (const rid of run.relics) {
      const rl = RELICS[rid];
      const pin = el('button', 'relic-pin belt-pin', rl.emoji);
      pin.dataset.relic = rid;
      pin.onclick = () => toast(`${rl.emoji} ${rl.name}: ${rl.text}`, 2600);
      pins.appendChild(pin);
    }
    relicGroup.appendChild(pins);
    belt.appendChild(relicGroup);
  }
  if (belt.children.length) inner.appendChild(belt);

  // hand (fanned)
  const hand = el('div', 'hand');
  const n = st.hand.length;
  st.hand.forEach((c, i) => {
    const info = cardInfo(c);
    const cost = C.effectiveCost(st, c);
    const afford = C.canPlay(st, c) && st.phase !== 'enemy';
    const d = el('div', `card type-${info.type} rarity-${info.rarity}${c === selectedCard ? ' selected' : ''}${afford ? '' : ' unaffordable'}${info.upgraded ? ' upgraded' : ''}`);
    d.innerHTML = `${cost === null ? '' : `<div class="cost">${cost === 'X' ? 'X' : cost}</div>`}
      <div class="art">${info.emoji}</div><div class="cnm">${info.name}</div><div class="ctx">${renderCardText(info)}</div>`;
    if (!REDUCED && n > 1) {
      const off = i - (n - 1) / 2;
      d.style.setProperty('--fan-rot', `${off * Math.min(4, 26 / n)}deg`);
      d.style.setProperty('--fan-y', `${Math.abs(off) * Math.min(3.4, 22 / n)}px`);
    }
    d.onclick = () => onCardTap(c, d);
    hand.appendChild(d);
  });
  inner.appendChild(hand);

  // targeting hint
  if (selectedCard && cardWantsTarget(selectedCard)) {
    inner.appendChild(el('div', 'target-hint', '🎯 Tap an enemy!'));
  }

  // bottom bar
  const bottom = el('div', 'combat-bottom');
  const drawB = el('button', 'pilebtn', `🎴 ${st.draw.length}`);
  drawB.onclick = () => showDeckModal(st.draw, 'Draw pile (shuffled)');
  const discB = el('button', 'pilebtn', `🗑️ ${st.discard.length}`);
  discB.onclick = () => showDeckModal(st.discard, 'Discard pile');
  bottom.append(drawB, discB);
  if (st.exhaust.length) {
    const exB = el('button', 'pilebtn', `♻️ ${st.exhaust.length}`);
    exB.onclick = () => showDeckModal(st.exhaust, 'Used up this fight (Exhaust)');
    bottom.append(exB);
  }
  const endB = el('button', 'endturn', st.phase === 'enemy' ? '👀 ENEMY TURN…' : 'END TURN ▶');
  endB.disabled = st.phase === 'enemy';
  endB.onclick = () => { sfx.turn(); selectedCard = null; runEnemyPhase(); };
  const infoB = el('button', 'pilebtn', 'ℹ️');
  infoB.onclick = showStuffModal;
  bottom.append(endB, infoB);
  inner.appendChild(bottom);

  animateDiffs(s, enemyEls, strip);

  if (st.pendingDiscard > 0) promptDiscard();
}

// sequenced, visible enemy turns: one enemy acts per beat
function runEnemyPhase() {
  if (!combat) return;
  if (!C.beginEnemyPhase(combat)) return;
  renderCombat();          // hand discards, button flips to ENEMY TURN
  const step = () => {
    if (!combat) return;
    if (combat.over) return afterAction();
    const actor = C.stepEnemyAction(combat);
    if (combat.over) {
      renderCombat(actor); // the last exit — a death, or the Squall blowing itself out — must play before victory
      return setTimeout(afterAction, REDUCED ? 0 : stepMs() + 250);
    }
    if (actor) {
      renderCombat(actor);
      setTimeout(step, stepMs());
    } else {
      renderCombat();      // new hero turn drawn
    }
  };
  setTimeout(step, REDUCED ? 0 : Math.round(stepMs() * 0.5));
}

// Fill {d}/{b}/{n} in card text. `live` applies current strength/dex/weak/frail
// previews — a modified number is highlighted green (boosted) or red (reduced),
// the StS trick that makes buffs *visibly* matter.
function cardText(info, live = false) {
  const fx = info.fx || [];
  const dmgOp = fx.find((o) => o.dmg != null);
  const blockOp = fx.find((o) => o.block != null);
  const nVal = nValue(info) ?? '?'; // resolution lives in cards.js so it's testable
  const mark = (liveVal, baseVal) => {
    if (!live || !combat || liveVal === baseVal) return liveVal;
    return `<b class="${liveVal > baseVal ? 'val-up' : 'val-down'}">${liveVal}</b>`;
  };
  const grownBonus = info.grows && live && combat ? (combat.grown[info.id] || 0) : 0;
  const dVal = dmgOp ? (live && combat ? mark(C.attackValue(dmgOp.dmg + grownBonus, combat.hero), dmgOp.dmg) : dmgOp.dmg) : (info.base ?? '?');
  const bVal = blockOp ? (live && combat ? mark(C.blockValue(blockOp.block, combat.hero), blockOp.block) : blockOp.block) : (info.pn ?? '?');
  let body = (info.text || '').replace('{d}', dVal).replace('{b}', bVal).replace('{n}', nVal);
  // Belly Flop's number IS your Block — show it live so the payoff is visible before the play
  if (dmgOp && dmgOp.dmgFromBlock && live && combat) {
    body += ` <b class="val-up">(${C.attackValue(dmgOp.dmg + combat.hero.block, combat.hero)} right now!)</b>`;
  }
  // "Innate" is invisible jargon on the card face, and a card can *become* innate on
  // upgrade (Ball Machine+), so spell it out here rather than in each card's text —
  // that way the line can never drift out of sync with the flag. Same treatment for
  // powers (James, Tue 2026-08-05): purple alone doesn't say the effect is permanent —
  // "Gain 3 Strength" on Pumped Up reads identical to Flex without this line.
  if (info.type === 'power') body += ' Lasts the whole fight!';
  return info.innate ? `${body} Starts in your opening hand.` : body;
}
function renderCardText(info) { return cardText(info, true); }

function cardWantsTarget(c) {
  return C.cardNeedsTarget(cardInfo(c)) && C.livingEnemies(combat).length > 1;
}

// the played card physically travels to what it affects — attacks fly at the
// enemy, skills/powers fly to YOU (cause-and-effect pass)
function flyCard(cardEl, targetEl) {
  if (REDUCED || !cardEl) return;
  const r = cardEl.getBoundingClientRect();
  const ghost = cardEl.cloneNode(true);
  ghost.classList.add('card-ghost');
  ghost.style.left = `${r.left}px`;
  ghost.style.top = `${r.top}px`;
  ghost.style.width = `${r.width}px`;
  let dx = 0, dy = -window.innerHeight * 0.45;
  if (targetEl) {
    const t = targetEl.getBoundingClientRect();
    dx = t.left + t.width / 2 - (r.left + r.width / 2);
    dy = t.top + t.height / 2 - (r.top + r.height / 2);
  }
  ghost.style.setProperty('--fly-x', `${dx}px`);
  ghost.style.setProperty('--fly-y', `${dy}px`);
  const ms = Math.round(520 * fxScale());
  ghost.style.transitionDuration = `${ms}ms`;
  document.body.appendChild(ghost);
  requestAnimationFrame(() => ghost.classList.add('fly'));
  setTimeout(() => ghost.remove(), ms + 40);
}

// every card family has a voice: single slash vs flurry ticks vs shield THUNK
// vs poison bubble vs power-up chord (damage itself sounds per-hit via events)
function playCardSound(info) {
  const fx = info.fx || [];
  if (info.type === 'power') return sfx.powerUp();
  if (fx.some((o) => o.channel) || ['double_trouble', 'uppies'].includes(info.special)) return sfx.pop();
  if (fx.some((o) => o.status && o.status.k === 'poison')) return sfx.poison();
  if (fx.some((o) => o.status && ['weak', 'vulnerable', 'frail'].includes(o.status.k)) && info.type !== 'attack') return sfx.debuff();
  if (fx.some((o) => o.block != null)) return sfx.shield();
  if (fx.some((o) => o.draw || o.energy)) return sfx.sparkle();
  if (info.type === 'attack') return; // per-hit sounds arrive with the damage events
  return sfx.play();
}

function onCardTap(c, cardEl) {
  if (combat.phase === 'enemy') return;
  if (!C.canPlay(combat, c)) {
    sfx.tap();
    const orb = document.querySelector('.energy-orb');
    if (orb) { orb.classList.remove('pulse'); void orb.offsetWidth; orb.classList.add('pulse'); }
    return;
  }
  if (cardWantsTarget(c)) {
    selectedCard = (selectedCard === c) ? null : c;
    renderCombat();
    return;
  }
  selectedCard = null;
  const info = cardInfo(c);
  playCardSound(info);
  const targetEl = info.type === 'attack'
    ? document.querySelector('.enemy:not(.dead)')
    : document.querySelector('.hero-strip');
  flyCard(cardEl, targetEl);
  const target = C.livingEnemies(combat)[0];
  C.playCard(combat, c, target);
  afterAction();
}

function playSelected(enemy, enemyEl) {
  const c = selectedCard;
  selectedCard = null;
  playCardSound(cardInfo(c));
  const selEl = document.querySelector('.card.selected');
  flyCard(selEl, enemyEl || document.querySelector('.enemy.targetable'));
  C.playCard(combat, c, enemy);
  afterAction();
}

function promptDiscard() {
  const fresh = new Set((combat.lastDrawn || []).length <= 2 ? combat.lastDrawn : []);
  const n = combat.pendingDiscard;
  modal(`Pick ${n > 1 ? n + ' cards' : 'a card'} to discard`, (m, close) => {
    if (fresh.size) m.appendChild(el('p', 'subtitle', '✨ = the card you just drew'));
    for (const c of combat.hand) {
      const info = cardInfo(c);
      const isNew = fresh.has(c.uid);
      const b = el('button', `btn secondary two-line${isNew ? ' just-drawn' : ''}`, `${isNew ? '✨ ' : ''}${info.emoji} ${info.name}<small>${cardText(info, false)}</small>`);
      b.onclick = () => { C.resolveDiscard(combat, c); close(); afterAction(); };
      m.appendChild(b);
    }
  }, { dismissable: false });
}

let winPending = false;
function afterAction() {
  if (!combat) return;
  if (combat.over) {
    if (combat.won) {
      // The killing blow used to jump straight to the reward screen, so the last
      // enemy's death animation never rendered — the fight just cut out. Render the
      // dying frame, let it play, THEN move on. (James: beating the final boss felt
      // abrupt.)
      if (winPending) return;
      winPending = true;
      renderCombat();
      const ms = REDUCED ? 0 : Math.round((combatKind === 'boss' ? 1900 : 900) * fxScale());
      setTimeout(() => { winPending = false; combatWon(); }, ms);
      return;
    }
    // The knockout beat: going down gets a moment too — the world drains gray,
    // the hero strip tips over, THEN the defeat screen fades in. (James: the
    // cut to defeat was abrupt.)
    if (winPending) return;
    winPending = true;
    renderCombat();
    sfx.lose();
    const app = document.getElementById('app');
    if (!REDUCED) app.classList.add('ko');
    const koMs = REDUCED ? 0 : Math.round(1600 * fxScale());
    setTimeout(() => {
      winPending = false;
      app.classList.remove('ko');
      fadeOutThen(showDefeat);
    }, koMs);
    return;
  }
  renderCombat();
}

function combatWon() {
  sfx.win();
  const st = combat;
  combat = null;
  prevSnap = null;
  const result = R.applyCombatResult(run, st);
  const rng = makeRng(run.seed ^ (run.act * 31 + run.floor * 7) ^ 0x5EED);
  const rewards = R.fightRewards(run, combatKind, rng);
  run.gold += rewards.gold;
  saveRun();
  if (combatKind === 'boss') {
    const bossName = st.enemies.filter((e) => e.isBoss).map((e) => e.name).join(' & ') || 'THE BOSS';
    // RL3: every boss win ends the expedition — no card reward (you'd pick a
    // card and immediately go home). World 4 rolls the anthem credits first;
    // duck worlds go splash → settlement (where pets + coins bank).
    if (run.act >= R.WORLDS) fadeOutThen(() => showBossSplash(bossName, showVictory));
    else {
      const thenPet = rewards.pet ? (fn) => () => showPetPop(rewards.pet, fn) : (fn) => fn;
      fadeOutThen(() => showBossSplash(bossName, thenPet(() => showRunEnd(true))));
    }
  } else if (combatKind === 'elite' && rewards.relic) {
    const rid = rewards.relic;
    rewards.relic = null;
    rewards.relicCollected = rid;
    run.relics.push(rid);
    coachTip('relic', 'Farm Treasures work the whole run. Collect them!');
    const thenPet = (fn) => (rewards.pet ? () => showPetPop(rewards.pet, fn) : fn);
    fadeOutThen(() => showVictoryBeat(st, 'elite', thenPet(() => showRelicPop(rid, () => showReward(rewards, result, 'elite')))));
  } else {
    const thenPet = (fn) => (rewards.pet ? () => showPetPop(rewards.pet, fn) : fn);
    fadeOutThen(() => showVictoryBeat(st, combatKind, thenPet(() => showReward(rewards, result, combatKind))));
  }
}

// the battlefield fades instead of vanishing (James: wins felt abrupt)
function fadeOutThen(fn) {
  const cur = document.querySelector('.screen');
  if (REDUCED || !cur) return fn();
  cur.classList.add('screen-fade-out');
  setTimeout(fn, Math.round(480 * fxScale()));
}

// Coach James takes a beat after every won fight: congrats + one tip from
// the rotating library (loading-screen wisdom, built up over many runs)
const BEAT_LINES = [
  (n) => `Nice work! ${n} won't bother the farm for a while.`,
  (n) => `THAT'S how it's done. ${n}? Handled.`,
  (n) => `The farm saw that! ${n} is done for the day.`,
];
let beatLineIdx = 0;
function showVictoryBeat(st, kind, onDone) {
  const named = st.enemies.filter((e) => !e.gone).map((e) => e.name);
  const label = named.length > 1 ? `${named[0]} & friends` : (named[0] || 'That troublemaker');
  const s = screen(actCls());
  s.classList.add('victory-beat');
  s.appendChild(artImg('assets/ui/portrait_coach.jpg', '🧢', 'scene-art'));
  s.appendChild(el('h2', '', kind === 'elite' ? '💀 Big Trouble — beaten!' : 'Nice work!'));
  s.appendChild(el('div', 'speaker-line', `"${BEAT_LINES[beatLineIdx++ % BEAT_LINES.length](label)}"`));
  s.appendChild(el('div', 'tip-card', `💡 <b>Coach's tip:</b> ${nextTip(run.hero)}`));
  const b = el('button', 'btn gold', '🎉 Collect your rewards →');
  b.onclick = onDone;
  s.appendChild(b);
}

// the act boss goes down: fanfare, confetti, THEN the loot
function showBossSplash(bossName, onDone) {
  music.play('victory');
  const s = screen(actCls());
  s.classList.add('boss-splash');
  if (!REDUCED) {
    const confetti = el('div', 'confetti-layer');
    for (let i = 0; i < 60; i++) {
      const c = el('span', 'confetto', ['🎉', '🎊', '⭐', '🌾', '🦆'][i % 5]);
      c.style.left = `${(i * 137) % 100}%`;
      c.style.animationDelay = `${(i % 20) * 0.14}s`;
      c.style.fontSize = `${0.8 + (i % 4) * 0.28}rem`;
      confetti.appendChild(c);
    }
    s.appendChild(confetti);
  }
  s.appendChild(el('div', 'crown', '👑'));
  s.appendChild(el('h1', 'splash-big', 'BOSS DEFEATED!'));
  s.appendChild(el('div', 'speaker-line', `<b>${bossName}</b> won't be bothering the farm again.`));
  const b = el('button', 'btn gold', '🎉 Collect your rewards →');
  b.onclick = onDone;
  s.appendChild(b);
}

// a Farm Treasure deserves a moment, not a toast
function showRelicPop(relicId, onDone) {
  const rl = RELICS[relicId];
  sfx.relic();
  modal(null, (m, close) => {
    m.classList.add('treasure-pop');
    m.appendChild(el('div', 'crown', '👑'));
    m.appendChild(el('h2', '', 'FARM TREASURE!'));
    m.appendChild(el('div', 'treasure-emoji', rl.emoji));
    m.appendChild(el('h2', 'treasure-name', rl.name));
    m.appendChild(el('p', 'subtitle', rl.text));
    const b = el('button', 'btn gold', 'WHOA! →');
    b.onclick = () => { close(); onDone(); };
    m.appendChild(b);
  }, { dismissable: false });
}

// the story cards at each world's gate (copy pending James's word pass — REVIEW.md)
const ACT_CARDS = {
  1: { sub: 'The crops have gone WEIRD.', line: 'Corn with attitude, pumpkins on patrol — and Brownie rules it all!' },
  2: { sub: 'A meadow full of critters nobody has ever seen.', line: 'They are adorable. They are feisty. Diver guards the pond!' },
  3: { sub: 'An entire world built brick by brick.', line: 'Watch your step. Seriously. And Harmless is NOT harmless!' },
  4: { sub: 'The sand shifts. Something hums beneath it.', line: 'The Magnet Menace is real. This is the big one!' },
};

function showActCard(act, onDone) {
  const info = R.WORLD_INFO[act];
  const card = ACT_CARDS[act];
  const s = screen(`act-${act}`);
  s.classList.add('act-card');
  s.appendChild(bgLayer(`assets/backgrounds/actcard${act}.jpg`, 'battle-bg'));
  const inner = el('div', 'act-card-inner');
  inner.appendChild(el('div', 'act-card-kicker', `WORLD ${act}`));
  inner.appendChild(el('div', 'event-emoji', info.emoji));
  inner.appendChild(el('h1', 'act-card-name', info.name.toUpperCase()));
  inner.appendChild(el('p', 'act-card-sub', card.sub));
  inner.appendChild(el('div', 'speaker-line', card.line));
  const b = el('button', 'btn gold', act === 1 ? '🌱 Let\'s go!' : '💪 Onward!');
  b.onclick = onDone;
  inner.appendChild(b);
  s.appendChild(inner);
}

// ---------- rewards ----------
function showReward(rewards, result, kind) {
  const s = screen(actCls());
  s.appendChild(el('h2', '', kind === 'boss' ? '👑 BOSS DEFEATED!' : kind === 'elite' ? '💀 BIG Trouble — beaten!' : '🎉 You did it!'));
  // Aaron's pancakes visibly do their work after every fight (James's ask)
  if (result.breakfastHeal != null) {
    const gained = result.breakfastHeal > 0
      ? `❤️ +${result.breakfastHeal} → ${run.hp}/${run.maxHp}`
      : `❤️ ${run.hp}/${run.maxHp} — already stuffed!`;
    s.appendChild(el('div', 'bf-banner', `🥞 <b>Big Breakfast!</b> <span class="bf-heal">${gained}</span>`));
    if (result.breakfastHeal > 0) sfx.heal();
  }
  if (rewards.relicCollected) {
    const rl = RELICS[rewards.relicCollected];
    s.appendChild(el('p', 'subtitle', `✅ ${rl.emoji} <b>${rl.name}</b> collected!`));
  }
  if (result.goldLost) s.appendChild(el('p', 'subtitle', `😤 The thief got away with 💰${result.goldLost}…`));
  s.appendChild(el('p', 'subtitle', `+💰 ${rewards.gold} gold`));
  if (rewards.relic) {
    const rl = RELICS[rewards.relic];
    s.appendChild(el('div', 'speaker-line', `${rl.emoji} <b>${rl.name}</b> — ${rl.text}`));
    run.relics.push(rewards.relic);
    coachTip('relic', 'Farm Treasures work the whole run. Collect them!');
  }
  if (rewards.cards.length) {
    s.appendChild(el('p', 'subtitle', '<b>Pick a new card:</b>'));
    const row = el('div', 'reward-row');
    for (const id of rewards.cards) {
      const d = miniCard(cardInfo(makeCard(id)));
      d.onclick = () => { sfx.play(); run.deck.push(makeCard(id)); finishReward(kind); };
      row.appendChild(d);
    }
    s.appendChild(row);
  }
  const skip = el('button', 'btn secondary', 'Skip the cards →');
  skip.onclick = () => finishReward(kind);
  s.appendChild(skip);
}

function finishReward(kind) {
  // (boss wins never reach here in RL3 — the expedition ends at the splash)
  saveRun();
  showMap();
}

// ---------- shop / rest / event / treasure ----------
function showShop(shop) {
  const s = sceneScreen('assets/events/shop_jacob.jpg', '🛒', "Dad's Farm Supply");
  s.appendChild(el('div', 'speaker-line', '"Hey bud. Take a look around — everything a farm defender needs."'));
  s.appendChild(el('p', 'subtitle gold-line', `Your gold: 💰 <b>${run.gold}</b>`));
  if (shop.cards.length) {
    const row = el('div', 'reward-row');
    shop.cards.forEach((item, i) => {
      const d = miniCard(cardInfo(makeCard(item.id)), { price: item.price });
      if (run.gold < item.price) d.classList.add('cant-afford');
      else d.onclick = () => { if (R.shopBuyCard(run, shop, i)) { sfx.gold(); saveRun(); showShop(shop); } };
      row.appendChild(d);
    });
    s.appendChild(row);
  }
  shop.relics.forEach((item, i) => {
    const rl = RELICS[item.id];
    const b = el('button', 'btn gold two-line', `${rl.emoji} ${rl.name} — 💰${item.price}<small>${rl.text}</small>`);
    b.disabled = run.gold < item.price;
    b.onclick = () => { if (R.shopBuyRelic(run, shop, i)) { sfx.relic(); saveRun(); showShop(shop); } };
    s.appendChild(b);
  });
  if (!shop.removed) {
    const b = el('button', 'btn secondary', `✂️ Remove a card from your deck — 💰${shop.removePrice}`);
    b.disabled = run.gold < shop.removePrice;
    b.onclick = () => pickCardModal('Remove which card?', run.deck, (c) => {
      if (R.shopRemoveCard(run, shop, c.uid)) { sfx.play(); toast('Card removed!'); saveRun(); showShop(shop); }
    });
    s.appendChild(b);
  }
  const done = el('button', 'btn', 'Thanks, Dad! →');
  done.onclick = () => { saveRun(); showMap(); };
  s.appendChild(done);
}

function showRest() {
  const s = sceneScreen('assets/events/rest_granny.jpg', '🍪', "Granny Rockie's Porch");
  s.appendChild(el('div', 'speaker-line', '"There\'s my little legend. Cookies, practice that one move — or want me to keep something safe for you?"'));
  const cookies = el('button', 'btn', `🍪 Cookies (heal ${Math.floor(run.maxHp * 0.3)} HP)`);
  cookies.onclick = () => { sfx.heal(); const h = R.restCookies(run); toast(`❤️ +${h} HP. Granny hugs you.`); saveRun(); showMap(); };
  s.appendChild(cookies);
  const canUp = upgradableCards(run.deck).length > 0;
  const practice = el('button', 'btn gold', '⭐ Practice (upgrade a card)');
  practice.disabled = !canUp;
  practice.onclick = () => upgradePickModal(upgradableCards(run.deck), (c) => {
    if (R.restPractice(run, c.uid)) { sfx.relic(); toast(`⭐ ${CARDS[c.id].name}+ learned!`, 2400); saveRun(); showMap(); }
  });
  s.appendChild(practice);
  const store = el('button', 'btn secondary', "🏠 Store a card at Granny's (out of your deck for good)");
  store.disabled = run.deck.length <= 1;
  store.onclick = () => pickCardModal('Granny will keep which card safe?', run.deck, (c) => {
    if (R.restStore(run, c.uid)) { sfx.play(); toast(`🏠 ${CARDS[c.id].name} is safe on Granny's shelf.`, 2400); saveRun(); showMap(); }
  });
  s.appendChild(store);
}

function showEvent(key) {
  const ev = EVENTS[key];
  const s = sceneScreen(`assets/events/${key}.jpg`, ev.emoji, ev.name);
  s.appendChild(el('div', 'speaker-line', ev.line));
  const rng = makeRng(run.seed ^ run.floor * 991 ^ 0xE1E);
  const choicesWrap = el('div', 'event-choices');
  s.appendChild(choicesWrap);
  // HP / max-HP / gold changes play out on the status strip before you leave —
  // numbers re-render with a pulse and a combat-style floaty (James's ask)
  let before = null;
  const statFx = () => {
    const strip = s.querySelector('.scene-status');
    if (!strip || !before) return;
    const dMax = run.maxHp - before.maxHp, dHp = run.hp - before.hp, dGold = run.gold - before.gold;
    before = null;
    const tick = (sel, text, cls) => {
      const t = strip.querySelector(sel);
      if (!t) return;
      t.textContent = text;
      if (cls && !REDUCED) { t.classList.remove('stat-bump', 'stat-drop'); void t.offsetWidth; t.classList.add(cls); }
    };
    tick('.stat-hp', `❤️ ${run.hp}/${run.maxHp}`, (dHp || dMax) ? (dHp < 0 ? 'stat-drop' : 'stat-bump') : null);
    tick('.stat-gold', `💰 ${run.gold}`, dGold ? (dGold < 0 ? 'stat-drop' : 'stat-bump') : null);
    // each floaty rises from its own stat, not a random spot on the strip
    const over = (sel) => {
      const t = strip.querySelector(sel);
      return t ? Math.max(0, (t.offsetLeft + t.offsetWidth / 2) / strip.offsetWidth * 100 - 9) : undefined;
    };
    if (dMax > 0) { floaty(strip, `❤️ MAX HP +${dMax}!`, 'formshift', over('.stat-hp')); sfx.heal(); }
    else if (dHp > 0) { floaty(strip, `❤️ +${dHp}`, 'heal', over('.stat-hp')); sfx.heal(); }
    if (dHp < 0) { floaty(strip, `💔 ${dHp}`, 'dmg', over('.stat-hp')); sfx.hurt(); }
    if (dGold > 0) floaty(strip, `💰 +${dGold}`, 'formshift', over('.stat-gold'));
    else if (dGold < 0) floaty(strip, `💰 ${dGold}`, 'dmg', over('.stat-gold'));
  };
  // the outcome replaces the choices RIGHT HERE on the event screen — the kid
  // sees what happened where it happened, then moves on (James's ask)
  const conclude = (html) => {
    saveRun();
    choicesWrap.innerHTML = '';
    choicesWrap.appendChild(el('div', 'event-result', html));
    statFx();
    const b = el('button', 'btn', 'Onward! →');
    b.onclick = showMap;
    choicesWrap.appendChild(b);
  };
  for (const choice of ev.choices) {
    const b = el('button', 'btn', choice.label);
    if (choice.can && !choice.can(run)) b.disabled = true;
    b.onclick = () => {
      sfx.tap();
      before = { hp: run.hp, maxHp: run.maxHp, gold: run.gold };
      const result = choice.apply(run, rng);
      if (result === 'PICK_CURSE') {
        // show the kid exactly which cards are junk, and let them toss one
        const junk = run.deck.filter((c) => CARDS[c.id].type === 'curse');
        return pickCardModal('Which useless card should we toss?', junk, (c) => {
          const i = run.deck.findIndex((x) => x.uid === c.uid);
          if (i >= 0) run.deck.splice(i, 1);
          conclude(`${CARDS[c.id].emoji} <b>${CARDS[c.id].name}</b>? Gone. You feel lighter already.`);
        });
      }
      if (result === 'PICK_UPGRADE' || run.pendingUpgrade) {
        // Brody's garage uses Granny's Practice picker: choose the card yourself,
        // see before/after side by side, then confirm (James's ask).
        run.pendingUpgrade = false;
        return upgradePickModal(upgradableCards(run.deck), (c) => {
          c.up = true;
          const info = cardInfo(c);
          conclude(`${info.emoji} <b>${info.name}</b> — souped UP. "Told ya," says Brody.`);
        });
      }
      if (result === 'PICK_CARD' || run.pendingRemove) {
        run.pendingRemove = false;
        return pickCardModal('Let go of which card?', run.deck, (c) => {
          const i = run.deck.findIndex((x) => x.uid === c.uid);
          if (i >= 0) run.deck.splice(i, 1);
          conclude(`${CARDS[c.id].emoji} <b>${CARDS[c.id].name}</b> is gone. You feel lighter.`);
        });
      }
      // a relic from an event (Goldie's Gate, the Pie Contest) gets the same big
      // FARM TREASURE reveal as Rusty and elite drops — not a raw id in prose
      if (run.pendingRelicPop) {
        const rid = run.pendingRelicPop;
        run.pendingRelicPop = null;
        return showRelicPop(rid, () => conclude(result));
      }
      conclude(result);
    };
    choicesWrap.appendChild(b);
  }
}

function showTreasure(relicId) {
  const s = sceneScreen('assets/events/treasure_rusty.jpg', '🐕', 'Here comes Rusty!');
  if (relicId) {
    // two beats: the tease, then the big pulsing FARM TREASURE reveal —
    // same ritual as elite/boss drops (James: treasure rooms should feel cooler)
    s.appendChild(el('div', 'speaker-line', 'He trots up, tail wagging like mad — there\'s something in his mouth, and he is VERY proud of it.'));
    const b = el('button', 'btn gold', '🎁 What did you bring?!');
    b.onclick = () => {
      coachTip('relic', 'Farm Treasures work the whole run. Collect them!');
      showRelicPop(relicId, () => {
        toast('🐕 GOOD BOY, Rusty!', 2200);
        saveRun();
        showMap();
      });
    };
    s.appendChild(b);
  } else {
    s.appendChild(el('div', 'speaker-line', 'He trots up, tail wagging. It\'s… a very good stick. He keeps it. Good boy anyway.'));
    const b = el('button', 'btn', 'Good boy!! →');
    b.onclick = () => { saveRun(); showMap(); };
    s.appendChild(b);
  }
}

// ---------- deck & card pickers ----------
function showDeckModal(cards, title = 'My Deck') {
  modal(`${title} (${cards.length})`, (m) => {
    if (!cards.length) m.appendChild(el('p', 'subtitle', '(empty)'));
    for (const c of cards) {
      const info = cardInfo(c);
      const cost = info.cost === null ? '—' : (info.cost === 'X' ? 'X⚡' : `${info.cost}⚡`);
      m.appendChild(el('p', 'deck-line', `<span class="deck-cost">${cost}</span> ${info.emoji} <b>${info.name}${c.up ? '+' : ''}</b> <span style="opacity:.7;font-size:.8rem">${cardText(info, false)}</span>`));
    }
  });
}

// ---------- "what's all this?" — inspect + glossary (tap, not hover) ----------
function showStuffModal() {
  modal('🎒 Your stuff', (m, close) => {
    m.appendChild(el('p', 'subtitle', '<b>Farm Treasures</b>'));
    for (const rid of run.relics) {
      const rl = RELICS[rid];
      m.appendChild(el('p', 'deck-line', `${rl.emoji} <b>${rl.name}</b> <span style="opacity:.75;font-size:.8rem">${rl.text}</span>`));
    }
    const help = el('button', 'btn secondary', '📖 What do the words mean?');
    help.onclick = () => { close(); showHelpModal(); };
    m.appendChild(help);
  });
}

const KEYWORD_INFO = [
  ['⚡ Energy', 'Cards cost ⚡ to play. You get 3 fresh ⚡ every turn.'],
  ['♻️ One use per fight', 'After you play it, that card is used up until the NEXT fight.'],
  ['✋ Starts in your opening hand', 'That card is always there on turn 1.'],
  ['❎ X cost', 'Spends ALL your ⚡ — the more you spend, the bigger it gets.'],
  ['🎯 Intent bubble', "The bubble under each enemy shows its NEXT move. ⚔️ + a number = how hard it'll hit you."],
];

function showHelpModal() {
  modal('📖 How to read the game', (m) => {
    m.appendChild(el('p', 'subtitle', '<b>Map stops</b>'));
    for (const [type, meta] of Object.entries(NODE_META)) {
      m.appendChild(el('p', 'deck-line', `${meta.ico} <b>${meta.name}</b> <span style="opacity:.75;font-size:.8rem">${meta.desc}</span>`));
    }
    m.appendChild(el('p', 'subtitle', '<b>Words on cards</b>'));
    for (const [k, v] of KEYWORD_INFO) {
      m.appendChild(el('p', 'deck-line', `<b>${k}</b> <span style="opacity:.75;font-size:.8rem">${v}</span>`));
    }
    m.appendChild(el('p', 'subtitle', '<b>Buffs & debuffs (tap any icon in a fight!)</b>'));
    for (const v of Object.values(STATUS_INFO)) {
      m.appendChild(el('p', 'deck-line', `<span style="font-size:.85rem">${v}</span>`));
    }
    // the secret hero's kit — only ever shown while playing him (zero-hint rule)
    if (run && run.hero === 'liam') {
      m.appendChild(el('p', 'subtitle', '<b>Liam\'s floating diapers (tap one in a fight!)</b>'));
      m.appendChild(el('p', 'deck-line', '💩 <b>Stinky</b> <span style="opacity:.75;font-size:.8rem">zaps a random enemy every turn; pops for a big zap</span>'));
      m.appendChild(el('p', 'deck-line', '🩲 <b>Fresh</b> <span style="opacity:.75;font-size:.8rem">blocks for Liam every turn; pops for big Block</span>'));
      m.appendChild(el('p', 'deck-line', '🌋 <b>THE BLOWOUT</b> <span style="opacity:.75;font-size:.8rem">grows every turn… pops ALL AT ONCE on the weakest enemy</span>'));
      m.appendChild(el('p', 'deck-line', '🧃 <b>Snack Time</b> <span style="opacity:.75;font-size:.8rem">+1 ⚡ every turn it floats</span>'));
      m.appendChild(el('p', 'deck-line', '😆 <b>Giggle Power</b> <span style="opacity:.75;font-size:.8rem">makes every diaper stronger; diapers pop oldest-first when full</span>'));
    }
  });
}
function pickCardModal(title, cards, onPick) {
  modal(title, (m, close) => {
    for (const c of cards) {
      const info = cardInfo(c);
      const b = el('button', 'btn secondary two-line', `${info.emoji} ${info.name}${c.up ? '+' : ''}<small>${cardText(info, false)}</small>`);
      b.onclick = () => { close(); onPick(c); };
      m.appendChild(b);
    }
  });
}

// Granny's Practice: pick a card, SEE current vs upgraded side by side,
// then confirm or go back — no more upgrading from memory (James's ask)
function upgradePickModal(cards, onConfirm) {
  modal(null, (m, close) => {
    const showList = () => {
      m.innerHTML = '';
      m.appendChild(el('h2', '', '⭐ Practice which move?'));
      for (const c of cards) {
        const info = cardInfo(c);
        const b = el('button', 'btn secondary two-line', `${info.emoji} ${info.name}<small>${cardText(info, false)}</small>`);
        b.onclick = () => showCompare(c);
        m.appendChild(b);
      }
    };
    const showCompare = (c) => {
      m.innerHTML = '';
      m.appendChild(el('h2', '', '⭐ Practice makes perfect'));
      const row = el('div', 'upgrade-compare');
      row.appendChild(miniCard(cardInfo(c), { extraCls: 'up-before' }));
      row.appendChild(el('div', 'up-arrow', '➜'));
      row.appendChild(miniCard(cardInfo({ id: c.id, up: true, uid: c.uid }), { extraCls: 'up-after' }));
      m.appendChild(row);
      const yes = el('button', 'btn gold', '⭐ Practice this one!');
      yes.onclick = () => { close(); onConfirm(c); };
      const back = el('button', 'btn secondary', '← Pick a different card');
      back.onclick = showList;
      m.append(yes, back);
    };
    showList();
  });
}

// ---------- endings ----------
// what a src-only death (no enemy attacker) gets called on the defeat screen
const KILLER_SRC = {
  poison: { name: 'Sneaky poison', emoji: '☠️' },
  thorns: { name: 'Prickly spikes', emoji: '🌵' },
  constrict: { name: 'The rising water', emoji: '🌊' },
  effort: { name: 'Pure effort', emoji: '😮‍💨' },
  hailstone: { name: 'A hailstone', emoji: '🧊' },
  storm: { name: 'The storm', emoji: '🌩️' },
};

function showDefeat() {
  releaseScreen();
  music.play('title');
  const st = combat; combat = null;
  prevSnap = null;
  const s = screen('plain');
  // dusted-but-okay hero art (per hero; 🌧️ until the painting lands)
  s.appendChild(artImg(`assets/ui/ko_${run.hero}.jpg`, '🌧️', 'scene-art ko-art'));
  s.appendChild(el('h2', '', 'The farm needs you to rest up…'));
  // the culprit's wanted-poster chip + a tiny run recap
  const k = st && st.killedBy;
  if (k) {
    const info = k.name ? k : (KILLER_SRC[k.src] || KILLER_SRC.storm);
    const chip = el('div', 'killer-chip');
    chip.appendChild(artImg(k.artKey ? `assets/enemies/${k.artKey}.jpg` : 'assets/none.jpg', info.emoji, 'killer-face'));
    chip.appendChild(el('div', 'killer-name', `taken down by<br><b>${info.name.toUpperCase()}</b>`));
    s.appendChild(chip);
  }
  s.appendChild(el('p', 'subtitle recap-line', `World ${run.act} · Floor ${run.floor} · ⚔️ ${run.stats.fights} fights won`));
  s.appendChild(el('div', 'speaker-line', `"${nextLossLine()}" — Coach James`));
  // Runs end, progress doesn't: coins + pets bank on the way home
  const b = el('button', 'btn', '🏡 Head home');
  b.onclick = () => showRunEnd(false);
  s.appendChild(b);
}

function showVictory() {
  // World 4 conquered — THE game victory. Settle FIRST (credits are long;
  // closing the tab mid-anthem must never lose the banked run), then roll.
  const heroId = run.hero;
  const p = loadProfile();
  const firstWin = !(p.wins[heroId] > 0);
  p.wins[heroId] = (p.wins[heroId] || 0) + 1;
  saveProfile(p);
  const settled = settleExpedition(true);
  // THE CROWN — first win per hero rolls the synced-lyric anthem credits;
  // winning with ALL THREE Legends unlocks the bonus finale on top.
  const allNow = p.wins.aaron > 0 && p.wins.wyatt > 0 && p.wins.liam > 0 && !p.bonusSeen;
  if (allNow) prefetch(['assets/audio/anthem_all.mp3', 'assets/audio/anthem_all.lrc']); // the finale follows — have it ready
  const rollBonus = () => {
    if (allNow) {
      p.bonusSeen = true;
      saveProfile(p);
      creditsRoll('all', { el, artImg, sfx, REDUCED }, () => showCrownScreen(heroId, settled));
    } else {
      showCrownScreen(heroId, settled);
    }
  };
  if (firstWin) creditsRoll(heroId, { el, artImg, sfx, REDUCED }, rollBonus);
  else rollBonus();
}

function showCrownScreen(heroId, settled) {
  const p = loadProfile();
  music.play(`anthem_${heroId}`);
  const s = screen('act-1');
  s.appendChild(el('div', 'crown', '👑'));
  s.appendChild(el('h1', '', 'THE WEIRDOS ARE BEATEN!'));
  const VICTORY_LINES = {
    wyatt: '"The Magnet threw everything it had — and hit nothing but breeze. WYATT THE SPEEDY — Legend of the Worlds!" 🧲⚡',
    aaron: '"The sand fell. The Magnet stared. Aaron stared back harder. AARON THE STRONG!" 🧲💪',
    liam: '"The Magnet Menace pulled with all its might… and got a diaper stuck to it. LIAM THE LITTLE!" 🧲🍼',
  };
  s.appendChild(el('div', 'speaker-line', VICTORY_LINES[heroId]));
  if (p.wins.aaron > 0 && p.wins.wyatt > 0 && p.wins.liam > 0) {
    s.appendChild(el('div', 'speaker-line', '🏆 <b>ALL THREE LEGENDS HAVE BEATEN THE WORLDS!</b><br>Rusty barks twice. The ducks quack in salute. The barn has never been prouder.'));
  }
  const again = el('button', 'btn secondary', '🎬 Watch your credits again');
  again.onclick = () => creditsRoll(heroId, { el, artImg, sfx, REDUCED }, () => showCrownScreen(heroId, settled));
  s.appendChild(again);
  if (p.wins.wyatt > 0 && p.wins.aaron > 0 && p.wins.liam > 0) {
    const allBtn = el('button', 'btn secondary', '👑👑👑 Watch the triple-legend finale');
    allBtn.onclick = () => creditsRoll('all', { el, artImg, sfx, REDUCED }, () => showCrownScreen(heroId, settled));
    s.appendChild(allBtn);
  }
  const b = el('button', 'btn gold', '🚜 Back to the Farm');
  b.onclick = () => (settled ? renderSettlement(settled) : showFarm());
  s.appendChild(b);
}

// ---------- boot ----------
music.arm();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
// phones held sideways: gentle rotate ask (pure CSS visibility; tablets unaffected)
{
  const rh = document.createElement('div');
  rh.className = 'rotate-hint';
  rh.innerHTML = '<span class="rh-icon">📱</span>Turn your screen tall-ways to play!';
  document.body.appendChild(rh);
}

// tap-to-explain, everywhere (kids can't hover): status chips, intent bubbles,
// the energy orb
document.addEventListener('click', (ev) => {
  if (ev.target.closest && ev.target.closest('.enemy.targetable')) return; // targeting taps = attacks, not tooltips
  const chip = ev.target.closest && ev.target.closest('.chip[data-status]');
  if (chip && STATUS_INFO[chip.dataset.status]) {
    toast(STATUS_INFO[chip.dataset.status], 2800);
    markFxSeen(chip.dataset.status);
    document.querySelectorAll(`.chip[data-status="${chip.dataset.status}"]`).forEach((c) => c.classList.remove('chip-new'));
    return;
  }
  const pchip = ev.target.closest && ev.target.closest('.chip[data-power]');
  if (pchip && combat && POWER_INFO[pchip.dataset.power]) {
    const v = combat.hero.powers[pchip.dataset.power];
    toast(POWER_INFO[pchip.dataset.power].text(v), 3000);
    markFxSeen('p_' + pchip.dataset.power);
    document.querySelectorAll(`.chip[data-power="${pchip.dataset.power}"]`).forEach((c) => c.classList.remove('chip-new'));
    return;
  }
  const it = ev.target.closest && ev.target.closest('.intent[data-intent]');
  if (it) {
    const kind = it.dataset.intent;
    const fn = INTENT_KIND_INFO[kind];
    if (fn) toast(fn(it.dataset.name || 'its move', it.dataset.dmg || ''), 3200);
    return;
  }
  const orb = ev.target.closest && ev.target.closest('.energy-orb');
  if (orb) { toast('⚡ Energy: playing cards costs ⚡. You get 3 fresh ⚡ every turn.', 2800); return; }
  const diaper = ev.target.closest && ev.target.closest('.orb[data-orb]');
  if (diaper && combat) {
    const f = combat.hero.focus;
    const g = f > 0 ? ` (Giggle Power +${f}!)` : '';
    const TEXTS = {
      stinky: `💩 Stinky Diaper: every turn its smell zaps a random enemy for ${3 + f}${g}. When it pops: ${8 + f} damage!`,
      fresh: `🩲 Fresh Diaper: every turn it wraps Liam in ${3 + f} Block${g}. When it pops: ${6 + f} Block!`,
      blowout: `🌋 THE BLOWOUT: it grows +${6 + f} bigger every turn${g} — it's at ${diaper.dataset.stored || 0} now. When it pops: ALL of it hits the weakest enemy. KA-BOOM.`,
      snack: `🧃 Snack Time: +1 ⚡ every turn while it floats. When it pops: +2 ⚡.`,
      empty: `◌ An empty diaper slot. Cards like Change It! float a new diaper here. When they're all full, the OLDEST one pops to make room.`,
    };
    if (TEXTS[diaper.dataset.orb]) toast(TEXTS[diaper.dataset.orb], 3400);
  }
});
// #credits-<hero> previews an ending anytime (dev/testing; harmless for kids)
const creditsPreview = /^#credits-(wyatt|aaron|liam|all)$/.exec(location.hash);
if (creditsPreview) creditsRoll(creditsPreview[1], { el, artImg, sfx, REDUCED }, () => showTitle());
else showTitle();

// e2e/debug handle (+ dev screen-jumps for tests/screenshots — harmless in play)
window.__RL2 = {
  get run() { return run; }, get combat() { return combat; }, get wakeHeld() { return !!wakeLock; }, R, C, showTitle,
  get farm() { return farm; },
  reloadFarm() { farm = F.deserializeFarm(localStorage.getItem(FARM_KEY)) || F.newFarm(); },
  dev: {
    start(heroId = 'wyatt', seed = 4242, world = 1) { run = R.newRun(heroId, seed, { world }); showMap(); },
    enter(type, arg) {
      if (!run) this.start();
      const rng = makeRng(99);
      if (type === 'shop') return enterNode({ type: 'shop', shop: R.makeShop(run, rng) });
      if (type === 'rest') return enterNode({ type: 'rest' });
      if (type === 'treasure') return enterNode({ type: 'treasure', relic: arg || 'sunflower' });
      if (type === 'event') return enterNode({ type: 'event', event: arg || 'duck_pond' });
      if (type === 'fight' || type === 'elite' || type === 'boss') {
        return enterNode({ type, enemies: arg || (type === 'boss' ? ['sand_monster'] : ['corn_colonel']) });
      }
      if (type === 'defeat') { run.floor = 5; return showDefeat(); }
      if (type === 'victory') return showVictory();
      if (type === 'refresh') return afterAction();
      if (type === 'actcard') { run.act = arg || 1; return showActCard(run.act, showMap); }
    },
  },
};
