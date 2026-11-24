// Auditoria de "barreiras invisíveis" — Etapa 2.0 do PLANO_CONTROLE_REGIOES_CONTINENTE.md.
//
// Constrói o mundo completo em Node e rasteriza TODA a geometria visível num mapa de
// altura visto de cima (grade de 1 m, altura máxima por célula). Depois amostra o
// interior de cada colisor estático: se num ponto dentro do colisor a malha visível
// mais alta fica no nível do chão (nada para bater), aquele metro quadrado é uma
// BARREIRA INVISÍVEL. Agrupa por região e pelo tamanho do colisor (aponta o builder).
//
// Uso: node tools/audit/ghost-colliders.mjs [--json out.json] [--region favela_cdd] [--top 25]

import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { setupTestEnvironment } from '../../tests/setup-env.js';

setupTestEnvironment();
const { DestructibleManager } = await import('../../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../../src/world/TestBlockWorld.js');
const { LegoHud } = await import('../../src/ui/LegoHud.js');

const args = process.argv.slice(2);
const argVal = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const JSON_OUT = argVal('--json', null);
const REGION_FILTER = argVal('--region', null);
const TOP = Number(argVal('--top', '25'));
const CELL = 1.0;
const OPEN_AIR_CLEARANCE = 1.1; // malha visível abaixo de chão+1.1 m = passagem livre visualmente
const MIN_GHOST_CELLS = 3; // ignora sobras de 1–2 m² (arredondamento da grade)

const t0 = Date.now();
const scene = new THREE.Scene();
const hud = new LegoHud();
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
scene.updateMatrixWorld(true);
console.error(`[audit] mundo construído em ${((Date.now() - t0) / 1000).toFixed(1)}s — ${world.colliders?.length || 0} colisores`);

// ---------- Mapa de altura (Int16, decímetros) ----------
let gMinX = Infinity, gMaxX = -Infinity, gMinZ = Infinity, gMaxZ = -Infinity;
for (const col of world.colliders || []) {
  if (!Number.isFinite(col.minX)) continue;
  gMinX = Math.min(gMinX, col.minX); gMaxX = Math.max(gMaxX, col.maxX);
  gMinZ = Math.min(gMinZ, col.minZ); gMaxZ = Math.max(gMaxZ, col.maxZ);
}
gMinX -= 4; gMinZ -= 4; gMaxX += 4; gMaxZ += 4;
const GW = Math.ceil((gMaxX - gMinX) / CELL), GH = Math.ceil((gMaxZ - gMinZ) / CELL);
const EMPTY = -32768;
const topY = new Int16Array(GW * GH).fill(EMPTY);
const toIX = (x) => Math.floor((x - gMinX) / CELL);
const toIZ = (z) => Math.floor((z - gMinZ) / CELL);
const enc = (y) => Math.max(-32767, Math.min(32767, Math.round(y * 10)));
const mark = (ix, iz, y) => {
  if (ix < 0 || iz < 0 || ix >= GW || iz >= GH) return;
  const i = iz * GW + ix, v = enc(y);
  if (v > topY[i]) topY[i] = v;
};

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
const instM = new THREE.Matrix4(), fullM = new THREE.Matrix4();

function markSegment(p, q) {
  const len = Math.hypot(q.x - p.x, q.z - p.z);
  const steps = Math.max(1, Math.ceil(len / (CELL * 0.5)));
  const y = Math.max(p.y, q.y);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    mark(toIX(p.x + (q.x - p.x) * t), toIZ(p.z + (q.z - p.z) * t), y);
  }
}

function rasterTriangle(p0, p1, p2) {
  e1.subVectors(p1, p0); e2.subVectors(p2, p0); nrm.crossVectors(e1, e2);
  const len = nrm.length();
  if (len < 1e-9) return;
  // Paredes verticais: projeção vira segmento → marca as 3 arestas.
  if (Math.abs(nrm.y / len) < 0.25) { markSegment(p0, p1); markSegment(p1, p2); markSegment(p2, p0); return; }
  const ix0 = toIX(Math.min(p0.x, p1.x, p2.x)), ix1 = toIX(Math.max(p0.x, p1.x, p2.x));
  const iz0 = toIZ(Math.min(p0.z, p1.z, p2.z)), iz1 = toIZ(Math.max(p0.z, p1.z, p2.z));
  const area = (ix1 - ix0 + 1) * (iz1 - iz0 + 1);
  if (area > 250000) return; // planos gigantes de chão/oceano não importam (são baixos)
  const yMax = Math.max(p0.y, p1.y, p2.y);
  if (area <= 2) { mark(ix0, iz0, yMax); mark(ix1, iz1, yMax); return; }
  // Teste ponto-no-triângulo (XZ) no centro de cada célula do bbox.
  const d = (p1.z - p2.z) * (p0.x - p2.x) + (p2.x - p1.x) * (p0.z - p2.z);
  if (Math.abs(d) < 1e-9) return;
  for (let ix = ix0; ix <= ix1; ix++) {
    const x = gMinX + (ix + 0.5) * CELL;
    for (let iz = iz0; iz <= iz1; iz++) {
      const z = gMinZ + (iz + 0.5) * CELL;
      const l1 = ((p1.z - p2.z) * (x - p2.x) + (p2.x - p1.x) * (z - p2.z)) / d;
      const l2 = ((p2.z - p0.z) * (x - p2.x) + (p0.x - p2.x) * (z - p2.z)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 >= -0.02 && l2 >= -0.02 && l3 >= -0.02) mark(ix, iz, l1 * p0.y + l2 * p1.y + l3 * p2.y);
    }
  }
  markSegment(p0, p1); markSegment(p1, p2); markSegment(p2, p0);
}

