// Sound. One job: every beep, sting and the bass loop, synthesised live.
// WebAudio only — no audio files, no network. Everything is guarded so a
// browser without audio (or before the first click) never throws.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = false;
    this.musicStep = 0;
    this.musicTimer = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ensure() || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Audio is decoration; a failure must never break the game.
    }
  }

  click() { this.tone(660, 0.06, 'square', 0.08); }
  pickup() { this.tone(880, 0.09, 'sine', 0.16); this.tone(1318, 0.12, 'sine', 0.12, null, 0.06); }
  coin() { this.tone(1568, 0.07, 'triangle', 0.14); this.tone(2093, 0.1, 'triangle', 0.1, null, 0.05); }
  emp() { this.tone(1200, 0.4, 'sawtooth', 0.12, 120); }
  smoke() { this.tone(300, 0.35, 'sine', 0.12, 90); }
  crackTick() { this.tone(440 + Math.random() * 80, 0.05, 'square', 0.06); }
  vaultOpen() {
    this.tone(523, 0.12, 'triangle', 0.16);
    this.tone(659, 0.12, 'triangle', 0.16, null, 0.1);
    this.tone(784, 0.22, 'triangle', 0.18, null, 0.2);
  }
  strike() {
    this.tone(220, 0.3, 'sawtooth', 0.2, 110);
    this.tone(110, 0.4, 'sawtooth', 0.16, 55, 0.08);
  }
  alarm() { this.tone(980, 0.16, 'square', 0.07, 1240); }
  caught() {
    this.tone(392, 0.25, 'sawtooth', 0.18, 196);
    this.tone(196, 0.5, 'sawtooth', 0.18, 98, 0.2);
  }
  win() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.16, null, i * 0.11));
  }
  relic() { this.tone(1047, 0.15, 'sine', 0.14); this.tone(1568, 0.2, 'sine', 0.12, null, 0.08); }

  // A slow, tense bass loop: two bars of low notes under the whole run.
  startMusic() {
    if (this.musicOn || !this.ensure()) return;
    this.musicOn = true;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 65.4];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const note = bass[this.musicStep % bass.length];
      this.tone(note, 0.42, 'triangle', 0.1);
      if (this.musicStep % 4 === 2) this.tone(note * 2, 0.18, 'sine', 0.045);
      this.musicStep += 1;
    }, 300);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}
