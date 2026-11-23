/**
 * CivilianAndSportsCarsBuilder.js
 * Construção 3D de superesportivos, muscle cars, conversíveis, sedans, táxis, buggies,
 * carros-fortes, ônibus urbanos e posicionamento da frota estacionada nas 10 regiões.
 */

import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../../materials/LegoMaterials.js';
import {
  mergeColoredGeometries,
  getSharedVertexColorMaterial,
  markAsSharedAsset
} from '../BuildingGenerator.js';
import { VEHICLE_SPECS } from './VehicleSpecsCatalog.js';
import { IS_SCALED_WORLD, ws } from '../core/WorldLayoutScale.js';
import {
  makeTaperedHullGeo,
  makeRakedCabinGeo,
  computeHardSurfaceChassisDims,
  buildHardSurfaceChassisBase,
  buildStandardRakedCabin,
  buildVaultBoxCabin,
  attachStandardWheelsAndFinalize,
  attachTurboFlames
} from './VehicleChassisPrimitives.js';

let _defaultCarMeshFactory = null;

/**
 * Registra o dispatcher principal de malhas de veículos para uso direto em buildParkedLegoCars.
 */
export function setDefaultCarMeshFactory(fn) {
  _defaultCarMeshFactory = fn;
}

/**
 * Constrói o Ônibus Metropolitano sombrio (frente aerodinâmica, galeria fumê e 6 rodas).
 */
export function buildUrbanBusMesh(group, ctx) {
  const {
    roofColor,
    bodyMat,
    blackMat,
    tireMat,
    glassMat,
    headlightMat,
    taillightMat,
    gunmetalTrimMat
  } = ctx;

  const busW = 2.82;
  const busD = 8.4;
  const lowerH = 1.05;
  const upperH = 1.18;
  const accentMat = getLegoMaterial(roofColor, { roughness: 0.34, metalness: 0.24, clearcoat: 0.38 });
  const ledSignMat = getLegoMaterial(0xd97706, { emissive: 0xd97706, emissiveIntensity: 1.15 });

  // Saia inferior chanfrada + faixa metálica central studless
  const lowerHull = new THREE.Mesh(
    makeTaperedHullGeo(busW - 0.06, busW, lowerH, busD - 0.12, busD, 0, 0.06, 0.03),
    bodyMat
  );
  lowerHull.position.set(0, 0.44 + lowerH * 0.5, 0);
  const midBelt = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.04, 0.18, busD + 0.02), accentMat);
  midBelt.position.set(0, 0.44 + lowerH + 0.05, 0);
  group.add(lowerHull, midBelt);

  // Galeria panorâmica de vidro fumê com para-brisa frontal inclinado!
  const winBaseY = 0.44 + lowerH + 0.14;
  const panoramicGlass = new THREE.Mesh(
    makeRakedCabinGeo(
      busW - 0.12,
      busW - 0.22,
      upperH,
      busD - 0.18,
      0,
      busD * 0.5 - 0.36,
      -busD * 0.5 + 0.16
    ),
    glassMat
  );
  panoramicGlass.position.set(0, winBaseY, 0);
  group.add(panoramicGlass);

  for (const pz of [-3.9, -2.5, -1.05, 0.4, 1.85, 3.25]) {
    for (const px of [-busW * 0.485, busW * 0.485]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.09, upperH, 0.2), gunmetalTrimMat);
      pillar.position.set(px, winBaseY + upperH * 0.5, pz);
      group.add(pillar);
    }
  }

  // Teto aerodinâmico studless + 2 módulos HVAC low-profile chanfrados
  const roofY = winBaseY + upperH + 0.09;
  const busRoof = new THREE.Mesh(
    makeTaperedHullGeo(busW - 0.16, busW - 0.34, 0.2, busD - 0.38, busD - 0.72, -0.08, 0.05, 0.04),
    accentMat
  );
  busRoof.position.set(0, roofY, -0.05);
  const acFront = new THREE.Mesh(
    makeTaperedHullGeo(1.68, 1.42, 0.22, 1.85, 1.52, -0.04, 0.06, 0.04),
    gunmetalTrimMat
  );
  acFront.position.set(0, roofY + 0.2, 1.55);
  const acRear = new THREE.Mesh(
    makeTaperedHullGeo(1.68, 1.42, 0.22, 1.85, 1.52, -0.04, 0.06, 0.04),
    gunmetalTrimMat
  );
  acRear.position.set(0, roofY + 0.2, -1.8);
  group.add(busRoof, acFront, acRear);

  // Letreiro Âmbar + Grade Escura Frontal + Para-choques + Faróis Slim LED
  const destBoard = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.24, 0.1), ledSignMat);
  destBoard.rotation.x = -0.18;
  destBoard.position.set(0, roofY - 0.26, busD * 0.5 - 0.24);
  const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.44, 0.1), blackMat);
  frontGrille.position.set(0, 0.86, busD * 0.5 + 0.02);
  const fBumper = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.08, 0.32, 0.34), gunmetalTrimMat);
  fBumper.position.set(0, 0.48, busD * 0.5 + 0.05);
  const rBumper = new THREE.Mesh(new THREE.BoxGeometry(busW + 0.08, 0.34, 0.34), gunmetalTrimMat);
  rBumper.position.set(0, 0.48, -busD * 0.5 - 0.05);
  group.add(destBoard, frontGrille, fBumper, rBumper);

  for (const lx of [-1.06, 1.06]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.12), headlightMat);
    hl.rotation.z = lx > 0 ? -0.1 : 0.1;
    hl.position.set(lx, 0.88, busD * 0.5 + 0.04);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.12), taillightMat);
    tl.position.set(lx, 0.94, -busD * 0.5 - 0.04);
    group.add(hl, tl);
  }

  // 6 Rodas Pesadas
  const busTireG = new THREE.CylinderGeometry(0.52, 0.52, 0.42, 16);
  busTireG.rotateZ(Math.PI / 2);
  const busHubG = new THREE.CylinderGeometry(0.3, 0.3, 0.44, 12);
  busHubG.rotateZ(Math.PI / 2);
  const busWheelGeo = markAsSharedAsset(
    mergeColoredGeometries([
      { geo: busTireG, color: tireMat.color },
      { geo: busHubG, color: gunmetalTrimMat.color }
    ])
  );
  const busWheelMat = getSharedVertexColorMaterial({
    roughness: 0.34,
    metalness: 0.28,
    clearcoat: 0.24,
    clearcoatRoughness: 0.28
  });
  const wheels = [];
  for (const wz of [2.65, -1.85, -3.05]) {
    for (const wx of [-busW * 0.49, busW * 0.49]) {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wx, 0.52, wz);
      const spinGroup = new THREE.Group();
      const wheelMesh = new THREE.Mesh(busWheelGeo, busWheelMat);
      spinGroup.add(wheelMesh);
      steerGroup.add(spinGroup);
      group.add(steerGroup);
      wheels.push({ steerGroup, spinGroup, isFront: wz > 1.0 });
    }
  }
  group.userData.wheels = wheels;
  group.userData.chassisDims = {
    w: busW,
    h: lowerH + upperH + 0.16,
    d: busD,
    topY: roofY,
    roofY: roofY + 0.11,
    cabinW: busW - 0.14,
    cabinD: busD - 0.3,
    cabinZ: 0,
    frontZ: busD * 0.5 + 0.06,
    openTop: false,
    isMoto: false,
    isBus: true,
    wheelRadius: 0.52
  };
  attachTurboFlames(group, [-0.75, 0.75], 0.52, -busD * 0.5 - 0.24);
  return group;
}

