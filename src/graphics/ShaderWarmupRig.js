import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial, markAsSharedAsset } from '../materials/LegoMaterials.js';
import {
  ensurePermanentPlayerHeadlightSpot,
  ensureSharedVehicleLightAssets
} from '../world/atmosphere/VehicleNightLightsRig.js';
import { getAllFacadeFamilyMaterials } from '../world/buildings/BuildingFamiliesAndAtlas.js';
import { getSharedVertexColorMaterial } from '../world/BuildingGenerator.js';
import { createFactionSoldierVisual } from '../entities/FactionSoldierBuilder.js';
import { consolidateObjectMaterials } from './MaterialRegistry.js';

// Geometrias minúsculas (0.05m) compartilhadas para pré-aquecimento de todos os arquétipos de shader!
const WARMUP_BOX_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.05, 0.05, 0.05));
const WARMUP_VC_BOX_GEO = (() => {
  const g = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const count = g.attributes.position.count;
  const cols = new Float32Array(count * 3);
  cols.fill(1.0);
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return markAsSharedAsset(g);
})();
const WARMUP_SPHERE_GEO = markAsSharedAsset(new THREE.SphereGeometry(0.03, 8, 8));
const WARMUP_CONE_GEO = markAsSharedAsset(new THREE.ConeGeometry(0.03, 0.06, 8, 1, true));

const WARMUP_OPAQUE_BASIC_MAT = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0xffffff }));
const WARMUP_FIRE_TRANSPARENT_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.88 })
);
const WARMUP_RING_TRANSPARENT_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false
  })
);
const WARMUP_BLOOD_POOL_BASIC_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({
    color: 0x7f1d1d,
    transparent: true,
    opacity: 0.88,
    depthWrite: false
  })
);
const WARMUP_SPOTLIGHT_CONE_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  })
);

let _soldierBlueprintsWarmed = false;
const _soldierWarmupMaterials = [];

function ensureSoldierBlueprintsAndMaterialsWarmed() {
  if (_soldierBlueprintsWarmed) return _soldierWarmupMaterials;
  _soldierBlueprintsWarmed = true;

  const matSet = new Set();
  for (const f of ['cv', 'pcc', 'ares']) {
    for (const r of ['rifleman', 'tank', 'medic', 'special', 'boss']) {
      const vis = createFactionSoldierVisual(f, r);
      vis?.bodyRig?.traverse?.((node) => {
        if (!node?.isMesh || !node.material) return;
        if (Array.isArray(node.material)) {
          for (let mi = 0; mi < node.material.length; mi++) {
            if (node.material[mi]) matSet.add(node.material[mi]);
          }
        } else {
          matSet.add(node.material);
        }
      });
    }
  }
  for (const m of matSet) {
    _soldierWarmupMaterials.push(m);
  }
  return _soldierWarmupMaterials;
}

