import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';
import { ensureVehicleNightLights } from '../world/DayNightAtmosphereManager.js';
import { CustomHeroPowerRuntime } from '../entities/CustomHeroSystem.js';
import {
  updateVehicleDynamicTuningFX,
  getVehicleCustomFlameHex
} from '../world/StreetCustomGarage.js';

const UP = new THREE.Vector3(0, 1, 0);

function lerpAngle(current, target, t) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

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

    // Parâmetros de locomoção terrestre e voo
    this.walkSpeed = 7.5;
    this.runSpeed = 13.5;
    this.flyHoverSpeed = 28.0;
    this.flyCometSpeed = 85.0;
    this.jumpForce = 11.0;
    this.gravity = -26.0;
    this.currentSpeed = 0;

    // Estado de Voo (Solaris), Supernova Carregável [Q] e Rolamento (Caveira)
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

    // Câmera Over-the-Shoulder estilo Fortnite (Personagem à esquerda, mira livre no centro)
    this.yaw = 0;
    this.pitch = 0.3;
    this.distance = 6.0;
    this.targetDistance = 6.0;
    this.shoulderOffset = 0.95; // Desloca a câmera para a direita, deixando o boneco à esquerda
    this.baseFov = 58;
    this.cameraLookTarget = new THREE.Vector3(0, 1.55, 4);

    // Estado de Input
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      turbo: false,
      jump: false,
      descend: false
    };
    this.mouseButtons = {
      left: false,
      right: false
    };
    this.isPointerLocked = false;
    this.isDraggingMouse = false;
    this.hasEnteredGame = false;

    // Sistema de Direção de Veículos ([E] Entrar / Sair, [Shift] Drift, [Q] Turbo — exclusivos entre si!)
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

    // Transição de Câmera de Satélite Estilo GTA V (Viagem Rápida / Fast Travel)
    this.fastTravelState = null;
    this.satOverlayEl = document.getElementById('satellite-fx-overlay');
    this.satFlashEl = document.getElementById('satellite-flash');
    this.satTelemetryEl = document.getElementById('satellite-telemetry');

    // Cooldowns de armas e poderes
    this.primaryCooldown = 0;
    this.secondaryCooldown = 0;
    this.supernovaCooldown = 0;
    this.cometTrailTimer = 0;

    // Estados exclusivos dos Heróis #3 (Titã Blindado), #4 (Vingador de Chumbo) e #5 (Sombra Escarlate)
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
    this.grappleState = null; // { anchor: Vector3, timer: number }
    this.stealthTimer = 0;
    this.energyNetSlowTimer = 0;
    this._initGrappleCableMesh();
    this.customHeroPowers = new CustomHeroPowerRuntime(this);

    this._bindEvents();
  }

  _initGrappleCableMesh() {
    if (!this.world?.scene) return;

    // Feixe / Cabo do Gancho (Escarlate para o Sombra | Tentáculo Roxo-Simbionte para o Vórtex!)
    const cableGroup = new THREE.Group();
    const coreGeo = new THREE.CylinderGeometry(0.036, 0.036, 1, 8);
    coreGeo.translate(0, 0.5, 0);
    coreGeo.rotateX(Math.PI / 2);
    this.grappleCableCoreMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
    const coreMesh = new THREE.Mesh(coreGeo, this.grappleCableCoreMat);

    const shadowGeo = new THREE.CylinderGeometry(0.072, 0.072, 1, 8);
    shadowGeo.translate(0, 0.5, 0);
    shadowGeo.rotateX(Math.PI / 2);
    this.grappleCableShadowMat = new THREE.MeshBasicMaterial({
      color: 0x090a0d,
      transparent: true,
      opacity: 0.78
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, this.grappleCableShadowMat);
    cableGroup.add(shadowMesh, coreMesh);

    this.grappleCableMesh = cableGroup;
    this.grappleCableMesh.visible = false;
    this.world.scene.add(this.grappleCableMesh);

    // Ponta do Gancho: Kunai Escarlate (Sombra) + Garra/Mandíbula Simbionte Roxa (Vórtex)
    const anchorRoot = new THREE.Group();

    const kunaiGroup = new THREE.Group();
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
    const coreBladeMat = new THREE.MeshBasicMaterial({ color: 0xfecaca });
    const hiltMat = new THREE.MeshBasicMaterial({ color: 0x090a0d });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    const kunaiBlade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.62, 4), bladeMat);
    kunaiBlade.rotation.x = Math.PI / 2;
    kunaiBlade.position.set(0, 0, 0.18);

    const kunaiCore = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.48, 4), coreBladeMat);
    kunaiCore.rotation.x = Math.PI / 2;
    kunaiCore.position.set(0, 0, 0.2);

    const kunaiHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), hiltMat);
    kunaiHilt.rotation.x = Math.PI / 2;
    kunaiHilt.position.set(0, 0, -0.2);

    const kunaiRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.024, 8, 16), goldMat);
    kunaiRing.position.set(0, 0, -0.38);
    kunaiGroup.add(kunaiBlade, kunaiCore, kunaiHilt, kunaiRing);
    this.grappleKunaiGroup = kunaiGroup;

    // Mandíbula Simbionte Roxo-Neon com Presas Brancas (exclusiva do Hook do Vórtex!)
    const symbioteMawGroup = new THREE.Group();
    const purpleMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    const deepPurpleMat = new THREE.MeshBasicMaterial({ color: 0x7e22ce });
    const fangMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    const mawCone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 6), deepPurpleMat);
    mawCone.rotation.x = Math.PI / 2;
    mawCone.position.set(0, 0, 0.18);
    const mawCore = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), purpleMat);
    mawCore.position.set(0, 0, -0.1);
    symbioteMawGroup.add(mawCone, mawCore);

    for (let f = 0; f < 4; f++) {
      const ang = (f / 4) * Math.PI * 2;
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.48, 4), fangMat);
      fang.position.set(Math.cos(ang) * 0.22, Math.sin(ang) * 0.22, 0.34);
      fang.rotation.x = Math.PI / 2 - 0.25;
      symbioteMawGroup.add(fang);
    }
    symbioteMawGroup.visible = false;
    this.grappleSymbioteMawGroup = symbioteMawGroup;

    anchorRoot.add(kunaiGroup, symbioteMawGroup);
    this.grappleAnchorMesh = anchorRoot;
    this.grappleAnchorMesh.visible = false;
    this.world.scene.add(this.grappleAnchorMesh);
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.domElement.addEventListener('mousedown', (e) => {
      if (
        this.hud?.isTitleScreenActive ||
        this.hud?.isPauseMenuOpen ||
        this.hud?.isCreatorOpen ||
        this.hud?.isCustomsOpen ||
        this.hud?.isTikTokRadioOpen
      ) {
        return;
      }
      this.hasEnteredGame = true;
      const promptEl = document.getElementById('pointer-prompt');
      if (promptEl) {
        promptEl.classList.remove('visible');
      }

      if (this.hud?.isHeroWheelOpen) {
        if (e.button === 0) {
          this.hud.setHeroWheelOpen(false, this, true);
        }
        return;
      }

      if (!document.pointerLockElement && this.domElement.requestPointerLock) {
        this.relockPointer();
        if (e.button === 0) {
          this.isDraggingMouse = true;
          return;
        }
      }

      if (e.button === 0) {
        this.isDraggingMouse = true;
        this.mouseButtons.left = true;
        this.minifigure?.stopEmote?.();
        if (this.activeRide) return;
        if (this.currentVehicle) {
          this._fireVehicleWeapon();
        } else {
          this._firePrimaryAction();
        }
      } else if (e.button === 2) {
        this.mouseButtons.right = true;
        this.minifigure?.stopEmote?.();
        if (this.activeRide) return;
        const hero = this.minifigure.currentHeroKey;
        if (this.currentVehicle) {
          if (hero === 'turbo') {
            this._summonAndMountTurboGhostBike();
          }
        } else {
          if (hero === 'caveira') {
            this._throwCaveiraGrenade();
          } else if (hero === 'tita') {
            this._toggleTitaCarGrabOrThrow();
          } else if (hero === 'vingador') {
            this._cycleVingadorWeapon();
          } else if (hero === 'sombra') {
            this._triggerSombraGrapple();
          } else if (hero === 'turbo') {
            this._summonAndMountTurboGhostBike();
          } else if (hero === 'voltaico') {
            this._triggerVoltaicoLightningBlink();
          } else if (hero === 'vortex') {
            this._triggerVortexAbyssalLasso();
          } else if (hero === 'op09') {
            this.customHeroPowers?.triggerMobilityKey();
          }
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isDraggingMouse = false;
        this.mouseButtons.left = false;
      } else if (e.button === 2) {
        this.mouseButtons.right = false;
      }
    });

    window.addEventListener('blur', () => {
      this.resetHeldInputs();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.resetHeldInputs();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
      if (!this.isPointerLocked) {
        this.resetHeldInputs();
      }
      if (this.isPointerLocked) {
        this.hasEnteredGame = true;
      } else if (
        this.hasEnteredGame &&
        !this.hud?.isTitleScreenActive &&
        !this.hud?.isPauseMenuOpen &&
        !this.hud?.isFullMapOpen &&
        !this.hud?.isDossierOpen &&
        !this.hud?.isHeroWheelOpen &&
        !this.hud?.isCreatorOpen &&
        !this.hud?.isCustomsOpen &&
        !this.hud?.isTikTokRadioOpen &&
        !this.fastTravelState?.active
      ) {
        // Quando o jogador aperta [ESC] durante o jogo e o navegador solta o PointerLock, abre o Menu de Pausa & Opções!
        this.hud?.setPauseMenuOpen(true, this);
      }
      const promptEl = document.getElementById('pointer-prompt');
      if (promptEl) {
        const shouldShowPrompt =
          !this.isPointerLocked &&
          !this.hasEnteredGame &&
          !this.hud?.isTitleScreenActive &&
          !this.hud?.isPauseMenuOpen &&
          !this.hud?.isFullMapOpen &&
          !this.hud?.isDossierOpen &&
          !this.hud?.isHeroWheelOpen &&
          !this.hud?.isCreatorOpen &&
          !this.hud?.isCustomsOpen &&
          !this.hud?.isTikTokRadioOpen;
        promptEl.classList.toggle('visible', shouldShowPrompt);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (
        this.hud?.isTitleScreenActive ||
        this.hud?.isPauseMenuOpen ||
        this.hud?.isFullMapOpen ||
        this.hud?.isDossierOpen ||
        this.hud?.isCreatorOpen ||
        this.hud?.isCustomsOpen ||
        this.hud?.isTikTokRadioOpen ||
        this.fastTravelState?.active
      ) {
        return;
      }
      if (this.hud?.isHeroWheelOpen) {
        if (Math.hypot(e.movementX, e.movementY) > 10) {
          this.hud.setHeroWheelDirection(e.movementX, e.movementY);
        }
        return;
      }
      if (!this.isPointerLocked && !this.isDraggingMouse) return;
      const sensitivity = 0.0032;
      this.yaw -= e.movementX * sensitivity;
      // Câmera 100% livre na vertical: de -85° (-1.48 rad, olhando totalmente para o céu) a +85° (+1.48 rad, olhando pro chão)
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + e.movementY * sensitivity,
        -1.48,
        1.48
      );
    });

    window.addEventListener(
      'wheel',
      (e) => {
        // O scroll no Mapa [M], Criador de Personagens, LEGO Customs, Rádio TikTok ou lista lateral NUNCA deve alterar o zoom da câmera!
        if (
          this.hud?.isFullMapOpen ||
          this.hud?.isCreatorOpen ||
          this.hud?.isCustomsOpen ||
          this.hud?.isTikTokRadioOpen ||
          this.fastTravelState?.active
        ) {
          return;
        }
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('#fullmap-modal')) {
          return;
        }
        // Quando está com o Vingador de Chumbo a pé, o Scroll do Mouse roda as armas igual ao CS!
        if (
          this.minifigure?.currentHeroKey === 'vingador' &&
          !this.currentVehicle &&
          !this.hud?.isDossierOpen &&
          !this.hud?.isHeroWheelOpen
        ) {
          this._cycleVingadorWeapon(e.deltaY > 0 ? 1 : -1);
          return;
        }
        this.targetDistance = THREE.MathUtils.clamp(
          this.targetDistance + e.deltaY * 0.005,
          3.2,
          12.0
        );
      },
      { passive: true }
    );
  }

  /**
   * Limpa imediatamente todas as teclas de locomoção e botões do mouse segurados
   * (impede o bug de continuar andando sozinho ao abrir [P], [ESC], [M], [H] ou Salvar e Sair!)
   */
  resetHeldInputs() {
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    this.keys.sprint = false;
    this.keys.turbo = false;
    this.keys.jump = false;
    this.keys.descend = false;
    this.mouseButtons.left = false;
    this.mouseButtons.right = false;
    this.isDraggingMouse = false;
    this.isDrifting = false;
    this.isTurboActive = false;
    this.turboOverdriveActive = false;
    if (this.titaJumpCharging) {
      this.titaJumpCharging = false;
      this.titaJumpChargeTime = 0;
    }
    if (this.supernovaCharging) {
      this.supernovaCharging = false;
      this.supernovaChargeTime = 0;
      this.destructibles?.updateSupernovaChargeVisual?.(false, this.position);
    }
    if (this.minifigure) {
      this.minifigure.isBeaming = false;
      this.minifigure.titaJumpChargeRatio = 0;
    }
    this.destructibles?.updateSolarBeam?.(false);
  }

  /**
   * Retrava a mira automaticamente ao fechar o Mapa [M] ou dar Viagem Rápida, sem exibir aviso na tela
   */
  relockPointer() {
    this.hasEnteredGame = true;
    const promptEl = document.getElementById('pointer-prompt');
    if (promptEl) {
      promptEl.classList.remove('visible');
    }
    if (!document.pointerLockElement && this.domElement?.requestPointerLock) {
      try {
        const res = this.domElement.requestPointerLock();
        if (res && typeof res.catch === 'function') {
          res.catch(() => { });
        }
      } catch (_) {
        // Ignora erro caso chamado em ambiente de teste sem gesto de usuário
      }
    }
  }

  /**
   * Troca instantaneamente entre os 5 Heróis Jogáveis (Caveira, Solaris, Titã Blindado, Vingador de Chumbo e Sombra Escarlate)
   */
  switchToHero(heroKey) {
    if (this.minifigure.currentHeroKey === heroKey && heroKey !== 'op09') return;

    // Limpa estados especiais do herói anterior
    if (this.grabbedCar) {
      this._releaseGrabbedCarOnGround();
    }
    this._stopGrapple();
    this.minifigure?.stopEmote?.();
    this.stealthTimer = 0;
    this.vingadorDiveTimer = 0;
    this.vingadorFurorTimer = 0;
    this.turboOverdriveTimer = 0;
    this.turboOverdriveActive = false;
    this._lastLightWallPos = null;
    this.titaSuperJumpActive = false;
    this.titaJumpCharging = false;
    this.titaJumpChargeTime = 0;
    if (this.minifigure) {
      this.minifigure.titaJumpChargeRatio = 0;
      this.minifigure.isDashing = false;
      this.minifigure.isDiveSliding = false;
    }

    const preset = this.minifigure.setHero(heroKey);
    this.customHeroPowers?.onHeroSwitched(heroKey);

    if ((this.currentVehicle || this.activeRide) && this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle, Boolean(this.activeRide));
    }

    // Se trocou para qualquer herói terrestre no meio do voo, desativa voo e entra em queda livre imediata!
    if (heroKey !== 'solaris' && this.isFlying) {
      this.isFlying = false;
      this.isSupersonic = false;
      this.velocity.y = Math.min(0, this.velocity.y);
    }
    if (this.supernovaCharging) {
      this.supernovaCharging = false;
      this.supernovaChargeTime = 0;
    }
    if (this.destructibles?.updateSupernovaChargeVisual) {
      this.destructibles.updateSupernovaChargeVisual(false, this.position);
    }

    const swapColors = {
      caveira: 0xfacc15,
      solaris: 0xf97316,
      tita: 0xef4444,
      vingador: 0x94a3b8,
      sombra: 0xff1e42,
      turbo: 0x22d3ee,
      voltaico: 0x38bdf8,
      vortex: 0xa855f7,
      op09: 0x00f0ff
    };

    if (this.destructibles) {
      this.destructibles.updateSolarBeam(false);
      this.destructibles.spawnHeroSwapEffect(
        this.position,
        swapColors[heroKey] || 0xfacc15
      );
    }

    if (this.hud) {
      this.hud.setCharacterPortrait(preset.key, preset.name, preset.subtitle);
      if (this.hud.updateVingadorWeaponHud) {
        this.hud.updateVingadorWeaponHud(this.minifigure.vingadorWeapon || 'dual_smg', false);
      }
    }
  }

  toggleHero() {
    const heroOrder = ['caveira', 'solaris', 'tita', 'vingador', 'sombra', 'turbo', 'voltaico', 'vortex', 'op09'];
    const idx = heroOrder.indexOf(this.minifigure.currentHeroKey);
    const next = heroOrder[(idx + 1) % heroOrder.length];
    this.switchToHero(next);
  }

  _alignCharacterToCrosshair() {
    const aimDir = new THREE.Vector3();
    this.camera.getWorldDirection(aimDir);
    this.facingAngle = Math.atan2(aimDir.x, aimDir.z);
    this.minifigure.root.rotation.y = this.facingAngle;
    return aimDir;
  }

  /**
   * Clique Esquerdo: Dispara a arma/poder principal de cada um dos 5 Heróis ou Arma Veicular
   */
  _firePrimaryAction() {
    if (this.currentVehicle) {
      this._fireVehicleWeapon();
      return;
    }
    if (this.primaryCooldown > 0) return;

    const hero = this.minifigure.currentHeroKey;

    // Se o Titã Blindado estiver segurando um carro acima da cabeça, Clique Esquerdo também arremessa o carro!
    if (hero === 'tita' && this.grabbedCar) {
      this._toggleTitaCarGrabOrThrow();
      return;
    }

    this._alignCharacterToCrosshair();

    if (!this.destructibles) return;
    const aimData = this.destructibles.getAimTargetPoint(this.camera, 85);
    const rightVec = new THREE.Vector3(
      -Math.cos(this.facingAngle),
      0,
      Math.sin(this.facingAngle)
    );

    if (hero === 'caveira') {
      this.minifigure.triggerShoot();
      this.primaryCooldown = 0.11;
      const muzzlePos = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 0.95 + rightVec.x * 0.45,
        this.position.y + 1.28,
        this.position.z + Math.cos(this.facingAngle) * 0.95 + rightVec.z * 0.45
      );
      this.destructibles.spawnRifleBullet(muzzlePos, aimData.point);
    } else if (hero === 'solaris') {
      this.minifigure.triggerShoot();
      this.primaryCooldown = 0.28;
      const handPos = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 0.85,
        this.position.y + 1.32,
        this.position.z + Math.cos(this.facingAngle) * 0.85
      );
      this.destructibles.spawnFireball(handPos, aimData.point);
    } else if (hero === 'tita') {
      this.minifigure.triggerShoot();
      this.primaryCooldown = 0.036; // Minigun Vulcan 6 Canos de Cadência Insana (~28 tiros/seg)!
      const muzzlePos = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 1.55 + rightVec.x * 0.86,
        this.position.y + 1.98,
        this.position.z + Math.cos(this.facingAngle) * 1.55 + rightVec.z * 0.86
      );
      this.destructibles.spawnTitaRotaryBullet(muzzlePos, aimData.point);
    } else if (hero === 'vingador') {
      const furorMult = this.vingadorFurorTimer > 0 ? 0.4 : 1.0; // +60% Cadência de Tiro durante o Modo Furor [Q]!
      const wKey = this.minifigure.vingadorWeapon || 'dual_smg';
      if (wKey === 'dual_smg') {
        this.primaryCooldown = 0.065 * furorMult;
        const recoilSide = this.minifigure.triggerVingadorDualRecoil
          ? this.minifigure.triggerVingadorDualRecoil()
          : 0;
        const leftMuzzle = new THREE.Vector3(
          this.position.x + Math.sin(this.facingAngle) * 0.98 - rightVec.x * 0.48,
          this.position.y + 1.28,
          this.position.z + Math.cos(this.facingAngle) * 0.98 - rightVec.z * 0.48
        );
        const rightMuzzle = new THREE.Vector3(
          this.position.x + Math.sin(this.facingAngle) * 0.98 + rightVec.x * 0.48,
          this.position.y + 1.28,
          this.position.z + Math.cos(this.facingAngle) * 0.98 + rightVec.z * 0.48
        );
        this.destructibles.spawnDualSmgBullets(leftMuzzle, rightMuzzle, aimData.point, recoilSide);
      } else if (wKey === 'shotgun') {
        this.minifigure.triggerShoot();
        this.primaryCooldown = 0.26 * furorMult;
        const muzzlePos = new THREE.Vector3(
          this.position.x + Math.sin(this.facingAngle) * 1.12 + rightVec.x * 0.45,
          this.position.y + 1.28,
          this.position.z + Math.cos(this.facingAngle) * 1.12 + rightVec.z * 0.45
        );
        this.destructibles.spawnShotgunBlast(muzzlePos, aimData.point);

        // MOBILIDADE COM A DOZE (Shotgun Force-Jump):
        // Se atirar com a Escopeta no ar ou olhando para baixo, aplica recuo oposto à mira (16.5 m/s) para Double/Triple Jumps!
        const aimDir = new THREE.Vector3();
        this.camera.getWorldDirection(aimDir);
        if (!this.isGrounded || aimDir.y < -0.18) {
          const recoilDir = aimDir.clone().negate().normalize();
          this.isGrounded = false;
          this.position.y += 0.24;
          this.velocity.y = Math.max(this.velocity.y * 0.35 + recoilDir.y * 16.5, 13.5);
          this.blastVelocity.set(
            this.velocity.x * 0.55 + recoilDir.x * 16.5,
            0,
            this.velocity.z * 0.55 + recoilDir.z * 16.5
          );
          this.blastJumpTimer = Math.max(this.blastJumpTimer, 0.52);
          this.velocity.x = this.blastVelocity.x;
          this.velocity.z = this.blastVelocity.z;
        }
      } else {
        this.minifigure.triggerShoot();
        this.primaryCooldown = 0.72 * furorMult;
        const muzzlePos = new THREE.Vector3(
          this.position.x + Math.sin(this.facingAngle) * 1.25 + rightVec.x * 0.5,
          this.position.y + 1.38,
          this.position.z + Math.cos(this.facingAngle) * 1.25 + rightVec.z * 0.5
        );
        this.destructibles.spawnRpgRocket(muzzlePos, aimData.point, (blastPos) => {
          this.applyRocketJumpImpulse(blastPos);
        });
      }
    } else if (hero === 'sombra') {
      // Combo Místico de 3 Cortes da Lua de Sangue (Projétil Crescente de 3.6m a 56 m/s)
      this.primaryCooldown = 0.24;
      this.minifigure.triggerPunch();
      this.destructibles.performKatanaSlash(this.position, this.facingAngle, aimData.point);
    } else if (hero === 'turbo') {
      // Açoite de Correntes Giratórias de Plasma Ciano (Arco + Projétil Giratório)
      this.primaryCooldown = 0.24;
      this.minifigure.triggerPunch();
      this.destructibles.performTurboChainWhip(this.position, this.facingAngle, aimData.point);
    } else if (hero === 'voltaico') {
      // Corrente de Raios (Chain Lightning) que salta entre até 6 alvos e carrega geradores!
      this.primaryCooldown = 0.23;
      this.minifigure.triggerShoot();
      const staffTip = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 1.15,
        this.position.y + 1.38,
        this.position.z + Math.cos(this.facingAngle) * 1.15
      );
      this.destructibles.fireChainLightning(staffTip, aimData.point);
    } else if (hero === 'vortex') {
      // Combo de 3 Golpes de Tentáculos Simbiontes + Onda Voraz de Biomassa (quebra Paredes Rachadas e LEGO Prateado!)
      this.primaryCooldown = 0.25;
      this.minifigure.triggerPunch();
      this.destructibles.performVortexTentacleStrike(
        this.position,
        this.facingAngle,
        this.minifigure.isVortexMonster,
        aimData.point
      );
    } else if (hero === 'op09') {
      this.customHeroPowers?.firePrimary(aimData.point);
    }
  }

  /**
   * Dispara armas acopladas aos veículos (Moto Fantasma 740 KM/H do Turbo, Moto 600cc CV, Picape Artilhada CV, Hover-APC A.R.E.S. e Tanque Titan-M1)
   */
  _fireVehicleWeapon() {
    if (this.primaryCooldown > 0 || !this.currentVehicle || !this.destructibles) return;
    const carObj = this.currentVehicle;
    const spec = carObj.mesh.userData?.vehicleSpec;

    if (spec?.isGhostBike) {
      this.primaryCooldown = 0.22;
      this.minifigure.triggerPunch();
      const aimData = this.destructibles.getAimTargetPoint(this.camera, 95);
      this.destructibles.performTurboChainWhip(carObj.mesh.position, this.vehicleHeading, aimData.point);
      return;
    }

    if (!spec || !spec.weapon) return;

    const aimData = this.destructibles.getAimTargetPoint(this.camera, 110);
    const carPos = carObj.mesh.position;
    const aimDir = aimData.point.clone().sub(carPos).normalize();

    if (spec.weapon === 'smg' || spec.weapon === 'machinegun') {
      this.primaryCooldown = spec.weapon === 'machinegun' ? 0.08 : 0.095;
      const muzzleY = spec.weapon === 'machinegun' ? 2.15 : 1.15;
      const muzzlePos = new THREE.Vector3(
        carPos.x + aimDir.x * 1.4,
        carPos.y + muzzleY,
        carPos.z + aimDir.z * 1.4
      );
      this.destructibles.spawnVehicleProjectile(muzzlePos, aimData.point, spec.weapon);
    } else if (spec.weapon === 'plasma_laser') {
      this.primaryCooldown = 0.16;
      const forwardDist = spec.isColossalShip ? 82.0 : 1.6;
      const muzzleHeight = spec.isColossalShip ? 12.6 : 2.35;
      const muzzlePos = new THREE.Vector3(
        carPos.x + (spec.isColossalShip ? Math.sin(this.vehicleHeading) * forwardDist : aimDir.x * forwardDist),
        carPos.y + muzzleHeight,
        carPos.z + (spec.isColossalShip ? Math.cos(this.vehicleHeading) * forwardDist : aimDir.z * forwardDist)
      );
      this.destructibles.spawnVehicleProjectile(muzzlePos, aimData.point, spec.weapon);
    } else if (spec.weapon === 'tank_cannon') {
      this.primaryCooldown = 0.6;
      const muzzlePos = new THREE.Vector3(
        carPos.x + aimDir.x * 3.1,
        carPos.y + 2.2,
        carPos.z + aimDir.z * 3.1
      );
      this.destructibles.spawnVehicleProjectile(muzzlePos, aimData.point, spec.weapon);
    }
  }

  /**
   * Arremesso de Carga Explosiva / Impulso estilo Satchel da Raze (Clique Direito):
   * - Se já houver uma carga ativa no ar/chão, apertar Clique Direito detona manualmente na hora!
   * - Cooldown curtíssimo (0.22s) permitindo jogar uma 2ª bomba no ar (Double Satchel)!
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
    this.secondaryCooldown = 0.22; // Cooldown ultrarrápido para Double Satchel no ar!

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
  }

  /**
   * Super-Impulso 4x Maior estilo Satchel da Raze do Valorant quando a carga explode perto do Comandante Caveira!
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

    // Impulso Vertical 4x maior (e soma +28.0 no Double Satchel aéreo para voar por cima de prédios altos!)
    if (isDoubleSatchel) {
      this.velocity.y = Math.min(62.0, Math.max(this.velocity.y, 24.0) + 28.0 * power);
    } else {
      this.velocity.y = 44.0 * power;
    }
    this.isGrounded = false;

    // Impulso Horizontal 4x maior (64.0 * power) combinando repulsão da bomba + direção da mira
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
  }

  /**
   * Rolamento Tático do Comandante Caveira (Q / Ctrl ou pouso de queda alta)
   */
  _triggerTacticalRoll(customDir = null) {
    if (!this.minifigure.triggerTacticalRoll()) return;
    soundFX.playTacticalRoll();
    this.rollImpulseTimer = 0.38;

    if (customDir && customDir.lengthSq() > 0.01) {
      this.rollDir.copy(customDir).normalize();
    } else {
      this.rollDir.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle)).normalize();
    }
    this.facingAngle = Math.atan2(this.rollDir.x, this.rollDir.z);
    this.minifigure.root.rotation.y = this.facingAngle;
  }

  /**
   * Ativa o Voo Solar do Solaris descolando imediatamente de qualquer calçada, prédio ou morro!
   */
  _activateSolarisFlight() {
    this.isFlying = true;
    this.isGrounded = false;
    this.position.y += 0.9;
    this.velocity.y = 14.0;
    soundFX.playTacticalRoll();
  }

  /**
   * Inicia o carregamento do Poder [Q] (Supernova Carregável do Solaris):
   * - Tap rápido (< 0.25s): Explosão Solar Rápida (Raio 12m, Dano 110)
   * - Segurar [Q] (até 2.0s = 100%): Medidor 3D crescente embaixo dele até Explosão Colossal de 52m e Dano 350!
   */
  _startSolarisSupernovaCharge() {
    if (this.supernovaCooldown > 0 || this.supernovaCharging) return;
    this.supernovaCharging = true;
    this.supernovaChargeTime = 0;
    this.supernovaChargeSoundTimer = 0;
  }

  _releaseSolarisSupernovaCharge() {
    if (!this.supernovaCharging) return;
    const heldTime = this.supernovaChargeTime;
    this.supernovaCharging = false;
    this.supernovaChargeTime = 0;

    // Se apertou e soltou rápido (< 0.25s), dispara Supernova Rápida (chargeRatio = 0 -> 12m, 110 dano)
    const chargeRatio = heldTime < 0.25
      ? 0
      : THREE.MathUtils.clamp(heldTime / this.supernovaMaxChargeTime, 0, 1);

    this._triggerSolarisSupernova(chargeRatio);
  }

  /**
   * Explosão Supernova em área do Solaris (Q)
   */
  _triggerSolarisSupernova(chargeRatio = 0) {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 0.85 + chargeRatio * 0.55;
    this.minifigure.triggerPunch();
    this.cameraShakeTimer = 0.38 + chargeRatio * 0.48;
    if (this.destructibles) {
      const groundY = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
      this.destructibles.triggerSupernova(this.position, chargeRatio, groundY);
    }
  }

  /**
   * HERÓI #3 (Titã Blindado): Investida / Dash Demolidor [Mouse 2 / V] SEM COOLDOWN!
   * - Pode emendar um Dash atrás do outro no chão ou no ar!
   * - Aciona as megaturbinas traseiras (punchBoost = 44.0) e destrói carros e Paredes Rachadas pelo caminho!
   */
  _triggerTitaRocketPunch() {
    this.secondaryCooldown = 0; // ZERO Cooldown no Dash do Titã!
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
  }

  /**
   * HERÓI #3 (Titã Blindado): Dispara o Super-Pulo Hidráulico ao soltar [Espaço]!
   * - Tap rápido (< 0.16s): Pulo normal rápido (velocity.y = 14.5)
   * - Segurar [Espaço] (até limite máximo de 1.1s = 100%): Super-Pulo Hidráulico de até velocity.y = 54.0!
   */
  _releaseTitaSuperJumpCharge() {
    if (!this.titaJumpCharging) return;
    const heldTime = this.titaJumpChargeTime;
    this.titaJumpCharging = false;
    this.titaJumpChargeTime = 0;
    if (this.minifigure) {
      this.minifigure.titaJumpChargeRatio = 0;
    }
    if (this.destructibles?.updateSupernovaChargeVisual) {
      this.destructibles.updateSupernovaChargeVisual(false, this.position);
    }

    if (!this.isGrounded) return;

    if (heldTime < 0.16) {
      // Tap rápido no Espaço: Pulo normal ágil
      this.velocity.y = 14.5;
      this.titaSuperJumpActive = false;
      this.isGrounded = false;
      return;
    }

    const chargeRatio = THREE.MathUtils.clamp(heldTime / this.titaJumpMaxChargeTime, 0, 1);
    this.velocity.y = THREE.MathUtils.lerp(18.0, 54.0, chargeRatio);
    const boostSpeed = 18.0 * chargeRatio;
    this.velocity.x += Math.sin(this.facingAngle) * boostSpeed;
    this.velocity.z += Math.cos(this.facingAngle) * boostSpeed;
    this.titaSuperJumpActive = true;
    this.isGrounded = false;
    this.cameraShakeTimer = 0.22 + chargeRatio * 0.25;
    soundFX.playExplosion(0.9 + chargeRatio * 0.6);
  }

  /**
   * HERÓI #3 (Titã Blindado): Pisada Sísmica no Chão [Q] (Raio 22m, Dano 150 + Placas de Asfalto 3D!)
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
  }

  /**
   * HERÓI #3 (Titã Blindado): Agarrar QUALQUER Veículo acima da cabeça ou Arremessar [Clique Direito / F / G]
   * Suporta todos os veículos do jogo: Carros, Motos, Caminhões-Carreta, Tanques, Helicópteros, Aviões, Barcos, Lanchas e Navios!
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

    // Busca qualquer veículo próximo (carros, caminhões, tanques, helicópteros, aviões, barcos, navios)
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
      // Se não houver veículo próximo, executa o Soco Foguete!
      this._triggerTitaRocketPunch();
    }
  }

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
  }

  /**
   * HERÓI #4 (Vingador de Chumbo): Roda entre as 3 Armas 3D ([R], [Clique Direito] ou Scroll do Mouse)
   */
  _cycleVingadorWeapon(step = 1) {
    const order = ['dual_smg', 'shotgun', 'rpg'];
    const labels = {
      dual_smg: 'ARMA 1: CASTIGADORAS GÊMEAS (.50 EXPLOSIVA) • [R] TROCAR • [Q] FUROR',
      shotgun: 'ARMA 2: DOZE "JUIZ FINAL" (18 BAGOS + FORCE-JUMP) • [R] TROCAR • [Q] FUROR',
      rpg: 'ARMA 3: BAZUCA "ANIQUILADORA" (ROCKET JUMP 4X) • [R] TROCAR • [Q] FUROR'
    };
    const cur = this.minifigure.vingadorWeapon || 'dual_smg';
    const curIdx = Math.max(0, order.indexOf(cur));
    const dir = step < 0 ? -1 : 1;
    const next = order[(curIdx + dir + order.length) % order.length];
    this.minifigure.setVingadorWeapon(next);
    soundFX.playHeroSwap();
    if (this.hud) {
      this.hud.setCharacterPortrait('vingador', 'VINGADOR DE CHUMBO', labels[next]);
      if (this.hud.updateVingadorWeaponHud) {
        this.hud.updateVingadorWeaponHud(next, this.vingadorFurorTimer > 0);
      }
    }
  }

  /**
   * HERÓI #4 (Vingador de Chumbo): Super Impulso de ROCKET JUMP (4x) na explosão da Bazuca "Aniquiladora"!
   * Se o foguete explodir a até 18m do Vingador, catapulta ele pelos ares (sem tomar dano!)
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

    // 4X Impulso de Rocket Jump: velocidade vertical de 26 a 34 m/s + impulso horizontal de 32 a 42 m/s!
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
  }

  /**
   * HERÓI #4 (Vingador de Chumbo): Habilidade [Q] — "INVESTIDA IMPLACÁVEL + MODO FUROR DO JUSTICEIRO"
   * - Super-Dash / Mergulho Tático Propulsado a 50 m/s por 0.35s exatamente na direção da câmera (no chão ou voando em diagonal estilo Max Payne!)
   * - Dispara Onda de Choque de Calibre 12 em 360° nos pés na largada
   * - Ativa "Furor do Justiceiro" por 4.0s (Velocidade de corrida 32.0 m/s + 60% Cadência de Tiro nas 3 armas!)
   */
  _triggerVingadorThrusterDive() {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 2.2;

    const aimDir = this._alignCharacterToCrosshair();
    this.vingadorDiveDir.copy(aimDir).normalize();
    this.vingadorDiveTimer = 0.35;
    this.minifigure.isDiveSliding = true;

    // Se olhar para cima/diagonal ou estiver no ar, lança o Vingador voando em salto cinematográfico!
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

    // Ativa o Buff de 4.0 segundos de "Furor do Justiceiro"!
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
  }

  /**
   * HERÓI #5 (Sombra Escarlate): Gancho Magnético 360° [Clique Direito / F] (Estilingue Zip-Dash & Dive-Grapple para o Chão!)
   * - Mira 100% livre em 360°: joga para cima, para frente ou DIRETO PARA BAIXO NO CHÃO!
   * - Se estiver no ar e olhar para baixo (aimDir.y < -0.12), faz um Mergulho Relâmpago (Dive-Grapple a 78 m/s) para o chão!
   * - Nunca prende no ar: ao terminar o puxão curto (0.42s a 68 m/s) ou soltar, transfere a velocidade para um voo livre em arco!
   */
  _triggerSombraGrapple() {
    if (this.grappleState) {
      this._stopGrapple(true);
      return;
    }

    const aimDir = this._alignCharacterToCrosshair();
    const rayOrigin = this.camera.position.clone();
    const maxGrappleDist = 115.0;
    let bestT = maxGrappleDist;
    let bestAnchor = null;

    // 1. Interseção 3D exata (Ray-AABB Slab) usando índice espacial 2D ao longo do raio!
    if (this.world?.colliders) {
      const endRayX = rayOrigin.x + aimDir.x * maxGrappleDist;
      const endRayZ = rayOrigin.z + aimDir.z * maxGrappleDist;
      const grappleCols = this.world.getCollidersAlongRay2D
        ? this.world.getCollidersAlongRay2D(rayOrigin.x, rayOrigin.z, endRayX, endRayZ, 2.0)
        : this.world.colliders;
      for (const col of grappleCols) {
        if (col.disabled) continue;
        const colMinY = col.minY ?? 0;
        let tMin = 0.0;
        let tMax = bestT;

        const axes = [
          [rayOrigin.x, aimDir.x, col.minX, col.maxX],
          [rayOrigin.y, aimDir.y, colMinY, col.maxY],
          [rayOrigin.z, aimDir.z, col.minZ, col.maxZ]
        ];
        let hitBox = true;
        for (const [orig, dir, minB, maxB] of axes) {
          if (Math.abs(dir) < 1e-6) {
            if (orig < minB || orig > maxB) {
              hitBox = false;
              break;
            }
          } else {
            let t1 = (minB - orig) / dir;
            let t2 = (maxB - orig) / dir;
            if (t1 > t2) {
              const tmp = t1;
              t1 = t2;
              t2 = tmp;
            }
            tMin = Math.max(tMin, t1);
            tMax = Math.min(tMax, t2);
            if (tMin > tMax) {
              hitBox = false;
              break;
            }
          }
        }

        if (hitBox && tMin >= 4.0 && tMin < bestT) {
          bestT = tMin;
          bestAnchor = rayOrigin.clone().addScaledVector(aimDir, tMin);
        }
      }
    }

    // 2. Interseção com o chão / rua / morro quando olha para baixo (permite Dive-Grapple direto para o chão!)
    if (aimDir.y < -0.02) {
      for (let d = 4.0; d <= bestT; d += 2.0) {
        const px = rayOrigin.x + aimDir.x * d;
        const py = rayOrigin.y + aimDir.y * d;
        const pz = rayOrigin.z + aimDir.z * d;
        const terrainY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(px, pz) : 0;
        if (py <= terrainY + 0.25) {
          bestT = d;
          bestAnchor = new THREE.Vector3(px, terrainY + 0.35, pz);
          break;
        }
      }
    }

    // 3. Fallback na direção EXATA do vetor 3D da câmera (respeita 100% o ângulo mirado sem jogar para cima à força!)
    if (!bestAnchor) {
      const reach = 64.0;
      const fx = this.position.x + aimDir.x * reach;
      const fz = this.position.z + aimDir.z * reach;
      const floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fx, fz) : 0;
      const fy = Math.max(floorY + 0.4, this.position.y + 1.4 + aimDir.y * reach);
      bestAnchor = new THREE.Vector3(fx, fy, fz);
    }

    const isDiveGrapple = !this.isGrounded && aimDir.y < -0.12 && bestAnchor.y < this.position.y - 1.2;

    this.grappleState = {
      anchor: bestAnchor,
      timer: isDiveGrapple ? 0.65 : 0.42,
      pullSpeed: isDiveGrapple ? 78.0 : 68.0,
      isDiveGrapple
    };
    this.isGrounded = false;
    if (!isDiveGrapple && this.position.y <= bestAnchor.y) {
      this.velocity.y = Math.max(this.velocity.y, 9.5);
    }
    this.minifigure.isGrappling = true;
    soundFX.playTacticalRoll();
    soundFX.playLaserShot();
  }

  _stopGrapple(transferMomentum = false) {
    const prevGrapple = this.grappleState;
    this.grappleState = null;
    if (this.minifigure) {
      this.minifigure.isGrappling = false;
    }
    if (this.grappleCableMesh) this.grappleCableMesh.visible = false;
    if (this.grappleAnchorMesh) this.grappleAnchorMesh.visible = false;

    // Estilingue Ninja (Zip-Dash): transfere a velocidade do puxão para a inércia livre no ar sem frear o boneco!
    if (transferMomentum && prevGrapple && !prevGrapple.isDiveGrapple) {
      this.blastVelocity.set(this.velocity.x * 0.92, 0, this.velocity.z * 0.92);
      const horizMag = Math.hypot(this.blastVelocity.x, this.blastVelocity.z);
      if (horizMag > 66.0) {
        this.blastVelocity.multiplyScalar(66.0 / horizMag);
      }
      this.blastJumpTimer = 0.85;
      this.velocity.y = Math.max(this.velocity.y + 8.5, 16.0);
    }
  }

  /**
   * HERÓI #5 (Sombra Escarlate): [Q] = Rolamento Acrobático Sombrio + Bomba de Fumaça + Invisibilidade!
   */
  _triggerSombraSmokeBomb() {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 0.95;

    // Calcula direção de movimento atual ou usa a direção da mira para o Dash/Rolamento Sombrio
    const camForward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, UP).normalize();
    const rollInput = new THREE.Vector3();
    if (this.keys.forward) rollInput.add(camForward);
    if (this.keys.backward) rollInput.sub(camForward);
    if (this.keys.right) rollInput.add(camRight);
    if (this.keys.left) rollInput.sub(camRight);
    if (rollInput.lengthSq() < 0.001) {
      this._alignCharacterToCrosshair();
      rollInput.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
    }

    // Inicia imediatamente o Rolamento Acrobático Ninja e já mergulha ficando Invisível!
    this._triggerTacticalRoll(rollInput);
    this.stealthTimer = 7.0;
    this.minifigure.setStealthVisual(true);
    if (this.destructibles) {
      this.destructibles.spawnSmokeBombCloud(this.position);
    }
    if (this.hud) {
      this.hud.setCharacterPortrait(
        'sombra',
        'SOMBRA ESCARLATE [FURTIVO]',
        'PASSO FANTASMA INVISÍVEL ATIVO (IGNORA LASERS DO BANCO!)'
      );
    }
  }

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
  }

  /**
   * HERÓI #6 (Turbo Fantasma): Invoca instantaneamente sua Moto Energética Ciano (740+ KM/H) [Mouse 2 / F / G]
   * e já monta nela em alta velocidade deixando a Muralha de Luz Infinita!
   */
  _summonAndMountTurboGhostBike() {
    if (!this.destructibles) return;
    if (this.currentVehicle) {
      this.exitVehicle();
      return;
    }
    this._alignCharacterToCrosshair();
    const bikeObj = this.destructibles.summonTurboEnergyBike(this.position, this.facingAngle);
    if (bikeObj) {
      this.enterVehicle(bikeObj);
      this.vehicleSpeed = 0; // Spawna parada e sem turbo! Você acelera no [W] ou segura [Q] pro Turbo!
      this.turboOverdriveActive = false;
      this.isTurboActive = false;
      this.keys.turbo = false;
      this._lastLightWallPos = this.position.clone();
      if (this.hud) {
        this.hud.setCharacterPortrait(
          'turbo',
          'TURBO FANTASMA [MOTO FANTASMA]',
          'MOTO FANTASMA • [W] ACELERAR • [S / ESPAÇO] FREIO FORTE • SEGURE [Q] TURBO 740 KM/H'
        );
      }
    }
  }

  /**
   * HERÓI #6 (Turbo Fantasma): Modo Overdrive Enquanto Segura [Q] (Estilo Turbo de Carro Sem Limite!)
   * Enquanto o jogador segurar [Q], corre em Overdrive e solta a Muralha de Luz sem parar; ao soltar [Q], desliga!
   */
  _triggerTurboOverdrive(active = true) {
    this.turboOverdriveActive = Boolean(active);
    this.turboOverdriveTimer = this.turboOverdriveActive ? 999999 : 0;
    this._lastLightWallPos = this.position.clone();

    if (this.turboOverdriveActive) {
      if (!this.currentVehicle) {
        this._alignCharacterToCrosshair();
        this.currentSpeed = 54.0;
        this.velocity.x = Math.sin(this.facingAngle) * 54.0;
        this.velocity.z = Math.cos(this.facingAngle) * 54.0;
      } else {
        this.isTurboActive = true;
      }
      soundFX.playHeroSwap();
      soundFX.playExplosion(0.45);
      if (this.hud) {
        this.hud.setCharacterPortrait(
          'turbo',
          'TURBO FANTASMA [TURBO OVERDRIVE]',
          'TURBO OVERDRIVE ATIVO [SEGURANDO Q] • MURALHA DE LUZ CIANO ATIVA!'
        );
      }
    } else {
      if (this.hud && this.minifigure.currentHeroKey === 'turbo') {
        this.hud.setCharacterPortrait(
          'turbo',
          this.currentVehicle ? 'TURBO FANTASMA [MOTO 740 KM/H]' : 'TURBO FANTASMA',
          'MOTO 740 KM/H [MOUSE 2 / F] • ESPADA DE PLASMA [MOUSE 1] • SEGURE [Q] TURBO INFINITO'
        );
      }
    }
  }

  /**
   * HERÓI #7 (Voltaico): Teleporte de Relâmpago Instantâneo (Lightning Blink) [Mouse 2 / F / G]
   * Teleporta 100% garantido na direção da mira (postes, prédios, tetos, rua ou ar até 96m)!
   */
  _triggerVoltaicoLightningBlink() {
    if (this.secondaryCooldown > 0 || !this.destructibles) return;
    this.secondaryCooldown = 0.14;
    const aimDir = this._alignCharacterToCrosshair();
    const fromPos = this.position.clone();

    // Inicia o raio a partir do plano do jogador para NUNCA colidir com objetos atrás da câmera!
    const playerEye = new THREE.Vector3(this.position.x, this.position.y + 1.45, this.position.z);
    const camToPlayerDist = Math.max(0, this.camera.position.distanceTo(playerEye) - 0.4);
    const rayOrigin = this.camera.position.clone().addScaledVector(aimDir, camToPlayerDist);

    const maxBlinkDist = 96.0;
    let bestT = maxBlinkDist;
    let targetPt = null;

    // 1. Verifica se mirou num poste de luz, antena ou objeto próximo ao raio
    for (const obj of this.destructibles.objects) {
      if (obj.destroyed || obj.isDriven) continue;
      const objTop = new THREE.Vector3(obj.basePos.x, obj.basePos.y + (obj.height || 2.0), obj.basePos.z);
      const toObj = objTop.clone().sub(rayOrigin);
      const dist = toObj.length();
      if (dist < 3.0 || dist > bestT) continue;
      const dot = toObj.clone().normalize().dot(aimDir);
      if (dot < 0.86) continue;
      const perp = dist * Math.sqrt(Math.max(0, 1 - dot * dot));
      if (perp <= (obj.radius || 1.2) + 2.5) {
        bestT = dist;
        targetPt = new THREE.Vector3(obj.basePos.x, obj.basePos.y + (obj.height || 2.0) + 0.35, obj.basePos.z);
      }
    }

    // 2. Interseção 3D exata com prédios, tetos, pontes e muros (índice espacial ao longo do raio)
    if (this.world?.colliders) {
      const endRayX = rayOrigin.x + aimDir.x * bestT;
      const endRayZ = rayOrigin.z + aimDir.z * bestT;
      const rayCols = this.world.getCollidersAlongRay2D
        ? this.world.getCollidersAlongRay2D(rayOrigin.x, rayOrigin.z, endRayX, endRayZ, 2.0)
        : this.world.colliders;
      for (const col of rayCols) {
        if (col.disabled) continue;
        const colMinY = col.minY ?? 0;
        let tMin = 0.0;
        let tMax = bestT;
        const axes = [
          [rayOrigin.x, aimDir.x, col.minX, col.maxX],
          [rayOrigin.y, aimDir.y, colMinY, col.maxY],
          [rayOrigin.z, aimDir.z, col.minZ, col.maxZ]
        ];
        let hitBox = true;
        for (const [orig, d, minB, maxB] of axes) {
          if (Math.abs(d) < 1e-6) {
            if (orig < minB || orig > maxB) {
              hitBox = false;
              break;
            }
          } else {
            let t1 = (minB - orig) / d;
            let t2 = (maxB - orig) / d;
            if (t1 > t2) {
              const tmp = t1;
              t1 = t2;
              t2 = tmp;
            }
            tMin = Math.max(tMin, t1);
            tMax = Math.min(tMax, t2);
            if (tMin > tMax) {
              hitBox = false;
              break;
            }
          }
        }
        if (hitBox && tMin >= 2.5 && tMin < bestT) {
          bestT = tMin;
          const hitPt = rayOrigin.clone().addScaledVector(aimDir, Math.max(1.5, tMin - 0.85));
          // Se bateu perto do topo do prédio/estrutura, pousa direto em cima do terraço!
          if (hitPt.y >= col.maxY - 3.2) {
            hitPt.y = col.maxY + 0.35;
          }
          targetPt = hitPt;
        }
      }
    }

    // 3. Interseção com o chão/rua quando olha para baixo
    if (aimDir.y < -0.01) {
      for (let d = 3.0; d <= bestT; d += 1.5) {
        const px = rayOrigin.x + aimDir.x * d;
        const py = rayOrigin.y + aimDir.y * d;
        const pz = rayOrigin.z + aimDir.z * d;
        const terrainY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(px, pz) : 0;
        if (py <= terrainY + 0.3) {
          bestT = d;
          targetPt = new THREE.Vector3(px, terrainY + 0.35, pz);
          break;
        }
      }
    }

    // 4. Fallback no ar livre na direção exata da mira (permite teleportar para o alto no céu!)
    if (!targetPt) {
      const blinkReach = 62.0;
      const fx = rayOrigin.x + aimDir.x * blinkReach;
      const fz = rayOrigin.z + aimDir.z * blinkReach;
      const floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fx, fz) : 0;
      const fy = Math.max(floorY + 0.45, rayOrigin.y + aimDir.y * blinkReach);
      targetPt = new THREE.Vector3(fx, fy, fz);
    }

    this.destructibles.spawnLightningTeleportStrike(fromPos, targetPt);
    this.position.copy(targetPt);
    if (this.minifigure?.root) {
      this.minifigure.root.position.copy(targetPt);
    }
    this.velocity.set(aimDir.x * 14.0, Math.max(9.5, aimDir.y * 18.0 + 6.0), aimDir.z * 14.0);
    this.isGrounded = false;
    this.cameraShakeTimer = 0.26;
  }

  /**
   * HERÓI #7 (Voltaico): Super Pulso EMP & Tempestade de Trovões [Q]
   */
  _triggerVoltaicoEmp() {
    if (this.supernovaCooldown > 0 || !this.destructibles) return;
    this.supernovaCooldown = 0.85;
    this.minifigure.triggerPunch();
    this.cameraShakeTimer = 0.45;
    this.destructibles.triggerVoltaicoEmpPulse(this.position, 28.0);
  }

  /**
   * HERÓI #8 (Vórtex): Alterna em tempo real entre Forma Normal Ágil e Forma Big-Fig Monstruosa [F / R]!
   */
  _toggleVortexMonsterForm() {
    if (this.minifigure.currentHeroKey !== 'vortex') return;
    const nextMonster = !this.minifigure.isVortexMonster;
    this.minifigure.setVortexMonsterForm(nextMonster);
    this.cameraShakeTimer = 0.32;
    if (this.destructibles) {
      this.destructibles.spawnSymbioteMorphBurst(this.position, nextMonster);
    }
    if (this.hud) {
      this.hud.setCharacterPortrait(
        'vortex',
        nextMonster ? 'VÓRTEX [COLOSSO BIG-FIG]' : 'VÓRTEX (SIMBIONTE)',
        nextMonster
          ? 'FORMA MONSTRUOSA ATIVA • ESMAGA PAREDES E CARROS • [F] FORMA ÁGIL'
          : 'FORMA ÁGIL ATIVA • [F] METAMORFOSE BIG-FIG • [MOUSE 2] LAÇO ABISSAL'
      );
    }
  }

  /**
   * HERÓI #8 (Vórtex): Laço Abissal Preciso [Mouse 2 / G] —
   * Puxa helicópteros/carros pro chão OU faz um Estilingue Simbionte (Venom Web-Zip) direto para o ponto mirado!
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
  }

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
  }

  _onKey(e, isDown) {
    // REGRA CRÍTICA ANTI-TECLA PRESA:
    // Sempre processa soltura de teclas (!isDown) ANTES de qualquer return de modal/menu,
    // garantindo que W/A/S/D/Shift/Espaço/Q nunca fiquem travados em true ao abrir [P], [ESC], [M] ou Salvar e Sair!
    if (!isDown) {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.sprint = false;
          break;
        case 'ControlLeft':
        case 'ControlRight':
        case 'KeyC':
          this.keys.descend = false;
          break;
        case 'Space':
          this.keys.jump = false;
          break;
        case 'KeyQ':
          this.keys.turbo = false;
          if (this.minifigure?.currentHeroKey === 'turbo') {
            this._triggerTurboOverdrive(false);
          }
          break;
      }
    }

    const targetTag = e.target?.tagName;
    const isTypingInInput =
      (targetTag === 'INPUT' && e.target?.type !== 'range') ||
      targetTag === 'TEXTAREA' ||
      Boolean(e.target?.isContentEditable);

    if (this.hud?.isCreatorOpen) {
      if (e.code === 'Escape' && isDown && !e.repeat) {
        this.hud.creatorStudio?.close(false);
      }
      return;
    }

    if (this.hud?.isCustomsOpen) {
      if (e.code === 'Escape' && isDown && !e.repeat) {
        this.hud.customsStudio?.close(false);
      }
      return;
    }

    if (this.hud?.isTikTokRadioOpen) {
      if (e.code === 'Escape' && isDown && !e.repeat) {
        this.hud.setTikTokRadioOpen(false, this);
        return;
      }
      if (!isTypingInInput && isDown && !e.repeat) {
        if (e.code === 'KeyP') {
          this.hud.setTikTokRadioOpen(false, this);
        } else if (e.code === 'KeyK') {
          this.hud.tiktokRadio?.togglePlayPause?.();
        } else if (e.code === 'KeyL') {
          this.hud.tiktokRadio?.nextTrack?.(false);
        } else if (e.code === 'KeyJ') {
          this.hud.tiktokRadio?.prevTrack?.(false);
        }
      }
      return;
    }

    if (isTypingInInput) {
      return;
    }

    if (this.hud?.isTitleScreenActive) {
      if (e.code === 'Escape' && isDown && !e.repeat && this.hud?.isPauseMenuOpen) {
        this.hud.setPauseMenuOpen(false, this);
      }
      return;
    }

    if (this.hud?.isPauseMenuOpen) {
      if (e.code === 'Escape' && isDown && !e.repeat) {
        this.hud.setPauseMenuOpen(false, this);
      }
      return;
    }

    // Se a Roda de Personagens [TAB] estiver aberta, WASD gira a roda!
    if (this.hud?.isHeroWheelOpen) {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (isDown && !e.repeat) {
          this.hud.setHeroWheelOpen(false, this, true);
        } else if (!isDown) {
          const heldMs = performance.now() - (this._tabOpenTimestamp || 0);
          if (heldMs > 220) {
            this.hud.setHeroWheelOpen(false, this, true);
          }
        }
        return;
      }
      if (isDown && !e.repeat) {
        if (e.code === 'KeyD' || e.code === 'ArrowRight' || e.code === 'KeyW' || e.code === 'ArrowUp') {
          this.hud.stepHeroWheelSelection(1);
          return;
        }
        if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyS' || e.code === 'ArrowDown') {
          this.hud.stepHeroWheelSelection(-1);
          return;
        }
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
          this.hud.setHeroWheelOpen(false, this, true);
          return;
        }
      }
    }

    switch (e.code) {
      case 'Escape':
        if (isDown && !e.repeat) {
          if (this.hud?.isDossierOpen) {
            this.hud.setHeroDossierOpen(false, this);
          } else if (this.hud?.isFullMapOpen) {
            this.hud.setFullMapOpen(false, this.world, this);
          } else if (this.hud?.isHeroWheelOpen) {
            this.hud.setHeroWheelOpen(false, this, true);
          } else if (this.hud) {
            this.hud.setPauseMenuOpen(!this.hud.isPauseMenuOpen, this);
          }
        }
        break;
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isDown;
        if (isDown) this.minifigure?.stopEmote?.();
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isDown;
        if (isDown) this.minifigure?.stopEmote?.();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isDown;
        if (isDown) this.minifigure?.stopEmote?.();
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isDown;
        if (isDown) this.minifigure?.stopEmote?.();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = isDown;
        // No carro: Shift aciona DRIFT e cancela o Turbo (só pode Drift OU Turbo, nunca os dois juntos!)
        if (isDown && this.currentVehicle) {
          this.keys.turbo = false;
          this.isTurboActive = false;
        }
        break;
      case 'ControlLeft':
      case 'ControlRight':
      case 'KeyC':
        this.keys.descend = isDown;
        if (
          isDown &&
          !e.repeat &&
          (this.minifigure.currentHeroKey === 'caveira' || this.minifigure.currentHeroKey === 'sombra') &&
          this.isGrounded
        ) {
          this._triggerTacticalRoll();
        }
        break;
      case 'Space':
        if (isDown && !e.repeat) {
          const now = performance.now();
          const deltaTap = now - this.lastSpacePressTime;
          this.lastSpacePressTime = now;

          if (this.currentVehicle) {
            const carTapDelta = now - this.lastCarSpaceTapTime;
            this.lastCarSpaceTapTime = now;
            if (carTapDelta < 380) {
              this._triggerVehicleHydraulicJump();
            }
          } else if (this.grappleState) {
            // Pular durante o Gancho Magnético solta o cabo transferindo todo o embalo em sling aéreo livre!
            this._stopGrapple(true);
            this.velocity.y = Math.max(this.velocity.y, 17.5);
          } else if (this.minifigure.currentHeroKey === 'solaris') {
            // REGRA DE VOO DO SOLARIS:
            // - Se JÁ estiver voando, apertar Espaço (mesmo 2x rápido) NUNCA desliga o voo — serve 100% do tempo para SUBIR!
            // - Se NÃO estiver voando, entra em voo ao apertar Espaço no ar (!isGrounded) ou 2x Espaço no chão!
            if (this.isFlying) {
              this.velocity.y = Math.max(this.velocity.y, 18.0);
            } else if (!this.isGrounded || deltaTap < 380) {
              this._activateSolarisFlight();
            } else {
              this.velocity.y = this.jumpForce;
              this.isGrounded = false;
            }
          } else if (this.minifigure.currentHeroKey === 'op09' && !this.currentVehicle) {
            this.customHeroPowers?.handleSpacePress(deltaTap);
          } else if (this.isGrounded && !this.isFlying) {
            if (this.minifigure.currentHeroKey === 'tita') {
              // Inicia o carregamento do Super-Pulo Hidráulico do Titã Blindado!
              this.titaJumpCharging = true;
              this.titaJumpChargeTime = 0;
              this.titaJumpChargeSoundTimer = 0;
            } else if (this.minifigure.currentHeroKey === 'vortex' && this.minifigure.isVortexMonster) {
              // Salto Predatório Colossal na Forma Big-Fig Monstruosa do Vórtex!
              this.velocity.y = 26.5;
              this.isGrounded = false;
            } else {
              this.velocity.y = this.jumpForce;
              this.isGrounded = false;
            }
          }
        } else if (!isDown && this.minifigure.currentHeroKey === 'tita' && this.titaJumpCharging) {
          this._releaseTitaSuperJumpCharge();
        }
        this.keys.jump = isDown;
        break;
      case 'Tab':
        e.preventDefault();
        if (isDown && !e.repeat) {
          if (this.hud) {
            this._tabOpenTimestamp = performance.now();
            this.hud.setHeroWheelOpen(true, this);
          } else {
            this.toggleHero();
          }
        }
        break;
      case 'Digit1':
        if (isDown && !e.repeat) {
          this.switchToHero('caveira');
        }
        break;
      case 'Digit2':
        if (isDown && !e.repeat) {
          this.switchToHero('solaris');
        }
        break;
      case 'Digit3':
        if (isDown && !e.repeat) {
          this.switchToHero('tita');
        }
        break;
      case 'Digit4':
        if (isDown && !e.repeat) {
          this.switchToHero('vingador');
        }
        break;
      case 'Digit5':
        if (isDown && !e.repeat) {
          this.switchToHero('sombra');
        }
        break;
      case 'Digit6':
        if (isDown && !e.repeat) {
          this.switchToHero('turbo');
        }
        break;
      case 'Digit7':
        if (isDown && !e.repeat) {
          this.switchToHero('voltaico');
        }
        break;
      case 'Digit8':
        if (isDown && !e.repeat) {
          this.switchToHero('vortex');
        }
        break;
      case 'Digit9':
        if (isDown && !e.repeat) {
          this.switchToHero('op09');
        }
        break;
      case 'KeyE':
        // [E] é dedicado a Entrar / Sair do Carro ou interagir com terminais quando próximo!
        if (isDown && !e.repeat) {
          this.toggleVehicleInteraction();
        }
        break;
      case 'KeyQ':
        this.keys.turbo = isDown;
        if (this.minifigure.currentHeroKey === 'turbo') {
          // No Turbo Fantasma, [Q] funciona igual Turbo de Carro: ativo enquanto segura [Q], desliga ao soltar!
          if (isDown && !e.repeat) {
            this._triggerTurboOverdrive(true);
          } else if (!isDown) {
            this._triggerTurboOverdrive(false);
          }
        }
        if (this.currentVehicle) {
          // No carro/moto: Q aciona TURBO e cancela o Drift (só pode Drift OU Turbo, nunca os dois juntos!)
          if (isDown) {
            this.keys.sprint = false;
            this.isDrifting = false;
          }
        } else if (this.minifigure.currentHeroKey === 'solaris') {
          if (isDown && !e.repeat) {
            this._startSolarisSupernovaCharge();
          } else if (!isDown) {
            this._releaseSolarisSupernovaCharge();
          }
        } else if (isDown && !e.repeat) {
          const hero = this.minifigure.currentHeroKey;
          if (hero === 'caveira') {
            this._triggerTacticalRoll();
          } else if (hero === 'tita') {
            this._triggerTitaEarthquake();
          } else if (hero === 'vingador') {
            this._triggerVingadorThrusterDive();
          } else if (hero === 'sombra') {
            this._triggerSombraSmokeBomb();
          } else if (hero === 'voltaico') {
            this._triggerVoltaicoEmp();
          } else if (hero === 'vortex') {
            this._triggerVortexEruption();
          } else if (hero === 'op09') {
            this.customHeroPowers?.triggerSuperAbility();
          }
        }
        break;
      case 'KeyF':
        if (isDown && !e.repeat) {
          const hero = this.minifigure.currentHeroKey;
          if (!this.currentVehicle && hero === 'tita') {
            // No Titã Blindado, [F] agarra/arremessa qualquer veículo (para dirigir, usa [E])!
            this._toggleTitaCarGrabOrThrow();
          } else if (!this.currentVehicle && hero === 'vortex') {
            // No Vórtex, [F] alterna em tempo real entre Forma Normal Ágil e Forma Big-Fig Monstruosa!
            this._toggleVortexMonsterForm();
          } else if (!this.currentVehicle && hero === 'voltaico') {
            // No Voltaico, [F] aciona o Teleporte Elétrico (Lightning Blink)!
            this._triggerVoltaicoLightningBlink();
          } else if (hero === 'turbo') {
            // No Turbo Fantasma, [F] SEMPRE invoca e monta (ou desmonta) a Moto Energética!
            this._summonAndMountTurboGhostBike();
          } else if (this.currentVehicle || this.findNearbyVehicle()) {
            this.toggleVehicleInteraction();
          } else {
            if (hero === 'caveira') {
              this._triggerTacticalRoll();
            } else if (hero === 'solaris') {
              if (this.isFlying) {
                this.isFlying = false;
                this.isSupersonic = false;
              } else {
                this._activateSolarisFlight();
              }
            } else if (hero === 'vingador') {
              this._cycleVingadorWeapon();
            } else if (hero === 'sombra') {
              this._triggerSombraGrapple();
            } else if (hero === 'op09') {
              this.customHeroPowers?.triggerMobilityKey();
            }
          }
        }
        break;
      case 'KeyG':
        if (isDown && !e.repeat) {
          const hero = this.minifigure.currentHeroKey;
          if (hero === 'turbo') {
            this._summonAndMountTurboGhostBike();
          } else if (!this.currentVehicle) {
            if (hero === 'caveira') {
              this.world?.livingCity?.triggerCaveiraRadioCommand(this.position, this.facingAngle);
            } else if (hero === 'tita') {
              this._toggleTitaCarGrabOrThrow();
            } else if (hero === 'sombra') {
              this._triggerSombraMagneticPull();
            } else if (hero === 'vingador') {
              this._cycleVingadorWeapon();
            } else if (hero === 'voltaico') {
              this._triggerVoltaicoLightningBlink();
            } else if (hero === 'vortex') {
              this._triggerVortexAbyssalLasso();
            } else if (hero === 'op09') {
              this.customHeroPowers?.triggerMobilityKey();
            }
          }
        }
        break;
      case 'KeyV':
        // Soco Foguete (Titã), Corte Duplo de Katanas (Sombra) ou Soco Corpo a Corpo
        if (isDown && !e.repeat && !this.currentVehicle) {
          const hero = this.minifigure.currentHeroKey;
          if (hero === 'tita') {
            this._triggerTitaRocketPunch();
          } else if (hero === 'sombra') {
            this.minifigure.triggerPunch();
            if (this.destructibles) {
              const aimData = this._getAimTargetPoint(48);
              this.destructibles.performKatanaSlash(this.position, this.facingAngle, aimData.point);
            }
          } else if (hero === 'turbo') {
            this._firePrimaryAction();
          } else if (hero === 'voltaico') {
            this._firePrimaryAction();
          } else if (hero === 'vortex') {
            this._firePrimaryAction();
          } else {
            this.minifigure.triggerPunch();
            if (this.destructibles) {
              this.destructibles.performMeleeAttack(this.position, this.facingAngle, 2.7, 22);
            }
          }
        }
        break;
      case 'KeyR':
        if (isDown && !e.repeat) {
          if (!this.currentVehicle && this.minifigure.currentHeroKey === 'vingador') {
            // No Vingador de Chumbo, [R] alterna entre Duas SMGs, Escopeta de Impacto e Bazuca RPG!
            this._cycleVingadorWeapon();
          } else if (!this.currentVehicle && this.minifigure.currentHeroKey === 'vortex') {
            // No Vórtex, [R] também alterna entre Forma Ágil e Forma Big-Fig Monstruosa!
            this._toggleVortexMonsterForm();
          } else if (this.destructibles) {
            if (this.currentVehicle) {
              this.exitVehicle();
            }
            this.destructibles.rebuildAll();
          }
        }
        break;
      case 'KeyB':
        if (
          isDown &&
          !e.repeat &&
          !this.currentVehicle &&
          !this.activeRide &&
          this.isGrounded &&
          !this.isFlying
        ) {
          this.velocity.set(0, 0, 0);
          this.currentSpeed = 0;
          this.minifigure?.triggerNextEmote?.();
        }
        break;
      case 'KeyX':
        if (isDown && !e.repeat && this.currentVehicle) {
          this._triggerVehicleHydraulicJump();
        }
        break;
      case 'KeyH':
        if (isDown && !e.repeat && this.hud) {
          this.hud.toggleHeroDossier(this);
        }
        break;
      case 'KeyM':
        if (isDown && !e.repeat && this.onToggleFullMap) {
          this.onToggleFullMap();
        }
        break;
      case 'KeyP':
        if (isDown && !e.repeat && this.hud) {
          if (e.shiftKey) {
            this.hud.tiktokRadio?.nextTrack?.(true);
          } else {
            this.resetHeldInputs();
            this.hud.toggleTikTokRadioModal?.(this);
          }
        }
        break;
      case 'KeyK':
        if (isDown && !e.repeat && this.hud?.tiktokRadio) {
          this.hud.tiktokRadio.togglePlayPause();
        }
        break;
      case 'KeyL':
        if (isDown && !e.repeat && this.hud?.tiktokRadio) {
          this.hud.tiktokRadio.nextTrack(true);
        }
        break;
      case 'KeyJ':
        if (isDown && !e.repeat && this.hud?.tiktokRadio) {
          this.hud.tiktokRadio.prevTrack(true);
        }
        break;
      case 'BracketRight':
        if (isDown && !e.repeat && this.hud?.tiktokRadio?.isPlaying) {
          this.hud.tiktokRadio.nextTrack(true);
        }
        break;
      case 'BracketLeft':
        if (isDown && !e.repeat && this.hud?.tiktokRadio?.isPlaying) {
          this.hud.tiktokRadio.prevTrack(true);
        }
        break;
    }
  }

  /**
   * Busca o veículo intacto (Carro, Moto, Caminhão-Carreta, Tanque, Pedalinho, Barco, Jet-Ski, Lancha, Navio Cargueiro, Helicóptero ou Avião) mais próximo
   */
  findNearbyVehicle() {
    if (!this.destructibles) return null;
    let closest = null;
    let bestScore = Infinity;

    for (const obj of this.destructibles.objects) {
      if (obj.destroyed || obj.type !== 'car') continue;
      const spec = obj.mesh.userData?.vehicleSpec;

      const dx = this.position.x - obj.mesh.position.x;
      const dz = this.position.z - obj.mesh.position.z;
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
  }

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
  }

  /**
   * Suspensão Hidráulica de Salto da Oficina LEGO Customs (Nv.1 = 3m até Nv.10 = 16m no ar!):
   * Acionada com 2x [Espaço] ou [X] enquanto dirige carro/moto tunado.
   */
  _triggerVehicleHydraulicJump() {
    const carObj = this.currentVehicle;
    if (!carObj || carObj.destroyed || this.vehicleAirborne) return false;
    const spec = carObj.mesh?.userData?.vehicleSpec;
    if (!spec || spec.category || spec.isColossalShip) return false;
    if (!(spec.hydraulicsLevel >= 1 && spec.jumpVelY > 0)) return false;

    this.vehicleAirborne = true;
    this.vehicleAirVelY = spec.jumpVelY;
    carObj.mesh.position.y += 0.25;
    soundFX.playTacticalRoll();
    if (this.destructibles) {
      this.destructibles.spawnFlameTrailParticle(
        new THREE.Vector3(carObj.mesh.position.x, carObj.mesh.position.y + 0.2, carObj.mesh.position.z),
        1.15
      );
    }
    return true;
  }

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

    // A pé perto do Console do Elevador Hidráulico ou do Terminal de Retirada da Garagem Pessoal
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
  }

  _findNearbyCustomizerPedestal() {
    const lab = this.world?.customizerLabPedestal;
    if (!lab) return null;
    const cPos = lab.consolePos || lab.pedestalPos;
    const pPos = lab.pedestalPos || cPos;
    const distConsole = Math.hypot(this.position.x - cPos.x, this.position.z - cPos.z);
    const distPedestal = Math.hypot(this.position.x - pPos.x, this.position.z - pPos.z);
    const minDist = Math.min(distConsole, distPedestal);
    const dy = Math.abs(this.position.y - cPos.y);
    if (minDist <= 5.4 && dy <= 3.5) {
      return lab;
    }
    return null;
  }

  /**
   * Posiciona o herói no assento da atração/vagão do metrô e coloca a câmera em volta dele.
   * Retorna true quando há assento ativo. Também é chamado pelo mundo logo após o trem andar,
   * para o herói não ficar um quadro atrás do vagão.
   */
  _applyRideSeatAndCamera(dt) {
    if (this.activeRide && (this.activeRide.type === 'metro' ? this.world?.metroSystem : this.world?.attractions)) {
      const seat = this.activeRide.type === 'metro'
        ? this.world.metroSystem.getRideSeatTransform(this.activeRide)
        : this.world.attractions.getRideSeatTransform(this.activeRide);
      if (seat) {
        this.position.copy(seat.pos);
        this.facingAngle = seat.yaw;
        this.minifigure.root.position.copy(seat.pos);
        if (seat.quat) {
          this.minifigure.root.quaternion.copy(seat.quat);
          // Transfere a inclinação (bank) real do trilho da Montanha-Russa para o vetor UP da câmera, mantendo visão 360° no mouse!
          const trackUp = new THREE.Vector3(0, 1, 0).applyQuaternion(seat.quat).normalize();
          this.camera.up.lerp(trackUp, Math.min(1, dt * 8));
        } else {
          this.camera.up.set(0, 1, 0);
          this.minifigure.root.rotation.set(0, seat.yaw, 0);
        }

        const camDist = seat.camDist || 9.0;
        const horiz = camDist * Math.cos(this.pitch);
        const vert = camDist * Math.sin(this.pitch);
        const shakeX = this.cameraShakeTimer > 0 ? (Math.random() - 0.5) * 0.45 : 0;
        const shakeY = this.cameraShakeTimer > 0 ? (Math.random() - 0.5) * 0.45 : 0;
        if (this.cameraShakeTimer > 0) this.cameraShakeTimer = Math.max(0, this.cameraShakeTimer - dt);

        const targetFocus = new THREE.Vector3(seat.pos.x, seat.pos.y + 1.35, seat.pos.z);
        this.camera.position.set(
          targetFocus.x + Math.sin(this.yaw) * horiz + shakeX,
          Math.max(1.2, targetFocus.y + vert + (seat.camHeight || 2.2) * 0.35 + shakeY),
          targetFocus.z + Math.cos(this.yaw) * horiz
        );
        if (seat.clampCamera) seat.clampCamera(this.camera.position);
        this.camera.lookAt(targetFocus);
        return true;
      }
    }
    return false;
  }

  _findNearbyMetroTotem() {
    const totems = this.world?.metroTotems;
    if (!Array.isArray(totems)) return null;
    for (const totem of totems) {
      const dist = Math.hypot(this.position.x - totem.position.x, this.position.z - totem.position.z);
      if (dist <= 4.2 && Math.abs(this.position.y - totem.position.y) <= 2.8) {
        return {
          target: totem.nextSpawn,
          label: `EMBARCAR METRÔ -> ${totem.nextStationName}`
        };
      }
    }
    return null;
  }

  /**
   * Alterna entre entrar no veículo mais próximo, usar o Elevador Quântico, embarcar no Totem do Metrô ou sair do veículo atual ao apertar [E]
   */
  enterAmusementRide(attrHit) {
    if (!attrHit || !this.world?.attractions) return false;
    this.minifigure?.stopEmote?.();
    this._stopGrapple();
    this.isFlying = false;
    this.isSupersonic = false;
    this.ridingMetroCar = null;
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;

    const cabinIdx =
      attrHit.type === 'ferris_wheel'
        ? this.world.attractions.getLowestFerrisCabinIndex()
        : 0;

    this.activeRide = {
      type: attrHit.type,
      cabinIdx,
      exitPos: attrHit.exitPos ? attrHit.exitPos.clone() : this.position.clone()
    };

    if (this.minifigure?.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, 0, true, false, 0);
    }
    soundFX.playStudCollect(1000);
    return true;
  }

  /**
   * Embarque SENTADO no Metrô LEGO: o herói senta no banco do vagão e é levado pelo trem
   * até apertar [E] com o trem parado numa estação.
   */
  enterMetroRide(ride) {
    if (!ride) return false;
    this.minifigure?.stopEmote?.();
    this._stopGrapple();
    this.isFlying = false;
    this.isSupersonic = false;
    this.ridingMetroCar = null;
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    this.activeRide = ride;
    if (this.minifigure?.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, 0, true, false, 0);
    }
    if (typeof soundFX.playMetroDingDong === 'function') {
      soundFX.playMetroDingDong(0.6);
    } else {
      soundFX.playStudCollect(600);
    }
    return true;
  }

  /** Desembarca na plataforma se o trem estiver parado com as portas abertas; senão, continua sentado. */
  exitMetroRide() {
    const ride = this.activeRide;
    if (!ride || ride.type !== 'metro') return false;
    const exit = this.world?.metroSystem?.getDisembarkPoint?.(ride);
    if (!exit) return false;
    this.activeRide = { ...ride, exitPos: exit.pos };
    this.facingAngle = exit.yaw;
    return this.exitAmusementRide();
  }

  exitAmusementRide() {
    if (!this.activeRide) return false;
    const ex = this.activeRide.exitPos;
    this.activeRide = null;
    this.camera.up.set(0, 1, 0);

    if (this.minifigure?.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(false);
    }
    this.minifigure.root.rotation.order = 'YXZ';
    this.minifigure.root.rotation.set(0, this.facingAngle, 0);

    if (ex) {
      this.position.set(ex.x, ex.y, ex.z);
      this.minifigure.root.position.copy(this.position);
    }
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    this.isGrounded = true;
    soundFX.playPlasticHit();
    return true;
  }

  toggleVehicleInteraction() {
    if (this.activeRide) {
      if (this.activeRide.type === 'metro') {
        // Em movimento o [E] é ignorado: só desembarca parado na estação.
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
    if (attrHit) {
      return this.enterAmusementRide(attrHit);
    }
    const metroRide = this.world?.metroSystem?.findBoardableCar?.(this.position);
    if (metroRide) {
      return this.enterMetroRide(metroRide);
    }
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
  }

  enterVehicle(carObj) {
    if (!carObj || carObj.destroyed) return;
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

    if (this.destructibles) {
      this.destructibles.updateSolarBeam(false);
    }

    // Desabilita os colisores estáticos deste veículo enquanto ele está sendo pilotado
    for (const col of carObj.colliders) {
      col.disabled = true;
    }

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
      const openTop = Boolean(spec?.openTop);
      const isMoto = Boolean(spec?.isMotorcycle);
      this.minifigure.setSeatedInVehicle(true, 0, openTop, isMoto, 0);
    }
    soundFX.playCarEngineStart();
  }

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

    // Esconde chamas de Turbo e zera inclinação ao sair (pousando a roda dianteira da moto no chão)
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

    // Atualiza basePos, baseRot, groundY e os colisores estáticos do veículo onde parou!
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
      if (this.minifigure.setSeatedInVehicle) {
        this.minifigure.setSeatedInVehicle(false);
      }
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

    // Posiciona o jogador ao lado do veículo (ou no píer/margem seca mais próxima se sair de um barco!)
    const exitDist = spec?.isHeavyTruck ? 3.8 : category === 'plane' ? 5.2 : category === 'helicopter' ? 3.4 : 2.25;
    let exitX = carPos.x + Math.cos(heading) * exitDist;
    let exitZ = carPos.z - Math.sin(heading) * exitDist;
    const exitSurfaceY = this.world?.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(exitX, exitZ, carPos.y)
      : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(exitX, exitZ) : 0);
    let exitY = Math.max(carPos.y, exitSurfaceY);

    if (category === 'boat' && this.world?.isDeepWaterAt) {
      // Se houver píer, deck da marina ou margem seca num raio de 7m do barco, desembarca no seco!
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
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(false);
    }
    this.minifigure.root.rotation.order = 'YXZ';
    this.minifigure.root.rotation.set(0, this.facingAngle, 0);
    this.minifigure.root.position.copy(this.position);
  }

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

    // Quando estiver dirigindo, oculta a linha inferior EXCETO sobre o Elevador Hidráulico da LEGO Customs!
    if (this.currentVehicle) {
      if (customsHit?.mode === 'lift_drive') {
        this.vehiclePromptTextEl.textContent = customsHit.label;
        this.vehiclePromptEl.classList.remove('hidden');
      } else {
        this.vehiclePromptEl.classList.add('hidden');
      }
      return;
    }

    if (customsHit) {
      this.vehiclePromptTextEl.textContent = customsHit.label;
      this.vehiclePromptEl.classList.remove('hidden');
      return;
    }

    const customizerLab = this._findNearbyCustomizerPedestal();
    if (customizerLab) {
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
      this.vehiclePromptTextEl.textContent = 'EMBARCAR NO METRÔ';
      if (next) this.vehiclePromptTextEl.textContent = `EMBARCAR NO METRÔ (PARADO EM ${next.shortName})`;
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
      this.vehiclePromptTextEl.textContent = `${actionVerb} ${carName}`;
      this.vehiclePromptEl.classList.remove('hidden');
    } else {
      const elev = this._findNearbyHeroElevator();
      if (elev) {
        this.vehiclePromptTextEl.textContent = `USAR ${elev.label}`;
        this.vehiclePromptEl.classList.remove('hidden');
      } else {
        const metroTotem = this._findNearbyMetroTotem();
        if (metroTotem) {
          this.vehiclePromptTextEl.textContent = metroTotem.label;
          this.vehiclePromptEl.classList.remove('hidden');
        } else {
          this.vehiclePromptEl.classList.add('hidden');
        }
      }
    }
  }

  _updateVehicleDriving(dt, camRight) {
    const carObj = this.currentVehicle;
    if (!carObj || carObj.destroyed) {
      this.exitVehicle();
      return;
    }

    const spec = carObj.mesh.userData?.vehicleSpec || {
      maxForward: 34.0,
      turboSpeed: 49.0,
      maxReverse: -13.5,
      accel: 29.0,
      turnRate: 2.38,
      driftTurnRate: 3.6
    };

    // Disparo contínuo de armas veiculares no Clique Esquerdo!
    if (this.mouseButtons.left && this.primaryCooldown <= 0) {
      this._fireVehicleWeapon();
    }

    // Ativa os 2 Cones de Farol Branco-Quente + Lanternas Traseiras Vermelhas quando nightFactor > 0.15!
    if (!spec.category) {
      const nightRig = ensureVehicleNightLights(carObj.mesh, spec);
      if (nightRig) {
        nightRig.visible = Boolean((this.world?.atmosphere?.nightFactor || 0) > 0.15);
      }
    }

    // Delega física específica para Embarcações (Barcos/Pedalinhos/Jet-Skis/Lanchas), Helicópteros e Aviões!
    if (spec.category === 'boat') {
      this._updateBoatNavigation(dt, camRight, carObj, spec);
      return;
    }
    if (spec.category === 'helicopter') {
      this._updateHelicopterFlight(dt, camRight, carObj, spec);
      return;
    }
    if (spec.category === 'plane') {
      this._updatePlaneFlight(dt, camRight, carObj, spec);
      return;
    }

    // Regra de Exclusividade Mútua: Só pode dar DRIFT (Shift) OU TURBO (Q), um por vez!
    if (this.keys.sprint && !this.keys.turbo && Math.abs(this.vehicleSpeed) > 3.5) {
      this.isDrifting = true;
      this.isTurboActive = false;
    } else if (this.keys.turbo && !this.keys.sprint) {
      this.isTurboActive = true;
      this.isDrifting = false;
    } else {
      this.isDrifting = false;
      this.isTurboActive = false;
    }

    // Shift NÃO aumenta a velocidade máxima (dá Drift!). O Q aciona o TURBO NITRO!
    const maxForward = this.isTurboActive
      ? spec.turboSpeed
      : this.isDrifting
        ? spec.maxForward * 0.94
        : spec.maxForward;
    const maxReverse = spec.maxReverse;
    const accel = this.isTurboActive ? (spec.turboAccel ?? spec.accel * 1.95) : spec.accel;
    const brakeDecel = spec.brakeDecel ?? 48.0;
    const baseCoast = spec.coastFriction ?? 12.0;
    const coastFriction = this.isDrifting ? baseCoast * 1.25 : baseCoast;

    // Motos: Espaço empina a moto APENAS se estiver acelerando ([W] ou [Q]); sem [W]/[Q], Espaço é Freio de Mão forte!
    const isDoingWheelie = Boolean(
      spec.canWheelie && this.keys.jump && (this.keys.forward || this.isTurboActive)
    );

    if (this.keys.jump && !isDoingWheelie) {
      // Freio de mão forte (Espaço)
      if (Math.abs(this.vehicleSpeed) < 0.5) {
        this.vehicleSpeed = 0;
      } else {
        this.vehicleSpeed -= Math.sign(this.vehicleSpeed) * brakeDecel * 1.15 * dt;
      }
    } else if (this.keys.backward && !this.isTurboActive) {
      // Freio forte na tecla [S] (quando indo para frente) ou Ré
      const rate = this.vehicleSpeed > 0 ? brakeDecel : accel * 0.85;
      this.vehicleSpeed = Math.max(maxReverse, this.vehicleSpeed - rate * dt);
    } else if (this.keys.forward || this.isTurboActive || isDoingWheelie) {
      const rate = this.vehicleSpeed < 0 ? brakeDecel : accel;
      if (this.vehicleSpeed > maxForward) {
        // Se acabou de soltar o [Q] Turbo e continua no [W], desacelera suavemente até a velocidade normal do [W]
        this.vehicleSpeed = Math.max(maxForward, this.vehicleSpeed - brakeDecel * 0.75 * dt);
      } else {
        this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + rate * dt);
      }
    } else {
      if (Math.abs(this.vehicleSpeed) < 0.45) {
        this.vehicleSpeed = 0;
      } else {
        this.vehicleSpeed -= Math.sign(this.vehicleSpeed) * coastFriction * dt;
      }
    }

    // Esterçamento das rodas dianteiras (A / D) + Ângulo de Derrapagem Traseira (Drift Slip Angle)
    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    const targetSteer = steerInput * (this.isDrifting ? 0.65 : 0.52);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, targetSteer, Math.min(1, dt * 14));

    if (Math.abs(this.vehicleSpeed) > 0.35) {
      const speedFactor = THREE.MathUtils.clamp(Math.abs(this.vehicleSpeed) / 9.0, 0.25, 1.0);
      const reverseSign = this.vehicleSpeed >= 0 ? 1 : -1;
      const turnRate = this.isDrifting
        ? spec.driftTurnRate
        : this.keys.jump
          ? 2.85
          : spec.turnRate;
      this.vehicleHeading += steerInput * turnRate * speedFactor * reverseSign * dt;
    }

    // No Drift (Shift), a traseira do carro desliza de lado em até ~25° (0.44 rad) e inclina o chassi!
    const targetDriftAngle = this.isDrifting && Math.abs(this.vehicleSpeed) > 5.0
      ? steerInput * 0.44
      : 0;
    this.vehicleDriftAngle = THREE.MathUtils.lerp(this.vehicleDriftAngle, targetDriftAngle, Math.min(1, dt * 10));

    const forwardX = Math.sin(this.vehicleHeading);
    const forwardZ = Math.cos(this.vehicleHeading);

    const netVehMult = this.energyNetSlowTimer > 0 ? 0.58 : 1.0;
    this.velocity.x = forwardX * this.vehicleSpeed * netVehMult;
    this.velocity.z = forwardZ * this.vehicleSpeed * netVehMult;
    this.velocity.y = 0;

    // Move e verifica colisão com prédios/paredes
    const carRadius = 1.45;
    const curX = carObj.mesh.position.x;
    const curZ = carObj.mesh.position.z;
    const nextX = THREE.MathUtils.clamp(curX + this.velocity.x * dt, -2200, 2200);
    const nextZ = THREE.MathUtils.clamp(curZ + this.velocity.z * dt, -1500, 1700);

    // Atropelamento O(1) de objetos quebráveis de rua (~460 props a 60 FPS!), Impacto de Ariete e RAMPA CUNHA!
    const isUnstoppable = spec.rammingPower === 'unstoppable';
    const hasWedgeRam = Boolean(spec.hasWedgeRam);
    if (this.destructibles && Math.abs(this.vehicleSpeed) > 3.5) {
      const midX = (curX + nextX) * 0.5;
      const midZ = (curZ + nextZ) * 0.5;
      const stepSpan = Math.hypot(nextX - curX, nextZ - curZ);
      const nearCandidates = this.destructibles.getObjectsNear
        ? this.destructibles.getObjectsNear(midX, midZ, stepSpan * 0.5 + 5.5)
        : this.destructibles.objects;

      for (const obj of nearCandidates) {
        if (obj.destroyed || obj === carObj || obj._wedgeActive) continue;
        // Só atropela objetos/carros que estão no mesmo nível vertical (rua vs viaduto/platô)!
        const objY = obj.mesh?.position?.y ?? obj.groundY ?? 0;
        if (Math.abs(objY - carObj.mesh.position.y) > 2.8) continue;
        // Não atropela portas de cofre, cofres de ouro maciços ou navios cargueiros colossais
        if (obj.type === 'bank_vault_door' || obj.type === 'gold_vault') continue;
        if (obj.mesh?.userData?.vehicleSpec?.isColossalShip) continue;

        const ox = obj.mesh.position.x;
        const oz = obj.mesh.position.z;
        const dx = ox - nextX;
        const dz = oz - nextZ;
        const distEnd = Math.hypot(dx, dz);
        const distMid = Math.hypot(ox - midX, oz - midZ);
        const dist = Math.min(distEnd, distMid);
        const hitMargin = hasWedgeRam ? 2.45 : 1.92;
        if (dist < obj.radius + hitMargin) {
          if (obj.type === 'car') {
            const dotFront = (dx * forwardX + dz * forwardZ) / Math.max(0.01, dist);
            if (hasWedgeRam && this.vehicleSpeed > 6.5 && dotFront > -0.25 && this.world?.customsRuntime) {
              // RAMPA CUNHA FRONTAL (Wedge Ram): levanta e joga o outro carro voando por cima do seu teto!
              this.world.customsRuntime.launchVehicleOverRoof(
                obj,
                carObj.mesh.position,
                forwardX,
                forwardZ,
                this.vehicleSpeed
              );
            } else if (isUnstoppable) {
              // Caveirão, Tanque ou Impacto de Ariete (Nv.1..10) arremessa/destrói outros carros sem perder velocidade!
              const dmg = spec.ramLevel ? spec.ramDamage : 9999;
              if (spec.ramLevel && obj.hp > dmg) {
                const knockDist = Math.min(4.5, (spec.ramKnockSpeed || 18) * dt * 3.5);
                obj.mesh.position.x += forwardX * knockDist;
                obj.mesh.position.z += forwardZ * knockDist;
                obj.basePos.copy(obj.mesh.position);
              }
              this.destructibles.damageObject(
                obj,
                dmg,
                new THREE.Vector3(forwardX, 0.55, forwardZ)
              );
            } else if (Math.abs(this.vehicleSpeed) > 16.0) {
              this.destructibles.damageObject(
                obj,
                55,
                new THREE.Vector3(forwardX, 0.35, forwardZ)
              );
            }
          } else {
            this.destructibles.damageObject(
              obj,
              9999,
              new THREE.Vector3(forwardX, 0.35, forwardZ)
            );
          }
        }
      }
    }

    // CARROS E VEÍCULOS TERRESTRES NÃO ANDAM NA ÁGUA PROFUNDA E RESPEITAM MÚLTIPLOS NÍVEIS (VIADUTOS vs RUA ABAIXO)!
    // Desconta a elevação visual da empinada (wheelie) aplicada no frame anterior,
    // senão a física enxerga a moto empinada como "no ar" e cancela a empinada a cada frame.
    const curCarY = carObj.mesh.position.y - (this._vehicleWheelieLiftY || 0);
    const sampleSurface = (sx, sz, refY) =>
      this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(sx, sz, refY)
        : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(sx, sz) : 0);

    const driveQueryR = Math.hypot(nextX - curX, nextZ - curZ) + carRadius + 2.5;
    const driveNearCols = this.world?.getCollidersNear
      ? this.world.getCollidersNear((curX + nextX) * 0.5, (curZ + nextZ) * 0.5, driveQueryR)
      : (this.world?.colliders || []);

    const candTerrainYX = sampleSurface(nextX, curZ, curCarY);
    let blockedX = Boolean(this.world?.isDeepWaterAt?.(nextX, curZ, { forCar: true }));
    if (!blockedX) {
      for (const col of driveNearCols) {
        if (col.disabled) continue;
        const colMinY = col.minY ?? 0;
        if (col.maxY <= candTerrainYX + 0.38 || colMinY > candTerrainYX + 2.2) continue;
        if (
          nextX + carRadius > col.minX &&
          nextX - carRadius < col.maxX &&
          curZ + carRadius > col.minZ &&
          curZ - carRadius < col.maxZ
        ) {
          blockedX = true;
          break;
        }
      }
    }

    const finalX = blockedX ? curX : nextX;

    const candTerrainYZ = sampleSurface(finalX, nextZ, curCarY);
    let blockedZ = Boolean(this.world?.isDeepWaterAt?.(finalX, nextZ, { forCar: true }));
    if (!blockedZ) {
      for (const col of driveNearCols) {
        if (col.disabled) continue;
        const colMinY = col.minY ?? 0;
        if (col.maxY <= candTerrainYZ + 0.38 || colMinY > candTerrainYZ + 2.2) continue;
        if (
          finalX + carRadius > col.minX &&
          finalX - carRadius < col.maxX &&
          nextZ + carRadius > col.minZ &&
          nextZ - carRadius < col.maxZ
        ) {
          blockedZ = true;
          break;
        }
      }
    }

    const finalZ = blockedZ ? curZ : nextZ;

    if (blockedX || blockedZ) {
      this.vehicleSpeed *= spec.collisionRecoilFactor ?? -0.25;
    }

    // Elevação multi-nível contínua + Física Real de Salto Hidráulico [2x Espaço / X] (3m no Nv.1 até 16m no Nv.10!)
    let groundY = sampleSurface(finalX, finalZ, curCarY);
    let finalCarY = groundY;

    if (this.vehicleAirborne || curCarY > groundY + 0.55) {
      this.vehicleAirborne = true;
      finalCarY = curCarY + this.vehicleAirVelY * dt;
      this.vehicleAirVelY += this.gravity * dt;
      const airGroundY = sampleSurface(finalX, finalZ, finalCarY);
      groundY = airGroundY;
      if (finalCarY <= airGroundY) {
        finalCarY = airGroundY;
        this.vehicleAirVelY = 0;
        this.vehicleAirborne = false;
      }
    } else {
      this.vehicleAirVelY = 0;
      this.vehicleAirborne = false;
    }
    this.vehicleVerticalSpeed = this.vehicleAirVelY;

    const aheadY = sampleSurface(finalX + forwardX * 2.0, finalZ + forwardZ * 2.0, groundY);
    const roadSlopePitch = this.vehicleAirborne
      ? THREE.MathUtils.clamp(-this.vehicleAirVelY * 0.018, -0.38, 0.38)
      : -Math.atan2(aheadY - groundY, 2.0);

    const isMoto = Boolean(
      spec.isMotorcycle || spec.id === 'moto_cv' || spec.id === 'moto_pcc' || spec.id === 'moto_policia'
    );
    const targetWheeliePitch = isDoingWheelie && !this.vehicleAirborne ? -0.52 : 0;
    this.vehicleWheeliePitch = THREE.MathUtils.lerp(
      this.vehicleWheeliePitch || 0,
      targetWheeliePitch,
      Math.min(1, dt * 12)
    );

    const rearAxleZ = spec.rearAxleZ ?? 1.38;
    const wheelieAngle = Math.max(0, -this.vehicleWheeliePitch);
    const wheelieLiftY = isMoto ? rearAxleZ * Math.sin(wheelieAngle) : 0;
    this._vehicleWheelieLiftY = wheelieLiftY;

    const visualCarYaw = this.vehicleHeading + this.vehicleDriftAngle;
    const targetPitch = roadSlopePitch + this.vehicleWheeliePitch;
    carObj.mesh.rotation.order = 'YXZ';
    carObj.mesh.position.set(finalX, finalCarY + wheelieLiftY, finalZ);
    carObj.mesh.rotation.y = visualCarYaw;
    carObj.mesh.rotation.x = THREE.MathUtils.lerp(carObj.mesh.rotation.x || 0, targetPitch, Math.min(1, dt * 12));
    carObj.mesh.rotation.z = isMoto
      ? -this.vehicleSteerAngle * 0.35 - this.vehicleDriftAngle * 0.25
      : -this.vehicleDriftAngle * 0.14;
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);
    carObj.groundY = groundY;

    // Gira a torreta acoplada (Picape CV, Hover-APC A.R.E.S. e Tanque Titan-M1) na direção da mira!
    const turretGroup = carObj.mesh.userData?.turretGroup;
    if (turretGroup) {
      turretGroup.rotation.y = (this.yaw + Math.PI) - visualCarYaw;
    }

    // Atualiza Underglow RGB e Chamas Gigantes do Nitro [Q] (escaladas pelo Nível de Nitro 0–10!)
    const nowSec = performance.now() * 0.001;
    updateVehicleDynamicTuningFX(carObj, nowSec);

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      const nitroScale = spec.nitroFlameScale || 1.0;
      const pulse = (0.85 + Math.sin(nowSec * 50.0) * 0.3) * nitroScale;
      for (const f of turboFlames) {
        f.visible = this.isTurboActive;
        if (this.isTurboActive) {
          f.scale.set(Math.min(1.65, nitroScale * 0.78), Math.min(1.65, nitroScale * 0.78), pulse);
        }
      }
    }

    if (this.destructibles && (this.isTurboActive || (this.isDrifting && Math.abs(this.vehicleDriftAngle) > 0.08))) {
      this.driftParticleTimer -= dt;
      if (this.driftParticleTimer <= 0) {
        this.driftParticleTimer = 0.032;
        const rearX = finalX - Math.sin(visualCarYaw) * 2.2;
        const rearZ = finalZ - Math.cos(visualCarYaw) * 2.2;
        const customHex = getVehicleCustomFlameHex(carObj, nowSec);
        this.destructibles.spawnFlameTrailParticle(
          new THREE.Vector3(rearX, finalCarY + 0.35, rearZ),
          (this.isTurboActive ? 1.25 : 0.85) * Math.min(1.6, spec.nitroFlameScale || 1.0),
          customHex
        );
      }
    }

    // Anima a rotação e esterçamento das rodas do veículo LEGO
    const wheels = carObj.mesh.userData?.wheels;
    if (wheels) {
      this.vehicleWheelSpin += (this.vehicleSpeed / 0.42) * dt;
      for (const w of wheels) {
        if (w.isFront) {
          w.steerGroup.rotation.y = this.vehicleSteerAngle - this.vehicleDriftAngle * 0.65;
        }
        w.spinGroup.rotation.x = this.vehicleWheelSpin;
      }
    }

    // Posiciona e inclina a minifigura junto com o veículo (incluindo elevação Monster Truck!)
    const isOpenTop = Boolean(spec.openTop);
    const seatedY =
      (spec.seatedYOffset ?? (isMoto ? 0.78 : isOpenTop ? 0.56 : 0.48)) + (spec.chassisLiftY || 0);
    const seatZOffset = spec.seatZOffset ?? (isMoto ? -0.26 : 0);

    const carPitch = carObj.mesh.rotation.x || 0;
    const carRoll = carObj.mesh.rotation.z || 0;
    const cosRoll = Math.cos(carRoll);
    const sinRoll = Math.sin(carRoll);
    const cosPitch = Math.cos(carPitch);
    const sinPitch = Math.sin(carPitch);
    const cosYaw = Math.cos(visualCarYaw);
    const sinYaw = Math.sin(visualCarYaw);

    const x1 = -seatedY * sinRoll;
    const y1 = seatedY * cosRoll;
    const z1 = seatZOffset;

    const x2 = x1;
    const y2 = y1 * cosPitch - z1 * sinPitch;
    const z2 = y1 * sinPitch + z1 * cosPitch;

    const riderWorldX = finalX + x2 * cosYaw + z2 * sinYaw;
    const riderWorldY = finalCarY + wheelieLiftY + y2;
    const riderWorldZ = finalZ - x2 * sinYaw + z2 * cosYaw;

    this.position.set(finalX, finalCarY + 0.25, finalZ);
    this.facingAngle = visualCarYaw;
    this.minifigure.root.rotation.order = 'YXZ';
    this.minifigure.root.position.set(riderWorldX, riderWorldY, riderWorldZ);
    this.minifigure.root.rotation.set(carPitch, visualCarYaw, carRoll);
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(
        true,
        this.vehicleSteerAngle,
        isOpenTop,
        isMoto,
        this.vehicleWheeliePitch
      );
    } else {
      this.minifigure.state = 'DRIVE';
    }

    this._updateCamera(dt, camRight, false);

    // Entrada Drive-Thru automática ao estacionar o carro devagar bem em cima do Elevador Hidráulico!
    if (this._customsExitCooldown <= 0 && this.world?.legoCustomsData && this.hud?.customsStudio) {
      const lift = this.world.legoCustomsData.liftPos;
      const dLift = Math.hypot(finalX - lift.x, finalZ - lift.z);
      if (dLift <= 4.6 && Math.abs(this.vehicleSpeed) < 2.2 && !this.vehicleAirborne) {
        this.hud.customsStudio.open(this, this.world, carObj, 'performance');
      }
    }
  }

  /**
   * Física de Navegação Aquática (Pedalinhos do Lago, Barcos, Jet-Skis, Lanchas e Navios Cargueiros Colossais):
   * - Navega exclusivamente na água (Lago do Parque, 3 Canais de Santos, Canal Leste e Oceano Atlântico)
   * - Flutua com balanço de ondas, levanta a proa ao acelerar/empinar e gira hélices/pás de pedal!
   */
  _updateBoatNavigation(dt, camRight, carObj, spec) {
    this.isTurboActive = Boolean(this.keys.turbo);
    this.isDrifting = Boolean(this.keys.sprint && !this.isTurboActive && Math.abs(this.vehicleSpeed) > 3.0);

    const maxForward = this.isTurboActive ? spec.turboSpeed : spec.maxForward;
    const accel = this.isTurboActive ? spec.accel * 1.85 : spec.accel;
    const waterDrag = 7.5;
    const isDoingWaveJump = Boolean(spec.canWheelie && this.keys.jump && this.vehicleSpeed > 4.0);

    if (this.keys.forward || this.isTurboActive || isDoingWaveJump) {
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + accel * dt);
    } else if (this.keys.backward) {
      this.vehicleSpeed = Math.max(spec.maxReverse, this.vehicleSpeed - accel * 0.85 * dt);
    } else {
      if (Math.abs(this.vehicleSpeed) < 0.2) this.vehicleSpeed = 0;
      else this.vehicleSpeed -= Math.sign(this.vehicleSpeed) * waterDrag * dt;
    }

    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.55, Math.min(1, dt * 12));

    if (Math.abs(this.vehicleSpeed) > 0.25) {
      const reverseSign = this.vehicleSpeed >= 0 ? 1 : -1;
      const turnRate = this.isDrifting ? spec.driftTurnRate : spec.turnRate;
      this.vehicleHeading += steerInput * turnRate * reverseSign * dt;
    }

    const forwardX = Math.sin(this.vehicleHeading);
    const forwardZ = Math.cos(this.vehicleHeading);
    this.velocity.set(forwardX * this.vehicleSpeed, 0, forwardZ * this.vehicleSpeed);

    const curX = carObj.mesh.position.x;
    const curZ = carObj.mesh.position.z;
    const nextX = THREE.MathUtils.clamp(curX + this.velocity.x * dt, -2600, 2600);
    const nextZ = THREE.MathUtils.clamp(curZ + this.velocity.z * dt, -2000, 2200);

    // Barcos só navegam onde há água profunda (bloqueia subir na areia seca ou calçada!)
    const isColossal = Boolean(spec.isColossalShip);
    const waterY = isColossal
      ? 0
      : (this.world?.getWaterSurfaceY ? this.world.getWaterSurfaceY(curX, curZ) : 0);
    const boatRadius = isColossal ? 18.0 : 1.4;

    const boatNearCols = this.world?.getCollidersNear
      ? this.world.getCollidersNear((curX + nextX) * 0.5, (curZ + nextZ) * 0.5, boatRadius + 6.0)
      : (this.world?.colliders || []);

    let blockedX = this.world?.isDeepWaterAt ? !this.world.isDeepWaterAt(nextX, curZ, { forBoat: true }) : false;
    if (!blockedX) {
      for (const col of boatNearCols) {
        if (col.disabled || (isColossal && (col.isGangway || col.maxY <= 12.0))) continue;
        const colMinY = col.minY ?? 0;
        // Permite passar livremente por baixo da Ponte Arqueada do Lago (colMinY > waterY + 1.8)
        if (!isColossal && (col.maxY <= waterY + 0.15 || colMinY > waterY + 1.8)) continue;
        if (
          nextX + boatRadius > col.minX &&
          nextX - boatRadius < col.maxX &&
          curZ + boatRadius > col.minZ &&
          curZ - boatRadius < col.maxZ
        ) {
          blockedX = true;
          break;
        }
      }
    }
    const finalX = blockedX ? curX : nextX;

    let blockedZ = this.world?.isDeepWaterAt ? !this.world.isDeepWaterAt(finalX, nextZ, { forBoat: true }) : false;
    if (!blockedZ) {
      for (const col of boatNearCols) {
        if (col.disabled || (isColossal && (col.isGangway || col.maxY <= 12.0))) continue;
        const colMinY = col.minY ?? 0;
        if (!isColossal && (col.maxY <= waterY + 0.15 || colMinY > waterY + 1.8)) continue;
        if (
          finalX + boatRadius > col.minX &&
          finalX - boatRadius < col.maxX &&
          nextZ + boatRadius > col.minZ &&
          nextZ - boatRadius < col.maxZ
        ) {
          blockedZ = true;
          break;
        }
      }
    }
    const finalZ = blockedZ ? curZ : nextZ;

    if (blockedX || blockedZ) {
      this.vehicleSpeed *= -0.25;
    }

    const finalWaterY = isColossal
      ? 0
      : (this.world?.getWaterSurfaceY ? this.world.getWaterSurfaceY(finalX, finalZ) : (spec.waterSurfaceY ?? 0));
    const waveBob = Math.sin(performance.now() * 0.0038 + finalX * 0.1) * (isColossal ? 0.025 : 0.055);
    const speedRatio = THREE.MathUtils.clamp(this.vehicleSpeed / Math.max(1, spec.maxForward), -0.5, 1.3);
    const pitchScale = isColossal ? 0.025 : 0.14;
    const rollScale = isColossal ? 0.035 : 0.22;
    const targetPitch = isDoingWaveJump ? -0.42 : -Math.max(0, speedRatio) * pitchScale;
    const targetRoll = -steerInput * Math.min(1, Math.abs(speedRatio)) * rollScale;

    carObj.mesh.position.set(finalX, finalWaterY + waveBob, finalZ);
    carObj.mesh.rotation.y = this.vehicleHeading;
    carObj.mesh.rotation.x = THREE.MathUtils.lerp(carObj.mesh.rotation.x || 0, targetPitch, Math.min(1, dt * 9));
    carObj.mesh.rotation.z = THREE.MathUtils.lerp(carObj.mesh.rotation.z || 0, targetRoll, Math.min(1, dt * 9));
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);

    const propGroup = carObj.mesh.userData?.propellerGroup;
    if (propGroup) {
      const axis = carObj.mesh.userData?.propellerAxis || 'z';
      propGroup.rotation[axis] += (2.5 + Math.abs(this.vehicleSpeed) * 0.85) * dt;
    }

    const turretGroup = carObj.mesh.userData?.turretGroup;
    if (turretGroup) {
      turretGroup.rotation.y = (this.yaw + Math.PI) - this.vehicleHeading;
    }

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      for (const f of turboFlames) f.visible = this.isTurboActive;
    }

    const seatedY = finalWaterY + waveBob + (spec.seatedYOffset ?? 0.58);
    this.position.set(finalX, isColossal ? 24.0 : finalWaterY + 0.25, finalZ);
    this.facingAngle = this.vehicleHeading;
    this.minifigure.root.position.set(finalX, seatedY, finalZ);
    this.minifigure.root.rotation.y = this.vehicleHeading;
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle, !isColossal);
    }

    this._updateCamera(dt, camRight, false);
  }

  _findGroundSupportAt(x, z, currentY) {
    let supportY = this.world?.isDeepWaterAt?.(x, z, { forCar: true })
      ? (this.world.getWaterSurfaceY(x, z))
      : (this.world?.getSurfaceHeightAt
        ? this.world.getSurfaceHeightAt(x, z, currentY)
        : (this.world?.getTerrainHeightAt?.(x, z) ?? 0));
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
  }

  /**
   * Física de Voo Vertical 3D de Helicópteros (Águia Policial BOPE & Falcon-X de Ataque):
   * - [Espaço] Sobe verticalmente | [Ctrl / C] Desce e pousa em qualquer teto, heliponto ou rua
   * - [W/S] Acelera e inclina o nariz | [A/D] Gira a proa | [Q] Turbo | [Mouse 1] Metralhadora / Mísseis!
   */
  _updateHelicopterFlight(dt, camRight, carObj, spec) {
    this.isTurboActive = Boolean(this.keys.turbo);
    this.isDrifting = false;

    const maxForward = this.isTurboActive ? spec.turboSpeed : spec.maxForward;
    const accel = this.isTurboActive ? spec.accel * 1.7 : spec.accel;

    if (this.keys.forward || this.isTurboActive) {
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + accel * dt);
    } else if (this.keys.backward) {
      this.vehicleSpeed = Math.max(spec.maxReverse, this.vehicleSpeed - accel * 0.85 * dt);
    } else {
      this.vehicleSpeed = THREE.MathUtils.lerp(this.vehicleSpeed, 0, Math.min(1, dt * 4.5));
    }

    // Controle vertical direto: [Espaço] Sobe, [Ctrl/C] Desce
    let targetVy = 0;
    if (this.keys.jump) targetVy += this.isTurboActive ? 34.0 : 24.0;
    if (this.keys.descend) targetVy -= 22.0;
    this.vehicleVerticalSpeed = THREE.MathUtils.lerp(this.vehicleVerticalSpeed || 0, targetVy, Math.min(1, dt * 10));

    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.45, Math.min(1, dt * 10));
    this.vehicleHeading += steerInput * spec.turnRate * dt;

    // Se estiver acelerando para frente sem apertar A/D, alinha suavemente com a direção da câmera!
    if (this.keys.forward && steerInput === 0) {
      const desiredYaw = this.yaw + Math.PI;
      this.vehicleHeading = lerpAngle(this.vehicleHeading, desiredYaw, Math.min(1, dt * 3.5));
    }

    const forwardX = Math.sin(this.vehicleHeading);
    const forwardZ = Math.cos(this.vehicleHeading);
    this.velocity.set(forwardX * this.vehicleSpeed, this.vehicleVerticalSpeed, forwardZ * this.vehicleSpeed);

    const curX = carObj.mesh.position.x;
    const curY = carObj.mesh.position.y;
    const curZ = carObj.mesh.position.z;

    const nextX = THREE.MathUtils.clamp(curX + this.velocity.x * dt, -2400, 2400);
    const nextZ = THREE.MathUtils.clamp(curZ + this.velocity.z * dt, -1800, 2000);
    const supportY = this._findGroundSupportAt(nextX, nextZ, curY);
    const finalY = THREE.MathUtils.clamp(curY + this.velocity.y * dt, supportY, 540);
    const isAirborne = finalY > supportY + 0.35;

    if (!isAirborne && this.vehicleVerticalSpeed < 0) {
      this.vehicleVerticalSpeed = 0;
    }

    // Gira as hélices em alta velocidade quando pilotado
    if (carObj.mesh.userData.mainRotorGroup) {
      carObj.mesh.userData.mainRotorGroup.rotation.y += 22.0 * dt;
    }
    if (carObj.mesh.userData.tailRotorGroup) {
      carObj.mesh.userData.tailRotorGroup.rotation.x += 28.0 * dt;
    }

    const speedRatio = this.vehicleSpeed / Math.max(1, spec.maxForward);
    const targetPitch = isAirborne ? speedRatio * 0.24 : 0;
    const targetBank = isAirborne ? -steerInput * 0.28 : 0;

    carObj.mesh.position.set(nextX, finalY, nextZ);
    carObj.mesh.rotation.y = this.vehicleHeading;
    carObj.mesh.rotation.x = THREE.MathUtils.lerp(carObj.mesh.rotation.x || 0, targetPitch, Math.min(1, dt * 8));
    carObj.mesh.rotation.z = THREE.MathUtils.lerp(carObj.mesh.rotation.z || 0, targetBank, Math.min(1, dt * 8));
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      for (const f of turboFlames) f.visible = this.isTurboActive;
    }

    const seatedY = finalY + (spec.seatedYOffset ?? 1.5);
    this.position.set(nextX, finalY + 0.5, nextZ);
    this.facingAngle = this.vehicleHeading;
    this.minifigure.root.position.set(nextX, seatedY, nextZ);
    this.minifigure.root.rotation.y = this.vehicleHeading;
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle, false);
    }

    this._updateCamera(dt, camRight, false);
  }

  /**
   * Física de Decolagem, Voo Supersônico 3D e Pouso de Aviões e Jatos (Caça F-99, Jato VIP e Avião Comercial):
   * - Acelera na pista com [W] ou [Q] Pós-Combustor e decola puxando o manche com [Espaço]!
   * - No ar: faz curvas inclinando as asas (Banking), sobe/mergulha e atira mísseis com [Mouse 1]!
   */
  _updatePlaneFlight(dt, camRight, carObj, spec) {
    this.isTurboActive = Boolean(this.keys.turbo);
    this.isDrifting = false;

    const curX = carObj.mesh.position.x;
    const curY = carObj.mesh.position.y;
    const curZ = carObj.mesh.position.z;
    const supportY = this._findGroundSupportAt(curX, curZ, curY);
    const isAirborne = curY > supportY + 0.45;

    const maxForward = this.isTurboActive ? spec.turboSpeed : spec.maxForward;
    const accel = this.isTurboActive ? spec.accel * 1.9 : spec.accel;

    if (this.keys.forward || this.isTurboActive) {
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + accel * dt);
    } else if (this.keys.backward) {
      if (isAirborne) {
        // Freio aerodinâmico no ar para aproximação de pouso
        this.vehicleSpeed = Math.max(14.0, this.vehicleSpeed - accel * 0.7 * dt);
      } else {
        this.vehicleSpeed = Math.max(spec.maxReverse, this.vehicleSpeed - accel * 0.85 * dt);
      }
    } else {
      const minCruise = isAirborne ? 22.0 : 0;
      this.vehicleSpeed = THREE.MathUtils.lerp(this.vehicleSpeed, minCruise, Math.min(1, dt * 2.5));
    }

    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.vehicleSteerAngle = THREE.MathUtils.lerp(this.vehicleSteerAngle, steerInput * 0.5, Math.min(1, dt * 10));
    if (Math.abs(this.vehicleSpeed) > 0.5 || isAirborne) {
      this.vehicleHeading += steerInput * spec.turnRate * dt;
    }

    // Controle de Pitch (Subida / Mergulho): [Espaço] puxa o nariz para cima e decola; [Ctrl/C] mergulha/pousa!
    let targetVy = 0;
    let targetPitch = 0;
    if (this.keys.jump && (this.vehicleSpeed > 8.0 || isAirborne)) {
      const climbBoost = Math.max(22.0, this.vehicleSpeed * 0.55);
      targetVy = climbBoost;
      targetPitch = -0.38; // Nariz apontado para o céu!
    } else if (this.keys.descend && isAirborne) {
      targetVy = -28.0;
      targetPitch = 0.35; // Mergulho / Descida para pouso!
    } else if (isAirborne) {
      // No ar sem apertar Espaço/Ctrl, segue suavemente a inclinação vertical da câmera
      targetPitch = THREE.MathUtils.clamp(this.pitch * 0.55, -0.42, 0.42);
      targetVy = -targetPitch * Math.max(18.0, this.vehicleSpeed * 0.65);
    }

    this.vehicleVerticalSpeed = THREE.MathUtils.lerp(this.vehicleVerticalSpeed || 0, targetVy, Math.min(1, dt * 9));
    this.vehiclePitch = THREE.MathUtils.lerp(this.vehiclePitch || 0, isAirborne || targetVy > 0 ? targetPitch : 0, Math.min(1, dt * 9));
    const targetBank = isAirborne ? -steerInput * 0.65 : 0;
    this.vehicleBank = THREE.MathUtils.lerp(this.vehicleBank || 0, targetBank, Math.min(1, dt * 9));

    const forwardX = Math.sin(this.vehicleHeading);
    const forwardZ = Math.cos(this.vehicleHeading);
    this.velocity.set(forwardX * this.vehicleSpeed, this.vehicleVerticalSpeed, forwardZ * this.vehicleSpeed);

    const nextX = THREE.MathUtils.clamp(curX + this.velocity.x * dt, -2600, 2600);
    const nextZ = THREE.MathUtils.clamp(curZ + this.velocity.z * dt, -2000, 2200);
    const nextSupportY = this._findGroundSupportAt(nextX, nextZ, curY);
    const finalY = THREE.MathUtils.clamp(curY + this.velocity.y * dt, nextSupportY, 550);

    carObj.mesh.position.set(nextX, finalY, nextZ);
    carObj.mesh.rotation.y = this.vehicleHeading;
    carObj.mesh.rotation.x = this.vehiclePitch;
    carObj.mesh.rotation.z = this.vehicleBank;
    carObj.basePos.copy(carObj.mesh.position);
    carObj.baseRot.copy(carObj.mesh.rotation);

    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      const showFlames = this.isTurboActive || (isAirborne && this.keys.forward);
      const pulse = 0.9 + Math.sin(performance.now() * 0.06) * 0.35;
      for (const f of turboFlames) {
        f.visible = showFlames;
        if (showFlames) f.scale.set(1, 1, this.isTurboActive ? pulse * 1.4 : pulse * 0.85);
      }
    }

    const seatedY = finalY + (spec.seatedYOffset ?? 1.6);
    this.position.set(nextX, finalY + 0.5, nextZ);
    this.facingAngle = this.vehicleHeading;
    this.minifigure.root.position.set(nextX, seatedY, nextZ);
    this.minifigure.root.rotation.y = this.vehicleHeading;
    if (this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle, false);
    }

    this._updateCamera(dt, camRight, false);
  }

  /**
   * Resolve um ponto de spawn 100% livre de colisores horizontais (veículos, contêineres ou paredes)
   */
  _resolveSafeSpawnPoint(target) {
    let spawnX = target.x;
    const spawnY = target.y;
    let spawnZ = target.z;
    if (this.world && Array.isArray(this.world.colliders)) {
      const r = (this.playerRadius || 0.48) + 0.35;
      const stepUpHeight = 0.34;
      const playerHeight = 2.05;
      const isBlockedAt = (tx, ty, tz) => {
        const candCols = this.world.getCollidersNear
          ? this.world.getCollidersNear(tx, tz, r + 1.0)
          : this.world.colliders;
        for (const col of candCols) {
          if (col.disabled) continue;
          if (tx + r > col.minX && tx - r < col.maxX && tz + r > col.minZ && tz - r < col.maxZ) {
            const colMinY = col.minY ?? 0;
            if (ty + stepUpHeight < col.maxY && ty + playerHeight > colMinY) {
              return true;
            }
          }
        }
        return false;
      };

      if (isBlockedAt(spawnX, spawnY, spawnZ)) {
        let foundSafe = false;
        for (let dist = 2.5; dist <= 28 && !foundSafe; dist += 2.5) {
          for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 4) {
            const candX = target.x + Math.cos(ang) * dist;
            const candZ = target.z + Math.sin(ang) * dist;
            if (!isBlockedAt(candX, spawnY, candZ)) {
              spawnX = candX;
              spawnZ = candZ;
              foundSafe = true;
              break;
            }
          }
        }
      }
    }
    return new THREE.Vector3(spawnX, spawnY, spawnZ);
  }

  /**
   * Inicia a transição de Viagem Rápida estilo GTA V (Troca de Personagem / Satélite):
   * - Esconde a HUD e ativa o filtro de lente de satélite
   * - Sobe a câmera em 3 saltos de zoom (visão de cima tipo tabuleiro)
   * - Desliza pelo céu até a região de destino e desce em 3 saltos de zoom até o herói
   */
  startFastTravel(target, label = 'SETOR SELECIONADO') {
    if (!target) return;

    if (this.currentVehicle) {
      this.exitVehicle();
    }

    const origin = this.position.clone();
    const dest = this._resolveSafeSpawnPoint(target);

    // Move o herói para o destino livre de colisores e pousado no piso (pronto para andar!)
    this.position.copy(dest);
    this.velocity.set(0, 0, 0);
    this.currentSpeed = 0;
    this.isFlying = false;
    this.isSupersonic = false;
    this.isGrounded = true;
    if (this.minifigure?.root) {
      this.minifigure.root.position.copy(this.position);
    }

    this.fastTravelState = {
      active: true,
      elapsed: 0,
      duration: 2.25,
      origin,
      target: dest,
      lastPhase: -1,
      label
    };

    if (document.body?.classList) {
      document.body.classList.add('satellite-transition');
    }
    if (this.satOverlayEl) {
      this.satOverlayEl.classList.remove('hidden');
    }

    const camRight = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this._updateFastTravelCamera(0.001, camRight);
  }

  _triggerSatellitePulse(telemetryText, isDown, step) {
    if (this.satTelemetryEl && telemetryText) {
      this.satTelemetryEl.textContent = telemetryText;
    }
    if (this.satFlashEl) {
      this.satFlashEl.classList.add('pulse');
      setTimeout(() => {
        this.satFlashEl.classList.remove('pulse');
      }, 55);
    }
    soundFX.playSatelliteZoomStep(isDown, step);
  }

  _updateFastTravelCamera(dt, camRight) {
    const st = this.fastTravelState;
    if (!st) return;

    st.elapsed += dt;
    const t = st.elapsed;

    // Determina em qual das 7 etapas estilo GTA V estamos
    let phase = 0;
    if (t < 0.28) phase = 0;      // Zoom Out 1
    else if (t < 0.56) phase = 1; // Zoom Out 2
    else if (t < 0.86) phase = 2; // Zoom Out 3 (Topo Tabuleiro)
    else if (t < 1.38) phase = 3; // Panorâmica Aérea Rápida pela Cidade
    else if (t < 1.66) phase = 4; // Zoom In 1 (Sobre o Destino)
    else if (t < 1.94) phase = 5; // Zoom In 2 (Mais Perto)
    else if (t < st.duration) phase = 6; // Retorno Suave para Câmera 3ª Pessoa
    else phase = 7;

    if (phase !== st.lastPhase && phase < 7) {
      st.lastPhase = phase;
      if (phase === 0) {
        this._triggerSatellitePulse('SATÉLITE BOPE // ZOOM OUT [NÍVEL 1 — 85m]', false, 1);
      } else if (phase === 1) {
        this._triggerSatellitePulse('SATÉLITE BOPE // ZOOM OUT [NÍVEL 2 — 210m]', false, 2);
      } else if (phase === 2) {
        this._triggerSatellitePulse('SATÉLITE BOPE // VISÃO ORBITAL [NÍVEL 3 — 410m]', false, 3);
      } else if (phase === 3) {
        if (this.satTelemetryEl) {
          this.satTelemetryEl.textContent = `SATÉLITE BOPE // TRAVANDO ALVO: ${st.label}`;
        }
      } else if (phase === 4) {
        this._triggerSatellitePulse(`SATÉLITE BOPE // APROXIMAÇÃO [200m] — ${st.label}`, true, 1);
      } else if (phase === 5) {
        this._triggerSatellitePulse(`SATÉLITE BOPE // APROXIMAÇÃO [70m] — ${st.label}`, true, 2);
      } else if (phase === 6) {
        this._triggerSatellitePulse('SATÉLITE BOPE // SINCRONIZANDO OPERADOR...', true, 3);
      }
    }

    if (phase >= 7) {
      this.fastTravelState = null;
      if (document.body?.classList) {
        document.body.classList.remove('satellite-transition');
      }
      if (this.satOverlayEl) {
        this.satOverlayEl.classList.add('hidden');
      }
      this._updateCamera(dt, camRight, false);
      return;
    }

    let focusX = st.origin.x;
    let focusY = st.origin.y;
    let focusZ = st.origin.z;
    let camHeight = 85;

    if (phase === 0) {
      camHeight = 80 + (t / 0.28) * 12;
    } else if (phase === 1) {
      camHeight = 205 + ((t - 0.28) / 0.28) * 16;
    } else if (phase === 2) {
      camHeight = 400 + ((t - 0.56) / 0.30) * 20;
    } else if (phase === 3) {
      const rawU = (t - 0.86) / (1.38 - 0.86);
      const u = rawU * rawU * (3 - 2 * rawU); // Smoothstep
      focusX = THREE.MathUtils.lerp(st.origin.x, st.target.x, u);
      focusY = THREE.MathUtils.lerp(st.origin.y, st.target.y, u);
      focusZ = THREE.MathUtils.lerp(st.origin.z, st.target.z, u);
      camHeight = 415;
    } else if (phase === 4) {
      focusX = st.target.x;
      focusY = st.target.y;
      focusZ = st.target.z;
      camHeight = 195 - ((t - 1.38) / 0.28) * 14;
    } else if (phase === 5) {
      focusX = st.target.x;
      focusY = st.target.y;
      focusZ = st.target.z;
      camHeight = 72 - ((t - 1.66) / 0.28) * 10;
    } else if (phase === 6) {
      const rawU = (t - 1.94) / (st.duration - 1.94);
      const u = rawU * rawU * (3 - 2 * rawU);

      // Posição final da câmera em 3ª pessoa atrás do personagem
      const desiredTarget = new THREE.Vector3(
        this.position.x + camRight.x * this.shoulderOffset,
        this.position.y + 1.55,
        this.position.z + camRight.z * this.shoulderOffset
      );
      this.cameraLookTarget.copy(desiredTarget);

      const horizDist = this.distance * Math.cos(this.pitch);
      const vertDist = this.distance * Math.sin(this.pitch);
      const endCamX = desiredTarget.x + Math.sin(this.yaw) * horizDist;
      const endCamZ = desiredTarget.z + Math.cos(this.yaw) * horizDist;
      const endCamY = Math.max(0.42, desiredTarget.y + vertDist);

      const startTopX = st.target.x;
      const startTopY = st.target.y + 62;
      const startTopZ = st.target.z + 6;

      this.camera.position.set(
        THREE.MathUtils.lerp(startTopX, endCamX, u),
        THREE.MathUtils.lerp(startTopY, endCamY, u),
        THREE.MathUtils.lerp(startTopZ, endCamZ, u)
      );
      const lookPos = new THREE.Vector3(
        THREE.MathUtils.lerp(st.target.x, desiredTarget.x, u),
        THREE.MathUtils.lerp(st.target.y + 1.0, desiredTarget.y, u),
        THREE.MathUtils.lerp(st.target.z, desiredTarget.z, u)
      );
      this.camera.lookAt(lookPos);
      return;
    }

    // Visão de cima tipo tabuleiro (Top-Down Satellite View) nas Fases 0 a 5
    this.camera.position.set(focusX, focusY + camHeight, focusZ + 12);
    this.camera.lookAt(focusX, focusY, focusZ);
  }

  update(dt) {
    if (this.hud?.isCreatorOpen) {
      this.hud.creatorStudio?.updateStudioCamera(dt);
      return;
    }
    if (this.hud?.isCustomsOpen) {
      this.hud.customsStudio?.updateStudioCamera(dt);
      return;
    }
    if (this._customsExitCooldown > 0) {
      this._customsExitCooldown = Math.max(0, this._customsExitCooldown - dt);
    }

    // Se qualquer janela modal / menu / tela inicial estiver aberta, zera inputs de movimento para o boneco parar suavemente!
    if (
      this.hud?.isTikTokRadioOpen ||
      this.hud?.isPauseMenuOpen ||
      this.hud?.isFullMapOpen ||
      this.hud?.isDossierOpen ||
      this.hud?.isTitleScreenActive ||
      this.hud?.isLoadingActive
    ) {
      if (
        this.keys.forward ||
        this.keys.backward ||
        this.keys.left ||
        this.keys.right ||
        this.keys.jump ||
        this.keys.sprint ||
        this.keys.turbo ||
        this.mouseButtons.left ||
        this.mouseButtons.right
      ) {
        this.resetHeldInputs();
      }
    }

    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);
    this.supernovaCooldown = Math.max(0, this.supernovaCooldown - dt);
    this.customHeroPowers?.update(dt);

    const camForward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    ).normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, UP).normalize();

    // Se estiver na transição de Satélite estilo GTA V (Viagem Rápida), trava o controle e anima a câmera orbital!
    if (this.fastTravelState?.active) {
      this.minifigure.updateAnimation(dt, 0, this.runSpeed, true, 0, this.isFlying, false, 0, 0);
      this._updateFastTravelCamera(dt, camRight);
      return;
    }

    this._updateVehiclePrompt();

    // Se estiver embarcado numa Atração do Mega Píer ou sentado no Metrô LEGO, a posição vem do assento!
    if (this._applyRideSeatAndCamera(dt)) {
      return;
    }

    if (this.energyNetSlowTimer > 0) {
      this.energyNetSlowTimer = Math.max(0, this.energyNetSlowTimer - dt);
    }

    // Se estiver dirigindo um carro, processa a física veicular e retorna!
    if (this.currentVehicle) {
      const prevCarPos = this.position.clone();
      this._updateVehicleDriving(dt, camRight);
      // Se o Turbo Fantasma estiver pilotando sua Moto Energética, anima o corte da Espada de Plasma e deixa a Muralha de Luz Ciano!
      if (this.minifigure.currentHeroKey === 'turbo') {
        if (this.minifigure.punchTimer > 0) {
          this.minifigure.punchTimer = Math.max(0, this.minifigure.punchTimer - dt);
          const slashProgress = 1 - this.minifigure.punchTimer / Math.max(0.01, this.minifigure.punchDuration || 0.28);
          if (this.minifigure.rightArmPivot) {
            this.minifigure.rightArmPivot.rotation.x = -1.65;
            this.minifigure.rightArmPivot.rotation.y = 1.25 - slashProgress * 2.5;
            this.minifigure.rightArmPivot.rotation.z = -0.55;
          }
        }
        // Só deixa a Muralha de Luz Ciano na moto enquanto estiver segurando [Q] (Turbo ativo) ou muito rápido!
        if (this.isTurboActive && Math.abs(this.vehicleSpeed) > 6.0 && this.destructibles) {
          if (!this._lastLightWallPos) {
            this._lastLightWallPos = prevCarPos.clone();
          } else if (this.position.distanceTo(this._lastLightWallPos) >= 1.1) {
            this.destructibles.spawnTurboLightWallSegment(this._lastLightWallPos, this.position);
            this._lastLightWallPos.copy(this.position);
          }
        }
      }
      return;
    }

    // Transporte físico frame-a-frame quando apoiado no piso interno ou no teto de um vagão do Metrô LEGO!
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

    // Tiro automático enquanto segura o Clique Esquerdo
    if (this.mouseButtons.left && this.primaryCooldown <= 0) {
      this._firePrimaryAction();
    }

    // Raio Solar Contínuo do Solaris (APENAS no Clique Direito do Mouse!)
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

    // Carregamento em tempo real do Poder [Q] (SUPERNOVA DO SOLARIS) ou do [Espaço] (SUPER-PULO HIDRÁULICO DO TITÃ)
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

    // Se o jogador segurar Clique Direito com o Titã Blindado, emenda um Dash atrás do outro sem cooldown!
    if (this.minifigure.currentHeroKey === 'tita' && this.mouseButtons.right && this.rocketPunchTimer <= 0) {
      this._triggerTitaRocketPunch();
    }

    const moveInput = new THREE.Vector3();
    if (this.keys.forward) moveInput.add(camForward);
    if (this.keys.backward) moveInput.sub(camForward);
    if (this.keys.right) moveInput.add(camRight);
    if (this.keys.left) moveInput.sub(camRight);

    const hasInput = moveInput.lengthSq() > 0.001;
    if (hasInput) {
      moveInput.normalize();
    }

    // Lógica de Voo 3D (Solaris ou Propulsão Jetpack do OP-09) vs Locomoção Terrestre
    if (
      this.isFlying &&
      (this.minifigure.currentHeroKey === 'solaris' || this.minifigure.currentHeroKey === 'op09')
    ) {
      const isSolarisFly = this.minifigure.currentHeroKey === 'solaris';
      this.isSupersonic = isSolarisFly && (hasInput || this.keys.jump || this.keys.descend) && this.keys.sprint;
      const op09JetSpeed =
        (this.keys.sprint ? 38.0 : 25.0) * (this.customHeroPowers?.getSpeedMultiplier() || 1.0);
      const targetFlySpeed = isSolarisFly
        ? (this.isSupersonic ? this.flyCometSpeed : this.flyHoverSpeed)
        : op09JetSpeed;
      const targetSpeed = hasInput ? targetFlySpeed : 0;

      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, Math.min(1, dt * 14));

      // Calcula o banking (inclinação de asa de avião ao fazer curva no ar)
      const yawDelta = this.yaw - this.lastYaw;
      this.lastYaw = this.yaw;
      const strafeBank = (this.keys.left ? 0.45 : 0) + (this.keys.right ? -0.45 : 0);
      const targetBank = THREE.MathUtils.clamp(yawDelta * 14 + strafeBank, -0.85, 0.85);
      this.flightBank = THREE.MathUtils.lerp(this.flightBank, targetBank, Math.min(1, dt * 10));

      if (this.isSupersonic) {
        // MODO COMETA HIPERSÔNICO (SHIFT NO AR — 85.0m/s!):
        const horizDir = hasInput ? moveInput : camForward;
        this.velocity.x = horizDir.x * this.currentSpeed;
        this.velocity.z = horizDir.z * this.currentSpeed;

        // Conserto do Controle Vertical no Modo Cometa (Shift):
        // - Segurar Espaço SEMPRE sobe forte (targetVy = +42.0), mesmo com a câmera inclinada para baixo!
        // - Segurar Ctrl/C mergulha rápido (targetVy = -42.0)
        // - Sem Espaço nem Ctrl, segue suavemente o pitch da mira sem afundar sozinho no chão!
        let targetVy = 0;
        if (this.keys.jump) {
          targetVy = 42.0;
        } else if (this.keys.descend) {
          targetVy = -42.0;
        } else if (hasInput) {
          const pitchVy = -Math.sin(this.pitch) * this.currentSpeed * 0.52;
          const groundSupport = this._findGroundSupportAt(this.position.x, this.position.z, this.position.y);
          targetVy = (this.position.y <= groundSupport + 2.8 && pitchVy < 0) ? 0 : pitchVy;
        }
        this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetVy, Math.min(1, dt * 16));

        // Ângulo de inclinação vertical do corpo do Solaris (mergulho vs subida)
        const horizVel = Math.max(12.0, Math.hypot(this.velocity.x, this.velocity.z));
        const targetPitchAngle = Math.atan2(this.velocity.y, horizVel);
        this.flightPitch = THREE.MathUtils.lerp(this.flightPitch, targetPitchAngle, Math.min(1, dt * 14));

        const desiredAngle = Math.atan2(horizDir.x, horizDir.z);
        this.facingAngle = lerpAngle(this.facingAngle, desiredAngle, Math.min(1, dt * 16));
        this.minifigure.root.rotation.y = this.facingAngle;

        if (this.destructibles) {
          this.cometTrailTimer -= dt;
          if (this.cometTrailTimer <= 0) {
            this.cometTrailTimer = 0.018;
            this.destructibles.spawnFlameTrailParticle(
              new THREE.Vector3(this.position.x, this.position.y + 0.9, this.position.z),
              1.5
            );
          }
        }
      } else {
        // MODO HOVER (Levitação rápida a 28.0m/s):
        this.flightPitch = THREE.MathUtils.lerp(this.flightPitch, 0, Math.min(1, dt * 10));

        if (hasInput) {
          this.velocity.x = moveInput.x * this.currentSpeed;
          this.velocity.z = moveInput.z * this.currentSpeed;

          if (!isUsingSolarBeam && !this.mouseButtons.left) {
            const desiredAngle = Math.atan2(moveInput.x, moveInput.z);
            this.facingAngle = lerpAngle(this.facingAngle, desiredAngle, Math.min(1, dt * 14));
            this.minifigure.root.rotation.y = this.facingAngle;
          }
        } else {
          this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, Math.min(1, dt * 12));
          this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, Math.min(1, dt * 12));
        }

        // Subir (Espaço = +28.0) e Descer (Ctrl / C = -26.0) no Hover
        let targetVy = 0;
        if (this.keys.jump) targetVy += 28.0;
        if (this.keys.descend) targetVy -= 26.0;
        this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetVy, Math.min(1, dt * 14));
      }
    } else {
      this.isSupersonic = false;
      this.flightPitch = 0;
      this.flightBank = 0;
      this.lastYaw = this.yaw;

      if (this.rollImpulseTimer > 0) {
        this.rollImpulseTimer = Math.max(0, this.rollImpulseTimer - dt);
        const isSombra = this.minifigure.currentHeroKey === 'sombra';
        const rollSpeed = isSombra ? 38.0 : 33.0;
        this.velocity.x = this.rollDir.x * rollSpeed;
        this.velocity.z = this.rollDir.z * rollSpeed;
        this.currentSpeed = isSombra ? 32.0 : 27.5;
        if (isSombra && this.destructibles && Math.random() < 0.72) {
          this.destructibles.spawnSombraShadowStepTrail(this.position, 1.15);
        }
      } else if (this.vingadorDiveTimer > 0) {
        // Super-Dash / Mergulho Tático Propulsado [Q] do Vingador de Chumbo (50 m/s por 0.35s)!
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
          // Estoura obstáculos no caminho durante o Mergulho Tático!
          const diveImpactPos = new THREE.Vector3(
            this.position.x + this.vingadorDiveDir.x * 1.8,
            this.position.y + 1.1,
            this.position.z + this.vingadorDiveDir.z * 1.8
          );
          for (const obj of this.destructibles.objects) {
            if (obj.destroyed || obj.isDriven) continue;
            const dx = obj.basePos.x - diveImpactPos.x;
            const dz = obj.basePos.z - diveImpactPos.z;
            const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - diveImpactPos.y);
            if (Math.hypot(dx, dz) <= obj.radius + 2.5 && dy <= obj.height + 2.0) {
              this.destructibles.damageObject(obj, 110, diveImpactPos, false, {
                canBreakCrackedWall: true
              });
            }
          }
        }

        // Ao finalizar o impulso no ar, preserva a inércia horizontal sem frear bruscamente!
        if (this.vingadorDiveTimer <= 0 && !this.isGrounded) {
          this.blastVelocity.set(this.velocity.x * 0.82, 0, this.velocity.z * 0.82);
          this.blastJumpTimer = Math.max(this.blastJumpTimer, 0.55);
        }
      } else if (this.rocketPunchTimer > 0) {
        this.rocketPunchTimer = Math.max(0, this.rocketPunchTimer - dt);
        this.minifigure.isDashing = this.rocketPunchTimer > 0;
        const punchBoost = 44.0;
        this.velocity.x = this.rocketPunchDir.x * punchBoost;
        this.velocity.z = this.rocketPunchDir.z * punchBoost;
        this.currentSpeed = punchBoost;
        if (this.destructibles) {
          if (Math.random() < 0.75) {
            this.destructibles.spawnFlameTrailParticle(
              new THREE.Vector3(this.position.x, this.position.y + 1.4, this.position.z),
              1.35
            );
          }
          // Estoura carros, objetos e Paredes Rachadas durante todo o percurso da Investida / Dash!
          const dashImpactPos = new THREE.Vector3(
            this.position.x + this.rocketPunchDir.x * 2.2,
            this.position.y + 1.4,
            this.position.z + this.rocketPunchDir.z * 2.2
          );
          for (const obj of this.destructibles.objects) {
            if (obj.destroyed || obj.isDriven) continue;
            const dx = obj.basePos.x - dashImpactPos.x;
            const dz = obj.basePos.z - dashImpactPos.z;
            const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - dashImpactPos.y);
            if (Math.hypot(dx, dz) <= obj.radius + 3.2 && dy <= obj.height + 2.5) {
              this.destructibles.damageObject(obj, 140, dashImpactPos, false, {
                canBreakCrackedWall: true,
                canBreakSilver: false
              });
            }
          }
        }
      } else if (this.grappleState) {
        // Gancho Ninja 360° (Sombra Escarlate) ou Laço Abissal Simbionte (Vórtex)!
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
          this.velocity.y = isDive
            ? pullDir.y * pullSpeed - 8.0
            : pullDir.y * pullSpeed + 3.5;
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
            if (this.grappleKunaiGroup) {
              this.grappleKunaiGroup.visible = !isSymbiote;
            }
            if (this.grappleSymbioteMawGroup) {
              this.grappleSymbioteMawGroup.visible = isSymbiote;
            }
            this.grappleCableMesh.visible = true;
            this.grappleCableMesh.position.copy(handPos);
            this.grappleCableMesh.lookAt(this.grappleState.anchor);
            this.grappleCableMesh.scale.set(isSymbiote ? 2.6 : 1, isSymbiote ? 2.6 : 1, dist);
            this.grappleAnchorMesh.visible = true;
            this.grappleAnchorMesh.position.copy(this.grappleState.anchor);
            this.grappleAnchorMesh.lookAt(this.grappleState.anchor.clone().add(pullDir));
          }
        }
      } else if (this.blastJumpTimer > 0 && !this.isGrounded) {
        this.blastJumpTimer = Math.max(0, this.blastJumpTimer - dt);
        // Preserva o super-impulso aéreo da bomba (Satchel Caveira) ou do Sling do Gancho (Sombra / Vórtex) com alto controle direcional!
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
      } else {
        const hero = this.minifigure.currentHeroKey;
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

        const heroWalkSpeed =
          isSombra ? 15.5 :
            isTurbo ? 16.0 :
              isVoltaico ? (isVoltaicoGliding ? 28.0 : 15.5) :
                isVortex ? (this.minifigure.isVortexMonster ? 14.5 : 16.5) :
                  isVingador ? 13.5 :
                    isCaveira ? 13.0 :
                      isOp09 ? 9.5 :
                        this.walkSpeed;

        const heroRunSpeed =
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

        if (hasInput || (isTurbo && this.turboOverdriveActive)) {
          const moveDir = hasInput
            ? moveInput
            : new THREE.Vector3(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle));
          this.velocity.x = moveDir.x * this.currentSpeed;
          this.velocity.z = moveDir.z * this.currentSpeed;

          if (hasInput && !isUsingSolarBeam && !this.mouseButtons.left) {
            const desiredAngle = Math.atan2(moveInput.x, moveInput.z);
            this.facingAngle = lerpAngle(this.facingAngle, desiredAngle, Math.min(1, dt * 16));
            this.minifigure.root.rotation.y = this.facingAngle;
          }
        } else {
          this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, Math.min(1, dt * 18));
          this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, Math.min(1, dt * 18));
        }
      }

      if (!this.grappleState) {
        this.velocity.y += this.gravity * dt;
        // Levitação & Planagem Eletromagnética do Voltaico segurando [Espaço] no ar!
        if (this.minifigure.currentHeroKey === 'voltaico' && !this.isGrounded && this.keys.jump && this.velocity.y < -1.35) {
          this.velocity.y = -1.35;
        }
      }
    }

    // Atualiza Arrancada Overdrive Infinita + Muralha de Luz a pé [Q] do Turbo Fantasma!
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

    // Atualiza timer de Invisibilidade Furtiva da Bomba de Fumaça do Sombra Escarlate
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

    // Atualiza timer do Modo "Furor do Justiceiro" [Q] do Vingador de Chumbo (4.0s de Velocidade 32m/s + 60% Cadência!)
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

    const preLandVy = this.velocity.y;
    const wasInAir = !this.isGrounded && !this.isFlying;
    const wasDiveGrappling = Boolean(this.grappleState?.isDiveGrapple);

    this._moveAndCollide(dt, moveInput);

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

    // Se o Titã Blindado estiver segurando qualquer veículo, mantém o veículo erguido acima da cabeça dele!
    if (this.grabbedCar && !this.grabbedCar.destroyed) {
      this.grabbedCar.mesh.position.set(
        this.position.x,
        this.position.y + 4.35,
        this.position.z
      );
      this.grabbedCar.mesh.rotation.set(0, this.facingAngle + Math.PI * 0.5, 0);
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -2200, 2200);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -1500, 1700);
    this.position.y = THREE.MathUtils.clamp(this.position.y, -15.5, 560);

    this.minifigure.root.position.copy(this.position);

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.minifigure.updateAnimation(
      dt,
      horizontalSpeed,
      this.runSpeed,
      this.isGrounded,
      this.velocity.y,
      this.isFlying,
      this.isSupersonic,
      this.flightPitch,
      this.flightBank
    );

    this._updateCamera(dt, camRight, isUsingSolarBeam);
  }

  getHorizontalSpeed() {
    if (this.currentVehicle) {
      return Math.abs(this.vehicleSpeed);
    }
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

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

  /**
   * Atualiza a Câmera Over-the-Shoulder (OTS) estilo Fortnite:
   * Desloca o foco para a direita (+camRight * shoulderOffset) para que o boneco fique
   * à esquerda da tela e o centro da mira (#crosshair) fique 100% livre!
   */
  _updateCamera(dt, camRight, isAimingBeam = false) {
    // FOV dinâmico (aumenta no Voo Supersônico do Solaris, Gancho/Stealth do Sombra, Rocket Jump/Furor do Vingador, Blast Jump do Caveira e Turbo Nitro dos Carros!)
    const isCaveiraBlast =
      (this.minifigure.currentHeroKey === 'caveira' ||
        this.minifigure.currentHeroKey === 'sombra' ||
        this.minifigure.currentHeroKey === 'vingador') &&
      this.blastJumpTimer > 0 &&
      !this.isGrounded;
    const isSombraGrapple =
      (this.minifigure.currentHeroKey === 'sombra' && Boolean(this.grappleState)) ||
      (this.minifigure.currentHeroKey === 'vingador' && this.vingadorDiveTimer > 0);
    const isHeroSprint =
      (this.minifigure.currentHeroKey === 'caveira' ||
        this.minifigure.currentHeroKey === 'sombra' ||
        this.minifigure.currentHeroKey === 'vingador') &&
      (this.keys.sprint || this.stealthTimer > 0 || this.vingadorFurorTimer > 0) &&
      this.currentSpeed > 18;
    const desiredFov = (this.isSupersonic || this.isTurboActive || isSombraGrapple)
      ? 74
      : isCaveiraBlast
        ? 72
        : isHeroSprint
          ? 66
          : isAimingBeam
            ? 53
            : this.baseFov;
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, desiredFov, Math.min(1, dt * 10));
      this.camera.updateProjectionMatrix();
    }

    const vehicleScale = this.currentVehicle?.mesh?.userData?.vehicleSpec?.cameraDistScale ?? 1.0;
    const effectiveTargetDist = (this.isSupersonic ? this.targetDistance * 1.15 : this.targetDistance) * vehicleScale;

    this.distance = THREE.MathUtils.lerp(
      this.distance,
      effectiveTargetDist,
      Math.min(1, dt * 12)
    );

    // Ponto de foco deslocado para o ombro direito (+camRight * shoulderOffset)
    // Isso posiciona o personagem levemente à esquerda na tela, liberando a mira central!
    const desiredTarget = new THREE.Vector3(
      this.position.x + camRight.x * this.shoulderOffset,
      this.position.y + 1.55,
      this.position.z + camRight.z * this.shoulderOffset
    );
    this.cameraLookTarget.lerp(desiredTarget, Math.min(1, dt * 20));

    // Direção 3D livre da câmera com arco vertical completo de -85° a +85° (-1.48 a +1.48 rad):
    // - pitch < 0: câmera olha para cima (direto para o céu / topo dos arranha-céus / Aeroporta-Aviões)
    // - pitch > 0: câmera olha para baixo (direto para o chão / visão vertical aérea)
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);

    const viewDir = new THREE.Vector3(
      -Math.sin(this.yaw) * cosPitch,
      -sinPitch,
      -Math.cos(this.yaw) * cosPitch
    ).normalize();

    let usedDist = this.distance;
    const minCamY = this.isGrounded ? this.position.y + 0.35 : Math.min(0.35, this.position.y + 0.35);
    const rawCamY = this.cameraLookTarget.y + sinPitch * usedDist;

    // Quando olha totalmente para o céu no chão, aproxima a câmera suavemente do ombro para não entrar no asfalto,
    // mas preserva 100% do ângulo de inclinação para cima (viewDir) sem travar a mira!
    if (rawCamY < minCamY && sinPitch < -0.05) {
      const allowedDist = (minCamY - this.cameraLookTarget.y) / sinPitch;
      usedDist = THREE.MathUtils.clamp(allowedDist, 1.35, this.distance);
    }

    let camX = this.cameraLookTarget.x - viewDir.x * usedDist;
    let camZ = this.cameraLookTarget.z - viewDir.z * usedDist;
    let camY = Math.max(minCamY, this.cameraLookTarget.y - viewDir.y * usedDist);

    // Dentro das Estações e Túneis Subterrâneos do Metrô (pé-direito livre de 9.6m entre -10.5m e -0.9m),
    // mantém a câmera abaixo da laje do teto (-1.18m) sem limitar nas escadarias abertas para o céu!
    if (this.position.y < -3.8 && Array.isArray(this.world?.undergroundFloors)) {
      for (const uf of this.world.undergroundFloors) {
        if (camX >= uf.minX && camX <= uf.maxX && camZ >= uf.minZ && camZ <= uf.maxZ) {
          camY = Math.min(camY, (uf.ceilingY ?? -0.9) - 0.28);
          break;
        }
      }
    }

    if (this.cameraShakeTimer > 0) {
      this.cameraShakeTimer = Math.max(0, this.cameraShakeTimer - dt);
      const shakeAmp = this.cameraShakeTimer * 0.65;
      camX += (Math.random() - 0.5) * shakeAmp;
      camY += (Math.random() - 0.5) * shakeAmp;
      camZ += (Math.random() - 0.5) * shakeAmp;
    }

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(
      camX + viewDir.x * 25,
      camY + viewDir.y * 25,
      camZ + viewDir.z * 25
    );
  }
}