/**
 * Constrói cabine aberta para conversíveis esportivos (Vortex Roadster) e Buggy de Praia.
 */
export function buildOpenTopCabin(group, ctx, dims) {
  const { type, roofColor, glassMat, gunmetalTrimMat } = ctx;
  const { chassisW, chassisTopY } = dims;

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(chassisW - 0.34, 0.5, 0.1), glassMat);
  windshield.rotation.x = -0.52;
  windshield.position.set(0, chassisTopY + 0.2, 0.78);
  const wsFrameTop = new THREE.Mesh(new THREE.BoxGeometry(chassisW - 0.3, 0.06, 0.12), gunmetalTrimMat);
  wsFrameTop.rotation.x = -0.52;
  wsFrameTop.position.set(0, chassisTopY + 0.42, 0.64);
  group.add(windshield, wsFrameTop);

  for (const sx of [-0.52, 0.52]) {
    const rollHoop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.1), gunmetalTrimMat);
    rollHoop.rotation.x = -0.2;
    rollHoop.position.set(sx, chassisTopY + 0.13, -0.62);
    group.add(rollHoop);
  }

  if (type === 'buggy_praia') {
    const cageMat = getLegoMaterial(roofColor ?? 0xd97706, { roughness: 0.38, metalness: 0.35 });
    for (const cx of [-0.9, 0.9]) {
      const frontCage = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.92, 8), cageMat);
      frontCage.rotation.x = -0.46;
      frontCage.position.set(cx, chassisTopY + 0.38, 0.55);
      const topCage = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.45, 8), cageMat);
      topCage.rotation.x = Math.PI / 2;
      topCage.position.set(cx, chassisTopY + 0.76, -0.35);
      const rearCage = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.15, 8), cageMat);
      rearCage.rotation.x = 0.58;
      rearCage.position.set(cx, chassisTopY + 0.4, -1.35);
      group.add(frontCage, topCage, rearCage);
    }
  }
}

