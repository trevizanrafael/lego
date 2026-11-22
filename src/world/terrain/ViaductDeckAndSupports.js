import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';
import { buildProfileRibbon } from '../ViaductGeometry.js';
import {
  findPortalColumns,
  makeFootingLookup,
  isBuildingAt,
  onCrossRoad
} from '../StreetPortalPlanner.js';
import { ROAD } from '../core/WorldLayoutScale.js';

// Largura das avenidas principais: viadutos e rampas usam a mesma largura para encaixar na rua.
export const AVENUE_WIDTH = ROAD.mainWidth;
export const CENTRAL_RAMP_HALF_W = AVENUE_WIDTH * 0.5;

export function addOverheadHighwayGantry(world, batcher, x, deckY, z, spanW, axis, signText, subText = '') {
  const halfSpan = spanW * 0.5 + 0.55;
  const gantryH = 6.5;
  const beamY = deckY + gantryH;

  if (axis === 'z_const') {
    batcher.addBox('steel_pole', 0.75, gantryH, 0.75, x, deckY + gantryH * 0.5, z - halfSpan);
    batcher.addBox('steel_pole', 0.75, gantryH, 0.75, x, deckY + gantryH * 0.5, z + halfSpan);
    batcher.addBox('steel_pole', 0.85, 0.9, spanW + 1.8, x, beamY, z);
  } else {
    batcher.addBox('steel_pole', 0.75, gantryH, 0.75, x - halfSpan, deckY + gantryH * 0.5, z);
    batcher.addBox('steel_pole', 0.75, gantryH, 0.75, x + halfSpan, deckY + gantryH * 0.5, z);
    batcher.addBox('steel_pole', spanW + 1.8, 0.9, 0.85, x, beamY, z);
  }

  const boardW = Math.min(13.6, spanW - 2.0);
  const boardH = 2.65;
  const signMesh = createSignBoardMesh({
    x,
    y: beamY + 0.18,
    z,
    width: boardW,
    height: boardH,
    depth: 0.55,
    rotY: axis === 'z_const' ? Math.PI / 2 : 0,
    title: signText,
    subText,
    bgColor: '#14532d',
    borderColor: '#f8fafc',
    topStripeColor: '#facc15',
    textColor: '#ffffff',
    subColor: '#fde047',
    doubleSided: true
  });
  world.scene.add(signMesh);
}

export function interpolateSamplesY(samples, c) {
  if (c <= samples[0].c) return samples[0].y;
  const last = samples[samples.length - 1];
  if (c >= last.c) return last.y;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].c <= c) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  return a.y + ((b.y - a.y) * (c - a.c)) / Math.max(1e-6, b.c - a.c);
}

export function addContinuousDeck(batcher, samples, axis, fixedCoord, deckWidth, opts = {}) {
  if (!samples || samples.length < 2) return;
  const { deckThickness = 0.95, railW = 0.68, railH = 1.15, railGaps = [], girders = true } = opts;
  const halfW = deckWidth * 0.5;
  const rib = (key, c0, c1, top, thick, faces, sub = samples) =>
    batcher.addGeometry(key, buildProfileRibbon(sub, axis, fixedCoord, c0, c1, top, thick, faces));
  const topOnly = { top: true, bottom: false, sides: false };

  // Laje + vigas longitudinais inferiores
  rib('viaduct_concrete', -halfW, halfW, 0, deckThickness);
  if (girders) {
    for (const side of [-1, 1]) {
      const g = side * (halfW - 2.1);
      rib('viaduct_dark_concrete', g - 0.475, g + 0.475, -deckThickness + 0.03, 0.78);
    }
  }
  // Asfalto, faixa dupla amarela central e linhas de acostamento
  rib('viaduct_asphalt', -(halfW - railW), halfW - railW, 0.07, 0.1, { top: true, bottom: false, sides: true });
  for (const d of [-0.28, 0.28]) rib('lane_yellow', d - 0.11, d + 0.11, 0.115, 0.025, topOnly);
  for (const side of [-1, 1]) {
    const o = side * (halfW - railW - 0.45);
    rib('viaduct_shoulder', o - 0.17, o + 0.17, 0.095, 0.02, topOnly);
  }
  // Linhas brancas tracejadas das faixas (cada traço também segue o perfil)
  const cStart = samples[0].c;
  const cEnd = samples[samples.length - 1].c;
  for (let c = cStart + 3; c + 3.3 <= cEnd - 3; c += 6) {
    const dash = [0, 1.1, 2.2, 3.3].map((k) => ({ c: c + k, y: interpolateSamplesY(samples, c + k) }));
    for (const side of [-1, 1]) {
      const o = side * deckWidth * 0.24;
      rib('lane_white', o - 0.11, o + 0.11, 0.115, 0.025, topOnly, dash);
    }
  }
  // Muretas laterais (com aberturas opcionais) e friso amarelo na face externa da laje
  for (const side of [-1, 1]) {
    const inner = side * (halfW - railW);
    const outer = side * halfW;
    const gaps = railGaps.filter((g) => g.side === side);
    let runs = [samples];
    for (const g of gaps) {
      runs = runs.flatMap((run) => {
        const before = run.filter((p) => p.c <= g.c0);
        const after = run.filter((p) => p.c >= g.c1);
        return [before, after].filter((r) => r.length >= 2);
      });
    }
    for (const run of runs) {
      rib('viaduct_concrete', Math.min(inner, outer), Math.max(inner, outer), railH, railH + 0.3, undefined, run);
    }
    const band0 = side > 0 ? halfW : -halfW - 0.05;
    rib('safety_yellow', band0, band0 + 0.05, -0.1, 0.38);
  }
}

