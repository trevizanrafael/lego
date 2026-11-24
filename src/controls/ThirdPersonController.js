import * as THREE from 'three';
import { CustomHeroPowerRuntime } from '../entities/CustomHeroSystem.js';
import { OperatorWeaponRuntime } from './player/OperatorWeaponRuntime.js';
import { OperatorAbilityRuntime } from './player/OperatorAbilityRuntime.js';
import { UP, cameraOrbitAndRigMethods } from './player/CameraOrbitAndRig.js';
import { controllerInputAndEventsMethods } from './player/ControllerInputAndEvents.js';
import { heroSelectionAndShortcutsMethods } from './player/HeroSelectionAndShortcuts.js';
import { footSwimAndCollisionMethods } from './player/FootSwimAndCollisionPhysics.js';
import { heroFlightAndTraversalMethods } from './player/HeroFlightAndTraversalPowers.js';
import { heroCombatAndSpecialPowersMethods } from './player/HeroCombatAndSpecialPowers.js';
import { heroActiveStatesUpdaterMethods } from './player/HeroActiveStatesUpdater.js';
import { vehicleInteractionAndPromptsMethods } from './player/VehicleInteractionAndPrompts.js';
import { groundVehicleDrivingMethods } from './player/GroundVehicleDrivingPhysics.js';
import { navalAircraftAndRidesMethods } from './player/NavalAircraftAndRidesController.js';

export class ThirdPersonController {
  constructor(camera, domElement, minifigure, world, destructibles = null, hud = null) {
    this.camera = camera;
    this.domElement = domElement;
    this.minifigure = minifigure;
    this.world = world;
    this.destructibles = destructibles;
    this.hud = hud;
    this.position = new THREE.Vector3(0, 0, -104);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.playerRadius = 0.42;
    this.isGrounded = true;
    this.facingAngle = Math.PI;
    this.minifigure.root.rotation.y = this.facingAngle;
    this.walkSpeed = 7.5;
    this.runSpeed = 13.5;
    this.flyHoverSpeed = 28.0;
    this.flyCometSpeed = 85.0;
    this.jumpForce = 11.0;
    this.gravity = -26.0;
    this.currentSpeed = 0;
    this.isFlying = false;
    this.isSupersonic = false;
    this.flightPitch = 0;
    this.flightBank = 0;
    this.lastYaw = 0;
    this.lastSpacePressTime = 0;
    this.supernovaCharging = false;
    this.supernovaChargeTime = 0;
    this.supernovaMaxChargeTime = 2.0;
    this.supernovaChargeSoundTimer = 0;
    this.rollImpulseTimer = 0;
    this.rollDir = new THREE.Vector3(0, 0, -1);
    this.blastJumpTimer = 0;
    this.blastVelocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.3;
    this.distance = 6.0;
    this.targetDistance = 6.0;
    this.shoulderOffset = 0.95;
    this.baseFov = 58;
    this.cameraLookTarget = new THREE.Vector3(0, 1.55, 4);

    this.keys = {
      forward: false, backward: false, left: false, right: false,
      sprint: false, turbo: false, jump: false, descend: false
    };
    this.mouseButtons = { left: false, right: false };
    /** Analógico esquerdo do controle a pé ({x: direita, y: frente, mag}) e esterço analógico em veículos. */
    this.analogMove = null;
    this.analogSteer = null;
    this.isPointerLocked = false;
    this.isDraggingMouse = false;
    this.hasEnteredGame = false;

    this.currentVehicle = null;
    this.nearbyVehicle = null;
    this.vehicleEnterRadius = 4.2;
    this.vehicleSpeed = 0;
    this.vehicleHeading = 0;
    this.vehicleSteerAngle = 0;
    this.vehicleDriftAngle = 0;
    this.vehicleWheelSpin = 0;
    this.vehicleAirVelY = 0;
    this.vehicleAirborne = false;
    this.lastCarSpaceTapTime = 0;
    this._customsExitCooldown = 0;
    this.activeRide = null;
    this.isDrifting = false;
    this.isTurboActive = false;
    this.driftParticleTimer = 0;
    this.vehiclePromptEl = document.getElementById('vehicle-prompt');
    this.vehiclePromptTextEl = document.getElementById('vehicle-prompt-text');

    this.fastTravelState = null;
    this.satOverlayEl = document.getElementById('satellite-fx-overlay');
    this.satFlashEl = document.getElementById('satellite-flash');
    this.satTelemetryEl = document.getElementById('satellite-telemetry');

    this.primaryCooldown = 0;
    this.secondaryCooldown = 0;
    this.supernovaCooldown = 0;
    this.cometTrailTimer = 0;

    this.grabbedCar = null;
    this.titaSuperJumpActive = false;
    this.titaJumpCharging = false;
    this.titaJumpChargeTime = 0;
    this.titaJumpMaxChargeTime = 1.1;
    this.titaJumpChargeSoundTimer = 0;
    this.rocketPunchTimer = 0;
    this.rocketPunchDir = new THREE.Vector3(0, 0, -1);
    this.vingadorDiveTimer = 0;
    this.vingadorDiveDir = new THREE.Vector3(0, 0, -1);
    this.vingadorFurorTimer = 0;
    this.turboOverdriveTimer = 0;
    this.turboOverdriveActive = false;
    this.voltaicoGlideFxTimer = 0;
    this._lastLightWallPos = null;
    this.cameraShakeTimer = 0;
    this.grappleState = null;
    this.stealthTimer = 0;
    this.energyNetSlowTimer = 0;
    this._initGrappleCableMesh();
    this.customHeroPowers = new CustomHeroPowerRuntime(this);
    this.operatorWeapons = new OperatorWeaponRuntime(this);
    this.operatorAbilities = new OperatorAbilityRuntime(this);
    this.operatorWeapons.onCharacterSwitched(this.minifigure.currentHeroKey);
    this.operatorAbilities.onCharacterSwitched(this.minifigure.currentHeroKey);
    this._bindEvents();
  }

