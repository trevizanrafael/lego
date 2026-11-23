import { IS_SCALED_WORLD, ROAD } from '../core/WorldLayoutScale.js';

/**
 * PoliceOrganicGraphHelper.js
 * Ingestão das vias orgânicas (`world.mapOrganicRoads`: boulevards diagonais, curvas em S,
 * alamedas sinuosas do subúrbio, rotatórias e cul-de-sacs) no grafo viário A* da Polícia
 * e contenção de coordenadas ao asfalto (`clampPointToRoadAsphalt`).
 */

export function addBidirectionalEdge(graph, nodeA, nodeB, isBridge = false, roadWidth = ROAD.mainWidth, flags = null) {
  if (!nodeA || !nodeB || nodeA === nodeB) return null;
  for (let i = 0; i < nodeA.neighbors.length; i++) {
    if (nodeA.neighbors[i].node === nodeB) return null;
  }
  const dx = nodeB.x - nodeA.x;
  const dz = nodeB.z - nodeA.z;
  const cost = Math.hypot(dx, dz);
  if (cost < 1e-3) return null;
  const inv = 1 / cost;
  nodeA.neighbors.push({ node: nodeB, cost, dirX: dx * inv, dirZ: dz * inv, roadWidth });
  nodeB.neighbors.push({ node: nodeA, cost, dirX: -dx * inv, dirZ: -dz * inv, roadWidth });
  if (roadWidth > (nodeA.roadWidth || 0)) nodeA.roadWidth = roadWidth;
  if (roadWidth > (nodeB.roadWidth || 0)) nodeB.roadWidth = roadWidth;
  const seg = {
    a: nodeA,
    b: nodeB,
    length: cost,
    dirX: dx * inv,
    dirZ: dz * inv,
    isBridge,
    roadWidth,
    isOrganic: Boolean(flags?.isOrganic),
    isRoundaboutRing: Boolean(flags?.isRoundaboutRing)
  };
  graph.segments.push(seg);
  return seg;
}

function removeSegmentEdge(graph, seg) {
  const { a, b } = seg;
  for (let i = a.neighbors.length - 1; i >= 0; i--) {
    if (a.neighbors[i].node === b) a.neighbors.splice(i, 1);
  }
  for (let i = b.neighbors.length - 1; i >= 0; i--) {
    if (b.neighbors[i].node === a) b.neighbors.splice(i, 1);
  }
  const idx = graph.segments.indexOf(seg);
  if (idx !== -1) graph.segments.splice(idx, 1);
}

function splitSegmentAtNode(graph, seg, jNode, canConnect) {
  if (!seg || !jNode || jNode === seg.a || jNode === seg.b) return;
  const okA = canConnect(seg.a, jNode, seg.isBridge);
  const okB = canConnect(jNode, seg.b, seg.isBridge);
  const flags = { isOrganic: seg.isOrganic, isRoundaboutRing: seg.isRoundaboutRing };
  if (okA && okB) removeSegmentEdge(graph, seg);
  if (okA) addBidirectionalEdge(graph, seg.a, jNode, seg.isBridge, seg.roadWidth, flags);
  if (okB) addBidirectionalEdge(graph, jNode, seg.b, seg.isBridge, seg.roadWidth, flags);
}

