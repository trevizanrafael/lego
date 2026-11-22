/**
 * Efeitos sonoros procedurais de combate, coleta de studs, plástico LEGO quebrando,
 * poderes dos heróis e transições táticas de UI.
 */

export function playStudCollectSfx(sfx, value = 10) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const baseFreq =
    value >= 10000 ? 1320 :
    value >= 1000 ? 1100 :
    value >= 100 ? 920 : 780;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc2.type = 'triangle';

  osc1.frequency.setValueAtTime(baseFreq, now);
  osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.065);

  osc2.frequency.setValueAtTime(baseFreq * 2.0, now + 0.02);
  osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, now + 0.14);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc1.start(now);
  osc2.start(now + 0.015);
  osc1.stop(now + 0.17);
  osc2.stop(now + 0.17);
}

export function playPlasticHitSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(280 + Math.random() * 90, now);
  osc.frequency.exponentialRampToValueAtTime(95, now + 0.06);

  gain.gain.setValueAtTime(0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}

export function playMetalRicochetSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1450, now);
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);

  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

export function playLegoBreakSfx(sfx, isBig = false) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const clatterCount = isBig ? 9 : 6;

  for (let i = 0; i < clatterCount; i++) {
    const delay = i * 0.028 + Math.random() * 0.015;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = i % 2 === 0 ? 'triangle' : 'square';
    const f = (isBig ? 240 : 340) + Math.random() * 480;
    osc.frequency.setValueAtTime(f, now + delay);
    osc.frequency.exponentialRampToValueAtTime(f * 0.55, now + delay + 0.055);

    gain.gain.setValueAtTime(0.1, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

    osc.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);

    osc.start(now + delay);
    osc.stop(now + delay + 0.065);
  }
}

export function playRifleShotSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(420 + Math.random() * 60, now);
  osc.frequency.exponentialRampToValueAtTime(85, now + 0.075);

  gain.gain.setValueAtTime(0.13, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  osc.stop(now + 0.085);
}

export function playMinigunShotSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const subOsc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(290 + Math.random() * 75, now);
  osc.frequency.exponentialRampToValueAtTime(62, now + 0.042);

  subOsc.type = 'square';
  subOsc.frequency.setValueAtTime(135 + Math.random() * 25, now);
  subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.042);

  gain.gain.setValueAtTime(0.095, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

  osc.connect(gain);
  subOsc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  subOsc.start(now);
  osc.stop(now + 0.048);
  subOsc.stop(now + 0.048);
}

export function playSeismicStompSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const crunchOsc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(115, now);
  osc.frequency.exponentialRampToValueAtTime(22, now + 0.48);

  crunchOsc.type = 'square';
  crunchOsc.frequency.setValueAtTime(185, now);
  crunchOsc.frequency.exponentialRampToValueAtTime(34, now + 0.36);

  gain.gain.setValueAtTime(0.26, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc.connect(gain);
  crunchOsc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  crunchOsc.start(now);
  osc.stop(now + 0.52);
  crunchOsc.stop(now + 0.4);
}

export function playFireballCastSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  osc.stop(now + 0.18);
}

export function playExplosionSfx(sfx, scale = 1.0) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.38 * scale;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(28, now + duration);

  gain.gain.setValueAtTime(Math.min(0.26, 0.18 * scale), now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playSolarBeamTickSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bassOsc = ctx.createOscillator();
  const plasmaOsc = ctx.createOscillator();
  const gain = ctx.createGain();

  bassOsc.type = 'sawtooth';
  const bassFreq = 95 + Math.random() * 35;
  bassOsc.frequency.setValueAtTime(bassFreq, now);
  bassOsc.frequency.exponentialRampToValueAtTime(68, now + 0.095);

  plasmaOsc.type = 'triangle';
  const midFreq = 220 + Math.random() * 90;
  plasmaOsc.frequency.setValueAtTime(midFreq, now);
  plasmaOsc.frequency.exponentialRampToValueAtTime(165, now + 0.095);

  gain.gain.setValueAtTime(0.085, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  bassOsc.connect(gain);
  plasmaOsc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  bassOsc.start(now);
  plasmaOsc.start(now);
  bassOsc.stop(now + 0.105);
  plasmaOsc.stop(now + 0.105);
}

export function playSolarChargeTickSfx(sfx, chargeRatio = 0) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  const baseF = 110 + chargeRatio * 340;
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(baseF, now);
  osc1.frequency.exponentialRampToValueAtTime(baseF * 1.18, now + 0.09);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(baseF * 1.5, now);
  osc2.frequency.exponentialRampToValueAtTime(baseF * 1.85, now + 0.09);

  gain.gain.setValueAtTime(0.065 + chargeRatio * 0.065, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.1);
  osc2.stop(now + 0.1);
}

