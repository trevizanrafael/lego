import * as THREE from 'three';
import { getLegoMaterial } from '../../materials/LegoMaterials.js';
import { makeFastBox } from '../buildings/GeometryMergeUtils.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from '../MetroSystemBuilder.js';
import {
  IS_SCALED_WORLD,
  ROAD,
  DESIGN_MAIN_AVENUES_X,
  DESIGN_MAIN_AVENUES_Z,
  DESIGN_SECONDARY_STREETS_Z,
  ws
} from '../core/WorldLayoutScale.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import { addChunkedArrayToScene } from './BridgeAndPierSpecs.js';
import { queryOrganicFeaturesInBounds } from './OrganicDowntownNetworkSpec.js';
import { getOrganicRoadElevationStateAt } from './OrganicRoadRibbonBuilder.js';

const BLOCK_HASH_CELL = 128;
const _ORG_SLICE_SCRATCH = {};

function sliceStripAroundOrganicMouths(world, strip, axis, margin = 1.5, minSpan = 4.0) {
  const start = axis === 'x' ? strip.minX : strip.minZ;
  const end = axis === 'x' ? strip.maxX : strip.maxZ;
  const total = end - start;
  if (total <= 0.1) return [];

  const steps = Math.max(1, Math.ceil(total / 1.0));
  const step = total / steps;
  const c0 = axis === 'x' ? strip.minZ + 0.4 : strip.minX + 0.4;
  const cm = axis === 'x' ? (strip.minZ + strip.maxZ) * 0.5 : (strip.minX + strip.maxX) * 0.5;
  const c1 = axis === 'x' ? strip.maxZ - 0.4 : strip.maxX - 0.4;

  const isSampleBlocked = (u) => {
    for (const crossC of [c0, cm, c1]) {
      const px = axis === 'x' ? u : crossC;
      const pz = axis === 'x' ? crossC : u;
      const st = getOrganicRoadElevationStateAt(world, px, pz, _ORG_SLICE_SCRATCH);
      if (st.minSignedDist <= margin) return true;
    }
    return false;
  };

  const out = [];
  let runStart = null;
  for (let i = 0; i < steps; i++) {
    const u0 = start + i * step;
    const u1 = u0 + step;
    const um = (u0 + u1) * 0.5;
    if (!isSampleBlocked(um)) {
      if (runStart === null) runStart = u0;
    } else if (runStart !== null) {
      if (u0 - runStart >= minSpan) {
        out.push(
          axis === 'x'
            ? { ...strip, minX: runStart, maxX: u0 }
            : { ...strip, minZ: runStart, maxZ: u0 }
        );
      }
      runStart = null;
    }
  }
  if (runStart !== null && end - runStart >= minSpan) {
    out.push(
      axis === 'x'
        ? { ...strip, minX: runStart, maxX: end }
        : { ...strip, minZ: runStart, maxZ: end }
    );
  }
  return out;
}

function sliceLineSpanAroundOrganicMouths(world, fixedCoord, fromCoord, toCoord, axis, margin = 1.5) {
  const total = toCoord - fromCoord;
  if (total <= 0.5) return [];
  const steps = Math.max(1, Math.ceil(total / 1.0));
  const step = total / steps;
  const out = [];
  let runStart = null;
  for (let i = 0; i < steps; i++) {
    const u0 = fromCoord + i * step;
    const u1 = u0 + step;
    const um = (u0 + u1) * 0.5;
    const px = axis === 'x' ? um : fixedCoord;
    const pz = axis === 'x' ? fixedCoord : um;
    const st = getOrganicRoadElevationStateAt(world, px, pz, _ORG_SLICE_SCRATCH);
    if (st.minSignedDist > margin) {
      if (runStart === null) runStart = u0;
    } else if (runStart !== null) {
      if (u0 - runStart >= 2.0) out.push([runStart, u0]);
      runStart = null;
    }
  }
  if (runStart !== null && toCoord - runStart >= 2.0) {
    out.push([runStart, toCoord]);
  }
  return out;
}

