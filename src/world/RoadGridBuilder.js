import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import { applyAnimatedLegoWaterShader } from '../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox, makeFastBox, getGeometryChunkKey } from './BuildingGenerator.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from './MetroSystemBuilder.js';
import { getUrbanCityReliefY } from './ViaductAndReliefBuilder.js';
import { createSignBoardMesh } from '../utils/SignBoardHelper.js';
import {
  MAIN_WEST_POLYGON,
  EAST_PENINSULA_POLYGON,
  PRISON_ISLAND_POLYGON,
  ARCHIPELAGO_ISLETS,
  HORIZON_MOUNTAINS,
  REGION_BORDER_LINES,
  PANGAEA_HIGHWAYS,
  getDistanceToCoastAt,
  getPangaeaElevationAt,
  getHighwayDistanceAt,
  getRegionBiomeHexAt,
  isPointOnOrganicLand
} from './CoastlineProfile.js';

/**
 * Especificação Oficial das 9 Pontes Elevadas em Arco sobre o Rio/Canal Urbano Leste (X = 526..594, vão = 68m)
 * Equação da curva suave: bridgeY = archHeight * Math.sin(((x - xStart) / (xEnd - xStart)) * Math.PI)
 */
export const RIVER_BRIDGE_SPECS = [
  { z: -776, width: 26, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_north', label: 'PONTE NORTE DO CANAL' },
  { z: -512, width: 28, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate', label: 'PONTE FRONTEIRA SUBÚRBIO-PCC' },
  { z: -382, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate', label: 'PONTE DA CIDADELA NORTE' },
  { z: -250, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate', label: 'PONTE CENTRAL DO SINDICATO' },
  { z: -117, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate', label: 'PONTE DO CENTRO FINANCEIRO' },
  { z: 0, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'pcc_gate', label: 'PONTE MONUMENTAL LESTE-OESTE' },
  { z: 134, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'port_gate', label: 'PONTE DO PARQUE & PORTO' },
  { z: 402, width: 30, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'port_gate', label: 'PONTE LOGÍSTICA DAS DOCAS' },
  { z: 712, width: 32, xStart: 526, xEnd: 594, archHeight: 5.0, style: 'beach', label: 'PONTE COSTEIRA DA ORLA SUL' }
];

export const PANGAEA_BRIDGE_SPECS = [
  { z: -2150, width: 28, xStart: 526, xEnd: 594, archHeight: 5.5, style: 'pcc_north', label: 'PONTE BOREAL DO FIORDE' }
];

/**
 * Especificação Oficial dos 3 Píeres/Decks Fluviais de Madeira no Rio Urbano (Cota da Água Y = -3.5, Deck Y = -2.9)
 */
export const RIVER_PIER_SPECS = [
  {
    id: 'central_park_pier',
    bank: 'west',
    z: 268,
    lengthZ: 32,
    deckXMin: 540,
    deckXMax: 547.5,
    rampXMin: 531,
    rampXMax: 540,
    deckY: -2.9,
    label: 'DECK FLUVIAL PARQUE CENTRAL'
  },
  {
    id: 'pcc_industrial_pier',
    bank: 'east',
    z: -185,
    lengthZ: 32,
    deckXMin: 572.5,
    deckXMax: 580,
    rampXMin: 580,
    rampXMax: 589,
    deckY: -2.9,
    label: 'DOCA FLUVIAL DE FUGA (PCC)'
  },
  {
    id: 'south_beach_mouth_pier',
    bank: 'west',
    z: 845,
    lengthZ: 38,
    deckXMin: 540,
    deckXMax: 547.5,
    rampXMin: 531,
    rampXMax: 540,
    deckY: -2.9,
    label: 'MARINA DA FOZ DA PRAIA SUL'
  }
];

function createSubdividedTerrainSectorGeo(minX, maxX, minZ, maxZ, cellSize = 18) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const segX = Math.max(2, Math.round(w / cellSize));
  const segZ = Math.max(2, Math.round(d / cellSize));
  const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    pos.setY(i, getUrbanCityReliefY(vx, vz));
  }
  geo.computeVertexNormals();
  return geo;
}

function pushChunkedTerrainSectorGeos(bucket, minX, maxX, minZ, maxZ, cellSize = 18, maxTile = 512) {
  for (let x0 = minX; x0 < maxX - 0.01; x0 += maxTile) {
    const x1 = Math.min(maxX, x0 + maxTile);
    for (let z0 = minZ; z0 < maxZ - 0.01; z0 += maxTile) {
      const z1 = Math.min(maxZ, z0 + maxTile);
      bucket.push(createSubdividedTerrainSectorGeo(x0, x1, z0, z1, cellSize));
    }
  }
}

function addChunkedArrayToScene(scene, geos, mat, opts = {}) {
  const chunkSize = opts.chunkSize ?? 512;
  const castShadow = Boolean(opts.castShadow);
  const receiveShadow = Boolean(opts.receiveShadow);
  const byChunk = new Map();
  for (let i = 0; i < geos.length; i++) {
    const g = geos[i];
    const k = getGeometryChunkKey(g, chunkSize);
    let arr = byChunk.get(k);
    if (!arr) {
      arr = [];
      byChunk.set(k, arr);
    }
    arr.push(g);
  }
  for (const list of byChunk.values()) {
    if (list.length === 0) continue;
    const merged = mergeBufferGeometries(list);
    // Origem local por chunk para máxima precisão Float32 mesmo a +-4500m da origem!
    merged.computeBoundingBox();
    const center = new THREE.Vector3();
    if (merged.boundingBox) {
      merged.boundingBox.getCenter(center);
      merged.translate(-center.x, -center.y, -center.z);
    }
    const mesh = new THREE.Mesh(merged, mat);
    mesh.position.copy(center);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    scene.add(mesh);
  }
  geos.length = 0;
}

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
  //    - `cutZones` reduzidos ESTRITAMENTE aos retângulos mínimos das escadas/portais (`METRO_ISLAND_CUTOUTS` + margem de 4m),
  //      preservando 100% do relevo urbano nos quarteirões e avenidas ao redor!
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
  _buildPangaeaSupercontinentAndSandCoast(world, asphaltMat);
}

function _buildPangaeaSupercontinentAndSandCoast(world, sharedAsphaltMat = null) {
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
        // Faixa contínua de areia dourada ao redor de 100% do litoral da Pangeia!
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

      // Sempre areia dourada + recife raso na transição marítima
      sandGeos.push(makeFastBox(wBox, 1.05, dBox, cx, -0.24, cz));
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

  // 3) Rodovias Inter-Regionais da Pangeia (`PANGAEA_HIGHWAYS`) + Postes + Pórticos de Divisa
  const hwyPoleCoords = [];
  for (const hwy of PANGAEA_HIGHWAYS) {
    const roadW = hwy.width || 24;
    for (let p = 0; p < hwy.points.length - 1; p++) {
      const [ax, az] = hwy.points[p];
      const [bx, bz] = hwy.points[p + 1];
      const segDx = bx - ax;
      const segDz = bz - az;
      const totalLen = Math.hypot(segDx, segDz);
      if (totalLen < 2) continue;

      const ux = segDx / totalLen;
      const uz = segDz / totalLen;
      const yaw = Math.atan2(segDx, segDz);

      // Registra segmento para Minimapa & Mapa Tático [M]
      if (Math.abs(segDx) <= 4 || Math.abs(segDz) <= 4) {
        const horiz = Math.abs(segDx) > Math.abs(segDz);
        world.mapRoads.push({
          x: (ax + bx) * 0.5,
          z: (az + bz) * 0.5,
          w: horiz ? totalLen + roadW * 0.4 : roadW,
          d: horiz ? roadW : totalLen + roadW * 0.4,
          isMain: true
        });
      }

      const subSteps = Math.max(1, Math.ceil(totalLen / 24));
      const subLen = totalLen / subSteps;
      for (let i = 0; i < subSteps; i++) {
        const t0 = i / subSteps;
        const t1 = (i + 1) / subSteps;
        const sx0 = ax + segDx * t0;
        const sz0 = az + segDz * t0;
        const sx1 = ax + segDx * t1;
        const sz1 = az + segDz * t1;
        const mx = (sx0 + sx1) * 0.5;
        const mz = (sz0 + sz1) * 0.5;

        // Pula vão do Rio Urban/Fjord em X=526..594 (coberto pela Ponte em Arco!)
        if (mx > 528 && mx < 592) continue;

        const y0 = getPangaeaElevationAt(sx0, sz0);
        const y1 = getPangaeaElevationAt(sx1, sz1);
        const ym = (y0 + y1) * 0.5;
        const dy = y1 - y0;
        const slopePitch = -Math.atan2(dy, subLen);
        const segActualLen = Math.hypot(subLen, dy) + 0.5;

        // Base de sustentação & pista asfáltica
        const sg = new THREE.BoxGeometry(roadW + 5.0, 1.4, segActualLen);
        sg.rotateX(slopePitch);
        sg.rotateY(yaw);
        sg.translate(mx, ym - 0.52, mz);
        roadShoulderGeos.push(sg);

        const rg = new THREE.BoxGeometry(roadW, 0.34, segActualLen);
        rg.rotateX(slopePitch);
        rg.rotateY(yaw);
        rg.translate(mx, ym + 0.14, mz);
        roadAsphaltGeos.push(rg);

        // Faixas amarelas centrais com separação + polygonOffset
        if (i % 2 === 0) {
          for (const off of [-0.55, 0.55]) {
            const yg = new THREE.BoxGeometry(0.45, 0.06, segActualLen * 0.62);
            yg.rotateX(slopePitch);
            yg.rotateY(yaw);
            yg.translate(mx + uz * off, ym + 0.36, mz - ux * off);
            roadYellowGeos.push(yg);
          }
        }

        if (i % 3 === 1) {
          hwyPoleCoords.push({
            x: mx + uz * (roadW * 0.5 + 1.6),
            y: ym + 0.25,
            z: mz - ux * (roadW * 0.5 + 1.6),
            yaw
          });
        }
      }
    }
  }

  // Ponte Rodoviária Boreal sobre o Fjord em Z = -2150 (X = 526..594, archHeight = 5.5m)
  const borealBridge = PANGAEA_BRIDGE_SPECS[0];
  if (borealBridge && borealBridge.z === -2150) {
    const steps = 16;
    const spanX = borealBridge.xEnd - borealBridge.xStart;
    const stepW = spanX / steps;
    for (let i = 0; i < steps; i++) {
      const bx0 = borealBridge.xStart + i * stepW;
      const bx1 = bx0 + stepW;
      const bxm = (bx0 + bx1) * 0.5;
      const by0 = borealBridge.archHeight * Math.sin(((bx0 - borealBridge.xStart) / spanX) * Math.PI);
      const by1 = borealBridge.archHeight * Math.sin(((bx1 - borealBridge.xStart) / spanX) * Math.PI);
      const bym = (by0 + by1) * 0.5;
      const slopeZ = Math.atan2(by1 - by0, stepW);
      const sLen = Math.hypot(stepW, by1 - by0) + 0.4;

      const deck = new THREE.BoxGeometry(sLen, 0.75, borealBridge.width);
      deck.rotateZ(slopeZ);
      deck.translate(bxm, bym - 0.15, borealBridge.z);
      roadAsphaltGeos.push(deck);

      for (const rz of [-borealBridge.width * 0.48, borealBridge.width * 0.48]) {
        const rail = new THREE.BoxGeometry(sLen, 1.4, 0.75);
        rail.rotateZ(slopeZ);
        rail.translate(bxm, bym + 0.85, borealBridge.z + rz);
        cliffGeos.push(rail);
      }
    }
    world.mapRoads.push({
      x: (borealBridge.xStart + borealBridge.xEnd) * 0.5,
      z: borealBridge.z,
      w: spanX + 8,
      d: borealBridge.width,
      isMain: true
    });
  }

  // Postes instanciados ao longo das rodovias da Pangeia
  if (hwyPoleCoords.length > 0) {
    const dummy = new THREE.Object3D();
    const poleGeo = new THREE.BoxGeometry(0.45, 7.2, 0.45);
    const armGeo = new THREE.BoxGeometry(3.4, 0.28, 0.35);
    const poleMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.4 });
    const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, hwyPoleCoords.length);
    const armInst = new THREE.InstancedMesh(armGeo, poleMat, hwyPoleCoords.length);
    hwyPoleCoords.forEach((p, idx) => {
      dummy.position.set(p.x, p.y + 3.6, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(p.x - Math.cos(p.yaw) * 1.4, p.y + 7.1, p.z + Math.sin(p.yaw) * 1.4);
      dummy.updateMatrix();
      armInst.setMatrixAt(idx, dummy.matrix);
    });
    poleInst.instanceMatrix.needsUpdate = true;
    armInst.instanceMatrix.needsUpdate = true;
    world.scene.add(poleInst, armInst);
  }

  // Pórticos de Divisa nas fronteiras das rodovias regionais
  const borderPortals = [
    { x: -1215, z: -1328, yaw: 0, title: 'PLATÔ BOREAL NORTE', color: '#4ade80' },
    { x: 964, z: -1328, yaw: 0, title: 'EXPRESSA TÉTIS NORTE', color: '#38bdf8' },
    { x: -1832, z: -1285, yaw: Math.PI / 2, title: 'CABO RADAR NOROESTE', color: '#94a3b8' },
    { x: 1634, z: -908, yaw: Math.PI / 2, title: 'PARQUE EÓLICO TÉTIS', color: '#38bdf8' },
    { x: -1832, z: 710, yaw: Math.PI / 2, title: 'COSTA DAS DUNAS SUL', color: '#fde047' }
  ];
  for (const bp of borderPortals) {
    const py = getPangaeaElevationAt(bp.x, bp.z);
    const ux = Math.cos(bp.yaw);
    const uz = -Math.sin(bp.yaw);
    for (const s of [-13.5, 13.5]) {
      cliffGeos.push(makeFastBox(1.8, 9.6, 1.8, bp.x + ux * s, py + 4.8, bp.z + uz * s));
    }
    const isZAligned = Math.abs(bp.yaw) > 0.1;
    cliffGeos.push(
      makeFastBox(isZAligned ? 1.8 : 29.0, 1.4, isZAligned ? 29.0 : 1.8, bp.x, py + 9.4, bp.z)
    );
    const sign = createSignBoardMesh({
      x: bp.x,
      y: py + 9.4,
      z: bp.z,
      rotY: bp.yaw,
      width: 24,
      height: 3.4,
      depth: 2.1,
      title: bp.title,
      bgColor: '#090a0d',
      borderColor: bp.color,
      textColor: bp.color,
      doubleSided: true
    });
    world.scene.add(sign);
  }

  // 4) Novos Marcos & Áreas Identitárias da Pangeia (Floresta Boreal, Radar NW, Parque Eólico/Refinaria, Vila Dunas SW)
  const pineTreeTransforms = [];
  const palmTreeTransforms = [];

  // 4A. Floresta Boreal de Pinheiros + Mirante Florestal (-1265, -2420)
  for (let gx = -2250; gx <= 420; gx += 165) {
    for (let gz = -2650; gz <= -1440; gz += 165) {
      const tx = gx + Math.sin(gx * 0.03 + gz * 0.02) * 55;
      const tz = gz + Math.cos(gz * 0.04 - gx * 0.01) * 55;
      if (!isPointOnOrganicLand(tx, tz)) continue;
      if (getDistanceToCoastAt(tx, tz) < 55) continue;
      if (getHighwayDistanceAt(tx, tz) < 28) continue;
      if (Math.abs(tx - 560) < 60) continue;
      const ty = getPangaeaElevationAt(tx, tz);
      pineTreeTransforms.push({ x: tx, y: ty, z: tz, s: 1.15 + ((Math.abs(gx + gz) % 4) * 0.25) });
    }
  }
  {
    const lx = -1265;
    const lz = -2420;
    const ly = getPangaeaElevationAt(lx, lz);
    cliffGeos.push(makeFastBox(26, 2.0, 22, lx, ly + 1.0, lz));
    turfGeos.push(makeFastBox(20, 8.5, 16, lx, ly + 6.0, lz));
    sandGeos.push(makeFastBox(24, 2.2, 20, lx, ly + 11.2, lz));
    cliffGeos.push(makeFastBox(6.5, 22.0, 6.5, lx + 16, ly + 11.0, lz - 6));
    world.addCollider(lx, lz, 26, 22, ly + 12.5, ly);
    world.addCollider(lx + 16, lz - 6, 7.0, 7.0, ly + 22.0, ly);
    world.mapBuildings.push({ x: lx, z: lz, w: 32, d: 24, height: 22, color: '#22c55e', label: 'ESTAÇÃO BOREAL NORTE', isLandmark: true });
    world.scene.add(
      createSignBoardMesh({
        x: lx,
        y: ly + 15.2,
        z: lz + 9.2,
        width: 22,
        height: 3.4,
        title: 'PLATÔ BOREAL NORTE',
        bgColor: '#090a0d',
        borderColor: '#4ade80',
        textColor: '#4ade80',
        doubleSided: true
      })
    );
  }

  // 4B. Estação Radar Costeira no Cabo Noroeste (-2920, -1345)
  {
    const rx = -2920;
    const rz = -1345;
    const ry = getPangaeaElevationAt(rx, rz);
    cliffGeos.push(
      makeFastBox(38, 3.0, 32, rx, ry + 1.5, rz),
      makeFastBox(24, 14.0, 20, rx, ry + 10.0, rz)
    );
    const dishPivot = new THREE.Group();
    dishPivot.position.set(rx, ry + 20.5, rz);
    const dishMat = getLegoMaterial(LEGO_COLORS.lightGrey, { roughness: 0.35, metalness: 0.35 });
    const dishPlate = new THREE.Mesh(new THREE.CylinderGeometry(11.0, 4.5, 3.8, 12), dishMat);
    dishPlate.rotation.x = Math.PI * 0.32;
    const feedArm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 11.0), dishMat);
    feedArm.position.set(0, 4.5, 4.2);
    dishPivot.add(dishPlate, feedArm);
    world.scene.add(dishPivot);
    if (Array.isArray(world.rotatingElements)) {
      world.rotatingElements.push({ mesh: dishPivot, axis: 'y', speed: 0.48 });
    }
    world.addCollider(rx, rz, 38, 32, ry + 18.0, ry);
    world.mapBuildings.push({ x: rx, z: rz, w: 38, d: 32, height: 26, color: '#94a3b8', label: 'CABO RADAR NOROESTE', isLandmark: true });
    world.scene.add(
      createSignBoardMesh({
        x: rx,
        y: ry + 12.0,
        z: rz + 14.0,
        width: 22,
        height: 3.4,
        title: 'ESTAÇÃO RADAR NOROESTE',
        bgColor: '#090a0d',
        borderColor: '#94a3b8',
        textColor: '#f8fafc',
        doubleSided: true
      })
    );
  }

  // 4C. Parque Eólico de Tétis (8 Aerogeradores Gigantes) & Refinaria no Chifre Nordeste
  const turbineCoords = [
    [2240, -1980], [2620, -2060], [2980, -1720], [2960, -1240],
    [2320, -1420], [2480, -680], [2140, -1720], [2840, -820]
  ];
  const turbinePoleMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.25, clearcoat: 0.35 });
  const turbineAccentMat = getLegoMaterial(0x00f0ff, { roughness: 0.2 });
  const hubGeo = new THREE.BoxGeometry(3.2, 3.2, 5.4);
  const bladeGeo = new THREE.BoxGeometry(1.5, 22.0, 0.55);
  const mastGeo = new THREE.CylinderGeometry(1.4, 2.5, 52.0, 10);
  for (const [wx, wz] of turbineCoords) {
    if (!isPointOnOrganicLand(wx, wz)) continue;
    const wy = getPangaeaElevationAt(wx, wz);
    const mast = new THREE.Mesh(mastGeo, turbinePoleMat);
    mast.position.set(wx, wy + 26.0, wz);
    mast.matrixAutoUpdate = false;
    mast.updateMatrix();
    world.scene.add(mast);

    const rotorPivot = new THREE.Group();
    rotorPivot.position.set(wx, wy + 52.0, wz + 2.8);
    const hub = new THREE.Mesh(hubGeo, turbineAccentMat);
    for (let b = 0; b < 3; b++) {
      const br = new THREE.Group();
      br.rotation.z = (b / 3) * Math.PI * 2;
      const bl = new THREE.Mesh(bladeGeo, turbinePoleMat);
      bl.position.y = 11.5;
      br.add(bl);
      rotorPivot.add(br);
    }
    rotorPivot.add(hub);
    world.scene.add(rotorPivot);
    if (Array.isArray(world.rotatingElements)) {
      world.rotatingElements.push({ mesh: rotorPivot, axis: 'z', speed: 1.45 + ((wx % 5) * 0.12) });
    }
    world.addCollider(wx, wz, 5.5, 5.5, wy + 52.0, wy);
    world.mapBuildings.push({ x: wx, z: wz, w: 14, d: 14, height: 52, color: '#38bdf8', label: 'TORRE EÓLICA' });
  }
  // Complexo Petroquímico em (2740, -1120)
  {
    const rx = 2740;
    const rz = -1120;
    const ry = getPangaeaElevationAt(rx, rz);
    cliffGeos.push(makeFastBox(46, 2.0, 42, rx, ry + 1.0, rz));
    for (const [ox, oz] of [[-12, -8], [12, -8], [-12, 10], [12, 10]]) {
      const silo = new THREE.CylinderGeometry(7.2, 7.2, 18.0, 12);
      silo.translate(rx + ox, ry + 10.5, rz + oz);
      cliffGeos.push(silo);
      world.addCollider(rx + ox, rz + oz, 14.4, 14.4, ry + 19.5, ry);
    }
    world.mapBuildings.push({ x: rx, z: rz, w: 46, d: 42, height: 22, color: '#3b82f6', label: 'PARQUE EÓLICO & REFINARIA', isLandmark: true });
    world.scene.add(
      createSignBoardMesh({
        x: rx,
        y: ry + 22.0,
        z: rz + 19.0,
        width: 24,
        height: 3.4,
        title: 'PARQUE EÓLICO TÉTIS',
        bgColor: '#090a0d',
        borderColor: '#38bdf8',
        textColor: '#38bdf8',
        doubleSided: true
      })
    );
  }

  // 4D. Vila das Dunas Sudoeste & Coqueirais (-2460, +2020)
  for (let gx = -3050; gx <= -1750; gx += 170) {
    for (let gz = 880; gz <= 2280; gz += 170) {
      const tx = gx + Math.cos(gx * 0.02 + gz) * 45;
      const tz = gz + Math.sin(gz * 0.03 - gx) * 45;
      if (!isPointOnOrganicLand(tx, tz)) continue;
      const cd = getDistanceToCoastAt(tx, tz);
      if (cd < 18 || cd > 180) continue;
      if (getHighwayDistanceAt(tx, tz) < 28) continue;
      const ty = getPangaeaElevationAt(tx, tz);
      palmTreeTransforms.push({ x: tx, y: ty, z: tz, s: 1.0 + ((Math.abs(gx) % 3) * 0.22) });
    }
  }
  {
    const vx = -2520;
    const vz = 2020;
    const vy = getPangaeaElevationAt(vx, vz);
    const houseCols = ['#ef4444', '#fde047', '#38bdf8'];
    [-26, 0, 26].forEach((ox, idx) => {
      const hy = getPangaeaElevationAt(vx + ox, vz);
      sandGeos.push(makeFastBox(15, 2.2, 14, vx + ox, hy + 1.0, vz));
      borderAccentGeos[houseCols[idx]] = borderAccentGeos[houseCols[idx]] || [];
      borderAccentGeos[houseCols[idx]].push(makeFastBox(13, 6.2, 12, vx + ox, hy + 5.2, vz));
      world.addCollider(vx + ox, vz, 15, 14, hy + 8.5, hy);
    });
    world.mapBuildings.push({ x: vx, z: vz, w: 68, d: 18, height: 10, color: '#fde047', label: 'VILA DUNAS SUDOESTE', isLandmark: true });
    world.scene.add(
      createSignBoardMesh({
        x: vx,
        y: vy + 10.5,
        z: vz - 11.0,
        width: 22,
        height: 3.4,
        title: 'VILA DUNAS SUDOESTE',
        bgColor: '#090a0d',
        borderColor: '#fde047',
        textColor: '#fde047',
        doubleSided: true
      })
    );
  }

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

  if (pineTreeTransforms.length > 0) {
    const dummy = new THREE.Object3D();
    const crownGeo = new THREE.ConeGeometry(4.2, 11.2, 6);
    const trunkGeo = new THREE.CylinderGeometry(0.9, 1.15, 5.4, 6);
    const crownInst = new THREE.InstancedMesh(crownGeo, getLegoMaterial(0x166534, { roughness: 0.55 }), pineTreeTransforms.length);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, getLegoMaterial(0x78350f, { roughness: 0.7 }), pineTreeTransforms.length);
    pineTreeTransforms.forEach((tr, idx) => {
      dummy.position.set(tr.x, tr.y + 6.4 * tr.s, tr.z);
      dummy.rotation.set(0, (idx * 0.7) % (Math.PI * 2), 0);
      dummy.scale.set(tr.s, tr.s, tr.s);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tr.x, tr.y + 2.2 * tr.s, tr.z);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);
    });
    crownInst.instanceMatrix.needsUpdate = true;
    trunkInst.instanceMatrix.needsUpdate = true;
    world.scene.add(crownInst, trunkInst);
  }

  if (palmTreeTransforms.length > 0) {
    const dummy = new THREE.Object3D();
    const palmCrownGeo = new THREE.ConeGeometry(4.8, 3.6, 5);
    const palmTrunkGeo = new THREE.CylinderGeometry(0.55, 0.85, 8.6, 6);
    const palmCrownInst = new THREE.InstancedMesh(palmCrownGeo, getLegoMaterial(0x22c55e, { roughness: 0.45 }), palmTreeTransforms.length);
    const palmTrunkInst = new THREE.InstancedMesh(palmTrunkGeo, getLegoMaterial(0x92400e, { roughness: 0.7 }), palmTreeTransforms.length);
    palmTreeTransforms.forEach((tr, idx) => {
      dummy.position.set(tr.x, tr.y + 8.6 * tr.s, tr.z);
      dummy.rotation.set(0.08, (idx * 1.1) % (Math.PI * 2), 0.08);
      dummy.scale.set(tr.s, tr.s, tr.s);
      dummy.updateMatrix();
      palmCrownInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tr.x, tr.y + 4.1 * tr.s, tr.z);
      dummy.rotation.set(0.05, 0, -0.05);
      dummy.updateMatrix();
      palmTrunkInst.setMatrixAt(idx, dummy.matrix);
    });
    palmCrownInst.instanceMatrix.needsUpdate = true;
    palmTrunkInst.instanceMatrix.needsUpdate = true;
    world.scene.add(palmCrownInst, palmTrunkInst);
  }
}

