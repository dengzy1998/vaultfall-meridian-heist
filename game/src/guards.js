// Guards. One job: patrol waypoints, watch with a cone, chase what they see.
// A guard that catches the thief costs a strike; alarm level speeds them up.
import { CONFIG } from './config.js';
import { insideCone, angleDiff, isSolidTile } from './vision.js';

// Slide along walls instead of walking through them: try x, then y.
function tryMove(grid, g, mx, my) {
  const r = 12;
  const tile = CONFIG.tile;
  const blockedAt = (x, y) =>
    isSolidTile(grid, Math.floor((x + r) / tile), Math.floor((y + r) / tile)) ||
    isSolidTile(grid, Math.floor((x - r) / tile), Math.floor((y + r) / tile)) ||
    isSolidTile(grid, Math.floor((x + r) / tile), Math.floor((y - r) / tile)) ||
    isSolidTile(grid, Math.floor((x - r) / tile), Math.floor((y - r) / tile));
  if (!blockedAt(g.x + mx, g.y)) g.x += mx;
  if (!blockedAt(g.x, g.y + my)) g.y += my;
}

export function makeGuard(spawn, waypoints, opts = {}) {
  return {
    kind: opts.kind || 'guard',
    x: spawn.x,
    y: spawn.y,
    angle: opts.angle ?? -Math.PI / 2,
    waypoints,
    wpIndex: 0,
    baseSpeed: opts.speed || CONFIG.guardWalk,
    chaseSpeed: opts.chaseSpeed || CONFIG.guardChase,
    range: opts.range || CONFIG.guardRange,
    halfAngle: opts.halfAngle ?? CONFIG.guardHalfAngle,
    // Twin-cone boss: a second cone facing the opposite way, both rotating.
    twin: !!opts.twin,
    triple: !!opts.triple,
    spin: opts.spin || 0, // radians per second of cone rotation (bosses)
    spinAngle: opts.angle ?? 0,
    alert: 0, // seconds left of chasing the last seen position
    lastSeen: null,
    pause: 0,
    stuckTimer: 0,
    lastX: spawn.x,
    lastY: spawn.y,
    caughtCooldown: 0,
    sawPlayer: false,
  };
}

export function guardConeAngles(g) {
  if (g.triple) {
    const a = g.spinAngle;
    return [a, a + (Math.PI * 2) / 3, a + (Math.PI * 4) / 3];
  }
  if (g.twin) return [g.spinAngle, g.spinAngle + Math.PI];
  return [g.angle];
}

export function guardSeesPlayer(g, grid, player, inSmoke) {
  if (inSmoke) return false;
  for (const a of guardConeAngles(g)) {
    if (insideCone(grid, g.x, g.y, a, g.halfAngle, g.range, player.x, player.y)) return true;
  }
  return false;
}

export function updateGuard(g, dt, grid, player, alarm, onCatch) {
  if (g.caughtCooldown > 0) g.caughtCooldown -= dt;
  const speedBoost = 1 + alarm / 260;
  // Bosses spin their cones instead of turning to face their patrol path.
  if (g.spin !== 0) g.spinAngle += g.spin * dt;

  const dx = player.x - g.x;
  const dy = player.y - g.y;
  const dist = Math.hypot(dx, dy);

  if (g.alert > 0) {
    g.alert -= dt;
    // Chase the last seen spot.
    if (g.lastSeen) {
      const lx = g.lastSeen.x - g.x;
      const ly = g.lastSeen.y - g.y;
      const ld = Math.hypot(lx, ly);
      if (ld > 8) {
        const sp = g.chaseSpeed * speedBoost;
        tryMove(grid, g, (lx / ld) * sp * dt, (ly / ld) * sp * dt);
        g.angle = Math.atan2(ly, lx);
      }
    }
    if (g.alert <= 0) g.lastSeen = null;
  } else if (g.waypoints.length > 0) {
    if (g.pause > 0) {
      g.pause -= dt;
    } else {
      const wp = g.waypoints[g.wpIndex % g.waypoints.length];
      const wx = wp.x - g.x;
      const wy = wp.y - g.y;
      const wd = Math.hypot(wx, wy);
      if (wd < 10) {
        g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        g.pause = 0.9; // look around at each waypoint
      } else {
        const sp = g.baseSpeed * speedBoost;
        tryMove(grid, g, (wx / wd) * sp * dt, (wy / wd) * sp * dt);
        if (g.spin === 0) g.angle = Math.atan2(wy, wx);
        // Stuck against a wall (desk, vault): give up on this waypoint.
        if (Math.hypot(g.x - g.lastX, g.y - g.lastY) < 1.5 * dt * 60 * 0.05) {
          g.stuckTimer += dt;
          if (g.stuckTimer > 1.6) {
            g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
            g.stuckTimer = 0;
          }
        } else {
          g.stuckTimer = 0;
        }
        g.lastX = g.x;
        g.lastY = g.y;
      }
    }
  }

  // Touching the thief costs a strike.
  if (dist < CONFIG.guardCatchRadius && g.caughtCooldown <= 0 && !player.grace) {
    g.caughtCooldown = 2;
    onCatch();
  }
  return g;
}

// Steer a guard's patrol to investigate a thrown decoy coin.
export function lureGuard(g, x, y) {
  g.lastSeen = { x, y };
  g.alert = 3.2;
}
