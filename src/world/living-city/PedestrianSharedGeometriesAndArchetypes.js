import * as THREE from 'three';
import { mergeBufferGeometries } from '../BuildingGenerator.js';

// ============================================================================
// GEOMETRIAS COMPARTILHADAS PRÉ-FUNDIDAS DE MINIFIGURA LEGO REAL + ACESSÓRIOS CIVIS 3D
// (Zero custo extra de Draw Calls — 60 FPS cravados para 160 Civis LEGO!)
// ============================================================================
function buildNpcTrapezoidTorsoGeo() {
  const geo = new THREE.BoxGeometry(1, 0.76, 0.44);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const widthScale = y > 0 ? 0.94 : 0.78;
    pos.setX(i, pos.getX(i) * widthScale);
  }
  geo.computeVertexNormals();
  const neckRing = new THREE.CylinderGeometry(0.19, 0.22, 0.08, 12);
  neckRing.translate(0, 0.41, 0);
  return mergeBufferGeometries([geo, neckRing]);
}

function buildNpcHipGeo() {
  const waist = new THREE.BoxGeometry(0.78, 0.14, 0.42);
  const tHook = new THREE.BoxGeometry(0.11, 0.22, 0.4);
  tHook.translate(0, -0.1, 0);
  const buckle = new THREE.BoxGeometry(0.18, 0.14, 0.44);
  return mergeBufferGeometries([waist, tHook, buckle]);
}

function buildNpcDetailedLegGeo() {
  const thigh = new THREE.BoxGeometry(0.31, 0.28, 0.34);
  thigh.translate(0, -0.15, 0);
  const shin = new THREE.BoxGeometry(0.3, 0.26, 0.33);
  shin.translate(0, -0.42, 0);
  const bootFoot = new THREE.BoxGeometry(0.32, 0.15, 0.46);
  bootFoot.translate(0, -0.545, 0.065);
  return mergeBufferGeometries([thigh, shin, bootFoot]);
}

function buildNpcDetailedArmGeo() {
  const shoulder = new THREE.SphereGeometry(0.135, 10, 10);
  shoulder.translate(0, -0.02, 0);
  const upperArm = new THREE.CylinderGeometry(0.115, 0.105, 0.27, 10);
  upperArm.translate(0, -0.15, 0);
  const forearm = new THREE.CylinderGeometry(0.105, 0.095, 0.25, 10);
  forearm.rotateX(-0.18);
  forearm.translate(0, -0.36, 0.03);
  const wrist = new THREE.CylinderGeometry(0.078, 0.078, 0.07, 10);
  wrist.translate(0, -0.48, 0.06);
  const clawHand = new THREE.TorusGeometry(0.092, 0.035, 8, 12, Math.PI * 1.38);
  clawHand.rotateY(Math.PI / 2);
  clawHand.rotateX(Math.PI * 0.65);
  clawHand.translate(0, -0.56, 0.08);
  return mergeBufferGeometries([shoulder, upperArm, forearm, wrist, clawHand]);
}

function buildNpcDetailedHeadGeo() {
  const neck = new THREE.CylinderGeometry(0.21, 0.21, 0.08, 14);
  neck.translate(0, -0.25, 0);
  const botBevel = new THREE.CylinderGeometry(0.32, 0.25, 0.06, 16);
  botBevel.translate(0, -0.2, 0);
  const mainHead = new THREE.CylinderGeometry(0.32, 0.32, 0.36, 16);
  const topBevel = new THREE.CylinderGeometry(0.26, 0.32, 0.06, 16);
  topBevel.translate(0, 0.2, 0);
  const topStud = new THREE.CylinderGeometry(0.18, 0.18, 0.11, 14);
  topStud.translate(0, 0.28, 0);
  return mergeBufferGeometries([neck, botBevel, mainHead, topBevel, topStud]);
}

function buildNpcTorsoDecalGeo() {
  const frontPlane = new THREE.PlaneGeometry(0.76, 0.68);
  frontPlane.translate(0, 0, 0.225);
  const backPlane = new THREE.PlaneGeometry(0.76, 0.68);
  backPlane.rotateY(Math.PI);
  backPlane.translate(0, 0, -0.225);
  return mergeBufferGeometries([frontPlane, backPlane]);
}

