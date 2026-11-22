/**
 * OperatorWeaponRuntime.js
 *
 * Actor-agnostic ballistic firearm runtime for the 6 playable Faction Operators
 * (and future Deadlock-style AI operator bots). Supports 'auto', 'semi',
 * 'spinup_auto', and 'charge' fire modes, per-operator ammo persistence, reload,
 * ADS FOV/spread, Fogueteira +20% mark bonus, and shared-asset 3D projectiles.
 */

import * as THREE from 'three';
import { isFactionOperatorKey, getOperatorSpec } from '../../entities/operators/OperatorCatalog.js';
import {
  getWeaponSpec,
  computeWeaponShotDamage,
  computeEffectiveSpreadRad
} from '../../entities/operators/WeaponCatalog.js';
import { getLegoMaterial, markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';

const HEAVY_TRACER_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.068, 0.068, 0.92, 8).rotateX(Math.PI / 2));
const COMPACT_BULLET_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.048, 0.048, 0.62, 8).rotateX(Math.PI / 2));
const DMR_SLUG_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.036, 0.036, 2.35, 8).rotateX(Math.PI / 2));
const BUCKSHOT_PELLET_GEO = markAsSharedAsset(new THREE.SphereGeometry(0.092, 8, 8));
const PULSE_BOLT_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.072, 0.072, 0.96, 8).rotateX(Math.PI / 2));
const LASER_BEAM_CYL_GEO = markAsSharedAsset(
  new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0).rotateX(Math.PI / 2)
);
const SMOKE_PUFF_GEO = markAsSharedAsset(new THREE.SphereGeometry(0.22, 8, 8));

const MAT_CV_LMG = markAsSharedAsset(getLegoMaterial(0xf59e0b, { emissive: 0xdc2626, emissiveIntensity: 2.2, roughness: 0.12 }));
const MAT_CV_PISTOL = markAsSharedAsset(getLegoMaterial(0xfef08a, { emissive: 0xf97316, emissiveIntensity: 1.9, roughness: 0.14 }));
const MAT_PCC_DMR = markAsSharedAsset(getLegoMaterial(0xfef3c7, { emissive: 0xf59e0b, emissiveIntensity: 2.6, roughness: 0.08 }));
const MAT_PCC_PELLET = markAsSharedAsset(getLegoMaterial(0xfef08a, { emissive: 0xea580c, emissiveIntensity: 2.2, roughness: 0.15 }));
const MAT_ARES_PULSE = markAsSharedAsset(getLegoMaterial(0x22d3ee, { emissive: 0xa855f7, emissiveIntensity: 2.65, roughness: 0.08 }));
const MAT_ARES_LASER = markAsSharedAsset(getLegoMaterial(0xfaf5ff, { emissive: 0xc084fc, emissiveIntensity: 2.9, roughness: 0.06 }));

const PROJ_STYLE_BY_WEAPON = {
  cv_lmg: { geo: HEAVY_TRACER_GEO, mat: MAT_CV_LMG, life: 1.2 },
  cv_pistol: { geo: COMPACT_BULLET_GEO, mat: MAT_CV_PISTOL, life: 1.25 },
  pcc_dmr: { geo: DMR_SLUG_GEO, mat: MAT_PCC_DMR, life: 2.0 },
  pcc_shotgun12: { geo: BUCKSHOT_PELLET_GEO, mat: MAT_PCC_PELLET, life: 0.44 },
  ares_pulse_minigun: { geo: PULSE_BOLT_GEO, mat: MAT_ARES_PULSE, life: 1.15 },
  ares_charge_rifle: { geo: DMR_SLUG_GEO, mat: MAT_ARES_LASER, life: 1.15 }
};

function createOperatorStateStore() {
  const store = {};
  Object.defineProperties(store, {
    get: { value: (k) => store[k], enumerable: false },
    set: { value: (k, v) => ((store[k] = v), store), enumerable: false },
    has: { value: (k) => Object.prototype.hasOwnProperty.call(store, k), enumerable: false },
    entries: { value: () => Object.entries(store), enumerable: false }
  });
  return store;
}

