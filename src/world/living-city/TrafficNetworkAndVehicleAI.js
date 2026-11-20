import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import {
  SHARED_BRAKE_LIGHT_OFF_MAT,
  SHARED_BRAKE_LIGHT_ON_MAT
} from './TrafficRouteSpecsAndSpawner.js';

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
    const pos = tv.mesh.position;
    const rotY = tv.mesh.rotation.y;
    const leftX = pos.x - Math.cos(rotY) * 2.35;
    const leftZ = pos.z + Math.sin(rotY) * 2.35;
    const safe = this._findSafeStreetSpawn(leftX, leftZ, 1.4);

    // Recicla o pedestre mais distante da piscina de 160 civis para ser o motorista ejetado (zero leak de memória!)
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
      chosenPed.visual.root.position.set(safe.x, Math.max(0.28, groundY + 0.28), safe.z);
      chosenPed.x1 = safe.x;
      chosenPed.z1 = safe.z;
      chosenPed.x2 = safe.x + Math.sin(fleeAngle) * 42;
      chosenPed.z2 = safe.z + Math.cos(fleeAngle) * 42;
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

    // Grade espacial por frame (células 28m x 28m, zero alocações) para eliminar O(N²) entre carros do trânsito!
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

      tv.hornCooldown = Math.max(0, tv.hornCooldown - dt);
      tv.panicTimer = Math.max(0, tv.panicTimer - dt);
      if (tv.respawnFadeTimer > 0) {
        tv.respawnFadeTimer = Math.max(0, tv.respawnFadeTimer - dt);
      }

      // Carjacking Amigável ao entrar com [E] ou agarrar carro com o Titã Blindado
      if (obj.isDriven || obj.isGrabbed) {
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

      // Se um carro do trânsito foi roubado e depois abandonado no meio da rua longe do jogador (> 55m por 8s),
      // recicla de volta para o fluxo normal da avenida!
      if (tv.hijackedByPlayer) {
        const distPlayer = playerPos
          ? Math.hypot(playerPos.x - tv.mesh.position.x, playerPos.z - tv.mesh.position.z)
          : 999;
        if (distPlayer > 55.0) {
          tv.abandonedTimer = (tv.abandonedTimer || 0) + dt;
          if (tv.abandonedTimer >= 8.0) {
            tv.hijackedByPlayer = false;
            tv.abandonedTimer = 0;
            this._relocateStuckTrafficVehicle(tv, playerPos);
          }
        } else {
          tv.abandonedTimer = 0;
        }
        continue;
      }

      const pos = tv.mesh.position;
      const fwdX = Math.sin(tv.mesh.rotation.y);
      const fwdZ = Math.cos(tv.mesh.rotation.y);
      const myHalfLen = tv.baseD * 0.5;

      let obstacleAhead = false;
      let shouldHonk = false;
      let slowCarInBaseLane = false;
      let nearbyCarsCount = 0;

      // 1) Verifica se o jogador a pé ou o veículo do jogador está na frente (folga de 3.5m do para-choque!)
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

      // 2) Verifica fila de carros à frente via grade espacial O(1) (vizinhança 3x3 de 28m)!
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
            if (distO < 8.5) {
              nearbyCarsCount++;
            }

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

              // ULTRAPASSAGEM INTELIGENTE: se houver carro lento/abandonado a < 16m na frente, muda para a faixa lateral livre!
              if (isSlowOrStopped && distAheadO < 16.0) {
                const altLane = tv.baseLaneOffset > 0 ? tv.baseLaneOffset - 3.6 : tv.baseLaneOffset + 3.6;
                if (isLaneSegmentClear(tv, altLane, 12.0)) {
                  tv.targetLaneOffset = altLane;
                  if (bumperGap < 1.6) {
                    obstacleAhead = true;
                  }
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

      // Conta também viaturas de perseguição coladas ao redor (< 8.5m) para detectar cercamento!
      if (this.wantedSystem?.pursuitVehicles?.length > 0) {
        for (const pv of this.wantedSystem.pursuitVehicles) {
          if (!pv.carObj || pv.carObj.destroyed) continue;
          const pPos = pv.carObj.mesh.position;
          if (Math.abs(pPos.y - pos.y) < 3.0 && Math.hypot(pPos.x - pos.x, pPos.z - pos.z) < 8.5) {
            nearbyCarsCount++;
          }
        }
      }

      // Retorna suavemente para a faixa original assim que ela liberar!
      if (
        tv.targetLaneOffset !== tv.baseLaneOffset &&
        !slowCarInBaseLane &&
        isLaneSegmentClear(tv, tv.baseLaneOffset, 10.5)
      ) {
        tv.targetLaneOffset = tv.baseLaneOffset;
      }

      // 3) AUTO-DESPAWN & RESPAWN ANTI-ENGARRAFAMENTO
      if (tv.currentSpeed < 2.0) {
        tv.stuckTimer = (tv.stuckTimer || 0) + dt;
      } else {
        tv.stuckTimer = Math.max(0, (tv.stuckTimer || 0) - dt * 2.0);
      }

      if (nearbyCarsCount >= 2 && tv.currentSpeed < 3.0) {
        tv.surroundedTimer = (tv.surroundedTimer || 0) + dt;
      } else {
        tv.surroundedTimer = Math.max(0, (tv.surroundedTimer || 0) - dt * 1.5);
      }

      if (tv.stuckTimer >= 4.2 || tv.surroundedTimer >= 2.4) {
        this._relocateStuckTrafficVehicle(tv, playerPos);
        continue;
      }

      // Buzina cômica periódica até a rua liberar!
      if (shouldHonk && tv.hornCooldown <= 0 && playerPos) {
        const distToPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (distToPlayer < 46.0) {
          tv.hornCooldown = 2.6 + Math.random() * 2.2;
          soundFX.playCarHorn(Math.max(0.25, 1.0 - distToPlayer / 48.0), false);
        }
      }

      const desiredCruise = tv.panicTimer > 0 ? tv.cruiseSpeed * 1.45 : tv.cruiseSpeed;
      const targetSpeed = obstacleAhead ? 0 : desiredCruise;
      const accelRate = obstacleAhead ? 46.0 : 16.0;
      tv.currentSpeed = THREE.MathUtils.lerp(
        tv.currentSpeed,
        targetSpeed,
        Math.min(1, dt * (accelRate / 10))
      );

      // Acende as duas luzes de freio vermelhas traseiras quando freado/parado no trânsito!
      const brakingNow = obstacleAhead || tv.currentSpeed < tv.cruiseSpeed * 0.55;
      if (brakingNow !== tv.isBraking) {
        tv.isBraking = brakingNow;
        const mat = brakingNow ? SHARED_BRAKE_LIGHT_ON_MAT : SHARED_BRAKE_LIGHT_OFF_MAT;
        for (const bl of tv.brakeLights) {
          bl.material = mat;
        }
      }

      if (tv.currentSpeed > 0.04) {
        tv.posAlong += tv.dir * tv.currentSpeed * dt;
        tv.laneOffset = THREE.MathUtils.lerp(
          tv.laneOffset,
          tv.targetLaneOffset ?? tv.baseLaneOffset,
          Math.min(1, dt * 4.0)
        );
        let wrapped = false;
        if (tv.posAlong > tv.maxC) {
          tv.posAlong = tv.minC;
          wrapped = true;
        } else if (tv.posAlong < tv.minC) {
          tv.posAlong = tv.maxC;
          wrapped = true;
        }

        const nx = tv.axis === 'z_const' ? tv.posAlong : tv.roadCoord + tv.laneOffset;
        const nz = tv.axis === 'z_const' ? tv.roadCoord + tv.laneOffset : tv.posAlong;
        const refY = wrapped
          ? (tv.cfg.wrapY ?? (this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(nx, nz) : 0))
          : tv.mesh.position.y;
        const ny = this.world.getSurfaceHeightAt
          ? this.world.getSurfaceHeightAt(nx, nz, refY)
          : (this.world.getRoadElevation ? this.world.getRoadElevation(nx, nz) : 0);
        const aheadY = this.world.getSurfaceHeightAt
          ? this.world.getSurfaceHeightAt(nx + fwdX * 2.0, nz + fwdZ * 2.0, ny)
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

        const isRotated90 = Math.abs(Math.sin(tv.mesh.rotation.y)) > 0.7;
        const w = isRotated90 ? tv.baseD : tv.baseW;
        const d = isRotated90 ? tv.baseW : tv.baseD;
        if (tv.col1) {
          tv.col1.minX = nx - w * 0.5;
          tv.col1.maxX = nx + w * 0.5;
          tv.col1.minZ = nz - d * 0.5;
          tv.col1.maxZ = nz + d * 0.5;
          tv.col1.minY = ny;
          tv.col1.maxY = ny + 1.35;
        }
        if (tv.col2) {
          tv.col2.minX = nx - w * 0.44;
          tv.col2.maxX = nx + w * 0.44;
          tv.col2.minZ = nz - d * 0.36;
          tv.col2.maxZ = nz + d * 0.36;
          tv.col2.minY = ny;
          tv.col2.maxY = ny + tv.baseH;
        }
      }
    }
  }
};
