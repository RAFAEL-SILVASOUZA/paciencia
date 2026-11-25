// Efeitos sonoros procedurais via WebAudio — sem arquivos externos (offline-friendly).
// Preferências persistidas em localStorage; nunca lança se o navegador não suportar.

const STORAGE_KEY = 'paciencia.som';

let ctx = null;
let noiseBuf = null;

function safeStorage() {
  try {
    const s = window.localStorage;
    return s || null;
  } catch {
    return null;
  }
}

export function isSoundEnabled() {
  let raw = null;
  try {
    raw = safeStorage()?.getItem(STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  return raw === null ? true : raw === '1';
}

export function setSoundEnabled(on) {
  try {
    safeStorage()?.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // armazenamento indisponível: só não persiste
  }
}

function audio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function tone({ freq, freqEnd = null, type = 'triangle', dur = 0.1, gain = 0.06, when = 0.01 }) {
  if (!isSoundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // áudio indisponível: silêncio
  }
}

function noise({ dur = 0.12, gain = 0.05, from = 500, to = 1500, when = 0.01 }) {
  if (!isSoundEnabled()) return;
  const ac = audio();
  if (!ac) return;
  try {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.3), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ac.currentTime + when;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(ac.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  } catch {
    // áudio indisponível: silêncio
  }
}

export const sfx = {
  draw() {
    noise({ dur: 0.14, gain: 0.05, from: 400, to: 1400 });
  },
  place() {
    tone({ freq: 620, freqEnd: 440, dur: 0.09, gain: 0.07 });
    noise({ dur: 0.05, gain: 0.03, from: 1800, to: 900, when: 0.02 });
  },
  flip() {
    tone({ freq: 900, freqEnd: 1250, dur: 0.07, gain: 0.045 });
  },
  shuffle() {
    for (let i = 0; i < 3; i++) {
      noise({ dur: 0.07, gain: 0.045, from: 600, to: 1600, when: 0.05 + i * 0.09 });
    }
  },
  undo() {
    tone({ freq: 520, freqEnd: 330, dur: 0.12, gain: 0.05 });
  },
  error() {
    tone({ freq: 150, type: 'square', dur: 0.12, gain: 0.035 });
  },
  over() {
    tone({ freq: 392, dur: 0.18, gain: 0.05, when: 0.0 });
    tone({ freq: 311, dur: 0.24, gain: 0.05, when: 0.18 });
  },
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.4, gain: 0.07, when: i * 0.13 }));
    notes.forEach((f) => tone({ freq: f / 2, dur: 0.55, gain: 0.03, when: 0.52 }));
  },
};
