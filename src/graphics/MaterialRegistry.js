import * as THREE from 'three';
import {
  LEGO_COLORS,
  applyLegoSurfaceFX,
  markAsSharedAsset
} from '../materials/LegoMaterials.js';

const SHARED_BASIC_POOL = new Map();
const SHARED_STANDARD_POOL = new Map();
const SHARED_PHYSICAL_POOL = new Map();
const SHARED_TEXTURED_POOL = new Map();
const SHARED_VEHICLE_GLASS_POOL = new Map();

const CURATED_NOIR_SWATCHES = (() => {
  const hexes = [
    LEGO_COLORS.black,
    LEGO_COLORS.darkGrey,
    LEGO_COLORS.lightGrey,
    LEGO_COLORS.white,
    0xcbd5e1,
    LEGO_COLORS.yellow,
    LEGO_COLORS.red,
    LEGO_COLORS.blue,
    LEGO_COLORS.cyan,
    LEGO_COLORS.green,
    LEGO_COLORS.brown,
    LEGO_COLORS.purple
  ];
  return Array.from(new Set(hexes)).map((hex) => ({
    hex,
    r: (hex >> 16) & 0xff,
    g: (hex >> 8) & 0xff,
    b: hex & 0xff
  }));
})();

const SNAP_CACHE = new Map();

export function quantizeColorHex(hex, step = 16) {
  const c = typeof hex === 'number' ? hex : new THREE.Color(hex ?? 0xffffff).getHex();
  if (step <= 1) return c & 0xffffff;
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 0xff) / step) * step));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 0xff) / step) * step));
  const b = Math.min(255, Math.max(0, Math.round((c & 0xff) / step) * step));
  return (r << 16) | (g << 8) | b;
}

export function snapToNoirSwatchHex(hex) {
  const q = quantizeColorHex(hex, 8);
  const cached = SNAP_CACHE.get(q);
  if (cached !== undefined) return cached;

  const r = (q >> 16) & 0xff;
  const g = (q >> 8) & 0xff;
  const b = q & 0xff;
  let bestHex = CURATED_NOIR_SWATCHES[0].hex;
  let bestDist = Infinity;
  for (let i = 0; i < CURATED_NOIR_SWATCHES.length; i++) {
    const s = CURATED_NOIR_SWATCHES[i];
    const dr = r - s.r;
    const dg = g - s.g;
    const db = b - s.b;
    const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (d < bestDist) {
      bestDist = d;
      bestHex = s.hex;
      if (d === 0) break;
    }
  }
  SNAP_CACHE.set(q, bestHex);
  return bestHex;
}

function snapEmissiveAccentHex(hex) {
  if (!hex) return 0;
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  if (r > g + 45 && r > b + 35) return LEGO_COLORS.red;
  if (b > r + 35) return LEGO_COLORS.cyan;
  return LEGO_COLORS.yellow;
}

function addProtectedMat(set, mat) {
  if (!mat) return;
  if (Array.isArray(mat)) {
    for (let i = 0; i < mat.length; i++) {
      if (mat[i] && typeof mat[i] === 'object') set.add(mat[i]);
    }
    return;
  }
  if (typeof mat === 'object') {
    set.add(mat);
  }
}

function addProtectedList(set, list, prop = null) {
  if (!list) return;
  for (const item of list) {
    if (!item) continue;
    addProtectedMat(set, prop ? item[prop] : item);
  }
}

function deduplicateAnimatedMatList(list, keyFn, remapMap) {
  if (!Array.isArray(list) || list.length <= 1) return list;
  const canonicalByKey = new Map();
  const nextList = [];
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (!m) continue;
    const k = keyFn(m);
    let canon = canonicalByKey.get(k);
    if (!canon) {
      canon = markAsSharedAsset(m);
      canonicalByKey.set(k, canon);
      nextList.push(canon);
    } else if (m !== canon) {
      remapMap.set(m, canon);
    }
  }
  list.length = 0;
  for (let i = 0; i < nextList.length; i++) list.push(nextList[i]);
  return list;
}

function deduplicateObjectPropMats(items, prop, keyFn, remapMap) {
  if (!Array.isArray(items) || items.length <= 1) return;
  const canonicalByKey = new Map();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const m = item?.[prop];
    if (!m) continue;
    const k = keyFn(m, item);
    let canon = canonicalByKey.get(k);
    if (!canon) {
      canon = markAsSharedAsset(m);
      canonicalByKey.set(k, canon);
    } else if (m !== canon) {
      remapMap.set(m, canon);
      item[prop] = canon;
    }
  }
}

