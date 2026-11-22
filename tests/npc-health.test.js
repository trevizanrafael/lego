import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { HUMANOID_STATES } = await import('../src/world/npc-health/HumanoidHealthModel.js');
const { GraphicsPipeline, GOTHAM_NOIR_SHADER } = await import('../src/graphics/GraphicsPipeline.js');
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
const pipeline = new GraphicsPipeline(null, scene, camera, world, 'medium');
hud.onTriggerKillFlash = () => pipeline.pulseKillFlash();
hud.onChangeKillEffect = (enabled) => pipeline.setKillEffectEnabled(enabled);
hud.isTitleScreenActive = false;
hud.isLoadingActive = false;
hud.isPauseMenuOpen = false;
hud._lastController = controller;

describe('Wave 2 — Humanoid Health (ALIVE/STAGGER/DOWNED/DEAD), GTA Blood, Corpses, Kill Flash & PCC Sniper Scope', () => {
  it('1. Civil (100 HP): 1º tiro de pistola dá STAGGER, 2º em <1.5s derruba DOWNED (levanta e corre normal em pânico), e 3º tiro mata com sangue + poça sem virar estilhaços LEGO', () => {
    const lc = world.livingCity;
    lc.wantedSystem.clearWanted('reset');
    const ped = lc.pedestrians[0];
    assert.equal(ped.destructible.maxHp, 100, 'Civil deve ter 100 de vida');
    assert.equal(ped.destructible.humanoidHealth.state, HUMANOID_STATES.ALIVE);

    const studsBefore = destructibles.studsList.length;
    const debrisBefore = destructibles.debrisList.length;
    const hitFrom = ped.visual.root.position.clone().add(new THREE.Vector3(0, 1, 2));

    // Pistola da Fogueteira (15 * 0.55 = 8.25 raw damage)
    // Tiro 1 -> STAGGER (sem dropar studs)
    destructibles.damageObject(ped.destructible, 8.25, hitFrom, false, { sourceIsPlayer: true });
    assert.equal(ped.destructible.humanoidHealth.state, HUMANOID_STATES.STAGGER, '1º tiro de pistola deve causar STAGGER');
    assert.equal(destructibles.studsList.length, studsBefore, 'Não deve dropar studs em tiro não-letal');

    // Tiro 2 (< 1.5s) -> DOWNED no chão!
    destructibles.damageObject(ped.destructible, 8.25, hitFrom, false, { sourceIsPlayer: true });
    assert.equal(ped.destructible.humanoidHealth.state, HUMANOID_STATES.DOWNED, '2º tiro em menos de 1.5s deve derrubar (DOWNED)');

    // Simula recuperação de DOWNED (1.2s no chão + 0.35s levantando) -> volta a ALIVE correndo normal em pânico!
    for (let i = 0; i < 20; i++) lc.update(0.1, controller.position, controller);
    assert.equal(ped.destructible.humanoidHealth.state, HUMANOID_STATES.ALIVE, 'Civil derrubado deve conseguir se levantar se não levar o 3º tiro');
    assert.equal(ped.state, 'PANIC', 'Após levantar, civil deve correr normalmente em pânico');

    // Tiro 3 -> MORTE (DEAD), corpo cai, forma poça de sangue e dropa studs sem virar estilhaço de LEGO!
    destructibles.damageObject(ped.destructible, 8.25, hitFrom, false, { sourceIsPlayer: true });
    assert.equal(ped.destructible.humanoidHealth.state, HUMANOID_STATES.DEAD, '3º tiro de pistola deve matar o civil');
    assert.equal(destructibles.debrisList.length, debrisBefore, 'NPC humanoide morto NUNCA deve virar estilhaço de LEGO');
    assert.ok(destructibles.studsList.length > studsBefore, 'Studs devem cair somente ao morrer');
    assert.ok(lc.corpseManager.corpses.length >= 1, 'Corpo deve ser registrado no HumanoidCorpseManager');
  });

  it('2. Fuzil/LMG mata civil em 2 tiros e Escopeta de perto em 1 tiro; Limite máximo de 12 corpos simultâneos e expiração em 20s', () => {
    const lc = world.livingCity;

    // LMG (14 raw): 1º tiro >= 35% -> DOWNED; 2º tiro -> DEAD!
    const pedRifle = lc.pedestrians[1];
    const origin = pedRifle.visual.root.position.clone().add(new THREE.Vector3(1, 1, 0));
    destructibles.damageObject(pedRifle.destructible, 14, origin, false, { sourceIsPlayer: true });
    assert.equal(pedRifle.destructible.humanoidHealth.state, HUMANOID_STATES.DOWNED, '1º tiro de fuzil/LMG derruba o civil');
    destructibles.damageObject(pedRifle.destructible, 14, origin, false, { sourceIsPlayer: true });
    assert.equal(pedRifle.destructible.humanoidHealth.state, HUMANOID_STATES.DEAD, '2º tiro de fuzil/LMG mata o civil');

    // Escopeta de perto (42 burst / 8 bagos): 1 disparo mata na hora!
    const pedShotgun = lc.pedestrians[2];
    destructibles.damageObject(pedShotgun.destructible, 42, origin, false, {
      sourceIsPlayer: true,
      isCloseShotgun: true
    });
    assert.equal(pedShotgun.destructible.humanoidHealth.state, HUMANOID_STATES.DEAD, '1 tiro de escopeta de perto mata o civil');

    // Mata mais 12 civis (total > 12) para validar o teto estrito de 12 corpos simultâneos!
    for (let idx = 3; idx < 16; idx++) {
      const p = lc.pedestrians[idx];
      destructibles.damageObject(p.destructible, 999, origin, false, { sourceIsPlayer: true });
    }
    assert.equal(lc.corpseManager.corpses.length, 12, 'Máximo estrito de 12 corpos simultâneos no chão (o mais antigo some primeiro)');

    // Avança 20.5s -> todos os corpos expiram e os civis voltam vivos ao pool fora da visão!
    controller.position.set(0, 0, -110);
    for (let step = 0; step < 42; step++) {
      lc.corpseManager.update(0.5, controller.position, controller);
    }
    assert.equal(lc.corpseManager.corpses.length, 0, 'Corpos devem sumir após ~20s');
    assert.equal(pedRifle.destructible.humanoidHealth.state, HUMANOID_STATES.ALIVE, 'Civil reciclado volta vivo com 100 HP');
    assert.equal(pedRifle.destructible.hp, 100);
  });

  it('3. Kill do jogador aciona uKillFlash + Hitmarker Vermelho (sem acumular), e Kill entre facções NÃO aciona flash; matar civil sobe Procurado', () => {
    assert.ok(GOTHAM_NOIR_SHADER.uniforms.uKillFlash, 'Shader Gotham Noir deve expor uniform uKillFlash');
    const lc = world.livingCity;
    lc.wantedSystem.clearWanted('reset');
    hud.settings.killEffect = true;
    pipeline.setKillEffectEnabled(true);

    const flashCountBefore = pipeline.killFlashCount;
    const pedTarget = lc.pedestrians[20];

    // Kill causado pelo jogador -> aciona flash de kill + hitmarker vermelho + 1★ de procurado!
    destructibles.damageObject(pedTarget.destructible, 999, controller.position, false, { sourceIsPlayer: true });
    assert.equal(pipeline.killFlashCount, flashCountBefore + 1, 'Kill do jogador deve disparar pulseKillFlash()');
    assert.equal(pipeline.killFlashIntensity, 1.0, 'Intensidade do flash inicia em 1.0');
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-kill'), true, 'Hitmarker fica vermelho no kill');
    assert.ok(lc.wantedSystem.stars >= 1, 'Matar civil deve ser crime grave e acionar estrelas de procurado estilo GTA');

    // Múltiplos kills seguidos reiniciam o flash em 1.0 (sem somar acima de 1.0!) e decaem em ~0.18s
    pipeline.render(0.08);
    assert.ok(pipeline.killFlashIntensity < 1.0 && pipeline.killFlashIntensity > 0);
    pipeline.pulseKillFlash();
    assert.equal(pipeline.killFlashIntensity, 1.0, 'Kills em sequência reiniciam em 1.0 sem somar');
    pipeline.render(0.20);
    assert.equal(pipeline.killFlashIntensity, 0, 'Flash decai a 0 após 0.18s');

    // Kill causado por NPC de facção rival (fromEnemyNpc: true) -> NÃO dispara flash nem hitmarker nem procurado!
    lc.wantedSystem.clearWanted('reset');
    const flashBeforeNpcKill = pipeline.killFlashCount;
    const npcVictim = lc.pedestrians[21];
    destructibles.damageObject(npcVictim.destructible, 999, controller.position, false, {
      fromEnemyNpc: true,
      sourceIsPlayer: false
    });
    assert.equal(pipeline.killFlashCount, flashBeforeNpcKill, 'Morte causada por NPC NÃO deve disparar flash de kill');
    assert.equal(lc.wantedSystem.stars, 0, 'Morte causada por NPC NÃO deve dar procurado ao jogador');
  });

  it('4. Luneta Sniper Minimalista (1.0X a 10.0X no Scroll) + Bala Supersônica 520 m/s sem Tunneling + Ferrolho Vai-e-Vem', () => {
    world.livingCity.setPlayerFaction('pcc', controller, []);
    controller.switchToHero('pcc_contador', true);
    controller.position.set(0, 0, -110);
    controller.isGrounded = true;
    controller.rollImpulseTimer = 0;

    const initialDist = controller.targetDistance;

    // Segura botão direito -> entra na luneta minimalista (4.0X inicial)!
    controller.mouseButtons.right = true;
    for (let i = 0; i < 20; i++) controller.update(0.04);

    assert.equal(controller.operatorWeapons.isScopedIn, true, 'Contador segurando botão direito deve ativar luneta Sniper');
    assert.equal(minifig.visualRoot.visible, false, 'Modelo 3D do Contador fica oculto em 1ª pessoa dentro da lente');
    assert.equal(hud.sniperScopeOverlayEl?.classList?.contains('hidden'), false, 'Overlay #sniper-scope-overlay deve ficar visível');
    assert.equal(hud.sniperScopeZoomEl?.textContent, '4.0X', 'Zoom inicial deve ser 4.0X');
    assert.ok(camera.fov <= 22, `FOV da câmera deve aproximar em 4.0X (atual=${camera.fov.toFixed(1)}°)`);

    // Scroll para baixo até 1.0X (sem mexer na distância 3ª pessoa!)
    for (let i = 0; i < 12; i++) controller.operatorWeapons.handleScopeWheel(100);
    for (let i = 0; i < 18; i++) controller.update(0.04);
    assert.equal(controller.operatorWeapons.scopeZoom, 1.0, 'Scroll para baixo deve descer até 1.0X');
    assert.equal(hud.sniperScopeZoomEl?.textContent, '1.0X');
    assert.ok(camera.fov >= 52, `Em 1.0X o FOV deve abrir para ~58° (atual=${camera.fov.toFixed(1)}°)`);

    // Scroll para cima até 100.0X (passos progressivos: 0.5X -> 1.0X -> 2.5X -> 10.0X)!
    for (let i = 0; i < 32; i++) controller.operatorWeapons.handleScopeWheel(-100);
    for (let i = 0; i < 30; i++) controller.update(0.04);
    assert.equal(controller.operatorWeapons.scopeZoom, 100.0, 'Scroll para cima deve ir até 100.0X');
    assert.equal(hud.sniperScopeZoomEl?.textContent, '100.0X');
    assert.ok(camera.fov <= 1.0, `Em 100.0X o FOV deve fechar para ~0.64° (atual=${camera.fov.toFixed(3)}°)`);
    assert.equal(controller.targetDistance, initialDist, 'Scroll dentro da luneta não deve alterar targetDistance 3ª pessoa');

    // Disparo supersônico (520 m/s) acerta alvo fino sem tunneling mesmo num passo de 60 FPS (dt = 0.016s -> ~8.3m/frame)
    const sniperVictim = world.livingCity.pedestrians[30];
    sniperVictim.visual.root.position.set(0, 0, -145);
    sniperVictim.destructible.basePos.set(0, 0, -145);
    sniperVictim.destructible.hp = 100;
    sniperVictim.destructible.destroyed = false;
    controller.yaw = 0;
    controller.pitch = 0;
    controller.update(0.016);

    controller.operatorWeapons.handlePrimaryMouseDown();
    controller.operatorWeapons.handlePrimaryMouseUp();
    const dmrProj = destructibles.projectiles[destructibles.projectiles.length - 1];
    assert.ok(dmrProj && dmrProj.vel.length() >= 500, 'Projétil da Sniper deve ser supersônico (>= 500 m/s)');
    for (let f = 0; f < 8; f++) destructibles._updateProjectiles(0.016);
    assert.ok(sniperVictim.destructible.hp < 100, 'Bala supersônica deve colidir por varredura contínua sem atravessar o pedestre');

    // Soltar botão direito restaura imediatamente o modelo 3D e fecha a luneta!
    controller.mouseButtons.right = false;
    controller.update(0.04);
    assert.equal(controller.operatorWeapons.isScopedIn, false, 'Soltar botão direito sai da luneta');
    assert.equal(minifig.visualRoot.visible, true, 'Modelo 3D do Contador volta a ficar visível imediatamente');
  });
});
