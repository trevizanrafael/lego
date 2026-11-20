/**
 * ============================================================================
 * FACHADA DO SISTEMA DE CICLO DIA / PÔR DO SOL / NOITE NEON (60 FPS CRAVADOS)
 * ============================================================================
 * Orquestra o relógio atmosférico e a iluminação dinâmica da metrópole através
 * dos submódulos especializados em `./atmosphere/`:
 *   - `AtmosphereScheduleAndShader.js`: `TIME_MODES`, keyframes horários Gotham Noir,
 *     interpolação `sampleAtmosphereAtHour` e shaders procedurais do SkyDome.
 *   - `VehicleNightLightsRig.js`: geometrias/materiais compartilhados (Zero GC),
 *     `ensureVehicleNightLights` e faróis noturnos de carros, comboios e metrô.
 *   - `CelestialAndStreetLampsBuilder.js`: SkyDome, Sol, Lua LEGO, 1.200 estrelas,
 *     `InstancedMesh` unificado de postes/cones, neon de marcos/faróis e pool
 *     dinâmico de 4 `THREE.PointLight`s com busca espacial O(1).
 * ============================================================================
 */
import * as THREE from 'three';
import { TIME_MODES, sampleAtmosphereAtHour } from './atmosphere/AtmosphereScheduleAndShader.js';
import {
  ensureSharedVehicleLightAssets,
  ensureVehicleNightLights,
  initMetroNightEnhancements,
  updateMetroAndSharedVehicleMaterials,
  updateAllVehicleHeadlights
} from './atmosphere/VehicleNightLightsRig.js';
import {
  initCelestialSkyDomeStarsSunAndMoon,
  initCitywideStreetlampsAndCones,
  initLandmarkNeonAndLighthouses,
  initDynamicFourPointLightPool,
  updateClosestFourPointLights,
  updateCelestialAndSunShadow,
  updateCityEmissivesLampsAndLandmarks
} from './atmosphere/CelestialAndStreetLampsBuilder.js';

export { TIME_MODES, ensureVehicleNightLights };

export class DayNightAtmosphereManager {
  constructor(world, initialMode = 'auto') {
    this.world = world;
    this.scene = world.scene;
    this.sunLight = world.sunLight;
    this.hemiLight = world.hemiLight;

    // Começa às 20:00 (Noite de Gotham já estabilizada desde o Frame 0 — zero clarão inicial!)
    this.timeHours = 20.0;
    this.dayCycleDurationSec = 720.0; // 12 minutos reais = 24h no jogo
    this.timeMode = 'auto';
    this.nightFactor = 0.0;
    this._animTime = 0;

    this._sampled = {
      zenith: new THREE.Color(),
      mid: new THREE.Color(),
      horizon: new THREE.Color(),
      sunGlow: new THREE.Color(),
      dirColor: new THREE.Color(),
      hemiSky: new THREE.Color(),
      hemiGnd: new THREE.Color(),
      _tmp: new THREE.Color(),
      dirInt: 2.2,
      hemiInt: 0.94,
      nightFactor: 0.0
    };

    this._sunDir = new THREE.Vector3(0.4, 0.85, 0.25).normalize();
    this._moonDir = new THREE.Vector3(-0.35, 0.82, -0.25).normalize();
    this._lightOrbitDir = new THREE.Vector3();

    this.lampNodes = [];
    this._lampGrid = new Map();
    this._lampCellSize = 64;

    this.pointLightPool = [];
    this.landmarkNeonMaterials = [];
    this.lighthouseBeams = [];
    this.metroLeadCones = [];

    ensureSharedVehicleLightAssets();
    this._initCelestialSkyDomeStarsSunAndMoon();
    this._initCitywideStreetlampsAndCones();
    this._initLandmarkNeonAndLighthouses();
    this._initMetroNightEnhancements();
    this._initDynamicFourPointLightPool();

    this.setTimeMode(initialMode);
    this.update(0.016, new THREE.Vector3(0, 0.5, -117), null);
  }

  setTimeMode(mode = 'auto') {
    const valid = TIME_MODES.includes(mode) ? mode : 'auto';
    this.timeMode = valid;
    if (valid === 'day') {
      this.timeHours = 12.0;
    } else if (valid === 'sunset') {
      this.timeHours = 17.75;
    } else if (valid === 'night') {
      this.timeHours = 22.0;
    }
  }

  cycleTimeMode() {
    const idx = TIME_MODES.indexOf(this.timeMode);
    const next = TIME_MODES[(idx + 1) % TIME_MODES.length];
    if (next === 'auto') {
      this.timeHours = 15.5;
    }
    this.setTimeMode(next);
    return this.timeMode;
  }

  getFormattedClock() {
    const wrapped = ((this.timeHours % 24) + 24) % 24;
    const hh = Math.floor(wrapped);
    const mm = Math.floor((wrapped - hh) * 60);
    const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

    let icon = '☀';
    if (wrapped >= 18.75 || wrapped < 5.5) {
      icon = '🌙';
    } else if ((wrapped >= 5.5 && wrapped < 7.5) || (wrapped >= 16.75 && wrapped < 18.75)) {
      icon = '🌅';
    }
    return {
      hours: wrapped,
      timeStr,
      icon,
      display: `${icon} ${timeStr}`
    };
  }

  _initCelestialSkyDomeStarsSunAndMoon() {
    initCelestialSkyDomeStarsSunAndMoon(this);
  }

  _initCitywideStreetlampsAndCones() {
    initCitywideStreetlampsAndCones(this);
  }

  _initLandmarkNeonAndLighthouses() {
    initLandmarkNeonAndLighthouses(this);
  }

  _initMetroNightEnhancements() {
    initMetroNightEnhancements(this);
  }

  _initDynamicFourPointLightPool() {
    initDynamicFourPointLightPool(this);
  }

  _updateClosestFourPointLights(playerPos, nightFactor) {
    updateClosestFourPointLights(this, playerPos, nightFactor);
  }

  _updateAllVehicleHeadlights(playerPos, controller, vehicleLightsOn) {
    updateAllVehicleHeadlights(this, playerPos, controller, vehicleLightsOn);
  }

  update(dt, playerPos = null, controller = null) {
    this._animTime += dt;

    if (this.timeMode === 'auto') {
      this.timeHours = (this.timeHours + (dt / this.dayCycleDurationSec) * 24.0) % 24.0;
    }

    sampleAtmosphereAtHour(this.timeHours, this._sampled);
    this.nightFactor = this._sampled.nightFactor;
    const nf = this.nightFactor;

    updateCelestialAndSunShadow(this, dt, playerPos, controller);
    const lampRamp = updateCityEmissivesLampsAndLandmarks(this, dt, nf);

    const vehicleLightsOn = nf > 0.15;
    updateMetroAndSharedVehicleMaterials(this, nf, vehicleLightsOn);
    this._updateAllVehicleHeadlights(playerPos, controller, vehicleLightsOn);
    this._updateClosestFourPointLights(playerPos, lampRamp);
  }
}
