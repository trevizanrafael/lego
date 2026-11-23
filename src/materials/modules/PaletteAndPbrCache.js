import * as THREE from 'three';
import { applyLegoSurfaceFX } from './SceneAndWaterShaders.js';

/**
 * Paleta sombria e dessaturada estilo Gotham Noir / DC Super-Villains (Opção 2 — Sem cores infantis estouradas),
 * cache PBR, ciclo de vida seguro de assets compartilhados e construtores base de blocos LEGO.
 */
export const LEGO_COLORS = {
  yellow: 0xd99b16,       // Mostarda Queimado / Âmbar Táxi Gotham
  red: 0x9f1d20,          // Vermelho Sangue Seco / Carmesim Sombrio
  crimson: 0x6b1114,      // Sangue Profundo
  blue: 0x1d3b6e,         // Azul Aço Noturno
  navy: 0x111f3d,         // Azul Abissal
  black: 0x0b0d11,        // Preto Obsidiana
  charcoal: 0x1a1d24,     // Grafite Arma (Gunmetal)
  darkGrey: 0x323844,     // Concreto Escuro Desgastado
  lightGrey: 0x6e7685,    // Pedra Cinza-Chumbo (Smog)
  white: 0xd6dce5,        // Off-White Urbano Frio (nunca branco estourado de brinquedo)
  green: 0x1d4d2b,        // Verde Musgo Sombrio / Pinho Escuro
  darkGreen: 0x13331d,    // Verde Pântano Profundo
  sandGreen: 0x3b6e5c,    // Cobre Oxidado / Pátina de Gotham
  orange: 0xc25115,       // Ferrugem / Vapor de Sódio
  tan: 0x9c8769,          // Arenito Envelhecido Sóbrio
  brown: 0x4a2511,        // Madeira Carbonizada / Terra Úmida
  nougat: 0x8c4a20,       // Tijolo Queimado Escuro
  cyan: 0x0e7490,         // Azul-Petróleo Profundo
  purple: 0x6b21a8,       // Violeta Sombrio (A.R.E.S.)
  gold: 0xb47b12,         // Latão / Ouro Envelhecido
  silver: 0x8b95a5,       // Aço Escovado Oxidado
  asphalt: 0x0b0d12,      // Asfalto Negro Úmido de Gotham
  sidewalk: 0x343a46,     // Calçada Escura de Concreto Sujo
  concrete: 0x282d38,     // Concreto Brutalista Pesado
  darkBlue: 0x122244      // Azul Corporativo Noturno
};

const materialCache = new Map();
const SHARED_ASSETS = new WeakSet();

export function markAsSharedAsset(asset) {
  if (asset && typeof asset === 'object') {
    SHARED_ASSETS.add(asset);
  }
  return asset;
}

export function isSharedAsset(asset) {
  return Boolean(asset && SHARED_ASSETS.has(asset));
}

export function disposeMaterialSafe(mat) {
  if (!mat || SHARED_ASSETS.has(mat)) return;
  const texProps = ['map', 'emissiveMap', 'alphaMap', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap'];
  for (let i = 0; i < texProps.length; i++) {
    const tex = mat[texProps[i]];
    if (tex && !SHARED_ASSETS.has(tex) && typeof tex.dispose === 'function') {
      tex.dispose();
    }
  }
  if (typeof mat.dispose === 'function') {
    mat.dispose();
  }
}

export function disposeTransientObject3D(root) {
  if (!root || SHARED_ASSETS.has(root)) return;
  const seenGeos = new Set();
  const seenMats = new Set();
  root.traverse((node) => {
    if (SHARED_ASSETS.has(node)) return;
    const geo = node.geometry;
    if (geo && !SHARED_ASSETS.has(geo) && !seenGeos.has(geo) && typeof geo.dispose === 'function') {
      seenGeos.add(geo);
      geo.dispose();
    }
    const mat = node.material;
    if (!mat) return;
    if (Array.isArray(mat)) {
      for (let i = 0; i < mat.length; i++) {
        const m = mat[i];
        if (m && !seenMats.has(m)) {
          seenMats.add(m);
          disposeMaterialSafe(m);
        }
      }
    } else if (!seenMats.has(mat)) {
      seenMats.add(mat);
      disposeMaterialSafe(mat);
    }
  });
}

export function quantizeColorHex(hex, step = 12) {
  const c = typeof hex === 'number' ? hex : new THREE.Color(hex ?? 0xffffff).getHex();
  if (step <= 1) return c & 0xffffff;
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 0xff) / step) * step));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 0xff) / step) * step));
  const b = Math.min(255, Math.max(0, Math.round((c & 0xff) / step) * step));
  return (r << 16) | (g << 8) | b;
}

