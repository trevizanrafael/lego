import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';

/**
 * Equipa o Chicote de Corrente de 10 Elos + Adaga-Gancho (mão esquerda)
 * e a Espada "Hellfire V8" de Plasma Ciano (mão direita) do Turbo Fantasma (#6).
 */
export function attachTurboChainAndSword(minifig, leftHandGroup, rightHandGroup) {
  const leatherBlack = getLegoMaterial(0x090a0d, { roughness: 0.28, clearcoat: 0.45 });
  const darkSteel = getLegoMaterial(0x1e293b, { metalness: 0.72, roughness: 0.24 });
  const chromeSteel = getLegoMaterial(0xe2e8f0, { metalness: 0.86, roughness: 0.14 });
  const skullBoneMat = getLegoMaterial(0xf8fafc, { roughness: 0.2, metalness: 0.25 });
  const deepBlueFlame = getLegoMaterial(0x0284c7, {
    emissive: 0x0369a1,
    emissiveIntensity: 2.0,
    roughness: 0.1
  });
  const cyanGlow = getLegoMaterial(0x06b6d4, {
    emissive: 0x00f5d4,
    emissiveIntensity: 2.4,
    roughness: 0.08
  });
  const whiteHotMat = getLegoMaterial(0xffffff, {
    emissive: 0x67e8f9,
    emissiveIntensity: 3.0,
    roughness: 0.05
  });

  // 1. MÃO ESQUERDA: CHICOTE DE CORRENTE DE FOGO FANTASMA (10 ELOS + ADAGA-GANCHO SERRILHADA)
  const chainGroup = new THREE.Group();
  chainGroup.position.set(0.04, -0.28, 0.12);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.26, 12), leatherBlack);
  handle.rotation.x = Math.PI / 2;
  const handlePommel = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12), chromeSteel);
  handlePommel.position.set(0, 0, -0.13);
  chainGroup.add(handle, handlePommel);

  for (let l = 0; l < 10; l++) {
    const u = l / 9;
    const linkMat = l % 3 === 0 ? whiteHotMat : l % 2 === 0 ? cyanGlow : chromeSteel;
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.013, 7, 14), linkMat);
    const curveY = -Math.sin(u * Math.PI * 0.75) * 0.22;
    const curveX = Math.sin(u * Math.PI) * 0.05;
    link.position.set(curveX, curveY, 0.15 + l * 0.088);
    if (l % 2 === 0) {
      link.rotation.y = Math.PI / 2;
    } else {
      link.rotation.x = 0.35;
    }
    chainGroup.add(link);
  }

  const daggerGroup = new THREE.Group();
  daggerGroup.position.set(0, -0.16, 1.04);
  daggerGroup.rotation.x = 0.38;

  const daggerCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.035, 0.1, 10), chromeSteel);
  daggerCollar.rotation.x = Math.PI / 2;
  const daggerSpine = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.08, 0.28), leatherBlack);
  daggerSpine.position.set(0, 0.01, 0.14);
  const daggerBlade = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 4), cyanGlow);
  daggerBlade.scale.set(0.38, 1.0, 1.0);
  daggerBlade.rotation.x = Math.PI / 2;
  daggerBlade.rotation.z = Math.PI / 4;
  daggerBlade.position.set(0, 0, 0.22);

  const hookBarb = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 4), whiteHotMat);
  hookBarb.position.set(0, -0.09, 0.18);
  hookBarb.rotation.x = -2.35;

  daggerGroup.add(daggerCollar, daggerSpine, daggerBlade, hookBarb);
  chainGroup.add(daggerGroup);

  leftHandGroup.add(chainGroup);
  minifig.turboChainGroups.push(chainGroup);

  // 2. MÃO DIREITA: ESPADA "HELLFIRE V8" DE PLASMA CIANO (BLOCO V-TWIN NA GUARDA + LABAREDAS)
  const swordGroup = new THREE.Group();

  const swordGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.44, 12), leatherBlack);
  swordGrip.rotation.x = Math.PI / 2;
  swordGrip.position.set(0, 0, -0.06);
  swordGroup.add(swordGrip);

  for (const gz of [-0.22, -0.12, -0.02, 0.08]) {
    const gripRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 6, 14), chromeSteel);
    gripRing.position.set(0, 0, gz);
    swordGroup.add(gripRing);
  }

  const pommelSkull = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.1), skullBoneMat);
  pommelSkull.position.set(0, 0, -0.31);
  const pommelEyes = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.032, 0.045), cyanGlow);
  pommelEyes.position.set(0, 0.015, -0.32);
  swordGroup.add(pommelSkull, pommelEyes);

  const vTwinCenter = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.16), leatherBlack);
  vTwinCenter.position.set(0, 0, 0.18);
  const guardReactorRing = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.016, 8, 16), chromeSteel);
  guardReactorRing.rotation.y = Math.PI / 2;
  guardReactorRing.position.set(0, 0, 0.18);
  const guardReactor = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 12), whiteHotMat);
  guardReactor.position.set(0, 0, 0.18);
  swordGroup.add(vTwinCenter, guardReactorRing, guardReactor);

  for (const side of [-1, 1]) {
    const cylinderHead = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.16, 10), darkSteel);
    cylinderHead.position.set(0, side * 0.11, 0.16);
    cylinderHead.rotation.x = side * 0.45;
    const finCap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.035, 10), chromeSteel);
    finCap.position.set(0, side * 0.16, 0.19);
    finCap.rotation.x = side * 0.45;

    const sidePipeGroup = new THREE.Group();
    sidePipeGroup.position.set(0, side * 0.14, 0.22);
    sidePipeGroup.rotation.z = side > 0 ? -0.35 : Math.PI + 0.35;
    sidePipeGroup.rotation.x = -0.38;

    const sidePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.18, 10), chromeSteel);
    const sideFlame = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.22, 6), cyanGlow);
    sideFlame.position.set(0, 0.09 + 0.08, 0);
    const sideInner = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.16, 5), whiteHotMat);
    sideInner.position.set(0, 0.09 + 0.06, 0);
    sidePipeGroup.add(sidePipe, sideFlame, sideInner);

    swordGroup.add(cylinderHead, finCap, sidePipeGroup);
  }

  const bladeObsidianCore = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 1.48), leatherBlack);
  bladeObsidianCore.position.set(0, 0, 0.98);
  const bladeChromeFuller = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.038, 1.36), chromeSteel);
  bladeChromeFuller.position.set(0, 0, 0.94);

  const edgeTopCyan = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.065, 1.54), cyanGlow);
  edgeTopCyan.position.set(0, 0.085, 1.01);
  const edgeTopWhite = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 1.52), whiteHotMat);
  edgeTopWhite.position.set(0, 0.065, 1.0);

  const edgeBotCyan = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.05, 1.48), deepBlueFlame);
  edgeBotCyan.position.set(0, -0.075, 0.98);

  const swordTip = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.38, 4), whiteHotMat);
  swordTip.rotation.x = Math.PI / 2;
  swordTip.rotation.z = Math.PI / 4;
  swordTip.scale.set(0.32, 1.0, 1.0);
  swordTip.position.set(0, 0.01, 1.92);

  swordGroup.add(bladeObsidianCore, bladeChromeFuller, edgeTopCyan, edgeTopWhite, edgeBotCyan, swordTip);

  for (let t = 0; t < 8; t++) {
    const mat = t % 3 === 0 ? whiteHotMat : t % 2 === 0 ? cyanGlow : deepBlueFlame;
    const bladeFlame = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.22, 5), mat);
    bladeFlame.scale.set(0.55, 1.0, 1.25);
    bladeFlame.position.set(0, 0.135, 0.38 + t * 0.18);
    bladeFlame.rotation.x = -0.68;
    swordGroup.add(bladeFlame);
  }

  swordGroup.position.set(0, -0.34, 0.1);
  swordGroup.rotation.x = Math.PI / 2 - 0.14;
  rightHandGroup.add(swordGroup);
  minifig.turboSwordGroup = swordGroup;
}

