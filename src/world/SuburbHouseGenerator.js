import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  mergeColoredGeometries,
  makeTranslatedBox,
  makeFastBox,
  flushSpatialChunkedBuckets
} from './BuildingGenerator.js';
import { localToWorldXZ } from './buildings/LotGeometry2D.js';
import { IS_SCALED_WORLD, ROAD, ws } from './core/WorldLayoutScale.js';

export const HOUSE_STYLE_KEYS = [
  'american_two_story',
  'ranch_l_shape',
  'suburb_mansion_pool',
  'modern_wood_chalet',
  'townhouses'
];

export const HOUSE_WALL_PALETTE = [
  { key: 'wall_cream', hex: 0x8a8275, mapColor: '#78716c' },
  { key: 'wall_sky_blue', hex: 0x2d3e52, mapColor: '#334155' },
  { key: 'wall_mint', hex: 0x34463c, mapColor: '#365314' },
  { key: 'wall_brick', hex: 0x6b2417, mapColor: '#7c2d12' },
  { key: 'wall_white', hex: 0x8d96a3, mapColor: '#94a3b8' },
  { key: 'wall_salmon', hex: 0x63322e, mapColor: '#7f1d1d' },
  { key: 'wall_tan', hex: 0x695a49, mapColor: '#57534e' },
  { key: 'wall_lightgrey', hex: 0x525c6b, mapColor: '#475569' },
  { key: 'wall_lavender', hex: 0x3b384a, mapColor: '#334155' },
  { key: 'wall_amber', hex: 0x6e4e27, mapColor: '#78350f' },
  { key: 'wall_teal', hex: 0x223d42, mapColor: '#155e75' },
  { key: 'wall_colonial_red', hex: 0x5c1919, mapColor: '#7f1d1d' }
];

export const HOUSE_ROOF_PALETTE = [
  { key: 'roof_red', hex: 0x4c1616 },
  { key: 'roof_brown', hex: 0x2e1a10 },
  { key: 'roof_slate', hex: 0x172030 },
  { key: 'roof_graphite', hex: 0x181a20 },
  { key: 'roof_green', hex: 0x132a1e },
  { key: 'roof_terracotta', hex: 0x522110 }
];

function makeRotatedBoxGeo(w, h, d, rx, ry, rz, cosY, sinY) {
  const geo = makeTranslatedBox(w, h, d, 0, 0, 0);
  const posArr = geo.attributes.position.array;
  const normArr = geo.attributes.normal.array;
  for (let i = 0; i < 72; i += 3) {
    const px = posArr[i], pz = posArr[i + 2];
    posArr[i] = rx + px * cosY + pz * sinY;
    posArr[i + 1] += ry;
    posArr[i + 2] = rz - px * sinY + pz * cosY;
    const nx = normArr[i], nz = normArr[i + 2];
    normArr[i] = nx * cosY + nz * sinY;
    normArr[i + 2] = -nx * sinY + nz * cosY;
  }
  return geo;
}

export class SuburbBatcher {
  constructor() {
    this.buckets = new Map();
    this.materials = new Map();
    this.floweringTrees = [];
    this._txActive = false;
    this._pivotX = 0;
    this._pivotZ = 0;
    this._rotY = 0;
    this._cosY = 1;
    this._sinY = 0;
    this._worldRef = null;
    this._baseCenterY = 0;
    this._initMaterials();
  }

