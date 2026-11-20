import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getLegoMaterial, SHARED_STUD_GEO } from '../../materials/LegoMaterials.js';

// Pose de mira padrão (arma na altura do peito, estilo atirador)
export const AIM_POSE = { rightArmX: -1.22, leftArmX: -1.05, leftArmZ: 0.55, shieldArmX: -0.55 };

export const SOLDIER_ROLES = ['rifleman', 'tank', 'medic', 'special', 'boss'];

export const SOLDIER_CLASS_INFO = {
  cv: {
    rifleman: 'FUZILEIRO DO MORRO',
    tank: 'BLINDADO DA PORTA',
    medic: 'SOCORRISTA DO BAILE',
    special: 'ARTILHEIRO RPG',
    boss: 'TROVÃO RUBRO'
  },
  pcc: {
    rifleman: 'OPERADOR BALACLAVA',
    tank: 'ESCUDEIRO TÁTICO',
    medic: 'MÉDICO DA SINTONIA',
    special: 'DEMOLIDOR C4',
    boss: 'BLINDADO SUPREMO Z-15'
  },
  guard: {
    rifleman: 'SEGURANÇA DO BANCO',
    tank: 'SEGURANÇA DE ESCOPETA',
    medic: 'BRIGADISTA',
    special: 'SEGURANÇA',
    boss: 'CHEFE DA SEGURANÇA'
  },
  pf: {
    rifleman: 'AGENTE FEDERAL',
    tank: 'ESCUDEIRO FEDERAL',
    medic: 'SOCORRISTA FEDERAL',
    special: 'ATIRADOR FEDERAL',
    boss: 'DELEGADO FEDERAL'
  },
  bope: {
    rifleman: 'OPERADOR DO BOPE',
    tank: 'ESCUDEIRO DO BOPE',
    medic: 'SOCORRISTA TÁTICO',
    special: 'ATIRADOR DO BOPE',
    boss: 'CAPITÃO DO BOPE'
  },
  ares: {
    rifleman: 'TROOPER LASER',
    tank: 'EXO-GUARDIÃO',
    medic: 'NANO-MÉDICO',
    special: 'OPERADOR DE DRONE',
    boss: 'OVERLORD QUÂNTICO'
  }
};

export const PALETTE = {
  cv: {
    main: 0xdc2626,
    dark: 0x7f1d1d,
    black: 0x15161a,
    accent: 0xfacc15,
    metal: 0x2b2f36,
    skin: 0xfacc15
  },
  pcc: {
    main: 0x1e3a8a,
    dark: 0x0b1226,
    black: 0x0a0b0f,
    accent: 0x38bdf8,
    metal: 0x1f2937,
    skin: 0xfacc15
  },
  guard: {
    main: 0xf1f5f9,
    dark: 0x1f2937,
    black: 0x111827,
    accent: 0xfacc15,
    metal: 0x2b2f36,
    skin: 0xfacc15
  },
  pf: {
    main: 0x0f1d3a,
    dark: 0x0b1226,
    black: 0x0a0b0f,
    accent: 0xfacc15,
    metal: 0x1f2937,
    skin: 0xfacc15
  },
  bope: {
    main: 0x15161a,
    dark: 0x1f2328,
    black: 0x0b0c0f,
    accent: 0xfacc15,
    metal: 0x2b2f36,
    skin: 0xfacc15
  },
  ares: {
    main: 0x64748b,
    dark: 0x334155,
    black: 0x1e293b,
    accent: 0xd946ef,
    metal: 0x94a3b8,
    skin: 0xfacc15
  }
};

const TEXTURE_CACHE = new Map();
export const GLOW_CACHE = new Map();

export function plastic(hex, extra = {}) {
  return getLegoMaterial(hex, { roughness: 0.25, clearcoat: 0.4, ...extra });
}

export function metal(hex) {
  return getLegoMaterial(hex, { roughness: 0.3, metalness: 0.55, clearcoat: 0.3 });
}

export function goldMaterial() {
  return getLegoMaterial(0xfacc15, { roughness: 0.18, metalness: 0.75, clearcoat: 0.6 });
}

export function glow(hex, intensity = 1.6) {
  const key = `${hex}_${intensity}`;
  if (GLOW_CACHE.has(key)) return GLOW_CACHE.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: intensity,
    roughness: 0.35
  });
  GLOW_CACHE.set(key, mat);
  return mat;
}

