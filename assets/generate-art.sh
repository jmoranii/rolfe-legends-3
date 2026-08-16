#!/bin/bash
# generate-art.sh — Rolfe Legends 3 art batch via the `gpt-image` CLI (codex backend).
# RL1/RL2 playbook: standalone prompts, Storybook Gouache style verbatim, resumable.
#   ./generate-art.sh list | missing | <id>... ; DRY=1 for plan only.
# Heroes/family/events reuse RL2's finished art (copied in, never touched here).
set -uo pipefail
cd "$(dirname "$0")/.."

REF_DIR="assets/ref-photos"
QUALITY="${QUALITY:-high}"
EXTRA=""
[ "${DRY:-0}" = "1" ] && EXTRA="--dry-run"
LOG="assets/art-log.txt"

# THE STYLE BLOCK — verbatim from RL1 PROMPTS.md
CSTYLE='Warm hand-painted storybook gouache illustration, friendly caricature with gently exaggerated proportions, bold clean silhouette, soft golden-hour farm lighting with warm rim light, rich saturated colors on a simple painterly farm-vignette background, matched art series for a children'\''s trading-card game, centered subject, no text, no borders, no frames, no watermark.'
SCENE='Warm hand-painted storybook gouache illustration, rich saturated colors, soft golden-hour light, matched art series for a children'\''s trading-card game, no text, no borders, no frames, no watermark.'
# world lighting variants
W2STYLE='Warm hand-painted storybook gouache illustration, friendly caricature with gently exaggerated proportions, bold clean silhouette, bright springtime meadow light, rich saturated candy colors on a simple painterly flower-meadow background, matched art series for a children'\''s trading-card game, centered subject, no text, no borders, no frames, no watermark.'
W3STYLE='Warm hand-painted storybook gouache illustration, friendly caricature with gently exaggerated proportions, bold clean silhouette, clean bright toy-room light with soft dusk warmth, rich saturated primary colors on a simple painterly plastic-brick-city background, matched art series for a children'\''s trading-card game, centered subject, no text, no borders, no frames, no watermark.'
W4STYLE='Warm hand-painted storybook gouache illustration, friendly caricature with gently exaggerated proportions, bold clean silhouette, moody violet night light with a warm magenta electromagnetic glow, rich saturated colors on a simple painterly shifting-sand background, matched art series for a children'\''s trading-card game, centered subject, no text, no borders, no frames, no watermark.'

ALL_IDS=()
GENERATED=(); SKIPPED=(); FAILED=()

find_ref() {
  local ext
  for ext in jpg jpeg png webp; do
    [ -f "$REF_DIR/$1.$ext" ] && { echo "$REF_DIR/$1.$ext"; return 0; }
  done
  return 1
}

gen() { # id out size ref("-"=none) prompt
  local id="$1" out="$2" size="$3" refsub="$4" prompt="$5"
  ALL_IDS+=("$id|$out")
  if [ "$MODE" != "missing" ]; then
    local want=0 w
    for w in ${WANTED[@]+"${WANTED[@]}"}; do [ "$w" = "$id" ] && want=1; done
    [ $want = 0 ] && return 0
  fi
  if [ -f "$out" ]; then SKIPPED+=("$id"); return 0; fi
  local refargs=()
  if [ "$refsub" != "-" ]; then
    local ref
    if ref=$(find_ref "$refsub"); then refargs=(--ref "$ref")
    else echo ">>> SKIP $id — missing ref photo" | tee -a "$LOG"; SKIPPED+=("$id"); return 0; fi
  fi
  echo "=== $(date +%H:%M:%S) $id → $out ($size, q=$QUALITY)" | tee -a "$LOG"
  if gpt-image "$prompt" ${refargs[@]+"${refargs[@]}"} --size "$size" --quality "$QUALITY" -o "$out" $EXTRA >>"$LOG" 2>&1; then
    GENERATED+=("$id"); echo "    done: $id" | tee -a "$LOG"
  else
    FAILED+=("$id"); echo "    FAILED: $id (see $LOG)" | tee -a "$LOG"
  fi
}

