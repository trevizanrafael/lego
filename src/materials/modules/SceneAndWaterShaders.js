/**
 * Shaders procedurais de superfície LEGO (Micro-Bevel ABS + Height-Fog Noir) e Água Animada.
 * Submódulo extraído de `LegoMaterials.js` sem alteração visual ou lógica.
 */

export const LEGO_SHADER_GLOBALS = {
  uLegoFxEnabled: { value: 1.0 },
  uLegoMicroBevelScale: { value: 1.0 },
  uLegoHeightFogMin: { value: 0.28 }
};

export function setLegoShaderQualityFX({ enabled = true, microBevel = 1.0 } = {}) {
  LEGO_SHADER_GLOBALS.uLegoFxEnabled.value = enabled ? 1.0 : 0.0;
  LEGO_SHADER_GLOBALS.uLegoMicroBevelScale.value = enabled ? microBevel : 0.0;
}

/**
 * Injeta Micro-Chanfro / Realce ABS LEGO + Height-Fog atenuado por altitude (Y):
 * - Mantém Torre dos Heróis (310m) e Aeroporta-Aviões (410m) nítidos acima da névoa baixa da cidade.
 * - Usa glsl padrão WebGL2/Three.js e cache unificado `lego-surface-v1`.
 */
export function applyLegoSurfaceFX(mat, options = {}) {
  if (!mat || typeof mat.onBeforeCompile !== 'function') return mat;
  if (mat.userData?.hasAnimatedLegoWater || mat.userData?.hasLegoSurfaceFX) return mat;

  const bevelWeight = options.bevelWeight ?? 1.0;
  mat.userData = mat.userData || {};
  mat.userData.hasLegoSurfaceFX = true;
  mat.customProgramCacheKey = () => 'lego-surface-v1';

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLegoFxEnabled = LEGO_SHADER_GLOBALS.uLegoFxEnabled;
    shader.uniforms.uLegoMicroBevelScale = LEGO_SHADER_GLOBALS.uLegoMicroBevelScale;
    shader.uniforms.uLegoHeightFogMin = LEGO_SHADER_GLOBALS.uLegoHeightFogMin;
    shader.uniforms.uLegoBevelWeight = { value: bevelWeight };

    if (shader.vertexShader.includes('#include <common>')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
varying vec3 vLegoSurfaceWorldPos;
varying float vLegoViewDist;`
      );
    }

    if (shader.vertexShader.includes('#include <project_vertex>')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `vec4 _legoWPos = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  _legoWPos = batchingMatrix * _legoWPos;
#endif
#ifdef USE_INSTANCING
  _legoWPos = instanceMatrix * _legoWPos;
#endif
_legoWPos = modelMatrix * _legoWPos;
vLegoSurfaceWorldPos = _legoWPos.xyz;
#include <project_vertex>
vLegoViewDist = -mvPosition.z;`
      );
    }

    if (shader.fragmentShader.includes('#include <common>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform float uLegoFxEnabled;
uniform float uLegoMicroBevelScale;
uniform float uLegoBevelWeight;
uniform float uLegoHeightFogMin;
varying vec3 vLegoSurfaceWorldPos;
varying float vLegoViewDist;`
      );
    }

    if (shader.fragmentShader.includes('#include <fog_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <fog_fragment>',
        `float _bevelStr = uLegoFxEnabled * uLegoMicroBevelScale * uLegoBevelWeight;
if (_bevelStr > 0.01) {
  vec3 _viewDirL = normalize(vViewPosition);
  float _rimDistFade = smoothstep(210.0, 32.0, vLegoViewDist);
  float _rimCold = pow(1.0 - clamp(abs(dot(_viewDirL, normal)), 0.0, 1.0), 4.6) * _rimDistFade;
  gl_FragColor.rgb += vec3(0.022, 0.036, 0.048) * _rimCold * _bevelStr;

  // Fuligem urbana / oclusão junto ao asfalto + manchas sutis de chuva/umidade (estilo Gotham Noir)
  float _groundSoot = (1.0 - smoothstep(-0.2, 5.8, vLegoSurfaceWorldPos.y)) * 0.24;
  float _rainStreak = sin(vLegoSurfaceWorldPos.x * 0.65 + vLegoSurfaceWorldPos.z * 0.61)
                    * cos(vLegoSurfaceWorldPos.y * 0.28 + vLegoSurfaceWorldPos.x * 0.19);
  float _grimeFade = 1.0 - smoothstep(35.0, 180.0, vLegoViewDist);
  float _weatherDarken = clamp(_groundSoot + max(0.0, _rainStreak) * 0.08 * _grimeFade, 0.0, 0.30);
  gl_FragColor.rgb *= (1.0 - _weatherDarken * _bevelStr);
}
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  // Neblina baixa pesada nos becos/avenidas (Y < 32m) com topos emergindo na bruma
  float _hAtten = exp( - max( 0.0, vLegoSurfaceWorldPos.y - 12.0 ) * 0.0085 );
  float _lowAlleyMist = (1.0 - smoothstep(0.0, 32.0, max(0.0, vLegoSurfaceWorldPos.y))) * 0.16 * smoothstep(28.0, 220.0, vFogDepth);
  float _hWeight = mix( 1.0, clamp( mix( uLegoHeightFogMin, 1.0, _hAtten ), uLegoHeightFogMin, 1.0 ), uLegoFxEnabled );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp(fogFactor * _hWeight + _lowAlleyMist * uLegoFxEnabled, 0.0, 1.0) );
#endif`
      );
    }
  };

  mat.needsUpdate = true;
  return mat;
}

