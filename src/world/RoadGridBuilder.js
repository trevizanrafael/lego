import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import { applyAnimatedLegoWaterShader } from '../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox, makeFastBox, getGeometryChunkKey } from './BuildingGenerator.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from './MetroSystemBuilder.js';
import { getUrbanCityReliefY } from './ViaductAndReliefBuilder.js';
import {
  MAIN_WEST_POLYGON,
  EAST_PENINSULA_POLYGON,
  PRISON_ISLAND_POLYGON,
  ARCHIPELAGO_ISLETS,
  HORIZON_MOUNTAINS,
  REGION_BORDER_LINES
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
    const mesh = new THREE.Mesh(mergeBufferGeometries(list), mat);
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
    color: 0x0369a1,
    roughness: 0.22,
    metalness: 0.08
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

  // 1) Leito profundo ESTRITO do Rio / Canal Urbano Leste (X = 538..582, Z = -1330..+1080 em Y = -3.55)
  addWaterPlate(538, 582, -1330, 1080, -3.55);

  // 2) Leitos estreitos dos 3 Canais Estilo Santos na Praia Sul (Z = 724..1070 em Y = -0.52)
  for (const cx of [-384, -120, 252]) {
    addWaterPlate(cx - 12, cx + 12, 724, 1070, -0.52);
  }

  // 3) Placas do Oceano Atlântico ampliadas até o horizonte (±9500m) ao redor dos setores internos
  addWaterPlate(-9500, -1825, -9500, 9500, -0.45); // Oceano Oeste além do horizonte
  addWaterPlate(-1825, 540, -9500, -1320, -0.45);  // Oceano Norte Oeste além do horizonte
  addWaterPlate(540, 580, -9500, -1325, -0.45);    // Foz Norte Externa do Rio
  addWaterPlate(580, 9500, -9500, -1320, -0.45);   // Oceano Nordeste
  addWaterPlate(1628, 9500, -1320, 9500, -0.45);   // Oceano Extremo Leste
  addWaterPlate(580, 1628, 735, 9500, -0.45);      // Baía Sudeste (Ponte Blindada e Ilha da Prisão)
  addWaterPlate(-1825, 540, 1035, 9500, -0.45);    // Oceano Sul
  addWaterPlate(540, 580, 1075, 9500, -0.45);      // Foz Sul Externa do Rio

  const mergedOcean = new THREE.Mesh(mergeBufferGeometries(waterGeos), oceanMat);
  for (let i = 0; i < waterGeos.length; i++) waterGeos[i].dispose();
  mergedOcean.receiveShadow = false;
  world.scene.add(mergedOcean);

  const asphaltMat = new THREE.MeshStandardMaterial({
    color: LEGO_COLORS.asphalt,
    roughness: 0.78,
    metalness: 0.05
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

  // 6) Costa Orgânica (Praias, Costões/Falésias, Baías, Ilhotas do Arquipélago, Horizonte & Fronteiras)
  _buildOrganicCoastAndArchipelago(world);
}

function _buildOrganicCoastAndArchipelago(world) {
  const sandGeos = [];
  const cliffGeos = [];
  const turfGeos = [];
  const reefGeos = [];
  const horizonGeos = [];
  const borderAccentGeos = {
    '#fb923c': [],
    '#4ade80': [],
    '#fde047': [],
    '#94a3b8': [],
    '#ef4444': [],
    '#f59e0b': []
  };

  // Helper: constrói faixa costeira orgânica conectando cada segmento da poligonal ao retângulo interno
  const buildShoreRing = (poly, clampFn, isPrison = false) => {
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i];
      const [bx, bz] = poly[(i + 1) % poly.length];
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;
      const dx = bx - ax;
      const dz = bz - az;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 2 || segLen > 240) continue;

      const [ix, iz] = clampFn(mx, mz);
      const radialDx = mx - ix;
      const radialDz = mz - iz;
      const span = Math.hypot(radialDx, radialDz);
      if (span < 4) continue;

      // Não coloca falésia bloqueando Ponte da Prisão, Doca Guarda-Costeira ou Píer Sul/Canais
      if (isPrison && mx > 1300 && mx < 1450 && mz < 1165) continue;
      if (isPrison && mx < 955 && mz > 1470 && mz < 1630) continue;

      const cx = (mx + ix) * 0.5;
      const cz = (mz + iz) * 0.5;
      const wBox = Math.max(24, Math.abs(dx) + Math.abs(radialDx) + 22);
      const dBox = Math.max(24, Math.abs(dz) + Math.abs(radialDz) + 22);

      // Base firme caminhável acima do nível da água (Y = -0.8 .. +0.25)
      const isSandyCoast = mz > 700 || (mx < -1500 && mz > 650);
      if (isSandyCoast) {
        sandGeos.push(makeFastBox(wBox, 1.05, dBox, cx, -0.25, cz));
        reefGeos.push(makeFastBox(wBox + 14, 0.35, dBox + 14, mx, -0.52, mz));
      } else {
        turfGeos.push(makeFastBox(wBox, 1.05, dBox, cx, -0.26, cz));
        reefGeos.push(makeFastBox(wBox + 12, 0.35, dBox + 12, mx, -0.52, mz));
        // Costões / Falésias rochosas em trechos de cabos salientes (longe das estradas)
        if (span > 42 && i % 2 === 0) {
          const cliffH = 3.2 + ((i * 19) % 7) * 1.1;
          cliffGeos.push(
            makeFastBox(
              Math.max(18, Math.abs(dx) * 0.8 + 14),
              cliffH,
              Math.max(18, Math.abs(dz) * 0.8 + 14),
              mx - radialDx * 0.18,
              cliffH * 0.42 - 0.5,
              mz - radialDz * 0.18
            )
          );
        }
      }
    }
  };

  buildShoreRing(MAIN_WEST_POLYGON, (x, z) => [
    THREE.MathUtils.clamp(x, -1820, 535),
    THREE.MathUtils.clamp(z, -1315, 1040)
  ]);

  buildShoreRing(EAST_PENINSULA_POLYGON, (x, z) => [
    THREE.MathUtils.clamp(x, 585, 1624),
    THREE.MathUtils.clamp(z, -1315, 732)
  ]);

  buildShoreRing(
    PRISON_ISLAND_POLYGON,
    (x, z) => [
      THREE.MathUtils.clamp(x, 960, 1790),
      THREE.MathUtils.clamp(z, 1130, 1980)
    ],
    true
  );

  // Ilhotas do Arquipélago ao redor (camadas de recife, praia, grama/rocha + vegetação instanciada)
  const treeTransforms = [];
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
      treeTransforms.push({
        x: isl.x + Math.cos(a) * isl.rx * distR,
        y: midH + 2.4,
        z: isl.z + Math.sin(a) * isl.rz * distR,
        s: 1.0 + (k % 3) * 0.32
      });
    }
  }

  // Cadeia de Montanhas Distantes no Horizonte (360° dissolvendo o limite do oceano na neblina!)
  for (const mt of HORIZON_MOUNTAINS) {
    const r = mt.radius;
    const h = mt.height;
    horizonGeos.push(
      makeFastBox(r * 1.85, h * 0.42, r * 1.65, mt.x, h * 0.18 - 4, mt.z),
      makeFastBox(r * 1.15, h * 0.78, r * 1.05, mt.x + r * mt.ridgeSkew * 0.4, h * 0.36 - 2, mt.z),
      makeFastBox(r * 0.55, h, r * 0.52, mt.x - r * mt.ridgeSkew * 0.2, h * 0.48 - 2, mt.z)
    );
  }

  // Fronteiras Visuais Claras entre Regiões (meio-fios/muretas táticas sem fechar nenhuma rua!)
  const blockedAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
  const blockedAvenuesZ = [-382, -250, -117, 0, 134, 402, 710];
  const isNearAvenue = (val, list, margin = 22) => list.some((a) => Math.abs(val - a) < margin);

  for (const brd of REGION_BORDER_LINES) {
    const [x1, z1] = brd.from;
    const [x2, z2] = brd.to;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const totalLen = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.floor(totalLen / 36));
    const bucket = borderAccentGeos[brd.color] || [];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      if (Math.abs(dx) >= Math.abs(dz)) {
        if (isNearAvenue(px, blockedAvenuesX, 24)) continue;
      } else {
        if (isNearAvenue(pz, blockedAvenuesZ, 24)) continue;
      }
      const py = getUrbanCityReliefY(px, pz);
      const isHoriz = Math.abs(dx) >= Math.abs(dz);
      const isDriveOverBorder =
        brd.id === 'border_oeste_aero' ||
        brd.id === 'border_ind_porto' ||
        brd.id === 'border_cdd_centro';
      if (isDriveOverBorder) {
        bucket.push(makeFastBox(isHoriz ? 18 : 1.5, 0.16, isHoriz ? 1.5 : 18, px, py + 0.08, pz));
      } else {
        bucket.push(makeFastBox(isHoriz ? 16 : 1.3, 0.65, isHoriz ? 1.3 : 16, px, py + 0.32, pz));
        cliffGeos.push(makeFastBox(isHoriz ? 1.6 : 1.8, 1.15, isHoriz ? 1.8 : 1.6, px, py + 0.56, pz));
      }
    }
  }

  const flushBatch = (geos, mat, opts = {}) => {
    if (!geos.length) return;
    addChunkedArrayToScene(world.scene, geos, mat, { chunkSize: 700, receiveShadow: true, ...opts });
  };

  flushBatch(sandGeos, getLegoMaterial(0xeab308, { roughness: 0.72 }));
  flushBatch(turfGeos, getLegoMaterial(0x4d8b31, { roughness: 0.65 }));
  flushBatch(cliffGeos, getLegoMaterial(0x475569, { roughness: 0.78 }));
  flushBatch(reefGeos, new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.15 }));
  flushBatch(
    horizonGeos,
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.92, metalness: 0.04 }),
    { receiveShadow: false, chunkSize: 1800 }
  );

  for (const [hexStr, list] of Object.entries(borderAccentGeos)) {
    if (!list.length) continue;
    flushBatch(list, getLegoMaterial(parseInt(hexStr.replace('#', ''), 16), { roughness: 0.35 }));
  }

  if (treeTransforms.length > 0) {
    const dummy = new THREE.Object3D();
    const crownGeo = new THREE.ConeGeometry(4.2, 10.5, 6);
    const trunkGeo = new THREE.CylinderGeometry(0.9, 1.1, 5.0, 6);
    const crownInst = new THREE.InstancedMesh(crownGeo, getLegoMaterial(0x22c55e, { roughness: 0.5 }), treeTransforms.length);
    const trunkInst = new THREE.InstancedMesh(trunkGeo, getLegoMaterial(0x78350f, { roughness: 0.7 }), treeTransforms.length);
    treeTransforms.forEach((tr, idx) => {
      dummy.position.set(tr.x, tr.y + 4.0 * tr.s, tr.z);
      dummy.scale.set(tr.s, tr.s, tr.s);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx, dummy.matrix);
      dummy.position.set(tr.x, tr.y - 1.2, tr.z);
      dummy.scale.set(tr.s, tr.s, tr.s);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);
    });
    crownInst.instanceMatrix.needsUpdate = true;
    trunkInst.instanceMatrix.needsUpdate = true;
    world.scene.add(crownInst, trunkInst);
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
