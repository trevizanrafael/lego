import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { ws } = await import('../src/world/core/WorldLayoutScale.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld, MAP_REGIONS } = await import('../src/world/TestBlockWorld.js');
const { isPointOnOrganicLand } = await import('../src/world/CoastlineProfile.js');
const { buildWestHighwayAndAirport } = await import('../src/world/regions/WestAirportBuilder.js');
const { buildPangaeaPeripheryExtensions } = await import('../src/world/regions/PangaeaPeripheryBuilder.js');
const {
  PrisonIslandBatcher,
  PRISON_DOCK_OFFSET_X,
  PRISON_DOCK_OFFSET_Z
} = await import('../src/world/regions/prison-island/PrisonBatcherAndBridgeBuilder.js');
const {
  buildPrisonIslandPerimeterWallsAndCoastGuardDock,
  buildFourInternalCourtyardSectors
} = await import('../src/world/regions/prison-island/PrisonWallsAndTowersBuilder.js');

describe('M8 — Periferia Natural (Serra/Restinga/Estradinhas), Bordas Naturais Aeroporto/Prisão & Batching Vertex-Color + LOD', () => {
  let scene;
  let destructibles;
  let world;

  before(() => {
    scene = new THREE.Scene();
    destructibles = new DestructibleManager(scene);
    world = new TestBlockWorld(scene, destructibles);
  });

  it('1. Popula world.naturalPeripheryData (Serra, Restinga/Mangue, Afloramentos e Estradinhas Rurais) abaixo de <45k tris e <16 draw calls', () => {
    const data = world.naturalPeripheryData;
    assert.ok(data, 'world.naturalPeripheryData deve existir');
    assert.ok(data.highlandTreesCount >= 400, `highlandTreesCount >= 400 (atual: ${data.highlandTreesCount})`);
    assert.ok(data.restingaShrubsCount >= 200, `restingaShrubsCount >= 200 (atual: ${data.restingaShrubsCount})`);
    assert.ok(data.rockOutcropsCount >= 80, `rockOutcropsCount >= 80 (atual: ${data.rockOutcropsCount})`);
    assert.ok(data.ruralLanesCount >= 4, `ruralLanesCount >= 4 (atual: ${data.ruralLanesCount})`);
    assert.ok(data.chunkCount >= 5, `chunkCount >= 5 (atual: ${data.chunkCount})`);

    const ruralRoads = (world.mapOrganicRoads || []).filter((r) => r.isRural === true);
    assert.ok(ruralRoads.length >= 4, `world.mapOrganicRoads deve registrar >= 4 estradinhas rurais (atual: ${ruralRoads.length})`);
    for (const r of ruralRoads) {
      assert.equal(r.isMain, false);
      assert.equal(r.width, 8.5);
      assert.ok(Array.isArray(r.points) && r.points.length >= 4);
    }

    // Verifica LOD 3 níveis (0m / 420m / 1150m vazio) e orçamento < 45.000 tris & < 16 draw calls em qualquer ponto de vista
    const natLods = [];
    let ruralLaneMesh = null;
    scene.traverse((obj) => {
      if (obj.isLOD && obj.userData?.isNaturalPeripheryLod) {
        natLods.push(obj);
        assert.equal(obj.userData.skipStaticMerge, true, 'LOD da periferia natural deve marcar skipStaticMerge');
        assert.equal(obj.levels.length, 3, 'LOD da periferia natural deve ter 3 níveis (0m, 420m, 1150m)');
        assert.equal(obj.levels[2].object.children.length, 0, 'Nível L2 (>=1150m) deve ser grupo vazio (0 tris)');
      } else if (obj.isMesh && obj.userData?.isRuralLanesMesh) {
        ruralLaneMesh = obj;
      }
    });
    assert.ok(natLods.length >= 5, 'Devem existir múltiplos chunks THREE.LOD na periferia natural');
    assert.ok(ruralLaneMesh, 'Malha unificada de estradinhas rurais deve existir');

    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 3500);
    const viewpoints = [
      [0, 12, 0],
      [ws(-1215), 18, ws(-2420)],
      [ws(-2920), 20, ws(-1285)],
      [ws(2680), 18, ws(-1120)],
      [ws(-2520), 12, ws(2020)],
      [0, 415, ws(-50)]
    ];

    for (const [vx, vy, vz] of viewpoints) {
      camera.position.set(vx, vy, vz);
      camera.updateMatrixWorld();
      for (const lod of natLods) lod.update(camera);

      let activeDrawCalls = ruralLaneMesh.visible ? 1 : 0;
      let activeTris = ruralLaneMesh.geometry.index
        ? ruralLaneMesh.geometry.index.count / 3
        : ruralLaneMesh.geometry.attributes.position.count / 3;

      for (const lod of natLods) {
        const lvlIdx = lod.getCurrentLevel();
        const grp = lod.levels[lvlIdx]?.object;
        if (!grp) continue;
        grp.traverse((m) => {
          if (!m.isMesh) return;
          assert.equal(m.castShadow, false);
          assert.equal(m.receiveShadow, false);
          activeDrawCalls++;
          const g = m.geometry;
          activeTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
        });
      }

      assert.ok(
        activeTris < 45000,
        `Triângulos ativos da periferia natural devem ser < 45.000 em (${vx},${vy},${vz}), atual: ${activeTris}`
      );
      assert.ok(
        activeDrawCalls < 16,
        `Draw calls ativos da periferia natural devem ser < 16 em (${vx},${vy},${vz}), atual: ${activeDrawCalls}`
      );
    }
  });

  it('2. Zero árvores ou rochas da periferia natural em água profunda ou sobrepondo pistas (world.mapRoads)', () => {
    const placements = world.naturalPeripheryData.placements || [];
    assert.ok(placements.length >= 680, `Placements registrados insuficientes: ${placements.length}`);

    const groundRoads = (world.mapRoads || []).filter((r) => !r.isElevated);
    let waterViolations = 0;
    let roadViolations = 0;

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      if (!isPointOnOrganicLand(p.x, p.z) || world.isDeepWaterAt(p.x, p.z)) {
        waterViolations++;
      }
      for (let r = 0; r < groundRoads.length; r++) {
        const rd = groundRoads[r];
        if (Math.abs(p.x - rd.x) <= rd.w * 0.5 + 4 && Math.abs(p.z - rd.z) <= rd.d * 0.5 + 4) {
          roadViolations++;
          break;
        }
      }
    }

    assert.equal(waterViolations, 0, `Zero árvores/rochas em água profunda (atual: ${waterViolations})`);
    assert.equal(roadViolations, 0, `Zero árvores/rochas sobrepondo world.mapRoads (atual: ${roadViolations})`);
  });

  it('3. Placas retangulares gigantes do Aeroporto Oeste (2.4km) e Ilha da Prisão (2.5km) removidas mantendo dados e solo seco', () => {
    // Nenhum mapBlock gigante >= 2000m no Aeroporto Oeste nem na Ilha da Prisão
    const giantAirportBlocks = (world.mapBlocks || []).filter(
      (b) => b.x < ws(-1010) && b.w > 1800 && b.d > 1800
    );
    assert.equal(giantAirportBlocks.length, 0, 'Lajões retangulares gigantes de 2.4km do Aeroporto Oeste devem sumir');

    const giantPrisonBlocks = (world.mapBlocks || []).filter(
      (b) => b.x > ws(800) && b.z > ws(1000) && (b.w > 1200 || b.d > 1200)
    );
    assert.equal(giantPrisonBlocks.length, 0, 'Lajão quadrado gigante de 2.5km da Ilha da Prisão deve sumir');

    // Metadados intactos do Aeroporto Oeste e Ilha da Prisão
    assert.ok(world.westAirportData, 'world.westAirportData preservado');
    assert.equal(world.westAirportData.terminalLength, 960);
    assert.equal(world.westAirportData.terminalEnterable, true);
    assert.equal(world.westAirportData.openHangarsCount, 16);
    assert.equal(world.westAirportData.atcTowersCount, 3);
    assert.equal(world.westAirportData.hasNorthMilitaryWing, true);

    assert.ok(world.prisonIslandData, 'world.prisonIslandData preservado');
    assert.ok(world.prisonIslandData.coastalRocksCount >= 120, `coastalRocksCount >= 120 (atual: ${world.prisonIslandData.coastalRocksCount})`);
    assert.equal(world.prisonIslandData.watchtowersCount, 8);
    assert.equal(world.prisonIslandData.visibleGroundCellsCount, 24);

    // Causeway logístico da Ilha da Prisão registrado
    const prisonOrganicCauseways = (world.mapOrganicRoads || []).filter((r) => String(r.id || '').startsWith('prison_causeway_'));
    assert.ok(prisonOrganicCauseways.length >= 2, 'Causeways blindados Norte e Doca Oeste devem estar registrados');

    // Spawns e áreas operacionais em terra firme seca (isDeepWaterAt === false)
    const airportReg = MAP_REGIONS.find((r) => r.id === 'aeroporto_oeste');
    const prisonReg = MAP_REGIONS.find((r) => r.id === 'ilha_prisao');
    assert.equal(world.isDeepWaterAt(airportReg.spawn.x, airportReg.spawn.z), false, 'Spawn do Aeroporto Oeste seco');
    assert.equal(world.isDeepWaterAt(ws(-1145), 0), false, 'Interior do Mega Terminal seco');
    assert.equal(world.isDeepWaterAt(ws(-1660), 0), false, 'Pista 09/27 seca');
    assert.equal(world.isDeepWaterAt(prisonReg.spawn.x, prisonReg.spawn.z), false, 'Spawn da Ilha da Prisão seco');
    assert.equal(world.isDeepWaterAt(ws(1375), ws(1540)), false, 'Cidadela da Ilha da Prisão seca');
    assert.equal(world.isDeepWaterAt(928 + PRISON_DOCK_OFFSET_X, 1550 + PRISON_DOCK_OFFSET_Z), false, 'Doca Naval da Guarda Costeira seca');
  });

  it('4. Zero MeshPhysicalMaterials criados por Aeroporto Oeste, Ilha da Prisão e Periferia + LOD 2 níveis (340m)', () => {
    const createMockWorld = () => ({
      scene: new THREE.Scene(),
      colliders: [],
      rotatingElements: [],
      mapRoads: [],
      mapOrganicRoads: [],
      mapBlocks: [],
      mapBuildings: [],
      landmarks: [],
      elevatedDecks: [],
      destructibles: null,
      prisonIslandData: {
        coastalRocksCount: 0,
        guardsCount: 0,
        watchtowersCount: 0,
        elevatedGuardCatwalksCount: 0,
        cvPrisonersCount: 0,
        pccPrisonersCount: 0,
        orangePrisonersCount: 0,
        weightBenchesCount: 0,
        cafeteriaTablesCount: 0,
        armoredPrisonBusesCount: 0,
        substationTransformersCount: 0,
        powerCoilsCount: 0,
        dieselGeneratorsCount: 0,
        powerTowersCount: 0,
        waterTowersCount: 0
      },
      addCollider(x, z, w, d, maxY, minY) {
        const col = { minX: x - w * 0.5, maxX: x + w * 0.5, minZ: z - d * 0.5, maxZ: z + d * 0.5, minY, maxY };
        this.colliders.push(col);
        return col;
      },
      isDeepWaterAt: () => false
    });

    const countPhysicalMaterials = (root) => {
      let count = 0;
      const uniqueMats = new Set();
      root.traverse((n) => {
        if (!n.isMesh || !n.material) return;
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        for (const m of mats) {
          uniqueMats.add(m);
          if (m.isMeshPhysicalMaterial) count++;
        }
      });
      return { physicalCount: count, uniqueMatsCount: uniqueMats.size };
    };

    const airportMock = createMockWorld();
    buildWestHighwayAndAirport(airportMock);
    const airStats = countPhysicalMaterials(airportMock.scene);
    assert.equal(airStats.physicalCount, 0, 'Aeroporto Oeste deve criar 0 MeshPhysicalMaterials');

    const prisonMock = createMockWorld();
    const pBatcher = new PrisonIslandBatcher();
    buildPrisonIslandPerimeterWallsAndCoastGuardDock(prisonMock, pBatcher);
    buildFourInternalCourtyardSectors(prisonMock, pBatcher);
    pBatcher.flush(prisonMock.scene);
    const prisonStats = countPhysicalMaterials(prisonMock.scene);
    assert.equal(prisonStats.physicalCount, 0, 'Ilha da Prisão deve criar 0 MeshPhysicalMaterials');

    const peripheryMock = createMockWorld();
    buildPangaeaPeripheryExtensions(peripheryMock);
    const periphStats = countPhysicalMaterials(peripheryMock.scene);
    assert.equal(periphStats.physicalCount, 0, 'Periferia + NaturalPeriphery devem criar 0 MeshPhysicalMaterials');

    // Confirma THREE.LOD 2 níveis em 340m no Aeroporto e na Prisão
    let airportLods = 0;
    let prisonLods = 0;
    scene.traverse((n) => {
      if (n.isLOD && n.userData?.isWestAirportLod) {
        airportLods++;
        assert.equal(n.levels.length, 2);
        assert.equal(n.levels[1].distance, 340);
      } else if (n.isLOD && n.userData?.isPrisonIslandLod) {
        prisonLods++;
        assert.equal(n.levels.length, 2);
        assert.equal(n.levels[1].distance, 340);
      }
    });
    assert.ok(airportLods >= 2, `Aeroporto Oeste deve usar chunks THREE.LOD 340m (atual: ${airportLods})`);
    assert.ok(prisonLods >= 2, `Ilha da Prisão deve usar chunks THREE.LOD 340m (atual: ${prisonLods})`);
  });
});
