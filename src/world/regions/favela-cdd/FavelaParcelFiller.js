import { ws, wsP } from '../../core/WorldLayoutScale.js';
import { createObb2D, obbIntersectsObb2D, obbIntersectsRect2D } from '../../buildings/LotGeometry2D.js';
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
      const gx0 = Math.floor(obb.minX / PARCEL_GRID_CELL);
      const gx1 = Math.floor(obb.maxX / PARCEL_GRID_CELL);
      const gz0 = Math.floor(obb.minZ / PARCEL_GRID_CELL);
      const gz1 = Math.floor(obb.maxZ / PARCEL_GRID_CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const k = packGridKey(gx, gz);
          let list = map.get(k);
          if (!list) map.set(k, (list = []));
          list.push(obb);
        }
      }
    },
    overlapsAny(obb, extraGap = -0.08) {
      const curQ = ++qid;
      const gx0 = Math.floor((obb.minX - 1) / PARCEL_GRID_CELL);
      const gx1 = Math.floor((obb.maxX + 1) / PARCEL_GRID_CELL);
      const gz0 = Math.floor((obb.minZ - 1) / PARCEL_GRID_CELL);
      const gz1 = Math.floor((obb.maxZ + 1) / PARCEL_GRID_CELL);
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
      const gx0 = Math.floor((cx - halfCell) / PARCEL_GRID_CELL);
      const gx1 = Math.floor((cx + halfCell) / PARCEL_GRID_CELL);
      const gz0 = Math.floor((cz - halfCell) / PARCEL_GRID_CELL);
      const gz1 = Math.floor((cz + halfCell) / PARCEL_GRID_CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const list = map.get(packGridKey(gx, gz));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const o = list[i];
            if (
              o.maxX >= cx - halfCell &&
              o.minX <= cx + halfCell &&
              o.maxZ >= cz - halfCell &&
              o.minZ <= cz + halfCell
            ) {
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
  return ((h ^ (h >>> 22)) >>> 0) / 4294967296;
}

/**
 * Garante orientação orgânica seguindo a curva do beco + jitter local (`±4°..10°`),
 * evitando travamento artificial nos eixos cartesianos `0°` / `90°`.
 */
function computeOrganicContourRotY(dxDz, seed) {
  const len = Math.hypot(dxDz, 1.0);
  const tx = dxDz / len;
  const tz = 1.0 / len;
  let rotY = -Math.atan2(tz, tx);

  const jitterSign = (seed & 1) === 0 ? 1 : -1;
  const jitterMag = 0.075 + hash01(seed + 11) * 0.095;
  rotY += jitterSign * jitterMag;

  if (Math.abs(Math.sin(2 * rotY)) < 0.19) {
    rotY += jitterSign * 0.16;
  }
  return rotY;
}

function isParcelInValidHillside(cx, cz) {
  if (Math.abs(cz) < 40) return false;
  const xEast = getFavelaEastBorderX(cz);
  if (cx > xEast - 15.5 || cx < ws(-990)) return false;
  return getFavelaElevation(cx, cz) >= 0.58;
}

/**
 * Preenche toda a encosta 3x da Favela Cidade de Deus com tecido contínuo orgânico:
 *   - ~1,800 a 2,350 lotes pequenos (`w = 4.5..7.4m`, `d = 5.2..8.9m`, `1..4` andares)
 *   - Orientados ao longo dos becos em curva de nível (`< 10%` perto de `0°/90°`)
 *   - Muros de quintal e puxadinhos conectando vizinhos + biroscas + igrejinhas + ponto de mototáxi
 *   - Fios "gatos" aéreos cruzando sobre os becos estreitos entre sobrados opostos
 */
export function buildOrganicFavelaParcelFabric(world, batcher) {
  const network = buildFavelaOrganicCirculation(world, batcher);
  const obbIndex = createSpatialObbIndex();
  const favelaGroundRoads = (world?.mapRoads || []).filter(
    (rd) => !rd.isElevated && !rd.isBridge && rd.x - rd.w * 0.5 <= ws(-490)
  );
  const isClearOfGroundRoads = (obb) => {
    const uMinX = obb.cx - obb.w * 0.5 - 2.5;
    const uMaxX = obb.cx + obb.w * 0.5 + 2.5;
    const uMinZ = obb.cz - obb.d * 0.5 - 2.5;
    const uMaxZ = obb.cz + obb.d * 0.5 + 2.5;
    for (let i = 0; i < favelaGroundRoads.length; i++) {
      const rd = favelaGroundRoads[i];
      const rMinX = rd.x - rd.w * 0.5;
      const rMaxX = rd.x + rd.w * 0.5;
      const rMinZ = rd.z - rd.d * 0.5;
      const rMaxZ = rd.z + rd.d * 0.5;
      if (uMaxX > rMinX && uMinX < rMaxX && uMaxZ > rMinZ && uMinZ < rMaxZ) return false;
      if (
        obb.maxX + 2.5 > rMinX && obb.minX - 2.5 < rMaxX &&
        obb.maxZ + 2.5 > rMinZ && obb.minZ - 2.5 < rMaxZ &&
        obbIntersectsRect2D(obb, rMinX, rMaxX, rMinZ, rMaxZ, 2.5)
      ) {
        return false;
      }
    }
    return true;
  };
  let seed = 101;

  // 1. Pontos Comunitários Especiais: Ponto de Mototáxi na Boca Principal & 2 Igrejinhas no Morro
  const communityAnchors = [
    { ...wsP(-544, -102), w: 6.4, d: 6.2, floors: 1, rotY: -1.18, spotKind: 'mototaxi' },
    { ...wsP(-638, 122), w: 7.2, d: 8.6, floors: 1, rotY: -1.24, spotKind: 'chapel' },
    { ...wsP(-748, -286), w: 7.0, d: 8.4, floors: 1, rotY: -1.31, spotKind: 'chapel' }
  ];

  for (let i = 0; i < communityAnchors.length; i++) {
    const sp = communityAnchors[i];
    if (!isParcelInValidHillside(sp.x, sp.z)) continue;
    const obb = createObb2D(sp.x, sp.z, sp.w, sp.d, sp.rotY, 0);
    if (!isClearOfGroundRoads(obb) || !network.isObbClearForParcel(obb, -999) || obbIndex.overlapsAny(obb, 0.2)) continue;
    buildAuthenticFavelaParcel(world, batcher, {
      cx: sp.x,
      cz: sp.z,
      w: sp.w,
      d: sp.d,
      floors: sp.floors,
      rotY: sp.rotY,
      seed: ++seed,
      alleySign: 1,
      spotKind: sp.spotKind,
      yardSideW: 0
    });
    obbIndex.insert(obb);
    world.favelaCDDData.clustersCount++;
  }

  // 2. Loteamento Contínuo Seguindo Cada Fita de Curva de Nível (Core CDD denso + Extensões Norte/Sul)
  const MAX_TOTAL_HOUSES = 2340;
  let biroscaCount = 0;

  // Ordena fitas priorizando o Core CDD primeiro para garantir cobertura > 80% no coração do morro
  const sortedRibbons = [...network.contourRibbons].sort((a, b) => (b.isCore ? 1 : 0) - (a.isCore ? 1 : 0));

  for (let rIdx = 0; rIdx < sortedRibbons.length; rIdx++) {
    if (world.favelaCDDData.housesCount >= MAX_TOTAL_HOUSES) break;
    const ribbon = sortedRibbons[rIdx];
    const isCore = ribbon.isCore;

    for (const side of [-1, 1]) {
      if (world.favelaCDDData.housesCount >= MAX_TOTAL_HOUSES) break;
      // Nas extensões distantes Norte/Sul (fora do Core), alterna lados para manter orçamento total <= 2,340
      if (!isCore && side === -1 && rIdx % 2 === 1) continue;

      let curZ = ribbon.zMin + (side > 0 ? 4.0 : 14.0);
      let rowInCluster = 0;

      while (curZ < ribbon.zMax - 6.0 && world.favelaCDDData.housesCount < MAX_TOTAL_HOUSES) {
        seed++;
        const dxDz = evalContourRibbonDxDz(ribbon.xRef, curZ);
        const dsDz = Math.hypot(dxDz, 1.0);
        const centerBecoX = evalContourRibbonX(ribbon.xRef, curZ);

        // Norma unitária perpendicular ao beco apontando para `side`
        const nx = (1.0 / dsDz) * side;
        const nz = (-dxDz / dsDz) * side;

        const w = 4.6 + hash01(seed * 3) * 2.7; // 4.6 .. 7.3 m
        const d = 5.4 + hash01(seed * 7) * 3.4; // 5.4 .. 8.8 m
        const yardSideW = isCore ? 4.2 + hash01(seed * 11) * 2.6 : 3.2;

        const offsetFromBeco = ribbon.becoW * 0.5 + d * 0.5 + 0.36;
        const cx = centerBecoX + nx * offsetFromBeco;
        const cz = curZ + nz * offsetFromBeco;

        if (!isParcelInValidHillside(cx, cz)) {
          curZ += (isCore ? 16.0 : 28.0) / dsDz;
          rowInCluster = 0;
          continue;
        }

        const rotY = computeOrganicContourRotY(dxDz, seed);
        const totalSpanW = w + yardSideW;
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const obbCx = cx + yardSideW * 0.5 * cosY;
        const obbCz = cz - yardSideW * 0.5 * sinY;
        const obb = createObb2D(obbCx, obbCz, totalSpanW, d, rotY, 0);

        if (!isClearOfGroundRoads(obb) || !network.isObbClearForParcel(obb, ribbon.id) || obbIndex.overlapsAny(obb, -0.12)) {
          // Tenta sem extensão de quintal em quinas apertadas de escadão/ladeira
          const slimObb = createObb2D(cx, cz, w, d, rotY, 0);
          if (!isClearOfGroundRoads(slimObb) || !network.isObbClearForParcel(slimObb, ribbon.id) || obbIndex.overlapsAny(slimObb, -0.12)) {
            curZ += (isCore ? 9.5 : 22.0) / dsDz;
            rowInCluster = 0;
            continue;
          }
          const floorsSlim = 1 + (Math.floor(hash01(seed * 19) * 10) % 4);
          const isCornerBirosca = rowInCluster === 0 && seed % 7 === 0;
          if (isCornerBirosca) biroscaCount++;

          buildAuthenticFavelaParcel(world, batcher, {
            cx,
            cz,
            w,
            d,
            floors: floorsSlim,
            rotY,
            seed,
            alleySign: -side,
            spotKind: isCornerBirosca ? 'birosca' : 'house',
            yardSideW: 0
          });
          obbIndex.insert(slimObb);
          world.favelaCDDData.clustersCount++;
          curZ += (w + (isCore ? 5.2 : 18.0)) / dsDz;
          rowInCluster = 1;
          continue;
        }

        const fRoll = hash01(seed * 23);
        const floors = fRoll < 0.22 ? 1 : fRoll < 0.64 ? 2 : fRoll < 0.9 ? 3 : 4;
        const spotKind = rowInCluster === 0 && seed % 11 === 0 ? 'birosca' : 'house';
        if (spotKind === 'birosca') biroscaCount++;

        const res = buildAuthenticFavelaParcel(world, batcher, {
          cx,
          cz,
          w,
          d,
          floors,
          rotY,
          seed,
          alleySign: -side,
          spotKind,
          yardSideW
        });
        obbIndex.insert(obb);

        if (rowInCluster === 0) {
          world.favelaCDDData.clustersCount++;
        }
        rowInCluster = (rowInCluster + 1) % 3;

        // Fio "gato" aéreo cruzando o beco estreito a partir do sobrado
        if (side === 1 && floors >= 2 && seed % 5 === 0) {
          const acrossX = centerBecoX - nx * (ribbon.becoW * 0.5 + 1.8);
          const acrossZ = curZ - nz * (ribbon.becoW * 0.5 + 1.8);
          const acrossY = getFavelaElevation(acrossX, acrossZ) + 5.6;
          batcher.addSegmentSlab('wire_black', cx, res.yBase + 5.8, cz, acrossX, acrossY, acrossZ, 0.06, 0.06, 0.1);
        }

        // Passo orgânico ao longo do arco: a cada 3 lotes deixa uma travessa estreita de 2.8m
        const travessaGap = rowInCluster === 0 ? 3.2 : 0.65;
        const extraStride = isCore ? 18.5 : 38.0;
        curZ += (totalSpanW + travessaGap + extraStride) / dsDz;
      }
    }
  }

  world.favelaCDDData.biroscasCount = biroscaCount;
  world.favelaCDDData.chapelsCount = 2;
  world.favelaCDDData.hasMototaxiPoint = true;
  world.favelaCDDData.circulation = network;
  world.favelaCDDData.parcelIndex = obbIndex;
}
