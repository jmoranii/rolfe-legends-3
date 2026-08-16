// Rolfe Legends 2 — pure combat engine (no DOM). Mirrors Slay the Spire rules:
// 3 energy/turn, draw 5, block expires at turn start, telegraphed intents,
// Strength/Dexterity/Weak/Vulnerable/Frail/Poison, exhaust, innate, X-cost.
// Enemies come from js/enemies.js (data + move functions); cards from js/cards.js.

import { CARDS, DIAPERS, cardInfo, makeCard } from './cards.js';
import { ENEMIES } from './enemies.js';

export const HAND_SIZE = 5;
export const ENERGY_BASE = 3;
export const MAX_HAND = 10;

// ---------- damage math (StS formulas) ----------

export function attackValue(base, attacker) {
  let d = base + (attacker.strength || 0) + (attacker.tempStr || 0);
  if ((attacker.weak || 0) > 0) d = Math.floor(d * 0.75);
  return Math.max(0, d);
}
export function blockValue(base, hero) {
  let b = base + (hero.dexterity || 0);
  if ((hero.frail || 0) > 0) b = Math.floor(b * 0.75);
  return Math.max(0, b);
}
function incomingMult(target) { return (target.vulnerable || 0) > 0 ? 1.5 : 1; }

// Deal attack-typed damage to a creature. Returns actual HP lost.
// Every resolved hit is appended to state.log so the UI can show EACH hit of a
// multi-hit card/intent separately (X-cost spins, ×N flurries) — including
// fully-blocked hits ("Blocked!").
export function dealDamage(state, target, amount, { attacker = null, isAttack = true, src = null, pierce = false } = {}) {
  if (!target || target.hp <= 0 || target.gone) return 0;
  let dmg = Math.floor(amount * (isAttack ? incomingMult(target) : 1));
  if (target.intangible && isAttack) dmg = Math.min(dmg, 1);
  // pierce = StS "HP loss" (poison, self-costs): goes straight through Block
  const absorbed = pierce ? 0 : Math.min(target.block || 0, dmg);
  target.block = (target.block || 0) - absorbed;
  dmg -= absorbed;
  state.log.push({
    t: dmg > 0 ? 'dmg' : (absorbed > 0 ? 'blocked' : 'miss'),
    target: target === state.hero ? 'hero' : state.enemies.indexOf(target),
    amount: dmg, absorbed, src,
  });
  if (dmg > 0) {
    // floor at 0: overkill was flashing "❤️ -3" on the hero strip before the
    // defeat screen replaced it (James's report, Sun 2026-08-02)
    target.hp = Math.max(0, target.hp - dmg);
    if (target.onDamaged) target.onDamaged(target, state, dmg);
    if (target === state.hero) {
      state.hpLostThisFight = (state.hpLostThisFight || 0) + dmg;
      // the culprit gets named on the defeat screen ("Taken down by…")
      if (target.hp <= 0 && !state.killedBy) {
        const foe = attacker && attacker !== state.hero && attacker.name ? attacker : null;
        state.killedBy = foe
          ? { name: foe.name, emoji: foe.emoji, artKey: foe.artKey }
          : { src: src || 'storm' };
      }
      // Rally Cap (=Centennial Puzzle): first HP loss each fight → draw 3
      if (hasRelic(state, 'rally_cap') && !state.flags.rallyCapUsed) {
        state.flags.rallyCapUsed = true;
        drawCards(state, 3);
        relicProc(state, 'rally_cap');
      }
    }
  }
  // thorns hit back on attack contact
  if (isAttack && attacker && dmg + absorbed > 0 && (target.thorns || 0) > 0 && attacker.hp > 0) {
    dealDamage(state, attacker, target.thorns, { isAttack: false, src: 'thorns' });
  }
  if (target.hp <= 0 && target !== state.hero) handleEnemyDeath(state, target);
  return dmg;
}

function handleEnemyDeath(state, enemy) {
  if (enemy.diedOnce && enemy.reviveAt == null) { /* already processed */ }
  if (enemy.onDeath && !enemy.deathHandled) {
    enemy.deathHandled = true;
    enemy.onDeath(enemy, state);
  }
  if (enemy.stolen && enemy.hp <= 0 && !enemy.fled) {
    state.goldRecovered = (state.goldRecovered || 0) + enemy.stolen;
    enemy.stolen = 0;
  }
  checkCombatEnd(state);
}

