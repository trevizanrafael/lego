/**
 * Núcleo WebAudio seguro para ambientes headless, barramentos de ganho (Master/SFX/Music),
 * geradores auxiliares de osciladores/ruído e loops contínuos (música urbana/baile, motores, sirenes e metrô).
 */

export function initSoundFXState(sfx) {
  sfx.ctx = null;
  sfx.sfxBus = null;
  sfx.musicBus = null;
  sfx.masterVolume = 0.85;
  sfx.musicVolume = 0.55;
  sfx.sfxVolume = 0.9;
  sfx.isMusicPlaying = false;
  sfx.isBossMusicActive = false;
  sfx._musicInterval = null;
  sfx._musicStep = 0;
  sfx.baileFunkMix = 0;
  sfx.baileBeatPulse = 0;
  sfx.tiktokRadioActive = false;
}

export function ensureWebAudioContext(sfx) {
  if (!sfx.ctx) {
    const root =
      typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
    const AudioCtx = root && (root.AudioContext || root.webkitAudioContext);
    if (typeof AudioCtx === 'function') {
      try {
        sfx.ctx = new AudioCtx();
        sfx.sfxBus = sfx.ctx.createGain();
        sfx.musicBus = sfx.ctx.createGain();
        sfx.sfxBus.connect(sfx.ctx.destination);
        sfx.musicBus.connect(sfx.ctx.destination);
        sfx._applyBusVolumes();
      } catch (_) {
        sfx.ctx = null;
      }
    }
  }
  if (sfx.ctx && sfx.ctx.state === 'suspended' && typeof sfx.ctx.resume === 'function') {
    sfx.ctx.resume().catch(() => {});
  }
  return sfx.ctx;
}

export function applySoundBusVolumes(sfx) {
  if (!sfx.ctx) return;
  if (sfx.sfxBus) {
    sfx.sfxBus.gain.setValueAtTime(
      Math.max(0, Math.min(1, sfx.masterVolume * sfx.sfxVolume)),
      sfx.ctx.currentTime
    );
  }
  if (sfx.musicBus) {
    sfx.musicBus.gain.setValueAtTime(
      Math.max(0, Math.min(1, sfx.masterVolume * sfx.musicVolume)),
      sfx.ctx.currentTime
    );
  }
}

export function setSoundVolumes(sfx, { masterVolume, musicVolume, sfxVolume } = {}) {
  if (typeof masterVolume === 'number') sfx.masterVolume = Math.max(0, Math.min(1, masterVolume));
  if (typeof musicVolume === 'number') sfx.musicVolume = Math.max(0, Math.min(1, musicVolume));
  if (typeof sfxVolume === 'number') sfx.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
  sfx._applyBusVolumes();
}

export function createWhiteNoiseBuffer(ctx, durationSec = 0.2) {
  if (!ctx || typeof ctx.createBuffer !== 'function') return null;
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    channel[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Som de partida de motor / ignição ao entrar no veículo com [E]
 */
export function playCarEngineStartLoop(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(65, now);
  osc.frequency.exponentialRampToValueAtTime(145, now + 0.14);
  osc.frequency.exponentialRampToValueAtTime(92, now + 0.28);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  osc.connect(gain);
  gain.connect(sfx.sfxBus || ctx.destination);

  osc.start(now);
  osc.stop(now + 0.31);
}

/**
 * Buzina de Trânsito Urbano (Duplo tom automotivo ou Sirene curta policial YELP)
 */
export function playCarHornLoop(sfx, volumeScale = 1.0, isPoliceSiren = false) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;
  const vol = Math.max(0.015, Math.min(0.14, 0.11 * volumeScale));
  const now = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  if (isPoliceSiren) {
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(640, now);
    osc1.frequency.exponentialRampToValueAtTime(1280, now + 0.14);
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.28);

    osc2.frequency.setValueAtTime(648, now);
    osc2.frequency.exponentialRampToValueAtTime(1292, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(668, now + 0.28);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.31);
    osc2.stop(now + 0.31);
  } else {
    const f1 = 370 + Math.random() * 45;
    const f2 = f1 * 1.25;
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(f1, now);
    osc2.frequency.setValueAtTime(f2, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.setValueAtTime(vol * 0.9, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.25);
    osc2.stop(now + 0.25);
  }
}

/**
 * Sirene Tática de Alerta de Evento Urbano / Esquadrão de Elite
 */
export function playRadioAlertSirenLoop(sfx) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [587.33, 880.0, 587.33, 1174.66];
  notes.forEach((f, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const t = now + idx * 0.095;
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);
    osc.start(t);
    osc.stop(t + 0.095);
  });
}

