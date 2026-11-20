import * as THREE from 'three';
import { getLegoMaterial, LEGO_COLORS } from '../../../materials/LegoMaterials.js';
import { NAVAL_AIR_SPECS, createNavalOrAircraftMesh } from '../../NavalAndAirFleetBuilder.js';
import {
  CUSTOMS_PAINT_PALETTE,
  getPaletteHex
} from '../street-customs/CustomsCatalogAndSave.js';
import { applyWindowAndHeadlightTint } from '../street-customs/CustomsVehicleApplier3D.js';

export const AIRCRAFT_STUDIO_TYPES = [
  { id: 'jato_caca', label: 'Caça Supersônico F-99', role: 'CAÇA DE SUPERIORIDADE' },
  { id: 'jato_vip', label: 'Jato Stealth VIP', role: 'TRANSPORTE TÁTICO' },
  { id: 'heli_ataque', label: 'Apache Falcon-X', role: 'HELICÓPTERO DE ATAQUE' },
  { id: 'heli_policia', label: 'Águia Tático BOPE', role: 'PATRULHA AÉREA' }
];

export const AIRCRAFT_PATTERNS = [
  { id: 'solid', name: 'Tático Liso', accentHex: null },
  { id: 'racing_stripes', name: 'Faixas Duplas', accentHex: 0xfacc15 },
  { id: 'digital_camo', name: 'Camuflagem Digital', accentHex: 0x64748b },
  { id: 'shark_teeth', name: 'Boca de Tubarão', accentHex: 0xef4444 },
  { id: 'squadron_gold', name: 'Esquadrilha Dourada', accentHex: 0xfbbf24 },
  { id: 'cyber_delta', name: 'Circuito Cyber', accentHex: 0x38bdf8 }
];

export const AIRCRAFT_INSIGNIAS = [
  { id: 'none', name: 'Sem Insígnia', code: '--', color: '#94a3b8' },
  { id: 'shield_eagle', name: 'Águia Aegis', code: 'AEGIS', color: '#38bdf8' },
  { id: 'bope_skull', name: 'Caveira Tática', code: 'BOPE', color: '#facc15' },
  { id: 'airforce_star', name: 'Estrela Força Aérea', code: 'FAB', color: '#22c55e' },
  { id: 'voltaic_bolt', name: 'Raio Voltaico', code: 'VOLT', color: '#60a5fa' },
  { id: 'solaris_flame', name: 'Chama Solaris', code: 'SOLAR', color: '#f97316' }
];

export const AIRCRAFT_TAIL_NUMBERS = ['01', '07', '22', '64', '77', '99'];

export const AIRCRAFT_WEAPON_MODS = [
  { id: 'stock', name: 'Armamento Padrão', weaponOverride: null, speedDelta: 0, armorDelta: 0 },
  { id: 'sidewinder_x4', name: 'Mísseis Sidewinder x4', weaponOverride: 'tank_cannon', speedDelta: -2, armorDelta: 90 },
  { id: 'twin_laser', name: 'Canhões Laser Duplos', weaponOverride: 'plasma_laser', speedDelta: 4, armorDelta: 60 },
  { id: 'heavy_bombs', name: 'Casulos Pesados Táticos', weaponOverride: 'tank_cannon', speedDelta: -5, armorDelta: 180 }
];

export const AIRCRAFT_WING_MODS = [
  { id: 'stock', name: 'Aerodinâmica Base', turnDelta: 0, speedDelta: 0 },
  { id: 'stealth_winglets', name: 'Winglets Stealth', turnDelta: 0.35, speedDelta: 8 },
  { id: 'awacs_radome', name: 'Radar AWACS Dorsal', turnDelta: 0.15, speedDelta: -3 },
  { id: 'twin_canards', name: 'Canards & Estabilizadores', turnDelta: 0.45, speedDelta: 5 }
];

