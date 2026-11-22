/**
 * WeaponCatalog.js
 *
 * Actor-agnostic catalog of the 6 faction operator primary firearms and pure
 * ballistic damage / distance falloff / charge scaling math.
 * Ready for both player combat and Deadlock-style AI operator bots.
 */

export const CAVEIRA_RIFLE_BASELINE_DAMAGE = 14;
export const CAVEIRA_RIFLE_BASELINE_INTERVAL_SEC = 0.11;

function freezeDeep(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  for (const key of Object.keys(obj)) {
    freezeDeep(obj[key]);
  }
  return Object.freeze(obj);
}

/**
 * Frozen dictionary of the 6 faction operator primary weapons.
 * Baseline reference: Comandante Caveira rifle deals 14 damage every 0.11s (100%).
 */
export const OPERATOR_WEAPONS = freezeDeep({
  cv_lmg: {
    key: 'cv_lmg',
    id: 'cv_lmg',
    faction: 'cv',
    ownerKey: 'cv_marretao',
    name: {
      'pt-BR': 'Metralhadora Pesada',
      'en-US': 'Heavy LMG'
    },
    fireMode: 'auto',
    baseDamage: 14,
    fireIntervalSec: 0.085,
    magSize: 65,
    reserveMax: 260,
    reloadSec: 2.8,
    spreadRad: 0.032,
    aimSpreadScale: 0.45,
    aimFov: 50,
    firingMoveSpeedScale: 0.62,
    falloffStart: 28,
    falloffEnd: 68,
    minFalloffMult: 0.55,
    projectileType: 'heavy_bullet',
    projectileSpeed: 76,
    pellets: 1,
    soundKey: 'lmg'
  },

  cv_pistol: {
    key: 'cv_pistol',
    id: 'cv_pistol',
    faction: 'cv',
    ownerKey: 'cv_fogueteira',
    name: {
      'pt-BR': 'Pistola Semiautomática',
      'en-US': 'Semi-Auto Pistol'
    },
    fireMode: 'semi',
    baseDamage: 15,
    fireIntervalSec: 0.20,
    magSize: 15,
    reserveMax: 90,
    reloadSec: 1.3,
    spreadRad: 0.014,
    aimSpreadScale: 0.35,
    aimFov: 52,
    firingMoveSpeedScale: 0.95,
    falloffStart: 22,
    falloffEnd: 52,
    minFalloffMult: 0.5,
    projectileType: 'pistol_bullet',
    projectileSpeed: 70,
    pellets: 1,
    soundKey: 'pistol'
  },

  pcc_dmr: {
    key: 'pcc_dmr',
    id: 'pcc_dmr',
    faction: 'pcc',
    ownerKey: 'pcc_contador',
    name: {
      'pt-BR': 'Fuzil de Precisão',
      'en-US': 'Marksman DMR'
    },
    fireMode: 'semi',
    baseDamage: 32,
    fireIntervalSec: 0.30,
    magSize: 18,
    reserveMax: 108,
    reloadSec: 1.8,
    spreadRad: 0.006,
    aimSpreadScale: 0.18,
    aimFov: 42,
    firingMoveSpeedScale: 0.85,
    falloffStart: 48,
    falloffEnd: 95,
    minFalloffMult: 0.78,
    projectileType: 'dmr_bullet',
    projectileSpeed: 96,
    pellets: 1,
    soundKey: 'dmr'
  },

  pcc_shotgun12: {
    key: 'pcc_shotgun12',
    id: 'pcc_shotgun12',
    faction: 'pcc',
    ownerKey: 'pcc_muralha',
    name: {
      'pt-BR': 'Escopeta 12',
      'en-US': '12-Gauge Shotgun'
    },
    fireMode: 'semi',
    baseDamage: 7,
    pellets: 8,
    fireIntervalSec: 0.68,
    magSize: 8,
    reserveMax: 48,
    reloadSec: 2.2,
    spreadRad: 0.088,
    aimSpreadScale: 0.65,
    aimFov: 52,
    firingMoveSpeedScale: 0.88,
    falloffStart: 8,
    falloffEnd: 24,
    minFalloffMult: 0.22,
    projectileType: 'buckshot',
    projectileSpeed: 64,
    soundKey: 'shotgun'
  },

  ares_pulse_minigun: {
    key: 'ares_pulse_minigun',
    id: 'ares_pulse_minigun',
    faction: 'ares',
    ownerKey: 'ares_bastiao',
    name: {
      'pt-BR': 'Minigun de Pulso',
      'en-US': 'Pulse Minigun'
    },
    fireMode: 'spinup_auto',
    spinupSec: 0.6,
    baseDamage: 12,
    fireIntervalSec: 0.068,
    magSize: 80,
    reserveMax: 320,
    reloadSec: 2.6,
    spreadRad: 0.028,
    aimSpreadScale: 0.5,
    aimFov: 51,
    firingMoveSpeedScale: 0.66,
    falloffStart: 26,
    falloffEnd: 64,
    minFalloffMult: 0.6,
    projectileType: 'pulse_bolt',
    projectileSpeed: 82,
    pellets: 1,
    soundKey: 'pulse_minigun'
  },

  ares_charge_rifle: {
    key: 'ares_charge_rifle',
    id: 'ares_charge_rifle',
    faction: 'ares',
    ownerKey: 'ares_agulha',
    name: {
      'pt-BR': 'Rifle Laser de Carga',
      'en-US': 'Charge Laser Rifle'
    },
    fireMode: 'charge',
    maxChargeSec: 0.85,
    minChargeMult: 0.42,
    fullChargeMult: 2.35,
    baseDamage: 28,
    fireIntervalSec: 0.55,
    magSize: 8,
    reserveMax: 48,
    reloadSec: 1.9,
    spreadRad: 0.002,
    aimSpreadScale: 0.1,
    aimFov: 36,
    firingMoveSpeedScale: 0.82,
    falloffStart: 70,
    falloffEnd: 130,
    minFalloffMult: 0.88,
    projectileType: 'laser_beam',
    projectileSpeed: 135,
    pellets: 1,
    soundKey: 'charge_laser'
  }
});

