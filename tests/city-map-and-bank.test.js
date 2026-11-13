import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment, resetTestListeners } from './setup-env.js';

setupTestEnvironment();

const { Minifigure } = await import('../src/entities/Minifigure.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld, MAP_REGIONS, BUILDING_STYLES } = await import('../src/world/TestBlockWorld.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { getSvgIcon } = await import('../src/ui/TacticalIcons.js');

function createFullCityHarness() {
  resetTestListeners();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 2600);
  const hud = new LegoHud(35000);
  // Simula o jogador já dentro do jogo (tela de título fechada), senão o controle zera os inputs
  hud.isTitleScreenActive = false;
  const destructibles = new DestructibleManager(scene, hud);
  const world = new TestBlockWorld(scene, destructibles);
  const minifig = new Minifigure('caveira');
  scene.add(minifig.root);
  const domElement = globalThis.document.getElementById('game-container');
  const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);
  controller.onToggleFullMap = () => hud.toggleFullMap(world, controller);
  return { scene, camera, hud, destructibles, world, minifig, controller };
}

describe('PASSO 4 OVERHAUL — Mapa Metropolitano 3000x3000, Super Banco Monumental, Radar Dinâmico & Carros [E]', () => {
  it('1. Mapa possui escala metropolitana (3000x3000), dezenas de quarteirões/prédios e resolve as 10 Regiões', () => {
    const { world } = createFullCityHarness();
    assert.equal(MAP_REGIONS.length, 10, 'O mapa deve possuir exatamente 10 regiões fixas');
    assert.ok(world.mapBlocks.length >= 60, `Cidade deve ter dezenas de quarteirões reais (atual: ${world.mapBlocks.length})`);
    assert.ok(world.mapBuildings.length >= 140, `Cidade deve ter alta densidade de prédios e casas (atual: ${world.mapBuildings.length})`);
    assert.ok(world.mapRoads.length >= 16, 'Malha viária deve ter avenidas de 4 pistas e ruas secundárias');

    for (const region of MAP_REGIONS) {
      const detected = world.getRegionAt(region.spawn.x, region.spawn.y, region.spawn.z);
      assert.equal(
        detected.id,
        region.id,
        `Coordenada de spawn de ${region.name} deveria resolver para ${region.id}, mas retornou ${detected.id}`
      );
    }

    // Verifica detecção especial do Interior Monumental do Super Banco Central
    const insideBank = world.getRegionAt(0, 1.0, -170);
    assert.equal(insideBank.id, 'super_banco_interior');
    assert.ok(insideBank.name.includes('SUPER BANCO'));
  });

  it('2. Super Banco de 4 andares: entra pela frente, sobe de rampa e de elevador, e o cofre fica no 4º andar', () => {
    const { world, destructibles, controller, hud } = createFullCityHarness();
    const bank = world.superBankData;

    assert.equal(bank.floorsCount, 4, 'Banco tem 4 andares');
    assert.ok(bank.width >= 140, `Banco mais largo (${bank.width}m)`);
    assert.equal(bank.rampsCount, 3, '3 rampas ligando os andares');
    assert.equal(bank.hasElevator, true, 'Elevador [E]');
    assert.equal(bank.frontColumnsCount, 8, 'Fachada com 8 colunas clássicas');
    assert.equal(bank.goldenStatuesCount, 2, '2 estátuas douradas na escadaria');
    assert.equal(bank.hasSkylight, true, 'Claraboia no terraço');
    assert.equal(bank.hasRooftopHelipad, true, 'Heliponto no terraço');

    const walk = (frames, yaw = 0) => {
      controller.yaw = yaw;
      controller.keys.forward = true;
      for (let i = 0; i < frames; i++) controller.update(1 / 30);
      controller.keys.forward = false;
    };

    // Entra pela porta central da frente
    controller.position.set(0, 0.35, -132);
    walk(65);
    assert.ok(controller.position.z < -145, `Entra no saguão (z=${controller.position.z.toFixed(2)})`);

    // Sobe a rampa oeste (R1) do 1º para o 2º andar
    controller.position.set(-66, 0.4, -142);
    controller.velocity?.set(0, 0, 0);
    walk(260);
    assert.ok(
      controller.position.y > bank.floors[1] - 0.6,
      `Rampa leva ao 2º andar (y=${controller.position.y.toFixed(2)}, z=${controller.position.z.toFixed(2)})`
    );

    // Elevador [E]: do 1º para o 2º andar
    controller.position.set(world.bankElevator.callX, bank.floors[0] + 0.05, world.bankElevator.callZ);
    assert.equal(world.bankElevator.tryUse(controller), true);
    assert.ok(Math.abs(controller.position.y - bank.floors[1]) < 0.5, 'Elevador sobe um andar');
    world.bankElevator.cooldown = 0;
    controller.position.set(world.bankElevator.callX, bank.floors[3] + 0.05, world.bankElevator.callZ);
    world.bankElevator.tryUse(controller);
    assert.ok(Math.abs(controller.position.y - bank.floors[0]) < 0.5, 'Do topo, o elevador volta ao térreo');

    // Cofre no 4º andar: a porta circular bloqueia
    const f4 = bank.floors[3];
    const vaultDoor = destructibles.objects.find((o) => o.type === 'bank_vault_door' && !o.destroyed);
    assert.ok(vaultDoor, 'Porta circular gigante do cofre existe');
    assert.ok(Math.abs(vaultDoor.mesh.position.y - (f4 + 5.6)) < 0.1, 'Porta do cofre está no 4º andar');
    controller.position.set(0, f4 + 0.05, -199);
    controller.velocity?.set(0, 0, 0);
    walk(40);
    assert.ok(controller.position.z > -205, `Porta fechada bloqueia (z=${controller.position.z.toFixed(2)})`);

    destructibles.damageObject(vaultDoor, 999, new THREE.Vector3(0, 0, -1), { goldMelting: true });
    assert.equal(vaultDoor.destroyed, true);
    walk(30);
    assert.ok(controller.position.z < -208, `Com a porta aberta entra na sala do ouro (z=${controller.position.z.toFixed(2)})`);
    assert.ok(Math.abs(controller.position.y - f4) < 0.8, 'Continua no 4º andar');

    const goldStacks = destructibles.objects.filter(
      (o) => o.type === 'gold_vault' && Math.abs(o.mesh.position.z - -211) < 2 && o.mesh.position.y > f4
    );
    assert.equal(goldStacks.length, 4, '4 pilhas de barras de ouro na sala do cofre');
    assert.ok(goldStacks.every((g) => g.goldOnly === true));

    assert.ok(destructibles.ambientStuds.length >= 30, 'Dezenas de studs na sala do cofre');
    const studsBefore = hud.totalStuds;
    for (let s = 0; s < 25; s++) {
      destructibles.update(0.04, new THREE.Vector3(0, f4 + 0.4, -214));
    }
    assert.ok(hud.totalStuds > studsBefore, 'Andar na sala do cofre coleta os studs');
  });

  it('3. Subúrbio Norte: 4/6/8 lotes com grama, 5 estilos de casas, Pizzaria, Quadra de Basquete e 6 Bombas do Posto em reação em cadeia', () => {
    const { world, destructibles } = createFullCityHarness();

    assert.ok(world.suburbBlocks && world.suburbBlocks.length >= 45, 'Subúrbio Norte deve ter todos os quarteirões residenciais reconstruídos');
    const lotCounts = new Set(world.suburbBlocks.map((b) => b.totalLots));
    assert.ok(lotCounts.has(4) && lotCounts.has(6) && lotCounts.has(8), 'Quarteirões residenciais devem alternar entre 4, 6 e 8 lotes simétricos');

    // Verifica os 3 Quarteirões Especiais do Subúrbio
    const labels = new Set(world.mapBuildings.map((b) => b.label).filter(Boolean));
    assert.ok(labels.has('POSTO OCTAN') && labels.has('CONVENIÊNCIA'), 'Deve existir o Posto de Gasolina com Loja de Conveniência');
    assert.ok(labels.has('PIZZARIA LEGO') && labels.has('DINER & MERCADO'), 'Deve existir o Quarteirão Comercial com Pizzaria LEGO e Lanchonete Diner');
    assert.ok(labels.has('QUADRA BASQUETE'), 'Deve existir a Praça Residencial com Quadra de Basquete de Rua');

    // Verifica caixas de correio e cercas brancas quebráveis nas calçadas do Subúrbio
    const mailboxes = destructibles.objects.filter((o) => o.type === 'mailbox');
    assert.ok(mailboxes.length >= 20, 'Calçadas do Subúrbio devem ter caixas de correio coloridas quebráveis');

    const pumps = destructibles.objects.filter((o) => o.type === 'gas_pump' && !o.destroyed);
    assert.equal(pumps.length, 6, 'O Posto de Gasolina deve ter 6 bombas de combustível 3D quebráveis');

    destructibles.damageObject(pumps[0], 100);

    const remainingPumps = destructibles.objects.filter((o) => o.type === 'gas_pump' && !o.destroyed);
    assert.equal(
      remainingPumps.length,
      0,
      'A explosão da primeira bomba deve detonar todas as 6 bombas em reação em cadeia'
    );
  });

  it('4. O Aeroporta-Aviões no Céu (Y=410m, casco de 26m) sustenta pouso no convés sem bloquear a rua abaixo', () => {
    const { world, controller } = createFullCityHarness();

    // Verifica que o casco principal tem 26.4m de espessura (de Y=384m a Y=410.4m)
    const hullCollider = world.colliders.find((c) => Math.abs(c.maxY - 410.4) < 0.1 && c.minY === 384);
    assert.ok(hullCollider, 'Casco do Aeroporta-Aviões deve ter 26 unidades de espessura (minY=384, maxY=410.4)');

    // 1) No chão embaixo do Aeroporta-Aviões (x=0, y=0.35, z=-50), o jogador anda livremente
    controller.position.set(0, 0.35, -45);
    controller.yaw = 0;
    controller.keys.forward = true;
    for (let i = 0; i < 20; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    assert.ok(controller.position.z < -48, 'Andar na rua embaixo do Aeroporta-Aviões não deve colidir com o casco aéreo');

    // 2) Caindo de Y=413m sobre o convés do Aeroporta-Aviões (x=0, z=-50), o jogador pousa em Y ≈ 410.4m
    controller.position.set(0, 413.0, -50);
    controller.velocity.set(0, 0, 0);
    for (let i = 0; i < 30; i++) {
      controller.update(1 / 30);
    }
    assert.ok(
      controller.position.y >= 410.0 && controller.position.y <= 411.2,
      `Jogador deve pousar firme no convés do Aeroporta-Aviões em Y≈410.4m (atual: ${controller.position.y.toFixed(2)})`
    );
    assert.equal(controller.isGrounded, true, 'Jogador deve ficar isGrounded=true sobre o Aeroporta-Aviões');
  });

  it('5. Radar Local Dinâmico (Zoom por velocidade), Toast de Região, Waypoint 3D (Beacon) e Viagem Rápida [M]', () => {
    const { world, controller, hud } = createFullCityHarness();

    // 1) Radar Local começa com raio próximo (~175m) e afasta suavemente em alta velocidade
    const initialRadarRadius = hud.minimapViewRadius;
    assert.equal(initialRadarRadius, 175);

    for (let i = 0; i < 25; i++) {
      hud.updateMinimap(controller.position, 0, 0, world.regions[0], world, 36.0, 0.05);
    }
    assert.ok(
      hud.minimapViewRadius > 240,
      `Radar deve dar zoom out dinâmico em alta velocidade (raio=${hud.minimapViewRadius.toFixed(1)}m)`
    );

    // 2) Marcar um Waypoint cria o Feixe de Luz Vertical (Beacon) no mundo 3D e some ao chegar perto
    world.setWaypoint(400, -300);
    assert.ok(world.waypoint, 'Waypoint deve estar ativo');
    assert.equal(world.beaconGroup.visible, true, 'Feixe de luz 3D (Beacon) deve ficar visível');

    // Quando o jogador chega a menos de 14m do Waypoint, o Beacon desaparece automaticamente
    world.update(0.016, new THREE.Vector3(405, 0.5, -295));
    assert.equal(world.waypoint, null, 'Waypoint deve sumir automaticamente ao chegar no destino');
    assert.equal(world.beaconGroup.visible, false);

    // 3) Abrir Mapa [M] e fazer Viagem Rápida estilo GTA V (Câmera de Satélite em Etapas) para a Ilha da Prisão
    controller._onKey({ code: 'KeyM', repeat: false }, true);
    assert.equal(hud.isFullMapOpen, true, 'Tecla M deve abrir o Mapa Completo Interativo');

    const prisonRegion = MAP_REGIONS.find((r) => r.id === 'ilha_prisao');
    hud._teleportPlayerTo(controller, prisonRegion.spawn, prisonRegion.shortName);
    assert.equal(hud.isFullMapOpen, false);
    assert.equal(controller.position.x, prisonRegion.spawn.x);
    assert.equal(controller.position.z, prisonRegion.spawn.z);
    assert.equal(controller.fastTravelState.active, true, 'Viagem rápida deve iniciar a sequência de câmera de satélite estilo GTA V');

    // No meio da transição (t ≈ 0.7s), a câmera deve estar lá no alto (Y > 380m) olhando de cima tipo tabuleiro
    controller.update(0.75);
    assert.ok(
      controller.camera.position.y > 380,
      `Câmera de satélite deve subir em etapas até o topo orbital (camY=${controller.camera.position.y.toFixed(1)}m)`
    );

    // Ao completar os 2.25s da transição, a câmera retorna para 3ª pessoa e libera o controle
    controller.update(1.65);
    assert.equal(controller.fastTravelState, null, 'Transição de satélite deve encerrar e devolver o controle ao jogador');

    // 4) Verifica que TODOS os pontos de Viagem Rápida (10 Regiões + 11 Landmarks, incluindo Torre dos Heróis e Porto)
    //    spawnam o jogador 100% livre de colisores e permitem andar com WASD imediatamente!
    const allTpTargets = [
      ...world.regions.map((r) => ({ id: r.id, spawn: r.spawn })),
      ...world.landmarks.map((l) => ({ id: l.id, spawn: l.spawn }))
    ];
    for (const tp of allTpTargets) {
      hud._teleportPlayerTo(controller, tp.spawn, tp.id);
      controller.fastTravelState = null; // Pula a animação da câmera para testar o movimento imediato
      assert.equal(controller.isFlying, false, `TP para ${tp.id} deve deixar o herói em pé no chão (isFlying=false)`);

      const startPos = controller.position.clone();
      controller.yaw = 0;
      controller.keys.forward = true;
      for (let step = 0; step < 25; step++) {
        controller.update(1 / 30);
      }
      controller.keys.forward = false;

      const walkedDist = Math.hypot(controller.position.x - startPos.x, controller.position.z - startPos.z);
      assert.ok(
        walkedDist > 3.5,
        `Jogador deve conseguir andar livremente após TP rápido para ${tp.id} (andou=${walkedDist.toFixed(2)}m a partir de ${startPos.x.toFixed(1)},${startPos.z.toFixed(1)})`
      );
    }
  });

  it('6. Tecla [E] entra e sai de carros próximos (sem disparar granada/raio) e permite dirigir pelas avenidas', () => {
    const { destructibles, controller, minifig } = createFullCityHarness();

    // 1) Longe de qualquer carro, apertar E não arremessa granada nem entra em carro
    controller.position.set(0, 2.2, 250); // No Parque Central
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.equal(destructibles.grenades.length, 0, 'Tecla E não deve mais lançar granada (exclusivo do Mouse 2)');
    assert.ok(controller.currentVehicle === null, 'Longe de carros, E não deve entrar em veículo');

    // 1.5) Verifica se todos os modelos de veículos terrestres existem na cidade
    //      (desde o reset do mundo livre eles ficam distribuídos pelas regiões, não mais enfileirados na frente do Banco)
    const landFleetCars = destructibles.objects.filter(
      (o) => o.type === 'car' && !o.mesh.userData?.vehicleSpec?.category
    );
    const uniqueFleetTypes = new Set(landFleetCars.map((o) => o.mesh.userData.carType));
    assert.ok(
      uniqueFleetTypes.size >= 19,
      `Todos os modelos de veículos terrestres (incluindo moto_cv, moto_pcc e moto_policia) devem existir na cidade (encontrados: ${uniqueFleetTypes.size})`
    );
    assert.ok(uniqueFleetTypes.has('moto_cv'), 'Cidade deve ter a Moto de Assalto 600cc do CV');
    assert.ok(uniqueFleetTypes.has('moto_pcc'), 'Cidade deve ter a Superbike Blindada 1000cc do PCC');
    assert.ok(uniqueFleetTypes.has('moto_policia'), 'Cidade deve ter a Moto Tática ROCAM / BOPE da Polícia');

    // 1.6) Verifica as 3 Motos Maiores e Detalhadas (CV, PCC e Polícia) e a Física de Empinada (Pivô na Roda Traseira sem afundar no chão + Personagem Inclinando Junto!)
    for (const motoType of ['moto_cv', 'moto_pcc', 'moto_policia']) {
      const motoObj = destructibles.objects.find((o) => o.mesh.userData?.carType === motoType && !o.destroyed);
      assert.ok(motoObj, `Deve existir ${motoType} estacionada na cidade`);
      const wheels = motoObj.mesh.userData?.wheels;
      assert.equal(wheels?.length, 2, `${motoType} deve ter 2 rodas esportivas detalhadas`);
      assert.ok(
        Math.abs(wheels[0].steerGroup.position.z) >= 1.35 && wheels[1].steerGroup.position.y >= 0.55,
        `${motoType} deve ter escala maior e imponente (entre-eixos >= 2.7m e pneu traseiro largo r >= 0.55)`
      );
    }

    const testMoto = destructibles.objects.find((o) => o.mesh.userData?.carType === 'moto_pcc' && !o.destroyed);
    testMoto.mesh.position.set(0, 0, -115);
    testMoto.mesh.rotation.set(0, Math.PI / 2, 0); // Apontando para +X
    controller.enterVehicle(testMoto);
    controller.keys.forward = true;
    controller.keys.jump = true; // Segurando Espaço para empinar (Wheelie)!
    for (let i = 0; i < 30; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    controller.keys.jump = false;

    const wheeliePitch = testMoto.mesh.rotation.x;
    assert.ok(
      wheeliePitch < -0.38,
      `Moto empinando deve inclinar o nariz para cima (pitch=${wheeliePitch.toFixed(3)} rad)`
    );
    const rearAxleZ = testMoto.mesh.userData.vehicleSpec.rearAxleZ ?? 1.38;
    const expectedLiftY = rearAxleZ * Math.sin(-wheeliePitch);
    assert.ok(
      Math.abs(testMoto.mesh.position.y - expectedLiftY) < 0.05 && testMoto.mesh.position.y > 0.45,
      `Centro da moto deve subir em rearAxleZ*sin(angle) (y=${testMoto.mesh.position.y.toFixed(3)}m) para que a roda traseira fique apoiada em Y=0 sem entrar no chão`
    );
    const rearWheelContactY = testMoto.mesh.position.y - rearAxleZ * Math.sin(-wheeliePitch);
    assert.ok(
      Math.abs(rearWheelContactY) < 0.02,
      `Pneu traseiro deve ficar exatamente no nível do chão (Y=0) durante a empinada (rearWheelContactY=${rearWheelContactY.toFixed(4)}m)`
    );
    assert.ok(
      Math.abs(minifig.root.rotation.x - wheeliePitch) < 0.001,
      `Personagem na moto deve inclinar para trás exatamente no mesmo ângulo da moto ao empinar (riderPitch=${minifig.root.rotation.x.toFixed(3)}, motoPitch=${wheeliePitch.toFixed(3)})`
    );
    controller.exitVehicle();
    assert.equal(minifig.root.rotation.x, 0, 'Ao sair da moto, a inclinação do personagem deve voltar a 0');

    // 2) Posiciona o jogador ao lado de um carro estacionado e aperta E
    const targetCar = destructibles.objects.find((o) => o.type === 'car' && !o.destroyed);
    assert.ok(targetCar, 'Deve existir um carro estacionado na cidade');
    const initialCarPos = targetCar.mesh.position.clone();

    controller.position.set(targetCar.mesh.position.x + 1.8, 0, targetCar.mesh.position.z);
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(controller.currentVehicle === targetCar, 'Apertar E perto do carro deve entrar nele');

    // 3) Acelera o carro com W por 1 segundo (simulando o loop real: controller.update + destructibles.update)
    controller.keys.forward = true;
    for (let i = 0; i < 30; i++) {
      controller.update(1 / 30);
      destructibles.update(1 / 30, controller.position);
    }
    controller.keys.forward = false;

    assert.equal(minifig.state, 'DRIVE');
    assert.ok(
      minifig.root.scale.y < 0.5,
      'Minifigura deve diminuir visualmente (root.scale < 0.5) e sentar 100% dentro da cabine sem a cabeça sair pelo teto'
    );
    assert.ok(
      minifig.root.scale.y < 0.5,
      'Minifigura deve diminuir visualmente (root.scale < 0.5) e sentar 100% dentro da cabine sem a cabeça sair pelo teto'
    );
    assert.ok(
      targetCar.mesh.position.distanceTo(initialCarPos) > 1.0,
      'Carro dirigido deve se deslocar pela avenida ao acelerar com W (sem ser resetado pelo DestructibleManager)'
    );
    assert.equal(
      targetCar.mesh.position.z,
      controller.position.z,
      'Malha visual do carro (mesh.position) deve acompanhar exatamente a posição do motorista'
    );

    // 4) Testa Drift [Shift] e Turbo [Q] mutuamente exclusivos (um por vez, nunca juntos!)
    controller.keys.forward = true;
    controller.keys.left = true;
    controller._onKey({ code: 'ShiftLeft', repeat: false }, true);
    controller.update(1 / 30);
    assert.equal(controller.isDrifting, true, 'Segurar Shift em movimento deve ativar o DRIFT');
    assert.equal(controller.isTurboActive, false, 'Enquanto dá Drift, o Turbo deve estar desligado');

    // Apertar Q enquanto segura Shift deve cancelar o Drift e ativar o TURBO!
    controller._onKey({ code: 'KeyQ', repeat: false }, true);
    controller.update(1 / 30);
    assert.equal(controller.isTurboActive, true, 'Apertar Q deve ativar o TURBO NITRO');
    assert.equal(controller.isDrifting, false, 'Ativar o Turbo deve cancelar o Drift imediatamente');

    // Apertar Shift enquanto segura Q deve cancelar o Turbo e voltar para o DRIFT!
    controller._onKey({ code: 'ShiftLeft', repeat: false }, true);
    controller.update(1 / 30);
    assert.equal(controller.isDrifting, true, 'Apertar Shift novamente deve cancelar o Turbo e ativar o Drift');
    assert.equal(controller.isTurboActive, false, 'Nunca pode ter Drift e Turbo ativos ao mesmo tempo');

    controller.keys.forward = false;
    controller.keys.left = false;
    controller._onKey({ code: 'ShiftLeft', repeat: false }, false);

    // 5) Aperta E novamente para sair do carro
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(controller.currentVehicle === null, 'Apertar E dirigindo deve sair do veículo');
    assert.equal(minifig.root.scale.y, 1.0, 'Ao sair do carro, a minifigura volta à escala em pé normal (1.0)');
    assert.equal(minifig.root.scale.y, 1.0, 'Ao sair do carro, a minifigura volta à escala em pé normal (1.0)');
    assert.equal(targetCar.colliders[0].disabled, false, 'Colisores do carro devem ser reativados na nova posição ao sair');
  });

  it('10. Scroll no Mapa M não afeta câmera 3D e fechar Mapa / Fast Travel volta ao jogo sem mostrar banner de trava de mira', () => {
    const { world, controller, hud } = createFullCityHarness();
    const initialDist = controller.targetDistance;

    // Simula jogador já dentro do jogo
    controller.hasEnteredGame = true;
    const promptEl = globalThis.document.getElementById('pointer-prompt');
    promptEl?.classList.remove('visible');

    // Abre o mapa completo M
    hud.toggleFullMap(world, controller);
    assert.equal(hud.isFullMapOpen, true, 'Mapa completo deve abrir');

    // Dispara wheel global enquanto o mapa está aberto
    const wheelListeners = globalThis.window._listeners?.wheel || [];
    for (const fn of wheelListeners) {
      fn({ deltaY: 500, target: null });
    }
    assert.equal(
      controller.targetDistance,
      initialDist,
      'Scroll com o Mapa M aberto NÃO deve alterar a distância da câmera do personagem'
    );

    // Fecha o mapa completo M -> deve continuar sem mostrar #pointer-prompt
    hud.setFullMapOpen(false);
    assert.equal(hud.isFullMapOpen, false, 'Mapa completo deve fechar');
    assert.equal(
      promptEl?.classList.contains('visible'),
      false,
      'Fechar o mapa não deve exibir o aviso CLIQUE NA TELA PARA TRAVAR A MIRA'
    );

    // Inicia Viagem Rápida estilo GTA V -> deve ocultar HUD, ativar estado satélite e manter #pointer-prompt oculto
    controller.startFastTravel({ x: 355, y: 0, z: -200 }, 'QGs CV & PCC');
    assert.equal(controller.fastTravelState?.active, true, 'Estado de Fast Travel satélite deve iniciar ativo');
    assert.equal(
      promptEl?.classList.contains('visible'),
      false,
      'Fast Travel deve retornar ao jogo direto sem exibir aviso de trava de mira'
    );
  });

  it('11. Câmera 3ª pessoa 100% livre na vertical (-85° a +85°), Torre dos Heróis Monumental de 310m Entrável e 8 estilos de prédios detalhados', () => {
    const { world, controller, camera } = createFullCityHarness();

    // 1) Verifica os 8 estilos arquitetônicos de prédios
    assert.equal(Object.keys(BUILDING_STYLES).length, 8, 'Devem existir 8 estilos de fachada no gerador de prédios');

    // 2) Verifica que a Torre dos Heróis atinge 310m no Heliponto (352m na Antena) e possui QG Térreo 100% Entrável com cenário interno completo
    const heroTowerRegion = MAP_REGIONS.find((r) => r.id === 'torre_herois');
    assert.ok(heroTowerRegion.spawn.y >= 310, 'Torre dos Heróis deve ter heliponto monumental acima de 310m');
    assert.ok(world.heroTowerData, 'Deve existir o registro completo da Torre dos Heróis (world.heroTowerData)');
    assert.equal(world.heroTowerData.enterable, true, 'Torre dos Heróis deve ser 100% entrável no térreo');
    assert.ok(world.heroTowerData.spireTopHeight >= 350, 'Pináculo / Antena da Torre dos Heróis deve ultrapassar 350m de altura');
    assert.equal(world.heroTowerData.armorPodsCount, 7, 'Interior do QG deve ter 7 Cápsulas Iluminadas de Armaduras (Hall of Armor)');
    assert.equal(world.heroTowerData.containmentCellsCount, 2, 'Interior do QG deve ter 2 Células de Contenção Laser');
    assert.equal(world.heroTowerData.bactaPodsCount, 3, 'Interior do QG deve ter 3 Cápsulas Médicas de Regeneração (Bacta Pods)');
    assert.equal(world.heroTowerData.hasHologramCommandTable, true, 'Interior do QG deve ter a Mesa de Comando Holográfica Central');
    assert.equal(world.heroTowerData.hasGlobalMonitorScreen, true, 'Interior do QG deve ter o Megatelão Global na Parede Norte');
    assert.equal(world.heroTowerData.hasCantileverAvengersDeck, true, 'Exterior deve ter o Hangar/Plataforma em Balanço estilo Avengers Tower em Y=228m');

    // 2.5) Verifica que o jogador entra caminhando/correndo pelo Portal Sul Aberto (X=-318, Z=-128 -> -155) e usa o Elevador Quântico [E] até o Topo (310.8m)!
    controller.position.set(-318, 0.4, -128);
    controller.yaw = 0; // Olhando para -Z (para dentro do Portal Sul da Torre dos Heróis!)
    controller.keys.forward = true;
    controller.keys.sprint = true;
    for (let i = 0; i < 65; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    controller.keys.sprint = false;
    assert.ok(
      controller.position.z < -148,
      `Jogador deve entrar livremente pelo Portal Sul Aberto no Saguão do QG da Torre dos Heróis (z=${controller.position.z.toFixed(2)})`
    );

    // Posiciona na Plataforma do Elevador Quântico do Térreo (X=-318, Z=-204) e aperta [E]
    controller.position.set(-318, 0.5, -204);
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(
      controller.position.y >= 310.5,
      `Elevador Quântico [E] deve transportar o herói do Saguão Térreo direto para o Heliponto do Topo a 310m (y=${controller.position.y.toFixed(2)})`
    );
    controller.position.set(0, 0, -104);

    // 3) Simula movimento de mouse olhando totalmente para cima (-1.48 rad) mesmo no chão
    controller.isPointerLocked = true;
    globalThis.window.dispatchEvent({ type: 'mousemove', movementX: 0, movementY: -2000 });
    assert.equal(controller.pitch, -1.48, 'Pitch deve alcançar -1.48 rad (-85°) ao olhar totalmente para o céu');
    controller.update(1 / 60);

    const lookUpDir = new THREE.Vector3();
    camera.getWorldDirection(lookUpDir);
    assert.ok(
      lookUpDir.y > 0.9,
      `Mesmo no chão, olhar para cima deve apontar a câmera quase 90° para o céu (dir.y=${lookUpDir.y.toFixed(3)})`
    );

    // 4) Simula movimento de mouse olhando totalmente para baixo (+1.48 rad) voando alto
    controller.position.set(0, 250, 0);
    globalThis.window.dispatchEvent({ type: 'mousemove', movementX: 0, movementY: 4000 });
    assert.equal(controller.pitch, 1.48, 'Pitch deve alcançar +1.48 rad (+85°) ao olhar totalmente para baixo');
    controller.update(1 / 60);

    const lookDownDir = new THREE.Vector3();
    camera.getWorldDirection(lookDownDir);
    assert.ok(
      lookDownDir.y < -0.9,
      `No ar, olhar para baixo deve apontar a câmera quase 90° para o chão (dir.y=${lookDownDir.y.toFixed(3)})`
    );
  });

  it('12. Região Sul: 8 Super-Arranha-Céus Estilo Balneário Camboriú (232m-296m), 3 Canais estilo Santos, Calçadão, Praia e Mega Píer de 540m', () => {
    const { world, destructibles, controller } = createFullCityHarness();

    assert.ok(world.southBeachHotels?.length >= 30, 'Deve ter pelo menos 30 Super-Torres e Condomínios Costeiros na Orla Sul');

    const signatureFrontHotels = world.southBeachHotels.filter((h) => h.isFrontRow && h.styleId >= 1 && h.styleId <= 8);
    assert.equal(signatureFrontHotels.length, 8, 'Devem existir os 8 Super-Arranha-Céus frontais exclusivos de frente para o mar');
    const uniqueStyleIds = new Set(signatureFrontHotels.map((h) => h.styleId));
    assert.equal(uniqueStyleIds.size, 8, 'Cada um dos 8 Super-Arranha-Céus da orla deve ter arquitetura individual única (1 a 8)');
    assert.ok(
      signatureFrontHotels.every((h) => h.height >= 230 && h.floors >= 60),
      'Todos os 8 Super-Arranha-Céus frontais da orla devem ter pelo menos 230m de altura (60 a 78 andares estilo Balneário Camboriú)'
    );

    // 3 Canais estilo Santos cortando a orla e separando a areia da praia até o mar
    assert.equal(world.santosCanals?.length, 3, 'Devem existir 3 Canais estilo Santos descendo da Avenida até o mar');
    assert.ok(
      world.santosCanals.every((c) => c.zStart <= 725 && c.zEnd >= 1060),
      'Cada canal deve descer da Avenida Beira-Mar e atravessar toda a faixa de areia até o mar'
    );

    const kiosks = world.mapBuildings.filter((b) => b.label === 'QUIOSQUE ORLA');
    assert.equal(kiosks.length, 4, 'Deve existir 4 Quiosques de Praia completos ao longo do Calçadão');

    const lifeguardTowers = world.mapBuildings.filter((b) => b.label === 'SALVA-VIDAS');
    assert.equal(lifeguardTowers.length, 2, 'Deve existir 2 Postos/Torres de Salva-Vidas na areia');

    // Castelos de Areia de LEGO quebráveis na praia
    const sandcastles = destructibles.objects.filter((o) => o.type === 'sandcastle' && !o.destroyed);
    assert.equal(sandcastles.length, 16, 'Devem existir 16 Castelos de Areia quebráveis espalhados pela praia');
    destructibles.damageObject(sandcastles[0], 50);
    assert.equal(sandcastles[0].destroyed, true, 'Castelo de Areia deve desmontar em bloquinhos e soltar Studs ao ser atingido');

    // Mega Píer de 540m com Restaurante, Arcade, Big Drop, Farol e Roda-Gigante Colossal de 16 cabines
    assert.ok(world.pierData?.length >= 500 && world.pierData?.zEnd >= 1550, 'Mega Píer deve avançar 540m mar adentro até Z=1570');
    assert.equal(world.ferrisWheelCabinCount, 16, 'Roda-Gigante deve possuir 16 cabines coloridas de LEGO');
    const prevRotX = world.ferrisWheelGroup.rotation.x;
    world.update(0.5, controller.position);
    assert.notEqual(world.ferrisWheelGroup.rotation.x, prevRotX, 'Roda-Gigante na ponta do Píer deve girar continuamente');
  });

  it('13. Parque Central & Lago: 4 Portões Clássicos, Fonte em Camadas com Studs, Coretos, Carrinhos Quebráveis, Grande Lago, Ponte Arqueada e Vegetação Variada', () => {
    const { world, destructibles, controller } = createFullCityHarness();

    assert.ok(world.centralParkData, 'Deve existir o registro completo do Parque Central & Lago');
    assert.equal(world.centralParkData.gatesCount, 4, 'Parque Central deve ter 4 Entradas Monumentais (Norte, Sul, Leste, Oeste)');
    assert.equal(world.centralParkData.gazebosCount, 3, 'Devem existir 3 Quiosques de Madeira (Coreto/Gazebo) no Parque');
    assert.equal(world.centralParkData.breakableFoodCartsCount, 6, 'Devem existir 6 Carrinhos de Hot-Dog/Sorvete quebráveis no Parque');
    assert.ok(world.centralParkData.treeCount >= 400, `Parque Central deve ter selva densa com mais de 400 árvores gigantes (atual: ${world.centralParkData.treeCount})`);
    assert.ok(world.centralParkData.undergrowthCount >= 350, `Parque Central deve ter centenas de arbustos, samambaias e rochas de sub-bosque (atual: ${world.centralParkData.undergrowthCount})`);

    // Verifica que o jogador pode passar POR BAIXO do arco central da Ponte Arqueada (X=205, Z=268, Y=0.4)
    controller.position.set(195, 0.4, 268);
    controller.yaw = -Math.PI / 2; // Olhando para +X (passando por baixo da Ponte Arqueada!)
    controller.keys.forward = true;
    for (let i = 0; i < 85; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    assert.ok(
      controller.position.x > 214,
      `Jogador deve conseguir passar por baixo do arco central da Ponte Arqueada do Lago (x=${controller.position.x.toFixed(2)})`
    );

    // Verifica que existem Studs dentro da água do Chafariz Central (X=0, Z=268)
    const fountainStuds = destructibles.ambientStuds.filter(
      (s) => Math.hypot(s.basePos.x - 0, s.basePos.z - 268) < 12
    );
    assert.equal(fountainStuds.length, 20, 'Chafariz da Praça Circular Central deve ter 20 Studs dentro da água');
  });

  it('14. Região Oeste: Mega Terminal Entrável (960m), Estacionamento c/ Catracas, 3 Torres ATC (124m), 16 Hangares em Quarteirões e Pista 09/27', () => {
    const { world, controller } = createFullCityHarness();

    assert.ok(world.westAirportData, 'Deve existir o registro completo do Aeroporto & Base Militar Oeste');
    assert.equal(world.westAirportData.terminalLength, 960, 'Mega Terminal Internacional deve ter 960m de comprimento');
    assert.equal(world.westAirportData.terminalEnterable, true, 'Mega Terminal deve ser 100% entrável');
    assert.equal(world.westAirportData.parkingLotWithTurnstiles, true, 'Deve existir estacionamento com catracas/cancelas na entrada');
    assert.equal(world.westAirportData.atcTowersCount, 3, 'Devem existir 3 Torres de Controle (ATC) rentes à pista principal');
    assert.ok(world.westAirportData.atcTowerHeight >= 110, 'Torres de Controle (ATC) devem ter pelo menos 110 unidades de altura');
    assert.equal(world.westAirportData.openHangarsCount, 16, 'Devem existir 16 Hangares enfileirados nos quarteirões das pistas menores');
    assert.ok(world.westAirportData.fighterJetsCount >= 8, 'Devem existir Jatos de Caça Supersônicos na Base Militar');
    assert.ok(world.westAirportData.attackHelicoptersCount >= 4, 'Devem existir Helicópteros de Ataque na Base Militar');

    // Verifica que o jogador consegue entrar no Mega Terminal Internacional pelo portal central (X = -1094 -> -1115 em Z = 0)
    controller.position.set(-1094, 0.4, 0);
    controller.yaw = Math.PI / 2; // Olhando para -X (para dentro do Terminal!)
    controller.keys.forward = true;
    for (let i = 0; i < 60; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    assert.ok(
      controller.position.x < -1108,
      `Jogador deve conseguir entrar livremente no Mega Terminal Internacional (x=${controller.position.x.toFixed(2)})`
    );

    // Verifica que a Pista de Pouso 09/27 (X = -1660) está 100% livre de obstáculos
    controller.position.set(-1660, 0.4, 0);
    controller.yaw = 0; // Correndo ao longo da pista para -Z
    controller.keys.forward = true;
    for (let i = 0; i < 60; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    assert.ok(controller.position.z < -12, 'Pista de Pouso 09/27 deve ser livre de obstáculos');

    // Verifica que as portas frontais do Hangar 1 (X=-1298, Z=-475) estão abertas permitindo entrar
    controller.position.set(-1255, 0.4, -468);
    controller.yaw = Math.PI / 2; // Olhando para -X (para dentro do Hangar aberto!)
    controller.keys.forward = true;
    for (let i = 0; i < 65; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    assert.ok(
      controller.position.x < -1268,
      `Jogador deve conseguir entrar livremente pelas portas abertas do Hangar nos quarteirões (x=${controller.position.x.toFixed(2)})`
    );
  });

  it('15. Embarcações (Pedalinho, Jet-Ski, Lancha), Aeronaves (Helicóptero, Caça, Avião) e Água Profunda (Carro não anda na água)', () => {
    const { world, destructibles, controller } = createFullCityHarness();

    // 1) Verifica detecção de Água Profunda vs Terra Firme
    assert.equal(world.isDeepWaterAt(160, 240), true, 'Grande Lago do Parque deve ser água profunda');
    assert.equal(world.isDeepWaterAt(205, 240), false, 'Ponte Arqueada sobre o Lago deve ser seca para pedestres');
    assert.equal(world.isDeepWaterAt(-384, 850), true, 'Canal 1 de Santos deve ser água profunda');
    assert.equal(world.isDeepWaterAt(0, 1620), true, 'Oceano Atlântico além do Píer deve ser água profunda');
    assert.equal(world.isDeepWaterAt(0, -100), false, 'Avenidas do Centro devem ser terra firme');
    assert.equal(world.isDeepWaterAt(0, 1200), false, 'Deck do Mega Píer deve ser seco para pedestres');

    // 2) Verifica que um Carro Terrestre é bloqueado pela água profunda (não anda no mar!)
    const landCar = destructibles.objects.find((o) => o.mesh.userData?.carType === 'apex_gtx');
    assert.ok(landCar, 'Deve existir um carro terrestre');
    landCar.mesh.position.set(100, 0, 1043);
    landCar.mesh.rotation.y = 0; // Apontando para +Z (em direção ao mar em Z > 1045)
    controller.enterVehicle(landCar);
    controller.keys.forward = true;
    for (let i = 0; i < 45; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    assert.ok(
      landCar.mesh.position.z <= 1045.5,
      `Carro terrestre não deve conseguir entrar na água profunda do mar (z=${landCar.mesh.position.z.toFixed(2)})`
    );
    controller.exitVehicle();

    // 3) Verifica que o Pedalinho Cisne no Lago do Parque navega na água ao apertar [E] e [W]
    const swanBoat = destructibles.objects.find((o) => o.mesh.userData?.carType === 'pedalinho_cisne');
    assert.ok(swanBoat, 'Deve existir Pedalinho Cisne pilotável no Lago do Parque Central');
    const startBoatX = swanBoat.mesh.position.x;
    controller.position.set(swanBoat.mesh.position.x - 3.5, 0.65, swanBoat.mesh.position.z);
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(controller.currentVehicle === swanBoat, 'Deve conseguir subir no Pedalinho Cisne direto do Píer com [E]');
    controller.keys.forward = true;
    for (let i = 0; i < 30; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    assert.ok(swanBoat.mesh.position.x > startBoatX + 2.0, 'Pedalinho Cisne deve navegar pelas águas do Lago');
    controller.exitVehicle();

    // 4) Verifica que o Helicóptero de Ataque decola verticalmente com [Espaço] e o Caça F-99 voa em 3D!
    const attackHeli = destructibles.objects.find((o) => o.mesh.userData?.carType === 'heli_ataque');
    assert.ok(attackHeli, 'Deve existir Helicóptero de Ataque pilotável');
    const heliStartY = attackHeli.mesh.position.y;
    controller.enterVehicle(attackHeli);
    controller.keys.jump = true;
    for (let i = 0; i < 30; i++) {
      controller.update(1 / 30);
    }
    controller.keys.jump = false;
    assert.ok(
      attackHeli.mesh.position.y > heliStartY + 8.0,
      `Helicóptero deve subir verticalmente com [Espaço] (y=${attackHeli.mesh.position.y.toFixed(2)})`
    );
    controller.exitVehicle();

    const fighterJet = destructibles.objects.find((o) => o.mesh.userData?.carType === 'jato_caca');
    assert.ok(fighterJet, 'Deve existir Caça Supersônico F-99 pilotável');
    const jetStartY = fighterJet.mesh.position.y;
    controller.enterVehicle(fighterJet);
    controller.keys.forward = true;
    controller.keys.jump = true;
    for (let i = 0; i < 40; i++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    controller.keys.jump = false;
    assert.ok(
      fighterJet.mesh.position.y > jetStartY + 8.0,
      `Caça Supersônico deve acelerar e decolar com [W] + [Espaço] (y=${fighterJet.mesh.position.y.toFixed(2)})`
    );
    controller.exitVehicle();
  });

  it('16. Complexo da Cidade de Deus: Colina/Ladeira Suave Contínua (Y=0..43m), Clusters Parede com Parede, Vielas sem Grid Reto e 4 Pontos Icônicos', () => {
    const { world, destructibles, controller } = createFullCityHarness();

    // 1) Verifica os metadados e contagens da Favela Cidade de Deus (100% CV) e do Distrito Industrial (100% PCC)
    assert.ok(world.favelaCDDData, 'Deve existir o registro completo da Favela Cidade de Deus');
    assert.equal(world.favelaCDDData.faction, 'CV', 'Favela Cidade de Deus deve ser 100% território do CV');
    assert.equal(world.favelaCDDData.isContinuousSmoothHill, true, 'Relevo da Favela deve ser uma Colina/Ladeira Suave Contínua sem blocão marrom vertical');
    assert.ok(world.favelaCDDData.clustersCount >= 40, `Barracos devem estar agrupados em dezenas de clusters colados parede com parede (atual: ${world.favelaCDDData.clustersCount})`);
    assert.ok(world.favelaCDDData.housesCount >= 320, `Devem existir centenas de barracos/sobrados colados parede com parede (atual: ${world.favelaCDDData.housesCount})`);
    assert.ok(world.favelaCDDData.brickBaianoCount > world.favelaCDDData.cementRawCount, 'Maioria das paredes (60%) deve ser de Tijolo Baiano');
    assert.ok(world.favelaCDDData.cvPaintedCount >= 50, 'Deve existir proporção autêntica de paredes nas cores do CV');
    assert.ok(world.favelaCDDData.waterTanksCount >= 180, 'Topo das lajes deve ter dezenas de Caixas d\'Água Azuis cilíndricas');
    assert.ok(world.favelaCDDData.staircasesCount >= 20, 'Morro deve ter Escadões e Ladeiras tortas de cimento subindo a encosta');
    assert.ok(world.favelaCDDData.bocasCount >= 6, 'Devem existir as Bocas de Entrada e Barricadas Pesadas do CV');
    assert.equal(world.favelaCDDData.hasSoccerField, true, 'Deve existir o Campinho de Futebol da CDD (Várzea)');
    assert.equal(world.favelaCDDData.hasBaileParedao, true, 'Deve existir a Quadra do Baile do CV com Paredão de Som Gigante');
    assert.equal(world.favelaCDDData.hasRedBaronFortress, true, 'Deve existir a Fortaleza do Barão Vermelho no topo do morro');
    assert.equal(world.favelaCDDData.hasCommunityWaterTower, true, 'Deve existir a Caixa d\'Água Comunitária Gigante da CDD');

    // Verifica que nas bordas da Favela a altura começa exatamente em Y = 0 e sobe suavemente até o topo (~42.5m)
    assert.equal(world.getTerrainHeightAt(-528, -117), 0, 'Na borda leste com a Cidade (X=-528), o morro deve começar exatamente em Y=0 sem degrau brusco');
    assert.equal(world.getTerrainHeightAt(-1012, -117), 0, 'Na borda oeste com o Aeroporto (X=-1012), o morro deve começar exatamente em Y=0 sem degrau brusco');
    const midSlopeY = world.getTerrainHeightAt(-680, -180);
    const summitY = world.getTerrainHeightAt(-865, -240);
    assert.ok(midSlopeY > 12 && midSlopeY < 32, `Meio da encosta deve ter elevação intermediária suave (y=${midSlopeY.toFixed(2)})`);
    assert.ok(summitY >= 40 && summitY <= 45, `Topo do morro deve atingir 40..45m de altura (y=${summitY.toFixed(2)})`);

    // Verifica que o Distrito Industrial Leste é o Império Industrial & Corporativo Blindado 100% PCC
    assert.ok(world.industrialPCCData, 'Deve existir o registro territorial do Distrito Industrial do PCC');
    assert.equal(world.industrialPCCData.faction, 'PCC', 'Distrito Industrial Leste deve ser 100% território do PCC');
    assert.equal(world.industrialPCCData.hasCentralBunker, true, 'Deve existir o Grande Bunker Central do PCC (QG do Mestre do Cofre)');
    assert.ok(world.industrialPCCData.citadelHeight >= 85 && world.industrialPCCData.citadelHeight <= 120, 'Cidadela / Torre do Bunker Central deve ter entre 85 e 120 unidades de altura (112m)');
    assert.equal(world.industrialPCCData.skybridgesCount, 4, 'Devem existir 4 Pontes/Passarelas Aéreas Blindadas ligando a Cidadela aos prédios vizinhos');
    assert.ok(world.industrialPCCData.blocksCount >= 50, `Domínio do PCC deve cobrir todos os quarteirões a Leste e Nordeste até o Porto (atual: ${world.industrialPCCData.blocksCount})`);
    assert.ok(world.industrialPCCData.corporateTowersCount >= 20, 'Devem existir dezenas de Prédios Corporativos de Lavagem do PCC (48-80m)');
    assert.ok(world.industrialPCCData.siloBatteriesCount >= 18, 'Devem existir Baterias de 3 a 4 Silos Cilíndricos Gigantes com passarelas no topo');
    assert.ok(world.industrialPCCData.coolingTowersCount >= 8, 'Devem existir Torres de Resfriamento Gigantes');
    assert.ok(world.industrialPCCData.tallSmokestacksCount >= 20, 'Devem existir Chaminés Industriais Altíssimas (68-85m) soltando fumaça');
    assert.ok(world.industrialPCCData.pccContainerStacksCount >= 35, 'Pátios devem estar lotados com pilhas de Contêineres Pretos e Azul-Marinho do PCC');
    assert.equal(world.industrialPCCData.hasUndergroundEscapeRamp, true, 'Bunker Central deve possuir Rampa Subterrânea / Garagem de Fuga Blindada');
    assert.equal(world.industrialPCCData.hasRooftopBlueHelipad, true, 'Topo da Cidadela deve possuir Heliponto Principal do Chefe iluminado em Azul (H)');
    assert.equal(world.industrialPCCData.bunkerWatchtowersCount, 4, 'Base do Bunker deve possuir 4 Torres de Vigia Blindadas nas esquinas');
    assert.ok(world.industrialPCCData.c4WarehousesCount >= 20, 'Devem existir Megagalpões de Planejamento e Fábricas de Explosivos C4');
    assert.ok(world.industrialPCCData.stolenGoldPalletsCount >= 25, 'Docas devem ter dezenas de paletes com Barras de Ouro roubadas');
    assert.ok(world.industrialPCCData.silverBriefcaseStacksCount >= 15, 'Docas devem ter pilhas de maletas prateadas');
    assert.ok(world.industrialPCCData.c4CratesCount >= 60, 'Docas devem ter caixas de explosivos C4');
    assert.ok(world.industrialPCCData.forkliftsCount >= 20, 'Pátios devem ter empilhadeiras amarelas/pretas');
    assert.ok(world.industrialPCCData.boxTrucksCount >= 20, 'Docas devem ter caminhões baú pretos do PCC');
    assert.equal(world.industrialPCCData.hasChopShopYard, true, 'Deve existir o Pátio do Desmanche & Ferro-Velho do Sindicato');
    assert.equal(world.industrialPCCData.hasElectromagneticCrane, true, 'Desmanche deve ter Guindaste Eletromagnético Gigante');
    assert.equal(world.industrialPCCData.hasHydraulicPress, true, 'Desmanche deve ter Prensa Hidráulica Industrial');
    assert.equal(world.industrialPCCData.hasFleetConvoyYard, true, 'Deve existir o Pátio da Frota ("O Bonde do PCC")');
    assert.equal(world.industrialPCCData.entryBarricadesCount, 5, 'Devem existir 5 Barricadas Táticas nas entradas do Distrito Industrial');

    // Verifica o Helicóptero Executivo Preto do PCC no Heliponto do Topo da Cidadela (X=866, Y=112.8, Z=-428) e a Frota do Bonde do PCC
    const pccHeli = destructibles.objects.find(
      (o) => o.mesh.userData?.carName === 'HELICÓPTERO EXECUTIVO BLINDADO (PCC)'
    );
    assert.ok(pccHeli, 'Deve existir o Helicóptero Preto Executivo do PCC estacionado no Heliponto Principal da Cidadela');
    assert.ok(pccHeli.mesh.position.y >= 112.0, 'Helicóptero Principal do PCC deve estar no topo da Cidadela (Y >= 112m)');

    const pccSuvs = destructibles.objects.filter(
      (o) => o.mesh.userData?.carType === 'suv_pcc' && o.mesh.position.x > 580
    );
    const pccVans = destructibles.objects.filter(
      (o) => o.mesh.userData?.carType === 'van_pcc' && o.mesh.position.x > 580
    );
    const stolenArmoredTrucks = destructibles.objects.filter(
      (o) => o.mesh.userData?.carType === 'carro_forte' && o.mesh.position.x > 980
    );
    assert.ok(pccSuvs.length >= 10, `Devem existir pelo menos 10 SUVs Blindadas Pretas no Distrito Industrial (atual: ${pccSuvs.length})`);
    assert.ok(pccVans.length >= 6, `Devem existir pelo menos 6 Vans Quebra-Cofre no Distrito Industrial (atual: ${pccVans.length})`);
    assert.equal(stolenArmoredTrucks.length, 2, 'Devem existir 2 Carros-Fortes roubados escondidos no Pátio do Desmanche do PCC');

    // 2) Verifica detecção de Região dentro da Cidade de Deus
    const cddRegion = world.getRegionAt(-715, 25.5, -135);
    assert.equal(cddRegion.id, 'favela_cdd_cv', 'Estar na Quadra do Baile deve resolver para a região favela_cdd_cv');

    // 3) Verifica física de relevo contínuo: pisar firme no Campinho (Y≈11.5m), na Quadra do Baile (Y≈25m) e na Fortaleza do Barão Vermelho (Y≈42.5m)
    controller.position.set(-605, 14.0, 195);
    controller.velocity.set(0, 0, 0);
    for (let i = 0; i < 25; i++) controller.update(1 / 30);
    assert.ok(
      controller.position.y >= 10.8 && controller.position.y <= 12.5,
      `Jogador deve pisar firme no platô suave do Campinho da CDD (y=${controller.position.y.toFixed(2)})`
    );

    controller.position.set(-702, 27.5, -135);
    controller.velocity.set(0, 0, 0);
    for (let i = 0; i < 25; i++) controller.update(1 / 30);
    assert.ok(
      controller.position.y >= 24.2 && controller.position.y <= 26.2,
      `Jogador deve pisar firme na Quadra do Baile do CV na encosta (y=${controller.position.y.toFixed(2)})`
    );

    controller.position.set(-850, 45.0, -240);
    controller.velocity.set(0, 0, 0);
    for (let i = 0; i < 25; i++) controller.update(1 / 30);
    assert.ok(
      controller.position.y >= 41.8 && controller.position.y <= 43.8,
      `Jogador deve pisar firme no Cume da Fortaleza do Barão Vermelho (y=${controller.position.y.toFixed(2)})`
    );

    // 4) Verifica que existem Motos e Picapes do CV nas Bocas de Entrada da Cidade de Deus
    const cvBikesInCDD = destructibles.objects.filter(
      (o) => o.mesh.userData?.carType === 'moto_cv' && o.mesh.position.x < -500
    );
    const cvPickupsInCDD = destructibles.objects.filter(
      (o) => o.mesh.userData?.carType === 'picape_cv' && o.mesh.position.x < -500
    );
    assert.ok(cvBikesInCDD.length >= 3, 'Devem existir Motos Vermelhas do CV estacionadas nas Bocas da CDD');
    assert.ok(cvPickupsInCDD.length >= 3, 'Devem existir Picapes Armadas do CV estacionadas nas Bocas da CDD');

    // 5) Verifica o Porto de Cargas, Base A.R.E.S. & Cais Marítimo no Extremo Leste (world.eastPortData)
    assert.ok(world.eastPortData, 'Deve existir o registro completo do Porto de Cargas & Cais Marítimo (world.eastPortData)');
    assert.equal(world.eastPortData.hasHeavyConcreteQuay, true, 'Deve existir o Grande Cais de Concreto Pesado');
    assert.ok(world.eastPortData.logisticsAvenuesCount >= 9, 'Porto deve ser cortado por Avenidas Logísticas Asfaltadas');
    assert.equal(world.eastPortData.truckRoundaboutsCount, 4, 'Porto deve ter 4 Rotatórias de Caminhões');
    assert.equal(world.eastPortData.demarcatedCargoYardsCount, 10, 'Porto deve ser dividido em 10 Pátios de Carga Demarcados (zero lajão cinza vazio)');
    assert.equal(world.eastPortData.dockGatehousesCount, 6, 'Pátios do Porto devem ter Portarias de Doca');
    assert.ok(world.eastPortData.zebraStripesSegments >= 150, 'Borda da água deve ter faixas zebradas amarelas e pretas de segurança');
    assert.ok(world.eastPortData.bollardsCount >= 20, 'Cais deve ter cabeços de amarração de ferro fundido');
    assert.ok(world.eastPortData.rubberFendersCount >= 40, 'Parede do cais deve ter defensas de borracha preta');
    assert.equal(world.eastPortData.floodlightTowersCount, 16, 'Pátio do Porto deve ser iluminado por 16 torres altas de refletores');
    assert.ok(world.eastPortData.floodlightTowerHeight >= 45, 'Torres de refletores do Porto devem ter 45+ unidades de altura (48m)');
    assert.deepEqual(world.eastPortData.containerDimensions, { length: 18, width: 6, height: 6 }, 'Contêineres devem ter escala real 2.5x maior (18x6x6)');
    assert.ok(world.eastPortData.yardBlocksCount >= 36, 'Devem existir 36 a 42 Grandes Maciços de Contêineres (Selva de Contêineres)');
    assert.equal(world.eastPortData.rtgCranesCount, 18, 'Devem existir 18 Pórticos Rolantes RTG de 56m abraçando a selva de contêineres');
    assert.ok(world.eastPortData.detailedContainersCount >= 2200, `Porto deve ter uma Selva de Contêineres ultra-densa com >= 2200 contêineres 3D (atual: ${world.eastPortData.detailedContainersCount})`);
    assert.ok(world.eastPortData.fourStoryStacksCount >= 180, 'Blocos devem ter centenas de pilhas de 4 a 8 andares');
    assert.ok(world.eastPortData.fiveStoryStacksCount >= 120, 'Blocos devem ter mais de 120 pilhas de 5 a 8 andares (30m a 48m de altura)');
    assert.ok(world.eastPortData.sixToEightStoryStacksCount >= 80, 'Selva de Contêineres deve ter dezenas de paredões de 6, 7 e 8 andares (36m a 48m)');
    assert.ok(world.eastPortData.containerSkybridgesCount >= 20, 'Devem existir dezenas de Pontes Aéreas de Contêineres suspensos ligando os paredões no alto');
    assert.ok(world.eastPortData.rooftopCatwalksCount >= 90, 'Topo das pilhas deve ter dezenas de passarelas cruzadas para correr pelo teto da selva de contêineres');
    assert.equal(world.eastPortData.numberedWarehouses.length, 10, 'Devem existir 10 Grandes Armazéns e Terminais Logísticos (DOCA 01 a DOCA 10)');
    assert.equal(world.eastPortData.fuelTanksCount, 12, 'Terminal de Combustível Marítimo deve ter 12 Grandes Silos Cilíndricos (48-68m)');
    assert.equal(world.eastPortData.petroTowersCount, 2, 'Refinaria do Porto deve ter 2 Torres Petroquímicas de 78m');
    assert.equal(world.eastPortData.gasSpheresCount, 4, 'Terminal de Combustível deve ter 4 Esferas de Gás Pressurizado');
    assert.equal(world.eastPortData.hasHarborMasterTower, true, 'Deve existir a Torre da Capitania dos Portos & Controle Naval');
    assert.ok(world.eastPortData.harborMasterTowerHeight >= 80 && world.eastPortData.harborMasterTowerHeight <= 100, 'Torre da Capitania dos Portos deve ter entre 80 e 100 unidades de altura (92m)');
    assert.equal(world.eastPortData.hasAresPortBase, true, 'Deve existir a Base Portuária Fortificada da 3ª Facção A.R.E.S.');
    assert.ok(world.eastPortData.aresHangarHeight >= 40 && world.eastPortData.aresHangarHeight <= 60, 'Hangar Blindado da A.R.E.S. deve ter entre 40 e 60 unidades de altura (52m)');
    assert.equal(world.eastPortData.aresCyberTowerHeight, 88, 'Sobre o Hangar da A.R.E.S. deve erguer-se a Torre Cyber-Militar escalonada de 88m de altura');
    assert.equal(world.eastPortData.openAresContainersCount, 12, 'Devem existir 12 contêineres abertos com cargas de armas laser da A.R.E.S. e Studs dentro');
    assert.equal(world.eastPortData.aresLaserTurretsCount, 4, 'Setor da A.R.E.S. deve ter 4 Torretas Laser nas esquinas');
    assert.equal(world.eastPortData.aresPlasmaGeneratorsCount, 6, 'Setor da A.R.E.S. deve ter 6 Geradores de Plasma');
    assert.equal(world.eastPortData.portainerCranesCount, 5, 'Devem existir 5 Guindastes Portuários Gigantes (3 no Cais Leste + 2 na Borda Sul)');
    assert.ok(world.eastPortData.portainerHeight >= 65 && world.eastPortData.portainerHeight <= 85, 'Guindastes Portainers devem ter entre 65 e 85 unidades de altura (76m)');
    assert.equal(world.eastPortData.mooredCargoShipsCount, 3, 'Devem existir 3 Grandes Navios Atracados (2 Porta-Contêineres a Leste + 1 Navio A.R.E.S. ao Sul)');
    assert.equal(world.eastPortData.hasAresWarship, true, 'Deve existir o Navio de Guerra/Cargueiro Blindado Preto e Roxo-Neon da A.R.E.S. na doca Sul');
    assert.equal(world.eastPortData.shipGangwaysCount, 6, 'Os 3 Navios devem somar 6 rampas metálicas de acesso para subir a bordo');
    assert.ok(world.eastPortData.cargoTrucksCount >= 24, 'Devem existir dezenas de Caminhões-Carreta estacionados nas docas e blocos');

    // Verifica que o jogador pode caminhar sob as pernas de pórtico do Guindaste Portuário (X=1555, Z=421 -> 409) e subir no convés dos Navios Leste e Sul (A.R.E.S.)
    controller.position.set(1555, 0.35, 421);
    controller.yaw = 0; // Olhando para -Z
    controller.keys.forward = true;
    for (let i = 0; i < 55; i++) controller.update(1 / 30);
    controller.keys.forward = false;
    assert.ok(
      controller.position.z < 411,
      `Vão livre sob as 4 pernas de pórtico do Guindaste Portuário deve permitir passagem por baixo (z=${controller.position.z.toFixed(2)})`
    );

    controller.position.set(1668, 11.5, 255);
    controller.velocity.set(0, 0, 0);
    for (let i = 0; i < 20; i++) controller.update(1 / 30);
    assert.ok(
      controller.position.y >= 9.0 && controller.position.y <= 10.2,
      `Jogador deve pisar firme no convés do Navio Porta-Contêineres Leste sem afundar na água (y=${controller.position.y.toFixed(2)})`
    );

    controller.position.set(1125, 11.5, 768);
    controller.velocity.set(0, 0, 0);
    for (let i = 0; i < 20; i++) controller.update(1 / 30);
    assert.ok(
      controller.position.y >= 9.0 && controller.position.y <= 10.2,
      `Jogador deve pisar firme no convés do Navio Blindado A.R.E.S. na Doca Sul sem afundar na água (y=${controller.position.y.toFixed(2)})`
    );

    // 5.5) Verifica que os Caminhões-Carreta do Porto (caminhao_carreta) e os 3 Navios Cargueiros (navio_cargueiro e navio_ares) são 100% pilotáveis com [E]!
    const portSemiTrucks = destructibles.objects.filter((o) => o.mesh.userData?.carType === 'caminhao_carreta');
    assert.ok(portSemiTrucks.length >= 24, `Todos os Caminhões-Carreta do Porto devem ser pilotáveis (atual: ${portSemiTrucks.length})`);

    const semiTruck = portSemiTrucks.find((t) => Math.abs(t.mesh.position.x - 825) < 5 && Math.abs(t.mesh.position.z - 362) < 5) || portSemiTrucks[0];
    const startTruckPos = semiTruck.mesh.position.clone();
    // Posiciona o jogador ao lado da cabine no referencial local do caminhão (funciona com qualquer rotação no pátio)
    const truckYaw = semiTruck.mesh.rotation.y || 0;
    const sideX = 4.0;
    const alongZ = 8.0;
    controller.position.set(
      semiTruck.mesh.position.x + sideX * Math.cos(truckYaw) + alongZ * Math.sin(truckYaw),
      0.35,
      semiTruck.mesh.position.z - sideX * Math.sin(truckYaw) + alongZ * Math.cos(truckYaw)
    );
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(controller.currentVehicle === semiTruck, 'Jogador deve conseguir entrar no Caminhão-Carreta Portuário com [E]');
    controller.keys.forward = true;
    for (let i = 0; i < 25; i++) controller.update(1 / 30);
    controller.keys.forward = false;
    assert.ok(semiTruck.mesh.position.distanceTo(startTruckPos) > 3.0, 'Caminhão-Carreta Portuário deve acelerar e andar pelas vias do Porto com [W]');
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(controller.currentVehicle === null, 'Jogador deve conseguir sair do Caminhão-Carreta com [E]');

    const cargoShips = destructibles.objects.filter(
      (o) => o.mesh.userData?.carType === 'navio_cargueiro' || o.mesh.userData?.carType === 'navio_ares'
    );
    assert.equal(cargoShips.length, 3, 'Os 3 Grandes Navios do Porto (2 Porta-Contêineres + 1 Couraçado A.R.E.S.) devem ser pilotáveis');

    const eastCargoShip = cargoShips.find((s) => s.mesh.userData?.carType === 'navio_cargueiro');
    const startShipZ = eastCargoShip.mesh.position.z;
    controller.position.set(eastCargoShip.mesh.position.x, 9.45, eastCargoShip.mesh.position.z);
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(controller.currentVehicle === eastCargoShip, 'Jogador no convés/rampa deve conseguir assumir o comando do Navio Cargueiro com [E]');
    controller.keys.forward = true;
    for (let i = 0; i < 30; i++) controller.update(1 / 30);
    controller.keys.forward = false;
    assert.ok(
      eastCargoShip.mesh.position.z > startShipZ + 5.0,
      `Navio Cargueiro deve navegar pelo oceano ao acelerar com [W] (z=${eastCargoShip.mesh.position.z.toFixed(2)})`
    );
    controller._onKey({ code: 'KeyE', repeat: false }, true);
    assert.ok(controller.currentVehicle === null, 'Apertar [E] deve sair do comando do Navio Cargueiro');
    for (let i = 0; i < 15; i++) controller.update(1 / 30);
    assert.ok(
      controller.position.y >= 9.0 && controller.position.y <= 10.2,
      `Ao sair do comando do Navio Cargueiro em alto-mar, o jogador deve continuar pisando firme no convés na nova posição (y=${controller.position.y.toFixed(2)})`
    );

    // 6) Verifica a Grande Ponte Blindada Estaiada (Cabos Corrigidos) & Ilha da Prisão de Segurança Máxima 2x Maior (world.prisonIslandData)
    assert.ok(world.prisonIslandData, 'Deve existir o registro completo da Ilha da Prisão e Ponte Blindada (world.prisonIslandData)');
    assert.equal(world.prisonIslandData.bridgeAlignedWithPort, true, 'Ponte Blindada deve sair em linha reta da avenida/cais do Porto até o Portão da Prisão');
    assert.equal(world.prisonIslandData.bridgeLanes, 4, 'Ponte deve ter pista larga de 4 faixas');
    assert.equal(world.prisonIslandData.bridgeSteelTowersCount, 2, 'Ponte Estaiada deve ter 2 Torres Gigantes de Aço');
    assert.ok(world.prisonIslandData.bridgeTowerHeight >= 80 && world.prisonIslandData.bridgeTowerHeight <= 100, 'Torres de Aço da Ponte devem ter entre 80 e 100 unidades de altura (94m)');
    assert.equal(world.prisonIslandData.bridgeStayCablesCount, 40, 'Torres da Ponte devem ter 40 cabos de aço estaiados em leque');
    assert.equal(world.prisonIslandData.bridgeStayCablesFixedOrientation, true, 'Cabos estaiados da ponte devem estar orientados corretamente do topo da torre até o tabuleiro');
    assert.equal(world.prisonIslandData.bopeCheckpointsCount, 2, 'Devem existir 2 Checkpoints do BOPE nas duas pontas da Ponte');
    assert.ok(world.prisonIslandData.islandWidth >= 800 && world.prisonIslandData.islandDepth >= 800, 'Ilha da Prisão deve ter escala 2x maior (840m x 860m)');
    assert.ok(world.prisonIslandData.coastalRocksCount >= 110, 'Ilha da Prisão deve ser cercada por mais de 110 rochas costeiras/quebra-mar no oceano');
    assert.equal(world.prisonIslandData.hasExternalCoastGuardDock, true, 'Deve existir a Doca Naval da Guarda Costeira fora da muralha lateral');
    assert.equal(world.prisonIslandData.coastGuardSpeedboatsCount, 2, 'Doca Naval deve ter 2 Lanchas Blindadas da Polícia Marítima atracadas');
    assert.ok(world.prisonIslandData.perimeterWallHeight >= 35 && world.prisonIslandData.perimeterWallHeight <= 45, 'Muralha Perimetral deve ter entre 35 e 45 unidades de altura (40m)');
    assert.equal(world.prisonIslandData.hasMonumentalArmoredGate, true, 'Deve existir o Portão Blindado Monumental na chegada da ponte');
    assert.equal(world.prisonIslandData.hasSalliePortDoubleGate, true, 'Deve existir o Sallie Port (Portões Internos de Grade Dupla para Comboios)');
    assert.equal(world.prisonIslandData.watchtowersCount, 8, 'Devem existir 8 Torres de Vigia Gigantes ao redor da muralha expandida');
    assert.ok(world.prisonIslandData.watchtowerHeight >= 60 && world.prisonIslandData.watchtowerHeight <= 75, 'Torres de Vigia devem ter entre 60 e 75 unidades de altura (68m)');
    assert.equal(world.prisonIslandData.hasCentralCommandTower, true, 'Deve existir a Cidadela Panóptica Central ("A Balsa")');
    assert.ok(world.prisonIslandData.centralTowerHeight >= 110 && world.prisonIslandData.centralTowerHeight <= 135, 'Cidadela Panóptica Central deve ter entre 110 e 135 unidades de altura (126m)');
    assert.equal(world.prisonIslandData.hasPoliceHelipad, true, 'Cidadela Central deve ter Heliponto Policial no topo');
    assert.equal(world.prisonIslandData.helipadsCount, 2, 'Topo da Cidadela deve ter Duplo Heliponto Policial');
    assert.equal(world.prisonIslandData.skybridgesCount, 4, 'Devem existir 4 Passarelas Aéreas Blindadas em cruz saindo da Cidadela Central');
    assert.ok(world.prisonIslandData.skybridgeElevation >= 35 && world.prisonIslandData.skybridgeElevation <= 45, 'Passarelas Aéreas Blindadas devem ficar a 35-45 unidades de altura (40m)');
    assert.equal(world.prisonIslandData.detentionPavilionsCount, 6, 'Devem existir os 6 Pavilhões Penitenciários Altos (58m a 82m)');
    assert.ok(world.prisonIslandData.omegaContainmentHeight >= 75 && world.prisonIslandData.omegaContainmentHeight <= 85, 'Pavilhão 1 (Contenção Ômega) deve ter entre 75 e 85 unidades de altura (82m)');
    assert.equal(world.prisonIslandData.energyContainmentCellsCount, 8, 'Ala de Contenção Ômega deve ter 8 Celas de Contenção Energética com barras de laser');
    assert.equal(world.prisonIslandData.visibleGroundCellsCount, 24, 'Devem existir 24 Celas Térreas Visíveis no total (8 Ômega Laser + 8 CV + 8 PCC)');
    assert.ok(world.prisonIslandData.prisonersInCellsCount >= 48, 'Devem existir dezenas de prisioneiros trancados dentro das celas térreas');
    assert.ok(world.prisonIslandData.cvPrisonersCount >= 12, 'Devem existir prisioneiros com as cores do CV');
    assert.ok(world.prisonIslandData.pccPrisonersCount >= 12, 'Devem existir prisioneiros com as cores do PCC');
    assert.ok(world.prisonIslandData.aresPrisonersCount >= 16, 'Devem existir mercenários da A.R.E.S. contidos nas celas de laser da Ala Ômega');
    assert.ok(world.prisonIslandData.guardsCount >= 28, 'Devem existir dezenas de guardas/policiais nas torres, ponte e passarelas elevadas');
    assert.ok(world.prisonIslandData.elevatedGuardCatwalksCount >= 6, 'Pátio interno deve ser dividido por Passarelas Elevadas de Ronda com guardas em cima');
    assert.equal(world.prisonIslandData.sportsCourtsCount, 2, 'Setor 1 deve ter 2 Quadras Esportivas Completas (1 Futsal + 1 Basquete)');
    assert.equal(world.prisonIslandData.hasConcreteBleachers, true, 'Quadras esportivas devem ter arquibancadas de concreto');
    assert.equal(world.prisonIslandData.weightBenchesCount, 12, 'Academia de Musculação ao Ar Livre deve ter 12 bancos de supino');
    assert.equal(world.prisonIslandData.cafeteriaTablesCount, 20, 'Pátio deve ter 20 mesas e bancos de concreto');
    assert.equal(world.prisonIslandData.armoredPrisonBusesCount, 4, 'Setor 2 deve ter 4 Ônibus/Caminhões Celulares Blindados');
    assert.equal(world.prisonIslandData.substationTransformersCount, 6, 'Setor 3 (Subestação) deve ter 6 Transformadores Elétricos Gigantes');
    assert.equal(world.prisonIslandData.dieselGeneratorsCount, 6, 'Setor 3 (Subestação) deve ter 6 Geradores a Diesel');
    assert.equal(world.prisonIslandData.powerTowersCount, 4, 'Setor 3 (Subestação) deve ter 4 Torres de Energia');
    assert.equal(world.prisonIslandData.waterTowersCount, 4, 'Setor 4 deve ter 4 Caixas d\'Água Cilíndricas Pretas/Amarelas');

    // Verifica que a Ponte Blindada (X=1375, Z=930) e a Doca Naval (X=920, Z=1550) são superfícies secas e verifica os 2 Helicópteros e 2 Lanchas do BOPE
    assert.equal(world.isDeepWaterAt(1375, 930, false), false, 'Tabuleiro da Grande Ponte Blindada deve ser superfície firme sobre o mar');
    assert.equal(world.isDeepWaterAt(920, 1550, false), false, 'Píer da Doca Naval da Guarda Costeira deve ser superfície firme para pedestres');
    const prisonHeli1 = destructibles.objects.find(
      (o) =>
        o.mesh.userData?.carName === 'HELICÓPTERO ÁGUIA 01 (BOPE / PRISÃO)' ||
        o.mesh.userData?.carName === 'HELICÓPTERO ÁGUIA PENITENCIÁRIO (POLÍCIA)'
    );
    const prisonHeli2 = destructibles.objects.find(
      (o) => o.mesh.userData?.carName === 'HELICÓPTERO CAVEIRA 02 (BOPE / PRISÃO)'
    );
    assert.ok(prisonHeli1 && prisonHeli2, 'Devem existir 2 Helicópteros do BOPE estacionados no Duplo Heliponto da Cidadela Panóptica');
    assert.ok(prisonHeli1.mesh.position.y >= 126.0 && prisonHeli2.mesh.position.y >= 126.0, 'Os 2 Helicópteros do BOPE devem estar no topo da Cidadela de 126m');

    const coastBoat1 = destructibles.objects.find(
      (o) => o.mesh.userData?.carName === 'LANCHA BLINDADA DA POLÍCIA MARÍTIMA 01'
    );
    const coastBoat2 = destructibles.objects.find(
      (o) => o.mesh.userData?.carName === 'LANCHA BLINDADA DA GUARDA COSTEIRA 02'
    );
    assert.ok(coastBoat1 && coastBoat2, 'Devem existir 2 Lanchas Blindadas da Polícia Marítima atracadas na Doca Naval da Guarda Costeira');

    // 7) Verifica o fechamento completo das 4 bordas da Ilha Principal (Noroeste, Norte, Nordeste e Sudoeste) + Teleporte Rápido (TP) para a CDD
    assert.equal(world.westAirportData.hasNorthMilitaryWing, true, 'Canto Noroeste deve ter a Ala Militar Norte da Base Oeste');
    assert.equal(world.westAirportData.hasMilitaryBarracks, true, 'Ala Militar Norte deve ter Quartel General Militar');
    assert.equal(world.westAirportData.hasTankYard, true, 'Ala Militar Norte deve ter Pátio de Tanques');
    assert.equal(world.westAirportData.antiAirBatteriesCount, 4, 'Ala Militar Norte deve ter 4 Baterias Antiaéreas SAM');
    assert.equal(world.westAirportData.militaryHelipadsCount, 2, 'Ala Militar Norte deve ter 2 Helipontos Militares');
    assert.equal(world.westAirportData.extraNorthMilitaryHangarsCount, 4, 'Ala Militar Norte deve ter 4 Hangares Militares Extras');

    assert.ok(
      world.getTerrainHeightAt(-750, -1180) > 10.0,
      'Favela Cidade de Deus deve se estender até a borda Norte (Z = -1180..-1320) com relevo de morro'
    );
    assert.equal(
      world.getRegionAt(-750, 15, -1180).id,
      'favela_cdd_cv',
      'Setor Norte estendido da Favela (Z = -1180) deve pertencer à região favela_cdd_cv'
    );
    assert.ok(
      world.industrialPCCData.blocksCount >= 56,
      `Domínio do PCC deve cobrir também a borda extrema Nordeste até Z = -1318 (total: ${world.industrialPCCData.blocksCount} quarteirões)`
    );

    assert.ok(world.southwestBeachData, 'Deve existir o registro da Ponta da Praia / Costão Sudoeste (world.southwestBeachData)');
    assert.equal(world.southwestBeachData.hasSouthwestLighthouse, true, 'Canto Sudoeste deve ter o Farol Marítimo Vermelho e Branco de LEGO sobre rochas');
    assert.equal(world.southwestBeachData.hasSandDunes, true, 'Canto Sudoeste deve ter Dunas de Areia Dourada com Buggies');
    assert.equal(world.southwestBeachData.hasWestMarina, true, 'Canto Sudoeste deve ter a Marina Oeste com lanchas e jet-skis');
    assert.equal(world.isDeepWaterAt(-1380, 1135, false), false, 'Passarela da Marina Oeste deve ser superfície firme sobre o mar');

    // Verifica Teleporte Rápido (TP) para a CDD — CIDADE DE DEUS (CV) no Largo Principal / Mirante (-702, 26.2, -135)
    const cddLandmark = world.landmarks.find((l) => l.code === 'CDD');
    assert.ok(cddLandmark, 'Deve existir o marco oficial CDD em MAP_LANDMARKS');
    assert.deepEqual(
      cddLandmark.spawn,
      { x: -702, y: 26.2, z: -135 },
      'Teleporte Rápido para CDD deve levar o jogador com segurança ao Largo Principal / Mirante (-702, 26.2, -135)'
    );

    // 8) Verifica Overhaul de UX do Mapa/Minimapa e Proibição Total de Emojis (Ícones SVG / Vetoriais)
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const r of MAP_REGIONS) {
      assert.equal(emojiRe.test(r.icon), false, `Região ${r.id} não deve usar emoji em r.icon`);
      assert.ok(getSvgIcon(r.icon, r.color).includes('<svg'), `getSvgIcon deve retornar SVG inline para ${r.icon}`);
    }
    for (const lm of world.landmarks) {
      assert.equal(emojiRe.test(lm.icon), false, `Marco ${lm.id} não deve usar emoji em lm.icon`);
      assert.ok(getSvgIcon(lm.icon, lm.color).includes('<svg'), `getSvgIcon deve retornar SVG inline para ${lm.icon}`);
    }

    const skyLandmark = world.landmarks.find((l) => l.code === 'SKY');
    assert.ok(
      skyLandmark.displayX !== undefined && skyLandmark.displayZ !== undefined && skyLandmark.altitudeLabel === 'ALTITUDE: 410m',
      'Marco do Aeroporta-Aviões (SKY) deve possuir coordenadas visuais deslocadas e tag ALTITUDE: 410m para nunca encavalar com Banco ou Torre'
    );

    // 9) Verifica o Overhaul Completo do Rio/Canal Urbano Navegável de Ponta a Ponta (Y = -3.5) e das 9 Pontes Elevadas em Arco (Y = +5.0m)
    assert.ok(world.urbanRiverData, 'Deve existir o registro completo do Rio Urbano Navegável (world.urbanRiverData)');
    assert.equal(world.urbanRiverData.waterY, -3.5, 'Água do Rio Urbano deve estar na cota profunda Y = -3.5');
    assert.equal(world.urbanRiverData.archPeakY, 5.0, 'Ápice do arco das pontes deve atingir Y = +5.0m');
    assert.equal(world.urbanRiverData.verticalClearance, 8.5, 'Vão livre vertical sob as pontes deve ser de 8.5m (Y = -3.5 até Y = +5.0)');
    assert.equal(world.urbanRiverData.archedBridgesCount, 9, 'Devem existir 9 Pontes Monumentais em Arco cruzando o Rio Urbano');
    assert.equal(world.urbanRiverData.riverPiersCount, 3, 'Devem existir 3 Píeres Fluviais de Madeira nas margens do Rio');
    assert.equal(world.urbanRiverData.connectedToNorthAndSouthOcean, true, 'Rio deve ligar o Oceano Norte direto ao Oceano Sul');

    // Confirma que os 2 antigos prédios da ponta direita da Orla da Praia (X = 582 em Z = 480 e Z = 630) foram removidos do alinhamento do rio
    const blockingBeachHotel = world.southBeachHotels.find((h) => h.x > 520);
    assert.equal(blockingBeachHotel, undefined, 'Nenhum hotel da Praia deve bloquear o alinhamento do Rio Urbano (X > 520)');

    // Confirma a equação senoidal suave bridgeY = 5.0 * sin(t * PI) nas pontes e que carros a 290 km/h sobem e descem sem bater em nenhum colisor!
    assert.ok(Math.abs(world.getRoadElevation(560, -117) - 5.0) < 0.05, 'Centro da Ponte Financeira (X=560, Z=-117) deve estar em Y = +5.0m');
    assert.ok(Math.abs(world.getRoadElevation(560, 712) - 5.0) < 0.05, 'Centro da Ponte Costeira da Orla Sul (X=560, Z=712) deve estar em Y = +5.0m');

    const supercar = destructibles.objects.find((o) => o.mesh.userData?.carType === 'apex_gtx') || destructibles.objects.find((o) => o.type === 'car');
    supercar.mesh.position.set(518, 0, 712);
    supercar.mesh.rotation.y = Math.PI / 2; // Apontado para +X (atravessando a Ponte Costeira da Praia rumo ao Porto!)
    controller.enterVehicle(supercar);
    controller.vehicleHeading = Math.PI / 2;
    controller.keys.forward = true;
    controller.keys.turbo = true; // 290 KM/H!
    let maxBridgeCarY = 0;
    for (let step = 0; step < 45; step++) {
      controller.update(1 / 30);
      if (supercar.mesh.position.y > maxBridgeCarY) {
        maxBridgeCarY = supercar.mesh.position.y;
      }
    }
    controller.keys.forward = false;
    controller.keys.turbo = false;
    assert.ok(
      supercar.mesh.position.x > 596 && maxBridgeCarY >= 4.6,
      `Carro a 290 km/h deve atravessar a Ponte em Arco de X=518 até X>596 subindo suavemente até Y≈5.0m sem bater em nenhum colisor (finalX=${supercar.mesh.position.x.toFixed(1)}, maxY=${maxBridgeCarY.toFixed(2)})`
    );
    controller.exitVehicle();

    // Confirma que uma Lancha/Jet-Ski no Píer Fluvial entra com [E] ou [F] e navega pelo Rio passando POR BAIXO das Pontes até o Oceano Sul!
    const riverJetSki = destructibles.objects.find(
      (o) => o.mesh.userData?.carName === 'JET-SKI WAVE RUNNER FOZ SUL 01'
    );
    assert.ok(riverJetSki, 'Deve existir Jet-Ski atracado no Píer Fluvial da Foz da Praia Sul (Y = -3.5)');
    controller.position.set(546.5, -2.9, 846.0); // Em cima do Deck de Madeira (Y = -2.9)
    controller._onKey({ code: 'KeyF', repeat: false }, true);
    assert.ok(controller.currentVehicle === riverJetSki, 'Jogador no Píer Fluvial deve conseguir embarcar no Jet-Ski apertando [F] (ou [E])');

    // Posiciona o Jet-Ski antes da Ponte Costeira (X=560, Z=680) e navega por baixo da ponte até o Oceano Sul (Z > 1070)!
    riverJetSki.mesh.position.set(560, -3.5, 680);
    controller.vehicleHeading = 0; // Apontado para +Z (rumo à Foz da Praia e Oceano Sul)
    controller.keys.forward = true;
    controller.keys.turbo = true;
    for (let step = 0; step < 190; step++) {
      controller.update(1 / 30);
    }
    controller.keys.forward = false;
    controller.keys.turbo = false;
    assert.ok(
      riverJetSki.mesh.position.z > 1070,
      `Jet-Ski deve navegar pelo Rio passando livremente por baixo da Ponte da Orla (Z=712) e atravessando a Foz da Praia até o Oceano Sul Z>1070 (atual z=${riverJetSki.mesh.position.z.toFixed(1)})`
    );
    controller.exitVehicle();
  });
});
