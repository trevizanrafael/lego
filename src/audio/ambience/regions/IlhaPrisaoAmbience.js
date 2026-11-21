/**
 * IlhaPrisaoAmbience.js
 * Trilha Dark Ambient Generativa de 10 Minutos (600s) — Ilha da Prisão de Segurança Máxima ("A Balsa").
 *
 * Identidade Sonora:
 * - Arkham Asylum / Shutter Island / Panopticon Penitentiary Dread.
 * - Campo harmônico: B Locrian / C Phrygian Escuro (Cm(maj7) -> Db -> Bbm(b5) -> Gb/B),
 *   explorando segundas menores (B–C, C–Db) e trítonos opressivos (B–F, C–Gb, Bb–E).
 * - Acústica gelada, punitiva, claustrofóbica e estritamente ambiente (gain 0.014..0.050, cutoff 170..620 Hz).
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

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

// Progressão central Cm(maj7) -> Db -> Bbm(b5) -> Gb/B + clusters B Locrian / C Phrygian
const PRISON_CHORD_BANK = [
  ['C2', 'G2', 'B2', 'Eb3'],   // Cm(maj7) — tensão sombria de Arkham
  ['Db2', 'Ab2', 'C3', 'F3'],  // Db(maj7) — grau bII frígio gelado
  ['Bb1', 'E2', 'Ab2', 'Db3'], // Bbm(b5)  — meio-diminuto (E2 = Fb2, trítono sombrio)
  ['B1', 'Gb2', 'Bb2', 'Db3'], // Gb/B     — choque de 2ª menor/7ª maior sobre baixo B
  ['B1', 'F2', 'A2', 'C3'],    // Bm7(b5)add(b9) — centro B Locrian claustrofóbico
  ['C2', 'Db2', 'G2', 'B2']    // Cluster C Phrygian / maj7 de corredor penitenciário
];

const BOWED_DREAD_NOTES = ['C1', 'Db1', 'F#1', 'B0'];
const ISOLATION_FELT_NOTES = ['C3', 'Db3', 'B2', 'Gb2', 'F2', 'Eb3'];
const GATE_METALLIC_RATIOS = [1.0, 1.37, 1.93];

const MOVEMENTS = [
  {
    id: 'muralha_ponte_blindada',
    title: 'I. Muralha de 126m & Ponte Blindada',
    startSec: 0, endSec: 120,
    chordOrder: [0, 1, 0, 3], subNotes: ['C1', 'Db1', 'C1', 'B0'],
    padGain: 0.028, padCutoff: 245, subGain: 0.038, windGain: 0.022,
    windBand: [185, 340], gateHzRange: [140, 215], lockdownEcho: false, feltDensity: 0.0
  },
  {
    id: 'panoptico_seis_pavilhoes',
    title: 'II. Vigilância Panóptica — Os 6 Pavilhões',
    startSec: 120, endSec: 240,
    chordOrder: [0, 1, 2, 3], subNotes: ['C1', 'Db1', 'Bb0', 'B0'],
    padGain: 0.033, padCutoff: 305, subGain: 0.041, windGain: 0.020,
    windBand: [195, 385], gateHzRange: [152, 278], lockdownEcho: true, feltDensity: 0.58
  },
  {
    id: 'solitaria_fosso_abissal',
    title: 'III. Solitária Subterrânea & Fosso Oceânico',
    startSec: 240, endSec: 360,
    chordOrder: [4, 5, 2, 3], subNotes: ['B0', 'C1', 'Gb1', 'B0'],
    padGain: 0.026, padCutoff: 205, subGain: 0.045, windGain: 0.018,
    windBand: [175, 285], gateHzRange: [135, 196], lockdownEcho: false, feltDensity: 0.25
  },
  {
    id: 'protocolo_contencao_maxima',
    title: 'IV. Protocolo de Contenção Máxima',
    startSec: 360, endSec: 480,
    chordOrder: [0, 1, 2, 3, 4, 3], subNotes: ['C1', 'Db1', 'F#1', 'B0'],
    padGain: 0.039, padCutoff: 365, subGain: 0.047, windGain: 0.027,
    windBand: [215, 455], gateHzRange: [165, 310], lockdownEcho: true, feltDensity: 0.48
  },
  {
    id: 'sentenca_perpetua_mare_negra',
    title: 'V. Sentença Perpétua & Maré Negra',
    startSec: 480, endSec: 600,
    chordOrder: [3, 2, 1, 0], subNotes: ['B0', 'Db1', 'C1', 'C1'],
    padGain: 0.029, padCutoff: 255, subGain: 0.039, windGain: 0.023,
    windBand: [180, 330], gateHzRange: [138, 228], lockdownEcho: false, feltDensity: 0.42
  }
];

export const ILHA_PRISAO_AMBIENCE = {
  id: 'ilha_prisao',
  title: 'A Balsa — Panóptico de Segurança Máxima',
  durationSec: 600,
  baseGain: 0.86,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 2.0, rig, targetNode, startTime = 0, contextState } = {}) {
    if (!rig?.ctx) return 0;

    const { movement, index: mvIdx, localProgress } = resolveMovementAt(MOVEMENTS, cursorSec, 600);
    const mv = movement || MOVEMENTS[0];
    const nightShade = Number.isFinite(contextState?.nightFactor) ? contextState.nightFactor : 0.6;
    const swellArc = Math.sin(localProgress * Math.PI);
    let scheduled = 0;

    // 1. Pad Claustrofóbico (período coprimo 17.5s): Cm(maj7) -> Db -> Bbm(b5) -> Gb/B
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 17.5, 0.4);
    if (padTrig.hit) {
      const chordIdx = mv.chordOrder[Math.abs(padTrig.stepIndex) % mv.chordOrder.length];
      const baseCut = clamp(mv.padCutoff + swellArc * 48 - nightShade * 14, 175, 440);
      playDarkPadChord(rig, {
        notes: PRISON_CHORD_BANK[chordIdx],
        time: startTime + padTrig.delaySec,
        duration: 18.2, attack: 4.4, release: 5.4,
        cutoff: baseCut, cutoffPeak: clamp(baseCut * 1.32, 220, 590),
        detuneCents: mvIdx === 3 ? 10.5 : 7.8, q: 1.05,
        gain: clamp(mv.padGain + swellArc * 0.004, 0.018, 0.045),
        pan: (seededRand(padTrig.stepIndex * 1.91 + mvIdx) - 0.5) * 0.28,
        reverb: 0.86, delay: 0.24,
        waveform: mvIdx === 2 ? 'triangle' : 'sawtooth',
        dest: targetNode
      });
      scheduled++;
    }

    // 2. Sub-Drone Abissal sob a Rocha da Ilha (período coprimo 24s)
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 24.0, 0.0);
    if (subTrig.hit) {
      const sIdx = Math.abs(subTrig.stepIndex) % mv.subNotes.length;
      const nextNote = mv.subNotes[(sIdx + 1) % mv.subNotes.length];
      playSubDrone(rig, {
        note: mv.subNotes[sIdx],
        glideToNote: seededRand(subTrig.stepIndex * 2.37) > 0.55 ? nextNote : undefined,
        time: startTime + subTrig.delaySec,
        duration: 24.6, attack: 4.2, release: 5.2,
        cutoff: clamp(175 + mvIdx * 8, 170, 215),
        gain: clamp(mv.subGain, 0.028, 0.049),
        fifth: mvIdx === 3, reverb: 0.34,
        dest: targetNode
      });
      scheduled++;
    }

    // 3. Vento Oceânico Gelado nos Muros de Concreto de 126m (período coprimo 11.2s)
    const windTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 11.2, 1.8);
    if (windTrig.hit) {
      const rWind = seededRand(windTrig.stepIndex * 4.13 + mvIdx * 7);
      const [fLo, fHi] = mv.windBand;
      playAtmosphericNoiseSwell(rig, {
        color: mvIdx === 2 || rWind < 0.65 ? 'brown' : 'pink',
        filterType: 'bandpass', q: mvIdx === 2 ? 2.1 : 1.55,
        freqStart: clamp(fLo + rWind * 35, 170, 520),
        freqEnd: clamp(fHi + swellArc * 45, 210, 595),
        time: startTime + windTrig.delaySec,
        duration: 11.6, attack: 3.4,
        gain: clamp(mv.windGain + swellArc * 0.003, 0.015, 0.032),
        pan: (rWind - 0.5) * 0.62, reverb: 0.78, delay: 0.16,
        seed: windTrig.stepIndex * 1.7 + 3.1,
        dest: targetNode
      });
      scheduled++;
    }

    // 4. Portões de Ferro, Grades de Celas e Correntes nos 6 Pavilhões (período coprimo 7.7s)
    const gateTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 7.7, 3.1);
    if (gateTrig.hit) {
      const rGate = seededRand(gateTrig.stepIndex * 5.77 + 19.4);
      const [hzMin, hzMax] = mv.gateHzRange;
      const pavilionPan = ((Math.abs(gateTrig.stepIndex) % 6) / 2.5 - 1.0) * 0.72;
      playMetallicEchoPing(rig, {
        note: clamp(hzMin + rGate * (hzMax - hzMin), 135, 310),
        ratios: GATE_METALLIC_RATIOS,
        time: startTime + gateTrig.delaySec,
        duration: 3.8 + rGate * 1.6, attack: 0.022,
        cutoff: clamp(350 + rGate * 210, 260, 580),
        pitchDrop: rGate > 0.6 ? 0.965 : undefined,
        gain: clamp(0.015 + rGate * 0.009, 0.014, 0.026),
        pan: pavilionPan, reverb: 0.92, delay: 0.55,
        dest: targetNode
      });
      scheduled++;
    }

    // Eco secundário de tranca/corrente em pavilhão oposto durante vigilância/contenção (7.7s defasado)
    if (mv.lockdownEcho) {
      const chainTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 7.7, 6.35);
      if (chainTrig.hit && seededRand(chainTrig.stepIndex * 8.19 + mvIdx) > 0.48) {
        const rChain = seededRand(chainTrig.stepIndex * 3.33 + 5.2);
        playMetallicEchoPing(rig, {
          note: clamp(148 + rChain * 145, 135, 310),
          ratios: GATE_METALLIC_RATIOS,
          time: startTime + chainTrig.delaySec,
          duration: 3.2, cutoff: clamp(320 + rChain * 180, 240, 540),
          gain: 0.015, pan: (0.5 - rChain) * 1.3,
          reverb: 0.92, delay: 0.55,
          dest: targetNode
        });
        scheduled++;
      }
    }

    // 5. Cordas/Metais Friccionados de Terror Psicológico (período coprimo 34s)
    const bowTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 34.0, 8.5);
    if (bowTrig.hit) {
      const rBow = seededRand(bowTrig.stepIndex * 6.41 + mvIdx);
      const bowNote = BOWED_DREAD_NOTES[Math.abs(bowTrig.stepIndex + mvIdx) % BOWED_DREAD_NOTES.length];
      playBowedMetalOrHorn(rig, {
        note: bowNote, bendRatio: 0.96,
        time: startTime + bowTrig.delaySec,
        duration: 11.5 + rBow * 2.8, attack: 3.3,
        cutoff: clamp(235 + mvIdx * 32 + rBow * 55, 195, 435), q: 2.8,
        gain: clamp(0.021 + swellArc * 0.011, 0.018, 0.035),
        pan: (rBow - 0.5) * 0.5, reverb: 0.9, delay: 0.34,
        dest: targetNode
      });
      scheduled++;
    }

    // Nota solitária abafada estilo Shutter Island nos movimentos psicológicos (24s defasado)
    if (mv.feltDensity > 0) {
      const feltTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 24.0, 13.6);
      if (feltTrig.hit && seededRand(feltTrig.stepIndex * 9.07 + mvIdx) < mv.feltDensity) {
        const note = ISOLATION_FELT_NOTES[Math.abs(feltTrig.stepIndex) % ISOLATION_FELT_NOTES.length];
        playNoirFeltNote(rig, {
          note, tone: 'felt',
          time: startTime + feltTrig.delaySec,
          duration: 5.8, cutoff: clamp(340 + swellArc * 90, 260, 470),
          gain: 0.016, pan: (seededRand(feltTrig.stepIndex * 2.71) - 0.5) * 0.45,
          reverb: 0.89, delay: 0.46,
          dest: targetNode
        });
        scheduled++;
      }
    }

    return scheduled;
  }
};

export default ILHA_PRISAO_AMBIENCE;