/**
 * Aplica aerofólios, superchargers, neons, letreiro de táxi e faixas douradas de carro-forte.
 */
export function applyCivilianAndSportsDetails(group, cfg, ctx, dims) {
  const {
    type,
    bodyMat,
    blackMat,
    goldMat,
    silverMat,
    neonCyanMat,
    neonPurpleMat,
    gunmetalTrimMat
  } = ctx;
  const { chassisW, chassisD, chassisTopY, hoodDrop } = dims;

  if (type === 'apex_gtx' && !cfg.suppressDefaultSpoiler) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 1.65), blackMat);
    stripe.rotation.x = Math.atan2(hoodDrop, chassisD * 0.5) * 0.65;
    stripe.position.set(0, chassisTopY - 0.08, 1.35);
    const wingBlade = new THREE.Mesh(
      makeTaperedHullGeo(2.52, 2.58, 0.09, 0.52, 0.42, -0.04, 0.04, 0),
      gunmetalTrimMat
    );
    wingBlade.position.set(0, chassisTopY + 0.48, -2.18);
    for (const sx of [-1, 1]) {
      const wingPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 0.28), blackMat);
      wingPost.rotation.x = 0.22;
      wingPost.position.set(sx * 0.78, chassisTopY + 0.24, -2.12);
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.56), bodyMat);
      endplate.position.set(sx * 1.28, chassisTopY + 0.48, -2.18);
      group.add(wingPost, endplate);
    }
    group.add(stripe, wingBlade);
  } else if (type === 'trovao_v8') {
    const blower = new THREE.Mesh(
      makeTaperedHullGeo(0.84, 0.72, 0.32, 0.96, 0.82, -0.04, 0.05, 0.02),
      gunmetalTrimMat
    );
    blower.position.set(0, chassisTopY + 0.1, 1.42);
    const scoop = new THREE.Mesh(
      makeTaperedHullGeo(0.68, 0.58, 0.2, 0.68, 0.52, -0.06, 0, 0.05),
      silverMat
    );
    scoop.position.set(0, chassisTopY + 0.32, 1.48);
    const ducktail = new THREE.Mesh(
      makeTaperedHullGeo(chassisW - 0.16, chassisW - 0.24, 0.16, 0.28, 0.18, -0.04, 0.08, 0),
      blackMat
    );
    ducktail.position.set(0, chassisTopY + 0.05, -2.28);
    group.add(blower, scoop, ducktail);
  } else if (type === 'cyber_blade') {
    for (const nx of [-chassisW * 0.51, chassisW * 0.51]) {
      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, chassisD - 0.4), neonCyanMat);
      neonStrip.position.set(nx, 0.52, 0);
      group.add(neonStrip);
    }
    const rearNeon = new THREE.Mesh(new THREE.BoxGeometry(chassisW - 0.12, 0.1, 0.1), neonPurpleMat);
    rearNeon.position.set(0, chassisTopY + 0.22, -2.28);
    group.add(rearNeon);
  } else if (type === 'taxi_metro') {
    const signY = group.userData._roofMeta ? group.userData._roofMeta.roofY + 0.14 : 1.92;
    const taxiGlowMat = getLegoMaterial(0xd97706, { emissive: 0xb45309, emissiveIntensity: 0.85 });
    const sign = new THREE.Mesh(
      makeTaperedHullGeo(0.86, 0.68, 0.22, 0.38, 0.28, 0, 0.04, 0.04),
      taxiGlowMat
    );
    sign.position.set(0, signY, -0.14);
    group.add(sign);
  } else if (type === 'carro_forte') {
    for (const sx of [-1.24, 1.24]) {
      const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 4.15), goldMat);
      goldStripe.position.set(sx, 1.62, -0.42);
      group.add(goldStripe);
    }
  }
}

/**
 * Monta qualquer veículo civil, esportivo, muscle, táxi, buggy, carro-forte ou ônibus urbano.
 */
