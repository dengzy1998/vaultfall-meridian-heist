// World: the game state machine. Screens: title (with the Hideout
// meta-shop), play, intermission (relic pick + tool shop), getaway win,
// caught. Owns the alarm, strikes, floor progression and scoring.
import {
  W, H, HUD_H, COLORS, MAX_STRIKES, TOOL_PRICE,
  ALARM_FILL_RATE, ALARM_DECAY_RATE, ALARM_CAMERA_FILL, FLOOR_BONUS,
} from './config.js';
import { makeRng } from './random.js';
import { FLOORS, parseFloor } from './levels.js';
import { makePlayer, updatePlayer, updateCrack, collectLoot } from './player.js';
import { makeGuard, updateGuard, guardTouchesPlayer } from './guards.js';
import { updateCamera, cameraSpots, updateLaser, laserHits } from './cameras.js';
import { makeTools, updateTools, playerHiddenInSmoke } from './tools.js';
import { computeMods, dealRelics } from './relics.js';
import { drawHud, drawToast } from './hud.js';
import { drawFloor, drawCones, drawActors, drawVignette } from './render.js';
import { pressed, mouse } from './input.js';
import { sfx, initAudio, startMusic, toggleMute } from './audio.js';

const HIDEOUT_KEY = 'vaultfall-hideout-v1';
export const PERKS = [
  { id: 'stash', name: 'STASH', desc: 'Start every run with +$200.', price: 500 },
  { id: 'insider', name: 'INSIDER', desc: 'Alarm fills 10% slower.', price: 1200 },
  { id: 'fence', name: 'FENCE', desc: 'All loot sells for +15%.', price: 2500 },
];

export function loadHideout() {
  try {
    const raw = localStorage.getItem(HIDEOUT_KEY);
    if (raw) {
      const h = JSON.parse(raw);
      if (typeof h.banked === 'number' && h.perks) return h;
    }
  } catch (e) { /* storage unavailable: fresh hideout */ }
  return { banked: 0, perks: {} };
}
export function saveHideout(h) {
  try { localStorage.setItem(HIDEOUT_KEY, JSON.stringify(h)); } catch (e) { /* ignore */ }
}

export function newGame(seed) {
  const rng = makeRng(seed || 20261122);
  const hideout = loadHideout();
  const s = {
    seed, rng, hideout,
    screen: 'title', paused: false,
    floorIndex: 0, floor: null, guards: [],
    player: null, tools: null,
    alarm: 0, strikes: 0, secondWindUsed: false, instantUsed: false,
    ownedRelics: [], relicMods: computeMods([]),
    relicOffer: [], score: 0, startTime: 0, elapsed: 0,
    toast: null, flash: 0, shake: 0,
    runMoney: 0, demo: false, autopilot: null,
    stats: { loot: 0, vaults: 0, strikes: 0 },
  };
  applyPerks(s);
  return s;
}

function applyPerks(s) {
  // Modifiers only — the stash payout happens once per run in startRun.
  s.relicMods = computeMods(s.ownedRelics);
  if (s.hideout.perks.fence) s.relicMods.lootMul = (s.relicMods.lootMul || 1) * 1.15;
}

export function startRun(s) {
  s.screen = 'play';
  s.floorIndex = 0;
  s.alarm = 0; s.strikes = 0; s.elapsed = 0;
  s.ownedRelics = [];
  s.carriedTools = null;
  s.runMoney = s.hideout.perks.stash ? 200 : 0;
  s.stats = { loot: 0, vaults: 0, strikes: 0 };
  applyPerks(s);
  loadFloor(s, 0);
  s.startTime = performance.now();
  initAudio(); startMusic();
  sfx('click');
}

export function loadFloor(s, index) {
  s.floorIndex = index;
  s.floor = parseFloor(index, s.rng);
  s.player = makePlayer(s.floor.start);
  s.player.money = s.runMoney;
  s.tools = makeTools();
  // Tools persist across floors; carry counts forward.
  if (s.carriedTools) {
    s.tools.decoys = s.carriedTools.decoys;
    s.tools.emps = s.carriedTools.emps;
    s.tools.smokes = s.carriedTools.smokes;
  }
  s.guards = s.floor.guards.map((sp) => makeGuard(sp, s.rng));
  if (s.floor.boss && s.floor.def.boss) {
    const b = s.floor.def.boss;
    s.guards.push(makeGuard(s.floor.boss, s.rng, {
      isBoss: true, name: b.name, cones: b.cones, speed: b.speed,
      range: b.range, halfAngle: 0.72, coneSpinSpeed: 1.3,
    }));
  }
  s.alarm = Math.max(0, s.alarm - 30);
  s.toast = { text: s.floor.def.name, t: 2.5 };
}

