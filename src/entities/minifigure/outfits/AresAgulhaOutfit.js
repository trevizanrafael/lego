import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói o Capuz/Elmo Furtivo de Reconhecimento + Visor Sniper Tri-Óptico Roxo (`ares_agulha_visor`)
 * para o franco-atirador cibernético Agulha (A.R.E.S.).
 */
export function attachAresAgulhaHeadgear(minifig) {
  const headGear = new THREE.Group();
  const graphiteMat = getLegoMaterial(0x1e2436, { roughness: 0.28, metalness: 0.58, clearcoat: 0.3 });
  const stealthDark = getLegoMaterial(0x090b14, { roughness: 0.36, clearcoat: 0.2 });
  const slateSteel = getLegoMaterial(0x475569, { roughness: 0.22, metalness: 0.72 });
  const neonLilac = getLegoMaterial(0xc084fc, {
    emissive: 0xa855f7,
    emissiveIntensity: 2.45,
    roughness: 0.1
  });
  const opticCore = getLegoMaterial(0xfaf5ff, {
    emissive: 0xd8b4fe,
    emissiveIntensity: 2.7
  });

  // Capuz furtivo angular em grafite envolvendo crânio e têmporas
  const hoodDome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.375, 0.405, 0.34, 8),
    graphiteMat
  );
  hoodDome.position.set(0, 0.5, -0.02);
  hoodDome.castShadow = true;
  const hoodPeak = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.58), graphiteMat);
  hoodPeak.position.set(0, 0.68, 0.04);
  hoodPeak.rotation.x = 0.14;
  const hoodBackDrape = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.12), stealthDark);
  hoodBackDrape.position.set(0, 0.3, -0.35);
  hoodBackDrape.rotation.x = 0.16;
  headGear.add(hoodDome, hoodPeak, hoodBackDrape);

  for (const side of [-1, 1]) {
    const hoodCheek = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.36, 0.34), graphiteMat);
    hoodCheek.position.set(side * 0.37, 0.34, 0.02);
    headGear.add(hoodCheek);
  }

  // Máscara respiradora angular inferior + antena telemétrica fina
  const respirator = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.14), stealthDark);
  respirator.position.set(0, 0.18, 0.32);
  const sensorMast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.34, 8), slateSteel);
  sensorMast.position.set(-0.39, 0.58, -0.08);
  headGear.add(respirator, sensorMast);

  // Visor Sniper Tri-Óptico Roxo-Neon (lente central maior + 2 sensores auxiliares)
  const opticBar = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.1), stealthDark);
  opticBar.position.set(0, 0.37, 0.34);
  headGear.add(opticBar);

  for (const [ox, oy, rad] of [[-0.155, 0.37, 0.046], [0, 0.375, 0.06], [0.155, 0.37, 0.046]]) {
    const lensRing = new THREE.Mesh(new THREE.CylinderGeometry(rad + 0.014, rad + 0.014, 0.055, 14), slateSteel);
    lensRing.rotation.x = Math.PI / 2;
    lensRing.position.set(ox, oy, 0.375);
    const lensGlow = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.065, 14), neonLilac);
    lensGlow.rotation.x = Math.PI / 2;
    lensGlow.position.set(ox, oy, 0.382);
    const pupil = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.45, rad * 0.45, 0.07, 10), opticCore);
    pupil.rotation.x = Math.PI / 2;
    pupil.position.set(ox, oy, 0.386);
    headGear.add(lensRing, lensGlow, pupil);
  }

  minifig.headGroup.add(headGear);
}

