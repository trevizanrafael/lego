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
const { getClockPhaseSvg } = await import('../src/ui/minimap/MinimapMarkersAndRadarHUD.js');
const { installFpsCounterHud } = await import('../src/ui/hud/FpsCounterHud.js');
const { HERO_EMOTES } = await import('../src/world/attractions/EmoteDanceAnimations.js');
const { getCachedFacadeMaterials } = await import('../src/world/BuildingGenerator.js');

const COLOR_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 2200);
const hud = new LegoHud(15000);
const destructibles = new DestructibleManager(scene, hud);
const world = new TestBlockWorld(scene, destructibles);
const atm = world.atmosphere;

const minifig = new Minifigure('caveira');
scene.add(minifig.root);
const domElement = globalThis.document.getElementById('game-container');
const controller = new ThirdPersonController(camera, domElement, minifig, world, destructibles, hud);
hud.onChangeTimeMode = (m) => atm.setTimeMode(m);

describe('CICLO CINEMATOGRÁFICO DIA / PÔR DO SOL DOURADO / NOITE NEON (60 FPS CRAVADOS)', () => {
  it('1. Regra Crítica de 60 FPS: Zero SpotLights estáticas e exatamente 4 PointLights reais no Pool Dinâmico', () => {
    let pointLightCount = 0;
    let spotLightCount = 0;
    let headlightSpot = null;
    scene.traverse((obj) => {
      if (obj.isPointLight) {
        pointLightCount++;
        assert.equal(obj.castShadow, false, 'PointLight do pool não deve projetar sombra');
        assert.equal(obj.distance, 28, 'PointLight deve ter distance = 28');
      }
      if (obj.isSpotLight) {
        spotLightCount++;
        headlightSpot = obj;
      }
    });

    assert.equal(pointLightCount, 4, 'Deve haver estritamente 4 PointLights reais na cena inteira');
    assert.equal(spotLightCount, 1, 'Apenas 1 SpotLight permanente (PlayerVehicleHeadlightSpot) pré-alocada para evitar recompilação de shader');
    assert.equal(headlightSpot?.name, 'PlayerVehicleHeadlightSpot');
    assert.equal(headlightSpot?.visible, true, 'SpotLight permanente permanece visible=true com intensity=0 fora do carro');
    assert.equal(headlightSpot?.intensity, 0);
    assert.ok(atm.lampNodes.length >= 180, 'Deve haver centenas de postes/lâmpadas instanciados em 3 Draw Calls');
    assert.equal(atm.starPoints.geometry.attributes.position.count, 1200, 'Campo estelar com 1.200 estrelas');
  });

  it('2. Ciclo Automático (12 min = 24h partindo de 15:30), Amanhecer a Leste e Pôr do Sol Dourado a Oeste atrás da CDD', () => {
    atm.setTimeMode('auto');
    atm.timeHours = 15.5;
    world.update(180.0, controller.position, controller); // +3 min reais = +6h no jogo -> 21:30
    assert.ok(Math.abs(atm.timeHours - 21.5) < 0.05, '12 minutos reais equivalem a 24h completas');

    // Amanhecer (06:15) -> Sol nascendo a Leste (+X atrás do Porto/Rio)
    atm.timeHours = 6.25;
    atm.setTimeMode('auto');
    world.update(0.01, controller.position, controller);
    assert.ok(atm._sunDir.x > 0.85, 'No amanhecer o Sol nasce a Leste (+X)');

    // Dia Solar (12:00) -> Janelas emissivas e cones noturnos 100% apagados
    atm.setTimeMode('day');
    world.update(0.016, controller.position, controller);
    assert.equal(atm.nightFactor, 0);
    assert.equal(atm.coneInstMesh.visible, false, 'Cones volumétricos ocultos de dia');
    assert.equal(atm.pointLightPool[0].intensity, 0, 'Pool de PointLights com intensity=0 de dia');
    hud.updateMinimap(controller.position, 0, 0, world.regions[0], world, 0, 0.016);
    assert.ok(hud.minimapSubEl.textContent.includes('12:00'), 'Minimapa exibe 12:00');
    assert.equal(COLOR_EMOJI_RE.test(hud.minimapSubEl.textContent), false, 'Minimapa sem emojis coloridos');
    assert.ok(hud.minimapSubEl.innerHTML.includes('<svg class="minimap-clock-svg"'), 'Minimapa usa SVG fino');
    assert.equal(hud.minimapSubEl.dataset.clockIcon, 'day');

    // Pôr do Sol Dourado (17:45) -> Sol gigante laranja-rubro a Oeste (-X atrás do Morro da CDD!)
    atm.setTimeMode('sunset');
    world.update(0.016, controller.position, controller);
    assert.ok(atm._sunDir.x < -0.8, 'No pôr do sol o Sol desce a Oeste (-X atrás do Morro da CDD)');
    assert.ok(atm.sunDiscGroup.scale.x > 1.4, 'Disco Solar ampliado na Golden Hour');
    assert.ok(atm.nightFactor > 0.4 && atm.nightFactor < 0.6, 'Janelas começam a acender gradualmente no pôr do sol');
    hud.updateMinimap(controller.position, 0, 0, world.regions[0], world, 0, 0.016);
    assert.ok(hud.minimapSubEl.textContent.includes('17:45'), 'Minimapa exibe 17:45');
    assert.equal(COLOR_EMOJI_RE.test(hud.minimapSubEl.textContent), false, 'Minimapa pôr do sol sem emojis');
    assert.equal(hud.minimapSubEl.dataset.clockIcon, 'dusk');
  });

  it('3. Noite Azul-Profunda & Luar Prateado + Favela "Presépio Urbano", Arranha-Céus emissiveMap e Faróis de Carros/Metrô', () => {
    atm.setTimeMode('night');
    controller.position.set(-705, 25.0, -135); // Na Quadra do Baile da Cidade de Deus!
    world.update(0.1, controller.position, controller);

    assert.equal(atm.nightFactor, 1.0);
    assert.equal(atm.sunLight.color.getHex(), 0x6488a8, 'DirectionalLight assume luar frio acinzentado de Gotham');
    assert.ok(atm.sunLight.intensity >= 0.40 && atm.sunLight.intensity <= 0.65, 'Luar sombrio equilibrado');
    assert.ok(atm.hemiLight.intensity >= 0.18 && atm.hemiLight.intensity <= 0.36, 'HemisphereLight noturna escura/densa estilo Gotham');
    assert.equal(atm.moonGroup.visible, true, 'Lua Cheia LEGO visível');
    assert.equal(atm.starPoints.visible, true, '1.200 Estrelas visíveis');

    // Arranha-céus com emissiveMap real aceso em 1.45
    const facadeMats = getCachedFacadeMaterials();
    assert.ok(facadeMats.length > 0);
    for (const fm of facadeMats) {
      assert.ok(fm.emissiveMap, 'Fachada de arranha-céu possui emissiveMap real');
      assert.ok(Math.abs(fm.emissiveIntensity - 1.45) < 0.02, 'Arranha-céus brilham com emissiveIntensity = 1.45');
    }

    // Favela Cidade de Deus: janelas quentes em 1.6, 4 refletores do Campinho e 3 Skytrackers do Baile acesos!
    for (const wm of world.favelaEmissiveMats.windows) {
      assert.ok(Math.abs(wm.emissiveIntensity - 1.6) < 0.02, 'Janelas da CDD brilham em 1.6');
    }
    assert.equal(world.favelaSoccerFloodCones.length, 4);
    assert.equal(world.favelaSoccerFloodCones[0].mesh.visible, true);
    assert.equal(world.favelaBaileSkytrackers.length, 3);
    assert.equal(world.favelaBaileSkytrackers[0].pivot.visible, true);
    assert.ok(atm.pointLightPool[0].intensity > 2.0, 'PointLight dinâmica ilumina o plástico LEGO perto do jogador');

    // Faróis dos carros do trânsito, trens do Metrô e carro dirigido pelo jogador acesos!
    controller.position.set(0, 0.5, -117);
    const sampleCar = world.livingCity.trafficVehicles[0];
    controller.currentVehicle = sampleCar.destructible;
    world.update(0.05, controller.position, controller);
    assert.equal(sampleCar.mesh.userData._nightLightRig.visible, true, 'Faróis dianteiros do veículo do jogador acesos');
    assert.equal(atm.metroLeadCones[0].visible, true, 'Faróis dianteiros dos trens do Metrô acesos');
    assert.ok(atm._metroGlassMat.emissiveIntensity > 1.0, 'Janelas dos vagões do Metrô acesas à noite');

    hud.updateMinimap(controller.position, 0, 0, world.regions[0], world, 0, 0.016);
    assert.ok(hud.minimapSubEl.textContent.includes('22:00'), 'Minimapa exibe 22:00');
    assert.equal(COLOR_EMOJI_RE.test(hud.minimapSubEl.textContent), false, 'Minimapa noturno sem emojis');
    assert.equal(hud.minimapSubEl.dataset.clockIcon, 'night');
  });

  it('4. Sem clarão inicial nem queda brusca de uGlowStrength ao atravessar 17:30 -> 20:00', () => {
    atm.setTimeMode('auto');
    atm.timeHours = 17.5;
    world.update(0.016, controller.position, controller);
    let prevGlow = atm.skyUniforms.uGlowStrength.value;
    assert.ok(prevGlow <= 0.36, `uGlowStrength contido sem clarão (${prevGlow})`);

    for (let h = 17.6; h <= 20.0; h += 0.1) {
      atm.timeHours = h;
      world.update(0.016, controller.position, controller);
      const curGlow = atm.skyUniforms.uGlowStrength.value;
      assert.ok(
        Math.abs(curGlow - prevGlow) < 0.08,
        `Transição suave de uGlowStrength em ${h.toFixed(1)}h (${prevGlow} -> ${curGlow})`
      );
      prevGlow = curGlow;
    }
  });

  it('5. Relógio Vetorial SVG (day / dusk / night) e Emotes com ZERO Emojis Coloridos Unicode', () => {
    atm.timeHours = 12.0;
    const clkDay = atm.getFormattedClock();
    assert.equal(clkDay.iconKey, 'day');
    assert.equal(clkDay.icon, '');
    assert.equal(clkDay.timeStr, '12:00');
    assert.equal(clkDay.display, '12:00');
    assert.equal(COLOR_EMOJI_RE.test(clkDay.display), false);

    atm.timeHours = 18.0;
    const clkDusk = atm.getFormattedClock();
    assert.equal(clkDusk.iconKey, 'dusk');
    assert.equal(clkDusk.timeStr, '18:00');
    assert.equal(COLOR_EMOJI_RE.test(clkDusk.display), false);

    atm.timeHours = 23.0;
    const clkNight = atm.getFormattedClock();
    assert.equal(clkNight.iconKey, 'night');
    assert.equal(clkNight.timeStr, '23:00');
    assert.equal(COLOR_EMOJI_RE.test(clkNight.display), false);

    for (const phase of ['day', 'dusk', 'night']) {
      const svg = getClockPhaseSvg(phase);
      assert.ok(svg.startsWith('<svg class="minimap-clock-svg"'), `SVG válido para ${phase}`);
      assert.ok(svg.endsWith('</svg>'));
      assert.equal(COLOR_EMOJI_RE.test(svg), false, `Zero emojis no SVG ${phase}`);
    }

    for (const emote of HERO_EMOTES) {
      assert.equal(COLOR_EMOJI_RE.test(emote.label), false, `Emote ${emote.id} sem emoji colorido`);
      assert.equal(COLOR_EMOJI_RE.test(emote.name), false);
    }
  });

  it('6. Contador de FPS Frameless (#hud-fps-counter): Tiers good/warn/bad, Throttle 4x/s e Toggle showFps', () => {
    class MockFpsHud {
      constructor() {
        this.settings = { showFps: true };
        this.isTitleScreenActive = false;
        this.isLoadingActive = false;
        this._initFpsCounterHud();
      }
    }
    installFpsCounterHud(MockFpsHud);

    const mockHud = new MockFpsHud();
    const fpsEl = globalThis.document.getElementById('hud-fps-counter');
    assert.ok(fpsEl, '#hud-fps-counter criado no DOM');
    assert.equal(fpsEl.classList.contains('hidden'), false, 'Visível por padrão (showFps=true)');

    // Antes de 0,25s (~6 frames de 1/60s = 0,10s), o throttle 4x/s não escreve no DOM
    for (let i = 0; i < 6; i++) {
      mockHud.recordRenderFrameTiming(1 / 60);
    }
    assert.equal(mockHud._fpsRefreshCount, 0, 'Sem atualização antes da janela de 0,25s');

    // Completa 1,0s cravado em 60 FPS (mais 54 frames -> 60 frames totais = 1,0s -> 4 refreshes exatos!)
    for (let i = 0; i < 54; i++) {
      mockHud.recordRenderFrameTiming(1 / 60);
    }
    assert.equal(mockHud._fpsRefreshCount, 4, 'Atualiza estritamente 4x por segundo');
    assert.equal(mockHud.fpsStats.fps, 60);
    assert.equal(fpsEl.dataset.tier, 'good');
    assert.ok(fpsEl.textContent.includes('60 FPS'), `Texto 60 FPS (${fpsEl.textContent})`);

    // 40 FPS (25 ms por quadro por 0,5s -> 20 quadros exatos) -> data-tier="warn"
    for (let i = 0; i < 20; i++) {
      mockHud.updateFpsCounterHud(0.025);
    }
    assert.equal(mockHud.fpsStats.fps, 40);
    assert.equal(fpsEl.dataset.tier, 'warn');
    assert.ok(fpsEl.textContent.includes('40 FPS'), `Texto 40 FPS (${fpsEl.textContent})`);

    // 20 FPS (50 ms por quadro por 0,5s -> 10 quadros exatos) -> data-tier="bad" + pior quadro exposto
    for (let i = 0; i < 10; i++) {
      mockHud.updateFpsCounterHud(0.05);
    }
    assert.equal(mockHud.fpsStats.fps, 20);
    assert.equal(fpsEl.dataset.tier, 'bad');
    assert.ok(fpsEl.textContent.includes('20 FPS'), `Texto 20 FPS (${fpsEl.textContent})`);
    assert.ok(Number(fpsEl.dataset.worstMs) >= 50, 'Pior quadro registrado em data-worst-ms');

    // Toggle setShowFpsEnabled(false) oculta #hud-fps-counter imediatamente
    mockHud.setShowFpsEnabled(false);
    assert.equal(mockHud.settings.showFps, false);
    assert.equal(fpsEl.classList.contains('hidden'), true);
    assert.equal(fpsEl.style.display, 'none');

    // Reativar restaura visibilidade
    mockHud.setShowFpsEnabled(true);
    assert.equal(mockHud.settings.showFps, true);
    assert.equal(fpsEl.classList.contains('hidden'), false);
  });
});

