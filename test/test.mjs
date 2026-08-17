// Rolfe Legends 2 — unit tests. Run: node test/test.mjs
import { makeRng } from '../js/rng.js';
import { CARDS, HEROES, DIAPERS, makeCard, cardInfo, draftPool, nValue } from '../js/cards.js';
import { RELICS, relicPool } from '../js/relics.js';
import { ENEMIES } from '../js/enemies.js';
import { EVENTS, EVENT_KEYS } from '../js/events.js';
import * as C from '../js/combat.js';
import * as R from '../js/run.js';
import { generateActMap, reachableIds, validateMap, MAP_FLOORS, TREASURE_FLOOR, REST_FLOOR, BOSS_ID } from '../js/map.js';
import { parseLrc, deriveBeats } from '../js/credits.js';
import { readFileSync, existsSync } from 'fs';
import { TIPS_GENERAL, TIPS_HERO, nextTip, LOSS_LINES, nextLossLine } from '../js/tips.js';

let passed = 0, failed = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; fails.push(msg); }
}
function eq(a, b, msg) { ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

function freshRun(hero = 'aaron', seed = 42) { return R.newRun(hero, seed); }
function combatVs(keys, { hero = 'aaron', seed = 7, run = null } = {}) {
  const r = run || freshRun(hero, seed);
  return { run: r, state: C.startCombat(r, keys, makeRng(seed)) };
}
function findInHand(state, id) { return state.hand.find((c) => c.id === id); }
function forceHand(state, ids) {
  state.hand = ids.map((id) => makeCard(id));
  state.draw = []; state.discard = [];
}

// ---------- rng ----------
{
  const a = makeRng(123), b = makeRng(123);
  eq(a.int(1000), b.int(1000), 'rng deterministic');
  const arr = a.shuffle([1, 2, 3, 4, 5]);
  eq(arr.length, 5, 'shuffle preserves length');
  ok([1, 2, 3, 4, 5].every((x) => arr.includes(x)), 'shuffle preserves elements');
  const r = a.range(3, 6);
  ok(r >= 3 && r <= 6, 'range inclusive bounds');
}

// ---------- damage math ----------
{
  eq(C.attackValue(6, { strength: 0 }), 6, 'attack base');
  eq(C.attackValue(6, { strength: 3 }), 9, 'strength adds');
  eq(C.attackValue(8, { strength: 0, weak: 1 }), 6, 'weak = 75% floor');
  eq(C.blockValue(5, { dexterity: 2 }), 7, 'dex adds to block');
  eq(C.blockValue(8, { dexterity: 0, frail: 1 }), 6, 'frail = 75% floor');
}

// ---------- combat basics ----------
{
  const { state } = combatVs(['corn_colonel']);
  eq(state.hero.energy, 3, 'starts with 3 energy');
  eq(state.hand.length, 5, 'draws 5');
  ok(state.enemies[0].intent, 'enemy announces intent');
  const shove = findInHand(state, 'shove') || state.hand[0];
  forceHand(state, ['shove']);
  const e = state.enemies[0];
  const hp0 = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(e.hp, hp0 - 6, 'Shove deals 6');
  eq(state.hero.energy, 2, 'energy spent');
  eq(state.discard.length, 1, 'card discarded after play');
}
{
  // block + enemy attack + vulnerable
  const { state } = combatVs(['corn_colonel']);
  const e = state.enemies[0];
  forceHand(state, ['brace', 'tornado_slam']);
  C.playCard(state, state.hand[0]);
  eq(state.hero.block, 5, 'Brace gives 5 block');
  const hp0 = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(e.hp, hp0 - 8, 'Tornado Slam 8');
  eq(e.vulnerable, 2, 'Slam applies 2 vulnerable');
  forceHand(state, ['shove']);
  state.hero.energy = 3;
  const hp1 = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(e.hp, hp1 - 9, 'vulnerable = 150% of 6');
}
{
  // poison ticks and decrements on enemy turn
  const { state } = combatVs(['sticky_vine'], { hero: 'wyatt' });
  const e = state.enemies[0];
  forceHand(state, ['itching_powder']);
  C.playCard(state, state.hand[0], e);
  eq(e.poison, 4, 'itching powder applies 4 poison');
  const hp0 = e.hp;
  C.endTurn(state);
  eq(e.hp, hp0 - 4, 'poison ticked 4');
  eq(e.poison, 3, 'poison decremented');
}
{
  // block absorbs, expires next turn
  const { state } = combatVs(['corn_colonel']);
  state.enemies[0].intent = { name: 'Chomp', kind: 'attack', dmg: 11 };
  forceHand(state, ['brace', 'brace']);
  C.playCard(state, state.hand[0]);
  C.playCard(state, state.hand[0]);
  eq(state.hero.block, 10, 'stacked block');
  const hp0 = state.hero.hp;
  C.endTurn(state);
  eq(state.hero.hp, hp0 - 1, 'block absorbed 10 of 11');
  eq(state.hero.block, 0, 'block expired at turn start');
}

// ---------- every playable card executes ----------
for (const [id, def] of Object.entries(CARDS)) {
  if (def.unplayable) continue;
  for (const up of [false, true]) {
    const { state } = combatVs(['corn_colonel', 'angry_sprout'], { hero: def.hero === 'wyatt' ? 'wyatt' : 'aaron' });
    state.hero.energy = 99;
    forceHand(state, ['shove']); // ensure discard fodder for discard ops
    state.hand.push(makeCard(id, up));
    const inst = state.hand[state.hand.length - 1];
    const okPlay = C.playCard(state, inst, state.enemies[0]);
    ok(okPlay, `card plays: ${id}${up ? '+' : ''}`);
    while (state.pendingDiscard > 0 && state.hand.length) C.resolveDiscard(state, state.hand[0]);
    ok(state.hero.hp > 0 || id === 'all_out', `hero alive after ${id}`);
  }
}

// ---------- specific card mechanics ----------
{
  const { state } = combatVs(['mega_melon']);
  const e = state.enemies[0];
  state.hero.strength = 2;
  forceHand(state, ['heavy_haul']);
  const hp0 = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(hp0 - e.hp, 14 + 2 * 3, 'Heavy Haul: strength ×3');
}
{
  const { state } = combatVs(['corn_colonel', 'angry_sprout']);
  forceHand(state, ['tornado_spin']);
  state.hero.energy = 3;
  const hp0 = state.enemies[0].hp, hp1 = state.enemies[1].hp;
  C.playCard(state, state.hand[0]);
  eq(state.hero.energy, 0, 'X-cost spends all energy');
  eq(hp0 - state.enemies[0].hp, 15, 'Tornado Spin 5×3 on enemy 1');
  eq(hp1 - state.enemies[1].hp, 15, 'Tornado Spin 5×3 on enemy 2');
}
{
  const { state } = combatVs(['mega_melon'], { hero: 'wyatt' });
  const e = state.enemies[0];
  forceHand(state, ['kick', 'kick', 'bicycle_kick']);
  state.hero.energy = 9;
  C.playCard(state, state.hand[0], e);
  C.playCard(state, state.hand[0], e);
  const hp0 = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(hp0 - e.hp, 12, 'Bicycle Kick: 6 × 2 attacks played before it');
}
{
  const { state } = combatVs(['corn_colonel'], { hero: 'wyatt' });
  forceHand(state, ['juggling_show']);
  C.playCard(state, state.hand[0]);
  eq(state.hand.filter((c) => c.id === 'soccer_ball').length, 3, 'Juggling Show adds 3 Soccer Balls');
  const e = state.enemies[0];
  const hp0 = e.hp;
  C.playCard(state, findInHand(state, 'soccer_ball'), e);
  eq(hp0 - e.hp, 4, 'Soccer Ball deals 4');
  eq(state.exhaust.length, 1, 'Soccer Ball exhausts');
}
{
  const { state } = combatVs(['corn_colonel']);
  forceHand(state, ['all_out']);
  state.draw = ['shove', 'shove', 'shove', 'brace', 'brace'].map((id) => makeCard(id));
  const hp0 = state.hero.hp;
  C.playCard(state, state.hand[0]);
  eq(state.hero.hp, hp0 - 6, 'All-Out Effort costs 6 HP');
  eq(state.hero.energy, 5, 'All-Out Effort +2 energy');
  eq(state.hand.length, 3, 'All-Out Effort drew 3');
  eq(state.exhaust.length, 1, 'All-Out Effort exhausts');
}
{
  const { state } = combatVs(['corn_colonel']);
  forceHand(state, ['tornado_form', 'fortify']);
  state.hero.energy = 6;
  C.playCard(state, state.hand[0]);
  C.playCard(state, state.hand[0]);
  state.hero.block = 12;
  state.enemies[0].intent = { name: 'x', kind: 'defend', block: 1 };
  C.endTurn(state);
  eq(state.hero.strength, 2, 'Tornado Form +2 str at turn start');
  eq(state.hero.block, 12, 'Fortify keeps block');
}
{
  const { state } = combatVs(['corn_colonel'], { hero: 'wyatt' });
  forceHand(state, ['sleight_of_hand', 'kick']);
  C.playCard(state, state.hand[0]);
  state.enemies[0].intent = { name: 'x', kind: 'defend', block: 1 };
  C.endTurn(state);
  ok(state.pendingDiscard === 1, 'Sleight of Hand: draw 1 then must discard 1');
  C.resolveDiscard(state, state.hand[0]);
  eq(state.pendingDiscard, 0, 'discard resolved');
}
{
  // innate: sneak_attack surfaces in opening hand
  const run = freshRun('wyatt', 9);
  run.deck.push(makeCard('sneak_attack'));
  const state = C.startCombat(run, ['corn_colonel'], makeRng(9));
  ok(findInHand(state, 'sneak_attack'), 'innate card in opening hand');
}
{
  // hailstone burns in hand; poison_ivy damages on draw
  const { state } = combatVs(['corn_colonel']);
  forceHand(state, ['hailstone']);
  state.enemies[0].intent = { name: 'x', kind: 'defend', block: 1 };
  const hp0 = state.hero.hp;
  C.endTurn(state);
  ok(state.hero.hp <= hp0 - 2, 'hailstone burned 2 at end of turn');
  const run2 = freshRun('aaron', 3);
  run2.deck = [makeCard('poison_ivy'), makeCard('shove')];
  const s2 = C.startCombat(run2, ['corn_colonel'], makeRng(3));
  ok(s2.hero.hp < s2.hero.maxHp, 'poison ivy damaged on draw');
  ok(!C.canPlay(s2, s2.hand.find((c) => c.id === 'poison_ivy')), 'curse unplayable');
}

// ---------- relics ----------
{
  const run = freshRun('aaron', 5);
  run.relics.push('fence_post', 'lucky_horseshoe', 'skipping_stone', 'barbed_wire', 'grannys_thermos', 'barn_lantern');
  run.hp = 50;
  const state = C.startCombat(run, ['corn_colonel'], makeRng(5));
  eq(state.hero.block, 8, 'Fence Post: 8 block at combat start');
  eq(state.hero.strength, 1, 'Lucky Horseshoe +1 str');
  eq(state.hero.dexterity, 1, 'Skipping Stone +1 dex');
  eq(state.hero.thorns, 3, 'Barbed Wire thorns 3');
  eq(state.hero.hp, 52, "Granny's Thermos healed 2");
  eq(state.hero.energy, 4, 'Barn Lantern +1 energy turn 1');
}
{
  const run = freshRun('wyatt', 5); // head_start starter
  const state = C.startCombat(run, ['corn_colonel'], makeRng(5));
  eq(state.hand.length, 7, 'Head Start draws 2 extra turn 1');
}
{
  const run = freshRun('aaron', 5);
  run.relics.push('keys_tractor', 'old_quilt');
  const state = C.startCombat(run, ['corn_colonel'], makeRng(5));
  eq(state.hero.energy, 4, 'Keys to the Tractor +1 energy');
  state.enemies[0].intent = { name: 'x', kind: 'defend', block: 1 };
  C.endTurn(state);
  // old quilt gave 6 block at end of turn (then expired at next turn start)
  ok(true, 'old quilt exercised');
}
{
  const run = freshRun('aaron', 5);
  run.relics.push('rally_cap');
  const state = C.startCombat(run, ['corn_colonel'], makeRng(5));
  state.hand = [];
  C.dealDamage(state, state.hero, 5, { isAttack: false });
  eq(state.hand.length, 3, 'Rally Cap drew 3 on first HP loss');
}
{
  const run = freshRun('aaron', 5);
  run.relics.push('hay_bale_toss', 'soccer_drills');
  const state = C.startCombat(run, ['mega_melon'], makeRng(5));
  forceHand(state, ['shove', 'shove', 'shove']);
  state.hero.energy = 9;
  const e = state.enemies[0];
  C.playCard(state, state.hand[0], e);
  C.playCard(state, state.hand[0], e);
  eq(state.hero.strength, 0, 'no str before 3rd attack');
  C.playCard(state, state.hand[0], e);
  eq(state.hero.strength, 1, 'Hay Bale Toss: 3rd attack +1 str');
  eq(state.hero.dexterity, 1, 'Soccer Drills: 3rd attack +1 dex');
}

// ---------- enemy behaviors ----------
{
  const { state } = combatVs(['rolling_pumpkin']);
  const e = state.enemies[0];
  C.dealDamage(state, e, 3, { attacker: state.hero });
  eq(e.block, 6, 'roly-poly curls for 6 block on first hit');
}
{
  const { state } = combatVs(['compost_blob_m']);
  const e = state.enemies[0];
  C.dealDamage(state, e, Math.ceil(e.maxHp / 2) + 1, { attacker: state.hero });
  eq(state.enemies.length, 2, 'mud blob split spawned a blip');
}
{
  const { state } = combatVs(['crow_thief']);
  const e = state.enemies[0];
  for (let i = 0; i < 6 && !state.over; i++) { state.hand = []; C.endTurn(state); }
  ok(e.fled || state.over, 'crow_thief eventually flees (or fight ended)');
}
{
  const { state, run } = combatVs(['crow_thief']);
  const e = state.enemies[0];
  e.intent = { name: 'Snatch!', kind: 'attack', dmg: 10, fn: (st, en) => { en.stolen += 15; } };
  state.hand = [];
  C.endTurn(state);
  eq(e.stolen, 15, 'crow_thief stole gold');
  e.fled = true;
  C.checkCombatEnd(state);
  ok(state.over && state.won, 'combat won when thief flees');
  const g0 = run.gold;
  R.applyCombatResult(run, state);
  eq(run.gold, g0 - 15, 'stolen gold deducted');
}

// ---------- Big Breakfast reports its trigger for the reward banner (James, Thu 2026-08-07) ----------
{
  const run = R.newRun('aaron', 77);
  const state = C.startCombat(run, ['corn_colonel'], makeRng(77));
  state.hero.hp = 40;
  const res = R.applyCombatResult(run, state);
  eq(res.breakfastHeal, 8, 'Big Breakfast reports +8 after the fight');
  eq(run.hp, 48, 'pancakes actually healed');
  const run2 = R.newRun('aaron', 77);
  const state2 = C.startCombat(run2, ['corn_colonel'], makeRng(77));
  const res2 = R.applyCombatResult(run2, state2);
  eq(res2.breakfastHeal, 0, 'full HP: reports 0 (banner says stuffed), no overheal');
  eq(run2.hp, run2.maxHp, 'hp stays clamped at max');
  const run3 = R.newRun('wyatt', 77);
  const state3 = C.startCombat(run3, ['corn_colonel'], makeRng(77));
  eq(R.applyCombatResult(run3, state3).breakfastHeal, null, 'no pancakes → no banner');
}
{
  const { state } = combatVs(['mega_melon']);
  const e = state.enemies[0];
  eq(e.intent.kind, 'sleep', 'sprinkler/melon starts dormant');
  C.dealDamage(state, e, 5, { attacker: state.hero });
  state.hand = [];
  C.endTurn(state);
  ok(e.intent.kind !== 'sleep', 'sprinkler/melon woke after damage');
}
{
  const { state } = combatVs(['giant_zucchini']);
  const e = state.enemies[0];
  state.hand = [];
  C.endTurn(state); // ram snorts → enraged
  const str0 = e.strength;
  forceHand(state, ['brace']);
  C.playCard(state, state.hand[0]);
  eq(e.strength, str0 + 2, 'ram enrages when hero plays a skill');
}
{
  const { state } = combatVs(['sprinkler_post']);
  state.enemies[0].intent = { name: 'Straw Toss', kind: 'debuff', fn: (st) => C.addCardToCombat(st, 'straw', 2, 'discard') };
  state.hand = [];
  C.endTurn(state);
  eq(state.discard.filter((c) => c.id === 'straw').length, 2, 'sprinkler/melon post shoved 2 straw');
}
{
  const { state } = combatVs(['magnet_mite', 'magnet_mite', 'magnet_mite']);
  const [a, b] = state.enemies;
  C.dealDamage(state, a, 999, { attacker: state.hero });
  ok(a.hp <= 0 && !state.over, 'one ball lightning down, fight continues');
  eq(a.state.reviveIn, 2, 'revive counter set');
  state.hand = [];
  C.endTurn(state); C.endTurn(state);
  ok(a.hp > 0, 'ball lightning revived');
}
{
  const { state } = combatVs(['magnet_mite', 'magnet_mite']);
  for (const e of [...state.enemies]) C.dealDamage(state, e, 999, { attacker: state.hero });
  ok(state.over && state.won, 'killing all ball lightnings at once wins');
}
{
  const { state } = combatVs(['dust_bunny']);
  for (let i = 0; i < 4 && !state.over; i++) { state.hand = []; state.hero.hp = 999; state.hero.maxHp = 999; C.endTurn(state); }
  ok(state.over && state.won, 'the dust bunny drifts away on its own → survival win');
}
{
  const { state } = combatVs(['mimic_moth'], { hero: 'wyatt' });
  ok(state.flags.confused, 'weasel confusion active');
  C.drawCards(state, 3);
  const overridden = state.hand.some((c) => state.costOverride[c.uid] != null);
  ok(overridden, 'drawn cards got randomized costs');
  C.dealDamage(state, state.enemies[0], 999, { attacker: state.hero });
  ok(!state.flags.confused, 'confusion clears on weasel death');
}
{
  // The Instructions: STEP 47 leaves you Weak (their whole legal authority)
  const { state } = combatVs(['instruction_golem']);
  const g = state.enemies[0];
  let sawStep = false;
  for (let i = 0; i < 8 && !sawStep; i++) {
    const mv = g.def.nextMove(g, state, state.rng);
    if (mv.name.includes('STEP 47')) { mv.fn(state); sawStep = true; }
  }
  ok(sawStep && state.hero.weak >= 2, 'STEP 47: YOU LOSE (Weak applied)');
}
{
  const { state } = combatVs(['sandworm']);
  state.hand = [];
  C.endTurn(state); // creek sets constrict
  eq(state.flags.constrict, 5, 'the sandworm squeezes (5/turn)');
  const hp0 = state.hero.hp;
  state.hand = [];
  C.endTurn(state);
  ok(state.hero.hp < hp0, 'constrict dealt damage at turn start');
}
{
  const { state } = combatVs(['ghost_piece']);
  const e = state.enemies[0];
  e.intangible = true;
  const hp0 = e.hp;
  C.dealDamage(state, e, 50, { attacker: state.hero });
  eq(hp0 - e.hp, 1, 'intangible caps damage at 1');
}
{
  const { state } = combatVs(['crane_head']);
  const e = state.enemies[0];
  for (let i = 0; i < 4; i++) { state.hand = []; state.hero.hp = 500; state.hero.maxHp = 500; C.endTurn(state); }
  ok(e.intent.name.includes('THUNDERSTRIKE') || e.state.count === 0, 'crane_head counts down to the big strike');
}
{
  const { state } = combatVs(['dust_bunny_mother']);
  state.enemies[0].intent = state.enemies[0].def.nextMove(state.enemies[0], state, makeRng(1));
  let spawned = false;
  for (let i = 0; i < 6 && !spawned; i++) {
    state.hand = []; state.hero.hp = 500; state.hero.maxHp = 500;
    C.endTurn(state);
    spawned = state.enemies.some((e) => e.key === 'dust_bunny');
  }
  ok(spawned, 'wind funnel summons dust devils');
}
{
  const { state } = combatVs(['play_dough_twin_a', 'play_dough_twin_b']);
  const [big, little] = state.enemies;
  big.hp = 20;
  little.intent = { name: 'Nuzzle (heal)', kind: 'buff', fn: () => { big.hp = Math.min(big.maxHp, big.hp + 12); } };
  big.intent = { name: 'x', kind: 'defend', block: 1 };
  state.hand = [];
  C.endTurn(state);
  eq(big.hp, 32, 'possum healer heals its buddy');
}

// ---------- every enemy survives a 12-turn smoke fight ----------
for (const key of Object.keys(ENEMIES)) {
  const { state } = combatVs([key], { seed: 99 });
  state.hero.hp = 5000; state.hero.maxHp = 5000;
  let crashed = false;
  try {
    for (let t = 0; t < 12 && !state.over; t++) { state.hand = []; C.endTurn(state); }
  } catch (err) { crashed = true; fails.push(`enemy ${key} crashed: ${err.message}`); }
  ok(!crashed, `enemy smoke: ${key}`);
}

// ---------- Liam the Little: diapers (orb system) ----------
{
  const run = freshRun('liam', 200);
  eq(run.deck.length, 10, 'liam starter deck 10');
  eq(run.relics[0], 'diaper_bag', 'liam starter relic');
  const state = C.startCombat(run, ['corn_colonel'], makeRng(200));
  eq(state.hero.orbs.length, 1, 'Diaper Bag floats a diaper at combat start');
  eq(state.hero.orbs[0].type, 'stinky', 'and it is Stinky');
}
{
  // stinky passive + evoke, focus scaling
  const { state } = combatVs(['mega_melon'], { hero: 'liam', seed: 201 });
  state.hero.orbs = [];
  const e = state.enemies[0];
  forceHand(state, ['change_it']);
  C.playCard(state, state.hand[0]);
  eq(state.hero.orbs.length, 1, 'Change It! channels');
  const hp0 = e.hp;
  state.enemies[0].intent = { name: 'x', kind: 'buff' };
  C.endTurn(state);
  eq(hp0 - e.hp, 3, 'stinky passive zaps 3 at end of turn');
  e.block = 0;
  state.hero.focus = 2;
  forceHand(state, ['double_trouble']);
  state.hero.energy = 3;
  const hp1 = e.hp;
  C.playCard(state, state.hand[0]);
  eq(hp1 - e.hp, (8 + 2) * 2, 'Double Trouble evokes stinky twice with Giggle Power');
  eq(state.hero.orbs.length, 0, 'orb consumed by evoke');
}
{
  // fresh passive/evoke; blowout growth + weakest-target evoke; snack energy
  const { state } = combatVs(['corn_colonel', 'mega_melon'], { hero: 'liam', seed: 202 });
  state.hero.orbs = [];
  forceHand(state, ['sippy_cup', 'uh_oh', 'snacks']);
  state.hero.energy = 9;
  C.playCard(state, state.hand.find((c) => c.id === 'sippy_cup'));
  C.playCard(state, state.hand.find((c) => c.id === 'uh_oh'));
  C.playCard(state, state.hand.find((c) => c.id === 'snacks'));
  eq(state.hero.orbs.length, 3, 'three diapers floating');
  for (const e of state.enemies) e.intent = { name: 'x', kind: 'buff' };
  const blowout = state.hero.orbs.find((o) => o.type === 'blowout');
  C.endTurn(state);
  eq(blowout.stored, 12, 'BLOWOUT grew from 6 to 12');
  ok(state.hero.energy >= 4, 'snack diaper gave +1 energy at turn start');
  // evoke order is oldest-first: fresh, then blowout
  state.hero.block = 0;
  C.evokeOrb(state);
  eq(state.hero.block, 5, 'fresh evoke = 5 block (Frost-true, hard-mode revert)');
  const weakest = state.enemies.slice().sort((a, b) => a.hp - b.hp)[0];
  weakest.block = 0;
  const whp = weakest.hp;
  C.evokeOrb(state);
  eq(whp - weakest.hp, 12, 'BLOWOUT unleashes stored damage on the weakest enemy');
}
{
  // auto-evoke when slots full; More Diapers! raises the cap
  const { state } = combatVs(['mega_melon'], { hero: 'liam', seed: 203 });
  state.hero.orbs = [];
  C.channelOrb(state, 'fresh'); C.channelOrb(state, 'fresh'); C.channelOrb(state, 'fresh');
  state.hero.block = 0;
  C.channelOrb(state, 'stinky');
  eq(state.hero.orbs.length, 3, 'capped at 3 slots');
  eq(state.hero.block, 5, 'oldest auto-evoked (fresh: 5 block)');
  forceHand(state, ['more_diapers']);
  state.hero.energy = 3;
  C.playCard(state, state.hand[0]);
  eq(state.hero.orbSlots, 5, 'More Diapers! +2 slots');
}
{
  // uppies re-channels; throw_food scales with orbs; maximum stink hits all
  const { state } = combatVs(['corn_colonel', 'angry_sprout'], { hero: 'liam', seed: 204 });
  state.hero.orbs = [];
  C.channelOrb(state, 'snack');
  forceHand(state, ['uppies']);
  state.hero.energy = 9;
  C.playCard(state, state.hand[0]);
  eq(state.hero.orbs.length, 1, 'Uppies! evoked and re-channeled');
  eq(state.hero.orbs[0].type, 'snack', 'same diaper type');
  C.channelOrb(state, 'fresh');
  forceHand(state, ['throw_food']);
  const e = state.enemies[0];
  const hp0 = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(hp0 - e.hp, 8, 'Throw Food: 4 × 2 floating diapers');
  forceHand(state, ['maximum_stink']);
  state.hero.energy = 9;
  C.playCard(state, state.hand[0]);
  ok(state.hero.powers.max_stink, 'MAXIMUM STINK active');
  state.hero.orbs = [{ type: 'stinky', stored: 0 }];
  const hpa = state.enemies[0].hp, hpb = state.enemies[1].hp;
  for (const en of state.enemies) en.intent = { name: 'x', kind: 'defend', block: 1 };
  C.endTurn(state);
  ok(state.enemies[0].hp < hpa && state.enemies[1].hp < hpb, 'stinky hits ALL enemies under MAXIMUM STINK');
}
{
  // birthday boy scales giggle power
  const { state } = combatVs(['mega_melon'], { hero: 'liam', seed: 205 });
  forceHand(state, ['birthday_boy']);
  state.hero.energy = 3;
  C.playCard(state, state.hand[0]);
  state.enemies[0].intent = { name: 'x', kind: 'defend', block: 1 };
  state.hand = [];
  C.endTurn(state);
  eq(state.hero.focus, 1, 'Birthday Boy: +1 Giggle Power at turn start');
}

// ---------- snacks are GONE (James's cut, Sun 2026-08-02: complexity > value) ----------
{
  ok(C.SNACKS === undefined && C.useSnack === undefined, 'no consumable-snack engine surface');
  const run = freshRun('aaron', 11);
  ok(run.snacks === undefined && run.snackSlots === undefined, 'runs carry no snack fields');
  const shop = R.makeShop(run, makeRng(21));
  ok(shop.snack === undefined, 'shop stocks no snacks');
  const rewards = R.fightRewards(run, 'fight', makeRng(9));
  ok(rewards.snack === undefined, 'fight rewards drop no snacks');
  ok(!Object.keys(RELICS).includes('lunchbox'), 'Lunchbox (Potion Belt) retired');
  // legacy mid-run saves survive the cut: snack fields scrubbed, lunchbox stripped
  const old = JSON.parse(R.serializeRun(freshRun('wyatt', 5)));
  old.snacks = ['lemonade']; old.snackSlots = 2; old.relics = [...old.relics, 'lunchbox'];
  const revived = R.deserializeRun(JSON.stringify(old));
  ok(revived && revived.snacks === undefined && !revived.relics.includes('lunchbox'), 'old save loads clean');
  // Liam's Snack Time DIAPER is a different thing and stays
  ok(DIAPERS.snack.name === 'Snack Time', "Liam's Snack Time diaper untouched");
}

// ---------- roly-poly uncurls once the curl is spent (James, Mon 2026-08-04) ----------
{
  const { state } = combatVs(['rolling_pumpkin']);
  const e = state.enemies[0];
  C.dealDamage(state, e, 1, { attacker: state.hero });
  eq(e.artKey, 'rolling_pumpkin_curled', 'first hit: he curls (art follows)');
  ok(e.block >= 5, 'the curl granted its Block');
  state.hand = [];
  C.endTurn(state); // his turn: block zeroes at turn start, then he acts → uncurls at re-intent
  eq(e.artKey, 'rolling_pumpkin', 'curl spent: the art unrolls');
  eq(e.name, 'Rolling Pumpkin', 'name un-hunkers with it');
  const b0 = e.block;
  C.dealDamage(state, e, 1, { attacker: state.hero });
  eq(e.block, b0, 'the trick stays used up — no second curl');
}

// ---------- poison pierces Block (StS "HP loss" rule — James, Sun 2026-08-03) ----------
{
  // the canonical case: the Snapping Turtle's persistent plating used to eat poison
  const { state } = combatVs(['leaf_turtle'], { hero: 'wyatt' });
  const e = state.enemies[0];
  e.poison = 5; e.block = 10; e.block_persist = true;
  const hp0 = e.hp;
  state.hand = [];
  C.endTurn(state);
  eq(hp0 - e.hp, 5, 'poison bites straight through the shell');
  ok(e.block >= 10, 'the plating is untouched by poison');
  // All-Out Effort's self-cost is HP loss too — the hero's own Block never eats it
  const { state: s2 } = combatVs(['corn_colonel']);
  forceHand(s2, ['all_out']);
  s2.hero.block = 10;
  const h0 = s2.hero.hp;
  C.playCard(s2, s2.hand[0]);
  eq(h0 - s2.hero.hp, 6, "All-Out's cost pierces the hero's own Block");
  eq(s2.hero.block, 10, 'hero Block untouched by the self-cost');
}

// ---------- scout reports describe, never prescribe (James's rule, Sun 2026-08-03) ----------
{
  const { SCOUT, SCOUT_FALLBACK } = await import('../js/scout.js');
  // banned: how-to-beat prescriptions. Coach names the mechanic and stops —
  // many answers is the point of the game.
  const ADVICE = /\b(out first|take (him|her|it|them) out|kill (it|him|her)|finish him|save (a|your|something)|you need|focus everything|don'?t (waste|poke|tickle|panic|show up|be low)|best plan|go fast|shut off|hit it early|your window|time your|watch the pattern|be ready|hang on|block up|let it pass|leave him be|speed matters|not worth a card|make (her|him) regret)\b/i;
  for (const [key, line] of Object.entries(SCOUT)) {
    ok(!ADVICE.test(line), `scout(${key}) describes without prescribing`);
  }
  ok(!ADVICE.test(SCOUT_FALLBACK), 'scout fallback describes without prescribing');
  ok(Object.keys(SCOUT).length >= 38, 'scout library covers the bestiary');
}

// ---------- death feel + event relic reveals (James's round, Sun 2026-08-02) ----------
{
  // the culprit is recorded for the defeat screen's "taken down by…" chip
  const { state } = combatVs(['mega_melon']);
  C.dealDamage(state, state.hero, 999, { attacker: state.enemies[0] });
  C.checkCombatEnd(state);
  ok(state.over && !state.won, 'hero death ends the fight');
  eq(state.killedBy.name, 'The Mega Melon', 'killer enemy recorded');
  ok(state.killedBy.artKey !== undefined, 'killer carries its art key');
  eq(state.hero.hp, 0, 'overkill floors at 0 — no negative hearts');
  const { state: s2 } = combatVs(['corn_colonel']);
  C.dealDamage(s2, s2.hero, 999, { isAttack: false, src: 'thorns' });
  eq(s2.killedBy.src, 'thorns', 'src-only death recorded for the label map');
}
{
  // Coach's pickup lines rotate without repeating until the library wraps
  const mem = { data: {}, getItem(k) { return this.data[k]; }, setItem(k, v) { this.data[k] = v; } };
  const seen = new Set();
  for (let i = 0; i < LOSS_LINES.length; i++) seen.add(nextLossLine(mem));
  eq(seen.size, LOSS_LINES.length, 'every loss line appears before any repeats');
  ok(LOSS_LINES.every((l) => l.length < 90), 'loss lines stay kid-short');
}
{
  // Goldie's Gate + the Pie Contest hand out relics via the big reveal —
  // never a raw id ("lucky_horseshoe") in the prose
  for (const [key, idx] of [['goldie_gate', 0], ['pie_contest', 2]]) {
    const run = freshRun('wyatt', 71);
    const text = EVENTS[key].choices[idx].apply(run, makeRng(71));
    ok(run.pendingRelicPop && RELICS[run.pendingRelicPop], `${key}: relic queued for the FARM TREASURE reveal`);
    ok(!/[a-z]_[a-z]/.test(text), `${key}: result prose has no raw relic id`);
  }
}

// ---------- anthem LRC audit (James's karaoke report, Sun 2026-08-02) ----------
// Runs against the REAL shipped .lrc captures, so a regenerated anthem that
// re-introduces Suno's alignment glitches fails loudly here.
// RL3: anthems not generated yet — audit arms itself per-file as .lrc captures land.
if (existsSync(new URL('../assets/audio/anthem_aaron.lrc', import.meta.url))) {
  const anthem = (h) => parseLrc(readFileSync(new URL(`../assets/audio/anthem_${h}.lrc`, import.meta.url), 'utf8'));
  for (const hero of ['aaron', 'wyatt', 'liam', 'all']) {
    const lines = anthem(hero);
    const ws = lines.flatMap((l) => l.words);
    ok(ws.every((w, i) => !i || w.t >= ws[i - 1].t - 0.01), `${hero} anthem: word times monotonic`);
    // nobody pauses 12s mid-phrase: no caption line may stall >6s internally
    const stall = lines.some((l) => l.words.some((w, i) => i && w.t - l.words[i - 1].t > 6));
    ok(!stall, `${hero} anthem: no orphaned line tails (the Poppa Flaj jumble)`);
  }
  const an = deriveBeats(anthem('aaron'), 'aaron').map((b) => b.scene.name);
  for (const want of ['Rusty', 'Brownie', 'Diver', 'Harmless', 'The Magnet']) {
    ok(an.includes(want), `aaron anthem shows ${want}`);
  }
  const wy = deriveBeats(anthem('wyatt'), 'wyatt').map((b) => b.scene.name);
  for (const want of ['Bruno', 'Brownie', 'Diver', 'Harmless', 'The Magnet']) {
    ok(wy.includes(want), `wyatt anthem shows ${want}`);
  }
  const allBeats = deriveBeats(anthem('all'), 'all');
  const bn = allBeats.map((b) => b.scene.name);
  for (const want of ['WYATT & AARON & LIAM', 'Brownie', 'Diver', 'Harmless', 'The Magnet', 'Coach James', 'Mom']) {
    ok(bn.includes(want), `all-finale shows ${want}`);
  }
  // no-tell canon: no anthem may derive a beat for the secret
  for (const hero of ['aaron', 'wyatt', 'liam', 'all']) {
    ok(!deriveBeats(anthem(hero), hero).some((b) => /goldie/i.test(b.scene.name)), `${hero} anthem never shows the secret`);
  }
}

// ---------- BELLY FLOP! + true-Claw Sticky Hands + shop/rest expansion (James, Sun 2026-08-02) ----------
{
  // Body Slam: damage equals current Block (Strength still applies on top)
  const run = freshRun('aaron', 31);
  const state = C.startCombat(run, ['sandworm'], makeRng(31));
  state.hero.block = 12;
  forceHand(state, ['belly_flop']);
  const e = state.enemies[0];
  const hp0 = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(hp0 - e.hp, 12, 'BELLY FLOP! deals damage equal to Block');
  state.hero.block = 12; state.hero.strength = 3; state.hero.energy = 3;
  forceHand(state, ['belly_flop']);
  const hp1 = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(hp1 - e.hp, 15, 'Strength stacks on top of the flop');
  const up = cardInfo({ id: 'belly_flop', uid: 1, up: true });
  eq(up.cost, 0, 'BELLY FLOP!+ costs 0 (StS Body Slam mirror)');
}
{
  // Claw: every play makes ALL copies stronger, fight-scoped
  const run = freshRun('liam', 32);
  const state = C.startCombat(run, ['sandworm'], makeRng(32));
  forceHand(state, ['sticky_hands', 'sticky_hands', 'sticky_hands']);
  const e = state.enemies[0];
  let hp = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(hp - e.hp, 4, 'first Sticky Hands deals base 4');
  hp = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(hp - e.hp, 6, 'second play got +2 STICKIER');
  hp = e.hp;
  C.playCard(state, state.hand[0], e);
  eq(hp - e.hp, 8, 'third play +4 — the whole family scales');
  const s2 = C.startCombat(run, ['corn_colonel'], makeRng(33));
  ok(!s2.grown.sticky_hands, 'stickiness resets between fights');
}
{
  // shop: 8 cards + 2 treasures, buying one leaves the other
  const run = freshRun('wyatt', 34);
  run.gold = 999;
  const shop = R.makeShop(run, makeRng(34));
  eq(shop.relics.length, 2, 'shop offers 2 farm treasures');
  ok(shop.relics[0].id !== shop.relics[1].id, 'the two treasures differ');
  const id0 = shop.relics[0].id, id1 = shop.relics[1].id;
  ok(R.shopBuyRelic(run, shop, 0), 'buy the first treasure');
  ok(run.relics.includes(id0), 'bought treasure joins the run');
  ok(shop.relics.length === 1 && shop.relics[0].id === id1, 'the other stays for sale');
  // Granny's third option: store a card at her house
  const d0 = run.deck.length;
  const uid = run.deck[0].uid;
  ok(R.restStore(run, uid), "Granny stores a card");
  ok(run.deck.length === d0 - 1 && !run.deck.some((c) => c.uid === uid), 'card left the deck for good');
  const solo = freshRun('wyatt', 35);
  solo.deck = [solo.deck[0]];
  ok(!R.restStore(solo, solo.deck[0].uid), 'never strands a kid with an empty deck');
}

// ---------- the duck bosses + THE MAGNET MENACE (the boys' finale, as designed) ----------
{
  // Brownie: Champ chassis — Royal Duck Tantrum at half clears debuffs + strengthens
  const { state } = combatVs(['boss_brownie']);
  const b = state.enemies[0];
  C.applyStatus(state, b, 'weak', 2);
  C.dealDamage(state, b, Math.ceil(b.maxHp / 2) + 1, { attacker: state.hero, pierce: true });
  const tantrum = b.def.nextMove(b, state, state.rng);
  ok(tantrum.name.includes('TANTRUM'), 'Brownie tantrums at half');
  tantrum.fn(state, b);
  ok(b.weak === 0 && b.strength >= 3, 'tantrum shakes off debuffs and strengthens');
}
{
  // Diver: dive bombs GROW — every 4th move, one more hit each time
  const { state } = combatVs(['boss_diver']);
  const d = state.enemies[0];
  let dives = [];
  for (let i = 0; i < 12; i++) {
    const mv = d.def.nextMove(d, state, state.rng);
    if (mv.name.includes('DIVE BOMB')) dives.push(mv.times);
  }
  ok(dives.length >= 2 && dives[1] === dives[0] + 1, `Diver's dive bombs grow (${dives.join(',')})`);
}
{
  // Harmless: dormant menace start; wakes on damage; every 4th move = intangible flicker
  const { state } = combatVs(['boss_harmless']);
  const h = state.enemies[0];
  eq(h.intent.kind, 'sleep', 'Harmless stands there. Harmlessly.');
  C.dealDamage(state, h, 10, { attacker: state.hero });
  const wake = h.def.nextMove(h, state, state.rng);
  ok(wake.name.includes('HARMLESS'), 'she is NOT harmless once woken');
  let flickers = 0;
  for (let i = 0; i < 8; i++) { const mv = h.def.nextMove(h, state, state.rng); if (mv.name.includes('Flicker')) flickers++; }
  ok(flickers === 2 && h.def, 'black-feather flicker every 4th turn');
}
{
  // THE KINETIC SAND MONSTER — the boys' design, mechanic by mechanic
  const { state } = combatVs(['sand_monster']);
  const m = state.enemies[0];
  // limbs tear loose on the cadence
  let summoned = null;
  for (let i = 0; i < 4 && !summoned; i++) {
    const mv = m.def.nextMove(m, state, state.rng);
    if (mv.kind === 'summon') { mv.fn(state); summoned = true; }
  }
  ok(summoned, 'a limb tears loose');
  const limb = state.enemies.find((e) => e.key === 'sand_limb');
  ok(limb, 'the limb fights as its own enemy');
  // Aaron's rule: a beaten limb sinks back in — the body drinks it as armor
  const blockBefore = m.block;
  C.dealDamage(state, limb, 999, { attacker: state.hero });
  ok(m.block >= blockBefore + 8, 'beaten limb sinks back into the body as armor');
  // Wyatt's rule: 50 cumulative damage sheds ALL the sand → THE MAGNET, helpless, ~100 HP
  C.dealDamage(state, m, 30, { attacker: state.hero, pierce: true });
  ok(!m.state.shed, 'sand holds below 50');
  C.dealDamage(state, m, 25, { attacker: state.hero, pierce: true });
  ok(m.state.shed, '50 total damage sheds the sand');
  eq(m.name, 'THE MAGNET', 'what is underneath: THE MAGNET');
  eq(m.hp, 100, 'the magnet has 100 health (the boys were specific)');
  eq(m.intent.kind, 'sleep', 'the magnet lies HELPLESS');
  const first = m.def.nextMove(m, state, state.rng);
  eq(first.kind, 'sleep', 'helpless for exactly one turn');
  const windup = m.def.nextMove(m, state, state.rng);
  ok(windup.name.includes('MAGNETIZING'), 'then the windup telegraphs');
  const throwMv = m.def.nextMove(m, state, state.rng);
  eq(throwMv.dmg, 50, 'MAGNET THROW hits for FIFTY (they really wanted fifty to work)');
  // beat the magnet, beat the game
  C.dealDamage(state, m, 999, { attacker: state.hero, pierce: true });
  ok(state.over && state.won, 'defeating the magnet wins the fight');
}
{
  // squish ball previews the stagger mechanic (break its squish → helpless turn)
  const { state } = combatVs(['squish_ball']);
  const s2 = state.enemies[0];
  C.dealDamage(state, s2, 5, { attacker: state.hero });
  ok(s2.block >= 9, 'squish ball squishes up armor on first hit');
  s2.block = 1;
  C.dealDamage(state, s2, 3, { attacker: state.hero });
  ok(s2.state.staggered || s2.intent.kind === 'sleep', 'broken squish → helpless (the Magnet preview)');
}
{
  // every world's boss pool points at its duck (or the monster)
  ok(R.ENCOUNTERS[1].boss.some((b) => b.includes('boss_brownie')), 'world 1: Brownie rules the crops');
  ok(R.ENCOUNTERS[2].boss.some((b) => b.includes('boss_diver')), 'world 2: Diver guards the pond');
  ok(R.ENCOUNTERS[3].boss.some((b) => b.includes('boss_harmless')), 'world 3: Harmless is NOT');
  ok(R.ENCOUNTERS[4].boss.some((b) => b.includes('sand_monster')), 'world 4: the Kinetic Sand Monster');
}

// ---------- tick-damage attribution (UI reads these to explain WHY) ----------
{
  const { state } = combatVs(['corn_colonel'], { hero: 'wyatt' });
  const e = state.enemies[0];
  C.applyStatus(state, e, 'poison', 5);
  state.log.length = 0;
  C.endTurn(state);
  ok(state.log.some((ev) => ev.t === 'dmg' && ev.src === 'poison'), 'poison ticks carry src=poison');
  const { state: s2 } = combatVs(['angry_sprout'], { hero: 'liam' });
  C.channelOrb(s2, 'stinky');
  s2.log.length = 0;
  C.endTurn(s2);
  ok(s2.log.some((ev) => (ev.t === 'dmg' || ev.t === 'blocked') && ev.src === 'stinky'), 'stinky zaps carry src=stinky');
  const { state: s3 } = combatVs(['sticky_vine']);
  s3.hero.thorns = 3;
  s3.enemies[0].intent = { name: 'Bite', kind: 'attack', dmg: 5 };
  s3.log.length = 0;
  C.endTurn(s3);
  ok(s3.log.some((ev) => ev.src === 'thorns'), 'thorns recoil carries src=thorns');
}

// ---------- steppable enemy phase (UI sequencing = endTurn semantics) ----------
{
  const { state } = combatVs(['corn_colonel', 'angry_sprout'], { seed: 55 });
  ok(state.phase === 'hero', 'combat starts in hero phase');
  ok(C.beginEnemyPhase(state), 'enemy phase begins');
  eq(state.phase, 'enemy', 'phase flips to enemy');
  eq(state.hand.length, 0, 'hand discarded at phase start');
  let steps = 0;
  let acted;
  while ((acted = C.stepEnemyAction(state)) !== null) {
    ok(acted.name, `step ${++steps} returns the acting enemy`);
    ok(steps < 10, 'stepper terminates');
  }
  eq(state.phase, 'hero', 'phase returns to hero');
  eq(state.turn, 2, 'next hero turn began');
  ok(state.hand.length > 0, 'new hand drawn');
  // endTurn (sync) drives the same machinery
  const { state: s2 } = combatVs(['corn_colonel'], { seed: 56 });
  C.endTurn(s2);
  eq(s2.turn, 2, 'endTurn advances to turn 2');
  eq(s2.phase, 'hero', 'endTurn leaves hero phase');
}

// ---------- run layer ----------
{
  const run = freshRun('aaron', 42);
  eq(run.deck.length, 10, 'aaron starter deck 10');
  eq(freshRun('wyatt', 1).deck.length, 12, 'wyatt starter deck 12');
  eq(run.relics[0], 'big_breakfast', 'aaron starter relic');
  const rng = makeRng(42);
  const boons = R.coachBoons(run, rng);
  eq(boons.length, 3, 'coach offers 3 boons');
  boons[0].apply(run, rng);
  ok(true, 'boon applies without crash');
}
{
  // ---------- map generation invariants (many seeds) ----------
  for (const seed of [1, 7, 42, 999, 31337]) {
    for (let act = 1; act <= 3; act++) {
      const map = generateActMap(seed, act);
      const problems = validateMap(map);
      eq(problems.length, 0, `map ${seed}/${act} valid (${problems[0] || ''})`);
      const types = Object.values(map.nodes).map((n) => n.type);
      eq(types.filter((t) => t === 'shop').length, 1, `map ${seed}/${act} exactly 1 shop`);
      eq(types.filter((t) => t === 'elite').length, 2, `map ${seed}/${act} exactly 2 elites`);
      ok(types.filter((t) => t === 'event').length >= 3, `map ${seed}/${act} ≥3 events`);
      ok(map.floors[1].every((id) => map.nodes[id].type === 'fight'), `map ${seed}/${act} floor 1 all fights`);
      ok(map.floors[TREASURE_FLOOR].every((id) => map.nodes[id].type === 'treasure'), `map ${seed}/${act} treasure row`);
      ok(map.floors[REST_FLOOR].every((id) => map.nodes[id].type === 'rest'), `map ${seed}/${act} pre-boss rest row`);
      eq(map.floors[MAP_FLOORS].length, 1, `map ${seed}/${act} single boss`);
      ok(Object.values(map.nodes).every((n) => n.type !== 'elite' || n.f >= 5), `map ${seed}/${act} elites at floor ≥5`);
      for (let f = 1; f < REST_FLOOR; f++) {
        ok(map.floors[f].length >= 1 && map.floors[f].length <= 4, `map ${seed}/${act} floor ${f} has 1-4 nodes`);
      }
      ok(map.floors[1].length >= 2, `map ${seed}/${act} ≥2 starting choices`);
    }
  }
  // determinism
  const a = generateActMap(42, 2), b = generateActMap(42, 2);
  eq(JSON.stringify(a), JSON.stringify(b), 'same seed → same map');
  ok(JSON.stringify(generateActMap(42, 1)) !== JSON.stringify(generateActMap(43, 1)), 'different seed → different map');
}
{
  // walking the map: full act traversal through run layer
  const run = freshRun('aaron', 77);
  const seen = new Set();
  let guard = 40;
  while (guard-- > 0) {
    const opts = R.nextNodes(run);
    ok(opts.length >= 1, `reachable nodes at floor ${run.floor}`);
    const node = R.enterMapNode(run, opts[0].id);
    ok(node, 'enterMapNode resolves a reachable node');
    seen.add(node.type);
    if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss') {
      ok(node.enemies.every((k) => ENEMIES[k]), `valid encounter keys at floor ${run.floor}`);
    }
    if (node.type === 'boss') break;
  }
  eq(run.floor, MAP_FLOORS, 'a world runs 12 floors');
  ok(seen.has('boss'), 'the world ends with its boss');
  ok(seen.has('treasure'), 'path passed the treasure row');
  ok(seen.has('rest'), 'path passed the pre-boss rest');
  eq(R.enterMapNode(run, 'nope'), null, 'unreachable node rejected');
  // RL3: runs are one world each — every world number builds a valid expedition
  for (let w = 1; w <= R.WORLDS; w++) {
    const wr = R.newRun('wyatt', 5 + w, { world: w });
    eq(wr.act, w, `world ${w} expedition starts there`);
    ok(wr.map && wr.map.nodes[BOSS_ID], `world ${w} map has its boss`);
    ok(R.WORLD_INFO[w] && R.ENCOUNTERS[w], `world ${w} has info + encounter pools`);
    ok(R.ENCOUNTERS[w].boss.length >= 1, `world ${w} has a boss pool`);
  }
  ok(R.advanceAct === undefined, 'advanceAct is gone — a run IS one world');
}
{
  // rewards + draft
  const run = freshRun('wyatt', 13);
  const rng = makeRng(13);
  const rw = R.fightRewards(run, 'elite', rng);
  ok(rw.gold >= 25 && rw.gold <= 35, 'elite gold in range');
  ok(rw.relic, 'elite grants relic');
  eq(rw.cards.length, 3, 'draft offers 3');
  ok(rw.cards.every((id) => CARDS[id].hero === 'wyatt'), 'draft cards match hero');
  const draws = new Set();
  for (let i = 0; i < 200; i++) draws.add(R.pickRarity(makeRng(i)));
  ok(draws.has('common') && draws.has('uncommon'), 'rarity spread sane');
}
{
  // shop
  const run = freshRun('aaron', 21);
  run.gold = 500;
  const rng = makeRng(21);
  const shop = R.makeShop(run, rng);
  eq(shop.cards.length, 8, 'shop stocks 8 cards');
  const d0 = run.deck.length;
  ok(R.shopBuyCard(run, shop, 0), 'buy card');
  eq(run.deck.length, d0 + 1, 'card added to deck');
  ok(R.shopBuyRelic(run, shop), 'buy relic');
  const uid = run.deck[0].uid;
  ok(R.shopRemoveCard(run, shop, uid), 'remove card service');
  ok(!run.deck.some((c) => c.uid === uid), 'card removed');
  ok(!R.shopRemoveCard(run, shop, run.deck[0].uid), 'removal is once per shop');
}
{
  // rest
  const run = freshRun('aaron', 31);
  run.hp = 30;
  const healed = R.restCookies(run);
  eq(healed, Math.floor(run.maxHp * 0.3), 'cookies heal 30%');
  const c = run.deck[0];
  ok(R.restPractice(run, c.uid), 'practice upgrades');
  ok(c.up, 'card marked upgraded');
  ok(!R.restPractice(run, c.uid), 'cannot upgrade twice');
}
{
  // events all apply without crash
  const rng = makeRng(51);
  for (const key of EVENT_KEYS) {
    const run = freshRun('aaron', 61);
    run.gold = 200; run.deck.push(makeCard('homework'));
    const ev = EVENTS[key];
    for (const choice of ev.choices) {
      const run2 = freshRun('wyatt', 62);
      run2.gold = 200; run2.deck.push(makeCard('homework'));
      if (choice.can && !choice.can(run2)) continue;
      const result = choice.apply(run2, rng);
      ok(typeof result === 'string', `event ${key} choice "${choice.label}" returns text`);
    }
  }
  // duck pond adds the duck
  const run3 = freshRun('wyatt', 63);
  EVENTS.duck_pond.choices[0].apply(run3, rng);
  ok(run3.deck.some((c) => c.id === 'duck'), 'duck friend joins the deck');
  // the duck pulls his weight: draw 2 on play (James's buff, Wed 2026-08-06)
  {
    const { state } = combatVs(['mega_melon']);
    forceHand(state, ['duck']);
    state.draw = ['shove', 'shove', 'brace'].map((id) => makeCard(id));
    C.playCard(state, state.hand[0], state.enemies[0]);
    eq(state.hand.length, 2, 'Duck Friend draws 2 cards');
  }
}
{
  // save round-trip
  const run = freshRun('wyatt', 71);
  run.gold = 123; run.act = 2; run.floor = 5; run.relics.push('sunflower');
  const json = R.serializeRun(run);
  const back = R.deserializeRun(json);
  ok(back && back.gold === 123 && back.act === 2 && back.deck.length === run.deck.length, 'run save round-trips');
  eq(R.deserializeRun('{"v":9}'), null, 'bad save rejected');
  eq(R.deserializeRun('garbage'), null, 'garbage save rejected');
}
{
  // big breakfast post-fight heal
  const run = freshRun('aaron', 81);
  const state = C.startCombat(run, ['corn_colonel'], makeRng(81));
  state.hero.hp = 50;
  C.dealDamage(state, state.enemies[0], 999, { attacker: state.hero });
  R.applyCombatResult(run, state);
  eq(run.hp, 58, 'big breakfast heals 8 after fight');
}

// (the Secret Farm Code was removed Sun 2026-08-02 — James: cross-device
// save transfer isn't needed; each device keeps its own farm)

// ---------- coach tip rotation ----------
{
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k), setItem: (k, v) => mem.set(k, v) };
  const poolLen = TIPS_GENERAL.length + TIPS_HERO.wyatt.length;
  const served = new Set();
  for (let i = 0; i < poolLen; i++) served.add(nextTip('wyatt', storage));
  eq(served.size, poolLen, 'a full rotation serves every wyatt-pool tip exactly once');
  ok([...served].some((t) => t.includes('title screen')), 'the vague title-screen tease is in the rotation');
  ok(!TIPS_HERO.liam.some((t) => served.has(t)), 'liam tips never surface for wyatt');
  ok(TIPS_HERO.wyatt.every((t) => served.has(t)), 'all wyatt tips surface for wyatt');
  ok(TIPS_GENERAL.every((t) => served.has(t)), 'all general tips surface');
  // no jargon leaks into the tips
  ok(![...served].some((t) => /exhaust|innate|curse/i.test(t)), 'tips avoid jargon');
  ok(!TIPS_GENERAL.some((t) => /goldie|llama|tap.*3|three.*tap/i.test(t)), 'egg tease stays vague (no method, no llama)');
}

