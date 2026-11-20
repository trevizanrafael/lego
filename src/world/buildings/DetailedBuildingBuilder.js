import * as THREE from 'three';
import { mergeBufferGeometries, makeTranslatedBox } from './GeometryMergeUtils.js';
import {
  BUILDING_STYLES,
  getFacadeMaterial,
  getFastStandardMaterial
} from './BuildingStylesAndFacades.js';

/**
 * Constrói e registra um Edifício Detalhado OTIMIZADO (Apenas 2 a 3 Draw Calls por edifício em vez de 31!):
 * - Todas as colunas de quina, cornijas horizontais, muretas do topo, casinha de acesso e HVAC são fundidas em 1 única malha (`trimMesh`)!
 */
export function buildDetailedBuilding(world, x, z, w, h, d, styleKey = 'sapphire_glass', opts = {}) {
  const style = BUILDING_STYLES[styleKey] || BUILDING_STYLES.sapphire_glass;
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = opts.yBase ?? (terrainY + 0.28);
  const seed = opts.seed ?? Math.abs(Math.round(x * 7 + z * 13 + h * 3));
  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.userData = { isDetailedBuilding: true, styleKey, height: h, width: w, depth: d };

  // 1. Corpo Principal com Silhueta Art-Deco / Brutalista Escalonada (Setbacks sem faces coplanares — 1 único Draw Call!)
  const facadeMat = getFacadeMaterial(styleKey, seed);
  const useArtDecoSetbacks =
    opts.rooftop !== false && h >= 44 && w >= 15 && d >= 15 && (seed % 4 !== 3);
  let bodyGeo;
  let topCrownW = w;
  let topCrownD = d;
  let tier1H = h;
  let tier2TopY = h;

  if (useArtDecoSetbacks) {
    tier1H = Math.round(h * 0.74 * 10) / 10;
    const tier2H = Math.round(h * 0.16 * 10) / 10;
    const tier3H = Math.max(2.5, h - tier1H - tier2H);
    tier2TopY = tier1H + tier2H;
    const w2 = w * 0.82;
    const d2 = d * 0.82;
    topCrownW = w * 0.64;
    topCrownD = d * 0.64;

    const g1 = makeTranslatedBox(w, tier1H, d, 0, tier1H * 0.5, 0);
    const g2 = makeTranslatedBox(w2, tier2H, d2, 0, tier1H + tier2H * 0.5, 0);
    const g3 = makeTranslatedBox(topCrownW, tier3H, topCrownD, 0, tier2TopY + tier3H * 0.5, 0);
    bodyGeo = mergeBufferGeometries([g1, g2, g3]);
    g1.dispose();
    g2.dispose();
    g3.dispose();
  } else {
    bodyGeo = makeTranslatedBox(w, h, d, 0, h * 0.5, 0);
  }

  const bodyMesh = new THREE.Mesh(bodyGeo, facadeMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 2. Geometria Mesclada de Acabamento Arquitetônico Art-Deco / Brutalista (Contrafortes chanfrados 45°, cornijas e reservatório cônico!)
  const overUndergroundZone =
    (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
    (x >= -375 && x <= -260 && z >= -235 && z <= -125);
  const skirtDepth = overUndergroundZone && terrainY < 0.2 ? 0.3 : 8.5;
  const trimGeos = [];
  if (opts.groundFloor !== false && opts.foundation !== false) {
    trimGeos.push(makeTranslatedBox(w + 0.65, skirtDepth, d + 0.65, 0, -skirtDepth * 0.5 + 0.08, 0));
  }

  // Pilares de Quina Chanfrados em 45° (quebra a quina 90° de caixa de sapato!)
  const pSize = 1.48;
  const shaftH = useArtDecoSetbacks ? tier1H : h;
  const cornerOffsets = [
    [-w * 0.5 + 0.22, -d * 0.5 + 0.22],
    [w * 0.5 - 0.22, -d * 0.5 + 0.22],
    [-w * 0.5 + 0.22, d * 0.5 - 0.22],
    [w * 0.5 - 0.22, d * 0.5 - 0.22]
  ];
  for (const [cx, cz] of cornerOffsets) {
    const chamferCol = new THREE.BoxGeometry(pSize, shaftH, pSize);
    chamferCol.rotateY(Math.PI / 4);
    chamferCol.translate(cx, shaftH * 0.5, cz);
    trimGeos.push(chamferCol);
  }

  // Aletas Verticais Brutalistas nas Fachadas (Fins)
  if (w >= 18 && d >= 18) {
    trimGeos.push(
      makeTranslatedBox(0.75, shaftH, d + 0.72, 0, shaftH * 0.5, 0),
      makeTranslatedBox(w + 0.72, shaftH, 0.75, 0, shaftH * 0.5, 0)
    );
  }

  // Cornijas horizontais pesadas no fuste principal + cornijas nos degraus Art-Deco
  for (let cy = 22; cy < shaftH - 4; cy += 28) {
    trimGeos.push(makeTranslatedBox(w + 1.05, 0.95, d + 1.05, 0, cy, 0));
  }
  if (useArtDecoSetbacks) {
    trimGeos.push(
      makeTranslatedBox(w + 1.25, 1.15, d + 1.25, 0, tier1H, 0),
      makeTranslatedBox(w * 0.82 + 1.05, 0.95, d * 0.82 + 1.05, 0, tier2TopY, 0)
    );
  }

  // Topo do Prédio (Mureta na coroa + Casa de Máquinas + Caixa d'Água Cônica estilo Gotham/NY + Pináculo Gótico-Industrial!)
  if (opts.rooftop !== false) {
    const parapetH = 1.55;
    const parapetThick = 1.15;
    const cw = topCrownW;
    const cd = topCrownD;
    trimGeos.push(
      makeTranslatedBox(cw, parapetH, parapetThick, 0, h + parapetH * 0.5, -cd * 0.5 + parapetThick * 0.5),
      makeTranslatedBox(cw, parapetH, parapetThick, 0, h + parapetH * 0.5, cd * 0.5 - parapetThick * 0.5),
      makeTranslatedBox(parapetThick, parapetH, Math.max(0.8, cd - parapetThick * 2), -cw * 0.5 + parapetThick * 0.5, h + parapetH * 0.5, 0),
      makeTranslatedBox(parapetThick, parapetH, Math.max(0.8, cd - parapetThick * 2), cw * 0.5 - parapetThick * 0.5, h + parapetH * 0.5, 0)
    );

    if (w >= 14 && d >= 14) {
      trimGeos.push(
        makeTranslatedBox(Math.min(4.2, cw * 0.34), 3.4, Math.min(4.6, cd * 0.36), -cw * 0.2, h + 1.7, -cd * 0.18),
        makeTranslatedBox(Math.min(3.6, cw * 0.3), 1.9, Math.min(3.0, cd * 0.28), cw * 0.18, h + 0.95, -cd * 0.2)
      );

      // Reservatório Cilíndrico com Teto Cônico (Ícone Clássico de Gotham / Nova York!)
      const wtX = cw * 0.2;
      const wtZ = cd * 0.18;
      const wtBarrel = new THREE.CylinderGeometry(1.65, 1.65, 3.1, 10);
      wtBarrel.translate(wtX, h + 3.4, wtZ);
      const wtCone = new THREE.ConeGeometry(1.88, 1.35, 10);
      wtCone.translate(wtX, h + 5.6, wtZ);
      trimGeos.push(
        wtBarrel,
        wtCone,
        makeTranslatedBox(0.32, 2.0, 0.32, wtX - 1.0, h + 1.0, wtZ - 1.0),
        makeTranslatedBox(0.32, 2.0, 0.32, wtX + 1.0, h + 1.0, wtZ + 1.0)
      );

      if (h >= 72 || opts.spire) {
        const spireH = opts.spireHeight || 18;
        const spireBase = new THREE.ConeGeometry(Math.min(2.4, cw * 0.18), spireH * 0.38, 4);
        spireBase.rotateY(Math.PI / 4);
        spireBase.translate(0, h + spireH * 0.19, 0);
        const spireMast = new THREE.CylinderGeometry(0.14, 0.42, spireH, 6);
        spireMast.translate(0, h + spireH * 0.5, 0);
        trimGeos.push(spireBase, spireMast);
      }
    }
  }

  const mergedTrimGeo = mergeBufferGeometries(trimGeos);
  for (let i = 0; i < trimGeos.length; i++) trimGeos[i].dispose();
  const trimMat = getFastStandardMaterial(style.pillarHex, 0.28, 0.18);
  const trimMesh = new THREE.Mesh(mergedTrimGeo, trimMat);
  trimMesh.castShadow = false;
  trimMesh.receiveShadow = true;
  group.add(trimMesh);

  // 3. Térreo Vivo na Altura da Rua (Base + Marquises mescladas em 1 único Mesh!)
  if ((opts.yBase === undefined || yBase < 1.5) && opts.groundFloor !== false) {
    const baseH = Math.min(6.8, h * 0.35);
    const vitW = Math.max(4, w * 0.58);
    const groundGeos = [
      makeTranslatedBox(w + 0.5, baseH, d + 0.5, 0, baseH * 0.5, 0),
      makeTranslatedBox(vitW + 2.0, 0.55, 1.9, 0, 5.1, -(d * 0.5 + 1.05)),
      makeTranslatedBox(vitW + 2.0, 0.55, 1.9, 0, 5.1, d * 0.5 + 1.05),
      makeTranslatedBox(vitW, 3.4, 0.4, 0, 2.5, -(d * 0.5 + 0.52)),
      makeTranslatedBox(vitW, 3.4, 0.4, 0, 2.5, d * 0.5 + 0.52)
    ];
    const mergedGroundGeo = mergeBufferGeometries(groundGeos);
    for (let i = 0; i < groundGeos.length; i++) groundGeos[i].dispose();
    const groundMesh = new THREE.Mesh(
      mergedGroundGeo,
      getFastStandardMaterial(style.baseHex, 0.32, 0.1)
    );
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;
    group.add(groundMesh);
  }

  world.scene.add(group);

  if (opts.collide !== false) {
    world.addCollider(x, z, w, d, yBase + h, Math.max(0, yBase - skirtDepth));
  }

  if (opts.registerMap !== false) {
    world.mapBuildings.push({
      x,
      z,
      w,
      d,
      height: h,
      styleKey,
      color: opts.mapColor || style.mapColor,
      label: opts.label || null
    });
  }

  return group;
}
