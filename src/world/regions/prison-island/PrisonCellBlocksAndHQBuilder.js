import {
  addPrisonBannerSign,
  addBatchedLegoPerson
} from './PrisonBatcherAndBridgeBuilder.js';
import { buildCitadelRooftopHelipadsAndRadar } from './PrisonWallsAndTowersBuilder.js';

/**
 * 3. A CIDADELA PANÓPTICA CENTRAL ("A BALSA" — X = 1375, Z = 1540, H = 126m! DENTRO DE 110..135m):
 * - Fortaleza-Torre Panóptica Colossal no centro exato da ilha em concreto preto fosco e aço cinza-chumbo
 *   com faixas amarelo-alerta e janelas blindadas azuis;
 * - 4 Passarelas Aéreas Blindadas (Skybridges em Y = 40m, dentro de 35..45m) saindo em cruz (Norte, Sul, Leste, Oeste)
 *   conectando a Cidadela diretamente aos Pavilhões de Detenção ao redor;
 * - Topo da Cidadela (Y = 126.5m) com Duplo Heliponto Policial, antenas de comunicação, sirenes e radar!
 */
export function buildCentralPanopticonCitadelAndSkybridges(world, batcher) {
  const cx = 1375;
  const cz = 1540;
  const towerH = 126; // 110..135 unidades de altura!

  // 1. Base Blindada Octogonal/Quadrada Larga da Cidadela (112m x 112m x 36m) com Contrafortes de Aço
  batcher.addBox('bope_black', 112, 36, 112, cx, 18.28, cz);
  batcher.addBox('gunmetal_concrete', 104, 38, 104, cx, 19.28, cz);
  batcher.addBox('alert_yellow', 113, 1.4, 113, cx, 36.2, cz);

  // 2. Corpo Principal da Cidadela Panóptica (84m x 84m, de Y = 36m até Y = 98m)
  batcher.addBox('gunmetal_concrete', 84, 62, 84, cx, 67.0, cz);
  for (const cOffX of [-40, 40]) {
    for (const cOffZ of [-40, 40]) {
      batcher.addBox('dark_steel', 12, 98, 12, cx + cOffX, 49.28, cz + cOffZ);
    }
  }

  // Faixas Amarelo-Alerta e Dezenas de Janelas Blindadas Azuis Luminosas em Todos os Andares da Cidadela
  for (let floorY = 14; floorY <= 92; floorY += 10) {
    const span = floorY < 36 ? 106 : 86;
    batcher.addBox('smoked_glass', span, 3.4, span, cx, floorY, cz);
    if (floorY % 20 === 14) {
      batcher.addBox('alert_yellow', span + 1.2, 1.1, span + 1.2, cx, floorY - 3.2, cz);
    }
  }

  // 3. Coroa Panóptica de Comando 360° (Y = 98m..126m — 92m x 92m com Mirante de Vidro Blindado Azul)
  batcher.addBox('bope_black', 92, 28, 92, cx, 112.0, cz);
  batcher.addBox('smoked_glass', 94, 8.5, 94, cx, 108.0, cz);
  batcher.addBox('smoked_glass', 94, 6.5, 94, cx, 119.5, cz);
  batcher.addBox('alert_yellow', 95, 1.4, 95, cx, 98.5, cz);
  batcher.addBox('alert_yellow', 95, 1.4, 95, cx, 125.8, cz);

  // 4. Terraço de Comando Superior (Y = 126.28m) + DUPLO HELIPONTO POLICIAL + Radar/Antenas
  const roofY = 0.28 + towerH; // 126.28m
  buildCitadelRooftopHelipadsAndRadar(batcher, cx, cz, roofY);

  // Escada / Elevador Externo de Acesso Tático na Face Norte da Cidadela (X = 1375, Z = 1482)
  batcher.addBox('dark_steel', 8.0, towerH, 6.0, cx, roofY * 0.5, cz - 58);
  for (let sy = 4; sy <= towerH; sy += 4) {
    batcher.addBox('alert_yellow', 6.4, 0.35, 1.4, cx, sy, cz - 61.2);
  }

  // Letreiros Luminosos Gigantes nas 4 Faces da Cidadela Panóptica ("A BALSA")
  addPrisonBannerSign(world, cx, 93.0, cz - 43.2, 72.0, 6.8, 'CIDADELA PANÓPTICA — "A BALSA"', 'COMANDO CENTRAL DE SEGURANÇA MÁXIMA • BOPE', Math.PI);
  addPrisonBannerSign(world, cx, 93.0, cz + 43.2, 72.0, 6.8, 'CONTROLE PANÓPTICO FEDERAL', 'VIGILÂNCIA 360° • DUPLO HELIPONTO TÁTICO', 0);

  world.addCollider(cx, cz, 108, 108, towerH, 0.28);
  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: 112,
    d: 112,
    height: towerH,
    color: '#090a0d',
    isLandmark: true,
    label: 'A BALSA (CIDADELA 126M)'
  });

  // ==========================================================================
  // 4 PASSARELAS AÉREAS BLINDADAS (SKYBRIDGES EM Y = 40m! DENTRO DE 35..45m)
  // Saindo em cruz (Oeste, Leste, Sul, Norte) da Cidadela Central direto para os Pavilhões!
  // ==========================================================================
  const skyY = 40;
  // 1. Skybridge Oeste (X = 1135..1325, Z = 1540 -> liga Cidadela ao Pavilhão 2 do CV)
  _buildArmoredSkybridge(world, batcher, 1230, skyY, 1540, 190, 11, true);
  // 2. Skybridge Leste (X = 1425..1615, Z = 1540 -> liga Cidadela ao Pavilhão 3 do PCC)
  _buildArmoredSkybridge(world, batcher, 1520, skyY, 1540, 190, 11, true);
  // 3. Skybridge Sul (X = 1375, Z = 1590..1785 -> liga Cidadela ao Pavilhão 1 Contenção Ômega)
  _buildArmoredSkybridge(world, batcher, 1375, skyY, 1687.5, 11, 195, false);
  // 4. Skybridge Norte (X = 1375, Z = 1255..1485 -> liga Cidadela aos Pavilhões 4 & 5 de Administração/Triagem)
  _buildArmoredSkybridge(world, batcher, 1375, skyY, 1370, 11, 230, false);
}