  setTransform(pivotX, pivotZ, rotY = 0, world = null, baseCenterY = 0) {
    if (Math.abs(rotY) <= 1e-4) {
      this.clearTransform();
      return;
    }
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

  _registerMat(key, colorHex, opts = {}) {
    this.buckets.set(key, []);
    if (opts.basic) {
      this.materials.set(key, new THREE.MeshBasicMaterial({ color: colorHex }));
      return;
    }
    const r = opts.roughness ?? 0.32;
    this.materials.set(
      key,
      new THREE.MeshPhysicalMaterial({
        color: colorHex,
        roughness: r,
        metalness: opts.metalness ?? 0.06,
        clearcoat: r > 0.45 ? 0.06 : 0.4,
        clearcoatRoughness: 0.15,
        reflectivity: 0.72,
        emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
        emissiveIntensity: opts.emissiveIntensity ?? 0
      })
    );
  }

  _initMaterials() {
    for (const w of HOUSE_WALL_PALETTE) this._registerMat(w.key, w.hex, { roughness: 0.58 });
    for (const r of HOUSE_ROOF_PALETTE) this._registerMat(r.key, r.hex, { roughness: 0.66 });
    this._registerMat('trim_white', 0x9aa4b2, { roughness: 0.52 });
    this._registerMat('wood_warm', 0x4a2511, { roughness: 0.62 });
    this._registerMat('stone_grey', 0x3b424f, { roughness: 0.68 });
    this._registerMat('chimney_brick', 0x4c1814, { roughness: 0.68 });
    this._registerMat('charcoal_metal', 0x141821, { roughness: 0.42, metalness: 0.45 });
    this._registerMat('window_warm', 0xf5b942, { emissive: 0xd97706, emissiveIntensity: 0.62, roughness: 0.18 });
    this._registerMat('window_glass', 0x0b1524, { emissive: 0x0c2438, emissiveIntensity: 0.15, roughness: 0.14 });
    this._registerMat('shutter_blue', 0x17253b, { roughness: 0.56 });
    this._registerMat('shutter_green', 0x142b1e, { roughness: 0.56 });
    this._registerMat('lawn_green', 0x1b3624, { roughness: 0.78 });
    this._registerMat('hedge_green', 0x12261a, { roughness: 0.72 });
    this._registerMat('driveway_concrete', 0x383f4d, { roughness: 0.74 });
    this._registerMat('walkway_stone', 0x4b5260, { roughness: 0.68 });
    this._registerMat('asphalt_lot', 0x11151d, { roughness: 0.76 });
    this._registerMat('pool_water', 0x0c4a6e, { emissive: 0x075985, emissiveIntensity: 0.28, roughness: 0.12 });
    this._registerMat('flower_red', 0x7f1d1d, { roughness: 0.55 });
    this._registerMat('flower_yellow', 0xb45309, { roughness: 0.55 });
    this._registerMat('flower_pink', 0x6b2137, { roughness: 0.55 });
    this._registerMat('court_orange', 0x7c2d12, { roughness: 0.62 });
    this._registerMat('court_blue', 0x1e3a5f, { roughness: 0.62 });
    this._registerMat('neon_pink', 0xbe123c, { emissive: 0xbe123c, emissiveIntensity: 0.72 });
    this._registerMat('neon_cyan', 0x0891b2, { emissive: 0x0891b2, emissiveIntensity: 0.72 });
    this._registerMat('gold_accent', 0xb47b12, { emissive: 0x92400e, emissiveIntensity: 0.35, metalness: 0.45 });
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
    if (!bucket) {
      geo.dispose();
      return;
    }
    if (this._txActive && geo.attributes?.position) {
      const pos = geo.attributes.position;
      let sumX = 0, sumZ = 0;
      for (let i = 0; i < pos.count; i++) {
        sumX += pos.getX(i);
        sumZ += pos.getZ(i);
      }
      const cx = pos.count > 0 ? sumX / pos.count : this._pivotX;
      const cz = pos.count > 0 ? sumZ / pos.count : this._pivotZ;
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
      } else {
        geo.computeVertexNormals();
      }
    }
    bucket.push(geo);
  }

  addFloweringTree(x, y, z, scale = 1.0, blossomKey = 'pink') {
    const wp = this.toWorld(x, y, z);
    this.floweringTrees.push({ x: wp.x, y: wp.y, z: wp.z, scale, blossomKey });
  }

  flush(scene) {
    const flatSet = new Set(['lawn_green', 'driveway_concrete', 'walkway_stone', 'asphalt_lot', 'pool_water']);
    flushSpatialChunkedBuckets(scene, this.buckets, this.materials, {
      chunkSize: 512,
      castShadowFn: (key) => !flatSet.has(key),
      receiveShadowFn: () => true
    });

    if (this.floweringTrees.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.36, 0.46, 2.5, 8);
      trunkGeo.translate(0, 1.25, 0);
      const trunkInst = new THREE.InstancedMesh(
        trunkGeo,
        new THREE.MeshStandardMaterial({ color: LEGO_COLORS.brown, roughness: 0.4 }),
        this.floweringTrees.length
      );
      const canopyGeo = new THREE.ConeGeometry(2.25, 3.6, 7);
      canopyGeo.translate(0, 3.7, 0);
      const dummy = new THREE.Object3D();

      this.floweringTrees.forEach((t, i) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);
      });
      trunkInst.instanceMatrix.needsUpdate = true;
      scene.add(trunkInst);

      const pinkTrees = this.floweringTrees.filter((t) => t.blossomKey === 'pink');
      const yellowTrees = this.floweringTrees.filter((t) => t.blossomKey !== 'pink');
      for (const [list, hex] of [[pinkTrees, 0x5c1d24], [yellowTrees, 0x6b3e16]]) {
        if (list.length === 0) continue;
        const inst = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.72 }), list.length);
        inst.castShadow = true;
        list.forEach((t, i) => {
          dummy.position.set(t.x, t.y, t.z);
          dummy.scale.setScalar(t.scale);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        });
        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
      }
    }
  }
}

