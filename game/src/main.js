// Entry point. One job: boot the game, run the frame loop, expose test hooks.
// Query params: ?seed=N (deterministic runs) · ?demo=1 (autopilot plays)
// · ?shot=cover|title|boss|end (stage one screenshot scene and hold it).
import { CONFIG } from './config.js';
import { Game } from './world.js';
import { bindInput } from './input.js';

const canvas = document.getElementById('game');
canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

const params = new URLSearchParams(window.location.search);
const game = new Game(canvas, params);
bindInput(canvas, game);

// Test hooks: headless runs read these instead of scraping pixels.
window.__game = game;
window.__ready = false;

let last = performance.now();
let frames = 0;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  game.update(dt);
  game.render();
  frames += 1;
  if (frames === 3) window.__ready = true;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
