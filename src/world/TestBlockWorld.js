import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';
import { MAP_REGIONS, MAP_LANDMARKS } from './MapRegionsData.js';
import { BUILDING_STYLES, BUILDING_STYLE_KEYS } from './BuildingGenerator.js';
import { buildOceanAndMainIsland, buildUrbanRoadGridAndMedians } from './RoadGridBuilder.js';
import { buildParkedLegoCars, buildStreetProps, buildNewsstandsAndFences, buildGoldenLegoObjects } from './StreetPropsBuilder.js';
import { buildBoatsAndAircraftFleet } from './NavalAndAirFleetBuilder.js';
import { applySavedAircraftConfigsToCarrier } from './AircraftCustomGarage.js';
import { buildSuperBancoCentral } from './regions/SuperBankBuilder.js';
import { buildHeroTowerComplex, buildCentralParkAndLake, buildDowntownSkyscrapersAndTransitionBlocks } from './regions/DowntownBuilder.js';
import { buildNorthSuburbAndGasStation } from './regions/NorthSuburbBuilder.js';
import { buildSouthBeachAndFerrisWheel } from './regions/SouthBeachBuilder.js';
import { buildEastCanalIndustrialAndPort } from './regions/EastPortBuilder.js';
import { buildWestHighwayAndAirport } from './regions/WestAirportBuilder.js';
import { buildFavelaCidadeDeDeus } from './regions/FavelaCDDBuilder.js';
import { buildSoutheastPrisonIsland } from './regions/PrisonIslandBuilder.js';
import { buildPangaeaPeripheryExtensions } from './regions/PangaeaPeripheryBuilder.js';
import { buildSkyHelicarrier, buildLegoClouds } from './regions/HelicarrierBuilder.js';
import { buildViaductsAndNaturalRelief } from './ViaductAndReliefBuilder.js';
import { buildMetroSystem } from './MetroSystemBuilder.js';
import { LivingCityManager } from './LivingCityManager.js';
import { DayNightAtmosphereManager } from './DayNightAtmosphereManager.js';
import { InteractiveAttractionsManager } from './InteractiveAttractionsAndEmotes.js';
import { worldSpatialColliderMethods } from './core/WorldSpatialColliderGrid.js';
import { worldBatchingAndFreezeMethods } from './core/WorldBatchingAndFreeze.js';
import { worldElevationAndWaterMethods } from './core/WorldElevationAndWaterQueries.js';

export { MAP_REGIONS, MAP_LANDMARKS, BUILDING_STYLES, BUILDING_STYLE_KEYS };

