/**
 * VehicleChassisPrimitives.js
 * Primitivas geométricas hard-surface studless, cunhas (wedges), cabines inclinadas fumê,
 * faróis/lanternas, rodas cilíndricas mescladas, giroflex, chamas de nitro/afterburner
 * e clonagem de protótipos de veículos.
 */

import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  markAsSharedAsset
} from '../../materials/LegoMaterials.js';
import {
  optimizeStaticGroupMeshes,
  mergeBufferGeometries,
  mergeColoredGeometries,
  getSharedVertexColorMaterial
} from '../BuildingGenerator.js';
import { VEHICLE_SPECS } from './VehicleSpecsCatalog.js';

const SHARED_FLAME_MAT = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
const SHARED_AFTERBURNER_MAT = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));

const SHARED_WHEEL_VC_GEO_CACHE = new Map();
const SHARED_WHEEL_VC_MAT = markAsSharedAsset(
  getSharedVertexColorMaterial({
    roughness: 0.32,
    metalness: 0.28,
    clearcoat: 0.28,
    emissive: 0x000000,
    emissiveIntensity: 0
  })
);
const SHARED_TURBO_FLAME_GEO_CACHE = new Map();
const SHARED_EXHAUST_FLAME_GEO_CACHE = new Map();
let SHARED_NAVAL_AIR_GLASS_MAT = null;
let _fullVehicleRebuildFactory = null;

export function setFullVehicleRebuildFactory(fn) {
  _fullVehicleRebuildFactory = fn;
}

function getSharedNavalAirGlassMat() {
  if (!SHARED_NAVAL_AIR_GLASS_MAT) {
    SHARED_NAVAL_AIR_GLASS_MAT = markAsSharedAsset(
      getLegoMaterial(0x070b13, { roughness: 0.12, metalness: 0.5 })
    );
    SHARED_NAVAL_AIR_GLASS_MAT.userData = {
      ...SHARED_NAVAL_AIR_GLASS_MAT.userData,
      isVehicleGlass: true
    };
  }
  return SHARED_NAVAL_AIR_GLASS_MAT;
}

function getSharedTurboFlameGeo(xOffsets) {
  const key = xOffsets.join(',');
  let geo = SHARED_TURBO_FLAME_GEO_CACHE.get(key);
  if (!geo) {
    const coneGeos = [];
    for (const ex of xOffsets) {
      const g = new THREE.ConeGeometry(0.24, 1.45, 8);
      g.rotateX(-Math.PI / 2);
      g.translate(ex, 0, -0.58);
      coneGeos.push(g);
    }
    geo = markAsSharedAsset(mergeBufferGeometries(coneGeos));
    SHARED_TURBO_FLAME_GEO_CACHE.set(key, geo);
  }
  return geo;
}

/**
 * Retorna os parâmetros PBR de acabamento automotivo (fosco, perolado, cromado ou brilhante).
 */
export function getFinishMaterialOpts(finishStyle = 'glossy') {
  if (finishStyle === 'matte') {
    return { roughness: 0.72, metalness: 0.14, clearcoat: 0.04 };
  }
  if (finishStyle === 'pearl') {
    return { roughness: 0.18, metalness: 0.58, clearcoat: 0.76 };
  }
  if (finishStyle === 'chrome') {
    return { roughness: 0.08, metalness: 0.92, clearcoat: 0.94 };
  }
  return { roughness: 0.28, metalness: 0.26, clearcoat: 0.46 };
}

/**
 * Gera um volume chanfrado / cunha hard-surface (studless) sem faces coplanares:
 * permite afunilar topo vs base, inclinar capô/glacis frontal (frontDrop) e traseira (rearDrop).
 */
export function makeTaperedHullGeo(
  wBot,
  wTop,
  h,
  dBot,
  dTop,
  zShiftTop = 0,
  frontDrop = 0,
  rearDrop = 0
) {
  const base = new THREE.BoxGeometry(1, 1, 1);
  const pos = base.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i); // -0.5 ou +0.5
    const sy = pos.getY(i);
    const sz = pos.getZ(i);
    const isTop = sy > 0;
    const isFront = sz > 0;
    const x = sx * (isTop ? wTop : wBot);
    const z = sz * (isTop ? dTop : dBot) + (isTop ? zShiftTop : 0);
    let y = sy * h;
    if (isTop && isFront) y -= frontDrop;
    if (isTop && !isFront) y -= rearDrop;
    pos.setXYZ(i, x, y, z);
  }
  const geo = base.toNonIndexed();
  base.dispose();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Gera cabine / greenhouse trapezoidal com para-brisa inclinado (frontRake),
 * vigia traseira inclinada (rearRake) e laterais anguladas (tumblehome).
 */
