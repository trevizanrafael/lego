/**
 * TacticalAndFactionFleetBuilder.js
 * Construção 3D de viaturas BOPE/Polícia, Caveirão V-Hull, Tanque Militar Titan-M1,
 * blindados/picapes/APCs das 3 facções (CV, PCC, A.R.E.S.), motos de alta cilindrada
 * e o dispatcher principal com cache de protótipos `createLegoCarMesh`.
 */

import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../../materials/LegoMaterials.js';
import {
  markAsSharedAsset,
  mergeColoredGeometries,
  getSharedVertexColorMaterial
} from '../BuildingGenerator.js';
import { TACTICAL_AND_FACTION_TYPES } from './VehicleSpecsCatalog.js';
import {
  makeTaperedHullGeo,
  makeRakedCabinGeo,
  cloneVehicleProto,
  createVehicleMaterialContext,
  computeHardSurfaceChassisDims,
  buildHardSurfaceChassisBase,
  buildStandardRakedCabin,
  buildVaultBoxCabin,
  attachStandardWheelsAndFinalize,
  addPoliceLightbar,
  attachTurboFlames,
  setFullVehicleRebuildFactory
} from './VehicleChassisPrimitives.js';
import {
  buildCivilianOrSportsCarMesh,
  setDefaultCarMeshFactory
} from './CivilianAndSportsCarsBuilder.js';

const _VEHICLE_PROTO_CACHE = new Map();
const _MOTO_WHEEL_VC_GEO_CACHE = new Map();
const _SHARED_MOTO_WHEEL_VC_MAT = markAsSharedAsset(
  getSharedVertexColorMaterial({
    roughness: 0.3,
    metalness: 0.34,
    clearcoat: 0.3
  })
);

/**
 * Constrói Motos de Alta Cilindrada (Moto CV 600cc, Superbike PCC 1000cc e Moto Tática ROCAM / BOPE).
 */
