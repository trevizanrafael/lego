import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';
import { attachVoltaicoClawAndHalberd } from '../EnergyAndMeleeWeaponsBuilder.js';

/**
 * Constrói o Elmo do Deus da Tempestade + Coroa de 14 Relâmpagos Vivos + Asas em Ziguezague
 * + Queixeira Angular em V (`tesla_crown`) do Voltaico (#7).
 */
export function attachVoltaicoCrownHeadgear(minifig) {
  const cobaltMat = getLegoMaterial(0x1d4ed8, { roughness: 0.18, metalness: 0.55 });
  const silverTitanium = getLegoMaterial(0xe2e8f0, { roughness: 0.15, metalness: 0.82 });
  const goldMat = getLegoMaterial(0xfacc15, { roughness: 0.16, metalness: 0.78 });
  const electricBlueMat = getLegoMaterial(0x0284c7, {
    emissive: 0x0284c7,
    emissiveIntensity: 1.9,
    roughness: 0.1
  });
  const arcGlowMat = getLegoMaterial(0x38bdf8, {
    emissive: 0x38bdf8,
    emissiveIntensity: 2.5,
    roughness: 0.08
  });
  const whiteBoltMat = getLegoMaterial(0xffffff, {
    emissive: 0xe0f2fe,
    emissiveIntensity: 2.8,
    roughness: 0.06
  });

  // 1. Base Superior do Elmo Condutor + Diadema Frontal Angular
  const helmDomed = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.388, 0.14, 28), cobaltMat);
  helmDomed.position.set(0, 0.61, 0);
  minifig.headGroup.add(helmDomed);

  for (const side of [-1, 1]) {
    const browSilver = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.065, 0.075), silverTitanium);
    browSilver.position.set(side * 0.11, 0.54, 0.355);
    browSilver.rotation.z = -side * 0.24;
    browSilver.rotation.y = side * 0.26;
    const browGold = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, 0.082), goldMat);
    browGold.position.set(side * 0.11, 0.57, 0.358);
    browGold.rotation.z = -side * 0.24;
    browGold.rotation.y = side * 0.26;
    minifig.headGroup.add(browSilver, browGold);
  }

  const crestGroup = new THREE.Group();
  crestGroup.position.set(0, 0.52, 0.378);
  const crestSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.16, 0.055), arcGlowMat);
  crestSeg1.position.set(0, 0.06, 0);
  crestSeg1.rotation.z = 0.22;
  const crestSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.16, 0.052), whiteBoltMat);
  crestSeg2.position.set(0.02, 0.17, -0.03);
  crestSeg2.rotation.z = -0.26;
  crestSeg2.rotation.x = -0.28;
  const crestTip = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.22, 4), arcGlowMat);
  crestTip.position.set(-0.01, 0.31, -0.09);
  crestTip.rotation.x = -0.45;
  crestGroup.add(crestSeg1, crestSeg2, crestTip);
  minifig.headGroup.add(crestGroup);

  // 2. Asas Laterais em Formato de Relâmpago (Ziguezague 3D em 3 segmentos)
  for (const side of [-1, 1]) {
    const wingGroup = new THREE.Group();
    wingGroup.position.set(side * 0.375, 0.48, 0.06);
    wingGroup.rotation.y = -side * 0.22;
    wingGroup.rotation.z = -side * 0.16;

    const seg1Gold = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.22), goldMat);
    seg1Gold.position.set(0, 0.03, -0.06);
    seg1Gold.rotation.x = 0.42;
    const seg1Cyan = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.038, 0.23), arcGlowMat);
    seg1Cyan.position.set(side * 0.008, 0.075, -0.06);
    seg1Cyan.rotation.x = 0.42;

    const seg2Gold = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.11, 0.2), silverTitanium);
    seg2Gold.position.set(side * 0.015, 0.08, -0.2);
    seg2Gold.rotation.x = -0.18;
    const seg2Cyan = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.035, 0.21), whiteBoltMat);
    seg2Cyan.position.set(side * 0.02, 0.12, -0.2);
    seg2Cyan.rotation.x = -0.18;

    const seg3Blade = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.3, 4), goldMat);
    seg3Blade.scale.set(0.45, 1.0, 1.0);
    seg3Blade.position.set(side * 0.025, 0.19, -0.36);
    seg3Blade.rotation.x = -1.12;
    const seg3Edge = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.32, 4), arcGlowMat);
    seg3Edge.scale.set(0.45, 1.0, 1.0);
    seg3Edge.position.set(side * 0.032, 0.22, -0.37);
    seg3Edge.rotation.x = -1.12;

    wingGroup.add(seg1Gold, seg1Cyan, seg2Gold, seg2Cyan, seg3Blade, seg3Edge);
    minifig.headGroup.add(wingGroup);
  }

  // 3. Coroa de 14 Arcos de Relâmpago Cristalizado 3D no Topo
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const radius = 0.22 + (i % 2) * 0.08;
    const h = 0.34 + (i % 3) * 0.11;
    const mat = i % 3 === 0 ? whiteBoltMat : i % 2 === 0 ? arcGlowMat : electricBlueMat;

    const boltGroup = new THREE.Group();
    boltGroup.position.set(Math.sin(ang) * radius, 0.66, Math.cos(ang) * radius - 0.03);
    const baseRotX = -0.34 - Math.cos(ang) * 0.24;
    const baseRotZ = -Math.sin(ang) * 0.28;
    boltGroup.rotation.set(baseRotX, 0, baseRotZ);

    const lowerShard = new THREE.Mesh(new THREE.BoxGeometry(0.055, h * 0.55, 0.055), mat);
    lowerShard.position.set(0, h * 0.24, 0);
    lowerShard.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.22;

    const upperTip = new THREE.Mesh(new THREE.ConeGeometry(0.058, h * 0.68, 4), i % 2 === 0 ? whiteBoltMat : arcGlowMat);
    upperTip.position.set((i % 2 === 0 ? 1 : -1) * 0.02, h * 0.68, -0.02);
    upperTip.rotation.z = (i % 2 === 0 ? -1 : 1) * 0.18;
    upperTip.rotation.x = -0.18;

    boltGroup.add(lowerShard, upperTip);
    minifig.headGroup.add(boltGroup);
    minifig.voltaicoCrownSpikes.push({
      mesh: boltGroup,
      phase: i * 0.65,
      speed: 18.0 + (i % 4) * 3.5,
      baseRotX,
      baseRotZ
    });
  }

  // 4. Máscara / Queixeira Angular 3D de Titânio Prateado e Azul-Cobalto em V
  const maskGroup = new THREE.Group();
  for (const side of [-1, 1]) {
    const jawPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.12), cobaltMat);
    jawPlate.position.set(side * 0.13, 0.19, 0.31);
    jawPlate.rotation.y = side * 0.36;
    jawPlate.rotation.z = -side * 0.18;

    const jawTrim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.036, 0.13), silverTitanium);
    jawTrim.position.set(side * 0.13, 0.26, 0.315);
    jawTrim.rotation.y = side * 0.36;
    jawTrim.rotation.z = -side * 0.22;

    const cyanSlit1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.132), arcGlowMat);
    cyanSlit1.position.set(side * 0.13, 0.2, 0.318);
    cyanSlit1.rotation.y = side * 0.36;
    cyanSlit1.rotation.z = -side * 0.22;

    const cyanSlit2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.132), whiteBoltMat);
    cyanSlit2.position.set(side * 0.12, 0.15, 0.318);
    cyanSlit2.rotation.y = side * 0.36;
    cyanSlit2.rotation.z = -side * 0.22;

    maskGroup.add(jawPlate, jawTrim, cyanSlit1, cyanSlit2);
  }
  const chinPoint = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 4), silverTitanium);
  chinPoint.rotation.x = Math.PI;
  chinPoint.rotation.y = Math.PI / 4;
  chinPoint.position.set(0, 0.14, 0.365);
  maskGroup.add(chinPoint);
  minifig.headGroup.add(maskGroup);
}

