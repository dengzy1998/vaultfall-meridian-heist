// Rendering. One job: draw the floor, the watchers, the thief and every screen.
// Canvas 2D only; all art is drawn shapes, so the game needs no image files.
import { CONFIG, COLORS } from './config.js';
import { conePoints } from './vision.js';
import { guardConeAngles } from './guards.js';

const T = CONFIG.tile;
const OY = CONFIG.hudHeight; // playfield starts below the HUD bar

function px(ty) { return OY + ty * T; }

export function drawWorld(ctx, game) {
  ctx.save();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  const grid = game.grid;

  // Floor tiles.
  for (let y = 0; y < CONFIG.rows; y++) {
    for (let x = 0; x < CONFIG.cols; x++) {
      const ch = grid[y][x];
      if (ch === '#') continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x * T, px(y), T, T);
    }
  }

  // Vision cones first, so characters stand on top of them.
  drawCones(ctx, game);

  // Loot.
  for (const item of game.loot) {
    if (item.taken) continue;
    drawLoot(ctx, item);
  }

  // Exit door (exit.x / exit.y are playfield pixel coords, like every entity).
  const ex = game.exit;
  ctx.fillStyle = game.vault.cracked ? COLORS.exit : COLORS.exitLocked;
  ctx.fillRect(ex.x - 14, ex.y + OY - 14, 28, 28);
  ctx.fillStyle = '#0b0e1a';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(game.vault.cracked ? 'EXIT' : 'LOCK', ex.x, ex.y + OY);

  // Vault.
  drawVault(ctx, game);

  // Desks (cover) and walls.
  for (let y = 0; y < CONFIG.rows; y++) {
    for (let x = 0; x < CONFIG.cols; x++) {
      const ch = grid[y][x];
      if (ch === 'D') {
        ctx.fillStyle = COLORS.desk;
        ctx.fillRect(x * T + 2, px(y) + 2, T - 4, T - 4);
        ctx.fillStyle = COLORS.deskTop;
        ctx.fillRect(x * T + 2, px(y) + 2, T - 4, 6);
      } else if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x * T, px(y), T, T);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x * T, px(y), T, 4);
      }
    }
  }

  // Cameras.
  for (const cam of game.cameras) drawCamera(ctx, cam, game.tools.empTimer > 0);

  // Guards and bosses.
  for (const g of game.guards) drawGuard(ctx, g);

  // Laser beams on the Crown Vault floor.
  if (game.boss && game.boss.type === 'prime') drawLasers(ctx, game);

  // Smoke clouds and decoy coins.
  for (const cloud of game.tools.smokeClouds) {
    ctx.fillStyle = COLORS.smoke;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y + OY, CONFIG.smokeRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const coin of game.tools.coins) {
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y + OY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // The thief.
  drawPlayer(ctx, game);

  // Vault-crack progress ring.
  if (game.cracking > 0 && game.cracking < 1) {
    const v = game.vault;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(v.x, v.y + OY, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * game.cracking);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CRACKING… HOLD SPACE', v.x, v.y + OY - 42);
  } else if (!game.vault.cracked && nearVaultPrompt(game)) {
    const v = game.vault;
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOLD SPACE TO CRACK THE VAULT', v.x, v.y + OY - 42);
  }
  ctx.restore();
}

function nearVaultPrompt(game) {
  return Math.hypot(game.vault.x - game.player.x, game.vault.y - game.player.y) < 58;
}

