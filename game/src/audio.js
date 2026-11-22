// Procedural sound: every effect is a short oscillator blip made in code —
// no audio files, no network. Created lazily on the first user gesture so a
// headless run never touches the audio device.
export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx !== null) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, seconds, type, gainValue, slideTo) {
    if (muted) return;
    const ac = ensure();
    if (ac === null) return;
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + seconds);
      gain.gain.setValueAtTime(gainValue, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + seconds);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + seconds);
    } catch {
      // Sound is garnish; a failure here must never break the game.
    }
  }

  return {
    unlock() {
      const ac = ensure();
      if (ac !== null && ac.state === 'suspended') ac.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.12, 1320);
    },
    coin() {
      blip(660, 0.09, 'triangle', 0.09, 990);
    },
    spotted() {
      blip(220, 0.25, 'square', 0.08, 440);
    },
    laser() {
      blip(1400, 0.18, 'sawtooth', 0.06, 300);
    },
    win() {
      blip(523, 0.16, 'sine', 0.12);
      setTimeout(() => blip(659, 0.16, 'sine', 0.12), 140);
      setTimeout(() => blip(784, 0.3, 'sine', 0.12), 280);
    },
    lose() {
      blip(330, 0.4, 'sawtooth', 0.08, 110);
    },
  };
}
