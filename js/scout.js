// Rolfe Legends 2 — Coach James's scouting reports. Tap any enemy in a fight and
// Coach tells you what it actually does — and ONLY what it does.
//
// Rules for writing these (James, Sun 2026-08-03):
// 1. Every line must be TRUE of the code in js/enemies.js. A scouting report
//    that's merely flavorful is worse than none — the kid will trust it and get hit.
// 2. NO how-to-beat advice. Many answers is the point of the game; Coach names
//    the mechanic and stops. Reassurance ("it's not broken, it's him") is fine;
//    prescriptions ("take him out first", "save your big hit") are not.
//
// DRAFT — family cameo dialogue needs James's sign-off before ship (CLAUDE.md).

export const SCOUT = {
  // ================= ACT 1 — The Far Fields =================
  crow: "First thing it does is CAW, and after that it gets a little stronger every single turn. That's the whole trick — the longer this bird's alive, the harder it pecks.",
  gopher: "He mixes it up: a big Chomp, a Thrash that hits AND blocks, or he burrows down and bulks up for a heavier one next turn.",
  roly_poly: "Little guy. The first time you hit him, he curls up and shrugs 6 damage right off the top — but only that once.",
  roly_poly_curled: "He's balled up now, with Block soaking your hits. That trick only happens once — there's nothing else behind it.",
  mud_blob_m: "Knock it to half and it SPLITS into two. That's not you doing something wrong — that's just what mud does.",
  mud_blob_s: "Little blip. Barely a splat in him.",
  mouse_scrappy: "Every time you hit him, he gets MADDER — and madder means harder.",
  mouse_zippy: "Fast and bitey, and he hits harder than the others his size. No tricks, no armor.",
  mouse_pudge: "The chunky one. His belly bump doesn't hurt much, but it leaves you Weak, so your own hits land softer for a bit.",
  mouse_whiskers: "See how he's talking to the others? That speech makes every OTHER mouse stronger. He's the reason the little ones hurt.",
  puffball: "When it goes down, it pops — and the spore burst makes you Vulnerable for a couple of turns. That part happens no matter what.",
  magpie: "She's a thief. Two snatches, then she covers up, then she's GONE with your gold. About three turns and she's off.",
  barn_spider: "Bites hard, and every so often webs you up Weak. No tricks beyond that.",
  old_scarecrow: "He's just standing there. Menacingly. And blocking while he does it. He wakes up on his own after a few turns — or the second anybody hits him.",
  ornery_ram: "He snorts, and after THAT, every skill card you play makes him stronger. Attacks don't feed him. Skills do.",
  scarecrow_post: "It flips back and forth: a straw beam, then it shoves junk Straw cards into your discard pile that clog your deck for the rest of the fight.",
  rogue_combine: "The boss of the fields, with TWO modes. In mow mode he winds up and then MOWS for a huge hit. Take him down far enough and he clanks into armored mode — big Block, and spikes that bite anyone who touches him. A couple turns later the engine roars, and he's mowing again.",
  rogue_combine_hunker: "Buttoned up in armored mode: big Block, and spikes that bite back on every hit. Two turns of this, then the engine roars and the mowing starts again.",
  mud_king: "He rules the mud until you knock him to half — and then he doesn't die. He splits into two full-size blobs. This fight has a second half.",

  // ================= ACT 2 — The Barnyard =================
  raccoon_bandit: "Same racket as the magpie: he mugs you for gold twice, guards up, then runs off with everything he grabbed.",
  waltzing_weasel: "The weird one. That waltz confuses you, and your card costs go all scrambled for as long as he's dancing. It's not broken — it's him. When he goes down, everything snaps back to normal.",
  snapping_turtle: "That shell is armor that DOESN'T wear off at the end of the turn like normal Block — and he rivets on more plating every turn.",
  possum_defender: "The big one shields the little one — whatever damage the small one takes, big brother covers it right back up.",
  possum_healer: "The little one heals the big one, 12 at a time. They cover for each other. That's the whole family business.",
  thorny_bramble: "Mostly it lashes you three times fast. Sometimes it tangles you up Frail and Weak instead.",
  porcupine: "Watch the quills: it starts at two and adds ONE MORE every single volley. Turn five is a whole lot of quills.",
  fox: "Every bite dumps a Scraped Knee into your discard pile — dead cards clogging your deck. And she never stops doing it.",
  raccoon_ringleader: "He calls in pups, then cheers them on to make them all stronger. And the pups keep coming as long as he's up there calling.",
  raccoon_minion: "Just a pup. Swipes at you, sometimes hisses and blocks.",
  raccoon_king: "The crown of the barnyard. He cycles through slams, a big trash-lid wall, and a taunt that leaves you Weak AND Frail. At half health he goes into ROYAL FURY — shakes off everything you've stuck on him and comes at you twice as mean.",

  // ================= ACT 3 — The Storm =================
  ball_lightning: "Knock it out and it crackles BACK a couple of turns later — unless everything else on the field is already down. Then it stays gone.",
  hail_cloud: "It pelts you and drops Hailstone junk cards straight into your draw pile, so you'll be drawing slush mid-fight.",
  flooding_creek: "First it raises the water, and after that you're constricted — squeezed for damage every turn it lives. Then it just crashes on you, hard. When it goes down, the water goes with it.",
  passing_squall: "It's got basically endless health, it hits harder EVERY turn — and after five turns it blows itself out and leaves on its own. That's the whole storm.",
  debris_tangle: "It opens by flinging Poison Ivy into your discard — a junk card you're stuck with for the fight. After that it whips you, or throws up a junk wall. It only curses you the once.",
  thunderhead: "See the countdown in its intent? It's real. Four rumbles, and then a THUNDERSTRIKE that will take your head off.",
  ghost_wind: "Every other turn it goes ghostly, and hits barely touch it. Solid turn, ghost turn, back and forth. And that scythe hits like a truck.",
  wind_funnel: "It spins up dust devils to do its dirty work. Each devil hits once, then dissipates all on its own.",
  dust_devil: "One big whirl, and then it spends itself and vanishes on its own.",
  thunder: "These two work together: Thunder makes them BOTH stronger every other turn, while Lightning shields the pair. That's why they're rough together.",
  lightning: "Every other turn, Lightning throws big shields over them BOTH. On the other turns, it cracks you directly.",
  big_twister: "The biggest one on the farm, and here's what nobody tells you: beat it once and it isn't over. It RE-FORMS — bigger, meaner, stronger. And every Power card you play makes it a little stronger too. It's curious about you.",
  big_twister_p2: "The re-formed one. Monster gusts, triple funnels, and a roar that leaves you Weak and Vulnerable at the same time. No more phases after this — this is all of it.",
};

// Anything without a written report falls back to this rather than showing nothing.
export const SCOUT_FALLBACK = "Haven't got a read on this one yet. Watch what it's telegraphing.";

// artKey wins when it has its own report, so a transformed enemy (the re-formed
// Twister, the armored Combine) gets the read on the form you're actually facing.
export function scoutFor(key, artKey) {
  return (artKey && SCOUT[artKey]) || SCOUT[key] || SCOUT_FALLBACK;
}
