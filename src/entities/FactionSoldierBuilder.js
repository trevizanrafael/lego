// ============================================================================
// FACHADA DE SOLDADOS DAS FACÇÕES (estilo "classes" táticas modulares)
// ----------------------------------------------------------------------------
// Orquestra os submódulos especializados em `src/entities/soldiers/`:
//   1. SoldierSharedRigAndWeapons.js — Esqueleto articulado, materiais/rostos
//      compartilhados, capacetes/balaclavas base e arsenal (fuzis, escopetas,
//      RPG, C4, escudos, rifles laser, mochila médica).
//   2. FactionClassKitsBuilder.js — Kits visuais exclusivos por facção
//      (CV, PCC, A.R.E.S., BOPE, PF, Segurança) e por classe.
//   3. BossAndAnimationHelpers.js — Armaduras/elmos de chefes e animação leve
//      por frame (`animateFactionSoldier`).
//
// Performance: cada combinação facção+classe é fundida uma única vez num
// blueprint em cache (`BLUEPRINTS`), instanciando apenas Meshes leves por NPC.
// ============================================================================

import {
  AIM_POSE,
  SOLDIER_ROLES,
  SOLDIER_CLASS_INFO,
  PALETTE,
  instantiateSoldierRig
} from './soldiers/SoldierSharedRigAndWeapons.js';
import { buildSoldierBlueprint } from './soldiers/FactionClassKitsBuilder.js';
import { animateFactionSoldier } from './soldiers/BossAndAnimationHelpers.js';

export {
  AIM_POSE,
  SOLDIER_ROLES,
  SOLDIER_CLASS_INFO,
  animateFactionSoldier
};

const BLUEPRINTS = new Map();

/**
 * Obtém (ou constrói sob demanda) o blueprint de geometrias fundidas
 * correspondente ao par `faction` + `role`.
 */
function getBlueprint(faction, role) {
  const key = `${faction}_${role}`;
  if (!BLUEPRINTS.has(key)) {
    BLUEPRINTS.set(key, buildSoldierBlueprint(faction, role));
  }
  return BLUEPRINTS.get(key);
}

/**
 * Cria a minifigura de combate articulada de uma facção e classe.
 * Preserva 100% da hierarquia 3D (`bodyRig`, `head`, `leftArm`, `rightArm`,
 * `leftLeg`, `rightLeg`, `weaponMount`, `muzzleFlash`, `drone`) e metadados
 * consumidos pelo `FactionWarSystem`.
 */
export function createFactionSoldierVisual(faction = 'cv', role = 'rifleman') {
  const safeFaction = PALETTE[faction] ? faction : 'cv';
  const safeRole = SOLDIER_ROLES.includes(role) ? role : 'rifleman';
  const bp = getBlueprint(safeFaction, safeRole);
  const className = SOLDIER_CLASS_INFO[safeFaction]?.[safeRole] || '';
  return instantiateSoldierRig(bp, className);
}
