import * as THREE from 'three';
import { getLegoMaterial } from '../../materials/LegoMaterials.js';
import { getTerritoryZoneAt } from '../FactionWarSystem.js';
import { HumanoidHealthModel } from '../npc-health/HumanoidHealthModel.js';
import { resetHumanoidLimbPose } from '../npc-health/HumanoidHitReactions.js';
import { IS_SCALED_WORLD, ws } from '../core/WorldLayoutScale.js';
import {
  NPC_HEAD_GEO,
  NPC_FACE_SHELL_GEO,
  NPC_TRAPEZOID_TORSO_GEO,
  NPC_TORSO_DECAL_GEO,
  NPC_HIP_GEO,
  NPC_ARM_GEO,
  NPC_HAND_GEO,
  NPC_LEG_GEO,
  SHARED_CIV_PROP_GEOS,
  CAMERA_FLASH_GEO,
  SHARED_CAMERA_FLASH_MAT,
  getSharedCivilianTorsoMaterial,
  getSharedHumanCivilianFaceMaterial
} from './PedestrianSharedGeometriesAndArchetypes.js';

// Scratch objects para instancing de pedestres (Zero alocação por frame!)
const _PED_ROOT_MAT4 = new THREE.Matrix4();
const _PED_LOCAL_MAT4 = new THREE.Matrix4();
const _PED_WORLD_MAT4 = new THREE.Matrix4();
const _PED_ARM_MAT4 = new THREE.Matrix4();
const _PED_QUAT = new THREE.Quaternion();
const _PED_EULER = new THREE.Euler(0, 0, 0, 'XYZ');
const _PED_POS = new THREE.Vector3();
const _PED_SCALE_ONE = new THREE.Vector3(1, 1, 1);
const _PED_COLOR = new THREE.Color();