function setToast(s, text) { s.toast = { text, t: 2.5 }; }

function doStrike(s, why) {
  if (s.relicMods.secondWind > 0 && !s.secondWindUsed) {
    s.secondWindUsed = true;
    s.alarm = 0;
    setToast(s, 'SECOND WIND — strike forgiven!');
    sfx('relic');
    return;
  }
  s.strikes++;
  s.stats.strikes++;
  s.alarm = 35;
  s.flash = 0.5;
  s.shake = 0.4;
  sfx('strike');
  setToast(s, why + ' — STRIKE ' + s.strikes + '/' + (MAX_STRIKES + (s.relicMods.extraStrike || 0)));
  const maxStrikes = MAX_STRIKES + (s.relicMods.extraStrike || 0);
  if (s.strikes >= maxStrikes) {
    s.screen = 'caught';
    sfx('caught');
    bankLoot(s);
  }
}

function bankLoot(s) {
  const take = Math.floor(s.player.money * 0.5);
  s.hideout.banked += take;
  saveHideout(s.hideout);
  s.bankedTake = take;
}

function floorCleared(s) {
  const bonus = FLOOR_BONUS[s.floorIndex] || 0;
  s.player.money += bonus;
  s.runMoney = s.player.money;
  s.carriedTools = { decoys: s.tools.decoys, emps: s.tools.emps, smokes: s.tools.smokes };
  s.stats.vaults++;
  sfx('vault');
  if (s.floorIndex >= FLOORS.length - 1) {
    s.screen = 'win';
    s.elapsed = (performance.now() - s.startTime) / 1000;
    s.score = s.player.money + Math.max(0, Math.round(600 - s.elapsed)) + (3 - s.strikes) * 300;
    s.grade = s.score >= 9000 ? 'S' : s.score >= 7000 ? 'A' : s.score >= 5000 ? 'B' : 'C';
    bankLoot(s);
    sfx('win');
  } else {
    s.relicOffer = dealRelics(s.rng, s.ownedRelics);
    s.screen = 'intermission';
  }
}

