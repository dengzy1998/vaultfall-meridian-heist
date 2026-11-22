// Audio: synthesised WebAudio SFX plus a quiet bassline loop. No audio
// files, no network — every sound is an oscillator built at run time.
let ctx = null;
let musicTimer = null;
let muted = false;
let musicStep = 0;

// A-minor-ish bassline: tense, low, keeps the heist humming.
const BASSLINE = [55, 0, 55, 65.41, 0, 55, 49, 0, 55, 0, 82.41, 0, 73.42, 0, 65.41, 0];

export function initAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) { ctx = null; }
}

export function toggleMute() { muted = !muted; return muted; }
export function isMuted() { return muted; }

function tone(freq, dur, type, gain, when = 0, slideTo = 0) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain || 0.08, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch (e) { /* audio is decoration, never fatal */ }
}

export function sfx(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'pickup': tone(880, 0.12, 'sine', 0.07); tone(1318, 0.14, 'sine', 0.05, 0.05); break;
    case 'coin': tone(1568, 0.07, 'triangle', 0.06); tone(2093, 0.1, 'triangle', 0.05, 0.04); break;
    case 'crack': tone(220, 0.08, 'square', 0.04); break;
    case 'vault': tone(523, 0.2, 'sine', 0.09); tone(784, 0.3, 'sine', 0.08, 0.12); tone(1046, 0.4, 'sine', 0.06, 0.24); break;
    case 'alarm': tone(660, 0.16, 'sawtooth', 0.06, 0, 440); tone(660, 0.16, 'sawtooth', 0.06, 0.2, 440); break;
    case 'strike': tone(180, 0.5, 'sawtooth', 0.12, 0, 60); break;
    case 'emp': tone(1200, 0.35, 'sine', 0.07, 0, 120); break;
    case 'smoke': tone(300, 0.4, 'sine', 0.05, 0, 90); break;
    case 'decoy': tone(2400, 0.06, 'sine', 0.06); tone(2400, 0.06, 'sine', 0.05, 0.12); break;
    case 'caught': tone(330, 0.25, 'sawtooth', 0.1, 0, 110); tone(220, 0.4, 'sawtooth', 0.1, 0.25, 55); break;
    case 'relic': tone(392, 0.15, 'triangle', 0.08); tone(587, 0.2, 'triangle', 0.08, 0.1); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.08, i * 0.13)); break;
    case 'click': tone(700, 0.05, 'square', 0.04); break;
    default: break;
  }
}

export function startMusic() {
  if (!ctx || musicTimer) return;
  musicTimer = setInterval(() => {
    if (muted || !ctx) return;
    const f = BASSLINE[musicStep % BASSLINE.length];
    musicStep++;
    if (f) tone(f, 0.42, 'triangle', 0.035);
    if (musicStep % 8 === 0) tone(220, 0.3, 'sine', 0.015);
  }, 240);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
