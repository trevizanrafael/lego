/**
 * Perfil Supercontinental de Pangeia, Litoral de Areia Contínuo, Arquipélago, Horizonte e Rodovias Regionais
 * Compartilhado entre geração 3D (RoadGridBuilder), física de água/terreno (TestBlockWorld / ThirdPersonController)
 * e mapas 2D da interface (MinimapRenderer e TacticalMapModal).
 */

function smoothstep01(t) {
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

function cosineStep01(t) {
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return 0.5 * (1 - Math.cos(Math.PI * c));
}

export const ARCHIPELAGO_ISLETS = [
  { id: 'islet_nw', name: 'Ilhota do Farol Boreal', x: -3460, z: -2140, rx: 175, rz: 140, peakY: 18, biome: 'forest', seed: 11 },
  { id: 'islet_n_west', name: 'Atol das Auroras', x: -2060, z: -2880, rx: 195, rz: 135, peakY: 12, biome: 'sand', seed: 23 },
  { id: 'islet_n_mid', name: 'Arquipélago Boreal', x: -260, z: -2920, rx: 180, rz: 130, peakY: 16, biome: 'forest', seed: 31 },
  { id: 'islet_n_east', name: 'Recife do Sol Nascente', x: 1120, z: -2890, rx: 185, rz: 130, peakY: 14, biome: 'sand', seed: 37 },
  { id: 'islet_ne', name: 'Rochedo Basalto Tétis', x: 3560, z: -1840, rx: 175, rz: 155, peakY: 24, biome: 'rock', seed: 41 },
  { id: 'islet_tethys_1', name: 'Ilha Central de Tétis', x: 2340, z: 360, rx: 165, rz: 145, peakY: 15, biome: 'forest', seed: 53 },
  { id: 'islet_tethys_2', name: 'Banco Coralino de Tétis', x: 3080, z: 180, rx: 155, rz: 125, peakY: 11, biome: 'sand', seed: 59 },
  { id: 'islet_tethys_south', name: 'Atol dos Piratas', x: 2680, z: 1140, rx: 165, rz: 140, peakY: 14, biome: 'sand', seed: 61 },
  { id: 'islet_w_bay', name: 'Ilhota Baía do Pôr do Sol', x: -3560, z: 180, rx: 170, rz: 140, peakY: 17, biome: 'forest', seed: 67 },
  { id: 'islet_sw', name: 'Cabo dos Navegantes', x: -3480, z: 2420, rx: 185, rz: 145, peakY: 14, biome: 'sand', seed: 73 },
  { id: 'islet_s1', name: 'Cayo Sul', x: -860, z: 1740, rx: 165, rz: 125, peakY: 12, biome: 'sand', seed: 79 },
  { id: 'islet_s2', name: 'Ilhota dos Corais', x: 360, z: 1860, rx: 150, rz: 120, peakY: 15, biome: 'forest', seed: 83 },
  { id: 'islet_se', name: 'Ponta da Sentinela', x: 2560, z: 2120, rx: 175, rz: 155, peakY: 22, biome: 'rock', seed: 97 }
];

export const HORIZON_MOUNTAINS = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * Math.PI * 2 + 0.11;
  const dist = 4850 + ((i * 53) % 7) * 210;
  return {
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
    radius: 560 + ((i * 41) % 5) * 145,
    height: 175 + ((i * 67) % 6) * 44,
    ridgeSkew: ((i % 3) - 1) * 0.25
  };
});

/**
 * Traço supercontinental da Metade Oeste/Norte/Sudoeste da Pangeia (`x <= 538`):
 * - Preserva intactos a calha do Rio Urbano (`x = 538`), a Baía Sul (`z = 1044`), canais (`-384, -120, 252`) e Marina (`-1380`).
 * - Estende-se como um supercontinente assimétrico até Cabo Noroeste (`-3360`), Planalto Boreal Norte (`-2880`)
 *   e Península Sudoeste das Dunas (`-3240, +2460`).
 */
