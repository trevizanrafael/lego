import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
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

  // Grande Plataforma Continental de Concreto Aeronáutico do Complexo Oeste (X = -1015 a -1825, Z = -660 a +660)
  world._addCityBlockSidewalk(-1420, 0, 810, 1320, LEGO_COLORS.concrete);
  // Expansão Noroeste: Ala Militar Norte da Base (X = -1015 a -1825, Z = -1320 a -660 — encostando 100% na borda Norte da ilha!)
  world._addCityBlockSidewalk(-1420, -990, 810, 660, LEGO_COLORS.concrete);

  const batcher = createWestBatcher();

  // 1. Rodovia Expressa + Perímetro de Segurança + Grande Estacionamento com Catracas/Cancelas na entrada
  buildExpresswaySecurityAndParkingLot(world, batcher, groundY);

  // 2. Mega Terminal Internacional LEGO de 960m (100% Entrável e com Interior Decorado!)
  buildColossalEnterableAirportTerminal(world, batcher, groundY);

  // 3. Quarteirões das Pistas Menores (Taxiways) lotados com 16 Galpões/Hangares Verdes e Azuis Enfileirados
  buildTaxiwayBlocksAnd16RowHangars(world, batcher, groundY);

  // 4A & 4B. 3 Torres de Controle Gigantes (124m) Rentes à Pista Principal + Runway 09/27 Iluminada
  buildThreeRunwayAtcTowers(world, batcher, groundY);
  buildMainRunway0927(world, batcher, groundY);

  // 5. ALA MILITAR NORTE DA BASE (Canto Noroeste: Quartel Militar, Pátio de Tanques, 4 Baterias Antiaéreas, Helipontos e Hangares Extras!)
  buildNorthMilitaryBaseWing(world, batcher, groundY);

  batcher.flush(world.scene);

  world.westAirportData = {
    terminalLength: 960,
    terminalEnterable: true,
    parkingLotWithTurnstiles: true,
    atcTowersCount: 3,
    atcTowerHeight: 124,
    runwayLength: 1220,
    runwayWidth: 96,
    openHangarsCount: 16,
    extraNorthMilitaryHangarsCount: 4,
    hasNorthMilitaryWing: true,
    hasMilitaryBarracks: true,
    hasTankYard: true,
    antiAirBatteriesCount: 4,
    militaryHelipadsCount: 2,
    fighterJetsCount: 8,
    attackHelicoptersCount: 6,
    explosiveFuelTrucksCount: 4,
    militaryCratesCount: 16
  };
}
