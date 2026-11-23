import * as THREE from 'three';
import { HUMANOID_STATES } from '../npc-health/HumanoidHealthModel.js';
import { applyHumanoidHitPose, applyHumanoidKnockbackStep, resetHumanoidLimbPose } from '../npc-health/HumanoidHitReactions.js';
import { AgentSeparationSystem } from '../collision/AgentSeparation.js';
import { projectSlideVelocity2D } from '../collision/CollisionQueries.js';
import { ARCHETYPE_PRESETS, SHARED_CIV_PROP_GEOS, pickHumanSkinTone } from './PedestrianSharedGeometriesAndArchetypes.js';
import { IS_SCALED_WORLD } from '../core/WorldLayoutScale.js';

const _pedCapPos = { x: 0, y: 0, z: 0 };
const _pedCapOut = {};
const _pedSlideOut = { vx: 0, vz: 0, x: 0, z: 0 };
const _pedAsphaltOut = { x: 0, z: 0, clamped: false };

function makeNode(x, y, z, vis = true) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  o.visible = vis;
  return o;
}

function resolvePedCapsule(sys, ped, nx, nz, curY) {
  if (typeof sys.world?.resolveCapsulePenetration === 'function') {
    const ownCols = ped.destructible?.colliders;
    _pedCapPos.x = nx; _pedCapPos.y = curY; _pedCapPos.z = nz;
    return sys.world.resolveCapsulePenetration(_pedCapPos, 0.44, 1.95, {
      stepUpHeight: 0.36, ignoreColliders: ownCols,
      filter: (col) => !ownCols || ownCols.indexOf(col) === -1, out: _pedCapOut
    });
  }
  return sys._resolveBuildingCollision(nx, nz, 1.05);
}