export class OperatorWeaponRuntime {
  constructor(controller) {
    this.controller = controller;
    this._stateByOperator = createOperatorStateStore();
    this.fireCooldown = 0;
    this.isTriggerHeld = false;
    this.semiReady = true;
    this.isCharging = false;
    this.chargeTime = 0;
    this.spinupProgress = 0;
    this.isAiming = false;
    this.isScopedIn = false;
    this.scopeZoom = 4.0;
    this._scopeRecoilKick = 0;
    this._muzzleScratch = new THREE.Vector3();
    this._dirScratch = new THREE.Vector3();
    this._spreadScratch = new THREE.Vector3();

    const initialKey = this.controller?.minifigure?.currentHeroKey;
    if (isFactionOperatorKey(initialKey)) this._ensureOperatorState(initialKey);
  }

  isOperatorActive() {
    return isFactionOperatorKey(this.controller?.minifigure?.currentHeroKey);
  }

  getActiveOperatorSpec() {
    const key = this.controller?.minifigure?.currentHeroKey;
    return isFactionOperatorKey(key) ? getOperatorSpec(key) : null;
  }

  getActiveWeaponSpec() {
    const op = this.getActiveOperatorSpec();
    return op ? getWeaponSpec(op.weaponKey) : null;
  }

  _ensureOperatorState(opKey) {
    if (!isFactionOperatorKey(opKey)) return null;
    if (!this._stateByOperator[opKey]) {
      const weaponSpec = getWeaponSpec(getOperatorSpec(opKey)?.weaponKey);
      if (!weaponSpec) return null;
      this._stateByOperator[opKey] = {
        weaponKey: weaponSpec.key,
        magAmmo: weaponSpec.magSize,
        reserveAmmo: weaponSpec.reserveMax,
        isReloading: false,
        reloadTimer: 0,
        reloadDuration: weaponSpec.reloadSec
      };
    }
    return this._stateByOperator[opKey];
  }

  getOperatorAmmoState(opKey = null) {
    return this._ensureOperatorState(opKey || this.controller?.minifigure?.currentHeroKey);
  }

  onCharacterSwitched(charKey) {
    this.resetHeldState();
    this.fireCooldown = 0;
    for (const [, st] of this._stateByOperator.entries()) {
      st.isReloading = false;
      st.reloadTimer = 0;
    }

    const hud = this.controller?.hud;
    hud?.updateSniperScopeHud?.({ active: false });
    if (isFactionOperatorKey(charKey)) {
      const weaponSpec = getWeaponSpec(getOperatorSpec(charKey)?.weaponKey);
      const state = this._ensureOperatorState(charKey);
      if (typeof hud?.setCharacterCombatHudMode === 'function') hud.setCharacterCombatHudMode(charKey);
      else hud?.configureAbilityHudForCharacter?.(charKey);
      this._syncWeaponHud(weaponSpec, state);
    } else {
      hud?.setCharacterCombatHudMode?.(charKey);
    }
  }

  handlePrimaryMouseDown() {
    if (!this.isOperatorActive() || this.controller?.currentVehicle) return false;
    if ((this.controller?.rollImpulseTimer || 0) > 0) return false;
    const op = this.getActiveOperatorSpec();
    const weaponSpec = this.getActiveWeaponSpec();
    const state = op ? this._ensureOperatorState(op.key) : null;
    if (!op || !weaponSpec || !state) return false;

    if (state.magAmmo <= 0) {
      this.startReload();
      return true;
    }
    if (state.isReloading) return true;

    const mode = weaponSpec.fireMode;
    if (mode === 'auto') {
      this.isTriggerHeld = true;
      if (this.fireCooldown <= 0) this._fireRound(1.0);
    } else if (mode === 'semi') {
      this.isTriggerHeld = true;
      if (this.semiReady && this.fireCooldown <= 0) {
        this.semiReady = false;
        this._fireRound(1.0);
      }
    } else if (mode === 'spinup_auto') {
      this.isTriggerHeld = true;
      soundFX.playSolarChargeTick?.(0.2);
    } else if (mode === 'charge' && this.fireCooldown <= 0) {
      this.isTriggerHeld = true;
      this.isCharging = true;
      this.chargeTime = 0;
      soundFX.playSolarChargeTick?.(0.15);
    }

    this._syncWeaponHud(weaponSpec, state);
    return true;
  }