function getRuntimeWarmupSamples() {
  const baseSamples = [
    // PBR Matte & Glossy
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(LEGO_COLORS.concrete, { roughness: 0.72, metalness: 0.05 }) },
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(LEGO_COLORS.silver, { roughness: 0.18, metalness: 0.85 }) },
    // Vidro transparente PBR
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(0x38bdf8, { transparent: true, opacity: 0.45, roughness: 0.12 }) },
    // Emissive Neon (ciano, carmesim, âmbar, violeta)
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(0x22d3ee, { emissive: 0x06b6d4, emissiveIntensity: 2.6, roughness: 0.08 }) },
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(0xdc2626, { emissive: 0xef4444, emissiveIntensity: 2.2, roughness: 0.12 }) },
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(0xf59e0b, { emissive: 0xfef08a, emissiveIntensity: 2.4, roughness: 0.1 }) },
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 2.5, roughness: 0.1 }) },
    // Clearcoat máximo (Moto Fantasma / carenagens)
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(0x090a0d, { roughness: 0.14, clearcoat: 1.0 }) },
    // Carcaça carbonizada / destroço metálico escuro
    { geo: WARMUP_BOX_GEO, mat: getLegoMaterial(0x18181b, { roughness: 0.92, metalness: 0.15 }) },
    // Sangue arterial PBR & poça básica
    { geo: WARMUP_SPHERE_GEO, mat: getLegoMaterial(0x7f1d1d, { roughness: 0.16, clearcoat: 0.85 }) },
    { geo: WARMUP_BOX_GEO, mat: WARMUP_BLOOD_POOL_BASIC_MAT },
    // Esferas de explosão / fogo / fumaça & anel de onda de choque DoubleSide
    { geo: WARMUP_SPHERE_GEO, mat: WARMUP_OPAQUE_BASIC_MAT },
    { geo: WARMUP_SPHERE_GEO, mat: WARMUP_FIRE_TRANSPARENT_MAT },
    { geo: WARMUP_BOX_GEO, mat: WARMUP_RING_TRANSPARENT_MAT },
    // Cone volumétrico de holofote policial / farol aditivo
    { geo: WARMUP_CONE_GEO, mat: WARMUP_SPOTLIGHT_CONE_MAT }
  ];

  const seenMats = new Set();
  const samples = [];
  const pushUniqueMat = (mat, fallbackGeo = WARMUP_BOX_GEO) => {
    if (!mat || seenMats.has(mat)) return;
    seenMats.add(mat);
    const geo = mat.vertexColors ? WARMUP_VC_BOX_GEO : fallbackGeo;
    samples.push({ geo, mat });
  };

  for (let i = 0; i < baseSamples.length; i++) {
    pushUniqueMat(baseSamples[i].mat, baseSamples[i].geo);
  }

  const soldierMats = ensureSoldierBlueprintsAndMaterialsWarmed();
  for (let i = 0; i < soldierMats.length; i++) {
    pushUniqueMat(soldierMats[i], WARMUP_BOX_GEO);
  }

  const facadeFamilyMats = getAllFacadeFamilyMaterials();
  for (let i = 0; i < facadeFamilyMats.length; i++) {
    pushUniqueMat(facadeFamilyMats[i], WARMUP_VC_BOX_GEO);
  }

  pushUniqueMat(getSharedVertexColorMaterial({ roughness: 0.48, metalness: 0.1 }), WARMUP_VC_BOX_GEO);
  pushUniqueMat(getSharedVertexColorMaterial(), WARMUP_VC_BOX_GEO);

  return samples;
}

/**
 * Pré-aquece todos os programas GLSL de runtime (incluindo luzes permanentes e Moto Fantasma)
 * durante o carregamento inicial, antes do Frame 1, eliminando travadinhas em combate/veículos!
 */
