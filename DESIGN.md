# DESIGN.md — Rolfe Legends 3: World of Weirdos

> **STATUS: ACTIVE** — James answered the gating questions Sun 2026-08-16 (same session). Sections marked LOCKED are decided. Source of record for the brainstorm itself: the vault note `gtd/project-notes/202608-rolfe-legends-3.md`.

## LOCKED (Sun 2026-08-16 brainstorm, kid-credited)

- **Title:** *Rolfe Legends 3: World of Weirdos* (unanimous vote). Wyatt's runner-ups live inside the game: *Beyond the Farm* (world map / chapter candidate) and *The Magnet Menace* (Kinetic Sand Monster fight name).
- **Core combat:** cards, RL2-style (Wyatt).
- **Heroes:** Wyatt, Aaron, Liam the Little (Wyatt).
- **Pet loop (Aaron):** win fights → random chance at pets → pets live in the barn (capacity 5 to start) → shop upgrades barn capacity or unlocks pets-fight-beside-you → difficulty ramps as you go.
- **Pets inject cards (Wyatt):** the Bear grants Bear Cards — Claw Scratch: 2 hits × 6 damage. Aaron's pet pick: **Rusty**.
- **Worlds (both):** multiple themed worlds full of weirdos; each world's boss is one of Wyatt's real ducks (**Diver**, **Brownie**, **Harmless**); more worlds reached → more unlocks. Regular weirdo fights precede each boss (Wyatt).
- **Finale (both, riffed together):** The Kinetic Sand Monster — limbs detach into separate fights, re-merge when beaten; cleared limbs → 50 damage sheds the sand → magnet core helpless one turn → ~100 HP core; active core throws 50-damage magnets ("we really wanna try to make fifty damage work"; fallback 20–40, still huge).
- **Victory song** on beating the game, like RL1/RL2 (Wyatt).

## LOCKED (Sun 2026-08-16, James's answers)

- **Structure: persistent farm hub + roguelike runs** (Hades model). Runs are unlimited — "play over and over as much as you want" (Wyatt).
- **Four worlds**, each with its own weirdo bestiary, duck boss, look, and music. Proposed names (Hugo's call per James; **the boys may rename any of these** — offer at next round):
  1. **The Crop Kingdom** — crops world (brainstorm candidate). Duck boss: **Brownie** (earthy, brown, home turf).
  2. **Critter Meadow** — creature-taming world (the Pokémon-flavored one; original creatures, homage not trademark). Richest pet-drop tables. Duck boss: **Diver** (she guards the pond).
  3. **Bricktopia** — building-brick world (the Lego-flavored one; generic bricks). Enemies snap together from parts. Duck boss: **Harmless** — the hardest duck, because of course the one named Harmless is ("Harmless? HA!").
  4. **The Kinetic Sandbox** — finale world; home of the Kinetic Sand Monster / The Magnet Menace fight.
  - IP posture per James: small private audience, don't over-worry — original names + visual homage is the landing spot.
- **Difficulty (Wyatt's spec): harder than RL2.** He finished both prior games in days; this one should take him a long time. Implementation: fresh-profile hero winrate target **~25% (rails 20–30)** at base difficulty; maxed-farm profile ~40%; **post-win "Weirdness" ascension ladder** (W1–W10, one stacking modifier each, W10 near-unwinnable) for endless replay; the long arc = all heroes × all worlds × Barn Book 100% × ladder climbing. Meta-progression means every run advances something even at brutal winrates.
- **Pets:** roster ~12–16 v1 with rarity tiers, one equipped per run, signature-card injection + companion action. **Beating a duck boss wins that duck as a super-pet** (approved).
- **Duck art: no photos available** — best-effort from breed descriptions (Diver: white, likely Appleyard · Brownie: all-brown · Harmless: black Cayuga); if photos arrive later James will say so and art regenerates.
- **A new secret exists.** Spec in CLAUDE.md §Cast. Zero visual tell (RL2 lesson: the white dot helped Wyatt find Goldie's hotspot) — an e2e audit asserts no render/DOM artifact distinguishes the trigger.
- **Delivery: ASAP.** James wants the boys to see how fast a game can be built. Same hosting as RL1/RL2 (`jmoranii.github.io`, public repo + Pages at his go).

## OPEN — good next brainstorm rounds with the boys

- Name the weirdos: each world needs ~8–12. (Aaron: "there's just a lot of weirdos" — cast them!)
- Pet roster: what else besides Bear and Rusty? Powers for each?
- Which duck guards which world, and what's each duck's fighting style? (Diver dives? Harmless is secretly the hardest?)
- What does the farm hub look like? What do you SEE when you visit the barn?
- World themes beyond the candidates (creature world, brick world, crops world) — and what makes each one weird?
- Does beating a duck boss win you that duck as a super-pet? (Hugo's pitch, unpitched to boys yet.)
