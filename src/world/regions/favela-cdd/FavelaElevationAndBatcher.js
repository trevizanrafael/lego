import * as THREE from 'three';
import { markAsSharedAsset } from '../../BuildingGenerator.js';
import { IS_SCALED_WORLD, ws, fromWs } from '../../core/WorldLayoutScale.js';

const HILL_MIN_DESIGN_Z = -1825;
const HILL_MAX_DESIGN_Z = 680;
const HILL_Z_BANDS = 5;

const _UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const _BOX_POS = _UNIT_BOX.attributes.position.array;
const _BOX_NORM = _UNIT_BOX.attributes.normal.array;
const _BOX_UV = _UNIT_BOX.attributes.uv.array;
const _BOX_IDX = _UNIT_BOX.index.array;
_UNIT_BOX.dispose();

let _cachedWallAtlasTex = null;
let _cachedWallAtlasMat = null;
let _cachedSolidVcMat = null;
let _cachedBasicVcMat = null;

export function getFavelaEastBorderDesignX(dz) {
  if (dz >= -490 && dz <= 400) return -528;
  if (dz < -1318) {
    const tNorth = THREE.MathUtils.clamp((-1318 - dz) / 500, 0, 1);
    return THREE.MathUtils.lerp(-658, -715, 0.5 * (1 - Math.cos(Math.PI * tNorth)));
  }
  if (dz < -525 || dz > 435) return -658;
  const t = dz < -490 ? (-490 - dz) / 35 : (dz - 400) / 35;
  return THREE.MathUtils.lerp(-528, -658, 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp(t, 0, 1))));
}

export function getFavelaEastBorderX(z) {
  return ws(getFavelaEastBorderDesignX(fromWs(z)));
}

export function getFavelaElevation(x, z) {
  const ux = fromWs(x);
  const uz = fromWs(z);
  const zNorth = -1820;
  const zSouth = 675;
  if (uz <= zNorth || uz >= zSouth) return 0;

  const xEast = getFavelaEastBorderDesignX(uz);
  const xWest = -1012;
  if (ux >= xEast || ux <= xWest) return 0;

  const u = (xEast - ux) / (xEast - xWest);
  const peakU = 0.70;
  const profileX = u <= peakU
    ? 0.5 * (1 - Math.cos(Math.PI * (u / peakU)))
    : 0.5 * (1 + Math.cos(Math.PI * ((u - peakU) / (1 - peakU))));

  let profileZ = 1.0;
  const rampLenZ = 145;
  if (uz < zNorth + rampLenZ) {
    profileZ = 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp((uz - zNorth) / rampLenZ, 0, 1)));
  } else if (uz > zSouth - rampLenZ) {
    profileZ = 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp((zSouth - uz) / rampLenZ, 0, 1)));
  }

  const summitBoost = Math.exp(-Math.pow((uz + 240) / 280, 2)) * 5.5;
  const ridgeWave = Math.sin(uz * 0.0085) * 2.2 + Math.cos(ux * 0.015 + uz * 0.006) * 1.2;
  let h = Math.max(0, (38.5 + summitBoost + ridgeWave * profileX) * profileX * profileZ);

  const dSoccer = Math.hypot((ux + 605) / 34, (uz - 195) / 46);
  if (dSoccer < 1.35) {
    const w = dSoccer <= 0.78 ? 1.0 : 0.5 * (1 + Math.cos(Math.PI * ((dSoccer - 0.78) / 0.57)));
    h = THREE.MathUtils.lerp(h, 11.5, w);
  }
  const dBaile = Math.hypot((ux + 715) / 36, (uz + 135) / 42);
  if (dBaile < 1.35) {
    const w = dBaile <= 0.78 ? 1.0 : 0.5 * (1 + Math.cos(Math.PI * ((dBaile - 0.78) / 0.57)));
    h = THREE.MathUtils.lerp(h, 25.0, w);
  }
  const dSummit = Math.hypot((ux + 865) / 42, (uz + 240) / 56);
  if (dSummit < 1.35) {
    const w = dSummit <= 0.8 ? 1.0 : 0.5 * (1 + Math.cos(Math.PI * ((dSummit - 0.8) / 0.55)));
    h = THREE.MathUtils.lerp(h, 42.5, w);
  }

  const absZ = Math.abs(z);
  const flatHalfZ = IS_SCALED_WORLD ? 22.0 : 14.5;
  const rampHalfSpan = IS_SCALED_WORLD ? 24.0 : 15.5;
  if (absZ < flatHalfZ + rampHalfSpan) {
    if (absZ <= flatHalfZ) return 0;
    h *= 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp((absZ - flatHalfZ) / rampHalfSpan, 0, 1)));
  } else if (h > 3.5 && dSoccer >= 1.35 && dBaile >= 1.35 && dSummit >= 1.35) {
    h += Math.sin(ux * 0.055 + Math.sin(uz * 0.022) * 1.4) * 0.18 * Math.min(1, (h - 3.5) * 0.25);
  }
  return h;
}