export function makeRakedCabinGeo(wBot, wTop, h, dBot, zBotCenter, zTopFront, zTopRear) {
  const base = new THREE.BoxGeometry(1, 1, 1);
  const pos = base.attributes.position;
  const zBotFront = zBotCenter + dBot * 0.5;
  const zBotRear = zBotCenter - dBot * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i);
    const sy = pos.getY(i);
    const sz = pos.getZ(i);
    const isTop = sy > 0;
    const isFront = sz > 0;
    const x = sx * (isTop ? wTop : wBot);
    const y = (sy + 0.5) * h; // base em y=0, topo em y=h
    const z = isTop
      ? (isFront ? zTopFront : zTopRear)
      : (isFront ? zBotFront : zBotRear);
    pos.setXYZ(i, x, y, z);
  }
  const geo = base.toNonIndexed();
  base.dispose();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Clona um protótipo de veículo preservando geometrias/materiais compartilhados
 * e reconectando referências dinâmicas (rodas, chamas de turbo e torreta).
 */
export function cloneVehicleProto(proto) {
  const protoWheels = Array.isArray(proto.userData?.wheels) ? proto.userData.wheels : [];
  const protoFlameGroup = proto.userData?.turboFlames?.[0] || null;
  const protoFlameMesh = proto.userData?.turboFlameMesh || null;
  const protoTurret = proto.userData?.turretGroup || null;

  const srcToClone = new Map();
  const cloneNode = (src) => {
    let dst;
    if (src.isMesh) {
      dst = new THREE.Mesh(src.geometry, src.material);
    } else if (src.isGroup) {
      dst = new THREE.Group();
    } else {
      dst = new THREE.Object3D();
    }
    dst.name = src.name;
    dst.position.copy(src.position);
    dst.rotation.copy(src.rotation);
    dst.scale.copy(src.scale);
    dst.visible = src.visible;
    dst.castShadow = src.castShadow;
    dst.receiveShadow = src.receiveShadow;
    dst.matrixAutoUpdate = src.matrixAutoUpdate;
    if (!dst.matrixAutoUpdate) dst.matrix.copy(src.matrix);
    if (src.userData && Object.keys(src.userData).length > 0) {
      dst.userData = { ...src.userData };
      delete dst.userData.wheels;
      delete dst.userData.turboFlames;
      delete dst.userData.turboFlameMesh;
      delete dst.userData.turretGroup;
    }
    srcToClone.set(src, dst);
    for (let i = 0; i < src.children.length; i++) {
      dst.add(cloneNode(src.children[i]));
    }
    return dst;
  };

  const cloned = cloneNode(proto);
  if (protoWheels.length > 0) {
    cloned.userData.wheels = protoWheels.map((pw) => ({
      steerGroup: srcToClone.get(pw.steerGroup),
      spinGroup: srcToClone.get(pw.spinGroup),
      isFront: pw.isFront
    }));
  } else if (Array.isArray(proto.userData?.wheels)) {
    cloned.userData.wheels = [];
  }
  if (protoFlameGroup) {
    const cf = srcToClone.get(protoFlameGroup);
    cloned.userData.turboFlames = cf ? [cf] : [];
  } else if (Array.isArray(proto.userData?.turboFlames)) {
    cloned.userData.turboFlames = [];
  }
  if (protoFlameMesh) {
    cloned.userData.turboFlameMesh = srcToClone.get(protoFlameMesh) || null;
  }
  if (protoTurret) {
    cloned.userData.turretGroup = srcToClone.get(protoTurret) || null;
  }
  return cloned;
}

/**
 * Inicializa o grupo raiz e paleta de materiais PBR compartilhada da frota terrestre.
 */
