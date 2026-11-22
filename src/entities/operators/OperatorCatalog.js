/**
 * OperatorCatalog.js
 *
 * Official catalog of the 6 playable Faction Operators (2 per faction: 1 hybrid
 * primary + 1 pure secondary covering Tank + Damage + Support per faction) and
 * actor-agnostic combatant stat sheet resolution for players and AI bots.
 */

import { blendRoleBaselines } from './RoleBaselines.js';
import { OPERATOR_WEAPONS } from './WeaponCatalog.js';

export const VALID_FACTIONS = Object.freeze(['cv', 'pcc', 'ares']);

function freezeDeep(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  for (const key of Object.keys(obj)) {
    freezeDeep(obj[key]);
  }
  return Object.freeze(obj);
}

export function normalizeFactionKey(factionKey = 'cv') {
  return VALID_FACTIONS.includes(factionKey) ? factionKey : 'cv';
}

/**
 * Frozen map of all 6 faction operators.
 * Each faction has:
 * - slotOrder 1: 2-role hybrid primary operator (default spawn/fallback)
 * - slotOrder 2: 1-role pure secondary operator (completes the 3-role trinity)
 */
export const FACTION_OPERATORS = freezeDeep({
  cv_marretao: {
    key: 'cv_marretao',
    id: 'cv_marretao',
    faction: 'cv',
    slotOrder: 1,
    isHybrid: true,
    roles: ['tank', 'damage'],
    roleLabel: blendRoleBaselines(['tank', 'damage']).label,
    name: 'MARRETÃO',
    displayName: { 'pt-BR': 'MARRETÃO', 'en-US': 'MARRETÃO' },
    codename: { 'pt-BR': 'Artilheiro de Contenção', 'en-US': 'Heavy Breacher' },
    hp: 380,
    damageMultiplier: 1.00,
    speedMultiplier: 0.88,
    damageReduction: 0.20,
    weaponKey: 'cv_lmg',
    extraPrice: 400000,
    visualPreset: 'cv_marretao',
    abilities: {
      q: {
        id: 'cv_barricade',
        icon: 'barricade',
        cooldownSec: 15,
        name: { 'pt-BR': 'Barricada', 'en-US': 'Barricade' },
        desc: {
          'pt-BR': 'Ergue cobertura balística reforçada à frente para segurar avanço hostil.',
          'en-US': 'Deploys reinforced ballistic cover ahead to hold off hostile advances.'
        }
      },
      e: {
        id: 'cv_rpg_shot',
        icon: 'rocket',
        cooldownSec: 20,
        name: { 'pt-BR': 'Bazuca RPG', 'en-US': 'RPG Launcher' },
        desc: {
          'pt-BR': 'Dispara foguete anticarro de alto impacto contra veículos e fortificações.',
          'en-US': 'Fires a high-impact anti-armor rocket against vehicles and fortifications.'
        }
      }
    }
  },

  cv_fogueteira: {
    key: 'cv_fogueteira',
    id: 'cv_fogueteira',
    faction: 'cv',
    slotOrder: 2,
    isHybrid: false,
    roles: ['support'],
    roleLabel: blendRoleBaselines(['support']).label,
    name: 'FOGUETEIRA',
    displayName: { 'pt-BR': 'FOGUETEIRA', 'en-US': 'FOGUETEIRA' },
    codename: { 'pt-BR': 'Sinalizadora de Campo', 'en-US': 'Field Spotter' },
    hp: 240,
    damageMultiplier: 0.55,
    speedMultiplier: 1.00,
    damageReduction: 0.0,
    weaponKey: 'cv_pistol',
    extraPrice: 400000,
    visualPreset: 'cv_fogueteira',
    abilities: {
      q: {
        id: 'cv_medkit',
        icon: 'cross',
        cooldownSec: 14,
        name: { 'pt-BR': 'Kit de Socorro', 'en-US': 'Medkit' },
        desc: {
          'pt-BR': 'Lança bolsa de trauma que restaura vida própria e de aliados próximos.',
          'en-US': 'Throws a trauma kit restoring health to self and nearby allies.'
        }
      },
      e: {
        id: 'cv_signal_fireworks',
        icon: 'flare',
        cooldownSec: 16,
        name: { 'pt-BR': 'Fogos de Alerta', 'en-US': 'Signal Fireworks' },
        desc: {
          'pt-BR': 'Dispara bateria de rojões que marca alvos e impulsiona aliados na área.',
          'en-US': 'Launches signal fireworks marking hostiles and rallying nearby allies.'
        }
      }
    }
  },

  pcc_contador: {
    key: 'pcc_contador',
    id: 'pcc_contador',
    faction: 'pcc',
    slotOrder: 1,
    isHybrid: true,
    roles: ['damage', 'support'],
    roleLabel: blendRoleBaselines(['damage', 'support']).label,
    name: 'CONTADOR',
    displayName: { 'pt-BR': 'CONTADOR', 'en-US': 'CONTADOR' },
    codename: { 'pt-BR': 'Estrategista Balístico', 'en-US': 'Tactical Quartermaster' },
    hp: 260,
    damageMultiplier: 0.90,
    speedMultiplier: 1.00,
    damageReduction: 0.05,
    weaponKey: 'pcc_dmr',
    extraPrice: 400000,
    visualPreset: 'pcc_contador',
    abilities: {
      q: {
        id: 'pcc_supply_crate',
        icon: 'crate',
        cooldownSec: 16,
        name: { 'pt-BR': 'Caixa de Suprimento', 'en-US': 'Supply Crate' },
        desc: {
          'pt-BR': 'Posiciona malote logístico que reabastece munição e recupera vigor.',
          'en-US': 'Deploys a logistics crate replenishing ammunition and vitality.'
        }
      },
      e: {
        id: 'pcc_remote_c4',
        icon: 'c4',
        cooldownSec: 12,
        name: { 'pt-BR': 'C4 Remota', 'en-US': 'Remote C4' },
        desc: {
          'pt-BR': 'Arremessa carga plástica remota letal contra blindados e cofres.',
          'en-US': 'Throws a remote-detonated plastic charge lethal to armor and vaults.'
        }
      }
    }
  },

  pcc_muralha: {
    key: 'pcc_muralha',
    id: 'pcc_muralha',
    faction: 'pcc',
    slotOrder: 2,
    isHybrid: false,
    roles: ['tank'],
    roleLabel: blendRoleBaselines(['tank']).label,
    name: 'MURALHA',
    displayName: { 'pt-BR': 'MURALHA', 'en-US': 'MURALHA' },
    codename: { 'pt-BR': 'Vanguarda Blindada', 'en-US': 'Armored Vanguard' },
    hp: 420,
    damageMultiplier: 0.75,
    speedMultiplier: 0.85,
    damageReduction: 0.30,
    weaponKey: 'pcc_shotgun12',
    extraPrice: 400000,
    visualPreset: 'pcc_muralha',
    abilities: {
      q: {
        id: 'pcc_ballistic_shield',
        icon: 'shield',
        cooldownSec: 14,
        name: { 'pt-BR': 'Escudo Balístico', 'en-US': 'Ballistic Shield' },
        desc: {
          'pt-BR': 'Ergue escudo frontal pesado que absorve rajadas inimigas.',
          'en-US': 'Raises a heavy frontal shield absorbing incoming enemy fire.'
        }
      },
      e: {
        id: 'pcc_shield_charge',
        icon: 'charge',
        cooldownSec: 12,
        name: { 'pt-BR': 'Investida', 'en-US': 'Shield Charge' },
        desc: {
          'pt-BR': 'Avança em carga blindada atropelando alvos e rompendo linhas.',
          'en-US': 'Charges forward with the shield, knocking down targets and breaching lines.'
        }
      }
    }
  },

  ares_bastiao: {
    key: 'ares_bastiao',
    id: 'ares_bastiao',
    faction: 'ares',
    slotOrder: 1,
    isHybrid: true,
    roles: ['tank', 'support'],
    roleLabel: blendRoleBaselines(['tank', 'support']).label,
    name: 'BASTIÃO-7',
    displayName: { 'pt-BR': 'BASTIÃO-7', 'en-US': 'BASTIÃO-7' },
    codename: { 'pt-BR': 'Unidade Exo-Guardiã', 'en-US': 'Exo-Guardian Unit' },
    hp: 400,
    damageMultiplier: 0.70,
    speedMultiplier: 0.85,
    damageReduction: 0.25,
    weaponKey: 'ares_pulse_minigun',
    extraPrice: 400000,
    visualPreset: 'ares_bastiao',
    abilities: {
      q: {
        id: 'ares_energy_dome',
        icon: 'dome',
        cooldownSec: 18,
        name: { 'pt-BR': 'Domo de Energia', 'en-US': 'Energy Dome' },
        desc: {
          'pt-BR': 'Projeta cúpula defletora hexagonal que intercepta projéteis externos.',
          'en-US': 'Projects a hexagonal deflector dome intercepting incoming projectiles.'
        }
      },
      e: {
        id: 'ares_med_drone',
        icon: 'drone',
        cooldownSec: 16,
        name: { 'pt-BR': 'Drone Médico', 'en-US': 'Med Drone' },
        desc: {
          'pt-BR': 'Despacha drone autônomo que regenera integridade tática em área.',
          'en-US': 'Deploys an autonomous repair drone regenerating squad health in an area.'
        }
      }
    }
  },

  ares_agulha: {
    key: 'ares_agulha',
    id: 'ares_agulha',
    faction: 'ares',
    slotOrder: 2,
    isHybrid: false,
    roles: ['damage'],
    roleLabel: blendRoleBaselines(['damage']).label,
    name: 'AGULHA',
    displayName: { 'pt-BR': 'AGULHA', 'en-US': 'AGULHA' },
    codename: { 'pt-BR': 'Atiradora Cibernética', 'en-US': 'Cybernetic Sharpshooter' },
    hp: 200,
    damageMultiplier: 1.20,
    speedMultiplier: 1.05,
    damageReduction: 0.0,
    weaponKey: 'ares_charge_rifle',
    extraPrice: 400000,
    visualPreset: 'ares_agulha',
    abilities: {
      q: {
        id: 'ares_optic_camo',
        icon: 'eye_off',
        cooldownSec: 14,
        name: { 'pt-BR': 'Camuflagem Óptica', 'en-US': 'Optic Camo' },
        desc: {
          'pt-BR': 'Ativa manto refrativo furtivo para flanquear sem ser rastreada.',
          'en-US': 'Activates refractive stealth cloaking to flank undetected.'
        }
      },
      e: {
        id: 'ares_emp_grenade',
        icon: 'pulse',
        cooldownSec: 13,
        name: { 'pt-BR': 'Granada de Pulso', 'en-US': 'Pulse Grenade' },
        desc: {
          'pt-BR': 'Detona pulso eletromagnético que sobrecarrega escudos e torres.',
          'en-US': 'Detonates an EMP blast overloading shields and electronics.'
        }
      }
    }
  }
});

