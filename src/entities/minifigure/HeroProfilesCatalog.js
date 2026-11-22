import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { getOp09MinifigPreset } from '../CustomHeroSystem.js';

/**
 * Catálogo central de perfis, escalas, cores PBR e metadados de todos os heróis
 * jogáveis (incluindo suporte dinâmico ao Operador Customizado OP-09).
 */
export const MINIFIG_PRESETS = {
  caveira: {
    key: 'caveira',
    name: 'Comandante Caveira (BOPE)',
    subtitle: 'Fuzil Tático • Carga Explosiva • Rolamento',
    headColor: LEGO_COLORS.yellow,
    torsoColor: LEGO_COLORS.black,
    armColor: LEGO_COLORS.charcoal,
    handColor: 0x111827,
    hipColor: LEGO_COLORS.black,
    legColor: LEGO_COLORS.charcoal,
    facePreset: 'caveira',
    torsoPreset: 'caveira',
    headgear: 'beret',
    capeColor: null,
    weapon: 'rifle',
    fireAura: false
  },
  solaris: {
    key: 'solaris',
    name: 'Solaris (Rei do Sol)',
    subtitle: 'Voo Cometa • Raio Solar • Supernova',
    headColor: LEGO_COLORS.yellow,
    torsoColor: 0x7f1d1d,
    armColor: LEGO_COLORS.gold,
    handColor: 0xfef08a,
    hipColor: 0xf59e0b,
    legColor: 0x7f1d1d,
    facePreset: 'solaris',
    torsoPreset: 'solaris',
    headgear: 'visor_crown',
    capeColor: null,
    weapon: 'solar_orbs',
    fireAura: true
  },
  tita: {
    key: 'tita',
    name: 'Titã Blindado (PMESP)',
    subtitle: 'Minigun 6 Canos [Mouse 1] • Dash [Mouse 2] • Pisada Sísmica [Q]',
    headColor: 0x334155,
    torsoColor: 0x475569,
    armColor: 0x475569,
    handColor: 0xdc2626,
    hipColor: 0x090a0d,
    legColor: 0x334155,
    facePreset: 'tita',
    torsoPreset: 'tita',
    headgear: 'mecha_helmet',
    capeColor: null,
    weapon: 'tita_rig',
    fireAura: false,
    isBigFig: true
  },
  vingador: {
    key: 'vingador',
    name: 'Vingador de Chumbo',
    subtitle: '[R] Trocar Arma: Castigadoras .50 • Doze 18 Bagos • Bazuca Rocket Jump • [Q] Furor',
    headColor: LEGO_COLORS.yellow,
    torsoColor: 0x0c0e13,
    armColor: 0x10131a,
    handColor: 0x090a0d,
    hipColor: 0xe2e8f0,
    legColor: 0x0c0e13,
    facePreset: 'vingador',
    torsoPreset: 'vingador',
    headgear: 'tactical_bandana',
    capeColor: null,
    weapon: 'vingador_arsenal',
    fireAura: false
  },
  sombra: {
    key: 'sombra',
    name: 'Sombra Escarlate',
    subtitle: 'Gancho 360° [Mouse 2] • Katanas Lua de Sangue [Mouse 1] • Rolamento Invisível [Q]',
    headColor: 0x090a0d,
    torsoColor: 0x090a0d,
    armColor: 0x18181b,
    handColor: LEGO_COLORS.red,
    hipColor: 0x991b1b,
    legColor: 0x090a0d,
    facePreset: 'sombra',
    torsoPreset: 'sombra',
    headgear: 'ninja_hood',
    capeColor: null,
    weapon: 'dual_katanas',
    fireAura: false
  },
  turbo: {
    key: 'turbo',
    name: 'Turbo Fantasma',
    subtitle: 'Moto Fantasma Ciano [Mouse 2] • Correntes de Plasma [Mouse 1] • Arrancada Muralha [Q]',
    headColor: 0xe2e8f0,
    torsoColor: 0x090a0d,
    armColor: 0x090a0d,
    handColor: 0x22d3ee,
    hipColor: 0x090a0d,
    legColor: 0x090a0d,
    facePreset: 'turbo',
    torsoPreset: 'turbo',
    headgear: 'ghost_flame_skull',
    capeColor: null,
    weapon: 'turbo_chains',
    fireAura: true
  },
  voltaico: {
    key: 'voltaico',
    name: 'Voltaico (Tempestade)',
    subtitle: 'Chain Lightning [Mouse 1] • Teleporte Elétrico [Mouse 2] • Super Pulso EMP [Q]',
    headColor: 0x0f172a,
    torsoColor: 0x1d4ed8,
    armColor: 0x1e3a8a,
    handColor: 0x38bdf8,
    hipColor: 0x1e3a8a,
    legColor: 0x0f172a,
    facePreset: 'voltaico',
    torsoPreset: 'voltaico',
    headgear: 'tesla_crown',
    capeColor: null,
    weapon: 'voltaico_staff',
    fireAura: false
  },
  vortex: {
    key: 'vortex',
    name: 'Vórtex (Simbionte)',
    subtitle: 'Metamorfose Big-Fig [F] • Tentáculos [Mouse 1] • Laço Abissal [Mouse 2] • Erupção [Q]',
    headColor: 0x050608,
    torsoColor: 0x050608,
    armColor: 0x050608,
    handColor: 0x050608,
    hipColor: 0x050608,
    legColor: 0x050608,
    facePreset: 'vortex',
    torsoPreset: 'vortex',
    headgear: 'symbiote_crest',
    capeColor: null,
    weapon: 'vortex_tentacles',
    fireAura: false
  },
  cv_marretao: {
    key: 'cv_marretao',
    name: 'Marretão (CV)',
    subtitle: 'Metralhadora Pesada • [Q] Barricada • [E] Bazuca RPG',
    headColor: LEGO_COLORS.yellow,
    torsoColor: 0x14171c,
    armColor: 0xdc2626,
    handColor: 0x090a0d,
    hipColor: 0x262d22,
    legColor: 0x262d22,
    facePreset: 'vingador',
    torsoPreset: 'caveira',
    headgear: 'cv_marretao_cap',
    capeColor: null,
    weapon: 'cv_lmg',
    fireAura: false,
    isBigFig: false
  },
  cv_fogueteira: {
    key: 'cv_fogueteira',
    name: 'Fogueteira (CV)',
    subtitle: 'Pistola Semiautomática • [Q] Kit de Socorro • [E] Fogos de Alerta',
    headColor: LEGO_COLORS.yellow,
    torsoColor: 0x18181b,
    armColor: 0xb91c1c,
    handColor: 0x18181b,
    hipColor: 0x18181b,
    legColor: 0x27272a,
    facePreset: 'caveira',
    torsoPreset: 'caveira',
    headgear: 'cv_fogueteira_visor',
    capeColor: null,
    weapon: 'cv_pistol',
    fireAura: false,
    isBigFig: false
  },
  pcc_contador: {
    key: 'pcc_contador',
    name: 'Contador (PCC)',
    subtitle: 'Fuzil de Precisão • [Q] Caixa de Suprimento • [E] C4 Remota',
    headColor: 0x090a0d,
    torsoColor: 0x090a0d,
    armColor: 0x0f172a,
    handColor: 0x090a0d,
    hipColor: 0x090a0d,
    legColor: 0x0f172a,
    facePreset: 'sombra',
    torsoPreset: 'caveira',
    headgear: 'pcc_contador_balaclava',
    capeColor: null,
    weapon: 'pcc_dmr',
    fireAura: false,
    isBigFig: false
  },
  pcc_muralha: {
    key: 'pcc_muralha',
    name: 'Muralha (PCC)',
    subtitle: 'Escopeta 12 • [Q] Escudo Balístico • [E] Investida',
    headColor: 0x07090e,
    torsoColor: 0x07090e,
    armColor: 0x0f172a,
    handColor: 0x07090e,
    hipColor: 0x07090e,
    legColor: 0x111827,
    facePreset: 'tita',
    torsoPreset: 'caveira',
    headgear: 'pcc_muralha_helmet',
    capeColor: null,
    weapon: 'pcc_shotgun12',
    fireAura: false,
    isBigFig: false
  },
  ares_bastiao: {
    key: 'ares_bastiao',
    name: 'Bastião-7 (A.R.E.S.)',
    subtitle: 'Minigun de Pulso • [Q] Domo de Energia • [E] Drone Médico',
    headColor: 0x334155,
    torsoColor: 0x090712,
    armColor: 0x475569,
    handColor: 0x1e293b,
    hipColor: 0x090712,
    legColor: 0x334155,
    facePreset: 'voltaico',
    torsoPreset: 'voltaico',
    headgear: 'ares_bastiao_helmet',
    capeColor: null,
    weapon: 'ares_pulse_minigun',
    fireAura: false,
    isBigFig: false
  },
  ares_agulha: {
    key: 'ares_agulha',
    name: 'Agulha (A.R.E.S.)',
    subtitle: 'Rifle Laser de Carga • [Q] Camuflagem Óptica • [E] Granada de Pulso',
    headColor: 0x090b14,
    torsoColor: 0x1e2436,
    armColor: 0x090b14,
    handColor: 0x1e2436,
    hipColor: 0x090b14,
    legColor: 0x1e2436,
    facePreset: 'sombra',
    torsoPreset: 'sombra',
    headgear: 'ares_agulha_visor',
    capeColor: null,
    weapon: 'ares_charge_rifle',
    fireAura: false,
    isBigFig: false
  }
};

