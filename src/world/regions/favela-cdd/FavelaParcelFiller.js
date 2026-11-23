import { ws, wsP } from '../../core/WorldLayoutScale.js';
import { createObb2D, localToWorldXZ, obbIntersectsObb2D, obbIntersectsRect2D } from '../../buildings/LotGeometry2D.js';
import { getFavelaEastBorderX, getFavelaElevation } from './FavelaElevationAndBatcher.js';
import {
  buildFavelaOrganicCirculation,
  evalContourRibbonDxDz,
  evalContourRibbonX
} from './FavelaContoursAndAlleys.js';
import { buildAuthenticFavelaParcel } from './FavelaHouseModules.js';

const PARCEL_GRID_CELL = 24;

function packGridKey(gx, gz) {
  return ((gx & 0xffff) << 16) | (gz & 0xffff);
}

function createSpatialObbIndex() {
  const map = new Map();
  let qid = 0;

  return {
    items: [],
    insert(obb) {
      obb._qid = 0;
      this.items.push(obb);
      const gx0 = Math.floor(obb.minX / PARCEL_GRID_CELL), gx1 = Math.floor(obb.maxX / PARCEL_GRID_CELL);
      const gz0 = Math.floor(obb.minZ / PARCEL_GRID_CELL), gz1 = Math.floor(obb.maxZ / PARCEL_GRID_CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const k = packGridKey(gx, gz);
          let list = map.get(k);
          if (!list) map.set(k, (list = []));
          list.push(obb);
        }
      }
    },
    overlapsAny(obb, extraGap = -0.35) {
      const curQ = ++qid;
      const gx0 = Math.floor((obb.minX - 1) / PARCEL_GRID_CELL), gx1 = Math.floor((obb.maxX + 1) / PARCEL_GRID_CELL);
      const gz0 = Math.floor((obb.minZ - 1) / PARCEL_GRID_CELL), gz1 = Math.floor((obb.maxZ + 1) / PARCEL_GRID_CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const list = map.get(packGridKey(gx, gz));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const other = list[i];
            if (other._qid === curQ) continue;
            other._qid = curQ;
            if (obbIntersectsObb2D(obb, other, extraGap)) return true;
          }
        }
      }
      return false;
    },
    hasObbInCell(cx, cz, halfCell) {
      const gx0 = Math.floor((cx - halfCell) / PARCEL_GRID_CELL), gx1 = Math.floor((cx + halfCell) / PARCEL_GRID_CELL);
      const gz0 = Math.floor((cz - halfCell) / PARCEL_GRID_CELL), gz1 = Math.floor((cz + halfCell) / PARCEL_GRID_CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const list = map.get(packGridKey(gx, gz));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (o.maxX >= cx - halfCell && o.minX <= cx + halfCell && o.maxZ >= cz - halfCell && o.minZ <= cz + halfCell) {
              return true;
            }
          }
        }
      }
      return false;
    }
  };
}

function hash01(seed) {
  let h = (seed * 747796405 + 2891336453) | 0;
  h = ((h >>> ((h >>> 28) + 4)) ^ h) * 277803737;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function computeOrganicContourRotY(dxDz, seed) {
  const len = Math.hypot(dxDz, 1.0);
  let rotY = -Math.atan2(1.0 / len, dxDz / len);
  const jitterSign = (seed & 1) === 0 ? 1 : -1;
  rotY += jitterSign * (0.042 + hash01(seed + 11) * 0.052);
  if (Math.abs(Math.sin(2 * rotY)) < 0.19) rotY += jitterSign * 0.15;
  return rotY;
}

function isPointInValidHillside(px, pz) {
  if (Math.abs(pz) < 41) return false;
  const xEast = getFavelaEastBorderX(pz);
  if (px > xEast - 15.5 || px < ws(-988)) return false;
  return getFavelaElevation(px, pz) >= 0.56;
}

function isPointInMajorRect(px, pz, rects) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (px >= r.minX && px <= r.maxX && pz >= r.minZ && pz <= r.maxZ) return true;
  }
  return false;
}

