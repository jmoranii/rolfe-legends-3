// RL3 e2e smoke: title → farm → world select → hero → boon → map → fight → outcome →
// reward → map → save/reload → farm code → service worker. Drives the real UI
// headless in BOTH engines (the boys' tablets are Safari). Run:
//   python3 -m http.server 8199 &   (repo root)
//   npm i (playwright is PINNED at 1.60.0 in package.json), then:
//   node test/e2e.mjs
// WEBKIT PIN: this Mac (macOS 14) only has Playwright's frozen mac14 WebKit
// build (webkit_mac14_arm64_special-2251). playwright ≥1.61 hangs against it
// (probe: 20s+ no launch); 1.60.0 drives it fine (~2s). Do not bump playwright
// past 1.60.x on this machine. Missing-asset 404s are by-design (drop-in layers).
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { webkit, chromium } = require('playwright');

const BASE = 'http://localhost:8199';

// self-host: if nothing answers on 8199, serve the repo ourselves so the
// suite never depends on an external `python3 -m http.server` staying alive
import http from 'http';
import { readFile } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.lrc': 'text/plain' };
let ownServer = null;
try {
  await fetch(BASE, { signal: AbortSignal.timeout(1500) });
} catch {
  ownServer = http.createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, BASE).pathname);
      if (path.endsWith('/')) path += 'index.html';
      const data = await readFile(join(ROOT, path));
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end();
    }
  }).listen(8199);
  console.log('(self-hosting the repo on :8199 for this run)');
}

const results = [];
// coach tips persist until tapped (by design) and sit over the hand — dismiss
// them like a kid would before interacting
async function zapTips(page) {
  for (let i = 0; i < 4; i++) {
    if (await page.locator('.coach-bubble').count() === 0) break;
    await page.locator('.coach-bubble').first().click().catch(() => {});
    await page.waitForTimeout(420);
  }
}
function ok(cond, msg) { results.push([cond, msg]); if (!cond) console.log('  ✗', msg); }

