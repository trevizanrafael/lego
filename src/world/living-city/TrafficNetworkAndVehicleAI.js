import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import {
  SHARED_BRAKE_LIGHT_OFF_MAT,
  SHARED_BRAKE_LIGHT_ON_MAT
} from './TrafficRouteSpecsAndSpawner.js';
import { disembarkOccupants } from '../vehicles/VehicleOccupants.js';
import { IS_SCALED_WORLD, ROAD } from '../core/WorldLayoutScale.js';
import {
  findSafePolylineAlong,
  isPointTouchingSidewalkCorridor,
  lerpAngleRad,
  samplePolylinePose
} from './OrganicTrafficPolylineHelper.js';

function syncTrafficObbCollider(world, col, cx, cz, halfX, halfZ, yaw, minY, maxY) {
  if (!col) return;
  col.shapeType = 'obb';
  if (typeof world?.updateDynamicCollider === 'function') {
    world.updateDynamicCollider(col, {
      shapeType: 'obb',
      cx,
      cz,
      halfX,
      halfZ,
      yaw,
      minY,
      maxY
    });
    return;
  }
  const c = Math.cos(yaw || 0);
  const s = Math.sin(yaw || 0);
  const extX = Math.abs(c) * halfX + Math.abs(s) * halfZ;
  const extZ = Math.abs(s) * halfX + Math.abs(c) * halfZ;
  Object.assign(col, {
    shapeType: 'obb',
    isDynamic: true,
    cx,
    cz,
    halfX,
    halfZ,
    yaw,
    cosYaw: c,
    sinYaw: s,
    minX: cx - extX,
    maxX: cx + extX,
    minZ: cz - extZ,
    maxZ: cz + extZ,
    minY,
    maxY
  });
}

function syncTrafficVehicleColliders(world, tv) {
  if (!tv.col && tv.col1) tv.col = tv.col1;
  const pos = tv.mesh.position;
  const yaw = tv.mesh.rotation.y || 0;
  syncTrafficObbCollider(world, tv.col, pos.x, pos.z, 1.25, 2.38, yaw, pos.y, pos.y + 1.85);
  if (tv.col2 && tv.col2 !== tv.col) {
    syncTrafficObbCollider(
      world,
      tv.col2,
      pos.x,
      pos.z,
      (tv.baseW || 2.5) * 0.44,
      (tv.baseD || 5.0) * 0.36,
      yaw,
      pos.y,
      pos.y + (tv.baseH || 2.1)
    );
  }
}

