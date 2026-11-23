import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import {
  IS_SCALED_WORLD,
  ROAD,
  ws,
  MAIN_AVENUES_X as URBAN_MAIN_AVENUES_X,
  MAIN_AVENUES_Z as URBAN_MAIN_AVENUES_Z,
  SECONDARY_STREETS_X as URBAN_SECONDARY_STREETS_X,
  SECONDARY_STREETS_Z as URBAN_SECONDARY_STREETS_Z,
  INDUSTRIAL_STREETS_X
} from '../core/WorldLayoutScale.js';

/**
 * PoliceRoadGraph.js
 * Grafo viário leve em cache das avenidas/ruas da metrópole + busca de caminho A* (60 FPS).
 * Preserva 100% de paridade em `1x` e expande em `3x` para cobrir Centro, Subúrbio Norte,
 * Praia Sul, Distrito Industrial, Porto Leste, Rodovia do Aeroporto Oeste e Ponte da Prisão.
 */

const LEGACY_NS_AVENUES_X = Object.freeze([-516, -384, -252, -120, 0, 120, 252, 384, 612]);
const LEGACY_EW_AVENUES_Z = Object.freeze([-512, -382, -252, -117, 0, 134, 384, 710]);

const PORT_LOGISTICS_AVENUES_X = Object.freeze([600, 825, 1158, 1375, 1545].map(ws));
const PORT_LOGISTICS_AVENUES_Z = Object.freeze([134, 335, 535, 708].map(ws));
const PORT_ROAD_WIDTH = 28;
const PRISON_BRIDGE_X = ws(1375);

function uniqueSortedNumbers(lists) {
  const set = new Set();
  for (let i = 0; i < lists.length; i++) {
    const arr = lists[i];
    for (let k = 0; k < arr.length; k++) set.add(arr[k]);
  }
  return Object.freeze([...set].sort((a, b) => a - b));
}

export const NS_AVENUES_X = IS_SCALED_WORLD
  ? uniqueSortedNumbers([
      URBAN_MAIN_AVENUES_X,
      URBAN_SECONDARY_STREETS_X,
      INDUSTRIAL_STREETS_X,
      PORT_LOGISTICS_AVENUES_X
    ])
  : LEGACY_NS_AVENUES_X;

export const EW_AVENUES_Z = IS_SCALED_WORLD
  ? uniqueSortedNumbers([
      [ws(-1300)],
      URBAN_MAIN_AVENUES_Z,
      URBAN_SECONDARY_STREETS_Z,
      PORT_LOGISTICS_AVENUES_Z
    ])
  : LEGACY_EW_AVENUES_Z;

const LEGACY_NORTH_EXTENSION_Z = -680;
const LEGACY_AIRPORT_HIGHWAY_X = Object.freeze([-690, -860, -1036]);
const LEGACY_PRISON_JUNCTION = Object.freeze({ x: 612, z: 520 });
const LEGACY_PRISON_ISLAND_NODE = Object.freeze({ x: 720, z: 520 });
const LEGACY_WEST_AIRBASE_SPUR = Object.freeze({ x: -690, z: -80 });

function makeCoordKey(x, z) {
  return `${Math.round(x * 10)},${Math.round(z * 10)}`;
}

function isNodeDryAndDriveable(world, x, z, allowBridge = false) {
  if (getMetroCutoutFloorY(x, z) !== null) return false;
  if (!allowBridge && world?.isDeepWaterAt?.(x, z, { forCar: true })) return false;
  return true;
}

function isSegmentBlocked(sys, ax, az, bx, bz) {
  return typeof sys?._isSegmentBlockedByBuilding === 'function'
    ? Boolean(sys._isSegmentBlockedByBuilding(ax, az, bx, bz))
    : false;
}

