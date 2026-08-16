#!/bin/bash
# RL3 soundtrack batch via suno-auto. Take-1-only policy (Sat 2026-08-15): no
# --download on generate; fetch ONLY the first clip via `suno download`.
set -uo pipefail
cd "$(dirname "$0")/.."
VAULT="/Users/jamesmoran/Library/CloudStorage/GoogleDrive-jamessheehanmoran@gmail.com/My Drive/second-brain"
REPO="$(pwd)"
mkdir -p assets/audio/gen-logs assets/originals/audio

gen_track() { # track title [extra args...]
  local track="$1" title="$2"; shift 2
  if [ -f "assets/originals/audio/$track.mp3" ]; then echo "=== $track already done"; return 0; fi
  local id="" attempt
  for attempt in 1 2 3; do
    echo "=== $(date +%H:%M:%S) generating $track ($title) [attempt $attempt]"
    ( cd "$VAULT" && .claude/skills/suno/suno-auto generate --title "$title" "$@" --model v5.5 --wait ) > "assets/audio/gen-logs/$track.json" 2>&1
    id=$(/usr/bin/grep -o '"id": "[0-9a-f-]*"' "assets/audio/gen-logs/$track.json" | head -1 | cut -d'"' -f4)
    [ -n "$id" ] && break
    echo "    transient failure; cooling down 45s"
    sleep 45
  done
  if [ -z "$id" ]; then echo "!!! $track FAILED after 3 attempts"; return 1; fi
  local tmp="assets/audio/tmp_$track"
  mkdir -p "$tmp"
  suno download "$id" --output "$REPO/$tmp/" > "assets/audio/gen-logs/$track-dl.json" 2>&1
  local f
  f=$(ls "$tmp" 2>/dev/null | head -1)
  if [ -z "$f" ]; then echo "!!! $track download FAILED ($id)"; return 1; fi
  mv "$tmp/$f" "assets/originals/audio/$track.mp3"
  rmdir "$tmp" 2>/dev/null || true
  echo "    done: $track ← take 1 ($id)"
}

FAILS=0
gen_track title "RL3 World of Weirdos" --tags "adventurous folk rock instrumental with playful weird synth accents, banjo meets wonky synthesizer, big inviting title theme, video game title screen music, looping" --exclude "vocals, singing, sad, dark" --instrumental || FAILS=1
gen_track farm "RL3 Home Farm" --tags "cozy pastoral banjo and acoustic guitar instrumental, warm home base music, gentle animal-friendly farm loop, relaxed video game hub music, looping" --exclude "vocals, singing, sad" --instrumental || FAILS=1
gen_track map1 "RL3 Crop Kingdom" --tags "bouncy country folk instrumental, fiddle and washboard, sunny fields gone slightly weird, playful adventure map music, video game, looping" --exclude "vocals, singing, sad, dark" --instrumental || FAILS=1
gen_track map2 "RL3 Critter Meadow" --tags "cute chiptune orchestral hybrid instrumental, bright bells and gameboy blips over strings, adorable creature adventure, video game map music, looping" --exclude "vocals, singing, sad" --instrumental || FAILS=1
gen_track map3 "RL3 Bricktopia" --tags "playful toy march instrumental, clicky plastic percussion, toy piano, snapping block rhythms, quirky builder groove, video game map music, looping" --exclude "vocals, singing, sad, orchestra swell" --instrumental || FAILS=1
gen_track map4 "RL3 Kinetic Sandbox" --tags "wobbly squishy synth instrumental, playful ominous, rubbery bass, shifting sands, weird tension building, final world video game map music, looping" --exclude "vocals, singing, horror, screeching" --instrumental || FAILS=1
gen_track battle "RL3 Battle" --tags "energetic bluegrass rock hoedown instrumental, fast fiddle, banjo, driving drums, playful fight music with weird synth stabs, video game battle theme, looping" --exclude "vocals, singing, sad" --instrumental || FAILS=1
gen_track elite "RL3 Big Trouble" --tags "heavy stomp bluegrass rock instrumental, menacing but fun, big drums, electric guitar and banjo, danger theme, video game elite battle, looping" --exclude "vocals, singing, horror" --instrumental || FAILS=1
gen_track duckboss "RL3 Duck Tantrum" --tags "comedic menace tango instrumental, dramatic brass and accordion, waddling tuba bassline, silly showdown with real stakes, video game boss theme, looping" --exclude "vocals, singing, horror, actual duck sounds" --instrumental || FAILS=1
gen_track finalboss "RL3 The Magnet Menace" --tags "epic weird synth rock showdown instrumental, huge drums, electromagnetic hum swells, wobbly sand textures, dramatic heroic final boss, video game, looping" --exclude "vocals, singing, horror, screeching" --instrumental || FAILS=1
gen_track victory "RL3 Victory Fanfare" --tags "short triumphant brass fanfare, celebratory sting, bright and quick victory jingle, video game win sound, one-shot" --exclude "vocals, singing, long intro" --instrumental || FAILS=1
gen_track anthem_wyatt "Wyatt the Speedy" --tags "upbeat pop punk country rock, kids victory anthem, fast bright electric guitars, gang vocals, triumphant, young male vocals" --exclude "sad, slow, screaming" --lyrics-file "$REPO/assets/lyrics/wyatt.txt" || FAILS=1
gen_track anthem_aaron "Aaron the Strong" --tags "stomp rock kids victory anthem, heavy drums, country rock, powerful, triumphant, young male vocals" --exclude "sad, slow, metal screams" --lyrics-file "$REPO/assets/lyrics/aaron.txt" || FAILS=1
gen_track anthem_liam "Liam the Little" --tags "silly bouncy kids song, ukulele, tuba, playful, upbeat, giggly, children's music" --exclude "sad, slow, rock, heavy" --lyrics-file "$REPO/assets/lyrics/liam.txt" || FAILS=1
gen_track anthem_all "Legends of the Farm" --tags "triumphant country pop finale, brass, gang vocals, joyful, kids victory anthem, big singalong ending" --exclude "sad, slow" --lyrics-file "$REPO/assets/lyrics/all.txt" || FAILS=1

echo "=== music batch complete (fails=$FAILS)"
ls -la assets/originals/audio/*.mp3 2>/dev/null
exit $FAILS