async function runSuite(browserType, name) {
  console.log('launching', name); const browser = await browserType.launch({ timeout: 30000 }); console.log('launched', name);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); }); // 404s for not-yet-added music/art are by-design (drop-in layers)

  console.log(name || 'deep', 'goto...'); await page.goto(BASE, { waitUntil: 'load', timeout: 20000 }); console.log(name || 'deep', 'loaded');
  ok(await page.locator('.title-logo').count() === 1, `${name}: title renders`);

  // to the farm hub
  await page.locator('.btn', { hasText: 'Go to the Farm' }).click();
  ok((await page.textContent('h2')).includes('The Farm'), `${name}: farm hub renders`);
  ok((await page.locator('.subtitle').first().textContent()).includes('Farm Coins'), `${name}: coins + capacity shown`);
  await zapTips(page);

  // the barn: empty but visitable
  await page.locator('.btn', { hasText: 'Visit the Barn' }).click();
  ok((await page.textContent('h2')).includes('The Barn'), `${name}: barn renders`);
  ok(await page.locator('.goldie-gate').count() === 0, `${name}: no-tell — nothing at the gate`);
  await zapTips(page);
  await page.locator('.btn', { hasText: 'Farm' }).click();

  // the shop: Aaron's two tracks on the shelf
  await zapTips(page);
  await page.locator('.btn', { hasText: 'Farm Shop' }).click();
  ok((await page.locator('.screen').textContent()).includes('Battle Buddies'), `${name}: shop sells Battle Buddies`);
  ok((await page.locator('.screen').textContent()).includes('Barn Expansion'), `${name}: shop sells barn expansion`);
  await zapTips(page);
  await page.locator('.btn', { hasText: 'Farm' }).last().click();

  // world select: 4 worlds, only world 1 open on a fresh farm
  await zapTips(page);
  await page.locator('.btn', { hasText: 'Head out' }).click();
  ok(await page.locator('.world-card').count() === 4, `${name}: four worlds on the ladder`);
  ok(await page.locator('.world-card.world-locked').count() === 3, `${name}: worlds 2-4 locked on a fresh farm`);
  await page.locator('.world-card:not(.world-locked)').first().click();

  // hero select: ALL THREE Legends, no unlock needed
  ok(await page.locator('.hero-card').count() === 3, `${name}: three heroes offered`);

  // pick Wyatt
  await page.locator('.hero-card', { hasText: 'Wyatt' }).click();
  await page.waitForSelector('.speaker-line');
  ok((await page.textContent('h2')).includes('Coach'), `${name}: coach boon screen`);
  await page.locator('.scene-body .btn').first().click();
  // act story card interstitial
  await page.waitForSelector('.act-card');
  ok((await page.textContent('.act-card-name')).includes('CROP KINGDOM'), `${name}: world 1 story card`);
  await page.locator('.act-card .btn').click();

  // map: a real node graph — many spots, drawn edges, reachable starts pulsing
  await page.waitForSelector('.map-node');
  ok(await page.locator('.map-spot').count() >= 12, `${name}: map draws the act's node graph`);
  ok(await page.locator('.map-edges .edge').count() >= 10, `${name}: map draws edges`);
  ok(await page.locator('.map-node.reachable').count() >= 2, `${name}: multiple starting paths`);
  ok(await page.locator('.spot-boss-big').count() === 1, `${name}: boss crowns the map`);
  ok((await page.textContent('h2')).includes('Crop Kingdom'), `${name}: world 1 header`);

  // enter a reachable node (floor 1 = fight)
  await zapTips(page);
  await page.locator('.map-node').first().click();
  await page.waitForSelector('.enemy');
  await zapTips(page);
  ok(await page.locator('.enemy').count() >= 1, `${name}: combat renders enemies`);
  ok(await page.locator('.card').count() >= 5, `${name}: hand renders`);
  ok(await page.locator('.energy-orb').count() === 1, `${name}: energy orb`);
  ok(await page.locator('.intent').count() >= 1, `${name}: enemy intent telegraphed`);

  // play the whole fight via UI clicks (up to 30 turns); enemy turns are
  // sequenced with animation, so wait for END TURN to re-enable between turns
  let won = false;
  for (let turn = 0; turn < 30 && !won; turn++) {
    await zapTips(page);
    // play affordable cards while any
    for (let i = 0; i < 12; i++) {
      const modalBtn = page.locator('.modal .btn');
      if (await modalBtn.count() > 0) { await modalBtn.first().click(); continue; }
      const playable = page.locator('.card:not(.unaffordable)');
      if (await playable.count() === 0) break;
      await playable.first().click();
      // if targeting mode engaged, click first targetable enemy
      const target = page.locator('.enemy.targetable');
      if (await target.count() > 0) await target.first().click();
      await page.waitForTimeout(60);
      if (await page.locator('.endturn').count() === 0) break; // fight over
    }
    if (await page.locator('.endturn').count() === 0) break;
    const endB = page.locator('.endturn:not([disabled])');
    if (await endB.count() === 0) break;
    await endB.click();
    // let the sequenced enemy phase play out (reduced-motion beat is fast)
    for (let w = 0; w < 40; w++) {
      await page.waitForTimeout(60);
      if (await page.locator('.endturn:not([disabled])').count() > 0) break;
      if (await page.locator('.endturn').count() === 0) break;
    }
    const h2 = await page.locator('h2').first().textContent().catch(() => '');
    if (h2 && (h2.includes('Nice work') || h2.includes('rest up'))) break;
  }
  await zapTips(page);
  let outcome = await page.locator('h2').first().textContent().catch(() => '');
  const outcomeOk = outcome.includes('Nice work') || outcome.includes('rest up');
  ok(outcomeOk, `${name}: fight reaches an outcome (${outcome.trim().slice(0, 30)})`);
  if (!outcomeOk) await page.screenshot({ path: `media/shots/e2e-fail-${name}-outcome.png` }).catch(() => {});

  // Coach's victory beat: congrats + a rotating tip, then rewards
  if (outcome.includes('Nice work')) {
    ok(await page.locator('.tip-card').count() === 1, `${name}: coach serves a tip on the victory beat`);
    await zapTips(page);
    await page.locator('.btn', { hasText: 'Collect your rewards' }).click();
    await page.waitForSelector('.reward-card, .btn');
    await zapTips(page);
    outcome = await page.locator('h2').first().textContent().catch(() => '');
    ok(outcome.includes('You did it'), `${name}: rewards follow the beat`);
  }

  // reward screen: pick a card if offered
  if (outcome.includes('You did it')) {
    await zapTips(page);
    const cardPick = page.locator('.reward-card');
    if (await cardPick.count() > 0) await cardPick.first().click();
    else await page.locator('.btn', { hasText: 'Skip' }).click();
    await page.waitForSelector('.map-node');
    ok(await page.locator('.map-node').count() >= 1, `${name}: back on map after reward`);
    ok((await page.textContent('.floor-meter')).includes('Floor 1'), `${name}: floor advanced`);
    ok(await page.locator('.map-spot.current').count() === 1, `${name}: player trail marked on map`);
    // save persistence: reload → continue
    await page.reload({ waitUntil: 'load' });
    ok(await page.locator('.btn', { hasText: 'Continue' }).count() === 1, `${name}: save persists across reload`);
    await page.locator('.btn', { hasText: 'Continue' }).click();
    await page.waitForSelector('.map-node');
    ok(true, `${name}: continue restores map`);
  }

  // settings still opens cleanly (Farm Code removed Sun 2026-08-02)
  await page.locator('.pilebtn', { hasText: '⚙️' }).click();
  ok(await page.locator('.btn', { hasText: 'Farm Code' }).count() === 0, `${name}: no Farm Code in settings`);
  ok(await page.locator('.btn', { hasText: 'Abandon current run' }).count() === 1, `${name}: settings renders`);
  await page.locator('.modal-close, .modal .btn.secondary', { hasText: /home screen/i }).first().click().catch(() => {});

  // offline shell: the service worker registers
  const swReady = await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise((res) => setTimeout(() => res(false), 4000)),
    ])).catch(() => false);
  ok(swReady, `${name}: service worker registered`);

  ok(errors.length === 0, `${name}: zero console errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// full-run deep test in chromium via engine driving (fast-forward a whole game in-page)
async function deepRun() {
  const name = 'deep';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  console.log(name || 'deep', 'goto...'); await page.goto(BASE, { waitUntil: 'load', timeout: 20000 }); console.log(name || 'deep', 'loaded');
  const out = await page.evaluate(async () => {
    const { R, C } = window.__RL2;
    const { makeRng } = await import('./js/rng.js');
    // one invincible expedition through EVERY world (same engine the UI uses),
    // with a pet equipped so the companion path renders in anger
    let fights = 0, worldsBeaten = 0;
    for (let world = 1; world <= R.WORLDS; world++) {
      const run = R.newRun('aaron', 12345 + world, { world, pet: world === 1 ? 'bear' : null });
      let bossDone = false;
      let guard0 = 60;
      while (!bossDone && guard0-- > 0) {
        const opts = R.nextNodes(run);
        const node = R.enterMapNode(run, opts[0].id);
        if (['fight', 'elite', 'boss'].includes(node.type)) {
          const st = C.startCombat(run, node.enemies, makeRng(run.floor * 7 + world), { kind: node.type });
          let guard = 0;
          while (!st.over && guard++ < 50) {
            st.hero.hp = Math.max(st.hero.hp, 500); st.hero.maxHp = 500; // invincible traversal — exercising code paths
            const playable = st.hand.filter((c) => C.canPlay(st, c));
            if (playable.length) C.playCard(st, playable[0], C.livingEnemies(st)[0]);
            while (st.pendingDiscard > 0 && st.hand.length) C.resolveDiscard(st, st.hand[0]);
            if (!playable.length) C.endTurn(st);
          }
          fights++;
          run.hp = 500; run.maxHp = 500;
          if (node.type === 'boss') { bossDone = true; worldsBeaten++; }
        }
      }
    }
    return { fights, worldsBeaten };
  });
  ok(out.fights > 15, `deep run exercised ${out.fights} fights across 4 worlds`);
  ok(out.worldsBeaten === 4, 'deep run beat all four worlds');
  ok(errors.length === 0, `deep run: zero errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// Liam is a PUBLIC hero in RL3 (the boys found him in RL2 — secret's out):
// straight to combat with the diapers floating, no unlock dance
async function liamPublic() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.locator('.btn', { hasText: 'Go to the Farm' }).click();
  await zapTips(page);
  await page.locator('.btn', { hasText: 'Head out' }).click();
  await page.locator('.world-card:not(.world-locked)').first().click();
  ok(await page.locator('.hero-card', { hasText: 'Liam' }).count() === 1, 'liam: on the roster from day one');
  await page.locator('.hero-card', { hasText: 'Liam' }).click();
  await page.locator('.scene-body .btn').first().click(); // boon
  await page.waitForSelector('.act-card');
  await page.locator('.act-card .btn').click();
  await page.waitForSelector('.map-node');
  await zapTips(page);
  await page.locator('.map-node').first().click();
  await page.waitForSelector('.enemy');
  await zapTips(page);
  ok(await page.locator('.orb-row .orb').count() >= 1, 'liam: diapers float in combat (Diaper Bag)');
  await page.locator('.orb[data-orb="stinky"]').first().click();
  ok((await page.locator('.toast').first().textContent()).includes('Stinky Diaper'), 'liam: tapping a diaper explains it');
  ok(errors.length === 0, `liam: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// THE SECRET (Goldie): zero tell before the ritual, unlock after the exact
// pat sequence, Barn Book blind to her until she's home.
async function goldieRitual() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  // seed a farm with all three duck super-pets + a bystander pet
  await page.evaluate(() => {
    const farm = { v: 1, coins: 0, pets: ['brownie', 'diver', 'harmless', 'pig'], equipped: null,
      upgrades: { petBattle: false, barnTier: 0, poolTier: 0 },
      worlds: { unlocked: 4, beaten: [1, 2, 3] }, stats: { runs: 0, wins: 0, petsWon: 0, coinsEarned: 0 } };
    localStorage.setItem('rl3_farm', JSON.stringify(farm));
  });
  await page.reload({ waitUntil: 'load' });
  await page.locator('.btn', { hasText: 'Go to the Farm' }).click();
  await zapTips(page);

  // Barn Book pre-unlock: Goldie does not exist — not even as a silhouette
  await page.locator('.btn', { hasText: 'Barn Book' }).click();
  const bookText = await page.locator('.screen').textContent();
  ok(!bookText.toLowerCase().includes('goldie'), 'goldie: absent from the Barn Book pre-unlock');
  ok(!/llama/i.test(bookText), 'goldie: no llama references pre-unlock');
  await page.locator('.btn', { hasText: 'Farm' }).click();

  // the barn: no gate element exists, wrong pat orders summon nothing
  await zapTips(page);
  await page.locator('.btn', { hasText: 'Visit the Barn' }).click();
  await zapTips(page);
  ok(await page.locator('.goldie-gate').count() === 0, 'goldie: nothing at the gate before the ritual');
  const pat = async (name) => { await page.locator('.barn-pet', { hasText: name }).click(); await page.waitForTimeout(80); };
  await pat('Harmless'); await pat('Diver'); await pat('Brownie'); // reverse order — nothing
  ok(await page.locator('.goldie-gate').count() === 0, 'goldie: wrong order summons nothing');
  await pat('Brownie'); await pat('Diver'); await pat('Sir Oinks'); await pat('Harmless'); // interrupted — nothing
  ok(await page.locator('.goldie-gate').count() === 0, 'goldie: interrupted chain summons nothing');
  // the true ritual: Brownie → Diver → Harmless, uninterrupted
  await pat('Brownie'); await pat('Diver'); await pat('Harmless');
  ok(await page.locator('.goldie-gate').count() === 1, 'goldie: appears at the gate after the true ritual');
  for (let i = 0; i < 3; i++) { await page.locator('.goldie-gate').click(); await page.waitForTimeout(60); }
  ok((await page.textContent('.modal h2')).includes('GOLDIE'), 'goldie: joins on the 3rd tap');
  await page.locator('.modal .btn').click();
  ok((await page.locator('.screen').textContent()).includes('Goldie'), 'goldie: home in the barn');
  // persists + Book knows her now
  await page.reload({ waitUntil: 'load' });
  await page.locator('.btn', { hasText: 'Go to the Farm' }).click();
  await zapTips(page);
  await page.locator('.btn', { hasText: 'Barn Book' }).click();
  ok((await page.locator('.screen').textContent()).includes('Goldie'), 'goldie: in the Barn Book after unlock');
  ok(errors.length === 0, `goldie: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// credits preview: the synced-lyric ending scaffold (silent/wall-clock path)
async function creditsPreview() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/#credits-wyatt', { waitUntil: 'load' });
  await page.waitForSelector('.credits');
  ok(await page.locator('.credits-big').count() >= 1, 'credits: intro slide renders');
  ok((await page.textContent('.credits-big')).includes('WYATT'), 'credits: hero named');
  ok(await page.locator('.credits-skip').count() === 1, 'credits: skippable');
  await page.locator('.credits-skip').click();
  await page.waitForSelector('.credits-continue');
  ok((await page.textContent('.credits-crew')).includes('Uncle James'), 'credits: crew card on finale');
  await page.locator('.credits-continue').click();
  await page.waitForSelector('.title-logo');
  ok(true, 'credits: continue returns to title');
  ok(errors.length === 0, `credits: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// A flee is not a kill: the exit renders (blow-away card + counter), and a SOLO
// flee-er ends the fight through the same final-render path the Passing Squall
// uses — the fled enemy used to freeze unrendered while victory fired around it.
async function fleeExit() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => { window.__RL2.dev.start('wyatt'); window.__RL2.dev.enter('fight', ['crow_thief']); });
  await page.waitForSelector('.enemy');
  // never play a card: the Magpie mugs twice, guards, then flies off on turn 4
  for (let turn = 0; turn < 8; turn++) {
    await zapTips(page);
    const endB = page.locator('.endturn:not([disabled])');
    if (await endB.count() === 0) break;
    await endB.click();
    for (let w = 0; w < 40; w++) {
      await page.waitForTimeout(60);
      if (await page.locator('.endturn:not([disabled])').count() > 0) break;
      if (await page.locator('.endturn').count() === 0) break;
    }
    if (await page.locator('.endturn').count() === 0) break;
  }
  await zapTips(page);
  const flees = await page.evaluate(() => window.__RL2._fleesShown || 0);
  ok(flees >= 1, `flee: blow-away exit rendered (${flees}× )`);
  const h2 = await page.locator('h2').first().textContent().catch(() => '');
  ok(h2.includes('Nice work'), `flee: solo flee still lands on the victory beat (${h2.trim().slice(0, 30)})`);
  ok(errors.length === 0, `flee: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// the defeat screen: KO art slot, run recap, Coach's rotating pickup line
async function deathScreen() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => { window.__RL2.dev.start('aaron'); window.__RL2.dev.enter('defeat'); });
  await page.waitForSelector('.btn');
  ok((await page.textContent('h2')).includes('rest up'), 'defeat: header renders');
  ok(await page.locator('.ko-art').count() === 1, 'defeat: KO art slot present');
  ok((await page.textContent('.recap-line')).includes('fights won'), 'defeat: run recap shows');
  const line1 = await page.textContent('.speaker-line');
  ok(line1.includes('Coach James'), 'defeat: Coach signs the pickup line');
  // heading home settles the run: a LOST run still banks coins (progress ≠ zero)
  await page.locator('.btn', { hasText: 'Head home' }).click();
  await page.waitForSelector('.settle-lines');
  ok((await page.textContent('.settle-lines')).includes('Banked'), 'defeat: settlement banks the run');
  await page.locator('.btn', { hasText: 'Back to the Farm' }).click();
  await page.waitForSelector('h2');
  ok((await page.textContent('h2')).includes('The Farm'), 'defeat: lands back at the farm');
  // rotation: a second defeat serves a different line
  await page.evaluate(() => { window.__RL2.dev.start('aaron'); window.__RL2.dev.enter('defeat'); });
  await page.waitForSelector('.speaker-line');
  const line2 = await page.textContent('.speaker-line');
  ok(line1 !== line2, 'defeat: pickup lines rotate');
  ok(errors.length === 0, `defeat: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// THE SHED — the sand falls away and the bespoke transform sequence fires
async function magnetShed() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => { window.__RL2.dev.start('aaron', 4242, 4); window.__RL2.dev.enter('boss', ['sand_monster']); });
  await page.waitForSelector('.enemy');
  await page.evaluate(() => {
    const { C } = window.__RL2;
    C.dealDamage(window.__RL2.combat, window.__RL2.combat.enemies[0], 55, { attacker: window.__RL2.combat.hero, pierce: true });
    window.__RL2.dev.enter('refresh');
  });
  await page.waitForTimeout(400);
  const reforms = await page.evaluate(() => window.__RL2._reforms || 0);
  ok(reforms >= 1, `magnet: the sand-shed transform sequence fired (${reforms})`);
  ok((await page.textContent('.enemy .nm')).includes('MAGNET'), 'magnet: THE MAGNET named on the card');
  const intent = await page.textContent('.enemy .intent').catch(() => '');
  ok(/HELPLESS/i.test(intent), 'magnet: the helpless window is telegraphed');
  ok(errors.length === 0, `magnet: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// event outcomes re-render the HP/gold strip (it used to go stale after apply)
async function eventStatTick() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.__RL2.dev.start('aaron');
    window.__RL2.run.hp = 40;
    window.__RL2.dev.enter('event', 'care_package');
  });
  await page.waitForSelector('.event-choices .btn');
  ok((await page.textContent('.stat-hp')).includes('40/80'), 'event: strip shows pre-choice HP');
  await page.locator('.event-choices .btn', { hasText: 'sandwich' }).click();
  await page.waitForSelector('.event-result');
  const { hp, text } = await page.evaluate(() => ({
    hp: window.__RL2.run.hp, text: document.querySelector('.stat-hp').textContent,
  }));
  ok(hp === 56, `event: sandwich healed 20% (hp ${hp})`);
  ok(text.includes('56/80'), `event: strip re-rendered to healed HP (${text.trim()})`);
  ok(errors.length === 0, `event: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// Aaron's Big Breakfast banner on the reward screen
async function bigBreakfastBeat() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.__RL2.dev.start('aaron');
    window.__RL2.run.hp = 40;
    window.__RL2.dev.enter('fight', ['corn_colonel']);
  });
  await page.waitForSelector('.enemy');
  await page.evaluate(() => {
    const { C } = window.__RL2;
    C.dealDamage(window.__RL2.combat, window.__RL2.combat.enemies[0], 999, { attacker: window.__RL2.combat.hero });
    window.__RL2.dev.enter('refresh');
  });
  await page.waitForSelector('h2:has-text("Nice work")', { timeout: 8000 });
  await page.locator('.btn').first().click();
  await page.waitForSelector('.bf-banner');
  const banner = await page.textContent('.bf-banner');
  ok(banner.includes('Big Breakfast') && banner.includes('+8'), `reward: Big Breakfast banner shows the heal (${banner.trim()})`);
  ok(errors.length === 0, `reward: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

// the ⛶ fullscreen button (for browsers with no install path, e.g. Amazon Kids)
async function fullscreenButton() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('.title-logo');
  ok(await page.locator('.fs-btn').count() === 1, 'fs: ⛶ button on the title screen');
  await page.locator('.fs-btn').click();
  await page.waitForTimeout(250);
  const active = await page.evaluate(() => !!document.fullscreenElement);
  ok(active, 'fs: click enters fullscreen');
  await page.locator('.btn', { hasText: 'Settings' }).click();
  await page.waitForSelector('.fs-toggle');
  ok((await page.textContent('.fs-toggle')).includes('ON'), 'fs: settings toggle reflects state');
  ok(errors.length === 0, `fs: zero page errors${errors.length ? ' — ' + errors[0].slice(0, 120) : ''}`);
  await browser.close();
}

try {
  await runSuite(chromium, 'chromium');
  await runSuite(webkit, 'webkit');
  await liamPublic();
  await goldieRitual();
  await creditsPreview();
  await fleeExit();
  await deathScreen();
  await magnetShed();
  await eventStatTick();
  await bigBreakfastBeat();
  await fullscreenButton();
  await deepRun();
} catch (e) {
  ok(false, 'suite crashed: ' + e.message);
}
if (ownServer) ownServer.close();
const pass = results.filter(([c]) => c).length;
console.log(`\ne2e: ${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
