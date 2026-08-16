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
