import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { setupTestEnvironment, resetTestListeners } from './setup-env.js';
import { isSharedAsset, disposeTransientObject3D } from '../src/materials/LegoMaterials.js';
import { HitchProfiler, isHitchProfilerAllowed } from '../src/debug/HitchProfiler.js';
import { ensurePermanentPlayerHeadlightSpot } from '../src/world/atmosphere/VehicleNightLightsRig.js';
import { prewarmAllRuntimeShaders } from '../src/graphics/ShaderWarmupRig.js';
import { DestructibleManager } from '../src/world/DestructibleManager.js';
import { TestBlockWorld } from '../src/world/TestBlockWorld.js';
import { Minifigure } from '../src/entities/Minifigure.js';
import { ThirdPersonController } from '../src/controls/ThirdPersonController.js';
import { LegoHud } from '../src/ui/LegoHud.js';
import {
  createDefaultAircraftSaveData,
  setActiveAircraftSaveData
} from '../src/world/AircraftCustomGarage.js';

setupTestEnvironment();

function countSceneLights(scene) {
  let totalLights = 0;
  let visibleLights = 0;
  let pointLights = 0;
  let spotLights = 0;

  scene.traverse((obj) => {
    if (obj.isLight) {
      totalLights++;
      if (obj.visible) visibleLights++;
      if (obj.isPointLight) pointLights++;
      if (obj.isSpotLight) spotLights++;
    }
  });

  return { totalLights, visibleLights, pointLights, spotLights };
}

test('1. Contagem total e visível de luzes na cena permanece 100% constante ao entrar/sair de carro à noite e ao abrir/fechar o Hangar', () => {
  resetTestListeners();
  setActiveAircraftSaveData(createDefaultAircraftSaveData());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 3000);
  const hud = new LegoHud(25000);
  const destructibles = new DestructibleManager(scene, hud);
  const world = new TestBlockWorld(scene, destructibles);
  const atm = world.atmosphere;

  const fig = new Minifigure('caveira');
  scene.add(fig.root);
  const canvas = document.getElementById('game-container');
  const ctrl = new ThirdPersonController(camera, canvas, fig, world, destructibles, hud);

  // Garante SpotLight permanente já instalado antes do Frame 1
  const spot = ensurePermanentPlayerHeadlightSpot(atm);
  assert.ok(spot && spot.isSpotLight, 'SpotLight permanente do farol do jogador deve existir');
  assert.equal(spot.visible, true, 'SpotLight do jogador deve iniciar com visible = true');
  assert.equal(spot.intensity, 0, 'SpotLight do jogador deve iniciar com intensity = 0 quando a pé');

  atm.setTimeMode('night');
  world.update(0.016, ctrl.position, ctrl);

  const baselineLights = countSceneLights(scene);
  assert.equal(spot.visible, true);
  assert.equal(spot.intensity, 0);

  // Entrar em veículo à noite: intensity > 0, visible permanece true, contagem de luzes idêntica!
  const sampleVehicle = world.livingCity.trafficVehicles[0].destructible;
  ctrl.enterVehicle(sampleVehicle);
  world.update(0.016, ctrl.position, ctrl);

  const nightDriveLights = countSceneLights(scene);
  assert.deepEqual(
    nightDriveLights,
    baselineLights,
    'Entrar num carro à noite NÃO pode alterar totalLights nem visibleLights da cena'
  );
  assert.equal(spot.visible, true, 'SpotLight deve permanecer visible = true dirigindo à noite');
  assert.ok(spot.intensity > 3.0, 'SpotLight deve acender intensity > 3.0 dirigindo à noite');

  // Transição para dia enquanto dirige: intensity volta a 0, visible continua true!
  atm.setTimeMode('day');
  world.update(0.016, ctrl.position, ctrl);
  const dayDriveLights = countSceneLights(scene);
  assert.deepEqual(dayDriveLights, baselineLights, 'Mudar para dia dirigindo mantém luzes constantes');
  assert.equal(spot.visible, true);
  assert.equal(spot.intensity, 0);

  // Sair do veículo à noite: intensity volta a 0 e estaciona longe, visible permanece true!
  atm.setTimeMode('night');
  world.update(0.016, ctrl.position, ctrl);
  assert.ok(spot.intensity > 3.0);

  ctrl.exitVehicle();
  world.update(0.016, ctrl.position, ctrl);
  const afterExitLights = countSceneLights(scene);
  assert.deepEqual(
    afterExitLights,
    baselineLights,
    'Sair do carro à noite NÃO pode alterar totalLights nem visibleLights da cena'
  );
  assert.equal(spot.visible, true, 'SpotLight NUNCA pode receber visible = false ao sair do carro');
  assert.equal(spot.intensity, 0, 'SpotLight deve zerar intensity ao sair do carro');
  assert.equal(spot.position.y, -500, 'SpotLight inativo deve estacionar em Y = -500');

  // Abrir, trocar aeronave e fechar o Estúdio do Hangar do Aeroporta-Aviões: 0 PointLights adicionadas/removidas!
  const beforeHangarLights = countSceneLights(scene);
  hud.aircraftStudio.open(world, ctrl, 'jato_caca');
  const duringHangarOpenLights = countSceneLights(scene);
  assert.deepEqual(
    duringHangarOpenLights,
    beforeHangarLights,
    'Abrir o Hangar NÃO pode adicionar PointLights na cena principal'
  );

  hud.aircraftStudio.selectAircraftType('heli_ataque');
  const duringHangarSwitchLights = countSceneLights(scene);
  assert.deepEqual(duringHangarSwitchLights, beforeHangarLights);

  hud.aircraftStudio.close(false);
  const afterHangarCloseLights = countSceneLights(scene);
  assert.deepEqual(
    afterHangarCloseLights,
    beforeHangarLights,
    'Fechar o Hangar mantém a contagem de luzes 100% idêntica'
  );
});