export function snapOrSplitOntoExistingSegment(
  graph,
  px,
  pz,
  polyNode,
  roadWidth,
  registerNode,
  canConnect,
  excludedNodeSet = null
) {
  if (!polyNode) return null;
  let bestSeg = null;
  let bestDistSq = 22.0 * 22.0;
  let bestJx = 0;
  let bestJz = 0;

  for (let i = 0; i < graph.segments.length; i++) {
    const seg = graph.segments[i];
    if (seg.isBridge || seg.isRoundaboutRing || seg.a === polyNode || seg.b === polyNode) continue;
    if (excludedNodeSet && excludedNodeSet.has(seg.a) && excludedNodeSet.has(seg.b)) continue;

    const vx = seg.b.x - seg.a.x;
    const vz = seg.b.z - seg.a.z;
    const lenSq = vx * vx + vz * vz;
    if (lenSq <= 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((px - seg.a.x) * vx + (pz - seg.a.z) * vz) / lenSq));
    const qx = seg.a.x + vx * t;
    const qz = seg.a.z + vz * t;
    const dSq = (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
    if (dSq <= bestDistSq) {
      bestDistSq = dSq;
      bestSeg = seg;
      bestJx = qx;
      bestJz = qz;
    }
  }

  if (bestSeg) {
    let jNode = null;
    if (Math.hypot(bestJx - bestSeg.a.x, bestJz - bestSeg.a.z) <= 2.5) jNode = bestSeg.a;
    else if (Math.hypot(bestJx - bestSeg.b.x, bestJz - bestSeg.b.z) <= 2.5) jNode = bestSeg.b;
    else {
      jNode = registerNode(bestJx, bestJz, 'organic_junction', bestSeg.isBridge, bestSeg.roadWidth);
      if (jNode && jNode !== bestSeg.a && jNode !== bestSeg.b) {
        splitSegmentAtNode(graph, bestSeg, jNode, canConnect);
      }
    }
    if (jNode && jNode !== polyNode && canConnect(polyNode, jNode, false)) {
      addBidirectionalEdge(graph, polyNode, jNode, false, roadWidth, { isOrganic: true });
    }
    return jNode;
  }

  let bestNode = null;
  let bestNodeDistSq = 24.0 * 24.0;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    if (n === polyNode || (excludedNodeSet && excludedNodeSet.has(n))) continue;
    const dSq = (px - n.x) * (px - n.x) + (pz - n.z) * (pz - n.z);
    if (dSq <= bestNodeDistSq) {
      bestNodeDistSq = dSq;
      bestNode = n;
    }
  }
  if (bestNode && canConnect(polyNode, bestNode, false)) {
    addBidirectionalEdge(graph, polyNode, bestNode, false, roadWidth, { isOrganic: true });
    return bestNode;
  }
  return null;
}