function _buildMainWestPolygon() {
  const pts = [];

  // 1. Margem Oeste do Rio Urbano / Fjord Boreal (Norte -> Sul em x = 538)
  pts.push([538, -2420]);
  pts.push([538, 1044]);

  // 2. Orla Urbana da Praia Sul (+510 -> -1540), mantendo canais & Marina Oeste em mar aberto
  for (let x = 510; x >= -1540; x -= 65) {
    const inCentralBay = x >= -48 && x <= 310;
    const nearCanal =
      Math.abs(x + 384) < 55 ||
      Math.abs(x + 120) < 55 ||
      Math.abs(x - 252) < 55 ||
      Math.abs(x - 220) < 58;
    const nearMarinaBay = Math.abs(x + 1380) < 115;
    let bulge = 10 + Math.max(0, Math.sin(x * 0.0072 + 1.4)) * 46 + Math.max(0, Math.cos(x * 0.016)) * 20;
    if (inCentralBay || nearCanal || nearMarinaBay) {
      bulge = 0;
    }
    const baseSouth = 1044;
    pts.push([Math.round(x), Math.round(baseSouth + bulge)]);
  }

  // 3. Península Sudoeste (Chifre das Dunas / Costa do Pôr do Sol): X -1560..-3320, Z +1020..+2460
  pts.push([-1575, 1140]);
  pts.push([-1640, 1460]);
  pts.push([-1820, 1790]);
  pts.push([-2080, 2140]);
  pts.push([-2360, 2390]);
  pts.push([-2660, 2460]);
  pts.push([-2940, 2340]);
  pts.push([-3160, 2120]);
  pts.push([-3310, 1820]);
  pts.push([-3240, 1460]);
  pts.push([-3040, 1180]);
  pts.push([-3140, 910]);
  pts.push([-2920, 620]);

  // 4. Grande Baía Oeste & Cabo Noroeste (Radar): recorta uma baía funda e projeta um promontório a -3360
  pts.push([-2660, 340]);
  pts.push([-2560, 60]);
  pts.push([-2640, -240]);
  pts.push([-2880, -520]);
  pts.push([-3180, -760]);
  pts.push([-3360, -1040]);
  pts.push([-3320, -1380]);
  pts.push([-3140, -1660]);
  pts.push([-2860, -1910]);

  // 5. Costa Boreal Norte da Pangeia (Penínsulas, Fiordes e Baías de Oeste -> Leste até o Rio x=538)
  pts.push([-2540, -2140]);
  pts.push([-2260, -2360]);
  pts.push([-1920, -2220]);
  pts.push([-1620, -2580]);
  pts.push([-1280, -2860]);
  pts.push([-890, -2760]);
  pts.push([-560, -2480]);
  pts.push([-240, -2310]);
  pts.push([40, -2560]);
  pts.push([310, -2690]);
  pts.push([470, -2540]);

  return pts;
}

/**
 * Chifre Nordeste da Pangeia (Leste do Rio x >= 582):
 * - Cobre Distrito Industrial PCC + Parque Eólico Tétis + Complexo Petroquímico até X = +3340, Z = -2640!
 * - Deixa o Golfo de Tétis aberto em X > 1630, Z = +125..+735 (preservando canal do Porto em (1650, 700)).
 */
function _buildEastPeninsulaPolygon() {
  const pts = [];

  // Margem Leste do Rio / Fjord Norte (Sul -> Norte)
  pts.push([582, 742]);
  pts.push([582, -2420]);

  // Litoral Boreal Nordeste & Contorno do Chifre até o Golfo de Tétis
  pts.push([820, -2580]);
  pts.push([1180, -2460]);
  pts.push([1560, -2640]);
  pts.push([1980, -2560]);
  pts.push([2420, -2380]);
  pts.push([2840, -2140]);
  pts.push([3180, -1820]);
  pts.push([3340, -1420]);
  pts.push([3280, -1040]);
  pts.push([3080, -680]);
  pts.push([2760, -440]);
  pts.push([2420, -260]);
  pts.push([2080, -180]);
  pts.push([1780, -40]);
  pts.push([1658, 95]);

  // Cais Reto do Porto Leste ao lado do canal profundo de atracação (x = 1630, z = 125..725)
  pts.push([1630, 130]);
  pts.push([1630, 725]);
  pts.push([1662, 748]);

  // Orla Sul do Porto / Entrada da Ponte da Prisão (deixando o vão da ponte em x=1375 livre)
  for (let x = 1580; x >= 620; x -= 65) {
    const nearBridge = Math.abs(x - 1375) < 70;
    const cove = nearBridge
      ? 2
      : 10 + Math.max(0, Math.sin(x * 0.008 + 0.6)) * 55 + Math.cos(x * 0.017) * 14;
    pts.push([Math.round(x), Math.round(736 + cove)]);
  }

  return pts;
}

