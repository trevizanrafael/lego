import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeFastBox } from '../../BuildingGenerator.js';

export function createMergedCarrierMesh(rawBoxes, mat, castShadow = true, receiveShadow = true) {
  if (!rawBoxes || rawBoxes.length === 0) return null;
  const geo = mergeBufferGeometries(rawBoxes);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

/**
 * 1. CASCO ESCULPIDO MULTICAMADAS (PROA AFILADA, RECORTES LATERAIS, QUILHA E ILUMINAÇÃO INFERIOR EM Y=410m)
 */
export function buildCarrierHullAndBelly(world, { cfg, hullStructureGroup, lod2, mats }) {
  const { hx, hy, hz, deckW, deckD, hullThickness } = cfg;

  // Colisores principais (preservando estritamente minY = 384, maxY = 410.4 para pouso sólido e testes!)
  world.addCollider(hx, hz, deckW, deckD, hy + 0.4, hy - hullThickness);
  world.addCollider(hx - 54, hz + 10, 28, 156, hy + 0.4, hy - 18.0);

  const hullDarkBoxes = [];
  const hullCharcoalBoxes = [];
  const keelBoxes = [];
  const silverBoxes = [];
  const yellowBoxes = [];

  // Convés principal superior (espessura 3.4m, topo em hy + 0.4 -> centro local y = -1.3)
  hullDarkBoxes.push(makeFastBox(deckW, 3.4, deckD, 0, -1.3, 0));
  // Proa afilada em 3 degraus (-Z)
  hullDarkBoxes.push(
    makeFastBox(82, 3.2, 14, 0, -1.4, -135),
    makeFastBox(56, 3.0, 12, 0, -1.5, -147),
    makeFastBox(28, 2.8, 8, 0, -1.6, -156)
  );
  // Popa escalonada (+Z)
  hullDarkBoxes.push(
    makeFastBox(86, 3.2, 12, 0, -1.4, 134),
    makeFastBox(62, 3.0, 10, 0, -1.5, 144)
  );
  // Extensão lateral angulada bombordo (Pista de pouso secundária)
  hullDarkBoxes.push(makeFastBox(28, 3.2, 156, -54, -1.5, 10));
  // Chanfros dianteiro e traseiro da pista angulada
  hullDarkBoxes.push(
    makeFastBox(18, 3.0, 18, -51, -1.6, -74),
    makeFastBox(18, 3.0, 18, -51, -1.6, 94)
  );

  // Casco intermediário blindado com recortes para elevadores e baías mecânicas
  hullCharcoalBoxes.push(
    makeFastBox(deckW - 14, 11.2, deckD - 28, 0, -8.6, 0),
    makeFastBox(70, 9.5, 18, 0, -8.2, -134),
    makeFastBox(40, 8.0, 12, 0, -7.8, -148),
    makeFastBox(72, 9.5, 14, 0, -8.2, 132)
  );

  // Sponsons laterais, baías de hangar recortadas e vigas em balanço sob a pista angulada
  for (const side of [-1, 1]) {
    // Passarela / sponson contínuo na borda do convés
    hullCharcoalBoxes.push(makeFastBox(4.2, 2.2, deckD - 32, side * (deckW * 0.5 + 1.2), -2.4, 0));
    // Módulos mecânicos laterais alternados (reentrâncias no casco em vez de parede lisa!)
    for (let rz = -108; rz <= 108; rz += 36) {
      hullDarkBoxes.push(makeFastBox(5.5, 7.6, 16.0, side * (deckW * 0.5 - 6.0), -8.2, rz));
      silverBoxes.push(makeFastBox(2.2, 10.6, 3.4, side * (deckW * 0.5 - 3.6), -8.6, rz + 18));
      yellowBoxes.push(makeFastBox(2.4, 0.8, 12.0, side * (deckW * 0.5 - 4.0), -4.1, rz));
    }
  }
  // Treliças de sustentação sob o convés angulado bombordo
  for (let tz = -58; tz <= 74; tz += 22) {
    silverBoxes.push(makeFastBox(16, 2.0, 2.2, -52, -4.6, tz));
    hullCharcoalBoxes.push(makeFastBox(4.0, 6.2, 3.2, -46, -6.4, tz));
  }

  // Quilha dupla inferior chanfrada (até Y = 384m -> local y = -26.0)
  keelBoxes.push(
    makeFastBox(deckW - 30, 6.0, deckD - 54, 0, -17.2, 0),
    makeFastBox(deckW - 50, 5.2, deckD - 86, 0, -22.8, 0),
    makeFastBox(42, 4.2, 118, 0, -23.8, -4)
  );

  // Baías de Hangar Laterais Iluminadas (no casco abaixo do convés)
  const hangarBayGlowLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, 34), mats.hangarGlowMat);
  hangarBayGlowLeft.position.set(-deckW * 0.5 + 6.4, -8.2, 22);
  const hangarBayGlowRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.2, 34), mats.hangarGlowMat);
  hangarBayGlowRight.position.set(deckW * 0.5 - 6.4, -8.2, 22);
  hullStructureGroup.add(hangarBayGlowLeft, hangarBayGlowRight);

  // Reator Repulsor Central sob a Quilha + Anel Blindado (Iluminação Inferior)
  const bellyCore = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14.5, 1.4, 24), mats.bellyGlowMat);
  bellyCore.position.set(0, -25.8, 0);
  const bellyRing = new THREE.Mesh(new THREE.TorusGeometry(16.2, 1.6, 10, 24), mats.armorSilverMat);
  bellyRing.rotation.x = Math.PI / 2;
  bellyRing.position.set(0, -25.4, 0);
  hullStructureGroup.add(bellyCore, bellyRing);

  // Propulsores Traseiros Principais na Popa (+Z)
  for (const rx of [-18, 0, 18]) {
    const thrusterRim = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 4.5, 16), mats.hullCharcoalMat);
    thrusterRim.rotation.x = Math.PI / 2;
    thrusterRim.position.set(rx, -7.8, 140);
    const thrusterGlow = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.8, 16), mats.bellyGlowMat);
    thrusterGlow.rotation.x = Math.PI / 2;
    thrusterGlow.position.set(rx, -7.8, 142.3);
    hullStructureGroup.add(thrusterRim, thrusterGlow);
  }

  const mHullDark = createMergedCarrierMesh(hullDarkBoxes, mats.hullDarkMat, true, true);
  const mHullChar = createMergedCarrierMesh(hullCharcoalBoxes, mats.hullCharcoalMat, true, true);
  const mKeel = createMergedCarrierMesh(keelBoxes, mats.keelNavyMat, false, true);
  const mSilver = createMergedCarrierMesh(silverBoxes, mats.armorSilverMat, false, true);
  const mYellow = createMergedCarrierMesh(yellowBoxes, mats.cautionYellowMat, false, true);
  for (const m of [mHullDark, mHullChar, mKeel, mSilver, mYellow]) {
    if (m) hullStructureGroup.add(m);
  }

  // Marcador luminoso inferior de longa distância (LOD 2)
  const lod2Beacon = new THREE.Mesh(new THREE.BoxGeometry(8, 2.4, 8), mats.bellyGlowMat);
  lod2Beacon.position.set(0, -26.2, 0);
  lod2.add(lod2Beacon);
}

