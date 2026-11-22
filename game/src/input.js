// Keyboard + mouse input. WASD / arrows move, Shift sneaks (slow, quiet),
// mouse click (or touch tap) sets a move target, Space pauses, M mutes,
// Enter starts / restarts, Esc returns to the title screen.
export function createInput(canvas) {
  const keys = new Set();
  const state = { moveX: 0, moveY: 0, sneak: false, target: null };

  function recompute() {
    let x = 0;
    let y = 0;
    if (keys.has('arrowleft') || keys.has('a')) x -= 1;
    if (keys.has('arrowright') || keys.has('d')) x += 1;
    if (keys.has('arrowup') || keys.has('w')) y -= 1;
    if (keys.has('arrowdown') || keys.has('s')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    state.moveX = x;
    state.moveY = y;
    state.sneak = keys.has('shift');
  }

  const pressed = new Set();
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (!event.repeat) pressed.add(key);
    keys.add(key);
    recompute();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
    recompute();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    recompute();
  });

  function setTarget(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    state.target = {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }
  canvas.addEventListener('pointerdown', (event) => setTarget(event.clientX, event.clientY));

  return {
    state,
    /** Keys pressed since the last call (consumed). */
    takePressed() {
      const out = [...pressed];
      pressed.clear();
      return out;
    },
    clearTarget() {
      state.target = null;
    },
  };
}
