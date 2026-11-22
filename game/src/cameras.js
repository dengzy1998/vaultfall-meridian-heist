// Cameras and lasers: wall-mounted cameras sweep their cone back and
// forth; floor-5 lasers rotate around their anchor. EMP shuts both down
// for a few seconds. Cameras fill the alarm more slowly than guards.
import { inCone, angleDiff } from './vision.js';

export function updateCamera(cam, dt, empT) {
  if (empT > 0) return; // frozen while EMP is live
  cam.t += dt;
  cam.angle = cam.base + Math.sin(cam.t * cam.speed) * cam.arc;
}

export function cameraSpots(cam, grid, player, empT) {
  if (empT > 0) return false;
  if (player.hidden) return false;
  return inCone(grid, cam, player, 265, 0.44);
}

export function updateLaser(laser, dt, empT) {
  if (empT > 0) return;
  laser.angle += laser.speed * dt;
}

// Does the rotating beam cross the player? Check distance from the player
// to the beam segment (anchor -> anchor + length * direction).
export function laserHits(laser, player, empT) {
  if (empT > 0) return false;
  if (player.hidden) return false;
  const ex = laser.x + Math.cos(laser.angle) * laser.length;
  const ey = laser.y + Math.sin(laser.angle) * laser.length;
  const dx = ex - laser.x, dy = ey - laser.y;
  const len2 = dx * dx + dy * dy;
  let t = ((player.x - laser.x) * dx + (player.y - laser.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = laser.x + dx * t, cy = laser.y + dy * t;
  return Math.hypot(player.x - cx, player.y - cy) < 14;
}