export function playTacticalRollSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(340, now + 0.12);
  osc.frequency.exponentialRampToValueAtTime(120, now + 0.24);

  gain.gain.setValueAtTime(0.11, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  osc.stop(now + 0.26);
}

export function playHeroSwapSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [440, 660, 880];
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const t = now + i * 0.045;
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  });
}

export function playPunchSwingSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(210, now);
  osc.frequency.exponentialRampToValueAtTime(75, now + 0.08);

  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

export function playTrueHeroFanfareSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const t = now + idx * 0.09;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.29);
  });
}

export function playLaserShotSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(920 + Math.random() * 180, now);
  osc1.frequency.exponentialRampToValueAtTime(115, now + 0.14);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(480 + Math.random() * 90, now);
  osc2.frequency.exponentialRampToValueAtTime(65, now + 0.14);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.155);
  osc2.stop(now + 0.155);
}

export function playSatelliteZoomStepSfx(sfx, isDown = false, step = 1) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Grave de impacto de lente + bip de telemetria orbital
  const bassOsc = ctx.createOscillator();
  const pingOsc = ctx.createOscillator();
  const gain = ctx.createGain();

  bassOsc.type = 'triangle';
  pingOsc.type = 'sine';

  const basePitch = isDown ? 520 + step * 140 : 880 - step * 140;
  bassOsc.frequency.setValueAtTime(110, now);
  bassOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);

  pingOsc.frequency.setValueAtTime(basePitch, now);
  pingOsc.frequency.exponentialRampToValueAtTime(basePitch * (isDown ? 1.18 : 0.82), now + 0.12);

  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  bassOsc.connect(gain);
  pingOsc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  bassOsc.start(now);
  pingOsc.start(now);
  bassOsc.stop(now + 0.16);
  pingOsc.stop(now + 0.16);
}

export function playNpcGunshotSfx(sfx, faction = 'cv', isRpg = false, volumeScale = 1.0) {
  const ctx = sfx._ensureContext();
  if (!ctx || volumeScale <= 0.02) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const vol = Math.max(0.01, Math.min(0.11, 0.095 * volumeScale));

  if (isRpg) {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.19);
    gain.gain.setValueAtTime(vol * 1.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
    return;
  }

  if (faction === 'ares') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(840 + Math.random() * 140, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.09);
  } else if (faction === 'cv') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340 + Math.random() * 55, now);
    osc.frequency.exponentialRampToValueAtTime(72, now + 0.075);
  } else if (faction === 'pcc') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(460 + Math.random() * 70, now);
    osc.frequency.exponentialRampToValueAtTime(98, now + 0.065);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(410 + Math.random() * 50, now);
    osc.frequency.exponentialRampToValueAtTime(88, now + 0.07);
  }

  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}

export function playHealTickSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  const baseF = 660 + Math.random() * 220;
  osc.frequency.setValueAtTime(baseF, now);
  osc.frequency.exponentialRampToValueAtTime(baseF * 1.35, now + 0.11);

  gain.gain.setValueAtTime(0.055, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);
  osc.start(now);
  osc.stop(now + 0.125);
}

export function playEmoteJingleSfx(sfx, emoteIdx = 0) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notesByEmote = [
    [440, 554.37, 659.25],
    [523.25, 659.25, 783.99],
    [392.0, 523.25, 783.99],
    [329.63, 440.0, 659.25]
  ];
  const notes = notesByEmote[emoteIdx % notesByEmote.length];
  notes.forEach((f, idx) => {
    const t = now + idx * 0.055;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  });
}

