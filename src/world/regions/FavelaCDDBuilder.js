import * as THREE from 'three';
import {
  LEGO_COLORS,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';
import { buildTerritoryInfrastructureForZone } from '../FactionWarSystem.js';

/**
 * FUNÇÃO MATEMÁTICA CONTÍNUA DE RELEVO DO MORRO DA CIDADE DE DEUS (`getFavelaElevation(x, z)`):
 * - PROIBIDO "blocão marrom" com paredão vertical!
 * - Nas bordas da Favela (onde encosta nas ruas da Cidade a Leste, Subúrbio ao Norte, Orla ao Sul e Aeroporto a Oeste),
 *   a altura começa EXATAMENTE em Y = 0 (no nível da rua, sem degrau brusco!) e sobe suavemente em curva de sino/cosseno
 *   como uma ladeira real até chegar a Y ≈ 43m no cume do morro!
 */
export function getFavelaEastBorderX(z) {
  // Na faixa central (de frente para o Centro e Parque Central: Z = -490 a +400), a Favela começa na rua X = -516 (em X = -528).
  // Nas pontas Norte (Z < -520) e Sul (Z > +430), começa após a primeira coluna do Subúrbio/Hotéis (em X = -658), com transição suave!
  if (z >= -490 && z <= 400) return -528;
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
  const zNorth = -1318;
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
 * Trajetórias das 7 Ladeiras Tortas / Ruelas de Cimento que sobem serpenteando pela encosta do Morro
 * a partir das Bocas de Entrada (onde terminam as ruas da cidade em Y = 0) até o cume!
 */
const WINDING_LADEIRAS = [
  { zStart: -1190, amp1: 22, freq1: 0.015, amp2: -14, freq2: 0.009, hasStairs: true },
  { zStart: -1030, amp1: -25, freq1: 0.016, amp2: 15, freq2: 0.008, hasStairs: false },
  { zStart: -840,  amp1: 26, freq1: 0.015, amp2: -12, freq2: 0.010, hasStairs: true },
  { zStart: -640, amp1: 24, freq1: 0.016, amp2: -14, freq2: 0.009, hasStairs: true },
  { zStart: -382, amp1: -28, freq1: 0.015, amp2: 18, freq2: 0.008, hasStairs: false },
  { zStart: -250, amp1: 22, freq1: 0.017, amp2: -12, freq2: 0.010, hasStairs: true },
  { zStart: -117, amp1: -24, freq1: 0.014, amp2: -16, freq2: 0.008, hasStairs: false },
  { zStart: 36,   amp1: 28, freq1: 0.015, amp2: 14, freq2: 0.009, hasStairs: true },
  { zStart: 134,  amp1: -22, freq1: 0.016, amp2: 15, freq2: 0.009, hasStairs: false },
  { zStart: 380,  amp1: 26, freq1: 0.015, amp2: -16, freq2: 0.008, hasStairs: true },
  { zStart: 540,  amp1: -24, freq1: 0.016, amp2: 12, freq2: 0.010, hasStairs: true }
];

function getLadeiraZAtX(ladeira, x) {
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
class FavelaBatcher {
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
    // 1. Alicerces de Concreto, Becos, Ladeiras Tortas e Vegetação de Encosta
    this._registerMat('retaining_concrete', 0x64748b, { roughness: 0.68 });
    this._registerMat('alley_cement', 0x475569, { roughness: 0.75 });
    this._registerMat('hill_bush', 0x15803d, { roughness: 0.55 });

    // 2. Paredes dos Barracos e Sobrados Colados (60% Tijolo Baiano, 20% Cimento Cru, 20% Cores do CV)
    this._registerMat('brick_baiano', 0xc2410c, { roughness: 0.62 });
    this._registerMat('brick_baiano_light', 0xea580c, { roughness: 0.58 });
    this._registerMat('brick_groove', 0x7c2d12, { roughness: 0.72 });
    this._registerMat('cement_raw', 0x71717a, { roughness: 0.68 });
    this._registerMat('cement_slab', 0x94a3b8, { roughness: 0.62 });
    this._registerMat('zinc_roof', 0xcbd5e1, { roughness: 0.42, metalness: 0.35 });
    this._registerMat('rebar_iron', 0x27272a, { roughness: 0.45, metalness: 0.55 });

    // 3. Identidade Visual do Comando Vermelho (CV) + Cores Comunitárias
    this._registerMat('cv_red', 0xdc2626, { roughness: 0.32 });
    this._registerMat('cv_dark_red', 0x991b1b, { roughness: 0.38 });
    this._registerMat('cv_black', 0x090a0d, { roughness: 0.36 });
    this._registerMat('cv_white', 0xf8fafc, { roughness: 0.32 });
    this._registerMat('favela_blue_faded', 0x38bdf8, { roughness: 0.48 });
    this._registerMat('favela_yellow_faded', 0xfacc15, { roughness: 0.45 });

    // 4. Caixas d'Água Azuis, Janelas Emissivas ("Presépio Urbano" Noturno!), Sacos de Areia, Fiação e Neon do Baile
    this._registerMat('water_tank_blue', 0x06b6d4, { roughness: 0.24 });
    this._registerMat('water_tank_lid', 0x0284c7, { roughness: 0.28 });
    this._registerMat('window_lit', 0x92400e, {
      roughness: 0.22,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.0
    });
    this._registerMat('window_orange', 0x7c2d12, {
      roughness: 0.22,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.0
    });
    this._registerMat('window_tv_blue', 0x0c4a6e, {
      roughness: 0.18,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.0
    });
    this._registerMat('window_dark', 0x1e293b, { roughness: 0.25 });
    this._registerMat('favela_bulb_warm', 0xfef3c7, {
      roughness: 0.2,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.25
    });
    this._registerMat('floodlight_panel', 0xf8fafc, {
      roughness: 0.16,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.2
    });
    this._registerMat('sandbag_tan', 0xd6d3d1, { roughness: 0.75 });
    this._registerMat('wood_pole', 0x451a03, { roughness: 0.65 });
    this._registerMat('wire_black', 0x090a0d, { basic: true });
    this._registerMat('varzea_dirt', 0xb45309, { roughness: 0.78 });
    this._registerMat('varzea_grass', 0x16a34a, { roughness: 0.62 });
    this._registerMat('fence_mesh', 0x94a3b8, { roughness: 0.35, metalness: 0.45 });
    this._registerMat('pool_water', 0x22d3ee, {
      roughness: 0.12,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35
    });
    this._registerMat('neon_red', 0xff1e42, { basic: true });
    this._registerMat('neon_gold', 0xfacc15, { basic: true });
    this._registerMat('neon_cyan', 0x00f0ff, { basic: true });
  }

  addBox(key, w, h, d, x, y, z) {
    const list = this.buckets.get(key);
    if (list) {
      list.push(makeTranslatedBox(w, h, d, x, y, z));
    }
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
    for (const [key, geos] of this.buckets.entries()) {
      if (geos.length === 0) continue;
      const merged = mergeBufferGeometries(geos);
      if (!merged) continue;
      const mat = this.materials.get(key);
      const mesh = new THREE.Mesh(merged, mat);
      if (shadowCasterKeys.has(key)) {
        mesh.castShadow = true;
      }
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
}

/**
 * Cria placas e murais de facção 3D (CV / CDD / Paredão / Caixa d'Água)
 */
function addFavelaSignBoard(world, x, y, z, width, height, text, subText = '', opts = {}) {
  const rotY = typeof opts.rotY === 'number' ? opts.rotY : opts.rotY ? Math.PI / 2 : 0;
  const mesh = createSignBoardMesh({
    x,
    y,
    z,
    width,
    height,
    depth: opts.depth || 0.7,
    rotY,
    title: text,
    subText,
    bgColor: opts.bgColor || '#991b1b',
    borderColor: opts.borderColor || '#090a0d',
    textColor: opts.textColor || '#ffffff',
    subColor: opts.subColor || '#facc15',
    doubleSided: true
  });
  world.scene.add(mesh);
}

/**
 * CONSTRUTOR PRINCIPAL: FAVELA / COMPLEXO DA CIDADE DE DEUS (TERRITÓRIO 100% CV)
 * - Colina / Ladeira Suave e Contínua (`PlaneGeometry` subdividido com `getFavelaElevation(x, z)` partindo de Y = 0 nas bordas!)
 * - Zero avenidas retas de quarteirão dentro da Favela (substituídas por Ladeiras Tortas e Escadões serpenteando pela encosta!)
 * - Aglomerados densos de Barracos e Sobrados COLADOS PAREDE COM PAREDE (clusters de 5 a 10 casas encostadas, deixando apenas
 *   becos estreitos de 3.5 a 5 unidades entre um bloco e outro!)
 */
export function buildFavelaCidadeDeDeus(world) {
  const batcher = new FavelaBatcher();
  if (!world.nightLampRegistry) world.nightLampRegistry = [];
  world.favelaEmissiveMats = {
    windows: [
      batcher.materials.get('window_lit'),
      batcher.materials.get('window_orange'),
      batcher.materials.get('window_tv_blue')
    ],
    bulbs: [
      batcher.materials.get('favela_bulb_warm'),
      batcher.materials.get('floodlight_panel')
    ]
  };
  world.favelaSoccerFloodCones = [];
  world.favelaBaileSkytrackers = [];
  world.favelaSummitBeacons = [];

  world.favelaCDDData = {
    faction: 'CV',
    factionName: 'COMANDO VERMELHO',
    isContinuousSmoothHill: true,
    hillLevels: [8, 18, 30, 42, 55],
    housesCount: 0,
    clustersCount: 0,
    brickBaianoCount: 0,
    cementRawCount: 0,
    cvPaintedCount: 0,
    waterTanksCount: 0,
    staircasesCount: 0,
    bocasCount: 0,
    hasSoccerField: false,
    hasBaileParedao: false,
    hasRedBaronFortress: false,
    hasCommunityWaterTower: false
  };

  // 1. MALHA CONTÍNUA DE COLINA / LADEIRA SUAVE (`PlaneGeometry` subdividido com `getFavelaElevation(x, z)`, partindo de Y = 0!)
  buildContinuousSmoothHillMesh(world);

  // 2. RUELAS TORTAS DE CIMENTO, LADEIRAS SERPENTEANTES E ESCADÕES DO MORRO (VERMELHO E BRANCO)
  buildWindingHillsideRoadsAndStaircases(world, batcher);

  // 3. OS 4 PONTOS ICÔNICOS DA CIDADE DE DEUS (Posicionadas em `y = getFavelaElevation(x, z)` com alicerce na encosta!):
  // 3.1 As Bocas de Entrada & Barricadas Pesadas do CV (onde as ruas do asfalto da cidade terminam em Y = 0!)
  buildCVBocasAndHeavyBarricades(world, batcher);

  // 3.2 O Campinho de Futebol da CDD (Várzea em X = -605, Z = +195, Y = getFavelaElevation(-605, 195) ≈ 11.5m)
  buildCDDSoccerFieldVarzea(world, batcher, -605, getFavelaElevation(-605, 195), 195);

  // 3.3 A Quadra do Baile do CV & Paredão de Som Gigante (em X = -715, Z = -135, Y = getFavelaElevation(-715, -135) ≈ 25.0m)
  buildCVBailePlazaAndGiantParedao(world, batcher, -715, getFavelaElevation(-715, -135), -135);

  // 3.4 O Topo do Morro — Caixa d'Água Comunitária Gigante ("CIDADE DE DEUS") + Fortaleza do Barão Vermelho (X = -865, Z = -240, Y ≈ 42.5m)
  buildRedBaronSummitFortress(world, batcher, -865, getFavelaElevation(-865, -240), -240);

  // 4. AGLOMERADOS DENSOS DE BARRACOS E SOBRADOS COLADOS PAREDE COM PAREDE (`clusters` de 5 a 10 casas coladas, becos de 3.5 a 5m!)
  buildGluedFavelaHouseClusters(world, batcher);

  // 5. Mescla todas as geometrias estáticas em poucos Draw Calls mantendo 60 FPS!
  batcher.flush(world.scene);

  // 6. Infraestrutura Oficial da Fortaleza do CV: Portões com Bandeira, 2 Garagens Exclusivas e 3 Outposts Táticos!
  buildTerritoryInfrastructureForZone(world, 'cv');
}

/**
 * 1. CONSTRÓI O MORRO SUAVE EM LADEIRA CONTÍNUA (`PlaneGeometry` subdividido)
 * Sem nenhum caixote marrom vertical! Começa exatamente em Y = 0 nas ruas da Cidade e do Aeroporto
 * e sobe suavemente até Y ≈ 43m no topo do morro!
 */
function buildContinuousSmoothHillMesh(world) {
  const minX = -1016;
  const maxX = -524;
  const minZ = -1320;
  const maxZ = 680;
  const width = maxX - minX;   // 492m
  const depth = maxZ - minZ;   // 2000m
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  const segsX = 88;
  const segsZ = 250;
  const geo = new THREE.PlaneGeometry(width, depth, segsX, segsZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(centerX, 0, centerZ);

  const posAttr = geo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);

  const cStreetBorder = new THREE.Color(0x475569); // Cimento/terra da borda em Y = 0
  const cFavelaOchre = new THREE.Color(0x78350f);  // Terra batida ocre/marrom de encosta sob os becos
  const cHillGreen = new THREE.Color(0x365314);    // Vegetação natural nas bordas íngremes do morro
  const cSummitClay = new THREE.Color(0x9a3412);   // Terracota avermelhada no alto do morro
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

/**
 * 2. RUELAS TORTAS DE CIMENTO, LADEIRAS SERPENTEANTES & ESCADÕES DO MORRO (VERMELHO E BRANCO)
 * Sobem serpenteando pela encosta contínua (`y = getFavelaElevation(x, z)`) desde Y = 0 até o cume!
 */
function buildWindingHillsideRoadsAndStaircases(world, batcher) {
  let ladeiraIdx = 0;
  for (const ladeira of WINDING_LADEIRAS) {
    ladeiraIdx++;
    const xEast = getFavelaEastBorderX(ladeira.zStart);
    const xWest = -975;
    const stepX = 6.0;
    let segCounter = 0;

    for (let x = xEast - 3; x >= xWest; x -= stepX) {
      segCounter++;
      const z = getLadeiraZAtX(ladeira, x);
      const nextX = x - stepX;
      const nextZ = getLadeiraZAtX(ladeira, nextX);
      const midX = (x + nextX) * 0.5;
      const midZ = (z + nextZ) * 0.5;
      const y = getFavelaElevation(midX, midZ);
      if (y <= 0.05) continue;

      const roadW = ladeira.hasStairs ? 5.8 : 7.4;

      // Base/alicerce de cimento acompanhando exatamente a inclinação da ladeira (`getFavelaElevation`)
      batcher.addBox('alley_cement', stepX + 1.4, 1.8, roadW, midX, y - 0.72, midZ);

      // Nas ladeiras de Escadão, pinta os degraus e muretas laterais de Vermelho e Branco (Cores do CV!)
      if (ladeira.hasStairs) {
        const isRed = Math.abs(Math.round(x / stepX)) % 2 === 0;
        batcher.addBox(isRed ? 'cv_red' : 'cv_white', stepX * 0.9, 0.28, roadW - 0.8, midX, y + 0.08, midZ);
        for (const side of [-1, 1]) {
          batcher.addBox('cv_red', stepX + 0.4, 0.95, 0.36, midX, y + 0.45, midZ + side * (roadW * 0.5 - 0.2));
        }
      } else {
        // Meio-fio vermelho e branco nas Ladeiras Tortas de Subida de Motos/Picapes do CV!
        const curbMat = Math.abs(Math.round(x / stepX)) % 2 === 0 ? 'cv_red' : 'cv_white';
        for (const side of [-1, 1]) {
          batcher.addBox(curbMat, stepX + 0.6, 0.38, 0.42, midX, y + 0.12, midZ + side * (roadW * 0.5 - 0.2));
        }
      }

      // Postes de Madeira & Gambiarras Luminosas nas 11 Ladeiras Tortas (a cada 30m!)
      if (segCounter % 5 === 2 && y > 0.35) {
        const poleSide = (segCounter + ladeiraIdx) % 2 === 0 ? 1 : -1;
        const poleZ = midZ + poleSide * (roadW * 0.5 + 0.45);
        const bulbZ = midZ + poleSide * (roadW * 0.5 - 0.9);
        batcher.addBox('wood_pole', 0.32, 5.4, 0.32, midX, y + 2.7, poleZ);
        batcher.addBox('wood_pole', 0.2, 0.2, 1.55, midX, y + 5.2, (poleZ + bulbZ) * 0.5);
        batcher.addBox('favela_bulb_warm', 0.38, 0.28, 0.38, midX, y + 4.98, bulbZ);

        // Gambiarra de fio preto cruzando o alto da ladeira com lâmpadas quentes
        batcher.addBox('wire_black', 0.08, 0.08, roadW + 0.9, midX, y + 5.15, midZ);
        batcher.addBox('favela_bulb_warm', 0.24, 0.24, 0.24, midX, y + 4.98, midZ);

        world.nightLampRegistry.push({
          x: midX,
          y: y + 4.95,
          z: bulbZ,
          groundY: y + 0.1,
          warm: true,
          coneH: 4.9,
          coneR: 3.8
        });
      }
    }

    world.favelaCDDData.staircasesCount += 3;
  }

  // 3 Vielas Transversais Tortas (Norte-Sul) serpenteando a meia-encosta e ligando as ladeiras!
  for (const baseX of [-595, -695, -805]) {
    for (let z = -880; z <= 610; z += 8.0) {
      const x = baseX + Math.sin(z * 0.018) * 14 + Math.cos(z * 0.009) * 8;
      const y = getFavelaElevation(x, z);
      if (y <= 0.2) continue;
      batcher.addBox('alley_cement', 4.8, 1.6, 8.8, x, y - 0.68, z);
    }
  }
}

/**
 * 3.1 AS BOCAS DE ENTRADA & BARRICADAS PESADAS DO CV (NA BORDA Y = 0 ONDE TERMINAM AS RUAS DA CIDADE!)
 * Trilhos de ferro fincados no chão, blocos de concreto vermelhos, carcaças queimadas,
 * tambores explosivos e Motos/Picapes do CV estacionadas!
 */
function buildCVBocasAndHeavyBarricades(world, batcher) {
  const bocas = [
    { x: -524, z: -382, label: 'BOCA NORTE-1 (CV)' },
    { x: -524, z: -250, label: 'BOCA CENTRAL-NORTE (CV)' },
    { x: -524, z: -117, label: 'BOCA PRINCIPAL CDD (CV)' },
    { x: -524, z: 36,   label: 'BOCA CENTRAL CDD (CV)' },
    { x: -524, z: 134,  label: 'BOCA CAMPINHO (CV)' },
    { x: -524, z: 380,  label: 'BOCA SUL (CV)' },
    { x: -654, z: -640, label: 'BOCA SUBÚRBIO-OESTE (CV)' },
    { x: -654, z: 540,  label: 'BOCA ORLA-OESTE (CV)' }
  ];

  for (let i = 0; i < bocas.length; i++) {
    const b = bocas[i];
    const by = getFavelaElevation(b.x, b.z);
    world.favelaCDDData.bocasCount++;

    // 1. Blocos de Concreto Pintados de Vermelho e Preto + Trilhos de Ferro ("Ouriços Anti-Caveirão")
    for (const side of [-1, 1]) {
      const bz = b.z + side * 6.2;
      batcher.addBox('cv_red', 2.4, 1.4, 4.2, b.x, by + 0.7, bz);
      batcher.addBox('cv_black', 2.5, 0.35, 4.3, b.x, by + 1.25, bz);
      world.addCollider(b.x, bz, 2.4, 4.2, by + 1.4, by);

      const railX = b.x + 2.4;
      const railZ = b.z + side * 3.0;
      batcher.addBox('rebar_iron', 0.35, 2.2, 0.35, railX, by + 1.1, railZ);
      batcher.addBox('rebar_iron', 1.8, 0.32, 0.32, railX, by + 1.1, railZ);
      batcher.addBox('rebar_iron', 0.32, 0.32, 1.8, railX, by + 1.1, railZ);
      world.addCollider(railX, railZ, 1.6, 1.6, by + 2.1, by);
    }

    // 2. Carcaça de Carro Queimado na Barricada Lateral
    const wreckX = b.x - 1.5;
    const wreckZ = b.z + 10.5;
    const wy = getFavelaElevation(wreckX, wreckZ);
    batcher.addBox('cv_black', 2.6, 1.2, 4.6, wreckX, wy + 0.5, wreckZ);
    batcher.addBox('rebar_iron', 2.2, 0.75, 2.4, wreckX, wy + 1.3, wreckZ - 0.2);
    world.addCollider(wreckX, wreckZ, 2.6, 4.6, wy + 1.7, wy);

    // 3. Guarita / Tenda da Boca do CV (com Guarda-Sol Vermelho e Sacos de Areia)
    const boothX = b.x - 2.8;
    const boothZ = b.z - 10.2;
    const bty = getFavelaElevation(boothX, boothZ);
    batcher.addBox('sandbag_tan', 3.4, 1.2, 3.4, boothX, bty + 0.5, boothZ);
    batcher.addBox('wood_pole', 0.25, 3.4, 0.25, boothX, bty + 1.7, boothZ);
    batcher.addBox('cv_red', 4.2, 0.45, 4.2, boothX, bty + 3.4, boothZ);
    batcher.addBox('cv_white', 2.8, 0.35, 2.8, boothX, bty + 3.7, boothZ);
    world.addCollider(boothX, boothZ, 3.4, 3.4, bty + 1.2, bty);

    // 4. Placa de Aviso da Facção na Entrada da Boca
    if (i < 6) {
      addFavelaSignBoard(
        world,
        b.x + 1.2,
        by + 4.4,
        b.z,
        14.0,
        2.4,
        'COMPLEXO DA CIDADE DE DEUS',
        'TERRITÓRIO 100% CV • REDUZA A VELOCIDADE',
        { rotY: true, bgColor: '#dc2626', borderColor: '#090a0d', textColor: '#ffffff', subColor: '#facc15' }
      );
    }

    // 5. Tambores Vermelhos Explosivos Quebráveis nas Barricadas do CV!
    for (const side of [-1, 1]) {
      const barrelGroup = new THREE.Group();
      const body = createLegoBrick(1.1, 1.6, 1.1, 0xdc2626, { studs: true });
      body.position.y = 0.8;
      const stripe = createLegoBrick(1.15, 0.3, 1.15, 0xfacc15, { studs: false });
      stripe.position.y = 0.9;
      barrelGroup.add(body, stripe);

      const bx = b.x + 1.8;
      const bz = b.z + side * 8.6;
      const barrelY = getFavelaElevation(bx, bz);
      barrelGroup.position.set(bx, barrelY, bz);
      world.scene.add(barrelGroup);

      const bCol = world.addCollider(bx, bz, 1.1, 1.1, barrelY + 1.6, barrelY);
      if (world.destructibles) {
        world.destructibles.registerDestructible({
          mesh: barrelGroup,
          type: 'explosive_barrel',
          hp: 25,
          radius: 1.2,
          height: 1.6,
          colliders: [bCol],
          debrisColors: [0xdc2626, 0xfacc15, 0x090a0d],
          studDrops: { silver: 2, gold: 3, blue: 1, purple: 0 },
          groundY: barrelY
        });
      }
    }
  }
}

/**
 * 3.2 O CAMPINHO DE FUTEBOL DA CDD (VÁRZEA EM X = -605, Z = +195, Y ≈ 11.5m)
 * Posicionado sobre a colina suave com alicerce de concreto embutido na encosta!
 */
function buildCDDSoccerFieldVarzea(world, batcher, cx, yBase, cz) {
  const fieldW = 44;
  const fieldD = 68;

  // Alicerce de concreto raso nivelando o campinho na encosta suave (sem paredão gigante!)
  batcher.addBox('retaining_concrete', fieldW + 3, 4.5, fieldD + 3, cx, yBase - 2.15, cz);
  batcher.addBox('varzea_dirt', fieldW, 0.18, fieldD, cx, yBase + 0.08, cz);
  for (let gz = cz - 22; gz <= cz + 22; gz += 11) {
    batcher.addBox('varzea_grass', fieldW - 8, 0.2, 6.0, cx, yBase + 0.09, gz);
  }

  // Linhas de Cal Branca
  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.45, cx, yBase + 0.1, cz);
  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.45, cx, yBase + 0.1, cz - fieldD * 0.5 + 2);
  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.45, cx, yBase + 0.1, cz + fieldD * 0.5 - 2);
  batcher.addBox('cv_white', 0.45, 0.22, fieldD - 4, cx - fieldW * 0.5 + 2, yBase + 0.1, cz);
  batcher.addBox('cv_white', 0.45, 0.22, fieldD - 4, cx + fieldW * 0.5 - 2, yBase + 0.1, cz);

  // As 2 Traves Brancas com Rede
  for (const endDir of [-1, 1]) {
    const gz = cz + endDir * (fieldD * 0.5 - 2.5);
    batcher.addBox('cv_white', 0.4, 3.4, 0.4, cx - 5.2, yBase + 1.7, gz);
    batcher.addBox('cv_white', 0.4, 3.4, 0.4, cx + 5.2, yBase + 1.7, gz);
    batcher.addBox('cv_white', 10.8, 0.4, 0.4, cx, yBase + 3.4, gz);
    batcher.addBox('fence_mesh', 10.4, 3.2, 1.4, cx, yBase + 1.6, gz + endDir * 0.8);
    world.addCollider(cx, gz + endDir * 0.8, 10.8, 1.6, yBase + 3.5, yBase);
  }

  // Alambrado de Tela Metálica Cercando o Campinho (com entradas abertas no meio)
  for (const sideX of [-1, 1]) {
    const fx = cx + sideX * (fieldW * 0.5 + 1.0);
    for (let fz = cz - 28; fz <= cz + 28; fz += 14) {
      if (Math.abs(fz - cz) < 6) continue;
      batcher.addBox('rebar_iron', 0.35, 4.4, 0.35, fx, yBase + 2.2, fz);
      batcher.addBox('fence_mesh', 0.18, 4.0, 13.6, fx, yBase + 2.0, fz);
      world.addCollider(fx, fz, 0.6, 13.6, yBase + 4.4, yBase);
    }
  }

  // Arquibancada de Cimento Vermelho e Branco + Muro do CV
  const bleachX = cx - fieldW * 0.5 - 4.2;
  for (let step = 0; step < 4; step++) {
    const sx = bleachX - step * 1.3;
    const sh = (step + 1) * 0.9;
    const sMat = step % 2 === 0 ? 'cv_red' : 'cv_white';
    batcher.addBox('retaining_concrete', 1.3, sh + 2.0, fieldD - 8, sx, yBase + sh * 0.5 - 1.0, cz);
    batcher.addBox(sMat, 1.35, 0.22, fieldD - 8, sx, yBase + sh, cz);
    world.addCollider(sx, cz, 1.3, fieldD - 8, yBase + sh, yBase);
  }

  addFavelaSignBoard(
    world,
    bleachX - 5.2,
    yBase + 5.2,
    cz,
    36.0,
    3.5,
    'CAMPINHO DA CIDADE DE DEUS (VÁRZEA)',
    'COMANDO VERMELHO • TROPA DA CDD',
    { rotY: true, bgColor: '#dc2626', borderColor: '#ffffff', textColor: '#ffffff', subColor: '#facc15' }
  );

  // 4 Torres de Refletores nos Cantos do Campinho acendendo feixes brancos sobre o gramado à noite!
  const floodConeGeo = new THREE.ConeGeometry(11.5, 19.0, 14, 1, true);
  floodConeGeo.translate(0, -9.5, 0);
  const floodConeMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ]) {
    const tx = cx + sx * (fieldW * 0.5 + 1.8);
    const tz = cz + sz * (fieldD * 0.5 - 1.5);
    batcher.addBox('rebar_iron', 0.55, 13.8, 0.55, tx, yBase + 6.9, tz);
    batcher.addBox('cv_black', 2.6, 1.35, 0.65, tx, yBase + 13.8, tz);
    batcher.addBox('floodlight_panel', 2.3, 1.05, 0.72, tx, yBase + 13.8, tz);

    const cone = new THREE.Mesh(floodConeGeo, floodConeMat);
    cone.position.set(tx, yBase + 13.5, tz);
    cone.lookAt(cx, yBase + 0.2, cz + sz * 8.0);
    cone.rotateX(Math.PI / 2);
    cone.visible = false;
    world.scene.add(cone);
    world.favelaSoccerFloodCones.push({ mesh: cone, mat: floodConeMat });

    world.nightLampRegistry?.push({
      x: cx + sx * 8.0,
      y: yBase + 11.5,
      z: cz + sz * 14.0,
      groundY: yBase + 0.12,
      warm: false,
      coneH: 11.4,
      coneR: 8.5
    });
  }

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: fieldW,
    d: fieldD,
    height: 4,
    color: '#16a34a',
    label: 'CAMPINHO CDD'
  });

  world.favelaCDDData.hasSoccerField = true;
}

