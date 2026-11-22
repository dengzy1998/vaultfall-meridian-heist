// World. One job: the whole game state — screens, floors, alarm, strikes,
// vault cracking, relic/shop flow and the permanent hideout (localStorage).
import { CONFIG, COLORS } from './config.js';
import { RNG, hashSeed } from './random.js';
import { FLOORS, parseFloor, tileCenter } from './levels.js';
import { isSolidTile, hasLineOfSight } from './vision.js';
import { makeGuard, updateGuard, guardSeesPlayer } from './guards.js';
import { makeCamera, updateCamera, cameraSeesPlayer } from './cameras.js';
import { makePlayer, updatePlayer, collectLoot, nearVault, onExitTile } from './player.js';
import { makeTools, throwDecoy, useEmp, useSmoke, updateTools, inSmoke } from './tools.js';
import { RELICS, freshMods, applyRelic, drawRelicChoices, relicById } from './relics.js';
import { SoundBank } from './audio.js';
import { makeAutopilot, updateAutopilot } from './autopilot.js';
import { stageShot } from './shots.js';
import { drawWorld, drawTitle, drawRelicScreen, drawWin, drawCaught, titleButtons, relicButtons } from './render.js';
import { drawHUD, drawToast } from './hud.js';

const HIDEOUT_KEY = 'vaultfall-hideout-v1';
const BEST_KEY = 'vaultfall-best-v1';

export const HIDEOUT_PERKS = [
  { id: 'stash', name: 'Safehouse Stash', price: 500, desc: 'Start every run with +1 decoy coin.' },
  { id: 'insider', name: 'Inside Man', price: 1200, desc: 'Guards patrol 10% slower.' },
  { id: 'fence', name: 'Fence Network', price: 2500, desc: 'All loot sells for +20%.' },
];

function loadHideout() {
  try {
    const raw = localStorage.getItem(HIDEOUT_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.banked === 'number' && data.owned) return data;
    }
  } catch { /* fresh hideout on any read failure */ }
  return { banked: 0, owned: [] };
}

