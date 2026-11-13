import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial, createLegoBrick } from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries } from '../BuildingGenerator.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';

/**
 * SUPER BANCO CENTRAL — TORRE DE 4 ANDARES (X: -74..+74, Z: -229..-136)
 * ---------------------------------------------------------------------------
 * Único prédio do jogo com interior aberto, agora em 4 andares ligados por
 * RAMPAS largas (dá para subir de carro) e por um ELEVADOR [E]:
 *   1º andar (Y 0.36)  — Grande Saguão de mármore, guichês, caixas eletrônicos
 *   2º andar (Y 10.36) — Câmbio & Escritórios (mesas, computadores, sala de vidro)
 *   3º andar (Y 20.36) — Centro de Segurança (parede de monitores, armários, servidores)
 *   4º andar (Y 30.36) — COFRE: parede blindada, porta circular gigante e sala do ouro
 *   Terraço  (Y 40.96) — Heliponto, claraboia em pirâmide, jardins, antena e torres douradas
 * Rampas: R1 (oeste, 1º→2º), R2 (leste, 2º→3º), R3 (oeste, 3º→4º) — 9m de largura.
 * As laterais (X = ±82) são ocupadas pela rampa do metrô, por isso as entradas
 * ficam na FRENTE (3 portas, a central larga para carros) e no FUNDO (2 portas).
 */

export const BANK_SPEC = {
  x: 0,
  minX: -74,
  maxX: 74,
  frontZ: -136, // face externa da fachada
  backZ: -229,
  innerMinX: -71,
  innerMaxX: 71,
  innerFrontZ: -139,
  innerBackZ: -226,
  floors: [0.36, 10.36, 20.36, 30.36],
  floorHeight: 10,
  roofY: 40.96,
  wallTopY: 42.4,
  ramps: [
    // R1: 1º -> 2º (oeste), sobe indo para o fundo (-Z)
    { id: 'R1', minX: -70.6, maxX: -61.4, zLow: -146, zHigh: -196, fromFloor: 0 },
    // R2: 2º -> 3º (leste), sobe indo para a frente (+Z)
    { id: 'R2', minX: 61.4, maxX: 70.6, zLow: -196, zHigh: -146, fromFloor: 1 },
    // R3: 3º -> 4º (oeste)
    { id: 'R3', minX: -70.6, maxX: -61.4, zLow: -146, zHigh: -196, fromFloor: 2 }
  ],
  elevator: { minX: 52, maxX: 60, minZ: -150, maxZ: -142, callX: 48.6, callZ: -146 },
  vaultWallZ: -206,
  vaultDoorHalfW: 6,
  goldPile: { x: 0, z: -215 }
};

const FLOOR_T = 0.6;

function rampY(ramp, z) {
  const base = BANK_SPEC.floors[ramp.fromFloor];
  const t = THREE.MathUtils.clamp((z - ramp.zLow) / (ramp.zHigh - ramp.zLow), 0, 1);
  return base + t * BANK_SPEC.floorHeight;
}

/** Buracos nas lajes por onde as rampas chegam */
function holeForFloor(floorIdx) {
  // A laje do andar N tem buraco sobre a rampa que chega nela (fromFloor = N-1)
  return BANK_SPEC.ramps.find((r) => r.fromFloor === floorIdx - 1) || null;
}

function insideRect(x, z, r, pad = 0) {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= Math.min(r.zLow, r.zHigh) - pad && z <= Math.max(r.zLow, r.zHigh) + pad;
}

// ----------------------------------------------------------------------------
// Lote de geometria por material (poucas draw calls)
// ----------------------------------------------------------------------------
class Batcher {
  constructor() {
    this.mats = new Map();
    this.geos = new Map();
  }

  mat(key, factory) {
    if (!this.mats.has(key)) this.mats.set(key, factory());
    return key;
  }

  _push(key, geo) {
    if (!this.geos.has(key)) this.geos.set(key, []);
    this.geos.get(key).push(geo);
  }

  box(key, w, h, d, x, y, z, rotY = 0, rotX = 0, rotZ = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotZ) g.rotateZ(rotZ);
    if (rotX) g.rotateX(rotX);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y, z);
    this._push(key, g);
  }

  cyl(key, rt, rb, h, x, y, z, seg = 16, rotX = 0, rotZ = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rotX) g.rotateX(rotX);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    this._push(key, g);
  }

  sphere(key, r, x, y, z, sy = 1, phiLen = Math.PI * 2, thetaLen = Math.PI) {
    const g = new THREE.SphereGeometry(r, 18, 12, 0, phiLen, 0, thetaLen);
    g.scale(1, sy, 1);
    g.translate(x, y, z);
    this._push(key, g);
  }

  cone(key, r, h, x, y, z, seg = 4) {
    const g = new THREE.ConeGeometry(r, h, seg);
    if (seg === 4) g.rotateY(Math.PI / 4);
    g.translate(x, y, z);
    this._push(key, g);
  }

  flush(scene, noShadowKeys = new Set()) {
    for (const [key, list] of this.geos) {
      if (!list.length) continue;
      const merged = mergeBufferGeometries(list);
      const mesh = new THREE.Mesh(merged, this.mats.get(key));
      mesh.castShadow = !noShadowKeys.has(key);
      mesh.receiveShadow = true;
      mesh.name = `bank_${key}`;
      scene.add(mesh);
    }
    this.geos.clear();
  }
}

