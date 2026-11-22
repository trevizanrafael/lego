import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói a Viseira Tática Carmesim + Óculos Escuros Balísticos + Headset Rádio (`cv_fogueteira_visor`)
 * para a operadora de suporte tático Fogueteira (CV).
 */
export function attachCvFogueteiraHeadgear(minifig) {
  const headGear = new THREE.Group();
  const crimsonMat = getLegoMaterial(0xb91c1c, { roughness: 0.36, clearcoat: 0.22 });
  const brightRed = getLegoMaterial(0xdc2626, { roughness: 0.32 });
  const charcoalMat = getLegoMaterial(0x18181b, { roughness: 0.38, clearcoat: 0.18 });
  const medWhite = getLegoMaterial(0xe2e8f0, { roughness: 0.28 });
  const darkLens = getLegoMaterial(0x090a0d, { roughness: 0.12, metalness: 0.45, clearcoat: 0.85 });
  const signalLed = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 1.9 });

  // Coroa tática carvão + faixa frontal da viseira carmesim
  const crownCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.375, 0.14, 26),
    charcoalMat
  );
  crownCap.position.set(0, 0.61, 0);
  headGear.add(crownCap);

  const visorBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.384, 0.38, 0.095, 26),
    crimsonMat
  );
  visorBand.position.set(0, 0.545, 0);
  headGear.add(visorBand);

  // Aba curva dianteira da viseira (+Z) + micro-insígnia branca de socorro
  const frontBill = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.036, 0.28), crimsonMat);
  frontBill.position.set(0, 0.525, 0.41);
  frontBill.rotation.x = 0.14;
  frontBill.castShadow = true;
  const medBadgeH = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.025), medWhite);
  medBadgeH.position.set(0, 0.56, 0.385);
  const medBadgeV = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.085, 0.025), medWhite);
  medBadgeV.position.set(0, 0.56, 0.385);
  headGear.add(frontBill, medBadgeH, medBadgeV);

  // Óculos escuros balísticos envolventes
  const goggleBridge = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.045, 0.08), charcoalMat);
  goggleBridge.position.set(0, 0.39, 0.335);
  headGear.add(goggleBridge);

  for (const side of [-1, 1]) {
    const lensMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.07), darkLens);
    lensMesh.position.set(side * 0.14, 0.355, 0.345);
    lensMesh.rotation.y = -side * 0.18;
    const templeArm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.34), charcoalMat);
    templeArm.position.set(side * 0.345, 0.37, 0.16);
    headGear.add(lensMesh, templeArm);
  }

  // Headset de rádio de campo + antena curta e microfone
  for (const side of [-1, 1]) {
    const earCup = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.21, 0.19), charcoalMat);
    earCup.position.set(side * 0.368, 0.335, -0.01);
    const earAccent = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.12), brightRed);
    earAccent.position.set(side * 0.415, 0.335, -0.01);
    headGear.add(earCup, earAccent);
  }

  const headAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.3, 8), charcoalMat);
  headAntenna.position.set(0.39, 0.56, -0.08);
  const micBoom = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.31), charcoalMat);
  micBoom.position.set(0.28, 0.21, 0.2);
  micBoom.rotation.y = -0.5;
  const micLed = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), signalLed);
  micLed.position.set(0.16, 0.21, 0.35);
  headGear.add(headAntenna, micBoom, micLed);

  minifig.headGroup.add(headGear);
}