/**
 * 3.3 A QUADRA DO BAILE DO CV (PAREDÃO DE SOM GIGANTE EM X = -715, Z = -135, Y ≈ 25.0m)
 */
function buildCVBailePlazaAndGiantParedao(world, batcher, cx, yBase, cz) {
  const plazaW = 50;
  const plazaD = 58;

  // Alicerce de concreto embutido na colina + piso vermelho e preto da Quadra do Baile
  batcher.addBox('retaining_concrete', plazaW + 2, 4.5, plazaD + 2, cx, yBase - 2.15, cz);
  batcher.addBox('cv_black', plazaW, 0.18, plazaD, cx, yBase + 0.08, cz);
  batcher.addBox('cv_red', plazaW - 8, 0.22, plazaD - 8, cx, yBase + 0.1, cz);

  // O PAREDÃO DE SOM COLOSSAL DO BAILE DA CDD
  const paredaoX = cx - 19.0;
  const paredaoW = 5.4;
  const paredaoH = 11.5;
  const paredaoD = 21.0;

  batcher.addBox('cv_black', paredaoW, paredaoH, paredaoD, paredaoX, yBase + paredaoH * 0.5, cz);
  batcher.addBox('cv_red', paredaoW + 0.3, 1.2, paredaoD + 0.6, paredaoX, yBase + paredaoH + 0.6, cz);
  world.addCollider(paredaoX, cz, paredaoW, paredaoD, yBase + paredaoH + 1.2, yBase);

  for (let row = 0; row < 4; row++) {
    const sy = yBase + 1.6 + row * 2.5;
    const neonKey = row % 2 === 0 ? 'neon_red' : row === 1 ? 'neon_gold' : 'neon_cyan';
    batcher.addBox(neonKey, 0.35, 0.28, paredaoD - 1.2, paredaoX + paredaoW * 0.5 + 0.15, sy + 1.1, cz);

    for (let col = -2; col <= 2; col++) {
      const sz = cz + col * 3.8;
      batcher.addBox('cv_red', 0.45, 2.0, 3.2, paredaoX + paredaoW * 0.5 + 0.1, sy, sz);
      batcher.addBox('cv_black', 0.6, 1.3, 2.0, paredaoX + paredaoW * 0.5 + 0.2, sy, sz);
      batcher.addBox('neon_gold', 0.7, 0.45, 0.45, paredaoX + paredaoW * 0.5 + 0.25, sy, sz);
    }
  }

  // Palco do DJ / MC na frente do Paredão
  batcher.addBox('retaining_concrete', 5.2, 1.4, 13.5, paredaoX + 5.0, yBase + 0.7, cz);
  batcher.addBox('neon_red', 0.3, 0.3, 13.7, paredaoX + 7.6, yBase + 1.4, cz);
  world.addCollider(paredaoX + 5.0, cz, 5.2, 13.5, yBase + 1.4, yBase);

  addFavelaSignBoard(
    world,
    paredaoX + paredaoW * 0.5 + 0.4,
    yBase + paredaoH + 2.4,
    cz,
    21.0,
    3.4,
    'BAILE DA CIDADE DE DEUS',
    'PAREDÃO MONSTRO • COMANDO VERMELHO',
    { rotY: true, bgColor: '#090a0d', borderColor: '#ff1e42', textColor: '#ff1e42', subColor: '#facc15' }
  );

  // Barraquinhas de Lanche / Bebida nas laterais + Mesas de Plástico Vermelhas e Amarelas!
  for (const sideZ of [-1, 1]) {
    const stallZ = cz + sideZ * 22.5;
    for (const sx of [cx - 5, cx + 8]) {
      batcher.addBox('brick_baiano', 6.2, 3.2, 4.2, sx, yBase + 1.6, stallZ);
      batcher.addBox('cv_red', 7.0, 0.45, 5.2, sx, yBase + 3.4, stallZ);
      world.addCollider(sx, stallZ, 6.2, 4.2, yBase + 3.6, yBase);
    }
  }

  // Mesas de Plástico Vermelhas e Amarelas nas bordas Norte/Sul, deixando o centro da pista 100% livre pro Baile!
  for (let mx = cx - 6; mx <= cx + 14; mx += 6.5) {
    for (const mz of [cz - 17.5, cz + 17.5]) {
      const tableMat = (Math.abs(Math.round(mx + mz)) % 2 === 0) ? 'cv_red' : 'favela_yellow_faded';
      batcher.addBox(tableMat, 1.6, 0.85, 1.6, mx, yBase + 0.42, mz);
      batcher.addBox(tableMat, 0.55, 0.5, 0.55, mx - 1.2, yBase + 0.25, mz);
      batcher.addBox(tableMat, 0.55, 0.5, 0.55, mx + 1.2, yBase + 0.25, mz);
    }
  }

  // Cordões de Luzes Neon e Bandeirinhas Vermelhas cruzando o alto da Quadra do Baile!
  for (let lz = cz - 18; lz <= cz + 18; lz += 12) {
    batcher.addBox('wire_black', 36.0, 0.12, 0.12, cx, yBase + 8.5, lz);
    for (let lx = cx - 14; lx <= cx + 14; lx += 4.5) {
      batcher.addBox('cv_red', 0.65, 0.85, 0.15, lx, yBase + 8.0, lz);
      batcher.addBox('neon_gold', 0.35, 0.35, 0.35, lx + 2.2, yBase + 8.3, lz);
    }
  }

  // 3 Feixes Skytracker (Rosa, Ciano e Amarelo) no topo do Paredão girando para o céu noturno!
  const skyBeamGeo = new THREE.ConeGeometry(5.8, 72.0, 14, 1, true);
  skyBeamGeo.translate(0, 36.0, 0);
  const trackerSpecs = [
    { dz: -7.5, hex: 0xec4899, phase: 0.0 },
    { dz: 0.0, hex: 0x00f0ff, phase: 2.1 },
    { dz: 7.5, hex: 0xfacc15, phase: 4.2 }
  ];
  for (const ts of trackerSpecs) {
    const mat = new THREE.MeshBasicMaterial({
      color: ts.hex,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const pivot = new THREE.Group();
    pivot.position.set(paredaoX, yBase + paredaoH + 1.35, cz + ts.dz);
    const beam = new THREE.Mesh(skyBeamGeo, mat);
    pivot.add(beam);
    pivot.visible = false;
    world.scene.add(pivot);
    world.favelaBaileSkytrackers.push({ pivot, mat, phase: ts.phase });
  }

  world.nightLampRegistry?.push({
    x: cx,
    y: yBase + 8.2,
    z: cz,
    groundY: yBase + 0.15,
    warm: true,
    coneH: 8.0,
    coneR: 7.5
  });

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: plazaW,
    d: plazaD,
    height: 12,
    color: '#dc2626',
    label: 'BAILE DO CV (PAREDÃO)'
  });

  world.favelaCDDData.hasBaileParedao = true;
}

