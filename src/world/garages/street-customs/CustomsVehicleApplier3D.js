import * as THREE from 'three';
import {
  getLegoMaterial,
  createLegoBrick
} from '../../../materials/LegoMaterials.js';
import {
  VEHICLE_SPECS,
  createLegoCarMesh,
  getFinishMaterialOpts
} from '../../VehicleFleetBuilder.js';
import { ensureVehicleNightLights } from '../../DayNightAtmosphereManager.js';
import {
  CUSTOMS_WINDOW_TINTS,
  CUSTOMS_UNDERGLOW,
  getPaletteHex,
  createDefaultVehicleTuning,
  computeTunedVehicleStats,
  getUnderglowGradientTexture,
  createVehicleDecalTexture
} from './CustomsCatalogAndSave.js';

// ============================================================================
// 4. APLICAÇÃO AO VIVO DAS PEÇAS 3D, PINTURA, DECALS, MONSTER TRUCK & UNDERGLOW
// ============================================================================
let _vipBusSignTex = null;
let _paredaoSignTex = null;

function createLedBannerTexture(mainText, subText, accentColor = '#00e5ff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = '#ff6b00';
    ctx.font = '900 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(mainText, 256, 46);
    ctx.fillStyle = accentColor;
    ctx.font = '700 18px monospace';
    ctx.fillText(subText, 256, 76);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
}

function getVipBusSignTexture() {
  if (!_vipBusSignTex) {
    _vipBusSignTex = createLedBannerTexture('EXPRESSO CDD // VIP TURBO', 'LINHA EXPRESSA • NITRO STAGE 10', '#00e5ff');
  }
  return _vipBusSignTex;
}

function getParedaoSignTexture() {
  if (!_paredaoSignTex) {
    _paredaoSignTex = createLedBannerTexture('PAREDAO CDD // PRO AUDIO', 'GRAVE PESADO • 180dB SPL', '#ff6b00');
  }
  return _paredaoSignTex;
}

/**
 * Mede as dimensões 3D reais do veículo (Carros, Motos, Picapes, Caminhões, Carro-Forte e Ônibus)
 * em coordenadas locais do chassi para enquadramento perfeito de câmera e encaixe universal de peças!
 */
export function measureVehicleBounds(vehicleInput) {
  const root = vehicleInput?.isObject3D ? vehicleInput : vehicleInput?.mesh;
  const carType = root?.userData?.carType || 'apex_gtx';
  const spec = root?.userData?.vehicleSpec || VEHICLE_SPECS[carType] || VEHICLE_SPECS.apex_gtx;
  const cd = root?.userData?.chassisDims || {};
  const isMoto = Boolean(cd.isMoto || spec?.isMotorcycle || carType.startsWith('moto_'));

  let minX = -(cd.w || (isMoto ? 0.96 : 2.4)) * 0.5;
  let maxX = -minX;
  let minY = 0;
  let maxY = cd.roofY || cd.topY || (isMoto ? 1.78 : 1.92);
  let minZ = -(cd.d || (isMoto ? 3.3 : 4.85)) * 0.5;
  let maxZ = -minZ;

  if (root) {
    const savedPos = root.position.clone();
    const savedRot = root.rotation.clone();
    const savedScale = root.scale.clone();
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);

    const box = new THREE.Box3();
    const childBox = new THREE.Box3();
    let hasMesh = false;
    root.traverse((node) => {
      if (!node.isMesh || !node.geometry) return;
      if (node.userData?.isNitroFlame || node === root.userData?._underglowMesh) return;
      if (node.parent?.userData?.isNitroFlame || node.parent?.name === 'lego_customs_mod_group') return;
      childBox.setFromObject(node);
      if (!childBox.isEmpty()) {
        box.union(childBox);
        hasMesh = true;
      }
    });

    root.position.copy(savedPos);
    root.rotation.copy(savedRot);
    root.scale.copy(savedScale);
    root.updateMatrixWorld(true);

    if (hasMesh && !box.isEmpty()) {
      minX = Math.min(minX, box.min.x);
      maxX = Math.max(maxX, box.max.x);
      minY = Math.max(0, box.min.y);
      maxY = Math.max(maxY, box.max.y);
      minZ = Math.min(minZ, box.min.z);
      maxZ = Math.max(maxZ, box.max.z);
    }
  }

  const w = Math.max(isMoto ? 0.92 : 2.1, cd.w || maxX - minX);
  const d = Math.max(isMoto ? 3.1 : 4.2, cd.d || maxZ - minZ);
  const h = Math.max(isMoto ? 1.45 : 1.5, maxY - minY);
  const isBus = Boolean(cd.isBus || carType === 'onibus_urbano' || d > 7.0);
  const isEnclosedBoxRear =
    isBus ||
    carType === 'carro_forte' ||
    carType === 'van_pcc' ||
    carType === 'caveirao_bope';
  const isHeavy =
    isBus ||
    d > 5.2 ||
    isEnclosedBoxRear ||
    carType === 'picape_cv' ||
    carType === 'choque_pickup' ||
    carType === 'hover_apc_ares' ||
    carType === 'tanque_titan';

  const vehicleClassLabel = isBus
    ? 'ÔNIBUS'
    : isMoto
      ? 'MOTO'
      : isHeavy
        ? 'CAMINHÃO'
        : 'CARRO';

  return {
    w,
    h: cd.h || Math.min(h, 2.4),
    fullH: h,
    d,
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    topY: cd.topY ?? (isMoto ? 1.24 : h * 0.58),
    roofY: cd.roofY ?? maxY,
    cabinW: cd.cabinW ?? w * 0.88,
    cabinD: cd.cabinD ?? (isMoto ? 1.1 : d * 0.48),
    cabinZ: cd.cabinZ ?? (isMoto ? 0.28 : -0.1),
    frontZ: cd.frontZ ?? maxZ,
    rearZ: minZ,
    openTop: Boolean(cd.openTop ?? spec?.openTop),
    isMoto,
    isBus,
    isEnclosedBoxRear,
    isHeavy,
    wheelRadius: cd.wheelRadius ?? (isMoto ? 0.56 : 0.44),
    vehicleClassLabel
  };
}