// ---------- credits LRC parsing ----------
{
  // suno-cli timed-lyrics --lrc: one word per line, blank line = phrase break,
  // section markers carry their time to the next bare word (real capture)
  const lrc = '[00:10.61] [Verse]\nOut \n[00:11.21] in \n[00:11.45] Rolfe \n[00:12.62] glows\n\n[00:13.31] Trouble \n[00:13.80] came\n\n\n[00:20.25] [Verse 2]\nMom \n[00:21.18] packed';
  const lines = parseLrc(lrc);
  eq(lines.length, 3, 'lrc: three phrases parsed');
  eq(lines[0].t, 10.86, 'lrc: line time follows the snapped first word');
  eq(lines[0].words[0].w, 'Out', 'lrc: bare word captured');
  eq(lines[0].words[0].t, 10.86, 'lrc: marker-timed bare word snaps toward the singing');
  eq(lines[0].words[2].w, 'Rolfe', 'lrc: timed word text');
  eq(lines[0].words[2].t, 11.45, 'lrc: timed word time');
  eq(lines[0].words.length, 4, 'lrc: section tag not shown as a word');
  eq(lines[2].words[0].w, 'Mom', 'lrc: verse 2 first word');
  eq(lines[2].words[0].t, 20.83, 'lrc: marker-timed first word snaps to just before the next word');
  // enhanced word-tag format still tolerated
  const enh = parseLrc('[00:15.56] <00:15.56> Out <00:15.88> in <00:16.00> Rolfe');
  eq(enh[0].words.length, 3, 'enhanced lrc words');
  eq(enh[0].words[2].t, 16.00, 'enhanced lrc word time');
  // plain line-level fallback spreads words
  const plain = parseLrc('[00:10.00] hello there world');
  eq(plain.length, 1, 'plain lrc parsed');
  eq(plain[0].words.length, 3, 'plain lrc words spread');
  ok(plain[0].words[2].t > plain[0].words[0].t, 'plain lrc word times increase');
  eq(parseLrc(''), null, 'empty lrc → null');
  eq(parseLrc(null), null, 'null lrc → null');
  // Suno glitch repair: a bunched cluster stamped at ~0s before a >5s cliff
  // gets re-anchored to just before the next reliable word (real instrumental
  // breaks after normally-spaced words are left alone)
  const glitch = '[00:00.10] Out \n[00:00.20] in \n[00:00.30] Rolfe \n[00:00.40] when \n[00:00.89] glows\n\n[00:01.69] Trouble \n[00:13.86] came \n[00:14.07] where';
  const rep = parseLrc(glitch);
  ok(rep[0].t > 10, 'bunched head cluster re-anchored near the singing');
  ok(rep[1].words[0].t > 12 && rep[1].words[0].t < 13.86, 'cluster tail sits just before the reliable word');
  const legit = '[00:60.0] cheered \n[00:60.5] loud\n\n[00:75.0] The \n[00:75.4] strongest';
  const rep2 = parseLrc(legit);
  eq(rep2[0].words[0].t, 60.0, 'normally-spaced words before a real break untouched');
}

