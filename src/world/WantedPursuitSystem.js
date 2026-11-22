import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';
import {
  WANTED_STAR_THRESHOLDS,
  WANTED_TIER_INFO,
  policePursuitAssetMethods
} from './police/PolicePursuitAssets.js';
import {
  wantedEscalationAndEscapeMethods,
  tickPursuitRegeneration,
  tickPursuitEscapeAndHud
} from './police/WantedEscalationAndEscapeRules.js';
import {
  policeVehiclePursuitMethods,
  tickPursuitSpawnsAndSirens
} from './police/PoliceVehiclePursuitAI.js';
import { policeRoadblockMethods } from './police/PoliceRoadblocks.js';
import { policeHelicopterAndTacticalMethods } from './police/PoliceHelicopterAndTacticalUnits.js';

export { WANTED_STAR_THRESHOLDS, WANTED_TIER_INFO };

function installPrototypeMethods(targetPrototype, ...methodMaps) {
  for (const map of methodMaps) {
    const descriptors = Object.getOwnPropertyDescriptors(map);
    for (const key of Reflect.ownKeys(descriptors)) {
      descriptors[key].enumerable = false;
    }
    Object.defineProperties(targetPrototype, descriptors);
  }
}

// ============================================================================
// FACHADA PRINCIPAL: SISTEMA DE PROCURADO ESCALÁVEL (0 A 5 ESTRELAS) + FUGA
// ============================================================================
export class WantedPursuitSystem {
  constructor(livingCity) {
    this.livingCity = livingCity;
    this.world = livingCity.world;
    this.scene = livingCity.scene;
    this.destructibles = livingCity.destructibles;
    this.hud = livingCity.hud;

    this.stars = 0;
    this.chaosScore = 0;
    this._hasLineOfSight = false;
    this.isEscaping = false;
    this.escapeTimer = 0;
    this.escapeDuration = 18.0;

    // Vida e Regeneração Tática na Perseguição (6s sem tomar tiro regenera os 4 Corações)
    this.timeSinceLastDamage = 99.0;
    this.playerHitIFrameTimer = 0;

    // Forças Policiais & Anti-Herói Ativas
    this.pursuitState = 'CLEAN';
    this._usedDisguiseThisPursuit = false;
    this.pursuitVehicles = [];
    this.footUnits = [];
    this.roadblocks = [];
    this.policeHelicopters = [];
    this.eagleHeli = null;
    this.eagleHeliRespawnCooldown = 0;
    this.hunterDrones = [];
    this.enemyProjectiles = [];
    this.energyCageMesh = null;

    // Timers e vetores cinemáticos internos (60 FPS cravados)
    this._spawnTickTimer = 0.6;
    this._pursuitEngageGraceTimer = 0;
    this._consecutivePropsDestroyed = 0;
    this._propComboResetTimer = 0;
    this._roadblockCooldown = 8.0;
    this._sirenPulseTimer = 0;
    this._strobeClock = 0;
    this._lastPlayerPos = new THREE.Vector3();
    this._lastKnownPlayerPos = new THREE.Vector3();
    this._playerVelDir = new THREE.Vector3(0, 0, 1);
    this._playerVelVec = new THREE.Vector3();
    this._camRightScratch = new THREE.Vector3(1, 0, 0);
    this._pursuitAudioRunning = false;

    this._initSharedMaterials();
    this._bindDestructibleChaosHooks();
  }

  update(dt, playerPos, controller = null) {
    if (!playerPos) return;

    const moveDx = playerPos.x - this._lastPlayerPos.x;
    const moveDz = playerPos.z - this._lastPlayerPos.z;
    const moveLen = Math.hypot(moveDx, moveDz);
    if (moveLen > 0.08) {
      this._playerVelDir.set(moveDx / moveLen, 0, moveDz / moveLen);
    } else if (controller && typeof controller.vehicleHeading === 'number' && controller.currentVehicle) {
      this._playerVelDir.set(Math.sin(controller.vehicleHeading), 0, Math.cos(controller.vehicleHeading));
    }
    this._lastPlayerPos.copy(playerPos);

    if (this.playerHitIFrameTimer > 0) {
      this.playerHitIFrameTimer = Math.max(0, this.playerHitIFrameTimer - dt);
    }
    if (this.eagleHeliRespawnCooldown > 0) {
      this.eagleHeliRespawnCooldown = Math.max(0, this.eagleHeliRespawnCooldown - dt);
    }
    if (this._pursuitEngageGraceTimer > 0) {
      this._pursuitEngageGraceTimer = Math.max(0, this._pursuitEngageGraceTimer - dt);
    }
    if (this._propComboResetTimer > 0) {
      this._propComboResetTimer = Math.max(0, this._propComboResetTimer - dt);
      if (this._propComboResetTimer <= 0) {
        this._consecutivePropsDestroyed = 0;
      }
    }

    if (this.energyCageMesh && this.energyCageMesh.visible) {
      if ((controller?.energyNetSlowTimer || 0) > 0) {
        this.energyCageMesh.position.set(playerPos.x, playerPos.y + 1.15, playerPos.z);
        this.energyCageMesh.rotation.y += dt * 4.5;
        this.energyCageMesh.rotation.x += dt * 2.8;
      } else {
        this.energyCageMesh.visible = false;
      }
    }

    if (this.stars === 0) {
      if (this._pursuitAudioRunning) {
        soundFX.stopPursuitAudio?.();
        this._pursuitAudioRunning = false;
      }
      if (this.chaosScore > 0) {
        this.chaosScore = Math.max(0, this.chaosScore - dt * 14.0);
      }
      if (this.pursuitVehicles.length > 0) {
        this._updatePursuitVehicles(dt, playerPos, controller);
      }
      return;
    }

    tickPursuitRegeneration(this, dt);
    tickPursuitSpawnsAndSirens(this, dt, playerPos, moveLen);

    this._updatePursuitVehicles(dt, playerPos, controller);
    this._updateFootUnits(dt, playerPos, controller);
    this._updateEagleHelicopter(dt, playerPos, controller);
    this._updateHunterDrones(dt, playerPos, controller);
    this._updateRoadblocks(dt, playerPos, controller);
    this._updateEnemyProjectiles(dt, playerPos, controller);

    const escapedNow = tickPursuitEscapeAndHud(this, dt, playerPos, controller);
    if (!escapedNow && this.stars > 0) {
      const invDt = dt > 0.0001 ? 1 / dt : 0;
      this._playerVelVec.set(moveDx * invDt, 0, moveDz * invDt);
      const yaw = Number(controller?.yaw) || 0;
      this._camRightScratch.set(Math.cos(yaw), 0, -Math.sin(yaw));
      this._pursuitAudioRunning = true;
      soundFX.updatePursuitAudio?.({
        dt,
        active: true,
        stars: this.stars,
        isSearching: Boolean(this.isEscaping),
        inTunnel: this._isPlayerInUndergroundTunnel(playerPos),
        playerPos,
        playerVel: this._playerVelVec,
        cameraRight: this._camRightScratch,
        vehicles: this.pursuitVehicles,
        helicopters:
          this.policeHelicopters.length > 0
            ? this.policeHelicopters
            : (this.eagleHeli ? [this.eagleHeli] : [])
      });
    }
  }
}

installPrototypeMethods(
  WantedPursuitSystem.prototype,
  policePursuitAssetMethods,
  wantedEscalationAndEscapeMethods,
  policeVehiclePursuitMethods,
  policeRoadblockMethods,
  policeHelicopterAndTacticalMethods
);
