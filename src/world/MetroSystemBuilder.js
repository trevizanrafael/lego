import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from './BuildingGenerator.js';
import { soundFX } from '../audio/SoundFX.js';
import {
  createSignBoardMesh,
  createCustomCanvasSignTexture,
  fitAndDrawText
} from '../utils/SignBoardHelper.js';

// ============================================================================
// 1. RECORTES FÍSICOS NO PISO DA ILHA E CALÇADAS (`METRO_ISLAND_CUTOUTS`)
//    - ZERO corte em avenidas ou cruzamentos de carros!
//    - Escadarias longas de 28m nas calçadas descendo suavemente até Y = -10.5m!
//    - 2 Portais Blindados em praças exclusivas fora das pistas (X = ±82, Z = -196..-134)!
// ============================================================================
export const METRO_ISLAND_CUTOUTS = [
  // Estação 01 (Central / Super Banco) — Escadarias Amplas de 28m na Calçada Norte dos Blocos (±60, -58)
  {
    id: 'st01_west_stair',
    minX: -88.0,
    maxX: -60.0,
    minZ: -102.6,
    maxZ: -98.2,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(0.28, -10.5, THREE.MathUtils.clamp((-60.0 - x) / 28.0, 0, 1))
  },
  {
    id: 'st01_east_stair',
    minX: 60.0,
    maxX: 88.0,
    minZ: -102.6,
    maxZ: -98.2,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(0.28, -10.5, THREE.MathUtils.clamp((x - 60.0) / 28.0, 0, 1))
  },
  // Estação 02 (Times Square / Parque) — Escadaria Ampla de 28m na Calçada Norte do Bloco (-60, +68)
  {
    id: 'st02_stair',
    minX: -86.0,
    maxX: -58.0,
    minZ: 16.4,
    maxZ: 20.8,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(0.28, -10.5, THREE.MathUtils.clamp((-58.0 - x) / 28.0, 0, 1))
  },
  // Portal Blindado Oeste (Praça Lateral Oeste do Super Banco: X = -82, Z = -196..-134 — FORA de qualquer rua!)
  {
    id: 'west_plaza_portal',
    minX: -86.8,
    maxX: -77.2,
    minZ: -196.0,
    maxZ: -134.0,
    getFloorY: (_x, z) =>
      THREE.MathUtils.lerp(-11.2, 0.0, THREE.MathUtils.clamp((-134.0 - z) / 62.0, 0, 1))
  },
  // Portal Blindado Leste (Praça Lateral Leste do Super Banco: X = +82, Z = -196..-134 — FORA de qualquer rua!)
  {
    id: 'east_plaza_portal',
    minX: 77.2,
    maxX: 86.8,
    minZ: -196.0,
    maxZ: -134.0,
    getFloorY: (_x, z) =>
      THREE.MathUtils.lerp(0.0, -11.2, THREE.MathUtils.clamp((z - -196.0) / 62.0, 0, 1))
  },
  // Escadaria Larga Iluminada do Porão Bio-Genético na Torre dos Heróis (Ala Sudeste/Leste: Y = +0.36m -> Y = -8.2m!)
  {
    id: 'hero_tower_lab_stair',
    minX: -306.0,
    maxX: -282.0,
    minZ: -150.5,
    maxZ: -141.5,
    getFloorY: (x) =>
      THREE.MathUtils.lerp(-8.2, 0.36, THREE.MathUtils.clamp((x - -306.0) / 24.0, 0, 1))
  }
];

/**
 * Catálogo Oficial das 5 Estações da Linha 01 Circular do Metrô LEGO
 * - Subterrâneas: Piso em Y = -10.5m (Pé-direito monumental de 9.6m, largura útil 22.0m!)
 * - Elevadas: Piso em Y = +14.85m (Plataforma de 12.5m x 62m, cobertura alta a +23.65m = 8.8m livres!)
 */
export const METRO_STATIONS = [
  {
    id: 'metro_st_01',
    number: 1,
    code: 'M01',
    name: 'ESTAÇÃO CENTRAL / SUPER BANCO',
    shortName: 'METRÔ CENTRAL',
    kind: 'underground',
    x: 0,
    y: -10.5,
    z: -104,
    trackPos: { x: 0, y: -11.2, z: -116.0 },
    platformSpawn: { x: 0, y: -10.5, z: -101.5 },
    streetEntrance: { x: -60.0, y: 0.3, z: -100.4 },
    doorSide: 'left' // Indo para Oeste (-X): esquerda aponta para Sul (+Z = plataforma ampla de 22m!)
  },
  {
    id: 'metro_st_02',
    number: 2,
    code: 'M02',
    name: 'ESTAÇÃO TIMES SQUARE / PARQUE',
    shortName: 'METRÔ TIMES SQ.',
    kind: 'underground',
    x: -77,
    y: -10.5,
    z: 20,
    trackPos: { x: -93.0, y: -11.2, z: 20.0 },
    platformSpawn: { x: -77.5, y: -10.5, z: 20.0 },
    streetEntrance: { x: -58.0, y: 0.3, z: 18.6 },
    doorSide: 'left' // Indo para Sul (+Z): esquerda aponta para Leste (+X = plataforma ampla de 22m!)
  },
  {
    id: 'metro_st_03',
    number: 3,
    code: 'M03',
    name: 'ESTAÇÃO TORRE DOS HERÓIS',
    shortName: 'METRÔ TORRE',
    kind: 'elevated',
    x: -380,
    y: 14.85,
    z: -60,
    trackPos: { x: -388.5, y: 14.2, z: -60.0 },
    platformSpawn: { x: -379.87, y: 14.85, z: -60.0 },
    streetEntrance: { x: -368.0, y: 0.3, z: 8.0 },
    doorSide: 'left' // Indo para Sul (+Z): esquerda aponta para Leste (+X = plataforma de 12.5m!)
  },
  {
    id: 'metro_st_04',
    number: 4,
    code: 'M04',
    name: 'ESTAÇÃO ORLA MARÍTIMA / PRAIA SUL',
    shortName: 'METRÔ PRAIA SUL',
    kind: 'elevated',
    x: -117,
    y: 14.85,
    z: 650,
    trackPos: { x: -125.5, y: 14.2, z: 650.0 },
    platformSpawn: { x: -116.87, y: 14.85, z: 650.0 },
    streetEntrance: { x: -105.5, y: 0.3, z: 700.0 },
    doorSide: 'left' // Indo para Sul (+Z): esquerda aponta para Leste (+X = plataforma de 12.5m!)
  },
  {
    id: 'metro_st_05',
    number: 5,
    code: 'M05',
    name: 'ESTAÇÃO MARGEM DO RIO / DISTRITO LESTE',
    shortName: 'METRÔ RIO LESTE',
    kind: 'elevated',
    x: 509,
    y: 14.85,
    z: -180,
    trackPos: { x: 518.0, y: 14.2, z: -180.0 },
    platformSpawn: { x: 509.37, y: 14.85, z: -180.0 },
    streetEntrance: { x: 499.8, y: 0.3, z: -116.0 },
    doorSide: 'left' // Indo para Norte (-Z): esquerda aponta para Oeste (-X = plataforma de 12.5m!)
  }
];

/**
 * Anel Ferroviário Circular Contínuo (Subsolo Y = -11.2m <-> Elevado Y = +14.2m):
 * - Emerge e mergulha EXCLUSIVAMENTE nas 2 Praças Laterais fora das ruas (X = ±82, Z = -134..-236),
 *   atingindo Y >= +12.2m..+14.2m ANTES de cruzar a Avenida Z = -250!
 * - NENHUMA avenida ou cruzamento da cidade (Z = +134, X = +384, Z = -117, Z = -250) sofre corte!
 */
export const METRO_LOOP_WAYPOINTS = [
  // 1) Trecho Subterrâneo Monumental (Leito Y = -11.2m; Piso das plataformas = -10.5m!)
  { x: 66, y: -11.2, z: -116.0, underground: true },
  { x: 0, y: -11.2, z: -116.0, underground: true },        // [M01: ESTAÇÃO CENTRAL / SUPER BANCO]
  { x: -76, y: -11.2, z: -116.0, underground: true },
  { x: -93, y: -11.2, z: -98.0, underground: true },
  { x: -93, y: -11.2, z: 20.0, underground: true },        // [M02: ESTAÇÃO TIMES SQUARE / PARQUE]
  { x: -93, y: -11.2, z: 58.0, underground: true },
  { x: -110, y: -11.2, z: 74.0, underground: true },
  { x: -152, y: -11.2, z: 74.0, underground: true },
  { x: -168, y: -11.2, z: 58.0, underground: true },
  { x: -168, y: -11.2, z: -114.0, underground: true },
  { x: -152, y: -11.2, z: -129.0, underground: true },
  { x: -98, y: -11.2, z: -129.0, underground: true },

  // 2) Rampa Blindada Portal Oeste na Praça Lateral (X = -82, Z = -136 -> -236, fora de ruas!)
  { x: -82, y: -11.2, z: -136.0, portal: true },
  { x: -82, y: 0.0, z: -186.0, portal: true },
  { x: -82, y: 12.2, z: -234.0, portal: true },
  { x: -98, y: 14.2, z: -250.0, elevated: true },

  // 3) Linha Elevada Estilo Manhattan / Spider-Man (Y = +14.2m — Acima de todos os viadutos e avenidas!)
  { x: -372, y: 14.2, z: -250.0, elevated: true },
  { x: -388.5, y: 14.2, z: -234.0, elevated: true },
  { x: -388.5, y: 14.2, z: -60.0, elevated: true },       // [M03: ESTAÇÃO TORRE DOS HERÓIS]
  { x: -388.5, y: 14.2, z: 118.0, elevated: true },
  { x: -404, y: 14.2, z: 134.0, elevated: true },
  { x: -500, y: 14.2, z: 134.0, elevated: true },
  { x: -516, y: 14.2, z: 150.0, elevated: true },
  { x: -516, y: 17.6, z: 540.0, elevated: true },
  { x: -500, y: 17.6, z: 556.0, elevated: true },
  { x: -142, y: 17.6, z: 556.0, elevated: true },
  { x: -125.5, y: 16.0, z: 588.0, elevated: true },
  { x: -125.5, y: 14.2, z: 618.0, elevated: true },
  { x: -125.5, y: 14.2, z: 650.0, elevated: true },       // [M04: ESTAÇÃO ORLA MARÍTIMA / PRAIA SUL]
  { x: -125.5, y: 14.2, z: 694.0, elevated: true },
  { x: -109, y: 14.2, z: 710.0, elevated: true },
  { x: 502, y: 14.2, z: 710.0, elevated: true },
  { x: 518.0, y: 14.2, z: 694.0, elevated: true },
  { x: 518.0, y: 14.2, z: -180.0, elevated: true },       // [M05: ESTAÇÃO MARGEM DO RIO / DISTRITO LESTE]
  { x: 518.0, y: 14.2, z: -234.0, elevated: true },
  { x: 502, y: 14.2, z: -250.0, elevated: true },
  { x: 98, y: 14.2, z: -250.0, elevated: true },

  // 4) Rampa Blindada Portal Leste na Praça Lateral (X = +82, Z = -234 -> -136, fora de ruas!)
  { x: 82, y: 12.2, z: -234.0, portal: true },
  { x: 82, y: 0.0, z: -186.0, portal: true },
  { x: 82, y: -11.2, z: -136.0, portal: true }
];

