// ============================================================
// Web Audio API Synthesizer — Kid-Friendly Sound Effects
// ============================================================

const SoundEffects = (() => {
  let ctx = null;

  function getContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  // 1. Cheerful sparkle chime on correct answer ✨
  function playCorrect() {
    const c = getContext();
    if (!c) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, c.currentTime + i * 0.08);

      gain.gain.setValueAtTime(0, c.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.3, c.currentTime + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(c.currentTime + i * 0.08);
      osc.stop(c.currentTime + i * 0.08 + 0.4);
    });
  }

  // 2. Gentle bubbly "try again" sound 🎈 (gentle for kids)
  function playTryAgain() {
    const c = getContext();
    if (!c) return;

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.25);

    gain.gain.setValueAtTime(0.25, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.3);
  }

  // 3. Star Pop Sound ⭐
  function playStar() {
    const c = getContext();
    if (!c) return;

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, c.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.25);
  }

  // 4. Level Victory Fanfare 🎉
  function playVictory() {
    const c = getContext();
    if (!c) return;

    const melody = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.15 }, // G5
      { f: 1046.50, d: 0.4 }, // C6
      { f: 880.00, d: 0.15 }, // A5
      { f: 1046.50, d: 0.6 }  // C6 (hold)
    ];

    let t = c.currentTime + 0.05;
    melody.forEach(n => {
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

      osc.connect(gain);
      gain.connect(c.destination);

      osc.start(t);
      osc.stop(t + n.d);

      t += n.d * 0.9;
    });
  }

  // 5. Click Bubble Sound 🫧
  function playBubble() {
    const c = getContext();
    if (!c) return;

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(c.destination);

    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.1);
  }

  return {
    playCorrect,
    playTryAgain,
    playStar,
    playVictory,
    playBubble
  };
})();