export function ingestOrganicRoadsIntoGraph(graph, organicRoads, registerNode, canConnect) {
  if (!Array.isArray(organicRoads) || organicRoads.length === 0) return;
  const swDefault = ROAD.sidewalk || 10;

  for (let i = 0; i < organicRoads.length; i++) {
    const item = organicRoads[i];
    if (!item || item.kind !== 'roundabout') continue;
    const cx = Number(item.cx) || 0;
    const cz = Number(item.cz) || 0;
    const innerR = Number(item.innerR) || 14;
    const outerR = Number(item.outerR) || 38;
    const rMid = (innerR + outerR) * 0.5;
    const ringWidth = Math.max(14, outerR - innerR);
    const ringCount = outerR <= 24 ? 6 : 8;
    const ringNodes = [];
    for (let k = 0; k < ringCount; k++) {
      const ang = (k / ringCount) * Math.PI * 2;
      const rn = registerNode(cx + Math.cos(ang) * rMid, cz + Math.sin(ang) * rMid, 'roundabout', false, ringWidth);
      if (rn) ringNodes.push(rn);
    }
    for (let k = 0; k < ringNodes.length; k++) {
      const nA = ringNodes[k];
      const nB = ringNodes[(k + 1) % ringNodes.length];
      if (canConnect(nA, nB, false)) {
        addBidirectionalEdge(graph, nA, nB, false, ringWidth, { isOrganic: true, isRoundaboutRing: true });
      }
    }
    graph.roundabouts.push({
      id: item.id || null,
      cx,
      cz,
      innerR,
      outerR,
      rMid,
      sidewalk: Number(item.sidewalk) || swDefault,
      roadWidth: ringWidth,
      ringNodes
    });
  }

  const polylines = organicRoads
    .filter((it) => it && (it.kind === 'polyline' || Array.isArray(it.points)))
    .sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0));

  const polyRecords = [];
  for (let p = 0; p < polylines.length; p++) {
    const poly = polylines[p];
    const pts = poly.points;
    if (!Array.isArray(pts) || pts.length < 2) continue;
    const width = Number(poly.width) || ROAD.secondaryWidth;
    const halfWidth = width * 0.5;
    const sidewalk = Number(poly.sidewalk) || swDefault;
    const pad = halfWidth + sidewalk + 1.0;
    const chain = [];
    const origVertices = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const vx = x2 - x1;
      const vz = z2 - z1;
      const lenSq = vx * vx + vz * vz;
      if (lenSq < 0.25) continue;
      const len = Math.sqrt(lenSq);
      graph.organicSegments.push({
        x1,
        z1,
        x2,
        z2,
        width,
        halfWidth,
        sidewalk,
        vx,
        vz,
        invLenSq: 1 / lenSq,
        minX: Math.min(x1, x2) - pad,
        maxX: Math.max(x1, x2) + pad,
        minZ: Math.min(z1, z2) - pad,
        maxZ: Math.max(z1, z2) + pad
      });
      const subSteps = len > 95 ? Math.ceil(len / 85) : 1;
      for (let s = i === 0 ? 0 : 1; s <= subSteps; s++) {
        const t = s / subSteps;
        const px = x1 + vx * t;
        const pz = z1 + vz * t;
        const nd = registerNode(px, pz, 'organic', false, width);
        if (!nd) continue;
        if (chain.length === 0 || chain[chain.length - 1] !== nd) chain.push(nd);
        if (s === 0 || s === subSteps) {
          origVertices.push({
            px,
            pz,
            node: nd,
            isEnd: (i === 0 && s === 0) || (i === pts.length - 2 && s === subSteps)
          });
        }
      }
    }
    for (let m = 0; m < chain.length - 1; m++) {
      if (canConnect(chain[m], chain[m + 1], false)) {
        addBidirectionalEdge(graph, chain[m], chain[m + 1], false, width, { isOrganic: true });
      }
    }
    if (chain.length > 0) polyRecords.push({ width, nodeSet: new Set(chain), origVertices });
  }

  for (let r = 0; r < polyRecords.length; r++) {
    const rec = polyRecords[r];
    for (let v = 0; v < rec.origVertices.length; v++) {
      const { px, pz, node, isEnd } = rec.origVertices[v];
      let attachedToRing = false;
      if (isEnd) {
        for (let rbIdx = 0; rbIdx < graph.roundabouts.length; rbIdx++) {
          const rb = graph.roundabouts[rbIdx];
          const dr = Math.hypot(px - rb.cx, pz - rb.cz);
          if (Math.abs(dr - rb.rMid) <= 22.0 && dr >= rb.innerR * 0.6 && rb.ringNodes.length > 0) {
            let nearRing = rb.ringNodes[0];
            let nearRingSq = Infinity;
            for (let k = 0; k < rb.ringNodes.length; k++) {
              const rn = rb.ringNodes[k];
              const dSq = (px - rn.x) * (px - rn.x) + (pz - rn.z) * (pz - rn.z);
              if (dSq < nearRingSq) {
                nearRingSq = dSq;
                nearRing = rn;
              }
            }
            if (nearRing && nearRing !== node && canConnect(node, nearRing, false)) {
              addBidirectionalEdge(graph, node, nearRing, false, Math.min(rec.width, rb.roadWidth), { isOrganic: true });
              attachedToRing = true;
            }
          }
        }
      }
      if (!attachedToRing) {
        snapOrSplitOntoExistingSegment(graph, px, pz, node, rec.width, registerNode, canConnect, rec.nodeSet);
      }
    }
  }

  // Cruzamentos interiores diretos entre segmentos orgânicos e cartesianos sem vértice explícito
  const orgEdges = graph.segments.filter((s) => s.isOrganic && !s.isRoundaboutRing);
  for (let i = 0; i < orgEdges.length; i++) {
    const sO = orgEdges[i];
    if (!graph.segments.includes(sO)) continue;
    const ox1 = sO.a.x;
    const oz1 = sO.a.z;
    const odx = sO.b.x - ox1;
    const odz = sO.b.z - oz1;
    const oMinX = Math.min(ox1, sO.b.x);
    const oMaxX = Math.max(ox1, sO.b.x);
    const oMinZ = Math.min(oz1, sO.b.z);
    const oMaxZ = Math.max(oz1, sO.b.z);
    for (let j = graph.segments.length - 1; j >= 0; j--) {
      const sC = graph.segments[j];
      if (!sC || sC.isOrganic || sC.isBridge) continue;
      if (sC.a === sO.a || sC.a === sO.b || sC.b === sO.a || sC.b === sO.b) continue;
      const cx1 = sC.a.x;
      const cz1 = sC.a.z;
      const cdx = sC.b.x - cx1;
      const cdz = sC.b.z - cz1;
      if (Math.max(cx1, sC.b.x) < oMinX || Math.min(cx1, sC.b.x) > oMaxX) continue;
      if (Math.max(cz1, sC.b.z) < oMinZ || Math.min(cz1, sC.b.z) > oMaxZ) continue;
      const denom = odx * cdz - odz * cdx;
      if (Math.abs(denom) < 1e-6) continue;
      const rx = cx1 - ox1;
      const rz = cz1 - oz1;
      const t = (rx * cdz - rz * cdx) / denom;
      const u = (rx * odz - rz * odx) / denom;
      if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98) {
        const ix = ox1 + odx * t;
        const iz = oz1 + odz * t;
        const jNode = registerNode(ix, iz, 'organic_crossing', false, Math.max(sO.roadWidth, sC.roadWidth));
        if (jNode) {
          splitSegmentAtNode(graph, sC, jNode, canConnect);
          splitSegmentAtNode(graph, sO, jNode, canConnect);
          break;
        }
      }
    }
  }
}