export function sliceRectAroundCutouts(bounds, cutouts = METRO_ISLAND_CUTOUTS) {
  let rects = [{ ...bounds }];
  for (const cut of cutouts) {
    const next = [];
    for (const r of rects) {
      if (
        cut.maxX <= r.minX ||
        cut.minX >= r.maxX ||
        cut.maxZ <= r.minZ ||
        cut.minZ >= r.maxZ
      ) {
        next.push(r);
        continue;
      }
      if (cut.minX > r.minX) {
        next.push({ minX: r.minX, maxX: cut.minX, minZ: r.minZ, maxZ: r.maxZ });
      }
      if (cut.maxX < r.maxX) {
        next.push({ minX: cut.maxX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ });
      }
      const overlapMinX = Math.max(r.minX, cut.minX);
      const overlapMaxX = Math.min(r.maxX, cut.maxX);
      if (cut.minZ > r.minZ) {
        next.push({ minX: overlapMinX, maxX: overlapMaxX, minZ: r.minZ, maxZ: cut.minZ });
      }
      if (cut.maxZ < r.maxZ) {
        next.push({ minX: overlapMinX, maxX: overlapMaxX, minZ: cut.maxZ, maxZ: r.maxZ });
      }
    }
    rects = next;
  }
  return rects;
}

export function getMetroCutoutFloorY(x, z) {
  for (let i = 0; i < METRO_ISLAND_CUTOUTS.length; i++) {
    const c = METRO_ISLAND_CUTOUTS[i];
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
      return c.getFloorY(x, z);
    }
  }
  return null;
}

// ============================================================================
// 2. CURVA FECHADA PARAMETRIZADA POR COMPRIMENTO DE ARCO PARA OS 2 TRENS LEGO
// ============================================================================
function buildClosedMetroLoopSpline() {
  const pts = METRO_LOOP_WAYPOINTS.map((w) => new THREE.Vector3(w.x, w.y, w.z));
  const smoothPts = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const vIn = new THREE.Vector3().subVectors(curr, prev);
    const vOut = new THREE.Vector3().subVectors(next, curr);
    const lenIn = vIn.length();
    const lenOut = vOut.length();
    vIn.normalize();
    vOut.normalize();

    const dot = vIn.dot(vOut);
    if (dot < 0.96 && lenIn > 12 && lenOut > 12) {
      const trim = Math.min(11.0, lenIn * 0.35, lenOut * 0.35);
      const pA = curr.clone().addScaledVector(vIn, -trim);
      const pB = curr.clone().addScaledVector(vOut, trim);
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const omt = 1 - t;
        const px = omt * omt * pA.x + 2 * omt * t * curr.x + t * t * pB.x;
        const py = omt * omt * pA.y + 2 * omt * t * curr.y + t * t * pB.y;
        const pz = omt * omt * pA.z + 2 * omt * t * curr.z + t * t * pB.z;
        smoothPts.push(new THREE.Vector3(px, py, pz));
      }
    } else {
      smoothPts.push(curr.clone());
    }
  }

  const cumLengths = [0];
  let totalLen = 0;
  for (let i = 0; i < smoothPts.length; i++) {
    const a = smoothPts[i];
    const b = smoothPts[(i + 1) % smoothPts.length];
    totalLen += a.distanceTo(b);
    cumLengths.push(totalLen);
  }

  const sampleAtS = (rawS, outPos = new THREE.Vector3(), outTan = new THREE.Vector3()) => {
    const s = ((rawS % totalLen) + totalLen) % totalLen;
    let lo = 0;
    let hi = smoothPts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cumLengths[mid + 1] <= s) lo = mid + 1;
      else if (cumLengths[mid] > s) hi = mid - 1;
      else {
        lo = mid;
        break;
      }
    }
    const idx = Math.min(lo, smoothPts.length - 1);
    const segStart = cumLengths[idx];
    const segLen = Math.max(0.0001, cumLengths[idx + 1] - segStart);
    const t = (s - segStart) / segLen;
    const p0 = smoothPts[idx];
    const p1 = smoothPts[(idx + 1) % smoothPts.length];
    outPos.lerpVectors(p0, p1, t);
    outTan.subVectors(p1, p0).normalize();
    return { pos: outPos, tangent: outTan };
  };

  const findClosestS = (tx, ty, tz) => {
    const target = new THREE.Vector3(tx, ty, tz);
    let bestS = 0;
    let bestDistSq = Infinity;
    for (let s = 0; s < totalLen; s += 1.0) {
      const { pos } = sampleAtS(s);
      const dSq = pos.distanceToSquared(target);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestS = s;
      }
    }
    return bestS;
  };

  const stationStops = METRO_STATIONS.map((st) => ({
    ...st,
    stopS: findClosestS(st.trackPos.x, st.trackPos.y, st.trackPos.z)
  }));

  return {
    points: smoothPts,
    totalLength: totalLen,
    sampleAtS,
    stationStops
  };
}

// ============================================================================
// 3. BATCHER ESTÁTICO DO SISTEMA DE METRÔ (POUCOS DRAW CALLS — 60 FPS!)
// ============================================================================
function createMetroBatcher() {
  const palette = {
    subway_tile_white: getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.65 }),
    subway_stripe_blue: getLegoMaterial(0x0284c7, { roughness: 0.22, clearcoat: 0.55 }),
    subway_stripe_gold: getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.55 }),
    platform_floor: getLegoMaterial(0xcbd5e1, { roughness: 0.34, clearcoat: 0.25 }),
    plaza_granite: getLegoMaterial(0x94a3b8, { roughness: 0.38, clearcoat: 0.2 }),
    tunnel_concrete: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.68 }),
    tunnel_dark: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 }),
    ny_truss_green: getLegoMaterial(0x1e3a2f, { roughness: 0.34, metalness: 0.42, clearcoat: 0.35 }),
    ny_truss_charcoal: getLegoMaterial(0x27272a, { roughness: 0.34, metalness: 0.48, clearcoat: 0.35 }),
    rail_silver: getLegoMaterial(0xe2e8f0, { roughness: 0.18, metalness: 0.72, clearcoat: 0.7 }),
    wood_sleeper: new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.62 }),
    bench_wood: getLegoMaterial(0x92400e, { roughness: 0.36, clearcoat: 0.3 }),
    ny_entrance_green: getLegoMaterial(0x15803d, { roughness: 0.26, clearcoat: 0.45 }),
    fluorescent_white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    globe_emerald: new THREE.MeshBasicMaterial({ color: 0x4ade80 }),
    safety_yellow_glow: new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  };

  const buckets = new Map();
  for (const k of Object.keys(palette)) {
    buckets.set(k, []);
  }
  const studPositions = [];

  const pushMatrixGeo = (key, geo, x, y, z, rotX = 0, rotY = 0, rotZ = 0) => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    buckets.get(key).push(geo);
  };

  return {
    studPositions,
    addBox(key, w, h, d, x, y, z) {
      buckets.get(key).push(makeTranslatedBox(w, h, d, x, y, z));
    },
    addOrientedBox(key, w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
      pushMatrixGeo(key, new THREE.BoxGeometry(w, h, d), x, y, z, rotX, rotY, rotZ);
    },
    addSphere(key, r, x, y, z) {
      pushMatrixGeo(key, new THREE.SphereGeometry(r, 12, 10), x, y, z);
    },
    flush(scene) {
      const shadowKeys = new Set([
        'ny_truss_green',
        'ny_truss_charcoal',
        'ny_entrance_green',
        'platform_floor'
      ]);
      for (const [key, geos] of buckets.entries()) {
        if (geos.length === 0) continue;
        const merged = mergeBufferGeometries(geos);
        for (let i = 0; i < geos.length; i++) geos[i].dispose();
        geos.length = 0;
        if (!merged) continue;
        const mat = palette[key];
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = shadowKeys.has(key);
        mesh.receiveShadow = !mat.isMeshBasicMaterial;
        scene.add(mesh);
      }
      buckets.clear();

      if (studPositions.length > 0) {
        const inst = new THREE.InstancedMesh(
          SHARED_STUD_GEO,
          getLegoMaterial(0xfacc15, { roughness: 0.25, clearcoat: 0.45 }),
          studPositions.length
        );
        const dummy = new THREE.Object3D();
        for (let i = 0; i < studPositions.length; i++) {
          dummy.position.set(studPositions[i][0], studPositions[i][1], studPositions[i][2]);
          dummy.scale.set(1.08, 1.08, 1.08);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
      }
    }
  };
}

function addMetroSignBoard(world, x, y, z, w, h, title, subText = '', rotY = 0, bg = '#0f172a', doubleSided = false) {
  const mesh = createSignBoardMesh({
    x,
    y,
    z,
    width: w,
    height: h,
    depth: 0.34,
    rotY,
    title,
    subText,
    bgColor: bg,
    borderColor: '#38bdf8',
    topStripeColor: '#0284c7',
    bottomStripeColor: '#facc15',
    textColor: '#ffffff',
    subColor: '#38bdf8',
    doubleSided
  });
  world.scene.add(mesh);
}

// ============================================================================
// 4. CATRACAS E MÁQUINAS DE BILHETES QUEBRÁVEIS (DROPAM STUDS LEGO!) + TOTEM [E]
// ============================================================================
function spawnBreakableMetroTurnstile(world, x, yBase, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.rotation.y = rotY;

  const post = createLegoBrick(0.55, 1.15, 1.35, LEGO_COLORS.silver, { metalness: 0.6, roughness: 0.2 });
  post.position.y = 0.58;
  const reader = createLegoBrick(0.58, 0.18, 0.45, 0x0284c7, { studs: false });
  reader.position.set(0, 1.2, 0.35);
  const arm = createLegoBrick(0.95, 0.14, 0.14, LEGO_COLORS.yellow, { studs: false });
  arm.position.set(0.52, 0.85, 0.15);

  group.add(post, reader, arm);
  group.userData.metroProp = 'turnstile';
  world.scene.add(group);

  const col = world.addCollider(x, z, 1.2, 1.2, yBase + 1.25, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: group,
      type: 'crate',
      hp: 16,
      radius: 0.9,
      height: 1.25,
      colliders: [col],
      debrisColors: [LEGO_COLORS.silver, 0x0284c7, LEGO_COLORS.yellow],
      studDrops: { silver: 4, gold: 3, blue: 1, purple: 0 },
      groundY: yBase
    });
  }
}

