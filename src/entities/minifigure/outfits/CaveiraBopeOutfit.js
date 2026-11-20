import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói a Boina Preta Oficial do BOPE (`beret`) + Insígnia Faca na Caveira 3D
 * + Headset Militar ComTac e Microfone Boom para o Comandante Caveira (#1).
 */
export function attachCaveiraBeretHeadgear(minifig) {
  const beretGroup = new THREE.Group();
  const beretMat = getLegoMaterial(0x090a0d, { roughness: 0.34, clearcoat: 0.25 });
  const graphiteMat = getLegoMaterial(0x1e293b, { roughness: 0.28, metalness: 0.4 });
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.55, roughness: 0.18 });
  const skullWhiteMat = getLegoMaterial(0xf8fafc, { roughness: 0.22 });
  const orangeGlow = getLegoMaterial(0xf97316, { emissive: 0xf97316, emissiveIntensity: 1.8 });

  // Aba inferior tática da Boina Preta Oficial do BOPE
  const beretRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.395, 0.375, 0.11, 28),
    beretMat
  );
  beretRim.position.set(0, 0.61, 0);
  beretGroup.add(beretRim);

  // Fita dourada/preta de comando na base da boina
  const beretTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.398, 0.398, 0.026, 28),
    goldMat
  );
  beretTrim.position.set(0, 0.57, 0);
  beretGroup.add(beretTrim);

  // Topo volumoso inclinado lateralmente da Boina Militar BOPE
  const beretTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.42, 0.14, 28),
    beretMat
  );
  beretTop.position.set(-0.055, 0.69, 0.02);
  beretTop.rotation.z = 0.19;
  beretTop.castShadow = true;
  beretGroup.add(beretTop);

  const beretFlap = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.09, 0.48),
    beretMat
  );
  beretFlap.position.set(-0.24, 0.65, 0.02);
  beretFlap.rotation.z = 0.42;
  beretGroup.add(beretFlap);

  const beretStud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.08, 20),
    beretMat
  );
  beretStud.position.set(-0.05, 0.77, 0.02);
  beretGroup.add(beretStud);

  // Insígnia 3D da Faca na Caveira na frente da Boina
  const badgeGroup = new THREE.Group();
  badgeGroup.position.set(0.11, 0.66, 0.385);
  const badgeShield = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 18), goldMat);
  badgeShield.rotation.x = Math.PI / 2;
  const miniSkull = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), skullWhiteMat);
  miniSkull.position.set(0, 0.01, 0.018);
  const miniJaw = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.028, 0.026), skullWhiteMat);
  miniJaw.position.set(0, -0.022, 0.018);
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.14, 0.016), goldMat);
    blade.rotation.z = s * 0.65;
    blade.position.set(0, 0, 0.01);
    badgeGroup.add(blade);
  }
  badgeGroup.add(badgeShield, miniSkull, miniJaw);
  beretGroup.add(badgeGroup);

  // Headset Tático Militar 3D (ComTac Ear Defenders) + Microfone Boom 3D
  for (const side of [-1, 1]) {
    const earCup = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.22), graphiteMat);
    earCup.position.set(side * 0.37, 0.34, 0);
    earCup.castShadow = true;
    const earCushion = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.24), beretMat);
    earCushion.position.set(side * 0.33, 0.34, 0);
    const earBracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.05), goldMat);
    earBracket.position.set(side * 0.39, 0.48, 0);
    beretGroup.add(earCup, earCushion, earBracket);
  }

  const comAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8), beretMat);
  comAntenna.position.set(0.4, 0.56, -0.06);
  beretGroup.add(comAntenna);

  const micBoom = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.34), beretMat);
  micBoom.position.set(0.28, 0.21, 0.22);
  micBoom.rotation.y = -0.52;
  const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), orangeGlow);
  micTip.position.set(0.16, 0.21, 0.37);
  beretGroup.add(micBoom, micTip);

  minifig.headGroup.add(beretGroup);
}