export const WINDING_LADEIRAS = [
  { zStart: -1680, amp1: 20, freq1: 0.015, amp2: -12, freq2: 0.009, hasStairs: true },
  { zStart: -1520, amp1: -22, freq1: 0.016, amp2: 14, freq2: 0.008, hasStairs: false },
  { zStart: -1360, amp1: 24, freq1: 0.015, amp2: -12, freq2: 0.010, hasStairs: true },
  { zStart: -1190, amp1: 22, freq1: 0.015, amp2: -14, freq2: 0.009, hasStairs: true },
  { zStart: -1030, amp1: -25, freq1: 0.016, amp2: 15, freq2: 0.008, hasStairs: false },
  { zStart: -840, amp1: 26, freq1: 0.015, amp2: -12, freq2: 0.010, hasStairs: true },
  { zStart: -640, amp1: 24, freq1: 0.016, amp2: -14, freq2: 0.009, hasStairs: true },
  { zStart: -382, amp1: -28, freq1: 0.015, amp2: 18, freq2: 0.008, hasStairs: false },
  { zStart: -250, amp1: 22, freq1: 0.017, amp2: -12, freq2: 0.010, hasStairs: true },
  { zStart: -117, amp1: -24, freq1: 0.014, amp2: -16, freq2: 0.008, hasStairs: false },
  { zStart: 36, amp1: 28, freq1: 0.015, amp2: 14, freq2: 0.009, hasStairs: true },
  { zStart: 134, amp1: -22, freq1: 0.016, amp2: 15, freq2: 0.009, hasStairs: false },
  { zStart: 380, amp1: 26, freq1: 0.015, amp2: -16, freq2: 0.008, hasStairs: true },
  { zStart: 540, amp1: -24, freq1: 0.016, amp2: 12, freq2: 0.010, hasStairs: true }
];

export function getLadeiraZAtX(ladeira, x) {
  const zStartWorld = ws(ladeira.zStart);
  const dxDesign = Math.max(0, fromWs(getFavelaEastBorderX(zStartWorld) - x));
  return zStartWorld + ws(Math.sin(dxDesign * ladeira.freq1) * ladeira.amp1 + Math.sin(dxDesign * ladeira.freq2) * ladeira.amp2);
}