export const HERO_PROFILES = MINIFIG_PRESETS;

export const HERO_KEYS_LIST = Object.freeze(Object.keys(MINIFIG_PRESETS));

export const BIG_FIG_SCALE = Object.freeze({ x: 1.78, y: 1.62, z: 1.78 });
export const VORTEX_MONSTER_SCALE = Object.freeze({ x: 1.88, y: 1.74, z: 1.88 });
export const SOMBRA_AGILE_SCALE = Object.freeze({ x: 0.92, y: 1.07, z: 0.92 });
export const VORTEX_BASE_SCALE = Object.freeze({ x: 1.06, y: 1.08, z: 1.06 });

/**
 * Resolve uma chave de herói (incluindo 'op09') ou objeto preset já construído.
 */
export function resolveHeroPreset(presetOrKey) {
  if (presetOrKey && typeof presetOrKey === 'object') {
    return presetOrKey;
  }
  if (presetOrKey === 'op09') {
    return getOp09MinifigPreset();
  }
  return MINIFIG_PRESETS[presetOrKey] || MINIFIG_PRESETS.caveira;
}

/**
 * Aplica a escala anatômica inicial da raiz visual de acordo com a classe física do herói.
 */
export function applyPresetVisualScale(visualRoot, preset) {
  if (preset.isBigFig) {
    visualRoot.scale.set(BIG_FIG_SCALE.x, BIG_FIG_SCALE.y, BIG_FIG_SCALE.z);
  } else if (preset.key === 'sombra') {
    visualRoot.scale.set(SOMBRA_AGILE_SCALE.x, SOMBRA_AGILE_SCALE.y, SOMBRA_AGILE_SCALE.z);
  } else if (preset.key === 'vortex') {
    visualRoot.scale.set(VORTEX_BASE_SCALE.x, VORTEX_BASE_SCALE.y, VORTEX_BASE_SCALE.z);
  } else {
    visualRoot.scale.set(1, 1, 1);
  }
}