export const trafficNetworkAndVehicleAIMethods = {
  triggerTrafficPanicNear(origin, radius = 28.0) {
    for (const tv of this.trafficVehicles) {
      if (tv.hijackedByPlayer || !tv.destructible || tv.destructible.destroyed) continue;
      const d = Math.hypot(tv.mesh.position.x - origin.x, tv.mesh.position.z - origin.z);
      if (d <= radius) {
        tv.panicTimer = 4.5;
      }
    }
  },

  /**
   * CARJACKING AMIGÁVEL ESTILO LEGO MARVEL: Ao pegar QUALQUER carro na rua com [E],
   * o motorista sai sempre como um civil surpreso correndo para a calçada (zero inimigo armado!).
   */
  _ejectDriverOnCarjack(tv) {
    if (tv?.destructible) {
      disembarkOccupants(tv.destructible, Infinity);
    }
    const pos = tv.mesh.position;
    const rotY = tv.mesh.rotation.y;
    const leftX = pos.x - Math.cos(rotY) * 2.35;
    const leftZ = pos.z + Math.sin(rotY) * 2.35;
    const swSpawn = IS_SCALED_WORLD && typeof this._findSafeSidewalkSpawn === 'function'
      ? this._findSafeSidewalkSpawn(leftX, leftZ, 70.0, 7)
      : null;
    const safe = swSpawn?.valid ? swSpawn : this._findSafeStreetSpawn(leftX, leftZ, 1.4);

    let chosenPed = null;
    let maxDistSq = -1;
    for (const ped of this.pedestrians) {
      const dSq = (ped.visual.root.position.x - pos.x) ** 2 + (ped.visual.root.position.z - pos.z) ** 2;
      if (dSq > maxDistSq) {
        maxDistSq = dSq;
        chosenPed = ped;
      }
    }

    if (chosenPed) {
      const fleeAngle = Math.atan2(safe.x - pos.x, safe.z - pos.z);
      const groundY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;
      chosenPed.isChatGroup = false;
      chosenPed.visual.root.visible = true;
      chosenPed.visual.root.position.set(safe.x, Math.max(0.28, groundY + (IS_SCALED_WORLD ? 0 : 0.28)), safe.z);
      if (swSpawn?.corridor) {
        const c = swSpawn.corridor;
        chosenPed.corridor = c;
        chosenPed.laneJitter = swSpawn.laneJitter || 0;
        chosenPed.crossState = 'SIDEWALK';
        chosenPed.activeCrosswalk = null;
        chosenPed.x1 = c.axis === 'x' ? c.startAlong : c.centerCoord + chosenPed.laneJitter;
        chosenPed.z1 = c.axis === 'x' ? c.centerCoord + chosenPed.laneJitter : c.startAlong;
        chosenPed.x2 = c.axis === 'x' ? c.endAlong : c.centerCoord + chosenPed.laneJitter;
        chosenPed.z2 = c.axis === 'x' ? c.centerCoord + chosenPed.laneJitter : c.endAlong;
      } else {
        chosenPed.x1 = safe.x;
        chosenPed.z1 = safe.z;
        chosenPed.x2 = safe.x + Math.sin(fleeAngle) * 42;
        chosenPed.z2 = safe.z + Math.cos(fleeAngle) * 42;
      }
      chosenPed.panicTimer = 5.0;
      chosenPed.panicDirX = Math.sin(fleeAngle);
      chosenPed.panicDirZ = Math.cos(fleeAngle);
      this._setPedestrianFace(chosenPed, 'civ_panic');
      chosenPed.slapstickTimer = 0.42;
      chosenPed.slapstickDuration = 0.42;
      chosenPed.knockVelX = Math.sin(fleeAngle) * 3.2;
      chosenPed.knockVelZ = Math.cos(fleeAngle) * 3.2;
    }
    soundFX.playCarHorn(0.85, false);
  },

  _updateUrbanTraffic(dt, playerPos, controller) {
    const drivenObj = controller?.currentVehicle || null;

    const TRAFFIC_CELL = 28.0;
    if (!this._trafficGrid) {
      this._trafficGrid = new Map();
      this._trafficUsedBuckets = [];
    } else {
      for (let i = 0; i < this._trafficUsedBuckets.length; i++) {
        this._trafficUsedBuckets[i].length = 0;
      }
      this._trafficUsedBuckets.length = 0;
    }

    for (let i = 0; i < this.trafficVehicles.length; i++) {
      const v = this.trafficVehicles[i];
      if (!v.destructible || v.destructible.destroyed) continue;
      const gx = Math.floor(v.mesh.position.x / TRAFFIC_CELL);
      const gz = Math.floor(v.mesh.position.z / TRAFFIC_CELL);
      const key = ((gx & 0xffff) << 16) | (gz & 0xffff);
      let bucket = this._trafficGrid.get(key);
      if (!bucket) {
        bucket = [];
        this._trafficGrid.set(key, bucket);
      }
      if (bucket.length === 0) {
        this._trafficUsedBuckets.push(bucket);
      }
      bucket.push(v);
    }

    const isLaneSegmentClear = (tv, candLaneOffset, checkSpan = 12.0) => {
      const tgx = Math.floor(tv.mesh.position.x / TRAFFIC_CELL);
      const tgz = Math.floor(tv.mesh.position.z / TRAFFIC_CELL);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = this._trafficGrid.get((((tgx + dx) & 0xffff) << 16) | ((tgz + dz) & 0xffff));
          if (!bucket || bucket.length === 0) continue;
          for (let bi = 0; bi < bucket.length; bi++) {
            const other = bucket[bi];
            if (other === tv) continue;
            if (Math.abs(other.mesh.position.y - tv.mesh.position.y) > 3.2) continue;
            if (other.axis !== tv.axis || Math.abs(other.roadCoord - tv.roadCoord) > 4.0) continue;
            if (
              Math.abs(other.laneOffset - candLaneOffset) < 2.6 &&
              Math.abs(other.posAlong - tv.posAlong) < checkSpan
            ) {
              return false;
            }
          }
        }
      }
      return true;
    };

    for (const tv of this.trafficVehicles) {
      const obj = tv.destructible;
      if (!obj || obj.destroyed) continue;
      obj._aiCurrentSpeed = Math.abs(tv.currentSpeed || 0);

      tv.hornCooldown = Math.max(0, tv.hornCooldown - dt);
      tv.panicTimer = Math.max(0, tv.panicTimer - dt);
      if (tv.respawnFadeTimer > 0) {
        tv.respawnFadeTimer = Math.max(0, tv.respawnFadeTimer - dt);
      }

      if (obj.isDriven || obj.isGrabbed) {
        if (obj.occupants?.length) disembarkOccupants(obj, Infinity);
        if (!tv.hijackedByPlayer) {
          tv.hijackedByPlayer = true;
          this._ejectDriverOnCarjack(tv);
        }
        tv.abandonedTimer = 0;
        if (tv.isBraking) {
          tv.isBraking = false;
          for (const bl of tv.brakeLights) bl.material = SHARED_BRAKE_LIGHT_OFF_MAT;
        }
        continue;
      }

      if (tv.hijackedByPlayer) {
        syncTrafficVehicleColliders(this.world, tv);
        const distPlayer = playerPos
          ? Math.hypot(playerPos.x - tv.mesh.position.x, playerPos.z - tv.mesh.position.z)
          : 999;
        if (distPlayer > 55.0) {
          tv.abandonedTimer = (tv.abandonedTimer || 0) + dt;
          if (tv.abandonedTimer >= 8.0) {
            tv.hijackedByPlayer = false;
            tv.abandonedTimer = 0;
            this._relocateStuckTrafficVehicle(tv, playerPos);
            syncTrafficVehicleColliders(this.world, tv);
          }
        } else {
          tv.abandonedTimer = 0;
        }
        continue;
      }

      if (obj.driverKilled) {
        tv.currentSpeed = THREE.MathUtils.lerp(tv.currentSpeed, 0, Math.min(1, dt * 6.5));
        if (tv.currentSpeed < 0.08) tv.currentSpeed = 0;
        if (!tv.isBraking) {
          tv.isBraking = true;
          for (const bl of tv.brakeLights) bl.material = SHARED_BRAKE_LIGHT_ON_MAT;
        }
        if (tv.currentSpeed > 0.04) {
          tv.posAlong += tv.dir * tv.currentSpeed * dt;
          let nx;
          let nz;
          if (tv.isPolylineRoute && tv.polyTable) {
            const pose = samplePolylinePose(tv.polyTable, tv.posAlong, tv.dir, tv.laneOffset);
            nx = pose.x;
            nz = pose.z;
          } else {
            nx = tv.axis === 'z_const' ? tv.posAlong : tv.roadCoord + tv.laneOffset;
            nz = tv.axis === 'z_const' ? tv.roadCoord + tv.laneOffset : tv.posAlong;
          }
          tv.mesh.position.x = nx;
          tv.mesh.position.z = nz;
          obj.basePos.copy(tv.mesh.position);
        }
        syncTrafficVehicleColliders(this.world, tv);
        if (playerPos && Math.hypot(playerPos.x - tv.mesh.position.x, playerPos.z - tv.mesh.position.z) > 78.0) {
          this._relocateStuckTrafficVehicle(tv, playerPos);
          syncTrafficVehicleColliders(this.world, tv);
        }
        continue;
      }

      const pos = tv.mesh.position;
      const fwdX = Math.sin(tv.mesh.rotation.y);
      const fwdZ = Math.cos(tv.mesh.rotation.y);
      const myHalfLen = tv.baseD * 0.5;
      const roadWidth = tv.roadWidth || ROAD.mainWidth;
      const maxAbsLane = Math.max(3.5, roadWidth * 0.5 - 2.2);

      let obstacleAhead = false;
      let waitingAtRedLight = false;
      let shouldHonk = false;
      let slowCarInBaseLane = false;
      let nearbyCarsCount = 0;

      // Em 3x, respeita linha de retenção antes das faixas de pedestre (world.crosswalkZones) no sinal vermelho
      if (IS_SCALED_WORLD && !tv.isViaduct && tv.panicTimer <= 0 && this._intersectionsByRoadKey) {
        const localTerrY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(pos.x, pos.z) : 0;
        if (pos.y <= localTerrY + 3.0) {
          const rKey = (tv.axis === 'z_const' ? 'z:' : 'x:') + Math.round(tv.roadCoord);
          const jList = this._intersectionsByRoadKey.get(rKey);
          if (jList) {
            const frontBumper = tv.posAlong + tv.dir * myHalfLen;
            for (let ji = 0; ji < jList.length; ji++) {
              const j = jList[ji];
              const stopBumperAlong = j.along - tv.dir * (j.halfCrossW + 5.2);
              const distToStop = (stopBumperAlong - frontBumper) * tv.dir;
              if (distToStop < -0.5 || distToStop > 26.0) continue;
              const redNow = this._isTrafficLightRedForAxis?.(tv.axis, j.ix, j.iz);
              let pedInCrosswalk = false;
              if (!redNow && this.pedestrians?.length) {
                for (let pi = 0; pi < this.pedestrians.length; pi++) {
                  const p = this.pedestrians[pi];
                  if (p.crossState === 'CROSSING' && p.activeCrosswalk && p.activeCrosswalk.ix === j.ix && p.activeCrosswalk.iz === j.iz) {
                    pedInCrosswalk = true;
                    break;
                  }
                }
              }
              if (redNow || pedInCrosswalk) {
                waitingAtRedLight = true;
                if (distToStop <= 9.5) obstacleAhead = true;
                break;
              }
            }
          }
        }
      }

      if (playerPos) {
        const dxP = playerPos.x - pos.x;
        const dzP = playerPos.z - pos.z;
        const distAheadP = dxP * fwdX + dzP * fwdZ;
        const latDistP = Math.abs(dxP * fwdZ - dzP * fwdX);
        const stopDistP = myHalfLen + (drivenObj ? 6.2 : 4.2);
        if (distAheadP > 0.8 && distAheadP < stopDistP && latDistP < 3.4 && Math.abs(playerPos.y - pos.y) < 4.2) {
          obstacleAhead = true;
          shouldHonk = true;
        }
        if (drivenObj && Math.hypot(dxP, dzP) < 8.5 && Math.abs(playerPos.y - pos.y) < 3.0) {
          nearbyCarsCount++;
        }
      }

      const tgx = Math.floor(pos.x / TRAFFIC_CELL);
      const tgz = Math.floor(pos.z / TRAFFIC_CELL);
      for (let gdx = -1; gdx <= 1; gdx++) {
        for (let gdz = -1; gdz <= 1; gdz++) {
          const cellBucket = this._trafficGrid.get((((tgx + gdx) & 0xffff) << 16) | ((tgz + gdz) & 0xffff));
          if (!cellBucket || cellBucket.length === 0) continue;
          for (let bi = 0; bi < cellBucket.length; bi++) {
            const other = cellBucket[bi];
            if (other === tv) continue;
            const oPos = other.mesh.position;
            if (Math.abs(oPos.y - pos.y) > 3.2) continue;

            const dxO = oPos.x - pos.x;
            const dzO = oPos.z - pos.z;
            const distO = Math.hypot(dxO, dzO);
            if (distO < 8.5) nearbyCarsCount++;

            const distAheadO = dxO * fwdX + dzO * fwdZ;
            if (distAheadO <= 1.0 || distAheadO > 22.0) continue;

            if (
              other.axis === tv.axis &&
              Math.abs(other.roadCoord - tv.roadCoord) < 4.0 &&
              Math.abs(other.laneOffset - tv.baseLaneOffset) < 2.6 &&
              distAheadO < 18.0 &&
              (other.hijackedByPlayer || other.currentSpeed < 3.5)
            ) {
              slowCarInBaseLane = true;
            }

            const latDistO = Math.abs(dxO * fwdZ - dzO * fwdX);
            if (latDistO < 2.65) {
              const bumperGap = distAheadO - (myHalfLen + other.baseD * 0.5);
              const isSlowOrStopped = other.hijackedByPlayer || other.currentSpeed < 3.5;

              if (isSlowOrStopped && distAheadO < 16.0 && !waitingAtRedLight) {
                let altLane;
                if (IS_SCALED_WORLD) {
                  const sign = tv.baseLaneOffset >= 0 ? 1 : -1;
                  const baseAbs = Math.abs(tv.baseLaneOffset);
                  const outerAbs = Math.min(maxAbsLane - 0.4, baseAbs + 3.6);
                  const innerAbs = Math.max(3.0, baseAbs - 3.6);
                  altLane = sign * (baseAbs < 8.0 && outerAbs - baseAbs >= 2.6 ? outerAbs : innerAbs);
                  altLane = THREE.MathUtils.clamp(altLane, -maxAbsLane, maxAbsLane);
                } else {
                  altLane = tv.baseLaneOffset > 0 ? tv.baseLaneOffset - 3.6 : tv.baseLaneOffset + 3.6;
                }
                if (Math.abs(altLane - tv.baseLaneOffset) > 1.8 && isLaneSegmentClear(tv, altLane, 12.0)) {
                  tv.targetLaneOffset = altLane;
                  if (bumperGap < 1.6) obstacleAhead = true;
                  continue;
                }
              }

              if (!obstacleAhead && bumperGap < 3.8) {
                obstacleAhead = true;
                if (other.hijackedByPlayer) shouldHonk = true;
              }
            }
          }
        }
      }

      if (this.wantedSystem?.pursuitVehicles?.length > 0) {
        for (const pv of this.wantedSystem.pursuitVehicles) {
          if (!pv.carObj || pv.carObj.destroyed) continue;
          const pPos = pv.carObj.mesh.position;
          if (Math.abs(pPos.y - pos.y) < 3.0 && Math.hypot(pPos.x - pos.x, pPos.z - pos.z) < 8.5) {
            nearbyCarsCount++;
          }
        }
      }

      if (
        tv.targetLaneOffset !== tv.baseLaneOffset &&
        !slowCarInBaseLane &&
        isLaneSegmentClear(tv, tv.baseLaneOffset, 10.5)
      ) {
        tv.targetLaneOffset = tv.baseLaneOffset;
      }

      if (IS_SCALED_WORLD) {
        tv.targetLaneOffset = THREE.MathUtils.clamp(
          tv.targetLaneOffset ?? tv.baseLaneOffset,
          -maxAbsLane,
          maxAbsLane
        );
      }

      if (waitingAtRedLight) {
        tv.stuckTimer = 0;
        tv.surroundedTimer = 0;
      } else {
        if (tv.currentSpeed < 2.0) tv.stuckTimer = (tv.stuckTimer || 0) + dt;
        else tv.stuckTimer = Math.max(0, (tv.stuckTimer || 0) - dt * 2.0);

        if (nearbyCarsCount >= 2 && tv.currentSpeed < 3.0) tv.surroundedTimer = (tv.surroundedTimer || 0) + dt;
        else tv.surroundedTimer = Math.max(0, (tv.surroundedTimer || 0) - dt * 1.5);
      }

      if (tv.stuckTimer >= 4.2 || tv.surroundedTimer >= 2.4) {
        this._relocateStuckTrafficVehicle(tv, playerPos);
        syncTrafficVehicleColliders(this.world, tv);
        continue;
      }

      if (shouldHonk && tv.hornCooldown <= 0 && playerPos) {
        const distToPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (distToPlayer < 46.0) {
          tv.hornCooldown = 2.6 + Math.random() * 2.2;
          soundFX.playCarHorn(Math.max(0.25, 1.0 - distToPlayer / 48.0), false);
        }
      }

      const engineMult = this.destructibles?.getVehicleEngineSpeedMultiplier
        ? this.destructibles.getVehicleEngineSpeedMultiplier(obj)
        : 1.0;
      const desiredCruise = (tv.panicTimer > 0 ? tv.cruiseSpeed * 1.45 : tv.cruiseSpeed) * engineMult;
      const targetSpeed = obstacleAhead ? 0 : desiredCruise;
      const accelRate = obstacleAhead ? 46.0 : 16.0;
      tv.currentSpeed = THREE.MathUtils.lerp(
        tv.currentSpeed,
        targetSpeed,
        Math.min(1, dt * (accelRate / 10))
      );

      const brakingNow = obstacleAhead || tv.currentSpeed < tv.cruiseSpeed * 0.55;
      if (brakingNow !== tv.isBraking) {
        tv.isBraking = brakingNow;
        const mat = brakingNow ? SHARED_BRAKE_LIGHT_ON_MAT : SHARED_BRAKE_LIGHT_OFF_MAT;
        for (const bl of tv.brakeLights) bl.material = mat;
      }

      if (tv.currentSpeed > 0.04) {
        tv.posAlong += tv.dir * tv.currentSpeed * dt;
        if (!tv.isPolylineRoute) {
          tv.laneOffset = THREE.MathUtils.lerp(
            tv.laneOffset,
            tv.targetLaneOffset ?? tv.baseLaneOffset,
            Math.min(1, dt * 4.0)
          );
          if (IS_SCALED_WORLD) {
            tv.laneOffset = THREE.MathUtils.clamp(tv.laneOffset, -maxAbsLane, maxAbsLane);
          }
        }
        let wrapped = false;
        if (tv.posAlong > tv.maxC) {
          tv.posAlong = tv.minC;
          wrapped = true;
        } else if (tv.posAlong < tv.minC) {
          tv.posAlong = tv.maxC;
          wrapped = true;
        }

        let nx;
        let nz;
        if (tv.isPolylineRoute && tv.polyTable) {
          let pose = samplePolylinePose(tv.polyTable, tv.posAlong, tv.dir, tv.laneOffset);
          if (wrapped || isPointTouchingSidewalkCorridor(this.world, pose.x, pose.z, 1.8)) {
            const safe = findSafePolylineAlong(this.world, tv.polyTable, tv.posAlong + tv.dir * 16.0, tv.dir, tv.laneOffset);
            tv.posAlong = safe.s;
            pose = safe.pose;
          }
          nx = pose.x;
          nz = pose.z;
          tv.mesh.rotation.y = wrapped
            ? pose.rotY
            : lerpAngleRad(tv.mesh.rotation.y || pose.rotY, pose.rotY, Math.min(1, dt * 9.0));
        } else {
          nx = tv.axis === 'z_const' ? tv.posAlong : tv.roadCoord + tv.laneOffset;
          nz = tv.axis === 'z_const' ? tv.roadCoord + tv.laneOffset : tv.posAlong;
        }
        const curFwdX = Math.sin(tv.mesh.rotation.y);
        const curFwdZ = Math.cos(tv.mesh.rotation.y);
        const refY = wrapped
          ? (tv.cfg.wrapY ?? (this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(nx, nz) : 0))
          : tv.mesh.position.y;
        const ny = this.world.getSurfaceHeightAt
          ? this.world.getSurfaceHeightAt(nx, nz, refY)
          : (this.world.getRoadElevation ? this.world.getRoadElevation(nx, nz) : 0);
        const aheadY = this.world.getSurfaceHeightAt
          ? this.world.getSurfaceHeightAt(nx + curFwdX * 2.0, nz + curFwdZ * 2.0, ny)
          : ny;
        const slopePitch = -Math.atan2(aheadY - ny, 2.0);

        tv.mesh.rotation.order = 'YXZ';
        tv.mesh.position.set(nx, ny, nz);
        tv.mesh.rotation.x = wrapped
          ? slopePitch
          : THREE.MathUtils.lerp(tv.mesh.rotation.x || 0, slopePitch, Math.min(1, dt * 10));
        obj.basePos.copy(tv.mesh.position);
        obj.baseRot.copy(tv.mesh.rotation);
        obj.groundY = ny;
      }

      syncTrafficVehicleColliders(this.world, tv);
    }
  }
};
