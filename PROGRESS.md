# PROGRESS.md — Rolfe Legends 3: World of Weirdos

## 2026-08-16 · Phase 0 — Chassis port (DONE)

- Full RL2 codebase ported (engine, run layer, map, harness, tips, music/credits/prefetch/farmcode/sfx, e2e rig with the playwright 1.60.0 WebKit pin). RL2 *content* (cards/enemies/events/relics) rides along temporarily as scaffolding — it gets replaced module-by-module as RL3 content lands (Phases 1–2), and its tests keep the chassis honest meanwhile.
- **No-tell canon enforced day one**: RL2's secret-hotspot beacon dot (the white dot that helped Wyatt find Goldie) and the `cursor: pointer` affordance are REMOVED; the e2e assertion is inverted — it now fails if the hotspot renders ANY visual tell (dot, cursor). This audit pattern extends to the RL3 secret when it lands.
- Anthem LRC audit self-arms: skips while no `.lrc` captures exist, re-arms when RL3 anthems land.
- Assets not ported (RL2's art/music stay in RL2); `assets/` scaffolding created; emoji/silence fallbacks active everywhere.
- **Tests: unit 1371/1371 · e2e 90/90 in BOTH Chromium + WebKit · selfplay 150/hero ALL CLEAR** (RL2 hard-mode band — retuning to RL3's 20–30 fresh band happens in Phase 3).
- Build is running IN-CHAT with James + the boys (James's call — no separate /goal session); same ground rules.

**Next**: Phase 1 — the farm meta-layer: profile schema v2 (pets/barn/shop/world unlocks), the Farm hub screen, pet system (companion + signature-card injection), Barn Book, shop tracks, fish pool.

## 2026-08-16 · Phase 1a+1b — Pet engine + farm meta-layer (PURE LAYERS DONE)

**Pets (js/pets.js + engine hooks)** — 18-pet roster: 5 common (Sir Oinks 🐷, Nugget 🐔, Whiskers 🐱, Biscuit 🐶, Bubbles 🐠), 6 uncommon (Patch, Boomer, Bandit Jr., Professor Hoot, Ramona, Mudwhisker), 2 rare (**Bruno the bear** — Wyatt's spec, hands you a Claw Scratch 2×6 EVERY turn instead of decking a card; **Rusty** — Aaron's pick, turn-1 fetch draws 2), legendary **Zorp the alien** (~1/150 wins — "really really really rare"), 3 duck super-pets (boss-only: Diver/Brownie/Harmless), + the secret (spec in CLAUDE.md). Companions act on deterministic cadences at hero-turn start with intent text (legibility canon); signature cards inject at run start, hero:'pet' keeps them out of every draft pool. Drop rolls: fight 12% / elite 30% / boss 40%, rarity-weighted, dedupe vs farm+run. New engine ops: heal, gold, pierce; `mystery_waddle` special. Run save v3 (+v2 migration).

**Farm (js/farm.js)** — persistent profile: coins bank at run end **win or lose**, pets move into barn (cap 5, +3/tier) or fish pool (cap 3, +2/tier — the boys' realism spec), shop = Aaron's two tracks (Battle Buddies 250 / barn expansions 150→800) + pool upgrades, equip gating, world ladder (beat world N's duck → N+1 opens), forward-safe deserialization.

**Tests: unit 1688/1688 green · selfplay ALL CLEAR** (petless lanes unchanged).

**Next**: Phase 1c — the Farm hub UI in game.js: farm screen (barn + pool with pats), Barn Book, shop screen, equip picker, run-end settlement flow ("banked 87 coins, Whiskers moved in!"). Then harness pet-lane modeling.

## 2026-08-16 · Stage A — THE RL3 GAME LOOP IS ALIVE (Phase 1 complete)

- **Full new flow shipped**: title → **Farm hub** (coins, equipped buddy) → Barn (pats! fish pool! a certain ritual…) → Barn Book (silhouette collection) → Farm Shop (Battle Buddies · barn/pool expansions) → world select (4-world ladder, locks) → hero select (all three Legends public) → boon → 12-floor world expedition → duck-boss splash → **settlement** (coins bank + pets move in, win OR lose) → back to the farm. World 4 boss → anthem credits (settles BEFORE the roll — closing mid-anthem can't lose progress).
- **Pets fight visibly**: battle-buddy chip with intent text ("Every 3rd turn: … — in 2 turns"), proc jiggle + name floaty per action, Mystery gift floaties. Legibility canon extended to pets.
- **Run = one world** (`run.act` = world number; act-N theming maps 1:1). advanceAct deleted; run save v3.
- **Storage keys rl3_*** — RL2 and RL3 share the jmoranii.github.io origin, and localStorage is per-origin: reusing rl2_* keys would have corrupted BOTH games' saves. Caught before first deploy.
- **The secret is live** (spec in CLAUDE.md §Cast): e2e proves zero pre-unlock tell (no gate element, no Book entry, no llama string), wrong/interrupted pat orders summon nothing, the true ritual works, unlock persists. RL2's beacon dot is gone; its e2e assertion is INVERTED.
- **Music: 12/15 tracks generated + downloaded** (title, farm, map1-3, elite, duckboss, finalboss + all four anthems — take 1, new download policy); map4/battle/victory retrying (captcha transients, 0 credits).
- Selfplay: per-world sweep on provisional Stage-A rails (W1 ~96% / W2-4 ~0% with borrowed RL2 pools — exactly why Stage B rewrites the bestiary per world).
- **Tests: unit 1698/1698 · e2e 113/113 both engines.**

**Next**: Stage B — the World-of-Weirdos bestiary: 4 world casts with world-scaled stats, 3 duck bosses with personality mechanics, THE KINETIC SAND MONSTER (limbs → shed → helpless magnet), stagger foreshadowing, Weirdness ladder. Then Phase 3 balance to the 20–30 fresh band.

## 2026-08-16 · Stage B/C — bestiary, balance, ladder, music, art, LIVE ON GITHUB

- **The World of Weirdos bestiary**: 34 new enemies in 4 world casts (all StS mirrors), 3 duck bosses with personalities, THE KINETIC SAND MONSTER exactly to the boys' spec (limbs sink back as armor · 50 dmg sheds the sand · Magnet helpless 1 turn at 100 HP · MAGNET THROW = 50, windup-telegraphed). Squish Ball previews the stagger. 68 scout reports.
- **Balance (4 rounds + parity dials)**: fresh W1 ~65 / W2-3 ~35-40 / W4 ~5; buddy lane W4 ~20 (the endgame gate). Wyatt HP 51→64, Liam 76→62. Rails locked; deviation from GOAL's flat band logged in REVIEW.md.
- **Weirdness ladder W1-10**: +7% HP/+5% dmg per level, opens at first Magnet fall, per-world bests on the world cards.
- **Music COMPLETE**: 15 Suno tracks deployed at 128kbps + 4 word-level LRC karaoke anthems (take 1, new download policy). Victory sting 4.7s. Anthem audit green incl. the no-secret-beat check.
- **Art**: title/farm/barn/pets(18)/maps/battles/actcards deployed; enemy batch generating. scene-bg layer bug found+fixed in live browser smoke.
- **Visual smoke PASSED** (title art with all four worlds; farm hub with pond; stocked barn; combat with Bruno's chip + handed Claw Scratch; karaoke rolling on the real anthem).
- **PUBLISHED**: public repo jmoranii/rolfe-legends-3, Pages live at https://jmoranii.github.io/rolfe-legends-3/ (enemy art follows when the batch lands).
- **Tests: 1808 unit · 114/114 e2e both engines · selfplay ALL CLEAR on shipped bands.**
