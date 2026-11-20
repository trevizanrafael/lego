import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';

/**
 * Constrói o Escudo de Choque PMESP + Minigun Vulcan Rotativa de 6 Canos para o Titã Blindado (#3).
 */
export function attachTitaShieldAndVulcan(minifig, leftHandGroup, rightHandGroup) {
  const pmWhite = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.6 });
  const pmDarkGrey = getLegoMaterial(0x1e293b, { roughness: 0.26, metalness: 0.55 });
  const pmBlack = getLegoMaterial(0x090a0d, { roughness: 0.32, metalness: 0.35 });
  const pmRed = getLegoMaterial(0xdc2626, { roughness: 0.2, clearcoat: 0.55 });
  const silverSteel = getLegoMaterial(LEGO_COLORS.silver, { roughness: 0.16, metalness: 0.75 });
  const redGlow = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.2 });

  // =========================================================================
  // 1. BRAÇO ESQUERDO: ESCUDO DE CHOQUE DA TROPA DE CHOQUE PMESP
  // =========================================================================
  const shield = new THREE.Group();
  const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.96, 0.66), pmDarkGrey);
  shieldPlate.castShadow = true;
  const shieldWhiteTop = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.34, 0.64), pmWhite);
  shieldWhiteTop.position.set(0, 0.28, 0);
  const shieldRedStripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.65), pmRed);
  shieldRedStripe.position.set(0, 0.06, 0);
  const shieldVisor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.46), redGlow);
  shieldVisor.position.set(0, 0.26, 0);
  const shieldBumper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.68), silverSteel);
  shieldBumper.position.set(0, -0.36, 0);

  shield.add(shieldPlate, shieldWhiteTop, shieldRedStripe, shieldVisor, shieldBumper);
  shield.position.set(0.22, -0.24, 0.12);
  leftHandGroup.add(shield);
  minifig.titaShieldGroup = shield;

  // =========================================================================
  // 2. BRAÇO DIREITO: MINIGUN VULCAN PESADA DE 6 CANOS GIRATÓRIOS + TAMBOR PMESP
  // =========================================================================
  const cannon = new THREE.Group();

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.56), pmBlack);
  housing.position.set(-0.16, 0, 0.2);
  housing.castShadow = true;
  const housingStripe = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.08, 0.52), pmRed);
  housingStripe.position.set(-0.16, 0.06, 0.2);
  cannon.add(housing, housingStripe);

  const ammoDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.26, 16), pmRed);
  ammoDrum.rotation.z = Math.PI / 2;
  ammoDrum.position.set(-0.34, -0.1, 0.18);
  const drumCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.28, 16), pmWhite);
  drumCap.rotation.z = Math.PI / 2;
  drumCap.position.set(-0.34, -0.1, 0.18);
  const ammoChute = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.18), silverSteel);
  ammoChute.position.set(-0.26, -0.02, 0.22);
  cannon.add(ammoDrum, drumCap, ammoChute);

  const barrelCluster = new THREE.Group();
  barrelCluster.position.set(-0.16, 0, 0.48);

  const barrelCount = 6;
  const clusterRadius = 0.088;
  const barrelLength = 0.78;
  for (let b = 0; b < barrelCount; b++) {
    const ang = (b / barrelCount) * Math.PI * 2;
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, barrelLength, 10),
      silverSteel
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(
      Math.cos(ang) * clusterRadius,
      Math.sin(ang) * clusterRadius,
      barrelLength * 0.5
    );
    barrelCluster.add(barrel);
  }

  for (const ringZ of [0.22, 0.64]) {
    const clampRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.125, 0.055, 16),
      ringZ > 0.5 ? pmRed : pmDarkGrey
    );
    clampRing.rotation.x = Math.PI / 2;
    clampRing.position.set(0, 0, ringZ);
    barrelCluster.add(clampRing);
  }

  cannon.add(barrelCluster);
  minifig.titaMinigunBarrelGroup = barrelCluster;

  const flashMat = getLegoMaterial(0xfef08a, {
    emissive: 0xef4444,
    emissiveIntensity: 2.6,
    transparent: true,
    opacity: 0.94
  });
  minifig.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), flashMat);
  minifig.muzzleFlashMesh.scale.set(1.0, 1.0, 2.8);
  minifig.muzzleFlashMesh.position.set(-0.16, 0, 1.38);
  minifig.muzzleFlashMesh.visible = false;
  cannon.add(minifig.muzzleFlashMesh);

  cannon.position.set(0, -0.32, 0.08);
  cannon.rotation.x = Math.PI / 2 - 0.12;
  rightHandGroup.add(cannon);
  minifig.titaCannonGroup = cannon;
}

