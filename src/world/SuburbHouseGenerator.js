import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../materials/LegoMaterials.js';
import { mergeBufferGeometries, mergeColoredGeometries, makeTranslatedBox, makeFastBox } from './BuildingGenerator.js';
import { localToWorldXZ } from './buildings/LotGeometry2D.js';
import { IS_SCALED_WORLD, ROAD, ws } from './core/WorldLayoutScale.js';

export const HOUSE_STYLE_KEYS = ['american_two_story', 'ranch_l_shape', 'suburb_mansion_pool', 'modern_wood_chalet', 'townhouses'];

export const HOUSE_WALL_PALETTE = [
  { key: 'wall_cream', hex: 0x8a8275, mapColor: '#78716c' }, { key: 'wall_sky_blue', hex: 0x2d3e52, mapColor: '#334155' },
  { key: 'wall_mint', hex: 0x34463c, mapColor: '#365314' }, { key: 'wall_brick', hex: 0x6b2417, mapColor: '#7c2d12' },
  { key: 'wall_white', hex: 0x8d96a3, mapColor: '#94a3b8' }, { key: 'wall_salmon', hex: 0x63322e, mapColor: '#7f1d1d' },
  { key: 'wall_tan', hex: 0x695a49, mapColor: '#57534e' }, { key: 'wall_lightgrey', hex: 0x525c6b, mapColor: '#475569' },
  { key: 'wall_lavender', hex: 0x3b384a, mapColor: '#334155' }, { key: 'wall_amber', hex: 0x6e4e27, mapColor: '#78350f' },
  { key: 'wall_teal', hex: 0x223d42, mapColor: '#155e75' }, { key: 'wall_colonial_red', hex: 0x5c1919, mapColor: '#7f1d1d' }
];

export const HOUSE_ROOF_PALETTE = [
  { key: 'roof_red', hex: 0x4c1616 }, { key: 'roof_brown', hex: 0x2e1a10 }, { key: 'roof_slate', hex: 0x172030 },
  { key: 'roof_graphite', hex: 0x181a20 }, { key: 'roof_green', hex: 0x132a1e }, { key: 'roof_terracotta', hex: 0x522110 }
];

export const SUBURB_MATTE_VC_MAT = markAsSharedAsset(
  new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.62, metalness: 0.08 })
);
export const SUBURB_EMISSIVE_VC_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true })
);

const _FLOWER_TREE_GEO_CACHE = new Map();

function _getSharedFloweringTreeGeo(blossomKey = 'pink') {
  const k = blossomKey === 'pink' ? 'pink' : 'yellow';
  let geo = _FLOWER_TREE_GEO_CACHE.get(k);
  if (!geo) {
    const trunk = new THREE.CylinderGeometry(0.34, 0.44, 2.5, 7);
    trunk.translate(0, 1.25, 0);
    const canopy = new THREE.ConeGeometry(2.2, 3.55, 7);
    canopy.translate(0, 3.68, 0);
    geo = markAsSharedAsset(mergeColoredGeometries([
      { geo: trunk, color: new THREE.Color(LEGO_COLORS.brown) },
      { geo: canopy, color: new THREE.Color(k === 'pink' ? 0x66222c : 0x784819) }
    ]));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    _FLOWER_TREE_GEO_CACHE.set(k, geo);
  }
  return geo;
}

function makeRotatedBoxGeo(w, h, d, rx, ry, rz, cosY, sinY) {
  const geo = makeTranslatedBox(w, h, d, 0, 0, 0);
  const posArr = geo.attributes.position.array, normArr = geo.attributes.normal.array;
  for (let i = 0; i < 72; i += 3) {
    const px = posArr[i], pz = posArr[i + 2], nx = normArr[i], nz = normArr[i + 2];
    posArr[i] = rx + px * cosY + pz * sinY;
    posArr[i + 1] += ry;
    posArr[i + 2] = rz - px * sinY + pz * cosY;
    normArr[i] = nx * cosY + nz * sinY;
    normArr[i + 2] = -nx * sinY + nz * cosY;
  }
  return geo;
}

function _suburbGeoCellKey(geo, chunkX, chunkZ) {
  let cx = 0, cz = 0;
  if (geo.isRawBox) {
    cx = geo.x;
    cz = geo.z;
  } else if (geo.attributes?.position?.count > 0) {
    const arr = geo.attributes.position.array;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < arr.length; i += 3) {
      const vx = arr[i], vz = arr[i + 2];
      if (vx < minX) minX = vx;
      if (vx > maxX) maxX = vx;
      if (vz < minZ) minZ = vz;
      if (vz > maxZ) maxZ = vz;
    }
    cx = (minX + maxX) * 0.5;
    cz = (minZ + maxZ) * 0.5;
  }
  const ox = IS_SCALED_WORLD ? -1960 : -680, oz = IS_SCALED_WORLD ? -3960 : -1360;
  return `${Math.floor((cx - ox) / chunkX)},${Math.floor((cz - oz) / chunkZ)}`;
}

const EXTRA_DESCRIPTORS = [
  ['trim_white', 0x9aa4b2, 'building'], ['wood_warm', 0x4a2511, 'building'],
  ['stone_grey', 0x3b424f, 'building'], ['chimney_brick', 0x4c1814, 'building'],
  ['charcoal_metal', 0x141821, 'building'], ['window_glass', 0x0b1524, 'building'],
  ['shutter_blue', 0x17253b, 'building'], ['shutter_green', 0x142b1e, 'building'],
  ['hedge_green', 0x12261a, 'building'], ['flower_red', 0x7f1d1d, 'building'],
  ['flower_yellow', 0xb45309, 'building'], ['flower_pink', 0x6b2137, 'building'],
  ['lawn_green', 0x1b3624, 'ground'], ['driveway_concrete', 0x383f4d, 'ground'],
  ['walkway_stone', 0x4b5260, 'ground'], ['asphalt_lot', 0x11151d, 'ground'],
  ['pool_water', 0x0c4a6e, 'ground'], ['court_orange', 0x7c2d12, 'ground'],
  ['court_blue', 0x1e3a5f, 'ground'], ['stripe_white', 0xa8b2c0, 'ground'],
  ['window_warm', 0xf5b942, 'emissive'], ['neon_pink', 0xbe123c, 'emissive'],
  ['neon_cyan', 0x0891b2, 'emissive'], ['gold_accent', 0xb47b12, 'emissive']
];

