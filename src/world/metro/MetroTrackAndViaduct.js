// Leito dos trilhos, rampas dos portais e estrutura elevada.
import * as THREE from 'three';
import { planElevatedSupports, isInsideAnyRoad, SUPPORT_CONFIG } from './MetroSupportPlanner.js';

// ============================================================================
// 6. TRILHOS CONTÍNUOS, LINHA ELEVADA (`Y = +14.2m`) & 3 ESTAÇÕES ELEVADAS GRANDES
// ============================================================================
export function buildTrackBedAndElevatedManhattanStructure(world, batcher, spline) {
  const step = 6.0;
  const count = Math.floor(spline.totalLength / step);
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();
  const tan = new THREE.Vector3();

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

    }
  }
}

// ============================================================================
// APOIOS DA LINHA ELEVADA: PÓRTICOS NAS CALÇADAS + PILAR ÚNICO FORA DAS RUAS
// (posições decididas em `MetroSupportPlanner.js` — nenhum pilar em pista de carro)
// ============================================================================
function isDeckInRange(world, x, z, half, minY, maxY) {
  const r = half + 0.3;
  // Escadas, rampas e passarelas (decks) com altura entre `minY` e `maxY` no local
  for (const deck of world.elevatedDecks || []) {
    if (x + r <= deck.minX || x - r >= deck.maxX || z + r <= deck.minZ || z - r >= deck.maxZ) continue;
    const cx = THREE.MathUtils.clamp(x, deck.minX, deck.maxX);
    const cz = THREE.MathUtils.clamp(z, deck.minZ, deck.maxZ);
    const dy = deck.getDeckY ? deck.getDeckY(cx, cz) : 0;
    if (dy === null || dy === undefined) continue;
    if (dy >= minY && dy <= maxY) return true;
  }
  return false;
}

function isSpotBlocked(world, x, z, half, minY = -Infinity, maxY = Infinity) {
  if (isDeckInRange(world, x, z, half, minY, maxY)) return true;
  const r = half + 0.3;
  const cols = world.getCollidersNear ? world.getCollidersNear(x, z, r + 1) : world.colliders || [];
  for (const col of cols) {
    if (col.disabled) continue;
    if ((col.minY ?? 0) > 6.0 || col.maxY < 0.8) continue; // ignora coisas no alto (ex.: tabuleiros) e pisos
    if (x + r > col.minX && x - r < col.maxX && z + r > col.minZ && z - r < col.maxZ) return true;
  }
  return false;
}

export function buildElevatedSupports(world, batcher, spline) {
  const roads = Array.isArray(world.mapRoads) ? world.mapRoads : [];
  const bents = planElevatedSupports(spline, roads, {
    isBlocked: (x, z, half, minY, maxY) => isSpotBlocked(world, x, z, half, minY, maxY),
    isDeckInRange: (x, z, half, minY, maxY) => isDeckInRange(world, x, z, half, minY, maxY),
    getGroundY: (x, z) => (world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(x, z)) : 0)
  });

  // Calçada primeiro (antes dos colliders dos pilares, que bloqueariam os próprios pedaços)
  addSidewalkUnderSupports(world, bents);

  const colW = SUPPORT_CONFIG.colHalf * 2;
  const beamH = SUPPORT_CONFIG.beamH;
  for (const bent of bents) {
    const beamBottom = bent.beamY - beamH * 0.5;
    for (const c of bent.cols) {
      const h = beamBottom - c.groundY;
      batcher.addBox('ny_truss_charcoal', colW, h + 1.0, colW, c.x, c.groundY + h * 0.5 - 0.5, c.z);
      // Base com faixa de segurança amarela/preta (visível para quem passa na calçada)
      batcher.addBox('subway_stripe_gold', colW + 0.24, 0.9, colW + 0.24, c.x, c.groundY + 0.45, c.z);
      batcher.addBox('tunnel_dark', colW + 0.26, 0.26, colW + 0.26, c.x, c.groundY + 0.98, c.z);
      world.addCollider(c.x, c.z, colW + 0.1, colW + 0.1, beamBottom, c.groundY);
    }

    if (bent.kind === 'portal') {
      const { x1, z1, x2, z2 } = bent.beam;
      const len = Math.hypot(x2 - x1, z2 - z1) + colW;
      const cx = (x1 + x2) * 0.5;
      const cz = (z1 + z2) * 0.5;
      const sx = bent.alongZ ? len : 1.6;
      const sz = bent.alongZ ? 1.6 : len;
      batcher.addBox('ny_truss_green', sx, beamH, sz, cx, bent.beamY, cz);
      world.addCollider(cx, cz, sx, sz, bent.beamY + beamH * 0.5, beamBottom);
    } else {
      const c = bent.cols[0];
      const sx = bent.alongZ ? 7.6 : 1.6;
      const sz = bent.alongZ ? 1.6 : 7.6;
      batcher.addBox('ny_truss_green', sx, beamH, sz, c.x, bent.beamY, c.z);
    }
  }
  world.metroSupports = bents;
  return bents;
}

// ============================================================================
// CALÇADA SOB OS PILARES: onde a base da ilha é só asfalto (subúrbio, orla), cria a calçada
// do meio-fio até depois do pilar, contínua entre pórticos vizinhos (cortada nas ruas transversais).
// ============================================================================
const SIDEWALK_MIN_W = 4.0;  // Largura mínima da calçada a partir do meio-fio
const SIDEWALK_CELL = 3.0;   // Comprimento de cada pedaço (acompanha ladeiras)
const SIDEWALK_LINK = 45;    // Liga pórticos vizinhos até esta distância