  handlePrimaryMouseUp() {
    if (!this.isOperatorActive()) {
      this.resetHeldState();
      return false;
    }
    const op = this.getActiveOperatorSpec();
    const weaponSpec = this.getActiveWeaponSpec();
    const state = op ? this._ensureOperatorState(op.key) : null;
    const isRolling = (this.controller?.rollImpulseTimer || 0) > 0;

    if (
      !isRolling &&
      this.isCharging &&
      weaponSpec?.fireMode === 'charge' &&
      state &&
      !state.isReloading &&
      state.magAmmo > 0
    ) {
      const maxChg = Math.max(0.01, Number(weaponSpec.maxChargeSec) || 0.85);
      const chargeRatio = THREE.MathUtils.clamp(this.chargeTime / maxChg, 0, 1);
      this.isCharging = false;
      this.chargeTime = 0;
      this._fireRound(chargeRatio);
    } else {
      this.isCharging = false;
      this.chargeTime = 0;
    }

    this.isTriggerHeld = false;
    this.semiReady = true;
    if (weaponSpec && state) this._syncWeaponHud(weaponSpec, state);
    return true;
  }

  startReload() {
    if (!this.isOperatorActive() || this.controller?.currentVehicle) return false;
    if ((this.controller?.rollImpulseTimer || 0) > 0) return false;
    const op = this.getActiveOperatorSpec();
    const weaponSpec = this.getActiveWeaponSpec();
    const state = op ? this._ensureOperatorState(op.key) : null;
    if (!weaponSpec || !state) return false;
    if (state.isReloading || state.magAmmo >= weaponSpec.magSize || state.reserveAmmo <= 0) return false;

    this.isCharging = false;
    this.chargeTime = 0;
    this.spinupProgress = 0;
    state.isReloading = true;
    state.reloadTimer = weaponSpec.reloadSec;
    state.reloadDuration = weaponSpec.reloadSec;
    soundFX.playHeroSwap?.();
    this._syncWeaponHud(weaponSpec, state);
    return true;
  }

  cancelReload() {
    if (!this.isOperatorActive()) return false;
    const op = this.getActiveOperatorSpec();
    const weaponSpec = this.getActiveWeaponSpec();
    const state = op ? this._ensureOperatorState(op.key) : null;
    if (!state || !state.isReloading) {
      if (this.isScopedIn) this.syncScopeState(weaponSpec, state);
      return false;
    }
    state.isReloading = false;
    state.reloadTimer = 0;
    if (weaponSpec) this._syncWeaponHud(weaponSpec, state);
    return true;
  }

  refillAmmo(reserveFraction = 0.5, fillMag = true) {
    const frac = Math.max(0, Number(reserveFraction) || 0);
    const activeOp = this.getActiveOperatorSpec();
    if (activeOp) this._ensureOperatorState(activeOp.key);

    for (const [opKey, st] of this._stateByOperator.entries()) {
      const wSpec = getWeaponSpec(getOperatorSpec(opKey)?.weaponKey);
      if (!wSpec) continue;
      st.reserveAmmo = Math.min(wSpec.reserveMax, st.reserveAmmo + Math.ceil(wSpec.reserveMax * frac));
      if (fillMag) st.magAmmo = wSpec.magSize;
      st.isReloading = false;
      st.reloadTimer = 0;
    }
    if (activeOp) {
      this._syncWeaponHud(getWeaponSpec(activeOp.weaponKey), this._ensureOperatorState(activeOp.key));
    }
    return true;
  }