export function buildSuperBancoCentral(world) {
  const S = BANK_SPEC;
  const B = new Batcher();
  const scene = world.scene;

  // ---- Paleta de materiais
  B.mat('marble', () => getLegoMaterial(0xf8fafc, { roughness: 0.12, metalness: 0.06, clearcoat: 0.88 }));
  B.mat('cream', () => getLegoMaterial(0xfef3c7, { roughness: 0.18, metalness: 0.05, clearcoat: 0.72 }));
  B.mat('granite', () => getLegoMaterial(0x1e293b, { roughness: 0.24, metalness: 0.18, clearcoat: 0.55 }));
  B.mat('graniteBlack', () => getLegoMaterial(0x0b0f17, { roughness: 0.2, metalness: 0.25, clearcoat: 0.7 }));
  B.mat('gold', () => getLegoMaterial(0xfacc15, { roughness: 0.16, metalness: 0.78, clearcoat: 0.7 }));
  B.mat('steel', () => getLegoMaterial(0x334155, { roughness: 0.28, metalness: 0.65 }));
  B.mat('steelDark', () => getLegoMaterial(0x0f172a, { roughness: 0.25, metalness: 0.7 }));
  B.mat('chrome', () => getLegoMaterial(0xcbd5e1, { roughness: 0.12, metalness: 0.85 }));
  B.mat('velvet', () => getLegoMaterial(0xb91c1c, { roughness: 0.55, clearcoat: 0.2 }));
  B.mat('carpetBlue', () => getLegoMaterial(0x1e3a8a, { roughness: 0.6, clearcoat: 0.1 }));
  B.mat('wood', () => getLegoMaterial(0x7c4a1e, { roughness: 0.4 }));
  B.mat('black', () => getLegoMaterial(0x111827, { roughness: 0.3 }));
  B.mat('white', () => getLegoMaterial(0xf1f5f9, { roughness: 0.3 }));
  B.mat('plant', () => getLegoMaterial(0x16a34a, { roughness: 0.4 }));
  B.mat('pot', () => getLegoMaterial(0x92400e, { roughness: 0.45 }));
  B.mat('cash', () => getLegoMaterial(0x22c55e, { roughness: 0.5 }));
  B.mat('concrete', () => getLegoMaterial(0x64748b, { roughness: 0.5 }));
  B.mat('yellowLine', () => getLegoMaterial(0xfacc15, { roughness: 0.4 }));
  B.mat('glass', () =>
    new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      roughness: 0.05,
      metalness: 0.2,
      clearcoat: 1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    })
  );
  B.mat('windowGlass', () =>
    getLegoMaterial(0x1d4ed8, { roughness: 0.06, metalness: 0.55, clearcoat: 1 })
  );
  B.mat('lightPanel', () => new THREE.MeshBasicMaterial({ color: 0xfff7d6 }));
  B.mat('screen', () => new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  B.mat('screenGreen', () => new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
  B.mat('ledRed', () => new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  B.mat('laser', () => new THREE.MeshBasicMaterial({ color: 0xff1f1f, transparent: true, opacity: 0.75 }));

  const noShadow = new Set(['glass', 'lightPanel', 'screen', 'screenGreen', 'ledRed', 'laser']);

  // Calçada nobre ao redor (até as praças do metrô em X = ±77)
  world._addCityBlockSidewalk(S.x, (S.frontZ + S.backZ) / 2 + 1, 152, 100, LEGO_COLORS.sidewalk);

  buildExteriorShell(world, B);
  buildFloorsRampsAndElevator(world, B);
  buildGroundLobby(world, B);
  buildOfficeFloor(world, B);
  buildSecurityFloor(world, B);
  const vault = buildVaultFloor(world, B);
  buildRooftop(world, B);

  B.flush(scene, noShadow);

  const gates = buildRampGates(world);
  const elevator = createBankElevator(world);

  // Registra o banco no Mapa 2D [M] e Radar (1 entrada só — as paredes não aparecem soltas)
  world.mapBuildings.push({
    x: S.x,
    z: (S.frontZ + S.backZ) / 2,
    w: S.maxX - S.minX,
    d: S.frontZ - S.backZ,
    height: S.wallTopY + 6,
    styleKey: 'black_granite_gold',
    color: '#facc15',
    label: 'BANCO CENTRAL'
  });

  world.bankElevator = elevator;
  world.superBankData = {
    x: S.x,
    z: (S.frontZ + S.backZ) / 2,
    width: S.maxX - S.minX,
    depth: S.frontZ - S.backZ,
    floorsCount: 4,
    floors: [...S.floors],
    interiorHeight: S.roofY - S.floors[0],
    roofTopY: S.roofY,
    frontColumnsCount: 8,
    goldenStatuesCount: 2,
    hasSkylight: true,
    hasRooftopHelipad: true,
    rampsCount: S.ramps.length,
    hasElevator: true,
    vaultFloor: 3,
    vaultDoor: vault.vaultDoor,
    goldPile: { x: S.goldPile.x, y: S.floors[3], z: S.goldPile.z },
    gates,
    setGateOpen(idx, open) {
      const g = gates[idx];
      if (!g) return;
      g.open = open;
      g.collider.disabled = open;
    },
    setAllGates(open) {
      gates.forEach((g, i) => this.setGateOpen(i, open));
    },
    isInside(x, y, z) {
      return x > S.innerMinX && x < S.innerMaxX && z < S.innerFrontZ && z > S.innerBackZ && y < S.roofY - 0.5;
    },
    floorAt(y) {
      let idx = 0;
      for (let i = 0; i < S.floors.length; i++) if (y >= S.floors[i] - 1.5) idx = i;
      return idx;
    },
    update(dt) {
      for (const g of gates) {
        const target = g.open ? g.floorY - 4.2 : g.floorY + 2.2;
        g.mesh.position.y += (target - g.mesh.position.y) * Math.min(1, dt * 4);
        g.mesh.visible = g.mesh.position.y > g.floorY - 4.0;
      }
      elevator.update(dt);
    }
  };
}

// ============================================================================
// 1. CASCA EXTERNA: fachada clássica + torre de 4 andares
// ============================================================================
function buildExteriorShell(world, B) {
  const S = BANK_SPEC;
  const T = 3; // espessura das paredes
  const top = S.wallTopY;
  const fz = S.frontZ - T / 2; // centro da parede frontal (-137.5)
  const bz = S.backZ + T / 2; // centro da parede de fundo (-227.5)
  const sxW = S.minX + T / 2; // -72.5
  const sxE = S.maxX - T / 2; // +72.5
  const depth = S.frontZ - S.backZ;
  const midZ = (S.frontZ + S.backZ) / 2;
  const F = S.floors;

  const wall = (x, z, w, d, y0, y1, mat = 'cream') => {
    B.box(mat, w, y1 - y0, d, x, (y0 + y1) / 2, z);
    world.addCollider(x, z, w, d, y1, y0);
  };

  // --- Paredes laterais (inteiras: o metrô passa do lado de fora)
  wall(sxW, midZ, T, depth, 0, top);
  wall(sxE, midZ, T, depth, 0, top);

  // --- Fachada frontal: 1º andar com 3 portas; acima, parede inteira
  const frontDoors = [
    { x0: -14, x1: 14, h: 8.6 }, // portal central (carros)
    { x0: -52, x1: -40, h: 6.4 },
    { x0: 40, x1: 52, h: 6.4 }
  ];
  const segs = [
    [S.minX, -52],
    [-40, -14],
    [14, 40],
    [52, S.maxX]
  ];
  for (const [a, b] of segs) wall((a + b) / 2, fz, b - a, T, 0, F[1]);
  for (const d of frontDoors) {
    wall((d.x0 + d.x1) / 2, fz, d.x1 - d.x0, T, F[0] + d.h, F[1]);
    // Moldura dourada das portas
    B.box('gold', d.x1 - d.x0 + 1.2, 0.6, T + 0.6, (d.x0 + d.x1) / 2, F[0] + d.h + 0.3, fz);
    B.box('gold', 0.6, d.h, T + 0.6, d.x0 - 0.3, F[0] + d.h / 2, fz);
    B.box('gold', 0.6, d.h, T + 0.6, d.x1 + 0.3, F[0] + d.h / 2, fz);
    // Portas de vidro abertas (folhas encostadas para dentro)
    const leafW = (d.x1 - d.x0) / 4;
    B.box('glass', leafW, d.h - 0.6, 0.25, d.x0 + leafW / 2 + 0.3, F[0] + d.h / 2, fz - T / 2 - leafW / 2, Math.PI / 2);
    B.box('glass', leafW, d.h - 0.6, 0.25, d.x1 - leafW / 2 - 0.3, F[0] + d.h / 2, fz - T / 2 - leafW / 2, Math.PI / 2);
  }
  wall(0, fz, S.maxX - S.minX, T, F[1], top);

  // --- Fachada do fundo: 2 portas de serviço
  const backSegs = [
    [S.minX, -36],
    [-24, 24],
    [36, S.maxX]
  ];
  for (const [a, b] of backSegs) wall((a + b) / 2, bz, b - a, T, 0, F[1]);
  for (const x0 of [-36, 24]) {
    wall(x0 + 6, bz, 12, T, F[0] + 6.4, F[1]);
    B.box('gold', 13.2, 0.6, T + 0.6, x0 + 6, F[0] + 6.7, bz);
  }
  wall(0, bz, S.maxX - S.minX, T, F[1], top);

  // --- Rodapé de granito escuro + faixas douradas entre os andares
  B.box('granite', S.maxX - S.minX + 1.4, 1.4, 0.8, 0, 0.7, S.frontZ + 0.2);
  B.box('granite', S.maxX - S.minX + 1.4, 1.4, 0.8, 0, 0.7, S.backZ - 0.2);
  B.box('granite', 0.8, 1.4, depth + 1.4, S.minX - 0.2, 0.7, midZ);
  B.box('granite', 0.8, 1.4, depth + 1.4, S.maxX + 0.2, 0.7, midZ);
  for (let i = 1; i <= 4; i++) {
    const y = i < 4 ? F[i] : S.roofY;
    B.box('gold', S.maxX - S.minX + 1.6, 0.55, 1.0, 0, y, S.frontZ + 0.3);
    B.box('gold', S.maxX - S.minX + 1.6, 0.55, 1.0, 0, y, S.backZ - 0.3);
    B.box('gold', 1.0, 0.55, depth + 1.6, S.minX - 0.3, y, midZ);
    B.box('gold', 1.0, 0.55, depth + 1.6, S.maxX + 0.3, y, midZ);
  }

  // --- Janelas: grade de vidro azul com caixilho dourado em todos os andares de cima
  const addWindowRow = (axis, fixed, from, to, y0, outward) => {
    const span = to - from;
    const n = Math.floor(span / 6.5);
    const step = span / n;
    for (let i = 0; i < n; i++) {
      const c = from + step * (i + 0.5);
      const w = step - 2.2;
      const h = 6.2;
      const yc = y0 + 4.6;
      if (axis === 'z') {
        B.box('windowGlass', w, h, 0.3, c, yc, fixed + outward * 0.1);
        B.box('gold', w + 0.6, 0.35, 0.5, c, yc - h / 2 - 0.15, fixed + outward * 0.2);
        B.box('cream', 0.5, h, 0.6, c - w / 2 - 0.25, yc, fixed + outward * 0.25);
      } else {
        B.box('windowGlass', 0.3, h, w, fixed + outward * 0.1, yc, c);
        B.box('gold', 0.5, 0.35, w + 0.6, fixed + outward * 0.2, yc - h / 2 - 0.15, c);
        B.box('cream', 0.6, h, 0.5, fixed + outward * 0.25, yc, c - w / 2 - 0.25);
      }
    }
  };
  for (let f = 1; f < 4; f++) {
    addWindowRow('z', S.frontZ, S.minX + 4, S.maxX - 4, F[f], 1);
    addWindowRow('z', S.backZ, S.minX + 4, S.maxX - 4, F[f], -1);
    addWindowRow('x', S.minX, S.backZ + 4, S.frontZ - 4, F[f], -1);
    addWindowRow('x', S.maxX, S.backZ + 4, S.frontZ - 4, F[f], 1);
  }
  // Janelas do térreo nas laterais e no fundo
  addWindowRow('x', S.minX, S.backZ + 4, S.frontZ - 4, F[0] + 0.4, -1);
  addWindowRow('x', S.maxX, S.backZ + 4, S.frontZ - 4, F[0] + 0.4, 1);

  // --- 4 Torres de canto (pilastras largas com cúpula dourada)
  for (const cx of [S.minX - 1, S.maxX + 1]) {
    for (const cz of [S.frontZ + 1, S.backZ - 1]) {
      B.box('marble', 6, top + 3, 6, cx, (top + 3) / 2, cz);
      world.addCollider(cx, cz, 6, 6, top + 3, 0);
      for (let f = 0; f < 4; f++) B.box('gold', 6.6, 0.6, 6.6, cx, F[f] + 9.6, cz);
      B.box('granite', 7.2, 1.2, 7.2, cx, top + 3.6, cz);
      B.sphere('gold', 3.2, cx, top + 4.2, cz, 1.1, Math.PI * 2, Math.PI / 2);
      B.cyl('gold', 0.18, 0.18, 3.4, cx, top + 9.2, cz, 8);
      B.sphere('gold', 0.55, cx, top + 11.1, cz);
    }
  }

  // --- Escadaria frontal larga (3 degraus rasos — carros passam por cima)
  for (let s = 0; s < 3; s++) {
    B.box(s === 2 ? 'marble' : 'cream', S.maxX - S.minX - 4 - s * 2, 0.14 + s * 0.12, 1.8, 0, 0.07 + s * 0.06, S.frontZ + 4.2 - s * 1.6);
  }
  B.box('velvet', 26, 0.06, 6.6, 0, 0.33, S.frontZ + 3.1);

  // --- Colunata clássica: 8 colunas gigantes até o 3º andar + entablamento + frontão
  const colZ = S.frontZ + 2.6;
  const colTop = F[3] - 0.4;
  const colXs = [-66, -58, -34, -20, 20, 34, 58, 66];
  for (const cx of colXs) {
    B.box('granite', 4.2, 1.4, 4.2, cx, 0.7, colZ);
    B.cyl('marble', 1.55, 1.75, colTop - 1.4, cx, 1.4 + (colTop - 1.4) / 2, colZ, 20);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      B.box('cream', 0.32, colTop - 2.4, 0.32, cx + Math.cos(a) * 1.62, 1.4 + (colTop - 1.4) / 2, colZ + Math.sin(a) * 1.62);
    }
    B.box('gold', 4.4, 1.2, 4.4, cx, colTop + 0.2, colZ);
    world.addCollider(cx, colZ, 3.4, 3.4, colTop, 0);
  }
  // Entablamento apoiado nas colunas
  B.box('marble', S.maxX - S.minX + 4, 2.6, 6.2, 0, colTop + 2.1, colZ - 0.6);
  B.box('gold', S.maxX - S.minX + 4.4, 0.5, 6.6, 0, colTop + 0.9, colZ - 0.6);
  B.box('gold', S.maxX - S.minX + 4.4, 0.5, 6.6, 0, colTop + 3.5, colZ - 0.6);
  // Frontão triangular com moeda dourada
  const pedBase = colTop + 3.8;
  for (let i = 0; i < 6; i++) {
    const w = 82 - i * 13;
    B.box('cream', w, 1.4, 3, 0, pedBase + 0.7 + i * 1.4, colZ - 1.2);
  }
  B.cyl('gold', 3.4, 3.4, 0.8, 0, pedBase + 4.4, colZ + 0.5, 28, Math.PI / 2);
  B.cyl('granite', 2.4, 2.4, 0.9, 0, pedBase + 4.4, colZ + 0.6, 28, Math.PI / 2);
  B.box('gold', 0.6, 3.2, 1.0, 0, pedBase + 4.4, colZ + 1.0);

  // Letreiro no entablamento
  const signBoard = createSignBoardMesh({
    x: 0,
    y: colTop + 2.1,
    z: colZ + 2.55,
    width: 52,
    height: 2.2,
    depth: 0.4,
    title: 'SUPER BANCO CENTRAL',
    bgColor: '#090a0d',
    borderColor: '#facc15',
    textColor: '#facc15',
    doubleSided: false
  });
  world.scene.add(signBoard);

  // --- 2 Estátuas douradas de guardião LEGO nas pontas da escadaria
  // (entre as colunas de ±20 e ±34, onde a fachada não tem porta)
  for (const side of [-1, 1]) buildGoldenGuardianStatue(world, B, side * 27, S.frontZ + 3.4);
}

function buildGoldenGuardianStatue(world, B, x, z) {
  B.box('granite', 4.6, 2.2, 4.6, x, 1.1, z);
  B.box('gold', 2.0, 1.6, 1.2, x, 3.0, z); // pernas
  B.box('gold', 2.2, 1.8, 1.2, x, 4.7, z); // tronco
  B.cyl('gold', 0.7, 0.7, 1.2, x, 6.2, z, 16); // cabeça
  B.cyl('gold', 0.3, 0.3, 0.3, x, 6.95, z, 10); // pino
  B.box('gold', 0.5, 1.8, 0.5, x - 1.4, 4.9, z); // braço c/ cetro
  B.cyl('gold', 0.12, 0.12, 5.2, x - 1.4, 5.6, z + 0.4, 8);
  B.sphere('gold', 0.45, x - 1.4, 8.3, z + 0.4);
  B.box('gold', 1.6, 2.2, 0.3, x + 1.5, 4.6, z + 0.4); // escudo
  world.addCollider(x, z, 4.6, 4.6, 7.2, 0);
}

// ============================================================================
// 2. LAJES DOS ANDARES, RAMPAS (com corrimão) E NÚCLEO DO ELEVADOR
// ============================================================================
function buildFloorsRampsAndElevator(world, B) {
  const S = BANK_SPEC;
  const W = S.innerMaxX - S.innerMinX;
  const D = S.innerFrontZ - S.innerBackZ;
  const midZ = (S.innerFrontZ + S.innerBackZ) / 2;

  S.floors.forEach((fy, idx) => {
    const hole = holeForFloor(idx);
    // Pisos (piso andável)
    world.elevatedDecks.push({
      id: `bank_floor_${idx + 1}`,
      minX: S.innerMinX,
      maxX: S.innerMaxX,
      minZ: S.innerBackZ,
      maxZ: S.innerFrontZ,
      thresholdBelow: 2.4,
      getDeckY: (x, z) => (hole && insideRect(x, z, hole, -0.15) ? null : fy)
    });

    if (idx > 0) {
      // Laje visível (em pedaços em volta do buraco da rampa)
      const slabY = fy - FLOOR_T / 2;
      const floorKey = idx === 1 ? 'carpetBlue' : idx === 2 ? 'concrete' : 'graniteBlack';
      if (hole) {
        const hz0 = Math.min(hole.zLow, hole.zHigh);
        const hz1 = Math.max(hole.zLow, hole.zHigh);
        const westHole = hole.minX < 0;
        // Faixa larga ao lado do buraco
        const restX0 = westHole ? hole.maxX : S.innerMinX;
        const restX1 = westHole ? S.innerMaxX : hole.minX;
        B.box(floorKey, restX1 - restX0, FLOOR_T, D, (restX0 + restX1) / 2, slabY, midZ);
        // Frente e fundo do buraco
        B.box(floorKey, hole.maxX - hole.minX, FLOOR_T, S.innerFrontZ - hz1, (hole.minX + hole.maxX) / 2, slabY, (S.innerFrontZ + hz1) / 2);
        B.box(floorKey, hole.maxX - hole.minX, FLOOR_T, hz0 - S.innerBackZ, (hole.minX + hole.maxX) / 2, slabY, (hz0 + S.innerBackZ) / 2);
        // Corrimão em volta do buraco (menos na chegada da rampa)
        const railX = westHole ? hole.maxX : hole.minX;
        const arrivalZ = hole.zHigh;
        const otherZ = hole.zLow;
        B.box('chrome', 0.3, 1.1, hz1 - hz0, railX, fy + 0.55, (hz0 + hz1) / 2);
        B.box('gold', 0.4, 0.14, hz1 - hz0, railX, fy + 1.12, (hz0 + hz1) / 2);
        world.addCollider(railX, (hz0 + hz1) / 2, 0.5, hz1 - hz0, fy + 1.3, fy - 0.2);
        B.box('chrome', hole.maxX - hole.minX, 1.1, 0.3, (hole.minX + hole.maxX) / 2, fy + 0.55, otherZ);
        world.addCollider((hole.minX + hole.maxX) / 2, otherZ, hole.maxX - hole.minX, 0.5, fy + 1.3, fy - 0.2);
        void arrivalZ;
      } else {
        B.box(floorKey, W, FLOOR_T, D, 0, slabY, midZ);
      }
      // Forro com painéis de luz do andar de baixo
      for (let lx = -56; lx <= 56; lx += 16) {
        for (let lz = -150; lz >= -218; lz -= 17) {
          if (hole && insideRect(lx, lz, hole, 2)) continue;
          B.box('lightPanel', 5.5, 0.12, 2.4, lx, fy - FLOOR_T - 0.08, lz);
        }
      }
    }
  });

  // Teto do 4º andar (laje da cobertura)
  B.box('cream', W, 1.2, D, 0, S.roofY - 0.6, midZ);
  for (let lx = -56; lx <= 56; lx += 16) {
    for (let lz = -150; lz >= -218; lz -= 17) B.box('lightPanel', 5.5, 0.12, 2.4, lx, S.roofY - 1.26, lz);
  }

  // Rampas largas (andáveis e dirigíveis)
  for (const r of S.ramps) {
    const zl = r.zLow;
    const zh = r.zHigh;
    const len = Math.abs(zh - zl);
    const y0 = rampY(r, zl);
    const y1 = rampY(r, zh);
    const ang = Math.atan2(y1 - y0, len);
    const midRz = (zl + zh) / 2;
    const cx = (r.minX + r.maxX) / 2;
    const w = r.maxX - r.minX;
    const dir = zh < zl ? 1 : -1; // inclinação no eixo X local
    B.box('granite', w, 0.45, Math.hypot(len, y1 - y0), cx, (y0 + y1) / 2 - 0.25, midRz, 0, dir * ang);
    // Faixas amarelas de segurança na rampa
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.5) / 6;
      const z = zl + (zh - zl) * t;
      B.box('yellowLine', w - 1.2, 0.06, 0.5, cx, rampY(r, z) + 0.02, z);
    }
    world.elevatedDecks.push({
      id: `bank_ramp_${r.id}`,
      minX: r.minX,
      maxX: r.maxX,
      minZ: Math.min(zl, zh),
      maxZ: Math.max(zl, zh),
      thresholdBelow: 1.6,
      getDeckY: (x, z) => rampY(r, z)
    });
    // Parede de apoio + corrimão no lado de dentro (segmentos para colisão)
    const innerX = r.minX < 0 ? r.maxX + 0.25 : r.minX - 0.25;
    const segs = 10;
    for (let k = 0; k < segs; k++) {
      const za = zl + ((zh - zl) * k) / segs;
      const zb = zl + ((zh - zl) * (k + 1)) / segs;
      const ya = rampY(r, za);
      const yb = rampY(r, zb);
      const ymax = Math.max(ya, yb);
      const base = S.floors[r.fromFloor];
      const zc = (za + zb) / 2;
      const segLen = Math.abs(zb - za);
      B.box('marble', 0.5, ymax - base, segLen, innerX, base + (ymax - base) / 2, zc);
      B.box('chrome', 0.25, 1.0, segLen, innerX, ymax + 0.5, zc);
      world.addCollider(innerX, zc, 0.5, segLen, ymax + 1.1, base);
    }
    B.box('gold', 0.4, 0.14, len, innerX, (y0 + y1) / 2 + 1.05, midRz, 0, dir * ang);
  }

  // Núcleo do elevador (do térreo ao terraço) com portas em cada andar
  const E = S.elevator;
  const ex = (E.minX + E.maxX) / 2;
  const ez = (E.minZ + E.maxZ) / 2;
  B.box('graniteBlack', E.maxX - E.minX, S.roofY, E.maxZ - E.minZ, ex, S.roofY / 2, ez);
  world.addCollider(ex, ez, E.maxX - E.minX, E.maxZ - E.minZ, S.roofY, 0);
  for (const fy of S.floors) {
    B.box('chrome', 0.3, 5.0, 3.0, E.minX - 0.15, fy + 2.5, ez - 1.55);
    B.box('chrome', 0.3, 5.0, 3.0, E.minX - 0.15, fy + 2.5, ez + 1.55);
    B.box('gold', 0.4, 0.5, 6.8, E.minX - 0.2, fy + 5.3, ez);
    B.box('screen', 0.2, 0.6, 1.4, E.minX - 0.3, fy + 6.0, ez);
    B.box('gold', 0.25, 0.5, 0.35, E.minX - 0.25, fy + 1.5, ez + 3.6);
    // Marca amarela no chão ([E] chamar elevador)
    B.box('yellowLine', 3.2, 0.04, 4.0, E.callX, fy + 0.03, E.callZ);
  }
}