export function livingEnemies(state) {
  return state.enemies.filter((e) => e.hp > 0 && !e.gone && !e.fled);
}

export function checkCombatEnd(state) {
  if (state.over) return;
  if (state.hero.hp <= 0) { state.hero.hp = 0; state.over = true; state.won = false; return; }
  if (livingEnemies(state).length === 0) { state.over = true; state.won = true; }
}

// ---------- statuses ----------

export function applyStatus(state, target, k, n) {
  if (!target || (target.hp <= 0 && target !== state.hero)) return;
  if (k === 'strength') { target.strength = (target.strength || 0) + n; return; }
  target[k] = Math.max(0, (target[k] || 0) + n);
}

function tickPoison(state, creature) {
  const p = creature.poison || 0;
  if (p > 0) {
    dealDamage(state, creature, p, { isAttack: false, src: 'poison', pierce: true });
    creature.poison = p - 1;
  }
}
function tickDebuffs(creature) {
  for (const k of ['weak', 'vulnerable', 'frail']) {
    if ((creature[k] || 0) > 0) creature[k] -= 1;
  }
}

// ---------- deck & hand ----------

export function drawCards(state, n) {
  for (let i = 0; i < n; i++) {
    if (state.hand.length >= MAX_HAND) return;
    if (state.draw.length === 0) {
      if (state.discard.length === 0) return;
      state.draw = state.rng.shuffle(state.discard);
      state.discard = [];
    }
    const c = state.draw.pop();
    state.hand.push(c);
    (state.lastDrawn || (state.lastDrawn = [])).push(c.uid);
    const info = cardInfo(c);
    if (info.onDrawDmg) dealDamage(state, state.hero, info.onDrawDmg, { isAttack: false, src: 'ivy' });
    // Waltzing Weasel confusion: randomize cost as drawn
    if (state.flags.confused && info.cost !== null && info.cost !== 'X') {
      state.costOverride[c.uid] = state.rng.int(4);
    }
  }
}

export function effectiveCost(state, inst) {
  const info = cardInfo(inst);
  if (info.cost === null || info.cost === 'X') return info.cost;
  if (state.costOverride[inst.uid] != null) return state.costOverride[inst.uid];
  return info.cost;
}

function removeFromHand(state, inst) {
  const i = state.hand.indexOf(inst);
  if (i >= 0) state.hand.splice(i, 1);
}

export function addCardToCombat(state, id, n, to = 'hand') {
  for (let i = 0; i < n; i++) {
    const c = makeCard(id);
    if (to === 'hand' && state.hand.length < MAX_HAND) state.hand.push(c);
    else if (to === 'draw') state.draw.splice(state.rng.int(state.draw.length + 1), 0, c);
    else state.discard.push(c);
  }
  state.log.push({ t: 'addCard', id, n, to });
}

// ---------- relics (combat-relevant hooks) ----------

export function hasRelic(state, id) { return state.relics.includes(id); }

function relicProc(state, id) { state.log.push({ t: 'relic', id }); }
function relicCombatStart(state) {
  if (hasRelic(state, 'grannys_thermos')) { state.hero.hp = Math.min(state.hero.maxHp, state.hero.hp + 2); relicProc(state, 'grannys_thermos'); }
  if (hasRelic(state, 'lucky_horseshoe')) { state.hero.strength += 1; relicProc(state, 'lucky_horseshoe'); }
  if (hasRelic(state, 'skipping_stone')) { state.hero.dexterity += 1; relicProc(state, 'skipping_stone'); }
  if (hasRelic(state, 'barbed_wire')) { state.hero.thorns = (state.hero.thorns || 0) + 3; relicProc(state, 'barbed_wire'); }
  if (hasRelic(state, 'fence_post')) { state.hero.block += 8; relicProc(state, 'fence_post'); }
  if (hasRelic(state, 'diaper_bag')) { channelOrb(state, 'stinky'); relicProc(state, 'diaper_bag'); }
}

// ---------- diapers (Defect orb system; sts: Lightning/Frost/Dark/Plasma) ----------

export function channelOrb(state, type) {
  const h = state.hero;
  if (h.orbs.length >= h.orbSlots) evokeOrb(state); // auto-evoke oldest when full
  h.orbs.push({ type, stored: type === 'blowout' ? DIAPERS.blowout.passive : 0 });
}