  setScopeZoom(nextZoom, playClick = false) {
    const weaponSpec = this.getActiveWeaponSpec();
    const minZ = weaponSpec?.scopeMinZoom ?? 1.0;
    const maxZ = weaponSpec?.scopeMaxZoom ?? 100.0;
    const raw = Number.isFinite(Number(nextZoom)) ? Number(nextZoom) : (weaponSpec?.scopeDefaultZoom ?? 4.0);
    const clamped = Math.round(THREE.MathUtils.clamp(raw, minZ, maxZ) * 10) / 10;
    const changed = Math.abs(clamped - this.scopeZoom) >= 0.05;
    this.scopeZoom = clamped;
    if (changed && playClick) soundFX.playScopeZoomClick?.(this.scopeZoom);
    if (this.isScopedIn) this.syncScopeState(weaponSpec);
    return changed;
  }

  handleScopeWheel(deltaY) {
    if (!this.isScopedIn) return false;
    const dy = Number(deltaY) || 0;
    if (dy === 0) return true;
    const cur = this.scopeZoom || 4.0;
    let step;
    if (dy < 0) {
      step = cur < 4.0 ? 0.5 : cur < 10.0 ? 1.0 : cur < 30.0 ? 2.5 : 10.0;
    } else {
      step = cur <= 4.0 ? 0.5 : cur <= 10.0 ? 1.0 : cur <= 30.0 ? 2.5 : 10.0;
    }
    this.setScopeZoom(cur + (dy < 0 ? step : -step), true);
    return true;
  }

  _setScopedIn(nextScoped) {
    const active = Boolean(nextScoped);
    const wasScoped = Boolean(this.isScopedIn);
    this.isScopedIn = active;
    const visRoot = this.controller?.minifigure?.visualRoot;
    if (!visRoot) return;
    if (active) visRoot.visible = false;
    else if (wasScoped || visRoot.visible === false) visRoot.visible = true;
  }

  syncScopeState(weaponSpecArg = null, stateArg = null) {
    const ctrl = this.controller;
    const opActive = this.isOperatorActive();
    this.isAiming = Boolean(opActive && !ctrl?.currentVehicle && !ctrl?.activeRide && ctrl?.mouseButtons?.right);
    const op = opActive ? this.getActiveOperatorSpec() : null;
    const weaponSpec = weaponSpecArg || (op ? getWeaponSpec(op.weaponKey) : null);
    const state = stateArg || (op ? this._ensureOperatorState(op.key) : null);
    const shouldScope = Boolean(
      opActive && weaponSpec?.hasScope && state && this.isAiming && !state.isReloading &&
      !ctrl?.currentVehicle && !ctrl?.activeRide && !ctrl?.fastTravelState?.active &&
      (ctrl?.rollImpulseTimer || 0) <= 0 && (ctrl?.minifigure?.rollTimer || 0) <= 0
    );
    this._setScopedIn(shouldScope);

    const hud = ctrl?.hud;
    if (!hud?.updateSniperScopeHud) return shouldScope;
    if (!shouldScope || !weaponSpec || !state) {
      hud.updateSniperScopeHud({ active: false });
      return false;
    }
    const minZ = weaponSpec.scopeMinZoom ?? 1.0;
    const maxZ = weaponSpec.scopeMaxZoom ?? 100.0;
    this.scopeZoom = Math.round(
      THREE.MathUtils.clamp(Number(this.scopeZoom) || weaponSpec.scopeDefaultZoom || 4.0, minZ, maxZ) * 10
    ) / 10;
    const aimDist = (ctrl?.destructibles?.getAimTargetPoint && ctrl?.camera)
      ? ctrl.destructibles.getAimTargetPoint(ctrl.camera, 1250).distance
      : 0;
    hud.updateSniperScopeHud({
      active: true,
      weaponKey: weaponSpec.key,
      scopeTheme: weaponSpec.scopeTheme || 'pcc_cobalt',
      zoom: this.scopeZoom,
      zoomLabel: `${this.scopeZoom.toFixed(1)}X`,
      distanceMeters: Math.round(aimDist),
      inMag: state.magAmmo,
      magSize: weaponSpec.magSize,
      reserve: state.reserveAmmo,
      recoilKick: this._scopeRecoilKick || 0
    });
    return true;
  }

