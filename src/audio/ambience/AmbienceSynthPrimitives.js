/**
 * AmbienceSynthPrimitives.js
 * Motor compartilhado de síntese Dark Ambient / Noir para as trilhas de 10 minutos (600s) por bairro.
 *
 * Princípios acústicos:
 * - ZERO timbres agudos/chiptune ("piriripipi"): todo o barramento passa por filtro passa-baixa escuro
 *   (warmth ceiling ~1950 Hz), envelopes lentos de ataque/release, reverberação de catedral escura (4.2s)
 *   e delay estéreo de fita filtrada.
 * - Volume estritamente ambiente e discreto (teto baixo que nunca compete com SFX, vozes ou motores).
 * - 100% seguro em ambientes headless / testes Node sem WebAudio nativo.
 */

const _rigByContext = new WeakMap();

const NOTE_SEMITONES = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11
};

export function midiToHz(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

export function noteToHz(note) {
  if (typeof note === 'number' && Number.isFinite(note)) return note;
  if (typeof note !== 'string') return 110;
  const m = note.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!m) return 110;
  const name = m[1][0].toUpperCase() + (m[1][1] || '');
  const semi = NOTE_SEMITONES[name];
  if (semi === undefined) return 110;
  const octave = parseInt(m[2], 10);
  const midi = (octave + 1) * 12 + semi;
  return midiToHz(midi);
}

export function seededRand(seed) {
  let t = (Math.imul(Math.floor(seed * 1000) ^ 0x9e3779b9, 0x85ebca6b) >>> 0);
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0;
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/**
 * Verifica se um evento periódico de período `periodSec` (com fase `offsetSec`) cai na janela `[cursorSec, cursorSec + windowDurSec)`.
 * Retorna `{ hit: true, delaySec, stepIndex }` ou `{ hit: false, delaySec: 0, stepIndex: -1 }`.
 */
export function checkPeriodicTrigger(cursorSec, windowDurSec, periodSec, offsetSec = 0) {
  if (!(periodSec > 0) || !(windowDurSec > 0)) {
    return { hit: false, delaySec: 0, stepIndex: -1 };
  }
  const shifted = cursorSec - offsetSec;
  const firstIdx = Math.ceil(shifted / periodSec);
  const eventCursor = firstIdx * periodSec + offsetSec;
  const delta = eventCursor - cursorSec;
  if (delta >= -1e-6 && delta < windowDurSec) {
    return {
      hit: true,
      delaySec: Math.max(0, delta),
      stepIndex: firstIdx
    };
  }
  return { hit: false, delaySec: 0, stepIndex: -1 };
}

/**
 * Localiza o movimento ativo dentro de `movements` (0..600s) e retorna também o progresso normalizado `0..1`.
 */
export function resolveMovementAt(movements, cursorSec, totalDurationSec = 600) {
  const t = ((cursorSec % totalDurationSec) + totalDurationSec) % totalDurationSec;
  if (!Array.isArray(movements) || movements.length === 0) {
    return { movement: null, index: 0, localProgress: t / totalDurationSec, cursorSec: t };
  }
  for (let i = 0; i < movements.length; i++) {
    const mv = movements[i];
    if (t >= mv.startSec && t < mv.endSec) {
      const span = Math.max(1, mv.endSec - mv.startSec);
      return {
        movement: mv,
        index: i,
        localProgress: (t - mv.startSec) / span,
        cursorSec: t
      };
    }
  }
  const last = movements[movements.length - 1];
  return { movement: last, index: movements.length - 1, localProgress: 1, cursorSec: t };
}

function buildColoredNoiseBuffer(ctx, durationSec = 7.5, mode = 'brown') {
  if (!ctx || typeof ctx.createBuffer !== 'function') return null;
  const sr = ctx.sampleRate || 44100;
  const len = Math.max(1, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);

  if (mode === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = seededRand(i * 0.0137 + 11.3) * 2 - 1;
      last = (last + 0.022 * white) / 1.022;
      data[i] = last * 3.1;
    }
  } else {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = seededRand(i * 0.0191 + 47.9) * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }

  // Crossfade suave nas extremidades para loop sem clique
  const fadeSamples = Math.min(Math.floor(sr * 0.25), Math.floor(len * 0.1));
  for (let i = 0; i < fadeSamples; i++) {
    const a = i / fadeSamples;
    data[i] = data[i] * a + data[len - fadeSamples + i] * (1 - a);
  }
  return buf;
}

