/**
 * ParqueCentralAmbience.js
 * Trilha Dark Ambient de 10 minutos (600s) — Parque Central & Lago Nebuloso.
 *
 * Identidade Sonora: Haunted Nocturnal Botanical Park & Mist-Shrouded Lake
 * Modo Harmônico: A Aeolian / E Dorian Escuro (Am9 -> Fmaj7 -> Dm9 -> Em7b5 -> E7b9)
 * Regra de Ouro: Melancólico, orgânico, enevoado, misterioso e discreto
 * (gains 0.013..0.046, cutoffs 220..760 Hz, vento/água bandpass 220..520 Hz).
 */

import {
  checkPeriodicTrigger,
  playAtmosphericNoiseSwell,
  playBowedMetalOrHorn,
  playDarkPadChord,
  playNoirFeltNote,
  playSubDrone,
  resolveMovementAt,
  seededRand
} from '../AmbienceSynthPrimitives.js';

const clampGain = (v) => Math.max(0.013, Math.min(0.046, v));
const clampCutoff = (v) => Math.max(220, Math.min(760, v));
const clampLakeFreq = (v) => Math.max(220, Math.min(520, v));

const PARQUE_MOVEMENTS = [
  {
    id: 'alameda_cerracao',
    name: 'I. Alameda dos Salgueiros na Cerração',
    startSec: 0,
    endSec: 120,
    gains: { pad: 0.032, sub: 0.034, wind: 0.016, cello: 0.021 },
    probs: { cello: 0.72, drop: 0.66, echo: 0.28 },
    padCutoff: [260, 450],
    windBand: [228, 372],
    chords: [['A2', 'C3', 'E3', 'B3'], ['F2', 'A2', 'C3', 'E3'], ['D2', 'F2', 'A2', 'E3'], ['E2', 'G2', 'Bb2', 'D3'], ['E2', 'G#2', 'D3', 'F3']],
    subRoots: ['A1', 'F1', 'D1', 'E1', 'E1'],
    celloOrder: ['A1', 'E2', 'F1', 'D2'],
    feltNotes: ['E4', 'B3', 'C4', 'A3', 'F3', 'D4'],
    nylonNotes: ['B3', 'E3', 'A3', 'C4', 'F3']
  },
  {
    id: 'espelho_grande_lago',
    name: 'II. Espelho Escuro do Grande Lago',
    startSec: 120,
    endSec: 240,
    gains: { pad: 0.035, sub: 0.036, wind: 0.019, cello: 0.024 },
    probs: { cello: 0.82, drop: 0.78, echo: 0.52 },
    padCutoff: [285, 520],
    windBand: [248, 458],
    chords: [['F2', 'C3', 'E3', 'A3'], ['D2', 'A2', 'C3', 'E3'], ['A2', 'E3', 'G3', 'B3'], ['G2', 'C3', 'E3', 'B3'], ['E2', 'G#2', 'B2', 'F3']],
    subRoots: ['F1', 'D1', 'A1', 'G1', 'E1'],
    celloOrder: ['D2', 'A1', 'F1', 'E2'],
    feltNotes: ['C4', 'E4', 'B3', 'A3', 'F4', 'D4', 'G#3'],
    nylonNotes: ['E4', 'A3', 'B3', 'D4', 'C4', 'G3']
  },
  {
    id: 'estufa_bruma_dorica',
    name: 'III. Estufa Abandonada & Bruma Dórica',
    startSec: 240,
    endSec: 360,
    gains: { pad: 0.038, sub: 0.039, wind: 0.021, cello: 0.027 },
    probs: { cello: 0.88, drop: 0.74, echo: 0.46 },
    padCutoff: [310, 610],
    windBand: [265, 512],
    chords: [['E2', 'G2', 'B2', 'F#3'], ['F#2', 'A2', 'C3', 'E3'], ['A2', 'C3', 'E3', 'B3'], ['E2', 'G2', 'Bb2', 'D3'], ['E2', 'G#2', 'D3', 'F3']],
    subRoots: ['E1', 'F#1', 'A1', 'G1', 'E1'],
    celloOrder: ['E2', 'A1', 'D2', 'F1'],
    feltNotes: ['F#3', 'B3', 'E4', 'C4', 'A3', 'Bb3', 'G#3'],
    nylonNotes: ['B3', 'F#3', 'D4', 'A3', 'E3', 'F3']
  },
  {
    id: 'pontes_lamento_submerso',
    name: 'IV. Pontes de Pedra & Lamento Submerso',
    startSec: 360,
    endSec: 480,
    gains: { pad: 0.041, sub: 0.042, wind: 0.020, cello: 0.029 },
    probs: { cello: 0.92, drop: 0.80, echo: 0.48 },
    padCutoff: [295, 665],
    windBand: [242, 488],
    chords: [['D2', 'F2', 'C3', 'E3'], ['E2', 'Bb2', 'D3', 'G3'], ['E2', 'G#2', 'D3', 'F3'], ['A1', 'E2', 'B2', 'C3'], ['F2', 'A2', 'E3', 'G3']],
    subRoots: ['D1', 'E1', 'E1', 'A1', 'F1'],
    celloOrder: ['F1', 'D2', 'A1', 'E2'],
    feltNotes: ['D4', 'F4', 'E4', 'B3', 'Bb3', 'A3', 'G#3'],
    nylonNotes: ['A3', 'D4', 'C4', 'F3', 'E3', 'B3']
  },
  {
    id: 'orvalho_antes_alvorada',
    name: 'V. Orvalho Frio Antes da Alvorada',
    startSec: 480,
    endSec: 600,
    gains: { pad: 0.030, sub: 0.031, wind: 0.015, cello: 0.019 },
    probs: { cello: 0.65, drop: 0.56, echo: 0.25 },
    padCutoff: [240, 420],
    windBand: [222, 348],
    chords: [['A2', 'C3', 'E3', 'B3'], ['D2', 'F2', 'A2', 'C3'], ['F2', 'A2', 'C3', 'E3'], ['E2', 'G2', 'Bb2', 'D3'], ['A1', 'E2', 'A2', 'B2']],
    subRoots: ['A1', 'D1', 'F1', 'E1', 'A1'],
    celloOrder: ['F1', 'D2', 'E2', 'A1'],
    feltNotes: ['C4', 'A3', 'E3', 'B3', 'E4'],
    nylonNotes: ['A3', 'E3', 'B3', 'C4']
  }
];