export const AIRCRAFT_THRUSTER_MODS = [
  { id: 'stock', name: 'Propulsão Padrão', flameHex: 0x38bdf8, speedDelta: 0, accelDelta: 0 },
  { id: 'plasma_blue', name: 'Pós-Combustão Plasma Azul', flameHex: 0x00f0ff, speedDelta: 18, accelDelta: 16 },
  { id: 'nuclear_purple', name: 'Turbina Repulsora Roxa', flameHex: 0xa855f7, speedDelta: 24, accelDelta: 22 },
  { id: 'solar_gold', name: 'Propulsão Solar Dourada', flameHex: 0xfacc15, speedDelta: 20, accelDelta: 18 }
];

const _DECAL_TEX_CACHE = new Map();

export function createDefaultAircraftConfig(aircraftType = 'jato_caca') {
  const defaultsByType = {
    jato_caca: {
      aircraftType: 'jato_caca',
      primaryColor: 'stealth_charcoal',
      secondaryColor: 'sky_cyan',
      wingColor: 'steel_silver',
      finishStyle: 'metallic',
      windowTint: 'gold_mirror',
      pattern: 'cyber_delta',
      insignia: 'shield_eagle',
      tailNumber: '64',
      weaponMod: 'sidewinder_x4',
      wingMod: 'stealth_winglets',
      thrusterMod: 'plasma_blue'
    },
    jato_vip: {
      aircraftType: 'jato_vip',
      primaryColor: 'arctic_white',
      secondaryColor: 'royal_blue',
      wingColor: 'alert_yellow',
      finishStyle: 'glossy',
      windowTint: 'dark_smoke',
      pattern: 'racing_stripes',
      insignia: 'airforce_star',
      tailNumber: '01',
      weaponMod: 'twin_laser',
      wingMod: 'twin_canards',
      thrusterMod: 'solar_gold'
    },
    heli_ataque: {
      aircraftType: 'heli_ataque',
      primaryColor: 'bope_black',
      secondaryColor: 'crimson_red',
      wingColor: 'tactical_olive',
      finishStyle: 'matte',
      windowTint: 'tactical_blue',
      pattern: 'shark_teeth',
      insignia: 'bope_skull',
      tailNumber: '22',
      weaponMod: 'heavy_bombs',
      wingMod: 'awacs_radome',
      thrusterMod: 'nuclear_purple'
    },
    heli_policia: {
      aircraftType: 'heli_policia',
      primaryColor: 'bope_black',
      secondaryColor: 'alert_yellow',
      wingColor: 'steel_silver',
      finishStyle: 'glossy',
      windowTint: 'dark_smoke',
      pattern: 'squadron_gold',
      insignia: 'bope_skull',
      tailNumber: '07',
      weaponMod: 'twin_laser',
      wingMod: 'stealth_winglets',
      thrusterMod: 'plasma_blue'
    }
  };
  return { ...(defaultsByType[aircraftType] || defaultsByType.jato_caca) };
}

export function createDefaultAircraftSaveData() {
  return {
    selectedAircraftType: 'jato_caca',
    configsByType: {
      jato_caca: createDefaultAircraftConfig('jato_caca'),
      jato_vip: createDefaultAircraftConfig('jato_vip'),
      heli_ataque: createDefaultAircraftConfig('heli_ataque'),
      heli_policia: createDefaultAircraftConfig('heli_policia')
    }
  };
}

let _activeAircraftSaveData = createDefaultAircraftSaveData();

export function getActiveAircraftSaveData() {
  return _activeAircraftSaveData;
}

export function setActiveAircraftSaveData(data) {
  const base = createDefaultAircraftSaveData();
  if (data && typeof data === 'object') {
    if (AIRCRAFT_STUDIO_TYPES.some((t) => t.id === data.selectedAircraftType)) {
      base.selectedAircraftType = data.selectedAircraftType;
    }
    if (data.configsByType && typeof data.configsByType === 'object') {
      for (const entry of AIRCRAFT_STUDIO_TYPES) {
        const saved = data.configsByType[entry.id];
        if (saved && typeof saved === 'object') {
          base.configsByType[entry.id] = {
            ...createDefaultAircraftConfig(entry.id),
            ...saved,
            aircraftType: entry.id
          };
        }
      }
    }
  }
  _activeAircraftSaveData = base;
  return _activeAircraftSaveData;
}

