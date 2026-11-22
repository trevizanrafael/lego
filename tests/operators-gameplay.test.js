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
const { writeSaveSlot, loadAllSaveSlots } = await import('../src/ui/FactionIconsAndSaveSystem.js');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 2200);
const hud = new LegoHud();
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
const minifig = new Minifigure('cv_marretao');
scene.add(minifig.root);
const domElement = globalThis.document.getElementById('game-container');
const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);
hud.isTitleScreenActive = false;
hud.isLoadingActive = false;
hud.isPauseMenuOpen = false;
hud._lastController = controller;

describe('Wave 2 — Faction Operators Gameplay, Weapons, 12 Q/E Abilities & Key Remapping', () => {
  it('1. [1] e [2] alternam exclusivamente entre a dupla da facção ativa, e [3]–[9] foram removidos', () => {
    world.livingCity.setPlayerFaction('cv', controller, []);
    controller._onKey({ code: 'Digit1', repeat: false }, true);
    assert.equal(minifig.currentHeroKey, 'cv_marretao');
    assert.equal(world.livingCity.playerMaxHp, 380);

    controller._onKey({ code: 'Digit2', repeat: false }, true);
    assert.equal(minifig.currentHeroKey, 'cv_fogueteira');
    assert.equal(world.livingCity.playerMaxHp, 240);

    // Mudar facção para PCC -> [1] Contador (260 HP), [2] Muralha (420 HP)
    world.livingCity.setPlayerFaction('pcc', controller, []);
    controller._onKey({ code: 'Digit1', repeat: false }, true);
    assert.equal(minifig.currentHeroKey, 'pcc_contador');
    assert.equal(world.livingCity.playerMaxHp, 260);

    controller._onKey({ code: 'Digit2', repeat: false }, true);
    assert.equal(minifig.currentHeroKey, 'pcc_muralha');
    assert.equal(world.livingCity.playerMaxHp, 420);

    // Mudar facção para A.R.E.S. -> [1] Bastião-7 (400 HP), [2] Agulha (200 HP)
    world.livingCity.setPlayerFaction('ares', controller, []);
    controller._onKey({ code: 'Digit1', repeat: false }, true);
    assert.equal(minifig.currentHeroKey, 'ares_bastiao');
    assert.equal(world.livingCity.playerMaxHp, 400);

    controller._onKey({ code: 'Digit2', repeat: false }, true);
    assert.equal(minifig.currentHeroKey, 'ares_agulha');
    assert.equal(world.livingCity.playerMaxHp, 200);

    // Teclas 3..9 NÃO trocam mais de personagem
    for (const code of ['Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9']) {
      controller._onKey({ code, repeat: false }, true);
      assert.equal(minifig.currentHeroKey, 'ares_agulha', `${code} não deve trocar de personagem`);
    }
  });

  it('2. [F] entra/sai de veículo para TODOS, [R] recarrega sem rebuildAll, e [G] recebe poderes antigos do F', () => {
    world.livingCity.setPlayerFaction('cv', controller, []);
    controller.switchToHero('cv_marretao', true);

    const car = destructibles.objects.find((o) => o.type === 'car' && !o.destroyed);
    assert.ok(car, 'Deve existir veículo para teste');
    controller.position.set(car.mesh.position.x + 1.6, car.mesh.position.y, car.mesh.position.z);

    // Operador entra e sai com [F]
    controller._onKey({ code: 'KeyF', repeat: false }, true);
    assert.equal(controller.currentVehicle, car, '[F] deve entrar no carro com Operador');
    controller._onKey({ code: 'KeyF', repeat: false }, true);
    assert.equal(controller.currentVehicle, null, '[F] deve sair do carro com Operador');

    // Titã Blindado também entra com [F] (não sequestra mais o F) e agarra carro com [G]
    controller.switchToHero('tita', true);
    controller.position.set(car.mesh.position.x + 1.6, car.mesh.position.y, car.mesh.position.z);
    controller._onKey({ code: 'KeyF', repeat: false }, true);
    assert.equal(controller.currentVehicle, car, '[F] deve entrar no carro até mesmo com Titã Blindado');
    controller._onKey({ code: 'KeyF', repeat: false }, true);
    assert.equal(controller.currentVehicle, null);

    controller._onKey({ code: 'KeyG', repeat: false }, true);
    assert.equal(controller.grabbedCar, car, '[G] deve agarrar carro com Titã Blindado');
    controller._releaseGrabbedCarOnGround();

    // Vórtex alterna forma monstruosa com [G] ou [E], enquanto [F] fica livre para veículo
    controller.switchToHero('vortex', true);
    assert.equal(Boolean(minifig.isVortexMonster), false);
    controller._onKey({ code: 'KeyG', repeat: false }, true);
    assert.equal(Boolean(minifig.isVortexMonster), true, '[G] alterna forma Big-Fig do Vórtex');
    controller._onKey({ code: 'KeyG', repeat: false }, true);
    assert.equal(Boolean(minifig.isVortexMonster), false);

    // [R] não reconstrói objetos quebrados do mundo (atalho de debug removido!)
    const streetProp = destructibles.objects.find((o) => o.isStreetProp && !o.destroyed);
    destructibles.damageObject(streetProp, 9999, streetProp.basePos);
    assert.equal(streetProp.destroyed, true);

    controller.switchToHero('cv_marretao', true);
    controller.operatorWeapons.handlePrimaryMouseDown();
    controller.operatorWeapons.handlePrimaryMouseUp();
    controller._onKey({ code: 'KeyR', repeat: false }, true);
    assert.equal(streetProp.destroyed, true, '[R] NUNCA deve chamar destructibles.rebuildAll()');
  });

  it('3. Os 4 modos de disparo das 6 armas de Operador (auto, semi, spinup_auto 0.6s, charge) + recarga e mira ADS', () => {
    controller.position.set(0, 0.5, -110);
    controller.isGrounded = true;

    // A) AUTO: Marretão LMG dispara continuamente enquanto segura LMB e reduz velocidade ao atirar
    controller.switchToHero('cv_marretao', true);
    const beforeAuto = destructibles.projectiles.length;
    controller.mouseButtons.left = true;
    controller.operatorWeapons.handlePrimaryMouseDown();
    for (let i = 0; i < 6; i++) controller.update(0.05);
    controller.mouseButtons.left = false;
    controller.operatorWeapons.handlePrimaryMouseUp();
    assert.ok(destructibles.projectiles.length >= beforeAuto + 3, 'LMG automática deve disparar múltiplos tiros segurando LMB');

    // B) SEMI: Fogueteira Pistola e Muralha Escopeta 12 exigem novo clique por disparo
    controller.switchToHero('cv_fogueteira', true);
    const beforeSemi = destructibles.projectiles.length;
    controller.mouseButtons.left = true;
    controller.operatorWeapons.handlePrimaryMouseDown();
    for (let i = 0; i < 10; i++) controller.update(0.05); // Segurando o botão sem soltar
    assert.equal(destructibles.projectiles.length, beforeSemi + 1, 'Pistola semiautomática só dispara 1 tiro por clique');
    controller.mouseButtons.left = false;
    controller.operatorWeapons.handlePrimaryMouseUp();

    controller.switchToHero('pcc_muralha', true);
    const beforeBuckshot = destructibles.projectiles.length;
    controller.operatorWeapons.handlePrimaryMouseDown();
    controller.operatorWeapons.handlePrimaryMouseUp();
    assert.equal(destructibles.projectiles.length - beforeBuckshot, 8, 'Escopeta 12 do Muralha dispara 8 bagos por cartucho');

    // C) SPINUP_AUTO: Bastião-7 precisa girar o cano por 0.6s antes do 1º tiro sair!
    controller.switchToHero('ares_bastiao', true);
    const beforeSpinup = destructibles.projectiles.length;
    controller.mouseButtons.left = true;
    controller.operatorWeapons.handlePrimaryMouseDown();
    controller.update(0.35); // Ainda < 0.6s!
    assert.equal(destructibles.projectiles.length, beforeSpinup, 'Minigun de Pulso NÃO dispara antes de 0.6s de spinup');
    controller.update(0.35); // Total 0.70s >= 0.6s!
    assert.ok(destructibles.projectiles.length > beforeSpinup, 'Minigun de Pulso dispara após completar 0.6s de spinup');
    controller.mouseButtons.left = false;
    controller.operatorWeapons.handlePrimaryMouseUp();

    // D) CHARGE + ADS FOV: Agulha carrega segurando LMB e dispara ao soltar; Clique Direito dá zoom FOV (36°)
    controller.switchToHero('ares_agulha', true);
    controller.mouseButtons.right = true;
    for (let i = 0; i < 20; i++) controller.update(0.05);
    assert.ok(camera.fov < 45, `Clique direito com Agulha deve aproximar o FOV de mira (~36°, atual=${camera.fov.toFixed(1)}°)`);
    controller.mouseButtons.right = false;

    const beforeCharge = destructibles.projectiles.length;
    controller.mouseButtons.left = true;
    controller.operatorWeapons.handlePrimaryMouseDown();
    controller.update(0.9); // Carga máxima (0.85s)
    assert.equal(destructibles.projectiles.length, beforeCharge, 'Rifle de Carga aguarda soltar o gatilho para disparar');
    controller.mouseButtons.left = false;
    controller.operatorWeapons.handlePrimaryMouseUp();
    assert.ok(destructibles.projectiles.length > beforeCharge, 'Rifle de Carga dispara feixe/projétil ao soltar LMB');
  });

  it('4. As 12 Habilidades [Q] e [E]: Barricada, RPG, Kit/Caixa/Drone curando jogador + aliados, C4 2 toques, Escudo, Domo, Camo quebrando ao atirar e EMP', () => {
    world.livingCity.setPlayerFaction('cv', controller, []);
    controller.position.set(10, 0.5, -110);
    controller.facingAngle = 0;

    // 4.1 CV Marretão: [Q] Barricada física + [E] Bazuca RPG
    controller.switchToHero('cv_marretao', true);
    const colsBefore = world.colliders.filter((c) => !c.disabled).length;
    controller._onKey({ code: 'KeyQ', repeat: false }, true);
    const colsAfter = world.colliders.filter((c) => !c.disabled).length;
    assert.ok(colsAfter > colsBefore, 'Barricada [Q] do Marretão deve registrar colisor físico real');

    const projBeforeRpg = destructibles.projectiles.length;
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(destructibles.projectiles.length > projBeforeRpg, 'Bazuca RPG [E] do Marretão deve disparar foguete');

    // 4.2 CV Fogueteira: [Q] Kit de Socorro cura jogador E soldados aliados + [E] Fogos de Alerta
    controller.switchToHero('cv_fogueteira', true);
    world.livingCity.playerHp = 120;
    const mockAlly = {
      isAllied: true,
      faction: 'cv',
      visual: { root: { position: new THREE.Vector3(11, 0.5, -109) } },
      destructible: { destroyed: false, hp: 40, maxHp: 100, basePos: new THREE.Vector3(11, 0.5, -109) }
    };
    world.livingCity.factionWar.combatNpcs.push(mockAlly);
    controller._onKey({ code: 'KeyQ', repeat: false }, true);
    for (let i = 0; i < 6; i++) controller.update(0.3);
    assert.ok(world.livingCity.playerHp > 120, 'Kit de Socorro da Fogueteira deve curar o jogador');
    assert.ok(mockAlly.destructible.hp > 40, 'Kit de Socorro da Fogueteira deve curar soldados aliados próximos');
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    world.livingCity.factionWar.combatNpcs.pop();

    // 4.3 PCC Contador: [Q] Caixa de Suprimento reabastece munição + [E] C4 Remota (1º planta, 2º detona!)
    world.livingCity.setPlayerFaction('pcc', controller, []);
    controller.switchToHero('pcc_contador', true);
    controller.operatorWeapons.handlePrimaryMouseDown();
    controller.operatorWeapons.handlePrimaryMouseUp();
    controller._onKey({ code: 'KeyQ', repeat: false }, true);
    controller.update(0.2);

    const explosionsBeforeC4 = destructibles.explosions.length;
    controller._onKey({ code: 'KeyE', repeat: false }, true); // 1º toque: planta C4
    assert.equal(destructibles.explosions.length, explosionsBeforeC4, '1º toque no [E] apenas planta a C4 sem explodir');
    controller._onKey({ code: 'KeyE', repeat: false }, true); // 2º toque: detona C4!
    assert.ok(destructibles.explosions.length > explosionsBeforeC4, '2º toque no [E] detona a C4 Remota');

    // 4.4 PCC Muralha: [Q] Escudo Balístico reduz dano recebido + [E] Investida
    controller.switchToHero('pcc_muralha', true);
    const baseMitigated = world.livingCity.applyMitigatedDamageToPlayer(100, controller);
    controller._onKey({ code: 'KeyQ', repeat: false }, true);
    controller.update(0.1);
    const shieldMitigated = world.livingCity.applyMitigatedDamageToPlayer(100, controller);
    assert.ok(shieldMitigated < baseMitigated, `Escudo Balístico deve mitigar muito mais dano (${shieldMitigated} < ${baseMitigated})`);
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    controller.update(0.1);
    assert.ok(Math.hypot(controller.velocity.x, controller.velocity.z) > 15, 'Investida [E] do Muralha deve impulsionar para frente');
    for (let i = 0; i < 6; i++) controller.update(0.12);

    // 4.5 A.R.E.S. Bastião-7: [Q] Domo de Energia bloqueia projéteis externos + [E] Drone Médico acompanha e cura
    world.livingCity.setPlayerFaction('ares', controller, []);
    controller.switchToHero('ares_bastiao', true);
    controller._onKey({ code: 'KeyQ', repeat: false }, true);
    controller.update(0.1);
    const outsideOrigin = new THREE.Vector3(controller.position.x + 15, 1.2, controller.position.z);
    const domeEdgeHit = new THREE.Vector3(controller.position.x + 2.0, 1.2, controller.position.z);
    assert.equal(
      controller.operatorAbilities.isProjectileBlocked(domeEdgeHit, outsideOrigin),
      true,
      'Domo de Energia do Bastião-7 deve interceptar projéteis vindos de fora'
    );

    world.livingCity.playerHp = 220;
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    for (let i = 0; i < 6; i++) controller.update(0.3);
    assert.ok(world.livingCity.playerHp > 220, 'Drone Médico [E] do Bastião-7 deve curar ao acompanhar o operador');

    // 4.6 A.R.E.S. Agulha: [Q] Camuflagem Óptica quebra imediatamente ao atirar + [E] Granada EMP atordoa NPCs
    controller.switchToHero('ares_agulha', true);
    controller._onKey({ code: 'KeyQ', repeat: false }, true);
    assert.equal(controller.operatorAbilities.isStealthed(), true, 'Camuflagem Óptica [Q] da Agulha deve ativar');

    // Disparar Rifle de Carga (pressionar e soltar LMB) deve quebrar a camuflagem na hora!
    controller.operatorWeapons.handlePrimaryMouseDown();
    controller.update(0.2);
    controller.operatorWeapons.handlePrimaryMouseUp();
    assert.equal(controller.operatorAbilities.isStealthed(), false, 'Atirar deve quebrar imediatamente a Camuflagem Óptica');

    const enemyPos = new THREE.Vector3(controller.position.x, 0.5, controller.position.z - 6);
    const enemyNpc = {
      isAllied: false,
      faction: 'cv',
      stunTimer: 0,
      visual: { root: { position: enemyPos } },
      destructible: {
        destroyed: false,
        isCombatNpc: true,
        hp: 120,
        maxHp: 120,
        height: 2.0,
        radius: 0.7,
        debrisColors: [0xdc2626, 0x1e293b],
        colliders: [],
        mesh: new THREE.Group(),
        basePos: enemyPos.clone()
      }
    };
    world.livingCity.factionWar.combatNpcs.push(enemyNpc);
    controller.yaw = 0; // Olhando para -Z
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    for (let i = 0; i < 6; i++) controller.update(0.15);
    assert.ok(enemyNpc.stunTimer > 0, 'Granada de Pulso EMP [E] da Agulha deve atordoar NPCs inimigos na área');
    world.livingCity.factionWar.combatNpcs.pop();

    controller.operatorAbilities.disposeAllDeployables();
  });

  it('5. Persistência de Save Slot salva operatorKey + unlockedExtras e migra saves legados para o híbrido da facção', () => {
    const saved = writeSaveSlot(0, {
      faction: 'pcc',
      studs: 520000,
      operatorKey: 'pcc_muralha',
      unlockedExtras: ['solaris', 'op09']
    });
    assert.equal(saved.operatorKey, 'pcc_muralha');
    assert.deepEqual(saved.unlockedExtras, ['solaris', 'op09']);

    const slots = loadAllSaveSlots();
    assert.equal(slots[0].operatorKey, 'pcc_muralha');
    assert.deepEqual(slots[0].unlockedExtras, ['solaris', 'op09']);
  });
});