function spawnBreakableTicketMachine(world, x, yBase, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.rotation.y = rotY;

  const body = createLegoBrick(1.45, 2.25, 0.88, 0x0284c7, { studStep: 0.6 });
  body.position.y = 1.12;
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.72, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  screen.position.set(0, 1.48, 0.46);
  const header = createLegoBrick(1.52, 0.28, 0.94, LEGO_COLORS.yellow);
  header.position.y = 2.38;

  group.add(body, screen, header);
  group.userData.metroProp = 'ticket_machine';
  world.scene.add(group);

  const col = world.addCollider(x, z, 1.45, 0.92, yBase + 2.5, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: group,
      type: 'newsstand',
      hp: 22,
      radius: 1.15,
      height: 2.4,
      colliders: [col],
      debrisColors: [0x0284c7, LEGO_COLORS.yellow, LEGO_COLORS.silver],
      studDrops: { silver: 5, gold: 5, blue: 2, purple: 0 },
      groundY: yBase
    });
  }
}

function buildInteractiveMetroMapTotem(world, stationIndex) {
  const st = METRO_STATIONS[stationIndex];
  const nextSt = METRO_STATIONS[(stationIndex + 1) % METRO_STATIONS.length];

  // Posiciona os totens bem recuados da beira do trilho!
  let tx = st.platformSpawn.x;
  const ty = st.platformSpawn.y;
  let tz = st.platformSpawn.z;
  if (st.number === 1) {
    tx = 10.5;
    tz = -93.8;
  } else if (st.number === 2) {
    tx = -69.5;
    tz = 26.5;
  } else {
    const outerSide = st.number === 5 ? -1 : 1;
    tx = st.platformSpawn.x + outerSide * 4.2;
    tz = st.platformSpawn.z - 16.0;
  }

  const totemGroup = new THREE.Group();
  totemGroup.position.set(tx, ty, tz);

  const base = createLegoBrick(1.75, 0.36, 1.15, LEGO_COLORS.charcoal);
  base.position.y = 0.18;
  const frame = createLegoBrick(1.62, 2.65, 0.44, 0x0f172a, { studs: false });
  frame.position.y = 1.62;
  const crown = createLegoBrick(1.8, 0.34, 0.58, LEGO_COLORS.yellow);
  crown.position.y = 3.05;

  const screenW = 1.42;
  const screenH = 2.24;
  const mapTex = createCustomCanvasSignTexture(
    screenW,
    screenH,
    (ctx, W, H) => {
      ctx.fillStyle = '#090a0d';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 8;
      ctx.strokeRect(8, 8, W - 16, H - 16);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(12, 12, W - 24, Math.round(H * 0.14));

      const maxTextW = W * 0.82;
      fitAndDrawText(ctx, 'MAPA DO METRÔ', W * 0.5, H * 0.085, maxTextW, 30, {
        color: '#ffffff'
      });

      const cx = W * 0.5;
      const cy = H * 0.47;
      const r = Math.min(W, H) * 0.25;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        const sx = cx + Math.cos(a) * r;
        const sy = cy + Math.sin(a) * r;
        ctx.fillStyle = i === stationIndex ? '#facc15' : '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, i === stationIndex ? 12 : 8, 0, Math.PI * 2);
        ctx.fill();
      }

      fitAndDrawText(ctx, '[E] PRÓX. ESTAÇÃO', W * 0.5, H * 0.82, maxTextW, 24, {
        color: '#facc15'
      });
      fitAndDrawText(ctx, nextSt.shortName, W * 0.5, H * 0.91, maxTextW, 20, {
        color: '#e2e8f0',
        fontFamily: '"JetBrains Mono", monospace'
      });
    },
    { canvasHeight: 420 }
  );

  const mapMat = new THREE.MeshBasicMaterial({ map: mapTex });
  const screenF = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), mapMat);
  screenF.position.set(0, 1.65, 0.24);
  const screenB = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), mapMat);
  screenB.rotation.y = Math.PI;
  screenB.position.set(0, 1.65, -0.24);

  totemGroup.add(base, frame, crown, screenF, screenB);
  world.scene.add(totemGroup);
  world.addCollider(tx, tz, 1.65, 1.05, ty + 3.1, ty);

  return {
    id: `totem_${st.id}`,
    stationIndex,
    stationName: st.name,
    nextStationIndex: (stationIndex + 1) % METRO_STATIONS.length,
    nextStationName: nextSt.name,
    nextSpawn: { ...nextSt.platformSpawn },
    position: new THREE.Vector3(tx, ty, tz)
  };
}

// ============================================================================
// 5. CONSTRUÇÃO DAS 2 ESTAÇÕES SUBTERRÂNEAS AMPLAS (`Y = -10.5m`, PÉ-DIREITO 9.6m!)
// ============================================================================
function buildSidewalkSubwayEntrance(world, batcher, cutout, enterFromEast) {
  const { minX, maxX, minZ, maxZ } = cutout;
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const w = maxX - minX; // 28.0m!
  const d = maxZ - minZ; // 4.4m!
  const groundY = 0.28;

  // Grade Verde/Aço Estilo Metrô de NY/SP cercando os 3 lados da boca da escada na calçada!
  // Colisores laterais levemente recuados (w - 0.8) no pé da escada para nunca estreitar a saída em Y = -10.5m!
  const sideColX = cx + (enterFromEast ? 0.35 : -0.35);
  batcher.addBox('ny_entrance_green', w + 0.2, 1.18, 0.24, cx, groundY + 0.59, minZ - 0.14);
  batcher.addBox('ny_entrance_green', w + 0.2, 1.18, 0.24, cx, groundY + 0.59, maxZ + 0.14);
  world.addCollider(sideColX, minZ - 0.22, w - 0.7, 0.34, groundY + 1.28, -10.8);
  world.addCollider(sideColX, maxZ + 0.22, w - 0.7, 0.34, groundY + 1.28, -10.8);

  // REGRA CRÍTICA: A grade closedX existe APENAS na calçada (minY = groundY - 0.2, maxY = groundY + 1.35),
  // deixando um vão 100% LIVRE de Y = -10.5m até Y = -1.2m no pé da escada para entrar direto na plataforma!
  const closedX = enterFromEast ? minX - 0.16 : maxX + 0.16;
  const openX = enterFromEast ? maxX : minX;
  batcher.addBox('ny_entrance_green', 0.3, 1.18, d + 0.45, closedX, groundY + 0.59, cz);
  world.addCollider(closedX, cz, 0.44, d + 0.45, groundY + 1.35, groundY - 0.2);

  // Paredes laterais de ladrilhos brancos LEGO descendo até Y = -10.5m + Degraus largos!
  batcher.addBox('subway_tile_white', w - 0.2, 11.2, 0.32, sideColX, -5.2, minZ - 0.2);
  batcher.addBox('subway_tile_white', w - 0.2, 11.2, 0.32, sideColX, -5.2, maxZ + 0.2);
  batcher.addBox('subway_stripe_blue', w - 0.3, 0.42, 0.36, sideColX, -3.2, minZ - 0.18);
  batcher.addBox('subway_stripe_blue', w - 0.3, 0.42, 0.36, sideColX, -3.2, maxZ + 0.18);

  const steps = 32;
  for (let s = 0; s < steps; s++) {
    const t = (s + 0.5) / steps;
    const sx = enterFromEast ? THREE.MathUtils.lerp(maxX, minX, t) : THREE.MathUtils.lerp(minX, maxX, t);
    const sy = THREE.MathUtils.lerp(0.24, -10.5, t);
    batcher.addBox('platform_floor', w / steps + 0.16, 0.55, d, sx, sy - 0.26, cz);
  }

  // Pórtico Alto "METRÔ" (4.4m de altura livre na entrada da escada!) + 2 Globos Luminosos Verde-Esmeralda
  for (const pz of [minZ - 0.16, maxZ + 0.16]) {
    batcher.addBox('ny_entrance_green', 0.36, 4.5, 0.36, openX, groundY + 2.25, pz);
    batcher.addSphere('globe_emerald', 0.38, openX, groundY + 4.75, pz);
  }
  batcher.addBox('ny_entrance_green', 0.42, 0.9, d + 0.72, openX, groundY + 4.2, cz);
  addMetroSignBoard(
    world,
    openX + (enterFromEast ? 0.24 : -0.24),
    groundY + 4.2,
    cz,
    d + 0.4,
    0.84,
    'METRÔ • LINHA 01',
    'SUBSOLO MONUMENTAL',
    enterFromEast ? Math.PI / 2 : -Math.PI / 2,
    '#14532d',
    true
  );
}