export class SuburbBatcher {
  constructor() {
    this.buckets = new Map();
    this.descriptors = new Map();
    this.floweringTrees = [];
    this._txActive = false;
    this._pivotX = 0;
    this._pivotZ = 0;
    this._rotY = 0;
    this._cosY = 1;
    this._sinY = 0;
    this._worldRef = null;
    this._baseCenterY = 0;
    for (const w of HOUSE_WALL_PALETTE) this._reg(w.key, w.hex, 'building');
    for (const r of HOUSE_ROOF_PALETTE) this._reg(r.key, r.hex, 'building');
    for (const [k, hex, kind] of EXTRA_DESCRIPTORS) this._reg(k, hex, kind);
  }

  _reg(key, colorHex, kind = 'building') {
    this.buckets.set(key, []);
    this.descriptors.set(key, { color: new THREE.Color(colorHex), kind });
  }

  setTransform(pivotX, pivotZ, rotY = 0, world = null, baseCenterY = 0) {
    if (Math.abs(rotY) <= 1e-4) return this.clearTransform();
    this._txActive = true;
    this._pivotX = pivotX;
    this._pivotZ = pivotZ;
    this._rotY = rotY;
    this._cosY = Math.cos(rotY);
    this._sinY = Math.sin(rotY);
    this._worldRef = world;
    this._baseCenterY = baseCenterY;
  }

  clearTransform() {
    this._txActive = false;
    this._rotY = 0;
    this._cosY = 1;
    this._sinY = 0;
    this._worldRef = null;
  }

  toWorld(wx, wy, wz) {
    if (!this._txActive) return { x: wx, y: wy, z: wz };
    const p = localToWorldXZ(this._pivotX, this._pivotZ, wx - this._pivotX, wz - this._pivotZ, this._cosY, this._sinY);
    const tY = this._worldRef?.getTerrainHeightAt ? this._worldRef.getTerrainHeightAt(p.x, p.z) : this._baseCenterY;
    return { x: p.x, y: tY + (wy - this._baseCenterY), z: p.z };
  }

  addBox(matKey, w, h, d, x, y, z) {
    const bucket = this.buckets.get(matKey);
    if (!bucket) return;
    if (!this._txActive) {
      bucket.push(makeFastBox(w, h, d, x, y, z));
      return;
    }
    const wp = this.toWorld(x, y, z);
    bucket.push(makeRotatedBoxGeo(w, h, d, wp.x, wp.y, wp.z, this._cosY, this._sinY));
  }

  addCustomGeo(matKey, geo) {
    const bucket = this.buckets.get(matKey);
    if (!bucket) return geo.dispose();
    if (this._txActive && geo.attributes?.position) {
      const pos = geo.attributes.position;
      let sumX = 0, sumZ = 0;
      for (let i = 0; i < pos.count; i++) {
        sumX += pos.getX(i);
        sumZ += pos.getZ(i);
      }
      const cx = pos.count > 0 ? sumX / pos.count : this._pivotX, cz = pos.count > 0 ? sumZ / pos.count : this._pivotZ;
      const cp = localToWorldXZ(this._pivotX, this._pivotZ, cx - this._pivotX, cz - this._pivotZ, this._cosY, this._sinY);
      const dy = (this._worldRef?.getTerrainHeightAt ? this._worldRef.getTerrainHeightAt(cp.x, cp.z) : this._baseCenterY) - this._baseCenterY;
      for (let i = 0; i < pos.count; i++) {
        const rp = localToWorldXZ(this._pivotX, this._pivotZ, pos.getX(i) - this._pivotX, pos.getZ(i) - this._pivotZ, this._cosY, this._sinY);
        pos.setXYZ(i, rp.x, pos.getY(i) + dy, rp.z);
      }
      const norm = geo.attributes.normal;
      if (norm) {
        for (let i = 0; i < norm.count; i++) {
          const nx = norm.getX(i), nz = norm.getZ(i);
          norm.setXYZ(i, nx * this._cosY + nz * this._sinY, norm.getY(i), -nx * this._sinY + nz * this._cosY);
        }
      } else geo.computeVertexNormals();
    }
    bucket.push(geo);
  }

  addFloweringTree(x, y, z, scale = 1.0, blossomKey = 'pink') {
    const wp = this.toWorld(x, y, z);
    this.floweringTrees.push({ x: wp.x, y: wp.y, z: wp.z, scale, blossomKey: blossomKey === 'pink' ? 'pink' : 'yellow' });
  }

