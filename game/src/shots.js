// The screenshot scenes behind ?shot=start|play|vault|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame. The play and vault scenes keep the
// thief alive long enough to show the room, the guard cones, the cameras, the
// loot and the alarm meter in one frame; the end scene's pilot is reckless, so
// it gets caught and the frame shows the game-over screen.
//
// The pilot routes through the door gaps between rooms (a straight line gets
// stuck on a wall: the thief pushes up against it forever), and veers away
// from any guard cone that covers its path — unless it is reckless.
import { FIELD, ROOMS, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const VAULT_SECONDS = 34;
const END_LIMIT_SECONDS = 180;

/** Door gaps between rooms, as graph edges: [roomA, roomB, x, y]. */
const DOORS = [
  ['GALLERY', 'LOBBY', 230, 338],
  ['GALLERY', 'ATRIUM', 428, 330],
  ['LOBBY', 'ATRIUM', 428, 360],
  ['ATRIUM', 'VAULT', 868, 310],
  ['ATRIUM', 'SERVER', 868, 380],
  ['VAULT', 'SERVER', 1050, 368],
];

function roomAt(x, y) {
  for (const room of ROOMS) {
    if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) return room.name;
  }
  // In a doorway or against a wall: nearest room centre wins.
  let bestRoom = ROOMS[0].name;
  let bestDist = Infinity;
  for (const room of ROOMS) {
    const cx = room.x + room.w / 2;
    const cy = room.y + room.h / 2;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestDist) {
      bestDist = d;
      bestRoom = room.name;
    }
  }
  return bestRoom;
}

/** Shortest room path (BFS) as a list of door points from `from` room to `to` room. */
function route(fromRoom, toRoom) {
  if (fromRoom === toRoom) return [];
  const prev = new Map([[fromRoom, null]]);
  const queue = [fromRoom];
  while (queue.length > 0) {
    const room = queue.shift();
    for (const [a, b, x, y] of DOORS) {
      const next = a === room ? b : b === room ? a : null;
      if (next === null || prev.has(next)) continue;
      prev.set(next, { room, x, y });
      if (next === toRoom) {
        const points = [];
        let cur = next;
        while (prev.get(cur) !== null) {
          const step = prev.get(cur);
          points.unshift({ x: step.x, y: step.y });
          cur = step.room;
        }
        return points;
      }
      queue.push(next);
    }
  }
  return [];
}

/** Steer toward a target point, veering away from any guard cone that covers it. */
function autopilot(state, targetX, targetY, reckless, waypoints) {
  const thief = state.thief;
  // Follow the route's next door; when close enough, drop it.
  while (waypoints.length > 0) {
    const wp = waypoints[0];
    if (Math.hypot(wp.x - thief.x, wp.y - thief.y) < 24) waypoints.shift();
    else break;
  }
  const goal = waypoints.length > 0 ? waypoints[0] : { x: targetX, y: targetY };
  const dx = goal.x - thief.x;
  const dy = goal.y - thief.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) return { x: 0, y: 0 };
  let mx = dx / dist;
  let my = dy / dist;
  if (reckless) {
    // A chasing guard means run straight at it: thief and guard close at
    // 340 px/s and meet, instead of the thief freezing on the far side of a
    // wall the guard's straight-line chase can never cross.
    for (const g of state.guards) {
      if (g.state !== 'chase') continue;
      const gd = Math.hypot(g.x - thief.x, g.y - thief.y);
      if (gd < 400) {
        const tx = g.x - thief.x;
        const ty = g.y - thief.y;
        const tl = Math.hypot(tx, ty) || 1;
        return { x: tx / tl, y: ty / tl };
      }
    }
  }
  if (!reckless) {
    // A chasing guard means run: flee straight away from it at full speed.
    for (const g of state.guards) {
      if (g.state !== 'chase') continue;
      const gd = Math.hypot(g.x - thief.x, g.y - thief.y);
      if (gd < 260) {
        const awayX = thief.x - g.x;
        const awayY = thief.y - g.y;
        const al = Math.hypot(awayX, awayY) || 1;
        return { x: awayX / al, y: awayY / al };
      }
    }
    // A guard close and looking this way is danger: push hard away from it,
    // more than the goal pulls. Standing still in its path is what gets a
    // thief caught, so the pilot never freezes in front of a patrol.
    for (const g of state.guards) {
      const gd = Math.hypot(g.x - thief.x, g.y - thief.y);
      if (gd >= 210) continue;
      const toThief = Math.atan2(thief.y - g.y, thief.x - g.x);
      let diff = toThief - g.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.8) continue;
      const awayX = thief.x - g.x;
      const awayY = thief.y - g.y;
      const al = Math.hypot(awayX, awayY) || 1;
      mx = (mx + (awayX / al) * 3.0) / 4.0;
      my = (my + (awayY / al) * 3.0) / 4.0;
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;
    }
  }
  return { x: mx, y: my };
}

function nearestGuard(state) {
  let bestGuard = null;
  let bestDist = Infinity;
  for (const g of state.guards) {
    const d = Math.hypot(g.x - state.thief.x, g.y - state.thief.y);
    if (d < bestDist) {
      bestDist = d;
      bestGuard = g;
    }
  }
  return bestGuard;
}

function nearestLoot(state) {
  let bestItem = null;
  let bestDist = Infinity;
  for (const item of state.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - state.thief.x, item.y - state.thief.y);
    if (d < bestDist) {
      bestDist = d;
      bestItem = item;
    }
  }
  return bestItem;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Any unknown name stages the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'vault' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, 0, false, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const reckless = name === 'end';
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'vault' ? VAULT_SECONDS : PLAY_SECONDS;
  // The vault scene aims straight at the Meridian Diamond in the Vault Hall.
  const vaultTarget = { x: 1150, y: 120 };
  let over = false;
  let won = false;
  let waypoints = [];
  let currentTarget = null;
  for (let i = 0; i < limit / STEP; i += 1) {
    let target = vaultTarget;
    if (name !== 'vault') {
      const item = nearestLoot(state);
      if (item) target = item;
    }
    // The end scene's pilot plays badly on purpose: after 20 seconds it runs
    // straight at a point in FRONT of the nearest guard, into its vision
    // cone, so the real rules spot it, give chase and catch it — and the
    // frame shows the game-over screen. (Running at the guard itself just
    // sticks the thief to its back, where no cone ever sees it.)
    if (name === 'end' && state.elapsed > 20) {
      const guard = nearestGuard(state);
      if (guard) {
        target = {
          x: Math.max(30, Math.min(FIELD.width - 30, guard.x + Math.cos(guard.angle) * 120)),
          y: Math.max(60, Math.min(FIELD.height - 30, guard.y + Math.sin(guard.angle) * 120)),
        };
      }
    }
    if (!currentTarget || currentTarget.x !== target.x || currentTarget.y !== target.y) {
      currentTarget = target;
      waypoints = route(roomAt(state.thief.x, state.thief.y), roomAt(target.x, target.y));
    }
    const move = autopilot(state, target.x, target.y, reckless, waypoints);
    const sneak = !reckless && state.guards.some(
      (g) => Math.hypot(g.x - state.thief.x, g.y - state.thief.y) < 130,
    );
    const events = world.step(STEP, move.x, move.y, sneak, null);
    if (events & EVENT_OVER) {
      over = true;
      break;
    }
    if (events & EVENT_WIN) {
      won = true;
      break;
    }
  }
  if (won) return { screen: SCREEN_WIN, best: state.score };
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}
