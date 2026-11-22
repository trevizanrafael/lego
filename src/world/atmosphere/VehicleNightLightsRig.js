import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries } from '../BuildingGenerator.js';

// Geometrias e Materiais Compartilhados para os Faróis Noturnos de Todos os Carros e Trens (Zero GC!)
let SHARED_HEADLIGHT_CONE_GEO = null;
let SHARED_HEADLIGHT_CONE_MAT = null;
let SHARED_TAILLIGHT_GLOW_GEO = null;
let SHARED_TAILLIGHT_GLOW_MAT = null;
const SHARED_VEHICLE_LIGHT_RIG_GEOS = new Map();

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
 * Anexa sob demanda (apenas 1x por veículo) 1 Mesh unificada para os faróis e 1 para lanternas traseiras!
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
  rig.visible = false;

  const { conesGeo, tailsGeo } = getMergedVehicleRigGeos(isMoto, isBus, halfLen, xSep, headY);
  const conesMesh = new THREE.Mesh(conesGeo, SHARED_HEADLIGHT_CONE_MAT);
  const tailsMesh = new THREE.Mesh(tailsGeo, SHARED_TAILLIGHT_GLOW_MAT);
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
// VAGÕES DO METRÔ ILUMINADOS À NOITE + FARÓIS DE CARROS / COMBOIOS / JOGADOR
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

    const coneGroup = new THREE.Group();
    for (const sx of [-1.25, 1.25]) {
      const cone = new THREE.Mesh(SHARED_HEADLIGHT_CONE_GEO, SHARED_HEADLIGHT_CONE_MAT);
      cone.position.set(sx, 1.35, 6.85);
      cone.scale.set(1.35, 1.35, 1.65);
      coneGroup.add(cone);
    }
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

  const lc = mgr.world.livingCity;
  if (!lc) return;

  // Faróis e lanternas nos carros em movimento do Trânsito Urbano (culling suave a 220m para 60 FPS!)
  if (Array.isArray(lc.trafficVehicles)) {
    for (let i = 0; i < lc.trafficVehicles.length; i++) {
      const tv = lc.trafficVehicles[i];
      if (!tv.mesh || !tv.destructible || tv.destructible.destroyed) continue;
      if (tv.destructible === drivenObj) continue;

      const rig = ensureVehicleNightLights(tv.mesh, tv.spec);
      if (!rig) continue;

      if (!vehicleLightsOn || tv.hijackedByPlayer) {
        rig.visible = false;
        continue;
      }
      if (playerPos) {
        const dx = tv.mesh.position.x - playerPos.x;
        const dz = tv.mesh.position.z - playerPos.z;
        rig.visible = dx * dx + dz * dz < 220 * 220;
      } else {
        rig.visible = true;
      }
    }
  }

  // Faróis nos Comboios Motorizados da Guerra Territorial quando ativos à noite!
  if (lc.factionWar && Array.isArray(lc.factionWar.activeConvoyDrops)) {
    for (const cv of lc.factionWar.activeConvoyDrops) {
      if (!cv.mesh) continue;
      const rig = ensureVehicleNightLights(cv.mesh, cv.mesh.userData?.vehicleSpec);
      if (rig) rig.visible = vehicleLightsOn;
    }
  }
}
