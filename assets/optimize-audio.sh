#!/bin/bash
# optimize-audio.sh — web-weight MP3s from the full-rate Suno originals.
#
# Originals (~180kbps VBR from Suno) live in assets/originals/audio/
# (gitignored, machine-local). Deployed copies are 128kbps CBR — on tablet
# speakers the difference is inaudible and the payload roughly halves.
# Run after any new Suno track lands (drop the original in originals/audio/).
set -euo pipefail
cd "$(dirname "$0")/.."

ORIG=assets/originals/audio
[ -d "$ORIG" ] || { echo "no $ORIG"; exit 1; }

for f in "$ORIG"/*.mp3; do
  [ -e "$f" ] || continue
  out="assets/audio/$(basename "$f")"
  ffmpeg -y -loglevel error -i "$f" -codec:a libmp3lame -b:a 128k "$out"
  printf '%-40s %5dKB (was %dKB)\n' "$out" "$(( $(stat -f%z "$out") / 1024 ))" "$(( $(stat -f%z "$f") / 1024 ))"
done
echo "deployed audio: $(du -sh assets/audio | cut -f1)"
