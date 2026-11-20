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

function canonicalizeMaterialOptions(restOptions) {
  const keys = Object.keys(restOptions);
  if (keys.length === 0) return '';
  keys.sort();
  let out = '';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = restOptions[k];
    if (v !== undefined) {
      out += `${k}:${v};`;
    }
  }
  return out;
}

/**
 * Retorna um MeshPhysicalMaterial com acabamento PBR urbano / ABS LEGO em cache compartilhado.
 */
export function getLegoMaterial(colorHex, options = {}) {
  const resolvedColor = colorHex ?? 0xffffff;
  const { map, ...restOptions } = options;
  const key = `${resolvedColor}_${map ? map.uuid : 'nomap'}_${canonicalizeMaterialOptions(restOptions)}`;
  if (materialCache.has(key)) {
    return materialCache.get(key);
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: resolvedColor,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0.08,
    clearcoat: options.clearcoat ?? 0.06,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.48,
    reflectivity: 0.35,
    ...(options.transparent ? { transparent: true, opacity: options.opacity ?? 0.65 } : {}),
    ...(options.emissive ? { emissive: options.emissive, emissiveIntensity: options.emissiveIntensity ?? 1.0 } : {}),
    ...(options.map ? { map: options.map } : {})
  });
  const defaultBevel = options.transparent ? 0.2 : options.emissive ? 0.3 : 1.0;
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