export const aresAgulhaOutfitMethods = {
  /**
   * Equipa o Rig 3D Completo do Agulha (A.R.E.S. — Sniper Cyber-Recon):
   * - FRENTE: Armadura furtiva esguia em grafite metálico com colarinho stealth e células ópticas;
   * - COSTAS: Gerador de camuflagem + tiras segmentadas angulares de manto térmico (`this.operatorCloakGroup`);
   * - CINTO & PERNAS: Granadas de pulso EMP no cinto, coldres de bateria e botas silenciosas;
   * - ARMA: Rifle Laser Sniper de Carga de Cano Longo (`ares_charge_rifle`) com trilhos roxos (`this.rifleGroup`).
   */
  _attachAresAgulhaRig() {
    const graphiteMat = getLegoMaterial(0x1e2436, { roughness: 0.28, metalness: 0.58, clearcoat: 0.3 });
    const stealthDark = getLegoMaterial(0x090b14, { roughness: 0.36, clearcoat: 0.2 });
    const slateSteel = getLegoMaterial(0x475569, { roughness: 0.22, metalness: 0.74 });
    const neonLilac = getLegoMaterial(0xc084fc, {
      emissive: 0xa855f7,
      emissiveIntensity: 2.4,
      roughness: 0.1
    });

    // 1. FRENTE — ARMADURA STEALTH ESGUIA COM PLACAS CHANFRADAS & TRILHOS ÓPTICOS
    const stealthChest = new THREE.Group();

    const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.54, 0.075), stealthDark);
    chestCore.position.set(0, 0.39, 0.228);
    chestCore.castShadow = true;
    const highCollar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.11, 0.1), graphiteMat);
    highCollar.position.set(0, 0.72, 0.2);
    stealthChest.add(chestCore, highCollar);

    for (const side of [-1, 1]) {
      const ribPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.04), graphiteMat);
      ribPlate.position.set(side * 0.17, 0.42, 0.268);
      ribPlate.rotation.z = side * 0.1;
      const fiberLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.32, 0.048), neonLilac);
      fiberLine.position.set(side * 0.075, 0.43, 0.272);
      fiberLine.rotation.z = side * 0.1;
      stealthChest.add(ribPlate, fiberLine);
    }

    for (const cx of [-0.18, 0.18]) {
      const cellSlot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.07), slateSteel);
      cellSlot.position.set(cx, 0.2, 0.262);
      stealthChest.add(cellSlot);
    }

    this.upperBodyGroup.add(stealthChest);

    // 2. COSTAS — TIRAS SEGMENTADAS ANGULARES DE MANTO TÉRMICO (`operatorCloakGroup`)
    const cloakGroup = new THREE.Group();
    cloakGroup.position.set(0, 0.62, -0.25);

    const camoSpineUnit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.12), graphiteMat);
    camoSpineUnit.position.set(0, -0.06, -0.03);
    const camoCoreLine = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.03), neonLilac);
    camoCoreLine.position.set(0, -0.06, -0.095);
    cloakGroup.add(camoSpineUnit, camoCoreLine);

    // 3 defletores térmicos angulares segmentados (não é capa larga de super-herói)
    for (const [tx, lenY, tiltZ] of [[-0.2, 0.72, 0.09], [0, 0.84, 0], [0.2, 0.72, -0.09]]) {
      const stripHolder = new THREE.Group();
      stripHolder.position.set(tx, -0.14, -0.04);
      stripHolder.rotation.set(0.11, 0, tiltZ);

      const upperSeg = new THREE.Mesh(new THREE.BoxGeometry(0.14, lenY * 0.52, 0.026), stealthDark);
      upperSeg.position.set(0, -lenY * 0.26, 0);
      const lowerSeg = new THREE.Mesh(new THREE.BoxGeometry(0.11, lenY * 0.48, 0.022), graphiteMat);
      lowerSeg.position.set(0, -lenY * 0.72, -0.01);
      const neonEdge = new THREE.Mesh(new THREE.BoxGeometry(0.02, lenY * 0.86, 0.028), neonLilac);
      neonEdge.position.set(tx === 0 ? 0 : Math.sign(tx) * 0.055, -lenY * 0.46, 0);

      stripHolder.add(upperSeg, lowerSeg, neonEdge);
      cloakGroup.add(stripHolder);
    }

    this.upperBodyGroup.add(cloakGroup);
    this.operatorCloakGroup = cloakGroup;

    // 3. OMBROS RECON, CINTO COM GRANADAS EMP E PERNAS FURTIVAS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const reconPad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.33), graphiteMat);
      reconPad.position.set(sign * 0.05, -0.03, 0);
      reconPad.rotation.z = -sign * 0.12;
      const lilacTrim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.032, 0.34), neonLilac);
      lilacTrim.position.set(sign * 0.05, 0.04, 0);
      lilacTrim.rotation.z = -sign * 0.12;
      armPivot.add(reconPad, lilacTrim);
    }

    const rangeWrist = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.25), stealthDark);
    rangeWrist.position.set(0, -0.16, 0);
    const rangeOptic = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 0.13), neonLilac);
    rangeOptic.position.set(0.105, -0.16, 0.02);
    this.leftHandGroup.add(rangeWrist, rangeOptic);

    const beltGroup = new THREE.Group();
    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.11, 0.46), stealthDark);
    beltBand.position.set(0, 0.08, 0);
    beltGroup.add(beltBand);

    // 3 granadas cilíndricas de pulso EMP presas no cinto
    for (const [gx, gz] of [[-0.36, 0.12], [0.36, 0.12], [0.24, -0.24]]) {
      const empBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.13, 10), graphiteMat);
      empBody.position.set(gx, 0.08, gz);
      const empRing = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.032, 10), neonLilac);
      empRing.position.set(gx, 0.08, gz);
      beltGroup.add(empBody, empRing);
    }
    this.hipGroup.add(beltGroup);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const cellHolster = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.22, 0.18), graphiteMat);
      cellHolster.position.set(sign * 0.19, -0.21, 0.01);
      const kneeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.11), graphiteMat);
      kneeBlade.position.set(0, -0.39, 0.18);
      const stealthBoot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.54), stealthDark);
      stealthBoot.position.set(0, -0.64, 0.07);
      legPivot.add(cellHolster, kneeBlade, stealthBoot);
    }

    // 4. ARMA PRIMÁRIA — RIFLE LASER SNIPER DE CARGA (`ares_charge_rifle`)
    const chargeRifle = new THREE.Group();

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.66), graphiteMat);
    receiver.position.set(0, 0.03, 0.24);
    receiver.castShadow = true;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.19, 0.38), stealthDark);
    stock.position.set(0, -0.01, -0.22);
    const powerMag = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.21, 0.14), neonLilac);
    powerMag.position.set(0, -0.14, 0.3);
    chargeRifle.add(receiver, stock, powerMag);

    // Cano longo duplo estilo railgun + núcleo luminoso roxo de carga
    const upperRailBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.045, 0.96), slateSteel);
    upperRailBarrel.position.set(0, 0.095, 1.02);
    const lowerRailBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.045, 0.92), slateSteel);
    lowerRailBarrel.position.set(0, 0.005, 1.0);
    const chargeCoreRail = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.036, 0.94), neonLilac);
    chargeCoreRail.position.set(0, 0.05, 1.01);
    chargeRifle.add(upperRailBarrel, lowerRailBarrel, chargeCoreRail);

    for (const cz of [0.68, 0.94, 1.2, 1.42]) {
      const capBracket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.045), stealthDark);
      capBracket.position.set(0, 0.05, cz);
      chargeRifle.add(capBracket);
    }

    // Luneta cyber-óptica de longo alcance
    const cyberScope = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.095, 0.44), stealthDark);
    cyberScope.position.set(0, 0.195, 0.3);
    const scopeLensFront = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.072, 0.03), neonLilac);
    scopeLensFront.position.set(0, 0.195, 0.525);
    chargeRifle.add(cyberScope, scopeLensFront);

    const flashMat = getLegoMaterial(0xfaf5ff, {
      emissive: 0xc084fc,
      emissiveIntensity: 2.8,
      transparent: true,
      opacity: 0.95
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.82, 0.82, 2.8);
    this.muzzleFlashMesh.position.set(0, 0.05, 1.62);
    this.muzzleFlashMesh.visible = false;
    chargeRifle.add(this.muzzleFlashMesh);

    chargeRifle.position.set(0, -0.34, 0.12);
    chargeRifle.rotation.x = Math.PI / 2 - 0.15;
    this.rightHandGroup.add(chargeRifle);
    this.rifleGroup = chargeRifle;
  }
};
