/**
 * FavelaCddAmbience.js
 * Trilha Dark Ambient de 10 minutos (600s) — Complexo da Cidade de Deus (Morro & Domínio do CV).
 *
 * Identidade Sonora: "Tense Hillside Alleyways, Overlook Mist & Crimson Syndicate Turf"
 * - Harmonia: G Phrygian Dominant / G Minor Escuro (Gm -> Abmaj7 -> Eb7 -> D7b9, tensão G - Ab).
 * - Atmosfera sombria de vielas, lajes e mirante à meia-noite (estilo Sicario / Tropa de Elite),
 *   sem batidão festivo (o Baile já tem som espacial próprio de 75m). Volume 0.014..0.050, cutoff 190..680 Hz.
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

const MOVEMENTS = [
  {
    id: 'becos_na_neblina', name: 'I. Becos na Neblina & Escadarias Úmidas', title: 'I. Becos na Neblina & Escadarias Úmidas',
    startSec: 0, endSec: 120, tension: 0.36, nylonDensity: 0.62,
    chords: [['G2', 'Bb2', 'D3', 'G3'], ['Ab1', 'Eb2', 'G2', 'C3'], ['G2', 'D3', 'Ab3', 'Bb3'], ['D2', 'F#2', 'C3', 'Eb3']],
    subSteps: [{ note: 'G1', glide: 'Ab1' }, { note: 'Ab1', glide: 'G1' }, { note: 'G1', glide: 'D1' }, { note: 'D1', glide: 'G1' }],
    nylonPool: ['G3', 'Ab3', 'D3', 'Bb3', 'C4', 'Eb4', 'G3', 'F#3'], surdoNotes: ['G2', 'D2', 'G2', 'C2']
  },
  {
    id: 'vigilia_nas_lajes', name: 'II. Vigília nas Lajes & Fios no Vento', title: 'II. Vigília nas Lajes & Fios no Vento',
    startSec: 120, endSec: 240, tension: 0.56, nylonDensity: 0.72,
    chords: [['G2', 'D3', 'G3', 'Bb3'], ['Ab2', 'C3', 'Eb3', 'G3'], ['Eb2', 'Bb2', 'Db3', 'G3'], ['D2', 'F#2', 'C3', 'Eb3']],
    subSteps: [{ note: 'G1', glide: 'Ab1' }, { note: 'Ab1', glide: 'Eb1' }, { note: 'Eb1', glide: 'D1' }, { note: 'D1', glide: 'G1' }],
    nylonPool: ['G3', 'Ab3', 'B3', 'C4', 'D4', 'Eb4', 'Ab3', 'G3'], surdoNotes: ['G2', 'D2', 'Ab2', 'D2']
  },
  {
    id: 'dominio_escarlate', name: 'III. Domínio Escarlate & Barricadas na Sombra', title: 'III. Domínio Escarlate & Barricadas na Sombra',
    startSec: 240, endSec: 360, tension: 0.84, nylonDensity: 0.80,
    chords: [['G2', 'Ab2', 'D3', 'G3'], ['Ab1', 'Eb2', 'G2', 'C3'], ['Eb2', 'G2', 'Bb2', 'Db3'], ['D2', 'A2', 'C3', 'Eb3']],
    subSteps: [{ note: 'G1', glide: 'Ab1' }, { note: 'Eb1', glide: 'D1' }, { note: 'Ab1', glide: 'G1' }, { note: 'D1', glide: 'G1' }],
    nylonPool: ['Ab3', 'G3', 'B3', 'C4', 'Eb4', 'D4', 'F#3', 'G3'], surdoNotes: ['G2', 'Ab2', 'D2', 'G2']
  },
  {
    id: 'mirante_do_vale', name: 'IV. Neblina no Mirante & Ecos do Vale', title: 'IV. Neblina no Mirante & Ecos do Vale',
    startSec: 360, endSec: 480, tension: 0.48, nylonDensity: 0.68,
    chords: [['Eb2', 'Bb2', 'Db3', 'G3'], ['Ab1', 'Eb2', 'G2', 'C3'], ['G2', 'Bb2', 'D3', 'F3'], ['D2', 'F#2', 'C3', 'Eb3']],
    subSteps: [{ note: 'Eb1', glide: 'Ab1' }, { note: 'Ab1', glide: 'G1' }, { note: 'G1', glide: 'D1' }, { note: 'D1', glide: 'G1' }],
    nylonPool: ['D4', 'Eb4', 'C4', 'Bb3', 'Ab3', 'G3', 'F3', 'G3'], surdoNotes: ['D2', 'G2', 'C2', 'D2']
  },
  {
    id: 'ronda_da_madrugada', name: 'V. Ronda Silenciosa & Retorno às Vielas', title: 'V. Ronda Silenciosa & Retorno às Vielas',
    startSec: 480, endSec: 600, tension: 0.32, nylonDensity: 0.54,
    chords: [['G2', 'Bb2', 'D3', 'G3'], ['Ab1', 'Eb2', 'G2', 'Bb2'], ['D2', 'A2', 'C3', 'Eb3'], ['G1', 'D2', 'G2', 'Bb2']],
    subSteps: [{ note: 'D1', glide: 'G1' }, { note: 'Ab1', glide: 'G1' }, { note: 'G1', glide: 'G1' }, { note: 'D1', glide: 'G1' }],
    nylonPool: ['G3', 'Ab3', 'D3', 'G3', 'Bb3', 'Ab3', 'F#3', 'G3'], surdoNotes: ['G2', 'D2', 'G2', 'D2']
  }
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const FAVELA_CDD_AMBIENCE = {
  id: 'favela_cdd_cv',
  title: 'Complexo da CDD — Becos na Neblina & Domínio Escarlate',
  durationSec: 600,
  baseGain: 0.86,
  movements: MOVEMENTS,

  scheduleWindow({ cursorSec = 0, windowDurSec = 0.25, rig, targetNode, startTime = 0, contextState } = {}) {
    if (!rig) return 0;

    const { movement, index: mvIdx, localProgress } = resolveMovementAt(MOVEMENTS, cursorSec, 600);
    const mv = movement || MOVEMENTS[0];
    const extraAlert = clamp(Number(contextState?.combatTension || 0) * 0.12, 0, 0.12);
    const tension = clamp(mv.tension + Math.sin(localProgress * Math.PI) * 0.12 + extraAlert, 0.25, 0.95);
    let scheduled = 0;

    // 1. Pad denso de tensão territorial (14.5s) — Gm -> Abmaj7 -> Eb7 -> D7b9
    const padTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 14.5, 0.2);
    if (padTrig.hit) {
      const chord = mv.chords[Math.abs(padTrig.stepIndex) % mv.chords.length];
      const baseCut = clamp(210 + tension * 190, 195, 430);
      playDarkPadChord(rig, {
        notes: chord, time: startTime + padTrig.delaySec, dest: targetNode,
        duration: 15.6, attack: 4.1, release: 5.2,
        cutoff: baseCut, cutoffPeak: clamp(baseCut + 135 + tension * 95, 310, 670),
        detuneCents: 6.5 + tension * 3.5, gain: clamp(0.025 + tension * 0.016, 0.018, 0.044),
        pan: (seededRand(padTrig.stepIndex * 3.17 + mvIdx) - 0.5) * 0.34, reverb: 0.80, delay: 0.22
      });
      scheduled++;
    }

    // 2. Sub-grave 808 escuro e arrastado nos becos (19.5s)
    const subTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 19.5, 1.8);
    if (subTrig.hit) {
      const subStep = mv.subSteps[Math.abs(subTrig.stepIndex) % mv.subSteps.length];
      playSubDrone(rig, {
        note: subStep.note, glideToNote: subStep.glide !== subStep.note ? subStep.glide : undefined,
        time: startTime + subTrig.delaySec, dest: targetNode,
        duration: 16.8, attack: 3.4, release: 4.8,
        cutoff: clamp(190 + tension * 36, 190, 230),
        fifth: mvIdx === 2 && Math.abs(subTrig.stepIndex) % 2 === 0,
        gain: clamp(0.032 + tension * 0.016, 0.024, 0.050), reverb: 0.32
      });
      scheduled++;
    }

    // 3. Ecos percussivos graves abafados pelas paredes do morro / surdo distante (8.2s)
    const surdoTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 8.2, 3.1);
    if (surdoTrig.hit) {
      const sIdx = Math.abs(surdoTrig.stepIndex);
      const surdoNote = mv.surdoNotes[sIdx % mv.surdoNotes.length];
      const baseTime = startTime + surdoTrig.delaySec;
      const pan = (seededRand(sIdx * 7.13 + 2.1) - 0.5) * 0.56;
      const hitGain = clamp(0.015 + tension * 0.010, 0.014, 0.027);

      playMetallicEchoPing(rig, {
        note: surdoNote, ratios: [1.0, 1.34, 1.79], pitchDrop: 0.62,
        cutoff: clamp(320 + tension * 65, 290, 395), duration: 3.9, attack: 0.032,
        gain: hitGain, pan, reverb: 0.92, delay: 0.56, time: baseTime, dest: targetNode
      });
      scheduled++;

      if (tension > 0.52 && seededRand(sIdx * 11.9 + mvIdx) > 0.58) {
        playMetallicEchoPing(rig, {
          note: surdoNote === 'G2' ? 'D2' : 'G2', ratios: [1.0, 1.42], pitchDrop: 0.62,
          cutoff: 340, duration: 3.2, attack: 0.038,
          gain: clamp(hitGain * 0.78, 0.014, 0.021), pan: -pan * 0.7,
          reverb: 0.94, delay: 0.60, time: baseTime + 0.46, dest: targetNode
        });
        scheduled++;
      }
    }

    // 4. Dedilhados esparsos e tensos de violão nylon escuro em G Phrygian (5.4s)
    const nylonTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 5.4, 2.0);
    if (nylonTrig.hit) {
      const nIdx = Math.abs(nylonTrig.stepIndex);
      if (seededRand(nIdx * 5.71 + mvIdx * 19.3) <= mv.nylonDensity) {
        const pick = Math.floor(seededRand(nIdx * 13.37 + 4.7) * mv.nylonPool.length) % mv.nylonPool.length;
        const note = mv.nylonPool[pick];
        const tNylon = startTime + nylonTrig.delaySec;
        const pan = (seededRand(nIdx * 9.41) - 0.5) * 0.48;

        playNoirFeltNote(rig, {
          note, tone: 'nylon', time: tNylon, dest: targetNode, duration: 4.4,
          cutoff: clamp(440 + tension * 210, 410, 665),
          gain: clamp(0.016 + tension * 0.011, 0.014, 0.028),
          pan, reverb: 0.82, delay: 0.46
        });
        scheduled++;

        if (seededRand(nIdx * 17.23 + 1.9) > 0.66) {
          playNoirFeltNote(rig, {
            note: note.startsWith('G') ? 'Ab3' : note.startsWith('Ab') ? 'G3' : 'D3',
            tone: 'nylon', time: tNylon + 0.64, dest: targetNode, duration: 3.8,
            cutoff: clamp(400 + tension * 170, 380, 590),
            gain: clamp(0.014 + tension * 0.007, 0.014, 0.022),
            pan: -pan * 0.6, reverb: 0.85, delay: 0.50
          });
          scheduled++;
        }
      }
    }

    // 5. Vento nas lajes/fiação alta & lamento grave estilo Sicario (26s)
    const windTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 26.0, 5.5);
    if (windTrig.hit) {
      const wIdx = Math.abs(windTrig.stepIndex);
      playAtmosphericNoiseSwell(rig, {
        color: wIdx % 2 === 0 ? 'brown' : 'pink', filterType: 'bandpass', q: 1.55,
        freqStart: clamp(195 + mvIdx * 14, 190, 275),
        freqEnd: clamp(330 + tension * 210, 310, 560),
        duration: 14.2, attack: 4.2, gain: clamp(0.015 + tension * 0.010, 0.014, 0.026),
        pan: (seededRand(wIdx * 4.83) - 0.5) * 0.62, reverb: 0.68, delay: 0.18,
        seed: wIdx * 3.91 + mvIdx, time: startTime + windTrig.delaySec, dest: targetNode
      });
      scheduled++;
    }

    const hornTrig = checkPeriodicTrigger(cursorSec, windowDurSec, 26.0, 17.5);
    if (hornTrig.hit && tension >= 0.42) {
      const hIdx = Math.abs(hornTrig.stepIndex);
      const fromAb = hIdx % 2 === 0;
      playBowedMetalOrHorn(rig, {
        note: fromAb ? 'Ab1' : 'Eb2', endNote: fromAb ? 'G1' : 'D2',
        duration: 9.6, attack: 3.1, cutoff: clamp(235 + tension * 185, 220, 440), q: 2.4,
        gain: clamp(0.016 + tension * 0.012, 0.014, 0.029),
        pan: (seededRand(hIdx * 6.31) - 0.5) * 0.4, reverb: 0.89, delay: 0.32,
        time: startTime + hornTrig.delaySec, dest: targetNode
      });
      scheduled++;
    }

    return scheduled;
  }
};

export default FAVELA_CDD_AMBIENCE;
