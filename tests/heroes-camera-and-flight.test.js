import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { Minifigure } = await import('../src/entities/Minifigure.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');

function createFullGameContext() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 450);
  const domEl = globalThis.document.createElement('canvas');
  const hud = new LegoHud(35000);
  const destructibles = new DestructibleManager(scene, hud);
  const world = new TestBlockWorld(scene, destructibles);
  const minifig = new Minifigure('caveira');
  scene.add(minifig.root);

  const controller = new ThirdPersonController(
    camera,
    domEl,
    minifig,
    world,
    destructibles,
    hud
  );
  return { scene, camera, hud, destructibles, world, minifig, controller };
}

test('Câmera Over-the-Shoulder estilo Fortnite deve deslocar o foco para a direita, deixando o personagem à esquerda e o centro livre', () => {
  const { controller } = createFullGameContext();

  // Posiciona boneco em X=0, Z=0 com Yaw=0 (olhando para -Z, portanto a direita da câmera é +X)
  controller.position.set(0, 0, 0);
  controller.yaw = 0;

  for (let i = 0; i < 20; i++) {
    controller.update(0.03);
  }

  assert.ok(
    controller.cameraLookTarget.x > 0.7,
    `Alvo da câmera em X (${controller.cameraLookTarget.x}) deve ficar deslocado para a direita (+X), deixando o boneco à esquerda da tela`
  );
});

test('Objetos de Ouro LEGO devem resistir a tiros comuns e derreter apenas com o Raio Solar Contínuo ou Supernova do Solaris', () => {
  const { destructibles, camera } = createFullGameContext();

  const goldVault = destructibles.objects.find((o) => o.type === 'gold_vault');
  assert.ok(goldVault, 'Deve existir Cofre/Monolito de Ouro LEGO no cenário');
  assert.equal(goldVault.goldOnly, true);

  const initialHp = goldVault.hp;

  // Tiro comum / soco sem energia solar não deve causar dano ao Ouro LEGO
  destructibles.damageObject(goldVault, 30, null, false);
  assert.equal(goldVault.hp, initialHp, 'Tiros comuns não devem danificar objetos de Ouro LEGO');
  assert.equal(goldVault.destroyed, false);

  // Posiciona câmera mirando diretamente no Cofre de Ouro e ativa Raio Solar Contínuo por 1.5s
  camera.position.set(goldVault.basePos.x, goldVault.basePos.y + 1.2, goldVault.basePos.z + 5.0);
  camera.lookAt(goldVault.basePos.x, goldVault.basePos.y + 1.2, goldVault.basePos.z);
  camera.updateMatrixWorld();

  const aimData = destructibles.getAimTargetPoint(camera, 80);
  assert.equal(aimData.hitObj, goldVault, 'Mira central deve detectar o Cofre de Ouro no centro da tela');

  const handOrigin = new THREE.Vector3(goldVault.basePos.x, goldVault.basePos.y + 1.2, goldVault.basePos.z + 3.5);
  for (let i = 0; i < 20; i++) {
    destructibles.updateSolarBeam(true, handOrigin, aimData, 0.08);
  }

  assert.equal(goldVault.destroyed, true, 'Raio Solar Contínuo deve derreter e explodir o Cofre de Ouro LEGO');
});

