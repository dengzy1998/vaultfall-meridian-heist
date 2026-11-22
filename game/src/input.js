// Input: keyboard state plus mouse clicks on the canvas. One job: tell
// the rest of the game what the player is pressing, nothing more.
export const keys = Object.create(null);
export let mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };
export let justPressed = Object.create(null);

export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.key]) justPressed[e.key] = true;
    keys[e.key] = true;
    // Letter keys by code so layouts do not matter.
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; keys[e.code] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.clickX = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.clickY = (e.clientY - r.top) * (canvas.height / r.height);
    mouse.clicked = true;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function endFrame() {
  for (const k in justPressed) justPressed[k] = false;
  mouse.clicked = false;
}

// Let the autopilot press a key exactly like a human keydown would.
export function simulatePress(code) {
  justPressed[code] = true;
  keys[code] = true;
  setTimeout(() => { keys[code] = false; }, 60);
}

export function moveAxis() {
  let x = 0, y = 0;
  if (keys['a'] || keys['A'] || keys['ArrowLeft']) x -= 1;
  if (keys['d'] || keys['D'] || keys['ArrowRight']) x += 1;
  if (keys['w'] || keys['W'] || keys['ArrowUp']) y -= 1;
  if (keys['s'] || keys['S'] || keys['ArrowDown']) y += 1;
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}

export function sneaking() { return !!(keys['ShiftLeft'] || keys['ShiftRight'] || keys['Shift']); }
export function cracking() { return !!keys[' ']; }
export function pressed(code) { return !!justPressed[code]; }
