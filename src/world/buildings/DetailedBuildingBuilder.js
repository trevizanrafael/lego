import * as THREE from 'three';
import { mergeBufferGeometries, makeTranslatedBox } from './GeometryMergeUtils.js';
import {
  BUILDING_STYLES,
  getFacadeMaterial,
  getFastStandardMaterial
} from './BuildingStylesAndFacades.js';
import { localToWorldXZ } from './LotGeometry2D.js';
import { IS_SCALED_WORLD, ws, fromWs } from '../core/WorldLayoutScale.js';

const _UNIT_CHAMFER_PILLAR = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.rotateY(Math.PI / 4);
  return g;
})();
const _UNIT_WT_BARREL = new THREE.CylinderGeometry(1.65, 1.65, 3.1, 10);
const _UNIT_WT_CONE = new THREE.ConeGeometry(1.88, 1.35, 10);
const _UNIT_SPIRE_BASE = (() => {
  const g = new THREE.ConeGeometry(1, 1, 4);
  g.rotateY(Math.PI / 4);
  return g;
})();
const _UNIT_SPIRE_MAST = new THREE.CylinderGeometry(0.14, 0.42, 1, 6);

function cloneScaledTemplate(templateGeo, sx, sy, sz, tx, ty, tz) {
  const g = templateGeo.clone();
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
  g.translate(tx, ty, tz);
  return g;
}

/**
 * Constrói e registra um Edifício Detalhado OTIMIZADO:
 * - Suporta rotação arbitrária `opts.rotY` (yaw em radianos) acompanhando ruas diagonais e curvas!
 * - Quando `world._buildingLodBatcher` está ativo (`3x`), consolida automaticamente a geometria em
 *   chunks espaciais `THREE.LOD` de 3 níveis (mantendo ~90-130 draw calls mesmo com 1.000+ prédios!).
 * - Registra colisores exatos (`AABB` quando alinhado aos eixos; `OBB` quando `rotY !== 0`).
 */
