import * as THREE from 'three';
import { makeFastBox, flushSpatialChunkedBuckets } from '../../BuildingGenerator.js';

/**
 * FUNÇÃO MATEMÁTICA CONTÍNUA DE RELEVO DO MORRO DA CIDADE DE DEUS (`getFavelaElevation(x, z)`):
 * - PROIBIDO "blocão marrom" com paredão vertical!
 * - Nas bordas da Favela (onde encosta nas ruas da Cidade a Leste, Subúrbio/Platô Boreal ao Norte, Orla ao Sul e Aeroporto a Oeste),
 *   a altura começa EXATAMENTE em Y = 0 (no nível da rua, sem degrau brusco!) e sobe suavemente em curva de sino/cosseno
 *   como uma ladeira real até chegar a Y ≈ 43m no cume do morro!
 */
export function getFavelaEastBorderX(z) {
  if (z >= -490 && z <= 400) return -528;
  if (z < -1318) {
    const tNorth = THREE.MathUtils.clamp((-1318 - z) / 500, 0, 1);
    return THREE.MathUtils.lerp(-658, -715, 0.5 * (1 - Math.cos(Math.PI * tNorth)));
  }
  if (z < -525 || z > 435) return -658;
  if (z < -490) {
    const t = (-490 - z) / 35; // 0 em -490 -> 1 em -525
    const s = 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp(t, 0, 1)));
    return THREE.MathUtils.lerp(-528, -658, s);
  }
  const t = (z - 400) / 35; // 0 em +400 -> 1 em +435
  const s = 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp(t, 0, 1)));
  return THREE.MathUtils.lerp(-528, -658, s);
}

export function getFavelaElevation(x, z) {
  const zNorth = -1820;
  const zSouth = 675;
  if (z <= zNorth || z >= zSouth) return 0;

  const xEast = getFavelaEastBorderX(z);
  const xWest = -1012;
  if (x >= xEast || x <= xWest) return 0;

  // 1. Perfil Leste-Oeste suave (u = 0 na rua da Cidade Y=0 -> pico em u = 0.70 -> u = 1 na borda do Aeroporto Y=0)
  const u = (xEast - x) / (xEast - xWest);
  const peakU = 0.70;
  let profileX = 0;
  if (u <= peakU) {
    const t = u / peakU;
    // Curva de cosseno elevada suave partindo exatamente de Y = 0 com derivada zero na beira do asfalto!
    profileX = 0.5 * (1 - Math.cos(Math.PI * t));
  } else {
    const t = (u - peakU) / (1 - peakU);
    profileX = 0.5 * (1 + Math.cos(Math.PI * t));
  }

  // 2. Perfil Norte-Sul suave (0 nas extremidades zNorth/zSouth -> 1 ao longo da cordilheira central do Morro)
  let profileZ = 1.0;
  const rampLenZ = 145;
  if (z < zNorth + rampLenZ) {
    const tz = (z - zNorth) / rampLenZ;
    profileZ = 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp(tz, 0, 1)));
  } else if (z > zSouth - rampLenZ) {
    const tz = (zSouth - z) / rampLenZ;
    profileZ = 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp(tz, 0, 1)));
  }

  // 3. Ondulação orgânica natural da crista do morro (mais alta no Cume do Barão Vermelho em Z ≈ -240)
  const summitBoost = Math.exp(-Math.pow((z + 240) / 280, 2)) * 5.5;
  const ridgeWave = Math.sin(z * 0.0085) * 2.2 + Math.cos(x * 0.015 + z * 0.006) * 1.2;
  const basePeakH = 38.5 + summitBoost + ridgeWave * profileX;

  let h = Math.max(0, basePeakH * profileX * profileZ);

  // 4. Suavização local para os 3 platôs comunitários (integrados suavemente na ladeira, sem degrau!):
  // 4.1 Campinho de Futebol da CDD (X = -605, Z = +195 -> Y ≈ 11.5m)
  const dSoccer = Math.hypot((x - -605) / 34, (z - 195) / 46);
  if (dSoccer < 1.35) {
    const w = dSoccer <= 0.78 ? 1.0 : 0.5 * (1 + Math.cos(Math.PI * ((dSoccer - 0.78) / 0.57)));
    h = THREE.MathUtils.lerp(h, 11.5, w);
  }

  // 4.2 Quadra do Baile do CV & Paredão (X = -715, Z = -135 -> Y ≈ 25.0m)
  const dBaile = Math.hypot((x - -715) / 36, (z - -135) / 42);
  if (dBaile < 1.35) {
    const w = dBaile <= 0.78 ? 1.0 : 0.5 * (1 + Math.cos(Math.PI * ((dBaile - 0.78) / 0.57)));
    h = THREE.MathUtils.lerp(h, 25.0, w);
  }

  // 4.3 Topo do Morro — Fortaleza do Barão Vermelho & Caixa d'Água Comunitária (X = -865, Z = -240 -> Y ≈ 42.5m)
  const dSummit = Math.hypot((x - -865) / 42, (z - -240) / 56);
  if (dSummit < 1.35) {
    const w = dSummit <= 0.8 ? 1.0 : 0.5 * (1 + Math.cos(Math.PI * ((dSummit - 0.8) / 0.55)));
    h = THREE.MathUtils.lerp(h, 42.5, w);
  }

  // 5. Corte Viário / Cânion estilo Linha Amarela em `Z = 0` (`|z| < 30`) para passagem limpa do Viaduto Expresso Oeste (`Y = +9.2m`)!
  const absZ = Math.abs(z);
  if (absZ < 30.0) {
    if (absZ <= 14.5) {
      return 0;
    }
    const passT = (absZ - 14.5) / 15.5;
    const passWeight = 0.5 * (1 - Math.cos(Math.PI * THREE.MathUtils.clamp(passT, 0, 1)));
    h *= passWeight;
  }

  return h;
}