function randomTargets(state, all) {
  const live = livingEnemies(state);
  if (!live.length) return [];
  return all ? live : [state.rng.pick(live)];
}

// Evoke the oldest diaper (index 0). `times` for Double Trouble.
export function evokeOrb(state, times = 1) {
  const h = state.hero;
  const orb = h.orbs.shift();
  if (!orb) return;
  state.log.push({ t: 'evoke', orb: orb.type });
  for (let t = 0; t < times; t++) {
    if (orb.type === 'stinky') {
      for (const e of randomTargets(state, h.powers.max_stink)) {
        dealDamage(state, e, DIAPERS.stinky.evoke + h.focus, { isAttack: false, src: 'stinky' });
      }
    } else if (orb.type === 'fresh') {
      h.block += DIAPERS.fresh.evoke + h.focus;
    } else if (orb.type === 'snack') {
      h.energy += DIAPERS.snack.evoke;
    } else if (orb.type === 'blowout') {
      const live = livingEnemies(state);
      if (live.length) {
        const weakest = live.slice().sort((a, b) => a.hp - b.hp)[0];
        dealDamage(state, weakest, orb.stored, { isAttack: false, src: 'blowout' });
      }
    }
  }
  checkCombatEnd(state);
  return orb;
}

function orbTurnStart(state) {
  const h = state.hero;
  if (h.powers.birthday_boy) h.focus += 1;
  for (const orb of h.orbs) if (orb.type === 'snack') h.energy += 1;
}

function orbTurnEnd(state) {
  const h = state.hero;
  for (const orb of [...h.orbs]) {
    if (state.over) break;
    if (orb.type === 'stinky') {
      for (const e of randomTargets(state, h.powers.max_stink)) {
        dealDamage(state, e, DIAPERS.stinky.passive + h.focus, { isAttack: false, src: 'stinky' });
      }
    } else if (orb.type === 'fresh') {
      h.block += DIAPERS.fresh.passive + h.focus;
      state.log.push({ t: 'orbblock', amount: DIAPERS.fresh.passive + h.focus });
    } else if (orb.type === 'blowout') {
      orb.stored += DIAPERS.blowout.passive + h.focus;
    }
  }
}

function relicTurnStart(state) {
  if (hasRelic(state, 'keys_tractor')) { state.hero.energy += 1; relicProc(state, 'keys_tractor'); }
  if (state.turn === 1) {
    if (hasRelic(state, 'barn_lantern')) { state.hero.energy += 1; relicProc(state, 'barn_lantern'); }
    if (hasRelic(state, 'head_start')) { drawCards(state, 2); relicProc(state, 'head_start'); }
  }
  if (hasRelic(state, 'sunflower')) {
    state.counters.sunflower = (state.counters.sunflower || 0) + 1;
    if (state.counters.sunflower % 3 === 0) { state.hero.energy += 1; relicProc(state, 'sunflower'); }
  }
}

function relicTurnEnd(state) {
  if (hasRelic(state, 'old_quilt') && state.hero.block === 0) { state.hero.block += 6; relicProc(state, 'old_quilt'); }
}

// ---------- combat setup ----------

export function spawnEnemy(state, key, opts = {}) {
  const def = ENEMIES[key];
  if (!def) throw new Error(`unknown enemy: ${key}`);
  const e = {
    key, name: def.name, emoji: def.emoji, artKey: key,
    maxHp: opts.hp ?? state.rng.range(def.hp[0], def.hp[1]),
    block: 0, strength: 0, weak: 0, vulnerable: 0, frail: 0, poison: 0,
    thorns: 0, intangible: false, gone: false, fled: false, stolen: 0,
    state: {}, isElite: !!def.elite, isBoss: !!def.boss,
  };
  e.hp = e.maxHp;
  if (def.init) def.init(e, state);
  if (def.onDamaged) e.onDamaged = (self, st, dmg) => def.onDamaged(self, st, dmg);
  if (def.onDeath) e.onDeath = (self, st) => def.onDeath(self, st);
  if (def.onHeroCard) e.onHeroCard = (self, st, info) => def.onHeroCard(self, st, info);
  e.def = def;
  state.enemies.push(e);
  return e;
}