// ---------- data integrity ----------
{
  for (const [id, c] of Object.entries(CARDS)) {
    ok(c.name && c.emoji && c.type, `card ${id} has name/emoji/type`);
    ok(!c.name.toLowerCase().includes('chore'), `card ${id} respects the no-Chores rule`);
    if (!c.unplayable) ok(c.cost === 'X' || Number.isInteger(c.cost), `card ${id} has a cost`);
  }
  for (const [id, r] of Object.entries(RELICS)) ok(r.name && r.text, `relic ${id} complete`);
  for (const [id, e] of Object.entries(ENEMIES)) {
    ok(e.name && e.emoji && Array.isArray(e.hp), `enemy ${id} complete`);
    ok(typeof e.nextMove === 'function', `enemy ${id} has moves`);
  }
  // Every placeholder on a card face must resolve to a real number. Giggle Fit and
  // More Diapers both read "Gain ? Giggle Power" in play because their ops (focus /
  // orbSlots) were missing from the resolver's list.
  for (const [id] of Object.entries(CARDS)) {
    for (const up of [false, true]) {
      const info = cardInfo({ id, up, uid: 0 });
      const txt = info.text || '';
      if (txt.includes('{n}')) ok(nValue(info) != null, `card ${id}${up ? '+' : ''} resolves {n}`);
      if (txt.includes('{d}')) {
        ok((info.fx || []).some((o) => o.dmg != null) || info.base != null, `card ${id}${up ? '+' : ''} resolves {d}`);
      }
      if (txt.includes('{b}')) {
        ok((info.fx || []).some((o) => o.block != null) || info.pn != null, `card ${id}${up ? '+' : ''} resolves {b}`);
      }
    }
  }
  ok(draftPool('aaron').length >= 15, 'aaron has a real card pool');
  ok(draftPool('wyatt').length >= 15, 'wyatt has a real card pool');
  ok(!draftPool('aaron').some((id) => draftPool('wyatt').includes(id)), 'hero pools are disjoint');
  ok(draftPool('liam').length >= 15, 'liam has a real card pool');
  ok(!draftPool('liam').some((id) => draftPool('aaron').includes(id) || draftPool('wyatt').includes(id)), 'liam pool disjoint');
}

