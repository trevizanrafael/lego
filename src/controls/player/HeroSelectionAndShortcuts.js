import { soundFX } from '../../audio/SoundFX.js';
import {
  isFactionOperatorKey,
  getOperatorSpec,
  getFactionPairOperators,
  resolveCombatantSheet
} from '../../entities/operators/OperatorCatalog.js';

const FACTION_OPERATOR_SWAP_COLORS = {
  cv: 0xdc2626,
  pcc: 0x2563eb,
  ares: 0x9333ea
};

const CLASSIC_HERO_SWAP_COLORS = {
  caveira: 0xe2e8f0,
  solaris: 0xf97316,
  tita: 0xef4444,
  vingador: 0x94a3b8,
  sombra: 0xff1e42,
  turbo: 0x22d3ee,
  voltaico: 0x38bdf8,
  vortex: 0xa855f7,
  boss_cv: 0xdc2626,
  boss_pcc: 0x2563eb,
  boss_ares: 0x9333ea,
  op09: 0x00f0ff
};

export const heroSelectionAndShortcutsMethods = {
  /**
   * Troca instantaneamente entre os Operadores de Facção (CV, PCC, A.R.E.S.), Heróis Extras Clássicos e OP-09
   */
  switchToHero(heroKey, forceRefresh = false) {
    if (!forceRefresh && this.minifigure.currentHeroKey === heroKey && heroKey !== 'op09') return;

    // Limpa estados especiais do personagem anterior
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

    // Se trocou para qualquer personagem terrestre no meio do voo, desativa voo e entra em queda livre imediata!
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

    const opSpec = isFactionOperatorKey(heroKey) ? getOperatorSpec(heroKey) : null;
    const opFaction =
      opSpec?.faction ||
      (String(heroKey).startsWith('pcc') ? 'pcc' : String(heroKey).startsWith('ares') ? 'ares' : 'cv');
    const swapHex = isFactionOperatorKey(heroKey)
      ? (FACTION_OPERATOR_SWAP_COLORS[opFaction] || 0xdc2626)
      : (CLASSIC_HERO_SWAP_COLORS[heroKey] || 0x94a3b8);

    if (this.destructibles) {
      this.destructibles.updateSolarBeam(false);
      this.destructibles.spawnHeroSwapEffect(this.position, swapHex);
    }

    const activeFaction = this.hud?.playerFaction || this.world?.livingCity?.playerFaction || 'cv';
    if (typeof this.world?.livingCity?.syncPlayerCharacterStats === 'function') {
      this.world.livingCity.syncPlayerCharacterStats(heroKey, activeFaction);
    } else {
      const sheet = resolveCombatantSheet(heroKey, activeFaction);
      if (sheet) {
        this.hud?.setPlayerHealth?.(sheet.hp, sheet.hp, false);
      }
    }

    if (this.hud) {
      const pKey = preset?.key || heroKey;
      const pName = preset?.name || opSpec?.name || heroKey;
      const pSub = preset?.subtitle || opSpec?.subtitle || '';
      this.hud.setCharacterPortrait(pKey, pName, pSub);
      if (this.hud.updateVingadorWeaponHud) {
        this.hud.updateVingadorWeaponHud(this.minifigure.vingadorWeapon || 'dual_smg', false);
      }
      this.hud.setCharacterCombatHudMode?.(heroKey);
    }

    this.operatorWeapons?.onCharacterSwitched?.(heroKey);
    this.operatorAbilities?.onCharacterSwitched?.(heroKey);
  },

  toggleHero() {
    const activeFaction = this.hud?.playerFaction || this.world?.livingCity?.playerFaction || 'cv';
    const pair = getFactionPairOperators(activeFaction);
    if (!Array.isArray(pair) || pair.length === 0) return;
    const firstKey = pair[0]?.key || pair[0];
    const secondKey = pair[1]?.key || pair[1] || firstKey;
    const next = this.minifigure.currentHeroKey === firstKey ? secondKey : firstKey;
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
      case 'Digit1': {
        if (isDown && !e.repeat) {
          const activeFaction = this.hud?.playerFaction || this.world?.livingCity?.playerFaction || 'cv';
          const pair = getFactionPairOperators(activeFaction);
          if (pair?.[0]) this.switchToHero(pair[0].key);
        }
        break;
      }
      case 'Digit2': {
        if (isDown && !e.repeat) {
          const activeFaction = this.hud?.playerFaction || this.world?.livingCity?.playerFaction || 'cv';
          const pair = getFactionPairOperators(activeFaction);
          if (pair?.[1]) this.switchToHero(pair[1].key);
        }
        break;
      }
      case 'KeyQ': {
        this.keys.turbo = isDown;
        const hero = this.minifigure.currentHeroKey;
        if (hero === 'turbo') {
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
        } else if (isFactionOperatorKey(hero)) {
          if (isDown && !e.repeat) {
            this.operatorAbilities?.triggerAbility('q');
          }
        } else if (hero === 'solaris') {
          if (isDown && !e.repeat) {
            this._startSolarisSupernovaCharge();
          } else if (!isDown) {
            this._releaseSolarisSupernovaCharge();
          }
        } else if (isDown && !e.repeat) {
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
          } else if (hero === 'boss_cv') {
            this._triggerBossCvBarrage();
          } else if (hero === 'boss_pcc') {
            this._throwCaveiraGrenade();
          } else if (hero === 'boss_ares') {
            this._triggerBossAresCollapse();
          } else if (hero === 'op09') {
            this.customHeroPowers?.triggerSuperAbility();
          }
        }
        break;
      }
      case 'KeyE':
        if (isDown && !e.repeat) {
          const hero = this.minifigure.currentHeroKey;
          if (isFactionOperatorKey(hero)) {
            if (!this.currentVehicle) {
              this.operatorAbilities?.triggerAbility('e');
            }
          } else if (hero === 'turbo') {
            this._summonAndMountTurboGhostBike();
          } else if (!this.currentVehicle) {
            if (hero === 'caveira') {
              this._triggerTacticalRoll();
            } else if (hero === 'solaris') {
              if (this.isFlying) {
                this.isFlying = false;
                this.isSupersonic = false;
              } else {
                this._activateSolarisFlight();
              }
            } else if (hero === 'tita') {
              this._triggerTitaRocketPunch();
            } else if (hero === 'vingador') {
              this._cycleVingadorWeapon();
            } else if (hero === 'sombra') {
              this._triggerSombraGrapple();
            } else if (hero === 'voltaico') {
              this._triggerVoltaicoLightningBlink();
            } else if (hero === 'vortex') {
              this._toggleVortexMonsterForm();
            } else if (hero === 'boss_cv') {
              this._triggerBossCvWarCry();
            } else if (hero === 'boss_pcc') {
              this._triggerBossPccOvercharge();
            } else if (hero === 'boss_ares') {
              this._triggerTitaRocketPunch();
            } else if (hero === 'op09') {
              this.customHeroPowers?.triggerMobilityKey();
            }
          }
        }
        break;
      case 'KeyG':
        if (isDown && !e.repeat) {
          const hero = this.minifigure.currentHeroKey;
          if (isFactionOperatorKey(hero)) break;
          if (hero === 'turbo') {
            this._summonAndMountTurboGhostBike();
          } else if (!this.currentVehicle) {
            if (hero === 'tita') {
              this._toggleTitaCarGrabOrThrow();
            } else if (hero === 'vortex') {
              this._toggleVortexMonsterForm();
            } else if (hero === 'voltaico') {
              this._triggerVoltaicoLightningBlink();
            } else if (hero === 'caveira') {
              this.world?.livingCity?.triggerCaveiraRadioCommand(this.position, this.facingAngle);
            } else if (hero === 'sombra') {
              this._triggerSombraMagneticPull();
            } else if (hero === 'vingador') {
              this._cycleVingadorWeapon();
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
        if (isDown && !e.repeat && !this.currentVehicle) {
          const hero = this.minifigure.currentHeroKey;
          if (isFactionOperatorKey(hero)) {
            this.operatorWeapons?.startReload();
          } else if (hero === 'vingador') {
            this._cycleVingadorWeapon();
          } else if (hero === 'vortex') {
            this._toggleVortexMonsterForm();
          }
        }
        break;
    }
  }
};
