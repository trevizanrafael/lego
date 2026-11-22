import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { worldSpatialColliderMethods } = await import('../src/world/core/WorldSpatialColliderGrid.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { Minifigure } = await import('../src/entities/Minifigure.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');
const { AIRCRAFT_SPECS } = await import('../src/world/vehicles/AircraftFleetBuilder.js');

function createIsolatedFlightHarness(heroKey = 'caveira') {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  const canvas = globalThis.document.createElement('canvas');

  let lastHudHp = null;
  const hud = {
    isTitleScreenActive: false,
    isLoadingActive: false,
    setPlayerHealth(hp, maxHp) {
      lastHudHp = { hp, maxHp };
    },
    updateVehicleSpeedometer() {},
    setCharacterPortrait() {}
  };

  const destructibles = new DestructibleManager(scene, hud);
  const world = {
    scene,
    destructibles,
    colliders: [],
    _colliderGrid: new Map(),
    _dynamicColliders: [],
    colliderCellSize: 32,
    _colliderQueryId: 0,
    livingCity: {
      playerHp: 260,
      playerMaxHp: 260,
      triggerPedestrianPanicNear() {}
    },
    getTerrainHeightAt: () => 0,
    getSurfaceHeightAt: () => 0,
    isDeepWaterAt: () => false,
    getWaterSurfaceY: () => -1.5
  };
  Object.assign(world, worldSpatialColliderMethods);
  destructibles.world = world;

  const minifig = new Minifigure(heroKey);
  scene.add(minifig.root);

  const controller = new ThirdPersonController(camera, canvas, minifig, world, destructibles, hud);
  return { scene, camera, hud, destructibles, world, minifig, controller, getLastHudHp: () => lastHudHp };
}

function spawnTestAircraft(world, destructibles, type, x, y, z, rotY = 0) {
  const spec = { ...AIRCRAFT_SPECS[type] };
  const mesh = new THREE.Group();
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.userData.carType = type;
  mesh.userData.carName = spec.name;
  mesh.userData.vehicleSpec = spec;
  mesh.userData.mainRotorGroup = new THREE.Group();
  mesh.userData.tailRotorGroup = new THREE.Group();
  mesh.add(mesh.userData.mainRotorGroup, mesh.userData.tailRotorGroup);
  world.scene.add(mesh);

  const w = spec.category === 'plane' ? 7.5 : 4.2;
  const d = spec.category === 'plane' ? 14.0 : 9.5;
  const h = 3.6;
  const col = world.addCollider(x, z, w, d, y + h, y, { tag: `aircraft-${type}` });

  const carObj = destructibles.registerDestructible({
    mesh,
    type: 'car',
    hp: spec.hp,
    radius: Math.max(w, d) * 0.48,
    height: h,
    colliders: [col],
    debrisColors: [0x111827, 0xfacc15],
    studDrops: { silver: 2, gold: 2, blue: 0, purple: 0 },
    groundY: y
  });
  return carObj;
}

describe('Onda 2 (C2-C) — Aircraft 3D Swept Collision, GTA V Crash Explosions & Hero Flight/Grapple Sweep', () => {
  it('1. Helicóptero a baixa velocidade (6 m/s) contra arranha-céu (h=80m em Y=40m) bloqueia/desliza na fachada e NUNCA dá roof-pop (+2.5m) a 1.5m abaixo do topo', () => {
    const { world, destructibles, controller } = createIsolatedFlightHarness();
    // Arranha-céu maciço: X in [-20, 20], Z in [0, 30], Y in [0, 80]
    world.addCollider(0, 15, 40, 30, 80, 0, { tag: 'skyscraper-80m' });

    // Parte A: Voo oblíquo lento (6 m/s a 45°) em Y = 40m contra a fachada Z = 0
    const heli = spawnTestAircraft(world, destructibles, 'heli_policia', -6, 40, -3.2, Math.PI / 4);
    controller.enterVehicle(heli);
    const startX = heli.mesh.position.x;

    for (let step = 0; step < 35; step++) {
      controller.vehicleHeading = Math.PI / 4;
      controller.vehicleSpeed = 6.0;
      controller.vehicleVerticalSpeed = 0;
      controller.update(1 / 30);

      // O casco (hullRadius = 2.05) nunca pode penetrar o prédio (Z >= 0)
      assert.ok(
        heli.mesh.position.z <= -2.0,
        `Helicóptero nunca pode entrar no arranha-céu (z=${heli.mesh.position.z.toFixed(3)})`
      );
      assert.equal(heli.destroyed, false, 'Raspão lento a 6 m/s não deve explodir o helicóptero');
    }

    assert.ok(
      heli.mesh.position.x > startX + 3.5,
      `Helicóptero deve deslizar suavemente ao longo da fachada em +X (startX=${startX}, endX=${heli.mesh.position.x.toFixed(2)})`
    );
    assert.ok(
      Math.abs(heli.mesh.position.y - 40.0) < 0.25,
      `Altitude deve permanecer estável em ~40m durante o slide (y=${heli.mesh.position.y.toFixed(2)})`
    );
    assert.equal(heli.colliders[0].isDynamic, true, 'Colisor da aeronave deve ser promovido a dinâmico e sincronizado');
    assert.ok(
      Math.abs((heli.colliders[0].minX + heli.colliders[0].maxX) * 0.5 - heli.mesh.position.x) < 0.05,
      'Colisor dinâmico deve acompanhar a posição atual da aeronave e não ficar preso no pad inicial'
    );

    // Parte B: Raspando a 1.5m ABAIXO da borda do teto (Y = 78.5m vs maxY = 80m) NUNCA deve dar snap +2.5m para Y = 80m!
    heli.mesh.position.set(0, 78.5, -3.0);
    heli.basePos.copy(heli.mesh.position);
    for (let step = 0; step < 20; step++) {
      controller.vehicleHeading = 0; // Em direção a +Z (contra a borda superior Z = 0)
      controller.vehicleSpeed = 6.0;
      controller.vehicleVerticalSpeed = 0;
      controller.update(1 / 30);

      assert.ok(
        heli.mesh.position.y < 79.0,
        `Helicóptero voando em Y=78.5m (1.5m abaixo do topo 80m) NUNCA deve dar snap para o teto (y=${heli.mesh.position.y.toFixed(3)})`
      );
      assert.ok(
        heli.mesh.position.z <= -2.0,
        `Deve continuar bloqueado fora da parede em Y=78.5m (z=${heli.mesh.position.z.toFixed(3)})`
      );
    }
  });

  it('2. Jato supersônico (65 m/s) e helicóptero rápido (32 m/s) batendo de frente no arranha-céu disparam Explosão estilo GTA V e ejetam jogador em local seguro', () => {
    // 2A. Caça Supersônico a 65 m/s contra arranha-céu em Y = 40m
    {
      const { world, destructibles, controller, getLastHudHp } = createIsolatedFlightHarness();
      const bldg = world.addCollider(0, 20, 36, 30, 80, 0, { tag: 'tower-crash' });
      const jet = spawnTestAircraft(world, destructibles, 'jato_caca', 0, 40, -6.0, 0);

      controller.enterVehicle(jet);
      controller.yaw = Math.PI; // Olhando para +Z
      controller.keys.forward = true;
      controller.vehicleHeading = 0;
      controller.vehicleSpeed = 65.0;

      for (let step = 0; step < 18 && controller.currentVehicle; step++) {
        controller.update(1 / 60);
      }

      assert.equal(jet.destroyed, true, 'Caça a 65 m/s deve ser destruído na colisão frontal');
      assert.equal(controller.currentVehicle, null, 'Jogador deve ser ejetado da aeronave destruída');
      assert.ok(destructibles.explosions.length >= 1, 'Deve instanciar explosão 3D estilo GTA V no ponto de impacto');
      assert.ok(controller.cameraShakeTimer >= 0.5, 'Deve acionar cameraShakeTimer intenso');
      assert.ok(
        world.livingCity.playerHp < 260 && world.livingCity.playerHp >= 25,
        `Dano de queda não-softlock deve reduzir HP preservando mínimo >= 25 (hp=${world.livingCity.playerHp})`
      );
      assert.ok(getLastHudHp() !== null, 'HUD deve ser notificado do novo HP do jogador');

      // Jogador ejetado deve estar FORA do arranha-céu (Z < bldg.minZ = 5.0)
      const overlaps = world.overlapCapsule(controller.position, controller.playerRadius, 2.05, { stepUpHeight: 0 });
      assert.equal(overlaps.includes(bldg), false, `Jogador ejetado não pode ficar preso dentro do prédio (pos.z=${controller.position.z.toFixed(2)})`);
      assert.ok(controller.position.z < bldg.minZ, `Posição segura deve ficar fora da face frontal Z=${bldg.minZ} (pos.z=${controller.position.z.toFixed(2)})`);
    }

    // 2B. Helicóptero rápido a 32 m/s contra arranha-céu em Y = 40m
    {
      const { world, destructibles, controller } = createIsolatedFlightHarness();
      const bldg = world.addCollider(0, 20, 36, 30, 80, 0, { tag: 'tower-heli-crash' });
      const heli = spawnTestAircraft(world, destructibles, 'heli_ataque', 0, 40, -5.0, 0);

      controller.enterVehicle(heli);
      controller.yaw = Math.PI;
      controller.keys.forward = true;
      controller.vehicleHeading = 0;
      controller.vehicleSpeed = 32.0;

      for (let step = 0; step < 25 && controller.currentVehicle; step++) {
        controller.update(1 / 60);
      }

      assert.equal(heli.destroyed, true, 'Helicóptero a 32 m/s deve explodir no impacto frontal');
      assert.equal(controller.currentVehicle, null, 'Jogador deve sair automaticamente no crash do helicóptero');
      assert.ok(destructibles.explosions.length >= 1, 'Explosão gerada para o helicóptero');
      assert.ok(controller.position.z < bldg.minZ, 'Jogador ejetado para fora da fachada do prédio');
    }
  });

  it('3. Descida suave (vy = -4 m/s) acima do terraço de um prédio (Y = 82m -> 80m) pousa suavemente em Y = 80m sem explodir + impacto médio deduz HP', () => {
    const { world, destructibles, controller } = createIsolatedFlightHarness();
    world.addCollider(0, 0, 30, 30, 80, 0, { tag: 'helipad-rooftop' });

    const heli = spawnTestAircraft(world, destructibles, 'heli_policia', 0, 82.0, 0, 0);
    controller.enterVehicle(heli);

    for (let step = 0; step < 45; step++) {
      controller.vehicleSpeed = 0;
      controller.vehicleVerticalSpeed = -4.0;
      controller.update(1 / 60);
    }

    assert.equal(heli.destroyed, false, 'Pouso suave a -4 m/s nunca deve explodir a aeronave');
    assert.equal(controller.currentVehicle, heli, 'Jogador deve permanecer pilotando após o pouso');
    assert.equal(destructibles.explosions.length, 0, 'Zero explosões no pouso suave');
    assert.ok(
      Math.abs(heli.mesh.position.y - 80.0) < 0.05,
      `Helicóptero deve pousar cravado no topo Y=80.0m (atual: ${heli.mesh.position.y.toFixed(4)})`
    );
    assert.equal(controller.vehicleVerticalSpeed, 0, 'Velocidade vertical negativa deve zerar ao tocar o terraço');

    // Testa também impacto médio (14 m/s): gera faíscas e deduz HP sem explodir na primeira batida
    const wall = world.addCollider(0, 45, 30, 10, 105, 80, { tag: 'penthouse-wall' });
    assert.ok(wall);
    heli.mesh.position.set(0, 84.0, 37.6);
    heli.basePos.copy(heli.mesh.position);
    const hpBefore = heli.hp;
    for (let step = 0; step < 5; step++) {
      controller.vehicleHeading = 0;
      controller.vehicleSpeed = 14.0;
      controller.vehicleVerticalSpeed = 0;
      controller.update(1 / 30);
      if (heli.hp < hpBefore) break;
    }

    assert.equal(heli.destroyed, false, 'Impacto médio (14 m/s) com HP cheio deve amassar/faiscar sem explodir de imediato');
    assert.ok(heli.hp < hpBefore, `Impacto médio deve deduzir HP do casco (${hpBefore} -> ${heli.hp})`);
    assert.ok(destructibles.fxParticles.length > 0, 'Impacto médio deve soltar faíscas metálicas');
  });

  it('4. Voo Supersônico de Herói (Solaris) não atravessa paredes finas a alta velocidade e Gancho da Sombra (raycast3D) ignora ar vazio de setbacks Art-Deco/OBB', () => {
    const { world, camera, controller } = createIsolatedFlightHarness('solaris');

    // Parede fina de 0.30m e 90m de largura em Z = [4.0, 4.30], Y = [0, 60]
    world.addCollider(0, 4.15, 90, 0.30, 60, 0, { tag: 'thin-glass-curtain' });

    controller.switchToHero('solaris');
    controller.position.set(-4, 25, 0);
    controller.isFlying = true;
    controller.isGrounded = false;
    controller.yaw = Math.PI + Math.PI / 6; // Voando obliquamente em (+X, +Z) a 85 m/s!
    controller.pitch = 0;
    controller.keys.forward = true;
    controller.keys.sprint = true;
    controller.currentSpeed = 85.0;

    const startX = controller.position.x;
    for (let step = 0; step < 15; step++) {
      controller.update(1 / 30); // ~2.8m por frame (> 9x a espessura da parede de 0.30m!)
      assert.ok(
        controller.position.z < 4.0,
        `Solaris supersônico não pode tunelar parede fina de 0.30m (z=${controller.position.z.toFixed(3)})`
      );
    }
    assert.ok(
      controller.position.x < startX - 2.0 || controller.position.x > startX + 2.0,
      'Solaris deve deslizar tangencialmente ao longo da parede durante o voo supersônico'
    );

    // Sombra Escarlate: Prédio Art-Deco escalonado (pódio largo Y=0..20, coroa recuada Y=20..55) em (X=50, Z=-50)
    const tiers = world.addTieredCollider(50, -50, [
      { width: 24, depth: 24, minY: 0, maxY: 20, tag: 'art-deco-podium' },
      { width: 8, depth: 8, minY: 20, maxY: 55, tag: 'art-deco-crown' }
    ]);
    assert.equal(tiers.length, 2);

    controller.isFlying = false;
    controller.keys.forward = false;
    controller.keys.sprint = false;
    controller.switchToHero('sombra');
    controller.position.set(50, 0, 0);

    // 4A. Mirando no AR VAZIO ao lado da coroa recuada (X = 41 está dentro do pódio [38..62], mas FORA da coroa [46..54] em Y = 36!)
    camera.position.set(41, 36, 0);
    camera.lookAt(41, 36, -60);
    camera.updateMatrixWorld();
    controller.grappleState = null;
    controller._triggerSombraGrapple();
    assert.ok(controller.grappleState, 'Grapple inicia');
    // Como não há geometria em (X=41, Y=36, Z=-50), NÃO deve ancorar na face Z=-38 do pódio invisível!
    assert.ok(
      Math.abs(controller.grappleState.anchor.z - (-38)) > 2.0,
      `Gancho NÃO deve prender no ar vazio do recuo Art-Deco em Z=-38 (anchor.z=${controller.grappleState.anchor.z.toFixed(2)})`
    );
    controller._stopGrapple(false);

    // 4B. Mirando diretamente na COROA REAL visível (X = 50, Y = 36, face frontal real em Z = -46)
    camera.position.set(50, 36, 0);
    camera.lookAt(50, 36, -60);
    camera.updateMatrixWorld();
    controller._triggerSombraGrapple();
    assert.ok(controller.grappleState, 'Gancho deve prender na coroa real');
    assert.ok(
      Math.abs(controller.grappleState.anchor.z - (-46.0)) < 0.25 &&
      Math.abs(controller.grappleState.anchor.y - 36.0) < 0.25,
      `Gancho deve cravar exatamente na face real Z=-46 da coroa Art-Deco (anchor=${controller.grappleState.anchor.x.toFixed(2)}, ${controller.grappleState.anchor.y.toFixed(2)}, ${controller.grappleState.anchor.z.toFixed(2)})`
    );
    controller._stopGrapple(false);
  });
});
