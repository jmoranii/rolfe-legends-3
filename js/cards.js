// Rolfe Legends 3 — card data. Pure data; js/combat.js interprets.
// Every card notes its Slay the Spire original (design mirrors StS per DESIGN.md).
// Effect ops: dmg, times, allEnemies, block, draw, energy, loseHp, selfStr, selfDex,
// tempStr, status:{k,n,target:'target'|'self'|'all'}, addCard:{id,n,to}, power:'id',
// special:'key' (implemented in combat.js SPECIALS).

export const HEROES = {
  aaron: {
    id: 'aaron', name: 'Aaron the Strong', emoji: '🌪️', hp: 80,
    relic: 'big_breakfast',
    tagline: 'The Lil Tornado. Hits like a hay wagon.',
    starter: ['shove', 'shove', 'shove', 'shove', 'shove', 'brace', 'brace', 'brace', 'brace', 'tornado_slam'],
  },
  wyatt: {
    id: 'wyatt', name: 'Wyatt the Speedy', emoji: '⚡', hp: 64, // StS Silent 70; RL3 dial — vs the weirdo bestiary his kit UNDERperforms (RL2's 51 was that game's nerf), 51→64 for parity
    relic: 'head_start',
    tagline: 'Fastest feet in Rolfe. Blink and you miss him.',
    starter: ['kick', 'kick', 'kick', 'kick', 'kick', 'dodge', 'dodge', 'dodge', 'dodge', 'dodge', 'nutmeg', 'quick_feet'],
  },
  liam: { // SECRET hero — unlocked via the title-screen Goldie egg. Defect spine.
    id: 'liam', name: 'Liam the Little', emoji: '🍼', hp: 62, // RL3 dial: his fresh-wall comes online fast in 12-floor worlds; 76→62 for parity
    relic: 'diaper_bag', secret: true,
    tagline: 'Two and a half feet of chaos. Diapers orbit him. Nobody knows why.',
    starter: ['bonk', 'bonk', 'bonk', 'bonk', 'peekaboo', 'peekaboo', 'peekaboo', 'peekaboo', 'change_it', 'double_trouble'],
  },
};

// Diaper (orb) reference — combat.js implements; UI + cards read this table.
// Mirrors StS orbs: stinky=Lightning, fresh=Frost, blowout=Dark, snack=Plasma.
export const DIAPERS = {
  stinky:  { name: 'Stinky Diaper', emoji: '💩', passive: 3, evoke: 8,  desc: 'Each turn: the smell deals {p} to a random enemy. Send it flying: {e}.' },
  fresh:   { name: 'Fresh Diaper', emoji: '🩲', passive: 2, evoke: 5,  desc: 'Each turn: clean & cozy, gain {p} Block. Evoke: {e} Block.' },
  blowout: { name: 'THE BLOWOUT', emoji: '🌋', passive: 6, evoke: 0,  desc: 'Grows +{p} damage every turn it floats. Evoke: unleash it ALL on the weakest enemy.' },
  snack:   { name: 'Snack Time', emoji: '🧃', passive: 0, evoke: 2,  desc: 'Each turn: +1 ⚡. Evoke: +{e} ⚡.' },
};

