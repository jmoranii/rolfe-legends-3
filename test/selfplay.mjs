// Rolfe Legends 2 — selfplay balance harness. Simulates full runs with a
// competent-but-simple policy and reports winrate by act, death causes, run
// length. Run: node test/selfplay.mjs [runs-per-hero]
// Verdict rails are wide for v1 scaffolding; tighten as tuning progresses.

import { makeRng } from '../js/rng.js';
import { CARDS, cardInfo, makeCard, upgradableCards } from '../js/cards.js';
import { EVENTS } from '../js/events.js';
import * as C from '../js/combat.js';
import * as R from '../js/run.js';

const RUNS = Number(process.argv[2] || 150);
// a stray flag ("--quick") parses to NaN, the loop runs ZERO games, and every
// rail passes vacuously — a fake-green gate. Refuse to run a 0-game harness.
if (!Number.isFinite(RUNS) || RUNS < 1) { console.log(`RAIL FAIL: bad run count ${process.argv[2]}`); process.exit(1); }

// static card pick scores (rough tier list; the harness measures, we tune data)
const PICK = {
  // aaron
  quick_jab: 7, hay_swing: 6, one_two: 5, heavy_haul: 6, iron_wave: 6, belly_flop: 6, shake_it_off: 7,
  grit: 4, flex: 4, uppercut: 7, game_face: 7, all_out: 8, back_off: 6, tornado_spin: 7,
  pumped_up: 8, tough_skin: 7, tornado_form: 9, stone_wall: 8, fortify: 6,
  // wyatt
  juggling_show: 6, long_pass: 6, sting_shot: 7, sidestep: 4, backflip: 7, warm_up: 4,
  slide_tackle: 7, sneak_attack: 6, itching_powder: 7, leg_sweep: 6, prank_cloud: 7,
  bicycle_kick: 6, sleight_of_hand: 5, footwork: 8, sugar_rush: 8, hat_trick: 8,
  ball_machine: 6, afterimage: 7,
  // liam
  throw_spaghetti: 7, sippy_cup: 6, blanket_fort: 7, sticky_hands: 5, nap_time: 5,
  snacks: 6, big_no: 8, giggle_fit: 8, uppies: 5, throw_food: 7, more_diapers: 7,
  waddle_charge: 7, uh_oh: 6, maximum_stink: 9, birthday_boy: 8,
};

function worstHandCard(state) {
  let worst = null, worstScore = Infinity;
  for (const c of state.hand) {
    const info = cardInfo(c);
    let s = PICK[c.id] ?? 5;
    if (info.unplayable) s = -10;
    if (c.id === 'shove' || c.id === 'kick') s = 1;
    if (c.id === 'brace' || c.id === 'dodge') s = 1.5;
    if (s < worstScore) { worstScore = s; worst = c; }
  }
  return worst;
}

function incomingDamage(state) {
  let total = 0;
  for (const e of C.livingEnemies(state)) {
    const p = C.intentPreview(state, e);
    if (p) total += p.per * p.times;
  }
  return total;
}

