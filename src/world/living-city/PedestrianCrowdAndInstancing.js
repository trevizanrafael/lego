import * as THREE from 'three';
import { getLegoMaterial } from '../../materials/LegoMaterials.js';
import { getTerritoryZoneAt } from '../FactionWarSystem.js';
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

    const pushMat = (inst, mat4, colorHex = null) => {
      const idx = inst.count;
      if (idx >= inst.instanceMatrix.count) return;
      inst.setMatrixAt(idx, mat4);
      if (colorHex !== null) {
        inst.setColorAt(idx, _PED_COLOR.setHex(colorHex));
      }
      inst.count = idx + 1;
    };

    const composePart = (parentMat, px, py, pz, rx, ry, rz) => {
      _PED_POS.set(px, py, pz);
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

      _PED_QUAT.setFromEuler(root.rotation);
      _PED_ROOT_MAT4.compose(root.position, _PED_QUAT, _PED_SCALE_ONE);

      // Cintura (cor da calça igual aos operadores) em y = 0.72
      composePart(_PED_ROOT_MAT4, 0, 0.72, 0, 0, 0, 0);
      pushMat(pools.hip, _PED_WORLD_MAT4, vis.legHex);

      // Tronco + Decal em y = 0.86 + 0.38 = 1.24
      composePart(_PED_ROOT_MAT4, 0, 1.24, 0, 0, 0, 0);
      pushMat(pools.torso, _PED_WORLD_MAT4, vis.torsoHex);

      const decalKey = vis.torsoKey || 'casual_denim';
      const decalPool = this._getPedSubPool(pools.decals, decalKey, () =>
        new THREE.InstancedMesh(NPC_TORSO_DECAL_GEO, getSharedCivilianTorsoMaterial(decalKey), this._pedMaxCap)
      );
      pushMat(decalPool, _PED_WORLD_MAT4);

      // Pernas esquerda e direita (pivô y = 0.72 -> sola toca y = 0.00 exato)
      composePart(_PED_ROOT_MAT4, -0.21, 0.72, 0, vis.leftLeg.rotation.x, 0, 0);
      pushMat(pools.legs, _PED_WORLD_MAT4, vis.legHex);
      composePart(_PED_ROOT_MAT4, 0.21, 0.72, 0, vis.rightLeg.rotation.x, 0, 0);
      pushMat(pools.legs, _PED_WORLD_MAT4, vis.legHex);

      // Cabeça humana + Shell de expressão transparente + Cabelo/Boné em y = 1.95 (base headGroup = 1.62)
      const headYaw = vis.headYaw || 0;
      composePart(_PED_ROOT_MAT4, 0, 1.95, 0, 0, headYaw, 0);
      pushMat(pools.head, _PED_WORLD_MAT4, vis.skinHex);

      const faceKey = vis.faceKey || ped.currentFaceKey || 'civ_calm';
      const facePool = this._getPedSubPool(pools.faces, faceKey, () =>
        new THREE.InstancedMesh(NPC_FACE_SHELL_GEO, getSharedHumanCivilianFaceMaterial(faceKey), this._pedMaxCap)
      );
      pushMat(facePool, _PED_WORLD_MAT4);

      if (vis.headPropMesh?.visible && vis.headPropKey && SHARED_CIV_PROP_GEOS[vis.headPropKey]) {
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

      // Braço direito + Mão humana em C + Prop de Mão em (0.46, 1.52, 0)
      composePart(_PED_ROOT_MAT4, 0.46, 1.52, 0, vis.rightArm.rotation.x, 0, vis.rightArm.rotation.z);
      pushMat(pools.arms, _PED_WORLD_MAT4, vis.armHex ?? vis.torsoHex);
      pushMat(pools.hands, _PED_WORLD_MAT4, vis.skinHex);
      _PED_ARM_MAT4.copy(_PED_WORLD_MAT4);

      if (vis.handPropMesh?.visible && vis.handPropKey && SHARED_CIV_PROP_GEOS[vis.handPropKey]) {
        const hpKey = vis.handPropKey;
        const hpPool = this._getPedSubPool(pools.handProps, hpKey, () => {
          const im = new THREE.InstancedMesh(SHARED_CIV_PROP_GEOS[hpKey], this._pedHandPropMat, this._pedMaxCap);
          im.setColorAt(0, _PED_COLOR.setHex(0xffffff));
          return im;
        });
        composePart(_PED_ARM_MAT4, 0, -0.64, 0.08, 0, 0, 0);
        pushMat(hpPool, _PED_WORLD_MAT4, vis.handPropColor);
      }
      if (vis.cameraFlashMesh?.visible) {
        composePart(_PED_ARM_MAT4, 0, -0.6, 0.24, 0, 0, 0);
        pushMat(pools.cameraFlash, _PED_WORLD_MAT4);
      }

      // Mochila compacta encostada nas costas (y = 1.24, z = -0.29)
      if (vis.backPropMesh?.visible) {
        composePart(_PED_ROOT_MAT4, 0, 1.24, -0.29, 0, 0, 0);
        pushMat(pools.backProp, _PED_WORLD_MAT4, vis.backPropColor);
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

  _registerCivilianPedestrian({ x1, z1, x2, z2, uStart = 0.5, isChatGroup = false, chatPartnerAngle = 0, seed = 0 }) {
    const rawX = THREE.MathUtils.lerp(x1, x2, uStart);
    const rawZ = THREE.MathUtils.lerp(z1, z2, uStart);
    const safe = this._findSafeStreetSpawn(rawX, rawZ, 1.35);
    const archetype = this._pickArchetypeForCoords(safe.x, safe.z, seed);
    const visual = this._buildCivilianLegoMinifig(archetype, seed);

    const terrainY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
    const baseY = this._getPedestrianGroundY(safe.x, safe.z, terrainY);
    visual.root.position.set(safe.x, baseY, safe.z);
    if (isChatGroup) {
      visual.root.rotation.y = chatPartnerAngle;
    }

    const ped = {
      id: seed,
      archetype,
      visual,
      normalFaceKey: visual.preset.faceKey || 'civ_calm',
      currentFaceKey: visual.preset.faceKey || 'civ_calm',
      isChatGroup,
      chatPartnerAngle,
      x1,
      z1,
      x2,
      z2,
      dir: seed % 2 === 0 ? 1 : -1,
      walkSpeed: visual.preset.speed,
      state: 'NORMAL',
      canCheerHero: seed % 3 !== 2,
      cheerStyle: seed % 2 === 0 ? 'clap' : 'wave',
      photoFlashTimer: 0,
      photoCooldown: 0.6 + (seed % 5) * 0.35,
      panicTimer: 0,
      panicDirX: 0,
      panicDirZ: 1,
      diveTimer: 0,
      diveVelX: 0,
      diveVelZ: 0,
      slapstickTimer: 0,
      slapstickDuration: 0.65,
      slapstickCooldown: 0,
      knockVelX: 0,
      knockVelZ: 0,
      animTime: seed * 0.77,
      destructible: null
    };

    if (this.destructibles) {
      const dObj = this.destructibles.registerDestructible({
        mesh: visual.root,
        type: 'pedestrian_civilian',
        hp: 999999,
        radius: 0.95,
        height: 2.25,
        colliders: [],
        debrisColors: [visual.torsoHex, visual.legHex],
        studDrops: { silver: 2, gold: 0, blue: 1, purple: 0 },
        groundY: terrainY
      });
      dObj.isCivilianPedestrian = true;
      dObj.onDamaged = (_amount, hitOrigin) => {
        this._triggerCivilianSlapstickHit(ped, hitOrigin);
      };
      ped.destructible = dObj;
    }

    this.pedestrians.push(ped);
    return ped;
  },

  _initPedestrians() {
    const chatSpots = [
      { cx: -22, cz: -132, count: 3 },
      { cx: 22, cz: -132, count: 2 },
      { cx: -32, cz: -101, count: 3 },
      { cx: 34, cz: -101, count: 2 },
      { cx: -75, cz: -15, count: 3 },
      { cx: -195, cz: -52, count: 3 },
      { cx: 65, cz: 22, count: 2 },
      { cx: 145, cz: 155, count: 3 },
      { cx: -12, cz: -526, count: 2 },
      { cx: 56, cz: -662, count: 2 },
      { cx: -28, cz: 728, count: 3 },
      { cx: 15, cz: 765, count: 2 },
      { cx: -502, cz: -132, count: 2 },
      { cx: 642, cz: -132, count: 2 }
    ];

    let seedCounter = 1;
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

  _updateDynamicCrowdRing(playerPos) {
    if (!playerPos || playerPos.y > 95) return;

    let recycledCount = 0;
    const maxRecyclesPerTick = 32;

    for (let i = 0; i < this.pedestrians.length; i++) {
      if (recycledCount >= maxRecyclesPerTick) break;
      const ped = this.pedestrians[i];
      const root = ped.visual.root;
      const dist = Math.hypot(root.position.x - playerPos.x, root.position.z - playerPos.z);
      if (dist <= 125.0) continue;

      let placed = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const ang = ((i * 1.618 + attempt * 1.25 + performance.now() * 0.0003) % 1) * Math.PI * 2;
        const ringDist = 25.0 + ((i * 19 + attempt * 23) % 90);
        const candX = playerPos.x + Math.cos(ang) * ringDist;
        const candZ = playerPos.z + Math.sin(ang) * ringDist;
        if (!this._isValidDryLandForPedestrian(candX, candZ)) continue;
        if (
          this.factionWar?.isInvasionActive &&
          getTerritoryZoneAt(candX, candZ)?.id === this.factionWar.activeZoneId
        ) {
          continue;
        }

        const safe = this._findSafeStreetSpawn(candX, candZ, 1.85);
        if (!safe.valid) continue;

        const walkAlongX = (i + attempt) % 2 === 0;
        const halfSeg = 24.0 + (i % 4) * 5.5;
        const ax1 = walkAlongX ? safe.x - halfSeg : safe.x;
        const az1 = walkAlongX ? safe.z : safe.z - halfSeg;
        const ax2 = walkAlongX ? safe.x + halfSeg : safe.x;
        const az2 = walkAlongX ? safe.z : safe.z + halfSeg;

        const end1Ok = !this._isInsideBuilding(ax1, az1, 1.1) && this._isValidDryLandForPedestrian(ax1, az1);
        const end2Ok = !this._isInsideBuilding(ax2, az2, 1.1) && this._isValidDryLandForPedestrian(ax2, az2);

        const terrainY = this.world.getTerrainHeightAt
          ? this.world.getTerrainHeightAt(safe.x, safe.z)
          : 0;
        const pedGroundY = this._getPedestrianGroundY(safe.x, safe.z, terrainY);
        const newArch = this._pickArchetypeForCoords(safe.x, safe.z, ped.id + recycledCount);
        this._rethemePedestrianArchetype(ped, newArch, ped.id + recycledCount);

        root.position.set(safe.x, pedGroundY, safe.z);
        root.rotation.set(0, 0, 0);
        root.visible = true;
        root.matrixWorldAutoUpdate = true;

        ped.panicTimer = 0;
        ped.slapstickTimer = 0;
        ped.diveTimer = 0;
        ped.state = 'NORMAL';
        ped.isChatGroup = i % 7 === 0;
        ped.chatPartnerAngle = ang + Math.PI * 0.5;
        ped.x1 = end1Ok ? ax1 : safe.x;
        ped.z1 = end1Ok ? az1 : safe.z;
        ped.x2 = end2Ok ? ax2 : safe.x + (walkAlongX ? 16 : 0);
        ped.z2 = end2Ok ? az2 : safe.z + (walkAlongX ? 0 : 16);

        if (ped.destructible) {
          ped.destructible.basePos.copy(root.position);
          ped.destructible.groundY = terrainY;
        }

        recycledCount++;
        placed = true;
        break;
      }
      if (!placed) continue;
    }
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
