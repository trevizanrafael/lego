/**
 * CentroFinanceiroAmbience.js
 * Trilha Dark Ambient Procedural de 10 Minutos (600s) — Centro Financeiro & Super Banco Central.
 *
 * Identidade Sonora: Gotham Corporate Noir / Blade Runner Rainy Metropolis
 * Campo Harmônico: C Minor / C Dorian -> Abmaj7#11 -> Fm9 -> G7b9 -> Cm(maj9)
 * Regra de Ouro: Volume estritamente baixo e ambiente (gain 0.014..0.052),
 * filtros passa-baixa escuros (220..720 Hz) e zero melodias agudas ou alegres.
 */

import {
  seededRand,
  checkPeriodicTrigger,
  resolveMovementAt,
  playDarkPadChord,
  playSubDrone,
  playNoirFeltNote,
  playBowedMetalOrHorn,
  playAtmosphericNoiseSwell,
  playMetallicEchoPing
} from '../AmbienceSynthPrimitives.js';

const clampGain = (g) => Math.max(0.014, Math.min(0.052, g));
const clampCutoff = (f, minHz = 170, maxHz = 720) => Math.max(minHz, Math.min(maxHz, f));

const MOVEMENTS = [
  {
    id: 'monolitos_sob_garoa',
    title: 'I. Monólitos Sob Garoa',
    startSec: 0,
    endSec: 120,
    cutoffBase: 255,
    cutoffArc: 135,
    density: 0.46,
    feltProb: 0.44,
    chords: [['C2', 'G2', 'Eb3', 'Bb3'], ['C2', 'G2', 'A2', 'D3'], ['Ab1', 'Eb2', 'C3', 'G3'], ['F2', 'C3', 'Eb3', 'G3']],
    subNotes: ['C1', 'G1', 'Ab1', 'F1'],
    hornNotes: ['C2', 'G1', 'Ab1', 'F1'],
    feltNotes: ['G2', 'C3', 'D3', 'Eb3', 'Bb2', 'A2']
  },
  {
    id: 'reflexos_corporativos_chumbo',
    title: 'II. Reflexos Corporativos em Chumbo',
    startSec: 120,
    endSec: 240,
    cutoffBase: 305,
    cutoffArc: 195,
    density: 0.62,
    feltProb: 0.54,
    chords: [['Ab1', 'Eb2', 'G2', 'C3', 'D3'], ['C2', 'G2', 'Bb2', 'D3', 'Eb3'], ['F1', 'C2', 'G2', 'Ab2', 'Eb3'], ['D2', 'A2', 'C3', 'F3']],
    subNotes: ['Ab1', 'C1', 'F1', 'D1'],
    hornNotes: ['Ab1', 'C2', 'F1', 'D2'],
    feltNotes: ['Ab2', 'C3', 'D3', 'G3', 'Eb3', 'Bb2']
  },
  {
    id: 'sombra_do_super_banco',
    title: 'III. Sombra do Super Banco Central',
    startSec: 240,
    endSec: 360,
    cutoffBase: 285,
    cutoffArc: 255,
    density: 0.74,
    feltProb: 0.58,
    chords: [['F1', 'C2', 'Ab2', 'Eb3', 'G3'], ['D2', 'Ab2', 'C3', 'F3'], ['G1', 'F2', 'Ab2', 'B2'], ['C2', 'G2', 'Eb3', 'Ab3']],
    subNotes: ['F1', 'D1', 'G1', 'C1'],
    hornNotes: ['F1', 'G1', 'B1', 'C2'],
    feltNotes: ['F3', 'Ab2', 'B2', 'C3', 'Eb3', 'G2']
  },
  {
    id: 'canyons_vapor_sodio',
    title: 'IV. Cânions de Vapor e Sódio',
    startSec: 360,
    endSec: 480,
    cutoffBase: 335,
    cutoffArc: 315,
    density: 0.86,
    feltProb: 0.66,
    chords: [['Ab1', 'Eb2', 'G2', 'B2', 'D3'], ['F1', 'C2', 'G2', 'Ab2', 'Eb3'], ['G1', 'D2', 'F2', 'Ab2', 'B2'], ['C2', 'G2', 'B2', 'D3', 'Eb3']],
    subNotes: ['Ab1', 'F1', 'G1', 'C1'],
    hornNotes: ['Ab1', 'F1', 'G1', 'Eb2', 'C2'],
    feltNotes: ['D3', 'Eb3', 'G3', 'Ab2', 'B2', 'C3', 'F3']
  },
  {
    id: 'vigilia_cinzenta',
    title: 'V. Vigília Cinzenta Antes da Alva',
    startSec: 480,
    endSec: 600,
    cutoffBase: 235,
    cutoffArc: 165,
    density: 0.5,
    feltProb: 0.42,
    chords: [['F1', 'C2', 'Ab2', 'Eb3', 'G3'], ['Db2', 'Ab2', 'C3', 'G3'], ['G1', 'F2', 'Ab2', 'B2'], ['C2', 'G2', 'Bb2', 'Eb3']],
    subNotes: ['F1', 'Db1', 'G1', 'C1'],
    hornNotes: ['F1', 'Db2', 'G1', 'C2'],
    feltNotes: ['C3', 'Ab2', 'G2', 'Eb3', 'Db3', 'Bb2']
  }
];