/**
 * Trajetórias das Ladeiras Tortas / Ruelas de Cimento que sobem serpenteando pela encosta do Morro
 * a partir das Bocas de Entrada (onde terminam as ruas da cidade em Y = 0) até o cume!
 */
export const WINDING_LADEIRAS = [
  { zStart: -1680, amp1: 20, freq1: 0.015, amp2: -12, freq2: 0.009, hasStairs: true },
  { zStart: -1520, amp1: -22, freq1: 0.016, amp2: 14, freq2: 0.008, hasStairs: false },
  { zStart: -1360, amp1: 24, freq1: 0.015, amp2: -12, freq2: 0.010, hasStairs: true },
  { zStart: -1190, amp1: 22, freq1: 0.015, amp2: -14, freq2: 0.009, hasStairs: true },
  { zStart: -1030, amp1: -25, freq1: 0.016, amp2: 15, freq2: 0.008, hasStairs: false },
  { zStart: -840, amp1: 26, freq1: 0.015, amp2: -12, freq2: 0.010, hasStairs: true },
  { zStart: -640, amp1: 24, freq1: 0.016, amp2: -14, freq2: 0.009, hasStairs: true },
  { zStart: -382, amp1: -28, freq1: 0.015, amp2: 18, freq2: 0.008, hasStairs: false },
  { zStart: -250, amp1: 22, freq1: 0.017, amp2: -12, freq2: 0.010, hasStairs: true },
  { zStart: -117, amp1: -24, freq1: 0.014, amp2: -16, freq2: 0.008, hasStairs: false },
  { zStart: 36, amp1: 28, freq1: 0.015, amp2: 14, freq2: 0.009, hasStairs: true },
  { zStart: 134, amp1: -22, freq1: 0.016, amp2: 15, freq2: 0.009, hasStairs: false },
  { zStart: 380, amp1: 26, freq1: 0.015, amp2: -16, freq2: 0.008, hasStairs: true },
  { zStart: 540, amp1: -24, freq1: 0.016, amp2: 12, freq2: 0.010, hasStairs: true }
];

export function getLadeiraZAtX(ladeira, x) {
  const xEast = getFavelaEastBorderX(ladeira.zStart);
  const dx = Math.max(0, xEast - x);
  return (
    ladeira.zStart +
    Math.sin(dx * ladeira.freq1) * ladeira.amp1 +
    Math.sin(dx * ladeira.freq2) * ladeira.amp2
  );
}

/**
 * Acumulador de Geometrias 3D do Complexo da Cidade de Deus (Morro do CV):
 * Mantém 60 FPS cravados fundindo os aglomerados densos de barracos colados parede com parede,
 * alicerces de concreto, caixas d'água azuis, ruelas tortas, fiação e Paredão em ~24 Draw Calls!
 */
export class FavelaBatcher {
  constructor() {
    this.buckets = new Map();
    this.materials = new Map();
    this._initMaterials();
  }

