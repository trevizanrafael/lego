import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const {
  PURSUIT_STATES,
  SEARCH_DURATION_BY_STAR,
  STAR_FORCE_BUDGET,
  VISION_CONES,
  DISPATCH_RULES,
  HELI_TUNING,
  WITNESS_TUNING
} = await import('../src/world/police/PursuitTuning.js');
const {
  doesGroundUnitSeeTarget,
  isIlluminatedByHeliSpotlight,
  isPlayerUnderOverheadCover,
  getPoliceVisionConesSnapshot
} = await import('../src/world/police/PoliceVisionAndPerception.js');
const { tickPursuitEscapeAndHud } = await import(
  '../src/world/police/WantedEscalationAndEscapeRules.js'
);
const { WantedPursuitSystem } = await import('../src/world/WantedPursuitSystem.js');

function createIsolatedPursuitHarness() {
  const scene = new THREE.Scene();
  const world = {
    mapBuildings: [],
    elevatedDecks: [],
    colliders: [],
    atmosphere: { nightFactor: 0 },
    addCollider(x, z, w, d, maxY = 10, minY = 0) {
      const col = {
        minX: x - w * 0.5, maxX: x + w * 0.5,
        minZ: z - d * 0.5, maxZ: z + d * 0.5,
        minY, maxY, disabled: false
      };
      this.colliders.push(col);
      return col;
    },
    getTerrainHeightAt: () => 0,
    getSurfaceHeightAt: () => 0,
    isDeepWaterAt: () => false
  };

  const destructibles = {
    onObjectDamaged: null,
    onObjectDestroyed: null,
    registerDestructible: (cfg) => ({
      ...cfg, destroyed: false, basePos: cfg.mesh?.position?.clone?.() || new THREE.Vector3()
    }),
    unregisterDestructible: (obj) => { if (obj) obj.destroyed = true; },
    _spawnElectricSparks() {},
    spawnFlameTrailParticle() {},
    _triggerExplosion() {}
  };

  const hud = {
    totalStuds: 0,
    displayedStuds: 0,
    lastWanted: null,
    lastBanner: null,
    addStuds(amount) { this.totalStuds += amount; },
    updateWantedHud(stars, isEscaping, escapeTimer, escapeDuration, tier) {
      this.lastWanted = { stars, isEscaping, escapeTimer, escapeDuration, tier };
    },
    showWantedBanner(title, sub, style) { this.lastBanner = { title, sub, style }; },
    setPlayerHealth() {}
  };

  const livingCity = {
    world, scene, destructibles, hud, playerHp: 100, playerMaxHp: 100,
    _findSafeStreetSpawn: (x, z) => ({ x, z })
  };

  return { ws: new WantedPursuitSystem(livingCity), world, hud, scene };
}

function clearSpawnedUnits(ws) {
  ws.pursuitVehicles.length = 0;
  ws.footUnits.length = 0;
  ws.roadblocks.length = 0;
  ws.hunterDrones.length = 0;
  ws.eagleHeli = null;
  if (Array.isArray(ws.policeHelicopters)) ws.policeHelicopters.length = 0;
}

function addMockPoliceCar(ws, x, y, z, heading = 0) {
  const mesh = new THREE.Group();
  mesh.position.set(x, y, z);
  mesh.rotation.y = heading;
  const pv = { carObj: { mesh, destroyed: false, basePos: mesh.position.clone() }, heading, retreating: false };
  ws.pursuitVehicles.push(pv);
  return pv;
}

function addMockFootOfficer(ws, x, y, z, yaw = 0) {
  const mesh = new THREE.Group();
  mesh.position.set(x, y, z);
  mesh.rotation.y = yaw;
  const fu = { mesh, obj: { mesh, destroyed: false, basePos: mesh.position.clone() } };
  ws.footUnits.push(fu);
  return fu;
}

function addMockHelicopter(ws, x, y, z, lookGroundPos = null, groundConeRadius = 40) {
  const mesh = new THREE.Group();
  mesh.position.set(x, y, z);
  const heli = {
    mesh,
    obj: { mesh, destroyed: false, basePos: mesh.position.clone() },
    lookGroundPos: lookGroundPos || new THREE.Vector3(x, 0, z),
    groundConeRadius,
    spotlightActive: true,
    hasVisual: false
  };
  ws.policeHelicopters = ws.policeHelicopters || [];
  ws.policeHelicopters.push(heli);
  ws.eagleHeli = heli;
  return heli;
}

