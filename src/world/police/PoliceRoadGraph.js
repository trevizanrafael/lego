import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';

/**
 * PoliceRoadGraph.js
 * Grafo viário leve em cache das avenidas da metrópole + busca de caminho A* (60 FPS).
 * Conecta cruzamentos secos ortogonais livres de prédios, incluindo rodovia do Aeroporto
 * Oeste (X = -1036, Z = 0) e Ponte Blindada da Ilha da Prisão (X = 720, Z = 520).
 */

export const NS_AVENUES_X = Object.freeze([-516, -384, -252, -120, 0, 120, 252, 384, 612]);
export const EW_AVENUES_Z = Object.freeze([-512, -382, -252, -117, 0, 134, 384, 710]);

const NORTH_EXTENSION_Z = -680;
const AIRPORT_HIGHWAY_X = Object.freeze([-690, -860, -1036]);
const PRISON_JUNCTION = Object.freeze({ x: 612, z: 520 });
const PRISON_ISLAND_NODE = Object.freeze({ x: 720, z: 520 });
const WEST_AIRBASE_SPUR = Object.freeze({ x: -690, z: -80 });

function makeCoordKey(x, z) {
  return `${Math.round(x * 10)},${Math.round(z * 10)}`;
}

function isNodeDryAndDriveable(world, x, z) {
  if (getMetroCutoutFloorY(x, z) !== null) return false;
  if (world?.isDeepWaterAt?.(x, z, { forCar: true })) return false;
  return true;
}

function isSegmentBlocked(sys, ax, az, bx, bz) {
  return typeof sys?._isSegmentBlockedByBuilding === 'function'
    ? Boolean(sys._isSegmentBlockedByBuilding(ax, az, bx, bz))
    : false;
}

function addBidirectionalEdge(graph, nodeA, nodeB, isBridge = false) {
  if (!nodeA || !nodeB || nodeA === nodeB) return;
  for (let i = 0; i < nodeA.neighbors.length; i++) {
    if (nodeA.neighbors[i].node === nodeB) return;
  }
  const dx = nodeB.x - nodeA.x;
  const dz = nodeB.z - nodeA.z;
  const cost = Math.hypot(dx, dz);
  if (cost < 1e-3) return;
  const inv = 1 / cost;
  nodeA.neighbors.push({ node: nodeB, cost, dirX: dx * inv, dirZ: dz * inv });
  nodeB.neighbors.push({ node: nodeA, cost, dirX: -dx * inv, dirZ: -dz * inv });
  graph.segments.push({ a: nodeA, b: nodeB, length: cost, dirX: dx * inv, dirZ: dz * inv, isBridge });
}

function buildSpawnSamples(world, nodes, segments) {
  const samples = [];
  const seen = new Set();
  const pushSample = (x, z, dirX = 0, dirZ = 1) => {
    const key = `${Math.round(x)},${Math.round(z)}`;
    if (seen.has(key) || !isNodeDryAndDriveable(world, x, z)) return;
    seen.add(key);
    samples.push({ x, z, dirX, dirZ });
  };

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.neighbors.length === 0) continue;
    pushSample(n.x, n.z, n.neighbors[0].dirX, n.neighbors[0].dirZ);
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.isBridge) continue;
    const steps = Math.floor(seg.length / 32.0);
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      pushSample(seg.a.x + (seg.b.x - seg.a.x) * t, seg.a.z + (seg.b.z - seg.a.z) * t, seg.dirX, seg.dirZ);
    }
  }
  return samples;
}

/**
 * Constrói o grafo viário completo da cidade filtrando água profunda e prédios AABB.
 */
