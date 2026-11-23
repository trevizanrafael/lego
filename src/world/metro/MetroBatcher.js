// Batcher estático (merge de geometrias por material) do metrô.
import * as THREE from 'three';
import { SHARED_STUD_GEO, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { makeFastBox, flushSpatialChunkedBuckets } from '../BuildingGenerator.js';
import { ws } from '../core/WorldLayoutScale.js';

const _UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const _UNIT_POS = _UNIT_BOX.attributes.position.array;
const _UNIT_NRM = _UNIT_BOX.attributes.normal.array;
const _UNIT_UV = _UNIT_BOX.attributes.uv.array;
const _UNIT_IDX = _UNIT_BOX.index.array;
const _tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _tmpQuat = new THREE.Quaternion();
const _tmpMat4 = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpScale = new THREE.Vector3(1, 1, 1);

function makeFastOrientedBox(w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
  if (rotX === 0 && rotY === 0 && rotZ === 0) {
    return makeFastBox(w, h, d, x, y, z);
  }
  _tmpEuler.set(rotX, rotY, rotZ, 'YXZ');
  _tmpQuat.setFromEuler(_tmpEuler);
  const qx = _tmpQuat.x, qy = _tmpQuat.y, qz = _tmpQuat.z, qw = _tmpQuat.w;
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  const r00 = 1 - (yy + zz), r01 = xy - wz, r02 = xz + wy;
  const r10 = xy + wz, r11 = 1 - (xx + zz), r12 = yz - wx;
  const r20 = xz - wy, r21 = yz + wx, r22 = 1 - (xx + yy);

  const pos = new Float32Array(72);
  const nrm = new Float32Array(72);
  for (let i = 0; i < 72; i += 3) {
    const px = _UNIT_POS[i] * w;
    const py = _UNIT_POS[i + 1] * h;
    const pz = _UNIT_POS[i + 2] * d;
    pos[i] = r00 * px + r01 * py + r02 * pz + x;
    pos[i + 1] = r10 * px + r11 * py + r12 * pz + y;
    pos[i + 2] = r20 * px + r21 * py + r22 * pz + z;

    const nx = _UNIT_NRM[i];
    const ny = _UNIT_NRM[i + 1];
    const nz = _UNIT_NRM[i + 2];
    nrm[i] = r00 * nx + r01 * ny + r02 * nz;
    nrm[i + 1] = r10 * nx + r11 * ny + r12 * nz;
    nrm[i + 2] = r20 * nx + r21 * ny + r22 * nz;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(_UNIT_UV.slice(), 2));
  geo.setIndex(new THREE.BufferAttribute(_UNIT_IDX.slice(), 1));
  return geo;
}

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
    safety_yellow_glow: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    viaduct_deck: getLegoMaterial(0xa0a5a9, { roughness: 0.3, clearcoat: 0.35 }),
    viaduct_girder: getLegoMaterial(0x5a5f66, { roughness: 0.32, clearcoat: 0.3 }),
    track_ballast: new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.85 }),
    joint_black: getLegoMaterial(0x111214, { roughness: 0.4 })
  };

  const buckets = new Map();
  for (const k of Object.keys(palette)) {
    buckets.set(k, []);
  }
  const studPositions = [];

  const pushMatrixGeo = (key, geo, x, y, z, rotX = 0, rotY = 0, rotZ = 0) => {
    _tmpEuler.set(rotX, rotY, rotZ, 'YXZ');
    _tmpQuat.setFromEuler(_tmpEuler);
    _tmpPos.set(x, y, z);
    _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
    geo.applyMatrix4(_tmpMat4);
    buckets.get(key).push(geo);
  };

  return {
    studPositions,
    addBox(key, w, h, d, x, y, z) {
      buckets.get(key).push(makeFastBox(w, h, d, x, y, z));
    },
    addOrientedBox(key, w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
      buckets.get(key).push(makeFastOrientedBox(w, h, d, x, y, z, rotX, rotY, rotZ));
    },
    addSphere(key, r, x, y, z) {
      pushMatrixGeo(key, new THREE.SphereGeometry(r, 12, 10), x, y, z);
    },
    flush(scene) {
      const shadowKeys = new Set([
        'ny_truss_green',
        'ny_truss_charcoal',
        'ny_entrance_green',
        'platform_floor',
        'viaduct_deck',
        'viaduct_girder'
      ]);
      flushSpatialChunkedBuckets(scene, buckets, palette, {
        chunkSize: ws(512),
        castShadowFn: (key) => shadowKeys.has(key),
        receiveShadowFn: (_key, mat) => !mat.isMeshBasicMaterial
      });
      buckets.clear();

      if (studPositions.length > 0) {
        const inst = new THREE.InstancedMesh(
          SHARED_STUD_GEO,
          getLegoMaterial(0xfacc15, { roughness: 0.25, clearcoat: 0.45 }),
          studPositions.length
        );
        const dummy = new THREE.Object3D();
        dummy.scale.set(1.08, 1.08, 1.08);
        for (let i = 0; i < studPositions.length; i++) {
          dummy.position.set(studPositions[i][0], studPositions[i][1], studPositions[i][2]);
          dummy.updateMatrix();
          inst.setMatrixAt(i, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        scene.add(inst);
      }
    }
  };
}