function hash2i(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function sampleBrickPixel(lx, ly) {
  const row = Math.floor(ly / 24);
  const inRowY = ly - row * 24;
  const bx = lx + (row & 1) * 21 + Math.floor((hash2i(row, 91) - 0.5) * 4);
  const col = Math.floor(bx / 42);
  const inBrickX = bx - col * 42;
  const n = hash2i(lx, ly);
  const mortarJitter = (hash2i(lx >> 1, row) - 0.5) * 1.8;
  if (inRowY < 3.3 + mortarJitter || inBrickX < 3.0 + mortarJitter * 0.7) {
    const m = 82 + Math.floor((n - 0.5) * 24);
    return [m, m + 3, m + 7];
  }
  const brickHash = hash2i(col + 17, row + 53);
  const flute = Math.sin((inBrickX / 42) * Math.PI * 8) * 9;
  const scorch = brickHash > 0.84 ? -22 : brickHash < 0.2 ? 14 : 0;
  const hole = brickHash > 0.91 && inRowY > 7 && inRowY < 18 && inBrickX % 10 < 4 ? -48 : 0;
  return [
    THREE.MathUtils.clamp(164 + scorch + flute + hole + (n - 0.5) * 22, 42, 208),
    THREE.MathUtils.clamp(64 + scorch * 0.45 + flute * 0.4 + hole * 0.5 + (n - 0.5) * 14, 20, 102),
    THREE.MathUtils.clamp(32 + scorch * 0.25 + hole * 0.3 + (n - 0.5) * 10, 12, 58)
  ];
}

export function createFavelaWallAtlasTexture() {
  if (_cachedWallAtlasTex) return _cachedWallAtlasTex;
  const size = 512;
  const data = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    const tileY = py >= 256 ? 1 : 0;
    const ly = py & 255;
    const dampBase = ly < 34 ? 1 - ((34 - ly) / 34) * 0.36 : 1.0;
    for (let px = 0; px < size; px++) {
      const tileId = tileY * 2 + (px >= 256 ? 1 : 0);
      const lx = px & 255;
      const grit = (hash2i(px, py) - 0.5) * 20;
      const coarse = Math.sin(lx * 0.075 + Math.cos(ly * 0.06) * 2.2) * 12;
      let r = 128, g = 128, b = 128;

      if (tileId === 0) {
        [r, g, b] = sampleBrickPixel(lx, ly);
      } else if (tileId === 1) {
        const mask = (lx * 0.65 + (255 - ly) * 0.55) / 255 + Math.sin(lx * 0.055) * 0.14 + (hash2i(lx >> 2, ly >> 2) - 0.5) * 0.24;
        if (mask > 0.58) {
          const pl = 104 + coarse * 0.8 + grit;
          r = pl - 3; g = pl; b = pl + 6;
        } else {
          [r, g, b] = sampleBrickPixel(lx, ly);
        }
      } else if (tileId === 2) {
        const trowel = Math.sin(Math.hypot(lx - 128, (ly % 84) - 42) * 0.24) * 9;
        const crack = Math.abs(lx - (92 + Math.sin(ly * 0.045) * 26)) < 1.2 && ly > 50 && ly < 210 ? -36 : 0;
        const base = 152 + coarse + trowel + grit * 1.15 + crack;
        r = base - 4; g = base; b = base + 7;
      } else {
        const peel = Math.sin(lx * 0.048 + 1.3) * 0.3 + Math.cos(ly * 0.052 - 0.7) * 0.3 + (hash2i(lx >> 3, ly >> 3) - 0.5) * 0.55;
        if (peel > 0.28) {
          const rawCem = 132 + grit;
          r = rawCem - 3; g = rawCem; b = rawCem + 5;
        } else {
          const paint = 216 + coarse * 0.5 + grit * 0.7;
          r = paint; g = paint - 2; b = paint - 5;
        }
      }
      const idx = (py * size + px) * 4;
      data[idx] = THREE.MathUtils.clamp(Math.round(r * dampBase), 0, 255);
      data[idx + 1] = THREE.MathUtils.clamp(Math.round(g * dampBase), 0, 255);
      data[idx + 2] = THREE.MathUtils.clamp(Math.round(b * dampBase), 0, 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _cachedWallAtlasTex = markAsSharedAsset(tex);
  return _cachedWallAtlasTex;
}

function getSharedFavelaBatchMaterials() {
  if (!_cachedWallAtlasMat) {
    _cachedWallAtlasMat = markAsSharedAsset(new THREE.MeshStandardMaterial({
      color: 0xffffff, map: createFavelaWallAtlasTexture(), vertexColors: true, roughness: 0.85, metalness: 0.03
    }));
  }
  if (!_cachedSolidVcMat) {
    _cachedSolidVcMat = markAsSharedAsset(new THREE.MeshStandardMaterial({
      color: 0xffffff, vertexColors: true, roughness: 0.78, metalness: 0.12
    }));
  }
  if (!_cachedBasicVcMat) {
    _cachedBasicVcMat = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }));
  }
  return { wallMat: _cachedWallAtlasMat, solidMat: _cachedSolidVcMat, basicMat: _cachedBasicVcMat };
}

