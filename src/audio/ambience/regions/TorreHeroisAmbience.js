/**
 * TorreHeroisAmbience.js
 * Trilha Dark Ambient generativa de 10 minutos (600s) — Complexo da Torre dos Heróis & Laboratório OP-09.
 * Identidade Sonora: Belfry / Batcave Cryo-Tech Sanctuary & 310m Spire (D Aeolian / D Phrygian).
 * Harmonia: Dm9 -> Bbmaj7#11 -> Gm9 -> Asus4/Eb | gain 0.014..0.048 | cutoff 240..780 Hz.
 */

import {
  checkPeriodicTrigger,
  resolveMovementAt,
  seededRand,
  playDarkPadChord,
  playSubDrone,
  playNoirFeltNote,
  playBowedMetalOrHorn,
  playAtmosphericNoiseSwell,
  playMetallicEchoPing
} from '../AmbienceSynthPrimitives.js';

const DM9 = ['D2', 'A2', 'C3', 'E3', 'F3'];
const BB_MAJ7_11 = ['Bb1', 'F2', 'A2', 'D3', 'E3'];
const GM9 = ['G1', 'D2', 'Bb2', 'F3', 'A3'];
const ASUS4_EB = ['Eb2', 'A2', 'D3', 'E3'];
const ASUS4_EB_LOW = ['Eb1', 'A2', 'D3', 'E3'];
const DM_ADD9 = ['D2', 'A2', 'D3', 'E3', 'F3'];

const MOVEMENTS = [
  {
    id: 'atrio_monolitico', title: 'I. Átrio Monolítico & Sentinela Silenciosa', startSec: 0, endSec: 120,
    scale: 'D Aeolian', chords: [DM9, BB_MAJ7_11, GM9, ASUS4_EB], subNotes: ['D1', 'Bb0', 'G1', 'A1'],
    motif: ['D3', 'A3', 'E3', 'F3', 'C3', 'A2'], counter: ['A3', 'E3', 'F3', 'D4'],
    padWave: 'triangle', padCut: [280, 430], padGain: 0.028, subGain: 0.030, density: 0.68, glassRatio: 0.24, horn: false
  },
  {
    id: 'camara_criogenica', title: 'II. Câmara Criogênica & Telemetria OP-09', startSec: 120, endSec: 240,
    scale: 'D Aeolian / Phrygian', chords: [DM9, ASUS4_EB, BB_MAJ7_11, GM9], subNotes: ['D1', 'A1', 'Bb0', 'G1'],
    motif: ['A3', 'E4', 'F3', 'D4', 'C4', 'Bb3', 'E3'], counter: ['E4', 'A3', 'Bb3', 'F3', 'D4'],
    padWave: 'sawtooth', padCut: [320, 520], padGain: 0.031, subGain: 0.034, density: 0.82, glassRatio: 0.66, horn: false
  },
  {
    id: 'nucleo_vigilancia', title: 'III. Núcleo de Vigilância Noturna (310m)', startSec: 240, endSec: 360,
    scale: 'D Phrygian / Aeolian', chords: [DM9, BB_MAJ7_11, GM9, ASUS4_EB_LOW], subNotes: ['D1', 'Bb0', 'G1', 'A1'],
    motif: ['D4', 'A3', 'F3', 'E3', 'Bb3', 'Eb3', 'C4'], counter: ['A3', 'E4', 'F3', 'Eb3', 'D4'],
    padWave: 'sawtooth', padCut: [370, 650], padGain: 0.036, subGain: 0.036, density: 0.90, glassRatio: 0.52, horn: true
  },
  {
    id: 'protocolo_sombra', title: 'IV. Protocolo Sombra & Ressonância Subterrânea', startSec: 360, endSec: 480,
    scale: 'D Phrygian', chords: [ASUS4_EB, DM9, GM9, BB_MAJ7_11], subNotes: ['A1', 'D1', 'G1', 'Bb0'],
    motif: ['Eb3', 'A3', 'D3', 'F3', 'Bb3', 'E3', 'C3'], counter: ['Bb3', 'E3', 'A3', 'D3', 'F3'],
    padWave: 'sawtooth', padCut: [315, 510], padGain: 0.032, subGain: 0.035, density: 0.76, glassRatio: 0.40, horn: true
  },
  {
    id: 'vigilia_alvorada_fria', title: 'V. Vigília Fria no Pináculo & Retorno', startSec: 480, endSec: 600,
    scale: 'D Aeolian', chords: [DM9, GM9, BB_MAJ7_11, DM_ADD9], subNotes: ['D1', 'G1', 'Bb0', 'D1'],
    motif: ['A3', 'D3', 'E3', 'F3', 'A2', 'C3'], counter: ['E3', 'A3', 'D4', 'F3'],
    padWave: 'triangle', padCut: [265, 405], padGain: 0.025, subGain: 0.028, density: 0.58, glassRatio: 0.25, horn: false
  }
];

