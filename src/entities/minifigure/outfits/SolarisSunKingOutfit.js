import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói a Coroa Real de Raios Solares 3D (Sunburst Crown) + Cabelo de Fogo Vivo (`visor_crown`)
 * do Solaris (#2 — Rei do Sol).
 */
export function attachSolarisCrownHeadgear(minifig) {
  const crownGroup = new THREE.Group();
  const crownMat = getLegoMaterial(LEGO_COLORS.gold, {
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.65,
    roughness: 0.14,
    clearcoat: 0.65
  });
  const crimsonCrownMat = getLegoMaterial(0x7f1d1d, {
    roughness: 0.22,
    clearcoat: 0.5
  });
  const whiteSolarMat = getLegoMaterial(0xffffff, {
    emissive: 0xfef08a,
    emissiveIntensity: 2.4,
    roughness: 0.08
  });
  const flameGoldMat = getLegoMaterial(0xfef08a, {
    emissive: 0xfacc15,
    emissiveIntensity: 2.1,
    roughness: 0.1
  });
  const flameOrangeMat = getLegoMaterial(0xf97316, {
    emissive: 0xea580c,
    emissiveIntensity: 1.9,
    roughness: 0.12
  });
  const flameRedMat = getLegoMaterial(0xef4444, {
    emissive: 0xdc2626,
    emissiveIntensity: 1.75,
    roughness: 0.14
  });

  const lowerTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.382, 0.376, 0.045, 28),
    crimsonCrownMat
  );
  lowerTrim.position.set(0, 0.56, 0);
  crownGroup.add(lowerTrim);

  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.382, 0.12, 28),
    crownMat
  );
  band.position.set(0, 0.615, 0);
  band.castShadow = true;
  crownGroup.add(band);

  const frontCrest = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.075),
    crownMat
  );
  frontCrest.position.set(0, 0.66, 0.37);
  frontCrest.rotation.z = Math.PI / 4;
  crownGroup.add(frontCrest);

  const frontGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.085, 0),
    whiteSolarMat
  );
  frontGem.position.set(0, 0.66, 0.41);
  crownGroup.add(frontGem);

  const spikeCount = 7;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2;
    const isFront = Math.cos(angle) > 0.25;
    const isCenterFront = Math.abs(Math.sin(angle)) < 0.2 && Math.cos(angle) > 0.8;
    const spikeHeight = isCenterFront ? 0.34 : isFront ? 0.26 : 0.19;
    const spikeRadius = isCenterFront ? 0.075 : 0.058;

    const spikePivot = new THREE.Group();
    spikePivot.position.set(
      Math.sin(angle) * 0.365,
      0.66,
      Math.cos(angle) * 0.365
    );
    spikePivot.rotation.y = angle;
    spikePivot.rotation.x = 0.22;

    const spikeMesh = new THREE.Mesh(
      new THREE.ConeGeometry(spikeRadius, spikeHeight, 4),
      crownMat
    );
    spikeMesh.position.y = spikeHeight * 0.5;
    spikeMesh.rotation.y = Math.PI / 4;
    spikeMesh.castShadow = true;
    spikePivot.add(spikeMesh);

    if (isFront) {
      const crystalInlay = new THREE.Mesh(
        new THREE.ConeGeometry(spikeRadius * 0.52, spikeHeight * 0.72, 4),
        whiteSolarMat
      );
      crystalInlay.position.set(0, spikeHeight * 0.46, 0.022);
      crystalInlay.rotation.y = Math.PI / 4;
      spikePivot.add(crystalInlay);
    }

    crownGroup.add(spikePivot);
  }

  // CABELO DE FOGO VIVO 3D (14 Línguas / Prismas de Chamas Animadas)
  const flameMats = [flameRedMat, flameOrangeMat, flameGoldMat, whiteSolarMat];
  for (let i = 0; i < 14; i++) {
    const layer = i < 8 ? 0 : 1;
    const angle = (i / (layer === 0 ? 8 : 6)) * Math.PI * 2 + layer * 0.4;
    const radialDist = layer === 0 ? 0.23 : 0.11;
    const baseH = layer === 0 ? 0.28 + (i % 3) * 0.06 : 0.38 + (i % 2) * 0.08;
    const baseR = layer === 0 ? 0.095 : 0.11;
    const mat = flameMats[(i + layer) % flameMats.length];

    const flameMesh = new THREE.Mesh(
      new THREE.ConeGeometry(baseR, baseH, 5),
      mat
    );
    const baseY = 0.62 + baseH * 0.42;
    flameMesh.position.set(
      Math.sin(angle) * radialDist,
      baseY,
      Math.cos(angle) * radialDist
    );
    flameMesh.rotation.x = Math.cos(angle) * (layer === 0 ? 0.26 : 0.12);
    flameMesh.rotation.z = -Math.sin(angle) * (layer === 0 ? 0.26 : 0.12);
    crownGroup.add(flameMesh);

    minifig.crownFlameMeshes.push({
      mesh: flameMesh,
      baseY,
      baseScaleY: 1.0,
      phase: i * 0.75,
      speed: 7.5 + (i % 4) * 2.2,
      baseRotX: flameMesh.rotation.x,
      baseRotZ: flameMesh.rotation.z
    });
  }

  const coreFlame = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 14, 14),
    flameGoldMat
  );
  coreFlame.position.set(0, 0.66, 0);
  crownGroup.add(coreFlame);

  minifig.headGroup.add(crownGroup);
}