export function buildDetailedBuilding(world, x, z, w, h, d, styleKey = 'sapphire_glass', opts = {}) {
  const style = BUILDING_STYLES[styleKey] || BUILDING_STYLES.sapphire_glass;
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const defaultPad = IS_SCALED_WORLD && world?._urbanBlockGrid ? 0.02 : 0.28;
  const yBase = opts.yBase ?? (terrainY + defaultPad);
  const rotY = Number(opts.rotY) || 0;
  const seed = opts.seed ?? Math.abs(Math.round(x * 7 + z * 13 + h * 3));

  // 1. Corpo Principal com Silhueta Art-Deco / Brutalista Escalonada (Setbacks sem faces coplanares)
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

  // 2. Geometria Mesclada de Acabamento Arquitetônico Art-Deco / Brutalista
  const overUndergroundZone = IS_SCALED_WORLD
    ? (Math.abs(x) <= 115 && Math.abs(z - ws(-104)) <= 115) ||
      (Math.abs(x - ws(-77)) <= 115 && Math.abs(z - ws(20)) <= 115) ||
      (Math.abs(x - ws(-324)) <= 65 && Math.abs(z - ws(-168)) <= 65) ||
      (fromWs(x) >= -185 && fromWs(x) <= 115 && fromWs(z) >= -245 && fromWs(z) <= 90)
    : (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
      (x >= -375 && x <= -260 && z >= -235 && z <= -125);
  const skirtDepth = overUndergroundZone && terrainY < (IS_SCALED_WORLD ? 0.25 : 0.2) ? 0.3 : 8.5;
  const trimGeos = [];
  if (opts.groundFloor !== false && opts.foundation !== false) {
    trimGeos.push(makeTranslatedBox(w + 0.65, skirtDepth, d + 0.65, 0, -skirtDepth * 0.5 + 0.08, 0));
  }

  // Pilares de Quina Chanfrados em 45°
  const pSize = 1.48;
  const shaftH = useArtDecoSetbacks ? tier1H : h;
  const cornerOffsets = [
    [-w * 0.5 + 0.22, -d * 0.5 + 0.22],
    [w * 0.5 - 0.22, -d * 0.5 + 0.22],
    [-w * 0.5 + 0.22, d * 0.5 - 0.22],
    [w * 0.5 - 0.22, d * 0.5 - 0.22]
  ];
  for (const [cx, cz] of cornerOffsets) {
    trimGeos.push(cloneScaledTemplate(_UNIT_CHAMFER_PILLAR, pSize, shaftH, pSize, cx, shaftH * 0.5, cz));
  }

  if (w >= 18 && d >= 18) {
    trimGeos.push(
      makeTranslatedBox(0.75, shaftH, d + 0.72, 0, shaftH * 0.5, 0),
      makeTranslatedBox(w + 0.72, shaftH, 0.75, 0, shaftH * 0.5, 0)
    );
  }

  for (let cy = 22; cy < shaftH - 4; cy += 28) {
    trimGeos.push(makeTranslatedBox(w + 1.05, 0.95, d + 1.05, 0, cy, 0));
  }
  if (useArtDecoSetbacks) {
    trimGeos.push(
      makeTranslatedBox(w + 1.25, 1.15, d + 1.25, 0, tier1H, 0),
      makeTranslatedBox(w * 0.82 + 1.05, 0.95, d * 0.82 + 1.05, 0, tier2TopY, 0)
    );
  }

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

      const wtX = cw * 0.2;
      const wtZ = cd * 0.18;
      trimGeos.push(
        cloneScaledTemplate(_UNIT_WT_BARREL, 1, 1, 1, wtX, h + 3.4, wtZ),
        cloneScaledTemplate(_UNIT_WT_CONE, 1, 1, 1, wtX, h + 5.6, wtZ),
        makeTranslatedBox(0.32, 2.0, 0.32, wtX - 1.0, h + 1.0, wtZ - 1.0),
        makeTranslatedBox(0.32, 2.0, 0.32, wtX + 1.0, h + 1.0, wtZ + 1.0)
      );

      if (h >= 72 || opts.spire) {
        const spireH = opts.spireHeight || 18;
        const baseR = Math.min(2.4, cw * 0.18);
        trimGeos.push(
          cloneScaledTemplate(_UNIT_SPIRE_BASE, baseR, spireH * 0.38, baseR, 0, h + spireH * 0.19, 0),
          cloneScaledTemplate(_UNIT_SPIRE_MAST, 1, spireH, 1, 0, h + spireH * 0.5, 0)
        );
      }
    }
  }

  const mergedTrimGeo = mergeBufferGeometries(trimGeos);
  for (let i = 0; i < trimGeos.length; i++) trimGeos[i].dispose();

  // 3. Térreo Vivo na Altura da Rua
  let mergedGroundGeo = null;
  if ((opts.yBase === undefined || yBase < 24.0) && opts.groundFloor !== false) {
    const baseH = Math.min(6.8, h * 0.35);
    const vitW = Math.max(4, w * 0.58);
    const groundGeos = [
      makeTranslatedBox(w + 0.5, baseH, d + 0.5, 0, baseH * 0.5, 0),
      makeTranslatedBox(vitW + 2.0, 0.55, 1.9, 0, 5.1, -(d * 0.5 + 1.05)),
      makeTranslatedBox(vitW + 2.0, 0.55, 1.9, 0, 5.1, d * 0.5 + 1.05),
      makeTranslatedBox(vitW, 3.4, 0.4, 0, 2.5, -(d * 0.5 + 0.52)),
      makeTranslatedBox(vitW, 3.4, 0.4, 0, 2.5, d * 0.5 + 0.52)
    ];
    mergedGroundGeo = mergeBufferGeometries(groundGeos);
    for (let i = 0; i < groundGeos.length; i++) groundGeos[i].dispose();
  }

  if (opts.collide !== false) {
    registerDetailedBuildingColliders(
      world,
      x,
      z,
      w,
      h,
      d,
      yBase,
      rotY,
      skirtDepth,
      useArtDecoSetbacks,
      tier1H,
      tier2TopY,
      topCrownW,
      topCrownD,
      shaftH,
      pSize,
      cornerOffsets,
      opts
    );
  }

  if (opts.registerMap !== false) {
    world.mapBuildings.push({
      x,
      z,
      w,
      d,
      rotY,
      height: h,
      styleKey,
      color: opts.mapColor || style.mapColor,
      label: opts.label || null
    });
  }

  // Caminho de alta performance (60 FPS): Batching Espacial 3-Níveis THREE.LOD
  if (world._buildingLodBatcher && opts.batch !== false) {
    world._buildingLodBatcher.addDetailedBuildingEntry({
      cx: x,
      cz: z,
      yBase,
      rotY,
      styleKey,
      style,
      facadeMat,
      bodyGeo,
      trimGeo: mergedTrimGeo,
      groundGeo: mergedGroundGeo,
      w,
      h,
      d,
      useArtDecoSetbacks,
      tier1H,
      tier2TopY,
      topCrownW,
      topCrownD
    });
    return null;
  }

  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.rotation.y = rotY;
  group.userData = { isDetailedBuilding: true, styleKey, height: h, width: w, depth: d, rotY };

  const bodyMesh = new THREE.Mesh(bodyGeo, facadeMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  const trimMat = getFastStandardMaterial(style.pillarHex, 0.28, 0.18);
  const trimMesh = new THREE.Mesh(mergedTrimGeo, trimMat);
  trimMesh.castShadow = false;
  trimMesh.receiveShadow = true;
  group.add(trimMesh);

  if (mergedGroundGeo) {
    const groundMesh = new THREE.Mesh(
      mergedGroundGeo,
      getFastStandardMaterial(style.baseHex, 0.32, 0.1)
    );
    groundMesh.castShadow = false;
    groundMesh.receiveShadow = true;
    group.add(groundMesh);
  }

  world.scene.add(group);
  return group;
}

