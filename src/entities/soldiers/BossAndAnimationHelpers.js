import {
  plastic,
  metal,
  glow,
  addSlantedBeretBase
} from './SoldierSharedRigAndWeapons.js';

/**
 * Monta capacete/boina exclusiva dos chefes (CV, PCC, A.R.E.S.).
 * Retorna true quando a facção possui elmo dedicado de chefe; caso contrário
 * retorna false para reaproveitar o quepe/boina de oficial da corporação.
 */
export function applyBossHeadKit(H, faction, { p, mainMat, blackMat, accentMat, gold, headTopY }) {
  if (faction === 'cv') {
    addSlantedBeretBase(H, mainMat, headTopY);
    H.box(0.5, 0.08, 0.06, gold, [0, 0.33, 0.27]);
    H.box(0.18, 0.1, 0.05, blackMat, [-0.11, 0.31, 0.29]);
    H.box(0.18, 0.1, 0.05, blackMat, [0.11, 0.31, 0.29]);
    return true;
  }
  if (faction === 'pcc') {
    H.sphere(0.36, metal(0x1f2937), [0, 0.34, 0], [1, 0.95, 1], 16);
    H.box(0.52, 0.14, 0.1, glow(p.accent, 1.6), [0, 0.32, 0.3]);
    H.box(0.1, 0.18, 0.6, accentMat, [0, 0.66, 0]);
    return true;
  }
  if (faction === 'ares') {
    H.box(0.68, 0.62, 0.66, metal(0x334155), [0, 0.3, 0]);
    H.box(0.6, 0.12, 0.05, glow(p.accent, 2.4), [0, 0.32, 0.34]);
    H.box(0.08, 0.36, 0.08, glow(p.accent, 1.6), [-0.28, 0.72, 0], [0, 0, 0.35]);
    H.box(0.08, 0.36, 0.08, glow(p.accent, 1.6), [0.28, 0.72, 0], [0, 0, -0.35]);
    return true;
  }
  return false;
}

/**
 * Monta armadura corporal pesada de Chefão / Subchefe (ombreiras colossais,
 * correntes duplas e capa no CV, blindagem Z-15 no PCC, reator Overlord na A.R.E.S.).
 */
export function applyBossBodyKit(T, faction, { p, mainMat, accentMat, gold }) {
  const shoulderMat = faction === 'ares' ? metal(0x334155) : faction === 'pcc' ? metal(0x1f2937) : mainMat;
  for (const sx of [-1, 1]) {
    T.box(0.5, 0.36, 0.62, shoulderMat, [sx * 0.66, 1.58, 0], [0, 0, sx * -0.2]);
    T.stud(accentMat, [sx * 0.62, 1.78, 0.14]);
    T.stud(accentMat, [sx * 0.62, 1.78, -0.14]);
    if (faction === 'ares') {
      T.cyl(0.08, 0.08, 0.5, metal(0x475569), [sx * 0.66, 1.9, 0.12], [Math.PI / 2, 0, 0], 10);
      T.sphere(0.07, glow(p.accent, 2.4), [sx * 0.66, 1.9, 0.38]);
    }
  }
  if (faction === 'cv') {
    T.torus(0.26, 0.04, gold, [0, 1.38, 0.1], [Math.PI / 2 - 0.3, 0, 0], Math.PI * 2, 18);
    T.torus(0.32, 0.035, gold, [0, 1.3, 0.12], [Math.PI / 2 - 0.35, 0, 0], Math.PI * 2, 18);
    T.box(0.9, 1.1, 0.05, plastic(p.dark), [0, 1.02, -0.27], [-0.12, 0, 0]);
  } else if (faction === 'pcc') {
    T.box(0.94, 0.66, 0.14, metal(0x1f2937), [0, 1.18, 0.25]);
    T.box(0.5, 0.1, 0.15, glow(p.accent, 1.6), [0, 1.3, 0.26]);
  } else {
    T.cyl(0.2, 0.2, 0.08, glow(p.accent, 2.6), [0, 1.22, 0.24], [Math.PI / 2, 0, 0], 16);
    T.box(0.6, 0.7, 0.3, metal(0x475569), [0, 1.2, -0.38]);
    T.box(0.12, 0.6, 0.06, glow(p.accent, 1.8), [0, 1.2, -0.54]);
  }
}

/**
 * Animação leve por frame (respiração, cabeça olhando, drone flutuando, arma em guarda).
 * Chamado pelo FactionWarSystem depois da movimentação.
 */
export function animateFactionSoldier(visual, clock, phaseOffset = 0) {
  if (!visual) return;
  const t = clock + phaseOffset;
  if (visual.head) {
    visual.head.rotation.y = Math.sin(t * 0.7) * 0.25;
  }
  if (visual.drone) {
    visual.drone.position.y = 2.7 + Math.sin(t * 2.4) * 0.15;
    visual.drone.rotation.y += 0.02;
  }
}