// ============================================================================
// 3. 1º ANDAR — GRANDE SAGUÃO
// ============================================================================
function buildGroundLobby(world, B) {
  const S = BANK_SPEC;
  const fy = S.floors[0];

  // Piso de mármore quadriculado + tapete vermelho central
  B.box('marble', S.innerMaxX - S.innerMinX, fy, S.innerFrontZ - S.innerBackZ, 0, fy / 2, (S.innerFrontZ + S.innerBackZ) / 2);
  for (let tx = -66; tx <= 66; tx += 6) {
    for (let tz = -142; tz >= -224; tz -= 6) {
      const ix = Math.round((tx + 66) / 6);
      const iz = Math.round((-142 - tz) / 6);
      if ((ix + iz) % 2 === 0) B.box('cream', 5.85, 0.04, 5.85, tx, fy + 0.01, tz);
    }
  }
  B.box('velvet', 10, 0.05, 56, 0, fy + 0.04, -168);
  B.box('gold', 10.6, 0.04, 56.6, 0, fy + 0.025, -168);
  // Brasão dourado no piso
  B.cyl('gold', 6, 6, 0.05, 0, fy + 0.07, -160, 32);
  B.cyl('graniteBlack', 4.8, 4.8, 0.06, 0, fy + 0.08, -160, 32);
  B.box('gold', 0.8, 0.07, 6, 0, fy + 0.1, -160);

  // 8 colunas internas de mármore (quebráveis)
  const pillarPositions = [
    [-44, -158], [44, -158], [-44, -184], [44, -184],
    [-22, -158], [22, -158], [-22, -184], [22, -184]
  ];
  for (const [px, pz] of pillarPositions) {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 9.2, 18), getLegoMaterial(0xf8fafc, { roughness: 0.12, clearcoat: 0.88 }));
    shaft.position.y = 4.6;
    const cap = createLegoBrick(3.0, 0.8, 3.0, LEGO_COLORS.gold, { metalness: 0.7, roughness: 0.18, studStep: 0.75 });
    cap.position.y = 9.5;
    const base = createLegoBrick(3.0, 0.8, 3.0, 0x1e293b, { studs: false });
    base.position.y = 0.4;
    group.add(shaft, cap, base);
    group.position.set(px, fy, pz);
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    world.scene.add(group);
    const col = world.addCollider(px, pz, 2.4, 2.4, fy + 9.9, fy);
    world.destructibles?.registerDestructible({
      mesh: group,
      type: 'marble_pillar',
      hp: 140,
      radius: 1.6,
      height: 9.9,
      colliders: [col],
      debrisColors: [LEGO_COLORS.white, 0xfef3c7, LEGO_COLORS.gold],
      studDrops: { silver: 6, gold: 4, blue: 1, purple: 0 },
      groundY: fy
    });
  }

  // Guichês: balcão longo com vidros e 8 computadores
  const cz = -200;
  B.box('wood', 84, 1.3, 2.4, 0, fy + 0.65, cz);
  B.box('marble', 85, 0.2, 2.8, 0, fy + 1.4, cz);
  world.addCollider(0, cz, 84, 2.4, fy + 1.5, fy);
  for (let i = 0; i < 8; i++) {
    const x = -36.75 + i * 10.5;
    B.box('glass', 9.4, 2.6, 0.2, x, fy + 2.8, cz + 1.1);
    B.box('gold', 0.3, 2.8, 0.4, x - 5.1, fy + 2.8, cz + 1.1);
    B.box('black', 1.4, 1.0, 0.25, x, fy + 2.1, cz - 0.5);
    B.box('screenGreen', 1.2, 0.8, 0.05, x, fy + 2.1, cz - 0.36);
    B.box('ledRed', 0.4, 0.3, 0.3, x + 3.6, fy + 1.65, cz + 0.6); // botão de alarme
  }
  B.box('gold', 0.3, 2.8, 0.4, 47.25, fy + 2.8, cz + 1.1);
  // Placa "GUICHÊS"
  B.box('graniteBlack', 30, 2.2, 0.4, 0, fy + 7.4, cz - 1.0);
  B.box('gold', 30.6, 0.3, 0.5, 0, fy + 6.25, cz - 1.0);

  // Parede de caixas eletrônicos (lado leste, perto da entrada)
  for (let i = 0; i < 5; i++) {
    const z = -152 - i * 4.2;
    B.box('steel', 1.6, 3.2, 2.6, 46, fy + 1.6, z);
    B.box('screen', 0.06, 0.9, 1.4, 45.18, fy + 2.3, z);
    B.box('gold', 0.1, 0.3, 2.6, 45.15, fy + 3.05, z);
    world.addCollider(46, z, 1.6, 2.6, fy + 3.2, fy);
  }

  // Recepção circular "INFORMAÇÕES"
  B.cyl('wood', 4.2, 4.2, 1.3, -30, fy + 0.65, -148, 24);
  B.cyl('marble', 4.5, 4.5, 0.2, -30, fy + 1.4, -148, 24);
  world.addCollider(-30, -148, 8, 8, fy + 1.5, fy);

  // Bancos de espera, plantas e cordões de fila
  for (const bx of [-12, 12]) {
    for (let r = 0; r < 3; r++) {
      const z = -170 - r * 5;
      B.box('wood', 9, 0.5, 1.6, bx, fy + 0.9, z);
      B.box('wood', 9, 1.4, 0.3, bx, fy + 1.6, z - 0.75);
      B.box('steel', 0.3, 0.7, 1.2, bx - 4, fy + 0.35, z);
      B.box('steel', 0.3, 0.7, 1.2, bx + 4, fy + 0.35, z);
    }
  }
  for (let i = 0; i < 6; i++) {
    const x = -15 + i * 6;
    B.cyl('gold', 0.18, 0.25, 2.0, x, fy + 1.0, -194, 10);
    B.sphere('gold', 0.3, x, fy + 2.1, -194);
    if (i < 5) B.box('velvet', 5.6, 0.2, 0.2, x + 3, fy + 1.7, -194);
  }
  addPlant(B, -66, fy, -142);
  addPlant(B, 66, fy, -142);
  addPlant(B, -56, fy, -222);
  addPlant(B, 56, fy, -222);

  // Lustres dourados pendurados no teto do térreo
  for (const [lx, lz] of [[-30, -168], [0, -176], [30, -168]]) {
    B.cyl('gold', 0.12, 0.12, 1.6, lx, S.floors[1] - 1.4, lz, 8);
    B.cyl('gold', 2.4, 1.2, 0.9, lx, S.floors[1] - 2.6, lz, 16);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      B.sphere('lightPanel', 0.35, lx + Math.cos(a) * 2.2, S.floors[1] - 3.2, lz + Math.sin(a) * 2.2);
    }
  }

  // Câmeras e sirenes vermelhas (perto das rampas e do elevador)
  for (const [ax, az] of [[-60, -144], [60, -144], [0, -224]]) {
    B.box('white', 0.9, 0.7, 1.6, ax, S.floors[1] - 1.5, az);
    B.box('ledRed', 0.9, 0.5, 0.5, ax, S.floors[1] - 2.2, az + 0.9);
  }
}

