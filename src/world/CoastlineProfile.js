/**
 * Perfil Orgânico Único da Costa, Ilhotas do Arquipélago, Horizonte e Fronteiras de Região
 * Compartilhado entre a geração 3D (RoadGridBuilder), física de água/terreno (TestBlockWorld)
 * e mapas 2D da interface (MinimapRenderer e TacticalMapModal).
 */

export const ARCHIPELAGO_ISLETS = [
  { id: 'islet_nw', name: 'Ilhota do Farol Norte', x: -2240, z: -960, rx: 145, rz: 120, peakY: 16, biome: 'forest', seed: 11 },
  { id: 'islet_n_west', name: 'Atol dos Ventos', x: -1160, z: -1800, rx: 165, rz: 115, peakY: 11, biome: 'sand', seed: 23 },
  { id: 'islet_n_east', name: 'Recife do Sol', x: 240, z: -1780, rx: 155, rz: 110, peakY: 13, biome: 'forest', seed: 37 },
  { id: 'islet_ne', name: 'Rochedo Basalto', x: 2020, z: -1080, rx: 145, rz: 135, peakY: 22, biome: 'rock', seed: 41 },
  { id: 'islet_e', name: 'Ilhota do Canal Leste', x: 2140, z: -120, rx: 125, rz: 115, peakY: 10, biome: 'sand', seed: 53 },
  { id: 'islet_sw', name: 'Banco de Areia Oeste', x: -2140, z: 1240, rx: 160, rz: 130, peakY: 14, biome: 'sand', seed: 67 },
  { id: 'islet_s1', name: 'Cayo Sul', x: -860, z: 1620, rx: 150, rz: 115, peakY: 12, biome: 'sand', seed: 79 },
  { id: 'islet_s2', name: 'Ilhota dos Corais', x: 520, z: 1680, rx: 140, rz: 110, peakY: 15, biome: 'forest', seed: 83 },
  { id: 'islet_se', name: 'Ponta da Sentinela', x: 2160, z: 1560, rx: 155, rz: 145, peakY: 20, biome: 'rock', seed: 97 }
];

export const HORIZON_MOUNTAINS = Array.from({ length: 20 }, (_, i) => {
  const angle = (i / 20) * Math.PI * 2 + 0.14;
  const dist = 2850 + ((i * 53) % 7) * 145;
  return {
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
    radius: 390 + ((i * 41) % 5) * 95,
    height: 125 + ((i * 67) % 6) * 32,
    ridgeSkew: ((i % 3) - 1) * 0.25
  };
});

// Contornos orgânicos calculados fora das bordas funcionais existentes (zero colisão com ruas/prédios/canais!)
function _northWave(x, seed = 0) {
  return (
    18 +
    Math.max(0, Math.sin(x * 0.0052 + seed)) * 78 +
    Math.max(0, Math.cos(x * 0.0135 - seed * 0.7)) * 42 +
    Math.sin(x * 0.029 + 1.2) * 12
  );
}

function _westWave(z) {
  return (
    16 +
    Math.max(0, Math.sin(z * 0.0056 + 0.9)) * 74 +
    Math.max(0, Math.cos(z * 0.0142 + 0.4)) * 38 +
    Math.sin(z * 0.027 - 0.5) * 11
  );
}

function _eastIndWave(z) {
  return (
    14 +
    Math.max(0, Math.sin(z * 0.0068 - 0.4)) * 72 +
    Math.max(0, Math.cos(z * 0.0155 + 1.1)) * 36 +
    Math.sin(z * 0.031) * 10
  );
}

