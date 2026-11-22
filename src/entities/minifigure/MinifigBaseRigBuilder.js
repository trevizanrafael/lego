import * as THREE from 'three';
import {
  getLegoMaterial,
  createMinifigFaceTexture,
  createMinifigTorsoTexture,
  disposeTransientObject3D
} from '../../materials/LegoMaterials.js';
import {
  createCustomFaceTexture,
  createCustomTorsoTexture,
  attachOp09CustomRigToMinifigure
} from '../CustomHeroSystem.js';
import {
  MINIFIG_PRESETS,
  resolveHeroPreset,
  applyPresetVisualScale,
  resetMinifigBuildRefs
} from './HeroProfilesCatalog.js';
import { attachCaveiraBeretHeadgear } from './outfits/CaveiraBopeOutfit.js';
import { attachSolarisCrownHeadgear } from './outfits/SolarisSunKingOutfit.js';
import { attachTitaMechaHelmet } from './BigFigRigBuilder.js';
import { attachVingadorBandanaHeadgear } from './outfits/VingadorPunisherOutfit.js';
import { attachSombraHoodHeadgear } from './outfits/SombraShinobiOutfit.js';
import { attachTurboSkullHeadgear } from './outfits/TurboGhostRiderOutfit.js';
import { attachVoltaicoCrownHeadgear } from './outfits/VoltaicoStormlordOutfit.js';
import { attachVortexSymbioteHeadgear } from './outfits/VortexSymbioteOutfit.js';
import { attachCvMarretaoHeadgear } from './outfits/CvMarretaoOutfit.js';
import { attachCvFogueteiraHeadgear } from './outfits/CvFogueteiraOutfit.js';
import { attachPccContadorHeadgear } from './outfits/PccContadorOutfit.js';
import { attachPccMuralhaHeadgear } from './outfits/PccMuralhaOutfit.js';
import { attachAresBastiaoHeadgear } from './outfits/AresBastiaoOutfit.js';
import { attachAresAgulhaHeadgear } from './outfits/AresAgulhaOutfit.js';

/**
 * Cria a geometria trapezoidal clássica do tronco de uma Minifigura LEGO
 */
export function createTrapezoidTorsoGeometry(
  bottomWidth = 0.78,
  topWidth = 0.94,
  height = 0.76,
  depth = 0.44
) {
  const geom = new THREE.BoxGeometry(1, height, depth, 1, 1, 1);
  const pos = geom.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const isTop = y > 0;
    const halfW = (isTop ? topWidth : bottomWidth) * 0.5;
    pos.setX(i, x > 0 ? halfW : -halfW);
  }

  geom.computeVertexNormals();
  return geom;
}

const HEADGEAR_BUILDERS = {
  beret: attachCaveiraBeretHeadgear,
  visor_crown: attachSolarisCrownHeadgear,
  mecha_helmet: attachTitaMechaHelmet,
  tactical_bandana: attachVingadorBandanaHeadgear,
  ninja_hood: attachSombraHoodHeadgear,
  ghost_flame_skull: attachTurboSkullHeadgear,
  tesla_crown: attachVoltaicoCrownHeadgear,
  symbiote_crest: attachVortexSymbioteHeadgear,
  cv_marretao_cap: attachCvMarretaoHeadgear,
  cv_fogueteira_visor: attachCvFogueteiraHeadgear,
  pcc_contador_balaclava: attachPccContadorHeadgear,
  pcc_muralha_helmet: attachPccMuralhaHeadgear,
  ares_bastiao_helmet: attachAresBastiaoHeadgear,
  ares_agulha_visor: attachAresAgulhaHeadgear,
  boss_cv_crown: (m) => attachSecretBossHeadgear(m, 'boss_cv_crown'),
  boss_pcc_mask: (m) => attachSecretBossHeadgear(m, 'boss_pcc_mask'),
  boss_ares_helm: (m) => attachSecretBossHeadgear(m, 'boss_ares_helm')
};

