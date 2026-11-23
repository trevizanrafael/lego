import * as THREE from 'three';
import { makeFastBox, mergeColoredGeometries } from '../BuildingGenerator.js';
import {
  isPointOnOrganicLand,
  getDistanceToCoastAt,
  getHighwayDistanceAt,
  getPangaeaElevationAt
} from '../CoastlineProfile.js';
import { getFavelaElevation } from './FavelaCDDBuilder.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';
import { IS_SCALED_WORLD, ws, wsP } from '../core/WorldLayoutScale.js';
import {
  buildNaturalPeriphery,
  getSharedPeripheryStandardVcMaterial,
  getSharedPeripheryBasicVcMaterial
} from '../terrain/NaturalPeripheryBuilder.js';

const PERIPHERY_PALETTE = {
  concrete_pad: { color: new THREE.Color(0x262c38), basic: false },
  asphalt_tarmac: { color: new THREE.Color(0x11151e), basic: false },
  steel_dark: { color: new THREE.Color(0x1e2533), basic: false },
  steel_mid: { color: new THREE.Color(0x3b4659), basic: false },
  military_olive: { color: new THREE.Color(0x293620), basic: false },
  military_bunker: { color: new THREE.Color(0x333a32), basic: false },
  aviation_red: { color: new THREE.Color(0x881b1b), basic: false },
  aviation_slate: { color: new THREE.Color(0x1e3a5f), basic: false },
  chalet_brick: { color: new THREE.Color(0x5c2216), basic: false },
  chalet_wood: { color: new THREE.Color(0x452715), basic: false },
  chalet_slate: { color: new THREE.Color(0x2e3b4e), basic: false },
  roof_dark: { color: new THREE.Color(0x161922), basic: false },
  roof_rust: { color: new THREE.Color(0x4a1d14), basic: false },
  coastal_stone: { color: new THREE.Color(0x56606e), basic: false },
  coastal_sandstone: { color: new THREE.Color(0x6b5c49), basic: false },
  coastal_teal: { color: new THREE.Color(0x163d4a), basic: false },
  wood_pier: { color: new THREE.Color(0x4a2511), basic: false },
  pcc_navy: { color: new THREE.Color(0x132342), basic: false },
  ares_violet: { color: new THREE.Color(0x3b175e), basic: false },
  container_red: { color: new THREE.Color(0x7f1d1d), basic: false },
  container_blue: { color: new THREE.Color(0x1e3a5f), basic: false },
  container_ochre: { color: new THREE.Color(0x855312), basic: false },
  container_green: { color: new THREE.Color(0x163d28), basic: false },
  glass_smoked: { color: new THREE.Color(0x080d16), basic: false },
  win_amber: { color: new THREE.Color(0xd97706), basic: true },
  win_cyan: { color: new THREE.Color(0x0891b2), basic: true },
  mark_white: { color: new THREE.Color(0xcbd5e1), basic: true },
  mark_amber: { color: new THREE.Color(0xd99b16), basic: true },
  beacon_red: { color: new THREE.Color(0xef4444), basic: true },
  beacon_green: { color: new THREE.Color(0x22c55e), basic: true }
};

/**
 * Acumulador Vertex-Color de chunks com origem local (`mesh.position.set(originX, 0, originZ)`)
 * Zero `MeshPhysicalMaterial` e zero materiais duplicados (usa os 2 materiais compartilhados).
 */
class PeripheryBatcher {
  constructor(chunkSize = IS_SCALED_WORLD ? ws(1450) : 960) {
    this.chunkSize = chunkSize;
    this.chunks = new Map();
  }

  _getChunk(wx, wz) {
    const gx = Math.floor(wx / this.chunkSize);
    const gz = Math.floor(wz / this.chunkSize);
    const key = `${gx},${gz}`;
    let ch = this.chunks.get(key);
    if (!ch) {
      ch = {
        key,
        originX: (gx + 0.5) * this.chunkSize,
        originZ: (gz + 0.5) * this.chunkSize,
        pbrEntries: [],
        basicEntries: []
      };
      this.chunks.set(key, ch);
    }
    return ch;
  }

  addBox(key, w, h, d, x, y, z) {
    const spec = PERIPHERY_PALETTE[key];
    if (!spec) return;
    const ch = this._getChunk(x, z);
    const entry = {
      geo: makeFastBox(w, h, d, x - ch.originX, y, z - ch.originZ),
      color: spec.color
    };
    if (spec.basic) ch.basicEntries.push(entry);
    else ch.pbrEntries.push(entry);
  }

