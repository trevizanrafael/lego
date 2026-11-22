/**
 * RoleBaselines.js
 *
 * Actor-agnostic tactical role definitions (Tank, Damage, Support),
 * 2-role hybrid blending rules, trinity coverage validation, and incoming
 * damage mitigation math shared by player operators and AI operator bots.
 */

export const TACTICAL_ROLE_KEYS = Object.freeze(['tank', 'damage', 'support']);

export const MAX_DAMAGE_REDUCTION = 0.65;

const ROLE_SORT_PRIORITY = Object.freeze({
  tank: 0,
  damage: 1,
  support: 2
});

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
 * Pure single-role tactical baselines.
 */
export const ROLE_BASELINES = freezeDeep({
  tank: {
    id: 'tank',
    label: { 'pt-BR': 'Tanque', 'en-US': 'Tank' },
    baseHp: 420,
    damageReduction: 0.30,
    baseSpeedMult: 0.85,
    baseDamageMult: 0.75
  },
  damage: {
    id: 'damage',
    label: { 'pt-BR': 'Dano', 'en-US': 'Damage' },
    baseHp: 210,
    damageReduction: 0.0,
    baseSpeedMult: 1.05,
    baseDamageMult: 1.15
  },
  support: {
    id: 'support',
    label: { 'pt-BR': 'Suporte', 'en-US': 'Support' },
    baseHp: 240,
    damageReduction: 0.0,
    baseSpeedMult: 1.00,
    baseDamageMult: 0.55
  }
});

/**
 * Curated 2-role hybrid baselines for primary faction operators:
 * - tank+damage (CV Marretão)     -> damageReduction 0.20, 'Tanque-Dano' / 'Tank-Damage'
 * - damage+support (PCC Contador) -> damageReduction 0.05, 'Dano-Suporte' / 'Damage-Support'
 * - tank+support (ARES Bastião-7) -> damageReduction 0.25, 'Tanque-Suporte' / 'Tank-Support'
 */
export const HYBRID_ROLE_BASELINES = freezeDeep({
  'tank+damage': {
    id: 'tank+damage',
    roles: ['tank', 'damage'],
    isHybrid: true,
    label: { 'pt-BR': 'Tanque-Dano', 'en-US': 'Tank-Damage' },
    baseHp: 380,
    damageReduction: 0.20,
    baseSpeedMult: 0.88,
    baseDamageMult: 1.00
  },
  'damage+support': {
    id: 'damage+support',
    roles: ['damage', 'support'],
    isHybrid: true,
    label: { 'pt-BR': 'Dano-Suporte', 'en-US': 'Damage-Support' },
    baseHp: 260,
    damageReduction: 0.05,
    baseSpeedMult: 1.00,
    baseDamageMult: 0.90
  },
  'tank+support': {
    id: 'tank+support',
    roles: ['tank', 'support'],
    isHybrid: true,
    label: { 'pt-BR': 'Tanque-Suporte', 'en-US': 'Tank-Support' },
    baseHp: 400,
    damageReduction: 0.25,
    baseSpeedMult: 0.85,
    baseDamageMult: 0.70
  }
});

/**
 * Checks whether a value is one of the 3 official tactical role keys.
 */
export function isValidRoleKey(roleKey) {
  return typeof roleKey === 'string' && Object.prototype.hasOwnProperty.call(ROLE_BASELINES, roleKey);
}

/**
 * Sanitizes, deduplicates, and canonically orders a role list (tank -> damage -> support).
 * Falls back to ['damage'] when no valid role is supplied.
 */
export function normalizeRoleList(roles = ['damage']) {
  const rawList = Array.isArray(roles) ? roles : [roles];
  const unique = [];
  for (const item of rawList) {
    if (isValidRoleKey(item) && !unique.includes(item)) {
      unique.push(item);
    }
  }
  if (unique.length === 0) {
    return ['damage'];
  }
  unique.sort((a, b) => ROLE_SORT_PRIORITY[a] - ROLE_SORT_PRIORITY[b]);
  return unique;
}

/**
 * Blends 1 or 2 tactical roles into a unified baseline descriptor.
 * - Single-role input returns that exact role's baseline from ROLE_BASELINES.
 * - 2-role hybrid input returns the curated hybrid baseline with combined PT-BR/EN-US title.
 */
export function blendRoleBaselines(roles = ['damage']) {
  const normalized = normalizeRoleList(roles);
  if (normalized.length === 1) {
    return ROLE_BASELINES[normalized[0]];
  }

  const pairKey = `${normalized[0]}+${normalized[1]}`;
  if (HYBRID_ROLE_BASELINES[pairKey]) {
    return HYBRID_ROLE_BASELINES[pairKey];
  }

  // Fallback for a full 3-role union
  const items = normalized.map((r) => ROLE_BASELINES[r]);
  const count = items.length;
  const avgHp = Math.round(items.reduce((acc, r) => acc + r.baseHp, 0) / count);
  const avgRed = Number(
    Math.min(MAX_DAMAGE_REDUCTION, items.reduce((acc, r) => acc + r.damageReduction, 0) / count).toFixed(2)
  );
  const avgSpeed = Number((items.reduce((acc, r) => acc + r.baseSpeedMult, 0) / count).toFixed(2));
  const avgDamage = Number((items.reduce((acc, r) => acc + r.baseDamageMult, 0) / count).toFixed(2));

  return freezeDeep({
    id: normalized.join('+'),
    roles: normalized,
    isHybrid: true,
    label: {
      'pt-BR': items.map((r) => r.label['pt-BR']).join('-'),
      'en-US': items.map((r) => r.label['en-US']).join('-')
    },
    baseHp: avgHp,
    damageReduction: avgRed,
    baseSpeedMult: avgSpeed,
    baseDamageMult: avgDamage
  });
}

/**
 * Formats localized role title ('Tanque', 'Tanque-Dano', 'Damage-Support', etc.).
 */
export function formatRoleTitle(roles = ['damage'], lang = 'pt-BR') {
  const blended = blendRoleBaselines(roles);
  const locale = lang === 'en-US' ? 'en-US' : 'pt-BR';
  return blended.label[locale];
}

/**
 * Verifies whether a collection of role arrays covers all 3 tactical roles
 * ('tank', 'damage', 'support') with zero missing roles.
 */
export function doesRoleUnionCoverAllRoles(roleLists = []) {
  const covered = new Set();
  for (const list of roleLists) {
    if (!Array.isArray(list)) continue;
    for (const r of list) {
      if (isValidRoleKey(r)) covered.add(r);
    }
  }
  return TACTICAL_ROLE_KEYS.every((roleKey) => covered.has(roleKey));
}

/**
 * Applies incoming damage mitigation clamped to [0, 0.65].
 * Guarantees at least 1 damage whenever rawDamage > 0.
 */
export function applyIncomingDamageMitigation(rawDamage, damageReduction = 0) {
  const numericRaw = Number(rawDamage);
  if (!Number.isFinite(numericRaw) || numericRaw <= 0) {
    return 0;
  }
  const numericRed = Number(damageReduction);
  const clampedRed = Number.isFinite(numericRed)
    ? Math.min(MAX_DAMAGE_REDUCTION, Math.max(0, numericRed))
    : 0;
  return Math.max(1, Math.round(numericRaw * (1 - clampedRed)));
}