function addBidirectionalEdge(graph, nodeA, nodeB, isBridge = false, roadWidth = ROAD.mainWidth) {
  if (!nodeA || !nodeB || nodeA === nodeB) return;
  for (let i = 0; i < nodeA.neighbors.length; i++) {
    if (nodeA.neighbors[i].node === nodeB) return;
  }
  const dx = nodeB.x - nodeA.x;
  const dz = nodeB.z - nodeA.z;
  const cost = Math.hypot(dx, dz);
  if (cost < 1e-3) return;
  const inv = 1 / cost;
  nodeA.neighbors.push({ node: nodeB, cost, dirX: dx * inv, dirZ: dz * inv, roadWidth });
  nodeB.neighbors.push({ node: nodeA, cost, dirX: -dx * inv, dirZ: -dz * inv, roadWidth });
  if (roadWidth > (nodeA.roadWidth || 0)) nodeA.roadWidth = roadWidth;
  if (roadWidth > (nodeB.roadWidth || 0)) nodeB.roadWidth = roadWidth;
  graph.segments.push({ a: nodeA, b: nodeB, length: cost, dirX: dx * inv, dirZ: dz * inv, isBridge, roadWidth });
}

function buildSpawnSamples(world, nodes, segments) {
  const samples = [];
  const seen = new Set();
  const sampleStep = IS_SCALED_WORLD ? 42.0 : 32.0;
  const pushSample = (x, z, dirX = 0, dirZ = 1, roadWidth = ROAD.mainWidth) => {
    const key = `${Math.round(x)},${Math.round(z)}`;
    if (seen.has(key) || !isNodeDryAndDriveable(world, x, z, false)) return;
    seen.add(key);
    samples.push({ x, z, dirX, dirZ, roadWidth });
  };

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.neighbors.length === 0) continue;
    pushSample(n.x, n.z, n.neighbors[0].dirX, n.neighbors[0].dirZ, n.roadWidth || ROAD.mainWidth);
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.isBridge) continue;
    const steps = Math.floor(seg.length / sampleStep);
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      pushSample(
        seg.a.x + (seg.b.x - seg.a.x) * t,
        seg.a.z + (seg.b.z - seg.a.z) * t,
        seg.dirX,
        seg.dirZ,
        seg.roadWidth || ROAD.mainWidth
      );
    }
  }
  return samples;
}

function finalizeGraphBuffers(world, graph) {
  graph.spawnSamples = buildSpawnSamples(world, graph.nodes, graph.segments);
  const count = graph.nodes.length;
  graph._gScore = new Float64Array(count);
  graph._fScore = new Float64Array(count);
  graph._cameFrom = new Int32Array(count);
  graph._visitState = new Uint8Array(count);
  return graph;
}