function registerDetailedBuildingColliders(
  world,
  x,
  z,
  w,
  h,
  d,
  yBase,
  rotY,
  skirtDepth,
  useArtDecoSetbacks,
  tier1H,
  tier2TopY,
  topCrownW,
  topCrownD,
  shaftH,
  pSize,
  cornerOffsets,
  opts
) {
  const minY0 = opts.foundation === false ? yBase : Math.min(yBase, Math.max(0, yBase - skirtDepth));
  const hasObb = typeof world.addObbCollider === 'function';
  const hasCylinder = typeof world.addCylinderCollider === 'function';
  const isRotated = Math.abs(rotY) > 1e-4 && hasObb;
  const cosY = isRotated ? Math.cos(rotY) : 1;
  const sinY = isRotated ? Math.sin(rotY) : 0;

  const addLocalBox = (lx, lz, bw, bd, maxY, minY, extraYaw = 0) => {
    const totalYaw = rotY + extraYaw;
    if (!isRotated && Math.abs(extraYaw) <= 1e-4) {
      world.addCollider(x + lx, z + lz, bw, bd, maxY, minY);
      return;
    }
    const wp = isRotated ? localToWorldXZ(x, z, lx, lz, cosY, sinY) : { x: x + lx, z: z + lz };
    if (hasObb) {
      world.addObbCollider(wp.x, wp.z, bw, bd, totalYaw, maxY, minY);
    } else {
      world.addCollider(wp.x, wp.z, bw, bd, maxY, minY);
    }
  };

  const addLocalCyl = (lx, lz, radius, maxY, minY) => {
    const wp = isRotated ? localToWorldXZ(x, z, lx, lz, cosY, sinY) : { x: x + lx, z: z + lz };
    if (hasCylinder) {
      world.addCylinderCollider(wp.x, wp.z, radius, maxY, minY);
    } else {
      addLocalBox(lx, lz, radius * 2, radius * 2, maxY, minY);
    }
  };

  // A) Corpo principal escalonado (Art-Deco 3 níveis: 1.0 -> 0.82 -> 0.64) ou fuste único
  if (useArtDecoSetbacks) {
    addLocalBox(0, 0, w, d, yBase + tier1H, minY0);
    addLocalBox(0, 0, w * 0.82, d * 0.82, yBase + tier2TopY, yBase + tier1H);
    addLocalBox(0, 0, topCrownW, topCrownD, yBase + h, yBase + tier2TopY);
  } else {
    addLocalBox(0, 0, w, d, yBase + h, minY0);
  }

  // B) Saia do térreo, marquises comerciais, pilares de quina 45° (OBB), aletas brutalistas e cornijas
  if (opts.groundFloor !== false) {
    const baseH = Math.min(6.8, h * 0.35);
    addLocalBox(0, 0, w + 0.5, d + 0.5, yBase + baseH, minY0);

    if (opts.yBase === undefined || yBase < 24.0) {
      const vitW = Math.max(4, w * 0.58);
      addLocalBox(0, -(d * 0.5 + 1.05), vitW + 2.0, 1.9, yBase + 5.38, yBase + 4.82);
      addLocalBox(0, d * 0.5 + 1.05, vitW + 2.0, 1.9, yBase + 5.38, yBase + 4.82);
    }
  }

  const compactBatchedColliders = Boolean(world._buildingLodBatcher && opts.batch !== false);

  if (!compactBatchedColliders) {
    for (const [cx, cz] of cornerOffsets) {
      addLocalBox(cx, cz, pSize, pSize, yBase + shaftH, yBase, Math.PI / 4);
    }

    if (w >= 18 && d >= 18) {
      addLocalBox(0, 0, 0.75, d + 0.72, yBase + shaftH, yBase);
      addLocalBox(0, 0, w + 0.72, 0.75, yBase + shaftH, yBase);
    }

    for (let cy = 22; cy < shaftH - 4; cy += 28) {
      addLocalBox(0, 0, w + 1.05, d + 1.05, yBase + cy + 0.48, yBase + cy - 0.48);
    }
  }
  if (useArtDecoSetbacks) {
    addLocalBox(0, 0, w + 1.25, d + 1.25, yBase + tier1H + 0.58, yBase + tier1H - 0.58);
    addLocalBox(0, 0, w * 0.82 + 1.05, d * 0.82 + 1.05, yBase + tier2TopY + 0.48, yBase + tier2TopY - 0.48);
  }

  // C) Muretas do topo, casas de máquinas/HVAC, caixa d'água cilíndrica e pináculo gótico-industrial
  if (opts.rooftop !== false) {
    const parapetH = 1.55;
    const parapetThick = 1.15;
    const cw = topCrownW;
    const cd = topCrownD;
    const roofY = yBase + h;
    const innerSpanZ = Math.max(0.8, cd - parapetThick * 2);

    addLocalBox(0, -cd * 0.5 + parapetThick * 0.5, cw, parapetThick, roofY + parapetH, roofY);
    addLocalBox(0, cd * 0.5 - parapetThick * 0.5, cw, parapetThick, roofY + parapetH, roofY);
    addLocalBox(-cw * 0.5 + parapetThick * 0.5, 0, parapetThick, innerSpanZ, roofY + parapetH, roofY);
    addLocalBox(cw * 0.5 - parapetThick * 0.5, 0, parapetThick, innerSpanZ, roofY + parapetH, roofY);

    if (w >= 14 && d >= 14) {
      addLocalBox(
        -cw * 0.2,
        -cd * 0.18,
        Math.min(4.2, cw * 0.34),
        Math.min(4.6, cd * 0.36),
        roofY + 3.4,
        roofY
      );
      addLocalBox(
        cw * 0.18,
        -cd * 0.2,
        Math.min(3.6, cw * 0.3),
        Math.min(3.0, cd * 0.28),
        roofY + 1.9,
        roofY
      );

      const wtX = cw * 0.2;
      const wtZ = cd * 0.18;
      addLocalCyl(wtX, wtZ, 1.72, roofY + 6.2, roofY);

      if (h >= 72 || opts.spire) {
        const spireH = opts.spireHeight || 18;
        const spireBaseTopY = roofY + spireH * 0.38;
        const spireBaseR = Math.min(1.65, cw * 0.13);
        addLocalCyl(0, 0, spireBaseR, spireBaseTopY, roofY);
        addLocalCyl(0, 0, 0.38, roofY + spireH, spireBaseTopY);
      }
    }
  }
}
