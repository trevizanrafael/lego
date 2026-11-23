/**
 * CityRoadNetworkSpec.js
 * Especificação unificada e determinística da Hierarquia Viária da Ilha (`WORLD_SCALE = 3`):
 *  - 4 Níveis Hierárquicos (`expressway`, `arterial`, `collector`, `local`)
 *  - Preservação integral da malha orgânica do Centro + Transição Norte (Broadway, Diagonal Leste,
 *    4 Rotatórias, Curvas em S, Cotovelos, 8 Esquinas Flatiron e Keepouts de Marcos/Metrô)
 *  - Conectores arteriais, coletores e locais inter-distritais suaves (Subúrbio Norte, Corredor
 *    Rodoviário do Aeroporto Oeste, Avenida Marginal do Canal Industrial/Porto Leste e Orla Sul)
 *  - Catálogo de Praças Triangulares / Ilhas Gore (`triangularPlazas`) fora das faixas de rolamento
 *  - Diagnóstico completo de conectividade A-Star / BFS inter-bairros e auditoria de inclinação longitudinal
 */

import { METRO_ISLAND_CUTOUTS, getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { PANGAEA_HIGHWAYS, getPangaeaElevationAt } from '../CoastlineProfile.js';
import { IS_SCALED_WORLD, ROAD, ws, MAIN_AVENUES_X, MAIN_AVENUES_Z, SECONDARY_STREETS_X, SECONDARY_STREETS_Z, INDUSTRIAL_STREETS_X } from '../core/WorldLayoutScale.js';
import { RIVER_BRIDGE_SPECS, PANGAEA_BRIDGE_SPECS } from './BridgeAndPierSpecs.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import { WINDING_LADEIRAS, getFavelaEastBorderX, getFavelaElevation, getLadeiraZAtX } from '../regions/favela-cdd/FavelaElevationAndBatcher.js';
import { ensurePoliceRoadGraph, findRoadPathAStar, findNearestRoadNode } from '../police/PoliceRoadGraph.js';

export const ROAD_HIERARCHY_TIERS = Object.freeze(['expressway', 'arterial', 'collector', 'local']);

export const ROAD_TIER_SPECS = Object.freeze({
  expressway: Object.freeze({ tier: 'expressway', defaultWidth: 34, sidewalk: 0, maxSlope: 0.12, isMain: true }),
  arterial: Object.freeze({ tier: 'arterial', defaultWidth: 28, sidewalk: 10, maxSlope: 0.12, isMain: true }),
  collector: Object.freeze({ tier: 'collector', defaultWidth: 26, sidewalk: 10, maxSlope: 0.12, isMain: false }),
  local: Object.freeze({ tier: 'local', defaultWidth: 18, sidewalk: 8, maxSlope: 0.12, ladeiraMaxSlope: 0.18, isMain: false })
});

export const DOWNTOWN_GRID_COLS_DESIGN = Object.freeze([-516, -384, -252, -120, 0, 120, 252, 384, 516]);
export const DOWNTOWN_GRID_ROWS_DESIGN = Object.freeze([-512, -382, -250, -117, 0, 134]);

export function getDowntownProtectedKeepouts() {
  if (!IS_SCALED_WORLD) return [];
  const base = [
    { id: 'super_bank_and_m01', minX: -110, maxX: 110, minZ: -748, maxZ: -314 },
    { id: 'metro_west_portal', minX: -270, maxX: -222, minZ: -692, maxZ: -596 },
    { id: 'metro_east_portal', minX: 222, maxX: 270, minZ: -692, maxZ: -596 },
    { id: 'hero_tower_complex', minX: -1044, maxX: -886, minZ: -594, maxZ: -434 },
    { id: 'hero_cracked_wall', minX: -804, maxX: -762, minZ: -400, maxZ: -360 },
    { id: 'lego_customs', minX: 10, maxX: 150, minZ: -1304, maxZ: -1156 },
    { id: 'viaduct1_central_ramp', minX: -32, maxX: 32, minZ: -1158, maxZ: -1034 },
    { id: 'metro_m02', minX: -258, maxX: -192, minZ: 12, maxZ: 48 },
    { id: 'metro_m03', minX: -1165, maxX: -1118, minZ: -262, maxZ: -88 },
    { id: 'metro_m05', minX: 1512, maxX: 1562, minZ: -622, maxZ: -446 },
    { id: 'ts_fences', minX: -54, maxX: 54, minZ: -44, maxZ: -16 }
  ];
  for (let i = 0; i < METRO_ISLAND_CUTOUTS.length; i++) {
    const c = METRO_ISLAND_CUTOUTS[i];
    base.push({ id: `cutout_${c.id}`, minX: c.minX - 5.5, maxX: c.maxX + 5.5, minZ: c.minZ - 5.5, maxZ: c.maxZ + 5.5 });
  }
  return base;
}

export function getIslandLandmarkKeepouts() {
  if (!IS_SCALED_WORLD) return [];
  return [
    ...getDowntownProtectedKeepouts(),
    { id: 'airport_runway_09_27', minX: ws(-1660) - 56, maxX: ws(-1660) + 56, minZ: -910, maxZ: 910 },
    { id: 'airport_mega_terminal', minX: ws(-1145) - 52, maxX: ws(-1145) + 52, minZ: -486, maxZ: 486 },
    { id: 'pcc_central_citadel', minX: ws(866) - 96, maxX: ws(866) + 96, minZ: ws(-316) - 128, maxZ: ws(-316) + 128 },
    { id: 'ares_port_base', minX: ws(995) - 150, maxX: ws(995) + 150, minZ: ws(622) - 72, maxZ: ws(622) + 72 },
    { id: 'favela_baile_plaza', minX: ws(-715) - 50, maxX: ws(-715) + 50, minZ: ws(-135) - 50, maxZ: ws(-135) + 50 },
    { id: 'favela_red_baron_summit', minX: ws(-865) - 58, maxX: ws(-865) + 58, minZ: ws(-240) - 58, maxZ: ws(-240) + 58 },
    { id: 'favela_soccer_varzea', minX: ws(-605) - 36, maxX: ws(-605) + 36, minZ: ws(195) - 46, maxZ: ws(195) + 46 }
  ];
}

const halfRoadX = (dx) => (Math.abs(dx) === 516 ? ROAD.secondaryWidth : ROAD.mainWidth) * 0.5;
const halfRoadZ = (dz) => (dz === -512 ? ROAD.secondaryWidth : ROAD.mainWidth) * 0.5;

export function getSuperBlockAsphaltFreeBounds(colIdx, rowIdx) {
  const dx0 = DOWNTOWN_GRID_COLS_DESIGN[colIdx], dx1 = DOWNTOWN_GRID_COLS_DESIGN[colIdx + 1];
  const dz0 = DOWNTOWN_GRID_ROWS_DESIGN[rowIdx], dz1 = DOWNTOWN_GRID_ROWS_DESIGN[rowIdx + 1];
  return {
    colIdx, rowIdx, dx0, dx1, dz0, dz1,
    minX: ws(dx0) + halfRoadX(dx0), maxX: ws(dx1) - halfRoadX(dx1),
    minZ: ws(dz0) + halfRoadZ(dz0), maxZ: ws(dz1) - halfRoadZ(dz1)
  };
}

function sampleSCurvePoints(x0, z0, x1, z1, amp, alongAxis = 'x', steps = 7) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wave = Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * amp;
    const px = alongAxis === 'x' ? x0 + (x1 - x0) * t : x0 + (x1 - x0) * t + wave;
    const pz = alongAxis === 'x' ? z0 + (z1 - z0) * t + wave : z0 + (z1 - z0) * t;
    pts.push([Math.round(px * 10) / 10, Math.round(pz * 10) / 10]);
  }
  return pts;
}

