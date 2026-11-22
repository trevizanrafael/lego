import * as THREE from 'three';
import { FactionWarSystem } from './FactionWarSystem.js';
import { WantedPursuitSystem } from './WantedPursuitSystem.js';
import { HumanoidCorpseManager } from './npc-health/HumanoidCorpseManager.js';
import { applyIncomingDamageMitigation } from '../entities/operators/RoleBaselines.js';
import { resolveCombatantSheet, getDefaultHybridOperatorKey } from '../entities/operators/OperatorCatalog.js';
import { pedestrianArchetypeMethods } from './living-city/PedestrianSharedGeometriesAndArchetypes.js';
import { trafficRouteSpecsAndSpawnerMethods } from './living-city/TrafficRouteSpecsAndSpawner.js';
import { trafficNetworkAndVehicleAIMethods } from './living-city/TrafficNetworkAndVehicleAI.js';
import { pedestrianCrowdAndInstancingMethods } from './living-city/PedestrianCrowdAndInstancing.js';
import { pedestrianBehaviorAndReactionsMethods } from './living-city/PedestrianBehaviorAndReactions.js';
import { ambientHelicopterAndCityPropsMethods } from './living-city/AmbientHelicopterAndCityProps.js';

/**
 * GERENCIADOR DE VIDA URBANA, ATRIBUTOS POR PAPEL/FACÇÃO & BOLHA DE MULTIDÃO (60 FPS)
 */
export class LivingCityManager {
  constructor(world, destructibles, hud) {
    this.world = world;
    this.scene = world.scene;
    this.destructibles = destructibles;
    this.hud = hud;
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

    this.playerFaction = 'cv';
    this.activeCharacterKey = 'cv_marretao';
    this.playerMaxHp = 380;
    this.playerHp = 380;
    this.playerDamageReduction = 0.20;
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
    this.corpseManager = new HumanoidCorpseManager(this.scene, this);
    this.factionWar = new FactionWarSystem(this);
    this.wantedSystem = new WantedPursuitSystem(this);
  }

  resetTerritories() {
    this.factionWar?.resetConqueredTerritories();
  }

  syncPlayerCharacterStats(charKey, factionKey = this.playerFaction, resetFull = false) {
    const sheet = resolveCombatantSheet(charKey, factionKey || this.playerFaction);
    const prevMax = this.playerMaxHp || sheet.hp;
    const curHp = Number.isFinite(this.playerHp) ? this.playerHp : prevMax;
    const ratio = resetFull ? 1 : (prevMax > 0 ? curHp / prevMax : 1);
    this.activeCharacterKey = sheet.characterKey;
    this.playerMaxHp = sheet.hp;
    this.playerDamageReduction = sheet.damageReduction || 0;
    this.playerHp = Math.max(1, Math.min(this.playerMaxHp, Math.round(this.playerMaxHp * ratio)));
    this.hud?.setPlayerHealth?.(this.playerHp, this.playerMaxHp, false);
    return sheet;
  }

  applyMitigatedDamageToPlayer(rawDamage, controller = null, opts = {}) {
    const numericRaw = Number(rawDamage);
    if (!Number.isFinite(numericRaw) || numericRaw <= 0) return 0;
    const afterRole = applyIncomingDamageMitigation(numericRaw, this.playerDamageReduction || 0);
    const abilityMult = controller?.operatorAbilities?.getIncomingDamageMultiplier?.(opts?.attackerPos || null) ?? 1.0;
    const earlyWindow = Number.isFinite(Number(controller?.rollEarlyMitigationSec))
      ? Number(controller.rollEarlyMitigationSec)
      : 0.20;
    const earlyMit = Number.isFinite(Number(controller?.rollEarlyMitigation))
      ? Number(controller.rollEarlyMitigation)
      : 0.40;
    const isEarlyRoll = Boolean(
      controller && Number(controller.rollImpulseTimer) > 0 && (Number(controller.rollElapsed) || 0) < earlyWindow
    );
    const rollMult = isEarlyRoll ? Math.max(0, 1 - earlyMit) : 1.0;
    return Math.max(1, Math.round(afterRole * abilityMult * rollMult * 10) / 10);
  }

  healPlayerAndAlliesInRadius(center, radius, playerHealAmount, npcHealAmount = playerHealAmount, opts = {}) {
    const r = Math.max(0, Number(radius) || 0);
    const pHeal = Math.max(0, Number(playerHealAmount) || 0);
    const nHeal = Math.max(0, Number(npcHealAmount) || 0);
    const pPos = opts?.playerPos || opts?.controller?.position || opts?.position || null;
    if (opts?.includeSelf !== false && pHeal > 0) {
      const inRange = !center || !pPos || Math.hypot(pPos.x - center.x, pPos.z - center.z) <= r;
      if (inRange) {
        const maxHp = this.playerMaxHp || 380;
        this.playerHp = Math.min(maxHp, (this.playerHp ?? maxHp) + pHeal);
        this.hud?.setPlayerHealth?.(this.playerHp, maxHp, true);
      }
    }

    let alliesHealed = 0;
    const visited = new Set();
    const healUnit = (npc, zoneOwner = null) => {
      if (!npc || visited.has(npc)) return;
      visited.add(npc);
      const isAllied = Boolean(
        npc.isAllied ||
        (this.playerFaction && npc.faction === this.playerFaction) ||
        (!npc.faction && this.playerFaction && zoneOwner === this.playerFaction)
      );
      const dest = npc.destructible;
      if (!isAllied || !dest || dest.destroyed) return;
      const uPos = npc.visual?.root?.position || npc.mesh?.position || dest.mesh?.position || dest.basePos || npc.position;
      if (center && uPos && Math.hypot(uPos.x - center.x, uPos.z - center.z) > r) return;
      if (nHeal > 0) {
        const maxNpcHp = dest.maxHp || dest.hp || 100;
        dest.hp = Math.min(maxNpcHp, dest.hp + nHeal);
        if (dest.humanoidHealth) dest.humanoidHealth.hp = dest.hp;
        alliesHealed++;
      }
    };

    for (const npc of this.factionWar?.combatNpcs || []) healUnit(npc);
    for (const npc of this.combatNpcs || []) healUnit(npc);
    for (const zone of Object.values(this.factionWar?.territories || {})) {
      for (const npc of zone?.garrisonUnits || []) {
        healUnit(npc, zone?.owner || zone?.currentOwner || null);
      }
    }

    return { playerHp: this.playerHp, alliesHealed };
  }

  /**
   * Mantido para compatibilidade total com Saves e LegoHud (sem spawnar tropas de guerra)
   */
  setPlayerFaction(factionKey = 'free_roam', controller = null, savedConquests = null) {
    this.playerFaction = factionKey || 'free_roam';
    const charKey = controller?.minifigure?.currentHeroKey || this.activeCharacterKey || getDefaultHybridOperatorKey(this.playerFaction);
    this.syncPlayerCharacterStats(charKey, this.playerFaction, true);
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
    this.corpseManager?.update(dt, playerPos, controller);
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
