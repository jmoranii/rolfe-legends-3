// Rolfe Legends 3 — the WORLD OF WEIRDOS bestiary. Every enemy still mirrors a
// Slay the Spire original's mechanic (sts:), reskinned as a weirdo with extreme
// creative liberty (James's directive). Stats scale per world for FRESH 12-floor
// expedition decks: W1 gentlest → W4 brutal. Duck bosses are comedy-menace and
// get CALMED, never hurt (content rule).
// Move AI: nextMove(self, state, rng) → intent {name, kind, dmg?, times?, block?, fn?}.
// kinds: attack | defend | buff | debuff | sleep | special | flee | summon | countdown

import { applyStatus, addCardToCombat, spawnEnemy, livingEnemies, dealDamage } from './combat.js';

const A = (name, dmg, times) => ({ name, kind: 'attack', dmg, ...(times ? { times } : {}) });

export const ENEMIES = {
  // ================= WORLD 1 — The Crop Kingdom =================
  angry_sprout: { // sts: Cultist — ritual strength scaling
    name: 'The Sprout of Rage', emoji: '🌱', hp: [50, 56],
    nextMove(self, state) {
      if (self.state.ritual) applyStatus(state, self, 'strength', self.state.ritual);
      if (!self.state.grew) {
        self.state.grew = true;
        return { name: 'PHOTOSYNTHESIZE!!', kind: 'buff', fn: (st, e) => { e.state.ritual = 2; } };
      }
      return A('Leaf Slap', 8);
    },
  },
  corn_colonel: { // sts: Jaw Worm
    name: 'Corn Colonel', emoji: '🌽', hp: [46, 50],
    nextMove(self, state, rng) {
      const r = rng.random();
      if (self.state.last !== 'chomp' && r < 0.45) { self.state.last = 'chomp'; return A('Kernel Chomp', 13); }
      if (r < 0.75) { self.state.last = 'salute'; return { name: 'Cob Charge', kind: 'attack', dmg: 6, block: 5 }; }
      self.state.last = 'drill';
      return { name: 'Drill Formation', kind: 'buff', block: 6, fn: (st, e) => applyStatus(st, e, 'strength', 3) };
    },
  },
  rolling_pumpkin: { // sts: Louse — curls (a pumpkin tucks into its stem) on first hit
    name: 'Rolling Pumpkin', emoji: '🎃', hp: [17, 21],
    nextMove(self, state, rng) {
      if (self.state.curled && self.block <= 0 && self.artKey === 'rolling_pumpkin_curled') {
        self.name = 'Rolling Pumpkin'; self.artKey = 'rolling_pumpkin';
      }
      return rng.chance(0.75) ? A('Roll Over Toes', rng.range(6, 8)) : { name: 'Ripen', kind: 'buff', fn: (st, e) => applyStatus(st, e, 'strength', 1) };
    },
    onDamaged(self) {
      if (!self.state.curled && self.hp > 0) {
        self.state.curled = true; self.block += 6;
        self.name = 'Rolling Pumpkin (hunkered)'; self.artKey = 'rolling_pumpkin_curled';
      }
    },
  },
  compost_blob_m: { // sts: Slime (medium) — splits
    name: 'Compost Blob', emoji: '🥬', hp: [34, 38],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Gloop', 10) : { name: 'Stinky Waft', kind: 'debuff', fn: (st) => applyStatus(st, st.hero, 'weak', 1) };
    },
    onDamaged(self, state) {
      if (!self.state.split && self.hp > 0 && self.hp <= Math.floor(self.maxHp / 2)) {
        self.state.split = true;
        const spawn = spawnEnemy(state, 'compost_blob_s', { hp: self.hp });
        spawn.hp = self.hp;
        self.name = 'Compost Blob (split)';
        self.artKey = 'compost_blob_s';
        self.maxHp = self.hp;
      }
    },
  },
  compost_blob_s: { // sts: Slime (small)
    name: 'Compost Blip', emoji: '🍂', hp: [12, 14],
    nextMove() { return A('Squish', 4); },
  },
  weed_dandelion: { name: 'Dandelion Dan', emoji: '🌼', hp: [15, 18], // sts: Mad Gremlin
    nextMove() { return A('Fluff Punch', 6); },
    onDamaged(self, state) { applyStatus(state, self, 'strength', 1); } },
  weed_thistle: { name: 'Thistle Sisters', emoji: '🌾', hp: [12, 15], // sts: Sneaky Gremlin
    nextMove() { return A('Prickle Poke', 10); } },
  weed_burr: { name: 'Burr Boy', emoji: '🌰', hp: [15, 18], // sts: Fat Gremlin
    nextMove() { return { name: 'Sticky Tackle', kind: 'attack', dmg: 4, fn: (st) => applyStatus(st, st.hero, 'weak', 1) }; } },
  weed_clover: { name: 'Professor Clover', emoji: '🍀', hp: [11, 14], // sts: Gremlin Wizard support
    nextMove(self, state, rng) {
      const friends = livingEnemies(state).filter((e) => e !== self);
      if (friends.length && rng.chance(0.6)) {
        return { name: 'Lucky Speech', kind: 'buff', fn: (st, e) => { for (const f of livingEnemies(st)) if (f !== e) applyStatus(st, f, 'strength', 1); } };
      }
      return A('Leaf Flick', 4);
    } },
  puff_dandelion: { // sts: Fungi Beast — Vulnerable puff on death
    name: 'Puffy the Inevitable', emoji: '🌬️', hp: [26, 30],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Seed Bonk', 8) : { name: 'Swell Up', kind: 'buff', fn: (st, e) => applyStatus(st, e, 'strength', 3) };
    },
    onDeath(self, state) { applyStatus(state, state.hero, 'vulnerable', 2); },
  },
  crow_thief: { // sts: Looter — steals gold, then flees with it
    name: 'Sneaky Beaky', emoji: '🐦‍⬛', hp: [48, 52],
    nextMove(self) {
      self.state.t = (self.state.t || 0) + 1;
      if (self.state.t <= 2) {
        return { name: 'Snatch!', kind: 'attack', dmg: 10, fn: (st, e) => { e.stolen += 15; st.goldStolen = (st.goldStolen || 0) + 15; } };
      }
      if (self.state.t === 3) return { name: 'Wing Guard', kind: 'defend', block: 6 };
      return { name: 'Fly Off!', kind: 'flee', fn: (st, e) => { e.fled = true; } };
    },
  },
  sticky_vine: { // sts: Slaver — Weak webs
    name: 'The Sticky Vine', emoji: '🌿', hp: [54, 58],
    nextMove(self, state, rng) {
      if (self.state.last !== 'wrap' && rng.chance(0.4)) {
        self.state.last = 'wrap';
        return { name: 'Sap Wrap', kind: 'debuff', fn: (st) => applyStatus(st, st.hero, 'weak', 2) };
      }
      self.state.last = 'lash';
      return A('Vine Lash', 13);
    },
  },
  giant_zucchini: { // sts: Gremlin Nob — enrages when you play skills
    name: 'The Giant Zucchini', emoji: '🥒', hp: [86, 92], elite: true,
    init(self) { self.state.enrage = 0; },
    nextMove(self, state, rng) {
      if (!self.state.flexed) {
        self.state.flexed = true;
        return { name: 'Vegetable Flex', kind: 'buff', fn: (st, e) => { e.state.enraged = 2; } };
      }
      return rng.chance(0.33) ? { name: 'Squash Slam', kind: 'attack', dmg: 9, fn: (st) => applyStatus(st, st.hero, 'vulnerable', 2) } : A('Full Zucchini', 16);
    },
    onHeroCard(self, state, info) {
      if (self.state.enraged && info.type === 'skill') applyStatus(state, self, 'strength', self.state.enraged);
    },
  },
  mega_melon: { // sts: Lagavulin — sits there. Roundly. Dormant until provoked.
    name: 'The Mega Melon', emoji: '🍉', hp: [100, 106], elite: true,
    init(self) { self.state.dormant = true; self.state.cycle = 0; },
    nextMove(self, state) {
      if (self.state.dormant && state.turn < 4 && !self.state.woke) {
        return { name: 'Sits there. Roundly.', kind: 'sleep', block: 8 };
      }
      self.state.dormant = false;
      const c = self.state.cycle++ % 3;
      if (c < 2) return A('Rind Bash', 18);
      return { name: 'Seed-Spit Stare', kind: 'debuff', fn: (st) => { applyStatus(st, st.hero, 'strength', -1); st.hero.dexterity -= 1; } };
    },
    onDamaged(self) {
      if (self.state.dormant && !self.state.woke) { self.state.woke = true; self.state.dormant = false; }
    },
  },
  sprinkler_post: { // sts: Sentry — shoves Straw (soggy hay clogs your hand)
    name: 'Sprinkler Post', emoji: '💦', hp: [36, 40], elite: true,
    init(self, state) { self.state.beam = state.enemies.length % 2 === 0; },
    nextMove(self) {
      self.state.beam = !self.state.beam;
      if (self.state.beam) return A('Power Wash', 9);
      return { name: 'Soggy Spray', kind: 'debuff', fn: (st) => addCardToCombat(st, 'straw', 2, 'discard') };
    },
  },
  boss_brownie: { // sts: The Champ chassis + mystery moves — nobody knows WHAT she is
    name: 'BROWNIE, QUEEN OF CROPS', emoji: '🦆', hp: [175, 175], boss: true,
    init(self) { self.state.i = 0; },
    nextMove(self, state, rng) {
      if (!self.state.tantrum && self.hp <= self.maxHp / 2) {
        self.state.tantrum = true;
        return { name: 'ROYAL DUCK TANTRUM!', kind: 'buff', fn: (st, e) => { applyStatus(st, e, 'strength', 3); e.weak = 0; e.vulnerable = 0; } };
      }
      if (self.state.tantrum) {
        // post-tantrum she goes full mystery: nobody knows what she'll do (they know it hurts)
        const wild = [A('WHAT IS SHE?!', 9, 2), A('Unidentifiable Slam', 18), { name: 'Mystery Molt', kind: 'buff', block: 12, fn: (st, e) => applyStatus(st, e, 'strength', 2) }];
        return rng.pick(wild);
      }
      const seq = [
        A('Waddle Charge', 15),
        { name: 'Wing Wall', kind: 'defend', block: 14, fn: (st, e) => applyStatus(st, e, 'strength', 1) },
        { name: 'The Unknowable Quack', kind: 'debuff', fn: (st) => { applyStatus(st, st.hero, 'weak', 2); applyStatus(st, st.hero, 'frail', 2); } },
        A('Peck-Peck-Peck', 6, 2),
      ];
      return seq[self.state.i++ % seq.length];
    },
  },

  // ================= WORLD 2 — Critter Meadow =================
  sparkmouse: { // sts: Darkling — revives unless the pack is all down
    name: 'Sparkmouse', emoji: '⚡', hp: [32, 36],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Static Zap', 8) : { name: 'Charge Up', kind: 'buff', block: 4, fn: (st, e) => applyStatus(st, e, 'strength', 1) };
    },
    onDeath(self, state) {
      const others = livingEnemies(state).length;
      if (others > 0) self.state.reviveIn = 2;
    },
  },
  flame_pup: { // sts: Jaw Worm, hotter
    name: 'Flame Pup', emoji: '🔥', hp: [44, 48],
    nextMove(self, state, rng) {
      const r = rng.random();
      if (self.state.last !== 'bite' && r < 0.45) { self.state.last = 'bite'; return A('Sizzle Bite', 11); }
      if (r < 0.75) { self.state.last = 'wag'; return { name: 'Warm Wag', kind: 'attack', dmg: 7, block: 6 }; }
      self.state.last = 'flare';
      return { name: 'Flare Up', kind: 'buff', block: 6, fn: (st, e) => applyStatus(st, e, 'strength', 3) };
    },
  },
  leaf_turtle: { // sts: Shelled Parasite — plated armor regrows
    name: 'Leaf Turtle', emoji: '🐢', hp: [52, 58],
    init(self) { self.block_persist = true; self.block = 5; },
    nextMove(self, state, rng) {
      self.block += 3;
      return rng.chance(0.5) ? A('Snap-Snap', 6, 2) : A('Shell Spin', 11);
    },
  },
  bubble_frog: { // sts: Orb Walker — pelts junk into your draw pile
    name: 'Bubble Frog', emoji: '🫧', hp: [56, 62],
    nextMove(self, state, rng) {
      return rng.chance(0.6)
        ? { name: 'Bubble Barrage', kind: 'attack', dmg: 9, fn: (st) => addCardToCombat(st, 'hailstone', 1, 'draw') }
        : A('Tongue Whip', 12);
    },
  },
  mimic_moth: { // sts: Snecko — dizzy dust randomizes card costs
    name: 'The Mimic Moth', emoji: '🦋', hp: [66, 72],
    init(self, state) { state.flags.confused = true; },
    nextMove(self, state, rng) {
      if (!self.state.danced) { self.state.danced = true; return { name: 'Dizzy Dust', kind: 'debuff', fn: () => {} }; }
      return rng.chance(0.6) ? A('Wing Slam', 11) : { name: 'Powder Puff', kind: 'attack', dmg: 9, fn: (st) => applyStatus(st, st.hero, 'vulnerable', 2) };
    },
    onDeath(self, state) { state.flags.confused = false; },
  },
  snatchling: { // sts: Looter
    name: 'Snatchling', emoji: '🐿️', hp: [52, 56],
    nextMove(self) {
      self.state.t = (self.state.t || 0) + 1;
      if (self.state.t <= 2) return { name: 'Cheek-Pouch Grab', kind: 'attack', dmg: 11, fn: (st, e) => { e.stolen += 20; st.goldStolen = (st.goldStolen || 0) + 20; } };
      if (self.state.t === 3) return { name: 'Fluff Up', kind: 'defend', block: 10 };
      return { name: 'Scurry Off!', kind: 'flee', fn: (st, e) => { e.fled = true; } };
    },
  },
  puffbunny: { // sts: Fungi Beast
    name: 'Puffbunny', emoji: '🐰', hp: [30, 34],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Boop', 8) : { name: 'Floof Up', kind: 'buff', fn: (st, e) => applyStatus(st, e, 'strength', 3) };
    },
    onDeath(self, state) { applyStatus(state, state.hero, 'vulnerable', 2); },
  },
  big_chonk: { // sts: Gremlin Nob — a hamster the size of a hay bale
    name: 'BIG CHONK', emoji: '🐹', hp: [92, 98], elite: true,
    init(self) { self.state.enrage = 0; },
    nextMove(self, state, rng) {
      if (!self.state.stuffed) {
        self.state.stuffed = true;
        return { name: 'Stuff Both Cheeks', kind: 'buff', fn: (st, e) => { e.state.enraged = 2; } };
      }
      return rng.chance(0.33) ? { name: 'Cheek Slam', kind: 'attack', dmg: 9, fn: (st) => applyStatus(st, st.hero, 'vulnerable', 2) } : A('FULL CHONK', 17);
    },
    onHeroCard(self, state, info) {
      if (self.state.enraged && info.type === 'skill') applyStatus(state, self, 'strength', self.state.enraged);
    },
  },
  queen_bee: { // sts: Book of Stabbing — scaling multi-sting
    name: 'Her Majesty the Bee', emoji: '🐝', hp: [112, 118], elite: true,
    init(self) { self.state.n = 2; },
    nextMove(self, state, rng) {
      if (rng.chance(0.7)) { const n = self.state.n++; return A('Royal Sting Flurry', 5, n); }
      return A('THE POINT', 15);
    },
  },
  totem_triplets: { // sts: Sentry — three tiny judgemental critter statues
    name: 'Totem Triplet', emoji: '🗿', hp: [38, 42], elite: true,
    init(self, state) { self.state.beam = state.enemies.length % 2 === 0; },
    nextMove(self) {
      self.state.beam = !self.state.beam;
      if (self.state.beam) return A('Judgy Beam', 9);
      return { name: 'Confetti of Junk', kind: 'debuff', fn: (st) => addCardToCombat(st, 'straw', 2, 'discard') };
    },
  },
  boss_diver: { // sts: Book of Stabbing chassis — dive-bombs that GROW, goggle-guard rest beats
    name: 'DIVER, TERROR OF THE POND', emoji: '🦆', hp: [178, 178], boss: true,
    init(self) { self.state.n = 1; self.state.i = 0; },
    nextMove(self, state, rng) {
      const c = self.state.i++ % 4;
      if (c === 0) return { name: 'Goggles Down.', kind: 'buff', block: 12, fn: (st, e) => applyStatus(st, e, 'strength', 1) };
      if (c === 3) { const n = ++self.state.n; return A(`DIVE BOMB x${n}`, 6, n); }
      return rng.chance(0.5) ? A('Cannonball Splash', 11) : { name: 'Spray & Shake', kind: 'debuff', dmg: 7, fn: (st) => applyStatus(st, st.hero, 'weak', 2) };
    },
  },

  // ================= WORLD 3 — Bricktopia =================
  brick_biter: { // sts: Jaw Worm in brick form
    name: 'Brick Biter', emoji: '🧱', hp: [50, 56],
    nextMove(self, state, rng) {
      const r = rng.random();
      if (self.state.last !== 'chomp' && r < 0.45) { self.state.last = 'chomp'; return A('Stud Chomp', 13); }
      if (r < 0.75) { self.state.last = 'clip'; return { name: 'Clip-On Armor', kind: 'attack', dmg: 9, block: 7 }; }
      self.state.last = 'stack';
      return { name: 'Stack Up', kind: 'buff', block: 8, fn: (st, e) => applyStatus(st, e, 'strength', 3) };
    },
  },
  sharp_brick: { // the univERSAL truth: stepping on a brick is agony. High thorns, low attack.
    name: 'The Sharp Brick', emoji: '🔻', hp: [36, 40],
    init(self) { self.thorns = 2; },
    nextMove(self, state, rng) {
      return rng.chance(0.5) ? A('Corner Jab', 7) : { name: 'Lie In Wait (ouch)', kind: 'defend', block: 9 };
    },
  },
  minifig_scrapper: { name: 'Minifig Scrapper', emoji: '🤺', hp: [13, 16], // sts: Mad Gremlin
    nextMove() { return A('Tiny Sword', 6); },
    onDamaged(self, state) { applyStatus(state, self, 'strength', 1); } },
  minifig_ninja: { name: 'Minifig Ninja', emoji: '🥷', hp: [12, 16], // sts: Sneaky Gremlin
    nextMove() { return A('Sneak Bonk', 9); } },
  minifig_knight: { name: 'Minifig Knight', emoji: '🛡️', hp: [18, 22], // sts: Fat Gremlin
    nextMove() { return { name: 'Shield Shove', kind: 'attack', dmg: 5, fn: (st) => applyStatus(st, st.hero, 'weak', 1) }; } },
  minifig_wizard: { name: 'Minifig Wizard', emoji: '🧙', hp: [13, 17], // sts: Gremlin Wizard support
    nextMove(self, state, rng) {
      const friends = livingEnemies(state).filter((e) => e !== self);
      if (friends.length && rng.chance(0.6)) {
        return { name: 'Plastic Magic', kind: 'buff', fn: (st, e) => { for (const f of livingEnemies(st)) if (f !== e) applyStatus(st, f, 'strength', 1); } };
      }
      return A('Zap Wand', 5);
    } },
  brick_golem_m: { // sts: Slime — falls apart into loose bricks at half
    name: 'Brick Golem', emoji: '🗿', hp: [40, 46],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Block Fist', 9) : { name: 'Loose Stud Spray', kind: 'debuff', fn: (st) => applyStatus(st, st.hero, 'weak', 1) };
    },
    onDamaged(self, state) {
      if (!self.state.split && self.hp > 0 && self.hp <= Math.floor(self.maxHp / 2)) {
        self.state.split = true;
        const spawn = spawnEnemy(state, 'brick_pile', { hp: self.hp });
        spawn.hp = self.hp;
        self.name = 'Brick Golem (crumbling)';
        self.artKey = 'brick_pile';
        self.maxHp = self.hp;
      }
    },
  },
  brick_pile: { // sts: small Slime
    name: 'Angry Brick Pile', emoji: '🧱', hp: [16, 20],
    nextMove() { return A('Scatter Jab', 6); },
  },
  instruction_golem: { // sts: Slaver — makes you follow the instructions
    name: 'The Instructions', emoji: '📋', hp: [50, 56],
    nextMove(self, state, rng) {
      if (self.state.last !== 'step' && rng.chance(0.4)) {
        self.state.last = 'step';
        return { name: 'STEP 47: YOU LOSE', kind: 'debuff', fn: (st) => applyStatus(st, st.hero, 'weak', 2) };
      }
      self.state.last = 'papercut';
      return A('Paper Cut', 12);
    },
  },
  wobble_tower: { // sts: Writhing Mass — a tower built wrong, flinging pieces
    name: 'The Wobble Tower', emoji: '🏗️', hp: [92, 98],
    nextMove(self, state, rng) {
      if (!self.state.cursed) {
        self.state.cursed = true;
        return { name: 'Fling Missing Piece', kind: 'debuff', dmg: 9, fn: (st) => addCardToCombat(st, 'poison_ivy', 1, 'discard') };
      }
      return rng.chance(0.5) ? A('Topple Lean', 13) : { name: 'Rebuild Wrong', kind: 'attack', dmg: 10, block: 11 };
    },
  },
  crane_head: { // sts: Giant Head — countdown to the wrecking ball
    name: 'The Crane', emoji: '🏗️', hp: [170, 170], elite: true,
    init(self) { self.state.count = 4; },
    nextMove(self) {
      if (self.state.count > 0) {
        const c = self.state.count--;
        return { name: `Winding Up (${c} until WRECK)`, kind: 'countdown', dmg: 9 };
      }
      return A('WRECKING BALL', 30);
    },
  },
  ghost_piece: { // sts: Nemesis — the piece that vanished under the couch; intangible alternating
    name: 'The Lost Piece', emoji: '👻', hp: [120, 126], elite: true,
    init(self) { self.intangible = true; },
    nextMove(self, state, rng) {
      self.intangible = !self.intangible;
      const r = rng.random();
      if (r < 0.35) return A('Under-Couch Ambush', 24);
      if (r < 0.7) return A('Phantom Snap', 6, 3);
      return { name: 'Haunt the Build', kind: 'debuff', fn: (st) => addCardToCombat(st, 'hailstone', 2, 'discard') };
    },
  },
  master_builder: { // sts: Reptomancer — builds minifig backup mid-fight
    name: 'The Master Builder', emoji: '👷', hp: [128, 134], elite: true,
    nextMove(self, state, rng) {
      const figs = livingEnemies(state).filter((e) => e.key === 'minifig_ninja').length;
      if (figs < 2 && rng.chance(0.5)) {
        return { name: 'Speed-Build Backup', kind: 'summon', fn: (st) => { spawnEnemy(st, 'minifig_ninja'); const d = st.enemies[st.enemies.length - 1]; d.intent = d.def.nextMove(d, st, st.rng); } };
      }
      return A('Blueprint Smack', 12);
    },
  },
  boss_harmless: { // sts: Lagavulin opener + Champ fury + Nemesis flicker — the hardest duck
    name: 'HARMLESS', emoji: '🦆', hp: [205, 205], boss: true,
    init(self) { self.state.i = 0; self.state.dormant = true; },
    nextMove(self, state) {
      if (self.state.dormant && state.turn < 3 && !self.state.woke) {
        return { name: 'Stands there. Harmlessly.', kind: 'sleep', block: 10 };
      }
      if (self.state.dormant) {
        self.state.dormant = false;
        return { name: '…HARMLESS?!', kind: 'buff', fn: (st, e) => { applyStatus(st, e, 'strength', 2); e.name = 'NOT HARMLESS'; } };
      }
      const c = self.state.i++ % 4;
      if (c === 3) { // every 4th turn she goes feather-shadow: untouchable
        self.intangible = true;
        return { name: 'Black Feather Flicker', kind: 'buff', block: 8 };
      }
      self.intangible = false;
      const seq = [A('Beetle-Green Blitz', 7, 2), { name: 'The Quiet Stare', kind: 'debuff', fn: (st) => { applyStatus(st, st.hero, 'weak', 2); applyStatus(st, st.hero, 'frail', 2); } }, A('NOT-HARMLESS SLAM', 17)];
      return seq[c];
    },
    onDamaged(self) {
      if (self.state.dormant && !self.state.woke) { self.state.woke = true; }
    },
  },

  // ================= WORLD 4 — The Kinetic Sandbox =================
  sand_blob_m: { // sts: Slime — kinetic sand splits SO satisfyingly
    name: 'Kinetic Blob', emoji: '🟣', hp: [42, 48],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Squish Slam', 9) : { name: 'Slow Ooze', kind: 'debuff', fn: (st) => applyStatus(st, st.hero, 'weak', 1) };
    },
    onDamaged(self, state) {
      if (!self.state.split && self.hp > 0 && self.hp <= Math.floor(self.maxHp / 2)) {
        self.state.split = true;
        const spawn = spawnEnemy(state, 'sand_blob_s', { hp: self.hp });
        spawn.hp = self.hp;
        self.name = 'Kinetic Blob (sheared)';
        self.artKey = 'sand_blob_s';
        self.maxHp = self.hp;
      }
    },
  },
  sand_blob_s: {
    name: 'Kinetic Blip', emoji: '🟪', hp: [20, 24],
    nextMove() { return A('Grain Spray', 7); },
  },
  squish_ball: { // sts: Louse + the STAGGER PREVIEW: break its squish → helpless a turn
    name: 'The Squish Ball', emoji: '🟠', hp: [42, 48],
    nextMove(self, state, rng) {
      if (self.state.staggered) {
        self.state.staggered = false;
        return { name: 'Squished flat — HELPLESS!', kind: 'sleep' };
      }
      return rng.chance(0.7) ? A('Bounce Attack', rng.range(8, 10)) : { name: 'Re-Squish', kind: 'buff', block: 8 };
    },
    onDamaged(self) {
      if (!self.state.squished && self.hp > 0) {
        self.state.squished = true; self.block += 9;
        self.name = 'The Squish Ball (squishing)';
      } else if (self.state.squished && self.block <= 0 && !self.state.staggerDone) {
        // its squish is broken: one helpless turn (the Magnet Menace preview)
        self.state.staggered = true; self.state.staggerDone = true;
        self.intent = { name: 'Squished flat — HELPLESS!', kind: 'sleep' };
      }
    },
  },
  glitter_storm: { // sts: Orb Walker
    name: 'The Glitter Storm', emoji: '✨', hp: [72, 78],
    nextMove(self, state, rng) {
      return rng.chance(0.6)
        ? { name: 'Glitter Blast', kind: 'attack', dmg: 9, fn: (st) => addCardToCombat(st, 'hailstone', 1, 'draw') }
        : A('Sparkle Slam', 12);
    },
  },
  sandworm: { // sts: Spire Growth — constricts
    name: 'The Sandworm', emoji: '🪱', hp: [128, 134],
    nextMove(self, state, rng) {
      if (!state.flags.constrict) {
        return { name: 'Sandy Squeeze', kind: 'debuff', fn: (st) => { st.flags.constrict = 5; } };
      }
      return rng.chance(0.5) ? A('Burrow Strike', 14) : A('Tail Sweep', 11);
    },
    onDeath(self, state) { state.flags.constrict = 0; },
  },
  play_dough_twin_a: { // sts: Centurion — shields its twin
    name: 'Dough Twin (Blue)', emoji: '🔵', hp: [68, 74],
    nextMove(self, state, rng) {
      const buddy = livingEnemies(state).find((e) => e.key === 'play_dough_twin_b');
      if (buddy && rng.chance(0.45)) {
        return { name: 'Squish Together (shield)', kind: 'defend', fn: (st, e) => { buddy.block += 16; } };
      }
      return A('Dough Punch', 10);
    },
  },
  play_dough_twin_b: { // sts: Mystic — heals its twin
    name: 'Dough Twin (Red)', emoji: '🔴', hp: [54, 60],
    nextMove(self, state, rng) {
      const buddy = livingEnemies(state).find((e) => e.key === 'play_dough_twin_a');
      if (buddy && buddy.hp < buddy.maxHp && rng.chance(0.55)) {
        return { name: 'Re-Knead (heal)', kind: 'buff', fn: () => { buddy.hp = Math.min(buddy.maxHp, buddy.hp + 14); } };
      }
      return A('Dough Flick', 10);
    },
  },
  magnet_mite: { // sts: Darkling — magnets ALWAYS come back
    name: 'Magnet Mite', emoji: '🧲', hp: [36, 42],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Cling Zap', 7) : { name: 'Polarize', kind: 'buff', block: 6, fn: (st, e) => applyStatus(st, e, 'strength', 2) };
    },
    onDeath(self, state) {
      const others = livingEnemies(state).length;
      if (others > 0) self.state.reviveIn = 2;
    },
  },
  static_cling: { // sts: Snecko — EVERYTHING sticks to everything
    name: 'Static Cling', emoji: '⚡', hp: [78, 84],
    init(self, state) { state.flags.confused = true; },
    nextMove(self, state, rng) {
      if (!self.state.danced) { self.state.danced = true; return { name: 'Cling Field', kind: 'debuff', fn: () => {} }; }
      return rng.chance(0.6) ? A('Shock Grab', 12) : { name: 'Hair-Raiser', kind: 'attack', dmg: 11, fn: (st) => applyStatus(st, st.hero, 'vulnerable', 2) };
    },
    onDeath(self, state) { state.flags.confused = false; },
  },
  sand_castle: { // sts: Giant Head — the tide is coming
    name: 'The Last Sand Castle', emoji: '🏰', hp: [200, 200], elite: true,
    init(self) { self.state.count = 4; },
    nextMove(self) {
      if (self.state.count > 0) {
        const c = self.state.count--;
        return { name: `The Tide Rises (${c} until WAVE)`, kind: 'countdown', dmg: 10 };
      }
      return A('THE BIG WAVE', 32);
    },
  },
  rake_fingers: { // sts: Book of Stabbing — scaling rake
    name: 'Rake Fingers', emoji: '🖐️', hp: [136, 142], elite: true,
    init(self) { self.state.n = 2; },
    nextMove(self, state, rng) {
      if (rng.chance(0.7)) { const n = self.state.n++; return A('Rake Flurry', 6, n); }
      return A('Deep Groove', 17);
    },
  },
  dust_bunny_mother: { // sts: Reptomancer — where DO they come from
    name: 'The Dust Bunny Mother', emoji: '🐇', hp: [144, 150], elite: true,
    nextMove(self, state, rng) {
      const bunnies = livingEnemies(state).filter((e) => e.key === 'dust_bunny').length;
      if (bunnies < 2 && rng.chance(0.5)) {
        return { name: 'Multiply (somehow)', kind: 'summon', fn: (st) => { spawnEnemy(st, 'dust_bunny'); const d = st.enemies[st.enemies.length - 1]; d.intent = d.def.nextMove(d, st, st.rng); } };
      }
      return A('Fluff Avalanche', 13);
    },
  },
  dust_bunny: { // sts: Dagger
    name: 'Dust Bunny', emoji: '💨', hp: [22, 26],
    nextMove(self) {
      if (!self.state.hit) { self.state.hit = true; return A('Allergy Attack', 10); }
      return { name: 'Drift Away', kind: 'flee', fn: (st, e) => { e.fled = true; } };
    },
  },

  // ============ THE FINALE: THE KINETIC SAND MONSTER (The Magnet Menace) ============
  // The boys' own design, mechanic by mechanic (DESIGN.md §LOCKED):
  //   Aaron: limbs detach and fight; a beaten limb sinks back into the body;
  //          the magnet core throws 50-DAMAGE magnets ("we really wanna make fifty work").
  //   Wyatt: 50 damage to the body sheds ALL the sand → the magnet lies HELPLESS
  //          for exactly one turn → ~100 HP core. Combined by them, built as designed.
  sand_monster: {
    name: 'THE KINETIC SAND MONSTER', emoji: '🏖️', hp: [160, 160], boss: true,
    init(self) { self.state.taken = 0; self.state.i = 0; self.state.limbTimer = 0; },
    nextMove(self, state) {
      const limbs = livingEnemies(state).filter((e) => e.key === 'sand_limb').length;
      self.state.limbTimer += 1;
      if (limbs < 2 && self.state.limbTimer >= 3) {
        self.state.limbTimer = 0;
        return { name: 'A LIMB TEARS LOOSE!', kind: 'summon', fn: (st) => { spawnEnemy(st, 'sand_limb'); const d = st.enemies[st.enemies.length - 1]; d.intent = d.def.nextMove(d, st, st.rng); } };
      }
      const seq = [A('Sand Swipe', 12), { name: 'Pack More Sand', kind: 'defend', block: 12 }, A('Dune Crush', 8, 2)];
      return seq[self.state.i++ % seq.length];
    },
    onDamaged(self, state, dmg) {
      // Wyatt's shed: 50 cumulative damage knocks ALL the sand off
      self.state.taken += dmg;
      if (self.state.taken >= 50 && self.hp > 0 && !self.state.shed) {
        self.state.shed = true;
        // every limb sinks back into the sand as it falls away (Aaron's rule)
        for (const e of state.enemies) if (e.key === 'sand_limb' && !e.gone) { e.gone = true; e.hp = 0; }
        // the sand falls away → THE MAGNET, helpless for exactly one turn
        self.name = 'THE MAGNET';
        self.artKey = 'magnet_core';
        self.emoji = '🧲';
        self.maxHp = 100; self.hp = 100; self.block = 0;
        self.state.phase = 'magnet'; self.state.staggered = true; self.state.i = 0;
        self.intent = { name: 'HELPLESS — NOW IS YOUR CHANCE!', kind: 'sleep' };
      }
    },
  },
  sand_limb: { // a torn-loose arm of packed sand; beaten → sinks back into the body
    name: 'Sand Limb', emoji: '💪', hp: [30, 34],
    nextMove(self, state, rng) {
      return rng.chance(0.7) ? A('Limb Slam', 8) : { name: 'Re-Pack', kind: 'defend', block: 8 };
    },
    onDeath(self, state) {
      // it sinks back into the monster — the body drinks the sand as armor
      const body = state.enemies.find((e) => e.key === 'sand_monster' && e.hp > 0 && !e.state.shed);
      if (body) body.block += 8;
    },
  },
};

// The Magnet's post-shed turn cycle lives outside the seq tables: helpless once,
// then MAGNETIZE (windup) → MAGNET THROW (the fifty) forever. Kids get one clean
// turn to unload, then must respect the windup rhythm.
const monsterNext = ENEMIES.sand_monster.nextMove;
ENEMIES.sand_monster.nextMove = function (self, state, rng) {
  if (self.state.phase === 'magnet') {
    if (self.state.staggered) {
      self.state.staggered = false;
      return { name: 'HELPLESS — NOW IS YOUR CHANCE!', kind: 'sleep' };
    }
    if (self.state.i++ % 2 === 0) {
      return { name: 'MAGNETIZING… (brace yourself!)', kind: 'buff', block: 6 };
    }
    return A('MAGNET THROW', 50); // the fifty. The boys were clear.
  }
  return monsterNext.call(this, self, state, rng);
};
