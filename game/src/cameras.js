// Security cameras. One job: sweep a cone back and forth across the room.
// An EMP shuts them down for a few seconds; smoke does not blind them,
// but a thief inside smoke is invisible to every watcher.
import { CONFIG } from './config.js';
import { insideCone, angleDiff } from './vision.js';

export function makeCamera(tilePos, center) {
  // Face the room: base angle points from the mount toward the floor centre.
  const base = Math.atan2(center.y - tilePos.y, center.x - tilePos.x);
  return {
    x: tilePos.x,
    y: tilePos.y,
    base,
    angle: base - 0.9,
    sweep: 0.9, // radians each side of base
    speed: 0.55, // radians per second
    dir: 1,
    disabled: 0, // seconds left of EMP shutdown
    sawPlayer: false,
  };
}

export function updateCamera(cam, dt) {
  if (cam.disabled > 0) {
    cam.disabled -= dt;
    return;
  }
  cam.angle += cam.speed * cam.dir * dt;
  if (cam.angle > cam.base + cam.sweep) { cam.angle = cam.base + cam.sweep; cam.dir = -1; }
  if (cam.angle < cam.base - cam.sweep) { cam.angle = cam.base - cam.sweep; cam.dir = 1; }
}

export function cameraSeesPlayer(cam, grid, player, inSmoke) {
  if (cam.disabled > 0 || inSmoke) return false;
  return insideCone(grid, cam.x, cam.y, cam.angle, CONFIG.cameraHalfAngle, CONFIG.cameraRange, player.x, player.y);
}

export { angleDiff };
