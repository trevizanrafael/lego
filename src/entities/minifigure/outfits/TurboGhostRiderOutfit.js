import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';
import { attachTurboChainAndSword } from '../EnergyAndMeleeWeaponsBuilder.js';

/**
 * Constrói a Cabeça de Crânio 3D Real + Cabeleira de Fogo Fantasma em 3 Camadas (`ghost_flame_skull`)
 * fluindo para trás para o Turbo Fantasma (#6).
 */
export function attachTurboSkullHeadgear(minifig) {
  const skullBoneMat = getLegoMaterial(0xe2e8f0, { roughness: 0.22, metalness: 0.25 });
  const darkVoidMat = getLegoMaterial(0x090a0d, { roughness: 0.35 });
  const deepBlueFlameMat = getLegoMaterial(0x0284c7, {
    emissive: 0x0369a1,
    emissiveIntensity: 2.0,
    roughness: 0.1
  });
  const cyanFlameMat = getLegoMaterial(0x06b6d4, {
    emissive: 0x00f5d4,
    emissiveIntensity: 2.4,
    roughness: 0.08
  });
  const whitePlasmaMat = getLegoMaterial(0xffffff, {
    emissive: 0x67e8f9,
    emissiveIntensity: 3.0,
    roughness: 0.05
  });

  // 1. Relevo 3D do Crânio (Sobrancelhas Ósseas, Maçãs do Rosto e Chamas Oculares)
  for (const side of [-1, 1]) {
    const browBone = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.09), skullBoneMat);
    browBone.position.set(side * 0.12, 0.45, 0.33);
    browBone.rotation.z = -side * 0.28;
    browBone.rotation.y = side * 0.24;

    const cheekBone = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.075, 0.12), skullBoneMat);
    cheekBone.position.set(side * 0.21, 0.27, 0.28);
    cheekBone.rotation.y = side * 0.42;
    cheekBone.rotation.z = side * 0.18;

    const eyeFlame = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.18, 5), whitePlasmaMat);
    eyeFlame.position.set(side * 0.14, 0.39, 0.34);
    eyeFlame.rotation.x = -0.55;
    eyeFlame.rotation.z = -side * 0.45;

    minifig.headGroup.add(browBone, cheekBone, eyeFlame);
  }

  // Mandíbula Inferior 3D de Caveira com Dentes Esculpidos e Fenda de Plasma Ciano
  const skullJawGroup = new THREE.Group();
  const jawBone = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.22), skullBoneMat);
  jawBone.position.set(0, 0.11, 0.26);
  const jawPlasmaCore = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.045, 0.23), cyanFlameMat);
  jawPlasmaCore.position.set(0, 0.15, 0.265);
  skullJawGroup.add(jawBone, jawPlasmaCore);

  for (let t = -2; t <= 2; t++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.068, 0.04), skullBoneMat);
    tooth.position.set(t * 0.055, 0.15, 0.368);
    skullJawGroup.add(tooth);
  }
  const nasalCavity = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.09, 3), darkVoidMat);
  nasalCavity.position.set(0, 0.27, 0.355);
  skullJawGroup.add(nasalCavity);
  minifig.headGroup.add(skullJawGroup);

  // 2. Cabeleira de Fogo Fantasma Vivo em 3 Camadas de Cores (20 labaredas orgânicas)
  const flameLayers = [deepBlueFlameMat, cyanFlameMat, whitePlasmaMat];
  for (let i = 0; i < 20; i++) {
    const u = i / 20;
    const ang = u * Math.PI * 2;
    const ringLayer = i % 3;
    const r = ringLayer === 0 ? 0.31 : ringLayer === 1 ? 0.23 : 0.14;
    const h = 0.42 + (i % 4) * 0.11 + (ringLayer === 2 ? 0.08 : 0);
    const mat = flameLayers[ringLayer];

    const flameTongue = new THREE.Mesh(new THREE.ConeGeometry(0.105, h, 5), mat);
    flameTongue.scale.set(1.28, 1.0, 0.54);

    const posX = Math.sin(ang) * r;
    const posZ = Math.cos(ang) * r - 0.08;
    const posY = 0.56 + h * 0.34 - (posZ < 0 ? Math.abs(posZ) * 0.22 : 0);
    flameTongue.position.set(posX, posY, posZ);

    const baseRotX = -0.52 - (1 - Math.cos(ang)) * 0.22;
    const baseRotZ = -Math.sin(ang) * 0.32;
    flameTongue.rotation.set(baseRotX, Math.sin(ang) * 0.25, baseRotZ);

    minifig.headGroup.add(flameTongue);
    minifig.turboFlameMeshes.push({
      mesh: flameTongue,
      phase: i * 0.55,
      speed: 14.0 + (i % 5) * 2.8,
      baseRotX,
      baseRotZ,
      baseScaleX: 1.28,
      baseScaleZ: 0.54
    });
  }
}

