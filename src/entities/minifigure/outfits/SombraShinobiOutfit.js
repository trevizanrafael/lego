import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói o Capuz Shinobi Assassino 3D + Máscara Oni Menpo + Chifres Escarlates (`ninja_hood`)
 * do Sombra Escarlate (#5).
 */
export function attachSombraHoodHeadgear(minifig) {
  const hoodMat = getLegoMaterial(0x090a0d, { roughness: 0.28, clearcoat: 0.35 });
  const darkSteelMat = getLegoMaterial(0x1e293b, { roughness: 0.22, metalness: 0.55 });
  const silverMat = getLegoMaterial(0xe2e8f0, { roughness: 0.2, metalness: 0.65 });
  const redMat = getLegoMaterial(0xdc2626, { roughness: 0.22, clearcoat: 0.5 });
  const crimsonGlowMat = getLegoMaterial(0xff1e42, {
    emissive: 0xef4444,
    emissiveIntensity: 2.1,
    roughness: 0.12
  });

  const hoodTop = new THREE.Mesh(new THREE.CylinderGeometry(0.388, 0.398, 0.18, 28), hoodMat);
  hoodTop.position.set(0, 0.62, 0);
  hoodTop.castShadow = true;
  minifig.headGroup.add(hoodTop);

  const hoodPeak = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.24), hoodMat);
  hoodPeak.position.set(0, 0.58, 0.24);
  hoodPeak.rotation.x = 0.24;
  minifig.headGroup.add(hoodPeak);

  for (const side of [-1, 1]) {
    const sideCowl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.36), hoodMat);
    sideCowl.position.set(side * 0.36, 0.36, -0.02);
    minifig.headGroup.add(sideCowl);
  }

  const headband3D = new THREE.Mesh(new THREE.CylinderGeometry(0.376, 0.376, 0.09, 28), redMat);
  headband3D.position.set(0, 0.53, 0);
  minifig.headGroup.add(headband3D);

  const hachiganePlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.095, 0.06), darkSteelMat);
  hachiganePlate.position.set(0, 0.53, 0.365);
  const runeCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.07), crimsonGlowMat);
  runeCore.position.set(0, 0.53, 0.37);
  minifig.headGroup.add(hachiganePlate, runeCore);

  for (const side of [-1, 1]) {
    const oniHorn = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.22, 5), crimsonGlowMat);
    oniHorn.position.set(side * 0.16, 0.66, 0.32);
    oniHorn.rotation.x = 0.42;
    oniHorn.rotation.z = -side * 0.28;
    minifig.headGroup.add(oniHorn);
  }

  const menpoGuard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.24), hoodMat);
  menpoGuard.position.set(0, 0.19, 0.23);
  const menpoTrim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.25), redMat);
  menpoTrim.position.set(0, 0.29, 0.235);
  minifig.headGroup.add(menpoGuard, menpoTrim);

  for (const side of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.1, 4), silverMat);
    fang.position.set(side * 0.13, 0.23, 0.36);
    fang.rotation.x = Math.PI;
    minifig.headGroup.add(fang);
  }

  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.045), redMat);
    tail.position.set(side * 0.12, 0.42, -0.4);
    tail.rotation.x = 0.42;
    tail.rotation.z = side * 0.22;
    minifig.headGroup.add(tail);
  }
}

