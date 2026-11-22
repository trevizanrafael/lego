/**
 * PraiaSulAmbience.js
 * Trilha Dark Ambient Generativa de 10 Minutos (600s) — Orla Marítima Sul, Praia Escura & Píer da Roda-Gigante.
 * Identidade: Midnight Ocean Surf, Coastal Fog & Ghostly Amusement Pier (Fm9 -> Dbmaj7 -> Bbm9 -> C7b9).
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

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const pickMod = (arr, idx) => arr[((idx % arr.length) + arr.length) % arr.length];

const MOVEMENTS = [
  {
    id: 'mare_negra_meia_noite',
    name: 'I. Maré Negra de Meia-Noite',
    title: 'I. Maré Negra de Meia-Noite',
    startSec: 0,
    endSec: 120,
    pad: { gain: 0.031, cutoff: 245, peak: 375 },
    subGain: 0.036,
    surfGain: 0.022,
    densities: { foam: 0.42, horn: 0.72, pier: 0.28, waltz: 0.0, creak: 0.2 },
    chords: [
      ['F2', 'C3', 'Eb3', 'G3', 'Ab3'],
      ['Db2', 'Ab2', 'C3', 'F3'],
      ['F2', 'Ab2', 'C3', 'Eb3'],
      ['C2', 'G2', 'Bb2', 'Db3']
    ],
    subNotes: ['F1', 'Db1', 'F1', 'C1'],
    hornNotes: ['F1', 'C1', 'Db1'],
    pierMotif: ['C4', 'Ab3', 'G3', 'F3', 'Db4', 'C4']
  },
  {
    id: 'neblina_no_calcadao',
    name: 'II. Neblina Sobre o Calçadão Deserto',
    title: 'II. Neblina Sobre o Calçadão Deserto',
    startSec: 120,
    endSec: 240,
    pad: { gain: 0.036, cutoff: 280, peak: 460 },
    subGain: 0.039,
    surfGain: 0.025,
    densities: { foam: 0.68, horn: 0.8, pier: 0.46, waltz: 0.38, creak: 0.38 },
    chords: [
      ['F2', 'Ab2', 'C3', 'Eb3', 'G3'],
      ['Db2', 'Ab2', 'C3', 'Eb3', 'F3'],
      ['Bb1', 'F2', 'Ab2', 'C3', 'Db3'],
      ['C2', 'G2', 'Bb2', 'Db3', 'E3']
    ],
    subNotes: ['F1', 'Db1', 'Bb0', 'C1'],
    hornNotes: ['F1', 'Db1', 'C1'],
    pierMotif: ['G3', 'Ab3', 'C4', 'Eb4', 'Db4', 'Bb3', 'E3', 'F3']
  },
  {
    id: 'ecos_da_roda_gigante',
    name: 'III. Ecos Fantasmas da Roda-Gigante',
    title: 'III. Ecos Fantasmas da Roda-Gigante',
    startSec: 240,
    endSec: 360,
    pad: { gain: 0.04, cutoff: 325, peak: 640 },
    subGain: 0.042,
    surfGain: 0.024,
    densities: { foam: 0.75, horn: 0.86, pier: 0.66, waltz: 0.48, creak: 0.62 },
    chords: [
      ['Bb1', 'F2', 'Ab2', 'C3', 'Db3'],
      ['C2', 'E2', 'Bb2', 'Db3', 'G3'],
      ['F2', 'C3', 'Eb3', 'G3', 'Ab3'],
      ['Db2', 'F2', 'Ab2', 'C3', 'Eb3']
    ],
    subNotes: ['Bb0', 'C1', 'F1', 'Db1'],
    hornNotes: ['Db1', 'C1', 'F1'],
    pierMotif: ['Eb4', 'C4', 'Db4', 'Ab3', 'Bb3', 'G3', 'E3', 'C4', 'F3']
  },
  {
    id: 'ressaca_do_farol',
    name: 'IV. Ressaca Atlântica & Farol Solitário',
    title: 'IV. Ressaca Atlântica & Farol Solitário',
    startSec: 360,
    endSec: 480,
    pad: { gain: 0.038, cutoff: 270, peak: 510 },
    subGain: 0.046,
    surfGain: 0.029,
    densities: { foam: 0.85, horn: 0.94, pier: 0.38, waltz: 0.0, creak: 0.45 },
    chords: [
      ['Db2', 'Ab2', 'C3', 'F3'],
      ['Bb1', 'F2', 'Ab2', 'C3', 'Db3'],
      ['C2', 'G2', 'Bb2', 'Db3', 'E3'],
      ['F2', 'Ab2', 'C3', 'Eb3', 'G3']
    ],
    subNotes: ['Db1', 'C1', 'F1', 'Bb0'],
    hornNotes: ['C1', 'F1', 'Db1'],
    pierMotif: ['Db4', 'C4', 'Ab3', 'G3', 'E3', 'F3']
  },
  {
    id: 'maresia_abissal',
    name: 'V. Maresia Abissal Antes da Alvorada Cinza',
    title: 'V. Maresia Abissal Antes da Alvorada Cinza',
    startSec: 480,
    endSec: 600,
    pad: { gain: 0.028, cutoff: 225, peak: 350 },
    subGain: 0.034,
    surfGain: 0.02,
    densities: { foam: 0.48, horn: 0.68, pier: 0.24, waltz: 0.0, creak: 0.22 },
    chords: [
      ['F2', 'C3', 'Eb3', 'Ab3'],
      ['Db2', 'Ab2', 'C3', 'Eb3'],
      ['Bb1', 'F2', 'Ab2', 'C3'],
      ['C2', 'G2', 'Bb2', 'Db3']
    ],
    subNotes: ['F1', 'Db1', 'C1', 'F1'],
    hornNotes: ['F1', 'Db1', 'C1'],
    pierMotif: ['C4', 'Ab3', 'G3', 'F3', 'Eb3']
  }
];

export const PRAIA_SUL_AMBIENCE = {
  id: 'praia_sul',
  title: 'Orla Marítima Sul — Ressaca Noturna & Píer Fantasma',
  durationSec: 600,
  baseGain: 0.85,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 2.5, rig, targetNode = null, startTime, contextState = null } = {}) {
    if (!rig) return 0;
    const baseTime = startTime ?? rig.ctx?.currentTime ?? 0;
    const { movement: mv, index: mvIdx, localProgress } = resolveMovementAt(MOVEMENTS, cursorSec, 600);
    const tideArc = Math.sin(localProgress * Math.PI);
    const fogBoost = contextState?.fogFactor ? clamp(contextState.fogFactor, 0, 0.2) : 0;
    let scheduled = 0;

    // 1. Maré / Ressaca Noturna (11.5s — 'brown' e 'pink' varrendo 110 Hz -> 340 Hz -> ~110 Hz)
    const surfTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 11.5, 0.4);
    if (surfTrig.hit) {
      const sIdx = surfTrig.stepIndex;
      playAtmosphericNoiseSwell(rig, {
        time: baseTime + surfTrig.delaySec, dest: targetNode, color: 'brown', filterType: 'bandpass',
        freqStart: 110, freqEnd: 340, q: 1.25, duration: 11.8, attack: 4.3,
        gain: clamp(mv.surfGain + tideArc * 0.005, 0.015, 0.036),
        pan: Math.sin(sIdx * 1.17) * 0.44, reverb: 0.68, delay: 0.16, seed: sIdx * 3.71 + mvIdx
      });
      scheduled++;
    }

    const foamTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 11.5, 6.15);
    if (foamTrig.hit && seededRand(foamTrig.stepIndex * 5.13 + mvIdx) < mv.densities.foam + fogBoost) {
      const fIdx = foamTrig.stepIndex;
      playAtmosphericNoiseSwell(rig, {
        time: baseTime + foamTrig.delaySec, dest: targetNode, color: 'pink', filterType: 'lowpass',
        freqStart: 110, freqEnd: 340, q: 0.95, duration: 10.4, attack: 3.9,
        gain: clamp(mv.surfGain * 0.68, 0.014, 0.024),
        pan: -Math.sin(fIdx * 1.31) * 0.48, reverb: 0.78, delay: 0.22, seed: fIdx * 7.19 + 13
      });
      scheduled++;
    }

    // 2. Pads Oceânicos Profundos (18s — progressão Fm9 -> Dbmaj7 -> Bbm9 -> C7b9)
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 18.0, 0.8);
    if (padTrig.hit) {
      const pIdx = padTrig.stepIndex;
      playDarkPadChord(rig, {
        time: baseTime + padTrig.delaySec, dest: targetNode, notes: pickMod(mv.chords, pIdx),
        duration: 19.2, attack: 5.2, release: 6.4,
        cutoff: clamp(mv.pad.cutoff + tideArc * 35, 200, 520),
        cutoffPeak: clamp(mv.pad.peak + tideArc * 45, 280, 700),
        detuneCents: 8.5, waveform: pIdx % 2 === 0 ? 'sawtooth' : 'triangle',
        gain: clamp(mv.pad.gain + tideArc * 0.004, 0.02, 0.046),
        pan: Math.sin(pIdx * 0.9) * 0.18, reverb: 0.82, delay: 0.24
      });
      scheduled++;
    }

    // 3. Sub-Drone Abissal do Atlântico (25s — F1 / Db1 / Bb0 / C1)
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 25.0, 0.15);
    if (subTrig.hit) {
      const dIdx = subTrig.stepIndex;
      playSubDrone(rig, {
        time: baseTime + subTrig.delaySec, dest: targetNode, note: pickMod(mv.subNotes, dIdx),
        glideToNote: dIdx % 3 === 1 ? pickMod(mv.subNotes, dIdx + 1) : undefined,
        fifth: mvIdx === 2 || mvIdx === 3, duration: 25.8, attack: 5.0, release: 6.2,
        cutoff: clamp(205 + mvIdx * 6, 200, 235), gain: clamp(mv.subGain, 0.026, 0.048), reverb: 0.34
      });
      scheduled++;
    }

    // 4. Caixa de Música / Carrossel Desafinado do Píer na Névoa (7.3s — 'glass' e 'felt')
    const pierTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 7.3, 2.6);
    if (pierTrig.hit && seededRand(pierTrig.stepIndex * 11.73 + mvIdx * 19.1) < mv.densities.pier) {
      const nIdx = pierTrig.stepIndex;
      const isGlass = (nIdx + mvIdx) % 3 !== 0;
      const noteTime = baseTime + pierTrig.delaySec;
      playNoirFeltNote(rig, {
        time: noteTime, dest: targetNode, note: pickMod(mv.pierMotif, nIdx),
        tone: isGlass ? 'glass' : 'felt', duration: isGlass ? 5.4 : 4.8,
        cutoff: isGlass ? clamp(520 + tideArc * 150, 420, 700) : clamp(390 + tideArc * 90, 320, 520),
        gain: clamp(0.015 + seededRand(nIdx * 2.9) * 0.008, 0.014, 0.024),
        pan: 0.22 + Math.sin(nIdx * 1.7) * 0.26, reverb: 0.9, delay: 0.62
      });
      scheduled++;

      if (mv.densities.waltz > 0 && seededRand(nIdx * 17.3 + 5) < mv.densities.waltz) {
        playNoirFeltNote(rig, {
          time: noteTime + 1.18, dest: targetNode, note: pickMod(mv.pierMotif, nIdx + 2),
          tone: 'felt', duration: 4.4, cutoff: 430, gain: 0.014,
          pan: -0.28, reverb: 0.92, delay: 0.68
        });
        scheduled++;
      }
    }

    // 5. Buzina de Nevoeiro Marítima / Farol (33s — F1 / C1 / Db1 com bendRatio: 0.97) + Cabos do Píer
    const hornTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 33.0, 5.5);
    if (hornTrig.hit && seededRand(hornTrig.stepIndex * 9.41 + mvIdx) < mv.densities.horn + fogBoost) {
      const hIdx = hornTrig.stepIndex;
      playBowedMetalOrHorn(rig, {
        time: baseTime + hornTrig.delaySec, dest: targetNode, note: pickMod(mv.hornNotes, hIdx),
        bendRatio: 0.97, duration: 10.2, attack: 3.1,
        cutoff: clamp(235 + tideArc * 85, 210, 355), q: 2.4,
        gain: clamp(0.021 + tideArc * 0.011, 0.018, 0.034),
        pan: -0.32 + Math.cos(hIdx * 1.4) * 0.24, reverb: 0.91, delay: 0.36
      });
      scheduled++;
    }

    const buoyTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 33.0, 21.8);
    if (buoyTrig.hit && seededRand(buoyTrig.stepIndex * 13.7 + mvIdx) < mv.densities.creak) {
      const bIdx = buoyTrig.stepIndex;
      playMetallicEchoPing(rig, {
        time: baseTime + buoyTrig.delaySec, dest: targetNode, note: pickMod(['F2', 'C3', 'Db2'], bIdx),
        ratios: [1.0, 1.51, 2.14], pitchDrop: 0.96, duration: 4.5, attack: 0.06,
        cutoff: 440, gain: 0.015, pan: 0.34 * Math.sin(bIdx * 2.1), reverb: 0.9, delay: 0.56
      });
      scheduled++;
    }

    return scheduled;
  }
};

export default PRAIA_SUL_AMBIENCE;