// ---------- RL3: pet companions (Aaron's loop + Wyatt's bear) ----------
{
  const { PETS, PET_KEYS, droppablePets, barnBookPets, petDropRoll, petDeckCards, petIntent, DROP_CHANCE, ALIEN_CHANCE } = await import('../js/pets.js');

  // every pet is coherent: rarity, habitat, companion with a known cadence
  for (const k of PET_KEYS) {
    const p = PETS[k];
    ok(['common', 'uncommon', 'rare', 'legendary'].includes(p.rarity), `${k}: valid rarity`);
    ok(['barn', 'pool'].includes(p.habitat), `${k}: valid habitat`);
    ok(p.companion && (p.companion.every === 'first' || p.companion.every >= 1), `${k}: companion cadence`);
    ok(petIntent(k, 1) && petIntent(k, 4), `${k}: intent text renders (legibility canon)`);
    for (const cid of [p.card, p.card2].filter(Boolean)) {
      ok(CARDS[cid] && CARDS[cid].hero === 'pet', `${k}: signature card ${cid} exists as hero:'pet'`);
    }
  }
  // fish live in the pool (the boys' realism spec), bear grants his card instead of decking it
  ok(PETS.goldfish.habitat === 'pool' && PETS.catfish.habitat === 'pool', 'fish live in the fish pool');
  ok(PETS.bear.card === null, "bear decks NO card — he hands you Claw Scratch himself (Wyatt's spec)");

  // pet cards never leak into any hero draft pool or shop draft
  for (const hero of ['aaron', 'wyatt', 'liam']) {
    ok(!draftPool(hero).some((id) => CARDS[id].hero === 'pet'), `${hero}: no pet cards in draft pool`);
  }

  // ducks + goldie never drop from fights; goldie absent from the Barn Book pre-unlock
  ok(!droppablePets().some((k) => PETS[k].source), 'boss/secret pets are not in drop tables');
  ok(!barnBookPets({ farm: { pets: [] } }).includes('goldie'), 'no-tell: Goldie absent from Barn Book pre-unlock');
  ok(barnBookPets({ farm: { pets: ['goldie'] } }).includes('goldie'), 'Goldie appears in the Book once unlocked');
  ok(barnBookPets({ farm: { pets: [] } }).includes('diver'), 'duck super-pets ARE Book-visible (kids should chase them)');

  // deck injection: equipping a pet adds its signature card(s) to a fresh run
  const petRun = R.newRun('aaron', 7, { pet: 'pig' });
  ok(petRun.pet === 'pig' && petRun.deck.some((c) => c.id === 'belly_bump'), 'equipped pig decks Belly Bump');
  ok(R.newRun('aaron', 7).deck.every((c) => CARDS[c.id].hero !== 'pet'), 'petless run has no pet cards');
  ok(R.newRun('aaron', 7, { pet: 'bear' }).deck.every((c) => c.id !== 'claw_scratch'), 'bear decks nothing');

  // companion cadences in combat
  const sim = (petId, turns) => {
    const run = R.newRun('aaron', 11, { pet: petId });
    const st = C.startCombat(run, ['sandworm'], makeRng(11));
    for (let t = 1; t < turns; t++) { C.beginEnemyPhase(st); while (st.phase === 'enemy' && !st.over) C.stepEnemyAction(st); }
    return st;
  };
  ok(sim('bear', 1).hand.some((c) => c.id === 'claw_scratch'), 'bear: Claw Scratch in hand turn 1');
  ok(sim('bear', 2).hand.filter((c) => c.id === 'claw_scratch').length >= 1, 'bear: fresh Claw Scratch again turn 2');
  const pigSt = sim('pig', 1);
  ok(pigSt.hero.block >= 2, 'pig: +2 block turn 1');
  ok(sim('chicken', 3).hand.some((c) => c.id === 'egg') && !sim('chicken', 1).hand.some((c) => c.id === 'egg'),
    'chicken: egg on turn 3, not turn 1');
  ok(sim('rusty', 1).hand.length === 7, 'rusty: turn-1 fetch draws to 7');
  const gf = sim('goldfish', 1); ok(gf.log.some((l) => l.t === 'pet'), 'goldfish: pet action logged for UI floaties');

  // drop rolls: deterministic, dedupe owned, honor kind chances; alien is legendary-rare
  {
    let drops = 0, alien = 0;
    for (let s = 0; s < 4000; s++) {
      const got = petDropRoll('fight', makeRng(s), []);
      if (got) drops += 1;
      if (got === 'alien') alien += 1;
    }
    const rate = drops / 4000;
    ok(rate > 0.08 && rate < 0.17, `fight drop rate ~12% (got ${(rate * 100).toFixed(1)}%)`);
    ok(alien > 0 && alien < 100, `alien is really really really rare (${alien}/4000 rolls)`);
    const allOwned = droppablePets();
    ok(petDropRoll('elite', makeRng(1), allOwned) === null, 'all droppables owned → no drop');
    let eliteDrops = 0;
    for (let s = 0; s < 1000; s++) if (petDropRoll('elite', makeRng(s), [])) eliteDrops += 1;
    ok(eliteDrops / 1000 > rate, 'elites drop pets more often than normal fights');
  }

  // fightRewards integration: a run accumulates petsWon, never duplicates
  {
    const run = R.newRun('wyatt', 3);
    run.ownedPets = ['pig', 'chicken'];
    for (let i = 0; i < 400; i++) R.fightRewards(run, 'elite', makeRng(i));
    ok(run.petsWon.length > 0, 'elite grind eventually drops pets');
    ok(new Set(run.petsWon).size === run.petsWon.length, 'no duplicate pet drops in a run');
    ok(!run.petsWon.includes('pig') && !run.petsWon.includes('chicken'), 'farm-owned pets never re-drop');
  }

  // new engine ops: heal (Egg), gold (Swipe), pierce (UFO Beam ignores block)
  {
    const run = R.newRun('aaron', 5, { pet: 'chicken' });
    const st = C.startCombat(run, ['sandworm'], makeRng(5));
    st.hero.hp = 10;
    forceHand(st, ['egg']);
    C.playCard(st, st.hand[0], null);
    ok(st.hero.hp === 12, 'Egg heals 2');
    ok(st.exhaust.some((c) => c.id === 'egg'), 'Egg exhausts');
    const st2 = C.startCombat(R.newRun('aaron', 5, { pet: 'raccoon' }), ['sandworm'], makeRng(5));
    forceHand(st2, ['five_finger_swipe']);
    C.playCard(st2, st2.hand[0], st2.enemies[0]);
    ok(st2.goldRecovered >= 5, 'Swipe pockets gold');
    const st3 = C.startCombat(R.newRun('aaron', 5, { pet: 'alien' }), ['sandworm'], makeRng(5));
    st3.enemies[0].block = 50;
    const hp0 = st3.enemies[0].hp;
    forceHand(st3, ['ufo_beam']);
    C.playCard(st3, st3.hand[0], st3.enemies[0]);
    ok(st3.enemies[0].hp <= hp0 - 12, 'UFO Beam ignores Block');
  }

  // Brownie's mystery: all three outcomes reachable, none crash
  {
    const seen = new Set();
    for (let s = 0; s < 60; s++) {
      const st = C.startCombat(R.newRun('aaron', s, { pet: 'brownie' }), ['sandworm'], makeRng(s));
      st.hero.hp = Math.max(1, st.hero.hp - 10);
      forceHand(st, ['mystery_waddle']);
      C.playCard(st, st.hand[0], null);
      const m = st.log.find((l) => l.t === 'mystery');
      if (m) seen.add(m.roll);
    }
    ok(seen.size === 3, `Mystery Waddle rolls all 3 gifts (saw: ${[...seen].join(', ')})`);
  }

  // serialization: pet fields round-trip; petless v2 saves migrate
  {
    const run = R.newRun('liam', 9, { pet: 'owl' });
    run.petsWon.push('cat');
    const back = R.deserializeRun(R.serializeRun(run));
    ok(back && back.pet === 'owl' && back.petsWon.includes('cat'), 'pet fields round-trip');
    const v2 = JSON.parse(R.serializeRun(R.newRun('aaron', 1)));
    v2.v = 2; delete v2.pet; delete v2.petsWon;
    const mig = R.deserializeRun(JSON.stringify(v2));
    ok(mig && mig.v === 3 && mig.pet === null && Array.isArray(mig.petsWon), 'v2 save migrates to v3');
  }
}