/** Collider de objeto/prédio no lugar do pilar (ignora coisas no alto, como tabuleiros). */
export function isColumnSpotBlocked(world, x, z, half) {
  const r = half + 0.3;
  const cols = world.getCollidersNear ? world.getCollidersNear(x, z, r + 1) : world.colliders || [];
  for (const col of cols) {
    if (col.disabled) continue;
    if ((col.minY ?? 0) > 6.0 || col.maxY < 0.8) continue;
    if (x + r > col.minX && x - r < col.maxX && z + r > col.minZ && z - r < col.maxZ) return true;
  }
  return false;
}

/**
 * Apoios de um viaduto reto (ao longo de X ou Z), sem nada no meio da rua:
 *  - tabuleiro alto (vão livre >= 5m): PÓRTICO com um pilar em cada calçada de verdade e viga atravessando a rua;
 *  - rampa baixa (onde carro não passa por baixo): pilar central compacto sob a própria rampa;
 *  - em cima de rua transversal: nenhum apoio.
 */
export function addViaductSupports(world, batcher, cfg) {
  const { axis, fixedCoord, startC, endC, deckWidth, getHeightAlong, getGroundAlong, underside, spacing = 22 } = cfg;
  const roads = Array.isArray(world.mapRoads) ? world.mapRoads : [];
  const alongZ = axis === 'x_const';
  const isFooting = makeFootingLookup(world, { ignoreBlock: (b) => b.isViaductDeck });
  const groundAt = (x, z) => (world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(x, z)) : 0);
  const beamH = 1.2;
  const colW = 1.4;
  const placed = [];

  for (let pc0 = startC + 14; pc0 <= endC - 14; pc0 += spacing) {
    for (const sh of [0, 3, -3, 6, -6, 9, -9]) {
      const pc = pc0 + sh;
      if (pc < startC + 8 || pc > endC - 8) continue;
      const deckY = getHeightAlong(pc);
      if (deckY === null) continue;
      const undersideY = deckY - underside;
      const groundC = getGroundAlong(pc);
      const clear = undersideY - groundC;
      if (clear < 1.2) break; // rampa encostando no chão (aterro): sem pilar
      const x = alongZ ? fixedCoord : pc;
      const z = alongZ ? pc : fixedCoord;
      if (onCrossRoad(roads, x, z, alongZ, 3.0)) continue;

      if (clear >= 5.0) {
        const beamTop = undersideY;
        const beamBottom = beamTop - beamH;
        const cols = findPortalColumns({
          x,
          z,
          alongZ,
          roads,
          isFooting,
          isBuilding: (px, pz) => isBuildingAt(world, px, pz),
          fits: (c) => {
            if (isColumnSpotBlocked(world, c.x, c.z, colW * 0.5)) return false;
            c.groundY = groundAt(c.x, c.z);
            return beamBottom - c.groundY >= 3.0;
          }
        });
        if (!cols) continue;
        for (const c of cols) {
          const h = beamBottom - c.groundY;
          batcher.addBox('viaduct_pillar', colW, h + 0.8, colW, c.x, c.groundY + h * 0.5 - 0.4, c.z);
          batcher.addBox('safety_yellow', colW + 0.24, 0.9, colW + 0.24, c.x, c.groundY + 0.45, c.z);
          batcher.addBox('hazard_black', colW + 0.26, 0.26, colW + 0.26, c.x, c.groundY + 0.98, c.z);
          world.addCollider(c.x, c.z, colW + 0.1, colW + 0.1, beamBottom, c.groundY);
        }
        const a = cols[0];
        const b = cols[1];
        const span = Math.hypot(b.x - a.x, b.z - a.z) + colW;
        const sx = alongZ ? span : 1.8;
        const sz = alongZ ? 1.8 : span;
        const bx = (a.x + b.x) * 0.5;
        const bz = (a.z + b.z) * 0.5;
        batcher.addBox('viaduct_concrete', sx, beamH, sz, bx, beamTop - beamH * 0.5, bz);
        world.addCollider(bx, bz, sx, sz, beamTop, beamBottom);
        placed.push({ kind: 'portal', c: pc, cols, beamBottom });
      } else {
        // Rampa baixa: pilar central sob a rampa (ali embaixo já não passa carro)
        if (isColumnSpotBlocked(world, x, z, 1.1)) continue;
        const g = groundAt(x, z);
        const h = undersideY - g;
        batcher.addBox('viaduct_pillar', 2.2, h + 0.6, 2.2, x, g + h * 0.5 - 0.3, z);
        batcher.addBox('safety_yellow', 2.44, 0.8, 2.44, x, g + 0.4, z);
        const capW = deckWidth - 3.0;
        batcher.addBox('viaduct_dark_concrete', alongZ ? capW : 1.8, 0.7, alongZ ? 1.8 : capW, x, undersideY - 0.35, z);
        world.addCollider(x, z, 2.3, 2.3, undersideY, g);
        placed.push({ kind: 'central', c: pc });
      }
      break;
    }
  }
  if (!world.viaductSupports) world.viaductSupports = [];
  world.viaductSupports.push(...placed.map((p) => ({ ...p, axis, fixedCoord })));
  return placed;
}
