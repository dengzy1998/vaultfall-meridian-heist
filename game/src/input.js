// Input. One job: keyboard and mouse state for the game.
// Held keys live on `game.input`; one-shot presses land in `game.pressed`;
// clicks land in `game.click` (canvas pixels) and are consumed by the world.
import { CONFIG } from './config.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sneak', ShiftRight: 'sneak',
  Space: 'interact',
};

export function bindInput(canvas, game) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    const field = KEYMAP[e.code];
    if (field) game.input[field] = true;
    if (!e.repeat) game.pressed.add(e.code);
    game.sound.ensure();
  });
  window.addEventListener('keyup', (e) => {
    const field = KEYMAP[e.code];
    if (field) game.input[field] = false;
  });
  window.addEventListener('blur', () => {
    game.input.up = game.input.down = game.input.left = game.input.right = false;
    game.input.sneak = false;
    game.input.interact = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CONFIG.canvasWidth;
    const y = ((e.clientY - rect.top) / rect.height) * CONFIG.canvasHeight;
    game.click = { x, y };
    game.sound.ensure();
  });
  // Keep the canvas focused so Space/arrows never scroll the page.
  canvas.setAttribute('tabindex', '0');
  canvas.focus();
}
