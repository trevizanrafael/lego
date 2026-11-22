import { IS_SCALED_WORLD, ws } from '../../core/WorldLayoutScale.js';
import {
  buildFortifiedCompoundWalls,
  addGiantSiloBattery,
  addIndustrialCoolingTower,
  addTallIndustrialSmokestack,
  addPCCContainerStack,
  addHorizontalChemicalTank,
  addStaticPCCSuvOrVan,
  addStolenGoldPallet,
  addSilverBriefcaseStack,
  addC4ExplosiveCrateStack,
  addLegoForklift,
  addPCCArmoredBoxTruck
} from './EastPortBatcherAndMaterials.js';

/**
 * 5. EXPANSÃO E ADENSAMENTO COMPLETO DOS QUARTEIRÕES DO PCC (ZERO ESPAÇO CINZA VAZIO!)
 * Preenche TODAS as colunas (X = 612 até X = 1625) e TODAS as linhas (Z = -1248 até encostar no Porto em Z = +110)!
 */
export function buildAllExpandedPCCIndustrialAndCorporateBlocks(world, batcher) {
  const pccGridBlocks = [
    // BORDA EXTREMA NORTE / NORDESTE (Z = -1248, encostando 100% na beira Norte da ilha em Z = -1318!)
    { cx: 684, cz: -1248, w: 144, d: 140, type: 'corporate_tower', h: 72, label: 'TORRE COSTEIRA NORTE PCC' },
    { cx: 866, cz: -1248, w: 172, d: 140, type: 'heavy_silos', h: 64, label: 'REFINARIA MARÍTIMA NORTE' },
    { cx: 1062, cz: -1248, w: 172, d: 140, type: 'c4_factory', h: 50, label: 'COMPLEXO DE ARMAMENTOS NORTE' },
    { cx: 1252, cz: -1248, w: 160, d: 140, type: 'corporate_tower', h: 76, label: 'SEDE FINANCEIRA EXTREMO NORTE' },
    { cx: 1434, cz: -1248, w: 160, d: 140, type: 'heavy_silos', h: 62, label: 'BATERIA DE SILOS DO ATLÂNTICO' },
    { cx: 1580, cz: -1248, w: 96, d: 140, type: 'coastal_fort', h: 58, label: 'FORTALEZA COSTEIRA NORDESTE' },

    // SETOR NORDESTE EXTREMO (Z = -1108 e Z = -976, ao lado leste do Rio Urbano até o mar X = 1620)
    { cx: 684, cz: -1108, w: 144, d: 112, type: 'heavy_silos', h: 56, label: 'REFINARIA NORTE PCC' },
    { cx: 866, cz: -1108, w: 172, d: 112, type: 'corporate_tower', h: 68, label: 'TORRE FINANCEIRA PCC NORTE' },
    { cx: 1062, cz: -1108, w: 172, d: 112, type: 'c4_factory', h: 46, label: 'USINA DE SÍNTESE C4' },
    { cx: 1252, cz: -1108, w: 160, d: 112, type: 'heavy_silos', h: 62, label: 'TERMINAL DE SILOS BLINDADOS' },
    { cx: 1434, cz: -1108, w: 160, d: 112, type: 'c4_factory', h: 48, label: 'TERMOELÉTRICA DO SINDICATO' },
    { cx: 1580, cz: -1108, w: 96, d: 112, type: 'coastal_fort', h: 54, label: 'BASTIÃO COSTEIRO NORTE' },

    { cx: 684, cz: -976, w: 144, d: 112, type: 'corporate_tower', h: 58, label: 'EDIFÍCIO BLINDADO 1533' },
    { cx: 866, cz: -976, w: 172, d: 112, type: 'c4_factory', h: 48, label: 'COMPLEXO QUÍMICO PCC' },
    { cx: 1062, cz: -976, w: 172, d: 112, type: 'corporate_tower', h: 74, label: 'TORRE DE LAVAGEM SINDICATO' },
    { cx: 1252, cz: -976, w: 160, d: 112, type: 'c4_factory', h: 46, label: 'FÁBRICA DE DETONADORES' },
    { cx: 1434, cz: -976, w: 160, d: 112, type: 'heavy_silos', h: 58, label: 'BATERIA DE SILOS LESTE' },
    { cx: 1580, cz: -976, w: 96, d: 112, type: 'coastal_fort', h: 52, label: 'TORRE DE RADAR COSTEIRA' },

    // LINHA NORTE-CENTRAL (Z = -842)
    { cx: 684, cz: -842, w: 144, d: 108, type: 'c4_factory', h: 44, label: 'DEPÓSITO BLINDADO OESTE' },
    { cx: 866, cz: -842, w: 172, d: 108, type: 'heavy_silos', h: 60, label: 'PETROQUÍMICA DO PCC' },
    { cx: 1062, cz: -842, w: 172, d: 108, type: 'c4_factory', h: 48, label: 'FUNDIÇÃO DE BLINDADOS' },
    { cx: 1252, cz: -842, w: 160, d: 108, type: 'corporate_tower', h: 72, label: 'HOLDING INTERNACIONAL PCC' },
    { cx: 1434, cz: -842, w: 160, d: 108, type: 'c4_factory', h: 46, label: 'GALPÃO DE MUNIÇÕES PESADAS' },
    { cx: 1580, cz: -842, w: 96, d: 108, type: 'coastal_fort', h: 56, label: 'FORTE MARÍTIMO PCC' },

    // LINHA INDUSTRIAL ALTA (Z = -710)
    { cx: 684, cz: -710, w: 144, d: 108, type: 'corporate_tower', h: 64, label: 'CENTRO DE DADOS & HACKING' },
    { cx: 866, cz: -710, w: 172, d: 108, type: 'c4_factory', h: 48, label: 'FÁBRICA CENTRAL DE C4' },
    { cx: 1062, cz: -710, w: 172, d: 108, type: 'heavy_silos', h: 58, label: 'REFINARIA DE EXPLOSIVOS' },
    { cx: 1252, cz: -710, w: 160, d: 108, type: 'c4_factory', h: 46, label: 'LOGÍSTICA DE CARROS-FORTES' },
    { cx: 1434, cz: -710, w: 160, d: 108, type: 'corporate_tower', h: 68, label: 'BANCO CLANDESTINO PCC' },
    { cx: 1580, cz: -710, w: 96, d: 108, type: 'coastal_fort', h: 52, label: 'DOCAS DE CONTRABANDO' },

    // LINHA DO ANEL DE COMANDO (Z = -578)
    { cx: 684, cz: -578, w: 144, d: 108, type: 'heavy_silos', h: 54, label: 'RESERVATÓRIO QUÍMICO' },
    { cx: 866, cz: -578, w: 172, d: 108, type: 'corporate_tower', h: 78, label: 'TORRE DE PLANEJAMENTO (PCC)' },
    { cx: 1062, cz: -578, w: 172, d: 108, type: 'c4_factory', h: 48, label: 'ARSENAL DE ASSALTO PESADO' },
    { cx: 1252, cz: -578, w: 160, d: 108, type: 'heavy_silos', h: 60, label: 'USINA DE FORÇA BLINDADA' },
    { cx: 1434, cz: -578, w: 160, d: 108, type: 'c4_factory', h: 46, label: 'CENTRAL DE CONTÊINERES PCC' },
    { cx: 1580, cz: -578, w: 96, d: 108, type: 'coastal_fort', h: 58, label: 'BATERIA ANTIAÉREA LESTE' },

    // LINHA CENTRAL (Z = -446 e Z = -316 — ao redor da Cidadela Central X=866 e do Desmanche X=1062)
    { cx: 684, cz: -446, w: 144, d: 108, type: 'corporate_tower', h: 74, label: 'TORRE OESTE DE LAVAGEM' },
    { cx: 1062, cz: -446, w: 172, d: 108, type: 'corporate_tower', h: 80, label: 'TORRE LESTE DO COFRE (PCC)' },
    { cx: 1252, cz: -446, w: 160, d: 108, type: 'c4_factory', h: 48, label: 'COMPLEXO METALÚRGICO PCC' },
    { cx: 1434, cz: -446, w: 160, d: 108, type: 'heavy_silos', h: 62, label: 'SILOS GIGANTES DO SINDICATO' },
    { cx: 1580, cz: -446, w: 96, d: 108, type: 'coastal_fort', h: 54, label: 'HELIPONTO COSTEIRO PCC' },

    { cx: 1252, cz: -316, w: 160, d: 108, type: 'corporate_tower', h: 70, label: 'TORRE DE COMUNICAÇÕES PCC' },
    { cx: 1434, cz: -316, w: 160, d: 108, type: 'c4_factory', h: 48, label: 'MONTADORA DE BLINDADOS' },
    { cx: 1580, cz: -316, w: 96, d: 108, type: 'coastal_fort', h: 52, label: 'GUARITA MARÍTIMA CENTRAL' },

    // LINHA SUL-CENTRAL (Z = -184 — Coluna 3 já é ocupada pelo Sul do Desmanche X=1062)
    { cx: 684, cz: -184, w: 144, d: 108, type: 'c4_factory', h: 46, label: 'DOCAS DE OURO ROUBADO' },
    { cx: 866, cz: -184, w: 172, d: 108, type: 'heavy_silos', h: 58, label: 'COMPLEXO DE SILOS & VAPOR' },
    { cx: 1252, cz: -184, w: 160, d: 108, type: 'c4_factory', h: 48, label: 'DEPÓSITO DE CARROS-FORTES' },
    { cx: 1434, cz: -184, w: 160, d: 108, type: 'corporate_tower', h: 66, label: 'EDIFÍCIO LOGÍSTICO SUL' },
    { cx: 1580, cz: -184, w: 96, d: 108, type: 'coastal_fort', h: 54, label: 'TORRE DE VIGIA LESTE' },

    // LINHA DE FRONTEIRA COM O PORTO (Z = -58 e Z = +58 — encostando 100% no Porto Metropolitano em Z = +110!)
    { cx: 684, cz: -58, w: 144, d: 96, type: 'corporate_tower', h: 62, label: 'TORRE DO CANAL LESTE' },
    { cx: 866, cz: -58, w: 172, d: 96, type: 'c4_factory', h: 46, label: 'GALPÃO QUEBRA-COFRE SUL' },
    { cx: 1062, cz: -58, w: 172, d: 96, type: 'heavy_silos', h: 56, label: 'TERMINAL DE COMBUSTÍVEL PCC' },
    { cx: 1252, cz: -58, w: 160, d: 96, type: 'corporate_tower', h: 64, label: 'SEDE ADUANEIRA DO PCC' },
    { cx: 1434, cz: -58, w: 160, d: 96, type: 'c4_factory', h: 46, label: 'HANGAR DE CAMINHÕES BAÚ' },
    { cx: 1580, cz: -58, w: 96, d: 96, type: 'coastal_fort', h: 50, label: 'FORTALEZA DO CANAL' },

    { cx: 684, cz: 58, w: 144, d: 96, type: 'c4_factory', h: 44, label: 'ENTREPOSTO PORTUÁRIO PCC' },
    { cx: 866, cz: 58, w: 172, d: 96, type: 'corporate_tower', h: 58, label: 'CONTROLADORIA DO PORTO (PCC)' },
    { cx: 1062, cz: 58, w: 172, d: 96, type: 'c4_factory', h: 46, label: 'TERMINAL DE EXPORTAÇÃO PCC' },
    { cx: 1252, cz: 58, w: 160, d: 96, type: 'heavy_silos', h: 54, label: 'SILOS PORTUÁRIOS BLINDADOS' },
    { cx: 1434, cz: 58, w: 160, d: 96, type: 'c4_factory', h: 46, label: 'DOCAS BLINDADAS LESTE' },
    { cx: 1580, cz: 58, w: 96, d: 96, type: 'coastal_fort', h: 52, label: 'FAROL BLINDADO DO SINDICATO' }
  ];

  pccGridBlocks.forEach((rawBlk, idx) => {
    const blk = IS_SCALED_WORLD
      ? { ...rawBlk, cx: ws(rawBlk.cx), cz: ws(rawBlk.cz) }
      : rawBlk;
    world.industrialPCCData.blocksCount++;
    if (!IS_SCALED_WORLD) {
      world._addCityBlockSidewalk(blk.cx, blk.cz, blk.w, blk.d, 0x1e293b);
    } else if (rawBlk.cz < -1172 || rawBlk.cx > 1524) {
      // Blocos costeiros extremos fora da grade de UrbanSidewalkAndBlockBuilder: laje local 1x interna aos muros
      batcher.addBox('armor_slate', blk.w - 2.4, 0.16, blk.d - 2.4, blk.cx, 0.08, blk.cz);
      world.mapBlocks.push({ x: blk.cx, z: blk.cz, w: blk.w, d: blk.d, color: '#1e293b' });
    }
    buildFortifiedCompoundWalls(world, batcher, blk.cx, blk.cz, blk.w, blk.d, {
      wallH: 5.0,
      gateSouth: true,
      gateWest: idx % 2 === 0,
      gateWidth: Math.min(28, blk.w * 0.32)
    });

    if (blk.type === 'corporate_tower') {
      _PopulatePCCCorporateTowerBlock(world, batcher, blk, idx);
    } else if (blk.type === 'heavy_silos') {
      _PopulatePCCHeavySiloAndCoolingBlock(world, batcher, blk, idx);
    } else if (blk.type === 'coastal_fort') {
      _PopulatePCCCoastalFortressBlock(world, batcher, blk, idx);
    } else {
      _PopulatePCCC4FactoryAndLogisticsBlock(world, batcher, blk, idx);
    }
  });
}