export function addPitchedGableRoof(batcher, roofKey, x, yTop, z, w, d, roofHeight = 3.2, ridgeAlongX = true) {
  const base = new THREE.BoxGeometry(1, 1, 1);
  const pos = base.attributes.position;
  const botW = w + 1.45, botD = d + 1.45;
  const topW = ridgeAlongX ? Math.max(0.4, w + 0.65) : 0.18;
  const topD = ridgeAlongX ? 0.18 : Math.max(0.4, d + 0.65);

  for (let i = 0; i < pos.count; i++) {
    const isTop = pos.getY(i) > 0;
    pos.setXYZ(
      i,
      x + pos.getX(i) * (isTop ? topW : botW),
      yTop + 0.22 + (pos.getY(i) + 0.5) * roofHeight,
      z + pos.getZ(i) * (isTop ? topD : botD)
    );
  }
  const prismGeo = base.toNonIndexed();
  base.dispose();
  prismGeo.computeVertexNormals();
  batcher.addCustomGeo(roofKey, prismGeo);
  batcher.addBox('charcoal_metal', w + 1.6, 0.24, d + 1.6, x, yTop + 0.12, z);
}

function addFramedWindow(batcher, x, y, z, w, h, facingDirZ, shutterKey = 'shutter_blue', warm = true) {
  const zOff = facingDirZ * 0.14;
  batcher.addBox('trim_white', w + 0.36, h + 0.36, 0.22, x, y, z + zOff);
  batcher.addBox(warm ? 'window_warm' : 'window_glass', w, h, 0.26, x, y, z + zOff * 1.15);
  if (shutterKey) {
    batcher.addBox(shutterKey, 0.36, h + 0.1, 0.26, x - w * 0.5 - 0.24, y, z + zOff * 1.1);
    batcher.addBox(shutterKey, 0.36, h + 0.1, 0.26, x + w * 0.5 + 0.24, y, z + zOff * 1.1);
  }
}

function addGarageDoor(batcher, x, yBase, z, w, h, facingDirZ, isWood = false) {
  const zOff = facingDirZ * 0.14;
  batcher.addBox('trim_white', w + 0.5, h + 0.3, 0.24, x, yBase + h * 0.5, z + zOff);
  batcher.addBox(isWood ? 'wood_warm' : 'wall_lightgrey', w, h, 0.28, x, yBase + h * 0.5, z + zOff * 1.15);
  for (let py = 0.8; py < h - 0.3; py += 0.9) {
    batcher.addBox('trim_white', w - 0.3, 0.12, 0.32, x, yBase + py, z + zOff * 1.25);
  }
}

