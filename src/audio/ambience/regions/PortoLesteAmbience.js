/**
 * PortoLesteAmbience.js
 * Trilha Dark Ambient generativa de 10 minutos (600s) — Porto de Cargas Leste, Contêineres & Golfo de Tétis.
 *
 * Identidade Sonora: "Smuggler's Cargo Docks, Creaking Container Ships & Dark Harbor Fog"
 * Campo harmônico: Bb Minor / F Phrygian (Bbm9 -> Gbmaj7 -> Ebm9 -> F7b9)
 * Referências: Gotham Docks à meia-noite, The Wire (docas) & Disco Elysium noir.
 * Regra de Ouro: profundo, portuário, clandestino, úmido e discreto (gain 0.014..0.048, cutoff 185..660 Hz).
 */

import {
  checkPeriodicTrigger, playAtmosphericNoiseSwell, playBowedMetalOrHorn,
  playDarkPadChord, playMetallicEchoPing, playNoirFeltNote,
  playSubDrone, resolveMovementAt, seededRand
} from '../AmbienceSynthPrimitives.js';

const HARBOR_CHORD_PROGRESSION = [
  ['Bb1', 'F2', 'Ab2', 'C3', 'Db3'], // Bbm9 — docas escuras sob neblina salgada
  ['Gb1', 'Db2', 'F2', 'Bb2', 'Db3'], // Gbmaj7 — armazéns enferrujados à beira d'água
  ['Eb1', 'Bb1', 'Gb2', 'Db3', 'F3'], // Ebm9 — maré pesada entre corredores de contêineres
  ['F1', 'C2', 'Eb2', 'A2', 'Gb3']    // F7b9 (F Phrygian) — tensão clandestina à meia-noite
];

