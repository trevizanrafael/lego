import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói o Cabelo Militar Penteado para Trás + Faixa Tática Preta 3D (`tactical_bandana`)
 * do Vingador de Chumbo (#4 — Estilo Frank Castle).
 */
export function attachVingadorBandanaHeadgear(minifig) {
  const hairMat = getLegoMaterial(0x090a0d, { roughness: 0.34, clearcoat: 0.22 });
  const bandMat = getLegoMaterial(0x111827, { roughness: 0.28, clearcoat: 0.3 });
  const silverTrimMat = getLegoMaterial(0xe2e8f0, { metalness: 0.65, roughness: 0.18 });

  const hairCap = new THREE.Mesh(new THREE.CylinderGeometry(0.372, 0.382, 0.16, 28), hairMat);
  hairCap.position.set(0, 0.62, -0.01);
  hairCap.castShadow = true;
  minifig.headGroup.add(hairCap);

  for (let i = -2; i <= 2; i++) {
    const strand = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.085, 0.44),
      hairMat
    );
    strand.position.set(i * 0.125, 0.68 - Math.abs(i) * 0.014, -0.01);
    strand.rotation.x = -0.14;
    strand.rotation.z = -i * 0.08;
    strand.castShadow = true;
    minifig.headGroup.add(strand);
  }

  const backHair = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.14), hairMat);
  backHair.position.set(0, 0.44, -0.31);
  minifig.headGroup.add(backHair);

  for (const side of [-1, 1]) {
    const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.16), hairMat);
    sideburn.position.set(side * 0.345, 0.42, 0.04);
    minifig.headGroup.add(sideburn);
  }

  const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.374, 0.374, 0.088, 28), bandMat);
  headband.position.set(0, 0.535, 0);
  minifig.headGroup.add(headband);

  const frontStudPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.045, 0.04), silverTrimMat);
  frontStudPlate.position.set(0, 0.535, 0.365);
  minifig.headGroup.add(frontStudPlate);

  const bandKnot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), bandMat);
  bandKnot.position.set(0, 0.52, -0.37);
  minifig.headGroup.add(bandKnot);

  for (const side of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.24, 0.045), bandMat);
    tail.position.set(side * 0.065, 0.41, -0.4);
    tail.rotation.x = 0.34;
    tail.rotation.z = side * 0.24;
    minifig.headGroup.add(tail);
  }
}