export function playKillConfirmSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return false;
  const now = ctx.currentTime;
  const targetBus = sfx.sfxBus || ctx.destination;
  let postNode = targetBus;
  if (typeof ctx.createDynamicsCompressor === 'function') {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold?.setValueAtTime?.(-16, now);
    comp.knee?.setValueAtTime?.(8, now);
    comp.ratio?.setValueAtTime?.(6, now);
    comp.attack?.setValueAtTime?.(0.002, now);
    comp.release?.setValueAtTime?.(0.09, now);
    comp.connect(targetBus);
    postNode = comp;
  }

  // Sub-drop grave e seco estilo GTA V (115 Hz -> 36 Hz em 0.15s) + transiente lowpass (620 Hz -> 180 Hz em 0.045s)
  const subOsc = ctx.createOscillator();
  const bodyOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(115, now);
  subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.15);
  bodyOsc.type = 'triangle';
  bodyOsc.frequency.setValueAtTime(96, now);
  bodyOsc.frequency.exponentialRampToValueAtTime(36, now + 0.145);
  subGain.gain.setValueAtTime(0.28, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.155);
  subOsc.connect(subGain);
  bodyOsc.connect(subGain);
  subGain.connect(postNode);

  const thudOsc = ctx.createOscillator();
  const lpFilter = ctx.createBiquadFilter();
  const thudGain = ctx.createGain();
  thudOsc.type = 'triangle';
  thudOsc.frequency.setValueAtTime(620, now);
  thudOsc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
  lpFilter.type = 'lowpass';
  lpFilter.frequency.setValueAtTime(520, now);
  lpFilter.Q.setValueAtTime(0.85, now);
  thudGain.gain.setValueAtTime(0.19, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);
  thudOsc.connect(lpFilter);
  lpFilter.connect(thudGain);
  thudGain.connect(postNode);

  subOsc.start(now); bodyOsc.start(now); thudOsc.start(now);
  subOsc.stop(now + 0.16); bodyOsc.stop(now + 0.155); thudOsc.stop(now + 0.05);
  return true;
}

export function playHitmarkerTickSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return false;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const lpFilter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1180, now);
  osc.frequency.exponentialRampToValueAtTime(420, now + 0.022);
  lpFilter.type = 'lowpass';
  lpFilter.frequency.setValueAtTime(1650, now);
  lpFilter.Q.setValueAtTime(0.7, now);
  gain.gain.setValueAtTime(0.075, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
  osc.connect(lpFilter);
  lpFilter.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);
  osc.start(now);
  osc.stop(now + 0.024);
  return true;
}

function _getBoltNoiseBuffer(sfx, ctx) {
  if (sfx._boltNoiseBuffer && sfx._boltNoiseCtx === ctx) return sfx._boltNoiseBuffer;
  if (typeof ctx.createBuffer !== 'function') return null;
  const sr = Number(ctx.sampleRate) || 44100;
  const len = Math.max(1, Math.floor(sr * 0.16));
  const buf = ctx.createBuffer(1, len, sr);
  const data = typeof buf.getChannelData === 'function' ? buf.getChannelData(0) : null;
  if (data) {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  sfx._boltNoiseBuffer = buf;
  sfx._boltNoiseCtx = ctx;
  return buf;
}

function _spawnFilteredNoise(ctx, dest, buf, t0, dur, filterType, fStart, fEnd, qVal, peakGain, attack = 0) {
  if (!buf || typeof ctx.createBufferSource !== 'function') return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  if (attack > 0 && typeof gain.gain?.linearRampToValueAtTime === 'function') {
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + attack);
  } else {
    gain.gain.setValueAtTime(peakGain, t0);
  }
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  if (typeof ctx.createBiquadFilter === 'function') {
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency?.setValueAtTime?.(fStart, t0);
    if (fEnd && fEnd !== fStart) flt.frequency?.exponentialRampToValueAtTime?.(fEnd, t0 + dur);
    flt.Q?.setValueAtTime?.(qVal, t0);
    src.connect(flt);
    flt.connect(gain);
  } else {
    src.connect(gain);
  }
  gain.connect(dest);
  src.start?.(t0);
  src.stop?.(t0 + dur + 0.005);
}