function drawCones(ctx, game) {
  const drawOne = (ox, oy, angle, half, range, fill, edge) => {
    const pts = conePoints(ox, oy + OY, angle, half, range);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  for (const g of game.guards) {
    const isBoss = g.kind !== 'guard';
    for (const a of guardConeAngles(g)) {
      drawOne(
        g.x, g.y, a, g.halfAngle, g.range,
        isBoss ? COLORS.coneBoss : (g.sawPlayer ? 'rgba(255, 60, 60, 0.30)' : COLORS.coneGuard),
        isBoss ? COLORS.coneBossEdge : COLORS.coneGuardEdge,
      );
    }
  }
  for (const cam of game.cameras) {
    if (cam.disabled > 0) continue;
    drawOne(cam.x, cam.y, cam.angle, CONFIG.cameraHalfAngle, CONFIG.cameraRange,
      cam.sawPlayer ? 'rgba(255, 160, 40, 0.32)' : COLORS.coneCamera, COLORS.coneCameraEdge);
  }
}

function drawLoot(ctx, item) {
  const x = item.x;
  const y = item.y + OY;
  ctx.save();
  ctx.translate(x, y);
  if (item.kind === 'gem') {
    ctx.fillStyle = COLORS.lootGem;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(8, 0); ctx.lineTo(0, 9); ctx.lineTo(-8, 0);
    ctx.closePath(); ctx.fill();
  } else if (item.kind === 'painting') {
    ctx.fillStyle = COLORS.lootPainting;
    ctx.fillRect(-9, -7, 18, 14);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(-9, -7, 18, 14);
    ctx.fillStyle = '#7a1f5c';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else if (item.kind === 'cash') {
    ctx.fillStyle = COLORS.lootCash;
    ctx.fillRect(-9, -6, 18, 12);
    ctx.fillStyle = '#0d5c1e';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 1);
  } else {
    ctx.fillStyle = COLORS.lootGold;
    ctx.fillRect(-8, -5, 16, 10);
    ctx.fillStyle = '#fff2b0';
    ctx.fillRect(-8, -5, 16, 3);
  }
  ctx.restore();
}

function drawVault(ctx, game) {
  const v = game.vault;
  const x = v.x - 17;
  const y = v.y + OY - 17;
  ctx.fillStyle = game.boss && game.boss.type === 'prime' ? '#e8c93a' : COLORS.vault;
  ctx.fillRect(x, y, 34, 34);
  ctx.strokeStyle = COLORS.vaultDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 34, 34);
  ctx.fillStyle = '#2b2200';
  ctx.beginPath();
  ctx.arc(v.x, v.y + OY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff2b0';
  ctx.beginPath();
  ctx.moveTo(v.x, v.y + OY);
  ctx.lineTo(v.x + Math.cos(game.vaultDial || 0) * 8, v.y + OY + Math.sin(game.vaultDial || 0) * 8);
  ctx.stroke();
  ctx.fillStyle = game.vault.cracked ? COLORS.exit : COLORS.gold;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(game.vault.cracked ? 'OPEN' : (game.boss && game.boss.type === 'prime' ? 'CROWN' : 'VAULT'),
    v.x, v.y + OY - 24);
}

function drawCamera(ctx, cam, disabled) {
  const x = cam.x;
  const y = cam.y + OY;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(cam.angle);
  ctx.fillStyle = disabled ? '#555a70' : COLORS.camera;
  ctx.fillRect(-4, -4, 14, 8);
  ctx.beginPath();
  ctx.arc(12, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (disabled) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OFF', x, y - 12);
  }
}

function drawGuard(ctx, g) {
  const x = g.x;
  const y = g.y + OY;
  const boss = g.kind !== 'guard';
  ctx.save();
  // Body.
  ctx.fillStyle = boss ? '#8b2fd6' : COLORS.guardSuit;
  ctx.beginPath();
  ctx.arc(x, y, boss ? 17 : 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = boss ? '#d9a0ff' : COLORS.guard;
  ctx.beginPath();
  ctx.arc(x, y, boss ? 11 : 8, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  const fa = g.spin !== 0 ? g.spinAngle : g.angle;
  ctx.lineTo(x + Math.cos(fa) * (boss ? 20 : 15), y + Math.sin(fa) * (boss ? 20 : 15));
  ctx.stroke();
  if (boss) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(g.kind === 'vex' ? 'VEX' : 'PRIME', x, y - 24);
  }
  ctx.restore();
}

function drawLasers(ctx, game) {
  const b = game.boss;
  ctx.save();
  ctx.strokeStyle = COLORS.laser;
  ctx.lineWidth = 3;
  for (const beam of game.laserBeams) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + OY);
    ctx.lineTo(b.x + Math.cos(beam) * 300, b.y + OY + Math.sin(beam) * 300);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  const x = p.x;
  const y = p.y + OY;
  ctx.save();
  if (p.grace > 0 && Math.floor(game.time * 10) % 2 === 0) ctx.globalAlpha = 0.45;
  // Cloak.
  ctx.fillStyle = COLORS.playerCloak;
  ctx.beginPath();
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x + 11, y + 10);
  ctx.lineTo(x - 11, y + 10);
  ctx.closePath();
  ctx.fill();
  // Head.
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(x, y - 4, 8, 0, Math.PI * 2);
  ctx.fill();
  // Hood point + facing tick.
  ctx.fillStyle = COLORS.playerCloak;
  ctx.beginPath();
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x + 5, y - 5);
  ctx.lineTo(x - 5, y - 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x + Math.cos(p.dir) * 13, y - 4 + Math.sin(p.dir) * 13);
  ctx.stroke();
  if (p.sneaking) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAKING', x, y + 24);
  }
  ctx.restore();
}

