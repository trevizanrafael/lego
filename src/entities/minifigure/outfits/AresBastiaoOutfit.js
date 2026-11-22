import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói o Capacete Cibernético Angular em Titânio + Visor V Roxo-Neon (`ares_bastiao_helmet`)
 * para o operador cibernético Bastião (A.R.E.S. — escala padrão Minifigura, não Big-Fig).
 */
export function attachAresBastiaoHeadgear(minifig) {
  const headGear = new THREE.Group();
  const titaniumMat = getLegoMaterial(0x475569, { roughness: 0.24, metalness: 0.72, clearcoat: 0.35 });
  const darkTitanium = getLegoMaterial(0x334155, { roughness: 0.28, metalness: 0.65 });
  const obsidianMat = getLegoMaterial(0x090712, { roughness: 0.32, clearcoat: 0.28 });
  const neonPurple = getLegoMaterial(0xa855f7, {
    emissive: 0x9333ea,
    emissiveIntensity: 2.3,
    roughness: 0.12
  });

  // Casco cibernético facetado em titânio sobre obsidiana
  const helmBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.388, 0.398, 0.25, 8),
    obsidianMat
  );
  helmBase.position.set(0, 0.54, 0);
  const helmCrown = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.64), titaniumMat);
  helmCrown.position.set(0, 0.67, 0);
  helmCrown.castShadow = true;
  const topCrest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.68), darkTitanium);
  topCrest.position.set(0, 0.76, 0.02);
  headGear.add(helmBase, helmCrown, topCrest);

  // Placas mandibulares frontais e antenas telemétricas laterais
  for (const side of [-1, 1]) {
    const jawPlate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.34), titaniumMat);
    jawPlate.position.set(side * 0.26, 0.22, 0.14);
    jawPlate.rotation.y = -side * 0.24;

    const sidePod = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.26), darkTitanium);
    sidePod.position.set(side * 0.39, 0.38, -0.02);
    const sideFin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.12), titaniumMat);
    sideFin.position.set(side * 0.42, 0.58, -0.08);
    sideFin.rotation.x = -0.26;
    headGear.add(jawPlate, sidePod, sideFin);
  }

  const chinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.12), obsidianMat);
  chinGuard.position.set(0, 0.15, 0.345);
  headGear.add(chinGuard);

  // Visor angular em formato de V em roxo-neon
  const visorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.1), obsidianMat);
  visorHousing.position.set(0, 0.36, 0.345);
  headGear.add(visorHousing);

  for (const side of [-1, 1]) {
    const vWing = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.068, 0.06), neonPurple);
    vWing.position.set(side * 0.135, 0.365, 0.378);
    vWing.rotation.z = -side * 0.24;
    vWing.rotation.y = -side * 0.16;
    headGear.add(vWing);
  }

  minifig.headGroup.add(headGear);
}