export function buildPoliceRoadGraph(sys) {
  const world = sys?.world || null;
  const nodeMap = new Map();
  const nodes = [];

  const registerNode = (x, z, tag = 'grid') => {
    const key = makeCoordKey(x, z);
    if (nodeMap.has(key)) return nodeMap.get(key);
    if (!isNodeDryAndDriveable(world, x, z)) return null;
    const y = world?.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
    const node = { id: key, index: nodes.length, x, z, y, tag, neighbors: [] };
    nodeMap.set(key, node);
    nodes.push(node);
    return node;
  };

  const nsZCoords = [NORTH_EXTENSION_Z, ...EW_AVENUES_Z];
  for (let ix = 0; ix < NS_AVENUES_X.length; ix++) {
    for (let iz = 0; iz < nsZCoords.length; iz++) {
      registerNode(NS_AVENUES_X[ix], nsZCoords[iz], 'avenue');
    }
  }

  const prisonJuncNode = registerNode(PRISON_JUNCTION.x, PRISON_JUNCTION.z, 'bridge_junction');
  const prisonIslandNode = registerNode(PRISON_ISLAND_NODE.x, PRISON_ISLAND_NODE.z, 'prison_island');
  for (let i = 0; i < AIRPORT_HIGHWAY_X.length; i++) {
    registerNode(AIRPORT_HIGHWAY_X[i], 0, 'airport_highway');
  }
  const airbaseSpurNode = registerNode(WEST_AIRBASE_SPUR.x, WEST_AIRBASE_SPUR.z, 'airbase_spur');

  const graph = {
    nodes,
    segments: [],
    spawnSamples: [],
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

  for (let ix = 0; ix < NS_AVENUES_X.length; ix++) {
    const ax = NS_AVENUES_X[ix];
    const line = nodes.filter((n) => Math.abs(n.x - ax) < 0.01).sort((a, b) => a.z - b.z);
    for (let k = 0; k < line.length - 1; k++) {
      if (canConnect(line[k], line[k + 1], false)) addBidirectionalEdge(graph, line[k], line[k + 1], false);
    }
  }

  for (let iz = 0; iz < nsZCoords.length; iz++) {
    const az = nsZCoords[iz];
    const line = nodes.filter((n) => Math.abs(n.z - az) < 0.01).sort((a, b) => a.x - b.x);
    for (let k = 0; k < line.length - 1; k++) {
      if (canConnect(line[k], line[k + 1], false)) addBidirectionalEdge(graph, line[k], line[k + 1], false);
    }
  }

  const hwy690 = nodeMap.get(makeCoordKey(-690, 0));
  if (hwy690 && airbaseSpurNode && canConnect(hwy690, airbaseSpurNode, false)) {
    addBidirectionalEdge(graph, hwy690, airbaseSpurNode, false);
  }
  if (prisonJuncNode && prisonIslandNode && canConnect(prisonJuncNode, prisonIslandNode, true)) {
    addBidirectionalEdge(graph, prisonJuncNode, prisonIslandNode, true);
  }

  graph.spawnSamples = buildSpawnSamples(world, nodes, graph.segments);
  const count = nodes.length;
  graph._gScore = new Float64Array(count);
  graph._fScore = new Float64Array(count);
  graph._cameFrom = new Int32Array(count);
  graph._visitState = new Uint8Array(count);
  return graph;
}

/**
 * Garante o grafo viário em cache por instância do mundo (`sys._roadGraph`).
 */
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

/**
 * Localiza o nó de rua válido mais próximo de `(x, z)` respeitando `filterFn` opcional.
 */
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
 * Calcula o menor caminho A* pelas avenidas entre `(startX, startZ)` e `(goalX, goalZ)`.
 * Retorna array de waypoints `{ x, z }` sobre as ruas conectadas.
 */
export function findRoadPathAStar(graph, startX, startZ, goalX, goalZ) {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) return [];

  const hasEdges = (n) => n.neighbors.length > 0;
  const startNode = findNearestRoadNode(graph, startX, startZ, hasEdges) || findNearestRoadNode(graph, startX, startZ);
  const goalNode = findNearestRoadNode(graph, goalX, goalZ, hasEdges) || findNearestRoadNode(graph, goalX, goalZ);
  if (!startNode || !goalNode) return [];
  if (startNode === goalNode) return [{ x: goalNode.x, z: goalNode.z }];

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
    path.push({ x: nodes[trace].x, z: nodes[trace].z });
    trace = cameFrom[trace];
  }
  path.reverse();
  return path;
}