function addPlant(B, x, y, z) {
  B.cyl('pot', 1.1, 0.8, 1.6, x, y + 0.8, z, 12);
  B.sphere('plant', 1.6, x, y + 2.8, z, 1.3);
  B.sphere('plant', 1.1, x + 0.6, y + 4.2, z - 0.3, 1.2);
}

// ============================================================================
// 4. 2º ANDAR — CÂMBIO & ESCRITÓRIOS
// ============================================================================
function buildOfficeFloor(world, B) {
  const S = BANK_SPEC;
  const fy = S.floors[1];
  // Fileiras de mesas com computadores (baixas: servem de cobertura)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = -40 + col * 16;
      const z = -154 - row * 13;
      B.box('white', 6.4, 0.25, 3.2, x, fy + 1.2, z);
      B.box('steel', 0.3, 1.2, 3.0, x - 3.0, fy + 0.6, z);
      B.box('steel', 0.3, 1.2, 3.0, x + 3.0, fy + 0.6, z);
      B.box('black', 1.6, 1.1, 0.2, x - 1.4, fy + 1.9, z - 0.9);
      B.box('screen', 1.4, 0.9, 0.05, x - 1.4, fy + 1.9, z - 0.78);
      B.box('black', 1.6, 1.1, 0.2, x + 1.4, fy + 1.9, z - 0.9);
      B.box('screen', 1.4, 0.9, 0.05, x + 1.4, fy + 1.9, z - 0.78);
      B.box('carpetBlue', 6.6, 1.6, 0.25, x, fy + 2.1, z - 1.7); // divisória
      B.box('black', 1.1, 0.9, 1.1, x - 1.4, fy + 0.45, z + 2.0); // cadeiras
      B.box('black', 1.1, 0.9, 1.1, x + 1.4, fy + 0.45, z + 2.0);
      world.addCollider(x, z, 6.4, 3.4, fy + 1.4, fy);
    }
  }
  // Sala de reunião de vidro (fundo)
  B.box('glass', 30, 6, 0.3, 0, fy + 3, -206);
  B.box('glass', 0.3, 6, 14, -15, fy + 3, -213);
  B.box('glass', 0.3, 6, 14, 15, fy + 3, -213);
  B.box('wood', 18, 0.4, 5, 0, fy + 1.4, -214);
  B.box('gold', 30.4, 0.3, 0.4, 0, fy + 6.1, -206);
  // Balcão de câmbio com painel de cotações
  B.box('wood', 30, 1.3, 2.4, 0, fy + 0.65, -144.5);
  world.addCollider(0, -144.5, 30, 2.4, fy + 1.4, fy);
  B.box('graniteBlack', 24, 3.2, 0.4, 0, fy + 6.5, -140.4);
  for (let i = 0; i < 6; i++) B.box(i % 2 ? 'screenGreen' : 'ledRed', 3.0, 0.5, 0.1, -9 + i * 3.6, fy + 6.5, -140.15);
  // Arquivos e plantas
  for (let i = 0; i < 6; i++) B.box('steel', 2.2, 3.2, 1.4, -30 + i * 2.4, fy + 1.6, -224.5);
  addPlant(B, 30, fy, -224);
  addPlant(B, 40, fy, -140.6);
  addPlant(B, -40, fy, -140.6);
  // Bebedouros
  for (const x of [-50, 50]) {
    B.box('white', 1.2, 2.6, 1.2, x, fy + 1.3, -224.5);
    B.cyl('glass', 0.5, 0.5, 1.4, x, fy + 3.2, -224.5, 12);
  }
}