export function buildDetailedHouse(world, batcher, cfg) {
  const { x, z, lotW = 28, lotD = 44, facingDirZ = 1, rotY = 0, styleKey = 'american_two_story', seed = 1 } = cfg;
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = baseY + (IS_SCALED_WORLD ? (cfg.padOffsetY ?? 0.06) : 0.30);
  const hasRot = Math.abs(rotY) > 1e-4;
  const hasColliderRot = Math.abs(rotY) > 1e-3;
  const cosY = hasRot ? Math.cos(rotY) : 1;
  const sinY = hasRot ? Math.sin(rotY) : 0;

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
      if (baseY > 0.25 || hasRot) batcher.addBox('stone_grey', lotW - 0.3, 3.0, lotD - 0.3, x, baseY - 1.45, z);
      batcher.addBox('lawn_green', lotW - 0.2, 0.06, lotD - 0.2, x, yBase - 0.01, z);
    } else if (baseY > 0.15) {
      batcher.addBox('stone_grey', lotW - 0.3, 2.4, lotD - 0.3, x, baseY - 0.92, z);
      batcher.addBox('lawn_green', lotW - 0.2, 0.1, lotD - 0.2, x, baseY + 0.28, z);
    }

    const wallEntry = HOUSE_WALL_PALETTE[Math.floor(Math.random() * HOUSE_WALL_PALETTE.length)];
    const roofEntry = HOUSE_ROOF_PALETTE[Math.floor(Math.random() * HOUSE_ROOF_PALETTE.length)];
    const shutterKey = Math.random() < 0.5 ? 'shutter_blue' : 'shutter_green';

    const frontEdgeZ = z + facingDirZ * (lotD * 0.5);
    const backEdgeZ = z - facingDirZ * (lotD * 0.5);
    const frontSetback = IS_SCALED_WORLD ? Math.min(13.0, lotD * 0.42) : Math.min(9.6, lotD * 0.36);
    const houseZ = frontEdgeZ - facingDirZ * frontSetback;
    const backyardZ = backEdgeZ + facingDirZ * Math.min(4.8, lotD * 0.22);

    const addDrivewayStrip = (driveX, driveW, startZ, reach1x = 3.8) => {
      if (!IS_SCALED_WORLD) {
        batcher.addBox('driveway_concrete', driveW, 0.08, Math.abs(frontEdgeZ - startZ) + reach1x + 0.2, driveX, yBase + 0.02, (frontEdgeZ + facingDirZ * reach1x + startZ) * 0.5);
        return;
      }
      batcher.addBox('driveway_concrete', driveW, 0.07, Math.abs(frontEdgeZ - startZ) + 0.2, driveX, yBase + 0.02, (frontEdgeZ + startZ) * 0.5);
      const apronLen = cfg.apronLen ?? Math.max(1.0, ROAD.sidewalk - 0.4);
      if (apronLen > 0.2) {
        const apronMidZ = frontEdgeZ + facingDirZ * (apronLen * 0.5);
        const apronY = hasRot ? baseY + 0.05 : (world.getTerrainHeightAt ? world.getTerrainHeightAt(driveX, apronMidZ) : baseY) + 0.02;
        batcher.addBox('driveway_concrete', driveW, 0.05, apronLen, driveX, apronY, apronMidZ);
      }
    };

    if (styleKey === 'american_two_story') {
      const mainW = Math.min(14, lotW * 0.52), mainD = 13, mainH = 9.2;
      const garW = Math.min(9.5, lotW * 0.34), garD = 10.5, garH = 4.8;
      const mainX = x - garW * 0.45, garX = x + mainW * 0.52;

      batcher.addBox(wallEntry.key, mainW, mainH, mainD, mainX, yBase + mainH * 0.5, houseZ);
      addPitchedGableRoof(batcher, roofEntry.key, mainX, yBase + mainH, houseZ, mainW, mainD, 3.4, true);
      batcher.addBox('chimney_brick', 1.5, 4.5, 1.5, mainX - mainW * 0.35, yBase + mainH + 2.2, houseZ - facingDirZ * 2.0);
      batcher.addBox('trim_white', 1.8, 0.3, 1.8, mainX - mainW * 0.35, yBase + mainH + 4.5, houseZ - facingDirZ * 2.0);

      const garDoorZ = houseZ + facingDirZ * (0.8 + garD * 0.5);
      batcher.addBox(wallEntry.key, garW, garH, garD, garX, yBase + garH * 0.5, houseZ + facingDirZ * 0.8);
      addPitchedGableRoof(batcher, roofEntry.key, garX, yBase + garH, houseZ + facingDirZ * 0.8, garW, garD, 2.0, true);
      addGarageDoor(batcher, garX, yBase, garDoorZ, garW - 1.6, 3.6, facingDirZ, Math.random() < 0.5);
      addDrivewayStrip(garX, garW - 1.0, garDoorZ, 4.0);

      const porchZ = houseZ + facingDirZ * (mainD * 0.5 + 1.4);
      batcher.addBox('walkway_stone', mainW - 1.0, 0.4, 2.8, mainX, yBase + 0.2, porchZ);
      batcher.addBox(roofEntry.key, mainW - 0.6, 0.45, 3.2, mainX, yBase + 4.1, porchZ);
      for (const px of [mainX - mainW * 0.38, mainX + mainW * 0.38]) {
        batcher.addBox('trim_white', 0.42, 3.8, 0.42, px, yBase + 2.0, porchZ + facingDirZ * 1.1);
      }

      const fZ = houseZ + facingDirZ * (mainD * 0.5);
      batcher.addBox('wood_warm', 1.6, 2.9, 0.3, mainX - 1.8, yBase + 1.5, fZ + facingDirZ * 0.12);
      addFramedWindow(batcher, mainX + 2.2, yBase + 2.2, fZ, 2.4, 1.8, facingDirZ, shutterKey, true);
      addFramedWindow(batcher, mainX - 2.4, yBase + 6.4, fZ, 2.2, 1.7, facingDirZ, shutterKey, false);
      addFramedWindow(batcher, mainX + 2.4, yBase + 6.4, fZ, 2.2, 1.7, facingDirZ, shutterKey, true);
      batcher.addBox('walkway_stone', 1.8, 0.08, Math.abs(frontEdgeZ - porchZ), mainX - 1.8, yBase + 0.03, (frontEdgeZ + porchZ) * 0.5);

      registerFootprint(x, houseZ, mainW + garW, mainD, yBase + mainH + 3.0, yBase, houseZ, mainW + garW, mainD, mainH, wallEntry.mapColor);
    } else if (styleKey === 'ranch_l_shape') {
      const wingW = Math.min(22, lotW - 4), wingD = 10.5, wingH = 5.4;
      const fwdW = Math.min(10, wingW * 0.44), fwdD = 8.5;
      const garX = x - wingW * 0.5 + fwdW * 0.5;
      const mainZ = houseZ - facingDirZ * 1.5, fwdZ = mainZ + facingDirZ * ((wingD + fwdD) * 0.5 - 1.0);

      batcher.addBox(wallEntry.key, wingW, wingH, wingD, x, yBase + wingH * 0.5, mainZ);
      addPitchedGableRoof(batcher, roofEntry.key, x, yBase + wingH, mainZ, wingW, wingD, 2.5, true);
      batcher.addBox(wallEntry.key, fwdW, wingH, fwdD, garX, yBase + wingH * 0.5, fwdZ);
      addPitchedGableRoof(batcher, roofEntry.key, garX, yBase + wingH, fwdZ, fwdW, fwdD, 2.4, false);

      const garFrontZ = fwdZ + facingDirZ * (fwdD * 0.5);
      addGarageDoor(batcher, garX, yBase, garFrontZ, fwdW - 1.6, 3.6, facingDirZ, Math.random() < 0.5);
      addDrivewayStrip(garX, fwdW - 1.0, garFrontZ, 3.8);

      const rightCenterX = x + fwdW * 0.45, fZ = mainZ + facingDirZ * (wingD * 0.5);
      addFramedWindow(batcher, rightCenterX + 1.8, yBase + 2.6, fZ, 3.8, 2.0, facingDirZ, shutterKey, true);
      batcher.addBox('wood_warm', 1.6, 2.9, 0.3, rightCenterX - 2.2, yBase + 1.5, fZ + facingDirZ * 0.12);
      batcher.addBox('walkway_stone', 1.8, 0.08, Math.abs(frontEdgeZ - fZ), rightCenterX - 2.2, yBase + 0.03, (frontEdgeZ + fZ) * 0.5);
      batcher.addBox('hedge_green', 4.2, 0.55, 1.0, rightCenterX + 1.8, yBase + 0.28, fZ + facingDirZ * 0.65);
      batcher.addBox('flower_red', 1.0, 0.35, 0.5, rightCenterX + 0.8, yBase + 0.68, fZ + facingDirZ * 0.65);
      batcher.addBox('flower_yellow', 1.0, 0.35, 0.5, rightCenterX + 2.8, yBase + 0.68, fZ + facingDirZ * 0.65);

      registerFootprint(x, houseZ, wingW, wingD + fwdD * 0.6, yBase + wingH + 2.4, yBase, mainZ, wingW, wingD, wingH, wallEntry.mapColor);
    } else if (styleKey === 'suburb_mansion_pool') {
      const manW = Math.min(22, lotW - 5), manD = 14, manH = 10.4;
      batcher.addBox(wallEntry.key, manW, manH, manD, x, yBase + manH * 0.5, houseZ);
      addPitchedGableRoof(batcher, roofEntry.key, x, yBase + manH, houseZ, manW, manD, 3.4, true);

      const fZ = houseZ + facingDirZ * (manD * 0.5);
      batcher.addBox('trim_white', 7.2, 0.45, 3.0, x, yBase + 5.2, fZ + facingDirZ * 1.4);
      batcher.addBox('trim_white', 7.0, 0.85, 0.25, x, yBase + 5.8, fZ + facingDirZ * 2.75);
      for (const cx of [x - 2.8, x + 2.8]) batcher.addBox('trim_white', 0.55, 5.0, 0.55, cx, yBase + 2.5, fZ + facingDirZ * 2.5);

      batcher.addBox('wood_warm', 2.2, 3.4, 0.3, x, yBase + 1.7, fZ + facingDirZ * 0.14);
      addFramedWindow(batcher, x - 6.2, yBase + 2.6, fZ, 3.2, 2.2, facingDirZ, shutterKey, true);
      addFramedWindow(batcher, x + 6.2, yBase + 2.6, fZ, 3.2, 2.2, facingDirZ, shutterKey, true);
      addFramedWindow(batcher, x - 6.2, yBase + 7.4, fZ, 3.0, 2.0, facingDirZ, shutterKey, false);
      addFramedWindow(batcher, x, yBase + 7.4, fZ, 3.4, 2.2, facingDirZ, null, true);
      addFramedWindow(batcher, x + 6.2, yBase + 7.4, fZ, 3.0, 2.0, facingDirZ, shutterKey, false);

      addDrivewayStrip(x + manW * 0.32, 5.0, fZ, 3.8);
      batcher.addBox('walkway_stone', 2.8, 0.08, Math.abs(frontEdgeZ - fZ), x, yBase + 0.03, (frontEdgeZ + fZ) * 0.5);

      const poolW = Math.min(13, lotW * 0.52), poolD = 7.2, sunbedX = x - poolW * 0.5 - 2.2;
      batcher.addBox('trim_white', poolW + 2.2, 0.18, poolD + 2.2, x, yBase + 0.09, backyardZ);
      batcher.addBox('pool_water', poolW, 0.24, poolD, x, yBase + 0.15, backyardZ);
      batcher.addBox('trim_white', 1.2, 0.35, 2.4, sunbedX, yBase + 0.22, backyardZ - 1.4);
      batcher.addBox('trim_white', 1.2, 0.35, 2.4, sunbedX, yBase + 0.22, backyardZ + 1.4);
      batcher.addBox('trim_white', 0.2, 2.4, 0.2, sunbedX, yBase + 1.2, backyardZ);
      batcher.addBox('flower_red', 2.6, 0.4, 2.6, sunbedX, yBase + 2.4, backyardZ);

      registerFootprint(x, houseZ, manW, manD, yBase + manH + 3.2, yBase, houseZ, manW, manD, manH, wallEntry.mapColor, 'MANSÃO');
    } else if (styleKey === 'modern_wood_chalet') {
      const chW = Math.min(17, lotW - 5), chD = 12.5, chH = 8.6;
      batcher.addBox('stone_grey', chW, 3.8, chD, x, yBase + 1.9, houseZ);
      batcher.addBox(wallEntry.key, chW - 0.6, chH - 3.8, chD - 0.6, x, yBase + 3.8 + (chH - 3.8) * 0.5, houseZ);
      addPitchedGableRoof(batcher, roofEntry.key, x, yBase + chH, houseZ, chW + 0.8, chD + 0.8, 4.2, false);
      batcher.addBox('stone_grey', 1.8, chH + 4.8, 1.8, x + chW * 0.36, yBase + (chH + 4.8) * 0.5, houseZ);

      const fZ = houseZ + facingDirZ * (chD * 0.5);
      batcher.addBox('wood_warm', chW * 0.55, 0.35, 3.2, x - chW * 0.2, yBase + 0.18, fZ + facingDirZ * 1.5);
      addGarageDoor(batcher, x + chW * 0.26, yBase, fZ, 6.2, 3.4, facingDirZ, true);
      addDrivewayStrip(x + chW * 0.26, 5.8, fZ, 3.8);
      batcher.addBox('walkway_stone', 1.8, 0.08, Math.abs(frontEdgeZ - fZ), x - chW * 0.2, yBase + 0.03, (frontEdgeZ + fZ) * 0.5);
      addFramedWindow(batcher, x - chW * 0.22, yBase + 2.3, fZ, 2.8, 1.9, facingDirZ, null, true);
      addFramedWindow(batcher, x, yBase + 6.2, fZ, 4.2, 2.2, facingDirZ, null, true);

      registerFootprint(x, houseZ, chW, chD, yBase + chH + 3.8, yBase, houseZ, chW, chD, chH, wallEntry.mapColor);
    } else if (styleKey === 'townhouses') {
      const totalW = IS_SCALED_WORLD ? Math.min(52, lotW - 2.0) : lotW - 2.0;
      const count = totalW >= 34 ? 4 : 3, unitW = totalW / count, thD = 14.5;

      for (let i = 0; i < count; i++) {
        const ux = x - totalW * 0.5 + (i + 0.5) * unitW;
        const thH = 13.0 + Math.floor(Math.random() * 4) * 1.1;
        const uWall = HOUSE_WALL_PALETTE[Math.floor(Math.random() * HOUSE_WALL_PALETTE.length)];
        const uRoof = HOUSE_ROOF_PALETTE[Math.floor(Math.random() * HOUSE_ROOF_PALETTE.length)];

        batcher.addBox(uWall.key, unitW - 0.15, thH, thD, ux, yBase + thH * 0.5, houseZ);
        batcher.addBox('charcoal_metal', unitW + 0.24, 0.55, thD + 0.7, ux, yBase + thH + 0.28, houseZ);
        addPitchedGableRoof(batcher, uRoof.key, ux, yBase + thH + 0.45, houseZ, unitW - 0.5, thD - 0.5, 1.85, true);

        const fZ = houseZ + facingDirZ * (thD * 0.5), stoopX = ux - unitW * 0.22, winX = ux + unitW * 0.2;
        batcher.addBox('stone_grey', 2.2, 1.1, 2.4, stoopX, yBase + 0.55, fZ + facingDirZ * 1.2);
        batcher.addBox('stone_grey', 2.2, 0.55, 1.2, stoopX, yBase + 0.28, fZ + facingDirZ * 2.8);
        batcher.addBox('wood_warm', 1.4, 2.8, 0.3, stoopX, yBase + 2.4, fZ + facingDirZ * 0.14);
        batcher.addBox('walkway_stone', 2.0, 0.08, Math.abs(frontEdgeZ - fZ), stoopX, yBase + 0.03, (frontEdgeZ + fZ) * 0.5);

        addFramedWindow(batcher, winX, yBase + 2.5, fZ, 2.0, 1.8, facingDirZ, null, i % 2 === 0);
        addFramedWindow(batcher, ux - unitW * 0.2, yBase + 6.8, fZ, 1.8, 1.8, facingDirZ, null, true);
        addFramedWindow(batcher, winX, yBase + 6.8, fZ, 1.8, 1.8, facingDirZ, null, false);
        addFramedWindow(batcher, ux - unitW * 0.2, yBase + 10.8, fZ, 1.8, 1.7, facingDirZ, null, false);
        addFramedWindow(batcher, winX, yBase + 10.8, fZ, 1.8, 1.7, facingDirZ, null, true);
      }

      registerFootprint(x, houseZ, totalW, thD, yBase + 16.0, yBase, houseZ, totalW, thD, 14.5, '#ea580c');
    }

    const fenceKey = seed % 3 === 0 ? 'chimney_brick' : 'hedge_green';
    batcher.addBox(fenceKey, 0.7, 1.25, lotD - 4.0, x - lotW * 0.5, yBase + 0.62, z);
    batcher.addBox(fenceKey, 0.7, 1.25, lotD - 4.0, x + lotW * 0.5, yBase + 0.62, z);
    batcher.addBox(fenceKey, lotW, 1.35, 0.7, x, yBase + 0.67, backEdgeZ);

    if (styleKey !== 'suburb_mansion_pool') {
      const bbqX = x - lotW * 0.28;
      batcher.addBox('chimney_brick', 1.8, 1.5, 1.2, bbqX, yBase + 0.75, backyardZ);
      batcher.addBox('charcoal_metal', 1.6, 0.25, 1.0, bbqX, yBase + 1.6, backyardZ);
      batcher.addBox('chimney_brick', 0.7, 1.4, 0.7, bbqX - 0.4, yBase + 2.2, backyardZ);

      if (seed % 2 === 0) {
        const dogX = x + lotW * 0.26;
        batcher.addBox('wall_cream', 1.6, 1.3, 1.8, dogX, yBase + 0.65, backyardZ + facingDirZ * 1.5);
        batcher.addBox('roof_red', 1.9, 0.55, 2.1, dogX, yBase + 1.5, backyardZ + facingDirZ * 1.5);
      } else {
        const patX = x + lotW * 0.22;
        batcher.addBox('trim_white', 2.2, 0.9, 2.2, patX, yBase + 0.45, backyardZ);
        batcher.addBox('trim_white', 0.22, 2.3, 0.22, patX, yBase + 1.4, backyardZ);
        batcher.addBox(seed % 4 === 1 ? 'flower_yellow' : 'flower_pink', 2.8, 0.45, 2.8, patX, yBase + 2.5, backyardZ);
      }
    }

    const treeX = x - lotW * 0.32, treeZ = frontEdgeZ - facingDirZ * 2.6;
    if (seed % 2 === 0) {
      batcher.addFloweringTree(treeX, yBase, treeZ, 0.95 + (seed % 3) * 0.12, seed % 4 === 0 ? 'pink' : 'yellow');
    } else {
      const tp = batcher.toWorld(treeX, yBase, treeZ);
      world._addLegoTree(tp.x, tp.y, tp.z, 1.0);
    }

    const isNearActionZone = !hasColliderRot && !cfg.skipBreakableProps && Math.abs(x) <= ws(360) && z >= ws(-790) && z <= ws(-510);
    const mbZ = frontEdgeZ + facingDirZ * (IS_SCALED_WORLD ? -0.85 : 1.2);
    const fZ = frontEdgeZ + facingDirZ * (IS_SCALED_WORLD ? -0.85 : -0.4);
    if (world.destructibles && isNearActionZone && seed % 2 === 0) {
      const mp = batcher.toWorld(x + 2.2, yBase, mbZ);
      const fp = batcher.toWorld(x - lotW * 0.26, yBase, fZ);
      spawnBreakableMailbox(world, mp.x, mp.z, seed, rotY);
      spawnBreakableWhiteFence(world, fp.x, fp.z, 5.2, rotY);
    } else {
      const mbX = x + 2.2, fX = x - lotW * 0.26;
      batcher.addBox('trim_white', 0.22, 1.15, 0.22, mbX, yBase + 0.58, mbZ);
      batcher.addBox(seed % 2 === 0 ? 'court_blue' : 'flower_red', 0.58, 0.48, 0.78, mbX, yBase + 1.25, mbZ);
      batcher.addBox('trim_white', 5.2, 0.18, 0.22, fX, yBase + 0.85, fZ);
      batcher.addBox('trim_white', 5.2, 0.18, 0.22, fX, yBase + 0.42, fZ);
      batcher.addBox('trim_white', 0.24, 1.1, 0.26, fX - 2.4, yBase + 0.55, fZ);
      batcher.addBox('trim_white', 0.24, 1.1, 0.26, fX, yBase + 0.55, fZ);
      batcher.addBox('trim_white', 0.24, 1.1, 0.26, fX + 2.4, yBase + 0.55, fZ);
    }
  } finally {
    if (hasRot) batcher.clearTransform();
  }
}

