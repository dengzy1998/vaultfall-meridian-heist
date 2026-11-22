// Vision: line of sight and cone checks. A cone only counts when the
// thief is inside its angle AND its range AND no wall or desk blocks the
// ray between watcher and thief. Smoke blocks sight too.
import { isSolid, tileAt } from './levels.js';

export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Step along the ray in small increments; any solid tile blocks the view.
export function hasLineOfSight(grid, ax, ay, bx, by) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const { col, row } = tileAt(x, y);
    if (isSolid(grid, col, row)) return false;
  }
  return true;
}

export function inCone(grid, watcher, target, range, halfAngle) {
  const dx = target.x - watcher.x;
  const dy = target.y - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  const a = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(a, watcher.angle)) > halfAngle) return false;
  return hasLineOfSight(grid, watcher.x, watcher.y, target.x, target.y);
}

// Is the point inside any active smoke cloud?
export function inSmoke(smokes, x, y) {
  for (const s of smokes) {
    if (Math.hypot(x - s.x, y - s.y) < s.radius) return true;
  }
  return false;
}

// Point-in-tile collision helper for the renderer's cone drawing.
export function conePolygon(x, y, angle, range, halfAngle) {
  const pts = [{ x, y }];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / steps;
    pts.push({ x: x + Math.cos(a) * range, y: y + Math.sin(a) * range });
  }
  return pts;
}