function _buildMainWestPolygon() {
  const pts = [];
  // 1. Costa Norte (-1850 -> +536)
  for (let x = -1845; x <= 525; x += 65) {
    const zEdge = -1324 - _northWave(x, 0.35);
    pts.push([Math.round(x), Math.round(zEdge)]);
  }
  pts.push([538, -1326]);

  // 2. Margem Oeste do Rio Urbano (retilínea apenas ao longo do leito do rio canalizado)
  pts.push([538, 1044]);

  // 3. Orla da Praia Sul (+520 -> -1780), mantendo livres os canais (-384,-120,252), Píer (0) e enseada central (60..310)
  for (let x = 510; x >= -1760; x -= 65) {
    const inCentralBay = x >= -48 && x <= 310;
    const nearCanal =
      Math.abs(x + 384) < 55 ||
      Math.abs(x + 120) < 55 ||
      Math.abs(x - 252) < 55 ||
      Math.abs(x - 220) < 58;
    const nearMarinaBay = Math.abs(x + 1380) < 110;
    let bulge = 10 + Math.max(0, Math.sin(x * 0.0072 + 1.4)) * 48 + Math.max(0, Math.cos(x * 0.016)) * 22;
    if (inCentralBay || nearCanal || nearMarinaBay) {
      bulge = 0;
    }
    const baseSouth = x < -1580 ? 1018 : 1044;
    pts.push([Math.round(x), Math.round(baseSouth + bulge)]);
  }

  // 4. Promontório Sudoeste do Farol (-1735, 945) & Costa Oeste até Norte
  pts.push([-1840, 1010]);
  pts.push([-1885, 940]);
  pts.push([-1860, 860]);
  for (let z = 800; z >= -1300; z -= 65) {
    const xEdge = -1828 - _westWave(z);
    pts.push([Math.round(xEdge), Math.round(z)]);
  }
  return pts;
}

function _buildEastPeninsulaPolygon() {
  const pts = [];
  // Margem Leste do Rio (582)
  pts.push([582, 742]);
  pts.push([582, -1324]);

  // Costa Norte do Distrito PCC
  for (let x = 620; x <= 1620; x += 65) {
    const zEdge = -1324 - _northWave(x, -0.9) * 0.88;
    pts.push([Math.round(x), Math.round(zEdge)]);
  }
  pts.push([1665, -1315]);

  // Costa Leste Industrial (recortada entre -1280 e 90; depois Cais do Porto até 730)
  for (let z = -1240; z <= 80; z += 65) {
    const xEdge = 1632 + _eastIndWave(z);
    pts.push([Math.round(xEdge), Math.round(z)]);
  }
  // Quebra-mar norte e sul do Porto deixando o canal de atracação (x=1628..1650) livre
  pts.push([1658, 105]);
  pts.push([1630, 130]);
  pts.push([1630, 725]);
  pts.push([1662, 748]);

  // Orla Sul do Porto / Entrada da Ponte da Prisão (deixando vão da ponte em x=1375 claro)
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
  const cx = 1375;
  const cz = 1555;
  const count = 64;
  for (let i = 0; i < count; i++) {
    const th = (i / count) * Math.PI * 2;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    // Super-elipse quadrática com recortes costeiros garantindo toda a muralha 955..1795 x 1125..1985 dentro
    const norm = Math.pow(Math.pow(Math.abs(cos), 3.6) + Math.pow(Math.abs(sin), 3.6), 1 / 3.6);
    const baseRx = 468 / Math.max(0.55, norm);
    const baseRz = 472 / Math.max(0.55, norm);
    const noise =
      18 +
      Math.max(0, Math.sin(th * 7 + 0.4)) * 58 +
      Math.max(0, Math.cos(th * 11 - 0.8)) * 34 +
      Math.sin(th * 17) * 14;
    let x = cx + cos * (baseRx + noise);
    let z = cz + sin * (baseRz + noise * 0.92);
    // Achatamento suave na frente do portão norte (z ~ 1125) para encaixar na Ponte Blindada
    if (Math.abs(x - 1375) < 60 && z < 1160) {
      z = Math.max(z, 1118);
    }
    pts.push([Math.round(x), Math.round(z)]);
  }
  return pts;
}