function downgradeProtectedPhysToStd(mat, remapMap) {
  if (!mat || !mat.isMeshPhysicalMaterial || mat.transparent) return mat;
  if (remapMap.has(mat)) return remapMap.get(mat);
  const std = markAsSharedAsset(
    new THREE.MeshStandardMaterial({
      color: mat.color ? mat.color.getHex() : 0xffffff,
      roughness: mat.roughness ?? 0.45,
      metalness: mat.metalness ?? 0.12,
      emissive: mat.emissive ? mat.emissive.getHex() : 0,
      emissiveIntensity: mat.emissiveIntensity ?? 0,
      side: mat.side ?? THREE.FrontSide
    })
  );
  std.userData = { ...mat.userData };
  remapMap.set(mat, std);
  return std;
}

function deduplicateWorldDynamicPools(world, remapMap) {
  if (!world) return;
  if (world.atmosphere?.landmarkNeonMaterials) {
    deduplicateAnimatedMatList(
      world.atmosphere.landmarkNeonMaterials,
      (m) => `${snapEmissiveAccentHex(m.color?.getHex?.() ?? 0xffffff) || LEGO_COLORS.white}_${m.transparent ? Math.round((m.userData?.maxOpacity ?? m.opacity ?? 0.28) * 2) : 'op'}`,
      remapMap
    );
  }
  if (world.favelaEmissiveMats?.windows) {
    deduplicateAnimatedMatList(world.favelaEmissiveMats.windows, () => 'fav_win', remapMap);
  }
  if (world.favelaEmissiveMats?.bulbs) {
    deduplicateAnimatedMatList(world.favelaEmissiveMats.bulbs, () => 'fav_bulb', remapMap);
  }
  deduplicateObjectPropMats(world.favelaSoccerFloodCones, 'mat', () => 'fav_soccer_cone', remapMap);
  deduplicateObjectPropMats(world.favelaBaileSkytrackers, 'mat', (_m, it) => `fav_sky_${it.mat?.color?.getHex?.() ?? 0}`, remapMap);
  deduplicateObjectPropMats(world.favelaSummitBeacons, 'haloMat', () => 'fav_summit_halo', remapMap);

  const hcFx = world.helicarrierNightFX;
  if (hcFx) {
    deduplicateAnimatedMatList(hcFx.bridgeWindowMats, () => 'hc_win', remapMap);
    deduplicateAnimatedMatList(hcFx.deckStripMats, () => 'hc_strip', remapMap);
    deduplicateAnimatedMatList(hcFx.hangarGlowMats, () => 'hc_glow', remapMap);
    deduplicateAnimatedMatList(hcFx.plasmaMats, () => 'hc_plasma', remapMap);
  }

  if (world.territoryInfra && typeof world.territoryInfra === 'object') {
    for (const [fKey, infra] of Object.entries(world.territoryInfra)) {
      if (!infra) continue;
      if (Array.isArray(infra.gates) && infra.gates.length > 0) {
        let sharedFlag = null;
        for (const g of infra.gates) {
          if (!g?.flagMat) continue;
          if (!sharedFlag) {
            sharedFlag = downgradeProtectedPhysToStd(g.flagMat, remapMap);
            g.flagMat = sharedFlag;
          } else {
            remapMap.set(g.flagMat, sharedFlag);
            g.flagMat = sharedFlag;
          }
        }
      }
      const zs = world.livingCity?.factionWar?.zoneStates?.[fKey] || world.livingCity?.factionWar?.territories?.[fKey];
      if (Array.isArray(infra.outposts)) {
        for (let idx = 0; idx < infra.outposts.length; idx++) {
          const op = infra.outposts[idx];
          if (!op) continue;
          const rawBollard = Array.isArray(op.bollardMats) ? op.bollardMats[0] : op.bollardMats;
          const canonStd = rawBollard ? downgradeProtectedPhysToStd(rawBollard, remapMap) : null;
          if (canonStd && canonStd.isMeshStandardMaterial) {
            canonStd.side = THREE.DoubleSide;
            markAsSharedAsset(canonStd);
            if (Array.isArray(op.bollardMats)) {
              for (let i = 0; i < op.bollardMats.length; i++) {
                if (op.bollardMats[i] && op.bollardMats[i] !== canonStd) remapMap.set(op.bollardMats[i], canonStd);
              }
            } else if (op.bollardMats && op.bollardMats !== canonStd) {
              remapMap.set(op.bollardMats, canonStd);
            }
            op.bollardMats = canonStd;
            if (op.ringMat && op.ringMat !== canonStd && !op.ringMat.transparent) {
              remapMap.set(op.ringMat, canonStd);
              op.ringMat = canonStd;
            }
            if (op.beaconMat && op.beaconMat !== canonStd && !op.beaconMat.transparent) {
              remapMap.set(op.beaconMat, canonStd);
              op.beaconMat = canonStd;
            }
          } else {
            if (op.beaconMat) op.beaconMat = downgradeProtectedPhysToStd(op.beaconMat, remapMap);
            if (Array.isArray(op.bollardMats) && op.bollardMats.length > 0) {
              const firstBol = downgradeProtectedPhysToStd(op.bollardMats[0], remapMap);
              for (let i = 1; i < op.bollardMats.length; i++) {
                if (op.bollardMats[i]) remapMap.set(op.bollardMats[i], firstBol);
              }
              op.bollardMats = [firstBol];
            } else if (op.bollardMats) {
              op.bollardMats = downgradeProtectedPhysToStd(op.bollardMats, remapMap);
            }
          }
          if (zs) {
            const match = Array.isArray(zs.outposts) ? zs.outposts.find((zop) => zop && zop.id === op.id) : null;
            if (match) {
              if (match.beaconMat && op.beaconMat && match.beaconMat !== op.beaconMat) {
                remapMap.set(match.beaconMat, op.beaconMat);
              }
              if (match.bollardMats && op.bollardMats && match.bollardMats !== op.bollardMats) {
                if (Array.isArray(match.bollardMats)) {
                  for (let i = 0; i < match.bollardMats.length; i++) {
                    if (match.bollardMats[i]) remapMap.set(match.bollardMats[i], op.bollardMats);
                  }
                } else {
                  remapMap.set(match.bollardMats, op.bollardMats);
                }
              }
              match.beaconMat = op.beaconMat;
              match.bollardMats = op.bollardMats;
              if (match.ringMat && op.ringMat && match.ringMat !== op.ringMat) {
                remapMap.set(match.ringMat, op.ringMat);
                match.ringMat = op.ringMat;
              }
              if (match.spotlightMat && op.spotlightMat && match.spotlightMat !== op.spotlightMat) {
                remapMap.set(match.spotlightMat, op.spotlightMat);
                match.spotlightMat = op.spotlightMat;
              }
            }
            const capZone = Array.isArray(zs.captureZones) ? zs.captureZones[idx] : null;
            if (capZone?.ringMat && op.ringMat && capZone.ringMat !== op.ringMat && !capZone.ringMat.transparent) {
              remapMap.set(capZone.ringMat, op.ringMat);
              capZone.ringMat = op.ringMat;
            }
          }
        }
      }
    }
  }
}

