import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial, createLegoBrick, markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import { mergeBufferGeometries, mergeColoredGeometries, makeFastBox } from '../../BuildingGenerator.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../../core/WorldLayoutScale.js';

export const BANK_Z_SHIFT = IS_SCALED_WORLD ? ws(-175) - -175 : 0;
export const bzShift = (z) => z + BANK_Z_SHIFT;

/**
 * ESPECIFICAÇÃO GEOMÉTRICA DO SUPER BANCO CENTRAL
 * (Ancorado rigidamente em `origin = (0, ws(-175))`, preservando 100% das dimensões internas 1x!)
 */
export const BANK_SPEC = {
  x: 0,
  originX: 0,
  originZ: ws(-175),
  zShift: BANK_Z_SHIFT,
  minX: -74,
  maxX: 74,
  frontZ: bzShift(-136), // face externa da fachada
  backZ: bzShift(-229),
  innerMinX: -71,
  innerMaxX: 71,
  innerFrontZ: bzShift(-139),
  innerBackZ: bzShift(-226),
  floors: [0.36, 10.36, 20.36, 30.36],
  floorHeight: 10,
  roofY: 40.96,
  wallTopY: 42.4,
  ramps: [
    // R1: 1º -> 2º (oeste), sobe indo para o fundo (-Z)
    { id: 'R1', minX: -70.6, maxX: -61.4, zLow: bzShift(-146), zHigh: bzShift(-196), fromFloor: 0 },
    // R2: 2º -> 3º (leste), sobe indo para a frente (+Z)
    { id: 'R2', minX: 61.4, maxX: 70.6, zLow: bzShift(-196), zHigh: bzShift(-146), fromFloor: 1 },
    // R3: 3º -> 4º (oeste)
    { id: 'R3', minX: -70.6, maxX: -61.4, zLow: bzShift(-146), zHigh: bzShift(-196), fromFloor: 2 }
  ],
  elevator: {
    minX: 52,
    maxX: 60,
    minZ: bzShift(-150),
    maxZ: bzShift(-142),
    callX: 48.6,
    callZ: bzShift(-146)
  },
  vaultWallZ: bzShift(-206),
  vaultDoorHalfW: 6,
  goldPile: { x: 0, z: bzShift(-215) }
};

export const FLOOR_T = 0.6;

const BANK_MATTE_KEYS = new Set([
  'marble', 'cream', 'granite', 'graniteBlack', 'velvet', 'carpetBlue',
  'wood', 'black', 'white', 'plant', 'pot', 'cash', 'concrete', 'yellowLine'
]);
const BANK_METALLIC_KEYS = new Set(['gold', 'steel', 'steelDark', 'chrome', 'windowGlass']);
const BANK_EMISSIVE_KEYS = new Set(['lightPanel', 'crystalGlow', 'screen', 'screenGreen', 'ledRed']);

const BANK_VC_MATTE_MAT = markAsSharedAsset(
  new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.36, metalness: 0.08 })
);
const BANK_VC_METALLIC_MAT = markAsSharedAsset(
  new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.16, metalness: 0.72 })
);
const BANK_VC_EMISSIVE_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true })
);
const _WHITE_FALLBACK = new THREE.Color(0xffffff);