/**
 * MALHA VIÁRIA URBANA OTIMIZADA COM ADAPTAÇÃO TOTAL AO RELEVO:
 * - Todas as faixas amarelas/brancas, faixas de pedestres, canteiros e semáforos acompanham `getUrbanCityReliefY(x, z)`!
 */
export function buildUrbanRoadGridAndMedians(world) {
  const mainAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
  const mainAvenuesZ = [-382, -250, -117, 0, 134, 402, 710];
  const secondaryStreetsX = [-648, -516, 516, 648];
  const secondaryStreetsZ = [-1172, -1040, -908, -776, -644, -512, 556];

  const yellowGeos = [];
  const whiteGeos = [];
  const medianGeos = [];
  const turfGeos = [];
  const poleGeos = [];

  const sampleRoadY = (x, z) => getUrbanCityReliefY(x, z);

  const pushTerrainLineZ = (geos, xLine, widthX, zFrom, zTo, stepSize = 12, thickness = 0.045, yOff = 0.055) => {
    const total = zTo - zFrom;
    const steps = Math.max(1, Math.round(Math.abs(total) / stepSize));
    const dz = total / steps;
    for (let i = 0; i < steps; i++) {
      const z0 = zFrom + i * dz;
      const z1 = z0 + dz;
      const zm = (z0 + z1) * 0.5;
      const y0 = sampleRoadY(xLine, z0) + yOff;
      const y1 = sampleRoadY(xLine, z1) + yOff;
      const ym = (y0 + y1) * 0.5;
      const dy = y1 - y0;
      if (Math.abs(dy) < 0.004) {
        geos.push(makeFastBox(widthX, thickness, Math.abs(dz) + 0.04, xLine, ym, zm));
      } else {
        const segLen = Math.hypot(dz, dy) + 0.08;
        const g = new THREE.BoxGeometry(widthX, thickness, segLen);
        g.rotateX(-Math.atan2(dy, dz));
        g.translate(xLine, ym, zm);
        geos.push(g);
      }
    }
  };

  const pushTerrainLineX = (geos, zLine, depthZ, xFrom, xTo, stepSize = 12, thickness = 0.045, yOff = 0.055) => {
    const total = xTo - xFrom;
    const steps = Math.max(1, Math.round(Math.abs(total) / stepSize));
    const dx = total / steps;
    for (let i = 0; i < steps; i++) {
      const x0 = xFrom + i * dx;
      const x1 = x0 + dx;
      const xm = (x0 + x1) * 0.5;
      const y0 = sampleRoadY(x0, zLine) + yOff;
      const y1 = sampleRoadY(x1, zLine) + yOff;
      const ym = (y0 + y1) * 0.5;
      const dy = y1 - y0;
      if (Math.abs(dy) < 0.004) {
        geos.push(makeFastBox(Math.abs(dx) + 0.04, thickness, depthZ, xm, ym, zLine));
      } else {
        const segLen = Math.hypot(dx, dy) + 0.08;
        const g = new THREE.BoxGeometry(segLen, thickness, depthZ);
        g.rotateZ(Math.atan2(dy, dx));
        g.translate(xm, ym, zLine);
        geos.push(g);
      }
    }
  };

  // Avenidas Norte-Sul (28m de largura, de Z = -1312 até a Avenida Beira-Mar Z = 710 — 100% contínuas!)
  for (const ax of mainAvenuesX) {
    world.mapRoads.push({ x: ax, z: -301, w: 28, d: 2022, isMain: true });

    if (ax !== 0) {
      pushTerrainLineZ(yellowGeos, ax - 0.5, 0.45, -1312, 710, 12);
      pushTerrainLineZ(yellowGeos, ax + 0.5, 0.45, -1312, 710, 12);
    } else {
      // Na Av. Central X = 0, desenha as faixas fora da rampa central do Viaduto 1 (Z = -374..-286)
      pushTerrainLineZ(yellowGeos, -0.5, 0.45, -1312, -388, 12);
      pushTerrainLineZ(yellowGeos, 0.5, 0.45, -1312, -388, 12);
      pushTerrainLineZ(yellowGeos, -0.5, 0.45, -280, 710, 12);
      pushTerrainLineZ(yellowGeos, 0.5, 0.45, -280, 710, 12);
    }

    // Canteiros centrais arborizados acompanhando a inclinação da rua!
    for (const segZ of [-316, -58, 68, 556]) {
      if ((ax === 0 && (segZ === -316 || segZ === -58)) || (ax === 252 && (segZ === -58 || segZ === 556))) continue;
      pushTerrainLineZ(medianGeos, ax, 2.6, segZ - 34, segZ + 34, 12, 0.55, 0.06);
      pushTerrainLineZ(turfGeos, ax, 1.8, segZ - 32, segZ + 32, 12, 0.14, 0.36);

      const ty1 = sampleRoadY(ax, segZ - 20) + 0.38;
      const ty2 = sampleRoadY(ax, segZ + 20) + 0.38;
      world._addLegoTree(ax, ty1, segZ - 20, 1.0);
      world._addLegoTree(ax, ty2, segZ + 20, 1.0);
    }
  }

  // Avenidas Leste-Oeste (100% inteiras em Z = +134 e todas as demais!)
  for (const az of mainAvenuesZ) {
    const minX = az === 710 ? -1815 : -516;
    const maxX = az <= 134 ? 1616 : az === 710 ? 640 : 1200;
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: az, w: roadW, d: 28, isMain: true });

    pushTerrainLineX(yellowGeos, az - 0.5, 0.45, minX + 5, 526 - 5, 12);
    pushTerrainLineX(yellowGeos, az + 0.5, 0.45, minX + 5, 526 - 5, 12);

    if (maxX > 600) {
      pushTerrainLineX(yellowGeos, az - 0.5, 0.45, 599, maxX - 5, 12);
      pushTerrainLineX(yellowGeos, az + 0.5, 0.45, 599, maxX - 5, 12);
    }
  }

  // Ruas Secundárias Norte-Sul
  for (const sx of secondaryStreetsX) {
    if (sx === -648) {
      world.mapRoads.push({ x: sx, z: -912, w: 24, d: 800, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, -512, 12);
      world.mapRoads.push({ x: sx, z: 562, w: 24, d: 296, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, 414, 710, 12);
    } else if (sx === 648) {
      world.mapRoads.push({ x: sx, z: -912, w: 24, d: 800, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, -512, 12);
    } else {
      world.mapRoads.push({ x: sx, z: -301, w: 24, d: 2022, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, 710, 12);
    }
  }

  // Avenidas Táticas Norte-Sul do Domínio Industrial Leste
  for (const ix of [600, 768, 964, 1160, 1344, 1524]) {
    const minZ = -1312;
    const maxZ = 134;
    const d = maxZ - minZ;
    const cz = (minZ + maxZ) * 0.5;
    world.mapRoads.push({ x: ix, z: cz, w: 24, d, isMain: false });
    pushTerrainLineZ(whiteGeos, ix, 0.35, minZ, maxZ, 16);
  }

  // Ruas Secundárias Leste-Oeste
  for (const sz of secondaryStreetsZ) {
    const minX = -648;
    const maxX = sz >= -1172 && sz <= -512 ? 1616 : 526;
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: sz, w: roadW, d: 24, isMain: false });

    pushTerrainLineX(whiteGeos, sz, 0.35, minX + 6, 520, 12);
    if (maxX > 600) {
      pushTerrainLineX(whiteGeos, sz, 0.35, 600, maxX - 6, 16);
    }
  }

  // Faixas de Pedestres e Semáforos 3D nos cruzamentos principais do Centro (adaptados à cota de cada cruzamento!)
  for (const ix of [-384, -252, -120, 120, 252, 384]) {
    for (const iz of [-382, -250, -117, 0, 134]) {
      for (let s = -10; s <= 10; s += 2.5) {
        const yn = sampleRoadY(ix + s, iz - 16.0) + 0.055;
        const ys = sampleRoadY(ix + s, iz + 16.0) + 0.055;
        whiteGeos.push(
          makeFastBox(1.2, 0.045, 4.2, ix + s, yn, iz - 16.0),
          makeFastBox(1.2, 0.045, 4.2, ix + s, ys, iz + 16.0)
        );
      }

      const tx = ix + 15.2;
      const tz = iz + 15.2;
      const baseTY = sampleRoadY(tx, tz) + 0.28;
      poleGeos.push(
        makeFastBox(0.38, 6.2, 0.38, tx, baseTY + 3.1, tz),
        makeFastBox(3.8, 0.24, 0.24, tx - 1.8, baseTY + 5.9, tz),
        makeFastBox(0.55, 1.3, 0.55, tx - 3.2, baseTY + 5.6, tz)
      );
    }
  }

  addChunkedArrayToScene(
    world.scene,
    yellowGeos,
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    }),
    { receiveShadow: false }
  );
  addChunkedArrayToScene(
    world.scene,
    whiteGeos,
    new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    }),
    { receiveShadow: false }
  );
  addChunkedArrayToScene(
    world.scene,
    medianGeos,
    new THREE.MeshStandardMaterial({ color: LEGO_COLORS.concrete, roughness: 0.5 }),
    { receiveShadow: true }
  );
  addChunkedArrayToScene(
    world.scene,
    turfGeos,
    new THREE.MeshStandardMaterial({ color: LEGO_COLORS.green, roughness: 0.5 }),
    { receiveShadow: true }
  );
  addChunkedArrayToScene(world.scene, poleGeos, getLegoMaterial(LEGO_COLORS.charcoal), {
    receiveShadow: false
  });
}