export class TestBlockWorld {
  constructor(scene, destructibleManager = null) {
    this.scene = scene;
    this.destructibles = destructibleManager;
    if (this.destructibles) this.destructibles.world = this;

    this.colliders = []; // AABBs: { minX, maxX, minZ, maxZ, minY, maxY, disabled }
    this._colliderGrid = new Map();
    this._dynamicColliders = [];
    this.colliderCellSize = 32;
    this._colliderQueryId = 0;
    this.elevatedDecks = [];     // Tabuleiros/rampas de viadutos e estações elevadas para getSurfaceHeightAt
    this.undergroundFloors = []; // Pisos e túneis subterrâneos do Metrô (Y = -6.8m / -7.35m)
    this.metroTotems = [];       // Totens interativos [E] nas 5 estações do Metrô
    this.metroStations = [];
    this.metroLoopWaypoints = [];
    this.metroSystem = null;
    this.clouds = [];
    this.rotatingElements = [];
    this.cargoShips = [];
    this._pendingPortVehicles = [];
    this.regions = MAP_REGIONS;
    this.landmarks = MAP_LANDMARKS;
    this.downtownBlockLayouts = [];

    this._treeInstances = [];
    this._sidewalkGeosByColor = new Map();
    this._lastSunUpdatePos = new THREE.Vector3(99999, 99999, 99999);
    this.mapRoads = [];     // { x, z, w, d, isMain }
    this.mapBlocks = [];    // { x, z, w, d, color }
    this.mapBuildings = []; // { x, z, w, d, color, label, styleKey, height }
    this.mapWater = [];     // { x, z, w, d }
    this.waypoint = null;   // { x, z, label }
    this._initWaypointBeacon();

    this._setupSkyAndLights();
    buildOceanAndMainIsland(this);
    buildUrbanRoadGridAndMedians(this);

    // Regiões 1–7 + Expansão Periférica da Pangeia + Relevo/Viadutos/Metrô
    buildSuperBancoCentral(this);
    buildHeroTowerComplex(this);
    buildCentralParkAndLake(this);
    buildDowntownSkyscrapersAndTransitionBlocks(this);
    buildNorthSuburbAndGasStation(this);
    buildSouthBeachAndFerrisWheel(this);
    buildEastCanalIndustrialAndPort(this);
    buildFavelaCidadeDeDeus(this);
    buildWestHighwayAndAirport(this);
    buildSoutheastPrisonIsland(this);
    buildPangaeaPeripheryExtensions(this);
    buildSkyHelicarrier(this);
    buildViaductsAndNaturalRelief(this);
    buildMetroSystem(this);

    // 8. Objetos Quebráveis de Rua, Carros Dirigíveis, Embarcações, Aeronaves e Nuvens LEGO
    buildParkedLegoCars(this);
    buildBoatsAndAircraftFleet(this);
    applySavedAircraftConfigsToCarrier(this);
    if (this.destructibles && this._pendingPortVehicles?.length) {
      for (const pv of this._pendingPortVehicles) {
        this.destructibles.registerDestructible(pv);
      }
      this._pendingPortVehicles.length = 0;
    }
    buildStreetProps(this);
    buildNewsstandsAndFences(this);
    buildGoldenLegoObjects(this);
    buildLegoClouds(this);

    // 9. Finaliza os lotes instanciados/mesclados (Calçadas e Árvores da Cidade Inteira em 5 Draw Calls!)
    this._finalizeMergedSidewalks();
    this._finalizeInstancedTrees();
    const staticPhaseChildren = new Set(this.scene.children);

    // 10. Cidade Viva (PASSO 7): Trânsito em Movimento, Pedestres com Pânico, Patrulhas do BOPE e Guerra das 3 Facções (CV, PCC e A.R.E.S.)
    this.livingCity = new LivingCityManager(this, this.destructibles, this.destructibles?.hud);
    const beforeAtmosIdx = this.scene.children.length;

    // 11. Ciclo Cinematográfico Dia / Pôr do Sol Dourado / Noite Neon + Iluminação Artificial 60 FPS!
    const savedTimeMode = this.destructibles?.hud?.settings?.timeMode || 'auto';
    this.atmosphere = new DayNightAtmosphereManager(this, savedTimeMode);

    // 12. Atrações Interativas Vivas: Baile Funk da CDD + Parque de Diversões Embarcável no Mega Píer!
    this.attractions = new InteractiveAttractionsManager(this);
    for (let i = beforeAtmosIdx; i < this.scene.children.length; i++) {
      staticPhaseChildren.add(this.scene.children[i]);
    }

    // 13. Sub-regiões pré-alocadas (zero GC em getRegionAt) + Congelamento de Matrizes Estáticas!
    this._subRegions = this._createStaticSubRegions();
    this._freezeStaticSceneGraph(staticPhaseChildren);
  }

  update(dt, playerPos = null, controller = null) {
    if (this.metroSystem) {
      this.metroSystem.update(dt, playerPos);
      // Herói sentado no vagão acompanha o trem no mesmo quadro (sem atraso de 1 frame).
      if (controller?.activeRide?.type === 'metro') {
        controller._applyRideSeatAndCamera?.(0);
      }
    }
    if (this.customsRuntime) {
      this.customsRuntime.update(dt);
    }
    if (this.attractions) {
      this.attractions.update(dt, playerPos, controller);
    }
    if (this.livingCity) {
      this.livingCity.update(dt, playerPos, controller);
    }

    for (const c of this.clouds) {
      c.position.x += dt * 1.8;
      if (c.position.x > 1600) c.position.x = -1600;
    }

    for (const rot of this.rotatingElements) {
      rot.mesh.rotation[rot.axis] += rot.speed * dt;
    }

    if (this.waterShaderUniforms) {
      this.waterShaderUniforms.uTime.value += Math.min(dt || 0, 0.1);
    }

    if (this.atmosphere) {
      this.atmosphere.update(dt, playerPos, controller);
    } else if (playerPos && this.sunLight) {
      if (playerPos.distanceToSquared(this._lastSunUpdatePos) > 9.0) {
        this._lastSunUpdatePos.copy(playerPos);
        this.sunLight.position.set(playerPos.x + 120, playerPos.y + 200, playerPos.z + 100);
        this.sunLight.target.position.copy(playerPos);
        this.sunLight.target.updateMatrixWorld();
      }
    }

    if (this.waypoint && this.beaconGroup.visible) {
      const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.22;
      this.beaconRing.scale.set(pulse, pulse, 1);

      if (playerPos) {
        const dist = Math.hypot(playerPos.x - this.waypoint.x, playerPos.z - this.waypoint.z);
        if (dist < 14.0) {
          this.clearWaypoint();
          soundFX.playHeroSwap();
        }
      }
    }
  }
}

function installWorldPrototypeMethods(TargetClass, methodModules) {
  for (const mod of methodModules) {
    const descriptors = Object.getOwnPropertyDescriptors(mod);
    for (const key of Object.keys(descriptors)) {
      descriptors[key].enumerable = false;
    }
    Object.defineProperties(TargetClass.prototype, descriptors);
  }
}

installWorldPrototypeMethods(TestBlockWorld, [
  worldSpatialColliderMethods,
  worldBatchingAndFreezeMethods,
  worldElevationAndWaterMethods
]);