export const ballisticWeaponMethods = {
  /**
   * Constrói o Fuzil de Assalto Pesado do BOPE (IA2 / PARA-FAL / M4 Tático Preto Fosco e Grafite)
   * com Mira Holográfica Vermelha, Módulo Laser PEQ, Lança-Granadas Sub-Cano (M203) e Supressor Tático
   */
  _attachTacticalRifle(handGroup) {
    const rifle = new THREE.Group();
    const matteBlack = getLegoMaterial(0x090a0d, { roughness: 0.34, clearcoat: 0.2 });
    const gunMetal = getLegoMaterial(0x1f2937, { roughness: 0.25, metalness: 0.55 });
    const steelMat = getLegoMaterial(0x475569, { roughness: 0.22, metalness: 0.65 });
    const goldAccent = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.6, roughness: 0.18 });
    const redLaserMat = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 2.2 });

    // 1. Corpo receptor pesado (Upper & Lower Receiver) em preto fosco e aço grafite
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.62), matteBlack);
    receiver.position.set(0, 0.01, 0.22);
    receiver.castShadow = true;
    rifle.add(receiver);

    const upperRail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.88), gunMetal);
    upperRail.position.set(0, 0.12, 0.36);
    rifle.add(upperRail);

    const bopeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.136, 0.03, 0.36), goldAccent);
    bopeTrim.position.set(0, 0.05, 0.18);
    rifle.add(bopeTrim);

    // 2. Guarda-mão longo ventilado com trilhos Picatinny
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.14, 0.44), gunMetal);
    handguard.position.set(0, 0.03, 0.64);
    handguard.castShadow = true;
    rifle.add(handguard);

    // 3. Cano pesado de aço + Supressor/Quebra-Chamas Tático na ponta
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.62, 12), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, 0.78);
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.26, 14), matteBlack);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.04, 1.04);
    const muzzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 14), goldAccent);
    muzzleRing.rotation.x = Math.PI / 2;
    muzzleRing.position.set(0, 0.04, 0.94);
    rifle.add(barrel, suppressor, muzzleRing);

    // 4. Lança-Granadas Tático acoplado sob o cano (Underbarrel M203 — dispara as bombas de impulso!)
    const glTube = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.38, 12), matteBlack);
    glTube.rotation.x = Math.PI / 2;
    glTube.position.set(0, -0.075, 0.66);
    const glGrip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.26), gunMetal);
    glGrip.position.set(0, -0.075, 0.64);
    const glMuzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 12), goldAccent);
    glMuzzle.rotation.x = Math.PI / 2;
    glMuzzle.position.set(0, -0.075, 0.85);
    rifle.add(glTube, glGrip, glMuzzle);

    // 5. Carregador curvo estendido de 40 tiros com base dourada
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.32, 0.13), matteBlack);
    mag.position.set(0, -0.2, 0.33);
    mag.rotation.x = 0.24;
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.045, 0.14), goldAccent);
    magBase.position.set(0, -0.35, 0.37);
    magBase.rotation.x = 0.24;
    rifle.add(mag, magBase);

    // 6. Coronha Tática Retrátil (SOPMOD Stock)
    const stockTube = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.28, 10), gunMetal);
    stockTube.rotation.x = Math.PI / 2;
    stockTube.position.set(0, 0.02, -0.14);
    const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.14), matteBlack);
    stockPad.position.set(0, -0.02, -0.24);
    rifle.add(stockTube, stockPad);

    // 7. Mira Holográfica EOTech Vazada com Lente Vermelha Emissiva + Laser Lateral PEQ-15
    const holoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.18), matteBlack);
    holoFrame.position.set(0, 0.18, 0.24);
    const holoLens = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), redLaserMat);
    holoLens.position.set(0, 0.19, 0.28);
    const peqBox = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.16), matteBlack);
    peqBox.position.set(-0.07, 0.06, 0.72);
    const peqLaser = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), redLaserMat);
    peqLaser.position.set(-0.07, 0.06, 0.81);
    rifle.add(holoFrame, holoLens, peqBox, peqLaser);

    // 8. Clarão de disparo (Muzzle Flash) na ponta do supressor
    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.92
    });
    this.muzzleFlashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), flashMat);
    this.muzzleFlashMesh.scale.set(0.85, 0.85, 2.4);
    this.muzzleFlashMesh.position.set(0, 0.04, 1.24);
    this.muzzleFlashMesh.visible = false;
    rifle.add(this.muzzleFlashMesh);

    rifle.position.set(0, -0.34, 0.12);
    rifle.rotation.x = Math.PI / 2 - 0.15;
    handGroup.add(rifle);
    this.rifleGroup = rifle;
  },

  /**
   * Constrói o Arsenal Triplo Remodelado 3D do Vingador de Chumbo (#4 — O Justiceiro):
   * 1) "CASTIGADORAS GÊMEAS" — Duas Desert Eagles / Auto-Magnums Calibre .50 em Aço Cromado & Preto com Mira Laser e Caveira
   * 2) ESCOPETA DE TAMBOR "JUIZ FINAL" (Estilo AA-12 / SPAS-12 com Tambor Gigante, Escudo Térmico, Cartuchos e Baioneta Serrilhada)
   * 3) BAZUCA PESADA "ANIQUILADORA" (Tubo Militar Verde-Oliva/Preto com Ogiva Vermelha/Preta Aparente, Visor Óptico e Mira Laser)
   */
  _attachVingadorArsenal(leftHandGroup, rightHandGroup) {
    const gunMetal = getLegoMaterial(0x1e293b, { roughness: 0.22, metalness: 0.58 });
    const matteBlack = getLegoMaterial(0x111318, { roughness: 0.3, clearcoat: 0.25 });
    const chromeSilver = getLegoMaterial(0xd8dde6, { roughness: 0.14, metalness: 0.82, clearcoat: 0.65 });
    const skullWhite = getLegoMaterial(0xf8fafc, { roughness: 0.2 });
    const redShellMat = getLegoMaterial(0xdc2626, { roughness: 0.22 });
    const brassMat = getLegoMaterial(0xfacc15, { roughness: 0.18, metalness: 0.7 });
    const oliveMat = getLegoMaterial(0x365314, { roughness: 0.32 });
    const redLaserMat = getLegoMaterial(0xff1e42, {
      emissive: 0xef4444,
      emissiveIntensity: 2.5,
      roughness: 0.1
    });
    const scopeGreenMat = getLegoMaterial(0x22c55e, {
      emissive: 0x16a34a,
      emissiveIntensity: 2.0
    });
    const flashMat = getLegoMaterial(0xfef08a, {
      emissive: 0xf97316,
      emissiveIntensity: 2.6,
      transparent: true,
      opacity: 0.94
    });

    // 1. ARMA 1: "CASTIGADORAS GÊMEAS" (DUAS DESERT EAGLES / AUTO-MAGNUMS .50)
    const buildPunisherMagnum = (isLeft) => {
      const gun = new THREE.Group();

      const lowerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.11, 0.56), matteBlack);
      lowerFrame.position.set(0, -0.02, 0.24);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.26, 0.15), matteBlack);
      grip.position.set(0, -0.15, 0.02);
      grip.rotation.x = -0.22;

      const extMag = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.22, 0.11), gunMetal);
      extMag.position.set(0, -0.28, 0.06);
      extMag.rotation.x = -0.22;
      const magBumper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.14), chromeSilver);
      magBumper.position.set(0, -0.38, 0.08);

      const skullGripDecal = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.11, 0.09), skullWhite);
      skullGripDecal.position.set(0, -0.13, 0.02);
      skullGripDecal.rotation.x = -0.22;

      const heavySlide = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.145, 0.62), chromeSilver);
      heavySlide.position.set(0, 0.075, 0.27);
      heavySlide.castShadow = true;

      for (const vz of [0.18, 0.28, 0.38, 0.48]) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.045, 0.04), matteBlack);
        vent.position.set(0, 0.085, vz);
        gun.add(vent);
      }
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.032, 0.54), matteBlack);
      topRail.position.set(0, 0.155, 0.26);

      const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.16, 0.16), matteBlack);
      muzzleBrake.position.set(0, 0.07, 0.64);
      const boreHole = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.18, 12), chromeSilver);
      boreHole.rotation.x = Math.PI / 2;
      boreHole.position.set(0, 0.075, 0.65);

      const laserPod = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.075, 0.22), matteBlack);
      laserPod.position.set(0, -0.08, 0.42);
      const laserLens = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 10), redLaserMat);
      laserLens.rotation.x = Math.PI / 2;
      laserLens.position.set(0, -0.08, 0.54);
      const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.55, 6), redLaserMat);
      laserBeam.rotation.x = Math.PI / 2;
      laserBeam.position.set(0, -0.08, 0.82);

      gun.add(
        lowerFrame,
        grip,
        extMag,
        magBumper,
        skullGripDecal,
        heavySlide,
        topRail,
        muzzleBrake,
        boreHole,
        laserPod,
        laserLens,
        laserBeam
      );

      const flash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), flashMat);
      flash.scale.set(0.95, 0.95, 2.4);
      flash.position.set(0, 0.075, 0.82);
      flash.visible = false;
      gun.add(flash);
      if (isLeft) this.leftMuzzleFlashMesh = flash;
      else this.muzzleFlashMesh = flash;

      gun.position.set(0, -0.34, 0.1);
      gun.rotation.x = Math.PI / 2 - 0.15;
      return gun;
    };

    this.dualSmgLeft = buildPunisherMagnum(true);
    this.dualSmgRight = buildPunisherMagnum(false);
    leftHandGroup.add(this.dualSmgLeft);
    rightHandGroup.add(this.dualSmgRight);

    // 2. ARMA 2: ESCOPETA AUTOMÁTICA DE TAMBOR "JUIZ FINAL" (AA-12 / SPAS-12)
    const shotgun = new THREE.Group();

    const sgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.64), matteBlack);
    sgReceiver.position.set(0, 0.02, 0.24);
    const sgSidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.42), chromeSilver);
    sgSidePlate.position.set(0, 0.03, 0.22);

    const drumGroup = new THREE.Group();
    drumGroup.position.set(0, -0.2, 0.32);
    const drumBody = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.2, 18), matteBlack);
    drumBody.rotation.x = Math.PI / 2;
    const drumFace = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.21, 16), chromeSilver);
    drumFace.rotation.x = Math.PI / 2;
    const drumCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 12), redShellMat);
    drumCenter.rotation.x = Math.PI / 2;
    drumGroup.add(drumBody, drumFace, drumCenter);
    shotgun.add(drumGroup);

    const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.82, 14), chromeSilver);
    sgBarrel.rotation.x = Math.PI / 2;
    sgBarrel.position.set(0, 0.08, 0.72);
    const sgGasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.68, 12), gunMetal);
    sgGasTube.rotation.x = Math.PI / 2;
    sgGasTube.position.set(0, -0.01, 0.66);
    const heatShield = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.11, 0.56), matteBlack);
    heatShield.position.set(0, 0.1, 0.68);
    const sgMuzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.072, 0.16, 12), matteBlack);
    sgMuzzleBrake.rotation.x = Math.PI / 2;
    sgMuzzleBrake.position.set(0, 0.08, 1.14);

    for (let i = 0; i < 4; i++) {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 8), redShellMat);
      shell.position.set(0.095, 0.03, 0.1 + i * 0.08);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.025, 8), brassMat);
      rim.position.set(0.095, -0.02, 0.1 + i * 0.08);
      shotgun.add(shell, rim);
    }

    const bayonetBlade = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.09, 0.38), chromeSilver);
    bayonetBlade.position.set(0, -0.08, 1.08);
    const bayonetTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), chromeSilver);
    bayonetTip.rotation.x = Math.PI / 2;
    bayonetTip.position.set(0, -0.08, 1.34);

    const sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.34), matteBlack);
    sgStock.position.set(0, -0.02, -0.18);

    shotgun.add(
      sgReceiver,
      sgSidePlate,
      sgBarrel,
      sgGasTube,
      heatShield,
      sgMuzzleBrake,
      bayonetBlade,
      bayonetTip,
      sgStock
    );
    shotgun.position.set(0, -0.34, 0.12);
    shotgun.rotation.x = Math.PI / 2 - 0.15;
    rightHandGroup.add(shotgun);
    this.shotgunGroup = shotgun;

    // 3. ARMA 3: BAZUCA PESADA "ANIQUILADORA" (LANÇA-FOGUETES COM ROCKET JUMP)
    const rpg = new THREE.Group();

    const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 1.32, 16), oliveMat);
    rpgTube.rotation.x = Math.PI / 2;
    rpgTube.position.set(0, 0.08, 0.38);

    for (const rz of [-0.1, 0.25, 0.65, 0.95]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.126, 0.07, 16), matteBlack);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 0.08, rz);
      rpg.add(band);
    }

    const rpgBell = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.105, 0.28, 16), matteBlack);
    rpgBell.rotation.x = Math.PI / 2;
    rpgBell.position.set(0, 0.08, -0.36);

    const warheadBody = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.1, 0.24, 14), matteBlack);
    warheadBody.rotation.x = Math.PI / 2;
    warheadBody.position.set(0, 0.08, 1.12);
    const warheadCone = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.38, 14), redShellMat);
    warheadCone.rotation.x = Math.PI / 2;
    warheadCone.position.set(0, 0.08, 1.41);
    const warheadTip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.12, 10), chromeSilver);
    warheadTip.rotation.x = Math.PI / 2;
    warheadTip.position.set(0, 0.08, 1.62);

    const opticHousing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.26), matteBlack);
    opticHousing.position.set(0.15, 0.16, 0.48);
    const opticLens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 12), scopeGreenMat);
    opticLens.rotation.x = Math.PI / 2;
    opticLens.position.set(0.15, 0.16, 0.48);
    const rpgLaser = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.22, 10), redLaserMat);
    rpgLaser.rotation.x = Math.PI / 2;
    rpgLaser.position.set(-0.14, 0.12, 0.72);
    const rpgSkullStencil = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.12, 0.16), skullWhite);
    rpgSkullStencil.position.set(0, 0.08, 0.46);

    const rpgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.24, 0.13), matteBlack);
    rpgGrip.position.set(0, -0.1, 0.26);
    const rpgForegrip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.11), matteBlack);
    rpgForegrip.position.set(0, -0.09, 0.68);

    rpg.add(
      rpgTube,
      rpgBell,
      warheadBody,
      warheadCone,
      warheadTip,
      opticHousing,
      opticLens,
      rpgLaser,
      rpgSkullStencil,
      rpgGrip,
      rpgForegrip
    );
    rpg.position.set(0, -0.34, 0.12);
    rpg.rotation.x = Math.PI / 2 - 0.15;
    rightHandGroup.add(rpg);
    this.rpgGroup = rpg;

    this.setVingadorWeapon(this.vingadorWeapon || 'dual_smg');
  }
};
