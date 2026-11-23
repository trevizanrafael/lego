/**
 * BlockLotFiller.js
 * Gerador Denso de Lotes Urbanos Subdivididos para o Centro & Transição Norte (`WORLD_SCALE = 3`):
 *  - Skyline gradual com duplo epicentro (Super Banco + Torre dos Heróis) + crista Times Square/Broadway
 *  - Subdivisão real de parcelas (`LotSubdivision.js`) com âncoras de esquina (`36–56 m`), fitas históricas
 *    estreitas de empena cega (`13–22 m`, `15–28 m` de altura) ao lado de arranha-céus de `40–55` andares (`140–218 m`)
 *  - Corredores monumentais de visada livre e esplanadas cívicas (Super Banco Central & Torre dos Heróis)
 */

import * as THREE from 'three';
import { BUILDING_STYLES, makeFastBox } from '../BuildingGenerator.js';
import { buildDetailedBuilding } from './DetailedBuildingBuilder.js';
import { buildFlatironWedgeBuilding } from './FlatironWedgeBuilder.js';
import {
  localToWorldXZ, createObb2D, obbInsideBounds2D, obbIntersectsObb2D,
  obbIntersectsRect2D, obbClearOfSegment2D, obbClearOfCircle2D
} from './LotGeometry2D.js';
import {
  lotHash01, getMonumentalVistaKeepouts, subdivideEdgeIntoParcels,
  subdivideSegmentCorridorLots, generateCourtyardBackLots, classifyDowntownArchitecturalArchetype
} from './LotSubdivision.js';
import { queryOrganicFeaturesInBounds } from '../terrain/OrganicDowntownNetworkSpec.js';
import {
  isPointInCartesianGridAsphalt, getOrganicRoadElevationStateAt
} from '../terrain/OrganicRoadSpatialIndex.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { ROAD } from '../core/WorldLayoutScale.js';

const NEON_PALETTE = Object.freeze([0x00f0ff, 0xfacc15, 0xef4444, 0xec4899, 0x22c55e, 0xa855f7]);
const TRANSITION_STYLES = Object.freeze(['ny_brick', 'classic_sandstone', 'white_concrete', 'silver_corporate', 'emerald_steel']);
const TIMES_SQ_STYLES = Object.freeze(['black_granite_gold', 'sapphire_glass', 'cyan_modern', 'silver_corporate']);
const CORE_STYLES = Object.freeze(['black_granite_gold', 'sapphire_glass', 'silver_corporate', 'emerald_steel', 'cyan_modern', 'white_concrete']);
const BORDER_STYLES = Object.freeze(['classic_sandstone', 'ny_brick', 'white_concrete', 'emerald_steel', 'silver_corporate', 'sapphire_glass']);

function pickContextualStyle(wx, wz, isNorthTransition, seed) {
  const idx = Math.floor(lotHash01(seed, Math.round(wx * 3 + wz * 5)) * 997);
  if (isNorthTransition || wz < -1146) return TRANSITION_STYLES[idx % TRANSITION_STYLES.length];
  if (wz >= -355 && wz <= 15 && Math.abs(wx) < 980) return TIMES_SQ_STYLES[idx % TIMES_SQ_STYLES.length];
  if (Math.abs(wx) > 1160 || wz < -960) return BORDER_STYLES[idx % BORDER_STYLES.length];
  return CORE_STYLES[idx % CORE_STYLES.length];
}

// Evita alinhar sub-colisores de topo (minY > 35) exatamente na fatia Z = -556.0 da verga do cofre do Super Banco
export function nudgeClearOfBankVaultSliceZ(cz, w, d, rotY, scales = [0.5, 0.64, 0.68, 0.82, 1.0]) {
  const VAULT_Z = -556.0;
  if (Math.abs(cz - VAULT_Z) > 34) return cz;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const pts = [[0, 0], [0, d * 0.12], [0, -0.264 * d], [0, 0.248 * d], [0, -0.205 * d], [0, 0.192 * d]];
  for (const sc of scales) {
    const cw = w * sc;
    const cd = d * sc;
    pts.push(
      [0, -cd * 0.5 + 0.575], [0, cd * 0.5 - 0.575], [-cw * 0.5 + 0.575, 0], [cw * 0.5 - 0.575, 0],
      [-cw * 0.2, -cd * 0.18], [cw * 0.18, -cd * 0.2], [cw * 0.2, cd * 0.18]
    );
  }
  for (let step = 0; step <= 16; step++) {
    const dz = step === 0 ? 0 : (step & 1 ? 1 : -1) * Math.ceil(step * 0.5) * 1.45;
    const testZ = cz + dz;
    if (pts.every(([lx, lz]) => Math.abs(testZ - lx * sinY + lz * cosY - VAULT_Z) >= 0.85)) return testZ;
  }
  return cz + 12.5;
}