export function buildMotorcycleMesh(group, cfg, ctx) {
  const {
    type,
    finishOpts,
    customWheelMat,
    darkTrimMat,
    blackMat,
    tireMat,
    goldMat,
    silverMat,
    glassMat,
    headlightMat,
    taillightMat
  } = ctx;

  const isPcc = type === 'moto_pcc';
  const isPolice = type === 'moto_policia';

  const primaryColor = isPcc
    ? (cfg.color ?? 0x090a0d)
    : isPolice
      ? (cfg.color ?? 0x111827)
      : (cfg.color ?? 0xdc2626);
  const secondaryColor = isPcc
    ? (cfg.roofColor ?? 0x1e3a8a)
    : isPolice
      ? (cfg.roofColor ?? LEGO_COLORS.white)
      : (cfg.roofColor ?? LEGO_COLORS.black);

  const primaryMat = getLegoMaterial(primaryColor, finishOpts);
  const secondaryMat = getLegoMaterial(secondaryColor, finishOpts);
  const gunmetalMat = getLegoMaterial(0x334155, { metalness: 0.55, roughness: 0.25 });
  const chromeMat = getLegoMaterial(0xe2e8f0, { metalness: 0.72, roughness: 0.18 });
  const pccNeonBlueMat = getLegoMaterial(0x0ea5e9, { emissive: 0x0ea5e9, emissiveIntensity: 0.95 });
  const policeRedStrobeMat = getLegoMaterial(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 0.95 });
  const policeBlueStrobeMat = getLegoMaterial(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 0.95 });
  const screenCyanMat = getLegoMaterial(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.85 });

  // 1. Bloco do Motor 4 Cilindros Metálico + Cabeçote + Aletas de Refrigeração + Radiador Frontal
  const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.58, 0.92), gunmetalMat);
  engineBlock.position.set(0, 0.68, 0.12);
  const cylinderHead = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.22, 0.72), silverMat);
  cylinderHead.rotation.x = 0.22;
  cylinderHead.position.set(0, 0.98, 0.26);
  const radiator = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.48, 0.14), blackMat);
  radiator.rotation.x = -0.25;
  radiator.position.set(0, 0.82, 0.72);
  const radiatorGrille = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.4, 0.16), gunmetalMat);
  radiatorGrille.rotation.x = -0.25;
  radiatorGrille.position.set(0, 0.82, 0.73);
  group.add(engineBlock, cylinderHead, radiator, radiatorGrille);

  // 2. Tampas Laterais de Embreagem / Alternador + Pedaleiras do Piloto e Garupa
  for (const sx of [-1, 1]) {
    const clutchCover = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12),
      isPcc ? secondaryMat : isPolice ? goldMat : silverMat
    );
    clutchCover.rotation.z = Math.PI / 2;
    clutchCover.position.set(sx * 0.36, 0.62, 0.02);

    // Quadro em Treliça Tubular Lateral (Trellis Frame)
    const frameBeamTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.11, 1.38),
      isPcc ? gunmetalMat : isPolice ? blackMat : primaryMat
    );
    frameBeamTop.rotation.x = -0.18;
    frameBeamTop.position.set(sx * 0.38, 1.02, 0.18);

    const frameBeamDiag = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.09, 1.05),
      isPcc ? secondaryMat : isPolice ? silverMat : primaryMat
    );
    frameBeamDiag.rotation.x = 0.42;
    frameBeamDiag.position.set(sx * 0.39, 0.84, 0.24);

    // Pedaleiras metálicas (Footpegs) onde os pés do boneco apoiam
    const riderPeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.09), silverMat);
    riderPeg.position.set(sx * 0.48, 0.52, -0.12);
    const passPeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.08), darkTrimMat);
    passPeg.position.set(sx * 0.44, 0.72, -0.68);

    group.add(clutchCover, frameBeamTop, frameBeamDiag, riderPeg, passPeg);
  }

  // 3. Balança Traseira Dupla (Rear Swingarm) + Amortecedor Central (Mono-Shock) + Corrente
  for (const sx of [-0.34, 0.34]) {
    const swingarm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 1.28), gunmetalMat);
    swingarm.rotation.x = -0.06;
    swingarm.position.set(sx, 0.58, -0.82);
    group.add(swingarm);
  }
  const rearShock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.52, 10),
    isPcc ? pccNeonBlueMat : isPolice ? goldMat : primaryMat
  );
  rearShock.rotation.x = 0.48;
  rearShock.position.set(0, 0.82, -0.45);
  group.add(rearShock);

  // 4. Tanque de Combustível Musculoso Angular Studless + Carenagens Laterais Chanfradas
  const mainTank = new THREE.Mesh(
    makeTaperedHullGeo(0.84, 0.98, 0.42, 1.06, 0.92, -0.06, 0.08, 0.12),
    primaryMat
  );
  mainTank.position.set(0, 1.24, 0.28);
  const tankTopCap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), silverMat);
  tankTopCap.position.set(0, 1.46, 0.36);
  group.add(mainTank, tankTopCap);

  for (const sx of [-0.5, 0.5]) {
    const tankShroud = new THREE.Mesh(
      makeTaperedHullGeo(0.1, 0.14, 0.36, 0.88, 0.96, 0.06, 0.12, 0),
      isPolice ? secondaryMat : primaryMat
    );
    tankShroud.rotation.x = -0.14;
    tankShroud.position.set(sx, 1.18, 0.52);
    group.add(tankShroud);
  }

  // 5. Banco Esportivo Bipartido em 2 Níveis + Rabeta Afiada Studless
  const riderSaddle = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.17, 0.78), blackMat);
  riderSaddle.position.set(0, 1.05, -0.34);
  const pillionSaddle = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.19, 0.66), darkTrimMat);
  pillionSaddle.rotation.x = -0.12;
  pillionSaddle.position.set(0, 1.18, -0.96);
  const tailFairing = new THREE.Mesh(
    makeTaperedHullGeo(0.82, 0.54, 0.24, 0.94, 0.76, -0.06, 0, 0.08),
    isPolice ? secondaryMat : primaryMat
  );
  tailFairing.rotation.x = -0.16;
  tailFairing.position.set(0, 1.12, -1.08);
  group.add(riderSaddle, pillionSaddle, tailFairing);

  // Alças traseiras de apoio (Grab Rails) + Suporte de Placa (Tail Tidy) + Lanterna Traseira de LED
  for (const sx of [-0.42, 0.42]) {
    const grabRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.62), gunmetalMat);
    grabRail.rotation.x = -0.15;
    grabRail.position.set(sx, 1.24, -1.05);
    group.add(grabRail);
  }
  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.12), taillightMat);
  tailLight.position.set(0, 1.16, -1.55);
  const plateBracket = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.08), blackMat);
  plateBracket.rotation.x = 0.35;
  plateBracket.position.set(0, 0.96, -1.58);
  group.add(tailLight, plateBracket);

  // 6. Sistema de Escapamento Duplo 4x2 (Coletores Curvos + 2 Ponteiras Inclinadas nas Laterais)
  for (const sx of [-1, 1]) {
    const exhaustPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 1.25, 10), chromeMat);
    exhaustPipe.rotation.x = Math.PI / 2 - 0.18;
    exhaustPipe.position.set(sx * 0.42, 0.56, -0.35);

    const muffler = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.11, 0.95, 12),
      isPcc ? gunmetalMat : chromeMat
    );
    muffler.rotation.x = Math.PI / 2 - 0.32;
    muffler.position.set(sx * 0.48, 0.78, -1.12);

    const mufflerTip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 12), blackMat);
    mufflerTip.rotation.x = Math.PI / 2 - 0.32;
    mufflerTip.position.set(sx * 0.48, 0.93, -1.56);

    group.add(exhaustPipe, muffler, mufflerTip);
  }

  // 7. Garfo Dianteiro Telescópico Duplo (Bengalas Inclinadas) + Mesas de Direção + Para-lama Dianteiro
  const forkColorMat = isPcc ? gunmetalMat : isPolice ? silverMat : goldMat;
  for (const sx of [-0.28, 0.28]) {
    const upperFork = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.85, 10), forkColorMat);
    upperFork.rotation.x = -0.34;
    upperFork.position.set(sx, 1.15, 1.04);

    const lowerFork = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 10), chromeMat);
    lowerFork.rotation.x = -0.34;
    lowerFork.position.set(sx, 0.68, 1.24);

    group.add(upperFork, lowerFork);
  }
  const tripleClampTop = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 0.26), gunmetalMat);
  tripleClampTop.position.set(0, 1.44, 0.88);
  const tripleClampBot = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.1, 0.28), gunmetalMat);
  tripleClampBot.position.set(0, 1.05, 1.06);
  const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.68), primaryMat);
  frontFender.rotation.x = 0.22;
  frontFender.position.set(0, 0.86, 1.38);
  group.add(tripleClampTop, tripleClampBot, frontFender);

  // 8. Carenagem Frontal, Faróis de LED, Painel Digital TFT, Guidão Largo, Manoplas e Retrovisores
  const noseFairing = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.48, 0.64), primaryMat);
  noseFairing.rotation.x = 0.22;
  noseFairing.position.set(0, 1.28, 1.18);
  group.add(noseFairing);

  // Farol Duplo Agressivo de LED
  for (const sx of [-0.22, 0.22]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.14), headlightMat);
    hl.rotation.z = sx * -0.18;
    hl.position.set(sx, 1.24, 1.51);
    group.add(hl);
  }

  // Bolha / Para-brisa Aerodinâmico (Mais alto na Moto Tática da Polícia, fumê esportivo na Superbike do PCC)
  const shieldH = isPolice ? 0.68 : isPcc ? 0.48 : 0.36;
  const motoShieldMat = isPcc
    ? getLegoMaterial(0x020617, { roughness: 0.08, metalness: 0.6 })
    : glassMat;
  motoShieldMat.userData = { ...motoShieldMat.userData, isVehicleGlass: true };
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, shieldH, 0.1),
    motoShieldMat
  );
  windshield.userData.isVehicleGlass = true;
  windshield.rotation.x = isPolice ? -0.32 : -0.52;
  windshield.position.set(0, 1.52 + (isPolice ? 0.12 : 0), 1.08);
  group.add(windshield);

  // Painel Digital TFT colorido + Guidão Largo + Manoplas + Protetores de Mão + Retrovisores
  const dashboard = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.08), screenCyanMat);
  dashboard.rotation.x = -0.45;
  dashboard.position.set(0, 1.48, 0.94);

  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.56, 10), silverMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.52, 0.76);
  group.add(dashboard, handlebar);

  for (const sx of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 10), blackMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(sx * 0.68, 1.52, 0.76);

    const handguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.14, 0.08),
      isPolice ? secondaryMat : primaryMat
    );
    handguard.position.set(sx * 0.68, 1.52, 0.86);

    const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 6), blackMat);
    mirrorStem.rotation.z = sx * -0.45;
    mirrorStem.position.set(sx * 0.62, 1.64, 0.82);

    const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.06), blackMat);
    mirrorHead.position.set(sx * 0.72, 1.74, 0.84);

    // Submetralhadoras Táticas Acopladas nas Laterais da Carenagem Dianteira!
    const smgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.52), blackMat);
    smgReceiver.position.set(sx * 0.48, 1.12, 1.18);
    const smgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.42, 8), gunmetalMat);
    smgBarrel.rotation.x = Math.PI / 2;
    smgBarrel.position.set(sx * 0.48, 1.14, 1.54);

    group.add(grip, handguard, mirrorStem, mirrorHead, smgReceiver, smgBarrel);
  }

  // 9. Detalhes Exclusivos por Facção (CV vs PCC vs POLÍCIA / BOPE)
  if (isPcc) {
    // SUPERBIKE BLINDADA 1000CC DO PCC: Carenagem Integral Esportiva (Full Fairing) + Spoiler Inferior + Frisos Neon-Azul
    const bellyPan = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.24, 1.48), secondaryMat);
    bellyPan.position.set(0, 0.48, 0.16);
    group.add(bellyPan);

    for (const sx of [-0.48, 0.48]) {
      const fullFairing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.68, 1.32), primaryMat);
      fullFairing.rotation.x = -0.18;
      fullFairing.position.set(sx, 0.88, 0.54);

      const neonWinglet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 1.18), pccNeonBlueMat);
      neonWinglet.rotation.x = -0.18;
      neonWinglet.position.set(sx * 1.06, 0.94, 0.56);

      const tailNeon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.78), pccNeonBlueMat);
      tailNeon.rotation.x = -0.14;
      tailNeon.position.set(sx * 0.92, 1.16, -1.06);

      group.add(fullFairing, neonWinglet, tailNeon);
    }
  } else if (isPolice) {
    // MOTO TÁTICA ROCAM / BOPE: Protetor de Carenagem (Crash Bars), 2 Baús Laterais Blindados, Baú Traseiro com Antena e Giroflex Policial!
    for (const sx of [-1, 1]) {
      const crashBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.54), silverMat);
      crashBar.position.set(sx * 0.48, 0.76, 0.48);

      const sideBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.46, 0.74), primaryMat);
      sideBox.position.set(sx * 0.56, 1.04, -0.98);
      const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.76), goldMat);
      goldStripe.position.set(sx * 0.56, 1.08, -0.98);

      const frontStrobe = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.14, 0.14),
        sx < 0 ? policeRedStrobeMat : policeBlueStrobeMat
      );
      frontStrobe.position.set(sx * 0.46, 1.36, 1.38);

      group.add(crashBar, sideBox, goldStripe, frontStrobe);
    }

    // Baú Traseiro Superior Angular Studless + Mastro de Rádio com Giroflex Traseiro Elevado
    const topCase = new THREE.Mesh(
      makeTaperedHullGeo(0.68, 0.58, 0.38, 0.58, 0.5, -0.02, 0.05, 0.03),
      secondaryMat
    );
    topCase.position.set(0, 1.44, -1.36);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8), silverMat);
    pole.position.set(0.28, 1.76, -1.48);
    const rearBeaconRed = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12), policeRedStrobeMat);
    rearBeaconRed.position.set(0.28, 2.12, -1.48);
    const rearBeaconBlue = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12), policeBlueStrobeMat);
    rearBeaconBlue.position.set(-0.28, 1.66, -1.48);
    group.add(topCase, pole, rearBeaconRed, rearBeaconBlue);
  } else {
    // MOTO DE ASSALTO 600CC (CV): Protetor de Carter Vermelho + Aletas Streetfighter Agressivas
    const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 0.92), primaryMat);
    skidPlate.position.set(0, 0.46, 0.22);
    group.add(skidPlate);
  }

  // 10. Pneus Largos Esportivos + Aros + Discos de Freio Ventilados + Pinças (1 Mesh VC por roda!)
  const wheels = [];
  const wheelConfigs = [
    { wz: 1.38, radius: 0.55, width: 0.38, isFront: true },
    { wz: -1.38, radius: 0.58, width: 0.52, isFront: false }
  ];
  const rimMat = customWheelMat || (isPcc ? pccNeonBlueMat : isPolice ? silverMat : goldMat);
  const caliperMat = isPcc ? pccNeonBlueMat : isPolice ? goldMat : primaryMat;
  const isLite = Boolean(ctx.trafficLite || group.userData?._trafficLite);

  for (const wc of wheelConfigs) {
    const wKey = `${wc.radius}|${wc.width}|${tireMat.color.getHex()}|${rimMat.color.getHex()}`;
    let wheelVcGeo = _MOTO_WHEEL_VC_GEO_CACHE.get(wKey);
    if (!wheelVcGeo) {
      const tireG = new THREE.CylinderGeometry(wc.radius, wc.radius, wc.width, 16);
      tireG.rotateZ(Math.PI / 2);
      const rimG = new THREE.CylinderGeometry(wc.radius * 0.64, wc.radius * 0.64, wc.width + 0.02, 14);
      rimG.rotateZ(Math.PI / 2);
      const hubG = new THREE.CylinderGeometry(wc.radius * 0.28, wc.radius * 0.28, wc.width + 0.06, 10);
      hubG.rotateZ(Math.PI / 2);
      const discParts = [
        { geo: tireG, color: tireMat.color },
        { geo: rimG, color: rimMat.color },
        { geo: hubG, color: gunmetalMat.color }
      ];
      for (const dx of [-1, 1]) {
        const bd = new THREE.CylinderGeometry(wc.radius * 0.48, wc.radius * 0.48, 0.04, 12);
        bd.rotateZ(Math.PI / 2);
        bd.translate(dx * (wc.width * 0.5 + 0.02), 0, 0);
        discParts.push({ geo: bd, color: silverMat.color });
      }
      wheelVcGeo = markAsSharedAsset(mergeColoredGeometries(discParts));
      _MOTO_WHEEL_VC_GEO_CACHE.set(wKey, wheelVcGeo);
    }

    if (isLite) {
      const wheelMesh = new THREE.Mesh(wheelVcGeo, _SHARED_MOTO_WHEEL_VC_MAT);
      wheelMesh.position.set(0, wc.radius, wc.wz);
      group.add(wheelMesh);
      for (const dx of [-1, 1]) {
        const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.14), caliperMat);
        caliper.position.set(dx * (wc.width * 0.5 + 0.04), wc.radius * 1.32, wc.wz - wc.radius * 0.24);
        group.add(caliper);
      }
    } else {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(0, wc.radius, wc.wz);
      const spinGroup = new THREE.Group();
      spinGroup.add(new THREE.Mesh(wheelVcGeo, _SHARED_MOTO_WHEEL_VC_MAT));
      steerGroup.add(spinGroup);
      group.add(steerGroup);
      wheels.push({ steerGroup, spinGroup, isFront: wc.isFront });
    }
  }

  group.userData.wheels = wheels;
  group.userData.chassisDims = {
    w: 0.96,
    h: 0.9,
    d: 3.3,
    topY: 1.46,
    roofY: 1.46,
    cabinW: 0.9,
    cabinD: 1.1,
    cabinZ: 0.28,
    frontZ: 1.55,
    openTop: true,
    isMoto: true,
    wheelRadius: 0.56
  };
  attachTurboFlames(group, [-0.48, 0.48], 0.92, -1.68);
  return group;
}