export const pedestrianCrowdAndInstancingMethods = {
  _initPedestrianInstancedPools() {
    const maxPeds = 220;
    const mkInst = (geo, mat, cap, withColor = false) => {
      const inst = new THREE.InstancedMesh(geo, mat, cap);
      inst.count = 0;
      inst.castShadow = false;
      inst.receiveShadow = true;
      inst.frustumCulled = false;
      inst.matrixAutoUpdate = false;
      inst.updateMatrix();
      if (withColor) {
        inst.setColorAt(0, _PED_COLOR.setHex(0xffffff));
      }
      this.scene.add(inst);
      return inst;
    };

    const skinMat = getLegoMaterial(0xffffff, { roughness: 0.46, clearcoat: 0.12 });
    const clothMat = getLegoMaterial(0xffffff, { roughness: 0.56, clearcoat: 0.08 });

    this._pedMaxCap = maxPeds;
    this._pedPools = {
      hip: mkInst(NPC_HIP_GEO, clothMat, maxPeds, true),
      torso: mkInst(NPC_TRAPEZOID_TORSO_GEO, clothMat, maxPeds, true),
      legs: mkInst(NPC_LEG_GEO, clothMat, maxPeds * 2, true),
      arms: mkInst(NPC_ARM_GEO, clothMat, maxPeds * 2, true),
      hands: mkInst(NPC_HAND_GEO, skinMat, maxPeds * 2, true),
      head: mkInst(NPC_HEAD_GEO, skinMat, maxPeds, true),
      cameraFlash: mkInst(CAMERA_FLASH_GEO, SHARED_CAMERA_FLASH_MAT, 32, false),
      backProp: mkInst(SHARED_CIV_PROP_GEOS.backpack, clothMat, maxPeds, true),
      faces: new Map(),
      decals: new Map(),
      headProps: new Map(),
      handProps: new Map(),
      all: []
    };
    const { all, hip, torso, legs, arms, hands, head, cameraFlash, backProp } = this._pedPools;
    all.push(hip, torso, legs, arms, hands, head, cameraFlash, backProp);
    this._pedHeadPropMat = getLegoMaterial(0xffffff, { roughness: 0.52, clearcoat: 0.1 });
    this._pedHandPropMat = getLegoMaterial(0xffffff, { roughness: 0.42, clearcoat: 0.14 });
  },

  _getPedSubPool(map, key, createFn) {
    let inst = map.get(key);
    if (!inst) {
      inst = createFn();
      inst.count = 0;
      inst.castShadow = false;
      inst.receiveShadow = true;
      inst.frustumCulled = false;
      inst.matrixAutoUpdate = false;
      inst.updateMatrix();
      this.scene.add(inst);
      map.set(key, inst);
      this._pedPools.all.push(inst);
    }
    return inst;
  },

  _syncPedestrianInstances() {
    const pools = this._pedPools;
    if (!pools) return;

    const allPools = pools.all;
    for (let i = 0; i < allPools.length; i++) {
      allPools[i].count = 0;
    }

    this._pedInstFrameTick = ((this._pedInstFrameTick || 0) + 1) | 0;
    const pPos = this._lastSyncPlayerPos;
    const px = pPos ? pPos.x : NaN;
    const pz = pPos ? pPos.z : NaN;
    const hasPlayerRef = Number.isFinite(px) && Number.isFinite(pz);

    const pushMat = (inst, mat4, colorHex = null) => {
      const idx = inst.count;
      if (idx >= inst.instanceMatrix.count) return;
      inst.setMatrixAt(idx, mat4);
      if (colorHex !== null) {
        inst.setColorAt(idx, _PED_COLOR.setHex(colorHex));
      }
      inst.count = idx + 1;
    };

    const pushRaw16 = (inst, arr, offset, colorHex = null) => {
      const idx = inst.count;
      if (idx >= inst.instanceMatrix.count) return;
      const dst = inst.instanceMatrix.array;
      const base = idx * 16;
      for (let k = 0; k < 16; k++) dst[base + k] = arr[offset + k];
      if (colorHex !== null) {
        inst.setColorAt(idx, _PED_COLOR.setHex(colorHex));
      }
      inst.count = idx + 1;
    };

    const storeRaw16 = (arr, offset, mat4) => {
      const src = mat4.elements;
      for (let k = 0; k < 16; k++) arr[offset + k] = src[k];
    };

    const composePart = (parentMat, pxLocal, pyLocal, pzLocal, rx, ry, rz) => {
      _PED_POS.set(pxLocal, pyLocal, pzLocal);
      _PED_EULER.set(rx, ry, rz);
      _PED_QUAT.setFromEuler(_PED_EULER);
      _PED_LOCAL_MAT4.compose(_PED_POS, _PED_QUAT, _PED_SCALE_ONE);
      _PED_WORLD_MAT4.multiplyMatrices(parentMat, _PED_LOCAL_MAT4);
      return _PED_WORLD_MAT4;
    };

    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i];
      const vis = ped.visual;
      const root = vis?.root;
      if (!root || !root.visible) continue;

      const decalKey = vis.torsoKey || 'casual_denim';
      const decalPool = this._getPedSubPool(pools.decals, decalKey, () =>
        new THREE.InstancedMesh(NPC_TORSO_DECAL_GEO, getSharedCivilianTorsoMaterial(decalKey), this._pedMaxCap)
      );
      const faceKey = vis.faceKey || ped.currentFaceKey || 'civ_calm';
      const facePool = this._getPedSubPool(pools.faces, faceKey, () =>
        new THREE.InstancedMesh(NPC_FACE_SHELL_GEO, getSharedHumanCivilianFaceMaterial(faceKey), this._pedMaxCap)
      );
      const hasHeadProp = Boolean(vis.headPropMesh?.visible && vis.headPropKey && SHARED_CIV_PROP_GEOS[vis.headPropKey]);
      const hasHandProp = Boolean(vis.handPropMesh?.visible && vis.handPropKey && SHARED_CIV_PROP_GEOS[vis.handPropKey]);
      const hasFlash = Boolean(vis.cameraFlashMesh?.visible);
      const hasBackProp = Boolean(vis.backPropMesh?.visible);

      const isFarPed =
        hasPlayerRef &&
        ((root.position.x - px) ** 2 + (root.position.z - pz) ** 2 > 65 * 65);

      if (isFarPed && ped._farMatBuf && ((i + this._pedInstFrameTick) % 3 !== 0)) {
        const buf = ped._farMatBuf;
        pushRaw16(pools.hip, buf, 0, vis.legHex);
        pushRaw16(pools.torso, buf, 16, vis.torsoHex);
        pushRaw16(decalPool, buf, 16);
        pushRaw16(pools.legs, buf, 32, vis.legHex);
        pushRaw16(pools.legs, buf, 48, vis.legHex);
        pushRaw16(pools.head, buf, 64, vis.skinHex);
        pushRaw16(facePool, buf, 64);
        if (hasHeadProp) {
          const hpKey = vis.headPropKey;
          const hpPool = this._getPedSubPool(pools.headProps, hpKey, () => {
            const im = new THREE.InstancedMesh(SHARED_CIV_PROP_GEOS[hpKey], this._pedHeadPropMat, this._pedMaxCap);
            im.setColorAt(0, _PED_COLOR.setHex(0xffffff));
            return im;
          });
          pushRaw16(hpPool, buf, 64, vis.headColor);
        }
        pushRaw16(pools.arms, buf, 80, vis.armHex ?? vis.torsoHex);
        pushRaw16(pools.hands, buf, 80, vis.skinHex);
        pushRaw16(pools.arms, buf, 96, vis.armHex ?? vis.torsoHex);
        pushRaw16(pools.hands, buf, 96, vis.skinHex);
        if (hasHandProp && ped._farHasHandProp) {
          const hpKey = vis.handPropKey;
          const hpPool = this._getPedSubPool(pools.handProps, hpKey, () => {
            const im = new THREE.InstancedMesh(SHARED_CIV_PROP_GEOS[hpKey], this._pedHandPropMat, this._pedMaxCap);
            im.setColorAt(0, _PED_COLOR.setHex(0xffffff));
            return im;
          });
          pushRaw16(hpPool, buf, 112, vis.handPropColor);
        }
        if (hasBackProp && ped._farHasBackProp) {
          pushRaw16(pools.backProp, buf, 128, vis.backPropColor);
        }
        continue;
      }

      const farBuf = isFarPed ? (ped._farMatBuf || (ped._farMatBuf = new Float32Array(144))) : null;

      _PED_QUAT.setFromEuler(root.rotation);
      _PED_ROOT_MAT4.compose(root.position, _PED_QUAT, root.scale || _PED_SCALE_ONE);

      // Cintura (cor da calça igual aos operadores) em y = 0.72
      composePart(_PED_ROOT_MAT4, 0, 0.72, 0, 0, 0, 0);
      pushMat(pools.hip, _PED_WORLD_MAT4, vis.legHex);
      if (farBuf) storeRaw16(farBuf, 0, _PED_WORLD_MAT4);

      // Tronco + Decal em y = 0.86 + 0.38 = 1.24
      composePart(_PED_ROOT_MAT4, 0, 1.24, 0, 0, 0, 0);
      pushMat(pools.torso, _PED_WORLD_MAT4, vis.torsoHex);
      pushMat(decalPool, _PED_WORLD_MAT4);
      if (farBuf) storeRaw16(farBuf, 16, _PED_WORLD_MAT4);

      // Pernas esquerda e direita (pivô y = 0.72 -> sola toca y = 0.00 exato)
      composePart(_PED_ROOT_MAT4, -0.21, 0.72, 0, vis.leftLeg.rotation.x, 0, vis.leftLeg.rotation.z || 0);
      pushMat(pools.legs, _PED_WORLD_MAT4, vis.legHex);
      if (farBuf) storeRaw16(farBuf, 32, _PED_WORLD_MAT4);
      composePart(_PED_ROOT_MAT4, 0.21, 0.72, 0, vis.rightLeg.rotation.x, 0, vis.rightLeg.rotation.z || 0);
      pushMat(pools.legs, _PED_WORLD_MAT4, vis.legHex);
      if (farBuf) storeRaw16(farBuf, 48, _PED_WORLD_MAT4);

      // Cabeça humana + Shell de expressão transparente + Cabelo/Boné em y = 1.95 (base headGroup = 1.62)
      const headYaw = vis.headYaw || 0;
      composePart(_PED_ROOT_MAT4, 0, 1.95, 0, 0, headYaw, 0);
      pushMat(pools.head, _PED_WORLD_MAT4, vis.skinHex);
      pushMat(facePool, _PED_WORLD_MAT4);
      if (farBuf) storeRaw16(farBuf, 64, _PED_WORLD_MAT4);

      if (hasHeadProp) {
        const hpKey = vis.headPropKey;
        const hpPool = this._getPedSubPool(pools.headProps, hpKey, () => {
          const im = new THREE.InstancedMesh(SHARED_CIV_PROP_GEOS[hpKey], this._pedHeadPropMat, this._pedMaxCap);
          im.setColorAt(0, _PED_COLOR.setHex(0xffffff));
          return im;
        });
        pushMat(hpPool, _PED_WORLD_MAT4, vis.headColor);
      }

      // Braço esquerdo + Mão humana em C (cor da pele) em (-0.46, 1.52, 0)
      composePart(_PED_ROOT_MAT4, -0.46, 1.52, 0, vis.leftArm.rotation.x, 0, vis.leftArm.rotation.z);
      pushMat(pools.arms, _PED_WORLD_MAT4, vis.armHex ?? vis.torsoHex);
      pushMat(pools.hands, _PED_WORLD_MAT4, vis.skinHex);
      if (farBuf) storeRaw16(farBuf, 80, _PED_WORLD_MAT4);

      // Braço direito + Mão humana em C + Prop de Mão em (0.46, 1.52, 0)
      composePart(_PED_ROOT_MAT4, 0.46, 1.52, 0, vis.rightArm.rotation.x, 0, vis.rightArm.rotation.z);
      pushMat(pools.arms, _PED_WORLD_MAT4, vis.armHex ?? vis.torsoHex);
      pushMat(pools.hands, _PED_WORLD_MAT4, vis.skinHex);
      _PED_ARM_MAT4.copy(_PED_WORLD_MAT4);
      if (farBuf) storeRaw16(farBuf, 96, _PED_WORLD_MAT4);

      ped._farHasHandProp = hasHandProp;
      if (hasHandProp) {
        const hpKey = vis.handPropKey;
        const hpPool = this._getPedSubPool(pools.handProps, hpKey, () => {
          const im = new THREE.InstancedMesh(SHARED_CIV_PROP_GEOS[hpKey], this._pedHandPropMat, this._pedMaxCap);
          im.setColorAt(0, _PED_COLOR.setHex(0xffffff));
          return im;
        });
        composePart(_PED_ARM_MAT4, 0, -0.64, 0.08, 0, 0, 0);
        pushMat(hpPool, _PED_WORLD_MAT4, vis.handPropColor);
        if (farBuf) storeRaw16(farBuf, 112, _PED_WORLD_MAT4);
      }
      if (hasFlash) {
        composePart(_PED_ARM_MAT4, 0, -0.6, 0.24, 0, 0, 0);
        pushMat(pools.cameraFlash, _PED_WORLD_MAT4);
      }

      // Mochila compacta encostada nas costas (y = 1.24, z = -0.29)
      ped._farHasBackProp = hasBackProp;
      if (hasBackProp) {
        composePart(_PED_ROOT_MAT4, 0, 1.24, -0.29, 0, 0, 0);
        pushMat(pools.backProp, _PED_WORLD_MAT4, vis.backPropColor);
        if (farBuf) storeRaw16(farBuf, 128, _PED_WORLD_MAT4);
      }
    }

    for (let i = 0; i < allPools.length; i++) {
      const inst = allPools[i];
      if (inst.count > 0) {
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      }
    }
  },

  _registerCivilianPedestrian({
    x1,
    z1,
    x2,
    z2,
    uStart = 0.5,
    isChatGroup = false,
    chatPartnerAngle = 0,
    seed = 0,
    corridor = null,
    laneJitter = 0
  }) {
    const rawX = THREE.MathUtils.lerp(x1, x2, uStart);
    const rawZ = THREE.MathUtils.lerp(z1, z2, uStart);
    let safe;
    let activeCorridor = corridor;
    let activeJitter = laneJitter;
    if (IS_SCALED_WORLD) {
      if (
        activeCorridor &&
        !this._isInsideAsphaltRoad(rawX, rawZ, 1.4) &&
        !this._isInsideBuilding(rawX, rawZ, 1.15) &&
        this._isValidDryLandForPedestrian(rawX, rawZ)
      ) {
        safe = { x: rawX, z: rawZ, valid: true };
      } else {
        const sw = this._findSafeSidewalkSpawn(rawX, rawZ, 260, seed);
        safe = sw.valid ? sw : this._findSafeStreetSpawn(rawX, rawZ, 1.35);
        if (sw.corridor) {
          activeCorridor = sw.corridor;
          activeJitter = sw.laneJitter || 0;
          x1 = activeCorridor.axis === 'x' ? activeCorridor.startAlong : activeCorridor.centerCoord + activeJitter;
          z1 = activeCorridor.axis === 'x' ? activeCorridor.centerCoord + activeJitter : activeCorridor.startAlong;
          x2 = activeCorridor.axis === 'x' ? activeCorridor.endAlong : activeCorridor.centerCoord + activeJitter;
          z2 = activeCorridor.axis === 'x' ? activeCorridor.centerCoord + activeJitter : activeCorridor.endAlong;
        }
      }
    } else {
      safe = this._findSafeStreetSpawn(rawX, rawZ, 1.35);
    }
    const archetype = this._pickArchetypeForCoords(safe.x, safe.z, seed);
    const visual = this._buildCivilianLegoMinifig(archetype, seed);

    const terrainY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
    const baseY = this._getPedestrianGroundY(safe.x, safe.z, terrainY);
    visual.root.rotation.order = 'YXZ';
    visual.root.position.set(safe.x, baseY, safe.z);
    if (isChatGroup) {
      visual.root.rotation.y = chatPartnerAngle;
    }

    const humanoidHealth = new HumanoidHealthModel({
      kind: 'civilian',
      maxHp: 100,
      onRecoveredFromDowned: () => {
        ped.isChatGroup = false;
        ped.crouchPanicTimer = 0;
        ped.panicTimer = Math.max(ped.panicTimer || 0, 6.0);
        ped.state = 'PANIC';
        this._setPedestrianFace(ped, 'civ_panic');
      }
    });

    const ped = {
      id: seed, archetype, visual,
      normalFaceKey: visual.preset.faceKey || 'civ_calm',
      currentFaceKey: visual.preset.faceKey || 'civ_calm',
      isChatGroup, chatPartnerAngle, x1, z1, x2, z2,
      corridor: activeCorridor, laneJitter: activeJitter,
      crossState: 'SIDEWALK', activeCrosswalk: null, waitCrossTimer: 0,
      cwWaitX: 0, cwWaitZ: 0, cwDestX: 0, cwDestZ: 0,
      dir: seed % 2 === 0 ? 1 : -1, walkSpeed: visual.preset.speed,
      state: 'NORMAL', canCheerHero: seed % 3 !== 2,
      cheerStyle: seed % 2 === 0 ? 'clap' : 'wave',
      photoFlashTimer: 0, photoCooldown: 0.6 + (seed % 5) * 0.35,
      panicTimer: 0, panicDirX: 0, panicDirZ: 1, crouchPanicTimer: 0,
      vehicleHitCooldown: 0, diveTimer: 0, diveVelX: 0, diveVelZ: 0,
      knockVelX: 0, knockVelZ: 0, isDeadCorpse: false, _corpseSinkOffset: 0,
      animTime: seed * 0.77, humanoidHealth, destructible: null
    };

    if (this.destructibles) {
      const dObj = this.destructibles.registerDestructible({
        mesh: visual.root, type: 'pedestrian_civilian', hp: 100, radius: 0.95, height: 2.25,
        colliders: [], debrisColors: [visual.torsoHex, visual.legHex],
        studDrops: { silver: 2, gold: 0, blue: 1, purple: 0 }, groundY: terrainY, noAutoRespawn: true
      });
      dObj.maxHp = 100;
      dObj.isCivilianPedestrian = true;
      dObj.noAutoRespawn = true;
      dObj.pedestrianRef = ped;
      dObj.visual = visual;
      dObj.humanoidHealth = humanoidHealth;
      dObj.onDamaged = (_amount, hitOrigin, healthRes) => {
        this._onCivilianDamaged(ped, hitOrigin, healthRes);
      };
      ped.destructible = dObj;
    }

    this.pedestrians.push(ped);
    return ped;
  },

  _initPedestrians() {
    const chatSpots = [
      { cx: -22, cz: -132, count: 3 }, { cx: 22, cz: -132, count: 2 },
      { cx: -32, cz: -101, count: 3 }, { cx: 34, cz: -101, count: 2 },
      { cx: -75, cz: -15, count: 3 }, { cx: -195, cz: -52, count: 3 },
      { cx: 65, cz: 22, count: 2 }, { cx: 145, cz: 155, count: 3 },
      { cx: -12, cz: -526, count: 2 }, { cx: 56, cz: -662, count: 2 },
      { cx: -28, cz: 728, count: 3 }, { cx: 15, cz: 765, count: 2 },
      { cx: -502, cz: -132, count: 2 }, { cx: 642, cz: -132, count: 2 }
    ];

    let seedCounter = 1;
    if (IS_SCALED_WORLD && this._validSidewalkCorridors?.length) {
      for (const spot of chatSpots) {
        const sw = this._findSafeSidewalkSpawn(ws(spot.cx), ws(spot.cz), 240, seedCounter);
        const cx = sw.corridor
          ? (sw.corridor.axis === 'x' ? sw.x : sw.corridor.centerCoord)
          : sw.x;
        const cz = sw.corridor
          ? (sw.corridor.axis === 'x' ? sw.corridor.centerCoord : sw.z)
          : sw.z;
        for (let k = 0; k < spot.count; k++) {
          const ang = (k / spot.count) * Math.PI * 2 + 0.35;
          const px = cx + Math.cos(ang) * 1.05;
          const pz = cz + Math.sin(ang) * 1.05;
          const lookToCenter = Math.atan2(cx - px, cz - pz);
          const c = sw.corridor;
          this._registerCivilianPedestrian({
            x1: c ? (c.axis === 'x' ? c.startAlong : px) : px,
            z1: c ? (c.axis === 'x' ? pz : c.startAlong) : pz,
            x2: c ? (c.axis === 'x' ? c.endAlong : px) : px + 18,
            z2: c ? (c.axis === 'x' ? pz : c.endAlong) : pz,
            uStart: c
              ? THREE.MathUtils.clamp(
                  ((c.axis === 'x' ? px : pz) - c.startAlong) / Math.max(1, c.endAlong - c.startAlong),
                  0.05,
                  0.95
                )
              : 0,
            isChatGroup: true,
            chatPartnerAngle: lookToCenter,
            seed: seedCounter++,
            corridor: c
          });
        }
      }

      // Seleciona 64 corredores reais de calçada de 10m distribuídos pelos bairros (mesmo orçamento de 128 pedestres!)
      const routeAnchorHints = [
        [0, -117], [-80, -117], [80, -117], [-120, -180], [120, -180], [-60, -250], [60, -250],
        [-190, -117], [-190, -60], [-120, -40], [120, -40], [-60, 0], [60, 0], [-252, -120],
        [-252, 40], [190, -117], [252, -80], [60, 134], [190, 134], [-60, 134], [-120, 120],
        [252, 120], [60, 402], [-120, 402], [252, 402], [-252, 134], [384, -117], [-384, -117],
        [-60, -512], [60, -512], [60, -644], [-190, -512], [190, -512], [-120, -580], [120, -580],
        [0, -382], [-252, -382], [252, -382], [-190, 710], [0, 710], [190, 710], [320, 710],
        [-320, 710], [-180, 738], [-40, 738], [60, 738], [180, 738], [320, 738],
        [-120, 556], [120, 556], [-516, -180], [-516, -40], [-516, 80], [-516, -320],
        [-384, 60], [-384, -250], [384, 60], [600, -117], [600, -250], [600, 0],
        [768, -117], [768, -250], [964, -117], [600, -512]
      ];
      const chosenCorridors = [];
      const usedSet = new Set();
      for (let h = 0; h < routeAnchorHints.length && chosenCorridors.length < 64; h++) {
        const hx = ws(routeAnchorHints[h][0]);
        const hz = ws(routeAnchorHints[h][1]);
        let bestC = null;
        let bestD = Infinity;
        for (let ci = 0; ci < this._validSidewalkCorridors.length; ci++) {
          const c = this._validSidewalkCorridors[ci];
          if (usedSet.has(c)) continue;
          const d = Math.hypot(c.mx - hx, c.mz - hz);
          if (d < bestD) {
            bestD = d;
            bestC = c;
          }
        }
        if (bestC) {
          usedSet.add(bestC);
          chosenCorridors.push(bestC);
        }
      }
      for (let ci = 0; ci < chosenCorridors.length; ci++) {
        const c = chosenCorridors[ci];
        for (let k = 0; k < 2; k++) {
          const uStart = k === 0 ? 0.24 : 0.76;
          const jit = ((seedCounter % 5) - 2) * 0.85; // dentro de centerCoord ± 1.7m (>= 3.3m longe da guia!)
          const x1 = c.axis === 'x' ? c.startAlong : c.centerCoord + jit;
          const z1 = c.axis === 'x' ? c.centerCoord + jit : c.startAlong;
          const x2 = c.axis === 'x' ? c.endAlong : c.centerCoord + jit;
          const z2 = c.axis === 'x' ? c.centerCoord + jit : c.endAlong;
          this._registerCivilianPedestrian({
            x1,
            z1,
            x2,
            z2,
            uStart,
            isChatGroup: false,
            seed: seedCounter++,
            corridor: c,
            laneJitter: jit
          });
        }
      }
      this._syncPedestrianInstances();
      return;
    }

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

    const sidewalkRoutes = [
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
      { x1: 22, z1: 18, x2: 112, z2: 18 },
      { x1: 138, z1: 18, x2: 242, z2: 18 },
      { x1: -55, z1: 18, x2: -12, z2: 18 },
      { x1: 58, z1: 162, x2: 188, z2: 162 },
      { x1: 58, z1: 362, x2: 225, z2: 362 },
      { x1: 56, z1: 35, x2: 56, z2: 175 },
      { x1: -104, z1: 24, x2: -104, z2: 220 },
      { x1: 268, z1: 24, x2: 268, z2: 240 },
      { x1: -98, z1: -528, x2: 98, z2: -528 },
      { x1: -98, z1: -496, x2: 98, z2: -496 },
      { x1: 18, z1: -662, x2: 115, z2: -662 },
      { x1: -225, z1: -528, x2: -135, z2: -528 },
      { x1: 138, z1: -528, x2: 245, z2: -528 },
      { x1: -104, z1: -655, x2: -104, z2: -535 },
      { x1: 104, z1: -655, x2: 104, z2: -535 },
      { x1: -95, z1: -398, x2: 95, z2: -398 },
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
      { x1: -502, z1: -240, x2: -502, z2: -40 },
      { x1: -502, z1: -20, x2: -502, z2: 180 },
      { x1: -608, z1: -140, x2: -690, z2: -140 },
      { x1: -635, z1: -230, x2: -720, z2: -230 },
      { x1: -618, z1: -45, x2: -712, z2: -45 },
      { x1: -655, z1: 80, x2: -745, z2: 80 },
      { x1: 628, z1: -133, x2: 755, z2: -133 },
      { x1: 628, z1: -265, x2: 755, z2: -265 },
      { x1: 635, z1: -16, x2: 760, z2: -16 },
      { x1: 628, z1: 120, x2: 760, z2: 120 },
      { x1: 628, z1: 280, x2: 780, z2: 280 },
      { x1: 790, z1: 340, x2: 930, z2: 340 },
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
    this._syncPedestrianInstances();
  },

  _resetRecycledPedestrianState(ped, x, y, z, terrainY, x1, z1, x2, z2, corridor = null, laneJitter = 0, isChatGroup = false, chatAngle = 0, seedOffset = 0) {
    const root = ped.visual.root;
    const newArch = this._pickArchetypeForCoords(x, z, ped.id + seedOffset);
    this._rethemePedestrianArchetype(ped, newArch, ped.id + seedOffset);
    root.position.set(x, y, z);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.visible = true;
    root.matrixWorldAutoUpdate = true;
    resetHumanoidLimbPose(ped.visual);
    Object.assign(ped, {
      panicTimer: 0, crouchPanicTimer: 0, vehicleHitCooldown: 0, diveTimer: 0,
      isDeadCorpse: false, _corpseSinkOffset: 0, state: 'NORMAL',
      corridor, laneJitter, crossState: 'SIDEWALK', activeCrosswalk: null, waitCrossTimer: 0,
      isChatGroup, chatPartnerAngle: chatAngle, x1, z1, x2, z2
    });
    this._setPedestrianFace(ped, ped.normalFaceKey);
    ped.humanoidHealth?.reset(100);
    if (ped.destructible) {
      Object.assign(ped.destructible, { hp: 100, maxHp: 100, destroyed: false, isDeadCorpse: false, groundY: terrainY });
      ped.destructible.basePos.set(x, y, z);
    }
  },

  _ensureAsphaltRoadSpatialGrid() {
    const rects = this._roadRects || [];
    if (this._asphaltRoadGrid && this._asphaltRoadGridLen === rects.length) return this._asphaltRoadGrid;
    const grid = new Map();
    const cell = 192;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const gx0 = Math.floor((r.minX - 8) / cell), gx1 = Math.floor((r.maxX + 8) / cell);
      const gz0 = Math.floor((r.minZ - 8) / cell), gz1 = Math.floor((r.maxZ + 8) / cell);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = ((gx & 0xffff) << 16) | (gz & 0xffff);
          let b = grid.get(key);
          if (!b) { b = []; grid.set(key, b); }
          b.push(r);
        }
      }
    }
    this._asphaltRoadGrid = grid;
    this._asphaltRoadGridLen = rects.length;
    return grid;
  },

  _isInsideAsphaltFast(x, z, margin = 0) {
    const rects = this._roadRects;
    if (!rects || rects.length === 0) return false;
    if (margin > 7.5) {
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin) return true;
      }
      return false;
    }
    const grid = this._ensureAsphaltRoadSpatialGrid();
    const gx = Math.floor(x / 192), gz = Math.floor(z / 192);
    const bucket = grid.get(((gx & 0xffff) << 16) | (gz & 0xffff));
    if (!bucket) return false;
    for (let i = 0; i < bucket.length; i++) {
      const r = bucket[i];
      if (x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin) return true;
    }
    return false;
  },

  _isInsideAsphaltRoad(x, z, margin = 0) {
    return this._isInsideAsphaltFast(x, z, margin);
  },

  _updateDynamicCrowdRing(playerPos) {
    const totalPeds = this.pedestrians.length;
    if (!playerPos || playerPos.y > 95 || playerPos.y < -4.5 || totalPeds === 0) return;

    if (
      this._lastEmptyCrowdX !== undefined &&
      (playerPos.x - this._lastEmptyCrowdX) ** 2 + (playerPos.z - this._lastEmptyCrowdZ) ** 2 < 24 * 24
    ) {
      return;
    }

    let nearCount = 0;
    for (let k = 0; k < totalPeds; k++) {
      const p = this.pedestrians[k];
      if (p.isDeadCorpse || p.humanoidHealth?.isDead()) continue;
      const rp = p.visual.root.position;
      const dx = rp.x - playerPos.x, dz = rp.z - playerPos.z;
      if (dx * dx + dz * dz <= 125.0 * 125.0) nearCount++;
    }
    const targetLocalCrowd = 18;
    if (nearCount >= targetLocalCrowd) return;

    if (IS_SCALED_WORLD && typeof this._findSafeSidewalkSpawn === 'function') {
      const probe = this._findSafeSidewalkSpawn(playerPos.x, playerPos.z, 125.0, 0);
      if (!probe.valid || !probe.corridor) {
        this._lastEmptyCrowdX = playerPos.x;
        this._lastEmptyCrowdZ = playerPos.z;
        this._crowdRingTimer = 0.65;
        return;
      }
      this._lastEmptyCrowdX = undefined;
    }

    const maxRelocationsPerCall = Math.min(1, targetLocalCrowd - nearCount);
    let recycledCount = 0;
    let checkedOutOfRange = 0;
    let hasMoreOutOfRange = false;
    const startCursor = (this._crowdRecycleCursor || 0) % totalPeds;
    let nextCursor = startCursor;

    const isTooCloseToPeer = (tx, tz, skipPed) => {
      for (let m = 0; m < totalPeds; m++) {
        const other = this.pedestrians[m];
        if (other === skipPed || other.isDeadCorpse) continue;
        const op = other.visual.root.position;
        const odx = op.x - tx, odz = op.z - tz;
        if (odx * odx + odz * odz < 5.0) return true;
      }
      return false;
    };

    for (let step = 0; step < totalPeds; step++) {
      const i = (startCursor + step) % totalPeds;
      const ped = this.pedestrians[i];
      if (ped.isDeadCorpse || ped.humanoidHealth?.isDead()) continue;
      if (
        ped.state === 'PANIC' ||
        (ped.panicTimer || 0) > 0 ||
        (ped.humanoidHealth && ped.humanoidHealth.state !== 'ALIVE')
      ) {
        continue;
      }
      const root = ped.visual.root;
      const pdx = root.position.x - playerPos.x, pdz = root.position.z - playerPos.z;
      if (pdx * pdx + pdz * pdz <= 125.0 * 125.0) continue;

      if (recycledCount >= maxRelocationsPerCall || checkedOutOfRange >= 2) {
        hasMoreOutOfRange = nearCount + recycledCount < targetLocalCrowd;
        nextCursor = i;
        break;
      }
      checkedOutOfRange++;
      nextCursor = (i + 1) % totalPeds;

      for (let attempt = 0; attempt < 1; attempt++) {
        const ang = ((i * 1.618 + attempt * 1.25 + performance.now() * 0.0003) % 1) * Math.PI * 2;
        const ringDist = 28.0 + ((i * 19 + attempt * 23) % 86);
        const candX = playerPos.x + Math.cos(ang) * ringDist;
        const candZ = playerPos.z + Math.sin(ang) * ringDist;
        if (!this._isValidDryLandForPedestrian(candX, candZ)) continue;
        if (this.factionWar?.isInvasionActive && getTerritoryZoneAt(candX, candZ)?.id === this.factionWar.activeZoneId) continue;

        if (IS_SCALED_WORLD) {
          const sw = this._findSafeSidewalkSpawn(candX, candZ, 68.0, i + attempt + recycledCount);
          if (!sw.valid || !sw.corridor) continue;
          const c = sw.corridor, jit = sw.laneJitter || 0;
          const pAlong = c.axis === 'x' ? playerPos.x : playerPos.z;
          const minAl = Math.max(c.startAlong + 4.0, pAlong - 95.0);
          const maxAl = Math.min(c.endAlong - 4.0, pAlong + 95.0);
          const spreadU = ((i * 0.37 + attempt * 0.29 + recycledCount * 0.19) % 1 + 1) % 1;
          const al = maxAl > minAl ? minAl + (maxAl - minAl) * spreadU : (c.axis === 'x' ? sw.x : sw.z);
          const sx = c.axis === 'x' ? al : c.centerCoord + jit;
          const sz = c.axis === 'x' ? c.centerCoord + jit : al;
          const distToP = Math.hypot(sx - playerPos.x, sz - playerPos.z);
          if (distToP < 22.0 || distToP > 122.0 || isTooCloseToPeer(sx, sz, ped)) continue;
          if (this._isInsideAsphaltFast(sx, sz, 1.4) || this._isInsideBuilding(sx, sz, 1.15) || !this._isValidDryLandForPedestrian(sx, sz)) continue;
          const tY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(sx, sz) : 0;
          this._resetRecycledPedestrianState(
            ped, sx, this._getPedestrianGroundY(sx, sz, tY), sz, tY,
            c.axis === 'x' ? c.startAlong : c.centerCoord + jit,
            c.axis === 'x' ? c.centerCoord + jit : c.startAlong,
            c.axis === 'x' ? c.endAlong : c.centerCoord + jit,
            c.axis === 'x' ? c.centerCoord + jit : c.endAlong,
            c, jit, i % 9 === 0, ang + Math.PI * 0.5, recycledCount
          );
          recycledCount++;
          break;
        }

        const safe = this._findSafeStreetSpawn(candX, candZ, 1.85);
        if (!safe.valid || isTooCloseToPeer(safe.x, safe.z, ped)) continue;
        const walkAlongX = (i + attempt) % 2 === 0;
        const halfSeg = 24.0 + (i % 4) * 5.5;
        const ax1 = walkAlongX ? safe.x - halfSeg : safe.x;
        const az1 = walkAlongX ? safe.z : safe.z - halfSeg;
        const ax2 = walkAlongX ? safe.x + halfSeg : safe.x;
        const az2 = walkAlongX ? safe.z : safe.z + halfSeg;
        const end1Ok = !this._isInsideBuilding(ax1, az1, 1.1) && this._isValidDryLandForPedestrian(ax1, az1);
        const end2Ok = !this._isInsideBuilding(ax2, az2, 1.1) && this._isValidDryLandForPedestrian(ax2, az2);
        const terrainY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
        this._resetRecycledPedestrianState(
          ped, safe.x, this._getPedestrianGroundY(safe.x, safe.z, terrainY), safe.z, terrainY,
          end1Ok ? ax1 : safe.x, end1Ok ? az1 : safe.z,
          end2Ok ? ax2 : safe.x + (walkAlongX ? 16 : 0), end2Ok ? az2 : safe.z + (walkAlongX ? 0 : 16),
          null, 0, i % 9 === 0, ang + Math.PI * 0.5, recycledCount
        );
        recycledCount++;
        break;
      }
    }

    this._crowdRecycleCursor = nextCursor;
    if (hasMoreOutOfRange) {
      this._crowdRingTimer = recycledCount > 0 ? 0.06 : 0.28;
    }
  },

  recycleDeadPedestrianOutOfSight(ped, spawn) {
    if (!ped || !spawn) return;
    if (IS_SCALED_WORLD && typeof this._findSafeSidewalkSpawn === 'function') {
      const sw = this._findSafeSidewalkSpawn(spawn.x, spawn.z, 220.0, ped.id + 11);
      if (sw.valid && sw.corridor) {
        const tY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(sw.x, sw.z) : 0;
        const c = sw.corridor, jit = sw.laneJitter || 0;
        this._resetRecycledPedestrianState(
          ped, sw.x, this._getPedestrianGroundY(sw.x, sw.z, tY), sw.z, tY,
          c.axis === 'x' ? c.startAlong : c.centerCoord + jit,
          c.axis === 'x' ? c.centerCoord + jit : c.startAlong,
          c.axis === 'x' ? c.endAlong : c.centerCoord + jit,
          c.axis === 'x' ? c.centerCoord + jit : c.endAlong,
          c, jit, false, 0, 11
        );
        return;
      }
    }
    const walkAlongX = ped.id % 2 === 0;
    const halfSeg = 22.0 + (ped.id % 4) * 5.0;
    const ax1 = walkAlongX ? spawn.x - halfSeg : spawn.x;
    const az1 = walkAlongX ? spawn.z : spawn.z - halfSeg;
    const ax2 = walkAlongX ? spawn.x + halfSeg : spawn.x;
    const az2 = walkAlongX ? spawn.z : spawn.z + halfSeg;
    const end1Ok = !this._isInsideBuilding(ax1, az1, 1.1) && this._isValidDryLandForPedestrian(ax1, az1);
    const end2Ok = !this._isInsideBuilding(ax2, az2, 1.1) && this._isValidDryLandForPedestrian(ax2, az2);
    this._resetRecycledPedestrianState(
      ped, spawn.x, spawn.y, spawn.z, spawn.terrainY ?? 0,
      end1Ok ? ax1 : spawn.x, end1Ok ? az1 : spawn.z,
      end2Ok ? ax2 : spawn.x + (walkAlongX ? 16 : 0), end2Ok ? az2 : spawn.z + (walkAlongX ? 0 : 16),
      null, 0, false, 0, 11
    );
  },

  _getPedestrianGroundY(x, z, precomputedTerrainY = null) {
    const terrainY =
      precomputedTerrainY !== null
        ? precomputedTerrainY
        : this.world.getTerrainHeightAt
          ? this.world.getTerrainHeightAt(x, z)
          : 0;
    return Math.max(0, terrainY);
  }
};