const SOLID_COLOR_HEX = {
  retaining_concrete: 0x383e49, alley_cement: 0x3b4049, hill_bush: 0x1a2e1e, brick_groove: 0x3d180c,
  cement_raw: 0x565d69, cement_slab: 0x5c6472, zinc_roof: 0x56606e, rebar_iron: 0x262322,
  cv_red: 0x991b1b, cv_dark_red: 0x5c1414, cv_black: 0x0b0d12, cv_white: 0xa2aab6,
  favela_blue_faded: 0x2b5876, favela_yellow_faded: 0x9c6b21, water_tank_blue: 0x0f6082,
  water_tank_lid: 0x0a445e, window_dark: 0x0f141c, sandbag_tan: 0x78716c, wood_pole: 0x433b35,
  varzea_dirt: 0x543822, varzea_grass: 0x1a3822, fence_mesh: 0x4b5563, pool_water: 0x0e6b84
};

const BASIC_COLOR_HEX = { wire_black: 0x07090d, neon_red: 0xe11d48, neon_gold: 0xd99b16, neon_cyan: 0x06b6d4 };

function getZBand(z, bandsCount) {
  const minZ = ws(HILL_MIN_DESIGN_Z), maxZ = ws(HILL_MAX_DESIGN_Z);
  return Math.max(0, Math.min(bandsCount - 1, Math.floor(((z - minZ) / Math.max(1, maxZ - minZ)) * bandsCount)));
}