export const vingadorOutfitMethods = {
  /**
   * Constrói o Visual 3D Completo do Vingador de Chumbo (#4 — Estilo O Justiceiro / Frank Castle):
   * - Sobretudo Longo de Couro Preto 3D com Gola Alta Levantada, Lapelas Abertas e Abas Articuladas até os joelhos
   * - Peitoral Balístico 3D com a Caveira Branca do Justiceiro em Alto-Relevo + Bandoleiras Cruzadas em X
   * - Cinto Tático Branco/Prata + Coldres Duplos de Coxa + Joelheiras Metálicas + Botas Pesadas
   * - Arsenal Guardado Visível nas Costas (Escopeta e Bazuca cruzadas nas costas quando não estão na mão!)
   */
  _attachVingadorArmorAndCoat() {
    const leatherMat = getLegoMaterial(0x10131a, { roughness: 0.42, clearcoat: 0.24 });
    const matteBlackMat = getLegoMaterial(0x090a0d, { roughness: 0.32, clearcoat: 0.28 });
    const kevlarMat = getLegoMaterial(0x141821, { roughness: 0.35, metalness: 0.25 });
    const skullWhiteMat = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.5 });
    const chromeSilverMat = getLegoMaterial(0xd8dde6, { roughness: 0.16, metalness: 0.78, clearcoat: 0.6 });
    const redShellMat = getLegoMaterial(0xdc2626, { roughness: 0.22 });
    const brassMat = getLegoMaterial(0xfacc15, { roughness: 0.18, metalness: 0.68 });
    const oliveMat = getLegoMaterial(0x365314, { roughness: 0.32 });
    const eyeGlowMat = getLegoMaterial(0xffffff, {
      emissive: 0xf8fafc,
      emissiveIntensity: 1.4,
      roughness: 0.1
    });

    const rigGroup = new THREE.Group();
    this.vingadorCoatTails = [];
    this.vingadorSkullEyes = [];
    this.vingadorHolsteredPistols = [];

    // 1. GOLA ALTA LEVANTADA DO SOBRETUDO DE COURO PRETO
    const backCollar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.24, 0.11), leatherMat);
    backCollar.position.set(0, 0.78, -0.2);
    backCollar.rotation.x = -0.14;
    rigGroup.add(backCollar);

    for (const side of [-1, 1]) {
      const sideCollar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.38), leatherMat);
      sideCollar.position.set(side * 0.34, 0.77, -0.02);
      sideCollar.rotation.z = -side * 0.18;
      sideCollar.castShadow = true;

      const frontLapel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.08), leatherMat);
      frontLapel.position.set(side * 0.35, 0.38, 0.22);
      frontLapel.rotation.y = -side * 0.22;
      frontLapel.castShadow = true;

      for (const by of [0.58, 0.38, 0.18]) {
        const lapelBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 10), chromeSilverMat);
        lapelBtn.rotation.x = Math.PI / 2;
        lapelBtn.position.set(side * 0.36, by, 0.26);
        rigGroup.add(lapelBtn);
      }

      rigGroup.add(sideCollar, frontLapel);
    }

    const coatBackPanel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.76, 0.09), leatherMat);
    coatBackPanel.position.set(0, 0.38, -0.23);
    coatBackPanel.castShadow = true;
    const backStrap = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.1, 0.11), matteBlackMat);
    backStrap.position.set(0, 0.12, -0.24);
    const backBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.12), chromeSilverMat);
    backBuckle.position.set(0, 0.12, -0.245);
    rigGroup.add(coatBackPanel, backStrap, backBuckle);

    // 2. ABAS TRASEIRAS E LATERAIS ARTICULADAS DO SOBRETUDO
    for (const side of [-1, 1]) {
      const tailPivot = new THREE.Group();
      tailPivot.position.set(side * 0.22, 0.04, -0.22);

      const backTail = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.68, 0.065), leatherMat);
      backTail.position.set(0, -0.32, 0);
      backTail.castShadow = true;

      const hemTrim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.075), matteBlackMat);
      hemTrim.position.set(0, -0.63, 0);
      const tailStrap = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.06, 0.08), matteBlackMat);
      tailStrap.position.set(0, -0.36, -0.01);
      const tailStud = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.09), chromeSilverMat);
      tailStud.position.set(side * 0.08, -0.36, -0.015);

      const sideFlap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.64, 0.38), leatherMat);
      sideFlap.position.set(side * 0.21, -0.3, 0.16);
      sideFlap.castShadow = true;

      tailPivot.add(backTail, hemTrim, tailStrap, tailStud, sideFlap);
      tailPivot.rotation.x = 0.12;
      tailPivot.rotation.z = side * 0.06;
      rigGroup.add(tailPivot);

      this.vingadorCoatTails.push({
        pivot: tailPivot,
        side,
        baseRotX: 0.12,
        baseRotZ: side * 0.06,
        phase: side < 0 ? 0 : 1.4
      });
    }

    // 3. PEITORAL BALÍSTICO 3D COM A CAVEIRA BRANCA DO JUSTICEIRO EM ALTO-RELEVO
    const vestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.66, 0.06), kevlarMat);
    vestPlate.position.set(0, 0.39, 0.22);
    rigGroup.add(vestPlate);

    const skullCranium = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.045), skullWhiteMat);
    skullCranium.position.set(0, 0.56, 0.252);
    const skullForehead = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.048), skullWhiteMat);
    skullForehead.position.set(0, 0.65, 0.252);
    rigGroup.add(skullCranium, skullForehead);

    for (const side of [-1, 1]) {
      const cheekBone = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.048), skullWhiteMat);
      cheekBone.position.set(side * 0.14, 0.4, 0.254);
      cheekBone.rotation.z = -side * 0.25;

      const eyeSocket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.052), matteBlackMat);
      eyeSocket.position.set(side * 0.11, 0.49, 0.256);
      eyeSocket.rotation.z = -side * 0.28;

      const eyeCore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.036, 0.056), eyeGlowMat.clone());
      eyeCore.position.set(side * 0.11, 0.49, 0.258);
      eyeCore.rotation.z = -side * 0.28;
      this.vingadorSkullEyes.push(eyeCore);

      rigGroup.add(cheekBone, eyeSocket, eyeCore);
    }

    const nasalCavity = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 3), matteBlackMat);
    nasalCavity.position.set(0, 0.41, 0.26);
    rigGroup.add(nasalCavity);

    for (const tx of [-0.12, -0.04, 0.04, 0.12]) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.25, 0.048), skullWhiteMat);
      tooth.position.set(tx, 0.23, 0.254);
      rigGroup.add(tooth);
    }

    // 4. BANDOLEIRAS 3D CRUZADAS EM X (Cartuchos 12GA + Granadas 40mm)
    const bandolier1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.84, 0.5), matteBlackMat);
    bandolier1.position.set(0, 0.42, 0.01);
    bandolier1.rotation.z = 0.56;
    const bandolier2 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.84, 0.49), matteBlackMat);
    bandolier2.position.set(0, 0.42, 0.01);
    bandolier2.rotation.z = -0.56;
    rigGroup.add(bandolier1, bandolier2);

    for (let i = 0; i < 6; i++) {
      const t = (i - 2.5) * 0.105;
      const shellGroup = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.075, 8), redShellMat);
      const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.026, 8), brassMat);
      brass.position.y = -0.042;
      shellGroup.add(hull, brass);
      shellGroup.position.set(-t * 0.85, 0.43 + t, 0.268);
      shellGroup.rotation.z = -0.95;
      rigGroup.add(shellGroup);
    }

    for (let i = 0; i < 3; i++) {
      const grenGroup = new THREE.Group();
      const gBody = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.065, 10), chromeSilverMat);
      const gTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), brassMat);
      gTip.position.y = 0.032;
      grenGroup.add(gBody, gTip);
      grenGroup.position.set(-0.2 + i * 0.08, 0.62 - i * 0.09, 0.265);
      grenGroup.rotation.z = 0.65;
      rigGroup.add(grenGroup);
    }

    // 5. OMBREIRAS DE COURO COM TACHAS PRATEADAS & BRAÇADEIRAS TÁTICAS
    for (const [armPivot, forearmGroup, side] of [
      [this.leftArmPivot, this.leftHandGroup, 1],
      [this.rightArmPivot, this.rightHandGroup, -1]
    ]) {
      const epaulette = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.34), leatherMat);
      epaulette.position.set(side * 0.04, 0.06, 0);
      epaulette.rotation.z = -side * 0.16;
      armPivot.add(epaulette);

      for (const sz of [-0.1, 0, 0.1]) {
        const stud = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.045, 6), chromeSilverMat);
        stud.position.set(side * 0.06, 0.12, sz);
        armPivot.add(stud);
      }

      if (forearmGroup) {
        const bracer = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.25), matteBlackMat);
        bracer.position.set(0, -0.15, 0);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.26), chromeSilverMat);
        buckle.position.set(0, -0.15, 0);
        forearmGroup.add(bracer, buckle);
      }
    }

    // 6. CINTO TÁTICO BRANCO/PRATA + COLDRES DE COXA + JOELHEIRAS METÁLICAS
    const beltStrap = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.5), matteBlackMat);
    beltStrap.position.set(0, 0.07, 0);
    this.hipGroup.add(beltStrap);

    const centerBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.06), skullWhiteMat);
    centerBuckle.position.set(0, 0.07, 0.25);
    this.hipGroup.add(centerBuckle);

    for (const [px, pz, rotY] of [
      [-0.24, 0.24, 0],
      [0.24, 0.24, 0],
      [-0.43, 0, Math.PI / 2],
      [0.43, 0, Math.PI / 2],
      [-0.22, -0.24, 0],
      [0.22, -0.24, 0]
    ]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.08), skullWhiteMat);
      pouch.position.set(px, 0.07, pz);
      pouch.rotation.y = rotY;
      this.hipGroup.add(pouch);
    }

    for (const [legPivot, side] of [
      [this.leftLegPivot, 1],
      [this.rightLegPivot, -1]
    ]) {
      const thighStrap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.44), matteBlackMat);
      thighStrap.position.set(0, -0.22, 0);
      const holsterBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.2), leatherMat);
      holsterBox.position.set(side * 0.21, -0.22, 0.02);

      const holsteredGun = new THREE.Group();
      const hgSlide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.12), chromeSilverMat);
      hgSlide.position.set(side * 0.22, -0.16, 0.02);
      const hgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.1, 0.16), matteBlackMat);
      hgGrip.position.set(side * 0.22, -0.05, -0.03);
      holsteredGun.add(hgSlide, hgGrip);
      this.vingadorHolsteredPistols.push(holsteredGun);

      const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.08), chromeSilverMat);
      kneePad.position.set(0, -0.38, 0.22);
      const bootCuff = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.45), matteBlackMat);
      bootCuff.position.set(0, -0.58, 0.02);

      legPivot.add(thighStrap, holsterBox, holsteredGun, kneePad, bootCuff);
    }

    // 7. ARSENAL GUARDADO VISÍVEL NAS COSTAS (Escopeta e Bazuca cruzadas em X!)
    const backShotgun = new THREE.Group();
    const bSgBody = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.56), matteBlackMat);
    const bSgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.65, 10), chromeSilverMat);
    bSgBarrel.rotation.x = Math.PI / 2;
    bSgBarrel.position.set(0, 0.04, 0.45);
    const bSgDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 14), matteBlackMat);
    bSgDrum.rotation.x = Math.PI / 2;
    bSgDrum.position.set(0, -0.12, 0.12);
    const bSgDrumRim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.15, 12), redShellMat);
    bSgDrumRim.rotation.x = Math.PI / 2;
    bSgDrumRim.position.set(0, -0.12, 0.12);
    backShotgun.add(bSgBody, bSgBarrel, bSgDrum, bSgDrumRim);
    backShotgun.position.set(-0.06, 0.44, -0.33);
    backShotgun.rotation.set(0.15, Math.PI / 2, 0.68);
    rigGroup.add(backShotgun);
    this.vingadorBackShotgun = backShotgun;

    const backRpg = new THREE.Group();
    const bRpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 1.08, 12), oliveMat);
    bRpgTube.rotation.x = Math.PI / 2;
    const bRpgBell = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.085, 0.22, 12), matteBlackMat);
    bRpgBell.rotation.x = Math.PI / 2;
    bRpgBell.position.set(0, 0, -0.58);
    const bRpgWarhead = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.34, 12), redShellMat);
    bRpgWarhead.rotation.x = Math.PI / 2;
    bRpgWarhead.position.set(0, 0, 0.66);
    backRpg.add(bRpgTube, bRpgBell, bRpgWarhead);
    backRpg.position.set(0.06, 0.46, -0.42);
    backRpg.rotation.set(-0.15, Math.PI / 2, -0.68);
    rigGroup.add(backRpg);
    this.vingadorBackRpg = backRpg;

    this.upperBodyGroup.add(rigGroup);
  },

  /**
   * Alterna a arma ativa do Vingador de Chumbo ('dual_smg' | 'shotgun' | 'rpg')
   * e atualiza automaticamente o Arsenal 3D Guardado nas Costas e nos Coldres!
   */
  setVingadorWeapon(weaponKey) {
    this.vingadorWeapon = weaponKey;
    if (this.dualSmgLeft) this.dualSmgLeft.visible = weaponKey === 'dual_smg';
    if (this.dualSmgRight) this.dualSmgRight.visible = weaponKey === 'dual_smg';
    if (this.shotgunGroup) this.shotgunGroup.visible = weaponKey === 'shotgun';
    if (this.rpgGroup) this.rpgGroup.visible = weaponKey === 'rpg';

    if (this.vingadorBackShotgun) {
      this.vingadorBackShotgun.visible = weaponKey !== 'shotgun';
    }
    if (this.vingadorBackRpg) {
      this.vingadorBackRpg.visible = weaponKey !== 'rpg';
    }
    if (this.vingadorHolsteredPistols && this.vingadorHolsteredPistols.length > 0) {
      for (const hp of this.vingadorHolsteredPistols) {
        hp.visible = weaponKey !== 'dual_smg';
      }
    }
    return this.vingadorWeapon;
  },

  /**
   * Ativa/desativa o brilho incandescente nos olhos da Caveira do Peito durante o "Furor do Justiceiro" [Q]
   */
  setVingadorFurorVisual(isActive) {
    this.vingadorFurorActive = Boolean(isActive);
    if (this.vingadorSkullEyes && this.vingadorSkullEyes.length > 0) {
      for (const eye of this.vingadorSkullEyes) {
        if (eye.material) {
          eye.material.color.setHex(isActive ? 0xff1e42 : 0xffffff);
          eye.material.emissive.setHex(isActive ? 0xef4444 : 0xf8fafc);
          eye.material.emissiveIntensity = isActive ? 3.2 : 1.4;
        }
      }
    }
  },

  /**
   * Aplica coice alternado nos braços esquerdo/direito ao disparar as "Castigadoras Gêmeas" (.50)
   */
  triggerVingadorDualRecoil() {
    this.shootTimer = 0.14;
    this.muzzleFlashTimer = 0.05;
    this.vingadorDualRecoilSide = -this.vingadorDualRecoilSide;
    return this.vingadorDualRecoilSide;
  }
};