  resetHeldState() {
    this.isTriggerHeld = false;
    this.isCharging = false;
    this.chargeTime = 0;
    this.spinupProgress = 0;
    this.semiReady = true;
    this.isAiming = false;
    this._scopeRecoilKick = 0;
    this._setScopedIn(false);
    this.controller?.hud?.updateSniperScopeHud?.({ active: false });
  }

  getAimSensitivityScale() {
    if (!this.isOperatorActive() || this.controller?.currentVehicle) return 1.0;
    if (this.isScopedIn) {
      return THREE.MathUtils.clamp(0.88 / Math.max(1, this.scopeZoom || 4.0), 0.0085, 0.88);
    }
    return this.isAiming ? 0.75 : 1.0;
  }

  getMoveSpeedMultiplier() {
    if (!this.isOperatorActive() || this.controller?.currentVehicle) return 1.0;
    const weaponSpec = this.getActiveWeaponSpec();
    if (!weaponSpec || this.getOperatorAmmoState()?.isReloading) return 1.0;
    const firing = this.isTriggerHeld && (this.fireCooldown > 0 || this.spinupProgress > 0.1 || this.isCharging);
    return firing ? (weaponSpec.firingMoveSpeedScale ?? 1.0) : 1.0;
  }

  getDesiredAimFov() {
    if (this.isOperatorActive() && !this.controller?.currentVehicle && Boolean(this.controller?.mouseButtons?.right)) {
      const weaponSpec = this.getActiveWeaponSpec();
      if (!weaponSpec) return null;
      if (weaponSpec.hasScope) {
        if (!this.isScopedIn) return null;
        const baseUserFov = THREE.MathUtils.clamp(
          Number(this.controller?.hud?.settings?.fov ?? this.controller?.baseFov ?? 58),
          50,
          85
        );
        const minZ = weaponSpec.scopeMinZoom ?? 1.0;
        const maxZ = weaponSpec.scopeMaxZoom ?? 100.0;
        const zoom = THREE.MathUtils.clamp(this.scopeZoom || 4.0, minZ, maxZ);
        const halfRad = (baseUserFov * Math.PI) / 360;
        const zoomedFov = (2 * Math.atan(Math.tan(halfRad) / zoom) * 180) / Math.PI;
        return Number(zoomedFov.toFixed(4));
      }
      return weaponSpec.aimFov ?? null;
    }
    return null;
  }