function quantizeStep(value, step, min = 0, max = 1) {
  const q = Math.round(value / step) * step;
  return Number(Math.min(max, Math.max(min, q)).toFixed(2));
}

/**
 * Retorna um material PBR urbano otimizado em cache compartilhado:
 * - `THREE.MeshPhysicalMaterial` apenas para vidros reais e carenagens automotivas (`physical: true`, `clearcoat >= 0.35` ou transparente real).
 * - `THREE.MeshStandardMaterial` leve para todo o restante (95%+ das superfícies opacas), com quantização de parâmetros e ignorando flags de malha.
 */
export function getLegoMaterial(colorHex, options = {}) {
  const resolvedColor =
    typeof colorHex === 'number'
      ? colorHex
      : colorHex != null
        ? new THREE.Color(colorHex).getHex()
        : 0xffffff;

  const qColor = quantizeColorHex(resolvedColor, 12);
  const qRoughness = quantizeStep(options.roughness ?? 0.58, 0.15, 0, 1);
  const qMetalness = quantizeStep(options.metalness ?? 0.08, 0.2, 0, 1);

  const rawOpacity = options.opacity !== undefined ? options.opacity : (options.transparent ? 0.65 : 1.0);
  const isTransparent = Boolean(options.transparent) && rawOpacity < 0.96;
  const qOpacity = isTransparent ? quantizeStep(rawOpacity, 0.15, 0.05, 0.95) : 1;

  const clearcoatVal = options.clearcoat ?? 0;
  const usePhysical = options.physical === true || clearcoatVal >= 0.35 || isTransparent;
  const qClearcoat = usePhysical
    ? quantizeStep(options.clearcoat ?? (isTransparent ? 0.15 : 0.4), 0.15, 0, 1)
    : 0;

  const emissiveHex = options.emissive
    ? typeof options.emissive === 'number'
      ? options.emissive
      : new THREE.Color(options.emissive).getHex()
    : 0;
  const qEmissive = emissiveHex ? quantizeColorHex(emissiveHex, 16) : 0;
  const qEmissiveInt = emissiveHex ? quantizeStep(options.emissiveIntensity ?? 1.0, 0.25, 0, 8) : 0;
  const mapKey = options.map ? options.map.uuid : 'nomap';
  const side = options.side ?? THREE.FrontSide;
  const vertexColors = Boolean(options.vertexColors);
  const polyOffset = options.polygonOffset ? (options.polygonOffsetFactor ?? -1) : 0;

  const key = `${usePhysical ? 'P' : 'S'}_${qColor}_r${qRoughness}_m${qMetalness}_cc${qClearcoat}_t${isTransparent ? qOpacity : 0}_e${qEmissive}_${qEmissiveInt}_${mapKey}_s${side}_vc${vertexColors ? 1 : 0}_po${polyOffset}`;
  if (materialCache.has(key)) {
    return materialCache.get(key);
  }

  const baseParams = {
    color: resolvedColor,
    roughness: qRoughness,
    metalness: qMetalness,
    side,
    vertexColors,
    ...(isTransparent ? { transparent: true, opacity: qOpacity } : { transparent: false, opacity: 1 }),
    ...(emissiveHex ? { emissive: emissiveHex, emissiveIntensity: qEmissiveInt } : {}),
    ...(options.map ? { map: options.map } : {}),
    ...(options.polygonOffset
      ? {
          polygonOffset: true,
          polygonOffsetFactor: options.polygonOffsetFactor ?? -1,
          polygonOffsetUnits: options.polygonOffsetUnits ?? -1
        }
      : {})
  };

  let mat;
  if (usePhysical) {
    mat = new THREE.MeshPhysicalMaterial({
      ...baseParams,
      clearcoat: options.clearcoat ?? qClearcoat,
      clearcoatRoughness: options.clearcoatRoughness ?? 0.48,
      reflectivity: 0.35
    });
  } else {
    mat = new THREE.MeshStandardMaterial(baseParams);
    mat.clearcoat = 0;
  }

  const defaultBevel = isTransparent ? 0.2 : emissiveHex ? 0.3 : 1.0;
  applyLegoSurfaceFX(mat, { bevelWeight: options.bevelWeight ?? defaultBevel });
  markAsSharedAsset(mat);

  materialCache.set(key, mat);
  return mat;
}