/**
 * Constrói o Tanque Militar Titan-M1 (blindagem glacis inclinada, saias ERA e torreta stealth).
 */
export function buildTitanTankMesh(group, cfg, ctx) {
  const { blackMat, headlightMat, taillightMat, gunmetalTrimMat } = ctx;

  const tankOliveMat = getLegoMaterial(cfg.color ?? 0x2b3620, { roughness: 0.62, metalness: 0.28 });
  const tankDarkArmorMat = getLegoMaterial(0x1b2215, { roughness: 0.68, metalness: 0.34 });

  // Casco blindado com glacis frontal em cunha inclinada + deck de motor traseiro
  const hull = new THREE.Mesh(
    makeTaperedHullGeo(3.38, 3.05, 1.12, 5.88, 5.15, -0.18, 0.34, 0.14),
    tankOliveMat
  );
  hull.position.set(0, 0.92, 0);
  const lowerBelly = new THREE.Mesh(
    makeTaperedHullGeo(2.85, 3.36, 0.34, 5.1, 5.84, 0, 0, 0),
    tankDarkArmorMat
  );
  lowerBelly.position.set(0, 0.42, 0);
  const engineGrille = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.45), gunmetalTrimMat);
  engineGrille.position.set(0, 1.44, -1.85);
  group.add(hull, lowerBelly, engineGrille);

  // Esteiras blindadas laterais + Saias de Blindagem Reativa Chanfradas (ERA Skirts)
  for (const tx of [-1.76, 1.76]) {
    const track = new THREE.Mesh(
      makeTaperedHullGeo(0.64, 0.64, 0.86, 5.4, 5.92, 0, 0, 0),
      blackMat
    );
    track.position.set(tx, 0.46, 0);
    const skirt = new THREE.Mesh(
      makeTaperedHullGeo(0.74, 0.62, 0.44, 5.96, 5.65, -0.05, 0.14, 0.08),
      tankDarkArmorMat
    );
    skirt.position.set(tx, 0.96, 0);
    group.add(track, skirt);
  }

  // Faróis táticos embutidos e lanternas traseiras
  for (const lx of [-1.14, 1.14]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.14), headlightMat);
    hl.position.set(lx, 1.06, 2.86);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.14), taillightMat);
    tl.position.set(lx, 1.12, -2.92);
    group.add(hl, tl);
  }

  // Torreta Facetada Angular Estilo Abrams/Stealth + Cúpula + Canhão
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 1.84, -0.18);
  const turretBody = new THREE.Mesh(
    makeTaperedHullGeo(2.48, 1.92, 0.76, 2.95, 2.35, -0.16, 0.22, 0.08),
    tankDarkArmorMat
  );
  const mantlet = new THREE.Mesh(
    makeTaperedHullGeo(0.86, 0.72, 0.48, 0.65, 0.48, 0.08, 0.1, 0),
    gunmetalTrimMat
  );
  mantlet.position.set(0, 0.04, 1.38);
  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.24, 8), gunmetalTrimMat);
  cupola.position.set(0.48, 0.48, -0.35);
  const cannonBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 3.95, 12), gunmetalTrimMat);
  cannonBarrel.rotation.x = Math.PI / 2;
  cannonBarrel.position.set(0, 0.06, 2.55);
  const boreEvacuator = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.68, 12), tankOliveMat);
  boreEvacuator.rotation.x = Math.PI / 2;
  boreEvacuator.position.set(0, 0.06, 2.85);
  const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.44, 12), blackMat);
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.06, 4.48);
  turretGroup.add(turretBody, mantlet, cupola, cannonBarrel, boreEvacuator, muzzleBrake);
  group.add(turretGroup);
  group.userData.turretGroup = turretGroup;

  const wheels = [];
  const tankWheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.42, 12);
  tankWheelGeo.rotateZ(Math.PI / 2);
  for (const wz of [-2.1, -0.7, 0.7, 2.1]) {
    for (const wx of [-1.78, 1.78]) {
      if (ctx.trafficLite || group.userData?._trafficLite) {
        const wheel = new THREE.Mesh(tankWheelGeo, gunmetalTrimMat);
        wheel.position.set(wx, 0.44, wz);
        group.add(wheel);
      } else {
        const steerGroup = new THREE.Group();
        steerGroup.position.set(wx, 0.44, wz);
        const spinGroup = new THREE.Group();
        const wheel = new THREE.Mesh(tankWheelGeo, gunmetalTrimMat);
        spinGroup.add(wheel);
        steerGroup.add(spinGroup);
        group.add(steerGroup);
        wheels.push({ steerGroup, spinGroup, isFront: false });
      }
    }
  }
  group.userData.wheels = wheels;
  group.userData.chassisDims = {
    w: 3.4,
    h: 1.15,
    d: 5.8,
    topY: 1.5,
    roofY: 2.25,
    cabinW: 2.3,
    cabinD: 2.7,
    cabinZ: -0.2,
    frontZ: 2.95,
    openTop: false,
    isMoto: false,
    wheelRadius: 0.42
  };
  attachTurboFlames(group, [-0.8, 0.8], 0.75, -3.0);
  return group;
}

