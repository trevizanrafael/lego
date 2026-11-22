import * as THREE from 'three';
import { mergeBufferGeometries, getGeometryChunkKey } from '../buildings/GeometryMergeUtils.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../core/WorldLayoutScale.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';

/**
 * Especificação Oficial das 9 Pontes Elevadas em Arco sobre o Rio/Canal Urbano Leste (X = ws(526)..ws(594))
 * Equação da curva suave: bridgeY = archHeight * Math.sin(((x - xStart) / (xEnd - xStart)) * Math.PI)
 */
export const RIVER_BRIDGE_SPECS = [
  { z: ws(-776), width: IS_SCALED_WORLD ? ROAD.secondaryWidth : 26, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'pcc_north', label: 'PONTE NORTE DO CANAL' },
  { z: ws(-512), width: IS_SCALED_WORLD ? ROAD.secondaryWidth : 28, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'pcc_gate', label: 'PONTE FRONTEIRA SUBÚRBIO-PCC' },
  { z: ws(-382), width: IS_SCALED_WORLD ? ROAD.mainWidth : 30, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'pcc_gate', label: 'PONTE DA CIDADELA NORTE' },
  { z: ws(-250), width: IS_SCALED_WORLD ? ROAD.mainWidth : 30, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'pcc_gate', label: 'PONTE CENTRAL DO SINDICATO' },
  { z: ws(-117), width: IS_SCALED_WORLD ? ROAD.mainWidth : 30, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'pcc_gate', label: 'PONTE DO CENTRO FINANCEIRO' },
  { z: ws(0), width: IS_SCALED_WORLD ? ROAD.mainWidth : 30, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'pcc_gate', label: 'PONTE MONUMENTAL LESTE-OESTE' },
  { z: ws(134), width: IS_SCALED_WORLD ? ROAD.mainWidth : 30, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'port_gate', label: 'PONTE DO PARQUE & PORTO' },
  { z: ws(402), width: IS_SCALED_WORLD ? ROAD.mainWidth : 30, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'port_gate', label: 'PONTE LOGÍSTICA DAS DOCAS' },
  { z: ws(712), width: IS_SCALED_WORLD ? ROAD.mainWidth : 32, xStart: ws(526), xEnd: ws(594), archHeight: 5.0, style: 'beach', label: 'PONTE COSTEIRA DA ORLA SUL' }
];

export const PANGAEA_BRIDGE_SPECS = [
  { z: ws(-2150), width: IS_SCALED_WORLD ? ROAD.secondaryWidth : 28, xStart: ws(526), xEnd: ws(594), archHeight: 5.5, style: 'pcc_north', label: 'PONTE BOREAL DO FIORDE' }
];

/**
 * Especificação Oficial dos 3 Píeres/Decks Fluviais de Madeira no Rio Urbano (Cota da Água Y = -3.5, Deck Y = -2.9)
 */
export const RIVER_PIER_SPECS = [
  {
    id: 'central_park_pier',
    bank: 'west',
    z: ws(268),
    lengthZ: 32,
    deckXMin: ws(540),
    deckXMax: ws(540) + 7.5,
    rampXMin: ws(540) - 9,
    rampXMax: ws(540),
    deckY: -2.9,
    label: 'DECK FLUVIAL PARQUE CENTRAL'
  },
  {
    id: 'pcc_industrial_pier',
    bank: 'east',
    z: ws(-185),
    lengthZ: 32,
    deckXMin: ws(580) - 7.5,
    deckXMax: ws(580),
    rampXMin: ws(580),
    rampXMax: ws(580) + 9,
    deckY: -2.9,
    label: 'DOCA FLUVIAL DE FUGA (PCC)'
  },
  {
    id: 'south_beach_mouth_pier',
    bank: 'west',
    z: ws(845),
    lengthZ: 38,
    deckXMin: ws(540),
    deckXMax: ws(540) + 7.5,
    rampXMin: ws(540) - 9,
    rampXMax: ws(540),
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
 * Constrói a geometria em arco da Ponte Rodoviária Boreal sobre o Fjord Norte (`Z = ws(-2150)`).
 */
export function buildBorealFjordBridge(world, roadAsphaltGeos, cliffGeos) {
  const borealBridge = PANGAEA_BRIDGE_SPECS[0];
  if (!borealBridge || borealBridge.z !== ws(-2150)) return;

  const spanX = borealBridge.xEnd - borealBridge.xStart;
  const steps = IS_SCALED_WORLD ? Math.max(16, Math.round(spanX / 12)) : 16;
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
  let segX = Math.max(2, Math.round(w / cellSize));
  let segZ = Math.max(2, Math.round(d / cellSize));

  // Otimização 60 FPS em mundo escalado: tiles 100% planos usam malha leve 2x2!
  if (IS_SCALED_WORLD && (segX > 2 || segZ > 2)) {
    let minH = Infinity;
    let maxH = -Infinity;
    for (let ix = 0; ix < 5; ix++) {
      const sx = minX + w * (ix * 0.25);
      for (let iz = 0; iz < 5; iz++) {
        const sz = minZ + d * (iz * 0.25);
        const h = getUrbanCityReliefY(sx, sz);
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }
    if (maxH - minH < 0.004) {
      segX = 2;
      segZ = 2;
    }
  }

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
  const chunkSize = opts.chunkSize ?? ws(512);
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