export function computeCustomAircraftStats(aircraftType, cfg) {
  const baseSpec = NAVAL_AIR_SPECS[aircraftType] || NAVAL_AIR_SPECS.jato_caca;
  const safeCfg = cfg || createDefaultAircraftConfig(aircraftType);
  const wpn = AIRCRAFT_WEAPON_MODS.find((w) => w.id === safeCfg.weaponMod) || AIRCRAFT_WEAPON_MODS[0];
  const wing = AIRCRAFT_WING_MODS.find((w) => w.id === safeCfg.wingMod) || AIRCRAFT_WING_MODS[0];
  const thr = AIRCRAFT_THRUSTER_MODS.find((t) => t.id === safeCfg.thrusterMod) || AIRCRAFT_THRUSTER_MODS[0];

  const speedBonus = (wpn.speedDelta || 0) + (wing.speedDelta || 0) + (thr.speedDelta || 0);
  const kmh = Math.max(160, Math.round((baseSpec.kmh || 320) + speedBonus));
  const turboKmh = Math.max(kmh + 40, Math.round((baseSpec.turboKmh || kmh + 65) + speedBonus * 1.15));
  const maxForward = kmh / 3.214;
  const turboSpeed = turboKmh / 3.214;
  const accel = Math.max(30, (baseSpec.accel || 60) + (thr.accelDelta || 0));
  const turnRate = Number(Math.max(1.4, (baseSpec.turnRate || 2.3) + (wing.turnDelta || 0)).toFixed(2));
  const hp = Math.max(300, (baseSpec.hp || 700) + (wpn.armorDelta || 0));
  const weapon = wpn.weaponOverride !== null ? wpn.weaponOverride : baseSpec.weapon;

  return {
    ...baseSpec,
    kmh,
    turboKmh,
    maxForward,
    turboSpeed,
    accel,
    turnRate,
    hp,
    weapon
  };
}

