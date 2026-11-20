import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { VORTEX_BASE_SCALE, VORTEX_MONSTER_SCALE } from './HeroProfilesCatalog.js';
import { attachTitaShieldAndVulcan } from './WeaponAndGearBuilder.js';

/**
 * Constrói o Capacete Blindado de Ciborgue Mutante da PMESP (`mecha_helmet`) do Titã Blindado (#3).
 */
export function attachTitaMechaHelmet(minifig) {
  const pmWhiteMat = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.6 });
  const pmGreyMat = getLegoMaterial(0x334155, { roughness: 0.24, metalness: 0.45 });
  const pmBlackMat = getLegoMaterial(0x090a0d, { roughness: 0.3, metalness: 0.4 });
  const pmRedMat = getLegoMaterial(0xdc2626, { roughness: 0.2, clearcoat: 0.55 });
  const redLaserMat = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.2 });
  const blueSirenMat = getLegoMaterial(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 2.0 });

  // Domo Policial Superior em Branco PMESP + Faixa Vermelha Institucional
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.4, 0.16, 28), pmWhiteMat);
  dome.position.set(0, 0.62, 0);
  dome.castShadow = true;
  minifig.headGroup.add(dome);

  const redBand = new THREE.Mesh(new THREE.CylinderGeometry(0.402, 0.402, 0.05, 28), pmRedMat);
  redBand.position.set(0, 0.56, 0);
  minifig.headGroup.add(redBand);

  // Crista Blindada Central Vermelha/Cinza + 2 Giroflex Policiais 3D no Topo do Capacete
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.54), pmRedMat);
  crest.position.set(0, 0.72, 0.02);
  minifig.headGroup.add(crest);

  for (const side of [-1, 1]) {
    const sirenPod = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.18),
      side < 0 ? redLaserMat : blueSirenMat
    );
    sirenPod.position.set(side * 0.19, 0.71, 0.06);
    minifig.headGroup.add(sirenPod);
    minifig.titaSirenLights.push({ mesh: sirenPod, isRed: side < 0 });
  }

  // Visor Tático Vermelho-Laser 3D em V agressivo na testa/olhos
  const visorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.16), pmBlackMat);
  visorFrame.position.set(0, 0.42, 0.32);
  const visorLaser = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.09, 0.18), redLaserMat);
  visorLaser.position.set(0, 0.42, 0.33);
  minifig.headGroup.add(visorFrame, visorLaser);

  // Queixeira / Mandíbula Mecânica Pesada 3D (Juggernaut Jaw Guard)
  const jawGuard = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.26), pmGreyMat);
  jawGuard.position.set(0, 0.16, 0.24);
  const jawGrill = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.28), pmBlackMat);
  jawGrill.position.set(0, 0.16, 0.25);
  const jawGlow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.29), redLaserMat);
  jawGlow.position.set(0, 0.16, 0.255);
  minifig.headGroup.add(jawGuard, jawGrill, jawGlow);

  // Blindagem auricular lateral + Antenas Táticas da PMESP
  for (const side of [-1, 1]) {
    const earPod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.28), pmGreyMat);
    earPod.position.set(side * 0.38, 0.36, 0);
    const earStripe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.29), pmRedMat);
    earStripe.position.set(side * 0.38, 0.36, 0);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 8), pmBlackMat);
    antenna.position.set(side * 0.4, 0.6, -0.06);
    minifig.headGroup.add(earPod, earStripe, antenna);
  }
}

