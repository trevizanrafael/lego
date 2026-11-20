import * as THREE from 'three';

export const TIME_MODES = ['auto', 'day', 'sunset', 'night'];

// ============================================================================
// KEYFRAMES CONTÍNUOS DE COR E ILUMINAÇÃO (00:00 -> 24:00) — ESTILO GOTHAM NOIR / DC SUPER-VILLAINS
// Dia nublado/pesado em azul-petróleo/chumbo (sombras densas) + Crepúsculo sangrento + Noite abissal opressiva!
// ============================================================================
export const ATMOSPHERE_KEYFRAMES = [
  {
    hour: 0.0,
    zenith: 0x020409,
    mid: 0x07111c,
    horizon: 0x0e1c26,
    sunGlow: 0x0f293a,
    dirColor: 0x6488a8,
    dirInt: 0.48,
    hemiSky: 0x162638,
    hemiGnd: 0x050608,
    hemiInt: 0.24,
    nightFactor: 1.0
  },
  {
    hour: 5.25,
    zenith: 0x040711,
    mid: 0x0b1626,
    horizon: 0x142433,
    sunGlow: 0x1d3b52,
    dirColor: 0x6488a8,
    dirInt: 0.50,
    hemiSky: 0x1a2c40,
    hemiGnd: 0x06070a,
    hemiInt: 0.26,
    nightFactor: 0.96
  },
  {
    // Amanhecer Frio & Bruma Vermelha-Cinza (05:30 - 07:30)
    hour: 6.35,
    zenith: 0x0f1726,
    mid: 0x3b1f2b,
    horizon: 0x6e3424,
    sunGlow: 0xb45309,
    dirColor: 0xd69e72,
    dirInt: 1.05,
    hemiSky: 0x475569,
    hemiGnd: 0x0f131a,
    hemiInt: 0.36,
    nightFactor: 0.28
  },
  {
    hour: 7.75,
    zenith: 0x0e1724,
    mid: 0x1c2b3a,
    horizon: 0x2c3c48,
    sunGlow: 0x94a3b8,
    dirColor: 0xcbd5e1,
    dirInt: 1.44,
    hemiSky: 0x334155,
    hemiGnd: 0x090b10,
    hemiInt: 0.42,
    nightFactor: 0.0
  },
  {
    // Dia Carregado de Gotham (07:30 - 16:45): Céu chumbo/petróleo e sombras dramáticas profundas!
    hour: 12.0,
    zenith: 0x0e1724,
    mid: 0x1d2d3c,
    horizon: 0x2e3f4b,
    sunGlow: 0xa8b5c4,
    dirColor: 0xd6dde6,
    dirInt: 1.52,
    hemiSky: 0x384657,
    hemiGnd: 0x090b10,
    hemiInt: 0.44,
    nightFactor: 0.0
  },
  {
    hour: 16.5,
    zenith: 0x0d1422,
    mid: 0x242a3d,
    horizon: 0x3d3846,
    sunGlow: 0xb45309,
    dirColor: 0xd6a87c,
    dirInt: 1.35,
    hemiSky: 0x334155,
    hemiGnd: 0x090b10,
    hemiInt: 0.40,
    nightFactor: 0.06
  },
  {
    // Crepúsculo Sangrento / Smog de Gotham (16:45 - 18:45): Céu rubro-violeta sem estourar exposição!
    hour: 17.75,
    zenith: 0x090714,
    mid: 0x3b122b,
    horizon: 0x6b1919,
    sunGlow: 0xb91c1c,
    dirColor: 0xc25115,
    dirInt: 0.78,
    hemiSky: 0x451c16,
    hemiGnd: 0x09070f,
    hemiInt: 0.30,
    nightFactor: 0.50
  },
  {
    hour: 18.75,
    zenith: 0x04060d,
    mid: 0x161229,
    horizon: 0x381918,
    sunGlow: 0x991b1b,
    dirColor: 0x6488a8,
    dirInt: 0.56,
    hemiSky: 0x1b293b,
    hemiGnd: 0x06070a,
    hemiInt: 0.26,
    nightFactor: 0.92
  },
  {
    // Noite Trevosa de Gotham (18:45 - 05:30): Escuridão densa cortada por vapor de sódio e neon!
    hour: 19.5,
    zenith: 0x020409,
    mid: 0x07111c,
    horizon: 0x0e1c26,
    sunGlow: 0x0f293a,
    dirColor: 0x6488a8,
    dirInt: 0.48,
    hemiSky: 0x162638,
    hemiGnd: 0x050608,
    hemiInt: 0.24,
    nightFactor: 1.0
  },
  {
    hour: 24.0,
    zenith: 0x020409,
    mid: 0x07111c,
    horizon: 0x0e1c26,
    sunGlow: 0x0f293a,
    dirColor: 0x6488a8,
    dirInt: 0.48,
    hemiSky: 0x162638,
    hemiGnd: 0x050608,
    hemiInt: 0.24,
    nightFactor: 1.0
  }
];