function _createCrispAircraftTexture(key, width, height, drawFn) {
  if (_DECAL_TEX_CACHE.has(key)) {
    return _DECAL_TEX_CACHE.get(key);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawFn(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  _DECAL_TEX_CACHE.set(key, tex);
  return tex;
}

function _getPatternStripeTexture(patternId, accentCss, secondaryCss) {
  const key = `pat:${patternId}:${accentCss}:${secondaryCss}`;
  return _createCrispAircraftTexture(key, 256, 512, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    if (patternId === 'racing_stripes') {
      ctx.fillStyle = accentCss;
      ctx.fillRect(W * 0.28, 0, W * 0.14, H);
      ctx.fillRect(W * 0.58, 0, W * 0.14, H);
      ctx.fillStyle = secondaryCss;
      ctx.fillRect(W * 0.24, 0, W * 0.03, H);
      ctx.fillRect(W * 0.73, 0, W * 0.03, H);
    } else if (patternId === 'digital_camo') {
      const cols = [accentCss, secondaryCss, '#0f172a', '#475569'];
      const cell = 32;
      for (let y = 0; y < H; y += cell) {
        for (let x = 0; x < W; x += cell) {
          const hash = ((x * 73 + y * 151) >> 5) % 5;
          if (hash < 4) {
            ctx.fillStyle = cols[hash];
            ctx.globalAlpha = 0.85;
            ctx.fillRect(x, y, cell - 2, cell - 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    } else if (patternId === 'shark_teeth') {
      ctx.fillStyle = '#090a0d';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = accentCss;
      ctx.fillRect(0, 0, W, H * 0.16);
      ctx.fillRect(0, H * 0.84, W, H * 0.16);
      ctx.fillStyle = '#f8fafc';
      for (let i = 0; i < 6; i++) {
        const y0 = 30 + i * 75;
        ctx.beginPath();
        ctx.moveTo(W * 0.15, y0);
        ctx.lineTo(W * 0.5, y0 + 28);
        ctx.lineTo(W * 0.15, y0 + 56);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(W * 0.85, y0);
        ctx.lineTo(W * 0.5, y0 + 28);
        ctx.lineTo(W * 0.85, y0 + 56);
        ctx.closePath();
        ctx.fill();
      }
    } else if (patternId === 'squadron_gold') {
      ctx.fillStyle = '#090a0d';
      ctx.fillRect(W * 0.12, 0, W * 0.76, H);
      ctx.fillStyle = accentCss;
      for (let y = 24; y < H - 24; y += 64) {
        ctx.beginPath();
        ctx.moveTo(W * 0.5, y);
        ctx.lineTo(W * 0.84, y + 28);
        ctx.lineTo(W * 0.84, y + 42);
        ctx.lineTo(W * 0.5, y + 14);
        ctx.lineTo(W * 0.16, y + 42);
        ctx.lineTo(W * 0.16, y + 28);
        ctx.closePath();
        ctx.fill();
      }
    } else if (patternId === 'cyber_delta') {
      ctx.strokeStyle = accentCss;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(W * 0.25, 0);
      ctx.lineTo(W * 0.25, H * 0.65);
      ctx.lineTo(W * 0.1, H);
      ctx.moveTo(W * 0.75, 0);
      ctx.lineTo(W * 0.75, H * 0.65);
      ctx.lineTo(W * 0.9, H);
      ctx.stroke();
      ctx.fillStyle = secondaryCss;
      for (let y = 40; y < H - 40; y += 90) {
        ctx.fillRect(W * 0.42, y, W * 0.16, 18);
      }
    }
  });
}

function _getInsigniaTexture(insigniaId, tailNumber) {
  const ins = AIRCRAFT_INSIGNIAS.find((i) => i.id === insigniaId) || AIRCRAFT_INSIGNIAS[1];
  const key = `ins:${ins.id}:${tailNumber}`;
  return _createCrispAircraftTexture(key, 256, 256, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(9, 10, 13, 0.84)';
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, 114, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = ins.color;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, 104, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = ins.color;
    ctx.font = '900 54px "Teko", "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ins.id === 'none' ? `#${tailNumber}` : ins.code, W * 0.5, H * 0.42);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 44px "JetBrains Mono", monospace';
    ctx.fillText(String(tailNumber || '64'), W * 0.5, H * 0.72);
  });
}

function _buildAircraftModsAndLiveries(rootGroup, aircraftType, cfg) {
  const prevMods = rootGroup.getObjectByName('lego_aircraft_mod_group');
  if (prevMods) {
    rootGroup.remove(prevMods);
  }
  const modGroup = new THREE.Group();
  modGroup.name = 'lego_aircraft_mod_group';
  rootGroup.add(modGroup);

  const dims = rootGroup.userData?.aircraftDims || {};
  const box = new THREE.Box3().setFromObject(rootGroup);
  const size = new THREE.Vector3();
  box.getSize(size);
  const isHeli = aircraftType.startsWith('heli');
  const wingSpan = dims.wingSpan || Math.max(4.4, size.x * 0.85);
  const halfSpan = wingSpan * 0.46;
  const fuseLen = dims.fuselageLen || Math.max(8, size.z * 0.8);
  const dorsalY = Math.max(1.25, dims.dorsalY ?? (isHeli ? 1.85 : 1.38));

  const primaryHex = getPaletteHex(cfg.primaryColor, LEGO_COLORS.darkGrey);
  const secondaryHex = getPaletteHex(cfg.secondaryColor, LEGO_COLORS.yellow);
  const wingHex = getPaletteHex(cfg.wingColor, LEGO_COLORS.silver);
  const patternObj = AIRCRAFT_PATTERNS.find((p) => p.id === cfg.pattern) || AIRCRAFT_PATTERNS[0];
  const thrObj =
    AIRCRAFT_THRUSTER_MODS.find((t) => t.id === cfg.thrusterMod) || AIRCRAFT_THRUSTER_MODS[0];

  const primaryEntry =
    CUSTOMS_PAINT_PALETTE.find((p) => p.id === cfg.primaryColor) || CUSTOMS_PAINT_PALETTE[0];
  const secondaryEntry =
    CUSTOMS_PAINT_PALETTE.find((p) => p.id === cfg.secondaryColor) || CUSTOMS_PAINT_PALETTE[1];
  const accentCss = patternObj.accentHex
    ? `#${patternObj.accentHex.toString(16).padStart(6, '0')}`
    : primaryEntry.css || '#facc15';
  const secondaryCss = secondaryEntry?.css || '#38bdf8';

  const metalMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.55, roughness: 0.25 });
  const darkMat = getLegoMaterial(LEGO_COLORS.charcoal, { metalness: 0.4, roughness: 0.35 });
  const accentMat = getLegoMaterial(secondaryHex, { roughness: 0.26, clearcoat: 0.4 });
  const wingAccentMat = getLegoMaterial(wingHex, { roughness: 0.26, clearcoat: 0.4 });

  // 1. Padrões & Insígnias sobre a fuselagem/asas com polygonOffset contra Z-fighting
  if (cfg.pattern && cfg.pattern !== 'solid') {
    const patTex = _getPatternStripeTexture(cfg.pattern, accentCss, secondaryCss);
    const patMat = new THREE.MeshStandardMaterial({
      map: patTex,
      transparent: true,
      roughness: 0.32,
      metalness: 0.12,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3
    });
    const dorsalStripe = new THREE.Mesh(
      new THREE.PlaneGeometry(isHeli ? 1.1 : 1.45, Math.min(8.2, fuseLen * 0.55)),
      patMat
    );
    dorsalStripe.rotation.x = -Math.PI / 2;
    dorsalStripe.position.set(0, dorsalY + 0.05, isHeli ? 0.5 : -0.4);
    modGroup.add(dorsalStripe);

    if (!isHeli) {
      for (const sx of [-1, 1]) {
        const wingPatch = new THREE.Mesh(new THREE.PlaneGeometry(halfSpan * 0.45, 2.8), patMat);
        wingPatch.rotation.x = -Math.PI / 2;
        wingPatch.position.set(sx * halfSpan * 0.58, dorsalY - 0.14, 0.2);
        modGroup.add(wingPatch);
      }
    }
  }

  if (cfg.insignia && (cfg.insignia !== 'none' || cfg.tailNumber)) {
    const insTex = _getInsigniaTexture(cfg.insignia, cfg.tailNumber || '64');
    const insMat = new THREE.MeshStandardMaterial({
      map: insTex,
      transparent: true,
      roughness: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -4
    });

    if (!isHeli) {
      for (const sx of [-1, 1]) {
        const emblem = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), insMat);
        emblem.rotation.x = -Math.PI / 2;
        emblem.position.set(sx * halfSpan * 0.62, dorsalY - 0.12, -0.5);
        modGroup.add(emblem);
      }
    } else {
      for (const sx of [-1, 1]) {
        const sideBadge = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), insMat);
        sideBadge.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        sideBadge.position.set(sx * 1.12, 1.15, 0.8);
        modGroup.add(sideBadge);
      }
    }
  }

  // 2. Modificações Aerodinâmicas (WingMod)
  if (cfg.wingMod === 'stealth_winglets') {
    const xPos = isHeli ? 2.2 : halfSpan * 0.94;
    const yBase = isHeli ? 1.15 : 0.85;
    for (const sx of [-1, 1]) {
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 1.65), accentMat);
      winglet.position.set(sx * xPos, yBase + 0.45, 0.5);
      winglet.rotation.z = sx * -0.28;
      winglet.castShadow = true;
      modGroup.add(winglet);
    }
  } else if (cfg.wingMod === 'awacs_radome') {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.15, 0.9), darkMat);
    pylon.position.set(0, dorsalY + 0.65, -0.6);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.36, 16), wingAccentMat);
    dish.position.set(0, dorsalY + 1.32, -0.6);
    const dishStripe = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.42, 0.32), darkMat);
    dishStripe.position.copy(dish.position);
    modGroup.add(pylon, dish, dishStripe);
  } else if (cfg.wingMod === 'twin_canards') {
    const canardY = isHeli ? 0.9 : 0.72;
    const canardZ = isHeli ? 2.1 : 3.2;
    for (const sx of [-1, 1]) {
      const canard = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.9), wingAccentMat);
      canard.position.set(sx * 1.55, canardY, canardZ);
      canard.rotation.y = sx * 0.26;
      modGroup.add(canard);
    }
  }

  // 3. Armamentos sob Asas / Pilones (WeaponMod)
  const hardpointX = isHeli ? 1.85 : halfSpan * 0.62;
  const hardpointY = isHeli ? 0.62 : 0.38;
  if (cfg.weaponMod === 'sidewinder_x4') {
    const whiteMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.2 });
    const tipMat = getLegoMaterial(LEGO_COLORS.red, { roughness: 0.2 });
    for (const sx of [-1, 1]) {
      for (const ox of [0.82, 1.08]) {
        const mx = sx * hardpointX * ox;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.3, 8), whiteMat);
        body.rotation.x = Math.PI / 2;
        body.position.set(mx, hardpointY, 0.2);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 8), tipMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(mx, hardpointY, 1.48);
        modGroup.add(body, nose);
      }
    }
  } else if (cfg.weaponMod === 'twin_laser') {
    const laserGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const sx of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 2.4), darkMat);
      pod.position.set(sx * hardpointX, hardpointY, 0.45);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.3, 8), metalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(sx * hardpointX, hardpointY, 1.9);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), laserGlowMat);
      tip.position.set(sx * hardpointX, hardpointY, 2.55);
      modGroup.add(pod, barrel, tip);
    }
  } else if (cfg.weaponMod === 'heavy_bombs') {
    const podMat = getLegoMaterial(primaryHex, { roughness: 0.25 });
    for (const sx of [-1, 1]) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 2.8), podMat);
      rack.position.set(sx * hardpointX * 0.78, hardpointY - 0.08, 0.1);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 10), accentMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(sx * hardpointX * 0.78, hardpointY - 0.08, 1.6);
      modGroup.add(rack, cap);
    }
  }

  // 4. Propulsores & Chamas de Pós-Combustão
  if (cfg.thrusterMod && cfg.thrusterMod !== 'stock') {
    const flameMat = new THREE.MeshBasicMaterial({ color: thrObj.flameHex });
    const ringMat = getLegoMaterial(thrObj.flameHex, {
      emissive: thrObj.flameHex,
      emissiveIntensity: 0.85,
      roughness: 0.15
    });
    const sternZ = isHeli ? -1.9 : -fuseLen * 0.48;
    for (const sx of isHeli ? [-0.65, 0.65] : [-0.72, 0.72]) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.9, 12), darkMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(sx, isHeli ? 1.55 : 0.85, sternZ);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 8, 16), ringMat);
      glow.position.set(sx, isHeli ? 1.55 : 0.85, sternZ - 0.45);
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.45, 10), flameMat);
      jet.rotation.x = -Math.PI / 2;
      jet.position.set(sx, isHeli ? 1.55 : 0.85, sternZ - 1.15);
      modGroup.add(nozzle, glow, jet);
    }
    const oldFlames = rootGroup.userData?.turboFlames;
    if (Array.isArray(oldFlames)) {
      for (const fl of oldFlames) {
        if (fl?.material?.color) fl.material.color.setHex(thrObj.flameHex);
      }
    }
  }
}

