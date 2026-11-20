import * as THREE from 'three';
import { getLegoMaterial } from '../../../materials/LegoMaterials.js';

/**
 * Constrói a Cabeça Simbionte: Tendões de Biomassa Negra + Mandíbula 3D de 8 Presas
 * + Língua Longa Serpenteante de 3 Segmentos Encadeados (`symbiote_crest`) do Vórtex (#8).
 */
export function attachVortexSymbioteHeadgear(minifig) {
  const symbioteBlack = getLegoMaterial(0x050608, { roughness: 0.08, clearcoat: 1.0 });
  const boneWhite = getLegoMaterial(0xf8fafc, { roughness: 0.16, clearcoat: 0.5 });
  const tongueMat = getLegoMaterial(0xdb2777, {
    emissive: 0x9333ea,
    emissiveIntensity: 1.45,
    roughness: 0.12,
    clearcoat: 0.95
  });

  // 1. Tendões de Biomassa Negra Líquida curvados para trás rente ao crânio
  for (let i = -2; i <= 2; i++) {
    const ridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.048, 0.34, 8),
      symbioteBlack
    );
    ridge.position.set(i * 0.095, 0.58 - Math.abs(i) * 0.03, -0.18 - Math.abs(i) * 0.03);
    ridge.rotation.x = -1.18;
    ridge.rotation.z = -i * 0.16;
    minifig.headGroup.add(ridge);
  }

  // 2. Mandíbula Inferior Simbionte 3D Aberta + 8 Presas 3D Brancas Pontiagudas
  const jawGroup = new THREE.Group();
  const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.26), symbioteBlack);
  lowerJaw.position.set(0, 0.09, 0.25);
  lowerJaw.rotation.x = 0.26;
  jawGroup.add(lowerJaw);

  for (const side of [-1, 1]) {
    const jawCheek = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.19, 0.22), symbioteBlack);
    jawCheek.position.set(side * 0.22, 0.16, 0.22);
    jawCheek.rotation.z = -side * 0.15;
    jawGroup.add(jawCheek);
  }

  const fangXPositions = [-0.16, -0.06, 0.06, 0.16];
  for (let f = 0; f < fangXPositions.length; f++) {
    const fx = fangXPositions[f];
    const isOuter = Math.abs(fx) > 0.1;
    const fangLen = isOuter ? 0.095 : 0.072;

    const upperFang = new THREE.Mesh(new THREE.ConeGeometry(0.02, fangLen, 5), boneWhite);
    upperFang.position.set(fx, 0.24, 0.355 - Math.abs(fx) * 0.12);
    upperFang.rotation.x = Math.PI - 0.12;
    jawGroup.add(upperFang);

    const lowerFang = new THREE.Mesh(new THREE.ConeGeometry(0.019, fangLen * 0.92, 5), boneWhite);
    lowerFang.position.set(fx, 0.13, 0.365 - Math.abs(fx) * 0.12);
    lowerFang.rotation.x = 0.18;
    jawGroup.add(lowerFang);
  }
  minifig.headGroup.add(jawGroup);

  // 3. LÍNGUA LONGA SERPENTEANTE 3D (3 Segmentos Encadeados com Juntas Esféricas)
  const tongueRoot = new THREE.Group();
  tongueRoot.position.set(0, 0.15, 0.31);
  tongueRoot.rotation.x = Math.PI * 0.48;
  minifig.headGroup.add(tongueRoot);

  const tSegConfigs = [
    { len: 0.17, rBot: 0.044, rTop: 0.036, baseX: 0.22, baseZ: 0.12 },
    { len: 0.16, rBot: 0.036, rTop: 0.024, baseX: -0.42, baseZ: 0.22 },
    { len: 0.15, rBot: 0.024, rTop: 0.008, baseX: -0.35, baseZ: -0.18 }
  ];

  let parentTongueNode = tongueRoot;
  for (let t = 0; t < tSegConfigs.length; t++) {
    const cfg = tSegConfigs[t];
    const segPivot = new THREE.Group();
    if (t > 0) {
      segPivot.position.set(0, tSegConfigs[t - 1].len, 0);
    }
    segPivot.rotation.x = cfg.baseX;
    segPivot.rotation.z = cfg.baseZ;

    const jointSphere = new THREE.Mesh(new THREE.SphereGeometry(cfg.rBot * 1.02, 8, 8), tongueMat);
    segPivot.add(jointSphere);

    const cylGeo = new THREE.CylinderGeometry(cfg.rTop, cfg.rBot, cfg.len, 8);
    cylGeo.translate(0, cfg.len * 0.5, 0);
    const cylMesh = new THREE.Mesh(cylGeo, tongueMat);
    segPivot.add(cylMesh);

    if (t === tSegConfigs.length - 1) {
      const tipCone = new THREE.Mesh(new THREE.ConeGeometry(cfg.rTop * 1.2, 0.09, 6), tongueMat);
      tipCone.position.set(0, cfg.len + 0.04, 0);
      segPivot.add(tipCone);
    }

    parentTongueNode.add(segPivot);
    parentTongueNode = segPivot;
    minifig.vortexTongueSegments.push({
      pivot: segPivot,
      baseX: cfg.baseX,
      baseZ: cfg.baseZ,
      index: t
    });
  }
}

