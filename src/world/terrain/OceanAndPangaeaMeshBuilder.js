import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  applyAnimatedLegoWaterShader
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeFastBox } from '../buildings/GeometryMergeUtils.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from '../MetroSystemBuilder.js';
import {
  MAIN_WEST_POLYGON,
  EAST_PENINSULA_POLYGON,
  PRISON_ISLAND_POLYGON,
  ARCHIPELAGO_ISLETS,
  HORIZON_MOUNTAINS,
  REGION_BORDER_LINES,
  getDistanceToCoastAt,
  getPangaeaElevationAt,
  getHighwayDistanceAt,
  getRegionBiomeHexAt,
  isPointOnOrganicLand
} from '../CoastlineProfile.js';
import { WORLD_SCALE, IS_SCALED_WORLD, ws, wsBounds, fromWs } from '../core/WorldLayoutScale.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import { pushChunkedTerrainSectorGeos, addChunkedArrayToScene } from './BridgeAndPierSpecs.js';
import {
  buildPangaeaHighwaysAndLandmarks,
  flushPangaeaTreeInstances
} from './PangaeaHighwaysAndLandmarks.js';

/**
 * Constrói o Oceano Atlântico ESTRITAMENTE fora da terra firme (ZERO água sob a Ilha Continental ou Subsolo do Metrô!)
 * e gera as malhas subdivididas com relevo urbano contínuo na Ilha Principal e na Península Leste!
 */
