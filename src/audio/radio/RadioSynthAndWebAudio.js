/**
 * Barramento WebAudio da Rádio FM (Grave +6dB, Analyser p/ Paredão, Chiado Curto de Sintonia FM
 * estilo GTA 6 e Sintetizador Multi-Pista de Fallback para ambientes sem arquivo MP3).
 */

import { soundFX } from '../SoundFX.js';

export const SYNTH_ARRANGEMENTS = {
  mtg_automotivo: {
    kickSteps: [0, 3, 6, 8, 11, 14],
    subNotes: [55.0, 55.0, 55.0, 61.74, 55.0, 55.0, 49.0, 51.91],
    tambSteps: [2, 3, 5, 7, 10, 11, 13, 15],
    leadWave: 'sawtooth',
    leadPattern: [659.25, 0, 698.46, 659.25, 0, 587.33, 659.25, 0, 659.25, 0, 783.99, 698.46, 659.25, 0, 587.33, 523.25],
    cowbellPattern: [0, 0, 880, 0, 0, 0, 932.33, 0, 0, 0, 880, 0, 1046.5, 0, 880, 0]
  },
  brazilian_phonk: {
    kickSteps: [0, 3, 6, 10, 12, 14],
    subNotes: [49.0, 49.0, 58.27, 55.0, 49.0, 49.0, 43.65, 46.25],
    tambSteps: [2, 4, 7, 10, 12, 15],
    leadWave: 'square',
    leadPattern: [392.0, 0, 466.16, 0, 523.25, 0, 587.33, 523.25, 466.16, 0, 392.0, 0, 349.23, 392.0, 466.16, 0],
    cowbellPattern: [783.99, 0, 783.99, 932.33, 0, 783.99, 1046.5, 0, 932.33, 0, 783.99, 0, 698.46, 783.99, 932.33, 0]
  },
  slowed_reverb: {
    kickSteps: [0, 6, 8, 14],
    subNotes: [43.65, 43.65, 36.71, 36.71, 41.2, 41.2, 49.0, 49.0],
    tambSteps: [4, 12],
    leadWave: 'triangle',
    leadPattern: [349.23, 440.0, 523.25, 659.25, 587.33, 440.0, 523.25, 349.23, 329.63, 440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 440.0]
  }
};

export function playFmTuningStaticBurst(radioBus, volume = 0.8) {
  const ctx = soundFX._ensureContext?.();
  if (!ctx || !ctx.createBuffer || !ctx.createBufferSource) return;
  try {
    const dur = 0.085;
    const sampleRate = ctx.sampleRate || 44100;
    const len = Math.max(64, Math.floor(sampleRate * dur));
    const buf = ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * env * 0.35;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter ? ctx.createBiquadFilter() : null;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.28, 0.22 * volume), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    const dest = radioBus || soundFX.sfxBus || ctx.destination;
    if (filter) {
      filter.type = 'bandpass';
      if (filter.frequency?.setValueAtTime) filter.frequency.setValueAtTime(1950, ctx.currentTime);
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(dest);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + dur + 0.01);
  } catch (_) {
    // Ignora em mock headless
  }
}

export function triggerSynthFallbackStep(radio, track, step) {
  const ctx = radio._ensureAudioNodes();
  if (!ctx || !radio.radioBus) return;

  const arr = SYNTH_ARRANGEMENTS[track?.id] || SYNTH_ARRANGEMENTS.mtg_automotivo;
  const s16 = step % 16;
  const barIdx = Math.floor(step / 4) % 8;
  const now = ctx.currentTime;
  const bassBoostGain = radio.isBassBoostActive ? 1.32 : 1.0;

  if (arr.kickSteps.includes(s16)) {
    radio.bassEnergy = Math.min(1.0, 0.9 * bassBoostGain);
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    const rootFreq = arr.subNotes[barIdx % arr.subNotes.length] || 55.0;
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, now);
    subOsc.frequency.exponentialRampToValueAtTime(rootFreq, now + 0.055);
    subGain.gain.setValueAtTime(Math.min(0.4, 0.28 * bassBoostGain), now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    subOsc.connect(subGain);
    subGain.connect(radio.radioBus);
    subOsc.start(now);
    subOsc.stop(now + 0.22);
  }

  if (arr.cowbellPattern && arr.cowbellPattern[s16] > 0) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(arr.cowbellPattern[s16], now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(radio.radioBus);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  if (arr.leadPattern && arr.leadPattern[s16] > 0) {
    const lead = ctx.createOscillator();
    const gain = ctx.createGain();
    lead.type = arr.leadWave || 'sawtooth';
    lead.frequency.setValueAtTime(arr.leadPattern[s16], now);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    lead.connect(gain);
    gain.connect(radio.radioBus);
    lead.start(now);
    lead.stop(now + 0.14);
  }
}