export function computeDowntownSkylineHeight(wx, wz, seed = 1) {
  const coordSalt = Math.round(wx * 3 - wz * 7);
  if (wz < -1146) {
    const tSouth = THREE.MathUtils.clamp((wz + 1536) / 390, 0, 1);
    const edgeFade = 1 - 0.13 * THREE.MathUtils.clamp((Math.abs(wx) - 920) / 640, 0, 1);
    return Math.round(THREE.MathUtils.clamp((33.0 + tSouth * 18.5) * edgeFade * (0.86 + lotHash01(seed, coordSalt) * 0.24), 30, 56) * 10) / 10;
  }

  const dBank = Math.hypot(wx, (wz + 525) * 1.06);
  const gBank = Math.exp(-(dBank * dBank) / (2 * 405 * 405));
  const dHero = Math.hypot(wx + 966, (wz + 516) * 1.06);
  const gHero = Math.exp(-(dHero * dHero) / (2 * 355 * 355));
  const dTs = Math.hypot(Math.max(0, Math.abs(wx) - 145) * 0.85, (wz + 175) * 1.12);
  const gTs = Math.exp(-(dTs * dTs) / (2 * 340 * 340));
  const dMid = Math.hypot((wx + 480) * 0.76, wz + 485);
  const gMid = Math.exp(-(dMid * dMid) / (2 * 430 * 430));

  const outerX = THREE.MathUtils.clamp((Math.abs(wx) - 960) / 590, 0, 1);
  const outerZ = wz < -760
    ? THREE.MathUtils.clamp((-760 - wz) / 390, 0, 1)
    : THREE.MathUtils.clamp((wz - 180) / 260, 0, 1) * 0.45;
  const outerT = THREE.MathUtils.clamp(Math.max(outerX, outerZ, (outerX + outerZ) * 0.65), 0, 1);
  const envelope = Math.max(86 - 12 * outerT, 74 + 118 * gBank, 74 + 108 * gHero, 74 + 80 * gTs, 74 + 58 * gMid);
  return Math.round(THREE.MathUtils.clamp(envelope * (0.78 + lotHash01(seed, coordSalt) * 0.36), 62, 214) * 10) / 10;
}

export function canPlaceBuildingObb(world, obb, localFeatures, blockInnerBounds, placedObbs, groundRoadsOverride = null, minObbGap = 3.6) {
  if (!obbInsideBounds2D(obb, blockInnerBounds.minX, blockInnerBounds.maxX, blockInnerBounds.minZ, blockInnerBounds.maxZ, 0)) {
    return false;
  }
  for (let i = 0; i < placedObbs.length; i++) {
    const prev = placedObbs[i];
    if (obbIntersectsObb2D(obb, prev, Math.max(minObbGap, prev.minGap ?? 1.5))) return false;
  }
  const keepouts = localFeatures?.keepouts || [];
  for (let i = 0; i < keepouts.length; i++) {
    const k = keepouts[i];
    if (
      obb.maxX + 1.5 > k.minX && obb.minX - 1.5 < k.maxX &&
      obb.maxZ + 1.5 > k.minZ && obb.minZ - 1.5 < k.maxZ &&
      obbIntersectsRect2D(obb, k.minX, k.maxX, k.minZ, k.maxZ, 1.5)
    ) return false;
  }
  const roundabouts = localFeatures?.roundabouts || [];
  for (let i = 0; i < roundabouts.length; i++) {
    const r = roundabouts[i];
    if (!obbClearOfCircle2D(obb, r.cx, r.cz, r.outerR + r.sidewalk + 2.2)) return false;
  }
  const segments = localFeatures?.segments || [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (!obbClearOfSegment2D(obb, s.x1, s.z1, s.x2, s.z2, s.halfWidth + s.sidewalk + 2.0)) return false;
  }

  const roads = groundRoadsOverride || world?.mapRoads || [];
  const uMinX = obb.cx - obb.w * 0.5;
  const uMaxX = obb.cx + obb.w * 0.5;
  const uMinZ = obb.cz - obb.d * 0.5;
  const uMaxZ = obb.cz + obb.d * 0.5;
  for (let i = 0; i < roads.length; i++) {
    const rd = roads[i];
    if (rd.isElevated || rd.isBridge) continue;
    const rMinX = rd.x - rd.w * 0.5;
    const rMaxX = rd.x + rd.w * 0.5;
    const rMinZ = rd.z - rd.d * 0.5;
    const rMaxZ = rd.z + rd.d * 0.5;
    if (uMinX < rMaxX + 0.5 && uMaxX > rMinX - 0.5 && uMinZ < rMaxZ + 0.5 && uMaxZ > rMinZ - 0.5) return false;
    if (
      obb.maxX + 2.0 > rMinX && obb.minX - 2.0 < rMaxX &&
      obb.maxZ + 2.0 > rMinZ && obb.minZ - 2.0 < rMaxZ &&
      obbIntersectsRect2D(obb, rMinX, rMaxX, rMinZ, rMaxZ, 2.0)
    ) return false;
  }
  return true;
}

