import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import {
  applyLegoSceneShaderEnhancements,
  setLegoShaderQualityFX
} from '../materials/LegoMaterials.js';

export const GRAPHICS_PRESETS = ['auto', 'low', 'medium', 'ultra'];

const PRESET_PROFILES = {
  low: {
    useComposer: false,
    gtao: false,
    bloom: false,
    aa: 'none',
    pixelRatioCap: 1.0,
    shadowMapSize: 1024,
    shaderFx: false,
    microBevel: 0.0,
    bloomStrength: 0.0,
    bloomRadius: 0.2
  },
  medium: {
    useComposer: true,
    gtao: false,
    bloom: true,
    aa: 'fxaa',
    pixelRatioCap: 1.2,
    shadowMapSize: 1536,
    shaderFx: true,
    microBevel: 0.85,
    bloomStrength: 0.32,
    bloomRadius: 0.28
  },
  ultra: {
    useComposer: true,
    gtao: true,
    bloom: true,
    aa: 'smaa',
    pixelRatioCap: 1.5,
    shadowMapSize: 2048,
    shaderFx: true,
    microBevel: 1.0,
    bloomStrength: 0.38,
    bloomRadius: 0.32
  }
};

/**
 * Pipeline gráfico unificado HDR com EffectComposer, GTAO, UnrealBloom, SMAA/FXAA e DRS (Auto 60 FPS).
 * Opera com fallback direto seguro em ambientes headless sem contexto WebGL2.
 */
export class GraphicsPipeline {
  constructor(renderer, scene, camera, world = null, initialPreset = 'auto') {
    this.renderer = renderer || null;
    this.scene = scene || null;
    this.camera = camera || null;
    this.world = world || null;

    this.preset = GRAPHICS_PRESETS.includes(initialPreset) ? initialPreset : 'auto';
    this.width = typeof window !== 'undefined' ? window.innerWidth || 1280 : 1280;
    this.height = typeof window !== 'undefined' ? window.innerHeight || 720 : 720;

    const hasDomAndGl =
      Boolean(this.renderer) &&
      typeof this.renderer.getContext === 'function' &&
      Boolean(this.renderer.getContext());

    this.isHeadless = !hasDomAndGl;

    // Estado DRS (Auto 60 FPS)
    this._drsScale = 1.0;
    this._autoTier = 2; // 0: low, 1: medium sans-bloom, 2: bloom+fxaa, 3: gtao+bloom+fxaa
    this._emaDt = 1 / 60;
    this._autoEvalTimer = 0;
    this._autoCooldown = 2.0;

    this.composer = null;
    this.renderPass = null;
    this.gtaoPass = null;
    this.bloomPass = null;
    this.outputPass = null;
    this.fxaaPass = null;
    this.smaaPass = null;

    this._activeProfile = { ...PRESET_PROFILES.medium };

    if (this.scene) {
      applyLegoSceneShaderEnhancements(this.scene);
    }

    if (!this.isHeadless) {
      this._initComposer();
    }

    this.setPreset(this.preset);
  }

  _initComposer() {
    try {
      const w = Math.max(1, this.width);
      const h = Math.max(1, this.height);
      const pr = this._computeEffectivePixelRatio();
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(w, h);

      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);

      this.renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(this.renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.max(1, Math.floor(w * pr)), Math.max(1, Math.floor(h * pr))),
        0.38,
        0.32,
        1.15
      );
      this.composer.addPass(this.bloomPass);

      this.outputPass = new OutputPass();
      this.composer.addPass(this.outputPass);