export function createVehicleMaterialContext(cfg = {}) {
  const type = cfg.type || 'apex_gtx';
  const spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.apex_gtx;
  const group = new THREE.Group();
  const trafficLite = Boolean(cfg.trafficLite || cfg.finishStyle === 'traffic_lite');

  const bodyColor = cfg.color ?? 0xfacc15;
  const roofColor = cfg.roofColor ?? LEGO_COLORS.black;
  const finishOpts = getFinishMaterialOpts(cfg.finishStyle);
  const customWheelMat =
    cfg.wheelColor !== undefined
      ? getLegoMaterial(cfg.wheelColor, { metalness: 0.55, roughness: 0.18, clearcoat: 0.6 })
      : null;

  group.userData.carType = type;
  group.userData.initialColors = { color: bodyColor, roofColor };
  if (trafficLite) group.userData._trafficLite = true;

  const bodyMat = getLegoMaterial(bodyColor, finishOpts);
  const darkTrimMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.35 });
  const blackMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.4 });
  const whiteMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.25 });
  const tireMat = blackMat;
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.5, roughness: 0.2 });
  const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.5, roughness: 0.2 });
  const neonCyanMat = getLegoMaterial(0x06b6d4, { emissive: 0x06b6d4, emissiveIntensity: 0.9 });
  const neonPurpleMat = getLegoMaterial(0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 0.9 });
  const glassTintHex =
    type === 'suv_pcc' || type === 'van_pcc' || type === 'caveirao_bope' || type === 'carro_forte'
      ? 0x04060a
      : 0x070b13;
  const glassMat = getLegoMaterial(glassTintHex, {
    roughness: 0.08,
    metalness: 0.58,
    clearcoat: 0.88
  });
  if (!trafficLite) {
    glassMat.userData = { ...glassMat.userData, isVehicleGlass: true };
  }
  const headlightMat = trafficLite
    ? getLegoMaterial(0xfef3c7, { roughness: 0.2 })
    : getLegoMaterial(0xfef3c7, { emissive: 0xfde68a, emissiveIntensity: 1.05 });
  if (!trafficLite) {
    headlightMat.userData = { ...headlightMat.userData, isVehicleHeadlight: true };
  }
  const taillightMat = trafficLite
    ? getLegoMaterial(0xdc2626, { roughness: 0.25 })
    : getLegoMaterial(0x991b1b, { emissive: 0xdc2626, emissiveIntensity: 0.95 });
  const gunmetalTrimMat = getLegoMaterial(0x1e2430, { metalness: 0.48, roughness: 0.34 });

  return {
    type,
    spec,
    group,
    trafficLite,
    bodyColor,
    roofColor,
    finishOpts,
    customWheelMat,
    bodyMat,
    darkTrimMat,
    blackMat,
    whiteMat,
    tireMat,
    goldMat,
    silverMat,
    neonCyanMat,
    neonPurpleMat,
    glassMat,
    headlightMat,
    taillightMat,
    gunmetalTrimMat
  };
}

/**
 * Calcula dimensões e flags estruturais do chassi hard-surface studless ("Gotham Noir").
 */
export function computeHardSurfaceChassisDims(ctx) {
  const { type, roofColor, finishOpts } = ctx;
  const isHeavyTruck = type === 'caveirao_bope' || type === 'carro_forte' || type === 'van_pcc';
  const isSixWheelApc = type === 'hover_apc_ares';
  const isPickup = type === 'picape_cv' || type === 'choque_pickup';
  const isSuv = type === 'suv_pcc';
  const isSport =
    type === 'apex_gtx' ||
    type === 'cyber_blade' ||
    type === 'vortex_roadster' ||
    type === 'trovao_v8';
  const isWideHyper = type === 'apex_gtx' || type === 'cyber_blade';

  const chassisW = isHeavyTruck || isSixWheelApc ? 2.66 : isWideHyper ? 2.54 : isSuv || isPickup ? 2.44 : 2.36;
  const chassisH = isHeavyTruck ? 0.96 : isSixWheelApc ? 0.88 : isWideHyper ? 0.58 : isSport ? 0.64 : 0.72;
  const chassisD = isHeavyTruck || isSixWheelApc ? 5.64 : isPickup || isSuv ? 5.05 : 4.88;
  const chassisTopY = 0.42 + chassisH;
  const frontZ = chassisD * 0.5 + 0.04;
  const roofAccentMat = getLegoMaterial(roofColor, finishOpts);

  const hoodDrop = isWideHyper
    ? 0.26
    : isSport
      ? 0.18
      : isSixWheelApc
        ? 0.32
        : type === 'caveirao_bope'
          ? 0.22
          : 0.13;
  const rearDeckDrop = isWideHyper ? -0.05 : isPickup ? 0.02 : 0.05;

  return {
    isHeavyTruck,
    isSixWheelApc,
    isPickup,
    isSuv,
    isSport,
    isWideHyper,
    chassisW,
    chassisH,
    chassisD,
    chassisTopY,
    frontZ,
    hoodDrop,
    rearDeckDrop,
    roofAccentMat
  };
}

/**
 * Constrói assoalho, cunha principal studless, caixas de roda, para-choques,
 * escapamentos, faróis/lanternas e bancos/volante 3D.
 */