function buildScaledPoliceRoadGraph(sys) {
  const world = sys?.world || null;
  const nodeMap = new Map();
  const nodes = [];
  const xCorridors = [];
  const zCorridors = [];

  const registerNode = (x, z, tag = 'grid', allowBridge = false, defaultWidth = ROAD.secondaryWidth) => {
    const key = makeCoordKey(x, z);
    if (nodeMap.has(key)) return nodeMap.get(key);
    if (!isNodeDryAndDriveable(world, x, z, allowBridge)) return null;
    const y = world?.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
    const node = { id: key, index: nodes.length, x, z, y, tag, roadWidth: defaultWidth, neighbors: [] };
    nodeMap.set(key, node);
    nodes.push(node);
    return node;
  };

  const graph = {
    nodes,
    segments: [],
    spawnSamples: [],
    xCorridors,
    zCorridors,
    _gScore: null,
    _fScore: null,
    _cameFrom: null,
    _visitState: null
  };

  const canConnect = (a, b, allowBridge = false) => {
    if (!a || !b || isSegmentBlocked(sys, a.x, a.z, b.x, b.z)) return false;
    if (!allowBridge) {
      for (const t of [0.25, 0.5, 0.75]) {
        const sx = a.x + (b.x - a.x) * t;
        const sz = a.z + (b.z - a.z) * t;
        if (getMetroCutoutFloorY(sx, sz) !== null) return false;
        if (world?.isDeepWaterAt?.(sx, sz, { forCar: true })) return false;
      }
    }
    return true;
  };

  const connectLineX = (xCoord, zMin, zMax, zStops, roadWidth, tag = 'avenue', isBridge = false) => {
    xCorridors.push({ coord: xCoord, min: zMin, max: zMax, width: roadWidth, isBridge });
    const lineNodes = [];
    for (let i = 0; i < zStops.length; i++) {
      const z = zStops[i];
      if (z < zMin - 0.5 || z > zMax + 0.5) continue;
      const n = registerNode(xCoord, z, tag, isBridge, roadWidth);
      if (n) lineNodes.push(n);
    }
    lineNodes.sort((a, b) => a.z - b.z);
    for (let k = 0; k < lineNodes.length - 1; k++) {
      if (canConnect(lineNodes[k], lineNodes[k + 1], isBridge)) {
        addBidirectionalEdge(graph, lineNodes[k], lineNodes[k + 1], isBridge, roadWidth);
      }
    }
  };

  const connectLineZ = (zCoord, xMin, xMax, xStops, roadWidth, tag = 'avenue', isBridge = false) => {
    zCorridors.push({ coord: zCoord, min: xMin, max: xMax, width: roadWidth, isBridge });
    const lineNodes = [];
    for (let i = 0; i < xStops.length; i++) {
      const x = xStops[i];
      if (x < xMin - 0.5 || x > xMax + 0.5) continue;
      const n = registerNode(x, zCoord, tag, isBridge, roadWidth);
      if (n) lineNodes.push(n);
    }
    lineNodes.sort((a, b) => a.x - b.x);
    for (let k = 0; k < lineNodes.length - 1; k++) {
      if (canConnect(lineNodes[k], lineNodes[k + 1], isBridge)) {
        addBidirectionalEdge(graph, lineNodes[k], lineNodes[k + 1], isBridge, roadWidth);
      }
    }
  };

  const allUrbanZ = uniqueSortedNumbers([[ws(-1300)], URBAN_SECONDARY_STREETS_Z, URBAN_MAIN_AVENUES_Z]);
  const allUrbanAndIndX = uniqueSortedNumbers([
    URBAN_SECONDARY_STREETS_X,
    URBAN_MAIN_AVENUES_X,
    INDUSTRIAL_STREETS_X,
    PORT_LOGISTICS_AVENUES_X
  ]);

  // 1. Avenidas Principais Norte-Sul (34m) e Ruas Secundárias Norte-Sul (26m)
  for (const ax of URBAN_MAIN_AVENUES_X) {
    connectLineX(ax, ws(-1300), ws(710), allUrbanZ, ROAD.mainWidth, 'main_avenue');
  }
  for (const sx of URBAN_SECONDARY_STREETS_X) {
    if (Math.abs(sx - ws(-648)) < 0.5) {
      connectLineX(sx, ws(-1300), ws(-512), allUrbanZ, ROAD.secondaryWidth, 'secondary_street');
      connectLineX(sx, ws(402), ws(710), allUrbanZ, ROAD.secondaryWidth, 'secondary_street');
    } else if (Math.abs(sx - ws(648)) < 0.5) {
      connectLineX(sx, ws(-1300), ws(-512), allUrbanZ, ROAD.secondaryWidth, 'secondary_street');
    } else {
      connectLineX(sx, ws(-1300), ws(710), allUrbanZ, ROAD.secondaryWidth, 'secondary_street');
    }
  }
  for (const ix of INDUSTRIAL_STREETS_X) {
    connectLineX(ix, ws(-1300), ws(134), allUrbanZ, ROAD.secondaryWidth, 'industrial_street');
  }

  // 2. Avenidas Principais Leste-Oeste (34m) e Ruas Secundárias Leste-Oeste (26m)
  for (const az of URBAN_MAIN_AVENUES_Z) {
    const xMax = az <= ws(134) ? ws(1545) : ws(600);
    connectLineZ(az, ws(-516), xMax, allUrbanAndIndX, ROAD.mainWidth, 'main_avenue');
  }
  for (const sz of [ws(-1300), ...URBAN_SECONDARY_STREETS_Z]) {
    const xMax = sz <= ws(-512) ? ws(1524) : ws(516);
    connectLineZ(sz, ws(-648), xMax, allUrbanAndIndX, ROAD.secondaryWidth, 'secondary_street');
  }

  // 3. Malha Logística do Porto Leste (28m / 34m na avenida da Ponte da Prisão)
  const portZStops = uniqueSortedNumbers([PORT_LOGISTICS_AVENUES_Z, [ws(402)]]);
  for (const pz of PORT_LOGISTICS_AVENUES_Z) {
    const w = Math.abs(pz - ws(134)) < 0.5 ? ROAD.mainWidth : PORT_ROAD_WIDTH;
    connectLineZ(pz, ws(600), ws(1545), PORT_LOGISTICS_AVENUES_X, w, 'port_avenue');
  }
  for (const px of PORT_LOGISTICS_AVENUES_X) {
    const w = Math.abs(px - PRISON_BRIDGE_X) < 0.5 ? ROAD.mainWidth : PORT_ROAD_WIDTH;
    connectLineX(px, ws(134), ws(708), portZStops, w, 'port_avenue');
  }

  // 4. Rodovia Expressa Oeste & Aeroporto (Z = 0, X = ws(-1100)..ws(-516), 34m) + Acessos Paralelos
  const westHwyXStops = [-1100, -1085, -1036, -860, -690, -516].map(ws);
  connectLineZ(0, ws(-1100), ws(-516), westHwyXStops, ROAD.mainWidth, 'airport_highway');
  connectLineZ(ws(-117), ws(-1085), ws(-516), [-1085, -860, -690, -516].map(ws), ROAD.mainWidth, 'airport_access');
  connectLineZ(ws(134), ws(-1085), ws(-516), [-1085, -860, -690, -516].map(ws), ROAD.mainWidth, 'airport_access');
  connectLineX(ws(-1085), ws(-280), ws(280), [ws(-280), ws(-117), 0, ws(134), ws(280)], ROAD.secondaryWidth, 'airport_blvd');

  // 5. Grande Ponte Blindada Sudeste para a Ilha da Prisão (X = ws(1375), Z = ws(708)..ws(1400), 34m)
  const prisonBridgeZ = [ws(708), ws(734), ws(1122), ws(1260), ws(1400)];
  const pNodes = prisonBridgeZ.map((z, idx) =>
    registerNode(PRISON_BRIDGE_X, z, idx >= 2 ? 'prison_island' : 'bridge_junction', idx === 1 || idx === 2, ROAD.mainWidth)
  );
  for (let k = 0; k < pNodes.length - 1; k++) {
    const overWaterSpan = k === 1;
    if (pNodes[k] && pNodes[k + 1] && canConnect(pNodes[k], pNodes[k + 1], overWaterSpan)) {
      addBidirectionalEdge(graph, pNodes[k], pNodes[k + 1], overWaterSpan, ROAD.mainWidth);
    }
  }

  return finalizeGraphBuffers(world, graph);
}

