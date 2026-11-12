import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { HERO_EMOTES } = await import('../src/world/InteractiveAttractionsAndEmotes.js');
const { soundFX } = await import('../src/audio/SoundFX.js');
const { Minifigure } = await import('../src/entities/Minifigure.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 2200);
const hud = new LegoHud();
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
const minifig = new Minifigure('caveira');
scene.add(minifig.root);
const domElement = globalThis.document.getElementById('game-container');
const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);
hud.isTitleScreenActive = false;
hud._lastController = controller;

describe('ATRAÇÕES INTERATIVAS VIVAS (BAILE FUNK CDD + MONTANHA-RUSSA, RODA-GIGANTE & BIG DROP + EMOTES [B])', () => {
  it('1. Baile Funk Vivo na Quadra da CDD (-715, 25, -135): Paredão Pulsante, DJ LEGO, 28 Dançarinos e Áudio Espacial (<75m)', () => {
    const attr = world.attractions;
    assert.ok(attr, 'InteractiveAttractionsManager inicializado em world.attractions');
    assert.equal(attr.baileWoofers.length, 24, '24 cones subwoofer 3D no Paredão');
    assert.equal(attr.baileEqBars.length, 12, '12 barras de LED equalizadoras');
    assert.ok(attr.djRig, 'DJ Minifigura LEGO de fone e óculos escuros no palco');
    assert.equal(attr.baileCrowd.count, 28, '28 moradores civis LEGO dançando na Quadra');

    // Longe do Baile (> 75m, ex.: Centro Financeiro) -> baileFunkMix deve ser 0!
    controller.position.set(0, 0.5, -100);
    for (let i = 0; i < 15; i++) {
      world.update(0.1, controller.position, controller);
    }
    assert.equal(soundFX.baileFunkMix, 0, 'Fora de 75m o Batidão do Baile fica mudo');

    // Perto do Paredão na Quadra do Baile (-718, 25, -135 -> ~3m do centro!) -> crossfade sobe!
    controller.position.set(-718, 25.2, -135);
    for (let i = 0; i < 12; i++) {
      world.update(0.1, controller.position, controller);
    }
    assert.ok(soundFX.baileFunkMix > 0.85, `Dentro da Quadra o Batidão Funk sobe no crossfade (${soundFX.baileFunkMix.toFixed(2)})`);

    // Verifica pulsação real de escala nos alto-falantes do Paredão
    soundFX.baileBeatPulse = 1.0;
    attr.update(0.016, controller.position, controller);
    assert.ok(attr.baileWoofers[0].pivot.scale.y > 1.2, 'Cones do Paredão pulsam em escala no grave');
  });

  it('2. Montanha-Russa Oceânica, Roda-Gigante Colossal (73m nivelada) e Big Drop (58m) embarcáveis com [E]', () => {
    const attr = world.attractions;

    // 2.1 Verifica deck seco do Píer na Estação da Montanha-Russa (-36, 1235) e circuito fechado até 38m sobre o mar!
    assert.equal(world.isDeepWaterAt(-36, 1235, { forCar: true }), false, 'Deck do Píer em X=-36 é seco');
    assert.equal(attr.coasterCurve.closed, true, 'Montanha-Russa é um circuito fechado CatmullRomCurve3');
    assert.equal(attr.coasterCars.length, 3, 'Trem de 3 vagões LEGO');

    let maxCoasterY = 0;
    let minOceanX = 0;
    for (let i = 0; i <= 100; i++) {
      const p = attr.coasterCurve.getPointAt(i / 100);
      if (p.y > maxCoasterY) maxCoasterY = p.y;
      if (p.x < minOceanX) minOceanX = p.x;
    }
    assert.ok(maxCoasterY >= 37.0, `Montanha-Russa sobe a ~38m (pico = ${maxCoasterY.toFixed(1)}m)`);
    assert.ok(minOceanX <= -85.0, `Montanha-Russa avança sobre as ondas do Oceano Atlântico (X = ${minOceanX.toFixed(1)}m)`);

    // Embarca na Montanha-Russa com [E]
    controller.position.set(-31.2, 4.0, 1235);
    controller._updateVehiclePrompt();
    assert.equal(
      globalThis.document.getElementById('vehicle-prompt-text').textContent,
      'ANDAR NA MONTANHA-RUSSA'
    );
    assert.equal(controller.toggleVehicleInteraction(), true);
    assert.equal(controller.activeRide?.type, 'roller_coaster');

    // Libera timer da estação e avança o trem pelos trilhos com o jogador sentado no 1º vagão!
    attr.coasterStopTimer = 0;
    for (let step = 0; step < 25; step++) {
      world.update(0.08, controller.position, controller);
      controller.update(0.08);
    }
    assert.ok(controller.position.y > 8.0, `Jogador subiu na Montanha-Russa junto com o vagão (Y = ${controller.position.y.toFixed(1)}m)`);

    // Desembarca com [E]
    controller.toggleVehicleInteraction();
    assert.equal(controller.activeRide, null);

    // 2.2 Roda-Gigante Colossal (Z = 1480, 16 Cabines sempre na vertical até 73m!)
    assert.equal(attr.ferrisCabins.length, 16, '16 cabines na Roda-Gigante');
    world.update(1.5, controller.position, controller);
    const wheelRot = attr.ferrisWheelGroup.rotation.x;
    assert.ok(Math.abs(wheelRot) > 0.1, 'Roda-Gigante está girando');
    for (const cab of attr.ferrisCabins) {
      assert.ok(
        Math.abs(cab.rotation.x + wheelRot) < 1e-5,
        'Todas as 16 cabines compensam a rotação e ficam 100% na vertical'
      );
    }

    controller.position.set(0, 3.5, 1460);
    controller._updateVehiclePrompt();
    assert.equal(
      globalThis.document.getElementById('vehicle-prompt-text').textContent,
      'ENTRAR NA RODA-GIGANTE'
    );
    controller.toggleVehicleInteraction();
    assert.equal(controller.activeRide?.type, 'ferris_wheel');
    controller.update(0.05);
    controller.toggleVehicleInteraction();
    assert.equal(controller.activeRide, null);

    // 2.3 Torre de Queda Livre "Big Drop" (X = 24, Z = 1325 -> sobe até 58m, suspense 2s e queda livre!)
    controller.position.set(24, 1.8, 1318);
    controller._updateVehiclePrompt();
    assert.equal(
      globalThis.document.getElementById('vehicle-prompt-text').textContent,
      'ENTRAR NO BIG DROP'
    );
    controller.toggleVehicleInteraction();
    assert.equal(controller.activeRide?.type, 'big_drop');

    attr.bigDropState = 'CLIMBING';
    attr.bigDropY = 57.5;
    attr.update(0.2, controller.position, controller);
    assert.equal(attr.bigDropState, 'SUSPENSE', 'Chegou a 58m e entrou nos 2s de suspense');
    assert.equal(attr.bigDropY, 58.0);
    controller.update(0.05);
    assert.ok(controller.position.y > 58.0, 'Jogador está lá no alto dos 58m no Big Drop');

    attr.update(2.1, controller.position, controller); // Termina os 2s de suspense -> FREEFALL!
    assert.equal(attr.bigDropState, 'FREEFALL', 'Iniciou queda livre após 2s de suspense');
    attr.update(0.4, controller.position, controller);
    assert.ok(attr.bigDropY < 52.0, 'Gôndola despencando em queda livre');

    controller.toggleVehicleInteraction();
    assert.equal(controller.activeRide, null);
  });

  it('3. Sistema de Emotes & Danças [Tecla B] em todos os heróis (Titã, Vórtex Monstro e OP-09) + Contágio nos Civis (12m)', () => {
    assert.equal(HERO_EMOTES.length, 4, '4 emotes/danças disponíveis na tecla [B]');

    controller.position.set(0, 0.5, -110);
    controller.isGrounded = true;
    controller.isFlying = false;

    // Testa ciclo completo dos 4 Emotes na tecla [B]
    const seen = [];
    for (let i = 0; i < 4; i++) {
      controller._onKey({ code: 'KeyB', repeat: false, preventDefault() {} }, true);
      seen.push(minifig.activeEmote);
      controller.update(0.1);
    }
    assert.deepEqual(seen, ['passinho', 'breakdance', 'hero_pose', 'air_guitar']);

    // Testa em Titã Blindado, Vórtex em Forma Big-Fig Monstruosa e OP-09!
    for (const hKey of ['tita', 'vortex', 'op09']) {
      controller.switchToHero(hKey);
      if (hKey === 'vortex') {
        minifig.setVortexMonsterForm(true);
      }
      controller.isGrounded = true;
      controller._onKey({ code: 'KeyB', repeat: false, preventDefault() {} }, true);
      assert.ok(minifig.activeEmote, `Emote [B] ativo em ${hKey}`);
      controller.update(0.1);
    }

    // Verifica contágio cômico nos civis num raio de 12m (mesmo sendo o Vórtex Monstro dançando!)
    const nearPed = world.livingCity.pedestrians[0];
    nearPed.panicTimer = 0;
    nearPed.slapstickTimer = 0;
    nearPed.visual.root.position.set(controller.position.x + 4.5, 0.5, controller.position.z + 2.0);
    world.livingCity._updatePedestrians(0.05, controller.position, controller);
    assert.equal(nearPed.state, 'DANCE_ALONG', 'Pedestre a <12m entrou na dança junto com o jogador!');

    // Apertar WASD cancela o emote na hora!
    controller._onKey({ code: 'KeyW', repeat: false, preventDefault() {} }, true);
    assert.equal(minifig.activeEmote, null, 'Mover no WASD cancela o emote imediatamente');
    controller._onKey({ code: 'KeyW', repeat: false, preventDefault() {} }, false);
  });
});

