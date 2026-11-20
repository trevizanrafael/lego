import {
  addPrisonBannerSign,
  addBatchedLegoPerson
} from './PrisonBatcherAndBridgeBuilder.js';

/**
 * 2. ESCALA 2X MAIOR DA ILHA DA PRISÃO (840m x 860m) + BORDA ROCHOSA + DOCA NAVAL EXTERNA DA GUARDA COSTEIRA:
 * - Ilha-Fortaleza Federal (X = 955..1795, Z = 1120..1980, centro X = 1375, Z = 1550) com mais de 2x a área anterior;
 * - Borda Costeira Rochosa & Quebra-Mar de LEGO cercando toda a base externa na água;
 * - Doca Naval da Guarda Costeira fora da Muralha Oeste (X = 860..995, Z = 1505..1595) ligada à muralha por
 *   Portão Lateral Blindado, com Guindaste Naval de 38m, caixas de suprimentos e 2 Lanchas Blindadas da Polícia Marítima;
 * - Muralha Perimetral Colossal de 40m (X = 995..1755, Z = 1125..1935) + 8 Torres de Vigia de 68m!
 */
export function buildPrisonIslandPerimeterWallsAndCoastGuardDock(world, batcher) {
  const ix = 1375;
  const iz = 1550;
  const islandW = 840; // X = 955..1795
  const islandD = 860; // Z = 1120..1980

  // Base Rochosa Costeira Escura + Plataforma Continental de Concreto Pesado da Ilha
  batcher.addBox('coastal_rock', islandW + 32, 2.4, islandD + 32, ix, -0.85, iz);
  batcher.addBox('yard_concrete', islandW, 1.1, islandD, ix, -0.25, iz);
  world.addCollider(ix, iz, islandW, islandD, 0.3, -2.5);
  world.mapBlocks.push({ x: ix, z: iz, w: islandW, d: islandD, color: '#334155' });

  // Anel de Rochas Costeiras / Quebra-Mar de Pedra Escura no Oceano cercando toda a Ilha 2x Maior
  for (let rx = 940; rx <= 1810; rx += 26) {
    for (const rz of [1104, 1994]) {
      if (rz === 1104 && Math.abs(rx - ix) < 36) continue; // Deixa livre a chegada da Ponte Blindada
      const rw = 18 + ((rx * 7) % 14);
      const rh = 3.6 + ((rx * 13) % 6);
      const rd = 16 + ((rx * 11) % 12);
      batcher.addBox('coastal_rock', rw, rh, rd, rx, rh * 0.35 - 0.5, rz);
      batcher.addBox('sea_foam', rw + 4.0, 0.16, rd + 4.0, rx, -0.36, rz);
      world.prisonIslandData.coastalRocksCount++;
    }
  }
  for (let rz = 1125; rz <= 1975; rz += 26) {
    for (const rx of [940, 1810]) {
      // Deixa abertura na frente da Doca Naval da Guarda Costeira a Oeste (X=940, Z=1500..1600)
      if (rx === 940 && rz >= 1495 && rz <= 1605) continue;
      const rw = 16 + ((rz * 9) % 12);
      const rh = 3.8 + ((rz * 17) % 6);
      const rd = 18 + ((rz * 7) % 14);
      batcher.addBox('coastal_rock', rw, rh, rd, rx, rh * 0.35 - 0.5, rz);
      batcher.addBox('sea_foam', rw + 4.0, 0.16, rd + 4.0, rx, -0.36, rz);
      world.prisonIslandData.coastalRocksCount++;
    }
  }

  // ==========================================================================
  // DOCA NAVAL DA GUARDA COSTEIRA (FORA DA MURALHA OESTE: X = 860..995, Z = 1505..1595)
  // ==========================================================================
  const dockX = 928;
  const dockZ = 1550;
  const dockW = 136; // X = 860..996
  const dockD = 90;  // Z = 1505..1595
  batcher.addBox('gunmetal_concrete', dockW, 2.2, dockD, dockX, -0.82, dockZ);
  batcher.addBox('armor_slate', dockW - 4, 0.16, dockD - 4, dockX, 0.32, dockZ);
  world.addCollider(dockX, dockZ, dockW, dockD, 0.3, -2.5);
  world.mapBlocks.push({ x: dockX, z: dockZ, w: dockW, d: dockD, color: '#1e293b' });

  // Faixas Zebradas Amarelas/Pretas na borda marítima Oeste (X = 862), Cabeços de Amarração e Defensas de Borracha
  batcher.addBox('alert_yellow', 2.4, 0.12, dockD - 2, 862.5, 0.41, dockZ);
  for (let dz = 1512; dz <= 1588; dz += 12) {
    batcher.addBox('matte_black', 2.5, 0.14, 4.5, 862.5, 0.42, dz);
    batcher.addBox('matte_black', 1.4, 1.8, 3.2, 859.6, -0.2, dz);
    batcher.addCylinder('dark_steel', 0.55, 0.72, 1.3, 864.8, 0.95, dz, 8);
  }

  // 2 Dedos de Atracação (Píeres Flutuantes em X = 842..860) onde as 2 Lanchas Blindadas da Polícia Marítima ficam atracadas!
  for (const pierZ of [1516, 1550, 1584]) {
    batcher.addBox('gunmetal_concrete', 24, 1.4, 4.8, 848, -0.35, pierZ);
    batcher.addBox('alert_yellow', 24.2, 0.18, 5.0, 848, 0.42, pierZ);
    world.addCollider(848, pierZ, 24, 4.8, 0.3, -1.5);
  }

  // Guindaste Naval da Guarda Costeira (H = 38m em X = 885, Z = 1518) + Contêineres e Caixas de Suprimentos do BOPE
  batcher.addBox('alert_yellow', 10, 4.5, 10, 885, 2.5, 1518);
  batcher.addBox('dark_steel', 4.5, 34.0, 4.5, 885, 19.5, 1518);
  batcher.addBox('alert_yellow', 32.0, 3.2, 3.2, 874, 35.5, 1518);
  batcher.addCable('matte_black', 0.32, 862, 34.0, 1518, 862, 10.0, 1518);
  batcher.addBox('police_blue', 6.5, 3.8, 4.2, 862, 8.2, 1518);
  world.addCollider(885, 1518, 10, 10, 38, 0.28);

  // Caixas de Suprimentos Táticos e Combustível Naval no Píer + Policiais da Guarda Costeira
  for (let cx = 905; cx <= 955; cx += 16) {
    batcher.addBox('police_blue', 8.5, 4.2, 5.5, cx, 2.4, 1520);
    batcher.addBox('alert_yellow', 8.7, 0.45, 5.7, cx, 4.55, 1520);
    batcher.addBox('gunmetal_concrete', 7.5, 3.6, 5.0, cx, 2.1, 1580);
    world.addCollider(cx, 1520, 8.5, 5.5, 4.6, 0.28);
    world.addCollider(cx, 1580, 7.5, 5.0, 3.8, 0.28);
  }
  addBatchedLegoPerson(batcher, 872, 0.42, 1535, -Math.PI / 2, 'bope_guard', 'stand');
  addBatchedLegoPerson(batcher, 872, 0.42, 1565, -Math.PI / 2, 'warden_police', 'stand');
  addBatchedLegoPerson(batcher, 945, 0.42, 1550, 0, 'bope_guard', 'stand');
  world.prisonIslandData.guardsCount += 3;

  // ==========================================================================
  // MURALHA PERIMETRAL COLOSSAL (H = 40m, X = 995..1755, Z = 1125..1935 — 760m x 810m!)
  // ==========================================================================
  const wallH = 40;
  const wallThick = 14;
  const minX = 995;
  const maxX = 1755;
  const minZ = 1125;
  const maxZ = 1935;
  const spanX = maxX - minX; // 760m
  const spanZ = maxZ - minZ; // 810m

  // Muralha Sul (Z = 1935) e Muralha Leste (X = 1755)
  _buildFortifiedWallSegment(world, batcher, ix, maxZ, spanX, wallThick, wallH, true);
  _buildFortifiedWallSegment(world, batcher, maxX, (minZ + maxZ) * 0.5, wallThick, spanZ, wallH, false);

  // Muralha Oeste (X = 995) dividida em 2 trechos com Portão Lateral Blindado (Z = 1550) para a Doca Naval!
  _buildFortifiedWallSegment(world, batcher, minX, 1325, wallThick, 400, wallH, false); // Z = 1125..1525
  _buildFortifiedWallSegment(world, batcher, minX, 1755, wallThick, 360, wallH, false); // Z = 1575..1935
  // Sobreportão e Pórtico Blindado do Portão Lateral Naval (X = 995, Z = 1550, vão livre Z = 1536..1564)
  batcher.addBox('gunmetal_concrete', 16, 22, 54, minX, 29.3, 1550);
  batcher.addBox('alert_yellow', 17, 1.0, 55, minX, 18.2, 1550);
  addPrisonBannerSign(
    world,
    minX - 8.5,
    26.0,
    1550,
    42.0,
    5.0,
    'DOCA NAVAL — GUARDA COSTEIRA',
    'ACESSO MARÍTIMO BLINDADO • BOPE / POLÍCIA FEDERAL',
    -Math.PI / 2
  );

  // Muralha Norte (Z = 1125) dividida em 2 alas laterais para o Portão Blindado Monumental (X = 1375)
  _buildFortifiedWallSegment(world, batcher, 1161, minZ, 332, wallThick, wallH, true); // X = 995..1327
  _buildFortifiedWallSegment(world, batcher, 1589, minZ, 332, wallThick, wallH, true); // X = 1423..1755

  // PORTÃO BLINDADO MONUMENTAL NORTE (X = 1375, Z = 1125)
  batcher.addBox('gunmetal_concrete', 96, 24, 16, ix, 30.3, minZ);
  batcher.addBox('bope_black', 98, 4.2, 17.5, ix, 41.2, minZ);
  batcher.addBox('alert_yellow', 98.5, 0.9, 18.0, ix, 18.6, minZ);
  batcher.addBox('alert_yellow', 98.5, 0.9, 18.0, ix, 43.0, minZ);

  for (const side of [-1, 1]) {
    const pillarX = ix + side * 22;
    batcher.addBox('dark_steel', 16, 18.5, 15, pillarX, 9.5, minZ);
    world.addCollider(pillarX, minZ, 16, 15, 42, 0.28);
    for (let bar = 0; bar < 5; bar++) {
      const bxBar = ix + side * (12.8 + bar * 1.1);
      batcher.addCylinder('brushed_silver', 0.28, 0.28, 18.0, bxBar, 9.3, minZ, 8);
    }
  }
  for (let gx = ix - 12; gx <= ix + 12; gx += 2.4) {
    batcher.addCylinder('brushed_silver', 0.26, 0.26, 9.5, gx, 23.5, minZ, 8);
  }

  addPrisonBannerSign(
    world,
    ix,
    32.5,
    minZ - 8.4,
    68.0,
    7.2,
    'PENITENCIÁRIA DE SEGURANÇA MÁXIMA',
    'COMPLEXO FEDERAL "A BALSA" — FORÇA TÁTICA / BOPE',
    0,
    '#ef4444',
    '#facc15'
  );
  addPrisonBannerSign(
    world,
    ix,
    32.5,
    minZ + 8.4,
    58.0,
    6.2,
    'SAÍDA CONTROLADA — PONTE BLINDADA',
    'PORTÃO DUPLO DE CONTENÇÃO (SALLIE PORT)',
    Math.PI,
    '#facc15',
    '#facc15'
  );

  // 8 TORRES DE VIGIA GIGANTES (H = 68m — 4 esquinas + 2 laterais do Portão Principal + 2 laterais centrais!)
  const watchtowerCoords = [
    { x: minX, z: minZ, label: 'TORRE DE VIGIA NOROESTE' },
    { x: maxX, z: minZ, label: 'TORRE DE VIGIA NORDESTE' },
    { x: minX, z: maxZ, label: 'TORRE DE VIGIA SUDOESTE' },
    { x: maxX, z: maxZ, label: 'TORRE DE VIGIA SUDESTE' },
    { x: ix - 46, z: minZ, label: 'TORRE DO PORTÃO OESTE' },
    { x: ix + 46, z: minZ, label: 'TORRE DO PORTÃO LESTE' },
    { x: minX, z: 1515, label: 'TORRE DE VIGIA DOCA NAVAL' },
    { x: maxX, z: 1540, label: 'TORRE DE VIGIA LESTE' }
  ];

  for (const wt of watchtowerCoords) {
    _buildGiantWatchtower(world, batcher, wt.x, wt.z, 68, wt.label);
  }
}

