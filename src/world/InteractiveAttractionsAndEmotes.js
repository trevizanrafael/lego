/**
 * ============================================================================
 * FACHADA DE EMOTES DE HERÓIS [B] E ATRAÇÕES INTERATIVAS (BAILE CDD & MEGA PÍER)
 * ============================================================================
 * Orquestra as animações de dança/emote e as grandes atrações interativas em
 * tempo real (60 FPS) através dos submódulos especializados em `./attractions/`:
 *   - `EmoteDanceAnimations.js`: catálogo `HERO_EMOTES`, coreografias procedurais
 *     do jogador (`applyEmoteAnimationToMinifigure`) e poses de dança dos NPCs/DJ.
 *   - `FavelaBaileCrowdSystem.js`: Paredão pulsante, DJ LEGO, áudio espacial e os
 *     64 NPCs articulados Dual-LOD dançando no Baile da CDD (sem frustum culling
 *     na origem) com reação em tempo real ao emote `[B]`.
 *   - `PierAmusementParkRides.js`: brinquedos embarcáveis `[E]` do Mega Píer Sul
 *     (Montanha-Russa Oceânica 38m, Roda-Gigante Colossal 73m com cabines niveladas
 *     e Big Drop Tower 58m), física de percurso, assentos e câmeras.
 * ============================================================================
 */
import * as THREE from 'three';
import { IS_SCALED_WORLD, ws } from './core/WorldLayoutScale.js';
import {
  HERO_EMOTES,
  applyEmoteAnimationToMinifigure
} from './attractions/EmoteDanceAnimations.js';
import {
  initBaileFunkStageAndCrowd,
  updateBaileCrowdTransforms,
  updateBaileFunkStageAndCrowd
} from './attractions/FavelaBaileCrowdSystem.js';
import {
  initOceanRollerCoaster,
  getCoasterBankAt,
  updateCoasterTrainTransforms,
  initFerrisWheelLevelingAndPlatform,
  initBigDropTowerGondola,
  findNearbyPierAttraction,
  getLowestFerrisCabinIndex,
  getPierRideSeatTransform,
  updatePierAmusementParkRides
} from './attractions/PierAmusementParkRides.js';

export { HERO_EMOTES, applyEmoteAnimationToMinifigure };

export class InteractiveAttractionsManager {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.time = 0;

    // 1. Baile Funk da CDD (X = -715, Z = -135 em 1x; wsP(-715, -135) em 3x, altura Y 1x!)
    const baileData = world.favelaBaileData;
    const initBaileX = baileData?.cx ?? world.favelaBaileCenter?.x ?? (IS_SCALED_WORLD ? ws(-715) : -715);
    const initBaileY = baileData?.yBase ?? world.favelaBaileCenter?.y ?? 25.0;
    const initBaileZ = baileData?.cz ?? world.favelaBaileCenter?.z ?? (IS_SCALED_WORLD ? ws(-135) : -135);
    this.baileCenter = new THREE.Vector3(initBaileX, initBaileY, initBaileZ);
    this.baileWoofers = [];
    this.baileEqBars = [];
    this.baileLaserPivots = [];
    this.djRig = null;
    this.baileCrowd = null;

    // 2. Atrações Embarcáveis do Mega Píer (Montanha-Russa, Roda-Gigante 73m e Big Drop 58m)
    const pzOff = world.pierOffsetZ || 0;
    this.coasterCurve = null;
    this.coasterCars = [];
    this.coasterU = 0.042; // Começa na plataforma de embarque!
    this.coasterStopTimer = 2.0;
    this.coasterSpeed = 0;
    this.coasterStationPos = new THREE.Vector3(-36, 4.2, 1235 + pzOff);

    this.ferrisWheelGroup = null;
    this.ferrisCabins = [];
    this.ferrisWheelCenter = new THREE.Vector3(0, 42.0, 1480 + pzOff);
    this.ferrisWheelRadius = 31.0;
    this.ferrisStationPos = new THREE.Vector3(0, 4.2, 1480 + pzOff);

    this.bigDropGondola = null;
    this.bigDropState = 'BOARDING'; // 'BOARDING' | 'CLIMBING' | 'SUSPENSE' | 'FREEFALL' | 'BRAKING'
    this.bigDropTimer = 2.5;
    this.bigDropY = 3.2;
    this.bigDropVelY = 0;
    this.bigDropBasePos = new THREE.Vector3(24, 3.2, 1325 + pzOff);
    this.carouselPos = new THREE.Vector3(-16, 1.6, 1325 + pzOff);

    this._dummy = new THREE.Object3D();
    this._tmpTan = new THREE.Vector3();
    this._tmpPos = new THREE.Vector3();

    this._initBaileFunkStageAndCrowd();
    this._initOceanRollerCoaster();
    this._initFerrisWheelLevelingAndPlatform();
    this._initBigDropTowerGondola();
  }

  _initBaileFunkStageAndCrowd() {
    initBaileFunkStageAndCrowd(this);
  }

  _updateBaileCrowdTransforms(t, playerPos, hypeMult, isPlayerDancingHere, farLodOnly) {
    updateBaileCrowdTransforms(this, t, playerPos, hypeMult, isPlayerDancingHere, farLodOnly);
  }

  _initOceanRollerCoaster() {
    initOceanRollerCoaster(this);
  }

  _getCoasterBankAt(u) {
    return getCoasterBankAt(u);
  }

  _updateCoasterTrainTransforms() {
    updateCoasterTrainTransforms(this);
  }

  _initFerrisWheelLevelingAndPlatform() {
    initFerrisWheelLevelingAndPlatform(this);
  }

  _initBigDropTowerGondola() {
    initBigDropTowerGondola(this);
  }

  findNearbyAttraction(playerPos) {
    return findNearbyPierAttraction(this, playerPos);
  }

  getLowestFerrisCabinIndex() {
    return getLowestFerrisCabinIndex(this);
  }

  getRideSeatTransform(rideState) {
    return getPierRideSeatTransform(this, rideState);
  }

  update(dt, playerPos = null, controller = null) {
    this.time += dt;
    updateBaileFunkStageAndCrowd(this, dt, this.time, playerPos, controller);
    updatePierAmusementParkRides(this, dt, controller);
  }
}
