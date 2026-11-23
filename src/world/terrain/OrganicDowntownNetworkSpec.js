/**
 * OrganicDowntownNetworkSpec.js
 * Especificação determinística da Malha Viária Orgânica Não-Matriz do Centro & Transição Norte (3x):
 *  - 2 Grandes Avenidas Diagonais ("Broadway Metropolitana" 2.0km NO->SE e "Boulevard Diagonal Leste" 1.7km NE->SO)
 *  - 4 Rotatórias Circulares Monumentais ("Roundabouts") com raios angulados e ilhas paisagísticas
 *  - Curvas suaves em "S" ("viradinhas"), ruas em cotovelo angulado (32°–45°) e travessas assimétricas em "T"/"Y"
 *  - Catálogo de zonas protegidas (Super Banco + Portais, Torre dos Heróis + OP-09, LEGO Customs, Metrô e Viadutos)
 */

import { METRO_ISLAND_CUTOUTS } from '../MetroSystemBuilder.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../core/WorldLayoutScale.js';

export const DOWNTOWN_GRID_COLS_DESIGN = Object.freeze([-516, -384, -252, -120, 0, 120, 252, 384, 516]);
export const DOWNTOWN_GRID_ROWS_DESIGN = Object.freeze([-512, -382, -250, -117, 0, 134]);

/**
 * Zonas protegidas estritas em coordenadas de mundo 3x (zero asfalto orgânico e zero prédios de preenchimento).
 */
export function getDowntownProtectedKeepouts() {
  if (!IS_SCALED_WORLD) return [];
  const base = [
    // Super Banco Central + Praça Frontal + Escadas M01 + Cofres/Muros Especiais
    { id: 'super_bank_and_m01', minX: -110, maxX: 110, minZ: -748, maxZ: -314 },
    // Portais Blindados Subterrâneos Oeste e Leste do Metrô
    { id: 'metro_west_portal', minX: -270, maxX: -222, minZ: -692, maxZ: -596 },
    { id: 'metro_east_portal', minX: 222, maxX: 270, minZ: -692, maxZ: -596 },
    // Complexo da Torre dos Heróis + Escadaria do Lab OP-09 + Parede Rachada vizinha
    { id: 'hero_tower_complex', minX: -1044, maxX: -886, minZ: -594, maxZ: -434 },
    { id: 'hero_cracked_wall', minX: -804, maxX: -762, minZ: -400, maxZ: -360 },
    // Oficina de Rua LEGO Customs (Transição Norte)
    { id: 'lego_customs', minX: 10, maxX: 150, minZ: -1304, maxZ: -1156 },
    // Rampa Central do Viaduto 1 (Av. X = 0 sul de Z = -1146)
    { id: 'viaduct1_central_ramp', minX: -32, maxX: 32, minZ: -1158, maxZ: -1034 },
    // Acessos de Rua das Estações M02, M03 e M05
    { id: 'metro_m02', minX: -258, maxX: -192, minZ: 12, maxZ: 48 },
    { id: 'metro_m03', minX: -1165, maxX: -1118, minZ: -262, maxZ: -88 },
    { id: 'metro_m05', minX: 1512, maxX: 1562, minZ: -622, maxZ: -446 },
    // Cercas brancas na calçada central da Times Square
    { id: 'ts_fences', minX: -54, maxX: 54, minZ: -44, maxZ: -16 }
  ];

  for (let i = 0; i < METRO_ISLAND_CUTOUTS.length; i++) {
    const c = METRO_ISLAND_CUTOUTS[i];
    base.push({
      id: `cutout_${c.id}`,
      minX: c.minX - 5.5,
      maxX: c.maxX + 5.5,
      minZ: c.minZ - 5.5,
      maxZ: c.maxZ + 5.5
    });
  }
  return base;
}

function sampleSCurvePoints(x0, z0, x1, z1, amp, alongAxis = 'x', steps = 7) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Derivada nula nas pontas (t=0 e t=1) para entrar perpendicular na avenida, curvando forte no miolo!
    const wave = Math.sin(t * Math.PI * 2) * Math.sin(t * Math.PI) * amp;
    if (alongAxis === 'x') {
      pts.push([
        Math.round((x0 + (x1 - x0) * t) * 10) / 10,
        Math.round((z0 + (z1 - z0) * t + wave) * 10) / 10
      ]);
    } else {
      pts.push([
        Math.round((x0 + (x1 - x0) * t + wave) * 10) / 10,
        Math.round((z0 + (z1 - z0) * t) * 10) / 10
      ]);
    }
  }
  return pts;
}