export function applyWindowAndHeadlightTint(root, windowTintId = 'stock') {
  if (!root) return;
  const tintEntry =
    CUSTOMS_WINDOW_TINTS.find((t) => t.id === windowTintId) || CUSTOMS_WINDOW_TINTS[0];

  let tintedGlassMat = null;
  let tintedHeadlightMat = null;
  if (tintEntry.id !== 'stock' && tintEntry.hex !== null) {
    tintedGlassMat = new THREE.MeshPhysicalMaterial({
      color: tintEntry.hex,
      transparent: true,
      opacity: tintEntry.opacity ?? 0.88,
      roughness: tintEntry.roughness ?? 0.06,
      metalness: tintEntry.metalness ?? 0.75,
      clearcoat: 0.95
    });
    tintedGlassMat.userData = { isVehicleGlass: true, tintId: tintEntry.id };

    if (tintEntry.headlightHex) {
      tintedHeadlightMat = getLegoMaterial(tintEntry.headlightHex, {
        emissive: tintEntry.headlightHex,
        emissiveIntensity: 1.15,
        roughness: 0.12
      });
      tintedHeadlightMat.userData = { isVehicleHeadlight: true, tintId: tintEntry.id };
    }
  }

  root.traverse((node) => {
    if (!node.isMesh || node.parent?.name === 'lego_customs_mod_group') return;

    const isGlass = Boolean(
      node.userData?.isVehicleGlass ||
        node.userData?._customsOrigGlassMat ||
        node.material?.userData?.isVehicleGlass
    );
    if (isGlass) {
      node.userData.isVehicleGlass = true;
      if (!node.userData._customsOrigGlassMat) {
        node.userData._customsOrigGlassMat = node.material;
      }
      node.material =
        tintEntry.id === 'stock' || !tintedGlassMat
          ? node.userData._customsOrigGlassMat
          : tintedGlassMat;
    }

    const isHeadlight = Boolean(
      node.userData?.isVehicleHeadlight ||
        node.userData?._customsOrigHeadlightMat ||
        node.material?.userData?.isVehicleHeadlight
    );
    if (isHeadlight) {
      node.userData.isVehicleHeadlight = true;
      if (!node.userData._customsOrigHeadlightMat) {
        node.userData._customsOrigHeadlightMat = node.material;
      }
      node.material = tintedHeadlightMat || node.userData._customsOrigHeadlightMat;
    }
  });
}