function pushOrganicAwareInnerPad(world, innerPadGeos, innerRect, cutouts, topOffsetY) {
  const w = innerRect.maxX - innerRect.minX;
  const d = innerRect.maxZ - innerRect.minZ;
  if (w <= 0.5 || d <= 0.5) return;
  const nx = Math.max(1, Math.ceil(w / 14));
  const nz = Math.max(1, Math.ceil(d / 14));
  const stepX = w / nx;
  const stepZ = d / nz;

  const isTileClearOfAsphalt = (x0, x1, z0, z1) => {
    const xm = (x0 + x1) * 0.5;
    const zm = (z0 + z1) * 0.5;
    const pts = [
      [xm, zm],
      [x0, z0],
      [x1, z0],
      [x0, z1],
      [x1, z1],
      [xm, z0],
      [xm, z1],
      [x0, zm],
      [x1, zm]
    ];
    for (let i = 0; i < pts.length; i++) {
      const st = getOrganicRoadElevationStateAt(world, pts[i][0], pts[i][1], _ORG_SLICE_SCRATCH);
      if (st.inAsphalt || st.inIsland || st.minSignedDist <= 0.8) return false;
    }
    return true;
  };

  for (let iz = 0; iz < nz; iz++) {
    const z0 = innerRect.minZ + iz * stepZ;
    const z1 = z0 + stepZ;
    let runStartX = null;
    for (let ix = 0; ix < nx; ix++) {
      const x0 = innerRect.minX + ix * stepX;
      const x1 = x0 + stepX;
      if (isTileClearOfAsphalt(x0, x1, z0, z1)) {
        if (runStartX === null) runStartX = x0;
      } else if (runStartX !== null) {
        pushSlicedSlab(innerPadGeos, { minX: runStartX, maxX: x0, minZ: z0, maxZ: z1 }, cutouts, topOffsetY, 0.26);
        runStartX = null;
      }
    }
    if (runStartX !== null) {
      pushSlicedSlab(innerPadGeos, { minX: runStartX, maxX: innerRect.maxX, minZ: z0, maxZ: z1 }, cutouts, topOffsetY, 0.26);
    }
  }
}

const WEST_GRID_DESIGN_X = [-648, -516, -384, -252, -120, 0, 120, 252, 384, 516];
const EAST_SUBURB_DESIGN_X = [600, 648, 768, 964, 1160, 1344, 1524];
const EAST_IND_DESIGN_X = [600, 768, 964, 1160, 1344, 1524];
const ALL_GRID_DESIGN_Z = [...DESIGN_SECONDARY_STREETS_Z, ...DESIGN_MAIN_AVENUES_Z].sort(
  (a, b) => a - b
);

const MAIN_X_SET = new Set(DESIGN_MAIN_AVENUES_X);
const MAIN_Z_SET = new Set(DESIGN_MAIN_AVENUES_Z);

function halfRoadForDesignX(dx) {
  return (MAIN_X_SET.has(dx) ? ROAD.mainWidth : ROAD.secondaryWidth) * 0.5;
}

function halfRoadForDesignZ(dz) {
  return (MAIN_Z_SET.has(dz) ? ROAD.mainWidth : ROAD.secondaryWidth) * 0.5;
}

function pushTerrainSlabPiece(bucket, minX, maxX, minZ, maxZ, topOffsetY, slabThickness = 0.24) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w <= 0.05 || d <= 0.05) return;

  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const yNW = getUrbanCityReliefY(minX, minZ);
  const yNE = getUrbanCityReliefY(maxX, minZ);
  const ySW = getUrbanCityReliefY(minX, maxZ);
  const ySE = getUrbanCityReliefY(maxX, maxZ);
  const yC = getUrbanCityReliefY(cx, cz);
  const minH = Math.min(yNW, yNE, ySW, ySE, yC);
  const maxH = Math.max(yNW, yNE, ySW, ySE, yC);

  if (maxH - minH < 0.015) {
    bucket.push(makeFastBox(w, slabThickness, d, cx, yC + topOffsetY - slabThickness * 0.5, cz));
    return;
  }

  const segX = Math.max(2, Math.min(18, Math.ceil(w / 24)));
  const segZ = Math.max(2, Math.min(18, Math.ceil(d / 24)));
  const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    pos.setY(i, getUrbanCityReliefY(vx, vz) + topOffsetY);
  }
  geo.computeVertexNormals();
  bucket.push(geo);
}