function playTurn(state) {
  let safety = 60;
  while (!state.over && safety-- > 0) {
    if (state.pendingDiscard > 0) { C.resolveDiscard(state, worstHandCard(state) || state.hand[0]); continue; }
    const playable = state.hand.filter((c) => C.canPlay(state, c));
    if (!playable.length) break;
    const incoming = incomingDamage(state);
    const needBlock = Math.max(0, incoming - state.hero.block);
    const enemies = C.livingEnemies(state);
    const target = enemies.slice().sort((a, b) => a.hp - b.hp)[0];
    if (!target) break;
    // score each playable card for THIS moment
    let best = null, bestScore = -1;
    for (const c of playable) {
      const info = cardInfo(c);
      let s = 0;
      const cost = C.effectiveCost(state, c);
      const costN = cost === 'X' ? state.hero.energy : cost;
      if (info.type === 'power') s = 10; // powers early
      const fx = info.fx || [];
      // perceived per-op damage mirrors the engine: Belly Flop reads its Block, Sticky Hands its fight bonus
      const opDmg = (o) => o.dmg + (o.dmgFromBlock ? state.hero.block : 0) + (info.grows ? (state.grown[info.id] || 0) : 0);
      const dmg = fx.filter((o) => o.dmg != null).reduce((t, o) => t + C.attackValue(opDmg(o), state.hero) * (o.times || 1) * (o.allEnemies ? enemies.length : 1), 0)
        + (info.special === 'heavy_haul' ? info.base + state.hero.strength * info.strMult : 0)
        + (info.special === 'tornado_spin' ? info.base * state.hero.energy * enemies.length : 0)
        + (info.special === 'bicycle_kick' ? info.base * Math.max(1, state.attacksThisTurn) : 0);
      const blk = fx.filter((o) => o.block != null).reduce((t, o) => t + C.blockValue(o.block, state.hero), 0);
      if (dmg >= target.hp) s += 12;                 // kill shot
      s += dmg * 0.5;
      s += blk * (needBlock > 0 ? 1.1 : 0.15);
      s += (fx.find((o) => o.draw) ? 2 : 0) + (fx.find((o) => o.energy) ? 3 : 0);
      const poison = fx.find((o) => o.status && o.status.k === 'poison');
      if (poison) s += poison.status.n * 0.9;
      if (fx.find((o) => o.selfStr || o.selfDex || o.tempStr)) s += 5; // scaling setup matters
      if (fx.find((o) => o.focus)) s += 6;                              // giggle power scales everything
      if (fx.find((o) => o.channel)) s += 5;                            // floating diapers = value engine
      if (fx.find((o) => o.orbSlots)) s += 4;
      if ((info.special === 'double_trouble' || info.special === 'uppies') && state.hero.orbs.length) s += 5;
      if (info.special === 'throw_food') s += state.hero.orbs.length * 3;
      const debuff = fx.find((o) => o.status && (o.status.k === 'weak' || o.status.k === 'vulnerable'));
      if (debuff) s += 3;
      s -= costN * 0.4;
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (!best) break;
    if (!C.playCard(state, best, target)) break;
  }
  if (!state.over) C.endTurn(state);
}

const fightStats = { fight: [], elite: [], boss: [] };   // {turns, hpLost}
function runCombat(run, enemies, rng, kind) {
  const state = C.startCombat(run, enemies, rng, { kind });
  const hp0 = state.hero.hp;
  let turns = 0;
  while (!state.over && turns++ < 60) playTurn(state);
  if (!state.over) { state.over = true; state.won = false; state.stall = true; }
  if (state.won) fightStats[kind].push({ turns: state.turn, hpLost: hp0 - state.hero.hp });
  return state;
}

function draftPick(run, cards) {
  if (run.deck.length > 24) return null;
  let best = null, bestScore = 3.9; // skip weak picks when deck is fine
  for (const id of cards) {
    const s = PICK[id] ?? 5;
    if (s > bestScore) { bestScore = s; best = id; }
  }
  return best;
}

function playEvent(run, key, rng) {
  const ev = EVENTS[key];
  const usable = ev.choices.filter((ch) => !ch.can || ch.can(run));
  const choice = usable[0] || ev.choices[ev.choices.length - 1];
  const result = choice.apply(run, rng);
  if (result === 'PICK_CURSE') {
    const c = run.deck.find((x) => ['homework', 'poison_ivy'].includes(x.id));
    if (c) run.deck.splice(run.deck.indexOf(c), 1);
    return;
  }
  if (result === 'PICK_CARD' || run.pendingRemove) {
    run.pendingRemove = false;
    const kick = run.deck.find((c) => c.id === 'shove' || c.id === 'kick');
    if (kick && run.deck.length > 6) run.deck.splice(run.deck.indexOf(kick), 1);
  }
  if (result === 'PICK_UPGRADE' || run.pendingUpgrade) {
    // Brody's garage now defers the choice to the player (same picker as Granny's
    // Practice), so the headless bot stands in for that pick.
    run.pendingUpgrade = false;
    const c = rng.pick(upgradableCards(run.deck));
    if (c) c.up = true;
  }
}

function simulateRun(heroId, seed, world = 1, petId = null) {
  const run = R.newRun(heroId, seed, { world, pet: petId });
  const rng = makeRng(seed);
  // coach boon
  const boons = R.coachBoons(run, rng);
  (boons.find((b) => b.id === 'maxhp' || b.id === 'relic') || boons[0]).apply(run, rng);
  let guard = 200;
  while (guard-- > 0) {
    const opts = R.nextNodes(run);
    // path policy over the reachable map nodes
    let pick = opts[0];
    const hpFrac = run.hp / run.maxHp;
    const prefer = (t) => opts.find((o) => o.type === t);
    if (hpFrac < 0.5 && prefer('rest')) pick = prefer('rest');
    else if (prefer('treasure')) pick = prefer('treasure');
    else if (run.gold > 160 && prefer('shop')) pick = prefer('shop');
    else if (hpFrac > 0.75 && run.deck.length >= 13 && prefer('elite')) pick = prefer('elite');
    else if (prefer('event')) pick = prefer('event');
    else if (prefer('fight')) pick = prefer('fight');
    const node = R.enterMapNode(run, pick.id);
    if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss') {
      const state = runCombat(run, node.enemies, makeRng(seed ^ (run.act * 1000 + run.floor)), node.type);
      if (!state.won || state.hero.hp <= 0) {
        return { won: false, act: run.act, floor: run.floor, by: node.enemies[0], stall: !!state.stall };
      }
      R.applyCombatResult(run, state);
      const rewards = R.fightRewards(run, node.type, rng);
      run.gold += rewards.gold;
      const picked = draftPick(run, rewards.cards);
      if (picked) run.deck.push(makeCard(picked));
      if (rewards.relic) run.relics.push(rewards.relic);
      if (node.type === 'boss') {
        // RL3: the world's boss falls → the expedition is WON
        return { won: true, act: run.act, floor: run.floor, deckIds: run.deck.map((c) => c.id) };
      }
    } else if (node.type === 'shop') {
      const shop = node.shop;
      if (shop.relics.length && run.gold >= shop.relics[0].price) R.shopBuyRelic(run, shop, 0);
      for (let i = 0; i < shop.cards.length; i++) {
        if ((PICK[shop.cards[i].id] ?? 0) >= 7 && run.gold >= shop.cards[i].price) { R.shopBuyCard(run, shop, i); break; }
      }
      const curse = run.deck.find((c) => ['homework', 'poison_ivy'].includes(c.id));
      if (curse && run.gold >= shop.removePrice) R.shopRemoveCard(run, shop, curse.uid);
    } else if (node.type === 'rest') {
      if (run.hp < run.maxHp * 0.72) R.restCookies(run);
      else {
        // healthy: stash a junk card at Granny's first, otherwise upgrade
        const junk = run.deck.find((c) => ['homework', 'poison_ivy'].includes(c.id));
        if (junk && run.deck.length > 1) R.restStore(run, junk.uid);
        else {
          const target = run.deck.find((c) => !c.up && (PICK[c.id] ?? 0) >= 7) || run.deck.find((c) => !c.up);
          if (target) R.restPractice(run, target.uid);
          else R.restCookies(run);
        }
      }
    } else if (node.type === 'event') {
      playEvent(run, node.event, rng);
      run.pendingRelicPop = null; // UI-only flag; keep harness runs clean
    } // treasure: enterMapNode already banked the relic
  }
  return { won: false, act: run.act, floor: run.floor, by: 'guard_exhausted', stall: true };
}

