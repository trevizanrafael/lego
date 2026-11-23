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
import { WORLD_SCALE } from '../world/core/WorldLayoutScale.js';
import { ShadowBudgetController } from './ShadowBudgetController.js';

export const GRAPHICS_PRESETS = ['auto', 'low', 'medium', 'ultra'];

/**
 * Shader cinematográfico "Gotham Noir" (Estilo LEGO DC Super-Villains / Arkham):
 * Dessaturação seletiva, curva S de contraste, split-toning frio, vinheta e micro-grão.
 */
export const GOTHAM_NOIR_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDesaturate: { value: 0.34 },
    uContrast: { value: 1.15 },
    uVignette: { value: 0.44 },
    uGrain: { value: 0.016 },
    uKillFlash: { value: 0.0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDesaturate;
    uniform float uContrast;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uKillFlash;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = texel.rgb;
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));

      float redDominance = clamp((col.r - max(col.g, col.b)) * 2.6, 0.0, 1.0);
      float amberDominance = clamp((min(col.r, col.g * 1.25) - col.b) * 1.8, 0.0, 1.0);
      float violetDominance = clamp((min(col.r, col.b) - col.g) * 2.2, 0.0, 1.0);
      float accentKeep = clamp(max(redDominance, max(amberDominance * 0.75, violetDominance)), 0.0, 0.85);

      col = mix(col, vec3(luma), uDesaturate * (1.0 - accentKeep));
      col = clamp((col - 0.46) * uContrast + 0.44, 0.0, 1.0);

      float shadowMask = 1.0 - smoothstep(0.0, 0.45, luma);
      float highlightMask = smoothstep(0.55, 1.0, luma);
      col += vec3(-0.010, 0.008, 0.022) * shadowMask + vec3(0.018, 0.008, -0.010) * highlightMask;

      vec2 centered = vUv - 0.5;
      float distSq = dot(centered, centered) * 2.15;
      col *= clamp(1.0 - distSq * uVignette, 0.38, 1.0);

      if (uKillFlash > 0.0) {
        luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, vec3(luma), uKillFlash * 0.78);
        col = clamp(col + vec3(0.22, 0.23, 0.25) * uKillFlash, 0.0, 1.0);
        float edgeWeight = clamp(distSq * 0.85, 0.0, 1.0) * uKillFlash;
        col = clamp((col - 0.5) * (1.0 + 0.32 * edgeWeight) + 0.5, 0.0, 1.0);
      }

      float noise = fract(sin(dot(vUv * vec2(1280.0, 720.0) + fract(uTime * 0.37), vec2(12.9898, 78.233))) * 43758.5453);
      col += (noise - 0.5) * uGrain * (0.4 + 0.6 * shadowMask);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), texel.a);
    }
  `
};

export const PRESET_PROFILES = {
  low: {
    useComposer: false, gtao: false, bloom: false, noirGrade: false, aa: 'none',
    pixelRatioCap: 1.0, shadowMapSize: 1024, dynamicShadows: false,
    cameraFar: 2600, fogDensity: 0.00095,
    shaderFx: false, microBevel: 0.0, bloomStrength: 0.0, bloomRadius: 0.2
  },
  medium: {
    useComposer: true, gtao: false, bloom: true, noirGrade: true, aa: 'fxaa',
    pixelRatioCap: 1.0, shadowMapSize: 1536, dynamicShadows: true,
    cameraFar: 3100, fogDensity: 0.00082,
    shaderFx: true, microBevel: 0.85, bloomStrength: 0.42, bloomRadius: 0.34
  },
  ultra: {
    useComposer: true, gtao: true, bloom: true, noirGrade: true, aa: 'smaa',
    pixelRatioCap: 1.5, shadowMapSize: 2048, dynamicShadows: true,
    cameraFar: 4200, fogDensity: 0.00062,
    shaderFx: true, microBevel: 1.0, bloomStrength: 0.48, bloomRadius: 0.38
  }
};

/**
 * Pipeline gráfico HDR com EffectComposer, GTAO, UnrealBloom meia-resolução, SMAA/FXAA,
 * Orçamento Dinâmico de Sombras (< 320 casters) e DRS (Auto 60 FPS, piso 0.70).
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

    this._drsScale = 1.0;
    this._autoTier = 2; // 0: low-fx, 1: medium sans-bloom, 2: bloom+fxaa, 3: gtao+bloom+fxaa
    this._emaDt = 1 / 60;
    this._autoEvalTimer = 0;
    this._autoCooldown = 2.0;

    this.composer = null;
    this.renderPass = null;
    this.gtaoPass = null;
    this.bloomPass = null;
    this.outputPass = null;
    this.noirPass = null;
    this.fxaaPass = null;
    this.smaaPass = null;
    this._noirTime = 0;

    this.killFlashEnabled = true;
    this._killFlashTimer = 0;
    this._killFlashDuration = 0.18;
    this.killFlashIntensity = 0;
    this.killFlashCount = 0;
    this._killFlashOverlayEl = null;
    this._usingCssKillFlashFallback = false;

    this._activeProfile = { ...PRESET_PROFILES.medium };
    if (this.scene) applyLegoSceneShaderEnhancements(this.scene);

    this.shadowBudget =
      this.scene && this.world
        ? new ShadowBudgetController(this.renderer, this.scene, this.world)
        : null;

    if (!this.isHeadless) this._initComposer();
    this.setPreset(this.preset);
  }

  attachShadowBudget(world = this.world) {
    this.world = world || this.world;
    if (!this.scene) return null;
    this.shadowBudget?.dispose?.();
    this.shadowBudget = new ShadowBudgetController(this.renderer, this.scene, this.world);
    this.shadowBudget.update(
      0, this._resolveFocusPosition(), this.preset, this._resolveHorizontalSpeed(), this._autoTier
    );
    return this.shadowBudget;
  }

  _resolveFocusPosition() {
    const ctl = this.world?.destructibles?.hud?._lastController;
    return ctl?.position || this.world?.livingCity?._lastPlayerPos || this.camera?.position || null;
  }

  _resolveHorizontalSpeed() {
    const ctl = this.world?.destructibles?.hud?._lastController;
    return typeof ctl?.getHorizontalSpeed === 'function' ? ctl.getHorizontalSpeed() : 0;
  }

  _syncBloomHalfResSize(w, h, pr) {
    if (!this.bloomPass) return;
    this.bloomPass.setSize(
      Math.max(1, Math.floor(w * pr * 0.5)),
      Math.max(1, Math.floor(h * pr * 0.5))
    );
  }

  _initComposer() {
    try {
      const w = Math.max(1, this.width);
      const h = Math.max(1, this.height);
      const pr = this._computeEffectivePixelRatio();
      const ew = Math.max(1, Math.floor(w * pr));
      const eh = Math.max(1, Math.floor(h * pr));
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(w, h);

      let hdrTarget = null;
      try {
        hdrTarget = new THREE.WebGLRenderTarget(ew, eh, {
          type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false
        });
      } catch (_rtErr) {
        hdrTarget = null;
      }

      this.composer = hdrTarget ? new EffectComposer(this.renderer, hdrTarget) : new EffectComposer(this.renderer);
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);

      this.renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(this.renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.max(1, Math.floor(w * pr * 0.5)), Math.max(1, Math.floor(h * pr * 0.5))),
        0.44, 0.36, 0.86
      );
      this.composer.addPass(this.bloomPass);

      this.outputPass = new OutputPass();
      this.composer.addPass(this.outputPass);

      this.noirPass = new ShaderPass(GOTHAM_NOIR_SHADER);
      this.composer.addPass(this.noirPass);

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
      gtao.updateGtaoMaterial({ radius: 0.62, distanceExponent: 1.75, thickness: 1.5, scale: 1.0, samples: 12 });
      gtao.updatePdMaterial({ lumaPhi: 8, depthPhi: 3, normalPhi: 3, radius: 5 });
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
      const smaa = new SMAAPass(Math.max(1, Math.floor(this.width * pr)), Math.max(1, Math.floor(this.height * pr)));
      this.composer.addPass(smaa);
      this.smaaPass = smaa;
    } catch (err) {
      console.warn('[GraphicsPipeline] SMAAPass indisponível:', err);
      this.smaaPass = null;
    }
  }

  _computeEffectivePixelRatio() {
    const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const cap = this._activeProfile?.pixelRatioCap ?? 1.0;
    const scale = this.preset === 'auto' ? this._drsScale : 1.0;
    return Math.max(0.70, Math.min(rawDpr * scale, cap));
  }

  _resolveAutoProfile() {
    if (this._autoTier <= 0) {
      return { ...PRESET_PROFILES.low, pixelRatioCap: 1.0, dynamicShadows: true, cameraFar: 3100, fogDensity: 0.00082 };
    }
    if (this._autoTier === 1) {
      return { ...PRESET_PROFILES.medium, bloom: false, shadowMapSize: 1024, pixelRatioCap: 1.0 };
    }
    if (this._autoTier === 2) {
      return {
        ...PRESET_PROFILES.medium, shadowMapSize: 1536, pixelRatioCap: 1.0,
        microBevel: 1.0, bloomStrength: 0.36, bloomRadius: 0.3
      };
    }
    return { ...PRESET_PROFILES.ultra, aa: 'fxaa', pixelRatioCap: 1.25, cameraFar: 3100, fogDensity: 0.00082 };
  }

  updateCameraAndFogForAltitude(altitudeY = this.camera?.position?.y ?? 0, dt = 0.016) {
    const p = this._activeProfile || PRESET_PROFILES.medium;
    if (this.scene) {
      if (this.scene.fog?.isFogExp2) {
        this.scene.fog.density = p.fogDensity;
      } else if (!this.scene.fog) {
        const bgHex = this.scene.background?.isColor ? this.scene.background.getHex() : 0x0a101a;
        this.scene.fog = new THREE.FogExp2(bgHex, p.fogDensity);
      }
    }
    if (this.camera?.isPerspectiveCamera) {
      const baseFar = p.cameraFar ?? 3100;
      const highFar = Math.max(baseFar, 4600);
      const altT = altitudeY > 220 ? THREE.MathUtils.clamp((altitudeY - 220) / 190, 0, 1) : 0;
      const targetFar = baseFar + (highFar - baseFar) * altT;
      const nextFar = dt > 0 ? this.camera.far + (targetFar - this.camera.far) * Math.min(1, dt * 6.0) : targetFar;

      if (Math.abs(nextFar - this.camera.far) > 0.25) {
        this.camera.far = Math.abs(targetFar - nextFar) < 1.0 ? targetFar : nextFar;
        this.camera.updateProjectionMatrix?.();
      }
      const celRoot = this.world?.atmosphere?.celestialRoot;
      if (celRoot) {
        const skyScale = Math.min(1.0, (this.camera.far * 0.88) / Math.max(1, 6600 * WORLD_SCALE));
        celRoot.scale.setScalar(skyScale);
        if (this.world.atmosphere.starMat) {
          this.world.atmosphere.starMat.size = 6.5 * WORLD_SCALE * skyScale;
        }
      }
    }
  }

  setPreset(preset) {
    const next = GRAPHICS_PRESETS.includes(preset) ? preset : 'auto';
    this.preset = next;
    this._drsScale = 1.0;
    if (next === 'auto') {
      this._autoTier = 2;
      this._autoCooldown = 2.0;
      this._activeProfile = this._resolveAutoProfile();
    } else {
      this._activeProfile = { ...PRESET_PROFILES[next] };
    }
    this._applyActiveProfile();
  }

  _applyActiveProfile() {
    const p = this._activeProfile;
    setLegoShaderQualityFX({ enabled: p.shaderFx, microBevel: p.microBevel });
    this.updateCameraAndFogForAltitude(this.camera?.position?.y ?? 0, 0);

    if (this.world?.sunLight?.shadow) {
      const sm = this.world.sunLight.shadow;
      if (sm.mapSize && sm.mapSize.width !== p.shadowMapSize) {
        sm.mapSize.set(p.shadowMapSize, p.shadowMapSize);
        if (sm.map) { sm.map.dispose(); sm.map = null; }
        sm.needsUpdate = true;
      }
    }

    if (this.shadowBudget) {
      this.shadowBudget.update(
        0, this._resolveFocusPosition(), this.preset, this._resolveHorizontalSpeed(), this._autoTier
      );
    }

    if (this.isHeadless || !this.renderer) return;

    const pr = this._computeEffectivePixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(this.width, this.height);
    if (!this.composer) return;

    this.composer.setPixelRatio(pr);
    this.composer.setSize(this.width, this.height);
    this._syncBloomHalfResSize(this.width, this.height, pr);

    if (p.useComposer && p.gtao) this._ensureGtaoPass();
    if (this.gtaoPass) this.gtaoPass.enabled = Boolean(p.useComposer && p.gtao);

    if (this.bloomPass) {
      this.bloomPass.enabled = Boolean(p.useComposer && p.bloom);
      this.bloomPass.strength = p.bloomStrength;
      this.bloomPass.radius = p.bloomRadius;
    }
    if (this.noirPass) this.noirPass.enabled = Boolean(p.useComposer && p.noirGrade !== false);

    if (p.useComposer && p.aa === 'smaa') this._ensureSmaaPass();
    if (this.fxaaPass) {
      const fxaaOn = Boolean(p.useComposer && p.aa === 'fxaa');
      this.fxaaPass.enabled = fxaaOn;
      if (fxaaOn) {
        this.fxaaPass.material.uniforms.resolution.value.set(
          1 / Math.max(1, this.width * pr), 1 / Math.max(1, this.height * pr)
        );
      }
    }
    if (this.smaaPass) this.smaaPass.enabled = Boolean(p.useComposer && p.aa === 'smaa');
  }

  _updateAutoDRS(dt) {
    if (this.preset !== 'auto') return;
    const clampedDt = Math.max(0.004, Math.min(0.08, dt || 0.016));
    this._emaDt = this._emaDt * 0.90 + clampedDt * 0.10;
    if (this._autoCooldown > 0) {
      this._autoCooldown -= clampedDt;
      return;
    }
    this._autoEvalTimer += clampedDt;
    if (this._autoEvalTimer < 0.8) return;
    this._autoEvalTimer = 0;

    const emaMs = this._emaDt * 1000;
    let changed = false;
    if (emaMs > 16.6) {
      if (this._drsScale > 0.70) {
        this._drsScale = Number(Math.max(0.70, this._drsScale - 0.10).toFixed(2));
        changed = true;
      } else if (this._autoTier > 0) {
        this._autoTier -= 1;
        this._drsScale = 0.85;
        changed = true;
      }
    } else if (emaMs < 13.2) {
      if (this._drsScale < 1.0) {
        this._drsScale = Number(Math.min(1.0, this._drsScale + 0.10).toFixed(2));
        changed = true;
      } else if (this._autoTier < 3 && emaMs < 11.2) {
        this._autoTier += 1;
        changed = true;
      }
    }

    if (changed) {
      this._autoCooldown = 1.2;
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
      this._syncBloomHalfResSize(this.width, this.height, pr);
    }
    if (this.fxaaPass) {
      this.fxaaPass.material.uniforms.resolution.value.set(
        1 / Math.max(1, this.width * pr), 1 / Math.max(1, this.height * pr)
      );
    }
  }

  _ensureKillFlashOverlay() {
    if (this._killFlashOverlayEl) return this._killFlashOverlayEl;
    if (typeof document === 'undefined') return null;
    let el = typeof document.getElementById === 'function' ? document.getElementById('kill-flash-overlay') : null;
    if (!el && typeof document.createElement === 'function') { el = document.createElement('div'); if (el) el.id = 'kill-flash-overlay'; }
    if (!el) return null;
    el.classList?.add('kill-flash-overlay');
    el.setAttribute?.('aria-hidden', 'true');
    const attached = Boolean(el.isConnected || el.parentNode || (Array.isArray(document.body?.children) && document.body.children.includes(el)));
    if (!attached && document.body?.appendChild) document.body.appendChild(el);
    this._killFlashOverlayEl = el;
    return el;
  }

  _syncKillFlashOverlay(intensity = 0) {
    const k = Math.max(0, Math.min(1, Number(intensity) || 0));
    if (k <= 0.0005 && !this._killFlashOverlayEl) return;
    const el = this._ensureKillFlashOverlay();
    if (!el) return;
    const active = k > 0.0005;
    el.classList?.remove('hidden');
    el.classList?.toggle('is-active', active);
    if (el.style) el.style.opacity = active ? String(Number(k.toFixed(4))) : '0';
  }

  setKillEffectEnabled(enabled = true) {
    this.killFlashEnabled = Boolean(enabled);
    if (!this.killFlashEnabled) {
      this._killFlashTimer = 0;
      this.killFlashIntensity = 0;
      this._usingCssKillFlashFallback = false;
      if (this.noirPass?.uniforms?.uKillFlash) this.noirPass.uniforms.uKillFlash.value = 0.0;
      this._syncKillFlashOverlay(0);
    }
    return this.killFlashEnabled;
  }

  pulseKillFlash() {
    if (!this.killFlashEnabled) return false;
    this._killFlashTimer = this._killFlashDuration;
    this.killFlashIntensity = 1.0;
    this.killFlashCount += 1;

    const shaderActive = Boolean(
      !this.isHeadless && this.composer && this._activeProfile?.useComposer &&
      this._activeProfile?.noirGrade !== false && this.noirPass &&
      this.noirPass.enabled !== false && this.noirPass.uniforms?.uKillFlash
    );
    if (this.noirPass?.uniforms?.uKillFlash) this.noirPass.uniforms.uKillFlash.value = 1.0;

    if (!shaderActive) {
      this._usingCssKillFlashFallback = true;
      this._syncKillFlashOverlay(1.0);
    } else if (this._usingCssKillFlashFallback) {
      this._usingCssKillFlashFallback = false;
      this._syncKillFlashOverlay(0);
    }
    return true;
  }

  _updateKillFlash(dt = 0.016) {
    if (this._killFlashTimer <= 0) return;
    this._killFlashTimer = Math.max(0, this._killFlashTimer - Math.max(0, Number(dt) || 0));
    const k = this._killFlashTimer > 0 ? Math.pow(this._killFlashTimer / this._killFlashDuration, 1.6) : 0;
    this.killFlashIntensity = k;
    if (this.noirPass?.uniforms?.uKillFlash) this.noirPass.uniforms.uKillFlash.value = k;
    if (this._usingCssKillFlashFallback || this.isHeadless || !this.composer || !this._activeProfile?.useComposer || !this._activeProfile?.noirGrade) {
      this._syncKillFlashOverlay(k);
      if (k <= 0) this._usingCssKillFlashFallback = false;
    }
  }

  render(dt = 0.016) {
    this._updateKillFlash(dt);
    this._updateAutoDRS(dt);
    this.updateCameraAndFogForAltitude(this.camera?.position?.y ?? 0, dt);

    if (this.shadowBudget) {
      this.shadowBudget.update(
        dt, this._resolveFocusPosition(), this.preset, this._resolveHorizontalSpeed(), this._autoTier
      );
    }

    if (this.isHeadless || !this.renderer || !this.scene || !this.camera) return;
    this._noirTime += Math.min(0.05, dt || 0.016);
    if (this.noirPass?.uniforms?.uTime) this.noirPass.uniforms.uTime.value = this._noirTime;

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
      noirGradeEnabled: Boolean(this.noirPass?.enabled),
      aaMode: this._activeProfile.aa,
      shadowMapSize: this._activeProfile.shadowMapSize,
      dynamicShadows: Boolean(this.preset !== 'low'),
      activeShadowCasters: this.shadowBudget?.activeCasterCount ?? null,
      cameraFar: this.camera?.far ?? this._activeProfile.cameraFar,
      fogDensity: this.scene?.fog?.density ?? this._activeProfile.fogDensity
    };
  }

  dispose() {
    this.shadowBudget?.dispose?.();
    this.shadowBudget = null;
    if (this.gtaoPass?.dispose) this.gtaoPass.dispose();
    if (this.bloomPass?.dispose) this.bloomPass.dispose();
    if (this.outputPass?.dispose) this.outputPass.dispose();
    if (this.noirPass?.dispose) this.noirPass.dispose();
    if (this.fxaaPass?.dispose) this.fxaaPass.dispose();
    if (this.smaaPass?.dispose) this.smaaPass.dispose();
    if (this.composer?.dispose) this.composer.dispose();
    this.composer = null;
  }
}
