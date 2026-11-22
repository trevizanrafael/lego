import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { WantedPursuitSystem } = await import('../src/world/WantedPursuitSystem.js');
const { POLICE_HELIPAD_BASES } = await import('../src/world/police/PoliceHelicopterPilot.js');

function createPursuitTestHarness() {
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
    mapBuildings: [
      { x: 48, z: -210, w: 30, d: 30, height: 96 },
      { x: -48, z: -150, w: 28, d: 28, height: 82 }
    ],
    elevatedDecks: [
      { minX: -400, maxX: 400, minZ: -396, maxZ: -368, topY: 11.5 }
    ],
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
    getTerrainHeightAt() {
      return 0;
    },
    getSurfaceHeightAt(_x, _z, refY = 0) {
      return refY >= 9.5 ? 11.5 : 0;
    },
    isDeepWaterAt() {
      return false;
    }
  };

  const livingCity = {
    world,
    scene,
    destructibles,
    hud,
    playerHp: 100,
    playerMaxHp: 100,
    _findSafeStreetSpawn(x, z) {
      return { x, z };
    }
  };

  const controller = {
    position: new THREE.Vector3(0, 0.5, -240),
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

describe('HELICÓPTERO POLICIAL ÁGUIA (55 M/S, HELIPONTOS REAIS, BUSCA EM ESPIRAL) & ANTI-TELETRANSPORTE', () => {
  it('1. Helicóptero decola sempre de um heliponto real (>= 135m do jogador, nunca 65m na cabeça) e sincroniza eagleHeli com policeHelicopters[0]', () => {
    const { ws, controller } = createPursuitTestHarness();

    // Caso A: Jogador na avenida em Z = -250 (162m da Delegacia Central)
    controller.position.set(0, 0.5, -250);
    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(3);

    assert.equal(ws.policeHelicopters.length, 1, '3★ despacha exatamente 1 helicóptero');
    assert.strictEqual(ws.eagleHeli, ws.policeHelicopters[0], 'eagleHeli sincronizado com policeHelicopters[0]');

    const hPosA = ws.eagleHeli.mesh.position;
    const distA = Math.hypot(hPosA.x - controller.position.x, hPosA.z - controller.position.z);
    assert.ok(distA >= 135.0, `Helicóptero nasceu longe do jogador (>= 135m), dist=${distA.toFixed(1)}m`);
    assert.ok(
      POLICE_HELIPAD_BASES.some(
        (b) => Math.hypot(b.x - hPosA.x, b.z - hPosA.z) < 0.01 && Math.abs(b.y - hPosA.y) < 0.01
      ),
      'Helicóptero nasceu exatamente em um heliponto oficial'
    );

    // Caso B: Jogador colado na Delegacia Central (0, -88) (< 135m) -> escolhe 2º heliponto mais próximo (>= 135m)!
    ws.clearWanted('reset');
    assert.equal(ws.policeHelicopters.length, 0);
    assert.equal(ws.eagleHeli, null);

    controller.position.set(4, 0.5, -90);
    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(3);

    const hPosB = ws.eagleHeli.mesh.position;
    const distB = Math.hypot(hPosB.x - controller.position.x, hPosB.z - controller.position.z);
    assert.ok(
      distB >= 135.0,
      `Mesmo ao lado da Delegacia Central, Águia decola de outra base >= 135m (dist=${distB.toFixed(1)}m)`
    );
    assert.notEqual(ws.eagleHeli.baseOrigin.id, 'central_precinct', 'Evita heliponto em cima da cabeça do jogador');
  });

  it('2. Velocidade horizontal do Águia NUNCA passa de 55.0 m/s, permitindo que supercarro/jato a 75 m/s escape do cone de 40m', () => {
    const { ws, controller } = createPursuitTestHarness();

    controller.position.set(0, 0.5, -240);
    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(3);
    const heli = ws.eagleHeli;
    assert.ok(heli);

    // Deixa o helicóptero chegar do heliponto até adquirir visual sobre a avenida aberta
    let maxObservedSpeed = 0;
    for (let step = 0; step < 90; step++) {
      const prevX = heli.mesh.position.x;
      const prevZ = heli.mesh.position.z;
      ws.update(0.05, controller.position, controller);
      const velMag = Math.hypot(heli.vel.x, heli.vel.z);
      const stepSpd = Math.hypot(heli.mesh.position.x - prevX, heli.mesh.position.z - prevZ) / 0.05;
      maxObservedSpeed = Math.max(maxObservedSpeed, velMag, stepSpd);
    }

    assert.equal(heli.hasVisual, true, 'Águia adquire visual ao chegar sobre a rua aberta');
    assert.ok(
      maxObservedSpeed <= 55.05,
      `Velocidade horizontal estritamente <= 55.0 m/s na chegada (observado: ${maxObservedSpeed.toFixed(3)} m/s)`
    );

    // Jogador acelera um supercarro/jato a 75 m/s na rodovia reta!
    controller.currentVehicle = { id: 'supercar_test' };
    controller.vehicleSpeed = 75.0;
    controller.vehicleHeading = Math.PI;

    for (let step = 0; step < 120; step++) {
      controller.position.z -= 75.0 * 0.05;
      const prevX = heli.mesh.position.x;
      const prevZ = heli.mesh.position.z;
      ws.update(0.05, controller.position, controller);
      const velMag = Math.hypot(heli.vel.x, heli.vel.z);
      const stepSpd = Math.hypot(heli.mesh.position.x - prevX, heli.mesh.position.z - prevZ) / 0.05;
      maxObservedSpeed = Math.max(maxObservedSpeed, velMag, stepSpd);
    }

    const finalHorizGap = Math.hypot(
      heli.mesh.position.x - controller.position.x,
      heli.mesh.position.z - controller.position.z
    );
    const coneDist = Math.hypot(
      heli.lookGroundPos.x - controller.position.x,
      heli.lookGroundPos.z - controller.position.z
    );

    assert.ok(
      maxObservedSpeed <= 55.05,
      `Velocidade horizontal NUNCA excede 55.0 m/s na perseguição (máx=${maxObservedSpeed.toFixed(3)} m/s)`
    );
    assert.ok(coneDist > 40.0, `Veículo a 75 m/s abre vantagem e sai do cone de 40m (coneDist=${coneDist.toFixed(1)}m)`);
    assert.ok(finalHorizGap > 80.0, `Veículo a 75 m/s abre distância real do helicóptero (gap=${finalHorizGap.toFixed(1)}m)`);
    assert.equal(heli.hasVisual, false, 'Águia perde o visual ao ser deixado para trás fora do cone de 40m');
  });

  it('3. Entrar sob viaduto ou túnel subterrâneo zera hasVisual, inicia busca espiral sobre _lastKnownPlayerPos e aponta holofote para lookGroundPos à noite', () => {
    const { ws, world, controller } = createPursuitTestHarness();
    world.atmosphere.nightFactor = 0.92;

    // Jogador visível antes do Viaduto Norte (Z = -340)
    controller.position.set(120, 0.5, -340);
    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(3);
    ws.pursuitVehicles.forEach((pv) => ws.destructibles.unregisterDestructible(pv.carObj));
    ws.pursuitVehicles.length = 0;

    const heli = ws.eagleHeli;
    heli.mesh.position.set(120, 48, -325);
    heli.lookGroundPos.set(120, 0.08, -340);
    ws.update(0.1, controller.position, controller);
    assert.equal(heli.hasVisual, true, 'Águia tem visual antes do viaduto');
    const lastSeenBeforeCover = ws._lastKnownPlayerPos.clone();

    // Jogador entra debaixo do Viaduto (Z = -382, Y = 0.4 < topY 11.5) e desloca-se escondido para X = 210
    const underViaductPos = new THREE.Vector3(210, 0.4, -382);
    assert.equal(ws._isPlayerUnderViaduct(underViaductPos), true);

    for (let s = 0; s < 30; s++) {
      ws._spawnTickTimer = 99; // Isola teste aéreo sem novas viaturas terrestres
      ws.update(0.1, underViaductPos, controller);
    }

    assert.equal(heli.hasVisual, false, 'Águia perde visual imediatamente sob o viaduto');
    assert.ok(heli.searchTimer > 2.5, 'Timer da busca em espiral avança sem visual');
    assert.equal(heli.coneMesh.visible, true, 'Feixe do holofote noturno ativo durante a busca');
    assert.equal(heli.discMesh.visible, true, 'Disco de luz no solo visível à noite');

    assert.ok(
      heli.discMesh.position.distanceTo(heli.lookGroundPos) < 0.05,
      'Holofote aponta exatamente para heli.lookGroundPos'
    );
    const distSpotToHiddenPlayer = Math.hypot(
      heli.lookGroundPos.x - underViaductPos.x,
      heli.lookGroundPos.z - underViaductPos.z
    );
    assert.ok(
      distSpotToHiddenPlayer > 35.0,
      `Holofote varre espiral perto de _lastKnownPlayerPos (${lastSeenBeforeCover.x}, ${lastSeenBeforeCover.z}) em vez de colar no jogador oculto`
    );

    // Verifica também corte de visão em túnel subterrâneo (Y = -6.5)
    const tunnelPos = new THREE.Vector3(120, -6.5, -340);
    ws.update(0.1, tunnelPos, controller);
    assert.equal(heli.hasVisual, false, 'Túnel subterrâneo também mantém hasVisual === false');
  });

  it('4. Abate aplica cooldown de 28s e próximo nasce em heliponto; 4★–5★ permite 2 helicópteros; viaturas NUNCA teleportam (> 175m) e despawnam > 250m', () => {
    const { ws, destructibles, controller } = createPursuitTestHarness();

    controller.position.set(0, 0.5, -240);
    ws._lastPlayerPos.copy(controller.position);
    ws.setWantedStars(4);

    assert.equal(ws.policeHelicopters.length, 2, '4★–5★ despacha até 2 helicópteros policiais');
    assert.strictEqual(ws.eagleHeli, ws.policeHelicopters[0]);

    // Reforços terrestres SEMPRE nascem >= 120m do jogador (nunca na cara!)
    for (const pv of ws.pursuitVehicles) {
      const d = Math.hypot(
        pv.carObj.mesh.position.x - controller.position.x,
        pv.carObj.mesh.position.z - controller.position.z
      );
      assert.ok(d >= 120.0, `Viatura nasceu fora de visão próxima (>= 120m), dist=${d.toFixed(1)}m`);
    }

    // Abate o 1º helicóptero -> cooldown de 28s (>= 20s) e sincroniza eagleHeli com o helicóptero restante
    const shotHeli = ws.policeHelicopters[0];
    const secondHeli = ws.policeHelicopters[1];
    destructibles.damageObject(shotHeli.obj, 9999, shotHeli.mesh.position);

    assert.equal(ws.policeHelicopters.length, 1, 'Helicóptero abatido removido de policeHelicopters');
    assert.strictEqual(ws.eagleHeli, secondHeli, 'eagleHeli assume o 2º helicóptero ativo');
    assert.ok(
      ws.eagleHeliRespawnCooldown >= 20.0,
      `Cooldown de respawn aéreo >= 20s aplicado (${ws.eagleHeliRespawnCooldown}s)`
    );

    // Após zerar o cooldown, o helicóptero substituto nasce de novo num heliponto real (>= 135m)!
    ws.eagleHeliRespawnCooldown = 0;
    const replacement = ws._spawnEagleHelicopter(controller.position);
    assert.ok(replacement, 'Novo helicóptero decola após expirar o cooldown');
    const repDist = Math.hypot(
      replacement.mesh.position.x - controller.position.x,
      replacement.mesh.position.z - controller.position.z
    );
    assert.ok(repDist >= 135.0, `Substituto nasceu em heliponto real >= 135m (${repDist.toFixed(1)}m)`);

    // Anti-Teletransporte: viatura a 190m (> 175m) NUNCA teleporta para perto do jogador!
    const testPv = ws.pursuitVehicles[0];
    assert.ok(testPv);
    testPv.carObj.mesh.position.set(0, 0, controller.position.z + 190.0);
    testPv.stuckTimer = 0;
    ws.update(0.1, controller.position, controller);

    const distAfter190 = Math.hypot(
      testPv.carObj.mesh.position.x - controller.position.x,
      testPv.carObj.mesh.position.z - controller.position.z
    );
    assert.ok(
      distAfter190 > 175.0,
      `Viatura a 190m NÃO teletransportou para perto do jogador (dist=${distAfter190.toFixed(1)}m)`
    );

    // Manobra local de ré quando travada (stuckTimer > 2.8s): move apenas ~3.2m localmente
    const stuckBeforeX = testPv.carObj.mesh.position.x;
    const stuckBeforeZ = testPv.carObj.mesh.position.z;
    testPv.stuckTimer = 3.1;
    ws.update(0.05, controller.position, controller);
    const unwedgeShift = Math.hypot(
      testPv.carObj.mesh.position.x - stuckBeforeX,
      testPv.carObj.mesh.position.z - stuckBeforeZ
    );
    assert.ok(unwedgeShift < 12.0, `Manobra anti-enrosco é estritamente local (${unwedgeShift.toFixed(1)}m)`);

    // Acima de 250m atrás da câmera: viatura perdida é despawnada de forma limpa!
    testPv.carObj.mesh.position.set(0, 0, controller.position.z + 265.0);
    ws.update(0.1, controller.position, controller);
    assert.equal(
      ws.pursuitVehicles.includes(testPv),
      false,
      'Viatura perdida além de 250m é despawnada de pursuitVehicles'
    );
    assert.equal(testPv.carObj.destroyed, true, 'Viatura perdida desregistrada do DestructibleManager');
  });
});