function buildDarkCathedralImpulse(ctx, durationSec = 4.2) {
  if (!ctx || typeof ctx.createBuffer !== 'function') return null;
  const sr = ctx.sampleRate || 44100;
  const len = Math.max(1, Math.floor(sr * durationSec));
  const buf = ctx.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const u = i / len;
      const env = Math.pow(1 - u, 2.85) * (i < sr * 0.035 ? i / (sr * 0.035) : 1);
      const raw = seededRand((i + 1) * (ch === 0 ? 0.0173 : 0.0239)) * 2 - 1;
      // Filtro passa-baixa interno no impulso -> cauda escura aveludada sem brilho metálico estridente
      lp = lp * 0.86 + raw * 0.14;
      data[i] = lp * env * 0.68;
    }
  }
  return buf;
}

/**
 * Inicializa (ou recupera em O(1)) o barramento espacial Dark Ambient compartilhado para o AudioContext.
 */
export function getAmbienceAudioRig(ctx, destinationBus) {
  if (!ctx || typeof ctx.createGain !== 'function') return null;
  const cached = _rigByContext.get(ctx);
  if (cached) return cached;

  const dest = destinationBus || ctx.destination;
  const masterOut = ctx.createGain();
  // Teto baixo intencional: música ambiente sombria e discreta ao fundo
  masterOut.gain.setValueAtTime(0.23, ctx.currentTime || 0);

  let darkCeilingFilter = null;
  if (typeof ctx.createBiquadFilter === 'function') {
    darkCeilingFilter = ctx.createBiquadFilter();
    darkCeilingFilter.type = 'lowpass';
    darkCeilingFilter.frequency.setValueAtTime(1850, ctx.currentTime || 0);
    darkCeilingFilter.Q.setValueAtTime(0.55, ctx.currentTime || 0);
    darkCeilingFilter.connect(masterOut);
  }
  masterOut.connect(dest);

  const dryBus = darkCeilingFilter || masterOut;
  const reverbInput = ctx.createGain();
  reverbInput.gain.setValueAtTime(0.62, ctx.currentTime || 0);

  if (typeof ctx.createConvolver === 'function') {
    try {
      const convolver = ctx.createConvolver();
      const ir = buildDarkCathedralImpulse(ctx, 4.2);
      if (ir) {
        convolver.buffer = ir;
        reverbInput.connect(convolver);
        convolver.connect(dryBus);
      } else {
        reverbInput.connect(dryBus);
      }
    } catch (_) {
      reverbInput.connect(dryBus);
    }
  } else {
    reverbInput.connect(dryBus);
  }

  const delayInput = ctx.createGain();
  delayInput.gain.setValueAtTime(0.32, ctx.currentTime || 0);
  if (typeof ctx.createDelay === 'function' && typeof ctx.createBiquadFilter === 'function') {
    try {
      const delayNode = ctx.createDelay(2.0);
      delayNode.delayTime.setValueAtTime(0.68, ctx.currentTime || 0);
      const fbGain = ctx.createGain();
      fbGain.gain.setValueAtTime(0.34, ctx.currentTime || 0);
      const tapeLp = ctx.createBiquadFilter();
      tapeLp.type = 'lowpass';
      tapeLp.frequency.setValueAtTime(680, ctx.currentTime || 0);

      delayInput.connect(delayNode);
      delayNode.connect(tapeLp);
      tapeLp.connect(dryBus);
      tapeLp.connect(reverbInput);
      tapeLp.connect(fbGain);
      fbGain.connect(delayNode);
    } catch (_) {
      delayInput.connect(reverbInput);
    }
  } else {
    delayInput.connect(reverbInput);
  }

  const rig = {
    ctx,
    masterOut,
    dryBus,
    reverbInput,
    delayInput,
    brownNoiseBuffer: buildColoredNoiseBuffer(ctx, 7.5, 'brown'),
    pinkNoiseBuffer: buildColoredNoiseBuffer(ctx, 7.5, 'pink'),
    voiceCount: 0
  };

  _rigByContext.set(ctx, rig);
  return rig;
}