function addFacadeNeonScreens(world, cx, cz, bldW, bldH, bldD, rotY, targetX, targetZ, seed) {
  const batcher = world?._buildingLodBatcher;
  if (!batcher || bldH < 34 || bldW < 18) return;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const faceSign = (targetX - cx) * sinY + (targetZ - cz) * cosY >= 0 ? 1 : -1;
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : 0;
  const screenW = Math.min(26, bldW * 0.68);
  const wp = localToWorldXZ(cx, cz, 0, faceSign * (bldD * 0.5 + 0.34), cosY, sinY);
  batcher.addNeonScreen(screenW, bldH >= 90 ? 10.5 : 7.8, 0.52, wp.x, terrainY + 14.5, wp.z, rotY, NEON_PALETTE[Math.abs(seed) % NEON_PALETTE.length]);
  if (bldH >= 105 && (seed & 1) === 0) {
    batcher.addNeonScreen(screenW * 0.78, 8.6, 0.52, wp.x, terrainY + 28.0, wp.z, rotY, NEON_PALETTE[(Math.abs(seed) + 2) % NEON_PALETTE.length]);
  }
}

function buildEmpireStatePodiumTower(world, cx, cz, w, mainH, d, rotY, styleKey, seed) {
  const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : 0;
  const y0 = terrainY + (world?._urbanBlockGrid ? 0.02 : 0.28);
  const h0 = 22;
  const h1Top = Math.max(h0 + 18, Math.round(mainH * 0.62));
  const h2Top = Math.max(h1Top + 14, Math.round(mainH * 0.84));
  const finalH = Math.max(h2Top + 12, Math.round(mainH));
  const sBase = Math.abs(seed) * 4 + 3;
  const crownStyle = styleKey === 'black_granite_gold' ? 'black_granite_gold' : 'silver_corporate';

  buildDetailedBuilding(world, cx, cz, w, h0, d, styleKey, {
    yBase: y0, rotY, archetype: 'historic_lowrise', rooftop: true, registerMap: false, seed: sBase
  });
  buildDetailedBuilding(world, cx, cz, Math.round(w * 0.74), h1Top - h0, Math.round(d * 0.74), styleKey, {
    yBase: y0 + h0, rotY, groundFloor: false, foundation: false, rooftop: true, registerMap: false, seed: sBase + 4
  });
  buildDetailedBuilding(world, cx, cz, Math.round(w * 0.52), h2Top - h1Top, Math.round(d * 0.52), crownStyle, {
    yBase: y0 + h1Top, rotY, groundFloor: false, foundation: false, rooftop: true, registerMap: false, seed: sBase + 8
  });
  buildDetailedBuilding(world, cx, cz, Math.max(15, Math.round(w * 0.36)), finalH - h2Top, Math.max(15, Math.round(d * 0.36)), crownStyle, {
    yBase: y0 + h2Top, rotY, groundFloor: false, foundation: false, rooftop: true, spire: true, spireHeight: 26, registerMap: false, seed: sBase + 12
  });

  if (Array.isArray(world.mapBuildings)) {
    const st = BUILDING_STYLES[styleKey] || BUILDING_STYLES.black_granite_gold;
    world.mapBuildings.push({ x: cx, z: cz, w, d, rotY, height: finalH, styleKey, archetype: 'empire_podium', color: st.mapColor, label: null });
  }
}