function _buildArmoredSkybridge(world, batcher, x, y, z, w, d, isAlongX) {
  batcher.addBox('dark_steel', w, 6.2, d, x, y, z);
  batcher.addBox('smoked_glass', isAlongX ? w - 4 : w + 0.4, 2.6, isAlongX ? d + 0.4 : d - 4, x, y + 0.5, z);
  batcher.addBox('alert_yellow', w + 0.5, 0.65, d + 0.5, x, y - 2.9, z);
  batcher.addBox('alert_yellow', w + 0.5, 0.65, d + 0.5, x, y + 3.0, z);
  // Guardas do BOPE patrulhando no teto das Passarelas Aéreas Blindadas
  addBatchedLegoPerson(batcher, x, y + 3.4, z, isAlongX ? Math.PI / 2 : 0, 'bope_guard', 'stand');
  world.prisonIslandData.guardsCount++;
  world.addCollider(x, z, w, d, 6.5, y - 3.1);
}

/**
 * 4. OS 6 PAVILHÕES PENITENCIÁRIOS ALTOS (58m A 82m DE ALTURA! PROIBIDO PRÉDIO BAIXO!):
 * 1. Pavilhão 1 (Fundo / Sul-Interior X=1375, Z=1825, H=82m): Ala de Super-Segurança ("Contenção Ômega")
 *    com 8 Celas de Contenção Energética (barras de laser azul-neon/roxo) prendendo mercenários da A.R.E.S. e super-criminosos;
 * 2. Pavilhão 2 (Oeste X=1095, Z=1540, H=66m): Ala dos Presos do CV com 8 celas térreas de ferro preto;
 * 3. Pavilhão 3 (Leste X=1655, Z=1540, H=66m): Ala dos Presos do PCC com 8 celas térreas de ferro preto;
 * 4 & 5. Pavilhões 4 e 5 (Entrada Norte X=1235 e X=1515, Z=1225, H=58m): Administração & Arsenal do BOPE + Triagem
 *    com Portões Internos de Grade Dupla para Comboios (Sallie Port);
 * 6. Pavilhão 6 (Sudeste Interno X=1535, Z=1715, H=60m): Refeitório, Hospital Penitenciário & Lavanderia Industrial
 *    com chaminés altas de 78m e caixas d'água cilíndricas pretas/amarelas.
 */