function connectVoiceSpatial(rig, sourceOut, targetBus, { pan = 0, reverb = 0.55, delay = 0.0 } = {}) {
  const ctx = rig.ctx;
  let routed = sourceOut;
  if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
    try {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime || 0);
      sourceOut.connect(panner);
      routed = panner;
    } catch (_) {
      routed = sourceOut;
    }
  }

  const dryTarget = targetBus || rig.dryBus;
  routed.connect(dryTarget);

  if (reverb > 0.01 && rig.reverbInput) {
    const revSend = ctx.createGain();
    revSend.gain.setValueAtTime(Math.min(1, reverb), ctx.currentTime || 0);
    routed.connect(revSend);
    revSend.connect(rig.reverbInput);
  }
  if (delay > 0.01 && rig.delayInput) {
    const delSend = ctx.createGain();
    delSend.gain.setValueAtTime(Math.min(0.85, delay), ctx.currentTime || 0);
    routed.connect(delSend);
    delSend.connect(rig.delayInput);
  }
}

function rampEnvelope(gainParam, t0, peak, attackSec, holdEndSec, stopSec) {
  if (!gainParam) return;
  const safePeak = Math.max(0.0002, Math.min(0.18, peak));
  gainParam.setValueAtTime?.(0.0001, t0);
  if (typeof gainParam.linearRampToValueAtTime === 'function') {
    gainParam.linearRampToValueAtTime(safePeak, t0 + Math.max(0.03, attackSec));
    gainParam.setValueAtTime?.(safePeak * 0.92, Math.max(t0 + attackSec, holdEndSec));
    gainParam.exponentialRampToValueAtTime?.(0.0001, stopSec);
  } else {
    gainParam.exponentialRampToValueAtTime?.(safePeak, t0 + Math.max(0.03, attackSec));
    gainParam.exponentialRampToValueAtTime?.(0.0001, stopSec);
  }
}

/**
 * 1. Acorde de Pad Analógico Sombrio (estilo Blade Runner / Arkham Knight)
 */
export function playDarkPadChord(rig, opts = {}) {
  if (!rig?.ctx || typeof rig.ctx.createOscillator !== 'function') return false;
  const ctx = rig.ctx;
  const notes = Array.isArray(opts.notes) && opts.notes.length ? opts.notes : ['C2', 'G2', 'Eb3'];
  const t0 = Math.max(ctx.currentTime || 0, opts.time ?? (ctx.currentTime || 0));
  const duration = Math.max(3.5, opts.duration ?? 13.0);
  const attack = Math.min(duration * 0.45, Math.max(1.2, opts.attack ?? 3.6));
  const release = Math.min(duration * 0.48, Math.max(1.5, opts.release ?? 4.2));
  const cutoff = Math.max(140, Math.min(1150, opts.cutoff ?? 420));
  const cutoffPeak = Math.max(cutoff, Math.min(1450, opts.cutoffPeak ?? cutoff * 1.45));
  const detuneCents = opts.detuneCents ?? 7.5;
  const perVoiceGain = (opts.gain ?? 0.042) / Math.max(1, Math.sqrt(notes.length) * 1.45);
  const waveform = opts.waveform || 'sawtooth';

  const voiceGain = ctx.createGain();
  rampEnvelope(voiceGain.gain, t0, perVoiceGain, attack, t0 + duration - release, t0 + duration);

  let filterIn = voiceGain;
  if (typeof ctx.createBiquadFilter === 'function') {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.setValueAtTime(opts.q ?? 0.9, t0);
    lp.frequency.setValueAtTime(cutoff * 0.72, t0);
    if (typeof lp.frequency.linearRampToValueAtTime === 'function') {
      lp.frequency.linearRampToValueAtTime(cutoffPeak, t0 + duration * 0.52);
      lp.frequency.linearRampToValueAtTime(cutoff * 0.65, t0 + duration);
    }
    lp.connect(voiceGain);
    filterIn = lp;
  }

  connectVoiceSpatial(rig, voiceGain, opts.dest, {
    pan: opts.pan ?? 0,
    reverb: opts.reverb ?? 0.74,
    delay: opts.delay ?? 0.18
  });

  for (const n of notes) {
    const hz = noteToHz(n);
    for (const sign of [-1, 1]) {
      const osc = ctx.createOscillator();
      osc.type = sign < 0 ? waveform : 'triangle';
      osc.frequency.setValueAtTime(hz, t0);
      if (osc.detune && typeof osc.detune.setValueAtTime === 'function') {
        osc.detune.setValueAtTime(sign * detuneCents, t0);
      }
      osc.connect(filterIn);
      osc.start(t0);
      osc.stop(t0 + duration + 0.06);
      rig.voiceCount++;
    }
  }
  return true;
}

