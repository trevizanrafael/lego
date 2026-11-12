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

  it('3. Viadutos realmente suspensos (vão livre >= 9.5m acima da rua local), sombra projetada e rampas vazadas', () => {
    assert.equal(getMetroCutoutFloorY(-140, 134), null);
    assert.equal(getMetroCutoutFloorY(384, -150), null);

    // Verifica folga livre >= 9.5m (deck a +12.4m acima da rua local) nos 3 Viadutos!
    const v1Ground = world.getTerrainHeightAt(120, -382);
    const v1Deck = world.getSurfaceHeightAt(120, -382, v1Ground + 12.4);
    assert.ok(v1Deck - v1Ground >= 11.5, `Viaduto 01 deve ter >= 11.5m sobre a rua (atual: ${(v1Deck - v1Ground).toFixed(2)}m)`);
    assert.ok(v1Deck - 1.15 - v1Ground >= 9.5, 'Vão livre sob as vigas do Viaduto 01 deve ser >= 9.5m');

    const v2Ground = world.getTerrainHeightAt(252, 134);
    const v2Deck = world.getSurfaceHeightAt(252, 134, v2Ground + 12.4);
    assert.ok(v2Deck - v2Ground >= 11.5, `Viaduto 02 deve ter >= 11.5m sobre a rua (atual: ${(v2Deck - v2Ground).toFixed(2)}m)`);
    assert.ok(v2Deck - 1.15 - v2Ground >= 9.5, 'Vão livre sob as vigas do Viaduto 02 deve ser >= 9.5m');

    const v3Ground = world.getTerrainHeightAt(-516, 0);
    const v3Deck = world.getSurfaceHeightAt(-516, 0, v3Ground + 12.4);
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

    // (B) Sobe a pé da calçada até o centro das 3 Estações Elevadas (+14.85m) pelo vão aberto de 6.0m!
    simulateControllerWalk([
      { x: -368.0, y: world.getTerrainHeightAt(-368.0, 9.0) + 0.35, z: 9.0 },
      { x: -368.0, y: 14.85, z: -35.0 },
      { x: -379.87, y: 14.85, z: -35.0 },
      { x: -379.87, y: 14.85, z: -60.0 }
    ]);
    assert.ok(Math.abs(controller.position.y - 14.85) < 0.08, 'Plataforma Elevada da Estação 03 em +14.85m');

    simulateControllerWalk([
      { x: -105.5, y: world.getTerrainHeightAt(-105.5, 701.0) + 0.35, z: 701.0 },
      { x: -105.5, y: 14.85, z: 668.0 },
      { x: -116.87, y: 14.85, z: 668.0 },
      { x: -116.87, y: 14.85, z: 650.0 }
    ]);
    assert.ok(Math.abs(controller.position.y - 14.85) < 0.08, 'Plataforma Elevada da Estação 04 em +14.85m');

    simulateControllerWalk([
      { x: 499.8, y: world.getTerrainHeightAt(499.8, -115.0) + 0.35, z: -115.0 },
      { x: 499.8, y: 14.85, z: -155.0 },
      { x: 509.37, y: 14.85, z: -155.0 },
      { x: 509.37, y: 14.85, z: -180.0 }
    ]);
    assert.ok(Math.abs(controller.position.y - 14.85) < 0.08, 'Plataforma Elevada da Estação 05 em +14.85m');

    // (C) Embarque direto sem buraco (borda a 2.38m + overlap 0.28m): Subsolo (Estação 01) e Elevado (Estação 03 -> Viagem -> Desembarque na Estação 04)!
    const train = world.metroSystem.trains[0];
    const st01 = world.metroSystem.spline.stationStops[0];
    train.s = st01.stopS;
    train.state = 'STOPPED';
    train.currentStation = st01;
    train.stopTimer = 4.0;
    world.metroSystem._setTrainDoors(train, 1.0, st01.doorSide);
    world.metroSystem._syncTrainCarsTransform(train, true);

    const car1 = train.cars[1];
    const door1X = car1.pos.x + Math.sin(car1.rotY) * 2.85;
    const minBoardY01 = simulateControllerWalk([
      { x: door1X, y: -10.5, z: -111.5 },
      { x: door1X, y: -10.5, z: -116.0 }
    ]);
    assert.ok(minBoardY01 >= -10.55, `Jogador NUNCA deve cair nos trilhos ao embarcar na Estação 01 (minY=${minBoardY01.toFixed(3)})`);
    assert.equal(
      world.metroSystem.findSupportingCarAt(controller.position.x, controller.position.z, controller.position.y)?.zone,
      'interior'
    );

    // Embarca na Estação Elevada 03, viaja com o trem em movimento e desembarca caminhando na Estação 04!
    const st03 = world.metroSystem.spline.stationStops[2];
    train.s = st03.stopS;
    train.state = 'STOPPED';
    train.currentStation = st03;
    train.stopTimer = 4.0;
    world.metroSystem._setTrainDoors(train, 1.0, st03.doorSide);
    world.metroSystem._syncTrainCarsTransform(train, true);

    const door3Z = car1.pos.z + Math.cos(car1.rotY) * 2.85;
    const minBoardY03 = simulateControllerWalk([
      { x: -384.2, y: 14.85, z: door3Z },
      { x: -388.5, y: 14.85, z: door3Z }
    ]);
    assert.ok(minBoardY03 >= 14.8, `Jogador NUNCA deve cair nos trilhos ao embarcar na Estação Elevada 03 (minY=${minBoardY03.toFixed(3)})`);
    assert.equal(
      world.metroSystem.findSupportingCarAt(controller.position.x, controller.position.z, controller.position.y)?.zone,
      'interior'
    );

    // Fecha portas, viaja e verifica transporte físico contínuo sem cair!
    world.metroSystem._setTrainDoors(train, 0, 'both');
    train.state = 'MOVING';
    train.departCooldown = 3.5;
    train.stopTimer = 0;
    train.speed = 24.0;
    const beforeRide = controller.position.clone();
    for (let step = 0; step < 15; step++) {
      world.update(0.05, controller.position, controller);
      controller.update(0.05);
      assert.ok(controller.position.y >= 14.75, 'Jogador permanece firme dentro do vagão durante a viagem');
    }
    const rideDist = Math.hypot(controller.position.x - beforeRide.x, controller.position.z - beforeRide.z);
    assert.ok(rideDist > 6.0, `Trem transportou fisicamente o jogador por ${rideDist.toFixed(2)}m`);

    // Chega na Estação 04 (Praia Sul), abre portas e desembarca caminhando para a plataforma!
    const st04 = world.metroSystem.spline.stationStops[3];
    const prevCarPos = car1.pos.clone();
    train.s = st04.stopS;
    train.state = 'STOPPED';
    train.currentStation = st04;
    train.stopTimer = 4.0;
    world.metroSystem._setTrainDoors(train, 1.0, st04.doorSide);
    world.metroSystem._syncTrainCarsTransform(train, true);
    const door4Z = car1.pos.z + Math.cos(car1.rotY) * 2.85;
    controller.position.set(car1.pos.x, car1.pos.y + car1.floorOffsetY, door4Z);
    assert.notEqual(prevCarPos.z, car1.pos.z);

    const minAlightY04 = simulateControllerWalk([
      { x: car1.pos.x, y: 14.85, z: door4Z },
      { x: -118.0, y: 14.85, z: door4Z }
    ]);
    assert.ok(minAlightY04 >= 14.8, `Desembarque na Estação 04 sem cair nos trilhos (minY=${minAlightY04.toFixed(3)})`);
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
