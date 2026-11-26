const STORAGE_KEY = 'soundEnabled'; // "true" | "false"
export const SOUND_EVENT = 'ranking-sound-change';

let audioCtx = null;
let noiseBuffer = null;

/** Verifica se o áudio está habilitado (padrão inicial: true). */
export function isSoundEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** Altera e persiste a preferência de som em localStorage. */
export function setSoundEnabled(enabled) {
  const value = enabled ? 'true' : 'false';
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Armazenamento indisponível: mantém apenas na sessão
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: enabled }));
  }
}

function getContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;

  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

// Desbloqueia o AudioContext no primeiro toque/clique da sessão (mobile/Safari)
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (isSoundEnabled()) getContext();
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function getNoiseBuffer(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.12);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

function playTone(ctx, { freq, endFreq, type = 'triangle', start, duration, gain = 0.1 }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  }

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.linearRampToValueAtTime(gain, start + Math.min(0.012, duration * 0.25));
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp);
  amp.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + duration + 0.01);
}

/**
 * Som seco e rápido de carta deslizando/batendo na mesa.
 */
export function playCardMove() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Fricção curta de papel/cartão
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.045);
    filter.Q.value = 1.4;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.075, now + 0.006);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.05);

    // Toque seco de peça na mesa
    playTone(ctx, {
      freq: 175,
      endFreq: 80,
      type: 'triangle',
      start: now,
      duration: 0.045,
      gain: 0.08,
    });
  } catch {
    // Ignora falhas de áudio do navegador
  }
}

/**
 * Som suave de virada/clique de carta ao mostrar os palpites da rodada.
 */
export function playRevealGuesses() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    playTone(ctx, {
      freq: 310,
      endFreq: 540,
      type: 'triangle',
      start: now,
      duration: 0.085,
      gain: 0.11,
    });
    playTone(ctx, {
      freq: 620,
      endFreq: 780,
      type: 'sine',
      start: now + 0.03,
      duration: 0.07,
      gain: 0.06,
    });
  } catch {
    // Ignora falhas de áudio do navegador
  }
}

/**
 * Som de revelação da posição oficial do Juiz:
 * - Acorde positivo curto se alguém cravou a posição exata.
 * - Tom grave suave se ninguém acertou.
 *
 * @param {boolean} hasExactMatch
 */
export function playRevealAnswer(hasExactMatch) {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (hasExactMatch) {
      // Tríade maior suave (Dó5 - Mi5 - Sol5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        playTone(ctx, {
          freq,
          type: 'triangle',
          start: now + i * 0.04,
          duration: 0.22,
          gain: 0.095,
        });
      });
    } else {
      // Dois tons graves discretos descendentes
      playTone(ctx, {
        freq: 196.0,
        endFreq: 174.61,
        type: 'triangle',
        start: now,
        duration: 0.12,
        gain: 0.09,
      });
      playTone(ctx, {
        freq: 155.56,
        endFreq: 130.81,
        type: 'sine',
        start: now + 0.09,
        duration: 0.2,
        gain: 0.1,
      });
    }
  } catch {
    // Ignora falhas de áudio do navegador
  }
}

/**
 * Fanfarra curta e alegre ao entrar na tela final (FINISHED).
 */
export function playVictory() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const melody = [
      { freq: 523.25, at: 0.0, dur: 0.11, gain: 0.1 },
      { freq: 659.25, at: 0.1, dur: 0.11, gain: 0.1 },
      { freq: 783.99, at: 0.2, dur: 0.12, gain: 0.11 },
      { freq: 1046.5, at: 0.32, dur: 0.36, gain: 0.12 },
    ];

    melody.forEach((n) => {
      playTone(ctx, {
        freq: n.freq,
        type: 'triangle',
        start: now + n.at,
        duration: n.dur,
        gain: n.gain,
      });
    });

    // Harmonia de sustentação no acorde final
    [523.25, 659.25, 783.99].forEach((freq) => {
      playTone(ctx, {
        freq,
        type: 'sine',
        start: now + 0.32,
        duration: 0.38,
        gain: 0.055,
      });
    });
  } catch {
    // Ignora falhas de áudio do navegador
  }
}
