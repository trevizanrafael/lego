import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const {
  CUSTOM_HEAD_COLORS,
  CUSTOM_LEGO_PALETTE,
  CUSTOM_FACES,
  CUSTOM_HEADGEAR,
  CUSTOM_TORSO_PRINTS,
  CUSTOM_BACK_GEAR,
  CUSTOM_PRIMARY_POWERS,
  CUSTOM_MOBILITY_POWERS,
  CUSTOM_SUPER_POWERS,
  createDefaultCustomHeroState,
  getActiveCustomHero,
  setActiveCustomHero
} = await import('../src/entities/CustomHeroSystem.js');
const { MINIFIG_PRESETS, Minifigure } = await import('../src/entities/Minifigure.js');
const { HERO_CATALOG, getHeroInfo } = await import('../src/ui/HeroWheelAndDossier.js');
const { loadAllSaveSlots, writeSaveSlot } = await import('../src/ui/FactionIconsAndSaveSystem.js');
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

describe('LABORATÓRIO SUBTERRÂNEO DA TORRE DOS HERÓIS + OPERADOR CUSTOMIZÁVEL OP-09', () => {
  it('1. Porão dos Heróis (Y = -8.2m): descida física sem tela de loading, recorte de piso e Console [E]', () => {
    // 1.1 Verifica a escadaria na Ala Sudeste/Leste da Torre dos Heróis (X = -282 -> -306, Z = -146)
    controller.position.set(-281.0, 0.5, -146.0);
    controller.velocity.set(0, -1, 0);
    controller._moveAndCollide(0.016);
    const yLobby = controller.position.y;
    const yTopStair = world.getTerrainHeightAt(-282.5, -146.0);
    const yMidStair = world.getTerrainHeightAt(-294.0, -146.0);
    const yLabFloor = world.getSurfaceHeightAt(-308.0, -146.0, -7.8);

    assert.ok(Math.abs(yLobby - 0.36) < 0.15, `Piso do saguão da Torre em ~0.36m (obtido ${yLobby})`);
    assert.ok(yTopStair <= 0.36 && yTopStair > -0.2, `Boca da escadaria em ~0.18m (obtido ${yTopStair})`);
    assert.ok(yMidStair < -3.0 && yMidStair > -5.5, `Meio da escada descendo suavemente (obtido ${yMidStair})`);
    assert.ok(Math.abs(yLabFloor - -8.2) < 0.15, `Piso do Porão Bio-Genético em Y = -8.2m (obtido ${yLabFloor})`);

    // 1.2 Nenhum colisor bloqueia a cabeça do jogador dentro do salão subterrâneo (X = -332, Z = -167, Y = -8.2..-1.2)
    const supportInLab = world.getSurfaceHeightAt(-332, -167, -8.0);
    assert.ok(Math.abs(supportInLab - -8.2) < 0.1, `Suporte físico limpo em Y = -8.2m (obtido ${supportInLab})`);

    const reg = world.getRegionAt(-332, -8.2, -167);
    assert.equal(reg.id, 'porao_torre_herois', 'Região detectada no subsolo deve ser porao_torre_herois');

    // 1.3 Aproximar-se do Console (-327.8, -8.2, -167) exibe "[E] ACESSAR CRIADOR DE PERSONAGEM (OP-09)" e abre o Estúdio 3D!
    assert.ok(world.customizerLabPedestal, 'Pedestal Holográfico exposto em world.customizerLabPedestal');
    controller.position.set(-327.5, -8.2, -167.0);
    controller.update(0.016);

    const promptText = globalThis.document.getElementById('vehicle-prompt-text').textContent;
    assert.equal(promptText, 'ACESSAR CRIADOR DE PERSONAGEM (OP-09)');

    const opened = controller.toggleVehicleInteraction();
    assert.equal(opened, true, 'Apertar [E] no Console abre o Criador de Personagens');
    assert.equal(hud.isCreatorOpen, true, 'Estúdio 3D fica ativo');

    // Enquanto o Estúdio 3D está aberto, update(dt) mantém câmera de estúdio focada no Pedestal
    controller.update(0.016);
    assert.ok(
      Math.hypot(minifig.root.position.x - -332, minifig.root.position.z - -167) < 0.1,
      'Minifigura posicionada em cima do Pedestal Holográfico iluminado'
    );

    // Fechar no [X] sem salvar restaura estado anterior
    hud.creatorStudio.close(false);
    assert.equal(hud.isCreatorOpen, false);
  });

  it('2. OP-09 começa como CIDADÃO COMUM (9 slots na Roda [TAB], Digit9, zero superpoderes, dirige veículos)', () => {
    setActiveCustomHero(createDefaultCustomHeroState());
    assert.equal(HERO_CATALOG.length, 9, 'Roda de Heróis e Ficha [H] expandidas para 9 personagens (OP-01..OP-09)');
    assert.equal(HERO_CATALOG[8].key, 'op09');

    // Atalho numérico Digit9 troca para OP-09
    controller._onKey({ code: 'Digit9', repeat: false, preventDefault() {} }, true);
    assert.equal(minifig.currentHeroKey, 'op09');

    const info = getHeroInfo('op09');
    assert.equal(info.name, 'CIDADÃO COMUM');
    assert.ok(info.role.includes('CIVIL DA METRÓPOLE'));
    assert.equal(getActiveCustomHero().isCreated, false);

    // Sem superpoderes: ataque primário dá apenas soco civil, [F] e [Q] não ativam voo nem super-habilidade
    controller.position.set(-330, -8.2, -160);
    controller.isGrounded = true;
    controller._firePrimaryAction();
    assert.equal(controller.customHeroPowers.projectiles.length, 0, 'Cidadão Comum não dispara projéteis de poder');

    controller.customHeroPowers.triggerMobilityKey();
    assert.equal(controller.isFlying, false, 'Cidadão Comum não voa');
    controller.customHeroPowers.triggerSuperAbility();
    assert.equal(controller.customHeroPowers.singularities.length, 0, 'Cidadão Comum não solta super-poder [Q]');

    // Pode entrar e dirigir qualquer veículo normalmente!
    const sampleVehicle = world.livingCity.trafficVehicles[0]?.destructible;
    if (sampleVehicle) {
      controller.enterVehicle(sampleVehicle);
      assert.equal(controller.currentVehicle, sampleVehicle, 'Cidadão Comum dirige veículos normalmente');
      controller.exitVehicle();
    }
  });

  it('3. Catálogo 100% inédito (zero peças repetidas dos 8 heróis) + Isolamento de 1 OP-09 exclusivo por Slot de Save', () => {
    assert.equal(CUSTOM_HEAD_COLORS.length, 10, '10 cores de cabeça/pele');
    assert.equal(CUSTOM_LEGO_PALETTE.length, 14, 'Paleta de 14 cores vibrantes LEGO');
    assert.equal(CUSTOM_FACES.length, 8, '8 rostos inéditos');
    assert.equal(CUSTOM_HEADGEAR.length, 10, '10 cabelos/capacetes 3D inéditos');
    assert.equal(CUSTOM_TORSO_PRINTS.length, 8, '8 estampas de torso inéditas');
    assert.equal(CUSTOM_BACK_GEAR.length, 5, '5 acessórios de costas inéditos');
    assert.equal(CUSTOM_PRIMARY_POWERS.length, 4, '4 ataques primários inéditos');
    assert.equal(CUSTOM_MOBILITY_POWERS.length, 4, '4 mobilidades inéditas');
    assert.equal(CUSTOM_SUPER_POWERS.length, 4, '4 super-habilidades [Q] inéditas');

    // Garante zero sobreposição de IDs de headgear com os 8 heróis originais
    const originalHeadgears = new Set(Object.values(MINIFIG_PRESETS).map((p) => p.headgear).filter(Boolean));
    for (const hg of CUSTOM_HEADGEAR) {
      if (hg.id === 'none') continue;
      assert.equal(originalHeadgears.has(hg.id), false, `Headgear ${hg.id} deve ser 100% inédito`);
    }

    // Slot 0 cria o herói "CENTURIÃO GELO", enquanto Slot 1 continua "CIDADÃO COMUM"!
    hud.activeSaveSlot = 0;
    const slot0Hero = {
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'CENTURIÃO GELO',
      headColorId: 'ice_blue',
      faceId: 'tech_visor',
      hairId: 'astro_helmet',
      hairColorId: 'white',
      torsoPrintId: 'atom_emblem',
      torsoColorId: 'cyan',
      armColorId: 'silver',
      handColorId: 'white',
      legColorId: 'dark_navy',
      backId: 'dual_jetpack',
      backColorId: 'silver',
      primaryPowerId: 'cryo_ray',
      mobilityPowerId: 'jetpack_boost',
      superPowerId: 'singularity_orb'
    };
    setActiveCustomHero(slot0Hero);
    controller.switchToHero('op09');
    hud.saveCurrentProgress();

    // Cria Novo Jogo no Slot 1 (começa como CIDADÃO COMUM)
    writeSaveSlot(1, {
      faction: 'pcc',
      studs: 500,
      heroKey: 'op09',
      conqueredTerritories: [],
      customHero: createDefaultCustomHeroState()
    });

    const savedSlots = loadAllSaveSlots();
    assert.equal(savedSlots[0].customHero.isCreated, true);
    assert.equal(savedSlots[0].customHero.name, 'CENTURIÃO GELO');
    assert.equal(savedSlots[1].customHero.isCreated, false);
    assert.equal(savedSlots[1].customHero.name, 'CIDADÃO COMUM');

    // Botão secundário "VOLTAR A SER CIDADÃO COMUM" reseta o OP-09 do slot ativo!
    hud.activeSaveSlot = 0;
    hud.creatorStudio.open(controller, world);
    globalThis.document.getElementById('btn-creator-reset-civilian').dispatchEvent({ type: 'click' });
    assert.equal(getActiveCustomHero().isCreated, false);
    assert.equal(loadAllSaveSlots()[0].customHero.isCreated, false);
  });

  it('4. Execução real dos 12 Poderes Exclusivos (4 Ataques + 4 Mobilidades + 4 Super-Habilidades [Q])', () => {
    controller.position.set(0, 0.5, -117);
    controller.isGrounded = true;

    // 4.1 Testa os 4 Ataques Primários
    for (const p of CUSTOM_PRIMARY_POWERS) {
      setActiveCustomHero({
        ...createDefaultCustomHeroState(),
        isCreated: true,
        name: 'TESTADOR OP09',
        primaryPowerId: p.id,
        backId: 'dual_jetpack'
      });
      controller.switchToHero('op09');
      controller.primaryCooldown = 0;
      controller._firePrimaryAction();
      controller.update(0.05);
    }
    assert.ok(controller.customHeroPowers.projectiles.length >= 2, 'Projéteis inéditos disparados');

    // 4.2 Testa as 4 Mobilidades (Jetpack, Salto Triplo + Super-Corrida, Hoverboard sobre Água, Gancho Tático Prateado)
    // a) Jetpack
    setActiveCustomHero({
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'JET HERO',
      backId: 'dual_jetpack',
      mobilityPowerId: 'jetpack_boost'
    });
    controller.switchToHero('op09');
    controller.customHeroPowers.triggerMobilityKey();
    controller.update(0.05);
    assert.equal(controller.isFlying, true, 'Jetpack ativa voo controlado');
    assert.equal(minifig.op09JetFlames[0].visible, true, 'Chamas duplas do Jetpack acesas durante o voo');
    controller.isFlying = false;

    // b) Salto Triplo + Super-Corrida (~31 m/s)
    setActiveCustomHero({
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'ACROBAT HERO',
      mobilityPowerId: 'triple_acrobat'
    });
    controller.switchToHero('op09');
    controller.isGrounded = true;
    controller.customHeroPowers.handleSpacePress(500); // 1º pulo
    controller.customHeroPowers.handleSpacePress(200); // 2º pulo no ar
    controller.customHeroPowers.handleSpacePress(200); // 3º pulo no ar
    assert.equal(controller.customHeroPowers.airJumpCount, 3, 'Até 3 saltos seguidos no ar');
    controller.keys.sprint = true;
    assert.ok(controller.customHeroPowers.getSpeedMultiplier() >= 2.15, 'Super-corrida acima de 30 m/s');
    controller.keys.sprint = false;

    // c) Prancha Hoverboard de Luz deslizando sobre a água sem afundar!
    setActiveCustomHero({
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'SURFER HERO',
      mobilityPowerId: 'light_hoverboard'
    });
    controller.switchToHero('op09');
    controller.customHeroPowers.triggerMobilityKey();
    assert.equal(controller.customHeroPowers.hoverboardActive, true);
    // Posiciona sobre o mar aberto ao Sul da Praia (X = 220, Z = 1080)
    assert.equal(world.isDeepWaterAt(220, 1080, { forCar: true }), true, 'Coordenada (220, 1080) é água profunda');
    controller.velocity.set(0, 0, 0);
    controller.position.set(220, -0.3, 1080);
    controller.update(0.05);
    assert.equal(minifig.op09Hoverboard.visible, true, 'Prancha Hoverboard 3D visível sob os pés');
    assert.equal(controller.isSwimming, false, 'Não entra em modo natação ao surfar na Hoverboard');
    assert.equal(controller.isGrounded, true, 'Prancha Hoverboard flutua sobre a água profunda sem afundar');

    // d) Gancho Tático Rápido (Cabo Prateado)
    setActiveCustomHero({
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'GRAPPLE HERO',
      mobilityPowerId: 'tactical_grapple'
    });
    controller.switchToHero('op09');
    controller.position.set(0, 0.5, -117);
    controller.customHeroPowers.triggerMobilityKey();
    assert.ok(controller.grappleState, 'Gancho Tático iniciado');
    controller.update(0.02);
    assert.equal(controller.grappleCableCoreMat.color.getHex(), 0xe2e8f0, 'Cabo do Gancho Tático do OP-09 é prateado');
    controller._stopGrapple(false);

    // 4.3 Testa as 4 Super-Habilidades [Q]
    // a) Singularidade / Buraco Negro Portátil (puxa objetos e magnetiza Studs em 22m!)
    setActiveCustomHero({
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'COSMIC HERO',
      superPowerId: 'singularity_orb'
    });
    controller.switchToHero('op09');
    controller.customHeroPowers.superCooldown = 0;
    controller.customHeroPowers.triggerSuperAbility();
    assert.equal(controller.customHeroPowers.singularities.length, 1, 'Orbe de Singularidade criado');
    const sgPos = controller.customHeroPowers.singularities[0].pos.clone();
    const testStud = destructibles.spawnAmbientStud(sgPos.x + 8, sgPos.y, sgPos.z, 'gold');
    controller.customHeroPowers.update(0.1);
    assert.equal(testStud.magnetized, true, 'Singularidade magnetiza Studs num raio de 22m');

    // b) Domo Repulsor 360° + Escudo Pessoal
    setActiveCustomHero({
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'SHIELD HERO',
      superPowerId: 'repulsor_dome'
    });
    controller.switchToHero('op09');
    controller.customHeroPowers.superCooldown = 0;
    controller.customHeroPowers.triggerSuperAbility();
    controller.customHeroPowers.update(0.05);
    assert.equal(controller.customHeroPowers.personalShieldMesh.visible, true, 'Escudo pessoal energético ativo');

    // c) Chuva de 5 Meteoros LEGO
    setActiveCustomHero({
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'METEOR HERO',
      superPowerId: 'lego_meteors'
    });
    controller.switchToHero('op09');
    controller.customHeroPowers.superCooldown = 0;
    controller.customHeroPowers.triggerSuperAbility();
    assert.equal(controller.customHeroPowers.meteors.length, 5, 'Invoca 5 meteoros incandescentes de blocos LEGO');

    // d) Aceleração Crono (+75% velocidade e cadência + clones translúcidos)
    setActiveCustomHero({
      ...createDefaultCustomHeroState(),
      isCreated: true,
      name: 'CHRONO HERO',
      superPowerId: 'chrono_haste'
    });
    controller.switchToHero('op09');
    controller.customHeroPowers.superCooldown = 0;
    controller.customHeroPowers.triggerSuperAbility();
    controller.velocity.set(15, 0, 0);
    controller.customHeroPowers.update(0.12);
    assert.ok(Math.abs(controller.customHeroPowers.getSpeedMultiplier() - 1.75) < 0.01, '+75% de velocidade na Aceleração Crono');
    assert.ok(controller.customHeroPowers.afterimages.length >= 1, 'Gera clones LEGO translúcidos pelo caminho');
  });
});
