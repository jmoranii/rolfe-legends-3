// Rolfe Legends 3 — Coach James's scouting reports. Tap any weirdo in a fight and
// Coach tells you what it actually does — and ONLY what it does.
//
// Rules for writing these (James, RL2, Sun 2026-08-03 — still canon):
// 1. Every line must be TRUE of the code in js/enemies.js. A scouting report
//    that's merely flavorful is worse than none — the kid will trust it and get hit.
// 2. NO how-to-beat advice. Many answers is the point of the game; Coach names
//    the mechanic and stops. Reassurance ("it's not broken, it's the moth") is
//    fine; prescriptions ("take him out first") are not.
//
// DRAFT — dialogue gets James's word pass (REVIEW.md).

export const SCOUT = {
  // ================= WORLD 1 — The Crop Kingdom =================
  angry_sprout: "First it PHOTOSYNTHESIZES, and after that it gets a little stronger every single turn. The longer this sprout's alive, the harder it slaps.",
  corn_colonel: "The Colonel mixes it up: a big Kernel Chomp, a Cob Charge that hits AND blocks, or a Drill Formation that bulks him up for the next one.",
  rolling_pumpkin: "The first time you hit it, it hunkers into its rind and shrugs 6 damage right off the top — but only that once.",
  rolling_pumpkin_curled: "It's hunkered now, rind soaking your hits. That trick only happens once — there's nothing else in there but pumpkin.",
  compost_blob_m: "Knock it to half and it SPLITS in two. That's not you doing something wrong — that's just what compost does.",
  compost_blob_s: "A little blip of yard waste. Barely a squish in it.",
  weed_dandelion: "Every time you hit Dan, he gets MADDER — and madder means harder.",
  weed_thistle: "Prickly and quick, and they poke harder than the others their size. No tricks, no armor.",
  weed_burr: "The sticky one. His tackle doesn't hurt much, but it leaves you Weak, so your own hits land softer for a bit.",
  weed_clover: "See him giving that lucky speech? It makes every OTHER weed stronger. He's the reason the little ones hurt.",
  puff_dandelion: "When it goes down, it POOFS — and the seed burst leaves you Vulnerable for a couple turns. That part happens no matter what.",
  crow_thief: "A thief. Two snatches, then a wing guard, then it's GONE with your gold. About three turns and it's off.",
  sticky_vine: "Lashes hard, and every so often wraps you up Weak in sap. No tricks beyond that.",
  mega_melon: "It's just sitting there. Roundly. And blocking while it does it. It wakes up on its own after a few turns — or the second anybody hits it.",
  giant_zucchini: "It flexes, and after THAT, every skill card you play makes it stronger. Attacks don't feed it. Skills do.",
  sprinkler_post: "It flips back and forth: a power wash, then it soaks junk Straw into your discard pile that clogs your deck for the rest of the fight.",
  boss_brownie: "Brownie rules this world, and nobody knows WHAT she is. She cycles waddle charges, a wing wall, and an unknowable quack that leaves you Weak and Frail — and at half health she throws a ROYAL TANTRUM: she shakes off what you've stuck on her, gets stronger, and her moves go full mystery.",

  // ================= WORLD 2 — Critter Meadow =================
  sparkmouse: "Zappy little critter — and unless the whole pack goes down together, a fallen one charges back up two turns later. They come BACK.",
  flame_pup: "A very good boy who is also on fire. Big sizzle bites, a warm wag that hits and blocks, or a flare-up that makes the next one heavier.",
  leaf_turtle: "Its leafy shell is armor that DOESN'T wear off at end of turn like normal Block — and it regrows more plating every turn.",
  bubble_frog: "Pelts you with bubbles that stuff junk Hailstones into your DRAW pile — they melt after the fight, but they clog your hands now.",
  mimic_moth: "Its dizzy dust scrambles your card costs — every card's price goes random while the moth's around. It's not broken. It's the moth. When it goes down, everything snaps back.",
  snatchling: "A thief with cheek pouches. Two grabs, a fluff-up, and then it scurries off with your gold. Three-ish turns and it's gone.",
  puffbunny: "Adorable. When it goes down it bursts into floof, and the floof leaves you Vulnerable a couple turns. Every time.",
  big_chonk: "He stuffs both cheeks, and after THAT, every skill card you play makes him stronger. Attacks don't feed the Chonk. Skills do.",
  queen_bee: "Her sting flurry adds one MORE sting every time she uses it. The longer the audience, the longer the royal performance.",
  totem_triplets: "Each totem alternates: a judgy beam, then a confetti of junk cards shoved into your discard. Three of them means a lot of confetti.",
  boss_diver: "Diver guards the pond on a strict routine: goggles down, two rounds of splashes and sprays that can leave you Weak, then a DIVE BOMB — and every dive bomb has one more hit in it than the last. She has done this before.",

  // ================= WORLD 3 — Bricktopia =================
  brick_biter: "A big chomper made of bricks: stud chomps, clip-on armor that hits and blocks, or a stack-up that makes the next chomp heavier.",
  sharp_brick: "IT IS A BRICK. Hitting it hurts YOU back — 5 damage of pure corner, every single time you touch it. It barely attacks. It doesn't need to.",
  minifig_scrapper: "Every time you hit him, the little guy gets MADDER — and madder means harder.",
  minifig_ninja: "Sneaky, and bonks harder than the others his size. No tricks. Just bonk.",
  minifig_knight: "His shield shove doesn't hurt much, but it leaves you Weak for a bit. Very professional.",
  minifig_wizard: "That plastic magic makes every OTHER minifig stronger. He's the reason the little ones hurt.",
  brick_golem_m: "Knock it to half and it crumbles a SECOND pile loose that fights too. Bricks don't quit. They reorganize.",
  brick_pile: "A loose pile with opinions. Scatter jabs, nothing fancy.",
  instruction_golem: "The Instructions hit with paper cuts, and every so often make you follow STEP 47 — which leaves you Weak. Nobody has ever read past step 47.",
  wobble_tower: "First it flings its missing piece at you — junk straight into your discard for the whole fight — then it topples at you, or rebuilds itself wrong, hitting and blocking.",
  crane_head: "See the countdown in its intent? It's real. Four wind-ups, and then a WRECKING BALL that will flatten you.",
  ghost_piece: "The piece that vanished under the couch. Every other turn it's UNTOUCHABLE — hits barely graze it. On its solid turns, that ambush hits like a memory.",
  master_builder: "He speed-builds minifig backup mid-fight — two at a time if you let him — and smacks you with the blueprint in between.",
  boss_harmless: "Harmless stands perfectly still at first. Harmlessly. Wake her — or wait — and she is NOT: beetle-green blitzes, a quiet stare that leaves you Weak and Frail, a NOT-HARMLESS SLAM… and every fourth turn she flickers into black-feather shadow that hits barely touch.",

  // ================= WORLD 4 — The Kinetic Sandbox =================
  sand_blob_m: "Knock it to half and it shears into a second blob. Kinetic sand holds together right up until it very much doesn't.",
  sand_blob_s: "A handful of angry sand. Grain spray, nothing fancy.",
  squish_ball: "First hit, it squishes up armor. Break through ALL that squish and it goes flat — completely HELPLESS for one whole turn. Remember how this one works. It matters later.",
  glitter_storm: "Blasts that stuff junk Hailstones into your draw pile, or just a big sparkle slam. Glitter never fully comes off. Ask any grown-up.",
  sandworm: "It squeezes — sand pours in and crushes you a little every turn until it's gone. The squeeze IS the fight. When it goes down, the sand drains away.",
  play_dough_twin_a: "The blue twin shields its sibling with a big squish-together. Hits pretty hard on its own, too.",
  play_dough_twin_b: "The red twin re-kneads its sibling back to health, 14 at a time. As long as both are up, neither really goes down.",
  magnet_mite: "Magnets always come back: unless the whole cluster goes down together, a fallen mite re-clings a couple turns later.",
  static_cling: "Its cling field scrambles your card costs — every price goes random while it's around. Everything sticks to everything. Including the math. It snaps back when it's gone.",
  sand_castle: "The tide is rising, and the intent counts down every turn. At zero: THE BIG WAVE. Castles know how their story ends.",
  rake_fingers: "Its rake flurry adds one MORE track every time it rakes. The grooves get deeper. The flurry gets longer.",
  dust_bunny_mother: "She multiplies — nobody knows how, that's the whole thing about dust bunnies — and buries you in fluff avalanches in between.",
  dust_bunny: "One hit of allergies, then it drifts away all on its own. Dust bunnies don't stay. They relocate.",
  sand_monster: "It tears its own limbs loose to fight beside it — and a beaten limb sinks BACK INTO the body as armor. But land 50 total damage on the body and ALL the sand falls off at once. What's underneath is a different fight.",
  sand_limb: "A torn-loose arm of packed sand. Beat it and it sinks back into the monster — the body drinks it up as armor.",
  magnet_core: "THE MAGNET. It lies helpless for exactly one turn when the sand first falls. After that it alternates: MAGNETIZE to brace itself, then a MAGNET THROW that hits for FIFTY. The windup turn is the warning.",
};

// Anything without a written report falls back to this rather than showing nothing.
export const SCOUT_FALLBACK = "Haven't got a read on this one yet. Watch what it's telegraphing.";

// artKey wins when it has its own report, so a transformed enemy (the shed
// Magnet, the hunkered pumpkin) gets the read on the form you're actually facing.
export function scoutFor(key, artKey) {
  return (artKey && SCOUT[artKey]) || SCOUT[key] || SCOUT_FALLBACK;
}
