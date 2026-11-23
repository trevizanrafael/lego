import { getHighwayDistanceAt } from '../../CoastlineProfile.js';
import { IS_SCALED_WORLD } from '../../core/WorldLayoutScale.js';
import {
  getFavelaEastBorderX,
  getFavelaElevation,
  WINDING_LADEIRAS,
  getLadeiraZAtX
} from './FavelaElevationAndBatcher.js';
import { buildAuthenticFavelaParcel } from './FavelaHouseModules.js';
import { buildOrganicFavelaParcelFabric } from './FavelaParcelFiller.js';

export function createFavelaHouse(world, batcher, x, z, w, d, floors, seed, rotY = 0) {
  return buildAuthenticFavelaParcel(world, batcher, {
    cx: x,
    cz: z,
    w,
    d,
    floors,
    rotY,
    seed,
    alleySign: 1,
    spotKind: 'house',
    yardSideW: 0
  });
}

/**
 * Orquestrador de Barracos e Sobrados da Cidade de Deus:
 * - Em escala padrão `3x` (`IS_SCALED_WORLD`): delega 100% para o tecido orgânico em curvas de nível
 *   (`buildOrganicFavelaParcelFabric`), eliminando qualquer grade paralela `designStripX`.
 * - Em modo debug legado `1x` (`?worldScale=1`): mantém fallback compacto sobre a encosta `1x`.
 */
export function buildGluedFavelaHouseClusters(world, batcher) {
  if (IS_SCALED_WORLD) {
    buildOrganicFavelaParcelFabric(world, batcher);
    return;
  }

  let seed = 1;
  const isOnRoadOrLandmark1x = (x, z) => {
    if (x >= -642 && x <= -568 && z >= 152 && z <= 238) return true;
    if (x >= -752 && x <= -678 && z >= -174 && z <= -96) return true;
    if (x >= -902 && x <= -828 && z >= -305 && z <= -195) return true;
    for (const ladeira of WINDING_LADEIRAS) {
      if (Math.abs(z - getLadeiraZAtX(ladeira, x)) < 7.2) return true;
    }
    for (const baseX of [-595, -695, -805]) {
      const vx = baseX + Math.sin(z * 0.018) * 14 + Math.cos(z * 0.009) * 8;
      if (Math.abs(x - vx) < 5.8) return true;
    }
    if (z < -1300 && getHighwayDistanceAt(x, z) < 28) return true;
    return false;
  };

  for (let stripX = -552; stripX >= -984; stripX -= 24.5) {
    let curZ = -1760;
    while (curZ < 640) {
      const xWave = stripX + Math.sin(curZ * 0.025 + stripX * 0.01) * 6.5;
      if (xWave > getFavelaEastBorderX(curZ) - 14 || getFavelaElevation(xWave, curZ) < 0.45 || isOnRoadOrLandmark1x(xWave, curZ)) {
        curZ += 8.5;
        continue;
      }

      seed++;
      const rotY = -Math.PI * 0.5 + Math.cos(curZ * 0.025 + stripX * 0.01) * 0.22 + ((seed % 5) - 2) * 0.05;
      const w = 5.8 + (seed % 3) * 0.8;
      const d = 6.8 + ((seed + 1) % 3) * 0.9;
      const floors = 1 + (seed % 4);
      createFavelaHouse(world, batcher, xWave, curZ, w, d, floors, seed, rotY);
      if (seed % 3 === 0) world.favelaCDDData.clustersCount++;
      curZ += w + (seed % 3 === 0 ? 3.6 : 0.8);
    }
  }
}