function buildChunkGeometryFromBoxes(boxes, cylinders, includeUvs, includeColors) {
  let totalVerts = boxes.length * 24, totalIdx = boxes.length * 36;
  for (let i = 0; i < cylinders.length; i++) {
    totalVerts += cylinders[i].pos.length / 3;
    totalIdx += cylinders[i].idx.length;
  }
  if (totalVerts === 0) return null;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const uvs = includeUvs ? new Float32Array(totalVerts * 2) : null;
  const colors = includeColors ? new Float32Array(totalVerts * 3) : null;
  const indices = new Uint32Array(totalIdx);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let vOff = 0, iOff = 0;
  const tmpCol = new THREE.Color();

  for (let b = 0; b < boxes.length; b++) {
    const { w, h, d, x, y, z, rotX, rotY, rotZ, hex, tileId } = boxes[b];
    const cosY = rotY ? Math.cos(rotY) : 1, sinY = rotY ? Math.sin(rotY) : 0;
    const cosX = rotX ? Math.cos(rotX) : 1, sinX = rotX ? Math.sin(rotX) : 0;
    const cosZ = rotZ ? Math.cos(rotZ) : 1, sinZ = rotZ ? Math.sin(rotZ) : 0;
    let cr = 1, cg = 1, cb = 1;
    if (includeColors) { tmpCol.setHex(hex); cr = tmpCol.r; cg = tmpCol.g; cb = tmpCol.b; }

    let u0 = 0, v0 = 0, du = 1, dv = 1;
    if (includeUvs && tileId >= 0) {
      const pad = 0.016;
      u0 = (tileId & 1) * 0.5 + pad; v0 = (tileId >> 1) * 0.5 + pad;
      du = 0.5 - pad * 2; dv = 0.5 - pad * 2;
    }

    const pBase = vOff * 3, uvBase = vOff * 2;
    for (let k = 0; k < 24; k++) {
      const k3 = k * 3;
      let px = _BOX_POS[k3] * w, py = _BOX_POS[k3 + 1] * h, pz = _BOX_POS[k3 + 2] * d;
      let nx = _BOX_NORM[k3], ny = _BOX_NORM[k3 + 1], nz = _BOX_NORM[k3 + 2];
      if (rotX) {
        const y1 = py * cosX - pz * sinX, z1 = py * sinX + pz * cosX; py = y1; pz = z1;
        const ny1 = ny * cosX - nz * sinX, nz1 = ny * sinX + nz * cosX; ny = ny1; nz = nz1;
      }
      if (rotZ) {
        const x2 = px * cosZ - py * sinZ, y2 = px * sinZ + py * cosZ; px = x2; py = y2;
        const nx2 = nx * cosZ - ny * sinZ, ny2 = nx * sinZ + ny * cosZ; nx = nx2; ny = ny2;
      }
      const wx = x + px * cosY + pz * sinY, wy = y + py, wz = z - px * sinY + pz * cosY;
      positions[pBase + k3] = wx; positions[pBase + k3 + 1] = wy; positions[pBase + k3 + 2] = wz;
      normals[pBase + k3] = nx * cosY + nz * sinY; normals[pBase + k3 + 1] = ny; normals[pBase + k3 + 2] = -nx * sinY + nz * cosY;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;

      if (uvs) {
        const k2 = k * 2, isCap = tileId >= 0 && k >= 8 && k < 16;
        uvs[uvBase + k2] = isCap ? 0.04 + _BOX_UV[k2] * 0.42 : u0 + _BOX_UV[k2] * du;
        uvs[uvBase + k2 + 1] = isCap ? 0.54 + _BOX_UV[k2 + 1] * 0.42 : v0 + _BOX_UV[k2 + 1] * dv;
      }
      if (colors) { colors[pBase + k3] = cr; colors[pBase + k3 + 1] = cg; colors[pBase + k3 + 2] = cb; }
    }
    for (let j = 0; j < 36; j++) indices[iOff + j] = _BOX_IDX[j] + vOff;
    vOff += 24; iOff += 36;
  }

  for (let c = 0; c < cylinders.length; c++) {
    const cyl = cylinders[c], cVerts = cyl.pos.length / 3;
    positions.set(cyl.pos, vOff * 3);
    normals.set(cyl.norm, vOff * 3);
    for (let k = 0; k < cyl.pos.length; k += 3) {
      const wx = cyl.pos[k], wy = cyl.pos[k + 1], wz = cyl.pos[k + 2];
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
    }
    if (colors) {
      tmpCol.setHex(cyl.hex);
      for (let k = 0; k < cVerts * 3; k += 3) {
        colors[vOff * 3 + k] = tmpCol.r; colors[vOff * 3 + k + 1] = tmpCol.g; colors[vOff * 3 + k + 2] = tmpCol.b;
      }
    }
    for (let j = 0; j < cyl.idx.length; j++) indices[iOff + j] = cyl.idx[j] + vOff;
    vOff += cVerts; iOff += cyl.idx.length;
  }

  const cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5, cz = (minZ + maxZ) * 0.5;
  for (let i = 0; i < positions.length; i += 3) { positions[i] -= cx; positions[i + 1] -= cy; positions[i + 2] -= cz; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (uvs) geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return { geo, cx, cy, cz };
}

export class FavelaBatcher {
  constructor() {
    this.materials = new Map();
    this.wallBands = Array.from({ length: 5 }, () => []);
    this.solidBands = Array.from({ length: 5 }, () => ({ boxes: [], cylinders: [] }));
    this.basicBands = Array.from({ length: 3 }, () => []);
    this.emissiveBuckets = new Map();
    for (const [key, color, emissive, emissiveIntensity] of [
      ['window_lit', 0x78350f, 0xf59e0b, 0.0],
      ['window_orange', 0x5c220e, 0xd97706, 0.0],
      ['window_tv_blue', 0x0a344f, 0x7dd3fc, 0.0],
      ['favela_bulb_warm', 0xfde68a, 0xf59e0b, 0.25],
      ['floodlight_panel', 0xe2e8f0, 0xbae6fd, 0.2]
    ]) {
      this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.05, emissive, emissiveIntensity }));
      this.emissiveBuckets.set(key, []);
    }
  }

  addWallBox(tileId, tintHex, w, h, d, x, y, z, rotY = 0) {
    this.wallBands[getZBand(z, 5)].push({ w, h, d, x, y, z, rotX: 0, rotY, rotZ: 0, hex: tintHex, tileId });
  }

  addSlopedBox(key, w, h, d, x, y, z, rotX = 0, rotZ = 0, rotY = 0, tintHex = null) {
    if (this.emissiveBuckets.has(key)) {
      this.emissiveBuckets.get(key).push({ w, h, d, x, y, z, rotX, rotY, rotZ, hex: 0xffffff, tileId: -1 });
      return;
    }
    if (BASIC_COLOR_HEX[key] !== undefined) {
      this.basicBands[getZBand(z, 3)].push({ w, h, d, x, y, z, rotX, rotY, rotZ, hex: tintHex ?? BASIC_COLOR_HEX[key], tileId: -1 });
      return;
    }
    if ((key === 'brick_baiano' || key === 'brick_baiano_light') && h >= 1.1 && !rotX && !rotZ) {
      this.addWallBox(0, key === 'brick_baiano_light' ? 0xffffff : 0xead8cc, w, h, d, x, y, z, rotY);
      return;
    }
    if (key === 'cement_raw' && h >= 1.1 && !rotX && !rotZ) {
      this.addWallBox(2, 0x767d88, w, h, d, x, y, z, rotY);
      return;
    }
    this.solidBands[getZBand(z, 5)].boxes.push({
      w, h, d, x, y, z, rotX, rotY, rotZ, hex: tintHex ?? SOLID_COLOR_HEX[key] ?? 0x4b5563, tileId: -1
    });
  }

  addBox(key, w, h, d, x, y, z, rotY = 0, tintHex = null) {
    this.addSlopedBox(key, w, h, d, x, y, z, 0, 0, rotY, tintHex);
  }

  addSegmentSlab(key, x1, y1, z1, x2, y2, z2, width, thickness, overlap = 0.35, tintHex = null) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, horiz = Math.hypot(dx, dz);
    if (horiz < 0.05) return;
    this.addSlopedBox(
      key, width, thickness, Math.hypot(horiz, dy) + overlap,
      (x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5,
      -Math.atan2(dy, horiz), 0, Math.atan2(dx, dz), tintHex
    );
  }

  addCylinder(key, rTop, rBot, h, x, y, z, segs = 10) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    g.translate(x, y, z);
    this.solidBands[getZBand(z, 5)].cylinders.push({
      pos: g.attributes.position.array, norm: g.attributes.normal.array, idx: g.index.array, hex: SOLID_COLOR_HEX[key] ?? 0x4b5563
    });
  }

  flush(scene) {
    const { wallMat, solidMat, basicMat } = getSharedFavelaBatchMaterials();
    const emitMesh = (built, mat, castShadow, receiveShadow) => {
      if (!built) return;
      const mesh = new THREE.Mesh(built.geo, mat);
      mesh.position.set(built.cx, built.cy, built.cz);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.userData.isFavelaMesh = true;
      mesh.userData.skipStaticMerge = true;
      scene.add(mesh);
    };
    for (let b = 0; b < 5; b++) { emitMesh(buildChunkGeometryFromBoxes(this.wallBands[b], [], true, true), wallMat, true, true); this.wallBands[b].length = 0; }
    for (let b = 0; b < 5; b++) {
      const sb = this.solidBands[b];
      emitMesh(buildChunkGeometryFromBoxes(sb.boxes, sb.cylinders, false, true), solidMat, true, true);
      sb.boxes.length = 0; sb.cylinders.length = 0;
    }
    for (let b = 0; b < 3; b++) { emitMesh(buildChunkGeometryFromBoxes(this.basicBands[b], [], false, true), basicMat, false, false); this.basicBands[b].length = 0; }
    for (const [key, list] of this.emissiveBuckets.entries()) {
      if (list.length > 0) { emitMesh(buildChunkGeometryFromBoxes(list, [], false, false), this.materials.get(key), false, false); list.length = 0; }
    }
  }
}

