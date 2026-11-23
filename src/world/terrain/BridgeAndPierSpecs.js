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
    let minSampleH = Infinity;
    let maxSampleH = -Infinity;
    for (let ix = 0; ix < 5; ix++) {
      const sx = minX + w * (ix * 0.25);
      for (let iz = 0; iz < 5; iz++) {
        const sz = minZ + d * (iz * 0.25);
        const h = getUrbanCityReliefY(sx, sz);
        if (h < minSampleH) minSampleH = h;
        if (h > maxSampleH) maxSampleH = h;
      }
    }
    if (maxSampleH - minSampleH < 0.004) {
      segX = 2;
      segZ = 2;
    }
  }

  const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

  const pos = geo.attributes.position;
  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const hy = getUrbanCityReliefY(vx, vz);
    pos.setY(i, hy);
    if (hy < minH) minH = hy;
    if (hy > maxH) maxH = hy;
  }

  // Normais analíticas contínuas por diferenças centrais (zero emendas entre chunks!)
  const normAttr = geo.attributes.normal;
  if (maxH - minH >= 0.004) {
    const eps = 2.0;
    const twoEps = 2 * eps;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const nx = getUrbanCityReliefY(vx - eps, vz) - getUrbanCityReliefY(vx + eps, vz);
      const nz = getUrbanCityReliefY(vx, vz - eps) - getUrbanCityReliefY(vx, vz + eps);
      const invLen = 1 / Math.hypot(nx, twoEps, nz);
      normAttr.setXYZ(i, nx * invLen, twoEps * invLen, nz * invLen);
    }
  } else {
    for (let i = 0; i < pos.count; i++) {
      normAttr.setXYZ(i, 0, 1, 0);
    }
  }
  normAttr.needsUpdate = true;
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

function _cosineStep01(t) {
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return 0.5 * (1 - Math.cos(Math.PI * c));
}

function _createRadialRingsGeo(segs, apex, ringCount, evalRingVertex, withColor = false) {
  const vCount = 1 + segs * ringCount;
  const positions = new Float32Array(vCount * 3);
  const uvs = new Float32Array(vCount * 2);
  const colors = withColor ? new Float32Array(vCount * 3) : null;
  const indices = [];

  positions[0] = apex.x;
  positions[1] = apex.y;
  positions[2] = apex.z;
  uvs[0] = 0.5;
  uvs[1] = 0.5;
  if (colors && apex.color) {
    colors[0] = apex.color.r;
    colors[1] = apex.color.g;
    colors[2] = apex.color.b;
  }

  const tmp = { x: 0, y: 0, z: 0, u: 0.5, v: 0.5, color: null };
  for (let rIdx = 0; rIdx < ringCount; rIdx++) {
    for (let s = 0; s < segs; s++) {
      evalRingVertex(rIdx, s, (s / segs) * Math.PI * 2, tmp);
      const vi = 1 + rIdx * segs + s;
      positions[vi * 3] = tmp.x;
      positions[vi * 3 + 1] = tmp.y;
      positions[vi * 3 + 2] = tmp.z;
      uvs[vi * 2] = tmp.u;
      uvs[vi * 2 + 1] = tmp.v;
      if (colors && tmp.color) {
        colors[vi * 3] = tmp.color.r;
        colors[vi * 3 + 1] = tmp.color.g;
        colors[vi * 3 + 2] = tmp.color.b;
      }
    }
  }

  for (let s = 0; s < segs; s++) indices.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let rIdx = 0; rIdx < ringCount - 1; rIdx++) {
    const bIn = 1 + rIdx * segs;
    const bOut = 1 + (rIdx + 1) * segs;
    for (let s = 0; s < segs; s++) {
      const sNext = (s + 1) % segs;
      indices.push(bIn + s, bIn + sNext, bOut + s, bOut + s, bIn + sNext, bOut + sNext);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createSmoothIsletDomeGeo(isl, palette) {
  const ringRatios = [0.34, 0.68, 1.0, 1.22];
  const cTop = isl.biome === 'rock' ? palette.cRock : isl.biome === 'forest' ? palette.cForest : palette.cSandDry;
  const cMid = new THREE.Color().copy(palette.cSandDry).lerp(cTop, 0.52);
  const cShore = new THREE.Color().copy(palette.cSandWet).lerp(palette.cSandDry, 0.35);
  const cols = [cTop, cMid, cShore, palette.cDeepShoal];

  return _createRadialRingsGeo(
    16,
    { x: isl.x, y: isl.peakY, z: isl.z, color: cTop },
    ringRatios.length,
    (rIdx, _s, ang, out) => {
      const ratio = ringRatios[rIdx];
      const ux = Math.cos(ang);
      const uz = Math.sin(ang);
      const perturb = 1 + 0.12 * Math.sin(ang * 3 + isl.seed) + 0.07 * Math.cos(ang * 5 - isl.seed);
      const scaleR = 0.95 * perturb * ratio;
      out.x = isl.x + ux * isl.rx * scaleR;
      out.z = isl.z + uz * isl.rz * scaleR;
      out.y = ratio <= 1.0 ? 0.18 + (isl.peakY - 0.18) * (1 - _cosineStep01(ratio)) : -0.62;
      out.u = 0.5 + ux * ratio * 0.4;
      out.v = 0.5 + uz * ratio * 0.4;
      out.color = cols[rIdx];
    },
    true
  );
}

export function pushSculptedHorizonMountainGeos(horizonGeos, mt, idx) {
  const az = Math.atan2(mt.z, mt.x);
  const tx = -Math.sin(az);
  const tz = Math.cos(az);

  const pushMassif = (cx, cz, radius, height, skew, phase) => {
    const rings = [
      { rScale: 0.28, y: height * 0.72, shift: skew * radius * 0.26 },
      { rScale: 0.66, y: height * 0.3, shift: skew * radius * 0.14 },
      { rScale: 1.06, y: -6.0, shift: 0 }
    ];
    const apexShift = skew * radius * 0.34;
    horizonGeos.push(
      _createRadialRingsGeo(
        12,
        { x: cx + tx * apexShift, y: height, z: cz + tz * apexShift },
        rings.length,
        (rIdx, _s, ang, out) => {
          const rg = rings[rIdx];
          const mod = 1.0 + 0.2 * Math.cos(ang * 2 - phase) + 0.11 * Math.sin(ang * 3 + phase * 1.3);
          const rad = radius * rg.rScale * mod;
          out.x = cx + tx * rg.shift + Math.cos(ang) * rad;
          out.y = rg.y;
          out.z = cz + tz * rg.shift + Math.sin(ang) * rad;
          out.u = 0.5 + Math.cos(ang) * rg.rScale * 0.45;
          out.v = 0.5 + Math.sin(ang) * rg.rScale * 0.45;
        },
        false
      )
    );
  };

  pushMassif(mt.x, mt.z, mt.radius, mt.height, mt.ridgeSkew, idx * 0.9 + 0.4);
  const spurDir = mt.ridgeSkew >= 0 ? -1 : 1;
  pushMassif(
    mt.x + tx * mt.radius * 0.52 * spurDir,
    mt.z + tz * mt.radius * 0.52 * spurDir,
    mt.radius * 0.62,
    mt.height * 0.66,
    -mt.ridgeSkew * 0.6,
    idx * 1.4 + 2.1
  );
}
