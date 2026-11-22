import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { WantedPursuitSystem } = await import('../src/world/WantedPursuitSystem.js');
const { STAR_FORCE_BUDGET, DISPATCH_RULES } = await import('../src/world/police/PursuitTuning.js');
const {
  NS_AVENUES_X,
  EW_AVENUES_Z,
  ensurePoliceRoadGraph,
  findNearestRoadNode,
  findRoadPathAStar
} = await import('../src/world/police/PoliceRoadGraph.js');

function createDispatchHarness({ buildings = [], waterPredicate = null } = {}) {
  const scene = new THREE.Scene();
  const hud = {
    totalStuds: 5000,
    displayedStuds: 5000,
    _lastController: null,
    updateWantedHud() {},
    showWantedBanner() {},
    setPlayerHealth() {},
    addStuds(amount) {
      this.totalStuds += amount;
    }
  };
  const destructibles = new DestructibleManager(scene, hud);
  const colliders = [];

  const world = {
    scene,
    colliders,
    atmosphere: { nightFactor: 0 },
    mapBuildings: buildings.slice(),
    elevatedDecks: [],
    addCollider(x, z, w, d, maxY, minY) {
      const col = {
        minX: x - w * 0.5,
        maxX: x + w * 0.5,
        minZ: z - d * 0.5,
        maxZ: z + d * 0.5,
        minY,
        maxY
      };
      colliders.push(col);
      return col;
    },
    getTerrainHeightAt: () => 0,
    getSurfaceHeightAt: () => 0,
    isDeepWaterAt(x, z, opts) {
      return waterPredicate ? Boolean(waterPredicate(x, z, opts)) : false;
    }
  };

  const livingCity = {
    world,
    scene,
    destructibles,
    hud,
    playerHp: 100,
    playerMaxHp: 100,
    _findSafeStreetSpawn: (x, z) => ({ x, z })
  };

  const controller = {
    position: new THREE.Vector3(0, 0.5, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    stealthTimer: 0,
    currentVehicle: null,
    vehicleSpeed: 0,
    vehicleHeading: 0,
    operatorAbilities: { isStealthed: () => false },
    getHorizontalSpeed() {
      return this.currentVehicle
        ? Math.abs(this.vehicleSpeed)
        : Math.hypot(this.velocity.x, this.velocity.z);
    }
  };
  hud._lastController = controller;

  const ws = new WantedPursuitSystem(livingCity);
  livingCity.wantedSystem = ws;
  return { scene, world, destructibles, hud, controller, ws };
}

describe('GTA V POLICE ROAD GRAPH A*, OUT-OF-SIGHT DISPATCH, PIT/BOX-IN & 5★ ARMY TANKS (ONDA 2)', () => {
  it('1. PoliceRoadGraph constrói cruzamentos secos em cache e findRoadPathAStar desvia de quarteirões/água pelas avenidas', () => {
    const { ws, world } = createDispatchHarness({
      // Bloqueia o trecho direto na Av. X = 0 entre Z = -117 e Z = 0, forçando desvio multi-avenida!
      buildings: [
        { x: 0, z: -60, w: 28, d: 28, height: 60 },
        { x: 60, z: -60, w: 70, d: 70, height: 55 }
      ],
      waterPredicate: (x, z) => x === -516 && z === 710
    });

    const graph1 = ensurePoliceRoadGraph(ws);
    const graph2 = ensurePoliceRoadGraph(ws);
    assert.strictEqual(graph1, graph2, 'Grafo viário fica em cache em ws._roadGraph');
    assert.ok(graph1.nodes.length >= 70, `Grafo possui malha densa de cruzamentos (${graph1.nodes.length})`);

    // Nó submerso (-516, 710) filtrado; extensões do Aeroporto (-1036, 0) e Ilha da Prisão (720, 520) presentes!
    assert.equal(
      graph1.nodes.some((n) => n.x === -516 && n.z === 710),
      false,
      'Interseções em água profunda são filtradas'
    );
    assert.ok(
      findNearestRoadNode(graph1, -1036, 0, (n) => n.x === -1036 && n.z === 0),
      'Extensão rodoviária Oeste para o Aeroporto (-1036, 0) conectada'
    );
    assert.ok(
      findNearestRoadNode(graph1, 720, 520, (n) => n.x === 720 && n.z === 520),
      'Ponte Sudeste para a Ilha da Prisão (720, 520) conectada'
    );

    // Rota A* de (0, -252) até (0, 134): como (0, -117)->(0, 0) está bloqueado, deve contornar por X = -120 ou X = 120!
    const path = findRoadPathAStar(graph1, 0, -252, 0, 134);
    assert.ok(path.length >= 5, `Caminho multi-avenida encontrado com ${path.length} waypoints`);
    assert.deepEqual(path[0], { x: 0, z: -252 });
    assert.deepEqual(path[path.length - 1], { x: 0, z: 134 });

    for (let i = 0; i < path.length; i++) {
      const wp = path[i];
      const onAvenue = NS_AVENUES_X.includes(wp.x) || EW_AVENUES_Z.includes(wp.z);
      assert.equal(onAvenue, true, `Waypoint (${wp.x}, ${wp.z}) pertence a uma avenida real`);
      if (i > 0) {
        const prev = path[i - 1];
        const orthogonal = Math.abs(wp.x - prev.x) < 0.01 || Math.abs(wp.z - prev.z) < 0.01;
        assert.equal(orthogonal, true, 'Segmento A* segue estritamente o alinhamento ortogonal da rua');
        assert.equal(
          ws._isSegmentBlockedByBuilding(prev.x, prev.z, wp.x, wp.z),
          false,
          'Nenhum segmento do caminho A* atravessa prédio'
        );
      }
    }
    assert.ok(
      path.some((wp) => wp.x === -120 || wp.x === 120),
      'A* contorna o bloqueio pela avenida paralela adjacente'
    );

    // Caminho até a Ilha da Prisão
    const prisonPath = findRoadPathAStar(graph1, 384, 384, 720, 520);
    assert.deepEqual(prisonPath[prisonPath.length - 1], { x: 720, z: 520 });
    assert.equal(world.isDeepWaterAt(prisonPath[0].x, prisonPath[0].z, { forCar: true }), false);
  });

  it('2. Reforços NUNCA nascem a < 120m do jogador E NUNCA visíveis dentro do frustum frontal da câmera', () => {
    const { ws, controller } = createDispatchHarness({
      // Sem prédios inicialmente para testar rejeição pura de frustum desobstruído!
      buildings: []
    });

    const testPoses = [
      { x: 0, z: 0, yaw: 0 },
      { x: -120, z: -117, yaw: Math.PI * 0.5 },
      { x: 252, z: 134, yaw: Math.PI },
      { x: -252, z: 0, yaw: -Math.PI * 0.35 }
    ];

    for (const pose of testPoses) {
      controller.position.set(pose.x, 0.5, pose.z);
      controller.yaw = pose.yaw;
      const camFwd = { x: -Math.sin(pose.yaw), z: -Math.cos(pose.yaw) };

      for (let k = 0; k < 12; k++) {
        const sp = ws._findPursuitSpawnPos(controller.position, 125, 195, k % 2 === 0, camFwd);
        const dx = sp.x - pose.x;
        const dz = sp.z - pose.z;
        const dist = Math.hypot(dx, dz);
        const dotCam = (dx * camFwd.x + dz * camFwd.z) / dist;
        const blocked = ws._isSegmentBlockedByBuilding(sp.x, sp.z, pose.x, pose.z);

        assert.ok(
          dist >= 120.0 && dist <= 210.0,
          `Spawn fora de alcance mínimo/máximo [120, 210]m: dist=${dist.toFixed(2)}m`
        );
        assert.ok(
          blocked || dotCam <= 0.48,
          `Spawn proibido no frustum frontal desobstruído! dotCam=${dotCam.toFixed(3)}`
        );
      }
    }
  });

  it('3. STAR_FORCE_BUDGET estrito em 1★..5★ (Tanques Titan-M1 em 5★ disparando tank_shell e metade do orçamento em SEARCH)', () => {
    const { ws, controller } = createDispatchHarness();
    controller.position.set(0, 0.5, -117);
    ws._lastPlayerPos.copy(controller.position);

    for (let star = 1; star <= 5; star++) {
      ws.clearWanted('reset');
      ws.setWantedStars(star);

      // Roda vários ciclos de despacho mantendo perseguição ativa
      for (let tick = 0; tick < 12; tick++) {
        ws.enterPursuitState(controller.position);
        ws._spawnTickTimer = 0;
        ws.update(0.25, controller.position, controller);
      }

      const budget = STAR_FORCE_BUDGET[star];
      const activeCars = ws._getActivePoliceCarCount();
      const activeTanks = ws._getActivePoliceTankCount();
      const activeHelis = ws.policeHelicopters.length;

      assert.equal(activeCars, budget.cars, `${star}★ respeita orçamento exato de ${budget.cars} viaturas`);
      assert.equal(activeTanks, budget.tanks, `${star}★ respeita orçamento exato de ${budget.tanks} tanques`);
      assert.equal(activeHelis, budget.helis, `${star}★ respeita orçamento exato de ${budget.helis} helicópteros`);
    }

    // Valida Tanques Militares 5★ disparando 'tank_shell' quando a 14m–125m com linha de visão livre
    const tanks = ws.pursuitVehicles.filter((v) => v.isTank);
    assert.equal(tanks.length, 2, '5★ mantém exatamente 2 Tanques Militares ativos');
    assert.equal(tanks[0].role, 'army_tank');
    assert.equal(tanks[0].carObj.mesh.userData.carType, 'tanque_titan');

    const tank = tanks[0];
    tank.carObj.mesh.position.set(0, 0, -55); // ~62m de (0, 0.5, -117), linha de visão livre
    tank.cannonCooldown = 0.05;
    ws.enterPursuitState(controller.position);
    ws._clearAllEnemyProjectiles();
    ws._updatePursuitVehicles(0.1, controller.position, controller);

    const shellProj = ws.enemyProjectiles.find((p) => p.kind === 'tank_shell');
    assert.ok(shellProj, 'Tanque Militar 5★ dispara projétil explosivo tank_shell na cadência de 3.3s');
    assert.ok(Math.abs(tank.cannonCooldown - 3.3) < 0.05, 'Recarga de 3.3s aplicada após disparo do canhão');

    // Limpar nível de procurado remove os tanques imediatamente
    ws.clearWanted('reset');
    assert.equal(ws.pursuitVehicles.some((v) => v.isTank), false, '_clearAllPoliceTanks limpa todos os tanques');

    // Em SEARCH (isEscaping === true), teto de despacho cai pela metade e ZERO novos tanques nascem!
    ws.setWantedStars(5);
    ws.pursuitVehicles.forEach((v) => ws.destructibles.unregisterDestructible(v.carObj));
    ws.pursuitVehicles.length = 0;
    ws.enterSearchState();
    assert.equal(ws.isEscaping, true);

    for (let tick = 0; tick < 8; tick++) {
      ws._spawnTickTimer = 0;
      ws._updatePursuitVehicles(0.1, controller.position, controller);
      // Despacha no estado SEARCH
      const desiredSearchCars = ws._getDesiredVehicleCount();
      assert.equal(
        desiredSearchCars,
        Math.ceil(STAR_FORCE_BUDGET[5].cars * DISPATCH_RULES.searchBudgetFactor),
        'Orçamento de carros em SEARCH reduzido em 50%'
      );
      ws._spawnPursuitVehicle(controller.position);
      ws._spawnPoliceTank(controller.position);
    }

    assert.equal(ws._getActivePoliceCarCount(), 3, 'SEARCH em 5★ limita despacho a 3 viaturas (50% de 6)');
    assert.equal(ws._getActivePoliceTankCount(), 0, 'SEARCH não despacha novos Tanques Militares');
  });

  it('4. Zero teletransporte > 180m atrás (supercarro a 75 m/s abre distância real) e despawn automático > 250m fora de visão', () => {
    const { ws, controller } = createDispatchHarness();
    controller.position.set(0, 0.5, 0);
    controller.yaw = 0; // Câmera olhando para -Z
    controller.currentVehicle = { id: 'apex_gtx_test' };
    controller.vehicleSpeed = 75.0;
    controller.vehicleHeading = Math.PI; // Correndo para -Z a 75 m/s!

    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(2);
    // Isola 1 viatura exatamente 185m atrás do jogador na Av. X = 0
    while (ws.pursuitVehicles.length > 1) {
      const extra = ws.pursuitVehicles.pop();
      ws.destructibles.unregisterDestructible(extra.carObj);
    }
    const cruiser = ws.pursuitVehicles[0];
    cruiser.carObj.mesh.position.set(0, 0, 185.0);
    cruiser.heading = Math.PI; // Indo para -Z atrás do jogador
    cruiser.speed = cruiser.maxSpeed;

    // Avança 0.5s: viatura a > 180m NUNCA teletransporta e respeita teto maxSpeed * 1.15!
    const maxAllowedSpd = cruiser.maxSpeed * (1 + DISPATCH_RULES.maxCatchupBonus) + 0.05;
    for (let step = 0; step < 5; step++) {
      controller.position.z -= 75.0 * 0.1;
      ws._spawnTickTimer = 99;
      ws._updatePursuitVehicles(0.1, controller.position, controller);
      assert.ok(
        cruiser.speed <= maxAllowedSpd,
        `Velocidade da viatura (${cruiser.speed.toFixed(2)}) respeita teto ${maxAllowedSpd.toFixed(2)}`
      );
    }

    const gapAfterHalfSec = Math.hypot(
      cruiser.carObj.mesh.position.x - controller.position.x,
      cruiser.carObj.mesh.position.z - controller.position.z
    );
    assert.ok(
      gapAfterHalfSec > 195.0 && gapAfterHalfSec < 245.0,
      `Supercarro a 75 m/s abre vantagem real sem teletransporte policial (gap=${gapAfterHalfSec.toFixed(1)}m)`
    );
    assert.equal(ws.pursuitVehicles.includes(cruiser), true, 'Ainda ativa antes de cruzar 250m');

    // Continua acelerando até abrir > 250m atrás da câmera -> despawn limpo e incremento de lostVehiclesCount!
    const prevLost = ws.lostVehiclesCount || 0;
    for (let step = 0; step < 20; step++) {
      controller.position.z -= 75.0 * 0.1;
      ws._spawnTickTimer = 99;
      ws._updatePursuitVehicles(0.1, controller.position, controller);
    }

    assert.equal(ws.pursuitVehicles.includes(cruiser), false, 'Viatura > 250m atrás da câmera foi despawnada');
    assert.equal(cruiser.carObj.destroyed, true, 'carObj desregistrado no DestructibleManager');
    assert.equal(ws.lostVehiclesCount, prevLost + 1, 'Contador lostVehiclesCount incrementado');
  });

  it('5. Viaturas param de lado (broadside) a 15–20m quando jogador está a pé e executam PIT / Box-In em 3★+ contra carro', () => {
    const { ws, controller } = createDispatchHarness();

    // PARTE A: Jogador a pé em (0, 0.5, 0) -> viatura se aproxima e para virada de lado entre 15m e 20m!
    controller.position.set(0, 0.5, 0);
    controller.currentVehicle = null;
    controller.vehicleSpeed = 0;
    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(2);

    while (ws.pursuitVehicles.length > 1) {
      const extra = ws.pursuitVehicles.pop();
      ws.destructibles.unregisterDestructible(extra.carObj);
    }
    const footCruiser = ws.pursuitVehicles[0];
    footCruiser.carObj.mesh.position.set(0, 0, 34.0);
    footCruiser.heading = Math.PI; // Apontando para (0, 0)
    footCruiser.speed = 24.0;
    footCruiser.deployedTroops = false;

    for (let step = 0; step < 40; step++) {
      ws._spawnTickTimer = 99;
      ws._updatePursuitVehicles(0.08, controller.position, controller);
    }

    const stopDist = Math.hypot(
      footCruiser.carObj.mesh.position.x - controller.position.x,
      footCruiser.carObj.mesh.position.z - controller.position.z
    );
    assert.ok(
      stopDist >= 15.0 && stopDist <= 20.5,
      `Viatura parou na zona tática de 15–20m (stopDist=${stopDist.toFixed(2)}m, nunca em cima do jogador)`
    );
    assert.ok(footCruiser.speed < 0.5, `Viatura freou totalmente (speed=${footCruiser.speed.toFixed(2)})`);
    assert.equal(footCruiser.parkedBroadside, true, 'Viatura entrou em postura broadside');

    const angleToPlayer = Math.atan2(
      controller.position.x - footCruiser.carObj.mesh.position.x,
      controller.position.z - footCruiser.carObj.mesh.position.z
    );
    let yawDiffFromBroadside = Math.abs(footCruiser.heading - angleToPlayer);
    while (yawDiffFromBroadside > Math.PI) yawDiffFromBroadside = Math.abs(yawDiffFromBroadside - Math.PI * 2);
    assert.ok(
      yawDiffFromBroadside > 0.95 && yawDiffFromBroadside < 1.75,
      `Viatura virou de lado (~1.35 rad) para servir de escudo (diff=${yawDiffFromBroadside.toFixed(2)} rad)`
    );
    assert.ok(ws.footUnits.length >= 1, 'Desembarcou policiais no lado abrigado da viatura');
    const officerDist = Math.hypot(
      ws.footUnits[0].mesh.position.x - controller.position.x,
      ws.footUnits[0].mesh.position.z - controller.position.z
    );
    assert.ok(officerDist > stopDist, 'Policial desembarcou no lado abrigado atrás da carroceria da viatura');

    // PARTE B: Jogador de carro em 3★+ -> Box-In (4 slots distintos), frenagem em curva 90° e PIT!
    ws.clearWanted('reset');
    ws.pursuitVehicles.forEach((v) => ws.destructibles.unregisterDestructible(v.carObj));
    ws.pursuitVehicles.length = 0;

    controller.position.set(0, 0.5, 0);
    controller.currentVehicle = { id: 'player_sedan' };
    controller.vehicleHeading = 0; // Indo para +Z
    controller.vehicleSpeed = 24.0;
    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(3);

    while (ws._getActivePoliceCarCount() < 4) {
      ws._spawnPursuitVehicle(controller.position);
    }
    const activeCruisers = ws.pursuitVehicles.filter((v) => !v.retreating && !v.isTank).slice(0, 4);
    for (let k = 0; k < 4; k++) {
      activeCruisers[k].carObj.mesh.position.set((k - 1.5) * 6.0, 0, -20.0);
    }
    ws._updatePursuitVehicles(0.05, controller.position, controller);

    const modes = activeCruisers.map((v) => v.tacticalTarget?.mode).sort();
    assert.deepEqual(
      modes,
      ['box_front', 'box_left', 'box_right', 'pit_rear'],
      '3★+ coordena 4 viaturas nos slots distintos de Box-In (traseira PIT, flancos ±2.9m e frente +8.5m)'
    );

    const frontUnit = activeCruisers.find((v) => v.tacticalTarget?.mode === 'box_front');
    assert.ok(Math.abs(frontUnit.tacticalTarget.z - 8.5) < 0.05, 'Slot frontal mira +8.5m à frente do jogador');

    // Curva fechada > 0.55 rad reduz velocidade para faixa de curva (~16–21 m/s) e aplica driftSlip!
    frontUnit.carObj.mesh.position.set(-30, 0, 0);
    frontUnit.heading = Math.PI; // 90° em relação ao alvo em (+0, +8.5)
    frontUnit.speed = 35.0;
    for (let s = 0; s < 5; s++) ws._updatePursuitVehicles(0.1, controller.position, controller);
    assert.ok(frontUnit.speed < 25.0, 'Viatura reduz velocidade ao atacar curva fechada de 90°');
    assert.ok(Math.abs(frontUnit.driftSlip) > 0.01, 'Escorregamento visual de carroceria (driftSlip) ativo em curva');

    // Contato PIT do slot 0 gira o carro do jogador proporcionalmente à velocidade relativa
    const pitUnit = activeCruisers.find((v) => v.tacticalTarget?.mode === 'pit_rear');
    pitUnit.carObj.mesh.position.set(2.0, 0, -2.2);
    pitUnit.heading = 0;
    pitUnit.speed = 38.0; // relSpeed = 14 m/s vs 24 m/s do jogador
    pitUnit.pitCooldown = 0;
    const headingBefore = controller.vehicleHeading;
    ws._updatePursuitVehicles(0.05, controller.position, controller);

    const spinApplied = Math.abs(controller.vehicleHeading - headingBefore);
    assert.ok(
      spinApplied >= 0.18 && spinApplied <= 0.52,
      `PIT aplicou giro angular proporcional à velocidade relativa (${spinApplied.toFixed(3)} rad)`
    );
    assert.ok(controller.vehicleSpeed < 24.0, 'PIT reduziu velocidade do carro atingido');
  });

  it('6. Onda 2 Tática a Pé (1★ Voz de Prisão sem atirar + escalada p/ 2★ ao atirar, Cobertura/Flanco) & Barreira com Tapete de Pregos', () => {
    const { ws, controller } = createDispatchHarness();
    controller.position.set(0, 0.5, -120);
    controller.currentVehicle = null;

    // 1★ a pé sem atirar: policial se aproxima dando voz de prisão sem disparar tiros e prende em ~2s!
    ws.setWantedStars(1);
    const cop = ws._spawnFootTrooper({ x: 0, y: 0, z: -116 }, 1);
    assert.ok(cop, 'Policial a pé spawnado em 1★');
    for (let step = 0; step < 26; step++) {
      ws._updateFootUnits(0.1, controller.position, controller);
      if (ws.stars === 0) break;
    }
    assert.equal(ws.enemyProjectiles.length, 0, 'Em 1★ sem hostilidade, policiais tentam prender sem atirar');
    assert.equal(ws.lastClearReason, 'busted', 'Permanecer parado perto do policial em 1★ resulta em prisão (BUSTED)');

    // Se o jogador atirar durante 1★, escala imediatamente para 2★ e a polícia abre fogo!
    controller.position.set(0, 0.5, -120);
    ws.setWantedStars(1);
    ws._spawnFootTrooper({ x: 0, y: 0, z: -102 }, 1);
    ws._spawnFootTrooper({ x: 4, y: 0, z: -102 }, 1);
    ws.notifyPlayerGunshot(controller.position);
    ws._updateFootUnits(0.1, controller.position, controller);
    assert.equal(ws.stars, 2, 'Disparar arma em 1★ escala imediatamente para 2★');
    const roles = ws.footUnits.map((f) => f.tacticalRole);
    assert.ok(roles.includes('suppressor') && roles.includes('flanker'), 'Dupla policial divide papéis em suppressor + flanker');

    // 3★ Barreira Policial com Tapete de Pregos fura pneu (puncturedTires = true) quando carro passa em cima, mas não no ar!
    ws.setWantedStars(3);
    ws._playerVelDir.set(0, 0, 1);
    const spawnedRb = ws._trySpawnRoadblockAhead(new THREE.Vector3(0, 0.5, -172));
    assert.equal(spawnedRb, true, '3★ monta barreira prevista 150–245m à frente na avenida');
    const rb = ws.roadblocks[0];
    assert.ok(rb && rb.spikeStripBox, 'Barreira de 3★ inclui Tapete de Pregos (spikeStripBox)');

    const testCar = {
      destroyed: false,
      mesh: Object.assign(new THREE.Group(), { userData: { vehicleSpec: { maxForward: 60, turboSpeed: 75 } } })
    };
    controller.currentVehicle = testCar;
    controller.vehicleSpeed = 28;

    // Saltando de rampa (Y alto) -> NÃO fura o pneu!
    testCar.mesh.position.set(rb.spikeStripBox.x, rb.y + 2.5, rb.spikeStripBox.z);
    ws._updateRoadblocks(0.05, testCar.mesh.position, controller);
    assert.equal(Boolean(testCar.mesh.userData.puncturedTires), false, 'Saltar por cima do tapete de pregos não fura pneu');

    // Passando no chão por cima dos pregos -> FURA O PNEU!
    testCar.mesh.position.set(rb.spikeStripBox.x, rb.y + 0.3, rb.spikeStripBox.z);
    ws._updateRoadblocks(0.05, testCar.mesh.position, controller);
    assert.equal(testCar.mesh.userData.puncturedTires, true, 'Passar por cima do tapete de pregos fura os pneus do carro');
  });
});
