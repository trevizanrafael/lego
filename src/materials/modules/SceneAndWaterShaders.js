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
 * - 4 direções não-ortogonais de onda em comprimentos e velocidades incomensuráveis (zero moiré/grade!)
 * - Atenuação por distância (`_lwDistAtten`) eliminando cintilação no horizonte
 * - Riqueza cromática abissal vs banco costeiro + cristas de espuma sopradas pelo vento
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
  mat.customProgramCacheKey = () => `lego-water-v2-${variant}`;

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
varying vec3 vLegoWaterWorldPos;
varying vec3 vLegoWaterViewX;
varying vec3 vLegoWaterViewZ;`
      );
    }

    if (shader.vertexShader.includes('#include <begin_vertex>')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 _lwPos = modelMatrix * vec4(transformed, 1.0);
vLegoWaterWorldPos = _lwPos.xyz;
vLegoWaterViewX = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
vLegoWaterViewZ = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
float _lwTopMask = smoothstep(0.1, 0.6, normal.y);
vec2 _lwXZ = _lwPos.xz;
float _lwD1 = sin(dot(_lwXZ, vec2(0.86, 0.51)) * (uWaterWaveFreq * 0.71) + uWaterTime * 1.18) * 0.40;
float _lwD2 = sin(dot(_lwXZ, vec2(-0.43, 0.90)) * (uWaterWaveFreq * 1.07) - uWaterTime * 1.47) * 0.28;
float _lwD3 = sin(dot(_lwXZ, vec2(0.67, -0.74)) * (uWaterWaveFreq * 1.63) + uWaterTime * 1.93) * 0.19;
float _lwD4 = sin(dot(_lwXZ, vec2(-0.92, -0.39)) * (uWaterWaveFreq * 2.29) - uWaterTime * 2.37) * 0.13;
transformed.y += (_lwD1 + _lwD2 + _lwD3 + _lwD4) * uWaterWaveAmp * _lwTopMask;`
      );
    }

    if (shader.fragmentShader.includes('#include <common>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform float uWaterTime;
uniform float uWaterFresnelBoost;
varying vec3 vLegoWaterWorldPos;
varying vec3 vLegoWaterViewX;
varying vec3 vLegoWaterViewZ;`
      );
    }

    if (shader.fragmentShader.includes('#include <normal_fragment_maps>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
float _lwViewDist = length(vViewPosition);
float _lwDistAtten = 1.0 - smoothstep(140.0, 1350.0, _lwViewDist);
float _lwSwellAtten = 1.0 - smoothstep(380.0, 2500.0, _lwViewDist) * 0.88;
vec2 _lwP = vLegoWaterWorldPos.xz;
vec2 _lwDir1 = vec2(0.86, 0.51);
vec2 _lwDir2 = vec2(-0.43, 0.90);
vec2 _lwDir3 = vec2(0.67, -0.74);
vec2 _lwDir4 = vec2(-0.92, -0.39);
float _lwPh1 = dot(_lwP, _lwDir1) * 0.093 + uWaterTime * 1.12;
float _lwPh2 = dot(_lwP, _lwDir2) * 0.137 - uWaterTime * 1.41;
float _lwPh3 = dot(_lwP, _lwDir3) * 0.191 + uWaterTime * 1.73;
float _lwPh4 = dot(_lwP, _lwDir4) * 0.263 - uWaterTime * 2.09;
vec2 _lwSwellSlope = (
  _lwDir1 * cos(_lwPh1) * 0.36 +
  _lwDir2 * cos(_lwPh2) * 0.28 +
  _lwDir3 * cos(_lwPh3) * 0.21 +
  _lwDir4 * cos(_lwPh4) * 0.15
) * 0.068 * _lwSwellAtten;
float _lwRp1 = dot(_lwP, _lwDir1) * 0.43 + uWaterTime * 2.35 + 0.35 * sin(_lwPh2);
float _lwRp2 = dot(_lwP, _lwDir2) * 0.59 - uWaterTime * 2.78 + 0.35 * cos(_lwPh3);
float _lwRp3 = dot(_lwP, _lwDir3) * 0.83 + uWaterTime * 3.19 + 0.30 * sin(_lwPh4);
float _lwRp4 = dot(_lwP, _lwDir4) * 1.13 - uWaterTime * 3.67 + 0.30 * cos(_lwPh1);
vec2 _lwRippleSlope = (
  _lwDir1 * cos(_lwRp1) * 0.34 +
  _lwDir2 * cos(_lwRp2) * 0.28 +
  _lwDir3 * cos(_lwRp3) * 0.22 +
  _lwDir4 * cos(_lwRp4) * 0.16
) * 0.058 * _lwDistAtten;
vec2 _lwTotalSlope = _lwSwellSlope + _lwRippleSlope;
normal = normalize(normal - vLegoWaterViewX * _lwTotalSlope.x - vLegoWaterViewZ * _lwTotalSlope.y);`
      );
    }

    if (shader.fragmentShader.includes('#include <fog_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <fog_fragment>',
        `float _lwSwellH = sin(_lwPh1) * 0.38 + sin(_lwPh2) * 0.28 + sin(_lwPh3) * 0.20 + sin(_lwPh4) * 0.14;
float _lwRippleH = sin(_lwRp1) * 0.35 + sin(_lwRp2) * 0.28 + sin(_lwRp3) * 0.21 + sin(_lwRp4) * 0.16;
float _lwShelfT = smoothstep(1800.0, 9200.0, length(_lwP));
vec3 _lwShoalTint = vec3(0.032, 0.118, 0.155);
vec3 _lwAbyssTint = vec3(0.010, 0.036, 0.062);
gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(_lwShoalTint, _lwAbyssTint, _lwShelfT), 0.34);
float _lwSubsurf = smoothstep(0.06, 0.68, _lwSwellH) * (1.0 - _lwShelfT * 0.65);
gl_FragColor.rgb += vec3(0.024, 0.088, 0.115) * _lwSubsurf * 0.26;
float _lwVdotN = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
float _lwFresnel = pow(1.0 - _lwVdotN, 3.6);
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.10, 0.21, 0.28), _lwFresnel * uWaterFresnelBoost);
float _lwWindStreak = sin(dot(_lwP, vec2(-0.51, 0.86)) * 0.37 + sin(dot(_lwP, _lwDir1) * 0.19 - uWaterTime * 0.85) * 1.4);
float _lwCrestEnergy = _lwSwellH * 0.62 + _lwRippleH * 0.38 * _lwDistAtten + _lwWindStreak * 0.10;
float _lwFoamCrest = smoothstep(0.58, 0.92, _lwCrestEnergy) * _lwDistAtten;
gl_FragColor.rgb += vec3(0.34, 0.41, 0.46) * _lwFoamCrest * 0.11;
#include <fog_fragment>`
      );
    }
  };

  mat.needsUpdate = true;
  return mat;
}