export function collectProtectedDynamicMaterials(world = null) {
  const dynamicMats = new Set();
  if (!world) return dynamicMats;

  const atm = world.atmosphere;
  if (atm) {
    addProtectedList(dynamicMats, atm.landmarkNeonMaterials);
    addProtectedMat(dynamicMats, atm.starMat);
    addProtectedMat(dynamicMats, atm.sunCoreMat);
    addProtectedMat(dynamicMats, atm.sunHaloMat);
    addProtectedMat(dynamicMats, atm.moonCoreMat);
    addProtectedMat(dynamicMats, atm.moonCraterMat);
    addProtectedMat(dynamicMats, atm.moonHaloMat);
    addProtectedMat(dynamicMats, atm.bulbInstMat);
    addProtectedMat(dynamicMats, atm.coneInstMat);
    addProtectedMat(dynamicMats, atm.poolInstMat);
    addProtectedMat(dynamicMats, atm._metroGlassMat);
  }

  if (world.favelaEmissiveMats) {
    addProtectedList(dynamicMats, world.favelaEmissiveMats.windows);
    addProtectedList(dynamicMats, world.favelaEmissiveMats.bulbs);
  }
  addProtectedList(dynamicMats, world.southBeachEmissiveMats);
  addProtectedList(dynamicMats, world.favelaSoccerFloodCones, 'mat');
  addProtectedList(dynamicMats, world.favelaBaileSkytrackers, 'mat');
  addProtectedList(dynamicMats, world.favelaSummitBeacons, 'haloMat');

  const hcFx = world.helicarrierNightFX;
  if (hcFx) {
    addProtectedList(dynamicMats, hcFx.bridgeWindowMats);
    addProtectedList(dynamicMats, hcFx.deckStripMats);
    addProtectedList(dynamicMats, hcFx.hangarGlowMats);
    addProtectedList(dynamicMats, hcFx.plasmaMats);
  }

  if (world.territoryInfra && typeof world.territoryInfra === 'object') {
    for (const infra of Object.values(world.territoryInfra)) {
      if (!infra) continue;
      addProtectedList(dynamicMats, infra.gates, 'flagMat');
      if (Array.isArray(infra.outposts)) {
        for (const op of infra.outposts) {
          if (!op) continue;
          addProtectedMat(dynamicMats, op.ringMat);
          addProtectedMat(dynamicMats, op.bollardMats);
          addProtectedMat(dynamicMats, op.beaconMat);
          addProtectedMat(dynamicMats, op.spotlightMat);
        }
      }
    }
  }

  const zoneStates = world.livingCity?.factionWar?.zoneStates;
  if (zoneStates && typeof zoneStates === 'object') {
    for (const st of Object.values(zoneStates)) {
      if (!st) continue;
      addProtectedList(dynamicMats, st.captureZones, 'ringMat');
      if (Array.isArray(st.outposts)) {
        for (const op of st.outposts) {
          if (!op) continue;
          addProtectedMat(dynamicMats, op.ringMat);
          addProtectedMat(dynamicMats, op.bollardMats);
          addProtectedMat(dynamicMats, op.beaconMat);
          addProtectedMat(dynamicMats, op.spotlightMat);
        }
      }
    }
  }

  return dynamicMats;
}

