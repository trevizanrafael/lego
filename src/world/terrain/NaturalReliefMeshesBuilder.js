import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { makeFastBox, flushSpatialChunkedBuckets } from '../buildings/GeometryMergeUtils.js';
import { IS_SCALED_WORLD, ROAD, ws, fromWs } from '../core/WorldLayoutScale.js';
import {
  getNorthSuburbPlateauY,
  getSouthwestBeachReliefY,
  getUrbanCityReliefY
} from './UrbanReliefFunctions.js';

/**
 * Batcher dedicado de viadutos e relevo natural (contraste rodoviário + sombras reais).
 */
export function createReliefAndViaductBatcher() {
  const palette = {
    viaduct_asphalt: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.62,
      metalness: 0.06,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    }),
    viaduct_shoulder: getLegoMaterial(0xe2e8f0, { roughness: 0.3, clearcoat: 0.28 }),
    viaduct_concrete: getLegoMaterial(0xcbd5e1, { roughness: 0.32, clearcoat: 0.28 }),
    viaduct_dark_concrete: getLegoMaterial(0x64748b, { roughness: 0.4, clearcoat: 0.22 }),
    viaduct_pillar: getLegoMaterial(0x94a3b8, { roughness: 0.36, clearcoat: 0.24 }),
    safety_yellow: getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.48 }),
    hazard_black: getLegoMaterial(0x0f172a, { roughness: 0.32, clearcoat: 0.3 }),
    highway_green: getLegoMaterial(0x15803d, { roughness: 0.28, clearcoat: 0.38 }),
    steel_pole: getLegoMaterial(0x475569, { roughness: 0.26, metalness: 0.52, clearcoat: 0.5 }),
    brass_gold: getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.18, metalness: 0.7, clearcoat: 0.8 }),
    cliff_rock_dark: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.68, metalness: 0.06 }),
    cliff_rock_mid: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.62, metalness: 0.05 }),
    cliff_rock_light: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.56, metalness: 0.05 }),
    park_turf_top: getLegoMaterial(0x16a34a, { roughness: 0.36, clearcoat: 0.28 }),
    park_turf_mid: getLegoMaterial(0x15803d, { roughness: 0.4, clearcoat: 0.24 }),
    park_stone: getLegoMaterial(0xe2e8f0, { roughness: 0.3, clearcoat: 0.35 }),
    wood_bench: getLegoMaterial(0x78350f, { roughness: 0.42, clearcoat: 0.25 }),
    dune_sand: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.58, metalness: 0.02 }),
    dune_wet: new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.52, metalness: 0.04 }),
    lane_white: new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3
    }),
    lane_yellow: new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3
    }),
    lamp_glow: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    sea_foam: new THREE.MeshBasicMaterial({ color: 0xf8fafc })
  };

  const buckets = new Map();
  for (const k of Object.keys(palette)) {
    buckets.set(k, []);
  }

  const studPositionsYellow = [];
  const studPositionsStone = [];

  const pushMatrixTransformedGeo = (key, geo, x, y, z, rotX = 0, rotY = 0, rotZ = 0) => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    buckets.get(key).push(geo);
  };

  return {
    studPositionsYellow,
    studPositionsStone,
    addBox(key, w, h, d, x, y, z) {
      buckets.get(key).push(makeFastBox(w, h, d, x, y, z));
    },
    addTiltedBox(key, w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
      const geo = new THREE.BoxGeometry(w, h, d);
      pushMatrixTransformedGeo(key, geo, x, y, z, rotX, rotY, rotZ);
    },
    addGeometry(key, geo) {
      if (geo) buckets.get(key).push(geo);
    },
    addCylinder(key, rTop, rBot, h, x, y, z, segs = 12, rotX = 0, rotY = 0, rotZ = 0) {
      const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
      pushMatrixTransformedGeo(key, geo, x, y, z, rotX, rotY, rotZ);
    },
    flush(scene) {
      const castShadowSet = new Set([
        'viaduct_concrete',
        'viaduct_dark_concrete',
        'viaduct_pillar',
        'safety_yellow',
        'highway_green',
        'cliff_rock_dark',
        'cliff_rock_mid',
        'park_turf_top',
        'park_stone'
      ]);
      flushSpatialChunkedBuckets(scene, buckets, palette, {
        chunkSize: ws(512),
        preserveKeys: new Set(['viaduct_concrete']),
        castShadowFn: (key) => castShadowSet.has(key),
        receiveShadowFn: (_key, mat) => !mat.isMeshBasicMaterial
      });
      buckets.clear();

      studPositionsYellow.length = 0;
      studPositionsStone.length = 0;
    }
  };
}

