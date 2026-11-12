// Batcher estático (merge de geometrias por material) do metrô.
import * as THREE from 'three';
import { SHARED_STUD_GEO, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';

// ============================================================================
// 3. BATCHER ESTÁTICO DO SISTEMA DE METRÔ (POUCOS DRAW CALLS — 60 FPS!)
// ============================================================================
export function createMetroBatcher() {
  const palette = {
    subway_tile_white: getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.65 }),
    subway_stripe_blue: getLegoMaterial(0x0284c7, { roughness: 0.22, clearcoat: 0.55 }),
    subway_stripe_gold: getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.55 }),
    platform_floor: getLegoMaterial(0xcbd5e1, { roughness: 0.34, clearcoat: 0.25 }),
    plaza_granite: getLegoMaterial(0x94a3b8, { roughness: 0.38, clearcoat: 0.2 }),
    tunnel_concrete: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.68 }),
    tunnel_dark: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 }),
    ny_truss_green: getLegoMaterial(0x1e3a2f, { roughness: 0.34, metalness: 0.42, clearcoat: 0.35 }),
    ny_truss_charcoal: getLegoMaterial(0x27272a, { roughness: 0.34, metalness: 0.48, clearcoat: 0.35 }),
    rail_silver: getLegoMaterial(0xe2e8f0, { roughness: 0.18, metalness: 0.72, clearcoat: 0.7 }),
    wood_sleeper: new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.62 }),
    bench_wood: getLegoMaterial(0x92400e, { roughness: 0.36, clearcoat: 0.3 }),
    ny_entrance_green: getLegoMaterial(0x15803d, { roughness: 0.26, clearcoat: 0.45 }),
    fluorescent_white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    globe_emerald: new THREE.MeshBasicMaterial({ color: 0x4ade80 }),
    safety_yellow_glow: new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  };

  const buckets = new Map();
  for (const k of Object.keys(palette)) {
    buckets.set(k, []);
  }
  const studPositions = [];

  const pushMatrixGeo = (key, geo, x, y, z, rotX = 0, rotY = 0, rotZ = 0) => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ'));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    buckets.get(key).push(geo);
  };

  return {
    studPositions,
    addBox(key, w, h, d, x, y, z) {
      buckets.get(key).push(makeTranslatedBox(w, h, d, x, y, z));
    },
    addOrientedBox(key, w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
      pushMatrixGeo(key, new THREE.BoxGeometry(w, h, d), x, y, z, rotX, rotY, rotZ);
    },
    addSphere(key, r, x, y, z) {
      pushMatrixGeo(key, new THREE.SphereGeometry(r, 12, 10), x, y, z);
    },
    flush(scene) {
      const shadowKeys = new Set([
        'ny_truss_green',
        'ny_truss_charcoal',
        'ny_entrance_green',
        'platform_floor'
      ]);
      for (const [key, geos] of buckets.entries()) {
        if (geos.length === 0) continue;
        const merged = mergeBufferGeometries(geos);
        for (let i = 0; i < geos.length; i++) geos[i].dispose();
        geos.length = 0;
        if (!merged) continue;
        const mat = palette[key];
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = shadowKeys.has(key);
        mesh.receiveShadow = !mat.isMeshBasicMaterial;
        scene.add(mesh);
      }
      buckets.clear();

      if (studPositions.length > 0) {
        const inst = new THREE.InstancedMesh(
          SHARED_STUD_GEO,
          getLegoMaterial(0xfacc15, { roughness: 0.25, clearcoat: 0.45 }),
          studPositions.length
        );
        const dummy = new THREE.Object3D();
        for (let i = 0; i < studPositions.length; i++) {
          dummy.position.set(studPositions[i][0], studPositions[i][1], studPositions[i][2]);
          dummy.scale.set(1.08, 1.08, 1.08);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
      }
    }
  };
}
