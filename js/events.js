// Rolfe Legends 3 — map events (family cameos). James-approved roster + draft
// dialogue lines (final lines get James's sign-off before ship — CLAUDE.md rule).
// Each event: { name, emoji, speaker, line, choices: [{label, can?(run), apply(run, rng) → result string}] }
// Pure: mutates the run object only; UI renders, selfplay picks.

import { relicPool } from './relics.js';
import { makeCard, CARDS, upgradableCards } from './cards.js';

function heal(run, amount) {
  run.hp = Math.min(run.maxHp, run.hp + amount);
  return amount;
}
function gainRelic(run, rng) {
  const pool = relicPool(run.relics);
  if (!pool.length) return null;
  const id = rng.pick(pool);
  run.relics.push(id);
  run.pendingRelicPop = id; // the UI turns this into the big FARM TREASURE reveal
  return id;
}
function removableCards(run) {
  return run.deck.filter((c) => !['status', 'curse'].includes(CARDS[c.id].type));
}
function curses(run) {
  return run.deck.filter((c) => ['homework', 'poison_ivy'].includes(c.id));
}

export const EVENTS = {
  care_package: {
    name: "Mom's Care Package", emoji: '📦', speaker: 'Mom',
    line: '"You boys eating enough? Here. And WEAR your sunscreen."',
    choices: [
      { label: '🥪 The sandwich (heal 20% HP)', apply: (run) => `Healed ${heal(run, Math.floor(run.maxHp * 0.2))} HP. Thanks, Mom.` },
      { label: '🧴 The sunscreen (get rid of a useless card)', can: (run) => curses(run).length > 0, apply: () => 'PICK_CURSE' },
    ],
  },
  tractor_ride: {
    name: "Poppa Flaj's Tractor Ride", emoji: '🚜', speaker: 'Poppa Flaj',
    line: '"Hop on, I\'m headed that way anyhow."',
    choices: [
      { label: '🚜 Ride ahead (skip the next floor)', apply: (run) => { run.skipNextFloor = true; return 'The tractor rumbles up the path.'; } },
      { label: '🚶 Walk (nothing happens)', apply: () => 'You wave as he putters off.' },
    ],
  },
  brody_garage: {
    name: "Uncle Brody's Garage", emoji: '🔧', speaker: 'Uncle Brody',
    line: '"REAL TALK, kid. Let\'s soup this thing UP."',
    choices: [
      { label: '🔧 Upgrade a card', can: (run) => upgradableCards(run.deck).length > 0, apply: (run) => { run.pendingUpgrade = true; return 'PICK_UPGRADE'; } },
      { label: '👋 Just say hi', apply: () => 'Brody gives you a fist bump.' },
    ],
  },
  chelsea_kitchen: {
    name: "Aunt Chelsea's Kitchen", emoji: '🍲', speaker: 'Aunt Chelsea',
    line: '"Sit down, warm up. You don\'t have to carry all that, you know."',
    choices: [
      { label: '🍲 Warm meal (heal 25% HP)', apply: (run) => `Healed ${heal(run, Math.floor(run.maxHp * 0.25))} HP.` },
      { label: '🎒 Lighten your load (remove a card)', can: (run) => removableCards(run).length > 1, apply: (run) => { run.pendingRemove = true; return 'PICK_CARD'; } },
    ],
  },
  duck_pond: {
    name: 'The Duck Pond', emoji: '🦆', speaker: null,
    line: 'A duckling is separated from the parade. It looks up at you. Quack.',
    choices: [
      { label: '🦆 Walk it home (a Duck Friend joins your deck!)', apply: (run) => { run.deck.push(makeCard('duck')); return 'QUACK! The duck follows you now.'; } },
      { label: '🚶 Leave it (it\'ll probably be fine)', apply: () => 'You feel watched the rest of the day.' },
    ],
  },
  goldie_gate: {
    name: "Goldie's Gate", emoji: '🦙', speaker: null,
    line: 'The llama stands at the gate, guarding something. Goldie says nothing. Goldie knows.',
    choices: [
      { label: '🦙 Approach the llama', apply: (run, rng) => {
        const id = gainRelic(run, rng);
        if (rng.chance(0.5)) { run.hp = Math.max(1, run.hp - 5); return id ? 'Goldie SPITS (-5 HP)… then steps aside. Something glitters behind her.' : 'Goldie spits. That\'s all.'; }
        return id ? 'Goldie nods, once, and steps aside. She was guarding something for you.' : 'Goldie nods. There was nothing behind her. Classic Goldie.';
      } },
      { label: '🚶 Respect the llama, walk away', apply: () => 'Wise.' },
    ],
  },
  pep_talk: {
    name: "Coach James's Pep Talk", emoji: '🧢', speaker: 'Coach James',
    line: '"You\'ve already got everything you need. But take this anyway."',
    choices: [
      { label: '❤️ Believe in yourself (+5 Max HP)', apply: (run) => { run.maxHp += 5; run.hp += 5; return 'You feel tougher.'; } },
      { label: '🧠 Advice (get rid of a useless card)', can: (run) => curses(run).length > 0, apply: () => 'PICK_CURSE' },
      { label: '💰 Pocket money (+50 gold)', apply: (run) => { run.gold += 50; return 'For Jacob\'s shop.'; } },
    ],
  },
  pie_contest: { // sts: Big Fish (heal / +max HP / relic with a curse)
    name: 'The Pie Contest', emoji: '🥧', speaker: null,
    line: 'A folding table groans under a dozen pies. The blue ribbon gleams. Nobody is watching the judging sheet…',
    choices: [
      { label: '🍰 Sneak a slice (heal 1/3 of your HP)', apply: (run) => `Heavenly. Healed ${heal(run, Math.floor(run.maxHp / 3))} HP.` },
      { label: '🥧 Enter your own pie (+5 Max HP)', apply: (run) => { run.maxHp += 5; run.hp += 5; return 'The judges are moved to tears. You grow as a person.'; } },
      { label: '🫙 Swipe the prize jar (a Farm Treasure… and Homework)', apply: (run, rng) => {
        const id = gainRelic(run, rng);
        run.deck.push(makeCard('homework'));
        return id ? 'The jar is YOURS! …There was homework taped under the lid.' : 'The jar was empty. The homework was real.';
      } },
    ],
  },
  beehive: { // sts: Golden Idol-flavored risk/reward
    name: 'The Beehive', emoji: '🐝', speaker: null,
    line: 'The hive hums like a tiny engine. The honeycomb drips gold. The bees are… watching.',
    choices: [
      { label: '🍯 Careful harvest (+45 gold)', apply: (run) => { run.gold += 45; return 'Slow hands, calm bees, sweet profit.'; } },
      { label: '🫳 Grab it ALL (+90 gold, the bees object: lose 10% HP)', apply: (run) => {
        run.gold += 90;
        run.hp = Math.max(1, run.hp - Math.max(1, Math.floor(run.maxHp * 0.1)));
        return 'WORTH IT. Mostly. Ow.';
      } },
      { label: '🚶 Leave the bees be', apply: () => 'The hive hums approvingly.' },
    ],
  },
  burn_barrel: { // sts: Bonfire Spirits (let a card go, feel better)
    name: 'The Burn Barrel', emoji: '🔥', speaker: null,
    line: 'Dusk. The burn barrel crackles, sparks climbing like fireflies. Room for one more thing — if you want to let something go.',
    choices: [
      { label: '🔥 Toss a card into the fire (remove it; heal 10)', can: (run) => removableCards(run).length > 1, apply: (run) => { heal(run, 10); run.pendingRemove = true; return 'PICK_CARD'; } },
      { label: '🧤 Just warm your hands (heal 6)', apply: (run) => `Healed ${heal(run, 6)} HP. The fire pops approvingly.` },
      { label: '🚶 Head on', apply: () => 'The sparks wave goodbye.' },
    ],
  },
  old_well: {
    name: 'The Old Well', emoji: '🪙', speaker: null,
    line: 'An old wishing well. The water glimmers. Toss a coin?',
    choices: [
      { label: '🪙 Make a wish (toss 10 gold)', can: (run) => run.gold >= 10, apply: (run, rng) => {
        run.gold -= 10;
        const roll = rng.random();
        if (roll < 0.4) { run.gold += 75; return 'SPLASH — a bucket of coins comes up! (+75 gold)'; }
        if (roll < 0.7) { heal(run, 10); return 'The water is cool and sweet. (+10 HP)'; }
        if (roll < 0.9) { return 'Plunk. Nothing. Wells, man.'; }
        run.deck.push(makeCard('poison_ivy')); return '🌿 You lean too far and tumble into the ivy patch — a useless Poison Ivy card sneaks into your deck!';
      } },
      { label: '🚶 Save your coins', apply: () => 'The well gurgles, unimpressed.' },
    ],
  },
};

export const EVENT_KEYS = Object.keys(EVENTS);