/**
 * Aplica Height-Fog e Micro-Chanfro aos materiais PBR da cena já construída sem clonar malhas.
 */
export function applyLegoSceneShaderEnhancements(scene) {
  if (!scene || typeof scene.traverse !== 'function') return;
  const visited = new Set();
  scene.traverse((obj) => {
    if (!obj || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < mats.length; i++) {
      const m = mats[i];
      if (!m || visited.has(m)) continue;
      visited.add(m);
      if (!m.isMeshStandardMaterial && !m.isMeshPhysicalMaterial) continue;
      if (m.userData?.hasAnimatedLegoWater || m.userData?.hasLegoSurfaceFX) continue;
      const isMatteOrMapped = Boolean(m.map) || (typeof m.roughness === 'number' && m.roughness >= 0.48);
      const bevelWeight = m.transparent ? 0.2 : isMatteOrMapped ? 0.0 : 0.85;
      applyLegoSurfaceFX(m, { bevelWeight });
    }
  });
}

/**
 * Aplica shader animado de água LEGO procedural (`onBeforeCompile`) sem alterar `mat.color`:
 * - Ondulação suave de superfície no vertex shader (`uWaterTime`)
 * - Normal perturbation + brilho especular de ondas + reflexão Fresnel + espuma nas bordas
 * - Mantém 100% seguro em testes Node/headless sem contexto WebGL ativo.
 */
export function applyAnimatedLegoWaterShader(mat, sharedUniforms, options = {}) {
  if (!mat || typeof mat.onBeforeCompile !== 'function') return mat;
  if (mat.userData?.hasAnimatedLegoWater) return mat;

  const uniforms = sharedUniforms && sharedUniforms.uTime ? sharedUniforms : { uTime: { value: 0 } };
  const waveAmp = options.waveAmp ?? 0.075;
  const waveFreq = options.waveFreq ?? 0.14;
  const variant = options.variant || 'ocean';
  const fresnelBoost = options.fresnelBoost ?? 0.24;

  mat.userData = mat.userData || {};
  mat.userData.hasAnimatedLegoWater = true;
  mat.userData.waterUniforms = uniforms;
  mat.customProgramCacheKey = () => `lego-water-v1-${variant}`;

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = uniforms.uTime;
    shader.uniforms.uWaterWaveAmp = { value: waveAmp };
    shader.uniforms.uWaterWaveFreq = { value: waveFreq };
    shader.uniforms.uWaterFresnelBoost = { value: fresnelBoost };

    if (shader.vertexShader.includes('#include <common>')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
uniform float uWaterTime;
uniform float uWaterWaveAmp;
uniform float uWaterWaveFreq;
varying vec3 vLegoWaterWorldPos;`
      );
    }

    if (shader.vertexShader.includes('#include <begin_vertex>')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 _lwPos = modelMatrix * vec4(transformed, 1.0);
vLegoWaterWorldPos = _lwPos.xyz;
float _lwTopMask = smoothstep(-0.35, 0.05, transformed.y);
float _lwDisp = sin(_lwPos.x * uWaterWaveFreq + uWaterTime * 1.55) * cos(_lwPos.z * (uWaterWaveFreq * 1.15) - uWaterTime * 1.2);
transformed.y += _lwDisp * uWaterWaveAmp * _lwTopMask;`
      );
    }

    if (shader.fragmentShader.includes('#include <common>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform float uWaterTime;
uniform float uWaterFresnelBoost;
varying vec3 vLegoWaterWorldPos;`
      );
    }

    if (shader.fragmentShader.includes('#include <normal_fragment_maps>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
float _lwN1 = sin(vLegoWaterWorldPos.x * 0.34 + uWaterTime * 1.85 + cos(vLegoWaterWorldPos.z * 0.25 - uWaterTime * 1.1));
float _lwN2 = cos(vLegoWaterWorldPos.z * 0.41 - uWaterTime * 1.45 + sin(vLegoWaterWorldPos.x * 0.29 + uWaterTime * 0.95));
normal = normalize(normal + vec3(_lwN1 * 0.085, _lwN2 * 0.085, 0.0));`
      );
    }

    if (shader.fragmentShader.includes('#include <fog_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <fog_fragment>',
        `float _lwWave1 = sin(vLegoWaterWorldPos.x * 0.31 + uWaterTime * 1.7 + cos(vLegoWaterWorldPos.z * 0.23 - uWaterTime * 1.15));
float _lwWave2 = cos(vLegoWaterWorldPos.z * 0.38 - uWaterTime * 1.4 + sin(vLegoWaterWorldPos.x * 0.27 + uWaterTime * 0.9));
float _lwRipple = (_lwWave1 + _lwWave2) * 0.5;
float _lwVdotN = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
float _lwFresnel = pow(1.0 - _lwVdotN, 3.0);
float _lwFoamCrest = smoothstep(0.62, 0.98, _lwRipple);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.12, 0.24, 0.31), _lwFresnel * uWaterFresnelBoost);
gl_FragColor.rgb += vec3(0.28, 0.36, 0.42) * _lwFoamCrest * 0.06;
#include <fog_fragment>`
      );
    }
  };

  mat.needsUpdate = true;
  return mat;
}
