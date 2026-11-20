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

  // 1) Leito profundo ESTRITO do Rio / Fjord Urbano Leste (X = 538..582, Z = -2950..+1080 em Y = -3.55)
  addWaterPlate(538, 582, -2950, 1080, -3.55);

  // 2) Leitos estreitos dos 3 Canais Estilo Santos na Praia Sul (Z = 724..1070 em Y = -0.52)
  for (const cx of [-384, -120, 252]) {
    addWaterPlate(cx - 12, cx + 12, 724, 1070, -0.52);
  }

  // 3) Placas do Oceano Atlântico ampliadas até o super-horizonte (±14500m) ao redor da Pangeia
  addWaterPlate(-14500, -1825, -14500, 14500, -0.45); // Oceano Oeste além do horizonte
  addWaterPlate(-1825, 540, -14500, -1320, -0.45);   // Oceano Norte Oeste
  addWaterPlate(540, 580, -14500, -1325, -0.45);     // Foz Norte Externa do Fjord
  addWaterPlate(580, 14500, -14500, -1320, -0.45);   // Oceano Nordeste
  addWaterPlate(1628, 14500, -1320, 14500, -0.45);   // Golfo de Tétis & Oceano Leste
  addWaterPlate(580, 1628, 735, 14500, -0.45);       // Baía Sudeste (Ponte Blindada e Ilha da Prisão)
  addWaterPlate(-1825, 540, 1035, 14500, -0.45);     // Baía Sul
  addWaterPlate(540, 580, 1075, 14500, -0.45);       // Foz Sul Externa do Rio

  const mergedOcean = new THREE.Mesh(mergeBufferGeometries(waterGeos), oceanMat);
  for (let i = 0; i < waterGeos.length; i++) waterGeos[i].dispose();
  mergedOcean.receiveShadow = false;
  world.scene.add(mergedOcean);

  // Asfalto negro semi-úmido reflexivo estilo Gotham Noir (espelha luzes de sódio, faróis e neon!)
  const asphaltMat = new THREE.MeshPhysicalMaterial({
    color: LEGO_COLORS.asphalt,
    roughness: 0.28,
    metalness: 0.16,
    clearcoat: 0.56,
    clearcoatRoughness: 0.24
  });

  // 4) Ilha Continental Principal (X = -1825..+540, Z = -1320..+780):
  //    - `cutZones` reduzidos ESTRITAMENTE aos retângulos mínimos das escadas/portais (`METRO_ISLAND_CUTOUTS` + margem de 4m)
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

  // Faixa Oeste do Aeroporto (plana, malha leve) + Malha Urbana/Subúrbio fatiada apenas nos `cutZones` mínimos (células de 14m)
  pushChunkedTerrainSectorGeos(islandGeos, -1825, -1040, -1320, 780, 28);
  const urbanTerrainSlices = sliceRectAroundCutouts(
    { minX: -1040, maxX: 540, minZ: -1320, maxZ: 780 },
    cutZones
  );
  for (const s of urbanTerrainSlices) {
    if (s.maxX - s.minX <= 0.05 || s.maxZ - s.minZ <= 0.05) continue;
    pushChunkedTerrainSectorGeos(islandGeos, s.minX, s.maxX, s.minZ, s.maxZ, 14);
  }

  // Saias costeiras de concreto/rocha nas bordas externas da Ilha Principal (evita frestas nas falésias/margens)
  islandGeos.push(
    makeFastBox(2365, 4.5, 1.5, -642.5, -2.25, -1319.25),
    makeFastBox(2365, 4.5, 1.5, -642.5, -2.25, 779.25),
    makeFastBox(1.5, 4.5, 2100, -1824.25, -2.25, -270),
    makeFastBox(1.5, 4.5, 2100, 539.25, -2.25, -270)
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
  addChunkedArrayToScene(world.scene, islandGeos, asphaltMat, { receiveShadow: true, chunkSize: 512 });

  // 5) Península Leste do Distrito Industrial & Porto (X = 580..1628, Z = -1320..+735) com Relevo Industrial (+7.0m)!
  const eastGeos = [
    makeFastBox(1048, 4.5, 1.5, 1104, -2.25, -1319.25),
    makeFastBox(1048, 4.5, 1.5, 1104, -2.25, 734.25),
    makeFastBox(1.5, 4.5, 2055, 580.75, -2.25, -292.5),
    makeFastBox(1.5, 4.5, 2055, 1627.25, -2.25, -292.5)
  ];
  pushChunkedTerrainSectorGeos(eastGeos, 580, 1628, -1320, 735, 20);
  addChunkedArrayToScene(world.scene, eastGeos, asphaltMat, { receiveShadow: true, chunkSize: 512 });

  // 6) Supercontinente Pangeia (Terrenos Chunked com Origem Local, Praias de Areia Contínuas, Rodovias Regionais & Horizonte)
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

  // Helper: constrói um bloco de terreno Heightfield já com vértices transladados para origem local (cx, 0, cz)
  const buildLocalOriginPangaeaChunk = (x0, x1, z0, z1, cellSize = 44) => {
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
      const riverDist = Math.abs(wx - 560);

      if (!onLand || hy < 0.32) {
        cOut.copy(cSandWet).lerp(cSandDry, Math.max(0, Math.min(1, (hy + 0.45) / 0.85)));
      } else if (wz < -1318 && riverDist < 42) {
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

  // 1) Setores estritamente externos ao núcleo urbano (ZERO sobreposição com asfalto urbano em Y=0)
  const sectorRegions = [
    { minX: -3480, maxX: 538, minZ: -3020, maxZ: -1320 },   // Planalto Boreal Norte & Fiordes Oeste
    { minX: 582, maxX: 3480, minZ: -2820, maxZ: -1320 },    // Planalto Boreal Leste & Chifre Nordeste
    { minX: -3480, maxX: -1825, minZ: -1320, maxZ: 2560 },  // Cabo Noroeste, Baía Oeste & Península Sudoeste
    { minX: -1825, maxX: -1530, minZ: 1020, maxZ: 2560 },   // Lado Leste da Península Sudoeste (livre da Marina -1400)
    { minX: 1628, maxX: 3480, minZ: -1320, maxZ: 140 }      // Ala Leste do Chifre Nordeste & Golfo de Tétis
  ];

  const chunkSpan = 480;
  for (const reg of sectorRegions) {
    for (let x0 = reg.minX; x0 < reg.maxX - 1; x0 += chunkSpan) {
      const x1 = Math.min(reg.maxX, x0 + chunkSpan);
      for (let z0 = reg.minZ; z0 < reg.maxZ - 1; z0 += chunkSpan) {
        const z1 = Math.min(reg.maxZ, z0 + chunkSpan);
        buildLocalOriginPangaeaChunk(x0, x1, z0, z1, 44);
      }
    }
  }

  // 2) Anéis de Areia & Costão Contínuos para Orla Sul Urbana, Cais Leste e Ilha da Prisão
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
      if (segLen < 2 || segLen > 240) continue;

      const [ix, iz] = clampFn(mx, mz);
      const radialDx = mx - ix;
      const radialDz = mz - iz;
      const span = Math.hypot(radialDx, radialDz);
      if (span < 4) continue;

      if (isPrison && mx > 1300 && mx < 1450 && mz < 1165) continue;
      if (isPrison && mx < 955 && mz > 1470 && mz < 1630) continue;

      const cx = (mx + ix) * 0.5;
      const cz = (mz + iz) * 0.5;
      const wBox = Math.max(24, Math.abs(dx) + Math.abs(radialDx) + 22);
      const dBox = Math.max(24, Math.abs(dz) + Math.abs(radialDz) + 22);

      sandGeos.push(makeFastBox(wBox, 0.96, dBox, cx, -0.42, cz));
      reefGeos.push(makeFastBox(wBox + 14, 0.35, dBox + 14, mx, -0.52, mz));
      if (isPrison && span > 44 && i % 3 === 0) {
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
    (x, z) => [THREE.MathUtils.clamp(x, -1540, 535), THREE.MathUtils.clamp(z, -1315, 1040)],
    false,
    1020
  );
  buildUrbanCoastRim(
    EAST_PENINSULA_POLYGON,
    (x, z) => [THREE.MathUtils.clamp(x, 585, 1624), THREE.MathUtils.clamp(z, -1315, 732)],
    false,
    720
  );
  buildUrbanCoastRim(
    PRISON_ISLAND_POLYGON,
    (x, z) => [THREE.MathUtils.clamp(x, 960, 1790), THREE.MathUtils.clamp(z, 1130, 1980)],
    true,
    -Infinity
  );

  // 3 & 4) Rodovias Inter-Regionais da Pangeia + Marcos Identitários
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

  // 5) Ilhotas do Arquipélago ao redor (praia + núcleo sólido + árvores)
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

  // 6) Cadeia de Montanhas Distantes no Horizonte em 360° (camuflam o limite oceânico na neblina!)
  for (const mt of HORIZON_MOUNTAINS) {
    const r = mt.radius;
    const h = mt.height;
    horizonGeos.push(
      makeFastBox(r * 1.85, h * 0.42, r * 1.65, mt.x, h * 0.18 - 4, mt.z),
      makeFastBox(r * 1.15, h * 0.78, r * 1.05, mt.x + r * mt.ridgeSkew * 0.4, h * 0.36 - 2, mt.z),
      makeFastBox(r * 0.55, h, r * 0.52, mt.x - r * mt.ridgeSkew * 0.2, h * 0.48 - 2, mt.z)
    );
  }

  // 7) Linhas Visuais Claras de Fronteira entre Regiões (urbanas e inter-regionais)
  const blockedAvenuesX = [-384, -252, -120, 0, 120, 252, 384, -1215, 964];
  const blockedAvenuesZ = [-382, -250, -117, 0, 134, 402, 710, -1285, -908];
  const isNearAvenue = (val, list, margin = 24) => list.some((a) => Math.abs(val - a) < margin);

  for (const brd of REGION_BORDER_LINES) {
    const [x1, z1] = brd.from;
    const [x2, z2] = brd.to;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const totalLen = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.floor(totalLen / 40));
    const bucket = borderAccentGeos[brd.color] || (borderAccentGeos[brd.color] = []);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      if (Math.abs(dx) >= Math.abs(dz)) {
        if (isNearAvenue(px, blockedAvenuesX, 26)) continue;
      } else {
        if (isNearAvenue(pz, blockedAvenuesZ, 26)) continue;
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
    addChunkedArrayToScene(world.scene, geos, mat, { chunkSize: 640, receiveShadow: true, ...opts });
  };

  flushBatch(sandGeos, getLegoMaterial(0x7d6b4a, { roughness: 0.82 }));
  flushBatch(turfGeos, getLegoMaterial(0x1f3d23, { roughness: 0.78 }));
  flushBatch(cliffGeos, getLegoMaterial(0x282f3c, { roughness: 0.84 }));
  flushBatch(reefGeos, new THREE.MeshStandardMaterial({ color: 0x0b2230, roughness: 0.35, metalness: 0.15 }));
  flushBatch(roadShoulderGeos, getLegoMaterial(0x1e2430, { roughness: 0.82 }), { receiveShadow: true, chunkSize: 560 });
  flushBatch(roadAsphaltGeos, asphaltMat, { receiveShadow: true, chunkSize: 560 });
  flushBatch(
    roadYellowGeos,
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    }),
    { receiveShadow: false, chunkSize: 560 }
  );
  flushBatch(
    horizonGeos,
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.92, metalness: 0.04 }),
    { receiveShadow: false, chunkSize: 1600 }
  );

  for (const [hexStr, list] of Object.entries(borderAccentGeos)) {
    if (!list.length) continue;
    flushBatch(list, getLegoMaterial(parseInt(hexStr.replace('#', ''), 16), { roughness: 0.35 }));
  }

  flushPangaeaTreeInstances(world, pineTreeTransforms, palmTreeTransforms);
}
