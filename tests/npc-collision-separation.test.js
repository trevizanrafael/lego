import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { WantedPursuitSystem } = await import('../src/world/WantedPursuitSystem.js');
const { FactionWarSystem } = await import('../src/world/FactionWarSystem.js');
const { worldSpatialColliderMethods } = await import('../src/world/core/WorldSpatialColliderGrid.js');
const { trafficNetworkAndVehicleAIMethods } = await import('../src/world/living-city/TrafficNetworkAndVehicleAI.js');
const { pedestrianBehaviorAndReactionsMethods } = await import('../src/world/living-city/PedestrianBehaviorAndReactions.js');

function createCollisionNpcHarness() {
  const scene = new THREE.Scene();
  const hud = {
    totalStuds: 5000,
    displayedStuds: 5000,
    _lastController: null,
    heartsContainer: { classList: { remove() {} } },
    updateWantedHud() {},
    showWantedBanner() {},
    setPlayerHealth() {},
    addStuds(amount) { this.totalStuds += amount; }
  };
  const destructibles = new DestructibleManager(scene, hud);

  const world = {
    scene,
    colliders: [],
    _colliderGrid: new Map(),
    _dynamicColliders: [],
    colliderCellSize: 32,
    _colliderQueryId: 0,
    atmosphere: { nightFactor: 0 },
    mapBuildings: [],
    elevatedDecks: [],
    territoryInfra: {},
    getTerrainHeightAt: () => 0,
    getSurfaceHeightAt: () => 0,
    getRoadElevation: () => 0,
    isDeepWaterAt: () => false
  };
  Object.assign(world, worldSpatialColliderMethods);

  const livingCity = {
    world,
    scene,
    destructibles,
    hud,
    playerHp: 380,
    playerMaxHp: 380,
    playerFaction: 'cv',
    trafficVehicles: [],
    pedestrians: [],
    combatNpcs: [],
    npcProjectiles: [],
    activeWarzones: [],
    _findSafeStreetSpawn: (x, z) => ({ x, z }),
    _isInsideBuilding: () => false,
    _resolveBuildingCollision: (x, z) => ({ x, z, collided: false }),
    _isValidDryLandForPedestrian: () => true,
    _getPedestrianGroundY: (_x, _z, ty) => ty,
    _syncPedestrianInstances() {}
  };
  Object.assign(livingCity, trafficNetworkAndVehicleAIMethods, pedestrianBehaviorAndReactionsMethods);

  const controller = {
    position: new THREE.Vector3(0, 0.5, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    yaw: 0,
    stealthTimer: 0,
    isGrounded: true,
    isFlying: false,
    currentVehicle: null,
    vehicleSpeed: 0,
    vehicleHeading: 0,
    operatorAbilities: { isStealthed: () => false, isProjectileBlocked: () => false },
    getHorizontalSpeed() {
      return this.currentVehicle
        ? Math.abs(this.vehicleSpeed)
        : Math.hypot(this.velocity.x, this.velocity.z);
    }
  };
  hud._lastController = controller;

  const ws = new WantedPursuitSystem(livingCity);
  livingCity.wantedSystem = ws;
  return { scene, world, destructibles, hud, livingCity, controller, ws };
}

function minPairwiseDistance2D(positions) {
  let minD = Infinity;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const d = Math.hypot(positions[i].x - positions[j].x, positions[i].z - positions[j].z);
      if (d < minD) minD = d;
    }
  }
  return minD;
}