export function sampleAtmosphereAtHour(hour24, out) {
  const h = ((hour24 % 24) + 24) % 24;
  let k0 = ATMOSPHERE_KEYFRAMES[0];
  let k1 = ATMOSPHERE_KEYFRAMES[ATMOSPHERE_KEYFRAMES.length - 1];
  for (let i = 0; i < ATMOSPHERE_KEYFRAMES.length - 1; i++) {
    if (h >= ATMOSPHERE_KEYFRAMES[i].hour && h <= ATMOSPHERE_KEYFRAMES[i + 1].hour) {
      k0 = ATMOSPHERE_KEYFRAMES[i];
      k1 = ATMOSPHERE_KEYFRAMES[i + 1];
      break;
    }
  }
  const span = Math.max(0.0001, k1.hour - k0.hour);
  const rawT = THREE.MathUtils.clamp((h - k0.hour) / span, 0, 1);
  const t = rawT * rawT * (3 - 2 * rawT);

  out.zenith.setHex(k0.zenith).lerp(out._tmp.setHex(k1.zenith), t);
  out.mid.setHex(k0.mid).lerp(out._tmp.setHex(k1.mid), t);
  out.horizon.setHex(k0.horizon).lerp(out._tmp.setHex(k1.horizon), t);
  out.sunGlow.setHex(k0.sunGlow).lerp(out._tmp.setHex(k1.sunGlow), t);
  out.dirColor.setHex(k0.dirColor).lerp(out._tmp.setHex(k1.dirColor), t);
  out.hemiSky.setHex(k0.hemiSky).lerp(out._tmp.setHex(k1.hemiSky), t);
  out.hemiGnd.setHex(k0.hemiGnd).lerp(out._tmp.setHex(k1.hemiGnd), t);
  out.dirInt = THREE.MathUtils.lerp(k0.dirInt, k1.dirInt, t);
  out.hemiInt = THREE.MathUtils.lerp(k0.hemiInt, k1.hemiInt, t);
  out.nightFactor = THREE.MathUtils.lerp(k0.nightFactor, k1.nightFactor, t);
}

// ============================================================================
// SHADERS E UNIFORMS DO SKYDOME PROCEDURAL
// ============================================================================
export const SKYDOME_VERTEX_SHADER = `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;

export const SKYDOME_FRAGMENT_SHADER = `
        uniform vec3 uZenithColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunGlowColor;
        uniform vec3 uSunDir;
        uniform float uGlowStrength;
        varying vec3 vWorldDir;
        void main() {
          vec3 d = normalize(vWorldDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 grad = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.26, h));
          grad = mix(grad, uZenithColor, smoothstep(0.22, 0.85, h));
          float sunAmt = max(dot(d, normalize(uSunDir)), 0.0);
          float sunHalo = pow(sunAmt, 7.0) * uGlowStrength + pow(sunAmt, 36.0) * (uGlowStrength * 0.85);
          vec3 finalCol = grad + uSunGlowColor * sunHalo;
          gl_FragColor = vec4(finalCol, 1.0);
        }
      `;

export function createSkyDomeUniforms() {
  return {
    uZenithColor: { value: new THREE.Color(0x1565d8) },
    uMidColor: { value: new THREE.Color(0x429ef5) },
    uHorizonColor: { value: new THREE.Color(0x7ec2fc) },
    uSunGlowColor: { value: new THREE.Color(0xfffbeb) },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2).normalize() },
    uGlowStrength: { value: 0.28 }
  };
}

export function createSkyDomeMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: SKYDOME_VERTEX_SHADER,
    fragmentShader: SKYDOME_FRAGMENT_SHADER
  });
}
