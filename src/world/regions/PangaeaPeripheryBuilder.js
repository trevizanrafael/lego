import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { makeFastBox, flushSpatialChunkedBuckets } from '../BuildingGenerator.js';
import {
  isPointOnOrganicLand,
  getDistanceToCoastAt,
  getHighwayDistanceAt,
  getPangaeaElevationAt
} from '../CoastlineProfile.js';
import { getFavelaElevation } from './FavelaCDDBuilder.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';

/**
 * Construtor Modular das Regiões Periféricas e Penínsulas da Pangeia (`PangaeaPeripheryBuilder.js`):
 * Dá continuidade real às construções além dos antigos limites retangulares da ilha:
 *  1) Oeste / Cabo Noroeste: Expansão do Aeroporto & Base Aérea Avançada (Pista 18/36, Taxiways, Hangares, Torre ATC e Baterias SAM)
 *  2) Norte / Platô Boreal: Expansão do Subúrbio Norte, Chalés Serranos, Parada Rodoviária e Vila do Fiorde Boreal
 *  3) Sudoeste / Costa das Dunas: Expansão da Orla Sul, Resorts Costeiros, Quiosques, Pousadas e Vila das Dunas completa
 *  4) Nordeste / Chifre de Tétis: Expansão do Distrito Industrial PCC, Galpões Logísticos, Pátios de Contêineres e Subestações até a Refinaria
 *
 * 100% otimizado em chunks espaciais (origem local por chunk -> zero jitter Float32 e 60 FPS constantes!).
 */
class PeripheryBatcher {
  constructor() {
    this.buckets = new Map();
    this.materials = new Map();
    this._initMaterials();
  }