describe('NPC COLLISION, DYNAMIC OBB SYNC, AGENT SEPARATION & DISTINCT FORMATION SLOTS (ONDA 2)', () => {
  it('1. 6 viaturas policiais próximas convergindo no mesmo _lastKnownPlayerPos em SEARCH se separam (>= 3.8m) e sincronizam pv.col como OBB rotacionado', () => {
    const { ws, world, controller } = createCollisionNpcHarness();

    // Parede sólida próxima à área de busca para validar colisão contínua OBB sem penetração
    const bankWall = world.addCollider(-10.0, 0.0, 4.0, 26.0, 12.0, 0.0, { tag: 'bank-wall' });

    ws.setWantedStars(5);
    ws._clearAllPoliceTanks();
    while (ws._getActivePoliceCarCount() < 6) {
      ws._spawnPursuitVehicle(controller.position);
    }
    const cruisers = ws.pursuitVehicles.filter((v) => !v.isTank && !v.retreating).slice(0, 6);
    assert.equal(cruisers.length, 6, '6 viaturas policiais ativas para o teste');

    // Empilha as 6 viaturas coladas em torno de (18, 0, -28) apontando para _lastKnownPlayerPos = (0, 0, 0)
    for (let i = 0; i < cruisers.length; i++) {
      const pv = cruisers[i];
      const jitterX = (i % 3) * 0.25;
      const jitterZ = Math.floor(i / 3) * 0.25;
      pv.carObj.mesh.position.set(18.0 + jitterX, 0, -28.0 + jitterZ);
      pv.heading = Math.atan2(-(18.0 + jitterX), 28.0 - jitterZ);
      pv.speed = 20.0;
    }

    // Jogador escondido fora dos cones (< 250m para não despawnar) enquanto as 6 viaturas convergem em SEARCH sobre (0, 0, 0)
    ws._lastKnownPlayerPos.set(0, 0, 0);
    ws.enterSearchState();
    controller.position.set(115, 0.5, 115);

    for (let step = 0; step < 50; step++) {
      ws._updatePursuitVehicles(0.05, controller.position, controller);
    }

    assert.equal(ws.pursuitVehicles.length, 6, 'Todas as 6 viaturas permanecem ativas em SEARCH');

    const activePositions = cruisers.map((pv) => pv.carObj.mesh.position);
    const minCruiserDist = minPairwiseDistance2D(activePositions);
    assert.ok(
      minCruiserDist >= 3.8,
      `6 viaturas nunca empilham em SEARCH (min pairwise dist = ${minCruiserDist.toFixed(2)}m >= 3.8m)`
    );

    for (let i = 0; i < cruisers.length; i++) {
      const pv = cruisers[i];
      assert.equal(pv.col.shapeType, 'obb', `Viatura ${i} sincronizou pv.col.shapeType === 'obb'`);
      assert.equal(pv.col.isDynamic, true, `Viatura ${i} promoveu pv.col para dinâmico`);
      assert.ok(Math.abs(pv.col.halfX - 1.32) < 1e-4 && Math.abs(pv.col.halfZ - 2.45) < 1e-4);

      const hits = world.overlapOrientedBox(
        pv.carObj.mesh.position.x,
        pv.carObj.mesh.position.z,
        1.28,
        2.4,
        pv.heading,
        0.4,
        1.8,
        { filter: (col) => col === bankWall }
      );
      assert.equal(hits.length, 0, `Viatura ${i} respeitou parede estática via sweepOrientedBox`);
    }
  });

  it('2. 6 policiais a pé spawnados no EXATO mesmo (x, z) encostados em parede sólida se separam (>= 1.15m) sem atravessar a parede', () => {
    const { ws, world, controller } = createCollisionNpcHarness();

    // Parede sólida em Z in [-1.0, +1.0], X in [-20, +20]
    const solidWall = world.addCollider(0, 0, 40.0, 2.0, 6.0, 0.0, { tag: 'solid-wall' });

    ws.setWantedStars(3);
    ws._clearAllFootUnits();
    ws.pursuitVehicles.forEach((v) => ws.destructibles.unregisterDestructible(v.carObj));
    ws.pursuitVehicles.length = 0;

    controller.position.set(0, 0.5, 21.0);
    // Spawna 6 policiais exatamente empilhados em (0, 0, 1.55), colados à face Z = +1.0 da parede!
    for (let i = 0; i < 6; i++) {
      const cop = ws._spawnFootTrooper({ x: 0, y: 0, z: 1.55 }, 3);
      assert.ok(cop, `Policial a pé ${i} spawnado`);
    }
    assert.equal(ws.footUnits.length, 6);

    for (let step = 0; step < 30; step++) {
      ws._updateFootUnits(0.05, controller.position, controller);
      for (let i = 0; i < ws.footUnits.length; i++) {
        const p = ws.footUnits[i].mesh.position;
        const pen = world.overlapCapsule({ x: p.x, y: p.y, z: p.z }, 0.45, 2.0, {
          stepUpHeight: 0.36,
          filter: (c) => c === solidWall
        });
        assert.equal(
          pen.length,
          0,
          `Policial ${i} nunca penetrou a parede sólida no frame ${step} (pos=(${p.x.toFixed(2)}, ${p.z.toFixed(2)}))`
        );
      }
    }

    const officerPositions = ws.footUnits.map((fu) => fu.mesh.position);
    const minOfficerDist = minPairwiseDistance2D(officerPositions);
    assert.ok(
      minOfficerDist >= 1.15,
      `6 policiais a pé se separaram de forma limpa (min pairwise dist = ${minOfficerDist.toFixed(2)}m >= 1.15m)`
    );
  });

  it('3. 6 soldados de facção (combatNpcs) convergindo junto a uma parede sólida se separam (>= 1.1m) e deslizam pela parede sem atravessá-la', () => {
    const { world, livingCity, controller } = createCollisionNpcHarness();
    const fw = new FactionWarSystem(livingCity);
    livingCity.factionWar = fw;
    fw.playerFaction = 'cv';
    fw.activeMode = 'INVASION_1V1';
    fw.isInvasionActive = true;

    // Parede diagonal a 30° bloqueando o avanço reto e exigindo deslizamento lateral (wall sliding)
    const angledWall = world.addObbCollider(0, 0, 2.2, 22.0, Math.PI / 6, 6.0, 0.0, { tag: 'angled-wall' });

    // 6 soldados PCC empilhados no mesmo ponto na face +X da parede diagonal, convergindo no jogador mais adiante
    const startX = 2.4;
    const startZ = -6.5;
    for (let i = 0; i < 6; i++) {
      const unit = fw._spawnCombatUnit({
        faction: 'pcc',
        role: i % 3 === 0 ? 'tank' : 'rifleman',
        x: startX,
        z: startZ,
        forceAllied: false
      });
      unit.visual.root.position.set(startX, 0, startZ);
    }
    assert.equal(fw.combatNpcs.length, 6);

    // Jogador posicionado de modo que os soldados precisem deslizar ao longo da parede diagonal (+X, +Z)
    controller.position.set(-2.5, 0.5, 12.0);

    for (let step = 0; step < 48; step++) {
      fw._updateCombatUnitsAndHealBeams(0.05, controller.position, controller, null);
      for (let i = 0; i < fw.combatNpcs.length; i++) {
        const p = fw.combatNpcs[i].visual.root.position;
        const pen = world.overlapCapsule({ x: p.x, y: p.y, z: p.z }, 0.45, 2.0, {
          stepUpHeight: 0.38,
          filter: (c) => c === angledWall
        });
        assert.equal(pen.length, 0, `Soldado ${i} nunca atravessou a parede sólida no passo ${step}`);
      }
    }

    const soldierPositions = fw.combatNpcs.map((n) => n.visual.root.position);
    const minSoldierDist = minPairwiseDistance2D(soldierPositions);
    assert.ok(
      minSoldierDist >= 1.1,
      `6 soldados de facção mantiveram separação mútua (min pairwise dist = ${minSoldierDist.toFixed(2)}m >= 1.1m)`
    );

    const avgZ = soldierPositions.reduce((acc, p) => acc + p.z, 0) / soldierPositions.length;
    assert.ok(
      avgZ > startZ + 2.5,
      `Esquadrão deslizou suavemente ao longo da parede rumo ao alvo (avgZ avançou de ${startZ} para ${avgZ.toFixed(2)})`
    );
  });

  it('4. Trânsito sincroniza tv.col como OBB rotacionado e multidão em pânico se separa sem atravessar prédios', () => {
    const { world, livingCity, destructibles, controller } = createCollisionNpcHarness();

    // Testa atualização dinâmica OBB de carro do trânsito em ângulo
    const tvMesh = new THREE.Group();
    tvMesh.position.set(10, 0, -20);
    tvMesh.rotation.y = Math.PI / 4;
    const tvCol = world.addCollider(10, -20, 2.5, 5.0, 1.85, 0);
    const tvDest = destructibles.registerDestructible({
      mesh: tvMesh, type: 'car', hp: 100, radius: 2.5, height: 1.9, colliders: [tvCol], groundY: 0
    });
    livingCity.trafficVehicles.push({
      mesh: tvMesh,
      destructible: tvDest,
      col1: tvCol,
      brakeLights: [],
      isBraking: false,
      baseW: 2.5,
      baseD: 5.0,
      baseH: 1.9,
      axis: 'x_const',
      roadCoord: 10,
      laneOffset: 0,
      baseLaneOffset: 0,
      targetLaneOffset: 0,
      posAlong: -20,
      dir: 1,
      minC: -100,
      maxC: 100,
      cruiseSpeed: 15,
      currentSpeed: 15,
      cfg: {}
    });

    livingCity._updateUrbanTraffic(0.05, controller.position, controller);
    assert.equal(tvCol.shapeType, 'obb', 'Veículo do trânsito promoveu tv.col para OBB rotacionado');
    assert.equal(tvCol.isDynamic, true, 'tv.col marcado como colisor dinâmico');

    // Testa 5 pedestres empilhados fugindo em pânico contra uma parede sólida
    const pedWall = world.addCollider(0, 8.0, 20.0, 2.0, 6.0, 0.0, { tag: 'ped-wall' });
    for (let i = 0; i < 5; i++) {
      const vis = livingCity._buildCivilianLegoMinifig('casual', i);
      vis.root.position.set(0, 0, 6.2);
      livingCity.pedestrians.push({
        id: i + 1,
        archetype: 'casual',
        visual: vis,
        walkSpeed: 2.2,
        normalFaceKey: 'civ_calm',
        currentFaceKey: 'civ_panic',
        state: 'PANIC',
        panicTimer: 5.0,
        panicDirX: 0,
        panicDirZ: 1.0,
        animTime: 0,
        dir: 1,
        x1: 0, z1: 0, x2: 0, z2: 20
      });
    }

    for (let step = 0; step < 25; step++) {
      livingCity._updatePedestrians(0.05, controller.position, controller);
    }

    const pedPositions = livingCity.pedestrians.map((p) => p.visual.root.position);
    assert.ok(minPairwiseDistance2D(pedPositions) >= 0.85, 'Pedestres em pânico não se fundem numa única malha');
    for (const p of pedPositions) {
      const pen = world.overlapCapsule({ x: p.x, y: p.y, z: p.z }, 0.42, 1.95, {
        stepUpHeight: 0.36,
        filter: (c) => c === pedWall
      });
      assert.equal(pen.length, 0, 'Nenhum pedestre em pânico atravessou a parede');
    }
  });
});