export const turboOutfitMethods = {
  /**
   * HERÓI #6: TURBO FANTASMA (OP-06 — CYBER-GHOST RIDER DE PLASMA CIANO):
   * 1) Jaqueta de Couro 3D Aberta com Rebites Cromados + Reator Ciano e 3 Pares de Costelas Metálicas 3D
   * 2) Corrente 3D Real Elo por Elo (14 elos TorusGeometry entrelaçados)
   * 3) Ombreiras Duplas com 3 Espinhos Curvos + Chamas Ciano, Joelheiras de Caveira 3D e Botas Biker
   * 4) Costas: Motor V-Twin Fantasma + 4 Escapamentos Cromados com Chamas Alinhadas na Boca de Cada Cano
   * 5) Mãos: Chicote de Corrente de 10 Elos + Espada "Hellfire V8" de Plasma Ciano
   */
  _attachTurboGhostRiderRig(leftHandGroup, rightHandGroup) {
    const leatherBlack = getLegoMaterial(0x090a0d, { roughness: 0.28, clearcoat: 0.45 });
    const darkSteel = getLegoMaterial(0x1e293b, { metalness: 0.72, roughness: 0.24 });
    const chromeSteel = getLegoMaterial(0xe2e8f0, { metalness: 0.86, roughness: 0.14 });
    const skullBoneMat = getLegoMaterial(0xf8fafc, { roughness: 0.2, metalness: 0.25 });
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

    // 1. JAQUETA DE COURO 3D ABERTA + COSTELAS DE PLASMA E REATOR CENTRAL
    const jacketGroup = new THREE.Group();

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.36, 0.18, 20, 1, true, Math.PI * 0.22, Math.PI * 1.56),
      leatherBlack
    );
    collar.position.set(0, 0.79, -0.02);
    jacketGroup.add(collar);

    for (let nf = -1; nf <= 1; nf++) {
      const neckFlame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 5), nf === 0 ? whiteHotMat : cyanGlow);
      neckFlame.scale.set(1.2, 1.0, 0.55);
      neckFlame.position.set(nf * 0.12, 0.88, -0.18);
      neckFlame.rotation.set(-0.42, 0, -nf * 0.22);
      jacketGroup.add(neckFlame);
      this.turboFlameMeshes.push({
        mesh: neckFlame,
        phase: nf * 1.1,
        speed: 15.0,
        baseRotX: -0.42,
        baseRotZ: -nf * 0.22,
        baseScaleX: 1.2,
        baseScaleZ: 0.55
      });
    }

    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.64, 0.075), leatherBlack);
      lapel.position.set(side * 0.25, 0.44, 0.195);
      lapel.rotation.y = side * 0.18;
      lapel.rotation.z = -side * 0.08;

      const zipperLine = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.62, 0.085), chromeSteel);
      zipperLine.position.set(side * 0.145, 0.44, 0.21);
      zipperLine.rotation.z = -side * 0.12;
      jacketGroup.add(lapel, zipperLine);

      for (const sy of [0.66, 0.52, 0.38]) {
        const stud = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.05, 6), chromeSteel);
        stud.rotation.x = Math.PI / 2;
        stud.position.set(side * 0.24, sy, 0.245);
        jacketGroup.add(stud);
      }
    }

    const chestRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20), chromeSteel);
    chestRing.position.set(0, 0.48, 0.225);
    const chestCore = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.036, 16), whiteHotMat);
    chestCore.rotation.x = Math.PI / 2;
    chestCore.position.set(0, 0.48, 0.225);
    jacketGroup.add(chestRing, chestCore);

    for (let r = 0; r < 3; r++) {
      const ribY = 0.61 - r * 0.13;
      const ribW = 0.16 - r * 0.015;
      for (const side of [-1, 1]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(ribW, 0.032, 0.045), chromeSteel);
        rib.position.set(side * (0.09 + r * 0.01), ribY, 0.222);
        rib.rotation.z = -side * 0.18;
        rib.rotation.y = side * 0.22;
        jacketGroup.add(rib);
      }
    }

    // 2. CORRENTE DE MOTOQUEIRO 3D REAL ELO POR ELO (14 Elos TorusGeometry)
    for (let i = 0; i < 14; i++) {
      const isFront = i < 7;
      const idx = isFront ? i : i - 7;
      const t = idx / 6;
      const lx = THREE.MathUtils.lerp(0.24, -0.25, t);
      const ly = THREE.MathUtils.lerp(0.73, 0.16, t);
      const lz = isFront ? 0.238 + Math.sin(t * Math.PI) * 0.022 : -0.215 - Math.sin(t * Math.PI) * 0.015;

      const linkMat = i % 3 === 0 ? cyanGlow : i % 2 === 0 ? chromeSteel : darkSteel;
      const chainLink = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.015, 7, 14), linkMat);
      chainLink.position.set(lx, ly, lz);
      chainLink.rotation.z = -0.68;
      if (i % 2 === 1) {
        chainLink.rotation.x = Math.PI * 0.42;
        chainLink.rotation.y = 0.45;
      } else {
        chainLink.rotation.x = 0.12;
      }
      jacketGroup.add(chainLink);
    }

    this.upperBodyGroup.add(jacketGroup);

    // 3. OMBREIRAS DE MOTOQUEIRO FANTASMA COM ESPINHOS CURVOS E CHAMAS CIANO
    const armPivots = [
      { pivot: this.leftArmPivot, side: -1 },
      { pivot: this.rightArmPivot, side: 1 }
    ];
    for (const { pivot, side } of armPivots) {
      if (!pivot) continue;
      const pauldronGroup = new THREE.Group();

      const upperPad = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.36), leatherBlack);
      upperPad.position.set(side * 0.06, 0.06, 0);
      upperPad.rotation.z = -side * 0.24;

      const lowerPad = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.1, 0.33), darkSteel);
      lowerPad.position.set(side * 0.09, -0.03, 0);
      lowerPad.rotation.z = -side * 0.38;

      const chromeRim = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.032, 0.38), chromeSteel);
      chromeRim.position.set(side * 0.065, 0.11, 0);
      chromeRim.rotation.z = -side * 0.24;
      pauldronGroup.add(upperPad, lowerPad, chromeRim);

      for (const sz of [-0.11, 0, 0.11]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.22, 6), chromeSteel);
        spike.position.set(side * 0.13, 0.21, sz);
        spike.rotation.z = -side * 0.48;
        pauldronGroup.add(spike);
      }

      for (const fz of [-0.06, 0.06]) {
        const shFlame = new THREE.Mesh(
          new THREE.ConeGeometry(0.065, 0.26, 5),
          fz < 0 ? cyanGlow : whiteHotMat
        );
        shFlame.scale.set(1.2, 1.0, 0.55);
        shFlame.position.set(side * 0.08, 0.24, fz - 0.04);
        const bRotX = -0.38;
        const bRotZ = -side * 0.35;
        shFlame.rotation.set(bRotX, 0, bRotZ);
        pauldronGroup.add(shFlame);
        this.turboFlameMeshes.push({
          mesh: shFlame,
          phase: side + fz * 5.0,
          speed: 15.5,
          baseRotX: bRotX,
          baseRotZ: bRotZ,
          baseScaleX: 1.2,
          baseScaleZ: 0.55
        });
      }

      pivot.add(pauldronGroup);
    }

    // 4. BRAÇADEIRAS COM CORRENTES + CINTURÃO + JOELHEIRAS DE CAVEIRA E BOTAS BIKER
    for (const group of [leftHandGroup, rightHandGroup]) {
      if (!group) continue;
      const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.118, 0.22, 14), leatherBlack);
      bracer.position.set(0, -0.06, 0);
      group.add(bracer);

      for (const cy of [-0.12, -0.05, 0.02]) {
        const wristChain = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.018, 6, 14), chromeSteel);
        wristChain.rotation.x = Math.PI / 2 + 0.15;
        wristChain.position.set(0, cy, 0);
        group.add(wristChain);
      }
    }

    if (this.hipGroup) {
      const beltLeather = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.13, 0.45), leatherBlack);
      beltLeather.position.set(0, 0.08, 0);
      this.hipGroup.add(beltLeather);

      for (let bx = -0.32; bx <= 0.32; bx += 0.16) {
        if (Math.abs(bx) < 0.08) continue;
        const beltLink = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.015, 6, 12), chromeSteel);
        beltLink.position.set(bx, 0.08, 0.235);
        this.hipGroup.add(beltLink);
      }

      const skullBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.05), skullBoneMat);
      skullBuckle.position.set(0, 0.08, 0.238);
      const buckleEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.055), cyanGlow);
      buckleEyeL.position.set(-0.032, 0.095, 0.242);
      const buckleEyeR = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.028, 0.055), cyanGlow);
      buckleEyeR.position.set(0.032, 0.095, 0.242);
      this.hipGroup.add(skullBuckle, buckleEyeL, buckleEyeR);
    }

    const legPivots = [
      { pivot: this.leftLegPivot, side: -1 },
      { pivot: this.rightLegPivot, side: 1 }
    ];
    for (const { pivot, side } of legPivots) {
      if (!pivot) continue;
      const kneeSkull = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.08), chromeSteel);
      kneeSkull.position.set(0, -0.34, 0.21);
      const kneeJaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.08), skullBoneMat);
      kneeJaw.position.set(0, -0.41, 0.215);
      const kneeEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.09), cyanGlow);
      kneeEyeL.position.set(-0.045, -0.33, 0.215);
      const kneeEyeR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.09), cyanGlow);
      kneeEyeR.position.set(0.045, -0.33, 0.215);

      const bootShin = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.45), leatherBlack);
      bootShin.position.set(0, -0.53, 0.01);
      const bootChromeFront = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.47), darkSteel);
      bootChromeFront.position.set(0, -0.53, 0.02);

      for (const by of [-0.45, -0.53, -0.61]) {
        const buckleStrap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.028, 0.26), chromeSteel);
        buckleStrap.position.set(side * 0.01, by, 0.04);
        pivot.add(buckleStrap);
      }

      const bootToeCap = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.1, 0.16), chromeSteel);
      bootToeCap.position.set(0, -0.66, 0.27);
      const heelSpur = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.16, 4), cyanGlow);
      heelSpur.rotation.x = -Math.PI / 2;
      heelSpur.position.set(0, -0.62, -0.25);

      pivot.add(kneeSkull, kneeJaw, kneeEyeL, kneeEyeR, bootShin, bootChromeFront, bootToeCap, heelSpur);
    }

    // 5. COSTAS: MOTOR V8 FANTASMA 3D + 4 ESCAPAMENTOS COM FOGO ALINHADO NA BOCA DO CANO
    const backRig = new THREE.Group();
    backRig.position.set(0, 0.44, -0.28);

    const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.42, 0.18), leatherBlack);
    const engineChromeFrame = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.34, 0.14), darkSteel);
    backRig.add(engineBlock, engineChromeFrame);

    for (let fin = -2; fin <= 2; fin++) {
      const coolingFin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.024, 0.16), chromeSteel);
      coolingFin.position.set(0, fin * 0.07, -0.01);
      backRig.add(coolingFin);
    }

    const turbineRim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.032, 10, 20), chromeSteel);
    turbineRim.position.set(0, 0.02, -0.1);
    const turbinePlasma = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), whiteHotMat);
    turbinePlasma.rotation.x = Math.PI / 2;
    turbinePlasma.position.set(0, 0.02, -0.1);
    backRig.add(turbineRim, turbinePlasma);

    const pipeSpecs = [
      { sx: -0.2, sy: 0.12, sz: -0.04, rotZ: 0.62, rotX: -0.32, pipeLen: 0.52 },
      { sx: 0.2, sy: 0.12, sz: -0.04, rotZ: -0.62, rotX: -0.32, pipeLen: 0.52 },
      { sx: -0.22, sy: -0.04, sz: -0.06, rotZ: 0.88, rotX: -0.26, pipeLen: 0.46 },
      { sx: 0.22, sy: -0.04, sz: -0.06, rotZ: -0.88, rotX: -0.26, pipeLen: 0.46 }
    ];

    for (let p = 0; p < pipeSpecs.length; p++) {
      const ps = pipeSpecs[p];
      const pipeGroup = new THREE.Group();
      pipeGroup.position.set(ps.sx, ps.sy, ps.sz);
      pipeGroup.rotation.z = ps.rotZ;
      pipeGroup.rotation.x = ps.rotX;

      const pipeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.046, ps.pipeLen, 14), chromeSteel);
      const heatShield = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.054, ps.pipeLen * 0.6, 12), darkSteel);
      const muzzleRim = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.012, 8, 14), leatherBlack);
      muzzleRim.rotation.x = Math.PI / 2;
      muzzleRim.position.set(0, ps.pipeLen * 0.5, 0);

      const flameHeight = 0.34;
      const exhaustFlameGroup = new THREE.Group();
      exhaustFlameGroup.position.set(0, ps.pipeLen * 0.5 + flameHeight * 0.35, 0);

      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.068, flameHeight, 7), cyanGlow);
      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.042, flameHeight * 0.78, 6), whiteHotMat);
      innerFlame.position.set(0, -0.02, 0);
      exhaustFlameGroup.add(outerFlame, innerFlame);

      pipeGroup.add(pipeMesh, heatShield, muzzleRim, exhaustFlameGroup);
      backRig.add(pipeGroup);

      this.turboFlameMeshes.push({
        mesh: exhaustFlameGroup,
        phase: p * 0.9,
        speed: 22.0,
        baseRotX: 0,
        baseRotZ: 0,
        isExhaust: true
      });
    }

    this.upperBodyGroup.add(backRig);

    // 6 & 7. Mão Esquerda (Chicote de Corrente) + Mão Direita (Espada "Hellfire V8")
    attachTurboChainAndSword(this, leftHandGroup, rightHandGroup);
  }
};
