import { buildTerritoryInfrastructureForZone } from '../FactionWarSystem.js';
import { IS_SCALED_WORLD, ws } from '../core/WorldLayoutScale.js';
import { PCCIndustrialBatcher } from './east-port/EastPortBatcherAndMaterials.js';
import { buildEastCanalBridgesAndPCCBarricades } from './east-port/EastCanalAndBridgesBuilder.js';
import {
  buildPCCCentralCitadelAndBunker,
  buildPCCFleetConvoyYard,
  buildPCCChopShopAndScrapyard
} from './east-port/PccCitadelAndYardsBuilder.js';
import { buildAllExpandedPCCIndustrialAndCorporateBlocks } from './east-port/IndustrialDistrictAndPccBuilder.js';
import { buildMetropolitanPortAndDocks } from './east-port/PortAresBaseBuilder.js';
import { buildIndustrialToPortFreightRailSpur } from './east-port/IndustrialRailSpurBuilder.js';

/**
 * 6 & 7. IMPÉRIO INDUSTRIAL & CORPORATIVO BLINDADO 100% DO PCC + PORTO METROPOLITANO
 * Fachada orquestradora da Região Leste / Sudeste (Canal Urbano, Distrito PCC, Porto de Cargas & Base A.R.E.S.).
 */
export function buildEastCanalIndustrialAndPort(world) {
  const batcher = new PCCIndustrialBatcher(world);

  // Metadados Oficiais do Território 100% PCC para inspeção e testes automatizados
  world.industrialPCCData = {
    faction: 'PCC',
    factionName: 'PRIMEIRO COMANDO (PCC)',
    colors: ['matte_black', 'gunmetal_concrete', 'pcc_navy', 'pcc_neon_blue', 'tactical_white', 'brushed_silver'],
    citadelOrigin: { x: ws(866), z: IS_SCALED_WORLD ? ws(-316) : -381 },
    chopShopOrigin: { x: ws(1062), z: IS_SCALED_WORLD ? ws(-316) : -250 },
    convoyYardOrigin: { x: ws(684), z: ws(-316) },
    hasCentralBunker: true,
    citadelHeight: 112,
    skybridgesCount: 0,
    hasUndergroundEscapeRamp: true,
    hasRooftopBlueHelipad: true,
    bunkerWatchtowersCount: 4,
    blocksCount: 0,
    bunkersCount: 0,
    corporateTowersCount: 0,
    c4WarehousesCount: 0,
    siloBatteriesCount: 0,
    coolingTowersCount: 0,
    tallSmokestacksCount: 0,
    industrialCranesCount: 0,
    pccContainerStacksCount: 0,
    horizontalTanksCount: 0,
    stolenGoldPalletsCount: 0,
    silverBriefcaseStacksCount: 0,
    c4CratesCount: 0,
    forkliftsCount: 0,
    boxTrucksCount: 0,
    hasChopShopYard: true,
    hasElectromagneticCrane: true,
    hasHydraulicPress: true,
    hasFleetConvoyYard: true,
    hasFreightRailSpur: false,
    hasCanalServiceRoad: false,
    heavyIndustrialShedsCount: 0,
    totalInfillLotsCount: 0,
    entryBarricadesCount: 0
  };

  // 1. CANAL URBANO LESTE + PONTES BLINDADAS + 5 BARRICADAS TÁTICAS DO PCC NAS ENTRADAS
  buildEastCanalBridgesAndPCCBarricades(world, batcher);

  // Eleva automaticamente colisores do Distrito Industrial Leste conforme a Elevação Industrial (+7.0m)
  const origAddCollider = world.addCollider.bind(world);
  world.addCollider = (cx, cz, cw, cd, maxY = 10, minY = 0) => {
    const tY = batcher._terrainLift(cx, cz);
    if (tY > 0.04) {
      const adjMin = minY <= 0.6 ? minY + tY - 3.5 : minY + tY;
      return origAddCollider(cx, cz, cw, cd, maxY + tY, adjMin);
    }
    return origAddCollider(cx, cz, cw, cd, maxY, minY);
  };

  try {
    // 2. A CIDADELA / TORRE DO BUNKER CENTRAL DO PCC (112m DE ALTURA + PASSARELAS AÉREAS BLINDADAS + RAMPA SUBTERRÂNEA)
    buildPCCCentralCitadelAndBunker(world, batcher);

    // 3. PÁTIO DA FROTA — "O BONDE DO PCC" (DENSO COM 2 GARAGENS BLINDADAS EM L, PILHAS DE CONTÊINERES E COMBOIO!)
    buildPCCFleetConvoyYard(world, batcher);

    // 4. PÁTIO DO DESMANCHE & FERRO-VELHO DO SINDICATO (OFICINAS EM U, CARROS-FORTES ROUBADOS, PRENSA E GUINDASTE)
    buildPCCChopShopAndScrapyard(world, batcher);

    // 5. EXPANSÃO TOTAL DOS QUARTEIRÕES DO PCC (COBRINDO 100% DA REGIÃO LESTE E NORDESTE ATÉ ENCOSTAR NO PORTO!)
    buildAllExpandedPCCIndustrialAndCorporateBlocks(world, batcher);
  } finally {
    world.addCollider = origAddCollider;
  }

  // 6. PORTO DE CARGAS & CAIS MARÍTIMO (CAIS PESADO, LABIRINTO DE CONTÊINERES, PORTAINERS, DOCAS E NAVIOS)
  buildMetropolitanPortAndDocks(world, batcher);

  // 6.5 RAMAL FERROVIÁRIO DE CARGA INDUSTRIAL -> CAIS LESTE DO PORTO (100% BATCHEADO EM VERTEX COLORS)
  buildIndustrialToPortFreightRailSpur(world, batcher);

  // Finaliza toda a malha estática do Império Blindado do PCC + Porto de Cargas em poucos Draw Calls!
  const flushedMeshes = batcher.finalize(world.scene);
  world.industrialPCCData.batchedStaticMeshesCount = flushedMeshes;
  if (world.eastPortData) world.eastPortData.batchedStaticMeshesCount = flushedMeshes;

  // 7. Infraestrutura Oficial dos 2 Territórios Leste/Sudeste: PCC (Industrial/Cidadela) e A.R.E.S. (Porto Blindado)!
  buildTerritoryInfrastructureForZone(world, 'pcc');
  buildTerritoryInfrastructureForZone(world, 'ares');
}
