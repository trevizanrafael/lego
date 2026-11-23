import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { mergeColoredGeometries } from '../BuildingGenerator.js';
import {
  PRISON_ISLAND_POLYGON,
  pointInPolygon,
  isPointOnOrganicLand,
  getDistanceToCoastAt,
  getHighwayDistanceAt,
  getPangaeaElevationAt
} from '../CoastlineProfile.js';
import { getFavelaElevation } from '../regions/FavelaCDDBuilder.js';
import { MAP_REGIONS } from '../MapRegionsData.js';
import { IS_SCALED_WORLD, ws, fromWs } from '../core/WorldLayoutScale.js';

export const NATURAL_PERIPHERY_CHUNK_SIZE = 1100;
export const NATURAL_PERIPHERY_LOD1_DIST = IS_SCALED_WORLD ? 1250 : 420;
export const NATURAL_PERIPHERY_LOD2_DIST = IS_SCALED_WORLD ? 3100 : 1150;

const PERIPHERY_SECTORS = [
  { key: 'nw_serra', originX: ws(-2650), originZ: ws(-1050) },
  { key: 'north_boreal', originX: ws(-350), originZ: ws(-2050) },
  { key: 'ne_tethys', originX: ws(2450), originZ: ws(-1550) },
  { key: 'sw_dunes', originX: ws(-2450), originZ: ws(1550) },
  { key: 'se_prison_shore', originX: ws(1450), originZ: ws(1600) }
];

let _sharedStandardVcMat = null;
let _sharedBasicVcMat = null;

export function getSharedPeripheryStandardVcMaterial() {
  if (!_sharedStandardVcMat) {
    _sharedStandardVcMat = markAsSharedAsset(
      new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.48, metalness: 0.16 })
    );
  }
  return _sharedStandardVcMat;
}

export function getSharedPeripheryBasicVcMaterial() {
  if (!_sharedBasicVcMat) {
    _sharedBasicVcMat = markAsSharedAsset(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2
      })
    );
  }
  return _sharedBasicVcMat;
}

function _extractPosArray(geo) {
  const ni = geo.index ? geo.toNonIndexed() : geo;
  const arr = new Float32Array(ni.attributes.position.array);
  if (ni !== geo) ni.dispose();
  geo.dispose();
  return arr;
}

const _ICO_POS = _extractPosArray(new THREE.IcosahedronGeometry(1, 0));
const _OCT_POS = _extractPosArray(new THREE.OctahedronGeometry(1, 0));
const _TRUNK_POS = _extractPosArray(new THREE.CylinderGeometry(0.66, 1.0, 1.0, 5, 1, true));

const _PALETTE = {
  forestDeep: new THREE.Color(0x143622),
  forestEmerald: new THREE.Color(0x0f2e20),
  forestMoss: new THREE.Color(0x254221),
  forestPine: new THREE.Color(0x1b3c2a),
  barkDark: new THREE.Color(0x3a2517),
  barkWarm: new THREE.Color(0x4b311f),
  graniteDark: new THREE.Color(0x363d47),
  graniteBasalt: new THREE.Color(0x282e37),
  graniteMoss: new THREE.Color(0x35413b),
  restingaOlive: new THREE.Color(0x2f4a24),
  restingaScrub: new THREE.Color(0x3c5328),
  palmCrown: new THREE.Color(0x204b27),
  palmTrunk: new THREE.Color(0x593e27),
  duneMound: new THREE.Color(0x6d5f41),
  duneGrass: new THREE.Color(0x4b5c29),
  mangroveRoot: new THREE.Color(0x2a1c13),
  mangroveCrown: new THREE.Color(0x163b26),
  laneCrown: new THREE.Color(0x3b352d),
  laneShoulder: new THREE.Color(0x574836)
};

