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
const { BANK_HEIST_RULES, BANK_FLOOR_PLAN } = await import('../src/world/events/BankHeistEvent.js');

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
const bank = world.superBankData;
const F = bank.floors;

function step(dt = 0.5) {
  livingCity.playerHp = livingCity.playerMaxHp;
  livingCity.update(dt, controller.position, controller);
}
const killEnemies = () => {
  for (const npc of [...livingCity.combatNpcs]) {
    if (!npc.isAllied && npc.destructible && !npc.destructible.destroyed) {
      destructibles.damageObject(npc.destructible, 1e12, controller.position, false, { fromEnemyNpc: true });
    }
  }
};
const enemies = () => livingCity.combatNpcs.filter((n) => !n.isAllied && !n.destructible.destroyed);
const allies = () => livingCity.combatNpcs.filter((n) => n.isAllied && !n.destructible.destroyed);

describe('🏦 ASSALTO AO SUPER BANCO (você é o assaltante, 4 andares)', () => {
  it('1. Entrar no banco começa o assalto: seguranças no 1º andar, seu time chega e os andares de cima ficam trancados', () => {
    hud.setPlayerFaction('cv', true);
    controller.position.set(0, F[0] + 0.05, -110); // na rua: nada acontece
    step(0.2);
    assert.equal(heist.state, 'IDLE');

    controller.position.set(0, F[0] + 0.05, -150);
    step(0.2);
    assert.equal(heist.state, 'FLOORS', 'Assalto começou ao entrar');
    assert.equal(fw.activeMode, 'BANK_HEIST');
    assert.equal(heist.floor, 0);
    assert.equal(enemies().length, BANK_FLOOR_PLAN[0].units.length);
    assert.ok(enemies().every((n) => n.faction === 'guard'), '1º andar: seguranças');
    assert.ok(allies().length >= 3 && allies().every((n) => n.faction === 'cv'), 'Reforço do seu time');
    assert.equal(bank.gates[0].collider.disabled, false, 'Portão da rampa do 1º andar fechado');

    controller.position.set(world.bankElevator.callX, F[0] + 0.05, world.bankElevator.callZ);
    world.bankElevator.cooldown = 0;
    world.bankElevator.tryUse(controller);
    assert.ok(controller.position.y < F[0] + 1, 'Elevador bloqueado até limpar o andar');
  });

  it('2. Cada andar limpo abre o próximo: Polícia Federal, monstrões e a elite do cofre (no andar certo)', () => {
    const expected = [
      { floor: 1, faction: 'pf', heavy: null },
      { floor: 2, faction: 'bope', heavy: 'brute' },
      { floor: 3, faction: 'bope', heavy: 'elite' }
    ];
    for (const exp of expected) {
      const alliesBefore = allies().length;
      killEnemies();
      step(0.3);
      assert.equal(heist.floor, exp.floor, `Subiu para o andar ${exp.floor + 1}`);
      assert.equal(bank.gates[exp.floor - 1].collider.disabled, true, 'Portão do andar limpo abriu');
      const list = enemies();
      assert.equal(list.length, BANK_FLOOR_PLAN[exp.floor].units.length);
      assert.ok(list.every((n) => n.faction === exp.faction));
      if (exp.heavy) assert.ok(list.every((n) => n.heavyClass === exp.heavy), `Classe ${exp.heavy}`);
      assert.ok(
        list.every((n) => Math.abs(n.visual.root.position.y - F[exp.floor]) < 1.0),
        'Inimigos nascem no andar certo'
      );
      assert.ok(allies().length > alliesBefore, 'Chega reforço do seu time');
    }
    assert.equal(enemies().length, 3, '3 elites no 4º andar');
    assert.ok(enemies()[0].destructible.maxHp >= 1000, 'Elites são parrudos');
  });

  it('3. Inimigo de outro andar não atira em você através da laje', () => {
    const elite = enemies()[0];
    controller.position.set(elite.visual.root.position.x, F[0] + 0.05, elite.visual.root.position.z);
    livingCity.playerHp = livingCity.playerMaxHp;
    for (let i = 0; i < 6; i++) livingCity.update(0.3, controller.position, controller);
    assert.equal(livingCity.playerHp, livingCity.playerMaxHp, 'Nenhum tiro atravessou os andares');
  });

  it('4. Limpar o 4º andar abre o cofre; pegar o ouro inicia a fuga com a polícia', () => {
    killEnemies();
    controller.position.set(0, F[3] + 0.05, -190);
    step(0.3);
    assert.equal(heist.state, 'VAULT');
    assert.equal(bank.vaultDoor.destroyed, true, 'Porta do cofre explodiu');

    const bricks = hud.goldenBricks || 0;
    controller.position.set(bank.goldPile.x, F[3] + 0.05, bank.goldPile.z);
    step(0.3);
    assert.equal(heist.state, 'ESCAPE', 'Pegou o ouro: fuga');
    assert.equal(hud.goldenBricks, bricks + 1, 'Bloco Dourado');
    assert.equal(livingCity.wantedSystem.stars, BANK_HEIST_RULES.escapeStars, 'Polícia atrás de você');
    assert.equal(fw.activeMode, 'PEACEFUL_CITY');
    assert.ok(bank.gates.every((g) => g.collider.disabled), 'Portões liberados');

    const studs = hud.totalStuds;
    livingCity.wantedSystem.clearWanted('escaped');
    step(0.3);
    assert.equal(heist.state, 'IDLE', 'Despistou: assalto concluído');
    assert.ok(hud.totalStuds > studs, 'Bônus de studs');
    assert.ok(heist.timer >= BANK_HEIST_RULES.cooldown - 1, 'Espera para o próximo assalto');
  });

  it('5. Cair durante o assalto ou sair do banco cancela', () => {
    assert.ok(fw.debugBankHeist());
    controller.position.set(0, F[0] + 0.05, -150);
    step(0.2);
    fw._damagePlayerInInvasion(1e9, controller, fw._bankZoneState);
    assert.equal(heist.state, 'IDLE');
    assert.ok(controller.position.z > bank.z + 40, 'Volta para a frente do banco');
    assert.equal(livingCity.combatNpcs.length, 0);
    assert.equal(bank.vaultDoor.destroyed, false, 'Cofre volta a fechar para a próxima tentativa');

    fw.debugBankHeist();
    controller.position.set(0, F[0] + 0.05, -150);
    step(0.2);
    controller.position.set(0, 0.5, -60);
    step(0.2);
    assert.equal(heist.state, 'IDLE', 'Saiu do banco: abortado');
    assert.equal(fw.activeMode, 'PEACEFUL_CITY');
  });
});