export function glass(hex, opacity = 0.45) {
  const key = `glass_${hex}_${opacity}`;
  if (GLOW_CACHE.has(key)) return GLOW_CACHE.get(key);
  const mat = new THREE.MeshPhysicalMaterial({
    color: hex,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  GLOW_CACHE.set(key, mat);
  return mat;
}

export function makeCanvasTexture(key, w, h, draw) {
  if (TEXTURE_CACHE.has(key)) return TEXTURE_CACHE.get(key);
  const doc = globalThis.document;
  if (!doc || typeof doc.createElement !== 'function') {
    TEXTURE_CACHE.set(key, null);
    return null;
  }
  const canvas = doc.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) {
    TEXTURE_CACHE.set(key, null);
    return null;
  }
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  TEXTURE_CACHE.set(key, tex);
  return tex;
}

// Rostos e balaclavas base desenhados no centro do canvas (u = 0.5).
export function faceTexture(faceKey) {
  return makeCanvasTexture(`face_${faceKey}`, 256, 128, (ctx) => {
    const cx = 128;
    const skin = faceKey === 'pcc_mask' ? '#0a0b0f' : '#facc15';
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#111111';
    ctx.fillStyle = '#111111';
    ctx.lineCap = 'round';

    const eyes = (y, r = 6) => {
      ctx.beginPath();
      ctx.arc(cx - 20, y, r, 0, Math.PI * 2);
      ctx.arc(cx + 20, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - 18, y - 2, r * 0.35, 0, Math.PI * 2);
      ctx.arc(cx + 22, y - 2, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
    };
    const angryBrows = (y) => {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 34, y - 6);
      ctx.lineTo(cx - 10, y + 2);
      ctx.moveTo(cx + 34, y - 6);
      ctx.lineTo(cx + 10, y + 2);
      ctx.stroke();
    };

    if (faceKey === 'cv_angry') {
      angryBrows(44);
      eyes(58);
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 26, 40);
      ctx.lineTo(cx + 34, 70);
      ctx.stroke();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 18, 92);
      ctx.quadraticCurveTo(cx + 2, 100, cx + 22, 86);
      ctx.stroke();
    } else if (faceKey === 'pcc_mask') {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.roundRect(cx - 44, 42, 88, 30, 10);
      ctx.fill();
      ctx.fillStyle = '#111111';
      angryBrows(50);
      eyes(60, 5.5);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(256, 22);
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(cx - 14, 88, 28, 10, 5);
      ctx.fill();
    } else if (faceKey === 'medic_calm') {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 32, 40);
      ctx.lineTo(cx - 12, 38);
      ctx.moveTo(cx + 32, 40);
      ctx.lineTo(cx + 12, 38);
      ctx.stroke();
      eyes(56);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, 76, 20, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (faceKey === 'boss_grin') {
      angryBrows(40);
      eyes(54, 7);
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.moveTo(cx - 34, 80);
      ctx.quadraticCurveTo(cx, 112, cx + 34, 80);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 24, 82, 48, 7);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx + 8, 82, 8, 7);
    } else {
      angryBrows(44);
      eyes(58);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 16, 88);
      ctx.lineTo(cx + 16, 88);
      ctx.stroke();
    }
  });
}

export function camoTexture(faction) {
  return makeCanvasTexture(`camo_${faction}`, 128, 128, (ctx) => {
    const cols =
      faction === 'cv'
        ? ['#3f4a25', '#5b6b2f', '#2a2a1e', '#7a5c33']
        : faction === 'pcc'
          ? ['#0f172a', '#1e293b', '#111827', '#1e3a8a']
          : ['#475569', '#64748b', '#334155', '#94a3b8'];
    ctx.fillStyle = cols[0];
    ctx.fillRect(0, 0, 128, 128);
    let seed = faction.length * 97;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = cols[1 + (i % 3)];
      ctx.beginPath();
      ctx.ellipse(rnd() * 128, rnd() * 128, 8 + rnd() * 14, 5 + rnd() * 9, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export function faceMaterial(faceKey) {
  const key = `facemat_${faceKey}`;
  if (GLOW_CACHE.has(key)) return GLOW_CACHE.get(key);
  const tex = faceTexture(faceKey);
  const mat = tex
    ? new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.2, clearcoat: 0.5 })
    : plastic(faceKey === 'pcc_mask' ? 0x0a0b0f : 0xfacc15);
  GLOW_CACHE.set(key, mat);
  return mat;
}

export function camoMaterial(faction) {
  const key = `camomat_${faction}`;
  if (GLOW_CACHE.has(key)) return GLOW_CACHE.get(key);
  const tex = camoTexture(faction);
  const mat = tex
    ? new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 0.35 })
    : plastic(PALETTE[faction].dark);
  GLOW_CACHE.set(key, mat);
  return mat;
}

