import { soundFX } from '../../audio/SoundFX.js';

export const heroSelectionAndShortcutsMethods = {
  /**
   * Troca instantaneamente entre os Heróis Jogáveis (Caveira, Solaris, Titã Blindado, Vingador de Chumbo, Sombra Escarlate, Turbo, Voltaico, Vórtex e OP-09)
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
  },

  toggleHero() {
    const heroOrder = ['caveira', 'solaris', 'tita', 'vingador', 'sombra', 'turbo', 'voltaico', 'vortex', 'op09'];
    const idx = heroOrder.indexOf(this.minifigure.currentHeroKey);
    const next = heroOrder[(idx + 1) % heroOrder.length];
    this.switchToHero(next);
  },

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
  },

  _handleHeroAndCombatKeyShortcuts(e, isDown) {
    switch (e.code) {
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
      case 'Digit1':
        if (isDown && !e.repeat) this.switchToHero('caveira');
        break;
      case 'Digit2':
        if (isDown && !e.repeat) this.switchToHero('solaris');
        break;
      case 'Digit3':
        if (isDown && !e.repeat) this.switchToHero('tita');
        break;
      case 'Digit4':
        if (isDown && !e.repeat) this.switchToHero('vingador');
        break;
      case 'Digit5':
        if (isDown && !e.repeat) this.switchToHero('sombra');
        break;
      case 'Digit6':
        if (isDown && !e.repeat) this.switchToHero('turbo');
        break;
      case 'Digit7':
        if (isDown && !e.repeat) this.switchToHero('voltaico');
        break;
      case 'Digit8':
        if (isDown && !e.repeat) this.switchToHero('vortex');
        break;
      case 'Digit9':
        if (isDown && !e.repeat) this.switchToHero('op09');
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
    }
  }
};
