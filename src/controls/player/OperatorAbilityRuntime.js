/**
 * OperatorAbilityRuntime.js
 *
 * Orchestrator for the 12 tactical Q/E abilities across the 6 Faction Operators
 * (CV, PCC, A.R.E.S.). Maintains persistent per-operator cooldowns across 1<->2
 * swaps, handles two-stage abilities (Remote C4 & Ballistic Shield), intercepts
 * incoming enemy projectiles, and exposes movement/mitigation/stealth queries.
 */

import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import {
  isFactionOperatorKey,
  getOperatorSpec,
  OPERATOR_KEYS_LIST
} from '../../entities/operators/OperatorCatalog.js';
import {
  CV_ABILITIES,
  updateCvDeployables,
  isBlockedByCvBarricade,
  isInsideCvSignalBuff,
  disposeCvDeployables
} from './operator-abilities/CvAbilities.js';
import {
  PCC_ABILITIES,
  updatePccDeployables,
  isBlockedByPccShield,
  getPccShieldDamageMult,
  cancelPccPersonalStances,
  disposePccDeployables
} from './operator-abilities/PccAbilities.js';
import {
  ARES_ABILITIES,
  updateAresDeployables,
  isBlockedByAresDome,
  isInsideAresDome,
  cancelAresCamo,
  disposeAresDeployables
} from './operator-abilities/AresAbilities.js';

const ALL_ABILITY_HANDLERS = Object.freeze({
  ...CV_ABILITIES,
  ...PCC_ABILITIES,
  ...ARES_ABILITIES
});

const IMPACT_SPARK_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.18, 0.18, 0.18));

export class OperatorAbilityRuntime {
  constructor(controller) {
    this.controller = controller;
    this._cooldownsByOp = {};
    for (const opKey of OPERATOR_KEYS_LIST) {
      this._cooldownsByOp[opKey] = { q: 0, e: 0 };
    }

    this.deployables = {
      barricades: [],
      medkits: [],
      fireworks: [],
      markedTargets: new Map(),
      signalBuffZones: [],
      supplyCrates: [],
      plantedC4: null,
      energyDomes: [],
      medDrones: [],
      empWaves: [],
      stunnedNpcs: new Set()
    };

    this.personal = {
      shieldActive: false,
      shieldTimer: 0,
      shieldMaxDuration: 7.0,
      camoActive: false,
      camoTimer: 0,
      camoMaxDuration: 6.0,
      chargeActive: false,
      chargeTimer: 0,
      chargeDir: new THREE.Vector3(0, 0, 1),
      chargeHitSet: new Set()
    };

    this._chargeVelScratch = new THREE.Vector3();
  }

  isOperatorActive() {
    return isFactionOperatorKey(this.controller?.minifigure?.currentHeroKey);
  }

  _ensureCooldownEntry(opKey) {
    if (!this._cooldownsByOp[opKey]) {
      this._cooldownsByOp[opKey] = { q: 0, e: 0 };
    }
    return this._cooldownsByOp[opKey];
  }

  getCooldownState(opKey = null) {
    const key = opKey || this.controller?.minifigure?.currentHeroKey;
    return isFactionOperatorKey(key) ? this._ensureCooldownEntry(key) : { q: 0, e: 0 };
  }

  onCharacterSwitched(charKey) {
    if (this.personal.shieldActive) {
      const muralhaCd = this._ensureCooldownEntry('pcc_muralha');
      const shieldSpec = getOperatorSpec('pcc_muralha')?.abilities?.q;
      cancelPccPersonalStances(this);
      if (muralhaCd.q <= 0 && shieldSpec) {
        muralhaCd.q = shieldSpec.cooldownSec;
      }
    } else if (this.personal.chargeActive) {
      cancelPccPersonalStances(this);
    }

    if (this.personal.camoActive) {
      cancelAresCamo(this, true);
    }

    if (charKey === 'ares_bastiao' && this.deployables.medDrones.length > 0) {
      if (this.controller?.minifigure?.operatorBackDroneGroup) {
        this.controller.minifigure.operatorBackDroneGroup.visible = false;
      }
    }

    const hud = this.controller?.hud;
    if (typeof hud?.setCharacterCombatHudMode === 'function') {
      hud.setCharacterCombatHudMode(charKey);
    } else {
      hud?.configureAbilityHudForCharacter?.(charKey);
    }
    this._syncAbilityHud();
  }

