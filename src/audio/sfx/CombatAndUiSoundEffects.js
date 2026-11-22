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