function updatePlay(s, dt) {
  const p = s.player;
  const floor = s.floor;
  updatePlayer(p, dt, { grid: floor.grid, relicMods: s.relicMods });
  p.hidden = playerHiddenInSmoke(s.tools, p);

  // Tools.
  const toolEvent = updateTools(s.tools, dt, p, s.relicMods);
  if (toolEvent === 'emp') setToast(s, 'EMP — cameras and lasers down!');

  // Master Key: the next vault cracks instantly on first hold.
  if (s.relicMods.instantCrack > 0 && !s.instantUsed && !floor.cracked) {
    const d = Math.hypot(p.x - floor.vault.x, p.y - floor.vault.y);
    if (d < 52 && pressed('Space')) {
      floor.crackProgress = 1;
      s.instantUsed = true;
    }
  }
  const crack = updateCrack(p, dt, floor, s.relicMods);
  if (crack === 'cracking' && Math.random() < dt * 4) sfx('crack');
  if (crack === 'done') {
    setToast(s, 'VAULT CRACKED — get to the EXIT!');
    sfx('vault');
  }

  const gained = collectLoot(p, floor, s.relicMods);
  if (gained > 0) { s.stats.loot += gained; sfx('pickup'); }

  // Cameras and lasers.
  let spotted = false;
  for (const cam of floor.cameras) {
    updateCamera(cam, dt, s.tools.empT);
    if (cameraSpots(cam, floor.grid, p, s.tools.empT)) spotted = true;
  }
  for (const lz of floor.lasers) {
    updateLaser(lz, dt, s.tools.empT);
    if (!s.godMode && laserHits(lz, p, s.tools.empT)) {
      spotted = true;
      s.alarm = Math.min(100, s.alarm + 55 * dt);
    }
  }

  // Guards.
  for (const g of s.guards) {
    const seen = updateGuard(g, dt, {
      grid: floor.grid, rng: s.rng, player: p,
      alarmLevel: s.alarm / 100, decoy: s.tools.decoy,
      visionMul: s.relicMods.visionMul || 1, godMode: !!s.godMode,
    });
    if (seen) spotted = true;
    if (!s.godMode && guardTouchesPlayer(g, p) && s.screen === 'play') {
      doStrike(s, 'CAUGHT BY ' + g.name);
      if (s.screen !== 'play') return;
      // Shove the thief away from the guard after a strike.
      const dx = p.x - g.x, dy = p.y - g.y;
      const d = Math.hypot(dx, dy) || 1;
      p.x += (dx / d) * 60; p.y += (dy / d) * 60;
    }
  }

  // Alarm: fills while spotted, decays while hidden. Staged screenshot
  // scenes (godMode) pin the alarm where the scene set it.
  const insiderMul = s.hideout.perks.insider ? 0.9 : 1;
  if (!s.godMode) {
    if (spotted && !p.hidden) {
      s.alarm += ALARM_FILL_RATE * insiderMul * dt;
      if (Math.random() < dt * 2) sfx('alarm');
    } else {
      s.alarm -= ALARM_DECAY_RATE * (s.relicMods.decayMul || 1) * dt;
    }
    s.alarm = Math.max(0, Math.min(100, s.alarm));
    if (s.alarm >= 100) doStrike(s, 'ALARM MAXED OUT');
  }

  // Exit: only open once the vault is cracked.
  if (floor.exitOpen && floor.exit) {
    const d = Math.hypot(p.x - floor.exit.x, p.y - floor.exit.y);
    if (d < 30) floorCleared(s);
  }

  if (s.toast) s.toast.t -= dt;
  if (s.flash > 0) s.flash -= dt;
  if (s.shake > 0) s.shake -= dt;
}

function updateIntermission(s) {
  // Relic pick: keys 1-3 or click the card.
  for (let i = 0; i < s.relicOffer.length; i++) {
    const card = relicCardRect(i);
    const clicked = mouse.clicked && mouse.clickX >= card.x && mouse.clickX <= card.x + card.w
      && mouse.clickY >= card.y && mouse.clickY <= card.y + card.h;
    if (pressed(String(i + 1)) || clicked) {
      const relic = s.relicOffer[i];
      s.ownedRelics.push(relic.id);
      s.relicMods = computeMods(s.ownedRelics);
      applyPerks(s);
      setToast(s, 'RELIC: ' + relic.name);
      sfx('relic');
      s.relicOffer = [];
      return;
    }
  }
  // Shop: keys 4/5/6 or click — $150 per tool.
  const kinds = ['decoy', 'emp', 'smoke'];
  for (let i = 0; i < 3; i++) {
    const btn = shopButtonRect(i);
    const clicked = mouse.clicked && mouse.clickX >= btn.x && mouse.clickX <= btn.x + btn.w
      && mouse.clickY >= btn.y && mouse.clickY <= btn.y + btn.h;
    if (pressed(String(i + 4)) || clicked) {
      if (s.player.money >= TOOL_PRICE) {
        s.player.money -= TOOL_PRICE;
        s.runMoney = s.player.money;
        if (kinds[i] === 'decoy') s.carriedTools.decoys++;
        else if (kinds[i] === 'emp') s.carriedTools.emps++;
        else s.carriedTools.smokes++;
        sfx('coin');
        setToast(s, 'Bought 1 ' + kinds[i].toUpperCase() + ' — $150');
      } else {
        setToast(s, 'Not enough loot — need $150');
      }
    }
  }
  // Continue: Enter or click the button.
  const cont = continueRect();
  const clicked = mouse.clicked && mouse.clickX >= cont.x && mouse.clickX <= cont.x + cont.w
    && mouse.clickY >= cont.y && mouse.clickY <= cont.y + cont.h;
  if (pressed('Enter') || clicked) {
    sfx('click');
    loadFloor(s, s.floorIndex + 1);
    s.screen = 'play';
  }
}

