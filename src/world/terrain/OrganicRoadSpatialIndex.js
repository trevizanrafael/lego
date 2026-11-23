/**
 * OrganicRoadSpatialIndex.js
 * Índice espacial 2D O(1) em células de 128m x 128m (`world._organicRoadGrid`) para consultas
 * contínuas de asfalto/calçadas/ilhas orgânicas e primitivas de geometria de guias/prismas.
 */

import * as THREE from 'three';
import { METRO_ISLAND_CUTOUTS } from '../MetroSystemBuilder.js';
import {
  IS_SCALED_WORLD,
  ROAD,
  URBAN_GRID_LINES_X,
  URBAN_GRID_LINES_Z,
  ws
} from '../core/WorldLayoutScale.js';
import { getDowntownOrganicNetwork } from './OrganicDowntownNetworkSpec.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';

export const ORGANIC_HASH_CELL = 128;

export function packHashCell(gx, gz) {
  return ((gx & 0xffff) << 16) | (gz & 0xffff);
}

export function isPointInMetroCutout(x, z, pad = 0.6) {
  for (let i = 0; i < METRO_ISLAND_CUTOUTS.length; i++) {
    const c = METRO_ISLAND_CUTOUTS[i];
    if (x >= c.minX - pad && x <= c.maxX + pad && z >= c.minZ - pad && z <= c.maxZ + pad) {
      return true;
    }
  }
  return false;
}

export function isPointInCartesianGridAsphalt(x, z, pad = 0) {
  if (!IS_SCALED_WORLD) return false;
  for (let i = 0; i < URBAN_GRID_LINES_X.length; i++) {
    const ln = URBAN_GRID_LINES_X[i];
    if (Math.abs(x - ln.coord) > ln.halfWidth + pad) continue;
    if (ln.designCoord === 0) {
      if ((z > ws(-250) + pad && z < ws(-117) - pad) || (z > ws(134) + pad && z < ws(402) - pad)) continue;
    } else if (Math.abs(ln.designCoord) <= 384 && z > ws(134) + pad && z < ws(402) - pad) {
      continue;
    } else if (ln.designCoord === -648 && z > ws(-512) + pad && z < ws(402) - pad) {
      continue;
    }
    if (z >= ws(-1312) - 20 && z <= ws(710) + 20) return true;
  }
  for (let i = 0; i < URBAN_GRID_LINES_Z.length; i++) {
    const ln = URBAN_GRID_LINES_Z[i];
    if (Math.abs(z - ln.coord) > ln.halfWidth + pad) continue;
    const minX = ws(ln.designCoord === 710 ? -1815 : -648) - 20;
    const maxX = ws(ln.designCoord <= 134 ? 1616 : 526) + 20;
    if (x >= minX && x <= maxX) return true;
  }
  return false;
}

export function ensureOrganicRoadSpatialIndex(world) {
  if (!IS_SCALED_WORLD || !world) return null;
  if (world._organicRoadGrid) return world._organicRoadGrid;

  const net = getDowntownOrganicNetwork();
  const grid = new Map();
  const getCell = (gx, gz) => {
    const key = packHashCell(gx, gz);
    let cell = grid.get(key);
    if (!cell) {
      cell = { segs: [], rbs: [] };
      grid.set(key, cell);
    }
    return cell;
  };

  for (let i = 0; i < net.segments.length; i++) {
    const s = net.segments[i];
    const vx = s.x2 - s.x1;
    const vz = s.z2 - s.z1;
    const lenSq = vx * vx + vz * vz;
    if (lenSq < 0.25) continue;
    const entry = {
      x1: s.x1,
      z1: s.z1,
      x2: s.x2,
      z2: s.z2,
      vx,
      vz,
      invLenSq: 1 / lenSq,
      halfWidth: s.halfWidth,
      sidewalk: s.sidewalk
    };
    const gx0 = Math.floor((s.minX - 4) / ORGANIC_HASH_CELL);
    const gx1 = Math.floor((s.maxX + 4) / ORGANIC_HASH_CELL);
    const gz0 = Math.floor((s.minZ - 4) / ORGANIC_HASH_CELL);
    const gz1 = Math.floor((s.maxZ + 4) / ORGANIC_HASH_CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        getCell(gx, gz).segs.push(entry);
      }
    }
  }

  for (let i = 0; i < net.roundabouts.length; i++) {
    const rb = net.roundabouts[i];
    const span = rb.outerR + rb.sidewalk + 4;
    const gx0 = Math.floor((rb.cx - span) / ORGANIC_HASH_CELL);
    const gx1 = Math.floor((rb.cx + span) / ORGANIC_HASH_CELL);
    const gz0 = Math.floor((rb.cz - span) / ORGANIC_HASH_CELL);
    const gz1 = Math.floor((rb.cz + span) / ORGANIC_HASH_CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        getCell(gx, gz).rbs.push(rb);
      }
    }
  }

  world._organicRoadGrid = grid;
  return grid;
}