/**
 * TIPO A: QUARTEIRÃO DE PRÉDIOS CORPORATIVOS DE FACHADA / LAVAGEM DE DINHEIRO DO PCC (52m a 80m!)
 */
function _PopulatePCCCorporateTowerBlock(world, batcher, blk, _idx) {
  const { cx, cz, w, d, h, label } = blk;
  const towerX = cx - w * 0.22;
  const towerZ = cz - d * 0.16;
  const towerW = w * 0.42;
  const towerD = d * 0.48;

  // 1) Torre Corporativa Principal (H = 52..80m) em Vidro Preto Espelhado, Aço Preto e Frisos Azul-Neon/Ciano
  batcher.addBox('matte_black', towerW, h, towerD, towerX, 0.28 + h * 0.5, towerZ);
  batcher.addBox('dark_steel', towerW + 0.8, h - 6, towerD - 6, towerX, 0.28 + h * 0.5, towerZ);
  batcher.addBox('dark_steel', towerW - 6, h - 6, towerD + 0.8, towerX, 0.28 + h * 0.5, towerZ);
  for (let fy = 8; fy <= h - 2; fy += 6.5) {
    batcher.addBox('pcc_navy', towerW + 1.4, 1.2, towerD + 1.4, towerX, fy, towerZ);
    if (fy % 13 < 7) {
      batcher.addBox('pcc_neon_blue', towerW + 1.8, 0.38, towerD + 1.8, towerX, fy + 0.7, towerZ);
    }
  }
  batcher.addBox('gunmetal_concrete', towerW * 0.55, 5.5, towerD * 0.55, towerX, 0.28 + h + 2.75, towerZ);
  batcher.addCylinder('brushed_silver', 0.4, 0.7, 14.0, towerX, 0.28 + h + 11.0, towerZ, 8);
  batcher.addBox('pcc_neon_blue', 1.2, 1.2, 1.2, towerX, 0.28 + h + 18.2, towerZ);
  world.addCollider(towerX, towerZ, towerW, towerD, 0.28 + h + 5.5, 0.28);

  // 2) Edifício Anexo de Contabilidade & Cofres (Leste da Quadra, H = 38m)
  const annexX = cx + w * 0.24;
  const annexZ = cz - d * 0.14;
  const annexW = w * 0.36;
  const annexD = d * 0.52;
  const annexH = Math.max(34, h * 0.56);
  batcher.addBox('gunmetal_concrete', annexW, annexH, annexD, annexX, 0.28 + annexH * 0.5, annexZ);
  batcher.addBox('dark_steel', annexW + 0.6, annexH - 6, annexD - 6, annexX, 0.28 + annexH * 0.5, annexZ);
  batcher.addBox('pcc_navy', annexW + 1.2, 2.2, annexD + 1.2, annexX, 0.28 + annexH - 1.5, annexZ);
  batcher.addBox('tactical_white', annexW + 1.4, 0.5, annexD + 1.4, annexX, 0.28 + annexH - 3.2, annexZ);
  world.addCollider(annexX, annexZ, annexW, annexD, 0.28 + annexH, 0.28);

  // Passarela Aérea de Ferro e Tubulações ligando a Torre Principal ao Anexo (em Y = 22m)
  const spanW = (annexX - annexW * 0.5) - (towerX + towerW * 0.5) + 2;
  const midX = (towerX + towerW * 0.5 + (annexX - annexW * 0.5)) * 0.5;
  batcher.addBox('matte_black', spanW, 3.6, 5.2, midX, 22.0, towerZ);
  batcher.addBox('pcc_neon_blue', spanW + 0.4, 0.4, 5.6, midX, 23.9, towerZ);

  // 3) Galpão Lateral de Blindados (Sul-Oeste da Quadra, H = 22m — formando U!)
  const wingX = cx - w * 0.26;
  const wingZ = cz + d * 0.25;
  const wingW = w * 0.34;
  const wingD = d * 0.26;
  batcher.addBox('matte_black', wingW, 22.0, wingD, wingX, 0.28 + 11.0, wingZ);
  batcher.addBox('pcc_navy', wingW + 0.8, 1.8, wingD + 0.8, wingX, 0.28 + 21.0, wingZ);
  world.addCollider(wingX, wingZ, wingW, wingD, 22.5, 0.28);

  world.industrialPCCData.bunkersCount += 3;
  world.industrialPCCData.corporateTowersCount += 2;

  world.mapBuildings.push({
    x: towerX,
    z: towerZ,
    w: towerW,
    d: towerD,
    height: h,
    color: '#1d4ed8',
    label
  });
  world.mapBuildings.push({
    x: annexX,
    z: annexZ,
    w: annexW,
    d: annexD,
    height: annexH,
    color: '#0f172a',
    label: null
  });

  addPCCContainerStack(world, batcher, cx + w * 0.26, cz + d * 0.26, 3, false);
  addPCCArmoredBoxTruck(world, batcher, cx + 4, cz + d * 0.24);
  addStaticPCCSuvOrVan(world, batcher, cx - 8, cz + d * 0.26, true);
  addStolenGoldPallet(world, batcher, midX - 3, cz + 4, false);
  addSilverBriefcaseStack(world, batcher, midX + 3, cz + 4);
  addC4ExplosiveCrateStack(world, batcher, annexX - 8, cz + 6);
  addLegoForklift(world, batcher, cx - 2, cz + 12);
}