export function buildOceanAndMainIsland(world) {
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x071924,
    roughness: 0.24,
    metalness: 0.18
  });

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

  // 1) Leito profundo ESTRITO do Rio / Fjord Urbano Leste
  addWaterPlate(ws(538), ws(582), ws(-2950), ws(1080), -3.55);

  // 2) Leitos estreitos dos 3 Canais Estilo Santos na Praia Sul (meia-largura 12m em 1x!)
  for (const cx of [ws(-384), ws(-120), ws(252)]) {
    addWaterPlate(cx - 12, cx + 12, ws(724), ws(1070), -0.52);
  }

  // 3) Placas do Oceano Atlântico até o super-horizonte (±ws(14500)) ao redor da Pangeia
  addWaterPlate(ws(-14500), ws(-1825), ws(-14500), ws(14500), -0.45);
  addWaterPlate(ws(-1825), ws(540), ws(-14500), ws(-1320), -0.45);
  addWaterPlate(ws(540), ws(580), ws(-14500), ws(-1325), -0.45);
  addWaterPlate(ws(580), ws(14500), ws(-14500), ws(-1320), -0.45);
  addWaterPlate(ws(1628), ws(14500), ws(-1320), ws(14500), -0.45);
  addWaterPlate(ws(580), ws(1628), ws(735), ws(14500), -0.45);
  addWaterPlate(ws(-1825), ws(540), ws(1035), ws(14500), -0.45);
  addWaterPlate(ws(540), ws(580), ws(1075), ws(14500), -0.45);

  const mergedOcean = new THREE.Mesh(mergeBufferGeometries(waterGeos), oceanMat);
  for (let i = 0; i < waterGeos.length; i++) waterGeos[i].dispose();
  mergedOcean.receiveShadow = false;
  world.scene.add(mergedOcean);

  const asphaltMat = new THREE.MeshPhysicalMaterial({
    color: LEGO_COLORS.asphalt,
    roughness: 0.28,
    metalness: 0.16,
    clearcoat: 0.56,
    clearcoatRoughness: 0.24
  });

  // 4) Ilha Continental Principal (X = ws(-1825)..ws(540), Z = ws(-1320)..ws(780))
  const islandGeos = [];
  const cutZones = METRO_ISLAND_CUTOUTS.map((c) => ({
    minX: c.minX - 4,
    maxX: c.maxX + 4,
    minZ: c.minZ - 4,
    maxZ: c.maxZ + 4
  }));

  for (const cz of cutZones) {
    const slices = sliceRectAroundCutouts(cz, METRO_ISLAND_CUTOUTS);
    for (const r of slices) {
      const rw = r.maxX - r.minX;
      const rd = r.maxZ - r.minZ;
      if (rw <= 0.02 || rd <= 0.02) continue;
      const rcx = (r.minX + r.maxX) * 0.5;
      const rcz = (r.minZ + r.maxZ) * 0.5;
      const topY = getUrbanCityReliefY(rcx, rcz);
      islandGeos.push(makeFastBox(rw, 0.5, rd, rcx, topY - 0.25, rcz));
    }
  }

  const mainMinX = ws(-1825);
  const mainMaxX = ws(540);
  const mainMinZ = ws(-1320);
  const mainMaxZ = ws(780);
  const aeroSplitX = ws(-1040);

  pushChunkedTerrainSectorGeos(islandGeos, mainMinX, aeroSplitX, mainMinZ, mainMaxZ, IS_SCALED_WORLD ? 32 : 28, ws(512));
  const urbanTerrainSlices = sliceRectAroundCutouts(
    { minX: aeroSplitX, maxX: mainMaxX, minZ: mainMinZ, maxZ: mainMaxZ },
    cutZones
  );
  for (const s of urbanTerrainSlices) {
    if (s.maxX - s.minX <= 0.05 || s.maxZ - s.minZ <= 0.05) continue;
    pushChunkedTerrainSectorGeos(islandGeos, s.minX, s.maxX, s.minZ, s.maxZ, IS_SCALED_WORLD ? 20 : 14, ws(512));
  }

  const mainSpanX = mainMaxX - mainMinX;
  const mainSpanZ = mainMaxZ - mainMinZ;
  const mainMidX = (mainMinX + mainMaxX) * 0.5;
  const mainMidZ = (mainMinZ + mainMaxZ) * 0.5;
  islandGeos.push(
    makeFastBox(mainSpanX, 4.5, 1.5, mainMidX, -2.25, mainMinZ + 0.75),
    makeFastBox(mainSpanX, 4.5, 1.5, mainMidX, -2.25, mainMaxZ - 0.75),
    makeFastBox(1.5, 4.5, mainSpanZ, mainMinX + 0.75, -2.25, mainMidZ),
    makeFastBox(1.5, 4.5, mainSpanZ, mainMaxX - 0.75, -2.25, mainMidZ)
  );

  if (!world.waterShaderUniforms) {
    world.waterShaderUniforms = { uTime: { value: 0 } };
  }
  applyAnimatedLegoWaterShader(oceanMat, world.waterShaderUniforms, {
    waveAmp: 0.08,
    waveFreq: 0.13,
    fresnelBoost: 0.25,
    variant: 'ocean'
  });
  world.oceanMaterial = oceanMat;
  world.oceanMesh = mergedOcean;
  addChunkedArrayToScene(world.scene, islandGeos, asphaltMat, { receiveShadow: true, chunkSize: ws(512) });

  // 5) Península Leste do Distrito Industrial & Porto (X = ws(580)..ws(1628), Z = ws(-1320)..ws(735))
  const eastMinX = ws(580);
  const eastMaxX = ws(1628);
  const eastMinZ = ws(-1320);
  const eastMaxZ = ws(735);
  const eastSpanX = eastMaxX - eastMinX;
  const eastSpanZ = eastMaxZ - eastMinZ;
  const eastMidX = (eastMinX + eastMaxX) * 0.5;
  const eastMidZ = (eastMinZ + eastMaxZ) * 0.5;

  const eastGeos = [
    makeFastBox(eastSpanX, 4.5, 1.5, eastMidX, -2.25, eastMinZ + 0.75),
    makeFastBox(eastSpanX, 4.5, 1.5, eastMidX, -2.25, eastMaxZ - 0.75),
    makeFastBox(1.5, 4.5, eastSpanZ, eastMinX + 0.75, -2.25, eastMidZ),
    makeFastBox(1.5, 4.5, eastSpanZ, eastMaxX - 0.75, -2.25, eastMidZ)
  ];
  pushChunkedTerrainSectorGeos(eastGeos, eastMinX, eastMaxX, eastMinZ, eastMaxZ, 20, ws(512));
  addChunkedArrayToScene(world.scene, eastGeos, asphaltMat, { receiveShadow: true, chunkSize: ws(512) });

  // 6) Supercontinente Pangeia
  buildPangaeaSupercontinentAndSandCoast(world, asphaltMat);
}

