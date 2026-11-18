import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { setupTestEnvironment, resetTestListeners } from './setup-env.js';
import { TestBlockWorld } from '../src/world/TestBlockWorld.js';
import { DestructibleManager } from '../src/world/DestructibleManager.js';
import { Minifigure } from '../src/entities/Minifigure.js';
import { ThirdPersonController } from '../src/controls/ThirdPersonController.js';
import { LegoHud } from '../src/ui/LegoHud.js';
import {
  MAIN_WEST_POLYGON,
  EAST_PENINSULA_POLYGON,
  PRISON_ISLAND_POLYGON,
  ARCHIPELAGO_ISLETS,
  HORIZON_MOUNTAINS,
  REGION_BORDER_LINES,
  isPointOnOrganicLand,
  getWorldSoftBoundaryForce
} from '../src/world/CoastlineProfile.js';

setupTestEnvironment();

test('Costa orgânica elimina o quadradão, adiciona ilhotas, horizonte 360° e respeita todas as zonas de água/terra', () => {
  const scene = new THREE.Scene();
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);

  // Poligonais ricas com recortes costeiros reais (nunca um retângulo de 4 vértices)
  assert.ok(MAIN_WEST_POLYGON.length >= 40, 'Costa principal deve ter contornos detalhados');
  assert.ok(EAST_PENINSULA_POLYGON.length >= 25, 'Península Leste deve ter contornos detalhados');
  assert.ok(PRISON_ISLAND_POLYGON.length >= 40, 'Ilha da Prisão deve ter contorno rochoso orgânico');
  assert.ok(ARCHIPELAGO_ISLETS.length >= 9, 'Deve haver pelo menos 9 ilhotas ao redor');
  assert.ok(HORIZON_MOUNTAINS.length >= 16, 'Deve haver montanhas no horizonte em 360°');
  assert.ok(REGION_BORDER_LINES.length >= 5, 'Fronteiras de região devem estar mapeadas');

  // Testa variância orgânica na costa norte e oeste (baías vs penínsulas)
  const northZs = MAIN_WEST_POLYGON.filter((p) => p[1] < -1300).map((p) => p[1]);
  assert.ok(
    Math.max(...northZs) - Math.min(...northZs) >= 60,
    'Costa Norte deve variar entre baías e cabos em vez de linha reta'
  );

  // Ilhotas do arquipélago devem ser pisáveis (isDeepWaterAt=false e terreno elevado!)
  for (const isl of ARCHIPELAGO_ISLETS) {
    assert.equal(
      world.isDeepWaterAt(isl.x, isl.z),
      false,
      `Ilhota ${isl.id} em (${isl.x},${isl.z}) deve ser terra firme`
    );
    assert.ok(
      world.getSurfaceHeightAt(isl.x, isl.z, 2) >= isl.peakY - 0.1,
      `Ilhota ${isl.id} deve ter elevação caminhável`
    );
  }

  // Oceano aberto e pontos críticos de teste preservados
  assert.equal(world.isDeepWaterAt(220, 1080, { forCar: true }), true, 'Canal aberto Sul preservado');
  assert.equal(world.isDeepWaterAt(0, 1620), true, 'Oceano além do Mega Píer preservado');
  assert.equal(world.isDeepWaterAt(1650, 700), true, 'Canal de atracação do Porto preservado');
  assert.equal(world.isDeepWaterAt(-1380, 1135, false), false, 'Marina Oeste preservada');
  assert.equal(isPointOnOrganicLand(-1735, 945), true, 'Promontório do Farol Sudoeste preservado');

  // Oceano estendido além de 3100m até ±9500m
  const oceanBox = new THREE.Box3().setFromObject(world.oceanMesh);
  assert.ok(oceanBox.max.x >= 9000 && oceanBox.min.x <= -9000, 'Oceano deve cobrir horizonte até ±9500m');
});

test('Limite suave do mundo não corta Ilha da Prisão e renderiza costa orgânica no Minimapa & Mapa [M]', () => {
  resetTestListeners();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1.6, 0.5, 4500);
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);
  const hud = new LegoHud();
  const fig = new Minifigure('caveira');
  scene.add(fig.root);

  const canvas = document.getElementById('test-coast-canvas');
  const ctrl = new ThirdPersonController(camera, canvas, fig, world, dest, hud);

  // Antigamente clamp z<=1700 travava o jogador antes do sul da Ilha da Prisão (Z=1960)!
  ctrl.position.set(1375, 1.0, 1950);
  ctrl.update(0.016);
  assert.ok(ctrl.position.z >= 1940, 'Jogador deve alcançar toda a Ilha da Prisão sem parede invisível em 1700');

  // Limite natural no oceano extremo aplica força de retorno suave
  const edgeForce = getWorldSoftBoundaryForce(2750, 0);
  assert.ok(edgeForce.fx < 0 && edgeForce.intensity > 0, 'Força suave deve empurrar de volta ao arquipélago');

  // Renderiza Minimapa e Mapa Tático [M] sem erros
  const region = world.getRegionAt(0, 1, -80);
  assert.doesNotThrow(() => {
    hud.updateMinimap(ctrl.position, 0, 0, region, world, 0, 0.016);
    hud.renderFullMap(world, ctrl.position, 0);
  });
});
