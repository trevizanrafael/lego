// Movimento dos trens pelo anel (parada nas estações, portas, sinal sonoro).
import * as THREE from 'three';
import { getLegoMaterial } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { createLegoMetroCarMesh } from './MetroTrainMesh.js';
import {
  worldToCarLocal,
  carLocalToWorld,
  findSupportingCarAt,
  resolveHorizontalCarCollision,
  findBoardableCar,
  getMetroSeatTransform,
  getMetroDisembarkPoint
} from './MetroBoarding.js';

export class MetroSystemRuntime {
  constructor(world, spline, totems) {
    this.world = world;
    this.spline = spline;
    this.totems = totems;
    this.stations = spline.stationStops;
    this.trains = [];

    // Visual moderno (IDV): carroceria branca, faixa amarela de alerta, janelas escuras, truques pretos
    const materials = {
      white: getLegoMaterial(0xf4f4f5, { roughness: 0.22, clearcoat: 0.6 }),
      grey: getLegoMaterial(0x52525b, { roughness: 0.34, clearcoat: 0.35 }),
      roof: getLegoMaterial(0xa0a5a9, { roughness: 0.28, clearcoat: 0.45 }),
      yellow: getLegoMaterial(0xfacc15, { roughness: 0.22, clearcoat: 0.55 }),
      dark: getLegoMaterial(0x111214, { roughness: 0.4 }),
      seat: getLegoMaterial(0x3f3f46, { roughness: 0.32 }),
      floor: getLegoMaterial(0x71717a, { roughness: 0.4 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x1e293b,
        roughness: 0.06,
        transparent: true,
        opacity: 0.42,
        clearcoat: 1.0
      }),
      interiorLight: new THREE.MeshBasicMaterial({ color: 0xfef9c3 }),
      headlight: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      taillight: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      signGlow: new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    };

    const startOffsets = [
      (this.stations[0].stopS - 30 + spline.totalLength) % spline.totalLength,
      (this.stations[0].stopS + spline.totalLength * 0.5) % spline.totalLength
    ];

    for (let t = 0; t < 2; t++) {
      const cars = [];
      for (let c = 0; c < 3; c++) {
        const visual = createLegoMetroCarMesh(c === 0, c === 2, materials);
        world.scene.add(visual.group);
        cars.push({
          carIndex: c,
          sOffset: (1 - c) * 14.45,
          group: visual.group,
          leftDoorLeaves: visual.leftDoorLeaves,
          rightDoorLeaves: visual.rightDoorLeaves,
          pos: new THREE.Vector3(),
          prevPos: new THREE.Vector3(),
          deltaPos: new THREE.Vector3(),
          rotY: 0,
          prevRotY: 0,
          deltaRotY: 0,
          rotX: 0,
          leftOpenRatio: 0,
          rightOpenRatio: 0,
          halfW: 2.3,
          halfL: 6.8,
          floorOffsetY: 0.65,
          roofOffsetY: 5.45
        });
      }

      const train = {
        id: `metro_train_${t + 1}`,
        s: startOffsets[t],
        cruiseSpeed: 28.0,
        speed: 22.0,
        state: 'MOVING',
        stopTimer: 0,
        lastStoppedStationId: null,
        currentStation: null,
        departCooldown: 0,
        chimePlayedClose: false,
        leftOpenRatio: 0,
        rightOpenRatio: 0,
        cars
      };
      this.trains.push(train);
      this._syncTrainCarsTransform(train, true);
    }
  }

  _syncTrainCarsTransform(train, isInit = false) {
    const tmpPos = new THREE.Vector3();
    const tmpTan = new THREE.Vector3();

    for (const car of train.cars) {
      if (!isInit) {
        car.prevPos.copy(car.pos);
        car.prevRotY = car.rotY;
      }

      this.spline.sampleAtS(train.s + car.sOffset, tmpPos, tmpTan);
      car.pos.copy(tmpPos);
      const horiz = Math.hypot(tmpTan.x, tmpTan.z) || 0.001;
      car.rotY = Math.atan2(tmpTan.x, tmpTan.z);
      car.rotX = -Math.atan2(tmpTan.y, horiz);

      if (isInit) {
        car.prevPos.copy(car.pos);
        car.prevRotY = car.rotY;
        car.deltaPos.set(0, 0, 0);
        car.deltaRotY = 0;
      } else {
        car.deltaPos.subVectors(car.pos, car.prevPos);
        let dYaw = car.rotY - car.prevRotY;
        while (dYaw > Math.PI) dYaw -= Math.PI * 2;
        while (dYaw < -Math.PI) dYaw += Math.PI * 2;
        car.deltaRotY = dYaw;
      }

      car.group.position.copy(car.pos);
      car.group.rotation.order = 'YXZ';
      car.group.rotation.set(car.rotX, car.rotY, 0);

      // Abertura ampla das Portas Deslizantes de 2.80m (1.36m para cada folha!)
      const slideDist = 1.36;
      for (const lf of car.leftDoorLeaves) {
        lf.mesh.position.z = lf.baseZ + lf.slideSign * slideDist * car.leftOpenRatio;
      }
      for (const rf of car.rightDoorLeaves) {
        rf.mesh.position.z = rf.baseZ + rf.slideSign * slideDist * car.rightOpenRatio;
      }
    }
  }

  _setTrainDoors(train, openRatio, doorSide = 'both') {
    const leftVal = doorSide === 'left' || doorSide === 'both' ? openRatio : 0;
    const rightVal = doorSide === 'right' || doorSide === 'both' ? openRatio : 0;
    train.leftOpenRatio = leftVal;
    train.rightOpenRatio = rightVal;
    for (const car of train.cars) {
      car.leftOpenRatio = leftVal;
      car.rightOpenRatio = rightVal;
    }
  }

