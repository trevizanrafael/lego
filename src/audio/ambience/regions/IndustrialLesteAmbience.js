/**
 * IndustrialLesteAmbience.js
 * Trilha Dark Ambient Procedural de 10 Minutos (600s) — Distrito Industrial Leste, Refinaria Tétis & Cidadela PCC.
 *
 * Identidade Sonora:
 * - Rust, Petrochemical Refinery, Wind Turbines & PCC Armored Bunker Industrial Ambient.
 * - Campo harmônico: E Phrygian / E Locrian (Em -> Fmaj7#11 -> Dm -> Bbb5/E),
 *   inspirado em Nine Inch Nails (Ghosts I-IV), Chernobyl e Arkham Industrial.
 * - Opressivo, metálico, mecânico, frio e discreto ao fundo (gain 0.013..0.048, cutoff 180..680 Hz).
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

const CHORD_PROGRESSION = [
  ['E2', 'B2', 'E3', 'G3'],   // Em (quinta frígia fria)
  ['F2', 'C3', 'E3', 'B3'],   // Fmaj7#11 (tensão petroquímica bII)
  ['D2', 'A2', 'D3', 'F3'],   // Dm (subtônica sombria)
  ['E2', 'Bb2', 'D3', 'F3']   // Bbb5/E (trítono lócrio sobre pedal de Mi)
];

const SUB_ROOTS = ['E1', 'F1', 'D1', 'E1'];
const BOWED_STEEL_NOTES = ['E1', 'F1', 'Bb1'];
const PIPE_RESONANCE_NOTES = ['E2', 'F2', 'Bb2', 'B2', 'D3', 'E3'];
const GHOST_MOTIF_NOTES = ['E3', 'F3', 'B2', 'D3', 'Bb2', 'G3'];
const PIPE_INHARM_RATIOS = [1.0, 1.41, 2.13];

const MOVEMENTS = [
  {
    id: 'ferrugem_galpoes', title: 'I. Pátios de Ferrugem & Galpões Abandonados',
    startSec: 0, endSec: 120, chordSpan: 2,
    padCutoff: 250, padGain: 0.024, subCutoff: 240, subGain: 0.034,
    noiseGain: 0.016, steamRatio: 0.30, pingDensity: 0.52, pingGain: 0.014,
    bowedDensity: 0.55, bowedGain: 0.019, ghostDensity: 0.28
  },
  {
    id: 'chamines_tetis', title: 'II. Vapores Pressurizados da Refinaria Tétis',
    startSec: 120, endSec: 240, chordSpan: 3,
    padCutoff: 320, padGain: 0.030, subCutoff: 240, subGain: 0.039,
    noiseGain: 0.021, steamRatio: 0.58, pingDensity: 0.72, pingGain: 0.016,
    bowedDensity: 0.78, bowedGain: 0.024, ghostDensity: 0.46
  },
  {
    id: 'cidadela_blindada_pcc', title: 'III. Cidadela Blindada & Pátio de Contenção',
    startSec: 240, endSec: 360, chordSpan: 4,
    padCutoff: 375, padGain: 0.035, subCutoff: 240, subGain: 0.044,
    noiseGain: 0.024, steamRatio: 0.50, pingDensity: 0.84, pingGain: 0.018,
    bowedDensity: 1.0, bowedGain: 0.029, ghostDensity: 0.58
  },
  {
    id: 'oito_turbinas_smog', title: 'IV. Oito Aerogeradores sob Smog Petroquímico',
    startSec: 360, endSec: 480, chordSpan: 4,
    padCutoff: 445, padGain: 0.040, subCutoff: 240, subGain: 0.047,
    noiseGain: 0.027, steamRatio: 0.48, pingDensity: 0.92, pingGain: 0.020,
    bowedDensity: 1.0, bowedGain: 0.033, ghostDensity: 0.50
  },
  {
    id: 'vigilia_aco_cinzas', title: 'V. Vigília de Aço & Cinzas Frias',
    startSec: 480, endSec: 600, chordSpan: 3,
    padCutoff: 265, padGain: 0.025, subCutoff: 240, subGain: 0.035,
    noiseGain: 0.017, steamRatio: 0.35, pingDensity: 0.48, pingGain: 0.014,
    bowedDensity: 0.50, bowedGain: 0.018, ghostDensity: 0.25
  }
];

const clampGain = (v) => Math.max(0.013, Math.min(0.048, v));
const clampCutoff = (hz) => Math.max(180, Math.min(680, hz));

export const INDUSTRIAL_LESTE_AMBIENCE = {
  id: 'industrial_leste',
  title: 'Ferrugem, Refinaria Tétis & Cidadela Blindada',
  durationSec: DURATION_SEC,
  baseGain: 0.85,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 4, rig, targetNode, startTime, contextState } = {}) {
    if (!rig?.ctx || !(windowDurSec > 0)) return 0;

    const baseTime = Number.isFinite(startTime) ? startTime : (rig.ctx.currentTime || 0);
    const nightLift = Number.isFinite(contextState?.nightFactor) ? contextState.nightFactor * 0.003 : 0;
    let scheduled = 0;

    // 1. Pad Modular Escuro (período coprimo 15.5s): Em -> Fmaj7#11 -> Dm -> Bbb5/E
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 15.5, 0.3);
    if (padTrig.hit) {
      const { movement: mv, index: mvIdx, localProgress } = resolveMovementAt(
        MOVEMENTS, cursorSec + padTrig.delaySec, DURATION_SEC
      );
      const chordIdx = ((padTrig.stepIndex % mv.chordSpan) + mv.chordSpan) % mv.chordSpan;
      const tailCool = mvIdx === 4 ? (1 - localProgress * 0.22) : 1;
      const cutoff = clampCutoff((mv.padCutoff + Math.sin(localProgress * Math.PI) * 15) * tailCool);

      playDarkPadChord(rig, {
        notes: CHORD_PROGRESSION[chordIdx],
        time: baseTime + padTrig.delaySec,
        duration: 16.8,
        attack: 4.4,
        release: 5.2,
        cutoff,
        cutoffPeak: clampCutoff(cutoff * 1.34),
        detuneCents: 6.5 + mvIdx * 1.1,
        q: 1.05,
        gain: clampGain(mv.padGain * tailCool + nightLift),
        pan: (seededRand(padTrig.stepIndex * 3.17 + 1.1) - 0.5) * 0.32,
        reverb: 0.82,
        delay: 0.22,
        dest: targetNode
      });
      scheduled++;
    }

    // 2. Sub-Drone Modular Frio (período coprimo 21.5s): fundação mecânica em E1 / F1 / D1
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 21.5, 1.4);
    if (subTrig.hit) {
      const { movement: mv, index: mvIdx } = resolveMovementAt(
        MOVEMENTS, cursorSec + subTrig.delaySec, DURATION_SEC
      );
      const rootIdx = ((subTrig.stepIndex % mv.chordSpan) + mv.chordSpan) % mv.chordSpan;
      const useLocrianGlide = mvIdx >= 2 && mvIdx <= 3 && subTrig.stepIndex % 3 === 2;

      playSubDrone(rig, {
        note: SUB_ROOTS[rootIdx],
        glideToNote: useLocrianGlide ? 'F1' : undefined,
        fifth: mvIdx >= 2 && subTrig.stepIndex % 2 === 1,
        time: baseTime + subTrig.delaySec,
        duration: 22.8,
        attack: 4.2,
        release: 5.4,
        cutoff: clampCutoff(mv.subCutoff),
        gain: clampGain(mv.subGain + nightLift),
        reverb: 0.34,
        dest: targetNode
      });
      scheduled++;
    }

    // 3. Chaminés da Refinaria Tétis (pink) & Giro das 8 Turbinas Eólicas (brown) (período coprimo 9.8s)
    const airTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 9.8, 0.9);
    if (airTrig.hit) {
      const { movement: mv } = resolveMovementAt(MOVEMENTS, cursorSec + airTrig.delaySec, DURATION_SEC);
      const isRefinerySteam = seededRand(airTrig.stepIndex * 7.13 + 19.4) < mv.steamRatio;

      playAtmosphericNoiseSwell(rig, {
        color: isRefinerySteam ? 'pink' : 'brown',
        filterType: isRefinerySteam ? 'bandpass' : 'lowpass',
        freqStart: clampCutoff(isRefinerySteam ? 310 : 185),
        freqEnd: clampCutoff(isRefinerySteam ? 570 : 320),
        q: isRefinerySteam ? 1.85 : 1.15,
        time: baseTime + airTrig.delaySec,
        duration: isRefinerySteam ? 7.6 : 9.2,
        attack: isRefinerySteam ? 2.2 : 3.4,
        gain: clampGain(mv.noiseGain * (isRefinerySteam ? 0.88 : 1.0)),
        pan: (seededRand(airTrig.stepIndex * 5.71 + 3.2) - 0.5) * 0.68,
        reverb: isRefinerySteam ? 0.72 : 0.56,
        delay: isRefinerySteam ? 0.20 : 0.08,
        seed: airTrig.stepIndex * 1.73 + 4.1,
        dest: targetNode
      });
      scheduled++;
    }

    // 4. Ressonâncias Cavernosas de Tubulações, Bigornas & Galpões (período coprimo 7.1s)
    const pingTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 7.1, 2.3);
    if (pingTrig.hit) {
      const { movement: mv } = resolveMovementAt(MOVEMENTS, cursorSec + pingTrig.delaySec, DURATION_SEC);
      const gate = seededRand(pingTrig.stepIndex * 11.31 + 5.7);
      if (gate <= mv.pingDensity) {
        const notePick = Math.floor(seededRand(pingTrig.stepIndex * 4.91 + 8.3) * PIPE_RESONANCE_NOTES.length);
        playMetallicEchoPing(rig, {
          note: PIPE_RESONANCE_NOTES[notePick],
          ratios: PIPE_INHARM_RATIOS,
          time: baseTime + pingTrig.delaySec,
          duration: 3.9 + seededRand(pingTrig.stepIndex * 2.37) * 1.6,
          attack: 0.028,
          cutoff: 580,
          pitchDrop: gate < 0.28 ? 0.982 : undefined,
          gain: clampGain(mv.pingGain),
          pan: (seededRand(pingTrig.stepIndex * 9.19 + 2.6) - 0.5) * 0.74,
          reverb: 0.9,
          delay: 0.48,
          dest: targetNode
        });
        scheduled++;
      }
    }

    // 5. Gemidos de Aço Torcido & Metais Pesados em E1, F1, Bb1 (período coprimo 28s)
    const bowedTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 28, 5.2);
    if (bowedTrig.hit) {
      const { movement: mv, index: mvIdx } = resolveMovementAt(
        MOVEMENTS, cursorSec + bowedTrig.delaySec, DURATION_SEC
      );
      if (seededRand(bowedTrig.stepIndex * 6.47 + 13.9) <= mv.bowedDensity) {
        const poolLen = mvIdx >= 2 && mvIdx <= 3 ? 3 : 2;
        const steelNote = BOWED_STEEL_NOTES[((bowedTrig.stepIndex % poolLen) + poolLen) % poolLen];

        playBowedMetalOrHorn(rig, {
          note: steelNote,
          bendRatio: steelNote === 'Bb1' ? 0.968 : 0.982,
          time: baseTime + bowedTrig.delaySec,
          duration: 10.6,
          attack: 3.4,
          cutoff: clampCutoff(steelNote === 'Bb1' ? 430 : 320),
          q: 2.8,
          gain: clampGain(mv.bowedGain + nightLift),
          pan: (seededRand(bowedTrig.stepIndex * 8.03 + 7.1) - 0.5) * 0.52,
          reverb: 0.88,
          delay: 0.30,
          dest: targetNode
        });
        scheduled++;
      }
    }

    // 6. Motivo Desolado Frio estilo NIN Ghosts / Chernobyl (defasado no ciclo de 15.5s)
    const ghostTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 15.5, 8.4);
    if (ghostTrig.hit) {
      const { movement: mv } = resolveMovementAt(MOVEMENTS, cursorSec + ghostTrig.delaySec, DURATION_SEC);
      if (seededRand(ghostTrig.stepIndex * 13.07 + 21.1) <= mv.ghostDensity) {
        const idx = Math.floor(seededRand(ghostTrig.stepIndex * 3.89 + 6.4) * GHOST_MOTIF_NOTES.length);
        playNoirFeltNote(rig, {
          note: GHOST_MOTIF_NOTES[idx],
          tone: ghostTrig.stepIndex % 2 === 0 ? 'felt' : 'rhodes',
          time: baseTime + ghostTrig.delaySec,
          duration: 5.4,
          cutoff: clampCutoff(430),
          gain: clampGain(0.015),
          pan: (seededRand(ghostTrig.stepIndex * 6.11 + 0.9) - 0.5) * 0.45,
          reverb: 0.85,
          delay: 0.44,
          dest: targetNode
        });
        scheduled++;
      }
    }

    return scheduled;
  }
};

export default INDUSTRIAL_LESTE_AMBIENCE;