export const OPERATOR_KEYS_LIST = Object.freeze(Object.keys(FACTION_OPERATORS));

const DEFAULT_HYBRID_BY_FACTION = Object.freeze({
  cv: 'cv_marretao',
  pcc: 'pcc_contador',
  ares: 'ares_bastiao'
});

const NON_OPERATOR_COMBATANT_DEFAULTS = freezeDeep({
  caveira: { name: 'COMANDANTE CAVEIRA', roles: ['damage', 'support'], hp: 260, damageMultiplier: 1.0, speedMultiplier: 1.0, damageReduction: 0.10, category: 'classic_hero', originFaction: null },
  solaris: { name: 'SOLARIS', roles: ['damage'], hp: 280, damageMultiplier: 1.15, speedMultiplier: 1.08, damageReduction: 0.10, category: 'classic_hero', originFaction: null },
  tita: { name: 'TITÃ BLINDADO', roles: ['tank'], hp: 500, damageMultiplier: 1.05, speedMultiplier: 0.86, damageReduction: 0.35, category: 'classic_hero', originFaction: null, isBigFig: true },
  vingador: { name: 'VINGADOR DE CHUMBO', roles: ['damage'], hp: 270, damageMultiplier: 1.20, speedMultiplier: 1.00, damageReduction: 0.08, category: 'classic_hero', originFaction: null },
  sombra: { name: 'SOMBRA ESCARLATE', roles: ['damage'], hp: 220, damageMultiplier: 1.15, speedMultiplier: 1.12, damageReduction: 0.05, category: 'classic_hero', originFaction: null },
  turbo: { name: 'TURBO FANTASMA', roles: ['damage'], hp: 260, damageMultiplier: 1.10, speedMultiplier: 1.10, damageReduction: 0.08, category: 'classic_hero', originFaction: null },
  voltaico: { name: 'VOLTAICO', roles: ['damage', 'support'], hp: 250, damageMultiplier: 1.12, speedMultiplier: 1.05, damageReduction: 0.08, category: 'classic_hero', originFaction: null },
  vortex: { name: 'VÓRTEX', roles: ['tank', 'damage'], hp: 420, damageMultiplier: 1.15, speedMultiplier: 0.96, damageReduction: 0.25, category: 'classic_hero', originFaction: null },
  op09: { name: 'OP-09', roles: ['damage'], hp: 250, damageMultiplier: 1.0, speedMultiplier: 1.0, damageReduction: 0.05, category: 'custom_hero', originFaction: null },
  boss_cv: { name: 'BARÃO VERMELHO', roles: ['tank', 'damage'], hp: 460, damageMultiplier: 1.15, speedMultiplier: 0.94, damageReduction: 0.25, category: 'secret_boss', originFaction: 'cv' },
  boss_pcc: { name: 'MESTRE DO COFRE', roles: ['damage', 'support'], hp: 440, damageMultiplier: 1.12, speedMultiplier: 0.96, damageReduction: 0.22, category: 'secret_boss', originFaction: 'pcc' },
  boss_ares: { name: 'GENERAL OVERLORD', roles: ['tank', 'damage'], hp: 540, damageMultiplier: 1.18, speedMultiplier: 0.88, damageReduction: 0.32, category: 'secret_boss', originFaction: 'ares', isBigFig: true }
});