export function buildSixTallPenitentiaryPavilions(world, batcher) {
  // ==========================================================================
  // PAVILHÃO 1 (SUL-INTERIOR: X = 1375, Z = 1825, H = 82m): ALA DE SUPER-SEGURANÇA ("CONTENÇÃO ÔMEGA")
  // ==========================================================================
  const omX = 1375;
  const omZ = 1825;
  const omH = 82; // 75..85m!
  batcher.addBox('bope_black', 280, omH - 8, 64, omX, 8.5 + (omH - 8) * 0.5, omZ);
  batcher.addBox('gunmetal_concrete', 284, 4.2, 68, omX, omH - 1.5, omZ);
  batcher.addBox('ares_purple', 285, 1.2, 69, omX, omH + 0.8, omZ);
  batcher.addBox('bope_black', 280, 8.5, 36, omX, 4.5, omZ + 14);
  world.addCollider(omX, omZ + 14, 280, 36, omH + 2, 0.28);

  // Contrafortes de Aço Pesado na fachada e Torretas de Vigilância no teto da Contenção Ômega
  for (let bx = omX - 120; bx <= omX + 120; bx += 40) {
    batcher.addBox('dark_steel', 6.5, omH, 8.0, bx, omH * 0.5, omZ - 31);
    batcher.addBox('laser_cyan', 1.6, omH - 14, 1.2, bx, omH * 0.5 + 4, omZ - 35.2);
    // Torreta de Vigilância Automatizada no teto
    batcher.addCylinder('dark_steel', 4.2, 5.0, 5.5, bx, omH + 3.5, omZ - 24, 8);
    batcher.addBox('laser_purple', 3.2, 1.4, 5.5, bx, omH + 5.2, omZ - 26.5);
  }

  // Janelas Blindadas Roxas/Azuis em 9 Andares da Contenção Ômega
  for (let fy = 15; fy <= omH - 8; fy += 7.5) {
    for (let wx = omX - 110; wx <= omX + 110; wx += 20) {
      batcher.addBox('smoked_glass', 10.5, 3.2, 0.8, wx, fy, omZ - 32.2);
    }
  }

  addPrisonBannerSign(
    world,
    omX,
    omH - 3.5,
    omZ - 33.5,
    92.0,
    7.2,
    'PAVILHÃO 01 — ALA DE SUPER-SEGURANÇA ("CONTENÇÃO ÔMEGA")',
    'CELAS DE CONTENÇÃO ENERGÉTICA LASER • MERCENÁRIOS A.R.E.S. & SUPER-CRIMINOSOS',
    Math.PI,
    '#38bdf8',
    '#38bdf8'
  );

  // 8 CELAS DE CONTENÇÃO ENERGÉTICA NO TÉRREO DA CONTENÇÃO ÔMEGA (Barras de Laser Azul-Neon e Roxo!)
  const omegaCellX = [1270, 1300, 1330, 1360, 1390, 1420, 1450, 1480];
  omegaCellX.forEach((cellX, idx) => {
    _buildEnergyLaserContainmentCell(
      world,
      batcher,
      cellX,
      omZ - 14.0,
      26,
      24,
      idx % 2 === 0 ? 'laser_cyan' : 'laser_purple'
    );
  });

  world.mapBuildings.push({
    x: omX,
    z: omZ,
    w: 280,
    d: 64,
    height: omH,
    color: '#581c87',
    label: 'CONTENÇÃO ÔMEGA (82M)'
  });

  // ==========================================================================
  // PAVILHÃO 2 (OESTE: X = 1095, Z = 1540, H = 66m): ALA DOS PRESOS DO CV (COMANDO VERMELHO)
  // ==========================================================================
  _buildSideDetentionPavilionWithCells(
    world,
    batcher,
    1095,
    1540,
    66,
    1,
    'PAVILHÃO 02 — ALA DE DETENÇÃO CV (OESTE)',
    '8 CELAS TÉRREAS DE FERRO • PASSARELAS METÁLICAS & ESCADAS DE INCÊNDIO',
    'prisoner_cv'
  );

  // ==========================================================================
  // PAVILHÃO 3 (LESTE: X = 1655, Z = 1540, H = 66m): ALA DOS PRESOS DO PCC (PRIMEIRO COMANDO)
  // ==========================================================================
  _buildSideDetentionPavilionWithCells(
    world,
    batcher,
    1655,
    1540,
    66,
    -1,
    'PAVILHÃO 03 — ALA DE DETENÇÃO PCC (LESTE)',
    '8 CELAS TÉRREAS DE FERRO • ISOLAMENTO DISCIPLINAR DE ALTA SEGURANÇA',
    'prisoner_pcc'
  );

  // ==========================================================================
  // PAVILHÕES 4 & 5 (ENTRADA NORTE: X = 1235 e X = 1515, Z = 1225, H = 58m) + SALLIE PORT DUPLO
  // ==========================================================================
  _buildAdminAndTriagePavilionsWithSalliePort(world, batcher);

  // ==========================================================================
  // PAVILHÃO 6 (SUDESTE INTERNO: X = 1535, Z = 1715, H = 60m): REFEITÓRIO, HOSPITAL & LAVANDERIA
  // ==========================================================================
  _buildHospitalRefectoryAndLaundryPavilion(world, batcher);
}

