// Rolfe Legends 2 — Slay-the-Spire-style act map generator (pure, no DOM).
// A per-act node graph climbing bottom-to-top: 12 floors, 2–4 nodes per floor,
// branching/merging paths, non-crossing edges, seeded + deterministic.
//
// Layout mirrors StS: floor 1 = fights, a fixed mid-act treasure row (Rusty),
// rest row before the boss, elites only past the early floors, exactly one shop
// per act, a scattered optional mid-rest, events sprinkled through the rest.
// JSON-serializable (lives inside the saved run).

import { makeRng } from './rng.js';

export const MAP_FLOORS = 12;      // boss floor
export const MAP_COLS = 4;         // columns 0..3
export const TREASURE_FLOOR = 6;   // Rusty row (every path passes exactly one)
export const REST_FLOOR = 11;      // Granny's porch before the boss
export const BOSS_ID = 'boss';

const WALKS = 6;                   // StS generates 6 path walks

export function generateActMap(seed, act) {
  const rng = makeRng((seed ^ Math.imul(act, 0x9E3779B9)) >>> 0);
  // 1) random path walks from floor 1 to floor 10
  const nodeSet = new Set();       // "f-c"
  const edgeSet = new Set();       // "f-c>f-c"
  const starts = [];
  for (let w = 0; w < WALKS; w++) {
    let c = rng.int(MAP_COLS);
    if (w === 1) {                 // StS rule: first two walks start apart
      let guard = 8;
      while (c === starts[0] && guard-- > 0) c = rng.int(MAP_COLS);
    }
    starts.push(c);
    nodeSet.add(`1-${c}`);
    for (let f = 1; f < REST_FLOOR - 1; f++) {
      const step = rng.int(3) - 1;
      const nc = Math.max(0, Math.min(MAP_COLS - 1, c + step));
      nodeSet.add(`${f + 1}-${nc}`);
      edgeSet.add(`${f}-${c}>${f + 1}-${nc}`);
      c = nc;
    }
  }
  // 2) planarize each floor transition: re-pair sorted froms with sorted tos
  const edges = {};                // id -> [ids] (sorted, deduped)
  const addEdge = (a, b) => {
    (edges[a] || (edges[a] = [])).includes(b) || edges[a].push(b);
  };
  for (let f = 1; f < REST_FLOOR - 1; f++) {
    const pairs = [...edgeSet]
      .map((s) => s.split('>'))
      .filter(([a]) => Number(a.split('-')[0]) === f);
    const froms = pairs.map(([a]) => Number(a.split('-')[1])).sort((x, y) => x - y);
    const tos = pairs.map(([, b]) => Number(b.split('-')[1])).sort((x, y) => x - y);
    for (let i = 0; i < froms.length; i++) addEdge(`${f}-${froms[i]}`, `${f + 1}-${tos[i]}`);
  }
  // 3) rest row + boss: every floor-10 node climbs straight to a rest, all rests → boss
  const nodes = {};
  for (const id of nodeSet) {
    const [f, c] = id.split('-').map(Number);
    nodes[id] = { f, c, type: 'fight' };
  }
  for (const id of Object.keys(nodes)) {
    if (nodes[id].f !== REST_FLOOR - 1) continue;
    const restId = `${REST_FLOOR}-${nodes[id].c}`;
    if (!nodes[restId]) nodes[restId] = { f: REST_FLOOR, c: nodes[id].c, type: 'rest' };
    addEdge(id, restId);
    addEdge(restId, BOSS_ID);
  }
  nodes[BOSS_ID] = { f: MAP_FLOORS, c: (MAP_COLS - 1) / 2, type: 'boss' };

  // 4) type assignment
  const byFloor = (f) => Object.keys(nodes).filter((id) => nodes[id].f === f);
  for (const id of byFloor(TREASURE_FLOOR)) nodes[id].type = 'treasure';
  const free = (lo, hi) => Object.keys(nodes).filter((id) => {
    const n = nodes[id];
    return n.type === 'fight' && n.f >= lo && n.f <= hi && n.f !== 1 && n.f !== TREASURE_FLOOR;
  });
  // 2 elites, floors 5..10, distinct floors when possible
  const elitePool = rng.shuffle(free(5, 10));
  const elites = [];
  for (const id of elitePool) {
    if (elites.length >= 2) break;
    if (elites.some((e) => nodes[e].f === nodes[id].f)) continue;
    elites.push(id);
  }
  if (elites.length < 2 && elitePool.length > elites.length) {
    for (const id of elitePool) {
      if (elites.length >= 2) break;
      if (!elites.includes(id)) elites.push(id);
    }
  }
  for (const id of elites) nodes[id].type = 'elite';
  // exactly 1 shop, floors 3..9
  const shopPool = rng.shuffle(free(3, 9));
  if (shopPool.length) nodes[shopPool[0]].type = 'shop';
  // 1 optional mid-rest, floors 5..9
  const midRestPool = rng.shuffle(free(5, 9));
  if (midRestPool.length) nodes[midRestPool[0]].type = 'rest';
  // events on remaining free nodes (~35%), min 3 per act
  let eventCount = 0;
  for (const id of rng.shuffle(free(2, 10))) {
    if (rng.chance(0.35)) { nodes[id].type = 'event'; eventCount++; }
  }
  if (eventCount < 3) {
    for (const id of rng.shuffle(free(2, 10))) {
      if (eventCount >= 3) break;
      nodes[id].type = 'event'; eventCount++;
    }
  }

  // 5) floors index (render + traversal convenience)
  const floors = [];
  for (let f = 1; f <= MAP_FLOORS; f++) {
    floors[f] = (f === MAP_FLOORS) ? [BOSS_ID]
      : byFloor(f).sort((a, b) => nodes[a].c - nodes[b].c);
  }
  return { act, nodes, edges, floors };
}

// nodes enterable next: at act start every floor-1 node, otherwise the current
// node's outgoing edges.
export function reachableIds(map, pos) {
  if (!pos) return map.floors[1];
  return map.edges[pos] || [];
}

// sanity used by tests: every node reaches the boss & is reachable from floor 1
export function validateMap(map) {
  const problems = [];
  const ids = Object.keys(map.nodes);
  // upward reachability (to boss)
  const up = new Set([BOSS_ID]);
  for (let f = MAP_FLOORS - 1; f >= 1; f--) {
    for (const id of map.floors[f] || []) {
      if ((map.edges[id] || []).some((n) => up.has(n))) up.add(id);
    }
  }
  // downward reachability (from any start)
  const down = new Set(map.floors[1]);
  for (let f = 1; f < MAP_FLOORS; f++) {
    for (const id of map.floors[f] || []) {
      if (!down.has(id)) continue;
      for (const n of map.edges[id] || []) down.add(n);
    }
  }
  for (const id of ids) {
    if (!up.has(id)) problems.push(`${id} cannot reach boss`);
    if (!down.has(id)) problems.push(`${id} unreachable from start`);
  }
  // non-crossing edges
  for (let f = 1; f < MAP_FLOORS; f++) {
    const es = [];
    for (const id of map.floors[f] || []) {
      for (const to of map.edges[id] || []) {
        if (to === BOSS_ID) continue;
        es.push([map.nodes[id].c, map.nodes[to].c]);
      }
    }
    for (const [a, b] of es) for (const [x, y] of es) {
      if (a < x && b > y) problems.push(`crossing edges on floor ${f}`);
    }
  }
  return problems;
}