export function prewarmAllRuntimeShaders(renderer, scene, camera, world = null, destructibles = null) {
  if (!scene) {
    return {
      warmedMaterialsCount: 0,
      permanentSpotReady: false,
      ghostBikePrewarmed: false
    };
  }

  ensureSharedVehicleLightAssets();
  if (world?.atmosphere) {
    ensurePermanentPlayerHeadlightSpot(world.atmosphere);
  }

  destructibles?.prewarmTurboGhostBike?.();
  const bikeObj = destructibles?._turboGhostBikeObj || null;
  const bikeMesh = bikeObj?.mesh || null;
  if (bikeMesh) {
    consolidateObjectMaterials(bikeMesh, world);
  }

  const fw = world?.livingCity?.factionWar || null;
  if (fw) {
    fw._prewarmWarPoolsOnce?.();
    fw.prewarmTerritoryAnchors?.();
    // Pré-aquece bustos de ocupantes de facção (cv/pcc/ares) e caminhos JIT de spawn sem deixar resíduos!
    for (const fKey of ['cv', 'pcc', 'ares']) {
      const zSt = fw.territories?.[fKey];
      if (zSt?.outposts?.[0]) {
        const op0 = zSt.outposts[0];
        fw._spawnMotorizedSquad?.({ faction: fKey, isAllied: fKey === fw.playerFaction, zoneState: zSt, playerPos: { x: op0.x, y: 1, z: op0.z }, target: op0 });
      }
    }
    fw._cleanupActiveZoneUnits?.();
    if (fw._soldierVisualPool) {
      for (const bucket of fw._soldierVisualPool.values()) {
        for (let i = 0; i < bucket.length; i++) {
          if (bucket[i]?.root) consolidateObjectMaterials(bucket[i].root, world);
        }
      }
    }
    if (fw._convoyCarPool) {
      for (const bucket of fw._convoyCarPool.values()) {
        for (let i = 0; i < bucket.length; i++) {
          consolidateObjectMaterials(bucket[i], world);
        }
      }
    }
  }

  const camPos = camera?.position ? camera.position.clone() : new THREE.Vector3(0, 2, 0);
  const camFwd = new THREE.Vector3(0, 0, -1);
  if (camera && typeof camera.getWorldDirection === 'function') {
    camera.updateMatrixWorld?.(true);
    camera.getWorldDirection(camFwd);
    if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1);
  }
  const frontPos = camPos.clone().addScaledVector(camFwd, 12.0);

  const warmupGroup = new THREE.Group();
  warmupGroup.name = 'ShaderWarmupRigGroup';
  warmupGroup.position.copy(frontPos);
  warmupGroup.frustumCulled = false;

  const samples = getRuntimeWarmupSamples();
  for (let i = 0; i < samples.length; i++) {
    const m = new THREE.Mesh(samples[i].geo, samples[i].mat);
    m.position.set((i % 8) * 0.08 - 0.28, Math.floor(i / 8) * 0.08 - 0.2, 0);
    m.frustumCulled = false;
    warmupGroup.add(m);
  }

  const instMat = getLegoMaterial(LEGO_COLORS.gold, {
    roughness: 0.16,
    metalness: 0.55,
    clearcoat: 0.65,
    emissive: 0xd97706,
    emissiveIntensity: 0.3
  });
  const instSample = new THREE.InstancedMesh(WARMUP_BOX_GEO, instMat, 1);
  instSample.setMatrixAt(0, new THREE.Matrix4());
  instSample.instanceMatrix.needsUpdate = true;
  instSample.frustumCulled = false;
  warmupGroup.add(instSample);

  const prevBikeState = bikeMesh
    ? {
        visible: bikeMesh.visible,
        pos: bikeMesh.position.clone(),
        matrixWorldAutoUpdate: bikeMesh.matrixWorldAutoUpdate
      }
    : null;

  try {
    if (bikeMesh) {
      bikeMesh.visible = true;
      bikeMesh.position.copy(frontPos);
      bikeMesh.matrixAutoUpdate = true;
      bikeMesh.matrixWorldAutoUpdate = true;
      bikeMesh.updateMatrixWorld(true);
    }

    scene.add(warmupGroup);
    scene.updateMatrixWorld?.(true);

    if (renderer && typeof renderer.compile === 'function' && camera) {
      try {
        renderer.compile(scene, camera);
      } catch (_) {
        // Ignora com segurança em mocks/renderers headless sem contexto WebGL real
      }
    }
  } finally {
    scene.remove(warmupGroup);
    instSample.dispose?.();

    if (bikeMesh && prevBikeState) {
      bikeMesh.position.copy(prevBikeState.pos);
      bikeMesh.visible = prevBikeState.visible;
      bikeMesh.matrixWorldAutoUpdate = prevBikeState.matrixWorldAutoUpdate;
      bikeMesh.updateMatrixWorld(true);
    }
  }

  return {
    warmedMaterialsCount: samples.length + 1,
    permanentSpotReady: Boolean(world?.atmosphere?._playerHeadlightSpot),
    ghostBikePrewarmed: Boolean(bikeObj)
  };
}