/**
 * Constrói 1 Cela de Contenção Energética na Ala Ômega com Barras de Laser Azul-Neon / Roxo e Mercenários A.R.E.S.
 */
function _buildEnergyLaserContainmentCell(world, batcher, x, z, w, d, laserMatKey) {
  world.prisonIslandData.energyContainmentCellsCount++;
  world.prisonIslandData.visibleGroundCellsCount++;
  const cellH = 8.0;

  batcher.addBox('dark_steel', w - 1.2, 0.22, d - 1.2, x, 0.38, z);
  batcher.addBox(laserMatKey, 5.5, 0.24, 5.5, x, cellH - 0.2, z);
  batcher.addBox('gunmetal_concrete', 1.6, cellH, d, x - w * 0.5, 0.28 + cellH * 0.5, z);
  batcher.addBox('gunmetal_concrete', 1.6, cellH, d, x + w * 0.5, 0.28 + cellH * 0.5, z);

  // Cápsula/Cama de estase magnética no fundo da cela Ômega
  batcher.addBox('ares_purple', 6.5, 1.2, 4.2, x, 1.1, z + 5.5);

  // Emissores Superiores/Inferiores + 9 Barras Verticais de Laser Energético Brilhante!
  const barsZ = z - (d * 0.5 - 0.6);
  batcher.addBox('bope_black', w, 0.75, 0.9, x, 0.7, barsZ);
  batcher.addBox('bope_black', w, 0.75, 0.9, x, cellH - 0.2, barsZ);
  for (let bx = x - w * 0.5 + 2.2; bx <= x + w * 0.5 - 2.2; bx += 2.6) {
    batcher.addCylinder(laserMatKey, 0.26, 0.26, cellH - 0.8, bx, 0.28 + cellH * 0.5, barsZ, 8);
  }
  world.addCollider(x, barsZ, w, 1.2, cellH, 0.28);

  // 2 Super-Criminosos / Mercenários A.R.E.S. contidos atrás das barras de laser!
  addBatchedLegoPerson(batcher, x - 3.0, 0.42, barsZ + 1.8, Math.PI, 'prisoner_ares', 'hands_bars');
  addBatchedLegoPerson(batcher, x + 3.5, 0.42, z + 1.5, Math.PI, 'prisoner_ares', 'stand');
  world.prisonIslandData.prisonersInCellsCount += 2;
  world.prisonIslandData.aresPrisonersCount += 2;
}

/**
 * Constrói os Pavilhões 2 (Oeste - CV) e 3 (Leste - PCC) de 66m de altura com 7 andares,
 * passarelas metálicas externas, escadas de incêndio, chaminés e 8 celas térreas visíveis em cada um!
 */