function _buildFortifiedWallSegment(world, batcher, x, z, w, d, h, isHorizontal) {
  batcher.addBox('gunmetal_concrete', w, h, d, x, 0.28 + h * 0.5, z);
  batcher.addBox('armor_slate', w + 2.4, 1.2, d + 2.4, x, 0.28 + h + 0.6, z);
  if (isHorizontal) {
    batcher.addBox('chainlink_mesh', w, 3.8, 0.35, x, 0.28 + h + 3.1, z - d * 0.5 - 0.8);
    batcher.addBox('chainlink_mesh', w, 3.8, 0.35, x, 0.28 + h + 3.1, z + d * 0.5 + 0.8);
    for (let xx = x - w * 0.5 + 20; xx <= x + w * 0.5 - 20; xx += 36) {
      batcher.addBox('dark_steel', 4.4, h - 2, d + 3.2, xx, 0.28 + (h - 2) * 0.5, z);
      batcher.addBox('alert_yellow', 14.0, 2.2, d + 0.8, xx, 1.4, z);
    }
  } else {
    batcher.addBox('chainlink_mesh', 0.35, 3.8, d, x - w * 0.5 - 0.8, 0.28 + h + 3.1, z);
    batcher.addBox('chainlink_mesh', 0.35, 3.8, d, x + w * 0.5 + 0.8, 0.28 + h + 3.1, z);
    for (let zz = z - d * 0.5 + 20; zz <= z + d * 0.5 - 20; zz += 36) {
      batcher.addBox('dark_steel', w + 3.2, h - 2, 4.4, x, 0.28 + (h - 2) * 0.5, zz);
      batcher.addBox('alert_yellow', w + 0.8, 2.2, 14.0, x, 1.4, zz);
    }
  }
  world.addCollider(x, z, w, d, h + 2, 0.28);
}

