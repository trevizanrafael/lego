import * as THREE from 'three';
import {
  HERO_EMOTES,
  applyEmoteAnimationToMinifigure
} from '../../world/InteractiveAttractionsAndEmotes.js';
import { soundFX } from '../../audio/SoundFX.js';
import { updateTitaSirensAndThrusters } from './MinifigVfxAndClothAnimator.js';
import { updateTraversalOverlays } from './MinifigLocomotionAnimator.js';

const _rollAxisScratch = new THREE.Vector3(1, 0, 0);

/**
 * Processa estados exclusivos que interrompem a locomoção padrão:
 * 1) Emotes / Danças [Tecla B] (cancela instantaneamente ao andar, pular, voar ou atacar)
 * 2) Rolamento Tático 360° girando no centro de massa (garantindo y >= 0 sem entrar no chão,
 *    com suporte a eixo direcional `rollLocalYaw` quando mirando em 3ª pessoa estilo GTA V)
 * Retorna `true` quando o frame já foi integralmente resolvido.
 */
export function updateEmoteOrRollInterrupt(minifig, dt, moveSpeed, isGrounded, isFlying) {
  if (minifig.activeEmote) {
    if (
      moveSpeed > 0.45 ||
      !isGrounded ||
      isFlying ||
      minifig.rollTimer > 0 ||
      minifig.punchTimer > 0 ||
      minifig.shootTimer > 0
    ) {
      minifig.stopEmote();
    } else {
      applyEmoteAnimationToMinifigure(minifig, dt);
      return true;
    }
  }

  if (minifig.rollTimer > 0) {
    minifig.rollTimer = Math.max(0, minifig.rollTimer - dt);
    minifig.state = 'ROLL';
    const dur = Math.max(0.01, Number(minifig.rollDuration) || 0.38);
    const progress = 1.0 - minifig.rollTimer / dur;

    if (minifig.rollTimer <= 0) {
      minifig.visualRoot.position.set(0, 0, 0);
      minifig.visualRoot.rotation.set(0, 0, 0);
      minifig.rollLocalYaw = 0;
    } else {
      const theta = progress * Math.PI * 2;
      const localYaw = Number(minifig.rollLocalYaw) || 0;
      const lx = Math.sin(localYaw);
      const lz = Math.cos(localYaw);

      // Pivô no centro do tronco (pivotY = 0.96) + impulso vertical garante y >= 0 em todos os ângulos!
      const pivotY = 0.96;
      const rollCenterY = pivotY + Math.sin(progress * Math.PI) * 0.32;

      _rollAxisScratch.set(lz, 0, -lx);
      minifig.visualRoot.quaternion.setFromAxisAngle(_rollAxisScratch, theta);
      minifig.visualRoot.position.x = -lx * pivotY * Math.sin(theta);
      minifig.visualRoot.position.y = rollCenterY - pivotY * Math.cos(theta);
      minifig.visualRoot.position.z = -lz * pivotY * Math.sin(theta);
    }

    const tuck = Math.sin(progress * Math.PI);
    minifig.upperBodyGroup.rotation.x = 0.48 * tuck;
    minifig.upperBodyGroup.rotation.y = 0;
    minifig.headGroup.rotation.x = 0.35 * tuck;

    minifig.leftLegPivot.rotation.x = -1.35 * tuck;
    minifig.rightLegPivot.rotation.x = -1.35 * tuck;
    minifig.leftArmPivot.rotation.x = -1.45 * tuck;
    minifig.rightArmPivot.rotation.x = -1.45 * tuck;
    if (minifig.leftHandGroup && minifig.rightHandGroup) {
      minifig.leftHandGroup.rotation.x = -0.95 * tuck;
      minifig.rightHandGroup.rotation.x = -0.95 * tuck;
    }
    return true;
  }

  return false;
}

/**
 * Aplica poses de combate e poderes especiais sobre a locomoção:
 * Raio Solar Contínuo, Super-Pulo/Pisada Sísmica do Titã, Guarda Alta de Boxe,
 * Combo de 3 Golpes (Boxe / Katanas Sombra / Espada V8 Turbo / Garras Vórtex) e Recuo de Armas.
 */