// ---------- sweep ----------
// RL3: a run is one world. Each hero sweeps every world on a FRESH profile
// (no pet — the pet-equipped lane lands with the Phase 3 balance pass).
const WORLD_RUNS = Math.max(25, Math.floor(RUNS / R.WORLDS));
const report = {};
let stalls = 0;
for (const hero of ['aaron', 'wyatt', 'liam']) {
  const res = { perWorld: {}, wins: 0, runs: 0, winDecks: {} };
  for (let w = 1; w <= R.WORLDS; w++) {
    const ww = { wins: 0, deaths: [] };
    for (let i = 0; i < WORLD_RUNS; i++) {
      const out = simulateRun(hero, 1000 + i * 17 + w * 271 + (hero === 'wyatt' ? 7 : 0), w);
      res.runs++;
      if (out.won) {
        ww.wins++; res.wins++;
        for (const id of out.deckIds || []) {
          if (CARDS[id].rarity !== 'starter') res.winDecks[id] = (res.winDecks[id] || 0) + 1;
        }
      } else { ww.deaths.push(out); if (out.stall) stalls++; }
    }
    res.perWorld[w] = ww;
  }
  report[hero] = res;
}

console.log(`\n=== Rolfe Legends 3 selfplay — ${WORLD_RUNS} runs per hero per world ===`);
for (const hero of Object.keys(report)) {
  const r = report[hero];
  const bits = [];
  for (let w = 1; w <= R.WORLDS; w++) bits.push(`W${w} ${(r.perWorld[w].wins / WORLD_RUNS * 100).toFixed(0)}%`);
  console.log(`\n${hero.toUpperCase()}: ${bits.join(' · ')}`);
  const byEnemy = {};
  for (let w = 1; w <= R.WORLDS; w++) for (const d of r.perWorld[w].deaths) byEnemy[d.by] = (byEnemy[d.by] || 0) + 1;
  const top = Object.entries(byEnemy).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log('  top killers: ' + (top.map(([k, n]) => `${k}×${n}`).join(', ') || 'none'));
}
console.log(`\nstalled fights: ${stalls}`);

