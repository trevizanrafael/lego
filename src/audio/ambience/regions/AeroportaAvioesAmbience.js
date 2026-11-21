/**
 * AeroportaAvioesAmbience.js
 * Trilha Dark Ambient Generativa de 10 Minutos (600s) — Aeroporta-Aviões no Céu (Y = 410m).
 *
 * Identidade Sonora:
 * - "Stratospheric Helicarrier Command Deck Above the Storm" (estilo Oblivion / Mass Effect Normandy /
 *   Winter Soldier Helicarrier): F#m9 / Dmaj7#11 -> Bm9 -> C#7sus4.
 * - Grandioso porém contido, frio, suspenso acima das nuvens de tempestade de Gotham e de volume
 *   estritamente ambiente (gains 0.014..0.048, filtros 210..790 Hz).
 */

import {
  checkPeriodicTrigger,
  playAtmosphericNoiseSwell,
  playBowedMetalOrHorn,
  playDarkPadChord,
  playMetallicEchoPing,
  playNoirFeltNote,
  playSubDrone,
  resolveMovementAt,
  seededRand
} from '../AmbienceSynthPrimitives.js';

const DURATION_SEC = 600;

const MOVEMENTS = [
  {
    index: 0, id: 'estabilizacao_estratosferica', title: 'I. Estabilização Estratosférica (Y = 410m)',
    startSec: 0, endSec: 120, padGain: 0.028, padCutoff: 255, padPeak: 410, padDur: 16.8,
    droneGain: 0.036, droneCutoff: 215, windGain: 0.019, telemetryDensity: 0.24, telemetryGain: 0.015, hullMode: 'sonar'
  },
  {
    index: 1, id: 'ponte_de_comando_cic', title: 'II. Ponte de Comando & Telemetria Orbital',
    startSec: 120, endSec: 240, padGain: 0.034, padCutoff: 300, padPeak: 540, padDur: 18.0,
    droneGain: 0.040, droneCutoff: 222, windGain: 0.021, telemetryDensity: 0.36, telemetryGain: 0.018, hullMode: 'mixed'
  },
  {
    index: 2, id: 'deriva_sobre_tempestade', title: 'III. Deriva Imponente Sobre a Tempestade',
    startSec: 240, endSec: 360, padGain: 0.042, padCutoff: 355, padPeak: 745, padDur: 19.6,
    droneGain: 0.046, droneCutoff: 236, windGain: 0.025, telemetryDensity: 0.45, telemetryGain: 0.021, hullMode: 'brass'
  },
  {
    index: 3, id: 'vigilia_orbital_noturna', title: 'IV. Vigília Noturna & Casco Pressurizado',
    startSec: 360, endSec: 480, padGain: 0.033, padCutoff: 245, padPeak: 475, padDur: 18.4,
    droneGain: 0.042, droneCutoff: 218, windGain: 0.022, telemetryDensity: 0.30, telemetryGain: 0.017, hullMode: 'mixed'
  },
  {
    index: 4, id: 'horizonte_frio_retorno', title: 'V. Horizonte Frio & Suspensão Cíclica',
    startSec: 480, endSec: 600, padGain: 0.025, padCutoff: 220, padPeak: 385, padDur: 20.0,
    droneGain: 0.034, droneCutoff: 210, windGain: 0.017, telemetryDensity: 0.20, telemetryGain: 0.014, hullMode: 'sonar'
  }
];

// Progressão central: F#m9 -> Dmaj7#11 -> Bm9 -> C#7sus4
const COMMAND_DECK_CHORDS = [
  { root: 'F#1', notes: ['F#2', 'A2', 'C#3', 'E3', 'G#3'] },
  { root: 'D1', notes: ['D2', 'A2', 'C#3', 'F#3', 'G#3'] },
  { root: 'B0', notes: ['B1', 'F#2', 'A2', 'C#3', 'D3'] },
  { root: 'C#1', notes: ['C#2', 'F#2', 'G#2', 'B2', 'E3'] }
];