export function buildPoliceRoadGraph(sys) {
  if (IS_SCALED_WORLD) return buildScaledPoliceRoadGraph(sys);

  const world = sys?.world || null;
  const nodeMap = new Map();
  const nodes = [];

  const registerNode = (x, z, tag = 'grid') => {
    const key = makeCoordKey(x, z);
    if (nodeMap.has(key)) return nodeMap.get(key);
    if (!isNodeDryAndDriveable(world, x, z, false)) return null;
    const y = world?.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
    const node = { id: key, index: nodes.length, x, z, y, tag, roadWidth: ROAD.mainWidth, neighbors: [] };
    nodeMap.set(key, node);
    nodes.push(node);
    return node;
  };

  const nsZCoords = [LEGACY_NORTH_EXTENSION_Z, ...LEGACY_EW_AVENUES_Z];
  for (let ix = 0; ix < LEGACY_NS_AVENUES_X.length; ix++) {
    for (let iz = 0; iz < nsZCoords.length; iz++) {
      registerNode(LEGACY_NS_AVENUES_X[ix], nsZCoords[iz], 'avenue');
    }
  }

  const prisonJuncNode = registerNode(LEGACY_PRISON_JUNCTION.x, LEGACY_PRISON_JUNCTION.z, 'bridge_junction');
  const prisonIslandNode = registerNode(LEGACY_PRISON_ISLAND_NODE.x, LEGACY_PRISON_ISLAND_NODE.z, 'prison_island');
  for (let i = 0; i < LEGACY_AIRPORT_HIGHWAY_X.length; i++) {
    registerNode(LEGACY_AIRPORT_HIGHWAY_X[i], 0, 'airport_highway');
  }
  const airbaseSpurNode = registerNode(LEGACY_WEST_AIRBASE_SPUR.x, LEGACY_WEST_AIRBASE_SPUR.z, 'airbase_spur');

  const graph = {
    nodes,
    segments: [],
    spawnSamples: [],
    xCorridors: [],
    zCorridors: [],
    _gScore: null,
    _fScore: null,
    _cameFrom: null,
    _visitState: null
  };

  const canConnect = (a, b, allowBridge = false) => {
    if (!a || !b || isSegmentBlocked(sys, a.x, a.z, b.x, b.z)) return false;
    if (!allowBridge && world?.isDeepWaterAt) {
      if (world.isDeepWaterAt((a.x + b.x) * 0.5, (a.z + b.z) * 0.5, { forCar: true })) return false;
    }
    return true;
  };

  for (let ix = 0; ix < LEGACY_NS_AVENUES_X.length; ix++) {
    const ax = LEGACY_NS_AVENUES_X[ix];
    const line = nodes.filter((n) => Math.abs(n.x - ax) < 0.01).sort((a, b) => a.z - b.z);
    for (let k = 0; k < line.length - 1; k++) {
      if (canConnect(line[k], line[k + 1], false)) addBidirectionalEdge(graph, line[k], line[k + 1], false, ROAD.mainWidth);
    }
  }

  for (let iz = 0; iz < nsZCoords.length; iz++) {
    const az = nsZCoords[iz];
    const line = nodes.filter((n) => Math.abs(n.z - az) < 0.01).sort((a, b) => a.x - b.x);
    for (let k = 0; k < line.length - 1; k++) {
      if (canConnect(line[k], line[k + 1], false)) addBidirectionalEdge(graph, line[k], line[k + 1], false, ROAD.mainWidth);
    }
  }

  const hwy690 = nodeMap.get(makeCoordKey(-690, 0));
  if (hwy690 && airbaseSpurNode && canConnect(hwy690, airbaseSpurNode, false)) {
    addBidirectionalEdge(graph, hwy690, airbaseSpurNode, false, ROAD.secondaryWidth);
  }
  if (prisonJuncNode && prisonIslandNode && canConnect(prisonJuncNode, prisonIslandNode, true)) {
    addBidirectionalEdge(graph, prisonJuncNode, prisonIslandNode, true, ROAD.mainWidth);
  }

  return finalizeGraphBuffers(world, graph);
}