  _reg(key, hex, opts = {}) {
    this.buckets.set(key, []);
    if (opts.basic) {
      this.materials.set(
        key,
        new THREE.MeshBasicMaterial({
          color: hex,
          polygonOffset: Boolean(opts.polygonOffset),
          polygonOffsetFactor: opts.polygonOffsetFactor ?? 0,
          polygonOffsetUnits: opts.polygonOffsetUnits ?? 0
        })
      );
      return;
    }
    this.materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: opts.roughness ?? 0.62,
        metalness: opts.metalness ?? 0.14,
        emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
        emissiveIntensity: opts.emissiveIntensity ?? 0,
        polygonOffset: Boolean(opts.polygonOffset),
        polygonOffsetFactor: opts.polygonOffsetFactor ?? 0,
        polygonOffsetUnits: opts.polygonOffsetUnits ?? 0
      })
    );
  }

  _initMaterials() {
    this._reg('concrete_pad', 0x262c38, { roughness: 0.78, metalness: 0.06 });
    this._reg('asphalt_tarmac', 0x11151e, { roughness: 0.68, metalness: 0.1 });
    this._reg('steel_dark', 0x1e2533, { roughness: 0.46, metalness: 0.42 });
    this._reg('steel_mid', 0x3b4659, { roughness: 0.48, metalness: 0.36 });
    this._reg('military_olive', 0x293620, { roughness: 0.64, metalness: 0.18 });
    this._reg('military_bunker', 0x333a32, { roughness: 0.74, metalness: 0.12 });
    this._reg('aviation_red', 0x881b1b, { roughness: 0.5, metalness: 0.16 });
    this._reg('aviation_slate', 0x1e3a5f, { roughness: 0.48, metalness: 0.24 });
    this._reg('chalet_brick', 0x5c2216, { roughness: 0.68, metalness: 0.06 });
    this._reg('chalet_wood', 0x452715, { roughness: 0.66, metalness: 0.06 });
    this._reg('chalet_slate', 0x2e3b4e, { roughness: 0.62, metalness: 0.1 });
    this._reg('roof_dark', 0x161922, { roughness: 0.68, metalness: 0.14 });
    this._reg('roof_rust', 0x4a1d14, { roughness: 0.66, metalness: 0.18 });
    this._reg('coastal_stone', 0x56606e, { roughness: 0.58, metalness: 0.1 });
    this._reg('coastal_sandstone', 0x6b5c49, { roughness: 0.64, metalness: 0.06 });
    this._reg('coastal_teal', 0x163d4a, { roughness: 0.48, metalness: 0.22 });
    this._reg('wood_pier', 0x4a2511, { roughness: 0.68, metalness: 0.05 });
    this._reg('pcc_navy', 0x132342, { roughness: 0.5, metalness: 0.28 });
    this._reg('ares_violet', 0x3b175e, { roughness: 0.44, metalness: 0.34 });
    this._reg('container_red', 0x7f1d1d, { roughness: 0.54, metalness: 0.28 });
    this._reg('container_blue', 0x1e3a5f, { roughness: 0.54, metalness: 0.28 });
    this._reg('container_ochre', 0x855312, { roughness: 0.54, metalness: 0.28 });
    this._reg('container_green', 0x163d28, { roughness: 0.54, metalness: 0.28 });
    this._reg('glass_smoked', 0x080d16, { roughness: 0.14, metalness: 0.55 });
    this._reg('win_amber', 0xd97706, {
      roughness: 0.22,
      emissive: 0xd97706,
      emissiveIntensity: 0.65
    });
    this._reg('win_cyan', 0x0891b2, {
      roughness: 0.2,
      emissive: 0x0891b2,
      emissiveIntensity: 0.58
    });
    this._reg('mark_white', 0xcbd5e1, {
      basic: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    });
    this._reg('mark_amber', 0xd99b16, {
      basic: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    });
    this._reg('beacon_red', 0xef4444, { basic: true });
    this._reg('beacon_green', 0x22c55e, { basic: true });
  }

  addBox(key, w, h, d, x, y, z) {
    const arr = this.buckets.get(key);
    if (arr) arr.push(makeFastBox(w, h, d, x, y, z));
  }

  addPitchedRoof(key, w, h, d, x, yBase, z, ridgeAlongX = true) {
    const arr = this.buckets.get(key);
    if (!arr) return;
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
        x + sx * (isTop ? topW : w + 1.2),
        yBase + (sy + 0.5) * h,
        z + sz * (isTop ? topD : d + 1.2)
      );
    }
    const geo = base.toNonIndexed();
    base.dispose();
    geo.computeVertexNormals();
    arr.push(geo);
  }

  addFoundation(w, d, x, ySurf, z, depth = 6.5) {
    this.addBox('concrete_pad', w + 1.2, depth, d + 1.2, x, ySurf - depth * 0.5 + 0.18, z);
  }

  flush(scene) {
    const shadowSet = new Set([
      'steel_dark',
      'steel_mid',
      'military_olive',
      'military_bunker',
      'chalet_brick',
      'chalet_wood',
      'chalet_slate',
      'roof_dark',
      'roof_rust',
      'coastal_stone',
      'coastal_sandstone',
      'coastal_teal',
      'pcc_navy',
      'ares_violet',
      'container_red',
      'container_blue'
    ]);
    flushSpatialChunkedBuckets(scene, this.buckets, this.materials, {
      chunkSize: 640,
      castShadowFn: (k) => shadowSet.has(k),
      receiveShadowFn: (_k, mat) => !mat.isMeshBasicMaterial
    });
  }
}

function isSafePeripheryBuildSpot(x, z, marginCoast = 46, marginHwy = 26) {
  if (!isPointOnOrganicLand(x, z)) return false;
  if (getDistanceToCoastAt(x, z) < marginCoast) return false;
  if (getHighwayDistanceAt(x, z) < marginHwy) return false;
  if (getFavelaElevation(x, z) > 0.15) return false;
  // Protege marcos/spawns oficiais das rodovias
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
    if (Math.hypot(x - protectedPts[i][0], z - protectedPts[i][1]) < 56) return false;
  }
  return true;
}