function _buildPrisonIslandPolygon() {
  const pts = [];
  const cx = 1425;
  const cz = 1590;
  const count = 64;
  for (let i = 0; i < count; i++) {
    const th = (i / count) * Math.PI * 2;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    const norm = Math.pow(Math.pow(Math.abs(cos), 3.4) + Math.pow(Math.abs(sin), 3.4), 1 / 3.4);
    const baseRx = 525 / Math.max(0.55, norm);
    const baseRz = 525 / Math.max(0.55, norm);
    const noise =
      22 +
      Math.max(0, Math.sin(th * 7 + 0.4)) * 78 +
      Math.max(0, Math.cos(th * 11 - 0.8)) * 46 +
      Math.sin(th * 17) * 18;
    let x = cx + cos * (baseRx + noise);
    let z = cz + sin * (baseRz + noise * 0.94);
    // Garante portão norte em z ~ 1118 alinhado à Ponte Blindada e Píer Oeste livre em x ~ 950
    if (Math.abs(x - 1375) < 68 && z < 1160) {
      z = Math.max(z, 1116);
    }
    if (x < 955 && Math.abs(z - 1550) < 65) {
      x = Math.max(x, 952);
    }
    pts.push([Math.round(x), Math.round(z)]);
  }
  return pts;
}

export const MAIN_WEST_POLYGON = _buildMainWestPolygon();
export const EAST_PENINSULA_POLYGON = _buildEastPeninsulaPolygon();
export const PRISON_ISLAND_POLYGON = _buildPrisonIslandPolygon();

// Segmentos apenas da costa oceânica externa (excluindo as margens canalizadas do Rio Urbano x=538 / x=582)
function _extractOceanShoreSegments(poly, skipRiverX = null) {
  const segs = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (skipRiverX !== null && Math.abs(a[0] - skipRiverX) < 3 && Math.abs(b[0] - skipRiverX) < 3) {
      continue;
    }
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1) continue;
    segs.push({ ax: a[0], az: a[1], bx: b[0], bz: b[1], dx, dz, lenSq });
  }
  return segs;
}

const _OCEAN_SHORE_SEGMENTS = [
  ..._extractOceanShoreSegments(MAIN_WEST_POLYGON, 538),
  ..._extractOceanShoreSegments(EAST_PENINSULA_POLYGON, 582),
  ..._extractOceanShoreSegments(PRISON_ISLAND_POLYGON, null)
];

/**
 * Rede de Rodovias Inter-Regionais da Pangeia conectando as vias urbanas existentes
 * diretamente aos novos bairros, serras, parque eólico, base radar e costa sudoeste.
 */