export function clampPointToRoadAsphalt(graph, x, z, curbMargin = 2.0) {
  if (!IS_SCALED_WORLD || !graph) return { x, z, clamped: false, roadWidth: ROAD.mainWidth };
  const xCols = graph.xCorridors || [];
  const zCols = graph.zCorridors || [];
  const orgSegs = graph.organicSegments || [];
  const rbs = graph.roundabouts || [];
  const sidewalkW = ROAD.sidewalk || 10;

  let bestRbClamp = null;
  let bestRbPen = Infinity;
  for (let i = 0; i < rbs.length; i++) {
    const rb = rbs[i];
    if (Math.abs(x - rb.cx) > rb.outerR + sidewalkW + 2 || Math.abs(z - rb.cz) > rb.outerR + sidewalkW + 2) continue;
    const dr = Math.hypot(x - rb.cx, z - rb.cz);
    const rw = rb.roadWidth || Math.max(14, rb.outerR - rb.innerR);
    const sw = rb.sidewalk || sidewalkW;
    if (dr >= rb.innerR + curbMargin && dr <= rb.outerR - curbMargin) {
      return { x, z, clamped: false, roadWidth: rw };
    }
    if (dr > rb.outerR - curbMargin && dr <= rb.outerR + sw + 0.5) {
      const pen = dr - (rb.outerR - curbMargin);
      if (pen < bestRbPen && dr > 1e-4) {
        const rTgt = Math.max(rb.innerR + 2.0, rb.outerR - curbMargin);
        bestRbPen = pen;
        bestRbClamp = {
          x: rb.cx + ((x - rb.cx) / dr) * rTgt,
          z: rb.cz + ((z - rb.cz) / dr) * rTgt,
          clamped: true,
          roadWidth: rw
        };
      }
    } else if (dr < rb.innerR + curbMargin && dr >= Math.max(0.5, rb.innerR - 6.0)) {
      const pen = rb.innerR + curbMargin - dr;
      if (pen < bestRbPen) {
        const rTgt = Math.min(rb.outerR - 2.0, rb.innerR + curbMargin);
        bestRbPen = pen;
        bestRbClamp =
          dr > 1e-4
            ? {
                x: rb.cx + ((x - rb.cx) / dr) * rTgt,
                z: rb.cz + ((z - rb.cz) / dr) * rTgt,
                clamped: true,
                roadWidth: rw
              }
            : { x: rb.cx + rTgt, z: rb.cz, clamped: true, roadWidth: rw };
      }
    }
  }

  let bestOrgClamp = null;
  let bestOrgDist = Infinity;
  for (let i = 0; i < orgSegs.length; i++) {
    const s = orgSegs[i];
    if (s.minX !== undefined && (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ)) continue;
    const vx = s.vx !== undefined ? s.vx : s.x2 - s.x1;
    const vz = s.vz !== undefined ? s.vz : s.z2 - s.z1;
    const invLenSq = s.invLenSq !== undefined ? s.invLenSq : 1 / Math.max(1e-6, vx * vx + vz * vz);
    let t = ((x - s.x1) * vx + (z - s.z1) * vz) * invLenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const qx = s.x1 + vx * t;
    const qz = s.z1 + vz * t;
    const dx = x - qx;
    const dz = z - qz;
    const dist = Math.hypot(dx, dz);
    const halfW = s.halfWidth !== undefined ? s.halfWidth : (s.width || ROAD.secondaryWidth) * 0.5;
    const maxLat = Math.max(2.0, halfW - curbMargin);
    if (dist <= maxLat) {
      return { x, z, clamped: false, roadWidth: s.width || ROAD.secondaryWidth };
    }
    const sw = s.sidewalk || sidewalkW;
    if (dist <= halfW + sw && dist < bestOrgDist && dist > 1e-4) {
      bestOrgDist = dist;
      bestOrgClamp = {
        x: qx + (dx / dist) * maxLat,
        z: qz + (dz / dist) * maxLat,
        clamped: true,
        roadWidth: s.width || ROAD.secondaryWidth
      };
    }
  }

  let nearX = null;
  let bestDx = Infinity;
  for (let i = 0; i < xCols.length; i++) {
    const c = xCols[i];
    if (z < c.min - 14 || z > c.max + 14) continue;
    const dx = Math.abs(x - c.coord);
    if (dx <= c.width * 0.5 + sidewalkW + 0.5 && dx < bestDx) {
      bestDx = dx;
      nearX = c;
    }
  }

  let nearZ = null;
  let bestDz = Infinity;
  for (let i = 0; i < zCols.length; i++) {
    const c = zCols[i];
    if (x < c.min - 14 || x > c.max + 14) continue;
    const dz = Math.abs(z - c.coord);
    if (dz <= c.width * 0.5 + sidewalkW + 0.5 && dz < bestDz) {
      bestDz = dz;
      nearZ = c;
    }
  }

  if (nearX && nearZ && bestDx <= nearX.width * 0.5 + 1.5 && bestDz <= nearZ.width * 0.5 + 1.5) {
    return { x, z, clamped: false, roadWidth: Math.max(nearX.width, nearZ.width) };
  }
  if (nearX && bestDx <= Math.max(2.0, nearX.width * 0.5 - curbMargin)) {
    return { x, z, clamped: false, roadWidth: nearX.width };
  }
  if (nearZ && bestDz <= Math.max(2.0, nearZ.width * 0.5 - curbMargin)) {
    return { x, z, clamped: false, roadWidth: nearZ.width };
  }

  if (bestRbClamp) return bestRbClamp;
  if (bestOrgClamp) return bestOrgClamp;

  if (nearX && (!nearZ || bestDz > nearZ.width * 0.5)) {
    const maxLat = Math.max(2.0, nearX.width * 0.5 - curbMargin);
    if (bestDx > maxLat) {
      return { x: nearX.coord + (x >= nearX.coord ? maxLat : -maxLat), z, clamped: true, roadWidth: nearX.width };
    }
    return { x, z, clamped: false, roadWidth: nearX.width };
  }

  if (nearZ && (!nearX || bestDx > nearX.width * 0.5)) {
    const maxLat = Math.max(2.0, nearZ.width * 0.5 - curbMargin);
    if (bestDz > maxLat) {
      return { x, z: nearZ.coord + (z >= nearZ.coord ? maxLat : -maxLat), clamped: true, roadWidth: nearZ.width };
    }
    return { x, z, clamped: false, roadWidth: nearZ.width };
  }

  return { x, z, clamped: false, roadWidth: ROAD.mainWidth };
}
