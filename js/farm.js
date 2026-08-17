// farm.js — the persistent meta-layer (pure, no DOM). The FARM is what endures
// between runs (Hades model, INSPIRATION.md #1): pets in the barn and fish pool,
// Farm Coins banked from every run, Aaron's two shop tracks (barn capacity /
// pets-fight-with-you), and the world-unlock ladder. A lost run that banked coins
// or won a pet still moved you forward — that's the whole point.

import { PETS } from './pets.js';
import { WORLDS } from './run.js';
import { HEROES, CARDS } from './cards.js';

export const BARN_START = 5;     // Aaron's spec: "a capacity of five in your barn"
export const BARN_PER_TIER = 3;  // each shop upgrade adds stalls
export const POOL_START = 3;     // the fish pool (the boys' realism spec) has its own room
export const POOL_PER_TIER = 2;

export function newFarm() {
  return {
    v: 1,
    coins: 0,
    pets: [],                 // adopted pet ids (barn + pool together; habitat splits the display)
    equipped: null,           // pet taken into runs (needs the petBattle unlock)
    upgrades: { petBattle: false, barnTier: 0, poolTier: 0 },
    worlds: { unlocked: 1, beaten: [] }, // ladder: beat world N's duck → world N+1 opens
    deckMods: {},          // per-hero permanent starter-deck changes (the Deck Workshop)
    toys: [],              // Barn Toys — decorations the pets hang out with
    weirdness: 0,          // chosen Weirdness level for the next run
    weirdnessUnlocked: false, // opens when the Magnet first falls
    weirdnessBest: {},     // world → highest Weirdness beaten (the long game)
    stats: { runs: 0, wins: 0, petsWon: 0, coinsEarned: 0 },
  };
}

export function barnCapacity(farm) { return BARN_START + farm.upgrades.barnTier * BARN_PER_TIER; }
export function poolCapacity(farm) { return POOL_START + farm.upgrades.poolTier * POOL_PER_TIER; }
export function petsIn(farm, habitat) { return farm.pets.filter((k) => PETS[k]?.habitat === habitat); }
export function habitatFull(farm, habitat) {
  const cap = habitat === 'pool' ? poolCapacity(farm) : barnCapacity(farm);
  return petsIn(farm, habitat).length >= cap;
}

// ---------- the shop (Aaron's two tracks + pool room) ----------
// Prices tuned so one decent run buys SOMETHING (runs bank ~their end gold).
export function shopStock(farm) {
  const barnPrice = [150, 300, 500, 800][farm.upgrades.barnTier] ?? null;
  const poolPrice = [120, 250, 450][farm.upgrades.poolTier] ?? null;
  return [
    farm.upgrades.petBattle ? null : {
      id: 'pet_battle', price: 250, emoji: '⚔️',
      name: 'Battle Buddies', desc: 'Your pets can fight beside you! Equip one before a run.',
    },
    barnPrice == null ? null : {
      id: 'barn_upgrade', price: barnPrice, emoji: '🛖',
      name: `Barn Expansion ${farm.upgrades.barnTier + 1}`, desc: `+${BARN_PER_TIER} barn stalls for more pets.`,
    },
    poolPrice == null ? null : {
      id: 'pool_upgrade', price: poolPrice, emoji: '🌊',
      name: `Bigger Fish Pool ${farm.upgrades.poolTier + 1}`, desc: `+${POOL_PER_TIER} pool spots for more fish.`,
    },
  ].filter(Boolean);
}

export function shopBuy(farm, itemId) {
  const item = shopStock(farm).find((i) => i.id === itemId);
  if (!item || farm.coins < item.price) return false;
  farm.coins -= item.price;
  if (itemId === 'pet_battle') farm.upgrades.petBattle = true;
  if (itemId === 'barn_upgrade') farm.upgrades.barnTier += 1;
  if (itemId === 'pool_upgrade') farm.upgrades.poolTier += 1;
  return true;
}

// ---------- adoption (post-fight drops + duck boss wins come through here) ----------
// Returns { adopted } or { adopted: false, reason: 'full' | 'owned' }.
export function adoptPet(farm, petId) {
  const def = PETS[petId];
  if (!def || farm.pets.includes(petId)) return { adopted: false, reason: 'owned' };
  if (habitatFull(farm, def.habitat)) return { adopted: false, reason: 'full' };
  farm.pets.push(petId);
  farm.stats.petsWon += 1;
  return { adopted: true };
}