  flush(scene) {
    const chunkX = IS_SCALED_WORLD ? 1200 : 680, chunkZ = IS_SCALED_WORLD ? 1230 : 680;
    const cells = new Map();
    for (const [key, geos] of this.buckets.entries()) {
      if (!geos?.length) continue;
      const desc = this.descriptors.get(key);
      if (!desc) continue;
      for (let i = 0; i < geos.length; i++) {
        const g = geos[i], cKey = _suburbGeoCellKey(g, chunkX, chunkZ);
        let cell = cells.get(cKey);
        if (!cell) {
          cell = { building: [], ground: [], emissive: [] };
          cells.set(cKey, cell);
        }
        cell[desc.kind].push({ geo: g, color: desc.color });
      }
      geos.length = 0;
    }

    const emitMergedChunk = (entries, mat, castShadow, receiveShadow, tag) => {
      if (!entries.length) return;
      const mergedGeo = mergeColoredGeometries(entries);
      mergedGeo.computeBoundingBox();
      mergedGeo.computeBoundingSphere();
      const mesh = new THREE.Mesh(mergedGeo, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.userData.isSuburbBatchChunk = true;
      mesh.userData.skipStaticMerge = true;
      mesh.userData.suburbLayer = tag;
      scene.add(mesh);
    };

    for (const cell of cells.values()) {
      emitMergedChunk(cell.building, SUBURB_MATTE_VC_MAT, true, true, 'buildings');
      emitMergedChunk(cell.ground, SUBURB_MATTE_VC_MAT, false, true, 'ground');
      emitMergedChunk(cell.emissive, SUBURB_EMISSIVE_VC_MAT, false, false, 'emissive');
    }

    if (this.floweringTrees.length > 0) {
      const tChunkX = IS_SCALED_WORLD ? 1200 : 720, tChunkZ = IS_SCALED_WORLD ? 1230 : 720;
      const ox = IS_SCALED_WORLD ? -1960 : -720, oz = IS_SCALED_WORLD ? -3960 : -1440;
      const treeCells = new Map();
      for (let i = 0; i < this.floweringTrees.length; i++) {
        const t = this.floweringTrees[i];
        const k = `${t.blossomKey}|${Math.floor((t.x - ox) / tChunkX)},${Math.floor((t.z - oz) / tChunkZ)}`;
        let list = treeCells.get(k);
        if (!list) {
          list = [];
          treeCells.set(k, list);
        }
        list.push(t);
      }

      const dummy = new THREE.Object3D();
      for (const [key, list] of treeCells.entries()) {
        if (!list.length) continue;
        const inst = new THREE.InstancedMesh(_getSharedFloweringTreeGeo(key.startsWith('pink') ? 'pink' : 'yellow'), SUBURB_MATTE_VC_MAT, list.length);
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.matrixAutoUpdate = false;
        inst.userData.isSuburbBatchChunk = true;
        inst.userData.skipStaticMerge = true;
        inst.userData.suburbLayer = 'trees';
        for (let i = 0; i < list.length; i++) {
          dummy.position.set(list[i].x, list[i].y, list[i].z);
          dummy.scale.setScalar(list[i].scale);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        inst.updateMatrix();
        inst.computeBoundingBox();
        inst.computeBoundingSphere();
        scene.add(inst);
      }
      this.floweringTrees.length = 0;
    }
  }
}

export function addPitchedGableRoof(batcher, roofKey, x, yTop, z, w, d, roofHeight = 3.2, ridgeAlongX = true, overhang = 1.45) {
  const base = new THREE.BoxGeometry(1, 1, 1);
  const pos = base.attributes.position, botW = w + overhang, botD = d + overhang;
  const topW = ridgeAlongX ? Math.max(0.4, w + overhang * 0.45) : 0.18;
  const topD = ridgeAlongX ? 0.18 : Math.max(0.4, d + overhang * 0.45);
  for (let i = 0; i < pos.count; i++) {
    const isTop = pos.getY(i) > 0;
    pos.setXYZ(i, x + pos.getX(i) * (isTop ? topW : botW), yTop + 0.22 + (pos.getY(i) + 0.5) * roofHeight, z + pos.getZ(i) * (isTop ? topD : botD));
  }
  const prismGeo = base.toNonIndexed();
  base.dispose();
  prismGeo.computeVertexNormals();
  batcher.addCustomGeo(roofKey, prismGeo);
  batcher.addBox('charcoal_metal', w + overhang + 0.14, 0.24, d + overhang + 0.14, x, yTop + 0.12, z);
}

function addFramedWindow(batcher, x, y, z, w, h, facingDirZ, shutterKey = 'shutter_blue', warm = true) {
  const zOff = facingDirZ * 0.14;
  batcher.addBox('trim_white', w + 0.32, h + 0.32, 0.22, x, y, z + zOff);
  batcher.addBox(warm ? 'window_warm' : 'window_glass', w, h, 0.26, x, y, z + zOff * 1.15);
  if (shutterKey) {
    const sw = Math.min(0.34, w * 0.18);
    batcher.addBox(shutterKey, sw, h + 0.08, 0.26, x - w * 0.5 - sw * 0.65, y, z + zOff * 1.1);
    batcher.addBox(shutterKey, sw, h + 0.08, 0.26, x + w * 0.5 + sw * 0.65, y, z + zOff * 1.1);
  }
}

function addGarageDoor(batcher, x, yBase, z, w, h, facingDirZ, isWood = false) {
  const zOff = facingDirZ * 0.14;
  batcher.addBox('trim_white', w + 0.44, h + 0.28, 0.24, x, yBase + h * 0.5, z + zOff);
  batcher.addBox(isWood ? 'wood_warm' : 'wall_lightgrey', w, h, 0.28, x, yBase + h * 0.5, z + zOff * 1.15);
  for (let py = 0.85; py < h - 0.3; py += 0.95) batcher.addBox('trim_white', w - 0.28, 0.11, 0.32, x, yBase + py, z + zOff * 1.25);
}

export function buildDetailedHouse(world, batcher, cfg) {
  const { x, z, lotW = 28, lotD = 44, facingDirZ = 1, rotY = 0, styleKey = 'american_two_story', seed = 1 } = cfg;
  const sAbs = Math.abs(seed | 0);
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = baseY + (IS_SCALED_WORLD ? (cfg.padOffsetY ?? 0.06) : 0.30);
  const hasRot = Math.abs(rotY) > 1e-4, hasColliderRot = Math.abs(rotY) > 1e-3;
  const cosY = hasRot ? Math.cos(rotY) : 1, sinY = hasRot ? Math.sin(rotY) : 0;
  const isCompact = IS_SCALED_WORLD && lotW <= 23.5;
  const roofOverhang = isCompact ? 0.95 : 1.45;
  const availW = IS_SCALED_WORLD ? Math.max(9.5, lotW - 2.2) : lotW - 4.0;

  if (hasRot) batcher.setTransform(x, z, rotY, world, baseY);

  const registerFootprint = (cx, cz, cw, cd, maxY, minY, mapZ, mapW, mapD, mapH, mapColor, label) => {
    if (hasColliderRot) {
      const rc = localToWorldXZ(x, z, cx - x, cz - z, cosY, sinY);
      const rm = localToWorldXZ(x, z, cx - x, mapZ - z, cosY, sinY);
      const dy = (world.getTerrainHeightAt ? world.getTerrainHeightAt(rc.x, rc.z) : baseY) - baseY;
      if (typeof world.addObbCollider === 'function') world.addObbCollider(rc.x, rc.z, cw, cd, rotY, maxY + dy, minY + dy);
      else world.addCollider(rc.x, rc.z, cw, cd, maxY + dy, minY + dy);
      const entry = { x: rm.x, z: rm.z, w: mapW, d: mapD, rotY, height: mapH, color: mapColor };
      if (label) entry.label = label;
      world.mapBuildings.push(entry);
      return;
    }
    world.addCollider(cx, cz, cw, cd, maxY, minY);
    const entry = { x: cx, z: mapZ, w: mapW, d: mapD, height: mapH, color: mapColor };
    if (label) entry.label = label;
    world.mapBuildings.push(entry);
  };

  try {
    if (IS_SCALED_WORLD) {
      if (baseY > 0.25 || hasRot) batcher.addBox('stone_grey', lotW - 0.16, 3.0, lotD - 0.16, x, baseY - 1.48, z);
      batcher.addBox('lawn_green', lotW - 0.12, 0.06, lotD - 0.12, x, yBase - 0.01, z);
    } else if (baseY > 0.15) {
      batcher.addBox('stone_grey', lotW - 0.3, 2.4, lotD - 0.3, x, baseY - 0.92, z);
      batcher.addBox('lawn_green', lotW - 0.2, 0.1, lotD - 0.2, x, baseY + 0.28, z);
    }

    const wallEntry = HOUSE_WALL_PALETTE[(sAbs * 7 + Math.floor(Math.random() * HOUSE_WALL_PALETTE.length)) % HOUSE_WALL_PALETTE.length];
    const roofEntry = HOUSE_ROOF_PALETTE[(sAbs * 5 + Math.floor(Math.random() * HOUSE_ROOF_PALETTE.length)) % HOUSE_ROOF_PALETTE.length];
    const shutterKey = sAbs % 2 === 0 ? 'shutter_blue' : 'shutter_green';

    const frontEdgeZ = z + facingDirZ * (lotD * 0.5), backEdgeZ = z - facingDirZ * (lotD * 0.5);
    const frontGap = IS_SCALED_WORLD ? 4.9 + (sAbs % 4) * 0.45 : 0;
    const legacySetback = Math.min(9.6, lotD * 0.36);
    let driveSideX = x + lotW * 0.22, houseRearZ = z;

    const addDrivewayStrip = (driveX, driveW, startZ, reach1x = 3.8) => {
      driveSideX = driveX;
      if (!IS_SCALED_WORLD) {
        batcher.addBox('driveway_concrete', driveW, 0.08, Math.abs(frontEdgeZ - startZ) + reach1x + 0.2, driveX, yBase + 0.02, (frontEdgeZ + facingDirZ * reach1x + startZ) * 0.5);
        return;
      }
      batcher.addBox('driveway_concrete', driveW, 0.07, Math.abs(frontEdgeZ - startZ) + 0.2, driveX, yBase + 0.055, (frontEdgeZ + startZ) * 0.5);
      const apronLen = cfg.apronLen ?? Math.max(1.0, ROAD.sidewalk - 0.6);
      if (apronLen > 0.2) {
        const apronMidZ = frontEdgeZ + facingDirZ * (apronLen * 0.5);
        const apronY = hasRot ? baseY + 0.055 : (world.getTerrainHeightAt ? world.getTerrainHeightAt(driveX, apronMidZ) : baseY) + 0.03;
        batcher.addBox('driveway_concrete', driveW, 0.05, apronLen, driveX, apronY, apronMidZ);
      }
    };

    if (styleKey === 'american_two_story') {
      const totW = IS_SCALED_WORLD ? Math.min(20.5, availW) : Math.min(23.5, lotW * 0.86);
      const mainW = IS_SCALED_WORLD ? totW * 0.58 : Math.min(14, lotW * 0.52);
      const garW = IS_SCALED_WORLD ? totW - mainW + 0.35 : Math.min(9.5, lotW * 0.34);
      const mainD = IS_SCALED_WORLD ? Math.min(11.6, lotD * 0.40) : 13.0, garD = IS_SCALED_WORLD ? Math.min(9.6, mainD - 1.4) : 10.5;
      const mainH = 9.0, garH = 4.7;
      const mainX = IS_SCALED_WORLD ? x - totW * 0.5 + mainW * 0.5 : x - garW * 0.45;
      const garX = IS_SCALED_WORLD ? x + totW * 0.5 - garW * 0.5 : x + mainW * 0.52;
      const houseZ = IS_SCALED_WORLD ? frontEdgeZ - facingDirZ * (frontGap + mainD * 0.5) : frontEdgeZ - facingDirZ * legacySetback;
      houseRearZ = houseZ - facingDirZ * (mainD * 0.5);

      batcher.addBox(wallEntry.key, mainW, mainH, mainD, mainX, yBase + mainH * 0.5, houseZ);
      addPitchedGableRoof(batcher, roofEntry.key, mainX, yBase + mainH, houseZ, mainW, mainD, 3.2, true, roofOverhang);
      batcher.addBox('chimney_brick', 1.3, 4.2, 1.3, mainX - mainW * 0.32, yBase + mainH + 2.0, houseZ - facingDirZ * 1.8);

      const garZ = houseZ + facingDirZ * ((mainD - garD) * 0.5 + 0.4), garDoorZ = garZ + facingDirZ * (garD * 0.5);
      batcher.addBox(wallEntry.key, garW, garH, garD, garX, yBase + garH * 0.5, garZ);
      addPitchedGableRoof(batcher, roofEntry.key, garX, yBase + garH, garZ, garW, garD, 1.9, true, roofOverhang * 0.85);
      addGarageDoor(batcher, garX, yBase, garDoorZ, Math.max(3.6, garW - 1.3), 3.5, facingDirZ, sAbs % 2 === 0);
      addDrivewayStrip(garX, Math.max(3.6, garW - 0.9), garDoorZ, 4.0);

      const porchD = isCompact ? 1.8 : 2.6, porchZ = houseZ + facingDirZ * (mainD * 0.5 + porchD * 0.5);
      batcher.addBox('walkway_stone', mainW - 0.8, 0.36, porchD, mainX, yBase + 0.18, porchZ);
      batcher.addBox(roofEntry.key, mainW - 0.5, 0.42, porchD + 0.3, mainX, yBase + 4.0, porchZ);
      for (const px of [mainX - mainW * 0.38, mainX + mainW * 0.38]) batcher.addBox('trim_white', 0.36, 3.7, 0.36, px, yBase + 1.95, porchZ + facingDirZ * (porchD * 0.38));

      const fZ = houseZ + facingDirZ * (mainD * 0.5), doorX = mainX - mainW * 0.22, winW = Math.min(2.2, mainW * 0.24);
      batcher.addBox('wood_warm', 1.45, 2.85, 0.28, doorX, yBase + 1.45, fZ + facingDirZ * 0.12);
      addFramedWindow(batcher, mainX + mainW * 0.22, yBase + 2.2, fZ, winW, 1.75, facingDirZ, shutterKey, true);
      addFramedWindow(batcher, mainX - mainW * 0.23, yBase + 6.3, fZ, winW * 0.92, 1.65, facingDirZ, shutterKey, false);
      addFramedWindow(batcher, mainX + mainW * 0.23, yBase + 6.3, fZ, winW * 0.92, 1.65, facingDirZ, shutterKey, true);
      batcher.addBox('walkway_stone', 1.5, 0.08, Math.abs(frontEdgeZ - porchZ), doorX, yBase + 0.065, (frontEdgeZ + porchZ) * 0.5);

      registerFootprint(x, houseZ, totW, mainD, yBase + mainH + 3.0, yBase, houseZ, totW, mainD, mainH, wallEntry.mapColor);
    } else if (styleKey === 'ranch_l_shape') {
      const wingW = IS_SCALED_WORLD ? Math.min(18.8, availW) : Math.min(22, lotW - 4);
      const wingD = IS_SCALED_WORLD ? Math.min(9.6, lotD * 0.34) : 10.5, wingH = 5.3;
      const fwdW = Math.max(5.2, wingW * 0.44), fwdD = IS_SCALED_WORLD ? 4.2 : 8.5, garX = x - wingW * 0.5 + fwdW * 0.5;
      const mainZ = IS_SCALED_WORLD ? frontEdgeZ - facingDirZ * (frontGap + (fwdD - 0.8) + wingD * 0.5) : (frontEdgeZ - facingDirZ * legacySetback) - facingDirZ * 1.5;
      const fwdZ = mainZ + facingDirZ * ((wingD + fwdD) * 0.5 - 0.8);
      houseRearZ = mainZ - facingDirZ * (wingD * 0.5);

      batcher.addBox(wallEntry.key, wingW, wingH, wingD, x, yBase + wingH * 0.5, mainZ);
      addPitchedGableRoof(batcher, roofEntry.key, x, yBase + wingH, mainZ, wingW, wingD, 2.4, true, roofOverhang);
      batcher.addBox(wallEntry.key, fwdW, wingH, fwdD, garX, yBase + wingH * 0.5, fwdZ);
      addPitchedGableRoof(batcher, roofEntry.key, garX, yBase + wingH, fwdZ, fwdW, fwdD, 2.2, false, roofOverhang * 0.85);

      const garFrontZ = fwdZ + facingDirZ * (fwdD * 0.5);
      addGarageDoor(batcher, garX, yBase, garFrontZ, Math.max(3.6, fwdW - 1.3), 3.5, facingDirZ, sAbs % 3 === 0);
      addDrivewayStrip(garX, Math.max(3.6, fwdW - 0.9), garFrontZ, 3.8);

      const rightSpan = wingW - fwdW, rightStart = x - wingW * 0.5 + fwdW;
      const doorX = rightStart + rightSpan * 0.24, winX = rightStart + rightSpan * 0.66, fZ = mainZ + facingDirZ * (wingD * 0.5);
      addFramedWindow(batcher, winX, yBase + 2.55, fZ, Math.min(3.2, rightSpan * 0.42), 1.9, facingDirZ, shutterKey, true);
      batcher.addBox('wood_warm', 1.45, 2.85, 0.28, doorX, yBase + 1.45, fZ + facingDirZ * 0.12);
      batcher.addBox('walkway_stone', 1.55, 0.08, Math.abs(frontEdgeZ - fZ), doorX, yBase + 0.065, (frontEdgeZ + fZ) * 0.5);
      batcher.addBox('hedge_green', Math.min(3.6, rightSpan * 0.52), 0.55, 0.9, winX, yBase + 0.28, fZ + facingDirZ * 0.62);

      registerFootprint(x, (mainZ + fwdZ) * 0.5, wingW, wingD + fwdD * 0.55, yBase + wingH + 2.4, yBase, mainZ, wingW, wingD, wingH, wallEntry.mapColor);
    } else if (styleKey === 'suburb_mansion_pool') {
      const manW = IS_SCALED_WORLD ? Math.min(19.5, availW) : Math.min(22, lotW - 5);
      const manD = IS_SCALED_WORLD ? Math.min(11.8, lotD * 0.40) : 14.0, manH = 10.0;
      const houseZ = IS_SCALED_WORLD ? frontEdgeZ - facingDirZ * (frontGap + manD * 0.5) : frontEdgeZ - facingDirZ * legacySetback;
      houseRearZ = houseZ - facingDirZ * (manD * 0.5);

      batcher.addBox(wallEntry.key, manW, manH, manD, x, yBase + manH * 0.5, houseZ);
      addPitchedGableRoof(batcher, roofEntry.key, x, yBase + manH, houseZ, manW, manD, 3.2, true, roofOverhang);

      const fZ = houseZ + facingDirZ * (manD * 0.5), portW = Math.min(6.4, manW * 0.40), portD = isCompact ? 1.85 : 2.8;
      batcher.addBox('trim_white', portW, 0.42, portD, x, yBase + 5.1, fZ + facingDirZ * (portD * 0.48));
      batcher.addBox('trim_white', portW - 0.2, 0.78, 0.24, x, yBase + 5.65, fZ + facingDirZ * (portD * 0.92));
      for (const cx of [x - portW * 0.38, x + portW * 0.38]) batcher.addBox('trim_white', 0.48, 4.9, 0.48, cx, yBase + 2.45, fZ + facingDirZ * (portD * 0.84));

      const wOff = manW * 0.31, winW = Math.min(2.8, manW * 0.17);
      batcher.addBox('wood_warm', 1.9, 3.2, 0.28, x, yBase + 1.6, fZ + facingDirZ * 0.14);
      addFramedWindow(batcher, x - wOff, yBase + 2.55, fZ, winW, 2.05, facingDirZ, shutterKey, true);
      addFramedWindow(batcher, x + wOff, yBase + 2.55, fZ, winW, 2.05, facingDirZ, shutterKey, true);
      addFramedWindow(batcher, x - wOff, yBase + 7.2, fZ, winW * 0.94, 1.9, facingDirZ, shutterKey, false);
      addFramedWindow(batcher, x, yBase + 7.2, fZ, Math.min(3.0, portW * 0.55), 2.0, facingDirZ, null, true);
      addFramedWindow(batcher, x + wOff, yBase + 7.2, fZ, winW * 0.94, 1.9, facingDirZ, shutterKey, false);

      const drvW = Math.min(4.6, lotW * 0.26);
      addDrivewayStrip(x + manW * 0.5 - drvW * 0.5, drvW, fZ, 3.8);
      batcher.addBox('walkway_stone', 2.2, 0.08, Math.abs(frontEdgeZ - fZ), x, yBase + 0.065, (frontEdgeZ + fZ) * 0.5);

      registerFootprint(x, houseZ, manW, manD, yBase + manH + 3.2, yBase, houseZ, manW, manD, manH, wallEntry.mapColor, isCompact ? undefined : 'MANSÃO');
    } else if (styleKey === 'modern_wood_chalet') {
      const chW = IS_SCALED_WORLD ? Math.min(16.8, lotW - 2.6) : Math.min(17, lotW - 5);
      const chD = IS_SCALED_WORLD ? Math.min(11.2, lotD * 0.38) : 12.5, chH = 8.4;
      const houseZ = IS_SCALED_WORLD ? frontEdgeZ - facingDirZ * (frontGap + chD * 0.5) : frontEdgeZ - facingDirZ * legacySetback;
      houseRearZ = houseZ - facingDirZ * (chD * 0.5);

      batcher.addBox('stone_grey', chW, 3.7, chD, x, yBase + 1.85, houseZ);
      batcher.addBox(wallEntry.key, chW - 0.5, chH - 3.7, chD - 0.5, x, yBase + 3.7 + (chH - 3.7) * 0.5, houseZ);
      addPitchedGableRoof(batcher, roofEntry.key, x, yBase + chH, houseZ, chW + 0.2, chD + 0.4, 3.9, false, roofOverhang);
      batcher.addBox('stone_grey', 1.6, chH + 4.4, 1.6, x + chW * 0.35, yBase + (chH + 4.4) * 0.5, houseZ);

      const fZ = houseZ + facingDirZ * (chD * 0.5), garDoorW = Math.min(5.6, chW * 0.38), garCX = x + chW * 0.25, deckCX = x - chW * 0.22;
      batcher.addBox('wood_warm', chW * 0.48, 0.32, isCompact ? 2.0 : 3.0, deckCX, yBase + 0.16, fZ + facingDirZ * (isCompact ? 1.0 : 1.5));
      addGarageDoor(batcher, garCX, yBase, fZ, garDoorW, 3.35, facingDirZ, true);
      addDrivewayStrip(garCX, Math.max(3.6, garDoorW - 0.3), fZ, 3.8);
      batcher.addBox('walkway_stone', 1.55, 0.08, Math.abs(frontEdgeZ - fZ), deckCX, yBase + 0.065, (frontEdgeZ + fZ) * 0.5);
      addFramedWindow(batcher, deckCX, yBase + 2.25, fZ, Math.min(2.6, chW * 0.22), 1.85, facingDirZ, null, true);
      addFramedWindow(batcher, x, yBase + 6.0, fZ, Math.min(4.0, chW * 0.34), 2.1, facingDirZ, null, true);

      registerFootprint(x, houseZ, chW, chD, yBase + chH + 3.8, yBase, houseZ, chW, chD, chH, wallEntry.mapColor);
    } else if (styleKey === 'townhouses') {
      const totalW = IS_SCALED_WORLD ? Math.min(52, lotW - 0.5) : lotW - 2.0;
      const count = totalW >= 34 ? 4 : totalW >= 23 ? 3 : 2, unitW = totalW / count;
      const thD = IS_SCALED_WORLD ? Math.min(13.2, lotD * 0.44) : 14.5;
      const houseZ = IS_SCALED_WORLD ? frontEdgeZ - facingDirZ * (frontGap + thD * 0.5) : frontEdgeZ - facingDirZ * legacySetback;
      houseRearZ = houseZ - facingDirZ * (thD * 0.5);

      for (let i = 0; i < count; i++) {
        const ux = x - totalW * 0.5 + (i + 0.5) * unitW, thH = 12.6 + ((sAbs + i) % 4) * 1.05;
        const uWall = HOUSE_WALL_PALETTE[(sAbs + i * 3) % HOUSE_WALL_PALETTE.length];
        const uRoof = HOUSE_ROOF_PALETTE[(sAbs + i * 2) % HOUSE_ROOF_PALETTE.length];

        batcher.addBox(uWall.key, unitW - 0.12, thH, thD, ux, yBase + thH * 0.5, houseZ);
        batcher.addBox('charcoal_metal', unitW + 0.16, 0.5, thD + 0.55, ux, yBase + thH + 0.25, houseZ);
        addPitchedGableRoof(batcher, uRoof.key, ux, yBase + thH + 0.42, houseZ, unitW - 0.55, thD - 0.55, 1.75, true, 0.65);

        const fZ = houseZ + facingDirZ * (thD * 0.5), stoopX = ux - unitW * 0.22, winX = ux + unitW * 0.20, winW = Math.min(1.85, unitW * 0.26);
        batcher.addBox('stone_grey', 1.9, 1.0, 1.9, stoopX, yBase + 0.5, fZ + facingDirZ * 0.95);
        batcher.addBox('stone_grey', 1.9, 0.5, 0.95, stoopX, yBase + 0.25, fZ + facingDirZ * 2.2);
        batcher.addBox('wood_warm', 1.3, 2.75, 0.28, stoopX, yBase + 2.35, fZ + facingDirZ * 0.14);
        batcher.addBox('walkway_stone', 1.7, 0.08, Math.abs(frontEdgeZ - fZ), stoopX, yBase + 0.065, (frontEdgeZ + fZ) * 0.5);

        addFramedWindow(batcher, winX, yBase + 2.45, fZ, winW, 1.75, facingDirZ, null, i % 2 === 0);
        addFramedWindow(batcher, ux - unitW * 0.20, yBase + 6.6, fZ, winW * 0.92, 1.75, facingDirZ, null, true);
        addFramedWindow(batcher, winX, yBase + 6.6, fZ, winW * 0.92, 1.75, facingDirZ, null, false);
        addFramedWindow(batcher, ux - unitW * 0.20, yBase + 10.5, fZ, winW * 0.92, 1.65, facingDirZ, null, false);
        addFramedWindow(batcher, winX, yBase + 10.5, fZ, winW * 0.92, 1.65, facingDirZ, null, true);
      }

      registerFootprint(x, houseZ, totalW, thD, yBase + 15.8, yBase, houseZ, totalW, thD, 14.0, '#ea580c');
    }

    const fencePalette = ['chimney_brick', 'stone_grey', 'hedge_green', 'wall_tan'];
    const fenceKey = IS_SCALED_WORLD ? fencePalette[sAbs % fencePalette.length] : (sAbs % 3 === 0 ? 'chimney_brick' : 'hedge_green');
    const sideWallLen = IS_SCALED_WORLD ? Math.max(8, lotD - 1.4) : lotD - 4.0;
    const sideWallZ = IS_SCALED_WORLD ? backEdgeZ + facingDirZ * (sideWallLen * 0.5) : z;
    batcher.addBox(fenceKey, IS_SCALED_WORLD ? 0.42 : 0.7, 1.35, sideWallLen, x - lotW * 0.5 + 0.21, yBase + 0.67, sideWallZ);
    batcher.addBox(fenceKey, IS_SCALED_WORLD ? 0.42 : 0.7, 1.35, sideWallLen, x + lotW * 0.5 - 0.21, yBase + 0.67, sideWallZ);
    batcher.addBox(fenceKey, lotW, 1.38, 0.55, x, yBase + 0.69, backEdgeZ);

    const availBackD = Math.abs(houseRearZ - backEdgeZ);
    const backyardZ = IS_SCALED_WORLD ? backEdgeZ + facingDirZ * Math.max(3.6, availBackD * 0.46) : backEdgeZ + facingDirZ * Math.min(4.8, lotD * 0.22);
    const wantsPool = styleKey === 'suburb_mansion_pool' || (IS_SCALED_WORLD && sAbs % 4 === 1 && availBackD >= 7.8 && lotW >= 14.4);

    if (wantsPool) {
      const poolW = Math.min(11.5, lotW - 4.4), poolD = Math.min(6.4, Math.max(3.8, availBackD - 2.8));
      batcher.addBox('trim_white', poolW + 1.6, 0.16, poolD + 1.6, x + 0.8, yBase + 0.08, backyardZ);
      batcher.addBox('pool_water', poolW, 0.20, poolD, x + 0.8, yBase + 0.13, backyardZ);
      if (lotW >= 16.5) {
        const sbX = x - lotW * 0.34;
        batcher.addBox('trim_white', 1.0, 0.32, 2.0, sbX, yBase + 0.18, backyardZ);
        batcher.addBox('trim_white', 0.18, 2.1, 0.18, sbX, yBase + 1.1, backyardZ);
        batcher.addBox(sAbs % 2 === 0 ? 'flower_red' : 'court_blue', 2.2, 0.35, 2.2, sbX, yBase + 2.2, backyardZ);
      }
    } else {
      const bbqX = x - lotW * 0.28, auxX = x + lotW * 0.24;
      batcher.addBox('chimney_brick', 1.7, 1.45, 1.1, bbqX, yBase + 0.72, backyardZ);
      batcher.addBox('charcoal_metal', 1.5, 0.22, 0.95, bbqX, yBase + 1.55, backyardZ);
      batcher.addBox('chimney_brick', 0.65, 1.35, 0.65, bbqX - 0.35, yBase + 2.15, backyardZ);
      if (sAbs % 3 === 0) {
        batcher.addBox('walkway_stone', 3.4, 0.10, 3.0, auxX, yBase + 0.05, backyardZ);
        for (const px of [auxX - 1.4, auxX + 1.4]) for (const pz of [backyardZ - 1.2, backyardZ + 1.2]) batcher.addBox('wood_warm', 0.24, 2.5, 0.24, px, yBase + 1.25, pz);
        batcher.addBox('wood_warm', 3.6, 0.22, 3.2, auxX, yBase + 2.55, backyardZ);
      } else if (sAbs % 2 === 0) {
        batcher.addBox('wall_cream', 1.6, 1.3, 1.8, auxX, yBase + 0.65, backyardZ + facingDirZ * 0.8);
        batcher.addBox('roof_red', 1.9, 0.52, 2.1, auxX, yBase + 1.48, backyardZ + facingDirZ * 0.8);
      } else {
        batcher.addBox('trim_white', 2.0, 0.85, 2.0, auxX, yBase + 0.42, backyardZ);
        batcher.addBox('trim_white', 0.20, 2.2, 0.20, auxX, yBase + 1.35, backyardZ);
        batcher.addBox(sAbs % 4 === 1 ? 'flower_yellow' : 'flower_pink', 2.5, 0.42, 2.5, auxX, yBase + 2.4, backyardZ);
      }
    }

    const yardTreeSide = driveSideX >= x ? -1 : 1;
    const fTreeX = x + yardTreeSide * (lotW * 0.30), fTreeZ = frontEdgeZ - facingDirZ * 2.3;
    if (sAbs % 2 === 0) batcher.addFloweringTree(fTreeX, yBase, fTreeZ, 0.90 + (sAbs % 3) * 0.10, sAbs % 4 === 0 ? 'pink' : 'yellow');
    else if (!isCompact || sAbs % 3 === 1) {
      const tp = batcher.toWorld(fTreeX, yBase, fTreeZ);
      world._addLegoTree(tp.x, tp.y, tp.z, 0.95);
    }
    if (IS_SCALED_WORLD && availBackD >= 8.0 && sAbs % 3 !== 2) {
      batcher.addFloweringTree(x - yardTreeSide * (lotW * 0.32), yBase, backEdgeZ + facingDirZ * 2.4, 0.98 + (sAbs % 2) * 0.14, sAbs % 2 === 0 ? 'yellow' : 'pink');
    }

    const fenceSpanW = isCompact ? 4.4 : 5.2;
    const frontGardenSideX = x + yardTreeSide * (lotW * 0.24), mbX = x - yardTreeSide * 1.1;
    const isNearActionZone = !hasColliderRot && !cfg.skipBreakableProps && Math.abs(x) <= ws(360) && z >= ws(-790) && z <= ws(-510);
    const mbZ = frontEdgeZ + facingDirZ * (IS_SCALED_WORLD ? -0.85 : 1.2), fZ = frontEdgeZ + facingDirZ * (IS_SCALED_WORLD ? -0.85 : -0.4);

    if (world.destructibles && isNearActionZone && (!IS_SCALED_WORLD ? sAbs % 2 === 0 : true)) {
      const mp = batcher.toWorld(mbX, yBase, mbZ), fp = batcher.toWorld(frontGardenSideX, yBase, fZ);
      spawnBreakableMailbox(world, mp.x, mp.z, sAbs, rotY);
      spawnBreakableWhiteFence(world, fp.x, fp.z, fenceSpanW, rotY);
    } else {
      batcher.addBox('trim_white', 0.20, 1.12, 0.20, mbX, yBase + 0.56, mbZ);
      batcher.addBox(sAbs % 2 === 0 ? 'court_blue' : 'flower_red', 0.54, 0.46, 0.74, mbX, yBase + 1.22, mbZ);
      if (IS_SCALED_WORLD && sAbs % 2 === 1) batcher.addBox(fenceKey, fenceSpanW, 0.76, 0.36, frontGardenSideX, yBase + 0.38, fZ);
      else {
        batcher.addBox('trim_white', fenceSpanW, 0.16, 0.20, frontGardenSideX, yBase + 0.82, fZ);
        batcher.addBox('trim_white', fenceSpanW, 0.16, 0.20, frontGardenSideX, yBase + 0.40, fZ);
        for (const pOff of [-fenceSpanW * 0.46, 0, fenceSpanW * 0.46]) batcher.addBox('trim_white', 0.22, 1.05, 0.24, frontGardenSideX + pOff, yBase + 0.52, fZ);
      }
    }
  } finally {
    if (hasRot) batcher.clearTransform();
  }
}

const SHARED_FENCE_MAT = markAsSharedAsset(new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.62 }));
const SHARED_MAILBOX_VC_MAT = markAsSharedAsset(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.52, metalness: 0.28 }));
const _MAILBOX_HEAD_HEXES = [0x1e293b, 0x5c1919, 0x3f4756, 0x1f3a2c];
const _SUBURB_FENCE_GEO_CACHE = new Map(), _SUBURB_MAILBOX_GEO_CACHE = new Map();
const _TMP_SUBURB_M4 = new THREE.Matrix4(), _TMP_SUBURB_Q = new THREE.Quaternion();
const _TMP_SUBURB_S1 = new THREE.Vector3(1, 1, 1), _TMP_SUBURB_S0 = new THREE.Vector3(0, 0, 0);

