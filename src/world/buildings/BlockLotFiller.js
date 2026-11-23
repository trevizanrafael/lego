/**
 * BlockLotFiller.js
 * Gerador Denso de Lotes Urbanos Não-Matriz para o Centro & Transição Norte (Escala 3x):
 *  - Skyline gradual com duplo epicentro (Super Banco + Torre dos Heróis) + crista Times Square/Broadway
 *  - Validador geométrico OBB estrito (calçadas de 10m, fitas diagonais/curvas, rotatórias, keepouts e mapRoads)
 *  - Pipeline em 4 camadas por super-quadra: Cunhas Flatiron, Fachadas Giradas (`rotY`) + Neon,
 *    Fechamento das 4 Avenidas Externas (incluindo Empire State Podium) e Sub-Lotes + Praças de Bolso.
 */

import * as THREE from 'three';
import { BUILDING_STYLES, makeFastBox } from '../BuildingGenerator.js';
import { buildDetailedBuilding } from './DetailedBuildingBuilder.js';
import { buildFlatironWedgeBuilding } from './FlatironWedgeBuilder.js';
import {
  localToWorldXZ,
  createObb2D,
  obbInsideBounds2D,
  obbIntersectsObb2D,
  obbIntersectsRect2D,
  obbClearOfSegment2D,
  obbClearOfCircle2D
} from './LotGeometry2D.js';
import { queryOrganicFeaturesInBounds } from '../terrain/OrganicDowntownNetworkSpec.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { ROAD } from '../core/WorldLayoutScale.js';

const NEON_PALETTE = Object.freeze([0x00f0ff, 0xfacc15, 0xef4444, 0xec4899, 0x22c55e, 0xa855f7]);
const EXTRA_PORTAL_JOIN_KEEPOUTS = Object.freeze([
  { id: 'metro_west_portal_join', minX: -272, maxX: -220, minZ: -752, maxZ: -596 },
  { id: 'metro_east_portal_join', minX: 220, maxX: 272, minZ: -752, maxZ: -596 }
]);
const TRANSITION_STYLES = Object.freeze(['ny_brick', 'classic_sandstone', 'white_concrete', 'silver_corporate', 'emerald_steel']);
const TIMES_SQ_STYLES = Object.freeze(['black_granite_gold', 'sapphire_glass', 'cyan_modern', 'silver_corporate']);
const CORE_STYLES = Object.freeze(['black_granite_gold', 'sapphire_glass', 'silver_corporate', 'emerald_steel', 'cyan_modern', 'white_concrete']);
const BORDER_STYLES = Object.freeze(['classic_sandstone', 'ny_brick', 'white_concrete', 'emerald_steel', 'silver_corporate', 'sapphire_glass']);

