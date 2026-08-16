# GOAL: Build Rolfe Legends 3: World of Weirdos to RL2-final quality — autonomously

> **STATUS: DRAFT — do not execute yet.** Gated on James's answers to REVIEW.md §Open questions (structure, world roster, asset asks). When James de-drafts this file and runs /goal, everything below is live.

You are working in `~/code/rolfe-legends-3`. Read `CLAUDE.md` (constitution) and `DESIGN.md` (locked design) first; they override this file on conflict. `INSPIRATION.md` holds the sanctioned steal list — when a mechanic choice is ambiguous, resolve it by asking *what does the inspiration game do, and why did that feel good?*, then port the why. Your goal: phases 0–6 below to shippable quality. **Phase 7 (publish/deploy) is James's — never push to a remote or deploy anywhere.**

## What's different from RL2's goal run

1. **The boys are co-designers.** Their mechanics (DESIGN.md §Locked, all kid-credited) are requirements. Deviations go to REVIEW.md with the original idea quoted.
2. **Polish ships in the first pass.** RL2's GOAL produced a great skeleton that then took ~20 James-playtest rounds to reach final quality. Those rounds are now a written standard — §Polish floor below is **acceptance criteria for phases 1–3**, not a later phase. Budget real effort there; it's most of what "done" means this time.
3. **The farm meta-layer is new engineering.** Persistence across runs (pets, barn, shop, world unlocks) has no RL2 precedent — design its save schema carefully (versioned, Farm-Code-portable, forward-migratable) before building on it.

## Non-negotiable ground rules (RL2's, carried forward)

