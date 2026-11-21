/**
 * SuburbioNorteAmbience.js
 * Trilha Dark Ambient / Noir de 10 minutos (600s) — Subúrbio Norte, Posto & Pinhal Boreal.
 *
 * Identidade Sonora:
 * - Eerie Empty Suburbia, Flickering Sodium Streetlights & Northern Pinewoods Noir
 *   (Twin Peaks / True Detective / Alan Wake — Em9 -> Cmaj7#11 -> Am9 -> B7b9).
 * - Solitário, inquietante, noturno e de volume ambiente (gain 0.013..0.046, cutoff 210..740 Hz).
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

const clampGain = (v) => Math.max(0.013, Math.min(0.046, v));
const clampCutoff = (v) => Math.max(210, Math.min(740, v));
const pickCyclic = (arr, idx) => arr[((idx % arr.length) + arr.length) % arr.length];

const HARMONY_CELLS = {
  Em9: {
    pad: ['E2', 'B2', 'G3', 'F#3'], padAlt: ['E2', 'G2', 'B2', 'D3', 'F#3'],
    sub: 'E1', subAlt: 'B0', ping: 'E3', bowed: ['E2', 'B1'],
    rhodes: ['B3', 'F#3', 'G3', 'D4', 'E3'], rhodesComp: ['F#3', 'B2', 'D3', 'G3', 'B3'],
    nylon: ['E3', 'B3', 'F#3', 'G3', 'D3', 'B2']
  },
  Cmaj7s11: {
    pad: ['C2', 'G2', 'B2', 'F#3'], padAlt: ['C2', 'E2', 'B2', 'F#3'],
    sub: 'C1', subAlt: 'E1', ping: 'B2', bowed: ['C2', 'G1'],
    rhodes: ['B3', 'F#3', 'E3', 'G3', 'D4'], rhodesComp: ['E3', 'C3', 'G3', 'B2', 'F#3'],
    nylon: ['C3', 'G3', 'B3', 'F#3', 'E3', 'D3']
  },
  Am9: {
    pad: ['A1', 'E2', 'B2', 'C3'], padAlt: ['A1', 'E2', 'G2', 'B2', 'C3'],
    sub: 'E1', subAlt: 'C1', ping: 'C3', bowed: ['A1', 'E2'],
    rhodes: ['C4', 'B3', 'E3', 'G3', 'A3'], rhodesComp: ['E3', 'G3', 'B2', 'C3', 'E3'],
    nylon: ['A2', 'E3', 'B3', 'C4', 'G3', 'E3']
  },
  B7b9: {
    pad: ['B1', 'D#2', 'A2', 'C3'], padAlt: ['B1', 'F#2', 'A2', 'C3', 'D#3'],
    sub: 'B0', subAlt: 'C1', ping: 'B2', bowed: ['B1', 'F#1'],
    rhodes: ['A3', 'C4', 'F#3', 'D#3', 'B2'], rhodesComp: ['D#3', 'F#3', 'A2', 'C3', 'F#3'],
    nylon: ['B2', 'F#3', 'A3', 'C4', 'D#3', 'F#2']
  }
};

const MOVEMENTS = [
  {
    id: 'casas_apagadas', name: 'I. Casas Apagadas & Vapor de Sódio', title: 'I. Casas Apagadas & Vapor de Sódio',
    startSec: 0, endSec: 120, progression: ['Em9', 'Em9', 'Cmaj7s11', 'Em9'],
    tension: 0.22, padGain: 0.025, padCutoff: 275, padPeak: 415,
    rhodesChance: 0.68, dyadChance: 0.28, nylonChance: 0.44, eerieChance: 0.24, windColor: 'brown', fifthHum: false
  },
  {
    id: 'posto_fantasma', name: 'II. Posto Fantasma na Rodovia Norte', title: 'II. Posto Fantasma na Rodovia Norte',
    startSec: 120, endSec: 240, progression: ['Em9', 'Cmaj7s11', 'Am9', 'Cmaj7s11'],
    tension: 0.46, padGain: 0.031, padCutoff: 325, padPeak: 500,
    rhodesChance: 0.80, dyadChance: 0.48, nylonChance: 0.64, eerieChance: 0.54, windColor: 'brown', fifthHum: true
  },
  {
    id: 'pinhal_boreal', name: 'III. Névoa no Pinhal Boreal', title: 'III. Névoa no Pinhal Boreal',
    startSec: 240, endSec: 360, progression: ['Em9', 'Cmaj7s11', 'Am9', 'B7b9'],
    tension: 0.72, padGain: 0.036, padCutoff: 370, padPeak: 595,
    rhodesChance: 0.86, dyadChance: 0.62, nylonChance: 0.76, eerieChance: 0.78, windColor: 'pink', fifthHum: true
  },
  {
    id: 'sombra_quintais', name: 'IV. Sombra Entre os Quintais', title: 'IV. Sombra Entre os Quintais',
    startSec: 360, endSec: 480, progression: ['Am9', 'B7b9', 'Em9', 'Cmaj7s11'],
    tension: 0.90, padGain: 0.041, padCutoff: 420, padPeak: 685,
    rhodesChance: 0.92, dyadChance: 0.74, nylonChance: 0.84, eerieChance: 0.90, windColor: 'pink', fifthHum: true
  },
  {
    id: 'madrugada_fria', name: 'V. Madrugada Fria Antes da Alvorada', title: 'V. Madrugada Fria Antes da Alvorada',
    startSec: 480, endSec: 600, progression: ['Cmaj7s11', 'Am9', 'Em9', 'Em9'],
    tension: 0.28, padGain: 0.024, padCutoff: 265, padPeak: 390,
    rhodesChance: 0.60, dyadChance: 0.30, nylonChance: 0.40, eerieChance: 0.28, windColor: 'brown', fifthHum: false
  }
];

function resolveHarmonicCellAt(eventCursorSec) {
  const { movement, index, localProgress } = resolveMovementAt(MOVEMENTS, eventCursorSec, 600);
  const barIdx = Math.floor(Math.max(0, eventCursorSec) / 15);
  const cell = HARMONY_CELLS[pickCyclic(movement.progression, barIdx)] || HARMONY_CELLS.Em9;
  const codaFade = index === 4 ? 1 - localProgress * 0.24 : 1;
  const codaDensity = index === 4 ? 1 - localProgress * 0.32 : 1;
  return { movement, cell, codaFade, codaDensity };
}

export const SUBURBIO_NORTE_AMBIENCE = {
  id: 'suburbio_norte',
  title: 'Vapor de Sódio & Pinhal Boreal',
  durationSec: 600,
  baseGain: 0.84,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 0.25, rig, targetNode, startTime, contextState } = {}) {
    if (!rig || !(windowDurSec > 0)) return 0;
    const baseTime = Number.isFinite(startTime) ? startTime : (rig.ctx?.currentTime || 0);
    const nightBoost = typeof contextState?.nightFactor === 'number'
      ? 0.94 + Math.max(0, Math.min(1, contextState.nightFactor)) * 0.10
      : 1.0;
    let scheduled = 0;

    // 1. Pad Analógico Sombrio de Madrugada Deserta (15s)
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 15, 0.0);
    if (padTrig.hit) {
      const { movement: mv, cell, codaFade } = resolveHarmonicCellAt(cursorSec + padTrig.delaySec);
      const r = seededRand(padTrig.stepIndex * 1.73 + 11.1);
      playDarkPadChord(rig, {
        notes: r > 0.56 ? cell.padAlt : cell.pad,
        time: baseTime + padTrig.delaySec,
        duration: 16.4, attack: 4.3, release: 5.4,
        cutoff: clampCutoff(mv.padCutoff * codaFade),
        cutoffPeak: clampCutoff(mv.padPeak * codaFade),
        detuneCents: 6.5 + mv.tension * 4.2,
        gain: clampGain(mv.padGain * codaFade * nightBoost),
        pan: (seededRand(padTrig.stepIndex * 2.31 + 3.7) - 0.5) * 0.24,
        reverb: 0.82, delay: 0.24, dest: targetNode
      });
      scheduled++;
    }

    // 2. Zumbido de Transformador de Vapor de Sódio & Estrada Deserta (22s)
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 22, 2.4);
    if (subTrig.hit) {
      const { movement: mv, cell, codaFade } = resolveHarmonicCellAt(cursorSec + subTrig.delaySec);
      const r = seededRand(subTrig.stepIndex * 3.17 + 19.4);
      playSubDrone(rig, {
        note: r > 0.62 ? cell.subAlt : cell.sub,
        glideToNote: mv.tension > 0.68 && r > 0.45 ? cell.subAlt : undefined,
        fifth: mv.fifthHum,
        time: baseTime + subTrig.delaySec,
        duration: 21.6, attack: 4.6, release: 5.6,
        cutoff: clampCutoff(212 + mv.tension * 26),
        gain: clampGain((0.024 + mv.tension * 0.013) * codaFade),
        reverb: 0.34, dest: targetNode
      });
      scheduled++;
    }

    // 3. Acordes Lentos e Solitários de Rhodes Escuro (9.2s)
    const rhodesTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 9.2, 1.5);
    if (rhodesTrig.hit) {
      const { movement: mv, cell, codaFade, codaDensity } = resolveHarmonicCellAt(cursorSec + rhodesTrig.delaySec);
      const gate = seededRand(rhodesTrig.stepIndex * 4.09 + 29.8);
      if (gate < mv.rhodesChance * codaDensity) {
        playNoirFeltNote(rig, {
          note: pickCyclic(cell.rhodes, rhodesTrig.stepIndex + Math.floor(gate * 5)),
          tone: 'rhodes',
          time: baseTime + rhodesTrig.delaySec,
          duration: 5.8 + seededRand(rhodesTrig.stepIndex + 5.2) * 2.1,
          gain: clampGain((0.018 + mv.tension * 0.014) * codaFade * nightBoost),
          cutoff: clampCutoff(410 + mv.tension * 235),
          pan: (seededRand(rhodesTrig.stepIndex * 1.91 + 7.4) - 0.5) * 0.58,
          reverb: 0.88, delay: 0.58, dest: targetNode
        });
        scheduled++;
      }
    }

    const rhodesCompTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 9.2, 1.78);
    if (rhodesCompTrig.hit) {
      const { movement: mv, cell, codaFade, codaDensity } = resolveHarmonicCellAt(cursorSec + rhodesCompTrig.delaySec);
      const gate = seededRand(rhodesCompTrig.stepIndex * 5.63 + 43.1);
      if (gate < mv.dyadChance * codaDensity) {
        playNoirFeltNote(rig, {
          note: pickCyclic(cell.rhodesComp, rhodesCompTrig.stepIndex + 1),
          tone: 'rhodes',
          time: baseTime + rhodesCompTrig.delaySec,
          duration: 5.2 + gate * 1.8,
          gain: clampGain((0.014 + mv.tension * 0.009) * codaFade),
          cutoff: clampCutoff(370 + mv.tension * 210),
          pan: (seededRand(rhodesCompTrig.stepIndex * 2.77 + 14.2) - 0.5) * 0.52,
          reverb: 0.90, delay: 0.62, dest: targetNode
        });
        scheduled++;
      }
    }

    // 4. Guitarra Limpa Abafada / Nylon Noturno Solitário (6.4s)
    const nylonTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 6.4, 0.85);
    if (nylonTrig.hit) {
      const { movement: mv, cell, codaFade, codaDensity } = resolveHarmonicCellAt(cursorSec + nylonTrig.delaySec);
      const gate = seededRand(nylonTrig.stepIndex * 6.41 + 61.7);
      if (gate < mv.nylonChance * codaDensity) {
        playNoirFeltNote(rig, {
          note: pickCyclic(cell.nylon, nylonTrig.stepIndex + Math.floor(gate * 3)),
          tone: 'nylon',
          time: baseTime + nylonTrig.delaySec,
          duration: 4.1 + seededRand(nylonTrig.stepIndex + 9.3) * 1.9,
          gain: clampGain((0.015 + mv.tension * 0.013) * codaFade * nightBoost),
          cutoff: clampCutoff(430 + mv.tension * 265),
          pan: (seededRand(nylonTrig.stepIndex * 3.53 + 21.9) - 0.5) * 0.66,
          reverb: 0.85, delay: 0.56, dest: targetNode
        });
        scheduled++;
      }
    }

    // 5. Vento Frio do Planalto Boreal & Ecos Inquietantes da Rodovia (31s)
    const windTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 31, 4.8);
    if (windTrig.hit) {
      const { movement: mv, codaFade } = resolveHarmonicCellAt(cursorSec + windTrig.delaySec);
      playAtmosphericNoiseSwell(rig, {
        color: mv.windColor,
        time: baseTime + windTrig.delaySec,
        duration: 15.6, attack: 4.9,
        gain: clampGain((0.015 + mv.tension * 0.012) * codaFade),
        filterType: 'bandpass', q: 1.45 + mv.tension * 0.85,
        freqStart: clampCutoff(235 + mv.tension * 85),
        freqEnd: clampCutoff(385 + mv.tension * 245),
        pan: (seededRand(windTrig.stepIndex * 2.13 + 71.5) - 0.5) * 0.56,
        reverb: 0.72, delay: 0.22, seed: windTrig.stepIndex + 37, dest: targetNode
      });
      scheduled++;
    }

    const eerieTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 31, 17.6);
    if (eerieTrig.hit) {
      const { movement: mv, cell, codaFade, codaDensity } = resolveHarmonicCellAt(cursorSec + eerieTrig.delaySec);
      const gate = seededRand(eerieTrig.stepIndex * 7.19 + 88.3);
      if (gate < mv.eerieChance * codaDensity) {
        if (eerieTrig.stepIndex % 2 === 0) {
          playBowedMetalOrHorn(rig, {
            note: pickCyclic(cell.bowed, eerieTrig.stepIndex), bendRatio: 0.974,
            time: baseTime + eerieTrig.delaySec, duration: 9.4, attack: 3.1,
            gain: clampGain((0.014 + mv.tension * 0.011) * codaFade),
            cutoff: clampCutoff(260 + mv.tension * 215),
            pan: (seededRand(eerieTrig.stepIndex + 12.6) - 0.5) * 0.62,
            reverb: 0.88, delay: 0.34, dest: targetNode
          });
        } else {
          playMetallicEchoPing(rig, {
            note: cell.ping, ratios: [1.0, 1.51, 2.04],
            time: baseTime + eerieTrig.delaySec, duration: 4.0,
            gain: clampGain((0.013 + mv.tension * 0.008) * codaFade),
            cutoff: clampCutoff(335 + mv.tension * 215),
            pan: (seededRand(eerieTrig.stepIndex + 27.4) - 0.5) * 0.54,
            reverb: 0.89, delay: 0.56, dest: targetNode
          });
        }
        scheduled++;
      }
    }

    return scheduled;
  }
};

export default SUBURBIO_NORTE_AMBIENCE;