function rasterGeometry(geo, matrix) {
  const pos = geo.attributes?.position;
  if (!pos) return 0;
  const idx = geo.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, idx ? idx.getX(t * 3) : t * 3).applyMatrix4(matrix);
    b.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(matrix);
    c.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(matrix);
    rasterTriangle(a, b, c);
  }
  return triCount;
}

// Só o nível de detalhe máximo (LOD 0) representa o que o jogador vê de perto.
const lowLod = new Set();
scene.traverse((obj) => {
  if (!obj.isLOD) return;
  obj.levels.forEach((lvl, i) => { if (i > 0 && lvl.object && lvl.object !== obj.levels[0].object) lvl.object.traverse((n) => lowLod.add(n)); });
});
const skipNames = /water|ocean|sky|cloud|beacon|stud|debris|rain|fog|glow|halo|cone/i;
let tris = 0, meshes = 0;
scene.traverse((obj) => {
  if (!obj.isMesh || !obj.geometry || lowLod.has(obj)) return;
  if (skipNames.test(obj.name || '') || obj.userData?.isWater || obj.userData?.isOcean) return;
  const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
  if (mat?.side === THREE.BackSide || (mat?.transparent && (mat.opacity ?? 1) < 0.2)) return;
  meshes++;
  if (obj.isInstancedMesh) {
    for (let i = 0; i < obj.count; i++) { obj.getMatrixAt(i, instM); fullM.multiplyMatrices(obj.matrixWorld, instM); tris += rasterGeometry(obj.geometry, fullM); }
  } else tris += rasterGeometry(obj.geometry, obj.matrixWorld);
});
console.error(`[audit] ${meshes} malhas, ${(tris / 1e6).toFixed(2)}M triângulos rasterizados`);

// ---------- Interior de cada colisor ----------
function containsXZ(col, x, z) {
  if (col.shapeType === 'cylinder') return (x - col.cx) ** 2 + (z - col.cz) ** 2 <= col.radius ** 2;
  if (col.shapeType === 'obb') {
    const dx = x - col.cx, dz = z - col.cz;
    const lx = dx * col.cosYaw - dz * col.sinYaw;
    const lz = dx * col.sinYaw + dz * col.cosYaw;
    return Math.abs(lx) <= col.halfX && Math.abs(lz) <= col.halfZ;
  }
  return x >= col.minX && x <= col.maxX && z >= col.minZ && z <= col.maxZ;
}

const regionOf = (x, z) => {
  try { const r = world.getRegionAt?.(x, 0, z); return (r && (r.id || r.key || r.name)) || String(r || '?'); } catch (_) { return '?'; }
};
const groundAt = (x, z) => {
  const g = Number(world.getTerrainHeightAt?.(x, z));
  return Number.isFinite(g) ? g : 0;
};

const report = [];
let ghostCellsTotal = 0;
for (const col of world.colliders || []) {
  if (col.disabled || col.isDynamic) continue;
  const spanX = col.maxX - col.minX, spanZ = col.maxZ - col.minZ;
  if (Math.max(spanX, spanZ) < 1.8) continue; // postes, hidrantes, barris
  const cx = (col.minX + col.minX + spanX) / 2, cz = (col.minZ + col.minZ + spanZ) / 2;
  const ground = Math.max(col.minY, groundAt(cx, cz));
  if (col.maxY < ground + 1.2) continue; // meio-fio/degraus: não bloqueiam o corpo
  const region = regionOf(cx, cz);
  if (REGION_FILTER && region !== REGION_FILTER) continue;
  let inside = 0, ghost = 0;
  for (let ix = toIX(col.minX); ix <= toIX(col.maxX); ix++) {
    const x = gMinX + (ix + 0.5) * CELL;
    for (let iz = toIZ(col.minZ); iz <= toIZ(col.maxZ); iz++) {
      const z = gMinZ + (iz + 0.5) * CELL;
      if (!containsXZ(col, x, z)) continue;
      inside++;
      const v = topY[iz * GW + ix];
      const localGround = Math.max(col.minY, groundAt(x, z));
      if (v === EMPTY || v / 10 < localGround + OPEN_AIR_CLEARANCE) ghost++;
    }
  }
  if (ghost >= MIN_GHOST_CELLS) {
    ghostCellsTotal += ghost;
    report.push({
      region, ghostM2: ghost, ratio: +(ghost / Math.max(1, inside)).toFixed(2),
      x: +cx.toFixed(1), z: +cz.toFixed(1), w: +spanX.toFixed(1), d: +spanZ.toFixed(1),
      minY: +col.minY.toFixed(1), maxY: +col.maxY.toFixed(1), shape: col.shapeType, tag: col.tag || null
    });
  }
}