  _registerMat(key, colorHex, opts = {}) {
    this.buckets.set(key, []);
    if (opts.basic) {
      this.materials.set(key, new THREE.MeshBasicMaterial({ color: colorHex }));
    } else {
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: opts.roughness ?? 0.52,
          metalness: opts.metalness ?? 0.05,
          emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
          emissiveIntensity: opts.emissiveIntensity ?? 0
        })
      );
    }
  }

  _initMaterials() {
    // 1. Alicerces de Concreto Escuro Úmido, Becos, Ladeiras Tortas e Vegetação Sombria de Encosta
    this._registerMat('retaining_concrete', 0x333a47, { roughness: 0.76 });
    this._registerMat('alley_cement', 0x242a35, { roughness: 0.82 });
    this._registerMat('hill_bush', 0x162e1d, { roughness: 0.72 });

    // 2. Paredes dos Barracos e Sobrados Colados (Tijolo Queimado Escuro, Cimento Cru Úmido e Zinco Oxidado)
    this._registerMat('brick_baiano', 0x7c2d12, { roughness: 0.72 });
    this._registerMat('brick_baiano_light', 0x9a3412, { roughness: 0.68 });
    this._registerMat('brick_groove', 0x3b1308, { roughness: 0.82 });
    this._registerMat('cement_raw', 0x424854, { roughness: 0.76 });
    this._registerMat('cement_slab', 0x525a69, { roughness: 0.7 });
    this._registerMat('zinc_roof', 0x4b5563, { roughness: 0.54, metalness: 0.45 });
    this._registerMat('rebar_iron', 0x1c1f26, { roughness: 0.52, metalness: 0.62 });

    // 3. Identidade Visual Sombria do Comando Vermelho (CV) + Reboco Envelhecido
    this._registerMat('cv_red', 0x991b1b, { roughness: 0.52 });
    this._registerMat('cv_dark_red', 0x5c1111, { roughness: 0.58 });
    this._registerMat('cv_black', 0x080a0e, { roughness: 0.54 });
    this._registerMat('cv_white', 0x8f98a6, { roughness: 0.64 });
    this._registerMat('favela_blue_faded', 0x1e4761, { roughness: 0.64 });
    this._registerMat('favela_yellow_faded', 0x8a5b14, { roughness: 0.64 });

    // 4. Caixas d'Água Desbotadas, Janelas Emissivas Noturnas, Sacos de Areia, Fiação e Neon do Baile
    this._registerMat('water_tank_blue', 0x0e5470, { roughness: 0.46 });
    this._registerMat('water_tank_lid', 0x093b52, { roughness: 0.5 });
    this._registerMat('window_lit', 0x78350f, {
      roughness: 0.24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.0
    });
    this._registerMat('window_orange', 0x5c220e, {
      roughness: 0.24,
      emissive: 0xd97706,
      emissiveIntensity: 0.0
    });
    this._registerMat('window_tv_blue', 0x0a344f, {
      roughness: 0.2,
      emissive: 0x7dd3fc,
      emissiveIntensity: 0.0
    });
    this._registerMat('window_dark', 0x0f141d, { roughness: 0.3 });
    this._registerMat('favela_bulb_warm', 0xfde68a, {
      roughness: 0.22,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.25
    });
    this._registerMat('floodlight_panel', 0xe2e8f0, {
      roughness: 0.2,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.2
    });
    this._registerMat('sandbag_tan', 0x78716c, { roughness: 0.82 });
    this._registerMat('wood_pole', 0x2e1506, { roughness: 0.74 });
    this._registerMat('wire_black', 0x06070a, { basic: true });
    this._registerMat('varzea_dirt', 0x5c2d0e, { roughness: 0.84 });
    this._registerMat('varzea_grass', 0x16331f, { roughness: 0.74 });
    this._registerMat('fence_mesh', 0x4b5563, { roughness: 0.48, metalness: 0.52 });
    this._registerMat('pool_water', 0x0e5a70, {
      roughness: 0.14,
      emissive: 0x084c61,
      emissiveIntensity: 0.28
    });
    this._registerMat('neon_red', 0xe11d48, { basic: true });
    this._registerMat('neon_gold', 0xd99b16, { basic: true });
    this._registerMat('neon_cyan', 0x06b6d4, { basic: true });
  }

  addBox(key, w, h, d, x, y, z) {
    const list = this.buckets.get(key);
    if (list) {
      list.push(makeFastBox(w, h, d, x, y, z));
    }
  }

  addSlopedBox(key, w, h, d, x, y, z, rotX = 0, rotZ = 0) {
    const list = this.buckets.get(key);
    if (!list) return;
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotX) g.rotateX(rotX);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(x, y, z);
    list.push(g);
  }

  addCylinder(key, rTop, rBot, h, x, y, z, segs = 12) {
    const list = this.buckets.get(key);
    if (!list) return;
    const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    g.translate(x, y, z);
    list.push(g);
  }

  flush(scene) {
    const shadowCasterKeys = new Set([
      'brick_baiano',
      'brick_baiano_light',
      'cement_raw',
      'cv_red',
      'cv_dark_red',
      'cv_black',
      'cv_white'
    ]);
    // Mantém referências dos materiais emissivos usados dinamicamente pelo ciclo Dia/Noite
    const dynamicEmissiveKeys = new Set([
      'window_lit',
      'window_orange',
      'window_tv_blue',
      'favela_bulb_warm',
      'floodlight_panel'
    ]);
    flushSpatialChunkedBuckets(scene, this.buckets, this.materials, {
      chunkSize: 768,
      preserveKeys: dynamicEmissiveKeys,
      castShadowFn: (key) => shadowCasterKeys.has(key),
      receiveShadowFn: () => true
    });
  }
}

