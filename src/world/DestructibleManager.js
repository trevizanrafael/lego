import { disposeTransientObject3D } from '../materials/LegoMaterials.js';
import {
  DESTRUCTIBLE_REGISTRY_AND_CULLING_METHODS
} from './destructibles/DestructibleRegistryAndCulling.js';
import {
  DAMAGE_AND_CHAIN_EXPLOSION_METHODS
} from './destructibles/DamageAndChainExplosionSystem.js';
import {
  STUD_TIERS,
  DEBRIS_AND_STUD_MAGNET_METHODS
} from './destructibles/DebrisAndStudMagnetPhysics.js';
import {
  PROJECTILES_AND_BALLISTICS_METHODS
} from './destructibles/ProjectilesAndBallisticsPool.js';
import {
  BALLISTICS_SIMULATION_UPDATE_METHODS
} from './destructibles/BallisticsSimulationUpdate.js';
import {
  HERO_POWER_VFX_AND_BEAMS_METHODS
} from './destructibles/HeroPowerVfxAndBeams.js';
import {
  HEAVY_AND_STEALTH_HERO_VFX_METHODS
} from './destructibles/HeavyAndStealthHeroVfx.js';
import {
  TURBO_GHOST_HERO_VFX_METHODS
} from './destructibles/TurboGhostHeroVfx.js';
import {
  VOLTAICO_STORM_HERO_VFX_METHODS
} from './destructibles/VoltaicoStormHeroVfx.js';
import {
  VORTEX_SYMBIOTE_HERO_VFX_METHODS
} from './destructibles/VortexSymbioteHeroVfx.js';
import {
  VEHICLE_WRECK_AND_FIRE_METHODS
} from './destructibles/VehicleWreckAndFire.js';

export { STUD_TIERS };

function installNonEnumerablePrototypeMethods(targetPrototype, methodMaps) {
  for (const methodMap of methodMaps) {
    const descriptors = {};
    for (const key of Object.keys(methodMap)) {
      descriptors[key] = {
        value: methodMap[key],
        writable: true,
        enumerable: false,
        configurable: true
      };
    }
    Object.defineProperties(targetPrototype, descriptors);
  }
}

/**
 * Fachada principal do sistema de objetos destrutíveis, física de estilhaços/studs,
 * balística, ondas de choque, reações em cadeia e VFX 3D dos poderes dos heróis.
 * Submódulos coesos em `src/world/destructibles/*`.
 */
export class DestructibleManager {
  constructor(scene, hud) {
    this.scene = scene;
    this.hud = hud;

    this.objects = [];
    this._spatialGrid = new Map();
    this._dynamicObjects = [];
    this.spatialCellSize = 36;
    this._nearbyQueryScratch = [];
    this._cullTickAccumulator = 0;
    this._cullSliceCursor = 0;

    this.debrisList = [];
    this.studsList = [];
    this.ambientStuds = [];
    this._ambientStudPools = new Map();
    this._flushStreetPropInstancedBatches = null;
    this.geysers = [];
    this.topplingPoles = [];
    this.projectiles = [];
    this.grenades = [];
    this.thrownCars = [];
    this.explosions = [];
    this.fxParticles = [];
    this._fxPool = [];
    this.lightWallSegments = [];
    this.timedBeams = [];
    this._crashingHelis = [];
    this._playerKnockoutRecoverTimer = 0;
    this._turboGhostBikeObj = null;
    this._vortexComboStep = 0;

    this.onObjectDamaged = null;
    this.onObjectDestroyed = null;

    this.magnetRadius = 5.2;
    this.collectRadius = 0.9;

    this.beamSoundCooldown = 0;
    this._initSolarBeamMesh();
  }

  /**
   * Restaura todos os objetos quebráveis auto-reconstruíveis, studs ambientes e limpa efeitos ativos
   */
  rebuildAll() {
    for (const obj of this.objects) {
      if (obj.destroyed && !obj.noAutoRespawn) {
        this._restoreObject(obj);
      } else if (!obj.destroyed) {
        obj.hp = obj.maxHp;
        obj.heatLevel = 0;
        obj.isBurning = false;
        obj.engineFireTimer = 0;
        obj.damageStage = 'intact';
        obj.driverKilled = false;
      }
    }
    if (Array.isArray(this._crashingHelis)) {
      for (const ch of this._crashingHelis) {
        if (ch.mesh) ch.mesh.parent?.remove(ch.mesh);
      }
      this._crashingHelis.length = 0;
    }
    for (const s of this.ambientStuds) {
      s.collected = false;
      s.magnetized = false;
      s.mesh.visible = true;
      s.mesh.position.copy(s.basePos);
      s._wasInstVisible = true;
      this._writeAmbientStudMatrix(s, false);
    }
    for (const pool of this._ambientStudPools.values()) {
      if (pool.dirty) {
        pool.inst.instanceMatrix.needsUpdate = true;
        pool.dirty = false;
      }
    }
    this._flushStreetPropInstancedBatches?.();
    for (const g of this.geysers) {
      if (g.columnMesh) {
        this.scene.remove(g.columnMesh);
        disposeTransientObject3D(g.columnMesh);
      }
      for (const drop of g.drops) {
        this.scene.remove(drop.mesh);
        disposeTransientObject3D(drop.mesh);
      }
    }
    this.geysers.length = 0;
    for (const tp of this.topplingPoles) {
      this.scene.remove(tp.mesh);
      disposeTransientObject3D(tp.mesh);
    }
    this.topplingPoles.length = 0;
  }

  /**
   * Ciclo principal de simulação por frame (60 FPS):
   * 1. Distance culling fatiado com histerese anti-popping, shake e auto-rebuild (45s)
   * 2. Projéteis balísticos, lâminas de energia, carros arremessados e granadas táticas
   * 3. Ondas de choque/explosões, partículas FX zero-GC, feixes 3D e muralha de luz ciano
   * 4. Estilhaços físicos 3D, coleta magnética de studs e pools InstancedMesh de studs ambientes
   * 5. Gêiseres verticais de hidrantes (8m / 7s) e postes/semáforos tombando com faíscas
   */
  update(dt, playerPosition, cameraForward = null) {
    this._updateCullingShakeAndRespawn(dt, playerPosition, cameraForward);
    this._updateDamagedAndBurningVehicles(dt, playerPosition);
    this._updateCrashingHelicopters(dt);
    this._updateProjectiles(dt);
    this._updateThrownCars(dt);
    this._updateGrenades(dt);
    this._updateExplosions(dt);
    this._updateFxParticlesAndBeams(dt);
    this._updateDebrisAndStuds(dt, playerPosition);
    this._updateGeysersAndTopplingPoles(dt);
  }
}

installNonEnumerablePrototypeMethods(DestructibleManager.prototype, [
  DESTRUCTIBLE_REGISTRY_AND_CULLING_METHODS,
  DAMAGE_AND_CHAIN_EXPLOSION_METHODS,
  VEHICLE_WRECK_AND_FIRE_METHODS,
  DEBRIS_AND_STUD_MAGNET_METHODS,
  PROJECTILES_AND_BALLISTICS_METHODS,
  BALLISTICS_SIMULATION_UPDATE_METHODS,
  HERO_POWER_VFX_AND_BEAMS_METHODS,
  HEAVY_AND_STEALTH_HERO_VFX_METHODS,
  TURBO_GHOST_HERO_VFX_METHODS,
  VOLTAICO_STORM_HERO_VFX_METHODS,
  VORTEX_SYMBIOTE_HERO_VFX_METHODS
]);