  update(dt) {
    const safeDt = Math.max(0, Number(dt) || 0);
    if (
      this.controller &&
      (this.controller.currentVehicle || this.controller.isFlying || this.controller.activeRide || this.controller.grappleState) &&
      (this.controller.rollCooldownTimer || 0) > 0
    ) {
      this.controller.rollCooldownTimer = Math.max(0, this.controller.rollCooldownTimer - safeDt);
    }
    if (this._scopeRecoilKick > 0) {
      this._scopeRecoilKick = Math.max(0, this._scopeRecoilKick - safeDt * 7.5);
    }
    this.isAiming = Boolean(
      this.isOperatorActive() && !this.controller?.currentVehicle && !this.controller?.activeRide && this.controller?.mouseButtons?.right
    );
    if (!this.isOperatorActive()) {
      if (this.isScopedIn) {
        this._setScopedIn(false);
        this.controller?.hud?.updateSniperScopeHud?.({ active: false });
      }
      return;
    }

    const op = this.getActiveOperatorSpec();
    const weaponSpec = this.getActiveWeaponSpec();
    const state = op ? this._ensureOperatorState(op.key) : null;
    if (!op || !weaponSpec || !state) return;

    this.fireCooldown -= safeDt;

    if (this.controller?.currentVehicle) {
      this.fireCooldown = Math.max(0, this.fireCooldown);
      this.resetHeldState();
      this._syncWeaponHud(weaponSpec, state);
      return;
    }

    const isRolling = (this.controller?.rollImpulseTimer || 0) > 0;
    if (isRolling) {
      if (state.isReloading) {
        state.isReloading = false;
        state.reloadTimer = 0;
      }
      this.isCharging = false;
      this.chargeTime = 0;
      this.spinupProgress = Math.max(0, this.spinupProgress - safeDt * 2.4);
      if (this.fireCooldown < 0) this.fireCooldown = 0;
      this._syncWeaponHud(weaponSpec, state);
      return;
    }

    if (state.isReloading) {
      state.reloadTimer = Math.max(0, state.reloadTimer - safeDt);
      if (state.reloadTimer <= 0) {
        const needed = Math.max(0, Math.min(weaponSpec.magSize - state.magAmmo, state.reserveAmmo));
        state.magAmmo += needed;
        state.reserveAmmo -= needed;
        state.isReloading = false;
      }
    }

    if (weaponSpec.fireMode === 'auto') {
      if (this.isTriggerHeld && !state.isReloading) {
        let guard = 0;
        while (this.fireCooldown <= 0 && state.magAmmo > 0 && guard++ < 8) this._fireRound(1.0);
      }
    } else if (weaponSpec.fireMode === 'spinup_auto') {
      if (this.isTriggerHeld && !state.isReloading && state.magAmmo > 0) {
        const spinSec = Math.max(0.05, Number(weaponSpec.spinupSec) || 0.6);
        this.spinupProgress = Math.min(1, this.spinupProgress + safeDt / spinSec);
        const barrels = this.controller?.minifigure?.operatorBarrelCluster || this.controller?.minifigure?.titaMinigunBarrelGroup;
        if (barrels) barrels.rotation.z += (12 + 34 * this.spinupProgress) * safeDt;
        if (this.spinupProgress >= 1) {
          this.fireCooldown = Math.min(this.fireCooldown, 0);
          let guard = 0;
          while (this.fireCooldown <= 0 && state.magAmmo > 0 && guard++ < 8) this._fireRound(1.0);
        }
      } else {
        this.spinupProgress = Math.max(0, this.spinupProgress - safeDt * 2.4);
      }
    } else if (weaponSpec.fireMode === 'charge') {
      if (this.isCharging && !state.isReloading && state.magAmmo > 0) {
        this.chargeTime = Math.min(Math.max(0.05, Number(weaponSpec.maxChargeSec) || 0.85), this.chargeTime + safeDt);
      } else if (state.isReloading || state.magAmmo <= 0) {
        this.isCharging = false;
        this.chargeTime = 0;
      }
    }

    if (this.fireCooldown < 0) this.fireCooldown = 0;
    if (state.magAmmo <= 0 && state.reserveAmmo > 0 && !state.isReloading && this.fireCooldown <= 0) {
      this.startReload();
    }
    this._syncWeaponHud(weaponSpec, state);
  }

  _alignActorToCrosshair() {
    const ctrl = this.controller;
    if (typeof ctrl?._alignCharacterToCrosshair === 'function') {
      ctrl._alignCharacterToCrosshair();
    } else if (ctrl?.camera?.getWorldDirection) {
      ctrl.camera.getWorldDirection(this._dirScratch);
      ctrl.facingAngle = Math.atan2(this._dirScratch.x, this._dirScratch.z);
      if (ctrl.minifigure?.root) ctrl.minifigure.root.rotation.y = ctrl.facingAngle;
    }
  }

