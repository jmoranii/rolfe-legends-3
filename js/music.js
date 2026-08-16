// Rolfe Legends 2 — background music. Looping tracks with crossfade, separate from SFX.
// Tracks live at assets/audio/<name>.mp3. Missing files no-op gracefully (drop-in like art).
// Browser autoplay policy: nothing plays until unlock() is called from a user gesture.

const TRACKS = ['title', 'map1', 'map2', 'map3', 'battle', 'elite', 'boss', 'victory', 'anthem_wyatt', 'anthem_aaron', 'anthem_liam', 'anthem_both'];
const VOL = 0.45;            // music sits under SFX
const FADE_MS = 600;

let enabled = true;
let unlocked = false;
let started = false;         // has a track actually begun audible playback?
let current = null;          // track name currently desired
const els = new Map();       // name -> {audio}
const missing = new Set();   // names whose file 404'd — never retry

const GESTURES = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'];
function onGesture() { unlock(); }

// Arm autoplay-unlock: any user gesture tries to start music, and the listeners
// STAY until playback actually succeeds (handles Safari/Chrome rejecting the
// first attempt). Idempotent.
export function arm() {
  for (const g of GESTURES) window.addEventListener(g, onGesture, { capture: true, passive: true });
}
function disarm() {
  for (const g of GESTURES) window.removeEventListener(g, onGesture, { capture: true });
}

export function setEnabled(on) {
  enabled = on;
  if (!on) stopAll();
  else { arm(); if (unlocked && current) play(current); }
}
export function isEnabled() { return enabled; }

// Mark unlocked and attempt the current track. Safe to call repeatedly.
export function unlock() {
  unlocked = true;
  if (enabled && current) play(current);
}

function getEl(name) {
  if (missing.has(name)) return null;
  let e = els.get(name);
  if (!e) {
    const audio = new Audio(`assets/audio/${name}.mp3`);
    audio.loop = !name.startsWith('anthem_') && name !== 'victory'; // anthems + the victory sting play once
    audio.preload = 'auto';
    audio.volume = 0;
    audio.dataset.track = name;
    audio.addEventListener('error', () => { missing.add(name); els.delete(name); audio.remove(); }, { once: true });
    if (document.body) document.body.appendChild(audio); // inspectable + helps some browsers
    e = { audio };
    els.set(name, e);
  }
  return e;
}

function fade(audio, to, ms, onDone) {
  const from = audio.volume;
  const start = performance.now ? performance.now() : 0;
  // performance.now is fine in browsers; tests don't import this module
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) requestAnimationFrame(step);
    else if (onDone) onDone();
  };
  requestAnimationFrame(step);
}

// Public: request a track. Crossfades from whatever's playing. Unknown/missing → silence.
export function play(name) {
  if (!TRACKS.includes(name)) name = null;
  current = name;
  if (!enabled || !unlocked) return;     // remembered; starts on unlock
  // fade out everything that isn't the target
  for (const [n, e] of els) {
    if (n !== name && !e.audio.paused) fade(e.audio, 0, FADE_MS, () => e.audio.pause());
  }
  if (!name) return;
  const e = getEl(name);
  if (!e) return;                        // file missing → silence, no error
  const p = e.audio.play();
  if (p && p.then) {
    p.then(() => { started = true; disarm(); fade(e.audio, VOL, FADE_MS); })
     .catch(() => { /* autoplay still blocked → armed listeners retry on next gesture */ });
  } else {                               // older browsers: no promise returned
    started = true; disarm(); fade(e.audio, VOL, FADE_MS);
  }
}

export function stopAll() {
  for (const [, e] of els) { if (!e.audio.paused) { e.audio.pause(); e.audio.volume = 0; } }
}