/**
 * Constrói cabines balísticas de blindados táticos e facções (Caveirão V-Hull, Van PCC, Hover-APC A.R.E.S. e viaturas).
 */
export function buildTacticalCabin(group, ctx, dims) {
  const { type, bodyMat, silverMat, glassMat } = ctx;
  const { chassisW, chassisTopY, roofAccentMat } = dims;

  if (type === 'caveirao_bope') {
    const cabinW = chassisW - 0.12;
    const cabinH = 1.08;
    const cabinD = 3.95;
    const cabinZ = -0.48;
    const armoredUpper = new THREE.Mesh(
      makeRakedCabinGeo(
        cabinW,
        cabinW - 0.44,
        cabinH,
        cabinD,
        cabinZ,
        cabinZ + cabinD * 0.5 - 0.52,
        cabinZ - cabinD * 0.5 + 0.24
      ),
      bodyMat
    );
    armoredUpper.position.set(0, chassisTopY - 0.02, 0);
    const visorSlit = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.54, 0.28, 0.14), glassMat);
    visorSlit.rotation.x = -0.44;
    visorSlit.position.set(0, chassisTopY + 0.58, cabinZ + cabinD * 0.5 - 0.26);
    const visorLouver = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.48, 0.05, 0.18), silverMat);
    visorLouver.position.set(0, chassisTopY + 0.62, cabinZ + cabinD * 0.5 - 0.22);
    group.add(armoredUpper, visorSlit, visorLouver);

    for (const pz of [-1.6, -0.6, 0.4]) {
      for (const sx of [-1, 1]) {
        const gunPort = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.34), glassMat);
        gunPort.rotation.z = sx * 0.18;
        gunPort.position.set(sx * (cabinW * 0.5 - 0.11), chassisTopY + 0.62, pz);
        group.add(gunPort);
      }
    }
    const roofY = chassisTopY + cabinH + 0.04;
    const roofPlate = new THREE.Mesh(
      makeTaperedHullGeo(cabinW - 0.42, cabinW - 0.56, 0.12, cabinD - 0.78, cabinD - 0.96, -0.14, 0, 0),
      roofAccentMat
    );
    roofPlate.position.set(0, roofY, cabinZ);
    group.add(roofPlate);
    group.userData._roofMeta = { roofY, cabinW: cabinW - 0.42, cabinD: cabinD - 0.78, cabinZ };
  } else if (type === 'van_pcc') {
    buildVaultBoxCabin(group, ctx, dims);
  } else if (type === 'hover_apc_ares') {
    const cabinW = chassisW - 0.18;
    const cabinH = 0.78;
    const cabinD = 3.9;
    const cabinZ = -0.24;
    const stealthDeck = new THREE.Mesh(
      makeRakedCabinGeo(
        cabinW,
        cabinW - 0.58,
        cabinH,
        cabinD,
        cabinZ,
        cabinZ + cabinD * 0.5 - 0.78,
        cabinZ - cabinD * 0.5 + 0.48
      ),
      bodyMat
    );
    stealthDeck.position.set(0, chassisTopY - 0.02, 0);
    const cyberVisor = new THREE.Mesh(new THREE.BoxGeometry(cabinW - 0.64, 0.22, 0.16), glassMat);
    cyberVisor.rotation.x = -0.68;
    cyberVisor.position.set(0, chassisTopY + 0.42, cabinZ + cabinD * 0.5 - 0.42);
    group.add(stealthDeck, cyberVisor);

    const roofY = chassisTopY + cabinH + 0.04;
    group.userData._roofMeta = { roofY, cabinW: cabinW - 0.58, cabinD: cabinD - 1.25, cabinZ };
  } else {
    buildStandardRakedCabin(group, ctx, dims);
  }
}

