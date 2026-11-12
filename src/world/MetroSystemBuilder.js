// Ponto de entrada do Metrô LEGO. O código fica separado em `src/world/metro/`:
//   MetroRouteData.js           — estações, pontos da rota e recortes no piso
//   MetroSpline.js              — curva fechada do anel
//   MetroVerticalProfile.js     — altura da linha elevada (vão livre mínimo sobre a rua)
//   MetroTrackWalkway.js        — piso andável e muretas com colisão no trilho elevado
//   MetroBatcher.js             — merge de geometrias estáticas
//   MetroStationProps.js        — placas, catracas, máquinas de bilhete e totens
//   MetroUndergroundStations.js — estações subterrâneas e túnel
//   MetroElevatedStations.js    — estações elevadas
//   MetroTrackAndViaduct.js     — trilhos, rampas, estrutura elevada e pilares
//   MetroSupportPlanner.js      — onde ficam os pilares (pórticos nas calçadas, nunca na pista)
//   MetroTrainMesh.js           — modelo 3D dos vagões
//   MetroRuntime.js             — movimento dos trens
//   MetroBoarding.js            — interação do jogador com os vagões
import { METRO_STATIONS } from './metro/MetroRouteData.js';
import { buildClosedMetroLoopSpline } from './metro/MetroSpline.js';
import { createMetroBatcher } from './metro/MetroBatcher.js';
import { buildInteractiveMetroMapTotem } from './metro/MetroStationProps.js';
import { buildUndergroundStationsAndTunnel } from './metro/MetroUndergroundStations.js';
import { buildThreeElevatedMetroStations } from './metro/MetroElevatedStations.js';
import {
  buildTrackBedAndElevatedManhattanStructure,
  buildElevatedSupports
} from './metro/MetroTrackAndViaduct.js';
import { MetroSystemRuntime } from './metro/MetroRuntime.js';
import { buildTrackWalkway } from './metro/MetroTrackWalkway.js';

export {
  METRO_ISLAND_CUTOUTS,
  METRO_STATIONS,
  METRO_LOOP_WAYPOINTS,
  sliceRectAroundCutouts,
  getMetroCutoutFloorY
} from './metro/MetroRouteData.js';
export { MetroSystemRuntime } from './metro/MetroRuntime.js';

// ============================================================================
// 8. ENTRYPOINT PRINCIPAL EXPORTADO PARA `TestBlockWorld.js`
// ============================================================================
export function buildMetroSystem(world) {
  if (!world.elevatedDecks) world.elevatedDecks = [];
  if (!world.undergroundFloors) world.undergroundFloors = [];

  const batcher = createMetroBatcher();
  const spline = buildClosedMetroLoopSpline(world);

  buildUndergroundStationsAndTunnel(world, batcher);
  buildTrackBedAndElevatedManhattanStructure(world, batcher, spline);
  buildThreeElevatedMetroStations(world, batcher);
  buildElevatedSupports(world, batcher, spline);
  buildTrackWalkway(world, spline);

  const totems = [];
  for (let i = 0; i < METRO_STATIONS.length; i++) {
    totems.push(buildInteractiveMetroMapTotem(world, i));
  }
  world.metroTotems = totems;

  batcher.flush(world.scene);

  world.metroSystem = new MetroSystemRuntime(world, spline, totems);
  world.metroData = {
    stationsCount: METRO_STATIONS.length,
    undergroundStationsCount: 2,
    elevatedStationsCount: 3,
    trainsCount: 2,
    carsPerTrain: 3,
    loopLengthMeters: Math.round(spline.totalLength)
  };
}