function pushSlicedSlab(bucket, rect, cutouts, topOffsetY, slabThickness = 0.24) {
  const overlapsCut = cutouts.some(
    (c) =>
      c.maxX > rect.minX && c.minX < rect.maxX && c.maxZ > rect.minZ && c.minZ < rect.maxZ
  );
  if (!overlapsCut) {
    pushTerrainSlabPiece(bucket, rect.minX, rect.maxX, rect.minZ, rect.maxZ, topOffsetY, slabThickness);
    return;
  }
  const pieces = sliceRectAroundCutouts(rect, cutouts);
  for (let i = 0; i < pieces.length; i++) {
    const r = pieces[i];
    pushTerrainSlabPiece(bucket, r.minX, r.maxX, r.minZ, r.maxZ, topOffsetY, slabThickness);
  }
}

function pushCurbSkirtAlongX(bucket, zLine, xFrom, xTo, curbH) {
  const span = xTo - xFrom;
  if (span <= 0.5) return;
  const steps = Math.max(1, Math.ceil(span / 28));
  const dx = span / steps;
  for (let i = 0; i < steps; i++) {
    const x0 = xFrom + i * dx;
    const x1 = x0 + dx;
    const xm = (x0 + x1) * 0.5;
    const y0 = getUrbanCityReliefY(x0, zLine) + curbH;
    const y1 = getUrbanCityReliefY(x1, zLine) + curbH;
    const ym = (y0 + y1) * 0.5;
    const dy = y1 - y0;
    const skirtH = curbH + 0.42;
    if (Math.abs(dy) < 0.008) {
      bucket.push(makeFastBox(dx + 0.04, skirtH, 0.35, xm, ym - skirtH * 0.5 + 0.005, zLine));
    } else {
      const g = new THREE.BoxGeometry(Math.hypot(dx, dy) + 0.06, skirtH, 0.35);
      g.rotateZ(Math.atan2(dy, dx));
      g.translate(xm, ym - skirtH * 0.5 + 0.005, zLine);
      bucket.push(g);
    }
  }
}

function pushCurbSkirtAlongZ(bucket, xLine, zFrom, zTo, curbH) {
  const span = zTo - zFrom;
  if (span <= 0.5) return;
  const steps = Math.max(1, Math.ceil(span / 28));
  const dz = span / steps;
  for (let i = 0; i < steps; i++) {
    const z0 = zFrom + i * dz;
    const z1 = z0 + dz;
    const zm = (z0 + z1) * 0.5;
    const y0 = getUrbanCityReliefY(xLine, z0) + curbH;
    const y1 = getUrbanCityReliefY(xLine, z1) + curbH;
    const ym = (y0 + y1) * 0.5;
    const dy = y1 - y0;
    const skirtH = curbH + 0.42;
    if (Math.abs(dy) < 0.008) {
      bucket.push(makeFastBox(0.35, skirtH, dz + 0.04, xLine, ym - skirtH * 0.5 + 0.005, zm));
    } else {
      const g = new THREE.BoxGeometry(0.35, skirtH, Math.hypot(dz, dy) + 0.06);
      g.rotateX(-Math.atan2(dy, dz));
      g.translate(xLine, ym - skirtH * 0.5 + 0.005, zm);
      bucket.push(g);
    }
  }
}