function buildTriangularPlazaEntry(id, district, pts, treeCount = 2) {
  const cx = Math.round(((pts[0][0] + pts[1][0] + pts[2][0]) / 3) * 10) / 10;
  const cz = Math.round(((pts[0][1] + pts[1][1] + pts[2][1]) / 3) * 10) / 10;
  const xs = [pts[0][0], pts[1][0], pts[2][0]], zs = [pts[0][1], pts[1][1], pts[2][1]];
  let minEdgeDist = Infinity;
  for (let i = 0; i < 3; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 3];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const dist = Math.abs((cx - ax) * -dz + (cz - az) * dx) / len;
    if (dist < minEdgeDist) minEdgeDist = dist;
  }
  return Object.freeze({
    id, district, points: pts, cx, cz, treeCount,
    inradius: Math.max(2.6, Math.round(minEdgeDist * 10) / 10),
    colliderR: Math.max(2.4, Math.min(6.5, minEdgeDist * 0.62)),
    minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs)
  });
}

let _cachedUnified = null;
let _cachedUnifiedKey = null;

export function getUnifiedCityRoadNetwork() {
  const scaleKey = `${IS_SCALED_WORLD}_${ROAD.mainWidth}_${ROAD.sidewalk}`;
  if (_cachedUnified && _cachedUnifiedKey === scaleKey) return _cachedUnified;

  if (!IS_SCALED_WORLD) {
    _cachedUnified = {
      tiers: { expressway: [], arterial: [], collector: [], local: [] },
      polylines: [], roundabouts: [], segments: [], triangularPlazas: [], flatironCorners: [], keepouts: [], islandKeepouts: []
    };
    _cachedUnifiedKey = scaleKey;
    return _cachedUnified;
  }

  const polylines = [], roundabouts = [];
  const secW = ROAD.secondaryWidth, diagW = 28, sw = ROAD.sidewalk;

  const addPoly = (id, points, width = secW, isMain = false, opts = {}) => {
    const tier = opts.tier || (isMain ? 'arterial' : 'collector');
    const sidewalk = opts.sidewalk ?? sw;
    polylines.push({
      kind: 'polyline', id, points, width, halfWidth: width * 0.5, sidewalk, isMain, tier,
      district: opts.district || 'centro_financeiro',
      isInterDistrict: Boolean(opts.isInterDistrict),
      blockHint: opts.blockHint || null
    });
  };

  const addRoundabout = (id, cx, cz, innerR = 14, outerR = 38, monumentKind = 'obelisk', district = 'centro_financeiro') => {
    roundabouts.push({ kind: 'roundabout', id, cx, cz, innerR, outerR, sidewalk: sw, monumentKind, tier: 'collector', district });
  };

  // 1. GRANDES AVENIDAS DIAGONAIS ARTERIAIS DO CENTRO
  addPoly('broadway_metro_nw_se', [[-1056, -1146], [-846, -750], [-756, -605], [-456, -351], [-360, -210], [-108, 0], [0, 168], [186, 402]], diagW, true, { tier: 'arterial' });
  addPoly('boulevard_diag_ne_sw', [[1440, -1146], [1152, -882], [996, -750], [756, -510], [546, -351], [360, -168], [168, 0]], diagW, true, { tier: 'arterial' });

  const flatironCorners = [
    { id: 'flatiron_bway_nw', cx: -1086, cz: -1062, backWidth: 32, noseWidth: 6.0, length: 52, rotY: -0.24, height: 126, styleKey: 'black_granite_gold' },
    { id: 'flatiron_bway_hero_e', cx: -690, cz: -658, backWidth: 34, noseWidth: 6.2, length: 54, rotY: 2.38, height: 168, styleKey: 'sapphire_glass' },
    { id: 'flatiron_bway_ts_w', cx: -498, cz: -292, backWidth: 34, noseWidth: 6.2, length: 52, rotY: -0.68, height: 158, styleKey: 'cyan_modern' },
    { id: 'flatiron_bway_ts_c', cx: -168, cz: -56, backWidth: 36, noseWidth: 6.5, length: 56, rotY: 2.42, height: 174, styleKey: 'black_granite_gold' },
    { id: 'flatiron_bway_park', cx: 124, cz: 336, backWidth: 34, noseWidth: 6.2, length: 52, rotY: 2.52, height: 144, styleKey: 'emerald_steel' },
    { id: 'flatiron_east_ne', cx: 1368, cz: -1076, backWidth: 32, noseWidth: 6.0, length: 50, rotY: 0.78, height: 104, styleKey: 'silver_corporate' },
    { id: 'flatiron_east_fin', cx: 616, cz: -414, backWidth: 35, noseWidth: 6.4, length: 54, rotY: -2.35, height: 156, styleKey: 'black_granite_gold' },
    { id: 'flatiron_east_ts', cx: 232, cz: -62, backWidth: 35, noseWidth: 6.2, length: 54, rotY: -2.38, height: 164, styleKey: 'sapphire_glass' }
  ];

  // 2. 4 ROTATÓRIAS CIRCULARES URBANAS ("ROUNDABOUTS") + RAIOS ANGULADOS
  addRoundabout('rb_west_times_sq', -1356, -172, 14, 38, 'obelisk');
  addPoly('rb1_spoke_w', [[-1535, -196], [-1390, -176]]);
  addPoly('rb1_spoke_n', [[-1372, -334], [-1360, -206]]);
  addPoly('rb1_spoke_s', [[-1334, -138], [-1308, -17]]);
  addPoly('rb1_spoke_se', [[-1322, -154], [-1169, -46]]);

  addRoundabout('rb_east_park_view', 960, 204, 14, 38, 'fountain');
  addPoly('rb2_spoke_n', [[936, 17], [955, 169]]);
  addPoly('rb2_spoke_e', [[995, 196], [1135, 156]]);
  addPoly('rb2_spoke_s', [[966, 239], [1002, 385]]);
  addPoly('rb2_spoke_nw_curve', [[828, 17], [886, 118], [932, 182]]);

  addRoundabout('rb_trans_nw', -558, -1342, 13, 36, 'fountain', 'suburbio_norte');
  addPoly('rb3_spoke_n', [[-582, -1523], [-562, -1374]]);
  addPoly('rb3_spoke_s', [[-552, -1309], [-518, -1163]]);
  addPoly('rb3_spoke_w', [[-739, -1366], [-591, -1346]]);
  addPoly('rb3_spoke_e', [[-525, -1336], [-377, -1296]]);

  addRoundabout('rb_trans_ne', 954, -1342, 13, 36, 'obelisk', 'suburbio_norte');
  addPoly('rb4_spoke_n', [[978, -1523], [958, -1374]]);
  addPoly('rb4_spoke_s', [[948, -1309], [916, -1163]]);
  addPoly('rb4_spoke_w', [[773, -1318], [921, -1338]]);
  addPoly('rb4_spoke_e', [[987, -1348], [1135, -1386]]);

  // 3. FILEIRAS 0..4 DO CENTRO & TRANSIÇÃO NORTE (COLETORAS & VIAS LOCAIS)
  addPoly('tn_c0_scurve', sampleSCurvePoints(-1535, -1356, -1169, -1324, 46, 'x', 7));
  addPoly('tn_c0_spur_n', [[-1348, -1523], [-1348, -1340]], secW, false, { tier: 'local' });
  addPoly('tn_c1_elbow', [[-996, -1523], [-966, -1348], [-864, -1163]]);
  addPoly('tn_c1_spur_w', [[-1135, -1332], [-966, -1348]], secW, false, { tier: 'local' });
  addPoly('tn_c3_scurve', sampleSCurvePoints(-192, -1523, -168, -1163, -44, 'z', 7));
  addPoly('tn_c3_spur_w', [[-343, -1338], [-180, -1342]], secW, false, { tier: 'local' });
  addPoly('tn_c4_customs_loop', [[172, -1523], [214, -1356], [343, -1318]]);
  addPoly('tn_c4_customs_south', [[214, -1356], [238, -1163]], secW, false, { tier: 'local' });
  addPoly('tn_c5_scurve', sampleSCurvePoints(377, -1326, 739, -1362, -48, 'x', 7));
  addPoly('tn_c5_spur_s', [[556, -1344], [584, -1163]], secW, false, { tier: 'local' });
  addPoly('tn_c7_stem', [[1338, -1523], [1356, -1348], [1440, -1163]]);
  addPoly('tn_c7_branch', [[1169, -1320], [1356, -1348]], secW, false, { tier: 'local' });

  addPoly('r1_c0_scurve', sampleSCurvePoints(-1362, -1129, -1332, -767, 48, 'z', 7));
  addPoly('r1_c0_spur', [[-1347, -948], [-1169, -918]], secW, false, { tier: 'local' });
  addPoly('r1_c1_bway_spur', [[-951, -948], [-773, -864]], secW, false, { tier: 'local' });
  addPoly('r1_c2_elbow', [[-739, -968], [-552, -932], [-377, -1012]]);
  addPoly('r1_c2_spur_s', [[-552, -932], [-524, -767]], secW, false, { tier: 'local' });
  addPoly('r1_c3_scurve', sampleSCurvePoints(-198, -1129, -172, -767, 42, 'z', 7));
  addPoly('r1_c3_spur_w', [[-343, -928], [-185, -948]], secW, false, { tier: 'local' });
  addPoly('r1_c4_elbow', [[186, -1129], [164, -938], [343, -892]]);
  addPoly('r1_c4_spur_s', [[164, -938], [192, -767]], secW, false, { tier: 'local' });
  addPoly('r1_c5_scurve', sampleSCurvePoints(377, -966, 739, -924, 46, 'x', 7));
  addPoly('r1_c5_spur_n', [[562, -1129], [558, -945]], secW, false, { tier: 'local' });
  addPoly('r1_c6_nw', [[773, -962], [932, -952], [956, -1129]]);
  addPoly('r1_c7_se', [[1296, -1011], [1388, -896], [1368, -767]]);

  addPoly('r2_c0_scurve', sampleSCurvePoints(-1535, -568, -1169, -532, -46, 'x', 7));
  addPoly('r2_c0_spur_s', [[-1352, -550], [-1328, -368]], secW, false, { tier: 'local' });
  addPoly('r2_c1_hero_crescent', [[-1135, -654], [-1020, -668], [-846, -733]], secW, false, { tier: 'local' });
  addPoly('r2_c2_bway_sw', [[-606, -478], [-648, -368]], secW, false, { tier: 'local' });
  addPoly('r2_c2_bway_ne', [[-606, -478], [-492, -624], [-482, -733]]);
  addPoly('r2_c3_bank_west', [[-343, -518], [-186, -502], [-174, -368]], secW, false, { tier: 'local' });
  addPoly('r2_c4_bank_east', [[343, -518], [186, -502], [174, -368]], secW, false, { tier: 'local' });
  addPoly('r2_c5_diag_nw', [[651, -430], [516, -584], [498, -733]]);
  addPoly('r2_c6_se', [[876, -630], [978, -528], [1135, -516]]);
  addPoly('r2_c6_spur_s', [[978, -528], [964, -368]], secW, false, { tier: 'local' });
  addPoly('r2_c7_scurve', sampleSCurvePoints(1324, -733, 1348, -368, -42, 'z', 7));
  addPoly('r2_c7_spur_w', [[1169, -546], [1336, -550]], secW, false, { tier: 'local' });

  addPoly('r3_c1_scurve', sampleSCurvePoints(-942, -334, -966, -17, 46, 'z', 7));
  addPoly('r3_c1_spur_e', [[-954, -176], [-773, -154]], secW, false, { tier: 'local' });
  addPoly('r3_c2_elbow', [[-739, -168], [-568, -148], [-542, -17]]);
  addPoly('r3_c3_ts_spur', [[-234, -105], [-162, -214], [-186, -334]], secW, false, { tier: 'local' });
  addPoly('r3_c4_ts_neon', [[178, -334], [196, -176], [264, -84]]);
  addPoly('r3_c4_spur_w', [[17, -172], [196, -176]], secW, false, { tier: 'local' });
  addPoly('r3_c5_se', [[453, -260], [576, -162], [739, -184]]);
  addPoly('r3_c5_spur_s', [[576, -162], [588, -17]], secW, false, { tier: 'local' });
  addPoly('r3_c6_curve', [[942, -334], [964, -172], [1135, -148]]);
  addPoly('r3_c6_spur_s', [[964, -172], [936, -17]], secW, false, { tier: 'local' });
  addPoly('r3_c7_scurve', sampleSCurvePoints(1344, -334, 1368, -17, 44, 'z', 7));
  addPoly('r3_c7_spur_w', [[1169, -184], [1356, -176]], secW, false, { tier: 'local' });

  addPoly('r4_c0_elbow', [[-1535, 186], [-1344, 212], [-1318, 385]]);
  addPoly('r4_c0_spur_n', [[-1344, 212], [-1368, 17]], secW, false, { tier: 'local' });
  addPoly('r4_c1_scurve', sampleSCurvePoints(-1135, 184, -773, 218, 46, 'x', 7));
  addPoly('r4_c1_spur_s', [[-954, 201], [-936, 385]], secW, false, { tier: 'local' });
  addPoly('r4_c2_fork_main', [[-576, 17], [-548, 204], [-468, 385]]);
  addPoly('r4_c2_fork_w', [[-739, 224], [-548, 204]], secW, false, { tier: 'local' });
  addPoly('r4_c3_park_sw', [[-343, 216], [-192, 234], [-168, 385]]);
  addPoly('r4_c4_park_ne', [[93, 285], [228, 186], [246, 17]]);
  addPoly('r4_c5_scurve', sampleSCurvePoints(546, 17, 572, 385, -46, 'z', 7));
  addPoly('r4_c5_spur_w', [[377, 198], [559, 201]], secW, false, { tier: 'local' });
  addPoly('r4_c7_elbow', [[1169, 212], [1356, 188], [1382, 385]]);
  addPoly('r4_c7_spur_n', [[1356, 188], [1332, 17]], secW, false, { tier: 'local' });

  // 4. CONECTORES ORGÂNICOS INTER-DISTRITAIS (SUBÚRBIO, AEROPORTO, CANAL INDUSTRIAL/PORTO & ORLA SUL)
  addPoly('conn_north_suburb_boreal_parkway', [[-1944, -3900], [-1944, -3948], [-1924, -4190], [-1862, -4510], [-1836, -4840], [-1884, -5160]], 28, true, { tier: 'arterial', sidewalk: 10, district: 'suburbio_norte', isInterDistrict: true });
  addPoly('conn_west_canal_promenade_collector', [[1548, -1536], [1590, -1340], [1548, -1146], [1590, -948], [1548, -750]], 24, false, { tier: 'collector', sidewalk: 8, district: 'suburbio_norte', isInterDistrict: true });
  addPoly('conn_west_airport_coastal_arterial', [[-3255, 840], [-3255, 1680], [-3255, 1845], [-3215, 1965], [-3118, 2018], [-3018, 2046], [-2984, 2090], [-2976, 2130]], 30, true, { tier: 'arterial', sidewalk: 10, district: 'aeroporto_oeste', isInterDistrict: true });
  addPoly('conn_west_airport_military_collector', [[-3255, -840], [-3255, -1240], [-3214, -1560], [-3194, -1980], [-3216, -2310], [-3255, -2580]], 24, false, { tier: 'collector', sidewalk: 8, district: 'aeroporto_oeste', isInterDistrict: true });
  addPoly('conn_south_beach_scenic_arterial', [[-2976, 2130], [-2460, 2130], [-1944, 2130], [-1548, 2130]], 28, true, { tier: 'arterial', sidewalk: 10, district: 'praia_sul', isInterDistrict: true });
  addPoly('conn_south_beach_west_overlook_local', [[-3255, 1845], [-3395, 1915], [-3468, 1980], [-3482, 1740], [-3388, 1560], [-3255, 1480]], 18, false, { tier: 'local', sidewalk: 6, district: 'praia_sul', isInterDistrict: true });
  addPoly('conn_east_canal_parkway_arterial', [[1800, -2328], [1774, -1932], [1800, -1536], [1772, -1340], [1800, -1146], [1772, -948], [1800, -750], [1776, -555], [1800, -351], [1772, -175], [1800, 0], [1772, 200], [1800, 402]], 26, true, { tier: 'arterial', sidewalk: 8, district: 'industrial_leste', isInterDistrict: true });
  addPoly('conn_east_port_canal_collector', [[1800, 402], [1772, 700], [1800, 1005], [1800, 1206], [1772, 1410], [1800, 1605], [1774, 1865], [1800, 2124]], 24, false, { tier: 'collector', sidewalk: 8, district: 'porto_leste', isInterDistrict: true });

  // 5. PRAÇAS TRIANGULARES / ILHAS GORE EM FORQUILHAS OBLÍQUAS Y (100% FORA DE PISTAS E KEEPOUTS)
  const triangularPlazas = [
    buildTriangularPlazaEntry('plaza_times_sq_bway_gore', 'centro_financeiro', [[-162, -21], [-216, -21], [-210, -54]], 2),
    buildTriangularPlazaEntry('plaza_east_diag_times_sq_gore', 'centro_financeiro', [[224, -21], [278, -21], [274, -56]], 2),
    buildTriangularPlazaEntry('plaza_bway_central_park_gore', 'centro_financeiro', [[202, 381], [246, 381], [178, 346]], 2),
    buildTriangularPlazaEntry('plaza_bway_midtown_fork_gore', 'centro_financeiro', [[-568, -478], [-538, -498], [-538, -456]], 2),
    buildTriangularPlazaEntry('plaza_east_diag_fin_fork_gore', 'centro_financeiro', [[604, -444], [574, -468], [576, -428]], 2),
    buildTriangularPlazaEntry('plaza_west_coastal_fork_gore', 'praia_sul', [[-3108, 1978], [-3056, 1978], [-3082, 1948]], 3)
  ];

  const segments = [];
  for (let p = 0; p < polylines.length; p++) {
    const poly = polylines[p];
    for (let i = 0; i < poly.points.length - 1; i++) {
      const [x1, z1] = poly.points[i], [x2, z2] = poly.points[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.5) continue;
      const pad = poly.halfWidth + poly.sidewalk;
      segments.push({
        polyId: poly.id, segIdx: i, tier: poly.tier, district: poly.district, isInterDistrict: poly.isInterDistrict,
        x1, z1, x2, z2, len, width: poly.width, halfWidth: poly.halfWidth, sidewalk: poly.sidewalk, isMain: poly.isMain,
        minX: Math.min(x1, x2) - pad, maxX: Math.max(x1, x2) + pad, minZ: Math.min(z1, z2) - pad, maxZ: Math.max(z1, z2) + pad
      });
    }
  }

  // 6. HIERARQUIA UNIFICADA COMPLETA DA ILHA (`tiers`)
  const expressway = [
    { id: 'viaduct_01_ew', tier: 'expressway', isElevated: true, width: 16, points: [[ws(-465), ws(-382)], [ws(465), ws(-382)]] },
    { id: 'viaduct_02_ns', tier: 'expressway', isElevated: true, width: 16, points: [[ws(252), ws(-84)], [ws(252), ws(520)]] },
    { id: 'viaduct_03_west_aero', tier: 'expressway', isElevated: true, width: 16, points: [[ws(-1036), 0], [ws(-466), 0]] },
    { id: 'hwy_west_airport_express', tier: 'expressway', width: ROAD.mainWidth, points: [[ws(-1100), 0], [ws(-516), 0]] },
    { id: 'hwy_prison_armored_bridge', tier: 'expressway', isBridge: true, width: ROAD.mainWidth, points: [[ws(1375), ws(708)], [ws(1375), ws(1400)]] },
    ...PANGAEA_HIGHWAYS.map((h) => ({ id: h.id, tier: 'expressway', width: h.width || 26, points: h.points }))
  ];
  const arterial = [
    ...MAIN_AVENUES_X.map((ax) => ({ id: `ave_ns_${ax}`, tier: 'arterial', width: ROAD.mainWidth, points: [[ax, ws(-1312)], [ax, ws(710)]] })),
    ...MAIN_AVENUES_Z.map((az) => ({ id: `ave_ew_${az}`, tier: 'arterial', width: ROAD.mainWidth, points: [[ws(az === ws(710) ? -1815 : -516), az], [ws(az <= ws(134) ? 1616 : az === ws(710) ? 640 : 1200), az]] })),
    ...polylines.filter((p) => p.tier === 'arterial')
  ];
  const collector = [
    ...SECONDARY_STREETS_X.map((sx) => ({ id: `sec_ns_${sx}`, tier: 'collector', width: ROAD.secondaryWidth, points: [[sx, ws(-1312)], [sx, ws(-512)]] })),
    ...SECONDARY_STREETS_Z.map((sz) => ({ id: `sec_ew_${sz}`, tier: 'collector', width: ROAD.secondaryWidth, points: [[ws(-648), sz], [ws(sz <= ws(-512) ? 1616 : 526), sz]] })),
    ...INDUSTRIAL_STREETS_X.map((ix) => ({ id: `ind_ns_${ix}`, tier: 'collector', width: ROAD.secondaryWidth, points: [[ix, ws(-1312)], [ix, ws(134)]] })),
    ...polylines.filter((p) => p.tier === 'collector')
  ];
  const ladeiraCorridors = WINDING_LADEIRAS.filter((ld) => !ld.hasStairs).map((ld, idx) => {
    const xEast = getFavelaEastBorderX(ws(ld.zStart)), xSummit = ws(-865), pts = [];
    for (let s = 0; s <= 14; s++) {
      const x = xEast - 3 - ((xEast - 3 - xSummit) * s) / 14;
      pts.push([Math.round(x * 10) / 10, Math.round(getLadeiraZAtX(ld, x) * 10) / 10]);
    }
    return { id: `favela_ladeira_${idx + 1}`, tier: 'local', isHillsideLadeira: true, width: 7.4, points: pts };
  });
  const local = [...polylines.filter((p) => p.tier === 'local'), ...ladeiraCorridors];

  _cachedUnified = {
    tiers: { expressway, arterial, collector, local },
    polylines, roundabouts, segments, triangularPlazas, flatironCorners,
    keepouts: getDowntownProtectedKeepouts(),
    islandKeepouts: getIslandLandmarkKeepouts()
  };
  _cachedUnifiedKey = scaleKey;
  return _cachedUnified;
}

