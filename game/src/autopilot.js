// Autopilot. One job: play the game hands-free for ?demo=1.
// Breadth-first search across open floor tiles, re-planned twice a second,
// with a little caution: it sneaks near cones and spends tools when cornered.
import { CONFIG } from './config.js';
import { isSolidTile } from './vision.js';

function tileOf(game, x, y) {
  return { tx: Math.floor(x / CONFIG.tile), ty: Math.floor(y / CONFIG.tile) };
}

function bfsPath(game, sx, sy, tx, ty) {
  const key = (x, y) => y * CONFIG.cols + x;
  const prev = new Map();
  const queue = [[sx, sy]];
  prev.set(key(sx, sy), null);
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === tx && cy === ty) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= CONFIG.cols || ny >= CONFIG.rows) continue;
      if (prev.has(key(nx, ny))) continue;
      if (isSolidTile(game.grid, nx, ny)) continue;
      prev.set(key(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  const path = [];
  let cur = [tx, ty];
  while (cur) {
    path.unshift(cur);
    cur = prev.get(key(cur[0], cur[1]));
  }
  return path;
}

export function makeAutopilot() {
  return { path: null, replan: 0, target: null, wait: 0 };
}

export function updateAutopilot(game, dt) {
  const ap = game.autopilot;
  const input = game.input;
  ap.replan -= dt;
  input.up = input.down = input.left = input.right = false;
  input.sneak = false;
  input.interact = false;

  if (game.screen !== 'play') {
    // On menus the autopilot just presses Enter / picks the first relic.
    if (game.screen === 'title' && ap.replan <= 0) {
      ap.replan = 1;
      game.startRun();
    } else if (game.screen === 'relic' && ap.replan <= 0) {
      ap.replan = 1;
      if (!game.relicPicked && game.relicChoices.length > 0) game.pickRelic(game.relicChoices[0].id);
      else game.nextFloor();
    } else if ((game.screen === 'win' || game.screen === 'caught') && ap.replan <= 0) {
      ap.replan = 2;
      game.startRun();
    }
    return;
  }

  const p = game.player;
  const danger = game.alarm > 55 || game.guards.some((g) => g.sawPlayer);
  if (danger && game.tools.smoke > 0 && game.alarm > 70) {
    game.useSmokeAt(p.x, p.y);
  }
  if (game.tools.empTimer <= 0 && game.cameras.some((c) => c.sawPlayer) && game.tools.emp > 0) {
    game.useEmp();
  }

  // Pick a target: nearest loot, then the vault, then the exit.
  if (ap.replan <= 0) {
    ap.replan = 0.5;
    const start = tileOf(game, p.x, p.y);
    let target = null;
    let best = Infinity;
    const consider = (x, y) => {
      const t = tileOf(game, x, y);
      const d = Math.abs(t.tx - start.tx) + Math.abs(t.ty - start.ty);
      if (d < best) { best = d; target = t; }
    };
    if (!game.vault.cracked) {
      for (const item of game.loot) if (!item.taken) consider(item.x, item.y);
      if (best === Infinity) {
        // The vault tile itself is solid: aim at its nearest walkable neighbour.
        const vt = tileOf(game, game.vault.x, game.vault.y);
        const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
        for (const [dx, dy] of neighbours) {
          const nx = vt.tx + dx;
          const ny = vt.ty + dy;
          if (nx < 0 || ny < 0 || nx >= CONFIG.cols || ny >= CONFIG.rows) continue;
          if (isSolidTile(game.grid, nx, ny)) continue;
          consider(nx * CONFIG.tile + CONFIG.tile / 2, ny * CONFIG.tile + CONFIG.tile / 2);
        }
      }
    } else {
      consider(game.exit.x, game.exit.y);
    }
    ap.target = target;
    ap.path = target ? bfsPath(game, start.tx, start.ty, target.tx, target.ty) : null;
  }

  if (!game.vault.cracked && Math.hypot(game.vault.x - p.x, game.vault.y - p.y) < 58) {
    input.interact = true;
    return;
  }

  if (ap.path && ap.path.length > 1) {
    const next = ap.path[1];
    const cx = next[0] * CONFIG.tile + CONFIG.tile / 2;
    const cy = next[1] * CONFIG.tile + CONFIG.tile / 2;
    const dx = cx - p.x;
    const dy = cy - p.y;
    if (Math.abs(dx) > 6) input[dx > 0 ? 'right' : 'left'] = true;
    if (Math.abs(dy) > 6) input[dy > 0 ? 'down' : 'up'] = true;
    // Sneak when a guard is close enough to matter.
    const nearGuard = game.guards.some((g) => Math.hypot(g.x - p.x, g.y - p.y) < 170);
    if (nearGuard || danger) input.sneak = true;
  }
}