export function buildHardSurfaceChassisBase(group, ctx, dims) {
  const {
    type,
    bodyMat,
    darkTrimMat,
    blackMat,
    silverMat,
    headlightMat,
    taillightMat,
    gunmetalTrimMat
  } = ctx;
  const {
    isHeavyTruck,
    isSixWheelApc,
    isSuv,
    isSport,
    chassisW,
    chassisH,
    chassisD,
    chassisTopY,
    frontZ,
    hoodDrop,
    rearDeckDrop
  } = dims;

  // 1. Assoalho / Saia Inferior Aerodinâmica + Cunha Esculpida da Carroceria Principal (Zero Studs!)
  const undertray = new THREE.Mesh(
    makeTaperedHullGeo(chassisW - 0.14, chassisW + 0.02, 0.22, chassisD - 0.16, chassisD, 0, 0, 0),
    darkTrimMat
  );
  undertray.position.set(0, 0.42, 0);
  group.add(undertray);

  const mainBody = new THREE.Mesh(
    makeTaperedHullGeo(
      chassisW + 0.02,
      chassisW - (isSport ? 0.16 : 0.08),
      chassisH,
      chassisD,
      chassisD - (isSixWheelApc ? 0.42 : 0.18),
      isSport ? -0.08 : -0.03,
      hoodDrop,
      rearDeckDrop
    ),
    bodyMat
  );
  mainBody.position.set(0, 0.42 + chassisH * 0.5, 0);
  group.add(mainBody);

  // 2. Para-lamas Musculosos nas Caixas de Roda (Flared Wheel Arches) + Saias Laterais
  const wheelZList = isSixWheelApc ? [1.75, 0, -1.75] : [chassisD * 0.31, -chassisD * 0.31];
  for (const wz of wheelZList) {
    for (const sx of [-1, 1]) {
      const flare = new THREE.Mesh(
        makeTaperedHullGeo(0.16, 0.08, 0.34, 1.24, 0.92, 0, 0.04, 0.04),
        isHeavyTruck || isSixWheelApc || isSuv ? gunmetalTrimMat : bodyMat
      );
      flare.position.set(sx * (chassisW * 0.5 + 0.03), 0.68, wz);
      group.add(flare);
    }
  }
  if (!isSixWheelApc) {
    for (const sx of [-1, 1]) {
      const sideSkirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.14, chassisD * 0.44),
        gunmetalTrimMat
      );
      sideSkirt.position.set(sx * (chassisW * 0.5 + 0.01), 0.44, 0);
      group.add(sideSkirt);
    }
  }

  // 3. Splitter Frontal / Para-choques Chanfrados + Grade Escura + Difusor Traseiro + Escapamentos
  const fSplitter = new THREE.Mesh(
    makeTaperedHullGeo(chassisW + 0.08, chassisW - 0.04, 0.24, 0.44, 0.28, -0.06, 0.06, 0),
    gunmetalTrimMat
  );
  fSplitter.position.set(0, 0.42, frontZ + 0.02);
  const rDiffuser = new THREE.Mesh(
    makeTaperedHullGeo(chassisW + 0.06, chassisW - 0.04, 0.28, 0.38, 0.26, 0.05, 0, 0.06),
    gunmetalTrimMat
  );
  rDiffuser.position.set(0, 0.44, -frontZ - 0.01);
  const frontGrille = new THREE.Mesh(
    new THREE.BoxGeometry(chassisW * (isSport ? 0.58 : 0.52), isSport ? 0.22 : 0.34, 0.1),
    blackMat
  );
  frontGrille.position.set(0, isSport ? 0.58 : 0.68, frontZ + 0.01);
  group.add(fSplitter, rDiffuser, frontGrille);

  for (const ex of isSport ? [-0.68, -0.48, 0.48, 0.68] : [-0.62, 0.62]) {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.24, 10), silverMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(ex, 0.42, -frontZ - 0.12);
    group.add(exhaust);
  }

  // 4. Faróis Agressivos em Fenda Angular (LED Slits) + Barra/Lanternas Traseiras Carmesim
  const lightOffsetX = chassisW * 0.35;
  const hlY = 0.42 + chassisH - hoodDrop - 0.04;
  for (const lx of [-lightOffsetX, lightOffsetX]) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(isSport ? 0.54 : 0.46, isSport ? 0.13 : 0.19, 0.14),
      headlightMat
    );
    hl.rotation.z = (lx > 0 ? -1 : 1) * (isSport ? 0.16 : 0.08);
    hl.rotation.y = (lx > 0 ? -1 : 1) * 0.12;
    hl.position.set(lx, hlY, frontZ - 0.04);
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, isSport ? 0.14 : 0.2, 0.12),
      taillightMat
    );
    tl.position.set(lx, chassisTopY - 0.14, -frontZ + 0.02);
    group.add(hl, tl);
  }
  if (isSport || type === 'suv_pcc' || type === 'interceptor_v8') {
    const rearLightBar = new THREE.Mesh(
      new THREE.BoxGeometry(chassisW - 0.26, 0.07, 0.1),
      taillightMat
    );
    rearLightBar.position.set(0, chassisTopY - 0.12, -frontZ + 0.03);
    group.add(rearLightBar);
  }

  // 5. Bancos Internos + Volante Tático 3D
  const seatMat = type === 'vortex_roadster' ? darkTrimMat : blackMat;
  const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.62), seatMat);
  driverSeat.position.set(-0.42, 1.02, -0.15);
  const passSeat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.62), seatMat);
  passSeat.position.set(0.42, 1.02, -0.15);
  const steeringWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.07, 12), blackMat);
  steeringWheel.rotation.x = Math.PI / 3;
  steeringWheel.position.set(-0.42, 1.15, 0.52);
  group.add(driverSeat, passSeat, steeringWheel);
}