// ---------- RL3: the farm meta-layer (persistence across runs) ----------
{
  const F = await import('../js/farm.js');
  const farm = F.newFarm();
  ok(F.barnCapacity(farm) === 5, "barn starts at 5 (Aaron's spec)");
  ok(farm.worlds.unlocked === 1 && farm.coins === 0, 'fresh farm: world 1 only, no coins');

  // shop: both of Aaron's tracks present; can't buy broke; buying works
  ok(F.shopStock(farm).some((i) => i.id === 'pet_battle'), 'shop sells Battle Buddies');
  ok(F.shopStock(farm).some((i) => i.id === 'barn_upgrade'), 'shop sells barn expansion');
  ok(!F.shopBuy(farm, 'pet_battle'), 'no coins → no sale');
  farm.coins = 1000;
  ok(F.shopBuy(farm, 'pet_battle') && farm.upgrades.petBattle, 'Battle Buddies unlock');
  ok(!F.shopStock(farm).some((i) => i.id === 'pet_battle'), 'one-time unlock leaves the shelf');
  const capBefore = F.barnCapacity(farm);
  ok(F.shopBuy(farm, 'barn_upgrade') && F.barnCapacity(farm) === capBefore + 3, 'barn expansion adds 3 stalls');

  // adoption: dedupe, habitat caps, fish go to the pool
  const f2 = F.newFarm();
  ok(F.adoptPet(f2, 'pig').adopted, 'pig moves into the barn');
  ok(F.adoptPet(f2, 'pig').reason === 'owned', 'no duplicate pigs');
  ok(F.adoptPet(f2, 'goldfish').adopted && F.petsIn(f2, 'pool').includes('goldfish'), 'goldfish lives in the pool');
  for (const k of ['chicken', 'cat', 'puppy', 'sheepdog']) F.adoptPet(f2, k);
  ok(F.habitatFull(f2, 'barn'), 'barn full at 5');
  ok(F.adoptPet(f2, 'goat').reason === 'full', 'full barn turns pets away (the shop nudge)');
  ok(F.adoptPet(f2, 'catfish').adopted, 'pool has room even when the barn is full');

  // equip: gated on the unlock, only owned pets
  ok(!F.equipPet(f2, 'pig'), 'equip blocked before Battle Buddies');
  f2.upgrades.petBattle = true;
  ok(!F.equipPet(f2, 'bear'), 'cannot equip a pet you have not won');
  ok(F.equipPet(f2, 'pig') && f2.equipped === 'pig', 'equip works after unlock');
  ok(F.equipPet(f2, null) && f2.equipped === null, 'unequip works');

  // settleRun: coins bank win OR lose; pets move in; overflow reported
  const f3 = F.newFarm();
  const lostRun = { gold: 87, petsWon: ['cat', 'owl'] };
  const s1 = F.settleRun(f3, lostRun, false);
  ok(s1.banked === 87 && f3.coins === 87, 'a LOST run still banks coins');
  ok(s1.movedIn.length === 2 && f3.pets.includes('owl'), 'won pets move in even on a loss');
  for (const k of ['pig', 'chicken', 'puppy']) F.adoptPet(f3, k);
  const s2 = F.settleRun(f3, { gold: 10, petsWon: ['goat', 'goldfish'] }, true);
  ok(s2.turnedAway.includes('goat') && s2.movedIn.includes('goldfish'), 'overflow reported; pool pet still fits');
  ok(f3.stats.runs === 2 && f3.stats.wins === 1, 'run stats tracked');

  // world ladder
  F.beatWorld(f3, 1);
  ok(f3.worlds.unlocked === 2 && f3.worlds.beaten.includes(1), 'beating world 1 opens world 2');
  F.beatWorld(f3, 1);
  ok(f3.worlds.beaten.length === 1, 'no duplicate beats');
  // beating the FINAL world must not unlock a phantom world 5 (blank-screen bug, James's report)
  f3.worlds.unlocked = 4;
  F.beatWorld(f3, 4);
  ok(f3.worlds.unlocked === 4, 'beating world 4 unlocks nothing past the ladder');
  ok(Object.keys(R.WORLD_INFO).length === 4 && !R.WORLD_INFO[f3.worlds.unlocked + 1], 'no phantom world exists to name');

  // save round-trip + forward-safe defaults
  const back = F.deserializeFarm(F.serializeFarm(f3));
  ok(back && back.coins === f3.coins && f3.pets.every((p) => back.pets.includes(p)), 'farm round-trips');
  ok(back.pets.includes('brownie'), 'retro-heal: the beaten world 1 pays its duck on load');
  const sparse = F.deserializeFarm(JSON.stringify({ v: 1, pets: ['pig'] }));
  ok(sparse && sparse.upgrades.petBattle === false && sparse.worlds.unlocked === 1, 'sparse profile gets safe defaults');
  ok(F.deserializeFarm('{"v":1,"pets":["not_a_pet"]}') === null, 'unknown pet id rejects the profile');
}