  _fireRound(chargeRatio = 1.0) {
    const op = this.getActiveOperatorSpec();
    const weaponSpec = this.getActiveWeaponSpec();
    const state = op ? this._ensureOperatorState(op.key) : null;
    if (!op || !weaponSpec || !state || state.magAmmo <= 0) return false;

    state.magAmmo = Math.max(0, state.magAmmo - 1);
    this.fireCooldown = this.fireCooldown < 0
      ? this.fireCooldown + weaponSpec.fireIntervalSec
      : weaponSpec.fireIntervalSec;
    this.controller?.operatorAbilities?.notifyPrimaryWeaponFired?.();
    this._alignActorToCrosshair();
    this.controller?.minifigure?.triggerShoot?.();
    if (this.isScopedIn) this._scopeRecoilKick = 1.0;

    const pos = this.controller?.position || new THREE.Vector3();
    const angle = Number(this.controller?.facingAngle) || 0;
    let origin;
    if (this.isScopedIn && this.controller?.camera?.getWorldDirection) {
      this.controller.camera.getWorldDirection(this._dirScratch);
      origin = this._muzzleScratch.set(
        pos.x + this._dirScratch.x * 0.85, pos.y + 1.64 + this._dirScratch.y * 0.85, pos.z + this._dirScratch.z * 0.85
      );
    } else {
      origin = this._muzzleScratch.set(
        pos.x + Math.sin(angle) * 1.02 - Math.cos(angle) * 0.44, pos.y + 1.28, pos.z + Math.cos(angle) * 1.02 + Math.sin(angle) * 0.44
      );
    }
    this.controller?.world?.livingCity?.triggerPedestrianPanicNear?.(origin, 32);
    this.controller?.world?.livingCity?.wantedSystem?.notifyPlayerGunshot?.(origin);

    const destructibles = this.controller?.destructibles;
    const maxRange = Math.max((Number(weaponSpec.falloffEnd) || 65) + 40, this.isScopedIn ? 380 : 90);
    const aimData = (destructibles?.getAimTargetPoint && this.controller?.camera)
      ? destructibles.getAimTargetPoint(this.controller.camera, maxRange)
      : { point: new THREE.Vector3(pos.x + Math.sin(angle) * 25, pos.y + 1.28, pos.z + Math.cos(angle) * 25), hitObj: null, distance: 25 };

    let damage = computeWeaponShotDamage(weaponSpec, op.damageMultiplier, aimData.distance, chargeRatio);
    if ((aimData.hitObj?._signalMarkedTimer ?? 0) > 0) damage = Number((damage * 1.20).toFixed(4));
    this._spawnBallisticProjectiles(weaponSpec, origin, aimData.point, damage, chargeRatio);
    return true;
  }