  getHorizontalSpeed() {
    return this.currentVehicle ? Math.abs(this.vehicleSpeed) : Math.hypot(this.velocity.x, this.velocity.z);
  }

  update(dt) {
    if (this.hud?.isCreatorOpen) return void this.hud.creatorStudio?.updateStudioCamera(dt);
    if (this.hud?.isCustomsOpen) return void this.hud.customsStudio?.updateStudioCamera(dt);
    if (this.hud?.isAircraftStudioOpen) return void this.hud.aircraftStudio?.updateStudioCamera(dt, this.camera);
    if (this._customsExitCooldown > 0) this._customsExitCooldown = Math.max(0, this._customsExitCooldown - dt);

    if (
      this.hud?.isTikTokRadioOpen || this.hud?.isPauseMenuOpen || this.hud?.isFullMapOpen ||
      this.hud?.isDossierOpen || this.hud?.isCharacterGridOpen ||
      this.hud?.isTitleScreenActive || this.hud?.isLoadingActive
    ) {
      if (
        this.keys.forward || this.keys.backward || this.keys.left || this.keys.right ||
        this.keys.jump || this.keys.sprint || this.keys.turbo ||
        this.mouseButtons.left || this.mouseButtons.right
      ) {
        this.resetHeldInputs();
      }
    }

    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);
    this.supernovaCooldown = Math.max(0, this.supernovaCooldown - dt);
    this.customHeroPowers?.update(dt);
    this.operatorWeapons?.update(dt);
    this.operatorAbilities?.update(dt);