function isObbEndpointsOnHillside(cx, cz, spanW, rotY) {
  if (!isPointInValidHillside(cx, cz)) return false;
  const cosY = Math.cos(rotY), sinY = Math.sin(rotY), hw = spanW * 0.46;
  const e1 = localToWorldXZ(cx, cz, -hw, 0, cosY, sinY);
  const e2 = localToWorldXZ(cx, cz, hw, 0, cosY, sinY);
  return isPointInValidHillside(e1.x, e1.z) && isPointInValidHillside(e2.x, e2.z);
}

function interleaveRibbonsSymmetric(ribbons) {
  const coreN = ribbons.filter((r) => r.isCore && r.halfTag === 'N');
  const coreS = ribbons.filter((r) => r.isCore && r.halfTag === 'S');
  const outerN = ribbons.filter((r) => !r.isCore && r.halfTag === 'FN');
  const outerS = ribbons.filter((r) => !r.isCore && r.halfTag === 'FS');
  const ordered = [];
  // Passo 0: fitas pares Leste->Cume; Passo 1: fitas ímpares Leste->Cume (100% da encosta coberta!)
  for (const parity of [0, 1]) {
    for (let i = parity, n = Math.max(coreN.length, coreS.length); i < n; i += 2) {
      if (i < coreN.length) ordered.push(coreN[i]);
      if (i < coreS.length) ordered.push(coreS[i]);
    }
  }
  for (const parity of [0, 1]) {
    for (let i = parity, n = Math.max(outerN.length, outerS.length); i < n; i += 2) {
      if (i < outerN.length) ordered.push(outerN[i]);
      if (i < outerS.length) ordered.push(outerS[i]);
    }
  }
  return ordered;
}

function makeSubClusterUnits(unitCount, baseD, seedBase, isCorner) {
  const units = [];
  const seam = unitCount > 1 ? 0.2 : 0;
  let spanW = 0;
  let hasBirosca = false;
  for (let u = 0; u < unitCount; u++) {
    const us = seedBase + u * 29;
    const uw = 6.5 + hash01(us * 3) * 2.3; // 6.5 .. 8.8 m (median ~7.65 m <= 8.5 m)
    const fRoll = hash01(us * 23);
    const floors = fRoll < 0.2 ? 1 : fRoll < 0.6 ? 2 : fRoll < 0.88 ? 3 : 4;
    const zShift = unitCount > 1 ? (hash01(us * 13) - 0.5) * 0.52 : 0;
    const isBirosca = isCorner && u === 0 && us % 9 === 0;
    if (isBirosca) hasBirosca = true;
    units.push({ w: uw, d: baseD, floors, zShift, spotKind: isBirosca ? 'birosca' : 'house' });
    spanW += uw - (u > 0 ? seam : 0);
  }
  return { units, spanW, hasBirosca };
}

/**
 * Preenche TODA a encosta 3x da Favela Cidade de Deus com tecido contínuo parede-com-parede:
 *   - Cada parcela avança até 4 meios-blocos tangentes (~22m cada = 6 casas coladas + travessa de 2.4m +
 *     6 casas coladas + travessa de 2.5m), cobrindo 85%+ da encosta inteira dentro de ~3.100 parcelas!
 */