export function ensurePoliceRoadGraph(sys) {
  if (!sys) return buildPoliceRoadGraph(null);
  const world = sys.world || null;
  const buildings = world?.mapBuildings || null;
  const bLen = Array.isArray(buildings) ? buildings.length : 0;

  if (
    sys._roadGraph &&
    sys._roadGraphWorldRef === world &&
    sys._roadGraphBuildingsRef === buildings &&
    sys._roadGraphBuildingsLen === bLen
  ) {
    return sys._roadGraph;
  }

  const graph = buildPoliceRoadGraph(sys);
  sys._roadGraph = graph;
  sys._roadGraphWorldRef = world;
  sys._roadGraphBuildingsRef = buildings;
  sys._roadGraphBuildingsLen = bLen;
  return graph;
}

export function findNearestRoadNode(graph, x, z, filterFn = null) {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return null;
  let best = null;
  let bestDistSq = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    if (filterFn && !filterFn(n)) continue;
    const dSq = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = n;
    }
  }
  return best;
}

/**
 * Em `3x`, restringe alvos/posições que caíram sobre a calçada de 10m de volta à faixa asfaltada
 * `±(roadWidth * 0.5 - curbMargin)` quando fora de cruzamentos. No-op em `1x`.
 */
export function clampPointToRoadAsphalt(graph, x, z, curbMargin = 2.0) {
  if (!IS_SCALED_WORLD || !graph) return { x, z, clamped: false, roadWidth: ROAD.mainWidth };
  const xCols = graph.xCorridors || [];
  const zCols = graph.zCorridors || [];
  const sidewalkW = ROAD.sidewalk || 10;

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

  // Cruzamento real entre duas vias: asfalto aberto nos dois eixos
  if (nearX && nearZ && bestDx <= nearX.width * 0.5 + 1.5 && bestDz <= nearZ.width * 0.5 + 1.5) {
    return { x, z, clamped: false, roadWidth: Math.max(nearX.width, nearZ.width) };
  }

  if (nearX && (!nearZ || bestDz > nearZ.width * 0.5)) {
    const maxLat = Math.max(2.0, nearX.width * 0.5 - curbMargin);
    if (bestDx > maxLat) {
      const clampedX = nearX.coord + (x >= nearX.coord ? maxLat : -maxLat);
      return { x: clampedX, z, clamped: true, roadWidth: nearX.width };
    }
    return { x, z, clamped: false, roadWidth: nearX.width };
  }

  if (nearZ && (!nearX || bestDx > nearX.width * 0.5)) {
    const maxLat = Math.max(2.0, nearZ.width * 0.5 - curbMargin);
    if (bestDz > maxLat) {
      const clampedZ = nearZ.coord + (z >= nearZ.coord ? maxLat : -maxLat);
      return { x, z: clampedZ, clamped: true, roadWidth: nearZ.width };
    }
    return { x, z, clamped: false, roadWidth: nearZ.width };
  }

  return { x, z, clamped: false, roadWidth: ROAD.mainWidth };
}