  triggerAbility(slotKey) {
    const slot = typeof slotKey === 'string' ? slotKey.toLowerCase() : '';
    if ((slot !== 'q' && slot !== 'e') || !this.isOperatorActive() || this.controller?.currentVehicle) {
      return false;
    }

    const op = getOperatorSpec(this.controller.minifigure.currentHeroKey);
    const spec = op?.abilities?.[slot];
    if (!op || !spec) return false;

    const cd = this._ensureCooldownEntry(op.key);

    if (spec.id === 'pcc_remote_c4') {
      if (this.deployables.plantedC4 && !this.deployables.plantedC4.detonated) {
        PCC_ABILITIES.pcc_remote_c4.detonate(this, spec);
        cd[slot] = spec.cooldownSec;
        this._syncAbilityHud();
        return true;
      }
      if (cd[slot] > 0) return false;
      PCC_ABILITIES.pcc_remote_c4.plant(this, spec);
      this._syncAbilityHud();
      return true;
    }

    if (spec.id === 'pcc_ballistic_shield') {
      if (this.personal.shieldActive) {
        PCC_ABILITIES.pcc_ballistic_shield.deactivate(this);
        cd[slot] = spec.cooldownSec;
        this._syncAbilityHud();
        return true;
      }
      if (cd[slot] > 0) return false;
      PCC_ABILITIES.pcc_ballistic_shield.activate(this, spec);
      this._syncAbilityHud();
      return true;
    }

    if (cd[slot] > 0) return false;
    const handler = ALL_ABILITY_HANDLERS[spec.id];
    if (!handler || typeof handler.activate !== 'function') return false;

    const activated = handler.activate(this, spec);
    if (activated === false) return false;

    cd[slot] = spec.cooldownSec;
    this._syncAbilityHud();
    return true;
  }

  notifyPrimaryWeaponFired() {
    if (this.personal.camoActive) {
      cancelAresCamo(this, true);
      this._syncAbilityHud();
    }
  }

  getMoveSpeedMultiplier() {
    if (!this.isOperatorActive() || this.controller?.currentVehicle) return 1.0;
    let mult = 1.0;
    if (this.personal.shieldActive) {
      mult *= 0.72;
    }
    if (this.personal.camoActive) {
      mult *= 1.18;
    }
    if (isInsideCvSignalBuff(this, this.controller?.position)) {
      mult *= 1.12;
    }
    return Number(mult.toFixed(4));
  }

  getChargeOverrideVelocity() {
    if (!this.personal.chargeActive || this.personal.chargeTimer <= 0 || !this.isOperatorActive()) {
      return null;
    }
    const vy = this.controller?.velocity?.y ?? 0;
    return this._chargeVelScratch.set(
      this.personal.chargeDir.x * 34.0,
      vy,
      this.personal.chargeDir.z * 34.0
    );
  }

  getIncomingDamageMultiplier(attackerPos = null) {
    let mult = 1.0;
    if (this.personal.shieldActive && this.isOperatorActive()) {
      mult *= getPccShieldDamageMult(this, attackerPos);
    }
    if (isInsideAresDome(this, this.controller?.position)) {
      mult *= 0.40;
    }
    return Number(mult.toFixed(4));
  }

  isProjectileBlocked(projPos, originPos = null) {
    if (!projPos) return false;
    if (isBlockedByCvBarricade(this, projPos, true)) return true;
    if (this.personal.shieldActive && this.isOperatorActive() && isBlockedByPccShield(this, projPos, originPos)) {
      return true;
    }
    if (isBlockedByAresDome(this, projPos, originPos)) return true;
    return false;
  }

  isStealthed() {
    return Boolean(this.personal.camoActive && this.isOperatorActive());
  }