export const CARDS = {
  // ---------- Aaron the Strong (Ironclad spine) ----------
  shove:        { hero: 'aaron', name: 'Shove', emoji: '🫸', type: 'attack', cost: 1, rarity: 'starter', sts: 'Strike',
                  text: 'Deal {d} damage.', fx: [{ dmg: 6 }], up: { fx: [{ dmg: 9 }] } },
  brace:        { hero: 'aaron', name: 'Brace', emoji: '🛡️', type: 'skill', cost: 1, rarity: 'starter', sts: 'Defend',
                  text: 'Gain {b} Block.', fx: [{ block: 5 }], up: { fx: [{ block: 8 }] } },
  tornado_slam: { hero: 'aaron', name: 'Tornado Slam', emoji: '💥', type: 'attack', cost: 2, rarity: 'starter', sts: 'Bash',
                  text: 'Deal {d} damage. Apply {n} Vulnerable.', fx: [{ dmg: 8 }, { status: { k: 'vulnerable', n: 2, target: 'target' } }],
                  up: { fx: [{ dmg: 10 }, { status: { k: 'vulnerable', n: 3, target: 'target' } }] } },
  quick_jab:    { hero: 'aaron', name: 'Quick Jab', emoji: '🥊', type: 'attack', cost: 1, rarity: 'common', sts: 'Pommel Strike',
                  text: 'Deal {d} damage. Draw 1 card.', fx: [{ dmg: 9 }, { draw: 1 }], up: { fx: [{ dmg: 10 }, { draw: 2 }] } },
  hay_swing:    { hero: 'aaron', name: 'Hay Swing', emoji: '🌾', type: 'attack', cost: 1, rarity: 'common', sts: 'Cleave',
                  text: 'Deal {d} damage to ALL enemies.', fx: [{ dmg: 8, allEnemies: true }], up: { fx: [{ dmg: 11, allEnemies: true }] } },
  one_two:      { hero: 'aaron', name: 'One-Two Punch', emoji: '👊', type: 'attack', cost: 1, rarity: 'common', sts: 'Twin Strike',
                  text: 'Deal {d} damage twice.', fx: [{ dmg: 5, times: 2 }], up: { fx: [{ dmg: 7, times: 2 }] } },
  heavy_haul:   { hero: 'aaron', name: 'Heavy Haul', emoji: '🏋️', type: 'attack', cost: 2, rarity: 'common', sts: 'Heavy Blade',
                  text: 'Deal {d} damage. Strength counts {n} TIMES.', special: 'heavy_haul', base: 14, strMult: 3, pn: 3,
                  up: { base: 14, strMult: 5, pn: 5 } },
  iron_wave:    { hero: 'aaron', name: 'Wheelbarrow Rush', emoji: '🛞', type: 'attack', cost: 1, rarity: 'common', sts: 'Iron Wave',
                  text: 'Deal {d} damage. Gain {b} Block.', fx: [{ dmg: 5 }, { block: 5 }], up: { fx: [{ dmg: 7 }, { block: 7 }] } },
  belly_flop:   { hero: 'aaron', name: 'BELLY FLOP!', emoji: '💦', type: 'attack', cost: 1, rarity: 'common', sts: 'Body Slam',
                  text: 'SPLAT! Deal damage equal to your Block.', fx: [{ dmg: 0, dmgFromBlock: true }], up: { cost: 0 } },
  shake_it_off: { hero: 'aaron', name: 'Shake It Off', emoji: '🐕', type: 'skill', cost: 1, rarity: 'common', sts: 'Shrug It Off',
                  text: 'Gain {b} Block. Draw 1 card.', fx: [{ block: 8 }, { draw: 1 }], up: { fx: [{ block: 11 }, { draw: 1 }] } },
  grit:         { hero: 'aaron', name: 'Grit', emoji: '🧱', type: 'skill', cost: 1, rarity: 'common', sts: 'True Grit',
                  text: 'Gain {b} Block.', fx: [{ block: 7 }], up: { fx: [{ block: 9 }] } },
  flex:         { hero: 'aaron', name: 'Flex', emoji: '💪', type: 'skill', cost: 0, rarity: 'common', sts: 'Flex',
                  text: 'Gain {n} Strength this turn.', fx: [{ tempStr: 2 }], up: { fx: [{ tempStr: 4 }] } },
  uppercut:     { hero: 'aaron', name: 'Uppercut', emoji: '🚜', type: 'attack', cost: 2, rarity: 'uncommon', sts: 'Uppercut',
                  text: 'Deal {d} damage. Apply 1 Weak and 1 Vulnerable.',
                  fx: [{ dmg: 13 }, { status: { k: 'weak', n: 1, target: 'target' } }, { status: { k: 'vulnerable', n: 1, target: 'target' } }],
                  up: { fx: [{ dmg: 13 }, { status: { k: 'weak', n: 2, target: 'target' } }, { status: { k: 'vulnerable', n: 2, target: 'target' } }] } },
  game_face:    { hero: 'aaron', name: 'Game Face', emoji: '😤', type: 'skill', cost: 1, rarity: 'uncommon', sts: 'Battle Trance',
                  text: 'Draw 3 cards.', fx: [{ draw: 3 }], up: { cost: 0 } },
  all_out:      { hero: 'aaron', name: 'All-Out Effort', emoji: '😮‍💨', type: 'skill', cost: 0, rarity: 'rare', sts: 'Offering',
                  text: 'Wear yourself out: lose 6 HP. Gain 2 ⚡. Draw 3 cards. One use per fight!',
                  fx: [{ loseHp: 6 }, { energy: 2 }, { draw: 3 }], exhausts: true,
                  up: { fx: [{ loseHp: 6 }, { energy: 2 }, { draw: 5 }] } },
  back_off:     { hero: 'aaron', name: 'Back Off!', emoji: '🚧', type: 'skill', cost: 1, rarity: 'uncommon', sts: 'Disarm',
                  text: 'Enemy loses {n} Strength. One use per fight!', fx: [{ status: { k: 'strength', n: -2, target: 'target' } }], exhausts: true,
                  up: { fx: [{ status: { k: 'strength', n: -3, target: 'target' } }] } },
  tornado_spin: { hero: 'aaron', name: 'Tornado Spin', emoji: '🌪️', type: 'attack', cost: 'X', rarity: 'uncommon', sts: 'Whirlwind',
                  text: 'Deal {d} damage to ALL enemies X times.', special: 'tornado_spin', base: 5, up: { base: 8 } },
  pumped_up:    { hero: 'aaron', name: 'Pumped Up', emoji: '🔥', type: 'power', cost: 1, rarity: 'uncommon', sts: 'Inflame',
                  text: 'Gain {n} Strength.', fx: [{ selfStr: 3 }], up: { fx: [{ selfStr: 4 }] } },
  tough_skin:   { hero: 'aaron', name: 'Tough Skin', emoji: '🦬', type: 'power', cost: 1, rarity: 'uncommon', sts: 'Metallicize',
                  text: 'At the end of your turn, gain {b} Block.', power: 'tough_skin', pn: 4, up: { pn: 5 } },
  tornado_form: { hero: 'aaron', name: 'TORNADO FORM', emoji: '🌪️', type: 'power', cost: 3, rarity: 'rare', sts: 'Demon Form',
                  text: 'At the start of each turn, gain {n} Strength.', power: 'tornado_form', pn: 2, up: { pn: 3 } },
  stone_wall:   { hero: 'aaron', name: 'Stone Wall', emoji: '🪨', type: 'skill', cost: 2, rarity: 'rare', sts: 'Impervious',
                  text: 'Gain {b} Block. One use per fight!', fx: [{ block: 30 }], exhausts: true, up: { fx: [{ block: 40 }] } },
  fortify:      { hero: 'aaron', name: 'Fortify the Barn', emoji: '🏚️', type: 'power', cost: 3, rarity: 'rare', sts: 'Barricade',
                  text: 'Block no longer wears off between turns.', power: 'fortify', up: { cost: 2 } },

  // ---------- Wyatt the Speedy (Silent spine) ----------
  kick:         { hero: 'wyatt', name: 'Kick', emoji: '🦵', type: 'attack', cost: 1, rarity: 'starter', sts: 'Strike',
                  text: 'Deal {d} damage.', fx: [{ dmg: 6 }], up: { fx: [{ dmg: 9 }] } },
  dodge:        { hero: 'wyatt', name: 'Dodge', emoji: '💨', type: 'skill', cost: 1, rarity: 'starter', sts: 'Defend',
                  text: 'Gain {b} Block.', fx: [{ block: 5 }], up: { fx: [{ block: 8 }] } },
  nutmeg:       { hero: 'wyatt', name: 'Nutmeg', emoji: '⚽', type: 'attack', cost: 0, rarity: 'starter', sts: 'Neutralize',
                  text: 'Deal {d} damage. Apply {n} Weak.', fx: [{ dmg: 3 }, { status: { k: 'weak', n: 1, target: 'target' } }],
                  up: { fx: [{ dmg: 4 }, { status: { k: 'weak', n: 2, target: 'target' } }] } },
  quick_feet:   { hero: 'wyatt', name: 'Quick Feet', emoji: '👟', type: 'skill', cost: 1, rarity: 'starter', sts: 'Survivor',
                  text: 'Gain {b} Block. Discard 1 card.', fx: [{ block: 8 }, { discard: 1 }], up: { fx: [{ block: 11 }, { discard: 1 }] } },
  soccer_ball:  { hero: 'wyatt', name: 'Soccer Ball', emoji: '⚽', type: 'attack', cost: 0, rarity: 'token', sts: 'Shiv',
                  text: 'Deal {d} damage. One use per fight!', fx: [{ dmg: 4 }], exhausts: true, up: { fx: [{ dmg: 6 }] } },
  juggling_show:{ hero: 'wyatt', name: 'Juggling Show', emoji: '🤹', type: 'skill', cost: 1, rarity: 'common', sts: 'Blade Dance',
                  text: 'Add {n} Soccer Balls to your hand.', fx: [{ addCard: { id: 'soccer_ball', n: 3, to: 'hand' } }],
                  up: { fx: [{ addCard: { id: 'soccer_ball', n: 4, to: 'hand' } }] } },
  long_pass:    { hero: 'wyatt', name: 'Long Pass', emoji: '🎯', type: 'attack', cost: 1, rarity: 'common', sts: 'Dagger Throw',
                  text: 'Deal {d} damage. Draw 1 card. Discard 1 card.', fx: [{ dmg: 9 }, { draw: 1 }, { discard: 1 }],
                  up: { fx: [{ dmg: 12 }, { draw: 1 }, { discard: 1 }] } },
  sting_shot:   { hero: 'wyatt', name: 'Sting Shot', emoji: '🎯', type: 'attack', cost: 1, rarity: 'common', sts: 'Poisoned Stab',
                  text: 'Deal {d} damage. Apply {n} Poison.', fx: [{ dmg: 6 }, { status: { k: 'poison', n: 2, target: 'target' } }],
                  up: { fx: [{ dmg: 8 }, { status: { k: 'poison', n: 3, target: 'target' } }] } },
  sidestep:     { hero: 'wyatt', name: 'Sidestep', emoji: '🩰', type: 'skill', cost: 0, rarity: 'common', sts: 'Deflect',
                  text: 'Gain {b} Block.', fx: [{ block: 4 }], up: { fx: [{ block: 7 }] } },
  backflip:     { hero: 'wyatt', name: 'Backflip', emoji: '🤸', type: 'skill', cost: 1, rarity: 'common', sts: 'Backflip',
                  text: 'Gain {b} Block. Draw 2 cards.', fx: [{ block: 5 }, { draw: 2 }], up: { fx: [{ block: 8 }, { draw: 2 }] } },
  warm_up:      { hero: 'wyatt', name: 'Warm-Up', emoji: '🔄', type: 'skill', cost: 0, rarity: 'common', sts: 'Prepared',
                  text: 'Draw {n} card(s). Discard 1 card.', fx: [{ draw: 1 }, { discard: 1 }], up: { fx: [{ draw: 2 }, { discard: 1 }] } },
  slide_tackle: { hero: 'wyatt', name: 'Slide Tackle', emoji: '🛝', type: 'attack', cost: 2, rarity: 'common', sts: 'Dash',
                  text: 'Deal {d} damage. Gain {b} Block.', fx: [{ dmg: 10 }, { block: 10 }], up: { fx: [{ dmg: 13 }, { block: 13 }] } },
  sneak_attack: { hero: 'wyatt', name: 'Sneak Attack', emoji: '🥷', type: 'attack', cost: 0, rarity: 'uncommon', sts: 'Backstab',
                  text: 'Deal {d} damage. One use per fight!', fx: [{ dmg: 11 }], exhausts: true, innate: true, up: { fx: [{ dmg: 15 }] } },
  itching_powder:{ hero: 'wyatt', name: 'Itching Powder', emoji: '🧂', type: 'skill', cost: 1, rarity: 'uncommon', sts: 'Deadly Poison',
                  text: 'Apply {n} Poison.', fx: [{ status: { k: 'poison', n: 4, target: 'target' } }],
                  up: { fx: [{ status: { k: 'poison', n: 6, target: 'target' } }] } },
  leg_sweep:    { hero: 'wyatt', name: 'Leg Sweep', emoji: '🧹', type: 'skill', cost: 2, rarity: 'uncommon', sts: 'Leg Sweep',
                  text: 'Apply {n} Weak. Gain {b} Block.', fx: [{ status: { k: 'weak', n: 2, target: 'target' } }, { block: 11 }],
                  up: { fx: [{ status: { k: 'weak', n: 3, target: 'target' } }, { block: 14 }] } },
  prank_cloud:  { hero: 'wyatt', name: 'Prank Cloud', emoji: '💨', type: 'skill', cost: 2, rarity: 'uncommon', sts: 'Crippling Cloud',
                  text: 'Apply {n} Poison and 2 Weak to ALL enemies. One use per fight!',
                  fx: [{ status: { k: 'poison', n: 3, target: 'all' } }, { status: { k: 'weak', n: 2, target: 'all' } }], exhausts: true,
                  up: { fx: [{ status: { k: 'poison', n: 5, target: 'all' } }, { status: { k: 'weak', n: 2, target: 'all' } }] } },
  bicycle_kick: { hero: 'wyatt', name: 'Bicycle Kick', emoji: '🚴', type: 'attack', cost: 1, rarity: 'uncommon', sts: 'Finisher',
                  text: 'Deal {d} damage for each Attack played this turn.', special: 'bicycle_kick', base: 6, up: { base: 8 } },
  sleight_of_hand:{ hero: 'wyatt', name: 'Sleight of Hand', emoji: '🎩', type: 'power', cost: 1, rarity: 'uncommon', sts: 'Tools of the Trade',
                  text: 'At the start of each turn, draw 1 card, then discard 1 card.', power: 'sleight_of_hand', up: { cost: 0 } },
  footwork:     { hero: 'wyatt', name: 'Footwork', emoji: '🪄', type: 'power', cost: 1, rarity: 'uncommon', sts: 'Footwork',
                  text: 'Gain {n} Dexterity.', fx: [{ selfDex: 2 }], up: { fx: [{ selfDex: 3 }] } },
  sugar_rush:   { hero: 'wyatt', name: 'Sugar Rush', emoji: '🧃', type: 'skill', cost: 0, rarity: 'rare', sts: 'Adrenaline',
                  text: 'Gain {n} ⚡. Draw 2 cards. One use per fight!', fx: [{ energy: 1 }, { draw: 2 }], exhausts: true,
                  up: { fx: [{ energy: 2 }, { draw: 2 }] } },
  hat_trick:    { hero: 'wyatt', name: 'Hat Trick', emoji: '🎩', type: 'attack', cost: 1, rarity: 'rare', sts: 'Die Die Die',
                  text: 'Deal {d} damage to ALL enemies. One use per fight!', fx: [{ dmg: 13, allEnemies: true }], exhausts: true,
                  up: { fx: [{ dmg: 17, allEnemies: true }] } },
  ball_machine: { hero: 'wyatt', name: 'Ball Machine', emoji: '🎾', type: 'power', cost: 1, rarity: 'rare', sts: 'Infinite Blades',
                  text: 'At the start of each turn, add a Soccer Ball to your hand.', power: 'ball_machine',
                  up: { innate: true } }, // StS: Infinite Blades+ becomes Innate
  afterimage:   { hero: 'wyatt', name: 'Afterimage', emoji: '👥', type: 'power', cost: 1, rarity: 'rare', sts: 'After Image',
                  text: 'Whenever you play a card, gain 1 Block.', power: 'afterimage',
                  up: { cost: 0 } }, // StS: After Image+ costs 0

  // ---------- Liam the Little (Defect spine — SECRET hero) ----------
  bonk:         { hero: 'liam', name: 'Bonk', emoji: '🧸', type: 'attack', cost: 1, rarity: 'starter', sts: 'Strike',
                  text: 'Deal {d} damage.', fx: [{ dmg: 6 }], up: { fx: [{ dmg: 9 }] } },
  peekaboo:     { hero: 'liam', name: 'Peekaboo', emoji: '🙈', type: 'skill', cost: 1, rarity: 'starter', sts: 'Defend',
                  text: 'Gain {b} Block.', fx: [{ block: 5 }], up: { fx: [{ block: 8 }] } },
  change_it:    { hero: 'liam', name: 'Change It!', emoji: '💩', type: 'skill', cost: 1, rarity: 'starter', sts: 'Zap',
                  text: 'Float a Stinky Diaper.', fx: [{ channel: 'stinky' }], up: { cost: 0 } },
  double_trouble:{ hero: 'liam', name: 'Double Trouble', emoji: '👯', type: 'skill', cost: 1, rarity: 'starter', sts: 'Dualcast',
                  text: 'POP your oldest diaper twice.', special: 'double_trouble', up: { cost: 0 } },
  throw_spaghetti:{ hero: 'liam', name: 'Throw Spaghetti', emoji: '🍝', type: 'attack', cost: 1, rarity: 'common', sts: 'Ball Lightning',
                  text: 'Deal {d} damage. Float a Stinky Diaper.', fx: [{ dmg: 7 }, { channel: 'stinky' }], up: { fx: [{ dmg: 10 }, { channel: 'stinky' }] } },
  sippy_cup:    { hero: 'liam', name: 'Sippy Cup', emoji: '🥤', type: 'skill', cost: 1, rarity: 'common', sts: 'Coolheaded',
                  text: 'Float a Fresh Diaper. Draw 1 card.', fx: [{ channel: 'fresh' }, { draw: 1 }], up: { cost: 0 } },
  blanket_fort: { hero: 'liam', name: 'Blanket Fort', emoji: '🛏️', type: 'skill', cost: 2, rarity: 'common', sts: 'Glacier',
                  text: 'Gain {b} Block. Float 2 Fresh Diapers.', fx: [{ block: 8 }, { channel: 'fresh' }, { channel: 'fresh' }],
                  up: { fx: [{ block: 11 }, { channel: 'fresh' }, { channel: 'fresh' }] } },
  sticky_hands: { hero: 'liam', name: 'Sticky Hands', emoji: '🍯', type: 'attack', cost: 0, rarity: 'common', sts: 'Claw', grows: 2,
                  text: 'Deal {d} damage. Every play makes ALL Sticky Hands +2 STICKIER this fight!', fx: [{ dmg: 4 }], up: { fx: [{ dmg: 6 }] } },
  nap_time:     { hero: 'liam', name: 'Nap Time', emoji: '😴', type: 'skill', cost: 1, rarity: 'common', sts: '(original)',
                  text: 'Gain {b} Block. One use per fight!', fx: [{ block: 14 }], exhausts: true, up: { fx: [{ block: 18 }] } },
  snacks:       { hero: 'liam', name: 'Snacks!', emoji: '🍪', type: 'skill', cost: 1, rarity: 'common', sts: '(Plasma channel)',
                  text: 'Float a Snack Time.', fx: [{ channel: 'snack' }], up: { fx: [{ channel: 'snack' }, { draw: 1 }] } },
  big_no:       { hero: 'liam', name: 'NO!!', emoji: '🙅', type: 'attack', cost: 2, rarity: 'uncommon', sts: 'Doom and Gloom',
                  text: 'Deal {d} damage to ALL enemies. Float a BLOWOUT.', fx: [{ dmg: 10, allEnemies: true }, { channel: 'blowout' }],
                  up: { fx: [{ dmg: 14, allEnemies: true }, { channel: 'blowout' }] } },
  giggle_fit:   { hero: 'liam', name: 'Giggle Fit', emoji: '😆', type: 'power', cost: 1, rarity: 'uncommon', sts: 'Defragment',
                  text: 'Gain {n} Giggle Power (your diapers get stronger).', fx: [{ focus: 2 }], up: { fx: [{ focus: 3 }] } },
  uppies:       { hero: 'liam', name: 'Uppies!', emoji: '🙌', type: 'skill', cost: 1, rarity: 'uncommon', sts: 'Recursion',
                  text: 'Pop your oldest diaper, then float a fresh copy of it.', special: 'uppies', up: { cost: 0 } },
  throw_food:   { hero: 'liam', name: 'Throw Food', emoji: '🥣', type: 'attack', cost: 1, rarity: 'uncommon', sts: 'Barrage',
                  text: 'Deal {d} damage for each floating diaper.', special: 'throw_food', base: 4, up: { base: 6 } },
  more_diapers: { hero: 'liam', name: 'More Diapers!', emoji: '🧺', type: 'power', cost: 1, rarity: 'uncommon', sts: 'Capacitor',
                  text: 'Gain {n} diaper slots.', fx: [{ orbSlots: 2 }], up: { fx: [{ orbSlots: 3 }] } },
  waddle_charge:{ hero: 'liam', name: 'Waddle Charge', emoji: '🐧', type: 'attack', cost: 2, rarity: 'uncommon', sts: 'Thunder Strike',
                  text: 'Deal {d} damage. Float a Stinky Diaper.', fx: [{ dmg: 12 }, { channel: 'stinky' }], up: { fx: [{ dmg: 16 }, { channel: 'stinky' }] } },
  uh_oh:        { hero: 'liam', name: 'Uh-Oh.', emoji: '😱', type: 'skill', cost: 1, rarity: 'uncommon', sts: 'Darkness',
                  text: 'Float a BLOWOUT.', fx: [{ channel: 'blowout' }], up: { cost: 0 } },
  maximum_stink:{ hero: 'liam', name: 'MAXIMUM STINK', emoji: '🌫️', type: 'power', cost: 2, rarity: 'rare', sts: 'Electrodynamics',
                  text: 'Your Stinky Diapers hit ALL enemies. Float a Stinky Diaper.', power: 'max_stink', fx: [{ channel: 'stinky' }], up: { cost: 1 } },
  birthday_boy: { hero: 'liam', name: 'Birthday Boy', emoji: '🎂', type: 'power', cost: 3, rarity: 'rare', sts: '(Demon Form for Focus)',
                  text: 'At the start of each turn, gain 1 Giggle Power. (He\'ll be THREE in December.)', power: 'birthday_boy', up: { cost: 2 } },

  // ---------- Special / ally ----------
  duck:         { hero: 'any', name: 'Duck Friend', emoji: '🦆', type: 'attack', cost: 1, rarity: 'special', sts: '(original)',
                  // draw 2 (was 1): helping the duckling should be the obviously good
                  // choice (James, Wed 2026-08-06)
                  text: 'QUACK! Deal {d} damage. Draw 2 cards.', fx: [{ dmg: 5 }, { draw: 2 }], up: { fx: [{ dmg: 8 }, { draw: 2 }] } },

  // ---------- Pet signature cards (hero: 'pet' keeps them out of every draft pool;
  // they enter a deck only by equipping the pet — see js/pets.js) ----------
  belly_bump:   { hero: 'pet', name: 'Belly Bump', emoji: '🐷', type: 'attack', cost: 1, rarity: 'token', pet: 'pig',
                  text: 'Sir Oinks bumps! Deal {d} damage. Gain 3 🛡️ Block.', fx: [{ dmg: 6 }, { block: 3 }],
                  up: { text: 'Sir Oinks bumps! Deal {d} damage. Gain 4 🛡️ Block.', fx: [{ dmg: 8 }, { block: 4 }] } },
  peck_peck:    { hero: 'pet', name: 'Peck Peck Peck', emoji: '🐔', type: 'attack', cost: 1, rarity: 'token', pet: 'chicken',
                  text: 'Nugget pecks twice for {d} damage each.', fx: [{ dmg: 3, times: 2 }], up: { fx: [{ dmg: 4, times: 2 }] } },
  egg:          { hero: 'pet', name: 'Egg', emoji: '🥚', type: 'skill', cost: 0, rarity: 'token', pet: 'chicken',
                  text: 'Fresh from Nugget! Heal 2 ❤️. Poof — it\'s gone after you eat it.', fx: [{ heal: 2 }], exhausts: true,
                  up: { fx: [{ heal: 3 }] } },
  pounce:       { hero: 'pet', name: 'Pounce', emoji: '🐱', type: 'attack', cost: 1, rarity: 'token', pet: 'cat',
                  text: 'Whiskers pounces for {d} damage. Draw 1 card.', fx: [{ dmg: 5 }, { draw: 1 }], up: { fx: [{ dmg: 7 }, { draw: 1 }] } },
  zoomies:      { hero: 'pet', name: 'ZOOMIES!', emoji: '🐶', type: 'skill', cost: 0, rarity: 'token', pet: 'puppy',
                  text: 'Biscuit runs in circles! Gain 2 🛡️ Block. Draw 1 card.', fx: [{ block: 2 }, { draw: 1 }],
                  up: { fx: [{ block: 4 }, { draw: 1 }] } },
  splash:       { hero: 'pet', name: 'Splash', emoji: '🐠', type: 'attack', cost: 1, rarity: 'token', pet: 'goldfish',
                  text: 'Bubbles splashes for {d} damage. The weirdo gets Weak 1.', fx: [{ dmg: 4 }, { status: { k: 'weak', n: 1, target: 'target' } }],
                  up: { fx: [{ dmg: 6 }, { status: { k: 'weak', n: 2, target: 'target' } }] } },
  round_em_up:  { hero: 'pet', name: "Round 'Em Up", emoji: '🐕‍🦺', type: 'attack', cost: 1, rarity: 'token', pet: 'sheepdog',
                  text: 'Patch herds the whole gang: {d} damage to ALL weirdos.', fx: [{ dmg: 4, allEnemies: true }], up: { fx: [{ dmg: 6, allEnemies: true }] } },
  big_bark:     { hero: 'pet', name: 'BIG BARK', emoji: '🐕', type: 'skill', cost: 1, rarity: 'token', pet: 'hound',
                  text: 'Boomer barks! ALL weirdos get Weak {n}.', fx: [{ status: { k: 'weak', n: 2, target: 'all' } }],
                  up: { fx: [{ status: { k: 'weak', n: 3, target: 'all' } }] } },
  five_finger_swipe: { hero: 'pet', name: 'Five-Finger Swipe', emoji: '🦝', type: 'attack', cost: 0, rarity: 'token', pet: 'raccoon',
                  text: 'Bandit Jr. swipes for {d} damage and pockets 💰5.', fx: [{ dmg: 4 }, { gold: 5 }], up: { fx: [{ dmg: 6 }, { gold: 8 }] } },
  night_swoop:  { hero: 'pet', name: 'Night Swoop', emoji: '🦉', type: 'attack', cost: 1, rarity: 'token', pet: 'owl',
                  text: 'Professor Hoot swoops for {d} damage. Draw 1, then discard 1.', fx: [{ dmg: 6 }, { draw: 1 }, { discard: 1 }],
                  up: { fx: [{ dmg: 9 }, { draw: 1 }, { discard: 1 }] } },
  headbutt_card: { hero: 'pet', name: 'HEADBUTT', emoji: '🐐', type: 'attack', cost: 2, rarity: 'token', pet: 'goat',
                  text: 'Ramona charges for {d} damage. Vulnerable 1.', fx: [{ dmg: 10 }, { status: { k: 'vulnerable', n: 1, target: 'target' } }],
                  up: { fx: [{ dmg: 13 }, { status: { k: 'vulnerable', n: 2, target: 'target' } }] } },
  mud_gulp:     { hero: 'pet', name: 'Mud Gulp', emoji: '🐟', type: 'skill', cost: 1, rarity: 'token', pet: 'catfish',
                  text: 'Mudwhisker gurgles: gain 5 🛡️ Block. ALL weirdos get 1 ☠️ poison.',
                  fx: [{ block: 5 }, { status: { k: 'poison', n: 1, target: 'all' } }],
                  up: { fx: [{ block: 7 }, { status: { k: 'poison', n: 2, target: 'all' } }] } },
  claw_scratch: { hero: 'pet', name: 'Claw Scratch', emoji: '🐻', type: 'attack', cost: 1, rarity: 'token', pet: 'bear',
                  text: 'Bruno scratches twice for {d} damage each! Poof after use.', fx: [{ dmg: 6, times: 2 }], exhausts: true,
                  up: { fx: [{ dmg: 8, times: 2 }] } },
  good_boy:     { hero: 'pet', name: 'GOOD BOY', emoji: '🐕', type: 'skill', cost: 0, rarity: 'token', pet: 'rusty',
                  text: 'Rusty guards you: gain 5 🛡️ Block. Draw 1 card.', fx: [{ block: 5 }, { draw: 1 }],
                  up: { fx: [{ block: 7 }, { draw: 1 }] } },
  ufo_beam:     { hero: 'pet', name: 'U.F.O. Beam', emoji: '👽', type: 'attack', cost: 2, rarity: 'token', pet: 'alien',
                  text: 'Zorp beams down {d} damage that ignores 🛡️ Block!', fx: [{ dmg: 12, pierce: true }], up: { fx: [{ dmg: 16, pierce: true }] } },
  dive_bomb:    { hero: 'pet', name: 'DIVE BOMB', emoji: '🦆', type: 'attack', cost: 2, rarity: 'token', pet: 'diver',
                  text: 'Diver drops from the sky for {d} damage!', fx: [{ dmg: 14 }], up: { fx: [{ dmg: 18 }] } },
  mystery_waddle: { hero: 'pet', name: 'Mystery Waddle', emoji: '🦆', type: 'skill', cost: 1, rarity: 'token', pet: 'brownie',
                  text: 'Nobody knows what Brownie is. Get a mystery: 12 damage, 12 🛡️ Block, or heal 4 ❤️.', special: 'mystery_waddle',
                  up: { text: 'Nobody knows what Brownie is. Get a BIGGER mystery: 16 damage, 16 🛡️ Block, or heal 6 ❤️.' } },
  not_harmless: { hero: 'pet', name: 'NOT HARMLESS', emoji: '🦆', type: 'attack', cost: 3, rarity: 'token', pet: 'harmless',
                  text: 'The name was a warning. Deal {d} damage.', fx: [{ dmg: 20 }], up: { fx: [{ dmg: 26 }] } },
  spit:         { hero: 'pet', name: 'SPIT!', emoji: '🦙', type: 'attack', cost: 1, rarity: 'token', pet: 'goldie',
                  text: 'Goldie spits with ancient precision: {d} damage to ALL weirdos.', fx: [{ dmg: 6, allEnemies: true }],
                  up: { fx: [{ dmg: 8, allEnemies: true }] } },
  goldie_knows: { hero: 'pet', name: 'Goldie Knows', emoji: '🦙', type: 'skill', cost: 0, rarity: 'token', pet: 'goldie',
                  text: 'Goldie says nothing. Draw 3 cards, then discard 2.', fx: [{ draw: 3 }, { discard: 2 }],
                  up: { text: 'Goldie says nothing. Draw 3 cards, then discard 1.', fx: [{ draw: 3 }, { discard: 1 }] } },

  // ---------- Statuses (combat junk) ----------
  scraped_knee: { hero: 'none', name: 'Scraped Knee', emoji: '🩹', type: 'status', cost: null, rarity: 'status', sts: 'Wound',
                  text: 'Unplayable — it just clogs your hand. Heals up (poof!) when the fight ends.', unplayable: true },
  straw:        { hero: 'none', name: 'Straw', emoji: '🌾', type: 'status', cost: null, rarity: 'status', sts: 'Dazed',
                  text: 'Unplayable — it just clogs your hand. Blows away (poof!) when the fight ends.', unplayable: true },
  hailstone:    { hero: 'none', name: 'Hailstone', emoji: '🧊', type: 'status', cost: null, rarity: 'status', sts: 'Burn',
                  text: 'Unplayable. Still in your hand at end of turn? Take 2 damage. Melts away after the fight.', unplayable: true, endTurnDmg: 2 },

  // ---------- Curses (deck junk — NEVER "Chores") ----------
  homework:     { hero: 'none', name: 'Homework', emoji: '📚', type: 'curse', cost: null, rarity: 'curse', sts: 'Curse',
                  text: 'Unplayable. Ugh, it\'s due Monday.', unplayable: true },
  poison_ivy:   { hero: 'none', name: 'Poison Ivy', emoji: '🌿', type: 'curse', cost: null, rarity: 'curse', sts: 'Regret',
                  text: 'Unplayable. When drawn, take 1 damage.', unplayable: true, onDrawDmg: 1 },
};

