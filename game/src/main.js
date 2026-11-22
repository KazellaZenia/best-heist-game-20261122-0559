// IRONVEIL boot and game loop.
// ?seed=N fixes the random stream. ?shot=start|play|vault|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_LASER, EVENT_OVER, EVENT_PICKUP, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { render, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') ?? '1') || 1;
const shot = params.get('shot');

const canvas = document.getElementById('game');
canvas.width = FIELD.width;
canvas.height = FIELD.height;
const ctx = canvas.getContext('2d');

const world = createWorld(createRandom(seed));
const input = createInput(canvas);
const audio = createAudio();
const statusEl = document.getElementById('status');

let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
} catch {
  best = 0;
}

let screen = SCREEN_TITLE;
let paused = false;
let accumulator = 0;
let lastTime = 0;
let shotDone = false;

function saveBest() {
  const score = world.state.score;
  if (score > best) {
    best = score;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Best score is a nicety; a storage failure must not break the game.
    }
  }
}

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startGame() {
  world.reset();
  screen = SCREEN_PLAY;
  paused = false;
  audio.unlock();
  announce('Heist started. Lift $40,000 of loot and reach the exit.');
}

function handleEvents(events) {
  if (events & EVENT_PICKUP) {
    audio.pickup();
    const s = world.state;
    announce('Loot grabbed: ' + s.lootValue.toLocaleString('en-US') + ' dollars carried.');
  }
  if (events & EVENT_SPOTTED) {
    audio.spotted();
    announce('Spotted! A guard is chasing you.');
  }
  if (events & EVENT_LASER) {
    audio.laser();
    announce('Laser tripped! Alarm rising.');
  }
  if (events & EVENT_WIN) {
    audio.win();
    saveBest();
    screen = SCREEN_WIN;
    announce('Clean getaway! Score ' + world.state.score + '.');
  }
  if (events & EVENT_OVER) {
    audio.lose();
    saveBest();
    screen = SCREEN_OVER;
    announce('Busted. ' + world.state.loseReason);
  }
}

function frame(time) {
  const dt = Math.min(0.1, (time - lastTime) / 1000 || 0);
  lastTime = time;
  const pressed = input.takePressed();
  for (const key of pressed) {
    if (key === 'enter') {
      if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_OVER) startGame();
    } else if (key === ' ') {
      if (screen === SCREEN_PLAY) paused = !paused;
    } else if (key === 'm') {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    } else if (key === 'escape') {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_TITLE;
        world.state.status = 'title';
      }
    }
  }
  if (screen === SCREEN_PLAY && !paused) {
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const move = input.state;
      const events = world.step(STEP, move.moveX, move.moveY, move.sneak, move.target);
      if (move.target && Number.isNaN(move.target.x)) input.clearTarget();
      handleEvents(events);
      if (world.state.status !== 'play') break;
    }
  }
  render(ctx, world, screen, best);
  if (!shot) window.requestAnimationFrame(frame);
}

function runShot(name) {
  const staged = stageShot(name, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  render(ctx, world, screen, best);
  render(ctx, world, screen, best);
  window.__shotReady = true;
}

if (shot) runShot(shot);
else window.requestAnimationFrame(frame);

// Test hook: lets an automated play-test read live state (position, alarm,
// guard states, loot). Read-only from the page's point of view; the game
// itself never reads it.
window.__ironveil = {
  world,
  get screen() {
    return screen;
  },
  get best() {
    return best;
  },
};
