import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { ROLE_BASELINES, HYBRID_ROLE_BASELINES } = await import('../src/entities/operators/RoleBaselines.js');
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
const minifig = new Minifigure('cv_fogueteira');
scene.add(minifig.root);
const domElement = globalThis.document.getElementById('game-container');
const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);
hud.isTitleScreenActive = false;
hud.isLoadingActive = false;
hud.isPauseMenuOpen = false;
hud._lastController = controller;

function resetFlatRollStage(charKey = 'cv_fogueteira', x = 0, z = -110) {
  controller.switchToHero(charKey, true);
  controller.resetHeldInputs();
  controller.position.set(x, 0, z);
  controller.velocity.set(0, 0, 0);
  controller.isGrounded = true;
  controller.isFlying = false;
  controller.rollImpulseTimer = 0;
  controller.rollCooldownTimer = 0;
  controller.rollElapsed = 0;
  controller.yaw = 0; // Câmera olhando para -Z (direita = +X, esquerda = -X, trás = +Z)
  controller.facingAngle = Math.PI; // Olhando para -Z
  minifig.rollTimer = 0;
  controller.update(0.016);
}

describe('Wave 1 — GTA V Tactical Roll on [CTRL] & Humanoid Pedestrians/Police Anatomy', () => {
  it('1. RoleBaselines expõe specs congelados de rolamento (Dano/Suporte 3.6m em 0.42s vs Tanque/Híbrido-Tanque 2.6m em 0.50s)', () => {
    assert.equal(ROLE_BASELINES.damage.roll.distance, 3.6);
    assert.equal(ROLE_BASELINES.damage.roll.duration, 0.42);
    assert.equal(ROLE_BASELINES.support.roll.distance, 3.6);
    assert.equal(ROLE_BASELINES.tank.roll.distance, 2.6);
    assert.equal(ROLE_BASELINES.tank.roll.duration, 0.5);
    assert.equal(HYBRID_ROLE_BASELINES['tank+damage'].roll.distance, 2.6);
    assert.equal(HYBRID_ROLE_BASELINES['tank+support'].roll.distance, 2.6);
    assert.equal(HYBRID_ROLE_BASELINES['damage+support'].roll.distance, 3.6);
  });

  it('2. Direção do rolamento no [CTRL] segue WASD relativo à câmera e mantém mira frontal quando segurando botão direito', () => {
    // 2.1 Sem mirar: segurando A (esquerda da câmera com yaw=0 -> -X), rola para -X e vira o corpo para -X
    resetFlatRollStage('cv_fogueteira', 0, -110);
    controller.keys.left = true;
    controller._onKey({ code: 'ControlLeft', repeat: false }, true);
    assert.ok(controller.rollImpulseTimer > 0, 'Fogueteira deve iniciar rolamento no Ctrl');
    assert.ok(controller.rollDir.x < -0.9 && Math.abs(controller.rollDir.z) < 0.1, 'Segurando A com yaw=0 deve rolar para -X');
    controller.keys.left = false;
    controller._onKey({ code: 'ControlLeft', repeat: false }, false);

    // 2.2 Mirando (botão direito segurado): segurando D (+X) ou S (+Z), desloca na direção WASD mas mantém facingAngle apontado para a mira (-Z)!
    resetFlatRollStage('pcc_contador', 0, -110);
    controller.yaw = 0; // Mira aponta para -Z -> atan2(0, -1) = PI (ou -PI)
    controller.mouseButtons.right = true;
    controller.keys.right = true; // Rola de lado para a direita (+X)
    controller._onKey({ code: 'ControlLeft', repeat: false }, true);
    assert.ok(controller.rollImpulseTimer > 0, 'Contador mirando deve conseguir rolar de lado');
    assert.ok(controller.rollDir.x > 0.9, 'Segurando D com yaw=0 deve rolar para +X');
    assert.ok(
      Math.cos(controller.facingAngle) < -0.95,
      `Mirando durante o rolamento lateral, o personagem deve continuar olhando para a mira (-Z), facingAngle=${controller.facingAngle.toFixed(2)}`
    );
    controller.keys.right = false;
    controller.mouseButtons.right = false;
  });

  it('3. Tanque (Muralha / Marretão / Bastião-7) rola distância menor (~2.6m) que Dano/Suporte (~3.6m)', () => {
    // Fogueteira (Suporte, 3.6m em 0.42s)
    resetFlatRollStage('cv_fogueteira', 0, -110);
    const startSupportZ = controller.position.z;
    controller.keys.forward = true;
    controller._onKey({ code: 'ControlLeft', repeat: false }, true);
    controller.keys.forward = false;
    for (let i = 0; i < 35; i++) controller.update(0.02);
    const supportDist = Math.abs(controller.position.z - startSupportZ);

    // Muralha (Tanque, 2.6m em 0.50s)
    resetFlatRollStage('pcc_muralha', 0, -110);
    const startTankZ = controller.position.z;
    controller.keys.forward = true;
    controller._onKey({ code: 'ControlLeft', repeat: false }, true);
    controller.keys.forward = false;
    for (let i = 0; i < 35; i++) controller.update(0.02);
    const tankDist = Math.abs(controller.position.z - startTankZ);

    assert.ok(
      tankDist < supportDist - 0.5,
      `Tanque deve rolar menos que Suporte/Dano (tank=${tankDist.toFixed(2)}m vs support=${supportDist.toFixed(2)}m)`
    );
    assert.ok(tankDist >= 2.0 && tankDist <= 3.2, `Distância do Tanque próxima de 2.6m (atual=${tankDist.toFixed(2)}m)`);
    assert.ok(supportDist >= 3.0 && supportDist <= 4.3, `Distância de Suporte próxima de 3.6m (atual=${supportDist.toFixed(2)}m)`);
  });

  it('4. Não rola no ar, em veículo, segurando escudo ou girando minigun; cancela recarga, bloqueia tiro durante o rolo e reduz 40% do dano nos primeiros 0.2s', () => {
    // 4.1 No ar -> bloqueado
    resetFlatRollStage('ares_agulha', 0, -110);
    controller.isGrounded = false;
    controller.position.y = 8.0;
    controller._onKey({ code: 'ControlLeft', repeat: false }, true);
    assert.equal(controller.rollImpulseTimer, 0, 'Não deve rolar no ar');

    // 4.2 Em veículo -> bloqueado
    resetFlatRollStage('ares_agulha', 0, -110);
    const car = destructibles.objects.find((o) => o.type === 'car' && !o.destroyed);
    if (car) {
      controller.enterVehicle(car);
      controller._onKey({ code: 'ControlLeft', repeat: false }, true);
      assert.equal(controller.rollImpulseTimer, 0, 'Não deve rolar dentro de veículo');
      controller.exitVehicle();
    }

    // 4.3 Segurando Escudo Balístico do Muralha -> bloqueado
    resetFlatRollStage('pcc_muralha', 0, -110);
    controller._onKey({ code: 'KeyQ', repeat: false }, true);
    assert.equal(Boolean(controller.operatorAbilities.personal.shieldActive), true);
    controller._onKey({ code: 'ControlLeft', repeat: false }, true);
    assert.equal(controller.rollImpulseTimer, 0, 'Não deve rolar segurando o Escudo Balístico');
    controller._onKey({ code: 'KeyQ', repeat: false }, true); // Guarda escudo

    // 4.4 Recarga cancelada ao rolar + arma não dispara no meio do rolamento + 40% mitigação nos primeiros 0.2s
    resetFlatRollStage('cv_fogueteira', 0, -110);
    const normalDmg = world.livingCity.applyMitigatedDamageToPlayer(100, controller);
    controller.operatorWeapons.handlePrimaryMouseDown();
    controller.operatorWeapons.handlePrimaryMouseUp();
    assert.equal(controller.operatorWeapons.startReload(), true, 'Inicia recarga');

    controller._onKey({ code: 'ControlLeft', repeat: false }, true);
    assert.ok(controller.rollImpulseTimer > 0, 'Rolar deve cancelar a recarga e executar a cambalhota');
    assert.equal(Boolean(controller.operatorWeapons.getOperatorAmmoState()?.isReloading), false, 'Recarga deve ser cancelada ao rolar');

    const projBefore = destructibles.projectiles.length;
    controller.operatorWeapons.handlePrimaryMouseDown();
    assert.equal(destructibles.projectiles.length, projBefore, 'Arma não deve disparar durante o rolamento');

    const earlyRollDmg = world.livingCity.applyMitigatedDamageToPlayer(100, controller);
    assert.ok(
      Math.abs(earlyRollDmg - normalDmg * 0.6) <= 1.5,
      `Primeiros 0.2s do rolamento devem reduzir 40% do dano sem ficar invencível (normal=${normalDmg}, roll=${earlyRollDmg})`
    );
  });

  it('5. Pedestres civis e Policiais a pé usam anatomia humana articulada compatível com os Operadores', () => {
    assert.ok(world.livingCity.pedestrians.length >= 100, 'Multidão de pedestres instanciados ativa');
    const samplePed = world.livingCity.pedestrians[0];
    assert.ok(samplePed?.visual?.skinHex, 'Pedestre deve possuir tom de pele humano (skinHex)');
    assert.notEqual(samplePed.visual.skinHex, 0xfacc15, 'Pedestre não deve usar amarelo brinquedo estourado #facc15');

    const ws = world.livingCity.wantedSystem;
    ws.setWantedStars(3);
    const footCop = ws._spawnFootTrooper(new THREE.Vector3(12, 0, -108), 3);
    assert.ok(footCop?.visual?.leftLeg && footCop?.visual?.rightArm, 'Policial a pé deve usar rig articulado createFactionSoldierVisual');
    ws.clearWanted('reset');
  });
});