describe('GTA V POLICE PURSUIT TUNING, STATE MACHINE & DIRECTIONAL VISION CONES (ONDA 1)', () => {
  it('0. PursuitTuning exporta constantes imutáveis realistas (BOPE + 2 Helis + Tanques em 5★)', () => {
    assert.equal(Object.isFrozen(PURSUIT_STATES), true);
    assert.deepEqual(SEARCH_DURATION_BY_STAR, [0, 25, 40, 55, 70, 85]);
    assert.equal(STAR_FORCE_BUDGET[1].arrestOnlyUnarmed, true);
    assert.equal(STAR_FORCE_BUDGET[3].helis, 1);
    assert.equal(STAR_FORCE_BUDGET[4].helis, 2);
    assert.equal(STAR_FORCE_BUDGET[5].cars, 6);
    assert.equal(STAR_FORCE_BUDGET[5].foot, 10);
    assert.equal(STAR_FORCE_BUDGET[5].helis, 2);
    assert.equal(STAR_FORCE_BUDGET[5].tanks, 2);
    assert.equal(VISION_CONES.foot.range, 45);
    assert.equal(VISION_CONES.car.range, 70);
    assert.equal(VISION_CONES.car.proximity360, 15);
    assert.equal(VISION_CONES.heli.groundRadius, 40);
    assert.equal(DISPATCH_RULES.minSpawnDist, 120);
    assert.equal(HELI_TUNING.bases.length, 5);
    assert.equal(WITNESS_TUNING.callDelayMinSec, 4.0);
  });

  it('1. Cones de Tropa a Pé (45m / 120°) e Viatura (70m / 100° + 15m retrovisor 360°) respeitam distância, ângulo e oclusão de prédios AABB', () => {
    const { ws, world } = createIsolatedPursuitHarness();
    ws.setWantedStars(2);
    clearSpawnedUnits(ws);

    const cop = addMockFootOfficer(ws, 0, 0, 0, 0);
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, 42)), true, '42m frontal <= 45m visível');
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, 47)), false, '47m frontal > 45m invisível');

    const deg55 = (55 * Math.PI) / 180;
    const deg65 = (65 * Math.PI) / 180;
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(Math.sin(deg55) * 35, 0, Math.cos(deg55) * 35)), true);
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(Math.sin(deg65) * 35, 0, Math.cos(deg65) * 35)), false);
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, -8)), false, 'Tropa a pé sem visão 360° traseira');

    world.mapBuildings = [{ x: 0, z: 18, w: 16, d: 10, height: 22 }];
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, 35)), false, 'Prédio AABB bloqueia visão');
    world.mapBuildings = [];
    ws.footUnits.splice(ws.footUnits.indexOf(cop), 1);

    addMockPoliceCar(ws, 0, 0, 0, 0);
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, 68)), true, '68m frontal <= 70m visível');
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, 73)), false, '73m frontal > 70m invisível');

    const deg45 = (45 * Math.PI) / 180;
    const deg56 = (56 * Math.PI) / 180;
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(Math.sin(deg45) * 50, 0, Math.cos(deg45) * 50)), true);
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(Math.sin(deg56) * 50, 0, Math.cos(deg56) * 50)), false);

    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, -12)), true, 'Retrovisor 360° até 15m');
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, -18)), false, 'Fora do retrovisor (> 15m)');
    world.mapBuildings = [{ x: 0, z: -6, w: 12, d: 4, height: 10 }];
    assert.equal(ws.doesAnyUnitSeePosition(new THREE.Vector3(0, 0, -12)), false, 'Retrovisor respeita parede');

    world.mapBuildings = [];
    assert.equal(ws.hasCloseWitnessOnGarageEntry(new THREE.Vector3(0, 0, -24)), false, 'LEGO Customs livre sem visão');
    assert.equal(ws.hasCloseWitnessOnGarageEntry(new THREE.Vector3(0, 0, 30)), true, 'LEGO Customs bloqueada com visão');
  });

  it('2. Noite reduz alcance visual em -30%, exceto quando o alvo está iluminado pelo círculo do holofote do helicóptero', () => {
    const { ws, world } = createIsolatedPursuitHarness();
    ws.setWantedStars(3);
    clearSpawnedUnits(ws);

    addMockFootOfficer(ws, 0, 0, 0, 0);
    addMockPoliceCar(ws, 100, 0, 0, 0);

    const footTarget38m = new THREE.Vector3(0, 0, 38); // > 31.5m (45*0.7) e <= 45m
    const carTarget58m = new THREE.Vector3(100, 0, 58); // > 49.0m (70*0.7) e <= 70m

    world.atmosphere.nightFactor = 0;
    assert.equal(doesGroundUnitSeeTarget(ws, 'foot', 0, 0, 0, 0, footTarget38m), true);
    assert.equal(doesGroundUnitSeeTarget(ws, 'car', 100, 0, 0, 0, carTarget58m), true);

    world.atmosphere.nightFactor = 0.85;
    assert.equal(doesGroundUnitSeeTarget(ws, 'foot', 0, 0, 0, 0, footTarget38m), false, 'Noite -30% bloqueia 38m a pé');
    assert.equal(doesGroundUnitSeeTarget(ws, 'car', 100, 0, 0, 0, carTarget58m), false, 'Noite -30% bloqueia 58m viatura');

    // Holofote do helicóptero sobre footTarget38m anula a penalidade noturna (-30%) das unidades terrestres!
    const heli = addMockHelicopter(ws, 0, 48, 20, new THREE.Vector3(0, 0, 38), 40);
    assert.equal(isIlluminatedByHeliSpotlight(ws, footTarget38m), true);
    assert.equal(doesGroundUnitSeeTarget(ws, 'foot', 0, 0, 0, 0, footTarget38m), true, 'Holofote restaura alcance total de 45m a pé');
    assert.equal(doesGroundUnitSeeTarget(ws, 'car', 100, 0, 0, 0, carTarget58m), false, 'Alvo fora do holofote mantém -30%');

    heli.spotlightActive = false;
    assert.equal(doesGroundUnitSeeTarget(ws, 'foot', 0, 0, 0, 0, footTarget38m), false, 'Holofote desligado volta a reduzir -30%');
    heli.spotlightActive = true;

    const cones = getPoliceVisionConesSnapshot(ws);
    assert.deepEqual(cones.map((c) => c.kind).sort(), ['car', 'foot', 'heli']);
  });

  it('3. Círculo de solo do Helicóptero (40m) fica 100% CEGO sob viadutos, túneis do metrô, garagem coberta e marquises', () => {
    const { ws, world } = createIsolatedPursuitHarness();
    ws.setWantedStars(3);
    clearSpawnedUnits(ws);

    const heli = addMockHelicopter(ws, 0, 50, 0, new THREE.Vector3(0, 0, 0), 40);

    ws._computeLineOfSight(new THREE.Vector3(25, 0.5, 0), null, { forceImmediate: true });
    assert.equal(heli.hasVisual, true, 'Enxerga a céu aberto dentro de 40m');

    ws._computeLineOfSight(new THREE.Vector3(46, 0.5, 0), null, { forceImmediate: true });
    assert.equal(heli.hasVisual, false, 'Fora do círculo de 40m');

    const tunnelPos = new THREE.Vector3(0, -6.5, 0);
    assert.equal(isPlayerUnderOverheadCover(ws, tunnelPos), true);
    assert.equal(ws._computeLineOfSight(tunnelPos, null, { forceImmediate: true }), false);
    assert.equal(heli.hasVisual, false, '100% cego no túnel subterrâneo');

    world.elevatedDecks.push({ minX: -20, maxX: 20, minZ: -20, maxZ: 20, topY: 11.5 });
    const underViaductPos = new THREE.Vector3(0, 0.5, 0);
    assert.equal(ws._computeLineOfSight(underViaductPos, null, { forceImmediate: true }), false);
    assert.equal(heli.hasVisual, false, '100% cego sob viaduto');
    world.elevatedDecks.length = 0;

    const garagePos = new THREE.Vector3(68, 0.5, -454);
    heli.mesh.position.set(68, 50, -454);
    heli.lookGroundPos.set(68, 0, -454);
    assert.equal(ws._computeLineOfSight(garagePos, null, { forceImmediate: true }), false);
    assert.equal(heli.hasVisual, false, '100% cego dentro da LEGO Customs');

    heli.mesh.position.set(200, 50, 200);
    heli.lookGroundPos.set(200, 0, 200);
    world.addCollider(200, 200, 14, 14, 6.5, 4.2);
    assert.equal(ws._computeLineOfSight(new THREE.Vector3(200, 0.5, 200), null, { forceImmediate: true }), false);
    assert.equal(heli.hasVisual, false, '100% cego sob marquise/cobertura');
  });

  it('4. SEARCH (isEscaping) avança apenas fora de TODOS os cones, usa durações exatas 25/40/55/70/85s e ZERA escapeTimer ao ser reavistado!', () => {
    const { ws, hud } = createIsolatedPursuitHarness();
    const expectedByStar = { 1: 25, 2: 40, 3: 55, 4: 70, 5: 85 };

    for (const [starStr, expectedSec] of Object.entries(expectedByStar)) {
      const star = Number(starStr);
      ws.clearWanted('reset');
      ws.setWantedStars(star);
      clearSpawnedUnits(ws);

      assert.equal(ws.pursuitState, PURSUIT_STATES.PURSUIT);
      assert.equal(ws.isEscaping, false);
      assert.equal(ws.escapeDuration, expectedSec);

      const hiddenPos = new THREE.Vector3(500, 0.5, 500);
      tickPursuitEscapeAndHud(ws, expectedSec - 1.0, hiddenPos, null);
      assert.equal(ws.pursuitState, PURSUIT_STATES.SEARCH);
      assert.equal(ws.stars, star);

      const prevStuds = hud.totalStuds;
      tickPursuitEscapeAndHud(ws, 1.0, hiddenPos, null);
      assert.equal(ws.stars, 0);
      assert.equal(ws.pursuitState, PURSUIT_STATES.CLEAN);
      assert.ok(hud.totalStuds > prevStuds);
    }

    ws.setWantedStars(3);
    clearSpawnedUnits(ws);
    addMockPoliceCar(ws, 0, 0, 0, 0);

    tickPursuitEscapeAndHud(ws, 30.0, new THREE.Vector3(0, 0, -40), null);
    assert.equal(ws.pursuitState, PURSUIT_STATES.SEARCH);
    assert.equal(ws.escapeTimer, 30.0);

    tickPursuitEscapeAndHud(ws, 0.016, new THREE.Vector3(0, 0, 35), null);
    assert.equal(ws.pursuitState, PURSUIT_STATES.PURSUIT);
    assert.equal(ws.isEscaping, false);
    assert.equal(ws.escapeTimer, 0, 'escapeTimer ZERA instantaneamente ao ser reavistado!');
  });

  it('5. Troca de Operador/Máscara (notifyPlayerOperatorSwapped) oculto em SEARCH em 1★/2★ remove 1★ (1x por perseguição) e falha em PURSUIT ou 3★+', () => {
    const { ws } = createIsolatedPursuitHarness();

    ws.setWantedStars(2);
    clearSpawnedUnits(ws);
    addMockPoliceCar(ws, 0, 0, 0, 0);
    tickPursuitEscapeAndHud(ws, 0.5, new THREE.Vector3(0, 0, 30), null);
    assert.equal(ws.notifyPlayerOperatorSwapped('cv_fogueteira'), false, 'Falha em PURSUIT');
    assert.equal(ws.stars, 2);

    tickPursuitEscapeAndHud(ws, 0.5, new THREE.Vector3(0, 0, -45), null);
    assert.equal(ws.pursuitState, PURSUIT_STATES.SEARCH);
    assert.equal(ws.notifyPlayerOperatorSwapped('cv_fogueteira'), true, 'Reduz 2★ -> 1★ em SEARCH');
    assert.equal(ws.stars, 1);
    assert.equal(ws.escapeDuration, 25);

    assert.equal(ws.notifyPlayerOperatorSwapped('cv_marretao'), false, 'Máximo 1x por perseguição');
    assert.equal(ws.stars, 1);

    ws.clearWanted('reset');
    ws.setWantedStars(3);
    clearSpawnedUnits(ws);
    tickPursuitEscapeAndHud(ws, 0.5, new THREE.Vector3(200, 0, 200), null);
    assert.equal(ws.notifyPlayerOperatorSwapped('pcc_contador'), false, 'Falha em 3★+');
    assert.equal(ws.stars, 3);

    ws.clearWanted('reset');
    ws.setWantedStars(1);
    clearSpawnedUnits(ws);
    tickPursuitEscapeAndHud(ws, 0.5, new THREE.Vector3(200, 0, 200), null);
    assert.equal(ws.notifyPlayerOperatorSwapped('ares_agulha'), true, 'Limpa 1★ -> 0★ em SEARCH');
    assert.equal(ws.stars, 0);
    assert.equal(ws.pursuitState, PURSUIT_STATES.CLEAN);
  });

  it('6. Audição de Tiros (notifyPlayerGunshot) em até 60m gira policiais a pé na direção do disparo e grava investigatePos', () => {
    const { ws } = createIsolatedPursuitHarness();
    ws.setWantedStars(2);
    clearSpawnedUnits(ws);

    const nearCop = addMockFootOfficer(ws, 0, 0, 0, Math.PI);
    const farCop = addMockFootOfficer(ws, 120, 0, 0, Math.PI);

    const alerted = ws.notifyPlayerGunshot(new THREE.Vector3(30, 0.5, 40));
    assert.equal(alerted, 1);
    assert.ok(Math.abs(nearCop.mesh.rotation.y - Math.atan2(30, 40)) < 1e-6);
    assert.deepEqual(nearCop.investigatePos, { x: 30, z: 40, timer: 6.0 });
    assert.equal(farCop.mesh.rotation.y, Math.PI);
    assert.equal(farCop.investigatePos, undefined);
  });
});
