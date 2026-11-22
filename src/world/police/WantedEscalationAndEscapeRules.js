import { soundFX } from '../../audio/SoundFX.js';
import { WANTED_STAR_THRESHOLDS, WANTED_TIER_INFO } from './PolicePursuitAssets.js';
import {
  PURSUIT_STATES,
  SEARCH_DURATION_BY_STAR,
  getSearchDurationForStars
} from './PursuitTuning.js';
import { policeVisionAndPerceptionMethods } from './PoliceVisionAndPerception.js';
import {
  pursuitStateMachineMethods,
  syncPursuitStateFlags,
  tickPursuitStateMachineAndHud
} from './PursuitStateMachine.js';

/**
 * WantedEscalationAndEscapeRules.js
 * Regras de escalada criminal (0★ -> 5★), fiança/detenção, oficina LEGO Customs,
 * regeneração tática e integração da Máquina de Estados + Cones de Visão GTA V.
 */

function reasonNeedsReset(controller) {
  return Boolean(controller && controller.position);
}

export function tickPursuitRegeneration(sys, dt) {
  sys.timeSinceLastDamage += dt;
  if (
    sys.timeSinceLastDamage >= 6.0 &&
    sys.livingCity &&
    sys.livingCity.playerHp < sys.livingCity.playerMaxHp
  ) {
    sys.livingCity.playerHp = Math.min(
      sys.livingCity.playerMaxHp,
      sys.livingCity.playerHp + dt * 46.0
    );
    const stillHealing = sys.livingCity.playerHp < sys.livingCity.playerMaxHp;
    sys.hud?.setPlayerHealth?.(sys.livingCity.playerHp, sys.livingCity.playerMaxHp, stillHealing);
  }
}

export function tickPursuitEscapeAndHud(sys, dt, playerPos, controller) {
  return tickPursuitStateMachineAndHud(sys, dt, playerPos, controller);
}