function _getSuburbFenceGeo(width = 5.2) {
  const key = width.toFixed(2);
  let geo = _SUBURB_FENCE_GEO_CACHE.get(key);
  if (!geo) {
    const geos = [makeTranslatedBox(width, 0.18, 0.22, 0, 0.85, 0), makeTranslatedBox(width, 0.18, 0.22, 0, 0.42, 0)];
    const posts = Math.max(3, Math.floor(width / 1.1));
    for (let i = 0; i < posts; i++) geos.push(makeTranslatedBox(0.24, 1.1, 0.26, -width * 0.5 + (i / (posts - 1)) * width, 0.55, 0));
    geo = markAsSharedAsset(mergeBufferGeometries(geos));
    _SUBURB_FENCE_GEO_CACHE.set(key, geo);
  }
  return geo;
}

function _getSuburbMailboxGeo(variant = 0) {
  const idx = Math.abs(variant) % _MAILBOX_HEAD_HEXES.length;
  let geo = _SUBURB_MAILBOX_GEO_CACHE.get(idx);
  if (!geo) {
    geo = markAsSharedAsset(mergeColoredGeometries([
      { geo: makeTranslatedBox(0.22, 1.15, 0.22, 0, 0.58, 0), color: new THREE.Color(0xcbd5e1) },
      { geo: makeTranslatedBox(0.58, 0.48, 0.78, 0, 1.25, 0), color: new THREE.Color(_MAILBOX_HEAD_HEXES[idx]) }
    ]));
    _SUBURB_MAILBOX_GEO_CACHE.set(idx, geo);
  }
  return geo;
}