function attachSecretBossHeadgear(minifig, headgearKey) {
  const hg = new THREE.Group();
  if (headgearKey === 'boss_cv_crown') {
    const crimson = getLegoMaterial(0x7f1d1d, { roughness: 0.34, clearcoat: 0.35 });
    const obsidian = getLegoMaterial(0x090a0d, { roughness: 0.3, metalness: 0.45 });
    const bronze = getLegoMaterial(0xd97706, { roughness: 0.22, metalness: 0.72, emissive: 0x991b1b, emissiveIntensity: 0.4 });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.37, 0.16, 20), crimson);
    crown.position.set(-0.03, 0.61, 0);
    crown.rotation.z = -0.14;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.375, 0.375, 0.08, 20), obsidian);
    band.position.set(0, 0.54, 0);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.06), bronze);
    crest.position.set(0, 0.58, 0.37);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.14), obsidian);
    visor.position.set(0, 0.36, 0.31);
    hg.add(crown, band, crest, visor);
  } else if (headgearKey === 'boss_pcc_mask') {
    const suitBlack = getLegoMaterial(0x070b14, { roughness: 0.28, metalness: 0.5 });
    const cobalt = getLegoMaterial(0x1d4ed8, { roughness: 0.2, emissive: 0x2563eb, emissiveIntensity: 1.5 });
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.38, 0.52, 20), suitBlack);
    shell.position.set(0, 0.36, 0);
    const faceplate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.16), suitBlack);
    faceplate.position.set(0, 0.33, 0.31);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.06), cobalt);
    visor.position.set(0, 0.38, 0.39);
    hg.add(shell, faceplate, visor);
  } else if (headgearKey === 'boss_ares_helm') {
    const steel = getLegoMaterial(0x1e2436, { roughness: 0.24, metalness: 0.68 });
    const neonPurple = getLegoMaterial(0x9333ea, { roughness: 0.15, emissive: 0xa855f7, emissiveIntensity: 2.0 });
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.44, 0.52, 16), steel);
    helm.position.set(0, 0.39, 0);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.12, 0.14), neonPurple);
    visor.position.set(0, 0.37, 0.37);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.16), neonPurple);
      horn.position.set(s * 0.38, 0.64, -0.02);
      horn.rotation.z = -s * 0.28;
      hg.add(horn);
    }
    hg.add(helm, visor);
  }
  minifig.headGroup.add(hg);
}

function attachSecretBossArmorRig(minifig, preset) {
  const key = preset.key;
  if (key !== 'boss_cv' && key !== 'boss_pcc' && key !== 'boss_ares') return;
  const cfg = key === 'boss_cv'
    ? { main: 0x7f1d1d, trim: 0x090a0d, glow: 0xdc2626 }
    : key === 'boss_pcc'
      ? { main: 0x070b14, trim: 0x1d4ed8, glow: 0x38bdf8 }
      : { main: 0x1e2436, trim: 0x9333ea, glow: 0xa855f7 };
  const mainMat = getLegoMaterial(cfg.main, { roughness: 0.28, metalness: 0.52 });
  const trimMat = getLegoMaterial(cfg.trim, { roughness: 0.22, metalness: 0.45 });
  const glowMat = getLegoMaterial(cfg.glow, { roughness: 0.16, emissive: cfg.glow, emissiveIntensity: 1.7 });

  for (const [pivot, s] of [[minifig.leftArmPivot, 1], [minifig.rightArmPivot, -1]]) {
    if (!pivot) continue;
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.48), mainMat);
    pauldron.position.set(s * 0.08, 0.09, 0);
    pauldron.rotation.z = -s * 0.24;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.5), key === 'boss_cv' ? trimMat : glowMat);
    edge.position.set(s * 0.09, 0.17, 0);
    edge.rotation.z = -s * 0.24;
    pivot.add(pauldron, edge);
  }
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.09), glowMat);
  core.position.set(0, 0.46, 0.25);
  minifig.upperBodyGroup.add(core);
  if (key === 'boss_cv' && minifig.capeMesh) {
    minifig.capeMesh.material = getLegoMaterial(0x140708, { roughness: 0.42, emissive: 0x7f1d1d, emissiveIntensity: 0.18 });
  } else if (key === 'boss_ares') {
    minifig.leftArmPivot.position.x = 0.62;
    minifig.rightArmPivot.position.x = -0.62;
    for (const s of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.24), mainMat);
      pod.position.set(s * 0.34, 0.72, -0.24);
      minifig.upperBodyGroup.add(pod);
    }
  }
}

