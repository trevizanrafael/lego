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

    this.position = new THREE.Vector3(0, 0, 4);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.playerRadius = 0.42;
    this.isGrounded = true;
    this.facingAngle = Math.PI;
    this.minifigure.root.rotation.y = this.facingAngle;

    // Parâmetros de locomoção terrestre e voo
    this.walkSpeed = 7.0;
    this.runSpeed = 12.8;
    this.flyHoverSpeed = 13.5;
    this.flyCometSpeed = 26.5;
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
      jump: false,
      descend: false,
      beamKey: false
    };
    this.mouseButtons = {
      left: false,
      right: false
    };
    this.isPointerLocked = false;
    this.isDraggingMouse = false;

    // Cooldowns de armas e poderes
    this.primaryCooldown = 0;
    this.secondaryCooldown = 0;
    this.supernovaCooldown = 0;
    this.cometTrailTimer = 0;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    this.domElement.addEventListener('mousedown', (e) => {
      if (!document.pointerLockElement && this.domElement.requestPointerLock) {
        this.domElement.requestPointerLock();
        if (e.button === 0) {
          this.isDraggingMouse = true;
          return;
        }
      }

      if (e.button === 0) {
        this.isDraggingMouse = true;
        this.mouseButtons.left = true;
        this._firePrimaryAction();
      } else if (e.button === 2) {
        this.mouseButtons.right = true;
        if (this.minifigure.currentHeroKey === 'caveira') {
          this._throwCaveiraGrenade();
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
      const promptEl = document.getElementById('pointer-prompt');
      if (promptEl) {
        promptEl.classList.toggle('visible', !this.isPointerLocked);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked && !this.isDraggingMouse) return;
      const sensitivity = 0.0032;
      this.yaw -= e.movementX * sensitivity;
      // Permite olhar bem para cima (-1.15 rad) ou mergulhar para baixo (+1.22 rad) estilo avião no voo
      const minPitch = this.isFlying ? -1.15 : -0.45;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + e.movementY * sensitivity,
        minPitch,
        1.22
      );
    });

    window.addEventListener(
      'wheel',
      (e) => {
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
   * Troca instantaneamente entre Comandante Caveira e Solaris (inclusive no ar!)
   */
  switchToHero(heroKey) {
    if (this.minifigure.currentHeroKey === heroKey) return;

    const preset = this.minifigure.setHero(heroKey);

    // Se trocou para o Comandante Caveira no meio do voo, desativa voo e entra em queda livre imediata!
    if (heroKey === 'caveira' && this.isFlying) {
      this.isFlying = false;
      this.isSupersonic = false;
      this.velocity.y = Math.min(0, this.velocity.y);
    }

    if (this.destructibles) {
      this.destructibles.updateSolarBeam(false);
      this.destructibles.spawnHeroSwapEffect(
        this.position,
        heroKey === 'solaris' ? 0xf97316 : 0xfacc15
      );
    }

    if (this.hud) {
      this.hud.setCharacterPortrait(preset.key, preset.name, preset.subtitle);
    }
  }

  toggleHero() {
    const next = this.minifigure.currentHeroKey === 'caveira' ? 'solaris' : 'caveira';
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
   * Clique Esquerdo: Fuzil Tático (Caveira) ou Bola de Fogo (Solaris)
   */
  _firePrimaryAction() {
    if (this.primaryCooldown > 0) return;

    this._alignCharacterToCrosshair();
    this.minifigure.triggerShoot();

    if (!this.destructibles) return;
    const aimData = this.destructibles.getAimTargetPoint(this.camera, 80);

    if (this.minifigure.currentHeroKey === 'caveira') {
      this.primaryCooldown = 0.11; // Metralhada rápida do Fuzil Tático
      // Posição da ponta do Fuzil Tático na mão direita do boneco
      const rightVec = new THREE.Vector3(
        -Math.cos(this.facingAngle),
        0,
        Math.sin(this.facingAngle)
      );
      const muzzlePos = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 0.95 + rightVec.x * 0.45,
        this.position.y + 1.28,
        this.position.z + Math.cos(this.facingAngle) * 0.95 + rightVec.z * 0.45
      );
      this.destructibles.spawnRifleBullet(muzzlePos, aimData.point);
    } else {
      this.primaryCooldown = 0.28; // Disparo de Bola de Fogo do Solaris
      const handPos = new THREE.Vector3(
        this.position.x + Math.sin(this.facingAngle) * 0.85,
        this.position.y + 1.32,
        this.position.z + Math.cos(this.facingAngle) * 0.85
      );
      this.destructibles.spawnFireball(handPos, aimData.point);
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

  _onKey(e, isDown) {
    switch (e.code) {
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

          // Se estiver com o Solaris, 2x Espaço ativa/desativa o Voo (Hover)!
          if (this.minifigure.currentHeroKey === 'solaris' && deltaTap < 360) {
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
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
          }
        }
        this.keys.jump = isDown;
        break;
      case 'Tab':
        e.preventDefault();
        if (isDown && !e.repeat) {
          this.toggleHero();
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
      case 'KeyE':
        this.keys.beamKey = isDown;
        if (isDown && !e.repeat && this.minifigure.currentHeroKey === 'caveira') {
          this._throwCaveiraGrenade();
        }
        break;
      case 'KeyQ':
      case 'KeyF':
        if (isDown && !e.repeat) {
          if (this.minifigure.currentHeroKey === 'caveira') {
            this._triggerTacticalRoll();
          } else {
            this._triggerSolarisSupernova();
          }
        }
        break;
      case 'KeyV':
        // Soco corpo a corpo rápido
        if (isDown && !e.repeat) {
          this.minifigure.triggerPunch();
          if (this.destructibles) {
            this.destructibles.performMeleeAttack(this.position, this.facingAngle, 2.7, 22);
          }
        }
        break;
      case 'KeyR':
        if (isDown && !e.repeat && this.destructibles) {
          this.destructibles.rebuildAll();
        }
        break;
      case 'KeyH':
        if (isDown && !e.repeat) {
          const controlsEl = document.getElementById('controls-hud');
          if (controlsEl) {
            controlsEl.classList.toggle('hidden');
          }
        }
        break;
    }
  }

  update(dt) {
    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);
    this.supernovaCooldown = Math.max(0, this.supernovaCooldown - dt);

    // Tiro automático enquanto segura o Clique Esquerdo
    if (this.mouseButtons.left && this.primaryCooldown <= 0) {
      this._firePrimaryAction();
    }

    // Raio Solar Contínuo do Solaris (Segurando Clique Direito ou E)
    const isUsingSolarBeam =
      this.minifigure.currentHeroKey === 'solaris' &&
      (this.mouseButtons.right || this.keys.beamKey);

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

    // Vetores de movimento baseados no Yaw da câmera
    const camForward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    ).normalize();
    const camRight = new THREE.Vector3().crossVectors(camForward, UP).normalize();

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
      } else if (this.blastJumpTimer > 0 && !this.isGrounded) {
        this.blastJumpTimer = Math.max(0, this.blastJumpTimer - dt);
        // Preserva o impulso aéreo da granada (estilo Satchel da Raze) permitindo controle aéreo com WASD
        const airSteer = 6.5;
        this.velocity.x = this.blastVelocity.x + moveInput.x * airSteer;
        this.velocity.z = this.blastVelocity.z + moveInput.z * airSteer;
        this.blastVelocity.multiplyScalar(Math.max(0.85, 1 - dt * 1.4));
      } else {
        const targetMaxSpeed = this.keys.sprint ? this.runSpeed : this.walkSpeed;
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

      this.velocity.y += this.gravity * dt;
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

    this.position.x = THREE.MathUtils.clamp(this.position.x, -95, 95);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -95, 95);
    this.position.y = THREE.MathUtils.clamp(this.position.y, 0, 85);

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

  _moveAndCollide(dt) {
    const r = this.playerRadius;
    const stepUpHeight = 0.32;

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
        if (this.position.y + stepUpHeight < col.maxY) {
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
        if (this.position.y + stepUpHeight < col.maxY) {
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

    let supportY = 0;
    for (const col of this.world.colliders) {
      if (col.disabled) continue;
      if (
        this.position.x + r * 0.85 > col.minX &&
        this.position.x - r * 0.85 < col.maxX &&
        this.position.z + r * 0.85 > col.minZ &&
        this.position.z - r * 0.85 < col.maxZ
      ) {
        if (this.position.y + stepUpHeight >= col.maxY && col.maxY > supportY) {
          supportY = col.maxY;
        }
      }
    }

    this.position.y += this.velocity.y * dt;

    if (this.position.y <= supportY) {
      this.position.y = supportY;
      this.velocity.y = 0;
      this.isGrounded = true;
      // Se estava descendo no voo e encostou no telhado/asfalto, pousa suavemente
      if (this.isFlying && this.keys.descend) {
        this.isFlying = false;
        this.isSupersonic = false;
      }
    } else {
      this.isGrounded = false;
    }
  }

  /**
   * Atualiza a Câmera Over-the-Shoulder (OTS) estilo Fortnite:
   * Desloca o foco para a direita (+camRight * shoulderOffset) para que o boneco fique
   * à esquerda da tela e o centro da mira (#crosshair) fique 100% livre!
   */
  _updateCamera(dt, camRight, isAimingBeam = false) {
    // FOV dinâmico (aumenta no Voo Supersônico de Cometa do Solaris!)
    const desiredFov = this.isSupersonic ? 74 : isAimingBeam ? 53 : this.baseFov;
    if (Math.abs(this.camera.fov - desiredFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, desiredFov, Math.min(1, dt * 10));
      this.camera.updateProjectionMatrix();
    }

    const effectiveTargetDist = this.isSupersonic
      ? this.targetDistance * 1.15
      : this.targetDistance;

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

    const horizDist = this.distance * Math.cos(this.pitch);
    const vertDist = this.distance * Math.sin(this.pitch);

    const camX = this.cameraLookTarget.x + Math.sin(this.yaw) * horizDist;
    const camZ = this.cameraLookTarget.z + Math.cos(this.yaw) * horizDist;
    const camY = Math.max(0.42, this.cameraLookTarget.y + vertDist);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.cameraLookTarget);
  }
}