export const OPERATOR_WEAPON_KEYS = Object.freeze(Object.keys(OPERATOR_WEAPONS));

/**
 * Resolves a weapon key string or weapon spec object to a valid spec (or null).
 */
export function getWeaponSpec(weaponKeyOrSpec) {
  if (!weaponKeyOrSpec) return null;
  if (typeof weaponKeyOrSpec === 'string') {
    return Object.prototype.hasOwnProperty.call(OPERATOR_WEAPONS, weaponKeyOrSpec)
      ? OPERATOR_WEAPONS[weaponKeyOrSpec]
      : null;
  }
  if (typeof weaponKeyOrSpec === 'object' && typeof weaponKeyOrSpec.baseDamage === 'number') {
    return weaponKeyOrSpec;
  }
  return null;
}

/**
 * Computes linear distance falloff multiplier in [minFalloffMult, 1.0].
 */
export function computeDistanceFalloffMultiplier(weaponKeyOrSpec, distanceMeters = 10) {
  const spec = getWeaponSpec(weaponKeyOrSpec);
  if (!spec) return 1.0;

  const dist = Number.isFinite(Number(distanceMeters)) ? Math.max(0, Number(distanceMeters)) : 0;
  const start = Number(spec.falloffStart) || 0;
  const end = Number(spec.falloffEnd) || start;
  const minMult = Number.isFinite(Number(spec.minFalloffMult)) ? Number(spec.minFalloffMult) : 1.0;

  if (dist <= start || end <= start) {
    return 1.0;
  }
  if (dist >= end) {
    return minMult;
  }
  const t = (dist - start) / (end - start);
  return 1.0 + (minMult - 1.0) * t;
}

/**
 * Computes charge multiplier for 'charge' fireMode weapons (1.0 for all other modes).
 */
export function computeChargeDamageMultiplier(weaponKeyOrSpec, chargeRatio = 1.0) {
  const spec = getWeaponSpec(weaponKeyOrSpec);
  if (!spec || spec.fireMode !== 'charge') {
    return 1.0;
  }
  const ratio = Number.isFinite(Number(chargeRatio))
    ? Math.min(1, Math.max(0, Number(chargeRatio)))
    : 1.0;
  const minCharge = Number.isFinite(Number(spec.minChargeMult)) ? Number(spec.minChargeMult) : 1.0;
  const fullCharge = Number.isFinite(Number(spec.fullChargeMult)) ? Number(spec.fullChargeMult) : 1.0;
  return minCharge + (fullCharge - minCharge) * ratio;
}

/**
 * Computes per-projectile shot damage with operator multiplier, linear distance falloff
 * between falloffStart..falloffEnd, and charge scaling for 'charge' weapons.
 * Note: for multi-pellet weapons (pcc_shotgun12), baseDamage is per-pellet (7),
 * so 8 pellets * 7 * 0.75 = 42 close-range burst damage (see computeWeaponBurstDamage).
 */
export function computeWeaponShotDamage(
  weaponKeyOrSpec,
  operatorDamageMult = 1.0,
  distanceMeters = 10,
  chargeRatio = 1.0
) {
  const spec = getWeaponSpec(weaponKeyOrSpec);
  if (!spec) return 0;

  const opMult = Number.isFinite(Number(operatorDamageMult))
    ? Math.max(0, Number(operatorDamageMult))
    : 1.0;
  const falloffMult = computeDistanceFalloffMultiplier(spec, distanceMeters);
  const chargeMult = computeChargeDamageMultiplier(spec, chargeRatio);
  const raw = spec.baseDamage * opMult * falloffMult * chargeMult;
  return Number(raw.toFixed(4));
}

/**
 * Computes full trigger-pull burst damage when all pellets connect (shotDamage * pellets).
 */
export function computeWeaponBurstDamage(
  weaponKeyOrSpec,
  operatorDamageMult = 1.0,
  distanceMeters = 10,
  chargeRatio = 1.0
) {
  const spec = getWeaponSpec(weaponKeyOrSpec);
  if (!spec) return 0;
  const pellets = Math.max(1, Math.floor(Number(spec.pellets) || 1));
  const perProjectile = computeWeaponShotDamage(spec, operatorDamageMult, distanceMeters, chargeRatio);
  return Number((perProjectile * pellets).toFixed(4));
}

/**
 * Computes effective weapon spread in radians given current ADS (aiming) ratio [0..1].
 */
export function computeEffectiveSpreadRad(weaponKeyOrSpec, aimRatio = 0) {
  const spec = getWeaponSpec(weaponKeyOrSpec);
  if (!spec) return 0;
  const clampedAim = Number.isFinite(Number(aimRatio))
    ? Math.min(1, Math.max(0, Number(aimRatio)))
    : 0;
  const scale = 1.0 + ((spec.aimSpreadScale ?? 1.0) - 1.0) * clampedAim;
  return Number((spec.spreadRad * scale).toFixed(6));
}