export const voltaicoOutfitMethods = {
  /**
   * HERÓI #7: VOLTAICO (OP-07 — DEUS DO TROVÃO CYBER-ELÉTRICO / SENHOR DA TEMPESTADE):
   * 1) Peitoral Blindado de Alta Tensão 3D + Reator de Tempestade com 4 Arcos em X + Gola Blindada
   * 2) Ombreiras Duplas de Bobina de Trovão 3D com 2 Pinos Condutores + Aletas de Relâmpago Ciano
   * 3) Manoplas Eletromagnéticas 3D + Cinturão do Trovão com Tassets + Joelheiras de Raio e Grevas/Botas
   * 4) Costas: Gerador Dorsal (z = -0.34) + 5 Segmentos em Ziguezague Real entre os Terminais
   * 5) Mãos: Garra de Arco Voltaico Giratório + Alabarda / Tridente "Tempestade Imperial" (1.65m)
   */
  _attachVoltaicoTeslaRig(leftHandGroup, rightHandGroup) {
    const cobaltArmor = getLegoMaterial(0x1d4ed8, { roughness: 0.18, metalness: 0.55 });
    const darkTitanium = getLegoMaterial(0x0f172a, { roughness: 0.22, metalness: 0.65 });
    const silverTitanium = getLegoMaterial(0xe2e8f0, { roughness: 0.14, metalness: 0.85 });
    const goldConductor = getLegoMaterial(0xfacc15, { roughness: 0.16, metalness: 0.78 });
    const electricCyan = getLegoMaterial(0x38bdf8, {
      emissive: 0x38bdf8,
      emissiveIntensity: 2.5,
      roughness: 0.08
    });
    const whiteSpark = getLegoMaterial(0xffffff, {
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.8,
      roughness: 0.05
    });

    // 1. PEITORAL BLINDADO DE ALTA TENSÃO 3D (3D STORMLORD CUIRASS) + GOLA BLINDADA
    const cuirassGroup = new THREE.Group();

    for (const side of [-1, 1]) {
      const pecPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.095), cobaltArmor);
      pecPlate.position.set(side * 0.19, 0.56, 0.2);
      pecPlate.rotation.y = side * 0.14;
      pecPlate.rotation.z = -side * 0.08;

      const pecSilverTrim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.105), silverTitanium);
      pecSilverTrim.position.set(side * 0.19, 0.68, 0.205);
      pecSilverTrim.rotation.y = side * 0.14;
      pecSilverTrim.rotation.z = -side * 0.14;

      const absPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.08), darkTitanium);
      absPlate.position.set(side * 0.16, 0.27, 0.195);
      absPlate.rotation.y = side * 0.1;

      const goldRib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.092), goldConductor);
      goldRib.position.set(side * 0.17, 0.34, 0.205);
      goldRib.rotation.z = side * 0.18;

      cuirassGroup.add(pecPlate, pecSilverTrim, absPlate, goldRib);
    }

    const chestRingGold = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.028, 10, 24), goldConductor);
    chestRingGold.position.set(0, 0.49, 0.245);
    const chestRingSilver = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 20), silverTitanium);
    chestRingSilver.rotation.x = Math.PI / 2;
    chestRingSilver.position.set(0, 0.49, 0.23);
    const chestPlasmaCore = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.038, 18), whiteSpark);
    chestPlasmaCore.rotation.x = Math.PI / 2;
    chestPlasmaCore.position.set(0, 0.49, 0.25);
    this.voltaicoArcs.push(chestPlasmaCore);
    cuirassGroup.add(chestRingGold, chestRingSilver, chestPlasmaCore);

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const xArc1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.032), electricCyan);
        xArc1.position.set(sx * 0.14, 0.49 + sy * 0.1, 0.248);
        xArc1.rotation.z = sx * sy * 0.62;
        const xArc2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.024, 0.032), goldConductor);
        xArc2.position.set(sx * 0.24, 0.49 + sy * 0.16, 0.242);
        xArc2.rotation.z = sx * sy * 0.32;
        cuirassGroup.add(xArc1, xArc2);
      }
    }

    const backCollar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), cobaltArmor);
    backCollar.position.set(0, 0.81, -0.17);
    cuirassGroup.add(backCollar);
    for (const side of [-1, 1]) {
      const sideCollar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.34), silverTitanium);
      sideCollar.position.set(side * 0.25, 0.8, -0.01);
      sideCollar.rotation.z = -side * 0.22;
      const collarNode = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), goldConductor);
      collarNode.position.set(side * 0.27, 0.86, 0.06);
      cuirassGroup.add(sideCollar, collarNode);
    }

    this.upperBodyGroup.add(cuirassGroup);

    // 2. OMBREIRAS DE BOBINA DE TROVÃO 3D (3D THUNDER-COIL PAULDRONS)
    const armPivots = [
      { pivot: this.leftArmPivot, side: -1 },
      { pivot: this.rightArmPivot, side: 1 }
    ];
    for (const { pivot, side } of armPivots) {
      if (!pivot) continue;
      const pauldronGroup = new THREE.Group();
      pauldronGroup.position.set(side * 0.06, 0.04, 0);

      const upperShield = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.36), cobaltArmor);
      upperShield.position.set(side * 0.05, 0.04, 0);
      upperShield.rotation.z = -side * 0.28;

      const lowerShield = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.33), silverTitanium);
      lowerShield.position.set(side * 0.08, -0.06, 0);
      lowerShield.rotation.z = -side * 0.42;

      const goldRim = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.038, 0.38), goldConductor);
      goldRim.position.set(side * 0.055, 0.09, 0);
      goldRim.rotation.z = -side * 0.28;
      pauldronGroup.add(upperShield, lowerShield, goldRim);

      for (const zOff of [-0.08, 0.08]) {
        const coilPin = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 0.16, 12), goldConductor);
        coilPin.position.set(side * 0.12, 0.16, zOff);
        coilPin.rotation.z = -side * 0.48;

        const pinTip = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), whiteSpark);
        pinTip.position.set(side * 0.16, 0.22, zOff);

        const cyanFin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 4), electricCyan);
        cyanFin.scale.set(1.0, 1.0, 0.45);
        cyanFin.position.set(side * 0.18, 0.14, zOff * 1.15);
        cyanFin.rotation.z = -side * 0.85;

        pauldronGroup.add(coilPin, pinTip, cyanFin);
      }

      pivot.add(pauldronGroup);
    }

    // 3. MANOPLAS ELETROMAGNÉTICAS 3D (STORM GAUNTLETS)
    const handGroups = [
      { group: leftHandGroup, side: -1 },
      { group: rightHandGroup, side: 1 }
    ];
    for (const { group, side } of handGroups) {
      if (!group) continue;
      const gauntletCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.12, 0.24, 14), cobaltArmor);
      gauntletCuff.position.set(0, -0.06, 0);

      const gauntletGoldBand = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.02, 8, 16), goldConductor);
      gauntletGoldBand.rotation.x = Math.PI / 2;
      gauntletGoldBand.position.set(0, 0.02, 0);

      const wristBolt1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.075), electricCyan);
      wristBolt1.position.set(side * 0.135, -0.02, 0.02);
      wristBolt1.rotation.x = -0.35;
      const wristBolt2 = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.18, 4), whiteSpark);
      wristBolt2.position.set(side * 0.145, 0.09, -0.03);
      wristBolt2.rotation.x = -0.45;

      group.add(gauntletCuff, gauntletGoldBand, wristBolt1, wristBolt2);
    }

    // 4. CINTURÃO DO TROVÃO + TASSETS + JOELHEIRAS DE RAIO E GREVAS/BOTAS
    if (this.hipGroup) {
      const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.83, 0.13, 0.46), goldConductor);
      beltBand.position.set(0, 0.08, 0);
      this.hipGroup.add(beltBand);

      const buckleBack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 6), silverTitanium);
      buckleBack.rotation.x = Math.PI / 2;
      buckleBack.position.set(0, 0.08, 0.235);
      const buckleBolt = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.18, 0.04), whiteSpark);
      buckleBolt.position.set(0, 0.08, 0.255);
      buckleBolt.rotation.z = -0.32;
      this.hipGroup.add(buckleBack, buckleBolt);

      for (const side of [-1, 1]) {
        const tassetPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.38), cobaltArmor);
        tassetPlate.position.set(side * 0.42, -0.06, 0);
        tassetPlate.rotation.z = -side * 0.18;
        const tassetTrim = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.4), goldConductor);
        tassetTrim.position.set(side * 0.43, -0.17, 0);
        tassetTrim.rotation.z = -side * 0.18;
        this.hipGroup.add(tassetPlate, tassetTrim);
      }
    }

    const legPivots = [
      { pivot: this.leftLegPivot, side: -1 },
      { pivot: this.rightLegPivot, side: 1 }
    ];
    for (const { pivot, side } of legPivots) {
      if (!pivot) continue;
      const thighGuard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.45), cobaltArmor);
      thighGuard.position.set(0, -0.18, 0.01);

      const kneeDiamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), goldConductor);
      kneeDiamond.scale.set(1.0, 1.35, 0.65);
      kneeDiamond.position.set(0, -0.36, 0.22);
      const kneeCyanSpike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 4), electricCyan);
      kneeCyanSpike.position.set(0, -0.31, 0.25);
      kneeCyanSpike.rotation.x = 0.25;

      const shinGreave = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.46), silverTitanium);
      shinGreave.position.set(0, -0.52, 0.01);
      const shinCobalt = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.48), cobaltArmor);
      shinCobalt.position.set(0, -0.52, 0.02);

      const shinThruster = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.5), electricCyan);
      shinThruster.position.set(side * 0.16, -0.52, 0.01);

      const bootPlate = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.12, 0.54), cobaltArmor);
      bootPlate.position.set(0, -0.66, 0.05);
      const bootGoldToe = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.14), goldConductor);
      bootGoldToe.position.set(0, -0.67, 0.28);

      pivot.add(thighGuard, kneeDiamond, kneeCyanSpike, shinGreave, shinCobalt, shinThruster, bootPlate, bootGoldToe);
    }

    // 5. COSTAS: GERADOR DORSAL (z = -0.34) + ARCO VOLTAICO EM ZIGUEZAGUE REAL (5 SEGMENTOS)
    const teslaPack = new THREE.Group();
    teslaPack.position.set(0, 0.46, -0.34);

    const baseBox = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.46, 0.2), darkTitanium);
    const packArmor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.4, 0.23), cobaltArmor);
    const packReactorRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 8, 18), goldConductor);
    packReactorRing.position.set(0, 0.02, -0.12);
    const packReactorCore = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), electricCyan);
    packReactorCore.position.set(0, 0.02, -0.12);
    this.voltaicoArcs.push(packReactorCore);
    teslaPack.add(baseBox, packArmor, packReactorRing, packReactorCore);

    const coilTilt = 0.44;
    for (const sx of [-0.26, 0.26]) {
      const coilGroup = new THREE.Group();
      coilGroup.position.set(sx, 0.26, -0.04);
      coilGroup.rotation.z = -Math.sign(sx) * coilTilt;

      const coreRod = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.082, 0.58, 14), silverTitanium);
      coilGroup.add(coreRod);

      for (let r = 0; r < 4; r++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.115 - r * 0.01, 0.022, 8, 18),
          r % 2 === 0 ? goldConductor : electricCyan
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, -0.14 + r * 0.11, 0);
        coilGroup.add(ring);
      }

      const terminalSphere = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 14), whiteSpark);
      terminalSphere.position.set(0, 0.32, 0);
      coilGroup.add(terminalSphere);
      this.voltaicoArcs.push(terminalSphere);

      teslaPack.add(coilGroup);
    }

    const termX = 0.26 + 0.32 * Math.sin(coilTilt);
    const termY = 0.26 + 0.32 * Math.cos(coilTilt);
    const termZ = -0.04;

    const numSegs = 5;
    for (let s = 0; s < numSegs; s++) {
      const segMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.0, 6),
        s % 2 === 0 ? whiteSpark : electricCyan
      );
      teslaPack.add(segMesh);
      this.voltaicoBackArcSegments.push({
        mesh: segMesh,
        index: s,
        total: numSegs,
        termX,
        termY,
        termZ
      });
    }

    this.upperBodyGroup.add(teslaPack);

    // 6 & 7. Mão Esquerda (Garra Voltaica) + Mão Direita (Alabarda "Tempestade Imperial")
    attachVoltaicoClawAndHalberd(this, leftHandGroup, rightHandGroup);
  }
};
