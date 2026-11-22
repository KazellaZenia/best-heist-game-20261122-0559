// IRONVEIL's rules and state, with no drawing and no browser in it: the thief,
// four named guards with patrol / suspicious / chase / search states, sweeping
// CCTV cameras, cycling laser beams, six named treasures, the alarm meter, noise
// by floor type, score, combo and the GHOST / SHADOW / DETECTED rating.
// step() advances one fixed step and returns what happened as bit flags, so the
// caller can react without the world knowing about screens or sound.
import {
  ALARM_MAX, CAMERA, CAMERAS, DOORS, EXIT, FIELD, FLOOR_NOISE, GUARD,
  GUARDS, LASER, LASERS, LOOT, LOOT_TARGET, ROOMS, THIEF, THIEF_START, WALLS,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_LASER = 4;
export const EVENT_WIN = 8;
export const EVENT_OVER = 16;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function pointInWall(x, y) {
  for (let i = 0; i < WALLS.length; i += 1) {
    const w = WALLS[i];
    if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true;
  }
  return false;
}

/** True when the segment a->b is not cut by any wall (sampled, cheap and exact enough). */
export function hasLineOfSight(ax, ay, bx, by) {
  const steps = 26;
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInWall(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
  }
  return true;
}

function circleHitsWall(x, y, r) {
  for (let i = 0; i < WALLS.length; i += 1) {
    const w = WALLS[i];
    const cx = Math.max(w.x, Math.min(x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(y, w.y + w.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

function moveCircle(body, dx, dy, r) {
  const nx = body.x + dx;
  if (!circleHitsWall(nx, body.y, r)) body.x = nx;
  const ny = body.y + dy;
  if (!circleHitsWall(body.x, ny, r)) body.y = ny;
  body.x = Math.max(r, Math.min(FIELD.width - r, body.x));
  body.y = Math.max(r, Math.min(FIELD.height - r, body.y));
}

export function floorAt(x, y) {
  for (let i = 0; i < ROOMS.length; i += 1) {
    const r = ROOMS[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.floor;
  }
  return 'tile';
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

export function createWorld(random) {
  const thief = {
    x: THIEF_START.x, y: THIEF_START.y, radius: THIEF.radius,
    moving: false, noiseRadius: 0, sneaking: false,
  };
  const guards = GUARDS.map((g) => ({
    name: g.name,
    waypoints: g.waypoints,
    x: g.waypoints[0][0], y: g.waypoints[0][1],
    radius: GUARD.radius,
    angle: 0, wpIndex: 1, state: 'patrol',
    suspicion: 0, lastSeenX: 0, lastSeenY: 0, loseTimer: 0, searchTimer: 0,
  }));
  const cameras = CAMERAS.map((c) => ({ ...c, angle: c.baseAngle }));
  const lasers = LASERS.map((l) => ({ ...l, active: true, tripped: false }));
  const loot = LOOT.map((l) => ({ ...l, taken: false }));
  const state = {
    thief, guards, cameras, lasers, loot,
    status: 'title', loseReason: '',
    alarm: 0, maxAlarm: 0, seen: false, spotted: false,
    lootValue: 0, comboChain: 0, comboTimer: 0, comboBonus: 0,
    score: 0, elapsed: 0, best: 0, timeBonus: 0, ghostBonus: 0,
  };

  function reset() {
    thief.x = THIEF_START.x;
    thief.y = THIEF_START.y;
    thief.moving = false;
    thief.noiseRadius = 0;
    thief.sneaking = false;
    for (const g of guards) {
      g.x = g.waypoints[0][0];
      g.y = g.waypoints[0][1];
      g.angle = 0;
      g.wpIndex = 1;
      g.state = 'patrol';
      g.suspicion = 0;
      g.loseTimer = 0;
      g.searchTimer = 0;
    }
    for (const c of cameras) c.angle = c.baseAngle;
    for (const l of lasers) {
      l.active = true;
      l.tripped = false;
    }
    for (const item of loot) item.taken = false;
    state.status = 'play';
    state.loseReason = '';
    state.alarm = 0;
    state.maxAlarm = 0;
    state.seen = false;
    state.spotted = false;
    state.lootValue = 0;
    state.comboChain = 0;
    state.comboTimer = 0;
    state.comboBonus = 0;
    state.score = 0;
    state.elapsed = 0;
    state.timeBonus = 0;
    state.ghostBonus = 0;
  }

  function guardSees(g) {
    const dx = thief.x - g.x;
    const dy = thief.y - g.y;
    const dist = Math.hypot(dx, dy);
    if (dist > GUARD.visionRange) return false;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), g.angle)) > GUARD.visionHalfAngle) return false;
    return hasLineOfSight(g.x, g.y, thief.x, thief.y);
  }

  function cameraSees(c) {
    const dx = thief.x - c.x;
    const dy = thief.y - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CAMERA.range) return false;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), c.angle)) > CAMERA.halfAngle) return false;
    return hasLineOfSight(c.x, c.y, thief.x, thief.y);
  }

  function rating() {
    if (!state.seen) return 'GHOST';
    return state.status === 'win' ? 'SHADOW' : 'DETECTED';
  }

  function finishWin() {
    state.status = 'win';
    state.timeBonus = Math.max(0, Math.round((300 - state.elapsed) * 10));
    state.ghostBonus = state.seen ? 0 : 5000;
    state.score = state.lootValue + state.comboBonus + state.timeBonus + state.ghostBonus;
    return EVENT_WIN;
  }

  function finishLose(reason) {
    state.status = 'lose';
    state.loseReason = reason;
    state.score = state.lootValue + state.comboBonus;
    return EVENT_OVER;
  }

  function step(dt, moveX, moveY, sneak, target) {
    if (state.status !== 'play') return 0;
    let events = 0;
    state.elapsed += dt;

    // --- Thief movement: keyboard vector, else click-to-move target. ---
    let mx = moveX;
    let my = moveY;
    if (mx === 0 && my === 0 && target) {
      const dx = target.x - thief.x;
      const dy = target.y - thief.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) {
        target.x = NaN; // arrived; main.js clears the target on NaN
      } else {
        mx = dx / d;
        my = dy / d;
      }
    }
    const speed = sneak ? THIEF.sneakSpeed : THIEF.speed;
    thief.moving = mx !== 0 || my !== 0;
    thief.sneaking = sneak;
    if (thief.moving) moveCircle(thief, mx * speed * dt, my * speed * dt, thief.radius);

    // --- Noise: floor type x speed. Guards inside the ring get suspicious. ---
    const baseNoise = FLOOR_NOISE[floorAt(thief.x, thief.y)] ?? 58;
    thief.noiseRadius = thief.moving ? baseNoise * (sneak ? 0.45 : 1) : 0;
    if (thief.moving) {
      for (const g of guards) {
        if (g.state === 'chase') continue;
        const d = Math.hypot(g.x - thief.x, g.y - thief.y);
        if (d < thief.noiseRadius) {
          g.suspicion = Math.min(100, g.suspicion + 45 * dt);
          g.lastSeenX = thief.x;
          g.lastSeenY = thief.y;
          if (g.suspicion > 45 && g.state === 'patrol') g.state = 'suspicious';
        }
      }
    }

    // --- Cameras sweep; a camera that sees the thief feeds the alarm. ---
    let watched = false;
    for (const c of cameras) {
      c.angle = c.baseAngle + Math.sin(state.elapsed * CAMERA.sweepSpeed) * CAMERA.sweepArc;
      if (cameraSees(c)) {
        watched = true;
        state.seen = true;
        state.alarm = Math.min(ALARM_MAX, state.alarm + CAMERA.alarmPerSecond * dt);
      }
    }

    // --- Lasers cycle; crossing a live beam spikes the alarm. ---
    const cycle = LASER.onSeconds + LASER.offSeconds;
    for (const l of lasers) {
      const on = ((state.elapsed + l.phase) % cycle) < LASER.onSeconds;
      l.active = on;
      if (!on) {
        l.tripped = false;
        continue;
      }
      if (!l.tripped && distToSegment(thief.x, thief.y, l.x1, l.y1, l.x2, l.y2) < thief.radius + 2) {
        l.tripped = true;
        state.seen = true;
        state.alarm = Math.min(ALARM_MAX, state.alarm + LASER.alarmTrip);
        events |= EVENT_LASER;
      }
    }

    // --- Guards: vision, suspicion, chase, search. ---
    for (const g of guards) {
      const sees = guardSees(g);
      if (sees) {
        g.lastSeenX = thief.x;
        g.lastSeenY = thief.y;
        g.loseTimer = 0;
        state.seen = true;
        g.suspicion = Math.min(100, g.suspicion + GUARD.suspicionPerSecond * dt);
        state.alarm = Math.min(ALARM_MAX, state.alarm + 10 * dt);
        if (g.suspicion >= 100 && g.state !== 'chase') {
          g.state = 'chase';
          events |= EVENT_SPOTTED;
        }
      } else if (g.state !== 'chase') {
        g.suspicion = Math.max(0, g.suspicion - GUARD.suspicionDecay * dt);
        if (g.state === 'suspicious' && g.suspicion < 10) g.state = 'patrol';
      }

      if (g.state === 'patrol') {
        const wp = g.waypoints[g.wpIndex];
        const dx = wp[0] - g.x;
        const dy = wp[1] - g.y;
        const d = Math.hypot(dx, dy);
        if (d < 8) {
          g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        } else {
          g.angle = Math.atan2(dy, dx);
          moveCircle(g, (dx / d) * GUARD.patrolSpeed * dt, (dy / d) * GUARD.patrolSpeed * dt, g.radius);
        }
      } else if (g.state === 'suspicious') {
        g.angle = Math.atan2(g.lastSeenY - g.y, g.lastSeenX - g.x);
      } else if (g.state === 'chase') {
        const dx = thief.x - g.x;
        const dy = thief.y - g.y;
        const d = Math.hypot(dx, dy);
        g.angle = Math.atan2(dy, dx);
        if (d < THIEF.catchDistance) return finishLose('Caught by ' + g.name + ' — the crew is in custody.');
        if (!sees) {
          g.loseTimer += dt;
          if (g.loseTimer > GUARD.chaseMemory) {
            g.state = 'search';
            g.searchTimer = 0;
          }
        }
        moveCircle(g, (dx / d) * GUARD.chaseSpeed * dt, (dy / d) * GUARD.chaseSpeed * dt, g.radius);
      } else if (g.state === 'search') {
        const dx = g.lastSeenX - g.x;
        const dy = g.lastSeenY - g.y;
        const d = Math.hypot(dx, dy);
        if (d > 10) {
          g.angle = Math.atan2(dy, dx);
          moveCircle(g, (dx / d) * GUARD.searchSpeed * dt, (dy / d) * GUARD.searchSpeed * dt, g.radius);
        } else {
          g.searchTimer += dt;
          g.angle += dt * 1.6;
          if (g.searchTimer > GUARD.searchTime) {
            g.state = 'patrol';
            g.suspicion = 25;
          }
        }
      }
    }

    // --- Alarm decays when nobody is watching; at 100 the vault locks down. ---
    if (!watched) state.alarm = Math.max(0, state.alarm - 7 * dt);
    state.maxAlarm = Math.max(state.maxAlarm, state.alarm);
    if (state.alarm >= ALARM_MAX) return finishLose('Alarm hit 100 — lockdown. The vault sealed with the crew inside.');

    // --- Loot pickup with a combo chain for quick successive grabs. ---
    if (state.comboTimer > 0) state.comboTimer -= dt;
    else state.comboChain = 0;
    for (const item of loot) {
      if (item.taken) continue;
      if (Math.hypot(item.x - thief.x, item.y - thief.y) < 26) {
        item.taken = true;
        state.comboChain += 1;
        state.comboTimer = 8;
        const bonus = state.comboChain > 1 ? (state.comboChain - 1) * 250 : 0;
        state.comboBonus += bonus;
        state.lootValue += item.value;
        state.score = state.lootValue + state.comboBonus;
        events |= EVENT_PICKUP;
      }
    }

    // --- Exit opens at the loot target; stepping in with the haul wins. ---
    if (state.lootValue >= LOOT_TARGET) {
      if (thief.x >= EXIT.x && thief.x <= EXIT.x + EXIT.w && thief.y >= EXIT.y && thief.y <= EXIT.y + EXIT.h) {
        return finishWin() | events;
      }
    }

    state.spotted = state.guards.some((g) => g.state === 'chase');
    return events;
  }

  return { state, reset, step, rating, floorAt };
}