/**
 * 3.4 O TOPO DO MORRO — FORTALEZA DO BARÃO VERMELHO & CAIXA D'ÁGUA COMUNITÁRIA GIGANTE (X = -865, Z = -240, Y ≈ 42.5m)
 */
function buildRedBaronSummitFortress(world, batcher, cx, yBase, cz) {
  const fortW = 46;
  const fortD = 60;

  // Alicerce de concreto do Cume integrado suavemente no topo da colina
  batcher.addBox('retaining_concrete', fortW + 4, 5.0, fortD + 4, cx, yBase - 2.4, cz);
  batcher.addBox('alley_cement', fortW + 2, 0.3, fortD + 2, cx, yBase + 0.05, cz);

  // ==========================================================================
  // 1. A CAIXA D'ÁGUA COMUNITÁRIA GIGANTE ("CIDADE DE DEUS") NO TOPO DO MORRO!
  // ==========================================================================
  const towerX = cx + 10;
  const towerZ = cz - 46;
  const towerY = getFavelaElevation(towerX, towerZ);
  const towerH = 32.0;

  batcher.addBox('retaining_concrete', 14.0, 4.5, 14.0, towerX, towerY - 2.0, towerZ);
  for (const [dx, dz] of [[-4.8, -4.8], [4.8, -4.8], [-4.8, 4.8], [4.8, 4.8]]) {
    batcher.addBox('retaining_concrete', 2.2, 16.0, 2.2, towerX + dx, towerY + 8.0, towerZ + dz);
  }
  batcher.addCylinder('cv_red', 9.5, 9.5, 5.0, towerX, towerY + 18.5, towerZ, 14);
  batcher.addCylinder('cv_white', 9.6, 9.6, 5.0, towerX, towerY + 23.5, towerZ, 14);
  batcher.addCylinder('cv_red', 9.5, 9.5, 5.0, towerX, towerY + 28.5, towerZ, 14);
  batcher.addCylinder('cv_dark_red', 10.2, 10.2, 1.2, towerX, towerY + 31.6, towerZ, 14);
  batcher.addBox('rebar_iron', 0.6, 9.0, 0.6, towerX, towerY + 36.5, towerZ);
  batcher.addBox('neon_red', 1.2, 1.2, 1.2, towerX, towerY + 41.2, towerZ);
  world.addCollider(towerX, towerZ, 15.5, 15.5, towerY + towerH, towerY - 2);

  // Luzes Vermelhas Aeronáuticas Piscantes no Topo da Caixa d'Água e Antena do Cume!
  const aeroCoreMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
  const aeroHaloMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  for (const [bx, by, bz, phase] of [
    [towerX, towerY + 41.5, towerZ, 0.0],
    [cx - 8, yBase + 25.9, cz - 5, 1.6]
  ]) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, by, bz);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 10), aeroCoreMat);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 12), aeroHaloMat.clone());
    bGroup.add(core, halo);
    world.scene.add(bGroup);
    world.favelaSummitBeacons.push({ group: bGroup, haloMat: halo.material, phase });
  }

  addFavelaSignBoard(
    world,
    towerX + 10.2,
    towerY + 23.5,
    towerZ,
    24.0,
    4.6,
    'CIDADE DE DEUS',
    'COMANDO VERMELHO • QG CENTRAL',
    { rotY: true, bgColor: '#dc2626', borderColor: '#ffffff', textColor: '#ffffff', subColor: '#facc15' }
  );
  addFavelaSignBoard(
    world,
    towerX - 10.2,
    towerY + 23.5,
    towerZ,
    24.0,
    4.6,
    'CIDADE DE DEUS',
    'FORTALEZA DO BARÃO VERMELHO',
    { rotY: true, bgColor: '#dc2626', borderColor: '#ffffff', textColor: '#ffffff', subColor: '#facc15' }
  );

  // ==========================================================================
  // 2. A MANSÃO-BUNKER DE TIJOLOS DO BARÃO VERMELHO (QG CENTRAL DO CV)
  // ==========================================================================
  batcher.addBox('brick_baiano', fortW, 3.2, 1.4, cx, yBase + 1.6, cz - fortD * 0.5);
  batcher.addBox('brick_baiano', fortW, 3.2, 1.4, cx, yBase + 1.6, cz + fortD * 0.5);
  batcher.addBox('brick_baiano', 1.4, 3.2, fortD, cx - fortW * 0.5, yBase + 1.6, cz);
  batcher.addBox('brick_baiano', 1.4, 3.2, 20, cx + fortW * 0.5, yBase + 1.6, cz - 19);
  batcher.addBox('brick_baiano', 1.4, 3.2, 20, cx + fortW * 0.5, yBase + 1.6, cz + 19);
  batcher.addBox('sandbag_tan', 2.2, 1.4, 16, cx + fortW * 0.5 + 1.2, yBase + 0.7, cz - 17);
  batcher.addBox('sandbag_tan', 2.2, 1.4, 16, cx + fortW * 0.5 + 1.2, yBase + 0.7, cz + 17);

  for (const [tx, tz] of [
    [cx - 21, cz - 28],
    [cx + 21, cz - 28],
    [cx - 21, cz + 28],
    [cx + 21, cz + 28]
  ]) {
    batcher.addBox('cv_dark_red', 5.0, 11.0, 5.0, tx, yBase + 5.5, tz);
    batcher.addBox('cv_black', 6.0, 1.4, 6.0, tx, yBase + 11.4, tz);
    batcher.addBox('cv_red', 6.4, 0.8, 6.4, tx, yBase + 14.2, tz);
    batcher.addBox('sandbag_tan', 5.6, 1.1, 5.6, tx, yBase + 12.4, tz);
    world.addCollider(tx, tz, 5.4, 5.4, yBase + 14.5, yBase);
  }

  const mansionX = cx - 6;
  const mansionZ = cz;
  batcher.addBox('retaining_concrete', 24, 6.0, 34, mansionX, yBase + 3.0, mansionZ);
  batcher.addBox('cv_red', 24.6, 0.8, 34.6, mansionX, yBase + 6.2, mansionZ);
  batcher.addBox('brick_baiano', 20, 5.8, 28, mansionX, yBase + 9.2, mansionZ);
  batcher.addBox('window_lit', 20.4, 1.8, 22, mansionX, yBase + 9.5, mansionZ);
  batcher.addBox('cement_slab', 23, 0.7, 31, mansionX, yBase + 12.3, mansionZ);
  batcher.addBox('cv_dark_red', 15, 5.2, 19, mansionX - 2, yBase + 15.0, mansionZ);
  batcher.addBox('cement_slab', 17, 0.7, 21, mansionX - 2, yBase + 17.8, mansionZ);
  batcher.addBox('rebar_iron', 0.4, 8.0, 0.4, mansionX - 2, yBase + 21.8, mansionZ - 5);
  batcher.addBox('cv_red', 4.5, 2.6, 0.25, mansionX + 0.2, yBase + 24.2, mansionZ - 5);
  world.addCollider(mansionX, mansionZ, 24, 34, yBase + 18.2, yBase);

  // Piscina Panorâmica no Terraço Frontal da Fortaleza
  const poolX = cx + 12.5;
  const poolZ = cz;
  batcher.addBox('cv_white', 10.5, 1.1, 19.0, poolX, yBase + 0.55, poolZ);
  batcher.addBox('pool_water', 8.8, 1.15, 17.2, poolX, yBase + 0.6, poolZ);
  for (const pz of [poolZ - 6, poolZ + 6]) {
    batcher.addBox('cv_white', 2.2, 0.45, 1.2, poolX - 6.4, yBase + 0.25, pz);
    batcher.addBox('wood_pole', 0.2, 2.8, 0.2, poolX - 6.4, yBase + 1.4, pz);
    batcher.addBox('cv_red', 3.2, 0.35, 3.2, poolX - 6.4, yBase + 2.8, pz);
  }

  if (world.destructibles && typeof world.destructibles.spawnAmbientStud === 'function') {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const sx = poolX + Math.cos(angle) * 6.0;
      const sz = poolZ + Math.sin(angle) * 9.0;
      const kind = i % 4 === 0 ? 'purple' : i % 2 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(sx, yBase + 1.2, sz, kind);
    }
  }

  world.mapBuildings.push(
    {
      x: towerX,
      z: towerZ,
      w: 19,
      d: 19,
      height: 32,
      color: '#dc2626',
      label: 'CAIXA D\'ÁGUA CDD'
    },
    {
      x: cx,
      z: cz,
      w: fortW,
      d: fortD,
      height: 18,
      color: '#991b1b',
      label: 'QG BARÃO VERMELHO (CV)'
    }
  );

  world.favelaCDDData.hasRedBaronFortress = true;
  world.favelaCDDData.hasCommunityWaterTower = true;
}