// ----------------------------------------------------------------------------
// Lote de geometria consolidado via Vertex Colors (apenas 5 meshes estáticos!)
// ----------------------------------------------------------------------------
class Batcher {
  constructor() {
    this.mats = new Map();
    this.geos = new Map();
    this.noShadowKeys = new Set();
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
    if (rotY === 0 && rotX === 0 && rotZ === 0) {
      this._push(key, makeFastBox(w, h, d, x, y, z));
      return;
    }
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

  torus(key, R, tube, x, y, z, rotX = 0, seg = 40) {
    const g = new THREE.TorusGeometry(R, tube, 10, seg);
    if (rotX) g.rotateX(rotX);
    g.translate(x, y, z);
    this._push(key, g);
  }

  cone(key, r, h, x, y, z, seg = 4) {
    const g = new THREE.ConeGeometry(r, h, seg);
    if (seg === 4) g.rotateY(Math.PI / 4);
    g.translate(x, y, z);
    this._push(key, g);
  }

  flush(scene) {
    const matteList = [];
    const metallicList = [];
    const emissiveList = [];

    for (const [key, list] of this.geos) {
      if (!list.length) continue;
      if (key === 'glass' || key === 'laser') {
        const merged = mergeBufferGeometries(list);
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, markAsSharedAsset(this.mats.get(key)));
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.name = `bank_${key}`;
        scene.add(mesh);
        continue;
      }
      const mat = this.mats.get(key);
      if (BANK_EMISSIVE_KEYS.has(key)) {
        const col = mat?.emissive && mat.emissive.getHex() !== 0 ? mat.emissive : (mat?.color || _WHITE_FALLBACK);
        for (let i = 0; i < list.length; i++) emissiveList.push({ geo: list[i], color: col });
      } else if (BANK_METALLIC_KEYS.has(key)) {
        const col = mat?.color || _WHITE_FALLBACK;
        for (let i = 0; i < list.length; i++) metallicList.push({ geo: list[i], color: col });
      } else {
        const col = mat?.color || _WHITE_FALLBACK;
        for (let i = 0; i < list.length; i++) matteList.push({ geo: list[i], color: col });
      }
    }

    const addVcMesh = (entries, mat, name, castShadow, receiveShadow) => {
      if (!entries.length) return;
      const merged = mergeColoredGeometries(entries);
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.name = name;
      scene.add(mesh);
    };

    addVcMesh(matteList, BANK_VC_MATTE_MAT, 'bank_vc_matte', true, true);
    addVcMesh(metallicList, BANK_VC_METALLIC_MAT, 'bank_vc_metallic', true, true);
    addVcMesh(emissiveList, BANK_VC_EMISSIVE_MAT, 'bank_vc_emissive', false, false);
    this.geos.clear();
  }
}

export function createBankBatcher() {
  const B = new Batcher();

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
      color: 0x7dd3fc, roughness: 0.05, metalness: 0.2, clearcoat: 1,
      transparent: true, opacity: 0.42, depthWrite: false
    })
  );
  B.mat('windowGlass', () => getLegoMaterial(0x1d4ed8, { roughness: 0.06, metalness: 0.55, clearcoat: 1 }));
  B.mat('lightPanel', () => getLegoMaterial(0xfff7d6, { roughness: 0.18, clearcoat: 0.3, emissive: 0xffebb3, emissiveIntensity: 1.4 }));
  B.mat('crystalGlow', () => getLegoMaterial(0xfffbeb, { roughness: 0.08, clearcoat: 0.85, emissive: 0xfde68a, emissiveIntensity: 1.55 }));
  B.mat('screen', () => new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
  B.mat('screenGreen', () => new THREE.MeshBasicMaterial({ color: 0x4ade80 }));
  B.mat('ledRed', () => new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  B.mat('laser', () => new THREE.MeshBasicMaterial({ color: 0xff1f1f, transparent: true, opacity: 0.75 }));

  B.noShadowKeys = new Set(['glass', 'lightPanel', 'screen', 'screenGreen', 'ledRed', 'laser']);
  return B;
}

// ============================================================================
// 1. CASCA EXTERNA: fachada clássica + torre de 4 andares
// ============================================================================
export function buildExteriorShell(world, B) {
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
    x: 0, y: colTop + 2.1, z: colZ + 2.55, width: 52, height: 2.2, depth: 0.4,
    title: 'SUPER BANCO CENTRAL', bgColor: '#090a0d', borderColor: '#facc15', textColor: '#facc15', doubleSided: false
  });
  world.scene.add(signBoard);

  // --- 2 Estátuas douradas de guardião LEGO nas pontas da escadaria
  // (entre as colunas de ±20 e ±34, onde a fachada não tem porta)
  for (const side of [-1, 1]) buildGoldenGuardianStatue(world, B, side * 27, S.frontZ + 3.4);
}

/**
 * Esplanada / Forecourt Monumental em 3x ligando a escadaria frontal do Super Banco
 * diretamente à Avenida `Z = ws(-117)` (mantendo o corredor central livre para veículos!).
 */