/**
 * 4. QUATRO TURBINAS ROTORAS GIGANTES COM CARENAGEM DUPLA & EMPUXO PLASMA
 */
export function buildCarrierFourTurbines(world, { cfg, hullStructureGroup, mats }) {
  const { hx, hy, hz } = cfg;
  const turbineOffsets = [
    [-68, -86],
    [68, -86],
    [-68, 86],
    [68, 86]
  ];
  const turbHullMat = getLegoMaterial(LEGO_COLORS.charcoal, { metalness: 0.42, roughness: 0.24 });
  const turbRingMat = getLegoMaterial(LEGO_COLORS.darkGrey, { metalness: 0.38, roughness: 0.28 });

  for (const [txOff, tzOff] of turbineOffsets) {
    const turbGroup = new THREE.Group();
    turbGroup.position.set(txOff, -5.5, tzOff);

    // Braço estrutural duplo ligando a turbina ao casco
    const strutMain = new THREE.Mesh(new THREE.BoxGeometry(24, 9.2, 15.5), turbRingMat);
    strutMain.position.set(txOff > 0 ? -14 : 14, -1.0, 0);
    const strutPipe = new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, 4.4), mats.armorSilverMat);
    strutPipe.position.set(txOff > 0 ? -14 : 14, 3.8, 0);
    const hazardBand = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 16.2), mats.cautionYellowMat);
    hazardBand.position.set(txOff > 0 ? -12 : 12, -1.0, 0);
    turbGroup.add(strutMain, strutPipe, hazardBand);

    // Carenagem dupla (externa + anel superior + anel inferior)
    const outerShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(20.5, 20.5, 12.2, 28, 1, true),
      turbHullMat
    );
    const innerLiner = new THREE.Mesh(
      new THREE.CylinderGeometry(18.0, 18.0, 11.6, 24, 1, true),
      mats.armorSilverMat
    );
    const topArmorRing = new THREE.Mesh(new THREE.RingGeometry(16.8, 21.6, 28), turbRingMat);
    topArmorRing.rotation.x = -Math.PI / 2;
    topArmorRing.position.y = 6.1;
    const botArmorRing = new THREE.Mesh(new THREE.RingGeometry(16.8, 21.2, 28), turbRingMat);
    botArmorRing.rotation.x = Math.PI / 2;
    botArmorRing.position.y = -6.1;

    // Anel luminoso de repulsão de plasma
    const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(17.2, 17.2, 2.4, 28), mats.bellyGlowMat);
    coreGlow.position.y = -2.2;

    // Hélice superior de 4 pás + cubo blindado
    const rotorGroup = new THREE.Group();
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(34, 0.9, 3.4), turbHullMat);
      blade.rotation.y = (b * Math.PI) / 4;
      rotorGroup.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.4, 3.6, 16), mats.armorSilverMat);
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.2, 12), mats.cautionYellowMat);
    hubCap.position.y = 2.0;
    rotorGroup.add(hub, hubCap);
    rotorGroup.position.y = 2.4;

    turbGroup.add(outerShroud, innerLiner, topArmorRing, botArmorRing, coreGlow, rotorGroup);
    hullStructureGroup.add(turbGroup);

    world.rotatingElements.push({ mesh: rotorGroup, axis: 'y', speed: 7.5 });
    world.addCollider(hx + txOff, hz + tzOff, 36, 36, hy + 0.4, hy - 12.0);
  }
}