/**
 * Equipa a Manopla de Arco Voltaico Giratório (mão esquerda)
 * e a Alabarda / Tridente "Tempestade Imperial" de 1.65m (mão direita) do Voltaico (#7).
 */
export function attachVoltaicoClawAndHalberd(minifig, leftHandGroup, rightHandGroup) {
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

  // 1. MÃO ESQUERDA: MANOPLA DE ARCO VOLTAICO GIRATÓRIO + 3 GARRAS DE RELÂMPAGO
  const leftClawGroup = new THREE.Group();
  leftClawGroup.position.set(0, -0.32, 0.14);

  const conductorRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.024, 8, 20), goldConductor);
  leftClawGroup.add(conductorRing);

  const centerSpark = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), whiteSpark);
  leftClawGroup.add(centerSpark);

  for (let c = 0; c < 3; c++) {
    const ang = (c / 3) * Math.PI * 2;
    const arcClaw = new THREE.Group();
    arcClaw.rotation.z = ang;

    const emitterNode = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), silverTitanium);
    emitterNode.position.set(0, 0.16, 0);

    const boltSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.18), electricCyan);
    boltSeg1.position.set(0, 0.17, 0.09);
    boltSeg1.rotation.x = 0.28;

    const boltTip = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.22, 4), whiteSpark);
    boltTip.rotation.x = Math.PI / 2 + 0.35;
    boltTip.position.set(0, 0.12, 0.24);

    arcClaw.add(emitterNode, boltSeg1, boltTip);
    leftClawGroup.add(arcClaw);
  }

  leftHandGroup.add(leftClawGroup);
  minifig.voltaicoLeftClawGroup = leftClawGroup;

  // 2. MÃO DIREITA: ALABARDA / TRIDENTE DE GUERRA "TEMPESTADE IMPERIAL" (1.65m)
  const staffGroup = new THREE.Group();
  staffGroup.position.set(0, -0.26, 0.14);

  const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 1.34, 12), darkTitanium);
  mainShaft.rotation.x = Math.PI / 2;
  mainShaft.position.set(0, 0, 0.38);
  staffGroup.add(mainShaft);

  const shaftArmorSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.52, 12), cobaltArmor);
  shaftArmorSleeve.rotation.x = Math.PI / 2;
  shaftArmorSleeve.position.set(0, 0, 0.62);
  staffGroup.add(shaftArmorSleeve);

  const pommelRing = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 8, 14), goldConductor);
  pommelRing.position.set(0, 0, -0.28);
  const pommelSpike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), electricCyan);
  pommelSpike.rotation.x = -Math.PI / 2;
  pommelSpike.position.set(0, 0, -0.37);
  staffGroup.add(pommelRing, pommelSpike);

  for (const zRing of [0.18, 0.48, 0.78, 0.94]) {
    const coilRing = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.018, 8, 16), goldConductor);
    coilRing.position.set(0, 0, zRing);
    staffGroup.add(coilRing);
  }

  const crossguardBlock = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.14), goldConductor);
  crossguardBlock.position.set(0, 0, 1.06);
  const crossguardSilver = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.1), silverTitanium);
  crossguardSilver.position.set(0, 0, 1.06);
  staffGroup.add(crossguardBlock, crossguardSilver);

  const halberdCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 1), whiteSpark);
  halberdCore.position.set(0, 0, 1.08);
  staffGroup.add(halberdCore);
  minifig.voltaicoStaffOrb = halberdCore;

  for (const side of [-1, 1]) {
    const guardWing = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.28, 4), electricCyan);
    guardWing.scale.set(0.45, 1.0, 1.0);
    guardWing.position.set(side * 0.22, 0, 1.02);
    guardWing.rotation.z = -side * 1.15;
    guardWing.rotation.x = -0.35;

    const prongBase = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.065, 0.24), cobaltArmor);
    prongBase.position.set(side * 0.15, 0, 1.18);
    prongBase.rotation.y = -side * 0.18;

    const prongBlade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 4), goldConductor);
    prongBlade.scale.set(0.55, 1.0, 1.0);
    prongBlade.rotation.x = Math.PI / 2;
    prongBlade.rotation.z = Math.PI / 4;
    prongBlade.position.set(side * 0.16, 0, 1.42);

    const prongSpark = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.025), whiteSpark);
    prongSpark.position.set(side * 0.08, 0, 1.38);
    prongSpark.rotation.y = side * 0.42;

    staffGroup.add(guardWing, prongBase, prongBlade, prongSpark);
  }

  const spearSpine = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.38), silverTitanium);
  spearSpine.position.set(0, 0, 1.28);

  const spearPlasmaEdge = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.62, 4), electricCyan);
  spearPlasmaEdge.rotation.x = Math.PI / 2;
  spearPlasmaEdge.rotation.z = Math.PI / 4;
  spearPlasmaEdge.scale.set(1.0, 0.28, 1.0);
  spearPlasmaEdge.position.set(0, 0, 1.42);

  const spearWhiteCore = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.58, 4), whiteSpark);
  spearWhiteCore.rotation.x = Math.PI / 2;
  spearWhiteCore.rotation.z = Math.PI / 4;
  spearWhiteCore.scale.set(1.0, 0.34, 1.0);
  spearWhiteCore.position.set(0, 0, 1.44);

  staffGroup.add(spearSpine, spearPlasmaEdge, spearWhiteCore);
  rightHandGroup.add(staffGroup);
}