// fight pacing (rubric: normals ~3–6 turns, elites ~6–10, bosses ~8–14)
const avg = (arr, k) => arr.length ? (arr.reduce((t, x) => t + x[k], 0) / arr.length) : 0;
const pacing = {};
for (const kind of ['fight', 'elite', 'boss']) {
  const fs = fightStats[kind];
  pacing[kind] = avg(fs, 'turns');
  console.log(`${kind.padEnd(6)} avg turns ${pacing[kind].toFixed(1)} · avg HP lost ${avg(fs, 'hpLost').toFixed(1)} · n=${fs.length}`);
}

// deck identity (rubric: decks should bend toward an archetype by the end)
console.log('\nwinning-deck signatures (avg copies per win):');
for (const hero of Object.keys(report)) {
  const r = report[hero];
  if (!r.wins) { console.log(`  ${hero}: (no wins)`); continue; }
  const top = Object.entries(r.winDecks).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, n]) => `${id}×${(n / r.wins).toFixed(1)}`);
  console.log(`  ${hero}: ${top.join(' · ')}`);
}

// ---------- verdict rails ----------
// RL3 TARGETS (Wyatt's harder-than-RL2 spec, DESIGN.md): fresh-profile hero
// ~25% (rails 20–30) per world at final tuning, maxed-farm ~40%.
// STAGE-A SCAFFOLDING: worlds still run RL2's borrowed pools, so winrate rails
// are PROVISIONAL-WIDE (catastrophe-only). The Phase 3 balance pass re-tightens
// them to [0.18, 0.32] at n≥300 — do not ship with the wide band.
let bad = false;
const total = (h) => report[h].wins / report[h].runs;
for (const hero of ['aaron', 'wyatt', 'liam']) {
  const w1 = report[hero].perWorld[1].wins / WORLD_RUNS;
  if (w1 < 0.05) { console.log(`RAIL FAIL: ${hero} world-1 winrate ${(w1 * 100).toFixed(1)}% — a fresh kid can never get going`); bad = true; }
  if (total(hero) > 0.95) { console.log(`RAIL FAIL: ${hero} overall ${(total(hero) * 100).toFixed(1)}% — no challenge anywhere`); bad = true; }
}
if (stalls > RUNS * 0.1) { console.log(`RAIL FAIL: ${stalls} stalled fights`); bad = true; }
if (pacing.fight > 7) { console.log(`RAIL FAIL: normal fights average ${pacing.fight.toFixed(1)} turns (bore threshold 7)`); bad = true; }
if (pacing.elite > 11) { console.log(`RAIL FAIL: elites average ${pacing.elite.toFixed(1)} turns (bore threshold 11)`); bad = true; }
if (pacing.boss > 16) { console.log(`RAIL FAIL: bosses average ${pacing.boss.toFixed(1)} turns (bore threshold 16)`); bad = true; }
console.log(bad ? '\nVERDICT: NEEDS TUNING' : '\nVERDICT: ALL CLEAR (provisional Stage-A rails — Phase 3 tightens to the 20–30 band)');
process.exit(bad ? 1 : 0);
