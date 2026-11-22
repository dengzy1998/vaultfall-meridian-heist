// Main: boot the canvas, run the loop, wire the URL modes.
//   ?seed=N    deterministic floors/loot/patrols
//   ?shot=NAME staged screenshot scene (cover|title|boss|end)
//   ?demo=1    autopilot plays by itself
import { newGame, update, draw, startRun } from './world.js';
import { bindInput, endFrame } from './input.js';
import { stageShot } from './shots.js';
import { autopilotStep } from './autopilot.js';
import { initAudio } from './audio.js';

const canvas = document.getElementById('cv');
const ctx = canvas.getContext('2d');
bindInput(canvas);

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || '20261122') || 20261122;
const shot = params.get('shot');
const demo = params.get('demo') === '1';

const game = newGame(seed);
window.__vaultfall = game; // headless play-tests read the live state here

if (shot) {
  stageShot(game, shot);
} else if (demo) {
  game.demo = true;
  game.autopilot = autopilotStep;
  startRun(game);
}

let last = performance.now();
let shotReady = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(game, dt);
  draw(game, ctx);
  endFrame();
  if (!shotReady) { shotReady = true; window.__shotReady = true; }
  requestAnimationFrame(frame);
}

// First user gesture unlocks audio (browsers require it).
window.addEventListener('pointerdown', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });

requestAnimationFrame(frame);
