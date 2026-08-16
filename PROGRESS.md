# PROGRESS.md — Rolfe Legends 3: World of Weirdos

## 2026-08-16 · Phase 0 — Chassis port (DONE)

- Full RL2 codebase ported (engine, run layer, map, harness, tips, music/credits/prefetch/farmcode/sfx, e2e rig with the playwright 1.60.0 WebKit pin). RL2 *content* (cards/enemies/events/relics) rides along temporarily as scaffolding — it gets replaced module-by-module as RL3 content lands (Phases 1–2), and its tests keep the chassis honest meanwhile.
- **No-tell canon enforced day one**: RL2's secret-hotspot beacon dot (the white dot that helped Wyatt find Goldie) and the `cursor: pointer` affordance are REMOVED; the e2e assertion is inverted — it now fails if the hotspot renders ANY visual tell (dot, cursor). This audit pattern extends to the RL3 secret when it lands.
- Anthem LRC audit self-arms: skips while no `.lrc` captures exist, re-arms when RL3 anthems land.
- Assets not ported (RL2's art/music stay in RL2); `assets/` scaffolding created; emoji/silence fallbacks active everywhere.
- **Tests: unit 1371/1371 · e2e 90/90 in BOTH Chromium + WebKit · selfplay 150/hero ALL CLEAR** (RL2 hard-mode band — retuning to RL3's 20–30 fresh band happens in Phase 3).
- Build is running IN-CHAT with James + the boys (James's call — no separate /goal session); same ground rules.

**Next**: Phase 1 — the farm meta-layer: profile schema v2 (pets/barn/shop/world unlocks), the Farm hub screen, pet system (companion + signature-card injection), Barn Book, shop tracks, fish pool.