function pushSidewalkColoredBox(world, w, h, d, x, y, z, hex) {
  if (world?._sidewalkGeosByColor instanceof Map) {
    let b = world._sidewalkGeosByColor.get(hex);
    if (!b) { b = []; world._sidewalkGeosByColor.set(hex, b); }
    b.push(makeFastBox(w, h, d, x, y, z));
  } else if (world?.scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45 }));
    m.position.set(x, y, z);
    world.scene.add(m);
  }
}

function buildUrbanPocketPlaza(world, px, pz, addFountain, seed) {
  if (getMetroCutoutFloorY(px, pz) !== null) return;
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0;
  for (const [dx, dz, sc] of [[-6.6, -6.2, 1.06], [6.6, -6.2, 1.16], [-6.4, 6.4, 1.12], [6.4, 6.4, 1.05]]) {
    const tx = px + dx;
    const tz = pz + dz;
    if (getMetroCutoutFloorY(tx, tz) === null) {
      const ty = world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, tz) : baseY;
      world._addLegoTree?.(tx, ty + 0.04, tz, sc);
    }
  }
  if (!addFountain) return;
  pushSidewalkColoredBox(world, 7.6, 0.85, 7.6, px, baseY + 0.44, pz, 0x64748b);
  pushSidewalkColoredBox(world, 5.8, 0.92, 5.8, px, baseY + 0.48, pz, 0x0284c7);
  pushSidewalkColoredBox(world, 1.9, 4.1, 1.9, px, baseY + 2.1, pz, (seed & 1) === 0 ? 0xd97706 : 0x94a3b8);
  world.addCollider?.(px, pz, 7.6, 7.6, baseY + 4.2, baseY);
}

const _CIVIC_ORG_SCRATCH = {};

function isCivicLandscapeSafeRect(world, minX, maxX, minZ, maxZ) {
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  for (const [px, pz] of [[cx, cz], [minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]]) {
    if (getMetroCutoutFloorY(px, pz) !== null) return false;
    if (isPointInCartesianGridAsphalt(px, pz, 1.5)) return false;
    const org = getOrganicRoadElevationStateAt(world, px, pz, _CIVIC_ORG_SCRATCH);
    if (org.inAsphalt || org.minSignedDist <= 1.5) return false;
  }
  const roads = world?.mapRoads || [];
  for (let i = 0; i < roads.length; i++) {
    const rd = roads[i];
    if (rd.isElevated || rd.isBridge) continue;
    if (
      maxX + 1.0 > rd.x - rd.w * 0.5 && minX - 1.0 < rd.x + rd.w * 0.5 &&
      maxZ + 1.0 > rd.z - rd.d * 0.5 && minZ - 1.0 < rd.z + rd.d * 0.5
    ) return false;
  }
  return true;
}