export function applyTuningToVehicleObject(carObj, tuningInput) {
  const isDirectGroup = Boolean(carObj?.isObject3D && !carObj?.mesh);
  const root = isDirectGroup ? carObj : carObj?.mesh;
  if (!root) return null;

  const baseType = tuningInput?.carType || root.userData?.carType || 'apex_gtx';
  const baseSpec = VEHICLE_SPECS[baseType] || VEHICLE_SPECS.apex_gtx;
  const defTuning = createDefaultVehicleTuning(carObj);
  const tuning = {
    ...defTuning,
    ...(tuningInput || {}),
    carType: baseType,
    levels: {
      ...defTuning.levels,
      ...(tuningInput?.levels || {})
    }
  };

  const primaryHex = getPaletteHex(tuning.primaryColorId, 0xfacc15);
  const secondaryHex = getPaletteHex(tuning.secondaryColorId, 0x090a0d);
  const wheelHex = getPaletteHex(tuning.wheelColorId, 0xcbd5e1);

  // Reconstrói malha limpa dentro do mesmo `root` (preservando referência em `ThirdPersonController` e `DestructibleManager`!)
  while (root.children.length > 0) {
    root.remove(root.children[0]);
  }
  delete root.userData._nightLightRig;

  const freshGroup = createLegoCarMesh({
    type: baseType,
    color: primaryHex,
    roofColor: secondaryHex,
    wheelColor: wheelHex,
    finishStyle: tuning.finishId,
    suppressDefaultSpoiler: tuning.spoilerId !== 'gt_carbon'
  });

  // Transfere filhos e metadados do modelo base recém-gerado para `root`
  const bodyLiftY = tuning.wheelStyleId === 'monster_truck' ? 0.56 : 0;
  const baseWheelSet = new Set(
    (freshGroup.userData.wheels || []).map((w) => w.steerGroup)
  );

  while (freshGroup.children.length > 0) {
    const ch = freshGroup.children[0];
    freshGroup.remove(ch);
    if (!baseWheelSet.has(ch) && bodyLiftY > 0) {
      ch.position.y += bodyLiftY;
    }
    root.add(ch);
  }

  root.userData.carType = baseType;
  root.userData.carName = tuning.customName || baseSpec.name;
  root.userData.initialColors = { color: primaryHex, roofColor: secondaryHex };
  root.userData.wheels = freshGroup.userData.wheels || [];
  root.userData.turretGroup = freshGroup.userData.turretGroup || null;
  root.userData.turboFlames = freshGroup.userData.turboFlames || [];
  root.userData.turboFlameMesh = freshGroup.userData.turboFlameMesh || null;
  root.userData.chassisDims = freshGroup.userData.chassisDims;

  for (const fg of root.userData.turboFlames) {
    if (fg) fg.userData.isNitroFlame = true;
  }

  // Película dos Vidros & Faróis (guardando _customsOrigGlassMat para restaurar no 'stock')
  applyWindowAndHeadlightTint(root, tuning.windowTintId || 'stock');

  const dims = measureVehicleBounds(root);

  // Subgrupo dedicado de Mods 3D, Decals, Teto, Escapamentos, Monster Suspension e Underglow
  const modGroup = new THREE.Group();
  modGroup.name = 'lego_customs_mod_group';
  const finishOpts = getFinishMaterialOpts(tuning.finishId);
  const secMat = getLegoMaterial(secondaryHex, finishOpts);
  const carbonMat = getLegoMaterial(0x0f172a, { roughness: 0.28, metalness: 0.35 });
  const chromeMat = getLegoMaterial(0xe2e8f0, { roughness: 0.1, metalness: 0.88 });
  const titaniumBlueMat = getLegoMaterial(0x38bdf8, { roughness: 0.14, metalness: 0.92, emissive: 0x0284c7, emissiveIntensity: 0.25 });
  const heatShieldMat = getLegoMaterial(0x94a3b8, { roughness: 0.22, metalness: 0.78 });
  const yellowHazardMat = getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.5 });
  const redFuelMat = getLegoMaterial(0xdc2626, { roughness: 0.24, clearcoat: 0.45 });
  const whiteLedMat = getLegoMaterial(0xf8fafc, { emissive: 0xffffff, emissiveIntensity: 1.35 });
  const policeRedMat = getLegoMaterial(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 1.2 });
  const policeBlueMat = getLegoMaterial(0x3b82f6, { emissive: 0x2563eb, emissiveIntensity: 1.2 });
  const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const extraJetFlames = [];

  const registerNitroFlame = (flameObj) => {
    if (!flameObj) return;
    flameObj.visible = false;
    flameObj.userData.isNitroFlame = true;
    extraJetFlames.push(flameObj);
    root.userData.turboFlames.push(flameObj);
  };

  // --------------------------------------------------------------------------
  // A) ADESIVOS / DECALS EM CANVAS (CARROS, MOTOS, CAMINHÕES & ÔNIBUS!)
  // --------------------------------------------------------------------------
  if (tuning.decalId && tuning.decalId !== 'none') {
    const topTex = createVehicleDecalTexture(tuning.decalId, secondaryHex, 'top');
    const sideTex = createVehicleDecalTexture(tuning.decalId, secondaryHex, 'side');
    const topDecalMat = new THREE.MeshStandardMaterial({
      map: topTex,
      transparent: true,
      roughness: finishOpts.roughness,
      metalness: finishOpts.metalness,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3
    });
    const sideDecalMat = new THREE.MeshStandardMaterial({
      map: sideTex,
      transparent: true,
      roughness: finishOpts.roughness,
      metalness: finishOpts.metalness,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3
    });

    if (!dims.isMoto) {
      if (!dims.isBus) {
        const hoodPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(dims.w * 0.82, Math.min(2.0, dims.d * 0.28)),
          topDecalMat
        );
        hoodPlane.rotation.x = -Math.PI / 2;
        hoodPlane.position.set(0, dims.topY + bodyLiftY + 0.12, dims.d * 0.31);
        modGroup.add(hoodPlane);
      }

      if (!dims.openTop) {
        const roofPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(dims.cabinW * 0.86, dims.cabinD * 0.82),
          topDecalMat
        );
        roofPlane.rotation.x = -Math.PI / 2;
        roofPlane.position.set(0, dims.roofY + bodyLiftY + 0.13, dims.cabinZ);
        modGroup.add(roofPlane);
      }

      const sidePanelH = dims.isBus ? 0.95 : Math.max(0.55, dims.h * 0.82);
      const sidePanelY = dims.isBus ? 0.96 + bodyLiftY : 0.44 + dims.h * 0.5 + bodyLiftY;
      for (const sx of [-1, 1]) {
        const doorPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(dims.d * 0.62, sidePanelH),
          sideDecalMat
        );
        doorPlane.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        doorPlane.position.set(sx * (dims.w * 0.5 + 0.02), sidePanelY, 0);
        modGroup.add(doorPlane);
      }
    } else {
      for (const sx of [-1, 1]) {
        const tankDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.36), sideDecalMat);
        tankDecal.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        tankDecal.position.set(sx * 0.57, 1.22 + bodyLiftY, 0.45);
        const tailDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.22), sideDecalMat);
        tailDecal.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        tailDecal.position.set(sx * 0.44, 1.12 + bodyLiftY, -1.06);
        modGroup.add(tankDecal, tailDecal);
      }
    }
  }

  // --------------------------------------------------------------------------
  // B) AEROFÓLIOS TRASEIROS 3D, TURBINA A JATO & PARAQUEDAS / WHEELIE BAR (UNIVERSAL!)
  // --------------------------------------------------------------------------
  const rearFaceZ = -dims.d * 0.5;
  const wingZ = -dims.d * 0.46;
  const wingBaseY = (dims.isEnclosedBoxRear ? dims.roofY : dims.topY) + bodyLiftY;
  const rearHullY = (dims.isEnclosedBoxRear ? 0.96 : dims.topY) + bodyLiftY;

  if (dims.isMoto) {
    if (tuning.spoilerId === 'low_sport') {
      const tailLip = createLegoBrick(0.86, 0.12, 0.42, secondaryHex, { studStep: 0.4 });
      tailLip.rotation.x = 0.16;
      tailLip.position.set(0, 1.34 + bodyLiftY, -1.36);
      modGroup.add(tailLip);
    } else if (tuning.spoilerId === 'gt_carbon') {
      const wingW = 1.24;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.08, 0.38), carbonMat);
      blade.position.set(0, 1.56 + bodyLiftY, -1.48);
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.22), carbonMat);
        post.position.set(sx * 0.3, 1.38 + bodyLiftY, -1.44);
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.44), secMat);
        endplate.position.set(sx * (wingW * 0.5), 1.57 + bodyLiftY, -1.48);
        modGroup.add(post, endplate);
      }
      modGroup.add(blade);
    } else if (tuning.spoilerId === 'dual_jet_turbine') {
      // 2 Micro-Turbinas a Jato acopladas nas laterais traseiras da moto!
      for (const sx of [-0.48, 0.48]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.95, 14), chromeMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(sx, 1.08 + bodyLiftY, -1.24);
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 12), carbonMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(sx, 1.08 + bodyLiftY, -1.78);
        const core = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), cyanGlowMat);
        core.rotation.x = Math.PI / 2;
        core.position.set(sx, 1.08 + bodyLiftY, -1.89);
        const jetCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.17, 1.35, 10),
          new THREE.MeshBasicMaterial({ color: 0x00e5ff })
        );
        jetCone.rotation.x = -Math.PI / 2;
        jetCone.position.set(sx, 1.08 + bodyLiftY, -2.52);
        registerNitroFlame(jetCone);
        modGroup.add(pod, nozzle, core, jetCone);
      }
    } else if (tuning.spoilerId === 'drag_parachute') {
      // Wheelie Bar traseira (rodinha anti-empinada de arrancada) + mini-paraquedas!
      for (const sx of [-0.22, 0.22]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.18, 8), chromeMat);
        bar.rotation.x = Math.PI / 2 + 0.22;
        bar.position.set(sx, 0.42, -1.88);
        modGroup.add(bar);
      }
      const rollerAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 8), chromeMat);
      rollerAxle.rotation.z = Math.PI / 2;
      rollerAxle.position.set(0, 0.22, -2.42);
      const rollerWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 12), carbonMat);
      rollerWheel.rotation.z = Math.PI / 2;
      rollerWheel.position.set(0, 0.22, -2.42);
      const chutePack = createLegoBrick(0.42, 0.34, 0.32, 0x0f172a, { studs: false });
      chutePack.position.set(0, 1.22 + bodyLiftY, -1.68);
      const chuteStrap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.34), redFuelMat);
      chuteStrap.position.set(0, 1.22 + bodyLiftY, -1.68);
      modGroup.add(rollerAxle, rollerWheel, chutePack, chuteStrap);
    }
  } else {
    const scaleHeavy = dims.d > 5.5 ? 1.22 : 1.0;
    if (tuning.spoilerId === 'low_sport') {
      const lip = createLegoBrick(dims.w * 0.94, 0.14 * scaleHeavy, 0.44 * scaleHeavy, secondaryHex, { studStep: 0.55 });
      lip.position.set(0, wingBaseY + 0.22, wingZ);
      for (const sx of [-1, 1]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.26), carbonMat);
        strut.position.set(sx * dims.w * 0.32, wingBaseY + 0.1, wingZ);
        modGroup.add(strut);
      }
      modGroup.add(lip);
    } else if (tuning.spoilerId === 'gt_carbon') {
      const wingW = dims.w + 0.32;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.12 * scaleHeavy, 0.64 * scaleHeavy), carbonMat);
      blade.position.set(0, wingBaseY + 0.72 * scaleHeavy, wingZ - 0.08);
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.72 * scaleHeavy, 0.34), carbonMat);
        post.position.set(sx * (dims.w * 0.36), wingBaseY + 0.36 * scaleHeavy, wingZ - 0.06);
        const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38 * scaleHeavy, 0.74 * scaleHeavy), secMat);
        endplate.position.set(sx * (wingW * 0.5), wingBaseY + 0.74 * scaleHeavy, wingZ - 0.08);
        modGroup.add(post, endplate);
      }
      modGroup.add(blade);
    } else if (tuning.spoilerId === 'dual_jet_turbine') {
      const podSpread = dims.w * 0.26;
      const podR = 0.32 * scaleHeavy;
      const turbineZ = dims.isEnclosedBoxRear ? rearFaceZ - 0.45 : wingZ - 0.15;
      for (const sx of [-podSpread, podSpread]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(podR, podR * 1.18, 1.35 * scaleHeavy, 14), chromeMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(sx, rearHullY + 0.36, turbineZ);

        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(podR * 0.88, podR * 0.68, 0.34, 14), carbonMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(sx, rearHullY + 0.36, turbineZ - 0.74 * scaleHeavy);

        const coreGlow = new THREE.Mesh(new THREE.CylinderGeometry(podR * 0.56, podR * 0.56, 0.12, 12), cyanGlowMat);
        coreGlow.rotation.x = Math.PI / 2;
        coreGlow.position.set(sx, rearHullY + 0.36, turbineZ - 0.88 * scaleHeavy);

        const jetCone = new THREE.Mesh(
          new THREE.ConeGeometry(podR * 0.85, 1.95 * scaleHeavy, 10),
          new THREE.MeshBasicMaterial({ color: 0x00e5ff })
        );
        jetCone.rotation.x = -Math.PI / 2;
        jetCone.position.set(sx, rearHullY + 0.36, turbineZ - 1.82 * scaleHeavy);
        registerNitroFlame(jetCone);

        modGroup.add(pod, nozzle, coreGlow, jetCone);
      }
    } else if (tuning.spoilerId === 'drag_parachute') {
      const packW = Math.min(1.1, dims.w * 0.36);
      const chutePack = createLegoBrick(packW, 0.52, 0.46, 0x0f172a, { studs: false });
      chutePack.position.set(0, rearHullY + 0.18, rearFaceZ - 0.28);
      const crossRibbonA = new THREE.Mesh(new THREE.BoxGeometry(packW + 0.04, 0.1, 0.48), redFuelMat);
      crossRibbonA.position.set(0, rearHullY + 0.18, rearFaceZ - 0.28);
      const crossRibbonB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.54, 0.48), yellowHazardMat);
      crossRibbonB.position.set(0, rearHullY + 0.18, rearFaceZ - 0.28);
      modGroup.add(chutePack, crossRibbonA, crossRibbonB);

      for (const sx of [-0.46, 0.46]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.25, 8), chromeMat);
        strut.rotation.x = Math.PI / 2 + 0.16;
        strut.position.set(sx, 0.38, rearFaceZ - 0.52);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.14, 12), carbonMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx, 0.22, rearFaceZ - 1.08);
        modGroup.add(strut, wheel);
      }
    }
  }

  // --------------------------------------------------------------------------
  // C) FRENTE ESPECIAL 3D (SPLITTER/WINGLETS, QUEBRA-MATO/CRASH BAR & RAMPA CUNHA!)
  // --------------------------------------------------------------------------
  const noseZ = dims.frontZ || dims.d * 0.5 + 0.05;
  if (dims.isMoto) {
    if (tuning.frontModId === 'sport_splitter') {
      // Asas aerodinâmicas laterais estilo MotoGP!
      for (const sx of [-1, 1]) {
        const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.46), carbonMat);
        winglet.rotation.z = sx * -0.26;
        winglet.position.set(sx * 0.56, 1.16 + bodyLiftY, 1.18);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.48), secMat);
        fin.position.set(sx * 0.72, 1.12 + bodyLiftY, 1.18);
        modGroup.add(winglet, fin);
      }
    } else if (tuning.frontModId === 'armored_bullbar') {
      // Protetor de motor tubular (Crash Bar)!
      for (const sx of [-1, 1]) {
        const cage = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.54, 0.62), chromeMat);
        cage.position.set(sx * 0.52, 0.78 + bodyLiftY, 0.48);
        const slider = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10), yellowHazardMat);
        slider.rotation.z = Math.PI / 2;
        slider.position.set(sx * 0.66, 0.82 + bodyLiftY, 0.52);
        modGroup.add(cage, slider);
      }
      const crossBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.14, 10), chromeMat);
      crossBar.rotation.z = Math.PI / 2;
      crossBar.position.set(0, 0.98 + bodyLiftY, 0.78);
      modGroup.add(crossBar);
    } else if (tuning.frontModId === 'wedge_ram') {
      // Lâmina frontal interceptadora para motos!
      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(0, 0.24 + bodyLiftY * 0.35, noseZ + 0.36);
      const plow = createLegoBrick(1.32, 0.12, 0.95, 0x1e293b, { studs: false });
      plow.rotation.x = 0.46;
      plow.position.set(0, 0.24, 0);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.09, 0.22), yellowHazardMat);
      edge.position.set(0, 0.05, 0.44);
      for (const sx of [-1, 1]) {
        const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.88), yellowHazardMat);
        sidePlate.position.set(sx * 0.66, 0.22, -0.02);
        bladeGroup.add(sidePlate);
      }
      bladeGroup.add(plow, edge);
      modGroup.add(bladeGroup);
    }
  } else {
    const heavyScaleH = dims.d > 5.5 ? 1.25 : 1.0;
    if (tuning.frontModId === 'sport_splitter') {
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.26, 0.12 * heavyScaleH, 0.64), carbonMat);
      splitter.position.set(0, 0.32 + bodyLiftY, noseZ + 0.22);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.28, 0.05, 0.68), yellowHazardMat);
      trim.position.set(0, 0.26 + bodyLiftY, noseZ + 0.24);
      modGroup.add(splitter, trim);
    } else if (tuning.frontModId === 'armored_bullbar') {
      const mainBar = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.2, 0.74 * heavyScaleH, 0.34), chromeMat);
      mainBar.position.set(0, 0.72 * heavyScaleH + bodyLiftY, noseZ + 0.24);
      const guardSpread = dims.w * 0.32;
      for (const sx of [-guardSpread, 0, guardSpread]) {
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.92 * heavyScaleH, 0.4), carbonMat);
        guard.position.set(sx, 0.76 * heavyScaleH + bodyLiftY, noseZ + 0.26);
        modGroup.add(guard);
      }
      modGroup.add(mainBar);
    } else if (tuning.frontModId === 'wedge_ram') {
      // RAMPA CUNHA FRONTAL (WEDGE RAM) escalonada proporcionalmente a dims.w!
      const wedgeGroup = new THREE.Group();
      wedgeGroup.position.set(0, 0.18 + bodyLiftY * 0.35, noseZ + 0.58);

      const rampSlope = createLegoBrick(dims.w + 0.34, 0.16, 1.48, 0x1e293b, { studStep: 0.6 });
      rampSlope.rotation.x = 0.46;
      rampSlope.position.set(0, 0.34 * heavyScaleH, 0);
      wedgeGroup.add(rampSlope);

      const frontLip = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.38, 0.12, 0.28), yellowHazardMat);
      frontLip.position.set(0, 0.06, 0.68);
      wedgeGroup.add(frontLip);

      for (const sx of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6 * heavyScaleH, 1.34), yellowHazardMat);
        cheek.position.set(sx * (dims.w * 0.5 + 0.14), 0.32 * heavyScaleH, -0.04);
        wedgeGroup.add(cheek);
      }
      modGroup.add(wedgeGroup);
    }
  }

  // --------------------------------------------------------------------------
  // D) ACESSÓRIOS DE TETO, CARENAGEM & PAREDÃO DE SOM (`tuning.roofModId`)
  // --------------------------------------------------------------------------
  const roofMountY = (dims.openTop && !dims.isMoto ? dims.topY + 0.55 : dims.roofY) + bodyLiftY;
  const roofFrontZ = dims.cabinZ + dims.cabinD * 0.38;

  if (tuning.roofModId === 'rally_led_bar') {
    if (dims.isMoto) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.1), carbonMat);
      bar.position.set(0, 1.66 + bodyLiftY, 1.14);
      modGroup.add(bar);
      for (const lx of [-0.26, 0.26]) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 12), carbonMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(lx, 1.66 + bodyLiftY, 1.18);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 12), whiteLedMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(lx, 1.66 + bodyLiftY, 1.26);
        modGroup.add(pod, lens);
      }
    } else {
      const barW = dims.cabinW * 0.88;
      const rack = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.1, 0.18), carbonMat);
      rack.position.set(0, roofMountY + 0.16, roofFrontZ);
      modGroup.add(rack);
      const podCount = dims.w > 2.6 ? 6 : 4;
      for (let i = 0; i < podCount; i++) {
        const t = podCount === 1 ? 0 : i / (podCount - 1) - 0.5;
        const lx = t * (barW - 0.34);
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 12), carbonMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(lx, roofMountY + 0.24, roofFrontZ + 0.04);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 12), whiteLedMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(lx, roofMountY + 0.24, roofFrontZ + 0.14);
        modGroup.add(pod, lens);
      }
    }
  } else if (tuning.roofModId === 'roof_scoop_carbon') {
    if (dims.isMoto) {
      const gpBubble = new THREE.Mesh(
        new THREE.BoxGeometry(0.84, 0.56, 0.36),
        new THREE.MeshPhysicalMaterial({
          color: 0x090d16,
          transparent: true,
          opacity: 0.84,
          roughness: 0.08,
          metalness: 0.65
        })
      );
      gpBubble.rotation.x = -0.58;
      gpBubble.position.set(0, 1.62 + bodyLiftY, 1.12);
      const ramAir = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.32), carbonMat);
      ramAir.position.set(0, 1.38 + bodyLiftY, 1.38);
      modGroup.add(gpBubble, ramAir);
    } else {
      for (const sx of [-0.36, 0.36]) {
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 1.18), carbonMat);
        scoop.position.set(sx, roofMountY + 0.14, dims.cabinZ + 0.18);
        const intake = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.08), yellowHazardMat);
        intake.position.set(sx, roofMountY + 0.14, dims.cabinZ + 0.78);
        modGroup.add(scoop, intake);
      }
    }
  } else if (tuning.roofModId === 'paredao_som_cdd') {
    const speakerColors = [0xff6b00, 0x00e5ff, 0xfacc15, 0xec4899];
    if (dims.isMoto) {
      // Moto: Baú traseiro de som com 2 subwoofers + 2 cornetas!
      const soundBox = createLegoBrick(0.92, 0.52, 0.56, 0x0f172a, { studStep: 0.4 });
      soundBox.position.set(0, 1.48 + bodyLiftY, -1.36);
      modGroup.add(soundBox);
      for (let i = 0; i < 2; i++) {
        const sx = i === 0 ? -0.23 : 0.23;
        const wooferMat = getLegoMaterial(speakerColors[i], { emissive: speakerColors[i], emissiveIntensity: 0.45 });
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.11, 0.08, 14), wooferMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.set(sx, 1.44 + bodyLiftY, -1.66);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 10), chromeMat);
        horn.rotation.x = -Math.PI / 2;
        horn.position.set(sx, 1.66 + bodyLiftY, -1.66);
        modGroup.add(cone, horn);
      }
    } else {
      // Rack acústico LEGO "Paredão de Som Automotivo CDD" com 4 woofers, 4 cornetas cromadas e letreiro LED!
      const wallW = Math.min(2.45, dims.cabinW * 0.96);
      const wallZ = dims.cabinZ - dims.cabinD * 0.15;
      const cabinet = createLegoBrick(wallW, 0.86, 0.72, 0x111827, { studStep: 0.55 });
      cabinet.position.set(0, roofMountY + 0.46, wallZ);
      modGroup.add(cabinet);

      for (let i = 0; i < 4; i++) {
        const t = i / 3 - 0.5;
        const wx = t * (wallW - 0.52);
        const cHex = speakerColors[i % speakerColors.length];
        const wooferMat = getLegoMaterial(cHex, { emissive: cHex, emissiveIntensity: 0.55 });
        const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.12, 16), wooferMat);
        woofer.rotation.x = Math.PI / 2;
        woofer.position.set(wx, roofMountY + 0.36, wallZ - 0.38);

        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 12), chromeMat);
        horn.rotation.x = Math.PI / 2;
        horn.position.set(wx, roofMountY + 0.72, wallZ - 0.4);
        modGroup.add(woofer, horn);
      }

      const ledHeader = new THREE.Mesh(
        new THREE.PlaneGeometry(wallW * 0.94, 0.26),
        new THREE.MeshBasicMaterial({ map: getParedaoSignTexture() })
      );
      ledHeader.rotation.y = Math.PI;
      ledHeader.position.set(0, roofMountY + 1.04, wallZ - 0.37);
      const ledBack = new THREE.Mesh(new THREE.BoxGeometry(wallW * 0.96, 0.28, 0.08), carbonMat);
      ledBack.position.set(0, roofMountY + 1.04, wallZ - 0.33);
      modGroup.add(ledBack, ledHeader);
    }
  } else if (tuning.roofModId === 'stealth_police_lightbar') {
    if (dims.isMoto) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.78, 8), chromeMat);
      mast.position.set(0.32, 1.78 + bodyLiftY, -1.46);
      const beaconR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12), policeRedMat);
      beaconR.position.set(0.32, 2.2 + bodyLiftY, -1.46);
      const frontL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.12), policeRedMat);
      frontL.position.set(-0.46, 1.36 + bodyLiftY, 1.38);
      const frontR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.12), policeBlueMat);
      frontR.position.set(0.46, 1.36 + bodyLiftY, 1.38);
      modGroup.add(mast, beaconR, frontL, frontR);
    } else {
      const lbW = dims.cabinW * 0.82;
      const centerPod = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.34), carbonMat);
      centerPod.position.set(0, roofMountY + 0.16, dims.cabinZ + 0.1);
      const leftPod = new THREE.Mesh(new THREE.BoxGeometry(lbW * 0.44, 0.18, 0.32), policeRedMat);
      leftPod.position.set(-lbW * 0.26, roofMountY + 0.16, dims.cabinZ + 0.1);
      const rightPod = new THREE.Mesh(new THREE.BoxGeometry(lbW * 0.44, 0.18, 0.32), policeBlueMat);
      rightPod.position.set(lbW * 0.26, roofMountY + 0.16, dims.cabinZ + 0.1);
      modGroup.add(centerPod, leftPod, rightPod);
    }
  } else if (tuning.roofModId === 'expedition_rack') {
    if (dims.isBus || dims.d > 7.0) {
      // Ônibus: Letreiro digital luminoso superior "EXPRESSO CDD // VIP TURBO" + A/C duplo VIP no teto!
      const signHousing = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.46, 0.28), carbonMat);
      signHousing.position.set(0, roofMountY + 0.28, dims.d * 0.46);
      const signScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(2.32, 0.38),
        new THREE.MeshBasicMaterial({ map: getVipBusSignTexture() })
      );
      signScreen.position.set(0, roofMountY + 0.28, dims.d * 0.46 + 0.15);
      modGroup.add(signHousing, signScreen);

      for (const az of [2.1, -2.1]) {
        const vipAc = createLegoBrick(1.96, 0.34, 2.05, 0x0f172a, { studStep: 0.65 });
        vipAc.position.set(0, roofMountY + 0.32, az);
        const cyanStrip = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 2.08), cyanGlowMat);
        cyanStrip.position.set(0, roofMountY + 0.5, az);
        modGroup.add(vipAc, cyanStrip);
      }
    } else if (dims.isMoto) {
      // Moto: Par de alforjes laterais táticos rígidos!
      for (const sx of [-1, 1]) {
        const bag = createLegoBrick(0.32, 0.46, 0.76, 0x1e293b, { studs: false });
        bag.position.set(sx * 0.56, 1.02 + bodyLiftY, -0.98);
        const latch = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.78), yellowHazardMat);
        latch.position.set(sx * 0.56, 1.12 + bodyLiftY, -0.98);
        modGroup.add(bag, latch);
      }
    } else {
      // Carros / Picapes / Caminhões: Grade de expedição no teto com estepe e galões vermelhos!
      const rackW = dims.cabinW * 0.88;
      const rackD = Math.min(2.4, dims.cabinD * 0.85);
      const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(rackW, 0.1, rackD), carbonMat);
      baseFrame.position.set(0, roofMountY + 0.12, dims.cabinZ);
      const spareTire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.28, 16),
        getLegoMaterial(0x090a0d, { roughness: 0.68 })
      );
      spareTire.position.set(-rackW * 0.18, roofMountY + 0.32, dims.cabinZ - 0.15);
      const spareRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 12), chromeMat);
      spareRim.position.set(-rackW * 0.18, roofMountY + 0.32, dims.cabinZ - 0.15);
      modGroup.add(baseFrame, spareTire, spareRim);

      for (const gz of [-0.32, 0.26]) {
        const jerrycan = createLegoBrick(0.32, 0.42, 0.44, 0xdc2626, { studs: false });
        jerrycan.position.set(rackW * 0.28, roofMountY + 0.36, dims.cabinZ + gz);
        modGroup.add(jerrycan);
      }
    }
  }

  // --------------------------------------------------------------------------
  // E) ESCAPAMENTOS & CHAMINÉS (`tuning.exhaustModId`)
  // --------------------------------------------------------------------------
  if (tuning.exhaustModId === 'titanium_dual') {
    const tipSpread = dims.isMoto ? 0.48 : dims.w * 0.28;
    const tipY = (dims.isMoto ? 0.94 : 0.44) + bodyLiftY;
    const tipZ = dims.isMoto ? -1.68 : rearFaceZ - 0.14;
    for (const sx of [-tipSpread, tipSpread]) {
      for (const subOff of [-0.09, 0.09]) {
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.42, 12), titaniumBlueMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.set(sx + (dims.isMoto ? 0 : subOff), tipY, tipZ);
        modGroup.add(tip);
        if (dims.isMoto) break;
      }
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 1.35, 10),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff })
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(sx, tipY, tipZ - 0.85);
      registerNitroFlame(flame);
      modGroup.add(flame);
    }
  } else if (tuning.exhaustModId === 'side_flamethrower') {
    const sideX = dims.isMoto ? 0.54 : dims.w * 0.5 + 0.08;
    const pipeY = (dims.isMoto ? 0.52 : 0.36) + bodyLiftY;
    const pipeLen = dims.isMoto ? 1.65 : Math.min(3.2, dims.d * 0.52);
    for (const sx of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, pipeLen, 12), chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx * sideX, pipeY, -0.15);

      const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.32, 10), titaniumBlueMat);
      outlet.rotation.z = sx * (Math.PI / 2);
      outlet.position.set(sx * (sideX + 0.1), pipeY, -pipeLen * 0.42);

      const sideFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.19, 1.28, 10),
        new THREE.MeshBasicMaterial({ color: 0xff6b00 })
      );
      sideFlame.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      sideFlame.position.set(sx * (sideX + 0.82), pipeY, -pipeLen * 0.42);
      registerNitroFlame(sideFlame);
      modGroup.add(pipe, outlet, sideFlame);
    }
  } else if (tuning.exhaustModId === 'chrome_truck_stacks') {
    // Duas imponentes chaminés verticais cromadas com protetor térmico subindo atrás da cabine soltando chamas pro alto!
    const stackH = dims.isMoto ? 1.55 : dims.isBus ? 2.85 : 2.35;
    const stackR = dims.isMoto ? 0.085 : 0.15;
    const stackX = dims.isMoto ? 0.46 : dims.w * 0.5 + 0.12;
    const stackZ = dims.isMoto ? -1.38 : dims.isBus ? -dims.d * 0.42 : dims.cabinZ - dims.cabinD * 0.52;
    const stackBaseY = (dims.isMoto ? 0.85 : 0.55) + bodyLiftY;

    for (const sx of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(stackR, stackR, stackH, 14), chromeMat);
      pipe.position.set(sx * stackX, stackBaseY + stackH * 0.5, stackZ);

      const shield = new THREE.Mesh(
        new THREE.CylinderGeometry(stackR * 1.32, stackR * 1.32, stackH * 0.62, 12, 1, true),
        heatShieldMat
      );
      shield.position.set(sx * stackX, stackBaseY + stackH * 0.42, stackZ);

      const topTurnout = new THREE.Mesh(new THREE.CylinderGeometry(stackR * 1.12, stackR, 0.28, 12), chromeMat);
      topTurnout.rotation.z = sx * -0.22;
      topTurnout.position.set(sx * (stackX + 0.04), stackBaseY + stackH + 0.08, stackZ);

      const upFlame = new THREE.Mesh(
        new THREE.ConeGeometry(stackR * 1.55, 1.55, 10),
        new THREE.MeshBasicMaterial({ color: 0xff6b00 })
      );
      upFlame.position.set(sx * (stackX + 0.06), stackBaseY + stackH + 0.92, stackZ);
      registerNitroFlame(upFlame);

      modGroup.add(pipe, shield, topTurnout, upFlame);
    }
  }

  // --------------------------------------------------------------------------
  // F) ESTILO DE PNEUS (RODA LARGA ESPORTIVA OU PNEUS MONSTER TRUCK ELEVADOS!)
  // --------------------------------------------------------------------------
  const wheelMat = getLegoMaterial(wheelHex, { metalness: 0.65, roughness: 0.16, clearcoat: 0.7 });
  const tireRubberMat = getLegoMaterial(0x090a0d, { roughness: 0.65 });

  if (Array.isArray(root.userData.wheels)) {
    for (const w of root.userData.wheels) {
      if (tuning.wheelStyleId === 'wide_sport') {
        w.steerGroup.scale.set(1.42, 1.06, 1.06);
        const neonRing = new THREE.Mesh(
          new THREE.CylinderGeometry(dims.wheelRadius * 0.76, dims.wheelRadius * 0.76, 0.45, 16),
          cyanGlowMat
        );
        neonRing.rotation.z = Math.PI / 2;
        w.spinGroup.add(neonRing);
      } else if (tuning.wheelStyleId === 'monster_truck') {
        const mRadius = dims.isMoto ? 0.78 : 0.88;
        const mWidth = dims.isMoto ? 0.68 : 0.86;
        w.steerGroup.position.y = mRadius;
        if (!dims.isMoto) {
          w.steerGroup.position.x += Math.sign(w.steerGroup.position.x || 1) * 0.36;
        }
        while (w.spinGroup.children.length > 0) {
          w.spinGroup.remove(w.spinGroup.children[0]);
        }
        const bigTire = new THREE.Mesh(
          new THREE.CylinderGeometry(mRadius, mRadius, mWidth, 18),
          tireRubberMat
        );
        bigTire.rotation.z = Math.PI / 2;
        const bigRim = new THREE.Mesh(
          new THREE.CylinderGeometry(mRadius * 0.52, mRadius * 0.52, mWidth + 0.04, 14),
          wheelMat
        );
        bigRim.rotation.z = Math.PI / 2;
        w.spinGroup.add(bigTire, bigRim);

        const shock = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11, 0.11, 0.72, 8),
          yellowHazardMat
        );
        shock.position.set(-Math.sign(w.steerGroup.position.x || 1) * 0.22, 0.42, 0);
        w.steerGroup.add(shock);
      }
    }
  }

  // --------------------------------------------------------------------------
  // G) LUZ NEON SUB-CHASSI (UNDERGLOW ADITIVO LEVE A 60 FPS) & CHAMA COLORIDA
  // --------------------------------------------------------------------------
  const ugEntry = CUSTOMS_UNDERGLOW.find((u) => u.id === tuning.underglowId) || CUSTOMS_UNDERGLOW[0];
  let underglowMesh = null;
  let flameTintMat = null;

  if (ugEntry.id !== 'off') {
    const ugMat = new THREE.MeshBasicMaterial({
      color: ugEntry.hex || 0x00f0ff,
      map: getUnderglowGradientTexture(),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    underglowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(dims.w * 1.65, dims.d * 1.32),
      ugMat
    );
    underglowMesh.rotation.x = -Math.PI / 2;
    underglowMesh.position.set(0, 0.07, 0);
    modGroup.add(underglowMesh);

    for (const sx of [-1, 1]) {
      const neonTube = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.07, dims.d * 0.74),
        ugMat
      );
      neonTube.position.set(sx * (dims.w * 0.48), 0.34 + bodyLiftY, 0);
      modGroup.add(neonTube);
    }

    flameTintMat = new THREE.MeshBasicMaterial({ color: ugEntry.hex || 0x00f0ff });
    if (root.userData.turboFlameMesh) {
      root.userData.turboFlameMesh.material = flameTintMat;
    }
    for (const jf of extraJetFlames) {
      if (jf.isMesh) jf.material = flameTintMat;
    }
  }

  root.add(modGroup);

  // Calcula e grava os atributos físicos reais (0–10) no veículo!
  const tunedSpec = computeTunedVehicleStats(baseSpec, tuning);
  root.userData.customTuning = tuning;
  root.userData.vehicleSpec = tunedSpec;
  root.userData._underglowMesh = underglowMesh;
  root.userData._flameTintMat = flameTintMat;
  root.userData._measuredBounds = dims;

  if (!isDirectGroup) {
    carObj.maxHp = tunedSpec.maxHp;
    carObj.hp = tunedSpec.maxHp;
  }

  ensureVehicleNightLights(root, tunedSpec);

  return tunedSpec;
}