/**
 * Aplica aríetes V-plow, giroflex policial, quebra-matos, torretas de metralhadora/plasma e blindagem de facções.
 */
export function applyTacticalAndFactionDetails(group, ctx, dims) {
  const {
    type,
    darkTrimMat,
    blackMat,
    goldMat,
    silverMat,
    neonCyanMat,
    neonPurpleMat,
    gunmetalTrimMat
  } = ctx;
  const { isPickup, chassisW, chassisD, chassisTopY, frontZ } = dims;

  if (type === 'caveirao_bope') {
    const ram = new THREE.Mesh(
      makeTaperedHullGeo(2.74, 2.48, 0.92, 0.58, 0.28, -0.14, 0.18, 0),
      gunmetalTrimMat
    );
    ram.position.set(0, 0.78, frontZ + 0.24);
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.68, 0.24, 8), gunmetalTrimMat);
    hatch.position.set(0, 2.58, -0.22);
    const hatchShield = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.34, 0.12), darkTrimMat);
    hatchShield.rotation.x = -0.24;
    hatchShield.position.set(0, 2.78, 0.22);
    for (const sx of [-1.22, 1.22]) {
      const skullEmblem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.52), goldMat);
      skullEmblem.rotation.z = sx > 0 ? 0.16 : -0.16;
      skullEmblem.position.set(sx, 1.82, -0.52);
      group.add(skullEmblem);
    }
    addPoliceLightbar(group, 2.56, 0.78);
    group.add(ram, hatch, hatchShield);
  } else if (type === 'interceptor_v8' || type === 'choque_pickup') {
    const pushBar = new THREE.Mesh(
      makeTaperedHullGeo(1.68, 1.48, 0.58, 0.28, 0.18, -0.05, 0.08, 0),
      blackMat
    );
    pushBar.position.set(0, 0.66, frontZ + 0.14);
    group.add(pushBar);
    const lbY = group.userData._roofMeta ? group.userData._roofMeta.roofY + 0.1 : 1.92;
    addPoliceLightbar(group, lbY, isPickup ? 0.25 : -0.15);
  } else if (type === 'picape_cv') {
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, chassisTopY + 0.55, -1.42);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 8), blackMat);
    ped.position.y = -0.2;
    const shield = new THREE.Mesh(
      makeTaperedHullGeo(0.96, 0.78, 0.64, 0.14, 0.1, 0, 0, 0),
      gunmetalTrimMat
    );
    shield.rotation.x = -0.18;
    shield.position.set(0, 0.3, 0.35);
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.1), blackMat);
    gunBody.position.set(0, 0.25, 0.2);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.42, 8), silverMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.25, 0.96);
    turretGroup.add(ped, shield, gunBody, barrel);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;
  } else if (type === 'hover_apc_ares') {
    for (const nx of [-1.34, 1.34]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 4.9), neonPurpleMat);
      strip.position.set(nx, 0.92, -0.08);
      group.add(strip);
    }
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 2.28, -0.24);
    const pod = new THREE.Mesh(
      makeTaperedHullGeo(1.38, 1.04, 0.52, 1.62, 1.24, -0.1, 0.16, 0.06),
      gunmetalTrimMat
    );
    const laserBarrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.85, 10), neonPurpleMat);
    laserBarrelL.rotation.x = Math.PI / 2;
    laserBarrelL.position.set(-0.32, 0.04, 1.12);
    const laserBarrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.85, 10), neonCyanMat);
    laserBarrelR.rotation.x = Math.PI / 2;
    laserBarrelR.position.set(0.32, 0.04, 1.12);
    turretGroup.add(pod, laserBarrelL, laserBarrelR);
    group.add(turretGroup);
    group.userData.turretGroup = turretGroup;
  } else if (type === 'suv_pcc') {
    const bullBar = new THREE.Mesh(
      makeTaperedHullGeo(2.08, 1.84, 0.62, 0.28, 0.18, -0.05, 0.08, 0),
      gunmetalTrimMat
    );
    bullBar.position.set(0, 0.68, frontZ + 0.15);
    const blueMat = getLegoMaterial(0x1e3a8a, { roughness: 0.28 });
    for (const sx of [-chassisW * 0.51, chassisW * 0.51]) {
      const pccStripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, chassisD - 0.45), blueMat);
      pccStripe.position.set(sx, 0.88, 0);
      const cyanTrim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, chassisD - 0.7), neonCyanMat);
      cyanTrim.position.set(sx, 0.76, 0);
      group.add(pccStripe, cyanTrim);
    }
    const antennaY = group.userData._roofMeta ? group.userData._roofMeta.roofY + 0.42 : 2.28;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.85, 6), silverMat);
    antenna.position.set(0, antennaY, -0.85);
    group.add(bullBar, antenna);
  } else if (type === 'van_pcc') {
    const ramPlate = new THREE.Mesh(
      makeTaperedHullGeo(2.54, 2.32, 0.82, 0.44, 0.24, -0.1, 0.14, 0),
      gunmetalTrimMat
    );
    ramPlate.position.set(0, 0.76, frontZ + 0.18);
    const blueMat = getLegoMaterial(0x1e3a8a, { roughness: 0.3 });
    for (const sx of [-1.24, 1.24]) {
      const sideArmor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 4.1), blueMat);
      sideArmor.position.set(sx, 1.58, -0.42);
      const silverLine = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 3.95), silverMat);
      silverLine.position.set(sx, 1.84, -0.42);
      group.add(sideArmor, silverLine);
    }
    const roofBox = new THREE.Mesh(
      makeTaperedHullGeo(1.32, 1.16, 0.26, 1.82, 1.58, -0.04, 0.05, 0.03),
      gunmetalTrimMat
    );
    roofBox.position.set(0, 2.6, -0.58);
    group.add(ramPlate, roofBox);
  }
}

