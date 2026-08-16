// Rolfe Legends 2 — run layer (pure, no DOM): run creation, Coach James's boon,
// act maps (StS node graphs — js/map.js), encounters, rewards, shop, rest,
// treasure, save.

import { HEROES, CARDS, makeCard, draftPool, RARITY_WEIGHTS } from './cards.js';
import { RELICS, relicPool } from './relics.js';
import { EVENTS, EVENT_KEYS } from './events.js';
import { makeRng } from './rng.js';
import { generateActMap, reachableIds, BOSS_ID } from './map.js';

export const FLOORS_PER_ACT = 12;
export const ACTS = 3;

export const ACT_INFO = {
  1: { name: 'The Far Fields', emoji: '🌅', time: 'morning' },
  2: { name: 'The Barnyard', emoji: '🦆', time: 'dusk' },
  3: { name: 'The Storm', emoji: '🌩️', time: 'night' },
};

export const ENCOUNTERS = {
  1: {
    easy: [['gopher'], ['roly_poly', 'roly_poly'], ['crow'], ['mud_blob_m', 'mud_blob_s']],
    hard: [['barn_spider'], ['magpie'], ['mouse_scrappy', 'mouse_zippy', 'mouse_pudge', 'mouse_whiskers'], ['puffball', 'puffball'], ['crow', 'roly_poly']],
    elite: [['old_scarecrow'], ['ornery_ram'], ['scarecrow_post', 'scarecrow_post', 'scarecrow_post']],
    boss: [['rogue_combine'], ['mud_king']],
  },
  2: {
    easy: [['raccoon_bandit'], ['snapping_turtle'], ['thorny_bramble']],
    hard: [['waltzing_weasel'], ['possum_defender', 'possum_healer'], ['raccoon_bandit', 'raccoon_bandit'], ['snapping_turtle', 'thorny_bramble']],
    elite: [['porcupine'], ['fox', 'fox'], ['raccoon_ringleader']],
    boss: [['raccoon_king']],
  },
  3: {
    easy: [['ball_lightning', 'ball_lightning', 'ball_lightning'], ['hail_cloud'], ['debris_tangle']],
    hard: [['flooding_creek'], ['passing_squall'], ['hail_cloud', 'ball_lightning'], ['debris_tangle', 'hail_cloud']],
    elite: [['thunderhead'], ['ghost_wind'], ['wind_funnel']],
    boss: [['big_twister'], ['thunder', 'lightning']],
  },
};

// ---------- run creation ----------

export function newRun(heroId, seed) {
  const hero = HEROES[heroId];
  const run = {
    v: 2, seed, rngCalls: 0,
    hero: heroId, hp: hero.hp, maxHp: hero.hp,
    gold: 99,
    deck: hero.starter.map((id) => makeCard(id)),
    relics: [hero.relic],
    counters: {}, // cross-fight counters (slingshot, sunflower resets per fight in combat state? sunflower is per-fight in StS; keep per-fight by clearing at combat start)
    act: 1, floor: 0,
    map: generateActMap(seed, 1),
    pos: null, trail: [],
    skipNextFloor: false,
    pendingRemove: false,
    pendingUpgrade: false,
    stats: { fights: 0, elites: 0, damageTaken: 0 },
  };
  return run;
}

export function runRng(run) {
  // Deterministic-enough stream: seed + a counter bump per request site.
  run.rngCalls += 1;
  return makeRng((run.seed ^ (run.act * 7919) ^ (run.floor * 104729) ^ run.rngCalls) >>> 0);
}

// ---------- Coach James's boon (Neow) ----------

export function coachBoons(run, rng) {
  const all = [
    { id: 'maxhp', label: '❤️ "Eat your vegetables." (+8 Max HP)', apply: (r) => { r.maxHp += 8; r.hp += 8; } },
    { id: 'gold', label: '💰 "Buy something at Dad\'s." (+100 gold)', apply: (r) => { r.gold += 100; } },
    { id: 'upgrade', label: '⭐ "Let\'s drill that one move." (upgrade a random card)', apply: (r, g) => { const c = g.pick(r.deck.filter((x) => !x.up)); if (c) c.up = true; } },
    { id: 'relic', label: '🎁 "Found this in the shed." (random Farm Treasure)', apply: (r, g) => { const p = relicPool(r.relics); if (p.length) r.relics.push(g.pick(p)); } },
  ];
  return rng.shuffle(all).slice(0, 3);
}