export function updateCombatAndPowerPoses(
  minifig,
  dt,
  lerpSpeed,
  isGrounded,
  verticalVelocity
) {
  if (minifig.isBeaming) {
    minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.x, -1.52, lerpSpeed);
    minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.x, -1.52, lerpSpeed);
    minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, -0.12, lerpSpeed);
    minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, 0.12, lerpSpeed);
  }

  const shoulderX = minifig.isBigFig ? 0.62 : 0.49;
  minifig.leftArmPivot.position.set(shoulderX, 0.66, 0);
  minifig.rightArmPivot.position.set(-shoulderX, 0.66, 0);
  minifig.leftArmPivot.rotation.y = 0;
  minifig.rightArmPivot.rotation.y = 0;
  minifig.upperBodyGroup.position.z = 0;
  if (minifig.leftHandGroup && minifig.rightHandGroup) {
    minifig.leftHandGroup.rotation.x = -0.22;
    minifig.rightHandGroup.rotation.x = -0.22;
  }

  updateTitaSirensAndThrusters(minifig, isGrounded, verticalVelocity);

  if (minifig.titaJumpChargeRatio > 0.01 && isGrounded) {
    const c = minifig.titaJumpChargeRatio;
    minifig.visualRoot.position.y = -c * 0.28;
    minifig.upperBodyGroup.rotation.x = c * 0.38;
    minifig.leftLegPivot.rotation.x = -c * 0.65;
    minifig.rightLegPivot.rotation.x = -c * 0.65;
    minifig.leftArmPivot.rotation.x = -0.75 - c * 0.45;
    minifig.rightArmPivot.rotation.x = -0.75 - c * 0.45;
    minifig.leftArmPivot.rotation.z = 0.28;
    minifig.rightArmPivot.rotation.z = -0.28;
  }

  if (minifig.stompTimer > 0) {
    minifig.stompTimer = Math.max(0, minifig.stompTimer - dt);
    const progress = 1.0 - minifig.stompTimer / minifig.stompDuration;
    if (progress < 0.44) {
      const u = progress / 0.44;
      const ease = Math.sin(u * Math.PI * 0.5);
      minifig.upperBodyGroup.rotation.x = -0.24 * ease;
      minifig.rightLegPivot.rotation.x = -1.48 * ease;
      minifig.leftLegPivot.rotation.x = 0.18 * ease;
      minifig.leftArmPivot.rotation.x = -2.15 * ease;
      minifig.rightArmPivot.rotation.x = -2.15 * ease;
      minifig.leftArmPivot.rotation.z = 0.36 * ease;
      minifig.rightArmPivot.rotation.z = -0.36 * ease;
    } else {
      const u = (progress - 0.44) / 0.56;
      const impact = 1.0 - u;
      minifig.visualRoot.position.y = -0.22 * impact;
      minifig.upperBodyGroup.rotation.x = 0.34 * impact;
      minifig.rightLegPivot.rotation.x = 0.15 * impact;
      minifig.leftLegPivot.rotation.x = -0.22 * impact;
      minifig.leftArmPivot.rotation.x = -0.85 * impact;
      minifig.rightArmPivot.rotation.x = -0.85 * impact;
    }
  }

  updateTraversalOverlays(minifig, isGrounded);

  // Guarda de Boxe / Combate e Soco Reto Horizontal (Jab -> Direto -> Gancho)
  if (minifig.combatStanceTimer > 0) {
    minifig.combatStanceTimer = Math.max(0, minifig.combatStanceTimer - dt);
    const stanceWeight = Math.min(1, minifig.combatStanceTimer * 4.5);

    minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.x, -1.35, stanceWeight);
    minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.x, -1.35, stanceWeight);
    minifig.leftArmPivot.rotation.y = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.y, -0.32, stanceWeight);
    minifig.rightArmPivot.rotation.y = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.y, 0.32, stanceWeight);

    if (minifig.leftHandGroup && minifig.rightHandGroup) {
      minifig.leftHandGroup.rotation.x = THREE.MathUtils.lerp(-0.22, -0.85, stanceWeight);
      minifig.rightHandGroup.rotation.x = THREE.MathUtils.lerp(-0.22, -0.85, stanceWeight);
    }
  }

  if (minifig.punchTimer > 0) {
    minifig.punchTimer = Math.max(0, minifig.punchTimer - dt);
    const t = 1.0 - minifig.punchTimer / minifig.punchDuration;
    const thrust = t < 0.32 ? (t / 0.32) : Math.max(0, 1.0 - (t - 0.32) / 0.68);
    const snap = Math.sin(thrust * Math.PI * 0.5);

    minifig.upperBodyGroup.position.z = 0.14 * snap;
    minifig.upperBodyGroup.rotation.x = 0.16 * snap;

    if (minifig.currentHeroKey === 'sombra') {
      const slashProgress = Math.min(1, t * 1.45);
      if (minifig.punchComboStep === 1) {
        minifig.rightArmPivot.rotation.x = -2.2 + slashProgress * 1.35;
        minifig.rightArmPivot.rotation.y = -0.65 + slashProgress * 1.35;
        minifig.rightArmPivot.rotation.z = -0.58;
        minifig.leftArmPivot.rotation.x = -0.85;
        minifig.leftArmPivot.rotation.z = 0.35;
        minifig.upperBodyGroup.rotation.y = 0.68 * snap;
      } else if (minifig.punchComboStep === 2) {
        minifig.leftArmPivot.rotation.x = -2.2 + slashProgress * 1.35;
        minifig.leftArmPivot.rotation.y = 0.65 - slashProgress * 1.35;
        minifig.leftArmPivot.rotation.z = 0.58;
        minifig.rightArmPivot.rotation.x = -0.85;
        minifig.rightArmPivot.rotation.z = -0.35;
        minifig.upperBodyGroup.rotation.y = -0.68 * snap;
      } else {
        minifig.leftArmPivot.rotation.x = -2.35 + slashProgress * 1.55;
        minifig.rightArmPivot.rotation.x = -2.35 + slashProgress * 1.55;
        minifig.leftArmPivot.rotation.y = 0.75 - slashProgress * 1.45;
        minifig.rightArmPivot.rotation.y = -0.75 + slashProgress * 1.45;
        minifig.leftArmPivot.rotation.z = 0.52;
        minifig.rightArmPivot.rotation.z = -0.52;
        minifig.upperBodyGroup.rotation.x = 0.34 * snap;
      }
    } else if (minifig.currentHeroKey === 'turbo') {
      const slashProgress = Math.min(1, t * 1.42);
      if (minifig.punchComboStep === 1) {
        minifig.rightArmPivot.rotation.x = -1.62;
        minifig.rightArmPivot.rotation.y = -1.15 + slashProgress * 2.25;
        minifig.rightArmPivot.rotation.z = -0.85;
        if (minifig.rightHandGroup) minifig.rightHandGroup.rotation.x = 0.35;
        minifig.leftArmPivot.rotation.x = -1.1;
        minifig.leftArmPivot.rotation.z = 0.45;
        minifig.upperBodyGroup.rotation.y = -0.75 + slashProgress * 1.45;
        minifig.upperBodyGroup.rotation.x = 0.28 * snap;
      } else if (minifig.punchComboStep === 2) {
        minifig.rightArmPivot.rotation.x = -0.55 - slashProgress * 2.15;
        minifig.rightArmPivot.rotation.y = 0.45 - slashProgress * 0.9;
        minifig.rightArmPivot.rotation.z = -0.35;
        minifig.leftArmPivot.rotation.x = -2.1 + slashProgress * 1.25;
        minifig.leftArmPivot.rotation.y = 0.85 - slashProgress * 1.55;
        minifig.leftArmPivot.rotation.z = 0.65;
        minifig.upperBodyGroup.rotation.y = 0.65 - slashProgress * 1.3;
        minifig.upperBodyGroup.rotation.x = -0.22 * snap;
      } else {
        minifig.visualRoot.rotation.y = slashProgress * Math.PI * 2;
        minifig.rightArmPivot.rotation.x = -1.58;
        minifig.rightArmPivot.rotation.z = -1.15;
        minifig.leftArmPivot.rotation.x = -1.58;
        minifig.leftArmPivot.rotation.z = 1.15;
        minifig.upperBodyGroup.rotation.x = 0.32 * snap;
      }
    } else if (minifig.currentHeroKey === 'vortex') {
      const slashProgress = Math.min(1, t * 1.4);
      if (minifig.punchComboStep === 1) {
        minifig.leftArmPivot.rotation.x = -2.1 + slashProgress * 1.2;
        minifig.rightArmPivot.rotation.x = -2.1 + slashProgress * 1.2;
        minifig.leftArmPivot.rotation.y = 0.9 - slashProgress * 1.7;
        minifig.rightArmPivot.rotation.y = 0.9 - slashProgress * 1.7;
        minifig.upperBodyGroup.rotation.y = 0.72 - slashProgress * 1.44;
      } else if (minifig.punchComboStep === 2) {
        minifig.leftArmPivot.rotation.x = -1.62;
        minifig.rightArmPivot.rotation.x = -1.62;
        minifig.leftArmPivot.rotation.y = -0.95 + slashProgress * 1.45;
        minifig.rightArmPivot.rotation.y = 0.95 - slashProgress * 1.45;
        minifig.leftArmPivot.rotation.z = 0.65 * (1 - slashProgress);
        minifig.rightArmPivot.rotation.z = -0.65 * (1 - slashProgress);
        minifig.upperBodyGroup.rotation.x = 0.42 * snap;
      } else {
        minifig.leftArmPivot.rotation.x = -2.65 + slashProgress * 1.85;
        minifig.rightArmPivot.rotation.x = -2.65 + slashProgress * 1.85;
        minifig.leftArmPivot.rotation.z = 0.48;
        minifig.rightArmPivot.rotation.z = -0.48;
        minifig.upperBodyGroup.rotation.x = -0.35 * (1 - slashProgress) + 0.48 * slashProgress;
      }
    } else if (minifig.punchComboStep === 1) {
      // Golpe 1: JAB ESQUERDO RETO (guarda alta protegendo o rosto com a direita)
      minifig.leftArmPivot.rotation.x = -1.56;
      minifig.leftArmPivot.rotation.y = -0.22 * snap;
      minifig.leftArmPivot.position.z = -0.1 * (1 - snap) + 0.34 * snap;
      if (minifig.leftHandGroup) minifig.leftHandGroup.rotation.x = -0.85 * (1 - snap);

      minifig.rightArmPivot.rotation.x = -1.32;
      minifig.rightArmPivot.rotation.y = 0.38;
      minifig.rightArmPivot.position.z = -0.12;
      if (minifig.rightHandGroup) minifig.rightHandGroup.rotation.x = -0.95;

      minifig.upperBodyGroup.rotation.y = -0.48 * snap;
    } else if (minifig.punchComboStep === 2) {
      // Golpe 2: DIRETO CRUZADO DE DIREITA
      minifig.rightArmPivot.rotation.x = -1.56;
      minifig.rightArmPivot.rotation.y = 0.24 * snap;
      minifig.rightArmPivot.position.z = -0.12 * (1 - snap) + 0.36 * snap;
      if (minifig.rightHandGroup) minifig.rightHandGroup.rotation.x = -0.85 * (1 - snap);

      minifig.leftArmPivot.rotation.x = -1.32;
      minifig.leftArmPivot.rotation.y = -0.38;
      minifig.leftArmPivot.position.z = -0.12;
      if (minifig.leftHandGroup) minifig.leftHandGroup.rotation.x = -0.95;

      minifig.upperBodyGroup.rotation.y = 0.54 * snap;
    } else {
      // Golpe 3: GANCHO CRUZADO HORIZONTAL
      minifig.leftArmPivot.rotation.x = -1.58;
      minifig.leftArmPivot.rotation.y = 0.45 - 0.85 * snap;
      minifig.leftArmPivot.position.z = 0.32 * snap;
      if (minifig.leftHandGroup) minifig.leftHandGroup.rotation.x = -0.55;

      minifig.rightArmPivot.rotation.x = -1.35;
      minifig.rightArmPivot.rotation.y = 0.35;
      minifig.upperBodyGroup.rotation.y = -0.62 * snap;
    }
  } else if (minifig.visualRoot.rotation.y !== 0) {
    minifig.visualRoot.rotation.y = THREE.MathUtils.lerp(minifig.visualRoot.rotation.y, 0, lerpSpeed);
    if (Math.abs(minifig.visualRoot.rotation.y) < 0.01) {
      minifig.visualRoot.rotation.y = 0;
    }
  }

  // Recuo de Disparo de Armas 3D + Giro de 6 Canos da Minigun Vulcan
  if (minifig.shootTimer > 0) {
    minifig.shootTimer = Math.max(0, minifig.shootTimer - dt);
    if (minifig.titaMinigunBarrelGroup) {
      minifig.titaMinigunBarrelGroup.rotation.z += 38.0 * dt;
    }
    const recoil = Math.sin((minifig.shootTimer / 0.16) * Math.PI);

    if (minifig.currentHeroKey === 'vingador' && minifig.vingadorWeapon === 'dual_smg') {
      const leftKick = minifig.vingadorDualRecoilSide < 0 ? recoil * 0.28 : recoil * 0.06;
      const rightKick = minifig.vingadorDualRecoilSide > 0 ? recoil * 0.28 : recoil * 0.06;
      minifig.leftArmPivot.rotation.x = -1.52 + leftKick;
      minifig.leftArmPivot.position.z = -leftKick * 0.65;
      minifig.leftArmPivot.rotation.z = 0.06;
      if (minifig.leftHandGroup) minifig.leftHandGroup.rotation.x = -0.14;

      minifig.rightArmPivot.rotation.x = -1.52 + rightKick;
      minifig.rightArmPivot.position.z = -rightKick * 0.65;
      minifig.rightArmPivot.rotation.z = -0.06;
      if (minifig.rightHandGroup) minifig.rightHandGroup.rotation.x = -0.14;
    } else {
      minifig.rightArmPivot.rotation.x = -1.52 + recoil * 0.18;
      minifig.rightArmPivot.position.z = -recoil * 0.12;
      minifig.rightArmPivot.rotation.z = -0.04;
      if (minifig.rightHandGroup) minifig.rightHandGroup.rotation.x = -0.15;
    }
  }
}