function buildUndergroundStationsAndTunnel(world, batcher) {
  if (!world.undergroundFloors) world.undergroundFloors = [];

  const platFloorY = -10.5;
  const trackFloorY = -11.2;
  const ceilY = -0.9; // Pé-direito livre monumental de 9.6 METROS (-10.5m até -0.9m)!
  const wallH = ceilY - trackFloorY + 0.8; // 11.1m
  const wallMidY = (ceilY + trackFloorY) * 0.5; // -6.05m

  // --------------------------------------------------------------------------
  // 1) ESTAÇÃO 01 — CENTRAL / SUPER BANCO (`X = -94..+94, Z = -122..-89`, Piso `-10.5m`)
  //    Borda da plataforma a EXATOS 2.38m do trilho (`Z = -116.0 + 2.38 = -113.62` -> 8cm visuais e ZERO fresta!)
  // --------------------------------------------------------------------------
  const s1MinX = -94;
  const s1MaxX = 94;
  const s1MinZ = -122.0;
  const s1MaxZ = -89.0;
  const s1PlatEdgeZ = -113.62; // -116.0 + 2.38m (colada nos halfW = 2.30m do vagão!)
  const s1PlatDepth = s1MaxZ - s1PlatEdgeZ; // 24.62m
  const s1PlatCenterZ = (s1PlatEdgeZ + s1MaxZ) * 0.5;
  const s1W = s1MaxX - s1MinX; // 188m!
  const s1CX = 0;

  world.undergroundFloors.push(
    // Estende 0.28m sob a soleira da porta (-113.90) para ZERO fresta física ao embarcar!
    { id: 'st01_platform', minX: s1MinX, maxX: s1MaxX, minZ: s1PlatEdgeZ - 0.28, maxZ: s1MaxZ, floorY: platFloorY, ceilingY: ceilY },
    { id: 'st01_tracks', minX: s1MinX, maxX: s1MaxX, minZ: s1MinZ, maxZ: s1PlatEdgeZ - 0.28, floorY: trackFloorY, ceilingY: ceilY }
  );

  // Salão da Plataforma Sul (`Z = -113.62 .. -89.0`) + Faixa Tátil Amarela na Borda + Fosso de Trilhos
  batcher.addBox('platform_floor', s1W, 0.7, s1PlatDepth, s1CX, platFloorY - 0.35, s1PlatCenterZ);
  batcher.addBox('subway_stripe_gold', s1W - 6, 0.08, 0.68, s1CX, platFloorY + 0.04, s1PlatEdgeZ + 0.45);
  for (let sx = -76; sx <= 76; sx += 4.5) {
    batcher.studPositions.push([sx, platFloorY + 0.1, s1PlatEdgeZ + 0.45]);
  }
  batcher.addBox('tunnel_dark', s1W, 0.8, 9.2, s1CX, trackFloorY - 0.4, -117.6);

  // Teto Subterrâneo Alto em Y = -0.9m (recortado nas 2 escadarias longas de 28m!)
  const st1RoofRects = sliceRectAroundCutouts(
    { minX: s1MinX, maxX: s1MaxX, minZ: s1MinZ, maxZ: s1MaxZ },
    [METRO_ISLAND_CUTOUTS[0], METRO_ISLAND_CUTOUTS[1]]
  );
  for (const r of st1RoofRects) {
    const rw = r.maxX - r.minX;
    const rd = r.maxZ - r.minZ;
    const rx = (r.minX + r.maxX) * 0.5;
    const rz = (r.minZ + r.maxZ) * 0.5;
    batcher.addBox('subway_tile_white', rw, 0.62, rd, rx, ceilY + 0.31, rz);
    world.addCollider(rx, rz, rw, rd, -0.25, ceilY);
  }

  // Paredes de Ladrilhos Brancos LEGO Norte/Sul/Leste/Oeste + Placas COLADAS RENTE ÀS PAREDES DE FUNDO!
  batcher.addBox('subway_tile_white', s1W, wallH, 0.7, s1CX, wallMidY, s1MinZ);
  batcher.addBox('subway_stripe_blue', s1W, 0.75, 0.78, s1CX, -4.8, s1MinZ);
  batcher.addBox('subway_stripe_gold', s1W, 0.28, 0.8, s1CX, -5.3, s1MinZ);
  world.addCollider(s1CX, s1MinZ, s1W, 0.9, -0.5, trackFloorY - 0.5);

  batcher.addBox('subway_tile_white', s1W, wallH, 0.7, s1CX, wallMidY, s1MaxZ);
  batcher.addBox('subway_stripe_blue', s1W, 0.75, 0.78, s1CX, -4.8, s1MaxZ);
  batcher.addBox('subway_stripe_gold', s1W, 0.28, 0.8, s1CX, -5.3, s1MaxZ);
  world.addCollider(s1CX, s1MaxZ, s1W, 0.9, -0.5, trackFloorY - 0.5);

  // Paredes de fechamento Leste/Oeste na área da plataforma (deixando o túnel dos trilhos aberto!)
  batcher.addBox('subway_tile_white', 0.7, wallH, 22.4, s1MinX, wallMidY, -100.0);
  batcher.addBox('subway_tile_white', 0.7, wallH, 22.4, s1MaxX, wallMidY, -100.0);
  world.addCollider(s1MinX, -100.0, 0.9, 22.4, -0.5, trackFloorY - 0.5);
  world.addCollider(s1MaxX, -100.0, 0.9, 22.4, -0.5, trackFloorY - 0.5);

  // Colunas esbeltas afastadas no fundo, Luminárias no teto alto (-0.9m) e Bancos recuados (Z = -93.2)!
  for (let px = -72; px <= 72; px += 24) {
    batcher.addBox('ny_truss_charcoal', 0.75, ceilY - platFloorY, 0.75, px, (ceilY + platFloorY) * 0.5, -96.0);
    batcher.addBox('fluorescent_white', 6.8, 0.16, 1.1, px, ceilY - 0.08, -101.0);
    batcher.addBox('fluorescent_white', 6.8, 0.16, 0.85, px, ceilY - 0.08, -115.5);
    if (Math.abs(px) >= 18 && Math.abs(px) <= 54) {
      batcher.addBox('bench_wood', 4.4, 0.55, 1.2, px, platFloorY + 0.28, -92.2);
    }
  }

  // Placas 100% rentes às paredes Norte e Sul (ZERO placa pendurada no meio do caminho da câmera!)
  for (const sx of [-42, 0, 42]) {
    addMetroSignBoard(world, sx, -4.6, s1MaxZ - 0.42, 16.5, 2.1, 'ESTAÇÃO CENTRAL • SUPER BANCO', 'LINHA 01 CIRCULAR', Math.PI);
    addMetroSignBoard(world, sx, -4.6, s1MinZ + 0.42, 16.5, 2.1, 'CENTRAL / SUPER BANCO', 'SENTIDO TIMES SQ. • TORRE', 0);
  }

  for (const tz of [-106.5, -103.5, -100.5]) {
    spawnBreakableMetroTurnstile(world, -54.0, platFloorY, tz, Math.PI / 2);
    spawnBreakableMetroTurnstile(world, 54.0, platFloorY, tz, -Math.PI / 2);
  }
  spawnBreakableTicketMachine(world, -44.0, platFloorY, s1MaxZ - 0.9, Math.PI);
  spawnBreakableTicketMachine(world, 44.0, platFloorY, s1MaxZ - 0.9, Math.PI);

  // --------------------------------------------------------------------------
  // 2) ESTAÇÃO 02 — TIMES SQUARE / PARQUE (`X = -99..-54, Z = -24..+64`, Piso `-10.5m`)
  //    Borda da plataforma a EXATOS 2.38m do trilho (`X = -93.0 + 2.38 = -90.62` -> 8cm visuais e ZERO fresta!)
  // --------------------------------------------------------------------------
  const s2MinX = -99.0;
  const s2MaxX = -54.0;
  const s2MinZ = -24.0;
  const s2MaxZ = 64.0;
  const s2PlatEdgeX = -90.62; // -93.0 + 2.38m!
  const s2PlatW = s2MaxX - s2PlatEdgeX; // 36.62m
  const s2PlatCenterX = (s2PlatEdgeX + s2MaxX) * 0.5;
  const s2D = s2MaxZ - s2MinZ; // 88m!
  const s2CZ = (s2MinZ + s2MaxZ) * 0.5; // +20.0

  world.undergroundFloors.push(
    { id: 'st02_platform', minX: s2PlatEdgeX - 0.28, maxX: s2MaxX, minZ: s2MinZ, maxZ: s2MaxZ, floorY: platFloorY, ceilingY: ceilY },
    { id: 'st02_tracks', minX: s2MinX, maxX: s2PlatEdgeX - 0.28, minZ: s2MinZ, maxZ: s2MaxZ, floorY: trackFloorY, ceilingY: ceilY }
  );

  // Salão da Plataforma Leste (`X = -90.62 .. -54.0`) + Faixa Tátil Amarela + Fosso dos Trilhos
  batcher.addBox('platform_floor', s2PlatW, 0.7, s2D, s2PlatCenterX, platFloorY - 0.35, s2CZ);
  batcher.addBox('subway_stripe_gold', 0.68, 0.08, s2D - 6, s2PlatEdgeX + 0.45, platFloorY + 0.04, s2CZ);
  for (let sz = -16; sz <= 56; sz += 4.5) {
    batcher.studPositions.push([s2PlatEdgeX + 0.45, platFloorY + 0.1, sz]);
  }
  batcher.addBox('tunnel_dark', 9.2, 0.8, s2D, -94.8, trackFloorY - 0.4, s2CZ);

  const st2RoofRects = sliceRectAroundCutouts(
    { minX: s2MinX, maxX: s2MaxX, minZ: s2MinZ, maxZ: s2MaxZ },
    [METRO_ISLAND_CUTOUTS[2]]
  );
  for (const r of st2RoofRects) {
    const rw = r.maxX - r.minX;
    const rd = r.maxZ - r.minZ;
    const rx = (r.minX + r.maxX) * 0.5;
    const rz = (r.minZ + r.maxZ) * 0.5;
    batcher.addBox('subway_tile_white', rw, 0.62, rd, rx, ceilY + 0.31, rz);
    world.addCollider(rx, rz, rw, rd, -0.25, ceilY);
  }

  // Paredes Oeste, Leste, Norte e Sul da Estação 02
  batcher.addBox('subway_tile_white', 0.7, wallH, s2D, s2MinX, wallMidY, s2CZ);
  batcher.addBox('subway_stripe_blue', 0.78, 0.75, s2D, s2MinX, -4.8, s2CZ);
  batcher.addBox('subway_stripe_gold', 0.8, 0.28, s2D, s2MinX, -5.3, s2CZ);
  world.addCollider(s2MinX, s2CZ, 0.9, s2D, -0.5, trackFloorY - 0.5);

  batcher.addBox('subway_tile_white', 0.7, wallH, s2D, s2MaxX, wallMidY, s2CZ);
  batcher.addBox('subway_stripe_blue', 0.78, 0.75, s2D, s2MaxX, -4.8, s2CZ);
  world.addCollider(s2MaxX, s2CZ, 0.9, s2D, -0.5, trackFloorY - 0.5);

  batcher.addBox('subway_tile_white', 34.4, wallH, 0.7, -71.0, wallMidY, s2MinZ);
  batcher.addBox('subway_tile_white', 34.4, wallH, 0.7, -71.0, wallMidY, s2MaxZ);
  world.addCollider(-71.0, s2MinZ, 34.4, 0.9, -0.5, trackFloorY - 0.5);
  world.addCollider(-71.0, s2MaxZ, 34.4, 0.9, -0.5, trackFloorY - 0.5);

  for (let pz = -12; pz <= 52; pz += 16) {
    batcher.addBox('ny_truss_charcoal', 0.75, ceilY - platFloorY, 0.75, -66.0, (ceilY + platFloorY) * 0.5, pz);
    batcher.addBox('fluorescent_white', 1.1, 0.16, 6.4, -76.0, ceilY - 0.08, pz);
    batcher.addBox('fluorescent_white', 0.85, 0.16, 6.4, -93.0, ceilY - 0.08, pz);
    if (pz === -12 || pz === 4 || pz === 36 || pz === 52) {
      batcher.addBox('bench_wood', 1.2, 0.55, 4.2, -60.5, platFloorY + 0.28, pz);
    }
  }

  // Placas rentes às paredes Oeste e Leste (nunca no meio do ar!)
  for (const sz of [0, 40]) {
    addMetroSignBoard(world, s2MinX + 0.42, -4.6, sz, 16.5, 2.1, 'TIMES SQUARE • PARQUE', 'SENTIDO TORRE DOS HERÓIS', Math.PI / 2);
    addMetroSignBoard(world, s2MaxX - 0.42, -4.6, sz, 16.5, 2.1, 'ESTAÇÃO TIMES SQUARE', 'SAÍDA PARQUE CENTRAL', -Math.PI / 2);
  }

  for (const tx of [-80.5, -77.5, -74.5]) {
    spawnBreakableMetroTurnstile(world, tx, platFloorY, 10.5, 0);
  }
  spawnBreakableTicketMachine(world, -55.2, platFloorY, 32.0, -Math.PI / 2);
  spawnBreakableTicketMachine(world, -55.2, platFloorY, 36.0, -Math.PI / 2);

  // Entradas Amplas de 28m na Calçada das 2 Estações Subterrâneas
  buildSidewalkSubwayEntrance(world, batcher, METRO_ISLAND_CUTOUTS[0], true);
  buildSidewalkSubwayEntrance(world, batcher, METRO_ISLAND_CUTOUTS[1], false);
  buildSidewalkSubwayEntrance(world, batcher, METRO_ISLAND_CUTOUTS[2], true);

  // --------------------------------------------------------------------------
  // 3) TÚNEIS SUBTERRÂNEOS AMPLOS (`Y = -11.2m .. -0.9m`) & 2 PRAÇAS-PORTAL BLINDADAS (`X = ±82`)
  // --------------------------------------------------------------------------
  const tunnelCorridors = [
    // Portal Leste (X=82, Z=-136) -> Parede Norte da Estação 01 (Z=-122)
    { minX: 76, maxX: 90, minZ: -136, maxZ: -122 },
    // Parede Sul da Estação 01 (Z=-89) -> Parede Norte da Estação 02 (Z=-24) — sem cortar o salão da Estação 01!
    { minX: -99, maxX: -87, minZ: -89, maxZ: -24 },
    // Estação 02 (Z=+64) -> Alça Subterrânea Oeste (X=-174..-162) -> Portal Oeste (X=-82, Z=-136)
    { minX: -174, maxX: -87, minZ: 64, maxZ: 80 },
    { minX: -174, maxX: -162, minZ: -135, maxZ: 68 },
    { minX: -168, maxX: -76, minZ: -136, maxZ: -123 }
  ];

  for (const tc of tunnelCorridors) {
    world.undergroundFloors.push({
      id: 'metro_tunnel_seg',
      minX: tc.minX,
      maxX: tc.maxX,
      minZ: tc.minZ,
      maxZ: tc.maxZ,
      floorY: trackFloorY,
      ceilingY: ceilY
    });

    const cw = tc.maxX - tc.minX;
    const cd = tc.maxZ - tc.minZ;
    const cx = (tc.minX + tc.maxX) * 0.5;
    const cz = (tc.minZ + tc.maxZ) * 0.5;

    batcher.addBox('tunnel_dark', cw, 0.8, cd, cx, trackFloorY - 0.4, cz);
    batcher.addBox('tunnel_concrete', cw, 0.65, cd, cx, ceilY + 0.32, cz);
    world.addCollider(cx, cz, cw, cd, -0.25, ceilY);

    if (cw > cd) {
      batcher.addBox('tunnel_concrete', cw, wallH, 0.65, cx, wallMidY, tc.minZ);
      batcher.addBox('tunnel_concrete', cw, wallH, 0.65, cx, wallMidY, tc.maxZ);
      for (let lx = tc.minX + 10; lx <= tc.maxX - 10; lx += 18) {
        batcher.addBox('fluorescent_white', 4.6, 0.16, 0.55, lx, ceilY - 0.08, cz);
      }
    } else {
      batcher.addBox('tunnel_concrete', 0.65, wallH, cd, tc.minX, wallMidY, cz);
      batcher.addBox('tunnel_concrete', 0.65, wallH, cd, tc.maxX, wallMidY, cz);
      for (let lz = tc.minZ + 10; lz <= tc.maxZ - 10; lz += 18) {
        batcher.addBox('fluorescent_white', 0.55, 0.16, 4.6, cx, ceilY - 0.08, lz);
      }
    }
  }

  // Constrói as 2 Praças-Portal Blindadas Simétricas (X = -82 e X = +82, Z = -232..-131) — 100% fechadas sem vazar vazio!
  const buildArmoredPlazaPortal = (cutout, labelTitle) => {
    const { minX, maxX, minZ, maxZ } = cutout;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const w = maxX - minX; // 9.6m
    const d = maxZ - minZ; // 62.0m (-196..-134)

    // Calçamento Arquitetônico nas Praças Laterais ao redor da rampa (X = cx ± 22m, Z = -230..-131)
    batcher.addBox('plaza_granite', 14.0, 0.28, 98.0, cx - 13.0, 0.14, -180.5);
    batcher.addBox('plaza_granite', 14.0, 0.28, 98.0, cx + 13.0, 0.14, -180.5);

    // Caixa de Concreto Maciça no Fundo e Laterais da Trincheira (de Y = -12.4m até +1.65m — ZERO vazamento do vazio!)
    batcher.addBox('tunnel_dark', w + 2.0, 1.4, d + 2.0, cx, -12.1, cz);
    for (const sideX of [minX - 0.45, maxX + 0.45]) {
      batcher.addBox('tunnel_concrete', 0.9, 14.2, d + 1.6, sideX, -5.4, cz);
      batcher.addBox('ny_truss_green', 0.6, 1.25, d + 1.6, sideX, 1.15, cz);
      world.addCollider(sideX, cz, 0.95, d + 1.6, 1.8, -12.0);
    }
    // Mureta de cabeceira Sul em Z = maxZ (-134.0) + Pórtico Monumental do Túnel!
    batcher.addBox('tunnel_concrete', w + 1.8, 5.8, 1.6, cx, -1.2, maxZ);
    batcher.addBox('ny_truss_green', w + 2.0, 1.15, 1.2, cx, 2.1, maxZ);
    world.addCollider(cx, maxZ, w + 1.8, 1.6, 2.7, -3.8);

    addMetroSignBoard(
      world,
      cx,
      1.95,
      maxZ + 0.85,
      w + 1.2,
      1.35,
      labelTitle,
      'TRANSIÇÃO SUBSOLO • ELEVADO',
      0,
      '#14532d',
      true
    );
  };

  buildArmoredPlazaPortal(METRO_ISLAND_CUTOUTS[3], 'PORTAL OESTE • LINHA 01');
  buildArmoredPlazaPortal(METRO_ISLAND_CUTOUTS[4], 'PORTAL LESTE • LINHA 01');
}

