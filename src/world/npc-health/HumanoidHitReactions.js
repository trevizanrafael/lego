import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { HUMANOID_STATES } from './HumanoidHealthModel.js';

/**
 * Paleta arterial carmesim estilo GTA V (zero plástico amarelo/estilhaço LEGO em humanoides).
 */
export const BLOOD_CRIMSON_PALETTE = Object.freeze([
  0x991b1b,
  0x7f1d1d,
  0xdc2626,
  0x650a0a
]);

export const SHARED_BLOOD_DROP_GEO = markAsSharedAsset(
  new THREE.SphereGeometry(0.068, 6, 5)
);
export const SHARED_BLOOD_MIST_GEO = markAsSharedAsset(
  new THREE.SphereGeometry(0.115, 6, 5)
);

function smoothstep01(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function easeOutQuad(x) {
  const t = Math.max(0, Math.min(1, x));
  return 1 - (1 - t) * (1 - t);
}

function setHeadYawOnVisual(visual, yaw) {
  if (!visual) return;
  if ('headYaw' in visual) {
    visual.headYaw = yaw;
  }
  if (visual.head?.rotation) {
    visual.head.rotation.y = yaw;
  }
}

/**
 * Restaura rotações de tronco, pernas, braços e cabeça para postura ereta neutra.
 */
export function resetHumanoidLimbPose(visual) {
  if (!visual) return;
  const root = visual.root;
  if (root?.rotation) {
    if (root.rotation.order !== 'YXZ') root.rotation.order = 'YXZ';
    root.rotation.x = 0;
    root.rotation.z = 0;
  }
  if (visual.leftLeg?.rotation) {
    visual.leftLeg.rotation.x = 0;
    visual.leftLeg.rotation.z = 0;
  }
  if (visual.rightLeg?.rotation) {
    visual.rightLeg.rotation.x = 0;
    visual.rightLeg.rotation.z = 0;
  }
  if (visual.leftArm?.rotation) {
    visual.leftArm.rotation.x = -0.06;
    visual.leftArm.rotation.z = -0.06;
  }
  if (visual.rightArm?.rotation) {
    visual.rightArm.rotation.x = -0.06;
    visual.rightArm.rotation.z = 0.06;
  }
  setHeadYawOnVisual(visual, 0);
}

/**
 * Aplica deslocamento curto de recuo (knockback) do impacto balístico/explosivo,
 * respeitando função opcional de validação/colisão de terreno e prédios.
 */
export function applyHumanoidKnockbackStep(root, healthModel, dt, resolveMoveFn = null) {
  if (!root?.position || !healthModel || healthModel.knockbackSpeed <= 0) return false;
  const stepDist = healthModel.knockbackSpeed * Math.max(0, dt);
  if (stepDist <= 0.0001) return false;

  const nextX = root.position.x + healthModel.fallDirX * stepDist;
  const nextZ = root.position.z + healthModel.fallDirZ * stepDist;

  if (typeof resolveMoveFn === 'function') {
    const resolved = resolveMoveFn(nextX, nextZ, root.position.x, root.position.z);
    if (!resolved) return false;
    if (typeof resolved === 'object') {
      if (resolved.valid === false || resolved.blocked === true) return false;
      root.position.x = resolved.x ?? nextX;
      root.position.z = resolved.z ?? nextZ;
      return true;
    }
  }

  root.position.x = nextX;
  root.position.z = nextZ;
  return true;
}

/**
 * Aplica poses procedurais de STAGGER, DOWNED (queda + levantar) e DEAD
 * tanto em pedestres instanciados quanto em soldados/policiais articulados.
 */
export function applyHumanoidHitPose(visual, healthModel, groundY = 0, _dt = 0.016, opts = {}) {
  if (!visual?.root || !healthModel) return;

  const root = visual.root;
  if (root.rotation.order !== 'YXZ') {
    root.rotation.order = 'YXZ';
  }

  const unitScale = Math.max(0.75, Number(opts.unitScale) || 1.0);
  const sinkOffset = Math.max(0, Number(opts.sinkOffset) || 0);
  const state = healthModel.state;

  if (visual.muzzleFlash) visual.muzzleFlash.visible = false;
  if (visual.cameraFlashMesh) visual.cameraFlashMesh.visible = false;

  if (state === HUMANOID_STATES.STAGGER) {
    const u = healthModel.getStaggerProgress();
    const env = Math.sin(u * Math.PI);
    const isBoss = healthModel.kind === 'boss';
    const maxTilt = isBoss ? 0.14 : 0.28;

    if (healthModel.fallAxis === 'side') {
      root.rotation.x = -0.10 * env;
      root.rotation.z = healthModel.fallSign * maxTilt * env;
    } else {
      // Inclina o tronco/root em -0.28 rad no pico do impacto (ou para frente se baleado pelas costas)
      const sign = healthModel.fallSign > 0 ? 0.85 : -1.0;
      root.rotation.x = sign * maxTilt * (0.45 + 0.55 * env);
      root.rotation.z = 0;
    }

    root.position.y = groundY;

    if (visual.leftArm?.rotation) {
      visual.leftArm.rotation.x = -1.08 * env - 0.18;
      visual.leftArm.rotation.z = -0.54 * env - 0.08;
    }
    if (visual.rightArm?.rotation) {
      visual.rightArm.rotation.x = -1.02 * env - 0.18;
      visual.rightArm.rotation.z = 0.54 * env + 0.08;
    }
    if (visual.leftLeg?.rotation) {
      visual.leftLeg.rotation.x = 0.36 * env;
      visual.leftLeg.rotation.z = -0.06 * env;
    }
    if (visual.rightLeg?.rotation) {
      visual.rightLeg.rotation.x = -0.30 * env;
      visual.rightLeg.rotation.z = 0.06 * env;
    }
    setHeadYawOnVisual(visual, healthModel.fallSign * 0.18 * env);
    return;
  }

  if (state === HUMANOID_STATES.DOWNED) {
    let tiltFactor = 1.0;
    if (!healthModel.isGettingUp) {
      tiltFactor = easeOutQuad(Math.min(1, healthModel.stateElapsed / 0.16));
    } else {
      const upProgress = healthModel.getGettingUpProgress();
      tiltFactor = 1.0 - smoothstep01(upProgress);
    }

    const targetAngle = healthModel.fallSign * (Math.PI * 0.5) * tiltFactor;
    if (healthModel.fallAxis === 'side') {
      root.rotation.x = 0;
      root.rotation.z = targetAngle;
    } else {
      root.rotation.x = targetAngle;
      root.rotation.z = 0;
    }

    root.position.y = groundY + 0.22 * unitScale * tiltFactor;

    if (healthModel.isGettingUp) {
      // Apoiando os braços para impulsionar o tronco de volta a 0 rad
      const pushEnv = Math.sin(healthModel.getGettingUpProgress() * Math.PI);
      if (visual.leftArm?.rotation) {
        visual.leftArm.rotation.x = -0.95 * tiltFactor - 0.35 * pushEnv;
        visual.leftArm.rotation.z = -0.36 * tiltFactor;
      }
      if (visual.rightArm?.rotation) {
        visual.rightArm.rotation.x = -0.95 * tiltFactor - 0.35 * pushEnv;
        visual.rightArm.rotation.z = 0.36 * tiltFactor;
      }
      if (visual.leftLeg?.rotation) {
        visual.leftLeg.rotation.x = -0.48 * pushEnv;
        visual.leftLeg.rotation.z = -0.12 * tiltFactor;
      }
      if (visual.rightLeg?.rotation) {
        visual.rightLeg.rotation.x = 0.38 * pushEnv;
        visual.rightLeg.rotation.z = 0.12 * tiltFactor;
      }
    } else {
      if (visual.leftArm?.rotation) {
        visual.leftArm.rotation.x = -0.62 * tiltFactor;
        visual.leftArm.rotation.z = -0.68 * tiltFactor;
      }
      if (visual.rightArm?.rotation) {
        visual.rightArm.rotation.x = -0.44 * tiltFactor;
        visual.rightArm.rotation.z = 0.64 * tiltFactor;
      }
      if (visual.leftLeg?.rotation) {
        visual.leftLeg.rotation.x = -0.20 * tiltFactor;
        visual.leftLeg.rotation.z = -0.18 * tiltFactor;
      }
      if (visual.rightLeg?.rotation) {
        visual.rightLeg.rotation.x = 0.26 * tiltFactor;
        visual.rightLeg.rotation.z = 0.18 * tiltFactor;
      }
    }
    setHeadYawOnVisual(visual, healthModel.fallSign * 0.22 * tiltFactor);
    return;
  }

  if (state === HUMANOID_STATES.DEAD) {
    if (visual.allyMarker) visual.allyMarker.visible = false;
    if (visual.drone) visual.drone.visible = false;

    const collapseT =
      healthModel.stateElapsed <= 0
        ? 1.0
        : easeOutQuad(Math.min(1, healthModel.stateElapsed / 0.18));
    const deadAngle = healthModel.fallSign * (Math.PI * 0.5) * collapseT;

    if (healthModel.fallAxis === 'side') {
      root.rotation.x = 0;
      root.rotation.z = deadAngle;
    } else {
      root.rotation.x = deadAngle;
      root.rotation.z = 0;
    }

    root.position.y = groundY + 0.20 * unitScale * collapseT - sinkOffset;

    if (visual.leftArm?.rotation) {
      visual.leftArm.rotation.x = -0.38 * collapseT;
      visual.leftArm.rotation.z = -0.82 * collapseT;
    }
    if (visual.rightArm?.rotation) {
      visual.rightArm.rotation.x = -0.24 * collapseT;
      visual.rightArm.rotation.z = 0.76 * collapseT;
    }
    if (visual.leftLeg?.rotation) {
      visual.leftLeg.rotation.x = -0.14 * collapseT;
      visual.leftLeg.rotation.z = -0.22 * collapseT;
    }
    if (visual.rightLeg?.rotation) {
      visual.rightLeg.rotation.x = 0.22 * collapseT;
      visual.rightLeg.rotation.z = 0.19 * collapseT;
    }
    setHeadYawOnVisual(visual, healthModel.fallSign * 0.28 * collapseT);
    return;
  }

  resetHumanoidLimbPose(visual);
  root.position.y = groundY;
}

/**
 * Jato arterial curto de gotículas de sangue carmesim estilo GTA V no impacto balístico/corpo-a-corpo.
 * Usa o pool FX nativo (`destructibles._spawnFxParticle`) com geometrias compartilhadas sem vazamento.
 */
export function spawnBloodHitSplatter(destructibles, hitPos, shotDir = null, isFatal = false) {
  if (!destructibles || typeof destructibles._spawnFxParticle !== 'function' || !hitPos) {
    return 0;
  }

  const px = Number(hitPos.x) || 0;
  const py = Number(hitPos.y) || 0;
  const pz = Number(hitPos.z) || 0;

  let dirX = 0;
  let dirY = 0.18;
  let dirZ = 0;
  let hasDir = false;

  if (shotDir) {
    const len = Math.hypot(shotDir.x || 0, shotDir.y || 0, shotDir.z || 0);
    if (len > 0.001) {
      dirX = (shotDir.x || 0) / len;
      dirY = (shotDir.y || 0) / len;
      dirZ = (shotDir.z || 0) / len;
      hasDir = true;
    }
  }

  const dropCount = isFatal ? 20 : 11;
  const mistCount = isFatal ? 4 : 2;
  let spawned = 0;

  // Névoa arterial fina instantânea no ponto de perfuração
  for (let m = 0; m < mistCount; m++) {
    const mistScale = (isFatal ? 1.35 : 0.95) + Math.random() * 0.55;
    const mistColor = m % 2 === 0 ? 0x991b1b : 0x7f1d1d;
    const vx = (hasDir ? dirX * 2.2 : 0) + (Math.random() - 0.5) * 2.4;
    const vy = 0.8 + Math.random() * 1.8;
    const vz = (hasDir ? dirZ * 2.2 : 0) + (Math.random() - 0.5) * 2.4;

    destructibles._spawnFxParticle(
      SHARED_BLOOD_MIST_GEO,
      mistColor,
      0.86,
      px + (Math.random() - 0.5) * 0.14,
      py + (Math.random() - 0.5) * 0.14,
      pz + (Math.random() - 0.5) * 0.14,
      mistScale,
      mistScale,
      mistScale,
      vx,
      vy,
      vz,
      isFatal ? 0.24 : 0.17,
      0.32
    );
    spawned++;
  }

  // Gotículas arteriais em jato que espirram e caem com gravidade
  for (let i = 0; i < dropCount; i++) {
    const colorHex = BLOOD_CRIMSON_PALETTE[i % BLOOD_CRIMSON_PALETTE.length];
    const isExitJet = hasDir && i < dropCount * 0.72;
    const jetSign = isExitJet ? 1.0 : -0.45;
    const speed = (isFatal ? 4.2 : 2.8) + Math.random() * (isFatal ? 6.8 : 4.6);

    let vx;
    let vy;
    let vz;
    if (hasDir) {
      vx = dirX * jetSign * speed + (Math.random() - 0.5) * 3.8;
      vy = dirY * jetSign * (speed * 0.35) + 1.4 + Math.random() * (isFatal ? 3.8 : 2.6);
      vz = dirZ * jetSign * speed + (Math.random() - 0.5) * 3.8;
    } else {
      const ang = (i / dropCount) * Math.PI * 2 + Math.random() * 0.45;
      vx = Math.cos(ang) * speed * 0.78;
      vy = 1.6 + Math.random() * (isFatal ? 4.0 : 2.7);
      vz = Math.sin(ang) * speed * 0.78;
    }

    const s = (isFatal ? 0.85 : 0.68) + Math.random() * 0.65;
    const stretch = 1.0 + Math.random() * 0.55;
    const life = (isFatal ? 0.30 : 0.22) + Math.random() * 0.26;

    destructibles._spawnFxParticle(
      SHARED_BLOOD_DROP_GEO,
      colorHex,
      0.95,
      px + (Math.random() - 0.5) * 0.16,
      py + (Math.random() - 0.5) * 0.18,
      pz + (Math.random() - 0.5) * 0.16,
      s,
      s * stretch,
      s,
      vx,
      vy,
      vz,
      life,
      0.92
    );
    spawned++;
  }

  return spawned;
}