test('2. Turbo Fantasma reutiliza a mesma Moto Fantasma em 10 invocações seguidas (mesmo após estilhaçar) + ShaderWarmupRig restaura visibilidade', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 1000);
  camera.position.set(0, 4, 20);
  camera.lookAt(0, 2, 0);
  const destructibles = new DestructibleManager(scene);

  let compileCallCount = 0;
  let bikeVisibleDuringCompile = false;
  let warmupGroupPresentDuringCompile = false;
  const mockRenderer = {
    compile(compiledScene) {
      compileCallCount++;
      bikeVisibleDuringCompile = Boolean(destructibles._turboGhostBikeObj?.mesh?.visible);
      warmupGroupPresentDuringCompile = Boolean(
        compiledScene.getObjectByName('ShaderWarmupRigGroup')
      );
    }
  };

  const warmupSummary = prewarmAllRuntimeShaders(mockRenderer, scene, camera, null, destructibles);
  assert.equal(compileCallCount, 1, 'renderer.compile deve ser invocado uma vez no warm-up');
  assert.equal(bikeVisibleDuringCompile, true, 'Moto Fantasma deve ficar visível durante o compile');
  assert.equal(warmupGroupPresentDuringCompile, true, 'Grupo temporário deve estar na cena durante o compile');
  assert.equal(scene.getObjectByName('ShaderWarmupRigGroup'), undefined, 'Grupo de warm-up deve ser removido após o compile');
  assert.equal(warmupSummary.ghostBikePrewarmed, true);
  assert.equal(destructibles._turboGhostBikeObj.mesh.visible, false, 'Moto Fantasma deve voltar a visible = false após o warm-up');
  assert.equal(destructibles._turboGhostBikeObj.destroyed, true);

  const prewarmedBike = destructibles._turboGhostBikeObj;
  const prewarmedMesh = prewarmedBike.mesh;
  const lightsBefore = countSceneLights(scene);

  for (let i = 0; i < 10; i++) {
    const pos = new THREE.Vector3(i * 5, 0.5, -12 - i * 2);
    const bike = destructibles.summonTurboEnergyBike(pos, i * 0.25);

    assert.equal(bike, prewarmedBike, `Invocação #${i + 1} deve reutilizar o exato mesmo bikeObj`);
    assert.equal(bike.mesh, prewarmedMesh, `Invocação #${i + 1} deve reutilizar a exata mesma malha 3D`);
    assert.equal(bike.destroyed, false);
    assert.equal(bike.hp, 420);
    assert.equal(bike.mesh.visible, true);
    assert.equal(bike.mesh.position.x, pos.x);
    assert.equal(bike.mesh.position.z, pos.z);
    assert.equal(bike.colliders[0].disabled, false);

    // Simula destruição completa nas iterações 3 e 7 para validar reviver in-place
    if (i === 3 || i === 7) {
      destructibles.damageObject(bike, 9999, pos, true);
      assert.equal(bike.destroyed, true, 'Moto deve marcar destroyed = true ao estilhaçar');
      assert.equal(bike.mesh.visible, false, 'Moto estilhaçada deve ocultar a malha');
      assert.equal(bike.colliders[0].disabled, true, 'Colisor deve desativar ao estilhaçar');
    }
  }

  const ghostBikesInRegistry = destructibles.objects.filter(
    (o) => o.mesh?.userData?.vehicleSpec?.id === 'moto_fantasma_turbo'
  );
  assert.equal(ghostBikesInRegistry.length, 1, 'Deve existir apenas 1 Moto Fantasma registrada');
  assert.deepEqual(countSceneLights(scene), lightsBefore, 'Invocar a moto 10x adiciona 0 luzes');

  // Todos os assets da moto e da muralha de luz estão protegidos como shared assets (zero leaks)
  prewarmedMesh.traverse((node) => {
    if (node.isMesh) {
      assert.equal(isSharedAsset(node.geometry), true, 'Geometria da Moto Fantasma deve ser shared asset');
      assert.equal(isSharedAsset(node.material), true, 'Material da Moto Fantasma deve ser shared asset');
    }
  });

  destructibles.spawnTurboLightWallSegment(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 4));
  assert.equal(destructibles.lightWallSegments.length, 1);
  const firstWallMesh = destructibles.lightWallSegments[0].mesh;
  destructibles._updateFxParticlesAndBeams(5.0);
  assert.equal(destructibles.lightWallSegments.length, 0);
  destructibles.spawnTurboLightWallSegment(new THREE.Vector3(2, 0, 0), new THREE.Vector3(2, 0, 5));
  assert.equal(
    destructibles.lightWallSegments[0].mesh,
    firstWallMesh,
    'Segmentos expirados da Muralha de Luz devem reciclar o mesmo slot 3D do pool'
  );
  disposeTransientObject3D(prewarmedMesh);
});