test('Solaris deve voar até o topo dos prédios, ativar Voo Supersônico de Cometa (Shift) e permitir trocar no meio da queda para o Comandante Caveira cair no Rolamento Tático', () => {
  const { controller, minifig, camera, destructibles } = createFullGameContext();

  // 1. Troca para o Solaris e ativa voo
  controller.switchToHero('solaris');
  assert.equal(minifig.currentHeroKey, 'solaris');

  controller.isFlying = true;
  controller.isGrounded = false;
  controller.keys.jump = true;    // Segurando Espaço para subir
  controller.keys.forward = true; // W
  controller.keys.sprint = true;  // Shift -> Voo Supersônico de Cometa!

  for (let i = 0; i < 40; i++) {
    controller.update(0.04);
  }

  assert.ok(controller.position.y > 15, `Solaris deve subir voando alto (altura atual: ${controller.position.y})`);
  assert.equal(controller.isSupersonic, true, 'Segurar Shift voando deve ativar Voo Supersônico de Cometa');
  assert.equal(minifig.state, 'COMET');
  assert.ok(camera.fov > 65, `FOV da câmera (${camera.fov}) deve abrir dinamicamente no Voo de Cometa`);
  assert.ok(destructibles.fxParticles.length > 0, 'Voo de Cometa deve gerar partículas de rastro de chamas');

  // 2. Troca no meio do ar lá de cima para o Comandante Caveira!
  controller.keys.jump = false;
  controller.keys.sprint = false;
  controller.position.set(0, 22, 4); // No ar acima da avenida asfaltada
  controller.switchToHero('caveira');

  assert.equal(minifig.currentHeroKey, 'caveira');
  assert.equal(controller.isFlying, false, 'Trocar para Caveira no ar deve desativar voo e iniciar queda livre');

  // 3. Simula a queda livre até tocar o asfalto e verifica o Rolamento Tático automático!
  let rolledOnLanding = false;
  for (let i = 0; i < 60; i++) {
    controller.update(0.03);
    if (minifig.state === 'ROLL' || minifig.rollTimer > 0) {
      rolledOnLanding = true;
      break;
    }
  }

  assert.equal(rolledOnLanding, true, 'Comandante Caveira deve cair no asfalto executando o Rolamento Tático automaticamente');

  // 4. Metralha de Fuzil Tático e arremessa Granada Explosiva nos carros da rua!
  controller._firePrimaryAction();
  assert.equal(destructibles.projectiles.length, 1, 'Fuzil Tático deve disparar projétil balístico');

  controller._throwCaveiraGrenade();
  assert.equal(destructibles.grenades.length, 1, 'Comandante Caveira deve lançar Granada Explosiva');
});

test('Voo Cometa do Solaris deve funcionar como avião 3D: olhar para cima sobe e olhar para baixo mergulha', () => {
  const { controller, minifig } = createFullGameContext();

  controller.switchToHero('solaris');
  controller.position.set(0, 30, 0);
  controller.isFlying = true;
  controller.isGrounded = false;
  controller.keys.forward = true;
  controller.keys.sprint = true; // Modo Cometa ativo

  // 1. Olhando para CIMA (pitch = -0.65 rad) -> deve subir como jato
  controller.pitch = -0.65;
  for (let i = 0; i < 15; i++) {
    controller.update(0.03);
  }
  assert.ok(
    controller.velocity.y > 10,
    `No Modo Cometa olhando para cima, Solaris deve subir rapidamente (vy=${controller.velocity.y.toFixed(2)})`
  );
  const climbRotX = minifig.visualRoot.rotation.x;

  // 2. Olhando para BAIXO (pitch = +0.65 rad) -> deve mergulhar como avião!
  controller.pitch = 0.65;
  for (let i = 0; i < 20; i++) {
    controller.update(0.03);
  }
  assert.ok(
    controller.velocity.y < -10,
    `No Modo Cometa olhando para baixo, Solaris deve mergulhar em direção ao chão (vy=${controller.velocity.y.toFixed(2)})`
  );
  assert.ok(
    minifig.visualRoot.rotation.x > climbRotX + 0.5,
    'Corpo do Solaris deve inclinar a cabeça para baixo durante o mergulho'
  );
});

test('Granada do Comandante Caveira deve explodir no impacto com qualquer colisão e impulsionar o boneco para cima estilo Raze (Blast Jump)', () => {
  const { controller, destructibles } = createFullGameContext();

  controller.switchToHero('caveira');
  controller.position.set(0, 0, 0);
  controller.pitch = 0.85; // Olhando para o chão perto do pé
  controller.update(0.02);

  controller.secondaryCooldown = 0;
  controller._throwCaveiraGrenade();
  assert.equal(destructibles.grenades.length, 1, 'Deve criar a granada');

  // Avança alguns frames até a granada bater no chão e explodir no impacto
  for (let i = 0; i < 8; i++) {
    destructibles.update(0.025, controller.position);
    controller.update(0.025);
  }

  assert.equal(
    destructibles.grenades.length,
    0,
    'Granada deve explodir imediatamente ao encostar no chão/colisão'
  );
  assert.ok(
    controller.position.y > 1.8 && controller.velocity.y > 8,
    `Explosão no pé deve jogar o Comandante Caveira para o alto estilo Raze (y=${controller.position.y.toFixed(2)}, vy=${controller.velocity.y.toFixed(2)})`
  );
  assert.ok(
    controller.blastJumpTimer > 0,
    'Deve ativar momentum horizontal aéreo de Blast Jump'
  );
});