export const aresBastiaoOutfitMethods = {
  /**
   * Equipa o Rig 3D Completo do Bastião (A.R.E.S. — Tanque/Suporte Cibernético em escala Minifig):
   * - EXOESQUELETO ARTICULADO: Hastes e pistões mecânicos nos ombros, braços, coluna e face externa das pernas;
   * - COSTAS: Drone Médico Compacto acoplado (`this.operatorBackDroneGroup`) com anel reator roxo-neon;
   * - ARMA: Minigun de Pulso de 3 Canos (`ares_pulse_minigun`, `this.rifleGroup` + giro em `titaMinigunBarrelGroup`).
   */
  _attachAresBastiaoRig() {
    const titaniumMat = getLegoMaterial(0x475569, { roughness: 0.24, metalness: 0.74, clearcoat: 0.35 });
    const lightTitanium = getLegoMaterial(0x64748b, { roughness: 0.2, metalness: 0.8 });
    const obsidianMat = getLegoMaterial(0x090712, { roughness: 0.32, clearcoat: 0.25 });
    const neonPurple = getLegoMaterial(0xa855f7, {
      emissive: 0x9333ea,
      emissiveIntensity: 2.35,
      roughness: 0.12
    });
    const brightCore = getLegoMaterial(0xe9d5ff, {
      emissive: 0xc084fc,
      emissiveIntensity: 2.6
    });

    // 1. FRENTE — PEITORAL OBSIDIANA/TITÂNIO + PISTÕES CLAVICULARES & NÚCLEO A.R.E.S.
    const chestFrame = new THREE.Group();

    const cuirass = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.56, 0.095), obsidianMat);
    cuirass.position.set(0, 0.4, 0.232);
    cuirass.castShadow = true;
    chestFrame.add(cuirass);

    for (const side of [-1, 1]) {
      const chestWing = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.05), titaniumMat);
      chestWing.position.set(side * 0.19, 0.44, 0.278);
      chestWing.rotation.z = -side * 0.12;

      const clavicleStrut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 0.52, 10),
        lightTitanium
      );
      clavicleStrut.rotation.x = Math.PI / 2;
      clavicleStrut.position.set(side * 0.27, 0.76, 0);
      chestFrame.add(chestWing, clavicleStrut);
    }

    const sternumCore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.055), neonPurple);
    sternumCore.position.set(0, 0.44, 0.282);
    chestFrame.add(sternumCore);

    this.upperBodyGroup.add(chestFrame);

    // 2. COSTAS — COLUNA EXOESQUELÉTICA + DRONE MÉDICO ACOPLADO (`operatorBackDroneGroup`)
    const spineFrame = new THREE.Group();
    spineFrame.position.set(0, 0.38, -0.25);

    for (let v = 0; v < 4; v++) {
      const vertebra = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.09), titaniumMat);
      vertebra.position.set(0, -0.22 + v * 0.15, -0.02);
      spineFrame.add(vertebra);
    }
    for (const sx of [-0.15, 0.15]) {
      const dorsalPiston = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.58, 10),
        lightTitanium
      );
      dorsalPiston.position.set(sx, 0.02, -0.03);
      spineFrame.add(dorsalPiston);
    }
    this.upperBodyGroup.add(spineFrame);

    const droneGroup = new THREE.Group();
    droneGroup.position.set(0, 0.52, -0.35);

    const droneChassis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.22, 0.14, 8),
      obsidianMat
    );
    droneChassis.rotation.x = Math.PI / 2;
    droneChassis.castShadow = true;
    const droneArmorRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.07, 8),
      titaniumMat
    );
    droneArmorRing.rotation.x = Math.PI / 2;

    const reactorTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.028, 10, 20),
      neonPurple
    );
    reactorTorus.position.set(0, 0, -0.075);
    const reactorEye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), brightCore);
    reactorEye.position.set(0, 0, -0.075);

    for (const [wx, wy, rotZ] of [[-0.24, 0.18, 0.55], [0.24, 0.18, -0.55], [-0.24, -0.18, -0.55], [0.24, -0.18, 0.55]]) {
      const rotorArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.05), lightTitanium);
      rotorArm.position.set(wx, wy, -0.02);
      rotorArm.rotation.z = rotZ;
      droneGroup.add(rotorArm);
    }

    this.upperBodyGroup.add(droneGroup);
    droneGroup.add(droneChassis, droneArmorRing, reactorTorus, reactorEye);
    this.operatorBackDroneGroup = droneGroup;

    // 3. HASTES DO EXOESQUELETO NOS OMBROS, BRAÇOS, QUADRIL E FACE EXTERNA DAS PERNAS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const exoShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.38), titaniumMat);
      exoShoulder.position.set(sign * 0.07, -0.02, 0);
      exoShoulder.rotation.z = -sign * 0.12;
      const shoulderServo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12),
        obsidianMat
      );
      shoulderServo.rotation.z = Math.PI / 2;
      shoulderServo.position.set(sign * 0.21, -0.03, 0);
      const upperArmStrut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.34, 10),
        lightTitanium
      );
      upperArmStrut.position.set(sign * 0.17, -0.18, 0);
      armPivot.add(exoShoulder, shoulderServo, upperArmStrut);
    }

    for (const [handGrp, sign] of [[this.leftHandGroup, 1], [this.rightHandGroup, -1]]) {
      const exoVambrace = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.27), obsidianMat);
      exoVambrace.position.set(0, -0.12, 0);
      const forearmPiston = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.07), lightTitanium);
      forearmPiston.position.set(sign * 0.135, -0.12, 0);
      const neonPip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.035), neonPurple);
      neonPip.position.set(sign * 0.155, -0.12, 0);
      handGrp.add(exoVambrace, forearmPiston, neonPip);
    }

    const exoBelt = new THREE.Group();
    const waistFrame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.13, 0.49), titaniumMat);
    waistFrame.position.set(0, 0.08, 0);
    const beltCore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.06), neonPurple);
    beltCore.position.set(0, 0.08, 0.25);
    exoBelt.add(waistFrame, beltCore);
    for (const side of [-1, 1]) {
      const hipServo = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 12), obsidianMat);
      hipServo.rotation.z = Math.PI / 2;
      hipServo.position.set(side * 0.44, 0.04, 0);
      exoBelt.add(hipServo);
    }
    this.hipGroup.add(exoBelt);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const thighStrut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.09), titaniumMat);
      thighStrut.position.set(sign * 0.2, -0.18, 0);
      const kneeJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 12), lightTitanium);
      kneeJoint.rotation.z = Math.PI / 2;
      kneeJoint.position.set(sign * 0.21, -0.37, 0.02);
      const shinPiston = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.3, 10),
        lightTitanium
      );
      shinPiston.position.set(sign * 0.2, -0.5, 0.02);
      const kneePlate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1), titaniumMat);
      kneePlate.position.set(0, -0.38, 0.18);
      const exoBoot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.17, 0.55), obsidianMat);
      exoBoot.position.set(0, -0.64, 0.07);
      legPivot.add(thighStrut, kneeJoint, shinPiston, kneePlate, exoBoot);
    }

    // 4. ARMA PRIMÁRIA — MINIGUN DE PULSO DE 3 CANOS (`ares_pulse_minigun`)
    const minigun = new THREE.Group();

    const motorBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.52), obsidianMat);
    motorBody.position.set(0, 0.02, 0.2);
    motorBody.castShadow = true;
    const titaniumShroud = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.09, 0.46), titaniumMat);
    titaniumShroud.position.set(0, 0.08, 0.2);
    const powerCell = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.24, 14), neonPurple);
    powerCell.rotation.z = Math.PI / 2;
    powerCell.position.set(0, -0.15, 0.24);
    const topHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.28), lightTitanium);
    topHandle.position.set(0, 0.18, 0.3);
    minigun.add(motorBody, titaniumShroud, powerCell, topHandle);

    const barrelCluster = new THREE.Group();
    barrelCluster.position.set(0, 0.02, 0.46);

    const barrelLength = 0.72;
    for (let b = 0; b < 3; b++) {
      const ang = (b / 3) * Math.PI * 2 + Math.PI / 6;
      const bx = Math.cos(ang) * 0.062;
      const by = Math.sin(ang) * 0.062;
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, barrelLength, 10),
        lightTitanium
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(bx, by, barrelLength * 0.5);
      barrelCluster.add(barrel);
    }

    for (const [ringZ, ringMat] of [[0.22, titaniumMat], [0.6, neonPurple]]) {
      const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.05, 14), ringMat);
      clamp.rotation.x = Math.PI / 2;
      clamp.position.set(0, 0, ringZ);
      barrelCluster.add(clamp);
    }
    minigun.add(barrelCluster);
    this.titaMinigunBarrelGroup = barrelCluster;
    this.operatorBarrelCluster = barrelCluster;

    const flashMat = getLegoMaterial(0xf3e8ff, {
      emissive: 0xa855f7,
      emissiveIntensity: 2.8,
      transparent: true,
      opacity: 0.94
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.95, 0.95, 2.6);
    this.muzzleFlashMesh.position.set(0, 0.02, 1.3);
    this.muzzleFlashMesh.visible = false;
    minigun.add(this.muzzleFlashMesh);

    minigun.position.set(0, -0.34, 0.1);
    minigun.rotation.x = Math.PI / 2 - 0.15;
    this.rightHandGroup.add(minigun);
    this.rifleGroup = minigun;
  }
};
