import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói o Boné Tático Virado para Trás + Bandana Carmesim Amarrada (`cv_marretao_cap`)
 * + Headset de Combate Urbano para o operador pesado Marretão (CV).
 */
export function attachCvMarretaoHeadgear(minifig) {
  const headGear = new THREE.Group();
  const matteBlack = getLegoMaterial(0x090a0d, { roughness: 0.42, clearcoat: 0.15 });
  const crimsonCloth = getLegoMaterial(0xdc2626, { roughness: 0.48, clearcoat: 0.12 });
  const darkCrimson = getLegoMaterial(0x991b1b, { roughness: 0.52 });
  const rawSteel = getLegoMaterial(0x334155, { roughness: 0.3, metalness: 0.6 });
  const brassMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.24, metalness: 0.68 });

  // Faixa de bandana carmesim amarrada firme na testa
  const bandanaBand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.372, 0.366, 0.11, 26),
    crimsonCloth
  );
  bandanaBand.position.set(0, 0.505, 0);
  headGear.add(bandanaBand);

  // Nó traseiro da bandana + duas pontas caídas na nuca
  const bandanaKnot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), darkCrimson);
  bandanaKnot.position.set(0.06, 0.49, -0.375);
  headGear.add(bandanaKnot);

  for (const [sx, rotZ] of [[-0.04, 0.28], [0.14, -0.34]]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.22, 0.03), crimsonCloth);
    tail.position.set(sx, 0.38, -0.405);
    tail.rotation.set(0.18, 0, rotZ);
    headGear.add(tail);
  }

  // Domo estruturado do boné preto virado para trás
  const capCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.365, 0.382, 0.15, 26),
    matteBlack
  );
  capCrown.position.set(0, 0.615, 0);
  capCrown.castShadow = true;
  headGear.add(capCrown);

  const capTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.365, 0.08, 24),
    matteBlack
  );
  capTop.position.set(0, 0.725, 0);
  headGear.add(capTop);

  const capButton = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), rawSteel);
  capButton.position.set(0, 0.77, 0);
  headGear.add(capButton);

  // Aba traseira reta virada para a nuca (-Z) + placa frontal metálica CV
  const rearBill = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.036, 0.28), matteBlack);
  rearBill.position.set(0, 0.565, -0.44);
  rearBill.rotation.x = -0.08;
  rearBill.castShadow = true;
  const frontPatch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.085, 0.03), darkCrimson);
  frontPatch.position.set(0, 0.61, 0.375);
  const frontRivet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 0.036), brassMat);
  frontRivet.position.set(0, 0.61, 0.382);
  headGear.add(rearBill, frontPatch, frontRivet);

  // Protetores auriculares táticos + microfone curto
  for (const side of [-1, 1]) {
    const earCup = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.22, 0.2), rawSteel);
    earCup.position.set(side * 0.37, 0.335, 0);
    const earPad = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.22), matteBlack);
    earPad.position.set(side * 0.33, 0.335, 0);
    headGear.add(earCup, earPad);
  }

  const micArm = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.3), matteBlack);
  micArm.position.set(-0.28, 0.21, 0.2);
  micArm.rotation.y = 0.48;
  const micTip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.06), darkCrimson);
  micTip.position.set(-0.17, 0.21, 0.34);
  headGear.add(micArm, micTip);

  minifig.headGroup.add(headGear);
}

