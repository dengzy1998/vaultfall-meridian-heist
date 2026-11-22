// Line of sight and vision cones. One job: decide what a watcher can see.
// Walls and desks block sight; the vault and exit do not.
import { CONFIG } from './config.js';

export function isSolidTile(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
  const ch = grid[ty][tx];
  return ch === '#' || ch === 'D' || ch === 'V';
}

export function blocksSight(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
  const ch = grid[ty][tx];
  return ch === '#' || ch === 'D';
}

// Sample the segment between two points; true when no wall or desk crosses it.
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / CONFIG.tile);
    const ty = Math.floor((y0 + dy * t) / CONFIG.tile);
    if (blocksSight(grid, tx, ty)) return false;
  }
  return true;
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// True when (px,py) sits inside the cone from (ox,oy) facing `angle`.
export function insideCone(grid, ox, oy, angle, halfAngle, range, px, py) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 4) return true;
  const targetAngle = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(targetAngle, angle)) > halfAngle) return false;
  return hasLineOfSight(grid, ox, oy, px, py);
}

// Points of the wedge polygon used to draw a cone (clipped by walls is
// approximated by fading the wedge; the gameplay test above is exact).
export function conePoints(ox, oy, angle, halfAngle, range, steps = 14) {
  const pts = [{ x: ox, y: oy }];
  for (let i = 0; i <= steps; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / steps;
    pts.push({ x: ox + Math.cos(a) * range, y: oy + Math.sin(a) * range });
  }
  return pts;
}