export const combatAndEmoteMethods = {
  triggerPunch() {
    this.punchDuration = 0.22;
    this.punchTimer = this.punchDuration;
    this.combatStanceTimer = 0.85;
    this.punchComboStep = (this.punchComboStep + 1) % 3;
  },

  triggerShoot() {
    this.shootTimer = 0.16;
    this.muzzleFlashTimer = 0.055;
  },

  triggerStomp() {
    this.stompDuration = 0.42;
    this.stompTimer = this.stompDuration;
  },

  triggerTacticalRoll(duration = null, localRollYaw = 0) {
    if (this.rollTimer > 0) return false;
    if (!this.defaultRollDuration) {
      this.defaultRollDuration = Number(this.rollDuration) || 0.38;
    }
    const resolvedDuration = Number.isFinite(Number(duration)) && Number(duration) > 0
      ? Number(duration)
      : this.defaultRollDuration;
    this.rollDuration = resolvedDuration;
    this.rollTimer = resolvedDuration;
    this.rollLocalYaw = Number.isFinite(Number(localRollYaw)) ? Number(localRollYaw) : 0;
    return true;
  },

  triggerNextEmote() {
    this._emoteIndex = ((this._emoteIndex ?? -1) + 1) % HERO_EMOTES.length;
    const chosen = HERO_EMOTES[this._emoteIndex];
    this.activeEmote = chosen.id;
    this.emoteTimer = 0;
    this.state = `EMOTE_${chosen.id.toUpperCase()}`;
    soundFX.playEmoteJingle(this._emoteIndex);
    return chosen;
  },

  stopEmote() {
    if (!this.activeEmote) return;
    this.activeEmote = null;
    this.emoteTimer = 0;
    if (this._emoteAuraGroup) {
      this._emoteAuraGroup.visible = false;
    }
    this.visualRoot.position.set(0, 0, 0);
    this.visualRoot.rotation.set(0, 0, 0);
    this.leftArmPivot.rotation.set(0, 0, 0);
    this.rightArmPivot.rotation.set(0, 0, 0);
    this.leftLegPivot.rotation.set(0, 0, 0);
    this.rightLegPivot.rotation.set(0, 0, 0);
  }
};
