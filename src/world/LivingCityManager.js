import * as THREE from 'three';
import { FactionWarSystem } from './FactionWarSystem.js';
import { WantedPursuitSystem } from './WantedPursuitSystem.js';
import { pedestrianArchetypeMethods } from './living-city/PedestrianSharedGeometriesAndArchetypes.js';
import { trafficRouteSpecsAndSpawnerMethods } from './living-city/TrafficRouteSpecsAndSpawner.js';
import { trafficNetworkAndVehicleAIMethods } from './living-city/TrafficNetworkAndVehicleAI.js';
import { pedestrianCrowdAndInstancingMethods } from './living-city/PedestrianCrowdAndInstancing.js';
import { pedestrianBehaviorAndReactionsMethods } from './living-city/PedestrianBehaviorAndReactions.js';
import { ambientHelicopterAndCityPropsMethods } from './living-city/AmbientHelicopterAndCityProps.js';

/**
 * GERENCIADOR DE VIDA URBANA SOLAR & PACÍFICA — ESTILO LEGO MARVEL SUPER HEROES (MANHATTAN FREE ROAM):
 * 1) Zero Guerra Mundial / Zero Tiroteios: Cidade 100% pacífica, carismática, ensolarada e leve (60 FPS)!
 * 2) Bolha Dinâmica de Multidão ("Dynamic Crowd Ring"): Pool reciclável de 160 Civis LEGO com arquétipos por bairro e grupos de conversa!
 * 3) 4 Reações Dinâmicas Estilo LEGO Marvel: NORMAL, CHEER (aplausos, pulinhos e flash 3D de foto!), VILLAIN_SPOOK (Vórtex OP-08) e PANIC cômico!
 * 4) Trânsito Vivo Estilo Manhattan (~72 Veículos: Ônibus LEGO, Táxis Amarelos, Sedans, Esportivos, Buggies e Patrulhas Pacíficas), Luz de Freio, Buzinas, Helicóptero Civil de TV e Carrinhos de Lanche Destrutíveis!
 */
export class LivingCityManager {
  constructor(world, destructibles, hud) {
    this.world = world;
    this.scene = world.scene;
    this.destructibles = destructibles;
    this.hud = hud;

    // Arrays limpos (Zero soldados armados, zero zonas de guerra, zero projéteis inimigos!)
    this.trafficVehicles = [];
    this.pedestrians = [];
    this.combatNpcs = [];
    this.npcProjectiles = [];
    this.activeWarzones = [];
    this.pccHeli = null;
    this.armoredConvoy = null;
    this.activeBosses = [];
    this.healStations = [];
    this.healthCrystals = [];

    // Facção Aliada do Jogador ('cv' | 'pcc' | 'ares') — Cidade Civil 100% Pacífica; Guerra 1x1 apenas nos 3 Territórios!
    this.playerFaction = 'cv';
    this.playerMaxHp = 250;
    this.playerHp = 250;

    this.caveiraSupportCooldown = 0;
    this.caveiraCallToggle = 0;
    this._sirenPhase = 0;
    this._crowdRingTimer = 0.6;
    this._wasPlayerAirborne = false;
    this._heroLandingCheerTimer = 0;
    this._heroLandingPos = new THREE.Vector3();

    this.civilianSkyHeli = null;

    this._buildingGrid = new Map();
    this._buildingGridCellSize = 48;
    this._initBuildingSpatialGrid();

    this._initUrbanTraffic();
    this._initPedestrianInstancedPools();
    this._initPedestrians();
    this._initCivilianSkyHelicopter();
    this._initStreetVendorCarts();

    // Sistema de Guerra Territorial de Invasão (1x1 apenas dentro do Território Invadido!)
    this.factionWar = new FactionWarSystem(this);

    // Sistema de Procurado Escalável Estilo GTA (0 a 5 Estrelas) + Fuga Tática!
    this.wantedSystem = new WantedPursuitSystem(this);
  }

  resetTerritories() {
    if (this.factionWar) {
      this.factionWar.resetConqueredTerritories();
    }
  }

  /**
   * Mantido para compatibilidade total com Saves e LegoHud (sem spawnar tropas de guerra)
   */
  setPlayerFaction(factionKey = 'free_roam', controller = null, savedConquests = null) {
    this.playerFaction = factionKey || 'free_roam';
    this.playerHp = this.playerMaxHp;
    if (this.hud) {
      this.hud.setPlayerFaction(this.playerFaction, false);
      this.hud.setPlayerHealth(this.playerMaxHp, this.playerMaxHp, false);
    }
    if (this.factionWar) {
      this.factionWar.setPlayerFaction(factionKey, controller, savedConquests);
    }
  }

  // ============================================================================
  // LOOP PRINCIPAL (60 FPS CRAVADOS — ZERO DANO AO JOGADOR NO MODO LIVRE)
  // ============================================================================
  update(dt, playerPos, controller = null) {
    if (this.caveiraSupportCooldown > 0) {
      this.caveiraSupportCooldown = Math.max(0, this.caveiraSupportCooldown - dt);
    }

    // Na Cidade Civil Pacífica (0 Estrelas e fora de Invasão de Território), os 4 Corações LEGO ficam sempre cheios!
    const isWantedActive = Boolean(this.wantedSystem && this.wantedSystem.stars > 0);
    if (!this.factionWar?.isInvasionActive && !isWantedActive && this.playerHp < this.playerMaxHp) {
      this.playerHp = this.playerMaxHp;
      this.hud?.setPlayerHealth(this.playerMaxHp, this.playerMaxHp, false);
    }

    // Reciclagem Inteligente da Bolha de Multidão a cada 1.0 segundo!
    this._crowdRingTimer -= dt;
    if (this._crowdRingTimer <= 0) {
      this._crowdRingTimer = 1.0;
      this._updateDynamicCrowdRing(playerPos);
    }

    this._updateUrbanTraffic(dt, playerPos, controller);
    this._updatePedestrians(dt, playerPos, controller);
    this._updateCivilianSkyHelicopter(dt);
    if (this.factionWar) {
      this.factionWar.update(dt, playerPos, controller);
    }
    if (this.wantedSystem) {
      this.wantedSystem.update(dt, playerPos, controller);
    }
  }
}

function installLivingCityMixin(TargetClass, methodsObj) {
  const descriptors = {};
  for (const key of Reflect.ownKeys(methodsObj)) {
    const desc = Object.getOwnPropertyDescriptor(methodsObj, key);
    if (desc) {
      descriptors[key] = { ...desc, enumerable: false };
    }
  }
  Object.defineProperties(TargetClass.prototype, descriptors);
}

installLivingCityMixin(LivingCityManager, ambientHelicopterAndCityPropsMethods);
installLivingCityMixin(LivingCityManager, pedestrianArchetypeMethods);
installLivingCityMixin(LivingCityManager, trafficRouteSpecsAndSpawnerMethods);
installLivingCityMixin(LivingCityManager, trafficNetworkAndVehicleAIMethods);
installLivingCityMixin(LivingCityManager, pedestrianCrowdAndInstancingMethods);
installLivingCityMixin(LivingCityManager, pedestrianBehaviorAndReactionsMethods);
