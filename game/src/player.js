// Player: WASD/arrows movement with wall sliding, sneaking, vault
// cracking (hold Space), loot pickup, and tool triggers. The player is a
// circle that slides along solid tiles instead of sticking on corners.
import {
  PLAYER_SPEED, PLAYER_SNEAK_SPEED, PLAYER_RADIUS,
  VAULT_CRACK_SECONDS, TILE,
} from './config.js';
import { isSolid, tileAt } from './levels.js';
import { moveAxis, sneaking, cracking } from './input.js';

export function makePlayer(start) {
  return {
    x: start.x, y: start.y, angle: -Math.PI / 2,
    sneaking: false, hidden: false, // hidden = inside smoke
    moving: false, crackT: 0,
    decoys: 2, emps: 1, smokes: 1,
    money: 0, lootCount: 0,
  };
}

function tryMove(p, grid, dx, dy) {
  const r = PLAYER_RADIUS;
  const nx = p.x + dx;
  const ny = p.y + dy;
  // X axis, then Y axis: sliding along walls instead of stopping dead.
  const canBe = (x, y) => {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const { col, row } = tileAt(x + ox, y + oy);
      if (isSolid(grid, col, row)) return false;
    }
    return true;
  };
  if (canBe(nx, p.y)) p.x = nx;
  if (canBe(p.x, ny)) p.y = ny;
}

export function updatePlayer(p, dt, ctx) {
  const { grid, relicMods } = ctx;
  p.sneaking = sneaking();
  const speed = (p.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_SPEED) * (relicMods.moveMul || 1);
  const mv = moveAxis();
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    p.angle = Math.atan2(mv.y, mv.x);
    tryMove(p, grid, mv.x * speed * dt, mv.y * speed * dt);
  }
  return p;
}

// Hold Space near the vault to crack it. Returns 'cracking' | 'done' | 'idle'.
export function updateCrack(p, dt, floor, relicMods) {
  if (!floor.vault || floor.cracked) return 'idle';
  const d = Math.hypot(p.x - floor.vault.x, p.y - floor.vault.y);
  const crackTime = VAULT_CRACK_SECONDS * (relicMods.crackMul || 1) * (floor.index === 4 ? 1.7 : 1);
  if (d < TILE * 1.6 && cracking()) {
    floor.crackProgress += dt / crackTime;
    if (floor.crackProgress >= 1) {
      floor.cracked = true;
      floor.exitOpen = true;
      return 'done';
    }
    return 'cracking';
  }
  floor.crackProgress = Math.max(0, floor.crackProgress - dt * 0.5);
  return 'idle';
}

// Loot pickup: walk over a treasure to pocket it.
export function collectLoot(p, floor, relicMods) {
  let gained = 0;
  for (const item of floor.loot) {
    if (item.taken) continue;
    const d = Math.hypot(p.x - item.x, p.y - item.y);
    const radius = 26 * (relicMods.lootRadiusMul || 1);
    if (d < radius) {
      item.taken = true;
      p.lootCount++;
      const base = { gem: 220, painting: 180, cash: 90, gold: 140, scrip: 60 }[item.kind] || 60;
      const value = Math.round(base * (relicMods.lootMul || 1));
      p.money += value;
      gained += value;
    }
  }
  return gained;
}