function _buildGiantWatchtower(world, batcher, x, z, h, label) {
  batcher.addBox('bope_black', 22, 18, 22, x, 9.2, z);
  batcher.addBox('dark_steel', 16, h - 14, 16, x, 0.28 + (h - 14) * 0.5, z);
  for (const bandY of [18, 34, 50]) {
    batcher.addBox('alert_yellow', 17.2, 1.8, 17.2, x, bandY, z);
  }
  const deckY = h - 12;
  batcher.addBox('gunmetal_concrete', 25, 2.2, 25, x, deckY, z);
  batcher.addBox('alert_yellow', 25.6, 0.65, 25.6, x, deckY + 1.2, z);
  batcher.addCylinder('bope_black', 10.5, 10.5, 8.5, x, deckY + 5.2, z, 8);
  batcher.addCylinder('smoked_glass', 10.8, 10.8, 4.2, x, deckY + 5.6, z, 8);
  batcher.addCylinder('dark_steel', 12.2, 12.2, 1.8, x, deckY + 9.8, z, 8);
  batcher.addCylinder('brushed_silver', 0.35, 0.5, 6.5, x, h + 1.5, z, 8);
  batcher.addBox('siren_red', 1.6, 1.6, 1.6, x, h + 5.0, z);
  batcher.addBox('searchlight_white', 2.6, 1.8, 2.6, x, deckY + 2.4, z);
  const dirX = x < 1375 ? 1 : -1;
  const dirZ = z < 1540 ? 1 : -1;
  batcher.addCylinder(
    'searchlight_beam',
    1.2,
    8.5,
    28.0,
    x + dirX * 8,
    deckY - 10,
    z + dirZ * 8,
    10,
    dirZ * 0.45,
    -dirX * 0.45
  );
  addBatchedLegoPerson(batcher, x + dirX * 9.2, deckY + 1.2, z, dirX > 0 ? Math.PI / 2 : -Math.PI / 2, 'bope_guard', 'stand');
  world.prisonIslandData.guardsCount++;
  world.prisonIslandData.watchtowersCount++;
  world.addCollider(x, z, 22, 22, h, 0.28);
  world.mapBuildings.push({ x, z, w: 22, d: 22, height: h, color: '#0f172a', label });
}

