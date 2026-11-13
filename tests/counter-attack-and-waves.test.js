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
const { WaveDirector, WAVE_STATE, buildFactionSquad } = await import('../src/world/events/WaveDirector.js');
const { COUNTER_ATTACK_RULES } = await import('../src/world/events/TerritoryCounterAttack.js');

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
hud.getConqueredTerritories = () => livingCity.factionWar.getConqueredTerritoryIds();
hud.getTerritoryMeta = () => livingCity.factionWar.getTerritoryMeta();

const fw = livingCity.factionWar;
const BANK = new THREE.Vector3(0, 0.5, -117);

function conquerPcc() {
  livingCity.resetTerritories();
  hud.setPlayerFaction('cv', true, ['pcc']);
  assert.equal(fw.territories.pcc.conqueredByPlayer, true);
}

function step(dt = 0.5) {
  livingCity.playerHp = livingCity.playerMaxHp;
  livingCity.update(dt, controller.position, controller);
}

describe('DIRETOR DE ONDAS (Garden Ops)', () => {
  it('solta inimigos aos poucos, respeita o teto de vivos e só avança quando a onda é limpa', () => {
    const dir = new WaveDirector({
      waves: [{ roles: ['rifleman', 'rifleman', 'tank'] }, { roles: ['boss'] }],
      breakTime: 2,
      firstBreak: 1,
      maxAlive: 2,
      spawnInterval: 0.1
    });
    const alive = [];
    const spawn = (roles) => roles.forEach((r) => {
      const u = { role: r, destructible: { destroyed: false } };
      alive.push(u);
      dir.register(u);
    });
    let cleared = 0;
    dir.onWaveCleared = () => cleared++;
    dir.start();
    spawn(dir.update(0.5));
    assert.equal(alive.length, 0, 'Pausa inicial antes da onda 1');
    spawn(dir.update(0.6));
    for (let i = 0; i < 5; i++) spawn(dir.update(0.2));
    assert.equal(alive.length, 2, 'Teto de 2 vivos respeitado');
    alive.forEach((u) => (u.destructible.destroyed = true));
    for (let i = 0; i < 5; i++) spawn(dir.update(0.2));
    assert.equal(alive.length, 3, 'Terceiro inimigo entra quando abre vaga');
    alive.forEach((u) => (u.destructible.destroyed = true));
    dir.update(0.1);
    assert.equal(cleared, 1, 'Onda 1 limpa');
    assert.equal(dir.state, WAVE_STATE.BREAK, 'Pausa entre ondas');
    assert.equal(dir.waveNumber, 1);
  });

  it('esquadrões escalam por nível e por facção', () => {
    assert.ok(buildFactionSquad('cv', 0).length < buildFactionSquad('cv', 3).length);
    assert.ok(buildFactionSquad('pcc', 1).includes('special'), 'Especialista a partir do nível 1');
  });
});

describe('CONTRA-ATAQUE: os caras voltam para retomar o território', () => {
  it('1. Ameaça é armada ao conquistar e dispara alerta quando o tempo acaba', () => {
    conquerPcc();
    controller.position.copy(BANK);
    step(0.1);
    assert.ok(Number.isFinite(fw.territories.pcc.threatTimer), 'Timer de ameaça armado');
    fw.territories.pcc.threatTimer = 0.2;
    step(0.5);
    assert.equal(fw.counterAttack.phase, 'ALERT', 'Contra-ataque em alerta');
    assert.equal(fw.counterAttack.attacker, 'pcc', 'Quem volta é o dono antigo');
    assert.equal(fw.objectiveHud.visible, true);
    assert.ok(fw.activeWarzones.some((w) => w.outpostId === 'counter_flag'), 'Bandeira marcada no mapa');
  });

  it('2. Se você não aparecer e a guarnição perder, o território volta para a facção', () => {
    const oldRandom = Math.random;
    Math.random = () => 0.99; // guarnição perde
    try {
      for (let t = 0; t < COUNTER_ATTACK_RULES.alertWindow + 2; t += 1) step(1);
    } finally {
      Math.random = oldRandom;
    }
    assert.equal(fw.counterAttack.phase, 'IDLE');
    assert.equal(fw.territories.pcc.conqueredByPlayer, false, 'Território perdido');
    assert.equal(fw.territories.pcc.ownerFaction, 'pcc', 'PCC retomou o território');
  });

  it('3. Defesa em pessoa: 5 ondas limpas = território segue seu e guarnição sobe de nível', () => {
    conquerPcc();
    const court = fw.territories.pcc.spec.bossCourtyard;
    controller.position.set(court.x, 2, court.z);
    step(0.1);
    assert.equal(fw.activeMode, 'ALLY_HQ');
    assert.ok(fw.debugCounterAttack('pcc'));
    assert.equal(fw.counterAttack.phase, 'DEFENSE', 'Já dentro do território: defesa começa na hora');
    assert.equal(fw.activeMode, 'COUNTER_ATTACK');

    let sawWave5 = false;
    for (let i = 0; i < 400 && fw.counterAttack.phase === 'DEFENSE'; i++) {
      for (const npc of [...livingCity.combatNpcs]) {
        if (!npc.isAllied && npc.destructible && !npc.destructible.destroyed) {
          destructibles.damageObject(npc.destructible, 1e9, controller.position, false, { fromEnemyNpc: true });
        }
      }
      controller.position.set(court.x, 2, court.z);
      step(0.5);
      if (fw.counterAttack.director?.waveNumber === 5) sawWave5 = true;
    }
    assert.ok(sawWave5, 'Chegou na onda 5 (chefe)');
    assert.equal(fw.counterAttack.phase, 'IDLE');
    assert.equal(fw.territories.pcc.conqueredByPlayer, true, 'Território segue do jogador');
    assert.equal(fw.territories.pcc.garrisonLevel, 1, 'Guarnição sobe de nível');
    assert.equal(fw.getTerritoryMeta().pcc.garrisonLevel, 1, 'Nível vai para o save');
  });

  it('4. Bandeira tomada (inimigos no anel sem oposição) = território perdido', () => {
    conquerPcc();
    const court = fw.territories.pcc.spec.bossCourtyard;
    controller.position.set(court.x, 2, court.z);
    step(0.1);
    fw.debugCounterAttack('pcc');
    // Remove a guarnição e afasta o jogador da bandeira (mas dentro do território)
    for (const npc of [...livingCity.combatNpcs]) {
      if (npc.isAllied) destructibles.damageObject(npc.destructible, 1e9, controller.position, false, { fromEnemyNpc: true });
    }
    const intruder = fw.counterAttack._spawnAttacker('tank');
    intruder.destructible.hp = 1e12;
    controller.position.set(court.x + 40, 2, court.z + 40);
    for (let i = 0; i < 60 && fw.counterAttack.phase === 'DEFENSE'; i++) {
      intruder.retreating = false;
      intruder.visual.root.position.set(court.x + 1, intruder.visual.root.position.y, court.z + 1);
      for (const npc of [...livingCity.combatNpcs]) {
        if (npc.isAllied) destructibles.damageObject(npc.destructible, 1e9, controller.position, false, { fromEnemyNpc: true });
      }
      if (!fw.territories.pcc.conqueredByPlayer) break;
      controller.position.set(court.x + 40, 2, court.z + 40);
      step(0.5);
    }
    assert.equal(fw.territories.pcc.conqueredByPlayer, false, 'Bandeira tomada: território perdido');
    assert.equal(fw.counterAttack.phase, 'IDLE');
  });
});