export function startCombat(run, enemyKeys, rng, { kind = 'fight' } = {}) {
  const state = {
    rng, kind,
    hero: {
      isHero: true, hp: run.hp, maxHp: run.maxHp, block: 0, energy: 0,
      strength: 0, tempStr: 0, dexterity: 0, weak: 0, vulnerable: 0, frail: 0,
      poison: 0, thorns: 0, powers: {},
      orbs: [], orbSlots: 3, focus: 0, // Liam's diapers (Defect orbs); inert for other heroes
    },
    heroId: run.hero,
    enemies: [],
    draw: [], hand: [], discard: [], exhaust: [],
    relics: run.relics, counters: run.counters,
    turn: 0, over: false, won: false,
    attacksThisTurn: 0, skillsThisTurn: 0, cardsThisTurn: 0,
    pendingDiscard: 0, costOverride: {}, flags: {},
    grown: {}, // per-fight shared card growth (Sticky Hands = Claw scaling), keyed by card id
    goldRecovered: 0, log: [],
    phase: 'hero', queue: [],
  };
  for (const k of enemyKeys) spawnEnemy(state, k);
  // deck in: shuffle; innate cards surface at top
  const deck = run.deck.map((c) => ({ ...c }));
  state.draw = rng.shuffle(deck);
  const innate = state.draw.filter((c) => cardInfo(c).innate);
  state.draw = state.draw.filter((c) => !cardInfo(c).innate);
  state.draw.push(...innate); // top of draw pile = end of array
  relicCombatStart(state);
  // enemies announce first intents
  for (const e of livingEnemies(state)) setIntent(state, e);
  startHeroTurn(state);
  return state;
}

function setIntent(state, e) {
  e.intent = e.def.nextMove(e, state, state.rng);
}

// ---------- turn flow ----------

export function startHeroTurn(state) {
  if (state.over) return;
  state.turn += 1;
  state.lastDrawn = [];
  const h = state.hero;
  if (!h.powers.fortify && state.turn > 1) h.block = 0; // turn 1 keeps combat-start block (Fence Post)
  h.energy = ENERGY_BASE;
  h.tempStr = 0;
  state.attacksThisTurn = 0; state.skillsThisTurn = 0; state.cardsThisTurn = 0;
  relicTurnStart(state);
  orbTurnStart(state);
  // powers
  if (h.powers.tornado_form) applyStatus(state, h, 'strength', h.powers.tornado_form);
  if (h.powers.ball_machine) addCardToCombat(state, 'soccer_ball', 1, 'hand');
  tickPoison(state, h);
  if (state.flags.constrict) dealDamage(state, h, state.flags.constrict, { isAttack: false, src: 'constrict' });
  checkCombatEnd(state);
  if (state.over) return;
  drawCards(state, HAND_SIZE);
  if (h.powers.sleight_of_hand) { drawCards(state, 1); state.pendingDiscard += 1; }
}

// ---------- playing cards ----------

export const SPECIALS = {
  heavy_haul(state, info, target) {
    const raw = info.base + (state.hero.strength + state.hero.tempStr) * info.strMult;
    let d = raw;
    if ((state.hero.weak || 0) > 0) d = Math.floor(d * 0.75);
    dealDamage(state, target, Math.max(0, d), { attacker: state.hero });
  },
  tornado_spin(state, info) {
    const x = state.hero.energy;
    state.hero.energy = 0;
    for (let i = 0; i < x; i++) {
      for (const e of livingEnemies(state)) {
        dealDamage(state, e, attackValue(info.base, state.hero), { attacker: state.hero });
      }
    }
  },
  double_trouble(state) {
    evokeOrb(state, 2);
  },
  uppies(state) {
    const orb = evokeOrb(state);
    if (orb) channelOrb(state, orb.type);
  },
  throw_food(state, info, target) {
    const hits = state.hero.orbs.length;
    for (let i = 0; i < hits; i++) {
      if (target && target.hp > 0) dealDamage(state, target, attackValue(info.base, state.hero), { attacker: state.hero });
    }
  },
  bicycle_kick(state, info, target) {
    const hits = state.attacksThisTurn - 1; // attacks played BEFORE this one (it counts itself in the tally)
    for (let i = 0; i < Math.max(1, hits); i++) {
      if (target.hp > 0) dealDamage(state, target, attackValue(info.base, state.hero), { attacker: state.hero });
    }
  },
};

