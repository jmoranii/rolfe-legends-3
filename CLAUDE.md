# Rolfe Legends 3: World of Weirdos

The third Rolfe Legends game — and the first one **co-designed with the boys**. Wyatt (10) and Aaron (8) pitched the core ideas themselves in a live brainstorm with James (Sun 2026-08-16, all three in the room): pets won from battles, a barn and shop that grow, themed worlds full of weirdos, their real ducks as bosses, and a two-phase Kinetic Sand Monster finale. RL1 and RL2 were gifts built *for* them; RL3 is built *with* them — honor their ideas as design requirements, not suggestions.

## The one-sentence vision

A kid fights weirdos across strange worlds, wins pets who battle beside him and grow his barn back home, and every run makes the farm — and the kid — a little stronger.

## Design pillars (check every decision against these)

1. **The boys' ideas are load-bearing.** The pet-drop loop, barn capacity 5, the shop's two upgrade tracks, per-world duck bosses, the magnet stagger window, the victory song — these came from Wyatt and Aaron directly and ship as designed unless James says otherwise. When implementation forces a change, log it in REVIEW.md with the kid-credited original.
2. **StS chassis, RL2 codebase.** Card combat stays the proven RL2 engine (flat 3⚡, intents, StS-scale numbers, seeded RNG, pure logic layer). Steal from our own repo first: `~/code/rolfe-legends-2` (engine, harness, tests, music.js, credits.js, farmcode.js, sw.js, prefetch.js are all ours and all proven).
3. **New layer: the persistent farm.** Runs are roguelike; the FARM endures between them (Hades model — see INSPIRATION.md). Pets, barn, shop, world unlocks persist. A lost run that won a pet still moved you forward.
4. **Kid-fair, not kid-easy.** Intents telegraphed, deaths earned, real status names. RL2 shipped at ~30% winrate hard mode and the boys beat it — respect their skill.
5. **RL2-final is the polish FLOOR.** Every screen ships at the quality RL2 reached *after* its ~20 playtest rounds, not before. The distilled checklist lives in GOAL.md §Polish floor; treat it as acceptance criteria, not aspiration.
6. **Durable + frictionless.** Vanilla HTML/CSS/JS, no build step, no server, localStorage + Farm Code saves, offline PWA, hosted under `jmoranii.github.io` (the parental-controls-approved origin).
7. **Tested, not hoped.** Unit tests + selfplay harness green before every commit. The harness must genuinely model pets (companion actions + injected cards) or its numbers are fiction — RL2's "harness fidelity" lesson.

## Hard content rules

- **Never a curse/status named "Chores."** Chores are never framed as bad. (Household norm; RL1/RL2 canon.)
- First names / family nicknames only; no surnames, no birthdates, no real place names beyond "the farm." Grandparents are **Poppa Flaj** and **Granny Rockie**.
- **The ducks are beloved real pets** — Diver, Brownie, and Harmless are Wyatt's actual ducks. Boss fights against them are mischief/comedy ("gone rogue," a duck tantrum), never harm: no HP-drain gore framing, and a defeated duck is *calmed down*, not hurt.
- **No trademarked worlds.** The boys pitched "Pokémon" and "Lego" worlds; this repo ships original reskins only (creature-taming world, building-brick world — final names per James). Nothing that would trip IP on a public Pages site.
- Family cameo dialogue is James-approved before ship. Any secret hero/content stays **zero-hint** (RL1/RL2 canon — no silhouettes, no teases).
- Aaron's exhaust/self-cost framing stays "effort," not pain.

## Cast (locked so far)

- **Heroes:** Wyatt the Speedy · Aaron the Strong · **Liam the Little** — all three from RL2, openly playable this time (Liam's secret is out; the boys found him. Whether RL3 gets a NEW secret is an open James question).
- **Duck bosses:** **Diver** (white duck — breed unverified, likely Appleyard) · **Brownie** (all-brown, adopted) · **Harmless** (black Cayuga) — one per world.
- **Final boss:** **The Kinetic Sand Monster** ("The Magnet Menace") — limbs detach and fight, defeated limbs re-merge, cleared sand exposes the magnet core: 50-damage magnet throws, ~100 HP, one-turn stagger window after 50 damage knocks the sand off.
- **Pets (battle companions):** Bear (Wyatt's pick — Claw Scratch, 2 hits × 6) · **Rusty** (Aaron's pick — the real dog, promoted from RL2 treasure-fetcher) · full roster TBD in design.
- **Family helpers return** per RL2 canon (shop, rest, boon, events) — exact roles TBD in DESIGN.md.

## Conventions

- Stack: HTML5 + CSS3 + vanilla JS ES modules, zero dependencies, no build.
- Pure logic (`js/combat.js`, `js/run.js`, `js/farm.js`, `js/rng.js` — no DOM) / data (`js/cards.js`, `js/enemies.js`, `js/pets.js`, `js/relics.js`, `js/events.js`) / render (`js/game.js`).
- Tests: `node test/test.mjs` + `node test/selfplay.mjs <n>` (n must be numeric and >0 — the harness refuses vacuous runs; RL2 lesson) + Playwright e2e in Chromium AND WebKit (**pin playwright 1.60.0** — this Mac's frozen mac14 WebKit build hangs on newer; RL2 lesson, do not bump).
- Art: gpt-image CLI, codex backend, **storybook gouache** (RL1/RL2 style block verbatim); emoji fallback always; PNGs drop in with no code changes. Family likenesses: official OpenAI endpoints only.
- Music: **suno-auto only** (never bare `suno generate`), **take 1 kept**, `.lrc` word timings for anthems, silence fallback.
- Seeded RNG everywhere in logic; reproducible runs.

## Privacy & publishing

Local git only until James says otherwise. Never push to any remote, never deploy — publish/Pages is James's phase, per-project go (RL1/RL2 precedent). Reference photos are gitignored and never committed.