function _registerSuburbInstancedProp(world, key, geo, mat, proxy, itemSpec) {
  if (!world._suburbPropInstPools) world._suburbPropInstPools = new Map();
  let pool = world._suburbPropInstPools.get(key);
  if (!pool) {
    pool = { geo, mat, items: [], inst: null };
    world._suburbPropInstPools.set(key, pool);
  }
  const slot = pool.items.length;
  const item = world.destructibles.registerDestructible({ ...itemSpec, mesh: proxy, isStreetProp: true });
  item._syncInstancedVisual = (obj) => {
    if (!pool.inst) return;
    const vis = Boolean(obj.mesh && obj.mesh.visible && !obj.destroyed);
    _TMP_SUBURB_Q.setFromEuler(obj.mesh.rotation);
    _TMP_SUBURB_M4.compose(obj.mesh.position, _TMP_SUBURB_Q, vis ? _TMP_SUBURB_S1 : _TMP_SUBURB_S0);
    pool.inst.setMatrixAt(slot, _TMP_SUBURB_M4);
    pool.inst.instanceMatrix.needsUpdate = true;
  };
  pool.items.push(item);
}

export function finalizeSuburbBreakableInstancedProps(world) {
  if (!world?._suburbPropInstPools) return;
  for (const pool of world._suburbPropInstPools.values()) {
    if (!pool.items.length || pool.inst) continue;
    const inst = new THREE.InstancedMesh(pool.geo, pool.mat, pool.items.length);
    inst.castShadow = false;
    inst.receiveShadow = true;
    inst.matrixAutoUpdate = false;
    pool.inst = inst;
    for (let i = 0; i < pool.items.length; i++) pool.items[i]._syncInstancedVisual(pool.items[i]);
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingBox();
    inst.computeBoundingSphere();
    world.scene.add(inst);
  }
}