MODE="${1:-list}"
shift || true
WANTED=("$@")
if [ "$MODE" != "list" ] && [ "$MODE" != "missing" ]; then WANTED+=("$MODE"); fi

# ============================= PETS (the barn crew) =========================

gen pet_pig assets/originals/pets/pig.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a round pink gentleman pig sitting up proudly with a tiny mud splash across his snout like a fancy mustache, one hoof raised as if greeting an old friend. Dignified, delighted, a little muddy. A beloved farm pet."

gen pet_chicken assets/originals/pets/chicken.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a plump golden-brown hen with an extremely knowing expression, standing beside a single perfect white egg she has clearly just produced, one eyebrow-feather arched. Smug, punctual, magnificent. A beloved farm pet."

gen pet_cat assets/originals/pets/cat.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a sleek gray barn cat sitting with tail curled, eyes half-closed in supreme indifference, while one paw is secretly wound up mid-swat. Pretends not to care; absolutely cares. A beloved farm pet."

gen pet_puppy assets/originals/pets/puppy.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a tiny golden puppy caught mid-zoomies, running in a blurred circle with ears flapping and tongue out, little dust trail behind. Maximum speed, minimum plan, infinite joy. A beloved farm pet."

gen pet_goldfish assets/originals/pets/goldfish.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a serene orange goldfish in a clear farm pond, blowing a neat stream of sparkling bubbles, tiny content smile. Watching her is very calming. A beloved farm pet in her pool."

gen pet_sheepdog assets/originals/pets/sheepdog.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a fluffy black-and-white sheepdog standing at attention with a small red bandana, alert kind eyes peeking through mop-like fur, gently herding one confused duckling with his nose. A working dog, and proud of it."

gen pet_hound assets/originals/pets/hound.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a droopy-eared basset hound mid-HOWL, head thrown back, jowls wobbling, sound lines radiating out. The bark is enormous. The dog is not. A beloved farm pet."

gen pet_raccoon assets/originals/pets/raccoon.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a chubby raccoon wearing an expression of theatrical innocence, both little hands behind his back, a single gold coin visibly poking out of his cheek fur. Reformed. Mostly. A beloved farm pet."

gen pet_owl assets/originals/pets/owl.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a distinguished barn owl wearing tiny round reading glasses perched on a stack of one (1) book, wings folded like a professor about to make a point. Wise beyond the book's contents. A beloved farm pet."

gen pet_goat assets/originals/pets/goat.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a scrappy brown-and-white goat with tiny horns, head lowered in pre-headbutt stance, eyes locked onto a fence post that has personally wronged her, one hoof pawing the dirt. Unstoppable force, meet farm. A beloved farm pet."

gen pet_catfish assets/originals/pets/catfish.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: an old grumpy catfish with magnificent long whiskers, resting on the muddy pond bottom with bubbles rising, wearing the expression of someone who has seen everything and approved of none of it. A beloved farm pet in his pool."

gen pet_bear assets/originals/pets/bear.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a large friendly brown bear sitting politely in a barn doorway that is slightly too small for him, holding out one enormous paw as if offering to help, hay stuck in his fur. Nobody voted on this. Nobody objected. A beloved farm pet."

gen pet_rusty assets/originals/pets/rusty.png 1024x1024 rusty "Square image, 1024x1024.
$CSTYLE

Subject: the farm dog from the attached reference photo, clearly recognizable — now in a heroic action pose, mid-leap with a bright red toy in his mouth, ears flying, tail a blur of joy. The goodest boy, promoted to battle buddy."

gen pet_alien assets/originals/pets/alien.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a tiny mint-green alien with huge friendly black eyes and two little antennae, sitting in a crashed toy-sized flying saucer half-buried behind a barn, waving hello with three fingers, a chicken watching him suspiciously from the side. Really, really, really rare."

gen pet_diver assets/originals/pets/diver.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a sleek white farm duck wearing tiny swim goggles pushed up on her head, standing at the edge of a pond diving board built from a plank, wings on hips, ready. Ruler of the pond. A beloved champion duck."

gen pet_brownie assets/originals/pets/brownie.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a completely brown farm duck of gloriously unidentifiable breed, fluffy and round, standing in a queenly pose with one wing tucked like a cape, a tiny wildflower crown slightly askew on her head. Nobody knows what she is. That is her power."

