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

# ============================= report =======================================
echo ""
echo "generated: ${#GENERATED[@]} · skipped: ${#SKIPPED[@]} · failed: ${#FAILED[@]}"
[ ${#FAILED[@]} -gt 0 ] && { printf 'FAILED: %s\n' "${FAILED[@]}"; exit 1; }
exit 0