/**
 * 1. CONSTRÓI O MORRO SUAVE EM LADEIRA CONTÍNUA (`PlaneGeometry` subdividido)
 * Sem nenhum caixote marrom vertical! Começa exatamente em Y = 0 nas ruas da Cidade e do Aeroporto
 * e sobe suavemente até Y ≈ 43m no topo do morro!
 */
export function buildContinuousSmoothHillMesh(world) {
  const minX = -1016;
  const maxX = -524;
  const minZ = -1825;
  const maxZ = 680;
  const width = maxX - minX;   // 492m
  const depth = maxZ - minZ;   // 2505m
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  const segsX = 88;
  const segsZ = 314;
  const geo = new THREE.PlaneGeometry(width, depth, segsX, segsZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(centerX, 0, centerZ);

  const posAttr = geo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const cStreetBorder = new THREE.Color(0x222834); // Concreto úmido escuro da borda em Y = 0
  const cFavelaOchre = new THREE.Color(0x3d1e0b);  // Terra batida escura/úmida sob os becos
  const cHillGreen = new THREE.Color(0x182b18);    // Vegetação sombria nas encostas íngremes
  const cSummitClay = new THREE.Color(0x541e0d);   // Barro queimado escuro no alto do morro
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getFavelaElevation(vx, vz);

    if (vy <= 0.02) {
      // Fora da encosta (nas ruas da cidade/aeroporto), fica 0.06m abaixo do asfalto para zero Z-fighting!
      posAttr.setY(i, -0.06);
      colors[i * 3] = cStreetBorder.r;
      colors[i * 3 + 1] = cStreetBorder.g;
      colors[i * 3 + 2] = cStreetBorder.b;
    } else {
      posAttr.setY(i, vy);
      const heightRatio = Math.min(1, vy / 42.0);
      const wave = 0.5 + 0.5 * Math.sin(vx * 0.07 + vz * 0.05);
      if (vy < 4.5) {
        tmpColor.copy(cStreetBorder).lerp(cFavelaOchre, vy / 4.5);
      } else if (wave > 0.72 && vy > 12) {
        tmpColor.copy(cFavelaOchre).lerp(cHillGreen, 0.55);
      } else {
        tmpColor.copy(cFavelaOchre).lerp(cSummitClay, heightRatio * 0.65);
      }
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const hillMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.04
  });
  const hillMesh = new THREE.Mesh(geo, hillMat);
  hillMesh.receiveShadow = true;
  hillMesh.castShadow = false;
  world.scene.add(hillMesh);

  // Registra a massa contínua do Morro da Cidade de Deus no Minimapa / Mapa [M] (cobrindo até a borda Norte Z = -1320!)
  world.mapBlocks.push(
    { x: -770, z: -45, w: 468, d: 900, color: '#7c2d12' },
    { x: -835, z: -907.5, w: 354, d: 825, color: '#78350f' },
    { x: -835, z: 540, w: 354, d: 270, color: '#78350f' }
  );
}