/**
 * 2. Sub-Drone Abissal Contínuo (fundação grave 28 Hz – 75 Hz)
 */
export function playSubDrone(rig, opts = {}) {
  if (!rig?.ctx || typeof rig.ctx.createOscillator !== 'function') return false;
  const ctx = rig.ctx;
  const t0 = Math.max(ctx.currentTime || 0, opts.time ?? (ctx.currentTime || 0));
  const duration = Math.max(4.0, opts.duration ?? 15.0);
  const hz = noteToHz(opts.note ?? 'C1');
  const peak = Math.min(0.085, opts.gain ?? 0.055);
  const attack = Math.min(duration * 0.4, opts.attack ?? 3.2);
  const release = Math.min(duration * 0.45, opts.release ?? 4.0);

  const outGain = ctx.createGain();
  rampEnvelope(outGain.gain, t0, peak, attack, t0 + duration - release, t0 + duration);

  let targetIn = outGain;
  if (typeof ctx.createBiquadFilter === 'function') {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.max(75, Math.min(240, opts.cutoff ?? 135)), t0);
    lp.connect(outGain);
    targetIn = lp;
  }

  connectVoiceSpatial(rig, outGain, opts.dest, {
    pan: 0,
    reverb: opts.reverb ?? 0.28,
    delay: 0
  });

  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(hz, t0);
  if (opts.glideToNote && typeof subOsc.frequency.exponentialRampToValueAtTime === 'function') {
    subOsc.frequency.exponentialRampToValueAtTime(noteToHz(opts.glideToNote), t0 + duration * 0.85);
  }
  subOsc.connect(targetIn);

  const warmOsc = ctx.createOscillator();
  warmOsc.type = 'triangle';
  warmOsc.frequency.setValueAtTime(hz * (opts.fifth ? 1.5 : 2.0), t0);
  const harmGain = ctx.createGain();
  harmGain.gain.setValueAtTime(0.24, t0);
  warmOsc.connect(harmGain);
  harmGain.connect(targetIn);

  subOsc.start(t0);
  warmOsc.start(t0);
  subOsc.stop(t0 + duration + 0.06);
  warmOsc.stop(t0 + duration + 0.06);
  rig.voiceCount += 2;
  return true;
}

/**
 * 3. Nota Íntima Noir (Felt Piano abafado, Rhodes sombrio, Harpa de Vidro ou Violão Nylon)
 */
