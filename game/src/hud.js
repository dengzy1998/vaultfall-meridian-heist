// HUD: the top bar — floor name, the ALARM meter, strikes, loot haul,
// tool counts and owned relics. Drawn every frame over the playfield.
import { W, HUD_H, COLORS, MAX_STRIKES } from './config.js';

export function drawHud(ctx, s) {
  ctx.save();
  ctx.fillStyle = COLORS.hud;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#232946';
  ctx.fillRect(0, HUD_H - 2, W, 2);

  ctx.textBaseline = 'middle';
  // Floor name, left.
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(s.floor.def.name, 16, 22);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px monospace';
  ctx.fillText(s.floor.def.sub, 16, 48);

  // ALARM meter, centre — the heart of the game. Fills in cones, decays.
  const ax = 470, ay = 12, aw = 340, ah = 24;
  ctx.fillStyle = COLORS.alarmBg;
  ctx.fillRect(ax, ay, aw, ah);
  const frac = Math.max(0, Math.min(1, s.alarm / 100));
  ctx.fillStyle = frac < 0.5 ? '#2fd47a' : frac < 0.8 ? '#ffb347' : COLORS.alarm;
  ctx.fillRect(ax + 2, ay + 2, (aw - 4) * frac, ah - 4);
  ctx.strokeStyle = '#3a4370';
  ctx.lineWidth = 2;
  ctx.strokeRect(ax, ay, aw, ah);
  // Label lives inside the bar, clear of the tool line below it.
  // White with a dark shadow so it reads on both the green fill and the
  // dark-red empty part.
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText('ALARM  ' + Math.floor(s.alarm) + '%', ax + aw / 2 + 1, ay + ah / 2 + 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ALARM  ' + Math.floor(s.alarm) + '%', ax + aw / 2, ay + ah / 2 + 5);

  // Strikes: three pips, lost ones hollow.
  const maxStrikes = MAX_STRIKES + (s.relicMods.extraStrike || 0);
  for (let i = 0; i < maxStrikes; i++) {
    const cx = 850 + i * 26, cy = 28;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    if (i < s.strikes) { ctx.fillStyle = COLORS.alarm; ctx.fill(); }
    else { ctx.strokeStyle = COLORS.alarm; ctx.lineWidth = 2; ctx.stroke(); }
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('STRIKES', 838, 52);

  // Money and loot, right side.
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('$' + s.player.money.toLocaleString(), W - 16, 22);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px monospace';
  ctx.fillText('LOOT ' + s.player.lootCount + '/' + s.floor.loot.length, W - 16, 48);

  // Tool counts.
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.font = '14px monospace';
  ctx.fillText('DECOY ' + s.tools.decoys + '  [click]    EMP ' + s.tools.emps + '  [E]    SMOKE ' + s.tools.smokes + '  [Q]', 470, 66);
  ctx.fillStyle = COLORS.dim;
  ctx.fillText('WASD move · SHIFT sneak · SPACE crack vault', 16, 68);
  ctx.restore();
}

// Small toast messages (vault cracked, strike, relic taken...).
export function drawToast(ctx, toast) {
  if (!toast || toast.t <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, toast.t * 2);
  ctx.font = 'bold 16px monospace';
  const w = ctx.measureText(toast.text).width + 36;
  ctx.fillStyle = 'rgba(10,13,26,0.85)';
  ctx.fillRect((W - w) / 2, 96, w, 36);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1;
  ctx.strokeRect((W - w) / 2, 96, w, 36);
  ctx.fillStyle = COLORS.gold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(toast.text, W / 2, 114);
  ctx.restore();
}