export const bigFigRigMethods = {
  /**
   * Equipa o Chassi Colossal de "PM Robô Mutante Gigante da PMESP" (Titã Blindado #3):
   * - Peitoral Blindado 3D Estufado + Gola/Trapézio Mecânico Gigante + Barra de Giroflex Policial nas Costas
   * - Ombreiras Colossais de Viatura + Tubos de Bio-Energia Vermelha Pulsante (Mutant Bio-Cables)
   * - Mochila Propulsora Dupla a Jato + Pernas Blindadas com Pistões Hidráulicos e Botas Esmagadoras
   * - Escudo de Choque PMESP no braço esquerdo + Minigun Vulcan Rotativa de 6 Canos no braço direito!
   */
  _attachTitaBigFigRig(leftHandGroup, rightHandGroup) {
    const pmWhite = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.6 });
    const pmGrey = getLegoMaterial(0x475569, { roughness: 0.24, metalness: 0.45 });
    const pmDarkGrey = getLegoMaterial(0x1e293b, { roughness: 0.26, metalness: 0.55 });
    const pmBlack = getLegoMaterial(0x090a0d, { roughness: 0.32, metalness: 0.35 });
    const pmRed = getLegoMaterial(0xdc2626, { roughness: 0.2, clearcoat: 0.55 });
    const silverSteel = getLegoMaterial(LEGO_COLORS.silver, { roughness: 0.16, metalness: 0.75 });
    const redGlow = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.2 });
    const whiteRedCore = getLegoMaterial(0xffffff, { emissive: 0xfca5a5, emissiveIntensity: 2.5 });
    const blueSiren = getLegoMaterial(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 2.0 });

    // 1. PEITORAL BLINDADO 3D ESTUFADO + GOLA MECÂNICA GIGANTE + REATOR PMESP
    const chestRig = new THREE.Group();

    const upperChestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.44, 0.16),
      pmWhite
    );
    upperChestPlate.position.set(0, 0.52, 0.22);
    upperChestPlate.castShadow = true;
    chestRig.add(upperChestPlate);

    const lowerAbPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.3, 0.12),
      pmGrey
    );
    lowerAbPlate.position.set(0, 0.21, 0.21);
    chestRig.add(lowerAbPlate);

    for (const side of [-1, 1]) {
      const chevronStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.11, 0.045),
        pmRed
      );
      chevronStripe.position.set(side * 0.28, 0.56, 0.295);
      chevronStripe.rotation.z = -side * 0.34;
      chestRig.add(chevronStripe);

      const abPiston = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.28, 12),
        silverSteel
      );
      abPiston.position.set(side * 0.34, 0.24, 0.25);
      chestRig.add(abPiston);
    }

    const mechCollarBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 0.24, 0.28),
      pmDarkGrey
    );
    mechCollarBack.position.set(0, 0.78, -0.1);
    chestRig.add(mechCollarBack);

    for (const side of [-1, 1]) {
      const trapArmor = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.22, 0.44),
        pmWhite
      );
      trapArmor.position.set(side * 0.36, 0.76, 0.02);
      trapArmor.rotation.z = -side * 0.22;
      const trapStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.29, 0.06, 0.45),
        pmRed
      );
      trapStripe.position.set(side * 0.36, 0.82, 0.02);
      trapStripe.rotation.z = -side * 0.22;
      chestRig.add(trapArmor, trapStripe);
    }

    const lightbarBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.06, 0.16),
      pmBlack
    );
    lightbarBase.position.set(0, 0.92, -0.14);
    const lightLeft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.14), redGlow);
    lightLeft.position.set(-0.21, 0.96, -0.14);
    const lightCenter = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.14), pmWhite);
    lightCenter.position.set(0, 0.96, -0.14);
    const lightRight = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.14), blueSiren);
    lightRight.position.set(0.21, 0.96, -0.14);
    chestRig.add(lightbarBase, lightLeft, lightCenter, lightRight);
    this.titaSirenLights.push(
      { mesh: lightLeft, isRed: true },
      { mesh: lightRight, isRed: false }
    );

    const reactorRing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 22), pmBlack);
    reactorRing.rotation.x = Math.PI / 2;
    reactorRing.position.set(0, 0.44, 0.29);
    const reactorOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 20), redGlow);
    reactorOuter.rotation.x = Math.PI / 2;
    reactorOuter.position.set(0, 0.44, 0.3);
    const reactorInner = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 14), whiteRedCore);
    reactorInner.position.set(0, 0.44, 0.33);
    chestRig.add(reactorRing, reactorOuter, reactorInner);

    for (const side of [-1, 1]) {
      const bioCable = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.042, 10, 20, Math.PI * 0.95),
        redGlow
      );
      bioCable.position.set(side * 0.42, 0.62, -0.16);
      bioCable.rotation.y = side * 0.65;
      bioCable.rotation.x = 0.35;
      chestRig.add(bioCable);
    }

    this.upperBodyGroup.add(chestRig);

    // 2. OMBREIRAS DE VIATURA BLINDADA + BRAÇOS MUTANTES HIDRÁULICOS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      armPivot.position.x = sign * 0.62;
      const pauldronGroup = new THREE.Group();

      const pauldronUpper = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.62), pmWhite);
      pauldronUpper.position.set(sign * 0.1, 0.12, 0);
      pauldronUpper.rotation.z = -sign * 0.12;
      pauldronUpper.castShadow = true;

      const pauldronLower = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.64), pmGrey);
      pauldronLower.position.set(sign * 0.09, -0.06, 0);
      pauldronLower.rotation.z = -sign * 0.12;

      const pmStripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 0.65), pmRed);
      pmStripe.position.set(sign * 0.1, 0.04, 0);
      pmStripe.rotation.z = -sign * 0.12;

      const shoulderPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.38, 12), silverSteel);
      shoulderPiston.position.set(sign * 0.24, -0.06, -0.14);

      for (const sz of [-0.14, 0.14]) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 14), pmRed);
        stud.position.set(sign * 0.12, 0.28, sz);
        pauldronGroup.add(stud);
      }

      pauldronGroup.add(pauldronUpper, pauldronLower, pmStripe, shoulderPiston);
      armPivot.add(pauldronGroup);
    }

    for (const [hand, sign] of [[leftHandGroup, 1], [rightHandGroup, -1]]) {
      const forearmArmor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.34), pmGrey);
      forearmArmor.position.set(0, -0.12, 0);
      const forearmStripe = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.07, 0.35), pmRed);
      forearmStripe.position.set(0, -0.12, 0);
      const wristPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.28, 10), silverSteel);
      wristPiston.position.set(sign * 0.16, -0.14, -0.06);

      const bigFist = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.36), pmRed);
      bigFist.position.set(0, -0.35, 0.04);
      bigFist.castShadow = true;
      const knucklePlate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), silverSteel);
      knucklePlate.position.set(0, -0.36, 0.19);
      hand.add(forearmArmor, forearmStripe, wristPiston, bigFist, knucklePlate);
    }

    // 3. COSTAS — MOCHILA PROPULSORA DUPLA A JATO + REATOR DORSAL MUTANTE
    const jetpack = new THREE.Group();
    jetpack.position.set(0, 0.44, -0.34);

    const packBox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.6, 0.3), pmDarkGrey);
    packBox.castShadow = true;
    const packWhiteCap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.18, 0.32), pmWhite);
    packWhiteCap.position.set(0, 0.22, 0);
    const packRedStripe = new THREE.Mesh(new THREE.BoxGeometry(0.79, 0.08, 0.33), pmRed);
    packRedStripe.position.set(0, 0.1, 0);

    const bioTank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 16), redGlow);
    bioTank.position.set(0, -0.04, -0.14);
    jetpack.add(packBox, packWhiteCap, packRedStripe, bioTank);

    for (const sx of [-0.26, 0.26]) {
      const thrusterHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.42, 16), silverSteel);
      thrusterHousing.position.set(sx, -0.18, -0.08);
      thrusterHousing.rotation.x = 0.18;

      const nozzleRim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.08, 16), pmBlack);
      nozzleRim.position.set(sx, -0.38, -0.11);
      nozzleRim.rotation.x = 0.18;

      const nozzleGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), redGlow);
      nozzleGlow.position.set(sx, -0.41, -0.12);
      nozzleGlow.rotation.x = 0.18;

      const jetFlame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.58, 10), redGlow);
      jetFlame.position.set(sx, -0.68, -0.17);
      jetFlame.rotation.x = Math.PI + 0.18;
      jetFlame.visible = false;
      this.titaDashFlameMeshes.push(jetFlame);

      jetpack.add(thrusterHousing, nozzleRim, nozzleGlow, jetFlame);
    }
    this.upperBodyGroup.add(jetpack);

    // 4. PERNAS BLINDADAS COM PISTÕES HIDRÁULICOS & BOTAS ESMAGADORAS
    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.15, 0.48), pmBlack);
    beltBand.position.set(0, 0.08, 0);
    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.08), pmRed);
    beltBuckle.position.set(0, 0.08, 0.24);
    this.hipGroup.add(beltBand, beltBuckle);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const thighArmor = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.24, 0.44), pmWhite);
      thighArmor.position.set(0, -0.18, 0.02);
      const thighStripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.45), pmRed);
      thighStripe.position.set(0, -0.18, 0.02);

      const kneeArmor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.16), pmRed);
      kneeArmor.position.set(0, -0.38, 0.19);
      const kneeCore = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.06), redGlow);
      kneeCore.position.set(0, -0.38, 0.26);

      const legPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.44, 10), silverSteel);
      legPiston.position.set(sign * 0.21, -0.38, 0.02);

      const heavyBoot = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.22, 0.48), pmDarkGrey);
      heavyBoot.position.set(0, -0.54, 0.03);
      const stomperSole = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.6), pmBlack);
      stomperSole.position.set(0, -0.64, 0.09);
      const toeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.16), silverSteel);
      toeGuard.position.set(0, -0.61, 0.34);

      legPivot.add(thighArmor, thighStripe, kneeArmor, kneeCore, legPiston, heavyBoot, stomperSole, toeGuard);
    }

    // 5 & 6. Escudo de Choque PMESP + Minigun Vulcan de 6 Canos
    attachTitaShieldAndVulcan(this, leftHandGroup, rightHandGroup);
  },

  /**
   * HERÓI #8 (Vórtex): Alterna em tempo real entre Forma Normal Ágil e Forma Big-Fig Monstruosa Colossal [F]!
   */
  setVortexMonsterForm(isMonster) {
    if (this.currentHeroKey !== 'vortex') return;
    this.isVortexMonster = Boolean(isMonster);
    this.isBigFig = this.isVortexMonster;

    if (this.isVortexMonster) {
      this.visualRoot.scale.set(
        VORTEX_MONSTER_SCALE.x,
        VORTEX_MONSTER_SCALE.y,
        VORTEX_MONSTER_SCALE.z
      );
      for (const sp of this.vortexMonsterSpikes) {
        sp.scale.set(1.45, 1.65, 1.45);
      }
      for (const t of this.vortexTentacles) {
        t.pivot.scale.setScalar(1.32);
      }
    } else {
      this.visualRoot.scale.set(
        VORTEX_BASE_SCALE.x,
        VORTEX_BASE_SCALE.y,
        VORTEX_BASE_SCALE.z
      );
      for (const sp of this.vortexMonsterSpikes) {
        sp.scale.set(1, 1, 1);
      }
      for (const t of this.vortexTentacles) {
        t.pivot.scale.setScalar(1.0);
      }
    }
  }
};