function makeFacetedGeo(srcPos, sx, sy, sz, lx, ly, lz, rotY = 0, tiltX = 0, tiltZ = 0) {
  const n = srcPos.length;
  const pos = new Float32Array(n);
  const norm = new Float32Array(n);
  const cy = Math.cos(rotY), syRot = Math.sin(rotY);
  const cx = Math.cos(tiltX), sxRot = Math.sin(tiltX);
  const cz = Math.cos(tiltZ), szRot = Math.sin(tiltZ);

  for (let i = 0; i < n; i += 3) {
    let x = srcPos[i] * sx, y = srcPos[i + 1] * sy, z = srcPos[i + 2] * sz;
    if (tiltX !== 0) { const ny = y * cx - z * sxRot; z = y * sxRot + z * cx; y = ny; }
    if (tiltZ !== 0) { const nx = x * cz - y * szRot; y = x * szRot + y * cz; x = nx; }
    pos[i] = x * cy + z * syRot + lx;
    pos[i + 1] = y + ly;
    pos[i + 2] = -x * syRot + z * cy + lz;
  }
  for (let i = 0; i < n; i += 9) {
    const ax = pos[i + 3] - pos[i], ay = pos[i + 4] - pos[i + 1], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], by = pos[i + 7] - pos[i + 1], bz = pos[i + 8] - pos[i + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const inv = 1 / (Math.hypot(nx, ny, nz) || 1);
    nx *= inv; ny *= inv; nz *= inv;
    norm[i] = norm[i + 3] = norm[i + 6] = nx;
    norm[i + 1] = norm[i + 4] = norm[i + 7] = ny;
    norm[i + 2] = norm[i + 5] = norm[i + 8] = nz;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  return geo;
}

function hash01(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

const RAW_RURAL_LANES = [
  { id: 'rural_serra_boreal_sul', label: 'ESTRADA RURAL DA SERRA BOREAL', width: 8.5, waypoints: [[-1185, -1580], [-960, -1665], [-710, -1595], [-440, -1725], [-180, -1655], [85, -1795], [270, -1965], [255, -2120]] },
  { id: 'rural_serra_boreal_crista', label: 'TRILHA CRISTA DA MATA NORTE', width: 8.0, waypoints: [[-1185, -2260], [-975, -2395], [-740, -2535], [-515, -2385], [-260, -2245], [-45, -2390], [195, -2475]] },
  { id: 'rural_cabo_noroeste_serra', label: 'CAMINHO RURAL DO CABO NOROESTE', width: 8.5, waypoints: [[-2485, -1675], [-2685, -1765], [-2910, -1690], [-3055, -1515], [-2965, -1320]] },
  { id: 'rural_dunas_sudoeste_leste', label: 'ESTRADINHA DA RESTINGA SUDOESTE', width: 8.5, waypoints: [[-1925, 740], [-1865, 1020], [-1985, 1345], [-2145, 1665], [-2295, 1890], [-2435, 1945]] },
  { id: 'rural_dunas_sudoeste_costa', label: 'VEREDA COSTEIRA DAS DUNAS', width: 8.0, waypoints: [[-2490, 925], [-2740, 1045], [-2935, 1295], [-3010, 1585], [-2885, 1855], [-2680, 1955], [-2490, 1865]] },
  { id: 'rural_tetis_serra_nordeste', label: 'ESTRADA SERRANA DE TÉTIS', width: 8.5, waypoints: [[1690, -2120], [1925, -2285], [2245, -2255], [2540, -2060], [2775, -1845], [2695, -1740]] }
];

function sampleCatmullLanePoints(rawWaypoints, buildings) {
  const scaled = rawWaypoints.map(([px, pz]) => [ws(px), ws(pz)]);
  const out = [];
  const stepMeters = IS_SCALED_WORLD ? 38 : 22;

  for (let i = 0; i < scaled.length - 1; i++) {
    const p0 = scaled[Math.max(0, i - 1)], p1 = scaled[i], p2 = scaled[i + 1], p3 = scaled[Math.min(scaled.length - 1, i + 2)];
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / stepMeters));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      let x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      let z = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      for (let b = 0; b < buildings.length; b++) {
        const bd = buildings[b], rx = bd.w * 0.5 + 16, rz = bd.d * 0.5 + 16, dx = x - bd.x, dz = z - bd.z;
        if (Math.abs(dx) < rx && Math.abs(dz) < rz) {
          if (Math.abs(dx) >= Math.abs(dz)) x = bd.x + (dx >= 0 ? rx : -rx);
          else z = bd.z + (dz >= 0 ? rz : -rz);
        }
      }
      if (isPointOnOrganicLand(x, z) && getDistanceToCoastAt(x, z, 40) >= 22) out.push([x, z]);
    }
  }
  const last = scaled[scaled.length - 1];
  if (isPointOnOrganicLand(last[0], last[1]) && getDistanceToCoastAt(last[0], last[1], 40) >= 22) out.push([last[0], last[1]]);
  return out;
}