// ============================================================================
// 5. 3º ANDAR — CENTRO DE SEGURANÇA
// ============================================================================
function buildSecurityFloor(world, B) {
  const S = BANK_SPEC;
  const fy = S.floors[2];
  // Parede de monitores (fundo)
  B.box('graniteBlack', 70, 8, 1.0, 0, fy + 4.6, -224.8);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 10; c++) {
      B.box((r + c) % 3 === 0 ? 'screenGreen' : 'screen', 5.6, 2.0, 0.1, -31.5 + c * 7, fy + 2.4 + r * 2.4, -224.25);
    }
  }
  B.box('steel', 40, 1.2, 3, 0, fy + 0.6, -218);
  world.addCollider(0, -218, 40, 3, fy + 1.3, fy);
  // Racks de servidores com LEDs
  for (let i = 0; i < 6; i++) {
    for (const x of [-46, 46]) {
      const z = -160 - i * 9;
      B.box('black', 3.2, 6.5, 2.2, x, fy + 3.25, z);
      for (let k = 0; k < 5; k++) B.box(k % 2 ? 'screenGreen' : 'ledRed', 0.1, 0.2, 1.6, x + (x < 0 ? 1.62 : -1.62), fy + 1.2 + k * 1.1, z);
      world.addCollider(x, z, 3.2, 2.2, fy + 6.5, fy);
    }
  }
  // Barricadas de sacos de areia / caixotes blindados (cobertura)
  for (const [x, z] of [[-24, -160], [24, -160], [-12, -185], [12, -185], [-30, -200], [30, -200]]) {
    B.box('concrete', 8, 2.0, 1.8, x, fy + 1.0, z);
    B.box('yellowLine', 8.2, 0.25, 1.9, x, fy + 2.05, z);
    world.addCollider(x, z, 8, 1.8, fy + 2.1, fy);
  }
  // Detectores de metal (pórticos)
  for (const x of [-10, 0, 10]) {
    B.box('steel', 0.5, 4.2, 1.0, x - 1.6, fy + 2.1, -146);
    B.box('steel', 0.5, 4.2, 1.0, x + 1.6, fy + 2.1, -146);
    B.box('steel', 3.7, 0.5, 1.0, x, fy + 4.35, -146);
    B.box('ledRed', 0.3, 0.3, 0.3, x, fy + 4.75, -146);
  }
  // Armários do arsenal
  for (let i = 0; i < 8; i++) {
    B.box('steelDark', 2.0, 4.0, 1.2, -18 + i * 2.2, fy + 2.0, -140.6);
    B.box('gold', 0.1, 0.5, 0.1, -17.4 + i * 2.2, fy + 2.2, -140.0);
  }
  // Faixas de alerta no chão
  for (let i = 0; i < 10; i++) B.box('yellowLine', 2.4, 0.03, 0.6, -45 + i * 10, fy + 0.03, -192, 0.6);
}

