// The screenshot scenes behind ?shot=start|play|vault|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot, so the frame is what a short game really looks like and
// the same seed always gives the same frame. The play and vault scenes keep the
// thief alive long enough to show the room, the guard cones, the cameras, the
// loot and the alarm meter in one frame; the end scene's pilot is reckless, so
// it gets caught and the frame shows the game-over screen.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const VAULT_SECONDS = 34;
const END_LIMIT_SECONDS = 120;

/** Steer toward a target point, veering away from any guard cone that covers it. */
function autopilot(state, targetX, targetY, reckless) {
  const thief = state.thief;
  const dx = targetX - thief.x;
  const dy = targetY - thief.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) return { x: 0, y: 0 };
  let mx = dx / dist;
  let my = dy / dist;
  if (!reckless) {
    // If a guard is close and looking our way, sidestep perpendicular.
    for (const g of state.guards) {
      const gd = Math.hypot(g.x - thief.x, g.y - thief.y);
      if (gd < 150) {
        const awayX = thief.x - g.x;
        const awayY = thief.y - g.y;
        const al = Math.hypot(awayX, awayY) || 1;
        mx = (mx + (awayX / al) * 1.4) / 2.4;
        my = (my + (awayY / al) * 1.4) / 2.4;
        const len = Math.hypot(mx, my) || 1;
        mx /= len;
        my /= len;
      }
    }
  }
  return { x: mx, y: my };
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
  for (let i = 0; i < limit / STEP; i += 1) {
    let target = vaultTarget;
    if (name !== 'vault') {
      const item = nearestLoot(state);
      if (item) target = item;
    }
    const move = autopilot(state, target.x, target.y, reckless);
    const sneak = !reckless && state.thief.noiseRadius > 0 && state.guards.some(
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
