import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick,
  getSharedNpcFaceMaterial
} from '../materials/LegoMaterials.js';
import { mergeBufferGeometries } from './BuildingGenerator.js';
import { VEHICLE_SPECS, createLegoCarMesh } from './VehicleFleetBuilder.js';
import { getMetroCutoutFloorY } from './MetroSystemBuilder.js';
import { FactionWarSystem, getTerritoryZoneAt } from './FactionWarSystem.js';
import { WantedPursuitSystem } from './WantedPursuitSystem.js';
import { ensureVehicleNightLights } from './DayNightAtmosphereManager.js';
import { soundFX } from '../audio/SoundFX.js';

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

const NPC_HEAD_GEO = buildNpcDetailedHeadGeo();
const NPC_FACE_SHELL_GEO = new THREE.CylinderGeometry(
  0.326,
  0.326,
  0.38,
  18,
  1,
  true,
  -Math.PI * 0.45,
  Math.PI * 0.9
);
const NPC_TRAPEZOID_TORSO_GEO = buildNpcTrapezoidTorsoGeo();
const NPC_TORSO_DECAL_GEO = buildNpcTorsoDecalGeo();
const NPC_HIP_GEO = buildNpcHipGeo();
const NPC_ARM_GEO = buildNpcDetailedArmGeo();
const NPC_LEG_GEO = buildNpcDetailedLegGeo();
const SHARED_CIV_PROP_GEOS = buildCivilianPropGeos();
const CAMERA_FLASH_GEO = new THREE.OctahedronGeometry(0.34, 0);
const SHARED_CAMERA_FLASH_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
const SHARED_BRAKE_LIGHT_OFF_MAT = new THREE.MeshBasicMaterial({ color: 0x450a0a });
const SHARED_BRAKE_LIGHT_ON_MAT = new THREE.MeshBasicMaterial({ color: 0xff1e1e });