// Montador de peças: junta várias primitivas por material numa só geometria
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

export class PartBuilder {
  constructor() {
    this.byMat = new Map();
  }

  add(geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    if (!mat) return this;
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    g.clearGroups();
    _e.set(r[0], r[1], r[2]);
    _q.setFromEuler(_e);
    _p.set(p[0], p[1], p[2]);
    _s.set(s[0], s[1], s[2]);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    if (!this.byMat.has(mat)) this.byMat.set(mat, []);
    this.byMat.get(mat).push(g);
    return this;
  }

  box(w, h, d, mat, p, r, s) {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, p, r, s);
  }

  cyl(rt, rb, h, mat, p, r, seg = 12, s) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, p, r, s);
  }

  sphere(rad, mat, p, s, seg = 10) {
    return this.add(new THREE.SphereGeometry(rad, seg, Math.max(6, seg - 2)), mat, p, [0, 0, 0], s);
  }

  torus(rad, tube, mat, p, r, arc = Math.PI * 2, seg = 14) {
    return this.add(new THREE.TorusGeometry(rad, tube, 6, seg, arc), mat, p, r);
  }

  stud(mat, p, scale = 1) {
    return this.add(SHARED_STUD_GEO, mat, p, [0, 0, 0], [scale, scale, scale]);
  }

  build() {
    const out = [];
    for (const [mat, geos] of this.byMat) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      out.push({ geometry: merged, material: mat });
    }
    return out;
  }
}

export function trapezoidTorsoGeo(widthTop = 0.95, widthBottom = 0.78) {
  const g = new THREE.BoxGeometry(1, 0.76, 0.44);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (y > 0 ? widthTop : widthBottom));
  }
  g.computeVertexNormals();
  return g;
}

export function addBaseTorsoAndBelt(T, faction, p, torsoMat, hipMat, gold, decal) {
  T.add(trapezoidTorsoGeo(), torsoMat, [0, 1.16, 0]);
  T.cyl(0.19, 0.22, 0.08, torsoMat, [0, 1.58, 0], [0, 0, 0], 14);
  T.box(0.8, 0.14, 0.42, hipMat, [0, 0.79, 0]);
  T.box(0.1, 0.2, 0.4, hipMat, [0, 0.68, 0]);
  T.box(0.82, 0.08, 0.44, plastic(0x111827), [0, 0.84, 0]);
  T.box(0.14, 0.08, 0.05, faction === 'ares' ? glow(p.accent, 1.2) : gold, [0, 0.84, 0.225]);
  if (decal) {
    T.add(new THREE.PlaneGeometry(0.86, 0.74), decal, [0, 1.16, 0.224]);
  }
}

export function addLeg(b, legMat, bootMat, side) {
  b.box(0.31, 0.3, 0.34, legMat, [0, -0.15, 0]);
  b.box(0.3, 0.24, 0.33, legMat, [0, -0.42, 0]);
  b.box(0.32, 0.14, 0.44, bootMat, [0, -0.59, 0.05]);
  b.box(0.22, 0.12, 0.06, bootMat, [0, -0.33, 0.18]);
  void side;
}

export function addArm(b, sleeveMat, handMat, side) {
  b.sphere(0.15, sleeveMat, [0, -0.03, 0]);
  b.cyl(0.125, 0.115, 0.3, sleeveMat, [0, -0.19, 0]);
  b.cyl(0.115, 0.105, 0.24, sleeveMat, [0, -0.4, 0.03], [0.18, 0, 0]);
  b.cyl(0.075, 0.075, 0.09, handMat, [0, -0.54, 0.05]);
  b.torus(0.1, 0.045, handMat, [0, -0.64, 0.07], [Math.PI * 0.75, Math.PI / 2, 0], Math.PI * 1.45, 12);
  void side;
}

export function addSwatHelmetBase(H, blackMat, visorHex, visorOpacity) {
  H.sphere(0.34, blackMat, [0, 0.36, 0], [1, 0.85, 1], 16);
  H.box(0.48, 0.16, 0.1, glass(visorHex, visorOpacity), [0, 0.32, 0.29]);
}

export function addSlantedBeretBase(H, beretMat, headTopY) {
  H.cyl(0.33, 0.3, 0.12, beretMat, [0.05, headTopY + 0.02, 0], [0, 0, -0.18], 16);
  H.stud(beretMat, [0.08, headTopY + 0.08, 0]);
}