export function applyAircraftCustomization(vehicleObjOrMesh, cfg) {
  const isVehicleWrap = Boolean(vehicleObjOrMesh?.mesh);
  const mesh = isVehicleWrap ? vehicleObjOrMesh.mesh : vehicleObjOrMesh;
  if (!mesh) return null;

  const aircraftType =
    cfg?.aircraftType ||
    mesh.userData?.carType ||
    mesh.userData?.vehicleSpec?.id ||
    (isVehicleWrap ? vehicleObjOrMesh.vehicleType : null) ||
    mesh.userData?.vehicleType ||
    'jato_caca';
  const safeCfg = {
    ...createDefaultAircraftConfig(aircraftType),
    ...(cfg || {}),
    aircraftType
  };

  const primaryHex = getPaletteHex(safeCfg.primaryColor, LEGO_COLORS.darkGrey);
  const secondaryHex = getPaletteHex(safeCfg.secondaryColor, LEGO_COLORS.yellow);
  const wingHex = getPaletteHex(safeCfg.wingColor, LEGO_COLORS.silver);

  const preservedUserData = {
    carType: aircraftType,
    carName: mesh.userData?.carName || NAVAL_AIR_SPECS[aircraftType]?.name || aircraftType,
    isHelicarrierParked: Boolean(mesh.userData?.isHelicarrierParked),
    _keepDynamicMatrix: Boolean(mesh.userData?._keepDynamicMatrix ?? true)
  };

  const rebuilt = createNavalOrAircraftMesh({
    type: aircraftType,
    x: 0,
    y: 0,
    z: 0,
    rotY: 0,
    color: primaryHex,
    roofColor: secondaryHex,
    wingColor: wingHex,
    finishStyle: safeCfg.finishStyle || 'glossy',
    windowTint: safeCfg.windowTint || 'stock',
    tailHue: secondaryHex
  });

  if (rebuilt) {
    while (mesh.children.length > 0) {
      mesh.remove(mesh.children[0]);
    }
    while (rebuilt.children.length > 0) {
      const child = rebuilt.children[0];
      rebuilt.remove(child);
      mesh.add(child);
    }
    mesh.userData = {
      ...mesh.userData,
      ...rebuilt.userData,
      ...preservedUserData,
      aircraftCustomConfig: { ...safeCfg }
    };
  }

  applyWindowAndHeadlightTint(mesh, safeCfg.windowTint || 'stock');
  _buildAircraftModsAndLiveries(mesh, aircraftType, safeCfg);

  const newSpec = computeCustomAircraftStats(aircraftType, safeCfg);
  mesh.userData.vehicleSpec = newSpec;

  if (isVehicleWrap) {
    vehicleObjOrMesh.spec = newSpec;
    vehicleObjOrMesh.maxHp = newSpec.hp;
    vehicleObjOrMesh.hp = newSpec.hp;
    vehicleObjOrMesh.mainRotorGroup = mesh.userData?.mainRotorGroup || null;
    vehicleObjOrMesh.tailRotorGroup = mesh.userData?.tailRotorGroup || null;
    vehicleObjOrMesh.propellerGroup = mesh.userData?.propellerGroup || null;
    vehicleObjOrMesh.turboFlames = mesh.userData?.turboFlames || [];
    vehicleObjOrMesh.userData = {
      ...(vehicleObjOrMesh.userData || {}),
      aircraftCustomConfig: { ...safeCfg }
    };
  }
  return safeCfg;
}