export const cvMarretaoOutfitMethods = {
  /**
   * Equipa o Rig 3D Completo do Marretão (CV — Tanque/Dano Pesado):
   * - FRENTE: Colete pesado com chapa de aço soldada, fita diagonal de munição em latão, bolsas e granadas;
   * - COSTAS: Mochila de lona camuflada escura + Tubo RPG-7 preso na diagonal com ogiva aparente;
   * - BRAÇOS & PERNAS: Ombreiras assimétricas soldadas, joelheiras cargo reforçadas e coturnos pesados;
   * - ARMA: Metralhadora Leve Alimentada por Fita (`cv_lmg`) com cofre lateral e bipé (`this.rifleGroup`).
   */
  _attachCvMarretaoRig() {
    const matteBlack = getLegoMaterial(0x090a0d, { roughness: 0.4, clearcoat: 0.15 });
    const crimsonMat = getLegoMaterial(0xdc2626, { roughness: 0.42, clearcoat: 0.18 });
    const darkCrimson = getLegoMaterial(0x991b1b, { roughness: 0.48 });
    const darkCamo = getLegoMaterial(0x262d22, { roughness: 0.58 });
    const camoOlive = getLegoMaterial(0x36422e, { roughness: 0.55 });
    const weldedSteel = getLegoMaterial(0x334155, { roughness: 0.3, metalness: 0.62 });
    const gunMetal = getLegoMaterial(0x1e242b, { roughness: 0.28, metalness: 0.55 });
    const brassMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.22, metalness: 0.72 });

    // 1. FRENTE — COLETE DE PLACA DE AÇO IMPROVISADA + CINTA DIAGONAL DE MUNIÇÃO
    const frontVest = new THREE.Group();

    const vestBase = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.58, 0.09), matteBlack);
    vestBase.position.set(0, 0.39, 0.23);
    vestBase.castShadow = true;
    frontVest.add(vestBase);

    const steelPlate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.045), weldedSteel);
    steelPlate.position.set(0, 0.42, 0.275);
    frontVest.add(steelPlate);

    for (const [rx, ry] of [[-0.24, 0.58], [0.24, 0.58], [-0.24, 0.26], [0.24, 0.26]]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8), brassMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(rx, ry, 0.298);
      frontVest.add(bolt);
    }

    for (const sx of [-0.26, 0.26]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.065, 0.52), crimsonMat);
      strap.position.set(sx, 0.76, 0);
      frontVest.add(strap);
    }

    // Cinta diagonal de cartuchos 7.62mm em latão cruzando o peito
    const beltCount = 7;
    for (let i = 0; i < beltCount; i++) {
      const t = i / (beltCount - 1);
      const bx = 0.25 - t * 0.5;
      const by = 0.66 - t * 0.44;
      const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 8), brassMat);
      casing.position.set(bx, by, 0.312);
      casing.rotation.z = -0.68;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.045, 8), crimsonMat);
      tip.position.set(bx + 0.042, by - 0.036, 0.312);
      tip.rotation.z = -0.68 - Math.PI * 0.5;
      frontVest.add(casing, tip);
    }

    for (const px of [-0.19, 0.19]) {
      const boxPouch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.19, 0.1), darkCamo);
      boxPouch.position.set(px, 0.19, 0.275);
      const pouchFlap = new THREE.Mesh(new THREE.BoxGeometry(0.225, 0.05, 0.106), darkCrimson);
      pouchFlap.position.set(px, 0.26, 0.278);
      frontVest.add(boxPouch, pouchFlap);
    }

    this.upperBodyGroup.add(frontVest);

    // 2. COSTAS — MOCHILA DE MUNIÇÃO + LANÇA-FOGUETES RPG-7 NA DIAGONAL
    const backGroup = new THREE.Group();
    backGroup.position.set(0, 0.41, -0.28);

    const ruckMain = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.52, 0.21), darkCamo);
    ruckMain.castShadow = true;
    const ruckFlap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.23), matteBlack);
    ruckFlap.position.set(0, 0.21, 0);
    const crimsonTag = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.025), crimsonMat);
    crimsonTag.position.set(0, 0.21, -0.12);
    backGroup.add(ruckMain, ruckFlap, crimsonTag);

    const rpgStrapGroup = new THREE.Group();
    rpgStrapGroup.position.set(0.02, 0.05, -0.15);
    rpgStrapGroup.rotation.z = -0.52;

    const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 1.08, 14), camoOlive);
    const rpgBell = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.064, 0.2, 14), gunMetal);
    rpgBell.position.set(0, -0.6, 0);
    const warheadNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.068, 0.12, 12), weldedSteel);
    warheadNeck.position.set(0, 0.58, 0);
    const warheadCone = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.28, 14), darkCrimson);
    warheadCone.position.set(0, 0.76, 0);
    for (const sy of [-0.24, 0.24]) {
      const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.05, 14), matteBlack);
      clamp.position.set(0, sy, 0);
      rpgStrapGroup.add(clamp);
    }
    rpgStrapGroup.add(rpgTube, rpgBell, warheadNeck, warheadCone);
    backGroup.add(rpgStrapGroup);

    this.upperBodyGroup.add(backGroup);

    // 3. OMBROS, BRAÇOS, CINTO & PERNAS CARGO COM JOELHEIRAS SOLDADAS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pauldron = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.27, 0.38),
        sign > 0 ? weldedSteel : matteBlack
      );
      pauldron.position.set(sign * 0.07, -0.03, 0);
      pauldron.rotation.z = -sign * 0.14;
      pauldron.castShadow = true;

      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.05, 0.39), crimsonMat);
      stripe.position.set(sign * 0.07, 0.05, 0);
      stripe.rotation.z = -sign * 0.14;
      armPivot.add(pauldron, stripe);
    }

    for (const handGrp of [this.leftHandGroup, this.rightHandGroup]) {
      const bracer = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.26), matteBlack);
      bracer.position.set(0, -0.11, 0);
      const steelGuard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.12), weldedSteel);
      steelGuard.position.set(0, -0.11, 0.09);
      handGrp.add(bracer, steelGuard);
    }

    const beltGroup = new THREE.Group();
    const beltBand = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 0.48), matteBlack);
    beltBand.position.set(0, 0.08, 0);
    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.06), brassMat);
    beltBuckle.position.set(0, 0.08, 0.245);
    beltGroup.add(beltBand, beltBuckle);
    this.hipGroup.add(beltGroup);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const cargoPocket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.22), darkCamo);
      cargoPocket.position.set(sign * 0.19, -0.22, 0.01);

      const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.2, 0.13), darkCamo);
      kneeGuard.position.set(0, -0.39, 0.18);
      const kneeSteel = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.14, 0.06), weldedSteel);
      kneeSteel.position.set(0, -0.39, 0.235);

      const bootCuff = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.16, 0.41), matteBlack);
      bootCuff.position.set(0, -0.54, 0.01);
      const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.55), matteBlack);
      bootSole.position.set(0, -0.64, 0.07);
      legPivot.add(cargoPocket, kneeGuard, kneeSteel, bootCuff, bootSole);
    }

    // 4. ARMA PRIMÁRIA — METRALHADORA LEVE DE FITA `cv_lmg` COM COFRE & BIPÉ
    const lmg = new THREE.Group();

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.66), gunMetal);
    receiver.position.set(0, 0.03, 0.24);
    receiver.castShadow = true;
    const topCover = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.48), matteBlack);
    topCover.position.set(0, 0.155, 0.24);
    const crimsonLatch = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.04, 0.18), crimsonMat);
    crimsonLatch.position.set(0, 0.08, 0.16);
    lmg.add(receiver, topCover, crimsonLatch);

    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.46), matteBlack);
    shroud.position.set(0, 0.04, 0.72);
    const heavyBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.62, 12), weldedSteel);
    heavyBarrel.rotation.x = Math.PI / 2;
    heavyBarrel.position.set(0, 0.06, 0.96);
    const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.48, 10), gunMetal);
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, -0.02, 0.88);
    const muzzleComp = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.095, 0.14), matteBlack);
    muzzleComp.position.set(0, 0.06, 1.26);
    lmg.add(shroud, heavyBarrel, gasTube, muzzleComp);

    // Cofre lateral de munição + fita aparente de cartuchos em latão
    const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.24), camoOlive);
    ammoBox.position.set(-0.15, -0.14, 0.3);
    const ammoBeltFeed = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.12), brassMat);
    ammoBeltFeed.position.set(-0.11, -0.01, 0.3);
    ammoBeltFeed.rotation.z = -0.35;
    lmg.add(ammoBox, ammoBeltFeed);

    // Bipé frontal aberto em V sob o guarda-mão + coronha maciça
    for (const side of [-1, 1]) {
      const bipodLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), weldedSteel);
      bipodLeg.position.set(side * 0.085, -0.15, 0.92);
      bipodLeg.rotation.z = side * 0.34;
      bipodLeg.rotation.x = 0.18;
      lmg.add(bipodLeg);
    }

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.34), matteBlack);
    stock.position.set(0, -0.02, -0.2);
    const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.18), weldedSteel);
    carryHandle.position.set(0.06, 0.21, 0.5);
    lmg.add(stock, carryHandle);

    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xf97316,
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 0.93
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.95, 0.95, 2.5);
    this.muzzleFlashMesh.position.set(0, 0.06, 1.42);
    this.muzzleFlashMesh.visible = false;
    lmg.add(this.muzzleFlashMesh);

    lmg.position.set(0, -0.34, 0.12);
    lmg.rotation.x = Math.PI / 2 - 0.15;
    this.rightHandGroup.add(lmg);
    this.rifleGroup = lmg;
  }
};
