// Shots: staged scenes for screenshots (?shot=cover|title|boss|end).
// Each scene builds a real play state — no fake pixels — then poses the
// actors so one frame shows the whole game: thief, cones, camera, vault,
// alarm. The cover must show all of those at once.
import { loadFloor, startRun } from './world.js';
import { tileCenter } from './levels.js';
import { autopilotStep } from './autopilot.js';

export function stageShot(s, name) {
  if (name === 'title') {
    s.screen = 'title';
    return;
  }
  if (name === 'end') {
    // Stage the getaway screen with a finished-run stat line.
    startRun(s);
    s.screen = 'win';
    s.player.money = 6420;
    s.stats = { loot: 6420, vaults: 5, strikes: 1 };
    s.strikes = 1;
    s.elapsed = 482;
    s.score = 9120;
    s.grade = 'S';
    s.bankedTake = 3210;
    return;
  }
  if (name === 'boss') {
    startRun(s);
    loadFloor(s, 4);
    // Pose the thief near the Crown Vault with the boss sweeping in.
    const v = tileCenter(36, 3);
    s.player.x = v.x; s.player.y = v.y;
    s.player.angle = Math.PI / 2;
    const boss = s.guards.find((g) => g.isBoss);
    if (boss) {
      const bp = tileCenter(24, 8);
      boss.x = bp.x; boss.y = bp.y;
      boss.angle = -Math.PI / 2 + 0.4;
      boss.coneSpin = 0.8;
    }
    const g0 = s.guards.find((g) => !g.isBoss);
    if (g0) {
      const gp = tileCenter(18, 6);
      g0.x = gp.x; g0.y = gp.y; g0.angle = Math.PI * 0.75;
    }
    if (s.floor.cameras[0]) s.floor.cameras[0].angle = Math.PI / 2 + 0.3;
    s.alarm = 58;
    s.godMode = true; // hold the boss pose for the screenshot
    s.toast = null; // no banner ghosting over the staged scene
    s.tools.decoys = 3; s.tools.emps = 2; s.tools.smokes = 2;
    return;
  }
  // Default: cover — floor 1, mid-heist, everything visible in one frame.
  startRun(s);
  loadFloor(s, 0);
  const thief = tileCenter(20, 10);
  s.player.x = thief.x; s.player.y = thief.y;
  s.player.angle = 0; // facing the vault, right across the room
  const g1 = s.guards[0];
  if (g1) {
    const p1 = tileCenter(14, 7);
    g1.x = p1.x; g1.y = p1.y; g1.angle = Math.PI * 0.32;
  }
  // A second guard patrolling the far side, cone sweeping toward the thief.
  const g2 = {
    ...g1,
    x: tileCenter(27, 13).x, y: tileCenter(27, 13).y,
    angle: Math.PI * 1.15, state: 'patrol', path: null, pathIndex: 0,
  };
  s.guards.push(g2);
  if (s.floor.cameras[0]) s.floor.cameras[0].angle = Math.PI / 2 - 0.35;
  s.alarm = 42;
  s.godMode = true; // hold the cover pose for the screenshot
  s.toast = null; // no banner ghosting over the staged scene
  s.player.money = 860;
  s.player.lootCount = 4;
  s.tools.decoys = 2; s.tools.emps = 1; s.tools.smokes = 1;
  // Let the autopilot hold the pose alive for a beat so cones sweep.
  s.autopilot = null;
}