      this.fxaaPass = new ShaderPass(FXAAShader);
      this.fxaaPass.material.uniforms.resolution.value.set(1 / Math.max(1, w * pr), 1 / Math.max(1, h * pr));
      this.composer.addPass(this.fxaaPass);
    } catch (err) {
      console.warn('[GraphicsPipeline] Fallback para renderização direta sem EffectComposer:', err);
      this.composer = null;
    }
  }

  _ensureGtaoPass() {
    if (this.gtaoPass || !this.composer || !this.scene || !this.camera) return;
    try {
      const pr = this._computeEffectivePixelRatio();
      const ew = Math.max(1, Math.floor(this.width * pr));
      const eh = Math.max(1, Math.floor(this.height * pr));
      const gtao = new GTAOPass(this.scene, this.camera, ew, eh);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 0.56;
      gtao.updateGtaoMaterial({
        radius: 0.62,
        distanceExponent: 1.75,
        thickness: 1.5,
        scale: 1.0,
        samples: 12
      });
      gtao.updatePdMaterial({
        lumaPhi: 8,
        depthPhi: 3,
        normalPhi: 3,
        radius: 5
      });
      this.composer.insertPass(gtao, 1);
      this.gtaoPass = gtao;
    } catch (err) {
      console.warn('[GraphicsPipeline] GTAOPass indisponível:', err);
      this.gtaoPass = null;
    }
  }

  _ensureSmaaPass() {
    if (this.smaaPass || !this.composer) return;
    try {
      const pr = this._computeEffectivePixelRatio();
      const ew = Math.max(1, Math.floor(this.width * pr));
      const eh = Math.max(1, Math.floor(this.height * pr));
      const smaa = new SMAAPass(ew, eh);
      this.composer.addPass(smaa);
      this.smaaPass = smaa;
    } catch (err) {
      console.warn('[GraphicsPipeline] SMAAPass indisponível:', err);
      this.smaaPass = null;
    }
  }

  _computeEffectivePixelRatio() {
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cap = this._activeProfile?.pixelRatioCap ?? 1.25;
    const scale = this.preset === 'auto' ? this._drsScale : 1.0;
    return Math.max(0.75, Math.min(rawDpr * scale, cap));
  }

  _resolveAutoProfile() {
    if (this._autoTier <= 0) return PRESET_PROFILES.low;
    if (this._autoTier === 1) {
      return {
        ...PRESET_PROFILES.medium,
        bloom: false,
        shadowMapSize: 1024,
        pixelRatioCap: 1.05
      };
    }
    if (this._autoTier === 2) {
      return {
        ...PRESET_PROFILES.medium,
        shadowMapSize: 2048,
        pixelRatioCap: 1.3,
        microBevel: 1.0,
        bloomStrength: 0.36,
        bloomRadius: 0.3
      };
    }
    return {
      ...PRESET_PROFILES.ultra,
      aa: 'fxaa',
      pixelRatioCap: 1.35
    };
  }

  setPreset(preset) {
    const next = GRAPHICS_PRESETS.includes(preset) ? preset : 'auto';
    this.preset = next;
    if (next === 'auto') {
      this._drsScale = 1.0;
      this._autoTier = 2;
      this._autoCooldown = 2.0;
      this._activeProfile = this._resolveAutoProfile();
    } else {
      this._drsScale = 1.0;
      this._activeProfile = { ...PRESET_PROFILES[next] };
    }
    this._applyActiveProfile();
  }

  _applyActiveProfile() {
    const p = this._activeProfile;
    setLegoShaderQualityFX({ enabled: p.shaderFx, microBevel: p.microBevel });

    if (this.world?.sunLight?.shadow) {
      const sm = this.world.sunLight.shadow;
      if (sm.mapSize && sm.mapSize.width !== p.shadowMapSize) {
        sm.mapSize.set(p.shadowMapSize, p.shadowMapSize);
        if (sm.map) {
          sm.map.dispose();
          sm.map = null;
        }
        sm.needsUpdate = true;
      }
    }

    if (this.isHeadless || !this.renderer) return;

    const pr = this._computeEffectivePixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.width, this.height);

    if (!this.composer) return;

    this.composer.setPixelRatio(pr);
    this.composer.setSize(this.width, this.height);

    if (p.useComposer && p.gtao) {
      this._ensureGtaoPass();
    }
    if (this.gtaoPass) {
      this.gtaoPass.enabled = Boolean(p.useComposer && p.gtao);
    }

    if (this.bloomPass) {
      this.bloomPass.enabled = Boolean(p.useComposer && p.bloom);
      this.bloomPass.strength = p.bloomStrength;
      this.bloomPass.radius = p.bloomRadius;
    }

    if (p.useComposer && p.aa === 'smaa') {
      this._ensureSmaaPass();
    }
    if (this.fxaaPass) {
      const fxaaOn = Boolean(p.useComposer && p.aa === 'fxaa');
      this.fxaaPass.enabled = fxaaOn;
      if (fxaaOn) {
        this.fxaaPass.material.uniforms.resolution.value.set(
          1 / Math.max(1, this.width * pr),
          1 / Math.max(1, this.height * pr)
        );
      }
    }
    if (this.smaaPass) {
      this.smaaPass.enabled = Boolean(p.useComposer && p.aa === 'smaa');
    }
  }

  _updateAutoDRS(dt) {
    if (this.preset !== 'auto' || this.isHeadless) return;
    const clampedDt = Math.max(0.004, Math.min(0.08, dt || 0.016));
    this._emaDt = this._emaDt * 0.92 + clampedDt * 0.08;

    if (this._autoCooldown > 0) {
      this._autoCooldown -= clampedDt;
      return;
    }

    this._autoEvalTimer += clampedDt;
    if (this._autoEvalTimer < 1.5) return;
    this._autoEvalTimer = 0;

    const emaMs = this._emaDt * 1000;
    let changed = false;

    if (emaMs > 18.2) {
      if (this._drsScale > 0.78) {
        this._drsScale = Number(Math.max(0.75, this._drsScale - 0.12).toFixed(2));
        changed = true;
      } else if (this._autoTier > 0) {
        this._autoTier -= 1;
        this._drsScale = 0.9;
        changed = true;
      }
    } else if (emaMs < 13.0) {
      if (this._drsScale < 1.0) {
        this._drsScale = Number(Math.min(1.0, this._drsScale + 0.1).toFixed(2));
        changed = true;
      } else if (this._autoTier < 3 && emaMs < 11.2) {
        this._autoTier += 1;
        changed = true;
      }
    }

    if (changed) {
      this._autoCooldown = 4.0;
      this._activeProfile = this._resolveAutoProfile();
      this._applyActiveProfile();
    }
  }

  resize(width, height) {
    this.width = Math.max(1, width || 1280);
    this.height = Math.max(1, height || 720);
    if (this.isHeadless || !this.renderer) return;

    const pr = this._computeEffectivePixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.width, this.height);

    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(this.width, this.height);
    }
    if (this.fxaaPass) {
      this.fxaaPass.material.uniforms.resolution.value.set(
        1 / Math.max(1, this.width * pr),
        1 / Math.max(1, this.height * pr)
      );
    }
  }

  render(dt = 0.016) {
    if (this.isHeadless || !this.renderer || !this.scene || !this.camera) return;
    this._updateAutoDRS(dt);

    if (this.composer && this._activeProfile.useComposer) {
      this.composer.render(dt);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getStats() {
    return {
      preset: this.preset,
      autoTier: this._autoTier,
      drsScale: this._drsScale,
      effectivePixelRatio: this._computeEffectivePixelRatio(),
      emaMs: Number((this._emaDt * 1000).toFixed(2)),
      useComposer: Boolean(this.composer && this._activeProfile.useComposer),
      gtaoEnabled: Boolean(this.gtaoPass?.enabled),
      bloomEnabled: Boolean(this.bloomPass?.enabled),
      aaMode: this._activeProfile.aa,
      shadowMapSize: this._activeProfile.shadowMapSize
    };
  }

  dispose() {
    if (this.gtaoPass?.dispose) this.gtaoPass.dispose();
    if (this.bloomPass?.dispose) this.bloomPass.dispose();
    if (this.outputPass?.dispose) this.outputPass.dispose();
    if (this.fxaaPass?.dispose) this.fxaaPass.dispose();
    if (this.smaaPass?.dispose) this.smaaPass.dispose();
    if (this.composer?.dispose) this.composer.dispose();
    this.composer = null;
  }
}