export function canPlay(state, inst) {
  if (state.over || state.pendingDiscard > 0) return false;
  const info = cardInfo(inst);
  if (info.unplayable) return false;
  const cost = effectiveCost(state, inst);
  if (cost === 'X') return true;
  return state.hero.energy >= cost;
}

export function playCard(state, inst, target = null) {
  if (!canPlay(state, inst)) return false;
  const info = cardInfo(inst);
  const needsTarget = cardNeedsTarget(info);
  if (needsTarget && (!target || target.hp <= 0)) {
    target = livingEnemies(state)[0];
    if (!target) return false;
  }
  const cost = effectiveCost(state, inst);
  if (cost !== 'X') state.hero.energy -= cost;
  removeFromHand(state, inst);
  state.lastDrawn = []; // the discard prompt highlights what THIS play draws

  state.cardsThisTurn += 1;
  if (info.type === 'attack') state.attacksThisTurn += 1;
  if (info.type === 'skill') state.skillsThisTurn += 1;

  // enemy reactions (Ornery Ram enrage, Twister curiosity, …)
  for (const e of livingEnemies(state)) if (e.onHeroCard) e.onHeroCard(e, state, info);
  // afterimage
  if (state.hero.powers.afterimage) state.hero.block += 1;
  // Soccer Drills / Hay Bale Toss: 3rd attack in a turn
  if (info.type === 'attack' && state.attacksThisTurn === 3) {
    if (hasRelic(state, 'soccer_drills')) { state.hero.dexterity += 1; relicProc(state, 'soccer_drills'); }
    if (hasRelic(state, 'hay_bale_toss')) { state.hero.strength += 1; relicProc(state, 'hay_bale_toss'); }
  }

  if (info.special) {
    SPECIALS[info.special](state, info, target);
  } else if (info.fx) {
    runEffects(state, info, target);
  }

  if (info.power) state.hero.powers[info.power] = info.pn ?? true;

  // where the card goes
  if (info.type === 'power') { /* consumed */ }
  else if (info.exhausts) state.exhaust.push(inst);
  else state.discard.push(inst);

  checkCombatEnd(state);
  return true;
}

export function cardNeedsTarget(info) {
  if (info.special === 'heavy_haul' || info.special === 'bicycle_kick' || info.special === 'throw_food') return true;
  if (info.special === 'tornado_spin' || info.special === 'double_trouble' || info.special === 'uppies') return false;
  return (info.fx || []).some((op) => (op.dmg != null && !op.allEnemies)
    || (op.status && op.status.target === 'target'));
}

function runEffects(state, info, target) {
  const h = state.hero;
  for (const op of info.fx) {
    if (op.dmg != null) {
      const times = op.times || 1;
      // grows (Claw): every copy shares the fight-long bonus · dmgFromBlock (Body Slam)
      const grown = info.grows ? (state.grown[info.id] || 0) : 0;
      const strapped = attackValue(op.dmg + grown + (op.dmgFromBlock ? h.block : 0), h);
      // Pen Nib mirror (Slingshot): every 10th attack CARD doubles its damage
      let mult = 1;
      if (hasRelic(state, 'slingshot')) {
        state.counters.slingshot = (state.counters.slingshot || 0) + 1;
        if (state.counters.slingshot % 10 === 0) { mult = 2; relicProc(state, 'slingshot'); }
      }
      for (let t = 0; t < times; t++) {
        if (op.allEnemies) {
          for (const e of livingEnemies(state)) dealDamage(state, e, strapped * mult, { attacker: h });
        } else if (target && target.hp > 0) {
          dealDamage(state, target, strapped * mult, { attacker: h });
        }
      }
    }
    if (op.block != null) h.block += blockValue(op.block, h);
    if (op.draw) drawCards(state, op.draw);
    if (op.discard) state.pendingDiscard += op.discard;
    if (op.energy) h.energy += op.energy;
    if (op.loseHp) dealDamage(state, h, op.loseHp, { isAttack: false, src: 'effort', pierce: true });
    if (op.selfStr) h.strength += op.selfStr;
    if (op.selfDex) h.dexterity += op.selfDex;
    if (op.tempStr) h.tempStr += op.tempStr;
    if (op.addCard) addCardToCombat(state, op.addCard.id, op.addCard.n, op.addCard.to);
    if (op.channel) channelOrb(state, op.channel);
    if (op.evoke) for (let i = 0; i < op.evoke; i++) evokeOrb(state);
    if (op.focus) h.focus += op.focus;
    if (op.orbSlots) h.orbSlots += op.orbSlots;
    if (op.status) {
      const { k, n, target: tgt } = op.status;
      if (tgt === 'self') applyStatus(state, h, k, n);
      else if (tgt === 'all') for (const e of livingEnemies(state)) applyStatus(state, e, k, n);
      else if (target) applyStatus(state, target, k, n);
    }
  }
  state.pendingDiscard = Math.min(state.pendingDiscard, state.hand.length);
  if (info.grows) {
    state.grown[info.id] = (state.grown[info.id] || 0) + info.grows;
    state.log.push({ t: 'grow', id: info.id, n: info.grows, total: state.grown[info.id] });
  }
}

