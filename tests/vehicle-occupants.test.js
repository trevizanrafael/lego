import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { WantedPursuitSystem } = await import('../src/world/WantedPursuitSystem.js');
const { HumanoidCorpseManager } = await import('../src/world/npc-health/HumanoidCorpseManager.js');
const { createLegoCarMesh, VEHICLE_SPECS } = await import('../src/world/VehicleFleetBuilder.js');
const {
  attachVehicleOccupants,
  getAliveOccupantCount,
  disembarkOccupants,
  restoreDefaultOccupants
} = await import('../src/world/vehicles/VehicleOccupants.js');

function countSceneLights(root) {
  let count = 0;
  root.traverse((n) => {
    if (n.isLight) count++;
  });
  return count;
}

function createVehicleTestHarness() {
  const scene = new THREE.Scene();
  const killFeedbackCalls = [];
  const banners = [];
  const hud = {
    totalStuds: 5000,
    displayedStuds: 5000,
    _lastController: null,
    updateWantedHud() {},
    showWantedBanner(title, subtitle, kind) {
      banners.push({ title, subtitle, kind });
    },
    setPlayerHealth() {},
    triggerHitmarker() {},
    spawnDamageNumber() {},
    triggerPlayerKillFeedback(victim, opts) {
      killFeedbackCalls.push({ victim, opts });
    },
    addStuds(amount) {
      this.totalStuds += amount;
    }
  };

  const destructibles = new DestructibleManager(scene, hud);
  const colliders = [];
  const world = {
    scene,
    colliders,
    destructibles,
    atmosphere: { nightFactor: 0 },
    mapBuildings: [],
    elevatedDecks: [],
    addCollider(x, z, w, d, maxY, minY) {
      const col = {
        minX: x - w * 0.5,
        maxX: x + w * 0.5,
        minZ: z - d * 0.5,
        maxZ: z + d * 0.5,
        minY,
        maxY,
        disabled: false
      };
      colliders.push(col);
      return col;
    },
    getTerrainHeightAt: () => 0,
    getSurfaceHeightAt: () => 0,
    isDeepWaterAt: () => false
  };
  destructibles.world = world;

  const corpseManager = new HumanoidCorpseManager(scene, null);
  const livingCity = {
    world,
    scene,
    destructibles,
    hud,
    corpseManager,
    playerHp: 100,
    playerMaxHp: 100,
    _findSafeStreetSpawn: (x, z) => ({ x, z }),
    triggerPedestrianPanicNear() {}
  };
  corpseManager.livingCity = livingCity;
  world.livingCity = livingCity;

  const controller = {
    position: new THREE.Vector3(0, 0.5, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    stealthTimer: 0,
    currentVehicle: null,
    vehicleSpeed: 0,
    vehicleHeading: 0,
    minifigure: { root: new THREE.Group(), group: new THREE.Group() },
    operatorAbilities: { isStealthed: () => false },
    enterVehicle(carObj) {
      this.currentVehicle = carObj;
      carObj.isDriven = true;
      for (const c of carObj.colliders) c.disabled = true;
    },
    exitVehicle() {
      if (!this.currentVehicle) return;
      const carObj = this.currentVehicle;
      carObj.isDriven = false;
      this.currentVehicle = null;
      this.position.set(carObj.mesh.position.x + 2.5, 0.5, carObj.mesh.position.z);
    },
    getHorizontalSpeed() {
      return this.currentVehicle
        ? Math.abs(this.vehicleSpeed)
        : Math.hypot(this.velocity.x, this.velocity.z);
    }
  };
  hud._lastController = controller;
  livingCity._lastController = controller;

  const ws = new WantedPursuitSystem(livingCity);
  livingCity.wantedSystem = ws;

  return {
    scene,
    world,
    destructibles,
    hud,
    livingCity,
    corpseManager,
    controller,
    ws,
    killFeedbackCalls,
    banners
  };
}

function spawnCustomTestCar(world, destructibles, { x = 0, z = 0, type = 'sedan_familiar', hp = 200 } = {}) {
  const spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.sedan_familiar;
  const mesh = createLegoCarMesh({ x, z, rotY: 0, color: 0x1e3a5f, roofColor: 0x0f172a, type });
  mesh.position.set(x, 0, z);
  mesh.userData.carType = type;
  mesh.userData.vehicleSpec = spec;
  world.scene.add(mesh);
  const col = world.addCollider(x, z, 2.5, 5.0, 2.0, 0);
  return destructibles.registerDestructible({
    mesh,
    type: 'car',
    hp,
    radius: 2.6,
    height: 2.1,
    colliders: [col],
    studDrops: spec.studDrops,
    groundY: 0
  });
}

describe('OCUPANTES VISÍVEIS, FUMAÇA/FOGO PROGRESSIVO, EXPLOSÃO EM CADEIA, CARCAÇA 30S & MULTI-KILL', () => {
  it('1. Contagem exata de ocupantes no spawn (Patrulha 2, Caveirão 4, Tanque 2 ocultos, Águia 2, Comboio 3–4, Trânsito 1–2/Ônibus 3 e Rua Vazia 0)', () => {
    const { scene, world, destructibles, ws, controller } = createVehicleTestHarness();
    const initialLightCount = countSceneLights(scene);

    // 1) Carro estacionado na rua & Moto Fantasma do Turbo: 0 ocupantes
    const parkedCar = spawnCustomTestCar(world, destructibles, { x: -40, z: -40, type: 'apex_gtx' });
    assert.equal(getAliveOccupantCount(parkedCar), 0, 'Carro estacionado na rua nasce com 0 ocupantes');

    const ghostBike = destructibles.summonTurboEnergyBike(new THREE.Vector3(-50, 0, -40), 0);
    assert.equal(getAliveOccupantCount(ghostBike), 0, 'Moto Fantasma do Turbo tem 0 ocupantes IA');
    destructibles.damageObject(ghostBike, 9999);
    assert.equal(ghostBike.isBurnedWreck, false, 'Moto Fantasma oculta de forma limpa sem deixar carcaça de 30s');
    assert.equal(ghostBike.mesh.visible, false);

    // 2) Patrulha Policial 1★: 2 policiais visíveis
    ws.setWantedStars(1);
    const patrolUnit = ws.pursuitVehicles.find((v) => !v.isTank);
    assert.ok(patrolUnit, 'Viatura de patrulha criada');
    assert.equal(getAliveOccupantCount(patrolUnit.carObj), 2, 'Viatura policial tem 2 policiais');
    assert.equal(patrolUnit.carObj._occupantsGroup.visible, true);

    // 3) Caveirão BOPE 4★: 4 policiais do BOPE
    ws.clearWanted('reset');
    ws.setWantedStars(4);
    while (!ws.pursuitVehicles.some((v) => v.role === 'bope_heavy')) {
      ws._spawnPursuitVehicle(controller.position);
    }
    const bopeUnit = ws.pursuitVehicles.find((v) => v.role === 'bope_heavy');
    assert.ok(bopeUnit, 'Caveirão BOPE criado');
    assert.equal(getAliveOccupantCount(bopeUnit.carObj), 4, 'Caveirão BOPE transporta 4 policiais');
    assert.ok(bopeUnit.carObj.occupants.every((o) => o.category === 'police' && o.subKind === 'bope'));

    // 4) Tanque Militar 5★: 2 tripulantes rastreados, mas ocultos dentro da blindagem
    ws.setWantedStars(5);
    ws._spawnPoliceTank(controller.position);
    const tankUnit = ws.pursuitVehicles.find((v) => v.isTank);
    assert.ok(tankUnit, 'Tanque Militar criado');
    assert.equal(getAliveOccupantCount(tankUnit.carObj), 2, 'Tanque Militar possui 2 tripulantes rastreados');
    assert.equal(tankUnit.carObj._occupantsGroup.visible, false, 'Tripulação do tanque fica oculta no casco');

    // 5) Helicóptero Policial Águia: 2 policiais (pilot + gunner)
    const heli = ws.policeHelicopters[0];
    assert.ok(heli, 'Helicóptero Águia criado');
    assert.equal(getAliveOccupantCount(heli.obj), 2, 'Helicóptero Águia tem 2 ocupantes (piloto + atirador)');

    // 6) Comboio de Facção (3–4 soldados) + Desembarque zera ocupantes
    const convoyCar = spawnCustomTestCar(world, destructibles, { x: 40, z: 40, type: 'suv_pcc' });
    attachVehicleOccupants(convoyCar, {
      source: 'convoy',
      carType: 'suv_pcc',
      faction: 'pcc',
      isAllied: false,
      count: 4
    });
    assert.equal(getAliveOccupantCount(convoyCar), 4, 'Comboio PCC inicia com 4 soldados');
    disembarkOccupants(convoyCar, Infinity);
    assert.equal(getAliveOccupantCount(convoyCar), 0, 'Comboio fica vazio após desembarque');
    assert.equal(convoyCar._occupantsGroup.visible, false);

    // 7) Carros de Trânsito (1–2 civis determinísticos, 3 no ônibus, 1 na moto, restauração no respawn)
    const trafficCarA = spawnCustomTestCar(world, destructibles, { x: 10, z: 10, type: 'sedan_familiar' });
    const trafficCarB = spawnCustomTestCar(world, destructibles, { x: 20, z: 10, type: 'taxi_metro' });
    const trafficBus = spawnCustomTestCar(world, destructibles, { x: 30, z: 10, type: 'onibus_urbano' });
    attachVehicleOccupants(trafficCarA, { source: 'traffic', carType: 'sedan_familiar', seedIndex: 0 });
    attachVehicleOccupants(trafficCarB, { source: 'traffic', carType: 'taxi_metro', seedIndex: 1 });
    attachVehicleOccupants(trafficBus, { source: 'traffic', carType: 'onibus_urbano', isBus: true, seedIndex: 2 });

    assert.equal(getAliveOccupantCount(trafficCarA), 2, 'Carro de trânsito par nasce com 2 civis');
    assert.equal(getAliveOccupantCount(trafficCarB), 1, 'Carro de trânsito ímpar nasce com 1 civil');
    assert.equal(getAliveOccupantCount(trafficBus), 3, 'Ônibus urbano nasce com 3 civis');

    disembarkOccupants(trafficCarA, Infinity);
    assert.equal(getAliveOccupantCount(trafficCarA), 0, 'Carjacking remove ocupantes da cabine');
    restoreDefaultOccupants(trafficCarA);
    assert.equal(getAliveOccupantCount(trafficCarA), 2, 'Relocação restaura ocupantes padrão do trânsito');

    assert.equal(countSceneLights(scene), initialLightCount, 'Zero THREE.Light adicionadas em runtime');
  });

  it('2. Estágios progressivos de dano (white_smoke < 60%, black_smoke < 35% com motor reduzido, engine_fire < 15% explodindo após 4.0s) + Tiro no Motorista pelo Para-Brisa', () => {
    const { scene, world, destructibles, killFeedbackCalls } = createVehicleTestHarness();
    const initialLightCount = countSceneLights(scene);

    const car = spawnCustomTestCar(world, destructibles, { x: 0, z: 0, type: 'sedan_familiar', hp: 200 });
    attachVehicleOccupants(car, { source: 'traffic', carType: 'sedan_familiar', seedIndex: 0 });
    car._aiCurrentSpeed = 12.0; // Em movimento para testar o timer completo de 4.0s

    assert.equal(destructibles.getVehicleDamageStage(car), 'intact');
    assert.equal(destructibles.getVehicleEngineSpeedMultiplier(car), 1.0);

    // 50% HP (100 / 200) -> white_smoke
    destructibles.damageObject(car, 100, car.basePos);
    assert.equal(destructibles.getVehicleDamageStage(car), 'white_smoke');
    assert.equal(destructibles.getVehicleEngineSpeedMultiplier(car), 1.0);

    // 25% HP (50 / 200) -> black_smoke + multiplicador de velocidade 0.58
    destructibles.damageObject(car, 50, car.basePos);
    assert.equal(destructibles.getVehicleDamageStage(car), 'black_smoke');
    assert.equal(destructibles.getVehicleEngineSpeedMultiplier(car), 0.58);

    // 10% HP (20 / 200) -> engine_fire (4.0s até explodir!)
    destructibles.damageObject(car, 30, car.basePos);
    assert.equal(destructibles.getVehicleDamageStage(car), 'engine_fire');
    assert.equal(car.isBurning, true);
    assert.equal(car.engineFireTimer, 4.0);
    assert.equal(destructibles.getVehicleEngineSpeedMultiplier(car), 0.32);

    // Avança 2.5s -> ainda queimando sem explodir
    for (let i = 0; i < 25; i++) destructibles.update(0.1, new THREE.Vector3(0, 0, -15));
    assert.equal(car.destroyed, false, 'Ainda em chamas em 2.5s');

    // Avança mais 1.6s (total 4.1s > 4.0s) -> explode automaticamente e mata os 2 civis!
    for (let i = 0; i < 16; i++) destructibles.update(0.1, new THREE.Vector3(0, 0, -15));
    assert.equal(car.destroyed, true, 'Carro em chamas auto-explode ao zerar 4.0s');
    assert.equal(car.isBurnedWreck, true);
    assert.equal(killFeedbackCalls.length, 1, 'Feedback de kill disparado 1 única vez na explosão');
    assert.deepEqual(killFeedbackCalls[0].opts.categories, ['civilian', 'civilian']);

    // Testa tiro de precisão no para-brisa matando apenas o motorista (driverKilled = true)
    const snipeCar = spawnCustomTestCar(world, destructibles, { x: 60, z: 0, type: 'taxi_metro', hp: 220 });
    attachVehicleOccupants(snipeCar, { source: 'traffic', carType: 'taxi_metro', seedIndex: 0 });
    const windshieldHit = new THREE.Vector3(60 - 0.38, 1.22, 0.35);
    destructibles.damageObject(snipeCar, 35, windshieldHit, false, { impactPoint: windshieldHit });
    assert.equal(snipeCar.driverKilled, true, 'Tiro na janela frontal elimina o motorista');
    assert.equal(getAliveOccupantCount(snipeCar), 1, 'Passageiro ao lado continua vivo após snipe no motorista');
    assert.equal(destructibles.getVehicleEngineSpeedMultiplier(snipeCar), 0, 'Carro sem motorista freia até parar');
    assert.equal(killFeedbackCalls.length, 2, 'Snipe no motorista contabiliza 1 kill imediata');
    assert.equal(killFeedbackCalls[1].opts.killCount, 1);

    assert.equal(countSceneLights(scene), initialLightCount, 'Zero THREE.Light adicionadas por fumaça/chamas');
  });

  it('3. Caveirão BOPE cheio (4 kills + carcaça carbonizada de 30s + corpos) vs Viatura já desembarcada (0 kills) + Queda em Parafuso do Helicóptero (2 kills)', () => {
    const { scene, destructibles, ws, corpseManager, controller, killFeedbackCalls } = createVehicleTestHarness();
    const initialLightCount = countSceneLights(scene);

    controller.position.set(0, 0.5, 0);
    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(4);
    while (!ws.pursuitVehicles.some((v) => v.role === 'bope_heavy')) {
      ws._spawnPursuitVehicle(controller.position);
    }

    const bopePv = ws.pursuitVehicles.find((v) => v.role === 'bope_heavy');
    const bopeCar = bopePv.carObj;
    bopeCar.mesh.position.set(0, 0, -45);
    bopeCar.basePos.copy(bopeCar.mesh.position);
    assert.equal(getAliveOccupantCount(bopeCar), 4);

    // Explode o Caveirão cheio a 0 HP!
    destructibles.damageObject(bopeCar, 9999, bopeCar.mesh.position);

    assert.equal(bopeCar.destroyed, true);
    assert.equal(bopeCar.isBurnedWreck, true, 'Deixa carcaça carbonizada ativa');
    assert.equal(bopeCar.mesh.visible, true, 'Carcaça permanece visível na rua durante os 30s');
    assert.equal(bopeCar.colliders[0].disabled, false, 'Colisor permanece sólido durante os 30s de carcaça');
    assert.equal(killFeedbackCalls.length, 1, 'triggerPlayerKillFeedback chamado EXATAMENTE 1 vez');
    assert.equal(killFeedbackCalls[0].opts.killCount, 4, 'Contabiliza os 4 policiais do Caveirão');
    assert.deepEqual(killFeedbackCalls[0].opts.categories, ['police', 'police', 'police', 'police']);
    assert.equal(corpseManager.getActiveCorpseCount(), 2, 'Spawna até 2 corpos carbonizados próximos da carcaça');

    // Avança 29.0s -> carcaça ainda visível; avança +1.5s (30.5s) -> carcaça some e desativa colisor!
    for (let s = 0; s < 29; s++) destructibles.update(1.0, controller.position);
    assert.equal(bopeCar.isBurnedWreck, true);
    assert.equal(bopeCar.mesh.visible, true);

    destructibles.update(1.5, controller.position);
    assert.equal(bopeCar.isBurnedWreck, false, 'isBurnedWreck limpo após 30s');
    assert.equal(bopeCar.mesh.visible, false, 'Malha da carcaça oculta após 30s');
    assert.equal(bopeCar.colliders[0].disabled, true, 'Colisor desativado após os 30s');

    // Viatura que JÁ desembarcou seus 2 policiais a pé (deployShelteredFootOfficers) tem 0 ocupantes e dá 0 kills!
    ws.clearWanted('reset');
    ws.pursuitVehicles.forEach((v) => destructibles.unregisterDestructible(v.carObj));
    ws.pursuitVehicles.length = 0;
    ws.setWantedStars(2);
    while (ws.pursuitVehicles.length > 1) {
      const extra = ws.pursuitVehicles.pop();
      destructibles.unregisterDestructible(extra.carObj);
    }
    const cruiser = ws.pursuitVehicles[0];
    cruiser.carObj.mesh.position.set(0, 0, 18.0);
    cruiser.heading = Math.PI;
    cruiser.speed = 12.0;
    assert.equal(getAliveOccupantCount(cruiser.carObj), 2, 'Cruiser chega com 2 policiais');

    ws._spawnTickTimer = 99;
    ws._updatePursuitVehicles(0.1, controller.position, controller);
    assert.equal(ws.footUnits.length, 2, 'Cruiser desembarcou os 2 policiais a pé');
    assert.equal(getAliveOccupantCount(cruiser.carObj), 0, 'Cruiser desembarcado fica com 0 ocupantes vivos');

    // Policiais a pé avançam para longe da viatura vazia (> 15m fora do raio de explosão)
    for (const officer of ws.footUnits) {
      officer.mesh.position.set(0, 0, -5.0);
      officer.obj.basePos.copy(officer.mesh.position);
    }

    const killsBeforeEmptyExplosion = killFeedbackCalls.length;
    destructibles.damageObject(cruiser.carObj, 9999, cruiser.carObj.mesh.position);
    assert.equal(
      killFeedbackCalls.length,
      killsBeforeEmptyExplosion,
      'Explodir viatura vazia que já desembarcou tropas rende ZERO kills!'
    );

    // Abater Helicóptero Águia inicia queda giratória (_crashingHelis) e credita 2 kills no impacto!
    ws.setWantedStars(3);
    const heli = ws.policeHelicopters[0];
    assert.ok(heli);
    heli.mesh.position.set(30, 22, -60);
    const killsBeforeHeli = killFeedbackCalls.length;
    destructibles.damageObject(heli.obj, 9999, heli.mesh.position);
    assert.equal(destructibles._crashingHelis.length, 1, 'Helicóptero entra em queda giratória fumegante');
    for (let t = 0; t < 20; t++) destructibles.update(0.1, controller.position);
    assert.equal(destructibles._crashingHelis.length, 0, 'Helicóptero colidiu com o solo e explodiu');
    assert.equal(killFeedbackCalls.length, killsBeforeHeli + 1, 'Queda do Águia credita multi-kill única');
    assert.deepEqual(killFeedbackCalls[killFeedbackCalls.length - 1].opts.categories, ['police', 'police']);

    assert.equal(countSceneLights(scene), initialLightCount, 'Zero THREE.Light adicionadas em explosões/carcaças');
  });

  it('4. Explosão em cadeia: explodir Carro A (a 2.5m do Carro B) explode o Carro B automaticamente', () => {
    const { world, destructibles, killFeedbackCalls } = createVehicleTestHarness();

    const carA = spawnCustomTestCar(world, destructibles, { x: 0, z: 0, type: 'sedan_familiar', hp: 160 });
    const carB = spawnCustomTestCar(world, destructibles, { x: 2.5, z: 0, type: 'Buggy', hp: 150 });
    attachVehicleOccupants(carA, { source: 'traffic', carType: 'sedan_familiar', seedIndex: 1 }); // 1 civil
    attachVehicleOccupants(carB, { source: 'traffic', carType: 'buggy_praia', seedIndex: 0 });    // 2 civis

    destructibles.damageObject(carA, 999, carA.basePos);

    assert.equal(carA.destroyed, true, 'Carro A explodiu');
    assert.equal(carB.destroyed, true, 'Carro B a 2.5m explodiu em reação em cadeia!');
    assert.equal(carB.isBurnedWreck, true, 'Carro B também virou carcaça carbonizada');
    const totalKilledCivs = killFeedbackCalls.reduce((acc, c) => acc + (c.opts.killCount || 0), 0);
    assert.equal(totalKilledCivs, 3, 'Mortes de ocupantes de ambos os carros da reação em cadeia somadas');
  });

  it('5. Jogador que permanece dentro do carro em chamas após 4.0s é ejetado e sofre dano letal / DETIDO', () => {
    const { world, destructibles, livingCity, ws, controller, banners } = createVehicleTestHarness();

    // Caso A: Sem polícia (0★) -> ejetado + nocauteado (playerHp = 0)
    const car0 = spawnCustomTestCar(world, destructibles, { x: 10, z: 10, type: 'sedan_familiar', hp: 200 });
    controller.enterVehicle(car0);
    destructibles.damageObject(car0, 180, car0.basePos); // 20/200 HP -> 10% -> engine_fire!
    assert.equal(car0.isBurning, true);
    assert.ok(banners.some((b) => b.title.includes('MOTOR EM CHAMAS')), 'Aviso de motor em chamas exibido ao jogador');

    for (let s = 0; s < 42; s++) destructibles.update(0.1, controller.position);
    assert.equal(car0.destroyed, true, 'Carro explodiu após expirar os 4.0s');
    assert.equal(controller.currentVehicle, null, 'Jogador foi ejetado do carro em explosão');
    assert.equal(livingCity.playerHp, 0, 'Jogador recebeu dano letal imediato na explosão');
    assert.equal(controller._lastVehicleExplosionOutcome, 'knockout');

    // Caso B: Procurado (2★) -> ejetado + DETIDO (BUSTED)!
    ws.setWantedStars(2);
    const carWanted = spawnCustomTestCar(world, destructibles, { x: -20, z: 10, type: 'sedan_familiar', hp: 200 });
    controller.enterVehicle(carWanted);
    destructibles.damageObject(carWanted, 180, carWanted.basePos);
    for (let s = 0; s < 42; s++) destructibles.update(0.1, controller.position);

    assert.equal(controller.currentVehicle, null, 'Jogador ejetado antes da prisão');
    assert.equal(ws.stars, 0, 'Explodir dentro do carro durante perseguição aciona DETIDO e limpa estrelas');
    assert.equal(ws.lastClearReason, 'busted', 'Motivo registrado como busted');
    assert.equal(controller._lastVehicleExplosionOutcome, 'busted');
  });
});