// Draftable pool for a hero (excludes starters, tokens, statuses, curses, specials).
export function draftPool(heroId) {
  return Object.entries(CARDS)
    .filter(([, c]) => c.hero === heroId && ['common', 'uncommon', 'rare'].includes(c.rarity))
    .map(([id]) => id);
}

export const RARITY_WEIGHTS = { common: 60, uncommon: 33, rare: 7 };

// A card instance in a deck: { id, up: bool, uid }
let uidCounter = 1;
export function makeCard(id, up = false) {
  return { id, up: !!up, uid: uidCounter++ };
}

// The value a card's {n} placeholder stands for. Lives here (pure) rather than in
// the renderer so a test can assert every {n} on every card actually resolves — an
// unlisted op silently renders as a literal "?" on the card face.
export function nValue(info) {
  const fx = info.fx || [];
  const statusOp = fx.find((o) => o.status);
  if (statusOp) return Math.abs(statusOp.status.n);
  if (info.pn != null) return info.pn;
  const o = fx.find((x) => x.selfStr != null || x.selfDex != null || x.tempStr != null
    || x.draw != null || x.energy != null || x.focus != null || x.orbSlots != null || x.addCard);
  if (!o) return null;
  const v = o.selfStr ?? o.selfDex ?? o.tempStr ?? o.draw ?? o.energy ?? o.focus ?? o.orbSlots
    ?? (o.addCard && o.addCard.n);
  return v == null ? null : v;
}

// Cards a Practice/Garage upgrade may legally target: not already upgraded, and
// upgrading actually does something. The `base.up` check is what keeps curses and
// statuses out — and it self-maintains, so a card can never be offered for an
// upgrade that would do nothing but rename it.
export function upgradableCards(deck) {
  return deck.filter((c) => !c.up && CARDS[c.id] && CARDS[c.id].up);
}

// Resolved view of a card instance (applies upgrade overrides).
export function cardInfo(inst) {
  const base = CARDS[inst.id];
  if (!base) return null;
  const info = { ...base, id: inst.id, uid: inst.uid, upgraded: inst.up };
  if (inst.up && base.up) Object.assign(info, base.up);
  if (inst.up) info.name = `${info.name}+`;
  return info;
}
