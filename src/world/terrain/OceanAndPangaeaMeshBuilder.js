import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial, applyAnimatedLegoWaterShader } from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, mergeColoredGeometries, makeFastBox } from '../buildings/GeometryMergeUtils.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from '../MetroSystemBuilder.js';
import {
  MAIN_WEST_POLYGON,
  EAST_PENINSULA_POLYGON,
  PRISON_ISLAND_POLYGON,
  ARCHIPELAGO_ISLETS,
  HORIZON_MOUNTAINS,
  REGION_BORDER_LINES,
  pointInPolygon,
  getIsletSampleAt,
  getDistanceToCoastAt,
  getPangaeaElevationAt,
  getHighwayDistanceAt,
  getRegionBiomeHexAt,
  isPointOnOrganicLand
} from '../CoastlineProfile.js';
import { WORLD_SCALE, IS_SCALED_WORLD, ws, wsBounds, fromWs } from '../core/WorldLayoutScale.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import {
  pushChunkedTerrainSectorGeos,
  addChunkedArrayToScene,
  createSmoothIsletDomeGeo,
  pushSculptedHorizonMountainGeos
} from './BridgeAndPierSpecs.js';
import { buildPangaeaHighwaysAndLandmarks, flushPangaeaTreeInstances } from './PangaeaHighwaysAndLandmarks.js';

/**
 * Gera faixa contínua e suave de praia/baixio seguindo os segmentos suavizados do litoral
 * com normais externas reais: borda terrestre (+0.28 m) -> linha d'água (+0.02 m) -> baixio (-0.58 m),
 * mais afloramentos rochosos inclinados na Ilha da Prisão.
 */