export function findRoadPathAStar(graph, startX, startZ, goalX, goalZ) {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return [];

  const hasEdges = (n) => n.neighbors.length > 0;
  const startNode = findNearestRoadNode(graph, startX, startZ, hasEdges) || findNearestRoadNode(graph, startX, startZ);
  const goalNode = findNearestRoadNode(graph, goalX, goalZ, hasEdges) || findNearestRoadNode(graph, goalX, goalZ);
  if (!startNode || !goalNode) return [];
  if (startNode === goalNode) return [{ x: goalNode.x, z: goalNode.z, roadWidth: goalNode.roadWidth || ROAD.mainWidth }];

  const nodes = graph.nodes;
  const nCount = nodes.length;
  const gScore = graph._gScore;
  const fScore = graph._fScore;
  const cameFrom = graph._cameFrom;
  const state = graph._visitState;

  for (let i = 0; i < nCount; i++) {
    gScore[i] = Infinity;
    fScore[i] = Infinity;
    cameFrom[i] = -1;
    state[i] = 0;
  }

  const openList = [startNode.index];
  gScore[startNode.index] = 0;
  const initH = Math.hypot(goalNode.x - startNode.x, goalNode.z - startNode.z);
  fScore[startNode.index] = initH;
  state[startNode.index] = 1;

  let closestIdx = startNode.index;
  let closestHeuristic = initH;

  while (openList.length > 0) {
    let bestPos = 0;
    let currentIdx = openList[0];
    let bestF = fScore[currentIdx];
    for (let i = 1; i < openList.length; i++) {
      const candIdx = openList[i];
      if (fScore[candIdx] < bestF) {
        bestF = fScore[candIdx];
        currentIdx = candIdx;
        bestPos = i;
      }
    }

    openList[bestPos] = openList[openList.length - 1];
    openList.pop();

    if (currentIdx === goalNode.index) {
      closestIdx = currentIdx;
      break;
    }
    state[currentIdx] = 2;

    const curG = gScore[currentIdx];
    const neighbors = nodes[currentIdx].neighbors;
    for (let i = 0; i < neighbors.length; i++) {
      const edge = neighbors[i];
      const nb = edge.node;
      const nbIdx = nb.index;
      if (state[nbIdx] === 2) continue;

      const tentativeG = curG + edge.cost;
      if (tentativeG < gScore[nbIdx]) {
        cameFrom[nbIdx] = currentIdx;
        gScore[nbIdx] = tentativeG;
        const h = Math.hypot(goalNode.x - nb.x, goalNode.z - nb.z);
        fScore[nbIdx] = tentativeG + h;
        if (h < closestHeuristic) {
          closestHeuristic = h;
          closestIdx = nbIdx;
        }
        if (state[nbIdx] === 0) {
          state[nbIdx] = 1;
          openList.push(nbIdx);
        }
      }
    }
  }

  const path = [];
  for (let trace = closestIdx, safety = 0; trace !== -1 && safety <= nCount; safety++) {
    const nd = nodes[trace];
    path.push(IS_SCALED_WORLD ? { x: nd.x, z: nd.z, roadWidth: nd.roadWidth || ROAD.mainWidth } : { x: nd.x, z: nd.z });
    trace = cameFrom[trace];
  }
  path.reverse();
  return path;
}
