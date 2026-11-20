import { CaptureZone } from './events/CaptureZone.js';
import { ObjectiveHud } from '../ui/ObjectiveHud.js';
import { TerritoryCounterAttack } from './events/TerritoryCounterAttack.js';
import { BankHeistEvent } from './events/BankHeistEvent.js';
import { BANK_SPEC } from './regions/SuperBankBuilder.js';

import {
  EXTRA_THEMES,
  INVASION_RULES,
  FACTION_THEME,
  FACTION_CONFIGS,
  TERRITORY_ZONES,
  getTerritoryZoneAt
} from './factions/TerritoryZonesAndConfigs.js';
import {
  buildTerritoryInfrastructureForZone,
  territoryInfrastructureMethods
} from './factions/TerritoryInfrastructure3D.js';
import { garrisonPeaceAndAlliesMethods } from './factions/GarrisonPeaceAndAlliesAI.js';
import { combatUnitsAndConvoysMethods } from './factions/CombatUnitsAndConvoys3D.js';
import { invasionWarDirectorMethods } from './factions/InvasionWarDirector.js';
import { invasionSquadCombatMethods } from './factions/InvasionWarAndSquadCombatAI.js';

// ============================================================================
// FACHADA CENTRAL DE GUERRA TERRITORIAL DE INVASÃO (1 FACÇÃO VS 1 FACÇÃO)
// Submódulos coesos em src/world/factions/*
// ============================================================================

export {
  EXTRA_THEMES,
  INVASION_RULES,
  FACTION_THEME,
  FACTION_CONFIGS,
  TERRITORY_ZONES,
  getTerritoryZoneAt,
  buildTerritoryInfrastructureForZone
};

export class FactionWarSystem {
  constructor(livingCity) {
    this.livingCity = livingCity;
    this.world = livingCity.world;
    this.scene = livingCity.scene;
    this.destructibles = livingCity.destructibles;
    this.hud = livingCity.hud;

    // Garante que os 3 Territórios tenham Portões, Garagens e 3 Outposts construídos
    buildTerritoryInfrastructureForZone(this.world, 'cv');
    buildTerritoryInfrastructureForZone(this.world, 'pcc');
    buildTerritoryInfrastructureForZone(this.world, 'ares');

    this.playerFaction = 'cv';
    this.activeZoneId = null;
    this.activeMode = 'PEACEFUL_CITY'; // 'PEACEFUL_CITY' | 'ALLY_HQ' | 'INVASION_1V1'
    this.isInvasionActive = false;

    this.combatNpcs = livingCity.combatNpcs;
    this.npcProjectiles = livingCity.npcProjectiles;
    this.activeWarzones = livingCity.activeWarzones;
    this.activeConvoyDrops = [];
    this.activeShockwaves = [];
    this.warSpawnedCars = [];

    // Pool leve de Feixes 3D de Cura (Medi-Beam Verde)
    this.healBeams = [];
    this._initHealBeamPool();

    // Estado vivo dos 3 Territórios (Dono atual, Outposts capturados, Bosses ativos)
    this.territories = {};
    for (const [zKey, zSpec] of Object.entries(TERRITORY_ZONES)) {
      const infra = this.world.territoryInfra?.[zKey];
      this.territories[zKey] = {
        id: zKey,
        spec: zSpec,
        ownerFaction: zSpec.defaultOwner,
        conqueredByPlayer: false,
        bossPhaseTriggered: false,
        enemyBossDefeated: false,
        enemyBoss: null,
        alliedBoss: null,
        enemyWaveTimer: 3.5,
        alliedWaveTimer: 2.0,
        outposts: (infra?.outposts || []).map((op) => ({
          ...op,
          ownerFaction: zSpec.defaultOwner,
          captureHoldTimer: 0
        })),
        // Invasão 2.0
        activeIndex: 0,
        invasionClock: INVASION_RULES.startClock,
        reinforceTimer: 6,
        // Contra-Ataque
        garrisonLevel: 0,
        threatTimer: null
      };
      const st = this.territories[zKey];
      st.captureZones = st.outposts.map(
        (op) =>
          new CaptureZone({
            id: op.id,
            x: op.x,
            y: op.y ?? 0,
            z: op.z,
            radius: INVASION_RULES.captureRadius,
            captureTime: INVASION_RULES.captureTime,
            scene: this.scene,
            label: op.code,
            groundAt: (gx, gz, ref) => this._groundAt(gx, gz, ref)
          })
      );
    }

    this.objectiveHud = new ObjectiveHud();
    this._lastController = null;
    this.counterAttack = new TerritoryCounterAttack(this);
    this.bankHeist = new BankHeistEvent(this);
    this._bankZoneState = {
      id: 'bank',
      spec: {
        title: 'SUPER BANCO CENTRAL',
        bossCourtyard: { x: 0, z: -165 },
        safeExitGate: { x: 0, z: BANK_SPEC.frontZ + 14 }
      },
      outposts: [],
      captureZones: [],
      activeIndex: 0,
      conqueredByPlayer: true,
      bossPhaseTriggered: false
    };

    this._animClock = 0;
  }
}

function installPrototypeMethods(proto, ...sources) {
  for (const source of sources) {
    const descriptors = Object.getOwnPropertyDescriptors(source);
    for (const key of Reflect.ownKeys(descriptors)) {
      descriptors[key].enumerable = false;
    }
    Object.defineProperties(proto, descriptors);
  }
}

installPrototypeMethods(
  FactionWarSystem.prototype,
  territoryInfrastructureMethods,
  garrisonPeaceAndAlliesMethods,
  combatUnitsAndConvoysMethods,
  invasionWarDirectorMethods,
  invasionSquadCombatMethods
);
