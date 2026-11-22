import * as THREE from 'three';

export const HUMANOID_HIT_ZONES = Object.freeze({
  HEAD: 'head',
  TORSO: 'torso',
  LIMBS: 'limbs'
});

/**
 * Determina se o disparo atual deve receber tratamento de arma de precisão
 * (Sniper DMR `pcc_dmr` ou Rifle de Carga `ares_charge_rifle` carregado >= 75%).
 */
export function isPrecisionShot(damageOpts = {}) {
  if (damageOpts?.weaponKey === 'ares_charge_rifle') {
    return (damageOpts?.chargeRatio ?? 1) >= 0.75;
  }
  return Boolean(damageOpts?.isPrecisionWeapon || damageOpts?.weaponKey === 'pcc_dmr');
}

/**
 * Verifica se o NPC humanoide utiliza capacete balístico blindado (Choque/BOPE/Exo/Tanque/Chefe).
 */
export function hasArmoredBallisticHelmet(obj) {
  return Boolean(
    obj?.hasArmoredHelmet ||
    obj?.isBossNpc ||
    obj?.isTankNpc ||
    obj?.unitType === 'riot' ||
    obj?.unitType === 'bope' ||
    obj?.policeKind === 'riot' ||
    obj?.policeKind === 'bope' ||
    obj?.soldierClass === 'exo' ||
    obj?.soldierClass === 'heavy'
  );
}

/**
 * Calcula a altura efetiva em metros do NPC sem duplicar `unitScale` caso `obj.height`
 * já represente a estatura escalada (ex.: Big-Figs / Chefes com 3.4m–4.2m).
 */
export function getEffectiveHumanoidHeight(obj) {
  const rawHeight = Number(obj?.height) > 0 ? Number(obj.height) : 2.1;
  const unitScale = Number(obj?.unitScale) > 0 ? Number(obj.unitScale) : 1.0;
  if (unitScale > 1.0 && rawHeight < 1.95 * unitScale) {
    return rawHeight * unitScale;
  }
  return rawHeight;
}

function buildHeadZoneResult(obj, relY, isPrecision) {
  if (obj?.isBossNpc) {
    return {
      zone: HUMANOID_HIT_ZONES.HEAD,
      isHeadshot: true,
      isLimb: false,
      relY,
      multiplier: 1.8,
      helmetReduced: true,
      isPrecision
    };
  }
  const hasHelmet = hasArmoredBallisticHelmet(obj);
  if (hasHelmet) {
    return {
      zone: HUMANOID_HIT_ZONES.HEAD,
      isHeadshot: true,
      isLimb: false,
      relY,
      multiplier: isPrecision ? 2.6 : 2.0,
      helmetReduced: true,
      isPrecision
    };
  }
  return {
    zone: HUMANOID_HIT_ZONES.HEAD,
    isHeadshot: true,
    isLimb: false,
    relY,
    multiplier: isPrecision ? 4.0 : 3.0,
    helmetReduced: false,
    isPrecision
  };
}

/**
 * Normaliza a altura do ponto de impacto no humanoide (`[0..1.25]`) e resolve
 * a zona anatômica (`head` >= 0.76, `torso` 0.40..0.76, `limbs` < 0.40) e seu multiplicador.
 */
export function resolveHumanoidHitZone(obj, hitOriginOrPoint, damageOpts = {}) {
  const isPrecision = isPrecisionShot(damageOpts);

  if (damageOpts?.isExplosion || damageOpts?.isAreaDamage) {
    return {
      zone: HUMANOID_HIT_ZONES.TORSO,
      isHeadshot: false,
      isLimb: false,
      relY: 0.58,
      multiplier: 1.0,
      helmetReduced: false,
      isPrecision: false
    };
  }

  const explicitZone = damageOpts?.hitZone;
  if (explicitZone === 'head') {
    return buildHeadZoneResult(obj, 0.88, isPrecision);
  }
  if (explicitZone === 'torso') {
    return {
      zone: HUMANOID_HIT_ZONES.TORSO,
      isHeadshot: false,
      isLimb: false,
      relY: 0.58,
      multiplier: 1.0,
      helmetReduced: false,
      isPrecision
    };
  }
  if (explicitZone === 'limbs' || explicitZone === 'limb') {
    return {
      zone: HUMANOID_HIT_ZONES.LIMBS,
      isHeadshot: false,
      isLimb: true,
      relY: 0.20,
      multiplier: 0.65,
      helmetReduced: false,
      isPrecision
    };
  }

  const hitPoint = hitOriginOrPoint;
  if (!hitPoint || !Number.isFinite(Number(hitPoint.y))) {
    return {
      zone: HUMANOID_HIT_ZONES.TORSO,
      isHeadshot: false,
      isLimb: false,
      relY: 0.58,
      multiplier: 1.0,
      helmetReduced: false,
      isPrecision
    };
  }

  const ox = obj?._isDynamicIndexed
    ? (obj.mesh?.position?.x ?? obj.basePos?.x ?? 0)
    : (obj?.basePos?.x ?? obj?.mesh?.position?.x ?? 0);
  const baseY = obj?._isDynamicIndexed
    ? (obj.mesh?.position?.y ?? obj.basePos?.y ?? 0)
    : (obj?.basePos?.y ?? obj?.mesh?.position?.y ?? 0);
  const oz = obj?._isDynamicIndexed
    ? (obj.mesh?.position?.z ?? obj.basePos?.z ?? 0)
    : (obj?.basePos?.z ?? obj?.mesh?.position?.z ?? 0);

  if (Number.isFinite(Number(hitPoint.x)) && Number.isFinite(Number(hitPoint.z))) {
    const horizDist = Math.hypot(Number(hitPoint.x) - ox, Number(hitPoint.z) - oz);
    if (horizDist > (Number(obj?.radius) || 0.8) + 1.8) {
      return {
        zone: HUMANOID_HIT_ZONES.TORSO,
        isHeadshot: false,
        isLimb: false,
        relY: 0.58,
        multiplier: 1.0,
        helmetReduced: false,
        isPrecision
      };
    }
  }

  const effectiveHeight = getEffectiveHumanoidHeight(obj);
  const relY = THREE.MathUtils.clamp((Number(hitPoint.y) - baseY) / effectiveHeight, 0, 1.25);

  if (relY >= 0.76) {
    return buildHeadZoneResult(obj, relY, isPrecision);
  }
  if (relY >= 0.40) {
    return {
      zone: HUMANOID_HIT_ZONES.TORSO,
      isHeadshot: false,
      isLimb: false,
      relY,
      multiplier: 1.0,
      helmetReduced: false,
      isPrecision
    };
  }
  return {
    zone: HUMANOID_HIT_ZONES.LIMBS,
    isHeadshot: false,
    isLimb: true,
    relY,
    multiplier: 0.65,
    helmetReduced: false,
    isPrecision
  };
}