// ============================================================================
// 6. 4º ANDAR — COFRE
// ============================================================================
function buildVaultFloor(world, B) {
  const S = BANK_SPEC;
  const fy = S.floors[3];
  const vz = S.vaultWallZ;
  const hw = S.vaultDoorHalfW;
  const wallH = S.roofY - fy - 1.2;

  // Piso nobre com faixas douradas
  for (let i = 0; i < 8; i++) B.box('gold', 132, 0.04, 0.4, 0, fy + 0.03, -146 - i * 7.6);
  // Parede blindada do cofre com abertura circular no centro
  B.box('steelDark', S.innerMaxX - hw, wallH, 2.8, (S.innerMaxX + hw) / 2, fy + wallH / 2, vz);
  B.box('steelDark', S.innerMaxX - hw, wallH, 2.8, -(S.innerMaxX + hw) / 2, fy + wallH / 2, vz);
  B.box('steelDark', hw * 2, wallH - 10.6, 2.8, 0, fy + 10.6 + (wallH - 10.6) / 2, vz);
  world.addCollider((S.innerMaxX + hw) / 2, vz, S.innerMaxX - hw, 2.8, fy + wallH, fy);
  world.addCollider(-(S.innerMaxX + hw) / 2, vz, S.innerMaxX - hw, 2.8, fy + wallH, fy);
  world.addCollider(0, vz, hw * 2, 2.8, fy + wallH, fy + 10.6);
  // Rebites e faixas de aço
  for (let x = -66; x <= 66; x += 6) {
    if (Math.abs(x) < hw + 2) continue;
    B.box('chrome', 0.5, wallH - 1, 0.3, x, fy + wallH / 2, vz + 1.5);
  }
  // Moldura circular da porta
  B.cyl('chrome', 6.6, 6.6, 0.8, 0, fy + 5.6, vz + 1.6, 40, Math.PI / 2);
  B.cyl('steelDark', 5.6, 5.6, 0.85, 0, fy + 5.6, vz + 1.65, 40, Math.PI / 2);
  // Grades de laser na frente do cofre (só visual)
  for (const ly of [1.0, 2.2, 3.4]) {
    B.cyl('laser', 0.05, 0.05, 30, 0, fy + ly, vz + 7, 6, 0, Math.PI / 2);
  }
  B.box('steel', 0.6, 4, 0.6, -15, fy + 2, vz + 7);
  B.box('steel', 0.6, 4, 0.6, 15, fy + 2, vz + 7);

  // PORTA CIRCULAR GIGANTE (destrutível)
  const door = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 1.4, 40),
    getLegoMaterial(0x94a3b8, { metalness: 0.85, roughness: 0.18 })
  );
  disc.rotation.x = Math.PI / 2;
  door.add(disc);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.28, 10, 32), getLegoMaterial(0xfacc15, { metalness: 0.8, roughness: 0.15 }));
  wheel.position.z = 0.9;
  door.add(wheel);
  for (let k = 0; k < 4; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.3, 0.3), getLegoMaterial(0xfacc15, { metalness: 0.8, roughness: 0.15 }));
    spoke.rotation.z = (k / 4) * Math.PI;
    spoke.position.z = 0.9;
    door.add(spoke);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 10), getLegoMaterial(0x334155, { metalness: 0.7 }));
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0.8);
    door.add(bolt);
  }
  door.position.set(0, fy + 5.6, vz + 0.6);
  door.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  world.scene.add(door);
  const doorCol = world.addCollider(0, vz, hw * 2, 3.0, fy + 10.6, fy);
  let vaultDoor = null;
  if (world.destructibles) {
    vaultDoor = world.destructibles.registerDestructible({
      mesh: door,
      type: 'bank_vault_door',
      hp: 75,
      radius: 5.5,
      height: 11,
      colliders: [doorCol],
      debrisColors: [LEGO_COLORS.silver, LEGO_COLORS.gold, LEGO_COLORS.charcoal],
      studDrops: { silver: 0, gold: 14, blue: 10, purple: 5 },
      groundY: fy,
      goldOnly: false
    });
  }

  // SALA DO OURO (Z -226..-207)
  const roomZ0 = vz - 1.4;
  // Prateleiras de cédulas nas paredes laterais
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = roomZ0 - 2 - i * 3.8;
      B.box('steel', 2.0, 6.4, 3.2, sx * 64, fy + 3.2, z);
      for (let k = 0; k < 4; k++) B.box('cash', 1.6, 0.8, 2.6, sx * 64, fy + 0.9 + k * 1.5, z);
    }
  }
  // Caixas-fortes na parede do fundo
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 16; c++) {
      B.box('chrome', 3.6, 1.8, 0.3, -27 + c * 3.6, fy + 1.2 + r * 2.0, S.innerBackZ + 0.4);
      B.cyl('gold', 0.18, 0.18, 0.2, -27 + c * 3.6 + 1.2, fy + 1.2 + r * 2.0, S.innerBackZ + 0.6, 8, Math.PI / 2);
    }
  }
  // 4 pilhas grandes de barras de ouro (destrutíveis só com raio solar) em Z = -211
  for (const gx of [-12, -4, 4, 12]) addGoldStack(world, gx, fy, -211, 3.6, 2.6, 3.0);
  // 2 pilhas extras + pedestal central do "Ouro Lendário"
  addGoldStack(world, -24, fy, -219, 3.2, 2.2, 2.6);
  addGoldStack(world, 24, fy, -219, 3.2, 2.2, 2.6);
  B.box('graniteBlack', 6, 1.4, 6, S.goldPile.x, fy + 0.7, S.goldPile.z - 4);
  B.box('gold', 3.6, 1.6, 2.2, S.goldPile.x, fy + 2.2, S.goldPile.z - 4);
  B.box('gold', 2.4, 1.0, 1.6, S.goldPile.x, fy + 3.5, S.goldPile.z - 4);
  // Maletas prateadas
  for (const [mx, mz] of [[-16, -208.5], [16, -208.5], [-8, -223], [8, -223]]) {
    const brief = createLegoBrick(1.6, 1.0, 0.6, LEGO_COLORS.silver, { metalness: 0.7, roughness: 0.2, studs: false });
    brief.position.set(mx, fy + 0.5, mz);
    world.scene.add(brief);
    world.destructibles?.registerDestructible({
      mesh: brief,
      type: 'crate',
      hp: 20,
      radius: 1.0,
      height: 1.0,
      colliders: [],
      debrisColors: [LEGO_COLORS.silver, LEGO_COLORS.gold],
      studDrops: { silver: 4, gold: 6, blue: 2, purple: 1 },
      groundY: fy
    });
  }
  // 36 Studs girando na sala do cofre
  if (world.destructibles?.spawnAmbientStud) {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 6 + (i % 3) * 3;
      const tier = i % 6 === 0 ? 'purple' : i % 3 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(Math.cos(a) * r, fy + 0.9, -216 + Math.sin(a) * r * 0.45, tier);
    }
  }

  return { vaultDoor };
}