export function relicCardRect(i) {
  return { x: 190 + i * 310, y: 210, w: 280, h: 190 };
}
export function shopButtonRect(i) {
  return { x: 190 + i * 310, y: 470, w: 280, h: 56 };
}
export function continueRect() {
  return { x: 490, y: 580, w: 300, h: 56 };
}

function updateTitle(s) {
  if (pressed('Enter') || (mouse.clicked && mouse.clickY > 300 && mouse.clickY < 470)) {
    startRun(s);
    return;
  }
  // Hideout perks: keys 1-3 buy with banked loot.
  for (let i = 0; i < PERKS.length; i++) {
    if (pressed(String(i + 1))) {
      const perk = PERKS[i];
      if (s.hideout.perks[perk.id]) { setToast(s, perk.name + ' already owned'); continue; }
      if (s.hideout.banked >= perk.price) {
        s.hideout.banked -= perk.price;
        s.hideout.perks[perk.id] = true;
        saveHideout(s.hideout);
        sfx('relic');
        setToast(s, 'HIDEOUT: ' + perk.name + ' unlocked!');
      } else {
        setToast(s, 'Need $' + perk.price + ' banked — you have $' + s.hideout.banked);
      }
    }
  }
  if (pressed('KeyD')) { s.demo = true; startRun(s); }
}

export function update(s, dt) {
  if (s.screen === 'play') {
    if (pressed('KeyP')) { s.paused = !s.paused; sfx('click'); }
    if (pressed('KeyM')) toggleMute();
    if (s.paused) return;
    if (s.autopilot) s.autopilot(s, dt);
    updatePlay(s, dt);
  } else if (s.screen === 'intermission') {
    updateIntermission(s);
  } else if (s.screen === 'title') {
    updateTitle(s);
  } else if (s.screen === 'win' || s.screen === 'caught') {
    if (pressed('KeyR') || pressed('Enter') || mouse.clicked) {
      s.screen = 'title';
      s.toast = null;
      sfx('click');
    }
  }
}

function drawTitle(ctx, s) {
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 84px monospace';
  ctx.fillText('VAULTFALL', W / 2, 170);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 30px monospace';
  ctx.fillText('— THE MERIDIAN HEIST —', W / 2, 220);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '18px monospace';
  ctx.fillText('5 FLOORS · 2 BOSSES · 12 RELICS · 6 TOOLS & PERKS · 40+ LOOT TREASURES', W / 2, 265);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  ctx.fillText('WASD move · SHIFT sneak · SPACE hold to crack the vault · CLICK throw a decoy coin', W / 2, 310);
  ctx.fillText('E EMP · Q smoke bomb · P pause · M mute', W / 2, 336);
  ctx.fillStyle = s.flash > 0 ? COLORS.gold : COLORS.text;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('PRESS ENTER TO START THE HEIST', W / 2, 400);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '15px monospace';
  ctx.fillText('Press D for autopilot demo', W / 2, 432);
  // Hideout.
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('HIDEOUT — banked loot: $' + s.hideout.banked.toLocaleString(), W / 2, 500);
  PERKS.forEach((perk, i) => {
    const x = 290 + i * 240;
    const owned = !!s.hideout.perks[perk.id];
    ctx.fillStyle = owned ? '#1d3a2a' : '#141828';
    ctx.fillRect(x, 525, 210, 90);
    ctx.strokeStyle = owned ? COLORS.exit : '#3a4370';
    ctx.strokeRect(x, 525, 210, 90);
    ctx.fillStyle = owned ? COLORS.exit : COLORS.text;
    ctx.font = 'bold 15px monospace';
    ctx.fillText('[' + (i + 1) + '] ' + perk.name, W / 2 + (x + 105 - W / 2), 550);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '12px monospace';
    ctx.fillText(perk.desc, x + 105, 572);
    ctx.fillStyle = owned ? COLORS.exit : COLORS.gold;
    ctx.fillText(owned ? 'OWNED' : '$' + perk.price, x + 105, 596);
  });
  ctx.restore();
}