const SHARED_FENCE_MAT = markAsSharedAsset(
  new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.62 })
);
const SHARED_MAILBOX_VC_MAT = markAsSharedAsset(
  new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.52, metalness: 0.28 })
);
const _MAILBOX_HEAD_HEXES = [0x1e293b, 0x5c1919, 0x3f4756, 0x1f3a2c];
const _SUBURB_FENCE_GEO_CACHE = new Map();
const _SUBURB_MAILBOX_GEO_CACHE = new Map();
const _TMP_SUBURB_M4 = new THREE.Matrix4();
const _TMP_SUBURB_Q = new THREE.Quaternion();
const _TMP_SUBURB_S1 = new THREE.Vector3(1, 1, 1);
const _TMP_SUBURB_S0 = new THREE.Vector3(0, 0, 0);

function _getSuburbFenceGeo(width = 5.2) {
  const key = width.toFixed(2);
  let geo = _SUBURB_FENCE_GEO_CACHE.get(key);
  if (!geo) {
    const geos = [
      makeTranslatedBox(width, 0.18, 0.22, 0, 0.85, 0),
      makeTranslatedBox(width, 0.18, 0.22, 0, 0.42, 0)
    ];
    const posts = Math.max(3, Math.floor(width / 1.1));
    for (let i = 0; i < posts; i++) {
      geos.push(makeTranslatedBox(0.24, 1.1, 0.26, -width * 0.5 + (i / (posts - 1)) * width, 0.55, 0));
    }
    geo = markAsSharedAsset(mergeBufferGeometries(geos));
    _SUBURB_FENCE_GEO_CACHE.set(key, geo);
  }
  return geo;
}