function attachHeroHeadgear(minifig, headgearKey) {
  HEADGEAR_BUILDERS[headgearKey]?.(minifig);
}

const NON_RIG_INSTANCE_KEYS = new Set([
  'root', 'visualRoot', '_rigCache', '_activeRigCacheKey',
  'animTime', 'walkPhase', 'state', 'landingSquash', 'wasGrounded',
  'punchTimer', 'punchDuration', 'punchComboStep', 'combatStanceTimer',
  'shootTimer', 'muzzleFlashTimer', 'rollTimer', 'rollDuration',
  'stompTimer', 'stompDuration', 'titaJumpChargeRatio',
  'isBeaming', 'isDashing', 'isCarryingCar', 'isGrappling',
  'isStealth', 'isDiveSliding', 'isBigFig', 'currentHeroKey', 'preset',
  'vingadorWeapon', 'vingadorDualRecoilSide', 'vingadorFurorActive',
  '_emoteIndex', 'activeEmote', 'emoteTimer',
  '_emoteAuraGroup', '_emoteAuraMat', '_emoteAuraRing', '_emoteAuraSparks', '_baseUpperY'
]);

export function getHeroRigCacheKey(preset) {
  const key = preset?.key || 'caveira';
  const isBig = Boolean(preset?.isBigFig);
  if (key === 'op09') {
    return `op09|${isBig}|${JSON.stringify(preset.customCfg ?? null)}`;
  }
  if (preset === MINIFIG_PRESETS[key]) {
    return `${key}|${isBig}`;
  }
  return `${key}|${isBig}|${preset.headColor ?? ''}|${preset.torsoColor ?? ''}|${preset.armColor ?? ''}|${preset.handColor ?? ''}|${preset.hipColor ?? ''}|${preset.legColor ?? ''}|${preset.facePreset ?? ''}|${preset.torsoPreset ?? ''}|${preset.headgear ?? ''}|${preset.capeColor ?? ''}|${preset.weapon ?? ''}|${Boolean(preset.fireAura)}`;
}

function captureRigSnapshot(minifig) {
  const snapshot = Object.create(null);
  const keys = Object.keys(minifig);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!NON_RIG_INSTANCE_KEYS.has(k)) snapshot[k] = minifig[k];
  }
  return snapshot;
}

function restoreRigSnapshot(minifig, snapshot) {
  resetMinifigBuildRefs(minifig);
  const currentKeys = Object.keys(minifig);
  for (let i = 0; i < currentKeys.length; i++) {
    const k = currentKeys[i];
    if (!NON_RIG_INSTANCE_KEYS.has(k) && !(k in snapshot)) minifig[k] = null;
  }
  for (const k in snapshot) minifig[k] = snapshot[k];
}

function cleanupOutgoingRigEffects(minifig) {
  if (minifig.isStealth && minifig.setStealthVisual) minifig.setStealthVisual(false);
  if (minifig.vingadorFurorActive && minifig.setVingadorFurorVisual) {
    minifig.setVingadorFurorVisual(false);
  }
  if (minifig.activeEmote && minifig.stopEmote) minifig.stopEmote();
}

function evictStaleOp09RigCache(minifig, keepCacheKey) {
  if (!minifig._rigCache) return;
  for (const [k, entry] of minifig._rigCache.entries()) {
    if (k.startsWith('op09|') && k !== keepCacheKey) {
      if (entry.visualRoot?.parent === minifig.root) minifig.root.remove(entry.visualRoot);
      if (entry.visualRoot) disposeTransientObject3D(entry.visualRoot);
      minifig._rigCache.delete(k);
    }
  }
}