export const MAIN_WEST_POLYGON = _buildMainWestPolygon();
export const EAST_PENINSULA_POLYGON = _buildEastPeninsulaPolygon();
export const PRISON_ISLAND_POLYGON = _buildPrisonIslandPolygon();

export const REGION_BIOME_MAP = [
  { id: 'centro_financeiro', minX: -520, maxX: 520, minZ: -440, maxZ: 140, tint: '#1e293b', borderTint: '#facc15', hex: 0x263143 },
  { id: 'parque_central', minX: -520, maxX: 520, minZ: 140, maxZ: 420, tint: '#14532d', borderTint: '#4ade80', hex: 0x2f7d3a },
  { id: 'suburbio_norte', minX: -640, maxX: 538, minZ: -1460, maxZ: -440, tint: '#3f6212', borderTint: '#fb923c', hex: 0x4d8b31 },
  { id: 'favela_cdd', minX: -1010, maxX: -520, minZ: -440, maxZ: 420, tint: '#7c2d12', borderTint: '#ef4444', hex: 0x8d4930 },
  { id: 'praia_sul', minX: -1890, maxX: 538, minZ: 420, maxZ: 1135, tint: '#a16207', borderTint: '#fde047', hex: 0xd9b86c },
  { id: 'aeroporto_oeste', minX: -1970, maxX: -1010, minZ: -1460, maxZ: 740, tint: '#334155', borderTint: '#94a3b8', hex: 0x475569 },
  { id: 'industrial_leste', minX: 582, maxX: 1765, minZ: -1440, maxZ: 110, tint: '#1e3a8a', borderTint: '#3b82f6', hex: 0x334155 },
  { id: 'porto_leste', minX: 582, maxX: 1665, minZ: 110, maxZ: 820, tint: '#78350f', borderTint: '#f59e0b', hex: 0x52525b },
  { id: 'ilha_prisao', minX: 830, maxX: 1920, minZ: 1060, maxZ: 2100, tint: '#7f1d1d', borderTint: '#f87171', hex: 0x57534e }
];

export const REGION_BORDER_LINES = [
  { id: 'border_centro_norte', from: [-520, -440], to: [520, -440], color: '#fb923c', label: 'DIVISA SUBÚRBIO' },
  { id: 'border_centro_parque', from: [-520, 140], to: [520, 140], color: '#4ade80', label: 'LIMITE PARQUE' },
  { id: 'border_parque_sul', from: [-520, 420], to: [520, 420], color: '#fde047', label: 'ORLA SUL' },
  { id: 'border_oeste_aero', from: [-1010, -1340], to: [-1010, 680], color: '#94a3b8', label: 'PERÍMETRO AÉREO' },
  { id: 'border_cdd_centro', from: [-520, -440], to: [-520, 420], color: '#ef4444', label: 'ENCOSTA CDD' },
  { id: 'border_ind_porto', from: [582, 110], to: [1630, 110], color: '#f59e0b', label: 'DIVISA PORTO/PCC' }
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

export function isPointOnOrganicLand(x, z) {
  if (x >= -1995 && x <= 545 && z >= -1480 && z <= 1140) {
    if (pointInPolygon(x, z, MAIN_WEST_POLYGON)) return true;
  }
  if (x >= 578 && x <= 1785 && z >= -1460 && z <= 845) {
    if (pointInPolygon(x, z, EAST_PENINSULA_POLYGON)) return true;
  }
  if (x >= 815 && x <= 1935 && z >= 1055 && z <= 2120) {
    if (pointInPolygon(x, z, PRISON_ISLAND_POLYGON)) return true;
  }
  if (getIsletSampleAt(x, z)) return true;
  return false;
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
  // Limite natural suave ao se afastar pelo oceano aberto além do arquipélago
  const softX = 2580;
  const hardX = 2850;
  const softMinZ = -2050;
  const hardMinZ = -2320;
  const softMaxZ = 2280;
  const hardMaxZ = 2560;

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
