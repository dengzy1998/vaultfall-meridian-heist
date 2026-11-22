// Levels: five floor plans built from exact coordinate lists (40 x 20
// tiles), plus the parse that turns a plan into a playable floor. Building
// from coordinates instead of hand-typed ASCII rows means a plan can never
// be a tile short or long — every feature lands exactly where it is named.
import { COLS, ROWS, TILE, PLAY_Y } from './config.js';
import { pick, shuffle } from './random.js';

export function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: PLAY_Y + row * TILE + TILE / 2 };
}
export function tileAt(x, y) {
  return { col: Math.floor(x / TILE), row: Math.floor((y - PLAY_Y) / TILE) };
}
export function inGrid(col, row) { return col >= 0 && col < COLS && row >= 0 && row < ROWS; }
export function isSolid(grid, col, row) {
  if (!inGrid(col, row)) return true;
  const ch = grid[row][col];
  return ch === '#' || ch === 'D';
}
export function isFloorTile(grid, col, row) {
  return inGrid(col, row) && !isSolid(grid, col, row);
}

// Breadth-first path on floor tiles; guards walk the returned tile list.
export function findPath(grid, fromCol, fromRow, toCol, toRow) {
  if (!isFloorTile(grid, toCol, toRow)) return null;
  const key = (c, r) => r * COLS + c;
  const prev = new Map();
  const queue = [[fromCol, fromRow]];
  prev.set(key(fromCol, fromRow), null);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const [c, r] = queue.shift();
    if (c === toCol && r === toRow) {
      const path = [];
      let cur = key(c, r);
      while (cur !== null) {
        path.unshift([cur % COLS, Math.floor(cur / COLS)]);
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (isFloorTile(grid, nc, nr) && !prev.has(key(nc, nr))) {
        prev.set(key(nc, nr), key(c, r));
        queue.push([nc, nr]);
      }
    }
  }
  return null;
}

// Plan builder: start from open floor, draw the border, then stamp features
// at exact [col, row] coordinates. Returns an array of 20 strings of 40.
function buildPlan(spec) {
  const g = [];
  for (let r = 0; r < ROWS; r++) g.push(new Array(COLS).fill('.'));
  for (let c = 0; c < COLS; c++) { g[0][c] = '#'; g[ROWS - 1][c] = '#'; }
  for (let r = 0; r < ROWS; r++) { g[r][0] = '#'; g[r][COLS - 1] = '#'; }
  const put = (ch, list) => { for (const [c, r] of list) g[r][c] = ch; };
  const wallRun = (row, c0, c1) => { for (let c = c0; c <= c1; c++) g[row][c] = '#'; };
  put('P', [[1, 18]]);
  put('X', [[1, 1]]);
  put('V', [spec.vault]);
  put('G', spec.guards || []);
  if (spec.bossAt) put('B', [spec.bossAt]);
  put('D', spec.desks || []);
  put('L', spec.loot || []);
  for (const [row, c0, c1] of spec.walls || []) wallRun(row, c0, c1);
  return g.map((row) => row.join(''));
}

const LOOT_KINDS = ['gem', 'painting', 'cash', 'gold', 'scrip'];

