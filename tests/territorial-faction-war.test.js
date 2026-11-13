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
const { TERRITORY_ZONES, FACTION_THEME } = await import('../src/world/FactionWarSystem.js');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 2200);
const hud = new LegoHud(10000);
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
const livingCity = world.livingCity;

const minifig = new Minifigure('caveira');
scene.add(minifig.root);
const domElement = globalThis.document.getElementById('game-container');
const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);

hud.onSelectFaction = (factionKey, conquered) => {
  livingCity.setPlayerFaction(factionKey, controller, conquered);
};
hud.onResetTerritories = () => {
  livingCity.resetTerritories();
};
hud.getConqueredTerritories = () => {
  return livingCity.factionWar.getConqueredTerritoryIds();
};

describe('GUERRA TERRITORIAL DE INVASÃO DE FACÇÕES (1x1 nos 3 Territórios + Cidade Civil 100% Pacífica)', () => {
  it('1. Infraestrutura Física dos 3 Territórios (Portões, 2 Garagens Exclusivas e 3 Outposts cada)', () => {
    assert.ok(world.territoryInfra, 'world.territoryInfra deve existir');
    for (const zKey of ['cv', 'pcc', 'ares']) {
      const infra = world.territoryInfra[zKey];
      assert.ok(infra, `Infraestrutura de ${zKey} deve existir`);
      assert.equal(infra.gates.length, 2, `${zKey} deve ter 2 portões de fronteira com bandeiras`);
      assert.equal(infra.garages.length, 2, `${zKey} deve ter 2 garagens oficiais do time`);
      assert.equal(infra.outposts.length, 3, `${zKey} deve ter 3 postos de comando (Outposts P1..P3)`);

      let totalGarageCars = 0;
      for (const g of infra.garages) {
        totalGarageCars += g.parkedVehicles.length;
        for (const pv of g.parkedVehicles) {
          assert.ok(pv.destructible && pv.destructible.type === 'car', 'Veículo da garagem deve ser dirigível');
        }
      }
      assert.equal(totalGarageCars, 6, `${zKey} deve ter 6 veículos exclusivos estacionados nas 2 garagens`);
    }
  });

  it('2. Regra de Ouro: Centro, Super Banco, Parque, Subúrbio, Praia e Aeroporto são 100% Civis e Pacíficos', () => {
    hud.setPlayerFaction('cv', true);

    const peacefulCoords = [
      new THREE.Vector3(0, 0.5, -117),     // Centro Financeiro / Frente do Super Banco
      new THREE.Vector3(0, 0.5, 240),      // Parque Central
      new THREE.Vector3(120, 2.2, -646),   // Subúrbio Norte
      new THREE.Vector3(0, 1.5, 1080),     // Praia Sul
      new THREE.Vector3(-1060, 0.5, 0)     // Aeroporto Oeste
    ];

    for (const pos of peacefulCoords) {
      controller.position.copy(pos);
      livingCity.update(0.1, controller.position, controller);
      assert.equal(livingCity.factionWar.isInvasionActive, false, `Sem invasão em (${pos.x}, ${pos.z})`);
      assert.equal(livingCity.factionWar.activeMode, 'PEACEFUL_CITY');
      assert.equal(livingCity.combatNpcs.length, 0, `Zero soldados armados na cidade civil (${pos.x}, ${pos.z})`);
    }
  });

  it('3. Próprio Território (QG Aliado em Paz): Guardas batem continência, zero inimigos e Médicos curam', () => {
    hud.setPlayerFaction('cv', true);
    const cvOutpostPos = new THREE.Vector3(-705, 22.4, -80);
    controller.position.copy(cvOutpostPos);

    livingCity.update(0.1, controller.position, controller);
    assert.equal(livingCity.factionWar.activeMode, 'ALLY_HQ');
    assert.equal(livingCity.factionWar.isInvasionActive, false);
    assert.ok(livingCity.combatNpcs.length >= 5, 'Deve haver guardas e médicos aliados no QG');

    const enemiesInOwnBase = livingCity.combatNpcs.filter((n) => !n.isAllied);
    assert.equal(enemiesInOwnBase.length, 0, 'Zero inimigos dentro do próprio território aliado');

    // Guardas próximos devem bater continência / acenar e exibir o losango verde aliado
    livingCity.update(0.2, controller.position, controller);
    const salutingGuards = livingCity.combatNpcs.filter((n) => n.saluting);
    assert.ok(salutingGuards.length >= 1, 'Pelo menos 1 guarda próximo bate continência ao jogador');
    for (const ally of livingCity.combatNpcs) {
      assert.equal(ally.visual.allyMarker.visible, true, 'Aliado exibe marcador verde discreto');
    }

    // Simula ferimento prévio e verifica cura automática no QG
    livingCity.playerHp = 150;
    livingCity.factionWar._updateCombatUnitsAndHealBeams(
      0.5,
      controller.position,
      controller,
      livingCity.factionWar.territories.cv
    );
    assert.ok(livingCity.playerHp > 150, 'Médico da base aliada recupera a vida do jogador');
  });

  it('4. Guerra de Invasão 1x1 (CV invadindo PCC): Captura em Sequência P1→P2→P3, Ponto Contestado, Relógio e Chefe no Pátio', () => {
    hud.setPlayerFaction('cv', true);

    // Cruza a fronteira entrando no Território do PCC (X: 580..1580, Z: -620..110)
    const pccP1 = TERRITORY_ZONES.pcc.outposts[0];
    controller.position.set(pccP1.x, 0.6, pccP1.z);
    livingCity.update(0.1, controller.position, controller);

    const fw = livingCity.factionWar;
    assert.equal(fw.activeMode, 'INVASION_1V1');
    assert.equal(fw.activeZoneId, 'pcc');
    assert.equal(fw.isInvasionActive, true);

    // Deve ter despachado comboio aliado (CV) + reforço motorizado inimigo (PCC)
    assert.equal(fw.activeConvoyDrops.length, 2, 'Comboio Aliado + Carro de Reforço Inimigo despachados');
    const hasAlliedConvoy = fw.activeConvoyDrops.some((c) => c.isAllied && c.faction === 'cv');
    const hasEnemyConvoy = fw.activeConvoyDrops.some((c) => !c.isAllied && c.faction === 'pcc');
    assert.ok(hasAlliedConvoy && hasEnemyConvoy, 'Comboios são estritamente CV vs PCC');

    // Avança o tempo para os carros chegarem e desembarcarem os soldados
    for (let step = 0; step < 30; step++) {
      livingCity.update(0.2, controller.position, controller);
    }

    // Verifica leitura 1x1 cristalina: APENAS 'cv' e 'pcc' presentes (ZERO 'ares'!)
    const thirdPartyUnits = livingCity.combatNpcs.filter(
      (n) => n.faction !== 'cv' && n.faction !== 'pcc'
    );
    assert.equal(thirdPartyUnits.length, 0, 'Nunca mistura uma 3ª facção na invasão 1x1');
    for (const enemy of livingCity.combatNpcs.filter((n) => !n.isAllied)) {
      assert.equal(enemy.visual.allyMarker.visible, false, 'Inimigos não exibem marcador verde');
    }

    const pccState = fw.territories.pcc;
    assert.equal(pccState.activeIndex, 0, 'Invasão começa no P1');
    assert.notEqual(pccState.captureZones[0].state, 'LOCKED', 'P1 é o ponto ativo');
    assert.equal(pccState.captureZones[1].state, 'LOCKED', 'P2 começa trancado');
    assert.equal(pccState.captureZones[2].state, 'LOCKED', 'P3 começa trancado');
    assert.equal(fw.objectiveHud.visible, true, 'Painel de objetivo aparece na invasão');

    const killEnemiesNear = (x, z, radius = 40) => {
      for (const npc of [...livingCity.combatNpcs]) {
        if (npc.isAllied || npc.isBoss) continue;
        const p = npc.visual.root.position;
        if (Math.hypot(p.x - x, p.z - z) < radius) {
          destructibles.damageObject(npc.destructible, 99999, controller.position, false, { fromEnemyNpc: true });
        }
      }
    };
    const holdPoint = (op, seconds) => {
      for (let t = 0; t < seconds; t += 0.5) {
        controller.position.set(op.x, op.y ?? 6.5, op.z);
        killEnemiesNear(op.x, op.z);
        livingCity.playerHp = livingCity.playerMaxHp;
        livingCity.update(0.5, controller.position, controller);
        if (op.ownerFaction === 'cv') return;
      }
    };

    // Fora de ordem: ficar no P3 trancado NÃO captura
    const op3 = pccState.outposts[2];
    holdPoint(op3, 6);
    assert.equal(op3.ownerFaction, 'pcc', 'P3 trancado não pode ser capturado antes do P1/P2');

    // Captura NÃO é instantânea: depois de 2s ainda está enchendo
    const op1 = pccState.outposts[0];
    holdPoint(op1, 2);
    assert.equal(op1.ownerFaction, 'pcc', 'Captura leva tempo (barra enchendo)');
    assert.ok(pccState.captureZones[0].progress > 0.1, 'Barra de captura enche com o jogador no anel');

    const clockBefore = pccState.invasionClock;
    holdPoint(op1, 14);
    assert.equal(op1.ownerFaction, 'cv', 'P1 capturado depois de segurar o anel');
    assert.equal(op1.beaconMat.color.getHex(), FACTION_THEME.cv.hex, 'Antena muda para Vermelho CV');
    assert.ok(pccState.invasionClock > clockBefore, 'Captura soma tempo no relógio');
    assert.equal(pccState.activeIndex, 1, 'P2 vira o objetivo ativo');

    // Ponto CONTESTADO: com defensor dentro do anel a barra não enche
    const op2 = pccState.outposts[1];
    killEnemiesNear(op2.x, op2.z, 400);
    const guard = fw._spawnCombatUnit({ faction: 'pcc', role: 'tank', x: op2.x + 2, z: op2.z + 2, outpostId: op2.id });
    guard.destructible.hp = 1e9;
    guard.retreating = false;
    controller.position.set(op2.x, op2.y ?? 6.5, op2.z);
    for (let t = 0; t < 2; t += 0.5) {
      livingCity.playerHp = livingCity.playerMaxHp;
      guard.visual.root.position.set(op2.x + 2, guard.visual.root.position.y, op2.z + 2);
      livingCity.update(0.5, controller.position, controller);
    }
    assert.equal(pccState.captureZones[1].state, 'CONTESTED', 'Defensor no anel deixa o ponto contestado');
    assert.equal(pccState.captureZones[1].progress, 0, 'Barra travada enquanto contestado');
    destructibles.damageObject(guard.destructible, 1e12, controller.position, false, { fromEnemyNpc: true });

    holdPoint(op2, 16);
    assert.equal(op2.ownerFaction, 'cv', 'P2 capturado');
    assert.equal(pccState.bossPhaseTriggered, false, 'Chefe só aparece depois do P3');

    holdPoint(op3, 16);
    assert.equal(op3.ownerFaction, 'cv', 'P3 capturado');

    // Depois dos 3 postos: Duelo de Chefões no pátio
    assert.equal(pccState.bossPhaseTriggered, true, 'Clímax de Bosses ativado após o P3');
    assert.ok(pccState.enemyBoss && pccState.enemyBoss.faction === 'pcc', 'Boss Defensor PCC presente');
    assert.ok(pccState.alliedBoss && pccState.alliedBoss.faction === 'cv', 'Boss Aliado CV presente');

    // Derrota o Boss -> CONQUISTA TOTAL DO TERRITÓRIO!
    destructibles.damageObject(pccState.enemyBoss.destructible, 99999, controller.position, false, {
      fromEnemyNpc: true
    });
    livingCity.update(0.6, controller.position, controller);

    assert.equal(pccState.conqueredByPlayer, true, 'Território do PCC foi conquistado pelo jogador');
    assert.equal(pccState.ownerFaction, 'cv', 'Território conquistado passa a pertencer ao CV');
    assert.equal(fw.activeMode, 'ALLY_HQ', 'Território conquistado vira QG Aliado pacífico');
    assert.equal(
      world.territoryInfra.pcc.gates[0].flagMat.color.getHex(),
      FACTION_THEME.cv.hex,
      'Bandeira 3D do Portão do território conquistado muda para a cor da facção do jogador'
    );
  });

  it('4b. Soldados detalhados: cada facção e classe tem kit visual próprio e tronco visível', async () => {
    const { createFactionSoldierVisual } = await import('../src/entities/FactionSoldierBuilder.js');
    for (const f of ['cv', 'pcc', 'ares']) {
      for (const role of ['rifleman', 'tank', 'medic', 'special', 'boss']) {
        const v = createFactionSoldierVisual(f, role);
        let meshes = 0;
        let multiMaterial = 0;
        v.bodyRig.traverse((o) => {
          if (o.isMesh) {
            meshes++;
            if (Array.isArray(o.material)) multiMaterial++;
          }
        });
        assert.ok(meshes >= 12, `${f}/${role} deve ter peças detalhadas (${meshes})`);
        assert.equal(multiMaterial, 0, 'Nenhuma peça com material múltiplo (bug do tronco invisível)');
        assert.ok(v.className.length > 0, 'Classe tem nome');
      }
    }
  });

  it('4c. Invasão falha quando o relógio zera e os postos voltam ao dono', () => {
    livingCity.resetTerritories();
    hud.setPlayerFaction('cv', true);
    const fw = livingCity.factionWar;
    const ares = TERRITORY_ZONES.ares.outposts[0];
    controller.position.set(ares.x, 0.6, ares.z);
    livingCity.update(0.1, controller.position, controller);
    assert.equal(fw.activeZoneId, 'ares');
    fw.territories.ares.outposts[0].ownerFaction = 'cv';
    fw.territories.ares.invasionClock = 0.2;
    livingCity.playerHp = livingCity.playerMaxHp;
    livingCity.update(0.5, controller.position, controller);
    assert.equal(fw.isInvasionActive, false, 'Invasão encerrada por tempo');
    assert.equal(fw.territories.ares.outposts[0].ownerFaction, 'ares', 'Posto volta para a A.R.E.S.');
    assert.equal(fw.objectiveHud.visible, false, 'Painel de objetivo some');
  });

  it('5. Desengajamento Limpo ao Sair do Território + Botão Resetar Territórios + Renderização Mapa [M] / Minimapa', () => {
    // Invade o território da A.R.E.S. e depois sai de volta para o Centro Civil
    controller.position.set(675, 0.6, 140);
    livingCity.update(0.2, controller.position, controller);
    assert.equal(livingCity.factionWar.activeMode, 'INVASION_1V1');
    assert.equal(livingCity.factionWar.activeZoneId, 'ares');
    assert.ok(livingCity.combatNpcs.length > 0);

    // Volta para a frente do Super Banco no Centro Financeiro
    controller.position.set(0, 0.5, -117);
    livingCity.update(0.2, controller.position, controller);
    assert.equal(livingCity.factionWar.activeMode, 'PEACEFUL_CITY');
    assert.equal(livingCity.factionWar.isInvasionActive, false);
    assert.equal(livingCity.combatNpcs.length, 0, 'Soldados recolhidos ao sair do território');
    assert.equal(livingCity.playerHp, 250, 'Vida restaurada na paz civil');

    // Testa Resetar Territórios e Renderização do Minimapa e Mapa Completo [M]
    livingCity.resetTerritories();
    assert.equal(livingCity.factionWar.territories.pcc.ownerFaction, 'pcc');
    assert.equal(livingCity.factionWar.territories.pcc.conqueredByPlayer, false);

    hud.updateMinimap(controller.position, 0, 0, world.regions[0], world, 0, 0.016);
    hud.renderFullMap(world, controller.position, 0, controller);
  });
});