/**
 * TIPO B: COMPLEXO INDUSTRIAL DE BATERIAS DE SILOS GIGANTES (54-62m), TORRES DE RESFRIAMENTO & CHAMINÉS DE 82m!
 */
function _PopulatePCCHeavySiloAndCoolingBlock(world, batcher, blk, _idx) {
  const { cx, cz, w, d, h, label } = blk;

  const facX = cx - w * 0.22;
  const facZ = cz - d * 0.14;
  const facW = w * 0.44;
  const facD = d * 0.54;
  const facH = 42.0;
  batcher.addBox('matte_black', facW, facH, facD, facX, 0.28 + facH * 0.5, facZ);
  batcher.addBox('pcc_navy', facW + 1.2, 3.2, facD + 1.2, facX, 0.28 + facH - 2.2, facZ);
  batcher.addBox('pcc_neon_blue', facW + 1.6, 0.5, facD + 1.6, facX, 0.28 + facH - 4.2, facZ);
  for (let t = -1; t <= 1; t++) {
    batcher.addBox('pcc_navy', facW - 2, 4.5, facD * 0.28, facX, 0.28 + facH + 2.0, facZ + t * (facD * 0.31), 0.3, 0, 0);
  }
  world.addCollider(facX, facZ, facW, facD, 0.28 + facH + 4.5, 0.28);

  const siloBaseX = cx + w * 0.22;
  const siloBaseZ = cz - d * 0.22;
  addGiantSiloBattery(world, batcher, siloBaseX, siloBaseZ, 4, h);

  const coolX = cx + w * 0.24;
  const coolZ = cz + d * 0.18;
  addIndustrialCoolingTower(world, batcher, coolX, coolZ, 48);
  addTallIndustrialSmokestack(world, batcher, facX - facW * 0.32, facZ - facD * 0.32, 82);

  batcher.addBox('brushed_silver', w * 0.38, 0.8, 4.2, cx, 26.0, siloBaseZ);
  batcher.addCylinder('brushed_silver', 1.1, 1.1, w * 0.42, cx, 32.0, siloBaseZ + 5, 8, 0, Math.PI / 2);
  batcher.addCylinder('pcc_royal', 0.95, 0.95, w * 0.42, cx, 29.5, siloBaseZ + 5, 8, 0, Math.PI / 2);

  world.industrialPCCData.bunkersCount += 2;
  world.industrialPCCData.c4WarehousesCount++;

  world.mapBuildings.push({
    x: facX,
    z: facZ,
    w: facW,
    d: facD,
    height: facH,
    color: '#1e3a8a',
    label
  });

  addHorizontalChemicalTank(world, batcher, cx - w * 0.24, cz + d * 0.26);
  addHorizontalChemicalTank(world, batcher, cx - w * 0.04, cz + d * 0.26);
  addPCCContainerStack(world, batcher, cx - w * 0.34, cz + d * 0.24, 3, false);
  addPCCArmoredBoxTruck(world, batcher, cx + 6, cz + d * 0.24);
  addStolenGoldPallet(world, batcher, cx - 6, cz + 8, false);
  addC4ExplosiveCrateStack(world, batcher, cx + 4, cz + 8);
  addLegoForklift(world, batcher, cx, cz + 18);
}