const _EMPTY_ORG_STATE = Object.freeze({
  hasFeature: false,
  inAsphalt: false,
  inSidewalk: false,
  inIsland: false,
  curbLift: 0,
  minSignedDist: Infinity
});

export function getOrganicRoadElevationStateAt(world, x, z, out = null) {
  if (!IS_SCALED_WORLD || !world) return _EMPTY_ORG_STATE;
  const grid = world._organicRoadGrid || ensureOrganicRoadSpatialIndex(world);
  if (!grid) return _EMPTY_ORG_STATE;

  const gx = Math.floor(x / ORGANIC_HASH_CELL);
  const gz = Math.floor(z / ORGANIC_HASH_CELL);
  const cell = grid.get(packHashCell(gx, gz));
  if (!cell) return _EMPTY_ORG_STATE;

  const res = out || {
    hasFeature: false,
    inAsphalt: false,
    inSidewalk: false,
    inIsland: false,
    curbLift: 0,
    minSignedDist: Infinity
  };

  const rbs = cell.rbs;
  let minSigned = Infinity;
  for (let i = 0; i < rbs.length; i++) {
    const rb = rbs[i];
    const dr = Math.hypot(x - rb.cx, z - rb.cz);
    if (dr < rb.innerR) {
      res.hasFeature = true;
      res.inAsphalt = false;
      res.inSidewalk = false;
      res.inIsland = true;
      res.curbLift = 0.24;
      res.minSignedDist = rb.innerR - dr;
      return res;
    }
    const sRb = dr - rb.outerR;
    if (sRb < minSigned) minSigned = sRb;
  }

  const segs = cell.segs;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    let t = ((x - s.x1) * s.vx + (z - s.z1) * s.vz) * s.invLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const dx = x - (s.x1 + t * s.vx);
    const dz = z - (s.z1 + t * s.vz);
    const d = Math.sqrt(dx * dx + dz * dz) - s.halfWidth;
    if (d < minSigned) minSigned = d;
  }

  res.minSignedDist = minSigned;
  res.inIsland = false;
  if (minSigned <= 0) {
    res.hasFeature = true;
    res.inAsphalt = true;
    res.inSidewalk = false;
    res.curbLift = minSigned <= -0.45 ? 0 : ((minSigned + 0.45) / 0.45) * ROAD.curbHeight;
    return res;
  }

  const sw = ROAD.sidewalk;
  if (minSigned <= sw) {
    res.hasFeature = true;
    res.inAsphalt = false;
    res.inSidewalk = true;
    res.curbLift = ROAD.curbHeight;
    return res;
  }

  if (minSigned < sw + 0.5) {
    const u = (minSigned - sw) / 0.5;
    res.hasFeature = true;
    res.inAsphalt = false;
    res.inSidewalk = false;
    res.curbLift = ROAD.curbHeight * (1 - u) + 0.14 * u;
    return res;
  }

  res.hasFeature = false;
  res.inAsphalt = false;
  res.inSidewalk = false;
  res.curbLift = 0;
  return res;
}

export function pushPrismQuad(bucket, p0x, p0z, p1x, p1z, p2x, p2z, p3x, p3z, topOffY, thickness = 0.34) {
  const pos = new Float32Array(24);
  const pts = [
    [p0x, p0z],
    [p1x, p1z],
    [p2x, p2z],
    [p3x, p3z]
  ];
  for (let i = 0; i < 4; i++) {
    const [vx, vz] = pts[i];
    const topY = getUrbanCityReliefY(vx, vz) + topOffY;
    pos[i * 3] = vx;
    pos[i * 3 + 1] = topY;
    pos[i * 3 + 2] = vz;
    pos[(i + 4) * 3] = vx;
    pos[(i + 4) * 3 + 1] = topY - thickness;
    pos[(i + 4) * 3 + 2] = vz;
  }
  const idx = new Uint16Array([
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  bucket.push(geo);
}

export function pushOrientedCurbPiece(bucket, x0, z0, x1, z1, curbH) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.25) return;
  const xm = (x0 + x1) * 0.5;
  const zm = (z0 + z1) * 0.5;
  const y0 = getUrbanCityReliefY(x0, z0) + curbH;
  const y1 = getUrbanCityReliefY(x1, z1) + curbH;
  const ym = (y0 + y1) * 0.5;
  const dy = y1 - y0;
  const skirtH = curbH + 0.38;
  const g = new THREE.BoxGeometry(0.35, skirtH, Math.hypot(len, dy) + 0.08);
  if (Math.abs(dy) > 0.004) g.rotateX(-Math.atan2(dy, len));
  g.rotateY(Math.atan2(dx, dz));
  g.translate(xm, ym - skirtH * 0.5 + 0.004, zm);
  bucket.push(g);
}