gen pet_harmless assets/originals/pets/harmless.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a glossy black Cayuga duck with an iridescent beetle-green sheen on her feathers, standing perfectly still with narrowed eyes and one eyebrow-feather raised, radiating quiet menace and total confidence. Her name is Harmless. The name is a warning label in reverse."

gen pet_goldie assets/originals/pets/goldie.png 1024x1024 llama "Square image, 1024x1024.
$CSTYLE

Subject: the llama from the attached reference photo, clearly recognizable — standing at a farm gate in golden light, gazing directly at the viewer with ancient knowing eyes and the faintest hint of a smile. She says nothing. She knows everything. Legendary."

# ============================= FARM & UI SCENES =============================

gen farm_hub assets/originals/ui/farm.png 1024x1536 - "Tall image, 1024x1536.
$SCENE

Scene: a cozy storybook family farm seen from the front path at golden hour — a big red barn with open doors and friendly animals peeking out (a pig, a chicken, a cat), a small round fish pond with a fountain splash, a wooden farm shop stand, sunflowers along a fence, and a winding path leading toward strange colorful worlds glowing on the horizon. Warm, safe, home."

gen barn_scene assets/originals/ui/barn.png 1024x1536 - "Tall image, 1024x1536.
$SCENE

Scene: inside a warm storybook barn with golden hay light streaming through board gaps — five cozy animal stalls with name signs, straw floor, a ladder to a hay loft, lanterns, and through the open back door a glimpse of a small blue fish pool sparkling outside. Empty stalls waiting for new friends. Warm, safe, inviting."

gen title_art assets/originals/ui/title.png 1024x1536 - "Tall image, 1024x1536.
$SCENE

Scene: an epic-but-friendly storybook title composition — three kid heroes seen from behind on a hilltop at the farm's edge (a tall 10-year-old with a soccer ball, a sturdy 8-year-old with little tornado swirls at his fists, and a tiny toddler with floating diapers), looking out at four wild worlds floating in the sky: a golden corn kingdom, a candy-bright critter meadow, a city of plastic building bricks, and a swirling violet sandbox with a giant magnet silhouette. A dog and a bear stand with them. Leave the lower third calmer for menu buttons."

gen icon assets/originals/ui/icon.png 1024x1024 - "Square image, 1024x1024.
App icon, bold and readable at small sizes. Warm hand-painted storybook gouache style, rich saturated colors, no text, no borders, no watermark.

Subject: a friendly mint-green alien and a black duck with a green sheen standing back to back like heroes on a tiny farm hilltop, big red barn behind them, four colorful worlds glowing as small orbs in the sky. Centered composition with strong silhouette."

# ============================= WORLD BACKDROPS ==============================

gen map1_bg assets/originals/backgrounds/map1.png 1024x1536 - "Tall image, 1024x1536.
$SCENE

Scene: THE CROP KINGDOM — an endless golden corn and crop landscape gone gently weird: rows of corn standing suspiciously at attention, pumpkins the size of sheds with faint sleepy faces, a winding dirt path climbing toward a wildflower-crowned throne of hay bales on the horizon. Morning light, playful storybook menace. Background art for a map screen, soft focus, no characters in the foreground."

gen map2_bg assets/originals/backgrounds/map2.png 1024x1536 - "Tall image, 1024x1536.
Warm hand-painted storybook gouache illustration, rich saturated candy colors, bright springtime light, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: CRITTER MEADOW — a rolling candy-bright flower meadow dotted with tiny dens, burrows and mushroom houses where small strange creatures peek out (glowing tails, oversized ears, sparkly eyes half-hidden in grass), a brook winding to a big blue pond with a plank diving board on the horizon. Adorable and mysterious. Background art for a map screen, soft focus, no characters in the foreground."

gen map3_bg assets/originals/backgrounds/map3.png 1024x1536 - "Tall image, 1024x1536.
Warm hand-painted storybook gouache illustration, rich saturated primary colors, clean bright toy light warming into dusk, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: BRICKTOPIA — a whole city built of colorful plastic toy bricks: studded towers, a brick bridge, half-finished buildings with instruction pages blowing in the wind like leaves, a road of flat plates climbing toward a fortress of black bricks on the horizon. Playful, geometric, slightly ominous. Background art for a map screen, soft focus, no characters in the foreground."