export class Game {
  constructor(canvas, query) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = new SoundBank();
    this.seed = query.get('seed') || String(Math.floor(Math.random() * 1e9));
    this.rng = new RNG(hashSeed(this.seed));
    this.demo = query.get('demo') === '1';
    this.shot = query.get('shot');
    this.input = {
      up: false, down: false, left: false, right: false,
      sneak: false, interact: false,
    };
    this.pressed = new Set();
    this.click = null;
    this.autopilot = makeAutopilot();
    this.hideout = loadHideout();
    this.hideout.perks = HIDEOUT_PERKS.map((p) => ({ ...p, owned: this.hideout.owned.includes(p.id) }));
    this.bestScore = 0;
    try { this.bestScore = Number(localStorage.getItem(BEST_KEY) || 0) || 0; } catch { /* ignore */ }
    this.time = 0;
    this.screen = 'title';
    this.toast = '';
    this.toastTtl = 0;
    this.floorIndex = 0;
    this.floorDef = FLOORS[0];
    this.grid = [];
    this.guards = [];
    this.cameras = [];
    this.loot = [];
    // Total loot across all five floors (used by the HUD and the win screen).
    this.lootTotal = FLOORS.reduce((sum, def) => sum + parseFloor(def).lootSpots.length, 0);
    this.lootTaken = 0;
    this.boss = null;
    this.laserBeams = [];
    this.laserAngle = 0;
    this.money = 0;
    this.alarm = 0;
    this.strikes = 0;
    this.maxStrikes = CONFIG.maxStrikes;
    this.relics = [];
    this.mods = freshMods();
    this.relicChoices = [];
    this.relicPicked = null;
    this.tools = makeTools();
    this.cracking = 0;
    this.vaultDial = 0;
    this.score = 0;
    this.grade = 'C';
    this.caughtReason = '';
    this.vault = { x: 0, y: 0, cracked: false };
    this.exit = { x: 0, y: 0, open: false };
    this.player = makePlayer(64, 64);
    this.loadFloor(0, true);
    if (this.shot) stageShot(this, this.shot);
    this.flash = 0;
  }

  saveHideout() {
    try {
      localStorage.setItem(HIDEOUT_KEY, JSON.stringify({
        banked: this.hideout.banked,
        owned: this.hideout.perks.filter((p) => p.owned).map((p) => p.id),
      }));
    } catch { /* storage unavailable: hideout just does not persist */ }
  }

  buyPerk(id) {
    const perk = this.hideout.perks.find((p) => p.id === id);
    if (!perk || perk.owned || this.hideout.banked < perk.price) return false;
    this.hideout.banked -= perk.price;
    perk.owned = true;
    this.saveHideout();
    this.sound.relic();
    return true;
  }

  startRun() {
    this.rng = new RNG(hashSeed(this.seed + ':' + Date.now() % 100000));
    this.money = 0;
    this.lootTaken = 0;
    this.alarm = 0;
    this.strikes = 0;
    this.relics = [];
    this.mods = freshMods();
    this.tools = makeTools();
    this.time = 0;
    this.score = 0;
    const owned = this.hideout.perks.filter((p) => p.owned).map((p) => p.id);
    if (owned.includes('stash')) this.tools.decoy += 1;
    if (owned.includes('fence')) this.mods.lootValueMul *= 1.2;
    this.guardSpeedMul = owned.includes('insider') ? 0.9 : 1;
    this.maxStrikes = CONFIG.maxStrikes + this.mods.extraStrikes;
    this.loadFloor(0);
    this.screen = 'play';
    this.setToast('Floor 1 — stay out of the cones. Crack the vault, reach the EXIT.');
    this.sound.ensure();
    this.sound.startMusic();
  }

  loadFloor(index, titleOnly = false) {
    this.floorIndex = index;
    const parsed = parseFloor(FLOORS[index]);
    this.floorDef = FLOORS[index];
    this.grid = parsed.grid;
    const center = { x: CONFIG.canvasWidth / 2, y: (CONFIG.rows * CONFIG.tile) / 2 };
    // Guards: each patrols the waypoints nearest its spawn.
    this.guards = parsed.guards.map((g) => {
      const spawn = tileCenter(g.x, g.y);
      const wps = parsed.waypoints
        .map((w) => ({ ...tileCenter(w.x, w.y), d: Math.hypot(w.x - g.x, w.y - g.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4);
      return makeGuard(spawn, wps, { speed: CONFIG.guardWalk * (this.guardSpeedMul || 1) });
    });
    this.cameras = parsed.cameras.map((c) => makeCamera(tileCenter(c.x, c.y), center));
    // Bosses.
    this.boss = null;
    this.laserBeams = [];
    if (parsed.boss && FLOORS[index].boss === 'vex') {
      const spawn = tileCenter(parsed.boss.x, parsed.boss.y);
      const wps = parsed.waypoints
        .map((w) => ({ ...tileCenter(w.x, w.y), d: Math.hypot(w.x - parsed.boss.x, w.y - parsed.boss.y) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4);
      this.boss = makeGuard(spawn, wps, {
        kind: 'vex', speed: 92, chaseSpeed: 150, range: CONFIG.bossRange,
        halfAngle: 0.55, twin: true, spin: 0.85,
      });
      this.guards.push(this.boss);
    } else if (parsed.boss && FLOORS[index].boss === 'prime') {
      const spawn = tileCenter(parsed.boss.x, parsed.boss.y);
      this.boss = makeGuard(spawn, [], {
        kind: 'prime', speed: 0, chaseSpeed: 0, range: CONFIG.bossRange,
        halfAngle: 0.5, triple: true, spin: 0.6,
      });
      this.boss.type = 'prime';
      this.guards.push(this.boss);
      this.laserAngle = 0;
    }
    // Loot.
    const kinds = ['cash', 'cash', 'gem', 'gold', 'gold', 'painting'];
    this.loot = parsed.lootSpots.map((s) => {
      const p = tileCenter(s.x, s.y);
      return { x: p.x, y: p.y, kind: this.rng.pick(kinds), taken: false };
    });
    if (!titleOnly) {
      // lootTotal is computed once in the constructor across all floors.
    }
    this.vault = { ...tileCenter(parsed.vault.x, parsed.vault.y), cracked: false };
    this.exit = { ...tileCenter(parsed.exit.x, parsed.exit.y), open: false };
    this.player = makePlayer(...Object.values(tileCenter(parsed.player.x, parsed.player.y)));
    this.cracking = 0;
    this.vaultDial = 0;
    this.alarm = Math.min(this.alarm, 30);
    // Per-floor tool top-ups from relics.
    this.tools.smoke += this.mods.smokePerFloor;
    this.tools.emp += this.mods.empPerFloor;
    this.tools.smokeClouds = [];
    this.tools.coins = [];
    this.tools.empTimer = 0;
    this.relicPicked = null;
  }

  setToast(text, ttl = 3) {
    this.toast = text;
    this.toastTtl = ttl;
  }

  strike(reason) {
    this.strikes += 1;
    this.alarm = CONFIG.alarmStrikeReset;
    this.flash = 0.6;
    this.sound.strike();
    for (const g of this.guards) { g.alert = 0; g.lastSeen = null; }
    if (this.strikes >= this.maxStrikes) {
      this.caughtReason = reason;
      const kept = Math.floor(this.money / 2);
      this.hideout.banked += kept;
      this.saveHideout();
      this.screen = 'caught';
      this.sound.caught();
      this.sound.stopMusic();
      return;
    }
    // Knocked back to the floor entrance with a grace window.
    const start = tileCenter(2, 19);
    this.player.x = start.x;
    this.player.y = start.y;
    this.player.grace = 2;
    this.setToast(`STRIKE ${this.strikes}/${this.maxStrikes} — ${reason}`, 3);
  }

  pickRelic(id) {
    if (this.relicPicked) return;
    const relic = relicById(id);
    if (!relic) return;
    applyRelic(this.mods, id);
    this.relics.push(relic);
    this.relicPicked = relic;
    this.maxStrikes = CONFIG.maxStrikes + this.mods.extraStrikes;
    this.sound.relic();
  }

  buyTool(kind) {
    if (this.money < CONFIG.toolPrice) return false;
    if (kind === 'emp') this.tools.emp += 1;
    else if (kind === 'smoke') this.tools.smoke += 1;
    else if (kind === 'decoy') this.tools.decoy += 1;
    else return false;
    this.money -= CONFIG.toolPrice;
    this.sound.coin();
    return true;
  }

  nextFloor() {
    if (!this.relicPicked) return;
    if (this.floorIndex >= FLOORS.length - 1) return;
    this.loadFloor(this.floorIndex + 1);
    this.screen = 'play';
    this.setToast(`${FLOORS[this.floorIndex].name} — ${FLOORS[this.floorIndex].sub}`, 3.5);
  }

  finishRun() {
    this.score = this.money + FLOORS.length * CONFIG.floorBonus + Math.max(0, 1500 - Math.floor(this.time));
    this.grade = this.score >= 8000 ? 'S' : this.score >= 6500 ? 'A' : this.score >= 5000 ? 'B' : 'C';
    this.hideout.banked += this.money;
    this.saveHideout();
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try { localStorage.setItem(BEST_KEY, String(this.bestScore)); } catch { /* ignore */ }
    }
    this.screen = 'win';
    this.sound.win();
    this.sound.stopMusic();
  }

  useSmokeAt(x, y) {
    if (useSmoke(this.tools, x, y)) this.sound.smoke();
  }

  useEmp() {
    if (useEmp(this.tools)) {
      for (const cam of this.cameras) cam.disabled = CONFIG.empSeconds;
      this.sound.emp();
    }
  }

  // ---- per-frame update ---------------------------------------------------
  update(dt) {
    this.time += dt;
    if (this.toastTtl > 0) this.toastTtl -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.demo) updateAutopilot(this, dt);
    this.handlePressed();
    this.handleClick();

    if (this.screen === 'play') this.updatePlay(dt);
  }

  handlePressed() {
    for (const key of this.pressed) {
      if (key === 'Enter') {
        if (this.screen === 'title') this.startRun();
        else if (this.screen === 'relic') this.nextFloor();
        else if (this.screen === 'win' || this.screen === 'caught') this.startRun();
      } else if (key === 'KeyE' && this.screen === 'play') {
        this.useEmp();
      } else if (key === 'KeyQ' && this.screen === 'play') {
        this.useSmokeAt(this.player.x, this.player.y);
      } else if (this.screen === 'relic') {
        if (key === 'Digit1' || key === 'Digit2' || key === 'Digit3') {
          const idx = Number(key.slice(-1)) - 1;
          if (this.relicChoices[idx]) this.pickRelic(this.relicChoices[idx].id);
        } else if (key === 'Digit4') this.buyTool('emp');
        else if (key === 'Digit5') this.buyTool('smoke');
        else if (key === 'Digit6') this.buyTool('decoy');
      } else if (this.screen === 'title') {
        if (key === 'Digit1' || key === 'Digit2' || key === 'Digit3') {
          const idx = Number(key.slice(-1)) - 1;
          if (this.hideout.perks[idx]) this.buyPerk(this.hideout.perks[idx].id);
        }
      }
    }
    this.pressed.clear();
  }

  handleClick() {
    const c = this.click;
    if (!c) return;
    this.click = null;
    this.sound.ensure();
    if (this.screen === 'title') {
      for (const b of titleButtons(this)) {
        if (c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h) {
          if (b.id === 'start') this.startRun();
          else this.buyPerk(b.id.slice(5));
          return;
        }
      }
    } else if (this.screen === 'relic') {
      for (const b of relicButtons(this)) {
        if (c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h) {
          if (b.id.startsWith('relic-')) this.pickRelic(b.id.slice(6));
          else if (b.id === 'buy-emp') this.buyTool('emp');
          else if (b.id === 'buy-smoke') this.buyTool('smoke');
          else if (b.id === 'buy-decoy') this.buyTool('decoy');
          else if (b.id === 'continue') this.nextFloor();
          return;
        }
      }
    } else if (this.screen === 'win' || this.screen === 'caught') {
      if (c.x >= 490 && c.x <= 790 && c.y >= 480 && c.y <= 532) this.startRun();
      if (this.screen === 'caught' && c.y >= 420 && c.y <= 472) this.startRun();
    } else if (this.screen === 'play') {
      // Click throws a decoy coin at the clicked floor spot.
      if (c.y > CONFIG.hudHeight) {
        if (throwDecoy(this.tools, this.player.x, this.player.y, c.x, c.y - CONFIG.hudHeight)) {
          this.sound.coin();
        }
      }
    }
  }

  updatePlay(dt) {
    // Staged screenshot scenes hold still: no decay, no patrol drift.
    if (this.shotFrozen) return;
    const p = this.player;
    p.speedMul = this.mods.speedMul;
    if (this.mods.sneakFullSpeed) {
      // Quiet Boots: sneaking costs no speed — handled by using walk speed.
      if (p.sneaking) p.speedMul = this.mods.speedMul * (CONFIG.walkSpeed / CONFIG.sneakSpeed);
    }
    updatePlayer(p, dt, this.grid, this.input);
    updateTools(this.tools, dt, this.guards);
    for (const cam of this.cameras) updateCamera(cam, dt);

    const smoked = inSmoke(this.tools, p.x, p.y);
    let seen = false;
    let fillRate = 0;
    for (const g of this.guards) {
      const sees = guardSeesPlayer(g, this.grid, p, smoked);
      g.sawPlayer = sees;
      if (sees) {
        seen = true;
        fillRate = Math.max(fillRate, CONFIG.alarmFillGuard);
        g.lastSeen = { x: p.x, y: p.y };
        g.alert = 2.5;
      }
      updateGuard(g, dt, this.grid, p, this.alarm, () => this.strike('A guard grabbed you.'));
      if (this.screen !== 'play') return; // a catch may have ended the run
    }
    for (const cam of this.cameras) {
      const sees = cameraSeesPlayer(cam, this.grid, p, smoked);
      cam.sawPlayer = sees;
      if (sees) {
        seen = true;
        fillRate = Math.max(fillRate, CONFIG.alarmFillCamera);
      }
    }
    // Sentinel Prime's rotating lasers.
    if (this.boss && this.boss.type === 'prime') {
      this.laserAngle += 0.5 * dt;
      this.laserBeams = [this.laserAngle, this.laserAngle + Math.PI];
      if (this.tools.empTimer <= 0) {
        for (const beam of this.laserBeams) {
          const bx = this.boss.x + Math.cos(beam) * 300;
          const by = this.boss.y + Math.sin(beam) * 300;
          const d = distToSegment(p.x, p.y, this.boss.x, this.boss.y, bx, by);
          if (d < 12 && !smoked) {
            seen = true;
            fillRate = Math.max(fillRate, CONFIG.alarmFillLaser);
          }
        }
      }
    }

    // Alarm meter.
    if (seen) {
      const mul = this.mods.alarmFillMul * (p.sneaking ? 0.55 : 1);
      this.alarm = Math.min(100, this.alarm + fillRate * mul * dt);
      if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) this.sound.alarm();
    } else {
      this.alarm = Math.max(0, this.alarm - CONFIG.alarmDecay * this.mods.alarmDecayMul * dt);
    }
    if (this.alarm >= 100) {
      this.strike('The alarm hit maximum — security flooded the floor.');
      if (this.screen !== 'play') return;
    }

    // Loot.
    const taken = collectLoot(p, this.loot, this.mods.pickupRadius);
    for (const item of taken) {
      const base = CONFIG.lootValue[item.kind];
      const value = Math.round(base * this.mods.lootValueMul) + this.mods.bonusPerLoot;
      this.money += value;
      this.lootTaken += 1;
      this.sound.pickup();
    }

    // Vault cracking.
    const near = nearVault(p, this.vault);
    if (near && this.input.interact && !this.vault.cracked) {
      const total = this.floorDef.crackSeconds * this.mods.crackMul;
      this.cracking += dt / total;
      this.vaultDial += dt * 9;
      if (Math.floor(this.time * 8) !== Math.floor((this.time - dt) * 8)) this.sound.crackTick();
      if (this.cracking >= 1) {
        this.vault.cracked = true;
        this.exit.open = true;
        const bonus = this.floorIndex === 4 ? CONFIG.crownBonus : CONFIG.vaultBonus;
        this.money += bonus;
        this.setToast(this.floorIndex === 4 ? 'CROWN VAULT OPEN — run for the EXIT!' : `VAULT CRACKED +$${bonus} — reach the EXIT!`, 3.5);
        this.sound.vaultOpen();
      }
    } else if (this.cracking > 0 && !this.vault.cracked) {
      this.cracking = Math.max(0, this.cracking - dt * 0.25);
    }

    // Exit.
    if (this.vault.cracked && onExitTile(p, this.exit)) {
      if (this.floorIndex >= FLOORS.length - 1) {
        this.finishRun();
      } else {
        this.money += CONFIG.floorBonus;
        this.relicChoices = drawRelicChoices(this.rng, this.relics.map((r) => r.id));
        this.screen = 'relic';
        this.sound.relic();
      }
    }
  }

  render() {
    const ctx = this.ctx;
    if (this.screen === 'title') drawTitle(ctx, this);
    else if (this.screen === 'relic') drawRelicScreen(ctx, this);
    else if (this.screen === 'win') drawWin(ctx, this);
    else if (this.screen === 'caught') drawCaught(ctx, this);
    else {
      drawWorld(ctx, this);
      drawHUD(ctx, this);
      drawToast(ctx, this);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 40, 40, ${Math.min(0.35, this.flash * 0.5)})`;
      ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    }
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export { COLORS };