/**
 * Terraço de Comando Superior (Y = 126.28m) + DUPLO HELIPONTO POLICIAL (X = 1352 e X = 1398, Z = 1540)
 * + Torre de Radar, Antenas e Sirenes da Cidadela
 */
export function buildCitadelRooftopHelipadsAndRadar(batcher, cx, cz, roofY) {
  batcher.addBox('armor_slate', 90, 0.5, 90, cx, roofY, cz);

  for (const heliX of [1352, 1398]) {
    batcher.addCylinder('matte_black', 17.5, 17.5, 0.36, heliX, roofY + 0.32, cz, 24);
    batcher.addCylinder('alert_yellow', 15.8, 15.8, 0.38, heliX, roofY + 0.34, cz, 24);
    batcher.addCylinder('matte_black', 14.2, 14.2, 0.40, heliX, roofY + 0.36, cz, 24);
    // Letra "H" Branca em cada Heliponto Policial
    batcher.addBox('tactical_white', 2.0, 0.12, 12.0, heliX - 4.0, roofY + 0.46, cz);
    batcher.addBox('tactical_white', 2.0, 0.12, 12.0, heliX + 4.0, roofY + 0.46, cz);
    batcher.addBox('tactical_white', 8.0, 0.12, 2.0, heliX, roofY + 0.46, cz);
  }

  // Torre de Radar Giratório, Antenas de Comunicação e Sirenes no Topo Norte/Sul da Cidadela (Y = 126.5..142m)
  batcher.addBox('dark_steel', 18, 8.5, 12, cx, roofY + 4.2, cz - 34);
  batcher.addCylinder('brushed_silver', 0.8, 1.1, 12.0, cx, roofY + 14.0, cz - 34, 8);
  batcher.addBox('alert_yellow', 12.0, 2.2, 1.4, cx, roofY + 19.5, cz - 34);
  batcher.addBox('siren_red', 1.8, 1.8, 1.8, cx - 7, roofY + 9.2, cz - 34);
  batcher.addBox('siren_blue', 1.8, 1.8, 1.8, cx + 7, roofY + 9.2, cz - 34);
  for (const antX of [cx - 32, cx + 32]) {
    batcher.addCylinder('brushed_silver', 0.35, 0.65, 15.0, antX, roofY + 7.5, cz + 34, 8);
    batcher.addBox('siren_red', 1.4, 1.4, 1.4, antX, roofY + 15.5, cz + 34);
  }
}