function _buildSideDetentionPavilionWithCells(world, batcher, cx, cz, h, dir, title, subTitle, factionPreset) {
  const spineW = 54;
  const spineD = 320; // Z = 1380..1700
  const spineX = cx - dir * 10;

  batcher.addBox('gunmetal_concrete', spineW, h - 8.2, spineD, spineX, 8.5 + (h - 8.2) * 0.5, cz);
  batcher.addBox('bope_black', spineW + 2, 3.8, spineD + 2, spineX, h - 1.2, cz);
  batcher.addBox('alert_yellow', spineW + 2.6, 0.9, spineD + 2.6, spineX, h + 0.6, cz);

  // Pilares laterais térreos e parede de fundo das 8 celas
  batcher.addBox('gunmetal_concrete', spineW, 8.5, 44, spineX, 4.5, cz - 138);
  batcher.addBox('gunmetal_concrete', spineW, 8.5, 44, spineX, 4.5, cz + 138);
  batcher.addBox('bope_black', 22, 8.5, 232, spineX - dir * 16, 4.5, cz);
  world.addCollider(spineX - dir * 16, cz, 22, 320, h + 1, 0.28);
  world.addCollider(spineX, cz - 138, spineW, 44, h + 1, 0.28);
  world.addCollider(spineX, cz + 138, spineW, 44, h + 1, 0.28);

  // 2 Alas Avançadas em "U" nas extremidades Norte e Sul do Pavilhão
  for (const wingZ of [cz - 138, cz + 138]) {
    const wingX = cx + dir * 24;
    batcher.addBox('gunmetal_concrete', 42, h - 4, 46, wingX, 0.28 + (h - 4) * 0.5, wingZ);
    batcher.addBox('bope_black', 44, 3.2, 48, wingX, h - 3.2, wingZ);
    world.addCollider(wingX, wingZ, 42, 46, h - 2, 0.28);
  }

  // 7 Andares de Janelas Gradeadas Estreitas + Passarelas Metálicas Externas + Escadas de Incêndio + Chaminés
  const frontX = spineX + dir * (spineW * 0.5 + 0.2);
  for (let floorY = 14; floorY <= h - 6; floorY += 7.5) {
    // Passarela metálica externa a cada 2 andares
    if (floorY === 21.5 || floorY === 36.5 || floorY === 51.5) {
      batcher.addBox('dark_steel', 3.6, 0.45, spineD - 60, frontX + dir * 1.8, floorY - 1.8, cz);
      batcher.addBox('chainlink_mesh', 0.25, 1.4, spineD - 60, frontX + dir * 3.5, floorY - 1.0, cz);
    }
    for (let wz = cz - 135; wz <= cz + 135; wz += 15) {
      batcher.addBox('matte_black', 0.8, 3.4, 6.8, frontX, floorY, wz);
      batcher.addBox('brushed_silver', 1.0, 3.4, 0.28, frontX, floorY, wz - 1.8);
      batcher.addBox('brushed_silver', 1.0, 3.4, 0.28, frontX, floorY, wz);
      batcher.addBox('brushed_silver', 1.0, 3.4, 0.28, frontX, floorY, wz + 1.8);
    }
  }

  // Escadas de Incêndio Metálicas Externas e Chaminés de Ventilação no Teto
  for (const pipeZ of [cz - 82, cz, cz + 82]) {
    batcher.addBox('dark_steel', 3.8, h - 8, 6.2, frontX + dir * 2.2, (h - 8) * 0.5 + 4, pipeZ);
    batcher.addCylinder('brushed_silver', 1.8, 2.2, 12.0, spineX, h + 6.0, pipeZ, 10);
  }

  addPrisonBannerSign(
    world,
    frontX + dir * 1.2,
    h - 2.6,
    cz,
    68.0,
    5.8,
    title,
    subTitle,
    dir > 0 ? Math.PI / 2 : -Math.PI / 2
  );

  // GALERIA DE 8 CELAS VISÍVEIS NO TÉRREO (com grades de ferro pretas e detentos lá dentro!)
  const cellZList = [cz - 98, cz - 70, cz - 42, cz - 14, cz + 14, cz + 42, cz + 70, cz + 98];
  cellZList.forEach((cellZ, idx) => {
    _buildVisibleGroundCell(
      world,
      batcher,
      spineX + dir * 11.0,
      cellZ,
      26,
      26,
      dir > 0 ? 'east' : 'west',
      idx % 2 === 0 ? factionPreset : 'prisoner_orange'
    );
  });

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: 84,
    d: spineD,
    height: h,
    color: dir > 0 ? '#991b1b' : '#1e3a8a',
    label: title.split(' — ')[0]
  });
}