gen map4_bg assets/originals/backgrounds/map4.png 1024x1536 - "Tall image, 1024x1536.
Warm hand-painted storybook gouache illustration, rich saturated colors, moody violet night light with a warm magenta electromagnetic glow, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: THE KINETIC SANDBOX — an endless dune-scape of impossibly smooth rainbow-sheened kinetic sand under a violet night sky, sand rippling and holding impossible shapes, half-buried toy shovels and buckets the size of houses, and far on the horizon a colossal horseshoe-magnet silhouette humming with magenta light. Weird, beautiful, final-world energy. Background art for a map screen, soft focus, no characters in the foreground."

gen bg1 assets/originals/backgrounds/bg1.png 1536x1024 - "Wide image, 1536x1024.
$SCENE

Scene: a battle clearing in THE CROP KINGDOM — trampled golden cornfield arena ringed by tall watching corn, hay bales, morning sky. Empty center stage for combat. Background art, soft focus, no characters."

gen bg2 assets/originals/backgrounds/bg2.png 1536x1024 - "Wide image, 1536x1024.
Warm hand-painted storybook gouache illustration, rich saturated candy colors, bright springtime light, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: a battle clearing in CRITTER MEADOW — a flower-ringed grassy hollow with tiny burrow doors all around, petals drifting. Empty center stage for combat. Background art, soft focus, no characters."

gen bg3 assets/originals/backgrounds/bg3.png 1536x1024 - "Wide image, 1536x1024.
Warm hand-painted storybook gouache illustration, rich saturated primary colors, clean bright toy light warming into dusk, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: a battle arena in BRICKTOPIA — a flat plaza of gray baseplate ringed by colorful brick walls and studded towers, loose bricks scattered at the edges. Empty center stage for combat. Background art, soft focus, no characters."

gen bg4 assets/originals/backgrounds/bg4.png 1536x1024 - "Wide image, 1536x1024.
Warm hand-painted storybook gouache illustration, rich saturated colors, moody violet night light with a warm magenta electromagnetic glow, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: a battle bowl in THE KINETIC SANDBOX — smooth rippled rainbow-sheen sand arena under a violet sky, strange sand spires holding impossible angles, faint magnetic sparkles in the air. Empty center stage for combat. Background art, soft focus, no characters."

gen actcard1 assets/originals/backgrounds/actcard1.png 1024x1536 - "Tall image, 1024x1536.
$SCENE

Scene: dramatic storybook gate to THE CROP KINGDOM — a towering archway woven from cornstalks and sunflowers with a wildflower crown hung at its peak, golden fields beyond. Adventure begins. No characters, no text."

gen actcard2 assets/originals/backgrounds/actcard2.png 1024x1536 - "Tall image, 1024x1536.
Warm hand-painted storybook gouache illustration, rich saturated candy colors, bright springtime light, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: dramatic storybook gate to CRITTER MEADOW — a flowering hedge archway with dozens of tiny glowing creature eyes peeking from the blossoms, a pond glinting beyond. Adorable and mysterious. No characters, no text."

gen actcard3 assets/originals/backgrounds/actcard3.png 1024x1536 - "Tall image, 1024x1536.
Warm hand-painted storybook gouache illustration, rich saturated primary colors, clean bright toy light warming into dusk, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: dramatic storybook gate to BRICKTOPIA — a massive archway built of colorful plastic bricks, one brick conspicuously missing near the top, a brick city skyline beyond. No characters, no text."

gen actcard4 assets/originals/backgrounds/actcard4.png 1024x1536 - "Tall image, 1024x1536.
Warm hand-painted storybook gouache illustration, rich saturated colors, moody violet night light with a warm magenta electromagnetic glow, matched art series for a children's trading-card game, no text, no borders, no frames, no watermark.

Scene: dramatic storybook gate to THE KINETIC SANDBOX — an archway of rippling kinetic sand frozen mid-flow, magenta magnetic sparks arcing across the opening, endless violet dunes beyond. This is the big one. No characters, no text."