// ============================================================================
// TEXTURAS DE TORSO LEGO POR ARQUÉTIPO DE BAIRRO (CACHE GLOBAL)
// ============================================================================
const _civTorsoMatCache = new Map();
function getSharedCivilianTorsoMaterial(styleKey = 'casual_blue') {
  if (_civTorsoMatCache.has(styleKey)) {
    return _civTorsoMatCache.get(styleKey);
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (styleKey.startsWith('exec_')) {
    // Terno Executivo (Azul-Marinho, Grafite ou Preto) + Camisa Branca em V + Gravata + Lenço no Bolso
    const suitBg =
      styleKey === 'exec_navy' ? '#1e3a8a' : styleKey === 'exec_charcoal' ? '#334155' : '#111827';
    const tieColor = styleKey === 'exec_navy' ? '#dc2626' : styleKey === 'exec_charcoal' ? '#2563eb' : '#facc15';
    ctx.fillStyle = suitBg;
    ctx.fillRect(0, 0, 128, 128);
    // Camisa social branca
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(88, 0);
    ctx.lineTo(64, 78);
    ctx.closePath();
    ctx.fill();
    // Gravata
    ctx.fillStyle = tieColor;
    ctx.beginPath();
    ctx.moveTo(58, 6);
    ctx.lineTo(70, 6);
    ctx.lineTo(68, 68);
    ctx.lineTo(64, 78);
    ctx.lineTo(60, 68);
    ctx.closePath();
    ctx.fill();
    // Lapelas e bolso com lenço
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(36, 0);
    ctx.lineTo(64, 80);
    ctx.lineTo(92, 0);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(82, 42, 18, 6);
    // Botões do paletó
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(64, 92, 4, 0, Math.PI * 2);
    ctx.arc(64, 108, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (styleKey.startsWith('tourist_')) {
    // Camisa Estampada Tropical / Havaiana Vibrante + Alça de Câmera
    const bg = styleKey === 'tourist_aloha' ? '#06b6d4' : '#f97316';
    const accent = styleKey === 'tourist_aloha' ? '#fde047' : '#fef08a';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    // Camiseta branca interna
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 0, 28, 128);
    // Flores/Folhas tropicais estilizadas LEGO
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
    // Alça preta de câmera cruzada
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(94, 118);
    ctx.stroke();
  } else if (styleKey.startsWith('jogger_')) {
    // Regata / Agasalho Esportivo Neon com Faixas de Corrida e Número de Maratona
    const bg =
      styleKey === 'jogger_lime' ? '#84cc16' : styleKey === 'jogger_cyan' ? '#0ea5e9' : '#ec4899';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 18, 128);
    ctx.fillRect(110, 0, 18, 128);
    // Gola olímpica
    ctx.beginPath();
    ctx.arc(64, 4, 24, 0, Math.PI);
    ctx.fill();
    // Número de corrida branco no peito
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(36, 44, 56, 38);
    ctx.fillStyle = '#090a0d';
    ctx.fillRect(46, 54, 8, 18);
    ctx.fillRect(62, 54, 18, 18);
  } else if (styleKey.startsWith('beach_')) {
    // Visual Praiano: Regata Solar ou Camisa Floral de Verão
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
    // Camisas de Time Urbanas (Amarela/Verde Seleção, Rubro-Negra, Azul/Branca)
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
    // Operário / Engenheiro (Porto & Aeroporto): Colete Refletivo Laranja ou Verde-Limão com Faixas Prateadas
    const vestColor = styleKey === 'worker_orange' ? '#f97316' : '#84cc16';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = vestColor;
    ctx.fillRect(8, 0, 44, 128);
    ctx.fillRect(76, 0, 44, 128);
    ctx.fillRect(8, 72, 112, 56);
    // Faixas refletivas prateadas/amarelas em H
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(14, 12, 18, 104);
    ctx.fillRect(96, 12, 18, 104);
    ctx.fillRect(8, 82, 112, 14);
    ctx.fillRect(8, 106, 112, 12);
  } else {
    // Moletom / Jaqueta Casual Urbana LEGO
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
const ARCHETYPE_PRESETS = {
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

/**
 * GERENCIADOR DE VIDA URBANA SOLAR & PACÍFICA — ESTILO LEGO MARVEL SUPER HEROES (MANHATTAN FREE ROAM):
 * 1) Zero Guerra Mundial / Zero Tiroteios: Cidade 100% pacífica, carismática, ensolarada e leve (60 FPS)!
 * 2) Bolha Dinâmica de Multidão ("Dynamic Crowd Ring"): Pool reciclável de 160 Civis LEGO com 8 arquétipos por bairro e grupos de conversa!
 * 3) 4 Reações Dinâmicas Estilo LEGO Marvel: NORMAL, CHEER (aplausos, pulinhos e flash 3D de foto!), VILLAIN_SPOOK (Vórtex OP-08) e PANIC cômico!
 * 4) Trânsito Vivo Estilo Manhattan (~72 Veículos: Ônibus LEGO, Táxis Amarelos, Sedans, Esportivos, Buggies e Patrulhas Pacíficas), Luz de Freio, Buzinas, Helicóptero Civil de TV e Carrinhos de Lanche Destrutíveis!
 */
export class LivingCityManager {
  constructor(world, destructibles, hud) {
    this.world = world;
    this.scene = world.scene;
    this.destructibles = destructibles;
    this.hud = hud;

    // Arrays limpos (Zero soldados armados, zero zonas de guerra, zero projéteis inimigos!)
    this.trafficVehicles = [];
    this.pedestrians = [];
    this.combatNpcs = [];
    this.npcProjectiles = [];
    this.activeWarzones = [];
    this.pccHeli = null;
    this.armoredConvoy = null;
    this.activeBosses = [];
    this.healStations = [];
    this.healthCrystals = [];

    // Facção Aliada do Jogador ('cv' | 'pcc' | 'ares') — Cidade Civil 100% Pacífica; Guerra 1x1 apenas nos 3 Territórios!
    this.playerFaction = 'cv';
    this.playerMaxHp = 250;
    this.playerHp = 250;

    this.caveiraSupportCooldown = 0;
    this.caveiraCallToggle = 0;
    this._sirenPhase = 0;
    this._crowdRingTimer = 0.6;
    this._wasPlayerAirborne = false;
    this._heroLandingCheerTimer = 0;
    this._heroLandingPos = new THREE.Vector3();

    this.civilianSkyHeli = null;

    this._buildingGrid = new Map();
    this._buildingGridCellSize = 48;
    this._initBuildingSpatialGrid();

    this._initUrbanTraffic();
    this._initPedestrians();
    this._initCivilianSkyHelicopter();
    this._initStreetVendorCarts();

    // Sistema de Guerra Territorial de Invasão (1x1 apenas dentro do Território Invadido!)
    this.factionWar = new FactionWarSystem(this);

    // Sistema de Procurado Escalável Estilo GTA (0 a 5 Estrelas) + Fuga Tática!
    this.wantedSystem = new WantedPursuitSystem(this);
  }

  resetTerritories() {
    if (this.factionWar) {
      this.factionWar.resetConqueredTerritories();
    }
  }

  // ============================================================================
  // GRADE ESPACIAL 2D O(1) DE PRÉDIOS E MUROS (CÉLULAS 48m x 48m)
  // ============================================================================
  _initBuildingSpatialGrid() {
    this._buildingGrid.clear();
    const cs = this._buildingGridCellSize;
    const boxes = [];

    if (this.world?.mapBuildings) {
      for (const bld of this.world.mapBuildings) {
        const hw = (bld.w || 0) * 0.5;
        const hd = (bld.d || 0) * 0.5;
        if (hw < 1.5 || hd < 1.5) continue;
        // O interior térreo do Super Banco Central é aberto, e Estações Elevadas / Mirante não bloqueiam o térreo!
        if (Math.abs(bld.x) < 56 && bld.z > -230 && bld.z < -128) continue;
        if (bld.label && (bld.label.startsWith('METRÔ') || bld.label.startsWith('MIRANTE'))) continue;
        boxes.push({
          minX: bld.x - hw,
          maxX: bld.x + hw,
          minZ: bld.z - hd,
          maxZ: bld.z + hd
        });
      }
    }

    if (this.world?.colliders) {
      for (const col of this.world.colliders) {
        const minY = col.minY ?? 0;
        const h = col.maxY - minY;
        const w = col.maxX - col.minX;
        const d = col.maxZ - col.minZ;
        if (col.disabled || h < 2.8 || minY >= 3.2 || (w < 2.2 && d < 2.2)) continue;
        boxes.push({
          minX: col.minX,
          maxX: col.maxX,
          minZ: col.minZ,
          maxZ: col.maxZ
        });
      }
    }

    for (const box of boxes) {
      const gx0 = Math.floor((box.minX - 3.0) / cs);
      const gx1 = Math.floor((box.maxX + 3.0) / cs);
      const gz0 = Math.floor((box.minZ - 3.0) / cs);
      const gz1 = Math.floor((box.maxZ + 3.0) / cs);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = `${gx},${gz}`;
          let cell = this._buildingGrid.get(key);
          if (!cell) {
            cell = [];
            this._buildingGrid.set(key, cell);
          }
          cell.push(box);
        }
      }
    }
  }

  _isInsideBuilding(x, z, padding = 0.9) {
    if (!this._buildingGrid) this._initBuildingSpatialGrid();
    const cs = this._buildingGridCellSize || 48;
    const gx = Math.floor(x / cs);
    const gz = Math.floor(z / cs);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cell = this._buildingGrid.get(`${gx + dx},${gz + dz}`);
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const box = cell[i];
          if (
            x > box.minX - padding &&
            x < box.maxX + padding &&
            z > box.minZ - padding &&
            z < box.maxZ + padding
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  _resolveBuildingCollision(x, z, radius = 0.95) {
    if (!this._buildingGrid) this._initBuildingSpatialGrid();
    let curX = x;
    let curZ = z;
    let collided = false;
    const cs = this._buildingGridCellSize || 48;
    const gx = Math.floor(curX / cs);
    const gz = Math.floor(curZ / cs);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cell = this._buildingGrid.get(`${gx + dx},${gz + dz}`);
        if (!cell || cell.length === 0) continue;

        for (let i = 0; i < cell.length; i++) {
          const box = cell[i];
          const padMinX = box.minX - radius;
          const padMaxX = box.maxX + radius;
          const padMinZ = box.minZ - radius;
          const padMaxZ = box.maxZ + radius;
          if (curX > padMinX && curX < padMaxX && curZ > padMinZ && curZ < padMaxZ) {
            const dLeft = Math.abs(curX - padMinX);
            const dRight = Math.abs(padMaxX - curX);
            const dBack = Math.abs(curZ - padMinZ);
            const dFront = Math.abs(curZ - padMaxZ);
            const minD = Math.min(dLeft, dRight, dBack, dFront);
            if (minD === dLeft) curX = padMinX - 0.08;
            else if (minD === dRight) curX = padMaxX + 0.08;
            else if (minD === dBack) curZ = padMinZ - 0.08;
            else curZ = padMaxZ + 0.08;
            collided = true;
          }
        }
      }
    }

    return { x: curX, z: curZ, collided };
  }

  _isValidDryLandForPedestrian(x, z) {
    // Limites seguros da Grande Ilha Metropolitana + Praia + Porto + Aeroporto (e fora das bocas subterrâneas do Metrô!)
    if (x < -1420 || x > 1180 || z < -1180 || z > 885) return false;
    if (getMetroCutoutFloorY(x, z) !== null) return false;
    if (this.world?.isDeepWaterAt && this.world.isDeepWaterAt(x, z)) return false;
    return true;
  }

  _findSafeStreetSpawn(x, z, radius = 1.9) {
    const res = this._resolveBuildingCollision(x, z, radius);
    if (
      !this._isInsideBuilding(res.x, res.z, radius * 0.85) &&
      this._isValidDryLandForPedestrian(res.x, res.z)
    ) {
      return { x: res.x, z: res.z, valid: true };
    }
    for (let ring = 1; ring <= 6; ring++) {
      const dist = ring * 6.0;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const tx = x + Math.cos(ang) * dist;
        const tz = z + Math.sin(ang) * dist;
        if (!this._isValidDryLandForPedestrian(tx, tz)) continue;
        const cand = this._resolveBuildingCollision(tx, tz, radius);
        if (
          !this._isInsideBuilding(cand.x, cand.z, radius * 0.85) &&
          this._isValidDryLandForPedestrian(cand.x, cand.z)
        ) {
          return { x: cand.x, z: cand.z, valid: true };
        }
      }
    }
    return { x: res.x, z: res.z, valid: false };
  }

  /**
   * Mantido para compatibilidade total com Saves e LegoHud (sem spawnar tropas de guerra)
   */
  setPlayerFaction(factionKey = 'free_roam', controller = null, savedConquests = null) {
    this.playerFaction = factionKey || 'free_roam';
    this.playerHp = this.playerMaxHp;
    if (this.hud) {
      this.hud.setPlayerFaction(this.playerFaction, false);
      this.hud.setPlayerHealth(this.playerMaxHp, this.playerMaxHp, false);
    }
    // Repassa a facção escolhida (e as conquistas salvas) para a Guerra de Territórios
    if (this.factionWar) {
      this.factionWar.setPlayerFaction(factionKey, controller, savedConquests);
    }
  }

  // ============================================================================
  // 1. FROTA DE TRÂNSITO VIVO ESTILO MANHATTAN (~72 VEÍCULOS PACÍFICOS + LUZ DE FREIO + BUZINA!)
  // ============================================================================
  _initUrbanTraffic() {
    const YEL = LEGO_COLORS.yellow;
    const WHT = LEGO_COLORS.white;
    const BLK = LEGO_COLORS.black;

    const trafficSpecs = [
      // 1. Avenida Central em frente ao Super Banco Central (Z = -117 — Limpa, movimentada e cheia de Táxis e Ônibus!)
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -410, dir: 1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0xfacc15, roofColor: 0x2563eb, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -265, dir: 1, minC: -495, maxC: 515 },
      { type: 'apex_gtx', color: 0xdc2626, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -130, dir: 1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -32, dir: 1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0x2563eb, roofColor: WHT, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 65, dir: 1, minC: -495, maxC: 515 },
      { type: 'carro_forte', color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 185, dir: 1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 340, dir: 1, minC: -495, maxC: 515 },

      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 410, dir: -1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0xdc2626, roofColor: WHT, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 255, dir: -1, minC: -495, maxC: 515 },
      { type: 'vortex_roadster', color: 0xec4899, roofColor: WHT, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 115, dir: -1, minC: -495, maxC: 515 },
      { type: 'interceptor_v8', color: BLK, roofColor: WHT, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 15, dir: -1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -88, dir: -1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0x16a34a, roofColor: WHT, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -220, dir: -1, minC: -495, maxC: 515 },
      { type: 'trovao_v8', color: 0xf97316, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -365, dir: -1, minC: -495, maxC: 515 },

      // 2. Avenida Times Square / Parque Central (Z = 0)
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: -340, dir: 1, minC: -495, maxC: 515 },
      { type: 'vortex_roadster', color: 0x06b6d4, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: -180, dir: 1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0x2563eb, roofColor: WHT, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: -25, dir: 1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: 135, dir: 1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0xe11d48, roofColor: WHT, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: 310, dir: 1, minC: -495, maxC: 515 },

      { type: 'cyber_blade', color: 0x06b6d4, roofColor: 0x090a0d, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: 360, dir: -1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: 195, dir: -1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0xf59e0b, roofColor: WHT, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: 55, dir: -1, minC: -495, maxC: 515 },
      { type: 'apex_gtx', color: 0xfacc15, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: -95, dir: -1, minC: -495, maxC: 515 },
      { type: 'moto_policia', color: 0x111827, roofColor: WHT, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: -270, dir: -1, minC: -495, maxC: 515 },

      // 3. Avenidas Leste-Oeste Norte do Banco (Z = -252) & Sul do Parque (Z = 384)
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -252, laneOffset: 5.2, posAlong: -290, dir: 1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0x3b82f6, roofColor: WHT, axis: 'z_const', roadCoord: -252, laneOffset: 5.2, posAlong: -40, dir: 1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0xfacc15, roofColor: 0x16a34a, axis: 'z_const', roadCoord: -252, laneOffset: 5.2, posAlong: 220, dir: 1, minC: -495, maxC: 515 },
      { type: 'trovao_v8', color: 0xdc2626, roofColor: WHT, axis: 'z_const', roadCoord: -252, laneOffset: -5.2, posAlong: 280, dir: -1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -252, laneOffset: -5.2, posAlong: 20, dir: -1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0x8b5cf6, roofColor: WHT, axis: 'z_const', roadCoord: -252, laneOffset: -5.2, posAlong: -210, dir: -1, minC: -495, maxC: 515 },

      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: 384, laneOffset: 5.2, posAlong: -280, dir: 1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0x16a34a, roofColor: WHT, axis: 'z_const', roadCoord: 384, laneOffset: 5.2, posAlong: 35, dir: 1, minC: -495, maxC: 515 },
      { type: 'vortex_roadster', color: 0xf97316, roofColor: BLK, axis: 'z_const', roadCoord: 384, laneOffset: 5.2, posAlong: 290, dir: 1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0xdc2626, roofColor: WHT, axis: 'z_const', roadCoord: 384, laneOffset: -5.2, posAlong: 210, dir: -1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: 384, laneOffset: -5.2, posAlong: -85, dir: -1, minC: -495, maxC: 515 },

      // 4. Avenida Norte-Sul Oeste do Banco (X = -120)
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: -460, dir: 1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0x0284c7, roofColor: WHT, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: -220, dir: 1, minC: -680, maxC: 680 },
      { type: 'onibus_urbano', color: 0xfacc15, roofColor: 0x2563eb, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: 10, dir: 1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: 260, dir: 1, minC: -680, maxC: 680 },
      { type: 'apex_gtx', color: 0x2563eb, roofColor: WHT, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: 490, dir: 1, minC: -680, maxC: 680 },

      { type: 'interceptor_v8', color: BLK, roofColor: WHT, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: 430, dir: -1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: 185, dir: -1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0xe11d48, roofColor: WHT, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: -65, dir: -1, minC: -680, maxC: 680 },
      { type: 'trovao_v8', color: 0x16a34a, roofColor: BLK, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: -310, dir: -1, minC: -680, maxC: 680 },

      // 5. Avenida Norte-Sul Leste do Banco (X = 120)
      { type: 'carro_forte', color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: -380, dir: 1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: -140, dir: 1, minC: -680, maxC: 680 },
      { type: 'vortex_roadster', color: 0x2563eb, roofColor: WHT, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: 95, dir: 1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0xf97316, roofColor: WHT, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: 340, dir: 1, minC: -680, maxC: 680 },

      { type: 'onibus_urbano', color: 0x2563eb, roofColor: WHT, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: 410, dir: -1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: 160, dir: -1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0xf59e0b, roofColor: WHT, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: -90, dir: -1, minC: -680, maxC: 680 },
      { type: 'cyber_blade', color: 0xec4899, roofColor: BLK, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: -350, dir: -1, minC: -680, maxC: 680 },

      // 6. Avenida da Torre dos Heróis (X = -252) & Avenida do Parque Leste (X = 252)
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: -252, laneOffset: -5.2, posAlong: -260, dir: 1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0x10b981, roofColor: WHT, axis: 'x_const', roadCoord: -252, laneOffset: -5.2, posAlong: 120, dir: 1, minC: -680, maxC: 680 },
      { type: 'trovao_v8', color: 0xeab308, roofColor: BLK, axis: 'x_const', roadCoord: -252, laneOffset: 5.2, posAlong: 210, dir: -1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: -252, laneOffset: 5.2, posAlong: -180, dir: -1, minC: -680, maxC: 680 },

      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: 252, laneOffset: -5.2, posAlong: -240, dir: 1, minC: -680, maxC: 680 },
      { type: 'apex_gtx', color: 0x06b6d4, roofColor: BLK, axis: 'x_const', roadCoord: 252, laneOffset: -5.2, posAlong: 150, dir: 1, minC: -680, maxC: 680 },
      { type: 'onibus_urbano', color: 0xfacc15, roofColor: 0xdc2626, axis: 'x_const', roadCoord: 252, laneOffset: 5.2, posAlong: 260, dir: -1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0x6366f1, roofColor: WHT, axis: 'x_const', roadCoord: 252, laneOffset: 5.2, posAlong: -130, dir: -1, minC: -680, maxC: 680 },

      // 7. Via Expressa Oeste (X = -516) & Avenida Leste / Porto (X = 612)
      { type: 'onibus_urbano', color: 0x2563eb, roofColor: 0xfacc15, axis: 'x_const', roadCoord: -516, laneOffset: -5.2, posAlong: -260, dir: 1, minC: -620, maxC: 520 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: -516, laneOffset: -5.2, posAlong: 90, dir: 1, minC: -620, maxC: 520 },
      { type: 'sedan_familiar', color: 0xdc2626, roofColor: WHT, axis: 'x_const', roadCoord: -516, laneOffset: 5.2, posAlong: 190, dir: -1, minC: -620, maxC: 520 },
      { type: 'interceptor_v8', color: BLK, roofColor: WHT, axis: 'x_const', roadCoord: 612, laneOffset: -5.2, posAlong: -240, dir: 1, minC: -580, maxC: 480 },
      { type: 'carro_forte', color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, axis: 'x_const', roadCoord: 612, laneOffset: 5.2, posAlong: 160, dir: -1, minC: -580, maxC: 480 },

      // 8. Avenida Beira-Mar Sul (Z = 710 — Buggies de Praia, Conversíveis e Táxis!)
      { type: 'buggy_praia', color: 0xf97316, roofColor: 0x84cc16, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: -360, dir: 1, minC: -520, maxC: 520 },
      { type: 'vortex_roadster', color: 0xec4899, roofColor: WHT, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: -110, dir: 1, minC: -520, maxC: 520 },
      { type: 'buggy_praia', color: 0x06b6d4, roofColor: 0xfacc15, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: 140, dir: 1, minC: -520, maxC: 520 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: 710, laneOffset: -5.2, posAlong: 310, dir: -1, minC: -520, maxC: 520 },
      { type: 'buggy_praia', color: 0x22c55e, roofColor: 0xf97316, axis: 'z_const', roadCoord: 710, laneOffset: -5.2, posAlong: 40, dir: -1, minC: -520, maxC: 520 },
      { type: 'cyber_blade', color: 0x38bdf8, roofColor: BLK, axis: 'z_const', roadCoord: 710, laneOffset: -5.2, posAlong: -230, dir: -1, minC: -520, maxC: 520 },

      // 9. Subúrbio Norte (Z = -512) & Ladeiras Norte-Sul até o Platô Costeiro (+11.5m)
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -512, laneOffset: 5.2, posAlong: -280, dir: 1, minC: -490, maxC: 490 },
      { type: 'sedan_familiar', color: 0x2563eb, roofColor: WHT, axis: 'z_const', roadCoord: -512, laneOffset: 5.2, posAlong: 85, dir: 1, minC: -490, maxC: 490 },
      { type: 'onibus_urbano', color: 0xfacc15, roofColor: 0x2563eb, axis: 'z_const', roadCoord: -512, laneOffset: -5.2, posAlong: 220, dir: -1, minC: -490, maxC: 490 },
      { type: 'sedan_familiar', color: 0x16a34a, roofColor: WHT, axis: 'z_const', roadCoord: -512, laneOffset: -5.2, posAlong: -140, dir: -1, minC: -490, maxC: 490 },

      // 10. REDE DOS 3 GRANDES VIADUTOS EXPRESSOS LEGO (Circulação Multi-Nível em Y = +12.4m / +10.2m / +9.2m!)
      // Viaduto 01 — Elevado Leste-Oeste (Z = -382, X = -465..+465, Y = +12.4m)
      { type: 'apex_gtx', color: 0xef4444, roofColor: BLK, axis: 'z_const', roadCoord: -382, laneOffset: 3.8, posAlong: -310, dir: 1, minC: -495, maxC: 505, startY: 12.4 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -382, laneOffset: 3.8, posAlong: -65, dir: 1, minC: -495, maxC: 505, startY: 12.4 },
      { type: 'onibus_urbano', color: 0x2563eb, roofColor: WHT, axis: 'z_const', roadCoord: -382, laneOffset: 3.8, posAlong: 185, dir: 1, minC: -495, maxC: 505, startY: 12.4 },
      { type: 'vortex_roadster', color: 0x06b6d4, roofColor: WHT, axis: 'z_const', roadCoord: -382, laneOffset: -3.8, posAlong: 315, dir: -1, minC: -495, maxC: 505, startY: 12.4 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: -382, laneOffset: -3.8, posAlong: 40, dir: -1, minC: -495, maxC: 505, startY: 12.4 },
      { type: 'interceptor_v8', color: BLK, roofColor: WHT, axis: 'z_const', roadCoord: -382, laneOffset: -3.8, posAlong: -225, dir: -1, minC: -495, maxC: 505, startY: 12.4 },

      // Viaduto 02 — Panorâmico Norte-Sul sobre o Grande Lago (X = +252, Z = -84..+520, Y = +10.2m)
      { type: 'vortex_roadster', color: 0xfacc15, roofColor: BLK, axis: 'x_const', roadCoord: 252, laneOffset: -3.8, posAlong: 55, dir: 1, minC: -102, maxC: 542, startY: 10.2 },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'x_const', roadCoord: 252, laneOffset: -3.8, posAlong: 295, dir: 1, minC: -102, maxC: 542, startY: 10.2 },
      { type: 'cyber_blade', color: 0xec4899, roofColor: BLK, axis: 'x_const', roadCoord: 252, laneOffset: 3.8, posAlong: 390, dir: -1, minC: -102, maxC: 542, startY: 10.2 },
      { type: 'sedan_familiar', color: 0x10b981, roofColor: WHT, axis: 'x_const', roadCoord: 252, laneOffset: 3.8, posAlong: 135, dir: -1, minC: -102, maxC: 542, startY: 10.2 },

      // Viaduto 03 — Expresso Oeste Aeroporto <-> Centro / CDD (Z = 0, X = -1036..-466, Y = +9.2m)
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: 0, laneOffset: 3.8, posAlong: -880, dir: 1, minC: -1048, maxC: -446, startY: 9.2, wrapY: 0.28 },
      { type: 'onibus_urbano', color: 0xfacc15, roofColor: 0x2563eb, axis: 'z_const', roadCoord: 0, laneOffset: 3.8, posAlong: -620, dir: 1, minC: -1048, maxC: -446, startY: 9.2, wrapY: 0.28 },
      { type: 'apex_gtx', color: 0x38bdf8, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: -3.8, posAlong: -560, dir: -1, minC: -1048, maxC: -446, startY: 9.2, wrapY: 0 },
      { type: 'interceptor_v8', color: BLK, roofColor: WHT, axis: 'z_const', roadCoord: 0, laneOffset: -3.8, posAlong: -810, dir: -1, minC: -1048, maxC: -446, startY: 9.2, wrapY: 0 }
    ];

    for (const cfg of trafficSpecs) {
      this._spawnTrafficVehicle(cfg);
    }
  }

  _spawnTrafficVehicle(cfg) {
    const spec = VEHICLE_SPECS[cfg.type] || VEHICLE_SPECS.sedan_familiar;
    const x = cfg.axis === 'z_const' ? cfg.posAlong : cfg.roadCoord + cfg.laneOffset;
    const z = cfg.axis === 'z_const' ? cfg.roadCoord + cfg.laneOffset : cfg.posAlong;
    const rotY =
      cfg.axis === 'z_const'
        ? cfg.dir > 0
          ? Math.PI / 2
          : -Math.PI / 2
        : cfg.dir > 0
          ? 0
          : Math.PI;
    const refStartY = cfg.startY ?? 0;
    const yBase = this.world.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(x, z, refStartY)
      : (this.world.getRoadElevation ? this.world.getRoadElevation(x, z) : 0);

    const carGroup = createLegoCarMesh({
      x,
      z,
      rotY,
      color: cfg.color,
      roofColor: cfg.roofColor,
      type: cfg.type
    });
    carGroup.position.set(x, yBase, z);
    carGroup.rotation.y = rotY;
    carGroup.userData.carType = cfg.type;
    carGroup.userData.carName = spec.name;
    carGroup.userData.vehicleSpec = spec;
    carGroup.userData.isTrafficVehicle = true;
    this.scene.add(carGroup);

    const isPoliceVehicle = ['caveirao_bope', 'interceptor_v8', 'choque_pickup', 'moto_policia'].includes(cfg.type);
    const isBus = cfg.type === 'onibus_urbano';
    const isMoto = Boolean(spec.isMotorcycle);

    const baseW = isMoto ? 1.45 : isBus ? 2.85 : 2.5;
    const baseD = isMoto ? 3.8 : isBus ? 8.5 : 5.0;
    const baseH = isBus ? 2.75 : 2.1;

    // 2 Luzes de Freio Traseiras Vermelhas Brilhantes (Acendem quando freado no trânsito!)
    const brakeLights = [];
    if (!isMoto) {
      const rearZ = -baseD * 0.5 - 0.05;
      const lxOff = baseW * 0.34;
      for (const lx of [-lxOff, lxOff]) {
        const blMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.2, 0.08),
          SHARED_BRAKE_LIGHT_OFF_MAT
        );
        blMesh.position.set(lx, 0.82, rearZ);
        carGroup.add(blMesh);
        brakeLights.push(blMesh);
      }
    }

    const isRotated90 = Math.abs(Math.sin(rotY)) > 0.7;
    const carWidth = isRotated90 ? baseD : baseW;
    const carDepth = isRotated90 ? baseW : baseD;

    const col1 = this.world.addCollider(x, z, carWidth, carDepth, yBase + 1.35, yBase);
    const col2 = this.world.addCollider(x, z, carWidth * 0.88, carDepth * 0.72, yBase + baseH, yBase);

    let destructibleEntry = null;
    if (this.destructibles) {
      this.destructibles.registerDestructible({
        mesh: carGroup,
        type: 'car',
        hp: spec.hp,
        radius: Math.max(carWidth, carDepth) * 0.52,
        height: baseH,
        colliders: [col1, col2],
        debrisColors: [cfg.color, cfg.roofColor, LEGO_COLORS.black, LEGO_COLORS.yellow],
        studDrops: spec.studDrops,
        groundY: yBase
      });
      destructibleEntry = this.destructibles.objects[this.destructibles.objects.length - 1];
    }

    const cruiseSpeed = isBus
      ? 14.5
      : Math.min(20.5, Math.max(14.0, (spec.kmh || 160) * 0.082));
    const tvEntry = {
      cfg,
      spec,
      faction: 'civilian',
      isPoliceVehicle,
      brakeLights,
      nightLightRig: ensureVehicleNightLights(carGroup, spec),
      isBraking: false,
      mesh: carGroup,
      destructible: destructibleEntry,
      col1,
      col2,
      baseW,
      baseD,
      baseH,
      axis: cfg.axis,
      roadCoord: cfg.roadCoord,
      laneOffset: cfg.laneOffset,
      baseLaneOffset: cfg.laneOffset,
      targetLaneOffset: cfg.laneOffset,
      posAlong: cfg.posAlong,
      dir: cfg.dir,
      minC: cfg.minC,
      maxC: cfg.maxC,
      cruiseSpeed,
      currentSpeed: cruiseSpeed,
      stuckTimer: 0,
      surroundedTimer: 0,
      respawnFadeTimer: 0,
      abandonedTimer: 0,
      panicTimer: 0,
      hornCooldown: 0,
      hijackedByPlayer: false
    };
    this.trafficVehicles.push(tvEntry);
    return tvEntry;
  }

  _relocateStuckTrafficVehicle(tv, playerPos = null) {
    if (!tv || !tv.destructible || tv.destructible.destroyed) return false;
    const obj = tv.destructible;
    const span = Math.max(60, (tv.maxC - 25) - (tv.minC + 25));

    let chosenPosAlong = tv.dir > 0 ? tv.minC + 25 : tv.maxC - 25;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidatePosAlong = tv.minC + 25 + ((attempt + 0.5) / 12) * span;
      const cx = tv.axis === 'z_const' ? candidatePosAlong : tv.roadCoord + tv.baseLaneOffset;
      const cz = tv.axis === 'z_const' ? tv.roadCoord + tv.baseLaneOffset : candidatePosAlong;

      if (playerPos && Math.hypot(cx - playerPos.x, cz - playerPos.z) < 65.0) {
        continue;
      }

      let laneFree = true;
      for (const other of this.trafficVehicles) {
        if (other === tv || !other.destructible || other.destructible.destroyed) continue;
        if (other.axis !== tv.axis || Math.abs(other.roadCoord - tv.roadCoord) > 4.0) continue;
        if (
          Math.abs(other.laneOffset - tv.baseLaneOffset) < 2.8 &&
          Math.abs(other.posAlong - candidatePosAlong) < 24.0
        ) {
          laneFree = false;
          break;
        }
      }

      if (laneFree) {
        chosenPosAlong = candidatePosAlong;
        break;
      }
    }

    tv.posAlong = chosenPosAlong;
    tv.laneOffset = tv.baseLaneOffset;
    tv.targetLaneOffset = tv.baseLaneOffset;
    tv.currentSpeed = tv.cruiseSpeed;
    tv.stuckTimer = 0;
    tv.surroundedTimer = 0;
    tv.abandonedTimer = 0;
    tv.respawnFadeTimer = 0.35;

    if (tv.isBraking) {
      tv.isBraking = false;
      for (const bl of tv.brakeLights) {
        bl.material = SHARED_BRAKE_LIGHT_OFF_MAT;
      }
    }

    const nx = tv.axis === 'z_const' ? tv.posAlong : tv.roadCoord + tv.laneOffset;
    const nz = tv.axis === 'z_const' ? tv.roadCoord + tv.laneOffset : tv.posAlong;
    const rotY =
      tv.axis === 'z_const'
        ? tv.dir > 0
          ? Math.PI / 2
          : -Math.PI / 2
        : tv.dir > 0
          ? 0
          : Math.PI;
    const refY =
      tv.cfg?.startY ??
      tv.cfg?.wrapY ??
      (this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(nx, nz) : 0);
    const ny = this.world.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(nx, nz, refY)
      : (this.world.getRoadElevation ? this.world.getRoadElevation(nx, nz) : 0);

    tv.mesh.position.set(nx, ny, nz);
    tv.mesh.rotation.set(0, rotY, 0, 'YXZ');
    obj.basePos.copy(tv.mesh.position);
    obj.baseRot.copy(tv.mesh.rotation);
    obj.groundY = ny;

    const isRotated90 = Math.abs(Math.sin(rotY)) > 0.7;
    const w = isRotated90 ? tv.baseD : tv.baseW;
    const d = isRotated90 ? tv.baseW : tv.baseD;
    if (tv.col1) {
      tv.col1.minX = nx - w * 0.5;
      tv.col1.maxX = nx + w * 0.5;
      tv.col1.minZ = nz - d * 0.5;
      tv.col1.maxZ = nz + d * 0.5;
      tv.col1.minY = ny;
      tv.col1.maxY = ny + 1.35;
    }
    if (tv.col2) {
      tv.col2.minX = nx - w * 0.44;
      tv.col2.maxX = nx + w * 0.44;
      tv.col2.minZ = nz - d * 0.36;
      tv.col2.maxZ = nz + d * 0.36;
      tv.col2.minY = ny;
      tv.col2.maxY = ny + tv.baseH;
    }
    return true;
  }

  triggerTrafficPanicNear(origin, radius = 28.0) {
    for (const tv of this.trafficVehicles) {
      if (tv.hijackedByPlayer || !tv.destructible || tv.destructible.destroyed) continue;
      const d = Math.hypot(tv.mesh.position.x - origin.x, tv.mesh.position.z - origin.z);
      if (d <= radius) {
        tv.panicTimer = 4.5;
      }
    }
  }

  /**
   * CARJACKING AMIGÁVEL ESTILO LEGO MARVEL: Ao pegar QUALQUER carro na rua com [E],
   * o motorista sai sempre como um civil surpreso correndo para a calçada (zero inimigo armado!).
   */
  _ejectDriverOnCarjack(tv) {
    const pos = tv.mesh.position;
    const rotY = tv.mesh.rotation.y;
    const leftX = pos.x - Math.cos(rotY) * 2.35;
    const leftZ = pos.z + Math.sin(rotY) * 2.35;
    const safe = this._findSafeStreetSpawn(leftX, leftZ, 1.4);

    // Recicla o pedestre mais distante da piscina de 160 civis para ser o motorista ejetado (zero leak de memória!)
    let chosenPed = null;
    let maxDistSq = -1;
    for (const ped of this.pedestrians) {
      const dSq = (ped.visual.root.position.x - pos.x) ** 2 + (ped.visual.root.position.z - pos.z) ** 2;
      if (dSq > maxDistSq) {
        maxDistSq = dSq;
        chosenPed = ped;
      }
    }

    if (chosenPed) {
      const fleeAngle = Math.atan2(safe.x - pos.x, safe.z - pos.z);
      const groundY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
      chosenPed.isChatGroup = false;
      chosenPed.visual.root.visible = true;
      chosenPed.visual.root.position.set(safe.x, Math.max(0.28, groundY + 0.28), safe.z);
      chosenPed.x1 = safe.x;
      chosenPed.z1 = safe.z;
      chosenPed.x2 = safe.x + Math.sin(fleeAngle) * 42;
      chosenPed.z2 = safe.z + Math.cos(fleeAngle) * 42;
      chosenPed.panicTimer = 5.0;
      chosenPed.panicDirX = Math.sin(fleeAngle);
      chosenPed.panicDirZ = Math.cos(fleeAngle);
      this._setPedestrianFace(chosenPed, 'civ_panic');
      chosenPed.slapstickTimer = 0.42;
      chosenPed.slapstickDuration = 0.42;
      chosenPed.knockVelX = Math.sin(fleeAngle) * 3.2;
      chosenPed.knockVelZ = Math.cos(fleeAngle) * 3.2;
    }
    soundFX.playCarHorn(0.85, false);
  }

  _updateUrbanTraffic(dt, playerPos, controller) {
    const drivenObj = controller?.currentVehicle || null;

    const isLaneSegmentClear = (tv, candLaneOffset, checkSpan = 12.0) => {
      for (const other of this.trafficVehicles) {
        if (other === tv || !other.destructible || other.destructible.destroyed) continue;
        if (Math.abs(other.mesh.position.y - tv.mesh.position.y) > 3.2) continue;
        if (other.axis !== tv.axis || Math.abs(other.roadCoord - tv.roadCoord) > 4.0) continue;
        if (
          Math.abs(other.laneOffset - candLaneOffset) < 2.6 &&
          Math.abs(other.posAlong - tv.posAlong) < checkSpan
        ) {
          return false;
        }
      }
      return true;
    };

    for (const tv of this.trafficVehicles) {
      const obj = tv.destructible;
      if (!obj || obj.destroyed) continue;

      tv.hornCooldown = Math.max(0, tv.hornCooldown - dt);
      tv.panicTimer = Math.max(0, tv.panicTimer - dt);
      if (tv.respawnFadeTimer > 0) {
        tv.respawnFadeTimer = Math.max(0, tv.respawnFadeTimer - dt);
      }

      // Carjacking Amigável ao entrar com [E] ou agarrar carro com o Titã Blindado
      if (obj.isDriven || obj.isGrabbed) {
        if (!tv.hijackedByPlayer) {
          tv.hijackedByPlayer = true;
          this._ejectDriverOnCarjack(tv);
        }
        tv.abandonedTimer = 0;
        if (tv.isBraking) {
          tv.isBraking = false;
          for (const bl of tv.brakeLights) bl.material = SHARED_BRAKE_LIGHT_OFF_MAT;
        }
        continue;
      }

      // Se um carro do trânsito foi roubado e depois abandonado no meio da rua longe do jogador (> 55m por 8s),
      // recicla de volta para o fluxo normal da avenida!
      if (tv.hijackedByPlayer) {
        const distPlayer = playerPos
          ? Math.hypot(playerPos.x - tv.mesh.position.x, playerPos.z - tv.mesh.position.z)
          : 999;
        if (distPlayer > 55.0) {
          tv.abandonedTimer = (tv.abandonedTimer || 0) + dt;
          if (tv.abandonedTimer >= 8.0) {
            tv.hijackedByPlayer = false;
            tv.abandonedTimer = 0;
            this._relocateStuckTrafficVehicle(tv, playerPos);
          }
        } else {
          tv.abandonedTimer = 0;
        }
        continue;
      }

      const pos = tv.mesh.position;
      const fwdX = Math.sin(tv.mesh.rotation.y);
      const fwdZ = Math.cos(tv.mesh.rotation.y);
      const myHalfLen = tv.baseD * 0.5;

      let obstacleAhead = false;
      let shouldHonk = false;
      let slowCarInBaseLane = false;
      let nearbyCarsCount = 0;

      // 1) Verifica se o jogador a pé ou o veículo do jogador está na frente (folga de 3.5m do para-choque!)
      if (playerPos) {
        const dxP = playerPos.x - pos.x;
        const dzP = playerPos.z - pos.z;
        const distAheadP = dxP * fwdX + dzP * fwdZ;
        const latDistP = Math.abs(dxP * fwdZ - dzP * fwdX);
        const stopDistP = myHalfLen + (drivenObj ? 6.2 : 4.2);
        if (distAheadP > 0.8 && distAheadP < stopDistP && latDistP < 3.4 && Math.abs(playerPos.y - pos.y) < 4.2) {
          obstacleAhead = true;
          shouldHonk = true;
        }
        if (drivenObj && Math.hypot(dxP, dzP) < 8.5 && Math.abs(playerPos.y - pos.y) < 3.0) {
          nearbyCarsCount++;
        }
      }

      // 2) Verifica fila de carros à frente, tenta ultrapassagem suave de faixa e conta carros colados (< 8.5m)!
      for (const other of this.trafficVehicles) {
        if (other === tv || !other.destructible || other.destructible.destroyed) continue;
        const oPos = other.mesh.position;
        if (Math.abs(oPos.y - pos.y) > 3.2) continue;

        const dxO = oPos.x - pos.x;
        const dzO = oPos.z - pos.z;
        const distO = Math.hypot(dxO, dzO);
        if (distO < 8.5) {
          nearbyCarsCount++;
        }

        const distAheadO = dxO * fwdX + dzO * fwdZ;
        if (distAheadO <= 1.0 || distAheadO > 22.0) continue;

        if (
          other.axis === tv.axis &&
          Math.abs(other.roadCoord - tv.roadCoord) < 4.0 &&
          Math.abs(other.laneOffset - tv.baseLaneOffset) < 2.6 &&
          distAheadO < 18.0 &&
          (other.hijackedByPlayer || other.currentSpeed < 3.5)
        ) {
          slowCarInBaseLane = true;
        }

        const latDistO = Math.abs(dxO * fwdZ - dzO * fwdX);
        if (latDistO < 2.65) {
          const bumperGap = distAheadO - (myHalfLen + other.baseD * 0.5);
          const isSlowOrStopped = other.hijackedByPlayer || other.currentSpeed < 3.5;

          // ULTRAPASSAGEM INTELIGENTE: se houver carro lento/abandonado a < 16m na frente, muda para a faixa lateral livre!
          if (isSlowOrStopped && distAheadO < 16.0) {
            const altLane = tv.baseLaneOffset > 0 ? tv.baseLaneOffset - 3.6 : tv.baseLaneOffset + 3.6;
            if (isLaneSegmentClear(tv, altLane, 12.0)) {
              tv.targetLaneOffset = altLane;
              if (bumperGap < 1.6) {
                obstacleAhead = true;
              }
              continue;
            }
          }

          if (!obstacleAhead && bumperGap < 3.8) {
            obstacleAhead = true;
            if (other.hijackedByPlayer) shouldHonk = true;
          }
        }
      }

      // Conta também viaturas de perseguição coladas ao redor (< 8.5m) para detectar cercamento!
      if (this.wantedSystem?.pursuitVehicles?.length > 0) {
        for (const pv of this.wantedSystem.pursuitVehicles) {
          if (!pv.carObj || pv.carObj.destroyed) continue;
          const pPos = pv.carObj.mesh.position;
          if (Math.abs(pPos.y - pos.y) < 3.0 && Math.hypot(pPos.x - pos.x, pPos.z - pos.z) < 8.5) {
            nearbyCarsCount++;
          }
        }
      }

      // Retorna suavemente para a faixa original assim que ela liberar!
      if (
        tv.targetLaneOffset !== tv.baseLaneOffset &&
        !slowCarInBaseLane &&
        isLaneSegmentClear(tv, tv.baseLaneOffset, 10.5)
      ) {
        tv.targetLaneOffset = tv.baseLaneOffset;
      }

      // 3) AUTO-DESPAWN & RESPAWN ANTI-ENGARRAFAMENTO:
      //    Se o carro ficar travado (>= 4.2s) ou cercado por >= 2 veículos (>= 2.4s), reposiciona em trecho livre!
      if (tv.currentSpeed < 2.0) {
        tv.stuckTimer = (tv.stuckTimer || 0) + dt;
      } else {
        tv.stuckTimer = Math.max(0, (tv.stuckTimer || 0) - dt * 2.0);
      }

      if (nearbyCarsCount >= 2 && tv.currentSpeed < 3.0) {
        tv.surroundedTimer = (tv.surroundedTimer || 0) + dt;
      } else {
        tv.surroundedTimer = Math.max(0, (tv.surroundedTimer || 0) - dt * 1.5);
      }

      if (tv.stuckTimer >= 4.2 || tv.surroundedTimer >= 2.4) {
        this._relocateStuckTrafficVehicle(tv, playerPos);
        continue;
      }

      // Buzina cômica periódica até a rua liberar!
      if (shouldHonk && tv.hornCooldown <= 0 && playerPos) {
        const distToPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (distToPlayer < 46.0) {
          tv.hornCooldown = 2.6 + Math.random() * 2.2;
          soundFX.playCarHorn(Math.max(0.25, 1.0 - distToPlayer / 48.0), false);
        }
      }

      const desiredCruise = tv.panicTimer > 0 ? tv.cruiseSpeed * 1.45 : tv.cruiseSpeed;
      const targetSpeed = obstacleAhead ? 0 : desiredCruise;
      const accelRate = obstacleAhead ? 46.0 : 16.0;
      tv.currentSpeed = THREE.MathUtils.lerp(
        tv.currentSpeed,
        targetSpeed,
        Math.min(1, dt * (accelRate / 10))
      );

      // Acende as duas luzes de freio vermelhas traseiras quando freado/parado no trânsito!
      const brakingNow = obstacleAhead || tv.currentSpeed < tv.cruiseSpeed * 0.55;
      if (brakingNow !== tv.isBraking) {
        tv.isBraking = brakingNow;
        const mat = brakingNow ? SHARED_BRAKE_LIGHT_ON_MAT : SHARED_BRAKE_LIGHT_OFF_MAT;
        for (const bl of tv.brakeLights) {
          bl.material = mat;
        }
      }

      if (tv.currentSpeed > 0.04) {
        tv.posAlong += tv.dir * tv.currentSpeed * dt;
        tv.laneOffset = THREE.MathUtils.lerp(
          tv.laneOffset,
          tv.targetLaneOffset ?? tv.baseLaneOffset,
          Math.min(1, dt * 4.0)
        );
        let wrapped = false;
        if (tv.posAlong > tv.maxC) {
          tv.posAlong = tv.minC;
          wrapped = true;
        } else if (tv.posAlong < tv.minC) {
          tv.posAlong = tv.maxC;
          wrapped = true;
        }

        const nx = tv.axis === 'z_const' ? tv.posAlong : tv.roadCoord + tv.laneOffset;
        const nz = tv.axis === 'z_const' ? tv.roadCoord + tv.laneOffset : tv.posAlong;
        const refY = wrapped
          ? (tv.cfg.wrapY ?? (this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(nx, nz) : 0))
          : tv.mesh.position.y;
        const ny = this.world.getSurfaceHeightAt
          ? this.world.getSurfaceHeightAt(nx, nz, refY)
          : (this.world.getRoadElevation ? this.world.getRoadElevation(nx, nz) : 0);
        const aheadY = this.world.getSurfaceHeightAt
          ? this.world.getSurfaceHeightAt(nx + fwdX * 2.0, nz + fwdZ * 2.0, ny)
          : ny;
        const slopePitch = -Math.atan2(aheadY - ny, 2.0);

        tv.mesh.rotation.order = 'YXZ';
        tv.mesh.position.set(nx, ny, nz);
        tv.mesh.rotation.x = wrapped
          ? slopePitch
          : THREE.MathUtils.lerp(tv.mesh.rotation.x || 0, slopePitch, Math.min(1, dt * 10));
        obj.basePos.copy(tv.mesh.position);
        obj.baseRot.copy(tv.mesh.rotation);
        obj.groundY = ny;

        const isRotated90 = Math.abs(Math.sin(tv.mesh.rotation.y)) > 0.7;
        const w = isRotated90 ? tv.baseD : tv.baseW;
        const d = isRotated90 ? tv.baseW : tv.baseD;
        if (tv.col1) {
          tv.col1.minX = nx - w * 0.5;
          tv.col1.maxX = nx + w * 0.5;
          tv.col1.minZ = nz - d * 0.5;
          tv.col1.maxZ = nz + d * 0.5;
          tv.col1.minY = ny;
          tv.col1.maxY = ny + 1.35;
        }
        if (tv.col2) {
          tv.col2.minX = nx - w * 0.44;
          tv.col2.maxX = nx + w * 0.44;
          tv.col2.minZ = nz - d * 0.36;
          tv.col2.maxZ = nz + d * 0.36;
          tv.col2.minY = ny;
          tv.col2.maxY = ny + tv.baseH;
        }
      }
    }
  }

  // ============================================================================
  // 2. BOLHA DINÂMICA DE MULTIDÃO (~160 CIVIS LEGO RECICLÁVEIS + 8 ARQUÉTIPOS + 4 REAÇÕES!)
  // ============================================================================
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

  _buildCivilianLegoMinifig(archetypeKey, variantIdx = 0) {
    const list = ARCHETYPE_PRESETS[archetypeKey] || ARCHETYPE_PRESETS.casual;
    const preset = list[variantIdx % list.length];

    const root = new THREE.Group();
    root.userData.skipStaticMerge = true;

    const headMat = getLegoMaterial(LEGO_COLORS.yellow, { roughness: 0.22 });
    const torsoBaseMat = getLegoMaterial(preset.torsoHex, { roughness: 0.22 });
    const legMat = getLegoMaterial(preset.legHex, { roughness: 0.24 });

    // Mescla cintura/pelve estática direto com o tronco na criação da geometria única se ainda não cacheada!
    if (!LivingCityManager._mergedTorsoHipGeo) {
      const tGeo = NPC_TRAPEZOID_TORSO_GEO.clone();
      const hGeo = NPC_HIP_GEO.clone();
      hGeo.translate(0, -0.4, 0);
      LivingCityManager._mergedTorsoHipGeo = mergeBufferGeometries([tGeo, hGeo]);
    }

    const leftLeg = new THREE.Mesh(NPC_LEG_GEO, legMat);
    leftLeg.position.set(-0.2, 0.62, 0);
    const rightLeg = new THREE.Mesh(NPC_LEG_GEO, legMat);
    rightLeg.position.set(0.2, 0.62, 0);

    const torso = new THREE.Mesh(LivingCityManager._mergedTorsoHipGeo, torsoBaseMat);
    torso.position.set(0, 1.04, 0);
    const torsoDecal = new THREE.Mesh(
      NPC_TORSO_DECAL_GEO,
      getSharedCivilianTorsoMaterial(preset.torsoKey)
    );
    torsoDecal.position.set(0, 1.04, 0);

    const head = new THREE.Mesh(NPC_HEAD_GEO, headMat);
    head.position.set(0, 1.66, 0);
    const faceShell = new THREE.Mesh(
      NPC_FACE_SHELL_GEO,
      getSharedNpcFaceMaterial(preset.faceKey || 'civ_smile')
    );
    faceShell.position.set(0, 1.66, 0);

    const leftArm = new THREE.Mesh(NPC_ARM_GEO, torsoBaseMat);
    leftArm.position.set(-0.52, 1.33, 0);
    leftArm.rotation.z = 0.08;
    const rightArm = new THREE.Mesh(NPC_ARM_GEO, torsoBaseMat);
    rightArm.position.set(0.52, 1.33, 0);
    rightArm.rotation.z = -0.08;

    root.add(leftLeg, rightLeg, torso, torsoDecal, head, faceShell, leftArm, rightArm);

    // Acessório de Cabeça (Cabelo, Boné, Capacete de Obra, Headband ou Headphones)
    let headPropMesh = null;
    if (preset.headProp && SHARED_CIV_PROP_GEOS[preset.headProp]) {
      headPropMesh = new THREE.Mesh(
        SHARED_CIV_PROP_GEOS[preset.headProp],
        getLegoMaterial(preset.headColor ?? 0x1e293b, { roughness: 0.24 })
      );
      headPropMesh.position.set(
        0,
        preset.headProp === 'headband' ? 1.78 : preset.headProp === 'headphones' ? 1.74 : 1.83,
        0
      );
      root.add(headPropMesh);
    }

    // Mochila 3D nas Costas (Turistas / Jovens)
    let backPropMesh = null;
    if (preset.backProp && SHARED_CIV_PROP_GEOS[preset.backProp]) {
      backPropMesh = new THREE.Mesh(
        SHARED_CIV_PROP_GEOS[preset.backProp],
        getLegoMaterial(preset.backPropColor ?? 0xd97706, { roughness: 0.25 })
      );
      backPropMesh.position.set(0, 1.05, -0.31);
      root.add(backPropMesh);
    }

    // Acessório 3D Leve na Mão Direita (Maleta, Copo de Café, Câmera LEGO, Smartphone ou Sacola — ZERO ARMAS!)
    let handPropMesh = null;
    let cameraFlashMesh = null;
    if (preset.handProp && SHARED_CIV_PROP_GEOS[preset.handProp]) {
      handPropMesh = new THREE.Mesh(
        SHARED_CIV_PROP_GEOS[preset.handProp],
        getLegoMaterial(preset.handPropColor ?? 0x1e293b, { roughness: 0.22 })
      );
      handPropMesh.position.set(0, -0.55, 0.13);
      rightArm.add(handPropMesh);

      if (preset.handProp === 'camera') {
        cameraFlashMesh = new THREE.Mesh(CAMERA_FLASH_GEO, SHARED_CAMERA_FLASH_MAT);
        cameraFlashMesh.position.set(0, -0.48, 0.34);
        cameraFlashMesh.visible = false;
        rightArm.add(cameraFlashMesh);
      }
    }

    return {
      root,
      torso,
      torsoDecal,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      head,
      faceShell,
      headPropMesh,
      backPropMesh,
      handPropMesh,
      cameraFlashMesh,
      preset
    };
  }

  /**
   * Atualiza instantaneamente o arquétipo visual de um civil reciclado para combinar 100% com o bairro atual do jogador!
   */
  _rethemePedestrianArchetype(ped, newArchetypeKey, seedIdx = 0) {
    if (ped.archetype === newArchetypeKey) return;
    const list = ARCHETYPE_PRESETS[newArchetypeKey] || ARCHETYPE_PRESETS.casual;
    const preset = list[seedIdx % list.length];
    const vis = ped.visual;

    ped.archetype = newArchetypeKey;
    ped.walkSpeed = preset.speed;
    ped.normalFaceKey = preset.faceKey || 'civ_smile';
    ped.currentFaceKey = ped.normalFaceKey;

    const torsoBaseMat = getLegoMaterial(preset.torsoHex, { roughness: 0.22 });
    vis.torso.material = torsoBaseMat;
    vis.leftArm.material = torsoBaseMat;
    vis.rightArm.material = torsoBaseMat;
    vis.torsoDecal.material = getSharedCivilianTorsoMaterial(preset.torsoKey);
    vis.leftLeg.material = getLegoMaterial(preset.legHex, { roughness: 0.24 });
    vis.rightLeg.material = vis.leftLeg.material;
    vis.faceShell.material = getSharedNpcFaceMaterial(ped.normalFaceKey);

    if (vis.headPropMesh) {
      if (preset.headProp && SHARED_CIV_PROP_GEOS[preset.headProp]) {
        vis.headPropMesh.visible = true;
        vis.headPropMesh.geometry = SHARED_CIV_PROP_GEOS[preset.headProp];
        vis.headPropMesh.material = getLegoMaterial(preset.headColor ?? 0x1e293b, { roughness: 0.24 });
        vis.headPropMesh.position.y =
          preset.headProp === 'headband' ? 1.78 : preset.headProp === 'headphones' ? 1.74 : 1.83;
      } else {
        vis.headPropMesh.visible = false;
      }
    }

    if (vis.backPropMesh) {
      vis.backPropMesh.visible = Boolean(preset.backProp);
      if (preset.backProp) {
        vis.backPropMesh.material = getLegoMaterial(preset.backPropColor ?? 0xd97706, { roughness: 0.25 });
      }
    }

    if (vis.handPropMesh) {
      if (preset.handProp && SHARED_CIV_PROP_GEOS[preset.handProp]) {
        vis.handPropMesh.visible = true;
        vis.handPropMesh.geometry = SHARED_CIV_PROP_GEOS[preset.handProp];
        vis.handPropMesh.material = getLegoMaterial(preset.handPropColor ?? 0x1e293b, { roughness: 0.22 });
      } else {
        vis.handPropMesh.visible = false;
      }
    }
    if (vis.cameraFlashMesh) {
      vis.cameraFlashMesh.visible = false;
    }
  }

  _registerCivilianPedestrian({
    x1,
    z1,
    x2,
    z2,
    uStart = 0.5,
    isChatGroup = false,
    chatPartnerAngle = 0,
    seed = 0
  }) {
    const rawX = THREE.MathUtils.lerp(x1, x2, uStart);
    const rawZ = THREE.MathUtils.lerp(z1, z2, uStart);
    const safe = this._findSafeStreetSpawn(rawX, rawZ, 1.35);
    const archetype = this._pickArchetypeForCoords(safe.x, safe.z, seed);
    const visual = this._buildCivilianLegoMinifig(archetype, seed);

    // Garante que todos tenham slots reutilizáveis para reciclagem de bairro sem recriar Meshes
    if (!visual.headPropMesh) {
      visual.headPropMesh = new THREE.Mesh(
        SHARED_CIV_PROP_GEOS.classic_hair,
        getLegoMaterial(0x451a03, { roughness: 0.24 })
      );
      visual.headPropMesh.position.set(0, 1.83, 0);
      visual.headPropMesh.visible = false;
      visual.root.add(visual.headPropMesh);
    }
    if (!visual.backPropMesh) {
      visual.backPropMesh = new THREE.Mesh(
        SHARED_CIV_PROP_GEOS.backpack,
        getLegoMaterial(0xd97706, { roughness: 0.25 })
      );
      visual.backPropMesh.position.set(0, 1.05, -0.31);
      visual.backPropMesh.visible = false;
      visual.root.add(visual.backPropMesh);
    }
    if (!visual.handPropMesh) {
      visual.handPropMesh = new THREE.Mesh(
        SHARED_CIV_PROP_GEOS.coffee_cup,
        getLegoMaterial(0xf8fafc, { roughness: 0.22 })
      );
      visual.handPropMesh.position.set(0, -0.55, 0.13);
      visual.handPropMesh.visible = false;
      visual.rightArm.add(visual.handPropMesh);
    }
    if (!visual.cameraFlashMesh) {
      visual.cameraFlashMesh = new THREE.Mesh(CAMERA_FLASH_GEO, SHARED_CAMERA_FLASH_MAT);
      visual.cameraFlashMesh.position.set(0, -0.48, 0.34);
      visual.cameraFlashMesh.visible = false;
      visual.rightArm.add(visual.cameraFlashMesh);
    }

    const terrainY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
    const baseY = Math.max(0.28, terrainY + 0.28);
    visual.root.position.set(safe.x, baseY, safe.z);
    if (isChatGroup) {
      visual.root.rotation.y = chatPartnerAngle;
    }
    this.scene.add(visual.root);

    const ped = {
      id: seed,
      archetype,
      visual,
      normalFaceKey: visual.preset.faceKey || 'civ_smile',
      currentFaceKey: visual.preset.faceKey || 'civ_smile',
      isChatGroup,
      chatPartnerAngle,
      x1,
      z1,
      x2,
      z2,
      dir: seed % 2 === 0 ? 1 : -1,
      walkSpeed: visual.preset.speed,
      state: 'NORMAL', // 'NORMAL' | 'CHEER' | 'VILLAIN_SPOOK' | 'PANIC'
      canCheerHero: seed % 3 !== 2,
      cheerStyle: seed % 2 === 0 ? 'clap' : 'wave',
      photoFlashTimer: 0,
      photoCooldown: 0.6 + (seed % 5) * 0.35,
      panicTimer: 0,
      panicDirX: 0,
      panicDirZ: 1,
      diveTimer: 0,
      diveVelX: 0,
      diveVelZ: 0,
      slapstickTimer: 0,
      slapstickDuration: 0.65,
      slapstickCooldown: 0,
      knockVelX: 0,
      knockVelZ: 0,
      animTime: seed * 0.77,
      destructible: null
    };

    // Registra no DestructibleManager como Civil Não-Letal (Salto acrobático + solta 2-3 Studs Prateados/Azuis!)
    if (this.destructibles) {
      const dObj = this.destructibles.registerDestructible({
        mesh: visual.root,
        type: 'pedestrian_civilian',
        hp: 999999,
        radius: 0.95,
        height: 2.0,
        colliders: [],
        debrisColors: [LEGO_COLORS.yellow, LEGO_COLORS.blue],
        studDrops: { silver: 2, gold: 0, blue: 1, purple: 0 },
        groundY: terrainY
      });
      dObj.isCivilianPedestrian = true;
      dObj.onDamaged = (_amount, hitOrigin) => {
        this._triggerCivilianSlapstickHit(ped, hitOrigin);
      };
      ped.destructible = dObj;
    }

    this.pedestrians.push(ped);
    return ped;
  }

  _initPedestrians() {
    // 1. GRUPOS DE CONVERSA NAS CALÇADAS E PRAÇAS (14 pontos x 2 ou 3 pessoas = 34 civis conversando!)
    const chatSpots = [
      { cx: -22, cz: -132, count: 3 }, // Entrada do Super Banco Central (Oeste)
      { cx: 22, cz: -132, count: 2 },  // Entrada do Super Banco Central (Leste)
      { cx: -32, cz: -101, count: 3 }, // Esquina Sul da Avenida do Banco
      { cx: 34, cz: -101, count: 2 },  // Ponto de Ônibus Avenida Central
      { cx: -75, cz: -15, count: 3 },  // Times Square Plaza
      { cx: -195, cz: -52, count: 3 }, // Praça da Torre dos Heróis
      { cx: 65, cz: 22, count: 2 },    // Entrada do Parque Central
      { cx: 145, cz: 155, count: 3 },  // Mirante do Lago no Parque Central
      { cx: -12, cz: -526, count: 2 }, // Praça do Subúrbio Norte
      { cx: 56, cz: -662, count: 2 },  // Calçada da Pizzaria Norte
      { cx: -28, cz: 728, count: 3 },  // Calçadão da Praia Sul
      { cx: 15, cz: 765, count: 2 },   // Entrada do Píer da Roda-Gigante
      { cx: -502, cz: -132, count: 2 },// Entrada da Cidade de Deus
      { cx: 642, cz: -132, count: 2 }  // Esquina Comercial Leste
    ];

    let seedCounter = 1;
    for (const spot of chatSpots) {
      const safeCenter = this._findSafeStreetSpawn(spot.cx, spot.cz, 2.1);
      for (let k = 0; k < spot.count; k++) {
        const ang = (k / spot.count) * Math.PI * 2 + 0.35;
        const px = safeCenter.x + Math.cos(ang) * 1.15;
        const pz = safeCenter.z + Math.sin(ang) * 1.15;
        const lookToCenter = Math.atan2(safeCenter.x - px, safeCenter.z - pz);
        this._registerCivilianPedestrian({
          x1: px,
          z1: pz,
          x2: px + 18,
          z2: pz,
          uStart: 0,
          isChatGroup: true,
          chatPartnerAngle: lookToCenter,
          seed: seedCounter++
        });
      }
    }

    // 2. ROTAS AMPLAS DE CALÇADAS EM TODAS AS 10 REGIÕES (63 rotas x 2 = 126 caminhantes -> Total = 160 Civis LEGO!)
    const sidewalkRoutes = [
      // Centro Financeiro & Super Banco Central
      { x1: -48, z1: -133, x2: 48, z2: -133 },
      { x1: 48, z1: -133, x2: -48, z2: -133 },
      { x1: -52, z1: -101, x2: 52, z2: -101 },
      { x1: 52, z1: -101, x2: -52, z2: -101 },
      { x1: -104, z1: -235, x2: -104, z2: -20 },
      { x1: -136, z1: -235, x2: -136, z2: -20 },
      { x1: 104, z1: -235, x2: 104, z2: -20 },
      { x1: 136, z1: -235, x2: 136, z2: -20 },
      { x1: -96, z1: -236, x2: 96, z2: -236 },
      { x1: -96, z1: -268, x2: 96, z2: -268 },

      // Times Square & Complexo da Torre dos Heróis
      { x1: -236, z1: -101, x2: -136, z2: -101 },
      { x1: -236, z1: -133, x2: -136, z2: -133 },
      { x1: -136, z1: -16, x2: -18, z2: -16 },
      { x1: 18, z1: -16, x2: 112, z2: -16 },
      { x1: -238, z1: -16, x2: -140, z2: -16 },
      { x1: -236, z1: -180, x2: -236, z2: 45 },
      { x1: -268, z1: -180, x2: -268, z2: 45 },
      { x1: 140, z1: -101, x2: 245, z2: -101 },
      { x1: 140, z1: -133, x2: 245, z2: -133 },
      { x1: 236, z1: -195, x2: 236, z2: 45 },

      // Parque Central & Caminhos do Lago
      { x1: 22, z1: 18, x2: 112, z2: 18 },
      { x1: 138, z1: 18, x2: 242, z2: 18 },
      { x1: -55, z1: 18, x2: -12, z2: 18 },
      { x1: 58, z1: 162, x2: 188, z2: 162 },
      { x1: 58, z1: 362, x2: 225, z2: 362 },
      { x1: 56, z1: 35, x2: 56, z2: 175 },
      { x1: -104, z1: 24, x2: -104, z2: 220 },
      { x1: 268, z1: 24, x2: 268, z2: 240 },

      // Subúrbio Norte (Casas Coloridas, Praça, Pizzaria & Posto)
      { x1: -98, z1: -528, x2: 98, z2: -528 },
      { x1: -98, z1: -496, x2: 98, z2: -496 },
      { x1: 18, z1: -662, x2: 115, z2: -662 },
      { x1: -225, z1: -528, x2: -135, z2: -528 },
      { x1: 138, z1: -528, x2: 245, z2: -528 },
      { x1: -104, z1: -655, x2: -104, z2: -535 },
      { x1: 104, z1: -655, x2: 104, z2: -535 },
      { x1: -95, z1: -398, x2: 95, z2: -398 },

      // Calçadão Turístico & Faixa de Areia da Praia Sul
      { x1: -245, z1: 728, x2: -95, z2: 728 },
      { x1: -85, z1: 728, x2: 85, z2: 728 },
      { x1: 95, z1: 728, x2: 240, z2: 728 },
      { x1: 268, z1: 728, x2: 410, z2: 728 },
      { x1: -365, z1: 728, x2: -255, z2: 728 },
      { x1: -105, z1: 768, x2: 105, z2: 768 },
      { x1: -210, z1: 808, x2: -135, z2: 808 },
      { x1: -95, z1: 812, x2: 95, z2: 812 },
      { x1: 135, z1: 815, x2: 235, z2: 815 },
      { x1: -104, z1: 410, x2: -104, z2: 690 },
      { x1: 104, z1: 410, x2: 104, z2: 690 },

      // Morro da Cidade de Deus & Entradas Oeste
      { x1: -502, z1: -240, x2: -502, z2: -40 },
      { x1: -502, z1: -20, x2: -502, z2: 180 },
      { x1: -608, z1: -140, x2: -690, z2: -140 },
      { x1: -635, z1: -230, x2: -720, z2: -230 },
      { x1: -618, z1: -45, x2: -712, z2: -45 },
      { x1: -655, z1: 80, x2: -745, z2: 80 },

      // Distrito Leste & Porto Metropolitano
      { x1: 628, z1: -133, x2: 755, z2: -133 },
      { x1: 628, z1: -265, x2: 755, z2: -265 },
      { x1: 635, z1: -16, x2: 760, z2: -16 },
      { x1: 628, z1: 120, x2: 760, z2: 120 },
      { x1: 628, z1: 280, x2: 780, z2: 280 },
      { x1: 790, z1: 340, x2: 930, z2: 340 },

      // Entrada do Aeroporto Internacional (Oeste)
      { x1: -1042, z1: -120, x2: -1042, z2: 120 },
      { x1: -1025, z1: -95, x2: -920, z2: -95 },
      { x1: -1025, z1: 95, x2: -920, z2: 95 },
      { x1: -495, z1: -101, x2: -320, z2: -101 }
    ];

    for (const rt of sidewalkRoutes) {
      for (const uStart of [0.24, 0.76]) {
        this._registerCivilianPedestrian({
          x1: rt.x1,
          z1: rt.z1,
          x2: rt.x2,
          z2: rt.z2,
          uStart,
          isChatGroup: false,
          seed: seedCounter++
        });
      }
    }
  }

  /**
   * RECICLAGEM INTELIGENTE POR PROXIMIDADE ("DYNAMIC CROWD RING" — A CADA 1.0s):
   * Reposiciona suavemente pedestres a > 165m para calçadas seguras entre 45m e 125m ao redor do jogador,
   * respeitando o bairro atual e mantendo sempre 55 a 80 civis vivos caminhando perto de você!
   */
  _updateDynamicCrowdRing(playerPos) {
    if (!playerPos || playerPos.y > 95) return; // Não recicla se estiver lá no alto no Aeroporta-Aviões (Y=165m)

    let recycledCount = 0;
    const maxRecyclesPerTick = 32;

    for (let i = 0; i < this.pedestrians.length; i++) {
      if (recycledCount >= maxRecyclesPerTick) break;
      const ped = this.pedestrians[i];
      const root = ped.visual.root;
      const dist = Math.hypot(root.position.x - playerPos.x, root.position.z - playerPos.z);
      if (dist <= 125.0) continue;

      // Escolhe um ponto de calçada/praça no anel denso de 25m a 115m ao redor do jogador!
      let placed = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const ang = ((i * 1.618 + attempt * 1.25 + performance.now() * 0.0003) % 1) * Math.PI * 2;
        const ringDist = 25.0 + ((i * 19 + attempt * 23) % 90);
        const candX = playerPos.x + Math.cos(ang) * ringDist;
        const candZ = playerPos.z + Math.sin(ang) * ringDist;
        if (!this._isValidDryLandForPedestrian(candX, candZ)) continue;
        if (
          this.factionWar?.isInvasionActive &&
          getTerritoryZoneAt(candX, candZ)?.id === this.factionWar.activeZoneId
        ) {
          continue;
        }

        const safe = this._findSafeStreetSpawn(candX, candZ, 1.85);
        if (!safe.valid) continue;

        // Gera um segmento de caminhada limpo (Leste-Oeste ou Norte-Sul) sem cruzar água nem prédios
        const walkAlongX = (i + attempt) % 2 === 0;
        const halfSeg = 24.0 + (i % 4) * 5.5;
        const ax1 = walkAlongX ? safe.x - halfSeg : safe.x;
        const az1 = walkAlongX ? safe.z : safe.z - halfSeg;
        const ax2 = walkAlongX ? safe.x + halfSeg : safe.x;
        const az2 = walkAlongX ? safe.z : safe.z + halfSeg;

        const end1Ok = !this._isInsideBuilding(ax1, az1, 1.1) && this._isValidDryLandForPedestrian(ax1, az1);
        const end2Ok = !this._isInsideBuilding(ax2, az2, 1.1) && this._isValidDryLandForPedestrian(ax2, az2);

        const terrainY = this.world.getTerrainHeightAt
          ? this.world.getTerrainHeightAt(safe.x, safe.z)
          : 0;
        const newArch = this._pickArchetypeForCoords(safe.x, safe.z, ped.id + recycledCount);
        this._rethemePedestrianArchetype(ped, newArch, ped.id);

        root.position.set(safe.x, Math.max(0.28, terrainY + 0.28), safe.z);
        root.rotation.set(0, 0, 0);
        root.visible = true;

        ped.panicTimer = 0;
        ped.slapstickTimer = 0;
        ped.diveTimer = 0;
        ped.state = 'NORMAL';
        ped.isChatGroup = i % 7 === 0; // ~14% conversando nas esquinas, ~86% caminhando!
        ped.chatPartnerAngle = ang + Math.PI * 0.5;
        ped.x1 = end1Ok ? ax1 : safe.x;
        ped.z1 = end1Ok ? az1 : safe.z;
        ped.x2 = end2Ok ? ax2 : safe.x + (walkAlongX ? 16 : 0);
        ped.z2 = end2Ok ? az2 : safe.z + (walkAlongX ? 0 : 16);

        if (ped.destructible) {
          ped.destructible.basePos.copy(root.position);
          ped.destructible.groundY = terrainY;
        }

        recycledCount++;
        placed = true;
        break;
      }
      if (!placed) continue;
    }
  }

  _setPedestrianFace(ped, faceKey) {
    if (ped.currentFaceKey === faceKey) return;
    ped.currentFaceKey = faceKey;
    if (ped.visual?.faceShell) {
      ped.visual.faceShell.material = getSharedNpcFaceMaterial(faceKey);
    }
  }

  /**
   * COMÉDIA LEGO SEM PUNIÇÃO: Ao acertar soco/explosão ou esbarrar de carro em um civil,
   * ele dá um salto acrobático cômico para trás/lado, solta 2 a 3 Studs Prateados/Azuis de susto e corre de mãos pro alto!
   */
  _triggerCivilianSlapstickHit(ped, hitOrigin) {
    const root = ped.visual.root;
    const ox = hitOrigin?.x ?? root.position.x + 1;
    const oz = hitOrigin?.z ?? root.position.z + 1;
    let dx = root.position.x - ox;
    let dz = root.position.z - oz;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) {
      dx = 1;
      dz = 0;
    } else {
      dx /= len;
      dz /= len;
    }

    ped.isChatGroup = false;
    ped.slapstickTimer = 0.65;
    ped.slapstickDuration = 0.65;
    ped.knockVelX = dx * 9.5;
    ped.knockVelZ = dz * 9.5;
    ped.panicTimer = 5.0;
    ped.panicDirX = dx;
    ped.panicDirZ = dz;
    ped.state = 'PANIC';
    this._setPedestrianFace(ped, 'civ_panic');

    if (ped.slapstickCooldown <= 0) {
      ped.slapstickCooldown = 2.2;
      soundFX.playPlasticHit();
      if (this.destructibles) {
        const groundY = this.world.getTerrainHeightAt
          ? this.world.getTerrainHeightAt(root.position.x, root.position.z)
          : 0;
        const dropSpec = ped.id % 2 === 0 ? { silver: 2, blue: 1 } : { silver: 2 };
        this.destructibles.spawnRewardStudFountain(root.position, groundY, dropSpec);
      }
    }
  }

  /**
   * Pânico Cômico LEGO (5.0s) num raio de 28m quando o jogador atira, explode ou soca perto dos civis!
   */
  triggerPedestrianPanicNear(origin, radius = 28.0) {
    const clampR = Math.min(34.0, Math.max(18.0, radius));
    this.triggerTrafficPanicNear(origin, 26.0);
    for (const ped of this.pedestrians) {
      const pos = ped.visual.root.position;
      const dx = pos.x - origin.x;
      const dz = pos.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= clampR) {
        ped.isChatGroup = false;
        ped.panicTimer = 5.0;
        ped.state = 'PANIC';
        const len = Math.max(0.1, dist);
        ped.panicDirX = dx / len;
        ped.panicDirZ = dz / len;
        this._setPedestrianFace(ped, 'civ_panic');
      }
    }
  }

  _updatePedestrians(dt, playerPos, controller) {
    const heroKey = controller?.minifigure?.currentHeroKey || 'caveira';
    const isVortexSymbiote = heroKey === 'vortex';
    const playerSpeed = controller?.getHorizontalSpeed ? controller.getHorizontalSpeed() : 0;
    const isDrivingCar = Boolean(controller?.currentVehicle);
    const isAirborneNow = Boolean(controller && (controller.isFlying || !controller.isGrounded));

    // Detecta quando um Herói pousa de um voo perto das pessoas -> ativa comemoração imediata!
    if (this._wasPlayerAirborne && !isAirborneNow && playerPos && !isVortexSymbiote) {
      this._heroLandingCheerTimer = 4.2;
      this._heroLandingPos.copy(playerPos);
    }
    this._wasPlayerAirborne = isAirborneNow;
    if (this._heroLandingCheerTimer > 0) {
      this._heroLandingCheerTimer = Math.max(0, this._heroLandingCheerTimer - dt);
    }

    // Se o jogador estiver dirigindo em alta velocidade perto dos pedestres da calçada -> ativa Pânico e Mergulho Lateral!
    const carSpeedingNearSidewalk = isDrivingCar && playerSpeed > 12.5;
    const carFwdX = isDrivingCar ? Math.sin(controller.facingAngle || 0) : 0;
    const carFwdZ = isDrivingCar ? Math.cos(controller.facingAngle || 0) : 0;

    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i];
      const vis = ped.visual;
      const root = vis.root;

      if (ped.slapstickCooldown > 0) ped.slapstickCooldown = Math.max(0, ped.slapstickCooldown - dt);
      if (ped.photoFlashTimer > 0) {
        ped.photoFlashTimer -= dt;
        if (ped.photoFlashTimer <= 0 && vis.cameraFlashMesh) {
          vis.cameraFlashMesh.visible = false;
        }
      }

      let distToPlayer = 9999;
      let dxFromPlayer = 0;
      let dzFromPlayer = 0;
      if (playerPos) {
        dxFromPlayer = root.position.x - playerPos.x;
        dzFromPlayer = root.position.z - playerPos.z;
        const dSq = dxFromPlayer * dxFromPlayer + dzFromPlayer * dzFromPlayer;
        const isCloseVisible = dSq <= 125 * 125;
        if (root.visible !== isCloseVisible) {
          root.visible = isCloseVisible;
        }
        if (!isCloseVisible) continue;
        distToPlayer = Math.sqrt(dSq);
      }

      // Colisão cômica não-letal se o carro do jogador trombar diretamente no civil!
      if (isDrivingCar && playerSpeed > 3.5 && distToPlayer < 2.85 && ped.slapstickTimer <= 0) {
        this._triggerCivilianSlapstickHit(ped, playerPos);
      } else if (carSpeedingNearSidewalk && distToPlayer < 12.5 && ped.slapstickTimer <= 0) {
        // Carro vindo rápido na direção do pedestre -> Mergulho / Salto lateral rápido + Pânico de 5s!
        const relX = root.position.x - playerPos.x;
        const relZ = root.position.z - playerPos.z;
        const ahead = relX * carFwdX + relZ * carFwdZ;
        const lat = relX * carFwdZ - relZ * carFwdX;
        if (ahead > -1.0 && ahead < 11.5 && Math.abs(lat) < 4.5 && ped.diveTimer <= 0) {
          const sideSign = lat >= 0 ? 1 : -1;
          ped.diveTimer = 0.42;
          ped.diveVelX = carFwdZ * sideSign * 11.5;
          ped.diveVelZ = -carFwdX * sideSign * 11.5;
        }
        ped.isChatGroup = false;
        ped.panicTimer = 5.0;
        ped.panicDirX = dxFromPlayer / Math.max(0.1, distToPlayer);
        ped.panicDirZ = dzFromPlayer / Math.max(0.1, distToPlayer);
        this._setPedestrianFace(ped, 'civ_panic');
      }

      ped.animTime += dt;
      let hopHeight = 0;
      let moveX = 0;
      let moveZ = 0;
      let speed = 0;

      // 0) SALTO ACROBÁTICO CÔMICO (Mortal / Pulo quando leva soco ou trombada!)
      if (ped.slapstickTimer > 0) {
        ped.slapstickTimer = Math.max(0, ped.slapstickTimer - dt);
        const u = 1.0 - ped.slapstickTimer / ped.slapstickDuration;
        hopHeight = Math.sin(u * Math.PI) * 2.35;
        root.position.x += ped.knockVelX * dt;
        root.position.z += ped.knockVelZ * dt;
        root.rotation.x = u * Math.PI * 2;
        vis.leftArm.rotation.x = -2.8;
        vis.rightArm.rotation.x = -2.8;
        vis.leftLeg.rotation.x = 0.7;
        vis.rightLeg.rotation.x = -0.7;
        if (ped.slapstickTimer <= 0) {
          root.rotation.x = 0;
        }
      } else if (ped.diveTimer > 0) {
        // MERGULHO / SALTO LATERAL RÁPIDO SAINDO DA FRENTE DE CARRO!
        ped.diveTimer = Math.max(0, ped.diveTimer - dt);
        const u = 1.0 - ped.diveTimer / 0.42;
        hopHeight = Math.sin(u * Math.PI) * 1.15;
        root.position.x += ped.diveVelX * dt;
        root.position.z += ped.diveVelZ * dt;
        root.rotation.z = Math.sin(u * Math.PI) * 0.48;
        vis.leftArm.rotation.x = -2.6;
        vis.rightArm.rotation.x = -2.6;
        if (ped.diveTimer <= 0) {
          root.rotation.z = 0;
        }
      } else if (ped.panicTimer > 0) {
        // ESTADO 4: PANIC (Pânico Cômico LEGO por 5s com braços para o alto!)
        ped.state = 'PANIC';
        ped.panicTimer -= dt;
        speed = 8.2;
        moveX = ped.panicDirX;
        moveZ = ped.panicDirZ;
        if (ped.panicTimer <= 0) {
          ped.state = 'NORMAL';
          this._setPedestrianFace(ped, ped.normalFaceKey);
        }
      } else if (controller?.minifigure?.activeEmote && distToPlayer <= 12.0 && !isDrivingCar) {
        // ESTADO EMOTE CONTAGIANTE (< 12m): Civis olham para o jogador e começam a dançar / bater palmas junto!
        ped.state = 'DANCE_ALONG';
        this._setPedestrianFace(ped, 'civ_smile');
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        const dancePhase = ped.animTime * 11.5 + (ped.id % 4) * 0.5;
        hopHeight = Math.abs(Math.sin(dancePhase)) * 0.28;
        vis.leftLeg.rotation.x = Math.sin(dancePhase) * 0.55;
        vis.rightLeg.rotation.x = -Math.sin(dancePhase) * 0.55;
        if (ped.id % 2 === 0) {
          const clap = Math.sin(dancePhase * 1.4) * 0.25;
          vis.leftArm.rotation.x = -1.4 + clap;
          vis.rightArm.rotation.x = -1.4 - clap;
        } else {
          vis.leftArm.rotation.x = -2.25 + Math.sin(dancePhase) * 0.55;
          vis.rightArm.rotation.x = -2.25 - Math.sin(dancePhase) * 0.55;
        }
      } else if (isVortexSymbiote && distToPlayer < 7.0 && !isDrivingCar) {
        // ESTADO 3: VILLAIN_SPOOK (Reação assustada ao Simbionte Vórtex OP-08 a < 7m!)
        ped.state = 'VILLAIN_SPOOK';
        this._setPedestrianFace(ped, 'civ_panic');
        const inv = 1.0 / Math.max(0.1, distToPlayer);
        // Olha assustado para o Vórtex enquanto dá passos para trás!
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        root.position.x += dxFromPlayer * inv * 2.35 * dt;
        root.position.z += dzFromPlayer * inv * 2.35 * dt;
        const tremble = Math.sin(ped.animTime * 22.0) * 0.08;
        vis.leftArm.rotation.x = -1.65 + tremble;
        vis.rightArm.rotation.x = -1.65 - tremble;
        vis.leftLeg.rotation.x = Math.sin(ped.animTime * 9.0) * 0.32;
        vis.rightLeg.rotation.x = -Math.sin(ped.animTime * 9.0) * 0.32;
      } else if (
        !isVortexSymbiote &&
        !isDrivingCar &&
        ((this._heroLandingCheerTimer > 0 && distToPlayer < 15.0) ||
          (ped.canCheerHero && distToPlayer < 10.0 && playerSpeed < 7.5))
      ) {
        // ESTADO 2: CHEER / FÃ DE HERÓI (Pulinhos, Palmas, Aceno e Flash 3D de Foto dos Turistas!)
        ped.state = 'CHEER';
        this._setPedestrianFace(ped, ped.normalFaceKey);
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        hopHeight = Math.max(0, Math.sin(ped.animTime * 8.5)) * 0.24;
        vis.leftLeg.rotation.x = 0;
        vis.rightLeg.rotation.x = 0;

        if (ped.archetype === 'tourist') {
          // Turista levanta a câmera 3D na altura do rosto e dispara Flash Branco 3D (0.12s)!
          vis.rightArm.rotation.x = -1.48;
          vis.leftArm.rotation.x = -1.25;
          ped.photoCooldown -= dt;
          if (ped.photoCooldown <= 0) {
            ped.photoCooldown = 1.85 + (ped.id % 4) * 0.45;
            ped.photoFlashTimer = 0.12;
            if (vis.cameraFlashMesh) {
              vis.cameraFlashMesh.visible = true;
              vis.cameraFlashMesh.rotation.y = ped.animTime * 3.0;
            }
          }
        } else if (ped.cheerStyle === 'clap') {
          // Batendo palmas animado!
          const clap = Math.sin(ped.animTime * 14.0) * 0.22;
          vis.leftArm.rotation.x = -1.35 + clap;
          vis.rightArm.rotation.x = -1.35 - clap;
        } else {
          // Acenando com um braço lá no alto!
          vis.rightArm.rotation.x = -2.65 + Math.sin(ped.animTime * 12.0) * 0.32;
          vis.leftArm.rotation.x = -0.25;
        }
      } else {
        // ESTADO 1: NORMAL (Caminhando, Correndo em Jogging ou Conversando nas Esquinas!)
        ped.state = 'NORMAL';
        this._setPedestrianFace(ped, ped.normalFaceKey);

        if (ped.isChatGroup) {
          root.rotation.y = ped.chatPartnerAngle + Math.sin(ped.animTime * 1.1) * 0.08;
          vis.leftLeg.rotation.x = 0;
          vis.rightLeg.rotation.x = 0;
          vis.leftArm.rotation.x = -0.45 + Math.sin(ped.animTime * 3.4) * 0.22;
          vis.rightArm.rotation.x = -0.62 + Math.cos(ped.animTime * 2.9) * 0.28;
        } else {
          speed = ped.walkSpeed;
          const targetX = ped.dir > 0 ? ped.x2 : ped.x1;
          const targetZ = ped.dir > 0 ? ped.z2 : ped.z1;
          const dx = targetX - root.position.x;
          const dz = targetZ - root.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.25) {
            ped.dir *= -1;
          } else {
            moveX = dx / dist;
            moveZ = dz / dist;
          }
        }
      }

      // Aplica deslocamento de caminhada/corrida/pânico + desvio suave de prédios
      if (speed > 0 && (moveX !== 0 || moveZ !== 0)) {
        const nextX = root.position.x + moveX * speed * dt;
        const nextZ = root.position.z + moveZ * speed * dt;
        if (this._isValidDryLandForPedestrian(nextX, nextZ)) {
          root.position.x = nextX;
          root.position.z = nextZ;
        } else {
          ped.dir *= -1;
          ped.panicDirX *= -1;
          ped.panicDirZ *= -1;
        }

        root.rotation.y = Math.atan2(moveX, moveZ);

        const isJogging = ped.state === 'NORMAL' && ped.archetype === 'jogger';
        const freq = ped.state === 'PANIC' ? 15.0 : isJogging ? 10.5 : 7.0;
        const amp = ped.state === 'PANIC' ? 0.85 : isJogging ? 0.68 : 0.46;
        const swing = Math.sin(ped.animTime * freq) * amp;

        vis.leftLeg.rotation.x = swing;
        vis.rightLeg.rotation.x = -swing;

        if (ped.state === 'PANIC') {
          vis.leftArm.rotation.x = -2.68 + swing * 0.32;
          vis.rightArm.rotation.x = -2.68 - swing * 0.32;
        } else if (isJogging) {
          // Corredor com braços dobrados em ritmo esportivo!
          vis.leftArm.rotation.x = -1.05 - swing * 0.65;
          vis.rightArm.rotation.x = -1.05 + swing * 0.65;
        } else {
          vis.leftArm.rotation.x = -swing * 0.75;
          // Se estiver segurando café, câmera ou celular na mão direita, mantém o antebraço levemente erguido!
          const holdingItem = vis.handPropMesh?.visible;
          vis.rightArm.rotation.x = holdingItem ? -0.58 + swing * 0.2 : swing * 0.75;
        }
      }

      // Garante colisão sólida com prédios e muros na grade espacial 3x3
      const pedCol = this._resolveBuildingCollision(root.position.x, root.position.z, 1.05);
      if (pedCol.collided) {
        root.position.x = pedCol.x;
        root.position.z = pedCol.z;
        if (ped.state === 'NORMAL' && !ped.isChatGroup) {
          ped.dir *= -1;
        }
      }

      // Altura Y dinâmica acompanhando pontes, calçadas e o Morro da Cidade de Deus + pulinhos!
      const terrainY = this.world.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(root.position.x, root.position.z)
        : 0;
      const baseY = Math.max(0.28, terrainY + 0.28);
      root.position.y = baseY + hopHeight;

      if (ped.destructible) {
        ped.destructible.basePos.set(root.position.x, baseY, root.position.z);
        ped.destructible.groundY = terrainY;
      }
    }
  }

  // ============================================================================
  // 3. VIDA AMBIENTE NO CÉU E NAS CALÇADAS: HELICÓPTERO CIVIL DE TV + BANCAS DE LANCHE LEGO!
  // ============================================================================
  _initCivilianSkyHelicopter() {
    const heliGroup = new THREE.Group();
    const whiteMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.2, clearcoat: 0.55 });
    const yellowMat = getLegoMaterial(LEGO_COLORS.yellow, { roughness: 0.22, clearcoat: 0.5 });
    const skyBlueMat = getLegoMaterial(0x0284c7, { roughness: 0.22, clearcoat: 0.5 });
    const darkMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.35 });
    const glassMat = getLegoMaterial(0x38bdf8, { roughness: 0.08, metalness: 0.45 });

    // Fuselagem branca/amarela/azul de TV & Turismo (100% pacífico!)
    const cabin = createLegoBrick(2.4, 1.6, 4.4, LEGO_COLORS.white, { studStep: 0.7 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.36, 4.44), skyBlueMat);
    stripe.position.set(0, -0.1, 0);
    const noseWindshield = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 1.5), glassMat);
    noseWindshield.position.set(0, 0.1, 2.25);
    const yellowTailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.72, 4.6), yellowMat);
    yellowTailBoom.position.set(0, 0.22, -4.1);
    const tailFin = createLegoBrick(0.26, 1.55, 1.1, 0x0284c7, { studs: false });
    tailFin.position.set(0, 0.85, -6.1);

    // Câmera giroscópica de TV no nariz inferior + Esquis de pouso
    const tvPod = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), darkMat);
    tvPod.position.set(0, -0.95, 2.1);
    for (const sx of [-1.05, 1.05]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.8, 8), darkMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -1.25, 0.2);
      const strutF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.14), darkMat);
      strutF.position.set(sx, -0.95, 1.2);
      const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.14), darkMat);
      strutR.position.set(sx, -0.95, -1.0);
      heliGroup.add(skid, strutF, strutR);
    }

    // Hélice principal e rotor de cauda giratórios
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 10), darkMat);
    mast.position.set(0, 1.05, 0);
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 1.32, 0);
    const bladeA = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.08, 0.44), darkMat);
    const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 9.2), yellowMat);
    mainRotor.add(bladeA, bladeB);

    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 0.24), yellowMat);
    tailRotor.position.set(0.22, 0.95, -6.15);

    heliGroup.add(cabin, stripe, noseWindshield, yellowTailBoom, tailFin, tvPod, mast, mainRotor, tailRotor);
    heliGroup.position.set(0, 65, 120);
    this.scene.add(heliGroup);

    this.civilianSkyHeli = {
      group: heliGroup,
      mainRotor,
      tailRotor,
      orbitAngle: 0.4
    };
  }

  _updateCivilianSkyHelicopter(dt) {
    if (!this.civilianSkyHeli) return;
    const h = this.civilianSkyHeli;
    h.orbitAngle += dt * 0.075;
    // Órbita ampla e suave sobre o Skyline do Centro, Parque Central e Orla da Praia Sul (Y = 65m)
    const cx = Math.cos(h.orbitAngle) * 340;
    const cz = 180 + Math.sin(h.orbitAngle) * 440;
    const nextX = Math.cos(h.orbitAngle + 0.02) * 340;
    const nextZ = 180 + Math.sin(h.orbitAngle + 0.02) * 440;

    h.group.position.set(cx, 65 + Math.sin(h.orbitAngle * 3.0) * 1.8, cz);
    h.group.rotation.y = Math.atan2(nextX - cx, nextZ - cz);
    h.group.rotation.z = -0.12;
    h.mainRotor.rotation.y += dt * 18.0;
    h.tailRotor.rotation.x += dt * 22.0;
  }

  /**
   * BANCAS / CARRINHOS LEGO DE CACHORRO-QUENTE, SORVETE E CAFÉ NAS CALÇADAS:
   * Objetos quebráveis carismáticos que soltam muitos Studs Dourados e Azuis quando destruídos!
   */
  _initStreetVendorCarts() {
    if (!this.destructibles) return;

    const cartSpots = [
      // Centro Financeiro & Super Banco Central
      { x: -30, z: -133, kind: 'hotdog' },
      { x: 30, z: -133, kind: 'coffee' },
      { x: -38, z: -101, kind: 'coffee' },
      { x: 38, z: -101, kind: 'hotdog' },
      { x: -104, z: -155, kind: 'coffee' },
      { x: 104, z: -155, kind: 'hotdog' },

      // Times Square & Torre dos Heróis
      { x: -65, z: -16, kind: 'hotdog' },
      { x: -105, z: -16, kind: 'icecream' },
      { x: -185, z: -85, kind: 'coffee' },
      { x: -215, z: -35, kind: 'hotdog' },
      { x: 65, z: -16, kind: 'coffee' },

      // Parque Central & Lago
      { x: 42, z: 22, kind: 'icecream' },
      { x: 92, z: 22, kind: 'hotdog' },
      { x: 165, z: 22, kind: 'coffee' },
      { x: 64, z: 145, kind: 'icecream' },
      { x: 135, z: 162, kind: 'hotdog' },

      // Calçadão Turístico da Praia Sul & Píer
      { x: -165, z: 728, kind: 'icecream' },
      { x: -72, z: 728, kind: 'hotdog' },
      { x: -18, z: 728, kind: 'icecream' },
      { x: 36, z: 728, kind: 'coffee' },
      { x: 125, z: 728, kind: 'icecream' },
      { x: 195, z: 728, kind: 'hotdog' }
    ];

    for (const sp of cartSpots) {
      const safe = this._findSafeStreetSpawn(sp.x, sp.z, 1.5);
      const yBase = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;

      const primaryHex =
        sp.kind === 'hotdog' ? 0xdc2626 : sp.kind === 'icecream' ? 0xec4899 : 0x78350f;
      const secondaryHex =
        sp.kind === 'hotdog' ? 0xfacc15 : sp.kind === 'icecream' ? 0x38bdf8 : 0xfde68a;

      const cartGroup = new THREE.Group();
      const body = createLegoBrick(1.9, 1.05, 1.15, primaryHex, { studStep: 0.55 });
      body.position.set(0, 0.72, 0);
      const counterTop = createLegoBrick(2.02, 0.16, 1.25, LEGO_COLORS.white, { studStep: 0.55 });
      counterTop.position.set(0, 1.32, 0);

      // Rodinhas laterais + Guarda-sol colorido LEGO no topo!
      const wheelMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.35 });
      for (const wx of [-0.65, 0.65]) {
        for (const wz of [-0.6, 0.6]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12), wheelMat);
          w.rotation.x = Math.PI / 2;
          w.position.set(wx, 0.24, wz);
          cartGroup.add(w);
        }
      }

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 1.65, 8),
        getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.5, roughness: 0.2 })
      );
      pole.position.set(0, 2.15, 0);
      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(1.45, 0.62, 8),
        getLegoMaterial(secondaryHex, { roughness: 0.22 })
      );
      umbrella.position.set(0, 2.95, 0);
      const topStud = new THREE.Mesh(SHARED_STUD_GEO, getLegoMaterial(primaryHex));
      topStud.position.set(0, 3.28, 0);

      cartGroup.add(body, counterTop, pole, umbrella, topStud);
      cartGroup.position.set(safe.x, yBase, safe.z);
      this.scene.add(cartGroup);

      const col = this.world.addCollider(safe.x, safe.z, 2.0, 1.3, yBase + 2.2, yBase);
      this.destructibles.registerDestructible({
        mesh: cartGroup,
        type: 'newsstand',
        hp: 35,
        radius: 1.45,
        height: 2.8,
        colliders: [col],
        debrisColors: [primaryHex, secondaryHex, LEGO_COLORS.white, LEGO_COLORS.yellow],
        studDrops: { silver: 3, gold: 8, blue: 4, purple: 0 },
        groundY: yBase
      });
    }
  }

  // ============================================================================
  // 4. COMANDO [G] DO COMANDANTE CAVEIRA (ENTREGA VIATURA BLINDADA SEM SOLDADOS ATIRANDO!)
  // ============================================================================
  triggerCaveiraRadioCommand(playerPos, facingAngle) {
    if (!playerPos || this.caveiraSupportCooldown > 0) return;
    this.caveiraSupportCooldown = 3.5;
    soundFX.playHeroSwap();

    const rawDropX = playerPos.x + Math.sin(facingAngle) * 8.0;
    const rawDropZ = playerPos.z + Math.cos(facingAngle) * 8.0;
    const safeDrop = this._findSafeStreetSpawn(rawDropX, rawDropZ, 2.8);
    const dropY = this.world.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(safeDrop.x, safeDrop.z)
      : 0;

    const vType = this.caveiraCallToggle % 2 === 0 ? 'caveirao_bope' : 'interceptor_v8';
    this.caveiraCallToggle++;
    const spec = VEHICLE_SPECS[vType];

    const carMesh = createLegoCarMesh({
      x: safeDrop.x,
      z: safeDrop.z,
      rotY: facingAngle,
      color: 0x111827,
      roofColor: vType === 'caveirao_bope' ? 0x111827 : LEGO_COLORS.white,
      type: vType
    });
    carMesh.position.set(safeDrop.x, dropY, safeDrop.z);
    carMesh.rotation.y = facingAngle;
    carMesh.userData.carType = vType;
    carMesh.userData.carName = spec.name;
    carMesh.userData.vehicleSpec = spec;
    this.scene.add(carMesh);

    const col1 = this.world.addCollider(safeDrop.x, safeDrop.z, 2.6, 5.2, dropY + 1.4, dropY);
    if (this.destructibles) {
      this.destructibles.registerDestructible({
        mesh: carMesh,
        type: 'car',
        hp: spec.hp,
        radius: 2.8,
        height: 2.2,
        colliders: [col1],
        debrisColors: [0x111827, 0xfacc15, 0xf8fafc],
        studDrops: spec.studDrops,
        groundY: dropY
      });
      this.destructibles.spawnHeroSwapEffect(
        new THREE.Vector3(safeDrop.x, dropY + 0.5, safeDrop.z),
        0xfacc15
      );
    }
  }

  // ============================================================================
  // LOOP PRINCIPAL (60 FPS CRAVADOS — ZERO DANO AO JOGADOR NO MODO LIVRE)
  // ============================================================================
  update(dt, playerPos, controller = null) {
    if (this.caveiraSupportCooldown > 0) {
      this.caveiraSupportCooldown = Math.max(0, this.caveiraSupportCooldown - dt);
    }

    // Na Cidade Civil Pacífica (0 Estrelas e fora de Invasão de Território), os 4 Corações LEGO ficam sempre cheios!
    const isWantedActive = Boolean(this.wantedSystem && this.wantedSystem.stars > 0);
    if (!this.factionWar?.isInvasionActive && !isWantedActive && this.playerHp < this.playerMaxHp) {
      this.playerHp = this.playerMaxHp;
      this.hud?.setPlayerHealth(this.playerMaxHp, this.playerMaxHp, false);
    }

    // Reciclagem Inteligente da Bolha de Multidão a cada 1.0 segundo!
    this._crowdRingTimer -= dt;
    if (this._crowdRingTimer <= 0) {
      this._crowdRingTimer = 1.0;
      this._updateDynamicCrowdRing(playerPos);
    }

    this._updateUrbanTraffic(dt, playerPos, controller);
    this._updatePedestrians(dt, playerPos, controller);
    this._updateCivilianSkyHelicopter(dt);
    if (this.factionWar) {
      this.factionWar.update(dt, playerPos, controller);
    }
    if (this.wantedSystem) {
      this.wantedSystem.update(dt, playerPos, controller);
    }
  }
}