// Arsenal 3D compartilhado (armas de mão, mochila médica, RPG, C4 e escudos)
export function buildWeapon(b, faction, kind) {
  const p = PALETTE[faction];
  const dark = metal(0x1f2328);
  const wood = plastic(0x8b5a2b);
  const muzzle = { x: 0, y: 0.04, z: 0.9 };

  if (kind === 'ak') {
    b.box(0.1, 0.14, 0.62, dark, [0, 0.03, 0.3]);
    b.box(0.09, 0.12, 0.3, wood, [0, 0.0, -0.12], [0.12, 0, 0]);
    b.box(0.09, 0.08, 0.2, wood, [0, -0.01, 0.42]);
    b.cyl(0.03, 0.03, 0.34, dark, [0, 0.06, 0.74], [Math.PI / 2, 0, 0], 8);
    b.box(0.08, 0.22, 0.1, dark, [0, -0.13, 0.33], [0.35, 0, 0]);
    b.box(0.08, 0.12, 0.09, dark, [0, -0.27, 0.39], [0.6, 0, 0]);
    b.box(0.03, 0.06, 0.03, dark, [0, 0.13, 0.8]);
    muzzle.z = 0.93;
  } else if (kind === 'smg') {
    b.box(0.1, 0.16, 0.46, dark, [0, 0.03, 0.22]);
    b.cyl(0.05, 0.05, 0.32, dark, [0, 0.05, 0.6], [Math.PI / 2, 0, 0], 10);
    b.box(0.07, 0.24, 0.08, dark, [0, -0.15, 0.26]);
    b.box(0.08, 0.08, 0.26, dark, [0, -0.02, -0.1]);
    b.box(0.06, 0.07, 0.1, glow(PALETTE.pcc.accent, 1.2), [0, 0.15, 0.18]);
    muzzle.z = 0.8;
  } else if (kind === 'laser') {
    b.box(0.12, 0.17, 0.66, metal(0xcbd5e1), [0, 0.03, 0.3]);
    b.box(0.14, 0.05, 0.5, glow(p.accent, 2.0), [0, 0.13, 0.3]);
    b.cyl(0.055, 0.04, 0.3, metal(0x475569), [0, 0.03, 0.76], [Math.PI / 2, 0, 0], 10);
    b.torus(0.06, 0.02, glow(0x22d3ee, 2.2), [0, 0.03, 0.86], [0, 0, 0], Math.PI * 2, 12);
    b.box(0.08, 0.2, 0.1, metal(0x475569), [0, -0.13, 0.18]);
    muzzle.z = 0.94;
  } else if (kind === 'shotgun') {
    b.box(0.11, 0.13, 0.58, dark, [0, 0.03, 0.28]);
    b.cyl(0.045, 0.045, 0.3, dark, [0, 0.06, 0.7], [Math.PI / 2, 0, 0], 8);
    b.box(0.1, 0.09, 0.2, wood, [0, -0.04, 0.48]);
    b.box(0.09, 0.12, 0.26, wood, [0, -0.02, -0.08], [0.15, 0, 0]);
    muzzle.z = 0.86;
  } else if (kind === 'healgun') {
    b.box(0.12, 0.16, 0.36, plastic(0xf8fafc), [0, 0.03, 0.18]);
    b.cyl(0.08, 0.08, 0.26, glow(0x22c55e, 1.4), [0, 0.15, 0.12], [Math.PI / 2, 0, 0], 12);
    b.cyl(0.05, 0.07, 0.18, metal(0x94a3b8), [0, 0.03, 0.44], [Math.PI / 2, 0, 0], 10);
    b.box(0.07, 0.2, 0.08, plastic(0xf8fafc), [0, -0.12, 0.08]);
    muzzle.z = 0.56;
  } else if (kind === 'detonator') {
    b.box(0.14, 0.22, 0.1, plastic(0x111827), [0, -0.02, 0.06]);
    b.cyl(0.04, 0.04, 0.05, glow(0xef4444, 2.0), [0, 0.11, 0.06], [0, 0, 0], 10);
    b.cyl(0.012, 0.012, 0.28, metal(0x94a3b8), [0.05, 0.22, 0.03], [0, 0, 0], 6);
    b.box(0.08, 0.12, 0.4, dark, [0, -0.02, 0.32]);
    muzzle.z = 0.56;
  } else if (kind === 'minigun') {
    b.cyl(0.13, 0.13, 0.5, dark, [0, 0.04, 0.22], [Math.PI / 2, 0, 0], 12);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.cyl(0.028, 0.028, 0.6, dark, [Math.cos(a) * 0.08, 0.04 + Math.sin(a) * 0.08, 0.66], [Math.PI / 2, 0, 0], 6);
    }
    b.box(0.2, 0.18, 0.2, plastic(p.accent), [0, -0.12, 0.06]);
    muzzle.z = 1.0;
  } else {
    b.box(0.1, 0.14, 0.6, dark, [0, 0.03, 0.3]);
  }
  return muzzle;
}