export function buildContinuousSmoothHillMesh(world) {
  const minX = ws(-1016), maxX = ws(-524), minZ = ws(HILL_MIN_DESIGN_Z), maxZ = ws(HILL_MAX_DESIGN_Z);
  const width = maxX - minX, centerX = (minX + maxX) * 0.5, bandSpanZ = (maxZ - minZ) / HILL_Z_BANDS;
  const segsX = IS_SCALED_WORLD ? 148 : 84, segsZPerBand = IS_SCALED_WORLD ? 112 : 64;
  const hillMat = markAsSharedAsset(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.03 }));
  const cStreetBorder = new THREE.Color(0x252a33), cAlleyConcrete = new THREE.Color(0x353941);
  const cPackedEarth = new THREE.Color(0x3d3832), cScrubCapim = new THREE.Color(0x1b2c1d), cWetGranite = new THREE.Color(0x2b3038);
  const tmpColor = new THREE.Color();
  const nEps = 2.5;

  for (let b = 0; b < HILL_Z_BANDS; b++) {
    const bandMidZ = minZ + (b + 0.5) * bandSpanZ;
    const geo = new THREE.PlaneGeometry(width, bandSpanZ, segsX, segsZPerBand);
    geo.rotateX(-Math.PI / 2);
    const posAttr = geo.attributes.position, normAttr = geo.attributes.normal;
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = centerX + posAttr.getX(i);
      let lz = posAttr.getZ(i), vz = bandMidZ + lz;
      if (IS_SCALED_WORLD && Math.abs(vz) > 12.0 && Math.abs(vz) < 22.0) {
        vz = Math.sign(vz) * 20.5; lz = vz - bandMidZ; posAttr.setZ(i, lz);
      }
      const vy = getFavelaElevation(vx, vz);
      if (vy <= 0.02) {
        posAttr.setY(i, -0.06);
        normAttr.setXYZ(i, 0, 1, 0);
        colors[i * 3] = cStreetBorder.r; colors[i * 3 + 1] = cStreetBorder.g; colors[i * 3 + 2] = cStreetBorder.b;
      } else {
        posAttr.setY(i, vy);
        const nx = getFavelaElevation(vx - nEps, vz) - getFavelaElevation(vx + nEps, vz);
        const ny = 2 * nEps;
        const nz = getFavelaElevation(vx, vz - nEps) - getFavelaElevation(vx, vz + nEps);
        const nLen = Math.hypot(nx, ny, nz) || 1;
        normAttr.setXYZ(i, nx / nLen, ny / nLen, nz / nLen);

        const slope = Math.hypot(nx, nz) / ny, ux = fromWs(vx), uz = fromWs(vz);
        const patchNoise = 0.5 + 0.5 * Math.sin(ux * 0.065 + Math.cos(uz * 0.048) * 1.9);
        const isOuterWest = ux < -930 || uz < -1450 || uz > 540;
        if (vy < 3.2) tmpColor.copy(cStreetBorder).lerp(cAlleyConcrete, vy / 3.2);
        else if (slope > 0.21 || (isOuterWest && patchNoise > 0.42)) tmpColor.copy(cScrubCapim).lerp(cWetGranite, THREE.MathUtils.clamp((slope - 0.16) * 3.2, 0.2, 0.78));
        else tmpColor.copy(cAlleyConcrete).lerp(cPackedEarth, patchNoise * 0.58);
        colors[i * 3] = tmpColor.r; colors[i * 3 + 1] = tmpColor.g; colors[i * 3 + 2] = tmpColor.b;
      }
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    normAttr.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const bandMesh = new THREE.Mesh(geo, hillMat);
    bandMesh.position.set(centerX, 0, bandMidZ);
    bandMesh.receiveShadow = true;
    bandMesh.castShadow = false;
    bandMesh.matrixAutoUpdate = false;
    bandMesh.updateMatrix();
    bandMesh.userData.isFavelaMesh = true;
    bandMesh.userData.isFavelaHillChunk = true;
    bandMesh.userData.skipStaticMerge = true;
    world.scene.add(bandMesh);
  }

  world.mapBlocks.push(
    { x: ws(-770), z: ws(-45), w: ws(468), d: ws(900), color: '#2b303a' },
    { x: ws(-835), z: ws(-907.5), w: ws(354), d: ws(825), color: '#262b34' },
    { x: ws(-835), z: ws(540), w: ws(354), d: ws(270), color: '#262b34' }
  );
}