function addGoldStack(world, x, fy, z, w, h, d) {
  const stack = createLegoBrick(w, h, d, LEGO_COLORS.gold, { metalness: 0.78, roughness: 0.12, studStep: 0.65 });
  stack.position.set(x, fy + h / 2, z);
  world.scene.add(stack);
  const col = world.addCollider(x, z, w, d, fy + h, fy);
  world.destructibles?.registerDestructible({
    mesh: stack,
    type: 'gold_vault',
    hp: 40,
    radius: Math.max(w, d) * 0.65,
    height: h,
    colliders: [col],
    debrisColors: [LEGO_COLORS.gold, LEGO_COLORS.yellow],
    studDrops: { silver: 0, gold: 12, blue: 8, purple: 5 },
    groundY: fy,
    goldOnly: true
  });
}

// ============================================================================
// 7. TERRAÇO: heliponto, claraboia em pirâmide, jardins, antena e máquinas
// ============================================================================
function buildRooftop(world, B) {
  const S = BANK_SPEC;
  const ry = S.roofY;
  const W = S.maxX - S.minX;
  const D = S.frontZ - S.backZ;
  const midZ = (S.frontZ + S.backZ) / 2;

  // Laje do terraço (andável) + parapeito com pinos LEGO
  B.box('concrete', W, 0.5, D, 0, ry - 0.25, midZ);
  world.elevatedDecks.push({
    id: 'bank_roof',
    minX: S.minX,
    maxX: S.maxX,
    minZ: S.backZ,
    maxZ: S.frontZ,
    thresholdBelow: 2.4,
    getDeckY: () => ry
  });
  const parH = S.wallTopY - ry;
  for (let x = S.minX + 2; x <= S.maxX - 2; x += 1.6) {
    B.cyl('gold', 0.28, 0.28, 0.25, x, S.wallTopY + 0.12, S.frontZ - 1.5, 8);
    B.cyl('gold', 0.28, 0.28, 0.25, x, S.wallTopY + 0.12, S.backZ + 1.5, 8);
  }
  void parH;

  // Heliponto (oeste)
  const hx = -40;
  const hz = -195;
  B.cyl('graniteBlack', 13, 13, 0.6, hx, ry + 0.3, hz, 40);
  B.cyl('yellowLine', 12, 12, 0.62, hx, ry + 0.31, hz, 40);
  B.cyl('graniteBlack', 11.2, 11.2, 0.64, hx, ry + 0.32, hz, 40);
  B.box('white', 1.4, 0.05, 9, hx - 2.8, ry + 0.66, hz);
  B.box('white', 1.4, 0.05, 9, hx + 2.8, ry + 0.66, hz);
  B.box('white', 4.2, 0.05, 1.4, hx, ry + 0.66, hz);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    B.box('ledRed', 0.5, 0.3, 0.5, hx + Math.cos(a) * 12.6, ry + 0.75, hz + Math.sin(a) * 12.6);
  }

  // Claraboia em pirâmide de vidro (centro) com moldura dourada
  B.box('gold', 22, 0.8, 22, 10, ry + 0.4, -168);
  B.cone('glass', 15.2, 9, 10, ry + 5.3, -168, 4);
  for (const [dx, dz] of [[-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]]) {
    B.box('gold', 0.4, 0.4, 14.5, 10 + dx * 0.5, ry + 5, -168 + dz * 0.5, Math.atan2(dx, dz), 0.85);
  }
  world.addCollider(10, -168, 22, 22, ry + 3.5, ry);

  // Jardins suspensos (canteiros com árvores LEGO) e bancos
  for (const [gx, gz] of [[46, -150], [46, -212], [-12, -150], [-12, -214]]) {
    B.box('wood', 14, 1.2, 6, gx, ry + 0.6, gz);
    B.box('plant', 13.4, 0.4, 5.4, gx, ry + 1.3, gz);
    for (let t = -1; t <= 1; t++) {
      B.cyl('pot', 0.25, 0.3, 2.4, gx + t * 4.5, ry + 2.5, gz, 8);
      B.sphere('plant', 1.6, gx + t * 4.5, ry + 4.4, gz, 1.1);
    }
    world.addCollider(gx, gz, 14, 6, ry + 1.5, ry);
  }

  // Máquinas de ar-condicionado com ventoinhas
  for (let i = 0; i < 4; i++) {
    const x = 32 + (i % 2) * 9;
    const z = -180 - Math.floor(i / 2) * 9;
    B.box('chrome', 7, 3, 6, x, ry + 1.5, z);
    B.cyl('black', 2.2, 2.2, 0.2, x, ry + 3.05, z, 20);
    B.box('steel', 3.8, 0.1, 0.4, x, ry + 3.2, z, i * 0.7);
    world.addCollider(x, z, 7, 6, ry + 3, ry);
  }

  // Caixa d'água + gerador
  B.cyl('steel', 4, 4, 6, -62, ry + 5.2, -218, 20);
  B.cone('steel', 4.4, 2, -62, ry + 9.2, -218, 20);
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) B.box('steelDark', 0.5, 2.2, 0.5, -62 + dx, ry + 1.1, -218 + dz);
  world.addCollider(-62, -218, 8.4, 8.4, ry + 8.2, ry);
  B.box('yellowLine', 8, 3.4, 4, -62, ry + 1.7, -150);
  B.box('black', 8.2, 0.6, 4.2, -62, ry + 3.6, -150);
  world.addCollider(-62, -150, 8, 4, ry + 3.9, ry);

  // Antena de comunicação com luz vermelha
  B.box('steelDark', 2.4, 1, 2.4, 60, ry + 0.5, -222);
  B.cyl('chrome', 0.35, 0.6, 18, 60, ry + 10, -222, 10);
  for (let k = 0; k < 4; k++) B.box('chrome', 3.2 - k * 0.6, 0.15, 0.15, 60, ry + 6 + k * 3, -222);
  B.sphere('ledRed', 0.6, 60, ry + 19.4, -222);

  // Letreiro dourado no topo da fachada (de frente para a avenida)
  const roofSign = createSignBoardMesh({
    x: 0,
    y: S.wallTopY + 3.4,
    z: S.frontZ - 2.2,
    width: 44,
    height: 5.2,
    depth: 0.5,
    title: '$ SUPER BANCO $',
    bgColor: '#090a0d',
    borderColor: '#facc15',
    textColor: '#facc15',
    doubleSided: true
  });
  world.scene.add(roofSign);
  B.box('steelDark', 0.6, 3.6, 0.6, -18, S.wallTopY + 0.4, S.frontZ - 2.2);
  B.box('steelDark', 0.6, 3.6, 0.6, 18, S.wallTopY + 0.4, S.frontZ - 2.2);

  // Bandeiras nas torres da frente
  for (const fx of [S.minX - 1, S.maxX + 1]) {
    B.cyl('chrome', 0.15, 0.15, 6, fx, S.wallTopY + 14, S.frontZ + 1, 8);
  }
}

