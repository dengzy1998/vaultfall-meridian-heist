// Staged screenshot scenes. One job: put the game in a photogenic state
// for ?shot=cover|title|boss|end so the four screenshots tell the whole story.
import { CONFIG } from './config.js';

function placePlayerAt(game, tx, ty) {
  game.player.x = tx * CONFIG.tile + CONFIG.tile / 2;
  game.player.y = ty * CONFIG.tile + CONFIG.tile / 2;
}

// Aim every guard and camera roughly at (x,y) so their cones cross the frame.
function aimWatchersAt(game, x, y) {
  for (const g of game.guards) {
    g.angle = Math.atan2(y - g.y, x - g.x);
    g.spinAngle = g.angle;
  }
  for (const cam of game.cameras) {
    cam.angle = Math.atan2(y - cam.y, x - cam.x);
  }
}

export function stageShot(game, kind) {
  if (kind === 'title') {
    game.screen = 'title';
    return;
  }
  if (kind === 'end') {
    // A finished getaway: full score, top grade, banked loot.
    game.screen = 'win';
    game.money = 6840;
    game.lootTaken = 47;
    game.strikes = 1;
    game.time = 412;
    game.score = 6840 + 5 * CONFIG.floorBonus + 1200;
    game.grade = 'S';
    game.floorIndex = 4;
    game.relics = [];
    return;
  }
  if (kind === 'boss') {
    game.loadFloor(4);
    game.screen = 'play';
    game.shotFrozen = true; // hold the staged moment: alarm, patrols, sweeps
    game.alarm = 68;
    game.money = 4210;
    game.lootTaken = 31;
    // The thief crouched two rooms from the Crown Vault, Prime's beams turning.
    placePlayerAt(game, 12, 15);
    game.player.dir = Math.PI / 4;
    aimWatchersAt(game, game.player.x, game.player.y);
    // A laser beam crossing the frame, frozen mid-sweep.
    game.laserAngle = 1.15;
    game.laserBeams = [game.laserAngle, game.laserAngle + Math.PI];
    // A few treasures already pocketed so the floor reads as mid-heist.
    game.loot.slice(0, 5).forEach((item) => { item.taken = true; });
    return;
  }
  // cover: floor 1 mid-heist — thief crossing the lobby, cones everywhere,
  // camera sweeping, vault in sight, alarm half full.
  game.loadFloor(0);
  game.screen = 'play';
  game.shotFrozen = true; // hold the staged moment: alarm, patrols, sweeps
  game.alarm = 54;
  game.money = 1180;
  game.lootTaken = 6;
  placePlayerAt(game, 20, 11);
  game.player.dir = Math.PI / 2;
  game.player.sneaking = true;
  aimWatchersAt(game, game.player.x, game.player.y);
  game.loot.slice(0, 6).forEach((item) => { item.taken = true; });
}