function halfRoadX(dx) {
  return (Math.abs(dx) === 516 ? ROAD.secondaryWidth : ROAD.mainWidth) * 0.5;
}

function halfRoadZ(dz) {
  return (dz === -512 ? ROAD.secondaryWidth : ROAD.mainWidth) * 0.5;
}

export function getSuperBlockAsphaltFreeBounds(colIdx, rowIdx) {
  const dx0 = DOWNTOWN_GRID_COLS_DESIGN[colIdx];
  const dx1 = DOWNTOWN_GRID_COLS_DESIGN[colIdx + 1];
  const dz0 = DOWNTOWN_GRID_ROWS_DESIGN[rowIdx];
  const dz1 = DOWNTOWN_GRID_ROWS_DESIGN[rowIdx + 1];
  return {
    colIdx,
    rowIdx,
    dx0,
    dx1,
    dz0,
    dz1,
    minX: ws(dx0) + halfRoadX(dx0),
    maxX: ws(dx1) - halfRoadX(dx1),
    minZ: ws(dz0) + halfRoadZ(dz0),
    maxZ: ws(dz1) - halfRoadZ(dz1)
  };
}

let _cachedNetwork = null;
let _cachedScaleKey = null;

/**
 * Constrói e cacheia toda a rede orgânica do Centro + Transição Norte (polilinhas, segmentos e rotatórias).
 */