export function equipPet(farm, petId) {
  if (petId === null) { farm.equipped = null; return true; }
  if (!farm.upgrades.petBattle || !farm.pets.includes(petId)) return false;
  farm.equipped = petId;
  return true;
}

// ---------- run settlement ----------
// Every run ends here, win or lose: leftover gold banks as Farm Coins, pets won
// during the run try to move into the barn/pool. Returns a summary for the UI
// (what banked, who moved in, who found the barn FULL — the kid's cue to shop).
export function settleRun(farm, run, won) {
  const banked = Math.max(0, Math.floor(run.gold || 0));
  farm.coins += banked;
  farm.stats.coinsEarned += banked;
  farm.stats.runs += 1;
  if (won) {
    farm.stats.wins += 1;
    const worldNum = run.act;
    if (worldNum === 4) farm.weirdnessUnlocked = true; // the Magnet fell — the ladder opens
    const w = run.weirdness || 0;
    if (w > (farm.weirdnessBest[worldNum] || -1) || farm.weirdnessBest[worldNum] === undefined) {
      farm.weirdnessBest[worldNum] = Math.max(w, farm.weirdnessBest[worldNum] || 0);
    }
  }
  const movedIn = [], turnedAway = [];
  for (const petId of run.petsWon || []) {
    const res = adoptPet(farm, petId);
    (res.adopted ? movedIn : turnedAway).push(petId);
  }
  return { banked, movedIn, turnedAway };
}

// ---------- Barn Toys (the boys' ask: a barn with personality, things to hang out with) ----------
// Decorations bought with Farm Coins. Each appears IN the barnyard scene and a
// wandering pet will drift over and hang out with it. Pure cosmetics + joy.
export const TOYS = {
  ball:            { name: 'Bouncy Ball', emoji: '🏀', price: 60, habitat: 'barn', desc: 'Round. Bounceable. Instantly beloved.' },
  mud_puddle:      { name: 'Mud Puddle', emoji: '🟤', price: 90, habitat: 'barn', desc: 'Premium mud. Sir Oinks approves.' },
  scratching_post: { name: 'Scratching Post', emoji: '🪵', price: 100, habitat: 'barn', desc: 'For scratching. Also for judging.' },
  tire_swing:      { name: 'Tire Swing', emoji: '🛞', price: 120, habitat: 'barn', desc: 'The classic. Everyone waits their turn.' },
  hay_fort:        { name: 'Hay Fort', emoji: '🌾', price: 150, habitat: 'barn', desc: 'A fort of hay. Absolutely defensible.' },
  slide:           { name: 'Little Slide', emoji: '🛝', price: 180, habitat: 'barn', desc: 'Wheeee. Repeat forever.' },
  disco_ball:      { name: 'Disco Ball', emoji: '🪩', price: 300, habitat: 'barn', desc: 'Sometimes the barn parties. Nobody talks about it.' },
  lily_pads:       { name: 'Lily Pads', emoji: '🪷', price: 110, habitat: 'pool', desc: 'Floating furniture for the pool crowd.' },
  bubble_machine:  { name: 'Bubble Machine', emoji: '🫧', price: 140, habitat: 'pool', desc: 'Infinite bubbles. The fish are mesmerized.' },
  tiny_castle:     { name: 'Tiny Castle', emoji: '🏰', price: 200, habitat: 'pool', desc: 'Every pool needs a kingdom.' },
};

export function buyToy(farm, toyId) {
  const toy = TOYS[toyId];
  if (!toy || (farm.toys || []).includes(toyId)) return { ok: false, reason: 'owned' };
  if (farm.coins < toy.price) return { ok: false, reason: 'coins' };
  farm.coins -= toy.price;
  farm.toys = farm.toys || [];
  farm.toys.push(toyId);
  return { ok: true };
}

// ---------- the Deck Workshop (the boys' ask: "slowly alter your starting deck") ----------
// Two permanent, per-hero levers bought with Farm Coins:
//   TRAIN — a starter card is upgraded in every future run (Coach's drills stick)
//   TRIM  — a starter card leaves the deck for good (thinning: the quiet pro move),
//           capped so a deck can never shrink into nothing.
export const TRIM_MAX = 3;