function sampleRoadbedElevation(world, x, z) {
  if (getMetroCutoutFloorY(x, z) !== null) return 0;
  const bridgeY = world?.getRoadElevation ? world.getRoadElevation(x, z) : 0;
  if (bridgeY !== 0) return bridgeY;
  return Math.max(getFavelaElevation(x, z), getUrbanCityReliefY(x, z), getPangaeaElevationAt(x, z));
}

export function computeRoadNetworkDiagnostics(world) {
  const net = getUnifiedCityRoadNetwork();
  const sys = world?.livingCity?.wantedSystem || {
    world,
    _isSegmentBlockedByBuilding(ax, az, bx, bz) {
      const blds = world?.mapBuildings || [];
      const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
      for (let i = 0; i < blds.length; i++) {
        const b = blds[i];
        if ((b.minY ?? 0) > 6.0) continue;
        const hw = (b.w || 0) * 0.5, hd = (b.d || 0) * 0.5;
        if (maxX < b.x - hw || minX > b.x + hw || maxZ < b.z - hd || minZ > b.z + hd) continue;
        for (const t of [0.2, 0.5, 0.8]) {
          const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
          if (px > b.x - hw + 0.5 && px < b.x + hw - 0.5 && pz > b.z - hd + 0.5 && pz < b.z + hd - 0.5) return true;
        }
      }
      return false;
    }
  };

  const graph = ensurePoliceRoadGraph(sys);
  const districtTargets = {
    centro_financeiro: { x: 0, z: ws(-117) },
    suburbio_norte: { x: ws(120), z: ws(-644) },
    praia_sul: { x: 0, z: ws(710) },
    industrial_leste: { x: ws(768), z: ws(-250) },
    porto_leste: { x: ws(825), z: ws(335) },
    aeroporto_oeste: { x: ws(-1060), z: 0 },
    ilha_prisao: { x: ws(1375), z: ws(1260) }
  };

  const origin = districtTargets.centro_financeiro;
  const districtRoutes = {};
  let allDistrictsConnected = true;

  for (const [distId, tgt] of Object.entries(districtTargets)) {
    if (distId === 'centro_financeiro') continue;
    const goalNode = findNearestRoadNode(graph, tgt.x, tgt.z, (n) => n.neighbors.length > 0);
    const path = findRoadPathAStar(graph, origin.x, origin.z, tgt.x, tgt.z);
    let edgesValid = path.length >= 2 && Boolean(goalNode) && Math.hypot(path[path.length - 1].x - goalNode.x, path[path.length - 1].z - goalNode.z) < 1.0;
    if (edgesValid) {
      for (let i = 0; i < path.length - 1; i++) {
        const nA = findNearestRoadNode(graph, path[i].x, path[i].z);
        const nB = findNearestRoadNode(graph, path[i + 1].x, path[i + 1].z);
        if (!nA || !nB || !nA.neighbors.some((e) => e.node === nB)) { edgesValid = false; break; }
      }
    }
    districtRoutes[distId] = { connected: edgesValid, waypointCount: path.length, goalDist: goalNode ? Math.hypot(goalNode.x - tgt.x, goalNode.z - tgt.z) : Infinity };
    if (!edgesValid) allDistrictsConnected = false;
  }

  // Componentes conexos via BFS
  const activeNodes = graph.nodes.filter((n) => n.neighbors.length > 0);
  const visited = new Set();
  let connectedComponentsCount = 0;
  for (let i = 0; i < activeNodes.length; i++) {
    const root = activeNodes[i];
    if (visited.has(root.index)) continue;
    connectedComponentsCount++;
    const queue = [root];
    visited.add(root.index);
    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q];
      for (let k = 0; k < cur.neighbors.length; k++) {
        const nb = cur.neighbors[k].node;
        if (!visited.has(nb.index)) { visited.add(nb.index); queue.push(nb); }
      }
    }
  }

  // Auditoria de inclinação longitudinal (<= 0.12 nas vias arteriais/coletoras/expressas, <= 0.18 nas ladeiras)
  let maxStandardSlope = 0, maxLadeiraSlope = 0;
  const slopeViolations = [], ladeiraViolations = [];

  for (let i = 0; i < net.segments.length; i++) {
    const s = net.segments[i];
    if (s.len < 4.0) continue;
    const slope = Math.abs(sampleRoadbedElevation(world, s.x2, s.z2) - sampleRoadbedElevation(world, s.x1, s.z1)) / s.len;
    if (slope > maxStandardSlope) maxStandardSlope = slope;
    if (slope > 0.12) slopeViolations.push({ id: s.polyId, tier: s.tier, slope: +slope.toFixed(4) });
  }

  for (let i = 0; i < graph.segments.length; i++) {
    const seg = graph.segments[i];
    if (seg.length < 6.0) continue;
    let slope = 0;
    if (seg.isBridge) {
      const bridgeSpec = [...RIVER_BRIDGE_SPECS, ...PANGAEA_BRIDGE_SPECS].find((b) => Math.abs(b.z - seg.a.z) < 12);
      slope = bridgeSpec ? (Math.PI * bridgeSpec.archHeight) / Math.max(68, bridgeSpec.xEnd - bridgeSpec.xStart) : 0.04;
    } else {
      slope = Math.abs(sampleRoadbedElevation(world, seg.b.x, seg.b.z) - sampleRoadbedElevation(world, seg.a.x, seg.a.z)) / seg.length;
    }
    if (slope > maxStandardSlope) maxStandardSlope = slope;
    if (slope > 0.12) slopeViolations.push({ id: `${seg.a.id}->${seg.b.id}`, tier: seg.tier || 'collector', slope: +slope.toFixed(4) });
  }

  for (const ld of net.tiers.local.filter((c) => c.isHillsideLadeira)) {
    for (let i = 0; i < ld.points.length - 1; i++) {
      const [x1, z1] = ld.points[i], [x2, z2] = ld.points[i + 1], len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 2.0) continue;
      const slope = Math.abs(getFavelaElevation(x2, z2) - getFavelaElevation(x1, z1)) / len;
      if (slope > maxLadeiraSlope) maxLadeiraSlope = slope;
      if (slope > 0.18) ladeiraViolations.push({ id: ld.id, slope: +slope.toFixed(4) });
    }
  }

  return {
    valid: allDistrictsConnected && connectedComponentsCount === 1 && slopeViolations.length === 0 && ladeiraViolations.length === 0,
    tiersCount: { expressway: net.tiers.expressway.length, arterial: net.tiers.arterial.length, collector: net.tiers.collector.length, local: net.tiers.local.length },
    districtConnectivity: { allDistrictsConnected, connectedComponentsCount, isolatedComponentsCount: Math.max(0, connectedComponentsCount - 1), districtRoutes },
    slopeAudit: { maxStandardSlope: +maxStandardSlope.toFixed(4), maxLadeiraSlope: +maxLadeiraSlope.toFixed(4), slopeViolations, ladeiraViolations }
  };
}
