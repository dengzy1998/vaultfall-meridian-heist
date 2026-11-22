// The thief. One job: move, sneak, crack vaults and pick up loot.
// Movement slides along walls; loot is collected by walking over it.
import { CONFIG } from './config.js';
import { isSolidTile } from './vision.js';

export function makePlayer(x, y) {
  return {
    x, y,
    dir: -Math.PI / 2,
    sneaking: false,
    moving: false,
    grace: 0, // seconds of post-strike invulnerability
    crackTarget: null,
    speedMul: 1,
  };
}

function blockedAt(grid, x, y) {
  const r = 12;
  const t = CONFIG.tile;
  return (
    isSolidTile(grid, Math.floor((x + r) / t), Math.floor((y + r) / t)) ||
    isSolidTile(grid, Math.floor((x - r) / t), Math.floor((y + r) / t)) ||
    isSolidTile(grid, Math.floor((x + r) / t), Math.floor((y - r) / t)) ||
    isSolidTile(grid, Math.floor((x - r) / t), Math.floor((y - r) / t))
  );
}

export function updatePlayer(p, dt, grid, input) {
  if (p.grace > 0) p.grace -= dt;
  let mx = 0;
  let my = 0;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  p.sneaking = !!input.sneak;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const speed = (p.sneaking ? CONFIG.sneakSpeed : CONFIG.walkSpeed) * (p.speedMul || 1);
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    if (!blockedAt(grid, nx, p.y)) p.x = nx;
    if (!blockedAt(grid, p.x, ny)) p.y = ny;
    p.dir = Math.atan2(my, mx);
  }
}

// Loot within pickup radius is collected; returns the taken items.
export function collectLoot(p, loot, radius) {
  const taken = [];
  for (const item of loot) {
    if (item.taken) continue;
    if (Math.hypot(item.x - p.x, item.y - p.y) < radius) {
      item.taken = true;
      taken.push(item);
    }
  }
  return taken;
}

// Is the thief close enough to work on the vault?
export function nearVault(p, vault) {
  return Math.hypot(vault.x - p.x, vault.y - p.y) < 58;
}

export function onExitTile(p, exit) {
  return Math.hypot(exit.x - p.x, exit.y - p.y) < 30;
}