function hash01(seed, salt = 0) {
  let h = Math.imul((seed | 0) ^ Math.imul(salt | 0, 0x9e3779b1), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function pickContextualStyle(wx, wz, isNorthTransition, seed) {
  const idx = Math.floor(hash01(seed, Math.round(wx * 3 + wz * 5)) * 997);
  if (isNorthTransition || wz < -1146) return TRANSITION_STYLES[idx % TRANSITION_STYLES.length];
  if (wz >= -355 && wz <= 15 && Math.abs(wx) < 980) return TIMES_SQ_STYLES[idx % TIMES_SQ_STYLES.length];
  if (Math.abs(wx) > 1160 || wz < -960) return BORDER_STYLES[idx % BORDER_STYLES.length];
  return CORE_STYLES[idx % CORE_STYLES.length];
}

// Evita alinhar sub-colisores de topo (minY > 35) exatamente na fatia Z = -556.0 da verga do cofre do Super Banco
function nudgeClearOfBankVaultSliceZ(cz, w, d, rotY, scales = [0.64, 1.0]) {
  const VAULT_Z = -556.0;
  if (Math.abs(cz - VAULT_Z) > 32) return cz;
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
  for (let step = 0; step <= 14; step++) {
    const dz = step === 0 ? 0 : (step & 1 ? 1 : -1) * Math.ceil(step * 0.5) * 1.45;
    const testZ = cz + dz;
    if (pts.every(([lx, lz]) => Math.abs(testZ - lx * sinY + lz * cosY - VAULT_Z) >= 0.85)) return testZ;
  }
  return cz + 11.5;
}

/**
 * Skyline Gradual aprovado pelo usuário:
 *  - Transição Norte (`wz < -1146`): `30m a 56m` (mais altos perto de Z=-1146 e mais baixos perto de Z=-1536).
 *  - Centro (`wz >= -1146`): duplo epicentro no Super Banco `(0, -525)` (`175m–214m`) e Torre dos Heróis
 *    `(-966, -516)` (`168m–204m`), crista Times Square `(0, -175)` (`138m–174m`), até `62m–96m` nas bordas.
 */
export function computeDowntownSkylineHeight(wx, wz, seed = 1) {
  const coordSalt = Math.round(wx * 3 - wz * 7);
  if (wz < -1146) {
    const tSouth = THREE.MathUtils.clamp((wz + 1536) / 390, 0, 1);
    const edgeFade = 1 - 0.13 * THREE.MathUtils.clamp((Math.abs(wx) - 920) / 640, 0, 1);
    const jitter = 0.86 + hash01(seed, coordSalt) * 0.24;
    return Math.round(THREE.MathUtils.clamp((33.0 + tSouth * 18.5) * edgeFade * jitter, 30, 56) * 10) / 10;
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
  return Math.round(THREE.MathUtils.clamp(envelope * (0.78 + hash01(seed, coordSalt) * 0.36), 62, 214) * 10) / 10;
}

export function canPlaceBuildingObb(world, obb, localFeatures, blockInnerBounds, placedObbs, groundRoadsOverride = null) {
  if (!obbInsideBounds2D(obb, blockInnerBounds.minX, blockInnerBounds.maxX, blockInnerBounds.minZ, blockInnerBounds.maxZ, 0)) {
    return false;
  }
  for (let i = 0; i < placedObbs.length; i++) {
    if (obbIntersectsObb2D(obb, placedObbs[i], 3.6)) return false;
  }
  const keepouts = localFeatures?.keepouts || [];
  for (let i = 0; i < keepouts.length; i++) {
    const k = keepouts[i];
    if (
      obb.maxX + 1.5 > k.minX && obb.minX - 1.5 < k.maxX &&
      obb.maxZ + 1.5 > k.minZ && obb.minZ - 1.5 < k.maxZ &&
      obbIntersectsRect2D(obb, k.minX, k.maxX, k.minZ, k.maxZ, 1.5)
    ) {
      return false;
    }
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
    ) {
      return false;
    }
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

  buildDetailedBuilding(world, cx, cz, w, h0, d, styleKey, { yBase: y0, rotY, rooftop: true, registerMap: false, seed: sBase });
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
    world.mapBuildings.push({ x: cx, z: cz, w, d, rotY, height: finalH, styleKey, color: st.mapColor, label: null });
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
  const pushBox = (w, h, d, y, hex) => {
    if (world?._sidewalkGeosByColor instanceof Map) {
      let b = world._sidewalkGeosByColor.get(hex);
      if (!b) { b = []; world._sidewalkGeosByColor.set(hex, b); }
      b.push(makeFastBox(w, h, d, px, y, pz));
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.42 }));
      m.position.set(px, y, pz);
      world?.scene?.add(m);
    }
  };
  pushBox(7.6, 0.85, 7.6, baseY + 0.44, 0x64748b);
  pushBox(5.8, 0.92, 5.8, baseY + 0.48, 0x0284c7);
  pushBox(1.9, 4.1, 1.9, baseY + 2.1, (seed & 1) === 0 ? 0xd97706 : 0x94a3b8);
  world.addCollider?.(px, pz, 7.6, 7.6, baseY + 4.2, baseY);
}