export const solarisOutfitMethods = {
  /**
   * Equipa a Armadura Imperial Completa 3D do Solaris ("Rei do Sol" — OP-02):
   * 1) Peitoral Imperial Dourado 3D com Sol Relevado de 8 Raios e Reator Solar Esférico Pulsante
   * 2) Ombreiras de Raios Solares 3D (Sunburst Pauldrons) com Pontas Douradas e Chamas Vivas nos Ombros
   * 3) Braçadeiras Reais Douradas (Vambraces) com Lâminas de Fogo nos Pulsos
   * 4) Cinto Imperial Dourado + Grevas/Botas Douradas com Asas Solares nas Pernas
   * 5) Manto Real de Fogo Vivo 3D nas Costas (Gola Alta Imperial + Halo Solar Dorsal + 5 Caudas de Fogo Animadas)
   */
  _attachSolarisSunKingRig() {
    const royalGold = getLegoMaterial(LEGO_COLORS.gold, {
      emissive: 0xd97706,
      emissiveIntensity: 0.38,
      metalness: 0.68,
      roughness: 0.15,
      clearcoat: 0.65
    });
    const deepCrimson = getLegoMaterial(0x7f1d1d, {
      roughness: 0.22,
      clearcoat: 0.5
    });
    const whitePlasma = getLegoMaterial(0xffffff, {
      emissive: 0xfef08a,
      emissiveIntensity: 2.6,
      roughness: 0.06
    });
    const solarYellow = getLegoMaterial(0xfef08a, {
      emissive: 0xfacc15,
      emissiveIntensity: 2.1,
      roughness: 0.1
    });
    const solarOrange = getLegoMaterial(0xf97316, {
      emissive: 0xea580c,
      emissiveIntensity: 1.85,
      roughness: 0.12
    });
    const solarRed = getLegoMaterial(0xef4444, {
      emissive: 0xdc2626,
      emissiveIntensity: 1.65,
      roughness: 0.15
    });

    // 1. PEITORAL IMPERIAL 3D COM SOL RELEVADO DE 8 RAIOS & REATOR SOLAR
    const chestArmor = new THREE.Group();

    const upperCuirass = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.34, 0.065),
      royalGold
    );
    upperCuirass.position.set(0, 0.52, 0.215);
    upperCuirass.castShadow = true;
    chestArmor.add(upperCuirass);

    const lowerCuirass = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.26, 0.055),
      deepCrimson
    );
    lowerCuirass.position.set(0, 0.24, 0.212);
    chestArmor.add(lowerCuirass);

    const abGoldTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.05, 0.062),
      royalGold
    );
    abGoldTrim.position.set(0, 0.33, 0.215);
    chestArmor.add(abGoldTrim);

    const sunEmblemGroup = new THREE.Group();
    sunEmblemGroup.position.set(0, 0.48, 0.252);

    const sunRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155, 0.155, 0.036, 20),
      royalGold
    );
    sunRing.rotation.x = Math.PI / 2;
    sunEmblemGroup.add(sunRing);

    for (let r = 0; r < 8; r++) {
      const angle = (r / 8) * Math.PI * 2;
      const isMainRay = r % 2 === 0;
      const rayLen = isMainRay ? 0.16 : 0.11;
      const rayMesh = new THREE.Mesh(
        new THREE.ConeGeometry(isMainRay ? 0.042 : 0.03, rayLen, 4),
        isMainRay ? royalGold : solarYellow
      );
      rayMesh.position.set(
        Math.cos(angle) * (0.14 + rayLen * 0.32),
        Math.sin(angle) * (0.14 + rayLen * 0.32),
        0.005
      );
      rayMesh.rotation.z = angle - Math.PI / 2;
      sunEmblemGroup.add(rayMesh);
    }

    const reactorSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 16, 16),
      whitePlasma
    );
    reactorSphere.position.set(0, 0, 0.018);
    sunEmblemGroup.add(reactorSphere);

    chestArmor.add(sunEmblemGroup);
    this.upperBodyGroup.add(chestArmor);

    // 2. OMBREIRAS DE RAIOS SOLARES 3D (SUNBURST PAULDRONS) + CHAMAS NOS OMBROS
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const pauldronGroup = new THREE.Group();

      const pauldronMain = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.26, 0.42),
        royalGold
      );
      pauldronMain.position.set(sign * 0.08, 0.02, 0);
      pauldronMain.rotation.z = -sign * 0.18;
      pauldronMain.castShadow = true;

      const pauldronUnder = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.12, 0.44),
        deepCrimson
      );
      pauldronUnder.position.set(sign * 0.07, -0.08, 0);
      pauldronUnder.rotation.z = -sign * 0.15;
      pauldronGroup.add(pauldronMain, pauldronUnder);

      for (let s = -1; s <= 1; s++) {
        const spikeH = s === 0 ? 0.24 : 0.18;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.052, spikeH, 4),
          royalGold
        );
        spike.position.set(sign * (0.19 + (s === 0 ? 0.03 : 0)), 0.14, s * 0.12);
        spike.rotation.z = -sign * 0.62;
        spike.rotation.x = s * 0.28;
        pauldronGroup.add(spike);
      }

      for (let f = 0; f < 2; f++) {
        const shoulderFlame = new THREE.Mesh(
          new THREE.ConeGeometry(0.068, 0.24, 5),
          f === 0 ? solarOrange : solarYellow
        );
        const baseY = 0.21 + f * 0.04;
        shoulderFlame.position.set(sign * 0.12, baseY, (f - 0.5) * 0.1);
        pauldronGroup.add(shoulderFlame);
        this.crownFlameMeshes.push({
          mesh: shoulderFlame,
          baseY,
          baseScaleY: 1.0,
          phase: sign * 1.5 + f * 1.1,
          speed: 8.5,
          baseRotX: 0,
          baseRotZ: -sign * 0.15
        });
      }

      armPivot.add(pauldronGroup);
    }

    // 3. BRAÇADEIRAS REAIS DOURADAS (VAMBRACES) COM LÂMINAS DE FOGO NOS PULSOS
    for (const [handGrp, sign] of [[this.leftHandGroup, 1], [this.rightHandGroup, -1]]) {
      const vambrace = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.2, 0.27),
        royalGold
      );
      vambrace.position.set(0, -0.12, 0);
      const crimsonBand = new THREE.Mesh(
        new THREE.BoxGeometry(0.268, 0.055, 0.278),
        deepCrimson
      );
      crimsonBand.position.set(0, -0.12, 0);

      const flameFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.24, 4),
        solarOrange
      );
      flameFin.position.set(sign * 0.15, -0.06, -0.04);
      flameFin.rotation.z = -sign * 0.35;
      handGrp.add(vambrace, crimsonBand, flameFin);
    }

    // 4. CINTO REAL SOLAR + GREVAS & BOTAS IMPERIAIS DOURADAS NAS PERNAS
    const beltGroup = new THREE.Group();
    const beltBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.13, 0.48),
      royalGold
    );
    beltBand.position.set(0, 0.08, 0);
    const beltBuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16),
      whitePlasma
    );
    beltBuckle.rotation.x = Math.PI / 2;
    beltBuckle.position.set(0, 0.08, 0.235);

    for (const side of [-1, 1]) {
      const hipTasset = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.28, 0.44),
        royalGold
      );
      hipTasset.position.set(side * 0.41, -0.06, 0);
      hipTasset.rotation.z = -side * 0.14;
      beltGroup.add(hipTasset);
    }
    beltGroup.add(beltBand, beltBuckle);
    this.hipGroup.add(beltGroup);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const kneeSun = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.2, 0.12),
        royalGold
      );
      kneeSun.position.set(0, -0.36, 0.18);
      const kneeGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.06, 0),
        solarYellow
      );
      kneeGem.position.set(0, -0.36, 0.245);

      const greaveBoot = new THREE.Mesh(
        new THREE.BoxGeometry(0.37, 0.22, 0.42),
        royalGold
      );
      greaveBoot.position.set(0, -0.53, 0.01);

      const bootSole = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.17, 0.55),
        royalGold
      );
      bootSole.position.set(0, -0.64, 0.07);

      const wingFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.22, 4),
        solarOrange
      );
      wingFin.position.set(sign * 0.2, -0.48, -0.05);
      wingFin.rotation.z = -sign * 0.3;

      legPivot.add(kneeSun, kneeGem, greaveBoot, bootSole, wingFin);
    }

    // 5. MANTO REAL DE FOGO VIVO 3D NAS COSTAS (GOLA ALTA + HALO + 5 CAUDAS)
    const mantleGroup = new THREE.Group();
    mantleGroup.position.set(0, 0.68, -0.22);

    const collarBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.16, 0.14),
      royalGold
    );
    collarBase.position.set(0, 0.02, -0.02);
    mantleGroup.add(collarBase);

    for (let c = -2; c <= 2; c++) {
      const collarFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.065, 0.26 - Math.abs(c) * 0.03, 4),
        c % 2 === 0 ? royalGold : solarOrange
      );
      collarFin.position.set(c * 0.16, 0.18, -0.05);
      collarFin.rotation.x = -0.28;
      collarFin.rotation.z = -c * 0.14;
      mantleGroup.add(collarFin);
    }

    const dorsalHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.032, 10, 28),
      royalGold
    );
    dorsalHalo.position.set(0, -0.12, -0.11);
    mantleGroup.add(dorsalHalo);

    const stripCount = 5;
    for (let i = 0; i < stripCount; i++) {
      const normX = i - 2;
      const stripPivot = new THREE.Group();
      stripPivot.position.set(normX * 0.19, -0.04, -0.04 - Math.abs(normX) * 0.015);
      const baseRotZ = normX * 0.08;
      stripPivot.rotation.z = baseRotZ;
      stripPivot.rotation.x = 0.16;

      const stripLen = 1.24 - Math.abs(normX) * 0.08;
      const stripW = i === 2 ? 0.24 : 0.19;

      const topSeg = new THREE.Mesh(
        new THREE.BoxGeometry(stripW, stripLen * 0.36, 0.035),
        i % 2 === 0 ? deepCrimson : royalGold
      );
      topSeg.position.set(0, -stripLen * 0.18, 0);
      topSeg.castShadow = true;

      const midSeg = new THREE.Mesh(
        new THREE.BoxGeometry(stripW * 0.9, stripLen * 0.38, 0.032),
        i % 2 === 0 ? solarRed : solarOrange
      );
      midSeg.position.set(0, -stripLen * 0.52, -0.01);

      const tipCone = new THREE.Mesh(
        new THREE.ConeGeometry(stripW * 0.52, stripLen * 0.42, 4),
        i === 2 ? whitePlasma : solarYellow
      );
      tipCone.position.set(0, -stripLen * 0.88, -0.015);
      tipCone.rotation.x = Math.PI;
      tipCone.rotation.y = Math.PI / 4;

      stripPivot.add(topSeg, midSeg, tipCone);
      mantleGroup.add(stripPivot);

      this.solarMantleStrips.push({
        pivot: stripPivot,
        tipCone,
        phase: i * 0.85,
        baseRotZ,
        normX
      });
    }

    this.solarMantleGroup = mantleGroup;
    this.upperBodyGroup.add(mantleGroup);
  },

  /**
   * Cria 28 partículas 3D de fogo ascendente orbitando o Solaris (Solar) ou Turbo Fantasma (Plasma Ciano)
   */
  _buildSolarAuraParticles(presetKey = 'solaris') {
    const fireColors =
      presetKey === 'turbo'
        ? [0xffffff, 0x67e8f9, 0x00f5d4, 0x06b6d4, 0x0284c7]
        : [0xffffff, 0xfef08a, 0xfacc15, 0xf97316, 0xef4444];
    const boxGeo = new THREE.BoxGeometry(0.13, 0.16, 0.13);
    const coneGeo = new THREE.ConeGeometry(0.085, 0.22, 4);

    for (let i = 0; i < 28; i++) {
      const color = fireColors[i % fireColors.length];
      const mat = getLegoMaterial(color, {
        emissive: color,
        emissiveIntensity: i % 5 === 0 ? 2.2 : 1.55
      });
      const mesh = new THREE.Mesh(i % 2 === 0 ? coneGeo : boxGeo, mat);
      this.visualRoot.add(mesh);
      this.flameParticles.push({
        mesh,
        angle: (i / 28) * Math.PI * 2,
        speed: 2.6 + (i % 4) * 0.85,
        radius: 0.46 + (i % 3) * 0.14,
        yOffset: (i / 28) * 2.1
      });
    }
  }
};
