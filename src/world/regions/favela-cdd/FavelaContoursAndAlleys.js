import { getHighwayDistanceAt } from '../../CoastlineProfile.js';
import { TERRITORY_ZONES } from '../../factions/TerritoryZonesAndConfigs.js';
import { ws, wsP } from '../../core/WorldLayoutScale.js';
import {
  obbClearOfCircle2D,
  obbClearOfSegment2D,
  obbIntersectsRect2D,
  pointToSegmentDistSq2D
} from '../../buildings/LotGeometry2D.js';
import { getFavelaEastBorderX, getFavelaElevation } from './FavelaElevationAndBatcher.js';

const SEG_CELL_SIZE = 48;

function packCell(gx, gz) {
  return ((gx & 0xffff) << 16) | (gz & 0xffff);
}

function indexSegment(grid, seg) {
  const pad = seg.clearance + 2;
  const gx0 = Math.floor((Math.min(seg.x1, seg.x2) - pad) / SEG_CELL_SIZE);
  const gx1 = Math.floor((Math.max(seg.x1, seg.x2) + pad) / SEG_CELL_SIZE);
  const gz0 = Math.floor((Math.min(seg.z1, seg.z2) - pad) / SEG_CELL_SIZE);
  const gz1 = Math.floor((Math.max(seg.z1, seg.z2) + pad) / SEG_CELL_SIZE);
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gz = gz0; gz <= gz1; gz++) {
      const k = packCell(gx, gz);
      let list = grid.get(k);
      if (!list) grid.set(k, (list = []));
      list.push(seg);
    }
  }
}

/**
 * Curva de nível suave e orgânica (|dx/dz| <= 0.82) para manter espaçamento perpendicular
 * uniforme (~19–22 m) entre fitas vizinhas sem esmagar nem abrir faixas cinzas vazias.
 */
export function evalContourRibbonX(xRef, z) {
  return (
    xRef +
    28.0 * Math.sin(0.0145 * z + xRef * 0.0009) +
    13.5 * Math.sin(0.031 * z - xRef * 0.0013 + 1.15)
  );
}

export function evalContourRibbonDxDz(xRef, z) {
  return (
    28.0 * 0.0145 * Math.cos(0.0145 * z + xRef * 0.0009) +
    13.5 * 0.031 * Math.cos(0.031 * z - xRef * 0.0013 + 1.15)
  );
}

function sampleCatmullPolyline(ctrlPts, stepLen = 24) {
  const out = [];
  for (let i = 0; i < ctrlPts.length - 1; i++) {
    const p0 = ctrlPts[Math.max(0, i - 1)], p1 = ctrlPts[i];
    const p2 = ctrlPts[i + 1], p3 = ctrlPts[Math.min(ctrlPts.length - 1, i + 2)];
    const steps = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / stepLen));
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const z = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([Math.round(x * 10) / 10, Math.round(z * 10) / 10]);
    }
  }
  return out;
}

function createFavelaKeepouts() {
  const soccer = wsP(-605, 195), baile = wsP(-715, -135), summit = wsP(-865, -240);
  const rects = [
    { id: 'express_canyon', minX: ws(-1020), maxX: ws(-510), minZ: -39, maxZ: 39, isLandmark: false },
    { id: 'cdd_soccer', minX: soccer.x - 35, maxX: soccer.x + 33, minZ: soccer.z - 43, maxZ: soccer.z + 43, isLandmark: true },
    { id: 'cdd_baile', minX: baile.x - 33, maxX: ws(-702) + 17, minZ: baile.z - 37, maxZ: baile.z + 37, isLandmark: true },
    { id: 'cdd_summit', minX: summit.x - 33, maxX: summit.x + 33, minZ: summit.z - 63, maxZ: summit.z + 39, isLandmark: true }
  ];
  const circles = [];
  for (const b of [
    wsP(-524, -382), wsP(-524, -250), wsP(-524, -117), wsP(-524, 36),
    wsP(-524, 134), wsP(-524, 380), wsP(-654, -640), wsP(-654, 540)
  ]) {
    circles.push({ x: b.x, z: b.z, r: 16.0, isLandmark: true });
  }
  const cvZone = TERRITORY_ZONES?.cv;
  if (cvZone) {
    for (const g of cvZone.gates || []) circles.push({ x: g.x, z: g.z, r: 18.5, isLandmark: true });
    for (const gar of cvZone.garages || []) {
      rects.push({ id: gar.id, minX: gar.x - 14.0, maxX: gar.x + 14.0, minZ: gar.z - 11.0, maxZ: gar.z + 11.0, isLandmark: true });
    }
    for (const op of cvZone.outposts || []) circles.push({ x: op.x, z: op.z, r: 11.2, isLandmark: true });
    if (cvZone.bossCourtyard) circles.push({ x: cvZone.bossCourtyard.x, z: cvZone.bossCourtyard.z, r: 12.5, isLandmark: true });
    if (cvZone.alliedBossSpawn) circles.push({ x: cvZone.alliedBossSpawn.x, z: cvZone.alliedBossSpawn.z, r: 10.0, isLandmark: true });
  }
  return { rects, circles };
}