function pushCornerCurbRamps(rampBucket, cornerX, cornerZ, dirInX, dirInZ, curbH) {
  const rampLen = 1.9;
  const rampW = 3.4;
  const baseGround = getUrbanCityReliefY(cornerX, cornerZ);
  const tilt = Math.atan2(curbH, rampLen);

  // Rampa voltada para a travessia do eixo X (borda X do quarteirão)
  const rx1 = cornerX + dirInX * (rampLen * 0.5);
  const rz1 = cornerZ + dirInZ * 3.6;
  const gX = new THREE.BoxGeometry(rampLen, 0.12, rampW);
  gX.rotateZ(dirInX * tilt);
  gX.translate(rx1, baseGround + curbH * 0.5 - 0.02, rz1);
  rampBucket.push(gX);

  // Rampa voltada para a travessia do eixo Z (borda Z do quarteirão)
  const rx2 = cornerX + dirInX * 3.6;
  const rz2 = cornerZ + dirInZ * (rampLen * 0.5);
  const gZ = new THREE.BoxGeometry(rampW, 0.12, rampLen);
  gZ.rotateX(-dirInZ * tilt);
  gZ.translate(rx2, baseGround + curbH * 0.5 - 0.02, rz2);
  rampBucket.push(gZ);
}

/**
 * Constrói todas as calçadas perimetrais de 10m (+0.18m de guia + rampas de esquina)
 * e os miolos lisos de quadra (+0.14m) em batches espaciais de alta performance (60 FPS),
 * populando `world.sidewalkCorridors`, `world.crosswalkZones` e o índice O(1) de guias.
 */