export function buildBankMonumentalForecourt(world, B) {
  const S = BANK_SPEC;
  const plinthMinZ = S.backZ - 3.5;
  const plinthMaxZ = S.frontZ + 5.5;
  const aveNorthEdgeZ = ws(-117) - ROAD.mainWidth * 0.5;
  const aveSidewalkInnerZ = aveNorthEdgeZ - ROAD.sidewalk;
  const plazaW = 152;
  const topY = 0.2;

  // Base perimetral sob o prédio do Super Banco
  B.box('concrete', plazaW, 0.26, plinthMaxZ - plinthMinZ, 0, topY - 0.13, (plinthMinZ + plinthMaxZ) * 0.5);

  // Grande Esplanada Cerimonial ligando a fachada frontal até a calçada da Avenida Z = ws(-117)
  const espD = aveSidewalkInnerZ - plinthMaxZ;
  if (espD > 2) {
    const espMidZ = (plinthMaxZ + aveSidewalkInnerZ) * 0.5;
    B.box('granite', plazaW, 0.24, espD + 0.4, 0, topY - 0.12, espMidZ);
    B.box('marble', 34, 0.03, espD, 0, topY + 0.015, espMidZ);
    B.box('velvet', 12, 0.04, espD - 4, 0, topY + 0.025, espMidZ);
    B.box('gold', 12.8, 0.035, espD - 3.4, 0, topY + 0.018, espMidZ);

    // Continuação do boulevard sobre os 10m de calçada até o meio-fio da Av. Z = ws(-117), com rampa veicular
    const swMidZ = (aveSidewalkInnerZ + aveNorthEdgeZ) * 0.5;
    B.box('marble', 34, 0.22, ROAD.sidewalk + 0.2, 0, ROAD.curbHeight - 0.11, swMidZ);
    const rampLen = 2.4;
    const rampTilt = Math.atan2(ROAD.curbHeight, rampLen);
    B.box('marble', 32, 0.12, rampLen, 0, ROAD.curbHeight * 0.5 - 0.02, aveNorthEdgeZ - rampLen * 0.5, 0, rampTilt);

    // Balizas douradas e canteiros laterais fora da pista central (±19m livres!)
    for (let z = plinthMaxZ + 12; z <= aveSidewalkInnerZ - 10; z += 18) {
      for (const side of [-1, 1]) {
        const bx = side * 19.5;
        B.box('graniteBlack', 1.4, 0.9, 1.4, bx, topY + 0.45, z);
        B.cyl('gold', 0.22, 0.28, 3.6, bx, topY + 2.7, z, 10);
        B.sphere('crystalGlow', 0.48, bx, topY + 4.7, z);

        const px = side * 46;
        B.box('granite', 16, 0.75, 7.5, px, topY + 0.38, z);
        B.box('gold', 16.4, 0.16, 7.9, px, topY + 0.8, z);
        B.box('plant', 14.8, 0.45, 6.3, px, topY + 0.92, z);
        addBankPlant(B, px - 4.5, topY + 0.75, z);
        addBankPlant(B, px + 4.5, topY + 0.75, z);
        world.addCollider(px, z, 16, 7.5, topY + 1.2, 0);
      }
    }
  }
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
// 3. 1º ANDAR — GRANDE SAGUÃO DE MÁRMORE, PILASTRAS DESTRUTÍVEIS E BALCÕES
// ============================================================================
export function buildGroundLobby(world, B) {
  const S = BANK_SPEC;
  const fy = S.floors[0];

  // Piso de mármore quadriculado + tapete vermelho central
  B.box('marble', S.innerMaxX - S.innerMinX, fy, S.innerFrontZ - S.innerBackZ, 0, fy / 2, (S.innerFrontZ + S.innerBackZ) / 2);
  for (let tx = -66; tx <= 66; tx += 6) {
    for (let dtz = -142; dtz >= -224; dtz -= 6) {
      const ix = Math.round((tx + 66) / 6);
      const iz = Math.round((-142 - dtz) / 6);
      if ((ix + iz) % 2 === 0) B.box('cream', 5.85, 0.04, 5.85, tx, fy + 0.01, bzShift(dtz));
    }
  }
  B.box('velvet', 10, 0.05, 56, 0, fy + 0.04, bzShift(-168));
  B.box('gold', 10.6, 0.04, 56.6, 0, fy + 0.025, bzShift(-168));
  // Brasão dourado no piso
  B.cyl('gold', 6, 6, 0.05, 0, fy + 0.07, bzShift(-160), 32);
  B.cyl('graniteBlack', 4.8, 4.8, 0.06, 0, fy + 0.08, bzShift(-160), 32);
  B.box('gold', 0.8, 0.07, 6, 0, fy + 0.1, bzShift(-160));

  // 8 colunas internas de mármore (quebráveis)
  const pillarPositions = [
    [-44, bzShift(-158)], [44, bzShift(-158)], [-44, bzShift(-184)], [44, bzShift(-184)],
    [-22, bzShift(-158)], [22, bzShift(-158)], [-22, bzShift(-184)], [22, bzShift(-184)]
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
      mesh: group, type: 'marble_pillar', hp: 140, radius: 1.6, height: 9.9, colliders: [col],
      debrisColors: [LEGO_COLORS.white, 0xfef3c7, LEGO_COLORS.gold],
      studDrops: { silver: 6, gold: 4, blue: 1, purple: 0 }, groundY: fy
    });
  }

  // Guichês: balcão longo com vidros e 8 computadores
  const cz = bzShift(-200);
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
    const z = bzShift(-152 - i * 4.2);
    B.box('steel', 1.6, 3.2, 2.6, 46, fy + 1.6, z);
    B.box('screen', 0.06, 0.9, 1.4, 45.18, fy + 2.3, z);
    B.box('gold', 0.1, 0.3, 2.6, 45.15, fy + 3.05, z);
    world.addCollider(46, z, 1.6, 2.6, fy + 3.2, fy);
  }

  // Recepção circular "INFORMAÇÕES"
  const infoZ = bzShift(-148);
  B.cyl('wood', 4.2, 4.2, 1.3, -30, fy + 0.65, infoZ, 24);
  B.cyl('marble', 4.5, 4.5, 0.2, -30, fy + 1.4, infoZ, 24);
  world.addCollider(-30, infoZ, 8, 8, fy + 1.5, fy);

  // Bancos de espera, plantas e cordões de fila
  for (const bx of [-12, 12]) {
    for (let r = 0; r < 3; r++) {
      const z = bzShift(-170 - r * 5);
      B.box('wood', 9, 0.5, 1.6, bx, fy + 0.9, z);
      B.box('wood', 9, 1.4, 0.3, bx, fy + 1.6, z - 0.75);
      B.box('steel', 0.3, 0.7, 1.2, bx - 4, fy + 0.35, z);
      B.box('steel', 0.3, 0.7, 1.2, bx + 4, fy + 0.35, z);
    }
  }
  const ropeZ = bzShift(-194);
  for (let i = 0; i < 6; i++) {
    const x = -15 + i * 6;
    B.cyl('gold', 0.18, 0.25, 2.0, x, fy + 1.0, ropeZ, 10);
    B.sphere('gold', 0.3, x, fy + 2.1, ropeZ);
    if (i < 5) B.box('velvet', 5.6, 0.2, 0.2, x + 3, fy + 1.7, ropeZ);
  }
  addBankPlant(B, -66, fy, bzShift(-142));
  addBankPlant(B, 66, fy, bzShift(-142));
  addBankPlant(B, -56, fy, bzShift(-222));
  addBankPlant(B, 56, fy, bzShift(-222));

  // Lustres dourados pendurados no teto do térreo
  for (const [lx, dlz] of [[-30, -168], [0, -176], [30, -168]]) {
    const lz = bzShift(dlz);
    B.cyl('gold', 0.12, 0.12, 1.6, lx, S.floors[1] - 1.4, lz, 8);
    B.cyl('gold', 2.4, 1.2, 0.9, lx, S.floors[1] - 2.6, lz, 16);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      B.sphere('lightPanel', 0.35, lx + Math.cos(a) * 2.2, S.floors[1] - 3.2, lz + Math.sin(a) * 2.2);
    }
  }

  // Câmeras e sirenes vermelhas (perto das rampas e do elevador)
  for (const [ax, daz] of [[-60, -144], [60, -144], [0, -224]]) {
    const az = bzShift(daz);
    B.box('white', 0.9, 0.7, 1.6, ax, S.floors[1] - 1.5, az);
    B.box('ledRed', 0.9, 0.5, 0.5, ax, S.floors[1] - 2.2, az + 0.9);
  }
}

export function addBankPlant(B, x, y, z) {
  B.cyl('pot', 1.1, 0.8, 1.6, x, y + 0.8, z, 12);
  B.sphere('plant', 1.6, x, y + 2.8, z, 1.3);
  B.sphere('plant', 1.1, x + 0.6, y + 4.2, z - 0.3, 1.2);
}