/**
 * 5. PREENCHIMENTO 100% DO PÁTIO INTERNO EM 4 SETORES CERCADOS (ZERO CHÃO CINZA VAZIO!):
 * - Avenida Central Asfaltada + Alambrados Duplos de Tela Metálica + Passarelas Elevadas de Ronda (com guardas em cima!);
 * - Setor 1 (Oeste/Sudoeste: X = 1170..1310, Z = 1310..1740): Grande Pátio de Banho de Sol com 2 Quadras Esportivas
 *   Completas (1 Futsal + 1 Basquete), Arquibancadas de Concreto, Academia de Musculação ao Ar Livre (12 bancos),
 *   20 Mesas de Concreto e dezenas de detentos de uniforme laranja vigiados por guardas nas passarelas elevadas;
 * - Setor 2 (Nordeste: X = 1435..1595, Z = 1280..1380): Garagem Tática & Pátio de Comboios Policiais com
 *   4 Ônibus Celulares Blindados, Caveirões do BOPE, viaturas e caixas de arsenal;
 * - Setor 3 (Centro-Leste: X = 1435..1595, Z = 1395..1535): Subestação de Energia & Geradores da Prisão com
 *   6 Transformadores Gigantes, 6 Geradores a Diesel, 8 Bobinas e 4 Torres de Energia;
 * - Setor 4 (Sudeste: X = 1435..1595, Z = 1565..1665): Pátio Logístico de Caixas d'Água Cilíndricas Pretas/Amarelas e Suprimentos.
 */
