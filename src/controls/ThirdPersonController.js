import * as THREE from 'three';
import { soundFX } from '../audio/SoundFX.js';

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
    this.flyHoverSpeed = 16.5;
    this.flyCometSpeed = 38.0;
    this.jumpForce = 11.0;
    this.gravity = -26.0;
    this.currentSpeed = 0;

    // Estado de Voo (Solaris) e Rolamento (Caveira)
    this.isFlying = false;
    this.isSupersonic = false;
    this.flightPitch = 0;
    this.flightBank = 0;
    this.lastYaw = 0;
    this.lastSpacePressTime = 0;
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
    this.rocketPunchTimer = 0;
    this.rocketPunchDir = new THREE.Vector3(0, 0, -1);
    this.cameraShakeTimer = 0;
    this.grappleState = null; // { anchor: Vector3, timer: number }
    this.stealthTimer = 0;
    this._initGrappleCableMesh();

    this._bindEvents();
  }

  _initGrappleCableMesh() {
    if (!this.world?.scene) return;
    const cableGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 8);
    cableGeo.translate(0, 0.5, 0);
    cableGeo.rotateX(Math.PI / 2);
    const cableMat = new THREE.MeshBasicMaterial({
      color: 0xff1e42
    });
    this.grappleCableMesh = new THREE.Mesh(cableGeo, cableMat);
    this.grappleCableMesh.visible = false;
    this.world.scene.add(this.grappleCableMesh);

    const anchorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.grappleAnchorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), anchorMat);
    this.grappleAnchorMesh.visible = false;
    this.world.scene.add(this.grappleAnchorMesh);
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.domElement.addEventListener('mousedown', (e) => {
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
        if (this.currentVehicle) {
          this._fireVehicleWeapon();
        } else {
          this._firePrimaryAction();
        }
      } else if (e.button === 2) {
        this.mouseButtons.right = true;
        if (!this.currentVehicle) {
          const hero = this.minifigure.currentHeroKey;
          if (hero === 'caveira') {
            this._throwCaveiraGrenade();
          } else if (hero === 'tita') {
            this._toggleTitaCarGrabOrThrow();
          } else if (hero === 'vingador') {
            this._cycleVingadorWeapon();
          } else if (hero === 'sombra') {
            this._triggerSombraGrapple();
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

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
      if (this.isPointerLocked) {
        this.hasEnteredGame = true;
      }
      const promptEl = document.getElementById('pointer-prompt');
      if (promptEl) {
        // Nunca reexibe o prompt de clique depois que o jogador já entrou no jogo ou enquanto o mapa está aberto
        const shouldShowPrompt =
          !this.isPointerLocked &&
          !this.hasEnteredGame &&
          !this.hud?.isFullMapOpen &&
          !this.hud?.isDossierOpen &&
          !this.hud?.isHeroWheelOpen;
        promptEl.classList.toggle('visible', shouldShowPrompt);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.hud?.isFullMapOpen || this.hud?.isDossierOpen || this.fastTravelState?.active) return;
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
        // O scroll no Mapa [M] ou na lista lateral NUNCA deve alterar o zoom da câmera do personagem!
        if (this.hud?.isFullMapOpen || this.fastTravelState?.active) return;
        if (e.target && typeof e.target.closest === 'function' && e.target.closest('#fullmap-modal')) {
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
          res.catch(() => {});
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
    if (this.minifigure.currentHeroKey === heroKey) return;

    // Limpa estados especiais do herói anterior
    if (this.grabbedCar) {
      this._releaseGrabbedCarOnGround();
    }
    this._stopGrapple();
    this.stealthTimer = 0;
    this.titaSuperJumpActive = false;

    const preset = this.minifigure.setHero(heroKey);

    if (this.currentVehicle && this.minifigure.setSeatedInVehicle) {
      this.minifigure.setSeatedInVehicle(true, this.vehicleSteerAngle);
    }

    // Se trocou para qualquer herói terrestre no meio do voo, desativa voo e entra em queda livre imediata!
    if (heroKey !== 'solaris' && this.isFlying) {
      this.isFlying = false;
      this.isSupersonic = false;
      this.velocity.y = Math.min(0, this.velocity.y);
    }

    const swapColors = {
      caveira: 0xfacc15,
      solaris: 0xf97316,
      tita: 0x00f0ff,
      vingador: 0x94a3b8,
      sombra: 0xff1e42
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
    }
  }

  toggleHero() {
    const heroOrder = ['caveira', 'solaris', 'tita', 'vingador', 'sombra'];
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
      this.primaryCooldown = 0.095; // Metralhadora Rotativa Pesada do Titã Blindado!
      const muzzlePos = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 1.45 + rightVec.x * 0.78,
        this.position.y + 1.95,
        this.position.z + Math.cos(this.facingAngle) * 1.45 + rightVec.z * 0.78
      );
      this.destructibles.spawnTitaRotaryBullet(muzzlePos, aimData.point);
    } else if (hero === 'vingador') {
      this.minifigure.triggerShoot();
      const wKey = this.minifigure.vingadorWeapon || 'dual_smg';
      if (wKey === 'dual_smg') {
        this.primaryCooldown = 0.09;
        const leftMuzzle = new THREE.Vector3(
          this.position.x + Math.sin(this.facingAngle) * 0.9 - rightVec.x * 0.48,
          this.position.y + 1.28,
          this.position.z + Math.cos(this.facingAngle) * 0.9 - rightVec.z * 0.48
        );
        const rightMuzzle = new THREE.Vector3(
          this.position.x + Math.sin(this.facingAngle) * 0.9 + rightVec.x * 0.48,
          this.position.y + 1.28,
          this.position.z + Math.cos(this.facingAngle) * 0.9 + rightVec.z * 0.48
        );
        this.destructibles.spawnDualSmgBullets(leftMuzzle, rightMuzzle, aimData.point);
      } else if (wKey === 'shotgun') {
        this.primaryCooldown = 0.46;
        const muzzlePos = new THREE.Vector3(
          this.position.x + Math.sin(this.facingAngle) * 1.05 + rightVec.x * 0.45,
          this.position.y + 1.28,
          this.position.z + Math.cos(this.facingAngle) * 1.05 + rightVec.z * 0.45
        );
        this.destructibles.spawnShotgunBlast(muzzlePos, aimData.point);
      } else {
        this.primaryCooldown = 0.78;
        const muzzlePos = new THREE.Vector3(
          this.position.x + Math.sin(this.facingAngle) * 1.15 + rightVec.x * 0.5,
          this.position.y + 1.38,
          this.position.z + Math.cos(this.facingAngle) * 1.15 + rightVec.z * 0.5
        );
        this.destructibles.spawnRpgRocket(muzzlePos, aimData.point);
      }
    } else if (hero === 'sombra') {
      // Corte Duplo de Katanas Energizadas Escarlates
      this.primaryCooldown = 0.22;
      this.minifigure.triggerPunch();
      this.destructibles.performKatanaSlash(this.position, this.facingAngle);
    }
  }

  /**
   * Dispara armas acopladas aos veículos (Moto 600cc CV, Picape Artilhada CV, Hover-APC A.R.E.S. e Tanque Titan-M1)
   */
  _fireVehicleWeapon() {
    if (this.primaryCooldown > 0 || !this.currentVehicle || !this.destructibles) return;
    const carObj = this.currentVehicle;
    const spec = carObj.mesh.userData?.vehicleSpec;
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
   * Arremesso de Granada Explosiva / Impulso estilo Raze (Clique Direito / E):
   * Explode no impacto com qualquer superfície e impulsiona o Caveira se estourar perto!
   */
  _throwCaveiraGrenade() {
    if (this.secondaryCooldown > 0) return;
    this.secondaryCooldown = 0.36; // Cooldown ágil para permitir Double Satchel no ar!

    this._alignCharacterToCrosshair();
    this.minifigure.triggerPunch();

    if (this.destructibles) {
      const aimData = this.destructibles.getAimTargetPoint(this.camera, 80);
      const origin = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 0.55,
        this.position.y + 1.15,
        this.position.z + Math.cos(this.facingAngle) * 0.55
      );
      this.destructibles.throwGrenade(
        origin,
        aimData.point,
        this.world ? this.world.colliders : [],
        (blastPos) => this.applyBlastImpulse(blastPos)
      );
    }
  }

  /**
   * Impulso de Mobilidade estilo Raze do Valorant quando a granada explode perto do jogador!
   */
  applyBlastImpulse(blastPos) {
    const playerCenter = new THREE.Vector3(
      this.position.x,
      this.position.y + 0.9,
      this.position.z
    );
    const dist = playerCenter.distanceTo(blastPos);
    const maxBlastJumpRadius = 7.8;

    if (dist > maxBlastJumpRadius) return;

    const power = THREE.MathUtils.clamp(1.2 - dist / 9.0, 0.52, 1.08);

    // Forte impulso vertical para subir em prédios ou cruzar a rua voando!
    this.velocity.y = 19.5 * power;
    this.isGrounded = false;

    // Impulso horizontal combinando repulsão da bomba + direção para onde o jogador está indo/olhando
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

    const pushDir = awayHoriz.multiplyScalar(0.55).add(lookHoriz.multiplyScalar(0.85)).normalize();
    const horizBoostSpeed = 18.5 * power;

    this.blastVelocity.set(pushDir.x * horizBoostSpeed, 0, pushDir.z * horizBoostSpeed);
    this.blastJumpTimer = 0.72;
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
   * Explosão Supernova em área do Solaris (Q / F)
   */
  _triggerSolarisSupernova() {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 1.2;
    this.minifigure.triggerPunch();
    if (this.destructibles) {
      this.destructibles.triggerSupernova(this.position);
    }
  }

  /**
   * HERÓI #3 (Titã Blindado): Soco Foguete [V] que estoura Paredes Rachadas!
   */
  _triggerTitaRocketPunch() {
    if (this.secondaryCooldown > 0) return;
    this.secondaryCooldown = 0.55;
    this._alignCharacterToCrosshair();
    this.minifigure.triggerPunch();
    this.rocketPunchTimer = 0.26;
    this.rocketPunchDir.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle)).normalize();
    this.cameraShakeTimer = 0.28;
    if (this.destructibles) {
      this.destructibles.triggerTitaRocketPunch(this.position, this.facingAngle);
    }
  }

  /**
   * HERÓI #3 (Titã Blindado): Terremoto de Escudo [Q]
   */
  _triggerTitaEarthquake() {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 1.1;
    this.minifigure.triggerPunch();
    this.cameraShakeTimer = 0.42;
    if (this.destructibles) {
      this.destructibles.triggerTitaGroundSlam(this.position, 12.5, 115);
    }
  }

  /**
   * HERÓI #3 (Titã Blindado): Agarrar um carro da rua acima da cabeça ou Arremessar [Clique Direito / G]
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
        this.position.x + Math.sin(this.facingAngle) * 1.4,
        this.position.y + 3.4,
        this.position.z + Math.cos(this.facingAngle) * 1.4
      );
      this.destructibles.throwGrabbedCar(
        carToThrow,
        throwOrigin,
        aimData.point,
        this.world ? this.world.colliders : []
      );
      return;
    }

    // Busca carro terrestre próximo para levantar com as duas mãos colossais
    let bestCar = null;
    let bestDist = 7.2;
    for (const obj of this.destructibles.objects) {
      if (obj.destroyed || obj.type !== 'car' || obj.isDriven) continue;
      const spec = obj.mesh.userData?.vehicleSpec;
      if (spec?.isColossalShip || spec?.isHeavyTruck || (spec?.category && spec.category !== 'car')) continue;
      const d = Math.hypot(obj.mesh.position.x - this.position.x, obj.mesh.position.z - this.position.z);
      if (d < bestDist && Math.abs(obj.mesh.position.y - this.position.y) < 4.0) {
        bestDist = d;
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
      // Se não houver carro colado, executa o Soco Foguete!
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
    const dropY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(dropX, dropZ) : 0;
    car.mesh.position.set(dropX, dropY, dropZ);
    car.mesh.rotation.set(0, this.facingAngle, 0);
    car.basePos.copy(car.mesh.position);
    car.baseRot.copy(car.mesh.rotation);
    for (const col of car.colliders) {
      col.disabled = false;
    }
  }

  /**
   * HERÓI #4 (Vingador de Chumbo): Alterna entre as 3 Armas 3D ([R] ou [Clique Direito])
   */
  _cycleVingadorWeapon() {
    const order = ['dual_smg', 'shotgun', 'rpg'];
    const labels = {
      dual_smg: 'ARMA ATIVA: DUAS SUBMETRALHADORAS [R PARA TROCAR]',
      shotgun: 'ARMA ATIVA: ESCOPETA DE IMPACTO [R PARA TROCAR]',
      rpg: 'ARMA ATIVA: BAZUCA RPG ANTI-PRATA [R PARA TROCAR]'
    };
    const cur = this.minifigure.vingadorWeapon || 'dual_smg';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    this.minifigure.setVingadorWeapon(next);
    soundFX.playHeroSwap();
    if (this.hud) {
      this.hud.setCharacterPortrait('vingador', 'VINGADOR DE CHUMBO', labels[next]);
    }
  }

  /**
   * HERÓI #5 (Sombra Escarlate): Gancho Magnético [Clique Direito / F] para balançar pelos prédios!
   */
  _triggerSombraGrapple() {
    if (this.grappleState) {
      this._stopGrapple();
      return;
    }

    const aimDir = this._alignCharacterToCrosshair();
    const rayOrigin = this.camera.position.clone();
    let bestAnchor = null;
    let bestT = 115.0;

    // 1. Procura topo/quina de prédio ou estrutura na direção da mira
    if (this.world?.colliders) {
      for (const col of this.world.colliders) {
        if (col.disabled || col.maxY < this.position.y + 4.5) continue;
        const cx = (col.minX + col.maxX) * 0.5;
        const cz = (col.minZ + col.maxZ) * 0.5;
        const targetY = Math.min(col.maxY, Math.max(this.position.y + 12.0, rayOrigin.y + aimDir.y * 45.0));
        const candidate = new THREE.Vector3(cx, targetY, cz);
        const toCand = candidate.clone().sub(rayOrigin);
        const dist = toCand.length();
        if (dist < 8.0 || dist > bestT) continue;
        const align = toCand.normalize().dot(aimDir);
        if (align > 0.78) {
          bestT = dist;
          bestAnchor = new THREE.Vector3(
            THREE.MathUtils.clamp(rayOrigin.x + aimDir.x * dist, col.minX, col.maxX),
            Math.min(col.maxY + 0.5, Math.max(8.0, rayOrigin.y + aimDir.y * dist + 8.0)),
            THREE.MathUtils.clamp(rayOrigin.z + aimDir.z * dist, col.minZ, col.maxZ)
          );
        }
      }
    }

    // 2. Fallback: se apontou pro alto/frente entre avenidas, ancora num ponto aéreo elevado a 42m de distância!
    if (!bestAnchor) {
      const pitchUp = Math.max(0.28, aimDir.y);
      bestAnchor = new THREE.Vector3(
        this.position.x + aimDir.x * 44.0,
        this.position.y + Math.max(18.0, pitchUp * 46.0),
        this.position.z + aimDir.z * 44.0
      );
    }

    this.grappleState = {
      anchor: bestAnchor,
      timer: 1.45
    };
    this.isGrounded = false;
    this.velocity.y = Math.max(this.velocity.y, 11.5);
    this.minifigure.isGrappling = true;
    soundFX.playTacticalRoll();
  }

  _stopGrapple() {
    this.grappleState = null;
    if (this.minifigure) {
      this.minifigure.isGrappling = false;
    }
    if (this.grappleCableMesh) this.grappleCableMesh.visible = false;
    if (this.grappleAnchorMesh) this.grappleAnchorMesh.visible = false;
  }

  /**
   * HERÓI #5 (Sombra Escarlate): Bomba de Fumaça & Invisibilidade Furtiva [Q]
   */
  _triggerSombraSmokeBomb() {
    if (this.supernovaCooldown > 0) return;
    this.supernovaCooldown = 1.2;
    this.stealthTimer = 6.5;
    this.minifigure.setStealthVisual(true);
    if (this.destructibles) {
      this.destructibles.spawnSmokeBombCloud(this.position);
    }
    if (this.hud) {
      this.hud.setCharacterPortrait(
        'sombra',
        'SOMBRA ESCARLATE [FURTIVO]',
        'INVISIBILIDADE ATIVA (IGNORA LASERS DO BANCO!)'
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

  _onKey(e, isDown) {
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
          }
        }
        break;
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = isDown;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = isDown;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = isDown;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = isDown;
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
        if (isDown && !e.repeat && this.minifigure.currentHeroKey === 'caveira' && this.isGrounded) {
          this._triggerTacticalRoll();
        }
        break;
      case 'Space':
        if (isDown && !e.repeat) {
          const now = performance.now();
          const deltaTap = now - this.lastSpacePressTime;
          this.lastSpacePressTime = now;

          if (this.grappleState) {
            // Pular durante o Gancho Magnético solta o cabo com impulso acrobático extra!
            this._stopGrapple();
            this.velocity.y = 14.5;
          } else if (this.minifigure.currentHeroKey === 'solaris' && deltaTap < 360) {
            // Se estiver com o Solaris, 2x Espaço ativa/desativa o Voo (Hover)!
            this.isFlying = !this.isFlying;
            if (this.isFlying) {
              this.isGrounded = false;
              this.velocity.y = 4.5;
              if (this.position.y < 1.2) {
                this.position.y += 0.4;
              }
            } else {
              this.isSupersonic = false;
            }
          } else if (this.isGrounded && !this.isFlying) {
            if (this.minifigure.currentHeroKey === 'tita') {
              // Superpulo Pesado do Titã Blindado (explode o chão ao pousar!)
              this.velocity.y = 16.5;
              this.titaSuperJumpActive = true;
            } else {
              this.velocity.y = this.jumpForce;
            }
            this.isGrounded = false;
          }
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
      case 'KeyE':
        // [E] é dedicado a Entrar / Sair do Carro quando próximo!
        if (isDown && !e.repeat) {
          this.toggleVehicleInteraction();
        }
        break;
      case 'KeyQ':
        this.keys.turbo = isDown;
        if (this.currentVehicle) {
          // No carro: Q aciona TURBO e cancela o Drift (só pode Drift OU Turbo, nunca os dois juntos!)
          if (isDown) {
            this.keys.sprint = false;
            this.isDrifting = false;
          }
        } else if (isDown && !e.repeat) {
          const hero = this.minifigure.currentHeroKey;
          if (hero === 'caveira') {
            this._triggerTacticalRoll();
          } else if (hero === 'solaris') {
            this._triggerSolarisSupernova();
          } else if (hero === 'tita') {
            this._triggerTitaEarthquake();
          } else if (hero === 'vingador') {
            this._throwCaveiraGrenade();
          } else if (hero === 'sombra') {
            this._triggerSombraSmokeBomb();
          }
        }
        break;
      case 'KeyF':
        if (isDown && !e.repeat) {
          if (this.currentVehicle || this.findNearbyVehicle()) {
            this.toggleVehicleInteraction();
          } else {
            const hero = this.minifigure.currentHeroKey;
            if (hero === 'caveira') {
              this._triggerTacticalRoll();
            } else if (hero === 'solaris') {
              this._triggerSolarisSupernova();
            } else if (hero === 'tita') {
              this._toggleTitaCarGrabOrThrow();
            } else if (hero === 'vingador') {
              this._cycleVingadorWeapon();
            } else if (hero === 'sombra') {
              this._triggerSombraGrapple();
            }
          }
        }
        break;
      case 'KeyG':
        if (isDown && !e.repeat && !this.currentVehicle) {
          const hero = this.minifigure.currentHeroKey;
          if (hero === 'tita') {
            this._toggleTitaCarGrabOrThrow();
          } else if (hero === 'sombra') {
            this._triggerSombraMagneticPull();
          } else if (hero === 'vingador') {
            this._cycleVingadorWeapon();
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
              this.destructibles.performKatanaSlash(this.position, this.facingAngle);
            }
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
          } else if (this.destructibles) {
            if (this.currentVehicle) {
              this.exitVehicle();
            }
            this.destructibles.rebuildAll();
          }
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
   * Alterna entre entrar no veículo mais próximo, usar o Elevador Quântico da Torre dos Heróis ou sair do veículo atual ao apertar [E]
   */
  toggleVehicleInteraction() {
    if (this.currentVehicle) {
      this.exitVehicle();
      return true;
    }
    const car = this.findNearbyVehicle();
    if (car) {
      this.enterVehicle(car);
      return true;
    }
    const elev = this._findNearbyHeroElevator();
    if (elev) {
      this.position.set(elev.target.x, elev.target.y, elev.target.z);
      this.velocity.set(0, 0, 0);
      this.currentSpeed = 0;
      this.isGrounded = true;
      this.minifigure.root.position.copy(this.position);
      soundFX.playStudCollect(1000);
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
    this.vehiclePitch = 0;
    this.vehicleWheeliePitch = 0;
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
    this.vehicleBank = 0;

    // Esconde chamas de Turbo e zera inclinação ao sair (pousando a roda dianteira da moto no chão)
    carObj.mesh.rotation.x = 0;
    carObj.mesh.rotation.z = 0;
    if (category === 'car') {
      const restedY = this.world?.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(carObj.mesh.position.x, carObj.mesh.position.z)
        : (carObj.groundY ?? 0);
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
    let exitY = Math.max(carPos.y, this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(exitX, exitZ) : 0);

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

    // Quando estiver dirigindo, oculta a linha de texto inferior (o Velocímetro Tático fica no canto superior direito!)
    if (this.currentVehicle) {
      this.vehiclePromptEl.classList.add('hidden');
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
        this.vehiclePromptEl.classList.add('hidden');
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
    const accel = this.isTurboActive ? spec.accel * 1.95 : spec.accel;
    const brakeDecel = 38.0;
    const coastFriction = this.isDrifting ? 11.5 : 9.0;

    // Motos (CV, PCC e Polícia): Espaço empina a moto na roda traseira em vez de frear!
    const isDoingWheelie = Boolean(
      spec.canWheelie && this.keys.jump && (this.keys.forward || this.isTurboActive || this.vehicleSpeed >= 0)
    );

    if (this.keys.jump && !spec.canWheelie) {
      // Freio de mão (Espaço — para carros e caminhões)
      this.vehicleSpeed = THREE.MathUtils.lerp(this.vehicleSpeed, 0, Math.min(1, dt * 8.5));
    } else if (this.keys.forward || this.isTurboActive || isDoingWheelie) {
      const rate = this.vehicleSpeed < 0 ? brakeDecel : accel;
      this.vehicleSpeed = Math.min(maxForward, this.vehicleSpeed + rate * dt);
    } else if (this.keys.backward) {
      const rate = this.vehicleSpeed > 0 ? brakeDecel : accel * 0.85;
      this.vehicleSpeed = Math.max(maxReverse, this.vehicleSpeed - rate * dt);
    } else {
      if (Math.abs(this.vehicleSpeed) < 0.25) {
        this.vehicleSpeed = 0;
      } else {
        this.vehicleSpeed -= Math.sign(this.vehicleSpeed) * coastFriction * dt;
      }
      if (this.vehicleSpeed > maxForward) {
        this.vehicleSpeed = THREE.MathUtils.lerp(this.vehicleSpeed, maxForward, Math.min(1, dt * 6));
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

    this.velocity.x = forwardX * this.vehicleSpeed;
    this.velocity.z = forwardZ * this.vehicleSpeed;
    this.velocity.y = 0;

    // Move e verifica colisão com prédios/paredes
    const carRadius = 1.45;
    const curX = carObj.mesh.position.x;
    const curZ = carObj.mesh.position.z;
    const nextX = THREE.MathUtils.clamp(curX + this.velocity.x * dt, -2200, 2200);
    const nextZ = THREE.MathUtils.clamp(curZ + this.velocity.z * dt, -1500, 1700);

    // Atropelamento de objetos quebráveis de rua e colisão com outros carros!
    const isUnstoppable = spec.rammingPower === 'unstoppable';
    if (this.destructibles && Math.abs(this.vehicleSpeed) > 3.5) {
      for (const obj of this.destructibles.objects) {
        if (obj.destroyed || obj === carObj) continue;
        // Só atropela objetos no nível da rua
        if ((obj.groundY ?? 0) > 2.5) continue;
        // Não atropela portas de cofre, cofres de ouro maciços ou navios cargueiros colossais
        if (obj.type === 'bank_vault_door' || obj.type === 'gold_vault') continue;
        if (obj.mesh?.userData?.vehicleSpec?.isColossalShip) continue;

        const dx = obj.mesh.position.x - nextX;
        const dz = obj.mesh.position.z - nextZ;
        const dist = Math.hypot(dx, dz);
        if (dist < obj.radius + 1.85) {
          if (obj.type === 'car') {
            if (isUnstoppable) {
              // Caveirão do BOPE e Tanque Titan-M1 arremessam/destroem outros carros sem perder velocidade!
              this.destructibles.damageObject(
                obj,
                9999,
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

    // CARROS E VEÍCULOS TERRESTRES NÃO ANDAM NA ÁGUA PROFUNDA (Lago, Canais e Oceano)!
    const candTerrainYX = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(nextX, curZ) : 0;
    let blockedX = Boolean(this.world?.isDeepWaterAt?.(nextX, curZ, { forCar: true }));
    if (!blockedX) {
      for (const col of this.world.colliders) {
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

    const candTerrainYZ = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(finalX, nextZ) : 0;
    let blockedZ = Boolean(this.world?.isDeepWaterAt?.(finalX, nextZ, { forCar: true }));
    if (!blockedZ) {
      for (const col of this.world.colliders) {
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
      this.vehicleSpeed *= -0.25;
    }

    // Elevação contínua das 9 Pontes em Arco (bridgeY = 5.0 * sin(t * PI)) e inclinação suave do chassi
    const groundY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(finalX, finalZ) : 0;
    const aheadY = this.world?.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(finalX + forwardX * 2.0, finalZ + forwardZ * 2.0)
      : groundY;
    const roadSlopePitch = -Math.atan2(aheadY - groundY, 2.0);

    const isMoto = Boolean(
      spec.isMotorcycle || spec.id === 'moto_cv' || spec.id === 'moto_pcc' || spec.id === 'moto_policia'
    );
    const targetWheeliePitch = isDoingWheelie ? -0.52 : 0;
    this.vehicleWheeliePitch = THREE.MathUtils.lerp(
      this.vehicleWheeliePitch || 0,
      targetWheeliePitch,
      Math.min(1, dt * 12)
    );

    // Quando a moto empina (wheeliePitch < 0), o pivô é o contato do pneu traseiro (z = -rearAxleZ):
    // Elevamos o centro da moto em rearAxleZ * sin(|wheeliePitch|) para que a roda de trás fique 100% colada no asfalto (nunca afunde no chão!)
    const rearAxleZ = spec.rearAxleZ ?? 1.38;
    const wheelieAngle = Math.max(0, -this.vehicleWheeliePitch);
    const wheelieLiftY = isMoto ? rearAxleZ * Math.sin(wheelieAngle) : 0;

    const visualCarYaw = this.vehicleHeading + this.vehicleDriftAngle;
    const targetPitch = roadSlopePitch + this.vehicleWheeliePitch;
    carObj.mesh.rotation.order = 'YXZ';
    carObj.mesh.position.set(finalX, groundY + wheelieLiftY, finalZ);
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

    // Chamas de Nitro / Turbo nos escapamentos traseiros e faíscas de Drift nas rodas!
    const turboFlames = carObj.mesh.userData?.turboFlames;
    if (turboFlames) {
      const pulse = 0.85 + Math.sin(performance.now() * 0.05) * 0.3;
      for (const f of turboFlames) {
        f.visible = this.isTurboActive;
        if (this.isTurboActive) {
          f.scale.set(1, 1, pulse);
        }
      }
    }

    if (this.destructibles && (this.isTurboActive || (this.isDrifting && Math.abs(this.vehicleDriftAngle) > 0.08))) {
      this.driftParticleTimer -= dt;
      if (this.driftParticleTimer <= 0) {
        this.driftParticleTimer = 0.032;
        const rearX = finalX - Math.sin(visualCarYaw) * 2.2;
        const rearZ = finalZ - Math.cos(visualCarYaw) * 2.2;
        this.destructibles.spawnFlameTrailParticle(
          new THREE.Vector3(rearX, 0.35, rearZ),
          this.isTurboActive ? 1.25 : 0.85
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

    // Posiciona e inclina a minifigura junto com o veículo (em especial ao empinar a moto ou inclinar na curva!)
    const isOpenTop = Boolean(spec.openTop);
    const seatedY = spec.seatedYOffset ?? (isMoto ? 0.78 : isOpenTop ? 0.56 : 0.48);
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
    const riderWorldY = groundY + wheelieLiftY + y2;
    const riderWorldZ = finalZ - x2 * sinYaw + z2 * cosYaw;

    this.position.set(finalX, groundY + 0.25, finalZ);
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

    let blockedX = this.world?.isDeepWaterAt ? !this.world.isDeepWaterAt(nextX, curZ, { forBoat: true }) : false;
    if (!blockedX) {
      for (const col of this.world.colliders) {
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
      for (const col of this.world.colliders) {
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
      : (this.world?.getTerrainHeightAt?.(x, z) ?? 0);
    for (const col of this.world.colliders) {
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
        for (const col of this.world.colliders) {
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
    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);
    this.supernovaCooldown = Math.max(0, this.supernovaCooldown - dt);

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

    // Se estiver dirigindo um carro, processa a física veicular e retorna!
    if (this.currentVehicle) {
      this._updateVehicleDriving(dt, camRight);
      return;
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

    const moveInput = new THREE.Vector3();
    if (this.keys.forward) moveInput.add(camForward);
    if (this.keys.backward) moveInput.sub(camForward);
    if (this.keys.right) moveInput.add(camRight);
    if (this.keys.left) moveInput.sub(camRight);

    const hasInput = moveInput.lengthSq() > 0.001;
    if (hasInput) {
      moveInput.normalize();
    }

    // Lógica de Voo 3D (Solaris) vs Locomoção Terrestre
    if (this.isFlying && this.minifigure.currentHeroKey === 'solaris') {
      this.isSupersonic = hasInput && this.keys.sprint;
      const targetFlySpeed = this.isSupersonic ? this.flyCometSpeed : this.flyHoverSpeed;
      const targetSpeed = hasInput ? targetFlySpeed : 0;

      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, Math.min(1, dt * 12));

      // Calcula o banking (inclinação de asa de avião ao fazer curva no ar)
      const yawDelta = this.yaw - this.lastYaw;
      this.lastYaw = this.yaw;
      const strafeBank = (this.keys.left ? 0.45 : 0) + (this.keys.right ? -0.45 : 0);
      const targetBank = THREE.MathUtils.clamp(yawDelta * 14 + strafeBank, -0.85, 0.85);
      this.flightBank = THREE.MathUtils.lerp(this.flightBank, targetBank, Math.min(1, dt * 10));

      if (this.isSupersonic) {
        // MODO COMETA (ESTILO AVIÃO / JATO 3D):
        // O vetor de voo segue a direção 3D completa da câmera (incluindo Pitch para cima/baixo!)
        const camForward3D = new THREE.Vector3(
          -Math.sin(this.yaw) * Math.cos(this.pitch),
          -Math.sin(this.pitch),
          -Math.cos(this.yaw) * Math.cos(this.pitch)
        ).normalize();

        const flyDir3D = new THREE.Vector3();
        if (this.keys.forward) flyDir3D.add(camForward3D);
        if (this.keys.backward) flyDir3D.sub(camForward3D);
        if (this.keys.right) flyDir3D.add(camRight);
        if (this.keys.left) flyDir3D.sub(camRight);
        if (flyDir3D.lengthSq() > 0.001) flyDir3D.normalize();

        this.velocity.x = flyDir3D.x * this.currentSpeed;
        this.velocity.z = flyDir3D.z * this.currentSpeed;

        // Velocidade vertical guiada pelo Pitch da mira (olhou pra baixo -> mergulha; olhou pra cima -> sobe!)
        // E se segurar Espaço/Ctrl dá propulsão vertical direta
        let targetVy = flyDir3D.y * this.currentSpeed;
        if (this.keys.jump) targetVy = Math.max(0, targetVy) + 16.5;
        if (this.keys.descend) targetVy = Math.min(0, targetVy) - 16.5;
        this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetVy, Math.min(1, dt * 14));

        // Ângulo de inclinação vertical do corpo do Solaris (mergulho vs subida)
        const horizVel = Math.hypot(this.velocity.x, this.velocity.z);
        const targetPitchAngle = Math.atan2(this.velocity.y, Math.max(0.1, horizVel));
        this.flightPitch = THREE.MathUtils.lerp(this.flightPitch, targetPitchAngle, Math.min(1, dt * 14));

        const desiredAngle = Math.atan2(flyDir3D.x, flyDir3D.z);
        this.facingAngle = lerpAngle(this.facingAngle, desiredAngle, Math.min(1, dt * 16));
        this.minifigure.root.rotation.y = this.facingAngle;

        if (this.destructibles) {
          this.cometTrailTimer -= dt;
          if (this.cometTrailTimer <= 0) {
            this.cometTrailTimer = 0.022;
            this.destructibles.spawnFlameTrailParticle(
              new THREE.Vector3(this.position.x, this.position.y + 0.9, this.position.z),
              1.35
            );
          }
        }
      } else {
        // MODO HOVER (Levitação controlada):
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
          this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, Math.min(1, dt * 10));
          this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, Math.min(1, dt * 10));
        }

        // Subir (Espaço) e Descer (Ctrl / C) no Hover
        let targetVy = 0;
        if (this.keys.jump) targetVy += 14.5;
        if (this.keys.descend) targetVy -= 13.5;
        this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, targetVy, Math.min(1, dt * 12));
      }
    } else {
      this.isSupersonic = false;
      this.flightPitch = 0;
      this.flightBank = 0;
      this.lastYaw = this.yaw;

      if (this.rollImpulseTimer > 0) {
        this.rollImpulseTimer = Math.max(0, this.rollImpulseTimer - dt);
        const rollSpeed = 16.5;
        this.velocity.x = this.rollDir.x * rollSpeed;
        this.velocity.z = this.rollDir.z * rollSpeed;
      } else if (this.rocketPunchTimer > 0) {
        this.rocketPunchTimer = Math.max(0, this.rocketPunchTimer - dt);
        const punchBoost = 24.5;
        this.velocity.x = this.rocketPunchDir.x * punchBoost;
        this.velocity.z = this.rocketPunchDir.z * punchBoost;
      } else if (this.grappleState) {
        // Balanço e tração acrobática do Gancho Magnético do Sombra Escarlate!
        this.grappleState.timer -= dt;
        const handPos = new THREE.Vector3(this.position.x, this.position.y + 1.45, this.position.z);
        const toAnchor = this.grappleState.anchor.clone().sub(handPos);
        const dist = toAnchor.length();

        if (dist <= 3.2 || this.grappleState.timer <= 0) {
          this._stopGrapple();
          this.velocity.y = Math.max(this.velocity.y, 10.5);
        } else {
          const pullDir = toAnchor.normalize();
          const pullSpeed = 32.0;
          this.velocity.x = pullDir.x * pullSpeed + moveInput.x * 8.5;
          this.velocity.z = pullDir.z * pullSpeed + moveInput.z * 8.5;
          this.velocity.y = pullDir.y * pullSpeed + 4.5;
          this.facingAngle = Math.atan2(pullDir.x, pullDir.z);
          this.minifigure.root.rotation.y = this.facingAngle;

          if (this.grappleCableMesh && this.grappleAnchorMesh) {
            this.grappleCableMesh.visible = true;
            this.grappleCableMesh.position.copy(handPos);
            this.grappleCableMesh.lookAt(this.grappleState.anchor);
            this.grappleCableMesh.scale.set(1, 1, dist);
            this.grappleAnchorMesh.visible = true;
            this.grappleAnchorMesh.position.copy(this.grappleState.anchor);
          }
        }
      } else if (this.blastJumpTimer > 0 && !this.isGrounded) {
        this.blastJumpTimer = Math.max(0, this.blastJumpTimer - dt);
        // Preserva o impulso aéreo da granada (estilo Satchel da Raze) permitindo controle aéreo com WASD
        const airSteer = 6.5;
        this.velocity.x = this.blastVelocity.x + moveInput.x * airSteer;
        this.velocity.z = this.blastVelocity.z + moveInput.z * airSteer;
        this.blastVelocity.multiplyScalar(Math.max(0.85, 1 - dt * 1.4));
      } else {
        const stealthMult = this.stealthTimer > 0 ? 1.25 : 1.0;
        const targetMaxSpeed = (this.keys.sprint ? this.runSpeed : this.walkSpeed) * stealthMult;
        const targetSpeed = hasInput ? targetMaxSpeed : 0;

        const accelRate = hasInput ? 18.0 : 22.0;
        this.currentSpeed = THREE.MathUtils.lerp(
          this.currentSpeed,
          targetSpeed,
          Math.min(1, dt * accelRate)
        );

        if (hasInput) {
          this.velocity.x = moveInput.x * this.currentSpeed;
          this.velocity.z = moveInput.z * this.currentSpeed;

          if (!isUsingSolarBeam && !this.mouseButtons.left) {
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
            'GANCHO MAGNÉTICO [MOUSE 2] • KATANAS • FUMAÇA INVISÍVEL [Q]'
          );
        }
      }
    }

    const preLandVy = this.velocity.y;
    const wasInAir = !this.isGrounded && !this.isFlying;

    this._moveAndCollide(dt, moveInput);

    // Se o Comandante Caveira pousou no chão vindo de uma queda alta (ex: trocou do Solaris lá no alto!),
    // executa automaticamente o Rolamento Tático de impacto!
    if (
      wasInAir &&
      this.isGrounded &&
      this.minifigure.currentHeroKey === 'caveira' &&
      preLandVy < -13.5
    ) {
      this._triggerTacticalRoll(moveInput);
    }

    // Se o Titã Blindado pousou do Superpulo Pesado, treme a câmera e cria onda de choque sísmica!
    if (
      wasInAir &&
      this.isGrounded &&
      this.minifigure.currentHeroKey === 'tita' &&
      (this.titaSuperJumpActive || preLandVy < -11.5)
    ) {
      this.titaSuperJumpActive = false;
      this.cameraShakeTimer = 0.36;
      if (this.destructibles) {
        this.destructibles.triggerTitaGroundSlam(this.position, 9.5, 90);
      }
    }

    // Se o Titã Blindado estiver segurando um carro da rua, mantém o carro erguido acima da cabeça dele!
    if (this.grabbedCar && !this.grabbedCar.destroyed) {
      this.grabbedCar.mesh.position.set(
        this.position.x,
        this.position.y + 3.45,
        this.position.z
      );
      this.grabbedCar.mesh.rotation.set(0, this.facingAngle + Math.PI * 0.5, 0);
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, -2200, 2200);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -1500, 1700);
    this.position.y = THREE.MathUtils.clamp(this.position.y, -4.5, 560);

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

    const nextX = this.position.x + this.velocity.x * dt;
    let blockedX = false;
    for (const col of this.world.colliders) {
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
    for (const col of this.world.colliders) {
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

    const inDeepWater = Boolean(this.world?.isDeepWaterAt?.(this.position.x, this.position.z, { forCar: true }));
    let supportY = inDeepWater
      ? (this.world.getWaterSurfaceY(this.position.x, this.position.z) - 0.65)
      : (this.world?.getTerrainHeightAt?.(this.position.x, this.position.z) ?? 0);
    let ceilingY = Infinity;
    for (const col of this.world.colliders) {
      if (col.disabled) continue;
      if (
        this.position.x + r * 0.85 > col.minX &&
        this.position.x - r * 0.85 < col.maxX &&
        this.position.z + r * 0.85 > col.minZ &&
        this.position.z - r * 0.85 < col.maxZ
      ) {
        const colMinY = col.minY ?? 0;
        if (this.position.y + stepUpHeight >= col.maxY && col.maxY > supportY) {
          supportY = col.maxY;
        } else if (this.position.y + playerHeight <= colMinY + 0.4 && colMinY < ceilingY) {
          ceilingY = colMinY;
        }
      }
    }

    this.position.y += this.velocity.y * dt;

    // Impede atravessar tetos de interiores (como o teto do Super Banco Central) de baixo para cima
    if (this.position.y + playerHeight > ceilingY && this.velocity.y > 0) {
      this.position.y = ceilingY - playerHeight;
      this.velocity.y = 0;
    }

    const wasGroundedDownhill =
      this.isGrounded &&
      this.velocity.y <= 0 &&
      !this.isFlying &&
      this.position.y - supportY > 0 &&
      this.position.y - supportY < 0.9;

    if (this.position.y <= supportY || wasGroundedDownhill) {
      this.position.y = supportY;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.isSwimming = inDeepWater && supportY < 0;
      if (this.isFlying && this.keys.descend) {
        this.isFlying = false;
        this.isSupersonic = false;
      }
    } else {
      this.isGrounded = false;
      this.isSwimming = false;
    }
  }

  /**
   * Atualiza a Câmera Over-the-Shoulder (OTS) estilo Fortnite:
   * Desloca o foco para a direita (+camRight * shoulderOffset) para que o boneco fique
   * à esquerda da tela e o centro da mira (#crosshair) fique 100% livre!
   */
  _updateCamera(dt, camRight, isAimingBeam = false) {
    // FOV dinâmico (aumenta no Voo Supersônico de Cometa do Solaris e no Turbo Nitro [Q] dos Carros!)
    const desiredFov = (this.isSupersonic || this.isTurboActive) ? 74 : isAimingBeam ? 53 : this.baseFov;
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
