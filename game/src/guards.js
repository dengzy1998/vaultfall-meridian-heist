// Guards: waypoint patrols on BFS paths, suspicion, investigation of
// decoy coins, and chase when the alarm is hot. A guard that touches the
// thief triggers a strike. Bosses are guards with extra rotating cones.
import {
  GUARD_PATROL_SPEED, GUARD_ALERT_SPEED, GUARD_CHASE_SPEED,
  GUARD_RADIUS, VISION_RANGE, VISION_HALF_ANGLE, SNEAK_VISION_RANGE,
} from './config.js';
import { tileCenter, tileAt, findPath, isFloorTile } from './levels.js';
import { inCone, angleDiff } from './vision.js';

export function makeGuard(spawn, rng, opts = {}) {
  const p = tileCenter(spawn.col, spawn.row);
  return {
    x: p.x, y: p.y, angle: rng() * Math.PI * 2,
    home: { col: spawn.col, row: spawn.row },
    state: 'patrol', // patrol | investigate | chase | return
    path: [], pathIndex: 0, waitT: 0,
    speed: opts.speed || GUARD_PATROL_SPEED,
    range: opts.range || VISION_RANGE,
    halfAngle: opts.halfAngle || VISION_HALF_ANGLE,
    cones: opts.cones || 1, // bosses sweep extra cones around themselves
    coneSpin: 0, coneSpinSpeed: opts.coneSpinSpeed || 0.9,
    investigateT: 0, chaseT: 0, stuckT: 0,
    isBoss: !!opts.isBoss, name: opts.name || 'GUARD',
    alerted: false,
  };
}

// Pick a fresh patrol destination: a random reachable open tile nearby.
function newPatrolTarget(g, grid, rng) {
  const { col, row } = tileAt(g.x, g.y);
  for (let tries = 0; tries < 12; tries++) {
    const tc = Math.max(1, Math.min(38, col + Math.floor((rng() * 2 - 1) * 12)));
    const tr = Math.max(1, Math.min(18, row + Math.floor((rng() * 2 - 1) * 8)));
    if (!isFloorTile(grid, tc, tr)) continue;
    const path = findPath(grid, col, row, tc, tr);
    if (path && path.length > 2) return path;
  }
  return null;
}

function followPath(g, dt, grid, rng, speedMul) {
  if (!g.path || g.pathIndex >= g.path.length) return true;
  const [tc, tr] = g.path[g.pathIndex];
  const p = tileCenter(tc, tr);
  const dx = p.x - g.x, dy = p.y - g.y;
  const dist = Math.hypot(dx, dy);
  // Alarm heat speeds guards up: effectiveSpeed is refreshed each tick.
  const speed = (g.effectiveSpeed || g.speed) * speedMul;
  if (dist < 4) { g.pathIndex++; return g.pathIndex >= g.path.length; }
  g.angle = Math.atan2(dy, dx);
  const step = Math.min(dist, speed * dt);
  g.x += (dx / dist) * step;
  g.y += (dy / dist) * step;
  return false;
}

export function updateGuard(g, dt, ctx) {
  const { grid, rng, player, alarmLevel, decoy } = ctx;
  g.coneSpin += g.coneSpinSpeed * dt;
  const range = g.range * (ctx.visionMul || 1);
  const spotted = !player.hidden && inCone(grid, g, player, player.sneaking ? SNEAK_VISION_RANGE : range, g.halfAngle);

  // Staged screenshot scenes hold the pose: cones sweep, feet stay put.
  if (ctx.godMode) return spotted;

  // Staged screenshot scenes never chase: the pose must hold for the shot.
  if (spotted && !ctx.godMode) {
    g.state = 'chase';
    g.chaseT = 1.2;
    g.alerted = true;
  } else if (g.state === 'chase') {
    g.chaseT -= dt;
    if (g.chaseT <= 0) { g.state = 'return'; g.path = null; }
  }

  // Decoy coin: guards in earshot walk over to look.
  if (decoy && g.state !== 'chase') {
    const d = Math.hypot(decoy.x - g.x, decoy.y - g.y);
    if (d < decoy.radius && g.state !== 'investigate') {
      const { col, row } = tileAt(decoy.x, decoy.y);
      const { col: gc, row: gr } = tileAt(g.x, g.y);
      const path = findPath(grid, gc, gr, col, row);
      if (path) { g.state = 'investigate'; g.path = path; g.pathIndex = 0; g.investigateT = 3.2; }
    }
  }

  if (g.state === 'patrol') {
    if (!g.path || g.pathIndex >= g.path.length) {
      if (g.waitT > 0) { g.waitT -= dt; }
      else {
        g.path = newPatrolTarget(g, grid, rng);
        g.pathIndex = 0;
        if (!g.path) g.waitT = 1.0;
      }
    } else if (followPath(g, dt, grid, rng, 1)) {
      g.waitT = 0.8 + rng() * 1.6;
      g.path = null;
    }
  } else if (g.state === 'investigate') {
    if (followPath(g, dt, grid, rng, 1.35)) {
      g.investigateT -= dt;
      g.angle += dt * 1.5; // look around
      if (g.investigateT <= 0) { g.state = 'return'; g.path = null; }
    }
  } else if (g.state === 'chase') {
    // Chase the player's tile, re-pathing as they move.
    const { col, row } = tileAt(player.x, player.y);
    const { col: gc, row: gr } = tileAt(g.x, g.y);
    if (!g.path || g.pathIndex >= g.path.length || g.repathT === undefined || (g.repathT -= dt) <= 0) {
      g.path = findPath(grid, gc, gr, col, row);
      g.pathIndex = 0;
      g.repathT = 0.5;
    }
    if (g.path) followPath(g, dt, grid, rng, GUARD_CHASE_SPEED / g.speed);
    else {
      // No path: walk straight at the thief.
      const dx = player.x - g.x, dy = player.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      g.angle = Math.atan2(dy, dx);
      g.x += (dx / d) * GUARD_CHASE_SPEED * dt;
      g.y += (dy / d) * GUARD_CHASE_SPEED * dt;
    }
  } else if (g.state === 'return') {
    if (!g.path) {
      const { col, row } = tileAt(g.x, g.y);
      g.path = findPath(grid, col, row, g.home.col, g.home.row);
      g.pathIndex = 0;
    }
    if (!g.path || followPath(g, dt, grid, rng, 1.1)) { g.state = 'patrol'; g.path = null; }
  }

  // Alarm level speeds every guard up a little — heat makes them keen.
  g.effectiveSpeed = g.speed * (1 + alarmLevel * 0.35);
  return spotted;
}

export function guardTouchesPlayer(g, player) {
  return Math.hypot(g.x - player.x, g.y - player.y) < GUARD_RADIUS + 12;
}