// Área "fantasma" que existia quando a física do jogador usava o AABB de formas giradas/cilíndricas.
const legacyAabb = {};
for (const col of world.colliders || []) {
  if (col.disabled || col.isDynamic || (col.shapeType !== 'obb' && col.shapeType !== 'cylinder')) continue;
  const aabb = (col.maxX - col.minX) * (col.maxZ - col.minZ);
  const exact = col.shapeType === 'obb' ? 4 * col.halfX * col.halfZ : Math.PI * col.radius * col.radius;
  const region = regionOf((col.minX + col.maxX) / 2, (col.minZ + col.maxZ) / 2);
  const g = (legacyAabb[region] ||= { n: 0, m2: 0 });
  g.n++; g.m2 += Math.max(0, aabb - exact);
}
console.log('\nÁrea extra que o AABB antigo bloqueava (prédios/casas girados e cilindros) — corrigida na Etapa 2.0:');
for (const [region, g] of Object.entries(legacyAabb).sort((p, q) => q[1].m2 - p[1].m2)) console.log(`  ${region.padEnd(26)} ${String(g.n).padStart(6)} colisores  ${String(Math.round(g.m2)).padStart(8)} m²`);

report.sort((p, q) => q.ghostM2 - p.ghostM2);
const byRegion = {};
for (const r of report) { const g = (byRegion[r.region] ||= { count: 0, m2: 0 }); g.count++; g.m2 += r.ghostM2; }
console.log(`\nBarreiras invisíveis: ${report.length} colisores, ~${ghostCellsTotal} m² de "ar sólido"`);
for (const [region, g] of Object.entries(byRegion).sort((p, q) => q[1].m2 - p[1].m2)) {
  console.log(`  ${region.padEnd(26)} ${String(g.count).padStart(5)} colisores  ${String(g.m2).padStart(8)} m²`);
}
const sizes = {};
for (const r of report) { const k = `${r.region}:${Math.round(r.w)}x${Math.round(r.d)}`; (sizes[k] ||= { n: 0, m2: 0 }); sizes[k].n++; sizes[k].m2 += r.ghostM2; }
console.log('\nTamanhos repetidos por região (apontam o builder culpado):');
for (const [k, v] of Object.entries(sizes).sort((p, q) => q[1].m2 - p[1].m2).slice(0, TOP)) console.log(`  ${k.padEnd(34)} ${String(v.n).padStart(5)}x  ${String(v.m2).padStart(7)} m²`);
console.log(`\nPiores ${TOP}:`);
for (const r of report.slice(0, TOP)) console.log(`  ${r.region.padEnd(18)} (${r.x}, ${r.z}) ${r.w}x${r.d} ${r.shape} y${r.minY}..${r.maxY} → ${r.ghostM2} m² (${Math.round(r.ratio * 100)}%)`);
const DEBUG_AT = argVal('--debug', null);
if (DEBUG_AT) {
  // Desenha em ASCII a vizinhança de (x,z): '#' = malha visível alta, '.' = chão livre, 'X' = colisor sobre chão livre (fantasma), 'c' = colisor sobre malha.
  const [dx0, dz0] = DEBUG_AT.split(',').map(Number);
  const R = 22;
  const near = (world.colliders || []).filter((col) => !col.disabled && !col.isDynamic && col.maxX > dx0 - R && col.minX < dx0 + R && col.maxZ > dz0 - R && col.minZ < dz0 + R);
  for (let z = dz0 - R; z <= dz0 + R; z++) {
    let line = '';
    for (let x = dx0 - R; x <= dx0 + R; x++) {
      const ix = toIX(x), iz = toIZ(z);
      const v = topY[iz * GW + ix];
      const g = groundAt(x, z);
      const high = v !== EMPTY && v / 10 >= g + OPEN_AIR_CLEARANCE;
      const inCol = near.some((col) => col.maxY > g + 1.2 && containsXZ(col, x + 0.5, z + 0.5));
      line += inCol ? (high ? 'c' : 'X') : (high ? '#' : '.');
    }
    console.log(line);
  }
}
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(report, null, 1)); console.error(`[audit] JSON salvo em ${JSON_OUT}`); }
console.error(`[audit] total ${((Date.now() - t0) / 1000).toFixed(1)}s`);