export function buildDowntownMonumentalEsplanades(world) {
  const tryPromenadeSlab = (cx, cz, w, d, hexMain = 0x334155, hexInlay = 0x94a3b8) => {
    if (!isCivicLandscapeSafeRect(world, cx - w * 0.5, cx + w * 0.5, cz - d * 0.5, cz + d * 0.5)) return;
    const ty = world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : 0;
    const topY = ty + ROAD.curbHeight + 0.025;
    pushSidewalkColoredBox(world, w, 0.22, d, cx, topY - 0.11, cz, hexMain);
    if (w > 5 && d > 5) pushSidewalkColoredBox(world, w - 3.2, 0.03, d - 3.2, cx, topY + 0.015, cz, hexInlay);
  };
  const tryCivicTree = (tx, tz, sc = 1.15) => {
    if (!isCivicLandscapeSafeRect(world, tx - 2.2, tx + 2.2, tz - 2.2, tz + 2.2)) return;
    const ty = world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, tz) : 0;
    world._addLegoTree?.(tx, ty + 0.04, tz, sc);
  };

  for (const sgn of [-1, 1]) {
    tryPromenadeSlab(sgn * 63, -428, 12, 86, 0x64748b, 0x94a3b8);
    for (let z = -466; z <= -388; z += 20) {
      tryCivicTree(sgn * 60, z, 1.18);
      tryCivicTree(sgn * 67, z + 8, 1.08);
    }
    tryPromenadeSlab(sgn * 42, -284, 24, 66, 0x64748b, 0x94a3b8);
    for (let z = -312; z <= -256; z += 18) {
      tryCivicTree(sgn * 33, z, 1.16);
      tryCivicTree(sgn * 51, z, 1.12);
    }
    buildDetailedBuilding(world, sgn * 102, -428, 38, 194, 36, 'black_granite_gold', {
      rotY: 0, archetype: 'podium_tower', seed: sgn > 0 ? 901 : 902
    });
    buildDetailedBuilding(world, sgn * 86, -288, 36, 178, 34, 'sapphire_glass', {
      rotY: 0, archetype: 'podium_tower', seed: sgn > 0 ? 905 : 906
    });
  }

  for (const px of [-996, -936]) tryPromenadeSlab(px, -422, 22, 74, 0x64748b, 0x94a3b8);
  for (let z = -454; z <= -388; z += 22) {
    for (const tx of [-1004, -988, -944, -928]) tryCivicTree(tx, z, 1.15);
  }
  for (const pz of [-546, -486]) tryPromenadeSlab(-872, pz, 76, 20, 0x64748b, 0x94a3b8);
  for (let x = -904; x <= -838; x += 22) {
    for (const tz of [-552, -538, -494, -480]) tryCivicTree(x, tz, 1.14);
  }
}

