import * as THREE from 'three';
import { mergeBufferGeometries } from '../BuildingGenerator.js';
import {
  createTrapezoidTorsoGeometry,
  createMinifigHipGeometry,
  createMinifigLegGeometry,
  createMinifigArmGeometry,
  createMinifigHandGeometry,
  createMinifigHeadGeometry,
  createMinifigFaceShellGeometry
} from '../../entities/minifigure/MinifigBaseRigBuilder.js';

// ============================================================================
// TONS DE PELE HUMANOS REALISTAS & ANATOMIA EXATA DOS OPERADORES (60 FPS INSTANCED)
// ============================================================================
export const HUMAN_SKIN_TONES = [
  0xe0ac69,
  0xc68642,
  0x8d5524,
  0xf1c27d,
  0x6b4226,
  0xd4a373
];

export function pickHumanSkinTone(seed = 0) {
  const idx = Math.abs(Math.imul(seed + 11, 2654435761)) % HUMAN_SKIN_TONES.length;
  return HUMAN_SKIN_TONES[idx];
}

function makeTrapezoidPlane(bottomW, topW, height) {
  const plane = new THREE.PlaneGeometry(1, height);
  const pos = plane.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const halfW = (pos.getY(i) > 0 ? topW : bottomW) * 0.5;
    pos.setX(i, pos.getX(i) > 0 ? halfW : -halfW);
  }
  plane.computeVertexNormals();
  return plane;
}

function buildNpcTorsoDecalGeo() {
  const frontPlane = makeTrapezoidPlane(0.75, 0.9, 0.72);
  frontPlane.translate(0, 0, 0.223);
  const backPlane = makeTrapezoidPlane(0.75, 0.9, 0.72);
  backPlane.rotateY(Math.PI);
  backPlane.translate(0, 0, -0.223);
  return mergeBufferGeometries([frontPlane, backPlane]);
}

