import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { IS_SCALED_WORLD, ws, wsP } from '../core/WorldLayoutScale.js';
import {
  createWestBatcher,
  buildExpresswaySecurityAndParkingLot,
  buildColossalEnterableAirportTerminal,
  buildThreeRunwayAtcTowers
} from './west-airport/AirportTerminalAndParking.js';
import {
  buildTaxiwayBlocksAnd16RowHangars,
  buildMainRunway0927,
  buildNorthMilitaryBaseWing
} from './west-airport/AirportRunwayAndMilitaryBase.js';

/**
 * 8. REGIÃO OESTE (FACHADA FINA) — AEROPORTO METROPOLITANO & BASE MILITAR TERRESTRE
 * - 1. Rodovia Expressa + Perímetro com Guaritas + Grande Estacionamento com Catracas/Cancelas na entrada
 * - 2. Mega Terminal Internacional LEGO de 960m (100% Entrável e com Interior Decorado)
 * - 3. Quarteirões das Pistas Menores (Taxiways) com 16 Galpões/Hangares Civis e Militares
 * - 4. 3 Torres de Controle Gigantes (124m) + Pista Principal Runway 09/27 iluminada
 * - 5. Ala Militar Norte da Base (Quartel, Pátio de Tanques, Baterias SAM e Helipontos)
 */
export function buildWestHighwayAndAirport(world) {
  const groundY = 0.28;

  // Grande Plataforma Continental de Concreto Aeronáutico do Complexo Oeste (X = ws(-1015)..ws(-1825), Z = ws(-660)..ws(+660))
  world._addCityBlockSidewalk(ws(-1420), 0, ws(810), ws(1320), LEGO_COLORS.concrete);
  // Expansão Noroeste: Ala Militar Norte da Base (X = ws(-1015)..ws(-1825), Z = ws(-1320)..ws(-660))
  world._addCityBlockSidewalk(ws(-1420), ws(-990), ws(810), ws(660), LEGO_COLORS.concrete);

  const batcher = createWestBatcher();

  // 1. Rodovia Expressa + Perímetro de Segurança + Grande Estacionamento com Catracas/Cancelas na entrada
  buildExpresswaySecurityAndParkingLot(world, batcher, groundY);

  // 2. Mega Terminal Internacional LEGO de 960m (100% Entrável e com Interior Decorado!)
  buildColossalEnterableAirportTerminal(world, batcher, groundY);

  // 3. Quarteirões das Pistas Menores (Taxiways) lotados com 16 Galpões/Hangares Verdes e Azuis Enfileirados
  buildTaxiwayBlocksAnd16RowHangars(world, batcher, groundY);

  // 4A & 4B. 3 Torres de Controle Gigantes (124m) Rentes à Pista Principal + Runway 09/27 Iluminada
  buildThreeRunwayAtcTowers(world, batcher, groundY);
  const runwayLength = buildMainRunway0927(world, batcher, groundY);

  // 5. ALA MILITAR NORTE DA BASE (Canto Noroeste: Quartel Militar, Pátio de Tanques, 4 Baterias Antiaéreas, Helipontos e Hangares Extras!)
  buildNorthMilitaryBaseWing(world, batcher, groundY);

  batcher.flush(world.scene);

  world.westAirportData = {
    terminalLength: 960,
    terminalEnterable: true,
    terminalCenter: wsP(-1145, 0),
    parkingLotWithTurnstiles: true,
    parkingCenter: IS_SCALED_WORLD ? { x: ws(-1145) + 127, z: 0 } : { x: -1064, z: 0 },
    atcTowersCount: 3,
    atcTowerHeight: 124,
    atcTowerPositions: [-360, 0, 360].map((dz) => wsP(-1582, dz)),
    runwayLength,
    runwayWidth: 96,
    runwayCenter: wsP(-1660, 0),
    openHangarsCount: 16,
    hangarColsX: [-1298, -1462].map(ws),
    hangarRowsZ: [-475, -365, -195, -85, 85, 195, 365, 475].map(ws),
    extraNorthMilitaryHangarsCount: 4,
    hasNorthMilitaryWing: true,
    hasMilitaryBarracks: true,
    barracksCenter: wsP(-1115, -990),
    hasTankYard: true,
    tankYardCenter: wsP(-1380, -1135),
    antiAirBatteriesCount: 4,
    militaryHelipadsCount: 2,
    northHelipadPositions: [-1160, -860].map((dz) => wsP(-1605, dz)),
    fighterJetsCount: 8,
    attackHelicoptersCount: 6,
    explosiveFuelTrucksCount: 4,
    militaryCratesCount: 16
  };
}