export function buildOrganicFavelaParcelFabric(world, batcher) {
  const network = buildFavelaOrganicCirculation(world, batcher);
  const obbIndex = createSpatialObbIndex();
  const favelaGroundRoads = (world?.mapRoads || []).filter(
    (rd) => !rd.isElevated && !rd.isBridge && rd.x - rd.w * 0.5 <= ws(-490)
  );

  const isClearOfGroundRoads = (obb, anchorW = obb.w) => {
    const uMinX = obb.cx - anchorW * 0.5 - 2.2, uMaxX = obb.cx + anchorW * 0.5 + 2.2;
    const uMinZ = obb.cz - obb.d * 0.5 - 2.2, uMaxZ = obb.cz + obb.d * 0.5 + 2.2;
    for (let i = 0; i < favelaGroundRoads.length; i++) {
      const rd = favelaGroundRoads[i];
      const rMinX = rd.x - rd.w * 0.5, rMaxX = rd.x + rd.w * 0.5;
      const rMinZ = rd.z - rd.d * 0.5, rMaxZ = rd.z + rd.d * 0.5;
      if (uMaxX > rMinX && uMinX < rMaxX && uMaxZ > rMinZ && uMinZ < rMaxZ) return false;
      if (
        obb.maxX + 2.2 > rMinX && obb.minX - 2.2 < rMaxX &&
        obb.maxZ + 2.2 > rMinZ && obb.minZ - 2.2 < rMaxZ &&
        obbIntersectsRect2D(obb, rMinX, rMaxX, rMinZ, rMaxZ, 2.2)
      ) {
        return false;
      }
    }
    return true;
  };

  let seed = 101;
  const communityAnchors = [
    { ...wsP(-544, -102), w: 6.8, d: 7.2, floors: 1, rotY: -1.18, spotKind: 'mototaxi' },
    { ...wsP(-638, 122), w: 7.4, d: 8.8, floors: 1, rotY: -1.24, spotKind: 'chapel' },
    { ...wsP(-748, -286), w: 7.2, d: 8.6, floors: 1, rotY: -1.31, spotKind: 'chapel' }
  ];

  for (let i = 0; i < communityAnchors.length; i++) {
    const sp = communityAnchors[i];
    if (!isPointInValidHillside(sp.x, sp.z)) continue;
    const obb = createObb2D(sp.x, sp.z, sp.w, sp.d, sp.rotY, 0);
    if (!isClearOfGroundRoads(obb) || !network.isObbClearForParcel(obb, -999) || obbIndex.overlapsAny(obb, 0.1)) continue;
    buildAuthenticFavelaParcel(world, batcher, {
      cx: sp.x, cz: sp.z, w: sp.w, d: sp.d, floors: sp.floors,
      rotY: sp.rotY, seed: ++seed, alleySign: 1, spotKind: sp.spotKind, rearTerraceD: 0.8
    });
    obbIndex.insert(obb);
    world.favelaCDDData.clustersCount++;
  }

  const MAX_TOTAL_HOUSES = 3190;
  const CORE_MAX_HOUSES = 2760;
  let biroscaCount = 0;

  const orderedRibbons = interleaveRibbonsSymmetric(network.contourRibbons);

  const tryPlaceSubBlock = (ribbon, side, startZ, baseD, rearTerraceD, isCorner, withTravessaEnd, registerParcel) => {
    for (const unitCount of [3, 1]) {
      const cand = makeSubClusterUnits(unitCount, baseD, seed, isCorner);
      const dxDz0 = evalContourRibbonDxDz(ribbon.xRef, startZ);
      const dsDz0 = Math.hypot(dxDz0, 1.0);
      const midZ = startZ + (cand.spanW * 0.5) / dsDz0;
      if (midZ > ribbon.zMax - 3.5) continue;

      const dxDz = evalContourRibbonDxDz(ribbon.xRef, midZ);
      const dsDz = Math.hypot(dxDz, 1.0);
      const becoX = evalContourRibbonX(ribbon.xRef, midZ);
      const nx = (1.0 / dsDz) * side, nz = (-dxDz / dsDz) * side;

      const offsetFromBeco = ribbon.becoW * 0.5 + baseD * 0.5 + 0.18;
      const cx = becoX + nx * offsetFromBeco, cz = midZ + nz * offsetFromBeco;
      const rotY = computeOrganicContourRotY(dxDz, seed);

      if (!isObbEndpointsOnHillside(cx, cz, cand.spanW, rotY)) continue;
      const obb = createObb2D(cx, cz, cand.spanW, baseD, rotY, 0);
      if (!isClearOfGroundRoads(obb, cand.units[0].w)) continue;
      if (!network.isObbClearForParcel(obb, ribbon.id)) continue;
      if (obbIndex.overlapsAny(obb, -0.42)) continue;

      const res = buildAuthenticFavelaParcel(world, batcher, {
        cx, cz, w: cand.units[0].w, d: baseD, rotY, seed, alleySign: -side,
        subUnits: cand.units, rearTerraceD,
        travessaSlabW: withTravessaEnd && unitCount >= 2 ? 2.4 : 0,
        registerParcel
      });
      obbIndex.insert(obb);
      if (cand.hasBirosca) biroscaCount++;

      if (side === 1 && registerParcel && seed % 3 === 0) {
        const acrossX = becoX - nx * (ribbon.becoW * 0.5 + 1.6);
        const acrossZ = midZ - nz * (ribbon.becoW * 0.5 + 1.6);
        const acrossY = getFavelaElevation(acrossX, acrossZ) + 5.5;
        batcher.addSegmentSlab('wire_black', cx, res.yBase + 5.7, cz, acrossX, acrossY, acrossZ, 0.05, 0.05, 0.08, null, 'l0');
      }
      return { placedSpanW: cand.spanW, dsDz, unitCount };
    }
    return null;
  };

  for (let rIdx = 0; rIdx < orderedRibbons.length; rIdx++) {
    const ribbon = orderedRibbons[rIdx];
    const isCore = ribbon.isCore;
    const cap = isCore ? CORE_MAX_HOUSES : MAX_TOTAL_HOUSES;
    if (world.favelaCDDData.housesCount >= cap) continue;

    for (const side of [-1, 1]) {
      if (world.favelaCDDData.housesCount >= cap) break;
      if (!isCore && side === -1 && rIdx % 3 === 2) continue;

      let curZ = ribbon.zMin + (side > 0 ? 2.5 : 8.5);

      while (curZ < ribbon.zMax - 5.0 && world.favelaCDDData.housesCount < cap) {
        seed++;
        const probeX = evalContourRibbonX(ribbon.xRef, curZ);
        const dxDz = evalContourRibbonDxDz(ribbon.xRef, curZ);
        const dsDz = Math.hypot(dxDz, 1.0);
        const estCx = probeX + (side * 6.0) / dsDz;
        if (!isPointInValidHillside(estCx, curZ) || isPointInMajorRect(estCx, curZ, network.keepouts.rects)) {
          curZ += 14.0 / dsDz;
          continue;
        }

        const perpPitch = (ribbon.pitch || 21.2) / dsDz;
        const availHalf = perpPitch * 0.5 - ribbon.becoW * 0.5 - 0.22;
        const baseD = Math.min(9.6, Math.max(6.2, availHalf - hash01(seed * 7) * 0.25));
        const rearTerraceD = Math.max(0.75, Math.min(2.2, availHalf - baseD + 0.95));

        const s0 = tryPlaceSubBlock(ribbon, side, curZ, baseD, rearTerraceD, true, false, true);
        if (!s0) {
          curZ += (isCore ? 5.2 : 10.0) / dsDz;
          continue;
        }

        world.favelaCDDData.clustersCount++;
        curZ += (s0.placedSpanW - 0.14) / s0.dsDz;

        // Encadeia até mais 4 meios-blocos tangentes (atravessando escadões/ladeiras sem desperdiçar cota!)
        const maxChain = isCore ? 4 : 3;
        let placedExtra = 0, skips = 0;
        while (placedExtra < maxChain && skips <= 3 && curZ < ribbon.zMax - 8.0) {
          seed++;
          const isTravessaBreak = placedExtra % 2 === 0;
          const sb = tryPlaceSubBlock(ribbon, side, curZ, baseD, rearTerraceD, !isTravessaBreak, isTravessaBreak, false);
          if (!sb) {
            skips++;
            curZ += 6.2 / dsDz;
            continue;
          }
          placedExtra++;
          const gapAfter = isTravessaBreak ? 2.4 + (seed % 3) * 0.2 : -0.14;
          curZ += (sb.placedSpanW + gapAfter) / sb.dsDz;
        }
      }
    }
  }

  world.favelaCDDData.biroscasCount = biroscaCount;
  world.favelaCDDData.chapelsCount = 2;
  world.favelaCDDData.hasMototaxiPoint = true;
  world.favelaCDDData.circulation = network;
  world.favelaCDDData.parcelIndex = obbIndex;
}