export const vortexOutfitMethods = {
  /**
   * HERÓI #8: VÓRTEX (OP-08 — COLOSSO SIMBIONTE / ESTILO VENOM & KNULL):
   * 1) Peitoral e Abdômen Musculoso 3D + Emblema da Aranha Simbionte Branca em Alto-Relevo 3D
   * 2) Ombreiras Orgânicas Angulares com Espinhos de Osso Branco e Biomassa Negra
   * 3) Antebraços Afilados com Lâminas Serrilhadas de Biomassa + 4 Garras Longas e Curvas em Branco-Osso
   * 4) Quadril e Pernas Simbiontes Musculosas 3D com Joelheiras de Osso, Espinhos e 3 Garras nos Pés
   * 5) Costas: Núcleo Dorsal + 4 Tentáculos Orgânicos de 5 Segmentos Encadeados com Ponta de Foice
   */
  _attachVortexSymbioteRig(leftHandGroup, rightHandGroup) {
    const symbioteBlack = getLegoMaterial(0x050608, { roughness: 0.08, clearcoat: 1.0 });
    const darkBiomass = getLegoMaterial(0x11131a, { roughness: 0.14, clearcoat: 0.92 });
    const pureWhite = getLegoMaterial(0xffffff, {
      emissive: 0xf8fafc,
      emissiveIntensity: 0.35,
      roughness: 0.14,
      clearcoat: 0.6
    });
    const boneWhite = getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.5 });
    const deepVeinPurple = getLegoMaterial(0x7e22ce, {
      emissive: 0x581c87,
      emissiveIntensity: 1.35,
      roughness: 0.16
    });

    // 1. PEITORAL MUSCULOSO 3D + EMBLEMA DA ARANHA SIMBIONTE BRANCA EM ALTO-RELEVO
    const chestGroup = new THREE.Group();

    for (const side of [-1, 1]) {
      const pecMuscle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.065), symbioteBlack);
      pecMuscle.position.set(side * 0.18, 0.52, 0.215);
      pecMuscle.rotation.y = -side * 0.14;
      pecMuscle.rotation.z = -side * 0.06;
      chestGroup.add(pecMuscle);

      for (let row = 0; row < 2; row++) {
        const abMuscle = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.05), darkBiomass);
        abMuscle.position.set(side * 0.11, 0.31 - row * 0.13, 0.215);
        chestGroup.add(abMuscle);
      }
    }

    const build3DSpiderEmblem = (zPos, zSign) => {
      const emblem = new THREE.Group();
      const headSpike = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.14, 4), pureWhite);
      headSpike.position.set(0, 0.62, zPos);
      const thorax = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.18, 0.028), pureWhite);
      thorax.position.set(0, 0.48, zPos);
      thorax.rotation.z = Math.PI / 4;
      const abdomenBlade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 4), pureWhite);
      abdomenBlade.position.set(0, 0.26, zPos);
      abdomenBlade.rotation.x = Math.PI;
      emblem.add(headSpike, thorax, abdomenBlade);

      const legConfigs = [
        { y0: 0.55, x1: 0.17, y1: 0.65, x2: 0.34, y2: 0.72, rot1: -0.52, rot2: -0.35 },
        { y0: 0.49, x1: 0.19, y1: 0.54, x2: 0.38, y2: 0.58, rot1: -0.25, rot2: -0.18 },
        { y0: 0.42, x1: 0.19, y1: 0.39, x2: 0.37, y2: 0.28, rot1: 0.18, rot2: 0.55 },
        { y0: 0.35, x1: 0.16, y1: 0.24, x2: 0.31, y2: 0.11, rot1: 0.58, rot2: 0.75 }
      ];
      for (const lc of legConfigs) {
        for (const s of [-1, 1]) {
          const innerSeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.026), pureWhite);
          innerSeg.position.set(s * (lc.x1 * 0.52), (lc.y0 + lc.y1) * 0.5, zPos + zSign * 0.004);
          innerSeg.rotation.z = -s * lc.rot1;

          const outerSeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.024, 0.026), pureWhite);
          outerSeg.position.set(s * ((lc.x1 + lc.x2) * 0.5), (lc.y1 + lc.y2) * 0.5, zPos);
          outerSeg.rotation.z = -s * lc.rot2;
          outerSeg.rotation.y = s * zSign * 0.18;

          emblem.add(innerSeg, outerSeg);
        }
      }
      return emblem;
    };

    chestGroup.add(build3DSpiderEmblem(0.254, 1));
    this.upperBodyGroup.add(chestGroup);

    // 2. OMBREIRAS ORGÂNICAS ANGULARES
    for (const [armPivot, sign] of [[this.leftArmPivot, 1], [this.rightArmPivot, -1]]) {
      const bioPauldron = new THREE.Group();

      const upperArmor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.38), symbioteBlack);
      upperArmor.position.set(sign * 0.06, 0.07, 0);
      upperArmor.rotation.z = -sign * 0.28;

      const lowerArmor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.35), darkBiomass);
      lowerArmor.position.set(sign * 0.09, -0.03, 0);
      lowerArmor.rotation.z = -sign * 0.38;

      const whiteTendon = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.03, 0.12), pureWhite);
      whiteTendon.position.set(sign * 0.065, 0.11, 0.04);
      whiteTendon.rotation.z = -sign * 0.28;
      bioPauldron.add(upperArmor, lowerArmor, whiteTendon);

      for (let s = -1; s <= 1; s++) {
        const spikeLen = s === 0 ? 0.28 : 0.21;
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.042, spikeLen, 5),
          s === 0 ? boneWhite : symbioteBlack
        );
        spike.position.set(sign * (0.14 + Math.abs(s) * 0.03), 0.19, s * 0.1);
        spike.rotation.z = -sign * 0.58;
        spike.rotation.x = -0.32 + s * 0.18;
        bioPauldron.add(spike);
        this.vortexMonsterSpikes.push(spike);
      }

      armPivot.add(bioPauldron);
    }

    // 3. ANTEBRAÇOS COM LÂMINAS SIMBIONTES + 4 GARRAS PREDATÓRIAS CURVAS
    for (const [hand, sign] of [[leftHandGroup, 1], [rightHandGroup, -1]]) {
      const forearmBio = new THREE.Group();

      const bioSleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.142, 0.27, 12),
        symbioteBlack
      );
      bioSleeve.position.set(0, -0.14, 0);
      forearmBio.add(bioSleeve);

      for (let b = 0; b < 2; b++) {
        const finBlade = new THREE.Mesh(
          new THREE.ConeGeometry(0.045, 0.34 - b * 0.07, 4),
          b === 0 ? symbioteBlack : deepVeinPurple
        );
        finBlade.scale.set(0.45, 1.0, 1.35);
        finBlade.position.set(sign * 0.13, -0.06 - b * 0.1, -0.08);
        finBlade.rotation.x = -0.68;
        finBlade.rotation.z = -sign * 0.28;
        forearmBio.add(finBlade);
      }

      const handBack = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        symbioteBlack
      );
      handBack.scale.set(1.05, 0.75, 1.25);
      handBack.position.set(0, -0.31, 0.04);
      forearmBio.add(handBack);

      for (let c = 0; c < 4; c++) {
        const spreadX = (c - 1.5) * 0.046;
        const clawFinger = new THREE.Group();
        clawFinger.position.set(spreadX, -0.34, 0.11);

        const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.1, 6), symbioteBlack);
        knuckle.rotation.x = Math.PI * 0.42;
        knuckle.position.set(0, -0.02, 0.04);

        const boneTalon = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.24, 5), boneWhite);
        boneTalon.position.set(0, -0.08, 0.16);
        boneTalon.rotation.x = Math.PI * 0.66;
        clawFinger.add(knuckle, boneTalon);
        forearmBio.add(clawFinger);
      }

      const thumbTalon = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.19, 5), boneWhite);
      thumbTalon.position.set(-sign * 0.095, -0.34, 0.09);
      thumbTalon.rotation.x = Math.PI * 0.62;
      thumbTalon.rotation.z = sign * 0.35;
      forearmBio.add(thumbTalon);

      hand.add(forearmBio);
    }

    // 4. QUADRIL E PERNAS SIMBIONTES MUSCULOSAS 3D (JOELHEIRAS DE OSSO & GARRAS NOS PÉS)
    const waistTendonGroup = new THREE.Group();
    const beltCore = new THREE.Mesh(new THREE.BoxGeometry(0.81, 0.12, 0.45), symbioteBlack);
    beltCore.position.set(0, 0.07, 0);
    waistTendonGroup.add(beltCore);

    for (const side of [-1, 1]) {
      const beltVein = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.032, 0.46), pureWhite);
      beltVein.position.set(side * 0.22, 0.08, 0);
      beltVein.rotation.z = -side * 0.16;
      waistTendonGroup.add(beltVein);
    }
    this.hipGroup.add(waistTendonGroup);

    for (const [legPivot, sign] of [[this.leftLegPivot, 1], [this.rightLegPivot, -1]]) {
      const legBioGroup = new THREE.Group();

      const thighMuscle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.45), symbioteBlack);
      thighMuscle.position.set(0, -0.2, 0.01);
      const thighVein = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.26, 0.46), pureWhite);
      thighVein.position.set(sign * 0.12, -0.2, 0.01);
      thighVein.rotation.z = -sign * 0.14;

      const kneeArmor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.12), darkBiomass);
      kneeArmor.position.set(0, -0.38, 0.2);
      const kneeBoneSpike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 5), boneWhite);
      kneeBoneSpike.position.set(0, -0.36, 0.28);
      kneeBoneSpike.rotation.x = Math.PI * 0.36;

      const shinGreave = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.26, 0.45), symbioteBlack);
      shinGreave.position.set(0, -0.54, 0.01);
      const calfSpike = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.22, 5), symbioteBlack);
      calfSpike.position.set(0, -0.46, -0.26);
      calfSpike.rotation.x = -Math.PI * 0.68;

      for (let tc = -1; tc <= 1; tc++) {
        const footTalon = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 4), boneWhite);
        footTalon.position.set(tc * 0.095, -0.68, 0.28);
        footTalon.rotation.x = Math.PI * 0.52;
        legBioGroup.add(footTalon);
      }

      legBioGroup.add(thighMuscle, thighVein, kneeArmor, kneeBoneSpike, shinGreave, calfSpike);
      legPivot.add(legBioGroup);
    }

    // 5. COSTAS: NÚCLEO DORSAL + 4 TENTÁCULOS ORGÂNICOS DE 5 SEGMENTOS ENCADEADOS
    const dorsalCore = new THREE.Group();
    const backMass = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.58, 0.11), symbioteBlack);
    backMass.position.set(0, 0.42, -0.23);
    dorsalCore.add(backMass);
    dorsalCore.add(build3DSpiderEmblem(-0.29, -1));
    this.upperBodyGroup.add(dorsalCore);

    const tentacleConfigs = [
      { x: 0.22, y: 0.58, rotZ: -0.58, rotY: 0.34, side: 1, phase: 0.0 },
      { x: -0.22, y: 0.58, rotZ: 0.58, rotY: -0.34, side: -1, phase: 1.57 },
      { x: 0.25, y: 0.3, rotZ: -1.02, rotY: 0.44, side: 1, phase: 3.14 },
      { x: -0.25, y: 0.3, rotZ: 1.02, rotY: -0.44, side: -1, phase: 4.71 }
    ];

    const segSpec = [
      { len: 0.34, rBot: 0.088, rTop: 0.072, baseRotX: -0.28, baseRotZ: 0.16 },
      { len: 0.32, rBot: 0.072, rTop: 0.058, baseRotX: -0.22, baseRotZ: 0.18 },
      { len: 0.30, rBot: 0.058, rTop: 0.044, baseRotX: 0.24, baseRotZ: -0.22 },
      { len: 0.28, rBot: 0.044, rTop: 0.030, baseRotX: 0.28, baseRotZ: -0.18 },
      { len: 0.25, rBot: 0.030, rTop: 0.018, baseRotX: -0.20, baseRotZ: 0.14 }
    ];

    for (const cfg of tentacleConfigs) {
      const rootPivot = new THREE.Group();
      rootPivot.position.set(cfg.x, cfg.y, -0.25);
      rootPivot.rotation.z = cfg.rotZ;
      rootPivot.rotation.y = cfg.rotY;

      const chainedSegments = [];
      let parentNode = rootPivot;

      for (let s = 0; s < segSpec.length; s++) {
        const sp = segSpec[s];
        const segPivot = new THREE.Group();
        if (s > 0) {
          segPivot.position.set(0, segSpec[s - 1].len, 0);
        }
        const initRotX = sp.baseRotX;
        const initRotZ = sp.baseRotZ * cfg.side;
        segPivot.rotation.x = initRotX;
        segPivot.rotation.z = initRotZ;

        const ballJoint = new THREE.Mesh(
          new THREE.SphereGeometry(sp.rBot * 1.08, 10, 10),
          symbioteBlack
        );
        segPivot.add(ballJoint);

        if (s % 2 === 1) {
          const veinRing = new THREE.Mesh(
            new THREE.TorusGeometry(sp.rBot * 1.02, 0.012, 6, 12),
            deepVeinPurple
          );
          veinRing.rotation.x = Math.PI / 2;
          segPivot.add(veinRing);
        }

        const cylGeo = new THREE.CylinderGeometry(sp.rTop, sp.rBot, sp.len, 10);
        cylGeo.translate(0, sp.len * 0.5, 0);
        const cylMesh = new THREE.Mesh(cylGeo, symbioteBlack);
        cylMesh.castShadow = true;
        segPivot.add(cylMesh);

        if (s >= 1 && s <= 3) {
          const dorsalThorn = new THREE.Mesh(
            new THREE.ConeGeometry(sp.rTop * 0.65, 0.14, 4),
            s === 2 ? boneWhite : symbioteBlack
          );
          dorsalThorn.position.set(0, sp.len * 0.55, -sp.rBot * 0.85);
          dorsalThorn.rotation.x = -Math.PI * 0.65;
          segPivot.add(dorsalThorn);
        }

        if (s === segSpec.length - 1) {
          const scytheGroup = new THREE.Group();
          scytheGroup.position.set(0, sp.len, 0);

          const mainBlade = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.34, 4), symbioteBlack);
          mainBlade.scale.set(0.38, 1.0, 1.45);
          mainBlade.position.set(0, 0.15, 0.04);
          mainBlade.rotation.x = 0.38;

          const razorEdge = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.32, 4), boneWhite);
          razorEdge.scale.set(0.26, 1.0, 1.15);
          razorEdge.position.set(0, 0.15, 0.065);
          razorEdge.rotation.x = 0.42;

          const veinCore = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.22, 0.032), deepVeinPurple);
          veinCore.position.set(0, 0.11, 0.02);
          veinCore.rotation.x = 0.38;

          const backBarb = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.15, 4), boneWhite);
          backBarb.position.set(0, 0.04, -0.04);
          backBarb.rotation.x = -Math.PI * 0.68;

          scytheGroup.add(mainBlade, razorEdge, veinCore, backBarb);
          segPivot.add(scytheGroup);
        }

        parentNode.add(segPivot);
        parentNode = segPivot;
        chainedSegments.push({
          pivot: segPivot,
          baseRotX: initRotX,
          baseRotZ: initRotZ,
          segIndex: s
        });
      }

      this.upperBodyGroup.add(rootPivot);
      this.vortexTentacles.push({
        pivot: rootPivot,
        segments: chainedSegments,
        baseRotZ: cfg.rotZ,
        baseRotY: cfg.rotY,
        side: cfg.side,
        phase: cfg.phase
      });
    }
  }
};