/**
 * Returns true if key is one of the 6 faction operators.
 */
export function isFactionOperatorKey(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(FACTION_OPERATORS, key);
}

/**
 * Returns the frozen operator spec for a valid faction operator key, or null.
 */
export function getOperatorSpec(key) {
  return isFactionOperatorKey(key) ? FACTION_OPERATORS[key] : null;
}

/**
 * Returns [hybridOp, pureOp] for the given faction, sorted by slotOrder (1, 2).
 */
export function getFactionPairOperators(factionKey = 'cv') {
  const validFaction = normalizeFactionKey(factionKey);
  return OPERATOR_KEYS_LIST
    .map((k) => FACTION_OPERATORS[k])
    .filter((op) => op.faction === validFaction)
    .sort((a, b) => a.slotOrder - b.slotOrder);
}

/**
 * Returns the default primary 2-role hybrid operator key for a faction.
 */
export function getDefaultHybridOperatorKey(factionKey = 'cv') {
  const validFaction = normalizeFactionKey(factionKey);
  return DEFAULT_HYBRID_BY_FACTION[validFaction];
}

/**
 * Resolves an actor-agnostic combatant stat sheet for any faction operator or extra.
 * Sets effectiveFaction = activeAllianceFaction so deserting rival operators fight
 * under the active alliance banner (for both player and AI operator bots).
 */
