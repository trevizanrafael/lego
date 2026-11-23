import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment, resetTestListeners } from './setup-env.js';

setupTestEnvironment({ search: '' });

const { ws } = await import('../src/world/core/WorldLayoutScale.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');
const { Minifigure } = await import('../src/entities/Minifigure.js');
const { PCCIndustrialBatcher, getEastPortSharedVcMaterials } = await import(
  '../src/world/regions/east-port/EastPortBatcherAndMaterials.js'
);

describe('M7 (Part B) — Distrito Industrial Pesado, Ramal Ferroviário de Carga até o Cais & Batcher Vertex-Color', () => {
  let scene;
  let camera;
  let hud;
  let destructibles;
  let world;
  let controller;

  before(() => {
    resetTestListeners();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 3100);
    hud = new LegoHud(35000);
    hud.isTitleScreenActive = false;
    destructibles = new DestructibleManager(scene, hud);
    world = new TestBlockWorld(scene, destructibles);
    const hero = new Minifigure('pcc_contador');
    scene.add(hero.root);
    const domElement = globalThis.document.getElementById('game-container');
    controller = new ThirdPersonController(camera, domElement, hero, world, destructibles, hud);
  });

  it('1. Ramal Ferroviário de Carga liga o Distrito Industrial (z < 0) ao Cais do Porto (z > ws(150)) com >= 80 segmentos, >= 6 vagões e 0 vagões em mapRoads', () => {
    const ep = world.eastPortData;
    const ind = world.industrialPCCData;

    assert.equal(ep.hasFreightRailSpur, true, 'eastPortData.hasFreightRailSpur deve ser true');
    assert.equal(ind.hasFreightRailSpur, true, 'industrialPCCData.hasFreightRailSpur deve ser true');
    assert.ok(
      ep.railTrackSegmentsCount >= 80,
      `Ramal ferroviário deve ter >= 80 segmentos de trilho/lastro (atual: ${ep.railTrackSegmentsCount})`
    );
    assert.ok(
      ep.freightRailCarsCount >= 6,
      `Devem existir >= 6 locomotivas/vagões estacionados (atual: ${ep.freightRailCarsCount})`
    );
    assert.ok(ep.railLevelCrossingsCount >= 8, 'Deve haver passagens de nível sinalizadas nos cruzamentos viários');

    const wps = ep.railWaypoints || [];
    assert.ok(wps.some((p) => p.z < 0 && p.x > ws(1200)), 'Ramal deve iniciar nos pátios industriais (z < 0)');
    assert.ok(
      wps.some((p) => p.z > ws(150) && p.x > ws(1560)),
      'Ramal deve avançar pelo Cais Leste do Porto (z > ws(150)) junto aos Portainers'
    );

    const groundRoads = (world.mapRoads || []).filter((r) => !r.isElevated && !r.isBridge);
    const carRoadCollisions = [];
    for (const car of ep.freightRailCars || []) {
      const cMinX = car.x - car.w * 0.5;
      const cMaxX = car.x + car.w * 0.5;
      const cMinZ = car.z - car.d * 0.5;
      const cMaxZ = car.z + car.d * 0.5;
      for (const rd of groundRoads) {
        if (
          cMinX < rd.x + rd.w * 0.5 &&
          cMaxX > rd.x - rd.w * 0.5 &&
          cMinZ < rd.z + rd.d * 0.5 &&
          cMaxZ > rd.z - rd.d * 0.5
        ) {
          carRoadCollisions.push({ car, road: rd });
          break;
        }
      }
    }
    assert.equal(
      carRoadCollisions.length,
      0,
      `Zero vagões/locomotivas bloqueando mapRoads: ${JSON.stringify(carRoadCollisions)}`
    );
  });

  it('2. >= 65% dos lotes de infill industrial são Complexos Industriais Pesados (w >= 44 || d >= 44), via ribeirinha do Canal existe e PCCIndustrialBatcher gera < 60 meshes', () => {
    const ind = world.industrialPCCData;
    assert.equal(ind.hasCanalServiceRoad, true, 'Deve existir a Via de Serviço Industrial na margem leste do Canal');
    assert.ok(
      (world.mapOrganicRoads || []).some((r) => r.isCanalServiceRoad),
      'Via ribeirinha do Canal registrada em mapOrganicRoads'
    );

    const heavySheds = (world.mapBuildings || []).filter(
      (b) => b.isHeavyIndustrialShed && (b.w >= 44 || b.d >= 44)
    );
    assert.ok(
      heavySheds.length >= 20,
      `Devem existir dezenas de Galpões Industriais Pesados de grande pegada (atual: ${heavySheds.length})`
    );
    const share = ind.heavyIndustrialShedsCount / Math.max(1, ind.totalInfillLotsCount);
    assert.ok(
      share >= 0.65,
      `Pelo menos 65% dos lotes de infill industrial devem ser Galpões Pesados (atual: ${(share * 100).toFixed(1)}%)`
    );

    assert.ok(
      ind.batchedStaticMeshesCount > 0 && ind.batchedStaticMeshesCount < 60,
      `PCCIndustrialBatcher deve gerar < 60 meshes estáticos totais (atual: ${ind.batchedStaticMeshesCount})`
    );

    const sharedMats = getEastPortSharedVcMaterials();
    assert.equal(sharedMats.indStructuralVcMat.vertexColors, true);
    assert.equal(sharedMats.indMetallicVcMat.vertexColors, true);
    assert.equal(sharedMats.indEmissiveVcMat.vertexColors, true);

    const probeScene = new THREE.Scene();
    const probeBatcher = new PCCIndustrialBatcher(null);
    probeBatcher.addBox('pcc_navy', 20, 12, 20, 2000, 6.28, -500);
    probeBatcher.addBox('armor_slate', 40, 0.28, 40, 2000, 0.14, -500);
    probeBatcher.addBox('brushed_silver', 4, 8, 4, 2010, 4.28, -500);
    probeBatcher.addBox('pcc_neon_blue', 2, 1, 2, 2000, 12.5, -500);
    const probeCount = probeBatcher.finalize(probeScene);
    assert.ok(probeCount <= 4, `Um chunk único deve gerar no máximo 4 meshes VC (atual: ${probeCount})`);
  });

  it('3. Preserva 100% dos contratos industrialPCCData e eastPortData, vão livre do Portainer e 0 mapBuildings sobre mapRoads', () => {
    const ind = world.industrialPCCData;
    const ep = world.eastPortData;

    assert.equal(ind.faction, 'PCC');
    assert.equal(ind.hasCentralBunker, true);
    assert.equal(ind.skybridgesCount, 4);
    assert.ok(ind.blocksCount >= 50);
    assert.ok(ind.corporateTowersCount >= 20);
    assert.ok(ind.siloBatteriesCount >= 18);
    assert.ok(ind.coolingTowersCount >= 8);
    assert.ok(ind.tallSmokestacksCount >= 20);
    assert.ok(ind.pccContainerStacksCount >= 35);
    assert.ok(ind.c4WarehousesCount >= 20);
    assert.equal(ind.entryBarricadesCount, 5);

    assert.equal(ep.hasHeavyConcreteQuay, true);
    assert.equal(ep.demarcatedCargoYardsCount, 10);
    assert.equal(ep.floodlightTowersCount, 16);
    assert.equal(ep.rtgCranesCount, 18);
    assert.ok(ep.detailedContainersCount >= 2200);
    assert.equal(ep.numberedWarehouses.length, 10);
    assert.equal(ep.portainerCranesCount, 5);
    assert.equal(ep.mooredCargoShipsCount, 3);
    assert.equal(ep.shipGangwaysCount, 6);
    assert.ok(ep.cargoTrucksCount >= 24);

    // Vão livre sob as pernas do Portainer em craneX = ws(1620) - 65, craneZ = ws(415)
    const craneX = ws(1620) - 65;
    const craneZ = ws(415);
    controller.position.set(craneX, 0.35, craneZ + 6);
    controller.yaw = 0;
    controller.keys.forward = true;
    for (let i = 0; i < 55; i++) controller.update(1 / 30);
    controller.keys.forward = false;
    assert.ok(controller.position.z < craneZ - 4, `Passagem livre sob o Portainer preservada (z=${controller.position.z.toFixed(2)})`);

    const groundRoads = (world.mapRoads || []).filter((r) => !r.isElevated && !r.isBridge);
    const overlaps = [];
    for (const b of world.mapBuildings || []) {
      if ((b.minY ?? 0) > 6.0) continue;
      const bMinX = b.x - b.w * 0.5 + 0.6, bMaxX = b.x + b.w * 0.5 - 0.6;
      const bMinZ = b.z - b.d * 0.5 + 0.6, bMaxZ = b.z + b.d * 0.5 - 0.6;
      for (const r of groundRoads) {
        if (
          bMinX < r.x + r.w * 0.5 - 0.6 &&
          bMaxX > r.x - r.w * 0.5 + 0.6 &&
          bMinZ < r.z + r.d * 0.5 - 0.6 &&
          bMaxZ > r.z - r.d * 0.5 + 0.6
        ) {
          overlaps.push({ b, r });
          break;
        }
      }
    }
    assert.equal(overlaps.length, 0, `Zero mapBuildings sobrepondo mapRoads: ${JSON.stringify(overlaps.slice(0, 5))}`);
  });
});