function isPointInsideMajorKeepout(px, pz, keepouts, margin = 0) {
  for (let i = 0; i < keepouts.rects.length; i++) {
    const r = keepouts.rects[i];
    if (px >= r.minX - margin && px <= r.maxX + margin && pz >= r.minZ - margin && pz <= r.maxZ + margin) return true;
  }
  return false;
}

function addUtilityPoleAndGatoWires(world, batcher, px, py, pz, roadAngle, halfSpan, seed) {
  const side = seed % 2 === 0 ? 1 : -1;
  const nx = Math.cos(roadAngle) * side, nz = -Math.sin(roadAngle) * side;
  const poleX = px + nx * (halfSpan + 0.42), poleZ = pz + nz * (halfSpan + 0.42);
  const poleY = getFavelaElevation(poleX, poleZ);
  if (poleY < 0.35 || Math.abs(poleZ) < 36) return;

  const tiltX = ((seed % 5) - 2) * 0.022, tiltZ = (((seed * 3) % 5) - 2) * 0.022;
  batcher.addSlopedBox('retaining_concrete', 0.26, 6.3, 0.26, poleX, poleY + 2.95, poleZ, tiltX, tiltZ, roadAngle, null, 'l0', true);
  batcher.addBox('rebar_iron', 0.9, 0.13, 0.13, poleX, poleY + 5.8, poleZ, roadAngle, null, 'l0');

  const bulbX = px + nx * (halfSpan - 0.6), bulbZ = pz + nz * (halfSpan - 0.6);
  batcher.addBox('favela_bulb_warm', 0.34, 0.24, 0.34, bulbX, poleY + 5.42, bulbZ);

  const oppX = px - nx * (halfSpan + 1.5), oppZ = pz - nz * (halfSpan + 1.5);
  batcher.addSegmentSlab('wire_black', poleX, poleY + 5.78, poleZ, oppX, poleY + 5.42, oppZ, 0.06, 0.06, 0.08, null, 'l0');
  if (seed % 2 === 0) {
    batcher.addSegmentSlab('wire_black', poleX, poleY + 5.5, poleZ, oppX + nz * 4.0, poleY + 5.1, oppZ - nx * 4.0, 0.05, 0.05, 0.08, null, 'l0');
  }
  if (seed % 3 === 0) {
    world.nightLampRegistry?.push({ x: bulbX, y: poleY + 5.35, z: bulbZ, groundY: py + 0.1, warm: true, coneH: 5.2, coneR: 4.2 });
  }
}