const PING_NOTES = ['D3', 'A2', 'F3', 'E3', 'Bb2', 'G2'];
const HORN_NOTES = ['D2', 'A1', 'G1', 'Eb2'];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const pick = (arr, idx) => arr[((idx % arr.length) + arr.length) % arr.length];

function resolveVerticalProfile(contextState) {
  const altY = Number.isFinite(contextState?.altitudeY) ? contextState.altitudeY : 0;
  const isBasement = contextState?.subRegionId === 'porao_torre_herois' || altY < -2;
  const isHighSpire = !isBasement && altY > 120;
  const depthFactor = isBasement ? clamp(0.65 + Math.max(0, -2 - altY) / 24, 0.65, 1.0) : 0;
  const spireFactor = isHighSpire ? clamp(0.35 + Math.max(0, altY - 120) / 190, 0.35, 1.0) : 0;
  return { altY, isBasement, isHighSpire, depthFactor, spireFactor };
}

export const TORRE_HEROIS_AMBIENCE = {
  id: 'torre_herois',
  title: 'Santuário Crio-Tático & Pináculo 310m',
  durationSec: 600,
  baseGain: 0.85,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 2.0, rig, targetNode, startTime, contextState } = {}) {
    if (!rig?.ctx || !(windowDurSec > 0)) return 0;

    const baseTime = Number.isFinite(startTime) ? startTime : (rig.ctx.currentTime || 0);
    const { movement: mv, index: mvIdx, localProgress } = resolveMovementAt(MOVEMENTS, cursorSec, 600);
    const breath = Math.sin(localProgress * Math.PI);
    const vert = resolveVerticalProfile(contextState);
    let scheduled = 0;

    // 1. Reator Criogênico Sub-Harmônico (14s) + Reforço Subterrâneo OP-09 (23s)
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 14, 0.0);
    if (subTrig.hit) {
      playSubDrone(rig, {
        note: pick(mv.subNotes, subTrig.stepIndex),
        glideToNote: mvIdx === 3 && subTrig.stepIndex % 2 === 0 ? 'D1' : undefined,
        fifth: true, time: baseTime + subTrig.delaySec, duration: 16.4, attack: 3.8, release: 4.8,
        cutoff: vert.isBasement ? 148 : 178,
        gain: clamp(mv.subGain + vert.depthFactor * 0.011 - vert.spireFactor * 0.005, 0.016, 0.048),
        reverb: vert.isBasement ? 0.38 : 0.26, dest: targetNode
      });
      scheduled++;
    }

    if (vert.isBasement) {
      const labSubTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 23, 5.2);
      if (labSubTrig.hit) {
        playSubDrone(rig, {
          note: labSubTrig.stepIndex % 2 === 0 ? 'D1' : 'A1', fifth: true,
          time: baseTime + labSubTrig.delaySec, duration: 12.5, attack: 3.4, release: 4.2, cutoff: 136,
          gain: clamp(0.020 + vert.depthFactor * 0.012, 0.016, 0.036), reverb: 0.42, dest: targetNode
        });
        scheduled++;
      }
    }

    // 2. Pads Solenes Frios do Santuário (19s): Dm9 -> Bbmaj7#11 -> Gm9 -> Asus4/Eb
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 19, 0.5);
    if (padTrig.hit) {
      const baseCut = clamp(mv.padCut[0] + breath * 45 - vert.depthFactor * 35, 240, 620);
      const peakCut = clamp(mv.padCut[1] + breath * 65 + vert.spireFactor * 45, baseCut + 40, 760);
      playDarkPadChord(rig, {
        notes: pick(mv.chords, padTrig.stepIndex), time: baseTime + padTrig.delaySec,
        duration: 20.6, attack: 4.8, release: 6.2, waveform: mv.padWave,
        cutoff: baseCut, cutoffPeak: peakCut, detuneCents: 6.5, q: 0.85,
        gain: clamp(mv.padGain + breath * 0.005, 0.018, 0.044),
        pan: (seededRand(padTrig.stepIndex * 3.17 + mvIdx) - 0.5) * 0.36,
        reverb: vert.isHighSpire ? 0.84 : 0.76, delay: 0.22, dest: targetNode
      });
      scheduled++;
    }

    // 3. Notas Lentas Misteriosas 'felt' & 'glass' (6.8s) + Contraponto Cristalino (29s)
    const noteTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 6.8, 2.1);
    if (noteTrig.hit && seededRand(noteTrig.stepIndex * 7.13 + mvIdx * 19.1) <= mv.density) {
      const glassChance = clamp(mv.glassRatio + vert.depthFactor * 0.16, 0.15, 0.82);
      const tone = seededRand(noteTrig.stepIndex * 11.47 + 3.7) < glassChance ? 'glass' : 'felt';
      playNoirFeltNote(rig, {
        note: pick(mv.motif, noteTrig.stepIndex + mvIdx), tone,
        time: baseTime + noteTrig.delaySec, duration: tone === 'glass' ? 5.6 : 4.9,
        cutoff: tone === 'glass' ? clamp(510 + breath * 140, 420, 740) : clamp(360 + breath * 110, 280, 560),
        gain: clamp(0.016 + seededRand(noteTrig.stepIndex * 2.9) * 0.009, 0.014, 0.028),
        pan: (seededRand(noteTrig.stepIndex * 5.31) - 0.5) * 0.58, reverb: 0.82, delay: 0.46, dest: targetNode
      });
      scheduled++;
    }

    const counterTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 29, 8.4);
    if (counterTrig.hit) {
      playNoirFeltNote(rig, {
        note: pick(mv.counter, counterTrig.stepIndex), tone: vert.isBasement || mvIdx === 1 ? 'glass' : 'felt',
        time: baseTime + counterTrig.delaySec, duration: 6.2, cutoff: clamp(480 + breath * 130, 360, 720),
        gain: 0.017, pan: (seededRand(counterTrig.stepIndex * 9.07) - 0.5) * 0.64,
        reverb: 0.86, delay: 0.50, dest: targetNode
      });
      scheduled++;
    }

    // 4. Climatização de Câmara Subterrânea / Vento do Pináculo de 310m (11s + rajadas 17s acima de 120m)
    const airTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 11, 1.4);
    if (airTrig.hit) {
      playAtmosphericNoiseSwell(rig, {
        color: vert.isHighSpire ? 'pink' : 'brown',
        filterType: vert.isBasement ? 'lowpass' : 'bandpass',
        q: vert.isBasement ? 1.1 : vert.isHighSpire ? 1.25 : 1.55,
        freqStart: vert.isBasement ? 240 : vert.isHighSpire ? 295 : 255,
        freqEnd: vert.isBasement ? 335 : clamp(410 + vert.spireFactor * 270 + breath * 45, 340, 750),
        time: baseTime + airTrig.delaySec, duration: 12.2, attack: 3.8,
        gain: clamp(0.015 + vert.spireFactor * 0.015 + vert.depthFactor * 0.006, 0.014, 0.034),
        pan: (seededRand(airTrig.stepIndex * 4.73) - 0.5) * (vert.isHighSpire ? 0.65 : 0.25),
        reverb: 0.64, delay: 0.14, seed: airTrig.stepIndex * 1.91 + mvIdx, dest: targetNode
      });
      scheduled++;
    }

    if (vert.isHighSpire) {
      const gustTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 17, 4.3);
      if (gustTrig.hit) {
        playAtmosphericNoiseSwell(rig, {
          color: 'pink', filterType: 'bandpass', q: 1.35,
          freqStart: 310, freqEnd: clamp(520 + vert.spireFactor * 220, 480, 760),
          time: baseTime + gustTrig.delaySec, duration: 9.6, attack: 2.9,
          gain: clamp(0.014 + vert.spireFactor * 0.013, 0.014, 0.029),
          pan: (seededRand(gustTrig.stepIndex * 8.19) - 0.5) * 0.72,
          reverb: 0.70, delay: 0.18, seed: gustTrig.stepIndex * 3.37 + 19, dest: targetNode
        });
        scheduled++;
      }
    }

    // 5. Ressonância Metálica Suave de Torre / Laboratório Crio-Tech (27s + 17s no subsolo)
    const pingTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 27, 6.0);
    if (pingTrig.hit) {
      playMetallicEchoPing(rig, {
        note: pick(PING_NOTES, pingTrig.stepIndex + mvIdx),
        ratios: vert.isBasement ? [1.0, 1.414, 1.98] : [1.0, 1.498, 2.04],
        time: baseTime + pingTrig.delaySec, duration: vert.isBasement ? 4.4 : 3.8, attack: 0.035,
        cutoff: clamp(vert.isBasement ? 460 : 540 + breath * 90, 340, 680),
        gain: clamp(0.015 + vert.depthFactor * 0.006, 0.014, 0.023),
        pan: (seededRand(pingTrig.stepIndex * 6.41) - 0.5) * 0.52, reverb: 0.88, delay: 0.54, dest: targetNode
      });
      scheduled++;
    }

    if (vert.isBasement) {
      const labPingTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 17, 9.5);
      if (labPingTrig.hit) {
        playMetallicEchoPing(rig, {
          note: pick(['A2', 'D3', 'E3', 'Bb2'], labPingTrig.stepIndex),
          ratios: [1.0, 1.335, 1.87], pitchDrop: 0.985,
          time: baseTime + labPingTrig.delaySec, duration: 4.1, attack: 0.03, cutoff: 440,
          gain: clamp(0.014 + vert.depthFactor * 0.005, 0.014, 0.021),
          pan: (seededRand(labPingTrig.stepIndex * 12.3) - 0.5) * 0.48, reverb: 0.90, delay: 0.56, dest: targetNode
        });
        scheduled++;
      }
    }

    // 6. Ressonância Solene de Metal Friccionado nos Movimentos III e IV (31s)
    if (mv.horn) {
      const hornTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 31, 12.0);
      if (hornTrig.hit) {
        playBowedMetalOrHorn(rig, {
          note: pick(HORN_NOTES, hornTrig.stepIndex), bendRatio: 0.986,
          time: baseTime + hornTrig.delaySec, duration: 9.8, attack: 3.1,
          cutoff: clamp(320 + breath * 90, 260, 480), q: 2.1, gain: 0.018,
          pan: (seededRand(hornTrig.stepIndex * 10.7) - 0.5) * 0.40, reverb: 0.88, delay: 0.30, dest: targetNode
        });
        scheduled++;
      }
    }

    return scheduled;
  }
};

export default TORRE_HEROIS_AMBIENCE;