export const PANGAEA_HIGHWAYS = [
  {
    id: 'hwy_boreal_spine',
    label: 'RODOVIA BOREAL NORTE',
    width: 24,
    points: [
      [-1215, -1300],
      [-1215, -2150],
      [-1215, -2640]
    ]
  },
  {
    id: 'hwy_boreal_fjord_belt',
    label: 'TRANSVERSAL DO FIORDE BOREAL',
    width: 24,
    points: [
      [-2460, -2150],
      [-1215, -2150],
      [964, -2150],
      [2180, -2150],
      [2680, -1720]
    ]
  },
  {
    id: 'hwy_pcc_north_ext',
    label: 'VIA EXPRESSA INDUSTRIAL NORTE',
    width: 24,
    points: [
      [964, -1305],
      [964, -2150]
    ]
  },
  {
    id: 'hwy_tethys_windfarm',
    label: 'RODOVIA PARQUE EÓLICO DE TÉTIS',
    width: 24,
    points: [
      [1612, -908],
      [2680, -908],
      [2680, -1720]
    ]
  },
  {
    id: 'hwy_nw_radar',
    label: 'RODOVIA CABO NOROESTE (RADAR)',
    width: 24,
    points: [
      [-1790, -1285],
      [-2460, -1285],
      [-3040, -1285]
    ]
  },
  {
    id: 'hwy_west_coast_arc',
    label: 'ESTRADA COSTEIRA DO PÔR DO SOL',
    width: 24,
    points: [
      [-2460, -2150],
      [-2460, -1285],
      [-2460, 710],
      [-2460, 2120]
    ]
  },
  {
    id: 'hwy_sw_dunes_feeder',
    label: 'PROLONGAMENTO BEIRA-MAR & DUNAS',
    width: 24,
    points: [
      [-1810, 710],
      [-2920, 710]
    ]
  }
];

export const PANGAEA_OUTPOST_LANDMARKS = [
  { id: 'lm_boreal', code: 'BOR', icon: 'park', label: 'PLATO BOREAL NORTE', x: -1215, y: 12.5, z: -2420, labelPos: 'top', color: '#4ade80', spawn: { x: -1215, y: 12.5, z: -2420 } },
  { id: 'lm_radar', code: 'RAD', icon: 'airport', label: 'CABO RADAR NOROESTE', x: -2920, y: 14.0, z: -1285, labelPos: 'left', color: '#94a3b8', spawn: { x: -2920, y: 14.0, z: -1285 } },
  { id: 'lm_windfarm', code: 'EOL', icon: 'pcc', label: 'PARQUE EÓLICO & REFINARIA', x: 2680, y: 12.0, z: -1120, labelPos: 'right', color: '#38bdf8', spawn: { x: 2680, y: 12.0, z: -1120 } },
  { id: 'lm_sw_dunes', code: 'DUN', icon: 'beach', label: 'VILA DUNAS SUDOESTE', x: -2460, y: 6.5, z: 2020, labelPos: 'bottom', color: '#fde047', spawn: { x: -2460, y: 6.5, z: 2020 } }
];

export const REGION_BIOME_MAP = [
  { id: 'centro_financeiro', minX: -520, maxX: 520, minZ: -440, maxZ: 140, tint: '#121824', borderTint: '#d99b16', hex: 0x161d2b },
  { id: 'parque_central', minX: -520, maxX: 520, minZ: 140, maxZ: 420, tint: '#0f291a', borderTint: '#2f6e44', hex: 0x1a3822 },
  { id: 'suburbio_norte', minX: -1010, maxX: 538, minZ: -2920, maxZ: -440, tint: '#1b2b18', borderTint: '#9a5b25', hex: 0x223822 },
  { id: 'favela_cdd', minX: -1010, maxX: -520, minZ: -440, maxZ: 420, tint: '#4a1d10', borderTint: '#9f1d20', hex: 0x4d2a1c },
  { id: 'praia_sul', minX: -3420, maxX: 538, minZ: 420, maxZ: 2560, tint: '#57462b', borderTint: '#b48a2c', hex: 0x6e5d40 },
  { id: 'aeroporto_oeste', minX: -3440, maxX: -1010, minZ: -2920, maxZ: 660, tint: '#1e2530', borderTint: '#64748b', hex: 0x28303d },
  { id: 'industrial_leste', minX: 582, maxX: 3420, minZ: -2740, maxZ: 110, tint: '#12213d', borderTint: '#2563eb', hex: 0x1d2533 },
  { id: 'porto_leste', minX: 582, maxX: 1850, minZ: 110, maxZ: 880, tint: '#3d2210', borderTint: '#b45309', hex: 0x2f333d },
  { id: 'ilha_prisao', minX: 800, maxX: 2320, minZ: 1020, maxZ: 2320, tint: '#451215', borderTint: '#b91c1c', hex: 0x333130 }
];

