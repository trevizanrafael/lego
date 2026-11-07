import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Interpolação suave de ângulo pelo menor caminho (-PI a +PI)
 */
function lerpAngle(current, target, t) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

export class ThirdPersonController {
  constructor(camera, domElement, minifigure, world) {
    this.camera = camera;
    this.domElement = domElement;
    this.minifigure = minifigure;
    this.world = world;

    // Posição física e velocidade do boneco
    this.position = new THREE.Vector3(0, 0, 4);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.playerRadius = 0.42;
    this.isGrounded = true;
    this.facingAngle = Math.PI; // Começa olhando para o cruzamento (-Z)
    this.minifigure.root.rotation.y = this.facingAngle;

    // Parâmetros de locomoção
    this.walkSpeed = 6.8;
    this.runSpeed = 12.6;
    this.jumpForce = 10.8;
    this.gravity = -26.0;
    this.currentSpeed = 0;

    // Parâmetros da Câmera Orbital em 3ª Pessoa
    this.yaw = 0; // Atrás do boneco olhando para -Z
    this.pitch = 0.34;
    this.distance = 6.4;
    this.targetDistance = 6.4;
    this.cameraLookTarget = new THREE.Vector3(0, 1.55, 4);

    // Estado de Input
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false
    };
    this.isPointerLocked = false;
    this.isDraggingMouse = false;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));

    // Clique na tela ativa PointerLock para girar câmera 360° livremente
    this.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDraggingMouse = true;
        if (!document.pointerLockElement && this.domElement.requestPointerLock) {
          this.domElement.requestPointerLock();
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingMouse = false;
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
      this.pitch = THREE.MathUtils.clamp(
        this.pitch + e.movementY * sensitivity,
        0.04,
        1.25
      );
    });

    window.addEventListener(
      'wheel',
      (e) => {
        this.targetDistance = THREE.MathUtils.clamp(
          this.targetDistance + e.deltaY * 0.005,
          3.4,
          12.5
        );
      },
      { passive: true }
    );
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
      case 'Space':
        if (isDown && this.isGrounded) {
          this.velocity.y = this.jumpForce;
          this.isGrounded = false;
        }
        this.keys.jump = isDown;
        break;
      case 'KeyC':
        if (isDown && !e.repeat) {
          const newName = this.minifigure.cyclePreset();
          const stateEl = document.getElementById('anim-state');
          if (stateEl) {
            stateEl.textContent = `VISUAL: ${newName.toUpperCase()}`;
          }
        }
        break;
    }
  }

  update(dt) {
    // 1. Vetores direcionais baseados no ângulo horizontal (Yaw) da câmera
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

    const targetMaxSpeed = this.keys.sprint ? this.runSpeed : this.walkSpeed;
    const targetSpeed = hasInput ? targetMaxSpeed : 0;

    // Aceleração e desaceleração responsivas
    const accelRate = hasInput ? 18.0 : 22.0;
    this.currentSpeed = THREE.MathUtils.lerp(
      this.currentSpeed,
      targetSpeed,
      Math.min(1, dt * accelRate)
    );

    if (hasInput) {
      this.velocity.x = moveInput.x * this.currentSpeed;
      this.velocity.z = moveInput.z * this.currentSpeed;

      // Rotaciona o boneco suavemente na direção do movimento (+Z local é a frente do boneco)
      const desiredAngle = Math.atan2(moveInput.x, moveInput.z);
      this.facingAngle = lerpAngle(this.facingAngle, desiredAngle, Math.min(1, dt * 16));
      this.minifigure.root.rotation.y = this.facingAngle;
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, Math.min(1, dt * 18));
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, Math.min(1, dt * 18));
    }

    // 2. Gravidade e Movimento Vertical
    this.velocity.y += this.gravity * dt;

    // 3. Resolução de Colisões (Eixo X, Eixo Z e Altura do Piso/Carros/Calçada)
    this._moveAndCollide(dt);

    // Limita às bordas do quarteirão de teste
    this.position.x = THREE.MathUtils.clamp(this.position.x, -95, 95);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -95, 95);

    // Sincroniza posição do boneco 3D
    this.minifigure.root.position.copy(this.position);

    // 4. Atualiza animações articuladas da Minifigura
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.minifigure.updateAnimation(
      dt,
      horizontalSpeed,
      this.runSpeed,
      this.isGrounded,
      this.velocity.y
    );

    // 5. Atualiza Câmera em 3ª Pessoa
    this._updateCamera(dt);
  }

  _moveAndCollide(dt) {
    const r = this.playerRadius;
    const stepUpHeight = 0.32; // Sobe automaticamente meio-fio de calçada (0.26m)

    // Move X e verifica bloqueios laterais
    const nextX = this.position.x + this.velocity.x * dt;
    let blockedX = false;
    for (const col of this.world.colliders) {
      if (
        nextX + r > col.minX &&
        nextX - r < col.maxX &&
        this.position.z + r > col.minZ &&
        this.position.z - r < col.maxZ
      ) {
        // Se o obstáculo é mais alto do que a altura atual + degrau de calçada, bloqueia X
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

    // Move Z e verifica bloqueios frontais/traseiros
    const nextZ = this.position.z + this.velocity.z * dt;
    let blockedZ = false;
    for (const col of this.world.colliders) {
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

    // Calcula a altura do piso/superfície abaixo do boneco (asfalto = 0, calçadas = 0.26, capô/teto de carros, caixas)
    let supportY = 0;
    for (const col of this.world.colliders) {
      if (
        this.position.x + r * 0.85 > col.minX &&
        this.position.x - r * 0.85 < col.maxX &&
        this.position.z + r * 0.85 > col.minZ &&
        this.position.z - r * 0.85 < col.maxZ
      ) {
        // Considera como superfície válida se o boneco já estava acima dela ou se é um degrau baixo (calçada)
        if (this.position.y + stepUpHeight >= col.maxY && col.maxY > supportY) {
          supportY = col.maxY;
        }
      }
    }

    // Aplica deslocamento vertical
    this.position.y += this.velocity.y * dt;

    if (this.position.y <= supportY) {
      this.position.y = supportY;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }
  }

  _updateCamera(dt) {
    this.distance = THREE.MathUtils.lerp(
      this.distance,
      this.targetDistance,
      Math.min(1, dt * 12)
    );

    const desiredTarget = new THREE.Vector3(
      this.position.x,
      this.position.y + 1.55,
      this.position.z
    );
    this.cameraLookTarget.lerp(desiredTarget, Math.min(1, dt * 18));

    const horizDist = this.distance * Math.cos(this.pitch);
    const vertDist = this.distance * Math.sin(this.pitch);

    const camX = this.cameraLookTarget.x + Math.sin(this.yaw) * horizDist;
    const camZ = this.cameraLookTarget.z + Math.cos(this.yaw) * horizDist;
    const camY = Math.max(0.45, this.cameraLookTarget.y + vertDist);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.cameraLookTarget);
  }
}