function _getSuburbMailboxGeo(variant = 0) {
  const idx = Math.abs(variant) % _MAILBOX_HEAD_HEXES.length;
  let geo = _SUBURB_MAILBOX_GEO_CACHE.get(idx);
  if (!geo) {
    geo = markAsSharedAsset(
      mergeColoredGeometries([
        { geo: makeTranslatedBox(0.22, 1.15, 0.22, 0, 0.58, 0), color: new THREE.Color(0xcbd5e1) },
        { geo: makeTranslatedBox(0.58, 0.48, 0.78, 0, 1.25, 0), color: new THREE.Color(_MAILBOX_HEAD_HEXES[idx]) }
      ])
    );
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
    for (let i = 0; i < pool.items.length; i++) {
      pool.items[i]._syncInstancedVisual(pool.items[i]);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    world.scene.add(inst);
  }
}

export function spawnBreakableWhiteFence(world, x, z, width = 5.2, rotY = 0) {
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = baseY + (IS_SCALED_WORLD ? 0.06 : 0.28);
  const geo = _getSuburbFenceGeo(width);

  const col =
    Math.abs(rotY) > 1e-3 && typeof world.addObbCollider === 'function'
      ? world.addObbCollider(x, z, width, 0.65, rotY, yBase + 1.1, yBase)
      : world.addCollider(x, z, width, 0.45, yBase + 1.1, yBase);

  if (world.destructibles) {
    const proxy = new THREE.Object3D();
    proxy.position.set(x, yBase, z);
    proxy.rotation.y = rotY;
    _registerSuburbInstancedProp(world, `fence_${width.toFixed(2)}`, geo, SHARED_FENCE_MAT, proxy, {
      type: 'fence', hp: 10, radius: width * 0.45, height: 1.1, colliders: [col],
      debrisColors: [LEGO_COLORS.white, LEGO_COLORS.lightGrey],
      studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 }, groundY: yBase
    });
  } else {
    const mesh = new THREE.Mesh(geo, SHARED_FENCE_MAT);
    mesh.position.set(x, yBase, z);
    mesh.rotation.y = rotY;
    mesh.receiveShadow = true;
    world.scene.add(mesh);
  }
}