export const cvFogueteiraOutfitMethods = {
  /**
   * Equipa o Rig 3D Completo da Fogueteira (CV — Suporte de Campo):
   * - FRENTE: Chest rig leve carvão com alças carmesim, walkie-talkie + antena chicote longa e sinalizadores;
   * - COSTAS: Mochila Trauma Medkit vermelha/branca + 3 tubos morteiros de fogos sinalizadores acoplados;
   * - CINTO & PERNAS: Cinto utilitário com bolsas de primeiros socorros, bolsa médica de coxa e coturnos leves;
   * - ARMA: Pistola Tática Semiautomática (`cv_pistol`) na mão direita (`this.rifleGroup`).
   */
  _attachCvFogueteiraRig() {
    const crimsonMat = getLegoMaterial(0xb91c1c, { roughness: 0.36, clearcoat: 0.2 });
    const brightCrimson = getLegoMaterial(0xdc2626, { roughness: 0.32 });
    const charcoalMat = getLegoMaterial(0x18181b, { roughness: 0.4, clearcoat: 0.16 });
    const darkSlate = getLegoMaterial(0x27272a, { roughness: 0.35, metalness: 0.38 });
    const steelMat = getLegoMaterial(0x475569, { roughness: 0.26, metalness: 0.62 });
    const medWhite = getLegoMaterial(0xe2e8f0, { roughness: 0.26 });
    const flareOrange = getLegoMaterial(0xea580c, { roughness: 0.3 });
    const redLed = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 1.9 });

    // 1. FRENTE — CHEST RIG LEVE COM RÁDIO WALKIE-TALKIE + ANTENA CHICOTE LONGA
    const chestRig = new THREE.Group();

    const rigPanel = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.44, 0.075), charcoalMat);
    rigPanel.position.set(0, 0.34, 0.228);
    rigPanel.castShadow = true;
    chestRig.add(rigPanel);

    for (const sx of [-0.23, 0.23]) {
      const harness = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.5), crimsonMat);
      harness.position.set(sx, 0.755, 0);
      const frontStrap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.28, 0.06), crimsonMat);
      frontStrap.position.set(sx, 0.62, 0.232);
      chestRig.add(harness, frontStrap);
    }

    // Patch médico branco/vermelho no centro do peito
    const patchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.03), medWhite);
    patchPlate.position.set(0, 0.41, 0.27);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.038, 0.036), brightCrimson);
    crossH.position.set(0, 0.41, 0.274);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.11, 0.036), brightCrimson);
    crossV.position.set(0, 0.41, 0.274);
    chestRig.add(patchPlate, crossH, crossV);

    // Walkie-talkie no peito + antena chicote longa subindo atrás do ombro
    const walkieBody = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.21, 0.085), darkSlate);
    walkieBody.position.set(0.22, 0.54, 0.268);
    const walkieLed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), redLed);
    walkieLed.position.set(0.19, 0.61, 0.312);
    const whipAntenna = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.016, 0.74, 8), charcoalMat);
    whipAntenna.position.set(0.26, 0.96, -0.08);
    whipAntenna.rotation.x = -0.12;
    chestRig.add(walkieBody, walkieLed, whipAntenna);

    // Tubos de sinalizador e carregadores leves na barriga
    for (const fx of [-0.24, -0.15]) {
      const flareStick = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.17, 10), brightCrimson);
      flareStick.position.set(fx, 0.53, 0.268);
      const flareCap = new THREE.Mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.035, 10), medWhite);
      flareCap.position.set(fx, 0.61, 0.268);
      chestRig.add(flareStick, flareCap);
    }

    for (const mx of [-0.19, 0, 0.19]) {
      const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.08), darkSlate);
      magPouch.position.set(mx, 0.2, 0.265);
      chestRig.add(magPouch);
    }

    this.upperBodyGroup.add(chestRig);

    // 2. COSTAS — MOCHILA TRAUMA MEDKIT + 3 TUBOS MORTEIROS DE FOGOS SINALIZADORES
    const backPack = new THREE.Group();
    backPack.position.set(-0.04, 0.42, -0.28);

    const medBag = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.22), crimsonMat);
    medBag.castShadow = true;
    const whitePanel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.04), medWhite);
    whitePanel.position.set(0, 0.02, -0.115);
    const backCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 0.045), brightCrimson);
    backCrossH.position.set(0, 0.02, -0.122);
    const backCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.045), brightCrimson);
    backCrossV.position.set(0, 0.02, -0.122);
    const traumaRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.48, 14), medWhite);
    traumaRoll.rotation.z = Math.PI / 2;
    traumaRoll.position.set(0, -0.31, -0.02);
    backPack.add(medBag, whitePanel, backCrossH, backCrossV, traumaRoll);

    // Bateria lateral de 3 tubos morteiros pirotécnicos de sinalização
    const mortarRack = new THREE.Group();
    mortarRack.position.set(0.34, 0.04, -0.01);
    for (let i = 0; i < 3; i++) {
      const tz = (i - 1) * 0.075;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.52, 12), charcoalMat);
      tube.position.set(0, 0.04 + i * 0.03, tz);
      tube.rotation.z = -0.08;
      const rocketTip = new THREE.Mesh(
        new THREE.ConeGeometry(0.038, 0.1, 10),
        i === 1 ? flareOrange : brightCrimson
      );
      rocketTip.position.set(0.02, 0.34 + i * 0.03, tz);
      rocketTip.rotation.z = -0.08;
      mortarRack.add(tube, rocketTip);
    }
    const rackStrap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.26), medWhite);
    rackStrap.position.set(-0.02, 0.02, 0);
    mortarRack.add(rackStrap);
    backPack.add(mortarRack);

    this.upperBodyGroup.add(backPack);
    this.operatorMedpackGroup = backPack;

    // 3. OMBROS LEVES, MONITOR DE PULSO, CINTO MÉDICO E PERNAS ÁGEIS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.32), charcoalMat);
      pad.position.set(sign * 0.05, -0.03, 0);
      pad.rotation.z = -sign * 0.1;
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.045, 0.33),
        sign > 0 ? medWhite : brightCrimson
      );
      band.position.set(sign * 0.05, -0.08, 0);
      band.rotation.z = -sign * 0.1;
      armPivot.add(pad, band);
    }

    const leftCuff = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.11, 0.25), charcoalMat);
    leftCuff.position.set(0, -0.16, 0);
    const triageScreen = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.12), redLed);
    triageScreen.position.set(0.11, -0.16, 0.02);
    this.leftHandGroup.add(leftCuff, triageScreen);

    const beltGroup = new THREE.Group();
    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.11, 0.46), charcoalMat);
    beltBand.position.set(0, 0.08, 0);
    beltGroup.add(beltBand);
    for (const bx of [-0.35, 0.35]) {
      const medPouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.17), crimsonMat);
      medPouch.position.set(bx, 0.07, 0.06);
      const medStripe = new THREE.Mesh(new THREE.BoxGeometry(0.126, 0.035, 0.175), medWhite);
      medStripe.position.set(bx, 0.09, 0.06);
      beltGroup.add(medPouch, medStripe);
    }
    this.hipGroup.add(beltGroup);

    const legMedBag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.21, 0.2), medWhite);
    legMedBag.position.set(0.19, -0.22, 0.02);
    const legCross = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.05, 0.12), brightCrimson);
    legCross.position.set(0.19, -0.22, 0.02);
    this.leftLegPivot.add(legMedBag, legCross);

    for (const legPivot of [this.leftLegPivot, this.rightLegPivot]) {
      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.15, 0.1), charcoalMat);
      kneePad.position.set(0, -0.39, 0.18);
      const bootBody = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.53), charcoalMat);
      bootBody.position.set(0, -0.64, 0.07);
      const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(0.365, 0.035, 0.42), brightCrimson);
      bootTrim.position.set(0, -0.54, 0.02);
      legPivot.add(kneePad, bootBody, bootTrim);
    }

    // 4. ARMA PRIMÁRIA — PISTOLA TÁTICA SEMIAUTOMÁTICA (`cv_pistol`)
    const pistol = new THREE.Group();

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.44), charcoalMat);
    frame.position.set(0, 0.01, 0.22);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.22, 0.13), charcoalMat);
    grip.position.set(0, -0.11, 0.05);
    grip.rotation.x = -0.2;
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.045, 0.14), brightCrimson);
    magBase.position.set(0, -0.23, 0.07);
    magBase.rotation.x = -0.2;

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.11, 0.48), steelMat);
    slide.position.set(0, 0.085, 0.24);
    slide.castShadow = true;
    const barrelTip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.14, 10), charcoalMat);
    barrelTip.rotation.x = Math.PI / 2;
    barrelTip.position.set(0, 0.085, 0.52);

    const tacLight = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.16), darkSlate);
    tacLight.position.set(0, -0.04, 0.36);
    const reflexDot = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.07), redLed);
    reflexDot.position.set(0, 0.155, 0.09);

    pistol.add(frame, grip, magBase, slide, barrelTip, tacLight, reflexDot);

    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.3,
      transparent: true,
      opacity: 0.92
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.8, 0.8, 2.1);
    this.muzzleFlashMesh.position.set(0, 0.085, 0.68);
    this.muzzleFlashMesh.visible = false;
    pistol.add(this.muzzleFlashMesh);

    pistol.position.set(0, -0.34, 0.11);
    pistol.rotation.x = Math.PI / 2 - 0.15;
    this.rightHandGroup.add(pistol);
    this.rifleGroup = pistol;
  }
};