export const REGION_BORDER_LINES = [
  { id: 'border_centro_norte', from: [-520, -440], to: [520, -440], color: '#fb923c', label: 'DIVISA SUBÚRBIO' },
  { id: 'border_centro_parque', from: [-520, 140], to: [520, 140], color: '#4ade80', label: 'LIMITE PARQUE' },
  { id: 'border_parque_sul', from: [-520, 420], to: [520, 420], color: '#fde047', label: 'ORLA SUL' },
  { id: 'border_oeste_aero', from: [-1010, -2780], to: [-1010, 680], color: '#94a3b8', label: 'FRONTEIRA OESTE' },
  { id: 'border_aero_dunas', from: [-3250, 660], to: [-1010, 660], color: '#fde047', label: 'DIVISA DUNAS SUL' },
  { id: 'border_cdd_centro', from: [-520, -440], to: [-520, 420], color: '#ef4444', label: 'ENCOSTA CDD' },
  { id: 'border_boreal_suburbio', from: [-1840, -1320], to: [1640, -1320], color: '#4ade80', label: 'PORTAL BOREAL NORTE' },
  { id: 'border_ind_porto', from: [582, 110], to: [1760, 110], color: '#f59e0b', label: 'DIVISA PORTO/PCC' },
  { id: 'border_ind_eolico', from: [1630, -1320], to: [1630, 110], color: '#38bdf8', label: 'SETOR EÓLICO TÉTIS' }
];

export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const zi = poly[i][1];
    const xj = poly[j][0];
    const zj = poly[j][1];
    const intersect =
      (zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function getIsletSampleAt(x, z) {
  for (const isl of ARCHIPELAGO_ISLETS) {
    const nx = Math.abs(x - isl.x) / isl.rx;
    const nz = Math.abs(z - isl.z) / isl.rz;
    const maxN = Math.max(nx, nz);
    if (maxN > 0.925) continue;
    const midH = Math.max(2.2, isl.peakY * 0.52);
    let height = 0.3;
    if (maxN <= 0.36) height = isl.peakY;
    else if (maxN <= 0.675) height = midH;
    return { islet: isl, height, distRatio: maxN / 0.925 };
  }
  return null;
}

export function isInsideBuiltUrbanCore(x, z) {
  // Retângulos urbanos originais onde RoadGridBuilder/regions constróem as ruas e prédios
  if (x >= -1824.5 && x <= 539.5 && z >= -1319.5 && z <= 779.5) return true;
  if (x >= 580.5 && x <= 1627.5 && z >= -1319.5 && z <= 734.5) return true;
  if (x >= 954 && x <= 1796 && z >= 1117 && z <= 1981) return true;
  return false;
}

export function isPointOnOrganicLand(x, z) {
  if (x >= -3420 && x <= 544 && z >= -2920 && z <= 2520) {
    if (pointInPolygon(x, z, MAIN_WEST_POLYGON)) return true;
  }
  if (x >= 578 && x <= 3400 && z >= -2720 && z <= 845) {
    if (pointInPolygon(x, z, EAST_PENINSULA_POLYGON)) return true;
  }
  if (x >= 780 && x <= 2320 && z >= 1010 && z <= 2320) {
    if (pointInPolygon(x, z, PRISON_ISLAND_POLYGON)) return true;
  }
  if (getIsletSampleAt(x, z)) return true;
  return false;
}

/**
 * Distância (m) até o segmento de costa oceânica externa mais próximo (para faixa contínua de areia).
 */
export function getDistanceToCoastAt(x, z) {
  let minDistSq = Infinity;
  for (let i = 0; i < _OCEAN_SHORE_SEGMENTS.length; i++) {
    const s = _OCEAN_SHORE_SEGMENTS[i];
    const tRaw = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.lenSq;
    const t = tRaw <= 0 ? 0 : tRaw >= 1 ? 1 : tRaw;
    const px = s.ax + t * s.dx;
    const pz = s.az + t * s.dz;
    const dSq = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (dSq < minDistSq) minDistSq = dSq;
  }
  return Math.sqrt(minDistSq);
}

export function getHighwayDistanceAt(x, z) {
  let bestDist = Infinity;
  for (let h = 0; h < PANGAEA_HIGHWAYS.length; h++) {
    const pts = PANGAEA_HIGHWAYS[h].points;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0];
      const az = pts[i][1];
      const bx = pts[i + 1][0];
      const bz = pts[i + 1][1];
      const dx = bx - ax;
      const dz = bz - az;
      const lenSq = dx * dx + dz * dz || 1;
      const tRaw = ((x - ax) * dx + (z - az) * dz) / lenSq;
      const t = tRaw <= 0 ? 0 : tRaw >= 1 ? 1 : tRaw;
      const d = Math.hypot(x - (ax + t * dx), z - (az + t * dz));
      if (d < bestDist) bestDist = d;
    }
  }
  return bestDist;
}