export function spawnBreakableMailbox(world, x, z, seed = 0, rotY = 0) {
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = baseY + (IS_SCALED_WORLD ? 0.06 : 0.28);
  const vIdx = Math.abs(seed) % _MAILBOX_HEAD_HEXES.length;
  const geo = _getSuburbMailboxGeo(vIdx);

  const col =
    Math.abs(rotY) > 1e-3 && typeof world.addObbCollider === 'function'
      ? world.addObbCollider(x, z, 0.65, 0.75, rotY, yBase + 1.5, yBase)
      : world.addCollider(x, z, 0.65, 0.75, yBase + 1.5, yBase);

  if (world.destructibles) {
    const proxy = new THREE.Object3D();
    proxy.position.set(x, yBase, z);
    proxy.rotation.y = rotY;
    _registerSuburbInstancedProp(world, `mailbox_${vIdx}`, geo, SHARED_MAILBOX_VC_MAT, proxy, {
      type: 'mailbox', hp: 8, radius: 0.75, height: 1.5, colliders: [col],
      debrisColors: [LEGO_COLORS.blue, LEGO_COLORS.red, LEGO_COLORS.white, LEGO_COLORS.yellow],
      studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 }, groundY: yBase
    });
  } else {
    const mesh = new THREE.Mesh(geo, SHARED_MAILBOX_VC_MAT);
    mesh.position.set(x, yBase, z);
    mesh.rotation.y = rotY;
    world.scene.add(mesh);
  }
}
