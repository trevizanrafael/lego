import {
  tickDispatchAndSirens,
  policeDispatchMethods
} from './PoliceDispatchDirector.js';
import { policeCarDriverMethods } from './PoliceCarDriver.js';

/**
 * PoliceVehiclePursuitAI.js
 * Fachada fina de orquestração das forças policiais terrestres:
 * - Despacho por estrelas, spawn >= 120m fora do frustum, despawn > 250m e Tanques 5★ (`PoliceDispatchDirector.js`)
 * - Navegação A* pelas avenidas, frenagem em curva, PIT, Box-In, parada lateral a 15–20m e canhão (`PoliceCarDriver.js`)
 * - Delegação desacoplada de bloqueios policiais 3★+ (`*Impl`) para `PoliceRoadblocks.js`.
 */

export function tickPursuitSpawnsAndSirens(sys, dt, playerPos, moveLen) {
  return tickDispatchAndSirens(sys, dt, playerPos, moveLen);
}

export const policeVehiclePursuitMethods = {
  ...policeDispatchMethods,
  ...policeCarDriverMethods,

  _trySpawnRoadblockAhead(playerPos) {
    if (typeof this._trySpawnRoadblockAheadImpl === 'function') {
      return this._trySpawnRoadblockAheadImpl(playerPos);
    }
    return false;
  },

  _updateRoadblocks(dt, playerPos, controller) {
    if (typeof this._updateRoadblocksImpl === 'function') {
      return this._updateRoadblocksImpl(dt, playerPos, controller);
    }
  },

  _clearRoadblock(rb) {
    if (typeof this._clearRoadblockImpl === 'function') {
      return this._clearRoadblockImpl(rb);
    }
    if (!rb) return;
    if (rb.rampMesh) this.scene?.remove?.(rb.rampMesh);
    if (Array.isArray(rb.props)) {
      for (let i = 0; i < rb.props.length; i++) {
        this.destructibles?.unregisterDestructible?.(rb.props[i]);
      }
    }
  },

  _clearAllRoadblocks() {
    if (typeof this._clearAllRoadblocksImpl === 'function') {
      return this._clearAllRoadblocksImpl();
    }
    if (!Array.isArray(this.roadblocks)) return;
    for (let i = 0; i < this.roadblocks.length; i++) {
      this._clearRoadblock(this.roadblocks[i]);
    }
    this.roadblocks.length = 0;
  }
};
