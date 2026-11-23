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
  buildNorthMilitaryBaseWing,
  buildAirportNaturalTurfAndDrainage
} from './west-airport/AirportRunwayAndMilitaryBase.js';

/**
 * 8. REGIÃO OESTE (FACHADA FINA) — AEROPORTO METROPOLITANO & BASE MILITAR TERRESTRE
 * - Sem placas retangulares gigantes de concreto (pátios/tarmac justos sobre terreno natural da Península Oeste)
 * - 1. Rodovia Expressa + Perímetro com Guaritas + Grande Estacionamento com Catracas/Cancelas na entrada
 * - 2. Mega Terminal Internacional LEGO de 960m (100% Entrável e com Interior Decorado)
 * - 3. Quarteirões das Pistas Menores (Taxiways) com 16 Galpões/Hangares Civis e Militares
 * - 4. 3 Torres de Controle Gigantes (124m) + Pista Principal Runway 09/27 com acostamentos e blast pads
 * - 5. Ala Militar Norte da Base (Quartel, Pátio de Tanques, Baterias SAM e Helipontos) + Gramado/Drenagem
 */
export function buildWestHighwayAndAirport(world) {
  const groundY = 0.28;
  const batcher = createWestBatcher();

  // 1. Rodovia Expressa + Perímetro de Segurança + Pátio Frontal & Estacionamento justo
  buildExpresswaySecurityAndParkingLot(world, batcher, groundY);

  // 2. Mega Terminal Internacional LEGO de 960m (100% Entrável e com Interior Decorado)
  buildColossalEnterableAirportTerminal(world, batcher, groundY);

  // 3. Quarteirões das Pistas Menores (Taxiways) e Pátios Justos dos 16 Hangares Civis/Militares
  buildTaxiwayBlocksAnd16RowHangars(world, batcher, groundY);

  // 4A & 4B. 3 Torres de Controle Gigantes (124m) + Runway 09/27 com Blast Pads e Acostamentos
  buildThreeRunwayAtcTowers(world, batcher, groundY);
  const runwayLength = buildMainRunway0927(world, batcher, groundY);

  // 5. Ala Militar Norte da Base + Gramados Aeronáuticos, Valas de Drenagem e Costão Natural
  buildNorthMilitaryBaseWing(world, batcher, groundY);
  buildAirportNaturalTurfAndDrainage(world, batcher, groundY);

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