export function playNoirFeltNote(rig, opts = {}) {
  if (!rig?.ctx || typeof rig.ctx.createOscillator !== 'function') return false;
  const ctx = rig.ctx;
  const t0 = Math.max(ctx.currentTime || 0, opts.time ?? (ctx.currentTime || 0));
  const hz = noteToHz(opts.note ?? 'C4');
  const duration = Math.max(1.6, opts.duration ?? 4.6);
  const tone = opts.tone || 'felt'; // 'felt' | 'rhodes' | 'glass' | 'nylon'
  const peak = Math.min(0.055, opts.gain ?? 0.026);
  const attack = tone === 'glass' ? 0.08 : tone === 'rhodes' ? 0.055 : 0.038;

  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.0001, t0);
  if (typeof envGain.gain.linearRampToValueAtTime === 'function') {
    envGain.gain.linearRampToValueAtTime(peak, t0 + attack);
  } else {
    envGain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  }
  envGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  let filterIn = envGain;
  if (typeof ctx.createBiquadFilter === 'function') {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const startCut =
      tone === 'glass' ? 1280 : tone === 'nylon' ? 980 : tone === 'rhodes' ? 780 : 620;
    lp.frequency.setValueAtTime?.(opts.cutoff ?? startCut, t0);
    if (typeof lp.frequency.exponentialRampToValueAtTime === 'function') {
      lp.frequency.exponentialRampToValueAtTime(Math.max(180, startCut * 0.34), t0 + duration);
    }
    lp.connect(envGain);
    filterIn = lp;
  }

  connectVoiceSpatial(rig, envGain, opts.dest, {
    pan: opts.pan ?? 0,
    reverb: opts.reverb ?? 0.78,
    delay: opts.delay ?? 0.42
  });

  const mainOsc = ctx.createOscillator();
  mainOsc.type = tone === 'nylon' ? 'sawtooth' : 'triangle';
  mainOsc.frequency.setValueAtTime(hz, t0);

  const overOsc = ctx.createOscillator();
  overOsc.type = 'sine';
  overOsc.frequency.setValueAtTime(hz * (tone === 'glass' ? 3.0 : 2.0), t0);
  const overGain = ctx.createGain();
  overGain.gain.setValueAtTime(tone === 'glass' ? 0.22 : 0.14, t0);
  overGain.gain.exponentialRampToValueAtTime(0.001, t0 + duration * 0.45);

  mainOsc.connect(filterIn);
  overOsc.connect(overGain);
  overGain.connect(filterIn);

  mainOsc.start(t0);
  overOsc.start(t0);
  mainOsc.stop(t0 + duration + 0.05);
  overOsc.stop(t0 + duration + 0.05);
  rig.voiceCount += 2;
  return true;
}

/**
 * 4. Metais/Cordas Friccionadas Sombrias, Foghorn Naval ou Brass Distante de Gotham
 */
export function playBowedMetalOrHorn(rig, opts = {}) {
  if (!rig?.ctx || typeof rig.ctx.createOscillator !== 'function') return false;
  const ctx = rig.ctx;
  const t0 = Math.max(ctx.currentTime || 0, opts.time ?? (ctx.currentTime || 0));
  const hz = noteToHz(opts.note ?? 'G1');
  const endHz = opts.endNote ? noteToHz(opts.endNote) : hz * (opts.bendRatio ?? 0.985);
  const duration = Math.max(3.0, opts.duration ?? 8.5);
  const attack = Math.min(duration * 0.45, opts.attack ?? 2.4);
  const peak = Math.min(0.06, opts.gain ?? 0.032);

  const envGain = ctx.createGain();
  rampEnvelope(envGain.gain, t0, peak, attack, t0 + duration * 0.68, t0 + duration);

  let filterIn = envGain;
  if (typeof ctx.createBiquadFilter === 'function') {
    const bp = ctx.createBiquadFilter();
    bp.type = opts.filterType || 'lowpass';
    bp.Q.setValueAtTime(opts.q ?? 2.6, t0);
    const baseCut = opts.cutoff ?? Math.max(190, Math.min(680, hz * 3.4));
    bp.frequency.setValueAtTime(baseCut * 0.65, t0);
    if (typeof bp.frequency.linearRampToValueAtTime === 'function') {
      bp.frequency.linearRampToValueAtTime(baseCut * 1.35, t0 + attack);
      bp.frequency.linearRampToValueAtTime(baseCut * 0.55, t0 + duration);
    }
    bp.connect(envGain);
    filterIn = bp;
  }

  connectVoiceSpatial(rig, envGain, opts.dest, {
    pan: opts.pan ?? 0,
    reverb: opts.reverb ?? 0.86,
    delay: opts.delay ?? 0.28
  });

  for (const det of [-8, 0, 8]) {
    const osc = ctx.createOscillator();
    osc.type = det === 0 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(hz, t0);
    if (typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, endHz), t0 + duration);
    }
    if (osc.detune && typeof osc.detune.setValueAtTime === 'function') {
      osc.detune.setValueAtTime(det, t0);
    }
    osc.connect(filterIn);
    osc.start(t0);
    osc.stop(t0 + duration + 0.06);
    rig.voiceCount++;
  }
  return true;
}

/**
 * 5. Textura Ambiental de Ruído Filtrado (Vento, Maré Noturna, Vapor Industrial, Subsolo, Jato Distante)
 */
