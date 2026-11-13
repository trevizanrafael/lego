import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { Minifigure } = await import('../src/entities/Minifigure.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { LivingCityManager } = await import('../src/world/LivingCityManager.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { METRO_STATIONS, getMetroCutoutFloorY } = await import('../src/world/MetroSystemBuilder.js');
const { createSignBoardMesh } = await import('../src/utils/SignBoardHelper.js');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.35, 2600);
const hud = new LegoHud(35000);
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
const minifig = new Minifigure('caveira');
scene.add(minifig.root);
const domElement = globalThis.document.getElementById('game-container');
const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);
controller.onToggleFullMap = () => hud.toggleFullMap(world, controller);
const livingCity = world.livingCity || new LivingCityManager(world, destructibles, hud);

function simulateControllerWalk(waypoints) {
  controller.position.set(waypoints[0].x, waypoints[0].y, waypoints[0].z);
  controller.velocity.set(0, 0, 0);
  let minObservedY = Infinity;

  for (let w = 1; w < waypoints.length; w++) {
    const target = waypoints[w];
    for (let step = 0; step < 700; step++) {
      const dx = target.x - controller.position.x;
      const dz = target.z - controller.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.42) break;
      const spd = 7.5;
      controller.velocity.x = (dx / dist) * spd;
      controller.velocity.z = (dz / dist) * spd;
      controller.velocity.y = Math.max(controller.velocity.y - 28 * 0.04, -18);
      controller._moveAndCollide(0.04);
      if (controller.position.y < minObservedY) {
        minObservedY = controller.position.y;
      }
    }
    const rem = Math.hypot(target.x - controller.position.x, target.z - controller.position.z);
    assert.ok(
      rem < 0.65,
      `Caminhada física deve alcançar waypoint ${w} (${target.x.toFixed(1)}, ${target.z.toFixed(1)}), parou em (${controller.position.x.toFixed(2)}, ${controller.position.y.toFixed(2)}, ${controller.position.z.toFixed(2)}) [rem=${rem.toFixed(2)}m]`
    );
  }
  return minObservedY;
}