  disposeAllDeployables() {
    disposeCvDeployables(this);
    disposePccDeployables(this);
    disposeAresDeployables(this);
    cancelPccPersonalStances(this);
    if (this.personal.camoActive) {
      cancelAresCamo(this, false);
    }
  }

  update(dt) {
    const safeDt = Math.max(0, Number(dt) || 0);

    for (const opKey of OPERATOR_KEYS_LIST) {
      const cd = this._ensureCooldownEntry(opKey);
      if (cd.q > 0) cd.q = Math.max(0, cd.q - safeDt);
      if (cd.e > 0) cd.e = Math.max(0, cd.e - safeDt);
    }

    updateCvDeployables(this, safeDt);
    updatePccDeployables(this, safeDt);
    updateAresDeployables(this, safeDt);
    this._interceptHostileProjectiles();
    this._syncAbilityHud();
  }

  _interceptHostileProjectiles() {
    const world = this.controller?.world;
    const livingCity = world?.livingCity;
    if (!livingCity) return;

    const destructibles = this.controller?.destructibles;
    const lists = [
      { arr: livingCity.factionWar?.npcProjectiles, checkAllied: true },
      { arr: livingCity.wantedSystem?.enemyProjectiles, checkAllied: false }
    ];

    for (const { arr, checkAllied } of lists) {
      if (!Array.isArray(arr) || arr.length === 0) continue;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        if (!p?.mesh?.position) continue;
        if (checkAllied && p.isAllied) continue;
        if (!p._spawnOrigin) {
          p._spawnOrigin = p.mesh.position.clone();
        }
        if (this.isProjectileBlocked(p.mesh.position, p._spawnOrigin)) {
          destructibles?._spawnFxParticle?.(
            IMPACT_SPARK_GEO,
            0x38bdf8,
            0.9,
            p.mesh.position.x,
            p.mesh.position.y,
            p.mesh.position.z,
            0.9, 0.9, 0.9,
            (Math.random() - 0.5) * 6,
            2 + Math.random() * 4,
            (Math.random() - 0.5) * 6,
            0.22
          );
          if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
          arr.splice(i, 1);
        }
      }
    }
  }

  _isSlotCurrentlyActive(opKey, abilityId) {
    if (abilityId === 'cv_barricade') return this.deployables.barricades.length > 0;
    if (abilityId === 'cv_medkit') return this.deployables.medkits.length > 0;
    if (abilityId === 'cv_signal_fireworks') return this.deployables.signalBuffZones.length > 0;
    if (abilityId === 'pcc_supply_crate') return this.deployables.supplyCrates.length > 0;
    if (abilityId === 'pcc_remote_c4') return Boolean(this.deployables.plantedC4 && !this.deployables.plantedC4.detonated);
    if (abilityId === 'pcc_ballistic_shield') return this.personal.shieldActive && opKey === 'pcc_muralha';
    if (abilityId === 'pcc_shield_charge') return this.personal.chargeActive && opKey === 'pcc_muralha';
    if (abilityId === 'ares_energy_dome') return this.deployables.energyDomes.length > 0;
    if (abilityId === 'ares_med_drone') return this.deployables.medDrones.length > 0;
    if (abilityId === 'ares_optic_camo') return this.personal.camoActive && opKey === 'ares_agulha';
    return false;
  }

  _syncAbilityHud() {
    const hud = this.controller?.hud;
    if (!hud?.updateAbilityCooldowns || !this.isOperatorActive()) return;
    const op = getOperatorSpec(this.controller.minifigure.currentHeroKey);
    if (!op) return;

    const cd = this._ensureCooldownEntry(op.key);
    const qSpec = op.abilities.q;
    const eSpec = op.abilities.e;

    hud.updateAbilityCooldowns({
      qRemaining: cd.q,
      qTotal: qSpec.cooldownSec,
      qActive: this._isSlotCurrentlyActive(op.key, qSpec.id),
      eRemaining: cd.e,
      eTotal: eSpec.cooldownSec,
      eActive: this._isSlotCurrentlyActive(op.key, eSpec.id)
    });
  }
}
