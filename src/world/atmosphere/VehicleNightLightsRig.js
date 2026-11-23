import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries } from '../BuildingGenerator.js';

// Geometrias e Materiais Compartilhados para os Faróis Noturnos (Zero GC + 2 Draw Calls Instanciados no Trânsito!)
let SHARED_HEADLIGHT_CONE_GEO = null;
let SHARED_HEADLIGHT_CONE_MAT = null;
let SHARED_TAILLIGHT_GLOW_GEO = null;
let SHARED_TAILLIGHT_GLOW_MAT = null;
const SHARED_VEHICLE_LIGHT_RIG_GEOS = new Map();

export const MAX_TRAFFIC_LIGHT_PAIRS = 96;
export const MAX_TRAFFIC_LIGHT_INSTANCES = MAX_TRAFFIC_LIGHT_PAIRS * 2;
const TRAFFIC_LIGHT_MAX_DIST_SQ = 195 * 195;

// Temporários pré-alocados no módulo (Zero alocação de heap por frame!)
const _tmpMat4 = new THREE.Matrix4();
const _localMat4 = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3(1, 1, 1);
const _instCursor = { headIdx: 0, tailIdx: 0 };

export function ensureSharedVehicleLightAssets() {
  if (SHARED_HEADLIGHT_CONE_GEO) return;

  // Cone apontando para +Z (frente dos veículos LEGO), origem na lente do farol!
  SHARED_HEADLIGHT_CONE_GEO = markAsSharedAsset(new THREE.ConeGeometry(2.35, 13.5, 12, 1, true));
  SHARED_HEADLIGHT_CONE_GEO.rotateX(-Math.PI / 2);
  SHARED_HEADLIGHT_CONE_GEO.translate(0, -0.18, 6.75);

  SHARED_HEADLIGHT_CONE_MAT = markAsSharedAsset(
    new THREE.MeshBasicMaterial({
      color: 0xfef3c7,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  SHARED_HEADLIGHT_CONE_MAT.userData = {
    ...SHARED_HEADLIGHT_CONE_MAT.userData,
    isDynamicMaterial: true
  };

  SHARED_TAILLIGHT_GLOW_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.46, 0.26, 0.16));
  SHARED_TAILLIGHT_GLOW_MAT = markAsSharedAsset(
    new THREE.MeshBasicMaterial({
      color: 0xff1e42,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  SHARED_TAILLIGHT_GLOW_MAT.userData = {
    ...SHARED_TAILLIGHT_GLOW_MAT.userData,
    isDynamicMaterial: true
  };
}

/**
 * Garante um único SpotLight permanente e SEMPRE visível (`visible = true`) na cena para o farol
 * do veículo conduzido pelo jogador, alternando apenas `intensity` (0 <-> 3.8) para evitar
 * mutações em `numSpotLights` e recompilação síncrona de shaders PBR na cidade inteira!
 */
export function ensurePermanentPlayerHeadlightSpot(mgr) {
  if (!mgr || !mgr.scene) return null;
  if (!mgr._playerHeadlightSpot) {
    const spot = new THREE.SpotLight(0xfffbeb, 0, 74, Math.PI * 0.25, 0.52, 1.25);
    spot.name = 'PlayerVehicleHeadlightSpot';
    spot.castShadow = false;
    spot.visible = true;
    spot.intensity = 0;
    spot.position.set(0, -500, 0);
    spot.target.position.set(0, -500, -10);
    mgr.scene.add(spot);
    mgr.scene.add(spot.target);
    spot.updateMatrixWorld(true);
    spot.target.updateMatrixWorld(true);
    mgr._playerHeadlightSpot = spot;
    mgr._spotOriginTmp = new THREE.Vector3();
    mgr._spotTargetTmp = new THREE.Vector3();
  } else {
    mgr._playerHeadlightSpot.visible = true;
    if (!mgr._playerHeadlightSpot.parent) {
      mgr.scene.add(mgr._playerHeadlightSpot);
    }
    if (mgr._playerHeadlightSpot.target && !mgr._playerHeadlightSpot.target.parent) {
      mgr.scene.add(mgr._playerHeadlightSpot.target);
    }
  }
  return mgr._playerHeadlightSpot;
}

/**
 * Garante sob demanda os 2 `THREE.InstancedMesh` globais para todos os faróis e lanternas
 * noturnas dos veículos de trânsito IA e comboios motorizados (2 Draw Calls totais!).
 */
function ensureTrafficNightLightInstancedMeshes(mgr) {
  if (!mgr || !mgr.scene) return false;
  ensureSharedVehicleLightAssets();

  if (!mgr._trafficHeadlightInst) {
    const hInst = new THREE.InstancedMesh(
      SHARED_HEADLIGHT_CONE_GEO,
      SHARED_HEADLIGHT_CONE_MAT,
      MAX_TRAFFIC_LIGHT_INSTANCES
    );
    hInst.name = 'TrafficHeadlightConesInst';
    hInst.frustumCulled = false;
    hInst.castShadow = false;
    hInst.receiveShadow = false;
    hInst.count = 0;
    hInst.visible = false;
    hInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mgr.scene.add(hInst);
    mgr._trafficHeadlightInst = hInst;
  } else if (!mgr._trafficHeadlightInst.parent) {
    mgr.scene.add(mgr._trafficHeadlightInst);
  }

  if (!mgr._trafficTaillightInst) {
    const tInst = new THREE.InstancedMesh(
      SHARED_TAILLIGHT_GLOW_GEO,
      SHARED_TAILLIGHT_GLOW_MAT,
      MAX_TRAFFIC_LIGHT_INSTANCES
    );
    tInst.name = 'TrafficTaillightGlowInst';
    tInst.frustumCulled = false;
    tInst.castShadow = false;
    tInst.receiveShadow = false;
    tInst.count = 0;
    tInst.visible = false;
    tInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mgr.scene.add(tInst);
    mgr._trafficTaillightInst = tInst;
  } else if (!mgr._trafficTaillightInst.parent) {
    mgr.scene.add(mgr._trafficTaillightInst);
  }

  return true;
}

function appendInstancedVehicleLights(carMesh, spec, headInst, tailInst, cursor) {
  const carType = carMesh.userData?.carType || '';
  const isMoto = Boolean(spec?.isMotorcycle || carType.startsWith('moto_'));
  const isBus =
    spec?.id === 'onibus_urbano' ||
    spec?.id === 'carro_forte' ||
    carType === 'onibus_urbano' ||
    carType === 'carro_forte';
  const needed = isMoto ? 1 : 2;
  if (
    cursor.headIdx + needed > MAX_TRAFFIC_LIGHT_INSTANCES ||
    cursor.tailIdx + needed > MAX_TRAFFIC_LIGHT_INSTANCES
  ) {
    return false;
  }

  const halfLen = isBus ? 4.6 : isMoto ? 1.35 : 2.35;
  const xSep = isMoto ? 0.0 : isBus ? 1.05 : 0.82;
  const headY = isBus ? 0.85 : 0.68;

  let baseMat;
  if (carMesh.parent && !carMesh.parent.isScene) {
    carMesh.updateMatrixWorld();
    baseMat = carMesh.matrixWorld;
  } else {
    carMesh.updateMatrix();
    baseMat = carMesh.matrix;
  }

  if (isMoto) {
    _tmpPos.set(0, headY, halfLen);
    _tmpQuat.identity();
    _tmpScale.set(0.75, 0.75, 0.9);
    _localMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
    _tmpMat4.multiplyMatrices(baseMat, _localMat4);
    headInst.setMatrixAt(cursor.headIdx++, _tmpMat4);

    _localMat4.identity();
    _localMat4.setPosition(0, headY + 0.05, -halfLen);
    _tmpMat4.multiplyMatrices(baseMat, _localMat4);
    tailInst.setMatrixAt(cursor.tailIdx++, _tmpMat4);
    return true;
  }

  _localMat4.identity();
  _localMat4.setPosition(-xSep, headY, halfLen);
  _tmpMat4.multiplyMatrices(baseMat, _localMat4);
  headInst.setMatrixAt(cursor.headIdx++, _tmpMat4);

  _localMat4.setPosition(xSep, headY, halfLen);
  _tmpMat4.multiplyMatrices(baseMat, _localMat4);
  headInst.setMatrixAt(cursor.headIdx++, _tmpMat4);

  _localMat4.setPosition(-xSep, headY + 0.04, -halfLen - 0.05);
  _tmpMat4.multiplyMatrices(baseMat, _localMat4);
  tailInst.setMatrixAt(cursor.tailIdx++, _tmpMat4);

  _localMat4.setPosition(xSep, headY + 0.04, -halfLen - 0.05);
  _tmpMat4.multiplyMatrices(baseMat, _localMat4);
  tailInst.setMatrixAt(cursor.tailIdx++, _tmpMat4);
  return true;
}

function getMergedVehicleRigGeos(isMoto, isBus, halfLen, xSep, headY) {
  const key = `${isMoto ? 1 : 0}_${isBus ? 1 : 0}`;
  const cached = SHARED_VEHICLE_LIGHT_RIG_GEOS.get(key);
  if (cached) return cached;

  const coneGeos = [];
  const tailGeos = [];
  if (isMoto) {
    const cg = SHARED_HEADLIGHT_CONE_GEO.clone();
    cg.scale(0.75, 0.75, 0.9);
    cg.translate(0, headY, halfLen);
    coneGeos.push(cg);

    const tg = SHARED_TAILLIGHT_GLOW_GEO.clone();
    tg.translate(0, headY + 0.05, -halfLen);
    tailGeos.push(tg);
  } else {
    for (const sx of [-xSep, xSep]) {
      const cg = SHARED_HEADLIGHT_CONE_GEO.clone();
      cg.translate(sx, headY, halfLen);
      coneGeos.push(cg);

      const tg = SHARED_TAILLIGHT_GLOW_GEO.clone();
      tg.translate(sx, headY + 0.04, -halfLen - 0.05);
      tailGeos.push(tg);
    }
  }
  const pair = {
    conesGeo: markAsSharedAsset(mergeBufferGeometries(coneGeos)),
    tailsGeo: markAsSharedAsset(mergeBufferGeometries(tailGeos))
  };
  SHARED_VEHICLE_LIGHT_RIG_GEOS.set(key, pair);
  return pair;
}

/**
 * Anexa sob demanda (apenas para o veículo conduzido pelo jogador) 1 Mesh unificada para os faróis e 1 para lanternas.
 */
export function ensureVehicleNightLights(carGroup, spec = null, mgr = null) {
  if (mgr) ensurePermanentPlayerHeadlightSpot(mgr);
  if (!carGroup) return null;
  if (carGroup.userData._nightLightRig) {
    return carGroup.userData._nightLightRig;
  }

  ensureSharedVehicleLightAssets();

  const isMoto = Boolean(spec?.isMotorcycle);
  const isBus = spec?.id === 'onibus_urbano' || spec?.id === 'carro_forte';
  const halfLen = isBus ? 4.6 : isMoto ? 1.35 : 2.35;
  const xSep = isMoto ? 0.0 : isBus ? 1.05 : 0.82;
  const headY = isBus ? 0.85 : 0.68;

  const rig = new THREE.Group();
  rig.name = 'vehicle_night_light_rig';
  rig.userData.isNightLightRig = true;
  rig.visible = false;

  const { conesGeo, tailsGeo } = getMergedVehicleRigGeos(isMoto, isBus, halfLen, xSep, headY);
  const conesMesh = new THREE.Mesh(conesGeo, SHARED_HEADLIGHT_CONE_MAT);
  const tailsMesh = new THREE.Mesh(tailsGeo, SHARED_TAILLIGHT_GLOW_MAT);
  conesMesh.userData.isNightHeadlightCone = true;
  tailsMesh.userData.isNightHeadlightCone = true;
  conesMesh.matrixAutoUpdate = false;
  tailsMesh.matrixAutoUpdate = false;
  conesMesh.updateMatrix();
  tailsMesh.updateMatrix();
  rig.add(conesMesh, tailsMesh);

  carGroup.add(rig);
  carGroup.userData._nightLightRig = rig;
  return rig;
}

// ============================================================================
// VAGÕES DO METRÔ ILUMINADOS À NOITE + FARÓIS INSTANCIADOS DO TRÂNSITO/COMBOIOS
// ============================================================================
export function initMetroNightEnhancements(mgr) {
  ensureSharedVehicleLightAssets();
  ensurePermanentPlayerHeadlightSpot(mgr);

  const ms = mgr.world.metroSystem;
  if (!ms || !Array.isArray(ms.trains)) return;

  for (const tr of ms.trains) {
    const leadCar = tr.cars?.[0];
    if (!leadCar?.group) continue;

    // Encontra o material de vidro compartilhado dos vagões para acender o interior à noite
    leadCar.group.traverse((child) => {
      if (child.isMesh && child.material?.transparent && !mgr._metroGlassMat) {
        mgr._metroGlassMat = child.material;
        if (!mgr._metroGlassMat.emissive) {
          mgr._metroGlassMat.emissive = new THREE.Color(0xfef08a);
        } else {
          mgr._metroGlassMat.emissive.setHex(0xfef08a);
        }
        mgr._metroGlassMat.emissiveIntensity = 0;
      }
    });

    const conePairGeos = [];
    for (const sx of [-1.25, 1.25]) {
      const cg = SHARED_HEADLIGHT_CONE_GEO.clone();
      cg.scale(1.35, 1.35, 1.65);
      cg.translate(sx, 1.35, 6.85);
      conePairGeos.push(cg);
    }
    const coneGroup = new THREE.Group();
    coneGroup.add(new THREE.Mesh(markAsSharedAsset(mergeBufferGeometries(conePairGeos)), SHARED_HEADLIGHT_CONE_MAT));
    coneGroup.visible = false;
    leadCar.group.add(coneGroup);
    mgr.metroLeadCones.push(coneGroup);
  }
}

export function updateMetroAndSharedVehicleMaterials(mgr, nf, vehicleLightsOn) {
  ensureSharedVehicleLightAssets();
  SHARED_HEADLIGHT_CONE_MAT.opacity = vehicleLightsOn ? nf * 0.32 : 0.0;
  SHARED_TAILLIGHT_GLOW_MAT.opacity = vehicleLightsOn ? nf * 0.92 : 0.0;

  if (mgr._metroGlassMat) {
    mgr._metroGlassMat.emissiveIntensity = nf * 1.15;
  }
  for (const mc of mgr.metroLeadCones) {
    mc.visible = vehicleLightsOn;
  }
}

export function updateAllVehicleHeadlights(mgr, playerPos, controller, vehicleLightsOn) {
  const spot = ensurePermanentPlayerHeadlightSpot(mgr);
  const drivenObj = controller?.currentVehicle || null;

  if (drivenObj && drivenObj.mesh && !drivenObj.destroyed) {
    const rig = ensureVehicleNightLights(drivenObj.mesh, drivenObj.mesh.userData?.vehicleSpec, mgr);
    if (mgr._lastDrivenRig && mgr._lastDrivenRig !== rig) {
      mgr._lastDrivenRig.visible = false;
    }
    if (rig) rig.visible = vehicleLightsOn;
    mgr._lastDrivenRig = rig;

    if (vehicleLightsOn && spot) {
      drivenObj.mesh.localToWorld(mgr._spotOriginTmp.set(0, 1.05, 2.35));
      drivenObj.mesh.localToWorld(mgr._spotTargetTmp.set(0, -0.45, 36.0));
      spot.position.copy(mgr._spotOriginTmp);
      spot.target.position.copy(mgr._spotTargetTmp);
      spot.target.updateMatrixWorld();
      spot.intensity = drivenObj.puncturedTires ? 3.2 : 3.8;
      spot.visible = true;
    } else if (spot) {
      const wasLit = spot.intensity > 0;
      spot.intensity = 0;
      spot.visible = true;
      if (wasLit) {
        spot.position.set(0, -500, 0);
        spot.target.position.set(0, -500, -10);
        spot.target.updateMatrixWorld();
      }
    }
  } else {
    if (mgr._lastDrivenRig) {
      mgr._lastDrivenRig.visible = false;
      mgr._lastDrivenRig = null;
    }
    if (spot) {
      const wasLit = spot.intensity > 0;
      spot.intensity = 0;
      spot.visible = true;
      if (wasLit) {
        spot.position.set(0, -500, 0);
        spot.target.position.set(0, -500, -10);
        spot.target.updateMatrixWorld();
      }
    }
  }

  if (!vehicleLightsOn) {
    if (mgr._trafficHeadlightInst) {
      mgr._trafficHeadlightInst.count = 0;
      mgr._trafficHeadlightInst.visible = false;
    }
    if (mgr._trafficTaillightInst) {
      mgr._trafficTaillightInst.count = 0;
      mgr._trafficTaillightInst.visible = false;
    }
    return;
  }

  const lc = mgr.world?.livingCity;
  if (!lc || !ensureTrafficNightLightInstancedMeshes(mgr)) {
    if (mgr._trafficHeadlightInst) {
      mgr._trafficHeadlightInst.count = 0;
      mgr._trafficHeadlightInst.visible = false;
    }
    if (mgr._trafficTaillightInst) {
      mgr._trafficTaillightInst.count = 0;
      mgr._trafficTaillightInst.visible = false;
    }
    return;
  }

  const headInst = mgr._trafficHeadlightInst;
  const tailInst = mgr._trafficTaillightInst;
  _instCursor.headIdx = 0;
  _instCursor.tailIdx = 0;

  if (Array.isArray(lc.trafficVehicles)) {
    for (let i = 0; i < lc.trafficVehicles.length; i++) {
      const tv = lc.trafficVehicles[i];
      if (!tv.mesh || !tv.mesh.visible || !tv.destructible || tv.destructible.destroyed) continue;
      if (tv.destructible.isBurnedWreck || tv.destructible === drivenObj || tv.hijackedByPlayer) continue;
      if (playerPos) {
        const dx = tv.mesh.position.x - playerPos.x;
        const dz = tv.mesh.position.z - playerPos.z;
        if (dx * dx + dz * dz > TRAFFIC_LIGHT_MAX_DIST_SQ) continue;
      }
      if (!appendInstancedVehicleLights(tv.mesh, tv.spec, headInst, tailInst, _instCursor)) {
        break;
      }
    }
  }

  if (lc.factionWar && Array.isArray(lc.factionWar.activeConvoyDrops)) {
    for (let i = 0; i < lc.factionWar.activeConvoyDrops.length; i++) {
      const cv = lc.factionWar.activeConvoyDrops[i];
      if (!cv.mesh || !cv.mesh.visible) continue;
      if (cv.carObj?.destroyed || cv.carObj?.isBurnedWreck || (drivenObj && cv.carObj === drivenObj)) continue;
      if (playerPos) {
        const dx = cv.mesh.position.x - playerPos.x;
        const dz = cv.mesh.position.z - playerPos.z;
        if (dx * dx + dz * dz > TRAFFIC_LIGHT_MAX_DIST_SQ) continue;
      }
      if (!appendInstancedVehicleLights(cv.mesh, cv.mesh.userData?.vehicleSpec, headInst, tailInst, _instCursor)) {
        break;
      }
    }
  }

  headInst.count = _instCursor.headIdx;
  tailInst.count = _instCursor.tailIdx;
  headInst.visible = _instCursor.headIdx > 0;
  tailInst.visible = _instCursor.tailIdx > 0;
  if (_instCursor.headIdx > 0) headInst.instanceMatrix.needsUpdate = true;
  if (_instCursor.tailIdx > 0) tailInst.instanceMatrix.needsUpdate = true;
}