export const energyAndMeleeWeaponMethods = {
  /**
   * Equipa as Duas Katanas Longas Místicas ("Muramasa da Lua de Sangue") do Sombra Escarlate (#5):
   * - Lâmina Larga e Longa (1.42m x 0.16m) com Dorso Obsidiana + Fio de Plasma Escarlate + Ponta Kissaki
   * - Guarda Tsuba Ornamental Dourada/Preta + Cabo Tsuka Longo Trançado com Pomo Dourado
   * - Aura de Chamas Espirituais Escarlates/Negras nas lâminas + 2 Bainhas Saya Cruzadas nas Costas
   */
  _attachDualKatanas(leftHandGroup, rightHandGroup) {
    const obsidianMat = getLegoMaterial(0x090a0d, { roughness: 0.22, metalness: 0.55, clearcoat: 0.6 });
    const crimsonWrapMat = getLegoMaterial(0xdc2626, { roughness: 0.22 });
    const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.68, roughness: 0.16 });
    const bladeEdgeMat = getLegoMaterial(0xff1e42, {
      emissive: 0xef4444,
      emissiveIntensity: 2.35,
      roughness: 0.08,
      clearcoat: 0.85
    });
    const whiteRoseCoreMat = getLegoMaterial(0xfecaca, {
      emissive: 0xffffff,
      emissiveIntensity: 2.1,
      roughness: 0.06
    });
    const shadowFlameMat = getLegoMaterial(0x18181b, {
      emissive: 0x991b1b,
      emissiveIntensity: 0.85
    });

    const buildKatana = (sideSign) => {
      const katana = new THREE.Group();

      const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.04, 0.42, 12), obsidianMat);
      tsuka.rotation.x = Math.PI / 2;
      tsuka.position.set(0, 0, -0.08);
      katana.add(tsuka);

      for (let w = 0; w < 5; w++) {
        const wrapRing = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.036), crimsonWrapMat);
        wrapRing.position.set(0, 0, -0.23 + w * 0.075);
        wrapRing.rotation.z = Math.PI / 4;
        katana.add(wrapRing);
      }

      const kashiraPommel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.044, 0.05, 12), goldMat);
      kashiraPommel.rotation.x = Math.PI / 2;
      kashiraPommel.position.set(0, 0, -0.30);
      katana.add(kashiraPommel);

      const tsubaOuter = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.042), goldMat);
      tsubaOuter.position.set(0, 0, 0.14);
      tsubaOuter.rotation.z = Math.PI / 4;
      const tsubaInner = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.048), obsidianMat);
      tsubaInner.position.set(0, 0, 0.14);
      const habaki = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.15, 0.09), goldMat);
      habaki.position.set(0, 0.005, 0.19);
      katana.add(tsubaOuter, tsubaInner, habaki);

      const bladeSpine = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.092, 1.38), obsidianMat);
      bladeSpine.position.set(0, -0.028, 0.88);
      bladeSpine.castShadow = true;
      katana.add(bladeSpine);

      const bladeEdge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 1.42), bladeEdgeMat);
      bladeEdge.position.set(0, 0.032, 0.90);
      bladeEdge.castShadow = true;
      katana.add(bladeEdge);

      const hamonLine = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.028, 1.38), whiteRoseCoreMat);
      hamonLine.position.set(0, 0.004, 0.89);
      katana.add(hamonLine);

      const kissakiTip = new THREE.Mesh(new THREE.ConeGeometry(0.088, 0.26, 4), bladeEdgeMat);
      kissakiTip.rotation.x = Math.PI / 2;
      kissakiTip.rotation.z = Math.PI / 4;
      kissakiTip.scale.set(0.38, 1.0, 1.0);
      kissakiTip.position.set(0, 0.008, 1.68);
      katana.add(kissakiTip);

      for (let f = 0; f < 4; f++) {
        const auraCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.048, 0.22, 4),
          f % 2 === 0 ? bladeEdgeMat : shadowFlameMat
        );
        const baseZ = 0.36 + f * 0.32;
        auraCone.position.set(sideSign * 0.02, 0.055, baseZ);
        auraCone.rotation.x = -Math.PI * 0.35;
        katana.add(auraCone);
        this.katanaAuraFlames.push({
          mesh: auraCone,
          baseZ,
          phase: f * 1.3 + (sideSign > 0 ? 0 : 0.8)
        });
      }

      katana.position.set(0, -0.34, 0.08);
      katana.rotation.x = Math.PI / 2 - 0.16;
      return katana;
    };

    this.leftKatanaGroup = buildKatana(1);
    this.rightKatanaGroup = buildKatana(-1);
    leftHandGroup.add(this.leftKatanaGroup);
    rightHandGroup.add(this.rightKatanaGroup);

    // 2 Bainhas Cruzadas em X nas Costas (Saya) em Laca Preta com Anéis Dourados e Escarlates
    for (const sign of [-1, 1]) {
      const sayaGroup = new THREE.Group();
      const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.24, 0.12), obsidianMat);
      scabbard.castShadow = true;
      sayaGroup.add(scabbard);

      for (const ringY of [-0.42, 0.0, 0.42]) {
        const ring = new THREE.Mesh(
          new THREE.BoxGeometry(0.088, 0.055, 0.132),
          ringY === 0 ? goldMat : crimsonWrapMat
        );
        ring.position.set(0, ringY, 0);
        sayaGroup.add(ring);
      }

      const kojiriTip = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.09, 0.126), goldMat);
      kojiriTip.position.set(0, -0.62, 0);
      sayaGroup.add(kojiriTip);

      sayaGroup.position.set(0, 0.42, -0.28);
      sayaGroup.rotation.z = sign * 0.56;
      this.upperBodyGroup.add(sayaGroup);
    }
  },

  /**
   * Adiciona esferas de plasma solar incandescente + anéis solares giratórios nas mãos do Solaris
   */
  _attachSolarOrbs(leftHandGroup, rightHandGroup) {
    const coreMat = getLegoMaterial(0xffffff, {
      emissive: 0xfef08a,
      emissiveIntensity: 2.5,
      roughness: 0.08
    });
    const orbMat = getLegoMaterial(0xfef08a, {
      emissive: 0xf97316,
      emissiveIntensity: 1.85,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    const ringMat = getLegoMaterial(LEGO_COLORS.gold, {
      emissive: 0xfacc15,
      emissiveIntensity: 1.6,
      metalness: 0.65,
      roughness: 0.15
    });

    for (const hand of [leftHandGroup, rightHandGroup]) {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), coreMat);
      core.position.set(0, -0.36, 0.09);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 14), orbMat);
      orb.position.set(0, -0.36, 0.09);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 20), ringMat);
      ring.position.set(0, -0.36, 0.09);
      ring.rotation.x = Math.PI / 3;
      hand.add(core, orb, ring);
    }
  }
};