/**
 * Limpa todas as coleções e ponteiros transitórios de malhas/partículas antes de reconstruir o modelo 3D.
 */
export function resetMinifigBuildRefs(minifig) {
  minifig.flameParticles = [];
  minifig.crownFlameMeshes = [];
  minifig.solarMantleStrips = [];
  minifig.solarMantleGroup = null;
  minifig.titaMinigunBarrelGroup = null;
  minifig.titaDashFlameMeshes = [];
  minifig.titaSirenLights = [];
  minifig.stompTimer = 0;
  minifig.titaJumpChargeRatio = 0;
  minifig.isDashing = false;
  minifig.sombraScarfStrips = [];
  minifig.katanaAuraFlames = [];
  minifig.vingadorCoatTails = [];
  minifig.vingadorSkullEyes = [];
  minifig.vingadorBackShotgun = null;
  minifig.vingadorBackRpg = null;
  minifig.vingadorHolsteredPistols = [];
  minifig.vingadorFurorActive = false;
  minifig.isDiveSliding = false;
  minifig.muzzleFlashMesh = null;
  minifig.leftMuzzleFlashMesh = null;
  minifig.rifleGroup = null;
  minifig.dualSmgLeft = null;
  minifig.dualSmgRight = null;
  minifig.shotgunGroup = null;
  minifig.rpgGroup = null;
  minifig.leftKatanaGroup = null;
  minifig.rightKatanaGroup = null;
  minifig.titaShieldGroup = null;
  minifig.titaCannonGroup = null;
  minifig.turboFlameMeshes = [];
  minifig.turboChainGroups = [];
  minifig.voltaicoArcs = [];
  minifig.voltaicoCrownSpikes = [];
  minifig.voltaicoBackArcSegments = [];
  minifig.voltaicoLeftClawGroup = null;
  minifig.voltaicoStaffOrb = null;
  minifig.vortexTentacles = [];
  minifig.vortexTongueSegments = [];
  minifig.vortexMonsterSpikes = [];
  minifig.isVortexMonster = false;
  minifig.operatorShieldGroup = null;
  minifig.operatorBackDroneGroup = null;
  minifig.operatorCloakGroup = null;
  minifig.operatorMedpackGroup = null;
  minifig.operatorBarrelCluster = null;
}

/**
 * Instala métodos de submódulos em `Minifigure.prototype` como não-enumeráveis,
 * preservando exatamente os descritores nativos de métodos ES6 (`enumerable: false`).
 */
export function installMinifigMethods(proto, methods) {
  const descriptors = {};
  for (const key of Reflect.ownKeys(methods)) {
    const desc = Object.getOwnPropertyDescriptor(methods, key);
    if (desc) {
      descriptors[key] = {
        ...desc,
        enumerable: false
      };
    }
  }
  Object.defineProperties(proto, descriptors);
}
