// HUD. One job: the top bar — floor, the big ALARM meter, strikes, loot, tools.
import { CONFIG, COLORS } from './config.js';

function barColor(alarm) {
  if (alarm < 40) return COLORS.alarmLow;
  if (alarm < 75) return COLORS.alarmMid;
  return COLORS.alarmHigh;
}

export function drawHUD(ctx, game) {
  const W = CONFIG.canvasWidth;
  const H = CONFIG.hudHeight;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 10, 22, 0.94)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.panelEdge;
  ctx.fillRect(0, H - 2, W, 2);

  ctx.textBaseline = 'middle';
  // Floor label.
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(game.floorDef.name, 14, H / 2 - 9);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px monospace';
  let sub = game.floorDef.sub;
  while (ctx.measureText(sub).width > 440 && sub.length > 10) {
    sub = sub.slice(0, -4) + '…';
  }
  ctx.fillText(sub, 14, H / 2 + 11);

  // ALARM meter — the centrepiece. Wide, labelled, colour-shifting.
  const ax = 470;
  const aw = 340;
  const ah = 20;
  const ay = 8;
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax, ay + 8);
  ctx.fillStyle = '#10142a';
  ctx.fillRect(ax + 62, ay, aw, ah);
  ctx.fillStyle = barColor(game.alarm);
  ctx.fillRect(ax + 64, ay + 2, Math.max(0, (aw - 4) * Math.min(1, game.alarm / 100)), ah - 4);
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(ax + 62, ay, aw, ah);
  // Strike pips: three chances before the run ends.
  for (let i = 0; i < game.maxStrikes; i++) {
    const cx = ax + 62 + aw + 16 + i * 22;
    ctx.beginPath();
    ctx.arc(cx, ay + 10, 8, 0, Math.PI * 2);
    ctx.fillStyle = i < game.strikes ? '#ff4d4d' : '#2a2f4d';
    ctx.fill();
    ctx.strokeStyle = '#ff4d4d';
    ctx.stroke();
  }
  ctx.fillStyle = game.alarm >= 75 ? COLORS.alarmHigh : COLORS.textDim;
  ctx.font = '11px monospace';
  ctx.fillText(game.alarm >= 75 ? 'SEEN — BREAK LINE OF SIGHT!' : 'stay out of the cones', ax + 62, ay + ah + 12);

  // Loot and tools, right side.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`$${game.money.toLocaleString('en-US')}`, W - 14, 16);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '12px monospace';
  ctx.fillText(
    `LOOT ${game.lootTaken}/${game.lootTotal}   DECOY ${game.tools.decoy}   EMP ${game.tools.emp}   SMOKE ${game.tools.smoke}   RELICS ${game.relics.length}`,
    W - 14,
    34,
  );
  ctx.restore();
}

// Small toast line under the HUD for events (vault cracked, strike, ...).
export function drawToast(ctx, game) {
  if (!game.toast || game.toastTtl <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, game.toastTtl);
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8, 10, 22, 0.85)';
  const w = ctx.measureText(game.toast).width + 28;
  ctx.fillRect((CONFIG.canvasWidth - w) / 2, CONFIG.hudHeight + 10, w, 30);
  ctx.strokeStyle = COLORS.gold;
  ctx.strokeRect((CONFIG.canvasWidth - w) / 2, CONFIG.hudHeight + 10, w, 30);
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(game.toast, CONFIG.canvasWidth / 2, CONFIG.hudHeight + 26);
  ctx.restore();
}
