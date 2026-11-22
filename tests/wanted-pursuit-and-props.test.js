import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { Minifigure } = await import('../src/entities/Minifigure.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 2200);
const hud = new LegoHud();
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
const minifig = new Minifigure('caveira');
scene.add(minifig.root);
const domElement = globalThis.document.getElementById('game-container');
const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);
hud.isTitleScreenActive = false;
hud._lastController = controller;

describe('~450 OBJETOS QUEBRÁVEIS DE RUA (60 FPS) + SISTEMA DE PROCURADO GTA (0 A 5 ESTRELAS) & FUGA', () => {
  it('1. ~460 Objetos Quebráveis LEGO em toda a cidade (6 categorias, Culling 240m, Gêiser 8m/7s, ATMs ricos e Auto-Rebuild 45s)', () => {
    const streetProps = destructibles.objects.filter((o) => o.isStreetProp);
    assert.ok(
      streetProps.length >= 430,
      `Esperado ~450 objetos quebráveis de rua, encontrados: ${streetProps.length}`
    );

    const requiredTypes = [
      'streetlamp',
      'traffic_light',
      'hydrant',
      'bus_stop',
      'phone_booth',
      'newsstand',
      'atm_machine',
      'food_cart',
      'cafe_table',
      'trash_can',
      'dumpster',
      'park_bench',
      'street_sign',
      'traffic_cone',
      'orange_barricade'
    ];
    for (const t of requiredTypes) {
      const count = streetProps.filter((p) => p.type === t).length;
      assert.ok(count > 0, `Categoria obrigatória de rua ausente: ${t}`);
    }

    // Índice Espacial O(1) ativo
    assert.ok(destructibles._spatialGrid.size > 20, 'Grade espacial 2D indexada para 60 FPS');
    const sampleProp = streetProps[0];
    const nearby = destructibles.getObjectsNear(sampleProp.basePos.x, sampleProp.basePos.z, 6.0);
    assert.ok(nearby.includes(sampleProp), 'getObjectsNear retorna prop na célula espacial');

    // Distance Culling (< 240m visível, > 240m oculto)
    destructibles.update(0.2, new THREE.Vector3(sampleProp.basePos.x + 500, 0, sampleProp.basePos.z));
    assert.equal(sampleProp.mesh.visible, false, 'StreetProp > 240m fica oculto por distance culling');
    destructibles.update(0.2, new THREE.Vector3(sampleProp.basePos.x + 20, 0, sampleProp.basePos.z));
    assert.equal(sampleProp.mesh.visible, true, 'StreetProp < 240m volta a ficar visível');

    // Poste de luz / Semáforo tomba e faisca ao ser atropelado!
    const lamp = streetProps.find((p) => p.type === 'streetlamp' && !p.destroyed);
    const prevToppling = destructibles.topplingPoles.length;
    destructibles.damageObject(lamp, 999, new THREE.Vector3(1, 0.3, 0));
    assert.equal(lamp.destroyed, true);
    assert.ok(destructibles.topplingPoles.length > prevToppling, 'Poste tombando criado ao quebrar');

    // Hidrante Vermelho LEGO dispara Gêiser Vertical de Água de 8m por 7 segundos!
    const hydrant = streetProps.find((p) => p.type === 'hydrant' && !p.destroyed);
    destructibles.damageObject(hydrant, 999, hydrant.basePos);
    const geyser = destructibles.geysers[destructibles.geysers.length - 1];
    assert.ok(geyser, 'Gêiser vertical criado ao quebrar hidrante');
    assert.equal(geyser.maxHeight, 8.0, 'Gêiser tem 8m de altura');
    assert.equal(geyser.maxTimer, 7.0, 'Gêiser dura 7 segundos');

    // Caixa Eletrônico (ATM LEGO) jorra muitos Studs Dourados e Azuis!
    const atm = streetProps.find((p) => p.type === 'atm_machine');
    assert.ok(atm.studDrops.gold >= 12 && atm.studDrops.blue >= 8, 'ATM jorra muitos Studs Dourados e Azuis');

    // Auto-Reconstrução LEGO após 45 segundos fora do campo de visão / longe do jogador!
    assert.equal(lamp.respawnTimer, 45.0);
    // Enquanto o jogador estiver olhando de perto (< 15m), não reconstrói na cara dele
    destructibles.update(5.0, lamp.basePos.clone(), { x: 0, z: 1 });
    assert.equal(lamp.destroyed, true);
    // Quando o jogador se afasta (> 80m) por 45s, reconstrói automaticamente!
    destructibles.update(45.5, new THREE.Vector3(lamp.basePos.x + 150, 0, lamp.basePos.z));
    assert.equal(lamp.destroyed, false, 'Objeto de rua reconstruído após 45s fora de visão');
  });

  it('2. Cidade 100% Pacífica em 0★ (quebrar postes/cones não chama polícia) + Escalada Cinematográfica 1★ a 5★', () => {
    const ws = world.livingCity.wantedSystem;
    ws.clearWanted('reset');

    assert.equal(ws.stars, 0);
    assert.equal(hud.wantedPanelEl.classList.contains('hidden'), true, 'Estrelas 100% ocultas em 0 Estrelas');

    // Quebrar 4 cones/postes/lixeiras por acidente NÃO chama polícia!
    const smallProps = destructibles.objects.filter(
      (o) => o.isStreetProp && (o.type === 'traffic_cone' || o.type === 'trash_can') && !o.destroyed
    );
    for (let i = 0; i < 4; i++) {
      destructibles.damageObject(smallProps[i], 999, smallProps[i].basePos);
    }
    assert.equal(ws.stars, 0, 'Quebrar alguns objetos de calçada sem querer NÃO aciona polícia');
    assert.equal(hud.wantedPanelEl.classList.contains('hidden'), true);

    // Gatilho Intencional: Explodir 2 carros / ATMs em sequência acende ⭐ 1 ESTRELA!
    const cars = destructibles.objects.filter((o) => o.type === 'car' && !o.isPoliceUnit && !o.destroyed);
    destructibles.damageObject(cars[0], 9999, cars[0].basePos);
    destructibles.damageObject(cars[1], 9999, cars[1].basePos);
    assert.equal(ws.stars, 1, 'Destruir veículos em sequência aciona 1 Estrela');
    assert.equal(hud.wantedPanelEl.classList.contains('hidden'), false, 'Painel de Estrelas visível na HUD');

    controller.position.set(0, 0.5, -200);
    ws.update(0.2, controller.position, controller);
    assert.ok(ws.pursuitVehicles.length >= 1, '1★ despacha viatura de Patrulha Local');

    // 2 ESTRELAS (Cerco Urbano + Interceptor V8 + Policiais desembarcam se parar)
    ws.setWantedStars(2);
    for (let k = 0; k < 5; k++) ws.update(1.7, controller.position, controller);
    assert.ok(ws.pursuitVehicles.length >= 2, '2★ despacha múltiplas Interceptor V8');
    // Aproxima uma viatura do jogador parado para validar desembarque policial
    ws.pursuitVehicles[0].carObj.mesh.position.set(0, 0.4, -190);
    ws.update(0.2, controller.position, controller);
    assert.ok(ws.footUnits.length >= 1, '2★ desembarca policiais atirando se o jogador parar');

    // 3 ESTRELAS (Bloqueios de Rua + Helicóptero Águia com Cone Branco de Holofote à Noite!)
    ws.setWantedStars(3);
    world.atmosphere.setTimeMode('night');
    world.atmosphere.update(0.1, controller.position);
    // Simula jogador correndo na Av. Central (X = 0) para disparar Bloqueio Policial à frente
    ws._roadblockCooldown = 0;
    controller.position.set(0, 0.5, -180);
    ws.update(0.2, new THREE.Vector3(0, 0.5, -172), controller);
    assert.ok(ws.eagleHeli, '3★ despacha Helicóptero Policial Tático Águia');
    assert.equal(ws.eagleHeli.coneMesh.visible, true, 'Holofote branco do Águia aceso à noite!');
    assert.ok(ws.roadblocks.length >= 1, '3★ monta Barreira Policial com viaturas, cones e rampa na avenida à frente');

    // 4 ESTRELAS (Choque Pesado / Caveirão BOPE + Tropas com Escudo)
    ws.setWantedStars(4);
    ws._spawnPursuitVehicle(controller.position);
    const hasHeavyBope = ws.pursuitVehicles.some(
      (v) => v.role === 'bope_heavy' || v.role === 'choque_pickup'
    );
    assert.equal(hasHeavyBope, true, '4★ despacha Caveirão Blindado / Picape de Choque');

    // 5 ESTRELAS (FORÇA MÁXIMA REALISTA: BOPE + até 2 Helicópteros Águia, sem Exo-Drones sci-fi!)
    ws.setWantedStars(5);
    ws._spawnPursuitVehicle(controller.position);
    const bopeElite = ws._spawnFootTrooper({ x: 8, y: 0.4, z: -172 }, 5);
    assert.equal(ws.hunterDrones.length, 0, '5★ realista não despacha mais drones sci-fi');
    assert.ok(ws.policeHelicopters.length >= 2, '5★ despacha até 2 Helicópteros Águia das bases');
    assert.equal(bopeElite.faction, 'bope', '5★ despacha tropa tática de elite do BOPE');

    // Radar renderiza viaturas, bloqueios e Águia sem erros
    const reg = world.getRegionAt(0, 0.5, -172);
    hud.updateMinimap(new THREE.Vector3(0, 0.5, -172), 0, 0, reg, world, 15, 0.016);
  });

  it('3. Mecânicas Reais de Fuga (Túnel do Metrô, Embaixo de Viaduto, Pintura na LEGO Customs) + Regeneração 6s e "DETIDO"', () => {
    const ws = world.livingCity.wantedSystem;

    // A) TRUQUE 1 + COOLDOWN DE 55s EM 3★ (GTA V): Entrar nos Túneis Subterrâneos do Metrô corta visão do Águia na hora!
    ws.clearWanted('reset');
    ws.setWantedStars(3);
    ws._spawnEagleHelicopter(new THREE.Vector3(0, 0.5, -100));
    const undergroundPos = new THREE.Vector3(0, -6.5, -100);
    ws.update(0.5, undergroundPos, controller);
    assert.equal(ws._hasLineOfSight, false, 'Túnel Subterrâneo do Metrô corta linha de visão imediatamente');
    assert.equal(ws.isEscaping, true, 'Modo de fuga ativado (Estrelas piscando Azul/Cinza)');
    assert.equal(hud.wantedPanelEl.classList.contains('escaping-mode'), true);

    const studsBeforeEscape = hud.totalStuds;
    // Mantém-se fora de visão pelos 55 segundos completos de 3★!
    ws.update(55.0, undergroundPos, controller);
    assert.equal(ws.stars, 0, 'Após 55s sem visão em 3★, despista a polícia para 0 Estrelas!');
    assert.ok(hud.totalStuds > studsBeforeEscape, 'Recebe Bônus de Studs de Fuga Perfeita!');
    assert.equal(hud.wantedPanelEl.classList.contains('hidden'), true);

    // B) Esconder-se EMBAIXO DO VIADUTO corta a visão aérea do Helicóptero Águia!
    ws.setWantedStars(3);
    ws._clearAllFootUnits();
    ws.pursuitVehicles.forEach((v) => destructibles.unregisterDestructible(v.carObj));
    ws.pursuitVehicles.length = 0;
    ws._spawnEagleHelicopter(new THREE.Vector3(120, 0.5, -382));
    // Viaduto Norte passa em Z = -382 com tabuleiro elevado (~11.5m); pista térrea em Y ~ 0.4m fica embaixo dele!
    const underViaductPos = new THREE.Vector3(120, 0.4, -382);
    assert.equal(ws._isPlayerUnderViaduct(underViaductPos), true, 'Detecta jogador escondido embaixo do Viaduto');
    assert.equal(ws._computeLineOfSight(underViaductPos, controller), false, 'Águia perde visão embaixo do Viaduto');

    // C) TRUQUE 2 (PAY 'N' SPRAY): Entrar na Oficina "LEGO Customs" sem testemunha próxima e PINTAR O CARRO zera na hora!
    ws.setWantedStars(4);
    ws._clearAllFootUnits();
    ws.pursuitVehicles.forEach((v) => {
      v.carObj.mesh.position.set(-250, 0.4, 200); // Longe do box da oficina (X=68, Z=-454)
    });
    const testCar = destructibles.objects.find((o) => o.type === 'car' && !o.isPoliceUnit && !o.destroyed);
    testCar.mesh.position.set(68, 0.46, -454);
    controller.enterVehicle(testCar);
    const opened = hud.customsStudio.open(controller, world, testCar, 'paint');
    assert.equal(opened, true);
    const nextPaint = hud.customsStudio.draft.primaryColorId === 'crimson' ? 'cobalt' : 'crimson';
    const clearedByPaint = hud.customsStudio.applyPaintColor(nextPaint);
    assert.equal(clearedByPaint, true, 'Pintar o carro sem testemunha policial zera o Procurado na hora!');
    assert.equal(ws.stars, 0, 'Estrelas zeradas instantaneamente na LEGO Customs!');
    hud.customsStudio.close(true);
    controller.exitVehicle();

    // D) Dano Policial, Regeneração Automática em 6s e Respawn "DETIDO" ao zerar os 4 Corações!
    ws.setWantedStars(2);
    ws.playerHitIFrameTimer = 0;
    ws.applyPursuitDamageToPlayer(80, controller);
    assert.ok(world.livingCity.playerHp < world.livingCity.playerMaxHp, 'Tiros policiais tiram vida durante perseguição');
    const damagedHp = world.livingCity.playerHp;

    // 6.5s sem tomar tiro regenera vida automaticamente!
    ws.update(6.5, new THREE.Vector3(500, 0.5, 500), controller);
    ws.update(1.0, new THREE.Vector3(500, 0.5, 500), controller);
    assert.ok(world.livingCity.playerHp > damagedHp, 'Vida regenera após 6s sem tomar tiro');

    // Zerar os 4 Corações aciona "DETIDO": limpa estrelas, desconta pequena fiança e renasce no Centro sem perder save!
    hud.totalStuds = 5000;
    ws.playerHitIFrameTimer = 0;
    world.livingCity.playerHp = 10;
    ws.applyPursuitDamageToPlayer(200, controller);
    assert.equal(ws.stars, 0, 'DETIDO limpa nível de procurado para 0★');
    assert.equal(world.livingCity.playerHp, world.livingCity.playerMaxHp, 'DETIDO restaura os 4 Corações LEGO cheios');
    assert.ok(hud.totalStuds > 0 && hud.totalStuds < 5000, 'DETIDO desconta apenas alguns Studs de fiança');
    assert.ok(Math.hypot(controller.position.x - 0, controller.position.z - -88) < 2.0, 'Renasce limpo na Praça/Delegacia Central');
  });

  it('4. Spawn Policial Imediato no Frame 0 (Sem Deadlock de Fuga), Escalada por Objetos 0★->5★ e Trânsito Urbano Inteligente (Ultrapassagem + Anti-Gridlock)', () => {
    const ws = world.livingCity.wantedSystem;
    ws.clearWanted('reset');
    controller.position.set(0, 0.5, -200);

    // 1) Destruir 5+ objetos de rua seguidos escala de 0★ até 5★ e spawna polícia NO MESMO FRAME!
    const streetTargets = destructibles.objects.filter((o) => o.isStreetProp && !o.destroyed);
    for (let i = 0; i < 5; i++) {
      destructibles.damageObject(streetTargets[i], 999, streetTargets[i].basePos);
    }
    assert.equal(ws.stars, 1, 'A partir do 5º objeto quebrado em sequência, aciona 1★');
    assert.ok(
      ws.pursuitVehicles.length >= 1,
      'Polícia spawna IMEDIATAMENTE no mesmo frame em que 1★ acende (sem esperar _spawnTickTimer)'
    );
    assert.equal(
      ws.isEscaping,
      false,
      'Janela de Engajamento Policial (_pursuitEngageGraceTimer) impede que entre em modo de fuga sozinho no Frame 1'
    );

    // Continua quebrando objetos de rua em sequência até atingir 5★!
    let idx = 5;
    while (ws.stars < 5 && idx < streetTargets.length) {
      destructibles.damageObject(streetTargets[idx], 999, streetTargets[idx].basePos);
      idx++;
    }
    assert.equal(ws.stars, 5, 'Combo de destruição de objetos de rua escala até 5★ (Força Máxima)');
    assert.ok(ws.eagleHeli, 'Helicóptero Águia presente na escalada imediata');
    assert.ok(ws.policeHelicopters.length >= 2, 'Até 2 Helicópteros Águia ativos em 5★');

    // Manobra local de destravamento sem teletransporte injusto quando stuckTimer > 2.8s
    const pv = ws.pursuitVehicles.find((v) => !v.carObj.destroyed && !v.retreating) || ws._spawnPursuitVehicle(controller.position);
    pv.carObj.mesh.position.set(controller.position.x + 190, 0.4, controller.position.z);
    pv.stuckTimer = 3.0;
    ws.update(0.1, controller.position, controller);
    assert.equal(pv.stuckTimer, 0, 'Viatura policial presa destrava localmente e reseta stuckTimer');
    assert.ok(
      Math.hypot(pv.carObj.mesh.position.x - controller.position.x, pv.carObj.mesh.position.z - controller.position.z) > 150,
      'Viatura que ficou longe NUNCA teletransporta para perto do jogador'
    );

    ws.clearWanted('reset');

    // 2) Trânsito Urbano Inteligente: Ultrapassagem Suave de Faixa e Auto-Relocação Anti-Engarrafamento
    const lc = world.livingCity;
    const tv1 = lc.trafficVehicles[0];
    const tv2 = lc.trafficVehicles[1];
    assert.ok(tv1 && tv2, 'Frota de trânsito urbano ativa');

    // Coloca tv1 e tv2 na mesma avenida X = 0 indo para +Z, com tv2 parado 10m à frente de tv1
    tv1.axis = 'x_const';
    tv1.roadCoord = 0;
    tv1.dir = 1;
    tv1.baseLaneOffset = 3.8;
    tv1.laneOffset = 3.8;
    tv1.targetLaneOffset = 3.8;
    tv1.posAlong = -120;
    tv1.currentSpeed = tv1.cruiseSpeed;
    tv1.hijackedByPlayer = false;
    tv1.destructible.isDriven = false;
    tv1.destructible.destroyed = false;
    tv1.mesh.position.set(3.8, 0.4, -120);
    tv1.mesh.rotation.y = 0;

    tv2.axis = 'x_const';
    tv2.roadCoord = 0;
    tv2.dir = 1;
    tv2.baseLaneOffset = 3.8;
    tv2.laneOffset = 3.8;
    tv2.targetLaneOffset = 3.8;
    tv2.posAlong = -110;
    tv2.currentSpeed = 0;
    tv2.hijackedByPlayer = true; // Simulando carro parado/abandonado na faixa à frente
    tv2.destructible.isDriven = false;
    tv2.destructible.destroyed = false;
    tv2.mesh.position.set(3.8, 0.4, -110);
    tv2.mesh.rotation.y = 0;

    lc._updateUrbanTraffic(0.2, new THREE.Vector3(50, 0.5, -120), controller);
    tv2.hijackedByPlayer = false;
    assert.notEqual(
      tv1.targetLaneOffset,
      tv1.baseLaneOffset,
      'Carro do trânsito muda suavemente de faixa (targetLaneOffset) para ultrapassar veículo parado à frente'
    );

    // Simula engarrafamento (> 4.2s travado) -> Auto-Relocação Invisível
    tv1.stuckTimer = 4.5;
    tv1.currentSpeed = 0;
    lc._updateUrbanTraffic(0.2, new THREE.Vector3(0, 0.5, -120), controller);
    assert.equal(tv1.stuckTimer, 0, 'Veículo travado por > 4.2s é automaticamente reciclado para via livre');
    assert.ok(tv1.respawnFadeTimer > 0, 'Fade-in suave ativado após auto-relocação');
  });

  it('5. Rádio Ao Vivo Estilo GTA 6 ([Z]/[P] Roda Radial, Zero Pular Música, Relógio Sincronizado entre Rádios, Migração e /configs)', async () => {
    const fs = await import('node:fs');
    const { TIKTOK_RADIO_TRACKS } = await import('../src/audio/TikTokRadioSystem.js');
    const { collectMigratedLegacyTracksFromBrowser, LEGACY_SAVE_SLOTS_KEY } = await import(
      '../src/audio/radio/RadioDefaultCatalogAndStorage.js'
    );
    const { soundFX } = await import('../src/audio/SoundFX.js');

    assert.equal(TIKTOK_RADIO_TRACKS.length, 8, 'Catálogo base de fallback possui 8 faixas');
    assert.ok(hud.tiktokRadio, 'Sistema de rádio instanciado na LegoHud');
    assert.equal(hud.tiktokRadio.stations.length, 1, 'Inicia com exatamente 1 única Rádio Padrão');
    assert.equal(hud.tiktokRadio.activeStationId, null, 'Inicia desligada (OFF) até sintonizar');

    // Proibição estrita de pular faixa manualmente (estilo GTA 6)
    assert.equal(typeof hud.tiktokRadio.nextTrack, 'undefined', 'Sem método nextTrack manual');
    assert.equal(typeof hud.tiktokRadio.prevTrack, 'undefined', 'Sem método prevTrack manual');

    // Segurar [Z] abre a Roda Radial (#gta6-radio-wheel-overlay) e soltar [Z] fecha na hora!
    controller._onKey({ code: 'KeyZ', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.isRadioWheelOpen, true, 'Segurar [Z] abre a Roda Radial de Rádios');
    assert.equal(hud.radioWheelOverlayEl.classList.contains('hidden'), false);
    controller._onKey({ code: 'KeyZ', repeat: false, preventDefault() {} }, false);
    assert.equal(hud.isRadioWheelOpen, false, 'Soltar [Z] fecha a Roda Radial');

    // Segurar [P] também abre/fecha a Roda Radial
    controller._onKey({ code: 'KeyP', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.isRadioWheelOpen, true, 'Segurar [P] também abre a Roda Radial');
    controller._onKey({ code: 'KeyP', repeat: false, preventDefault() {} }, false);
    assert.equal(hud.isRadioWheelOpen, false);

    // Cria uma 2ª estação e move faixas via Drag & Drop lógico (moveTrackBetweenStations)
    const stPadrao = hud.tiktokRadio.stations[0];
    const stNova = hud.tiktokRadio.createStation({
      name: 'RÁDIO BAILE CDD',
      freq: '98.5 FM',
      color: '#ef4444',
      icon: 'flame'
    });
    const movedOk = hud.tiktokRadio.moveTrackBetweenStations('brazilian_phonk', stPadrao.id, stNova.id);
    const movedOk2 = hud.tiktokRadio.moveTrackBetweenStations('tokyo_drift_phonk', stPadrao.id, stNova.id);
    assert.equal(movedOk && movedOk2, true, 'Músicas movidas de uma rádio para outra com sucesso');
    assert.equal(stPadrao.trackIds.includes('brazilian_phonk'), false, 'Saiu da Rádio Padrão');
    assert.equal(stNova.trackIds.includes('brazilian_phonk'), true, 'Entrou na nova rádio');

    // Tecla ] (BracketRight) sintoniza a 1ª estação (Rádio Padrão)
    controller._onKey({ code: 'BracketRight', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.tiktokRadio.activeStationId, stPadrao.id, 'Tecla ] sintoniza a Rádio Padrão');
    assert.equal(hud.tiktokRadio.isPlaying, true, 'Rádio tocando ao vivo');
    assert.equal(hud.tiktokHudPillEl.classList.contains('playing'), true, 'Card ao vivo ativo na HUD');

    // Verifica Relógio Sincronizado: todas as rádios avançam juntas enquanto você ouve outra!
    const liveBefore = hud.tiktokRadio.getStationLiveNow(stPadrao.id);
    assert.ok(liveBefore && liveBefore.track, 'Rádio Padrão transmitindo faixa ao vivo');

    // Muda para a Rádio 2 (]), passa 35 segundos no relógio global e volta para a Rádio Padrão ([)
    controller._onKey({ code: 'BracketRight', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.tiktokRadio.activeStationId, stNova.id, 'Mudou para a 2ª estação');

    hud.tiktokRadio.broadcastClock.advanceClockForTest(35);

    controller._onKey({ code: 'BracketLeft', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.tiktokRadio.activeStationId, stPadrao.id, 'Voltou para a Rádio Padrão');
    const liveAfter = hud.tiktokRadio.getStationLiveNow(stPadrao.id);
    const progressed =
      liveAfter.trackId !== liveBefore.trackId ||
      Math.abs(liveAfter.offsetSec - (liveBefore.offsetSec + 35)) < 1.5;
    assert.equal(progressed, true, 'Rádio Padrão avançou 35s em segundo plano junto com as demais estações!');
    hud.tiktokRadio.broadcastClock.resetOffset();

    // Verifica migração automática das músicas salvas hoje pelo jogador para 1 única Rádio Padrão
    const customThumb = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    globalThis.localStorage.setItem(
      LEGACY_SAVE_SLOTS_KEY,
      JSON.stringify([
        {
          radioState: {
            tracks: [
              ...TIKTOK_RADIO_TRACKS.map((t) => ({ ...t, isCustomFile: false })),
              {
                id: 'custom_mp3_user_1',
                title: 'MEU FUNK SALVO',
                artist: 'MC LEGO',
                isCustomFile: true,
                coverDataUrl: customThumb
              }
            ]
          }
        },
        null,
        null
      ])
    );
    const migrated = await collectMigratedLegacyTracksFromBrowser();
    assert.equal(migrated.length, 1, 'Migra exclusivamente as músicas colocadas pelo jogador quando existem MP3 custom');
    assert.equal(migrated[0].id, 'custom_mp3_user_1');
    assert.equal(migrated[0].coverDataUrl, customThumb, 'Preserva a capa salva pelo jogador');

    // Clicar em "SALVAR E SAIR PARA O MENU INICIAL" (#btn-pause-save-quit) PARA TODA MÚSICA NA HORA!
    const btnSaveQuit = globalThis.document.getElementById('btn-pause-save-quit');
    assert.ok(btnSaveQuit, 'Botão #btn-pause-save-quit existe');
    btnSaveQuit.click();

    assert.equal(hud.isTitleScreenActive, true, 'Voltou para a Tela Inicial');
    assert.equal(hud.tiktokRadio.isPlaying, false, 'Rádio desligou imediatamente ao Salvar e Sair');
    assert.equal(soundFX.tiktokRadioActive, false, 'Flag tiktokRadioActive desligada ao sair para o menu');

    // Valida existência da rota /configs (Drag & Drop + YouTube -> MP3) e do server.py
    const configsHtml = fs.readFileSync(new URL('../configs/index.html', import.meta.url), 'utf8');
    const configsJs = fs.readFileSync(new URL('../configs/configs.js', import.meta.url), 'utf8');
    const serverPy = fs.readFileSync(new URL('../server.py', import.meta.url), 'utf8');
    assert.ok(configsHtml.includes('youtube-import-form') && configsHtml.includes('stations-board'));
    assert.ok(configsJs.includes('draggable="true"') && configsJs.includes('/api/radio/youtube'));
    assert.ok(serverPy.includes('yt-dlp') && serverPy.includes('"/configs"'));
  });
});