function buildCivilianPropGeos() {
  // 1) Maleta Executiva 3D LEGO (Corpo + Alça superior)
  const bcBody = new THREE.BoxGeometry(0.11, 0.3, 0.4);
  bcBody.translate(0, -0.14, 0);
  const bcHandle = new THREE.BoxGeometry(0.06, 0.09, 0.16);
  bcHandle.translate(0, 0.04, 0);
  const briefcaseGeo = mergeBufferGeometries([bcBody, bcHandle]);

  // 2) Copinho de Café LEGO (Copo cônico + Tampa superior)
  const cupBody = new THREE.CylinderGeometry(0.082, 0.062, 0.2, 10);
  const cupLid = new THREE.CylinderGeometry(0.092, 0.092, 0.04, 10);
  cupLid.translate(0, 0.11, 0);
  const coffeeCupGeo = mergeBufferGeometries([cupBody, cupLid]);

  // 3) Câmera Fotográfica LEGO 3D (Corpo + Lente cilíndrica + Visor superior)
  const camBody = new THREE.BoxGeometry(0.28, 0.19, 0.14);
  const camLens = new THREE.CylinderGeometry(0.072, 0.078, 0.13, 10);
  camLens.rotateX(Math.PI / 2);
  camLens.translate(0, -0.01, 0.11);
  const camTop = new THREE.BoxGeometry(0.1, 0.05, 0.09);
  camTop.translate(0.06, 0.11, 0);
  const cameraGeo = mergeBufferGeometries([camBody, camLens, camTop]);

  // 4) Smartphone LEGO 3D
  const phoneBody = new THREE.BoxGeometry(0.11, 0.03, 0.2);
  phoneBody.rotateX(0.35);
  const smartphoneGeo = phoneBody;

  // 5) Sacola de Compras LEGO 3D
  const bagBody = new THREE.BoxGeometry(0.14, 0.32, 0.28);
  bagBody.translate(0, -0.16, 0);
  const bagHandle = new THREE.BoxGeometry(0.05, 0.1, 0.12);
  bagHandle.translate(0, 0.03, 0);
  const shoppingBagGeo = mergeBufferGeometries([bagBody, bagHandle]);

  // 6) Capacete de Obra LEGO (Hard Hat)
  const hhDome = new THREE.CylinderGeometry(0.31, 0.355, 0.18, 14);
  hhDome.translate(0, 0.04, 0);
  const hhRidge = new THREE.BoxGeometry(0.1, 0.07, 0.56);
  hhRidge.translate(0, 0.13, 0.02);
  const hhBrim = new THREE.BoxGeometry(0.52, 0.045, 0.28);
  hhBrim.translate(0, -0.03, 0.24);
  const hardhatGeo = mergeBufferGeometries([hhDome, hhRidge, hhBrim]);

  // 7) Boné LEGO para frente (Turista / Urbano) e para trás (Jovem de Rua)
  const capCrown = new THREE.CylinderGeometry(0.342, 0.346, 0.15, 14);
  const capBrimFwd = new THREE.BoxGeometry(0.46, 0.048, 0.32);
  capBrimFwd.translate(0, -0.05, 0.25);
  const capForwardGeo = mergeBufferGeometries([capCrown, capBrimFwd]);

  const capCrownBack = new THREE.CylinderGeometry(0.342, 0.346, 0.15, 14);
  const capBrimBack = new THREE.BoxGeometry(0.46, 0.048, 0.32);
  capBrimBack.translate(0, -0.05, -0.25);
  const capBackwardGeo = mergeBufferGeometries([capCrownBack, capBrimBack]);

  // 8) Cabelo Clássico LEGO Pré-Fundido
  const hairTop = new THREE.BoxGeometry(0.66, 0.18, 0.66);
  hairTop.translate(0, 0.03, 0.01);
  const hairBack = new THREE.BoxGeometry(0.64, 0.32, 0.18);
  hairBack.translate(0, -0.11, -0.28);
  const classicHairGeo = mergeBufferGeometries([hairTop, hairBack]);

  // 9) Faixa Esportiva (Headband de Corredor)
  const headbandGeo = new THREE.CylinderGeometry(0.342, 0.342, 0.095, 16);

  // 10) Fone de Ouvido 3D (Headphones)
  const hpArc = new THREE.BoxGeometry(0.72, 0.07, 0.13);
  hpArc.translate(0, 0.13, 0);
  const hpCupL = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10);
  hpCupL.rotateZ(Math.PI / 2);
  hpCupL.translate(-0.35, -0.08, 0);
  const hpCupR = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10);
  hpCupR.rotateZ(Math.PI / 2);
  hpCupR.translate(0.35, -0.08, 0);
  const headphonesGeo = mergeBufferGeometries([hpArc, hpCupL, hpCupR]);

  // 11) Mochila LEGO 3D (Turista / Urbano)
  const bpMain = new THREE.BoxGeometry(0.46, 0.48, 0.21);
  const bpPocket = new THREE.BoxGeometry(0.34, 0.22, 0.08);
  bpPocket.translate(0, -0.08, -0.13);
  const backpackGeo = mergeBufferGeometries([bpMain, bpPocket]);

  return {
    briefcase: briefcaseGeo,
    coffee_cup: coffeeCupGeo,
    camera: cameraGeo,
    smartphone: smartphoneGeo,
    shopping_bag: shoppingBagGeo,
    hardhat: hardhatGeo,
    cap_forward: capForwardGeo,
    cap_backward: capBackwardGeo,
    classic_hair: classicHairGeo,
    headband: headbandGeo,
    headphones: headphonesGeo,
    backpack: backpackGeo
  };
}