export const FLOORS = [
  {
    name: 'FLOOR 1 — THE MERIDIAN GALLERY',
    sub: 'Learn the ropes. One guard, one camera, easy loot.',
    lootTarget: 14,
    cameras: [{ tx: 20, ty: 0, base: Math.PI / 2, arc: 0.9, speed: 0.5 }],
    plan: buildPlan({
      vault: [37, 17], guards: [[3, 8]],
      desks: [[24, 2], [34, 2], [3, 3], [3, 4], [4, 4], [14, 4], [24, 7], [34, 7],
              [23, 9], [24, 9], [5, 11], [24, 11], [34, 11], [29, 12], [3, 13], [14, 13],
              [26, 14], [24, 15], [37, 15], [35, 16], [36, 16], [3, 17], [14, 17], [34, 17]],
      loot: [[24, 1], [14, 2], [22, 4], [34, 4], [5, 6], [25, 6], [14, 8], [35, 9],
             [12, 11], [37, 11], [22, 13], [6, 15], [14, 15], [34, 15], [22, 17]],
    }),
  },
  {
    name: 'FLOOR 2 — THE VAULT CORRIDOR',
    sub: 'Wall runs split the room. Two guards, two cameras.',
    lootTarget: 12,
    cameras: [
      { tx: 10, ty: 0, base: Math.PI / 2, arc: 1.0, speed: 0.6 },
      { tx: 30, ty: 19, base: -Math.PI / 2, arc: 1.0, speed: 0.55 },
    ],
    plan: buildPlan({
      vault: [34, 17], guards: [[3, 6], [3, 16]],
      walls: [[4, 2, 6], [4, 23, 27], [9, 12, 16], [9, 33, 37], [14, 2, 6], [14, 23, 27]],
      desks: [[3, 2], [24, 2], [34, 2], [24, 5], [5, 8], [34, 11], [14, 11], [24, 15]],
      loot: [[14, 1], [35, 1], [14, 5], [34, 5], [25, 8], [14, 10], [24, 12], [5, 15], [35, 15]],
    }),
  },
  {
    name: 'FLOOR 3 — THE WARDEN\u2019S WING',
    sub: 'BOSS: WARDEN VEX — twin sweeping cones, fast patrol.',
    lootTarget: 12,
    boss: { name: 'WARDEN VEX', cones: 2, speed: 118, range: 235 },
    cameras: [
      { tx: 20, ty: 0, base: Math.PI / 2, arc: 0.9, speed: 0.6 },
      { tx: 0, ty: 10, base: 0, arc: 0.9, speed: 0.5 },
    ],
    plan: buildPlan({
      vault: [34, 17], guards: [[3, 11]], bossAt: [14, 6],
      walls: [[5, 3, 7], [5, 32, 36], [14, 3, 7], [14, 32, 36]],
      desks: [[3, 2], [14, 2], [34, 2], [24, 4], [3, 8], [34, 8], [5, 10], [24, 10],
              [14, 15], [24, 16], [3, 17]],
      loot: [[14, 1], [35, 1], [5, 4], [25, 7], [14, 8], [34, 10], [14, 12], [5, 15], [35, 15], [14, 17]],
    }),
  },
  {
    name: 'FLOOR 4 — THE STRONGROOM',
    sub: 'Desk maze. Two guards, three cameras, rich loot.',
    lootTarget: 14,
    cameras: [
      { tx: 10, ty: 0, base: Math.PI / 2, arc: 1.0, speed: 0.65 },
      { tx: 30, ty: 0, base: Math.PI / 2, arc: 1.0, speed: 0.6 },
      { tx: 20, ty: 19, base: -Math.PI / 2, arc: 1.0, speed: 0.55 },
    ],
    plan: buildPlan({
      vault: [34, 17], guards: [[14, 6], [3, 13]],
      desks: [[24, 1], [3, 2], [4, 2], [14, 2], [34, 2], [35, 2], [12, 4], [13, 4],
              [24, 4], [3, 5], [34, 5], [3, 7], [4, 7], [34, 7], [35, 7], [24, 8],
              [3, 10], [14, 10], [34, 10], [5, 12], [6, 12], [24, 12], [25, 12],
              [14, 15], [3, 16], [4, 16], [24, 16]],
      loot: [[14, 1], [35, 1], [5, 4], [25, 6], [14, 7], [5, 9], [34, 9], [25, 11],
             [14, 13], [5, 15], [35, 15], [14, 17]],
    }),
  },
  {
    name: 'FLOOR 5 — THE CROWN VAULT',
    sub: 'BOSS: SENTINEL PRIME — triple cones and rotating lasers.',
    lootTarget: 16,
    boss: { name: 'SENTINEL PRIME', cones: 3, speed: 104, range: 250 },
    lasers: [
      { ax: 30, ay: 1, length: 260, speed: 0.55, phase: 0 },
      { ax: 38, ay: 8, length: 240, speed: -0.45, phase: 1.7 },
    ],
    cameras: [
      { tx: 20, ty: 0, base: Math.PI / 2, arc: 0.9, speed: 0.7 },
      { tx: 39, ty: 10, base: Math.PI, arc: 0.9, speed: 0.6 },
      { tx: 0, ty: 10, base: 0, arc: 0.9, speed: 0.6 },
    ],
    plan: buildPlan({
      vault: [38, 1], guards: [[14, 7], [3, 12]], bossAt: [24, 10],
      walls: [[6, 3, 13], [15, 3, 13]],
      desks: [[24, 2], [34, 2], [3, 3], [34, 8], [24, 11], [24, 16]],
      loot: [[14, 1], [35, 1], [5, 5], [25, 8], [14, 9], [34, 11], [14, 13], [5, 17], [35, 17]],
    }),
  },
];

export function parseFloor(index, rng) {
  const def = FLOORS[index];
  const grid = def.plan.map((row) => row.split(''));
  const floor = {
    def, index, grid,
    start: { x: 48, y: PLAY_Y + 18 * TILE + 16 },
    vault: null, exit: null, exitOpen: false,
    loot: [], guards: [], boss: null, cameras: [], lasers: [],
    cracked: false, crackProgress: 0,
  };
  const openTiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = grid[r][c];
      const p = tileCenter(c, r);
      if (ch === 'P') floor.start = { x: p.x, y: p.y };
      else if (ch === 'V') floor.vault = { x: p.x, y: p.y, col: c, row: r };
      else if (ch === 'X') floor.exit = { x: p.x, y: p.y, col: c, row: r };
      else if (ch === 'G') floor.guards.push({ col: c, row: r });
      else if (ch === 'B') floor.boss = { col: c, row: r };
      else if (ch === 'L') floor.loot.push({ x: p.x, y: p.y, kind: pick(rng, LOOT_KINDS), taken: false });
      if (!isSolid(grid, c, r) && ch !== 'V' && ch !== 'X') openTiles.push([c, r]);
    }
  }
  // Top loot up to the floor target with random floor tiles.
  const extra = shuffle(rng, openTiles);
  let i = 0;
  while (floor.loot.length < def.lootTarget && i < extra.length) {
    const [c, r] = extra[i++];
    const p = tileCenter(c, r);
    if (Math.hypot(p.x - floor.start.x, p.y - floor.start.y) < 70) continue;
    floor.loot.push({ x: p.x, y: p.y, kind: pick(rng, LOOT_KINDS), taken: false });
  }
  for (const cam of def.cameras || []) {
    const p = tileCenter(cam.tx, cam.ty);
    floor.cameras.push({ x: p.x, y: p.y, base: cam.base, arc: cam.arc, speed: cam.speed, angle: cam.base, t: rng() * 6 });
  }
  for (const lz of def.lasers || []) {
    const p = tileCenter(lz.ax, lz.ay);
    floor.lasers.push({ x: p.x, y: p.y, length: lz.length, speed: lz.speed, angle: lz.phase });
  }
  return floor;
}
