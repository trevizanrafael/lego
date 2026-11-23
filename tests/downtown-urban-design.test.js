import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment, resetTestListeners } from './setup-env.js';

setupTestEnvironment({ search: '' });

const {
  subdivideEdgeIntoParcels,
  subdivideSegmentCorridorLots,
  generateCourtyardBackLots,
  classifyDowntownArchitecturalArchetype,
  getMonumentalVistaKeepouts
} = await import('../src/world/buildings/LotSubdivision.js');
const { createObb2D, obbIntersectsRect2D } = await import('../src/world/buildings/LotGeometry2D.js');
const { buildDetailedBuilding } = await import('../src/world/buildings/DetailedBuildingBuilder.js');
const { worldSpatialColliderMethods } = await import('../src/world/core/WorldSpatialColliderGrid.js');
const { METRO_ISLAND_CUTOUTS } = await import('../src/world/MetroSystemBuilder.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { auditWorldCollisions } = await import('./collision-audit.test.js');

function makeMiniColliderWorld() {
  return Object.assign(Object.create(worldSpatialColliderMethods), {
    scene: new THREE.Scene(),
    colliders: [],
    _colliderGrid: new Map(),
    _dynamicColliders: [],
    colliderCellSize: 32,
    _colliderQueryId: 0,
    mapBuildings: [],
    getTerrainHeightAt: () => 0
  });
}

describe('M5 — Hierarquia Urbana do Centro, Subdivisão de Lotes, Marcos, Vistas Monumentais & Fachada Viva', () => {
  let scene;
  let world;

  before(() => {
    resetTestListeners();
    scene = new THREE.Scene();
    const hud = new LegoHud(35000);
    hud.isTitleScreenActive = false;
    const destructibles = new DestructibleManager(scene, hud);
    world = new TestBlockWorld(scene, destructibles);
  });

  it('1. LotSubdivision gera frentes de rua variadas (< 22m estreitas históricas até > 38m âncoras de esquina), corredores e pátios', () => {
    const allEdgeParcels = [];
    for (let s = 1; s <= 8; s++) {
      allEdgeParcels.push(
        ...subdivideEdgeIntoParcels({ axis: 'x', from: -165, to: 165, fixedEdge: -334, inSign: 1 }, s * 17)
      );
    }
    assert.ok(allEdgeParcels.length >= 40, `Esperava dezenas de lotes subdivididos (atual: ${allEdgeParcels.length})`);

    const widths = allEdgeParcels.map((p) => p.w);
    const depths = allEdgeParcels.map((p) => p.d);
    const minW = Math.min(...widths);
    const maxW = Math.max(...widths);
    assert.ok(minW < 22 && minW >= 12, `Deve produzir lotes estreitos históricos < 22m (minW=${minW})`);
    assert.ok(maxW > 38 && maxW <= 58, `Deve produzir âncoras de esquina > 38m (maxW=${maxW})`);
    assert.ok(Math.min(...depths) >= 16 && Math.max(...depths) <= 44, 'Profundidades realistas em [16..44]m');

    const hasPartyWallBlind = allEdgeParcels.some((p) => p.blindSides && p.blindSides !== 'none');
    assert.equal(hasPartyWallBlind, true, 'Lotes estreitos contíguos marcam empenas cegas (blindSides)');

    const diagLots = subdivideSegmentCorridorLots(
      { x1: -846, z1: -750, x2: -456, z2: -351, len: Math.hypot(390, 399), halfWidth: 14, sidewalk: 10, isMain: true },
      1,
      29
    );
    assert.ok(diagLots.length >= 6, `Corredor diagonal subdividido em múltiplos lotes orientados (${diagLots.length})`);
    assert.ok(diagLots.some((l) => l.w <= 22) && diagLots.some((l) => l.w >= 26));

    const backLots = generateCourtyardBackLots({ minX: -165, maxX: 165, minZ: -730, maxZ: -380 }, [], 13);
    assert.ok(backLots.length >= 4 && backLots.every((b) => b.minGap >= 8.0), 'Lotes internos preservam >= 8m de pátio/viela');

    const keepouts = getMonumentalVistaKeepouts();
    assert.ok(keepouts.some((k) => k.id === 'bank_monumental_vista') && keepouts.some((k) => k.id === 'hero_forecourt_south'));

    // Verifica arquétipos podium_tower e historic_lowrise em mundo isolado (0 SetbackOverBox)
    const miniWorld = makeMiniColliderWorld();
    const podiumGrp = buildDetailedBuilding(miniWorld, 0, 0, 36, 150, 32, 'sapphire_glass', {
      archetype: 'podium_tower',
      seed: 4
    });
    const histGrp = buildDetailedBuilding(miniWorld, 70, 0, 16, 22, 24, 'ny_brick', {
      archetype: 'historic_lowrise',
      blindSides: 'both',
      seed: 5
    });
    assert.equal(podiumGrp.children.filter((c) => c.isMesh).length, 3);
    assert.equal(histGrp.children.filter((c) => c.isMesh).length, 3);
    const miniAudit = auditWorldCollisions(miniWorld, { log: false });
    assert.equal(miniAudit.invalidColliders.length, 0);
    assert.equal(miniAudit.setbackMismatches.length, 0, 'podium_tower e historic_lowrise possuem 0 SetbackOverBox');
  });

  it('2. Centro completo possui contraste real de alturas (<= 28m históricos lado a lado com >= 150m arranha-céus) e larguras [12..60]m', () => {
    const dtBuildings = (world.mapBuildings || []).filter(
      (b) => !b.label && b.x >= -1540 && b.x <= 1540 && b.z >= -1140 && b.z <= 395
    );
    assert.ok(dtBuildings.length >= 600, `Centro denso e subdividido (atual: ${dtBuildings.length} prédios)`);

    const lowRiseHistoric = dtBuildings.filter((b) => b.height <= 28);
    const superTall = dtBuildings.filter((b) => b.height >= 150);
    assert.ok(
      lowRiseHistoric.length >= 60,
      `Centro deve ter dezenas de prédios históricos baixos <= 28m (atual: ${lowRiseHistoric.length})`
    );
    assert.ok(
      superTall.length >= 25,
      `Centro deve ter dezenas de arranha-céus imponentes >= 150m (atual: ${superTall.length})`
    );

    const widths = dtBuildings.map((b) => b.w);
    const minW = Math.min(...widths);
    const maxW = Math.max(...widths);
    assert.ok(minW >= 12 && minW < 22, `Menor largura no Centro em [12..22)m (minW=${minW})`);
    assert.ok(maxW > 38 && maxW <= 60, `Maior largura no Centro em (38..60]m (maxW=${maxW})`);

    const archetypes = new Set(dtBuildings.map((b) => b.archetype).filter(Boolean));
    assert.ok(archetypes.has('historic_lowrise') && archetypes.has('podium_tower'), 'Inclui historic_lowrise e podium_tower');
  });

  it('3. Visada Monumental do Super Banco Central e Forecourt Cívico da Torre dos Heróis estão 100% desobstruídos', () => {
    const bankVistaRect = { minX: -45, maxX: 45, minZ: -485, maxZ: -365 };
    const heroForecourtRect = { minX: -1005, maxX: -925, minZ: -458, maxZ: -385 };

    const bankBlockers = [];
    const heroBlockers = [];
    for (const b of world.mapBuildings || []) {
      if ((b.minY ?? 0) > 6.0) continue;
      const obb = createObb2D(b.x, b.z, b.w, b.d, b.rotY || 0);
      if (obbIntersectsRect2D(obb, bankVistaRect.minX, bankVistaRect.maxX, bankVistaRect.minZ, bankVistaRect.maxZ, 0)) {
        bankBlockers.push({ x: b.x, z: b.z, w: b.w, d: b.d, label: b.label });
      }
      if (obbIntersectsRect2D(obb, heroForecourtRect.minX, heroForecourtRect.maxX, heroForecourtRect.minZ, heroForecourtRect.maxZ, 0)) {
        heroBlockers.push({ x: b.x, z: b.z, w: b.w, d: b.d, label: b.label });
      }
    }

    assert.equal(bankBlockers.length, 0, `Zero prédios bloqueando a visada do Super Banco: ${JSON.stringify(bankBlockers)}`);
    assert.equal(heroBlockers.length, 0, `Zero prédios bloqueando o forecourt da Torre dos Heróis: ${JSON.stringify(heroBlockers)}`);

    // Confirma presença dos pares simétricos de torres emoldurando o Super Banco em |x| ~ 78..120
    const framingTowers = (world.mapBuildings || []).filter(
      (b) => Math.abs(Math.abs(b.x) - 102) <= 2 && Math.abs(b.z - -428) <= 2 && b.height >= 180
    );
    assert.equal(framingTowers.length, 2, 'Par simétrico de torres monumentais flanqueando o Super Banco presente');
  });

  it('4. Zero mapBuildings sobrepondo mapRoads ou METRO_ISLAND_CUTOUTS, e auditWorldCollisions com invalid === 0 e SetbackOverBox === 0', () => {
    const groundRoads = (world.mapRoads || []).filter((r) => !r.isElevated && !r.isBridge);
    const roadOverlaps = [];
    const cutoutOverlaps = [];

    for (const b of world.mapBuildings || []) {
      if ((b.minY ?? 0) > 6.0) continue;
      const bMinX = b.x - b.w * 0.5 + 0.6;
      const bMaxX = b.x + b.w * 0.5 - 0.6;
      const bMinZ = b.z - b.d * 0.5 + 0.6;
      const bMaxZ = b.z + b.d * 0.5 - 0.6;

      for (const r of groundRoads) {
        if (
          bMinX < r.x + r.w * 0.5 - 0.6 &&
          bMaxX > r.x - r.w * 0.5 + 0.6 &&
          bMinZ < r.z + r.d * 0.5 - 0.6 &&
          bMaxZ > r.z - r.d * 0.5 + 0.6
        ) {
          roadOverlaps.push({ b, r });
          break;
        }
      }

      // Ignora a própria Torre dos Heróis sobre sua escadaria interna OP-09
      if (b.label && String(b.label).includes('TORRE DOS HERÓIS')) continue;
      const obb = createObb2D(b.x, b.z, b.w, b.d, b.rotY || 0);
      for (const cut of METRO_ISLAND_CUTOUTS) {
        if (obbIntersectsRect2D(obb, cut.minX, cut.maxX, cut.minZ, cut.maxZ, -0.4)) {
          cutoutOverlaps.push({ b: { x: b.x, z: b.z, w: b.w, d: b.d, label: b.label }, cutId: cut.id });
          break;
        }
      }
    }

    assert.equal(roadOverlaps.length, 0, `Zero prédios invadindo mapRoads: ${JSON.stringify(roadOverlaps.slice(0, 3))}`);
    assert.equal(cutoutOverlaps.length, 0, `Zero prédios invadindo METRO_ISLAND_CUTOUTS: ${JSON.stringify(cutoutOverlaps.slice(0, 3))}`);

    const report = auditWorldCollisions(world, { log: false });
    assert.equal(report.invalidColliders.length, 0, `Zero colisores inválidos: ${JSON.stringify(report.invalidColliders)}`);
    assert.equal(report.setbackMismatches.length, 0, `Zero SetbackOverBox: ${JSON.stringify(report.setbackMismatches.slice(0, 3))}`);
  });
});