export const pedestrianBehaviorAndReactionsMethods = {
  _buildCivilianLegoMinifig(archetypeKey, variantIdx = 0) {
    const list = ARCHETYPE_PRESETS[archetypeKey] || ARCHETYPE_PRESETS.casual;
    const preset = list[variantIdx % list.length];
    const skinHex = pickHumanSkinTone(variantIdx);
    const root = new THREE.Group();
    root.userData.skipStaticMerge = true;

    const leftArm = makeNode(-0.46, 1.52, 0);
    leftArm.rotation.set(0, 0, -0.06);
    const rightArm = makeNode(0.46, 1.52, 0);
    rightArm.rotation.set(0, 0, 0.06);

    return {
      root,
      hip: makeNode(0, 0.72, 0),
      torso: makeNode(0, 1.24, 0),
      torsoDecal: makeNode(0, 1.24, 0),
      leftLeg: makeNode(-0.21, 0.72, 0),
      rightLeg: makeNode(0.21, 0.72, 0),
      leftArm,
      rightArm,
      head: makeNode(0, 1.95, 0),
      faceShell: makeNode(0, 1.95, 0),
      headPropMesh: makeNode(0, 1.95, 0, Boolean(preset.headProp && SHARED_CIV_PROP_GEOS[preset.headProp])),
      backPropMesh: makeNode(0, 1.24, -0.29, Boolean(preset.backProp && SHARED_CIV_PROP_GEOS[preset.backProp])),
      handPropMesh: makeNode(0, -0.64, 0.08, Boolean(preset.handProp && SHARED_CIV_PROP_GEOS[preset.handProp])),
      cameraFlashMesh: makeNode(0, -0.6, 0.24, false),
      skinHex,
      torsoHex: preset.torsoHex,
      armHex: preset.bareArms ? skinHex : (preset.armHex ?? preset.torsoHex),
      legHex: preset.legHex,
      torsoKey: preset.torsoKey,
      faceKey: preset.faceKey || 'civ_calm',
      headYaw: 0,
      headPropKey: preset.headProp || null,
      headColor: preset.headColor ?? 0x1e293b,
      backPropKey: preset.backProp || null,
      backPropColor: preset.backPropColor ?? 0x334155,
      handPropKey: preset.handProp || null,
      handPropColor: preset.handPropColor ?? 0x1e293b,
      preset
    };
  },

  _rethemePedestrianArchetype(ped, newArchetypeKey, seedIdx = 0) {
    if (ped.archetype === newArchetypeKey) return;
    const list = ARCHETYPE_PRESETS[newArchetypeKey] || ARCHETYPE_PRESETS.casual;
    const preset = list[seedIdx % list.length], vis = ped.visual, skinHex = pickHumanSkinTone(seedIdx);
    ped.archetype = newArchetypeKey;
    ped.walkSpeed = preset.speed;
    ped.normalFaceKey = preset.faceKey || 'civ_calm';
    ped.currentFaceKey = ped.normalFaceKey;
    Object.assign(vis, {
      skinHex, torsoHex: preset.torsoHex, armHex: preset.bareArms ? skinHex : (preset.armHex ?? preset.torsoHex),
      legHex: preset.legHex, torsoKey: preset.torsoKey, faceKey: ped.normalFaceKey,
      headPropKey: preset.headProp || null, headColor: preset.headColor ?? 0x1e293b,
      backPropKey: preset.backProp || null, backPropColor: preset.backPropColor ?? 0x334155,
      handPropKey: preset.handProp || null, handPropColor: preset.handPropColor ?? 0x1e293b
    });
    vis.headPropMesh.visible = Boolean(preset.headProp && SHARED_CIV_PROP_GEOS[preset.headProp]);
    vis.headPropMesh.position.y = 1.95;
    vis.backPropMesh.visible = Boolean(preset.backProp && SHARED_CIV_PROP_GEOS[preset.backProp]);
    vis.handPropMesh.visible = Boolean(preset.handProp && SHARED_CIV_PROP_GEOS[preset.handProp]);
    vis.cameraFlashMesh.visible = false;
  },

  _setPedestrianFace(ped, faceKey) {
    if (ped.currentFaceKey === faceKey) return;
    ped.currentFaceKey = faceKey;
    if (ped.visual) ped.visual.faceKey = faceKey;
  },

  _onCivilianDamaged(ped, hitOrigin, healthRes = null) {
    const root = ped.visual.root;
    let dx = root.position.x - (hitOrigin?.x ?? root.position.x + 1);
    let dz = root.position.z - (hitOrigin?.z ?? root.position.z + 1);
    const len = Math.hypot(dx, dz);
    if (len < 0.05) { dx = 1; dz = 0; } else { dx /= len; dz /= len; }
    ped.isChatGroup = false; ped.diveTimer = 0; ped.crouchPanicTimer = 0;
    ped.panicDirX = dx; ped.panicDirZ = dz;
    this._setPedestrianFace(ped, 'civ_panic');
    if (healthRes?.killed) {
      ped.isDeadCorpse = true; ped.panicTimer = 0; ped.state = 'DEAD';
      return;
    }
    ped.panicTimer = Math.max(ped.panicTimer || 0, 6.5);
    ped.state = 'PANIC';
  },

  triggerPedestrianPanicNear(origin, radius = 28.0, isLethalWitness = false) {
    const clampR = Math.min(36.0, Math.max(18.0, radius));
    this.triggerTrafficPanicNear(origin, 26.0);
    for (const ped of this.pedestrians) {
      if (ped.isDeadCorpse || ped.humanoidHealth?.isDead()) continue;
      const pos = ped.visual.root.position, dx = pos.x - origin.x, dz = pos.z - origin.z, dist = Math.hypot(dx, dz);
      if (dist <= clampR) {
        ped.isChatGroup = false;
        if (ped.crossState === 'WAIT_CROSSWALK') {
          ped.crossState = 'SIDEWALK';
          ped.activeCrosswalk = null;
        }
        ped.panicTimer = Math.max(ped.panicTimer || 0, isLethalWitness ? 6.8 : 5.2);
        ped.state = 'PANIC';
        if (dist > 0.15) { ped.panicDirX = dx / dist; ped.panicDirZ = dz / dist; }
        else if (Math.hypot(ped.panicDirX || 0, ped.panicDirZ || 0) < 0.2) {
          const a = (ped.id || 1) * 1.73;
          ped.panicDirX = Math.sin(a); ped.panicDirZ = Math.cos(a);
        }
        this._setPedestrianFace(ped, 'civ_panic');
        if (isLethalWitness && dist > 1.8 && (!ped.humanoidHealth || ped.humanoidHealth.state === HUMANOID_STATES.ALIVE) && (ped.crouchPanicTimer || 0) <= 0 && ped.id % 3 === 0) {
          ped.crouchPanicTimer = 1.4;
          ped.visual.root.rotation.y = Math.atan2(-dx, -dz);
        }
      }
    }
  },

  _hasVehicleNearCrosswalk(cw, playerPos, controller, radius = 30.0) {
    const cx = (cw.minX + cw.maxX) * 0.5;
    const cz = (cw.minZ + cw.maxZ) * 0.5;
    const rSq = radius * radius;
    if (controller?.currentVehicle && playerPos) {
      const dx = playerPos.x - cx, dz = playerPos.z - cz;
      if (dx * dx + dz * dz <= rSq) return true;
    }
    const localY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(cx, cz) : 0;
    const crossedAxis = cw.axis === 'x' ? 'x_const' : 'z_const';
    for (let i = 0; i < this.trafficVehicles.length; i++) {
      const tv = this.trafficVehicles[i];
      if (!tv.destructible || tv.destructible.destroyed) continue;
      const vp = tv.mesh.position;
      if (Math.abs(vp.y - localY) > 3.5) continue;
      if (tv.axis !== crossedAxis && !tv.hijackedByPlayer) continue;
      const dx = vp.x - cx, dz = vp.z - cz;
      if (dx * dx + dz * dz <= rSq) return true;
    }
    return false;
  },

  _handleScaledIntersectionCorner(ped, root) {
    const px = root.position.x, pz = root.position.z;
    const c = ped.corridor;
    const tryCrosswalk = ((ped.id + Math.floor(ped.animTime)) % 3) === 0;

    if (tryCrosswalk && this._crosswalkGrid?.size) {
      const gx = Math.floor(px / 128), gz = Math.floor(pz / 128);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const list = this._crosswalkGrid.get((((gx + dx) & 0xffff) << 16) | ((gz + dz) & 0xffff));
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const cw = list[i];
            if (cw.axis === 'x') {
              const cwMidZ = (cw.minZ + cw.maxZ) * 0.5;
              if (Math.abs(pz - cwMidZ) > 9.0) continue;
              const startAtMin = Math.abs(px - cw.minX) < 9.5;
              const startAtMax = Math.abs(px - cw.maxX) < 9.5;
              if (!startAtMin && !startAtMax) continue;
              const waitX = startAtMin ? cw.minX - 2.6 : cw.maxX + 2.6;
              const destX = startAtMin ? cw.maxX + 3.6 : cw.minX - 3.6;
              if (
                !this._isInsideAsphaltRoad?.(waitX, cwMidZ, 1.4) &&
                !this._isInsideAsphaltRoad?.(destX, cwMidZ, 1.4) &&
                !this._isInsideBuilding(destX, cwMidZ, 1.1) &&
                this._isValidDryLandForPedestrian(destX, cwMidZ)
              ) {
                ped.crossState = 'WAIT_CROSSWALK';
                ped.activeCrosswalk = cw;
                ped.waitCrossTimer = 0;
                ped.cwWaitX = waitX; ped.cwWaitZ = cwMidZ;
                ped.cwDestX = destX; ped.cwDestZ = cwMidZ;
                return;
              }
            } else {
              const cwMidX = (cw.minX + cw.maxX) * 0.5;
              if (Math.abs(px - cwMidX) > 9.0) continue;
              const startAtMin = Math.abs(pz - cw.minZ) < 9.5;
              const startAtMax = Math.abs(pz - cw.maxZ) < 9.5;
              if (!startAtMin && !startAtMax) continue;
              const waitZ = startAtMin ? cw.minZ - 2.6 : cw.maxZ + 2.6;
              const destZ = startAtMin ? cw.maxZ + 3.6 : cw.minZ - 3.6;
              if (
                !this._isInsideAsphaltRoad?.(cwMidX, waitZ, 1.4) &&
                !this._isInsideAsphaltRoad?.(cwMidX, destZ, 1.4) &&
                !this._isInsideBuilding(cwMidX, destZ, 1.1) &&
                this._isValidDryLandForPedestrian(cwMidX, destZ)
              ) {
                ped.crossState = 'WAIT_CROSSWALK';
                ped.activeCrosswalk = cw;
                ped.waitCrossTimer = 0;
                ped.cwWaitX = cwMidX; ped.cwWaitZ = waitZ;
                ped.cwDestX = cwMidX; ped.cwDestZ = destZ;
                return;
              }
            }
          }
        }
      }
    }

    // Dobra a esquina na calçada adjacente do mesmo quarteirão (100% em cima da calçada de 10m!)
    if (c?.blockId && this._corridorsByBlockId) {
      const siblings = this._corridorsByBlockId.get(c.blockId);
      if (siblings) {
        for (let i = 0; i < siblings.length; i++) {
          const adj = siblings[i];
          if (adj === c || adj.axis === c.axis) continue;
          const distStart = adj.axis === 'x'
            ? Math.hypot(px - adj.startAlong, pz - adj.centerCoord)
            : Math.hypot(px - adj.centerCoord, pz - adj.startAlong);
          const distEnd = adj.axis === 'x'
            ? Math.hypot(px - adj.endAlong, pz - adj.centerCoord)
            : Math.hypot(px - adj.centerCoord, pz - adj.endAlong);
          if (Math.min(distStart, distEnd) < 11.0) {
            const jit = ped.laneJitter || 0;
            ped.corridor = adj;
            ped.x1 = adj.axis === 'x' ? adj.startAlong : adj.centerCoord + jit;
            ped.z1 = adj.axis === 'x' ? adj.centerCoord + jit : adj.startAlong;
            ped.x2 = adj.axis === 'x' ? adj.endAlong : adj.centerCoord + jit;
            ped.z2 = adj.axis === 'x' ? adj.centerCoord + jit : adj.endAlong;
            ped.dir = distStart <= distEnd ? 1 : -1;
            return;
          }
        }
      }
    }
    ped.dir *= -1;
  },

  _constrainPedestrianOffAsphalt(ped, prevX, prevZ, nx, nz) {
    _pedAsphaltOut.x = nx;
    _pedAsphaltOut.z = nz;
    _pedAsphaltOut.clamped = false;
    if (!IS_SCALED_WORLD || !this._roadRects?.length) return _pedAsphaltOut;

    if (ped.crossState === 'CROSSING' && ped.activeCrosswalk) {
      const cw = ped.activeCrosswalk;
      if (cw.axis === 'x') {
        _pedAsphaltOut.z = THREE.MathUtils.clamp(nz, cw.minZ + 0.25, cw.maxZ - 0.25);
        if (ped.state === 'PANIC') {
          const dirSign = ped.panicDirX >= 0 ? 1 : -1;
          ped.panicDirX = dirSign;
          ped.panicDirZ = 0;
        }
      } else {
        _pedAsphaltOut.x = THREE.MathUtils.clamp(nx, cw.minX + 0.25, cw.maxX - 0.25);
        if (ped.state === 'PANIC') {
          const dirSign = ped.panicDirZ >= 0 ? 1 : -1;
          ped.panicDirX = 0;
          ped.panicDirZ = dirSign;
        }
      }
      if (ped.state === 'PANIC' && !this._isInsideAsphaltRoad?.(_pedAsphaltOut.x, _pedAsphaltOut.z, 1.0)) {
        ped.crossState = 'SIDEWALK';
        ped.activeCrosswalk = null;
      }
      return _pedAsphaltOut;
    }

    const curbBuf = 1.05;
    let cx = nx, cz = nz, clamped = false;
    for (let i = 0; i < this._roadRects.length; i++) {
      const r = this._roadRects[i];
      if (cx <= r.minX - curbBuf || cx >= r.maxX + curbBuf || cz <= r.minZ - curbBuf || cz >= r.maxZ + curbBuf) {
        continue;
      }
      clamped = true;
      if (r.axis === 'z_const') {
        const side = prevZ >= r.roadCoord ? 1 : -1;
        cz = r.roadCoord + side * (r.halfRoadW + curbBuf + 0.15);
        if (ped.state === 'PANIC') {
          const alongSign = Math.abs(ped.panicDirX) > 0.2 ? Math.sign(ped.panicDirX) : ((ped.id || 1) % 2 === 0 ? 1 : -1);
          ped.panicDirX = alongSign * 0.96;
          ped.panicDirZ = side * 0.28;
        }
      } else {
        const side = prevX >= r.roadCoord ? 1 : -1;
        cx = r.roadCoord + side * (r.halfRoadW + curbBuf + 0.15);
        if (ped.state === 'PANIC') {
          const alongSign = Math.abs(ped.panicDirZ) > 0.2 ? Math.sign(ped.panicDirZ) : ((ped.id || 1) % 2 === 0 ? 1 : -1);
          ped.panicDirX = side * 0.28;
          ped.panicDirZ = alongSign * 0.96;
        }
      }
    }
    _pedAsphaltOut.x = cx;
    _pedAsphaltOut.z = cz;
    _pedAsphaltOut.clamped = clamped;
    return _pedAsphaltOut;
  },

  _updatePedestrians(dt, playerPos, controller) {
    const isVortexSymbiote = (controller?.minifigure?.currentHeroKey || 'caveira') === 'vortex';
    const playerSpeed = controller?.getHorizontalSpeed ? controller.getHorizontalSpeed() : 0;
    const isDrivingCar = Boolean(controller?.currentVehicle);
    const isAirborneNow = Boolean(controller && (controller.isFlying || !controller.isGrounded));

    if (this._wasPlayerAirborne && !isAirborneNow && playerPos && !isVortexSymbiote) {
      this._heroLandingCheerTimer = 4.2;
      this._heroLandingPos.copy(playerPos);
    }
    this._wasPlayerAirborne = isAirborneNow;
    if (this._heroLandingCheerTimer > 0) this._heroLandingCheerTimer = Math.max(0, this._heroLandingCheerTimer - dt);

    const carSpeedingNearSidewalk = isDrivingCar && playerSpeed > 12.5;
    const carFwdX = isDrivingCar ? Math.sin(controller.facingAngle || 0) : 0;
    const carFwdZ = isDrivingCar ? Math.cos(controller.facingAngle || 0) : 0;

    const sepSys = this._pedSeparationSys || (this._pedSeparationSys = new AgentSeparationSystem({ cellSize: 3.0, maxActiveDist: 85, passes: 2 }));
    const sepAgents = this._pedSepAgents || (this._pedSepAgents = []);
    const sepPool = this._pedSepPool || (this._pedSepPool = []);
    sepAgents.length = 0;
    let sepPoolIdx = 0;

    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i], vis = ped.visual, root = vis.root, health = ped.humanoidHealth;
      if (ped.vehicleHitCooldown > 0) ped.vehicleHitCooldown = Math.max(0, ped.vehicleHitCooldown - dt);
      if (ped.photoFlashTimer > 0 && (ped.photoFlashTimer -= dt) <= 0 && vis.cameraFlashMesh) vis.cameraFlashMesh.visible = false;

      let distToPlayer = 9999, dxFromPlayer = 0, dzFromPlayer = 0;
      if (playerPos) {
        dxFromPlayer = root.position.x - playerPos.x;
        dzFromPlayer = root.position.z - playerPos.z;
        const dSq = dxFromPlayer * dxFromPlayer + dzFromPlayer * dzFromPlayer;
        const isCloseVisible = dSq <= 125 * 125;
        if (root.visible !== isCloseVisible) {
          root.visible = isCloseVisible;
          root.matrixWorldAutoUpdate = isCloseVisible;
        }
        if (!isCloseVisible && !ped.isDeadCorpse && !health?.isDead()) continue;
        distToPlayer = Math.sqrt(dSq);
      }

      const terrainYNow = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(root.position.x, root.position.z) : 0;
      const baseYNow = this._getPedestrianGroundY(root.position.x, root.position.z, terrainYNow);

      if (ped.isDeadCorpse || health?.state === HUMANOID_STATES.DEAD) {
        ped.state = 'DEAD';
        if (vis.cameraFlashMesh) vis.cameraFlashMesh.visible = false;
        if (health) applyHumanoidHitPose(vis, health, baseYNow, dt, { sinkOffset: ped._corpseSinkOffset || 0 });
        continue;
      }

      if (isDrivingCar && playerSpeed > 6.0 && distToPlayer < 2.85 && (ped.vehicleHitCooldown || 0) <= 0) {
        ped.vehicleHitCooldown = 0.65;
        const runOverDmg = playerSpeed > 21.0 ? 115 : playerSpeed > 16.0 ? 68 + (playerSpeed - 16.0) * 9.5 : 24 + (playerSpeed - 6.0) * 4.2;
        if (this.destructibles && ped.destructible) {
          this.destructibles.damageObject(ped.destructible, runOverDmg, playerPos, false, { sourceIsPlayer: true, unscaledDamage: true, isExplosion: playerSpeed > 14.0 });
          if (ped.isDeadCorpse || health?.isDead()) continue;
        }
      } else if (carSpeedingNearSidewalk && distToPlayer < 12.5 && (!health || health.state === HUMANOID_STATES.ALIVE)) {
        const ahead = dxFromPlayer * carFwdX + dzFromPlayer * carFwdZ;
        const lat = dxFromPlayer * carFwdZ - dzFromPlayer * carFwdX;
        if (ahead > -1.0 && ahead < 11.5 && Math.abs(lat) < 4.5 && ped.diveTimer <= 0) {
          let sideSign = lat >= 0 ? 1 : -1;
          if (IS_SCALED_WORLD) {
            const testX = root.position.x + carFwdZ * sideSign * 2.5;
            const testZ = root.position.z - carFwdX * sideSign * 2.5;
            if (this._isInsideAsphaltRoad?.(testX, testZ, 1.2)) sideSign *= -1;
          }
          ped.diveTimer = 0.42; ped.diveVelX = carFwdZ * sideSign * 11.5; ped.diveVelZ = -carFwdX * sideSign * 11.5;
        }
        ped.isChatGroup = false; ped.crouchPanicTimer = 0; ped.panicTimer = Math.max(ped.panicTimer || 0, 5.0);
        if (ped.crossState === 'WAIT_CROSSWALK') { ped.crossState = 'SIDEWALK'; ped.activeCrosswalk = null; }
        ped.panicDirX = dxFromPlayer / Math.max(0.1, distToPlayer);
        ped.panicDirZ = dzFromPlayer / Math.max(0.1, distToPlayer);
        this._setPedestrianFace(ped, 'civ_panic');
      }

      if (health) {
        const wasReacting = health.state === HUMANOID_STATES.STAGGER || health.state === HUMANOID_STATES.DOWNED;
        health.update(dt);
        if (health.state === HUMANOID_STATES.STAGGER || health.state === HUMANOID_STATES.DOWNED) {
          applyHumanoidKnockbackStep(root, health, dt, (nx, nz) => {
            if (!this._isValidDryLandForPedestrian(nx, nz)) return { blocked: true };
            const col = resolvePedCapsule(this, ped, nx, nz, root.position.y);
            const safe = this._constrainPedestrianOffAsphalt(ped, root.position.x, root.position.z, col.x, col.z);
            return { x: safe.x, z: safe.z, valid: true };
          });
          const tY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(root.position.x, root.position.z) : 0;
          const bY = this._getPedestrianGroundY(root.position.x, root.position.z, tY);
          applyHumanoidHitPose(vis, health, bY, dt);
          if (ped.destructible) { ped.destructible.basePos.set(root.position.x, bY, root.position.z); ped.destructible.groundY = tY; }
          continue;
        }
        if (wasReacting && health.state === HUMANOID_STATES.ALIVE) {
          resetHumanoidLimbPose(vis);
          ped.crouchPanicTimer = 0; ped.panicTimer = Math.max(ped.panicTimer || 0, 6.0);
          ped.state = 'PANIC'; this._setPedestrianFace(ped, 'civ_panic');
        }
      }

      ped.animTime += dt;
      let hopHeight = 0, moveX = 0, moveZ = 0, speed = 0;
      root.rotation.x = 0; root.rotation.z = 0;
      vis.leftLeg.rotation.z = 0; vis.rightLeg.rotation.z = 0;
      vis.leftArm.rotation.z = -0.06; vis.rightArm.rotation.z = 0.06;
      vis.headYaw = 0;

      if (ped.crouchPanicTimer > 0) {
        ped.crouchPanicTimer = Math.max(0, ped.crouchPanicTimer - dt);
        ped.state = 'PANIC'; this._setPedestrianFace(ped, 'civ_panic');
        hopHeight = -0.24; root.rotation.x = 0.24;
        const tremble = Math.sin(ped.animTime * 28.0) * 0.08;
        vis.leftArm.rotation.x = -2.85 + tremble; vis.leftArm.rotation.z = 0.42;
        vis.rightArm.rotation.x = -2.85 - tremble; vis.rightArm.rotation.z = -0.42;
        vis.leftLeg.rotation.x = -0.52; vis.rightLeg.rotation.x = 0.52;
        if (ped.crouchPanicTimer <= 0) root.rotation.x = 0;
      } else if (ped.diveTimer > 0) {
        ped.diveTimer = Math.max(0, ped.diveTimer - dt);
        const u = 1.0 - ped.diveTimer / 0.42;
        hopHeight = Math.sin(u * Math.PI) * 1.15;
        const dnx = root.position.x + ped.diveVelX * dt, dnz = root.position.z + ped.diveVelZ * dt;
        if (this._isValidDryLandForPedestrian(dnx, dnz)) {
          const safeDive = this._constrainPedestrianOffAsphalt(ped, root.position.x, root.position.z, dnx, dnz);
          root.position.x = safeDive.x; root.position.z = safeDive.z;
        }
        root.rotation.z = Math.sin(u * Math.PI) * 0.48;
        vis.leftArm.rotation.x = -2.6; vis.rightArm.rotation.x = -2.6;
        if (ped.diveTimer <= 0) root.rotation.z = 0;
      } else if (ped.panicTimer > 0) {
        ped.state = 'PANIC'; ped.panicTimer -= dt; speed = 8.2;
        moveX = ped.panicDirX + (ped._avoidX || 0) * 0.45;
        moveZ = ped.panicDirZ + (ped._avoidZ || 0) * 0.45;
        const mLen = Math.hypot(moveX, moveZ);
        if (mLen > 1e-4) { moveX /= mLen; moveZ /= mLen; }
        if (ped.panicTimer <= 0) { ped.state = 'NORMAL'; this._setPedestrianFace(ped, ped.normalFaceKey); }
      } else if (controller?.minifigure?.activeEmote && distToPlayer <= 12.0 && !isDrivingCar) {
        ped.state = 'DANCE_ALONG'; this._setPedestrianFace(ped, 'civ_smile');
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        const dp = ped.animTime * 11.5 + (ped.id % 4) * 0.5;
        hopHeight = Math.abs(Math.sin(dp)) * 0.24;
        vis.leftLeg.rotation.x = Math.sin(dp) * 0.5; vis.rightLeg.rotation.x = -Math.sin(dp) * 0.5;
        if (ped.id % 2 === 0) {
          const clap = Math.sin(dp * 1.4) * 0.22;
          vis.leftArm.rotation.x = -1.35 + clap; vis.rightArm.rotation.x = -1.35 - clap;
        } else {
          vis.leftArm.rotation.x = -2.2 + Math.sin(dp) * 0.5; vis.rightArm.rotation.x = -2.2 - Math.sin(dp) * 0.5;
        }
      } else if (isVortexSymbiote && distToPlayer < 7.0 && !isDrivingCar) {
        ped.state = 'VILLAIN_SPOOK'; this._setPedestrianFace(ped, 'civ_panic');
        const inv = 1.0 / Math.max(0.1, distToPlayer);
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        const spkX = root.position.x + dxFromPlayer * inv * 2.35 * dt;
        const spkZ = root.position.z + dzFromPlayer * inv * 2.35 * dt;
        if (this._isValidDryLandForPedestrian(spkX, spkZ)) {
          const safeSpk = this._constrainPedestrianOffAsphalt(ped, root.position.x, root.position.z, spkX, spkZ);
          root.position.x = safeSpk.x; root.position.z = safeSpk.z;
        }
        const tr = Math.sin(ped.animTime * 22.0) * 0.08;
        vis.leftArm.rotation.x = -1.65 + tr; vis.rightArm.rotation.x = -1.65 - tr;
        vis.leftLeg.rotation.x = Math.sin(ped.animTime * 9.0) * 0.32; vis.rightLeg.rotation.x = -Math.sin(ped.animTime * 9.0) * 0.32;
      } else if (!isVortexSymbiote && !isDrivingCar && ((this._heroLandingCheerTimer > 0 && distToPlayer < 15.0) || (ped.canCheerHero && distToPlayer < 10.0 && playerSpeed < 7.5))) {
        ped.state = 'CHEER'; this._setPedestrianFace(ped, ped.normalFaceKey);
        root.rotation.y = Math.atan2(-dxFromPlayer, -dzFromPlayer);
        hopHeight = Math.max(0, Math.sin(ped.animTime * 8.5)) * 0.18;
        vis.leftLeg.rotation.x = 0; vis.rightLeg.rotation.x = 0;
        if (ped.archetype === 'tourist') {
          vis.rightArm.rotation.x = -1.42; vis.leftArm.rotation.x = -1.2;
          if ((ped.photoCooldown -= dt) <= 0) {
            ped.photoCooldown = 1.85 + (ped.id % 4) * 0.45; ped.photoFlashTimer = 0.12;
            if (vis.cameraFlashMesh) { vis.cameraFlashMesh.visible = true; vis.cameraFlashMesh.rotation.y = ped.animTime * 3.0; }
          }
        } else if (ped.cheerStyle === 'clap') {
          const clap = Math.sin(ped.animTime * 14.0) * 0.2;
          vis.leftArm.rotation.x = -1.3 + clap; vis.rightArm.rotation.x = -1.3 - clap;
        } else {
          vis.rightArm.rotation.x = -2.55 + Math.sin(ped.animTime * 12.0) * 0.28; vis.leftArm.rotation.x = -0.08;
        }
      } else {
        ped.state = 'NORMAL'; this._setPedestrianFace(ped, ped.normalFaceKey);
        if (ped.isChatGroup) {
          root.rotation.y = ped.chatPartnerAngle + Math.sin(ped.animTime * 0.9) * 0.05;
          vis.headYaw = Math.sin(ped.animTime * 1.4 + ped.id) * 0.14;
          vis.leftLeg.rotation.x = 0; vis.rightLeg.rotation.x = 0;
          vis.leftArm.rotation.x = -0.06 + Math.sin(ped.animTime * 2.1 + ped.id) * 0.06;
          vis.rightArm.rotation.x = -0.3 + Math.cos(ped.animTime * 2.6 + ped.id) * 0.16;
        } else if (IS_SCALED_WORLD && ped.crossState === 'WAIT_CROSSWALK' && ped.activeCrosswalk) {
          const cw = ped.activeCrosswalk;
          const dwx = ped.cwWaitX - root.position.x, dwz = ped.cwWaitZ - root.position.z;
          const dw = Math.hypot(dwx, dwz);
          if (dw > 0.85) {
            speed = ped.walkSpeed; moveX = dwx / dw; moveZ = dwz / dw;
          } else {
            root.rotation.y = Math.atan2(ped.cwDestX - root.position.x, ped.cwDestZ - root.position.z);
            vis.leftLeg.rotation.x = 0; vis.rightLeg.rotation.x = 0;
            const crossedCarAxis = cw.axis === 'x' ? 'x_const' : 'z_const';
            const redForCars = this._isTrafficLightRedForAxis?.(crossedCarAxis, cw.ix, cw.iz);
            const vehNear30 = this._hasVehicleNearCrosswalk(cw, playerPos, controller, 30.0);
            const playerClose = Boolean(controller?.currentVehicle && playerPos && Math.hypot(playerPos.x - (cw.minX + cw.maxX) * 0.5, playerPos.z - (cw.minZ + cw.maxZ) * 0.5) < 20.0);
            if ((redForCars || !vehNear30) && !playerClose) {
              ped.crossState = 'CROSSING';
            } else if ((ped.waitCrossTimer = (ped.waitCrossTimer || 0) + dt) > 6.5) {
              ped.crossState = 'SIDEWALK'; ped.activeCrosswalk = null; ped.dir *= -1;
            }
          }
        } else if (IS_SCALED_WORLD && ped.crossState === 'CROSSING' && ped.activeCrosswalk) {
          const dcx = ped.cwDestX - root.position.x, dcz = ped.cwDestZ - root.position.z;
          const dc = Math.hypot(dcx, dcz);
          if (dc < 0.95) {
            const sw = this._findSafeSidewalkSpawn?.(ped.cwDestX, ped.cwDestZ, 26.0, ped.id);
            if (sw?.valid && sw.corridor) {
              const c = sw.corridor, jit = sw.laneJitter || 0;
              ped.corridor = c; ped.laneJitter = jit;
              ped.x1 = c.axis === 'x' ? c.startAlong : c.centerCoord + jit;
              ped.z1 = c.axis === 'x' ? c.centerCoord + jit : c.startAlong;
              ped.x2 = c.axis === 'x' ? c.endAlong : c.centerCoord + jit;
              ped.z2 = c.axis === 'x' ? c.centerCoord + jit : c.endAlong;
            }
            ped.crossState = 'SIDEWALK'; ped.activeCrosswalk = null;
          } else {
            speed = Math.max(ped.walkSpeed, 4.1); moveX = dcx / dc; moveZ = dcz / dc;
          }
        } else {
          speed = ped.walkSpeed;
          const dx = (ped.dir > 0 ? ped.x2 : ped.x1) - root.position.x;
          const dz = (ped.dir > 0 ? ped.z2 : ped.z1) - root.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.25) {
            if (IS_SCALED_WORLD) this._handleScaledIntersectionCorner(ped, root);
            else ped.dir *= -1;
          } else {
            moveX = dx / dist; moveZ = dz / dist;
          }
        }
      }

      const prevPedX = root.position.x, prevPedZ = root.position.z;
      if (speed > 0 && (moveX !== 0 || moveZ !== 0)) {
        let nextX = prevPedX + moveX * speed * dt, nextZ = prevPedZ + moveZ * speed * dt;
        if (IS_SCALED_WORLD) {
          const safeStep = this._constrainPedestrianOffAsphalt(ped, prevPedX, prevPedZ, nextX, nextZ);
          nextX = safeStep.x; nextZ = safeStep.z;
        }
        if (this._isValidDryLandForPedestrian(nextX, nextZ)) {
          if (ped.state === 'PANIC' && typeof this.world?.resolveCapsulePenetration === 'function') {
            const cap = resolvePedCapsule(this, ped, nextX, nextZ, root.position.y);
            const safeCap = this._constrainPedestrianOffAsphalt(ped, prevPedX, prevPedZ, cap.x, cap.z);
            root.position.x = safeCap.x; root.position.z = safeCap.z;
            if (cap.collided && (Math.abs(cap.hitNormalX) > 1e-4 || Math.abs(cap.hitNormalZ) > 1e-4)) {
              projectSlideVelocity2D(moveX, moveZ, cap.hitNormalX, cap.hitNormalZ, 0, _pedSlideOut);
              let sx = _pedSlideOut.vx, sz = _pedSlideOut.vz, sLen = Math.hypot(sx, sz);
              if (sLen < 0.25) {
                const sign = (ped.id || 1) % 2 === 0 ? 1 : -1;
                sx = -cap.hitNormalZ * sign; sz = cap.hitNormalX * sign; sLen = Math.hypot(sx, sz);
              }
              if (sLen > 1e-4) { ped.panicDirX = moveX = sx / sLen; ped.panicDirZ = moveZ = sz / sLen; }
            }
          } else {
            root.position.x = nextX; root.position.z = nextZ;
          }
        } else {
          ped.dir *= -1; ped.panicDirX *= -1; ped.panicDirZ *= -1;
        }

        root.rotation.y = Math.atan2(moveX, moveZ);
        const isJogging = ped.state === 'NORMAL' && ped.archetype === 'jogger';
        const walkPhase = ped.animTime * (ped.state === 'PANIC' ? 14.5 : isJogging ? 10.2 : 6.8);
        const legSwing = Math.sin(walkPhase) * (ped.state === 'PANIC' ? 0.78 : isJogging ? 0.62 : 0.45);
        const armSwing = Math.sin(walkPhase) * 0.42;
        vis.leftLeg.rotation.x = legSwing; vis.rightLeg.rotation.x = -legSwing;
        if (ped.state === 'PANIC') {
          vis.leftArm.rotation.x = -2.62 + armSwing * 0.45; vis.rightArm.rotation.x = -2.62 - armSwing * 0.45;
        } else if (isJogging) {
          vis.leftArm.rotation.x = -0.92 - armSwing * 1.15; vis.rightArm.rotation.x = -0.92 + armSwing * 1.15;
        } else {
          vis.leftArm.rotation.x = -armSwing;
          const hpKey = vis.handPropMesh?.visible ? vis.handPropKey : null;
          vis.rightArm.rotation.x = (hpKey === 'smartphone' || hpKey === 'coffee_cup') ? -0.46 + armSwing * 0.16 : hpKey === 'camera' ? -0.34 + armSwing * 0.18 : hpKey ? -0.08 + armSwing * 0.25 : armSwing;
        }
      }

      const pedCol = ped.state === 'PANIC' ? resolvePedCapsule(this, ped, root.position.x, root.position.z, root.position.y) : this._resolveBuildingCollision(root.position.x, root.position.z, 1.05);
      if (pedCol.collided) {
        const safeCol = this._constrainPedestrianOffAsphalt(ped, prevPedX, prevPedZ, pedCol.x, pedCol.z);
        root.position.x = safeCol.x; root.position.z = safeCol.z;
        if (ped.state === 'NORMAL' && !ped.isChatGroup && ped.crossState !== 'CROSSING') ped.dir *= -1;
      }

      ped._hopHeight = hopHeight;
      if (!playerPos || distToPlayer <= 85.0) {
        const e = sepPool[sepPoolIdx++] || (sepPool[sepPoolIdx - 1] = {});
        e.ped = ped; e.x = root.position.x; e.y = baseYNow; e.z = root.position.z;
        e.radius = 0.48; e.weight = 1.0; e.immovable = Boolean(ped.isChatGroup);
        sepAgents.push(e);
      } else {
        root.position.y = baseYNow + hopHeight;
        if (ped.destructible) { ped.destructible.basePos.set(root.position.x, baseYNow, root.position.z); ped.destructible.groundY = terrainYNow; }
      }
    }

    if (sepAgents.length >= 2) sepSys.separateAgents(sepAgents, playerPos);
    for (let s = 0; s < sepAgents.length; s++) {
      const a = sepAgents[s], ped = a.ped, root = ped.visual.root;
      ped._avoidX = a.avoidX || 0; ped._avoidZ = a.avoidZ || 0;
      if ((Math.abs(a.sepPushX) > 1e-5 || Math.abs(a.sepPushZ) > 1e-5) && !a.immovable) {
        const prevSX = root.position.x, prevSZ = root.position.z;
        const candX = prevSX + a.sepPushX, candZ = prevSZ + a.sepPushZ;
        if (this._isValidDryLandForPedestrian(candX, candZ)) {
          const clamped = resolvePedCapsule(this, ped, candX, candZ, root.position.y);
          const safeSep = this._constrainPedestrianOffAsphalt(ped, prevSX, prevSZ, clamped.x, clamped.z);
          root.position.x = safeSep.x; root.position.z = safeSep.z;
        }
      }
      const terrainY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(root.position.x, root.position.z) : 0;
      const baseY = this._getPedestrianGroundY(root.position.x, root.position.z, terrainY);
      root.position.y = baseY + (ped._hopHeight || 0);
      if (ped.destructible) { ped.destructible.basePos.set(root.position.x, baseY, root.position.z); ped.destructible.groundY = terrainY; }
    }
    this._syncPedestrianInstances();
  }
};