/**
 * Atualiza a pulsação RGB em tempo real da Luz Neon Sub-Chassi e da Chama do Nitro!
 */
export function updateVehicleDynamicTuningFX(carObj, timeSec = 0) {
  const tuning = carObj?.mesh?.userData?.customTuning;
  if (!tuning || tuning.underglowId !== 'rgb') return 0x00f0ff;

  const hue = (timeSec * 0.38) % 1.0;
  const col = new THREE.Color().setHSL(hue, 1.0, 0.55);
  const ugMesh = carObj.mesh.userData._underglowMesh;
  if (ugMesh?.material) {
    ugMesh.material.color.copy(col);
  }
  const flameMat = carObj.mesh.userData._flameTintMat;
  if (flameMat) {
    flameMat.color.copy(col);
  }
  return col.getHex();
}

export function getVehicleCustomFlameHex(carObj, timeSec = 0) {
  const tuning = carObj?.mesh?.userData?.customTuning;
  if (!tuning || !tuning.underglowId || tuning.underglowId === 'off') return null;
  if (tuning.underglowId === 'rgb') {
    return updateVehicleDynamicTuningFX(carObj, timeSec);
  }
  return CUSTOMS_UNDERGLOW.find((u) => u.id === tuning.underglowId)?.hex ?? null;
}