/**
 * TIPO C: MEGACOMPLEXO DE FÁBRICAS DE C4, LOGÍSTICA DE ASSALTO, GUINDASTE & CHAMINÉS DE 76m!
 */
function _PopulatePCCC4FactoryAndLogisticsBlock(world, batcher, blk, idx) {
  const { cx, cz, w, d, h, label } = blk;
  const w1X = cx - w * 0.23;
  const w2X = cx + w * 0.23;
  const whZ = cz - d * 0.16;
  const w1W = w * 0.42;
  const w2W = w * 0.38;
  const whD = d * 0.52;
  const w1H = h;
  const w2H = h - 6;

  // 1) Megagalpão Oeste (H = 44..48m) com Telhado Dente-de-Serra e Frisos Azul-Neon
  batcher.addBox('matte_black', w1W, w1H, whD, w1X, 0.28 + w1H * 0.5, whZ);
  batcher.addBox('pcc_navy', w1W + 1.0, 3.0, whD + 1.0, w1X, 0.28 + w1H - 2.4, whZ);
  batcher.addBox('pcc_neon_blue', w1W + 1.4, 0.5, whD + 1.4, w1X, 0.28 + w1H - 4.2, whZ);
  for (let t = -1; t <= 1; t++) {
    batcher.addBox('pcc_navy', w1W - 2, 4.0, whD * 0.28, w1X, 0.28 + w1H + 1.8, whZ + t * (whD * 0.3), 0.32, 0, 0);
  }
  world.addCollider(w1X, whZ, w1W, whD, 0.28 + w1H + 4.0, 0.28);

  // 2) Megagalpão Leste (H = 38..42m) com Telhado Arqueado Blindado
  batcher.addBox('gunmetal_concrete', w2W, w2H, whD, w2X, 0.28 + w2H * 0.5, whZ);
  batcher.addBox('matte_black', w2W + 0.8, 2.6, whD + 0.8, w2X, 0.28 + w2H - 2.2, whZ);
  batcher.addBox('tactical_white', w2W + 1.2, 0.55, whD + 1.2, w2X, 0.28 + w2H - 4.0, whZ);
  batcher.addBox('pcc_navy', w2W * 0.76, 3.4, whD - 2, w2X, 0.28 + w2H + 1.7, whZ);
  world.addCollider(w2X, whZ, w2W, whD, 0.28 + w2H + 3.4, 0.28);

  // 3) Terceiro Edifício / Galpão Transversal no Sul-Leste (H = 28m — fechando o quarteirão em L/U!)
  const w3X = cx + w * 0.25;
  const w3Z = cz + d * 0.25;
  const w3W = w * 0.36;
  const w3D = d * 0.26;
  batcher.addBox('matte_black', w3W, 28.0, w3D, w3X, 0.28 + 14.0, w3Z);
  batcher.addBox('pcc_navy', w3W + 0.8, 2.0, w3D + 0.8, w3X, 0.28 + 26.8, w3Z);
  world.addCollider(w3X, w3Z, w3W, w3D, 28.5, 0.28);

  const stackH = 70 + (idx % 4) * 5;
  addTallIndustrialSmokestack(world, batcher, w2X + w2W * 0.28, whZ - whD * 0.28, stackH);
  addGiantSiloBattery(world, batcher, cx, whZ - whD * 0.35, 3, 46);

  const spanW = (w2X - w2W * 0.5) - (w1X + w1W * 0.5) + 2.0;
  batcher.addBox('brushed_silver', spanW, 0.65, 4.0, cx, 16.0, whZ);
  batcher.addBox('brushed_silver', spanW, 0.65, 4.0, cx, 28.0, whZ + 8);
  batcher.addCylinder('brushed_silver', 0.85, 0.85, spanW + 4, cx, 22.0, whZ - 5, 8, 0, Math.PI / 2);
  batcher.addCylinder('pcc_royal', 0.75, 0.75, spanW + 4, cx, 20.0, whZ - 5, 8, 0, Math.PI / 2);

  world.industrialPCCData.bunkersCount += 3;
  world.industrialPCCData.c4WarehousesCount += 2;

  world.mapBuildings.push({
    x: w1X,
    z: whZ,
    w: w1W,
    d: whD,
    height: w1H,
    color: '#1e3a8a',
    label
  });
  world.mapBuildings.push({
    x: w2X,
    z: whZ,
    w: w2W,
    d: whD,
    height: w2H,
    color: '#0f172a',
    label: null
  });

  const dockZ = cz + d * 0.23;
  addPCCContainerStack(world, batcher, cx - w * 0.32, dockZ, 3, false);
  addHorizontalChemicalTank(world, batcher, cx - w * 0.14, dockZ + 4);
  addStolenGoldPallet(world, batcher, w1X - 4, dockZ - 10, false);
  addStolenGoldPallet(world, batcher, w1X + 3, dockZ - 10, false);
  addSilverBriefcaseStack(world, batcher, w1X + 10, dockZ - 10);
  addC4ExplosiveCrateStack(world, batcher, cx + 4, dockZ - 10);
  addLegoForklift(world, batcher, cx - 2, dockZ - 2);
  addPCCArmoredBoxTruck(world, batcher, cx + 6, dockZ + 2);
  addStaticPCCSuvOrVan(world, batcher, cx - 10, dockZ - 2, idx % 2 === 0);
}