  addPitchedRoof(key, w, h, d, x, yBase, z, ridgeAlongX = true) {
    const spec = PERIPHERY_PALETTE[key];
    if (!spec) return;
    const ch = this._getChunk(x, z);
    const lx = x - ch.originX;
    const lz = z - ch.originZ;
    const base = new THREE.BoxGeometry(1, 1, 1);
    const pos = base.attributes.position;
    const topW = ridgeAlongX ? Math.max(0.5, w * 0.92) : 0.22;
    const topD = ridgeAlongX ? 0.22 : Math.max(0.5, d * 0.92);
    for (let i = 0; i < pos.count; i++) {
      const sx = pos.getX(i);
      const sy = pos.getY(i);
      const sz = pos.getZ(i);
      const isTop = sy > 0;
      pos.setXYZ(
        i,
        lx + sx * (isTop ? topW : w + 1.2),
        yBase + (sy + 0.5) * h,
        lz + sz * (isTop ? topD : d + 1.2)
      );
    }
    const geo = base.toNonIndexed();
    base.dispose();
    geo.computeVertexNormals();
    const entry = { geo, color: spec.color };
    if (spec.basic) ch.basicEntries.push(entry);
    else ch.pbrEntries.push(entry);
  }

  addFoundation(w, d, x, ySurf, z, depth = 6.5) {
    this.addBox('concrete_pad', w + 1.2, depth, d + 1.2, x, ySurf - depth * 0.5 + 0.18, z);
  }

  flush(scene) {
    const stdMat = getSharedPeripheryStandardVcMaterial();
    const basicMat = getSharedPeripheryBasicVcMaterial();

    for (const ch of this.chunks.values()) {
      if (ch.pbrEntries.length > 0) {
        const merged = mergeColoredGeometries(ch.pbrEntries);
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, stdMat);
        mesh.name = `PeripheryChunkPBR_${ch.key}`;
        mesh.position.set(ch.originX, 0, ch.originZ);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        if (merged.attributes.position.count > 40000) {
          mesh.userData.skipStaticMerge = true;
        }
        scene.add(mesh);
      }
      if (ch.basicEntries.length > 0) {
        const mergedBasic = mergeColoredGeometries(ch.basicEntries);
        mergedBasic.computeBoundingBox();
        mergedBasic.computeBoundingSphere();
        const basicMesh = new THREE.Mesh(mergedBasic, basicMat);
        basicMesh.name = `PeripheryChunkBasic_${ch.key}`;
        basicMesh.position.set(ch.originX, 0, ch.originZ);
        basicMesh.castShadow = false;
        basicMesh.receiveShadow = false;
        basicMesh.matrixAutoUpdate = false;
        basicMesh.updateMatrix();
        if (mergedBasic.attributes.position.count > 40000) {
          basicMesh.userData.skipStaticMerge = true;
        }
        scene.add(basicMesh);
      }
    }
    this.chunks.clear();
  }
}

function isSafePeripheryBuildSpot(x, z, marginCoast = 46, marginHwy = 26) {
  if (!isPointOnOrganicLand(x, z)) return false;
  if (getDistanceToCoastAt(x, z) < marginCoast) return false;
  if (getHighwayDistanceAt(x, z) < marginHwy) return false;
  if (getFavelaElevation(x, z) > 0.15) return false;
  const protectedPts = [
    [-1215, -2420],
    [-1265, -2420],
    [-2920, -1285],
    [-2920, -1345],
    [2680, -1120],
    [2740, -1120],
    [-2460, 2020],
    [-2520, 2020]
  ];
  for (let i = 0; i < protectedPts.length; i++) {
    if (Math.hypot(x - ws(protectedPts[i][0]), z - ws(protectedPts[i][1])) < 56) return false;
  }
  return true;
}