// ============================================================================
// 6. TRILHOS CONTÍNUOS, LINHA ELEVADA (`Y = +14.2m`) & 3 ESTAÇÕES ELEVADAS GRANDES
// ============================================================================
function buildTrackBedAndElevatedManhattanStructure(world, batcher, spline) {
  const step = 6.0;
  const count = Math.floor(spline.totalLength / step);
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();
  const tan = new THREE.Vector3();

  const crossAvenuesX = [-516, -384, -252, -120, 0, 120, 252, 384, 516];
  const crossAvenuesZ = [-250, -117, 0, 134, 402, 556, 710];

  for (let i = 0; i < count; i++) {
    const s0 = i * step;
    const s1 = (i + 1) * step;
    spline.sampleAtS(s0, posA, tan);
    spline.sampleAtS(s1, posB);

    const mx = (posA.x + posB.x) * 0.5;
    const my = (posA.y + posB.y) * 0.5;
    const mz = (posA.z + posB.z) * 0.5;
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dz = posB.z - posA.z;
    const horizLen = Math.hypot(dx, dz) || 0.001;
    const segLen = Math.hypot(horizLen, dy) + 0.14;
    const rotY = Math.atan2(dx, dz);
    const rotX = -Math.atan2(dy, horizLen);

    // 1) Dormentes Largos + Trilhos Duplos Prateados para os novos vagões de 4.6m!
    batcher.addOrientedBox('wood_sleeper', 4.4, 0.18, 0.56, mx, my + 0.09, mz, rotX, rotY, 0);
    batcher.addOrientedBox('wood_sleeper', 4.4, 0.18, 0.56, posA.x, posA.y + 0.09, posA.z, rotX, rotY, 0);

    const perpX = Math.cos(rotY);
    const perpZ = -Math.sin(rotY);
    for (const rOff of [-1.35, 1.35]) {
      batcher.addOrientedBox(
        'rail_silver',
        0.18,
        0.24,
        segLen,
        mx + perpX * rOff,
        my + 0.25,
        mz + perpZ * rOff,
        rotX,
        rotY,
        0
      );
    }

    // 2) Rampa Blindada Fechada nos Portais (`my` entre `-11.0m` e `+4.5m`) — Caixa maciça de concreto sob os trilhos!
    if (my > -11.0 && my < 4.5) {
      batcher.addOrientedBox('tunnel_concrete', 7.8, 2.2, segLen + 0.2, mx, my - 1.1, mz, rotX, rotY, 0);
      if (my >= -0.5) {
        for (const gSide of [-3.65, 3.65]) {
          batcher.addOrientedBox(
            'ny_truss_green',
            0.45,
            1.35,
            segLen,
            mx + perpX * gSide,
            my + 0.65,
            mz + perpZ * gSide,
            rotX,
            rotY,
            0
          );
        }
      }
    }

    // 3) ESTRUTURA ELEVADA ESTILO MANHATTAN (`my >= 4.5m` até `+14.2m`)
    if (my >= 4.5) {
      batcher.addOrientedBox('ny_truss_green', 7.2, 1.05, segLen, mx, my - 0.56, mz, rotX, rotY, 0);
      batcher.addOrientedBox('ny_truss_charcoal', 7.6, 0.26, segLen, mx, my - 0.06, mz, rotX, rotY, 0);

      for (const gSide of [-3.55, 3.55]) {
        batcher.addOrientedBox(
          'ny_truss_charcoal',
          0.28,
          0.92,
          segLen,
          mx + perpX * gSide,
          my + 0.46,
          mz + perpZ * gSide,
          rotX,
          rotY,
          0
        );
      }

      if (my >= 8.0 && i % 6 === 0) {
        const mostlyAlongZ = Math.abs(dz) > Math.abs(dx);
        const hitsCrossRoad = mostlyAlongZ
          ? crossAvenuesZ.some((cz) => Math.abs(mz - cz) < 15.0)
          : crossAvenuesX.some((cx) => Math.abs(mx - cx) < 15.0);

        if (!hitsCrossRoad) {
          const groundY = world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(mx, mz)) : 0;
          const topColY = my - 1.02;
          const colH = topColY - groundY;
          if (colH > 3.0) {
            batcher.addOrientedBox('ny_truss_green', 7.6, 0.95, 1.2, mx, topColY - 0.35, mz, 0, rotY, 0);
            batcher.addBox('ny_truss_charcoal', 1.65, colH + 2.0, 1.65, mx, groundY + colH * 0.5 - 1.0, mz);
            world.addCollider(mx, mz, 1.7, 1.7, topColY, groundY);
          }
        }
      }
    }
  }
}