  _spawnBallisticProjectiles(weaponSpec, origin, targetPoint, damage, chargeRatio) {
    const destructibles = this.controller?.destructibles;
    const wKey = weaponSpec.key;

    if (wKey === 'pcc_dmr') {
      if (typeof soundFX.playSniperBoltShot === 'function') soundFX.playSniperBoltShot();
      else soundFX.playRifleShot?.();
    } else if (wKey === 'pcc_shotgun12') {
      soundFX.playExplosion?.(0.55);
      soundFX.playRifleShot?.();
    } else if (wKey === 'ares_pulse_minigun') {
      soundFX.playMinigunShot?.();
    } else if (wKey === 'ares_charge_rifle') {
      soundFX.playLaserShot?.();
      if (chargeRatio >= 0.85) soundFX.playExplosion?.(0.35);
    } else {
      soundFX.playRifleShot?.();
    }

    if (!destructibles || !Array.isArray(destructibles.projectiles)) return;

    const mainDir = this._dirScratch.copy(targetPoint).sub(origin);
    if (mainDir.lengthSq() < 0.0001) mainDir.set(0, 0, 1);
    mainDir.normalize();

    if (wKey === 'cv_lmg' || wKey === 'cv_pistol' || wKey === 'pcc_dmr') {
      destructibles._spawnEjectedBrassShell?.(origin, false);
    } else if (wKey === 'pcc_shotgun12') {
      destructibles._spawnEjectedBrassShell?.(origin, true);
      for (let s = 0; s < 5; s++) {
        destructibles._spawnFxParticle?.(
          SMOKE_PUFF_GEO, s < 2 ? 0xf97316 : 0x475569, 0.78,
          origin.x + mainDir.x * 0.45, origin.y + mainDir.y * 0.45, origin.z + mainDir.z * 0.45,
          0.85, 0.85, 0.85, mainDir.x * 7, 1.8, mainDir.z * 7, 0.22
        );
      }
    }

    const spreadRad = computeEffectiveSpreadRad(weaponSpec, this.isAiming ? 1 : 0);
    const pelletCount = Math.max(1, Math.floor(Number(weaponSpec.pellets) || 1));
    const speed = Number(weaponSpec.projectileSpeed) || 75;
    const style = PROJ_STYLE_BY_WEAPON[wKey] || PROJ_STYLE_BY_WEAPON.cv_pistol;
    const canBreakCracked = wKey === 'ares_charge_rifle' && chargeRatio >= 0.85;

    for (let i = 0; i < pelletCount; i++) {
      const rx = (Math.random() - 0.5) * 2 * spreadRad;
      const ry = (Math.random() - 0.5) * 1.5 * spreadRad;
      const rz = (Math.random() - 0.5) * 2 * spreadRad;
      const shotDir = this._spreadScratch.set(mainDir.x + rx, mainDir.y + ry, mainDir.z + rz).normalize();

      const mesh = new THREE.Mesh(style.geo, style.mat);
      mesh.position.copy(origin);
      mesh.lookAt(origin.x + shotDir.x, origin.y + shotDir.y, origin.z + shotDir.z);
      destructibles.scene?.add?.(mesh);
      destructibles.projectiles.push({
        mesh,
        type: wKey === 'pcc_shotgun12' ? 'shotgun_pellet' : 'bullet',
        weaponKey: wKey,
        originPos: origin.clone(),
        vel: shotDir.clone().multiplyScalar(speed),
        life: style.life,
        damage,
        isSolar: false,
        canBreakCrackedWall: canBreakCracked,
        canBreakSilver: false,
        sourceIsPlayer: !this.controller?.isAiBot,
        isCloseShotgun: weaponSpec.key === 'pcc_shotgun12'
      });
    }

    if (wKey === 'ares_charge_rifle' && Array.isArray(destructibles.timedBeams)) {
      const beamMat = new THREE.MeshBasicMaterial({
        color: chargeRatio >= 0.85 ? 0xfaf5ff : 0xc084fc,
        transparent: true,
        opacity: 0.92
      });
      const beamMesh = new THREE.Mesh(LASER_BEAM_CYL_GEO, beamMat);
      const radius = 0.045 + chargeRatio * 0.085;
      beamMesh.position.copy(origin);
      beamMesh.lookAt(targetPoint);
      beamMesh.scale.set(radius, radius, Math.max(1.5, origin.distanceTo(targetPoint)));
      destructibles.scene?.add?.(beamMesh);
      destructibles.timedBeams.push({
        mesh: beamMesh,
        life: 0.18 + chargeRatio * 0.12,
        maxLife: 0.18 + chargeRatio * 0.12,
        materials: [{ mat: beamMat, baseOpacity: 0.92 }]
      });
    }
  }

  _syncWeaponHud(weaponSpec, state) {
    this.syncScopeState(weaponSpec, state);
    const hud = this.controller?.hud;
    if (!hud?.updateWeaponAmmoHud || !weaponSpec || !state) return;
    const reloadProgress = state.isReloading && state.reloadDuration > 0
      ? THREE.MathUtils.clamp(1 - state.reloadTimer / state.reloadDuration, 0, 1)
      : 0;
    const rawCharge = weaponSpec.fireMode === 'charge' && this.isCharging
      ? THREE.MathUtils.clamp(this.chargeTime / Math.max(0.01, weaponSpec.maxChargeSec || 0.85), 0, 1)
      : 0;
    hud.updateWeaponAmmoHud({
      inMag: state.magAmmo,
      currentMag: state.magAmmo,
      magSize: weaponSpec.magSize,
      reserve: state.reserveAmmo,
      reserveAmmo: state.reserveAmmo,
      isReloading: state.isReloading,
      reloadProgress,
      showAmmo: true,
      isEnergyInfinite: false,
      chargeRatio: weaponSpec.fireMode === 'spinup_auto' ? this.spinupProgress : rawCharge,
      spinupRatio: this.spinupProgress,
      weaponKey: weaponSpec.key
    });
  }
}