export function playSniperBoltShotSfx(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return false;
  const now = ctx.currentTime;
  const dest = sfx.sfxBus || ctx.destination;
  const noiseBuf = _getBoltNoiseBuffer(sfx, ctx);

  // 1) t = now: Estalo supersônico + sub-grave pesado do disparo
  _spawnFilteredNoise(ctx, dest, noiseBuf, now, 0.09, 'bandpass', 2400, 780, 1.1, 0.21, 0);

  const crackOsc = ctx.createOscillator();
  const crackGain = ctx.createGain();
  crackOsc.type = 'sawtooth';
  crackOsc.frequency.setValueAtTime(680, now);
  crackOsc.frequency.exponentialRampToValueAtTime(75, now + 0.09);
  crackGain.gain.setValueAtTime(0.19, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.092);
  crackOsc.connect(crackGain);
  crackGain.connect(dest);
  crackOsc.start(now);
  crackOsc.stop(now + 0.096);

  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = 'triangle';
  subOsc.frequency.setValueAtTime(135, now);
  subOsc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
  subGain.gain.setValueAtTime(0.24, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.185);
  subOsc.connect(subGain);
  subGain.connect(dest);
  subOsc.start(now);
  subOsc.stop(now + 0.19);

  // 2) t = now + 0.17s..0.30s: "VAI" — Destrave e puxada metálica do ferrolho para trás
  const liftOsc = ctx.createOscillator();
  const liftGain = ctx.createGain();
  liftOsc.type = 'triangle';
  liftOsc.frequency.setValueAtTime(1900, now + 0.17);
  liftOsc.frequency.exponentialRampToValueAtTime(950, now + 0.192);
  liftGain.gain.setValueAtTime(0.095, now + 0.17);
  liftGain.gain.exponentialRampToValueAtTime(0.001, now + 0.192);
  liftOsc.connect(liftGain);
  liftGain.connect(dest);
  liftOsc.start(now + 0.17);
  liftOsc.stop(now + 0.196);

  _spawnFilteredNoise(ctx, dest, noiseBuf, now + 0.19, 0.11, 'bandpass', 1050, 2350, 5.5, 0.13, 0.014);
  const backGlide = ctx.createOscillator();
  const backGain = ctx.createGain();
  backGlide.type = 'triangle';
  backGlide.frequency.setValueAtTime(780, now + 0.19);
  backGlide.frequency.exponentialRampToValueAtTime(1420, now + 0.30);
  backGain.gain.setValueAtTime(0.085, now + 0.19);
  backGain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
  backGlide.connect(backGain);
  backGain.connect(dest);
  backGlide.start(now + 0.19);
  backGlide.stop(now + 0.305);

  // 3) t = now + 0.37s..0.505s: "VEM" — Empurrada do ferrolho para frente + trancamento seco na câmara
  _spawnFilteredNoise(ctx, dest, noiseBuf, now + 0.37, 0.10, 'bandpass', 2200, 920, 5.0, 0.125, 0.012);
  const fwdGlide = ctx.createOscillator();
  const fwdGain = ctx.createGain();
  fwdGlide.type = 'triangle';
  fwdGlide.frequency.setValueAtTime(1350, now + 0.37);
  fwdGlide.frequency.exponentialRampToValueAtTime(720, now + 0.47);
  fwdGain.gain.setValueAtTime(0.08, now + 0.37);
  fwdGain.gain.exponentialRampToValueAtTime(0.001, now + 0.47);
  fwdGlide.connect(fwdGain);
  fwdGain.connect(dest);
  fwdGlide.start(now + 0.37);
  fwdGlide.stop(now + 0.475);

  const lockBody = ctx.createOscillator();
  const lockLatch = ctx.createOscillator();
  const lockGain = ctx.createGain();
  lockBody.type = 'triangle';
  lockBody.frequency.setValueAtTime(540, now + 0.47);
  lockBody.frequency.exponentialRampToValueAtTime(175, now + 0.505);
  lockLatch.type = 'triangle';
  lockLatch.frequency.setValueAtTime(2450, now + 0.47);
  lockLatch.frequency.exponentialRampToValueAtTime(1100, now + 0.49);
  lockGain.gain.setValueAtTime(0.125, now + 0.47);
  lockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.505);
  lockBody.connect(lockGain);
  lockLatch.connect(lockGain);
  lockGain.connect(dest);
  lockBody.start(now + 0.47);
  lockLatch.start(now + 0.47);
  lockBody.stop(now + 0.51);
  lockLatch.stop(now + 0.495);
  return true;
}

export function playScopeZoomClickSfx(sfx, zoom = 4.0) {
  const ctx = sfx._ensureContext();
  if (!ctx) return false;
  const now = ctx.currentTime;
  const z = Math.max(1, Math.min(100, Number(zoom) || 4.0));
  const pitch = 920 + Math.log10(z) * 420;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(pitch, now);
  osc.frequency.exponentialRampToValueAtTime(480, now + 0.016);
  gain.gain.setValueAtTime(0.055, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.016);
  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);
  osc.start(now);
  osc.stop(now + 0.018);
  return true;
}