describe('OTIMIZAÇÃO 60 FPS, RELEVO URBANO VISÍVEL, VIADUTOS SUSPENSOS & METRÔ 100% FUNCIONAL', () => {
  it('1. Zero vértices/posições NaN (incluindo Studs ambientes) e zero oceano sob o Centro/Metrô', () => {
    let meshCount = 0;
    let nanCount = 0;
    let nanPosCount = 0;
    let oceanUnderDowntown = false;

    scene.traverse((obj) => {
      if (
        Number.isNaN(obj.position.x) ||
        Number.isNaN(obj.position.y) ||
        Number.isNaN(obj.position.z)
      ) {
        nanPosCount++;
      }
      if (obj.isMesh && obj.geometry && obj.geometry.attributes?.position) {
        meshCount++;
        const arr = obj.geometry.attributes.position.array;
        for (let i = 0; i < arr.length; i++) {
          if (Number.isNaN(arr[i])) {
            nanCount++;
            break;
          }
        }
        if (!Array.isArray(obj.material) && obj.material?.color?.getHex() === 0x0369a1) {
          obj.geometry.computeBoundingBox();
          const bb = obj.geometry.boundingBox;
          const pos = obj.geometry.attributes.position;
          const idx = obj.geometry.index;
          if (idx) {
            for (let t = 0; t < idx.count; t += 3) {
              const ax = pos.getX(idx.getX(t)) + obj.position.x;
              const az = pos.getZ(idx.getX(t)) + obj.position.z;
              const bx = pos.getX(idx.getX(t + 1)) + obj.position.x;
              const bz = pos.getZ(idx.getX(t + 1)) + obj.position.z;
              const cx = pos.getX(idx.getX(t + 2)) + obj.position.x;
              const cz = pos.getZ(idx.getX(t + 2)) + obj.position.z;
              const minX = Math.min(ax, bx, cx);
              const maxX = Math.max(ax, bx, cx);
              const minZ = Math.min(az, bz, cz);
              const maxZ = Math.max(az, bz, cz);
              if (0 >= minX && 0 <= maxX && -105 >= minZ && -105 <= maxZ && bb.min.y + obj.position.y < 0) {
                oceanUnderDowntown = true;
              }
            }
          }
        }
      }
    });

    assert.ok(meshCount > 80);
    assert.equal(nanPosCount, 0, 'Nenhum Object3D ou Stud ambiente pode ter position NaN');
    assert.equal(nanCount, 0, 'Nenhuma geometria 3D pode conter vértices NaN');
    assert.equal(oceanUnderDowntown, false, 'PROIBIDO haver malha de oceano passando por baixo das estações subterrâneas');
  });

  it('2. Grade Espacial 2D (32m x 32m), Distance Culling escalonado (155m) e zero castShadow em props pequenos', () => {
    assert.ok(world.colliders.length > 2500, `Mundo deve ter milhares de colisores (${world.colliders.length})`);
    const nearby = world.getCollidersNear(0, -100, 3.0);
    assert.ok(
      nearby.length > 0 && nearby.length < 70,
      `Grade espacial deve retornar apenas colisores locais (<70, retornou ${nearby.length} de ${world.colliders.length})`
    );

    const streetProps = destructibles.objects.filter((o) => o.isStreetProp && !o.destroyed);
    assert.ok(streetProps.length >= 420, `Deve haver >= 420 props de rua (${streetProps.length})`);

    let shadowCastingSmallProps = 0;
    for (const sp of streetProps) {
      sp.mesh.traverse((child) => {
        if (child.isMesh && child.castShadow) shadowCastingSmallProps++;
      });
    }
    assert.equal(shadowCastingSmallProps, 0, 'Props pequenos de calçada não devem projetar sombra no shadowMap');

    const sampleProp = streetProps[0];
    const farPos = new THREE.Vector3(sampleProp.mesh.position.x + 220, 0, sampleProp.mesh.position.z + 220);
    destructibles.update(0.25, farPos);
    assert.equal(sampleProp.mesh.visible, false, 'Props de rua além de 155m devem ficar ocultos pelo culling');

    const nearPos = new THREE.Vector3(sampleProp.mesh.position.x + 15, 0, sampleProp.mesh.position.z + 15);
    destructibles.update(0.25, nearPos);
    assert.equal(sampleProp.mesh.visible, true, 'Props de rua dentro de 155m devem ficar visíveis');

    assert.ok(livingCity.pedestrians.length > 0);
  });

  it('3. Viadutos realmente suspensos (vão livre >= 9.5m acima da rua local), sombra projetada e rampas vazadas', async () => {
    assert.equal(getMetroCutoutFloorY(-140, 134), null);
    assert.equal(getMetroCutoutFloorY(384, -150), null);

    // Verifica folga livre >= 9.5m (deck a +12.4m acima da rua local) nos 3 Viadutos!
    const v1Ground = world.getTerrainHeightAt(120, -382);
    const v1Deck = world.getSurfaceHeightAt(120, -382, v1Ground + 60);
    assert.ok(v1Deck - v1Ground >= 11.5, `Viaduto 01 deve ter >= 11.5m sobre a rua (atual: ${(v1Deck - v1Ground).toFixed(2)}m)`);
    assert.ok(v1Deck - 1.15 - v1Ground >= 9.5, 'Vão livre sob as vigas do Viaduto 01 deve ser >= 9.5m');

    const v2Ground = world.getTerrainHeightAt(252, 134);
    const v2Deck = world.getSurfaceHeightAt(252, 134, v2Ground + 60);
    assert.ok(v2Deck - v2Ground >= 11.5, `Viaduto 02 deve ter >= 11.5m sobre a rua (atual: ${(v2Deck - v2Ground).toFixed(2)}m)`);
    assert.ok(v2Deck - 1.15 - v2Ground >= 9.5, 'Vão livre sob as vigas do Viaduto 02 deve ser >= 9.5m');

    const v3Ground = world.getTerrainHeightAt(-516, 0);
    const v3Deck = world.getSurfaceHeightAt(-516, 0, v3Ground + 60);
    assert.ok(v3Deck - v3Ground >= 11.5, `Viaduto 03 deve ter >= 11.5m sobre a rua (atual: ${(v3Deck - v3Ground).toFixed(2)}m)`);
    assert.ok(v3Deck - 1.15 - v3Ground >= 9.5, 'Vão livre sob as vigas do Viaduto 03 deve ser >= 9.5m');

    // Verifica que existe malha de concreto do viaduto com castShadow = true!
    let viaductShadowMeshFound = false;
    scene.traverse((obj) => {
      if (obj.isMesh && obj.castShadow && !Array.isArray(obj.material) && obj.material?.color?.getHex() === 0xcbd5e1) {
        viaductShadowMeshFound = true;
      }
    });
    assert.equal(viaductShadowMeshFound, true, 'Estrutura de concreto claro dos viadutos deve projetar sombra real na rua abaixo');

    // Fim dos paredões cegos nas rampas: o jogador atravessa por baixo da rampa suspensa (X = -215 em Z = -382, onde clearance > 6m)!
    const rampGroundY = world.getTerrainHeightAt(-215, -395);
    simulateControllerWalk([
      { x: -215, y: rampGroundY + 0.3, z: -395 },
      { x: -215, y: rampGroundY + 0.3, z: -369 }
    ]);
    assert.ok(
      world.elevatedDecks.filter((d) => String(d.id || '').includes('viaduct')).length >= 3,
      'Os 3 viadutos expressos devem estar registrados em world.elevatedDecks'
    );

    // Pilares dos viadutos fora da pista: pórticos com pilar em calçada de verdade
    const { isInsideAnyRoad, makeFootingLookup } = await import('../src/world/StreetPortalPlanner.js');
    const footing = makeFootingLookup(world, { ignoreBlock: (b) => b.isViaductDeck });
    const portals = world.viaductSupports.filter((v) => v.kind === 'portal');
    assert.ok(portals.length >= 60, `Viadutos apoiados em pórticos (${portals.length})`);
    for (const v of portals) {
      for (const c of v.cols) {
        assert.ok(!isInsideAnyRoad(world.mapRoads, c.x, c.z, 0.7), `Pilar de viaduto na pista em (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
        assert.ok(footing(c.x, c.z), `Pilar de viaduto fora da calçada em (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
      }
    }

    // Perfil "de projeto": no trecho elevado, inclinação <= 5% e sem degraus entre amostras
    for (const d of world.elevatedDecks.filter((e) => ['viaduct_ew_north', 'viaduct_ns_panoramic', 'viaduct_west_airport'].includes(e.id))) {
      const alongX = d.maxX - d.minX > d.maxZ - d.minZ;
      const c0 = alongX ? d.minX : d.minZ;
      const c1 = alongX ? d.maxX : d.maxZ;
      const f = alongX ? (d.minZ + d.maxZ) * 0.5 : (d.minX + d.maxX) * 0.5;
      const yAt = (c) => (alongX ? d.getDeckY(c, f) : d.getDeckY(f, c));
      let prevGrade = null;
      for (let c = c0 + 75; c < c1 - 75; c += 2) {
        const g = (yAt(c + 2) - yAt(c)) / 2;
        assert.ok(Math.abs(g) <= 0.052, `${d.id}: inclinação ${(g * 100).toFixed(1)}% em ${c.toFixed(0)}`);
        if (prevGrade !== null) {
          assert.ok(Math.abs(g - prevGrade) < 0.01, `${d.id}: quebra de inclinação em ${c.toFixed(0)}`);
        }
        prevGrade = g;
      }
    }
  });

  it('4. Relevo Urbano Visível nas Avenidas (NW/NE +12.5..15m, Leste +9.5m, Norte +12m->+22m, Sul +10.5m) + Pisos Sensíveis Planos', () => {
    assert.equal(world.getTerrainHeightAt(0, -180), 0, 'Super Banco Central permanece plano em Y=0');
    assert.equal(world.getTerrainHeightAt(-318, -180), 0, 'Torre dos Heróis permanece plana em Y=0');
    assert.equal(world.getTerrainHeightAt(205, 268), 0, 'Espelho d’água do Grande Lago permanece plano em Y=0');
    assert.equal(world.getTerrainHeightAt(-1350, 0), 0, 'Pista do Aeroporto permanece plana em Y=0');

    // Alto do Centro NW & NE (+12.5m..+15.0m nas avenidas X = -384, -252, +252, +384!)
    const nwHillY = world.getTerrainHeightAt(-318, -365);
    const nwAveY = world.getTerrainHeightAt(-384, -365);
    const neHillY = world.getTerrainHeightAt(318, -365);
    assert.ok(nwHillY >= 12.5 && nwHillY <= 15.5, `Alto do Centro NW deve subir a 12.5..15m (atual: ${nwHillY.toFixed(2)}m)`);
    assert.ok(nwAveY >= 10.5, `Avenida X=-384 no Alto NW deve ter ladeira marcante >= 10.5m (atual: ${nwAveY.toFixed(2)}m)`);
    assert.ok(neHillY >= 12.5 && neHillY <= 15.5, `Alto do Centro NE deve subir a 12.5..15m (atual: ${neHillY.toFixed(2)}m)`);

    // Colina da Bela Vista / Centro Leste (~+9.5m)
    const belaVistaY = world.getTerrainHeightAt(310, -58);
    const aveEastZ0 = world.getTerrainHeightAt(310, 0);
    assert.ok(belaVistaY >= 8.5 && belaVistaY <= 10.8, `Colina da Bela Vista Leste deve atingir ~9.5m (atual: ${belaVistaY.toFixed(2)}m)`);
    assert.ok(aveEastZ0 >= 6.5, `Avenida Z=0 Leste deve subir a colina visivelmente (atual: ${aveEastZ0.toFixed(2)}m)`);

    // Subúrbio Norte: ~+12m já em Z = -780 e ~+22m no Mirante Costeiro Norte (Z = -1260)!
    const suburbZ780 = world.getTerrainHeightAt(0, -780);
    const suburbMirante = world.getTerrainHeightAt(0, -1260);
    assert.ok(suburbZ780 >= 10.5 && suburbZ780 <= 14.0, `Subúrbio Norte em Z=-780 deve atingir ~12m (atual: ${suburbZ780.toFixed(2)}m)`);
    assert.ok(suburbMirante >= 20.5 && suburbMirante <= 23.0, `Mirante Costeiro Norte em Z=-1260 deve atingir ~22m (atual: ${suburbMirante.toFixed(2)}m)`);

    // Crista Panorâmica Sul (~+10.5m) antes de descer para Avenida Beira-Mar (Z = +710)!
    const southRidgeY = world.getTerrainHeightAt(-186, 545);
    const beachfrontAveY = world.getTerrainHeightAt(-186, 710);
    assert.ok(southRidgeY >= 9.5 && southRidgeY <= 11.5, `Crista Panorâmica Sul deve atingir ~10.5m (atual: ${southRidgeY.toFixed(2)}m)`);
    assert.ok(beachfrontAveY <= 1.2, `Avenida Beira-Mar Z=710 desce suavemente até a praia (atual: ${beachfrontAveY.toFixed(2)}m)`);
  });

  it('5. Metrô 100% Funcional: Caminhada real pelas 5 Estações, Embarque sem buraco (2.38m), Viagem e Desembarque', () => {
    assert.equal(METRO_STATIONS.length, 5);

    // (A) Desce a pé pelas 3 Escadarias Subterrâneas até as plataformas das Estações 01 e 02 (-10.50m)!
    simulateControllerWalk([
      { x: -58.5, y: 0.35, z: -100.4 },
      { x: -91.0, y: -10.5, z: -100.4 },
      { x: -91.0, y: -10.5, z: -109.5 },
      { x: 0.0, y: -10.5, z: -109.5 }
    ]);
    assert.ok(Math.abs(controller.position.y - -10.5) < 0.08, 'Plataforma Oeste->Centro da Estação 01 em -10.5m');

    simulateControllerWalk([
      { x: 58.5, y: 0.35, z: -100.4 },
      { x: 91.0, y: -10.5, z: -100.4 },
      { x: 91.0, y: -10.5, z: -109.5 },
      { x: 0.0, y: -10.5, z: -109.5 }
    ]);
    assert.ok(Math.abs(controller.position.y - -10.5) < 0.08, 'Plataforma Leste->Centro da Estação 01 em -10.5m');

    simulateControllerWalk([
      { x: -56.5, y: 0.35, z: 18.6 },
      { x: -88.8, y: -10.5, z: 18.6 },
      { x: -88.8, y: -10.5, z: 26.0 },
      { x: -78.0, y: -10.5, z: 26.0 }
    ]);
    assert.ok(Math.abs(controller.position.y - -10.5) < 0.08, 'Plataforma da Estação 02 em -10.5m');

    // (B) Sobe a pé da calçada (pé da escada, fora da rua) até o centro das 3 Estações Elevadas
    for (const stair of world.metroStationStairs) {
      const st = METRO_STATIONS.find((x) => x.id === stair.stationId);
      const dir = Math.sign(stair.stairZBot - stair.stairZTop);
      const startZ = stair.stairZBot + dir * 1.5;
      simulateControllerWalk([
        { x: stair.stairX, y: world.getTerrainHeightAt(stair.stairX, startZ) + 0.35, z: startZ },
        { x: stair.stairX, y: stair.platY, z: stair.stairZTop },
        { x: st.platformSpawn.x, y: stair.platY, z: stair.stairZTop },
        { x: st.platformSpawn.x, y: stair.platY, z: st.platformSpawn.z }
      ]);
      assert.ok(
        Math.abs(controller.position.y - stair.platY) < 0.08,
        `Plataforma Elevada da ${st.code} em +${stair.platY.toFixed(2)}m (y=${controller.position.y.toFixed(2)})`
      );
    }

    // (C) Embarque SENTADO com [E] (Estação 03) -> Viagem -> Desembarque na plataforma (Estação 04)
    const metro = world.metroSystem;
    const train = metro.trains[0];
    const car1 = train.cars[1];
    const stopTrainAt = (st) => {
      train.s = st.stopS;
      train.state = 'STOPPED';
      train.currentStation = st;
      train.stopTimer = 4.0;
      metro._setTrainDoors(train, 1.0, st.doorSide);
      metro._syncTrainCarsTransform(train, true);
    };
    const toLocal = (car, p) => metro._worldToCarLocal(car, p.x, p.z);

    const st03 = metro.spline.stationStops[2];
    stopTrainAt(st03);
    const doorOut = metro._carLocalToWorld(car1, car1.halfW + 1.0, 2.85);
    controller.activeRide = null;
    controller.currentVehicle = null;
    controller.position.set(doorOut.wx, st03.platformSpawn.y, doorOut.wz);
    assert.ok(metro.findBoardableCar(controller.position), 'Porta aberta ao alcance do [E] na plataforma');

    // Portas fechadas: não embarca e o vagão é sólido (não entra andando)
    metro._setTrainDoors(train, 0, 'both');
    assert.equal(metro.findBoardableCar(controller.position), null, 'Sem embarque com portas fechadas');
    controller.position.set(doorOut.wx, st03.platformSpawn.y, doorOut.wz);
    controller.velocity.set(0, 0, 0);
    for (let step = 0; step < 60; step++) {
      const dx = car1.pos.x - controller.position.x;
      const dz = car1.pos.z - controller.position.z;
      const d = Math.hypot(dx, dz) || 1;
      controller.velocity.x = (dx / d) * 7.5;
      controller.velocity.z = (dz / d) * 7.5;
      controller.velocity.y = Math.max(controller.velocity.y - 28 * 0.04, -18);
      controller._moveAndCollide(0.04);
    }
    assert.ok(Math.abs(toLocal(car1, controller.position).lx) >= car1.halfW, 'Vagão é sólido: não entra andando');
    assert.ok(controller.position.y >= st03.platformSpawn.y - 0.05, 'Continua na plataforma');
    metro._setTrainDoors(train, 1.0, st03.doorSide);
    controller.position.set(doorOut.wx, st03.platformSpawn.y, doorOut.wz);
    controller.velocity.set(0, 0, 0);

    assert.equal(controller.toggleVehicleInteraction(), true);
    assert.equal(controller.activeRide?.type, 'metro', 'Herói sentado no vagão');
    controller.update(0.05);
    const seatedLocal = toLocal(car1, controller.position);
    assert.ok(Math.abs(seatedLocal.lx) < car1.halfW && Math.abs(seatedLocal.lz) < car1.halfL, 'Assento dentro do vagão');

    // Viagem: o herói acompanha o vagão e [E] em movimento NÃO desembarca
    metro._setTrainDoors(train, 0, 'both');
    train.state = 'MOVING';
    train.departCooldown = 3.5;
    train.stopTimer = 0;
    train.speed = 24.0;
    const beforeRide = controller.position.clone();
    for (let step = 0; step < 15; step++) {
      controller.update(0.05);
      world.update(0.05, controller.position, controller);
      const loc = toLocal(car1, controller.position);
      assert.ok(Math.abs(loc.lx) < car1.halfW && Math.abs(loc.lz) < car1.halfL, 'Herói continua dentro do vagão em movimento');
      assert.ok(Math.abs(controller.position.y - (car1.pos.y + car1.floorOffsetY + 0.3)) < 0.35, 'Herói na altura do banco');
      const cam = toLocal(car1, camera.position);
      assert.ok(Math.abs(cam.lx) <= car1.halfW && Math.abs(cam.lz) <= car1.halfL, 'Câmera fica dentro do vagão');
    }
    const rideDist = Math.hypot(controller.position.x - beforeRide.x, controller.position.z - beforeRide.z);
    assert.ok(rideDist > 6.0, `Trem levou o herói por ${rideDist.toFixed(2)}m`);
    controller.toggleVehicleInteraction();
    assert.equal(controller.activeRide?.type, 'metro', '[E] com o trem andando não desembarca');

    // Chega na Estação 04 e desembarca com [E] direto na plataforma, fora do vagão
    const st04 = metro.spline.stationStops[3];
    stopTrainAt(st04);
    world.update(0.0, controller.position, controller);
    controller.toggleVehicleInteraction();
    assert.equal(controller.activeRide, null, 'Desembarcou');
    const plat04 = st04.platformSpawn.y;
    assert.ok(Math.abs(controller.position.y - plat04) < 0.05, `Desembarque na plataforma (y=${controller.position.y.toFixed(2)})`);
    const outLocal = toLocal(car1, controller.position);
    assert.ok(Math.abs(outLocal.lx) > car1.halfW, 'Desembarque fora do vagão, do lado da porta');
    const minAfterExit = simulateControllerWalk([
      { x: controller.position.x, y: controller.position.y, z: controller.position.z },
      { x: controller.position.x, y: plat04, z: controller.position.z + 4.0 }
    ]);
    assert.ok(minAfterExit >= plat04 - 0.05, `Anda na plataforma depois de desembarcar (minY=${minAfterExit.toFixed(3)})`);
  });

  it('5b. Metrô não "gruda" quem está na rua: teto só é apoio bem acima do chão e vagão é sólido', () => {
    const metro = world.metroSystem;
    const train = metro.trains[1];
    const car = train.cars[1];
    controller.activeRide = null;

    // Teto do vagão quase na altura da rua (rampa do portal): não pode virar apoio de quem está no chão
    car.pos.set(-82, -5.0, -150);
    car.rotY = 0;
    car.rotX = 0;
    const roofY = car.pos.y + car.roofOffsetY;
    assert.equal(metro.findSupportingCarAt(car.pos.x, car.pos.z, roofY, roofY - 0.2), null);

    // Teto bem acima do chão: continua andável (heróis no teto do trem)
    assert.equal(metro.findSupportingCarAt(car.pos.x, car.pos.z, roofY, roofY - 6.0)?.zone, 'roof');

    // Piso interno não é mais apoio (sem andar dentro do vagão)
    assert.equal(metro.findSupportingCarAt(car.pos.x, car.pos.z, car.pos.y + car.floorOffsetY, -Infinity), null);

    // Colisão: quem encosta no vagão é empurrado para fora, mesmo com as portas abertas
    car.leftOpenRatio = 1;
    car.rightOpenRatio = 1;
    const p = new THREE.Vector3(car.pos.x + car.halfW - 0.2, car.pos.y + 1.0, car.pos.z + 2.85);
    metro.resolveHorizontalCarCollision(p, 0.45);
    assert.ok(p.x - car.pos.x >= car.halfW + 0.44, 'Empurrado para fora pela lateral');
    metro._syncTrainCarsTransform(train, true);
  });

  it('5c. Linha elevada sem pilar na pista: pórticos nas calçadas e vãos máximos controlados', async () => {
    const { isInsideAnyRoad, SUPPORT_CONFIG } = await import('../src/world/metro/MetroSupportPlanner.js');
    const bents = world.metroSupports;
    assert.ok(Array.isArray(bents) && bents.length >= 100, `Apoios suficientes na linha elevada (${bents?.length})`);
    assert.ok(bents.filter((b) => b.kind === 'portal').length >= 100, 'Maioria dos apoios é pórtico sobre a rua');

    for (const b of bents) {
      for (const c of b.cols) {
        assert.ok(
          !isInsideAnyRoad(world.mapRoads, c.x, c.z, SUPPORT_CONFIG.colHalf),
          `Pilar em (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) não pode ficar dentro de pista`
        );
        assert.ok(b.beamY - SUPPORT_CONFIG.beamH * 0.5 > c.groundY + 3, 'Pilar com altura real até a viga');
      }
      if (b.kind === 'portal') {
        // A viga do pórtico passa por baixo do tabuleiro: vão livre para carros/caminhões embaixo
        assert.ok(b.beamY - SUPPORT_CONFIG.beamH * 0.5 > 8, `Viga alta o suficiente (y=${b.beamY.toFixed(1)})`);
      }
    }

    // Nenhum vão gigante sem apoio na linha elevada
    let maxGap = 0;
    for (let i = 1; i < bents.length; i++) maxGap = Math.max(maxGap, bents[i].s - bents[i - 1].s);
    const elevStart = bents[0].s;
    assert.ok(elevStart >= 0 && maxGap <= 105, `Maior vão entre apoios ${maxGap.toFixed(1)}m`);

    // As 3 estações elevadas têm apoio por baixo da plataforma
    for (const st of world.metroSystem.stations.filter((x) => x.kind === 'elevated')) {
      const under = bents.filter((b) => Math.abs(b.s - st.stopS) <= 31);
      assert.ok(under.length >= 1, `Estação ${st.code} apoiada por ${under.length} pórticos`);
    }
  });

  it('5d. Rua livre: trilho alto sobre a rua, escadas e bocas do metrô fora da pista, trilho elevado andável', async () => {
    const { isInsideAnyRoad } = await import('../src/world/metro/MetroSupportPlanner.js');
    const { PROFILE_CONFIG } = await import('../src/world/metro/MetroVerticalProfile.js');
    const { METRO_ISLAND_CUTOUTS } = await import('../src/world/MetroSystemBuilder.js');
    const metro = world.metroSystem;
    const sp = metro.spline;
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();

    // (A) Vão livre: fundo da viga >= 16m acima do chão em todo trecho da linha elevada que passa sobre rua
    let minClear = Infinity;
    let worstAt = '';
    for (let s = 0; s < sp.totalLength; s += 5) {
      sp.sampleAtS(s, p, t);
      if (p.y < PROFILE_CONFIG.elevatedBaseY) continue;
      const L = Math.hypot(t.x, t.z) || 1;
      let g = 0;
      let overStreet = false;
      for (let o = -14; o <= 14; o += 2) {
        const sx = p.x - (t.z / L) * o;
        const sz = p.z + (t.x / L) * o;
        g = Math.max(g, world.getTerrainHeightAt(sx, sz));
        if (isInsideAnyRoad(world.mapRoads, sx, sz, 0)) overStreet = true;
      }
      if (!overStreet) continue;
      const clear = p.y - PROFILE_CONFIG.structureDepth - g;
      if (clear < minClear) {
        minClear = clear;
        worstAt = `(${p.x.toFixed(0)}, ${p.z.toFixed(0)})`;
      }
    }
    assert.ok(minClear >= 15.9, `Vão livre mínimo sobre a rua ${minClear.toFixed(2)}m em ${worstAt}`);

    // Rampas suaves criadas pelo relevo na linha elevada principal (as rampas dos portais do túnel ficam de fora)
    let maxGrade = 0;
    const q = new THREE.Vector3();
    for (let s = 0; s < sp.totalLength; s += 2) {
      sp.sampleAtS(s, p);
      sp.sampleAtS(s + 2, q);
      if (p.y < 14 || q.y < 14) continue;
      if (Math.abs(Math.abs(p.x) - 82) < 20 && p.z > -245 && p.z < -130) continue; // rampas dos portais do túnel
      maxGrade = Math.max(maxGrade, Math.abs(q.y - p.y) / Math.max(0.5, Math.hypot(q.x - p.x, q.z - p.z)));
    }
    assert.ok(maxGrade <= 0.045, `Inclinação máxima da linha elevada ${(maxGrade * 100).toFixed(1)}%`);

    // (B) Escadas das estações elevadas e bocas do metrô subterrâneo: nada encosta na pista
    assert.equal(world.metroStationStairs.length, 3, 'As 3 estações elevadas têm escada');
    for (const st of world.metroStationStairs) {
      const z0 = Math.min(st.stairZTop, st.stairZBot);
      const z1 = Math.max(st.stairZTop, st.stairZBot);
      for (let z = z0; z <= z1; z += 1) {
        for (const x of [st.stairX - st.stairHalfW, st.stairX + st.stairHalfW]) {
          assert.ok(!isInsideAnyRoad(world.mapRoads, x, z, 0), `Escada da ${st.code} invade a pista em (${x.toFixed(1)}, ${z.toFixed(1)})`);
        }
      }
    }
    for (const c of METRO_ISLAND_CUTOUTS) {
      for (const [x, z] of [[c.minX, c.minZ], [c.maxX, c.maxZ], [c.minX, c.maxZ], [c.maxX, c.minZ]]) {
        assert.ok(!isInsideAnyRoad(world.mapRoads, x, z, -0.01), `Boca do metrô ${c.id} invade a pista`);
      }
    }

    // Pilares e pé das escadas sempre em chão que não é rua: calçada, calçadão/praça/parque (mapBlocks) ou água.
    // (A base da ilha fora disso é asfalto = rua.) O metrô não cria calçada nova no asfalto.
    const { makeSidewalkLookup } = await import('../src/world/metro/MetroTrackAndViaduct.js');
    const footing = makeSidewalkLookup(world);
    const onSidewalk = (x, z) => footing(x, z) || Boolean(world.isDeepWaterAt?.(x, z));
    for (const b of world.metroSupports) {
      for (const c of b.cols) {
        if (b.kind !== 'portal') continue; // pilar único só existe fora de rua (rampas nas praças)
        const h = 0.7;
        for (const [px, pz] of [[c.x - h, c.z - h], [c.x + h, c.z - h], [c.x - h, c.z + h], [c.x + h, c.z + h]]) {
          assert.ok(onSidewalk(px, pz), `Pilar em (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) precisa estar inteiro fora do asfalto`);
        }
      }
    }
    for (const st of world.metroStationStairs) {
      assert.ok(onSidewalk(st.stairX, st.stairZBot), `Pé da escada da ${st.code} sobre calçada`);
    }

    // (C) Plataformas sobem junto com o trilho (piso do vagão alinhado com a plataforma)
    for (const st of metro.stations.filter((x) => x.kind === 'elevated')) {
      sp.sampleAtS(st.stopS, p);
      assert.ok(Math.abs(st.platformSpawn.y - (p.y + 0.65)) < 0.02, `Plataforma da ${st.code} alinhada com o vagão`);
    }

    // (D) Trilho elevado andável: piso em cima do trilho e muretas com colisão
    for (const [x, z] of [[-388.5, -150], [-516, 300], [-300, 556], [200, 710], [518, 100]]) {
      const s = (() => {
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < sp.totalLength; k += 1) {
          sp.sampleAtS(k, p);
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        return best;
      })();
      sp.sampleAtS(s, p);
      const deckY = world.getSurfaceHeightAt(p.x, p.z, p.y + 1.0);
      assert.ok(Math.abs(deckY - (p.y + 0.18)) < 0.1, `Piso andável no trilho em (${x}, ${z}): ${deckY.toFixed(2)} vs ${(p.y + 0.18).toFixed(2)}`);
      assert.ok(world.getSurfaceHeightAt(p.x, p.z, 0.3) < p.y - 5, 'Quem está na rua embaixo continua no chão');
    }

    // Anda em cima do trilho na Av. X = -384 e não atravessa a mureta lateral
    controller.activeRide = null;
    sp.sampleAtS(0, p);
    const walkS = metro.stations[2].stopS - 120;
    sp.sampleAtS(walkS, p);
    controller.position.set(p.x, p.y + 0.3, p.z);
    controller.velocity.set(0, 0, 0);
    for (let step = 0; step < 50; step++) {
      controller.velocity.x = 7.5; // anda de lado, contra a mureta
      controller.velocity.z = 0;
      controller.velocity.y = Math.max(controller.velocity.y - 28 * 0.04, -18);
      controller._moveAndCollide(0.04);
    }
    assert.ok(Math.abs(controller.position.y - (p.y + 0.18)) < 0.1, `Continua em pé no trilho (y=${controller.position.y.toFixed(2)})`);
    assert.ok(Math.abs(controller.position.x - p.x) < 3.6, 'Mureta lateral segura o jogador no trilho');
  });

  it('5e. Viadutos encaixam na avenida (mesma largura) e carro pulando passa por cima de obstáculo baixo', async () => {
    const { parallelCorridorAt } = await import('../src/world/StreetPortalPlanner.js');
    // (A) Tabuleiro com a mesma largura e alinhamento da avenida onde a rampa encosta
    const checks = [
      ['viaduct_ew_north', false, -440, -382],
      ['viaduct_ns_panoramic', true, 252, -70],
      ['viaduct_ew_central_ramp_pair', true, 0, -290]
    ];
    for (const [id, alongZ, a, b] of checks) {
      const deck = world.elevatedDecks.find((d) => d.id === id);
      assert.ok(deck, `${id} registrado`);
      const x = alongZ ? a : a;
      const z = alongZ ? b : b;
      const road = parallelCorridorAt(world.mapRoads, x, z, alongZ);
      assert.ok(road, `${id}: avenida embaixo da rampa`);
      const d0 = alongZ ? deck.minX : deck.minZ;
      const d1 = alongZ ? deck.maxX : deck.maxZ;
      assert.ok(Math.abs(d0 - road.lo) < 0.05 && Math.abs(d1 - road.hi) < 0.05, `${id}: tabuleiro ${d0}..${d1} = avenida ${road.lo}..${road.hi}`);
    }

    // (B) Cerca baixa do parque (1.9m) atravessando a Av. X = 252: no chão o carro bate, pulando passa por cima
    const car = destructibles.objects.find((o) => o.mesh.userData?.carType === 'apex_gtx');
    assert.ok(car, 'Deve existir um carro terrestre');
    controller.activeRide = null;
    if (controller.currentVehicle) controller.exitVehicle();
    car.mesh.position.set(254, world.getTerrainHeightAt(254, 146), 146);
    car.mesh.rotation.y = 0; // apontando para +Z (cerca em z ~ 152)
    controller.enterVehicle(car);
    controller.keys.forward = true;
    for (let i = 0; i < 45; i++) controller.update(1 / 30);
    controller.keys.forward = false;
    assert.ok(car.mesh.position.z < 151.5, `No chão o carro bate na cerca (z=${car.mesh.position.z.toFixed(2)})`);

    car.mesh.position.set(254, 4.5, 146);
    controller.position.set(254, 4.5, 146);
    controller.vehicleAirborne = true;
    controller.vehicleAirVelY = 4;
    controller.vehicleSpeed = 22;
    controller.keys.forward = true;
    for (let i = 0; i < 12; i++) controller.update(1 / 30);
    controller.keys.forward = false;
    assert.ok(car.mesh.position.z > 153, `Pulando, o carro passa por cima da cerca baixa (z=${car.mesh.position.z.toFixed(2)})`);
    controller.exitVehicle();
  });

  it('6. SignBoardHelper gera placas com proporção real (aspect = W/H) e array de 6 materiais sem esticar bordas', () => {
    const wideSign = createSignBoardMesh({
      width: 20.0,
      height: 2.5,
      depth: 0.5,
      title: 'SUPER BANCO CENTRAL METROPOLITANO',
      subText: 'ENTRADA PRINCIPAL • COFRE BLINDADO'
    });
    assert.equal(Array.isArray(wideSign.material), true);
    assert.equal(wideSign.material.length, 6);
    assert.equal(wideSign.material[0].map, null);
    const faceTex = wideSign.material[4].map;
    assert.ok(faceTex && faceTex.image.width === 2048 && faceTex.image.height === 256);
  });
});