export const sombraOutfitMethods = {
  /**
   * Equipa a Armadura Cyber-Shinobi Mística 3D Completa & Cachecol Longo Esvoaçante do Sombra Escarlate (#5):
   * - Cachecol Ninja Longo de Duas Caudas Esfarrapadas (4 segmentos articulados que ondulam no vento)
   * - Ombreiras Ninja Segmentadas 3D (Shinobi Pauldrons) em Preto Obsidiana e Vermelho-Sangue
   * - Peitoral Furtivo 3D (Shinobi Chest Rig) com Amuleto Espiritual Escarlate Pulsante e 3 Kunais 3D
   * - Braçadeiras Tekko-Kagi com Lâminas Serrilhadas nos Antebraços
   * - Cinturão Obi Escarlate com 2 Bombas de Fumaça Esféricas, Shurikens 3D, Coldres de Coxa e Caneleiras Suneate
   */
  _attachSombraShinobiRig() {
    const obsidianMat = getLegoMaterial(0x090a0d, { roughness: 0.24, metalness: 0.45, clearcoat: 0.5 });
    const darkGraphiteMat = getLegoMaterial(0x18181b, { roughness: 0.28, metalness: 0.4 });
    const silverMat = getLegoMaterial(0xe2e8f0, { roughness: 0.18, metalness: 0.7 });
    const bloodRedMat = getLegoMaterial(0x991b1b, { roughness: 0.26, clearcoat: 0.4 });
    const crimsonMat = getLegoMaterial(0xdc2626, { roughness: 0.22, clearcoat: 0.5 });
    const scarletGlowMat = getLegoMaterial(0xff1e42, {
      emissive: 0xef4444,
      emissiveIntensity: 2.2,
      roughness: 0.1
    });
    const whiteCoreMat = getLegoMaterial(0xfecaca, {
      emissive: 0xffffff,
      emissiveIntensity: 2.0
    });

    // 1. CACHECOL NINJA LONGO DE DUAS CAUDAS ESFARRAPADAS
    const scarfCollarGroup = new THREE.Group();
    const neckWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.43, 0.16, 24), crimsonMat);
    neckWrap.position.set(0, 0.73, 0.01);
    const neckWrapLower = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.11, 24), bloodRedMat);
    neckWrapLower.position.set(0, 0.65, -0.02);
    scarfCollarGroup.add(neckWrap, neckWrapLower);

    for (const side of [-1, 1]) {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(side * 0.18, 0.68, -0.31);
      tailPivot.rotation.z = side * 0.14;

      const segGroup = new THREE.Group();
      for (let s = 0; s < 4; s++) {
        const segW = 0.22 - s * 0.025;
        const segH = 0.26;
        const segMat = s % 2 === 0 ? crimsonMat : bloodRedMat;
        const segMesh = new THREE.Mesh(new THREE.BoxGeometry(segW, segH, 0.036), segMat);
        segMesh.position.set(0, -0.13 - s * 0.23, -s * 0.03);
        segMesh.rotation.x = 0.08 * s;
        segMesh.castShadow = true;
        segGroup.add(segMesh);

        const edgeTrim = new THREE.Mesh(new THREE.BoxGeometry(segW + 0.015, 0.03, 0.04), scarletGlowMat);
        edgeTrim.position.set(0, -0.24 - s * 0.23, -s * 0.03);
        segGroup.add(edgeTrim);
      }

      const raggedTip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 4), scarletGlowMat);
      raggedTip.position.set(0, -1.08, -0.12);
      raggedTip.rotation.x = Math.PI;
      raggedTip.scale.set(1.1, 1.0, 0.35);
      segGroup.add(raggedTip);

      tailPivot.add(segGroup);
      scarfCollarGroup.add(tailPivot);

      this.sombraScarfStrips.push({
        pivot: tailPivot,
        tipCone: raggedTip,
        baseRotZ: side * 0.14,
        phase: side > 0 ? 0.0 : 1.65
      });
    }
    this.upperBodyGroup.add(scarfCollarGroup);

    // 2. PEITORAL FURTIVO 3D (SHINOBI CHEST RIG) + AMULETO + 3 KUNAIS 3D
    const chestRig = new THREE.Group();

    const chestPlateMain = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 0.06), obsidianMat);
    chestPlateMain.position.set(0, 0.42, 0.22);
    chestRig.add(chestPlateMain);

    for (const sign of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.68, 0.075), bloodRedMat);
      strap.position.set(0, 0.42, 0.23);
      strap.rotation.z = sign * 0.52;
      chestRig.add(strap);
    }

    const amuletFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.085), obsidianMat);
    amuletFrame.position.set(0, 0.44, 0.24);
    amuletFrame.rotation.z = Math.PI / 4;
    const amuletCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.095), scarletGlowMat);
    amuletCore.position.set(0, 0.44, 0.245);
    amuletCore.rotation.z = Math.PI / 4;
    const amuletDot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), whiteCoreMat);
    amuletDot.position.set(0, 0.44, 0.295);
    chestRig.add(amuletFrame, amuletCore, amuletDot);

    for (let k = -1; k <= 1; k++) {
      const kunaiGrp = new THREE.Group();
      const kBlade = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 4), silverMat);
      kBlade.position.set(0, 0.07, 0);
      const kHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), crimsonMat);
      kHandle.position.set(0, -0.02, 0);
      const kRing = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12), silverMat);
      kRing.position.set(0, -0.065, 0);
      kunaiGrp.add(kBlade, kHandle, kRing);
      kunaiGrp.position.set(-0.22 + k * 0.085, 0.54 - k * 0.04, 0.265);
      kunaiGrp.rotation.z = -0.45;
      chestRig.add(kunaiGrp);
    }

    this.upperBodyGroup.add(chestRig);

    // 3. OMBREIRAS NINJA SEGMENTADAS 3D (SHINOBI PAULDRONS)
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pauldronGrp = new THREE.Group();

      const upperPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.38), obsidianMat);
      upperPlate.position.set(sign * 0.06, 0.04, 0);
      upperPlate.rotation.z = -sign * 0.24;

      const lowerPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.36), darkGraphiteMat);
      lowerPlate.position.set(sign * 0.08, -0.06, 0);
      lowerPlate.rotation.z = -sign * 0.32;

      const crimsonEdge = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.04, 0.39), scarletGlowMat);
      crimsonEdge.position.set(sign * 0.065, 0.08, 0);
      crimsonEdge.rotation.z = -sign * 0.24;

      const bladeFin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 4), crimsonMat);
      bladeFin.position.set(sign * 0.16, 0.13, -0.02);
      bladeFin.rotation.z = -sign * 0.55;

      pauldronGrp.add(upperPlate, lowerPlate, crimsonEdge, bladeFin);
      armPivot.add(pauldronGrp);
    }

    // 4. ANTEBRAÇOS BLINDADOS (TEKKO-KAGI) COM LÂMINAS LATERAIS SERRILHADAS
    for (const [handGrp, sign] of [[this.leftHandGroup, 1], [this.rightHandGroup, -1]]) {
      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.25), obsidianMat);
      gauntlet.position.set(0, -0.12, 0);
      const gauntletStrap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.045, 0.26), crimsonMat);
      gauntletStrap.position.set(0, -0.12, 0);

      for (const zOff of [-0.04, 0.04]) {
        const clawFin = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.22, 4), scarletGlowMat);
        clawFin.position.set(sign * 0.14, -0.08, zOff);
        clawFin.rotation.z = -sign * 0.38;
        handGrp.add(clawFin);
      }
      handGrp.add(gauntlet, gauntletStrap);
    }

    // 5. CINTURÃO SHINOBI (OBI), BOMBAS DE FUMAÇA, SHURIKENS 3D & CANELEIRAS SUNEATE
    const beltGrp = new THREE.Group();
    const obiSash = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 0.46), crimsonMat);
    obiSash.position.set(0, 0.08, 0);
    beltGrp.add(obiSash);

    for (const side of [-1, 1]) {
      const smokeBomb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), darkGraphiteMat);
      smokeBomb.position.set(side * 0.26, 0.08, 0.24);
      const bombRing = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.025, 12), scarletGlowMat);
      bombRing.position.set(side * 0.26, 0.08, 0.24);
      beltGrp.add(smokeBomb, bombRing);
    }

    for (const side of [-1, 1]) {
      const shuriken = new THREE.Group();
      const sStar1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.16), silverMat);
      const sStar2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.16), silverMat);
      sStar2.rotation.x = Math.PI / 4;
      const sCore = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 10), scarletGlowMat);
      sCore.rotation.z = Math.PI / 2;
      shuriken.add(sStar1, sStar2, sCore);
      shuriken.position.set(side * 0.42, 0.08, 0.04);
      beltGrp.add(shuriken);
    }
    this.hipGroup.add(beltGrp);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const thighHolster = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.44), crimsonMat);
      thighHolster.position.set(0, -0.22, 0);

      const thighKunai = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 4), silverMat);
      thighKunai.position.set(sign * 0.19, -0.22, 0.04);
      thighKunai.rotation.x = Math.PI;

      const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.1), obsidianMat);
      kneeGuard.position.set(0, -0.38, 0.2);
      const kneeGem = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.11), scarletGlowMat);
      kneeGem.position.set(0, -0.38, 0.205);

      const suneateShin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.45), obsidianMat);
      suneateShin.position.set(0, -0.54, 0.01);
      const shinTrim = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 0.46), bloodRedMat);
      shinTrim.position.set(0, -0.46, 0.01);

      legPivot.add(thighHolster, thighKunai, kneeGuard, kneeGem, suneateShin, shinTrim);
    }
  },

  /**
   * Ativa/desativa o efeito visual furtivo (Invisibilidade da Bomba de Fumaça do Sombra Escarlate)
   */
  setStealthVisual(isStealth) {
    if (this.isStealth === isStealth) return;
    this.isStealth = isStealth;
    this.visualRoot.traverse((child) => {
      if (child.isMesh && child.material) {
        if (isStealth) {
          if (!child.userData._preStealthMat) {
            child.userData._preStealthMat = child.material;
            child.material = child.material.clone();
          }
          child.material.transparent = true;
          child.material.opacity = 0.26;
        } else if (child.userData._preStealthMat) {
          const tempMat = child.material;
          child.material = child.userData._preStealthMat;
          child.userData._preStealthMat = null;
          tempMat.dispose();
        }
      }
    });
  }
};