export const CENTRO_FINANCEIRO_AMBIENCE = {
  id: 'centro_financeiro',
  title: 'Centro Financeiro & Super Banco — Monólitos Noir',
  durationSec: 600,
  baseGain: 0.88,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 1.0, rig, targetNode, startTime = rig?.ctx?.currentTime || 0, contextState } = {}) {
    if (!rig?.ctx || !(windowDurSec > 0)) return 0;

    const subRegionId = contextState?.subRegionId || null;
    const isBankVault = subRegionId === 'super_banco_interior';
    const isSubway = subRegionId === 'metro_subterraneo';
    const cutScale = isBankVault ? 0.78 : 1.0;
    const minCut = isBankVault ? 172 : 220;
    const maxCut = Math.round(720 * cutScale);

    const { movement, index: mvIdx, localProgress } = resolveMovementAt(MOVEMENTS, cursorSec, 600);
    const breath = Math.sin(localProgress * Math.PI);
    const dynamicCut = (movement.cutoffBase + movement.cutoffArc * breath) * cutScale;
    let voicesTriggered = 0;

    // 1. Pad Analógico Noir (períodos coprimos 17s + 29s nos movimentos mais densos)
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 17.0, 0.25);
    if (padTrig.hit) {
      const r = seededRand(padTrig.stepIndex * 19.37 + mvIdx * 7.1);
      const chordIdx = (padTrig.stepIndex + (r > 0.68 ? 1 : 0)) % movement.chords.length;
      const baseCut = clampCutoff(dynamicCut * (0.9 + r * 0.16), minCut, maxCut);
      playDarkPadChord(rig, {
        notes: movement.chords[chordIdx], time: startTime + padTrig.delaySec,
        duration: 16.4 + r * 2.8, attack: 4.1, release: 5.2,
        cutoff: baseCut, cutoffPeak: clampCutoff(baseCut * 1.28, minCut, maxCut),
        detuneCents: 6.5 + r * 4.0, gain: clampGain(0.032 + movement.density * 0.014),
        pan: (r - 0.5) * 0.36, reverb: isBankVault ? 0.84 : 0.76, delay: 0.2, dest: targetNode
      });
      voicesTriggered++;
    }

    const shimmerPadTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 29.0, 8.6);
    if (shimmerPadTrig.hit && seededRand(shimmerPadTrig.stepIndex * 31.7 + mvIdx) < movement.density * 0.75) {
      const r2 = seededRand(shimmerPadTrig.stepIndex * 43.1 + 3.9);
      const chord = movement.chords[(shimmerPadTrig.stepIndex + 2) % movement.chords.length];
      const cut2 = clampCutoff(dynamicCut * 0.84, minCut, maxCut);
      playDarkPadChord(rig, {
        notes: chord.slice(0, 3), time: startTime + shimmerPadTrig.delaySec,
        duration: 13.5 + r2 * 3.0, attack: 3.8, release: 4.6, waveform: 'triangle',
        cutoff: cut2, cutoffPeak: clampCutoff(cut2 * 1.2, minCut, maxCut),
        gain: clampGain(0.019 + movement.density * 0.008), pan: (0.5 - r2) * 0.5, reverb: 0.8, dest: targetNode
      });
      voicesTriggered++;
    }

    // 2. Sub-Drone Abissal (período coprimo 13s)
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 13.0, 0.05);
    if (subTrig.hit) {
      const rs = seededRand(subTrig.stepIndex * 13.9 + mvIdx * 5.3);
      const noteIdx = subTrig.stepIndex % movement.subNotes.length;
      playSubDrone(rig, {
        note: movement.subNotes[noteIdx],
        glideToNote: rs > 0.62 ? movement.subNotes[(noteIdx + 1) % movement.subNotes.length] : undefined,
        fifth: mvIdx === 2 || (mvIdx === 3 && rs > 0.5),
        time: startTime + subTrig.delaySec, duration: 14.4, attack: 3.4, release: 4.3,
        cutoff: Math.round((isBankVault ? 105 : 142) + breath * 32),
        gain: clampGain(isSubway ? 0.048 : 0.036 + movement.density * 0.012), reverb: 0.3, dest: targetNode
      });
      voicesTriggered++;
    }

    // 3. Vento & Chuva Fina nos Cânions de Concreto / Estrondo Subterrâneo (período coprimo 9.5s)
    const windTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 9.5, 1.35);
    if (windTrig.hit) {
      const rw = seededRand(windTrig.stepIndex * 27.3 + mvIdx * 2.7);
      playAtmosphericNoiseSwell(rig, {
        color: isSubway || isBankVault || rw < 0.45 ? 'brown' : 'pink',
        filterType: isSubway || isBankVault ? 'lowpass' : 'bandpass',
        q: isSubway ? 0.95 : 1.35,
        freqStart: isSubway ? 88 + rw * 34 : clampCutoff((235 + rw * 90) * cutScale, minCut, maxCut),
        freqEnd: isSubway ? 155 + rw * 55 : clampCutoff((360 + breath * 150) * cutScale, minCut, maxCut),
        time: startTime + windTrig.delaySec, duration: 10.8 + rw * 2.2, attack: 3.1,
        gain: clampGain(isSubway ? 0.034 + rw * 0.01 : isBankVault ? 0.016 : 0.018 + movement.density * 0.009),
        pan: (rw - 0.5) * 0.62, reverb: isSubway ? 0.72 : 0.58, seed: windTrig.stepIndex + mvIdx * 100, dest: targetNode
      });
      voicesTriggered++;
    }

    // 4. Metais Noir & Trompas Distantes de Gotham (período coprimo 23s)
    const hornTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 23.0, 4.2);
    if (hornTrig.hit && seededRand(hornTrig.stepIndex * 41.9 + mvIdx * 3.1) <= movement.density + 0.18) {
      const rh = seededRand(hornTrig.stepIndex * 53.7 + 9.4);
      playBowedMetalOrHorn(rig, {
        note: movement.hornNotes[hornTrig.stepIndex % movement.hornNotes.length],
        bendRatio: rh > 0.5 ? 0.982 : 1.015, time: startTime + hornTrig.delaySec,
        duration: 8.8 + rh * 3.4, attack: 2.8, q: 2.2 + rh * 0.9,
        cutoff: clampCutoff((265 + breath * 185 + rh * 65) * cutScale, minCut, maxCut),
        gain: clampGain(0.019 + movement.density * 0.013), pan: (rh - 0.5) * 0.78,
        reverb: 0.88, delay: 0.32, dest: targetNode
      });
      voicesTriggered++;
    }

    // 5. Gotas Esparsas de Piano Feltro Sombrio (período coprimo 6.2s, estritamente 'felt')
    const feltTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 6.2, 2.15);
    if (feltTrig.hit && seededRand(feltTrig.stepIndex * 67.3 + mvIdx * 11.7) <= movement.feltProb) {
      const rf = seededRand(feltTrig.stepIndex * 79.1 + mvIdx * 4.9);
      const noteIdx = Math.floor(rf * movement.feltNotes.length) % movement.feltNotes.length;
      playNoirFeltNote(rig, {
        note: movement.feltNotes[noteIdx], tone: 'felt', time: startTime + feltTrig.delaySec,
        duration: 4.4 + rf * 2.2, cutoff: clampCutoff((280 + breath * 165 + rf * 55) * cutScale, minCut, maxCut),
        gain: clampGain(0.015 + rf * 0.01), pan: (rf - 0.5) * 0.55, reverb: 0.82, delay: 0.44, dest: targetNode
      });
      voicesTriggered++;
    }

    // 6. Adaptações Dinâmicas de Sub-Região (Super Banco Interior vs. Metrô Subterrâneo)
    if (isBankVault) {
      const vaultTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 7.8, 0.9);
      if (vaultTrig.hit) {
        const rv = seededRand(vaultTrig.stepIndex * 37.1 + mvIdx);
        playSubDrone(rig, {
          note: rv > 0.65 ? 'G1' : rv > 0.35 ? 'F1' : 'C1', time: startTime + vaultTrig.delaySec,
          duration: 4.6, attack: 0.42, release: 2.6, cutoff: 108,
          gain: clampGain(0.026 + rv * 0.011), reverb: 0.45, dest: targetNode
        });
        playMetallicEchoPing(rig, {
          note: rv > 0.5 ? 'C2' : 'G2', ratios: [1.0, 1.42, 1.96], pitchDrop: 0.96,
          time: startTime + vaultTrig.delaySec, duration: 2.8, cutoff: clampCutoff(285 * cutScale, minCut, maxCut),
          gain: clampGain(0.015 + rv * 0.006), pan: (rv - 0.5) * 0.4, reverb: 0.88, delay: 0.38, dest: targetNode
        });
        voicesTriggered += 2;
      }
    } else if (isSubway) {
      const rumbleTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 11.3, 3.1);
      if (rumbleTrig.hit) {
        const rm = seededRand(rumbleTrig.stepIndex * 23.9 + mvIdx);
        playAtmosphericNoiseSwell(rig, {
          color: 'brown', filterType: 'lowpass', q: 0.85, freqStart: 76 + rm * 28, freqEnd: 148 + rm * 42,
          time: startTime + rumbleTrig.delaySec, duration: 11.8, attack: 3.4,
          gain: clampGain(0.032 + rm * 0.012), reverb: 0.78, seed: rumbleTrig.stepIndex * 17, dest: targetNode
        });
        voicesTriggered++;
      }
      const railTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 8.7, 1.6);
      if (railTrig.hit) {
        const rr = seededRand(railTrig.stepIndex * 61.3 + mvIdx);
        playMetallicEchoPing(rig, {
          note: 152 + rr * 64, ratios: [1.0, 1.53, 2.24], pitchDrop: 0.985, time: startTime + railTrig.delaySec,
          duration: 3.9, cutoff: clampCutoff(440 + rr * 95, 220, 720),
          gain: clampGain(0.016 + rr * 0.008), pan: (rr - 0.5) * 0.82, reverb: 0.92, delay: 0.58, dest: targetNode
        });
        voicesTriggered++;
      }
    }

    return voicesTriggered;
  }
};

export default CENTRO_FINANCEIRO_AMBIENCE;
