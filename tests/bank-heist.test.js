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
const { BANK_HEIST_RULES, BANK_LAYOUT } = await import('../src/world/events/BankHeistEvent.js');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 2200);
const hud = new LegoHud(10000);
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
const livingCity = world.livingCity;
const minifig = new Minifigure('caveira');
scene.add(minifig.root);
const controller = new ThirdPersonController(
  camera,
  globalThis.document.getElementById('game-container'),
  minifig,
  world,
  destructibles,
  hud
);
hud.onSelectFaction = (factionKey, conquered) => livingCity.setPlayerFaction(factionKey, controller, conquered);
const fw = livingCity.factionWar;
const heist = fw.bankHeist;
const FAR = new THREE.Vector3(0, 0.5, 240); // Parque Central (longe do banco)
const DOOR = new THREE.Vector3(0, 0.5, -126);

function step(dt = 0.5) {
  livingCity.playerHp = livingCity.playerMaxHp;
  livingCity.update(dt, controller.position, controller);
}
const killWhere = (pred) => {
  for (const npc of [...livingCity.combatNpcs]) {
    if (pred(npc) && npc.destructible && !npc.destructible.destroyed) {
      destructibles.damageObject(npc.destructible, 1e12, controller.position, false, { fromEnemyNpc: true });
    }
  }
};
const vaultDoor = () => destructibles.objects.find((o) => o.type === 'bank_vault_door');

describe('🏦 MEGA ASSALTO AO SUPER BANCO CENTRAL', () => {
  it('1. Alarme: facção rival assalta, painel e marcador no mapa; sem você lá eles levam o ouro', () => {
    hud.setPlayerFaction('cv', true);
    controller.position.copy(FAR);
    assert.ok(fw.debugBankHeist());
    assert.equal(heist.state, 'ALARM');
    assert.equal(heist.robberFaction, 'pcc', 'Jogador CV -> quem assalta é o PCC');
    assert.equal(fw.objectiveHud.visible, true);
    assert.ok(fw.activeWarzones.some((w) => w.outpostId === 'bank_heist'));
    assert.equal(livingCity.combatNpcs.length, 0, 'Longe do banco: nenhuma tropa nasce');

    for (let t = 0; t < BANK_HEIST_RULES.c4Time + 2; t += 1) step(1);
    assert.equal(heist.state, 'ESCAPE', 'C4 completou sozinho: cofre explodiu');
    assert.equal(vaultDoor().destroyed, true, 'Porta do cofre destruída');
    for (let t = 0; t < 25; t += 1) step(1);
    assert.equal(heist.state, 'IDLE', 'Assalto terminou');
    assert.ok(heist.timer >= BANK_HEIST_RULES.cooldownMin, 'Cooldown até o próximo assalto');
    assert.equal(fw.objectiveHud.visible, false);
    destructibles._restoreObject(vaultDoor());
  });

  it('2. Você chega: tropas, reféns e BOPE aparecem; matar o técnico pausa o C4; limpar tudo traz o chefe', () => {
    hud.goldenBricks = 0;
    const prisonBefore = world.prisonIslandData?.prisonersInCellsCount ?? 0;
    fw.debugBankHeist();
    controller.position.copy(DOOR);
    step(0.1);
    assert.equal(fw.activeMode, 'BANK_HEIST');
    const robbers = livingCity.combatNpcs.filter((n) => !n.isAllied);
    const bope = livingCity.combatNpcs.filter((n) => n.isAllied);
    assert.ok(robbers.length >= 10, 'Assaltantes na fachada e no saguão');
    assert.ok(robbers.every((n) => n.faction === 'pcc'));
    assert.ok(bope.length >= 4 && bope.every((n) => n.faction === 'bope'), 'BOPE chega como aliado');
    assert.equal(heist.hostages.length, 6, 'Reféns no saguão');

    // Libertar refém encostando nele
    const h = heist.hostages[0];
    controller.position.set(h.x, 0.5, h.z);
    step(0.1);
    assert.equal(h.freed, true, 'Refém libertado');

    // Técnico no cofre faz o C4 subir; derrubado, a barra para
    const tech = heist.techUnit;
    tech.visual.root.position.set(BANK_LAYOUT.vaultDoor.x, tech.visual.root.position.y, BANK_LAYOUT.vaultDoor.z + 2.4);
    tech.destructible.hp = 1e9;
    step(0.5);
    step(0.5);
    const c4 = heist.c4Progress;
    assert.ok(c4 > 0, 'C4 subindo com o técnico no cofre');
    destructibles.damageObject(tech.destructible, 1e12, controller.position, false, { fromEnemyNpc: true });
    step(0.5);
    step(0.5);
    assert.ok(Math.abs(heist.c4Progress - c4) < 1e-6 || heist.techUnit !== tech, 'C4 para sem técnico');

    // Limpa todos os assaltantes (inclusive técnicos novos)
    for (let i = 0; i < 20 && heist.state === 'ALARM'; i++) {
      killWhere((n) => !n.isAllied);
      controller.position.copy(DOOR);
      step(0.5);
    }
    assert.equal(heist.state, 'BOSS', 'Chefe aparece');
    assert.ok(heist.boss && heist.boss.isBoss, 'Mestre do Cofre no saguão');
    killWhere((n) => n === heist.boss);
    step(0.5);
    assert.equal(heist.state, 'IDLE', 'Assalto impedido');
    assert.equal(hud.goldenBricks, 1, 'Bloco Dourado ganho');
    assert.ok((world.prisonIslandData?.prisonersInCellsCount ?? 0) > prisonBefore, 'Bandidos vão para a Ilha da Prisão');
    assert.equal(fw.activeMode, 'PEACEFUL_CITY');
    assert.equal(livingCity.combatNpcs.length, 0, 'Tropas recolhidas no fim');
  });

  it('3. Cofre explode com você lá: carregadores de ouro fogem e derrubá-los recupera o ouro', () => {
    fw.debugBankHeist();
    controller.position.copy(DOOR);
    step(0.1);
    heist.c4Progress = 0.9999;
    const t = heist.techUnit;
    t.visual.root.position.set(BANK_LAYOUT.vaultDoor.x, t.visual.root.position.y, BANK_LAYOUT.vaultDoor.z + 2.4);
    t.destructible.hp = 1e9;
    step(0.5);
    assert.equal(heist.state, 'ESCAPE');
    assert.equal(heist.carriers.length, 3, '3 carregadores com sacos de ouro');
    assert.ok(heist.carriers.every((c) => c.goldBag), 'Saco de ouro nas costas');
    killWhere((n) => heist.carriers.includes(n));
    step(0.5);
    assert.equal(heist.bagsRecovered, 3, 'Ouro recuperado');
    step(0.5);
    assert.equal(heist.state, 'BOSS');
    killWhere(() => true);
    step(0.5);
    killWhere(() => true);
    step(0.5);
    assert.equal(heist.state, 'IDLE');
    destructibles._restoreObject(vaultDoor());
  });
});