/**
 * Constrói greenhouse trapezoidal fumê com colunas A/C inclinadas, teto studless
 * e caçamba/santo-antônio quando picape.
 */
export function buildStandardRakedCabin(group, ctx, dims) {
  const { bodyMat, glassMat, gunmetalTrimMat } = ctx;
  const {
    isPickup,
    isSuv,
    isSport,
    isWideHyper,
    chassisW,
    chassisTopY,
    roofAccentMat
  } = dims;

  const cabinWBot = chassisW - 0.24;
  const cabinWTop = cabinWBot - (isSport ? 0.38 : 0.26);
  const cabinH = isSuv ? 0.74 : isPickup ? 0.72 : isWideHyper ? 0.54 : isSport ? 0.58 : 0.66;
  const cabinDBot = isSuv ? 2.95 : isPickup ? 2.15 : isSport ? 2.48 : 2.52;
  const cabinZ = isSuv ? -0.32 : isPickup ? 0.36 : isSport ? -0.18 : -0.14;
  const frontRake = isWideHyper ? 0.78 : isSport ? 0.68 : 0.54;
  const rearRake = isPickup ? 0.16 : isSuv ? 0.36 : isWideHyper ? 0.88 : isSport ? 0.74 : 0.52;
  const zTopFront = cabinZ + cabinDBot * 0.5 - frontRake;
  const zTopRear = cabinZ - cabinDBot * 0.5 + rearRake;
  const topD = Math.max(0.85, zTopFront - zTopRear);
  const topZCenter = (zTopFront + zTopRear) * 0.5;

  const cabinGlass = new THREE.Mesh(
    makeRakedCabinGeo(cabinWBot, cabinWTop, cabinH, cabinDBot, cabinZ, zTopFront, zTopRear),
    glassMat
  );
  cabinGlass.position.set(0, chassisTopY - 0.01, 0);
  group.add(cabinGlass);

  // Colunas A e C inclinadas em metal/cor do teto para silhueta automotiva real
  for (const sx of [-1, 1]) {
    const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, cabinH * 1.12, 0.1), roofAccentMat);
    aPillar.rotation.x = -Math.atan2(frontRake, cabinH);
    aPillar.rotation.z = sx * 0.16;
    aPillar.position.set(
      sx * ((cabinWBot + cabinWTop) * 0.25 - 0.02),
      chassisTopY + cabinH * 0.48,
      (cabinZ + cabinDBot * 0.5 + zTopFront) * 0.5
    );
    const cPillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, cabinH * 1.12, isSport ? 0.22 : 0.16),
      roofAccentMat
    );
    cPillar.rotation.x = Math.atan2(rearRake, cabinH);
    cPillar.rotation.z = sx * 0.16;
    cPillar.position.set(
      sx * ((cabinWBot + cabinWTop) * 0.25 - 0.02),
      chassisTopY + cabinH * 0.48,
      (cabinZ - cabinDBot * 0.5 + zTopRear) * 0.5
    );
    group.add(aPillar, cPillar);
  }

  const roofY = chassisTopY + cabinH + 0.04;
  const roofPlate = new THREE.Mesh(
    makeTaperedHullGeo(cabinWTop + 0.06, cabinWTop - 0.04, 0.1, topD + 0.08, topD - 0.04, 0, 0.02, 0.02),
    roofAccentMat
  );
  roofPlate.position.set(0, roofY, topZCenter);
  group.add(roofPlate);
  group.userData._roofMeta = { roofY, cabinW: cabinWTop, cabinD: topD, cabinZ: topZCenter };

  // Caçamba esculpida nas Picapes (paredes laterais + santo-antônio tático)
  if (isPickup) {
    for (const sx of [-1, 1]) {
      const bedWall = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 1.65), bodyMat);
      bedWall.position.set(sx * (chassisW * 0.5 - 0.1), chassisTopY + 0.1, -1.55);
      const rollBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), gunmetalTrimMat);
      rollBar.rotation.x = 0.52;
      rollBar.position.set(sx * (chassisW * 0.38), chassisTopY + 0.34, -0.98);
      group.add(bedWall, rollBar);
    }
  }
}

/**
 * Constrói cabine e baú/cofre blindado chanfrado studless compartilhado por Carro-Forte e Van PCC.
 */