export function buildNorthSuburbCoastalAndRiverCliffs(world, batcher) {
  let rockIdx = 0;
  const cliffStep = IS_SCALED_WORLD ? 28 : 14;
  const zRef = ws(-1318);
  for (let x = ws(-650); x <= ws(534); x += cliffStep) {
    const topY = getNorthSuburbPlateauY(x, zRef);
    if (topY < 1.0) continue;
    const hMain = topY + 2.4;
    const key1 = rockIdx % 2 === 0 ? 'cliff_rock_dark' : 'cliff_rock_mid';
    const key2 = rockIdx % 3 === 0 ? 'cliff_rock_light' : 'cliff_rock_mid';

    batcher.addBox(key1, cliffStep + 0.5, hMain, 5.8, x, topY - hMain * 0.5, zRef - 2.2);
    batcher.addBox(
      key2,
      cliffStep * 0.8,
      hMain * 0.62,
      4.0,
      x + ((rockIdx % 3) - 1) * 1.4,
      hMain * 0.31 - 0.8,
      zRef - 5.6
    );
    batcher.addBox('cliff_rock_dark', cliffStep * 0.6, 2.8, 3.4, x - 1.2, 0.5, zRef - 7.8);
    batcher.addBox('sea_foam', cliffStep + 0.2, 0.14, 2.4, x, -0.36, zRef - 9.2);

    batcher.addBox('viaduct_concrete', cliffStep + 0.2, 1.08, 1.1, x, topY + 0.54, zRef - 0.2);
    world.addCollider(x, zRef - 0.5, cliffStep + 0.2, 1.8, topY + 1.25, topY - 1.5);
    rockIdx++;
  }

  const xRef = ws(538);
  for (let z = ws(-546); z >= ws(-1316); z -= cliffStep) {
    const topY = getNorthSuburbPlateauY(ws(534), z);
    if (topY < 0.6) continue;
    const hMain = topY + 2.4;
    const key1 = rockIdx % 2 === 0 ? 'cliff_rock_mid' : 'cliff_rock_dark';

    batcher.addBox(key1, 5.4, hMain, cliffStep + 0.5, xRef + 1.8, topY - hMain * 0.5, z);
    batcher.addBox('cliff_rock_light', 3.4, hMain * 0.56, cliffStep * 0.78, xRef + 4.6, hMain * 0.28 - 0.8, z);
    batcher.addBox('viaduct_concrete', 1.1, 1.05, cliffStep + 0.2, xRef + 0.2, topY + 0.52, z);
    world.addCollider(xRef + 0.4, z, 1.8, cliffStep + 0.2, topY + 1.25, topY - 1.5);
    rockIdx++;
  }
}

