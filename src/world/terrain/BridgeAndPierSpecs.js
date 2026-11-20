import * as THREE from 'three';
import { mergeBufferGeometries, getGeometryChunkKey } from '../buildings/GeometryMergeUtils.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';

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

/**
 * Retorna a cota Y em arco de uma ponte fluvial em `x`.
 */
export function getRiverBridgeArchY(spec, x) {
  if (!spec || x < spec.xStart || x > spec.xEnd) return 0;
  return spec.archHeight * Math.sin(((x - spec.xStart) / (spec.xEnd - spec.xStart)) * Math.PI);
}

/**
 * Constrói a geometria em arco da Ponte Rodoviária Boreal sobre o Fjord Norte (`Z = -2150`).
 */
export function buildBorealFjordBridge(world, roadAsphaltGeos, cliffGeos) {
  const borealBridge = PANGAEA_BRIDGE_SPECS[0];
  if (!borealBridge || borealBridge.z !== -2150) return;

  const steps = 16;
  const spanX = borealBridge.xEnd - borealBridge.xStart;
  const stepW = spanX / steps;
  for (let i = 0; i < steps; i++) {
    const bx0 = borealBridge.xStart + i * stepW;
    const bx1 = bx0 + stepW;
    const bxm = (bx0 + bx1) * 0.5;
    const by0 = getRiverBridgeArchY(borealBridge, bx0);
    const by1 = getRiverBridgeArchY(borealBridge, bx1);
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

export function createSubdividedTerrainSectorGeo(minX, maxX, minZ, maxZ, cellSize = 18) {
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

export function pushChunkedTerrainSectorGeos(bucket, minX, maxX, minZ, maxZ, cellSize = 18, maxTile = 512) {
  for (let x0 = minX; x0 < maxX - 0.01; x0 += maxTile) {
    const x1 = Math.min(maxX, x0 + maxTile);
    for (let z0 = minZ; z0 < maxZ - 0.01; z0 += maxTile) {
      const z1 = Math.min(maxZ, z0 + maxTile);
      bucket.push(createSubdividedTerrainSectorGeo(x0, x1, z0, z1, cellSize));
    }
  }
}

export function addChunkedArrayToScene(scene, geos, mat, opts = {}) {
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