function _spawnBreakableSuburbProp(world, x, z, rotY, poolKey, geo, mat, cw, cd, obbD, maxH, spec) {
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = baseY + (IS_SCALED_WORLD ? 0.06 : 0.28);
  const col = Math.abs(rotY) > 1e-3 && typeof world.addObbCollider === 'function'
    ? world.addObbCollider(x, z, cw, obbD, rotY, yBase + maxH, yBase)
    : world.addCollider(x, z, cw, cd, yBase + maxH, yBase);
  if (world.destructibles) {
    const proxy = new THREE.Object3D();
    proxy.position.set(x, yBase, z);
    proxy.rotation.y = rotY;
    _registerSuburbInstancedProp(world, poolKey, geo, mat, proxy, { ...spec, colliders: [col], groundY: yBase });
  } else {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, yBase, z);
    mesh.rotation.y = rotY;
    mesh.receiveShadow = true;
    world.scene.add(mesh);
  }
}

export function spawnBreakableWhiteFence(world, x, z, width = 5.2, rotY = 0) {
  _spawnBreakableSuburbProp(world, x, z, rotY, `fence_${width.toFixed(2)}`, _getSuburbFenceGeo(width), SHARED_FENCE_MAT, width, 0.45, 0.65, 1.1, {
    type: 'fence', hp: 10, radius: width * 0.45, height: 1.1,
    debrisColors: [LEGO_COLORS.white, LEGO_COLORS.lightGrey], studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 }
  });
}

export function spawnBreakableMailbox(world, x, z, seed = 0, rotY = 0) {
  const vIdx = Math.abs(seed) % _MAILBOX_HEAD_HEXES.length;
  _spawnBreakableSuburbProp(world, x, z, rotY, `mailbox_${vIdx}`, _getSuburbMailboxGeo(vIdx), SHARED_MAILBOX_VC_MAT, 0.65, 0.75, 0.75, 1.5, {
    type: 'mailbox', hp: 8, radius: 0.75, height: 1.5,
    debrisColors: [LEGO_COLORS.blue, LEGO_COLORS.red, LEGO_COLORS.white, LEGO_COLORS.yellow], studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 }
  });
}