export function buildVaultBoxCabin(group, ctx, dims) {
  const { bodyMat, glassMat } = ctx;
  const { chassisW, chassisTopY, roofAccentMat } = dims;

  const cabinW = chassisW - 0.16;
  const cabinH = 1.04;
  const cabinD = 4.25;
  const cabinZ = -0.42;
  const vaultBody = new THREE.Mesh(
    makeRakedCabinGeo(
      cabinW,
      cabinW - 0.24,
      cabinH,
      cabinD,
      cabinZ,
      cabinZ + cabinD * 0.5 - 0.46,
      cabinZ - cabinD * 0.5 + 0.12
    ),
    bodyMat
  );
  vaultBody.position.set(0, chassisTopY - 0.02, 0);
  const frontVisor = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.38, 0.42, 0.14), glassMat);
  frontVisor.rotation.x = -0.4;
  frontVisor.position.set(0, chassisTopY + 0.56, cabinZ + cabinD * 0.5 - 0.22);
  const sideCabGlass = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.08, 0.4, 0.92), glassMat);
  sideCabGlass.position.set(0, chassisTopY + 0.56, cabinZ + cabinD * 0.5 - 0.78);
  group.add(vaultBody, frontVisor, sideCabGlass);

  const roofY = chassisTopY + cabinH + 0.05;
  const roofPlate = new THREE.Mesh(
    makeTaperedHullGeo(cabinW - 0.22, cabinW - 0.34, 0.12, cabinD - 0.62, cabinD - 0.8, -0.16, 0, 0),
    roofAccentMat
  );
  roofPlate.position.set(0, roofY, cabinZ);
  group.add(roofPlate);
  group.userData._roofMeta = { roofY, cabinW: cabinW - 0.22, cabinD: cabinD - 0.62, cabinZ };
}

/**
 * Monta rodas cilíndricas mescladas studless (4 ou 6 rodas), chassisDims e chamas de nitro.
 */
export function attachStandardWheelsAndFinalize(group, ctx, dims) {
  const {
    type,
    spec,
    trafficLite,
    customWheelMat,
    tireMat,
    goldMat,
    silverMat,
    neonCyanMat,
    gunmetalTrimMat
  } = ctx;
  const {
    isHeavyTruck,
    isSixWheelApc,
    chassisW,
    chassisH,
    chassisD,
    chassisTopY,
    frontZ
  } = dims;

  const wheelX = chassisW * 0.5;
  const wheelRadius = isHeavyTruck || type === 'buggy_praia' ? 0.52 : 0.44;
  const zPositions = isSixWheelApc ? [1.75, 0, -1.75] : [chassisD * 0.31, -chassisD * 0.31];
  const hubMat =
    customWheelMat ||
    (type === 'cyber_blade'
      ? neonCyanMat
      : type === 'apex_gtx' || type === 'carro_forte'
        ? goldMat
        : isHeavyTruck || type === 'suv_pcc'
          ? gunmetalTrimMat
          : silverMat);

  const wheelGeoKey = `${wheelRadius}|${tireMat.color.getHex()}|${hubMat.color.getHex()}`;
  let wheelGeo = SHARED_WHEEL_VC_GEO_CACHE.get(wheelGeoKey);
  if (!wheelGeo) {
    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.42, 16);
    tireGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(wheelRadius * 0.6, wheelRadius * 0.6, 0.44, 12);
    hubGeo.rotateZ(Math.PI / 2);
    wheelGeo = markAsSharedAsset(
      mergeColoredGeometries([
        { geo: tireGeo, color: tireMat.color },
        { geo: hubGeo, color: hubMat.color }
      ])
    );
    SHARED_WHEEL_VC_GEO_CACHE.set(wheelGeoKey, wheelGeo);
  }

  const hubIsEmissive = Boolean(
    hubMat.emissive && hubMat.emissive.getHex() !== 0 && (hubMat.emissiveIntensity ?? 0) > 0
  );
  const wheelMat =
    !customWheelMat && !hubIsEmissive
      ? SHARED_WHEEL_VC_MAT
      : getSharedVertexColorMaterial({
          roughness: customWheelMat ? (customWheelMat.roughness ?? 0.24) : 0.32,
          metalness: customWheelMat ? Math.min(0.45, customWheelMat.metalness ?? 0.25) : 0.28,
          clearcoat: customWheelMat ? (customWheelMat.clearcoat ?? 0.45) : 0.28,
          emissive: hubIsEmissive ? hubMat.emissive : 0x000000,
          emissiveIntensity: hubIsEmissive ? 0.3 : 0
        });

  if (trafficLite || group.userData?._trafficLite) {
    for (const wz of zPositions) {
      for (const wx of [-wheelX, wheelX]) {
        const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
        wheelMesh.position.set(wx, wheelRadius, wz);
        group.add(wheelMesh);
      }
    }
    group.userData._deferredWheelSpec = {
      wheelX,
      wheelRadius,
      zPositions: [...zPositions],
      wheelGeo,
      wheelMat
    };
    group.userData.wheels = [];
  } else {
    const wheels = [];
    for (const wz of zPositions) {
      for (const wx of [-wheelX, wheelX]) {
        const steerGroup = new THREE.Group();
        steerGroup.position.set(wx, wheelRadius, wz);
        const spinGroup = new THREE.Group();
        const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
        spinGroup.add(wheelMesh);
        steerGroup.add(spinGroup);
        group.add(steerGroup);
        wheels.push({ steerGroup, spinGroup, isFront: wz > 0.5 });
      }
    }
    group.userData.wheels = wheels;
  }

  const rm = group.userData._roofMeta;
  group.userData.chassisDims = {
    w: chassisW,
    h: chassisH,
    d: chassisD,
    topY: chassisTopY,
    roofY: rm ? rm.roofY + 0.06 : chassisTopY,
    cabinW: rm ? rm.cabinW : chassisW - 0.3,
    cabinD: rm ? rm.cabinD : 2.1,
    cabinZ: rm ? rm.cabinZ : -0.1,
    frontZ,
    openTop: Boolean(spec.openTop),
    isMoto: false,
    wheelRadius
  };

  attachTurboFlames(group, [-0.55, 0.55], 0.46, -frontZ - 0.25);
}