export function getDowntownOrganicNetwork() {
  const scaleKey = `${IS_SCALED_WORLD}_${ROAD.mainWidth}_${ROAD.sidewalk}`;
  if (_cachedNetwork && _cachedScaleKey === scaleKey) return _cachedNetwork;

  if (!IS_SCALED_WORLD) {
    _cachedNetwork = { polylines: [], roundabouts: [], segments: [], flatironCorners: [], keepouts: [] };
    _cachedScaleKey = scaleKey;
    return _cachedNetwork;
  }

  const polylines = [];
  const roundabouts = [];
  const flatironCorners = [];
  const secW = ROAD.secondaryWidth; // 26m
  const diagW = 28; // Boulevards diagonais principais de 28m
  const sw = ROAD.sidewalk; // 10m

  const addPoly = (id, points, width = secW, isMain = false, blockHint = null) => {
    polylines.push({
      kind: 'polyline',
      id,
      points,
      width,
      halfWidth: width * 0.5,
      sidewalk: sw,
      isMain,
      blockHint
    });
  };

  const addRoundabout = (id, cx, cz, innerR = 14, outerR = 38, monumentKind = 'obelisk') => {
    roundabouts.push({
      kind: 'roundabout',
      id,
      cx,
      cz,
      innerR,
      outerR,
      sidewalk: sw,
      monumentKind
    });
  };

  // ==========================================================================
  // 1. GRANDES AVENIDAS DIAGONAIS CONTÍNUAS ("BROADWAY" & "DIAGONAL LESTE")
  // ==========================================================================
  // Broadway Metropolitana (~2.0 km contínuos do Alto Comercial NO -> Times Sq -> Parque Central!)
  addPoly(
    'broadway_metro_nw_se',
    [
      [-1056, -1146],
      [-846, -750],
      [-756, -605],
      [-456, -351],
      [-360, -210],
      [-108, 0],
      [0, 168],
      [186, 402]
    ],
    diagW,
    true
  );

  // Boulevard Diagonal Leste (~1.72 km contínuos do Nordeste -> Bela Vista -> Times Square Leste!)
  addPoly(
    'boulevard_diag_ne_sw',
    [
      [1440, -1146],
      [1152, -882],
      [996, -750],
      [756, -510],
      [546, -351],
      [360, -168],
      [168, 0]
    ],
    diagW,
    true
  );

  // Esquinas agudas icônicas para Arranha-Céus Triangulares Flatiron (proa apontando para o cruzamento!)
  flatironCorners.push(
    { id: 'flatiron_bway_nw', cx: -1086, cz: -1062, backWidth: 32, noseWidth: 6.0, length: 52, rotY: -0.24, height: 126, styleKey: 'black_granite_gold' },
    { id: 'flatiron_bway_hero_e', cx: -690, cz: -658, backWidth: 34, noseWidth: 6.2, length: 54, rotY: 2.38, height: 168, styleKey: 'sapphire_glass' },
    { id: 'flatiron_bway_ts_w', cx: -498, cz: -292, backWidth: 34, noseWidth: 6.2, length: 52, rotY: -0.68, height: 158, styleKey: 'cyan_modern' },
    { id: 'flatiron_bway_ts_c', cx: -168, cz: -56, backWidth: 36, noseWidth: 6.5, length: 56, rotY: 2.42, height: 174, styleKey: 'black_granite_gold' },
    { id: 'flatiron_bway_park', cx: 124, cz: 336, backWidth: 34, noseWidth: 6.2, length: 52, rotY: 2.52, height: 144, styleKey: 'emerald_steel' },
    { id: 'flatiron_east_ne', cx: 1368, cz: -1076, backWidth: 32, noseWidth: 6.0, length: 50, rotY: 0.78, height: 104, styleKey: 'silver_corporate' },
    { id: 'flatiron_east_fin', cx: 616, cz: -414, backWidth: 35, noseWidth: 6.4, length: 54, rotY: -2.35, height: 156, styleKey: 'black_granite_gold' },
    { id: 'flatiron_east_ts', cx: 232, cz: -62, backWidth: 35, noseWidth: 6.2, length: 54, rotY: -2.38, height: 164, styleKey: 'sapphire_glass' }
  );

  // ==========================================================================
  // 2. 4 ROTATÓRIAS CIRCULARES URBANAS ("ROUNDABOUTS") + RAIOS ANGULADOS
  // ==========================================================================
  // R1: Rotatória Oeste Times Square (quadra -1548..-1152, -351..0; longe de M03 Z=-262..-88)
  addRoundabout('rb_west_times_sq', -1356, -172, 14, 38, 'obelisk');
  addPoly('rb1_spoke_w', [[-1535, -196], [-1390, -176]]);
  addPoly('rb1_spoke_n', [[-1372, -334], [-1360, -206]]);
  addPoly('rb1_spoke_s', [[-1334, -138], [-1308, -17]]);
  addPoly('rb1_spoke_se', [[-1322, -154], [-1169, -46]]);

  // R2: Rotatória Leste Bela Vista / Parque (quadra +756..+1152, 0..+402; sem tocar Viaduto 2 em X=756)
  addRoundabout('rb_east_park_view', 960, 204, 14, 38, 'fountain');
  addPoly('rb2_spoke_n', [[936, 17], [955, 169]]);
  addPoly('rb2_spoke_e', [[995, 196], [1135, 156]]);
  addPoly('rb2_spoke_s', [[966, 239], [1002, 385]]);
  addPoly('rb2_spoke_nw_curve', [[828, 17], [886, 118], [932, 182]]);

  // R3: Rotatória Transição Noroeste (quadra -756..-360, -1536..-1146)
  addRoundabout('rb_trans_nw', -558, -1342, 13, 36, 'fountain');
  addPoly('rb3_spoke_n', [[-582, -1523], [-562, -1374]]);
  addPoly('rb3_spoke_s', [[-552, -1309], [-518, -1163]]);
  addPoly('rb3_spoke_w', [[-739, -1366], [-591, -1346]]);
  addPoly('rb3_spoke_e', [[-525, -1336], [-377, -1296]]);

  // R4: Rotatória Transição Nordeste (quadra +756..+1152, -1536..-1146)
  addRoundabout('rb_trans_ne', 954, -1342, 13, 36, 'obelisk');
  addPoly('rb4_spoke_n', [[978, -1523], [958, -1374]]);
  addPoly('rb4_spoke_s', [[948, -1309], [916, -1163]]);
  addPoly('rb4_spoke_w', [[773, -1318], [921, -1338]]);
  addPoly('rb4_spoke_e', [[987, -1348], [1135, -1386]]);

  // ==========================================================================
  // 3. FILEIRA 0 — TRANSIÇÃO NORTE (Z = -1536..-1146)
  // ==========================================================================
  // Col 0 (-1548..-1152): Curva em S Leste-Oeste + braço Norte
  addPoly('tn_c0_scurve', sampleSCurvePoints(-1535, -1356, -1169, -1324, 46, 'x', 7));
  addPoly('tn_c0_spur_n', [[-1348, -1523], [-1348, -1340]]);

  // Col 1 (-1152..-756): Cotovelo angulado ("viradinha") NO->SE + travessa Leste
  addPoly('tn_c1_elbow', [[-996, -1523], [-966, -1348], [-864, -1163]]);
  addPoly('tn_c1_spur_w', [[-1135, -1332], [-966, -1348]]);

  // Col 3 (-360..0): Curva em S Norte-Sul + alameda Oeste (longe da rampa X=0)
  addPoly('tn_c3_scurve', sampleSCurvePoints(-192, -1523, -168, -1163, -44, 'z', 7));
  addPoly('tn_c3_spur_w', [[-343, -1338], [-180, -1342]]);

  // Col 4 (0..+360 — Contém LEGO Customs em X=10..150, Z=-1304..-1156): Cotovelo Automotivo pelo Norte/Leste!
  addPoly('tn_c4_customs_loop', [[172, -1523], [214, -1356], [343, -1318]]);
  addPoly('tn_c4_customs_south', [[214, -1356], [238, -1163]]);

  // Col 5 (+360..+756): Curva em S Leste-Oeste + braço Sul
  addPoly('tn_c5_scurve', sampleSCurvePoints(377, -1326, 739, -1362, -48, 'x', 7));
  addPoly('tn_c5_spur_s', [[556, -1344], [584, -1163]]);

  // Col 7 (+1152..+1548): Forquilha em Y angulada
  addPoly('tn_c7_stem', [[1338, -1523], [1356, -1348], [1440, -1163]]);
  addPoly('tn_c7_branch', [[1169, -1320], [1356, -1348]]);

  // ==========================================================================
  // 4. FILEIRA 1 — ALTO COMERCIAL NORTE (Z = -1146..-750)
  // ==========================================================================
  // Col 0 (-1548..-1152): Curva em S Norte-Sul + travessa Leste
  addPoly('r1_c0_scurve', sampleSCurvePoints(-1362, -1129, -1332, -767, 48, 'z', 7));
  addPoly('r1_c0_spur', [[-1347, -948], [-1169, -918]]);

  // Col 1 (-1152..-756 — Cortada pela Broadway): Travessa perpendicular NE saindo da Broadway
  addPoly('r1_c1_bway_spur', [[-951, -948], [-773, -864]]);

  // Col 2 (-756..-360): Cotovelo Comercial ("Pá-Pei") + braço Sul
  addPoly('r1_c2_elbow', [[-739, -968], [-552, -932], [-377, -1012]]);
  addPoly('r1_c2_spur_s', [[-552, -932], [-524, -767]]);

  // Col 3 (-360..0 — Rampa central do Viaduto 1 em X=-32..32, Z=-1146..-1034): Curva em S Norte-Sul a Oeste
  addPoly('r1_c3_scurve', sampleSCurvePoints(-198, -1129, -172, -767, 42, 'z', 7));
  addPoly('r1_c3_spur_w', [[-343, -928], [-185, -948]]);

  // Col 4 (0..+360): Cotovelo Financeiro Norte (desviando da rampa X=-32..32)
  addPoly('r1_c4_elbow', [[186, -1129], [164, -938], [343, -892]]);
  addPoly('r1_c4_spur_s', [[164, -938], [192, -767]]);

  // Col 5 (+360..+756): Curva em S Leste-Oeste + braço Norte
  addPoly('r1_c5_scurve', sampleSCurvePoints(377, -966, 739, -924, 46, 'x', 7));
  addPoly('r1_c5_spur_n', [[562, -1129], [558, -945]]);

  // Col 6 (+756..+1152 — Cortada pela Diagonal Leste no canto SE): Cotovelo NO
  addPoly('r1_c6_nw', [[773, -962], [932, -952], [956, -1129]]);

  // Col 7 (+1152..+1548 — Cortada pela Diagonal Leste no NO): Braço SE
  addPoly('r1_c7_se', [[1296, -1011], [1388, -896], [1368, -767]]);

  // ==========================================================================
  // 5. FILEIRA 2 — EIXO TORRE DOS HERÓIS & SUPER BANCO (Z = -750..-351)
  // ==========================================================================
  // Col 0 (-1548..-1152): Curva em S Leste-Oeste + braço Sul
  addPoly('r2_c0_scurve', sampleSCurvePoints(-1535, -568, -1169, -532, -46, 'x', 7));
  addPoly('r2_c0_spur_s', [[-1352, -550], [-1328, -368]]);

  // Col 1 (-1152..-756 — Torre dos Heróis em X=-1044..-886, Z=-594..-434 + Broadway no canto NE):
  // Alameda Curva Norte-Oeste abraçando o Campus da Torre sem tocar no keepout!
  addPoly('r2_c1_hero_crescent', [[-1135, -654], [-1020, -668], [-846, -733]]);

  // Col 2 (-756..-360 — Cortada pela Broadway): Travessa SO para a Av. Sul
  addPoly('r2_c2_bway_sw', [[-606, -478], [-648, -368]]);
  addPoly('r2_c2_bway_ne', [[-606, -478], [-492, -624], [-482, -733]]);

  // Col 3 (-360..0 — Ala Oeste do Super Banco; Portal Oeste em X=-270..-222, Z=-692..-596; Banco em X>-110):
  // Rua Financeira Oeste passando a Leste do Portal Oeste (-168) na metade Sul!
  addPoly('r2_c3_bank_west', [[-343, -518], [-186, -502], [-174, -368]]);

  // Col 4 (0..+360 — Ala Leste do Super Banco; Portal Leste em X=222..270, Z=-692..-596; Banco em X<110):
  addPoly('r2_c4_bank_east', [[343, -518], [186, -502], [174, -368]]);

  // Col 5 (+360..+756 — Cortada pela Diagonal Leste): Travessa NO
  addPoly('r2_c5_diag_nw', [[651, -430], [516, -584], [498, -733]]);

  // Col 6 (+756..+1152 — Cortada pela Diagonal Leste no NO): Cotovelo SE
  addPoly('r2_c6_se', [[876, -630], [978, -528], [1135, -516]]);
  addPoly('r2_c6_spur_s', [[978, -528], [964, -368]]);

  // Col 7 (+1152..+1548 — Estação M05 em X=1512..1562, Z=-622..-446): Curva Norte-Sul pelo centro-oeste!
  addPoly('r2_c7_scurve', sampleSCurvePoints(1324, -733, 1348, -368, -42, 'z', 7));
  addPoly('r2_c7_spur_w', [[1169, -546], [1336, -550]]);

  // ==========================================================================
  // 6. FILEIRA 3 — CORREDOR TIMES SQUARE (Z = -351..0)
  // ==========================================================================
  // (Col 0 já tem Rotatória R1!)
  // Col 1 (-1152..-756 — M03 em X=-1165..-1118, Z=-262..-88): Curva em S Norte-Sul entrando pelo Norte/Sul e Leste!
  addPoly('r3_c1_scurve', sampleSCurvePoints(-942, -334, -966, -17, 46, 'z', 7));
  addPoly('r3_c1_spur_e', [[-954, -176], [-773, -154]]);

  // Col 2 (-756..-360 — Broadway no canto NE): Cotovelo Times Square Oeste
  addPoly('r3_c2_elbow', [[-739, -168], [-568, -148], [-542, -17]]);

  // Col 3 (-360..0 — Broadway corta de (-360,-210) a (-108,0); M01 escada em X=-110..110, Z<-314):
  addPoly('r3_c3_ts_spur', [[-234, -105], [-162, -214], [-186, -334]]);

  // Col 4 (0..+360 — Diagonal Leste chega em (168, 0)): Alameda Neon Times Square Leste
  addPoly('r3_c4_ts_neon', [[178, -334], [196, -176], [264, -84]]);
  addPoly('r3_c4_spur_w', [[17, -172], [196, -176]]);

  // Col 5 (+360..+756 — Diagonal Leste corta NO): Cotovelo SE
  addPoly('r3_c5_se', [[453, -260], [576, -162], [739, -184]]);
  addPoly('r3_c5_spur_s', [[576, -162], [588, -17]]);

  // Col 6 (+756..+1152): Curva em S Leste-Oeste (conectando Norte e Leste sem cruzar Viaduto 2 em X=756)
  addPoly('r3_c6_curve', [[942, -334], [964, -172], [1135, -148]]);
  addPoly('r3_c6_spur_s', [[964, -172], [936, -17]]);

  // Col 7 (+1152..+1548): Curva em S Norte-Sul + braço Oeste
  addPoly('r3_c7_scurve', sampleSCurvePoints(1344, -334, 1368, -17, 44, 'z', 7));
  addPoly('r3_c7_spur_w', [[1169, -184], [1356, -176]]);

  // ==========================================================================
  // 7. FILEIRA 4 — FRENTE PARQUE CENTRAL (Z = 0..+402)
  // ==========================================================================
  // Col 0 (-1548..-1152): Cotovelo Parque Oeste
  addPoly('r4_c0_elbow', [[-1535, 186], [-1344, 212], [-1318, 385]]);
  addPoly('r4_c0_spur_n', [[-1344, 212], [-1368, 17]]);

  // Col 1 (-1152..-756): Curva em S Leste-Oeste + braço Sul
  addPoly('r4_c1_scurve', sampleSCurvePoints(-1135, 184, -773, 218, 46, 'x', 7));
  addPoly('r4_c1_spur_s', [[-954, 201], [-936, 385]]);

  // Col 2 (-756..-360): Forquilha Angulada Mirante do Parque
  addPoly('r4_c2_fork_main', [[-576, 17], [-548, 204], [-468, 385]]);
  addPoly('r4_c2_fork_w', [[-739, 224], [-548, 204]]);

  // Col 3 (-360..0 — Broadway no canto NE (-108,0)->(0,168); M02 em X=-258..-192, Z=12..48):
  // Alameda Sudoeste do Parque entrando pelo Oeste e Sul (100% longe de M02!)
  addPoly('r4_c3_park_sw', [[-343, 216], [-192, 234], [-168, 385]]);

  // Col 4 (0..+360 — Broadway corta de (0,168) a (186,402)): Travessa Nordeste para Av. Z=0
  addPoly('r4_c4_park_ne', [[93, 285], [228, 186], [246, 17]]);

  // Col 5 (+360..+756): Curva em S Norte-Sul (sem tocar Viaduto 2 em X=756)
  addPoly('r4_c5_scurve', sampleSCurvePoints(546, 17, 572, 385, -46, 'z', 7));
  addPoly('r4_c5_spur_w', [[377, 198], [559, 201]]);

  // (Col 6 já tem Rotatória R2!)
  // Col 7 (+1152..+1548): Cotovelo Bela Vista Leste
  addPoly('r4_c7_elbow', [[1169, 212], [1356, 188], [1382, 385]]);
  addPoly('r4_c7_spur_n', [[1356, 188], [1332, 17]]);

  // Compila lista plana de segmentos 2D para consultas rápidas de colisão/loteamento/meio-fio
  const segments = [];
  for (let p = 0; p < polylines.length; p++) {
    const poly = polylines[p];
    const pts = poly.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.5) continue;
      segments.push({
        polyId: poly.id,
        segIdx: i,
        x1,
        z1,
        x2,
        z2,
        len,
        width: poly.width,
        halfWidth: poly.halfWidth,
        sidewalk: poly.sidewalk,
        isMain: poly.isMain,
        minX: Math.min(x1, x2) - poly.halfWidth - poly.sidewalk,
        maxX: Math.max(x1, x2) + poly.halfWidth + poly.sidewalk,
        minZ: Math.min(z1, z2) - poly.halfWidth - poly.sidewalk,
        maxZ: Math.max(z1, z2) + poly.halfWidth + poly.sidewalk
      });
    }
  }

  _cachedNetwork = {
    polylines,
    roundabouts,
    segments,
    flatironCorners,
    keepouts: getDowntownProtectedKeepouts()
  };
  _cachedScaleKey = scaleKey;
  return _cachedNetwork;
}

