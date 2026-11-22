// Autopilot: drives the thief for ?demo=1 and for the staged screenshots.
// Simple, readable steering: head for the nearest objective, back away
// from the nearest guard when a cone holds you, hold Space at the vault,
// and pop smoke or EMP when the alarm climbs. It plays by pressing the
// same keys a human would — no cheating, no teleporting.
import { keys, mouse, simulatePress } from './input.js';
import { inCone } from './vision.js';

function setMove(dx, dy) {
  keys['w'] = dy < -0.3; keys['s'] = dy > 0.3;
  keys['a'] = dx < -0.3; keys['d'] = dx > 0.3;
  keys['ArrowUp'] = keys['w']; keys['ArrowDown'] = keys['s'];
  keys['ArrowLeft'] = keys['a']; keys['ArrowRight'] = keys['d'];
}

function nearestGuard(s) {
  let best = null, bd = 1e9;
  for (const g of s.guards) {
    const d = Math.hypot(g.x - s.player.x, g.y - s.player.y);
    if (d < bd) { bd = d; best = g; }
  }
  return { g: best, d: bd };
}

export function autopilotStep(s, dt) {
  const p = s.player;
  const floor = s.floor;
  if (!p || !floor) return;
  keys[' '] = false;
  keys['Shift'] = false;

  // Objective: vault if loot is mostly taken or vault is close, else loot, else exit.
  let target = null;
  if (floor.exitOpen && floor.exit) {
    target = floor.exit;
  } else if (!floor.cracked && floor.vault) {
    const remaining = floor.loot.filter((l) => !l.taken);
    if (remaining.length <= 2) target = floor.vault;
    else {
      let bd = 1e9;
      for (const l of remaining) {
        const d = Math.hypot(l.x - p.x, l.y - p.y);
        if (d < bd) { bd = d; target = l; }
      }
      if (!target) target = floor.vault;
    }
  }

  const { g, d } = nearestGuard(s);
  let danger = false;
  if (g) {
    const inMyCone = inCone(floor.grid, g, p, g.range, g.halfAngle);
    if (inMyCone || d < 90 || g.state === 'chase') danger = true;
  }
  // Camera cones count as danger too.
  for (const cam of floor.cameras) {
    if (inCone(floor.grid, cam, p, 265, 0.44)) danger = true;
  }

  let dx = 0, dy = 0;
  if (target) {
    dx = target.x - p.x; dy = target.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
  }
  if (danger && g) {
    // Back away from the guard, sliding sideways to break the cone.
    let ax = p.x - g.x, ay = p.y - g.y;
    const len = Math.hypot(ax, ay) || 1;
    ax /= len; ay /= len;
    dx = ax * 0.8 + -ay * 0.6;
    dy = ay * 0.8 + ax * 0.6;
    keys['Shift'] = true; // sneak while escaping
    if (s.alarm > 65 && s.tools.smokes > 0) simulatePress('KeyQ');
    if (s.alarm > 80 && s.tools.emps > 0) simulatePress('KeyE');
  }
  // Hold Space at the vault.
  if (!floor.cracked && floor.vault) {
    const vd = Math.hypot(p.x - floor.vault.x, p.y - floor.vault.y);
    if (vd < 50) { keys[' '] = true; dx = 0; dy = 0; }
  }
  // Decoy: if a guard is chasing and we have coins, toss one away from
  // the guard to pull it off our trail (a real mouse click, like a human).
  if (g && g.state === 'chase' && s.tools.decoys > 0 && s.alarm > 40) {
    mouse.clickX = p.x + (p.x - g.x);
    mouse.clickY = p.y + (p.y - g.y);
    mouse.clicked = true;
  }
  setMove(dx, dy);
}