export function buildPangaeaPeripheryExtensions(world) {
  const b = new PeripheryBatcher();
  let peripheryCount = 0;

  // ==========================================================================
  // 1. PONTA OESTE & CABO NOROESTE — CONTINUAÇÃO DO AEROPORTO & BASE AÉREA
  // ==========================================================================
  {
    const rwyAnchor = wsP(-2190, -660);
    const rwyX = rwyAnchor.x;
    const rwyCenterZ = rwyAnchor.z;

    const taxiZs = IS_SCALED_WORLD ? [rwyCenterZ - 200, rwyCenterZ + 240] : [-860, -420];
    const taxiStartX = ws(-1845);
    const taxiEndX = ws(-2160);
    const taxiSpanW = Math.abs(taxiStartX - taxiEndX) + 41;
    const taxiMidX = (taxiStartX + taxiEndX) * 0.5;
    for (const tz of taxiZs) {
      for (let tx = taxiStartX; tx >= taxiEndX; tx -= 36) {
        if (!isPointOnOrganicLand(tx, tz)) continue;
        const ty = getPangaeaElevationAt(tx, tz);
        b.addFoundation(38, 28, tx, ty, tz, 5.5);
        b.addBox('asphalt_tarmac', 38, 0.28, 26, tx, ty + 0.14, tz);
        b.addBox('mark_amber', 22, 0.05, 0.45, tx, ty + 0.31, tz);
      }
      world.mapRoads.push({ x: taxiMidX, z: tz, w: taxiSpanW, d: 24, isMain: false });
    }

    for (let rz = rwyCenterZ - 400; rz <= rwyCenterZ + 400; rz += 40) {
      if (!isPointOnOrganicLand(rwyX, rz)) continue;
      const ry = getPangaeaElevationAt(rwyX, rz);
      b.addFoundation(64, 42, rwyX, ry, rz, 7.5);
      b.addBox('asphalt_tarmac', 60, 0.32, 41, rwyX, ry + 0.16, rz);
      b.addBox('mark_white', 0.9, 0.05, 18, rwyX, ry + 0.35, rz);
      b.addBox('beacon_green', 0.8, 0.45, 0.8, rwyX - 28, ry + 0.45, rz);
      b.addBox('beacon_red', 0.8, 0.45, 0.8, rwyX + 28, ry + 0.45, rz);
    }
    world.mapRoads.push({ x: rwyX, z: rwyCenterZ, w: 60, d: 840, isMain: true });
    if (!IS_SCALED_WORLD) {
      world.mapBuildings.push({
        x: rwyX,
        z: rwyCenterZ,
        w: 60,
        d: 840,
        height: 2,
        color: '#334155',
        label: 'PISTA AUXILIAR 18/36'
      });
    } else {
      world.mapBlocks.push({
        x: rwyX,
        z: rwyCenterZ,
        w: 68,
        d: 848,
        color: '#334155',
        label: 'PISTA AUXILIAR 18/36'
      });
    }

    const westHangars = [
      { x: -1975, z: -1120, w: 54, d: 42, h: 16, mil: true, label: 'HANGAR ESQUADRÃO OESTE' },
      { x: -1975, z: -985, w: 54, d: 42, h: 16, mil: true, label: null },
      { x: -1975, z: -640, w: 56, d: 44, h: 17, mil: false, label: 'TERMINAL DE CARGA OESTE' },
      { x: -1975, z: -510, w: 56, d: 44, h: 17, mil: false, label: null },
      { x: -2340, z: -1140, w: 52, d: 40, h: 15, mil: true, label: 'ALA AÉREA DO CABO' },
      { x: -2340, z: -980, w: 52, d: 40, h: 15, mil: true, label: null },
      { x: -2640, z: -1165, w: 48, d: 38, h: 14.5, mil: true, label: 'DEPÓSITO TÁTICO NOROESTE' },
      { x: -2780, z: -1165, w: 46, d: 36, h: 14, mil: true, label: null }
    ];

    for (const hg of westHangars) {
      const hp = wsP(hg.x, hg.z);
      if (!isSafePeripheryBuildSpot(hp.x, hp.z, 45, 26)) continue;
      const hy = getPangaeaElevationAt(hp.x, hp.z);
      b.addFoundation(hg.w + 8, hg.d + 8, hp.x, hy, hp.z, 8.0);
      const wallKey = hg.mil ? 'military_olive' : 'aviation_slate';
      b.addBox(wallKey, hg.w, hg.h, hg.d, hp.x, hy + hg.h * 0.5, hp.z);
      b.addPitchedRoof('steel_dark', hg.w, 4.4, hg.d, hp.x, hy + hg.h, hp.z, true);
      b.addBox('glass_smoked', hg.w * 0.68, hg.h * 0.58, 0.8, hp.x, hy + hg.h * 0.34, hp.z + hg.d * 0.5 + 0.2);
      b.addBox('aviation_red', hg.w + 0.6, 0.9, hg.d + 0.6, hp.x, hy + hg.h - 0.6, hp.z);
      b.addBox('win_amber', hg.w * 0.5, 1.1, hg.d + 0.5, hp.x, hy + hg.h * 0.78, hp.z);
      world.addCollider(hp.x, hp.z, hg.w, hg.d, hy + hg.h + 4.0, hy - 3.0);
      world.mapBuildings.push({
        x: hp.x,
        z: hp.z,
        w: hg.w,
        d: hg.d,
        height: hg.h,
        color: hg.mil ? '#365314' : '#1e3a5f',
        label: hg.label
      });
      peripheryCount++;
    }

    const atcPos = wsP(-2095, -660);
    const atcX = atcPos.x;
    const atcZ = atcPos.z;
    if (isSafePeripheryBuildSpot(atcX, atcZ, 45, 24)) {
      const ay = getPangaeaElevationAt(atcX, atcZ);
      b.addFoundation(22, 22, atcX, ay, atcZ, 8.0);
      b.addBox('steel_mid', 14, 58, 14, atcX, ay + 29, atcZ);
      b.addBox('aviation_red', 15.2, 4.0, 15.2, atcX, ay + 48, atcZ);
      b.addBox('steel_dark', 20, 4.2, 20, atcX, ay + 60, atcZ);
      b.addBox('win_cyan', 18.6, 5.6, 18.6, atcX, ay + 64.8, atcZ);
      b.addBox('steel_dark', 21, 2.4, 21, atcX, ay + 68.8, atcZ);
      b.addBox('beacon_red', 1.2, 8.0, 1.2, atcX, ay + 74.0, atcZ);
      world.addCollider(atcX, atcZ, 16, 16, ay + 74, ay - 3);
      world.mapBuildings.push({
        x: atcX,
        z: atcZ,
        w: 20,
        d: 20,
        height: 74,
        color: '#991b1b',
        label: 'TORRE ATC OESTE'
      });
      peripheryCount++;
    }

    const samBunkers = [
      [-2560, -1440],
      [-2820, -1520],
      [-3110, -1180],
      [-2980, -860],
      [-2560, -340],
      [-2360, 180],
      [-2580, 460]
    ];
    for (const [rawBX, rawBZ] of samBunkers) {
      const { x: bx, z: bz } = wsP(rawBX, rawBZ);
      if (!isSafePeripheryBuildSpot(bx, bz, 48, 28)) continue;
      const by = getPangaeaElevationAt(bx, bz);
      b.addFoundation(28, 26, bx, by, bz, 7.5);
      b.addBox('military_bunker', 26, 7.5, 24, bx, by + 3.75, bz);
      b.addBox('steel_dark', 16, 4.2, 16, bx, by + 9.6, bz);
      b.addBox('aviation_red', 4.2, 5.5, 9.5, bx, by + 13.5, bz);
      b.addBox('win_amber', 12, 1.0, 24.4, bx, by + 5.6, bz);
      world.addCollider(bx, bz, 26, 24, by + 15.0, by - 3.0);
      world.mapBuildings.push({
        x: bx,
        z: bz,
        w: 26,
        d: 24,
        height: 15,
        color: '#3f6212',
        label: rawBZ === -340 ? 'GUARNIÇÃO BAÍA OESTE' : null
      });
      peripheryCount++;
    }
  }

  // ==========================================================================
  // 2. PONTA NORTE / PLATÔ BOREAL — CONTINUAÇÃO DO SUBÚRBIO & VILAS SERRANAS
  // ==========================================================================
  {
    const chaletWalls = ['chalet_brick', 'chalet_wood', 'chalet_slate', 'coastal_stone'];
    const chaletRoofs = ['roof_dark', 'roof_rust'];
    let cSeed = 1;

    const borealRows = [];
    for (let z = -1440; z >= -2520; z -= 145) {
      borealRows.push([-1310, z], [-1120, z], [-940, z], [-520, z], [-220, z], [120, z], [380, z]);
    }
    for (let x = -2280; x <= -1440; x += 175) {
      borealRows.push([x, -2045], [x, -2255]);
    }

    for (const [rawHX, rawHZ] of borealRows) {
      cSeed++;
      const { x: hx, z: hz } = wsP(rawHX, rawHZ);
      if (!isSafePeripheryBuildSpot(hx, hz, 54, 32)) continue;
      const hy = getPangaeaElevationAt(hx, hz);
      const hw = 18 + (cSeed % 3) * 4;
      const hd = 15 + (cSeed % 2) * 3;
      const hh = 7.5 + (cSeed % 3) * 2.8;
      const wKey = chaletWalls[cSeed % chaletWalls.length];
      const rKey = chaletRoofs[cSeed % chaletRoofs.length];

      b.addFoundation(hw + 4, hd + 4, hx, hy, hz, 7.0);
      b.addBox(wKey, hw, hh, hd, hx, hy + hh * 0.5, hz);
      b.addPitchedRoof(rKey, hw, 3.8, hd, hx, hy + hh, hz, cSeed % 2 === 0);
      b.addBox('chalet_brick', 1.8, hh + 5.0, 1.8, hx + hw * 0.32, hy + (hh + 5.0) * 0.5, hz);
      b.addBox('win_amber', hw * 0.52, 1.6, hd + 0.35, hx, hy + 2.8, hz);
      if (hh > 9.0) {
        b.addBox('win_amber', hw * 0.46, 1.5, hd + 0.35, hx, hy + 6.8, hz);
      }
      world.addCollider(hx, hz, hw, hd, hy + hh + 3.8, hy - 3.0);
      world.mapBuildings.push({
        x: hx,
        z: hz,
        w: hw,
        d: hd,
        height: hh,
        color: '#57534e',
        label: rawHX === 380 && rawHZ === -2020 ? 'VILA DO FIORDE BOREAL' : null
      });
      peripheryCount++;
    }

    const restPos = wsP(-1135, -1760);
    if (isSafePeripheryBuildSpot(restPos.x, restPos.z, 50, 30)) {
      const px = restPos.x;
      const pz = restPos.z;
      const py = getPangaeaElevationAt(px, pz);
      b.addFoundation(46, 36, px, py, pz, 7.5);
      b.addBox('asphalt_tarmac', 44, 0.25, 34, px, py + 0.12, pz);
      b.addBox('chalet_brick', 26, 8.2, 14, px, py + 4.1, pz - 7);
      b.addPitchedRoof('roof_dark', 26, 3.2, 14, px, py + 8.2, pz - 7, true);
      b.addBox('steel_dark', 28, 0.9, 12, px, py + 7.2, pz + 8);
      b.addBox('win_amber', 20, 1.8, 14.4, px, py + 3.2, pz - 7);
      world.addCollider(px, pz - 7, 26, 14, py + 11.0, py - 3.0);
      world.mapBuildings.push({
        x: px,
        z: pz,
        w: 36,
        d: 28,
        height: 11,
        color: '#9a3412',
        label: 'PARADA RODOVIÁRIA BOREAL'
      });
      peripheryCount++;
    }
  }

  // ==========================================================================
  // 3. PONTA SUDOESTE — CONTINUAÇÃO DA ORLA SUL, RESORTS & VILA DAS DUNAS
  // ==========================================================================
  {
    const swResorts = [
      { x: -1980, z: 635, w: 38, d: 30, h: 48, label: 'HOTEL MIRANTE DO SOL' },
      { x: -2220, z: 635, w: 34, d: 28, h: 42, label: null },
      { x: -2640, z: 635, w: 36, d: 28, h: 38, label: 'RESORT PENÍNSULA OESTE' },
      { x: -2340, z: 980, w: 32, d: 26, h: 34, label: null },
      { x: -2590, z: 1280, w: 32, d: 26, h: 30, label: 'POUSADA COSTA DAS DUNAS' },
      { x: -2340, z: 1580, w: 30, d: 24, h: 26, label: null },
      { x: -2620, z: 1820, w: 34, d: 26, h: 28, label: 'FAROL RESORT SUDOESTE' }
    ];

    for (const rs of swResorts) {
      const rp = wsP(rs.x, rs.z);
      if (!isSafePeripheryBuildSpot(rp.x, rp.z, 52, 30)) continue;
      const ry = getPangaeaElevationAt(rp.x, rp.z);
      b.addFoundation(rs.w + 6, rs.d + 6, rp.x, ry, rp.z, 7.5);
      b.addBox('coastal_stone', rs.w, rs.h * 0.76, rs.d, rp.x, ry + rs.h * 0.38, rp.z);
      b.addBox('coastal_teal', rs.w * 0.78, rs.h * 0.24, rs.d * 0.78, rp.x, ry + rs.h * 0.88, rp.z);
      b.addBox('win_amber', rs.w + 0.4, 1.4, rs.d * 0.72, rp.x, ry + rs.h * 0.28, rp.z);
      b.addBox('win_cyan', rs.w + 0.4, 1.4, rs.d * 0.72, rp.x, ry + rs.h * 0.56, rp.z);
      b.addBox('win_amber', rs.w * 0.78 + 0.4, 1.3, rs.d * 0.58, rp.x, ry + rs.h * 0.88, rp.z);
      world.addCollider(rp.x, rp.z, rs.w, rs.d, ry + rs.h + 2.0, ry - 3.0);
      world.mapBuildings.push({
        x: rp.x,
        z: rp.z,
        w: rs.w,
        d: rs.d,
        height: rs.h,
        color: '#0e7490',
        label: rs.label
      });
      peripheryCount++;
    }

    const duneVillageSpots = [
      [-1960, 820], [-2160, 840], [-2340, 1180], [-2590, 1060],
      [-2340, 1390], [-2610, 1520], [-2340, 1780], [-2640, 2040],
      [-2350, 2140], [-2520, 2210], [-2740, 2160], [-2880, 1940],
      [-2980, 1680], [-2820, 1360]
    ];
    let dIdx = 0;
    for (const [rawVX, rawVZ] of duneVillageSpots) {
      dIdx++;
      const { x: vx, z: vz } = wsP(rawVX, rawVZ);
      if (!isSafePeripheryBuildSpot(vx, vz, 46, 28)) continue;
      const vy = getPangaeaElevationAt(vx, vz);
      const vw = 16 + (dIdx % 3) * 3;
      const vd = 14 + (dIdx % 2) * 3;
      const vh = 6.8 + (dIdx % 2) * 3.2;
      b.addFoundation(vw + 3, vd + 3, vx, vy, vz, 6.0);
      b.addBox(dIdx % 2 === 0 ? 'coastal_sandstone' : 'coastal_stone', vw, vh, vd, vx, vy + vh * 0.5, vz);
      b.addPitchedRoof(dIdx % 3 === 0 ? 'roof_rust' : 'wood_pier', vw, 3.0, vd, vx, vy + vh, vz, true);
      b.addBox('win_amber', vw * 0.55, 1.5, vd + 0.35, vx, vy + 2.6, vz);
      world.addCollider(vx, vz, vw, vd, vy + vh + 3.0, vy - 2.5);
      world.mapBuildings.push({ x: vx, z: vz, w: vw, d: vd, height: vh, color: '#a16207' });
      peripheryCount++;
    }
  }

  // ==========================================================================
  // 4. PONTA NORDESTE & LESTE — CONTINUAÇÃO DO DISTRITO INDUSTRIAL PCC & PORTO
  // ==========================================================================
  {
    const indWarehouses = [
      { x: 760, z: -1520, w: 56, d: 38, h: 16, fac: 'pcc', label: 'GALPÃO LOGÍSTICO NORTE (PCC)' },
      { x: 1140, z: -1520, w: 58, d: 40, h: 17, fac: 'pcc', label: null },
      { x: 760, z: -1820, w: 52, d: 38, h: 15, fac: 'pcc', label: null },
      { x: 1140, z: -1820, w: 56, d: 42, h: 18, fac: 'pcc', label: 'ENTREPOSTO DO FIORDE (PCC)' },
      { x: 1420, z: -1680, w: 50, d: 36, h: 15, fac: 'ind', label: null },
      { x: 1420, z: -2020, w: 54, d: 38, h: 16, fac: 'ind', label: null },
      { x: 1780, z: -2020, w: 58, d: 40, h: 17, fac: 'ares', label: 'USINA CIBERNÉTICA A.R.E.S.' },
      { x: 2040, z: -2280, w: 52, d: 38, h: 16, fac: 'ares', label: null },
      { x: 1820, z: -1060, w: 60, d: 42, h: 18, fac: 'pcc', label: 'TERMINAL DE CARGAS TÉTIS' },
      { x: 1820, z: -740, w: 56, d: 40, h: 16, fac: 'ind', label: null },
      { x: 2120, z: -1060, w: 58, d: 40, h: 17, fac: 'ind', label: null },
      { x: 2120, z: -740, w: 54, d: 38, h: 16, fac: 'ares', label: 'SUBESTAÇÃO DE ENERGIA TÉTIS' },
      { x: 2440, z: -1060, w: 56, d: 40, h: 17, fac: 'ind', label: null },
      { x: 2560, z: -520, w: 52, d: 36, h: 15, fac: 'ind', label: 'DOCA SECA DE TÉTIS' },
      { x: 2940, z: -1020, w: 50, d: 36, h: 16, fac: 'ind', label: 'REFINARIA LESTE — ALA B' },
      { x: 3040, z: -1380, w: 48, d: 34, h: 15, fac: 'ares', label: null }
    ];

    const contKeys = ['container_red', 'container_blue', 'container_ochre', 'container_green'];
    let wIdx = 0;
    for (const wh of indWarehouses) {
      wIdx++;
      const wp = wsP(wh.x, wh.z);
      if (!isSafePeripheryBuildSpot(wp.x, wp.z, 52, 30)) continue;
      const wy = getPangaeaElevationAt(wp.x, wp.z);
      b.addFoundation(wh.w + 10, wh.d + 10, wp.x, wy, wp.z, 8.0);
      const bodyKey = wh.fac === 'pcc' ? 'pcc_navy' : wh.fac === 'ares' ? 'ares_violet' : 'steel_mid';
      b.addBox(bodyKey, wh.w, wh.h, wh.d, wp.x, wy + wh.h * 0.5, wp.z);
      b.addPitchedRoof('steel_dark', wh.w, 3.6, wh.d, wp.x, wy + wh.h, wp.z, true);
      b.addBox(
        wh.fac === 'ares' ? 'win_cyan' : 'win_amber',
        wh.w * 0.72,
        1.3,
        wh.d + 0.4,
        wp.x,
        wy + wh.h * 0.74,
        wp.z
      );

      b.addBox('steel_dark', 2.8, wh.h + 11.0, 2.8, wp.x - wh.w * 0.36, wy + (wh.h + 11.0) * 0.5, wp.z - wh.d * 0.32);
      b.addBox('beacon_red', 1.1, 1.1, 1.1, wp.x - wh.w * 0.36, wy + wh.h + 11.5, wp.z - wh.d * 0.32);

      const cx = wp.x + (wIdx % 2 === 0 ? 1 : -1) * (wh.w * 0.5 + 11.0);
      if (isSafePeripheryBuildSpot(cx, wp.z, 46, 26)) {
        const cy = getPangaeaElevationAt(cx, wp.z);
        b.addFoundation(14, 24, cx, cy, wp.z, 6.0);
        b.addBox(contKeys[wIdx % 4], 6.2, 3.2, 12.5, cx - 3.4, cy + 1.6, wp.z - 4);
        b.addBox(contKeys[(wIdx + 1) % 4], 6.2, 3.2, 12.5, cx + 3.4, cy + 1.6, wp.z - 4);
        b.addBox(contKeys[(wIdx + 2) % 4], 6.2, 3.2, 12.5, cx - 3.4, cy + 4.8, wp.z - 4);
        world.addCollider(cx, wp.z - 4, 13.5, 13.0, cy + 6.5, cy - 2.0);
      }

      world.addCollider(wp.x, wp.z, wh.w, wh.d, wy + wh.h + 3.6, wy - 3.0);
      world.mapBuildings.push({
        x: wp.x,
        z: wp.z,
        w: wh.w,
        d: wh.d,
        height: wh.h,
        color: wh.fac === 'pcc' ? '#1e3a8a' : wh.fac === 'ares' ? '#7e22ce' : '#475569',
        label: wh.label
      });
      peripheryCount++;
    }

    const signPos = wsP(-2140, -1245);
    const rwySignY = getPangaeaElevationAt(signPos.x, signPos.z);
    world.scene.add(
      createSignBoardMesh({
        x: signPos.x,
        y: rwySignY + 6.2,
        z: signPos.z,
        width: 22,
        height: 3.2,
        title: 'BASE AÉREA AVANÇADA // RWY 18-36',
        bgColor: '#07090e',
        borderColor: '#d99b16',
        textColor: '#dce2ec',
        doubleSided: true
      })
    );
  }

  b.flush(world.scene);
  world.pangaeaPeripheryData = { structuresBuilt: peripheryCount };

  // Constrói Serra com Mata Atlântica, Restinga/Mangue e Estradinhas Rurais da Pangeia
  buildNaturalPeriphery(world);
}