export function playAtmosphericNoiseSwell(rig, opts = {}) {
  const ctx = rig?.ctx;
  const buf = opts.color === 'pink' ? rig?.pinkNoiseBuffer : rig?.brownNoiseBuffer;
  if (!ctx || !buf || typeof ctx.createBufferSource !== 'function') return false;

  const t0 = Math.max(ctx.currentTime || 0, opts.time ?? (ctx.currentTime || 0));
  const duration = Math.max(3.0, opts.duration ?? 10.0);
  const attack = Math.min(duration * 0.45, opts.attack ?? 2.8);
  const peak = Math.min(0.055, opts.gain ?? 0.022);

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const envGain = ctx.createGain();
  rampEnvelope(envGain.gain, t0, peak, attack, t0 + duration * 0.65, t0 + duration);

  if (typeof ctx.createBiquadFilter === 'function') {
    const flt = ctx.createBiquadFilter();
    flt.type = opts.filterType || 'bandpass';
    flt.Q.setValueAtTime(opts.q ?? 1.4, t0);
    const fStart = Math.max(45, Math.min(1400, opts.freqStart ?? 240));
    const fEnd = Math.max(45, Math.min(1400, opts.freqEnd ?? 420));
    flt.frequency.setValueAtTime(fStart, t0);
    if (typeof flt.frequency.linearRampToValueAtTime === 'function') {
      flt.frequency.linearRampToValueAtTime(fEnd, t0 + duration * 0.6);
      flt.frequency.linearRampToValueAtTime(fStart * 0.85, t0 + duration);
    }
    src.connect(flt);
    flt.connect(envGain);
  } else {
    src.connect(envGain);
  }

  connectVoiceSpatial(rig, envGain, opts.dest, {
    pan: opts.pan ?? 0,
    reverb: opts.reverb ?? 0.58,
    delay: opts.delay ?? 0.12
  });

  const maxOffset = Math.max(0, (buf.duration || 6) - 0.5);
  const offset = (opts.seed ? seededRand(opts.seed) : 0.25) * maxOffset;
  src.start(t0, offset);
  src.stop(t0 + duration + 0.05);
  rig.voiceCount++;
  return true;
}

/**
 * 6. Ressonância Inarmônica Sombria (Grades da Prisão, Casco de Navio, Tubulação, Pulso Sonar/Radar, Surdo Distante)
 */
export function playMetallicEchoPing(rig, opts = {}) {
  if (!rig?.ctx || typeof rig.ctx.createOscillator !== 'function') return false;
  const ctx = rig.ctx;
  const t0 = Math.max(ctx.currentTime || 0, opts.time ?? (ctx.currentTime || 0));
  const baseHz = noteToHz(opts.note ?? 180);
  const ratios = Array.isArray(opts.ratios) && opts.ratios.length ? opts.ratios : [1.0, 1.47, 2.09];
  const duration = Math.max(0.9, opts.duration ?? 3.4);
  const peak = Math.min(0.04, (opts.gain ?? 0.018) / Math.sqrt(ratios.length));

  const envGain = ctx.createGain();
  envGain.gain.setValueAtTime(0.0001, t0);
  if (typeof envGain.gain.linearRampToValueAtTime === 'function') {
    envGain.gain.linearRampToValueAtTime(peak, t0 + (opts.attack ?? 0.025));
  } else {
    envGain.gain.exponentialRampToValueAtTime(peak, t0 + 0.025);
  }
  envGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  let filterIn = envGain;
  if (typeof ctx.createBiquadFilter === 'function') {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.max(140, Math.min(1350, opts.cutoff ?? 760)), t0);
    lp.connect(envGain);
    filterIn = lp;
  }

  connectVoiceSpatial(rig, envGain, opts.dest, {
    pan: opts.pan ?? 0,
    reverb: opts.reverb ?? 0.86,
    delay: opts.delay ?? 0.52
  });

  ratios.forEach((ratio, idx) => {
    const osc = ctx.createOscillator();
    osc.type = idx === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(baseHz * ratio, t0);
    if (opts.pitchDrop && typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
      osc.frequency.exponentialRampToValueAtTime(Math.max(28, baseHz * ratio * opts.pitchDrop), t0 + duration * 0.5);
    }
    osc.connect(filterIn);
    osc.start(t0);
    osc.stop(t0 + duration + 0.04);
    rig.voiceCount++;
  });
  return true;
}