export const PARQUE_CENTRAL_AMBIENCE = {
  id: 'parque_central',
  title: 'Parque Central — Bosque Noturno & Lago Nebuloso',
  durationSec: 600,
  baseGain: 0.84,
  movements: PARQUE_MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 0.25, rig, targetNode, startTime = 0, contextState = null }) {
    if (!rig || !(windowDurSec > 0)) return 0;

    const { movement: mv, localProgress } = resolveMovementAt(PARQUE_MOVEMENTS, cursorSec, 600);
    if (!mv) return 0;

    const archCurve = Math.sin(Math.PI * Math.max(0.05, Math.min(0.95, localProgress)));
    const nightBoost = contextState?.isNight ? 1.05 : 1.0;
    let scheduled = 0;

    // 1. Pads escuros de fita analógica (período coprimo 16s)
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 16.0, 0.0);
    if (padTrig.hit) {
      const chord = mv.chords[Math.abs(padTrig.stepIndex) % mv.chords.length];
      const drift = seededRand(padTrig.stepIndex * 1.37 + 7.1);
      playDarkPadChord(rig, {
        time: startTime + padTrig.delaySec, dest: targetNode, notes: chord, waveform: 'triangle',
        duration: 15.6, attack: 4.3, release: 5.2,
        cutoff: clampCutoff(mv.padCutoff[0] + drift * 45),
        cutoffPeak: clampCutoff(mv.padCutoff[1] + archCurve * 65),
        detuneCents: 5.8 + drift * 2.8, q: 0.78,
        gain: clampGain(mv.gains.pad * (0.92 + archCurve * 0.12) * nightBoost),
        pan: (drift - 0.5) * 0.24, reverb: 0.82, delay: 0.22
      });
      scheduled++;
    }

    // 2. Sub-grave quente sob a névoa do lago (período coprimo 21s)
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 21.0, 1.8);
    if (subTrig.hit) {
      const idx = Math.abs(subTrig.stepIndex) % mv.subRoots.length;
      const nextNote = mv.subRoots[(idx + 1) % mv.subRoots.length];
      playSubDrone(rig, {
        time: startTime + subTrig.delaySec, dest: targetNode, note: mv.subRoots[idx],
        glideToNote: seededRand(subTrig.stepIndex * 2.11 + 3.4) > 0.55 ? nextNote : undefined,
        fifth: mv.id === 'estufa_bruma_dorica',
        duration: 19.8, attack: 4.4, release: 5.4, cutoff: 220,
        gain: clampGain(mv.gains.sub * (0.94 + archCurve * 0.08)), reverb: 0.32
      });
      scheduled++;
    }

    // 3. Vento noturno nas copas e ondulação do Grande Lago (período coprimo 8.5s)
    const windTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 8.5, 0.6);
    if (windTrig.hit) {
      const r = seededRand(windTrig.stepIndex * 1.93 + 19.7);
      const isWaterLap = windTrig.stepIndex % 2 === 1;
      const fStart = clampLakeFreq(mv.windBand[0] + r * 55);
      const fEnd = clampLakeFreq(mv.windBand[1] - (1 - r) * 48);
      playAtmosphericNoiseSwell(rig, {
        time: startTime + windTrig.delaySec, dest: targetNode, color: 'pink', filterType: 'bandpass',
        freqStart: isWaterLap ? fEnd : fStart, freqEnd: isWaterLap ? fStart : fEnd,
        q: isWaterLap ? 1.85 : 1.32, duration: 8.3, attack: 2.9,
        gain: clampGain(mv.gains.wind * (0.88 + archCurve * 0.18)),
        pan: (isWaterLap ? 1 : -1) * (0.18 + r * 0.24),
        reverb: 0.66, delay: 0.15, seed: windTrig.stepIndex * 3.17 + 5.2
      });
      scheduled++;
    }

    // 4. Gotas melancólicas espaçadas de piano feltro e harpa/nylon (período coprimo 5.7s)
    const dropTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 5.7, 2.4);
    if (dropTrig.hit) {
      const gate = seededRand(dropTrig.stepIndex * 2.73 + 31.9);
      if (gate <= mv.probs.drop) {
        const useNylon = seededRand(dropTrig.stepIndex * 4.07 + 13.1) < 0.44;
        const pool = useNylon ? mv.nylonNotes : mv.feltNotes;
        const note = pool[(Math.abs(dropTrig.stepIndex) + Math.floor(gate * 7)) % pool.length];
        playNoirFeltNote(rig, {
          time: startTime + dropTrig.delaySec, dest: targetNode, note,
          tone: useNylon ? 'nylon' : 'felt', duration: useNylon ? 4.2 : 4.9,
          cutoff: clampCutoff((useNylon ? 520 : 410) + archCurve * 150),
          gain: clampGain((useNylon ? 0.017 : 0.021) + archCurve * 0.004),
          pan: (seededRand(dropTrig.stepIndex * 5.13) - 0.5) * 0.68, reverb: 0.84, delay: 0.45
        });
        scheduled++;
      }
    }

    // Reflexo esparso de harpa/nylon no espelho d'água (fase defasada de 5.7s)
    const rippleTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 5.7, 4.35);
    if (rippleTrig.hit && seededRand(rippleTrig.stepIndex * 3.61 + 71.3) <= mv.probs.echo) {
      const note = mv.nylonNotes[Math.abs(rippleTrig.stepIndex * 2 + 1) % mv.nylonNotes.length];
      playNoirFeltNote(rig, {
        time: startTime + rippleTrig.delaySec, dest: targetNode, note, tone: 'nylon',
        duration: 3.7, cutoff: clampCutoff(360 + archCurve * 140),
        gain: clampGain(0.014 + archCurve * 0.003),
        pan: (seededRand(rippleTrig.stepIndex * 6.29) - 0.5) * 0.76, reverb: 0.88, delay: 0.52
      });
      scheduled++;
    }

    // 5. Cordas escuras / violoncelo lamentoso em A1, E2, F1, D2 (período coprimo 29s)
    const celloTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 29.0, 6.5);
    if (celloTrig.hit && seededRand(celloTrig.stepIndex * 1.61 + 43.7) <= mv.probs.cello) {
      const celloNote = mv.celloOrder[Math.abs(celloTrig.stepIndex) % mv.celloOrder.length];
      const sigh = seededRand(celloTrig.stepIndex * 2.89 + 9.4);
      playBowedMetalOrHorn(rig, {
        time: startTime + celloTrig.delaySec, dest: targetNode, note: celloNote,
        bendRatio: 0.986 + sigh * 0.009, duration: 10.6 + sigh * 1.8, attack: 3.3,
        filterType: 'lowpass', q: 1.95, cutoff: clampCutoff(280 + archCurve * 185),
        gain: clampGain(mv.gains.cello * (0.9 + archCurve * 0.14) * nightBoost),
        pan: (sigh - 0.5) * 0.44, reverb: 0.88, delay: 0.28
      });
      scheduled++;
    }

    return scheduled;
  }
};

export default PARQUE_CENTRAL_AMBIENCE;