function _buildVisibleGroundCell(world, batcher, x, z, w, d, facing, prisonerPreset) {
  world.prisonIslandData.visibleGroundCellsCount++;
  const cellH = 7.8;

  batcher.addBox('brushed_silver', w - 1.5, 0.18, d - 1.5, x, 0.38, z);
  batcher.addBox('searchlight_white', 4.5, 0.22, 4.5, x, cellH - 0.2, z);

  const dir = facing === 'east' ? 1 : -1;
  const barsX = x + dir * (w * 0.5 - 0.6);

  batcher.addBox('gunmetal_concrete', w, cellH, 1.4, x, 0.28 + cellH * 0.5, z - d * 0.5);
  batcher.addBox('gunmetal_concrete', w, cellH, 1.4, x, 0.28 + cellH * 0.5, z + d * 0.5);
  batcher.addBox('armor_slate', 4.2, 0.45, 7.5, x - dir * 5.5, 1.2, z - 6.0);
  batcher.addBox('prison_orange', 3.6, 0.28, 6.8, x - dir * 5.5, 1.55, z - 6.0);
  batcher.addBox('armor_slate', 4.2, 0.45, 7.5, x - dir * 5.5, 3.6, z - 6.0);
  batcher.addBox('prison_orange', 3.6, 0.28, 6.8, x - dir * 5.5, 3.95, z - 6.0);

  batcher.addBox('matte_black', 0.65, 0.55, d, barsX, 1.2, z);
  batcher.addBox('matte_black', 0.65, 0.55, d, barsX, 4.2, z);
  batcher.addBox('matte_black', 0.65, 0.65, d, barsX, cellH - 0.2, z);
  for (let bz = z - d * 0.5 + 1.8; bz <= z + d * 0.5 - 1.8; bz += 2.0) {
    batcher.addCylinder('matte_black', 0.22, 0.22, cellH, barsX, 0.28 + cellH * 0.5, bz, 8);
  }
  world.addCollider(barsX, z, 1.2, d, cellH, 0.28);

  const rotOut = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  addBatchedLegoPerson(batcher, barsX - dir * 1.6, 0.42, z - 3.2, rotOut, prisonerPreset, 'hands_bars');
  addBatchedLegoPerson(batcher, x - dir * 1.5, 0.42, z + 4.2, rotOut, 'prisoner_orange', 'stand');

  world.prisonIslandData.prisonersInCellsCount += 2;
  world.prisonIslandData.orangePrisonersCount += 1;
  if (prisonerPreset === 'prisoner_cv') world.prisonIslandData.cvPrisonersCount++;
  else if (prisonerPreset === 'prisoner_pcc') world.prisonIslandData.pccPrisonersCount++;
  else world.prisonIslandData.orangePrisonersCount++;
}

/**
 * Constrói os Pavilhões 4 & 5 (H = 58m na Entrada Norte: X = 1235 e X = 1515, Z = 1225)
 * + Portões Internos de Grade Dupla para Comboios (Sallie Port em X = 1375, Z = 1190 e Z = 1258)
 */
function _buildAdminAndTriagePavilionsWithSalliePort(world, batcher) {
  const configs = [
    {
      x: 1235,
      z: 1225,
      h: 58,
      title: 'PAVILHÃO 04 — ADMINISTRAÇÃO & ARSENAL DO BOPE',
      sub: 'COMANDO TÁTICO • SALA DE CONTROLE & PAIOL BLINDADO',
      label: 'ARSENAL DO BOPE (58M)'
    },
    {
      x: 1515,
      z: 1225,
      h: 58,
      title: 'PAVILHÃO 05 — CENTRO DE TRIAGEM & INCLUSÃO',
      sub: 'IDENTIFICAÇÃO DE DETENTOS • ESCOLTA PENITENCIÁRIA',
      label: 'PRÉDIO DE TRIAGEM (58M)'
    }
  ];

  for (const cfg of configs) {
    batcher.addBox('bope_black', 148, cfg.h, 76, cfg.x, cfg.h * 0.5 + 0.28, cfg.z);
    batcher.addBox('gunmetal_concrete', 140, cfg.h + 1.5, 68, cfg.x, (cfg.h + 1.5) * 0.5 + 0.28, cfg.z);
    batcher.addBox('alert_yellow', 150, 1.2, 78, cfg.x, cfg.h + 1.2, cfg.z);

    for (let fy = 12; fy <= cfg.h - 6; fy += 8) {
      batcher.addBox('smoked_glass', 132, 3.2, 78.2, cfg.x, fy, cfg.z);
    }

    // Holofotes e Antenas no Topo
    batcher.addBox('searchlight_white', 4.5, 2.2, 1.5, cfg.x - 45, cfg.h + 2.4, cfg.z - 38);
    batcher.addBox('searchlight_white', 4.5, 2.2, 1.5, cfg.x + 45, cfg.h + 2.4, cfg.z - 38);

    addPrisonBannerSign(world, cfg.x, cfg.h - 3.5, cfg.z - 39.2, 64.0, 5.8, cfg.title, cfg.sub, Math.PI);
    world.addCollider(cfg.x, cfg.z, 148, 76, cfg.h + 2, 0.28);
    world.mapBuildings.push({ x: cfg.x, z: cfg.z, w: 148, d: 76, height: cfg.h, color: '#111827', label: cfg.label });
  }

  // SALLIE PORT (2 Pórticos Internos de Grade Dupla para Comboios cruzando a Avenida Central em Z = 1190 e Z = 1258)
  for (const spZ of [1190, 1258]) {
    batcher.addBox('dark_steel', 132, 6.5, 6.0, 1375, 24.5, spZ);
    batcher.addBox('alert_yellow', 133, 0.85, 6.4, 1375, 21.2, spZ);
    for (const side of [-1, 1]) {
      const pilX = 1375 + side * 24;
      batcher.addBox('bope_black', 8.0, 22.0, 6.5, pilX, 11.2, spZ);
      world.addCollider(pilX, spZ, 8.0, 6.5, 24, 0.28);
      // Grades laterais retráteis do Sallie Port (deixando 34m livres no centro para os ônibus celulares!)
      for (let gx = 16; gx <= 21; gx += 1.6) {
        batcher.addCylinder('brushed_silver', 0.26, 0.26, 20.0, 1375 + side * gx, 10.5, spZ, 8);
      }
    }
  }
}

