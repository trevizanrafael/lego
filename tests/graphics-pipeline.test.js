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
const { GraphicsPipeline, GOTHAM_NOIR_SHADER } = await import('../src/graphics/GraphicsPipeline.js');
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
    assert.equal(mat.isMeshPhysicalMaterial, true);
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
});