export function fillOrganicUrbanSuperBlock(world, blockBounds, opts = {}) {
  const isNorthTransition = Boolean(opts.isNorthTransition);
  const baseSeed = Number(opts.seed) || 1;
  const inset = ROAD.sidewalk + 2.2;
  const blockInnerBounds = {
    minX: blockBounds.minX + inset, maxX: blockBounds.maxX - inset,
    minZ: blockBounds.minZ + inset, maxZ: blockBounds.maxZ - inset
  };
  if (blockInnerBounds.maxX - blockInnerBounds.minX < 28 || blockInnerBounds.maxZ - blockInnerBounds.minZ < 28) return 0;

  const rawFeatures = queryOrganicFeaturesInBounds(blockBounds.minX, blockBounds.maxX, blockBounds.minZ, blockBounds.maxZ, 36);
  const vistaKeepouts = getMonumentalVistaKeepouts().filter(
    (k) => k.maxX >= blockBounds.minX - 24 && k.minX <= blockBounds.maxX + 24 && k.maxZ >= blockBounds.minZ - 24 && k.minZ <= blockBounds.maxZ + 24
  );
  const localFeatures = {
    ...rawFeatures,
    keepouts: vistaKeepouts.length ? [...rawFeatures.keepouts, ...vistaKeepouts] : rawFeatures.keepouts
  };
  const localGroundRoads = (world?.mapRoads || []).filter(
    (rd) =>
      !rd.isElevated && !rd.isBridge &&
      rd.x + rd.w * 0.5 >= blockBounds.minX - 60 && rd.x - rd.w * 0.5 <= blockBounds.maxX + 60 &&
      rd.z + rd.d * 0.5 >= blockBounds.minZ - 60 && rd.z - rd.d * 0.5 <= blockBounds.maxZ + 60
  );

  const placedObbs = [];
  let placedCount = 0;
  let seq = 1;
  const canPlace = (obb, minGap = 3.6) =>
    canPlaceBuildingObb(world, obb, localFeatures, blockInnerBounds, placedObbs, localGroundRoads, minGap);

  const placeSubdividedParcel = (parcel, isNeonCorridor = false) => {
    const candidates = [[parcel.w, parcel.d]];
    if (parcel.fallbackW && parcel.fallbackD && (parcel.fallbackW !== parcel.w || parcel.fallbackD !== parcel.d)) {
      candidates.push([parcel.fallbackW, parcel.fallbackD]);
    }
    const minGap = parcel.minGap ?? 3.6;
    for (const [w, d] of candidates) {
      const cz = nudgeClearOfBankVaultSliceZ(parcel.cz, w, d, parcel.rotY);
      const obb = createObb2D(parcel.cx, cz, w, d, parcel.rotY);
      obb.minGap = minGap;
      if (!canPlace(obb, minGap)) continue;

      const skyH = computeDowntownSkylineHeight(parcel.cx, cz, parcel.seed);
      const fallbackStyleKey = pickContextualStyle(parcel.cx, cz, isNorthTransition, parcel.seed);
      const spec = classifyDowntownArchitecturalArchetype({ ...parcel, w, d }, skyH, {
        isNorthTransition, fallbackStyleKey, seed: parcel.seed
      });
      buildDetailedBuilding(world, parcel.cx, cz, w, spec.height, d, spec.styleKey, {
        rotY: parcel.rotY, archetype: spec.archetype, blindSides: spec.blindSides, seed: parcel.seed
      });
      if (isNeonCorridor && !isNorthTransition) {
        addFacadeNeonScreens(
          world, parcel.cx, cz, w, spec.height, d, parcel.rotY,
          parcel.streetTargetX ?? parcel.cx, parcel.streetTargetZ ?? cz, parcel.seed
        );
      }
      placedObbs.push(obb);
      placedCount++;
      return true;
    }
    return false;
  };

  for (const f of localFeatures.flatironCorners) {
    if (f.cx < blockBounds.minX || f.cx > blockBounds.maxX || f.cz < blockBounds.minZ || f.cz > blockBounds.maxZ) continue;
    let placedFlatiron = false;
    for (const scaleTry of [1.0, 0.88]) {
      if (placedFlatiron) break;
      const bw = Math.round(f.backWidth * scaleTry * 10) / 10;
      const len = Math.round(f.length * scaleTry * 10) / 10;
      for (let r = 0; r <= 64 && !placedFlatiron; r += 8) {
        const steps = r === 0 ? 1 : 16;
        for (let a = 0; a < steps; a++) {
          const ang = (a / steps) * Math.PI * 2;
          const cx = f.cx + Math.cos(ang) * r;
          const cz = nudgeClearOfBankVaultSliceZ(f.cz + Math.sin(ang) * r, bw, len, f.rotY, [0.62, 0.8, 1.0]);
          const obb = createObb2D(cx, cz, bw, len, f.rotY);
          obb.minGap = 3.6;
          if (!canPlace(obb, 3.6)) continue;
          const skyH = computeDowntownSkylineHeight(cx, cz, baseSeed + seq * 13);
          const finalH = Math.round((f.height * 0.65 + skyH * 0.35) * 10) / 10;
          buildFlatironWedgeBuilding(world, { ...f, cx, cz, backWidth: bw, length: len, height: finalH, seed: baseSeed * 19 + seq++ });
          placedObbs.push(obb);
          placedCount++;
          placedFlatiron = true;
          break;
        }
      }
    }
  }

  const sortedSegs = [...localFeatures.segments].sort((a, b) => Number(b.isMain) - Number(a.isMain) || b.len - a.len);
  for (let si = 0; si < sortedSegs.length; si++) {
    const seg = sortedSegs[si];
    if (seg.len < 34) continue;
    const isNeon = seg.polyId === 'broadway_metro_nw_se' || seg.polyId === 'boulevard_diag_ne_sw' || (seg.minZ <= 15 && seg.maxZ >= -355);
    for (const side of [-1, 1]) {
      const lots = subdivideSegmentCorridorLots(seg, side, baseSeed * 37 + si * 11 + (side > 0 ? 7 : 3));
      for (let li = 0; li < lots.length; li++) placeSubdividedParcel(lots[li], isNeon);
    }
  }

  for (const rb of localFeatures.roundabouts) {
    if (rb.cx < blockBounds.minX || rb.cx > blockBounds.maxX || rb.cz < blockBounds.minZ || rb.cz > blockBounds.maxZ) continue;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + 0.14;
      const rad = rb.outerR + rb.sidewalk + 15.2;
      const isNarrow = k % 3 === 1;
      placeSubdividedParcel({
        cx: rb.cx + Math.cos(ang) * rad, cz: rb.cz + Math.sin(ang) * rad,
        w: isNarrow ? 19 : 28, d: isNarrow ? 22 : 24, rotY: Math.atan2(-Math.cos(ang), -Math.sin(ang)),
        lotClass: isNarrow ? 'narrow_historic' : 'medium_corporate', blindSides: 'none', minGap: 2.6,
        streetTargetX: rb.cx, streetTargetZ: rb.cz, seed: baseSeed * 43 + k * 13
      });
    }
  }

  if (!isNorthTransition && (baseSeed & 1) === 1) {
    const podiumCorners = [
      [blockInnerBounds.minX + 26, blockInnerBounds.maxZ - 23],
      [blockInnerBounds.maxX - 26, blockInnerBounds.maxZ - 23],
      [blockInnerBounds.minX + 26, blockInnerBounds.minZ + 23],
      [blockInnerBounds.maxX - 26, blockInnerBounds.minZ + 23]
    ];
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const [px, rawPz] = podiumCorners[(pIdx + (baseSeed % 4)) % 4];
      const pz = nudgeClearOfBankVaultSliceZ(rawPz, 50, 42, 0, [0.36, 0.52, 0.74, 1.0]);
      const skyH = computeDowntownSkylineHeight(px, pz, baseSeed + 91);
      if (skyH < 124) continue;
      const pObb = createObb2D(px, pz, 50, 42, 0);
      pObb.minGap = 4.0;
      if (!canPlace(pObb, 4.0)) continue;
      buildEmpireStatePodiumTower(world, px, pz, 50, skyH * 1.08, 42, 0, pickContextualStyle(px, pz, false, baseSeed + 91), baseSeed + 91);
      placedObbs.push(pObb);
      placedCount++;
      break;
    }
  }

  const edgeSpecs = [
    { axis: 'x', from: blockInnerBounds.minX, to: blockInnerBounds.maxX, fixedEdge: blockInnerBounds.minZ, inSign: 1, includeCorners: true },
    { axis: 'x', from: blockInnerBounds.minX, to: blockInnerBounds.maxX, fixedEdge: blockInnerBounds.maxZ, inSign: -1, includeCorners: true },
    { axis: 'z', from: blockInnerBounds.minZ + 44, to: blockInnerBounds.maxZ - 44, fixedEdge: blockInnerBounds.minX, inSign: 1, includeCorners: false },
    { axis: 'z', from: blockInnerBounds.minZ + 44, to: blockInnerBounds.maxZ - 44, fixedEdge: blockInnerBounds.maxX, inSign: -1, includeCorners: false }
  ];
  for (let ei = 0; ei < edgeSpecs.length; ei++) {
    const parcels = subdivideEdgeIntoParcels(edgeSpecs[ei], baseSeed * 53 + ei * 19);
    for (let pi = 0; pi < parcels.length; pi++) {
      const p = parcels[pi];
      placeSubdividedParcel(p, !isNorthTransition && p.cz >= -355 && p.cz <= 15 && Math.abs(p.cx) < 1050);
    }
  }

  const midX = (blockInnerBounds.minX + blockInnerBounds.maxX) * 0.5;
  const midZ = (blockInnerBounds.minZ + blockInnerBounds.maxZ) * 0.5;
  let pocketPlaced = false;
  for (let gx = blockInnerBounds.minX + 48; gx <= blockInnerBounds.maxX - 48 && !pocketPlaced; gx += 40) {
    for (let gz = blockInnerBounds.minZ + 48; gz <= blockInnerBounds.maxZ - 48; gz += 40) {
      if (Math.hypot(gx - midX, gz - midZ) > 135) continue;
      const pObb = createObb2D(gx, gz, 22, 22, 0);
      pObb.minGap = 8.0;
      if (!canPlace(pObb, 8.0) || getMetroCutoutFloorY(gx, gz) !== null) continue;
      buildUrbanPocketPlaza(world, gx, gz, !isNorthTransition, baseSeed);
      placedObbs.push(pObb);
      pocketPlaced = true;
      break;
    }
  }

  const backLots = generateCourtyardBackLots(blockInnerBounds, localFeatures.segments, baseSeed);
  for (let bi = 0; bi < backLots.length; bi++) placeSubdividedParcel(backLots[bi], false);

  return placedCount;
}