export function resetActiveRigTransientState(minifig, preset) {
  minifig.punchTimer = 0;
  minifig.shootTimer = 0;
  minifig.muzzleFlashTimer = 0;
  minifig.rollTimer = 0;
  minifig.stompTimer = 0;
  minifig.combatStanceTimer = 0;
  minifig.titaJumpChargeRatio = 0;
  minifig.isBeaming = false;
  minifig.isDashing = false;
  minifig.isStealth = false;
  minifig.vingadorFurorActive = false;
  minifig.isDiveSliding = false;

  minifig.visualRoot.position.set(0, 0, 0);
  minifig.visualRoot.rotation.set(0, 0, 0);
  applyPresetVisualScale(minifig.visualRoot, preset);

  if (minifig.hipGroup) {
    minifig.hipGroup.position.set(0, 0.72, 0);
    minifig.hipGroup.rotation.set(0, 0, 0);
  }
  if (minifig.upperBodyGroup) {
    minifig.upperBodyGroup.position.set(0, 0.86, 0);
    minifig.upperBodyGroup.rotation.set(0, 0, 0);
  }
  if (minifig.headGroup) {
    minifig.headGroup.position.set(0, 0.76, 0);
    minifig.headGroup.rotation.set(0, 0, 0);
  }
  const shoulderX = minifig.isBigFig ? 0.62 : 0.49;
  if (minifig.leftArmPivot) {
    minifig.leftArmPivot.position.set(shoulderX, 0.66, 0);
    minifig.leftArmPivot.rotation.set(0, 0, 0);
  }
  if (minifig.rightArmPivot) {
    minifig.rightArmPivot.position.set(-shoulderX, 0.66, 0);
    minifig.rightArmPivot.rotation.set(0, 0, 0);
  }
  if (minifig.leftHandGroup) {
    minifig.leftHandGroup.position.set(0, -0.32, 0);
    minifig.leftHandGroup.rotation.set(-0.22, 0, 0);
  }
  if (minifig.rightHandGroup) {
    minifig.rightHandGroup.position.set(0, -0.32, 0);
    minifig.rightHandGroup.rotation.set(-0.22, 0, 0);
  }
  if (minifig.leftLegPivot) {
    minifig.leftLegPivot.position.set(0.21, 0, 0);
    minifig.leftLegPivot.rotation.set(0, 0, 0);
  }
  if (minifig.rightLegPivot) {
    minifig.rightLegPivot.position.set(-0.21, 0, 0);
    minifig.rightLegPivot.rotation.set(0, 0, 0);
  }
  if (minifig.rifleGroup) minifig.rifleGroup.visible = true;
  if (minifig.capeMesh) {
    minifig.capeMesh.visible = true;
    minifig.capeMesh.rotation.set(0.12, 0, 0);
  }
  if (minifig.solarMantleGroup) minifig.solarMantleGroup.visible = true;
  if (minifig.muzzleFlashMesh) minifig.muzzleFlashMesh.visible = false;
  if (minifig.leftMuzzleFlashMesh) minifig.leftMuzzleFlashMesh.visible = false;
  if (minifig.titaDashFlameMeshes) {
    for (let i = 0; i < minifig.titaDashFlameMeshes.length; i++) minifig.titaDashFlameMeshes[i].visible = false;
  }
  if (minifig.op09JetFlames) {
    for (let i = 0; i < minifig.op09JetFlames.length; i++) minifig.op09JetFlames[i].visible = false;
  }
  if (minifig.op09Hoverboard) minifig.op09Hoverboard.visible = false;

  if (preset.key === 'vingador') {
    minifig.setVingadorWeapon?.(minifig.vingadorWeapon || 'dual_smg');
    minifig.setVingadorFurorVisual?.(false);
  } else if (preset.key === 'vortex') {
    minifig.setVortexMonsterForm?.(Boolean(preset.isBigFig));
  }
}