function buildCivilianPropGeos() {
  // Acessórios de mão proporcionais à mãozinha em C (r=0.068, origem na palma)
  const bcHandle = new THREE.CylinderGeometry(0.02, 0.02, 0.11, 8);
  bcHandle.rotateX(Math.PI / 2);
  const bcBody = new THREE.BoxGeometry(0.075, 0.23, 0.31);
  bcBody.translate(0, -0.14, 0);
  const briefcaseGeo = mergeBufferGeometries([bcHandle, bcBody]);

  const cupBody = new THREE.CylinderGeometry(0.054, 0.042, 0.14, 12);
  cupBody.translate(0, 0.01, 0.01);
  const cupLid = new THREE.CylinderGeometry(0.06, 0.06, 0.024, 12);
  cupLid.translate(0, 0.088, 0.01);
  const coffeeCupGeo = mergeBufferGeometries([cupBody, cupLid]);

  const camBody = new THREE.BoxGeometry(0.18, 0.12, 0.09);
  camBody.translate(-0.03, 0.01, 0.02);
  const camLens = new THREE.CylinderGeometry(0.045, 0.05, 0.075, 12);
  camLens.rotateX(Math.PI / 2);
  camLens.translate(-0.03, 0.005, 0.085);
  const camTop = new THREE.BoxGeometry(0.06, 0.03, 0.055);
  camTop.translate(0.01, 0.08, 0.015);
  const cameraGeo = mergeBufferGeometries([camBody, camLens, camTop]);

  const smartphoneGeo = new THREE.BoxGeometry(0.075, 0.016, 0.145);
  smartphoneGeo.rotateX(0.32);
  smartphoneGeo.translate(0, 0.01, 0.03);

  const bagHandle = new THREE.TorusGeometry(0.044, 0.013, 6, 12, Math.PI);
  bagHandle.rotateY(Math.PI / 2);
  bagHandle.translate(0, -0.01, 0);
  const bagBody = new THREE.BoxGeometry(0.095, 0.24, 0.21);
  bagBody.translate(0, -0.135, 0);
  const shoppingBagGeo = mergeBufferGeometries([bagHandle, bagBody]);

  // Acessórios de cabeça modelados para abraçar o cilindro r=0.35 centrado em (0, 1.95, 0)
  const hhShell = new THREE.CylinderGeometry(0.34, 0.382, 0.15, 18);
  hhShell.translate(0, 0.22, 0);
  const hhDome = new THREE.SphereGeometry(0.368, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  hhDome.scale(1, 0.52, 1);
  hhDome.translate(0, 0.25, 0);
  const hhRidge = new THREE.BoxGeometry(0.085, 0.055, 0.56);
  hhRidge.translate(0, 0.41, 0.01);
  const hhBrim = new THREE.CylinderGeometry(0.32, 0.335, 0.034, 16);
  hhBrim.translate(0, 0.155, 0.16);
  const hardhatGeo = mergeBufferGeometries([hhShell, hhDome, hhRidge, hhBrim]);

  const makeCap = (dirSign) => {
    const band = new THREE.CylinderGeometry(0.368, 0.368, 0.13, 18);
    band.translate(0, 0.225, 0);
    const dome = new THREE.SphereGeometry(0.368, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    dome.scale(1, 0.48, 1);
    dome.translate(0, 0.245, 0);
    const bill = new THREE.CylinderGeometry(0.295, 0.31, 0.034, 16);
    bill.rotateX(dirSign * 0.06);
    bill.translate(0, 0.165, dirSign * 0.215);
    return mergeBufferGeometries([band, dome, bill]);
  };
  const capForwardGeo = makeCap(1);
  const capBackwardGeo = makeCap(-1);

  const hairCrown = new THREE.SphereGeometry(0.376, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  hairCrown.scale(1.0, 0.56, 1.03);
  hairCrown.translate(0, 0.205, -0.01);
  const hairNape = new THREE.SphereGeometry(0.366, 16, 12);
  hairNape.scale(0.98, 0.74, 0.68);
  hairNape.translate(0, 0.06, -0.13);
  const hairFringe = new THREE.SphereGeometry(0.33, 14, 10);
  hairFringe.scale(0.94, 0.2, 0.52);
  hairFringe.rotateZ(0.08);
  hairFringe.translate(0.02, 0.23, 0.165);
  const classicHairGeo = mergeBufferGeometries([hairCrown, hairNape, hairFringe]);

  const afroBand = new THREE.CylinderGeometry(0.368, 0.374, 0.15, 18);
  afroBand.translate(0, 0.245, -0.01);
  const afroTop = new THREE.SphereGeometry(0.376, 16, 10);
  afroTop.scale(1.01, 0.5, 1.02);
  afroTop.translate(0, 0.285, -0.01);
  const afroBack = new THREE.SphereGeometry(0.362, 14, 10);
  afroBack.scale(0.97, 0.6, 0.65);
  afroBack.translate(0, 0.1, -0.12);
  const curlyFadeGeo = mergeBufferGeometries([afroBand, afroTop, afroBack]);

  const beanieCuff = new THREE.TorusGeometry(0.358, 0.035, 10, 20);
  beanieCuff.rotateX(Math.PI / 2 - 0.08);
  beanieCuff.translate(0, 0.19, -0.01);
  const beanieDome = new THREE.SphereGeometry(0.374, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
  beanieDome.scale(1.0, 0.66, 1.03);
  beanieDome.rotateX(-0.08);
  beanieDome.translate(0, 0.185, -0.02);
  const beanieGeo = mergeBufferGeometries([beanieCuff, beanieDome]);

  const headbandGeo = new THREE.CylinderGeometry(0.362, 0.362, 0.082, 20);
  headbandGeo.translate(0, 0.175, 0);

  const hpArc = new THREE.TorusGeometry(0.384, 0.026, 8, 18, Math.PI);
  hpArc.translate(0, 0.03, 0);
  const hpCupL = new THREE.CylinderGeometry(0.102, 0.102, 0.068, 14);
  hpCupL.rotateZ(Math.PI / 2);
  hpCupL.translate(-0.374, 0.01, 0);
  const hpCupR = new THREE.CylinderGeometry(0.102, 0.102, 0.068, 14);
  hpCupR.rotateZ(Math.PI / 2);
  hpCupR.translate(0.374, 0.01, 0);
  const headphonesGeo = mergeBufferGeometries([hpArc, hpCupL, hpCupR]);

  // Mochila urbana compacta (0.38 x 0.40 x 0.15) encostada nas costas
  const bpMain = new THREE.BoxGeometry(0.38, 0.4, 0.15);
  const bpPocket = new THREE.BoxGeometry(0.28, 0.17, 0.045);
  bpPocket.translate(0, -0.07, -0.095);
  const bpStrapL = new THREE.BoxGeometry(0.055, 0.38, 0.03);
  bpStrapL.translate(-0.12, 0, 0.08);
  const bpStrapR = new THREE.BoxGeometry(0.055, 0.38, 0.03);
  bpStrapR.translate(0.12, 0, 0.08);
  const backpackGeo = mergeBufferGeometries([bpMain, bpPocket, bpStrapL, bpStrapR]);

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
    curly_fade: curlyFadeGeo,
    beanie: beanieGeo,
    headband: headbandGeo,
    headphones: headphonesGeo,
    backpack: backpackGeo
  };
}

export const NPC_HEAD_GEO = createMinifigHeadGeometry();
export const NPC_FACE_SHELL_GEO = createMinifigFaceShellGeometry();
export const NPC_TRAPEZOID_TORSO_GEO = createTrapezoidTorsoGeometry(0.78, 0.94, 0.76, 0.44);
export const NPC_TORSO_DECAL_GEO = buildNpcTorsoDecalGeo();
export const NPC_HIP_GEO = createMinifigHipGeometry();
export const NPC_ARM_GEO = createMinifigArmGeometry(0);
export const NPC_HAND_GEO = createMinifigHandGeometry(0);
export const NPC_LEG_GEO = createMinifigLegGeometry();
export const SHARED_CIV_PROP_GEOS = buildCivilianPropGeos();
export const CAMERA_FLASH_GEO = new THREE.OctahedronGeometry(0.22, 0);
export const SHARED_CAMERA_FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });

// ============================================================================
// EXPRESSÕES FACIAIS HUMANAS COM FUNDO 100% TRANSPARENTE (SOBRE TOM DE PELE)
// ============================================================================
const _civFaceMatCache = new Map();
export function getSharedHumanCivilianFaceMaterial(faceKey = 'civ_calm') {
  if (_civFaceMatCache.has(faceKey)) return _civFaceMatCache.get(faceKey);
  if (typeof document === 'undefined') {
    const fallback = new THREE.MeshStandardMaterial({
      transparent: true,
      alphaTest: 0.06,
      depthWrite: false,
      roughness: 0.38,
      metalness: 0.04
    });
    _civFaceMatCache.set(faceKey, fallback);
    return fallback;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  const isPanic = faceKey === 'civ_panic';
  const hasShades = faceKey === 'civ_shades';
  const hasGlasses = faceKey === 'civ_glasses';
  const hasGoatee = faceKey === 'civ_goatee';
  const hasStubble = faceKey === 'civ_stubble';

  // Barba / cavanhaque sutil antes da boca
  if (hasStubble) {
    ctx.fillStyle = 'rgba(24, 20, 18, 0.24)';
    ctx.beginPath();
    ctx.ellipse(128, 176, 46, 34, 0, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.fill();
  }
  if (hasGoatee) {
    ctx.strokeStyle = '#1c1512';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.roundRect(104, 154, 48, 36, 12);
    ctx.stroke();
  }

  // Sobrancelhas expressivas estilo personagens/operadores
  ctx.strokeStyle = '#181311';
  ctx.lineWidth = 7.5;
  ctx.lineCap = 'round';
  const browTilt = isPanic ? -8 : faceKey === 'civ_serious' ? 5 : faceKey === 'civ_cool' ? -4 : 0;
  ctx.beginPath();
  ctx.moveTo(76, 92 - browTilt);
  ctx.quadraticCurveTo(94, isPanic ? 80 : 86, 112, 91 + browTilt);
  ctx.moveTo(144, 91 + browTilt);
  ctx.quadraticCurveTo(162, isPanic ? 80 : 84, 180, 92 - browTilt);
  ctx.stroke();

  // Olhos humanos de minifig com pupila escura e ponto de brilho branco
  if (!hasShades) {
    for (const ex of [95, 161]) {
      ctx.fillStyle = '#090a0d';
      ctx.beginPath();
      ctx.ellipse(ex, 116, isPanic ? 12 : 10.5, isPanic ? 14 : 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 3.5, 111.5, isPanic ? 3.2 : 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Óculos de grau ou óculos escuros urbanos
  if (hasGlasses) {
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 5;
    ctx.strokeRect(73, 100, 44, 30);
    ctx.strokeRect(139, 100, 44, 30);
    ctx.beginPath();
    ctx.moveTo(117, 112);
    ctx.lineTo(139, 112);
    ctx.stroke();
  } else if (hasShades) {
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(68, 99, 52, 32);
    ctx.fillRect(136, 99, 52, 32);
    ctx.fillRect(118, 104, 20, 7);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.28)';
    ctx.beginPath();
    ctx.moveTo(76, 126);
    ctx.lineTo(94, 103);
    ctx.lineTo(103, 103);
    ctx.lineTo(85, 126);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(144, 126);
    ctx.lineTo(162, 103);
    ctx.lineTo(171, 103);
    ctx.lineTo(153, 126);
    ctx.closePath();
    ctx.fill();
  }

  // Boca limpa e proporcional
  ctx.strokeStyle = '#181311';
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  if (isPanic) {
    ctx.fillStyle = '#181311';
    ctx.beginPath();
    ctx.ellipse(128, 171, 15, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(118, 161, 20, 5);
  } else if (faceKey === 'civ_smile' || faceKey === 'civ_cool') {
    ctx.beginPath();
    ctx.moveTo(108, 165);
    ctx.quadraticCurveTo(128, 177, 149, faceKey === 'civ_cool' ? 161 : 164);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(110, 167);
    ctx.quadraticCurveTo(128, faceKey === 'civ_serious' ? 164 : 170, 146, 167);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.06,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    roughness: 0.38,
    metalness: 0.04
  });
  _civFaceMatCache.set(faceKey, mat);
  return mat;
}

// ============================================================================
// TEXTURAS DE ROUPA URBANA SOMBRIA (PALETA NOIR IDV — ZERO PLÁSTICO ESTOURADO)
// ============================================================================
const _civTorsoMatCache = new Map();
export function getSharedCivilianTorsoMaterial(styleKey = 'casual_denim') {
  if (_civTorsoMatCache.has(styleKey)) return _civTorsoMatCache.get(styleKey);
  if (typeof document === 'undefined') {
    const fallbackMat = new THREE.MeshStandardMaterial({ roughness: 0.58, metalness: 0.06 });
    _civTorsoMatCache.set(styleKey, fallbackMat);
    return fallbackMat;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (styleKey.startsWith('exec_')) {
    const suitBg = styleKey === 'exec_navy' ? '#172542' : styleKey === 'exec_charcoal' ? '#262f3d' : '#11141c';
    const tieColor = styleKey === 'exec_navy' ? '#7f1d1d' : styleKey === 'exec_charcoal' ? '#334155' : '#92400e';
    ctx.fillStyle = suitBg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.lineTo(86, 0);
    ctx.lineTo(64, 76);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = tieColor;
    ctx.beginPath();
    ctx.moveTo(59, 6);
    ctx.lineTo(69, 6);
    ctx.lineTo(67, 66);
    ctx.lineTo(64, 76);
    ctx.lineTo(61, 66);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(38, 0);
    ctx.lineTo(64, 78);
    ctx.lineTo(90, 0);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(80, 40, 16, 4);
  } else if (styleKey.startsWith('tourist_')) {
    const bg = styleKey === 'tourist_aloha' ? '#2c4438' : '#4a252a';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(50, 0, 28, 128);
    ctx.fillStyle = 'rgba(9, 10, 13, 0.28)';
    ctx.fillRect(16, 36, 26, 26);
    ctx.fillRect(86, 36, 26, 26);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(94, 118);
    ctx.stroke();
  } else if (styleKey.startsWith('jogger_')) {
    const bg = styleKey === 'jogger_slate' ? '#1e293b' : styleKey === 'jogger_petrol' ? '#1b384a' : '#3f1d32';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(0, 0, 16, 128);
    ctx.fillRect(112, 0, 16, 128);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 28);
    ctx.lineTo(108, 28);
    ctx.stroke();
  } else if (styleKey.startsWith('beach_')) {
    const bg = styleKey === 'beach_tank' ? '#786b59' : '#1b434d';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 96, 128, 14);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 90, 128, 6);
  } else if (styleKey.startsWith('street_') || styleKey.startsWith('jersey_')) {
    const bg = styleKey.includes('rubro') || styleKey.includes('crimson')
      ? '#4c161b'
      : styleKey.includes('leather')
        ? '#362216'
        : '#18202c';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(28, 80, 72, 34);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(54, 8);
    ctx.lineTo(54, 42);
    ctx.moveTo(74, 8);
    ctx.lineTo(74, 42);
    ctx.stroke();
  } else if (styleKey.startsWith('worker_')) {
    const vestColor = styleKey === 'worker_orange' ? '#9a4615' : '#4b5735';
    ctx.fillStyle = '#162032';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = vestColor;
    ctx.fillRect(10, 0, 42, 128);
    ctx.fillRect(76, 0, 42, 128);
    ctx.fillRect(10, 74, 108, 54);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(16, 12, 14, 104);
    ctx.fillRect(98, 12, 14, 104);
    ctx.fillRect(10, 86, 108, 10);
  } else {
    const jkt = styleKey === 'casual_olive'
      ? '#364232'
      : styleKey === 'casual_burgundy' || styleKey === 'casual_red'
        ? '#4f1b24'
        : styleKey === 'casual_leather'
          ? '#151821'
          : '#1e2c42';
    ctx.fillStyle = jkt;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(52, 0, 24, 128);
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(52, 0);
    ctx.lineTo(52, 128);
    ctx.moveTo(76, 0);
    ctx.lineTo(76, 128);
    ctx.stroke();
    ctx.fillStyle = 'rgba(9, 10, 13, 0.35)';
    ctx.fillRect(16, 78, 26, 28);
    ctx.fillRect(86, 78, 26, 28);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.58,
    metalness: 0.06
  });
  _civTorsoMatCache.set(styleKey, mat);
  return mat;
}

// Catálogo dos 7 Arquétipos Urbanos Sombrios (Paleta Noir IDV, proporções humanas)
export const ARCHETYPE_PRESETS = {
  executive: [
    { torsoKey: 'exec_navy', torsoHex: 0x172542, legHex: 0x0f172a, faceKey: 'civ_serious', headProp: 'classic_hair', headColor: 0x2c1b10, handProp: 'briefcase', handPropColor: 0x291a11, backProp: null, speed: 3.3 },
    { torsoKey: 'exec_charcoal', torsoHex: 0x262f3d, legHex: 0x18202c, faceKey: 'civ_glasses', headProp: 'curly_fade', headColor: 0x14110f, handProp: 'coffee_cup', handPropColor: 0xd6d3d1, backProp: null, speed: 3.45 },
    { torsoKey: 'exec_black', torsoHex: 0x11141c, legHex: 0x090a0d, faceKey: 'civ_goatee', headProp: 'classic_hair', headColor: 0x4a2e1b, handProp: 'briefcase', handPropColor: 0x18181b, backProp: null, speed: 3.35 }
  ],
  tourist: [
    { torsoKey: 'tourist_aloha', torsoHex: 0x2c4438, legHex: 0x575043, faceKey: 'civ_smile', headProp: 'cap_forward', headColor: 0x1e293b, handProp: 'camera', handPropColor: 0x18181b, backProp: 'backpack', backPropColor: 0x44372a, speed: 3.05 },
    { torsoKey: 'tourist_sunset', torsoHex: 0x4a252a, legHex: 0x1e293b, faceKey: 'civ_shades', headProp: 'cap_forward', headColor: 0x27272a, handProp: 'camera', handPropColor: 0x090a0d, backProp: 'backpack', backPropColor: 0x262f3d, speed: 3.1 }
  ],
  jogger: [
    { torsoKey: 'jogger_slate', torsoHex: 0x1e293b, legHex: 0x0f172a, faceKey: 'civ_calm', headProp: 'headband', headColor: 0x475569, handProp: null, handPropColor: 0xffffff, backProp: null, speed: 5.4 },
    { torsoKey: 'jogger_petrol', torsoHex: 0x1b384a, legHex: 0x141923, faceKey: 'civ_cool', headProp: 'cap_forward', headColor: 0x111827, handProp: null, handPropColor: 0xffffff, backProp: null, speed: 5.4 },
    { torsoKey: 'jogger_plum', torsoHex: 0x3f1d32, legHex: 0x11141c, faceKey: 'civ_shades', headProp: 'headphones', headColor: 0x27272a, handProp: null, handPropColor: 0xffffff, backProp: null, speed: 5.4 }
  ],
  beachgoer: [
    { torsoKey: 'beach_floral', torsoHex: 0x1b434d, legHex: 0x475569, faceKey: 'civ_shades', headProp: 'cap_forward', headColor: 0x334155, handProp: 'coffee_cup', handPropColor: 0xcbd5e1, backProp: null, speed: 2.95 },
    { torsoKey: 'beach_tank', torsoHex: 0x786b59, legHex: 0x29352c, bareArms: true, faceKey: 'civ_cool', headProp: 'curly_fade', headColor: 0x1c140f, handProp: null, handPropColor: 0xffffff, backProp: null, speed: 3.05 }
  ],
  street_youth: [
    { torsoKey: 'street_hoodie_graphite', torsoHex: 0x18202c, legHex: 0x111827, faceKey: 'civ_cool', headProp: 'beanie', headColor: 0x18181b, handProp: 'smartphone', handPropColor: 0x334155, backProp: null, speed: 3.4 },
    { torsoKey: 'street_jacket_crimson', torsoHex: 0x4c161b, legHex: 0x090a0d, faceKey: 'civ_shades', headProp: 'headphones', headColor: 0x1f2937, handProp: 'smartphone', handPropColor: 0x1e293b, backProp: 'backpack', backPropColor: 0x14171f, speed: 3.5 },
    { torsoKey: 'street_leather_brown', torsoHex: 0x362216, legHex: 0x1c2533, faceKey: 'civ_stubble', headProp: 'cap_backward', headColor: 0x18202c, handProp: 'smartphone', handPropColor: 0x334155, backProp: null, speed: 3.35 }
  ],
  worker: [
    { torsoKey: 'worker_orange', torsoHex: 0x162032, legHex: 0x1e293b, faceKey: 'civ_stubble', headProp: 'hardhat', headColor: 0xb45309, handProp: 'coffee_cup', handPropColor: 0xd6d3d1, backProp: null, speed: 3.2 },
    { torsoKey: 'worker_olive', torsoHex: 0x262f3d, legHex: 0x1f2421, faceKey: 'civ_serious', headProp: 'hardhat', headColor: 0xd6d3d1, handProp: 'briefcase', handPropColor: 0x334155, backProp: null, speed: 3.25 }
  ],
  casual: [
    { torsoKey: 'casual_denim', torsoHex: 0x1e2c42, legHex: 0x27272a, faceKey: 'civ_calm', headProp: 'classic_hair', headColor: 0x3b2314, handProp: 'shopping_bag', handPropColor: 0x44403c, backProp: null, speed: 3.2 },
    { torsoKey: 'casual_burgundy', torsoHex: 0x4f1b24, legHex: 0x141923, faceKey: 'civ_smile', headProp: 'curly_fade', headColor: 0x14110f, handProp: 'coffee_cup', handPropColor: 0x78553a, backProp: 'backpack', backPropColor: 0x27272a, speed: 3.25 },
    { torsoKey: 'casual_olive', torsoHex: 0x364232, legHex: 0x18202c, faceKey: 'civ_glasses', headProp: 'beanie', headColor: 0x292524, handProp: 'shopping_bag', handPropColor: 0x334155, backProp: null, speed: 3.15 },
    { torsoKey: 'casual_leather', torsoHex: 0x151821, legHex: 0x1f2937, faceKey: 'civ_goatee', headProp: 'classic_hair', headColor: 0x57534e, handProp: null, handPropColor: 0x1f2937, backProp: null, speed: 3.3 }
  ]
};

export const pedestrianArchetypeMethods = {
  _pickArchetypeForCoords(x, z, seed = 0) {
    const r = Math.abs(Math.sin(seed * 12.9898 + x * 0.031 + z * 0.017) * 43758.5453) % 1;
    if (z > 610) {
      if (r < 0.48) return 'beachgoer';
      if (r < 0.76) return 'tourist';
      return 'jogger';
    }
    if (x > 510 || x < -820) {
      if (r < 0.58) return 'worker';
      if (r < 0.84) return 'street_youth';
      return 'executive';
    }
    if (x < -450 && z > -430 && z < 430) {
      return r < 0.72 ? 'street_youth' : 'casual';
    }
    if (x > -80 && x < 340 && z > 12 && z < 395) {
      if (r < 0.46) return 'jogger';
      if (r < 0.76) return 'tourist';
      return 'casual';
    }
    if (z < -410) {
      if (r < 0.44) return 'casual';
      if (r < 0.78) return 'street_youth';
      return 'jogger';
    }
    if ((x < -130 && z > -155 && z < 80) || (Math.abs(x) < 130 && z > -55 && z <= 18)) {
      if (r < 0.52) return 'tourist';
      if (r < 0.78) return 'executive';
      return 'casual';
    }
    if (r < 0.56) return 'executive';
    if (r < 0.8) return 'tourist';
    return 'casual';
  }
};