# ============================= WORLD 1 ENEMIES (Crop Kingdom) ================

gen angry_sprout assets/originals/enemies/angry_sprout.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a small furious green sprout in a crack of farm soil, tiny leaf-fists clenched, face scrunched in cartoonish rage, little steam puffs above its head. It is 6 inches tall and ABSOLUTELY DONE with everything. Funny-menacing, never scary."

gen corn_colonel assets/originals/enemies/corn_colonel.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a tall ear of corn standing at rigid military attention, husk peeled back like a decorated uniform collar, a stern kernel face with a bushy corn-silk mustache, one leaf tucked behind its back like a drill sergeant. Funny-menacing, never scary."

gen rolling_pumpkin assets/originals/enemies/rolling_pumpkin.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a round orange pumpkin caught mid-roll toward the viewer, little determined face, stem spinning like a propeller, dust and leaves kicked up behind it. Someone is about to get their toes rolled over. Funny-menacing, never scary."

gen rolling_pumpkin_curled assets/originals/enemies/rolling_pumpkin_curled.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: the same round orange pumpkin tucked tight into itself, stem pulled down like a hat, eyes squeezed shut, wearing its thick rind like armor plates. Hunkered and smug about it. Funny-menacing, never scary."

gen compost_blob_m assets/originals/enemies/compost_blob_m.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a big wobbly blob of garden compost — cabbage leaves, carrot tops and old banana peels all mushed into one googly-eyed creature, mid-wobble, bits dripping off. Smells confident. Funny-menacing, never scary."

gen compost_blob_s assets/originals/enemies/compost_blob_s.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a tiny hand-sized blob of compost with one big googly eye and a determined frown, hopping angrily. Barely a squish in it. Funny-menacing, never scary."

gen weed_dandelion assets/originals/enemies/weed_dandelion.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a scrappy dandelion weed with tiny leaf fists up like a boxer, yellow petal head cocked, getting visibly angrier — little red cartoon anger marks. The maddest flower on the farm. Funny-menacing, never scary."

gen weed_thistle assets/originals/enemies/weed_thistle.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: two prickly purple thistle sisters leaning back to back, spiky arms crossed, identical smirks. Sharp customers. Funny-menacing, never scary."

gen weed_burr assets/originals/enemies/weed_burr.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a round burr covered in velcro hooks, grinning, already stuck to one sock it has stolen, arms open for an unwanted sticky hug. Funny-menacing, never scary."

gen weed_clover assets/originals/enemies/weed_clover.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a four-leaf clover wearing tiny spectacles, standing on a pebble podium mid-inspirational-speech to unseen weeds, one leaf raised like a professor. Extremely pleased with himself. Funny-menacing, never scary."

gen puff_dandelion assets/originals/enemies/puff_dandelion.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a swollen white dandelion puffball at maximum fluff, cheeks puffed, holding its breath dramatically, a few seeds already escaping. It is absolutely going to pop and everyone knows it. Funny-menacing, never scary."

gen crow_thief assets/originals/enemies/crow_thief.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a glossy black crow wearing a tiny burglar mask, frozen mid-tiptoe on a fence rail, one gold coin in its beak and a little sack over its shoulder. Caught in the act, not sorry. Funny-menacing, never scary."

gen sticky_vine assets/originals/enemies/sticky_vine.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a long green vine rearing up like a friendly cobra, dripping golden sap, several sap-bubbles glistening, one leafy tendril wound into a lasso. Funny-menacing, never scary."

gen giant_zucchini assets/originals/enemies/giant_zucchini.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: an enormous county-fair zucchini flexing like a bodybuilder, green skin gleaming, tiny prize ribbon still attached, veins of pure vegetable muscle. The biggest thing the garden ever grew. Funny-menacing, never scary."

gen mega_melon assets/originals/enemies/mega_melon.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: a colossal watermelon sitting perfectly still in a field clearing, eyes closed, radiating quiet menace, small flowers growing undisturbed around it. It is just sitting there. Roundly. Funny-menacing, never scary."

