import { soundFX } from '../../audio/SoundFX.js';
import {
  applyAircraftCustomization,
  getActiveAircraftSaveData
} from '../../world/AircraftCustomGarage.js';

export const vehicleInteractionAndPromptsMethods = {
  /**
   * Busca o veículo intacto mais próximo (Carro, Moto, Caminhão-Carreta, Tanque, Barco, Navio Cargueiro, Helicóptero ou Avião)
   */
  findNearbyVehicle() {
    if (!this.destructibles) return null;
    let closest = null;
    let bestScore = Infinity;

    const candidates = this.destructibles._dynamicObjects || this.destructibles.objects;
    for (let i = 0; i < candidates.length; i++) {
      const obj = candidates[i];
      if (obj.destroyed || obj.type !== 'car') continue;
      const spec = obj.mesh.userData?.vehicleSpec;

      const dx = this.position.x - obj.mesh.position.x;
      const dz = this.position.z - obj.mesh.position.z;
      const distSq = dx * dx + dz * dz;
      if (!spec?.isColossalShip && distSq > 625.0) continue;
      const dy = Math.abs(obj.mesh.position.y - this.position.y);

      if (spec?.isColossalShip) {
        if (dy > 32.0) continue;
        const yaw = obj.mesh.rotation.y || 0;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const localX = dx * cosY - dz * sinY;
        const localZ = dx * sinY + dz * cosY;
        if (Math.abs(localX) <= 58.0 && Math.abs(localZ) <= 132.0) {
          const hullDist = Math.hypot(
            Math.max(0, Math.abs(localX) - 24.0),
            Math.max(0, Math.abs(localZ) - 115.0)
          );
          const score = hullDist + 1.5;
          if (score < bestScore) {
            bestScore = score;
            closest = obj;
          }
        }
        continue;
      }

      if (spec?.isHeavyTruck) {
        if (dy > 5.5) continue;
        const yaw = obj.mesh.rotation.y || 0;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const localX = dx * cosY - dz * sinY;
        const localZ = dx * sinY + dz * cosY;
        const boxDist = Math.hypot(
          Math.max(0, Math.abs(localX) - 2.6),
          Math.max(0, Math.abs(localZ) - 11.4)
        );
        if (boxDist <= 4.5 && boxDist < bestScore) {
          bestScore = boxDist;
          closest = obj;
        }
        continue;
      }

      const maxRadius = spec?.enterRadius ?? this.vehicleEnterRadius;
      const maxDy = spec?.category === 'plane' || spec?.category === 'helicopter' ? 6.5 : 4.2;
      if (dy > maxDy) continue;
      const dist = Math.hypot(dx, dz);
      if (dist <= maxRadius && dist < bestScore) {
        bestScore = dist;
        closest = obj;
      }
    }
    return closest;
  },

  _findNearbyHeroElevator() {
    const pads = this.world?.heroTowerData?.elevatorPads;
    if (!pads) return null;
    const distGround = Math.hypot(this.position.x - pads.ground.x, this.position.z - pads.ground.z);
    if (distGround <= 5.5 && Math.abs(this.position.y - pads.ground.y) <= 4.0) {
      return {
        target: { x: pads.roof.x, y: pads.roof.y + 0.25, z: pads.roof.z + 3.5 },
        label: 'ELEVADOR QUÂNTICO -> TOPO DA TORRE DOS HERÓIS (310m)'
      };
    }
    const distRoof = Math.hypot(this.position.x - pads.roof.x, this.position.z - pads.roof.z);
    if (distRoof <= 5.5 && Math.abs(this.position.y - pads.roof.y) <= 4.0) {
      return {
        target: { x: pads.ground.x, y: pads.ground.y + 0.25, z: pads.ground.z + 4.5 },
        label: 'ELEVADOR QUÂNTICO -> SAGUÃO INTERNO DO QG (TÉRREO)'
      };
    }
    return null;
  },

  _findNearbyLegoCustoms() {
    const data = this.world?.legoCustomsData;
    if (!data) return null;

    if (this.currentVehicle) {
      const spec = this.currentVehicle.mesh?.userData?.vehicleSpec;
      if (spec?.category || spec?.isColossalShip) return null;
      const distLift = Math.hypot(
        this.currentVehicle.mesh.position.x - data.liftPos.x,
        this.currentVehicle.mesh.position.z - data.liftPos.z
      );
      const dyLift = Math.abs(this.currentVehicle.mesh.position.y - data.liftPos.y);
      if (distLift <= 9.2 && dyLift <= 3.8) {
        return { mode: 'lift_drive', dist: distLift, label: 'TUNAR VEÍCULO NA LEGO CUSTOMS' };
      }
      return null;
    }

    const distConsole = Math.hypot(this.position.x - data.consolePos.x, this.position.z - data.consolePos.z);
    if (distConsole <= 5.2 && Math.abs(this.position.y - data.consolePos.y) <= 3.5) {
      return { mode: 'console_foot', dist: distConsole, label: 'ACESSAR OFICINA LEGO CUSTOMS' };
    }
    const distTerm = Math.hypot(
      this.position.x - data.retrievalTerminalPos.x,
      this.position.z - data.retrievalTerminalPos.z
    );
    if (distTerm <= 5.2 && Math.abs(this.position.y - data.retrievalTerminalPos.y) <= 3.5) {
      return {
        mode: 'garage_terminal',
        dist: distTerm,
        label: 'RETIRAR CARRO SALVO // GARAGEM LEGO CUSTOMS'
      };
    }
    return null;
  },

  _findNearbyCustomizerPedestal() {
    const lab = this.world?.customizerLabPedestal;
    if (!lab) return null;
    const cPos = lab.consolePos || lab.pedestalPos;
    const pPos = lab.pedestalPos || cPos;
    const distConsole = Math.hypot(this.position.x - cPos.x, this.position.z - cPos.z);
    const distPedestal = Math.hypot(this.position.x - pPos.x, this.position.z - pPos.z);
    const minDist = Math.min(distConsole, distPedestal);
    const dy = Math.abs(this.position.y - cPos.y);
    return minDist <= 5.4 && dy <= 3.5 ? lab : null;
  },

  toggleVehicleInteraction() {
    if (!this.currentVehicle && !this.activeRide && this.world?.bankElevator?.tryUse(this)) {
      return true;
    }
    if (this.activeRide) {
      if (this.activeRide.type === 'metro') {
        this.exitMetroRide();
        return true;
      }
      return this.exitAmusementRide();
    }
    const customsHit = this._findNearbyLegoCustoms();
    if (customsHit && this.hud?.customsStudio) {
      if (customsHit.mode === 'lift_drive') {
        this.hud.customsStudio.open(this, this.world, this.currentVehicle, 'performance');
        return true;
      }
      if (customsHit.mode === 'garage_terminal') {
        this.hud.customsStudio.open(this, this.world, null, 'garage');
        return true;
      }
      if (customsHit.mode === 'console_foot') {
        this.hud.customsStudio.open(this, this.world, null, 'performance');
        return true;
      }
    }
    const hangarHit = this._findNearbyHelicarrierHangar();
    if (hangarHit && this.hud?.aircraftStudio) {
      const activeType = this.currentVehicle?.mesh?.userData?.carType || null;
      this.hud.aircraftStudio.open(this.world, this, activeType);
      return true;
    }
    if (this.currentVehicle) {
      this.exitVehicle();
      return true;
    }
    const customizerLab = this._findNearbyCustomizerPedestal();
    if (customizerLab && this.hud?.creatorStudio) {
      this.hud.creatorStudio.open(this, this.world);
      return true;
    }
    const attrHit = this.world?.attractions?.findNearbyAttraction(this.position);
    if (attrHit) return this.enterAmusementRide(attrHit);

    const metroRide = this.world?.metroSystem?.findBoardableCar?.(this.position);
    if (metroRide) return this.enterMetroRide(metroRide);

    const car = this.findNearbyVehicle();
    if (car) {
      this.enterVehicle(car);
      return true;
    }
    const elev = this._findNearbyHeroElevator();
    if (elev) {
      this.ridingMetroCar = null;
      this.position.set(elev.target.x, elev.target.y, elev.target.z);
      this.velocity.set(0, 0, 0);
      this.currentSpeed = 0;
      this.isGrounded = true;
      this.minifigure.root.position.copy(this.position);
      soundFX.playStudCollect(1000);
      return true;
    }
    const metroTotem = this._findNearbyMetroTotem();
    if (metroTotem) {
      this.ridingMetroCar = null;
      this.position.set(metroTotem.target.x, metroTotem.target.y + 0.08, metroTotem.target.z);
      this.velocity.set(0, 0, 0);
      this.currentSpeed = 0;
      this.isGrounded = true;
      this.minifigure.root.position.copy(this.position);
      if (typeof soundFX.playMetroDingDong === 'function') {
        soundFX.playMetroDingDong(0.85);
      } else {
        soundFX.playStudCollect(100);
      }
      return true;
    }
    return false;
  },

  enterVehicle(carObj) {
    this._lastDryCarPos = null;
    if (!carObj || carObj.destroyed) return;
    const rawSpec = carObj.mesh?.userData?.vehicleSpec;
    if (
      carObj.mesh?.userData?.isHelicarrierParked ||
      ((carObj.mesh?.position?.y || 0) >= 398 &&
        (rawSpec?.category === 'plane' || rawSpec?.category === 'helicopter'))
    ) {
      const aircraftType = carObj.mesh?.userData?.carType || rawSpec?.id;
      const savedAirCfg = getActiveAircraftSaveData()?.configsByType?.[aircraftType];
      if (savedAirCfg && !carObj.mesh?.userData?.aircraftCustomConfig) {
        applyAircraftCustomization(carObj, savedAirCfg);
      }
    }
    this.currentVehicle = carObj;
    carObj.isDriven = true;
    carObj.shakeTimer = 0;
    carObj.mesh.rotation.order = 'YXZ';
    this.minifigure.root.rotation.order = 'YXZ';
    this.vehicleSpeed = 0;
    this.vehicleVerticalSpeed = 0;
    this.vehicleAirVelY = 0;
    this.vehicleAirborne = false;
    this.vehiclePitch = 0;
    this.vehicleWheeliePitch = 0;
    this._vehicleWheelieLiftY = 0;
    this.vehicleBank = 0;
    this.vehicleHeading = carObj.mesh.rotation.y;
    this.vehicleSteerAngle = 0;
    this.vehicleDriftAngle = 0;
    this.isDrifting = false;
    this.isTurboActive = false;
    this.isSwimming = false;
    this.keys.sprint = false;
    this.keys.turbo = false;
    this.isFlying = false;
    this.isSupersonic = false;
    this.velocity.set(0, 0, 0);

    if (this.destructibles) this.destructibles.updateSolarBeam(false);
    for (const col of carObj.colliders) col.disabled = true;

    const spec = carObj.mesh.userData?.vehicleSpec;
    if (spec?.isColossalShip) {
      this.position.set(carObj.mesh.position.x, 24.0, carObj.mesh.position.z);
      this.distance = this.targetDistance * (spec.cameraDistScale ?? 12.5);
      this.cameraLookTarget.set(carObj.mesh.position.x, 25.5, carObj.mesh.position.z);
    } else {
      this.position.set(carObj.mesh.position.x, carObj.mesh.position.y, carObj.mesh.position.z);
    }
    this.facingAngle = this.vehicleHeading;
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, 0, Boolean(spec?.openTop), Boolean(spec?.isMotorcycle), 0);
    }
    soundFX.playCarEngineStart();
  },

  exitVehicle() {
    const carObj = this.currentVehicle;
    if (!carObj) return;

    const spec = carObj.mesh.userData?.vehicleSpec;
    const category = spec?.category || 'car';

    carObj.isDriven = false;
    this.isDrifting = false;
    this.isTurboActive = false;
    this.vehicleDriftAngle = 0;
    this.vehicleVerticalSpeed = 0;
    this.vehiclePitch = 0;
    this.vehicleWheeliePitch = 0;
    this._vehicleWheelieLiftY = 0;
    this.vehicleBank = 0;

    carObj.mesh.rotation.x = 0;
    carObj.mesh.rotation.z = 0;
    if (category === 'car') {
      const restedY = this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(carObj.mesh.position.x, carObj.mesh.position.z, carObj.mesh.position.y)
        : (this.world?.getTerrainHeightAt
          ? this.world.getTerrainHeightAt(carObj.mesh.position.x, carObj.mesh.position.z)
          : (carObj.groundY ?? 0));
      carObj.mesh.position.y = restedY;
    }
    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      for (const f of turboFlames) f.visible = false;
    }

    const carPos = carObj.mesh.position;
    const heading = this.vehicleHeading;
    carObj.basePos.copy(carPos);
    carObj.baseRot.copy(carObj.mesh.rotation);
    carObj.groundY = carPos.y;

    const isRotated90 = Math.abs(Math.sin(heading)) > 0.7;

    if (spec?.isColossalShip) {
      const cosY = Math.cos(heading);
      const sinY = Math.sin(heading);
      for (const col of carObj.colliders) {
        if (!col || carObj.destroyed) continue;
        const lx = col.localX ?? 0;
        const lz = col.localZ ?? 0;
        const lw = col.localW ?? 46;
        const ld = col.localD ?? 220;
        const wx = carPos.x + lx * cosY + lz * sinY;
        const wz = carPos.z - lx * sinY + lz * cosY;
        const ww = isRotated90 ? ld : lw;
        const wd = isRotated90 ? lw : ld;
        col.minX = wx - ww * 0.5;
        col.maxX = wx + ww * 0.5;
        col.minZ = wz - wd * 0.5;
        col.maxZ = wz + wd * 0.5;
        col.minY = col.localMinY ?? 0;
        col.maxY = col.localMaxY ?? 9.45;
        col.disabled = false;
      }
      this.position.set(carPos.x, 9.5, carPos.z);
      this.velocity.set(0, 0, 0);
      this.currentSpeed = 0;
      this.isGrounded = true;
      this.currentVehicle = null;
      this.vehicleSpeed = 0;
      if (this.minifigure.setSeatedInVehicle) this.minifigure.setSeatedInVehicle(false);
      this.minifigure.root.rotation.order = 'YXZ';
      this.minifigure.root.rotation.set(0, this.facingAngle, 0);
      this.minifigure.root.position.copy(this.position);
      return;
    }

    const isMoto = Boolean(spec?.isMotorcycle);
    const baseW = spec?.isHeavyTruck ? 5.2 : category === 'plane' ? 7.5 : category === 'helicopter' ? 4.2 : isMoto ? 1.45 : 2.4;
    const baseD = spec?.isHeavyTruck ? 23.0 : category === 'plane' ? 14.0 : category === 'helicopter' ? 9.5 : isMoto ? 3.8 : 4.8;
    const carWidth = isRotated90 ? baseD : baseW;
    const carDepth = isRotated90 ? baseW : baseD;
    const cabinWidth = isRotated90 ? 2.5 : 2.1;
    const cabinDepth = isRotated90 ? 2.1 : 2.5;

    if (carObj.colliders[0] && !carObj.destroyed) {
      const c1 = carObj.colliders[0];
      c1.minX = carPos.x - carWidth * 0.5;
      c1.maxX = carPos.x + carWidth * 0.5;
      c1.minZ = carPos.z - carDepth * 0.5;
      c1.maxZ = carPos.z + carDepth * 0.5;
      c1.minY = carPos.y;
      c1.maxY = carPos.y + (carObj.height || 2.1);
      c1.disabled = false;
    }
    if (carObj.colliders[1] && !carObj.destroyed) {
      const c2 = carObj.colliders[1];
      c2.minX = carPos.x - cabinWidth * 0.5;
      c2.maxX = carPos.x + cabinWidth * 0.5;
      c2.minZ = carPos.z - cabinDepth * 0.5;
      c2.maxZ = carPos.z + cabinDepth * 0.5;
      c2.minY = carPos.y;
      c2.maxY = carPos.y + 2.05;
      c2.disabled = false;
    }

    const exitDist = spec?.isHeavyTruck ? 3.8 : category === 'plane' ? 5.2 : category === 'helicopter' ? 3.4 : 2.25;
    let exitX = carPos.x + Math.cos(heading) * exitDist;
    let exitZ = carPos.z - Math.sin(heading) * exitDist;
    const exitSurfaceY = this.world?.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(exitX, exitZ, carPos.y)
      : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(exitX, exitZ) : 0);
    let exitY = Math.max(carPos.y, exitSurfaceY);

    if (category === 'boat' && this.world?.isDeepWaterAt) {
      for (let distTry = 2.5; distTry <= 7.0; distTry += 1.0) {
        let foundDry = false;
        for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 4) {
          const tx = carPos.x + Math.cos(ang) * distTry;
          const tz = carPos.z + Math.sin(ang) * distTry;
          if (!this.world.isDeepWaterAt(tx, tz, { forCar: true })) {
            exitX = tx;
            exitZ = tz;
            const dryTerrainY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(tx, tz) : 0;
            exitY = dryTerrainY + 0.15;
            foundDry = true;
            break;
          }
        }
        if (foundDry) break;
      }
    }

    this.position.set(exitX, exitY, exitZ);
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    this.isGrounded = true;
    this.currentVehicle = null;
    this.vehicleSpeed = 0;
    if (this.minifigure.setSeatedInVehicle) this.minifigure.setSeatedInVehicle(false);
    this.minifigure.root.rotation.order = 'YXZ';
    this.minifigure.root.rotation.set(0, this.facingAngle, 0);
    this.minifigure.root.position.copy(this.position);
  },

  _updateVehiclePrompt() {
    if (this.hud && typeof this.hud.updateVehicleSpeedometer === 'function') {
      this.hud.updateVehicleSpeedometer(
        this.currentVehicle,
        this.vehicleSpeed,
        this.vehicleVerticalSpeed || 0,
        this.isTurboActive,
        this.isDrifting
      );
    }

    if (!this.vehiclePromptEl || !this.vehiclePromptTextEl) return;

    if (this.activeRide) {
      if (this.activeRide.type === 'metro') {
        const metro = this.world?.metroSystem;
        const exit = metro?.getDisembarkPoint?.(this.activeRide);
        const next = metro?.getNextStation?.(this.activeRide.train);
        this.vehiclePromptTextEl.textContent = exit
          ? `DESEMBARCAR — ${exit.stationName}`
          : `PRÓXIMA ESTAÇÃO: ${next?.shortName || 'METRÔ'}`;
      } else {
        this.vehiclePromptTextEl.textContent = 'SAIR DA ATRAÇÃO';
      }
      this.vehiclePromptEl.classList.remove('hidden');
      return;
    }

    const customsHit = this._findNearbyLegoCustoms();
    const hangarHit = this._findNearbyHelicarrierHangar();

    if (this.currentVehicle) {
      if (customsHit?.mode === 'lift_drive') {
        this.vehiclePromptTextEl.textContent = customsHit.label;
        this.vehiclePromptEl.classList.remove('hidden');
      } else if (hangarHit) {
        this.vehiclePromptTextEl.textContent = hangarHit.label;
        this.vehiclePromptEl.classList.remove('hidden');
      } else {
        this.vehiclePromptEl.classList.add('hidden');
      }
      return;
    }

    if (customsHit || hangarHit) {
      this.vehiclePromptTextEl.textContent = (customsHit || hangarHit).label;
      this.vehiclePromptEl.classList.remove('hidden');
      return;
    }

    if (this._findNearbyCustomizerPedestal()) {
      this.vehiclePromptTextEl.textContent = 'ACESSAR CRIADOR DE PERSONAGEM (OP-09)';
      this.vehiclePromptEl.classList.remove('hidden');
      return;
    }

    const attrHit = this.world?.attractions?.findNearbyAttraction(this.position);
    if (attrHit) {
      this.vehiclePromptTextEl.textContent = attrHit.label;
      this.vehiclePromptEl.classList.remove('hidden');
      return;
    }

    const metroRide = this.world?.metroSystem?.findBoardableCar?.(this.position);
    if (metroRide) {
      const next = this.world.metroSystem.getNextStation?.(metroRide.train);
      this.vehiclePromptTextEl.textContent = next
        ? `EMBARCAR NO METRÔ (PARADO EM ${next.shortName})`
        : 'EMBARCAR NO METRÔ';
      this.vehiclePromptEl.classList.remove('hidden');
      return;
    }

    this.nearbyVehicle = this.findNearbyVehicle();
    if (this.nearbyVehicle) {
      const carName = this.nearbyVehicle.mesh.userData?.carName || 'VEÍCULO LEGO';
      const spec = this.nearbyVehicle.mesh.userData?.vehicleSpec;
      const actionVerb =
        spec?.category === 'boat' ? 'NAVEGAR EM' :
          spec?.category === 'helicopter' || spec?.category === 'plane' ? 'PILOTAR' : 'ENTRAR EM';
      const isCarrierAir =
        this.position.y > 404 && (spec?.category === 'helicopter' || spec?.category === 'plane');
      this.vehiclePromptTextEl.textContent = isCarrierAir
        ? `${actionVerb} ${carName}  •  [K] PERSONALIZAR`
        : `${actionVerb} ${carName}`;
      this.vehiclePromptEl.classList.remove('hidden');
      return;
    }

    const elev = this._findNearbyHeroElevator();
    const metroTotem = elev ? null : this._findNearbyMetroTotem();
    if (elev || metroTotem) {
      this.vehiclePromptTextEl.textContent = elev ? `USAR ${elev.label}` : metroTotem.label;
      this.vehiclePromptEl.classList.remove('hidden');
    } else {
      this.vehiclePromptEl.classList.add('hidden');
    }
  }
};