export function applyCachedHeroPreset(minifig, presetKey) {
  const preset = resolveHeroPreset(presetKey);
  const cacheKey = getHeroRigCacheKey(preset);

  if (minifig._activeRigCacheKey === cacheKey && minifig._rigCache.has(cacheKey)) {
    cleanupOutgoingRigEffects(minifig);
    minifig.currentHeroKey = preset.key;
    minifig.preset = preset;
    minifig.isBigFig = Boolean(preset.isBigFig);
    resetActiveRigTransientState(minifig, preset);
    return preset;
  }

  cleanupOutgoingRigEffects(minifig);
  minifig.currentHeroKey = preset.key;
  minifig.preset = preset;
  minifig.isBigFig = Boolean(preset.isBigFig);

  const cached = minifig._rigCache.get(cacheKey);
  if (cached) {
    if (minifig.visualRoot && minifig.visualRoot !== cached.visualRoot) {
      minifig.root.remove(minifig.visualRoot);
    }
    minifig.visualRoot = cached.visualRoot;
    if (minifig.visualRoot.parent !== minifig.root) minifig.root.add(minifig.visualRoot);
    restoreRigSnapshot(minifig, cached.snapshot);
    minifig._activeRigCacheKey = cacheKey;
    resetActiveRigTransientState(minifig, preset);
    return preset;
  }

  if (preset.key === 'op09') evictStaleOp09RigCache(minifig, cacheKey);

  if (minifig._activeRigCacheKey !== null || minifig.visualRoot.children.length > 0) {
    if (minifig.visualRoot.parent === minifig.root) minifig.root.remove(minifig.visualRoot);
    minifig.visualRoot = new THREE.Group();
    minifig.root.add(minifig.visualRoot);
  }

  minifig.buildModel(preset);
  minifig._rigCache.set(cacheKey, {
    visualRoot: minifig.visualRoot,
    snapshot: captureRigSnapshot(minifig)
  });
  minifig._activeRigCacheKey = cacheKey;
  resetActiveRigTransientState(minifig, preset);
  return preset;
}