export function fillOrganicUrbanSuperBlock(world, blockBounds, opts = {}) {
  const isNorthTransition = Boolean(opts.isNorthTransition);
  const baseSeed = Number(opts.seed) || 1;
  const inset = ROAD.sidewalk + 2.2;
  const blockInnerBounds = {
    minX: blockBounds.minX + inset,
    maxX: blockBounds.maxX - inset,
    minZ: blockBounds.minZ + inset,
    maxZ: blockBounds.maxZ - inset
  };
  if (blockInnerBounds.maxX - blockInnerBounds.minX < 28 || blockInnerBounds.maxZ - blockInnerBounds.minZ < 28) return 0;

  const rawFeatures = queryOrganicFeaturesInBounds(blockBounds.minX, blockBounds.maxX, blockBounds.minZ, blockBounds.maxZ, 36);
  const extraKeepouts = EXTRA_PORTAL_JOIN_KEEPOUTS.filter(
    (k) => k.maxX >= blockBounds.minX - 24 && k.minX <= blockBounds.maxX + 24 && k.maxZ >= blockBounds.minZ - 24 && k.minZ <= blockBounds.maxZ + 24
  );
  const localFeatures = {
    ...rawFeatures,
    keepouts: extraKeepouts.length ? [...rawFeatures.keepouts, ...extraKeepouts] : rawFeatures.keepouts
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
  const canPlace = (obb) => canPlaceBuildingObb(world, obb, localFeatures, blockInnerBounds, placedObbs, localGroundRoads);

  // PASSO 1 — Cunhas Triangulares Art-Deco ("Flatiron") nas esquinas agudas
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
          if (!canPlace(obb)) continue;
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

  // PASSO 2 — Fachadas Giradas (`rotY`) acompanhando Diagonais, Curvas em S, Cotovelos, Raios e Rotatórias
  const sortedSegs = [...localFeatures.segments].sort((a, b) => Number(b.isMain) - Number(a.isMain) || b.len - a.len);
  for (let si = 0; si < sortedSegs.length; si++) {
    const seg = sortedSegs[si];
    if (seg.len < 34) continue;
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const tx = dx / seg.len;
    const tz = dz / seg.len;
    const rotY = Math.atan2(dx, dz) + Math.PI * 0.5;
    const isNeonCorridor =
      seg.polyId === 'broadway_metro_nw_se' || seg.polyId === 'boulevard_diag_ne_sw' || (seg.minZ <= 15 && seg.maxZ >= -355);

    for (const side of [-1, 1]) {
      let sCursor = seg.len < 72 ? seg.len * 0.5 : 24;
      const sEnd = seg.len < 72 ? seg.len * 0.5 + 0.1 : seg.len - 22;
      while (sCursor <= sEnd) {
        const lotSeed = baseSeed * 37 + si * 11 + (side > 0 ? 7 : 3) + Math.round(sCursor);
        const prefW = seg.len < 76 ? THREE.MathUtils.clamp(Math.floor(seg.len - 8), 30, 44) : 38 + Math.floor(hash01(lotSeed, 1) * 16);
        const prefD = 28 + Math.floor(hash01(lotSeed, 2) * 12);
        let acceptedW = 0;
        for (const [bldW, bldD] of [[prefW, prefD], [32, 26]]) {
          const perpDist = seg.halfWidth + seg.sidewalk + 2.4 + bldD * 0.5;
          const sx = seg.x1 + tx * sCursor;
          const sz = seg.z1 + tz * sCursor;
          const cx = sx - tz * side * perpDist;
          const cz = nudgeClearOfBankVaultSliceZ(sz + tx * side * perpDist, bldW, bldD, rotY);
          const obb = createObb2D(cx, cz, bldW, bldD, rotY);
          if (!canPlace(obb)) continue;
          const h = computeDowntownSkylineHeight(cx, cz, lotSeed);
          buildDetailedBuilding(world, cx, cz, bldW, h, bldD, pickContextualStyle(cx, cz, isNorthTransition, lotSeed), { rotY, seed: lotSeed });
          if (isNeonCorridor && !isNorthTransition) addFacadeNeonScreens(world, cx, cz, bldW, h, bldD, rotY, sx, sz, lotSeed);
          placedObbs.push(obb);
          placedCount++;
          acceptedW = bldW;
          seq++;
          break;
        }
        if (seg.len < 72) break;
        sCursor += acceptedW > 0 ? acceptedW + 6.2 : 16.0;
      }
    }
  }

  for (const rb of localFeatures.roundabouts) {
    if (rb.cx < blockBounds.minX || rb.cx > blockBounds.maxX || rb.cz < blockBounds.minZ || rb.cz > blockBounds.maxZ) continue;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2 + 0.14;
      const rad = rb.outerR + rb.sidewalk + 15.2;
      const rotY = Math.atan2(Math.cos(ang), Math.sin(ang));
      const cx = rb.cx + Math.cos(ang) * rad;
      const cz = nudgeClearOfBankVaultSliceZ(rb.cz + Math.sin(ang) * rad, 28, 24, rotY);
      const obb = createObb2D(cx, cz, 28, 24, rotY);
      if (!canPlace(obb)) continue;
      const lotSeed = baseSeed * 43 + k * 13;
      const h = computeDowntownSkylineHeight(cx, cz, lotSeed);
      buildDetailedBuilding(world, cx, cz, 28, h, 24, pickContextualStyle(cx, cz, isNorthTransition, lotSeed), { rotY, seed: lotSeed });
      placedObbs.push(obb);
      placedCount++;
    }
  }

  // PASSO 3 — Fechamento Contínuo das 4 Frentes das Avenidas Externas (N, S, O, L) + Empire State Podium
  if (!isNorthTransition) {
    const podiumCorners = [
      [blockInnerBounds.minX + 26, blockInnerBounds.maxZ - 23],
      [blockInnerBounds.maxX - 26, blockInnerBounds.maxZ - 23],
      [blockInnerBounds.minX + 26, blockInnerBounds.minZ + 23],
      [blockInnerBounds.maxX - 26, blockInnerBounds.minZ + 23]
    ];
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const [px, rawPz] = podiumCorners[(pIdx + (baseSeed % 4)) % 4];
      const pz = nudgeClearOfBankVaultSliceZ(rawPz, 50, 44, 0, [0.36, 0.52, 0.74, 1.0]);
      const skyH = computeDowntownSkylineHeight(px, pz, baseSeed + 91);
      if (skyH < 118) continue;
      const pObb = createObb2D(px, pz, 50, 44, 0);
      if (!canPlace(pObb)) continue;
      buildEmpireStatePodiumTower(world, px, pz, 50, skyH, 44, 0, pickContextualStyle(px, pz, false, baseSeed + 91), baseSeed + 91);
      placedObbs.push(pObb);
      placedCount++;
      break;
    }
  }

  const edges = [
    { axis: 'x', fixedEdge: blockInnerBounds.minZ, inSign: 1, outZOff: -20 },
    { axis: 'x', fixedEdge: blockInnerBounds.maxZ, inSign: -1, outZOff: 20 },
    { axis: 'z', fixedEdge: blockInnerBounds.minX, inSign: 1, outXOff: -20 },
    { axis: 'z', fixedEdge: blockInnerBounds.maxX, inSign: -1, outXOff: 20 }
  ];
  for (let ei = 0; ei < edges.length; ei++) {
    const ed = edges[ei];
    let cursor = ed.axis === 'x' ? blockInnerBounds.minX + 20 : blockInnerBounds.minZ + 20;
    const endC = ed.axis === 'x' ? blockInnerBounds.maxX - 20 : blockInnerBounds.maxZ - 20;
    while (cursor <= endC) {
      const eSeed = baseSeed * 53 + ei * 19 + Math.round(cursor);
      const spanPref = 42 + Math.floor(hash01(eSeed, 3) * 16);
      const depthPref = 32 + Math.floor(hash01(eSeed, 4) * 11);
      let placedSpan = 0;
      for (const [span, depth] of [[spanPref, depthPref], [32, 26]]) {
        const w = ed.axis === 'x' ? span : depth;
        const d = ed.axis === 'x' ? depth : span;
        const cx = ed.axis === 'x' ? cursor : ed.fixedEdge + ed.inSign * (w * 0.5);
        const cz = nudgeClearOfBankVaultSliceZ(ed.axis === 'x' ? ed.fixedEdge + ed.inSign * (d * 0.5) : cursor, w, d, 0);
        const obb = createObb2D(cx, cz, w, d, 0);
        if (!canPlace(obb)) continue;
        const h = computeDowntownSkylineHeight(cx, cz, eSeed);
        buildDetailedBuilding(world, cx, cz, w, h, d, pickContextualStyle(cx, cz, isNorthTransition, eSeed), { rotY: 0, seed: eSeed });
        if (!isNorthTransition && cz >= -355 && cz <= 15 && Math.abs(cx) < 1050) {
          addFacadeNeonScreens(world, cx, cz, w, h, d, 0, cx + (ed.outXOff || 0), cz + (ed.outZOff || 0), eSeed);
        }
        placedObbs.push(obb);
        placedCount++;
        placedSpan = span;
        break;
      }
      cursor += placedSpan > 0 ? placedSpan + 6.5 : 12.0;
    }
  }

  // PASSO 4 — Praça de Bolso Arborizada (1 por quadra) + Sub-Lotes Internos
  const midX = (blockInnerBounds.minX + blockInnerBounds.maxX) * 0.5;
  const midZ = (blockInnerBounds.minZ + blockInnerBounds.maxZ) * 0.5;
  let pocketPlaced = false;
  for (let gx = blockInnerBounds.minX + 48; gx <= blockInnerBounds.maxX - 48 && !pocketPlaced; gx += 40) {
    for (let gz = blockInnerBounds.minZ + 48; gz <= blockInnerBounds.maxZ - 48; gz += 40) {
      if (Math.hypot(gx - midX, gz - midZ) > 135) continue;
      const pObb = createObb2D(gx, gz, 20, 20, 0);
      if (!canPlace(pObb) || getMetroCutoutFloorY(gx, gz) !== null) continue;
      buildUrbanPocketPlaza(world, gx, gz, !isNorthTransition, baseSeed);
      placedObbs.push(pObb);
      pocketPlaced = true;
      break;
    }
  }

  for (let gx = blockInnerBounds.minX + 52; gx <= blockInnerBounds.maxX - 52; gx += 54) {
    for (let gz = blockInnerBounds.minZ + 52; gz <= blockInnerBounds.maxZ - 52; gz += 54) {
      const iSeed = baseSeed * 71 + Math.round(gx * 3 + gz * 5);
      const cx = gx + (hash01(iSeed, 5) - 0.5) * 7;
      let rotY = 0;
      let bestDistSq = 92 * 92;
      for (let si = 0; si < localFeatures.segments.length; si++) {
        const s = localFeatures.segments[si];
        const dSq = (cx - (s.x1 + s.x2) * 0.5) ** 2 + (gz - (s.z1 + s.z2) * 0.5) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          rotY = Math.atan2(s.x2 - s.x1, s.z2 - s.z1) + Math.PI * 0.5;
        }
      }
      const w = 36 + Math.floor(hash01(iSeed, 7) * 14);
      const d = 32 + Math.floor(hash01(iSeed, 8) * 12);
      const cz = nudgeClearOfBankVaultSliceZ(gz + (hash01(iSeed, 6) - 0.5) * 7, w, d, rotY);
      const obb = createObb2D(cx, cz, w, d, rotY);
      if (!canPlace(obb)) continue;
      const h = computeDowntownSkylineHeight(cx, cz, iSeed);
      buildDetailedBuilding(world, cx, cz, w, h, d, pickContextualStyle(cx, cz, isNorthTransition, iSeed), { rotY, seed: iSeed });
      placedObbs.push(obb);
      placedCount++;
    }
  }

  return placedCount;
}