function addSidewalkUnderSupports(world, bents) {
  if (typeof world._addCityBlockSidewalk !== 'function') return;
  const roads = Array.isArray(world.mapRoads) ? world.mapRoads : [];
  const portals = bents.filter((b) => b.kind === 'portal' && b.corridor);
  const cells = new Set();

  // Faixas (por lado da avenida): [along0, along1] x [cross0, cross1]
  const strips = [];
  for (let i = 0; i < portals.length; i++) {
    const b = portals[i];
    const alongOf = (bent) => (bent.alongZ ? bent.cols[0].z : bent.cols[0].x);
    const a0 = alongOf(b);
    const next = portals[i + 1];
    const linked =
      next &&
      next.alongZ === b.alongZ &&
      Math.abs(next.corridor.lo - b.corridor.lo) < 0.5 &&
      Math.abs(next.corridor.hi - b.corridor.hi) < 0.5 &&
      Math.abs(alongOf(next) - a0) <= SIDEWALK_LINK;
    const a1 = linked ? alongOf(next) : a0;
    for (let k = 0; k < 2; k++) {
      const c = b.cols[k];
      const dir = k === 0 ? -1 : 1;
      const edge = k === 0 ? b.corridor.lo : b.corridor.hi;
      const colCross = b.alongZ ? c.x : c.z;
      const far = Math.max(SIDEWALK_MIN_W, Math.abs(colCross - edge) + SUPPORT_CONFIG.colHalf + 0.8);
      strips.push({
        alongZ: b.alongZ,
        along0: Math.min(a0, a1) - 2.5,
        along1: Math.max(a0, a1) + 2.5,
        cross0: Math.min(edge, edge + dir * far),
        cross1: Math.max(edge, edge + dir * far)
      });
    }
  }

  // Partes da faixa [c0, c1] ainda descobertas (sem calçada existente cobrindo todo o pedaço)
  const uncovered = (alongZ, a0, a1, c0, c1) => {
    let parts = [[c0, c1]];
    for (const r of world.mapSidewalks || []) {
      const ra0 = alongZ ? r.minZ : r.minX;
      const ra1 = alongZ ? r.maxZ : r.maxX;
      if (ra0 > a0 + 0.01 || ra1 < a1 - 0.01) continue; // precisa cobrir o pedaço inteiro no comprimento
      const rc0 = alongZ ? r.minX : r.minZ;
      const rc1 = alongZ ? r.maxX : r.maxZ;
      const next = [];
      for (const [p0, p1] of parts) {
        if (rc1 <= p0 || rc0 >= p1) {
          next.push([p0, p1]);
          continue;
        }
        if (rc0 > p0) next.push([p0, rc0]);
        if (rc1 < p1) next.push([rc1, p1]);
      }
      parts = next;
    }
    return parts.filter(([p0, p1]) => p1 - p0 >= 0.3);
  };

  for (const st of strips) {
    for (let a = st.along0; a < st.along1; a += SIDEWALK_CELL) {
      const len = Math.min(SIDEWALK_CELL, st.along1 - a);
      const am = a + len * 0.5;
      for (const [c0, c1] of uncovered(st.alongZ, a, a + len, st.cross0, st.cross1)) {
        const crossW = c1 - c0;
        const crossC = (c0 + c1) * 0.5;
        const x = st.alongZ ? crossC : am;
        const z = st.alongZ ? am : crossC;
        const key = `${Math.round(x * 2)},${Math.round(z * 2)},${Math.round(crossW * 4)}`;
        if (cells.has(key)) continue;
        // Nunca em pista (ruas transversais), nunca na água, nunca dentro de prédio
        const corners = st.alongZ
          ? [[c0, a], [c1, a], [c0, a + len], [c1, a + len], [crossC, am]]
          : [[a, c0], [a, c1], [a + len, c0], [a + len, c1], [am, crossC]];
        if (corners.some(([cx, cz]) => isInsideAnyRoad(roads, cx, cz, -0.05))) continue;
        if (world.isDeepWaterAt?.(x, z, { forCar: true })) continue;
        // (escadas/passarelas por cima não impedem a calçada no chão: só prédios e objetos)
        if (isSpotBlocked(world, x, z, Math.max(0.1, Math.min(crossW, len) * 0.5 - 0.3), Infinity, Infinity)) continue;
        cells.add(key);
        const w = st.alongZ ? crossW : len + 0.02;
        const d = st.alongZ ? len + 0.02 : crossW;
        world._addCityBlockSidewalk(x, z, w, d);
      }
    }
  }
  // Base de calçada sob qualquer pilar que ainda esteja no asfalto (ex.: pilar único nas praças)
  const onSidewalk = (x, z) =>
    (world.mapSidewalks || []).some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
  for (const b of bents) {
    for (const c of b.cols) {
      if (onSidewalk(c.x, c.z) || isInsideAnyRoad(roads, c.x, c.z, 1.6)) continue;
      world._addCityBlockSidewalk(c.x, c.z, 3.2, 3.2);
      cells.add(`pad_${c.x.toFixed(1)}_${c.z.toFixed(1)}`);
    }
  }
  world.metroAddedSidewalkCells = cells.size;
}