// ---- Screens -------------------------------------------------------------

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function button(ctx, b, label, enabled = true) {
  ctx.fillStyle = enabled ? '#2a3560' : '#1a1e33';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = enabled ? COLORS.gold : COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = enabled ? COLORS.text : COLORS.textDim;
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
}

export function titleButtons(game) {
  const cx = CONFIG.canvasWidth / 2;
  const buttons = [{ id: 'start', x: cx - 130, y: 575, w: 260, h: 52 }];
  game.hideout.perks.forEach((perk, i) => {
    buttons.push({ id: `perk-${perk.id}`, x: cx - 300 + i * 205, y: 515, w: 190, h: 40 });
  });
  return buttons;
}

export function drawTitle(ctx, game) {
  ctx.save();
  ctx.fillStyle = '#070a16';
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  // Decorative floor strip.
  for (let x = 0; x < CONFIG.cols; x++) {
    ctx.fillStyle = (x % 2 === 0) ? COLORS.floorA : COLORS.floorB;
    ctx.fillRect(x * T, 645, T, 75);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 84px monospace';
  ctx.fillText('VAULTFALL', CONFIG.canvasWidth / 2, 150);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 26px monospace';
  ctx.fillText('— THE MERIDIAN HEIST —', CONFIG.canvasWidth / 2, 200);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 19px monospace';
  ctx.fillText('5 FLOORS · 2 BOSSES · 12 RELICS · 6 TOOLS & PERKS · 40+ LOOT TREASURES',
    CONFIG.canvasWidth / 2, 252);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '15px monospace';
  ctx.fillText('WASD move · SHIFT sneak · SPACE hold to crack the vault · CLICK throw a decoy coin',
    CONFIG.canvasWidth / 2, 292);
  ctx.fillText('E EMP (kills cameras 6s) · Q smoke bomb · dodge the cones, crack the vault, reach the EXIT',
    CONFIG.canvasWidth / 2, 316);
  if (game.bestScore > 0) {
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`BEST GETAWAY: $${game.bestScore.toLocaleString('en-US')}`, CONFIG.canvasWidth / 2, 352);
  }
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '14px monospace';
  ctx.fillText('HIDEOUT — spend banked loot on permanent perks (click or press 1 / 2 / 3):',
    CONFIG.canvasWidth / 2, 396);
  game.hideout.perks.forEach((perk, i) => {
    const x = CONFIG.canvasWidth / 2 - 300 + i * 205;
    const y = 410;
    ctx.fillStyle = 'rgba(10, 13, 26, 0.92)';
    ctx.fillRect(x, y, 190, 90);
    ctx.strokeStyle = perk.owned ? COLORS.exit : COLORS.panelEdge;
    ctx.strokeRect(x, y, 190, 90);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(perk.name, x + 95, y + 22);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '12px monospace';
    wrapText(ctx, perk.desc, x + 95, y + 44, 170, 15);
    ctx.fillStyle = perk.owned ? COLORS.exit : COLORS.text;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(perk.owned ? 'OWNED' : `$${perk.price}  ·  banked $${game.hideout.banked}`, x + 95, y + 76);
  });
  for (const b of titleButtons(game)) {
    if (b.id === 'start') button(ctx, b, 'START THE HEIST  (ENTER)');
    else {
      const perk = game.hideout.perks.find((p) => `perk-${p.id}` === b.id);
      button(ctx, b, perk.owned ? 'OWNED' : `BUY — $${perk.price}`, !perk.owned && game.hideout.banked >= perk.price);
    }
  }
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  ctx.textAlign = 'center';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

export function relicButtons(game) {
  const buttons = [];
  game.relicChoices.forEach((r, i) => {
    buttons.push({ id: `relic-${r.id}`, x: 190 + i * 310, y: 210, w: 280, h: 190 });
  });
  const shop = [
    { id: 'buy-emp', label: 'BUY EMP $150 (4)' },
    { id: 'buy-smoke', label: 'BUY SMOKE $150 (5)' },
    { id: 'buy-decoy', label: 'BUY DECOY $150 (6)' },
  ];
  shop.forEach((s, i) => {
    buttons.push({ id: s.id, x: 290 + i * 230, y: 440, w: 210, h: 44 });
  });
  buttons.push({ id: 'continue', x: 490, y: 520, w: 300, h: 52 });
  return buttons;
}

export function drawRelicScreen(ctx, game) {
  ctx.save();
  ctx.fillStyle = '#070a16';
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 34px monospace';
  ctx.fillText(`FLOOR ${game.floorIndex + 1} CLEARED — $${game.money.toLocaleString('en-US')} IN THE BAG`,
    CONFIG.canvasWidth / 2, 90);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px monospace';
  ctx.fillText('CHOOSE ONE RELIC  (click or press 1 / 2 / 3)', CONFIG.canvasWidth / 2, 140);
  game.relicChoices.forEach((r, i) => {
    const x = 190 + i * 310;
    const y = 210;
    panel(ctx, x, y, 280, 190);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 44px monospace';
    ctx.fillText(r.glyph, x + 140, y + 62);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 17px monospace';
    ctx.fillText(r.name, x + 140, y + 108);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '13px monospace';
    wrapText(ctx, r.desc, x + 140, y + 138, 240, 16);
  });
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('TOOL SHOP — $150 each', CONFIG.canvasWidth / 2, 428);
  for (const b of relicButtons(game)) {
    if (b.id.startsWith('buy-')) {
      const label = b.id === 'buy-emp' ? `BUY EMP $150 (4) — have ${game.tools.emp}`
        : b.id === 'buy-smoke' ? `BUY SMOKE $150 (5) — have ${game.tools.smoke}`
        : `BUY DECOY $150 (6) — have ${game.tools.decoy}`;
      button(ctx, b, label, game.money >= CONFIG.toolPrice);
    } else if (b.id === 'continue') {
      button(ctx, b, game.relicPicked ? 'NEXT FLOOR  (ENTER)' : 'PICK A RELIC FIRST', !!game.relicPicked);
    }
  }
  if (game.relicPicked) {
    ctx.fillStyle = COLORS.exit;
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`Taken: ${game.relicPicked.name}`, CONFIG.canvasWidth / 2, 600);
  }
  ctx.restore();
}