/**
 * TIPO D: BASTIÃO COSTEIRO LESTE DO PCC (X = 1580 — FECHANDO A BORDA LESTE ATÉ O MAR!)
 */
function _PopulatePCCCoastalFortressBlock(world, batcher, blk, idx) {
  const { cx, cz, w, d, h, label } = blk;
  batcher.addBox('matte_black', w * 0.56, h, d * 0.46, cx, 0.28 + h * 0.5, cz - d * 0.16);
  batcher.addBox('dark_steel', w * 0.58, h - 8, d * 0.36, cx, 0.28 + h * 0.5, cz - d * 0.16);
  batcher.addBox('pcc_navy', w * 0.6, 2.8, d * 0.48, cx, 0.28 + h - 2.0, cz - d * 0.16);
  batcher.addBox('pcc_neon_blue', w * 0.62, 0.5, d * 0.5, cx, 0.28 + h - 4.0, cz - d * 0.16);
  world.addCollider(cx, cz - d * 0.16, w * 0.56, d * 0.46, 0.28 + h, 0.28);

  batcher.addBox('gunmetal_concrete', w * 0.62, 32.0, d * 0.28, cx, 0.28 + 16.0, cz + d * 0.22);
  world.addCollider(cx, cz + d * 0.22, w * 0.62, d * 0.28, 32.5, 0.28);

  addTallIndustrialSmokestack(world, batcher, cx + w * 0.26, cz - d * 0.28, 68 + (idx % 3) * 5);
  addPCCContainerStack(world, batcher, cx - w * 0.24, cz + d * 0.22, 3, true);
  addC4ExplosiveCrateStack(world, batcher, cx + 8, cz + 4);

  world.industrialPCCData.bunkersCount += 2;
  world.industrialPCCData.corporateTowersCount++;
  world.mapBuildings.push({
    x: cx,
    z: cz - d * 0.16,
    w: w * 0.56,
    d: d * 0.46,
    height: h,
    color: '#0f172a',
    label
  });
}
