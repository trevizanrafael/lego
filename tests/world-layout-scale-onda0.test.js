import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

globalThis.__ENABLE_3X_DEFAULT_IN_NODE = true;
setupTestEnvironment({ search: '' });

const {
  DEFAULT_WORLD_SCALE,
  WORLD_SCALE,
  IS_SCALED_WORLD,
  DESIGN_ROAD,
  ROAD,
  URBAN_GRID_LINES_X,
  URBAN_GRID_LINES_Z,
  resolveWorldScale,
  resolveRoadSpec,
  ws,
  wsP,
  wsPos3,
  wsBounds,
  fromWs,
  computeStreetAnchoredCoord,
  wsStreetAnchored
} = await import('../src/world/core/WorldLayoutScale.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { STATIC_MAP_SPAN } = await import('../src/ui/minimap/MinimapTerrainAndRoadsPainter.js');

const {
  migrateSaveSlotToWorldScale,
  writeSaveSlot,
  loadAllSaveSlots,
  SAVE_STORAGE_KEY
} = await import('../src/ui/FactionIconsAndSaveSystem.js');

describe('ONDA 0 — WorldLayoutScale (3x Ativo), Grade Viária Unificada, Calçada 10m & Migração de Save', () => {
  it('1. resolveWorldScale usa DEFAULT_WORLD_SCALE = 3 por padrão e aceita ?worldScale=1 como override', () => {
    assert.equal(DEFAULT_WORLD_SCALE, 3, 'Step 0B ativa DEFAULT_WORLD_SCALE = 3');
    assert.equal(WORLD_SCALE, 3);
    assert.equal(IS_SCALED_WORLD, true);
    assert.equal(resolveWorldScale('?worldScale=1'), 1);
    assert.equal(resolveWorldScale('?worldScale=3'), 3);
    assert.equal(resolveWorldScale('worldScale=2.5&foo=bar'), 2.5);
    assert.equal(resolveWorldScale('?worldScale=0'), DEFAULT_WORLD_SCALE);
    assert.equal(resolveWorldScale('?worldScale=99'), DEFAULT_WORLD_SCALE);
    assert.equal(resolveWorldScale('?worldScale=abc'), DEFAULT_WORLD_SCALE);
    assert.equal(resolveWorldScale(''), 3);
  });

  it('2. Em WORLD_SCALE === 3, ws/wsPos3/wsBounds escalam X/Z em 3x (preservando Y em 1x) e constroem calçadas reais de 10m', () => {
    assert.equal(ws(120), 360);
    assert.equal(ws(-384), -1152);
    assert.equal(ws(0), 0);
    assert.equal(fromWs(360), 120);
    assert.deepEqual(wsP(-252, 402), { x: -756, z: 1206 });
    assert.deepEqual(wsPos3({ x: -324, y: 310.85, z: -168 }), { x: -972, y: 310.85, z: -504 });
    assert.deepEqual(
      wsBounds({ minX: -520, maxX: 520, minZ: -440, maxZ: 140, minY: 0, maxY: 250 }),
      { minX: -1560, maxX: 1560, minZ: -1320, maxZ: 420, minY: 0, maxY: 250 }
    );
    assert.deepEqual(ROAD, {
      mainWidth: 34,
      secondaryWidth: 26,
      sidewalk: 10,
      curbHeight: 0.18
    });
    assert.equal(STATIC_MAP_SPAN, 22200);

    const scene = new THREE.Scene();
    const hud = new LegoHud(0);
    const destructibles = new DestructibleManager(scene, hud);
    const world = new TestBlockWorld(scene, destructibles);
    assert.ok(world.sidewalkCorridors.length >= 400, `Corredores de calçada de 10m gerados: ${world.sidewalkCorridors.length}`);
    assert.ok(world.crosswalkZones.length >= 400, `Faixas de pedestre geradas: ${world.crosswalkZones.length}`);
    // Na Av. X = 0 (meia-largura 17m -> meio-fio em X=17, calçada X=17..27), cota na rua = 0 e no meio da calçada (X=22, Z=-300) = +0.18m!
    const roadY = world.getTerrainHeightAt(0, -300);
    const swY = world.getTerrainHeightAt(22, -300);
    assert.ok(Math.abs((swY - roadY) - 0.18) < 0.025, `Degrau do meio-fio da calçada de 10m deve ser ~0.18m (obtido ${(swY - roadY).toFixed(3)}m)`);
  });

  it('3. Em scaleOverride = 3 (Avenidas 34m, Ruas 26m, Calçadas 10m), wsStreetAnchored cola o prédio na calçada e deixa o miolo livre', () => {
    const road3x = resolveRoadSpec(3);
    assert.deepEqual(road3x, {
      mainWidth: 34,
      secondaryWidth: 26,
      sidewalk: 10,
      curbHeight: 0.18
    });
    assert.equal(DESIGN_ROAD.mainWidth, 28);
    assert.equal(DESIGN_ROAD.secondaryWidth, 24);

    // Prédio de 28m de largura (halfW = 14) em designX = -221 (quadra entre Av. -252 e Av. -120)
    // Em 3x: Av. -252 vai para X = -756 (pista -773..-739, calçada Leste -739..-729), Av. -120 vai para X = -360
    const anchoredX = computeStreetAnchoredCoord(-221, URBAN_GRID_LINES_X, 14, 3, road3x);
    const buildingWestEdge = anchoredX - 14;
    const buildingEastEdge = anchoredX + 14;
    const sidewalkInnerEastOf756 = -756 + 17 + 10; // -729
    const blockMidX = (-756 + -360) * 0.5; // -558

    assert.ok(
      buildingWestEdge >= sidewalkInnerEastOf756,
      `Fachada frontal (${buildingWestEdge}) não invade a avenida de 34m nem a calçada de 10m (limite >= ${sidewalkInnerEastOf756})`
    );
    assert.ok(
      buildingWestEdge <= sidewalkInnerEastOf756 + 2.0,
      `Fachada frontal (${buildingWestEdge}) permanece colada junto à calçada (sem recuo exagerado)`
    );
    assert.ok(
      buildingEastEdge < blockMidX - 100,
      `Fundo do prédio (${buildingEastEdge}) deixa o miolo central da quadra de ~396m amplo e aberto (meio=${blockMidX})`
    );

    // Elementos centrados no eixo da avenida (ex.: Super Banco em X = 0) mantêm alinhamento axial
    const centeredOnZero = computeStreetAnchoredCoord(0, URBAN_GRID_LINES_X, 74, 3, road3x);
    assert.equal(centeredOnZero, 0);

    // Coordenadas periféricas distantes fora da grade urbana (ex.: pista do aeroporto X = -1660) escalam linearmente por 3x
    const outerRunwayX = computeStreetAnchoredCoord(-1660, URBAN_GRID_LINES_X, 20, 3, road3x);
    assert.equal(outerRunwayX, -1660 * 3);

    // Verifica wsStreetAnchored 2D em X e Z simultaneamente
    const anchored2D = wsStreetAnchored(-221, -218, { halfW: 14, halfD: 12, scale: 3, road: road3x });
    const zSidewalkInnerSouthOf750 = -250 * 3 + 17 + 10; // -723
    assert.equal(anchored2D.x, anchoredX);
    assert.ok(anchored2D.z - 12 >= zSidewalkInnerSouthOf750);
  });

  it('4. migrateSaveSlotToWorldScale escala X/Z de saves antigos, preserva altura Y intacta e é 100% idempotente', () => {
    const legacySlot = {
      slotIndex: 0,
      faction: 'cv',
      studs: 125000,
      playerPos: { x: -324, y: 310.85, z: -168 },
      savedPos: { x: 120, y: 2.2, z: -646 },
      waypoint: { x: 400, z: -300, label: 'DESTINO' }
    };

    const migrated = migrateSaveSlotToWorldScale(legacySlot, 3);
    assert.equal(migrated.worldScale, 3);
    assert.deepEqual(migrated.playerPos, { x: -972, y: 310.85, z: -504 });
    assert.deepEqual(migrated.savedPos, { x: 360, y: 2.2, z: -1938 });
    assert.deepEqual(migrated.waypoint, { x: 1200, z: -900, label: 'DESTINO' });

    // Chamada repetida na mesma escala é 100% idempotente (nunca multiplica por 3x duas vezes!)
    const migratedAgain = migrateSaveSlotToWorldScale(migrated, 3);
    assert.equal(migratedAgain.worldScale, 3);
    assert.deepEqual(migratedAgain.playerPos, { x: -972, y: 310.85, z: -504 });
    assert.deepEqual(migratedAgain.savedPos, { x: 360, y: 2.2, z: -1938 });

    // Verifica gravação do carimbo worldScale em writeSaveSlot e leitura via loadAllSaveSlots
    globalThis.localStorage.removeItem(SAVE_STORAGE_KEY);
    const written = writeSaveSlot(1, {
      faction: 'pcc',
      studs: 50000,
      playerPos: { x: 10, y: 1.5, z: -50 }
    });
    assert.equal(written.worldScale, WORLD_SCALE);
    const loaded = loadAllSaveSlots();
    assert.equal(loaded[1].worldScale, WORLD_SCALE);
    assert.deepEqual(loaded[1].playerPos, { x: 10, y: 1.5, z: -50 });
  });
});