export function applySavedAircraftConfigsToCarrier(world) {
  const pool =
    world?.destructibles?.objects ||
    (Array.isArray(world?.drivableVehicles) ? world.drivableVehicles : []);
  if (!Array.isArray(pool) || pool.length === 0) return 0;

  const saveData = getActiveAircraftSaveData();
  let appliedCount = 0;

  for (const v of pool) {
    if (!v || v.destroyed || !v.mesh) continue;
    const spec = v.mesh.userData?.vehicleSpec || v.spec;
    const cat = spec?.category;
    if (cat !== 'plane' && cat !== 'helicopter') continue;
    const isOnCarrier = Boolean(
      v.mesh.userData?.isHelicarrierParked ||
        v.userData?.isHelicarrierParked ||
        (v.mesh.position?.y || 0) >= 398
    );
    if (!isOnCarrier) continue;
    const aircraftType = v.mesh.userData?.carType || spec?.id || v.vehicleType;
    const savedCfg = saveData?.configsByType?.[aircraftType];
    if (savedCfg) {
      applyAircraftCustomization(v, savedCfg);
      appliedCount++;
    }
  }
  return appliedCount;
}

export function spawnCustomizedCarrierAircraft(world, cfg, spawnOverride = null) {
  if (!world || !world.scene) return null;
  const aircraftType = cfg?.aircraftType || 'jato_caca';
  const isHeli = aircraftType.startsWith('heli');
  const hangarData = world.helicarrierHangarData || {};
  const fallbackPos = isHeli
    ? { x: 22, y: 410.48, z: 32, rotY: Math.PI }
    : { x: -14, y: 410.48, z: 36, rotY: Math.PI };
  const targetPos =
    spawnOverride || (isHeli ? hangarData.heliLaunchPos : hangarData.launchPos) || fallbackPos;

  const pool =
    world?.destructibles?.objects ||
    (Array.isArray(world?.drivableVehicles) ? world.drivableVehicles : []);

  let vehicle = pool.find(
    (v) =>
      v &&
      !v.destroyed &&
      (v.mesh?.userData?.carType === aircraftType ||
        v.mesh?.userData?.vehicleSpec?.id === aircraftType ||
        v.vehicleType === aircraftType) &&
      (v.mesh?.userData?.isHelicarrierParked || (v.mesh?.position?.y || 0) >= 398)
  );

  if (!vehicle) {
    const spec = computeCustomAircraftStats(aircraftType, cfg);
    const mesh = createNavalOrAircraftMesh({
      type: aircraftType,
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      rotY: targetPos.rotY ?? Math.PI
    });
    if (!mesh) return null;
    mesh.userData.carType = aircraftType;
    mesh.userData.carName = spec.name;
    mesh.userData.vehicleSpec = spec;
    mesh.userData.isHelicarrierParked = true;
    mesh.userData._keepDynamicMatrix = true;
    world.scene.add(mesh);

    if (world.destructibles?.registerDestructible) {
      vehicle = world.destructibles.registerDestructible({
        mesh,
        type: 'car',
        hp: spec.hp,
        radius: 5.5,
        height: 2.8,
        colliders: [],
        debrisColors: [LEGO_COLORS.darkGrey, LEGO_COLORS.yellow, LEGO_COLORS.silver],
        studDrops: spec.studDrops || { silver: 6, gold: 8, blue: 4, purple: 1 },
        groundY: targetPos.y,
        isDynamic: true,
        noAutoRespawn: true
      });
    } else {
      vehicle = {
        mesh,
        type: 'car',
        vehicleType: aircraftType,
        spec,
        hp: spec.hp,
        maxHp: spec.hp,
        colliders: [],
        destroyed: false,
        userData: { isHelicarrierParked: true }
      };
      if (Array.isArray(world.drivableVehicles)) world.drivableVehicles.push(vehicle);
    }
  }

  vehicle.destroyed = false;
  vehicle.shakeTimer = 0;
  vehicle.groundY = targetPos.y;
  if (Array.isArray(vehicle.colliders)) {
    for (const col of vehicle.colliders) {
      col.disabled = true;
    }
  }
  vehicle.mesh.visible = true;
  vehicle.mesh.position.set(targetPos.x, targetPos.y, targetPos.z);
  vehicle.mesh.rotation.set(0, targetPos.rotY ?? Math.PI, 0);
  if (vehicle.basePos?.set) vehicle.basePos.set(targetPos.x, targetPos.y, targetPos.z);
  applyAircraftCustomization(vehicle, cfg);
  return vehicle;
}