function isProtectedMaterial(mat, _obj, dynamicMats) {
  if (!mat || dynamicMats.has(mat)) return true;
  const ud = mat.userData;
  if (ud?.hasAnimatedLegoWater || ud?.isDynamicMaterial) {
    return true;
  }
  if (
    mat.isShaderMaterial ||
    mat.isRawShaderMaterial ||
    mat.isPointsMaterial ||
    mat.isLineBasicMaterial ||
    mat.isLineDashedMaterial ||
    mat.isSpriteMaterial
  ) {
    return true;
  }
  return false;
}

function countSceneUniqueMaterials(scene) {
  const unique = new Set();
  scene.traverse((obj) => {
    if (!obj || !obj.material) return;
    if (Array.isArray(obj.material)) {
      for (let i = 0; i < obj.material.length; i++) {
        if (obj.material[i]) unique.add(obj.material[i]);
      }
    } else {
      unique.add(obj.material);
    }
  });
  return unique.size;
}

function consolidateSingleMaterial(m, obj, dynamicMats, remapMap) {
  if (!m) return m;
  const remapped = remapMap.get(m);
  if (remapped) return remapped;
  if (isProtectedMaterial(m, obj, dynamicMats)) return m;

  // Deduplica para-brisas automotivos (preserva a 1ª instância transparente como canônica; rebaixa opacos p/ Standard!)
  if (m.userData?.isVehicleGlass || obj?.userData?.isVehicleGlass) {
    const gKey = `${m.transparent ? 'trans' : 'opaque'}_${quantizeColorHex(m.color?.getHex?.() ?? 0x38bdf8, 64)}`;
    let sharedGlass = SHARED_VEHICLE_GLASS_POOL.get(gKey);
    if (!sharedGlass) {
      if (m.transparent) {
        m.userData = m.userData || {};
        m.userData.isVehicleGlass = true;
        sharedGlass = markAsSharedAsset(m);
      } else {
        sharedGlass = new THREE.MeshStandardMaterial({
          color: snapToNoirSwatchHex(m.color?.getHex?.() ?? 0x090a0d),
          roughness: 0.16,
          metalness: 0.35
        });
        sharedGlass.clearcoat = 0;
        sharedGlass.userData = { ...m.userData, isVehicleGlass: true };
        applyLegoSurfaceFX(sharedGlass, { bevelWeight: 0.25 });
        markAsSharedAsset(sharedGlass);
      }
      SHARED_VEHICLE_GLASS_POOL.set(gKey, sharedGlass);
    }
    return sharedGlass;
  }

  if (m.map || m.emissiveMap || m.alphaMap) {
    if (
      m.transparent &&
      (m.opacity ?? 1) >= 0.92 &&
      !m.alphaMap &&
      (m.blending === undefined || m.blending === THREE.NormalBlending)
    ) {
      m.alphaTest = Math.max(m.alphaTest || 0, 0.42);
      m.transparent = false;
      m.depthWrite = true;
    }
    const texKey = `${m.type}|${m.map?.uuid || ''}|${m.emissiveMap?.uuid || ''}|${m.alphaMap?.uuid || ''}|${m.transparent ? 1 : 0}|${Math.round((m.alphaTest || 0) * 20)}|${m.polygonOffset ? 1 : 0}`;
    let sharedTexMat = SHARED_TEXTURED_POOL.get(texKey);
    if (!sharedTexMat) {
      if (m.isMeshPhysicalMaterial && !m.transparent) {
        sharedTexMat = new THREE.MeshStandardMaterial({
          color: m.color ? m.color.getHex() : 0xffffff,
          map: m.map || null,
          emissive: m.emissive ? m.emissive.getHex() : 0,
          emissiveMap: m.emissiveMap || null,
          emissiveIntensity: m.emissiveIntensity ?? 0,
          roughness: m.roughness ?? 0.35,
          metalness: m.metalness ?? 0.08,
          alphaTest: m.alphaTest || 0,
          side: m.side ?? THREE.FrontSide,
          polygonOffset: Boolean(m.polygonOffset),
          polygonOffsetFactor: m.polygonOffsetFactor || 0,
          polygonOffsetUnits: m.polygonOffsetUnits || 0
        });
        markAsSharedAsset(sharedTexMat);
      } else {
        sharedTexMat = markAsSharedAsset(m);
      }
      SHARED_TEXTURED_POOL.set(texKey, sharedTexMat);
    }
    return sharedTexMat;
  }

  if (
    m.transparent &&
    (m.opacity ?? 1) >= 0.80 &&
    (m.blending === undefined || m.blending === THREE.NormalBlending)
  ) {
    m.transparent = false;
    m.opacity = 1;
  }

  if (m.isMeshBasicMaterial) {
    const rawHex = m.color ? m.color.getHex() : 0xffffff;
    const swatchHex = m.vertexColors
      ? 0xffffff
      : m.transparent
        ? snapEmissiveAccentHex(rawHex) || LEGO_COLORS.white
        : snapToNoirSwatchHex(rawHex);
    const isAdd = m.blending === THREE.AdditiveBlending;
    const key = `${swatchHex}|t:${m.transparent ? 1 : 0}|a:${isAdd ? 1 : 0}|vc:${m.vertexColors ? 1 : 0}|po:${m.polygonOffset ? 1 : 0}`;
    let shared = SHARED_BASIC_POOL.get(key);
    if (!shared) {
      shared = new THREE.MeshBasicMaterial({
        color: swatchHex,
        transparent: Boolean(m.transparent),
        opacity: m.transparent ? 0.52 : 1,
        blending: isAdd ? THREE.AdditiveBlending : THREE.NormalBlending,
        side: m.transparent ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: !m.transparent,
        vertexColors: Boolean(m.vertexColors),
        polygonOffset: Boolean(m.polygonOffset),
        polygonOffsetFactor: m.polygonOffset ? -1 : 0,
        polygonOffsetUnits: m.polygonOffset ? -1 : 0
      });
      markAsSharedAsset(shared);
      SHARED_BASIC_POOL.set(key, shared);
    }
    return shared;
  }

  if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
    const rawHex = m.color ? m.color.getHex() : 0xffffff;
    const swatchHex = m.vertexColors ? 0xffffff : snapToNoirSwatchHex(rawHex);
    const rawEmHex = m.emissive && (m.emissiveIntensity ?? 0) > 0.2 ? m.emissive.getHex() : 0;
    const emSwatch = snapEmissiveAccentHex(rawEmHex);
    const keepPhysical = Boolean(m.isMeshPhysicalMaterial && (m.transparent || m.userData?.forcePhysical === true));

    if (keepPhysical) {
      const physKey = `${m.transparent ? 'glass' : swatchHex}|vc:${m.vertexColors ? 1 : 0}`;
      let sharedPhys = SHARED_PHYSICAL_POOL.get(physKey);
      if (!sharedPhys) {
        sharedPhys = new THREE.MeshPhysicalMaterial({
          color: m.transparent ? LEGO_COLORS.cyan : swatchHex,
          roughness: 0.18,
          metalness: 0.12,
          clearcoat: 0.35,
          clearcoatRoughness: 0.25,
          transparent: Boolean(m.transparent),
          opacity: m.transparent ? 0.52 : 1,
          vertexColors: Boolean(m.vertexColors),
          side: m.transparent ? THREE.DoubleSide : THREE.FrontSide
        });
        applyLegoSurfaceFX(sharedPhys, { bevelWeight: 0.2 });
        markAsSharedAsset(sharedPhys);
        SHARED_PHYSICAL_POOL.set(physKey, sharedPhys);
      }
      return sharedPhys;
    }

    // Luzes estáticas pequenas puramente emissivas usam MeshBasicMaterial leve (zero custo PBR duplicado)
    if (emSwatch && !m.vertexColors && !m.polygonOffset) {
      const emKey = `${emSwatch}|t:0|a:0|vc:0|po:0`;
      let emBasic = SHARED_BASIC_POOL.get(emKey);
      if (!emBasic) {
        emBasic = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: emSwatch }));
        SHARED_BASIC_POOL.set(emKey, emBasic);
      }
      return emBasic;
    }

    const pbrKey = `${swatchHex}|vc:${m.vertexColors ? 1 : 0}|po:${m.polygonOffset ? 1 : 0}`;
    let sharedStd = SHARED_STANDARD_POOL.get(pbrKey);
    if (!sharedStd) {
      sharedStd = new THREE.MeshStandardMaterial({
        color: swatchHex,
        roughness: 0.5,
        metalness: 0.12,
        transparent: false,
        opacity: 1,
        vertexColors: Boolean(m.vertexColors),
        polygonOffset: Boolean(m.polygonOffset),
        polygonOffsetFactor: m.polygonOffset ? -1 : 0,
        polygonOffsetUnits: m.polygonOffset ? -1 : 0,
        side: THREE.FrontSide
      });
      sharedStd.clearcoat = 0;
      applyLegoSurfaceFX(sharedStd, { bevelWeight: 0.45 });
      markAsSharedAsset(sharedStd);
      SHARED_STANDARD_POOL.set(pbrKey, sharedStd);
    }
    return sharedStd;
  }

  return m;
}

