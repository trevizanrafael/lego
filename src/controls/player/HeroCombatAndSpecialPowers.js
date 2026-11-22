import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';

export const heroCombatAndSpecialPowersMethods = {
  _alignCharacterToCrosshair() {
    const aimDir = new THREE.Vector3();
    this.camera.getWorldDirection(aimDir);
    this.facingAngle = Math.atan2(aimDir.x, aimDir.z);
    this.minifigure.root.rotation.y = this.facingAngle;
    return aimDir;
  },

  /**
   * Clique Esquerdo: Dispara a arma/poder principal de cada Herói ou Arma Veicular
   */
  _firePrimaryAction() {
    if (this.currentVehicle) {
      this._fireVehicleWeapon();
      return;
    }
    if (this.operatorWeapons?.isOperatorActive()) {
      this.operatorWeapons.handlePrimaryMouseDown();
      return;
    }
    if (this.primaryCooldown > 0) return;

    const hero = this.minifigure.currentHeroKey;

    if (hero === 'tita' && this.grabbedCar) {
      this._toggleTitaCarGrabOrThrow();
      return;
    }

    this._alignCharacterToCrosshair();

    if (!this.destructibles) return;
    const aimData = this.destructibles.getAimTargetPoint(this.camera, 85);
    const rightVec = new THREE.Vector3(-Math.cos(this.facingAngle), 0, Math.sin(this.facingAngle));

    const fwdX = Math.sin(this.facingAngle);
    const fwdZ = Math.cos(this.facingAngle);
    const muzzleAt = (fwd, right, up) => new THREE.Vector3(
      this.position.x + fwdX * fwd + rightVec.x * right,
      this.position.y + up,
      this.position.z + fwdZ * fwd + rightVec.z * right
    );

    if (hero === 'caveira') {
      this.minifigure.triggerShoot();
      this.primaryCooldown = 0.11;
      this.destructibles.spawnRifleBullet(muzzleAt(0.95, 0.45, 1.28), aimData.point);
    } else if (hero === 'solaris') {
      this.minifigure.triggerShoot();
      this.primaryCooldown = 0.28;
      this.destructibles.spawnFireball(muzzleAt(0.85, 0, 1.32), aimData.point);
    } else if (hero === 'tita') {
      this.minifigure.triggerShoot();
      this.primaryCooldown = 0.036;
      this.destructibles.spawnTitaRotaryBullet(muzzleAt(1.55, 0.86, 1.98), aimData.point);
    } else if (hero === 'vingador') {
      const furorMult = this.vingadorFurorTimer > 0 ? 0.4 : 1.0;
      const wKey = this.minifigure.vingadorWeapon || 'dual_smg';
      if (wKey === 'dual_smg') {
        this.primaryCooldown = 0.065 * furorMult;
        const recoilSide = this.minifigure.triggerVingadorDualRecoil ? this.minifigure.triggerVingadorDualRecoil() : 0;
        this.destructibles.spawnDualSmgBullets(muzzleAt(0.98, -0.48, 1.28), muzzleAt(0.98, 0.48, 1.28), aimData.point, recoilSide);
      } else if (wKey === 'shotgun') {
        this.minifigure.triggerShoot();
        this.primaryCooldown = 0.26 * furorMult;
        this.destructibles.spawnShotgunBlast(muzzleAt(1.12, 0.45, 1.28), aimData.point);

        const aimDir = new THREE.Vector3();
        this.camera.getWorldDirection(aimDir);
        if (!this.isGrounded || aimDir.y < -0.18) {
          const recoilDir = aimDir.clone().negate().normalize();
          this.isGrounded = false;
          this.position.y += 0.24;
          this.velocity.y = Math.max(this.velocity.y * 0.35 + recoilDir.y * 16.5, 13.5);
          this.blastVelocity.set(this.velocity.x * 0.55 + recoilDir.x * 16.5, 0, this.velocity.z * 0.55 + recoilDir.z * 16.5);
          this.blastJumpTimer = Math.max(this.blastJumpTimer, 0.52);
          this.velocity.x = this.blastVelocity.x;
          this.velocity.z = this.blastVelocity.z;
        }
      } else {
        this.minifigure.triggerShoot();
        this.primaryCooldown = 0.72 * furorMult;
        this.destructibles.spawnRpgRocket(muzzleAt(1.25, 0.5, 1.38), aimData.point, (blastPos) => {
          this.applyRocketJumpImpulse(blastPos);
        });
      }
    } else if (hero === 'sombra') {
      this.primaryCooldown = 0.24;
      this.minifigure.triggerPunch();
      this.destructibles.performKatanaSlash(this.position, this.facingAngle, aimData.point);
    } else if (hero === 'turbo') {
      this.primaryCooldown = 0.24;
      this.minifigure.triggerPunch();
      this.destructibles.performTurboChainWhip(this.position, this.facingAngle, aimData.point);
    } else if (hero === 'voltaico') {
      this.primaryCooldown = 0.23;
      this.minifigure.triggerShoot();
      this.destructibles.fireChainLightning(muzzleAt(1.15, 0, 1.38), aimData.point);
    } else if (hero === 'vortex') {
      this.primaryCooldown = 0.25;
      this.minifigure.triggerPunch();
      this.destructibles.performVortexTentacleStrike(this.position, this.facingAngle, this.minifigure.isVortexMonster, aimData.point);
    } else if (hero === 'boss_cv') {
      this.minifigure.triggerShoot();
      this.primaryCooldown = 0.095;
      this.destructibles.spawnDualSmgBullets(muzzleAt(1.02, -0.44, 1.3), muzzleAt(1.02, 0.44, 1.3), aimData.point, 0);
    } else if (hero === 'boss_pcc') {
      this.minifigure.triggerShoot();
      const furorMult = this.vingadorFurorTimer > 0 ? 0.45 : 1.0;
      this.primaryCooldown = 0.11 * furorMult;
      this.destructibles.spawnDualSmgBullets(muzzleAt(1.04, -0.42, 1.28), muzzleAt(1.04, 0.42, 1.28), aimData.point, 0);
    } else if (hero === 'boss_ares') {
      this.minifigure.triggerShoot();
      this.primaryCooldown = 0.12;
      this.destructibles.spawnVehicleProjectile(muzzleAt(1.55, 0.86, 1.98), aimData.point, 'plasma_laser');
    } else if (hero === 'op09') {
      this.customHeroPowers?.firePrimary(aimData.point);
    }
  },

  /**
   * Arremesso de Carga Explosiva / Impulso estilo Satchel da Raze (Clique Direito)
   */
  _throwCaveiraGrenade() {
    if (this.destructibles && this.destructibles.grenades && this.destructibles.grenades.length > 0) {
      const latest = this.destructibles.grenades[this.destructibles.grenades.length - 1];
      if ((latest.age || 0) >= 0.04) {
        this.destructibles.detonateActiveCaveiraGrenade();
        this.secondaryCooldown = 0.08;
        return;
      }
    }

    if (this.secondaryCooldown > 0) return;
    this.secondaryCooldown = 0.22;

    this._alignCharacterToCrosshair();
    this.minifigure.triggerPunch();

    if (this.destructibles) {
      const aimData = this.destructibles.getAimTargetPoint(this.camera, 80);
      const origin = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 0.65,
        this.position.y + 1.15,
        this.position.z + Math.cos(this.facingAngle) * 0.65
      );
      this.destructibles.throwGrenade(
        origin,
        aimData.point,
        this.world ? this.world.colliders : [],
        (blastPos) => this.applyBlastImpulse(blastPos),
        (gx, gz) => (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(gx, gz) : 0)
      );
    }
  },

  /**
   * Super-Impulso 4x Maior estilo Satchel da Raze quando a carga explode perto do Comandante Caveira!
   */
  applyBlastImpulse(blastPos) {
    const playerCenter = new THREE.Vector3(
      this.position.x,
      this.position.y + 0.9,
      this.position.z
    );
    const dist = playerCenter.distanceTo(blastPos);
    const maxBlastJumpRadius = 16.5;

    if (dist > maxBlastJumpRadius) return;

    const power = THREE.MathUtils.clamp(1.25 - dist / 18.0, 0.58, 1.15);
    const isDoubleSatchel = !this.isGrounded && this.blastJumpTimer > 0;

    if (isDoubleSatchel) {
      this.velocity.y = Math.min(62.0, Math.max(this.velocity.y, 24.0) + 28.0 * power);
    } else {
      this.velocity.y = 44.0 * power;
    }
    this.isGrounded = false;

    const awayHoriz = new THREE.Vector3(
      this.position.x - blastPos.x,
      0,
      this.position.z - blastPos.z
    );
    if (awayHoriz.lengthSq() > 0.01) {
      awayHoriz.normalize();
    }

    const lookHoriz = new THREE.Vector3(
      Math.sin(this.facingAngle),
      0,
      Math.cos(this.facingAngle)
    ).normalize();

    const pushDir = awayHoriz.multiplyScalar(0.35).add(lookHoriz.multiplyScalar(0.95)).normalize();
    const horizBoostSpeed = 64.0 * power;

    if (isDoubleSatchel) {
      this.blastVelocity.x += pushDir.x * horizBoostSpeed * 0.65;
      this.blastVelocity.z += pushDir.z * horizBoostSpeed * 0.65;
      const curMag = Math.hypot(this.blastVelocity.x, this.blastVelocity.z);
      if (curMag > 78.0) {
        this.blastVelocity.multiplyScalar(78.0 / curMag);
      }
    } else {
      this.blastVelocity.set(pushDir.x * horizBoostSpeed, 0, pushDir.z * horizBoostSpeed);
    }

    this.blastJumpTimer = 1.55;
    this.cameraShakeTimer = 0.24;
  },

  _startSolarisSupernovaCharge() {
    if (this.supernovaCooldown > 0 || this.supernovaCharging) return;
    this.supernovaCharging = true;
    this.supernovaChargeTime = 0;
    this.supernovaChargeSoundTimer = 0;
  },

  _releaseSolarisSupernovaCharge() {
    if (!this.supernovaCharging) return;
    const heldTime = this.supernovaChargeTime;
    this.supernovaCharging = false;
    this.supernovaChargeTime = 0;

    const chargeRatio = heldTime < 0.25
      ? 0
      : THREE.MathUtils.clamp(heldTime / this.supernovaMaxChargeTime, 0, 1);

    this._triggerSolarisSupernova(chargeRatio);
  },

  _triggerSolarisSupernova(chargeRatio = 0) {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 0.85 + chargeRatio * 0.55;
    this.minifigure.triggerPunch();
    this.cameraShakeTimer = 0.38 + chargeRatio * 0.48;
    if (this.destructibles) {
      const groundY = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
      this.destructibles.triggerSupernova(this.position, chargeRatio, groundY);
    }
  },

  /**
   * HERÓI #3 (Titã Blindado): Investida / Dash Demolidor [Mouse 2 / V] SEM COOLDOWN!
   */
  _triggerTitaRocketPunch() {
    this.secondaryCooldown = 0;
    const aimDir = this._alignCharacterToCrosshair();
    this.minifigure.triggerPunch();
    this.minifigure.isDashing = true;
    this.rocketPunchTimer = 0.30;
    this.rocketPunchDir.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle)).normalize();
    if (!this.isGrounded || aimDir.y > 0.14) {
      this.velocity.y = Math.max(this.velocity.y, aimDir.y * 28.0 + 4.5);
      this.isGrounded = false;
    }
    this.cameraShakeTimer = 0.24;
    if (this.destructibles) {
      this.destructibles.triggerTitaRocketPunch(this.position, this.facingAngle);
    }
  },

  /**
   * HERÓI #3 (Titã Blindado): Pisada Sísmica no Chão [Q]
   */
  _triggerTitaEarthquake() {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 0.85;
    if (this.minifigure.triggerStomp) {
      this.minifigure.triggerStomp();
    } else {
      this.minifigure.triggerPunch();
    }
    this.cameraShakeTimer = 0.48;
    if (this.destructibles) {
      const groundY = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
      this.destructibles.triggerTitaGroundSlam(this.position, 22.0, 150, groundY);
    }
  },

  /**
   * HERÓI #3 (Titã Blindado): Agarrar QUALQUER Veículo acima da cabeça ou Arremessar [Clique Direito / F / G]
   */
  _toggleTitaCarGrabOrThrow() {
    if (!this.destructibles) return;

    if (this.grabbedCar) {
      const carToThrow = this.grabbedCar;
      this.grabbedCar = null;
      this.minifigure.isCarryingCar = false;
      this._alignCharacterToCrosshair();
      this.minifigure.triggerPunch();
      const aimData = this.destructibles.getAimTargetPoint(this.camera, 95);
      const throwOrigin = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 1.6,
        this.position.y + 4.35,
        this.position.z + Math.cos(this.facingAngle) * 1.6
      );
      this.destructibles.throwGrabbedCar(
        carToThrow,
        throwOrigin,
        aimData.point,
        this.world ? this.world.colliders : []
      );
      return;
    }

    let bestCar = null;
    let bestEdgeDist = 9.5;
    for (const obj of this.destructibles.objects) {
      if (obj.destroyed || obj.type !== 'car' || obj.isDriven) continue;
      const centerDist = Math.hypot(
        obj.mesh.position.x - this.position.x,
        obj.mesh.position.z - this.position.z
      );
      const objRadius = obj.radius || 2.5;
      const edgeDist = Math.max(0, centerDist - objRadius * 0.65);
      const vertDiff = Math.abs(obj.mesh.position.y - this.position.y);
      if (edgeDist < bestEdgeDist && vertDiff < 9.5) {
        bestEdgeDist = edgeDist;
        bestCar = obj;
      }
    }

    if (bestCar) {
      this.grabbedCar = bestCar;
      bestCar.isGrabbed = true;
      for (const col of bestCar.colliders) {
        col.disabled = true;
      }
      this.minifigure.isCarryingCar = true;
      soundFX.playPunchSwing();
    } else {
      this._triggerTitaRocketPunch();
    }
  },

  _releaseGrabbedCarOnGround() {
    if (!this.grabbedCar) return;
    const car = this.grabbedCar;
    this.grabbedCar = null;
    car.isGrabbed = false;
    this.minifigure.isCarryingCar = false;
    const dropX = this.position.x + Math.sin(this.facingAngle) * 3.2;
    const dropZ = this.position.z + Math.cos(this.facingAngle) * 3.2;
    const dropY = this.world?.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(dropX, dropZ, this.position.y)
      : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(dropX, dropZ) : 0);
    car.mesh.position.set(dropX, dropY, dropZ);
    car.mesh.rotation.set(0, this.facingAngle, 0);
    car.basePos.copy(car.mesh.position);
    car.baseRot.copy(car.mesh.rotation);
    for (const col of car.colliders) {
      col.disabled = false;
    }
  },

  /**
   * HERÓI #4 (Vingador de Chumbo): Super Impulso de ROCKET JUMP (4x) na explosão da Bazuca!
   */
  applyRocketJumpImpulse(blastPos) {
    if (this.minifigure.currentHeroKey !== 'vingador' || this.currentVehicle) return;
    const playerCenter = new THREE.Vector3(this.position.x, this.position.y + 1.1, this.position.z);
    const dist = playerCenter.distanceTo(blastPos);
    const maxRadius = 18.0;
    if (dist > maxRadius) return;

    const factor = Math.pow(1.0 - dist / maxRadius, 0.55);
    const awayX = this.position.x - blastPos.x;
    const awayZ = this.position.z - blastPos.z;
    const horizLen = Math.hypot(awayX, awayZ);
    const dirX = horizLen > 0.12 ? awayX / horizLen : -Math.sin(this.yaw);
    const dirZ = horizLen > 0.12 ? awayZ / horizLen : -Math.cos(this.yaw);

    const horizBoost = 32.0 + factor * 10.0;
    const vertBoost = 26.0 + factor * 8.0;

    this.isGrounded = false;
    this.position.y += 0.45;
    this.velocity.y = Math.max(0, this.velocity.y) + vertBoost;
    this.blastVelocity.set(dirX * horizBoost, 0, dirZ * horizBoost);
    this.blastJumpTimer = 1.15;
    this.cameraShakeTimer = 0.35;
    this.velocity.x = this.blastVelocity.x;
    this.velocity.z = this.blastVelocity.z;
  },

  /**
   * HERÓI #4 (Vingador de Chumbo): Habilidade [Q] — "INVESTIDA IMPLACÁVEL + MODO FUROR DO JUSTICEIRO"
   */
  _triggerVingadorThrusterDive() {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 2.2;

    const aimDir = this._alignCharacterToCrosshair();
    this.vingadorDiveDir.copy(aimDir).normalize();
    this.vingadorDiveTimer = 0.35;
    this.minifigure.isDiveSliding = true;

    if (aimDir.y > 0.08 || !this.isGrounded) {
      this.isGrounded = false;
      this.position.y += 0.35;
      this.velocity.y = Math.max(12.5, aimDir.y * 46.0);
    } else {
      this.velocity.y = Math.max(this.velocity.y, 4.5);
    }

    this.velocity.x = this.vingadorDiveDir.x * 50.0;
    this.velocity.z = this.vingadorDiveDir.z * 50.0;
    this.currentSpeed = 32.0;

    if (this.destructibles) {
      this.destructibles.spawnVingadorThrusterBlast(this.position);
    }

    this.vingadorFurorTimer = 4.0;
    if (this.minifigure.setVingadorFurorVisual) {
      this.minifigure.setVingadorFurorVisual(true);
    }
    if (this.hud) {
      this.hud.setCharacterPortrait(
        'vingador',
        'VINGADOR DE CHUMBO [FUROR!]',
        'FUROR DO JUSTICEIRO ATIVO (VELOCIDADE 32M/S + 60% CADÊNCIA DE TIRO!)'
      );
      if (this.hud.updateVingadorWeaponHud) {
        this.hud.updateVingadorWeaponHud(this.minifigure.vingadorWeapon || 'dual_smg', true);
      }
    }
  },

  /**
   * HERÓI #5 (Sombra Escarlate): Puxão Magnético [G]
   */
  _triggerSombraMagneticPull() {
    if (this.secondaryCooldown > 0 || !this.destructibles) return;
    this.secondaryCooldown = 0.45;
    this._alignCharacterToCrosshair();
    this.minifigure.triggerPunch();
    const aimData = this.destructibles.getAimTargetPoint(this.camera, 65);
    this.destructibles.performMagneticPull(this.position, aimData);
  },

  /**
   * HERÓI #7 (Voltaico): Super Pulso EMP & Tempestade de Trovões [Q]
   */
  _triggerVoltaicoEmp() {
    if (this.supernovaCooldown > 0 || !this.destructibles) return;
    this.supernovaCooldown = 0.85;
    this.minifigure.triggerPunch();
    this.cameraShakeTimer = 0.45;
    this.destructibles.triggerVoltaicoEmpPulse(this.position, 28.0);
  },

  /**
   * HERÓI #8 (Vórtex): Laço Abissal Preciso [Mouse 2 / G]
   */
  _triggerVortexAbyssalLasso() {
    if (this.grappleState) {
      this._stopGrapple(true);
      return;
    }
    if (this.secondaryCooldown > 0 || !this.destructibles) return;
    this.secondaryCooldown = 0.24;
    const aimDir = this._alignCharacterToCrosshair();
    this.minifigure.triggerPunch();
    const res = this.destructibles.performAbyssalLasso(
      this.position,
      this.facingAngle,
      this.camera,
      this.world ? this.world.colliders : []
    );
    if (res?.pulledVehicle) {
      this.cameraShakeTimer = 0.38;
    } else if (res?.pullPoint) {
      const bestAnchor = res.pullPoint;
      const isDiveGrapple = !this.isGrounded && aimDir.y < -0.15 && bestAnchor.y < this.position.y - 1.5;
      this.grappleState = {
        anchor: bestAnchor,
        timer: 0.48,
        pullSpeed: 74.0,
        isDiveGrapple,
        isSymbioteLasso: true
      };
      this.isGrounded = false;
      if (!isDiveGrapple && this.position.y <= bestAnchor.y) {
        this.velocity.y = Math.max(this.velocity.y, 11.5);
      }
      this.minifigure.isGrappling = true;
    }
  },

  /**
   * HERÓI #8 (Vórtex): Erupção Abissal de Tentáculos e Espinhos 360° [Q]
   */
  _triggerVortexEruption() {
    if (this.supernovaCooldown > 0 || !this.destructibles) return;
    this.supernovaCooldown = 1.1;
    this.minifigure.triggerPunch();
    this.cameraShakeTimer = 0.48;
    const groundY = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
    this.destructibles.triggerVortexAbyssalEruption(this.position, 24.0, groundY);
  },

  _triggerBossCvBarrage() {
    if (this.supernovaCooldown > 0 || !this.destructibles) return;
    this.supernovaCooldown = 0.9;
    this._alignCharacterToCrosshair();
    this.minifigure.triggerShoot();
    const aimData = this.destructibles.getAimTargetPoint(this.camera, 90);
    const rightVec = new THREE.Vector3(-Math.cos(this.facingAngle), 0, Math.sin(this.facingAngle));
    const muzzlePos = new THREE.Vector3(
      this.position.x + Math.sin(this.facingAngle) * 1.2 + rightVec.x * 0.45,
      this.position.y + 1.38,
      this.position.z + Math.cos(this.facingAngle) * 1.2 + rightVec.z * 0.45
    );
    this.destructibles.spawnRpgRocket(muzzlePos, aimData.point);
  },

  _triggerBossCvWarCry() {
    this._triggerTacticalRoll();
    const lc = this.world?.livingCity;
    if (lc && typeof lc.playerHp === 'number') {
      const maxHp = lc.playerMaxHp || 380;
      lc.playerHp = Math.min(maxHp, lc.playerHp + Math.round(maxHp * 0.25));
      this.hud?.setPlayerHealth?.(lc.playerHp, maxHp, false);
    }
  },

  _triggerBossPccOvercharge() {
    this.vingadorFurorTimer = 4.5;
    this.minifigure.setVingadorFurorVisual?.(true);
    soundFX.playHeroSwap?.();
  },

  _triggerBossAresCollapse() {
    if (this.supernovaCooldown > 0) return;
    this._triggerTitaEarthquake();
    this.supernovaCooldown = 0;
    this._triggerVoltaicoEmp();
    this.supernovaCooldown = 1.1;
  }
};