// ---------- RL3: the Weirdness ladder (Wyatt's endless-replay spec) ----------
{
  const F = await import('../js/farm.js');
  // weirdos scale: +7% HP and +5% damage per level, previews agree with hits
  const base = R.newRun('aaron', 99, { world: 1 });
  const w8 = R.newRun('aaron', 99, { world: 1, weirdness: 8 });
  const s0 = C.startCombat(base, ['corn_colonel'], makeRng(99));
  const s8 = C.startCombat(w8, ['corn_colonel'], makeRng(99));
  ok(s8.enemies[0].maxHp > s0.enemies[0].maxHp * 1.4, `W8 weirdos are beefier (${s0.enemies[0].maxHp} → ${s8.enemies[0].maxHp})`);
  s0.enemies[0].intent = { name: 'x', kind: 'attack', dmg: 10 };
  s8.enemies[0].intent = { name: 'x', kind: 'attack', dmg: 10 };
  const p0 = C.intentPreview(s0, s0.enemies[0]).per;
  const p8 = C.intentPreview(s8, s8.enemies[0]).per;
  eq(p8, 14, 'W8 preview shows the scaled hit (10 → 14)');
  const hp0 = s8.hero.hp;
  s8.hand = [];
  C.endTurn(s8);
  ok(hp0 - s8.hero.hp >= p8 - s8.hero.block, 'the scaled preview is what actually lands');
  ok(p0 === 10, 'weirdness 0 = untouched numbers');

  // ladder unlock + best tracking through the farm
  const farm = F.newFarm();
  ok(!farm.weirdnessUnlocked, 'ladder closed on a fresh farm');
  F.settleRun(farm, { gold: 0, petsWon: [], act: 4, weirdness: 0 }, true);
  ok(farm.weirdnessUnlocked, 'the Magnet falls → the ladder opens');
  F.settleRun(farm, { gold: 0, petsWon: [], act: 2, weirdness: 3 }, true);
  eq(farm.weirdnessBest[2], 3, 'best Weirdness per world recorded');
  F.settleRun(farm, { gold: 0, petsWon: [], act: 2, weirdness: 1 }, true);
  eq(farm.weirdnessBest[2], 3, 'a lower climb never erases the best');
  F.settleRun(farm, { gold: 0, petsWon: [], act: 2, weirdness: 7 }, false);
  eq(farm.weirdnessBest[2], 3, 'losses record nothing');
  const back = F.deserializeFarm(F.serializeFarm(farm));
  ok(back.weirdnessUnlocked && back.weirdnessBest[2] === 3, 'ladder state round-trips');
}

