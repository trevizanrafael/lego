import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { Minifigure } = await import('../src/entities/Minifigure.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { getCachedFacadeMaterials } = await import('../src/world/BuildingGenerator.js');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 2200);
const hud = new LegoHud(15000);
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
const atm = world.atmosphere;

const minifig = new Minifigure('caveira');
scene.add(minifig.root);
const domElement = globalThis.document.getElementById('game-container');
const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);
hud.onChangeTimeMode = (m) => atm.setTimeMode(m);

describe('CICLO CINEMATOGRÁFICO DIA / PÔR DO SOL DOURADO / NOITE NEON (60 FPS CRAVADOS)', () => {
  it('1. Regra Crítica de 60 FPS: Zero SpotLights estáticas e exatamente 4 PointLights reais no Pool Dinâmico', () => {
    let pointLightCount = 0;
    let spotLightCount = 0;
    scene.traverse((obj) => {
      if (obj.isPointLight) {
        pointLightCount++;
        assert.equal(obj.castShadow, false, 'PointLight do pool não deve projetar sombra');
        assert.equal(obj.distance, 28, 'PointLight deve ter distance = 28');
      }
      if (obj.isSpotLight) {
        spotLightCount++;
      }
    });

    assert.equal(pointLightCount, 4, 'Deve haver estritamente 4 PointLights reais na cena inteira');
    assert.equal(spotLightCount, 0, 'Proibido criar SpotLights estáticas na cena');
    assert.ok(atm.lampNodes.length >= 180, 'Deve haver centenas de postes/lâmpadas instanciados em 3 Draw Calls');
    assert.equal(atm.starPoints.geometry.attributes.position.count, 1200, 'Campo estelar com 1.200 estrelas');
  });

  it('2. Ciclo Automático (12 min = 24h partindo de 15:30), Amanhecer a Leste e Pôr do Sol Dourado a Oeste atrás da CDD', () => {
    atm.setTimeMode('auto');
    atm.timeHours = 15.5;
    world.update(180.0, controller.position, controller); // +3 min reais = +6h no jogo -> 21:30
    assert.ok(Math.abs(atm.timeHours - 21.5) < 0.05, '12 minutos reais equivalem a 24h completas');

    // Amanhecer (06:15) -> Sol nascendo a Leste (+X atrás do Porto/Rio)
    atm.timeHours = 6.25;
    atm.setTimeMode('auto');
    world.update(0.01, controller.position, controller);
    assert.ok(atm._sunDir.x > 0.85, 'No amanhecer o Sol nasce a Leste (+X)');

    // Dia Solar (12:00) -> Janelas emissivas e cones noturnos 100% apagados
    atm.setTimeMode('day');
    world.update(0.016, controller.position, controller);
    assert.equal(atm.nightFactor, 0);
    assert.equal(atm.coneInstMesh.visible, false, 'Cones volumétricos ocultos de dia');
    assert.equal(atm.pointLightPool[0].intensity, 0, 'Pool de PointLights com intensity=0 de dia');
    hud.updateMinimap(controller.position, 0, 0, world.regions[0], world, 0, 0.016);
    assert.ok(hud.minimapSubEl.textContent.includes('☀ 12:00'), 'Minimapa exibe ☀ 12:00');

    // Pôr do Sol Dourado (17:45) -> Sol gigante laranja-rubro a Oeste (-X atrás do Morro da CDD!)
    atm.setTimeMode('sunset');
    world.update(0.016, controller.position, controller);
    assert.ok(atm._sunDir.x < -0.8, 'No pôr do sol o Sol desce a Oeste (-X atrás do Morro da CDD)');
    assert.ok(atm.sunDiscGroup.scale.x > 1.4, 'Disco Solar ampliado na Golden Hour');
    assert.ok(atm.nightFactor > 0.4 && atm.nightFactor < 0.6, 'Janelas começam a acender gradualmente no pôr do sol');
    hud.updateMinimap(controller.position, 0, 0, world.regions[0], world, 0, 0.016);
    assert.ok(hud.minimapSubEl.textContent.includes('🌅 17:45'), 'Minimapa exibe 🌅 17:45');
  });

  it('3. Noite Azul-Profunda & Luar Prateado + Favela "Presépio Urbano", Arranha-Céus emissiveMap e Faróis de Carros/Metrô', () => {
    atm.setTimeMode('night');
    controller.position.set(-705, 25.0, -135); // Na Quadra do Baile da Cidade de Deus!
    world.update(0.1, controller.position, controller);

    assert.equal(atm.nightFactor, 1.0);
    assert.equal(atm.sunLight.color.getHex(), 0x93c5fd, 'DirectionalLight assume cor azul-prata da Lua Cheia');
    assert.ok(atm.sunLight.intensity >= 0.78, 'Luar nunca fica escuro demais (intensity >= 0.78)');
    assert.ok(atm.hemiLight.intensity >= 0.62, 'HemisphereLight noturna vibrante (>= 0.62)');
    assert.equal(atm.moonGroup.visible, true, 'Lua Cheia LEGO visível');
    assert.equal(atm.starPoints.visible, true, '1.200 Estrelas visíveis');

    // Arranha-céus com emissiveMap real aceso em 1.45
    const facadeMats = getCachedFacadeMaterials();
    assert.ok(facadeMats.length > 0);
    for (const fm of facadeMats) {
      assert.ok(fm.emissiveMap, 'Fachada de arranha-céu possui emissiveMap real');
      assert.ok(Math.abs(fm.emissiveIntensity - 1.45) < 0.02, 'Arranha-céus brilham com emissiveIntensity = 1.45');
    }

    // Favela Cidade de Deus: janelas quentes em 1.6, 4 refletores do Campinho e 3 Skytrackers do Baile acesos!
    for (const wm of world.favelaEmissiveMats.windows) {
      assert.ok(Math.abs(wm.emissiveIntensity - 1.6) < 0.02, 'Janelas da CDD brilham em 1.6');
    }
    assert.equal(world.favelaSoccerFloodCones.length, 4);
    assert.equal(world.favelaSoccerFloodCones[0].mesh.visible, true);
    assert.equal(world.favelaBaileSkytrackers.length, 3);
    assert.equal(world.favelaBaileSkytrackers[0].pivot.visible, true);
    assert.ok(atm.pointLightPool[0].intensity > 2.0, 'PointLight dinâmica ilumina o plástico LEGO perto do jogador');

    // Faróis dos carros do trânsito, trens do Metrô e carro dirigido pelo jogador acesos!
    controller.position.set(0, 0.5, -117);
    const sampleCar = world.livingCity.trafficVehicles[0];
    controller.currentVehicle = sampleCar.destructible;
    world.update(0.05, controller.position, controller);
    assert.equal(sampleCar.mesh.userData._nightLightRig.visible, true, 'Faróis dianteiros do veículo do jogador acesos');
    assert.equal(atm.metroLeadCones[0].visible, true, 'Faróis dianteiros dos trens do Metrô acesos');
    assert.ok(atm._metroGlassMat.emissiveIntensity > 1.0, 'Janelas dos vagões do Metrô acesas à noite');

    hud.updateMinimap(controller.position, 0, 0, world.regions[0], world, 0, 0.016);
    assert.ok(hud.minimapSubEl.textContent.includes('🌙 22:00'), 'Minimapa exibe 🌙 22:00');
  });
});

