import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';

export const heroActiveStatesUpdaterMethods = {
  _updateTurboGhostBikeRiderFX(dt, prevCarPos) {
    if (this.minifigure.currentHeroKey !== 'turbo') return;

    if (this.minifigure.punchTimer > 0) {
      this.minifigure.punchTimer = Math.max(0, this.minifigure.punchTimer - dt);
      const slashProgress = 1 - this.minifigure.punchTimer / Math.max(0.01, this.minifigure.punchDuration || 0.28);
      if (this.minifigure.rightArmPivot) {
        this.minifigure.rightArmPivot.rotation.x = -1.65;
        this.minifigure.rightArmPivot.rotation.y = 1.25 - slashProgress * 2.5;
        this.minifigure.rightArmPivot.rotation.z = -0.55;
      }
    }
    if (this.isTurboActive && Math.abs(this.vehicleSpeed) > 6.0 && this.destructibles) {
      if (!this._lastLightWallPos) {
        this._lastLightWallPos = prevCarPos.clone();
      } else if (this.position.distanceTo(this._lastLightWallPos) >= 1.1) {
        this.destructibles.spawnTurboLightWallSegment(this._lastLightWallPos, this.position);
        this._lastLightWallPos.copy(this.position);
      }
    }
  },

  _updateHeroContinuousCombatAndCharges(dt) {
    if (this.mouseButtons.left && this.primaryCooldown <= 0) {
      this._firePrimaryAction();
    }

    const isUsingSolarBeam =
      this.minifigure.currentHeroKey === 'solaris' &&
      this.mouseButtons.right;

    this.minifigure.isBeaming = isUsingSolarBeam;

    if (isUsingSolarBeam && this.destructibles) {
      this._alignCharacterToCrosshair();
      const aimData = this.destructibles.getAimTargetPoint(this.camera, 80);
      const beamOrigin = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 0.65,
        this.position.y + 1.38,
        this.position.z + Math.cos(this.facingAngle) * 0.65
      );
      this.destructibles.updateSolarBeam(true, beamOrigin, aimData, dt);
    } else if (this.destructibles) {
      this.destructibles.updateSolarBeam(false);
    }

    if (this.supernovaCharging && this.minifigure.currentHeroKey === 'solaris') {
      this.supernovaChargeTime = Math.min(
        this.supernovaMaxChargeTime,
        this.supernovaChargeTime + dt
      );
      const chargeRatio = this.supernovaChargeTime / this.supernovaMaxChargeTime;
      const currentRadius = THREE.MathUtils.lerp(12.0, 52.0, chargeRatio);
      this.cameraShakeTimer = Math.max(this.cameraShakeTimer, 0.08 + chargeRatio * 0.16);
      this.supernovaChargeSoundTimer -= dt;
      if (this.supernovaChargeSoundTimer <= 0) {
        this.supernovaChargeSoundTimer = 0.11;
        soundFX.playSolarChargeTick(chargeRatio);
      }
      if (this.destructibles?.updateSupernovaChargeVisual) {
        const groundY = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
        this.destructibles.updateSupernovaChargeVisual(
          true,
          this.position,
          chargeRatio,
          currentRadius,
          dt,
          groundY
        );
      }
    } else if (this.titaJumpCharging && this.minifigure.currentHeroKey === 'tita') {
      this.titaJumpChargeTime = Math.min(
        this.titaJumpMaxChargeTime,
        this.titaJumpChargeTime + dt
      );
      const chargeRatio = this.titaJumpChargeTime / this.titaJumpMaxChargeTime;
      this.minifigure.titaJumpChargeRatio = chargeRatio;
      const currentRadius = THREE.MathUtils.lerp(2.4, 8.2, chargeRatio);
      this.cameraShakeTimer = Math.max(this.cameraShakeTimer, 0.05 + chargeRatio * 0.12);
      this.titaJumpChargeSoundTimer -= dt;
      if (this.titaJumpChargeSoundTimer <= 0) {
        this.titaJumpChargeSoundTimer = 0.12;
        soundFX.playSolarChargeTick(chargeRatio);
      }
      if (this.destructibles?.updateSupernovaChargeVisual) {
        const groundY = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
        this.destructibles.updateSupernovaChargeVisual(
          true,
          this.position,
          chargeRatio,
          currentRadius,
          dt,
          groundY
        );
      }
    } else {
      if (this.minifigure) {
        this.minifigure.titaJumpChargeRatio = 0;
      }
      if (this.destructibles?.updateSupernovaChargeVisual) {
        this.destructibles.updateSupernovaChargeVisual(false, this.position);
      }
    }

    if (this.minifigure.currentHeroKey === 'tita' && this.mouseButtons.right && this.rocketPunchTimer <= 0) {
      this._triggerTitaRocketPunch();
    }

    return isUsingSolarBeam;
  },

  _updateVingadorDiveImpulse(dt) {
    this.vingadorDiveTimer = Math.max(0, this.vingadorDiveTimer - dt);
    this.minifigure.isDiveSliding = this.vingadorDiveTimer > 0;
    const diveSpeed = 50.0;
    this.velocity.x = this.vingadorDiveDir.x * diveSpeed;
    this.velocity.z = this.vingadorDiveDir.z * diveSpeed;
    if (this.vingadorDiveDir.y > 0.08) {
      this.velocity.y = Math.max(this.velocity.y, this.vingadorDiveDir.y * 38.0);
    }
    this.currentSpeed = 32.0;

    if (this.destructibles) {
      if (Math.random() < 0.85) {
        this.destructibles.spawnVingadorShellAndSmokeTrail(this.position);
      }
      if (!this._diveImpactPos) this._diveImpactPos = new THREE.Vector3();
      if (!this._nearObjsScratch) this._nearObjsScratch = [];
      const diveImpactPos = this._diveImpactPos.set(
        this.position.x + this.vingadorDiveDir.x * 1.8,
        this.position.y + 1.1,
        this.position.z + this.vingadorDiveDir.z * 1.8
      );
      const nearDiveObjs = this.destructibles.getObjectsNear
        ? this.destructibles.getObjectsNear(diveImpactPos.x, diveImpactPos.z, 6.5, this._nearObjsScratch)
        : this.destructibles.objects;
      for (let i = 0; i < nearDiveObjs.length; i++) {
        const obj = nearDiveObjs[i];
        if (obj.destroyed || obj.isDriven) continue;
        const oPos = obj._isDynamicIndexed && obj.mesh ? obj.mesh.position : obj.basePos;
        const dx = oPos.x - diveImpactPos.x;
        const dz = oPos.z - diveImpactPos.z;
        const dy = Math.abs((oPos.y + obj.height * 0.5) - diveImpactPos.y);
        if (Math.hypot(dx, dz) <= obj.radius + 2.5 && dy <= obj.height + 2.0) {
          this.destructibles.damageObject(obj, 110, diveImpactPos, false, {
            canBreakCrackedWall: true
          });
        }
      }
    }

    if (this.vingadorDiveTimer <= 0 && !this.isGrounded) {
      this.blastVelocity.set(this.velocity.x * 0.82, 0, this.velocity.z * 0.82);
      this.blastJumpTimer = Math.max(this.blastJumpTimer, 0.55);
    }
  },

  _updateTitaRocketPunchImpulse(dt) {
    this.rocketPunchTimer = Math.max(0, this.rocketPunchTimer - dt);
    this.minifigure.isDashing = this.rocketPunchTimer > 0;
    const punchBoost = 44.0;
    this.velocity.x = this.rocketPunchDir.x * punchBoost;
    this.velocity.z = this.rocketPunchDir.z * punchBoost;
    this.currentSpeed = punchBoost;
    if (this.destructibles) {
      if (!this._dashImpactPos) this._dashImpactPos = new THREE.Vector3();
      if (!this._nearObjsScratch) this._nearObjsScratch = [];
      if (Math.random() < 0.75) {
        this.destructibles.spawnFlameTrailParticle(
          this._dashImpactPos.set(this.position.x, this.position.y + 1.4, this.position.z),
          1.35
        );
      }
      const dashImpactPos = this._dashImpactPos.set(
        this.position.x + this.rocketPunchDir.x * 2.2,
        this.position.y + 1.4,
        this.position.z + this.rocketPunchDir.z * 2.2
      );
      const nearDashObjs = this.destructibles.getObjectsNear
        ? this.destructibles.getObjectsNear(dashImpactPos.x, dashImpactPos.z, 7.5, this._nearObjsScratch)
        : this.destructibles.objects;
      for (let i = 0; i < nearDashObjs.length; i++) {
        const obj = nearDashObjs[i];
        if (obj.destroyed || obj.isDriven) continue;
        const oPos = obj._isDynamicIndexed && obj.mesh ? obj.mesh.position : obj.basePos;
        const dx = oPos.x - dashImpactPos.x;
        const dz = oPos.z - dashImpactPos.z;
        const dy = Math.abs((oPos.y + obj.height * 0.5) - dashImpactPos.y);
        if (Math.hypot(dx, dz) <= obj.radius + 3.2 && dy <= obj.height + 2.5) {
          this.destructibles.damageObject(obj, 140, dashImpactPos, false, {
            canBreakCrackedWall: true,
            canBreakSilver: false
          });
        }
      }
    }
  },

  _updateGrapplePull(dt, moveInput) {
    this.grappleState.timer -= dt;
    const handPos = new THREE.Vector3(this.position.x, this.position.y + 1.45, this.position.z);
    const toAnchor = this.grappleState.anchor.clone().sub(handPos);
    const dist = toAnchor.length();
    const isDive = Boolean(this.grappleState.isDiveGrapple);
    const isSymbiote = Boolean(this.grappleState.isSymbioteLasso);

    if (dist <= 3.6 || this.grappleState.timer <= 0) {
      if (isDive) {
        this._stopGrapple(false);
        this._triggerTacticalRoll(moveInput);
        if (this.destructibles && this.minifigure.currentHeroKey === 'sombra') {
          this.destructibles.performKatanaSlash(this.position, this.facingAngle);
        }
      } else {
        this._stopGrapple(true);
        if (isSymbiote && this.destructibles) {
          this.destructibles.performVortexTentacleStrike(
            this.position,
            this.facingAngle,
            this.minifigure.isVortexMonster,
            null
          );
        }
      }
    } else {
      const pullDir = toAnchor.normalize();
      const pullSpeed = this.grappleState.pullSpeed || 68.0;
      this.velocity.x = pullDir.x * pullSpeed + moveInput.x * 12.0;
      this.velocity.z = pullDir.z * pullSpeed + moveInput.z * 12.0;
      this.velocity.y = isDive ? pullDir.y * pullSpeed - 8.0 : pullDir.y * pullSpeed + 3.5;
      if (Math.hypot(pullDir.x, pullDir.z) > 0.05) {
        this.facingAngle = Math.atan2(pullDir.x, pullDir.z);
        this.minifigure.root.rotation.y = this.facingAngle;
      }

      if (this.destructibles && Math.random() < 0.85) {
        if (isSymbiote) {
          this.destructibles.spawnVortexSymbioteTrail(this.position, 1.35);
        } else {
          this.destructibles.spawnSombraShadowStepTrail(this.position, 1.25);
        }
      }

      if (this.grappleCableMesh && this.grappleAnchorMesh) {
        if (this.grappleCableCoreMat) {
          const cableHex = isSymbiote
            ? 0xa855f7
            : this.minifigure.currentHeroKey === 'op09'
              ? 0xe2e8f0
              : 0xff1e42;
          this.grappleCableCoreMat.color.setHex(cableHex);
        }
        if (this.grappleKunaiGroup) this.grappleKunaiGroup.visible = !isSymbiote;
        if (this.grappleSymbioteMawGroup) this.grappleSymbioteMawGroup.visible = isSymbiote;
        this.grappleCableMesh.visible = true;
        this.grappleCableMesh.position.copy(handPos);
        this.grappleCableMesh.lookAt(this.grappleState.anchor);
        this.grappleCableMesh.scale.set(isSymbiote ? 2.6 : 1, isSymbiote ? 2.6 : 1, dist);
        this.grappleAnchorMesh.visible = true;
        this.grappleAnchorMesh.position.copy(this.grappleState.anchor);
        this.grappleAnchorMesh.lookAt(this.grappleState.anchor.clone().add(pullDir));
      }
    }
  },

  _updateBlastJumpAirSteer(dt, moveInput) {
    this.blastJumpTimer = Math.max(0, this.blastJumpTimer - dt);
    const airSteer = 18.5;
    this.velocity.x = this.blastVelocity.x + moveInput.x * airSteer;
    this.velocity.z = this.blastVelocity.z + moveInput.z * airSteer;
    this.blastVelocity.multiplyScalar(Math.max(0.92, 1 - dt * 0.55));
    if (this.destructibles && Math.random() < 0.78) {
      if (this.minifigure.currentHeroKey === 'sombra') {
        this.destructibles.spawnSombraShadowStepTrail(this.position, 1.05);
      } else if (this.minifigure.currentHeroKey === 'vortex') {
        this.destructibles.spawnVortexSymbioteTrail(this.position, 1.15);
      } else if (this.minifigure.currentHeroKey === 'vingador') {
        this.destructibles.spawnVingadorShellAndSmokeTrail(this.position);
      } else {
        this.destructibles.spawnCaveiraBlastJumpTrail(this.position);
      }
    }
  },

  _updateHeroBuffTimersAndTrails(dt) {
    if (this.turboOverdriveActive && this.minifigure.currentHeroKey === 'turbo') {
      if (this.destructibles) {
        if (!this._lastLightWallPos) {
          this._lastLightWallPos = this.position.clone();
        } else if (this.position.distanceTo(this._lastLightWallPos) >= 1.0) {
          this.destructibles.spawnTurboLightWallSegment(this._lastLightWallPos, this.position);
          this._lastLightWallPos.copy(this.position);
        }
      }
    }

    if (this.stealthTimer > 0) {
      this.stealthTimer = Math.max(0, this.stealthTimer - dt);
      if (this.stealthTimer <= 0) {
        this.minifigure.setStealthVisual(false);
        if (this.hud && this.minifigure.currentHeroKey === 'sombra') {
          this.hud.setCharacterPortrait(
            'sombra',
            'SOMBRA ESCARLATE',
            'GANCHO 360° [MOUSE 2] • KATANAS LUA DE SANGUE [MOUSE 1] • ROLAMENTO INVISÍVEL [Q]'
          );
        }
      }
    }

    if (this.vingadorFurorTimer > 0) {
      this.vingadorFurorTimer = Math.max(0, this.vingadorFurorTimer - dt);
      if (this.vingadorFurorTimer <= 0) {
        if (this.minifigure.setVingadorFurorVisual) {
          this.minifigure.setVingadorFurorVisual(false);
        }
        if (this.hud && this.minifigure.currentHeroKey === 'vingador') {
          this.hud.setCharacterPortrait(
            'vingador',
            'VINGADOR DE CHUMBO',
            '[R] TROCAR ARMA: CASTIGADORAS .50 • DOZE 18 BAGOS • BAZUCA ROCKET JUMP • [Q] FUROR'
          );
          if (this.hud.updateVingadorWeaponHud) {
            this.hud.updateVingadorWeaponHud(this.minifigure.vingadorWeapon || 'dual_smg', false);
          }
        }
      }
    }
  },

  _syncCarriedCarPosition() {
    if (this.grabbedCar && !this.grabbedCar.destroyed) {
      this.grabbedCar.mesh.position.set(this.position.x, this.position.y + 4.35, this.position.z);
      this.grabbedCar.mesh.rotation.set(0, this.facingAngle + Math.PI * 0.5, 0);
    }
  }
};