export function buildPangaeaSupercontinentAndSandCoast(world, sharedAsphaltMat = null) {
  const asphaltMat =
    sharedAsphaltMat ||
    getLegoMaterial(LEGO_COLORS.asphalt, {
      roughness: 0.28,
      metalness: 0.16,
      clearcoat: 0.56,
      clearcoatRoughness: 0.24
    });
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.04
  });

  const cSandDry = new THREE.Color(0x8c7853);
  const cSandWet = new THREE.Color(0x4f422d);
  const cRock = new THREE.Color(0x3b4252);
  const cBank = new THREE.Color(0x22361c);
  const cAsphaltShoulder = new THREE.Color(0x1b202b);
  const cTmpBiome = new THREE.Color();
  const cOut = new THREE.Color();

  const buildLocalOriginPangaeaChunk = (x0, x1, z0, z1, cellSize = 44 * WORLD_SCALE) => {
    const w = x1 - x0;
    const d = z1 - z0;
    if (w < 4 || d < 4) return;
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;

    const segX = Math.max(2, Math.round(w / cellSize));
    const segZ = Math.max(2, Math.round(d / cellSize));
    const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    let anyLand = false;

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wx = cx + lx;
      const wz = cz + lz;

      const hy = getPangaeaElevationAt(wx, wz);
      pos.setY(i, hy);
      if (hy > -0.42) anyLand = true;

      const onLand = isPointOnOrganicLand(wx, wz);
      const coastDist = getDistanceToCoastAt(wx, wz);
      const hwyDist = getHighwayDistanceAt(wx, wz);
      const riverDistDesign = Math.abs(fromWs(wx) - 560);

      if (!onLand || hy < 0.32) {
        cOut.copy(cSandWet).lerp(cSandDry, Math.max(0, Math.min(1, (hy + 0.45) / 0.85)));
      } else if (wz < ws(-1318) && riverDistDesign < 42) {
        cOut.copy(cBank);
      } else if (coastDist < 52) {
        const biomeHex = getRegionBiomeHexAt(wx, wz);
        cTmpBiome.setHex(biomeHex);
        const t = Math.max(0, Math.min(1, (coastDist - 18) / 34));
        cOut.copy(cSandDry).lerp(cTmpBiome, t * t);
      } else if (hwyDist < 22) {
        const biomeHex = getRegionBiomeHexAt(wx, wz);
        cTmpBiome.setHex(biomeHex);
        const t = Math.max(0, Math.min(1, (hwyDist - 12) / 10));
        cOut.copy(cAsphaltShoulder).lerp(cTmpBiome, t);
      } else {
        const biomeHex = getRegionBiomeHexAt(wx, wz);
        cOut.setHex(biomeHex);
        if (hy > 14.5) {
          cOut.lerp(cRock, Math.min(0.65, (hy - 14.5) / 12.0));
        }
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
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, terrainMat);
    mesh.position.set(cx, 0, cz);
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

  const chunkSpan = ws(480);
  const pCellSize = 44 * WORLD_SCALE;
  for (const reg of sectorRegions) {
    for (let x0 = reg.minX; x0 < reg.maxX - 1; x0 += chunkSpan) {
      const x1 = Math.min(reg.maxX, x0 + chunkSpan);
      for (let z0 = reg.minZ; z0 < reg.maxZ - 1; z0 += chunkSpan) {
        const z1 = Math.min(reg.maxZ, z0 + chunkSpan);
        buildLocalOriginPangaeaChunk(x0, x1, z0, z1, pCellSize);
      }
    }
  }

  const sandGeos = [];
  const cliffGeos = [];
  const turfGeos = [];
  const reefGeos = [];
  const horizonGeos = [];
  const roadAsphaltGeos = [];
  const roadShoulderGeos = [];
  const roadYellowGeos = [];
  const pineTreeTransforms = [];
  const palmTreeTransforms = [];
  const borderAccentGeos = {
    '#fb923c': [],
    '#4ade80': [],
    '#fde047': [],
    '#94a3b8': [],
    '#ef4444': [],
    '#f59e0b': [],
    '#38bdf8': []
  };

  const buildUrbanCoastRim = (poly, clampFn, isPrison = false, zFilterMin = -Infinity) => {
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i];
      const [bx, bz] = poly[(i + 1) % poly.length];
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;
      if (mz < zFilterMin) continue;
      const dx = bx - ax;
      const dz = bz - az;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 2 || segLen > ws(240)) continue;

      const [ix, iz] = clampFn(mx, mz);
      const radialDx = mx - ix;
      const radialDz = mz - iz;
      const span = Math.hypot(radialDx, radialDz);
      if (span < 4) continue;

      if (isPrison && mx > ws(1300) && mx < ws(1450) && mz < ws(1165)) continue;
      if (isPrison && mx < ws(955) && mz > ws(1470) && mz < ws(1630)) continue;

      const cx = (mx + ix) * 0.5;
      const cz = (mz + iz) * 0.5;
      const wBox = Math.max(24, Math.abs(dx) + Math.abs(radialDx) + 22);
      const dBox = Math.max(24, Math.abs(dz) + Math.abs(radialDz) + 22);

      sandGeos.push(makeFastBox(wBox, 0.96, dBox, cx, -0.42, cz));
      reefGeos.push(makeFastBox(wBox + 14, 0.35, dBox + 14, mx, -0.52, mz));
      if (isPrison && span > ws(44) && i % 3 === 0) {
        const cliffH = 2.8 + ((i * 19) % 6) * 0.8;
        cliffGeos.push(
          makeFastBox(
            Math.max(16, Math.abs(dx) * 0.75 + 12),
            cliffH,
            Math.max(16, Math.abs(dz) * 0.75 + 12),
            mx - radialDx * 0.28,
            cliffH * 0.4 - 0.5,
            mz - radialDz * 0.28
          )
        );
      }
    }
  };

  buildUrbanCoastRim(
    MAIN_WEST_POLYGON,
    (x, z) => [THREE.MathUtils.clamp(x, ws(-1540), ws(535)), THREE.MathUtils.clamp(z, ws(-1315), ws(1040))],
    false,
    ws(1020)
  );
  buildUrbanCoastRim(
    EAST_PENINSULA_POLYGON,
    (x, z) => [THREE.MathUtils.clamp(x, ws(585), ws(1624)), THREE.MathUtils.clamp(z, ws(-1315), ws(732))],
    false,
    ws(720)
  );
  buildUrbanCoastRim(
    PRISON_ISLAND_POLYGON,
    (x, z) => [THREE.MathUtils.clamp(x, ws(960), ws(1790)), THREE.MathUtils.clamp(z, ws(1130), ws(1980))],
    true,
    -Infinity
  );

  buildPangaeaHighwaysAndLandmarks(world, {
    sandGeos,
    cliffGeos,
    turfGeos,
    roadAsphaltGeos,
    roadShoulderGeos,
    roadYellowGeos,
    borderAccentGeos,
    pineTreeTransforms,
    palmTreeTransforms
  });

  for (const isl of ARCHIPELAGO_ISLETS) {
    reefGeos.push(makeFastBox(isl.rx * 2.15, 0.45, isl.rz * 2.15, isl.x, -0.54, isl.z));
    sandGeos.push(makeFastBox(isl.rx * 1.85, 0.9, isl.rz * 1.85, isl.x, -0.15, isl.z));
    const coreGeos = isl.biome === 'rock' ? cliffGeos : isl.biome === 'forest' ? turfGeos : sandGeos;
    const midH = Math.max(2.2, isl.peakY * 0.52);
    coreGeos.push(makeFastBox(isl.rx * 1.35, midH, isl.rz * 1.35, isl.x, midH * 0.5, isl.z));
    cliffGeos.push(makeFastBox(isl.rx * 0.72, isl.peakY, isl.rz * 0.72, isl.x, isl.peakY * 0.5, isl.z));

    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + isl.seed * 0.3;
      const distR = 0.42 + (k % 2) * 0.22;
      pineTreeTransforms.push({
        x: isl.x + Math.cos(a) * isl.rx * distR,
        y: midH,
        z: isl.z + Math.sin(a) * isl.rz * distR,
        s: 1.0 + (k % 3) * 0.32
      });
    }
  }

  for (const mt of HORIZON_MOUNTAINS) {
    const r = mt.radius;
    const h = mt.height;
    horizonGeos.push(
      makeFastBox(r * 1.85, h * 0.42, r * 1.65, mt.x, h * 0.18 - 4, mt.z),
      makeFastBox(r * 1.15, h * 0.78, r * 1.05, mt.x + r * mt.ridgeSkew * 0.4, h * 0.36 - 2, mt.z),
      makeFastBox(r * 0.55, h, r * 0.52, mt.x - r * mt.ridgeSkew * 0.2, h * 0.48 - 2, mt.z)
    );
  }

  const blockedAvenuesX = [-384, -252, -120, 0, 120, 252, 384, -1215, 964].map(ws);
  const blockedAvenuesZ = [-382, -250, -117, 0, 134, 402, 710, -1285, -908].map(ws);
  const aveMargin = IS_SCALED_WORLD ? 30 : 26;
  const isNearAvenue = (val, list, margin = aveMargin) => list.some((a) => Math.abs(val - a) < margin);

  for (const brd of REGION_BORDER_LINES) {
    const [x1, z1] = brd.from;
    const [x2, z2] = brd.to;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const totalLen = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.floor(totalLen / ws(40)));
    const bucket = borderAccentGeos[brd.color] || (borderAccentGeos[brd.color] = []);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      if (Math.abs(dx) >= Math.abs(dz)) {
        if (isNearAvenue(px, blockedAvenuesX, aveMargin)) continue;
      } else {
        if (isNearAvenue(pz, blockedAvenuesZ, aveMargin)) continue;
      }
      if (!isPointOnOrganicLand(px, pz)) continue;
      const py = Math.max(getUrbanCityReliefY(px, pz), getPangaeaElevationAt(px, pz));
      const isHoriz = Math.abs(dx) >= Math.abs(dz);
      const isDriveOverBorder =
        brd.id === 'border_oeste_aero' ||
        brd.id === 'border_ind_porto' ||
        brd.id === 'border_cdd_centro' ||
        brd.id === 'border_boreal_suburbio' ||
        brd.id === 'border_ind_eolico' ||
        brd.id === 'border_aero_dunas';
      if (isDriveOverBorder) {
        bucket.push(makeFastBox(isHoriz ? 18 : 1.5, 0.16, isHoriz ? 1.5 : 18, px, py + 0.1, pz));
      } else {
        bucket.push(makeFastBox(isHoriz ? 16 : 1.3, 0.65, isHoriz ? 1.3 : 16, px, py + 0.34, pz));
        cliffGeos.push(makeFastBox(isHoriz ? 1.6 : 1.8, 1.15, isHoriz ? 1.8 : 1.6, px, py + 0.56, pz));
      }
    }
  }

  const flushBatch = (geos, mat, opts = {}) => {
    if (!geos.length) return;
    addChunkedArrayToScene(world.scene, geos, mat, { chunkSize: ws(640), receiveShadow: true, ...opts });
  };

  flushBatch(sandGeos, getLegoMaterial(0x7d6b4a, { roughness: 0.82 }));
  flushBatch(turfGeos, getLegoMaterial(0x1f3d23, { roughness: 0.78 }));
  flushBatch(cliffGeos, getLegoMaterial(0x282f3c, { roughness: 0.84 }));
  flushBatch(reefGeos, new THREE.MeshStandardMaterial({ color: 0x0b2230, roughness: 0.35, metalness: 0.15 }));
  flushBatch(roadShoulderGeos, getLegoMaterial(0x1e2430, { roughness: 0.82 }), { receiveShadow: true, chunkSize: ws(560) });
  flushBatch(roadAsphaltGeos, asphaltMat, { receiveShadow: true, chunkSize: ws(560) });
  flushBatch(
    roadYellowGeos,
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    }),
    { receiveShadow: false, chunkSize: ws(560) }
  );
  flushBatch(
    horizonGeos,
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.92, metalness: 0.04 }),
    { receiveShadow: false, chunkSize: ws(1600) }
  );

  for (const [hexStr, list] of Object.entries(borderAccentGeos)) {
    if (!list.length) continue;
    flushBatch(list, getLegoMaterial(parseInt(hexStr.replace('#', ''), 16), { roughness: 0.35 }));
  }

  flushPangaeaTreeInstances(world, pineTreeTransforms, palmTreeTransforms);
}