export const baseRigMethods = {
  buildModel(presetInput) {
    const preset = resolveHeroPreset(presetInput);
    if (this.isStealth) this.setStealthVisual(false);
    let isCachedVisualRoot = false;
    if (this._rigCache) {
      for (const entry of this._rigCache.values()) {
        if (entry.visualRoot === this.visualRoot) {
          isCachedVisualRoot = true;
          break;
        }
      }
    }
    if (isCachedVisualRoot) {
      this.root.remove(this.visualRoot);
      this.visualRoot = new THREE.Group();
      this.root.add(this.visualRoot);
    } else {
      while (this.visualRoot.children.length > 0) {
        const oldChild = this.visualRoot.children[0];
        this.visualRoot.remove(oldChild);
        disposeTransientObject3D(oldChild);
      }
    }
    resetMinifigBuildRefs(this);
    applyPresetVisualScale(this.visualRoot, preset);

    const headMat = getLegoMaterial(preset.headColor, { roughness: 0.2, clearcoat: 0.5 });
    const torsoMat = getLegoMaterial(preset.torsoColor, { roughness: 0.24, clearcoat: 0.45 });
    const armMat = getLegoMaterial(preset.armColor, { roughness: 0.24, clearcoat: 0.45 });
    const handMat = getLegoMaterial(preset.handColor, { roughness: 0.22, clearcoat: 0.45 });
    const hipMat = getLegoMaterial(preset.hipColor, { roughness: 0.26, clearcoat: 0.4 });
    const legMat = getLegoMaterial(preset.legColor, { roughness: 0.25, clearcoat: 0.42 });

    this.hipGroup = new THREE.Group();
    this.hipGroup.position.set(0, 0.72, 0);
    this.visualRoot.add(this.hipGroup);

    const waistMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.42), hipMat);
    waistMesh.position.set(0, 0.07, 0);
    waistMesh.castShadow = true;
    waistMesh.receiveShadow = true;
    const crotchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.4), hipMat);
    crotchMesh.position.set(0, -0.06, 0);
    crotchMesh.castShadow = true;
    this.leftLegPivot = this._createLeg(legMat);
    this.leftLegPivot.position.set(0.21, 0, 0);
    this.rightLegPivot = this._createLeg(legMat);
    this.rightLegPivot.position.set(-0.21, 0, 0);
    this.hipGroup.add(waistMesh, crotchMesh, this.leftLegPivot, this.rightLegPivot);

    this.upperBodyGroup = new THREE.Group();
    this.upperBodyGroup.position.set(0, 0.86, 0);
    this.visualRoot.add(this.upperBodyGroup);

    const torsoGeo = createTrapezoidTorsoGeometry(0.78, 0.94, 0.76, 0.44);
    this.torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    this.torsoMesh.position.set(0, 0.38, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    const torsoTex = preset.key === 'op09'
      ? createCustomTorsoTexture(preset.customCfg)
      : createMinifigTorsoTexture(preset.torsoPreset);
    const chestDecal = new THREE.Mesh(
      createTrapezoidTorsoGeometry(0.74, 0.88, 0.72, 0.01),
      getLegoMaterial(0xffffff, { map: torsoTex, roughness: 0.22, clearcoat: 0.45 })
    );
    chestDecal.position.set(0, 0.38, 0.221);
    this.upperBodyGroup.add(this.torsoMesh, chestDecal);

    if (preset.capeColor) {
      const capeMat = getLegoMaterial(preset.capeColor, {
        roughness: 0.35, clearcoat: 0.2, emissive: 0xea580c, emissiveIntensity: 0.22
      });
      this.capeMesh = new THREE.Mesh(createTrapezoidTorsoGeometry(1.08, 0.76, 1.18, 0.03), capeMat);
      this.capeMesh.position.set(0, 0.22, -0.25);
      this.capeMesh.rotation.x = 0.12;
      this.capeMesh.castShadow = true;
      this.upperBodyGroup.add(this.capeMesh);
    } else {
      this.capeMesh = null;
    }

    // ==========================================
    // 3. BRAÇOS, MÃOS E ARMAMENTO / PODER 3D
    // ==========================================
    const leftArmData = this._createArm(armMat, handMat, 1);
    this.leftArmPivot = leftArmData.shoulderPivot;
    this.leftHandGroup = leftArmData.forearmGroup;
    this.leftArmPivot.position.set(0.49, 0.66, 0);
    this.upperBodyGroup.add(this.leftArmPivot);

    const rightArmData = this._createArm(armMat, handMat, -1);
    this.rightArmPivot = rightArmData.shoulderPivot;
    this.rightHandGroup = rightArmData.forearmGroup;
    this.rightArmPivot.position.set(-0.49, 0.66, 0);
    this.upperBodyGroup.add(this.rightArmPivot);

    if (preset.weapon === 'rifle') {
      this._attachTacticalRifle(this.rightHandGroup);
      this._attachCaveiraBopeRig();
    } else if (preset.weapon === 'solar_orbs') {
      this._attachSolarOrbs(this.leftHandGroup, this.rightHandGroup);
      this._attachSolarisSunKingRig();
    } else if (preset.weapon === 'tita_rig') {
      this._attachTitaBigFigRig(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'vingador_arsenal') {
      this._attachVingadorArmorAndCoat(preset);
      this._attachVingadorArsenal(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'dual_katanas') {
      this._attachDualKatanas(this.leftHandGroup, this.rightHandGroup);
      this._attachSombraShinobiRig();
    } else if (preset.weapon === 'turbo_chains') {
      this._attachTurboGhostRiderRig(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'voltaico_staff') {
      this._attachVoltaicoTeslaRig(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'vortex_tentacles') {
      this._attachVortexSymbioteRig(this.leftHandGroup, this.rightHandGroup);
    } else if (preset.weapon === 'cv_lmg') {
      this._attachCvMarretaoRig();
    } else if (preset.weapon === 'cv_pistol') {
      this._attachCvFogueteiraRig();
    } else if (preset.weapon === 'pcc_dmr') {
      this._attachPccContadorRig();
    } else if (preset.weapon === 'pcc_shotgun12') {
      this._attachPccMuralhaRig();
    } else if (preset.weapon === 'ares_pulse_minigun') {
      this._attachAresBastiaoRig();
    } else if (preset.weapon === 'ares_charge_rifle') {
      this._attachAresAgulhaRig();
    } else if (preset.weapon === 'tita_minigun') {
      this._attachAresBastiaoRig();
      if (this.rifleGroup) {
        this.rifleGroup.scale.setScalar(1.26);
        this.titaCannonGroup = this.rifleGroup;
      }
      this.titaMinigunBarrelGroup = this.operatorBarrelCluster;
    }
    attachSecretBossArmorRig(this, preset);

    if (preset.fireAura) this._buildSolarAuraParticles(preset.key);

    // ==========================================
    // 4. PESCOÇO, CABEÇA CILÍNDRICA & PINO LEGO
    // ==========================================
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.76, 0);
    this.upperBodyGroup.add(this.headGroup);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 20), headMat);
    neckMesh.position.set(0, 0.04, 0);
    neckMesh.castShadow = true;
    this.headGroup.add(neckMesh);

    const headHeight = 0.52;
    const headRadius = 0.35;
    const headCylinder = new THREE.Mesh(new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 32), headMat);
    headCylinder.position.set(0, 0.33, 0);
    headCylinder.castShadow = true;
    headCylinder.receiveShadow = true;
    this.headGroup.add(headCylinder);

    const rimGeo = new THREE.TorusGeometry(headRadius - 0.03, 0.03, 12, 32);
    rimGeo.rotateX(Math.PI / 2);
    const topRim = new THREE.Mesh(rimGeo, headMat);
    topRim.position.set(0, 0.33 + headHeight * 0.5, 0);
    this.headGroup.add(topRim);

    const botRim = new THREE.Mesh(rimGeo, headMat);
    botRim.position.set(0, 0.33 - headHeight * 0.5, 0);
    this.headGroup.add(botRim);

    const faceTex = preset.key === 'op09'
      ? createCustomFaceTexture(preset.customCfg)
      : createMinifigFaceTexture(preset.facePreset);
    const faceMat = new THREE.MeshPhysicalMaterial({ map: faceTex, roughness: 0.2, clearcoat: 0.45 });
    const faceShellGeo = new THREE.CylinderGeometry(
      headRadius + 0.003, headRadius + 0.003, headHeight * 0.9, 32, 1, true, -Math.PI * 0.45, Math.PI * 0.9
    );
    const faceShell = new THREE.Mesh(faceShellGeo, faceMat);
    faceShell.position.set(0, 0.33, 0);
    this.headGroup.add(faceShell);

    const headStud = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.13, 24), headMat);
    headStud.position.set(0, 0.33 + headHeight * 0.5 + 0.065, 0);
    headStud.castShadow = true;
    headStud.receiveShadow = true;
    this.headGroup.add(headStud);

    if (preset.key === 'op09') attachOp09CustomRigToMinifigure(this, preset.customCfg);
    attachHeroHeadgear(this, preset.headgear);
  },

  _createLeg(legMat) {
    const pivot = new THREE.Group();
    const hipRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.35, 18), legMat);
    hipRoll.rotation.z = Math.PI / 2;
    hipRoll.castShadow = true;
    const legShaft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.54, 0.38), legMat);
    legShaft.position.set(0, -0.31, 0);
    legShaft.castShadow = true;
    legShaft.receiveShadow = true;
    const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.52), legMat);
    footMesh.position.set(0, -0.64, 0.07);
    footMesh.castShadow = true;
    footMesh.receiveShadow = true;
    pivot.add(hipRoll, legShaft, footMesh);
    return pivot;
  },

  _createArm(armMat, handMat, sideSign) {
    const shoulderPivot = new THREE.Group();
    const armBody = new THREE.Group();
    armBody.rotation.z = sideSign * 0.13;
    shoulderPivot.add(armBody);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), armMat);
    shoulderCap.castShadow = true;
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.34, 18), armMat);
    upperArm.position.set(0, -0.17, 0);
    upperArm.castShadow = true;
    armBody.add(shoulderCap, upperArm);

    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.32, 0);
    forearmGroup.rotation.x = -0.22;
    armBody.add(forearmGroup);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.24, 18), armMat);
    forearm.position.set(0, -0.11, 0);
    forearm.castShadow = true;
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 14), handMat);
    wrist.position.set(0, -0.25, 0);
    const clawMesh = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.042, 12, 20, Math.PI * 1.48), handMat);
    clawMesh.position.set(0, -0.34, 0.02);
    clawMesh.rotation.y = Math.PI / 2;
    clawMesh.rotation.z = -Math.PI * 0.65;
    clawMesh.castShadow = true;
    forearmGroup.add(forearm, wrist, clawMesh);
    return { shoulderPivot, forearmGroup };
  }
};