function buildThreeElevatedMetroStations(world, batcher) {
  const platY = 14.85;
  const roofY = 23.65; // 8.8 METROS de altura livre acima da plataforma!
  const pw = 12.5;     // 12.5 METROS de largura de plataforma!
  const lenZ = 62.0;   // 62.0 METROS de comprimento!

  // Borda interna a EXATOS 2.38m do eixo do trilho -> platCenterX = trackX + side * (2.38 + 6.25) = trackX + side * 8.63!
  const elevatedConfigs = [
    // Estação 03 — TORRE DOS HERÓIS (`trackX = -388.5, trackZ = -60`)
    {
      stationIndex: 2,
      trackX: -388.5,
      trackZ: -60.0,
      platSide: 1,
      platCenterX: -379.87, // Borda interna em -386.12 (= -388.5 + 2.38m -> 8cm visuais do vagão!)
      stairX: -368.0,
      stairZTop: -35.0,     // 6.0m dentro da plataforma (-91..-29), longe do guarda-corpo de cabeceira!
      stairZBot: 8.0
    },
    // Estação 04 — ORLA MARÍTIMA / PRAIA SUL (`trackX = -125.5, trackZ = +650`)
    {
      stationIndex: 3,
      trackX: -125.5,
      trackZ: 650.0,
      platSide: 1,
      platCenterX: -116.87, // Borda interna em -123.12 (= -125.5 + 2.38m!)
      stairX: -105.5,
      stairZTop: 668.0,     // Bem dentro da plataforma (619..681)!
      stairZBot: 700.0
    },
    // Estação 05 — MARGEM DO RIO / DISTRITO LESTE (`trackX = +518.0, trackZ = -180`)
    {
      stationIndex: 4,
      trackX: 518.0,
      trackZ: -180.0,
      platSide: -1,
      platCenterX: 509.37,  // Borda interna em +515.62 (= +518.0 - 2.38m!)
      stairX: 499.8,
      stairZTop: -155.0,    // 6.0m dentro da plataforma (-211..-149), longe da cabeceira Sul!
      stairZBot: -116.0
    }
  ];

  for (const cfg of elevatedConfigs) {
    const st = METRO_STATIONS[cfg.stationIndex];
    const side = cfg.platSide;
    const px = cfg.platCenterX;
    const platMinZ = cfg.trackZ - lenZ * 0.5;
    const platMaxZ = cfg.trackZ + lenZ * 0.5;

    // Estende 0.28m sob a soleira da porta do trem (2.10m do trilho) para ZERO fresta física ao embarcar!
    const deckMinX = side > 0 ? px - pw * 0.5 - 0.28 : px - pw * 0.5;
    const deckMaxX = side > 0 ? px + pw * 0.5 : px + pw * 0.5 + 0.28;

    world.elevatedDecks.push({
      id: `${st.id}_plat`,
      minX: deckMinX,
      maxX: deckMaxX,
      minZ: platMinZ,
      maxZ: platMaxZ,
      thresholdBelow: 2.5,
      getDeckY: () => platY
    });

    // Laje larga de 12.5m x 62m + Faixa Amarela Tátil colada a 2.38m do eixo do trilho!
    batcher.addBox('ny_truss_green', pw + 0.4, 1.05, lenZ, px, platY - 0.72, cfg.trackZ);
    batcher.addBox('platform_floor', pw, 0.44, lenZ, px, platY - 0.22, cfg.trackZ);
    const trackEdgeX = px - side * (pw * 0.5 - 0.36);
    batcher.addBox('subway_stripe_gold', 0.52, 0.06, lenZ - 2, trackEdgeX, platY + 0.03, cfg.trackZ);

    // Guarda-corpo externo RECORTADO com um VÃO ABERTO AMPLO DE 6.0m na junção da passarela (stairZTop ± 3.0m)!
    const outerX = px + side * (pw * 0.5 - 0.22);
    const gapHalfZ = 3.0;
    const gapMinZ = cfg.stairZTop - gapHalfZ;
    const gapMaxZ = cfg.stairZTop + gapHalfZ;

    if (gapMinZ > platMinZ + 0.3) {
      const seg1Len = gapMinZ - platMinZ;
      const seg1CZ = (platMinZ + gapMinZ) * 0.5;
      batcher.addBox('ny_truss_green', 0.38, 1.15, seg1Len, outerX, platY + 0.58, seg1CZ);
      world.addCollider(outerX, seg1CZ, 0.5, seg1Len, platY + 1.25, platY);
    }
    if (platMaxZ > gapMaxZ + 0.3) {
      const seg2Len = platMaxZ - gapMaxZ;
      const seg2CZ = (gapMaxZ + platMaxZ) * 0.5;
      batcher.addBox('ny_truss_green', 0.38, 1.15, seg2Len, outerX, platY + 0.58, seg2CZ);
      world.addCollider(outerX, seg2CZ, 0.5, seg2Len, platY + 1.25, platY);
    }

    // Cobertura Monumental Arejada em `roofY = +23.65m` (8.8m livres acima da plataforma!)
    const canopyW = pw + 7.4;
    const canopyCX = (px + cfg.trackX) * 0.5 + side * 1.6;
    batcher.addBox('ny_truss_green', canopyW, 0.75, lenZ + 3, canopyCX, roofY, cfg.trackZ);
    batcher.addBox('subway_stripe_blue', canopyW + 0.3, 0.28, lenZ + 3.2, canopyCX, roofY + 0.48, cfg.trackZ);

    // Pilares esbeltos fora do vão de 6.0m da escada + Luminárias altas + Bancos recuados
    for (let cz = cfg.trackZ - 24; cz <= cfg.trackZ + 24; cz += 16) {
      if (Math.abs(cz - cfg.stairZTop) > 3.6) {
        batcher.addBox('ny_truss_charcoal', 0.46, roofY - platY, 0.46, outerX - side * 0.35, (platY + roofY) * 0.5, cz);
      }
      batcher.addBox('fluorescent_white', 4.2, 0.16, 0.75, px, roofY - 0.42, cz);
      if (Math.abs(cz - cfg.trackZ) > 6 && Math.abs(cz - cfg.stairZTop) > 4.5) {
        batcher.addBox('bench_wood', 1.25, 0.55, 4.2, px + side * 3.2, platY + 0.28, cz);
      }
    }

    // Guarda-corpos nas cabeceiras Norte/Sul da plataforma (recortados caso a escada encoste na cabeceira)
    batcher.addBox('ny_truss_green', pw, 1.15, 0.38, px, platY + 0.58, platMinZ);
    world.addCollider(px, platMinZ, pw, 0.5, platY + 1.3, platY);
    if (Math.abs(platMaxZ - cfg.stairZTop) > 3.2) {
      batcher.addBox('ny_truss_green', pw, 1.15, 0.38, px, platY + 0.58, platMaxZ);
      world.addCollider(px, platMaxZ, pw, 0.5, platY + 1.3, platY);
    }

    // Placa Externa e Placa Interna alta na testeira da cobertura (+23.1m)
    addMetroSignBoard(
      world,
      outerX + side * 0.28,
      roofY - 0.1,
      cfg.trackZ,
      22.0,
      1.95,
      st.name,
      'PLATAFORMA ELEVADA (+14.9M)',
      side > 0 ? Math.PI / 2 : -Math.PI / 2,
      '#14532d',
      true
    );

    // Passarela Lateral de 6.0m de largura (conectando direto ao centro da plataforma sem degrau nem mureta!)
    const stairBotY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(cfg.stairX, cfg.stairZBot) : 0) + 0.28;
    const bridgeInnerX = px + side * (pw * 0.5 - 1.2);
    const bridgeOuterX = cfg.stairX + side * 2.0;
    const bridgeMinX = Math.min(bridgeInnerX, bridgeOuterX);
    const bridgeMaxX = Math.max(bridgeInnerX, bridgeOuterX);
    const bw = bridgeMaxX - bridgeMinX;
    const bx = (bridgeMinX + bridgeMaxX) * 0.5;
    batcher.addBox('ny_truss_green', bw, 0.6, 6.0, bx, platY - 0.3, cfg.stairZTop);
    batcher.addBox('platform_floor', bw, 0.22, 5.8, bx, platY - 0.08, cfg.stairZTop);
    world.elevatedDecks.push({
      id: `${st.id}_bridge`,
      minX: Math.min(px, bridgeMinX),
      maxX: Math.max(px, bridgeMaxX),
      minZ: cfg.stairZTop - 3.0,
      maxZ: cfg.stairZTop + 3.0,
      thresholdBelow: 2.6,
      getDeckY: () => platY
    });

    const zMinStair = Math.min(cfg.stairZTop, cfg.stairZBot);
    const zMaxStair = Math.max(cfg.stairZTop, cfg.stairZBot);
    world.elevatedDecks.push({
      id: `${st.id}_stairs`,
      minX: cfg.stairX - 2.1,
      maxX: cfg.stairX + 2.1,
      minZ: zMinStair - 0.8,
      maxZ: zMaxStair + 0.8,
      thresholdBelow: 2.8,
      getDeckY: (_x, z) => {
        const t = THREE.MathUtils.clamp((z - cfg.stairZTop) / (cfg.stairZBot - cfg.stairZTop), 0, 1);
        return THREE.MathUtils.lerp(platY, stairBotY, t);
      }
    });

    const stairSteps = 32;
    for (let s = 0; s < stairSteps; s++) {
      const t = (s + 0.5) / stairSteps;
      const sz = THREE.MathUtils.lerp(cfg.stairZTop, cfg.stairZBot, t);
      const sy = THREE.MathUtils.lerp(platY, stairBotY, t);
      batcher.addBox('platform_floor', 3.8, 0.45, 1.4, cfg.stairX, sy - 0.2, sz);
      batcher.addBox('ny_truss_green', 0.2, 1.1, 1.4, cfg.stairX - 1.95, sy + 0.48, sz);
      batcher.addBox('ny_truss_green', 0.2, 1.1, 1.4, cfg.stairX + 1.95, sy + 0.48, sz);
    }

    const midStairZ = (cfg.stairZTop + cfg.stairZBot) * 0.5;
    const midGroundY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cfg.stairX, midStairZ) : 0;
    const midTopY = (platY + stairBotY) * 0.5 - 0.4;
    const midColH = Math.max(2.0, midTopY - midGroundY);
    batcher.addBox('ny_truss_charcoal', 0.72, midColH + 1.2, 0.72, cfg.stairX, midGroundY + midColH * 0.5 - 0.6, midStairZ);

    world.mapBuildings.push({
      x: cfg.trackX,
      z: cfg.trackZ,
      w: 22,
      d: lenZ,
      height: 24,
      color: '#0284c7',
      isLandmark: true,
      label: st.shortName
    });
  }
}