export function buildPangaeaPeripheryExtensions(world) {
  const b = new PeripheryBatcher();
  let peripheryCount = 0;

  // ==========================================================================
  // 1. PONTA OESTE & CABO NOROESTE — CONTINUAÇÃO DO AEROPORTO & BASE AÉREA
  //    Conecta a Pista 09/27 (X=-1660) até o Cabo Radar (-3180) e Baía Oeste!
  // ==========================================================================
  {
    // 1.1 Taxiways de Concreto ligando X=-1825 até a Pista Auxiliar Oeste (X=-2180)
    for (const tz of [-860, -420]) {
      for (let tx = -1845; tx >= -2160; tx -= 36) {
        if (!isPointOnOrganicLand(tx, tz)) continue;
        const ty = getPangaeaElevationAt(tx, tz);
        b.addFoundation(38, 28, tx, ty, tz, 5.5);
        b.addBox('asphalt_tarmac', 38, 0.28, 26, tx, ty + 0.14, tz);
        b.addBox('mark_amber', 22, 0.05, 0.45, tx, ty + 0.31, tz);
      }
      world.mapRoads.push({ x: -2002, z: tz, w: 356, d: 24, isMain: false });
    }

    // 1.2 Pista Tática Avançada Oeste (Runway 18/36 em X = -2190, Z = -1080..-240 -> 840m!)
    const rwyX = -2190;
    for (let rz = -1060; rz <= -260; rz += 40) {
      if (!isPointOnOrganicLand(rwyX, rz)) continue;
      const ry = getPangaeaElevationAt(rwyX, rz);
      b.addFoundation(64, 42, rwyX, ry, rz, 7.5);
      b.addBox('asphalt_tarmac', 60, 0.32, 41, rwyX, ry + 0.16, rz);
      b.addBox('mark_white', 0.9, 0.05, 18, rwyX, ry + 0.35, rz);
      b.addBox('beacon_green', 0.8, 0.45, 0.8, rwyX - 28, ry + 0.45, rz);
      b.addBox('beacon_red', 0.8, 0.45, 0.8, rwyX + 28, ry + 0.45, rz);
    }
    world.mapRoads.push({ x: rwyX, z: -660, w: 60, d: 840, isMain: true });
    world.mapBuildings.push({
      x: rwyX,
      z: -660,
      w: 60,
      d: 840,
      height: 2,
      color: '#334155',
      label: 'PISTA AUXILIAR 18/36'
    });

    // 1.3 Hangares Militares Avançados & Galpões Aeronáuticos ao longo do Oeste (-1960..-2820)
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
      if (!isSafePeripheryBuildSpot(hg.x, hg.z, 45, 26)) continue;
      const hy = getPangaeaElevationAt(hg.x, hg.z);
      b.addFoundation(hg.w + 8, hg.d + 8, hg.x, hy, hg.z, 8.0);
      const wallKey = hg.mil ? 'military_olive' : 'aviation_slate';
      b.addBox(wallKey, hg.w, hg.h, hg.d, hg.x, hy + hg.h * 0.5, hg.z);
      b.addPitchedRoof('steel_dark', hg.w, 4.4, hg.d, hg.x, hy + hg.h, hg.z, true);
      b.addBox('glass_smoked', hg.w * 0.68, hg.h * 0.58, 0.8, hg.x, hy + hg.h * 0.34, hg.z + hg.d * 0.5 + 0.2);
      b.addBox('aviation_red', hg.w + 0.6, 0.9, hg.d + 0.6, hg.x, hy + hg.h - 0.6, hg.z);
      b.addBox('win_amber', hg.w * 0.5, 1.1, hg.d + 0.5, hg.x, hy + hg.h * 0.78, hg.z);
      world.addCollider(hg.x, hg.z, hg.w, hg.d, hy + hg.h + 4.0, hy - 3.0);
      world.mapBuildings.push({
        x: hg.x,
        z: hg.z,
        w: hg.w,
        d: hg.d,
        height: hg.h,
        color: hg.mil ? '#365314' : '#1e3a5f',
        label: hg.label
      });
      peripheryCount++;
    }

    // 1.4 Torre de Controle Avançada Oeste (74m) + Bunkers SAM Costeiros até a Ponta do Cabo (-3160)
    const atcX = -2095;
    const atcZ = -660;
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
    for (const [bx, bz] of samBunkers) {
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
        label: bz === -340 ? 'GUARNIÇÃO BAÍA OESTE' : null
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

    // 2.1 Bairros de Chalés & Sobrados ao longo da Rodovia Boreal Norte (Z = -1420..-2540) e Transversal (Z = -2150)
    const borealRows = [];
    for (let z = -1440; z >= -2520; z -= 145) {
      borealRows.push([-1310, z], [-1120, z], [-940, z], [-520, z], [-220, z], [120, z], [380, z]);
    }
    for (let x = -2280; x <= -1440; x += 175) {
      borealRows.push([x, -2045], [x, -2255]);
    }

    for (const [hx, hz] of borealRows) {
      cSeed++;
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
        label: hx === 380 && hz === -2020 ? 'VILA DO FIORDE BOREAL' : null
      });
      peripheryCount++;
    }

    // 2.2 Parada Rodoviária & Posto Boreal (-1135, -1760)
    if (isSafePeripheryBuildSpot(-1135, -1760, 50, 30)) {
      const px = -1135;
      const pz = -1760;
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
    // 3.1 Resorts Costeiros & Hotéis Sombrios ao longo do prolongamento Beira-Mar (Z=710) e Costa Sudoeste (X=-2460)
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
      if (!isSafePeripheryBuildSpot(rs.x, rs.z, 52, 30)) continue;
      const ry = getPangaeaElevationAt(rs.x, rs.z);
      b.addFoundation(rs.w + 6, rs.d + 6, rs.x, ry, rs.z, 7.5);
      b.addBox('coastal_stone', rs.w, rs.h * 0.76, rs.d, rs.x, ry + rs.h * 0.38, rs.z);
      b.addBox('coastal_teal', rs.w * 0.78, rs.h * 0.24, rs.d * 0.78, rs.x, ry + rs.h * 0.88, rs.z);
      b.addBox('win_amber', rs.w + 0.4, 1.4, rs.d * 0.72, rs.x, ry + rs.h * 0.28, rs.z);
      b.addBox('win_cyan', rs.w + 0.4, 1.4, rs.d * 0.72, rs.x, ry + rs.h * 0.56, rs.z);
      b.addBox('win_amber', rs.w * 0.78 + 0.4, 1.3, rs.d * 0.58, rs.x, ry + rs.h * 0.88, rs.z);
      world.addCollider(rs.x, rs.z, rs.w, rs.d, ry + rs.h + 2.0, ry - 3.0);
      world.mapBuildings.push({
        x: rs.x,
        z: rs.z,
        w: rs.w,
        d: rs.d,
        height: rs.h,
        color: '#0e7490',
        label: rs.label
      });
      peripheryCount++;
    }

    // 3.2 Casas de Praia, Quiosques & Bangalôs espalhados pela Península Sudoeste (Z = 820..2260)
    const duneVillageSpots = [
      [-1960, 820], [-2160, 840], [-2340, 1180], [-2590, 1060],
      [-2340, 1390], [-2610, 1520], [-2340, 1780], [-2640, 2040],
      [-2350, 2140], [-2520, 2210], [-2740, 2160], [-2880, 1940],
      [-2980, 1680], [-2820, 1360]
    ];
    let dIdx = 0;
    for (const [vx, vz] of duneVillageSpots) {
      dIdx++;
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
      // Eixo Norte PCC (X = 720..1460, Z = -1460..-2280)
      { x: 760, z: -1520, w: 56, d: 38, h: 16, fac: 'pcc', label: 'GALPÃO LOGÍSTICO NORTE (PCC)' },
      { x: 1140, z: -1520, w: 58, d: 40, h: 17, fac: 'pcc', label: null },
      { x: 760, z: -1820, w: 52, d: 38, h: 15, fac: 'pcc', label: null },
      { x: 1140, z: -1820, w: 56, d: 42, h: 18, fac: 'pcc', label: 'ENTREPOSTO DO FIORDE (PCC)' },
      { x: 1420, z: -1680, w: 50, d: 36, h: 15, fac: 'ind', label: null },
      { x: 1420, z: -2020, w: 54, d: 38, h: 16, fac: 'ind', label: null },
      { x: 1780, z: -2020, w: 58, d: 40, h: 17, fac: 'ares', label: 'USINA CIBERNÉTICA A.R.E.S.' },
      { x: 2040, z: -2280, w: 52, d: 38, h: 16, fac: 'ares', label: null },
      // Eixo Leste Rumo ao Parque Eólico & Refinaria de Tétis (X = 1740..3040, Z = -1260..-320)
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
      if (!isSafePeripheryBuildSpot(wh.x, wh.z, 52, 30)) continue;
      const wy = getPangaeaElevationAt(wh.x, wh.z);
      b.addFoundation(wh.w + 10, wh.d + 10, wh.x, wy, wh.z, 8.0);
      const bodyKey = wh.fac === 'pcc' ? 'pcc_navy' : wh.fac === 'ares' ? 'ares_violet' : 'steel_mid';
      b.addBox(bodyKey, wh.w, wh.h, wh.d, wh.x, wy + wh.h * 0.5, wh.z);
      b.addPitchedRoof('steel_dark', wh.w, 3.6, wh.d, wh.x, wy + wh.h, wh.z, true);
      b.addBox(
        wh.fac === 'ares' ? 'win_cyan' : 'win_amber',
        wh.w * 0.72,
        1.3,
        wh.d + 0.4,
        wh.x,
        wy + wh.h * 0.74,
        wh.z
      );

      // Chaminé industrial + Pilha de contêineres anexa ao pátio do galpão
      b.addBox('steel_dark', 2.8, wh.h + 11.0, 2.8, wh.x - wh.w * 0.36, wy + (wh.h + 11.0) * 0.5, wh.z - wh.d * 0.32);
      b.addBox('beacon_red', 1.1, 1.1, 1.1, wh.x - wh.w * 0.36, wy + wh.h + 11.5, wh.z - wh.d * 0.32);

      const cx = wh.x + (wIdx % 2 === 0 ? 1 : -1) * (wh.w * 0.5 + 11.0);
      if (isSafePeripheryBuildSpot(cx, wh.z, 46, 26)) {
        const cy = getPangaeaElevationAt(cx, wh.z);
        b.addFoundation(14, 24, cx, cy, wh.z, 6.0);
        b.addBox(contKeys[wIdx % 4], 6.2, 3.2, 12.5, cx - 3.4, cy + 1.6, wh.z - 4);
        b.addBox(contKeys[(wIdx + 1) % 4], 6.2, 3.2, 12.5, cx + 3.4, cy + 1.6, wh.z - 4);
        b.addBox(contKeys[(wIdx + 2) % 4], 6.2, 3.2, 12.5, cx - 3.4, cy + 4.8, wh.z - 4);
        world.addCollider(cx, wh.z - 4, 13.5, 13.0, cy + 6.5, cy - 2.0);
      }

      world.addCollider(wh.x, wh.z, wh.w, wh.d, wy + wh.h + 3.6, wy - 3.0);
      world.mapBuildings.push({
        x: wh.x,
        z: wh.z,
        w: wh.w,
        d: wh.d,
        height: wh.h,
        color: wh.fac === 'pcc' ? '#1e3a8a' : wh.fac === 'ares' ? '#7e22ce' : '#475569',
        label: wh.label
      });
      peripheryCount++;
    }

    // Placa Tática na entrada da Pista Auxiliar 18/36 Oeste
    const rwySignY = getPangaeaElevationAt(-2140, -1245);
    world.scene.add(
      createSignBoardMesh({
        x: -2140,
        y: rwySignY + 6.2,
        z: -1245,
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
}
