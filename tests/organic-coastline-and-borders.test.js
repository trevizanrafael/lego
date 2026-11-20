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
  PANGAEA_HIGHWAYS,
  getDistanceToCoastAt,
  getPangaeaElevationAt,
  isPointOnOrganicLand,
  getWorldSoftBoundaryForce
} from '../src/world/CoastlineProfile.js';

setupTestEnvironment();

test('Supercontinente Pangeia expandido, faixa contínua de areia, rodovias e respeito a água/terra', () => {
  const scene = new THREE.Scene();
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);

  // Poligonais amplas em formato assimétrico de Pangeia
  assert.ok(MAIN_WEST_POLYGON.length >= 60, 'Costa principal deve ter contornos detalhados');
  assert.ok(EAST_PENINSULA_POLYGON.length >= 25, 'Chifre Nordeste deve ter contornos detalhados');
  assert.ok(PRISON_ISLAND_POLYGON.length >= 40, 'Ilha da Prisão deve ter contorno rochoso orgânico');
  assert.ok(ARCHIPELAGO_ISLETS.length >= 12, 'Deve haver pelo menos 12 ilhotas ao redor da Pangeia');
  assert.ok(HORIZON_MOUNTAINS.length >= 24, 'Deve haver cadeia montanhosa no horizonte em 360°');
  assert.ok(REGION_BORDER_LINES.length >= 8, 'Fronteiras claras inter-regionais mapeadas');
  assert.ok(PANGAEA_HIGHWAYS.length >= 6, 'Rodovias regionais interligam as novas áreas');

  // Escala supercontinental (~6700m x 5300m) + grande variação de costas
  const westXs = MAIN_WEST_POLYGON.map((p) => p[0]);
  const westZs = MAIN_WEST_POLYGON.map((p) => p[1]);
  const eastXs = EAST_PENINSULA_POLYGON.map((p) => p[0]);
  assert.ok(Math.min(...westXs) <= -3200, 'Cabo Noroeste / Sudoeste alcança <= -3200m');
  assert.ok(Math.max(...eastXs) >= 3250, 'Chifre Nordeste alcança >= +3250m');
  assert.ok(Math.min(...westZs) <= -2800, 'Planalto Boreal Norte alcança <= -2800m');
  assert.ok(Math.max(...westZs) >= 2400, 'Península Sudoeste alcança >= +2400m');

  // Novas regiões periféricas caminháveis com elevação real e Golfo de Tétis aberto em mar profundo
  assert.equal(isPointOnOrganicLand(-1215, -2420), true, 'Planalto Boreal Norte em terra firme');
  assert.equal(isPointOnOrganicLand(-2920, -1285), true, 'Cabo Radar Noroeste em terra firme');
  assert.equal(isPointOnOrganicLand(2740, -1120), true, 'Parque Eólico / Refinaria Tétis em terra firme');
  assert.equal(isPointOnOrganicLand(-2520, 2020), true, 'Vila Dunas Sudoeste em terra firme');
  assert.equal(world.isDeepWaterAt(2000, 480), true, 'Golfo de Tétis Leste deve ser mar aberto entre penínsulas');

  // Verifica que TODA a costa tem faixa contínua de areia/descida natural até a água (zero corte seco)
  for (const [sx, sz, label] of [
    [-1280, -2840, 'Costa Boreal Norte'],
    [-3340, -1040, 'Cabo Radar Noroeste'],
    [-2660, 2440, 'Ponta Dunas Sudoeste'],
    [3320, -1420, 'Ponta Leste Tétis']
  ]) {
    assert.ok(getDistanceToCoastAt(sx, sz) < 50, `${label} dentro da faixa costeira arenosa`);
    const yShore = getPangaeaElevationAt(sx, sz);
    assert.ok(yShore >= -0.35 && yShore <= 4.0, `${label} com rampa suave até a água (${yShore})`);
  }

  // Chunks distantes usam origem local (mesh.position != 0) contra Z-fighting/jitter float32
  let localOriginChunkCount = 0;
  world.scene.traverse((n) => {
    if (n.isMesh && Math.hypot(n.position.x, n.position.z) > 1200) {
      localOriginChunkCount++;
    }
  });
  assert.ok(localOriginChunkCount >= 6, `Chunks periféricos usam origem local (${localOriginChunkCount})`);

  // Ponte Boreal sobre o Fjord em Z=-2150 sustenta tráfego seco sobre o canal do rio
  assert.ok(world.getRoadElevation(560, -2150) >= 5.0, 'Ponte Boreal eleva em arco 5.5m');
  assert.equal(world.isDeepWaterAt(560, -2150, { forCar: true }), false, 'Carros atravessam Ponte Boreal');
  assert.equal(world.isDeepWaterAt(560, -2150, { forBoat: true }), true, 'Barcos passam sob Ponte Boreal');

  // Ilhotas do arquipélago devem ser pisáveis
  for (const isl of ARCHIPELAGO_ISLETS) {
    assert.equal(world.isDeepWaterAt(isl.x, isl.z), false, `Ilhota ${isl.id} deve ser terra firme`);
    assert.ok(world.getSurfaceHeightAt(isl.x, isl.z, 2) >= isl.peakY - 0.1, `Ilhota ${isl.id} elevação`);
  }

  // Pontos críticos de água/terra preservados
  assert.equal(world.isDeepWaterAt(220, 1080, { forCar: true }), true, 'Canal aberto Sul preservado');
  assert.equal(world.isDeepWaterAt(0, 1620), true, 'Oceano além do Mega Píer preservado');
  assert.equal(world.isDeepWaterAt(1650, 700), true, 'Canal de atracação do Porto preservado');
  assert.equal(world.isDeepWaterAt(-1380, 1135, false), false, 'Marina Oeste preservada');
  assert.equal(isPointOnOrganicLand(-1735, 945), true, 'Promontório do Farol Sudoeste preservado');

  // Oceano cobre super-horizonte além de ±14000m
  const oceanBox = new THREE.Box3().setFromObject(world.oceanMesh);
  assert.ok(oceanBox.max.x >= 13800 && oceanBox.min.x <= -13800, 'Oceano até ±14500m');
});