/**
 * Adiciona barra de giroflex policial low-profile (vermelho/azul emissivo).
 */
export function addPoliceLightbar(group, y, z) {
  const baseBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.56, 0.08, 0.28),
    getLegoMaterial(0x111827, { roughness: 0.4, metalness: 0.5 })
  );
  baseBar.position.set(0, y - 0.06, z);
  const redLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.14, 0.24),
    getLegoMaterial(0x991b1b, { emissive: 0xdc2626, emissiveIntensity: 1.0 })
  );
  redLight.position.set(-0.38, y + 0.02, z);
  const blueLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.14, 0.24),
    getLegoMaterial(0x1d4ed8, { emissive: 0x2563eb, emissiveIntensity: 1.0 })
  );
  blueLight.position.set(0.38, y + 0.02, z);
  group.add(baseBar, redLight, blueLight);
}

/**
 * Acopla chamas de nitro traseiras e otimiza malhas estáticas preservando grupos móveis.
 */
export function attachTurboFlames(group, xOffsets, y, z) {
  if (group.userData?._trafficLite) {
    // Caso o construtor (ex.: buildUrbanBusMesh) tenha criado steerGroups antes, permite mesclá-los no chassi estático!
    if (Array.isArray(group.userData.wheels) && group.userData.wheels.length > 0 && !group.userData._deferredWheelSpec) {
      const sampleMesh = group.userData.wheels[0]?.spinGroup?.children?.[0] || null;
      group.userData._deferredWheelSpec = {
        wheelX: Math.abs(group.userData.wheels[0]?.steerGroup?.position?.x || 1.3),
        wheelRadius: group.userData.chassisDims?.wheelRadius ?? 0.52,
        zPositions: Array.from(new Set(group.userData.wheels.map((w) => w.steerGroup.position.z))),
        wheelGeo: sampleMesh?.geometry || null,
        wheelMat: sampleMesh?.material || null
      };
      group.userData.wheels = [];
    }
    group.userData._deferredFlameSpec = { xOffsets: [...xOffsets], y, z };
    group.userData.turboFlames = [];
    group.userData.turboFlameMesh = null;
    optimizeStaticGroupMeshes(group, [group.userData.turretGroup]);
    return;
  }

  const fGroup = new THREE.Group();
  fGroup.position.set(0, y, z);
  fGroup.visible = false;
  fGroup.userData.isNitroFlame = true;

  const flameMesh = new THREE.Mesh(getSharedTurboFlameGeo(xOffsets), SHARED_FLAME_MAT);
  flameMesh.userData.isNitroFlame = true;
  fGroup.add(flameMesh);
  group.add(fGroup);

  group.userData.turboFlames = [fGroup];
  group.userData.turboFlameMesh = flameMesh;
  const wheelSteerGroups = Array.isArray(group.userData.wheels)
    ? group.userData.wheels.map((w) => w.steerGroup)
    : [];
  optimizeStaticGroupMeshes(group, [
    fGroup,
    group.userData.turretGroup,
    ...wheelSteerGroups
  ]);
}

/**
 * Promove sob demanda um carro `trafficLite` caso o jogador entre nele ou faça carjacking.
 */