export function addMedicBackpackKit(T, faction, p, mainMat, accentMat) {
  const packHex = faction === 'cv' ? 0xf8fafc : faction === 'pcc' ? 0x1e293b : 0xcbd5e1;
  const crossMat = faction === 'cv' ? mainMat : faction === 'pcc' ? accentMat : glow(p.accent, 1.2);
  T.box(0.62, 0.62, 0.26, plastic(packHex), [0, 1.18, -0.36]);
  T.box(0.1, 0.32, 0.03, crossMat, [0, 1.2, -0.505]);
  T.box(0.32, 0.1, 0.03, crossMat, [0, 1.2, -0.505]);
  T.cyl(0.07, 0.07, 0.5, glow(0x22c55e, 1.2), [0.24, 1.38, -0.36], [0, 0, 0], 10);
}

export function addRpgLauncherKit(T) {
  const tube = plastic(0x4d5a2a);
  T.cyl(0.11, 0.11, 1.3, tube, [0.42, 1.62, 0.1], [Math.PI / 2, 0, 0], 12);
  T.cyl(0.14, 0.11, 0.16, plastic(0x1f2328), [0.42, 1.62, -0.6], [Math.PI / 2, 0, 0], 12);
  T.cyl(0.0, 0.13, 0.3, plastic(0x22c55e), [0.42, 1.62, 0.92], [Math.PI / 2, 0, 0], 12);
  T.cyl(0.1, 0.1, 0.12, plastic(0x22c55e), [0.42, 1.62, 0.73], [Math.PI / 2, 0, 0], 12);
  T.box(0.08, 0.2, 0.08, plastic(0x1f2328), [0.42, 1.46, 0.3]);
  for (const sx of [-0.15, 0.15]) {
    T.cyl(0.08, 0.08, 0.5, plastic(0x4d5a2a), [sx, 1.22, -0.3], [0, 0, 0], 10);
    T.cyl(0.0, 0.09, 0.2, plastic(0x22c55e), [sx, 1.56, -0.3], [0, 0, 0], 10);
  }
}

export function addC4DemolitionKit(T) {
  const c4 = plastic(0xe7e5e4);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      T.box(0.22, 0.14, 0.08, c4, [-0.25 + c * 0.25, 1.0 + r * 0.18, 0.27]);
      T.stud(c4, [-0.25 + c * 0.25, 1.07 + r * 0.18, 0.27], 0.5);
    }
  }
  T.box(0.7, 0.03, 0.03, glow(0xef4444, 1.5), [0, 1.36, 0.3]);
  T.box(0.56, 0.6, 0.28, plastic(0x111827), [0, 1.18, -0.37]);
  for (let i = 0; i < 3; i++) T.box(0.16, 0.12, 0.06, c4, [-0.18 + i * 0.18, 1.3, -0.53]);
  T.box(0.1, 0.06, 0.06, glow(0xef4444, 2.5), [0, 1.1, -0.53]);
}