export function buildCentralParkHillsAndMirante(world, batcher) {
  const minX = ws(-480);
  const maxX = ws(-98);
  const minZ = ws(166);
  const maxZ = ws(370);
  const width = maxX - minX;
  const depth = maxZ - minZ;

  const geo = new THREE.PlaneGeometry(width, depth, 92, 52);
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLowGrass = new THREE.Color(0x15803d);
  const cMidGrass = new THREE.Color(0x16a34a);
  const cHighGrass = new THREE.Color(0x22c55e);
  const cStonePath = new THREE.Color(0xcbd5e1);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const ux = fromWs(vx);
    const uz = fromWs(vz);
    const vy = getUrbanCityReliefY(vx, vz);
    if (vy <= 0.36) {
      pos.setY(i, 0.26);
      colors[i * 3] = cLowGrass.r;
      colors[i * 3 + 1] = cLowGrass.g;
      colors[i * 3 + 2] = cLowGrass.b;
    } else {
      pos.setY(i, vy + 0.04);
      const isRamp =
        (ux >= -202 && ux <= -114 && Math.abs(uz - 296) < 5.2) ||
        (uz >= 232 && uz <= 282 && Math.abs(ux - -215) < 5.0);
      if (isRamp) {
        tmp.copy(cStonePath);
      } else if (vy > 9.5) {
        tmp.copy(cMidGrass).lerp(cHighGrass, Math.min(1, (vy - 9.5) / 4.5));
      } else {
        tmp.copy(cLowGrass).lerp(cMidGrass, vy / 9.5);
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const hillMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.56,
      metalness: 0.03
    })
  );
  hillMesh.receiveShadow = true;
  hillMesh.castShadow = true;
  world.scene.add(hillMesh);

  const mx = ws(-215);
  const mz = ws(296);

  const addHillTerraceRings = (cx, cz, rx, rz, levels) => {
    for (const lv of levels) {
      const segs = 22;
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2;
        const px = cx + Math.cos(ang) * rx * lv.scale;
        const pz = cz + Math.sin(ang) * rz * lv.scale;
        if (Math.abs(px - mx) < 8.5 && pz < cz) continue;
        if (px > cx + 8 && Math.abs(pz - mz) < 8.5) continue;
        const ty = getUrbanCityReliefY(px, pz);
        if (ty < 1.5) continue;
        batcher.addBox('cliff_rock_mid', 6.8, 1.55, 6.8, px, ty - 0.58, pz);
        batcher.addBox('park_turf_top', 7.2, 0.38, 7.2, px, ty + 0.08, pz);
      }
    }
  };
  addHillTerraceRings(ws(-408), ws(268), ws(50), ws(40), [{ scale: 0.8 }, { scale: 0.54 }]);
  addHillTerraceRings(mx, mz, ws(58), ws(48), [{ scale: 0.82 }, { scale: 0.58 }, { scale: 0.4 }]);

  const stairStepZ = IS_SCALED_WORLD ? 3.2 : 2.2;
  for (let z = ws(233); z <= ws(281); z += stairStepZ) {
    const sy = getUrbanCityReliefY(mx, z);
    batcher.addBox('park_stone', 9.2, 0.48, stairStepZ + 0.15, mx, sy - 0.1, z);
    batcher.addBox('cliff_rock_light', 0.65, 0.88, stairStepZ + 0.15, mx - 4.7, sy + 0.32, z);
    batcher.addBox('cliff_rock_light', 0.65, 0.88, stairStepZ + 0.15, mx + 4.7, sy + 0.32, z);
  }
  const rampStepX = IS_SCALED_WORLD ? 4.5 : 3.0;
  for (let x = ws(-116); x >= ws(-198); x -= rampStepX) {
    const ry = getUrbanCityReliefY(x, mz);
    batcher.addBox('park_stone', rampStepX + 0.2, 0.45, 9.2, x, ry - 0.08, mz);
    batcher.addBox('cliff_rock_light', rampStepX + 0.2, 0.82, 0.65, x, ry + 0.3, mz - 4.7);
    batcher.addBox('cliff_rock_light', rampStepX + 0.2, 0.82, 0.65, x, ry + 0.3, mz + 4.7);
  }

  const my = 14.0;
  const miranteR = 14.2;

  batcher.addCylinder('park_stone', miranteR, miranteR + 1.0, 0.6, mx, my + 0.14, mz, 28);
  batcher.addCylinder('brass_gold', 4.8, 4.8, 0.64, mx, my + 0.17, mz, 20);
  batcher.addCylinder('viaduct_dark_concrete', 2.5, 2.5, 0.68, mx, my + 0.19, mz, 16);

  const railSegs = 24;
  for (let i = 0; i < railSegs; i++) {
    const ang = (i / railSegs) * Math.PI * 2;
    const rx = mx + Math.cos(ang) * (miranteR - 0.7);
    const rz = mz + Math.sin(ang) * (miranteR - 0.7);
    if (Math.hypot(rx - (mx + miranteR - 0.7), rz - mz) < 4.8) continue;
    if (Math.hypot(rx - mx, rz - (mz - miranteR + 0.7)) < 4.8) continue;

    batcher.addBox('park_stone', 2.6, 1.05, 2.6, rx, my + 0.85, rz);
    world.addCollider(rx, rz, 2.4, 2.4, my + 1.45, my);
  }

  const telescopes = [
    { x: mx + 9.6, z: mz - 5.4, rotY: Math.PI * 0.35 },
    { x: mx + 9.6, z: mz + 5.4, rotY: Math.PI * 0.62 },
    { x: mx - 7.0, z: mz - 8.6, rotY: -Math.PI * 0.78 }
  ];
  for (const tel of telescopes) {
    batcher.addCylinder('steel_pole', 0.18, 0.28, 1.35, tel.x, my + 1.05, tel.z, 10);
    batcher.addCylinder('brass_gold', 0.26, 0.26, 0.24, tel.x, my + 1.75, tel.z, 10);
    batcher.addTiltedBox('brass_gold', 0.32, 0.32, 1.35, tel.x, my + 1.98, tel.z, -0.14, tel.rotY, 0);
    batcher.addTiltedBox(
      'steel_pole',
      0.38,
      0.38,
      0.35,
      tel.x + Math.sin(tel.rotY) * 0.62,
      my + 2.06,
      tel.z + Math.cos(tel.rotY) * 0.62,
      -0.14,
      tel.rotY,
      0
    );
    world.addCollider(tel.x, tel.z, 1.1, 1.1, my + 2.2, my);
  }

  const benches = [
    { x: mx - 5.4, z: mz + 6.0, rotY: 0 },
    { x: mx + 5.0, z: mz + 6.6, rotY: 0 },
    { x: mx - 7.0, z: mz - 1.5, rotY: Math.PI / 2 },
    { x: mx - 10.6, z: mz + 2.2, rotY: Math.PI / 2 }
  ];
  for (const b of benches) {
    const w = b.rotY === 0 ? 3.4 : 1.1;
    const d = b.rotY === 0 ? 1.1 : 3.4;
    batcher.addBox('wood_bench', w, 0.52, d, b.x, my + 0.62, b.z);
    batcher.addBox('brass_gold', w * 0.92, 0.14, d * 0.92, b.x, my + 0.92, b.z);
  }
  for (const [lx, lz] of [
    [mx - 8.8, mz - 8.8],
    [mx + 8.8, mz - 8.8],
    [mx - 8.8, mz + 8.8],
    [mx + 8.8, mz + 8.8]
  ]) {
    batcher.addCylinder('hazard_black', 0.16, 0.24, 3.8, lx, my + 2.25, lz, 8);
    batcher.addBox('lamp_glow', 0.72, 0.72, 0.72, lx, my + 4.3, lz);
  }

  if (world.destructibles && typeof world.destructibles.spawnAmbientStud === 'function') {
    for (let s = 0; s < 12; s++) {
      const ang = (s / 12) * Math.PI * 2;
      const kind = s % 4 === 0 ? 'purple' : s % 2 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(
        mx + Math.cos(ang) * 6.0,
        my + 0.68,
        mz + Math.sin(ang) * 6.0,
        kind
      );
    }
  }

  world.mapBuildings.push({
    x: mx,
    z: mz,
    w: 28,
    d: 28,
    height: 15,
    color: '#4ade80',
    isLandmark: true,
    label: 'MIRANTE DO PARQUE (+14.0m)'
  });
}

