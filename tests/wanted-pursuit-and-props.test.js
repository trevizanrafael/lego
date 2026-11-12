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

    // 5 ESTRELAS (Divisão Especial "CAÇADORES ANTI-HERÓI": Blindados, Drones, Exoesqueletos, Redes & Mísseis!)
    ws.setWantedStars(5);
    ws._spawnPursuitVehicle(controller.position);
    ws._spawnHunterDrone(controller.position);
    const exo = ws._spawnFootTrooper({ x: 8, y: 0.4, z: -172 }, 5);
    assert.ok(ws.hunterDrones.length >= 1, '5★ despacha Drones Rápidos Caçadores');
    assert.equal(exo.isExo, true, '5★ despacha Exoesqueleto Caçador de Super-Humanos');

    // Dispara Rede Energética e Míssil Teleguiado
    ws._spawnPursuitProjectile(new THREE.Vector3(0, 1.5, -174), new THREE.Vector3(0, 1.2, -172), 'energy_net');
    ws._spawnPursuitProjectile(new THREE.Vector3(0, 4.5, -195), new THREE.Vector3(0, 1.2, -172), 'missile');
    for (let step = 0; step < 8; step++) {
      ws.update(0.05, new THREE.Vector3(0, 0.5, -172), controller);
    }
    assert.ok(controller.energyNetSlowTimer > 0, 'Rede energética dos Caçadores Anti-Herói desacelera temporariamente');

    // Radar renderiza viaturas, bloqueios e Águia sem erros
    const reg = world.getRegionAt(0, 0.5, -172);
    hud.updateMinimap(new THREE.Vector3(0, 0.5, -172), 0, 0, reg, world, 15, 0.016);
  });

  it('3. Mecânicas Reais de Fuga (Túnel do Metrô, Embaixo de Viaduto, Pintura na LEGO Customs) + Regeneração 6s e "DETIDO"', () => {
    const ws = world.livingCity.wantedSystem;

    // A) TRUQUE 1 + COOLDOWN DE 18s: Entrar nos Túneis Subterrâneos do Metrô corta visão do Águia na hora!
    ws.clearWanted('reset');
    ws.setWantedStars(3);
    ws._spawnEagleHelicopter(new THREE.Vector3(0, 0.5, -100));
    const undergroundPos = new THREE.Vector3(0, -6.5, -100);
    ws.update(0.5, undergroundPos, controller);
    assert.equal(ws._hasLineOfSight, false, 'Túnel Subterrâneo do Metrô corta linha de visão imediatamente');
    assert.equal(ws.isEscaping, true, 'Modo de fuga ativado (Estrelas piscando Azul/Cinza)');
    assert.equal(hud.wantedPanelEl.classList.contains('escaping-mode'), true);

    const studsBeforeEscape = hud.totalStuds;
    // Mantém-se fora de visão pelos 18 segundos completos!
    ws.update(18.0, undergroundPos, controller);
    assert.equal(ws.stars, 0, 'Após 18s sem visão, despista a polícia para 0 Estrelas!');
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
    assert.ok(world.livingCity.playerHp < 250, 'Tiros policiais tiram vida durante perseguição');
    const damagedHp = world.livingCity.playerHp;

    // 6.5s sem tomar tiro regenera vida automaticamente!
    ws.update(6.5, new THREE.Vector3(500, 0.5, 500), controller);
    ws.update(1.0, new THREE.Vector3(500, 0.5, 500), controller);
    assert.ok(world.livingCity.playerHp > damagedHp, 'Vida regenera após 6s sem tomar tiro');

    // Zerar os 4 Corações aciona "DETIDO": limpa estrelas, desconta pequena fiança e renasce no Centro sem perder save!
    hud.totalStuds = 5000;
    ws.playerHitIFrameTimer = 0;
    world.livingCity.playerHp = 10;
    ws.applyPursuitDamageToPlayer(50, controller);
    assert.equal(ws.stars, 0, 'DETIDO limpa nível de procurado para 0★');
    assert.equal(world.livingCity.playerHp, 250, 'DETIDO restaura os 4 Corações LEGO cheios');
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
    assert.equal(ws.stars, 5, 'Combo de destruição de objetos de rua escala até 5★ (Caçadores Anti-Herói)');
    assert.ok(ws.eagleHeli, 'Helicóptero Águia presente na escalada imediata');
    assert.ok(ws.hunterDrones.length >= 1, 'Drones Caçadores presentes no Frame 0 de 5★');

    // Reposicionamento automático de viatura policial presa (stuckTimer > 2.2s)
    const pv = ws.pursuitVehicles.find((v) => !v.carObj.destroyed && !v.retreating) || ws._spawnPursuitVehicle(controller.position);
    pv.stuckTimer = 2.5;
    const oldX = pv.carObj.mesh.position.x;
    const oldZ = pv.carObj.mesh.position.z;
    ws.update(0.1, controller.position, controller);
    assert.equal(pv.stuckTimer, 0, 'Viatura policial presa reseta stuckTimer e reposiciona na avenida');
    assert.ok(
      Math.hypot(pv.carObj.mesh.position.x - oldX, pv.carObj.mesh.position.z - oldZ) > 1.0,
      'Viatura policial presa foi reposicionada para continuar a perseguição'
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

  it('5. Rádio Estilo Spotify na Tecla [P] (Fotos de Capa, Adicionar/Remover Músicas, Persistência no Save Slot e Parada Total ao Salvar e Sair)', async () => {
    const { TIKTOK_RADIO_TRACKS } = await import('../src/audio/TikTokRadioSystem.js');
    const { loadAllSaveSlots } = await import('../src/ui/FactionIconsAndSaveSystem.js');
    const { soundFX } = await import('../src/audio/SoundFX.js');

    assert.equal(TIKTOK_RADIO_TRACKS.length, 8, '8 hits virais do TikTok configurados na rádio');
    assert.ok(hud.tiktokRadio, 'TikTokRadioSystem instanciado na LegoHud');

    // Aperta [P] para abrir o modal estilo Spotify Desktop
    controller._onKey({ code: 'KeyP', repeat: false, shiftKey: false, preventDefault() {} }, true);
    assert.equal(hud.isTikTokRadioOpen, true, 'Tecla [P] abre o modal #tiktok-radio-modal');
    assert.equal(hud.tiktokModalEl.classList.contains('hidden'), false);

    // Aperta [P] novamente para fechar o modal
    controller._onKey({ code: 'KeyP', repeat: false, shiftKey: false, preventDefault() {} }, true);
    assert.equal(hud.isTikTokRadioOpen, false, 'Tecla [P] fecha o modal #tiktok-radio-modal');

    // Aperta Shift + [P] durante o jogo para pular de faixa rapidamente com Mini-Toast Neon
    const prevIdx = hud.tiktokRadio.currentTrackIndex;
    controller._onKey({ code: 'KeyP', repeat: false, shiftKey: true, preventDefault() {} }, true);
    assert.equal(hud.tiktokRadio.isPlaying, true, 'Shift + [P] liga a rádio e avança para a próxima música');
    assert.notEqual(hud.tiktokRadio.currentTrackIndex, prevIdx, 'Índice da faixa avançou no Shift + [P]');
    assert.equal(hud.tiktokToastEl.classList.contains('hidden'), false, 'Mini-Toast Neon exibido ao trocar faixa');

    // 1) Adicionar Foto de Capa Customizada e Curtir Música (❤️)
    const targetTrack = hud.tiktokRadio.tracks[0];
    const customCover = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await hud.tiktokRadio.setTrackCoverFromFile(targetTrack.id, { name: 'minha_capa.png', dataUrl: customCover });
    assert.equal(targetTrack.coverDataUrl, customCover, 'Foto de capa aplicada na música');

    const likedState = hud.tiktokRadio.toggleLikeTrack(targetTrack.id);
    assert.equal(likedState, true, 'Música marcada como Curtida (❤️)');

    // 2) Remover 1 Música Específica e Importar MP3 Local
    const removedOne = hud.tiktokRadio.removeTrack('montagem_coral');
    assert.equal(removedOne, true, 'Música específica removida da playlist');
    assert.equal(hud.tiktokRadio.tracks.length, 7, 'Playlist agora tem 7 músicas');

    const imported = hud.tiktokRadio.importLocalAudioFiles([
      { name: 'meu_funk_tiktok.mp3', mockUrl: 'blob:mock-funk-1' }
    ]);
    assert.equal(imported.length, 1, 'MP3 do jogador importado com sucesso');
    assert.equal(hud.tiktokRadio.tracks.length, 8, 'Playlist agora tem 7 originais + 1 MP3 custom');

    // 3) Persistência Completa no Slot de Save (músicas removidas, MP3 adicionados, curtidas e fotos de capa)
    hud.activeSaveSlot = 0;
    hud.saveCurrentProgress();
    const savedSlot = loadAllSaveSlots()[0];
    assert.ok(savedSlot?.radioState, 'radioState salvo dentro do Slot de Save');
    assert.equal(savedSlot.radioState.tracks.length, 8);
    assert.equal(
      savedSlot.radioState.tracks.some((t) => t.id === 'montagem_coral'),
      false,
      'Música removida permanece removida no Save Slot'
    );
    assert.equal(
      savedSlot.radioState.tracks.find((t) => t.id === targetTrack.id)?.coverDataUrl,
      customCover,
      'Foto de capa customizada foi salva no Save Slot'
    );

    // 4) Remover TODAS as músicas e depois Restaurar as 8 Originais (preservando o MP3 customizado)
    hud.tiktokRadio.clearAllTracks();
    assert.equal(hud.tiktokRadio.tracks.length, 0, 'Botão Remover Todas limpa 100% da playlist');
    assert.equal(hud.tiktokRadio.isPlaying, false, 'Reprodução para ao remover todas as músicas');

    // Restaura a partir do Save Slot salvo anteriormente
    hud.tiktokRadio.importSaveState(savedSlot.radioState);
    assert.equal(hud.tiktokRadio.tracks.length, 8, 'importSaveState restaura exatamente a playlist do Save Slot');
    assert.equal(hud.tiktokRadio.tracks[0].coverDataUrl, customCover, 'Foto de capa restaurada do Save Slot');
    assert.equal(hud.tiktokRadio.tracks[0].liked, true, 'Curtida ❤️ restaurada do Save Slot');

    // Restaurar as 8 originais recoloca 'montagem_coral' sem apagar o MP3 customizado!
    hud.tiktokRadio.restoreDefaultTracks();
    assert.equal(
      hud.tiktokRadio.tracks.length,
      9,
      'Restaurar 8 Originais recoloca a faixa faltante e preserva o MP3 customizado do jogador (8 + 1 = 9)'
    );

    // 5) Atalhos de Player [J] (Volta), [K] (Play/Pause) e [L] (Passa) + Álbum Girando no HUD + Marquee + Bugfix Tecla W Presa!
    // Simula jogador segurando [W] andando pra frente e apertando [P] antes de soltar [W]:
    hud.setTikTokRadioOpen(false, controller);
    controller._onKey({ code: 'KeyW', repeat: false, preventDefault() {} }, true);
    assert.equal(controller.keys.forward, true, 'Jogador está andando para frente (W pressionado)');
    controller._onKey({ code: 'KeyP', repeat: false, shiftKey: false, preventDefault() {} }, true);
    assert.equal(hud.isTikTokRadioOpen, true, 'Abriu o player Spotify [P]');
    assert.equal(
      controller.keys.forward,
      false,
      'BUGFIX: Ao abrir [P] enquanto segurava [W], keys.forward zera na hora e o boneco NÃO fica andando pra sempre!'
    );
    // Solta [W] com o modal ainda aberto e fecha o modal: continua 100% parado!
    controller._onKey({ code: 'KeyW', repeat: false, preventDefault() {} }, false);
    controller._onKey({ code: 'KeyP', repeat: false, shiftKey: false, preventDefault() {} }, true);
    assert.equal(hud.isTikTokRadioOpen, false);
    assert.equal(controller.keys.forward, false, 'Continua parado após fechar [P]');

    // Testa [K] (Play/Pause), [L] (Próxima) e [J] (Anterior) durante o jogo!
    hud.tiktokRadio.pause();
    assert.equal(hud.tiktokRadio.isPlaying, false);
    assert.equal(hud.tiktokHudPillEl.classList.contains('playing'), false, 'Parado: HUD mostra apenas o P');

    controller._onKey({ code: 'KeyK', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.tiktokRadio.isPlaying, true, 'Tecla [K] dá Play na música');
    assert.equal(
      hud.tiktokHudPillEl.classList.contains('playing'),
      true,
      'Tocando: HUD ativa modo Álbum Girando + Nome Rodando (.playing)'
    );
    assert.ok(hud.hudSpotifyDiscImg.src.length > 10, 'Foto do álbum carregada no disco giratório do HUD');
    assert.equal(
      hud.hudSpotifyMarqueeTitleEl.classList.contains('is-scrolling'),
      true,
      'Nome da música está rodando em marquee ao lado do álbum no HUD'
    );
    assert.equal(
      hud.spotifyBottomTitleEl.classList.contains('is-scrolling'),
      true,
      'Nome longo da música também roda em marquee dentro do player Spotify'
    );

    const idxBeforeL = hud.tiktokRadio.currentTrackIndex;
    controller._onKey({ code: 'KeyL', repeat: false, preventDefault() {} }, true);
    assert.notEqual(hud.tiktokRadio.currentTrackIndex, idxBeforeL, 'Tecla [L] avança para a próxima música');

    controller._onKey({ code: 'KeyJ', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.tiktokRadio.currentTrackIndex, idxBeforeL, 'Tecla [J] volta para a música anterior');

    // Tecla [K] pausa e volta o HUD para apenas o P, e outro [K] retoma a música!
    controller._onKey({ code: 'KeyK', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.tiktokRadio.isPlaying, false, 'Tecla [K] pausa a música');
    assert.equal(hud.tiktokHudPillEl.classList.contains('playing'), false, 'Pausado: HUD volta a exibir apenas o P');
    controller._onKey({ code: 'KeyK', repeat: false, preventDefault() {} }, true);
    assert.equal(hud.tiktokRadio.isPlaying, true, 'Tecla [K] retoma a música do ponto onde parou');

    // 6) BUGFIX CRÍTICO: Clicar em "SALVAR E SAIR PARA O MENU INICIAL" (#btn-pause-save-quit) PARA TODA MÚSICA NA HORA!
    const btnSaveQuit = globalThis.document.getElementById('btn-pause-save-quit');
    assert.ok(btnSaveQuit, 'Botão #btn-pause-save-quit existe');
    btnSaveQuit.click();

    assert.equal(hud.isTitleScreenActive, true, 'Voltou para a Tela Inicial');
    assert.equal(hud.tiktokRadio.isPlaying, false, 'Música da Rádio [P] parou IMEDIATAMENTE ao Salvar e Sair!');
    assert.equal(soundFX.tiktokRadioActive, false, 'Flag tiktokRadioActive desligada ao sair para o menu');
    assert.equal(soundFX.isMusicPlaying, false, 'Música ambiente da cidade também parou ao sair para o menu');

    // Mesmo rodando hud.update() na tela inicial, a música permanece 100% parada
    hud.update(0.2);
    assert.equal(hud.tiktokRadio.isPlaying, false, 'Rádio permanece parada na tela inicial');
    hud.isTitleScreenActive = false;

    // 7) Validação estrita da Identidade Visual Spotify Desktop (Zero Emojis + Ícones SVG + Sidebar sem Scrollbar)
    const fs = await import('node:fs');
    const htmlSrc = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const cssSrc = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
    const modalMatch = htmlSrc.match(/<div id="tiktok-radio-modal"[\s\S]*?<\/footer>\s*<\/div>\s*<\/div>/);
    assert.ok(modalMatch, 'Bloco #tiktok-radio-modal encontrado em index.html');
    const bannedEmojiRegex = /[🎵❤️🤍📁📷➕🗑️🔄🔍🔊🔉⏸▶🔀⏮⏭🔁🕺]/u;
    assert.equal(
      bannedEmojiRegex.test(modalMatch[0]),
      false,
      'Zero emojis Unicode dentro de #tiktok-radio-modal em index.html (100% substituído por <svg>)'
    );
    assert.equal(
      bannedEmojiRegex.test(hud.tiktokTrackListEl.innerHTML),
      false,
      'Zero emojis Unicode nas linhas renderizadas dinamicamente em refreshTikTokRadioUI()'
    );
    assert.ok(
      hud.tiktokTrackListEl.innerHTML.includes('<svg'),
      'Linhas de música renderizam ícones vetoriais <svg> minimalistas'
    );
    assert.ok(
      cssSrc.includes('overflow: hidden !important;') && cssSrc.includes('.spotify-track-list::-webkit-scrollbar'),
      'Sidebar sem scrollbar (overflow: hidden !important) e scrollbar customizada discreta na lista de faixas'
    );
    const pillMatch = htmlSrc.match(/<div id="hud-tiktok-radio-pill"[\s\S]*?(?=<div id="tiktok-radio-toast")/);
    assert.ok(pillMatch, 'Botão #hud-tiktok-radio-pill encontrado em index.html');
    assert.equal(
      pillMatch[0].replace(/<[^>]+>/g, '').trim(),
      'P',
      'Botão #hud-tiktok-radio-pill em index.html exibe APENAS o P estilizado quando parado, sem mais textos'
    );
    assert.ok(
      pillMatch[0].includes('id="hud-spotify-disc-img"') && pillMatch[0].includes('id="hud-spotify-marquee-title"'),
      'Disco de capa giratório e marquee de título presentes no HUD para quando estiver tocando'
    );
    assert.ok(
      cssSrc.includes('@keyframes spotify-vinyl-spin') && cssSrc.includes('@keyframes spotify-marquee-loop'),
      'Animações CSS de vinil/álbum girando e letreiro marquee configuradas em style.css'
    );
    assert.equal(htmlSrc.includes('id="tiktok-eq-bars"'), false, 'Equalizador removido de index.html');
    assert.equal(htmlSrc.includes('id="btn-tiktok-dance-now"'), false, 'Botão Passinho removido de index.html');
  });
});
