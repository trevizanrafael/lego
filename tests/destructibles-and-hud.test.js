import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { LegoHud } = await import('../src/ui/LegoHud.js');
const { DestructibleManager, STUD_TIERS } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');

test('Tabela de Studs deve respeitar exatamente os 4 valores oficiais (10, 100, 1.000 e 10.000)', () => {
  assert.equal(STUD_TIERS.silver.value, 10);
  assert.equal(STUD_TIERS.gold.value, 100);
  assert.equal(STUD_TIERS.blue.value, 1000);
  assert.equal(STUD_TIERS.purple.value, 10000);
});

test('TestBlockWorld deve registrar todos os tipos de objetos quebráveis de rua (Carros, Hidrantes, Postes, Bancas, Caixas, Cercas e Cofres de Ouro)', () => {
  const scene = new THREE.Scene();
  const hud = new LegoHud(35000);
  const destructibles = new DestructibleManager(scene, hud);
  const world = new TestBlockWorld(scene, destructibles);

  assert.ok(world.colliders.length > 30, 'Mapa deve possuir colisores AABB das calçadas, prédios e objetos');

  const registeredTypes = new Set(destructibles.objects.map((o) => o.type));
  for (const requiredType of ['car', 'hydrant', 'streetlamp', 'newsstand', 'crate', 'fence', 'gold_vault']) {
    assert.ok(
      registeredTypes.has(requiredType),
      `Tipo quebrável obrigatório '${requiredType}' deve estar registrado no cenário`
    );
  }
});

test('Quebrar um Hidrante deve desativar seu colisor, espalhar pecinhas 3D, soltar Studs e ativar o Chafariz de Água', () => {
  const scene = new THREE.Scene();
  const hud = new LegoHud(35000);
  const destructibles = new DestructibleManager(scene, hud);
  new TestBlockWorld(scene, destructibles);

  const hydrant = destructibles.objects.find((o) => o.type === 'hydrant');
  assert.ok(hydrant, 'Deve existir um hidrante no mundo');
  assert.equal(hydrant.destroyed, false);

  const prevDebris = destructibles.debrisList.length;
  const prevStuds = destructibles.studsList.length;

  // Causa dano total para quebrar o hidrante
  destructibles.damageObject(hydrant, 100);

  assert.equal(hydrant.destroyed, true, 'Hidrante deve estar marcado como destruído');
  assert.equal(hydrant.mesh.visible, false, 'Malha do hidrante deve ficar oculta');
  assert.equal(hydrant.colliders[0].disabled, true, 'Colisor do hidrante deve ser desativado');
  assert.ok(destructibles.debrisList.length > prevDebris, 'Deve gerar bloquinhos 3D de desmontagem');
  assert.ok(destructibles.studsList.length > prevStuds, 'Deve gerar moedinhas Studs');
  assert.equal(destructibles.geysers.length, 1, 'Hidrante quebrado deve criar um chafariz de água 3D');

  // Testa reconstrução da rua (Tecla R)
  destructibles.rebuildAll();
  assert.equal(hydrant.destroyed, false, 'rebuildAll() deve restaurar o hidrante');
  assert.equal(hydrant.colliders[0].disabled, false, 'rebuildAll() deve reativar o colisor');
  assert.equal(destructibles.geysers.length, 0, 'rebuildAll() deve limpar chafarizes ativos');
});

test('Ímã de Studs deve puxar moedinhas próximas até o jogador, somar na HUD e atingir True Hero (100%)', () => {
  const scene = new THREE.Scene();
  const hud = new LegoHud(10000); // Meta de 10.000 para testar True Hero
  const destructibles = new DestructibleManager(scene, hud);
  new TestBlockWorld(scene, destructibles);

  const sportCar = destructibles.objects.find((o) => o.type === 'car' && o.studDrops.purple > 0);
  assert.ok(sportCar, 'Deve existir carro esportivo que solta Stud Roxo');

  destructibles.damageObject(sportCar, sportCar.hp);
  assert.ok(destructibles.studsList.length >= 10, 'Carro destruído deve soltar chuva de Studs');

  // Posiciona o jogador exatamente onde o carro quebrou e avança o tempo para o ímã puxar todas as moedas
  const playerPos = sportCar.basePos.clone();
  for (let step = 0; step < 30; step++) {
    destructibles.update(0.04, playerPos);
    hud.update(0.04);
  }

  assert.equal(destructibles.studsList.length, 0, 'Todos os Studs próximos devem ter sido coletados pelo ímã');
  assert.ok(hud.totalStuds >= 12000, `Total de Studs (${hud.totalStuds}) deve somar Prata, Ouro, Azul e Roxo`);
  assert.equal(hud.isTrueHero, true, 'Barra True Hero deve atingir 100% e ativar status de Verdadeiro Herói');
});