/**
 * Filtra os segmentos orgânicos, rotatórias, Flatirons e keepouts que interceptam um retângulo de consulta.
 */
export function queryOrganicFeaturesInBounds(minX, maxX, minZ, maxZ, pad = 28) {
  const net = getDowntownOrganicNetwork();
  const qMinX = minX - pad;
  const qMaxX = maxX + pad;
  const qMinZ = minZ - pad;
  const qMaxZ = maxZ + pad;

  return {
    segments: net.segments.filter(
      (s) => s.maxX >= qMinX && s.minX <= qMaxX && s.maxZ >= qMinZ && s.minZ <= qMaxZ
    ),
    roundabouts: net.roundabouts.filter(
      (r) =>
        r.cx + r.outerR + r.sidewalk >= qMinX &&
        r.cx - r.outerR - r.sidewalk <= qMaxX &&
        r.cz + r.outerR + r.sidewalk >= qMinZ &&
        r.cz - r.outerR - r.sidewalk <= qMaxZ
    ),
    flatironCorners: net.flatironCorners.filter(
      (f) => f.cx >= qMinX && f.cx <= qMaxX && f.cz >= qMinZ && f.cz <= qMaxZ
    ),
    keepouts: net.keepouts.filter(
      (k) => k.maxX >= qMinX && k.minX <= qMaxX && k.maxZ >= qMinZ && k.minZ <= qMaxZ
    )
  };
}
