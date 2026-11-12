// Leito dos trilhos, rampas dos portais e estrutura elevada.
import * as THREE from 'three';
import { planElevatedSupports, SUPPORT_CONFIG } from './MetroSupportPlanner.js';
import { makeFootingLookup, isBuildingAt } from '../StreetPortalPlanner.js';

// ============================================================================
// 6. TRILHOS CONTÍNUOS, LINHA ELEVADA (`Y = +14.2m`) & 3 ESTAÇÕES ELEVADAS GRANDES
// ============================================================================
const PARAPET_OFFSET = 3.6; // Eixo do guarda-corpo (coincide com a mureta com colisão do piso andável)
const PARAPET_H = 1.0;
const STATION_CLEAR = 34; // Sem guarda-corpo junto às plataformas (embarque)

export function buildTrackBedAndElevatedManhattanStructure(world, batcher, spline) {
  const isNearStation = (s) =>
    (spline.stationStops || []).some((st) => {
      let d = Math.abs(st.stopS - s);
      d = Math.min(d, spline.totalLength - d);
      return d < STATION_CLEAR;
    });
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

    // 3) VIADUTO FERROVIÁRIO ELEVADO (`my >= 4.5m`): laje de concreto LEGO + viga-caixão + friso amarelo,
    //    lastro entre os trilhos e guarda-corpo de tijolos com pinos (fora das estações)
    if (my >= 4.5) {
      // Laje (topo em y-0.06) e viga-caixão (fundo em y-1.09, onde apoiam os pórticos)
      batcher.addOrientedBox('viaduct_deck', 7.8, 0.3, segLen, mx, my - 0.21, mz, rotX, rotY, 0);
      batcher.addOrientedBox('viaduct_girder', 5.4, 0.73, segLen, mx, my - 0.725, mz, rotX, rotY, 0);
      batcher.addOrientedBox('track_ballast', 3.6, 0.08, segLen, mx, my - 0.02, mz, rotX, rotY, 0);

      for (const side of [-1, 1]) {
        // Friso amarelo de segurança na face lateral da laje
        batcher.addOrientedBox(
          'subway_stripe_gold',
          0.08,
          0.14,
          segLen,
          mx + perpX * side * 3.93,
          my - 0.2,
          mz + perpZ * side * 3.93,
          rotX,
          rotY,
          0
        );
      }

      if (!isNearStation((s0 + s1) * 0.5)) {
        for (const side of [-1, 1]) {
          const off = side * PARAPET_OFFSET;
          batcher.addOrientedBox(
            'viaduct_deck',
            0.36,
            PARAPET_H,
            segLen,
            mx + perpX * off,
            my - 0.06 + PARAPET_H * 0.5,
            mz + perpZ * off,
            rotX,
            rotY,
            0
          );
          // Pinos LEGO amarelos no topo do guarda-corpo (1 por metro)
          const studs = Math.max(1, Math.round(horizLen));
          for (let k = 0; k < studs; k++) {
            const t = (k + 0.5) / studs;
            batcher.studPositions.push([
              posA.x + dx * t + perpX * off,
              posA.y + dy * t - 0.06 + PARAPET_H + 0.1,
              posA.z + dz * t + perpZ * off
            ]);
          }
        }
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

/** Chão que não é rua (calçada, calçadão, praça, parque) — ver `StreetPortalPlanner.makeFootingLookup`. */
export const makeSidewalkLookup = (world) => makeFootingLookup(world);

export function buildElevatedSupports(world, batcher, spline) {
  const roads = Array.isArray(world.mapRoads) ? world.mapRoads : [];
  const bents = planElevatedSupports(spline, roads, {
    isBlocked: (x, z, half, minY, maxY) => isSpotBlocked(world, x, z, half, minY, maxY),
    isDeckInRange: (x, z, half, minY, maxY) => isDeckInRange(world, x, z, half, minY, maxY),
    isSidewalk: (() => {
      const onFooting = makeSidewalkLookup(world);
      // Pilar dentro d'água (canal/rio) vira pilar de ponte: também vale como base fora da rua
      return (x, z) => onFooting(x, z) || Boolean(world.isDeepWaterAt?.(x, z));
    })(),
    isBuildingAt: (x, z) => isBuildingAt(world, x, z),
    getGroundY: (x, z) => (world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(x, z)) : 0)
  });

  const colW = SUPPORT_CONFIG.colHalf * 2;
  const beamH = SUPPORT_CONFIG.beamH;
  for (const bent of bents) {
    const beamBottom = bent.beamY - beamH * 0.5;
    for (const c of bent.cols) {
      const h = beamBottom - c.groundY;
      batcher.addBox('viaduct_deck', colW, h + 1.0, colW, c.x, c.groundY + h * 0.5 - 0.5, c.z);
      // Capitel cinza-escuro sob a viga
      batcher.addBox('viaduct_girder', colW + 0.5, 0.55, colW + 0.5, c.x, beamBottom - 0.27, c.z);
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
      batcher.addBox('viaduct_girder', sx, beamH, sz, cx, bent.beamY, cz);
      world.addCollider(cx, cz, sx, sz, bent.beamY + beamH * 0.5, beamBottom);
    } else {
      const c = bent.cols[0];
      const sx = bent.alongZ ? 7.6 : 1.6;
      const sz = bent.alongZ ? 1.6 : 7.6;
      batcher.addBox('viaduct_girder', sx, beamH, sz, c.x, bent.beamY, c.z);
    }

    // Junta de dilatação do tabuleiro sobre cada apoio (faixa preta no topo e nas faces laterais)
    const jp = new THREE.Vector3();
    const jt = new THREE.Vector3();
    spline.sampleAtS(bent.s, jp, jt);
    const jRotY = Math.atan2(jt.x, jt.z);
    const jpx = Math.cos(jRotY);
    const jpz = -Math.sin(jRotY);
    batcher.addOrientedBox('joint_black', 7.0, 0.05, 0.22, jp.x, jp.y - 0.035, jp.z, 0, jRotY, 0);
    for (const side of [-1, 1]) {
      batcher.addOrientedBox('joint_black', 0.06, 1.04, 0.22, jp.x + jpx * side * 3.92, jp.y - 0.57, jp.z + jpz * side * 3.92, 0, jRotY, 0);
    }
  }
  world.metroSupports = bents;
  return bents;
}
