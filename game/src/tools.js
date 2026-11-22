// Tools: the thief's kit. Decoy coin (mouse click) lures guards to a
// spot, EMP (E) freezes cameras and lasers, smoke bomb (Q) hides the
// thief inside its cloud. Tools cost $150 each in the between-floors shop.
import { EMP_SECONDS, SMOKE_SECONDS, SMOKE_RADIUS, DECOY_RADIUS, TOOL_PRICE } from './config.js';
import { pressed, mouse } from './input.js';
import { sfx } from './audio.js';

export function makeTools() {
  return { decoys: 2, emps: 1, smokes: 1, empT: 0, smokesActive: [], decoy: null };
}

// Returns an event string for the world to react to, or null.
export function updateTools(t, dt, player, relicMods) {
  if (t.empT > 0) t.empT -= dt;
  t.smokesActive = t.smokesActive.filter((s) => (s.t -= dt) > 0);
  if (t.decoy && (t.decoy.t -= dt) <= 0) t.decoy = null;

  const empDur = EMP_SECONDS * (relicMods.empMul || 1);
  const smokeDur = SMOKE_SECONDS * (relicMods.smokeMul || 1);

  if (pressed('KeyE') && t.emps > 0) {
    t.emps--; t.empT = empDur;
    sfx('emp');
    return 'emp';
  }
  if (pressed('KeyQ') && t.smokes > 0) {
    t.smokes--;
    t.smokesActive.push({ x: player.x, y: player.y, radius: SMOKE_RADIUS, t: smokeDur });
    sfx('smoke');
    return 'smoke';
  }
  if (mouse.clicked && t.decoys > 0) {
    // Only throw when the click lands on the playfield, not the HUD.
    if (mouse.clickY > 80) {
      t.decoys--;
      t.decoy = { x: mouse.clickX, y: mouse.clickY, radius: DECOY_RADIUS, t: 4 };
      sfx('decoy');
      return 'decoy';
    }
  }
  return null;
}

export function playerHiddenInSmoke(t, player) {
  for (const s of t.smokesActive) {
    if (Math.hypot(player.x - s.x, player.y - s.y) < s.radius) return true;
  }
  return false;
}

export function shopBuy(t, kind, money) {
  if (money < TOOL_PRICE) return { ok: false, money };
  if (kind === 'decoy') t.decoys++;
  else if (kind === 'emp') t.emps++;
  else if (kind === 'smoke') t.smokes++;
  else return { ok: false, money };
  return { ok: true, money: money - TOOL_PRICE };
}
