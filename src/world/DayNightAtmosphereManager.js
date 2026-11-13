import * as THREE from 'three';
import { getLegoMaterial } from '../materials/LegoMaterials.js';
import { getCachedFacadeMaterials } from './BuildingGenerator.js';
import { RIVER_BRIDGE_SPECS } from './RoadGridBuilder.js';

export const TIME_MODES = ['auto', 'day', 'sunset', 'night'];

// Geometrias e Materiais Compartilhados para os Faróis Noturnos de Todos os Carros e Trens (Zero GC!)
let SHARED_HEADLIGHT_CONE_GEO = null;
let SHARED_HEADLIGHT_CONE_MAT = null;
let SHARED_TAILLIGHT_GLOW_GEO = null;
let SHARED_TAILLIGHT_GLOW_MAT = null;

function ensureSharedVehicleLightAssets() {
  if (SHARED_HEADLIGHT_CONE_GEO) return;

  // Cone apontando para +Z (frente dos veículos LEGO), origem na lente do farol!
  SHARED_HEADLIGHT_CONE_GEO = new THREE.ConeGeometry(2.35, 13.5, 12, 1, true);
  SHARED_HEADLIGHT_CONE_GEO.rotateX(-Math.PI / 2);
  SHARED_HEADLIGHT_CONE_GEO.translate(0, -0.18, 6.75);

  SHARED_HEADLIGHT_CONE_MAT = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  SHARED_TAILLIGHT_GLOW_GEO = new THREE.BoxGeometry(0.46, 0.26, 0.16);
  SHARED_TAILLIGHT_GLOW_MAT = new THREE.MeshBasicMaterial({
    color: 0xff1e42,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

/**
 * Anexa sob demanda (apenas 1x por veículo) os 2 Cones Translúcidos de Farol Branco-Quente + Lanternas Traseiras Vermelhas!
 */
export function ensureVehicleNightLights(carGroup, spec = null) {
  if (!carGroup) return null;
  if (carGroup.userData._nightLightRig) {
    return carGroup.userData._nightLightRig;
  }

  ensureSharedVehicleLightAssets();

  const isMoto = Boolean(spec?.isMotorcycle);
  const isBus = spec?.id === 'onibus_urbano' || spec?.id === 'carro_forte';
  const halfLen = isBus ? 4.6 : isMoto ? 1.35 : 2.35;
  const xSep = isMoto ? 0.0 : isBus ? 1.05 : 0.82;
  const headY = isBus ? 0.85 : 0.68;

  const rig = new THREE.Group();
  rig.name = 'vehicle_night_light_rig';
  rig.visible = false;

  if (isMoto) {
    const cone = new THREE.Mesh(SHARED_HEADLIGHT_CONE_GEO, SHARED_HEADLIGHT_CONE_MAT);
    cone.position.set(0, headY, halfLen);
    cone.scale.set(0.75, 0.75, 0.9);
    rig.add(cone);

    const tail = new THREE.Mesh(SHARED_TAILLIGHT_GLOW_GEO, SHARED_TAILLIGHT_GLOW_MAT);
    tail.position.set(0, headY + 0.05, -halfLen);
    rig.add(tail);
  } else {
    for (const sx of [-xSep, xSep]) {
      const cone = new THREE.Mesh(SHARED_HEADLIGHT_CONE_GEO, SHARED_HEADLIGHT_CONE_MAT);
      cone.position.set(sx, headY, halfLen);
      rig.add(cone);

      const tail = new THREE.Mesh(SHARED_TAILLIGHT_GLOW_GEO, SHARED_TAILLIGHT_GLOW_MAT);
      tail.position.set(sx, headY + 0.04, -halfLen - 0.05);
      rig.add(tail);
    }
  }

  carGroup.add(rig);
  carGroup.userData._nightLightRig = rig;
  return rig;
}

// ============================================================================
// KEYFRAMES CONTÍNUOS DE COR E ILUMINAÇÃO (00:00 -> 24:00)
// Nunca deixa a noite escura demais: Luar Prateado 0x93c5fd (0.78) + Hemi 0x3b82f6/0x1e1b4b (0.62)!
// ============================================================================
const ATMOSPHERE_KEYFRAMES = [
  {
    hour: 0.0,
    zenith: 0x060b1e,
    mid: 0x0f1f4b,
    horizon: 0x172b5c,
    sunGlow: 0x1e3a8a,
    dirColor: 0x93c5fd,
    dirInt: 0.78,
    hemiSky: 0x3b82f6,
    hemiGnd: 0x1e1b4b,
    hemiInt: 0.62,
    nightFactor: 1.0
  },
  {
    hour: 5.25,
    zenith: 0x081029,
    mid: 0x172554,
    horizon: 0x1e3a8a,
    sunGlow: 0x3b82f6,
    dirColor: 0x93c5fd,
    dirInt: 0.78,
    hemiSky: 0x3b82f6,
    hemiGnd: 0x1e1b4b,
    hemiInt: 0.62,
    nightFactor: 0.96
  },
  {
    // Amanhecer (05:30 - 07:30): Horizonte pêssego/dourado, neblina suave rosada, sol nascendo a Leste!
    hour: 6.35,
    zenith: 0x2563eb,
    mid: 0xf472b6,
    horizon: 0xfdba74,
    sunGlow: 0xfef08a,
    dirColor: 0xfed7aa,
    dirInt: 1.55,
    hemiSky: 0xfde68a,
    hemiGnd: 0x334155,
    hemiInt: 0.78,
    nightFactor: 0.25
  },
  {
    hour: 7.75,
    zenith: 0x1d7bf6,
    mid: 0x4aa3fc,
    horizon: 0x7ec2fc,
    sunGlow: 0xfffbeb,
    dirColor: 0xfffbeb,
    dirInt: 2.22,
    hemiSky: 0xf0f9ff,
    hemiGnd: 0x334155,
    hemiInt: 0.94,
    nightFactor: 0.0
  },
  {
    // Dia Tropical (07:30 - 16:45): Céu azul vibrante e cores vivas LEGO
    hour: 12.0,
    zenith: 0x1565d8,
    mid: 0x429ef5,
    horizon: 0x7ec2fc,
    sunGlow: 0xffffff,
    dirColor: 0xfffbeb,
    dirInt: 2.28,
    hemiSky: 0xf0f9ff,
    hemiGnd: 0x334155,
    hemiInt: 0.95,
    nightFactor: 0.0
  },
  {
    hour: 16.5,
    zenith: 0x1e64d8,
    mid: 0x5ca8f8,
    horizon: 0x93c5fd,
    sunGlow: 0xfef08a,
    dirColor: 0xfff7ed,
    dirInt: 2.1,
    hemiSky: 0xe0f2fe,
    hemiGnd: 0x334155,
    hemiInt: 0.9,
    nightFactor: 0.02
  },
  {
    // Pôr do Sol Dourado / Golden Hour (16:45 - 18:45): Sol gigante laranja-avermelhado atrás do Morro da CDD!
    hour: 17.75,
    zenith: 0x2e1065,
    mid: 0xc026d3,
    horizon: 0xf97316,
    sunGlow: 0xff4500,
    dirColor: 0xfb923c,
    dirInt: 1.72,
    hemiSky: 0xf59e0b,
    hemiGnd: 0x271a38,
    hemiInt: 0.74,
    nightFactor: 0.48
  },
  {
    hour: 18.75,
    zenith: 0x0f172a,
    mid: 0x3b1d5e,
    horizon: 0x7c2d12,
    sunGlow: 0xea580c,
    dirColor: 0x93c5fd,
    dirInt: 0.85,
    hemiSky: 0x3b82f6,
    hemiGnd: 0x1e1b4b,
    hemiInt: 0.64,
    nightFactor: 0.92
  },
  {
    // Noite Azul-Profunda & Luar Prateado (18:45 - 05:30)
    hour: 19.5,
    zenith: 0x060b1e,
    mid: 0x0f1f4b,
    horizon: 0x172b5c,
    sunGlow: 0x1e3a8a,
    dirColor: 0x93c5fd,
    dirInt: 0.78,
    hemiSky: 0x3b82f6,
    hemiGnd: 0x1e1b4b,
    hemiInt: 0.62,
    nightFactor: 1.0
  },
  {
    hour: 24.0,
    zenith: 0x060b1e,
    mid: 0x0f1f4b,
    horizon: 0x172b5c,
    sunGlow: 0x1e3a8a,
    dirColor: 0x93c5fd,
    dirInt: 0.78,
    hemiSky: 0x3b82f6,
    hemiGnd: 0x1e1b4b,
    hemiInt: 0.62,
    nightFactor: 1.0
  }
];

function sampleAtmosphereAtHour(hour24, out) {
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

/**
 * GERENCIADOR CINEMATOGRÁFICO DE CICLO DIA / PÔR DO SOL / NOITE NEON (60 FPS CRAVADOS):
 * - Zero PointLights estáticas espalhadas no mapa: apenas 1 Pool Dinâmico de 4 THREE.PointLight reais (distance=28)!
 * - SkyDome ShaderMaterial + Disco Solar + Lua Cheia LEGO + 1.200 Estrelas Cintilantes!
 * - Milhares de janelas em arranha-céus (emissiveMap) e na Favela CDD ("Presépio Urbano") + InstancedMesh de postes/cones!
 */
export class DayNightAtmosphereManager {
  constructor(world, initialMode = 'auto') {
    this.world = world;
    this.scene = world.scene;
    this.sunLight = world.sunLight;
    this.hemiLight = world.hemiLight;

    // Começa às 15:30 no modo automático para o jogador já ver o Sol da tarde virando Pôr do Sol Dourado e Noite Neon!
    this.timeHours = 15.5;
    this.dayCycleDurationSec = 720.0; // 12 minutos reais = 24h no jogo
    this.timeMode = 'auto';
    this.nightFactor = 0.0;
    this._animTime = 0;

    this._sampled = {
      zenith: new THREE.Color(),
      mid: new THREE.Color(),
      horizon: new THREE.Color(),
      sunGlow: new THREE.Color(),
      dirColor: new THREE.Color(),
      hemiSky: new THREE.Color(),
      hemiGnd: new THREE.Color(),
      _tmp: new THREE.Color(),
      dirInt: 2.2,
      hemiInt: 0.94,
      nightFactor: 0.0
    };

    this._sunDir = new THREE.Vector3(0.4, 0.85, 0.25).normalize();
    this._moonDir = new THREE.Vector3(-0.35, 0.82, -0.25).normalize();
    this._lightOrbitDir = new THREE.Vector3();

    this.lampNodes = [];
    this._lampGrid = new Map();
    this._lampCellSize = 64;

    this.pointLightPool = [];
    this.landmarkNeonMaterials = [];
    this.lighthouseBeams = [];
    this.metroLeadCones = [];

    ensureSharedVehicleLightAssets();
    this._initCelestialSkyDomeStarsSunAndMoon();
    this._initCitywideStreetlampsAndCones();
    this._initLandmarkNeonAndLighthouses();
    this._initMetroNightEnhancements();
    this._initDynamicFourPointLightPool();

    this.setTimeMode(initialMode);
    this.update(0.016, new THREE.Vector3(0, 0.5, -117), null);
  }

  setTimeMode(mode = 'auto') {
    const valid = TIME_MODES.includes(mode) ? mode : 'auto';
    this.timeMode = valid;
    if (valid === 'day') {
      this.timeHours = 12.0;
    } else if (valid === 'sunset') {
      this.timeHours = 17.75;
    } else if (valid === 'night') {
      this.timeHours = 22.0;
    }
  }

  cycleTimeMode() {
    const idx = TIME_MODES.indexOf(this.timeMode);
    const next = TIME_MODES[(idx + 1) % TIME_MODES.length];
    if (next === 'auto') {
      this.timeHours = 15.5;
    }
    this.setTimeMode(next);
    return this.timeMode;
  }

  getFormattedClock() {
    const wrapped = ((this.timeHours % 24) + 24) % 24;
    const hh = Math.floor(wrapped);
    const mm = Math.floor((wrapped - hh) * 60);
    const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

    let icon = '☀';
    if (wrapped >= 18.75 || wrapped < 5.5) {
      icon = '🌙';
    } else if ((wrapped >= 5.5 && wrapped < 7.5) || (wrapped >= 16.75 && wrapped < 18.75)) {
      icon = '🌅';
    }
    return {
      hours: wrapped,
      timeStr,
      icon,
      display: `${icon} ${timeStr}`
    };
  }

  // ============================================================================
  // 1. SKYDOME PROCEDURAL (SHADER LEVE) + SOL + LUA CHEIA LEGO + 1.200 ESTRELAS
  // ============================================================================
  _initCelestialSkyDomeStarsSunAndMoon() {
    this.celestialRoot = new THREE.Group();
    this.celestialRoot.name = 'celestial_sky_root';

    this.skyUniforms = {
      uZenithColor: { value: new THREE.Color(0x1565d8) },
      uMidColor: { value: new THREE.Color(0x429ef5) },
      uHorizonColor: { value: new THREE.Color(0x7ec2fc) },
      uSunGlowColor: { value: new THREE.Color(0xfffbeb) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2).normalize() },
      uGlowStrength: { value: 0.28 }
    };

    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
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
      `
    });

    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(1860, 32, 20), skyMat);
    this.skyDome.renderOrder = -10;
    this.skyDome.frustumCulled = false;
    this.celestialRoot.add(this.skyDome);

    // Campo Estelar com 1.200 Estrelas Cintilantes no Hemisfério Celeste
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const cWhite = new THREE.Color(0xf8fafc);
    const cBlue = new THREE.Color(0xbae6fd);
    const cGold = new THREE.Color(0xfef08a);

    for (let i = 0; i < starCount; i++) {
      const u = ((i * 7919) % 10000) / 10000;
      const v = ((i * 6271) % 10000) / 10000;
      const theta = u * Math.PI * 2;
      const elevation = 0.06 + v * 0.92;
      const rHoriz = Math.sqrt(Math.max(0, 1 - elevation * elevation));
      const rad = 1690;

      starPositions[i * 3] = Math.cos(theta) * rHoriz * rad;
      starPositions[i * 3 + 1] = elevation * rad;
      starPositions[i * 3 + 2] = Math.sin(theta) * rHoriz * rad;

      const pick = i % 5 === 0 ? cGold : i % 3 === 0 ? cBlue : cWhite;
      starColors[i * 3] = pick.r;
      starColors[i * 3 + 1] = pick.g;
      starColors[i * 3 + 2] = pick.b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    this.starMat = new THREE.PointsMaterial({
      size: 6.5,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      fog: false
    });
    this.starPoints = new THREE.Points(starGeo, this.starMat);
    this.starPoints.frustumCulled = false;
    this.starPoints.visible = false;
    this.celestialRoot.add(this.starPoints);

    // Disco Solar Brilhante + Halo Dourado Aditivo
    this.sunDiscGroup = new THREE.Group();
    this.sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb, fog: false, depthWrite: false });
    this.sunHaloMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const sunCore = new THREE.Mesh(new THREE.SphereGeometry(56, 20, 16), this.sunCoreMat);
    const sunHalo = new THREE.Mesh(new THREE.SphereGeometry(118, 20, 16), this.sunHaloMat);
    this.sunDiscGroup.add(sunCore, sunHalo);
    this.sunDiscGroup.frustumCulled = false;
    this.celestialRoot.add(this.sunDiscGroup);

    // Lua Cheia Estilizada LEGO com Crateras de Pino + Halo Azul-Prata Luminoso
    this.moonGroup = new THREE.Group();
    this.moonCoreMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.0,
      fog: false,
      depthWrite: false
    });
    this.moonCraterMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.0,
      fog: false,
      depthWrite: false
    });
    this.moonHaloMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(52, 20, 16), this.moonCoreMat);
    const moonHalo = new THREE.Mesh(new THREE.SphereGeometry(128, 20, 16), this.moonHaloMat);
    const crater1 = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 6, 12), this.moonCraterMat);
    crater1.position.set(-14, 12, 47);
    crater1.rotation.x = Math.PI / 2;
    const crater2 = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 6, 12), this.moonCraterMat);
    crater2.position.set(15, -10, 48);
    crater2.rotation.x = Math.PI / 2;
    this.moonGroup.add(moonDisc, moonHalo, crater1, crater2);
    this.moonGroup.visible = false;
    this.moonGroup.frustumCulled = false;
    this.celestialRoot.add(this.moonGroup);

    this.scene.add(this.celestialRoot);
  }

  // ============================================================================
  // 2. REDE UNIFICADA DE POSTES, VIADUTOS, PONTES, METRÔ, PÍER E FAVELA (3 DRAW CALLS!)
  // ============================================================================
  _initCitywideStreetlampsAndCones() {
    const terrainAt = (x, z) =>
      typeof this.world.getTerrainHeightAt === 'function' ? this.world.getTerrainHeightAt(x, z) : 0;

    // 2.1 Importa todos os postes de madeira e gambiarras registrados pelo FavelaCDDBuilder
    if (Array.isArray(this.world.nightLampRegistry)) {
      for (const n of this.world.nightLampRegistry) {
        this.lampNodes.push(n);
      }
    }

    const physicalPoleLocations = []; // Postes metálicos adicionais para Viadutos, Pontes, Píer e Avenidas

    // 2.2 Postes das Grandes Avenidas do Centro, Subúrbio, Praia e Distrito Leste
    for (const ax of [-384, -252, -120, 0, 120, 252, 384]) {
      for (let az = -760; az <= 680; az += 88) {
        const px = ax + 14.8;
        const gy = terrainAt(px, az) + 0.28;
        physicalPoleLocations.push({ x: px, y: gy, z: az, h: 6.2 });
        this.lampNodes.push({
          x: px - 1.2,
          y: gy + 6.0,
          z: az,
          groundY: gy - 0.22,
          warm: false,
          coneH: 6.1,
          coneR: 4.8
        });
      }
    }

    // 2.3 Luz noturna das luminárias dos viadutos: os postes ficam NA MURETA (construídos pelo próprio viaduto,
    //     `world.viaductLampSpots`), aqui só entra a luz — nada de poste extra no meio das faixas.
    for (const spot of this.world.viaductLampSpots || []) {
      this.lampNodes.push({
        x: spot.x,
        y: spot.y,
        z: spot.z,
        groundY: spot.deckY + 0.04,
        warm: true,
        coneH: 5.2,
        coneR: 4.2
      });
    }

    // 2.4 Postes nas 9 Pontes em Arco sobre o Rio Urbano Leste!
    for (const br of RIVER_BRIDGE_SPECS) {
      for (const bx of [540, 560, 580]) {
        const u = (bx - br.xStart) / (br.xEnd - br.xStart);
        const archY = Math.sin(u * Math.PI) * br.archHeight;
        for (const side of [-1, 1]) {
          const pz = br.z + side * (br.width * 0.5 - 1.2);
          physicalPoleLocations.push({ x: bx, y: archY, z: pz, h: 5.0 });
          this.lampNodes.push({
            x: bx,
            y: archY + 4.9,
            z: pz - side * 1.0,
            groundY: archY + 0.08,
            warm: true,
            coneH: 4.85,
            coneR: 3.9
          });
        }
      }
    }

    // 2.5 Iluminação das 3 Estações Elevadas do Metrô (+14.85m) & Calçadão/Píer da Roda-Gigante!
    const elevatedStations = [
      { x: -384, z: -180, axis: 'z' },
      { x: 0, z: 134, axis: 'x' },
      { x: 384, z: -117, axis: 'z' }
    ];
    for (const st of elevatedStations) {
      for (const off of [-20, 0, 20]) {
        const lx = st.axis === 'x' ? st.x + off : st.x;
        const lz = st.axis === 'z' ? st.z + off : st.z;
        this.lampNodes.push({
          x: lx,
          y: 22.8,
          z: lz,
          groundY: 14.9,
          warm: false,
          coneH: 7.9,
          coneR: 5.8
        });
      }
    }

    for (let pz = 1045; pz <= 1525; pz += 48) {
      for (const side of [-11.5, 11.5]) {
        physicalPoleLocations.push({ x: side, y: 1.5, z: pz, h: 5.0 });
        this.lampNodes.push({
          x: side * 0.85,
          y: 6.4,
          z: pz,
          groundY: 1.55,
          warm: true,
          coneH: 4.85,
          coneR: 4.2
        });
      }
    }

    // Indexa todos os nós de poste numa Grade Espacial O(1) para o Pool de 4 PointLights!
    for (const node of this.lampNodes) {
      const gx = Math.floor(node.x / this._lampCellSize);
      const gz = Math.floor(node.z / this._lampCellSize);
      const key = `${gx},${gz}`;
      let list = this._lampGrid.get(key);
      if (!list) {
        list = [];
        this._lampGrid.set(key, list);
      }
      list.push(node);
    }

    // Constrói 1 InstancedMesh único para as hastes metálicas dos postes extras (Viadutos, Pontes, Avenidas, Píer)
    const dummy = new THREE.Object3D();
    if (physicalPoleLocations.length > 0) {
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.0, 8);
      poleGeo.translate(0, 0.5, 0);
      const poleInst = new THREE.InstancedMesh(
        poleGeo,
        getLegoMaterial(0x334155, { metalness: 0.5, roughness: 0.3 }),
        physicalPoleLocations.length
      );
      physicalPoleLocations.forEach((p, idx) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(1, p.h, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        poleInst.setMatrixAt(idx, dummy.matrix);
      });
      poleInst.instanceMatrix.needsUpdate = true;
      this.scene.add(poleInst);
    }

    // Constrói os 3 InstancedMeshes Globais Noturnos: Bulbos + Cones Volumétricos + Discos no Asfalto!
    const count = this.lampNodes.length;
    const bulbGeo = new THREE.SphereGeometry(0.32, 8, 6);
    const coneGeo = new THREE.ConeGeometry(1.0, 1.0, 12, 1, true);
    coneGeo.translate(0, -0.5, 0);
    const poolGeo = new THREE.CircleGeometry(1.0, 14);
    poolGeo.rotateX(-Math.PI / 2);

    this.bulbInstMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.coneInstMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.poolInstMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.bulbInstMesh = new THREE.InstancedMesh(bulbGeo, this.bulbInstMat, count);
    this.coneInstMesh = new THREE.InstancedMesh(coneGeo, this.coneInstMat, count);
    this.poolInstMesh = new THREE.InstancedMesh(poolGeo, this.poolInstMat, count);

    const warmCol = new THREE.Color(0xfbbf24);
    const coolCol = new THREE.Color(0xe0f2fe);

    this.lampNodes.forEach((n, idx) => {
      const col = n.warm ? warmCol : coolCol;

      dummy.position.set(n.x, n.y, n.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      this.bulbInstMesh.setMatrixAt(idx, dummy.matrix);
      this.bulbInstMesh.setColorAt(idx, col);

      dummy.position.set(n.x, n.y, n.z);
      dummy.scale.set(n.coneR || 4.2, n.coneH || 5.4, n.coneR || 4.2);
      dummy.updateMatrix();
      this.coneInstMesh.setMatrixAt(idx, dummy.matrix);
      this.coneInstMesh.setColorAt(idx, col);

      dummy.position.set(n.x, n.groundY + 0.06, n.z);
      dummy.scale.set((n.coneR || 4.2) * 1.15, 1, (n.coneR || 4.2) * 1.15);
      dummy.updateMatrix();
      this.poolInstMesh.setMatrixAt(idx, dummy.matrix);
      this.poolInstMesh.setColorAt(idx, col);
    });

    this.bulbInstMesh.instanceMatrix.needsUpdate = true;
    this.coneInstMesh.instanceMatrix.needsUpdate = true;
    this.poolInstMesh.instanceMatrix.needsUpdate = true;
    if (this.bulbInstMesh.instanceColor) this.bulbInstMesh.instanceColor.needsUpdate = true;
    if (this.coneInstMesh.instanceColor) this.coneInstMesh.instanceColor.needsUpdate = true;
    if (this.poolInstMesh.instanceColor) this.poolInstMesh.instanceColor.needsUpdate = true;

    this.bulbInstMesh.frustumCulled = false;
    this.coneInstMesh.frustumCulled = false;
    this.poolInstMesh.frustumCulled = false;

    this.bulbInstMesh.visible = false;
    this.coneInstMesh.visible = false;
    this.poolInstMesh.visible = false;

    this.scene.add(this.bulbInstMesh, this.coneInstMesh, this.poolInstMesh);
  }

  // ============================================================================
  // 3. BRILHO NEON NOTURNO NOS MARCOS ICÔNICOS (RODA-GIGANTE, TORRE "H", BANCO, TIMES SQ., FARÓIS)
  // ============================================================================
  _initLandmarkNeonAndLighthouses() {
    const makeNeonHaloMat = (hex, maxOp = 0.42) => {
      const mat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      mat.userData.maxOpacity = maxOp;
      this.landmarkNeonMaterials.push(mat);
      return mat;
    };

    // 3.1 Roda-Gigante da Praia Sul: Aros Neon Magenta & Ciano que giram junto com a roda!
    if (this.world.ferrisWheelGroup) {
      const fwNeonCyan = makeNeonHaloMat(0x00f0ff, 0.55);
      const fwNeonPink = makeNeonHaloMat(0xec4899, 0.52);
      for (const rx of [-4.1, 4.1]) {
        const outerGlow = new THREE.Mesh(new THREE.TorusGeometry(32.0, 1.35, 10, 40), fwNeonCyan);
        outerGlow.rotation.y = Math.PI / 2;
        outerGlow.position.x = rx;
        const innerGlow = new THREE.Mesh(new THREE.TorusGeometry(20.0, 1.15, 10, 32), fwNeonPink);
        innerGlow.rotation.y = Math.PI / 2;
        innerGlow.position.x = rx * 0.9;
        this.world.ferrisWheelGroup.add(outerGlow, innerGlow);
      }
    }

    // 3.2 Emblema "H" Colossal da Torre dos Heróis (-318, -180, Y = 255m) + Cúpula Solar (Y = 306m)
    const heroHaloMat = makeNeonHaloMat(0x00f0ff, 0.45);
    const heroCrownGlow = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 42, 16, 1, true), heroHaloMat);
    heroCrownGlow.position.set(-318, 258, -180);
    this.scene.add(heroCrownGlow);

    // 3.3 Fachada Dourada do Super Banco Central (X = 0, Z = -134) + Painéis Neon de Times Square (X = -60, Z = -10)
    const bankGlowMat = makeNeonHaloMat(0xfacc15, 0.32);
    const bankUplight = new THREE.Mesh(new THREE.BoxGeometry(88, 28, 6), bankGlowMat);
    bankUplight.position.set(0, 15, -133);
    this.scene.add(bankUplight);

    const tsGlowMat = makeNeonHaloMat(0xd946ef, 0.28);
    const tsHalo = new THREE.Mesh(new THREE.CylinderGeometry(28, 34, 32, 16, 1, true), tsGlowMat);
    tsHalo.position.set(-60, 18, -8);
    this.scene.add(tsHalo);

    // 3.4 Feixes Giratórios dos 2 Faróis Marítimos (Píer Sul Z=1552 e Costão Sudoeste X=-1735, Z=945)
    const lhBeamGeo = new THREE.ConeGeometry(12.0, 135.0, 14, 1, true);
    lhBeamGeo.rotateX(-Math.PI / 2);
    lhBeamGeo.translate(0, 0, 67.5);
    const lhMat = makeNeonHaloMat(0xfef08a, 0.34);

    for (const [lx, ly, lz, spd] of [
      [0, 34.2, 1552, 0.85],
      [-1735, 66.8, 945, -0.72]
    ]) {
      const pivot = new THREE.Group();
      pivot.position.set(lx, ly, lz);
      const b1 = new THREE.Mesh(lhBeamGeo, lhMat);
      const b2 = new THREE.Mesh(lhBeamGeo, lhMat);
      b2.rotation.y = Math.PI;
      pivot.add(b1, b2);
      pivot.visible = false;
      this.scene.add(pivot);
      this.lighthouseBeams.push({ pivot, speed: spd });
    }
  }

  // ============================================================================
  // 4. VAGÕES DO METRÔ ILUMINADOS À NOITE + FARÓIS DIANTEIROS NOS TRENS
  // ============================================================================
  _initMetroNightEnhancements() {
    const ms = this.world.metroSystem;
    if (!ms || !Array.isArray(ms.trains)) return;

    for (const tr of ms.trains) {
      const leadCar = tr.cars?.[0];
      if (!leadCar?.group) continue;

      // Encontra o material de vidro compartilhado dos vagões para acender o interior à noite
      leadCar.group.traverse((child) => {
        if (child.isMesh && child.material?.transparent && !this._metroGlassMat) {
          this._metroGlassMat = child.material;
          if (!this._metroGlassMat.emissive) {
            this._metroGlassMat.emissive = new THREE.Color(0xfef08a);
          } else {
            this._metroGlassMat.emissive.setHex(0xfef08a);
          }
          this._metroGlassMat.emissiveIntensity = 0;
        }
      });

      const coneGroup = new THREE.Group();
      for (const sx of [-1.25, 1.25]) {
        const cone = new THREE.Mesh(SHARED_HEADLIGHT_CONE_GEO, SHARED_HEADLIGHT_CONE_MAT);
        cone.position.set(sx, 1.35, 6.85);
        cone.scale.set(1.35, 1.35, 1.65);
        coneGroup.add(cone);
      }
      coneGroup.visible = false;
      leadCar.group.add(coneGroup);
      this.metroLeadCones.push(coneGroup);
    }
  }

  // ============================================================================
  // 5. POOL DINÂMICO DE APENAS 4 THREE.PointLight REAIS (SEM SOMBRA, DISTANCE = 28)
  //    (Mantidas sempre na cena com intensity=0 de dia -> ZERO recompilação de shader!)
  // ============================================================================
  _initDynamicFourPointLightPool() {
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0xfbbf24, 0.0, 28.0, 1.6);
      pl.castShadow = false;
      pl.position.set(0, -500, 0);
      this.scene.add(pl);
      this.pointLightPool.push(pl);
    }
  }

  _updateClosestFourPointLights(playerPos, nightFactor) {
    if (!playerPos || nightFactor <= 0.05) {
      for (const pl of this.pointLightPool) {
        pl.intensity = 0.0;
      }
      return;
    }

    const gx = Math.floor(playerPos.x / this._lampCellSize);
    const gz = Math.floor(playerPos.z / this._lampCellSize);

    // Mantém os 4 nós mais próximos sem alocar arrays nem ordenar listas grandes
    let b0 = null, b1 = null, b2 = null, b3 = null;
    let d0 = Infinity, d1 = Infinity, d2 = Infinity, d3 = Infinity;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cell = this._lampGrid.get(`${gx + dx},${gz + dz}`);
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const n = cell[i];
          const distSq =
            (n.x - playerPos.x) * (n.x - playerPos.x) +
            (n.y - playerPos.y) * (n.y - playerPos.y) * 0.5 +
            (n.z - playerPos.z) * (n.z - playerPos.z);

          if (distSq < d0) {
            d3 = d2; b3 = b2;
            d2 = d1; b2 = b1;
            d1 = d0; b1 = b0;
            d0 = distSq; b0 = n;
          } else if (distSq < d1) {
            d3 = d2; b3 = b2;
            d2 = d1; b2 = b1;
            d1 = distSq; b1 = n;
          } else if (distSq < d2) {
            d3 = d2; b3 = b2;
            d2 = distSq; b2 = n;
          } else if (distSq < d3) {
            d3 = distSq; b3 = n;
          }
        }
      }
    }

    const best = [b0, b1, b2, b3];
    for (let i = 0; i < 4; i++) {
      const pl = this.pointLightPool[i];
      const node = best[i];
      if (node) {
        pl.position.set(node.x, node.y - 0.35, node.z);
        pl.color.setHex(node.warm ? 0xfbbf24 : 0xbae6fd);
        pl.intensity = nightFactor * 2.15;
      } else {
        pl.intensity = 0.0;
      }
    }
  }

  // ============================================================================
  // 6. ATUALIZAÇÃO POR FRAME (60 FPS CRAVADOS)
  // ============================================================================
  update(dt, playerPos = null, controller = null) {
    this._animTime += dt;

    if (this.timeMode === 'auto') {
      this.timeHours = (this.timeHours + (dt / this.dayCycleDurationSec) * 24.0) % 24.0;
    }

    const s = this._sampled;
    sampleAtmosphereAtHour(this.timeHours, s);
    this.nightFactor = s.nightFactor;
    const nf = this.nightFactor;

    // 1) Calcula trajetória orbital do Sol (Nasce a Leste +X às 06:00 -> Zênite às 12:00 -> Põe-se a Oeste -X atrás da CDD às 18:00!)
    const sunAngle = ((this.timeHours - 6.0) / 12.0) * Math.PI;
    const sunX = Math.cos(sunAngle); // +1 Leste (06h) -> 0 (12h) -> -1 Oeste atrás da CDD (18h)
    const sunY = Math.sin(sunAngle); // 0 horizonte -> +1 meio-dia -> 0 pôr do sol -> negativo à noite
    this._sunDir.set(sunX, sunY, 0.24).normalize();

    // Lua Cheia sobe alta no céu noturno projetando sombras prateadas legíveis!
    const moonElev = Math.max(0.42, -sunY * 0.85 + 0.25);
    this._moonDir.set(-sunX * 0.65, moonElev, 0.38).normalize();

    // 2) Atualiza SkyDome, Fog, Sol, Lua LEGO e as 1.200 Estrelas
    const anchorX = playerPos ? playerPos.x : 0;
    const anchorZ = playerPos ? playerPos.z : 0;
    this.celestialRoot.position.set(anchorX, 0, anchorZ);

    this.skyUniforms.uZenithColor.value.copy(s.zenith);
    this.skyUniforms.uMidColor.value.copy(s.mid);
    this.skyUniforms.uHorizonColor.value.copy(s.horizon);
    this.skyUniforms.uSunGlowColor.value.copy(s.sunGlow);
    this.skyUniforms.uSunDir.value.copy(this._sunDir);
    const isGoldenHour = this.timeHours >= 16.4 && this.timeHours <= 18.85;
    const isSunrise = this.timeHours >= 5.3 && this.timeHours <= 7.6;
    this.skyUniforms.uGlowStrength.value = isGoldenHour ? 0.68 : isSunrise ? 0.52 : nf > 0.8 ? 0.08 : 0.26;

    if (this.scene.fog) {
      this.scene.fog.color.copy(s.horizon);
    }
    if (this.scene.background && this.scene.background.isColor) {
      this.scene.background.copy(s.horizon);
    }

    // Disco Solar (cresce 1.48x e fica laranja-rubro no Pôr do Sol atrás do Morro da Cidade de Deus!)
    this.sunDiscGroup.visible = sunY > -0.14;
    if (this.sunDiscGroup.visible) {
      this.sunDiscGroup.position.copy(this._sunDir).multiplyScalar(1580);
      const sunScale = isGoldenHour || isSunrise ? 1.48 : 1.0;
      this.sunDiscGroup.scale.setScalar(sunScale);
      this.sunCoreMat.color.copy(isGoldenHour ? s.sunGlow : s.dirColor);
      this.sunHaloMat.color.copy(s.sunGlow);
      this.sunHaloMat.opacity = isGoldenHour ? 0.62 : 0.36;
    }

    // Lua Cheia LEGO + 1.200 Estrelas Cintilantes
    this.moonGroup.visible = nf > 0.06;
    if (this.moonGroup.visible) {
      this.moonGroup.position.copy(this._moonDir).multiplyScalar(1520);
      this.moonGroup.lookAt(anchorX, 0, anchorZ);
      this.moonCoreMat.opacity = nf;
      this.moonCraterMat.opacity = nf * 0.75;
      this.moonHaloMat.opacity = nf * 0.42;
    }

    this.starPoints.visible = nf > 0.08;
    if (this.starPoints.visible) {
      const twinkle = 0.88 + Math.sin(this._animTime * 2.2) * 0.12;
      this.starMat.opacity = Math.max(0, (nf - 0.08) / 0.92) * 0.92 * twinkle;
      this.starPoints.rotation.y += dt * 0.004;
    }

    // 3) Atualiza Luz Direcional (Sol de dia / Pôr do Sol longo / Lua Cheia 0x93c5fd 0.78 à noite!) + HemisphereLight
    if (this.hemiLight) {
      this.hemiLight.color.copy(s.hemiSky);
      this.hemiLight.groundColor.copy(s.hemiGnd);
      this.hemiLight.intensity = s.hemiInt;
    }

    if (this.sunLight) {
      this.sunLight.color.copy(s.dirColor);
      this.sunLight.intensity = s.dirInt;

      const activeLightDir = sunY > 0.06 ? this._sunDir : this._moonDir;
      this._lightOrbitDir.copy(activeLightDir);
      this._lightOrbitDir.y = Math.max(0.22, this._lightOrbitDir.y); // Sombras longas lindas no pôr do sol sem achatar!
      this._lightOrbitDir.normalize();

      const targetX = playerPos ? playerPos.x : 0;
      const targetY = playerPos ? playerPos.y : 0;
      const targetZ = playerPos ? playerPos.z : 0;
      this.sunLight.position.set(
        targetX + this._lightOrbitDir.x * 260,
        targetY + this._lightOrbitDir.y * 260,
        targetZ + this._lightOrbitDir.z * 260
      );
      this.sunLight.target.position.set(targetX, targetY, targetZ);
      this.sunLight.target.updateMatrixWorld();
    }

    // 4) Iluminação Artificial dos 135 Arranha-Céus (emissiveMap) e da Favela CDD ("Presépio Urbano" até 1.6!)
    const facadeMats = getCachedFacadeMaterials();
    const skyWinIntensity = nf * 1.45;
    for (let i = 0; i < facadeMats.length; i++) {
      facadeMats[i].emissiveIntensity = skyWinIntensity;
    }

    if (this.world.favelaEmissiveMats) {
      const favWinInt = nf * 1.6;
      for (const m of this.world.favelaEmissiveMats.windows) {
        if (m) m.emissiveIntensity = favWinInt;
      }
      for (const m of this.world.favelaEmissiveMats.bulbs) {
        if (m) m.emissiveIntensity = 0.2 + nf * 1.8;
      }
    }

    // 5) Postes Instanciados (Avenidas, Favela, Viadutos, Pontes, Píer, Metrô) + Marcos da CDD e Orla
    const lampsOn = nf > 0.05;
    this.bulbInstMesh.visible = lampsOn;
    this.coneInstMesh.visible = lampsOn;
    this.poolInstMesh.visible = lampsOn;
    if (lampsOn) {
      this.coneInstMat.opacity = nf * 0.22;
      this.poolInstMat.opacity = nf * 0.34;
    }

    // Campinho da CDD (4 Refletores), Baile do Morro (3 Skytrackers giratórios) & Luzes Aeronáuticas no Topo!
    if (Array.isArray(this.world.favelaSoccerFloodCones)) {
      for (const fc of this.world.favelaSoccerFloodCones) {
        fc.mesh.visible = nf > 0.08;
        fc.mat.opacity = nf * 0.24;
      }
    }
    if (Array.isArray(this.world.favelaBaileSkytrackers)) {
      for (const st of this.world.favelaBaileSkytrackers) {
        st.pivot.visible = nf > 0.08;
        if (st.pivot.visible) {
          st.mat.opacity = nf * 0.28;
          st.pivot.rotation.z = Math.sin(this._animTime * 0.9 + st.phase) * 0.38;
          st.pivot.rotation.x = Math.cos(this._animTime * 0.72 + st.phase) * 0.32;
        }
      }
    }
    if (Array.isArray(this.world.favelaSummitBeacons)) {
      for (const sb of this.world.favelaSummitBeacons) {
        const blink = Math.sin(this._animTime * 5.2 + sb.phase) > -0.15;
        sb.group.visible = nf > 0.05 ? blink : true;
        sb.haloMat.opacity = nf > 0.05 && blink ? 0.85 : 0.15;
      }
    }

    for (const mat of this.landmarkNeonMaterials) {
      mat.opacity = nf * (mat.userData.maxOpacity || 0.38);
    }
    for (const lb of this.lighthouseBeams) {
      lb.pivot.visible = nf > 0.1;
      if (lb.pivot.visible) {
        lb.pivot.rotation.y += dt * lb.speed;
      }
    }

    // 6) Trens do Metrô + Faróis de Todos os Veículos em Movimento & Carro do Jogador!
    const vehicleLightsOn = nf > 0.15;
    SHARED_HEADLIGHT_CONE_MAT.opacity = vehicleLightsOn ? nf * 0.32 : 0.0;
    SHARED_TAILLIGHT_GLOW_MAT.opacity = vehicleLightsOn ? nf * 0.92 : 0.0;

    if (this._metroGlassMat) {
      this._metroGlassMat.emissiveIntensity = nf * 1.15;
    }
    for (const mc of this.metroLeadCones) {
      mc.visible = vehicleLightsOn;
    }

    this._updateAllVehicleHeadlights(playerPos, controller, vehicleLightsOn);
    this._updateClosestFourPointLights(playerPos, nf);
  }

  _updateAllVehicleHeadlights(playerPos, controller, vehicleLightsOn) {
    const drivenObj = controller?.currentVehicle || null;
    if (drivenObj && drivenObj.mesh && !drivenObj.destroyed) {
      const rig = ensureVehicleNightLights(drivenObj.mesh, drivenObj.mesh.userData?.vehicleSpec);
      if (rig) rig.visible = vehicleLightsOn;
      this._lastDrivenRig = rig;
    } else if (this._lastDrivenRig) {
      this._lastDrivenRig.visible = false;
      this._lastDrivenRig = null;
    }

    const lc = this.world.livingCity;
    if (!lc) return;

    // Faróis e lanternas nos carros em movimento do Trânsito Urbano (culling suave a 220m para 60 FPS!)
    if (Array.isArray(lc.trafficVehicles)) {
      for (let i = 0; i < lc.trafficVehicles.length; i++) {
        const tv = lc.trafficVehicles[i];
        if (!tv.mesh || !tv.destructible || tv.destructible.destroyed) continue;
        if (tv.destructible === drivenObj) continue;

        const rig = ensureVehicleNightLights(tv.mesh, tv.spec);
        if (!rig) continue;

        if (!vehicleLightsOn || tv.hijackedByPlayer) {
          rig.visible = false;
          continue;
        }
        if (playerPos) {
          const dx = tv.mesh.position.x - playerPos.x;
          const dz = tv.mesh.position.z - playerPos.z;
          rig.visible = dx * dx + dz * dz < 220 * 220;
        } else {
          rig.visible = true;
        }
      }
    }

    // Faróis nos Comboios Motorizados da Guerra Territorial quando ativos à noite!
    if (lc.factionWar && Array.isArray(lc.factionWar.activeConvoyDrops)) {
      for (const cv of lc.factionWar.activeConvoyDrops) {
        if (!cv.mesh) continue;
        const rig = ensureVehicleNightLights(cv.mesh, cv.mesh.userData?.vehicleSpec);
        if (rig) rig.visible = vehicleLightsOn;
      }
    }
  }
}