export function addShieldOffhand(O, faction, p, mainMat, blackMat, accentMat) {
  if (faction === 'cv') {
    O.box(0.92, 0.9, 0.08, mainMat, [0, 0.0, 0]);
    O.box(0.78, 0.36, 0.09, glass(0x93c5fd, 0.6), [0, 0.28, 0.0]);
    O.box(0.92, 0.06, 0.1, plastic(0x111827), [0, 0.07, 0]);
    O.box(0.16, 0.05, 0.06, metal(0xcbd5e1), [0.28, -0.02, 0.06]);
    O.box(0.92, 0.36, 0.09, plastic(p.dark), [0, -0.3, 0]);
  } else if (faction === 'pcc') {
    O.box(0.84, 1.3, 0.1, blackMat, [0, -0.05, 0]);
    O.box(0.4, 0.14, 0.11, glass(p.accent, 0.6), [0, 0.42, 0]);
    O.box(0.84, 0.08, 0.11, accentMat, [0, 0.12, 0]);
    O.box(0.84, 0.08, 0.11, accentMat, [0, -0.6, 0]);
  } else if (faction === 'guard' || faction === 'pf' || faction === 'bope') {
    O.box(0.84, 1.3, 0.1, blackMat, [0, -0.05, 0]);
    O.box(0.4, 0.14, 0.11, glass(0x93c5fd, 0.6), [0, 0.42, 0]);
    O.box(0.84, 0.1, 0.11, accentMat, [0, 0.1, 0]);
  } else {
    O.cyl(0.66, 0.66, 0.05, glass(p.accent, 0.38), [0, 0.0, 0], [Math.PI / 2, 0, 0], 6);
    O.torus(0.66, 0.04, glow(p.accent, 2.0), [0, 0.0, 0], [0, 0, 0], Math.PI * 2, 6);
    O.box(0.14, 0.3, 0.12, metal(0x475569), [0, 0, -0.06]);
  }
}

export const HEAD_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.27, 0.27, 0.5, 20);
  g.rotateY(Math.PI);
  return g;
})();

export const MUZZLE_GEO = new THREE.OctahedronGeometry(0.16, 0);
export const MUZZLE_MAT = new THREE.MeshBasicMaterial({ color: 0xfde047 });
export const MUZZLE_HEAL_MAT = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
export const MUZZLE_LASER_MAT = new THREE.MeshBasicMaterial({ color: 0xf0abfc });

export function instantiatePartMeshes(list, parent, castShadow = true) {
  for (const { geometry, material } of list) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow && !material.transparent;
    mesh.receiveShadow = false;
    parent.add(mesh);
  }
}

export function instantiateSoldierRig(bp, className = '') {
  const bodyRig = new THREE.Group();
  instantiatePartMeshes(bp.parts.torso, bodyRig);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.2, 0.68, 0);
  instantiatePartMeshes(bp.parts.leftLeg, leftLeg);
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, 0.68, 0);
  instantiatePartMeshes(bp.parts.rightLeg, rightLeg);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.56, 1.44, 0);
  leftArm.rotation.z = 0.08;
  instantiatePartMeshes(bp.parts.leftArm, leftArm, false);
  const rightArm = new THREE.Group();
  rightArm.position.set(0.56, 1.44, 0);
  rightArm.rotation.z = -0.08;
  instantiatePartMeshes(bp.parts.rightArm, rightArm, false);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.62, 0.08);
  weaponMount.rotation.x = AIM_POSE.rightArmX * -1;
  instantiatePartMeshes(bp.parts.weapon, weaponMount, false);
  rightArm.add(weaponMount);

  const muzzleFlash = new THREE.Mesh(
    MUZZLE_GEO,
    bp.weaponKind === 'healgun' ? MUZZLE_HEAL_MAT : bp.weaponKind === 'laser' ? MUZZLE_LASER_MAT : MUZZLE_MAT
  );
  muzzleFlash.position.set(bp.muzzle.x, bp.muzzle.y, bp.muzzle.z);
  muzzleFlash.visible = false;
  weaponMount.add(muzzleFlash);

  if (bp.hasShield) {
    const shieldMount = new THREE.Group();
    shieldMount.position.set(-0.06, -0.5, 0.36);
    shieldMount.rotation.x = 0.45;
    instantiatePartMeshes(bp.parts.offhand, shieldMount);
    leftArm.add(shieldMount);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  const headMesh = new THREE.Mesh(HEAD_GEO, faceMaterial(bp.faceKey));
  headMesh.position.y = 0.25;
  headMesh.castShadow = true;
  head.add(headMesh);
  const topStud = new THREE.Mesh(SHARED_STUD_GEO, plastic(bp.faceKey === 'pcc_mask' ? 0x0a0b0f : 0xfacc15));
  topStud.position.y = 0.5;
  head.add(topStud);
  instantiatePartMeshes(bp.parts.head, head, false);

  bodyRig.add(leftLeg, rightLeg, leftArm, rightArm, head);

  let drone = null;
  if (bp.hasDrone) {
    drone = new THREE.Group();
    drone.position.set(0.7, 2.7, -0.3);
    instantiatePartMeshes(bp.parts.drone, drone, false);
    bodyRig.add(drone);
  }

  return {
    bodyRig,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    weaponMount,
    muzzleFlash,
    drone,
    hasShield: bp.hasShield,
    weaponKind: bp.weaponKind,
    className
  };
}