/**
 * Constrói o Pavilhão 6 (Sudeste Interno: X = 1535, Z = 1715, H = 60m):
 * Refeitório Central, Hospital Penitenciário & Lavanderia Industrial com Chaminés Altas (78m) e Caixas d'Água Pretas/Amarelas
 */
function _buildHospitalRefectoryAndLaundryPavilion(world, batcher) {
  const hx = 1535;
  const hz = 1715;
  const hh = 60; // 55..85m!

  batcher.addBox('gunmetal_concrete', 136, hh, 82, hx, hh * 0.5 + 0.28, hz);
  batcher.addBox('bope_black', 140, 4.0, 86, hx, hh - 1.5, hz);
  batcher.addBox('alert_yellow', 141, 1.0, 87, hx, hh + 0.8, hz);

  // Cruz Médica Azul/Branca do Hospital Penitenciário na fachada Oeste
  batcher.addBox('tactical_white', 1.4, 18.0, 18.0, hx - 68.5, 38.0, hz - 18);
  batcher.addBox('police_blue', 1.8, 14.0, 4.6, hx - 68.7, 38.0, hz - 18);
  batcher.addBox('police_blue', 1.8, 4.6, 14.0, hx - 68.7, 38.0, hz - 18);

  for (let fy = 12; fy <= hh - 8; fy += 8) {
    batcher.addBox('smoked_glass', 138, 3.0, 72, hx, fy, hz);
  }

  // 2 Chaminés Industriais Altas da Lavanderia/Caldeiras (Y = 78m!) no topo do Pavilhão 6
  for (const chX of [hx - 36, hx + 36]) {
    batcher.addCylinder('dark_steel', 3.4, 4.4, 22.0, chX, hh + 10.0, hz + 18, 12);
    batcher.addCylinder('alert_yellow', 3.6, 3.6, 2.2, chX, hh + 19.0, hz + 18, 12);
  }

  // Doca de Descarga de Suprimentos na base Norte do Pavilhão 6 (Z = 1670)
  batcher.addBox('armor_slate', 84, 3.2, 12, hx, 1.8, hz - 46);
  addPrisonBannerSign(
    world,
    hx,
    hh - 3.2,
    hz - 42.2,
    68.0,
    5.8,
    'PAVILHÃO 06 — HOSPITAL, REFEITÓRIO & LAVANDERIA',
    'UNIDADE MÉDICA PENITENCIÁRIA • CALDEIRAS & SUPRIMENTOS',
    Math.PI
  );

  world.addCollider(hx, hz, 136, 82, hh + 2, 0.28);
  world.mapBuildings.push({
    x: hx,
    z: hz,
    w: 136,
    d: 82,
    height: hh,
    color: '#334155',
    label: 'HOSPITAL & REFEITÓRIO (60M)'
  });
}