gen sprinkler_post assets/originals/enemies/sprinkler_post.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: an old brass garden sprinkler on a wooden post, twisted into a watchful sentry with a single lens-like eye, water jet arcing, soggy straw scattered at its base. Funny-menacing, never scary."

gen boss_brownie assets/originals/enemies/duck_brownie.png 1024x1024 - "Square image, 1024x1024.
$CSTYLE

Subject: BOSS ART — a completely brown duck of gloriously unidentifiable breed on a throne of hay bales, wearing a slightly crooked wildflower crown, wings spread in royal command, corn subjects bowing at the edges. Regal, mysterious, ridiculous. Big boss energy, funny-menacing, never scary."

# ============================= WORLD 2 ENEMIES (Critter Meadow) ==============

gen sparkmouse assets/originals/enemies/sparkmouse.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: an adorable round yellow-cheeked mouse critter crackling with tiny static sparks, fur puffed like a dandelion, mid-zap with a mischievous squeak. Original creature, cuddly and electric. Funny-menacing, never scary."

gen flame_pup assets/originals/enemies/flame_pup.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: a tiny orange puppy critter whose ears and tail flicker like candle flames, tongue out, tail wagging embers, sitting in a circle of slightly singed grass. A very good boy who is also on fire. Funny-menacing, never scary."

gen leaf_turtle assets/originals/enemies/leaf_turtle.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: a small turtle critter whose shell is made of overlapping bright green leaves like armor scales, new leaves visibly sprouting at the rim, calm determined face. Funny-menacing, never scary."

gen bubble_frog assets/originals/enemies/bubble_frog.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: a round teal frog critter mid-ribbit, blowing a stream of iridescent bubbles that float menacingly upward, sitting on a lilypad with tiny confident hands on hips. Funny-menacing, never scary."

gen mimic_moth assets/originals/enemies/mimic_moth.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: a plump lavender moth critter with hypnotic spiral patterns on its wings, shedding a glittering cloud of dizzy dust, big innocent eyes that know exactly what they are doing. Funny-menacing, never scary."

gen snatchling assets/originals/enemies/snatchling.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: a tiny squirrel-like critter with enormous stuffed cheek pouches and a gold coin sticking out of one, frozen mid-scurry with wide guilty eyes. Funny-menacing, never scary."

gen puffbunny assets/originals/enemies/puffbunny.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: an impossibly fluffy round bunny critter, 90 percent floof, tiny angry eyebrows, visibly over-inflated like it might burst into a cloud of fluff at any second. Funny-menacing, never scary."

gen big_chonk assets/originals/enemies/big_chonk.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: ELITE ART — a hamster critter the size of a hay bale, both cheeks stuffed to absolute maximum, tiny arms flexed, standing in a shallow crater of its own making. Magnificent. Enormous. Funny-menacing, never scary."

gen queen_bee assets/originals/enemies/queen_bee.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: ELITE ART — a regal bee critter with a tiny golden crown and a velvet cape, hovering with royal posture, holding a needle-like scepter, loyal bee subjects saluting in the background blur. Funny-menacing, never scary."

gen totem_triplets assets/originals/enemies/totem_triplets.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: ELITE ART — a small stone totem statue carved like three stacked judgemental critter faces, moss accents, faint glowing eyes, tiny confetti of junk fluttering around it. Ancient and extremely judgy. Funny-menacing, never scary."

gen boss_diver assets/originals/enemies/duck_diver.png 1024x1024 - "Square image, 1024x1024.
$W2STYLE

Subject: BOSS ART — a sleek white duck in tiny swim goggles at the tip of a high plank diving board above a meadow pond, wings spread in a perfect pre-dive pose, critters watching in awe from the grass below. Olympic drama. Big boss energy, funny-menacing, never scary."

# ============================= WORLD 3 ENEMIES (Bricktopia) ==================

gen brick_biter assets/originals/enemies/brick_biter.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a chunky creature built entirely of red and orange toy building bricks, blocky jaw wide open showing brick teeth, snapping at the air. Studs on top of its head like a mohawk. Funny-menacing, never scary."

