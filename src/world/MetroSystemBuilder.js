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
import * as THREE from 'three';
import { IS_SCALED_WORLD } from './core/WorldLayoutScale.js';
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

  // Linha e estações para o minimapa e o mapa tático (traçado real, com as alturas finais da linha)
  const tmp = new THREE.Vector3();
  const wpStep = IS_SCALED_WORLD ? 16 : 8;
  world.metroLoopWaypoints = [];
  for (let s = 0; s < spline.totalLength; s += wpStep) {
    spline.sampleAtS(s, tmp);
    world.metroLoopWaypoints.push({ x: tmp.x, y: tmp.y, z: tmp.z });
  }
  world.metroStationMarkers = spline.stationStops.map((st) => ({
    id: st.id,
    code: st.code,
    name: st.shortName,
    kind: st.kind,
    x: st.trackPos.x,
    z: st.trackPos.z,
    entrance: st.streetEntrance ? { x: st.streetEntrance.x, z: st.streetEntrance.z } : null
  }));
  if (IS_SCALED_WORLD && Array.isArray(world.landmarks)) {
    const byCode = new Map(spline.stationStops.map((st) => [st.code, st]));
    world.landmarks = world.landmarks.map((lm) => {
      if (!String(lm.id || '').startsWith('lm_metro_')) return lm;
      const st = byCode.get(lm.code);
      if (!st) return lm;
      return {
        ...lm,
        x: st.x,
        y: st.y,
        z: st.z,
        spawn: {
          x: st.platformSpawn.x,
          y: st.platformSpawn.y + 0.1,
          z: st.platformSpawn.z
        }
      };
    });
  }
  world.metroData = {
    stationsCount: METRO_STATIONS.length,
    undergroundStationsCount: 2,
    elevatedStationsCount: 3,
    trainsCount: 2,
    carsPerTrain: 3,
    loopLengthMeters: Math.round(spline.totalLength)
  };
}