/**
 * Sinal sonoro suave "Ding-Dong" (Mi5 -> Dó5 harmônico) de abertura/fechamento de portas nas 5 Estações do Metrô LEGO
 */
export function playMetroDingDongLoop(sfx, volume = 0.65) {
  const ctx = sfx._ensureContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.max(0.05, Math.min(1.0, volume)) * 0.16;
  const chimeNotes = [
    { freq: 659.25, delay: 0.0, dur: 0.36 },  // E5 ("Ding")
    { freq: 523.25, delay: 0.24, dur: 0.48 }  // C5 ("Dong")
  ];

  for (const note of chimeNotes) {
    const t = now + note.delay;
    const oscMain = ctx.createOscillator();
    const oscHarm = ctx.createOscillator();
    const gain = ctx.createGain();

    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(note.freq, t);

    oscHarm.type = 'triangle';
    oscHarm.frequency.setValueAtTime(note.freq * 2.0, t);

    gain.gain.setValueAtTime(0.001, t);
    if (typeof gain.gain.linearRampToValueAtTime === 'function') {
      gain.gain.linearRampToValueAtTime(vol, t + 0.018);
    } else {
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.018);
    }
    gain.gain.exponentialRampToValueAtTime(0.001, t + note.dur);

    oscMain.connect(gain);
    oscHarm.connect(gain);
    gain.connect(sfx.sfxBus || ctx.destination);

    oscMain.start(t);
    oscHarm.start(t);
    oscMain.stop(t + note.dur + 0.02);
    oscHarm.stop(t + note.dur + 0.02);
  }
}

/**
 * GROOVE URBANO SOLAR & HEROICO ESTILO LEGO MARVEL ("MANHATTAN FREE ROAM THEME")
 * Sequenciador leve em Dó Maior / Sol Mixolídio (115 BPM) + Batidão Funk Espacial da CDD!
 */