export function buildCivilianOrSportsCarMesh(cfg, ctx) {
  const { type, spec, group } = ctx;

  if (type === 'onibus_urbano') {
    return buildUrbanBusMesh(group, ctx);
  }

  const dims = computeHardSurfaceChassisDims(ctx);
  buildHardSurfaceChassisBase(group, ctx, dims);

  if (spec.openTop) {
    buildOpenTopCabin(group, ctx, dims);
  } else if (type === 'carro_forte') {
    buildVaultBoxCabin(group, ctx, dims);
  } else {
    buildStandardRakedCabin(group, ctx, dims);
  }

  applyCivilianAndSportsDetails(group, cfg, ctx, dims);
  attachStandardWheelsAndFinalize(group, ctx, dims);
  return group;
}

/**
 * Vagas fixas de projeto (`1x`) distribuídas pelas 10 regiões da cidade.
 */
export const DESIGN_PARKED_CARS_LAYOUT = [
  // Motos Táticas da Polícia / ROCAM / BOPE no Centro (Praça da Torre dos Heróis e Avenida Central)
  { x: 18.0, z: -48.0, rotY: 0, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
  { x: 24.0, z: -48.0, rotY: 0, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
  // Posto de Gasolina no Subúrbio Norte (explodem junto com as bombas!)
  { x: 181.0, z: -700.0, rotY: 0, color: 0x991b1b, roofColor: LEGO_COLORS.black, type: 'apex_gtx' },
  { x: 213.0, z: -700.0, rotY: Math.PI, color: 0x1e3a5f, roofColor: 0x0f172a, type: 'sedan_familiar' },
  // Estacionamento da Pizzaria & Ruas do Subúrbio Norte
  { x: 48.0, z: -680.0, rotY: 0, color: 0xc88a14, roofColor: 0x111827, type: 'taxi_metro' },
  { x: 64.0, z: -680.0, rotY: 0, color: 0x1e293b, roofColor: 0x090a0d, type: 'vortex_roadster' },
  { x: -45.0, z: -646.0, rotY: Math.PI / 2, color: 0x143828, roofColor: 0x0f172a, type: 'sedan_familiar' },
  { x: -178.0, z: -646.0, rotY: Math.PI / 2, color: 0x9a3412, roofColor: LEGO_COLORS.black, type: 'trovao_v8' },
  // Orla & Praia Sul (Buggies de Dunas na Areia, Conversíveis, Supercarros e Motos Táticas da Polícia na Avenida Beira-Mar)
  { x: -24.0, z: 710.0, rotY: Math.PI / 2, color: 0x7f1d1d, roofColor: 0x0f172a, type: 'vortex_roadster' },
  { x: -12.0, z: 710.0, rotY: Math.PI / 2, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
  { x: 14.0, z: 710.0, rotY: -Math.PI / 2, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
  { x: 28.0, z: 710.0, rotY: -Math.PI / 2, color: 0xb47b12, roofColor: LEGO_COLORS.black, type: 'apex_gtx' },
  { x: -32.0, z: 825.0, rotY: 0.35, color: 0x9a3412, roofColor: 0x1e293b, type: 'buggy_praia' },
  { x: 32.0, z: 825.0, rotY: -0.35, color: 0x2b3620, roofColor: 0xb45309, type: 'buggy_praia' },
  { x: -195.0, z: 895.0, rotY: 0.2, color: 0x7c2d12, roofColor: 0x1e293b, type: 'buggy_praia' },
  { x: 195.0, z: 895.0, rotY: -0.2, color: 0x143828, roofColor: 0xb47b12, type: 'buggy_praia' },
  // Dunas da Ponta da Praia / Costão Sudoeste (Buggies de Duna ao lado do Farol e Marina Oeste):
  { x: -1450.0, z: 830.0, rotY: 0.35, color: 0x9a3412, roofColor: 0x1e293b, type: 'buggy_praia' },
  { x: -1215.0, z: 830.0, rotY: -0.25, color: 0x1f2937, roofColor: 0xb45309, type: 'buggy_praia' },
  // Favela / Complexo da Cidade de Deus — Bocas de Entrada do CV (Oeste: Motos de Assalto 600cc e Picapes Armadas do CV!)
  { x: -518.0, z: -382.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
  { x: -518.0, z: -250.0, rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
  { x: -518.0, z: -242.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
  { x: -518.0, z: -117.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
  { x: -518.0, z: -108.0, rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
  { x: -518.0, z: 134.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
  { x: -518.0, z: 245.0, rotY: Math.PI / 2, color: 0xdc2626, roofColor: LEGO_COLORS.black, type: 'moto_cv' },
  { x: -518.0, z: 340.0, rotY: Math.PI / 2, color: 0x991b1b, roofColor: 0x1c1917, type: 'picape_cv' },
  // Distrito Industrial (Leste — Império Blindado 100% PCC):
  // 1) Saindo da Rampa Subterrânea / Garagem de Fuga Blindada do Bunker Central (X = 896, Z = -356..-315) + Superbikes 1000cc do PCC:
  { x: 896.0, y: -1.1, z: -358.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'van_pcc' },
  { x: 896.0, y: 0.0, z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
  { x: 882.0, y: 0.0, z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
  { x: 910.0, y: 0.0, z: -332.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
  { x: 850.0, y: 0.0, z: -334.0, rotY: -Math.PI / 4, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
  // 2) Pátio da Frota ("O Bonde do PCC" — X = 635..735, Z = -342..-288: Fileiras alinhadas de SUVs Pretas, Vans Quebra-Cofre e Superbikes 1000cc!):
  { x: 632.0, z: -322.0, rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
  { x: 632.0, z: -315.0, rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
  { x: 632.0, z: -308.0, rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
  { x: 642.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
  { x: 660.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
  { x: 678.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
  { x: 696.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
  { x: 714.0, z: -338.0, rotY: 0, color: 0x1e293b, roofColor: 0x090a0d, type: 'van_pcc' },
  { x: 732.0, z: -338.0, rotY: 0, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'van_pcc' },
  { x: 642.0, z: -292.0, rotY: Math.PI, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'suv_pcc' },
  { x: 664.0, z: -292.0, rotY: Math.PI, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
  { x: 692.0, z: -292.0, rotY: Math.PI, color: 0x0f172a, roofColor: 0x1e3a8a, type: 'van_pcc' },
  { x: 720.0, z: -292.0, rotY: Math.PI, color: 0x090a0d, roofColor: 0x090a0d, type: 'van_pcc' },
  // 3) Pátio do Desmanche & Ferro-Velho do Sindicato (X = 1005..1125, Z = -345..-285: Carros-Fortes roubados e Viaturas capturadas!):
  { x: 1018.0, z: -332.0, rotY: 0.25, color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, type: 'carro_forte' },
  { x: 1048.0, z: -332.0, rotY: -0.18, color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, type: 'carro_forte' },
  { x: 1082.0, z: -296.0, rotY: 2.6, color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' },
  { x: 1112.0, z: -296.0, rotY: -2.4, color: 0x334155, roofColor: LEGO_COLORS.black, type: 'choque_pickup' },
  // 4) Barricadas Táticas nas Entradas do Distrito Industrial (X = 594):
  { x: 594.0, z: -376.0, rotY: 0.42, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
  { x: 594.0, z: -368.0, rotY: 0.42, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
  { x: 594.0, z: -244.0, rotY: -0.38, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'van_pcc' },
  { x: 594.0, z: -119.0, rotY: 0.35, color: 0x090a0d, roofColor: 0x1e3a8a, type: 'moto_pcc' },
  { x: 594.0, z: -111.0, rotY: 0.35, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
  // Base Portuária Fortificada da A.R.E.S. no Porto Leste (Frota de Hover-APCs de 6 rodas):
  { x: 882.0, y: 0.3, z: 615.0, rotY: Math.PI / 2, color: 0x334155, roofColor: 0xa855f7, type: 'hover_apc_ares' },
  { x: 882.0, y: 0.3, z: 655.0, rotY: Math.PI / 2, color: 0x1e293b, roofColor: 0xd946ef, type: 'hover_apc_ares' },
  { x: 1108.0, y: 0.3, z: 615.0, rotY: -Math.PI / 2, color: 0x334155, roofColor: 0xa855f7, type: 'hover_apc_ares' },
  { x: 1108.0, y: 0.3, z: 655.0, rotY: -Math.PI / 2, color: 0x1e293b, roofColor: 0xd946ef, type: 'hover_apc_ares' },
  // Aeroporto Internacional & Base Militar Oeste (Estacionamento na frente do Mega Terminal + Baias de Tanques!)
  { x: -1058.0, z: -65.0, rotY: Math.PI / 2, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi_metro' },
  { x: -1058.0, z: -95.0, rotY: Math.PI / 2, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi_metro' },
  { x: -1058.0, z: 65.0, rotY: Math.PI / 2, color: 0x2563eb, roofColor: LEGO_COLORS.white, type: 'sedan_familiar' },
  { x: -1058.0, z: 95.0, rotY: Math.PI / 2, color: 0x090a0d, roofColor: 0x090a0d, type: 'suv_pcc' },
  { x: -1212.0, z: 390.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
  { x: -1212.0, z: 425.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
  { x: -1212.0, z: 460.0, rotY: 0, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
  // Ala Militar Norte da Base Oeste (Pátio de Tanques no Canto Noroeste):
  { x: -1380.0, y: 0.3, z: -1115.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
  { x: -1330.0, y: 0.3, z: -1115.0, rotY: 0, color: 0x3f6212, roofColor: 0x365314, type: 'tanque_titan' },
  // Grande Ponte Blindada (2 Checkpoints do BOPE: Lado do Porto Z = 754 e Chegada na Prisão Z = 1094) + Setor 2 (Garagem Tática da Ilha da Prisão):
  { x: 1358.0, y: 0.3, z: 754.0, rotY: 0, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
  { x: 1363.5, y: 0.3, z: 754.0, rotY: 0, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
  { x: 1386.5, y: 0.3, z: 754.0, rotY: 0, color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' },
  { x: 1363.5, y: 0.3, z: 1094.0, rotY: Math.PI, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
  { x: 1386.5, y: 0.3, z: 1094.0, rotY: Math.PI, color: 0x334155, roofColor: LEGO_COLORS.black, type: 'choque_pickup' },
  { x: 1392.0, y: 0.3, z: 1094.0, rotY: Math.PI, color: 0x111827, roofColor: LEGO_COLORS.white, type: 'moto_policia' },
  { x: 1445.0, y: 0.3, z: 1315.0, rotY: 0, color: 0x111827, roofColor: 0x111827, type: 'caveirao_bope' },
  { x: 1463.0, y: 0.3, z: 1315.0, rotY: 0, color: 0x090a0d, roofColor: 0xfacc15, type: 'caveirao_bope' },
  { x: 1481.0, y: 0.3, z: 1315.0, rotY: 0, color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'interceptor_v8' },
  { x: 1497.0, y: 0.3, z: 1315.0, rotY: 0, color: LEGO_COLORS.black, roofColor: 0x2563eb, type: 'interceptor_v8' },
  { x: 1513.0, y: 0.3, z: 1315.0, rotY: 0, color: 0x334155, roofColor: LEGO_COLORS.black, type: 'choque_pickup' },
  { x: 1529.0, y: 0.3, z: 1315.0, rotY: 0, color: 0x1e293b, roofColor: LEGO_COLORS.black, type: 'choque_pickup' }
];

/**
 * Resolve o layout de vagas estacionadas alinhando-as à faixa de estacionamento junto ao meio-fio
 * (`roadCoord ± 15.2m` em avenidas de `34m`, `±11.2m` em ruas de `26m`) e aos estacionamentos 3x da Onda 1.
 */
export function resolveParkedCarsLayout(world = null) {
  if (!IS_SCALED_WORLD) return DESIGN_PARKED_CARS_LAYOUT;

  const D = DESIGN_PARKED_CARS_LAYOUT;
  const citadel = world?.industrialPCCData?.citadelOrigin || { x: ws(866), z: ws(-316) };
  const convoy = world?.industrialPCCData?.convoyYardOrigin || { x: ws(684), z: ws(-316) };
  const chop = world?.industrialPCCData?.chopShopOrigin || { x: ws(1062), z: ws(-316) };
  const aresOx = ws(995) - 995;
  const aresOz = ws(622) - 622;
  const airportParkX = (world?.westAirportData?.parkingCenter?.x ?? ws(-1145) + 127) + 6.0;
  const tankYard = world?.westAirportData?.tankYardCenter || { x: ws(-1380), z: ws(-1135) };
  const bridgeX = ws(1375);
  const bridgeNorthCpZ = ws(734) + 14.0;
  const bridgeSouthCpZ = ws(1122) - 23.0;
  const prisonOx = ws(1375) - 1375;
  const prisonOz = ws(1540) - 1540;

  const cvStreetX = ws(-516) - 11.2;
  const cvStreetZList = [
    ws(-382) + 28.0,
    ws(-250) - 28.0,
    ws(-250) + 28.0,
    ws(-117) - 28.0,
    ws(-117) + 28.0,
    ws(134) + 28.0,
    ws(245),
    ws(340)
  ];

  return [
    // Centro: 2 Motos Policiais junto ao meio-fio da Av. Z = ws(-117) no Super Banco e na Torre dos Heróis
    { ...D[0], x: 26.0,    z: ws(-117) - 15.2, rotY: Math.PI / 2 },
    { ...D[1], x: -940.0,  z: ws(-117) - 15.2, rotY: Math.PI / 2 },
    // Posto de Gasolina do Subúrbio Norte (âncora (612, -2249), ilhas de bombas em (602, -2261) e (634, -2261))
    { ...D[2], x: 607.0,   z: -2261.0, rotY: 0 },
    { ...D[3], x: 639.0,   z: -2261.0, rotY: Math.PI },
    // Estacionamento da Pizzaria (278, -2011 -> vagas frontais em z = -1979) + Ruas do Subúrbio (Z = ws(-644) - 11.2)
    { ...D[4], x: 266.0,   z: -1979.0, rotY: 0 },
    { ...D[5], x: 282.0,   z: -1979.0, rotY: 0 },
    { ...D[6], x: ws(-45.0),  z: ws(-644) - 11.2, rotY: Math.PI / 2 },
    { ...D[7], x: ws(-178.0), z: ws(-644) - 11.2, rotY: Math.PI / 2 },
    // Orla & Praia Sul (Av. Beira-Mar Z = ws(710) + 15.2 = 2145.2 + Buggies na Areia + Costão Sudoeste)
    { ...D[8],  x: -72.0, z: ws(710) + 15.2, rotY: Math.PI / 2 },
    { ...D[9],  x: -56.0, z: ws(710) + 15.2, rotY: Math.PI / 2 },
    { ...D[10], x: 56.0,  z: ws(710) + 15.2, rotY: -Math.PI / 2 },
    { ...D[11], x: 72.0,  z: ws(710) + 15.2, rotY: -Math.PI / 2 },
    ...D.slice(12, 18).map((c) => ({ ...c, x: ws(c.x), z: ws(c.z) })),
    // Favela CDD — 8 veículos na faixa de estacionamento oeste da Rua X = ws(-516) junto às Bocas
    ...D.slice(18, 26).map((c, i) => ({ ...c, x: cvStreetX, z: cvStreetZList[i], rotY: 0 })),
    // Cidadela PCC — 5 veículos na Rampa Subterrânea / Garagem de Fuga
    ...D.slice(26, 31).map((c) => ({
      ...c,
      x: citadel.x + (c.x - 866.0),
      z: citadel.z + (c.z - -381.0)
    })),
    // Pátio da Frota ("O Bonde do PCC" — 13 veículos livres das garagens Norte/Leste)
    { ...D[31], x: convoy.x - 56.0, z: convoy.z - 8.0 },
    { ...D[32], x: convoy.x - 56.0, z: convoy.z },
    { ...D[33], x: convoy.x - 56.0, z: convoy.z + 8.0 },
    ...D.slice(34, 40).map((c, i) => ({
      ...c,
      x: convoy.x - 44.0 + i * 14.0,
      z: convoy.z - 18.0
    })),
    ...D.slice(40, 44).map((c, i) => ({
      ...c,
      x: convoy.x - 38.0 + i * 18.0,
      z: convoy.z + 24.0
    })),
    // Pátio do Desmanche & Ferro-Velho PCC (4 veículos livres da oficina, prensa e guindaste)
    { ...D[44], x: chop.x - 40.0, z: chop.z - 58.0 },
    { ...D[45], x: chop.x - 16.0, z: chop.z - 58.0 },
    { ...D[46], x: chop.x - 24.0, z: chop.z - 24.0 },
    { ...D[47], x: chop.x + 4.0,  z: chop.z - 24.0 },
    // Barricadas Táticas nas Entradas do Distrito Industrial PCC (5 veículos junto ao meio-fio das Avenidas 34m)
    { ...D[48], x: ws(607), z: ws(-382) + 15.2, rotY: Math.PI / 2 },
    { ...D[49], x: ws(607), z: ws(-382) - 15.2, rotY: Math.PI / 2 },
    { ...D[50], x: ws(607), z: ws(-250) + 15.2, rotY: Math.PI / 2 },
    { ...D[51], x: ws(607), z: ws(-117) - 15.2, rotY: Math.PI / 2 },
    { ...D[52], x: ws(607), z: ws(-117) + 15.2, rotY: Math.PI / 2 },
    // Base Portuária Fortificada da A.R.E.S. (4 Hover-APCs nos corredores livres do pátio blindado)
    { ...D[53], x: 938.0 + aresOx,  z: 604.0 + aresOz, rotY: 0 },
    { ...D[54], x: 938.0 + aresOx,  z: 640.0 + aresOz, rotY: 0 },
    { ...D[55], x: 1052.0 + aresOx, z: 604.0 + aresOz, rotY: Math.PI },
    { ...D[56], x: 1052.0 + aresOx, z: 640.0 + aresOz, rotY: Math.PI },
    // Aeroporto Oeste (4 carros nas vagas reservadas em X ~ -3302 + 3 tanques/caveirão Sul + 2 tanques Norte)
    { ...D[57], x: airportParkX, z: -65.0 },
    { ...D[58], x: airportParkX, z: -95.0 },
    { ...D[59], x: airportParkX, z: 65.0 },
    { ...D[60], x: airportParkX, z: 95.0 },
    { ...D[61], x: ws(-1215) + 22.0, z: ws(395.0) },
    { ...D[62], x: ws(-1215) + 22.0, z: ws(425.0) },
    { ...D[63], x: ws(-1215) + 22.0, z: ws(455.0) },
    { ...D[64], x: tankYard.x - 25.0, z: tankYard.z, _absoluteY: true },
    { ...D[65], x: tankYard.x + 25.0, z: tankYard.z, _absoluteY: true },
    // Grande Ponte Blindada (6 veículos nos 2 Checkpoints do BOPE) + Ilha da Prisão Setor 2 (6 veículos)
    { ...D[66], x: bridgeX - 15.6, z: bridgeNorthCpZ + 8.0, _absoluteY: true },
    { ...D[67], x: bridgeX - 11.5, z: bridgeNorthCpZ + 8.0, _absoluteY: true },
    { ...D[68], x: bridgeX + 11.5, z: bridgeNorthCpZ + 8.0, _absoluteY: true },
    { ...D[69], x: bridgeX - 11.5, z: bridgeSouthCpZ - 8.0, _absoluteY: true },
    { ...D[70], x: bridgeX + 11.5, z: bridgeSouthCpZ - 8.0, _absoluteY: true },
    { ...D[71], x: bridgeX + 15.6, z: bridgeSouthCpZ - 8.0, _absoluteY: true },
    ...D.slice(72, 78).map((c) => ({
      ...c,
      x: c.x + prisonOx,
      z: c.z + prisonOz,
      _absoluteY: true
    }))
  ];
}

export const PARKED_CARS_LAYOUT = resolveParkedCarsLayout(null);

/**
 * Posiciona toda a frota estacionada pelas 10 regiões da cidade com colisores e registro destrutível.
 */
export function buildParkedLegoCars(
  world,
  createCarMeshFn = _defaultCarMeshFactory,
  layoutOverride = null
) {
  const layout =
    layoutOverride || (IS_SCALED_WORLD ? resolveParkedCarsLayout(world) : PARKED_CARS_LAYOUT);

  layout.forEach((cfg) => {
    const spec = VEHICLE_SPECS[cfg.type] || VEHICLE_SPECS.apex_gtx;
    const carGroup = createCarMeshFn(cfg);
    const terrainY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cfg.x, cfg.z) : 0;
    const yBase = cfg._absoluteY
      ? cfg.y ?? 0
      : cfg.y !== undefined
        ? cfg.y < 1.5
          ? terrainY + cfg.y
          : cfg.y
        : terrainY;
    carGroup.position.set(cfg.x, yBase, cfg.z);
    carGroup.rotation.y = cfg.rotY;
    carGroup.userData.carType = cfg.type;
    carGroup.userData.carName = spec.name;
    carGroup.userData.vehicleSpec = spec;
    world.scene.add(carGroup);

    const isRotated90 = Math.abs(Math.sin(cfg.rotY)) > 0.7;
    const isMoto = Boolean(spec.isMotorcycle);
    const baseW = isMoto ? 1.45 : cfg.type === 'tanque_titan' ? 3.8 : 2.5;
    const baseD = isMoto ? 3.8 : cfg.type === 'tanque_titan' ? 5.9 : 5.0;
    const carWidth = isRotated90 ? baseD : baseW;
    const carDepth = isRotated90 ? baseW : baseD;

    const col1 = world.addCollider(cfg.x, cfg.z, carWidth, carDepth, yBase + 1.25, yBase);
    const col2 = world.addCollider(cfg.x, cfg.z, carWidth * 0.85, carDepth * 0.6, yBase + 2.05, yBase);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: carGroup,
        type: 'car',
        hp: spec.hp,
        radius: Math.max(carWidth, carDepth) * 0.52,
        height: 2.1,
        colliders: [col1, col2],
        debrisColors: [cfg.color, cfg.roofColor, LEGO_COLORS.black, LEGO_COLORS.yellow],
        studDrops: spec.studDrops,
        groundY: yBase
      });
    }
  });
}