    const camForward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, UP).normalize();

    if (this.fastTravelState?.active) {
      this.minifigure.updateAnimation(dt, 0, this.runSpeed, true, 0, this.isFlying, false, 0, 0);
      this._updateFastTravelCamera(dt, camRight);
      return;
    }

    this._updateVehiclePrompt();
    if (this._applyRideSeatAndCamera(dt)) return;
    if (this.energyNetSlowTimer > 0) this.energyNetSlowTimer = Math.max(0, this.energyNetSlowTimer - dt);

    if (this.currentVehicle) {
      const prevCarPos = this.position.clone();
      this._updateVehicleDriving(dt, camRight);
      this._updateTurboGhostBikeRiderFX(dt, prevCarPos);
      return;
    }

    this._applyMetroCarStandingTransport();
    const isUsingSolarBeam = this._updateHeroContinuousCombatAndCharges(dt);

    const moveInput = new THREE.Vector3();
    const analog = this.analogMove;
    if (analog && analog.mag > 0) {
      // Analógico do controle: direção livre em 360° relativa à câmera.
      moveInput.addScaledVector(camForward, analog.y).addScaledVector(camRight, analog.x);
    } else {
      if (this.keys.forward) moveInput.add(camForward);
      if (this.keys.backward) moveInput.sub(camForward);
      if (this.keys.right) moveInput.add(camRight);
      if (this.keys.left) moveInput.sub(camRight);
    }
    const hasInput = moveInput.lengthSq() > 0.001;
    if (hasInput) moveInput.normalize();

    if (this.isFlying && (this.minifigure.currentHeroKey === 'solaris' || this.minifigure.currentHeroKey === 'op09')) {
      this._updateHeroFlight3D(dt, camForward, moveInput, hasInput, isUsingSolarBeam);
    } else {
      this.isSupersonic = false;
      this.flightPitch = 0;
      this.flightBank = 0;
      this.lastYaw = this.yaw;

      const shieldChargeVel = this.operatorAbilities?.getChargeOverrideVelocity?.();
      if (shieldChargeVel) {
        this.velocity.x = shieldChargeVel.x;
        this.velocity.z = shieldChargeVel.z;
        this.currentSpeed = Math.hypot(shieldChargeVel.x, shieldChargeVel.z);
      } else if (this.rollImpulseTimer > 0) this._updateTacticalRollImpulse(dt);
      else if (this.vingadorDiveTimer > 0) this._updateVingadorDiveImpulse(dt);
      else if (this.rocketPunchTimer > 0) this._updateTitaRocketPunchImpulse(dt);
      else if (this.grappleState) this._updateGrapplePull(dt, moveInput);
      else if (this.blastJumpTimer > 0 && !this.isGrounded) this._updateBlastJumpAirSteer(dt, moveInput);
      else this._updateFootAndGlideLocomotion(dt, moveInput, hasInput, isUsingSolarBeam);

      if (!this.grappleState) {
        this.velocity.y += this.gravity * dt;
        if (this.minifigure.currentHeroKey === 'voltaico' && !this.isGrounded && this.keys.jump && this.velocity.y < -1.35) {
          this.velocity.y = -1.35;
        }
      }
    }

    this._updateHeroBuffTimersAndTrails(dt);
    const preLandVy = this.velocity.y;
    const wasInAir = !this.isGrounded && !this.isFlying;
    const wasDiveGrappling = Boolean(this.grappleState?.isDiveGrapple);

    this._moveAndCollide(dt, moveInput);
    this._applyPostLandingImpacts(moveInput, preLandVy, wasInAir, wasDiveGrappling);
    this._syncCarriedCarPosition();
    this._clampPlayerWorldBounds(dt);

    this.minifigure.root.position.copy(this.position);
    this.minifigure.updateAnimation(
      dt, Math.hypot(this.velocity.x, this.velocity.z), this.runSpeed, this.isGrounded,
      this.velocity.y, this.isFlying, this.isSupersonic, this.flightPitch, this.flightBank
    );
    this._updateCamera(dt, camRight, isUsingSolarBeam);
  }
}

for (const group of [
  controllerInputAndEventsMethods, heroSelectionAndShortcutsMethods, cameraOrbitAndRigMethods,
  footSwimAndCollisionMethods, heroFlightAndTraversalMethods, heroCombatAndSpecialPowersMethods,
  heroActiveStatesUpdaterMethods, vehicleInteractionAndPromptsMethods,
  groundVehicleDrivingMethods, navalAircraftAndRidesMethods
]) {
  const descriptors = Object.getOwnPropertyDescriptors(group);
  for (const key of Reflect.ownKeys(descriptors)) descriptors[key].enumerable = false;
  Object.defineProperties(ThirdPersonController.prototype, descriptors);
}