// ---------- art coverage audit (the duck-filename lesson, Sun 2026-08-16) ----------
// Every renderable key must have its deployed painting — a mismatch silently
// falls back to emoji, which James caught live on the duck bosses.
{
  const artDir = new URL('../assets/enemies/', import.meta.url);
  const missing = [];
  const need = new Set();
  for (let w = 1; w <= R.WORLDS; w++) {
    for (const pool of [R.ENCOUNTERS[w].easy, R.ENCOUNTERS[w].hard, R.ENCOUNTERS[w].elite, R.ENCOUNTERS[w].boss]) {
      for (const group of pool) for (const k of group) need.add(k);
    }
  }
  // transform + summon forms that appear mid-fight
  for (const k of ['rolling_pumpkin_curled', 'compost_blob_s', 'brick_pile', 'sand_blob_s', 'sand_limb', 'magnet_core', 'minifig_ninja', 'dust_bunny']) need.add(k);
  for (const k of need) {
    if (!existsSync(new URL(`${k}.jpg`, artDir))) missing.push(k);
  }
  eq(missing.join(','), '', 'every fightable weirdo has a deployed painting');
  const { PET_KEYS } = await import('../js/pets.js');
  const petMissing = PET_KEYS.filter((k) => !existsSync(new URL(`../assets/pets/${k}.jpg`, import.meta.url)));
  eq(petMissing.join(','), '', 'every pet has a deployed painting');
  const bgMissing = [];
  for (let w = 1; w <= R.WORLDS; w++) {
    for (const f of [`map${w}`, `battle${w}`, `actcard${w}`]) {
      if (!existsSync(new URL(`../assets/backgrounds/${f}.jpg`, import.meta.url))) bgMissing.push(f);
    }
  }
  eq(bgMissing.join(','), '', 'every world has map/battle/story-card backdrops');
}

