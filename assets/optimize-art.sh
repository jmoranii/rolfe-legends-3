#!/bin/bash
# optimize-art.sh — produce web-weight JPEGs from the full-res generated art.
#
# Full-res PNGs (~2.4MB each, 1254²) live in assets/originals/** (gitignored,
# machine-local — regenerate via generate-art.sh). This script emits the
# DEPLOYED copies next to the old hook paths, as .jpg:
#   portraits/enemies/events → 512px  (rendered ≤220px; 2x for retina)
#   backgrounds + title      → 1024px (fullscreen art)
# Icons stay PNG and are not touched. Run after any reroll.
set -euo pipefail
cd "$(dirname "$0")/.."

ORIG=assets/originals
[ -d "$ORIG" ] || { echo "no $ORIG — run generate-art.sh first"; exit 1; }

emit() { # src-png dst-jpg max-px
  local src="$1" dst="$2" px="$3"
  [ -f "$src" ] || { echo "skip (missing): $src"; return 0; }
  sips -s format jpeg -s formatOptions 78 -Z "$px" "$src" --out "$dst" >/dev/null
  printf '%-46s %6dKB\n' "$dst" "$(( $(stat -f%z "$dst") / 1024 ))"
}

for f in "$ORIG"/enemies/*.png; do
  [ -e "$f" ] || continue
  emit "$f" "assets/enemies/$(basename "${f%.png}").jpg" 512
done
for f in "$ORIG"/events/*.png; do
  [ -e "$f" ] || continue
  emit "$f" "assets/events/$(basename "${f%.png}").jpg" 512
done
for p in portrait_wyatt portrait_aaron portrait_liam portrait_coach; do
  emit "$ORIG/ui/$p.png" "assets/ui/$p.jpg" 512
done
emit "$ORIG/ui/title.png" "assets/ui/title.jpg" 1024
for f in "$ORIG"/actcards/*.png; do
  [ -e "$f" ] || continue
  emit "$f" "assets/backgrounds/$(basename "${f%.png}").jpg" 1536
done
for f in "$ORIG"/backgrounds/*.png; do
  [ -e "$f" ] || continue
  emit "$f" "assets/backgrounds/$(basename "${f%.png}").jpg" 1024
done
echo "done. deployed art:"
du -sh assets/enemies assets/events assets/backgrounds | sed 's/^/  /'
