// Tools. One job: the thief's three tricks — decoy coin, EMP, smoke bomb.
// Tools cost money in the between-floors shop; using one is free once owned.
import { CONFIG } from './config.js';
import { lureGuard } from './guards.js';

export function makeTools() {
  return {
    decoy: 2,
    emp: 1,
    smoke: 1,
    empTimer: 0, // cameras + lasers dead while this runs
    smokeClouds: [], // {x, y, ttl}
    coins: [], // travelling decoy coins {x, y, tx, ty, ttl}
  };
}

// Click to throw a coin at (tx,ty). Guards near the landing spot walk over.
export function throwDecoy(tools, fromX, fromY, tx, ty) {
  if (tools.decoy <= 0) return false;
  tools.decoy -= 1;
  tools.coins.push({ x: fromX, y: fromY, tx, ty, ttl: 0.6 });
  return true;
}

export function useEmp(tools) {
  if (tools.emp <= 0 || tools.empTimer > 0) return false;
  tools.emp -= 1;
  tools.empTimer = CONFIG.empSeconds;
  return true;
}

export function useSmoke(tools, x, y) {
  if (tools.smoke <= 0) return false;
  tools.smoke -= 1;
  tools.smokeClouds.push({ x, y, ttl: CONFIG.smokeSeconds });
  return true;
}

export function updateTools(tools, dt, guards) {
  if (tools.empTimer > 0) tools.empTimer -= dt;
  for (const cloud of tools.smokeClouds) cloud.ttl -= dt;
  tools.smokeClouds = tools.smokeClouds.filter((c) => c.ttl > 0);
  for (const coin of tools.coins) {
    coin.ttl -= dt;
    const dx = coin.tx - coin.x;
    const dy = coin.ty - coin.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, 520 * dt);
    if (d > 0.01) {
      coin.x += (dx / d) * step;
      coin.y += (dy / d) * step;
    }
    if (coin.ttl <= 0 || d < 6) {
      coin.landed = true;
      for (const g of guards) {
        if (Math.hypot(g.x - coin.tx, g.y - coin.ty) < CONFIG.decoyLureRadius) {
          lureGuard(g, coin.tx, coin.ty);
        }
      }
    }
  }
  tools.coins = tools.coins.filter((c) => !c.landed);
}

// Is (x,y) hidden inside any smoke cloud?
export function inSmoke(tools, x, y) {
  for (const cloud of tools.smokeClouds) {
    if (Math.hypot(cloud.x - x, cloud.y - y) < CONFIG.smokeRadius) return true;
  }
  return false;
}