  _playChimeIfNearPlayer(train, playerPos) {
    if (!playerPos || typeof soundFX?.playMetroDingDong !== 'function') return;
    const midCar = train.cars[1];
    const dist = midCar.pos.distanceTo(playerPos);
    if (dist < 145) {
      const vol = THREE.MathUtils.clamp(1.0 - dist / 150, 0.16, 0.9);
      soundFX.playMetroDingDong(vol);
    }
  }

  update(dt, playerPos = null) {
    const totalLen = this.spline.totalLength;

    for (const train of this.trains) {
      if (train.state === 'STOPPED') {
        train.stopTimer -= dt;
        const elapsed = 5.0 - train.stopTimer;
        let ratio = 1.0;
        if (elapsed < 0.55) {
          ratio = elapsed / 0.55;
        } else if (train.stopTimer < 0.65) {
          if (!train.chimePlayedClose) {
            train.chimePlayedClose = true;
            this._playChimeIfNearPlayer(train, playerPos);
          }
          ratio = Math.max(0, train.stopTimer / 0.65);
        }

        this._setTrainDoors(train, THREE.MathUtils.clamp(ratio, 0, 1), train.currentStation?.doorSide || 'both');

        if (train.stopTimer <= 0) {
          this._setTrainDoors(train, 0, 'both');
          train.state = 'MOVING';
          train.departCooldown = 3.5;
          train.speed = 2.5;
        }

        this._syncTrainCarsTransform(train, false);
        continue;
      }

      train.departCooldown = Math.max(0, train.departCooldown - dt);
      let nearestAheadSt = null;
      let minAheadDist = Infinity;

      if (train.departCooldown <= 0) {
        for (const st of this.stations) {
          let ahead = st.stopS - train.s;
          if (ahead < -2.0) ahead += totalLen;
          if (ahead >= -1.5 && ahead < minAheadDist) {
            minAheadDist = ahead;
            nearestAheadSt = st;
          }
        }
      }

      if (nearestAheadSt && minAheadDist <= 46.0) {
        if (minAheadDist <= 0.65) {
          train.s = nearestAheadSt.stopS;
          train.speed = 0;
          train.state = 'STOPPED';
          train.stopTimer = 5.0;
          train.chimePlayedClose = false;
          train.currentStation = nearestAheadSt;
          train.lastStoppedStationId = nearestAheadSt.id;
          this._playChimeIfNearPlayer(train, playerPos);
          this._syncTrainCarsTransform(train, false);
          continue;
        }
        const targetBrakeSpeed = Math.max(2.4, train.cruiseSpeed * Math.sqrt(Math.max(0, minAheadDist) / 46.0));
        train.speed = THREE.MathUtils.lerp(train.speed, targetBrakeSpeed, Math.min(1, dt * 6.0));
      } else {
        train.speed = THREE.MathUtils.lerp(train.speed, train.cruiseSpeed, Math.min(1, dt * 2.2));
      }

      const stepS = train.speed * dt;
      if (nearestAheadSt && minAheadDist > 0 && stepS >= minAheadDist) {
        train.s = nearestAheadSt.stopS;
        train.speed = 0;
        train.state = 'STOPPED';
        train.stopTimer = 5.0;
        train.chimePlayedClose = false;
        train.currentStation = nearestAheadSt;
        this._playChimeIfNearPlayer(train, playerPos);
      } else {
        train.s = (train.s + stepS) % totalLen;
      }

      this._syncTrainCarsTransform(train, false);
    }
  }


  _worldToCarLocal(car, wx, wz) {
    return worldToCarLocal(car, wx, wz);
  }

  _carLocalToWorld(car, lx, lz) {
    return carLocalToWorld(car, lx, lz);
  }

  findSupportingCarAt(x, z, currentY, groundY = -Infinity) {
    return findSupportingCarAt(this.trains, x, z, currentY, groundY);
  }

  resolveHorizontalCarCollision(pos, playerRadius = 0.45) {
    resolveHorizontalCarCollision(this.trains, pos, playerRadius);
  }

  /** Vagão parado com porta aberta ao alcance do [E] (estado de viagem pronto para `activeRide`). */
  findBoardableCar(pos) {
    return findBoardableCar(this.trains, pos);
  }

  getRideSeatTransform(ride) {
    return getMetroSeatTransform(ride);
  }

  getDisembarkPoint(ride) {
    return getMetroDisembarkPoint(ride);
  }

  /** Próxima estação à frente do trem (a atual, se estiver parado). */
  getNextStation(train) {
    if (!train) return null;
    if (train.state === 'STOPPED' && train.currentStation) return train.currentStation;
    const totalLen = this.spline.totalLength;
    let best = null;
    let bestAhead = Infinity;
    for (const st of this.stations) {
      let ahead = st.stopS - train.s;
      if (ahead <= 0.5) ahead += totalLen;
      if (ahead < bestAhead) {
        bestAhead = ahead;
        best = st;
      }
    }
    return best;
  }

  getLiveTrainMapMarkers() {
    return this.trains.map((t, idx) => {
      const mid = t.cars[1];
      return {
        id: t.id,
        number: idx + 1,
        x: mid.pos.x,
        y: mid.pos.y,
        z: mid.pos.z,
        rotY: mid.rotY,
        isUnderground: mid.pos.y < -1.5,
        state: t.state
      };
    });
  }
}