gen sharp_brick assets/originals/enemies/sharp_brick.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a single innocent-looking red toy brick lying on the floor at a slight angle, corner gleaming with an ominous sparkle, tiny smug face on its side, dramatic spotlight. The most dangerous object in any home. Funny-menacing, never scary."

gen minifig_scrapper assets/originals/enemies/minifig_scrapper.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a tiny toy minifigure with a printed angry face and a plastic sword, in a fierce fighting stance, claw hands up. Four centimeters of fury. Funny-menacing, never scary."

gen minifig_ninja assets/originals/enemies/minifig_ninja.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a tiny toy ninja minifigure in black plastic, mid-sneak on tiptoe, a plastic bonk-stick raised, printed face showing intense concentration. Funny-menacing, never scary."

gen minifig_knight assets/originals/enemies/minifig_knight.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a tiny toy knight minifigure with a plastic shield twice his size, peeking over the rim, very professional stance. Funny-menacing, never scary."

gen minifig_wizard assets/originals/enemies/minifig_wizard.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a tiny toy wizard minifigure with a printed beard, pointy plastic hat, waving a sparking wand dramatically, little plastic stars orbiting. Funny-menacing, never scary."

gen brick_golem_m assets/originals/enemies/brick_golem_m.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a hulking golem built of mismatched colorful toy bricks, one arm bigger than the other, a few bricks visibly loose and wobbling, determined blocky face. Built wrong and proud of it. Funny-menacing, never scary."

gen brick_pile assets/originals/enemies/brick_pile.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a small loose pile of colorful toy bricks that has somehow formed an angry little face on its front, hopping mad, single bricks jumping off it like popcorn. Funny-menacing, never scary."

gen instruction_golem assets/originals/enemies/instruction_golem.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a creature made of folded instruction-booklet pages, arms of accordion paper, its face an exploded-view diagram with judging eyes, holding up STEP 47 like a legal summons. Papercut energy. Funny-menacing, never scary."

gen wobble_tower assets/originals/enemies/wobble_tower.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: a tall teetering tower of toy bricks leaning at a physically alarming angle, googly eyes near the top, one brick conspicuously missing from its middle, tiny arms out for balance. Everyone nearby is nervous. Funny-menacing, never scary."

gen crane_head assets/originals/enemies/crane_head.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: ELITE ART — a giant toy construction crane with a face on its cab, slowly winding back an enormous wrecking ball with theatrical patience, warning-stripe details. The countdown is real. Funny-menacing, never scary."

gen ghost_piece assets/originals/enemies/ghost_piece.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: ELITE ART — a translucent ghostly-blue toy brick floating in the shadow under a couch, half-transparent, dust bunnies drifting past it, eyes glowing faintly. The piece that vanished years ago, back with a grudge. Funny-menacing, never scary."

gen master_builder assets/originals/enemies/master_builder.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: ELITE ART — a large minifigure foreman with a plastic hard hat and a blueprint under one arm, mid-speed-build with bricks levitating into place around him, tiny ninja minifigures assembling behind him. Funny-menacing, never scary."

gen boss_harmless assets/originals/enemies/duck_harmless.png 1024x1024 - "Square image, 1024x1024.
$W3STYLE

Subject: BOSS ART — a glossy black Cayuga duck with an iridescent beetle-green sheen, standing perfectly still and centered atop a fortress of black toy bricks, eyes narrowed to calm slits, a single black feather drifting. The stillness IS the threat. Big boss energy, funny-menacing, never scary."

# ============================= WORLD 4 ENEMIES (Kinetic Sandbox) =============

gen sand_blob_m assets/originals/enemies/sand_blob_m.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a big wobbling blob of rainbow-sheened kinetic sand holding an impossible teardrop shape, grains visibly flowing inside it, simple determined face pressed into its surface. Satisfying and sinister. Funny-menacing, never scary."

gen sand_blob_s assets/originals/enemies/sand_blob_s.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a handful-sized blob of shimmering kinetic sand with a grumpy little face, mid-hop, leaving a perfect crumbly trail. Funny-menacing, never scary."

gen squish_ball assets/originals/enemies/squish_ball.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a bright orange stress-squish-ball creature mid-bounce, face squashed comically by its own momentum, glossy highlights, little motion arcs. Infinitely squishable, weirdly durable. Funny-menacing, never scary."

