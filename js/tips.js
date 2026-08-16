// Rolfe Legends 2 — Coach James's tip library (the victory-beat rotation).
// Loading-screen-style wisdom: general strategy + hero-specific coaching,
// served one per fight win. Sequential rotation per hero pool, so over many
// runs a kid hears everything without repeats feeling constant.
//
// RULES: kid-plain words (no jargon), one sentence-ish each, and the Easter
// egg tease stays VAGUE — no location, no method (the egg may move someday).

export const TIPS_GENERAL = [
  'Poison bites at the START of an enemy\'s turn, then shrinks by 1. It goes right through Block and shells!',
  'Drawing cards is sneaky-strong — more cards means more choices.',
  'A SMALL deck can be mighty: you see your best cards more often.',
  'Pick cards that work TOGETHER, not just cards that look cool.',
  'Your Farm Treasures are always working. Tap them to remember what they do!',
  'You can tap almost anything — statuses, treasures, the ⚡ — to learn what it means.',
  'Tap the 🎴 draw pile and 🗑️ discard pile to see what\'s coming back.',
  'Your discard pile isn\'t gone! It shuffles back when the draw pile runs out.',
  'Block wears off at the start of your turn. Don\'t save it — spend it!',
  'Vulnerable enemies take EXTRA damage. That\'s the moment to pile on!',
  'Weak enemies hit softer. Put Weak on the big hitters.',
  '💀 fights are tough but drop Farm Treasures. Take the risk when you\'re healthy.',
  'Granny can heal you OR upgrade a card. Upgrades last the whole run!',
  'Upgrade the cards you play the most — the ⭐ lasts all run.',
  'Removing a weak card at Dad\'s shop makes every draw better.',
  'Watch the NEXT MOVE bubble. Plan your turn around what\'s coming.',
  'Sometimes blocking everything beats attacking. Do the math!',
  'Save some gold for Dad\'s treasures — they help in every single fight.',
  'The map shows the whole act. Plan a path that hits the stops you need.',
  'Rest BEFORE the boss. Walk in healthy.',
  'Skipping a card reward is okay! Not every card fits your plan.',
  'Enemies that power themselves up get scarier every turn. Deal with them first.',
  'HP carries between fights — leave every fight as healthy as you can.',
  '❓ stops are almost never a waste. The farm is full of friendly surprises.',
  '"One use per fight" cards come back NEXT fight. Don\'t be shy — spend them!',
  'The 📖 book on the map screen explains every icon and every word.',
  'Legends say the title screen keeps a little secret. That\'s all I\'m sayin\'.',
];

export const TIPS_HERO = {
  wyatt: [
    'Soccer Balls cost 0 ⚡ — a flurry of little kicks adds up FAST.',
    'Poison stacks! Keep adding it — it does the work while you dodge.',
    'Footwork makes every block card bigger for the whole fight.',
    'Discarding isn\'t losing a card — it comes back around. Cycle fast!',
  ],
  aaron: [
    'Strength makes EVERY hit harder. Stack it early, swing big late.',
    'Tornado Slam makes enemies Vulnerable — slam first, THEN unload.',
    'TORNADO FORM wins long fights. Play it early if you\'re safe.',
    'Aaron\'s big block cards can wall out a whole enemy turn. Time them!',
  ],
  liam: [
    'More floating diapers means more zaps EVERY turn.',
    'THE BLOWOUT grows every turn it floats. Let it get HUGE.',
    'Giggle Power makes ALL your diapers stronger. Stack the giggles!',
    'When the diapers are full, the OLDEST one pops to make room. Plan the order!',
  ],
};

// Coach's pickup lines — the defeat screen's rotating encouragement (hard mode
// means kids see this screen often; it should never repeat back-to-back).
// Word pass pending in REVIEW.md.
export const LOSS_LINES = [
  "Hey. Even legends have tough days. Same time tomorrow?",
  "Runs end — that's the game. You keep every trick you learned.",
  "That one got me too, once. Really.",
  "You know what the farm loves? That you keep showing up.",
  "Tough fight. Next run, watch their NEXT MOVE bubble like a hawk.",
  "Block the big hits. Sneak past the little ones. You'll get 'em.",
  "The storm thinks it won. The storm has NO idea who it's dealing with.",
  "Granny says: cookies first, revenge second.",
  "Every great run starts with a deep breath. In… out… LET'S GO.",
  "A smaller deck hits harder. Something to chew on.",
  "The ducks still believe in you. All of them. Every duck.",
  "One more run? The barn's counting on you.",
];
export function nextLossLine(storage = localStorage) {
  const i = (Number(storage.getItem('rl3_lossidx')) || 0) % LOSS_LINES.length;
  storage.setItem('rl3_lossidx', String(i + 1));
  return LOSS_LINES[i];
}

// sequential rotation per hero (general + that hero's tips interleaved),
// position persisted so expertise builds across sessions
export function nextTip(heroId, storage = localStorage) {
  const hero = TIPS_HERO[heroId] || [];
  const pool = [];
  const per = hero.length ? Math.ceil(TIPS_GENERAL.length / hero.length) : TIPS_GENERAL.length + 1;
  hero.forEach((t, i) => {
    pool.push(...TIPS_GENERAL.slice(i * per, (i + 1) * per), t);
  });
  if (!hero.length) pool.push(...TIPS_GENERAL);
  for (const t of TIPS_GENERAL.slice(hero.length * per)) pool.push(t);
  const key = `rl3_tipidx_${heroId}`;
  const idx = (Number(storage.getItem(key)) || 0) % pool.length;
  storage.setItem(key, String(idx + 1));
  return pool[idx];
}