export function buildScaledUrbanSidewalksAndBlockPads(world) {
  if (!IS_SCALED_WORLD) return;

  const sw = ROAD.sidewalk; // 10m
  const curbH = ROAD.curbHeight; // 0.18m
  const innerPadTop = 0.14;

  const sidewalkGeos = [];
  const curbGeos = [];
  const rampGeos = [];
  const innerPadGeos = [];

  if (!world.mapSidewalks) world.mapSidewalks = [];
  if (!world.sidewalkCorridors) world.sidewalkCorridors = [];
  if (!world.crosswalkZones) world.crosswalkZones = [];

  const blockGrid = new Map();
  world._urbanBlockGrid = blockGrid;

  const expandedCutouts = METRO_ISLAND_CUTOUTS.map((c) => ({
    minX: c.minX - 0.5,
    maxX: c.maxX + 0.5,
    minZ: c.minZ - 0.5,
    maxZ: c.maxZ + 0.5
  }));

  const registerBlockCell = (dx0, dx1, dz0, dz1, tagPrefix) => {
    const sx0 = ws(dx0);
    const sx1 = ws(dx1);
    const sz0 = ws(dz0);
    const sz1 = ws(dz1);

    const bMinX = sx0 + halfRoadForDesignX(dx0);
    const bMaxX = sx1 - halfRoadForDesignX(dx1);
    const bMinZ = sz0 + halfRoadForDesignZ(dz0);
    const bMaxZ = sz1 - halfRoadForDesignZ(dz1);

    if (bMaxX - bMinX <= sw * 2 + 2 || bMaxZ - bMinZ <= sw * 2 + 2) return;

    const blockId = `${tagPrefix}_${dx0}_${dz0}`;
    const blockEntry = { minX: bMinX, maxX: bMaxX, minZ: bMinZ, maxZ: bMaxZ, blockId };

    // Indexa quarteirão em grade espacial O(1) para `getScaledUrbanCurbLiftAt`
    const gx0 = Math.floor(bMinX / BLOCK_HASH_CELL);
    const gx1 = Math.floor(bMaxX / BLOCK_HASH_CELL);
    const gz0 = Math.floor(bMinZ / BLOCK_HASH_CELL);
    const gz1 = Math.floor(bMaxZ / BLOCK_HASH_CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const key = `${gx},${gz}`;
        let list = blockGrid.get(key);
        if (!list) {
          list = [];
          blockGrid.set(key, list);
        }
        list.push(blockEntry);
      }
    }

    const isOrganicCandidate = dx0 >= -516 && dx1 <= 516 && dz0 >= -512 && dz1 <= 134;
    let hasOrganic = false;
    if (isOrganicCandidate) {
      const orgFeats = queryOrganicFeaturesInBounds(bMinX, bMaxX, bMinZ, bMaxZ, 24);
      hasOrganic = orgFeats.segments.length > 0 || orgFeats.roundabouts.length > 0;
    }

    // 4 faixas perimetrais de calçada (10m de largura, +0.18m acima da rua local)
    const northStrip = { minX: bMinX, maxX: bMaxX, minZ: bMinZ, maxZ: bMinZ + sw, _axis: 'x' };
    const southStrip = { minX: bMinX, maxX: bMaxX, minZ: bMaxZ - sw, maxZ: bMaxZ, _axis: 'x' };
    const westStrip = { minX: bMinX, maxX: bMinX + sw, minZ: bMinZ + sw, maxZ: bMaxZ - sw, _axis: 'z' };
    const eastStrip = { minX: bMaxX - sw, maxX: bMaxX, minZ: bMinZ + sw, maxZ: bMaxZ - sw, _axis: 'z' };

    for (const rawSt of [northStrip, southStrip, westStrip, eastStrip]) {
      const subStrips = hasOrganic
        ? sliceStripAroundOrganicMouths(world, rawSt, rawSt._axis, 1.5, 4.0)
        : [rawSt];
      for (let s = 0; s < subStrips.length; s++) {
        const st = subStrips[s];
        pushSlicedSlab(sidewalkGeos, st, expandedCutouts, curbH, 0.34);
        const safeFootings = sliceRectAroundCutouts(st, expandedCutouts);
        for (let i = 0; i < safeFootings.length; i++) {
          world.mapSidewalks.push(safeFootings[i]);
        }
      }
    }

    // Meio-fio chanfrado de 0.35m (recuado 6.2m nas esquinas e fatiado nas bocas orgânicas)
    if (!hasOrganic) {
      pushCurbSkirtAlongX(curbGeos, bMinZ + 0.175, bMinX + 6.2, bMaxX - 6.2, curbH);
      pushCurbSkirtAlongX(curbGeos, bMaxZ - 0.175, bMinX + 6.2, bMaxX - 6.2, curbH);
      pushCurbSkirtAlongZ(curbGeos, bMinX + 0.175, bMinZ + 6.2, bMaxZ - 6.2, curbH);
      pushCurbSkirtAlongZ(curbGeos, bMaxX - 0.175, bMinZ + 6.2, bMaxZ - 6.2, curbH);
    } else {
      for (const [zLn, x0, x1] of [
        [bMinZ + 0.175, bMinX + 6.2, bMaxX - 6.2],
        [bMaxZ - 0.175, bMinX + 6.2, bMaxX - 6.2]
      ]) {
        const spans = sliceLineSpanAroundOrganicMouths(world, zLn, x0, x1, 'x', 1.5);
        for (let i = 0; i < spans.length; i++) {
          pushCurbSkirtAlongX(curbGeos, zLn, spans[i][0], spans[i][1], curbH);
        }
      }
      for (const [xLn, z0, z1] of [
        [bMinX + 0.175, bMinZ + 6.2, bMaxZ - 6.2],
        [bMaxX - 0.175, bMinZ + 6.2, bMaxZ - 6.2]
      ]) {
        const spans = sliceLineSpanAroundOrganicMouths(world, xLn, z0, z1, 'z', 1.5);
        for (let i = 0; i < spans.length; i++) {
          pushCurbSkirtAlongZ(curbGeos, xLn, spans[i][0], spans[i][1], curbH);
        }
      }
    }

    // 4 pares de rampas acessíveis nos cantos da quadra (pulando caso uma diagonal desembogue na esquina)
    for (const [cx, cz, dxIn, dzIn] of [
      [bMinX, bMinZ, 1, 1],
      [bMaxX, bMinZ, -1, 1],
      [bMinX, bMaxZ, 1, -1],
      [bMaxX, bMaxZ, -1, -1]
    ]) {
      if (
        !hasOrganic ||
        getOrganicRoadElevationStateAt(world, cx + dxIn * 2.5, cz + dzIn * 2.5, _ORG_SLICE_SCRATCH).minSignedDist > 1.5
      ) {
        pushCornerCurbRamps(rampGeos, cx, cz, dxIn, dzIn, curbH);
      }
    }

    // Miolo liso urbano (piso escuro limpo em +0.14m no centro da quadra, respeitando o asfalto orgânico)
    const innerRect = {
      minX: bMinX + sw,
      maxX: bMaxX - sw,
      minZ: bMinZ + sw,
      maxZ: bMaxZ - sw
    };
    if (hasOrganic) {
      pushOrganicAwareInnerPad(world, innerPadGeos, innerRect, expandedCutouts, innerPadTop);
    } else {
      pushSlicedSlab(innerPadGeos, innerRect, expandedCutouts, innerPadTop, 0.26);
    }

    // Registra bloco no minimapa / mapa tático [M]
    world.mapBlocks.push({
      x: (bMinX + bMaxX) * 0.5,
      z: (bMinZ + bMaxZ) * 0.5,
      w: bMaxX - bMinX,
      d: bMaxZ - bMinZ,
      color: '#334155',
      type: 'urban_block'
    });

    // Registra os corredores de pedestres no centro de cada calçada (+5.0m da guia), fatiados nas bocas orgânicas
    const baseCorridors = [
      { minX: bMinX, maxX: bMinX + sw, minZ: bMinZ, maxZ: bMaxZ, axis: 'z', centerCoord: bMinX + sw * 0.5, blockId },
      { minX: bMaxX - sw, maxX: bMaxX, minZ: bMinZ, maxZ: bMaxZ, axis: 'z', centerCoord: bMaxX - sw * 0.5, blockId },
      { minX: bMinX, maxX: bMaxX, minZ: bMinZ, maxZ: bMinZ + sw, axis: 'x', centerCoord: bMinZ + sw * 0.5, blockId },
      { minX: bMinX, maxX: bMaxX, minZ: bMaxZ - sw, maxZ: bMaxZ, axis: 'x', centerCoord: bMaxZ - sw * 0.5, blockId }
    ];
    if (!hasOrganic) {
      world.sidewalkCorridors.push(...baseCorridors);
    } else {
      for (let i = 0; i < baseCorridors.length; i++) {
        const sliced = sliceStripAroundOrganicMouths(world, baseCorridors[i], baseCorridors[i].axis, 1.5, 18.0);
        for (let k = 0; k < sliced.length; k++) {
          world.sidewalkCorridors.push(sliced[k]);
        }
      }
    }
  };

  // 1) Malha Oeste / Centro / Subúrbio / Orla Sul
  for (let ix = 0; ix < WEST_GRID_DESIGN_X.length - 1; ix++) {
    const dx0 = WEST_GRID_DESIGN_X[ix];
    const dx1 = WEST_GRID_DESIGN_X[ix + 1];
    for (let iz = 0; iz < ALL_GRID_DESIGN_Z.length - 1; iz++) {
      const dz0 = ALL_GRID_DESIGN_Z[iz];
      const dz1 = ALL_GRID_DESIGN_Z[iz + 1];

      // Encosta orgânica da Favela CDD (sem rua X = -648 entre Z = -512 e Z = +402)
      if (dx0 === -648 && dz0 >= -512 && dz1 <= 402) continue;
      // Gramado contínuo e Grande Lago do Parque Central (Z = 134..402, X = -516..+516)
      if (dz0 === 134 && dz1 === 402 && dx0 >= -516 && dx1 <= 516) continue;

      registerBlockCell(dx0, dx1, dz0, dz1, 'west');
    }
  }

  // 2) Malha Leste Industrial / Subúrbio Leste (X = 600..1524, Z = -1172..+134)
  for (let iz = 0; iz < ALL_GRID_DESIGN_Z.length - 1; iz++) {
    const dz0 = ALL_GRID_DESIGN_Z[iz];
    const dz1 = ALL_GRID_DESIGN_Z[iz + 1];
    if (dz1 > 134) continue;
    const xList = dz1 <= -512 ? EAST_SUBURB_DESIGN_X : EAST_IND_DESIGN_X;
    for (let ix = 0; ix < xList.length - 1; ix++) {
      registerBlockCell(xList[ix], xList[ix + 1], dz0, dz1, 'east');
    }
  }

  // 3) Registra `world.crosswalkZones` nos cruzamentos urbanos ativos
  const crossDesignXs = [-516, ...DESIGN_MAIN_AVENUES_X, 516, ...EAST_IND_DESIGN_X];
  for (const dx of crossDesignXs) {
    const ix = ws(dx);
    const hwX = halfRoadForDesignX(dx);
    for (const dz of ALL_GRID_DESIGN_Z) {
      if (dx >= 600 && dz > 134) continue;
      const iz = ws(dz);
      const hwZ = halfRoadForDesignZ(dz);
      world.crosswalkZones.push(
        { minX: ix - hwX, maxX: ix + hwX, minZ: iz - hwZ - 4.4, maxZ: iz - hwZ - 0.3, axis: 'x', ix, iz },
        { minX: ix - hwX, maxX: ix + hwX, minZ: iz + hwZ + 0.3, maxZ: iz + hwZ + 4.4, axis: 'x', ix, iz },
        { minX: ix - hwX - 4.4, maxX: ix - hwX - 0.3, minZ: iz - hwZ, maxZ: iz + hwZ, axis: 'z', ix, iz },
        { minX: ix + hwX + 0.3, maxX: ix + hwX + 4.4, minZ: iz - hwZ, maxZ: iz + hwZ, axis: 'z', ix, iz }
      );
    }
  }

  const chunkOpt = { receiveShadow: true, castShadow: false, chunkSize: ws(512) };
  addChunkedArrayToScene(
    world.scene,
    sidewalkGeos,
    new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.66, metalness: 0.05 }),
    chunkOpt
  );
  addChunkedArrayToScene(
    world.scene,
    curbGeos,
    getLegoMaterial(0x94a3b8, { roughness: 0.52, clearcoat: 0.12 }),
    chunkOpt
  );
  addChunkedArrayToScene(
    world.scene,
    rampGeos,
    getLegoMaterial(0xcbd5e1, { roughness: 0.48, clearcoat: 0.14 }),
    chunkOpt
  );
  addChunkedArrayToScene(
    world.scene,
    innerPadGeos,
    new THREE.MeshStandardMaterial({ color: 0x1c222d, roughness: 0.78, metalness: 0.04 }),
    chunkOpt
  );
}