// ============================================================================
// 7. VAGÕES DO METRÔ AMPLIADOS (`4.6m` LARGURA, `4.5m` ALTURA INTERNA, PORTAS `2.8m`!)
// ============================================================================
function createLegoMetroCarMesh(isFrontCab, isRearCab, materials) {
  const group = new THREE.Group();
  const carW = 4.6;         // 4.6m de largura!
  const carLen = 13.6;      // 13.6m de comprimento!
  const floorY = 0.65;      // Alinhado cravado com -10.5m no subsolo e +14.85m nas estações elevadas!
  const clearInnerH = 4.5;  // 4.5m de altura interna livre!
  const roofBottomY = floorY + clearInnerH; // 5.15m
  const roofTopY = roofBottomY + 0.28;      // 5.43m

  const staticSilver = [];
  const staticCyan = [];
  const staticYellow = [];
  const staticDark = [];
  const staticSeat = [];
  const staticGlass = [];
  const staticLight = [];

  // 1) Truques Ferroviários + Chassi + Piso Interno LEGO + Teto Alto Prateado
  staticDark.push(
    makeTranslatedBox(3.4, 0.44, 2.8, 0, 0.24, -4.2),
    makeTranslatedBox(3.4, 0.44, 2.8, 0, 0.24, 4.2),
    makeTranslatedBox(carW - 0.12, 0.22, carLen, 0, floorY - 0.12, 0)
  );
  staticSilver.push(
    makeTranslatedBox(carW, 0.16, carLen, 0, floorY, 0),
    makeTranslatedBox(carW, 0.28, carLen, 0, roofBottomY + 0.14, 0),
    makeTranslatedBox(carW - 0.7, 0.16, carLen - 0.5, 0, roofTopY + 0.06, 0)
  );

  // Luminárias internas no teto alto (5.1m) — ZERO barra no meio do corredor para não atrapalhar a câmera!
  staticLight.push(makeTranslatedBox(0.85, 0.1, carLen - 1.8, 0, roofBottomY - 0.06, 0));

  // 2) Paredes Laterais com 2 Vãos Largos de Porta de `2.80m` cada (`z = -2.85` e `z = +2.85`)!
  // Pilares ao longo de Z: [-6.8..-4.25] (2.55m), [-1.45..+1.45] (2.90m), [+4.25..+6.8] (2.55m)
  const wallPillars = [
    { cz: -5.525, len: 2.55 },
    { cz: 0.0, len: 2.9 },
    { cz: 5.525, len: 2.55 }
  ];

  for (const side of [-1, 1]) {
    const wx = side * (carW * 0.5 - 0.1);
    // Verga superior acima das portas amplas (de Y = 4.45m até 5.15m -> vão livre de porta de 3.80m de altura!)
    staticSilver.push(makeTranslatedBox(0.2, 0.68, carLen, wx, roofBottomY - 0.34, 0));
    staticCyan.push(makeTranslatedBox(0.22, 0.22, carLen + 0.02, wx, roofBottomY - 0.56, 0));

    for (const wp of wallPillars) {
      staticSilver.push(makeTranslatedBox(0.2, 1.05, wp.len, wx, floorY + 0.58, wp.cz));
      staticCyan.push(makeTranslatedBox(0.23, 0.28, wp.len + 0.02, wx, floorY + 0.88, wp.cz));
      staticYellow.push(makeTranslatedBox(0.24, 0.13, wp.len + 0.02, wx, floorY + 0.66, wp.cz));
      staticSilver.push(
        makeTranslatedBox(0.2, 2.75, 0.28, wx, floorY + 2.48, wp.cz - wp.len * 0.5 + 0.14),
        makeTranslatedBox(0.2, 2.75, 0.28, wx, floorY + 2.48, wp.cz + wp.len * 0.5 - 0.14)
      );
      staticGlass.push(makeTranslatedBox(0.09, 2.65, wp.len - 0.52, wx, floorY + 2.48, wp.cz));

      // Bancos Internos Azuis LEGO encostados nas janelas laterais (deixando corredor central de 3.3m livres!)
      staticSeat.push(
        makeTranslatedBox(0.56, 0.4, wp.len - 0.3, side * (carW * 0.5 - 0.48), floorY + 0.26, wp.cz),
        makeTranslatedBox(0.16, 0.55, wp.len - 0.3, side * (carW * 0.5 - 0.26), floorY + 0.66, wp.cz)
      );
    }
  }

  // 3) Cabeceiras Frontal (+Z) e Traseira (-Z)
  const addEndBulkhead = (zSign, isCab) => {
    const ez = zSign * (carLen * 0.5 - 0.14);
    if (isCab) {
      staticSilver.push(
        makeTranslatedBox(carW, 1.25, 0.26, 0, floorY + 0.62, ez),
        makeTranslatedBox(carW, 0.72, 0.26, 0, roofBottomY - 0.36, ez),
        makeTranslatedBox(0.55, 2.55, 0.26, -carW * 0.5 + 0.28, floorY + 2.52, ez),
        makeTranslatedBox(0.55, 2.55, 0.26, carW * 0.5 - 0.28, floorY + 2.52, ez)
      );
      staticCyan.push(makeTranslatedBox(carW + 0.04, 0.28, 0.28, 0, floorY + 0.88, ez));
      staticYellow.push(makeTranslatedBox(carW + 0.05, 0.14, 0.29, 0, floorY + 0.66, ez));
      staticGlass.push(makeTranslatedBox(carW - 1.08, 2.45, 0.1, 0, floorY + 2.52, ez));

      const hlMat = zSign > 0 ? materials.headlight : materials.taillight;
      for (const hx of [-1.45, 1.45]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.14), hlMat);
        hl.position.set(hx, floorY + 0.42, ez + zSign * 0.14);
        group.add(hl);
      }
      staticLight.push(makeTranslatedBox(2.0, 0.28, 0.3, 0, roofBottomY - 0.34, ez + zSign * 0.05));
    } else {
      // Passagem larga de 2.4m entre os vagões!
      staticSilver.push(
        makeTranslatedBox(1.05, 4.4, 0.22, -carW * 0.5 + 0.52, floorY + 2.25, ez),
        makeTranslatedBox(1.05, 4.4, 0.22, carW * 0.5 - 0.52, floorY + 2.25, ez),
        makeTranslatedBox(carW, 0.6, 0.22, 0, roofBottomY - 0.3, ez)
      );
      staticDark.push(makeTranslatedBox(2.55, 4.0, 0.72, 0, floorY + 2.05, ez + zSign * 0.38));
    }
  };
  addEndBulkhead(1, isFrontCab);
  addEndBulkhead(-1, isRearCab);

  const addMerged = (geos, mat, castShadow = false) => {
    if (geos.length === 0) return;
    const m = new THREE.Mesh(mergeBufferGeometries(geos), mat);
    for (let i = 0; i < geos.length; i++) geos[i].dispose();
    m.castShadow = castShadow;
    m.receiveShadow = true;
    group.add(m);
  };

  addMerged(staticSilver, materials.silver, true);
  addMerged(staticCyan, materials.cyan, false);
  addMerged(staticYellow, materials.yellow, false);
  addMerged(staticDark, materials.dark, false);
  addMerged(staticSeat, materials.seatBlue, false);
  addMerged(staticGlass, materials.glass, false);
  addMerged(staticLight, materials.interiorLight, false);

  // 4) PORTAS LATERAIS DESLIZANTES AMPLAS DE `2.80m` (2 Folhas de `1.40m` por vão!)
  const leftDoorLeaves = [];
  const rightDoorLeaves = [];

  for (const side of [-1, 1]) {
    const dx = side * (carW * 0.5 - 0.04);
    for (const doorCenterZ of [-2.85, 2.85]) {
      for (const leafDir of [-1, 1]) {
        const baseZ = doorCenterZ + leafDir * 0.7;
        const leafGeos = [
          makeTranslatedBox(0.11, 1.18, 1.4, 0, floorY + 0.62, 0),
          makeTranslatedBox(0.11, 0.42, 1.4, 0, floorY + 3.58, 0),
          makeTranslatedBox(0.11, 2.2, 0.2, 0, floorY + 2.28, -0.6),
          makeTranslatedBox(0.11, 2.2, 0.2, 0, floorY + 2.28, 0.6)
        ];
        const leafMesh = new THREE.Mesh(mergeBufferGeometries(leafGeos), materials.cyan);
        for (let i = 0; i < leafGeos.length; i++) leafGeos[i].dispose();
        const leafWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.12, 1.0), materials.glass);
        leafWin.position.y = floorY + 2.28;
        leafMesh.add(leafWin);
        leafMesh.position.set(dx, 0, baseZ);
        group.add(leafMesh);

        const entry = { mesh: leafMesh, baseZ, slideSign: leafDir };
        if (side > 0) leftDoorLeaves.push(entry);
        else rightDoorLeaves.push(entry);
      }
    }
  }

  return {
    group,
    leftDoorLeaves,
    rightDoorLeaves
  };
}