function drawIntermission(ctx, s) {
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 40px monospace';
  ctx.fillText('FLOOR ' + (s.floorIndex + 1) + ' CLEARED', W / 2, 90);
  ctx.fillStyle = COLORS.text;
  ctx.font = '18px monospace';
  ctx.fillText('Loot so far: $' + s.player.money.toLocaleString() + '   ·   Next: ' + FLOORS[s.floorIndex + 1].name, W / 2, 130);
  if (s.relicOffer.length) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('CHOOSE ONE RELIC  (press 1 / 2 / 3 or click)', W / 2, 180);
    s.relicOffer.forEach((relic, i) => {
      const r = relicCardRect(i);
      ctx.fillStyle = '#141828';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('[' + (i + 1) + '] ' + relic.name, r.x + r.w / 2, r.y + 40);
      ctx.fillStyle = COLORS.text;
      ctx.font = '14px monospace';
      wrapText(ctx, relic.desc, r.x + r.w / 2, r.y + 80, r.w - 30, 20);
    });
  } else {
    ctx.fillStyle = COLORS.exit;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('Relic taken. Stock up, then move on.', W / 2, 280);
  }
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('TOOL SHOP — $150 each  (press 4 / 5 / 6 or click)', W / 2, 445);
  const kinds = [['DECOY', s.carriedTools.decoys], ['EMP', s.carriedTools.emps], ['SMOKE', s.carriedTools.smokes]];
  kinds.forEach(([name, count], i) => {
    const b = shopButtonRect(i);
    ctx.fillStyle = '#141828';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#3a4370';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('[' + (i + 4) + '] ' + name + ' ×' + count, b.x + b.w / 2, b.y + 22);
    ctx.fillStyle = COLORS.gold;
    ctx.font = '14px monospace';
    ctx.fillText('$150', b.x + b.w / 2, b.y + 42);
  });
  const cont = continueRect();
  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(cont.x, cont.y, cont.w, cont.h);
  ctx.fillStyle = '#0b0e1a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('CONTINUE  [ENTER]', cont.x + cont.w / 2, cont.y + 28);
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, cx, yy);
}

function drawEnd(ctx, s, won) {
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.textAlign = 'center';
  if (won) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 72px monospace';
    ctx.fillText('GETAWAY!', W / 2, 180);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 30px monospace';
    ctx.fillText('The Crown Vault is empty. The Meridian is yours.', W / 2, 235);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 90px monospace';
    ctx.fillText('GRADE ' + s.grade, W / 2, 350);
  } else {
    ctx.fillStyle = COLORS.alarm;
    ctx.font = 'bold 72px monospace';
    ctx.fillText('CAUGHT!', W / 2, 180);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 26px monospace';
    ctx.fillText('Three strikes — the Meridian keeps its gold tonight.', W / 2, 235);
  }
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px monospace';
  ctx.fillText('Loot hauled: $' + s.player.money.toLocaleString() + '   ·   Vaults cracked: ' + s.stats.vaults
    + '   ·   Strikes: ' + s.stats.strikes, W / 2, 420);
  if (won) ctx.fillText('Score: ' + s.score.toLocaleString() + '   ·   Time: ' + Math.round(s.elapsed) + 's', W / 2, 455);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '16px monospace';
  ctx.fillText('Banked to the Hideout: $' + (s.bankedTake || 0).toLocaleString(), W / 2, 495);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('PRESS R TO RUN IT AGAIN', W / 2, 560);
  ctx.restore();
}

export function draw(s, ctx) {
  ctx.clearRect(0, 0, W, H);
  if (s.screen === 'title') { drawTitle(ctx, s); drawToast(ctx, s.toast); return; }
  if (s.screen === 'intermission') { drawIntermission(ctx, s); drawToast(ctx, s.toast); return; }
  if (s.screen === 'win') { drawEnd(ctx, s, true); return; }
  if (s.screen === 'caught') { drawEnd(ctx, s, false); return; }
  // Play.
  ctx.save();
  if (s.shake > 0) {
    const m = s.shake * 14;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  drawFloor(ctx, s.floor);
  drawCones(ctx, s);
  drawActors(ctx, s);
  ctx.restore();
  drawVignette(ctx);
  drawHud(ctx, s);
  drawToast(ctx, s.toast);
  if (s.flash > 0) {
    ctx.fillStyle = 'rgba(255,40,40,' + (s.flash * 0.45) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (s.paused) {
    ctx.fillStyle = 'rgba(10,13,26,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 44px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED — press P to resume', W / 2, H / 2);
  }
}
