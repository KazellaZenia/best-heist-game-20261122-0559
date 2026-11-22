// Canvas drawing for IRONVEIL: the whole floor in one frame — five rooms, the
// thief crossing them, guard vision cones, CCTV cones, laser beams, the loot and
// the alarm meter in the HUD. No images: every sprite is drawn in code.
import {
  CAMERA, DOORS, EXIT, FIELD, GUARD, LOOT_TARGET, PALETTE, ROOMS, WALLS,
} from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_WIN = 2;
export const SCREEN_OVER = 3;

function money(n) {
  return '$' + n.toLocaleString('en-US');
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function drawCone(ctx, x, y, angle, range, halfAngle, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawDiamond(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.8, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.8, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.8, y);
  ctx.lineTo(x + r * 0.8, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.stroke();
}

export function render(ctx, world, screen, best) {
  const s = world.state;
  const thief = s.thief;

  // --- Floors: checkerboard per room so floor types read at a glance. ---
  ctx.fillStyle = PALETTE.backdrop;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (const room of ROOMS) {
    const base = room.floor === 'carpet' ? PALETTE.carpet : room.floor === 'tile' ? PALETTE.tile : PALETTE.marble;
    const alt = room.floor === 'carpet' ? PALETTE.carpetAlt : room.floor === 'tile' ? PALETTE.tileAlt : PALETTE.marbleAlt;
    ctx.fillStyle = base;
    ctx.fillRect(room.x, room.y, room.w, room.h);
    ctx.fillStyle = alt;
    const cell = 44;
    for (let y = room.y; y < room.y + room.h; y += cell) {
      for (let x = room.x; x < room.x + room.w; x += cell) {
        if (((x - room.x) / cell + (y - room.y) / cell) % 2 === 0) {
          ctx.fillRect(x, y, Math.min(cell, room.x + room.w - x), Math.min(cell, room.y + room.h - y));
        }
      }
    }
    // Room labels are drawn in a later pass, after the HUD bars, so they stay visible.
  }

  // --- Doors as brass strips on the floor. ---
  for (const d of DOORS) {
    ctx.fillStyle = PALETTE.door;
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }

  // --- Exit zone: green pad, glowing once the loot target is met. ---
  const exitOpen = s.lootValue >= LOOT_TARGET;
  ctx.fillStyle = exitOpen ? 'rgba(57,217,138,0.55)' : 'rgba(57,217,138,0.18)';
  ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  ctx.strokeStyle = PALETTE.exit;
  ctx.lineWidth = 2;
  ctx.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  ctx.fillStyle = exitOpen ? '#062b18' : PALETTE.exit;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(exitOpen ? 'EXIT OPEN' : 'EXIT', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2);

  // --- Loot: gold diamonds with value tags; taken ones leave a faint outline. ---
  for (const item of s.loot) {
    if (item.taken) {
      ctx.strokeStyle = 'rgba(242,201,76,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    drawDiamond(ctx, item.x, item.y, 13, PALETTE.loot);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(item.name, item.x, item.y + 17);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(money(item.value), item.x, item.y + 30);
  }

  // --- Lasers: live beams glow red with emitter posts; off beams are faint. ---
  for (const l of s.lasers) {
    ctx.strokeStyle = l.active ? PALETTE.laser : PALETTE.laserOff;
    ctx.lineWidth = l.active ? 3 : 1.5;
    if (!l.active) ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#3a0d16';
    ctx.beginPath();
    ctx.arc(l.x1, l.y1, 6, 0, Math.PI * 2);
    ctx.arc(l.x2, l.y2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = l.active ? PALETTE.laser : 'rgba(255,77,109,0.5)';
    ctx.beginPath();
    ctx.arc(l.x1, l.y1, 3, 0, Math.PI * 2);
    ctx.arc(l.x2, l.y2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Vision cones: guards red, cameras orange. Walls drawn after occlude them. ---
  for (const c of s.cameras) {
    drawCone(ctx, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle, PALETTE.cameraCone, 'rgba(242,153,74,0.4)');
  }
  for (const g of s.guards) {
    drawCone(ctx, g.x, g.y, g.angle, GUARD.visionRange, GUARD.visionHalfAngle, PALETTE.guardCone, PALETTE.guardConeEdge);
  }

  // --- Walls with a lighter top edge. ---
  for (const w of WALLS) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = PALETTE.wallTop;
    if (w.w >= w.h) ctx.fillRect(w.x, w.y, w.w, 3);
    else ctx.fillRect(w.x, w.y, 3, w.h);
  }

  // --- Cameras: wall-mounted orange boxes with a lens dot. ---
  for (const c of s.cameras) {
    ctx.fillStyle = PALETTE.camera;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1206';
    ctx.beginPath();
    ctx.arc(c.x + Math.cos(c.angle) * 4, c.y + Math.sin(c.angle) * 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(c.name, c.x, c.y - 11);
  }

  // --- Guards: red bodies, direction tick, name, suspicion arc, ! / ? marks. ---
  for (const g of s.guards) {
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * (g.radius + 6), g.y + Math.sin(g.angle) * (g.radius + 6));
    ctx.stroke();
    // Suspicion ring.
    if (g.suspicion > 2) {
      ctx.strokeStyle = g.state === 'chase' ? '#ff2e2e' : '#ffb020';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius + 6, -Math.PI / 2, -Math.PI / 2 + (g.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd7d5';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    let mark = g.name;
    if (g.state === 'chase') mark += ' !';
    else if (g.state === 'suspicious' || g.state === 'search') mark += ' ?';
    ctx.fillText(mark, g.x, g.y - g.radius - 8);
  }

  // --- Thief: green circle, facing tick, noise ring while moving. ---
  if (thief.noiseRadius > 0) {
    ctx.strokeStyle = thief.sneaking ? 'rgba(57,217,138,0.25)' : 'rgba(57,217,138,0.5)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(thief.x, thief.y, thief.noiseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.thiefDark;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#062b18';
  ctx.beginPath();
  ctx.arc(thief.x, thief.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('YOU', thief.x, thief.y - thief.radius - 6);

  // --- HUD top bar: score, loot, alarm meter, rating, timer, best. ---
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 0, FIELD.width, 52);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 52.5);
  ctx.lineTo(FIELD.width, 52.5);
  ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText('IRONVEIL', 14, 27);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('SCORE ' + s.score.toLocaleString('en-US'), 150, 27);
  const lootText = 'LOOT ' + money(s.lootValue) + ' / ' + money(LOOT_TARGET);
  ctx.fillStyle = exitOpen ? PALETTE.alarmOk : PALETTE.text;
  ctx.fillText(lootText, 300, 27);
  // Alarm meter.
  const alarmX = 560;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('ALARM', alarmX, 27);
  ctx.fillStyle = '#2a1214';
  ctx.fillRect(alarmX + 62, 17, 220, 20);
  const alarmW = Math.round((s.alarm / 100) * 220);
  ctx.fillStyle = s.alarm < 40 ? PALETTE.alarmOk : s.alarm < 75 ? '#ffb020' : PALETTE.alarm;
  ctx.fillRect(alarmX + 62, 17, alarmW, 20);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.strokeRect(alarmX + 62, 17, 220, 20);
  ctx.fillStyle = '#fff';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(s.alarm) + '%', alarmX + 172, 27);
  ctx.textAlign = 'left';
  // Rating badge.
  const rating = world.rating();
  ctx.fillStyle = rating === 'GHOST' ? PALETTE.alarmOk : rating === 'SHADOW' ? '#ffb020' : PALETTE.alarm;
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.fillText(rating, 880, 27);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(fmtTime(s.elapsed), 990, 27);
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('BEST ' + best.toLocaleString('en-US'), 1075, 27);

  // --- HUD bottom bar: controls + objective. ---
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, FIELD.height - 32, FIELD.width, 32);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height - 32.5);
  ctx.lineTo(FIELD.width, FIELD.height - 32.5);
  ctx.stroke();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'WASD / arrows move · Shift sneak (quiet) · Click to walk · Space pause · M mute · Enter start',
    14, FIELD.height - 16,
  );
  ctx.textAlign = 'right';
  ctx.fillStyle = exitOpen ? PALETTE.alarmOk : PALETTE.gold;
  ctx.fillText(
    exitOpen ? 'Haul secured — reach the EXIT!' : 'Lift ' + money(LOOT_TARGET) + ' then reach the EXIT',
    FIELD.width - 14, FIELD.height - 16,
  );

  // --- Room labels, drawn over the floor but clear of the HUD bars. ---
  ctx.fillStyle = 'rgba(238,241,245,0.4)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const room of ROOMS) {
    const ly = room.y < 60 ? 60 : room.y + 8;
    ctx.fillText(room.label, room.x + 10, ly);
  }

  if (screen === SCREEN_TITLE) drawTitle(ctx, best);
  else if (screen === SCREEN_WIN) drawEnd(ctx, true, world, best);
  else if (screen === SCREEN_OVER) drawEnd(ctx, false, world, best);
}

function overlay(ctx) {
  ctx.fillStyle = 'rgba(5, 7, 12, 0.82)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function drawTitle(ctx, best) {
  overlay(ctx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText('IRONVEIL', FIELD.width / 2, 150);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText('The Meridian Vault Heist', FIELD.width / 2, 205);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillText('One thief. One night. The Meridian Diamond sits in the Vault Hall.', FIELD.width / 2, 255);
  ctx.fillText('Lift $40,000 of loot and slip out the Lobby exit before the alarm hits 100.', FIELD.width / 2, 282);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('WIN: carry $40,000 to the EXIT  ·  LOSE: caught by a guard, or alarm 100 (lockdown)', FIELD.width / 2, 340);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillText('Guards patrol with vision cones — stay out of the red. Cameras sweep orange cones.', FIELD.width / 2, 380);
  ctx.fillText('Lasers trip the alarm. Marble floors are loud, carpet is quiet. Shift sneaks.', FIELD.width / 2, 406);
  ctx.fillText('WASD / arrows move · Shift sneak · Click to walk · Space pause · M mute', FIELD.width / 2, 446);
  ctx.fillStyle = PALETTE.thief;
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to start', FIELD.width / 2, 510);
  if (best > 0) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText('Best score: ' + best.toLocaleString('en-US'), FIELD.width / 2, 552);
  }
}

function drawEnd(ctx, won, world, best) {
  const s = world.state;
  overlay(ctx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = won ? PALETTE.alarmOk : PALETTE.alarm;
  ctx.font = '800 56px system-ui, sans-serif';
  ctx.fillText(won ? 'CLEAN GETAWAY' : 'BUSTED', FIELD.width / 2, 170);
  if (!won) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText(s.loseReason, FIELD.width / 2, 225);
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('Rating: ' + world.rating() + '   ·   Loot: ' + money(s.lootValue) + '   ·   Time: ' + fmtTime(s.elapsed), FIELD.width / 2, 285);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillText('Loot ' + money(s.lootValue) + '  +  Combo ' + money(s.comboBonus), FIELD.width / 2, 325);
  if (won) {
    ctx.fillText('Time bonus ' + money(s.timeBonus) + '  +  Ghost bonus ' + money(s.ghostBonus), FIELD.width / 2, 352);
  }
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('SCORE ' + s.score.toLocaleString('en-US'), FIELD.width / 2, 415);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('Best: ' + Math.max(best, s.score).toLocaleString('en-US'), FIELD.width / 2, 460);
  ctx.fillStyle = PALETTE.thief;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.fillText('Press ENTER to play again', FIELD.width / 2, 520);
}
