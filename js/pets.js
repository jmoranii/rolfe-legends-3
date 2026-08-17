// Pets — the heart of Rolfe Legends 3 (Aaron's pet loop + Wyatt's card-granting bear).
// Pure module: data + logic, no DOM. A pet is a COMPANION in fights (its own visible
// action on a deterministic cadence — legible like an enemy intent) and most pets
// also add a SIGNATURE CARD to your deck for the run.
//
// Rarity ladder: common → uncommon → rare → legendary.
// The Alien is the rarest thing in the game (the boys' spec: "really, really, really rare").
// Duck super-pets come only from beating their world's boss. Goldie is a secret.

import { makeCard } from './cards.js';

export const PETS = {
  // ---------- common (barn) ----------
  pig: {
    name: 'Sir Oinks', emoji: '🐷', rarity: 'common', habitat: 'barn',
    blurb: 'A gentleman pig. Loves mud, respects you.',
    card: 'belly_bump',
    companion: { every: 1, desc: 'Splats mud in front of you: +2 🛡️ Block', act: 'block2' },
  },
  chicken: {
    name: 'Nugget', emoji: '🐔', rarity: 'common', habitat: 'barn',
    blurb: 'Lays eggs with perfect timing. Do not ask how she knows.',
    card: 'peck_peck',
    companion: { every: 3, desc: 'Every 3rd turn: lays an 🥚 Egg into your hand', act: 'egg' },
  },
  cat: {
    name: 'Whiskers', emoji: '🐱', rarity: 'common', habitat: 'barn',
    blurb: 'Pretends not to care. Swats weirdos when you are not looking.',
    card: 'pounce',
    companion: { every: 2, desc: 'Every 2nd turn: swats a random weirdo for 3', act: 'dmg3rand' },
  },
  puppy: {
    name: 'Biscuit', emoji: '🐶', rarity: 'common', habitat: 'barn',
    blurb: 'A puppy with zoomies. Maximum speed, minimum plan.',
    card: 'zoomies',
    companion: { every: 'first', desc: 'Turn 1: so excited you draw +1 card', act: 'draw1' },
  },
  goldfish: {
    name: 'Bubbles', emoji: '🐠', rarity: 'common', habitat: 'pool',
    blurb: 'Lives in the fish pool. Watching her is very calming.',
    card: 'splash',
    companion: { every: 1, desc: 'Calming bubbles: heal 1 ❤️ each turn', act: 'heal1' },
  },
  // ---------- uncommon (barn + pool) ----------
  sheepdog: {
    name: 'Patch', emoji: '🐕‍🦺', rarity: 'uncommon', habitat: 'barn',
    blurb: 'A working dog. Herds sheep, weirdos, and you, gently.',
    card: 'round_em_up',
    companion: { every: 2, desc: 'Every 2nd turn: herds you to safety, +3 🛡️', act: 'block3' },
  },
  hound: {
    name: 'Boomer', emoji: '🐕', rarity: 'uncommon', habitat: 'barn',
    blurb: 'His bark is worse than his bite, and his bark is VERY bad news.',
    card: 'big_bark',
    companion: { every: 3, desc: 'Every 3rd turn: HOWLS — all weirdos get Weak 1', act: 'weakAll' },
  },
  raccoon: {
    name: 'Bandit Jr.', emoji: '🦝', rarity: 'uncommon', habitat: 'barn',
    blurb: 'Reformed weirdo. Mostly. Keep an eye on your snacks.',
    card: 'five_finger_swipe',
    companion: { every: 3, desc: 'Every 3rd turn: finds 💰8 in shiny things', act: 'gold8' },
  },
  owl: {
    name: 'Professor Hoot', emoji: '🦉', rarity: 'uncommon', habitat: 'barn',
    blurb: 'Has read every book in the barn. There is one book. It is about mice.',
    card: 'night_swoop',
    companion: { every: 2, desc: 'Every 2nd turn: wisdom — draw +1 card', act: 'draw1' },
  },
  goat: {
    name: 'Ramona', emoji: '🐐', rarity: 'uncommon', habitat: 'barn',
    blurb: 'Will headbutt anything. Doors, fences, weirdos, the concept of patience.',
    card: 'headbutt_card',
    companion: { every: 3, desc: 'Every 3rd turn: HEADBUTT — 5 to a random weirdo + Vulnerable 1', act: 'goatbutt' },
  },
  catfish: {
    name: 'Mudwhisker', emoji: '🐟', rarity: 'uncommon', habitat: 'pool',
    blurb: 'Old as the pond. Grumpy as the pond. Secretly poisonous, like the pond.',
    card: 'mud_gulp',
    companion: { every: 2, desc: 'Every 2nd turn: muddy gunk — 2 ☠️ poison on a random weirdo', act: 'poison2rand' },
  },
  // ---------- rare ----------
  bear: {
    name: 'Bruno', emoji: '🐻', rarity: 'rare', habitat: 'barn',
    blurb: "A bear lives in the barn now. Nobody voted on this. Nobody objected either.",
    card: null, // Wyatt's spec: the bear GIVES you his card, every single turn
    companion: { every: 1, desc: 'EVERY turn: hands you a 🐻 Claw Scratch card', act: 'clawcard' },
  },
  rusty: {
    name: 'Rusty', emoji: '🐕', rarity: 'rare', habitat: 'barn',
    blurb: 'The goodest boy. Found treasures in RL2; now he fights beside you.',
    card: 'good_boy',
    companion: { every: 'first', desc: 'Turn 1: fetches your plan — draw +2 cards', act: 'draw2' },
  },
  // ---------- legendary ----------
  alien: {
    name: 'Zorp', emoji: '👽', rarity: 'legendary', habitat: 'barn',
    blurb: 'Crash-landed behind the barn. Thinks the chickens are in charge. Extremely rare.',
    card: 'ufo_beam',
    companion: { every: 1, desc: 'Every turn: zzzap — 3 damage that ignores Block', act: 'zap3' },
  },
  // ---------- duck super-pets (won by beating their world's boss; never random drops) ----------
  diver: {
    name: 'Diver', emoji: '🦆', rarity: 'legendary', habitat: 'pool', source: 'boss',
    blurb: "Wyatt's white duck. World 2's boss. Once calmed, she dives for YOUR team.",
    card: 'dive_bomb',
    companion: { every: 2, desc: 'Every 2nd turn: DIVE! — 6 to a random weirdo', act: 'dmg6rand' },
  },
  brownie: {
    name: 'Brownie', emoji: '🦆', rarity: 'legendary', habitat: 'pool', source: 'boss',
    blurb: "Wyatt's brown duck. World 1's boss. Nobody knows what she is. That is her power.",
    card: 'mystery_waddle',
    companion: { every: 1, desc: 'Every turn: a mystery gift (2 🛡️, 2 ⚔️, or 1 ❤️)', act: 'mystery' },
  },
  harmless: {
    name: 'Harmless', emoji: '🦆', rarity: 'legendary', habitat: 'pool', source: 'boss',
    blurb: "Wyatt's black duck. World 3's boss. The name is a warning label in reverse.",
    card: 'not_harmless',
    companion: { every: 3, desc: 'Every 3rd turn: "HARMLESS?!" — 8 to ALL weirdos', act: 'dmg8all' },
  },
  // ---------- SECRET (zero-hint: excluded from Barn Book counts + all pre-unlock UI) ----------
  goldie: {
    name: 'Goldie', emoji: '🦙', rarity: 'legendary', habitat: 'barn', source: 'secret',
    blurb: 'Goldie says nothing. Goldie knows.',
    card: 'spit',
    card2: 'goldie_knows',
    companion: { every: 2, desc: 'Every 2nd turn: Llama Stare — a random weirdo loses its nerve (Weak 1)', act: 'stare' },
  },
};