test('3. HitchProfiler detecta ?debug=1, rastreia markAction, markWarmupComplete e registra hitches + recompilações de shader', () => {
  assert.equal(isHitchProfilerAllowed('?debug=1'), true);
  assert.equal(isHitchProfilerAllowed('?preset=ultra&debug=true'), true);
  assert.equal(isHitchProfilerAllowed('?debug=0'), false);
  assert.equal(isHitchProfilerAllowed(''), false);

  const mockRenderer = {
    info: {
      programs: [{}, {}, {}],
      memory: { geometries: 40, textures: 12 }
    }
  };

  const profiler = new HitchProfiler(mockRenderer, { thresholdMs: 50, forceEnabled: true });
  assert.equal(profiler.enabled, true);

  profiler.markWarmupComplete(mockRenderer);
  assert.equal(profiler.warmupCompleted, true);
  assert.equal(profiler.baselinePrograms, 3);

  // Frame rápido (16ms) sem novos shaders -> nenhum hitch
  const cleanRes = profiler.recordFrame(16.0, mockRenderer, 1000);
  assert.equal(cleanRes, null);
  assert.equal(profiler.getReport().hitches.length, 0);

  // Simula ação + recompilação de shader + frame de 68ms
  profiler.markAction('enter_vehicle', 2000);
  mockRenderer.info.programs.push({}, {});
  mockRenderer.info.memory.geometries += 3;

  const hitchEntry = profiler.recordFrame(68.4, mockRenderer, 2030);
  assert.ok(hitchEntry, 'Frame de 68.4ms acima de 50ms deve gerar entrada de hitch');
  assert.equal(hitchEntry.lastAction, 'enter_vehicle');
  assert.equal(hitchEntry.actionAgeMs, 30);
  assert.equal(hitchEntry.programsBefore, 3);
  assert.equal(hitchEntry.programsAfter, 5);
  assert.equal(hitchEntry.programsDelta, 2);
  assert.equal(hitchEntry.geometriesDelta, 3);

  const report = profiler.getReport();
  assert.equal(report.hitches.length, 1);
  assert.equal(report.baselinePrograms, 3);
  assert.equal(report.currentPrograms, 5);
  assert.equal(report.runtimeShaderCompiles, 2);

  profiler.dispose();
});
