// farm.js — the persistent meta-layer (pure, no DOM). The FARM is what endures
// between runs (Hades model, INSPIRATION.md #1): pets in the barn and fish pool,
// Farm Coins banked from every run, Aaron's two shop tracks (barn capacity /
// pets-fight-with-you), and the world-unlock ladder. A lost run that banked coins
// or won a pet still moved you forward — that's the whole point.

import { PETS } from './pets.js';

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
  if (won) farm.stats.wins += 1;
  const movedIn = [], turnedAway = [];
  for (const petId of run.petsWon || []) {
    const res = adoptPet(farm, petId);
    (res.adopted ? movedIn : turnedAway).push(petId);
  }
  return { banked, movedIn, turnedAway };
}

// ---------- world ladder ----------
export function beatWorld(farm, worldNum) {
  if (!farm.worlds.beaten.includes(worldNum)) farm.worlds.beaten.push(worldNum);
  farm.worlds.unlocked = Math.max(farm.worlds.unlocked, worldNum + 1);
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
      stats: { ...fresh.stats, ...(f.stats || {}) },
    };
  } catch { return null; }
}
