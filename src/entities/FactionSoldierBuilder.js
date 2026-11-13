import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getLegoMaterial, SHARED_STUD_GEO } from '../materials/LegoMaterials.js';

// ============================================================================
// CONSTRUTOR DE SOLDADOS LEGO DAS FACÇÕES (estilo "classes" do PvZ Garden Warfare)
// ----------------------------------------------------------------------------
// Cada facção (CV / PCC / A.R.E.S.) tem um KIT visual próprio por CLASSE:
//   rifleman  -> Soldado de linha (arma principal da facção)
//   tank      -> Pesado com escudo (silhueta larga)
//   medic     -> Médico de combate (mochila + arma de cura)
//   special   -> Especialista da facção (CV: RPG / PCC: C4 / A.R.E.S.: Drone)
//   boss      -> Chefão Big-Fig
//
// Performance: cada kit é montado UMA vez como "blueprint" (peças fundidas por
// material em cada parte articulada). Instanciar um soldado só cria Meshes que
// reaproveitam a mesma geometria e o mesmo material (zero geometria nova por NPC).
// ============================================================================

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

// Paleta de cada facção
const PALETTE = {
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

const BLUEPRINTS = new Map();
const TEXTURE_CACHE = new Map();
const GLOW_CACHE = new Map();

function plastic(hex, extra = {}) {
  return getLegoMaterial(hex, { roughness: 0.25, clearcoat: 0.4, ...extra });
}

function metal(hex) {
  return getLegoMaterial(hex, { roughness: 0.3, metalness: 0.55, clearcoat: 0.3 });
}

function glow(hex, intensity = 1.6) {
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

function glass(hex, opacity = 0.45) {
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

// ----------------------------------------------------------------------------
// Texturas em Canvas (rostos, estampas do tronco, camuflado)
// ----------------------------------------------------------------------------
function makeCanvasTexture(key, w, h, draw) {
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
  tex.anisotropy = 4;
  TEXTURE_CACHE.set(key, tex);
  return tex;
}

function hexCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

// Rostos desenhados no centro do canvas (u = 0.5). A cabeça é girada 180° para o
// centro da textura ficar virado para a FRENTE (+Z) do boneco.
function faceTexture(faceKey) {
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
      // Cicatriz no olho
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx + 26, 40);
      ctx.lineTo(cx + 34, 70);
      ctx.stroke();
      ctx.strokeStyle = '#111111';
      // Sorriso torto (fica escondido pela bandana em alguns kits)
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx - 18, 92);
      ctx.quadraticCurveTo(cx + 2, 100, cx + 22, 86);
      ctx.stroke();
    } else if (faceKey === 'pcc_mask') {
      // Balaclava: só a fenda dos olhos aparece
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
      // Boca da balaclava
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
      // Sorriso maligno com dentes
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.moveTo(cx - 34, 80);
      ctx.quadraticCurveTo(cx, 112, cx + 34, 80);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 24, 82, 48, 7);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx + 8, 82, 8, 7); // dente de ouro
    } else {
      // Rosto padrão determinado
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

function camoTexture(faction) {
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

// Estampa da frente do tronco (desenhada dentro do trapézio do tronco)
function torsoDecalTexture(faction, role) {
  return makeCanvasTexture(`decal_${faction}_${role}`, 128, 128, (ctx) => {
    const p = PALETTE[faction];
    ctx.clearRect(0, 0, 128, 128);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cross = (color, outline = '#ffffff') => {
      ctx.fillStyle = outline;
      ctx.fillRect(49, 33, 30, 62);
      ctx.fillRect(33, 49, 62, 30);
      ctx.fillStyle = color;
      ctx.fillRect(54, 38, 20, 52);
      ctx.fillRect(38, 54, 52, 20);
    };

    if (role === 'medic') {
      cross(faction === 'cv' ? '#dc2626' : faction === 'pcc' ? '#38bdf8' : faction === 'bope' ? '#facc15' : '#d946ef');
      return;
    }

    if (faction === 'guard') {
      // Colete preto "SEGURANÇA" sobre camisa branca + gravata
      ctx.fillStyle = '#111827';
      ctx.fillRect(14, 40, 100, 74);
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.moveTo(58, 8);
      ctx.lineTo(70, 8);
      ctx.lineTo(68, 40);
      ctx.lineTo(60, 40);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 19px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText('SEGURANÇA', 64, 84);
      ctx.fillRect(40, 96, 48, 4);
      return;
    }
    if (faction === 'pf') {
      // Colete tático "POLÍCIA FEDERAL" com PF grande em amarelo
      ctx.fillStyle = '#0b1226';
      ctx.fillRect(16, 14, 96, 100);
      ctx.font = 'bold 50px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText('PF', 64, 70);
      ctx.font = 'bold 14px Teko, Impact, sans-serif';
      ctx.fillText('POLÍCIA FEDERAL', 64, 96);
      ctx.fillStyle = '#1e293b';
      for (let i = 0; i < 3; i++) ctx.fillRect(26 + i * 27, 100, 22, 12);
      return;
    }

    if (faction === 'bope') {
      // Faca na caveira: emblema do BOPE em branco
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(64, 50, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(50, 62, 28, 18);
      ctx.fillStyle = '#0b0c0f';
      ctx.beginPath();
      ctx.arc(55, 50, 6, 0, Math.PI * 2);
      ctx.arc(73, 50, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(56, 70, 3, 10);
      ctx.fillRect(63, 70, 3, 10);
      ctx.fillRect(70, 70, 3, 10);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(30, 22);
      ctx.lineTo(98, 90);
      ctx.stroke();
      ctx.font = 'bold 22px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.fillText('BOPE', 64, 112);
      return;
    }

    if (faction === 'cv') {
      // Regata preta com vinco + "CV" grande + corrente de ouro desenhada
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(34, 8);
      ctx.quadraticCurveTo(64, 52, 94, 8);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(64, 44, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 44px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#dc2626';
      ctx.fillText('CV', 64, 102);
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 2;
      ctx.strokeText('CV', 64, 102);
    } else if (faction === 'pcc') {
      // Colete balístico com porta-carregadores e faixa ciano
      ctx.fillStyle = '#0b1226';
      ctx.fillRect(20, 14, 88, 100);
      ctx.fillStyle = '#1e293b';
      for (let i = 0; i < 3; i++) ctx.fillRect(26 + i * 27, 70, 22, 34);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(20, 54, 88, 8);
      ctx.font = 'bold 26px Teko, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText('PCC', 64, 44);
    } else {
      // Placa peitoral cyber com núcleo hexagonal neon
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(22, 14, 84, 96);
      ctx.strokeStyle = '#d946ef';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = 64 + Math.cos(a) * 20;
        const y = 56 + Math.sin(a) * 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#f0abfc';
      ctx.beginPath();
      ctx.arc(64, 56, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(30, 96);
      ctx.lineTo(98, 96);
      ctx.stroke();
    }
    void p;
  });
}

function decalMaterial(faction, role) {
  const key = `decalmat_${faction}_${role}`;
  if (GLOW_CACHE.has(key)) return GLOW_CACHE.get(key);
  const tex = torsoDecalTexture(faction, role);
  const mat = tex
    ? new THREE.MeshPhysicalMaterial({
        map: tex,
        transparent: true,
        roughness: 0.25,
        clearcoat: 0.4,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2
      })
    : null;
  GLOW_CACHE.set(key, mat);
  return mat;
}

function faceMaterial(faceKey) {
  const key = `facemat_${faceKey}`;
  if (GLOW_CACHE.has(key)) return GLOW_CACHE.get(key);
  const tex = faceTexture(faceKey);
  const mat = tex
    ? new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.2, clearcoat: 0.5 })
    : plastic(faceKey === 'pcc_mask' ? 0x0a0b0f : 0xfacc15);
  GLOW_CACHE.set(key, mat);
  return mat;
}

function camoMaterial(faction) {
  const key = `camomat_${faction}`;
  if (GLOW_CACHE.has(key)) return GLOW_CACHE.get(key);
  const tex = camoTexture(faction);
  const mat = tex
    ? new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.3, clearcoat: 0.35 })
    : plastic(PALETTE[faction].dark);
  GLOW_CACHE.set(key, mat);
  return mat;
}

// ----------------------------------------------------------------------------
// Montador de peças: junta várias primitivas por material numa só geometria
// ----------------------------------------------------------------------------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

class PartBuilder {
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

// ----------------------------------------------------------------------------
// Corpo base LEGO (proporções da minifigura clássica)
// ----------------------------------------------------------------------------
function trapezoidTorsoGeo(widthTop = 0.95, widthBottom = 0.78) {
  const g = new THREE.BoxGeometry(1, 0.76, 0.44);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (y > 0 ? widthTop : widthBottom));
  }
  g.computeVertexNormals();
  return g;
}

function addLeg(b, legMat, bootMat, side) {
  // Pivô no quadril (y = 0 no pivô). Perna desce até ~ -0.66
  b.box(0.31, 0.3, 0.34, legMat, [0, -0.15, 0]);
  b.box(0.3, 0.24, 0.33, legMat, [0, -0.42, 0]);
  b.box(0.32, 0.14, 0.44, bootMat, [0, -0.59, 0.05]);
  // Joelheira
  b.box(0.22, 0.12, 0.06, bootMat, [0, -0.33, 0.18]);
  void side;
}

function addArm(b, sleeveMat, handMat, side) {
  // Pivô no ombro. Braço LEGO levemente curvado para frente
  b.sphere(0.15, sleeveMat, [0, -0.03, 0]);
  b.cyl(0.125, 0.115, 0.3, sleeveMat, [0, -0.19, 0]);
  b.cyl(0.115, 0.105, 0.24, sleeveMat, [0, -0.4, 0.03], [0.18, 0, 0]);
  // Pulso + mão em "C" clássica
  b.cyl(0.075, 0.075, 0.09, handMat, [0, -0.54, 0.05]);
  b.torus(0.1, 0.045, handMat, [0, -0.64, 0.07], [Math.PI * 0.75, Math.PI / 2, 0], Math.PI * 1.45, 12);
  void side;
}

// ----------------------------------------------------------------------------
// ARMAS 3D (montadas no "weaponMount" na mão direita; +Z = cano)
// ----------------------------------------------------------------------------
function buildWeapon(b, faction, kind) {
  const p = PALETTE[faction];
  const dark = metal(0x1f2328);
  const wood = plastic(0x8b5a2b);
  const muzzle = { x: 0, y: 0.04, z: 0.9 };

  if (kind === 'ak') {
    // Fuzil AK com coronha de madeira e carregador curvo
    b.box(0.1, 0.14, 0.62, dark, [0, 0.03, 0.3]);
    b.box(0.09, 0.12, 0.3, wood, [0, 0.0, -0.12], [0.12, 0, 0]);
    b.box(0.09, 0.08, 0.2, wood, [0, -0.01, 0.42]);
    b.cyl(0.03, 0.03, 0.34, dark, [0, 0.06, 0.74], [Math.PI / 2, 0, 0], 8);
    b.box(0.08, 0.22, 0.1, dark, [0, -0.13, 0.33], [0.35, 0, 0]);
    b.box(0.08, 0.12, 0.09, dark, [0, -0.27, 0.39], [0.6, 0, 0]);
    b.box(0.03, 0.06, 0.03, dark, [0, 0.13, 0.8]);
    muzzle.z = 0.93;
  } else if (kind === 'smg') {
    // Submetralhadora compacta com silenciador e mira holográfica ciano
    b.box(0.1, 0.16, 0.46, dark, [0, 0.03, 0.22]);
    b.cyl(0.05, 0.05, 0.32, dark, [0, 0.05, 0.6], [Math.PI / 2, 0, 0], 10);
    b.box(0.07, 0.24, 0.08, dark, [0, -0.15, 0.26]);
    b.box(0.08, 0.08, 0.26, dark, [0, -0.02, -0.1]);
    b.box(0.06, 0.07, 0.1, glow(PALETTE.pcc.accent, 1.2), [0, 0.15, 0.18]);
    muzzle.z = 0.8;
  } else if (kind === 'laser') {
    // Rifle laser A.R.E.S. com faixas neon
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
    // Pistola de cura com cilindro verde
    b.box(0.12, 0.16, 0.36, plastic(0xf8fafc), [0, 0.03, 0.18]);
    b.cyl(0.08, 0.08, 0.26, glow(0x22c55e, 1.4), [0, 0.15, 0.12], [Math.PI / 2, 0, 0], 12);
    b.cyl(0.05, 0.07, 0.18, metal(0x94a3b8), [0, 0.03, 0.44], [Math.PI / 2, 0, 0], 10);
    b.box(0.07, 0.2, 0.08, plastic(0xf8fafc), [0, -0.12, 0.08]);
    muzzle.z = 0.56;
  } else if (kind === 'detonator') {
    // Detonador de C4 na mão (antena + botão vermelho)
    b.box(0.14, 0.22, 0.1, plastic(0x111827), [0, -0.02, 0.06]);
    b.cyl(0.04, 0.04, 0.05, glow(0xef4444, 2.0), [0, 0.11, 0.06], [0, 0, 0], 10);
    b.cyl(0.012, 0.012, 0.28, metal(0x94a3b8), [0.05, 0.22, 0.03], [0, 0, 0], 6);
    b.box(0.08, 0.12, 0.4, dark, [0, -0.02, 0.32]); // pistola acoplada
    muzzle.z = 0.56;
  } else if (kind === 'minigun') {
    // Metralhadora giratória do chefe
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

// ----------------------------------------------------------------------------
// KITS POR FACÇÃO E CLASSE
// ----------------------------------------------------------------------------
function buildBlueprint(faction, role) {
  const p = PALETTE[faction] || PALETTE.cv;
  const isBoss = role === 'boss';
  const isMedic = role === 'medic';
  const isTank = role === 'tank';
  const isSpecial = role === 'special';

  const parts = {
    torso: new PartBuilder(),
    head: new PartBuilder(),
    leftArm: new PartBuilder(),
    rightArm: new PartBuilder(),
    leftLeg: new PartBuilder(),
    rightLeg: new PartBuilder(),
    weapon: new PartBuilder(),
    offhand: new PartBuilder(),
    drone: new PartBuilder()
  };
  const T = parts.torso;
  const H = parts.head;

  // ---- Cores base por facção/classe
  let torsoHex = p.black;
  let sleeveHex = p.main;
  let hipHex = p.black;
  let legMat = camoMaterial(faction);
  let bootMat = plastic(p.black);
  let faceKey = 'default';
  let weaponKind = 'ak';

  if (faction === 'cv') {
    torsoHex = isMedic ? 0xf8fafc : p.black;
    sleeveHex = isMedic ? 0xf8fafc : isTank ? p.dark : 0xfacc15; // braços "pele" (regata) no fuzileiro
    if (role === 'rifleman' || isSpecial) sleeveHex = 0xfacc15;
    hipHex = 0x2a2a1e;
    faceKey = isMedic ? 'medic_calm' : isBoss ? 'boss_grin' : 'cv_angry';
    weaponKind = isTank ? 'shotgun' : isMedic ? 'healgun' : isBoss ? 'minigun' : 'ak';
  } else if (faction === 'pcc') {
    torsoHex = isMedic ? 0x0f172a : p.main;
    sleeveHex = p.dark;
    hipHex = p.black;
    legMat = plastic(0x111827);
    faceKey = isMedic ? 'medic_calm' : isBoss ? 'boss_grin' : 'pcc_mask';
    weaponKind = isTank ? 'smg' : isMedic ? 'healgun' : isSpecial ? 'detonator' : isBoss ? 'minigun' : 'smg';
  } else if (faction === 'guard') {
    torsoHex = 0xf1f5f9;
    sleeveHex = 0xf1f5f9;
    hipHex = 0x111827;
    legMat = plastic(0x111827);
    faceKey = isMedic ? 'medic_calm' : 'default';
    weaponKind = isTank ? 'shotgun' : isMedic ? 'healgun' : 'smg';
  } else if (faction === 'pf') {
    torsoHex = p.main;
    sleeveHex = 0x111827;
    hipHex = p.black;
    legMat = plastic(0x1f2937);
    faceKey = isMedic ? 'medic_calm' : 'default';
    weaponKind = isMedic ? 'healgun' : isTank ? 'smg' : isBoss ? 'minigun' : 'ak';
  } else if (faction === 'bope') {
    torsoHex = p.main;
    sleeveHex = p.dark;
    hipHex = p.black;
    legMat = plastic(0x1f2328);
    faceKey = isMedic ? 'medic_calm' : 'default';
    weaponKind = isMedic ? 'healgun' : isTank ? 'shotgun' : isBoss ? 'minigun' : 'ak';
  } else {
    torsoHex = isMedic ? 0xe2e8f0 : p.main;
    sleeveHex = isMedic ? 0xe2e8f0 : p.dark;
    hipHex = p.black;
    legMat = plastic(0x475569, { metalness: 0.35 });
    bootMat = metal(0x1e293b);
    faceKey = isMedic ? 'medic_calm' : isBoss ? 'boss_grin' : 'default';
    weaponKind = isMedic ? 'healgun' : isBoss ? 'minigun' : 'laser';
  }

  const torsoMat = plastic(torsoHex);
  const sleeveMat = plastic(sleeveHex);
  const hipMat = plastic(hipHex);
  const handMat = plastic(
    faction === 'ares' ? 0x1e293b : faction === 'pcc' || faction === 'bope' || faction === 'pf' ? 0x111827 : 0xfacc15
  );
  const accentMat = plastic(p.accent);
  const mainMat = plastic(p.main);
  const blackMat = plastic(p.black);
  const gold = getLegoMaterial(0xfacc15, { roughness: 0.18, metalness: 0.75, clearcoat: 0.6 });

  // ---- TRONCO (pivô no chão do boneco; tronco centralizado em y = 1.16)
  T.add(trapezoidTorsoGeo(), torsoMat, [0, 1.16, 0]);
  T.cyl(0.19, 0.22, 0.08, torsoMat, [0, 1.58, 0], [0, 0, 0], 14);
  // Quadril
  T.box(0.8, 0.14, 0.42, hipMat, [0, 0.79, 0]);
  T.box(0.1, 0.2, 0.4, hipMat, [0, 0.68, 0]);
  // Cinto tático com fivela
  T.box(0.82, 0.08, 0.44, plastic(0x111827), [0, 0.84, 0]);
  T.box(0.14, 0.08, 0.05, faction === 'ares' ? glow(p.accent, 1.2) : gold, [0, 0.84, 0.225]);

  // Estampa frontal
  const decal = decalMaterial(faction, role === 'boss' ? 'rifleman' : role);
  if (decal) {
    T.add(new THREE.PlaneGeometry(0.86, 0.74), decal, [0, 1.16, 0.224]);
  }

  // ---- PERNAS
  addLeg(parts.leftLeg, legMat, bootMat, -1);
  addLeg(parts.rightLeg, legMat, bootMat, 1);

  // ---- BRAÇOS
  addArm(parts.leftArm, sleeveMat, handMat, -1);
  addArm(parts.rightArm, sleeveMat, handMat, 1);

  // ---- CABEÇA (base em y = 0 no pivô do pescoço; cabeça cilíndrica de 0.5)
  // A cabeça com rosto é um Mesh separado (textura). Aqui ficam os acessórios.
  const headTopY = 0.5;

  if (faction === 'cv') {
    if (isTank) {
      // Capacete de moto vermelho com viseira escura
      H.sphere(0.36, mainMat, [0, 0.3, 0], [1, 0.95, 1], 16);
      H.box(0.5, 0.2, 0.12, glass(0x0b0b0b, 0.75), [0, 0.28, 0.3]);
      H.box(0.06, 0.4, 0.06, accentMat, [0, 0.52, 0.0]);
    } else if (isMedic) {
      // Boné branco com cruz vermelha
      H.cyl(0.29, 0.29, 0.14, plastic(0xf8fafc), [0, headTopY - 0.02, 0], [0, 0, 0], 16);
      H.box(0.36, 0.04, 0.22, plastic(0xf8fafc), [0, headTopY - 0.07, 0.3]);
      H.box(0.12, 0.04, 0.04, mainMat, [0, headTopY + 0.04, 0.27]);
      H.box(0.04, 0.12, 0.04, mainMat, [0, headTopY + 0.04, 0.27]);
    } else if (isBoss) {
      // Boina vermelha + óculos escuros de ouro
      H.cyl(0.33, 0.3, 0.12, mainMat, [0.05, headTopY + 0.02, 0], [0, 0, -0.18], 16);
      H.stud(mainMat, [0.08, headTopY + 0.08, 0]);
      H.box(0.5, 0.08, 0.06, gold, [0, 0.33, 0.27]);
      H.box(0.18, 0.1, 0.05, blackMat, [-0.11, 0.31, 0.29]);
      H.box(0.18, 0.1, 0.05, blackMat, [0.11, 0.31, 0.29]);
    } else {
      // Boné de aba virada para trás + bandana vermelha no rosto
      H.add(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mainMat, [0, headTopY - 0.1, 0], [0, 0, 0], [1, 0.62, 1]);
      H.box(0.34, 0.04, 0.24, mainMat, [0, headTopY - 0.09, -0.32]);
      H.stud(blackMat, [0, headTopY + 0.07, 0], 0.7);
      // Bandana (cobre boca e nariz)
      H.cyl(0.285, 0.29, 0.17, plastic(p.main), [0, 0.13, 0], [0, 0, 0], 16, [1, 1, 1]);
      H.box(0.14, 0.18, 0.06, plastic(p.main), [0, 0.0, 0.28], [0.2, 0, 0]);
    }
  } else if (faction === 'pcc') {
    if (isTank) {
      // Capacete SWAT com viseira ciano
      H.sphere(0.34, blackMat, [0, 0.36, 0], [1, 0.85, 1], 16);
      H.box(0.48, 0.16, 0.1, glass(p.accent, 0.55), [0, 0.32, 0.29]);
      H.box(0.64, 0.05, 0.6, blackMat, [0, 0.42, 0]);
    } else if (isMedic) {
      H.cyl(0.29, 0.29, 0.12, plastic(0x0f172a), [0, headTopY - 0.02, 0], [0, 0, 0], 16);
      H.box(0.36, 0.04, 0.2, plastic(0x0f172a), [0, headTopY - 0.07, 0.3]);
      H.box(0.1, 0.03, 0.04, accentMat, [0, headTopY + 0.0, 0.27]);
      H.box(0.03, 0.1, 0.04, accentMat, [0, headTopY + 0.0, 0.27]);
    } else if (isBoss) {
      // Capacete blindado Z-15 com crista
      H.sphere(0.36, metal(0x1f2937), [0, 0.34, 0], [1, 0.95, 1], 16);
      H.box(0.52, 0.14, 0.1, glow(p.accent, 1.6), [0, 0.32, 0.3]);
      H.box(0.1, 0.18, 0.6, accentMat, [0, 0.66, 0]);
    } else {
      // Boné tático preto com patch ciano + headset
      H.cyl(0.29, 0.29, 0.14, blackMat, [0, headTopY - 0.02, 0], [0, 0, 0], 16);
      H.box(0.36, 0.04, 0.24, blackMat, [0, headTopY - 0.08, 0.3]);
      H.box(0.14, 0.08, 0.03, accentMat, [0, headTopY - 0.0, 0.29]);
      H.cyl(0.08, 0.08, 0.06, blackMat, [-0.3, 0.26, 0], [0, 0, Math.PI / 2], 10);
      H.cyl(0.08, 0.08, 0.06, blackMat, [0.3, 0.26, 0], [0, 0, Math.PI / 2], 10);
      H.box(0.03, 0.03, 0.2, blackMat, [0.3, 0.14, 0.12], [0.4, 0, 0]);
    }
  } else if (faction === 'guard') {
    // Quepe azul-marinho de segurança com aba e distintivo dourado
    H.cyl(0.3, 0.29, 0.16, plastic(0x1e3a8a), [0, headTopY + 0.0, 0], [0, 0, 0], 16);
    H.box(0.38, 0.04, 0.22, blackMat, [0, headTopY - 0.07, 0.3]);
    H.box(0.1, 0.1, 0.03, gold, [0, headTopY + 0.02, 0.3]);
  } else if (faction === 'pf') {
    if (isTank) {
      H.sphere(0.34, blackMat, [0, 0.36, 0], [1, 0.85, 1], 16);
      H.box(0.48, 0.16, 0.1, glass(0x0b0b0b, 0.7), [0, 0.32, 0.29]);
      H.box(0.3, 0.08, 0.03, accentMat, [0, 0.52, 0.27]);
    } else {
      // Boné preto "PF" com óculos táticos
      H.cyl(0.29, 0.29, 0.14, blackMat, [0, headTopY - 0.02, 0], [0, 0, 0], 16);
      H.box(0.36, 0.04, 0.24, blackMat, [0, headTopY - 0.08, 0.3]);
      H.box(0.18, 0.07, 0.03, accentMat, [0, headTopY - 0.0, 0.29]);
      H.box(0.5, 0.08, 0.05, glass(0x0b0b0b, 0.8), [0, 0.32, 0.275]);
    }
  } else if (faction === 'bope') {
    if (isTank) {
      H.sphere(0.34, blackMat, [0, 0.36, 0], [1, 0.85, 1], 16);
      H.box(0.48, 0.16, 0.1, glass(0x0b0b0b, 0.7), [0, 0.32, 0.29]);
    } else {
      // Boina preta inclinada com brasão amarelo
      H.cyl(0.33, 0.3, 0.12, blackMat, [0.05, headTopY + 0.02, 0], [0, 0, -0.18], 16);
      H.stud(blackMat, [0.08, headTopY + 0.08, 0]);
      H.box(0.1, 0.1, 0.03, accentMat, [-0.12, headTopY + 0.0, 0.3]);
    }
  } else {
    // A.R.E.S. — todos com capacete cyber e viseira neon
    const helmMat = isMedic ? plastic(0xe2e8f0) : metal(0x475569);
    if (isBoss) {
      H.box(0.68, 0.62, 0.66, metal(0x334155), [0, 0.3, 0]);
      H.box(0.6, 0.12, 0.05, glow(p.accent, 2.4), [0, 0.32, 0.34]);
      H.box(0.08, 0.36, 0.08, glow(p.accent, 1.6), [-0.28, 0.72, 0], [0, 0, 0.35]);
      H.box(0.08, 0.36, 0.08, glow(p.accent, 1.6), [0.28, 0.72, 0], [0, 0, -0.35]);
    } else {
      H.sphere(0.34, helmMat, [0, 0.33, 0], [1, 0.95, 1.02], 16);
      H.box(0.5, 0.11, 0.08, glow(isMedic ? 0x22c55e : 0x22d3ee, 2.2), [0, 0.32, 0.3]);
      H.box(0.08, 0.2, 0.08, glow(p.accent, 1.4), [0.32, 0.36, -0.05]);
      if (isTank) {
        H.box(0.7, 0.08, 0.5, metal(0x334155), [0, 0.55, -0.02]);
      }
    }
  }

  // ---- EXTRAS DO TRONCO POR CLASSE
  if (faction === 'cv' && !isMedic && !isTank) {
    // Corrente de ouro 3D
    T.torus(0.2, 0.025, gold, [0, 1.42, 0.12], [Math.PI / 2 - 0.25, 0, 0], Math.PI * 2, 18);
    T.box(0.1, 0.12, 0.04, gold, [0, 1.24, 0.245]);
  }
  if (isTank) {
    // Colete pesado volumoso + ombreiras
    const vest = faction === 'ares' ? metal(0x334155) : faction === 'pcc' ? blackMat : plastic(p.dark);
    T.box(0.92, 0.6, 0.12, vest, [0, 1.18, 0.24]);
    T.box(0.92, 0.6, 0.12, vest, [0, 1.18, -0.24]);
    T.box(0.36, 0.14, 0.5, vest, [-0.5, 1.56, 0], [0, 0, 0.3]);
    T.box(0.36, 0.14, 0.5, vest, [0.5, 1.56, 0], [0, 0, -0.3]);
    for (let i = 0; i < 3; i++) {
      T.box(0.2, 0.16, 0.08, faction === 'ares' ? glow(p.accent, 1.1) : plastic(0x1f2937), [-0.27 + i * 0.27, 1.0, 0.33]);
    }
    if (faction === 'ares') {
      // Reator dorsal do exo-esqueleto
      T.cyl(0.18, 0.18, 0.5, metal(0x475569), [0, 1.22, -0.42], [0, 0, 0], 12);
      T.cyl(0.12, 0.12, 0.52, glow(p.accent, 2.0), [0, 1.22, -0.42], [0, 0, 0], 12);
    }
  }
  if (isMedic) {
    // Mochila médica com cruz
    const packHex = faction === 'cv' ? 0xf8fafc : faction === 'pcc' ? 0x1e293b : 0xcbd5e1;
    const crossMat = faction === 'cv' ? mainMat : faction === 'pcc' ? accentMat : glow(p.accent, 1.2);
    T.box(0.62, 0.62, 0.26, plastic(packHex), [0, 1.18, -0.36]);
    T.box(0.1, 0.32, 0.03, crossMat, [0, 1.2, -0.505]);
    T.box(0.32, 0.1, 0.03, crossMat, [0, 1.2, -0.505]);
    T.cyl(0.07, 0.07, 0.5, glow(0x22c55e, 1.2), [0.24, 1.38, -0.36], [0, 0, 0], 10);
  }
  if (faction === 'pcc' && !isMedic) {
    // Pochetes e rádio no ombro
    T.box(0.16, 0.18, 0.1, plastic(0x111827), [0.3, 1.36, 0.27]);
    T.cyl(0.012, 0.012, 0.2, metal(0x64748b), [0.34, 1.52, 0.27], [0, 0, 0], 6);
  }
  if (faction === 'ares' && !isTank && !isBoss) {
    // Ombreiras cyber
    T.box(0.3, 0.12, 0.46, metal(0x334155), [-0.5, 1.56, 0], [0, 0, 0.32]);
    T.box(0.3, 0.12, 0.46, metal(0x334155), [0.5, 1.56, 0], [0, 0, -0.32]);
    T.box(0.22, 0.03, 0.47, glow(p.accent, 1.4), [-0.5, 1.63, 0], [0, 0, 0.32]);
    T.box(0.22, 0.03, 0.47, glow(p.accent, 1.4), [0.5, 1.63, 0], [0, 0, -0.32]);
  }

  // ---- ESPECIALISTAS
  if (isSpecial && faction === 'cv') {
    // Lança-foguetes RPG apoiado no ombro direito (fica no tronco)
    const tube = plastic(0x4d5a2a);
    T.cyl(0.11, 0.11, 1.3, tube, [0.42, 1.62, 0.1], [Math.PI / 2, 0, 0], 12);
    T.cyl(0.14, 0.11, 0.16, plastic(0x1f2328), [0.42, 1.62, -0.6], [Math.PI / 2, 0, 0], 12);
    T.cyl(0.0, 0.13, 0.3, plastic(0x22c55e), [0.42, 1.62, 0.92], [Math.PI / 2, 0, 0], 12);
    T.cyl(0.1, 0.1, 0.12, plastic(0x22c55e), [0.42, 1.62, 0.73], [Math.PI / 2, 0, 0], 12);
    T.box(0.08, 0.2, 0.08, plastic(0x1f2328), [0.42, 1.46, 0.3]);
    // Foguetes reserva nas costas
    for (const sx of [-0.15, 0.15]) {
      T.cyl(0.08, 0.08, 0.5, plastic(0x4d5a2a), [sx, 1.22, -0.3], [0, 0, 0], 10);
      T.cyl(0.0, 0.09, 0.2, plastic(0x22c55e), [sx, 1.56, -0.3], [0, 0, 0], 10);
    }
  } else if (isSpecial && faction === 'pcc') {
    // Colete de C4: tijolinhos LEGO de massa explosiva + fios
    const c4 = plastic(0xe7e5e4);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        T.box(0.22, 0.14, 0.08, c4, [-0.25 + c * 0.25, 1.0 + r * 0.18, 0.27]);
        T.stud(c4, [-0.25 + c * 0.25, 1.07 + r * 0.18, 0.27], 0.5);
      }
    }
    T.box(0.7, 0.03, 0.03, glow(0xef4444, 1.5), [0, 1.36, 0.3]);
    // Mochila de C4 com luz piscante
    T.box(0.56, 0.6, 0.28, plastic(0x111827), [0, 1.18, -0.37]);
    for (let i = 0; i < 3; i++) T.box(0.16, 0.12, 0.06, c4, [-0.18 + i * 0.18, 1.3, -0.53]);
    T.box(0.1, 0.06, 0.06, glow(0xef4444, 2.5), [0, 1.1, -0.53]);
  } else if (isSpecial && faction === 'ares') {
    // Antena/controle de drone nas costas
    T.box(0.5, 0.5, 0.22, metal(0x334155), [0, 1.2, -0.34]);
    T.cyl(0.02, 0.02, 0.6, metal(0x94a3b8), [0.18, 1.7, -0.36], [0, 0, 0], 6);
    T.sphere(0.05, glow(p.accent, 2.2), [0.18, 2.0, -0.36]);
    // Drone flutuante (parte separada, animada)
    const D = parts.drone;
    D.box(0.5, 0.12, 0.5, metal(0x334155), [0, 0, 0]);
    D.sphere(0.13, glow(0x22d3ee, 2.0), [0, -0.08, 0.12]);
    for (const [dx, dz] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
      D.box(0.32, 0.04, 0.06, metal(0x475569), [dx * 0.5, 0, dz * 0.5], [0, Math.atan2(dx, dz), 0]);
      D.cyl(0.16, 0.16, 0.03, glass(p.accent, 0.5), [dx, 0.05, dz], [0, 0, 0], 14);
    }
    D.box(0.08, 0.08, 0.3, glow(p.accent, 1.8), [0, -0.02, 0.32]);
  }
  if (isMedic && faction === 'ares') {
    // Nano-drone médico
    const D = parts.drone;
    D.sphere(0.2, plastic(0xe2e8f0), [0, 0, 0], [1, 0.75, 1], 14);
    D.torus(0.24, 0.035, glow(0x22c55e, 1.8), [0, 0, 0], [Math.PI / 2, 0, 0]);
    D.box(0.08, 0.22, 0.04, glow(0x22c55e, 2.0), [0, 0, 0.18]);
    D.box(0.22, 0.08, 0.04, glow(0x22c55e, 2.0), [0, 0, 0.18]);
  }

  // ---- ESCUDO / MÃO ESQUERDA (pesados)
  let hasShield = false;
  if (isTank || isBoss) {
    hasShield = true;
    const O = parts.offhand;
    if (faction === 'cv') {
      // Porta de carro vermelha arrancada como escudo (estilo PvZ: improviso cômico)
      O.box(0.92, 0.9, 0.08, mainMat, [0, 0.0, 0]);
      O.box(0.78, 0.36, 0.09, glass(0x93c5fd, 0.6), [0, 0.28, 0.0]);
      O.box(0.92, 0.06, 0.1, plastic(0x111827), [0, 0.07, 0]);
      O.box(0.16, 0.05, 0.06, metal(0xcbd5e1), [0.28, -0.02, 0.06]);
      O.box(0.92, 0.36, 0.09, plastic(p.dark), [0, -0.3, 0]);
    } else if (faction === 'pcc') {
      // Escudo balístico preto com visor e faixa ciano
      O.box(0.84, 1.3, 0.1, blackMat, [0, -0.05, 0]);
      O.box(0.4, 0.14, 0.11, glass(p.accent, 0.6), [0, 0.42, 0]);
      O.box(0.84, 0.08, 0.11, accentMat, [0, 0.12, 0]);
      O.box(0.84, 0.08, 0.11, accentMat, [0, -0.6, 0]);
    } else if (faction === 'guard' || faction === 'pf') {
      O.box(0.84, 1.3, 0.1, blackMat, [0, -0.05, 0]);
      O.box(0.4, 0.14, 0.11, glass(0x93c5fd, 0.6), [0, 0.42, 0]);
      O.box(0.84, 0.1, 0.11, accentMat, [0, 0.1, 0]);
    } else if (faction === 'bope') {
      O.box(0.84, 1.3, 0.1, blackMat, [0, -0.05, 0]);
      O.box(0.4, 0.14, 0.11, glass(0x93c5fd, 0.6), [0, 0.42, 0]);
      O.box(0.84, 0.1, 0.11, accentMat, [0, 0.1, 0]);
    } else {
      // Escudo de energia hexagonal
      O.cyl(0.66, 0.66, 0.05, glass(p.accent, 0.38), [0, 0.0, 0], [Math.PI / 2, 0, 0], 6);
      O.torus(0.66, 0.04, glow(p.accent, 2.0), [0, 0.0, 0], [0, 0, 0], Math.PI * 2, 6);
      O.box(0.14, 0.3, 0.12, metal(0x475569), [0, 0, -0.06]);
    }
  }

  // ---- CHEFÃO (Big-Fig): ombreiras colossais, punho gigante e capa
  if (isBoss) {
    const shoulderMat = faction === 'ares' ? metal(0x334155) : faction === 'pcc' ? metal(0x1f2937) : mainMat;
    for (const sx of [-1, 1]) {
      T.box(0.5, 0.36, 0.62, shoulderMat, [sx * 0.66, 1.58, 0], [0, 0, sx * -0.2]);
      T.stud(accentMat, [sx * 0.62, 1.78, 0.14]);
      T.stud(accentMat, [sx * 0.62, 1.78, -0.14]);
      if (faction === 'ares') {
        T.cyl(0.08, 0.08, 0.5, metal(0x475569), [sx * 0.66, 1.9, 0.12], [Math.PI / 2, 0, 0], 10);
        T.sphere(0.07, glow(p.accent, 2.4), [sx * 0.66, 1.9, 0.38]);
      }
    }
    if (faction === 'cv') {
      // Correntes grossas de ouro + capa vermelha
      T.torus(0.26, 0.04, gold, [0, 1.38, 0.1], [Math.PI / 2 - 0.3, 0, 0], Math.PI * 2, 18);
      T.torus(0.32, 0.035, gold, [0, 1.3, 0.12], [Math.PI / 2 - 0.35, 0, 0], Math.PI * 2, 18);
      T.box(0.9, 1.1, 0.05, plastic(p.dark), [0, 1.02, -0.27], [-0.12, 0, 0]);
    } else if (faction === 'pcc') {
      T.box(0.94, 0.66, 0.14, metal(0x1f2937), [0, 1.18, 0.25]);
      T.box(0.5, 0.1, 0.15, glow(p.accent, 1.6), [0, 1.3, 0.26]);
    } else {
      T.cyl(0.2, 0.2, 0.08, glow(p.accent, 2.6), [0, 1.22, 0.24], [Math.PI / 2, 0, 0], 16);
      T.box(0.6, 0.7, 0.3, metal(0x475569), [0, 1.2, -0.38]);
      T.box(0.12, 0.6, 0.06, glow(p.accent, 1.8), [0, 1.2, -0.54]);
    }
  }

  // ---- ARMA PRINCIPAL
  const muzzle = buildWeapon(parts.weapon, faction, weaponKind);

  const built = {};
  for (const [k, b] of Object.entries(parts)) built[k] = b.build();

  return {
    faction,
    role,
    parts: built,
    faceKey,
    hasShield,
    hasDrone: built.drone.length > 0,
    weaponKind,
    muzzle
  };
}

function getBlueprint(faction, role) {
  const key = `${faction}_${role}`;
  if (!BLUEPRINTS.has(key)) BLUEPRINTS.set(key, buildBlueprint(faction, role));
  return BLUEPRINTS.get(key);
}

const HEAD_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.27, 0.27, 0.5, 20);
  // Gira 180° para o centro da textura (u = 0.5) ficar na frente (+Z)
  g.rotateY(Math.PI);
  return g;
})();