const FREIGHTER_HORN_NOTES = ['Bb0', 'F1', 'Gb1'];
const CRANE_GROAN_NOTES = ['Bb1', 'C2', 'Db2', 'F2', 'Gb2'];
const NOIR_PIER_NOTES = ['F2', 'Bb2', 'C3', 'Db3', 'Gb3', 'Ab3'];
const HULL_MODAL_RATIOS = [[1.0, 1.39, 1.94], [1.0, 1.47, 2.08], [1.0, 1.53, 2.19]];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const PORTO_LESTE_AMBIENCE = {
  id: 'porto_leste',
  title: 'Porto de Cargas Leste — Neblina Negra no Golfo de Tétis',
  durationSec: 600,
  baseGain: 0.85,

  movements: [
    {
      id: 'neblina_pilares_cais', name: 'I. Neblina Fria nos Pilares do Cais', startSec: 0, endSec: 120,
      padGain: 0.025, padCutoff: 230, padPeak: 350, droneGain: 0.032, hornGain: 0.026, waterGain: 0.020, craneDensity: 0.35, noirDensity: 0.0
    },
    {
      id: 'labirinto_conteineres_portainers', name: 'II. Labirinto de Contêineres & Guindastes Portainers', startSec: 120, endSec: 240,
      padGain: 0.031, padCutoff: 270, padPeak: 455, droneGain: 0.037, hornGain: 0.031, waterGain: 0.023, craneDensity: 0.68, noirDensity: 0.42
    },
    {
      id: 'desembarque_clandestino', name: 'III. Desembarque Clandestino à Meia-Noite (F Phrygian)', startSec: 240, endSec: 360,
      padGain: 0.037, padCutoff: 315, padPeak: 585, droneGain: 0.043, hornGain: 0.038, waterGain: 0.026, craneDensity: 0.82, noirDensity: 0.72
    },
    {
      id: 'mare_negra_golfo_tetis', name: 'IV. Maré Negra & Cargueiros do Golfo de Tétis', startSec: 360, endSec: 480,
      padGain: 0.034, padCutoff: 290, padPeak: 520, droneGain: 0.045, hornGain: 0.042, waterGain: 0.029, craneDensity: 0.74, noirDensity: 0.55
    },
    {
      id: 'vigilia_ferrugem_bruma', name: 'V. Vigília de Ferrugem & Retorno à Bruma', startSec: 480, endSec: 600,
      padGain: 0.023, padCutoff: 210, padPeak: 330, droneGain: 0.030, hornGain: 0.024, waterGain: 0.018, craneDensity: 0.30, noirDensity: 0.22
    }
  ],

  scheduleWindow({ cursorSec = 0, windowDurSec = 0.5, rig, targetNode, startTime, contextState }) {
    if (!rig || !(windowDurSec > 0)) return 0;

    const { movement, index: mvIdx, localProgress } = resolveMovementAt(this.movements, cursorSec, this.durationSec);
    const mv = movement || this.movements[0];
    const baseTime = startTime ?? (rig.ctx?.currentTime || 0);
    const arch = Math.sin(localProgress * Math.PI);
    const nightBoost = contextState?.isNight ? 1.05 : 1.0;
    let scheduled = 0;

    // 1. Pads Sombrios de Contrabando Noturno (período coprimo: 16.5s)
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 16.5, 0.2);
    if (padTrig.hit) {
      const chordIdx = ((padTrig.stepIndex % 4) + 4) % 4;
      const fullChord = HARBOR_CHORD_PROGRESSION[chordIdx];
      const cutoff = clamp(mv.padCutoff + arch * 45, 195, 620);
      scheduled += Number(playDarkPadChord(rig, {
        notes: mvIdx === 0 || mvIdx === 4 ? fullChord.slice(0, 4) : fullChord,
        time: baseTime + padTrig.delaySec, duration: 17.6, attack: 4.4, release: 5.6,
        cutoff, cutoffPeak: clamp(mv.padPeak + arch * 55, cutoff + 40, 660),
        detuneCents: 6.5 + mvIdx * 0.8,
        gain: clamp(mv.padGain * nightBoost, 0.018, 0.042),
        pan: (seededRand(padTrig.stepIndex * 1.73 + 3.1) - 0.5) * 0.34,
        reverb: 0.82, delay: 0.22, dest: targetNode
      }));
    }

    // 2. Sub-Drone Abissal do Porto em Bb0 / F1 (período coprimo: 23.5s)
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 23.5, 1.1);
    if (subTrig.hit) {
      const step = Math.abs(subTrig.stepIndex);
      const rootNote = mvIdx === 2 && step % 3 === 1 ? 'F1' : step % 2 === 0 ? 'Bb0' : 'F1';
      scheduled += Number(playSubDrone(rig, {
        note: rootNote,
        glideToNote: mvIdx >= 2 && mvIdx <= 3 && step % 4 === 2 ? 'Gb1' : undefined,
        fifth: mvIdx >= 2 && mvIdx <= 3,
        time: baseTime + subTrig.delaySec, duration: 24.4, attack: 4.6, release: 6.2,
        cutoff: clamp(188 + mvIdx * 7 + arch * 12, 185, 225),
        gain: clamp(mv.droneGain, 0.022, 0.047),
        reverb: 0.34, dest: targetNode
      }));
    }

    // 3. Água Escura Batendo nos Pilares do Cais (período coprimo: 10.4s)
    const waterTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 10.4, 2.3);
    if (waterTrig.hit) {
      const r = seededRand(waterTrig.stepIndex * 2.41 + 19.7);
      scheduled += Number(playAtmosphericNoiseSwell(rig, {
        color: 'brown', filterType: 'bandpass', q: 1.25 + r * 0.45,
        freqStart: clamp(120 + r * 55, 120, 185),
        freqEnd: clamp(190 + arch * 48 + r * 40, 185, 280),
        time: baseTime + waterTrig.delaySec, duration: 9.6, attack: 3.1,
        gain: clamp(mv.waterGain + arch * 0.004, 0.015, 0.033),
        pan: (r - 0.5) * 0.56, reverb: 0.64, delay: 0.14,
        seed: waterTrig.stepIndex + 41, dest: targetNode
      }));
    }

    // 4. Buzinas Abissais de Cargueiros Transatlânticos no Golfo de Tétis (período coprimo: 31s)
    const hornTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 31.0, 4.8);
    if (hornTrig.hit) {
      const step = Math.abs(hornTrig.stepIndex);
      const r = seededRand(step * 3.17 + 7.9);
      scheduled += Number(playBowedMetalOrHorn(rig, {
        note: FREIGHTER_HORN_NOTES[(step + mvIdx) % FREIGHTER_HORN_NOTES.length],
        bendRatio: 0.982 - r * 0.008, filterType: 'lowpass', q: 2.4,
        cutoff: clamp(205 + mvIdx * 24 + r * 55, 190, 390),
        time: baseTime + hornTrig.delaySec, duration: 10.4 + r * 2.4, attack: 3.1,
        gain: clamp(mv.hornGain * nightBoost, 0.018, 0.045),
        pan: (r - 0.5) * 0.68, reverb: 0.9, delay: 0.34, dest: targetNode
      }));
    }

    // Resposta distante de segundo cargueiro na neblina durante os Movimentos III e IV (31s defasado)
    if (mvIdx === 2 || mvIdx === 3) {
      const answerTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 31.0, 19.4);
      if (answerTrig.hit) {
        const rAns = seededRand(answerTrig.stepIndex * 5.03 + 29.1);
        scheduled += Number(playBowedMetalOrHorn(rig, {
          note: rAns > 0.45 ? 'Gb1' : 'F1',
          bendRatio: 0.986, filterType: 'lowpass', q: 2.1,
          cutoff: clamp(195 + rAns * 45, 185, 290),
          time: baseTime + answerTrig.delaySec, duration: 9.2, attack: 3.4,
          gain: clamp(0.016 + arch * 0.006, 0.014, 0.024),
          pan: rAns > 0.5 ? -0.58 : 0.58, reverb: 0.9, delay: 0.38, dest: targetNode
        }));
      }
    }

    // 5. Rangido de Cascos, Contêineres, Portainers & Cabos de Aço (período coprimo: 6.9s)
    const metalTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 6.9, 3.3);
    if (metalTrig.hit) {
      const step = Math.abs(metalTrig.stepIndex);
      const r = seededRand(step * 4.09 + 53.3);
      const pan = (seededRand(step * 1.91 + 12.4) - 0.5) * 0.74;

      if (r < mv.craneDensity && step % 2 === 1) {
        scheduled += Number(playBowedMetalOrHorn(rig, {
          note: CRANE_GROAN_NOTES[(step + mvIdx) % CRANE_GROAN_NOTES.length],
          bendRatio: r > 0.5 ? 0.945 : 1.042, filterType: 'bandpass', q: 3.6 + r * 1.5,
          cutoff: clamp(225 + r * 260 + arch * 45, 200, 560),
          time: baseTime + metalTrig.delaySec, duration: 5.4 + r * 1.8, attack: 2.1,
          gain: clamp(0.015 + arch * 0.008, 0.014, 0.026),
          pan, reverb: 0.86, delay: 0.30, dest: targetNode
        }));
      } else {
        scheduled += Number(playMetallicEchoPing(rig, {
          note: clamp(110 + r * 150, 110, 260),
          ratios: HULL_MODAL_RATIOS[step % HULL_MODAL_RATIOS.length],
          pitchDrop: 0.95, cutoff: clamp(255 + r * 265, 220, 560),
          time: baseTime + metalTrig.delaySec, duration: 3.6 + r * 1.3, attack: 0.04,
          gain: clamp(0.014 + r * 0.008 + arch * 0.003, 0.014, 0.025),
          pan, reverb: 0.88, delay: 0.48, dest: targetNode
        }));
      }
    }

    // 6. Eco Noir Solitário nas Docas (Disco Elysium / The Wire — período 23.5s defasado)
    if (mv.noirDensity > 0) {
      const noirTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 23.5, 13.2);
      if (noirTrig.hit) {
        const rNoir = seededRand(noirTrig.stepIndex * 6.31 + 88.4);
        if (rNoir <= mv.noirDensity) {
          scheduled += Number(playNoirFeltNote(rig, {
            note: NOIR_PIER_NOTES[Math.abs(noirTrig.stepIndex + mvIdx) % NOIR_PIER_NOTES.length],
            tone: mvIdx === 2 ? 'rhodes' : 'felt',
            cutoff: clamp(295 + rNoir * 195, 260, 540),
            time: baseTime + noirTrig.delaySec, duration: 5.2 + rNoir * 1.2,
            gain: clamp(0.015 + arch * 0.006, 0.014, 0.022),
            pan: (rNoir - 0.5) * 0.42, reverb: 0.85, delay: 0.46, dest: targetNode
          }));
        }
      }
    }

    return scheduled;
  }
};

export default PORTO_LESTE_AMBIENCE;