function _computeRawOuterHillY(x, z) {
  // Planícies & morros suaves por região sem depender de colinas abruptas
  let peak = 18.0;
  let freqScale = 1.0;
  if (x > 1600) {
    // Chifre Nordeste (Tétis Industrial & Eólico): serra média industrial/eólica
    peak = 16.5;
    freqScale = 0.92;
  } else if (z > 650 && x < -1500) {
    // Península Sudoeste: dunas suaves e baixas
    peak = 8.5;
    freqScale = 1.15;
  } else if (z < -1320 && x > -1500 && x < 700) {
    // Terras Altas Boreais ao Norte
    peak = 24.0;
    freqScale = 0.85;
  } else if (x < -2100 && z < 650) {
    // Cabo Noroeste Rochoso
    peak = 21.0;
    freqScale = 1.05;
  }

  const w1 = Math.sin(x * 0.0022 * freqScale + 0.5) * Math.cos(z * 0.0024 * freqScale - 0.3);
  const w2 = Math.sin((x + z) * 0.0041 + 1.1) * 0.45;
  const ridge = Math.max(0, 0.48 + 0.52 * (w1 * 0.72 + w2 * 0.28));
  return peak * ridge;
}

/**
 * Elevação contínua (m) das terras externas da Pangeia com:
 * - Suavização para 0m junto ao perímetro urbano (ou empate de 22m ao norte do Subúrbio)
 * - Nivelamento suave ao longo das Rodovias (`getHighwayDistanceAt`)
 * - Rampa contínua de praia de areia até Y = -0.55m na beira do mar (transição natural sem degrau!)
 */
