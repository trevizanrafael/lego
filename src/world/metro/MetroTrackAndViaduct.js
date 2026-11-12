// Leito dos trilhos, rampas dos portais e estrutura elevada.
import * as THREE from 'three';
import { planElevatedSupports, SUPPORT_CONFIG } from './MetroSupportPlanner.js';

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
