/**
 * AeroportoOesteAmbience.js
 * Trilha Dark Ambient de 10 minutos (600s) — Aeroporto Oeste, Base Militar A.R.E.S. & Cabo Radar.
 *
 * Identidade acústica:
 * - Tonalidade: C# Minor / G# Phrygian (C#m9 -> Amaj7#11 -> F#m9 -> G#7b9), inspirada em
 *   Sicario / Tenet e perímetros aéreos classificados sob vigilância noturna.
 * - Camadas: sub-drones subterrâneos de bunker (C#1, A0, F#1, G#1), pads frios analógicos,
 *   varredura hipnótica abafada do Cabo Radar Noroeste (delay 0.58, cutoff <= 680 Hz),
 *   estrondo distante de turbinas na Pista 09/27 + vento cruzado no tarmac (90 Hz -> 380 Hz)
 *   e metais graves tensionados no horizonte militar.
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

const TOTAL_DURATION_SEC = 600;

const CHORD_VOICINGS = {
  cSharpMin9: ['C#2', 'G#2', 'B2', 'D#3', 'E3'],
  aMaj7Sharp11: ['A1', 'E2', 'G#2', 'C#3', 'D#3'],
  fSharpMin9: ['F#1', 'C#2', 'E2', 'A2', 'G#3'],
  gSharp7Flat9: ['G#1', 'D#2', 'F#2', 'A2', 'C3']
};

const RADAR_PING_NOTES = ['G#3', 'C#3', 'D#3', 'E3', 'A3'];
const RADAR_GLASS_NOTES = ['G#3', 'D#4', 'C#4', 'E4', 'B3', 'A3'];
const HORN_ROOT_NOTES = ['G#1', 'C#2', 'A1', 'F#1'];

const MOVEMENTS = [
  {
    id: 'perimetro_noturno_pista',
    title: 'I. Perímetro Noturno & Pista 09/27',
    startSec: 0, endSec: 120, tension: 0.34, radarDensity: 0.64, hornDensity: 0.45,
    padGain: 0.026, padCutoff: 260, padPeak: 430, droneGain: 0.031, turbineEndHz: 295,
    chords: ['cSharpMin9', 'aMaj7Sharp11', 'fSharpMin9', 'gSharp7Flat9'],
    drones: ['C#1', 'A0', 'F#1', 'G#1']
  },
  {
    id: 'cabo_radar_varredura',
    title: 'II. Cabo Radar Noroeste — Varredura Cega',
    startSec: 120, endSec: 240, tension: 0.58, radarDensity: 0.9, hornDensity: 0.68,
    padGain: 0.031, padCutoff: 305, padPeak: 545, droneGain: 0.035, turbineEndHz: 340,
    chords: ['aMaj7Sharp11', 'cSharpMin9', 'gSharp7Flat9', 'fSharpMin9'],
    drones: ['A0', 'C#1', 'G#1', 'F#1']
  },
  {
    id: 'hangares_ares_alerta',
    title: 'III. Hangares A.R.E.S. & Comboio na Pista',
    startSec: 240, endSec: 360, tension: 0.94, radarDensity: 0.96, hornDensity: 1.0,
    padGain: 0.041, padCutoff: 365, padPeak: 690, droneGain: 0.045, turbineEndHz: 380,
    chords: ['gSharp7Flat9', 'cSharpMin9', 'fSharpMin9', 'gSharp7Flat9'],
    drones: ['G#1', 'C#1', 'F#1', 'A0']
  },
  {
    id: 'neblina_atlantica_tarmac',
    title: 'IV. Neblina Atlântica & Luzes de Táxi',
    startSec: 360, endSec: 480, tension: 0.48, radarDensity: 0.76, hornDensity: 0.56,
    padGain: 0.028, padCutoff: 280, padPeak: 495, droneGain: 0.031, turbineEndHz: 330,
    chords: ['fSharpMin9', 'aMaj7Sharp11', 'cSharpMin9', 'gSharp7Flat9'],
    drones: ['F#1', 'A0', 'C#1', 'G#1']
  },
  {
    id: 'vigilia_madrugada_hangar',
    title: 'V. Vigília de Madrugada & Retorno ao Silêncio',
    startSec: 480, endSec: 600, tension: 0.25, radarDensity: 0.52, hornDensity: 0.36,
    padGain: 0.022, padCutoff: 235, padPeak: 385, droneGain: 0.026, turbineEndHz: 255,
    chords: ['cSharpMin9', 'aMaj7Sharp11', 'fSharpMin9', 'cSharpMin9'],
    drones: ['C#1', 'A0', 'F#1', 'C#1']
  }
];

const clampGain = (v) => Math.max(0.013, Math.min(0.048, v));
const clampCutoff = (v) => Math.max(200, Math.min(740, v));

export const AEROPORTO_OESTE_AMBIENCE = {
  id: 'aeroporto_oeste',
  title: 'Perímetro Classificado: Pista 09/27 & Cabo Radar',
  durationSec: TOTAL_DURATION_SEC,
  baseGain: 0.85,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 2.5, rig, targetNode, startTime, contextState } = {}) {
    if (!rig?.ctx || !(windowDurSec > 0)) return 0;

    const baseTime = startTime ?? (rig.ctx.currentTime || 0);
    const { movement, index: mvIdx, localProgress } = resolveMovementAt(
      MOVEMENTS,
      cursorSec,
      TOTAL_DURATION_SEC
    );
    const mv = movement || MOVEMENTS[0];
    const nightBoost = contextState?.isNight ? 1.05 : 1.0;
    const arcBreath = Math.sin(localProgress * Math.PI);
    let scheduled = 0;

    // 1. Pads sintetizados frios (período coprimo 14.0s): C#m9 -> Amaj7#11 -> F#m9 -> G#7b9
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 14.0, 0.9);
    if (padTrig.hit) {
      const chordKey = mv.chords[Math.abs(padTrig.stepIndex) % mv.chords.length];
      const r = seededRand(padTrig.stepIndex * 1.73 + mvIdx * 13.1);
      playDarkPadChord(rig, {
        notes: CHORD_VOICINGS[chordKey] || CHORD_VOICINGS.cSharpMin9,
        time: baseTime + padTrig.delaySec,
        duration: 13.4 + r * 2.2,
        attack: 3.9,
        release: 4.8,
        cutoff: clampCutoff(mv.padCutoff + arcBreath * 35),
        cutoffPeak: clampCutoff(mv.padPeak + arcBreath * 45),
        detuneCents: 6.5 + mv.tension * 3.5,
        waveform: mvIdx === 2 ? 'sawtooth' : 'triangle',
        q: 0.85 + mv.tension * 0.35,
        pan: (r - 0.5) * 0.28,
        reverb: 0.78,
        delay: 0.22,
        gain: clampGain(mv.padGain * nightBoost),
        dest: targetNode
      });
      scheduled++;
    }

    // 2. Pulso grave tenso de bunker militar (período coprimo 8.8s): C#1, A0, F#1, G#1
    const droneTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 8.8, 0.2);
    if (droneTrig.hit) {
      const step = Math.abs(droneTrig.stepIndex);
      const r = seededRand(step * 2.41 + mvIdx * 7.7);
      const usePhrygianDrop = mvIdx === 2 && step % 3 === 0;
      playSubDrone(rig, {
        note: usePhrygianDrop ? 'A1' : mv.drones[step % mv.drones.length],
        glideToNote: usePhrygianDrop ? 'G#1' : undefined,
        fifth: step % 2 === 1,
        time: baseTime + droneTrig.delaySec,
        duration: 8.2 + r * 1.3,
        attack: 2.5,
        release: 3.4,
        cutoff: clampCutoff(205 + mv.tension * 30),
        reverb: 0.3,
        gain: clampGain((mv.droneGain + arcBreath * 0.003) * nightBoost),
        dest: targetNode
      });
      scheduled++;
    }

    // 3. Turbinas distantes na Pista 09/27 & vento cruzado no asfalto (período coprimo 20.5s)
    const windTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 20.5, 3.4);
    if (windTrig.hit) {
      const step = Math.abs(windTrig.stepIndex);
      const isTurbineRoar = step % 2 === 0;
      const r = seededRand(step * 3.19 + mvIdx * 19.3);
      playAtmosphericNoiseSwell(rig, {
        color: isTurbineRoar ? 'brown' : 'pink',
        filterType: isTurbineRoar ? 'lowpass' : 'bandpass',
        q: isTurbineRoar ? 1.05 : 1.55,
        freqStart: 90,
        freqEnd: Math.min(380, Math.round(mv.turbineEndHz + r * 35)),
        time: baseTime + windTrig.delaySec,
        duration: 14.5 + r * 3.5,
        attack: 3.8,
        pan: isTurbineRoar ? (r - 0.5) * 0.36 : Math.cos(step * 1.1) * 0.52,
        reverb: 0.64,
        delay: 0.16,
        seed: step * 0.77 + mvIdx,
        gain: clampGain(isTurbineRoar ? 0.02 + mv.tension * 0.013 : 0.015 + mv.tension * 0.008),
        dest: targetNode
      });
      scheduled++;
    }

    // 4. Varredura hipnótica do Cabo Radar Noroeste (período coprimo 6.1s, delay 0.58, cutoff 680)
    const radarTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 6.1, 2.1);
    if (radarTrig.hit) {
      const step = Math.abs(radarTrig.stepIndex);
      const r = seededRand(step * 4.07 + mvIdx * 23.9);
      if (r <= mv.radarDensity) {
        const dishPan = Math.sin(step * 0.92) * 0.62;
        const useGlassTone = mvIdx === 3 ? step % 3 !== 0 : step % 2 === 1;
        if (useGlassTone) {
          playNoirFeltNote(rig, {
            note: RADAR_GLASS_NOTES[step % RADAR_GLASS_NOTES.length],
            tone: 'glass',
            time: baseTime + radarTrig.delaySec,
            duration: 3.6 + r * 1.1,
            cutoff: clampCutoff(680 - (1 - mv.tension) * 70),
            pan: dishPan,
            reverb: 0.82,
            delay: 0.58,
            gain: clampGain(0.014 + mv.tension * 0.008),
            dest: targetNode
          });
        } else {
          playMetallicEchoPing(rig, {
            note: RADAR_PING_NOTES[step % RADAR_PING_NOTES.length],
            ratios: [1.0, 1.5, 2.02],
            time: baseTime + radarTrig.delaySec,
            duration: 3.1 + r * 0.7,
            attack: 0.03,
            cutoff: 680,
            pan: dishPan,
            reverb: 0.85,
            delay: 0.58,
            gain: clampGain(0.014 + mv.tension * 0.007),
            dest: targetNode
          });
        }
        scheduled++;
      }
    }

    // 5. Metais graves distantes de hangar / trompa tática (período coprimo 29.5s)
    const hornTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 29.5, 6.8);
    if (hornTrig.hit) {
      const step = Math.abs(hornTrig.stepIndex);
      const r = seededRand(step * 5.63 + mvIdx * 31.7);
      if (r <= mv.hornDensity) {
        playBowedMetalOrHorn(rig, {
          note: HORN_ROOT_NOTES[(step + mvIdx) % HORN_ROOT_NOTES.length],
          bendRatio: 0.978,
          time: baseTime + hornTrig.delaySec,
          duration: 8.6 + r * 2.4,
          attack: 2.8,
          q: 2.3,
          cutoff: clampCutoff(245 + mv.tension * 165),
          pan: -Math.sin(step * 1.3) * 0.44,
          reverb: 0.88,
          delay: 0.32,
          gain: clampGain(0.017 + mv.tension * 0.018),
          dest: targetNode
        });
        scheduled++;
      }
    }

    return scheduled;
  }
};

export default AEROPORTO_OESTE_AMBIENCE;