export function upgradeTrafficLiteCarIfNeeded(group) {
  if (!group?.userData?._trafficLite) return group;

  if (typeof group.userData._customTrafficLiteUpgrade === 'function') {
    group.userData._customTrafficLiteUpgrade(group);
    group.userData._trafficLite = false;
    return group;
  }

  if (_fullVehicleRebuildFactory && group.userData.carType) {
    const occupants = group.userData._occupantsGroup || null;
    const modGroup = group.getObjectByName?.('lego_customs_mod_group') || null;
    const brakeLights = group.userData._trafficBrakeLights || null;
    const initCols = group.userData.initialColors || {};
    const rebuildCfg = {
      ...(group.userData._fullRebuildCfg || {}),
      type: group.userData.carType,
      color: group.userData._fullRebuildCfg?.color ?? initCols.color,
      roofColor: group.userData._fullRebuildCfg?.roofColor ?? initCols.roofColor,
      trafficLite: false
    };

    const keepSet = new Set([occupants, modGroup, brakeLights].filter(Boolean));
    for (let i = group.children.length - 1; i >= 0; i--) {
      const ch = group.children[i];
      if (!keepSet.has(ch)) group.remove(ch);
    }

    const full = _fullVehicleRebuildFactory(rebuildCfg);
    while (full.children.length > 0) {
      const ch = full.children[0];
      full.remove(ch);
      group.add(ch);
    }
    group.userData.wheels = full.userData.wheels || [];
    group.userData.turretGroup = full.userData.turretGroup || null;
    group.userData.turboFlames = full.userData.turboFlames || [];
    group.userData.turboFlameMesh = full.userData.turboFlameMesh || null;
    group.userData.chassisDims = full.userData.chassisDims || group.userData.chassisDims;
    group.userData._trafficLite = false;
    group.matrixAutoUpdate = true;
    group.matrixWorldAutoUpdate = true;
    return group;
  }

  const df = group.userData._deferredFlameSpec;
  if (df && (!Array.isArray(group.userData.turboFlames) || group.userData.turboFlames.length === 0)) {
    const fGroup = new THREE.Group();
    fGroup.position.set(0, df.y, df.z);
    fGroup.visible = false;
    fGroup.userData.isNitroFlame = true;
    const flameMesh = new THREE.Mesh(getSharedTurboFlameGeo(df.xOffsets), SHARED_FLAME_MAT);
    flameMesh.castShadow = false;
    flameMesh.userData.isNitroFlame = true;
    fGroup.add(flameMesh);
    group.add(fGroup);
    group.userData.turboFlames = [fGroup];
    group.userData.turboFlameMesh = flameMesh;
  }
  group.userData._trafficLite = false;
  return group;
}

/**
 * Acopla cones de pós-combustão / turbo aquático e aéreo em embarcações e aeronaves.
 */
export function attachExhaustFlames(group, positions, scale = 1.0) {
  const fGroup = new THREE.Group();
  fGroup.visible = false;
  const key = `${scale}|${positions.map((p) => p.join(',')).join(';')}`;
  let geo = SHARED_EXHAUST_FLAME_GEO_CACHE.get(key);
  if (!geo) {
    const coneGeos = [];
    for (const [ex, ey, ez] of positions) {
      const g = new THREE.ConeGeometry(0.32 * scale, 2.2 * scale, 8);
      g.rotateX(-Math.PI / 2);
      g.translate(ex, ey, ez - 0.95 * scale);
      coneGeos.push(g);
    }
    geo = markAsSharedAsset(mergeBufferGeometries(coneGeos));
    SHARED_EXHAUST_FLAME_GEO_CACHE.set(key, geo);
  }
  fGroup.add(new THREE.Mesh(geo, SHARED_AFTERBURNER_MAT));
  group.add(fGroup);
  group.userData.turboFlames = [fGroup];
}

/**
 * Cria o grupo raiz com rotação YXZ e paleta de materiais compartilhada para barcos e aeronaves.
 */
export function createNavalAirMaterialContext(cfg = {}) {
  const type = cfg.type;
  const bodyColor = cfg.color ?? 0x0ea5e9;
  const accentColor = cfg.roofColor ?? LEGO_COLORS.white;

  const group = new THREE.Group();
  group.rotation.order = 'YXZ';

  const bodyFinish = getFinishMaterialOpts(cfg.finishStyle || 'glossy');
  const bodyMat = getLegoMaterial(bodyColor, bodyFinish);
  const whiteMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.22, clearcoat: 0.5 });
  const blackMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.38 });
  const darkMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.34 });
  const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.55, roughness: 0.2 });
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.6, roughness: 0.18 });
  const orangeMat = getLegoMaterial(LEGO_COLORS.orange, { roughness: 0.25 });
  const redMat = getLegoMaterial(LEGO_COLORS.red, { emissive: 0xdc2626, emissiveIntensity: 0.5 });
  const glassMat = getSharedNavalAirGlassMat();

  return {
    type,
    bodyColor,
    accentColor,
    group,
    bodyFinish,
    bodyMat,
    whiteMat,
    blackMat,
    darkMat,
    silverMat,
    goldMat,
    orangeMat,
    redMat,
    glassMat
  };
}
