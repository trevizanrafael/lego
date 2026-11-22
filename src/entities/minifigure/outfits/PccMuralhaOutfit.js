import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói o Capacete Balístico SWAT/Choque + Viseira Escura Rebatida + Balaclava (`pcc_muralha_helmet`)
 * para o operador tanque de invasão Muralha (PCC).
 */
export function attachPccMuralhaHeadgear(minifig) {
  const headGear = new THREE.Group();
  const abyssBlack = getLegoMaterial(0x07090e, { roughness: 0.35, clearcoat: 0.24 });
  const deepBlue = getLegoMaterial(0x1d4ed8, { roughness: 0.28, clearcoat: 0.35 });
  const riotSteel = getLegoMaterial(0x334155, { roughness: 0.24, metalness: 0.68 });
  const smokedVisor = getLegoMaterial(0x0b1329, {
    roughness: 0.08,
    metalness: 0.45,
    clearcoat: 0.95,
    emissive: 0x1e3a8a,
    emissiveIntensity: 0.42
  });

  // Balaclava escura cobrindo mandíbula e nuca
  const balaclavaLower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.362, 0.358, 0.26, 26),
    abyssBlack
  );
  balaclavaLower.position.set(0, 0.19, 0);
  headGear.add(balaclavaLower);

  // Casco pesado do capacete balístico SWAT/Choque
  const helmetShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.395, 0.41, 0.26, 28),
    abyssBlack
  );
  helmetShell.position.set(0, 0.56, 0);
  helmetShell.castShadow = true;
  const helmetCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.395, 0.1, 26),
    abyssBlack
  );
  helmetCrown.position.set(0, 0.74, 0);
  const napeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.24, 0.12), abyssBlack);
  napeGuard.position.set(0, 0.34, -0.35);
  napeGuard.rotation.x = 0.16;
  const blueCrest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.56), deepBlue);
  blueCrest.position.set(0, 0.77, 0.02);
  headGear.add(helmetShell, helmetCrown, napeGuard, blueCrest);

  // Protetores laterais de orelha + trilhos de aço
  for (const side of [-1, 1]) {
    const earArmor = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.28), abyssBlack);
    earArmor.position.set(side * 0.385, 0.38, -0.02);
    const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.06, 0.26), riotSteel);
    sideRail.position.set(side * 0.425, 0.52, 0.02);
    headGear.add(earArmor, sideRail);
  }

  // Viseira balística escura rebatida na frente do rosto + dobradiça superior de aço
  const visorHinge = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.075, 0.14), riotSteel);
  visorHinge.position.set(0, 0.48, 0.355);
  const visorShield = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.24, 0.07), smokedVisor);
  visorShield.position.set(0, 0.34, 0.385);
  const visorSlitHighlight = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.032, 0.076), deepBlue);
  visorSlitHighlight.position.set(0, 0.37, 0.386);
  headGear.add(visorHinge, visorShield, visorSlitHighlight);

  minifig.headGroup.add(headGear);
}