// ============================================================================
// 8. PORTÕES DE SEGURANÇA NO PÉ DE CADA RAMPA (fecham durante o assalto)
// ============================================================================
function buildRampGates(world) {
  const S = BANK_SPEC;
  const gateMat = getLegoMaterial(0x334155, { metalness: 0.7, roughness: 0.25 });
  const stripeMat = getLegoMaterial(0xfacc15, { roughness: 0.4 });
  return S.ramps.map((r, idx) => {
    const floorY = S.floors[r.fromFloor];
    const w = r.maxX - r.minX;
    const cx = (r.minX + r.maxX) / 2;
    const gz = r.zLow + (r.zHigh < r.zLow ? 1.4 : -1.4);
    const mesh = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 4.4, 0.4), gateMat);
    mesh.add(plate);
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.45), stripeMat);
      s.position.y = -1.6 + k * 1.1;
      mesh.add(s);
    }
    mesh.position.set(cx, floorY - 4.2, gz);
    mesh.visible = false;
    mesh.userData.skipStaticMerge = true;
    world.scene.add(mesh);
    const collider = world.addCollider(cx, gz, w, 0.6, floorY + 4.4, floorY + 0.05, { isDynamic: true });
    collider.disabled = true;
    return { idx, rampId: r.id, floorIdx: r.fromFloor, floorY, mesh, collider, open: true };
  });
}

// ============================================================================
// 9. ELEVADOR [E]: leva ao próximo andar (no topo, volta ao térreo)
// ============================================================================
function createBankElevator(world) {
  const S = BANK_SPEC;
  const E = S.elevator;
  const elevator = {
    callX: E.callX,
    callZ: E.callZ,
    radius: 3.6,
    cooldown: 0,
    /** Gancho do assalto: retorna mensagem de bloqueio ou null */
    canTravel: null,
    nearestFloor(pos) {
      if (Math.hypot(pos.x - E.callX, pos.z - E.callZ) > this.radius) return -1;
      let best = -1;
      for (let i = 0; i < S.floors.length; i++) {
        if (Math.abs(pos.y - S.floors[i]) < 2.5) best = i;
      }
      return best;
    },
    /** Usado pelo [E] do controle. Retorna true se tratou a interação. */
    tryUse(controller) {
      if (!controller?.position || controller.currentVehicle) return false;
      const from = this.nearestFloor(controller.position);
      if (from < 0 || this.cooldown > 0) return from >= 0;
      const to = from >= S.floors.length - 1 ? 0 : from + 1;
      const block = this.canTravel ? this.canTravel(from, to) : null;
      const hud = world.destructibles?.hud;
      if (block) {
        hud?.showWantedBanner?.('ELEVADOR BLOQUEADO', block, 'busted', 2000);
        return true;
      }
      const y = S.floors[to] + 0.05;
      controller.position.set(E.callX, y, E.callZ);
      controller.velocity?.set(0, 0, 0);
      if (controller.minifigure?.root) controller.minifigure.root.position.copy(controller.position);
      this.cooldown = 1.2;
      const names = ['1º ANDAR // SAGUÃO', '2º ANDAR // ESCRITÓRIOS', '3º ANDAR // SEGURANÇA', '4º ANDAR // COFRE'];
      hud?.showWantedBanner?.('ELEVADOR', names[to], 'escaped', 1600);
      return true;
    },
    update(dt) {
      if (this.cooldown > 0) this.cooldown -= dt;
    }
  };
  return elevator;
}