const TURBINE_ROOTS = ['F#1', 'D1', 'B0', 'C#1'];
const TELEMETRY_NOTES_HIGH = ['F#4', 'G#4', 'C#4', 'E4', 'A4', 'B3', 'C#5'];
const TELEMETRY_NOTES_LOW = ['F#3', 'G#3', 'A3', 'C#4', 'E4', 'B3'];
const clampRange = (val, min, max) => Math.max(min, Math.min(max, val));

export const AEROPORTA_AVIOES_AMBIENCE = {
  id: 'aeroporta_avioes',
  title: 'Aeroporta-Aviões: Convés Estratosférico (Y=410m)',
  durationSec: DURATION_SEC,
  baseGain: 0.85,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 0.25, rig, targetNode, startTime, contextState }) {
    if (!rig?.ctx || !(windowDurSec > 0)) return 0;

    const baseTime = startTime ?? (rig.ctx.currentTime || 0);
    const nightShade = contextState?.isNight ? 0.92 : 1.0;
    let scheduled = 0;

    // 1. As 4 Turbinas Rotoras Gigantes (10.8s) — Sub-drone contínuo com quinta justa
    const rotorTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 10.8, 0.0);
    if (rotorTrig.hit) {
      const { movement: mv, index: mvIdx } = resolveMovementAt(MOVEMENTS, cursorSec + rotorTrig.delaySec, DURATION_SEC);
      const step = Math.abs(rotorTrig.stepIndex);
      const chordIdx = mvIdx === 0 || mvIdx === 4 ? step % 2 : step % TURBINE_ROOTS.length;
      const note = TURBINE_ROOTS[chordIdx];
      const nextNote = TURBINE_ROOTS[(chordIdx + 1) % TURBINE_ROOTS.length];

      playSubDrone(rig, {
        time: baseTime + rotorTrig.delaySec,
        dest: targetNode,
        note,
        glideToNote: step % 3 === 2 ? nextNote : undefined,
        fifth: true,
        duration: 12.8,
        attack: 3.6,
        release: 4.4,
        gain: clampRange(mv.droneGain, 0.014, 0.048),
        cutoff: clampRange(mv.droneCutoff, 210, 240),
        reverb: 0.34
      });
      scheduled++;
    }

    // 2. Pads Espaciais da Ponte de Comando (18.5s) — F#m9 / Dmaj7#11 -> Bm9 -> C#7sus4 (16s..20s)
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 18.5, 0.4);
    if (padTrig.hit) {
      const { movement: mv, index: mvIdx, localProgress } = resolveMovementAt(
        MOVEMENTS,
        cursorSec + padTrig.delaySec,
        DURATION_SEC
      );
      const step = Math.abs(padTrig.stepIndex);
      const progIdx = mvIdx === 0 ? step % 2 : (step + mvIdx) % COMMAND_DECK_CHORDS.length;
      const chord = COMMAND_DECK_CHORDS[progIdx];
      const notes = mvIdx === 0 || mvIdx === 4 ? chord.notes.slice(0, 4) : chord.notes;
      const arcFade = mvIdx === 4 ? 1.0 - localProgress * 0.16 : 1.0;

      playDarkPadChord(rig, {
        time: baseTime + padTrig.delaySec,
        dest: targetNode,
        notes,
        duration: clampRange(mv.padDur, 16.0, 20.0),
        attack: 4.6,
        release: 5.8,
        cutoff: clampRange(mv.padCutoff * nightShade, 210, 790),
        cutoffPeak: clampRange(mv.padPeak * nightShade, 260, 790),
        detuneCents: mvIdx === 3 ? 9.2 : 6.8,
        gain: clampRange(mv.padGain * arcFade, 0.014, 0.048),
        waveform: 'sawtooth',
        pan: (seededRand(step * 1.73 + 5.1) * 2 - 1) * 0.28,
        reverb: 0.82,
        delay: 0.24
      });
      scheduled++;
    }

    // 3. Correntes de Ar Estratosféricas Geladas a 410m (25.5s) — Pink noise 320->580 Hz, pan amplo
    const windTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 25.5, 2.2);
    if (windTrig.hit) {
      const { movement: mv } = resolveMovementAt(MOVEMENTS, cursorSec + windTrig.delaySec, DURATION_SEC);
      const step = Math.abs(windTrig.stepIndex);
      const widePan = (step % 2 === 0 ? 1 : -1) * (0.64 + seededRand(step * 2.31 + 9.7) * 0.22);

      playAtmosphericNoiseSwell(rig, {
        time: baseTime + windTrig.delaySec,
        dest: targetNode,
        color: 'pink',
        filterType: 'bandpass',
        q: 1.25,
        freqStart: 320,
        freqEnd: 580,
        duration: 16.5,
        attack: 4.8,
        gain: clampRange(mv.windGain, 0.014, 0.048),
        pan: widePan,
        reverb: 0.68,
        delay: 0.16,
        seed: step * 3.17 + 41.0
      });
      scheduled++;
    }

    // 4. Telemetria Orbital Esparsa (7.4s) — Sinais sutis 'glass' e 'rhodes' no CIC
    const telTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 7.4, 3.6);
    if (telTrig.hit) {
      const { movement: mv, index: mvIdx } = resolveMovementAt(MOVEMENTS, cursorSec + telTrig.delaySec, DURATION_SEC);
      const step = Math.abs(telTrig.stepIndex);

      if (seededRand(step * 4.09 + mvIdx * 13.7) < mv.telemetryDensity) {
        const isGlass = seededRand(step * 6.13 + 2.9) > 0.44;
        const pool = mvIdx >= 3 ? TELEMETRY_NOTES_LOW : TELEMETRY_NOTES_HIGH;
        const note = pool[Math.floor(seededRand(step * 8.71 + 1.3) * pool.length)];

        playNoirFeltNote(rig, {
          time: baseTime + telTrig.delaySec,
          dest: targetNode,
          note,
          tone: isGlass ? 'glass' : 'rhodes',
          duration: isGlass ? 4.8 : 5.4,
          gain: clampRange(mv.telemetryGain, 0.014, 0.048),
          cutoff: clampRange((isGlass ? 690 : 510) * nightShade, 210, 790),
          pan: (seededRand(step * 5.41 + 17.2) * 2 - 1) * 0.66,
          reverb: 0.84,
          delay: 0.48
        });
        scheduled++;
      }
    }

    // 5. Ressonância Estrutural do Casco / Sonar Orbital (32s)
    const hullTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 32.0, 9.0);
    if (hullTrig.hit) {
      const { movement: mv } = resolveMovementAt(MOVEMENTS, cursorSec + hullTrig.delaySec, DURATION_SEC);
      const step = Math.abs(hullTrig.stepIndex);
      const useBrass = mv.hullMode === 'brass' || (mv.hullMode === 'mixed' && step % 2 === 1);

      if (useBrass) {
        const brassNotes = ['F#1', 'D1', 'B1', 'C#2'];
        playBowedMetalOrHorn(rig, {
          time: baseTime + hullTrig.delaySec,
          dest: targetNode,
          note: brassNotes[step % brassNotes.length],
          bendRatio: 0.992,
          duration: 10.5,
          attack: 3.4,
          gain: 0.022,
          cutoff: clampRange(430 * nightShade, 210, 790),
          pan: (step % 2 === 0 ? -1 : 1) * 0.35,
          reverb: 0.88,
          delay: 0.30
        });
      } else {
        const pingNotes = ['F#3', 'C#3', 'D3', 'A3'];
        playMetallicEchoPing(rig, {
          time: baseTime + hullTrig.delaySec,
          dest: targetNode,
          note: pingNotes[step % pingNotes.length],
          ratios: [1.0, 1.5, 2.01],
          duration: 4.2,
          attack: 0.04,
          gain: 0.015,
          cutoff: clampRange(580 * nightShade, 210, 790),
          pan: (step % 2 === 0 ? 1 : -1) * 0.48,
          reverb: 0.88,
          delay: 0.54
        });
      }
      scheduled++;
    }

    return scheduled;
  }
};

export default AEROPORTA_AVIOES_AMBIENCE;