export function buildSouthwestBeachDunesAndRockHeadland(world, batcher) {
  const minX = ws(-1352);
  const maxX = ws(-758);
  const minZ = ws(780);
  const maxZ = ws(1012);
  const width = maxX - minX;
  const depth = maxZ - minZ;

  const geo = new THREE.PlaneGeometry(width, depth, 76, 36);
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0xfde047);
  const cWarmSand = new THREE.Color(0xf59e0b);
  const cCoastalRock = new THREE.Color(0x64748b);
  const cCoastalVegetation = new THREE.Color(0x16a34a);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = getSouthwestBeachReliefY(vx, vz);
    pos.setY(i, vy > 0.08 ? vy : -0.04);

    if (vy > 6.2) {
      tmp.copy(cCoastalRock);
    } else if (vy > 4.2) {
      tmp.copy(cWarmSand).lerp(cCoastalVegetation, 0.35);
    } else {
      tmp.copy(cSand).lerp(cWarmSand, vy / 4.5);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const duneMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.68,
      metalness: 0.03
    })
  );
  duneMesh.receiveShadow = true;
  world.scene.add(duneMesh);

  for (const [rx, rz] of [
    [ws(-965), ws(928)],
    [ws(-1215), ws(898)]
  ]) {
    const ry = getSouthwestBeachReliefY(rx, rz);
    batcher.addBox('cliff_rock_dark', 16.0, 2.2, 12.0, rx, ry - 0.4, rz);
    batcher.addBox('cliff_rock_light', 10.5, 1.8, 8.5, rx + 2.5, ry + 0.35, rz - 1.5);
    batcher.addBox('wood_bench', 8.4, 0.35, 8.4, rx - 1.5, ry + 0.25, rz + 1.0);
  }
}

export function buildCDDCanyonPassRetainingWalls(batcher) {
  const wallStep = IS_SCALED_WORLD ? 32 : 24;
  const wzOff = IS_SCALED_WORLD ? ROAD.mainWidth * 0.5 + 2.5 : 16.5;
  for (let x = ws(-984); x <= ws(-540); x += wallStep) {
    for (const side of [-1, 1]) {
      const wz = side * wzOff;
      batcher.addBox('cliff_rock_dark', wallStep - 0.4, 5.2, 3.2, x, 2.6, wz);
      batcher.addBox('viaduct_concrete', wallStep - 0.2, 0.85, 3.5, x, 5.5, wz);
      batcher.addBox('safety_yellow', wallStep * 0.46, 0.42, 3.6, x - wallStep * 0.23, 1.2, wz);
      batcher.addBox('hazard_black', wallStep * 0.46, 0.42, 3.6, x + wallStep * 0.23, 1.2, wz);
    }
  }
}

export function buildNaturalReliefMeshes(world, batcher) {
  buildNorthSuburbCoastalAndRiverCliffs(world, batcher);
  buildCentralParkHillsAndMirante(world, batcher);
  buildSouthwestBeachDunesAndRockHeadland(world, batcher);
  buildCDDCanyonPassRetainingWalls(batcher);
}