// ---------- the map (StS node graph; generation in js/map.js) ----------

// Node ids the player may step to next (floor-1 row at act start, else the
// current node's outgoing edges).
export function nextNodes(run) {
  return reachableIds(run.map, run.pos).map((id) => ({ id, ...run.map.nodes[id] }));
}

// Step onto a map node and resolve what happens there.
export function enterMapNode(run, id) {
  if (!reachableIds(run.map, run.pos).includes(id)) return null;
  const node = run.map.nodes[id];
  run.pos = id;
  run.trail.push(id);
  run.floor = node.f;
  if (run.skipNextFloor && node.type !== 'boss') {
    // Poppa Flaj's tractor: this floor resolves as a free pass
    run.skipNextFloor = false;
    return { type: 'skipped' };
  }
  return resolveNode(run, node.type);
}

function resolveNode(run, type) {
  const rng = runRng(run);
  const act = ENCOUNTERS[run.act];
  switch (type) {
    case 'fight': {
      const pool = run.floor <= 3 ? act.easy : (rng.chance(0.35) ? act.easy : act.hard);
      return { type: 'fight', enemies: rng.pick(pool) };
    }
    case 'elite': return { type: 'elite', enemies: rng.pick(act.elite) };
    case 'boss': return { type: 'boss', enemies: rng.pick(act.boss) };
    case 'shop': return { type: 'shop', shop: makeShop(run, rng) };
    case 'treasure': {
      const p = relicPool(run.relics);
      const relic = p.length ? rng.pick(p) : null;
      if (relic) run.relics.push(relic);
      return { type: 'treasure', relic };
    }
    case 'rest': return { type: 'rest' };
    case 'event': {
      const seen = run.seenEvents || (run.seenEvents = []);
      const fresh = EVENT_KEYS.filter((k) => !seen.includes(k));
      const key = rng.pick(fresh.length ? fresh : EVENT_KEYS);
      seen.push(key);
      return { type: 'event', event: key };
    }
    default: return { type };
  }
}

// ---------- combat rewards ----------

const RARITY_GOLD = { common: 50, uncommon: 75, rare: 145 };

export function pickRarity(rng) {
  const total = RARITY_WEIGHTS.common + RARITY_WEIGHTS.uncommon + RARITY_WEIGHTS.rare;
  let r = rng.int(total);
  if ((r -= RARITY_WEIGHTS.common) < 0) return 'common';
  if ((r -= RARITY_WEIGHTS.uncommon) < 0) return 'uncommon';
  return 'rare';
}

export function cardDraft(run, rng, n = 3) {
  const pool = draftPool(run.hero);
  const picks = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const rarity = pickRarity(rng);
    let candidates = pool.filter((id) => CARDS[id].rarity === rarity && !used.has(id));
    if (!candidates.length) candidates = pool.filter((id) => !used.has(id));
    if (!candidates.length) break;
    const id = rng.pick(candidates);
    used.add(id);
    picks.push(id);
  }
  return picks;
}

export function fightRewards(run, kind, rng) {
  const rewards = { gold: 0, cards: [], relic: null };
  if (kind === 'fight') rewards.gold = rng.range(10, 20);
  if (kind === 'elite') {
    rewards.gold = rng.range(25, 35);
    const p = relicPool(run.relics);
    rewards.relic = p.length ? rng.pick(p) : null;
  }
  if (kind === 'boss') rewards.gold = rng.range(95, 105);
  rewards.cards = cardDraft(run, rng, 3);
  return rewards;
}