// UI/selfplay resolve a pending discard by choosing a hand card.
export function resolveDiscard(state, inst) {
  if (state.pendingDiscard <= 0) return false;
  removeFromHand(state, inst);
  state.discard.push(inst);
  state.pendingDiscard -= 1;
  return true;
}

// ---------- enemy phase ----------

// The enemy phase is steppable so the UI can act enemies one at a time with
// animation between steps. beginEnemyPhase → stepEnemyAction×N (returns the
// enemy that visibly acted, or null once the phase completes and the next hero
// turn has begun). endTurn() runs the whole thing synchronously (tests/selfplay).

export function beginEnemyPhase(state) {
  if (state.over || state.pendingDiscard > 0 || state.phase === 'enemy') return false;
  const h = state.hero;
  // Hailstones in hand burn
  for (const c of [...state.hand]) {
    const info = cardInfo(c);
    if (info.endTurnDmg) dealDamage(state, h, info.endTurnDmg, { isAttack: false, src: 'hailstone' });
  }
  if (h.powers.tough_skin) h.block += h.powers.tough_skin;
  orbTurnEnd(state);
  relicTurnEnd(state);
  tickDebuffs(h);
  // discard hand
  state.discard.push(...state.hand);
  state.hand = [];
  state.phase = 'enemy';
  state.queue = [...state.enemies]; // snapshot: summons join NEXT turn
  if (state.over) { state.phase = 'hero'; state.queue = []; }
  return true;
}

export function stepEnemyAction(state) {
  while (state.phase === 'enemy' && state.queue.length) {
    if (state.over) break;
    const e = state.queue.shift();
    if (e.gone || e.fled) continue;
    if (e.hp <= 0) {
      // pending revive (Ball Lightning)
      if (e.state.reviveIn != null) {
        e.state.reviveIn -= 1;
        if (e.state.reviveIn <= 0 && livingEnemies(state).length > 0) {
          e.hp = Math.floor(e.maxHp / 2); e.deathHandled = false; e.state.reviveIn = null;
          setIntent(state, e);
          return e; // visible: it crackles back to life
        }
      }
      continue;
    }
    if (!e.block_persist) e.block = 0;
    tickPoison(state, e);
    if (e.hp <= 0 || state.over) continue;
    executeIntent(state, e);
    tickDebuffs(e);
    if (!state.over && e.hp > 0 && !e.fled && !e.gone) setIntent(state, e);
    return e;
  }
  // queue exhausted (or combat ended) → close the phase
  state.phase = 'hero';
  state.queue = [];
  checkCombatEnd(state);
  if (!state.over) startHeroTurn(state);
  return null;
}

export function endTurn(state) {
  if (!beginEnemyPhase(state)) return;
  while (state.phase === 'enemy') stepEnemyAction(state);
}

function executeIntent(state, e) {
  const it = e.intent;
  if (!it) return;
  if (it.dmg != null) {
    const times = it.times || 1;
    for (let t = 0; t < times; t++) {
      if (state.over) break;
      dealDamage(state, state.hero, attackValue(it.dmg, e), { attacker: e });
    }
  }
  if (it.block) e.block += it.block;
  if (it.fn) it.fn(state, e);
}

// Preview number the UI shows for an attack intent (matches what will hit).
export function intentPreview(state, e) {
  const it = e.intent;
  if (!it || it.dmg == null) return null;
  const per = Math.floor(attackValue(it.dmg, e) * incomingMult(state.hero));
  return { per, times: it.times || 1 };
}