/**
 * 4. GERADOR DE BARRACOS E SOBRADOS (`createFavelaHouse`) COM ALICERCE DE CONCRETO NA LADEIRA
 * - Posicionado exatamente em `yBase = getFavelaElevation(x, z)` com alicerce de concreto embutido na inclinação!
 * - 60% Tijolo Baiano laranja, 20% Cimento Cinza Cru, 20% Vermelho/Preto/Branco do CV!
 */
function createFavelaHouse(world, batcher, x, z, w, d, floors, seed, registerIndividualCollider = true) {
  const yBase = getFavelaElevation(x, z);
  const floorH = 3.5;

  // Alicerce de Concreto Cinza embutido 3.4m para baixo na inclinação da ladeira (NUNCA flutua no morro!)
  const foundationDepth = 3.4;
  batcher.addBox(
    'retaining_concrete',
    w + 0.25,
    foundationDepth,
    d + 0.25,
    x,
    yBase - foundationDepth * 0.5 + 0.25,
    z
  );

  let curY = yBase + 0.2;
  for (let f = 0; f < floors; f++) {
    const styleRoll = (seed * 7 + f * 13) % 10;
    let wallMat = 'brick_baiano';

    // 60% Tijolo Baiano (0..5), 20% Cimento Cru (6..7), 20% Cores do CV (8..9)
    if (styleRoll <= 5) {
      wallMat = styleRoll % 2 === 0 ? 'brick_baiano' : 'brick_baiano_light';
      world.favelaCDDData.brickBaianoCount++;
    } else if (styleRoll <= 7) {
      wallMat = 'cement_raw';
      world.favelaCDDData.cementRawCount++;
    } else {
      wallMat = styleRoll === 8 ? 'cv_red' : (seed + f) % 3 === 0 ? 'cv_black' : 'cv_white';
      world.favelaCDDData.cvPaintedCount++;
    }

    // Puxadinho: andares superiores projetam-se 0.5m sobre o beco estreito!
    const overhangX = f > 0 && (seed + f) % 2 === 0 ? 0.5 : 0;
    const fx = x + overhangX;

    batcher.addBox(wallMat, w, floorH, d, fx, curY + floorH * 0.5, z);

    if (wallMat.startsWith('brick_')) {
      batcher.addBox('brick_groove', w + 0.12, 0.2, d + 0.12, fx, curY + 1.75, z);
    }

    if (wallMat === 'cv_red' || (f === 0 && seed % 5 === 0)) {
      batcher.addBox('cv_black', w + 0.16, 0.72, d + 0.16, fx, curY + 0.45, z);
    }

    // 70% das janelas dos barracos/sobrados brilham à noite em Amarelo-Âmbar, Laranja-Lâmpada ou Branco-TV Azulado!
    const winRoll = (seed * 5 + f * 11) % 10;
    const winMat =
      winRoll < 4
        ? 'window_lit'
        : winRoll < 6
          ? 'window_orange'
          : winRoll === 6
            ? 'window_tv_blue'
            : 'window_dark';
    batcher.addBox(winMat, w + 0.18, 0.9, d * 0.48, fx, curY + 2.05, z);

    if (f === floors - 1) {
      batcher.addBox('cement_slab', w + 0.6, 0.36, d + 0.6, fx, curY + floorH + 0.18, z);
    }

    curY += floorH + 0.18;
  }

  if (registerIndividualCollider) {
    world.addCollider(x, z, w, d, curY, yBase - 2.5);
  }

  // Detalhes na Laje Superior: Vergalhões + Caixa d'Água Azul-Turquesa + Telha de Zinco/Varal + Bandeira do CV
  batcher.addBox('rebar_iron', 0.15, 1.3, 0.15, x - w * 0.44, curY + 0.65, z - d * 0.44);
  batcher.addBox('rebar_iron', 0.15, 1.3, 0.15, x + w * 0.44, curY + 0.65, z + d * 0.44);

  if (seed % 4 !== 3) {
    const tx = x - w * 0.22;
    const tz = z - d * 0.22;
    batcher.addBox('water_tank_blue', 2.0, 1.4, 2.0, tx, curY + 0.7, tz);
    batcher.addBox('water_tank_lid', 2.16, 0.22, 2.16, tx, curY + 1.48, tz);
    world.favelaCDDData.waterTanksCount++;
  }

  if (seed % 3 === 0) {
    batcher.addBox('zinc_roof', w * 0.56, 0.24, d + 0.3, x + w * 0.2, curY + 1.35, z);
  } else if (seed % 2 === 0) {
    batcher.addBox('wire_black', 0.1, 0.1, d * 0.68, x + w * 0.25, curY + 1.3, z);
    batcher.addBox('cv_red', 0.14, 0.65, 1.0, x + w * 0.25, curY + 0.9, z - 0.6);
    batcher.addBox('favela_yellow_faded', 0.14, 0.65, 1.0, x + w * 0.25, curY + 0.9, z + 0.6);
  }

  if (seed % 6 === 0) {
    batcher.addBox('rebar_iron', 0.18, 2.9, 0.18, x + w * 0.35, curY + 1.45, z);
    batcher.addBox('cv_red', 0.16, 1.05, 1.75, x + w * 0.35, curY + 2.4, z + 0.85);
  }

  world.favelaCDDData.housesCount++;
  return { topY: curY, yBase, height: curY - yBase };
}