export function buildFourInternalCourtyardSectors(world, batcher) {
  // Vias Asfaltadas Internas conectando o Portão Norte (Z=1125) à Cidadela Central (Z=1540) e aos Setores
  batcher.addBox('matte_black', 42, 0.14, 360, 1375, 0.34, 1305);
  batcher.addBox('alert_yellow', 0.45, 0.06, 350, 1374.4, 0.41, 1305);
  batcher.addBox('alert_yellow', 0.45, 0.06, 350, 1375.6, 0.41, 1305);
  world.mapRoads.push({ x: 1375, z: 1305, w: 42, d: 360, isMain: true });

  // ==========================================================================
  // PASSARELAS ELEVADAS DE RONDA (Y = 9.5m) & ALAMBRADOS DUPLOS DE TELA METÁLICA DIVIDINDO OS SETORES
  // ==========================================================================
  const catwalks = [
    [1315, 1525, 6.0, 420, false], // Passarela Elevada Leste do Pátio de Banho de Sol
    [1240, 1310, 150, 6.0, true],  // Passarela Elevada Norte do Pátio de Banho de Sol
    [1240, 1525, 150, 6.0, true],  // Passarela Elevada Central entre as 2 Quadras e a Academia
    [1240, 1740, 150, 6.0, true],  // Passarela Elevada Sul do Pátio de Banho de Sol
    [1435, 1465, 6.0, 360, false], // Passarela Elevada Oeste da Garagem / Subestação / Pátio Logístico
    [1515, 1388, 160, 6.0, true]   // Passarela Elevada entre Garagem Tática e Subestação de Energia
  ];
  for (const [cwX, cwZ, cwW, cwD, isHoriz] of catwalks) {
    world.prisonIslandData.elevatedGuardCatwalksCount++;
    batcher.addBox('dark_steel', cwW, 0.8, cwD, cwX, 9.5, cwZ);
    batcher.addBox('alert_yellow', cwW + 0.4, 0.25, cwD + 0.4, cwX, 9.9, cwZ);
    // Alambrado Duplo de Tela Metálica sob a passarela (Y = 0.3..9.2m)
    batcher.addBox('chainlink_mesh', isHoriz ? cwW : 0.35, 8.8, isHoriz ? 0.35 : cwD, cwX - (isHoriz ? 0 : 1.8), 4.7, cwZ - (isHoriz ? 1.8 : 0));
    batcher.addBox('chainlink_mesh', isHoriz ? cwW : 0.35, 8.8, isHoriz ? 0.35 : cwD, cwX + (isHoriz ? 0 : 1.8), 4.7, cwZ + (isHoriz ? 1.8 : 0));
    // Guardas do BOPE armados vigiando de cima das Passarelas Elevadas de Ronda!
    addBatchedLegoPerson(batcher, cwX, 10.0, cwZ, isHoriz ? 0 : -Math.PI / 2, 'bope_guard', 'stand');
    addBatchedLegoPerson(
      batcher,
      cwX + (isHoriz ? 28 : 0),
      10.0,
      cwZ + (isHoriz ? 0 : 35),
      isHoriz ? Math.PI : -Math.PI / 2,
      'warden_police',
      'stand'
    );
    world.prisonIslandData.guardsCount += 2;
  }

  // ==========================================================================
  // SETOR 1 (X = 1170..1310, Z = 1315..1735): GRANDE PÁTIO DE BANHO DE SOL DOS DETENTOS
  // ==========================================================================
  // 1A. QUADRA DE FUTSAL (X = 1235, Z = 1375 — 62m x 82m) + Arquibancada de Concreto
  const futX = 1235;
  const futZ = 1375;
  batcher.addBox('futsal_green', 62, 0.14, 82, futX, 0.34, futZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ - 39);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ + 39);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, futX - 29, 0.42, futZ);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, futX + 29, 0.42, futZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ);
  batcher.addCylinder('tactical_white', 7.0, 7.0, 0.06, futX, 0.42, futZ, 16);
  for (const dir of [-1, 1]) {
    const goalZ = futZ + dir * 38.5;
    batcher.addBox('tactical_white', 11.0, 0.38, 0.38, futX, 3.6, goalZ);
    batcher.addBox('tactical_white', 0.38, 3.4, 0.38, futX - 5.3, 1.98, goalZ);
    batcher.addBox('tactical_white', 0.38, 3.4, 0.38, futX + 5.3, 1.98, goalZ);
  }
  // Arquibancada de Concreto de 4 Degraus ao lado da Quadra de Futsal (X = 1280, Z = 1375)
  for (let step = 0; step < 4; step++) {
    batcher.addBox('gunmetal_concrete', 3.2, (step + 1) * 1.1, 72, 1274 + step * 3.2, 0.28 + (step + 1) * 0.55, futZ);
  }

  // 1B. QUADRA DE BASQUETE (X = 1235, Z = 1472 — 62m x 82m) + Tabelas + Arquibancada de Concreto
  const bskX = 1235;
  const bskZ = 1472;
  batcher.addBox('court_blue', 62, 0.14, 82, bskX, 0.34, bskZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ - 39);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ + 39);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, bskX - 29, 0.42, bskZ);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, bskX + 29, 0.42, bskZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ);
  for (const dir of [-1, 1]) {
    const hoopZ = bskZ + dir * 37.5;
    batcher.addBox('prison_orange', 14, 0.06, 15, bskX, 0.41, bskZ + dir * 31);
    batcher.addCylinder('dark_steel', 0.35, 0.42, 6.8, bskX, 3.68, hoopZ + dir * 2.0, 8);
    batcher.addBox('tactical_white', 4.8, 3.2, 0.35, bskX, 6.4, hoopZ + dir * 0.5);
    batcher.addBox('prison_orange', 1.6, 0.24, 1.6, bskX, 5.4, hoopZ - dir * 0.3);
  }
  for (let step = 0; step < 4; step++) {
    batcher.addBox('gunmetal_concrete', 3.2, (step + 1) * 1.1, 72, 1274 + step * 3.2, 0.28 + (step + 1) * 0.55, bskZ);
  }

  // 20 Detentos LEGO jogando Futsal e Basquete ou assistindo nas arquibancadas
  const sportsInmates = [
    [futX - 10, futZ - 18, 0, 'prisoner_orange'], [futX + 12, futZ - 12, 0.6, 'prisoner_cv'],
    [futX - 6, futZ + 8, -0.5, 'prisoner_pcc'], [futX + 14, futZ + 20, 2.4, 'prisoner_orange'],
    [futX, futZ - 34, 0, 'prisoner_orange'], [futX, futZ + 34, Math.PI, 'prisoner_cv'],
    [bskX - 12, bskZ - 16, 0.4, 'prisoner_orange'], [bskX + 10, bskZ - 8, -0.8, 'prisoner_pcc'],
    [bskX - 8, bskZ + 14, 1.8, 'prisoner_cv'], [bskX + 12, bskZ + 22, -2.2, 'prisoner_orange'],
    [1277, futZ - 15, -Math.PI / 2, 'prisoner_orange'], [1277, futZ + 15, -Math.PI / 2, 'prisoner_cv'],
    [1277, bskZ - 15, -Math.PI / 2, 'prisoner_pcc'], [1277, bskZ + 15, -Math.PI / 2, 'prisoner_orange']
  ];
  for (const [px, pz, rot, preset] of sportsInmates) {
    addBatchedLegoPerson(batcher, px, 0.42, pz, rot, preset, 'stand');
    if (preset === 'prisoner_cv') world.prisonIslandData.cvPrisonersCount++;
    else if (preset === 'prisoner_pcc') world.prisonIslandData.pccPrisonersCount++;
    else world.prisonIslandData.orangePrisonersCount++;
  }

  // 1C. ACADEMIA DE MUSCULAÇÃO AO AR LIVRE (X = 1235, Z = 1585 — 12 Bancos de Supino & Aparelhos!)
  const gymX = 1235;
  const gymZ = 1585;
  batcher.addBox('matte_black', 92, 0.14, 78, gymX, 0.34, gymZ);
  batcher.addBox('alert_yellow', 92.5, 0.08, 1.2, gymX, 0.38, gymZ - 38.5);
  batcher.addBox('alert_yellow', 92.5, 0.08, 1.2, gymX, 0.38, gymZ + 38.5);
  batcher.addBox('dark_steel', 24.0, 4.4, 5.0, gymX, 2.5, gymZ);

  for (let row = -1; row <= 1; row += 2) {
    for (let col = -2.5; col <= 2.5; col += 1) {
      const bx = gymX + col * 13.5;
      const bz = gymZ + row * 18.0;
      world.prisonIslandData.weightBenchesCount++;
      batcher.addBox('dark_steel', 1.5, 0.75, 4.2, bx, 0.75, bz);
      batcher.addBox('prison_orange', 1.6, 0.25, 4.0, bx, 1.22, bz);
      batcher.addBox('brushed_silver', 2.4, 2.2, 0.35, bx, 1.45, bz - 1.5);
      batcher.addBox('brushed_silver', 4.4, 0.22, 0.22, bx, 2.35, bz - 1.5);
      for (const side of [-1, 1]) {
        batcher.addCylinder('bope_black', 0.75, 0.75, 0.32, bx + side * 1.65, 2.35, bz - 1.5, 8, 0, Math.PI / 2);
      }
      const preset = col < 0 ? 'prisoner_cv' : 'prisoner_orange';
      addBatchedLegoPerson(batcher, bx, 0.42, bz + 2.8, 0, preset, 'bench_press');
      if (preset === 'prisoner_cv') world.prisonIslandData.cvPrisonersCount++;
      else world.prisonIslandData.orangePrisonersCount++;
    }
  }

  // 1D. PÁTIO DE MESAS E BANCOS DE CONCRETO (X = 1235, Z = 1685 — 20 Mesas de Concreto 5x4!)
  const cafeX = 1235;
  const cafeZ = 1685;
  batcher.addBox('armor_slate', 92, 0.16, 82, cafeX, 0.35, cafeZ);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const tx = cafeX - 32 + c * 16;
      const tz = cafeZ - 26 + r * 17;
      world.prisonIslandData.cafeteriaTablesCount++;
      batcher.addBox('brushed_silver', 4.8, 1.15, 2.2, tx, 0.92, tz);
      batcher.addBox('gunmetal_concrete', 4.8, 0.68, 0.9, tx, 0.68, tz - 1.9);
      batcher.addBox('gunmetal_concrete', 4.8, 0.68, 0.9, tx, 0.68, tz + 1.9);
      if ((r + c) % 2 === 0) {
        addBatchedLegoPerson(batcher, tx - 1.2, 0.42, tz - 2.6, 0, 'prisoner_orange', 'stand');
        addBatchedLegoPerson(batcher, tx + 1.2, 0.42, tz + 2.6, Math.PI, 'prisoner_pcc', 'stand');
        world.prisonIslandData.orangePrisonersCount++;
        world.prisonIslandData.pccPrisonersCount++;
      }
    }
  }

  // ==========================================================================
  // SETOR 2 (X = 1515, Z = 1330): GARAGEM TÁTICA & PÁTIO DE COMBOIOS POLICIAIS
  // ==========================================================================
  const garX = 1515;
  const garZ = 1330;
  batcher.addBox('matte_black', 148, 0.14, 92, garX, 0.34, garZ);
  // Vagas Demarcadas com Faixas Amarelas no Piso para os Caveirões e Ônibus Celulares
  for (let vx = 1445; vx <= 1585; vx += 18) {
    batcher.addBox('alert_yellow', 0.45, 0.06, 22.0, vx, 0.41, 1315);
    batcher.addBox('alert_yellow', 0.45, 0.06, 22.0, vx, 0.41, 1355);
  }
  const busCoords = [
    [1454, 1355, Math.PI],
    [1478, 1355, Math.PI],
    [1502, 1355, Math.PI],
    [1526, 1355, Math.PI]
  ];
  for (const [bx, bz, rotY] of busCoords) {
    _addArmoredPrisonTransportBus(world, batcher, bx, bz, rotY);
  }
  // Galpão de Manutenção & Caixas de Arsenal Policial no Leste do Setor 2 (X = 1568, Z = 1330)
  batcher.addBox('bope_black', 34, 22, 76, 1568, 11.28, 1330);
  batcher.addBox('alert_yellow', 35, 0.9, 77, 1568, 22.2, 1330);
  world.addCollider(1568, 1330, 34, 76, 23, 0.28);

  // ==========================================================================
  // SETOR 3 (X = 1515, Z = 1465): SUBESTAÇÃO DE ENERGIA & GERADORES DA PRISÃO
  // ==========================================================================
  const subX = 1515;
  const subZ = 1465;
  batcher.addBox('gunmetal_concrete', 146, 0.22, 116, subX, 0.36, subZ);
  // Mureta Perimetral Zebrada Amarela/Preta da Subestação
  batcher.addBox('alert_yellow', 146, 2.2, 1.6, subX, 1.38, subZ - 57);
  batcher.addBox('alert_yellow', 146, 2.2, 1.6, subX, 1.38, subZ + 57);

  // 6 Transformadores Elétricos Gigantes com Aletas de Resfriamento e Buchas Isoladoras
  for (let tx = 1456; tx <= 1556; tx += 20) {
    world.prisonIslandData.substationTransformersCount++;
    batcher.addBox('armor_slate', 10.5, 11.0, 12.0, tx, 5.8, subZ - 26);
    batcher.addBox('dark_steel', 11.5, 8.5, 13.0, tx, 5.5, subZ - 26);
    batcher.addBox('alert_yellow', 11.6, 0.65, 13.2, tx, 11.2, subZ - 26);
    for (const bxOff of [-3, 0, 3]) {
      batcher.addCylinder('brushed_silver', 0.45, 0.65, 4.5, tx + bxOff, 13.5, subZ - 26, 8);
      batcher.addCylinder('laser_cyan', 0.55, 0.55, 0.8, tx + bxOff, 15.8, subZ - 26, 8);
      world.prisonIslandData.powerCoilsCount++;
    }
    world.addCollider(tx, subZ - 26, 11.5, 13.0, 14, 0.28);
  }

  // 6 Geradores Industriais a Diesel Blindados (Preto/Amarelo com escapamentos duplos)
  for (let gx = 1456; gx <= 1556; gx += 20) {
    world.prisonIslandData.dieselGeneratorsCount++;
    batcher.addBox('bope_black', 11.0, 7.2, 16.0, gx, 3.9, subZ + 18);
    batcher.addBox('alert_yellow', 11.4, 1.2, 16.4, gx, 3.8, subZ + 18);
    batcher.addCylinder('brushed_silver', 0.55, 0.55, 5.0, gx - 2.5, 9.5, subZ + 14, 8);
    batcher.addCylinder('brushed_silver', 0.55, 0.55, 5.0, gx + 2.5, 9.5, subZ + 14, 8);
    world.addCollider(gx, subZ + 18, 11.0, 16.0, 8.5, 0.28);
  }

  // 4 Torres de Energia / Transmissão de Alta Tensão (H = 42m!) nos cantos da Subestação
  const powerTowerCoords = [
    [1452, subZ - 46],
    [1576, subZ - 46],
    [1452, subZ + 46],
    [1576, subZ + 46]
  ];
  for (const [ptX, ptZ] of powerTowerCoords) {
    world.prisonIslandData.powerTowersCount++;
    batcher.addBox('dark_steel', 5.2, 42.0, 5.2, ptX, 21.28, ptZ);
    batcher.addBox('alert_yellow', 16.0, 1.4, 2.2, ptX, 32.0, ptZ);
    batcher.addBox('alert_yellow', 12.0, 1.4, 2.2, ptX, 39.5, ptZ);
    batcher.addBox('laser_cyan', 1.2, 1.8, 1.2, ptX - 7.2, 31.0, ptZ);
    batcher.addBox('laser_cyan', 1.2, 1.8, 1.2, ptX + 7.2, 31.0, ptZ);
    world.addCollider(ptX, ptZ, 5.5, 5.5, 42, 0.28);
  }

  // ==========================================================================
  // SETOR 4 (X = 1515, Z = 1612): PÁTIO DE CAIXAS D'ÁGUA CILÍNDRICAS PRETAS/AMARELAS & CALDEIRAS
  // ==========================================================================
  for (const wtX of [1462, 1498, 1534, 1570]) {
    world.prisonIslandData.waterTowersCount++;
    batcher.addCylinder('dark_steel', 6.5, 7.2, 14.0, wtX, 7.28, 1608, 12);
    batcher.addCylinder('bope_black', 8.2, 8.2, 22.0, wtX, 24.5, 1608, 16);
    batcher.addCylinder('alert_yellow', 8.4, 8.4, 2.6, wtX, 24.5, 1608, 16);
    batcher.addCylinder('alert_yellow', 8.4, 8.4, 1.8, wtX, 34.8, 1608, 16);
    world.addCollider(wtX, 1608, 16.5, 16.5, 36, 0.28);
  }
}