gen glitter_storm assets/originals/enemies/glitter_storm.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a swirling localized storm cloud made entirely of rainbow glitter, two cranky eyes in its center, glitter spraying everywhere and settling on everything forever. Every parent's nightmare. Funny-menacing, never scary."

gen sandworm assets/originals/enemies/sandworm.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a huge friendly-terrifying worm of segmented kinetic sand bursting up through the dunes in an arc, grains cascading off its coils, wide toothless mouth mid-roar. Funny-menacing, never scary."

gen play_dough_twin_a assets/originals/enemies/play_dough_twin_a.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a chunky blue modeling-clay person with visible fingerprint textures, standing protectively with dough arms crossed, calm big-sibling energy. Funny-menacing, never scary."

gen play_dough_twin_b assets/originals/enemies/play_dough_twin_b.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a smaller red modeling-clay person with fingerprint textures, hands glowing softly mid-repair, patching a dent in its own arm with fresh clay, kind mischievous face. Funny-menacing, never scary."

gen magnet_mite assets/originals/enemies/magnet_mite.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a small round creature that is basically a red-and-silver horseshoe magnet with stubby legs and big magnetic-field eyebrows, tiny bolts and paperclips stuck all over it, crackling with attraction. Funny-menacing, never scary."

gen static_cling assets/originals/enemies/static_cling.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a crackling creature of pure static electricity shaped like a sock fresh from the dryer, hair-raising sparks arcing off it, one sock and three balloons stuck to its body. Everything sticks to it. Funny-menacing, never scary."

gen sand_castle assets/originals/enemies/sand_castle.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: ELITE ART — a majestic kinetic-sand castle with turrets and a gate-face, standing defiant as a glowing tide line creeps toward it, flags of seaweed, stoic expression. It knows how its story ends. Funny-menacing, never scary."

gen rake_fingers assets/originals/enemies/rake_fingers.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: ELITE ART — a giant disembodied garden-rake hand with five long tines for fingers, dragging deep perfect grooves through rippled kinetic sand, poised to rake again. Oddly satisfying, definitely coming for you. Funny-menacing, never scary."

gen dust_bunny_mother assets/originals/enemies/dust_bunny_mother.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: ELITE ART — an enormous majestic dust bunny with regal bearing, made of gray fluff, lint and one lost hair-tie, surrounded by a litter of tiny dust bunnies multiplying in real time. Nobody knows how. Funny-menacing, never scary."

gen dust_bunny assets/originals/enemies/dust_bunny.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a tiny gray dust bunny with two long lint ears and big watery eyes, mid-drift on a breeze, trailing fluff. Here for one allergy attack and then gone. Funny-menacing, never scary."

gen sand_monster assets/originals/enemies/sand_monster.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: FINAL BOSS ART — THE KINETIC SAND MONSTER: a towering humanoid colossus of rainbow-sheened kinetic sand, arms mid-tear as one limb pulls itself loose to fight separately, sand cascading in sheets, a faint magenta magnetic glow pulsing deep in its chest where something is hidden. Epic scale, awesome not horrifying."

gen sand_limb assets/originals/enemies/sand_limb.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: a torn-loose ARM of packed kinetic sand, fingers and all, standing upright on its stump like it owns the place, flexing, grains drifting off it. Funny-menacing, never scary."

gen magnet_core assets/originals/enemies/magnet_core.png 1024x1024 - "Square image, 1024x1024.
$W4STYLE

Subject: FINAL BOSS PHASE 2 ART — a huge gleaming red-and-silver horseshoe MAGNET, freshly shed of all its sand (sand heaped around its base), humming with visible magenta magnetic-field arcs, one small crack of worry on its otherwise smug metallic face. THE MAGNET MENACE revealed. Epic, funny-menacing, never scary."

# ============================= report =======================================
echo ""
echo "generated: ${#GENERATED[@]} · skipped: ${#SKIPPED[@]} · failed: ${#FAILED[@]}"
[ ${#FAILED[@]} -gt 0 ] && { printf 'FAILED: %s\n' "${FAILED[@]}"; exit 1; }
exit 0
