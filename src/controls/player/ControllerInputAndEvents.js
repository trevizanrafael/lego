import * as THREE from 'three';

export const controllerInputAndEventsMethods = {
  _bindEvents() {
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.domElement.addEventListener('mousedown', (e) => {
      if (
        this.hud?.isTitleScreenActive || this.hud?.isPauseMenuOpen ||
        this.hud?.isCreatorOpen || this.hud?.isCustomsOpen ||
        this.hud?.isAircraftStudioOpen || this.hud?.isTikTokRadioOpen
      ) {
        return;
      }
      this.hasEnteredGame = true;
      const promptEl = document.getElementById('pointer-prompt');
      if (promptEl) promptEl.classList.remove('visible');

      if (this.hud?.isHeroWheelOpen) {
        if (e.button === 0) this.hud.setHeroWheelOpen(false, this, true);
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
          if (hero === 'turbo') this._summonAndMountTurboGhostBike();
        } else if (hero === 'caveira') {
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
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isDraggingMouse = false;
        this.mouseButtons.left = false;
      } else if (e.button === 2) {
        this.mouseButtons.right = false;
      }
    });

    window.addEventListener('blur', () => this.resetHeldInputs());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.resetHeldInputs();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
      if (!this.isPointerLocked) this.resetHeldInputs();
      if (this.isPointerLocked) {
        this.hasEnteredGame = true;
      } else if (
        this.hasEnteredGame && !this.hud?.isTitleScreenActive &&
        !this.hud?.isPauseMenuOpen && !this.hud?.isFullMapOpen &&
        !this.hud?.isDossierOpen && !this.hud?.isHeroWheelOpen &&
        !this.hud?.isCreatorOpen && !this.hud?.isCustomsOpen &&
        !this.hud?.isAircraftStudioOpen && !this.hud?.isTikTokRadioOpen &&
        !this.fastTravelState?.active
      ) {
        this.hud?.setPauseMenuOpen(true, this);
      }
      const promptEl = document.getElementById('pointer-prompt');
      if (promptEl) {
        const shouldShowPrompt =
          !this.isPointerLocked && !this.hasEnteredGame &&
          !this.hud?.isTitleScreenActive && !this.hud?.isPauseMenuOpen &&
          !this.hud?.isFullMapOpen && !this.hud?.isDossierOpen &&
          !this.hud?.isHeroWheelOpen && !this.hud?.isCreatorOpen &&
          !this.hud?.isCustomsOpen && !this.hud?.isAircraftStudioOpen &&
          !this.hud?.isTikTokRadioOpen;
        promptEl.classList.toggle('visible', shouldShowPrompt);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (
        this.hud?.isTitleScreenActive || this.hud?.isPauseMenuOpen ||
        this.hud?.isFullMapOpen || this.hud?.isDossierOpen ||
        this.hud?.isCreatorOpen || this.hud?.isCustomsOpen ||
        this.hud?.isAircraftStudioOpen || this.fastTravelState?.active
      ) {
        return;
      }
      if (this.hud?.isRadioWheelOpen) {
        this.hud.updateRadioWheelAim(e.movementX || 0, e.movementY || 0);
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
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * sensitivity, -1.48, 1.48);
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (
          this.hud?.isFullMapOpen || this.hud?.isCreatorOpen ||
          this.hud?.isCustomsOpen || this.hud?.isAircraftStudioOpen ||
          this.fastTravelState?.active
        ) {
          return;
        }
        if (this.hud?.isRadioWheelOpen) {
          this.hud.stepRadioWheelSelection(e.deltaY > 0 ? 1 : -1);
          return;
        }
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('#fullmap-modal')) {
          return;
        }
        if (
          this.minifigure?.currentHeroKey === 'vingador' &&
          !this.currentVehicle && !this.hud?.isDossierOpen && !this.hud?.isHeroWheelOpen
        ) {
          this._cycleVingadorWeapon(e.deltaY > 0 ? 1 : -1);
          return;
        }
        this.targetDistance = THREE.MathUtils.clamp(this.targetDistance + e.deltaY * 0.005, 3.2, 12.0);
      },
      { passive: true }
    );
  },

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
  },

  relockPointer() {
    this.hasEnteredGame = true;
    const promptEl = document.getElementById('pointer-prompt');
    if (promptEl) promptEl.classList.remove('visible');
    if (!document.pointerLockElement && this.domElement?.requestPointerLock) {
      try {
        const res = this.domElement.requestPointerLock();
        if (res && typeof res.catch === 'function') res.catch(() => {});
      } catch (_) {
        // Ignora erro caso chamado em ambiente de teste sem gesto de usuário
      }
    }
  },

  _onKey(e, isDown) {
    // Sempre processa soltura de teclas (!isDown) ANTES de qualquer return de modal/menu!
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
        case 'KeyZ':
        case 'KeyP':
          if (this.hud?.isRadioWheelOpen) {
            this.hud.setRadioWheelOpen(false, this);
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
      if (e.code === 'Escape' && isDown && !e.repeat) this.hud.creatorStudio?.close(false);
      return;
    }
    if (this.hud?.isCustomsOpen) {
      if (e.code === 'Escape' && isDown && !e.repeat) this.hud.customsStudio?.close(false);
      return;
    }
    if (this.hud?.isAircraftStudioOpen) {
      if (e.code === 'Escape' && isDown && !e.repeat) this.hud.aircraftStudio?.close(true);
      return;
    }

    if (this.hud?.isRadioWheelOpen && e.code === 'Escape' && isDown && !e.repeat) {
      this.hud.setRadioWheelOpen(false, this);
      return;
    }

    if (isTypingInInput) return;

    if (this.hud?.isTitleScreenActive) {
      if (e.code === 'Escape' && isDown && !e.repeat && this.hud?.isPauseMenuOpen) {
        this.hud.setPauseMenuOpen(false, this);
      }
      return;
    }
    if (this.hud?.isPauseMenuOpen) {
      if (e.code === 'Escape' && isDown && !e.repeat) this.hud.setPauseMenuOpen(false, this);
      return;
    }

    if (this.hud?.isHeroWheelOpen) {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (isDown && !e.repeat) {
          this.hud.setHeroWheelOpen(false, this, true);
        } else if (!isDown) {
          const heldMs = performance.now() - (this._tabOpenTimestamp || 0);
          if (heldMs > 220) this.hud.setHeroWheelOpen(false, this, true);
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
          isDown && !e.repeat &&
          (this.minifigure.currentHeroKey === 'caveira' || this.minifigure.currentHeroKey === 'sombra') &&
          this.isGrounded
        ) {
          this._triggerTacticalRoll();
        }
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
      case 'KeyE':
        if (isDown && !e.repeat) this.toggleVehicleInteraction();
        break;
      case 'KeyK':
        if (isDown && !e.repeat) {
          if (
            this.position.y > 404 &&
            this.world?.helicarrierHangarData &&
            this.hud?.aircraftStudio &&
            !this.hud.isAircraftStudioOpen
          ) {
            const nearbyAir = this.currentVehicle || this.findNearbyVehicle?.();
            const initialType = nearbyAir?.mesh?.userData?.carType || null;
            this.hud.aircraftStudio.open(this.world, this, initialType);
          } else {
            this.hud?.tiktokRadio?.togglePower?.(true);
          }
        }
        break;
      case 'KeyB':
        if (
          isDown && !e.repeat && !this.currentVehicle &&
          !this.activeRide && this.isGrounded && !this.isFlying
        ) {
          this.velocity.set(0, 0, 0);
          this.currentSpeed = 0;
          this.minifigure?.triggerNextEmote?.();
        }
        break;
      case 'KeyX':
        if (isDown && !e.repeat && this.currentVehicle) this._triggerVehicleHydraulicJump();
        break;
      case 'KeyH':
        if (isDown && !e.repeat && this.hud) this.hud.toggleHeroDossier(this);
        break;
      case 'KeyM':
        if (isDown && !e.repeat && this.onToggleFullMap) this.onToggleFullMap();
        break;
      case 'KeyZ':
      case 'KeyP':
        if (isDown && !e.repeat && this.hud) {
          this.hud.setRadioWheelOpen(true, this);
        }
        break;
      case 'BracketRight':
        if (isDown && !e.repeat && this.hud) this.hud.stepRadioWheelSelection(1);
        break;
      case 'BracketLeft':
        if (isDown && !e.repeat && this.hud) this.hud.stepRadioWheelSelection(-1);
        break;
      default:
        this._handleHeroAndCombatKeyShortcuts(e, isDown);
        break;
    }
  }
};
