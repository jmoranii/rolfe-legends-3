// Rolfe Legends 2 — bestiary. Every enemy mirrors a Slay the Spire original (sts:).
// Move AI: nextMove(self, state, rng) → intent {name, kind, dmg?, times?, block?, fn?}.
// kinds: attack | defend | buff | debuff | sleep | special | flee | summon | countdown
// Circular import with combat.js is safe: helpers are called at runtime only.

import { applyStatus, addCardToCombat, spawnEnemy, livingEnemies, dealDamage } from './combat.js';

const A = (name, dmg, times) => ({ name, kind: 'attack', dmg, ...(times ? { times } : {}) });

export const ENEMIES = {
  // ================= ACT 1 — The Far Fields =================
  crow: { // sts: Cultist
    name: 'Cawing Crow', emoji: '🐦‍⬛', hp: [48, 54],
    nextMove(self) {
      if (!self.state.cawed) {
        self.state.cawed = true;
        return { name: 'CAW! CAW!', kind: 'buff', fn: (st, e) => { e.state.ritual = 2; } };
      }
      return A('Peck', 6);
    },
    init(self) { self.state.turnEnd = true; },
    // ritual: gains strength each turn after cawing (applied when its move executes)
    onHeroCard() {},
  },
  gopher: { // sts: Jaw Worm
    name: 'Gopher', emoji: '🐹', hp: [40, 44],
    nextMove(self, state, rng) {
      const r = rng.random();
      if (self.state.last !== 'chomp' && r < 0.45) { self.state.last = 'chomp'; return A('Chomp', 9); }
      if (r < 0.75) { self.state.last = 'thrash'; return { name: 'Thrash', kind: 'attack', dmg: 6, block: 5 }; }
      self.state.last = 'burrow';
      return { name: 'Burrow & Bulk', kind: 'buff', block: 6, fn: (st, e) => applyStatus(st, e, 'strength', 3) };
    },
  },
  roly_poly: { // sts: Louse (curls up for block on first hit)
    name: 'Roly-Poly', emoji: '🪲', hp: [13, 17],
    nextMove(self, state, rng) {
      // the art follows the mechanic: once the curl's Block is spent (it zeroes
      // at his turn start), he visibly unrolls — but the trick stays used up
      // (James's report Mon 2026-08-04: he was stuck curled forever)
      if (self.state.curled && self.block <= 0 && self.artKey === 'roly_poly_curled') {
        self.name = 'Roly-Poly'; self.artKey = 'roly_poly';
      }
      return rng.chance(0.75) ? A('Nibble', rng.range(5, 7)) : { name: 'Wiggle', kind: 'buff', fn: (st, e) => applyStatus(st, e, 'strength', 1) };
    },
    onDamaged(self, state) {
      if (!self.state.curled && self.hp > 0) {
        self.state.curled = true; self.block += 6;
        self.name = 'Roly-Poly (curled up)'; self.artKey = 'roly_poly_curled';
      }
    },
  },
  mud_blob_m: { // sts: Slime (medium) — splits into smalls at half
    name: 'Mud Blob', emoji: '🟤', hp: [28, 32],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Splat', 8) : { name: 'Ooze', kind: 'debuff', fn: (st) => applyStatus(st, st.hero, 'weak', 1) };
    },
    onDamaged(self, state) {
      if (!self.state.split && self.hp > 0 && self.hp <= Math.floor(self.maxHp / 2)) {
        self.state.split = true;
        const spawn = spawnEnemy(state, 'mud_blob_s', { hp: self.hp });
        spawn.hp = self.hp;
        // it "splits": original becomes one small too — so it wears the small blob's
        // face from here on, which is what actually happened to it
        self.name = 'Mud Blob (split)';
        self.artKey = 'mud_blob_s';
        self.maxHp = self.hp;
      }
    },
  },
  mud_blob_s: { // sts: Slime (small)
    name: 'Mud Blip', emoji: '🟫', hp: [11, 13],
    nextMove() { return A('Splish', 4); },
  },
  mouse_scrappy: { name: 'Scrappy Mouse', emoji: '🐭', hp: [12, 15], // sts: Mad Gremlin
    nextMove() { return A('Scratch', 5); },
    onDamaged(self, state) { applyStatus(state, self, 'strength', 1); } },
  mouse_zippy: { name: 'Zippy Mouse', emoji: '🐁', hp: [11, 14], // sts: Sneaky Gremlin
    nextMove() { return A('Zip Bite', 9); } },
  mouse_pudge: { name: 'Pudge Mouse', emoji: '🐭', hp: [14, 17], // sts: Fat Gremlin
    nextMove() { return { name: 'Belly Bump', kind: 'attack', dmg: 4, fn: (st) => applyStatus(st, st.hero, 'weak', 1) }; } },
  mouse_whiskers: { name: 'Whiskers the Wise', emoji: '🐀', hp: [10, 13], // sts: Gremlin Wizard-ish support
    nextMove(self, state, rng) {
      const friends = livingEnemies(state).filter((e) => e !== self);
      if (friends.length && rng.chance(0.6)) {
        return { name: 'Squeaky Speech', kind: 'buff', fn: (st, e) => { for (const f of livingEnemies(st)) if (f !== e) applyStatus(st, f, 'strength', 1); } };
      }
      return A('Nip', 4);
    } },
  puffball: { // sts: Fungi Beast (Vulnerable spore burst on death)
    name: 'Puffball', emoji: '🍄', hp: [24, 28],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Bump', 6) : { name: 'Swell', kind: 'buff', fn: (st, e) => applyStatus(st, e, 'strength', 3) };
    },
    onDeath(self, state) { applyStatus(state, state.hero, 'vulnerable', 2); },
  },
  magpie: { // sts: Looter (steals gold, then flees with it)
    name: 'Magpie', emoji: '🐦', hp: [46, 50],
    nextMove(self, state, rng) {
      self.state.t = (self.state.t || 0) + 1;
      if (self.state.t <= 2) {
        return { name: 'Snatch!', kind: 'attack', dmg: 8, fn: (st, e) => { e.stolen += 15; st.goldStolen = (st.goldStolen || 0) + 15; } };
      }
      if (self.state.t === 3) return { name: 'Flap', kind: 'defend', block: 6 };
      return { name: 'Fly Off!', kind: 'flee', fn: (st, e) => { e.fled = true; } };
    },
  },
  barn_spider: { // sts: Slaver (Weak webs)
    name: 'Barn Spider', emoji: '🕷️', hp: [46, 50],
    nextMove(self, state, rng) {
      if (self.state.last !== 'web' && rng.chance(0.4)) {
        self.state.last = 'web';
        return { name: 'Sticky Web', kind: 'debuff', fn: (st) => applyStatus(st, st.hero, 'weak', 2) };
      }
      self.state.last = 'bite';
      return A('Bite', 10);
    },
  },
  old_scarecrow: { // sts: Lagavulin — "Stands there. Menacingly." Dormant until provoked.
    name: 'Old Scarecrow', emoji: '🎃', hp: [92, 97], elite: true,
    init(self) { self.state.dormant = true; self.state.cycle = 0; },
    nextMove(self, state) {
      if (self.state.dormant && state.turn < 4 && !self.state.woke) {
        return { name: 'Stands there. Menacingly.', kind: 'sleep', block: 8, fn: (st, e) => { e.block += 0; } };
      }
      self.state.dormant = false;
      const c = self.state.cycle++ % 3;
      if (c < 2) return A('Straw Swipe', 14);
      return { name: 'Dead-Eye Glare', kind: 'debuff', fn: (st) => { applyStatus(st, st.hero, 'strength', -1); st.hero.dexterity -= 1; } };
    },
    onDamaged(self, state) {
      if (self.state.dormant && !self.state.woke) { self.state.woke = true; self.state.dormant = false; }
    },
  },
  ornery_ram: { // sts: Gremlin Nob — enrages when you play skills
    name: 'The Ornery Ram', emoji: '🐏', hp: [70, 74], elite: true,
    init(self) { self.state.enrage = 0; },
    nextMove(self, state, rng) {
      if (!self.state.snorted) {
        self.state.snorted = true;
        return { name: 'Angry Snort', kind: 'buff', fn: (st, e) => { e.state.enraged = 2; } };
      }
      return rng.chance(0.33) ? { name: 'Bull Rush', kind: 'attack', dmg: 7, fn: (st) => applyStatus(st, st.hero, 'vulnerable', 2) } : A('Full Charge', 12);
    },
    onHeroCard(self, state, info) {
      if (self.state.enraged && info.type === 'skill') applyStatus(state, self, 'strength', self.state.enraged);
    },
  },
  scarecrow_post: { // sts: Sentry — shoves Straw (Dazed)
    name: 'Scarecrow Post', emoji: '🌾', hp: [33, 37], elite: true,
    init(self, state) { self.state.beam = state.enemies.length % 2 === 0; },
    nextMove(self) {
      self.state.beam = !self.state.beam;
      if (self.state.beam) return A('Straw Beam', 8);
      return { name: 'Straw Toss', kind: 'debuff', fn: (st) => addCardToCombat(st, 'straw', 2, 'discard') };
    },
  },
  rogue_combine: { // sts: The Guardian — mode shift on damage threshold
    name: 'The Rogue Combine', emoji: '🚜', hp: [150, 150], boss: true,
    init(self) { self.state.mode = 'mow'; self.state.taken = 0; self.state.i = 0; self.state.defTurns = 0; },
    nextMove(self, state) {
      if (self.state.mode === 'hunker') {
        self.state.defTurns -= 1;
        if (self.state.defTurns <= 0) {
          return { name: 'Engine Roar (back to work)', kind: 'buff', block: 9, fn: (st, e) => { e.state.mode = 'mow'; e.thorns = 0; e.name = 'The Rogue Combine'; e.artKey = 'rogue_combine'; } };
        }
        return { name: 'Hunker Down', kind: 'defend', block: 15 };
      }
      // Guardian-true pacing: a setup turn before the haymaker
      const seq = [{ name: 'Rattle & Sputter', kind: 'debuff', block: 9, fn: (st) => applyStatus(st, st.hero, 'weak', 2) }, A('MOW', 20), A('Thresher Whirl', 4, 4)];
      return seq[self.state.i++ % seq.length];
    },
    onDamaged(self, state, dmg) {
      if (self.state.mode !== 'mow') return;
      self.state.taken += dmg;
      if (self.state.taken >= 35 && self.hp > 0) {
        self.state.taken = 0; self.state.mode = 'hunker'; self.state.defTurns = 2; self.thorns = 3;
        self.name = 'The Rogue Combine (armored)'; self.artKey = 'rogue_combine_hunker';
        self.intent = { name: 'CLANK — Defensive Mode', kind: 'defend', block: 15 };
      }
    },
  },

  mud_king: { // sts: Slime Boss — splits into two mediums at half (alt act-1 boss)
    name: 'THE MUD KING', emoji: '👑', hp: [155, 155], boss: true,
    init(self) { self.state.i = 0; },
    nextMove(self) {
      const seq = [
        { name: 'Royal Goop', kind: 'debuff', fn: (st) => addCardToCombat(st, 'straw', 2, 'discard') },
        { name: 'Gathers Himself…', kind: 'buff', block: 8 },
        A('MUD SLAM', 26),
      ];
      return seq[self.state.i++ % seq.length];
    },
    onDamaged(self, state) {
      if (!self.state.split && self.hp > 0 && self.hp <= Math.floor(self.maxHp / 2)) {
        self.state.split = true;
        self.gone = true;
        const hp = Math.max(1, self.hp);
        for (let i = 0; i < 2; i++) {
          const blob = spawnEnemy(state, 'mud_blob_m', { hp });
          blob.state.split = false;
          blob.intent = { name: 'Squelches into place', kind: 'buff' };
        }
      }
    },
  },

  // ================= ACT 2 — The Barnyard =================
  raccoon_bandit: { // sts: Mugger
    name: 'Raccoon Bandit', emoji: '🦝', hp: [48, 52],
    nextMove(self, state, rng) {
      self.state.t = (self.state.t || 0) + 1;
      if (self.state.t <= 2) return { name: 'Mug', kind: 'attack', dmg: 10, fn: (st, e) => { e.stolen += 20; st.goldStolen = (st.goldStolen || 0) + 20; } };
      if (self.state.t === 3) return { name: 'Trash-Lid Guard', kind: 'defend', block: 11 };
      return { name: 'Scamper Off!', kind: 'flee', fn: (st, e) => { e.fled = true; } };
    },
  },
  waltzing_weasel: { // sts: Snecko — confusion randomizes card costs
    name: 'Waltzing Weasel', emoji: '🦡', hp: [80, 84],
    init(self, state) { state.flags.confused = true; },
    nextMove(self, state, rng) {
      if (!self.state.danced) { self.state.danced = true; return { name: 'Hypnotic Waltz', kind: 'debuff', fn: () => {} }; }
      return rng.chance(0.6) ? A('Chomp', 12) : { name: 'Tail Whip', kind: 'attack', dmg: 8, fn: (st) => applyStatus(st, st.hero, 'vulnerable', 2) };
    },
    onDeath(self, state) { state.flags.confused = false; },
  },
  snapping_turtle: { // sts: Shelled Parasite — plated armor
    name: 'Snapping Turtle', emoji: '🐢', hp: [58, 62],
    init(self) { self.block_persist = true; self.block = 6; },
    nextMove(self, state, rng) {
      self.block += 3; // plating regrows
      return rng.chance(0.5) ? A('Double Snap', 5, 2) : A('Lunge', 9);
    },
  },
  possum_defender: { // sts: Centurion — protects its partner
    name: 'Possum (Big)', emoji: '🐀', hp: [74, 78],
    nextMove(self, state, rng) {
      const buddy = livingEnemies(state).find((e) => e.key === 'possum_healer');
      if (buddy && rng.chance(0.45)) {
        return { name: 'Play Dead (shield)', kind: 'defend', fn: (st, e) => { buddy.block += 15; } };
      }
      return A('Tail Swat', 9);
    },
  },
  possum_healer: { // sts: Mystic — heals its partner
    name: 'Possum (Little)', emoji: '🐁', hp: [54, 58],
    nextMove(self, state, rng) {
      const buddy = livingEnemies(state).find((e) => e.key === 'possum_defender');
      if (buddy && buddy.hp < buddy.maxHp && rng.chance(0.55)) {
        return { name: 'Nuzzle (heal)', kind: 'buff', fn: () => { buddy.hp = Math.min(buddy.maxHp, buddy.hp + 12); } };
      }
      return A('Nibble', 8);
    },
  },
  thorny_bramble: { // sts: Snake Plant
    name: 'Thorny Bramble', emoji: '🌵', hp: [72, 76],
    nextMove(self, state, rng) {
      return rng.chance(0.65) ? A('Triple Lash', 6, 3) : { name: 'Tangle', kind: 'debuff', fn: (st) => { applyStatus(st, st.hero, 'frail', 2); applyStatus(st, st.hero, 'weak', 1); } };
    },
  },
  porcupine: { // sts: Book of Stabbing — scaling multi-hit
    name: 'The Porcupine', emoji: '🦔', hp: [128, 132], elite: true,
    init(self) { self.state.n = 2; },
    nextMove(self, state, rng) {
      if (rng.chance(0.7)) { const n = self.state.n++; return A('Quill Flurry', 6, n); }
      return A('Big Quill', 17);
    },
  },
  fox: { // sts: Taskmaster — shoves Scraped Knees
    name: 'The Fox', emoji: '🦊', hp: [62, 66], elite: true,
    nextMove() {
      return { name: 'Sly Bite', kind: 'attack', dmg: 7, fn: (st) => addCardToCombat(st, 'scraped_knee', 1, 'discard') };
    },
  },
  raccoon_ringleader: { // sts: Gremlin Leader — summons bandits
    name: 'Raccoon Ringleader', emoji: '🦝', hp: [116, 122], elite: true,
    nextMove(self, state, rng) {
      const minions = livingEnemies(state).filter((e) => e.key === 'raccoon_minion').length;
      if (minions === 0) return { name: 'Rally the Gang!', kind: 'summon', fn: (st) => { spawnEnemy(st, 'raccoon_minion'); spawnEnemy(st, 'raccoon_minion'); for (const m of st.enemies) if (m.key === 'raccoon_minion' && !m.intent) m.intent = m.def.nextMove(m, st, st.rng); } };
      if (rng.chance(0.4)) return { name: 'Big Cheer', kind: 'buff', block: 6, fn: (st, e) => { for (const f of livingEnemies(st)) if (f !== e) applyStatus(st, f, 'strength', 3); } };
      return A('Stab Dance', 6, 3);
    },
  },
  raccoon_minion: { // sts: Gremlin (summon)
    name: 'Raccoon Pup', emoji: '🦝', hp: [18, 22],
    nextMove(self, state, rng) { return rng.chance(0.7) ? A('Swipe', 6) : { name: 'Hiss', kind: 'defend', block: 5 }; },
  },
  raccoon_king: { // sts: The Champ — taunts, enrages at half
    name: 'THE RACCOON KING', emoji: '👑', hp: [250, 250], boss: true,
    init(self) { self.state.i = 0; },
    nextMove(self, state, rng) {
      if (!self.state.enraged && self.hp <= self.maxHp / 2) {
        self.state.enraged = true;
        return { name: 'ROYAL FURY!', kind: 'buff', fn: (st, e) => { applyStatus(st, e, 'strength', 4); e.weak = 0; e.vulnerable = 0; } };
      }
      if (self.state.enraged) {
        return self.state.i++ % 2 === 0 ? A('Execute', 10, 2) : A('Lid Slam', 18);
      }
      const seq = [
        A('Lid Slam', 14),
        { name: 'Trash-Lid Wall', kind: 'defend', block: 18, fn: (st, e) => applyStatus(st, e, 'strength', 2) },
        { name: 'Royal Taunt', kind: 'debuff', fn: (st) => { applyStatus(st, st.hero, 'weak', 2); applyStatus(st, st.hero, 'frail', 2); } },
        A('One-Two Scratch', 7, 2),
      ];
      return seq[self.state.i++ % seq.length];
    },
  },

  // ================= ACT 3 — The Storm =================
  ball_lightning: { // sts: Darkling — revives unless all downed
    name: 'Ball Lightning', emoji: '⚡', hp: [48, 52],
    nextMove(self, state, rng) {
      return rng.chance(0.6) ? A('Zap', 9) : { name: 'Crackle', kind: 'buff', block: 6, fn: (st, e) => applyStatus(st, e, 'strength', 2) };
    },
    onDeath(self, state) {
      const others = livingEnemies(state).length;
      if (others > 0) self.state.reviveIn = 2;
    },
  },
  hail_cloud: { // sts: Orb Walker — shoves Hailstones
    name: 'Hail Cloud', emoji: '🌨️', hp: [78, 82],
    nextMove(self, state, rng) {
      return rng.chance(0.6)
        ? { name: 'Pelt', kind: 'attack', dmg: 10, fn: (st) => addCardToCombat(st, 'hailstone', 1, 'draw') }
        : A('Gust Slam', 13);
    },
  },
  flooding_creek: { // sts: Spire Growth — constrict
    name: 'Flooding Creek', emoji: '🌊', hp: [144, 148],
    nextMove(self, state, rng) {
      if (!state.flags.constrict) {
        return { name: 'Rising Water', kind: 'debuff', fn: (st) => { st.flags.constrict = 5; } };
      }
      return rng.chance(0.5) ? A('Crash', 18) : A('Undertow', 14);
    },
    onDeath(self, state) { state.flags.constrict = 0; },
  },
  passing_squall: { // sts: Transient — massive hits, leaves on its own
    name: 'The Passing Squall', emoji: '🌬️', hp: [999, 999],
    init(self) { self.state.t = 0; },
    nextMove(self) {
      self.state.t += 1;
      if (self.state.t >= 5) return { name: 'Blows Over…', kind: 'flee', fn: (st, e) => { e.fled = true; } };
      return A('Howling Gust', 18 + (self.state.t - 1) * 3);
    },
  },
  debris_tangle: { // sts: Writhing Mass — shoves a curse
    name: 'Debris Tangle', emoji: '🌪️', hp: [136, 140],
    nextMove(self, state, rng) {
      if (!self.state.cursed) {
        self.state.cursed = true;
        return { name: 'Fling Ivy', kind: 'debuff', dmg: 8, fn: (st) => addCardToCombat(st, 'poison_ivy', 1, 'discard') };
      }
      return rng.chance(0.5) ? A('Wire Whip', 13) : { name: 'Junk Wall', kind: 'attack', dmg: 9, block: 10 };
    },
  },
  thunderhead: { // sts: Giant Head — countdown to a massive strike
    name: 'The Thunderhead', emoji: '⛈️', hp: [235, 235], elite: true,
    init(self) { self.state.count = 4; },
    nextMove(self) {
      if (self.state.count > 0) {
        const c = self.state.count--;
        return { name: `Rumble (${c} until STRIKE)`, kind: 'countdown', dmg: 11 };
      }
      return A('THUNDERSTRIKE', 34);
    },
  },
  ghost_wind: { // sts: Nemesis — intangible alternating turns
    name: 'Ghost Wind', emoji: '👻', hp: [155, 160], elite: true,
    init(self) { self.intangible = true; },
    nextMove(self, state, rng) {
      self.intangible = !self.intangible;
      const r = rng.random();
      if (r < 0.35) return A('Spectral Scythe', 36);
      if (r < 0.7) return A('Chill Swipe', 6, 3);
      return { name: 'Icy Breath', kind: 'debuff', fn: (st) => addCardToCombat(st, 'hailstone', 2, 'discard') };
    },
  },
  wind_funnel: { // sts: Reptomancer — summons dust devils
    name: 'Wind Funnel', emoji: '🌀', hp: [150, 154], elite: true,
    nextMove(self, state, rng) {
      const devils = livingEnemies(state).filter((e) => e.key === 'dust_devil').length;
      if (devils < 2 && rng.chance(0.5)) {
        return { name: 'Spin Up Devils', kind: 'summon', fn: (st) => { spawnEnemy(st, 'dust_devil'); const d = st.enemies[st.enemies.length - 1]; d.intent = d.def.nextMove(d, st, st.rng); } };
      }
      return A('Funnel Slash', 14);
    },
  },
  dust_devil: { // sts: Dagger — attacks big then dissipates
    name: 'Dust Devil', emoji: '💨', hp: [20, 24],
    nextMove(self) {
      if (!self.state.hit) { self.state.hit = true; return A('Whirl Slam', 9); }
      return { name: 'Dissipate', kind: 'flee', fn: (st, e) => { e.fled = true; } };
    },
  },
  thunder: { // sts: Donu — alternates empowering the pair / attacking (alt act-3 pair boss)
    name: 'THUNDER', emoji: '⛈️', hp: [125, 125], boss: true,
    init(self) { self.state.i = 0; },
    nextMove(self) {
      if (self.state.i++ % 2 === 0) {
        return { name: 'BOOM! (both grow stronger)', kind: 'buff', fn: (st) => { for (const f of livingEnemies(st)) applyStatus(st, f, 'strength', 2); } };
      }
      return A('Thunderclap', 11, 2);
    },
  },
  lightning: { // sts: Deca — alternates shielding the pair / attacking (alt act-3 pair boss)
    name: 'LIGHTNING', emoji: '🌩️', hp: [130, 130], boss: true,
    init(self) { self.state.i = 0; },
    nextMove(self) {
      if (self.state.i++ % 2 === 1) {
        return { name: 'Static Shield (both)', kind: 'defend', fn: (st) => { for (const f of livingEnemies(st)) f.block += 11; } };
      }
      return A('Zap Volley', 5, 3);
    },
  },
  big_twister: { // sts: Awakened One — "dies," then RE-FORMS bigger (phase 2)
    name: 'THE BIG TWISTER', emoji: '🌪️', hp: [190, 190], boss: true,
    init(self) { self.state.phase = 1; self.state.i = 0; },
    nextMove(self, state, rng) {
      if (self.state.phase === 1) {
        const seq = [A('Gust Punch', 17), A('Twin Vortex', 9, 2), { name: 'Inhale', kind: 'buff', block: 12, fn: (st, e) => applyStatus(st, e, 'strength', 2) }];
        return seq[self.state.i++ % seq.length];
      }
      const seq2 = [A('MONSTER GUST', 24), A('Triple Funnel', 9, 3), { name: 'Roar of the Plains', kind: 'debuff', fn: (st) => { applyStatus(st, st.hero, 'weak', 2); applyStatus(st, st.hero, 'vulnerable', 2); } }];
      return seq2[self.state.i++ % seq2.length];
    },
    onHeroCard(self, state, info) {
      if (info.type === 'power') applyStatus(state, self, 'strength', 1); // curiosity
    },
    onDeath(self, state) {
      if (self.state.phase === 1) {
        self.state.phase = 2; self.deathHandled = false;
        self.maxHp = 200; self.hp = 200; self.block = 0;
        self.name = 'THE BIG TWISTER — REFORMED'; self.emoji = '🌪️'; self.artKey = 'big_twister_p2';
        self.strength = (self.strength || 0) + 2;
        self.state.i = 0;
        self.intent = { name: 'IT RE-FORMS…', kind: 'buff' };
      }
    },
  },
};

// Cultist-style ritual & other end-of-enemy-turn scaling handled via intents; the
// Cawing Crow's ritual ticks here (called from its attack executions implicitly
// through strength growth): simplest faithful version — Caw sets ritual, and each
// subsequent nextMove() call grants the ritual strength.
const crowNext = ENEMIES.crow.nextMove;
ENEMIES.crow.nextMove = function (self, state, rng) {
  if (self.state.ritual) applyStatus(state, self, 'strength', self.state.ritual);
  return crowNext.call(this, self, state, rng);
};