export function getPangaeaElevationAt(x, z) {
  if (isInsideBuiltUrbanCore(x, z)) return 0;
  if (x >= 536 && x <= 584 && z >= -2920 && z <= 1085) return 0; // Calha do Rio / Fjord

  const insideMainOrEast =
    (x >= -3420 && x <= 544 && z >= -2920 && z <= 2520 && pointInPolygon(x, z, MAIN_WEST_POLYGON)) ||
    (x >= 578 && x <= 3400 && z >= -2720 && z <= 845 && pointInPolygon(x, z, EAST_PENINSULA_POLYGON)) ||
    (x >= 780 && x <= 2320 && z >= 1010 && z <= 2320 && pointInPolygon(x, z, PRISON_ISLAND_POLYGON));

  const coastDist = getDistanceToCoastAt(x, z);
  if (!insideMainOrEast) {
    // Talude de areia submerso até 22m mar adentro (-0.15m na beira até -0.60m sob o oceano)
    if (coastDist > 26) return -0.6;
    const tOut = smoothstep01(coastDist / 26);
    return 0.12 * (1 - tOut) + -0.6 * tOut;
  }

  // Máscara de transição para encostar suavemente no perímetro urbano sem muro/degrau
  let edgeDist = Infinity;
  if (z <= -1319.5 && x >= -1825 && x <= 1628) {
    edgeDist = Math.min(edgeDist, -1319.5 - z);
  }
  if (x <= -1824.5 && z >= -1325 && z <= 785) {
    edgeDist = Math.min(edgeDist, -1824.5 - x);
  }
  if (x >= 1627.5 && z >= -1325 && z <= 740) {
    edgeDist = Math.min(edgeDist, x - 1627.5);
  }
  if (z >= 779.5 && x >= -1825 && x <= -1540) {
    edgeDist = Math.min(edgeDist, z - 779.5);
  }
  const urbanBlend = edgeDist < 190 ? cosineStep01(edgeDist / 190) : 1.0;

  // Empata com o platô do Subúrbio Norte quando logo acima de Z = -1320 (X = -658..+536)
  let northPlateauCarry = 0;
  if (z < -1318 && z > -1620 && x > -658 && x < 540) {
    const fadeZ = 1.0 - cosineStep01((-1318 - z) / 300);
    const fadeX =
      x < -636
        ? smoothstep01((x - -658) / 22)
        : x > 514
          ? 1 - smoothstep01((x - 514) / 26)
          : 1;
    northPlateauCarry = 21.5 * fadeZ * fadeX;
  }

  let baseH = _computeRawOuterHillY(x, z) * urbanBlend + northPlateauCarry;

  // Nivela suavemente o leito das Rodovias da Pangeia (cota confortável 2.5m..12m longe da costa)
  const hwyDist = getHighwayDistanceAt(x, z);
  if (hwyDist < 42) {
    const hwyFlat =
      z < -1900 && x > -1800 && x < 2400 ? 11.5 : z < -1320 && x < -600 ? 8.5 : 4.2;
    const hwyDeckY = hwyFlat * urbanBlend;
    const roadMask = 1.0 - cosineStep01((hwyDist - 14) / 28);
    baseH = baseH * (1 - roadMask) + hwyDeckY * roadMask;
  }

  // Margem de areia contínua (~54m) descendo em curva quadrática suave até a água (Y = +0.14m na linha d'água!)
  if (coastDist < 54) {
    const shoreT = cosineStep01(coastDist / 54);
    baseH = 0.14 + baseH * (shoreT * shoreT);
  } else {
    baseH = Math.max(0.35, baseH);
  }

  // Zera suavemente ao chegar nas ombreiras do Fjord (x=526..594) para a Ponte Boreal em nível exato Y=0
  const riverDist = Math.abs(x - 560);
  if (z < -1318 && riverDist < 126) {
    if (riverDist <= 36) return 0;
    const rt = cosineStep01((riverDist - 36) / 90);
    baseH *= rt;
  }

  return baseH;
}

export function getRegionBiomeHexAt(x, z) {
  for (const reg of REGION_BIOME_MAP) {
    if (x >= reg.minX && x <= reg.maxX && z >= reg.minZ && z <= reg.maxZ) {
      return reg.hex;
    }
  }
  return 0x4d8b31;
}

export function getWorldSoftBoundaryForce(x, z) {
  // Limite natural amplo no oceano aberto ao redor da Pangeia e ilhotas
  const softX = 3950;
  const hardX = 4350;
  const softMinZ = -3250;
  const hardMinZ = -3620;
  const softMaxZ = 2850;
  const hardMaxZ = 3220;

  let fx = 0;
  let fz = 0;
  let intensity = 0;

  if (Math.abs(x) > softX) {
    const t = Math.min(1, (Math.abs(x) - softX) / (hardX - softX));
    fx = -Math.sign(x) * t;
    intensity = Math.max(intensity, t);
  }
  if (z < softMinZ) {
    const t = Math.min(1, (softMinZ - z) / (softMinZ - hardMinZ));
    fz = t;
    intensity = Math.max(intensity, t);
  } else if (z > softMaxZ) {
    const t = Math.min(1, (z - softMaxZ) / (hardMaxZ - softMaxZ));
    fz = -t;
    intensity = Math.max(intensity, t);
  }

  return { fx, fz, intensity, hardBounds: { minX: -hardX, maxX: hardX, minZ: hardMinZ, maxZ: hardMaxZ } };
}
