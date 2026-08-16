# REVIEW.md — awaiting James

## Gating questions — ALL ANSWERED Sun 2026-08-16 (same session); answers locked into DESIGN.md §LOCKED (James's answers)

1. Structure → farm hub + runs (Hades model). 2. Worlds → Hugo's call, 4 worlds; IP relaxed (small private audience), original names + homage. 3. (merged into 2.) 4. Difficulty → HARDER than RL2 (Wyatt's spec: should take him a long time; endless replay) → 20–30 fresh rails + Weirdness ladder. 5. Pets → as recommended; duck-super-pet approved. 6. Secret → yes, creative liberty, really hard to find, zero visual tell (white-dot lesson) → spec in CLAUDE.md §Cast. 7. Photos → none of the ducks; proceed best-effort; James will say if that changes. 8. Delivery → ASAP, same GitHub Pages hosting at his go.

## Kid-credited deviations

(none yet)

## Dialogue / lyrics for approval

(none yet)

## Kid-credited deviations (build phase)

- **Difficulty shape** — Wyatt's "harder than RL2, takes me a long time" implemented as: world 1 fresh ≈ 65% winrate (the on-ramp), worlds 2–3 ≈ 35–40%, world 4 ≈ 5% fresh / ≈ 20% with a battle buddy (the RL2-hard-equivalent gate), plus the Weirdness ladder (W1–10, +7% HP/+5% dmg per level) as the long game. A flat 20–30% everywhere would have made world 1 miserable for a fresh profile with nothing banked yet; the length now lives in the ladder + Barn Book completion instead. GOAL.md's original "fresh ~25% (rails 20–30)" band was retuned accordingly — rails in test/selfplay.mjs.
- **"Fifty damage"** — shipped exactly 50 on MAGNET THROW (with a telegraphed MAGNETIZING windup turn before every throw, so it's survivable with Block). Magnet = exactly 100 HP. Untouched by all balance passes, as promised.
- **Limb return** — a beaten limb "sinks back into the monster" implemented as +8 Block to the body (the body drinks the sand). Aaron's original words allowed several readings; this one keeps limb-killing a real choice.
- **Goldie Knows** — CLAUDE.md spec said "look at top 3, reorder"; shipped as draw 3, discard 2 (kid-simpler, no new UI mode). Same fantasy: Goldie knows what's coming.

## Dialogue / lyrics for approval (shipped as drafts, per ground rule 3)

- **Anthem lyrics** ×4: assets/lyrics/*.txt (Whyatt/Leeum sing-spellings; captions remap). All four generated take-1 and shipped with word-level LRC karaoke.
- **Scout reports** ×68: js/scout.js (Coach's voice, describe-don't-prescribe audited by unit test).
- **World story cards** ×4 + settlement lines + crown-screen victory lines: js/game.js.
- **Pet blurbs + quirk lines** ×18: js/pets.js.

## Gaps & Personalization report

1. **Duck likenesses** (top gap): Diver/Brownie/Harmless painted from breed descriptions only (white Appleyard-guess / all-brown / black Cayuga). Real photos → regenerate `pet_diver, pet_brownie, pet_harmless, boss_brownie, boss_diver, boss_harmless` via `./assets/generate-art.sh <ids>` (delete the files first).
2. **Liam reference**: portrait reused from RL2 (which used the two recent photos from Fri 2026-08-01) — still the freshest available.
3. **Boys' own weirdo ideas**: the bestiary is Hugo-invented per James's creative-liberty grant. Any weirdo the boys pitch later can replace or join a world pool — enemies are data + a move function + one painting.
4. **World names**: The Crop Kingdom / Critter Meadow / Bricktopia / The Kinetic Sandbox are Hugo's; the boys may rename any (DESIGN.md offer stands) — renames touch WORLD_INFO, story cards, README.