function buildRuralLanesRibbon(world) {
  if (!Array.isArray(world.mapOrganicRoads)) world.mapOrganicRoads = [];
  const buildings = world.mapBuildings || [];
  const builtLanes = [];
  const ribbonEntries = [];

  for (const spec of RAW_RURAL_LANES) {
    const pts = sampleCatmullLanePoints(spec.waypoints, buildings);
    if (pts.length < 4) continue;
    builtLanes.push({ ...spec, points: pts });
    world.mapOrganicRoads.push({ id: spec.id, label: spec.label, tier: 'local', isMain: false, width: 8.5, isRural: true, points: pts });
  }
  if (builtLanes.length === 0) return { builtLanes, laneSegments: [] };

  let sumX = 0, sumZ = 0, countPts = 0;
  const laneSegments = [];
  for (const lane of builtLanes) {
    for (let i = 0; i < lane.points.length; i++) {
      sumX += lane.points[i][0]; sumZ += lane.points[i][1]; countPts++;
      if (i < lane.points.length - 1) laneSegments.push([lane.points[i][0], lane.points[i][1], lane.points[i + 1][0], lane.points[i + 1][1]]);
    }
  }
  const originX = sumX / countPts, originZ = sumZ / countPts;

  for (const lane of builtLanes) {
    const halfW = lane.width * 0.5, shoulderW = 1.35, pts = lane.points, rings = [];
    for (let i = 0; i < pts.length; i++) {
      const curr = pts[i], prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next[0] - prev[0], dz = next[1] - prev[1], len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      const xL2 = curr[0] - nx * (halfW + shoulderW), zL2 = curr[1] - nz * (halfW + shoulderW);
      const xL1 = curr[0] - nx * halfW, zL1 = curr[1] - nz * halfW;
      const xR1 = curr[0] + nx * halfW, zR1 = curr[1] + nz * halfW;
      const xR2 = curr[0] + nx * (halfW + shoulderW), zR2 = curr[1] + nz * (halfW + shoulderW);
      rings.push([
        [xL2 - originX, getPangaeaElevationAt(xL2, zL2) - 0.12, zL2 - originZ],
        [xL1 - originX, getPangaeaElevationAt(xL1, zL1) + 0.15, zL1 - originZ],
        [xR1 - originX, getPangaeaElevationAt(xR1, zR1) + 0.15, zR1 - originZ],
        [xR2 - originX, getPangaeaElevationAt(xR2, zR2) - 0.12, zR2 - originZ]
      ]);
    }
    for (const [c0, c1, col] of [[0, 1, _PALETTE.laneShoulder], [1, 2, _PALETTE.laneCrown], [2, 3, _PALETTE.laneShoulder]]) {
      const segCount = rings.length - 1;
      const pos = new Float32Array(segCount * 18), norm = new Float32Array(segCount * 18);
      let o = 0;
      for (let s = 0; s < segCount; s++) {
        for (const v of [rings[s][c0], rings[s + 1][c0], rings[s + 1][c1], rings[s][c0], rings[s + 1][c1], rings[s][c1]]) {
          pos[o] = v[0]; pos[o + 1] = v[1]; pos[o + 2] = v[2];
          norm[o] = 0; norm[o + 1] = 1; norm[o + 2] = 0;
          o += 3;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
      ribbonEntries.push({ geo: g, color: col });
    }
  }

  if (ribbonEntries.length > 0) {
    const merged = mergeColoredGeometries(ribbonEntries);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const laneMesh = new THREE.Mesh(merged, getSharedPeripheryStandardVcMaterial());
    laneMesh.name = 'NaturalPeripheryRuralLanes';
    laneMesh.position.set(originX, 0, originZ);
    laneMesh.castShadow = false;
    laneMesh.receiveShadow = true;
    laneMesh.matrixAutoUpdate = false;
    laneMesh.updateMatrix();
    laneMesh.userData = { isNaturalPeriphery: true, isRuralLanesMesh: true, skipStaticMerge: true };
    world.scene.add(laneMesh);
  }
  return { builtLanes, laneSegments };
}

function buildKeepoutSpatialIndex(world, laneSegments) {
  const cellSize = 180, margin = 68, boxGrid = new Map();
  const insertAabb = (minX, maxX, minZ, maxZ) => {
    const rec = [minX, maxX, minZ, maxZ];
    for (let gx = Math.floor(minX / cellSize); gx <= Math.floor(maxX / cellSize); gx++) {
      for (let gz = Math.floor(minZ / cellSize); gz <= Math.floor(maxZ / cellSize); gz++) {
        const key = `${gx},${gz}`;
        let list = boxGrid.get(key);
        if (!list) { list = []; boxGrid.set(key, list); }
        list.push(rec);
      }
    }
  };

  for (const b of world.mapBuildings || []) {
    if ((b.minY ?? 0) <= 80) insertAabb(b.x - b.w * 0.5 - margin, b.x + b.w * 0.5 + margin, b.z - b.d * 0.5 - margin, b.z + b.d * 0.5 + margin);
  }
  for (const r of world.mapRoads || []) {
    if (!r.isElevated) insertAabb(r.x - r.w * 0.5 - margin, r.x + r.w * 0.5 + margin, r.z - r.d * 0.5 - margin, r.z + r.d * 0.5 + margin);
  }

  const protectedCircles = [
    [-1215, -2420], [-1265, -2420], [-2920, -1285], [-2920, -1345],
    [2680, -1120], [2740, -1120], [-2460, 2020], [-2520, 2020]
  ].map(([px, pz]) => [ws(px), ws(pz), 72 * 72]);

  for (const reg of MAP_REGIONS) {
    if (reg.spawn && reg.spawn.y < 120) protectedCircles.push([reg.spawn.x, reg.spawn.z, 72 * 72]);
  }
  for (const lm of world.landmarks || []) {
    if (lm.spawn && lm.spawn.y < 120) protectedCircles.push([lm.spawn.x, lm.spawn.z, 72 * 72]);
  }

  return function isSafeSpot(x, z, minCoastDist = 20) {
    if (!isPointOnOrganicLand(x, z) || (world.isDeepWaterAt && world.isDeepWaterAt(x, z))) return false;
    if (Math.abs(x) < ws(1020) && z > ws(-1080) && z < ws(1080)) return false;
    const dx = fromWs(x), dz = fromWs(z);
    if (dx >= -1020 && dx <= 548 && dz >= -1325 && dz <= -430) return false;
    if (dx >= 576 && dx <= 1635 && dz >= -1325 && dz <= 748) return false;
    if (Math.abs(dx - 560) < 72 && dz < 1095) return false;
    if (x >= ws(-2260) && x <= ws(-1010) && z >= ws(-1340) && z <= ws(680)) return false;
    if (Math.abs(x - ws(1375)) < 495 && Math.abs(z - ws(1540)) < 505) return false;
    if (getFavelaElevation(x, z) > 0.1 || getHighwayDistanceAt(x, z) < 34) return false;
    if (getDistanceToCoastAt(x, z, minCoastDist + 16) < minCoastDist) return false;

    for (let i = 0; i < protectedCircles.length; i++) {
      const c = protectedCircles[i];
      if ((x - c[0]) * (x - c[0]) + (z - c[1]) * (z - c[1]) < c[2]) return false;
    }
    const list = boxGrid.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`);
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]) return false;
      }
    }
    for (let i = 0; i < laneSegments.length; i++) {
      const s = laneSegments[i], sdx = s[2] - s[0], sdz = s[3] - s[1];
      const t = Math.max(0, Math.min(1, ((x - s[0]) * sdx + (z - s[1]) * sdz) / (sdx * sdx + sdz * sdz || 1)));
      const px = s[0] + t * sdx, pz = s[1] + t * sdz;
      if ((x - px) * (x - px) + (z - pz) * (z - pz) < 196) return false;
    }
    return true;
  };
}

export function buildNaturalPeriphery(world) {
  const { builtLanes, laneSegments } = buildRuralLanesRibbon(world);
  const isSafeSpot = buildKeepoutSpatialIndex(world, laneSegments);
  const chunks = new Map();
  const placements = [];

  const getChunk = (wx, wz) => {
    let bestSec = PERIPHERY_SECTORS[0], bestDist = Infinity;
    for (let i = 0; i < PERIPHERY_SECTORS.length; i++) {
      const s = PERIPHERY_SECTORS[i];
      const d = (wx - s.originX) * (wx - s.originX) + (wz - s.originZ) * (wz - s.originZ);
      if (d < bestDist) { bestDist = d; bestSec = s; }
    }
    let ch = chunks.get(bestSec.key);
    if (!ch) {
      ch = { key: bestSec.key, originX: bestSec.originX, originZ: bestSec.originZ, l0Entries: [], l1Entries: [] };
      chunks.set(bestSec.key, ch);
    }
    return ch;
  };

  let highlandTreesCount = 0, restingaShrubsCount = 0, rockOutcropsCount = 0, seed = 17;

  // 1. SERRA COM MATA ATLÂNTICA & AFLORAMENTOS DE GRANITO (NORTE / NOROESTE / NORDESTE)
  const highlandZones = [
    { minX: ws(-1860), maxX: ws(1860), minZ: ws(-2820), maxZ: ws(-1095) },
    { minX: ws(-3340), maxX: ws(-1895), minZ: ws(-2340), maxZ: ws(620) },
    { minX: ws(1895), maxX: ws(3320), minZ: ws(-2620), maxZ: ws(-665) }
  ];
  const crownColors = [_PALETTE.forestDeep, _PALETTE.forestEmerald, _PALETTE.forestMoss, _PALETTE.forestPine];
  const rockColors = [_PALETTE.graniteDark, _PALETTE.graniteBasalt, _PALETTE.graniteMoss];
  const serraStep = IS_SCALED_WORLD ? 215 : 54;

  for (const zone of highlandZones) {
    for (let gx = zone.minX; gx <= zone.maxX; gx += serraStep) {
      for (let gz = zone.minZ; gz <= zone.maxZ; gz += serraStep) {
        seed++;
        const x = gx + (hash01(seed * 3.1) - 0.5) * serraStep * 0.86;
        const z = gz + (hash01(seed * 7.3) - 0.5) * serraStep * 0.86;
        const groveNoise = 0.52 + 0.32 * Math.sin(x * 0.0017 + 0.8) * Math.cos(z * 0.0019 - 0.4) + 0.22 * Math.sin((x - z) * 0.0033);
        if (groveNoise < 0.28 || !isSafeSpot(x, z, 52)) continue;
        const y = getPangaeaElevationAt(x, z);
        if (y < 1.1) continue;

        const ch = getChunk(x, z), lx = x - ch.originX, lz = z - ch.originZ;
        if (hash01(seed * 11.7) < 0.19 && y >= 1.8) {
          const rxS = 4.2 + hash01(seed * 5.9) * 4.6, ryS = 2.6 + hash01(seed * 9.1) * 3.4, rzS = 3.8 + hash01(seed * 13.3) * 4.2;
          const rotY = hash01(seed * 17.1) * Math.PI * 2, tiltX = (hash01(seed * 19.7) - 0.5) * 0.46, tiltZ = (hash01(seed * 23.3) - 0.5) * 0.46;
          const rCol = rockColors[seed % rockColors.length];
          ch.l0Entries.push(
            { geo: makeFacetedGeo(_ICO_POS, rxS, ryS, rzS, lx, y + ryS * 0.32 - 0.55, lz, rotY, tiltX, tiltZ), color: rCol },
            { geo: makeFacetedGeo(_OCT_POS, rxS * 0.62, ryS * 0.58, rzS * 0.62, lx + rxS * 0.58, y + ryS * 0.18 - 0.5, lz - rzS * 0.35, rotY + 1.1, -tiltX * 0.7, tiltZ), color: rockColors[(seed + 1) % rockColors.length] }
          );
          ch.l1Entries.push({ geo: makeFacetedGeo(_OCT_POS, rxS * 1.05, ryS * 0.95, rzS * 1.05, lx, y + ryS * 0.3 - 0.5, lz, rotY, tiltX, 0), color: rCol });
          rockOutcropsCount++;
          placements.push({ x, y, z, kind: 'rock' });
        } else {
          const scale = 0.88 + hash01(seed * 4.7) * 0.78;
          const trunkH = (4.6 + hash01(seed * 8.3) * 3.2) * scale, trunkR = 0.68 * scale;
          const crownR = (4.8 + hash01(seed * 12.9) * 2.6) * scale, crownH = crownR * (0.74 + hash01(seed * 15.1) * 0.24);
          const rotY = hash01(seed * 21.9) * Math.PI * 2, cCol = crownColors[seed % crownColors.length];
          ch.l0Entries.push(
            { geo: makeFacetedGeo(_TRUNK_POS, trunkR, trunkH + 0.9, trunkR, lx, y + trunkH * 0.5 - 0.45, lz, rotY), color: seed % 2 === 0 ? _PALETTE.barkDark : _PALETTE.barkWarm },
            { geo: makeFacetedGeo(_ICO_POS, crownR, crownH, crownR * 0.94, lx, y + trunkH + crownH * 0.42 - 0.2, lz, rotY), color: cCol }
          );
          if (seed % 2 === 0) {
            const subR = crownR * 0.64;
            ch.l0Entries.push({ geo: makeFacetedGeo(_OCT_POS, subR, crownH * 0.68, subR, lx + crownR * 0.48, y + trunkH + crownH * 0.18, lz - crownR * 0.32, rotY + 0.9), color: crownColors[(seed + 1) % crownColors.length] });
          }
          if (scale >= 1.02) ch.l1Entries.push({ geo: makeFacetedGeo(_OCT_POS, crownR * 1.06, crownH * 1.08, crownR * 1.06, lx, y + trunkH + crownH * 0.36, lz, rotY), color: cCol });
          highlandTreesCount++;
          placements.push({ x, y, z, kind: 'tree' });
        }
      }
    }
  }

  // 2. RESTINGA, COQUEIROS COSTEIROS, DUNAS & MANGUEZAIS (ORLAS NATURAIS)
  const coastalZones = [
    { minX: ws(-3320), maxX: ws(-1560), minZ: ws(695), maxZ: ws(2450), estuary: false },
    { minX: ws(-3180), maxX: ws(2850), minZ: ws(-2860), maxZ: ws(-1360), estuary: true },
    { minX: ws(1680), maxX: ws(3340), minZ: ws(-1850), maxZ: ws(70), estuary: true },
    { minX: ws(-3340), maxX: ws(-2275), minZ: ws(-1320), maxZ: ws(680), estuary: false },
    { minX: ws(820), maxX: ws(2240), minZ: ws(1040), maxZ: ws(2240), estuary: false, isPrisonShore: true }
  ];
  const coastStep = IS_SCALED_WORLD ? 108 : 42;

  for (const czZone of coastalZones) {
    for (let gx = czZone.minX; gx <= czZone.maxX; gx += coastStep) {
      for (let gz = czZone.minZ; gz <= czZone.maxZ; gz += coastStep) {
        seed++;
        const x = gx + (hash01(seed * 5.3) - 0.5) * coastStep * 0.84;
        const z = gz + (hash01(seed * 9.7) - 0.5) * coastStep * 0.84;
        const distCoast = getDistanceToCoastAt(x, z, 165);
        if (distCoast < 18 || distCoast > 145 || !isSafeSpot(x, z, 18)) continue;

        let y = getPangaeaElevationAt(x, z);
        if (czZone.isPrisonShore && pointInPolygon(x, z, PRISON_ISLAND_POLYGON)) y = Math.max(y, 0.3);
        if (y < 0.25 || y > 5.5) continue;

        const ch = getChunk(x, z), lx = x - ch.originX, lz = z - ch.originZ;
        const kindRoll = hash01(seed * 14.3), rotY = hash01(seed * 18.9) * Math.PI * 2;
        if (czZone.estuary && distCoast < 68 && y <= 2.4 && kindRoll < 0.34) {
          const mr = 3.6 + hash01(seed * 6.1) * 1.8;
          for (let r = 0; r < 3; r++) {
            const ang = rotY + (r * Math.PI * 2) / 3;
            ch.l0Entries.push({ geo: makeFacetedGeo(_TRUNK_POS, 0.28, 2.4, 0.28, lx + Math.cos(ang) * 1.2, y + 0.75, lz + Math.sin(ang) * 1.2, ang, 0.42, 0), color: _PALETTE.mangroveRoot });
          }
          ch.l0Entries.push({ geo: makeFacetedGeo(_ICO_POS, mr, mr * 0.56, mr * 0.92, lx, y + 2.15, lz, rotY), color: _PALETTE.mangroveCrown });
          ch.l1Entries.push({ geo: makeFacetedGeo(_OCT_POS, mr * 1.04, mr * 0.58, mr, lx, y + 2.1, lz, rotY), color: _PALETTE.mangroveCrown });
        } else if (kindRoll < 0.24) {
          const pH = 5.4 + hash01(seed * 3.9) * 3.2, lean = 0.18 + hash01(seed * 7.7) * 0.18;
          const topX = Math.sin(lean) * pH * 0.48 * Math.sin(rotY), topZ = Math.sin(lean) * pH * 0.48 * Math.cos(rotY);
          ch.l0Entries.push(
            { geo: makeFacetedGeo(_TRUNK_POS, 0.38, pH + 0.6, 0.38, lx + topX * 0.5, y + pH * 0.46 - 0.25, lz + topZ * 0.5, rotY, lean, 0), color: _PALETTE.palmTrunk },
            { geo: makeFacetedGeo(_OCT_POS, 3.4, 1.35, 3.4, lx + topX, y + pH - 0.15, lz + topZ, rotY, 0.12, -0.1), color: _PALETTE.palmCrown }
          );
          ch.l1Entries.push({ geo: makeFacetedGeo(_OCT_POS, 3.5, 1.5, 3.5, lx + topX, y + pH - 0.2, lz + topZ, rotY), color: _PALETTE.palmCrown });
        } else if (kindRoll < 0.44) {
          const dr = 2.8 + hash01(seed * 8.9) * 2.2;
          ch.l0Entries.push(
            { geo: makeFacetedGeo(_OCT_POS, dr, 0.85, dr * 0.88, lx, y + 0.15, lz, rotY), color: _PALETTE.duneMound },
            { geo: makeFacetedGeo(_OCT_POS, dr * 0.68, 1.25, dr * 0.68, lx, y + 0.82, lz, rotY + 0.6), color: _PALETTE.duneGrass }
          );
        } else {
          const br = 2.5 + hash01(seed * 10.3) * 2.3, bh = 1.2 + hash01(seed * 12.1) * 1.1;
          const bCol = seed % 2 === 0 ? _PALETTE.restingaOlive : _PALETTE.restingaScrub;
          ch.l0Entries.push({ geo: makeFacetedGeo(_ICO_POS, br, bh, br * 0.9, lx, y + bh * 0.42 - 0.25, lz, rotY), color: bCol });
          if (seed % 2 === 0) ch.l1Entries.push({ geo: makeFacetedGeo(_OCT_POS, br * 1.05, bh * 1.05, br, lx, y + bh * 0.4 - 0.2, lz, rotY), color: bCol });
        }
        restingaShrubsCount++;
        placements.push({ x, y, z, kind: 'restinga' });
      }
    }
  }

  // 3. FLUSH DOS SETORES ESPACIAIS THREE.LOD (L0=0m, L1=420m/1250m, L2 VAZIO!)
  const vcMat = getSharedPeripheryStandardVcMaterial();
  let chunkCount = 0;

  for (const ch of chunks.values()) {
    if (ch.l0Entries.length === 0) continue;
    const lod = new THREE.LOD();
    lod.name = `NaturalPeripheryLOD_${ch.key}`;
    lod.position.set(ch.originX, 0, ch.originZ);
    lod.userData = { isNaturalPeriphery: true, isNaturalPeripheryLod: true, chunkKey: ch.key, skipStaticMerge: true };

    const level0 = new THREE.Group();
    const g0 = mergeColoredGeometries(ch.l0Entries);
    g0.computeBoundingBox(); g0.computeBoundingSphere();
    const m0 = new THREE.Mesh(g0, vcMat);
    m0.castShadow = false; m0.receiveShadow = false; m0.matrixAutoUpdate = false; m0.updateMatrix();
    m0.userData.skipStaticMerge = true;
    level0.add(m0);

    const level1 = new THREE.Group();
    if (ch.l1Entries.length > 0) {
      const g1 = mergeColoredGeometries(ch.l1Entries);
      g1.computeBoundingBox(); g1.computeBoundingSphere();
      const m1 = new THREE.Mesh(g1, vcMat);
      m1.castShadow = false; m1.receiveShadow = false; m1.matrixAutoUpdate = false; m1.updateMatrix();
      m1.userData.skipStaticMerge = true;
      level1.add(m1);
    }

    const level2 = new THREE.Group();
    lod.addLevel(level0, 0);
    lod.addLevel(level1, NATURAL_PERIPHERY_LOD1_DIST);
    lod.addLevel(level2, NATURAL_PERIPHERY_LOD2_DIST);
    level0.visible = true; level1.visible = false; level2.visible = false;
    world.scene.add(lod);
    chunkCount++;
  }

  world.naturalPeripheryData = {
    highlandTreesCount,
    restingaShrubsCount,
    rockOutcropsCount,
    ruralLanesCount: builtLanes.length,
    chunkCount,
    placements
  };
  return world.naturalPeripheryData;
}