export const PET_KEYS = Object.keys(PETS);

// Pets that can appear in random post-fight drops (bosses and secrets excluded).
export function droppablePets() {
  return PET_KEYS.filter((k) => !PETS[k].source);
}

// The Barn Book lists every pet a kid can know exists. Goldie is ABSENT pre-unlock
// (no silhouette, no count slot — the no-tell canon).
export function barnBookPets(profile) {
  return PET_KEYS.filter((k) => PETS[k].source !== 'secret' || (profile?.farm?.pets || []).includes(k));
}

// ---------- drop rolls ----------
// Chance a won fight drops a pet, by fight kind. The alien has its own tiny
// absolute roll first — "really, really, really rare" (expected ~1 in 150 wins).
export const DROP_CHANCE = { fight: 0.12, elite: 0.30, boss: 0.40 };
export const ALIEN_CHANCE = 1 / 150;
// Deeper worlds drop RARER pets (the boys' "more worlds = more good things
// unlock", finally wired): rarity weights shift toward rare per world.
const RARITY_BY_WORLD = {
  1: { common: 75, uncommon: 22, rare: 3 },
  2: { common: 55, uncommon: 33, rare: 12 },
  3: { common: 45, uncommon: 38, rare: 17 },
  4: { common: 35, uncommon: 40, rare: 25 },
};

export function petDropRoll(kind, rng, owned = [], world = 1) {
  const chance = DROP_CHANCE[kind] || 0;
  if (!PET_KEYS.length) return null;
  if (!owned.includes('alien') && rng.chance(ALIEN_CHANCE)) return 'alien';
  if (!rng.chance(chance)) return null;
  const RARITY_W = RARITY_BY_WORLD[world] || RARITY_BY_WORLD[1];
  const pool = droppablePets().filter((k) => k !== 'alien' && !owned.includes(k));
  if (!pool.length) return null;
  const total = pool.reduce((s, k) => s + RARITY_W[PETS[k].rarity], 0);
  let roll = rng.int(total) + 1;
  for (const k of pool) {
    roll -= RARITY_W[PETS[k].rarity];
    if (roll <= 0) return k;
  }
  return pool[pool.length - 1];
}

// ---------- deck injection ----------
export function petDeckCards(petId) {
  const p = PETS[petId];
  if (!p) return [];
  return [p.card, p.card2].filter(Boolean).map((id) => makeCard(id));
}

// ---------- companion turn (called from combat startHeroTurn) ----------
// Deterministic cadence; rng used only to pick targets. Returns a log-friendly
// summary or null if the pet rests this turn. UI shows `nextActIn` like an intent.
export function petActsThisTurn(def, turn) {
  if (def.companion.every === 'first') return turn === 1;
  return turn % def.companion.every === 0;
}

export function petIntent(petId, turn) {
  const def = PETS[petId];
  if (!def) return null;
  const c = def.companion;
  if (c.every === 'first') return turn <= 1 ? c.desc : `${def.name} is cheering you on!`;
  const inTurns = (c.every - (turn % c.every)) % c.every;
  return inTurns === 0 ? c.desc : `${c.desc} — in ${inTurns} turn${inTurns > 1 ? 's' : ''}`;
}