function instantiate(list, parent, castShadow = true) {
  for (const { geometry, material } of list) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow && !material.transparent;
    mesh.receiveShadow = false;
    parent.add(mesh);
  }
}

/**
 * Cria a minifigura de combate de uma facção.
 * Retorna as articulações no mesmo formato usado pelo FactionWarSystem.
 */
export function createFactionSoldierVisual(faction = 'cv', role = 'rifleman') {
  const safeFaction = PALETTE[faction] ? faction : 'cv';
  const safeRole = SOLDIER_ROLES.includes(role) ? role : 'rifleman';
  const bp = getBlueprint(safeFaction, safeRole);

  const bodyRig = new THREE.Group();
  instantiate(bp.parts.torso, bodyRig);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.2, 0.68, 0);
  instantiate(bp.parts.leftLeg, leftLeg);
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, 0.68, 0);
  instantiate(bp.parts.rightLeg, rightLeg);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.56, 1.44, 0);
  leftArm.rotation.z = 0.08;
  instantiate(bp.parts.leftArm, leftArm, false);
  const rightArm = new THREE.Group();
  rightArm.position.set(0.56, 1.44, 0);
  rightArm.rotation.z = -0.08;
  instantiate(bp.parts.rightArm, rightArm, false);

  // Arma presa na mão direita, compensando a inclinação do braço (fica nivelada)
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.62, 0.08);
  weaponMount.rotation.x = AIM_POSE.rightArmX * -1;
  instantiate(bp.parts.weapon, weaponMount, false);
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
    instantiate(bp.parts.offhand, shieldMount);
    leftArm.add(shieldMount);
  }

  // Cabeça: rosto texturizado + acessórios
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  const headMesh = new THREE.Mesh(HEAD_GEO, faceMaterial(bp.faceKey));
  headMesh.position.y = 0.25;
  headMesh.castShadow = true;
  head.add(headMesh);
  const topStud = new THREE.Mesh(SHARED_STUD_GEO, plastic(bp.faceKey === 'pcc_mask' ? 0x0a0b0f : 0xfacc15));
  topStud.position.y = 0.5;
  head.add(topStud);
  instantiate(bp.parts.head, head, false);

  bodyRig.add(leftLeg, rightLeg, leftArm, rightArm, head);

  let drone = null;
  if (bp.hasDrone) {
    drone = new THREE.Group();
    drone.position.set(0.7, 2.7, -0.3);
    instantiate(bp.parts.drone, drone, false);
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
    className: SOLDIER_CLASS_INFO[safeFaction]?.[safeRole] || ''
  };
}

const MUZZLE_GEO = new THREE.OctahedronGeometry(0.16, 0);
const MUZZLE_MAT = new THREE.MeshBasicMaterial({ color: 0xfde047 });
const MUZZLE_HEAL_MAT = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
const MUZZLE_LASER_MAT = new THREE.MeshBasicMaterial({ color: 0xf0abfc });

/**
 * Animação leve por frame (respiração, cabeça olhando, drone flutuando, arma em guarda).
 * Chamado pelo FactionWarSystem depois da movimentação.
 */
export function animateFactionSoldier(visual, clock, phaseOffset = 0) {
  if (!visual) return;
  const t = clock + phaseOffset;
  if (visual.head) {
    visual.head.rotation.y = Math.sin(t * 0.7) * 0.25;
  }
  if (visual.drone) {
    visual.drone.position.y = 2.7 + Math.sin(t * 2.4) * 0.15;
    visual.drone.rotation.y += 0.02;
  }
}