export const wantedEscalationAndEscapeMethods = {
  ...policeVisionAndPerceptionMethods,
  ...pursuitStateMachineMethods,

  _bindDestructibleChaosHooks() {
    if (!this.destructibles) return;

    const prevDamaged = this.destructibles.onObjectDamaged;
    this.destructibles.onObjectDamaged = (obj, dmg, hitOrigin, opts) => {
      if (typeof prevDamaged === 'function') prevDamaged(obj, dmg, hitOrigin, opts);
      this._handlePlayerDamagedObject(obj, dmg);
    };

    const prevDestroyed = this.destructibles.onObjectDestroyed;
    this.destructibles.onObjectDestroyed = (obj, hitOrigin, opts) => {
      if (typeof prevDestroyed === 'function') prevDestroyed(obj, hitOrigin, opts);
      this._handlePlayerDestroyedObject(obj);
    };
  },

  _isFactionWarContext(obj) {
    if (obj?.isFactionWarUnit) return true;
    if (this.livingCity?.factionWar?.isInvasionActive && !obj?.isPoliceUnit) return true;
    return false;
  },

  _handlePlayerDamagedObject(obj, dmg) {
    if (!obj || obj.isDriven || this._isFactionWarContext(obj)) return;

    if (obj.isCivilianPedestrian || obj.type === 'pedestrian_civilian') {
      this.addChaos(Math.max(26, Math.round(dmg * 0.45)), false);
      return;
    }

    const carType = obj.mesh?.userData?.carType || '';
    const isPoliceOfficer = Boolean(obj.isPoliceUnit && obj.isCombatNpc);
    const isPoliceTarget =
      Boolean(obj.isPoliceUnit) ||
      carType === 'interceptor_v8' ||
      carType === 'caveirao_bope' ||
      carType === 'military_tank';

    if (isPoliceOfficer && dmg >= 4) {
      this.addChaos(Math.max(52, dmg * 0.9), true);
    } else if (isPoliceTarget && dmg >= 22) {
      this.addChaos(Math.max(52, dmg * 0.9), true);
    }
  },

  _handlePlayerDestroyedObject(obj) {
    if (!obj || this._isFactionWarContext(obj)) return;

    if (obj.isCivilianPedestrian || obj.type === 'pedestrian_civilian') {
      this.addChaos(105, true);
      return;
    }

    const carType = obj.mesh?.userData?.carType || '';
    const isPoliceTarget =
      Boolean(obj.isPoliceUnit) ||
      obj.type === 'police_helicopter' ||
      obj.type === 'military_tank' ||
      obj.type === 'hunter_drone' ||
      carType === 'interceptor_v8' ||
      carType === 'caveirao_bope';

    if (isPoliceTarget) {
      this.addChaos(120, true);
      return;
    }

    if (obj.type === 'car') {
      this.addChaos(54, true);
      return;
    }

    if (obj.type === 'atm_machine') {
      this.addChaos(56, true);
      return;
    }

    if (obj.type === 'gas_pump' || obj.type === 'fuel_truck' || obj.type === 'bank_vault_door') {
      this.addChaos(125, true);
      return;
    }

    if (obj.isStreetProp) {
      this._consecutivePropsDestroyed = (this._consecutivePropsDestroyed || 0) + 1;
      this._propComboResetTimer = 14.0;

      if (this.stars === 0 && this._consecutivePropsDestroyed <= 3) {
        this.chaosScore = Math.min(85, this.chaosScore + 14);
      } else if (this.stars === 0 && this._consecutivePropsDestroyed === 4) {
        this.chaosScore = Math.min(85, this.chaosScore + 30);
      } else {
        const propChaos = Math.max(38, Math.min(44, (obj.chaosValue || 10) + 32));
        this.addChaos(propChaos, true);
      }
    }
  },

  addChaos(points, isMajorCrime = false) {
    if (points <= 0) return;
    this.chaosScore = Math.min(1150, this.chaosScore + points);

    if (this.stars > 0 && isMajorCrime) {
      this.enterPursuitState(this._lastPlayerPos);
    }

    this._recomputeStarsFromChaos();
  },

  setWantedStars(targetStars) {
    const clamped = Math.max(0, Math.min(5, Math.floor(targetStars)));
    if (clamped === 0) {
      this.clearWanted('manual');
      return;
    }
    this.chaosScore = WANTED_STAR_THRESHOLDS[clamped] + 15;
    this._recomputeStarsFromChaos(clamped);
  },

  _recomputeStarsFromChaos(forcedStars = null) {
    let nextStars = this.stars;
    if (forcedStars !== null) {
      nextStars = forcedStars;
    } else {
      for (let s = 5; s >= 1; s--) {
        if (this.chaosScore >= WANTED_STAR_THRESHOLDS[s]) {
          nextStars = Math.max(nextStars, s);
          break;
        }
      }
    }

    if (nextStars > this.stars) {
      const prevStars = this.stars;
      if (prevStars === 0) {
        this._usedDisguiseThisPursuit = false;
        this._witnessAlertTimer = 0;
        this._pendingWitnessChaos = 0;
      }
      this.stars = nextStars;
      this.enterPursuitState(this._lastPlayerPos);
      this._spawnTickTimer = 0;

      this._spawnImmediateWaveForStars(this._lastPlayerPos);

      const tier = WANTED_TIER_INFO[this.stars] || WANTED_TIER_INFO[1];
      this.hud?.updateWantedHud?.(this.stars, false, 0, this.escapeDuration, tier);
      if (prevStars === 0 || this.stars >= 3) {
        this.hud?.showWantedBanner?.(
          `PROCURADO: ${'★'.repeat(this.stars)}`,
          `${tier.label} // ${tier.division}`,
          this.stars >= 5 ? 'antihero' : 'pursuit'
        );
      }
    }
  },

  /**
   * LEGO Customs funciona sempre que NENHUMA unidade policial estiver enxergando `entryPos`!
   * Retorna `true` apenas se houver alguma unidade com visão real sobre `entryPos`.
   */
  hasCloseWitnessOnGarageEntry(entryPos) {
    if (this.stars <= 0 || !entryPos) return false;
    return this.doesAnyUnitSeePosition(entryPos, { forceImmediate: true });
  },

  clearWantedByPaintJob() {
    if (this.stars <= 0) return false;
    const cleared = this.stars;
    this.clearWanted('paint_job');
    soundFX.playTrueHeroFanfare();
    this.hud?.showWantedBanner?.(
      'PINTURA NOVA // 0 ESTRELAS!',
      `CARRO DISFARÇADO NA LEGO CUSTOMS • ${cleared}★ DESPISTADAS NA HORA!`,
      'escaped'
    );
    return true;
  },

  clearWanted(reason = 'escaped', meta = {}) {
    this.lastClearReason = reason;
    this.stars = 0;
    this.chaosScore = 0;
    syncPursuitStateFlags(this, PURSUIT_STATES.CLEAN);
    this.escapeDuration = SEARCH_DURATION_BY_STAR[1];
    this._pursuitEngageGraceTimer = 0;
    this._usedDisguiseThisPursuit = false;
    this._witnessAlertTimer = 0;
    this._pendingWitnessChaos = 0;
    this._witnessCrimePos = null;
    this._consecutivePropsDestroyed = 0;
    this._propComboResetTimer = 0;

    for (const pv of this.pursuitVehicles) {
      pv.retreating = true;
      pv.retreatLife = 5.5;
      if (pv.strobeRed) pv.strobeRed.material = this.mats.strobeOff;
      if (pv.strobeBlue) pv.strobeBlue.material = this.mats.strobeOff;
    }

    this._clearAllFootUnits();
    this._clearAllRoadblocks();
    this._removeEagleHelicopter();
    this._clearAllPoliceHelicopters?.();
    this._clearAllPoliceTanks?.();
    this._clearAllHunterDrones();
    this._clearAllEnemyProjectiles();
    soundFX.stopPursuitAudio?.();
    this._pursuitAudioRunning = false;
    if (this.energyCageMesh) {
      this.energyCageMesh.visible = false;
    }

    if (this.livingCity) {
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth?.(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    }

    this.hud?.updateWantedHud?.(0, false, 0, SEARCH_DURATION_BY_STAR[1], WANTED_TIER_INFO[0]);

    if (reason === 'escaped' && meta.studBonus > 0) {
      soundFX.playTrueHeroFanfare();
      this.hud?.addStuds?.(meta.studBonus, 'blue');
      this.hud?.showWantedBanner?.(
        'FUGA PERFEITA!',
        `POLÍCIA DESPISTADA • BÔNUS DE FUGA +${meta.studBonus.toLocaleString('pt-BR')} STUDS!`,
        'escaped'
      );
    } else if (reason === 'disguise_swap' && meta.studBonus > 0) {
      soundFX.playTrueHeroFanfare();
      this.hud?.addStuds?.(meta.studBonus, 'blue');
      this.hud?.showWantedBanner?.(
        'DISFARCE TÁTICO // FICHA LIMPA!',
        `IDENTIDADE TROCADA FORA DE VISÃO • +${meta.studBonus.toLocaleString('pt-BR')} STUDS!`,
        'escaped'
      );
    }
  },

  triggerPlayerBusted(controller = null) {
    const bustedStars = Math.max(1, this.stars);
    const currentStuds = this.hud?.totalStuds || 0;
    const fine = Math.min(currentStuds, Math.min(2500, bustedStars * 350));

    if (this.hud && fine > 0) {
      this.hud.totalStuds = Math.max(0, this.hud.totalStuds - fine);
      this.hud.displayedStuds = this.hud.totalStuds;
      if (this.hud.studCountEl) {
        this.hud.studCountEl.textContent = this.hud.totalStuds.toLocaleString('pt-BR');
      }
    }

    this.clearWanted('busted');
    if (reasonNeedsReset(controller)) {
      if (controller.currentVehicle) {
        controller.exitVehicle?.();
      }
      controller.energyNetSlowTimer = 0;
      const spawnX = 0;
      const spawnZ = -88;
      const spawnY =
        (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(spawnX, spawnZ) : 0) + 0.5;
      controller.position.set(spawnX, spawnY, spawnZ);
      controller.velocity?.set?.(0, 0, 0);
      if (controller.minifigure?.group) {
        controller.minifigure.group.position.copy(controller.position);
      }
    }

    if (this.livingCity) {
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth?.(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    }

    soundFX.playExplosion(0.65);
    this.hud?.showWantedBanner?.(
      'DETIDO!',
      fine > 0
        ? `LIBERADO NA DELEGACIA CENTRAL • FIANÇA: -${fine.toLocaleString('pt-BR')} STUDS`
        : 'LIBERADO NA DELEGACIA CENTRAL • FICHA LIMPA!',
      'busted'
    );
  },

  applyPursuitDamageToPlayer(amount, controller = null, opts = {}) {
    if (this.stars <= 0 || !this.livingCity || amount <= 0) return;
    if (this.playerHitIFrameTimer > 0) return;
    if (controller?.rollTimer > 0) return;
    if (controller?.operatorAbilities?.isStealthed?.() && !opts?.isCollision) return;

    this.playerHitIFrameTimer = 0.35;
    this.timeSinceLastDamage = 0;

    const inVehicleMult = controller?.currentVehicle ? 0.65 : 1.0;
    const rawScaled = amount * inVehicleMult;
    const finalDmg = this.livingCity.applyMitigatedDamageToPlayer
      ? this.livingCity.applyMitigatedDamageToPlayer(rawScaled, controller, opts)
      : Math.max(2, Math.round(rawScaled));

    this.livingCity.playerHp = Math.max(0, this.livingCity.playerHp - finalDmg);
    this.hud?.setPlayerHealth?.(this.livingCity.playerHp, this.livingCity.playerMaxHp, false);
    soundFX.playPlasticHit();

    if (this.livingCity.playerHp <= 0) {
      this.triggerPlayerBusted(controller);
    }
  }
};

export { PURSUIT_STATES, SEARCH_DURATION_BY_STAR, getSearchDurationForStars };
