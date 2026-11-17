// Sound, all synthesized with WebAudio: no audio files ship with the game. The context
// is created lazily on the first user gesture (browsers block audio before one), and
// every effect is a short oscillator or noise burst through a master gain.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
    return true;
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ensure() || muted) return;
    const t = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function noise(duration, volume, filterFreq) {
    if (!ensure() || muted) return;
    const t = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  return {
    /** Call on any gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(880, 0.07, 'square', 0.12, 320);
    },
    enemyDie() {
      noise(0.16, 0.25, 1400);
      tone(180, 0.14, 'sine', 0.2, 60);
    },
    playerHit() {
      tone(140, 0.25, 'sawtooth', 0.28, 50);
      noise(0.2, 0.2, 700);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.2);
      setTimeout(() => tone(990, 0.12, 'sine', 0.2), 70);
    },
    shard() {
      tone(1320, 0.05, 'sine', 0.08, 1760);
    },
    dash() {
      noise(0.12, 0.16, 3200);
    },
    waveHorn() {
      tone(220, 0.3, 'triangle', 0.22, 330);
      setTimeout(() => tone(330, 0.3, 'triangle', 0.18, 440), 140);
    },
    waveClear() {
      tone(523, 0.1, 'sine', 0.18);
      setTimeout(() => tone(659, 0.1, 'sine', 0.18), 90);
      setTimeout(() => tone(784, 0.16, 'sine', 0.18), 180);
    },
    upgrade() {
      tone(523, 0.1, 'sine', 0.2);
      setTimeout(() => tone(659, 0.1, 'sine', 0.2), 80);
      setTimeout(() => tone(784, 0.1, 'sine', 0.2), 160);
      setTimeout(() => tone(1047, 0.18, 'sine', 0.2), 240);
    },
    gameOver() {
      tone(392, 0.22, 'triangle', 0.22, 370);
      setTimeout(() => tone(311, 0.22, 'triangle', 0.22, 294), 200);
      setTimeout(() => tone(233, 0.45, 'triangle', 0.22, 196), 400);
    },
  };
}