// Geometria compartilhada otimizada (8 lados) para os pinos cilíndricos de LEGO (Studs)
// Remove apenas os triângulos da tampa inferior (nunca visíveis por baixo do pino), mantendo parede + topo (24 tris/stud).
export const SHARED_STUD_GEO = (() => {
  const geo = new THREE.CylinderGeometry(0.16, 0.16, 0.11, 8);
  geo.translate(0, 0.055, 0);
  const idx = geo.getIndex();
  const pos = geo.getAttribute('position');
  if (idx && pos) {
    const kept = [];
    const arr = idx.array;
    for (let i = 0; i < arr.length; i += 3) {
      const a = arr[i];
      const b = arr[i + 1];
      const c = arr[i + 2];
      if (pos.getY(a) < 0.02 && pos.getY(b) < 0.02 && pos.getY(c) < 0.02) continue;
      kept.push(a, b, c);
    }
    geo.setIndex(kept);
    geo.clearGroups();
  }
  return geo;
})();
markAsSharedAsset(SHARED_STUD_GEO);

/**
 * Cria um bloco LEGO (Brick/Plate) com pinos (studs) no topo usando InstancedMesh quando há muitos pinos
 */
export function createLegoBrick(width, height, depth, colorHex, options = {}) {
  const group = new THREE.Group();
  const mat = getLegoMaterial(colorHex, options);

  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const bodyMesh = new THREE.Mesh(bodyGeo, mat);
  bodyMesh.castShadow = options.castShadow ?? true;
  bodyMesh.receiveShadow = options.receiveShadow ?? true;
  group.add(bodyMesh);

  // Opção 2 (Studless por padrão no mundo/carros; pinos só quando explicitamente solicitado com studs: true)
  if (options.studs === true) {
    const step = options.studStep ?? 0.6;
    const cols = Math.max(1, Math.floor(width / step));
    const rows = Math.max(1, Math.floor(depth / step));
    const count = cols * rows;

    const instancedStuds = new THREE.InstancedMesh(SHARED_STUD_GEO, mat, count);
    // Pinos minúsculos (0.11m) não precisam projetar sombra no ShadowMap 1024x1024 (economiza centenas de Draw Calls de sombra!)
    instancedStuds.castShadow = false;
    instancedStuds.receiveShadow = options.receiveShadow ?? true;

    const dummy = new THREE.Object3D();
    const startX = -((cols - 1) * step) / 2;
    const startZ = -((rows - 1) * step) / 2;
    let idx = 0;

    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        dummy.position.set(startX + ix * step, height / 2, startZ + iz * step);
        dummy.updateMatrix();
        instancedStuds.setMatrixAt(idx++, dummy.matrix);
      }
    }
    instancedStuds.instanceMatrix.needsUpdate = true;
    group.add(instancedStuds);
  }

  return group;
}

/**
 * Configura filtragem trilinear, SRGB e anisotropia em CanvasTexture procedural de alta nitidez.
 */
export function configureCrispCanvasTexture(tex, anisotropy = 8) {
  if (!tex) return tex;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.max(tex.anisotropy || 1, anisotropy);
  tex.needsUpdate = true;
  return tex;
}
