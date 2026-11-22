// Render: draws the whole playfield on the canvas — checkerboard floor,
// walls and desks (cover), the vault and exit, loot, vision cones for
// guards, cameras and bosses, lasers, smoke, the decoy coin, and the
// thief. Danger is amber/red, cover is teal, loot is gold: readable at
// a glance, even shrunk to a contact sheet.
import { TILE, COLS, ROWS, PLAY_Y, COLORS, W, H } from './config.js';
import { conePolygon } from './vision.js';

function drawCone(ctx, x, y, angle, range, halfAngle, fill, edge) {
  const pts = conePolygon(x, y, angle, range, halfAngle);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function drawFloor(ctx, floor) {
  const grid = floor.grid;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE, y = PLAY_Y + r * TILE;
      const ch = grid[r][c];
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, TILE, 5);
      } else {
        ctx.fillStyle = (c + r) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
      if (ch === 'D') {
        ctx.fillStyle = COLORS.desk;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = COLORS.deskTop;
        ctx.fillRect(x + 3, y + 3, TILE - 6, 6);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 6, y + 12, TILE - 12, 3);
      }
    }
  }
  // Exit door.
  if (floor.exit) {
    const { x, y } = floor.exit;
    ctx.fillStyle = floor.exitOpen ? COLORS.exit : '#3a4a42';
    ctx.fillRect(x - 15, y - 15, 30, 30);
    ctx.fillStyle = '#0d0f1a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(floor.exitOpen ? 'EXIT' : 'LOCK', x, y);
  }
  // Vault: big gold safe with a dial.
  if (floor.vault) {
    const { x, y } = floor.vault;
    ctx.fillStyle = COLORS.vaultDark;
    ctx.fillRect(x - 17, y - 17, 34, 34);
    ctx.fillStyle = COLORS.vault;
    ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.strokeStyle = '#5c4708';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = '#5c4708'; ctx.fill();
    ctx.fillStyle = '#0d0f1a';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(floor.cracked ? 'OPEN' : 'VAULT', x, y - 24);
    if (floor.crackProgress > 0 && !floor.cracked) {
      ctx.fillStyle = '#1c2438';
      ctx.fillRect(x - 20, y + 22, 40, 6);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(x - 20, y + 22, 40 * floor.crackProgress, 6);
    }
  }
  // Loot: coloured diamonds by kind.
  for (const item of floor.loot) {
    if (item.taken) continue;
    const color = {
      gem: COLORS.lootGem, painting: COLORS.lootPainting, cash: COLORS.lootCash,
      gold: COLORS.lootGold, scrip: COLORS.lootScrip,
    }[item.kind] || COLORS.lootGold;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
  }
}

export function drawCones(ctx, s) {
  const floor = s.floor;
  // Camera cones first (under guard cones).
  for (const cam of floor.cameras) {
    const disabled = s.tools.empT > 0;
    drawCone(ctx, cam.x, cam.y, cam.angle, 265, 0.44,
      disabled ? 'rgba(120,120,130,0.08)' : COLORS.coneCamera,
      disabled ? 'rgba(120,120,130,0.3)' : 'rgba(255,120,220,0.45)');
  }
  // Guard cones, bosses sweep extra cones.
  const visionMul = s.relicMods.visionMul || 1;
  for (const g of s.guards) {
    const alerted = g.state === 'chase';
    for (let i = 0; i < g.cones; i++) {
      const a = g.angle + (i - (g.cones - 1) / 2) * (Math.PI * 2 / 3) * (g.cones > 1 ? 1 : 0)
        + (g.cones > 1 ? Math.sin(g.coneSpin + i * 2.1) * 0.5 : 0);
      drawCone(ctx, g.x, g.y, a, g.range * visionMul, g.halfAngle,
        alerted ? COLORS.coneAlert : COLORS.cone,
        alerted ? 'rgba(255,60,60,0.6)' : 'rgba(255,190,60,0.5)');
    }
  }
  // Lasers.
  for (const lz of floor.lasers) {
    const ex = lz.x + Math.cos(lz.angle) * lz.length;
    const ey = lz.y + Math.sin(lz.angle) * lz.length;
    ctx.strokeStyle = s.tools.empT > 0 ? 'rgba(120,120,130,0.4)' : COLORS.laser;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(lz.x, lz.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#ff8aa0';
    ctx.beginPath(); ctx.arc(lz.x, lz.y, 6, 0, Math.PI * 2); ctx.fill();
  }
  // Smoke clouds.
  for (const sm of s.tools.smokesActive) {
    ctx.fillStyle = 'rgba(200,205,220,0.28)';
    ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(220,225,240,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.radius, 0, Math.PI * 2); ctx.stroke();
  }
  // Decoy coin.
  if (s.tools.decoy) {
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath(); ctx.arc(s.tools.decoy.x, s.tools.decoy.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.tools.decoy.x, s.tools.decoy.y, 10, 0, Math.PI * 2); ctx.stroke();
  }
}

export function drawActors(ctx, s) {
  // Cameras: small wall domes.
  for (const cam of s.floor.cameras) {
    ctx.fillStyle = s.tools.empT > 0 ? '#777' : COLORS.camera;
    ctx.beginPath(); ctx.arc(cam.x, cam.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0d0f1a';
    ctx.beginPath(); ctx.arc(cam.x, cam.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Guards and bosses.
  for (const g of s.guards) {
    ctx.fillStyle = g.isBoss ? '#b04dff' : COLORS.guardSuit;
    ctx.beginPath(); ctx.arc(g.x, g.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = g.isBoss ? '#e0b3ff' : COLORS.guard;
    ctx.beginPath(); ctx.arc(g.x, g.y, 9, 0, Math.PI * 2); ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * 16, g.y + Math.sin(g.angle) * 16);
    ctx.stroke();
    if (g.isBoss) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(g.name, g.x, g.y - 22);
    }
    if (g.state === 'investigate') {
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - 20);
    }
    if (g.state === 'chase') {
      ctx.fillStyle = '#ff453a';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - 20);
    }
  }
  // The thief: hooded figure with a mask line and a sneak crouch.
  const p = s.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.sneaking) ctx.scale(1.15, 0.85);
  ctx.fillStyle = COLORS.playerCloak;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath(); ctx.arc(0, -2, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#101018';
  ctx.fillRect(-5, -4, 10, 3); // mask
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(p.angle) * 15, Math.sin(p.angle) * 15);
  ctx.stroke();
  ctx.restore();
}

export function drawVignette(ctx) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.85);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}