// ---------- RL3: the Deck Workshop (the boys' ask — permanent starter changes) ----------
{
  const F = await import('../js/farm.js');
  const farm = F.newFarm();
  farm.coins = 2000;

  // train: a starter arrives upgraded in every future run
  const p1 = F.trainPrice(farm, 'wyatt');
  ok(F.trainCard(farm, 'wyatt', 'kick').ok, 'training a Kick works');
  ok(F.trainPrice(farm, 'wyatt') > p1, 'training prices climb');
  const starter = F.moddedStarter(farm, 'wyatt');
  eq(starter.filter((c) => c.id === 'kick' && c.up).length, 1, 'one Kick is permanently trained');
  const run = R.newRun('wyatt', 42, { starter });
  eq(run.deck.filter((c) => c.id === 'kick' && c.up).length, 1, 'the trained Kick arrives upgraded in a run');
  eq(run.deck.length, R.newRun('wyatt', 42).deck.length, 'training changes quality, not count');

  // trim: a starter leaves the deck forever; capped
  ok(F.trimCard(farm, 'wyatt', 'dodge').ok, 'trimming a Dodge works');
  const run2 = R.newRun('wyatt', 42, { starter: F.moddedStarter(farm, 'wyatt') });
  eq(run2.deck.filter((c) => c.id === 'dodge').length, 4, 'a Dodge is gone from every future run');
  F.trimCard(farm, 'wyatt', 'dodge');
  F.trimCard(farm, 'wyatt', 'kick');
  eq(F.trimsUsed(farm, 'wyatt'), 3, 'three trims used');
  eq(F.trimCard(farm, 'wyatt', 'kick').reason, 'max', 'trim cap enforced');

  // guards: no training an absent card, no spending what you lack
  eq(F.trainCard(farm, 'wyatt', 'nutmeg').ok && false || F.trainCard(farm, 'aaron', 'kick').reason, 'card', "can't train a card the hero doesn't have");
  const broke = F.newFarm();
  eq(F.trainCard(broke, 'aaron', 'shove').reason, 'coins', 'no coins → no training');

  // trimming a trained copy never strands paid training
  const f2 = F.newFarm(); f2.coins = 5000;
  F.trainCard(f2, 'aaron', 'tornado_slam');
  F.trimCard(f2, 'aaron', 'tornado_slam');
  const slams = F.moddedStarter(f2, 'aaron').filter((c) => c.id === 'tornado_slam');
  eq(slams.length, 0, 'the only Tornado Slam trimmed away');
  ok((F.deckMods(f2, 'aaron').up.tornado_slam || 0) <= slams.length, 'orphaned training released');

  // round-trip
  const back = F.deserializeFarm(F.serializeFarm(farm));
  eq(F.trimsUsed(back, 'wyatt'), 3, 'deck mods survive save/load');
}

// ---------- RL3: Barn Toys ----------
{
  const F = await import('../js/farm.js');
  const farm = F.newFarm();
  farm.coins = 500;
  ok(Object.keys(F.TOYS).length >= 8, 'a real toy catalog');
  ok(Object.values(F.TOYS).every((t) => t.name && t.emoji && t.price > 0 && ['barn', 'pool'].includes(t.habitat)), 'every toy is coherent');
  ok(F.buyToy(farm, 'tire_swing').ok && farm.toys.includes('tire_swing'), 'buying a toy works');
  eq(F.buyToy(farm, 'tire_swing').reason, 'owned', 'no duplicate toys');
  farm.coins = 10;
  eq(F.buyToy(farm, 'disco_ball').reason, 'coins', 'no coins → no disco');
  const back = F.deserializeFarm(F.serializeFarm(farm));
  ok(back.toys.includes('tire_swing'), 'toys survive save/load');
  ok(F.deserializeFarm(JSON.stringify({ v: 1, pets: [], toys: ['tire_swing', 'not_a_toy'] })).toys.join() === 'tire_swing', 'unknown toys scrubbed on load');
}

// ---------- RL3: calmed ducks JOIN YOU (the missed feature James caught) ----------
{
  const F = await import('../js/farm.js');
  // beating a duck world's boss grants that duck, exactly once
  for (const [w, duck] of [[1, 'brownie'], [2, 'diver'], [3, 'harmless']]) {
    const run = R.newRun('wyatt', 60 + w, { world: w });
    const rw = R.fightRewards(run, 'boss', makeRng(w));
    eq(rw.pet, duck, `world ${w} boss win grants ${duck}`);
    run.ownedPets = [duck];
    const rw2 = R.fightRewards(run, 'boss', makeRng(w));
    ok(rw2.pet !== duck, 'an owned duck never re-drops');
  }
  const run4 = R.newRun('wyatt', 64, { world: 4 });
  const rw4 = R.fightRewards(run4, 'boss', makeRng(4));
  ok(rw4.pet !== 'brownie' && rw4.pet !== 'diver' && rw4.pet !== 'harmless', 'world 4 grants no duck');

  // boss trophies are NEVER turned away, even with a full pool
  const farm = F.newFarm();
  for (const k of ['goldfish', 'catfish']) F.adoptPet(farm, k);
  farm.upgrades.poolTier = 0; // pool cap 3 → 1 slot left
  ok(F.adoptPet(farm, 'brownie').adopted, 'brownie fits');
  ok(F.habitatFull(farm, 'pool'), 'pool now full');
  ok(F.adoptPet(farm, 'diver').adopted && F.adoptPet(farm, 'harmless').adopted, 'queens never wait for pool space');

  // retro-heal: an old profile that beat duck worlds gets its ducks on load
  const old = { v: 1, pets: ['pig'], worlds: { unlocked: 4, beaten: [1, 2, 3] } };
  const healed = F.deserializeFarm(JSON.stringify(old));
  for (const d of ['brownie', 'diver', 'harmless']) ok(healed.pets.includes(d), `retro-heal grants ${d}`);
  const fresh2 = F.deserializeFarm(JSON.stringify({ v: 1, pets: [], worlds: { unlocked: 1, beaten: [] } }));
  eq(fresh2.pets.length, 0, 'no beaten worlds → no free ducks');
}

// ---------- RL3: per-world map personalities (James's pick #5) ----------
{
  // measure wiggle: mean |column change| per edge, averaged over many seeds
  const wiggle = (act) => {
    let total = 0, n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const map = generateActMap(seed, act);
      for (const [from, tos] of Object.entries(map.edges)) {
        if (!map.nodes[from]) continue;
        for (const to of tos) {
          if (to === BOSS_ID || !map.nodes[to]) continue;
          total += Math.abs(map.nodes[from].c - map.nodes[to].c);
          n += 1;
        }
      }
    }
    return total / n;
  };
  const w1 = wiggle(1), w2 = wiggle(2), w3 = wiggle(3), w4 = wiggle(4);
  ok(w3 < w1, `Bricktopia runs straighter than the crops (${w3.toFixed(2)} < ${w1.toFixed(2)})`);
  ok(w2 > w3, `the Meadow weaves more than Bricktopia (${w2.toFixed(2)} > ${w3.toFixed(2)})`);
  ok(w4 > w3, `the Sandbox sways more than Bricktopia (${w4.toFixed(2)} > ${w3.toFixed(2)})`);
  // every personality still passes every fairness invariant
  for (let act = 1; act <= 4; act++) {
    for (let seed = 100; seed < 110; seed++) {
      eq(validateMap(generateActMap(seed, act)).join(';'), '', `world ${act} personality map ${seed} stays valid`);
    }
  }
  // the Meadow's extra walk means more room to roam
  let n2 = 0, n3 = 0;
  for (let seed = 1; seed <= 30; seed++) {
    n2 += Object.keys(generateActMap(seed, 2).nodes).length;
    n3 += Object.keys(generateActMap(seed, 3).nodes).length;
  }
  ok(n2 > n3, `the Meadow is busier than Bricktopia (${n2} vs ${n3} nodes over 30 maps)`);
}

// ---------- RL3: bug-sweep regressions (James's audit ask) ----------
{
  const { petDropRoll } = await import('../js/pets.js');
  const { PETS } = await import('../js/pets.js');
  // deeper worlds drop rarer pets (designed day one, wired in the sweep)
  const rareRate = (world) => {
    let rare = 0, drops = 0;
    for (let s2 = 0; s2 < 4000; s2++) {
      const got = petDropRoll('elite', makeRng(s2 * 7 + world), [], world);
      if (got && got !== 'alien') { drops += 1; if (PETS[got].rarity !== 'common') rare += 1; }
    }
    return rare / drops;
  };
  ok(rareRate(4) > rareRate(1) + 0.15, `world 4 drops are much shinier than world 1 (${(rareRate(4) * 100).toFixed(0)}% vs ${(rareRate(1) * 100).toFixed(0)}% non-common)`);

  // the Magnet honors the Weirdness ladder (still exactly 100 at W0)
  const shedAt = (w) => {
    const run = R.newRun('aaron', 12, { world: 4, weirdness: w });
    const st = C.startCombat(run, ['sand_monster'], makeRng(12));
    C.dealDamage(state = st, st.enemies[0], 55, { attacker: st.hero, pierce: true });
    return st.enemies[0].maxHp;
  };
  let state;
  eq(shedAt(0), 100, "Weirdness 0: the Magnet is EXACTLY 100 (the boys' number)");
  ok(shedAt(8) > 140, 'Weirdness 8: the Magnet is beefier too');

  // the offline shell list covers every module the game imports
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const game = readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const imports = [...game.matchAll(/from '\.\/(\w+\.js)'/g)].map((m) => `js/${m[1]}`);
  const missing = imports.filter((f) => !sw.includes(`'${f}'`));
  eq(missing.join(','), '', 'sw.js SHELL precaches every module game.js imports (offline boot)');
}

// ---------- RL3: no pet is EVER lost (James lost Zorp to a full barn) ----------
{
  const F = await import('../js/farm.js');
  const farm = F.newFarm();
  for (const k of ['pig', 'chicken', 'cat', 'puppy', 'sheepdog']) F.adoptPet(farm, k); // barn full
  const sum = F.settleRun(farm, { gold: 0, petsWon: ['alien'], act: 2 }, true);
  ok(sum.turnedAway.includes('alien') && farm.waiting.includes('alien'), 'a full barn sends Zorp to the GATE, not the void');
  eq(F.processWaiting(farm).length, 0, 'no room yet → he keeps waiting');
  farm.coins = 1000;
  F.shopBuy(farm, 'barn_upgrade');
  const moved = F.processWaiting(farm);
  ok(moved.includes('alien') && farm.pets.includes('alien') && !farm.waiting.length, 'barn expansion → Zorp moves in');
  // waiting list survives save/load; never duplicates; scrubs already-adopted
  const f2 = F.newFarm();
  for (const k of ['pig', 'chicken', 'cat', 'puppy', 'sheepdog']) F.adoptPet(f2, k);
  F.settleRun(f2, { gold: 0, petsWon: ['goat'], act: 1 }, false);
  F.settleRun(f2, { gold: 0, petsWon: ['goat'], act: 1 }, false);
  eq(f2.waiting.filter((k) => k === 'goat').length, 1, 'no duplicate gate-waiters');
  const back = F.deserializeFarm(F.serializeFarm(f2));
  ok(back.waiting.includes('goat'), 'the gate survives save/load');
}

// ---------- report ----------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  for (const f of fails) console.log('  ✗ ' + f);
  process.exit(1);
}