/**
 * 5. AGRUPA OS BARRACOS EM CLUSTERS COLADOS PAREDE COM PAREDE (4 A 10 CASAS ENCOSTADAS!)
 * - Entre uma casa e outra do mesmo cluster a distância é ZERO (parede com parede e fundo com fundo)!
 * - Entre um cluster de barracos colados e o próximo, sobra APENAS o espaço estreito de 3.5 a 4.8 unidades
 *   para os Becos e Vielas (eliminando todo o chão cinza vazio)!
 */
function buildGluedFavelaHouseClusters(world, batcher) {
  let seed = 1;

  // Verifica se (x, z) cai em cima de uma Ladeira Torta, Viela Transversal ou dos 3 Marcos Comunitários
  const isOnRoadOrLandmark = (x, z) => {
    // 1. Campinho de Futebol da CDD (X = -605, Z = +195)
    if (x >= -642 && x <= -568 && z >= 152 && z <= 238) return true;

    // 2. Quadra do Baile do CV & Paredão (X = -715, Z = -135)
    if (x >= -752 && x <= -678 && z >= -174 && z <= -96) return true;

    // 3. Fortaleza do Barão Vermelho & Caixa d'Água Comunitária (X = -865, Z = -240)
    if (x >= -902 && x <= -828 && z >= -305 && z <= -195) return true;

    // 4. As 8 Ladeiras Tortas / Escadões que sobem serpenteando pela encosta (faixa de 6.2m de folga)
    for (const ladeira of WINDING_LADEIRAS) {
      const lz = getLadeiraZAtX(ladeira, x);
      if (Math.abs(z - lz) < 7.2) return true;
    }

    // 5. As 3 Vielas Transversais Tortas a meia-encosta (beco de 4.2m de largura)
    for (const baseX of [-595, -695, -805]) {
      const vx = baseX + Math.sin(z * 0.018) * 14 + Math.cos(z * 0.009) * 8;
      if (Math.abs(x - vx) < 5.8) return true;
    }

    return false;
  };

  // Percorre a encosta da Favela criando faixas duplas de barracos COLADOS PAREDE COM PAREDE (2 casas fundo-com-fundo em X
  // e 4 a 8 casas coladas parede-com-parede em Z), separadas apenas por Becos Estreitos de 3.8m a 4.6m!
  const minZ = -1295;
  const maxZ = 645;

  // Cada faixa dupla tem ~21m de profundidade em X (duas casas de ~10.5m coladas fundo-com-fundo) + 4.2m de Beco estreito = passo de 25.2m!
  for (let stripCenterX = -552; stripCenterX >= -984; stripCenterX -= 25.2) {
    let curZ = minZ;

    while (curZ < maxZ) {
      const xEastBorder = getFavelaEastBorderX(curZ);
      if (stripCenterX > xEastBorder - 14) {
        curZ += 12;
        continue;
      }

      const elev = getFavelaElevation(stripCenterX, curZ);
      if (elev < 0.45 || isOnRoadOrLandmark(stripCenterX, curZ)) {
        curZ += 6.5;
        continue;
      }

      // Inicia um CLUSTER de 4 a 8 barracos COLADOS PAREDE COM PAREDE ao longo de Z (em fila dupla fundo-com-fundo)!
      seed++;
      const housesInClusterRow = 3 + (seed % 4); // 3 a 6 na frente + 3 a 6 atrás = 6 a 12 casas coladas no cluster!
      const clusterStartZ = curZ;
      let clusterEndZ = curZ;
      let maxClusterTopY = 0;
      let minClusterBaseY = Infinity;
      let builtInCluster = 0;

      for (let c = 0; c < housesInClusterRow; c++) {
        const houseD = 9.2 + ((seed + c) % 3) * 1.4; // 9.2m a 12.0m de largura em Z (coladas sem espaço!)
        const hz = curZ + houseD * 0.5;

        if (
          hz > maxZ ||
          stripCenterX > getFavelaEastBorderX(hz) - 14 ||
          getFavelaElevation(stripCenterX, hz) < 0.45 ||
          isOnRoadOrLandmark(stripCenterX, hz)
        ) {
          break;
        }

        // Duas casas coladas FUNDO COM FUNDO ao longo de X (zero espaço vazio entre elas!)
        const wFront = 10.2 + ((seed + c) % 2) * 1.2;
        const wBack = 10.2 + ((seed + c + 1) % 2) * 1.2;
        const xFront = stripCenterX + wBack * 0.5;
        const xBack = stripCenterX - wFront * 0.5;

        const floorsFront = 1 + ((seed + c * 3) % 4);
        const floorsBack = 2 + ((seed + c * 5) % 3); // Casa de trás geralmente mais alta subindo o morro!

        const resFront = createFavelaHouse(world, batcher, xFront, hz, wFront, houseD + 0.15, floorsFront, seed + c * 2, false);
        const resBack = createFavelaHouse(world, batcher, xBack, hz, wBack, houseD + 0.15, floorsBack, seed + c * 2 + 1, false);

        maxClusterTopY = Math.max(maxClusterTopY, resFront.topY, resBack.topY);
        minClusterBaseY = Math.min(minClusterBaseY, resFront.yBase, resBack.yBase);
        builtInCluster += 2;

        // Avança EXATAMENTE `houseD` (0.0m de espaço entre uma casa e a próxima: 100% parede com parede!)
        curZ += houseD;
        clusterEndZ = curZ;
      }

      if (builtInCluster > 0) {
        world.favelaCDDData.clustersCount++;
        const clusterDepthZ = clusterEndZ - clusterStartZ;
        const clusterMidZ = (clusterStartZ + clusterEndZ) * 0.5;
        const clusterWidthX = 21.5;

        // Registra 1 único Colisor AABB e 1 bloco de Minimapa para o Cluster inteiro de barracos colados!
        world.addCollider(stripCenterX, clusterMidZ, clusterWidthX, clusterDepthZ, maxClusterTopY, minClusterBaseY - 3.0);
        world.mapBuildings.push({
          x: stripCenterX,
          z: clusterMidZ,
          w: clusterWidthX,
          d: clusterDepthZ,
          height: maxClusterTopY - minClusterBaseY,
          color: seed % 4 === 0 ? '#dc2626' : '#c2410c'
        });

        // Planta um Poste de Madeira na quina do Beco com fios pretos ("Gatos de Luz") cruzando para o cluster vizinho!
        const poleX = stripCenterX + clusterWidthX * 0.5 + 1.4;
        const poleZ = clusterEndZ + 1.2;
        const poleY = getFavelaElevation(poleX, poleZ);
        if (poleY > 0.5) {
          batcher.addBox('wood_pole', 0.34, 8.2, 0.34, poleX, poleY + 3.8, poleZ);
          batcher.addBox('wire_black', 4.6, 0.09, 0.09, poleX + 2.1, poleY + 7.2, poleZ);
          batcher.addBox('wire_black', 0.09, 0.09, Math.min(28, clusterDepthZ), poleX, poleY + 7.4, clusterMidZ);
          batcher.addBox('cv_red', 0.55, 0.7, 0.14, poleX + 1.8, poleY + 6.8, poleZ);
        }

        // Deixa APENAS um Beco / Viela estreita de 3.8m a 4.6m de largura antes do próximo Cluster de barracos colados!
        const narrowAlleyWidth = 3.8 + (seed % 3) * 0.4;
        curZ += narrowAlleyWidth;
      } else {
        curZ += 5.0;
      }
    }
  }
}
