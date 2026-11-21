import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';

export const UP = new THREE.Vector3(0, 1, 0);

export function lerpAngle(current, target, t) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

export const cameraOrbitAndRigMethods = {
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
  },

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
  },

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
  },

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
  },

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
    const baseUserFov = THREE.MathUtils.clamp(
      Number(this.hud?.settings?.fov ?? this.baseFov ?? 58),
      50,
      85
    );
    const fovDelta = baseUserFov - (this.baseFov || 58);
    const desiredFov = THREE.MathUtils.clamp(
      (this.isSupersonic || this.isTurboActive || isSombraGrapple)
        ? 74 + fovDelta
        : isCaveiraBlast
          ? 72 + fovDelta
          : isHeroSprint
            ? 66 + fovDelta
            : isAimingBeam
              ? 53 + fovDelta * 0.5
              : baseUserFov,
      45,
      98
    );
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
    if (!this._camDesiredTarget) this._camDesiredTarget = new THREE.Vector3();
    if (!this._camViewDir) this._camViewDir = new THREE.Vector3();
    const desiredTarget = this._camDesiredTarget.set(
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

    const viewDir = this._camViewDir
      .set(-Math.sin(this.yaw) * cosPitch, -sinPitch, -Math.cos(this.yaw) * cosPitch)
      .normalize();

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
    const desiredNear = THREE.MathUtils.clamp(
      0.65 + Math.max(0, camY - 22) * 0.012,
      0.65,
      3.2
    );
    if (Math.abs(this.camera.near - desiredNear) > 0.04) {
      this.camera.near = desiredNear;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(
      camX + viewDir.x * 25,
      camY + viewDir.y * 25,
      camZ + viewDir.z * 25
    );
  }
};