export function buildFavelaOrganicCirculation(world, batcher) {
  const keepouts = createFavelaKeepouts();
  const segGrid = new Map();
  const allSegments = [], ladeiras = [], contourRibbons = [], escadoes = [];
  let qidCounter = 0;

  // 1. LADEIRAS SERPENTEANTES DIRIGÍVEIS (inclinação longitudinal <= 11%)
  const ladeiraSpecs = [
    {
      id: 'favela_ladeira_baile_summit',
      width: 7.4,
      ctrl: [
        [ws(-516), ws(-117)], [ws(-562), ws(-112)], [ws(-618), ws(-68)], [ws(-668), ws(-108)],
        [ws(-686), ws(-178)], [ws(-694), ws(-135)], [ws(-698), ws(-82)], [ws(-742), ws(-76)],
        [ws(-788), ws(-156)], [ws(-818), ws(-204)], [ws(-839), ws(-238)]
      ]
    },
    {
      id: 'favela_ladeira_north_p1',
      width: 7.0,
      ctrl: [
        [ws(-516), ws(-382)], [ws(-564), ws(-366)], [ws(-608), ws(-342)],
        [ws(-668), ws(-412)], [ws(-734), ws(-356)], [ws(-792), ws(-308)], [ws(-839), ws(-238)]
      ]
    },
    {
      id: 'favela_ladeira_south_campinho',
      width: 7.2,
      ctrl: [
        [ws(-516), ws(134)], [ws(-562), ws(140)], [ws(-606), ws(143)], [ws(-664), ws(208)],
        [ws(-732), ws(156)], [ws(-792), ws(234)], [ws(-742), ws(322)], [ws(-642), ws(356)],
        [ws(-564), ws(374)], [ws(-516), ws(380)]
      ]
    }
  ];

  if (!world.mapOrganicRoads) world.mapOrganicRoads = [];

  for (let li = 0; li < ladeiraSpecs.length; li++) {
    const spec = ladeiraSpecs[li];
    const pts = sampleCatmullPolyline(spec.ctrl, 24);
    let maxSlope = 0;

    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 1.0) continue;
      const y1 = getFavelaElevation(x1, z1), y2 = getFavelaElevation(x2, z2);
      const slope = Math.abs(y2 - y1) / len;
      if (slope > maxSlope) maxSlope = slope;

      const midX = (x1 + x2) * 0.5, midZ = (z1 + z2) * 0.5, midY = (y1 + y2) * 0.5;
      if (midY > 0.08 && !isPointInsideMajorKeepout(midX, midZ, keepouts, -2)) {
        batcher.addSegmentSlab('alley_cement', x1, y1 - 0.36, z1, x2, y2 - 0.36, z2, spec.width, 0.92, 0.7, null, 'both');
        const ang = Math.atan2(x2 - x1, z2 - z1), nx = Math.cos(ang), nz = -Math.sin(ang);
        const curbKey = (i + li) % 3 === 0 ? 'cv_red' : (i + li) % 3 === 1 ? 'cv_white' : 'retaining_concrete';
        for (const s of [-1, 1]) {
          const off = s * (spec.width * 0.5 - 0.22);
          batcher.addSegmentSlab(curbKey, x1 + nx * off, y1 + 0.09, z1 + nz * off, x2 + nx * off, y2 + 0.09, z2 + nz * off, 0.36, 0.22, 0.32, null, 'l0');
        }
        if (i % 3 === 1) addUtilityPoleAndGatoWires(world, batcher, midX, midY, midZ, ang, spec.width * 0.5, li * 97 + i);
      }

      const segRec = { kind: 'ladeira', ribbonId: -1, x1, z1, x2, z2, halfW: spec.width * 0.5, clearance: spec.width * 0.5 + 1.15, _qid: 0 };
      allSegments.push(segRec);
      indexSegment(segGrid, segRec);
    }

    ladeiras.push({ id: spec.id, width: spec.width, points: pts, maxSlope });
    world.mapOrganicRoads.push({ kind: 'polyline', id: spec.id, tier: 'local', district: 'favela_cdd', points: pts, width: spec.width, sidewalk: 1.4, isMain: false });
  }

  // 2. BECOS EM CURVA DE NÍVEL COMPACTOS (~21m no Core CDD = 2 fileiras fundo-com-fundo + beco de 2.8m, ZERO faixas cinzas!)
  const bandRanges = [
    { zMin: ws(-512), zMax: -43, pitch: 21.2, zStep: 18.0, minXRef: ws(-968), maxXRef: ws(-538), isCore: true, halfTag: 'N' },
    { zMin: 43, zMax: ws(414), pitch: 21.2, zStep: 18.0, minXRef: ws(-968), maxXRef: ws(-538), isCore: true, halfTag: 'S' },
    { zMin: ws(-1740), zMax: ws(-516), pitch: 26.5, zStep: 22.0, minXRef: ws(-960), maxXRef: ws(-668), isCore: false, halfTag: 'FN' },
    { zMin: ws(418), zMax: ws(650), pitch: 25.0, zStep: 20.0, minXRef: ws(-960), maxXRef: ws(-668), isCore: false, halfTag: 'FS' }
  ];

  let ribbonIdSeq = 0;
  for (let br = 0; br < bandRanges.length; br++) {
    const band = bandRanges[br];
    let localOrder = 0;
    for (let xRef = band.maxXRef; xRef >= band.minXRef; xRef -= band.pitch) {
      const rId = ++ribbonIdSeq;
      const becoW = 2.6 + (rId % 3) * 0.25;
      const samples = [];
      for (let z = band.zMin; z <= band.zMax; z += band.zStep) {
        const x = evalContourRibbonX(xRef, z);
        if (x > getFavelaEastBorderX(z) - 14 || x < ws(-998)) continue;
        if (z < ws(-1280) && getHighwayDistanceAt(x, z) < 28) continue;
        const y = getFavelaElevation(x, z);
        if (y >= 0.48) samples.push({ x, y, z });
      }
      if (samples.length < 2) continue;

      for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i], b = samples[i + 1];
        if (Math.abs(b.z - a.z) > band.zStep * 1.6) continue;
        const midX = (a.x + b.x) * 0.5, midZ = (a.z + b.z) * 0.5;
        if (isPointInsideMajorKeepout(midX, midZ, keepouts, 1.8)) continue;

        batcher.addSegmentSlab('alley_cement', a.x, a.y - 0.34, a.z, b.x, b.y - 0.34, b.z, becoW, 0.82, 0.55, null, 'both');
        if ((i + rId) % 11 === 0) {
          addUtilityPoleAndGatoWires(world, batcher, midX, (a.y + b.y) * 0.5, midZ, Math.atan2(b.x - a.x, b.z - a.z), becoW * 0.5, rId * 31 + i);
        }
        const segRec = { kind: 'beco', ribbonId: rId, x1: a.x, z1: a.z, x2: b.x, z2: b.z, halfW: becoW * 0.5, clearance: becoW * 0.5 + 0.2, _qid: 0 };
        allSegments.push(segRec);
        indexSegment(segGrid, segRec);
      }
      contourRibbons.push({
        id: rId, xRef, becoW, pitch: band.pitch, isCore: band.isCore, halfTag: band.halfTag,
        localOrder: localOrder++, zMin: band.zMin, zMax: band.zMax
      });
    }
  }

  // 3. ESCADÕES OBLÍQUOS COM DEGRAUS REAIS (L0), RAMPA ESTRUTURAL (L0+L1) E FIAÇÃO AÉREA
  const stairAnchorZs = [
    ws(-1560), ws(-1320), ws(-1080), ws(-860), ws(-660),
    ws(-465), ws(-395), ws(-315), ws(-235), ws(-175), ws(-95), ws(-48),
    ws(54), ws(112), ws(178), ws(248), ws(315), ws(372), ws(468), ws(565)
  ];

  for (let si = 0; si < stairAnchorZs.length; si++) {
    const zBase = stairAnchorZs[si];
    const xEast = getFavelaEastBorderX(zBase) - 16, xTop = si >= 5 && si <= 17 ? ws(-955) : ws(-905);
    const stairW = 2.6 + (si % 2) * 0.4, stepLen = 14.0;
    const stepsCount = Math.floor((xEast - xTop) / stepLen);
    if (stepsCount < 4) continue;
    const driftDir = si % 2 === 0 ? 1 : -1;
    let builtSegs = 0;

    for (let k = 0; k < stepsCount; k++) {
      const x1 = xEast - k * stepLen, x2 = x1 - stepLen;
      const z1 = zBase + driftDir * k * 3.8 + Math.sin(k * 0.45 + si) * 4.5;
      const z2 = zBase + driftDir * (k + 1) * 3.8 + Math.sin((k + 1) * 0.45 + si) * 4.5;
      const midX = (x1 + x2) * 0.5, midZ = (z1 + z2) * 0.5;
      if (Math.abs(midZ) < 40 || isPointInsideMajorKeepout(midX, midZ, keepouts, 2.6)) continue;
      const y1 = getFavelaElevation(x1, z1), y2 = getFavelaElevation(x2, z2);
      if (y1 < 0.45 || y2 < 0.45) continue;

      batcher.addSegmentSlab('retaining_concrete', x1, y1 - 0.44, z1, x2, y2 - 0.44, z2, stairW + 0.35, 0.98, 0.35, null, 'both');
      const ang = Math.atan2(x2 - x1, z2 - z1), nx = Math.cos(ang), nz = -Math.sin(ang);
      for (let t = 0; t < 4; t++) {
        const u = (t + 0.5) / 4;
        batcher.addBox((si + k + t) % 5 === 0 ? 'cv_red' : 'cement_slab', stairW - 0.28, 0.22, (stepLen / 4) * 0.92, x1 + (x2 - x1) * u, y1 + (y2 - y1) * u + 0.08, z1 + (z2 - z1) * u, ang, null, 'l0', true);
      }
      for (const s of [-1, 1]) {
        const off = s * (stairW * 0.5 - 0.14);
        batcher.addSegmentSlab((si + k) % 4 === 0 ? 'cv_white' : 'retaining_concrete', x1 + nx * off, y1 + 0.3, z1 + nz * off, x2 + nx * off, y2 + 0.3, z2 + nz * off, 0.2, 0.5, 0.2, null, 'l0');
      }
      batcher.addSegmentSlab('rebar_iron', x1, y1 + 0.9, z1, x2, y2 + 0.9, z2, 0.08, 0.08, 0.14, null, 'l0');
      if (k % 5 === 2) addUtilityPoleAndGatoWires(world, batcher, midX, (y1 + y2) * 0.5, midZ, ang, stairW * 0.5, si * 53 + k);

      const segRec = { kind: 'escadao', ribbonId: -2, x1, z1, x2, z2, halfW: stairW * 0.5, clearance: stairW * 0.5 + 0.65, _qid: 0 };
      allSegments.push(segRec);
      indexSegment(segGrid, segRec);
      builtSegs++;
    }
    if (builtSegs > 0) { escadoes.push({ index: si, zBase, segments: builtSegs }); world.favelaCDDData.staircasesCount += 2; }
  }

  return {
    keepouts, ladeiras, contourRibbons, escadoes, allSegments,
    isObbClearForParcel(obb, ownRibbonId = -999) {
      for (let i = 0; i < keepouts.rects.length; i++) {
        const r = keepouts.rects[i];
        if (obbIntersectsRect2D(obb, r.minX, r.maxX, r.minZ, r.maxZ, 1.0)) return false;
      }
      for (let i = 0; i < keepouts.circles.length; i++) {
        const c = keepouts.circles[i];
        if (!obbClearOfCircle2D(obb, c.x, c.z, c.r)) return false;
      }
      if (obb.cz < ws(-1280) && getHighwayDistanceAt(obb.cx, obb.cz) < 30) return false;

      const qid = ++qidCounter;
      const gx0 = Math.floor((obb.minX - 6) / SEG_CELL_SIZE), gx1 = Math.floor((obb.maxX + 6) / SEG_CELL_SIZE);
      const gz0 = Math.floor((obb.minZ - 6) / SEG_CELL_SIZE), gz1 = Math.floor((obb.maxZ + 6) / SEG_CELL_SIZE);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const list = segGrid.get(packCell(gx, gz));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const seg = list[i];
            if (seg._qid === qid) continue;
            seg._qid = qid;
            const minClr = seg.ribbonId === ownRibbonId ? seg.halfW + 0.08 : seg.clearance;
            if (!obbClearOfSegment2D(obb, seg.x1, seg.z1, seg.x2, seg.z2, minClr)) return false;
          }
        }
      }
      return true;
    },
    hasCirculationOrLandmarkAt(cx, cz, halfCell) {
      for (let i = 0; i < keepouts.rects.length; i++) {
        const r = keepouts.rects[i];
        if (r.isLandmark && cx + halfCell >= r.minX && cx - halfCell <= r.maxX && cz + halfCell >= r.minZ && cz - halfCell <= r.maxZ) return true;
      }
      for (let i = 0; i < keepouts.circles.length; i++) {
        if (Math.hypot(cx - keepouts.circles[i].x, cz - keepouts.circles[i].z) <= keepouts.circles[i].r + halfCell) return true;
      }
      const gx = Math.floor(cx / SEG_CELL_SIZE), gz = Math.floor(cz / SEG_CELL_SIZE), maxSq = (halfCell * 1.35) ** 2;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const list = segGrid.get(packCell(gx + dx, gz + dz));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (pointToSegmentDistSq2D(cx, cz, s.x1, s.z1, s.x2, s.z2) <= maxSq) return true;
          }
        }
      }
      return false;
    }
  };
}
