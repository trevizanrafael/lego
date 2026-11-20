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

function attachHeroHeadgear(minifig, headgearKey) {
  if (headgearKey === 'beret') {
    attachCaveiraBeretHeadgear(minifig);
  } else if (headgearKey === 'visor_crown') {
    attachSolarisCrownHeadgear(minifig);
  } else if (headgearKey === 'mecha_helmet') {
    attachTitaMechaHelmet(minifig);
  } else if (headgearKey === 'tactical_bandana') {
    attachVingadorBandanaHeadgear(minifig);
  } else if (headgearKey === 'ninja_hood') {
    attachSombraHoodHeadgear(minifig);
  } else if (headgearKey === 'ghost_flame_skull') {
    attachTurboSkullHeadgear(minifig);
  } else if (headgearKey === 'tesla_crown') {
    attachVoltaicoCrownHeadgear(minifig);
  } else if (headgearKey === 'symbiote_crest') {
    attachVortexSymbioteHeadgear(minifig);
  }
}

export const baseRigMethods = {
  buildModel(presetInput) {
    const preset = resolveHeroPreset(presetInput);
    if (this.isStealth) {
      this.setStealthVisual(false);
    }
    while (this.visualRoot.children.length > 0) {
      const oldChild = this.visualRoot.children[0];
      this.visualRoot.remove(oldChild);
      disposeTransientObject3D(oldChild);
    }
    resetMinifigBuildRefs(this);
    applyPresetVisualScale(this.visualRoot, preset);

    const headMat = getLegoMaterial(preset.headColor, { roughness: 0.2, clearcoat: 0.5 });
    const torsoMat = getLegoMaterial(preset.torsoColor, { roughness: 0.24, clearcoat: 0.45 });
    const armMat = getLegoMaterial(preset.armColor, { roughness: 0.24, clearcoat: 0.45 });
    const handMat = getLegoMaterial(preset.handColor, { roughness: 0.22, clearcoat: 0.45 });
    const hipMat = getLegoMaterial(preset.hipColor, { roughness: 0.26, clearcoat: 0.4 });
    const legMat = getLegoMaterial(preset.legColor, { roughness: 0.25, clearcoat: 0.42 });

    // ==========================================
    // 1. QUADRIL / PELVE & PERNAS ARTICULADAS
    // ==========================================
    this.hipGroup = new THREE.Group();
    this.hipGroup.position.set(0, 0.72, 0);
    this.visualRoot.add(this.hipGroup);

    const waistMesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 0.42), hipMat);
    waistMesh.position.set(0, 0.07, 0);
    waistMesh.castShadow = true;
    waistMesh.receiveShadow = true;
    this.hipGroup.add(waistMesh);

    const crotchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.4), hipMat);
    crotchMesh.position.set(0, -0.06, 0);
    crotchMesh.castShadow = true;
    this.hipGroup.add(crotchMesh);

    this.leftLegPivot = this._createLeg(legMat);
    this.leftLegPivot.position.set(0.21, 0, 0);
    this.hipGroup.add(this.leftLegPivot);

    this.rightLegPivot = this._createLeg(legMat);
    this.rightLegPivot.position.set(-0.21, 0, 0);
    this.hipGroup.add(this.rightLegPivot);

    // ==========================================
    // 2. TRONCO TRAPEZOIDAL (UPPER BODY)
    // ==========================================
    this.upperBodyGroup = new THREE.Group();
    this.upperBodyGroup.position.set(0, 0.86, 0);
    this.visualRoot.add(this.upperBodyGroup);

    const torsoGeo = createTrapezoidTorsoGeometry(0.78, 0.94, 0.76, 0.44);
    this.torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
    this.torsoMesh.position.set(0, 0.38, 0);
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.upperBodyGroup.add(this.torsoMesh);

    const torsoTex =
      preset.key === 'op09'
        ? createCustomTorsoTexture(preset.customCfg)
        : createMinifigTorsoTexture(preset.torsoPreset);
    const chestDecalGeo = createTrapezoidTorsoGeometry(0.74, 0.88, 0.72, 0.01);
    const chestDecalMat = getLegoMaterial(0xffffff, {
      map: torsoTex,
      roughness: 0.22,
      clearcoat: 0.45
    });
    const chestDecal = new THREE.Mesh(chestDecalGeo, chestDecalMat);
    chestDecal.position.set(0, 0.38, 0.221);
    this.upperBodyGroup.add(chestDecal);

    if (preset.capeColor) {
      const capeMat = getLegoMaterial(preset.capeColor, {
        roughness: 0.35,
        clearcoat: 0.2,
        emissive: 0xea580c,
        emissiveIntensity: 0.22
      });
      const capeGeo = createTrapezoidTorsoGeometry(1.08, 0.76, 1.18, 0.03);
      this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
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
    }

    if (preset.fireAura) {
      this._buildSolarAuraParticles(preset.key);
    }

    // ==========================================
    // 4. PESCOÇO, CABEÇA CILÍNDRICA & PINO LEGO
    // ==========================================
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.76, 0);
    this.upperBodyGroup.add(this.headGroup);

    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.1, 20),
      headMat
    );
    neckMesh.position.set(0, 0.04, 0);
    neckMesh.castShadow = true;
    this.headGroup.add(neckMesh);

    const headHeight = 0.52;
    const headRadius = 0.35;
    const headCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(headRadius, headRadius, headHeight, 32),
      headMat
    );
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

    const faceTex =
      preset.key === 'op09'
        ? createCustomFaceTexture(preset.customCfg)
        : createMinifigFaceTexture(preset.facePreset);
    const faceMat = new THREE.MeshPhysicalMaterial({
      map: faceTex,
      roughness: 0.2,
      clearcoat: 0.45
    });
    const faceShellGeo = new THREE.CylinderGeometry(
      headRadius + 0.003,
      headRadius + 0.003,
      headHeight * 0.9,
      32,
      1,
      true,
      -Math.PI * 0.45,
      Math.PI * 0.9
    );
    const faceShell = new THREE.Mesh(faceShellGeo, faceMat);
    faceShell.position.set(0, 0.33, 0);
    this.headGroup.add(faceShell);

    const headStud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.13, 24),
      headMat
    );
    headStud.position.set(0, 0.33 + headHeight * 0.5 + 0.065, 0);
    headStud.castShadow = true;
    headStud.receiveShadow = true;
    this.headGroup.add(headStud);

    if (preset.key === 'op09') {
      attachOp09CustomRigToMinifigure(this, preset.customCfg);
    }

    attachHeroHeadgear(this, preset.headgear);
  },

  _createLeg(legMat) {
    const pivot = new THREE.Group();

    const hipRoll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.35, 18),
      legMat
    );
    hipRoll.rotation.z = Math.PI / 2;
    hipRoll.castShadow = true;
    pivot.add(hipRoll);

    const legShaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.54, 0.38),
      legMat
    );
    legShaft.position.set(0, -0.31, 0);
    legShaft.castShadow = true;
    legShaft.receiveShadow = true;
    pivot.add(legShaft);

    const footMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.16, 0.52),
      legMat
    );
    footMesh.position.set(0, -0.64, 0.07);
    footMesh.castShadow = true;
    footMesh.receiveShadow = true;
    pivot.add(footMesh);

    return pivot;
  },

  _createArm(armMat, handMat, sideSign) {
    const shoulderPivot = new THREE.Group();

    const armBody = new THREE.Group();
    armBody.rotation.z = sideSign * 0.13;
    shoulderPivot.add(armBody);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), armMat);
    shoulderCap.castShadow = true;
    armBody.add(shoulderCap);

    const upperArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.12, 0.34, 18),
      armMat
    );
    upperArm.position.set(0, -0.17, 0);
    upperArm.castShadow = true;
    armBody.add(upperArm);

    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.32, 0);
    forearmGroup.rotation.x = -0.22;
    armBody.add(forearmGroup);

    const forearm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.11, 0.24, 18),
      armMat
    );
    forearm.position.set(0, -0.11, 0);
    forearm.castShadow = true;
    forearmGroup.add(forearm);

    const wrist = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.1, 14),
      handMat
    );
    wrist.position.set(0, -0.25, 0);
    forearmGroup.add(wrist);

    const clawGeo = new THREE.TorusGeometry(0.095, 0.042, 12, 20, Math.PI * 1.48);
    const clawMesh = new THREE.Mesh(clawGeo, handMat);
    clawMesh.position.set(0, -0.34, 0.02);
    clawMesh.rotation.y = Math.PI / 2;
    clawMesh.rotation.z = -Math.PI * 0.65;
    clawMesh.castShadow = true;
    forearmGroup.add(clawMesh);

    return { shoulderPivot, forearmGroup };
  }
};