/**
 * Monta qualquer veículo tático (Polícia / BOPE / Exército) ou de facção (CV / PCC / A.R.E.S.).
 */
export function buildTacticalOrFactionVehicleMesh(cfg, ctx) {
  const { type, group } = ctx;

  if (type === 'moto_cv' || type === 'moto_pcc' || type === 'moto_policia') {
    return buildMotorcycleMesh(group, cfg, ctx);
  }
  if (type === 'tanque_titan') {
    return buildTitanTankMesh(group, cfg, ctx);
  }

  const dims = computeHardSurfaceChassisDims(ctx);
  buildHardSurfaceChassisBase(group, ctx, dims);
  buildTacticalCabin(group, ctx, dims);
  applyTacticalAndFactionDetails(group, ctx, dims);
  attachStandardWheelsAndFinalize(group, ctx, dims);
  return group;
}

function _buildLegoCarMeshUncached(cfg) {
  const ctx = createVehicleMaterialContext(cfg);
  if (TACTICAL_AND_FACTION_TYPES.has(ctx.type)) {
    return buildTacticalOrFactionVehicleMesh(cfg, ctx);
  }
  return buildCivilianOrSportsCarMesh(cfg, ctx);
}

/**
 * Dispatcher principal com cache de protótipos compartilhados para todos os veículos terrestres.
 */
export function createLegoCarMesh(cfg = {}) {
  const type = cfg.type || 'apex_gtx';
  const isLite = Boolean(cfg.trafficLite || cfg.finishStyle === 'traffic_lite');
  const cacheKey = `${type}|${cfg.color ?? ''}|${cfg.roofColor ?? ''}|${cfg.finishStyle ?? ''}|${cfg.wheelColor ?? ''}|${cfg.suppressDefaultSpoiler ? 1 : 0}|${isLite ? 1 : 0}`;
  const cachedProto = _VEHICLE_PROTO_CACHE.get(cacheKey);
  if (cachedProto) {
    return cloneVehicleProto(cachedProto);
  }
  const proto = _buildLegoCarMeshUncached(cfg);
  proto.traverse((o) => {
    if (o.isMesh) {
      if (o.geometry) markAsSharedAsset(o.geometry);
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(markAsSharedAsset);
        else markAsSharedAsset(o.material);
      }
    }
  });
  _VEHICLE_PROTO_CACHE.set(cacheKey, proto);
  return cloneVehicleProto(proto);
}

// Registra o factory padrão sem dependência circular
setDefaultCarMeshFactory(createLegoCarMesh);
setFullVehicleRebuildFactory(createLegoCarMesh);