export function buildSmoothCoastalBeachRibbon(poly, opts = {}) {
  const { ribbonGeos, cliffGeos, clampFn = null, isPrison = false, skipRiverX = null, urbanFilterFn = null, palette } = opts;
  const n = poly.length;
  if (n < 3) return;

  const edgeNormals = new Array(n);
  const edgeActive = new Array(n).fill(false);
  const riverTol = ws(3);
  const canalXs = [ws(-384), ws(-120), ws(252)];

  for (let i = 0; i < n; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[(i + 1) % n];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    let nx = -dz / len;
    let nz = dx / len;
    const mx = (ax + bx) * 0.5;
    const mz = (az + bz) * 0.5;
    if (pointInPolygon(mx + nx * 4, mz + nz * 4, poly)) {
      nx = -nx;
      nz = -nz;
    }
    edgeNormals[i] = [nx, nz];
    if (len < 0.8 || len > ws(360)) continue;
    if (skipRiverX !== null && Math.abs(ax - skipRiverX) < riverTol && Math.abs(bx - skipRiverX) < riverTol) continue;
    if (!isPrison && mz > ws(1000) && canalXs.some((cx) => Math.abs(mx - cx) < 20)) continue;
    if (isPrison && mx > ws(1300) && mx < ws(1450) && mz < ws(1165)) continue;
    if (isPrison && mx < ws(958) && mz > ws(1470) && mz < ws(1630)) continue;
    edgeActive[i] = true;
  }

  const vertNormals = new Array(n);
  for (let i = 0; i < n; i++) {
    const ePrev = edgeNormals[(i - 1 + n) % n];
    const eCurr = edgeNormals[i];
    let vx = ePrev[0] + eCurr[0];
    let vz = ePrev[1] + eCurr[1];
    const vLen = Math.hypot(vx, vz);
    vx = vLen < 1e-4 ? eCurr[0] : vx / vLen;
    vz = vLen < 1e-4 ? eCurr[1] : vz / vLen;
    const miter = Math.min(1.35, 1 / Math.max(0.65, vx * eCurr[0] + vz * eCurr[1]));
    vertNormals[i] = [vx * miter, vz * miter];
  }

  const chains = [];
  if (edgeActive.every(Boolean)) {
    const loop = [];
    for (let i = 0; i <= n; i++) loop.push(i % n);
    chains.push(loop);
  } else {
    let startIdx = 0;
    for (let i = 0; i < n; i++) {
      if (edgeActive[i] && !edgeActive[(i - 1 + n) % n]) {
        startIdx = i;
        break;
      }
    }
    let cur = null;
    for (let step = 0; step < n; step++) {
      const idx = (startIdx + step) % n;
      if (edgeActive[idx]) {
        if (!cur) cur = [idx];
        cur.push((idx + 1) % n);
      } else if (cur) {
        chains.push(cur);
        cur = null;
      }
    }
    if (cur) chains.push(cur);
  }

  const ringCols = [
    isPrison ? palette.cPrisonDry : palette.cSandDry,
    isPrison ? palette.cPrisonWet : palette.cSandWet,
    palette.cMidShoal,
    palette.cDeepShoal
  ];

  for (let c = 0; c < chains.length; c++) {
    const chain = chains[c];
    const m = chain.length;
    if (m < 2) continue;

    const vCount = m * 4;
    const positions = new Float32Array(vCount * 3);
    const uvs = new Float32Array(vCount * 2);
    const colors = new Float32Array(vCount * 3);
    const indices = [];
    let arcDist = 0;

    for (let k = 0; k < m; k++) {
      const vIdx = chain[k];
      const [px, pz] = poly[vIdx];
      const [nx, nz] = vertNormals[vIdx];
      if (k > 0) arcDist += Math.hypot(px - poly[chain[k - 1]][0], pz - poly[chain[k - 1]][1]);

      let landX = px - nx * 12;
      let landZ = pz - nz * 12;
      let landY = 0.28;
      if (clampFn && (!urbanFilterFn || urbanFilterFn(px, pz))) {
        const [cx, cz] = clampFn(px, pz);
        const span = Math.hypot(px - cx, pz - cz);
        if (span > 2) {
          landX = cx - nx * 2.0;
          landZ = cz - nz * 2.0;
        }
        if (isPrison && cliffGeos && span > ws(34) && k < m - 1 && vIdx % 6 === 0) {
          const cliffH = 2.8 + ((vIdx * 19) % 6) * 0.85;
          const rBase = 6.5 + ((vIdx * 13) % 5) * 1.4;
          const prism = new THREE.CylinderGeometry(rBase * 0.48, rBase, cliffH, 6, 1);
          prism.scale(1.25, 1.0, 0.74);
          prism.rotateY(Math.atan2(-nx, nz) + ((vIdx % 5) - 2) * 0.18);
          prism.rotateX((((vIdx * 7) % 5) - 2) * 0.07);
          prism.rotateZ((((vIdx * 11) % 5) - 2) * 0.07);
          prism.translate(px - (px - cx) * 0.3, cliffH * 0.42 - 0.85, pz - (pz - cz) * 0.3);
          cliffGeos.push(prism);
        }
      } else {
        landY = Math.max(0.28, getPangaeaElevationAt(landX, landZ) + 0.03);
      }

      const shoalDist = !isPrison && pz > ws(1000) && Math.abs(px - ws(-1380)) < ws(110) ? 10.5 : 20.0;
      const rx = [landX, px, px + nx * (shoalDist * 0.45), px + nx * shoalDist];
      const ry = [landY, 0.02, -0.28, -0.58];
      const rz = [landZ, pz, pz + nz * (shoalDist * 0.45), pz + nz * shoalDist];
      const uCoord = arcDist * 0.025;

      for (let r = 0; r < 4; r++) {
        const vi = k * 4 + r;
        positions[vi * 3] = rx[r];
        positions[vi * 3 + 1] = ry[r];
        positions[vi * 3 + 2] = rz[r];
        uvs[vi * 2] = uCoord;
        uvs[vi * 2 + 1] = r / 3;
        colors[vi * 3] = ringCols[r].r;
        colors[vi * 3 + 1] = ringCols[r].g;
        colors[vi * 3 + 2] = ringCols[r].b;
      }
    }

    for (let k = 0; k < m - 1; k++) {
      for (let r = 0; r < 3; r++) {
        const i0 = k * 4 + r;
        const i1 = i0 + 1;
        const i2 = (k + 1) * 4 + r;
        const i3 = i2 + 1;
        const crossY =
          (positions[i2 * 3 + 2] - positions[i0 * 3 + 2]) * (positions[i1 * 3] - positions[i0 * 3]) -
          (positions[i2 * 3] - positions[i0 * 3]) * (positions[i1 * 3 + 2] - positions[i0 * 3 + 2]);
        if (crossY >= 0) indices.push(i0, i2, i1, i1, i2, i3);
        else indices.push(i0, i1, i2, i1, i3, i2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    ribbonGeos.push(geo);
  }
}

/**
 * Constrói o Oceano Atlântico ESTRITAMENTE fora da terra firme (ZERO água sob a Ilha Continental ou Subsolo do Metrô!)
 * e gera as malhas subdivididas com relevo urbano contínuo na Ilha Principal e na Península Leste!
 */
export function buildOceanAndMainIsland(world) {
  const oceanMat = new THREE.MeshStandardMaterial({ color: 0x071924, roughness: 0.22, metalness: 0.16 });
  const waterGeos = [];
  const addWaterPlate = (minX, maxX, minZ, maxZ, yLevel) => {
    const w = maxX - minX;
    const d = maxZ - minZ;
    if (w <= 0 || d <= 0) return;
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate((minX + maxX) * 0.5, yLevel, (minZ + maxZ) * 0.5);
    waterGeos.push(g);
  };

  addWaterPlate(ws(538), ws(582), ws(-2950), ws(1080), -3.55);
  for (const cx of [ws(-384), ws(-120), ws(252)]) addWaterPlate(cx - 12, cx + 12, ws(724), ws(1070), -0.52);
  addWaterPlate(ws(-14500), ws(-1825), ws(-14500), ws(14500), -0.45);
  addWaterPlate(ws(-1825), ws(540), ws(-14500), ws(-1320), -0.45);
  addWaterPlate(ws(540), ws(580), ws(-14500), ws(-1325), -0.45);
  addWaterPlate(ws(580), ws(14500), ws(-14500), ws(-1320), -0.45);
  addWaterPlate(ws(1628), ws(14500), ws(-1320), ws(14500), -0.45);
  addWaterPlate(ws(580), ws(1628), ws(735), ws(14500), -0.45);
  addWaterPlate(ws(-1825), ws(540), ws(1035), ws(14500), -0.45);
  addWaterPlate(ws(540), ws(580), ws(1075), ws(14500), -0.45);

  const oceanGeo = mergeBufferGeometries(waterGeos);
  oceanGeo.computeBoundingBox();
  oceanGeo.computeBoundingSphere();
  const mergedOcean = new THREE.Mesh(oceanGeo, oceanMat);
  for (let i = 0; i < waterGeos.length; i++) waterGeos[i].dispose();
  mergedOcean.castShadow = false;
  mergedOcean.receiveShadow = false;
  mergedOcean.matrixAutoUpdate = false;
  mergedOcean.updateMatrix();
  mergedOcean.userData.isOcean = true;
  world.scene.add(mergedOcean);

  const asphaltMat = new THREE.MeshPhysicalMaterial({
    color: LEGO_COLORS.asphalt,
    roughness: 0.28,
    metalness: 0.16,
    clearcoat: 0.56,
    clearcoatRoughness: 0.24
  });

  const islandGeos = [];
  const cutZones = METRO_ISLAND_CUTOUTS.map((c) => ({
    minX: c.minX - 4,
    maxX: c.maxX + 4,
    minZ: c.minZ - 4,
    maxZ: c.maxZ + 4
  }));

  for (const cz of cutZones) {
    for (const r of sliceRectAroundCutouts(cz, METRO_ISLAND_CUTOUTS)) {
      const rw = r.maxX - r.minX;
      const rd = r.maxZ - r.minZ;
      if (rw <= 0.02 || rd <= 0.02) continue;
      const rcx = (r.minX + r.maxX) * 0.5;
      const rcz = (r.minZ + r.maxZ) * 0.5;
      islandGeos.push(makeFastBox(rw, 0.5, rd, rcx, getUrbanCityReliefY(rcx, rcz) - 0.25, rcz));
    }
  }

  const pushSegmentedSkirt = (geos, x0, x1, z0, z1) => {
    const step = 720;
    for (let sx = x0; sx < x1 - 0.01; sx += step) {
      const ex = Math.min(x1, sx + step);
      const sw = ex - sx, sm = (sx + ex) * 0.5;
      geos.push(makeFastBox(sw, 4.5, 1.5, sm, -2.25, z0 + 0.75), makeFastBox(sw, 4.5, 1.5, sm, -2.25, z1 - 0.75));
    }
    for (let sz = z0; sz < z1 - 0.01; sz += step) {
      const ez = Math.min(z1, sz + step);
      const sd = ez - sz, sm = (sz + ez) * 0.5;
      geos.push(makeFastBox(1.5, 4.5, sd, x0 + 0.75, -2.25, sm), makeFastBox(1.5, 4.5, sd, x1 - 0.75, -2.25, sm));
    }
  };

  const [mainMinX, mainMaxX, mainMinZ, mainMaxZ, aeroSplitX] = [ws(-1825), ws(540), ws(-1320), ws(780), ws(-1040)];
  pushChunkedTerrainSectorGeos(islandGeos, mainMinX, aeroSplitX, mainMinZ, mainMaxZ, IS_SCALED_WORLD ? 120 : 28, 720);
  for (const s of sliceRectAroundCutouts({ minX: aeroSplitX, maxX: mainMaxX, minZ: mainMinZ, maxZ: mainMaxZ }, cutZones)) {
    if (s.maxX - s.minX <= 0.05 || s.maxZ - s.minZ <= 0.05) continue;
    pushChunkedTerrainSectorGeos(islandGeos, s.minX, s.maxX, s.minZ, s.maxZ, IS_SCALED_WORLD ? 32 : 14, 720);
  }
  pushSegmentedSkirt(islandGeos, mainMinX, mainMaxX, mainMinZ, mainMaxZ);

  if (!world.waterShaderUniforms) world.waterShaderUniforms = { uTime: { value: 0 } };
  applyAnimatedLegoWaterShader(oceanMat, world.waterShaderUniforms, {
    waveAmp: 0.08,
    waveFreq: 0.13,
    fresnelBoost: 0.25,
    variant: 'ocean'
  });
  world.oceanMaterial = oceanMat;
  world.oceanMesh = mergedOcean;
  addChunkedArrayToScene(world.scene, islandGeos, asphaltMat, { receiveShadow: true, chunkSize: 1200 });

  const [eastMinX, eastMaxX, eastMinZ, eastMaxZ] = [ws(580), ws(1628), ws(-1320), ws(735)];
  const eastGeos = [];
  pushSegmentedSkirt(eastGeos, eastMinX, eastMaxX, eastMinZ, eastMaxZ);
  pushChunkedTerrainSectorGeos(eastGeos, eastMinX, eastMaxX, eastMinZ, eastMaxZ, IS_SCALED_WORLD ? 34 : 20, 720);
  addChunkedArrayToScene(world.scene, eastGeos, asphaltMat, { receiveShadow: true, chunkSize: 1200 });

  buildPangaeaSupercontinentAndSandCoast(world, asphaltMat);
}

export function buildPangaeaSupercontinentAndSandCoast(world, sharedAsphaltMat = null) {
  const asphaltMat =
    sharedAsphaltMat ||
    getLegoMaterial(LEGO_COLORS.asphalt, { roughness: 0.28, metalness: 0.16, clearcoat: 0.56, clearcoatRoughness: 0.24 });
  const terrainMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.72, metalness: 0.04 });

  const palette = {
    cSandDry: new THREE.Color(0x8c7853),
    cSandWet: new THREE.Color(0x4f422d),
    cPrisonDry: new THREE.Color(0x5b564b),
    cPrisonWet: new THREE.Color(0x383630),
    cMidShoal: new THREE.Color(0x2c3838),
    cDeepShoal: new THREE.Color(0x162933),
    cRock: new THREE.Color(0x3b4252),
    cForest: new THREE.Color(0x1f3d23),
    cBank: new THREE.Color(0x22361c),
    cAsphaltShoulder: new THREE.Color(0x1b202b)
  };
  const cTmpBiome = new THREE.Color();
  const cOut = new THREE.Color();

  const buildLocalOriginPangaeaChunk = (x0, x1, z0, z1, cellSize = 44 * WORLD_SCALE) => {
    const w = x1 - x0;
    const d = z1 - z0;
    if (w < 4 || d < 4) return;
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const isOuterDistant = Math.abs(cx) > ws(1950) || Math.abs(cz) > ws(1950);
    const effCell = isOuterDistant ? cellSize * 1.85 : cellSize;
    const maxSeg = isOuterDistant ? 16 : 24;
    const segX = Math.min(maxSeg, Math.max(2, Math.round(w / effCell)));
    const segZ = Math.min(maxSeg, Math.max(2, Math.round(d / effCell)));
    const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    let anyLand = false;
    let minH = Infinity;
    let maxH = -Infinity;

    for (let i = 0; i < pos.count; i++) {
      const wx = cx + pos.getX(i);
      const wz = cz + pos.getZ(i);
      const hy = getPangaeaElevationAt(wx, wz);
      pos.setY(i, hy);
      if (hy > -0.42) anyLand = true;
      if (hy < minH) minH = hy;
      if (hy > maxH) maxH = hy;

      const onLand = isPointOnOrganicLand(wx, wz);
      const coastDist = getDistanceToCoastAt(wx, wz, 64);
      const hwyDist = getHighwayDistanceAt(wx, wz);
      if (!onLand || hy < 0.32) {
        cOut.copy(palette.cSandWet).lerp(palette.cSandDry, Math.max(0, Math.min(1, (hy + 0.45) / 0.85)));
      } else if (wz < ws(-1318) && Math.abs(fromWs(wx) - 560) < 42) {
        cOut.copy(palette.cBank);
      } else if (coastDist < 52) {
        cTmpBiome.setHex(getRegionBiomeHexAt(wx, wz));
        const t = Math.max(0, Math.min(1, (coastDist - 18) / 34));
        cOut.copy(palette.cSandDry).lerp(cTmpBiome, t * t);
      } else if (hwyDist < 22) {
        cTmpBiome.setHex(getRegionBiomeHexAt(wx, wz));
        cOut.copy(palette.cAsphaltShoulder).lerp(cTmpBiome, Math.max(0, Math.min(1, (hwyDist - 12) / 10)));
      } else {
        cOut.setHex(getRegionBiomeHexAt(wx, wz));
        if (hy > 14.5) cOut.lerp(palette.cRock, Math.min(0.65, (hy - 14.5) / 12.0));
      }
      colors[i * 3] = cOut.r;
      colors[i * 3 + 1] = cOut.g;
      colors[i * 3 + 2] = cOut.b;
    }

    if (!anyLand) {
      geo.dispose();
      return;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const normAttr = geo.attributes.normal;
    if (maxH - minH >= 0.004) {
      const eps = 2.0;
      const twoEps = 2 * eps;
      for (let i = 0; i < pos.count; i++) {
        const wx = cx + pos.getX(i);
        const wz = cz + pos.getZ(i);
        const nx = getPangaeaElevationAt(wx - eps, wz) - getPangaeaElevationAt(wx + eps, wz);
        const nz = getPangaeaElevationAt(wx, wz - eps) - getPangaeaElevationAt(wx, wz + eps);
        const invLen = 1 / Math.hypot(nx, twoEps, nz);
        normAttr.setXYZ(i, nx * invLen, twoEps * invLen, nz * invLen);
      }
    } else {
      for (let i = 0; i < pos.count; i++) normAttr.setXYZ(i, 0, 1, 0);
    }
    normAttr.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, terrainMat);
    mesh.position.set(cx, 0, cz);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    world.scene.add(mesh);
  };

  const sectorRegions = [
    wsBounds({ minX: -3480, maxX: 538, minZ: -3020, maxZ: -1320 }),
    wsBounds({ minX: 582, maxX: 3480, minZ: -2820, maxZ: -1320 }),
    wsBounds({ minX: -3480, maxX: -1825, minZ: -1320, maxZ: 2560 }),
    wsBounds({ minX: -1825, maxX: -1530, minZ: 1020, maxZ: 2560 }),
    wsBounds({ minX: 1628, maxX: 3480, minZ: -1320, maxZ: 140 })
  ];
  const chunkSpan = ws(640);
  const pCellSize = 44 * WORLD_SCALE;
  for (const reg of sectorRegions) {
    for (let x0 = reg.minX; x0 < reg.maxX - 1; x0 += chunkSpan) {
      const x1 = Math.min(reg.maxX, x0 + chunkSpan);
      for (let z0 = reg.minZ; z0 < reg.maxZ - 1; z0 += chunkSpan) {
        buildLocalOriginPangaeaChunk(x0, x1, z0, Math.min(reg.maxZ, z0 + chunkSpan), pCellSize);
      }
    }
  }

  const coastalRibbonGeos = [];
  const isletDomeGeos = [];
  const sandGeos = [];
  const cliffGeos = [];
  const turfGeos = [];
  const horizonGeos = [];
  const roadAsphaltGeos = [];
  const roadShoulderGeos = [];
  const roadYellowGeos = [];
  const pineTreeTransforms = [];
  const palmTreeTransforms = [];
  const borderAccentGeos = { '#fb923c': [], '#4ade80': [], '#fde047': [], '#94a3b8': [], '#ef4444': [], '#f59e0b': [], '#38bdf8': [] };

  buildSmoothCoastalBeachRibbon(MAIN_WEST_POLYGON, {
    ribbonGeos: coastalRibbonGeos,
    cliffGeos,
    skipRiverX: ws(538),
    clampFn: (x, z) => [THREE.MathUtils.clamp(x, ws(-1540), ws(535)), THREE.MathUtils.clamp(z, ws(-1315), ws(1040))],
    urbanFilterFn: (x, z) => z >= ws(1020) && x >= ws(-1545),
    palette
  });
  buildSmoothCoastalBeachRibbon(EAST_PENINSULA_POLYGON, {
    ribbonGeos: coastalRibbonGeos,
    cliffGeos,
    skipRiverX: ws(582),
    clampFn: (x, z) => [THREE.MathUtils.clamp(x, ws(585), ws(1624)), THREE.MathUtils.clamp(z, ws(-1315), ws(732))],
    urbanFilterFn: (x, z) => z >= ws(720) || (x >= ws(1622) && z >= ws(120)),
    palette
  });
  buildSmoothCoastalBeachRibbon(PRISON_ISLAND_POLYGON, {
    ribbonGeos: coastalRibbonGeos,
    cliffGeos,
    isPrison: true,
    clampFn: (x, z) => [THREE.MathUtils.clamp(x, ws(960), ws(1790)), THREE.MathUtils.clamp(z, ws(1130), ws(1980))],
    palette
  });

  buildPangaeaHighwaysAndLandmarks(world, {
    sandGeos, cliffGeos, turfGeos, roadAsphaltGeos, roadShoulderGeos, roadYellowGeos, borderAccentGeos, pineTreeTransforms, palmTreeTransforms
  });

  for (const isl of ARCHIPELAGO_ISLETS) {
    isletDomeGeos.push(createSmoothIsletDomeGeo(isl, palette));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + isl.seed * 0.3;
      const distR = 0.38 + (k % 2) * 0.18;
      const tx = isl.x + Math.cos(a) * isl.rx * distR;
      const tz = isl.z + Math.sin(a) * isl.rz * distR;
      const sample = getIsletSampleAt(tx, tz);
      pineTreeTransforms.push({ x: tx, y: sample ? sample.height - 0.15 : isl.peakY * 0.45, z: tz, s: 1.0 + (k % 3) * 0.32 });
    }
  }

  for (let i = 0; i < HORIZON_MOUNTAINS.length; i++) pushSculptedHorizonMountainGeos(horizonGeos, HORIZON_MOUNTAINS[i], i);

  const blockedAvenuesX = [-384, -252, -120, 0, 120, 252, 384, -1215, 964].map(ws);
  const blockedAvenuesZ = [-382, -250, -117, 0, 134, 402, 710, -1285, -908].map(ws);
  const aveMargin = IS_SCALED_WORLD ? 30 : 26;
  const isNearAvenue = (val, list) => list.some((a) => Math.abs(val - a) < aveMargin);
  const driveOverIds = new Set([
    'border_oeste_aero', 'border_ind_porto', 'border_cdd_centro',
    'border_boreal_suburbio', 'border_ind_eolico', 'border_aero_dunas'
  ]);

  for (const brd of REGION_BORDER_LINES) {
    const [x1, z1] = brd.from;
    const [x2, z2] = brd.to;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const isHoriz = Math.abs(dx) >= Math.abs(dz);
    const steps = Math.max(1, Math.floor(Math.hypot(dx, dz) / ws(40)));
    const bucket = borderAccentGeos[brd.color] || (borderAccentGeos[brd.color] = []);
    const isDriveOver = driveOverIds.has(brd.id);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      if (isHoriz ? isNearAvenue(px, blockedAvenuesX) : isNearAvenue(pz, blockedAvenuesZ)) continue;
      if (!isPointOnOrganicLand(px, pz)) continue;
      const py = Math.max(getUrbanCityReliefY(px, pz), getPangaeaElevationAt(px, pz));
      if (isDriveOver) {
        bucket.push(makeFastBox(isHoriz ? 18 : 1.5, 0.16, isHoriz ? 1.5 : 18, px, py + 0.1, pz));
      } else {
        bucket.push(makeFastBox(isHoriz ? 16 : 1.3, 0.65, isHoriz ? 1.3 : 16, px, py + 0.34, pz));
        cliffGeos.push(makeFastBox(isHoriz ? 1.6 : 1.8, 1.15, isHoriz ? 1.8 : 1.6, px, py + 0.56, pz));
      }
    }
  }

  const flushBatch = (geos, mat, opts = {}) => {
    if (!geos.length) return;
    addChunkedArrayToScene(world.scene, geos, mat, { chunkSize: 2200, receiveShadow: true, ...opts });
  };

  const borderEntries = [];
  for (const [hexStr, list] of Object.entries(borderAccentGeos)) {
    if (!list.length) continue;
    const col = new THREE.Color(parseInt(hexStr.replace('#', ''), 16));
    for (let i = 0; i < list.length; i++) borderEntries.push({ geo: list[i], color: col });
  }
  if (borderEntries.length) coastalRibbonGeos.push(mergeColoredGeometries(borderEntries));

  flushBatch(isletDomeGeos, terrainMat, { chunkSize: 2400 });
  flushBatch(coastalRibbonGeos, terrainMat);
  flushBatch(sandGeos, getLegoMaterial(0x7d6b4a, { roughness: 0.82 }));
  flushBatch(turfGeos, getLegoMaterial(0x1f3d23, { roughness: 0.78 }));
  flushBatch(cliffGeos, getLegoMaterial(0x282f3c, { roughness: 0.84 }));
  flushBatch(roadShoulderGeos, getLegoMaterial(0x1e2430, { roughness: 0.82 }));
  flushBatch(roadAsphaltGeos, asphaltMat);
  flushBatch(
    roadYellowGeos,
    new THREE.MeshBasicMaterial({ color: 0xfacc15, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    { receiveShadow: false }
  );
  flushBatch(
    horizonGeos,
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.92, metalness: 0.04 }),
    { receiveShadow: false, chunkSize: 3600 }
  );

  flushPangaeaTreeInstances(world, pineTreeTransforms, palmTreeTransforms);
}