export const caveiraOutfitMethods = {
  /**
   * Equipa a Armadura e Equipamento Tático 3D Completo do Comandante Caveira (BOPE — OP-01):
   * - FRENTE: Colete Balístico 3D (Plate Carrier), Emblema 3D Faca na Caveira, 3 Porta-Carregadores, 2 Granadas/Cargas e Rádio Militar com Antena;
   * - COSTAS: Mochila Tática Militar 3D (BOPE Assault Pack), Tubo C4 de Demolição e Faca de Combate Tática embainhada na diagonal;
   * - OMBROS & BRAÇOS: Ombreiras Blindadas Chanfradas 3D com friso dourado, Cotoveleiras e Relógio/Detonador Tático GPS no pulso;
   * - CINTO & PERNAS: Cinto de Utilidades 3D, Coldre de Coxa com Pistola 3D, Bolsa de Explosivos, Joelheiras Blindadas e Coturnos Pesados.
   */
  _attachCaveiraBopeRig() {
    const matteBlack = getLegoMaterial(0x090a0d, { roughness: 0.35, clearcoat: 0.2 });
    const tacticalGraphite = getLegoMaterial(0x1e293b, { roughness: 0.28, metalness: 0.4 });
    const darkSteel = getLegoMaterial(0x334155, { roughness: 0.25, metalness: 0.55 });
    const goldMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.18, metalness: 0.65 });
    const skullWhite = getLegoMaterial(0xf8fafc, { roughness: 0.22 });
    const oliveDrab = getLegoMaterial(0x365314, { roughness: 0.35 });
    const orangeLed = getLegoMaterial(0xf97316, { emissive: 0xf97316, emissiveIntensity: 2.0 });
    const redLed = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 1.8 });

    // 1. FRENTE — COLETE BALÍSTICO PESADO 3D (PLATE CARRIER) + EMBLEMA BOPE 3D
    const frontVest = new THREE.Group();

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.56, 0.08), matteBlack);
    chestPlate.position.set(0, 0.39, 0.23);
    chestPlate.castShadow = true;
    frontVest.add(chestPlate);

    const upperTrim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.045, 0.09), goldMat);
    upperTrim.position.set(0, 0.62, 0.235);
    frontVest.add(upperTrim);

    for (const sx of [-0.25, 0.25]) {
      const strapTop = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.52), matteBlack);
      strapTop.position.set(sx, 0.76, 0);
      const strapBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.08), goldMat);
      strapBuckle.position.set(sx, 0.69, 0.24);
      frontVest.add(strapTop, strapBuckle);
    }

    const chestEmblem = new THREE.Group();
    chestEmblem.position.set(0, 0.47, 0.278);
    for (const s of [-1, 1]) {
      const crossedKnife = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.26, 0.015), goldMat);
      crossedKnife.rotation.z = s * 0.68;
      chestEmblem.add(crossedKnife);
    }
    const skullCranium = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 14), skullWhite);
    skullCranium.scale.set(1.0, 1.05, 0.6);
    skullCranium.position.set(0, 0.02, 0.01);
    const skullJaw = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.05), skullWhite);
    skullJaw.position.set(0, -0.045, 0.01);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.03), matteBlack);
    eyeL.position.set(-0.024, 0.022, 0.045);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.03), matteBlack);
    eyeR.position.set(0.024, 0.022, 0.045);
    chestEmblem.add(skullCranium, skullJaw, eyeL, eyeR);
    frontVest.add(chestEmblem);

    for (const mx of [-0.21, 0, 0.21]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.09), tacticalGraphite);
      pouch.position.set(mx, 0.22, 0.265);
      pouch.castShadow = true;
      const pouchFlap = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.06, 0.1), matteBlack);
      pouchFlap.position.set(mx, 0.29, 0.268);
      const magTip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.06), goldMat);
      magTip.position.set(mx, 0.33, 0.265);
      frontVest.add(pouch, pouchFlap, magTip);
    }

    for (const [gx, gy] of [[-0.24, 0.52], [-0.13, 0.52]]) {
      const nadeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.12, 12), oliveDrab);
      nadeBody.position.set(gx, gy, 0.275);
      const nadeRing = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 12), goldMat);
      nadeRing.position.set(gx, gy, 0.275);
      const nadeLed = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.03, 10), orangeLed);
      nadeLed.position.set(gx, gy + 0.07, 0.275);
      frontVest.add(nadeBody, nadeRing, nadeLed);
    }

    const radioBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), tacticalGraphite);
    radioBox.position.set(0.24, 0.54, 0.265);
    const radioLed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), redLed);
    radioLed.position.set(0.21, 0.6, 0.31);
    const radioAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.56, 8), matteBlack);
    radioAntenna.position.set(0.27, 0.88, -0.12);
    frontVest.add(radioBox, radioLed, radioAntenna);

    this.upperBodyGroup.add(frontVest);

    // 2. COSTAS — MOCHILA DE ASSALTO TÁTICA 3D + C4 + FACA DE COMBATE DORSAL
    const backPackGroup = new THREE.Group();
    backPackGroup.position.set(0, 0.41, -0.29);

    const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 0.22), matteBlack);
    packMain.castShadow = true;
    backPackGroup.add(packMain);

    const upperPocket = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.08), tacticalGraphite);
    upperPocket.position.set(0, 0.14, -0.13);
    const lowerPocket = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.09), tacticalGraphite);
    lowerPocket.position.set(0, -0.12, -0.135);
    const goldPatch = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.02), goldMat);
    goldPatch.position.set(0, 0.18, -0.175);
    backPackGroup.add(upperPocket, lowerPocket, goldPatch);

    for (const sx of [-0.16, 0.16]) {
      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), darkSteel);
      stud.rotation.x = Math.PI / 2;
      stud.position.set(sx, -0.12, -0.19);
      backPackGroup.add(stud);
    }

    const breachTube = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.64, 16), tacticalGraphite);
    breachTube.rotation.z = Math.PI / 2;
    breachTube.position.set(0, -0.32, -0.04);
    for (const sx of [-0.22, 0.22]) {
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.045, 16), goldMat);
      strap.rotation.z = Math.PI / 2;
      strap.position.set(sx, -0.32, -0.04);
      backPackGroup.add(strap);
    }
    const c4ChargeLight = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), orangeLed);
    c4ChargeLight.position.set(0, -0.32, -0.13);
    backPackGroup.add(breachTube, c4ChargeLight);

    const knifeGroup = new THREE.Group();
    knifeGroup.position.set(-0.18, 0.18, -0.16);
    knifeGroup.rotation.z = -0.58;
    const scabbard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.045), matteBlack);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.055), goldMat);
    guard.position.set(0, 0.22, 0);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 10), matteBlack);
    grip.position.set(0, 0.31, 0);
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), goldMat);
    pommel.position.set(0, 0.41, 0);
    knifeGroup.add(scabbard, guard, grip, pommel);
    backPackGroup.add(knifeGroup);

    this.upperBodyGroup.add(backPackGroup);

    // 3. OMBROS & BRAÇOS — OMBREIRAS BLINDADAS 3D, COTOVELEIRAS & DETONADOR GPS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.36), matteBlack);
      pauldron.position.set(sign * 0.06, -0.04, 0);
      pauldron.rotation.z = -sign * 0.12;
      pauldron.castShadow = true;

      const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.045, 0.37), goldMat);
      goldStripe.position.set(sign * 0.06, 0.04, 0);
      goldStripe.rotation.z = -sign * 0.12;

      const patchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.18), darkSteel);
      patchPlate.position.set(sign * 0.19, -0.05, 0);
      armPivot.add(pauldron, goldStripe, patchPlate);
    }

    for (const [handGrp, isLeft] of [[this.leftHandGroup, true], [this.rightHandGroup, false]]) {
      const vambrace = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.26), matteBlack);
      vambrace.position.set(0, -0.11, 0);
      handGrp.add(vambrace);

      if (isLeft) {
        const wristPad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.27), tacticalGraphite);
        wristPad.position.set(0, -0.2, 0);
        const wristScreen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.14), orangeLed);
        wristScreen.position.set(0.11, -0.2, 0.02);
        handGrp.add(wristPad, wristScreen);
      }
    }

    // 4. CINTO TÁTICO 3D, COLDRE DE COXA COM PISTOLA, JOELHEIRAS E COTURNOS
    const beltGroup = new THREE.Group();
    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 0.48), matteBlack);
    beltBand.position.set(0, 0.08, 0);
    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.06), goldMat);
    beltBuckle.position.set(0, 0.08, 0.245);
    beltGroup.add(beltBand, beltBuckle);

    for (const bx of [-0.36, 0.36]) {
      const sidePouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.18), tacticalGraphite);
      sidePouch.position.set(bx, 0.07, 0.08);
      beltGroup.add(sidePouch);
    }
    this.hipGroup.add(beltGroup);

    const holsterStrap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.06, 0.4), matteBlack);
    holsterStrap.position.set(0, -0.22, 0);
    const holsterBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.16), tacticalGraphite);
    holsterBox.position.set(-0.2, -0.22, 0.04);
    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.12), matteBlack);
    pistolGrip.position.set(-0.2, -0.1, 0.02);
    pistolGrip.rotation.x = -0.25;
    const pistolSlide = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.18), darkSteel);
    pistolSlide.position.set(-0.2, -0.14, 0.06);
    this.rightLegPivot.add(holsterStrap, holsterBox, pistolGrip, pistolSlide);

    const leftThighStrap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.06, 0.4), matteBlack);
    leftThighStrap.position.set(0, -0.22, 0);
    const leftThighPouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.2), tacticalGraphite);
    leftThighPouch.position.set(0.2, -0.22, 0.02);
    const pouchBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.08), goldMat);
    pouchBuckle.position.set(0.2, -0.18, 0.02);
    this.leftLegPivot.add(leftThighStrap, leftThighPouch, pouchBuckle);

    for (const legPivot of [this.leftLegPivot, this.rightLegPivot]) {
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.18, 0.12), matteBlack);
      kneePad.position.set(0, -0.39, 0.18);
      const kneeCap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.06), darkSteel);
      kneeCap.position.set(0, -0.39, 0.23);

      const bootCuff = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.16, 0.41), matteBlack);
      bootCuff.position.set(0, -0.54, 0.01);
      const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.55), matteBlack);
      bootSole.position.set(0, -0.64, 0.07);
      const bootBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.42), goldMat);
      bootBuckle.position.set(0, -0.49, 0.01);
      legPivot.add(kneePad, kneeCap, bootCuff, bootSole, bootBuckle);
    }
  }
};