test('Limites da Pangeia, spawns em periferias, câmera longe da origem, Minimapa & Mapa [M]', () => {
  resetTestListeners();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1.6, 0.65, 7800);
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);
  const hud = new LegoHud();
  const fig = new Minifigure('caveira');
  scene.add(fig.root);

  const canvas = document.getElementById('test-coast-canvas');
  const ctrl = new ThirdPersonController(camera, canvas, fig, world, dest, hud);

  // Alcança livremente regiões periféricas extremas (Parque Eólico Leste & Vila Sudoeste) sem bloqueio
  ctrl.position.set(2680, 12.0, -1120);
  ctrl.update(0.016);
  assert.ok(ctrl.position.x >= 2650, 'Jogador alcança Parque Eólico no extremo Leste sem parede invisível');

  // Região correta resolvida nas fronteiras expandidas (sem cair em Centro Financeiro!)
  assert.equal(world.getRegionAt(2680, 2, -1120).id, 'industrial_leste');
  assert.equal(world.getRegionAt(-2920, 2, -1285).id, 'aeroporto_oeste');
  assert.equal(world.getRegionAt(-2520, 2, 2020).id, 'praia_sul');
  assert.equal(world.getRegionAt(-1215, 2, -2420).id, 'suburbio_norte');

  // Pedestres e tráfego validam novas áreas secas da Pangeia
  assert.equal(world.livingCity._isValidDryLandForPedestrian(-2460, 2020), true);
  assert.equal(world.livingCity._isValidDryLandForPedestrian(2680, -1120), true);
  assert.equal(world.livingCity._isValidDryLandForPedestrian(2000, 480), false);

  // Limite natural no oceano extremo aplica força de retorno suave
  const edgeForce = getWorldSoftBoundaryForce(4150, 0);
  assert.ok(edgeForce.fx < 0 && edgeForce.intensity > 0, 'Força suave empurra de volta além de 3950m');

  // Renderiza Minimapa e Mapa Tático [M] sem erros
  const region = world.getRegionAt(0, 1, -80);
  assert.doesNotThrow(() => {
    hud.updateMinimap(ctrl.position, 0, 0, region, world, 0, 0.016);
    hud.renderFullMap(world, ctrl.position, 0);
  });

  // Regressão: Praia Sul nivelada em Y ≈ 0.12m (sem colina fantasma da Pangeia nem pedestres voando)
  const sandHeight = world.getTerrainHeightAt(150, 900);
  assert.ok(
    sandHeight >= 0.08 && sandHeight <= 0.2,
    `Areia da Praia Sul nivelada em ~0.12m sem colina fantasma (${sandHeight})`
  );
  const beachPedY = world.livingCity._getPedestrianGroundY(150, 900);
  assert.ok(
    beachPedY >= 0.08 && beachPedY <= 0.2,
    `Banhistas/pedestres na areia pisam direto em ~0.12m sem flutuar (${beachPedY})`
  );

  // Regressão: Continuação real das estruturas nas pontas da Pangeia + Favela CDD estendida ao Norte
  assert.ok(
    world.pangaeaPeripheryData && world.pangaeaPeripheryData.structuresBuilt >= 35,
    `Estruturas periféricas construídas nas pontas da Pangeia (${world.pangaeaPeripheryData?.structuresBuilt})`
  );
  assert.ok(
    world.getTerrainHeightAt(-840, -1550) > 8.0,
    'Morro da Cidade de Deus continua além de Z = -1320 rumo ao Norte'
  );
});