export function applyCombatResult(run, combatState) {
  run.hp = combatState.hero.hp;
  // fled thieves keep what they stole
  let lost = 0;
  for (const e of combatState.enemies) if (e.fled && e.stolen) lost += e.stolen;
  run.gold = Math.max(0, run.gold - lost);
  // Big Breakfast: report the actual amount healed so the UI can show the
  // pancakes doing their work (James: it should obviously trigger)
  let breakfastHeal = null;
  if (run.relics.includes('big_breakfast')) {
    breakfastHeal = Math.min(8, run.maxHp - run.hp);
    run.hp += breakfastHeal;
  }
  run.stats.fights += 1;
  return { goldLost: lost, breakfastHeal };
}

// ---------- shop (Jacob's Farm Supply) ----------

export function makeShop(run, rng) {
  // 8 cards + 2 treasures (James, Sun 2026-08-02: richer stock fills the hole snacks left)
  const cards = cardDraft(run, rng, 8).map((id) => ({
    id, price: Math.round(RARITY_GOLD[CARDS[id].rarity] * (0.9 + rng.random() * 0.2)),
  }));
  const relics = rng.shuffle(relicPool(run.relics)).slice(0, 2)
    .map((id) => ({ id, price: rng.range(143, 157) }));
  return { cards, relics, removePrice: 75, removed: false };
}

export function shopBuyCard(run, shop, i) {
  const item = shop.cards[i];
  if (!item || run.gold < item.price) return false;
  run.gold -= item.price;
  run.deck.push(makeCard(item.id));
  shop.cards.splice(i, 1);
  return true;
}
export function shopBuyRelic(run, shop, i = 0) {
  const item = shop.relics[i];
  if (!item || run.gold < item.price) return false;
  run.gold -= item.price;
  run.relics.push(item.id);
  shop.relics.splice(i, 1);
  return true;
}
export function shopRemoveCard(run, shop, cardUid) {
  if (shop.removed || run.gold < shop.removePrice) return false;
  const i = run.deck.findIndex((c) => c.uid === cardUid);
  if (i < 0) return false;
  run.gold -= shop.removePrice;
  run.deck.splice(i, 1);
  shop.removed = true;
  return true;
}

// ---------- rest (Granny Rockie's porch) ----------

// Granny keeps a card safe at her house — free removal, the rest-site third
// option (James, Sun 2026-08-02: "store some of your things at her house")
export function restStore(run, cardUid) {
  if (run.deck.length <= 1) return false;
  const i = run.deck.findIndex((c) => c.uid === cardUid);
  if (i < 0) return false;
  run.deck.splice(i, 1);
  return true;
}

export function restCookies(run) {
  const heal = Math.floor(run.maxHp * 0.3);
  run.hp = Math.min(run.maxHp, run.hp + heal);
  return heal;
}
export function restPractice(run, cardUid) {
  const c = run.deck.find((x) => x.uid === cardUid && !x.up);
  if (!c) return false;
  c.up = true;
  return true;
}

// ---------- act / run progression ----------

export function advanceAct(run) {
  if (run.act >= ACTS) return false;
  run.act += 1;
  run.floor = 0;
  run.map = generateActMap(run.seed, run.act);
  run.pos = null;
  run.trail = [];
  run.seenEvents = [];
  // A full meal between acts — lunch after act 1, dinner after act 2 — heals
  // you ALL the way up, exactly like StS's between-act rest (James's call
  // Sun 2026-08-03; hard mode lives in the fights, not the transitions).
  run.hp = run.maxHp;
  return true;
}

// ---------- save / load (localStorage-friendly JSON) ----------

export function serializeRun(run) {
  return JSON.stringify(run);
}
export function deserializeRun(json) {
  try {
    const run = JSON.parse(json);
    if (!run || run.v !== 2 || !HEROES[run.hero]) return null;
    if (!Array.isArray(run.deck) || !run.deck.every((c) => CARDS[c.id])) return null;
    if (!run.map || !run.map.nodes || !run.map.nodes[BOSS_ID]) return null;
    // snacks were cut Sun 2026-08-02 (James: more complexity than value) —
    // scrub them from older saves so a mid-run farm survives the update
    delete run.snacks; delete run.snackSlots;
    run.relics = run.relics.filter((id) => id !== 'lunchbox');
    return run;
  } catch { return null; }
}