/**
 * Degrau físico contínuo de +0.18m nas calçadas de 10m (rampa de 0.45m no meio-fio
 * e rampa suave de 1.8m nos cantos acessíveis) e +0.14m no miolo liso da quadra.
 */
export function getScaledUrbanCurbLiftAt(world, x, z) {
  if (!IS_SCALED_WORLD || !world?._urbanBlockGrid) return 0;
  const gx = Math.floor(x / BLOCK_HASH_CELL);
  const gz = Math.floor(z / BLOCK_HASH_CELL);
  const list = world._urbanBlockGrid.get(`${gx},${gz}`);
  if (!list) return 0;

  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (x <= b.minX || x >= b.maxX || z <= b.minZ || z >= b.maxZ) continue;

    const dxEdge = Math.min(x - b.minX, b.maxX - x);
    const dzEdge = Math.min(z - b.minZ, b.maxZ - z);
    const dEdge = Math.min(dxEdge, dzEdge);

    const org = getOrganicRoadElevationStateAt(world, x, z, _ORG_SLICE_SCRATCH);
    if (org.inIsland || org.inAsphalt) {
      return org.curbLift;
    }

    // Rampa acessível de esquina (1.8m) vs guia padrão (0.45m)
    const isCornerRampZone = dxEdge < 6.5 && dzEdge < 6.5;
    const rampSpan = isCornerRampZone ? 1.8 : 0.45;
    if (dEdge < rampSpan) {
      return (dEdge / rampSpan) * ROAD.curbHeight;
    }

    if (org.inSidewalk) {
      return ROAD.curbHeight;
    }

    // Faixa de 10m da calçada (+0.18m) descendo suavemente para +0.14m no miolo interno
    const sw = ROAD.sidewalk;
    if (dEdge <= sw) {
      return ROAD.curbHeight;
    }
    if (dEdge < sw + 0.5) {
      const t = (dEdge - sw) / 0.5;
      return ROAD.curbHeight * (1 - t) + 0.14 * t;
    }
    if (org.hasFeature && org.curbLift > 0.14) {
      return org.curbLift;
    }
    return 0.14;
  }
  return 0;
}