export function deckMods(farm, hero) {
  return (farm.deckMods && farm.deckMods[hero]) || { up: {}, cut: {} };
}
function ensureMods(farm, hero) {
  farm.deckMods = farm.deckMods || {};
  farm.deckMods[hero] = farm.deckMods[hero] || { up: {}, cut: {} };
  return farm.deckMods[hero];
}
const modCount = (obj) => Object.values(obj).reduce((a, b) => a + b, 0);
export function trainPrice(farm, hero) { return 100 + 50 * modCount(deckMods(farm, hero).up); }
export function trimPrice(farm, hero) { return 150 + 100 * modCount(deckMods(farm, hero).cut); }
export function trimsUsed(farm, hero) { return modCount(deckMods(farm, hero).cut); }

// The hero's current starting deck with mods applied: [{id, up}] in starter order.
export function moddedStarter(farm, hero) {
  const m = deckMods(farm, hero);
  const cut = { ...m.cut }, up = { ...m.up };
  const out = [];
  for (const id of HEROES[hero].starter) {
    if (cut[id] > 0) { cut[id] -= 1; continue; }
    if (up[id] > 0) { up[id] -= 1; out.push({ id, up: true }); continue; }
    out.push({ id, up: false });
  }
  return out;
}

export function trainCard(farm, hero, cardId) {
  const price = trainPrice(farm, hero);
  if (farm.coins < price) return { ok: false, reason: 'coins' };
  const plain = moddedStarter(farm, hero).filter((c) => c.id === cardId && !c.up).length;
  if (plain <= 0 || !CARDS[cardId]?.up) return { ok: false, reason: 'card' };
  farm.coins -= price;
  const m = ensureMods(farm, hero);
  m.up[cardId] = (m.up[cardId] || 0) + 1;
  return { ok: true };
}

export function trimCard(farm, hero, cardId) {
  const price = trimPrice(farm, hero);
  if (farm.coins < price) return { ok: false, reason: 'coins' };
  if (trimsUsed(farm, hero) >= TRIM_MAX) return { ok: false, reason: 'max' };
  const have = moddedStarter(farm, hero).filter((c) => c.id === cardId).length;
  if (have <= 0) return { ok: false, reason: 'card' };
  farm.coins -= price;
  const m = ensureMods(farm, hero);
  m.cut[cardId] = (m.cut[cardId] || 0) + 1;
  // a trimmed copy that was upgraded frees the training (never strand paid drills)
  const remaining = moddedStarter(farm, hero).filter((c) => c.id === cardId).length;
  const upCount = m.up[cardId] || 0;
  if (upCount > remaining) m.up[cardId] = remaining;
  return { ok: true };
}

// ---------- world ladder ----------
export function beatWorld(farm, worldNum) {
  if (!farm.worlds.beaten.includes(worldNum)) farm.worlds.beaten.push(worldNum);
  // clamp: beating the last world unlocks nothing new (there is no world 5 —
  // unclamped this crashed the settlement screen blank; James's report)
  farm.worlds.unlocked = Math.min(WORLDS, Math.max(farm.worlds.unlocked, worldNum + 1));
}

// ---------- save / load ----------
export function serializeFarm(farm) { return JSON.stringify(farm); }
export function deserializeFarm(json) {
  try {
    const f = JSON.parse(json);
    if (!f || f.v !== 1 || !Array.isArray(f.pets)) return null;
    if (!f.pets.every((k) => PETS[k])) return null;
    // forward-safe defaults (new fields land without breaking old profiles)
    const fresh = newFarm();
    return {
      ...fresh, ...f,
      upgrades: { ...fresh.upgrades, ...(f.upgrades || {}) },
      worlds: { ...fresh.worlds, ...(f.worlds || {}) },
      deckMods: { ...(f.deckMods || {}) },
      toys: [...(f.toys || [])].filter((t) => TOYS[t]),
      weirdnessBest: { ...(f.weirdnessBest || {}) },
      stats: { ...fresh.stats, ...(f.stats || {}) },
    };
  } catch { return null; }
}