/**
 * Constrói 1 Ônibus / Caminhão Celular Blindado ("TRANSPORTE PENITENCIÁRIO" — 5.0m x 16.2m x 4.8m)
 */
function _addArmoredPrisonTransportBus(world, batcher, x, z, rotY = 0) {
  world.prisonIslandData.armoredPrisonBusesCount++;

  batcher.addBox('matte_black', 4.6, 1.2, 16.2, x, 0.9, z, 0, rotY, 0);
  batcher.addBox('gunmetal_concrete', 4.8, 3.4, 15.8, x, 3.0, z, 0, rotY, 0);
  batcher.addBox('bope_black', 4.95, 0.9, 16.0, x, 2.3, z, 0, rotY, 0);
  batcher.addBox('alert_yellow', 5.0, 0.35, 16.1, x, 1.8, z, 0, rotY, 0);

  batcher.addBox('smoked_glass', 4.2, 1.2, 1.2, x, 3.3, z + 7.5, 0, rotY, 0);
  batcher.addBox('brushed_silver', 4.9, 0.95, 11.5, x, 3.55, z - 0.8, 0, rotY, 0);
  batcher.addBox('siren_red', 1.4, 0.45, 0.8, x - 1.1, 4.9, z + 5.5, 0, rotY, 0);
  batcher.addBox('siren_blue', 1.4, 0.45, 0.8, x + 1.1, 4.9, z + 5.5, 0, rotY, 0);

  world.addCollider(x, z, 5.0, 16.4, 5.0, 0.28);
}