class MetroSystemRuntime {
  constructor(world, spline, totems) {
    this.world = world;
    this.spline = spline;
    this.totems = totems;
    this.stations = spline.stationStops;
    this.trains = [];

    const materials = {
      silver: getLegoMaterial(0xe2e8f0, { roughness: 0.18, metalness: 0.62, clearcoat: 0.75 }),
      cyan: getLegoMaterial(0x06b6d4, { roughness: 0.22, clearcoat: 0.55 }),
      yellow: getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.55 }),
      dark: getLegoMaterial(0x18181b, { roughness: 0.42 }),
      seatBlue: getLegoMaterial(0x1d4ed8, { roughness: 0.28 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xbae6fd,
        roughness: 0.08,
        transparent: true,
        opacity: 0.32,
        clearcoat: 0.9
      }),
      interiorLight: new THREE.MeshBasicMaterial({ color: 0xfef9c3 }),
      headlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      taillight: new THREE.MeshBasicMaterial({ color: 0xef4444 })
    };

    const startOffsets = [
      (this.stations[0].stopS - 30 + spline.totalLength) % spline.totalLength,
      (this.stations[0].stopS + spline.totalLength * 0.5) % spline.totalLength
    ];

    for (let t = 0; t < 2; t++) {
      const cars = [];
      for (let c = 0; c < 3; c++) {
        const visual = createLegoMetroCarMesh(c === 0, c === 2, materials);
        world.scene.add(visual.group);
        cars.push({
          carIndex: c,
          sOffset: (1 - c) * 14.45,
          group: visual.group,
          leftDoorLeaves: visual.leftDoorLeaves,
          rightDoorLeaves: visual.rightDoorLeaves,
          pos: new THREE.Vector3(),
          prevPos: new THREE.Vector3(),
          deltaPos: new THREE.Vector3(),
          rotY: 0,
          prevRotY: 0,
          deltaRotY: 0,
          rotX: 0,
          leftOpenRatio: 0,
          rightOpenRatio: 0,
          halfW: 2.3,
          halfL: 6.8,
          floorOffsetY: 0.65,
          roofOffsetY: 5.45
        });
      }

      const train = {
        id: `metro_train_${t + 1}`,
        s: startOffsets[t],
        cruiseSpeed: 28.0,
        speed: 22.0,
        state: 'MOVING',
        stopTimer: 0,
        lastStoppedStationId: null,
        currentStation: null,
        departCooldown: 0,
        chimePlayedClose: false,
        leftOpenRatio: 0,
        rightOpenRatio: 0,
        cars
      };
      this.trains.push(train);
      this._syncTrainCarsTransform(train, true);
    }
  }

  _syncTrainCarsTransform(train, isInit = false) {
    const tmpPos = new THREE.Vector3();
    const tmpTan = new THREE.Vector3();

    for (const car of train.cars) {
      if (!isInit) {
        car.prevPos.copy(car.pos);
        car.prevRotY = car.rotY;
      }

      this.spline.sampleAtS(train.s + car.sOffset, tmpPos, tmpTan);
      car.pos.copy(tmpPos);
      const horiz = Math.hypot(tmpTan.x, tmpTan.z) || 0.001;
      car.rotY = Math.atan2(tmpTan.x, tmpTan.z);
      car.rotX = -Math.atan2(tmpTan.y, horiz);

      if (isInit) {
        car.prevPos.copy(car.pos);
        car.prevRotY = car.rotY;
        car.deltaPos.set(0, 0, 0);
        car.deltaRotY = 0;
      } else {
        car.deltaPos.subVectors(car.pos, car.prevPos);
        let dYaw = car.rotY - car.prevRotY;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        car.deltaRotY = dYaw;
      }

      car.group.position.copy(car.pos);
      car.group.rotation.order = 'YXZ';
      car.group.rotation.set(car.rotX, car.rotY, 0);

      // Abertura ampla das Portas Deslizantes de 2.80m (1.36m para cada folha!)
      const slideDist = 1.36;
      for (const lf of car.leftDoorLeaves) {
        lf.mesh.position.z = lf.baseZ + lf.slideSign * slideDist * car.leftOpenRatio;
      }
      for (const rf of car.rightDoorLeaves) {
        rf.mesh.position.z = rf.baseZ + rf.slideSign * slideDist * car.rightOpenRatio;
      }
    }
  }

  _setTrainDoors(train, openRatio, doorSide = 'both') {
    const leftVal = doorSide === 'left' || doorSide === 'both' ? openRatio : 0;
    const rightVal = doorSide === 'right' || doorSide === 'both' ? openRatio : 0;
    train.leftOpenRatio = leftVal;
    train.rightOpenRatio = rightVal;
    for (const car of train.cars) {
      car.leftOpenRatio = leftVal;
      car.rightOpenRatio = rightVal;
    }
  }

  _playChimeIfNearPlayer(train, playerPos) {
    if (!playerPos || typeof soundFX?.playMetroDingDong !== 'function') return;
    const midCar = train.cars[1];
    const dist = midCar.pos.distanceTo(playerPos);
    if (dist < 145) {
      const vol = THREE.MathUtils.clamp(1.0 - dist / 150, 0.16, 0.9);
      soundFX.playMetroDingDong(vol);
    }
  }

  update(dt, playerPos = null) {
    const totalLen = this.spline.totalLength;

    for (const train of this.trains) {
      if (train.state === 'STOPPED') {
        train.stopTimer -= dt;
        const elapsed = 5.0 - train.stopTimer;
        let ratio = 1.0;
        if (elapsed < 0.55) {
          ratio = elapsed / 0.55;
        } else if (train.stopTimer < 0.65) {
          if (!train.chimePlayedClose) {
            train.chimePlayedClose = true;
            this._playChimeIfNearPlayer(train, playerPos);
          }
          ratio = Math.max(0, train.stopTimer / 0.65);
        }

        this._setTrainDoors(train, THREE.MathUtils.clamp(ratio, 0, 1), train.currentStation?.doorSide || 'both');

        if (train.stopTimer <= 0) {
          this._setTrainDoors(train, 0, 'both');
          train.state = 'MOVING';
          train.departCooldown = 3.5;
          train.speed = 2.5;
        }

        this._syncTrainCarsTransform(train, false);
        continue;
      }

      train.departCooldown = Math.max(0, train.departCooldown - dt);
      let nearestAheadSt = null;
      let minAheadDist = Infinity;

      if (train.departCooldown <= 0) {
        for (const st of this.stations) {
          let ahead = st.stopS - train.s;
          if (ahead < -2.0) ahead += totalLen;
          if (ahead >= -1.5 && ahead < minAheadDist) {
            minAheadDist = ahead;
            nearestAheadSt = st;
          }
        }
      }

      if (nearestAheadSt && minAheadDist <= 46.0) {
        if (minAheadDist <= 0.65) {
          train.s = nearestAheadSt.stopS;
          train.speed = 0;
          train.state = 'STOPPED';
          train.stopTimer = 5.0;
          train.chimePlayedClose = false;
          train.currentStation = nearestAheadSt;
          train.lastStoppedStationId = nearestAheadSt.id;
          this._playChimeIfNearPlayer(train, playerPos);
          this._syncTrainCarsTransform(train, false);
          continue;
        }
        const targetBrakeSpeed = Math.max(2.4, train.cruiseSpeed * Math.sqrt(Math.max(0, minAheadDist) / 46.0));
        train.speed = THREE.MathUtils.lerp(train.speed, targetBrakeSpeed, Math.min(1, dt * 6.0));
      } else {
        train.speed = THREE.MathUtils.lerp(train.speed, train.cruiseSpeed, Math.min(1, dt * 2.2));
      }

      const stepS = train.speed * dt;
      if (nearestAheadSt && minAheadDist > 0 && stepS >= minAheadDist) {
        train.s = nearestAheadSt.stopS;
        train.speed = 0;
        train.state = 'STOPPED';
        train.stopTimer = 5.0;
        train.chimePlayedClose = false;
        train.currentStation = nearestAheadSt;
        this._playChimeIfNearPlayer(train, playerPos);
      } else {
        train.s = (train.s + stepS) % totalLen;
      }

      this._syncTrainCarsTransform(train, false);
    }
  }

  _worldToCarLocal(car, wx, wz) {
    const dx = wx - car.pos.x;
    const dz = wz - car.pos.z;
    const cos = Math.cos(-car.rotY);
    const sin = Math.sin(-car.rotY);
    return {
      lx: dx * cos + dz * sin,
      lz: -dx * sin + dz * cos
    };
  }

  _carLocalToWorld(car, lx, lz) {
    const cos = Math.cos(car.rotY);
    const sin = Math.sin(car.rotY);
    return {
      wx: car.pos.x + lx * cos + lz * sin,
      wz: car.pos.z - lx * sin + lz * cos
    };
  }

  findSupportingCarAt(x, z, currentY) {
    let best = null;
    for (const train of this.trains) {
      for (const car of train.cars) {
        if (Math.abs(x - car.pos.x) > 10.5 || Math.abs(z - car.pos.z) > 10.5) continue;
        const { lx, lz } = this._worldToCarLocal(car, x, z);
        if (Math.abs(lx) > car.halfW + 0.22 || Math.abs(lz) > car.halfL + 0.22) continue;

        const roofY = car.pos.y + car.roofOffsetY + (lz / car.halfL) * Math.sin(-car.rotX) * car.halfL;
        const floorY = car.pos.y + car.floorOffsetY + (lz / car.halfL) * Math.sin(-car.rotX) * car.halfL;

        if (currentY >= roofY - 1.15 && currentY <= roofY + 3.0) {
          if (!best || roofY > best.supportY) {
            best = { car, supportY: roofY, zone: 'roof' };
          }
        } else if (
          Math.abs(lx) <= car.halfW - 0.04 &&
          Math.abs(lz) <= car.halfL - 0.08 &&
          currentY >= floorY - 0.9 &&
          currentY < roofY - 1.15
        ) {
          if (!best || floorY > best.supportY) {
            best = { car, supportY: floorY, zone: 'interior' };
          }
        }
      }
    }
    return best;
  }

  resolveHorizontalCarCollision(pos, playerRadius = 0.45) {
    for (const train of this.trains) {
      for (const car of train.cars) {
        if (Math.abs(pos.x - car.pos.x) > 11.0 || Math.abs(pos.z - car.pos.z) > 11.0) continue;
        const bottomY = car.pos.y + 0.2;
        const topY = car.pos.y + car.roofOffsetY - 0.25;
        if (pos.y >= topY || pos.y + 1.8 <= bottomY) continue;

        let { lx, lz } = this._worldToCarLocal(car, pos.x, pos.z);
        const prevLocal = this._worldToCarLocal(car, pos.x - car.deltaPos.x, pos.z - car.deltaPos.z);
        const wasInside =
          Math.abs(prevLocal.lx) < car.halfW - 0.08 && Math.abs(prevLocal.lz) < car.halfL - 0.08;

        // Vãos largos de 2.80m em lz = ±2.85m!
        const inDoorwayZ = Math.abs(lz - 2.85) < 1.32 || Math.abs(lz + 2.85) < 1.32;
        const leftOpen = car.leftOpenRatio > 0.55 && inDoorwayZ;
        const rightOpen = car.rightOpenRatio > 0.55 && inDoorwayZ;

        if (wasInside) {
          const maxInZ = car.halfL - playerRadius * 0.65;
          if (Math.abs(lz) > maxInZ) lz = Math.sign(lz) * maxInZ;

          const maxInX = car.halfW - playerRadius * 0.65;
          if (lx > maxInX && !leftOpen) lx = maxInX;
          if (lx < -maxInX && !rightOpen) lx = -maxInX;

          const w = this._carLocalToWorld(car, lx, lz);
          pos.x = w.wx;
          pos.z = w.wz;
        } else {
          const extX = car.halfW + playerRadius;
          const extZ = car.halfL + playerRadius;
          if (Math.abs(lx) < extX && Math.abs(lz) < extZ) {
            if ((lx > 0 && leftOpen) || (lx < 0 && rightOpen)) {
              continue;
            }
            const penX = extX - Math.abs(lx);
            const penZ = extZ - Math.abs(lz);
            if (penX < penZ) {
              lx = (lx >= 0 ? 1 : -1) * extX;
            } else {
              lz = (lz >= 0 ? 1 : -1) * extZ;
            }
            const w = this._carLocalToWorld(car, lx, lz);
            pos.x = w.wx;
            pos.z = w.wz;
          }
        }
      }
    }
  }

  getLiveTrainMapMarkers() {
    return this.trains.map((t, idx) => {
      const mid = t.cars[1];
      return {
        id: t.id,
        number: idx + 1,
        x: mid.pos.x,
        y: mid.pos.y,
        z: mid.pos.z,
        rotY: mid.rotY,
        isUnderground: mid.pos.y < -1.5,
        state: t.state
      };
    });
  }
}

// ============================================================================
// 8. ENTRYPOINT PRINCIPAL EXPORTADO PARA `TestBlockWorld.js`
// ============================================================================
export function buildMetroSystem(world) {
  if (!world.elevatedDecks) world.elevatedDecks = [];
  if (!world.undergroundFloors) world.undergroundFloors = [];

  const batcher = createMetroBatcher();
  const spline = buildClosedMetroLoopSpline();

  buildUndergroundStationsAndTunnel(world, batcher);
  buildTrackBedAndElevatedManhattanStructure(world, batcher, spline);
  buildThreeElevatedMetroStations(world, batcher);

  const totems = [];
  for (let i = 0; i < METRO_STATIONS.length; i++) {
    totems.push(buildInteractiveMetroMapTotem(world, i));
  }
  world.metroTotems = totems;

  batcher.flush(world.scene);

  world.metroSystem = new MetroSystemRuntime(world, spline, totems);
  world.metroData = {
    stationsCount: METRO_STATIONS.length,
    undergroundStationsCount: 2,
    elevatedStationsCount: 3,
    trainsCount: 2,
    carsPerTrain: 3,
    loopLengthMeters: Math.round(spline.totalLength)
  };
}