export const NPC_HEAD_GEO = buildNpcDetailedHeadGeo();
export const NPC_FACE_SHELL_GEO = new THREE.CylinderGeometry(
  0.326,
  0.326,
  0.38,
  18,
  1,
  true,
  -Math.PI * 0.45,
  Math.PI * 0.9
);
export const NPC_TRAPEZOID_TORSO_GEO = buildNpcTrapezoidTorsoGeo();
export const NPC_TORSO_DECAL_GEO = buildNpcTorsoDecalGeo();
export const NPC_HIP_GEO = buildNpcHipGeo();
export const NPC_ARM_GEO = buildNpcDetailedArmGeo();
export const NPC_LEG_GEO = buildNpcDetailedLegGeo();
export const SHARED_CIV_PROP_GEOS = buildCivilianPropGeos();
export const CAMERA_FLASH_GEO = new THREE.OctahedronGeometry(0.34, 0);
export const SHARED_CAMERA_FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });

// ============================================================================
// TEXTURAS DE TORSO LEGO POR ARQUÉTIPO DE BAIRRO (CACHE GLOBAL)
// ============================================================================
const _civTorsoMatCache = new Map();
export function getSharedCivilianTorsoMaterial(styleKey = 'casual_blue') {
  if (_civTorsoMatCache.has(styleKey)) {
    return _civTorsoMatCache.get(styleKey);
  }
  if (typeof document === 'undefined') {
    const fallbackMat = new THREE.MeshStandardMaterial({ roughness: 0.24, metalness: 0.08 });
    _civTorsoMatCache.set(styleKey, fallbackMat);
    return fallbackMat;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (styleKey.startsWith('exec_')) {
    const suitBg =
      styleKey === 'exec_navy' ? '#1e3a8a' : styleKey === 'exec_charcoal' ? '#334155' : '#111827';
    const tieColor = styleKey === 'exec_navy' ? '#dc2626' : styleKey === 'exec_charcoal' ? '#2563eb' : '#facc15';
    ctx.fillStyle = suitBg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(88, 0);
    ctx.lineTo(64, 78);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tieColor;
    ctx.beginPath();
    ctx.moveTo(58, 6);
    ctx.lineTo(70, 6);
    ctx.lineTo(68, 68);
    ctx.lineTo(64, 78);
    ctx.lineTo(60, 68);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(36, 0);
    ctx.lineTo(64, 80);
    ctx.lineTo(92, 0);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(82, 42, 18, 6);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(64, 92, 4, 0, Math.PI * 2);
    ctx.arc(64, 108, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (styleKey.startsWith('tourist_')) {
    const bg = styleKey === 'tourist_aloha' ? '#06b6d4' : '#f97316';
    const accent = styleKey === 'tourist_aloha' ? '#fde047' : '#fef08a';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 0, 28, 128);
    ctx.fillStyle = accent;
    for (const [fx, fy] of [
      [24, 28],
      [32, 74],
      [22, 106],
      [102, 32],
      [96, 78],
      [106, 108]
    ]) {
      ctx.beginPath();
      ctx.arc(fx, fy, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(94, 118);
    ctx.stroke();
  } else if (styleKey.startsWith('jogger_')) {
    const bg =
      styleKey === 'jogger_lime' ? '#84cc16' : styleKey === 'jogger_cyan' ? '#0ea5e9' : '#ec4899';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 18, 128);
    ctx.fillRect(110, 0, 18, 128);
    ctx.beginPath();
    ctx.arc(64, 4, 24, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(36, 44, 56, 38);
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(46, 54, 8, 18);
    ctx.fillRect(62, 54, 18, 18);
  } else if (styleKey.startsWith('beach_')) {
    const bg = styleKey === 'beach_floral' ? '#f43f5e' : '#facc15';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(64, 56, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 96, 128, 16);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 88, 128, 8);
  } else if (styleKey.startsWith('jersey_')) {
    if (styleKey === 'jersey_amarela') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(0, 0, 128, 16);
      ctx.fillRect(46, 42, 12, 44);
      ctx.fillRect(66, 42, 22, 44);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(72, 48, 10, 32);
    } else if (styleKey === 'jersey_rubro') {
      for (let y = 0; y < 128; y += 26) {
        ctx.fillStyle = (y / 26) % 2 === 0 ? '#dc2626' : '#111827';
        ctx.fillRect(0, y, 128, 26);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(82, 26, 16, 16);
    } else {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(24, 0, 20, 128);
      ctx.fillRect(84, 0, 20, 128);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(64, 42, 11, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (styleKey.startsWith('worker_')) {
    const vestColor = styleKey === 'worker_orange' ? '#f97316' : '#84cc16';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = vestColor;
    ctx.fillRect(8, 0, 44, 128);
    ctx.fillRect(76, 0, 44, 128);
    ctx.fillRect(8, 72, 112, 56);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(14, 12, 18, 104);
    ctx.fillRect(96, 12, 18, 104);
    ctx.fillRect(8, 82, 112, 14);
    ctx.fillRect(8, 106, 112, 12);
  } else {
    const jkt =
      styleKey === 'casual_red' ? '#dc2626' : styleKey === 'casual_green' ? '#16a34a' : '#2563eb';
    ctx.fillStyle = jkt;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(50, 0, 28, 128);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(64, 128);
    ctx.stroke();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
    ctx.fillRect(18, 78, 26, 28);
    ctx.fillRect(84, 78, 26, 28);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.24,
    metalness: 0.08
  });
  _civTorsoMatCache.set(styleKey, mat);
  return mat;
}

// Catálogo dos 7 Arquétipos Visuais de Civis LEGO por Bairro
export const ARCHETYPE_PRESETS = {
  executive: [
    { torsoKey: 'exec_navy', torsoHex: 0x1e3a8a, legHex: 0x0f172a, faceKey: 'civ_smile', headProp: 'classic_hair', headColor: 0x451a03, handProp: 'briefcase', handPropColor: 0x451a03, backProp: null, speed: 3.3 },
    { torsoKey: 'exec_charcoal', torsoHex: 0x334155, legHex: 0x1e293b, faceKey: 'civ_cool', headProp: 'classic_hair', headColor: 0x111827, handProp: 'coffee_cup', handPropColor: 0xf8fafc, backProp: null, speed: 3.45 },
    { torsoKey: 'exec_black', torsoHex: 0x111827, legHex: 0x090a0d, faceKey: 'civ_shades', headProp: 'classic_hair', headColor: 0x78350f, handProp: 'briefcase', handPropColor: 0x1e293b, backProp: null, speed: 3.35 }
  ],
  tourist: [
    { torsoKey: 'tourist_aloha', torsoHex: 0x06b6d4, legHex: 0xfde68a, faceKey: 'civ_smile', headProp: 'cap_forward', headColor: 0xef4444, handProp: 'camera', handPropColor: 0x1e293b, backProp: 'backpack', backPropColor: 0xd97706, speed: 3.05 },
    { torsoKey: 'tourist_sunset', torsoHex: 0xf97316, legHex: 0x1e3a8a, faceKey: 'civ_shades', headProp: 'cap_forward', headColor: 0xfacc15, handProp: 'camera', handPropColor: 0x0f172a, backProp: 'backpack', backPropColor: 0x2563eb, speed: 3.1 }
  ],
  jogger: [
    { torsoKey: 'jogger_lime', torsoHex: 0x84cc16, legHex: 0x0f172a, faceKey: 'civ_cool', headProp: 'headband', headColor: 0xef4444, handProp: null, handPropColor: 0xffffff, backProp: null, speed: 5.4 },
    { torsoKey: 'jogger_cyan', torsoHex: 0x0ea5e9, legHex: 0x1e293b, faceKey: 'civ_smile', headProp: 'headband', headColor: 0xfacc15, handProp: null, handPropColor: 0xffffff, backProp: null, speed: 5.4 },
    { torsoKey: 'jogger_pink', torsoHex: 0xec4899, legHex: 0x111827, faceKey: 'civ_shades', headProp: 'headphones', headColor: 0xf8fafc, handProp: null, handPropColor: 0xffffff, backProp: null, speed: 5.4 }
  ],
  beachgoer: [
    { torsoKey: 'beach_floral', torsoHex: 0xf43f5e, legHex: 0x38bdf8, faceKey: 'civ_shades', headProp: 'cap_forward', headColor: 0xf8fafc, handProp: 'coffee_cup', handPropColor: 0x38bdf8, backProp: null, speed: 2.95 },
    { torsoKey: 'beach_tank', torsoHex: 0xfacc15, legHex: 0x16a34a, faceKey: 'civ_shades', headProp: 'classic_hair', headColor: 0xd97706, handProp: null, handPropColor: 0xffffff, backProp: null, speed: 3.05 }
  ],
  street_youth: [
    { torsoKey: 'jersey_amarela', torsoHex: 0xfacc15, legHex: 0x1d4ed8, faceKey: 'civ_cool', headProp: 'cap_backward', headColor: 0x16a34a, handProp: 'smartphone', handPropColor: 0x38bdf8, backProp: null, speed: 3.4 },
    { torsoKey: 'jersey_rubro', torsoHex: 0xdc2626, legHex: 0x111827, faceKey: 'civ_shades', headProp: 'headphones', headColor: 0xef4444, handProp: 'smartphone', handPropColor: 0x0ea5e9, backProp: 'backpack', backPropColor: 0x111827, speed: 3.5 },
    { torsoKey: 'jersey_azul', torsoHex: 0x2563eb, legHex: 0x1e293b, faceKey: 'civ_smile', headProp: 'cap_backward', headColor: 0xf8fafc, handProp: 'smartphone', handPropColor: 0x38bdf8, backProp: null, speed: 3.35 }
  ],
  worker: [
    { torsoKey: 'worker_orange', torsoHex: 0xf97316, legHex: 0x1e3a8a, faceKey: 'civ_smile', headProp: 'hardhat', headColor: 0xfacc15, handProp: 'coffee_cup', handPropColor: 0xf8fafc, backProp: null, speed: 3.2 },
    { torsoKey: 'worker_lime', torsoHex: 0x84cc16, legHex: 0x334155, faceKey: 'civ_cool', headProp: 'hardhat', headColor: 0xfacc15, handProp: 'briefcase', handPropColor: 0x475569, backProp: null, speed: 3.25 }
  ],
  casual: [
    { torsoKey: 'casual_blue', torsoHex: 0x2563eb, legHex: 0x1e293b, faceKey: 'civ_smile', headProp: 'classic_hair', headColor: 0x451a03, handProp: 'shopping_bag', handPropColor: 0xef4444, backProp: null, speed: 3.2 },
    { torsoKey: 'casual_red', torsoHex: 0xdc2626, legHex: 0x0f172a, faceKey: 'civ_cool', headProp: 'classic_hair', headColor: 0x090a0d, handProp: 'coffee_cup', handPropColor: 0xd97706, backProp: 'backpack', backPropColor: 0x334155, speed: 3.25 },
    { torsoKey: 'casual_green', torsoHex: 0x16a34a, legHex: 0x334155, faceKey: 'civ_smile', headProp: 'cap_forward', headColor: 0x1e293b, handProp: 'shopping_bag', handPropColor: 0xfacc15, backProp: null, speed: 3.15 }
  ]
};

export const pedestrianArchetypeMethods = {
  _pickArchetypeForCoords(x, z, seed = 0) {
    const r = Math.abs(Math.sin(seed * 12.9898 + x * 0.031 + z * 0.017) * 43758.5453) % 1;
    // 1. Praia Sul & Píer Turístico
    if (z > 610) {
      if (r < 0.48) return 'beachgoer';
      if (r < 0.76) return 'tourist';
      return 'jogger';
    }
    // 2. Porto Leste, Distrito Industrial & Aeroporto Oeste
    if (x > 510 || x < -820) {
      if (r < 0.58) return 'worker';
      if (r < 0.84) return 'street_youth';
      return 'executive';
    }
    // 3. Morro da Cidade de Deus
    if (x < -450 && z > -430 && z < 430) {
      return r < 0.72 ? 'street_youth' : 'casual';
    }
    // 4. Parque Central & Arredores do Lago
    if (x > -80 && x < 340 && z > 12 && z < 395) {
      if (r < 0.46) return 'jogger';
      if (r < 0.76) return 'tourist';
      return 'casual';
    }
    // 5. Subúrbio Norte
    if (z < -410) {
      if (r < 0.44) return 'casual';
      if (r < 0.78) return 'street_youth';
      return 'jogger';
    }
    // 6. Times Square & Complexo da Torre dos Heróis
    if ((x < -130 && z > -155 && z < 80) || (Math.abs(x) < 130 && z > -55 && z <= 18)) {
      if (r < 0.52) return 'tourist';
      if (r < 0.78) return 'executive';
      return 'casual';
    }
    // 7. Centro Financeiro & Super Banco Central
    if (r < 0.56) return 'executive';
    if (r < 0.8) return 'tourist';
    return 'casual';
  }
};
