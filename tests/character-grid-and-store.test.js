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
const { loadAllSaveSlots } = await import('../src/ui/FactionIconsAndSaveSystem.js');

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

describe('Wave 3 — [TAB] LEGO Character Grid, Pause "Personagens" Store & Secret Boss Unlocks', () => {
  it('1. [TAB] Grade de Personagens abre/fecha em toggle (sem segurar), exibe 2 da facção + 16 extras sem preços, navega em 2D e bloqueia trancados', () => {
    world.livingCity.setPlayerFaction('cv', controller, []);
    hud.unlockedExtras = [];
    controller.switchToHero('cv_marretao', true);

    // 1.1 Apertar Tab (keydown) abre e soltar Tab (keyup) NÃO fecha!
    controller._onKey({ code: 'Tab', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.isCharacterGridOpen, true, 'Keydown no Tab deve abrir a Grade de Personagens');
    controller._onKey({ code: 'Tab', repeat: false, preventDefault() {} }, false);
    assert.equal(hud.isCharacterGridOpen, true, 'Soltar Tab NÃO deve fechar a Grade (modo toggle sem segurar)');

    // 1.2 Matriz 2D possui linha 0 = [cv_marretao, cv_fogueteira] e linhas 1..2 = 16 extras (8x2)
    assert.equal(hud._gridNavMatrix.length, 3);
    assert.deepEqual(hud._gridNavMatrix[0], ['cv_marretao', 'cv_fogueteira']);
    assert.equal(hud._gridNavMatrix[1].length + hud._gridNavMatrix[2].length, 16);

    // Verifica que NENHUM card na grade [TAB] mostra valores numéricos de preço em Studs (regra do plano)
    const collectSubtreeText = (node) => {
      if (!node) return '';
      let out = `${node.textContent || ''} ${node.innerHTML || ''}`;
      for (const ch of node.children || []) out += ' ' + collectSubtreeText(ch);
      return out;
    };
    const gridOverlayText = collectSubtreeText(hud.characterGridOverlayEl);
    assert.equal(/\b(250\.000|350\.000|400\.000|1\.000\.000)\b/.test(gridOverlayText), false, 'Grade [TAB] não deve exibir preços em Studs');

    // 1.3 Navegar para a direita (cv_fogueteira) e confirmar com Enter troca para Fogueteira e fecha a grade!
    controller._onKey({ code: 'ArrowRight', repeat: false }, true);
    assert.equal(hud.gridSelectedCharKey, 'cv_fogueteira');
    controller._onKey({ code: 'Enter', repeat: false }, true);
    assert.equal(hud.isCharacterGridOpen, false, 'Confirmar operador desbloqueado fecha a grade');
    assert.equal(minifig.currentHeroKey, 'cv_fogueteira', 'Personagem deve trocar para Fogueteira');

    // 1.4 Reabre a grade, desce para um extra bloqueado e tenta confirmar -> deve recusar sem fechar e sem trocar!
    controller._onKey({ code: 'Tab', repeat: false, preventDefault() {} }, true);
    controller._onKey({ code: 'ArrowDown', repeat: false }, true); // Vai para a linha 1 (extra trancado)
    const lockedTarget = hud.gridSelectedCharKey;
    assert.notEqual(lockedTarget, 'cv_fogueteira');
    controller._onKey({ code: 'Enter', repeat: false }, true);
    assert.equal(hud.isCharacterGridOpen, true, 'Tentar escolher extra trancado NÃO fecha a grade');
    assert.equal(minifig.currentHeroKey, 'cv_fogueteira', 'Tentar escolher extra trancado NÃO troca o personagem');

    // Apertar Tab novamente fecha a grade sem trocar
    controller._onKey({ code: 'Tab', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.isCharacterGridOpen, false);
  });

  it('2. Menu de Pausa › PERSONAGENS: exibe preços, bloqueia quando faltam Studs, compra via ConfirmDialog, salva no slot e equipa', () => {
    world.livingCity.setPlayerFaction('cv', controller, []);
    hud.unlockedExtras = [];
    hud.totalStuds = 150_000;
    hud.displayedStuds = 150_000;
    controller.switchToHero('cv_marretao', true);

    // 2.1 Abre Pausa e confere a lâmina PERSONAGENS
    hud.setPauseMenuOpen(true, controller);
    const heroesBlade = globalThis.document.getElementById('btn-pause-heroes');
    assert.equal(heroesBlade?.textContent, 'PERSONAGENS', 'Lâmina da pausa deve se chamar PERSONAGENS');

    heroesBlade.click();
    assert.equal(hud._resolveActiveMenuScreen(), 'pause-characters', 'Deve abrir a subtela pause-characters');

    // 2.2 Seleciona Solaris (350.000 Studs) tendo apenas 150.000 -> botão desabilitado mostrando que faltam 200.000!
    hud.selectCharacterStoreCard('solaris', false);
    const actionBtn = globalThis.document.getElementById('btn-char-store-action');
    assert.equal(Boolean(actionBtn?.disabled), true, 'Botão de compra deve ficar desabilitado quando faltam Studs');
    assert.ok(
      String(actionBtn?.textContent || '').includes('200.000') || String(actionBtn?.textContent || '').includes('200,000'),
      `Botão desabilitado deve informar os 200.000 Studs faltantes (texto atual: "${actionBtn?.textContent}")`
    );

    // 2.3 Dá 800.000 Studs e compra Solaris (350.000) + Desertor Rival Muralha (400.000) via ConfirmDialog!
    hud.totalStuds = 800_000;
    hud.displayedStuds = 800_000;
    hud._refreshCharacterStoreUI(false);
    hud.selectCharacterStoreCard('solaris', false);

    assert.equal(Boolean(actionBtn?.disabled), false, 'Com Studs suficientes, o botão COMPRAR fica ativo');
    hud.triggerCharacterStorePrimaryAction();
    assert.equal(hud.isConfirmDialogOpen, true, 'Clicar em COMPRAR deve abrir o ConfirmDialog');
    hud.acceptConfirmDialog();
    assert.equal(hud.isConfirmDialogOpen, false);
    assert.equal(hud.totalStuds, 450_000, 'Compra de Solaris desconta 350.000 Studs');
    assert.equal(hud.unlockedExtras.includes('solaris'), true, 'Solaris entra em unlockedExtras');

    // Compra também o desertor rival Muralha (400.000) e confere selo de desertor aliado + persistência no save
    hud.selectCharacterStoreCard('pcc_muralha', false);
    const allegianceMarkup = String(hud.charShowcaseAllegianceEl?.innerHTML || hud.charShowcaseAllegianceEl?.textContent || '');
    assert.ok(allegianceMarkup.includes('SUA FACÇÃO') || allegianceMarkup.includes('DESERTOR'), 'Desertor rival deve avisar que luta pela sua facção');
    hud.triggerCharacterStorePrimaryAction();
    hud.acceptConfirmDialog();
    assert.equal(hud.totalStuds, 50_000, 'Compra do Muralha desconta 400.000 Studs');
    assert.deepEqual(hud.unlockedExtras, ['solaris', 'pcc_muralha']);

    const savedSlot = loadAllSaveSlots()[hud.activeSaveSlot || 0];
    assert.deepEqual(savedSlot.unlockedExtras, ['solaris', 'pcc_muralha'], 'Compra persiste imediatamente no slot de save');

    // Equipa o Muralha desertor e verifica que ele entra em campo mantendo a facção CV aliada e 420 HP!
    hud.triggerCharacterStorePrimaryAction();
    assert.equal(minifig.currentHeroKey, 'pcc_muralha');
    assert.equal(hud.playerFaction, 'cv', 'Desertor comprado mantém sua facção aliada original (CV)');
    assert.equal(world.livingCity.playerMaxHp, 420, 'Muralha aplica seus 420 HP de Tanque Puro');

    hud.setPauseMenuOpen(false, controller);
  });

  it('3. Conquistar território de facção rival desbloqueia automaticamente seu Chefão Secreto jogável (Barão / Mestre / Overlord)', () => {
    world.livingCity.setPlayerFaction('cv', controller, []);
    hud.unlockedExtras = [];

    // Chefão da A.R.E.S. (General Overlord) começa bloqueado e NÃO pode ser comprado com Studs
    hud.totalStuds = 5_000_000;
    hud.setPauseMenuOpen(true, controller);
    hud.openCharacterStoreSubview('boss_ares');
    const actionBtn = globalThis.document.getElementById('btn-char-store-action');
    assert.equal(Boolean(actionBtn?.disabled), true, 'Chefão secreto não pode ser comprado com Studs');
    hud.setPauseMenuOpen(false, controller);

    // Conquista o território da A.R.E.S. -> deve liberar boss_ares automaticamente!
    const aresZone = world.livingCity.factionWar.territories.ares;
    world.livingCity.factionWar._conquerTerritory(aresZone, controller.position);
    assert.equal(hud.unlockedExtras.includes('boss_ares'), true, 'Conquistar A.R.E.S. libera General Overlord (boss_ares)');

    // Agora General Overlord pode ser escolhido direto na Grade [TAB] e vira Big-Fig jogável!
    hud.setCharacterGridOpen(true, controller, false);
    const chosen = hud.confirmCharacterGridSelection('boss_ares');
    assert.equal(chosen, true, 'General Overlord desbloqueado pode ser escolhido na Grade [TAB]');
    assert.equal(minifig.currentHeroKey, 'boss_ares');
    assert.equal(Boolean(minifig.isBigFig), true, 'General Overlord deve montar rig Big-Fig colossal');
  });
});
