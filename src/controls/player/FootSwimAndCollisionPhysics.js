import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { isFactionOperatorKey, getOperatorSpec } from '../../entities/operators/OperatorCatalog.js';
import { resolveRoleRollSpec } from '../../entities/operators/RoleBaselines.js';
import { getWorldSoftBoundaryForce } from '../../world/CoastlineProfile.js';
import { lerpAngle } from './CameraOrbitAndRig.js';

export const footSwimAndCollisionMethods = {
  _isAnyMenuOpenForRoll() {
    if (this.fastTravelState?.active) return true;
    const h = this.hud;
    if (!h) return false;
    return Boolean(
      h.isTitleScreenActive ||
      h.isPauseMenuOpen ||
      h.isFullMapOpen ||
      h.isDossierOpen ||
      h.isHeroWheelOpen ||
      h.isCharacterGridOpen ||
      h.isCreatorOpen ||
      h.isCustomsOpen ||
      h.isAircraftStudioOpen ||
      h.isTikTokRadioOpen ||
      h.isRadioWheelOpen ||
      h.isConfirmDialogOpen
    );
  },

  _canPerformCtrlTacticalRoll() {
    const hero = this.minifigure?.currentHeroKey;
    const canHeroRoll = isFactionOperatorKey(hero) || hero === 'caveira' || hero === 'sombra';
    if (!canHeroRoll) return false;
    if (this.currentVehicle || this.activeRide) return false;
    if (!this.isGrounded || this.isFlying || this.isSwimming) return false;
    if (this._isAnyMenuOpenForRoll()) return false;
    if ((this.rollCooldownTimer || 0) > 0 || (this.rollImpulseTimer || 0) > 0) return false;
    if (Boolean(this.operatorAbilities?.personal?.shieldActive)) return false;
    if ((this.operatorWeapons?.spinupProgress || 0) > 0.05 && Boolean(this.mouseButtons?.left)) return false;
    return true;
  },

  /**
   * Rolamento de Combate no [Ctrl] / [C] estilo GTA V para os 6 Operadores de Facção + Caveira + Sombra.
   */
  _triggerCtrlTacticalRoll() {
    if (!this._canPerformCtrlTacticalRoll()) return false;

    const hero = this.minifigure.currentHeroKey;
    const opSpec = isFactionOperatorKey(hero) ? getOperatorSpec(hero) : null;
    const rollSpec = resolveRoleRollSpec(opSpec ? opSpec.roles : ['damage']);

    const yaw = Number(this.yaw) || 0;
    const camFwdX = -Math.sin(yaw);
    const camFwdZ = -Math.cos(yaw);
    const camRightX = Math.cos(yaw);
    const camRightZ = -Math.sin(yaw);

    const fwdAxis = (this.keys?.forward ? 1 : 0) - (this.keys?.backward ? 1 : 0);
    const rightAxis = (this.keys?.right ? 1 : 0) - (this.keys?.left ? 1 : 0);
    const isAimingRightClick = Boolean(this.mouseButtons?.right);

    if (!this.rollDir) this.rollDir = new THREE.Vector3(0, 0, 1);

    if (fwdAxis !== 0 || rightAxis !== 0) {
      this.rollDir.set(
        camFwdX * fwdAxis + camRightX * rightAxis,
        0,
        camFwdZ * fwdAxis + camRightZ * rightAxis
      ).normalize();
    } else if (isAimingRightClick) {
      this.rollDir.set(camFwdX, 0, camFwdZ).normalize();
    } else {
      const fa = Number(this.facingAngle) || 0;
      this.rollDir.set(Math.sin(fa), 0, Math.cos(fa)).normalize();
    }

    let localRollYaw = 0;
    if (isAimingRightClick) {
      if (typeof this._alignCharacterToCrosshair === 'function' && this.camera?.getWorldDirection) {
        this._alignCharacterToCrosshair();
      } else {
        this.facingAngle = Math.atan2(camFwdX, camFwdZ);
        if (this.minifigure?.root) {
          this.minifigure.root.rotation.y = this.facingAngle;
        }
      }
      const fa = Number(this.facingAngle) || 0;
      const lx = this.rollDir.x * Math.cos(fa) - this.rollDir.z * Math.sin(fa);
      const lz = this.rollDir.x * Math.sin(fa) + this.rollDir.z * Math.cos(fa);
      localRollYaw = Math.atan2(lx, lz);
    } else {
      this.facingAngle = Math.atan2(this.rollDir.x, this.rollDir.z);
      if (this.minifigure?.root) {
        this.minifigure.root.rotation.y = this.facingAngle;
      }
      localRollYaw = 0;
    }

    if (!this.minifigure?.triggerTacticalRoll?.(rollSpec.duration, localRollYaw)) {
      return false;
    }

    this.operatorWeapons?.cancelReload?.();
    if (this.operatorWeapons) {
      this.operatorWeapons.isCharging = false;
      this.operatorWeapons.chargeTime = 0;
    }

    soundFX.playTacticalRoll();
    this._isCtrlCombatRoll = true;
    this._activeRollSpeed = rollSpec.distance / rollSpec.duration;
    this.rollDurationActive = rollSpec.duration;
    this.rollImpulseTimer = rollSpec.duration;
    this.rollElapsed = 0;
    this.rollCooldownTimer = rollSpec.cooldown;
    this.rollEarlyMitigationSec = rollSpec.earlyMitigationSec;
    this.rollEarlyMitigation = rollSpec.earlyMitigation;
    this.cameraShakeTimer = Math.max(this.cameraShakeTimer || 0, 0.10);
    return true;
  },

  /**
   * Rolamento Acrobático do Comandante Caveira / Sombra Escarlate (Q ou pouso de queda alta)
   */
  _triggerTacticalRoll(customDir = null) {
    if (!this.minifigure.triggerTacticalRoll()) return;
    soundFX.playTacticalRoll();
    this._isCtrlCombatRoll = false;
    this.rollImpulseTimer = 0.38;
    this.rollDurationActive = 0.38;
    this.rollElapsed = 0;

    if (!this.rollDir) this.rollDir = new THREE.Vector3(0, 0, 1);
    if (customDir && customDir.lengthSq() > 0.01) {
      this.rollDir.copy(customDir).normalize();
    } else {
      this.rollDir.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle)).normalize();
    }
    this.facingAngle = Math.atan2(this.rollDir.x, this.rollDir.z);
    this.minifigure.root.rotation.y = this.facingAngle;
  },

  _findGroundSupportAt(x, z, currentY) {
    const surfaceY = this.world?.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(x, z, currentY)
      : (this.world?.getTerrainHeightAt?.(x, z) ?? 0);
    // Sobre água profunda vale a água, a menos que haja um viaduto/ponte por cima (aí vale o tabuleiro)
    let supportY = this.world?.isDeepWaterAt?.(x, z, { forCar: true })
      ? Math.max(this.world.getWaterSurfaceY(x, z), surfaceY)
      : surfaceY;
    const metroHit = this.world?.metroSystem?.findSupportingCarAt?.(x, z, currentY, supportY);
    if (metroHit && metroHit.supportY > supportY) {
      supportY = metroHit.supportY;
    }
    const supportCols = this.world?.getCollidersNear
      ? this.world.getCollidersNear(x, z, 2.0)
      : (this.world?.colliders || []);
    for (const col of supportCols) {
      if (col.disabled) continue;
      if (x >= col.minX && x <= col.maxX && z >= col.minZ && z <= col.maxZ) {
        if (currentY + 2.5 >= col.maxY && col.maxY > supportY) {
          supportY = col.maxY;
        }
      }
    }
    return supportY;
  },

  /**
   * Transporte físico frame-a-frame quando apoiado no piso interno ou no teto de um vagão do Metrô LEGO!
   */
  _applyMetroCarStandingTransport() {
    if (this.ridingMetroCar && !this.isFlying && !this.grappleState) {
      const mc = this.ridingMetroCar;
      if (mc.deltaPos) {
        this.position.x += mc.deltaPos.x;
        this.position.y += mc.deltaPos.y;
        this.position.z += mc.deltaPos.z;
      }
      if (mc.deltaRotY && Math.abs(mc.deltaRotY) > 1e-6) {
        const relX = this.position.x - mc.pos.x;
        const relZ = this.position.z - mc.pos.z;
        const c = Math.cos(mc.deltaRotY);
        const s = Math.sin(mc.deltaRotY);
        this.position.x = mc.pos.x + relX * c + relZ * s;
        this.position.z = mc.pos.z - relX * s + relZ * c;
        this.facingAngle += mc.deltaRotY;
        this.yaw += mc.deltaRotY;
      }
    }
  },

  _updateTacticalRollImpulse(dt) {
    const safeDt = Math.max(0, Number(dt) || 0);
    const prevImpulse = Math.max(0, Number(this.rollImpulseTimer) || 0);
    const effectiveDt = Math.min(safeDt, prevImpulse);
    if (prevImpulse > 0) {
      this.rollElapsed = (this.rollElapsed || 0) + safeDt;
    }
    this.rollImpulseTimer = Math.max(0, prevImpulse - safeDt);
    if ((this.rollCooldownTimer || 0) > 0) {
      this.rollCooldownTimer = Math.max(0, this.rollCooldownTimer - safeDt);
    }

    const isSombra = this.minifigure?.currentHeroKey === 'sombra';
    if (!this.rollDir) this.rollDir = new THREE.Vector3(0, 0, 1);

    if (this._isCtrlCombatRoll) {
      const baseRollSpeed = Number(this._activeRollSpeed) || (3.6 / 0.42);
      const frameScale = safeDt > 1e-6 ? (effectiveDt / safeDt) : 1.0;
      this.velocity.x = this.rollDir.x * baseRollSpeed * frameScale;
      this.velocity.z = this.rollDir.z * baseRollSpeed * frameScale;
      this.currentSpeed = baseRollSpeed;

      if (Boolean(this.mouseButtons?.right)) {
        if (typeof this._alignCharacterToCrosshair === 'function' && this.camera?.getWorldDirection) {
          this._alignCharacterToCrosshair();
        } else {
          const yaw = Number(this.yaw) || 0;
          this.facingAngle = Math.atan2(-Math.sin(yaw), -Math.cos(yaw));
          if (this.minifigure?.root) {
            this.minifigure.root.rotation.y = this.facingAngle;
          }
        }
        if (this.minifigure) {
          const fa = Number(this.facingAngle) || 0;
          const lx = this.rollDir.x * Math.cos(fa) - this.rollDir.z * Math.sin(fa);
          const lz = this.rollDir.x * Math.sin(fa) + this.rollDir.z * Math.cos(fa);
          this.minifigure.rollLocalYaw = Math.atan2(lx, lz);
        }
      }

      if (this.rollImpulseTimer <= 0) {
        this._isCtrlCombatRoll = false;
        this._justFinishedCtrlRoll = true;
      }
    } else {
      const rollSpeed = isSombra ? 38.0 : 33.0;
      this.velocity.x = this.rollDir.x * rollSpeed;
      this.velocity.z = this.rollDir.z * rollSpeed;
      this.currentSpeed = isSombra ? 32.0 : 27.5;
    }

    if (isSombra && this.destructibles && Math.random() < 0.72) {
      this.destructibles.spawnSombraShadowStepTrail(this.position, 1.15);
    }
  },

  _updateFootAndGlideLocomotion(dt, moveInput, hasInput, isUsingSolarBeam) {
    if ((this.rollCooldownTimer || 0) > 0) {
      this.rollCooldownTimer = Math.max(0, this.rollCooldownTimer - Math.max(0, Number(dt) || 0));
    }
    if (this._justFinishedCtrlRoll) {
      this._justFinishedCtrlRoll = false;
      if (!hasInput) {
        this.velocity.x = 0;
        this.velocity.z = 0;
        this.currentSpeed = 0;
      }
    }
    const hero = this.minifigure.currentHeroKey;
    const isOperator = isFactionOperatorKey(hero);
    const opSpec = isOperator ? getOperatorSpec(hero) : null;
    const isCaveira = hero === 'caveira';
    const isSombra = hero === 'sombra';
    const isVingador = hero === 'vingador';
    const isTurbo = hero === 'turbo';
    const isVoltaico = hero === 'voltaico';
    const isVortex = hero === 'vortex';
    const isOp09 = hero === 'op09';
    const isVoltaicoGliding = isVoltaico && !this.isGrounded && this.keys.jump;
    const isTurboHoldingQ = isTurbo && Boolean(this.keys.turbo);
    const isOp09Hoverboard = Boolean(isOp09 && this.customHeroPowers?.hoverboardActive);
    this.turboOverdriveActive = isTurboHoldingQ;

    const opSpeedMult = isOperator
      ? (opSpec?.speedMultiplier ?? 1.0) *
        (this.operatorWeapons?.getMoveSpeedMultiplier?.() ?? 1.0) *
        (this.operatorAbilities?.getMoveSpeedMultiplier?.() ?? 1.0)
      : 1.0;

    const heroWalkSpeed =
      isOperator ? 13.0 * opSpeedMult :
        isSombra ? 15.5 :
          isTurbo ? 16.0 :
            isVoltaico ? (isVoltaicoGliding ? 28.0 : 15.5) :
              isVortex ? (this.minifigure.isVortexMonster ? 14.5 : 16.5) :
                isVingador ? 13.5 :
                  isCaveira ? 13.0 :
                    isOp09 ? 9.5 :
                      this.walkSpeed;

    const heroRunSpeed =
      isOperator ? 27.5 * opSpeedMult :
        isSombra ? 32.0 :
          isTurbo ? (isTurboHoldingQ ? 54.0 : 32.0) :
            isVoltaico ? (isVoltaicoGliding ? 38.0 : 30.0) :
              isVortex ? (this.minifigure.isVortexMonster ? 28.0 : 33.0) :
                isVingador ? (this.vingadorFurorTimer > 0 ? 32.0 : 26.0) :
                  isCaveira ? 27.5 :
                    isOp09 ? 14.2 :
                      this.runSpeed;

    const stealthMult = this.stealthTimer > 0 ? (38.0 / 32.0) : 1.0;
    const netSlowMult = this.energyNetSlowTimer > 0 ? 0.55 : 1.0;
    const op09SpeedMult = isOp09 && this.customHeroPowers ? this.customHeroPowers.getSpeedMultiplier() : 1.0;
    const forceRun =
      (isVingador && this.vingadorFurorTimer > 0) ||
      isTurboHoldingQ ||
      isVoltaicoGliding ||
      isOp09Hoverboard;
    const targetMaxSpeed =
      (this.keys.sprint || forceRun ? heroRunSpeed : heroWalkSpeed) *
      stealthMult *
      netSlowMult *
      op09SpeedMult;
    const targetSpeed = hasInput || isTurboHoldingQ ? targetMaxSpeed : 0;

    const accelRate = 22.0;
    this.currentSpeed = THREE.MathUtils.lerp(
      this.currentSpeed,
      targetSpeed,
      Math.min(1, dt * accelRate)
    );

    if (isCaveira && hasInput && this.keys.sprint && this.isGrounded && this.destructibles && Math.random() < 0.35) {
      this.destructibles.spawnCaveiraBlastJumpTrail(this.position);
    } else if (
      isVingador &&
      hasInput &&
      (this.vingadorFurorTimer > 0 || this.keys.sprint) &&
      this.destructibles &&
      Math.random() < (this.vingadorFurorTimer > 0 ? 0.65 : 0.28)
    ) {
      this.destructibles.spawnVingadorShellAndSmokeTrail(this.position);
    } else if (
      isSombra &&
      hasInput &&
      (this.keys.sprint || this.stealthTimer > 0) &&
      this.isGrounded &&
      this.destructibles &&
      Math.random() < 0.48
    ) {
      this.destructibles.spawnSombraShadowStepTrail(this.position, this.stealthTimer > 0 ? 1.25 : 0.92);
    } else if (isVoltaico && this.destructibles && (isVoltaicoGliding || (hasInput && this.keys.sprint))) {
      this.voltaicoGlideFxTimer -= dt;
      if (this.voltaicoGlideFxTimer <= 0) {
        this.voltaicoGlideFxTimer = isVoltaicoGliding ? 0.045 : 0.075;
        this.destructibles.spawnVoltaicoElectricGlideFX(this.position, isVoltaicoGliding);
      }
    }

    const isOperatorAimingOrFiring = isOperator && Boolean(this.mouseButtons.right || this.mouseButtons.left);

    if (hasInput || (isTurbo && this.turboOverdriveActive)) {
      const moveDir = hasInput
        ? moveInput
        : new THREE.Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
      this.velocity.x = moveDir.x * this.currentSpeed;
      this.velocity.z = moveDir.z * this.currentSpeed;

      if (hasInput && !isUsingSolarBeam && !this.mouseButtons.left && !isOperatorAimingOrFiring) {
        const desiredAngle = Math.atan2(moveInput.x, moveInput.z);
        this.facingAngle = lerpAngle(this.facingAngle, desiredAngle, Math.min(1, dt * 16));
        this.minifigure.root.rotation.y = this.facingAngle;
      }
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, Math.min(1, dt * 18));
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, Math.min(1, dt * 18));
    }

    if (isOperatorAimingOrFiring) {
      const aimAngle = Math.atan2(-Math.sin(this.yaw), -Math.cos(this.yaw));
      this.facingAngle = lerpAngle(this.facingAngle, aimAngle, Math.min(1, dt * 22));
      this.minifigure.root.rotation.y = this.facingAngle;
    }
  },

  _applyPostLandingImpacts(moveInput, preLandVy, wasInAir, wasDiveGrappling) {
    // Se o Sombra Escarlate mergulhou para o chão com o Gancho 360° (Dive-Grapple) e tocou o solo,
    // solta a Kunai e já emenda um Rolamento Ninja + Onda de Corte da Lua de Sangue!
    if (wasDiveGrappling && this.isGrounded && this.minifigure.currentHeroKey === 'sombra') {
      this._stopGrapple(false);
      this._triggerTacticalRoll(moveInput);
      if (this.destructibles) {
        this.destructibles.performKatanaSlash(this.position, this.facingAngle);
      }
    }

    // Se o Comandante Caveira ou Sombra Escarlate pousou no chão vindo de uma queda alta,
    // executa automaticamente o Rolamento Acrobático de impacto!
    if (
      wasInAir &&
      this.isGrounded &&
      (this.minifigure.currentHeroKey === 'caveira' || this.minifigure.currentHeroKey === 'sombra') &&
      preLandVy < -13.5
    ) {
      this._triggerTacticalRoll(moveInput);
    }

    // Se o Titã Blindado ou Vórtex em Forma Big-Fig Monstruosa pousou de um salto alto, treme a câmera e cria onda de choque sísmica!
    if (
      wasInAir &&
      this.isGrounded &&
      ((this.minifigure.currentHeroKey === 'tita' && (this.titaSuperJumpActive || preLandVy < -14.0)) ||
        (this.minifigure.currentHeroKey === 'vortex' && this.minifigure.isVortexMonster && preLandVy < -14.0))
    ) {
      this.titaSuperJumpActive = false;
      this.cameraShakeTimer = 0.42;
      if (this.minifigure.triggerStomp) {
        this.minifigure.triggerStomp();
      }
      if (this.destructibles) {
        const groundY = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
        if (this.minifigure.currentHeroKey === 'vortex') {
          this.destructibles.triggerVortexAbyssalEruption(this.position, 16.0, groundY);
        } else {
          this.destructibles.triggerTitaGroundSlam(this.position, 18.0, 130, groundY);
        }
      }
    }
  },

  _clampPlayerWorldBounds(dt) {
    const sbFoot = getWorldSoftBoundaryForce(this.position.x, this.position.z);
    if (sbFoot.intensity > 0) {
      this.position.x += sbFoot.fx * 36 * dt;
      this.position.z += sbFoot.fz * 36 * dt;
    }
    this.position.x = THREE.MathUtils.clamp(this.position.x, sbFoot.hardBounds.minX, sbFoot.hardBounds.maxX);
    this.position.z = THREE.MathUtils.clamp(this.position.z, sbFoot.hardBounds.minZ, sbFoot.hardBounds.maxZ);
    this.position.y = THREE.MathUtils.clamp(this.position.y, -15.5, 560);
  },

  _moveAndCollide(dt) {
    const r = this.playerRadius;
    const stepUpHeight = 0.34;
    const playerHeight = 2.05;

    const moveQueryR = Math.hypot(this.velocity.x * dt, this.velocity.z * dt) + r + 1.8;
    const nearCols = this.world?.getCollidersNear
      ? this.world.getCollidersNear(this.position.x, this.position.z, moveQueryR)
      : (this.world?.colliders || []);

    const nextX = this.position.x + this.velocity.x * dt;
    let blockedX = false;
    for (const col of nearCols) {
      if (col.disabled) continue;
      if (
        nextX + r > col.minX &&
        nextX - r < col.maxX &&
        this.position.z + r > col.minZ &&
        this.position.z - r < col.maxZ
      ) {
        const colMinY = col.minY ?? 0;
        // Só bloqueia horizontalmente se o corpo do boneco estiver na faixa vertical do colisor
        if (
          this.position.y + stepUpHeight < col.maxY &&
          this.position.y + playerHeight > colMinY
        ) {
          blockedX = true;
          break;
        }
      }
    }
    if (!blockedX) {
      this.position.x = nextX;
    } else {
      this.velocity.x = 0;
    }

    const nextZ = this.position.z + this.velocity.z * dt;
    let blockedZ = false;
    for (const col of nearCols) {
      if (col.disabled) continue;
      if (
        this.position.x + r > col.minX &&
        this.position.x - r < col.maxX &&
        nextZ + r > col.minZ &&
        nextZ - r < col.maxZ
      ) {
        const colMinY = col.minY ?? 0;
        if (
          this.position.y + stepUpHeight < col.maxY &&
          this.position.y + playerHeight > colMinY
        ) {
          blockedZ = true;
          break;
        }
      }
    }
    if (!blockedZ) {
      this.position.z = nextZ;
    } else {
      this.velocity.z = 0;
    }

    // Colisão horizontal dinâmica com as paredes/portas deslizantes dos vagões do Metrô LEGO
    if (this.world?.metroSystem?.resolveHorizontalCarCollision) {
      this.world.metroSystem.resolveHorizontalCarCollision(this.position, r);
    }

    const isHoverboarding = Boolean(
      this.minifigure.currentHeroKey === 'op09' &&
      this.customHeroPowers?.hoverboardActive &&
      !this.currentVehicle
    );
    const inDeepWater = Boolean(this.world?.isDeepWaterAt?.(this.position.x, this.position.z, { forCar: true }));
    let supportY = inDeepWater
      ? (this.world.getWaterSurfaceY(this.position.x, this.position.z) + (isHoverboarding ? 0.38 : -0.65))
      : (this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(this.position.x, this.position.z, this.position.y)
        : (this.world?.getTerrainHeightAt?.(this.position.x, this.position.z) ?? 0));
    let ceilingY = Infinity;
    let activeMetroCar = null;

    const metroHit = this.world?.metroSystem?.findSupportingCarAt?.(
      this.position.x,
      this.position.z,
      this.position.y,
      supportY
    );
    if (metroHit && metroHit.supportY >= supportY - 0.02) {
      supportY = metroHit.supportY;
      activeMetroCar = metroHit.car;
      if (metroHit.zone === 'interior') {
        ceilingY = Math.min(ceilingY, metroHit.car.pos.y + metroHit.car.roofOffsetY - 0.2);
      }
    }

    // Teto das Estações e Túneis Subterrâneos do Metrô (Y = -1.1m / -1.2m)
    if (this.position.y < -1.6 && Array.isArray(this.world?.undergroundFloors)) {
      for (const uf of this.world.undergroundFloors) {
        if (
          this.position.x >= uf.minX &&
          this.position.x <= uf.maxX &&
          this.position.z >= uf.minZ &&
          this.position.z <= uf.maxZ
        ) {
          ceilingY = Math.min(ceilingY, uf.ceilingY ?? -1.1);
        }
      }
    }

    for (const col of nearCols) {
      if (col.disabled) continue;
      if (
        this.position.x + r * 0.85 > col.minX &&
        this.position.x - r * 0.85 < col.maxX &&
        this.position.z + r * 0.85 > col.minZ &&
        this.position.z - r * 0.85 < col.maxZ
      ) {
        const colMinY = col.minY ?? 0;
        if (this.position.y + stepUpHeight >= col.maxY && col.maxY >= supportY) {
          supportY = col.maxY;
          activeMetroCar = null;
        } else if (this.position.y + playerHeight <= colMinY + 0.4 && colMinY < ceilingY) {
          ceilingY = colMinY;
        }
      }
    }

    this.position.y += this.velocity.y * dt;

    // Nunca trava a subida do Solaris quando estiver voando e segurando Espaço!
    const isSolarisClimbing = this.isFlying && this.keys.jump;

    // Impede atravessar tetos de interiores (exceto quando o Solaris está subindo em voo livre)
    if (!isSolarisClimbing && this.position.y + playerHeight > ceilingY && this.velocity.y > 0) {
      this.position.y = ceilingY - playerHeight;
      this.velocity.y = 0;
    }

    const wasGroundedDownhill =
      this.isGrounded &&
      this.velocity.y <= 0 &&
      !this.isFlying &&
      this.position.y - supportY > 0 &&
      this.position.y - supportY < 0.9;

    if (!isSolarisClimbing && (this.position.y <= supportY || wasGroundedDownhill)) {
      this.position.y = supportY;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.ridingMetroCar = activeMetroCar;
      this.isSwimming = inDeepWater && !isHoverboarding && supportY < 0 && !activeMetroCar;
      if (this.isFlying && this.keys.descend) {
        this.isFlying = false;
        this.isSupersonic = false;
      }
    } else {
      this.isGrounded = false;
      this.ridingMetroCar = null;
      this.isSwimming = false;
    }
  }
};