export function consolidateObjectMaterials(root, world = null, existingDynamicMats = null, existingRemap = null) {
  if (!root || typeof root.traverse !== 'function') return;
  const remapMap = existingRemap || new Map();
  const dynamicMats = existingDynamicMats || collectProtectedDynamicMaterials(world);
  root.traverse((obj) => {
    if (!obj || !obj.material) return;
    if (Array.isArray(obj.material)) {
      for (let i = 0; i < obj.material.length; i++) {
        obj.material[i] = consolidateSingleMaterial(obj.material[i], obj, dynamicMats, remapMap);
      }
    } else {
      obj.material = consolidateSingleMaterial(obj.material, obj, dynamicMats, remapMap);
    }
  });
}

export function consolidateSceneMaterials(scene, world = null) {
  if (!scene || typeof scene.traverse !== 'function') {
    return { beforeCount: 0, afterCount: 0 };
  }

  const beforeCount = countSceneUniqueMaterials(scene);
  const remapMap = new Map();
  deduplicateWorldDynamicPools(world, remapMap);
  const dynamicMats = collectProtectedDynamicMaterials(world);

  consolidateObjectMaterials(scene, world, dynamicMats, remapMap);

  const bikeMesh = world?.destructibles?._turboGhostBikeObj?.mesh;
  if (bikeMesh) consolidateObjectMaterials(bikeMesh, world, dynamicMats, remapMap);
  const fw = world?.livingCity?.factionWar;
  if (fw?._soldierVisualPool) {
    for (const bucket of fw._soldierVisualPool.values()) {
      for (let i = 0; i < bucket.length; i++) {
        if (bucket[i]?.root) consolidateObjectMaterials(bucket[i].root, world, dynamicMats, remapMap);
      }
    }
  }
  if (fw?._convoyCarPool) {
    for (const bucket of fw._convoyCarPool.values()) {
      for (let i = 0; i < bucket.length; i++) {
        consolidateObjectMaterials(bucket[i], world, dynamicMats, remapMap);
      }
    }
  }

  const afterCount = countSceneUniqueMaterials(scene);
  return { beforeCount, afterCount };
}
