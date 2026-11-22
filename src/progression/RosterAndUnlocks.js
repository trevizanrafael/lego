/**
 * RosterAndUnlocks.js
 *
 * Central progression source of truth for playable faction pairs, stud prices,
 * rival deserter unlocks, classic/custom hero extras, secret boss unlocks,
 * Q/E HUD descriptors, faction switching, and legacy save slot migration.
 */

import {
  FACTION_OPERATORS,
  OPERATOR_KEYS_LIST,
  isFactionOperatorKey,
  getOperatorSpec,
  getFactionPairOperators,
  getDefaultHybridOperatorKey,
  normalizeFactionKey
} from '../entities/operators/OperatorCatalog.js';

function freezeDeep(obj) {
  if (!obj || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  for (const key of Object.keys(obj)) {
    freezeDeep(obj[key]);
  }
  return Object.freeze(obj);
}

export const RIVAL_OPERATOR_PRICE = 400_000;

export const BOSS_EXTRA_BY_FACTION = Object.freeze({
  cv: 'boss_cv',
  pcc: 'boss_pcc',
  ares: 'boss_ares'
});

/**
 * Canonical stud price table for all unlockable extra characters.
 * Note: Faction operators belonging to playerFaction cost 0 via getCharacterPrice;
 * secret bosses cost 0 and require unlockMethod === 'defeat_boss'.
 */
export const EXTRA_CHARACTER_PRICES = Object.freeze({
  // 8 Classic Hero Extras
  caveira: 250_000,
  solaris: 350_000,
  sombra: 500_000,
  turbo: 550_000,
  vingador: 650_000,
  voltaico: 750_000,
  tita: 900_000,
  vortex: 1_000_000,
  // Custom Hero Lab Slot
  op09: 300_000,
  // Faction Operators (when recruited as rival deserters)
  cv_marretao: RIVAL_OPERATOR_PRICE,
  cv_fogueteira: RIVAL_OPERATOR_PRICE,
  pcc_contador: RIVAL_OPERATOR_PRICE,
  pcc_muralha: RIVAL_OPERATOR_PRICE,
  ares_bastiao: RIVAL_OPERATOR_PRICE,
  ares_agulha: RIVAL_OPERATOR_PRICE,
  // 3 Secret Bosses (unlocked by defeating them in territorial war)
  boss_cv: 0,
  boss_pcc: 0,
  boss_ares: 0
});

/**
 * Q and E HUD descriptors for classic hero extras, custom OP-09, and secret bosses,
 * allowing AbilityCooldownHud to render unified Q/E icons and labels for every character.
 */
export const HERO_EXTRA_QE_DESCRIPTORS = freezeDeep({
  caveira: {
    q: { id: 'caveira_roll', icon: 'roll', cooldownSec: 2.5, name: { 'pt-BR': 'Rolar', 'en-US': 'Tactical Roll' }, desc: { 'pt-BR': 'Esquiva tática rápida com reposicionamento.', 'en-US': 'Fast tactical dodge roll.' } },
    e: { id: 'caveira_backup', icon: 'grenade', cooldownSec: 12, name: { 'pt-BR': 'Reforço / Granada', 'en-US': 'Backup / Grenade' }, desc: { 'pt-BR': 'Lança granada explosiva e coordena apoio tático.', 'en-US': 'Throws explosive grenade and rallies tactical backup.' } }
  },
  solaris: {
    q: { id: 'solaris_supernova', icon: 'sunburst', cooldownSec: 14, name: { 'pt-BR': 'Supernova', 'en-US': 'Supernova' }, desc: { 'pt-BR': 'Detonação solar em área ao redor do herói.', 'en-US': 'Radial solar detonation around the hero.' } },
    e: { id: 'solaris_flight', icon: 'wings', cooldownSec: 1, name: { 'pt-BR': 'Voo Solar', 'en-US': 'Solar Flight' }, desc: { 'pt-BR': 'Propulsão aérea e raio contínuo de plasma.', 'en-US': 'Aerial propulsion and continuous solar beam.' } }
  },
  tita: {
    q: { id: 'tita_quake', icon: 'quake', cooldownSec: 10, name: { 'pt-BR': 'Sismo', 'en-US': 'Seismic Stomp' }, desc: { 'pt-BR': 'Pisada sísmica que estilhaça coberturas ao redor.', 'en-US': 'Seismic stomp shattering nearby cover.' } },
    e: { id: 'tita_dash', icon: 'rocket_fist', cooldownSec: 8, name: { 'pt-BR': 'Dash', 'en-US': 'Rocket Dash' }, desc: { 'pt-BR': 'Soco-foguete pesado que rompe paredes rachadas.', 'en-US': 'Heavy rocket-fist dash breaking cracked walls.' } }
  },
  vingador: {
    q: { id: 'vingador_furor', icon: 'skull', cooldownSec: 16, name: { 'pt-BR': 'Furor', 'en-US': 'Rampage' }, desc: { 'pt-BR': 'Sobrecarga balística de cadência e impacto.', 'en-US': 'Ballistic overdrive boosting fire rate and impact.' } },
    e: { id: 'vingador_arsenal', icon: 'arsenal', cooldownSec: 1.5, name: { 'pt-BR': 'Arsenal', 'en-US': 'Arsenal Swap' }, desc: { 'pt-BR': 'Alterna submetralhadoras, escopeta e bazuca RPG.', 'en-US': 'Cycles dual SMGs, shotgun, and RPG launcher.' } }
  },
  sombra: {
    q: { id: 'sombra_smoke', icon: 'smoke', cooldownSec: 12, name: { 'pt-BR': 'Fumaça', 'en-US': 'Smoke Bomb' }, desc: { 'pt-BR': 'Bomba de fumaça com furtividade imediata.', 'en-US': 'Smoke bomb granting instant stealth.' } },
    e: { id: 'sombra_grapple', icon: 'hook', cooldownSec: 3, name: { 'pt-BR': 'Gancho', 'en-US': 'Grapple Hook' }, desc: { 'pt-BR': 'Gancho magnético 360° para travessia e puxão.', 'en-US': '360° magnetic grapple hook for traversal.' } }
  },
  turbo: {
    q: { id: 'turbo_wall', icon: 'light_wall', cooldownSec: 14, name: { 'pt-BR': 'Muralha', 'en-US': 'Light Wall' }, desc: { 'pt-BR': 'Arrancada energética deixando rastro sólido ciano.', 'en-US': 'Overdrive burst leaving a solid cyan light trail.' } },
    e: { id: 'turbo_chain', icon: 'chain', cooldownSec: 6, name: { 'pt-BR': 'Corrente', 'en-US': 'Plasma Chain' }, desc: { 'pt-BR': 'Chicote giratório de correntes energizadas.', 'en-US': 'Spinning energized plasma chain strike.' } }
  },
  voltaico: {
    q: { id: 'voltaico_emp', icon: 'emp', cooldownSec: 14, name: { 'pt-BR': 'Pulso EMP', 'en-US': 'EMP Pulse' }, desc: { 'pt-BR': 'Tempestade eletromagnética em área ampla.', 'en-US': 'Wide-area electromagnetic storm discharge.' } },
    e: { id: 'voltaico_blink', icon: 'bolt', cooldownSec: 4, name: { 'pt-BR': 'Teleporte', 'en-US': 'Arc Blink' }, desc: { 'pt-BR': 'Salto elétrico instantâneo entre pontos de energia.', 'en-US': 'Instant electric blink across power nodes.' } }
  },
  vortex: {
    q: { id: 'vortex_eruption', icon: 'tendrils', cooldownSec: 13, name: { 'pt-BR': 'Erupção', 'en-US': 'Symbiote Eruption' }, desc: { 'pt-BR': 'Explosão de tentáculos abissais em 360°.', 'en-US': '360° eruption of abyssal tendrils.' } },
    e: { id: 'vortex_tether', icon: 'claw', cooldownSec: 6, name: { 'pt-BR': 'Laço Abissal', 'en-US': 'Abyssal Tether' }, desc: { 'pt-BR': 'Agarra alvos distantes e helicópteros no ar.', 'en-US': 'Snatches distant targets and airborne helicopters.' } }
  },
  op09: {
    q: { id: 'op09_ultimate', icon: 'star', cooldownSec: 15, name: { 'pt-BR': 'Ultimate', 'en-US': 'Ultimate' }, desc: { 'pt-BR': 'Super-habilidade configurada no laboratório OP-09.', 'en-US': 'Custom super ability configured in the OP-09 lab.' } },
    e: { id: 'op09_mobility', icon: 'jet', cooldownSec: 5, name: { 'pt-BR': 'Mobilidade', 'en-US': 'Mobility' }, desc: { 'pt-BR': 'Módulo de deslocamento customizado do OP-09.', 'en-US': 'Custom traversal module of OP-09.' } }
  },
  boss_cv: {
    q: { id: 'boss_cv_barrage', icon: 'rocket', cooldownSec: 14, name: { 'pt-BR': 'Salva Rubra', 'en-US': 'Crimson Barrage' }, desc: { 'pt-BR': 'Dispara barragem incendiária pesada do Comando.', 'en-US': 'Fires a heavy incendiary rocket barrage.' } },
    e: { id: 'boss_cv_rally', icon: 'flare', cooldownSec: 16, name: { 'pt-BR': 'Grito de Guerra', 'en-US': 'War Cry' }, desc: { 'pt-BR': 'Fortalece blindagem e convoca escolta de assalto.', 'en-US': 'Boosts armor and rallies assault escort.' } }
  },
  boss_pcc: {
    q: { id: 'boss_pcc_breach', icon: 'c4', cooldownSec: 13, name: { 'pt-BR': 'Carga Mestre', 'en-US': 'Vault Charge' }, desc: { 'pt-BR': 'Detona explosivo termobárico de arrombamento.', 'en-US': 'Detonates a thermobaric breaching charge.' } },
    e: { id: 'boss_pcc_aegis', icon: 'shield', cooldownSec: 15, name: { 'pt-BR': 'Blindagem Z-15', 'en-US': 'Z-15 Armor' }, desc: { 'pt-BR': 'Ativa placas balísticas pesadas e munição perfurante.', 'en-US': 'Activates heavy ballistic plating and AP rounds.' } }
  },
  boss_ares: {
    q: { id: 'boss_ares_orbital', icon: 'dome', cooldownSec: 16, name: { 'pt-BR': 'Colapso Quântico', 'en-US': 'Quantum Collapse' }, desc: { 'pt-BR': 'Descarrega onda de choque de plasma do reator Overlord.', 'en-US': 'Unleashes an Overlord reactor plasma shockwave.' } },
    e: { id: 'boss_ares_thrusters', icon: 'drone', cooldownSec: 12, name: { 'pt-BR': 'Salto Mecha', 'en-US': 'Mecha Thruster' }, desc: { 'pt-BR': 'Propulsão blindada esmagando inimigos no impacto.', 'en-US': 'Armored thruster leap crushing foes on impact.' } }
  }
});

function makeHeroExtraEntry(key, ptName, enName, price, roles, category = 'classic_hero', extraMeta = {}) {
  return {
    key,
    category,
    unlockMethod: extraMeta.unlockMethod || 'studs',
    price,
    roles,
    name: { 'pt-BR': ptName, 'en-US': enName },
    abilities: HERO_EXTRA_QE_DESCRIPTORS[key],
    ...extraMeta
  };
}

function makeRivalOperatorExtraEntry(opKey) {
  const op = FACTION_OPERATORS[opKey];
  return {
    key: op.key,
    category: 'rival_operator',
    originFaction: op.faction,
    unlockMethod: 'studs',
    price: RIVAL_OPERATOR_PRICE,
    roles: [...op.roles],
    name: op.displayName,
    abilities: op.abilities
  };
}

/**
 * Full catalog of non-free extra characters (rival operators, OP-09, 8 classic heroes, 3 bosses).
 */
export const EXTRAS_CATALOG = freezeDeep({
  cv_marretao: makeRivalOperatorExtraEntry('cv_marretao'),
  cv_fogueteira: makeRivalOperatorExtraEntry('cv_fogueteira'),
  pcc_contador: makeRivalOperatorExtraEntry('pcc_contador'),
  pcc_muralha: makeRivalOperatorExtraEntry('pcc_muralha'),
  ares_bastiao: makeRivalOperatorExtraEntry('ares_bastiao'),
  ares_agulha: makeRivalOperatorExtraEntry('ares_agulha'),
  op09: makeHeroExtraEntry('op09', 'OP-09 (Customizável)', 'OP-09 (Custom)', 300_000, ['damage'], 'custom_hero'),
  caveira: makeHeroExtraEntry('caveira', 'Comandante Caveira', 'Commander Skull', 250_000, ['damage', 'support']),
  solaris: makeHeroExtraEntry('solaris', 'Solaris', 'Solaris', 350_000, ['damage']),
  sombra: makeHeroExtraEntry('sombra', 'Sombra Escarlate', 'Scarlet Shadow', 500_000, ['damage']),
  turbo: makeHeroExtraEntry('turbo', 'Turbo Fantasma', 'Phantom Turbo', 550_000, ['damage']),
  vingador: makeHeroExtraEntry('vingador', 'Vingador de Chumbo', 'Lead Avenger', 650_000, ['damage']),
  voltaico: makeHeroExtraEntry('voltaico', 'Voltaico', 'Voltaic', 750_000, ['damage', 'support']),
  tita: makeHeroExtraEntry('tita', 'Titã Blindado', 'Armored Titan', 900_000, ['tank'], 'classic_hero', { isBigFig: true }),
  vortex: makeHeroExtraEntry('vortex', 'Vórtex', 'Vortex', 1_000_000, ['tank', 'damage']),
  boss_cv: makeHeroExtraEntry('boss_cv', 'Barão Vermelho', 'Red Baron', 0, ['tank', 'damage'], 'secret_boss', { unlockMethod: 'defeat_boss', bossFaction: 'cv' }),
  boss_pcc: makeHeroExtraEntry('boss_pcc', 'Mestre do Cofre', 'Vault Master', 0, ['damage', 'support'], 'secret_boss', { unlockMethod: 'defeat_boss', bossFaction: 'pcc' }),
  boss_ares: makeHeroExtraEntry('boss_ares', 'General Overlord', 'General Overlord', 0, ['tank', 'damage'], 'secret_boss', { unlockMethod: 'defeat_boss', bossFaction: 'ares', isBigFig: true })
});

export const EXTRA_KEYS_ORDER = Object.freeze([
  ...OPERATOR_KEYS_LIST,
  'op09', 'caveira', 'solaris', 'sombra', 'turbo', 'vingador', 'voltaico', 'tita', 'vortex',
  'boss_cv', 'boss_pcc', 'boss_ares'
]);

/**
 * Sanitizes an unlockedExtras array, preserving order, removing duplicates and unknown keys.
 */
export function sanitizeUnlockedExtras(unlockedExtras = []) {
  if (!Array.isArray(unlockedExtras)) return [];
  const seen = new Set();
  const clean = [];
  for (const key of unlockedExtras) {
    if (typeof key === 'string' && Object.prototype.hasOwnProperty.call(EXTRAS_CATALOG, key) && !seen.has(key)) {
      seen.add(key);
      clean.push(key);
    }
  }
  return clean;
}

/**
 * Universal Q/E ability descriptor lookup for both faction operators and extras.
 */
export function getCharacterAbilityDescriptors(charKey) {
  if (isFactionOperatorKey(charKey)) {
    return FACTION_OPERATORS[charKey].abilities;
  }
  return HERO_EXTRA_QE_DESCRIPTORS[charKey] || null;
}

/**
 * Returns true if charKey belongs to playerFaction's 2 free operators OR is in unlockedExtras.
 */
export function isCharacterUnlocked(charKey, playerFaction = 'cv', unlockedExtras = []) {
  if (typeof charKey !== 'string' || !Object.prototype.hasOwnProperty.call(EXTRAS_CATALOG, charKey)) {
    return false;
  }
  const validFaction = normalizeFactionKey(playerFaction);
  const op = getOperatorSpec(charKey);
  if (op && op.faction === validFaction) {
    return true;
  }
  const cleanList = sanitizeUnlockedExtras(unlockedExtras);
  return cleanList.includes(charKey);
}

/**
 * Returns 0 if charKey is free for playerFaction or is a boss unlock, otherwise its stud price.
 */
export function getCharacterPrice(charKey, playerFaction = 'cv') {
  if (typeof charKey !== 'string' || !Object.prototype.hasOwnProperty.call(EXTRAS_CATALOG, charKey)) {
    return 0;
  }
  const validFaction = normalizeFactionKey(playerFaction);
  const op = getOperatorSpec(charKey);
  if (op && op.faction === validFaction) {
    return 0;
  }
  const entry = EXTRAS_CATALOG[charKey];
  if (entry.unlockMethod === 'defeat_boss') {
    return 0;
  }
  return EXTRA_CHARACTER_PRICES[charKey] ?? 0;
}

/**
 * Builds the complete playable roster view for the active faction:
 * - primaryPair: [hybridOp, pureOp] free operators for playerFaction
 * - extras: the 16 non-faction-native unlockables (4 rival operators + OP-09 + 8 heroes + 3 bosses)
 * - unlockedSet: Set of all currently playable character keys
 */
export function getPlayableRosterForFaction(playerFaction = 'cv', unlockedExtras = []) {
  const validFaction = normalizeFactionKey(playerFaction);
  const primaryPair = getFactionPairOperators(validFaction);
  const cleanUnlocked = sanitizeUnlockedExtras(unlockedExtras);
  const unlockedSet = new Set([...primaryPair.map((op) => op.key), ...cleanUnlocked]);

  const extras = [];
  for (const key of EXTRA_KEYS_ORDER) {
    const op = getOperatorSpec(key);
    if (op && op.faction === validFaction) {
      continue;
    }
    const spec = EXTRAS_CATALOG[key];
    extras.push({
      ...spec,
      unlocked: unlockedSet.has(key),
      effectivePrice: getCharacterPrice(key, validFaction)
    });
  }

  return {
    primaryPair,
    extras,
    unlockedSet
  };
}

/**
 * Validates and executes a stud purchase of an extra character.
 */
export function purchaseExtraCharacter({
  charKey,
  playerFaction = 'cv',
  currentStuds = 0,
  unlockedExtras = []
} = {}) {
  const validFaction = normalizeFactionKey(playerFaction);
  const safeStuds = Math.max(0, Math.floor(Number(currentStuds) || 0));
  const cleanList = sanitizeUnlockedExtras(unlockedExtras);

  if (typeof charKey !== 'string' || !Object.prototype.hasOwnProperty.call(EXTRAS_CATALOG, charKey)) {
    return { ok: false, reason: 'invalid_character', remainingStuds: safeStuds, unlockedExtras: cleanList, cost: 0, missingStuds: 0 };
  }

  if (isCharacterUnlocked(charKey, validFaction, cleanList)) {
    return { ok: false, reason: 'already_unlocked', remainingStuds: safeStuds, unlockedExtras: cleanList, cost: 0, missingStuds: 0 };
  }

  const entry = EXTRAS_CATALOG[charKey];
  if (entry.unlockMethod !== 'studs') {
    return { ok: false, reason: 'not_purchasable_with_studs', remainingStuds: safeStuds, unlockedExtras: cleanList, cost: 0, missingStuds: 0 };
  }

  const cost = getCharacterPrice(charKey, validFaction);
  if (safeStuds < cost) {
    return { ok: false, reason: 'insufficient_studs', remainingStuds: safeStuds, unlockedExtras: cleanList, cost, missingStuds: cost - safeStuds };
  }

  return {
    ok: true,
    reason: 'purchased',
    remainingStuds: safeStuds - cost,
    unlockedExtras: [...cleanList, charKey],
    cost,
    missingStuds: 0
  };
}

/**
 * Maps defeated boss faction ('cv' -> 'boss_cv', 'pcc' -> 'boss_pcc', 'ares' -> 'boss_ares')
 * and adds it to unlockedExtras idempotently.
 */
export function unlockDefeatedBossExtra(bossFactionKey, unlockedExtras = []) {
  const cleanList = sanitizeUnlockedExtras(unlockedExtras);
  const bossKey = BOSS_EXTRA_BY_FACTION[bossFactionKey]
    || (Object.values(BOSS_EXTRA_BY_FACTION).includes(bossFactionKey) ? bossFactionKey : null);

  if (!bossKey) {
    return {
      ok: false,
      bossKey: null,
      newlyUnlocked: false,
      unlockedExtras: cleanList
    };
  }

  if (cleanList.includes(bossKey)) {
    return {
      ok: true,
      bossKey,
      newlyUnlocked: false,
      unlockedExtras: cleanList
    };
  }

  return {
    ok: true,
    bossKey,
    newlyUnlocked: true,
    unlockedExtras: [...cleanList, bossKey]
  };
}

/**
 * Migrates a legacy or current save slot object cleanly:
 * - Old saves without unlockedExtras start with unlockedExtras: [] (zero free extras).
 * - Preserves studs, goldenBricks, conqueredTerritories, customHero, garages, etc. untouched.
 * - Keeps operatorKey if already unlocked for faction; else sets getDefaultHybridOperatorKey(faction)
 *   and syncs heroKey = operatorKey for legacy callers.
 */
export function migrateSaveSlotRoster(slotData) {
  if (!slotData || typeof slotData !== 'object') {
    return null;
  }

  const faction = normalizeFactionKey(slotData.faction);
  const unlockedExtras = Array.isArray(slotData.unlockedExtras)
    ? sanitizeUnlockedExtras(slotData.unlockedExtras)
    : [];

  const candidateKey = typeof slotData.operatorKey === 'string' && slotData.operatorKey
    ? slotData.operatorKey
    : slotData.heroKey;

  const operatorKey = isCharacterUnlocked(candidateKey, faction, unlockedExtras)
    ? candidateKey
    : getDefaultHybridOperatorKey(faction);

  return {
    ...slotData,
    faction,
    unlockedExtras,
    operatorKey,
    heroKey: operatorKey
  };
}

/**
 * Resolves active operator and free pair when switching alliance faction in Pause Menu:
 * - Updates the 2 free operators to newFaction's pair
 * - Preserves unlockedExtras intact
 * - Switches active operatorKey to getDefaultHybridOperatorKey(newFaction) if currentOperatorKey
 *   was only unlocked via the previous faction's free pair.
 */
export function resolveFactionSwitchRoster(newFaction, currentOperatorKey, unlockedExtras = []) {
  const faction = normalizeFactionKey(newFaction);
  const cleanExtras = sanitizeUnlockedExtras(unlockedExtras);
  const primaryPair = getFactionPairOperators(faction);
  const stillUnlocked = isCharacterUnlocked(currentOperatorKey, faction, cleanExtras);
  const operatorKey = stillUnlocked ? currentOperatorKey : getDefaultHybridOperatorKey(faction);

  return {
    faction,
    primaryPair,
    unlockedExtras: cleanExtras,
    operatorKey,
    heroKey: operatorKey,
    switchedOperator: operatorKey !== currentOperatorKey
  };
}
