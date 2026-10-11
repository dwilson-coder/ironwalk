// Fully synthesized sound effects (Web Audio). No audio files needed.
// Browsers only allow audio after a user gesture, so init() is called from the Deploy button.

export function createAudio() {
  let ac = null, master = null, noiseBuf = null, jetGain = null, muted = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.45; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // continuous jet rumble, volume driven by thrust
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
      jetGain = ac.createGain(); jetGain.gain.value = 0;
      src.connect(lp).connect(jetGain).connect(master); src.start();
    } catch (e) { ac = null; }
  }

  function noise(dur, type, f0, f1, vol, q = 1) {
    const t = ac.currentTime, s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur);
  }
  function tone(dur, type, f0, f1, vol) {
    const t = ac.currentTime, o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  }

  function sfx(k) {
    if (!ac || muted || ac.state !== 'running') return;
    switch (k) {
      case 'gun': noise(0.07, 'bandpass', 2400, 900, 0.32, 0.9); tone(0.06, 'square', 120, 50, 0.08); break;
      case 'rocket': noise(0.45, 'bandpass', 500, 1800, 0.22, 1.5); break;
      case 'boom': noise(1.1, 'lowpass', 900, 60, 0.9); tone(0.6, 'sine', 70, 28, 0.6); break;
      case 'small': noise(0.5, 'lowpass', 1400, 120, 0.5); break;
      case 'hurt': tone(0.18, 'sawtooth', 180, 60, 0.18); noise(0.15, 'highpass', 3000, 2000, 0.15); break;
      case 'stomp': tone(0.5, 'sine', 80, 26, 0.8); noise(0.4, 'lowpass', 500, 60, 0.6); break;
      case 'vent': noise(1.2, 'highpass', 5000, 2500, 0.18); break;
      case 'dash': noise(0.3, 'bandpass', 800, 2600, 0.25, 2); break;
      case 'enemy': tone(0.12, 'square', 520, 260, 0.06); break;
      case 'combo': tone(0.12, 'triangle', 660, 990, 0.08); break;
      case 'clear': tone(0.25, 'triangle', 440, 660, 0.12); setTimeout(() => ac && tone(0.35, 'triangle', 660, 880, 0.12), 160); break;
      case 'ui': tone(0.06, 'square', 900, 700, 0.05); break;
      case 'scatter': noise(0.18, 'lowpass', 2200, 300, 0.55); tone(0.12, 'square', 90, 40, 0.15); break;
      case 'rail': tone(0.35, 'sawtooth', 1800, 120, 0.12); noise(0.25, 'highpass', 6000, 1500, 0.25); tone(0.4, 'sine', 90, 40, 0.4); break;
      case 'mortar': tone(0.3, 'sine', 120, 50, 0.5); noise(0.4, 'lowpass', 800, 100, 0.4); break;
      case 'barrier': tone(0.5, 'triangle', 220, 660, 0.12); tone(0.5, 'sine', 330, 990, 0.08); break;
      case 'block': tone(0.08, 'triangle', 1400, 900, 0.08); break;
      case 'pickup': tone(0.1, 'triangle', 520, 780, 0.12); setTimeout(() => ac && tone(0.14, 'triangle', 780, 1170, 0.12), 90); break;
      case 'alarm': tone(0.35, 'square', 440, 330, 0.07); setTimeout(() => ac && tone(0.35, 'square', 440, 330, 0.07), 420); break;
      case 'skill': tone(0.4, 'sawtooth', 160, 640, 0.1); tone(0.5, 'sine', 320, 1280, 0.08); noise(0.3, 'bandpass', 600, 3000, 0.12, 2); break;
      // pilot sidearms
      case 'pistol': noise(0.08, 'bandpass', 3200, 1200, 0.22, 1.2); tone(0.05, 'square', 260, 90, 0.05); break;
      case 'smg': noise(0.05, 'bandpass', 3800, 1600, 0.14, 1.2); break;
      case 'shotgun': noise(0.2, 'lowpass', 2600, 300, 0.4); tone(0.1, 'square', 140, 50, 0.1); break;
      // Phase 3 / 4
      case 'shield': tone(0.6, 'sine', 180, 720, 0.12); tone(0.6, 'triangle', 360, 1440, 0.06); break;
      case 'freeze': tone(0.7, 'sine', 1800, 300, 0.1); noise(0.6, 'highpass', 7000, 3000, 0.15); break;
      case 'eject': noise(0.35, 'bandpass', 1200, 300, 0.4, 1.5); tone(0.25, 'square', 600, 200, 0.06); break;
      case 'secret': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => ac && tone(0.18, 'triangle', f, f, 0.1), i * 90)); break;
      case 'life': tone(0.2, 'triangle', 440, 880, 0.12); setTimeout(() => ac && tone(0.3, 'triangle', 660, 1320, 0.12), 140); break;
      case 'bossIntro': tone(1.6, 'sawtooth', 55, 40, 0.25); tone(1.6, 'square', 82, 60, 0.08); noise(1.2, 'lowpass', 300, 60, 0.4); break;
      default: break;
    }
  }

  return {
    init,
    sfx,
    setJet(v) { if (jetGain) jetGain.gain.value = muted ? 0 : jetGain.gain.value + (v - jetGain.gain.value) * 0.2; },
    setMuted(m) { muted = m; if (jetGain) jetGain.gain.value = 0; },
    get muted() { return muted; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); if (jetGain) jetGain.gain.value = 0; },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
    dispose() { if (ac) ac.close(); ac = null; },
  };
}