export function resolveCombatantSheet(characterKey, activeAllianceFaction = 'cv') {
  const effectiveFaction = normalizeFactionKey(activeAllianceFaction);
  const op = getOperatorSpec(characterKey);

  if (op) {
    const weapon = OPERATOR_WEAPONS[op.weaponKey] || null;
    return freezeDeep({
      characterKey: op.key,
      name: op.name,
      isFactionOperator: true,
      category: 'faction_operator',
      originFaction: op.faction,
      effectiveFaction,
      isDeserter: op.faction !== effectiveFaction,
      slotOrder: op.slotOrder,
      isHybrid: op.isHybrid,
      roles: [...op.roles],
      roleBaseline: blendRoleBaselines(op.roles),
      hp: op.hp,
      maxHp: op.hp,
      damageMultiplier: op.damageMultiplier,
      speedMultiplier: op.speedMultiplier,
      damageReduction: op.damageReduction,
      weaponKey: op.weaponKey,
      weapon,
      abilities: op.abilities,
      visualPreset: op.visualPreset,
      isBigFig: false
    });
  }

  const fallbackKey = Object.prototype.hasOwnProperty.call(NON_OPERATOR_COMBATANT_DEFAULTS, characterKey)
    ? characterKey
    : getDefaultHybridOperatorKey(effectiveFaction);

  if (isFactionOperatorKey(fallbackKey)) {
    return resolveCombatantSheet(fallbackKey, effectiveFaction);
  }

  const extra = NON_OPERATOR_COMBATANT_DEFAULTS[fallbackKey];
  return freezeDeep({
    characterKey: fallbackKey,
    name: extra.name,
    isFactionOperator: false,
    category: extra.category,
    originFaction: extra.originFaction,
    effectiveFaction,
    isDeserter: Boolean(extra.originFaction && extra.originFaction !== effectiveFaction),
    slotOrder: null,
    isHybrid: extra.roles.length > 1,
    roles: [...extra.roles],
    roleBaseline: blendRoleBaselines(extra.roles),
    hp: extra.hp,
    maxHp: extra.hp,
    damageMultiplier: extra.damageMultiplier,
    speedMultiplier: extra.speedMultiplier,
    damageReduction: extra.damageReduction,
    weaponKey: null,
    weapon: null,
    abilities: null,
    visualPreset: fallbackKey,
    isBigFig: Boolean(extra.isBigFig)
  });
}