export function startWarMusicLoop(sfx) {
  if (sfx.isMusicPlaying) return;
  sfx.isMusicPlaying = true;
  sfx._musicStep = 0;

  if (sfx._musicInterval) {
    clearInterval(sfx._musicInterval);
  }

  // 115 BPM -> semicolcheia suave a cada 130ms
  sfx._musicInterval = setInterval(() => {
    if (!sfx.isMusicPlaying || sfx.masterVolume * sfx.musicVolume <= 0.01) return;
    const ctx = sfx._ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const step = sfx._musicStep % 32;
    sfx._musicStep++;
    const now = ctx.currentTime;
    const dest = sfx.musicBus || ctx.destination;

    if (sfx.tiktokRadioActive) return;

    const baileMix = Math.max(0, Math.min(1, sfx.baileFunkMix || 0));
    const cityMix = Math.max(0, 1.0 - baileMix * 0.92);

    // A) BATIDÃO INSTRUMENTAL FUNK CARIOCA LEGO (PAREDÃO DA CDD — ATÉ 75m!)
    if (baileMix > 0.02) {
      const s16 = step % 16;

      // 1. Bumbo Grave 808 Encorpado do Paredão ("BOOM ... BOOM-BOOM")
      if (s16 === 0 || s16 === 6 || s16 === 10 || s16 === 14) {
        sfx.baileBeatPulse = 1.0;
        const subOsc = ctx.createOscillator();
        const punchOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        punchOsc.type = 'triangle';
        const root808 = step < 16 ? 55.0 : 49.0; // A1 -> G1
        subOsc.frequency.setValueAtTime(142, now);
        subOsc.frequency.exponentialRampToValueAtTime(root808, now + 0.055);
        punchOsc.frequency.setValueAtTime(195, now);
        punchOsc.frequency.exponentialRampToValueAtTime(root808 * 1.5, now + 0.045);

        subGain.gain.setValueAtTime(0.32 * baileMix, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
        subOsc.connect(subGain);
        punchOsc.connect(subGain);
        subGain.connect(dest);
        subOsc.start(now);
        punchOsc.start(now);
        subOsc.stop(now + 0.22);
        punchOsc.stop(now + 0.08);
      }

      // 2. Tamborim Carioca Sincopado ("Telecoteco" clássico do Tamborzão!)
      if (s16 === 2 || s16 === 3 || s16 === 7 || s16 === 11 || s16 === 12 || s16 === 15) {
        const tambOsc = ctx.createOscillator();
        const tambGain = ctx.createGain();
        tambOsc.type = s16 % 2 === 0 ? 'square' : 'triangle';
        const fStart = s16 === 3 || s16 === 12 ? 880 : 740;
        tambOsc.frequency.setValueAtTime(fStart, now);
        tambOsc.frequency.exponentialRampToValueAtTime(360, now + 0.048);
        tambGain.gain.setValueAtTime(0.11 * baileMix, now);
        tambGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        tambOsc.connect(tambGain);
        tambGain.connect(dest);
        tambOsc.start(now);
        tambOsc.stop(now + 0.06);
      }

      // 3. Riff de Metais / Synth Funk Carioca Divertido Estilo LEGO
      const funkHook = [
        440.0, 0, 0, 523.25, 0, 0, 587.33, 0,
        523.25, 0, 440.0, 0, 392.0, 0, 440.0, 0
      ];
      const hookFreq = funkHook[s16];
      if (hookFreq > 0) {
        const hOsc = ctx.createOscillator();
        const hGain = ctx.createGain();
        hOsc.type = 'sawtooth';
        hOsc.frequency.setValueAtTime(hookFreq, now);
        hGain.gain.setValueAtTime(0.068 * baileMix, now);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        hOsc.connect(hGain);
        hGain.connect(dest);
        hOsc.start(now);
        hOsc.stop(now + 0.13);
      }
    }

    if (cityMix <= 0.03) return;

    // 1. Batida Urbana Suave (Groove leve de passeio sem peso militar)
    if (step === 0 || step === 6 || step === 10 || step === 16 || step === 22 || step === 26) {
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(108, now);
      kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.095);
      kickGain.gain.setValueAtTime(0.13 * cityMix, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.105);
      kickOsc.connect(kickGain);
      kickGain.connect(dest);
      kickOsc.start(now);
      kickOsc.stop(now + 0.11);
    }

    // Rim / Clap suave nos tempos 4, 12, 20, 28 + Hi-hat leve nos pares
    if (step % 8 === 4) {
      const rimOsc = ctx.createOscillator();
      const rimGain = ctx.createGain();
      rimOsc.type = 'triangle';
      rimOsc.frequency.setValueAtTime(340, now);
      rimOsc.frequency.exponentialRampToValueAtTime(155, now + 0.055);
      rimGain.gain.setValueAtTime(0.055 * cityMix, now);
      rimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      rimOsc.connect(rimGain);
      rimGain.connect(dest);
      rimOsc.start(now);
      rimOsc.stop(now + 0.065);
    } else if (step % 2 === 0) {
      const hatOsc = ctx.createOscillator();
      const hatGain = ctx.createGain();
      hatOsc.type = 'sine';
      hatOsc.frequency.setValueAtTime(1480 + (step % 4) * 120, now);
      hatGain.gain.setValueAtTime(0.016 * cityMix, now);
      hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      hatOsc.connect(hatGain);
      hatGain.connect(dest);
      hatOsc.start(now);
      hatOsc.stop(now + 0.032);
    }

    // 2. Acordes Solares Alegres (C Major -> G Major -> F Major7 -> G6)
    if (step % 8 === 0) {
      const chordBank = [
        [261.63, 329.63, 392.0], // C4 - E4 - G4
        [246.94, 293.66, 392.0], // B3 - D4 - G4
        [261.63, 349.23, 440.0], // C4 - F4 - A4
        [293.66, 392.0, 493.88]  // D4 - G4 - B4
      ];
      const chord = chordBank[Math.floor(step / 8) % 4];
      for (const freq of chord) {
        const chOsc = ctx.createOscillator();
        const chGain = ctx.createGain();
        chOsc.type = 'sine';
        chOsc.frequency.setValueAtTime(freq, now);
        chGain.gain.setValueAtTime(0.032 * cityMix, now);
        chGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        chOsc.connect(chGain);
        chGain.connect(dest);
        chOsc.start(now);
        chOsc.stop(now + 0.44);
      }
    }

    // 3. Linha de Baixo Leve & Saltitante (Funky Urban Groove em Dó Maior)
    const bassPattern = [
      130.81, 0, 130.81, 164.81, 196.0, 0, 164.81, 146.83,
      98.0, 0, 98.0, 123.47, 146.83, 0, 164.81, 146.83,
      87.31, 0, 87.31, 110.0, 130.81, 0, 146.83, 130.81,
      98.0, 0, 123.47, 0, 146.83, 164.81, 196.0, 0
    ];
    const bassFreq = bassPattern[step];
    if (bassFreq > 0) {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(bassFreq, now);
      bassGain.gain.setValueAtTime(0.082 * cityMix, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.115);
      bassOsc.connect(bassGain);
      bassGain.connect(dest);
      bassOsc.start(now);
      bassOsc.stop(now + 0.12);
    }

    // 4. Tema Melódico Heroico & Aventureiro Estilo LEGO Marvel
    const leadMelody = [
      523.25, 0, 659.25, 0, 783.99, 0, 659.25, 587.33,
      587.33, 0, 659.25, 783.99, 0, 0, 587.33, 0,
      523.25, 0, 587.33, 0, 659.25, 0, 880.0, 783.99,
      659.25, 0, 587.33, 523.25, 587.33, 0, 0, 0
    ];
    const leadFreq = leadMelody[step];
    if (leadFreq > 0) {
      const leadOsc = ctx.createOscillator();
      const leadGain = ctx.createGain();
      leadOsc.type = 'triangle';
      leadOsc.frequency.setValueAtTime(leadFreq, now);
      leadGain.gain.setValueAtTime(0.048 * cityMix, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      leadOsc.connect(leadGain);
      leadGain.connect(dest);
      leadOsc.start(now);
      leadOsc.stop(now + 0.23);
    }
  }, 130);

  if (sfx._musicInterval && typeof sfx._musicInterval.unref === 'function') {
    sfx._musicInterval.unref();
  }
}

export function stopWarMusicLoop(sfx) {
  sfx.isMusicPlaying = false;
  if (sfx._musicInterval) {
    clearInterval(sfx._musicInterval);
    sfx._musicInterval = null;
  }
}

export function setBossMusicIntensityState(sfx, active) {
  sfx.isBossMusicActive = Boolean(active);
}

/**
 * Atualiza o crossfade espacial por proximidade (0..1 num raio de 75m) do Paredão do Baile da CDD!
 */
export function updateBaileSpatialProximityLoop(sfx, distanceMeters, dt = 0.016) {
  const maxRadius = 75.0;
  const rawRatio = distanceMeters < maxRadius ? 1.0 - distanceMeters / maxRadius : 0;
  // Curva suave (quadrática na borda e máxima perto do palco)
  const targetMix = rawRatio > 0 ? Math.min(1.0, Math.pow(rawRatio, 1.25) * 1.18) : 0;
  const blend = Math.min(1.0, dt * 4.5);
  sfx.baileFunkMix += (targetMix - sfx.baileFunkMix) * blend;
  if (sfx.baileFunkMix < 0.002) sfx.baileFunkMix = 0;

  if (targetMix > 0.05 && !sfx.isMusicPlaying) {
    sfx.startWarMusic();
  }
  sfx.baileBeatPulse = Math.max(0, (sfx.baileBeatPulse || 0) - dt * 6.5);
  return sfx.baileFunkMix;
}
