import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const {
  SHARED_STUD_GEO,
  getLegoMaterial,
  applyAnimatedLegoWaterShader,
  LEGO_SHADER_GLOBALS,
  setLegoShaderQualityFX
} = await import('../src/materials/LegoMaterials.js');
const { GraphicsPipeline, GOTHAM_NOIR_SHADER, PRESET_PROFILES } = await import(
  '../src/graphics/GraphicsPipeline.js'
);
const { ShadowBudgetController, MAX_SHADOW_BUDGET } = await import(
  '../src/graphics/ShadowBudgetController.js'
);
const { loadGameSettings, saveGameSettings } = await import('../src/ui/FactionIconsAndSaveSystem.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');

describe('ETAPA 3 & 4 — MATERIAIS PBR/SHADERS LEGO, PIPELINE GRÁFICO HDR & PRESETS', () => {
  it('1. SHARED_STUD_GEO possui fundo aberto (24 triângulos por pino) preservando topo e parede', () => {
    const idx = SHARED_STUD_GEO.getIndex();
    assert.ok(idx, 'SHARED_STUD_GEO deve possuir index buffer');
    assert.equal(idx.count / 3, 24, 'Deve remover apenas os 8 triângulos da tampa inferior (32 -> 24 tris)');
  });

  it('2. Shader animado de água preserva mat.color (0x0369a1) e marca shader hook', () => {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x0369a1, roughness: 0.14, metalness: 0.08 });
    const uniforms = { uTime: { value: 0 } };
    applyAnimatedLegoWaterShader(mat, uniforms, { variant: 'ocean' });
    assert.equal(mat.color.getHex(), 0x0369a1);
    assert.equal(mat.userData.hasAnimatedLegoWater, true);
    assert.equal(typeof mat.onBeforeCompile, 'function');
  });

  it('3. getLegoMaterial aplica Micro-Chanfro & Height-Fog e respeita toggle global de qualidade', () => {
    const mat = getLegoMaterial(0xfacc15);
    assert.ok(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial);
    assert.equal(mat.userData.hasLegoSurfaceFX, true);

    setLegoShaderQualityFX({ enabled: false, microBevel: 0.0 });
    assert.equal(LEGO_SHADER_GLOBALS.uLegoFxEnabled.value, 0.0);
    assert.equal(LEGO_SHADER_GLOBALS.uLegoMicroBevelScale.value, 0.0);

    setLegoShaderQualityFX({ enabled: true, microBevel: 1.0 });
    assert.equal(LEGO_SHADER_GLOBALS.uLegoFxEnabled.value, 1.0);
    assert.equal(LEGO_SHADER_GLOBALS.uLegoMicroBevelScale.value, 1.0);
  });

  it('4. GraphicsPipeline opera em fallback headless, alterna presets e redimensiona sombras', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 2500);
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshPhysicalMaterial({ color: 0xef4444, roughness: 0.25 })
    );
    scene.add(mesh);

    const mockWorld = { sunLight: sun };
    const pipeline = new GraphicsPipeline(null, scene, camera, mockWorld, 'auto');
    assert.equal(pipeline.isHeadless, true);
    assert.equal(mesh.material.userData.hasLegoSurfaceFX, true);

    pipeline.setPreset('low');
    assert.equal(sun.shadow.mapSize.width, 1024);
    assert.equal(LEGO_SHADER_GLOBALS.uLegoFxEnabled.value, 0.0);

    pipeline.setPreset('medium');
    assert.equal(sun.shadow.mapSize.width, 1536);
    assert.equal(LEGO_SHADER_GLOBALS.uLegoFxEnabled.value, 1.0);

    pipeline.setPreset('ultra');
    assert.equal(sun.shadow.mapSize.width, 2048);
    assert.equal(pipeline.getStats().preset, 'ultra');
    assert.ok(GOTHAM_NOIR_SHADER.uniforms.uDesaturate.value > 0.2, 'Shader Gotham Noir dessatura tons infantis');
    assert.ok(GOTHAM_NOIR_SHADER.uniforms.uVignette.value > 0.3, 'Shader Gotham Noir aplica vinheta cinematográfica');

    pipeline.setPreset('auto');
    assert.equal(pipeline.getStats().preset, 'auto');
    pipeline.render(0.016);
    pipeline.dispose();
  });

  it('5. Configuração graphicsQuality persiste no Save e aciona callback no LegoHud', () => {
    localStorage.clear();
    const defaults = loadGameSettings();
    assert.equal(defaults.graphicsQuality, 'auto');

    // Prepara botões no mock DOM como estão no index.html
    for (const q of ['auto', 'low', 'medium', 'ultra']) {
      const btn = document.getElementById(`btn-quality-${q}`);
      btn.tagName = 'BUTTON';
      btn.dataset.quality = q;
      btn.classList.add('tactical-quality-btn');
    }

    const hud = new LegoHud(15000);
    let callbackVal = null;
    hud.onChangeGraphicsQuality = (val) => {
      callbackVal = val;
    };

    document.getElementById('btn-quality-ultra').click();
    assert.equal(callbackVal, 'ultra');
    assert.equal(loadGameSettings().graphicsQuality, 'ultra');
    assert.equal(document.getElementById('btn-quality-ultra').classList.contains('active'), true);
    assert.equal(document.getElementById('btn-quality-auto').classList.contains('active'), false);

    saveGameSettings({ ...loadGameSettings(), graphicsQuality: 'low' });
    assert.equal(loadGameSettings().graphicsQuality, 'low');
  });

  it('6. M2 — camera.far calibrado (~3km), Névoa Noir Smog, DRS piso 0.70, Bloom meia-res e Orçamento de Sombras <= 320 + Sombra de Contato no Low', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a101a, 0.00014);
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 23400);
    camera.position.set(0, 12, -276);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    // Malhas transparentes, MeshBasicMaterial e minúsculas (< 1.35m) devem perder castShadow na indexação
    const glassMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
    );
    glassMesh.castShadow = true;
    const basicMesh = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    basicMesh.castShadow = true;
    const tinyProp = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x64748b })
    );
    tinyProp.castShadow = true;
    scene.add(glassMesh, basicMesh, tinyProp);

    // Viaduto central (invariante color === 0xcbd5e1) + 460 prédios espalhados e concentrados perto do Centro
    const viaductMesh = new THREE.Mesh(
      new THREE.BoxGeometry(34, 2, 160),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1 })
    );
    viaductMesh.position.set(0, 12.4, -310);
    viaductMesh.castShadow = true;
    scene.add(viaductMesh);

    const bldgGeo = new THREE.BoxGeometry(14, 28, 14);
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    for (let i = 0; i < 460; i++) {
      const m = new THREE.Mesh(bldgGeo, bldgMat);
      // 380 prédios dentro de 140m do Centro para forçar o teto rígido de 320 casters + 80 distantes
      if (i < 380) {
        const col = i % 20;
        const row = Math.floor(i / 20);
        m.position.set((col - 10) * 8, 14, -276 + (row - 9) * 8);
      } else {
        m.position.set(1200 + (i - 380) * 15, 14, 900);
      }
      m.castShadow = true;
      scene.add(m);
    }

    const mockRenderer = {
      shadowMap: { enabled: true, autoUpdate: true, needsUpdate: false }
    };
    const contactTargets = Array.from({ length: 30 }, (_, idx) => ({
      type: idx % 2 === 0 ? 'car' : 'npc_fighter',
      x: (idx % 6) * 6 - 15,
      y: 0,
      z: -276 + Math.floor(idx / 6) * 6
    }));
    const mockWorld = {
      sunLight: sun,
      contactShadowTargets: contactTargets,
      getTerrainHeightAt: () => 0.25
    };

    const pipeline = new GraphicsPipeline(mockRenderer, scene, camera, mockWorld, 'medium');
    assert.ok(pipeline.shadowBudget instanceof ShadowBudgetController);
    assert.equal(glassMesh.castShadow, false, 'Malhas transparentes não devem projetar sombra');
    assert.equal(basicMesh.castShadow, false, 'MeshBasicMaterial não deve projetar sombra');
    assert.equal(tinyProp.castShadow, false, 'Malha estática minúscula (<1.35m) não deve projetar sombra');
    assert.equal(viaductMesh.castShadow, true, 'Viaduto central (0xcbd5e1) deve preservar castShadow');

    const countActiveCasters = () => {
      let c = 0;
      scene.traverse((o) => {
        if ((o.isMesh || o.isInstancedMesh) && o.castShadow) c++;
      });
      return c;
    };

    const activeMedium = countActiveCasters();
    assert.ok(
      activeMedium > 0 && activeMedium <= MAX_SHADOW_BUDGET && activeMedium <= 350,
      `Orçamento de sombras deve respeitar teto <= 320 (atual: ${activeMedium})`
    );
    assert.equal(mockRenderer.shadowMap.enabled, true);
    assert.equal(mockRenderer.shadowMap.autoUpdate, false);

    // Verifica camera.far <= 4500 e fogDensity >= 0.0005 nos presets em solo
    assert.equal(PRESET_PROFILES.low.pixelRatioCap, 1.0);
    assert.equal(PRESET_PROFILES.medium.pixelRatioCap, 1.0);
    assert.equal(PRESET_PROFILES.ultra.pixelRatioCap, 1.5);

    for (const preset of ['low', 'medium', 'ultra', 'auto']) {
      camera.position.set(0, 12, -276);
      pipeline.setPreset(preset);
      assert.ok(camera.far <= 4500, `camera.far em solo (${preset}) deve ser <= 4500 (atual: ${camera.far})`);
      assert.ok(scene.fog.density >= 0.0005, `fogDensity (${preset}) deve ser >= 0.0005 (atual: ${scene.fog.density})`);
    }

    // Em grande altitude (Y = 410m, Aeroporta-Aviões), camera.far expande suavemente até >= 4600
    pipeline.setPreset('medium');
    assert.equal(camera.far, 3100);
    camera.position.set(0, 410, -276);
    for (let i = 0; i < 40; i++) pipeline.render(0.05);
    assert.ok(camera.far >= 4590 && camera.far <= 4600, `Em Y=410m camera.far deve expandir até ~4600 (${camera.far})`);

    // Preset Low: desliga shadowMap real e ativa Disco de Sombra de Contato (+0.04m do piso, Jogador + até 24 alvos = 25)
    camera.position.set(0, 2, -276);
    pipeline.setPreset('low');
    assert.equal(mockRenderer.shadowMap.enabled, false, 'Low deve desligar shadowMap dinâmico');
    const cMesh = pipeline.shadowBudget.contactShadowMesh;
    assert.ok(cMesh?.isInstancedMesh, 'contactShadowMesh deve ser InstancedMesh');
    assert.equal(cMesh.visible, true);
    assert.equal(cMesh.count, 25, 'Jogador + 24 veículos/NPCs próximos');
    assert.equal(cMesh.material.opacity, 0.42);
    assert.equal(cMesh.material.depthWrite, false);
    assert.equal(cMesh.material.polygonOffset, true);
    const m0 = new THREE.Matrix4();
    cMesh.getMatrixAt(0, m0);
    const p0 = new THREE.Vector3().setFromMatrixPosition(m0);
    assert.ok(Math.abs(p0.y - 0.29) < 1e-4, `Disco de contato deve ficar a +0.04m do piso (0.25 + 0.04 = 0.29, atual: ${p0.y})`);

    // Bloom meia-resolução helper
    let resizedBloom = null;
    pipeline.bloomPass = {
      setSize(w, h) {
        resizedBloom = { w, h };
      }
    };
    pipeline._syncBloomHalfResSize(1920, 1080, 1.0);
    assert.deepEqual(resizedBloom, { w: 960, h: 540 }, 'Bloom deve operar em meia-resolução exata');
    pipeline.bloomPass = null;

    // Cadência adaptativa de atualização do shadowMap (ultra/alta velocidade = 1f, medium = 2f, auto tier 0 = 3f) + re-scan >24m
    pipeline.setPreset('medium');
    camera.position.set(0, 2, -276);
    let medUpdates = 0;
    for (let i = 0; i < 6; i++) {
      pipeline.shadowBudget.update(0.016, camera.position, 'medium', 0, 2);
      if (mockRenderer.shadowMap.needsUpdate) medUpdates++;
    }
    assert.equal(medUpdates, 3, 'Preset medium em baixa velocidade deve atualizar sombras a cada 2 frames (3 em 6)');

    let fastUpdates = 0;
    for (let i = 0; i < 6; i++) {
      pipeline.shadowBudget.update(0.016, camera.position, 'medium', 30, 2);
      if (mockRenderer.shadowMap.needsUpdate) fastUpdates++;
    }
    assert.equal(fastUpdates, 6, 'Velocidade horizontal > 24 m/s deve atualizar sombras todo frame (6 em 6)');

    let tier0Updates = 0;
    pipeline.shadowBudget._lastPreset = 'auto';
    for (let i = 0; i < 6; i++) {
      pipeline.shadowBudget.update(0.016, camera.position, 'auto', 0, 0);
      if (mockRenderer.shadowMap.needsUpdate) tier0Updates++;
    }
    assert.equal(tier0Updates, 2, 'Auto tier 0 deve atualizar sombras a cada 3 frames (2 em 6)');

    // Move > 24m para região leste (1250, 900) e verifica reavaliação de candidatos próximos
    camera.position.set(1250, 14, 900);
    pipeline.shadowBudget.update(0.016, camera.position, 'medium', 0, 2);
    const activeFar = countActiveCasters();
    assert.ok(activeFar > 1 && activeFar <= MAX_SHADOW_BUDGET, `Reavaliação após >24m ativa candidatos locais (${activeFar})`);

    // DRS Auto: quedas sustentadas (> 16.6ms) reduzem _drsScale até o piso 0.70 (nunca abaixo!) e recuperam (< 13.2ms)
    window.devicePixelRatio = 1.0;
    camera.position.set(0, 2, -276);
    pipeline.setPreset('auto');
    for (let i = 0; i < 1200; i++) {
      pipeline.render(0.030); // 30ms por frame (> 16.6ms) por 36s simulados
      assert.ok(pipeline._drsScale >= 0.70, `DRS nunca deve cair abaixo de 0.70 (atual: ${pipeline._drsScale})`);
    }
    assert.equal(pipeline._drsScale, 0.70, `DRS deve atingir piso exato 0.70 (atual: ${pipeline._drsScale})`);
    assert.equal(pipeline.getStats().effectivePixelRatio, 0.70);

    for (let i = 0; i < 600; i++) {
      pipeline.render(0.009); // 9ms por frame (< 13.2ms)
    }
    assert.ok(pipeline._drsScale >= 0.90, `DRS deve recuperar quando emaMs < 13.2 (atual: ${pipeline._drsScale})`);

    pipeline.dispose();
  });
});