export function drawWin(ctx, game) {
  ctx.save();
  ctx.fillStyle = '#07130c';
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.exit;
  ctx.font = 'bold 64px monospace';
  ctx.fillText('GETAWAY!', CONFIG.canvasWidth / 2, 170);
  ctx.fillStyle = COLORS.text;
  ctx.font = '22px monospace';
  ctx.fillText('The Crown Vault is empty and the Meridian never saw your face.', CONFIG.canvasWidth / 2, 220);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 40px monospace';
  ctx.fillText(`SCORE  $${game.score.toLocaleString('en-US')}`, CONFIG.canvasWidth / 2, 300);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`GRADE  ${game.grade}`, CONFIG.canvasWidth / 2, 350);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '16px monospace';
  ctx.fillText(`Loot taken ${game.lootTaken}/${game.lootTotal} · Floors cleared 5/5 · Strikes ${game.strikes} · Time ${Math.floor(game.time)}s`,
    CONFIG.canvasWidth / 2, 400);
  ctx.fillText(`Banked to the hideout: $${game.money.toLocaleString('en-US')}`, CONFIG.canvasWidth / 2, 428);
  button(ctx, { x: 490, y: 480, w: 300, h: 52 }, 'PLAY AGAIN  (ENTER)');
  ctx.restore();
}

export function drawCaught(ctx, game) {
  ctx.save();
  ctx.fillStyle = '#160708';
  ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('CAUGHT!', CONFIG.canvasWidth / 2, 170);
  ctx.fillStyle = COLORS.text;
  ctx.font = '22px monospace';
  ctx.fillText(game.caughtReason || 'The Meridian security team has you surrounded.',
    CONFIG.canvasWidth / 2, 220);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`You kept $${Math.floor(game.money / 2).toLocaleString('en-US')} of the loot`,
    CONFIG.canvasWidth / 2, 300);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '16px monospace';
  ctx.fillText(`Reached floor ${game.floorIndex + 1}/5 · Loot ${game.lootTaken}/${game.lootTotal} · Relics ${game.relics.length}`,
    CONFIG.canvasWidth / 2, 350);
  button(ctx, { x: 490, y: 420, w: 300, h: 52 }, 'TRY AGAIN  (ENTER)');
  ctx.restore();
}