export const pccMuralhaOutfitMethods = {
  /**
   * Equipa o Rig 3D Completo do Muralha (PCC — Tanque Breacher):
   * - FRENTE: Colete pesado com gola blindada cervical (gorget), bandoleira de cartuchos calibre 12 e placa pélvica;
   * - COSTAS: Placa dorsal reforçada + aríete compacto de arrombamento preso nas costas;
   * - MÃO ESQUERDA: Escudo Balístico Tático Compacto (`this.operatorShieldGroup`) com fenda de visão e aço PCC;
   * - PERNAS & ARMA: Caneleiras Riot de choque + Escopeta de Combate Calibre 12 (`pcc_shotgun12`, `this.rifleGroup`).
   */
  _attachPccMuralhaRig() {
    const abyssBlack = getLegoMaterial(0x07090e, { roughness: 0.36, clearcoat: 0.22 });
    const deepBlue = getLegoMaterial(0x1d4ed8, { roughness: 0.28, clearcoat: 0.34 });
    const darkCobalt = getLegoMaterial(0x1e3a8a, { roughness: 0.32 });
    const riotSteel = getLegoMaterial(0x334155, { roughness: 0.24, metalness: 0.66 });
    const brushedSteel = getLegoMaterial(0x64748b, { roughness: 0.2, metalness: 0.76 });
    const shellRed = getLegoMaterial(0xb91c1c, { roughness: 0.28 });
    const brassMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.22, metalness: 0.7 });
    const slitGlass = getLegoMaterial(0x38bdf8, {
      roughness: 0.1,
      emissive: 0x1d4ed8,
      emissiveIntensity: 1.35
    });

    // 1. FRENTE — COLETE BREACHER PESADO + GOLA BLINDADA + BANDOLEIRA DE CARTUCHOS 12GA
    const frontArmor = new THREE.Group();

    const heavyPlate = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.6, 0.11), abyssBlack);
    heavyPlate.position.set(0, 0.39, 0.24);
    heavyPlate.castShadow = true;
    const steelTraumaInsert = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.38, 0.04), riotSteel);
    steelTraumaInsert.position.set(0, 0.42, 0.295);
    const blueStripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.055, 0.046), deepBlue);
    blueStripe.position.set(0, 0.54, 0.298);
    const groinFlap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.065), abyssBlack);
    groinFlap.position.set(0, 0.02, 0.245);
    frontArmor.add(heavyPlate, steelTraumaInsert, blueStripe, groinFlap);

    // Gola blindada cervical pesada (Breacher Gorget) ao redor do pescoço
    const gorgetFront = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.15, 0.12), abyssBlack);
    gorgetFront.position.set(0, 0.75, 0.21);
    const gorgetBack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.18, 0.12), abyssBlack);
    gorgetBack.position.set(0, 0.77, -0.2);
    for (const sx of [-0.3, 0.3]) {
      const gorgetSide = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.48), darkCobalt);
      gorgetSide.position.set(sx, 0.76, 0);
      frontArmor.add(gorgetSide);
    }
    frontArmor.add(gorgetFront, gorgetBack);

    // Bandoleira diagonal de 6 cartuchos calibre 12 vermelhos com culote de latão
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const sx = -0.24 + t * 0.48;
      const sy = 0.63 - t * 0.38;
      const shellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.09, 8), shellRed);
      shellBody.position.set(sx, sy, 0.322);
      shellBody.rotation.z = 0.66;
      const shellRim = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.024, 8), brassMat);
      shellRim.position.set(sx - 0.032, sy + 0.026, 0.322);
      shellRim.rotation.z = 0.66;
      frontArmor.add(shellBody, shellRim);
    }

    this.upperBodyGroup.add(frontArmor);

    // 2. COSTAS — PLACA DORSAL RIOT + ARÍETE TÁTICO DE ARROMBAMENTO
    const backArmor = new THREE.Group();
    backArmor.position.set(0, 0.41, -0.27);

    const dorsalPlate = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.56, 0.14), abyssBlack);
    dorsalPlate.castShadow = true;
    const spineBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.48, 0.05), riotSteel);
    spineBar.position.set(0, 0, -0.085);
    const ramCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.66, 14), riotSteel);
    ramCylinder.position.set(0.2, 0.02, -0.12);
    ramCylinder.rotation.z = 0.22;
    const ramHead = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.1, 14), brushedSteel);
    ramHead.position.set(0.12, 0.35, -0.12);
    ramHead.rotation.z = 0.22;
    backArmor.add(dorsalPlate, spineBar, ramCylinder, ramHead);

    this.upperBodyGroup.add(backArmor);

    // 3. OMBREIRAS RIOT, ESCUDO BALÍSTICO NA MÃO ESQUERDA (`operatorShieldGroup`) E CANELEIRAS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const riotPauldron = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.4), abyssBlack);
      riotPauldron.position.set(sign * 0.075, -0.04, 0);
      riotPauldron.rotation.z = -sign * 0.14;
      riotPauldron.castShadow = true;
      const steelEdge = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.055, 0.41), brushedSteel);
      steelEdge.position.set(sign * 0.075, -0.15, 0);
      steelEdge.rotation.z = -sign * 0.14;
      const blueBand = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.045, 0.41), deepBlue);
      blueBand.position.set(sign * 0.075, 0.06, 0);
      blueBand.rotation.z = -sign * 0.14;
      armPivot.add(riotPauldron, steelEdge, blueBand);
    }

    // Escudo Balístico Compacto no braço esquerdo (Q pode erguer/expandir `this.operatorShieldGroup`)
    const shieldGroup = new THREE.Group();
    const shieldCore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.88, 0.58), abyssBlack);
    shieldCore.castShadow = true;
    const shieldTopFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), brushedSteel);
    shieldTopFrame.position.set(0, 0.4, 0);
    const shieldBotFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.6), brushedSteel);
    shieldBotFrame.position.set(0, -0.39, 0);
    const shieldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.1, 0.56), deepBlue);
    shieldStripe.position.set(0, 0.06, 0);
    const viewPortFrame = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.14, 0.42), riotSteel);
    viewPortFrame.position.set(0, 0.24, 0);
    const viewPortSlit = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.065, 0.34), slitGlass);
    viewPortSlit.position.set(0, 0.24, 0);
    const armBrace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.32), riotSteel);
    armBrace.position.set(-0.08, 0, -0.02);

    shieldGroup.add(
      shieldCore,
      shieldTopFrame,
      shieldBotFrame,
      shieldStripe,
      viewPortFrame,
      viewPortSlit,
      armBrace
    );
    shieldGroup.position.set(0.2, -0.22, 0.12);
    this.leftHandGroup.add(shieldGroup);
    this.operatorShieldGroup = shieldGroup;

    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.13, 0.5), abyssBlack);
    beltBand.position.set(0, 0.08, 0);
    this.hipGroup.add(beltBand);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const thighPlate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.3), riotSteel);
      thighPlate.position.set(sign * 0.2, -0.2, 0.02);
      const shinGreave = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.14), abyssBlack);
      shinGreave.position.set(0, -0.44, 0.18);
      const shinSteel = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.05), brushedSteel);
      shinSteel.position.set(0, -0.44, 0.24);
      const heavyBoot = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.18, 0.56), abyssBlack);
      heavyBoot.position.set(0, -0.64, 0.07);
      legPivot.add(thighPlate, shinGreave, shinSteel, heavyBoot);
    }

    // 4. ARMA PRIMÁRIA — ESCOPETA DE COMBATE CALIBRE 12 (`pcc_shotgun12`)
    const shotgun = new THREE.Group();

    const sgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.2, 0.58), riotSteel);
    sgReceiver.position.set(0, 0.03, 0.22);
    sgReceiver.castShadow = true;
    const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.68, 12), brushedSteel);
    sgBarrel.rotation.x = Math.PI / 2;
    sgBarrel.position.set(0, 0.08, 0.72);
    const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.62, 12), abyssBlack);
    magTube.rotation.x = Math.PI / 2;
    magTube.position.set(0, -0.01, 0.69);
    const pumpForend = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.12, 0.32), deepBlue);
    pumpForend.position.set(0, -0.015, 0.68);
    const breachChoke = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.056, 0.12, 12), abyssBlack);
    breachChoke.rotation.x = Math.PI / 2;
    breachChoke.position.set(0, 0.08, 1.09);
    const sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.21, 0.32), abyssBlack);
    sgStock.position.set(0, -0.02, -0.18);

    for (let i = 0; i < 3; i++) {
      const sideShell = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.085, 8), shellRed);
      sideShell.position.set(-0.082, 0.03, 0.12 + i * 0.085);
      shotgun.add(sideShell);
    }
    shotgun.add(sgReceiver, sgBarrel, magTube, pumpForend, breachChoke, sgStock);

    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xf97316,
      emissiveIntensity: 2.6,
      transparent: true,
      opacity: 0.94
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(1.05, 1.05, 2.2);
    this.muzzleFlashMesh.position.set(0, 0.08, 1.24);
    this.muzzleFlashMesh.visible = false;
    shotgun.add(this.muzzleFlashMesh);

    shotgun.position.set(0, -0.34, 0.12);
    shotgun.rotation.x = Math.PI / 2 - 0.15;
    this.rightHandGroup.add(shotgun);
    this.rifleGroup = shotgun;
  }
};