1. **Green before every commit**: `node test/test.mjs` + `node test/selfplay.mjs 150` + e2e (both engines). Never commit red. Granular commits, clear messages.
2. **Content rules in CLAUDE.md hold absolutely** — ducks fought as comedy and calmed not harmed; no trademarked world content; no "Chores"; first names only; secrets (if any) zero-hint.
3. **Anything needing James's judgment → REVIEW.md**: cameo dialogue, pet quirk lines, anthem lyrics, art rerolls you're unsure of, any design deviation, anything a kid pitched that you changed. Best call now, log for his pass — don't block.
4. **Reference photos**: reuse `~/code/rolfe-legends-2/assets/ref-photos/` + RL2's finished art for returning characters (heroes, family, Rusty, Goldie). Gitignored, never committed. Missing references (duck photos, recent Liam) → best-effort + REVIEW.md Gaps report.
5. **Keep PROGRESS.md** current every commit: phase, done, next, harness numbers, rubric grades.
6. **Harness fidelity is a rail**: any new mechanic (pets, stagger, limb fights, meta-currency) must be genuinely modeled by the selfplay bot before its balance numbers count. The harness refuses non-numeric/zero run counts (RL2's vacuous-green lesson).

## Phase 0 — Chassis port

Fork the RL2 codebase patterns into this repo (fresh git history, no RL2 remote): engine, run layer, harness, test rig, music/prefetch/credits/farmcode/sw modules, e2e scaffolding with the 1.60.0 playwright pin. Strip RL2 content (cards/enemies/events stay as reference in git history only). Rename what needs renaming. Everything green empty before content lands.

## Phase 1 — The farm meta-layer (the new heart)

- **The Farm hub screen**: home base between runs (Hades model). Barn with visible pets (tap to pat — no effect, mandatory), the Barn Book collection screen (silhouettes for unmet pets), shop, world-select gate.
- **Pet system**: pets won by random drop chance after victories (droppable per-world tables, rarity tiers); barn capacity starts at **5**; equipped pet joins fights as a **Wildfrost-style companion** (own little action each turn) AND **injects its signature cards** into your deck for the run (Wyatt's bear-card mechanic — Bear: Claw Scratch, 2 hits × 6). One equipped pet per run in v1.
- **Shop (Aaron's two tracks)**: meta-currency banked across runs buys (a) barn capacity upgrades, (b) the pets-fight-with-you unlock, then per-pet or per-slot extensions. Priced so a lost run still buys something small — progress is never zero.
- **Persistence**: versioned profile schema covering pets/barn/shop/world unlocks; Farm Code (RL2's) extended to carry it; unit-tested round-trip + migration.

## Phase 2 — Worlds & content

- **World ladder**: themed worlds, each with its own weirdo bestiary (~8–12 enemies, StS-mechanic-mirrored like RL2's), map backdrop, music, and **duck boss** (Diver / Brownie / Harmless — comedy framing, calmed not harmed). Winning a world unlocks the next ("the more worlds you get to, the more good things unlock" — also: better pet drop tables deeper in).
- **World themes**: per DESIGN.md once locked (candidates from the brainstorm: creature-taming world, building-brick world, crops world — original reskins only).
- **The finale: The Magnet Menace.** The Kinetic Sand Monster exactly as the boys designed it: limbs knock off and become separate enemies; defeated limbs sink back in; all limbs cleared → the sand body; **50 damage to the body sheds all sand** → the magnet core lies **helpless for exactly one turn** (stagger window) → magnet has **~100 HP** and throws **50-damage magnets** when active (if 50 proves untunable, keep it as big as the band allows — 20–40 — and log the number story in REVIEW.md). Foreshadow the stagger mechanic on one earlier enemy per world.
- Family helper stations, events, relics: RL2 canon adapted; new dialogue → REVIEW.md.

## Phase 3 — Balance

- Harness models pets (companion actions + injected cards + drop economy) and the meta-layer (fresh-profile and maxed-profile lanes measured separately).
- Hero parity band and per-world difficulty ramp per DESIGN.md targets (James sets the winrate target — see REVIEW.md question; RL2 ended at ~30% hard mode by his call).
- Fight pacing rails: normals 3–6, elites 6–10, bosses 8–14 avg turns; Magnet Menace may run longer but must not stall.
- Rails tightened to targets so regressions fail loudly.

## Phase 4 — Art pass (gpt-image, codex backend, storybook gouache)

Reuse RL2 art where the same character/scene returns. New deliverables, every hook filled, emoji fallback intact: 3 hero portraits (reuse), **full pet roster** (portrait + in-fight sprite each), 3 duck bosses (from real duck photos if supplied — else best-effort from breed + REVIEW.md gap), per-world enemy casts, per-world map + battle backdrops, farm hub scene (barn with pets visible), shop + helper scenes, Kinetic Sand Monster (body / limb / staggered-magnet phases), title art (Goldie tradition — placement per DESIGN.md), app icon. Batch with retries; codex stalls are normal; reroll only clear failures.

## Phase 5 — Music & endings (suno-auto, take 1 kept)

Track list (~14): `title`, `farm` (the hub deserves its own theme), per-world map themes, `battle`, `elite`, `duckboss` (comedy-menace), `finalboss`, `victory` sting, anthems: `anthem_wyatt`, `anthem_aaron`, `anthem_liam`, `anthem_all` (all-three finale — the boys' locked requirement: "get a song like the other two games"). Word-level `.lrc` for all anthems; synced-lyric credits via RL2's credits.js (portrait beats derived from lyrics); pronunciation remaps as needed (RL2: "Whyatt"/"Leeum"). Anthem lyric drafts → REVIEW.md.

## Phase 6 — Ship hardening

Offline sw (RL2 pattern), predictive prefetch bundles (title→world-1, hub→current-world), 128kbps audio pass, PWA manifest + A2HS, Farm Code UI, screen wake lock, landscape layouts, WebKit e2e full suite (1.60.0 pin), every-screen smoke screenshots into PROGRESS.md.

## Polish floor — RL2's post-ship rounds, now first-pass acceptance criteria

Distilled from `~/code/rolfe-legends-2/PROGRESS.md` (2026-08-01 → 2026-08-02). Every item verified before phases 1–3 are called done:

1. **The 13-point StS legibility audit** (RL2's table, port it item-for-item): tap-to-explain intents with live damage ×N, tap-to-explain status chips, 📖 how-to-read modal, green/red modified card values, cost-badged mini-cards everywhere cards appear, inspectable draw/discard/exhaust piles, per-hit staggered floaties on multi-hits, boss/elite ribbons + auras, self-identifying map nodes, prominent energy orb, END TURN → ENEMY TURN state flip.
2. **Cause-and-effect card feel**: played cards fly to their target, per-card-family sounds, per-hit sounds synced to per-hit floaties, big-hit impact pops; **SLOW & CLEAR default animation pacing with a Settings FAST toggle** (one `--fx` knob); `prefers-reduced-motion` wins.
3. **Sequenced enemy turns** with lunge/floaties/shake/death — and **flee ≠ death** (distinct exit animations; end-of-fight renders even mid-enemy-phase).
4. **Victory beats**: fight wins fade into a Coach James beat with a rotating tip library (per-hero tips only for that hero; zero secret leaks); boss wins get the big splash + treasure reveal popups.
5. **Nothing invisible**: active powers as tappable chips on the hero strip, auto-effects announce themselves with floaties, junk-card shoves toast what+where, elite drops get full reveal popups. New-for-RL3: **pet actions must be as legible as enemy intents** — the pet telegraphs what it will do.
6. **Decision support**: every stop screen (shop/rest/event/boon/world-select) shows HP · currency · a My Deck browser — and in RL3, the equipped pet.
7. **Scene banners**: family/helper art IS the screen header, in-scene doing the thing, not a thumbnail.
8. **Story connective tissue**: act/world story-card interstitials (copy → REVIEW.md), adapted per world.
9. **Ship-quality plumbing from day one**: screen wake lock during fights/credits, art fallback self-heals (12s retry, no session-pinned emoji), landscape layouts, e2e self-hosts its server and dismisses coach bubbles at seams, failure screenshots on outcome asserts.
10. **Credits robustness**: karaoke indices recompute from scratch every frame (RL2's desync lesson), staged intro, skip button, silent/offline fallback.

## The quality rubric — the StS bar, RL3 edition

RL2's eight rubric items all still apply (solvable turns, real path dilemmas, deck identity by mid-run, escalating power fantasy, paid-for risk, fights end before boring, fairness on screen, runs tell stories). Grade honestly in PROGRESS.md at each phase end; ✗ = remaining work. Add two RL3-specific items:

9. **Pets earn their slot.** An equipped pet visibly changes how a run plays (cards + companion action), and kids argue about which pet is best. If harness win deltas between pets are near-zero, pets are decoration — fix it.
10. **The farm pulls you back.** After a loss, the next click should feel obvious and good: bank the coins, check the barn, buy something, go again. If a lost run advances nothing, the meta-layer is mistuned.

## Definition of done

Phases 0–6 complete; polish floor fully verified; heroes in the target band on fresh AND maxed profiles; unit + selfplay + dual-engine e2e green; art and music present for every hook; REVIEW.md contains: the Gaps & Personalization report (duck photos, recent Liam photo, boys' voice lines — what shipped instead, what input is wanted, what gets regenerated), all dialogue/lyric drafts for James's pass, kid-credited deviations, and the publish checklist. Stop there — Phase 7 is James's.
