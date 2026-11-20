import * as THREE from 'three';
import { BIG_FIG_SCALE, SOMBRA_AGILE_SCALE } from './HeroProfilesCatalog.js';
import { updateCapeBillow } from './MinifigVfxAndClothAnimator.js';

/**
 * Atualiza locomoção procedural 3D (Voo Supersônico COMET, Levitação HOVER,
 * IDLE com respiração/olhar, WALK, RUN com corrida Shinobi, JUMP e FALL com planagem Voltaico).
 */
export function updateFlightAndGroundLocomotion(
  minifig,
  dt,
  lerpSpeed,
  moveSpeed,
  maxRunSpeed,
  isGrounded,
  verticalVelocity,
  isFlying,
  isSupersonic,
  flightPitch,
  flightBank
) {
  minifig.visualRoot.position.z = THREE.MathUtils.lerp(minifig.visualRoot.position.z, 0, lerpSpeed);
  const targetBodyPitch = isFlying && isSupersonic ? (Math.PI * 0.48 - flightPitch) : 0;
  const targetBodyBank = isFlying ? flightBank : 0;
  minifig.visualRoot.rotation.x = THREE.MathUtils.lerp(
    minifig.visualRoot.rotation.x,
    targetBodyPitch,
    lerpSpeed
  );
  minifig.visualRoot.rotation.z = THREE.MathUtils.lerp(
    minifig.visualRoot.rotation.z,
    targetBodyBank,
    lerpSpeed
  );

  if (isFlying) {
    minifig.state = isSupersonic ? 'COMET' : 'HOVER';
    const hoverBob = Math.sin(minifig.animTime * 3.8) * 0.14;
    minifig.visualRoot.position.y = THREE.MathUtils.lerp(
      minifig.visualRoot.position.y,
      0.18 + hoverBob,
      lerpSpeed
    );

    if (isSupersonic) {
      minifig.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(minifig.upperBodyGroup.rotation.x, 0.15, lerpSpeed);
      minifig.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(minifig.upperBodyGroup.rotation.y, 0, lerpSpeed);

      minifig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftLegPivot.rotation.x, 0.18, lerpSpeed);
      minifig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightLegPivot.rotation.x, 0.28, lerpSpeed);

      minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.x, -2.75, lerpSpeed);
      minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.x, -2.75, lerpSpeed);
      minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, 0.12, lerpSpeed);
      minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, -0.12, lerpSpeed);

      minifig.headGroup.rotation.x = THREE.MathUtils.lerp(minifig.headGroup.rotation.x, -0.75, lerpSpeed);
    } else {
      minifig.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(
        minifig.upperBodyGroup.rotation.x,
        moveSpeed > 0.5 ? 0.22 : 0.04,
        lerpSpeed
      );
      minifig.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(minifig.upperBodyGroup.rotation.y, 0, lerpSpeed);

      minifig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftLegPivot.rotation.x, -0.28, lerpSpeed);
      minifig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightLegPivot.rotation.x, 0.16, lerpSpeed);

      minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.x, -0.55, lerpSpeed);
      minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.x, -0.55, lerpSpeed);
      minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, 0.35, lerpSpeed);
      minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, -0.35, lerpSpeed);

      minifig.headGroup.rotation.x = THREE.MathUtils.lerp(minifig.headGroup.rotation.x, 0, lerpSpeed);
    }
  } else {
    if (!isGrounded) {
      minifig.state = verticalVelocity > 0.5 ? 'JUMP' : 'FALL';
    } else if (moveSpeed > maxRunSpeed * 0.65) {
      minifig.state = 'RUN';
    } else if (moveSpeed > 0.2) {
      minifig.state = 'WALK';
    } else {
      minifig.state = 'IDLE';
    }

    if (minifig.state === 'IDLE') {
      const breath = Math.sin(minifig.animTime * 2.6);
      const subtleLook = Math.sin(minifig.animTime * 1.1);

      minifig.visualRoot.position.y = THREE.MathUtils.lerp(
        minifig.visualRoot.position.y,
        -minifig.landingSquash * 0.08,
        lerpSpeed
      );

      minifig.upperBodyGroup.position.y = THREE.MathUtils.lerp(
        minifig.upperBodyGroup.position.y,
        0.86 + breath * 0.015,
        lerpSpeed
      );
      minifig.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(
        minifig.upperBodyGroup.rotation.x,
        breath * 0.025 + minifig.landingSquash * 0.14,
        lerpSpeed
      );
      minifig.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(minifig.upperBodyGroup.rotation.y, 0, lerpSpeed);

      minifig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftLegPivot.rotation.x, 0, lerpSpeed);
      minifig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightLegPivot.rotation.x, 0, lerpSpeed);

      minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
        minifig.leftArmPivot.rotation.x,
        breath * 0.05,
        lerpSpeed
      );
      const idleRightArmX = minifig.currentHeroKey === 'caveira' ? -0.62 : -breath * 0.05;
      minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
        minifig.rightArmPivot.rotation.x,
        idleRightArmX,
        lerpSpeed
      );
      minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, 0, lerpSpeed);
      minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, 0, lerpSpeed);

      minifig.headGroup.rotation.y = THREE.MathUtils.lerp(
        minifig.headGroup.rotation.y,
        subtleLook * 0.12,
        lerpSpeed * 0.5
      );
      minifig.headGroup.rotation.x = THREE.MathUtils.lerp(
        minifig.headGroup.rotation.x,
        -breath * 0.02,
        lerpSpeed
      );
    } else if (minifig.state === 'WALK' || minifig.state === 'RUN') {
      const isRunning = minifig.state === 'RUN';
      const isSombraRun = minifig.currentHeroKey === 'sombra' && isRunning;
      const freq = isSombraRun ? 19.5 : isRunning ? 15.5 : 10.5;
      minifig.walkPhase += dt * freq;

      const legAmp = isSombraRun ? 1.08 : isRunning ? 0.92 : 0.58;
      const armAmp = isRunning ? 0.98 : 0.52;
      const bounceAmp = isRunning ? 0.11 : 0.055;
      const forwardLean = isSombraRun ? 0.46 : isRunning ? 0.16 : 0.05;

      const s = Math.sin(minifig.walkPhase);
      const bounce = Math.abs(Math.sin(minifig.walkPhase)) * bounceAmp;

      minifig.visualRoot.position.y = THREE.MathUtils.lerp(
        minifig.visualRoot.position.y,
        bounce - minifig.landingSquash * 0.06,
        lerpSpeed
      );

      minifig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
        minifig.leftLegPivot.rotation.x,
        s * legAmp,
        lerpSpeed
      );
      minifig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
        minifig.rightLegPivot.rotation.x,
        -s * legAmp,
        lerpSpeed
      );

      if (isSombraRun) {
        minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
          minifig.leftArmPivot.rotation.x,
          0.95 + s * 0.12,
          lerpSpeed
        );
        minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          minifig.rightArmPivot.rotation.x,
          0.95 - s * 0.12,
          lerpSpeed
        );
        minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, 0.28, lerpSpeed);
        minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, -0.28, lerpSpeed);
      } else {
        minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(
          minifig.leftArmPivot.rotation.x,
          -s * armAmp,
          lerpSpeed
        );
        const rightTargetX =
          minifig.currentHeroKey === 'caveira' ? -0.75 + s * 0.25 : s * armAmp;
        minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(
          minifig.rightArmPivot.rotation.x,
          rightTargetX,
          lerpSpeed
        );
        minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, 0.04, lerpSpeed);
        minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, -0.04, lerpSpeed);
      }

      minifig.upperBodyGroup.position.y = THREE.MathUtils.lerp(minifig.upperBodyGroup.position.y, 0.86, lerpSpeed);
      minifig.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(
        minifig.upperBodyGroup.rotation.x,
        forwardLean,
        lerpSpeed
      );
      minifig.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(
        minifig.upperBodyGroup.rotation.y,
        -s * (isRunning ? 0.14 : 0.07),
        lerpSpeed
      );

      minifig.headGroup.rotation.y = THREE.MathUtils.lerp(
        minifig.headGroup.rotation.y,
        s * 0.06,
        lerpSpeed
      );
      minifig.headGroup.rotation.x = THREE.MathUtils.lerp(
        minifig.headGroup.rotation.x,
        isSombraRun ? -0.36 : -forwardLean * 0.6,
        lerpSpeed
      );
    } else if (minifig.state === 'JUMP') {
      minifig.visualRoot.position.y = THREE.MathUtils.lerp(minifig.visualRoot.position.y, 0, lerpSpeed);
      minifig.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(minifig.upperBodyGroup.rotation.x, -0.08, lerpSpeed);
      minifig.upperBodyGroup.rotation.y = THREE.MathUtils.lerp(minifig.upperBodyGroup.rotation.y, 0.08, lerpSpeed);

      minifig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftLegPivot.rotation.x, -0.55, lerpSpeed);
      minifig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightLegPivot.rotation.x, 0.45, lerpSpeed);

      minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.x, -2.1, lerpSpeed);
      minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.x, 0.65, lerpSpeed);
      minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, 0.18, lerpSpeed);
      minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, -0.18, lerpSpeed);

      minifig.headGroup.rotation.x = THREE.MathUtils.lerp(minifig.headGroup.rotation.x, -0.15, lerpSpeed);
      minifig.headGroup.rotation.y = THREE.MathUtils.lerp(minifig.headGroup.rotation.y, 0, lerpSpeed);
    } else if (minifig.state === 'FALL') {
      const airFlutter = Math.sin(minifig.animTime * 18) * 0.08;
      if (minifig.currentHeroKey === 'voltaico') {
        const hoverPulse = Math.sin(minifig.animTime * 8.5) * 0.08;
        minifig.visualRoot.position.y = THREE.MathUtils.lerp(minifig.visualRoot.position.y, 0.14 + hoverPulse, lerpSpeed);
        minifig.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(minifig.upperBodyGroup.rotation.x, 0.18, lerpSpeed);
        minifig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftLegPivot.rotation.x, -0.35, lerpSpeed);
        minifig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightLegPivot.rotation.x, 0.22, lerpSpeed);
        minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.x, -1.65, lerpSpeed);
        minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.x, -1.45, lerpSpeed);
        minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, 0.52, lerpSpeed);
        minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, -0.42, lerpSpeed);
        minifig.headGroup.rotation.x = THREE.MathUtils.lerp(minifig.headGroup.rotation.x, -0.12, lerpSpeed);
      } else {
        minifig.visualRoot.position.y = THREE.MathUtils.lerp(minifig.visualRoot.position.y, 0, lerpSpeed);
        minifig.upperBodyGroup.rotation.x = THREE.MathUtils.lerp(minifig.upperBodyGroup.rotation.x, 0.12, lerpSpeed);

        minifig.leftLegPivot.rotation.x = THREE.MathUtils.lerp(
          minifig.leftLegPivot.rotation.x,
          0.25 + airFlutter,
          lerpSpeed
        );
        minifig.rightLegPivot.rotation.x = THREE.MathUtils.lerp(
          minifig.rightLegPivot.rotation.x,
          -0.25 - airFlutter,
          lerpSpeed
        );

        minifig.leftArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.x, -1.25, lerpSpeed);
        minifig.rightArmPivot.rotation.x = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.x, -1.25, lerpSpeed);
        minifig.leftArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.leftArmPivot.rotation.z, 0.45, lerpSpeed);
        minifig.rightArmPivot.rotation.z = THREE.MathUtils.lerp(minifig.rightArmPivot.rotation.z, -0.45, lerpSpeed);

        minifig.headGroup.rotation.x = THREE.MathUtils.lerp(minifig.headGroup.rotation.x, 0.15, lerpSpeed);
      }
    }
  }

  updateCapeBillow(minifig, lerpSpeed, isGrounded, isFlying, isSupersonic);
}

/**
 * Sobreposições de travessia especial (Arremesso de Carro, Swing de Gancho e Combat Slide).
 */
export function updateTraversalOverlays(minifig, isGrounded) {
  if (minifig.isCarryingCar) {
    minifig.leftArmPivot.rotation.x = -2.85;
    minifig.rightArmPivot.rotation.x = -2.85;
    minifig.leftArmPivot.rotation.z = 0.22;
    minifig.rightArmPivot.rotation.z = -0.22;
  }

  if (minifig.isGrappling) {
    minifig.leftArmPivot.rotation.x = -2.55;
    minifig.rightArmPivot.rotation.x = 0.45;
    minifig.upperBodyGroup.rotation.x = 0.32;
  }

  if (minifig.isDiveSliding) {
    minifig.visualRoot.position.y = isGrounded ? -0.24 : 0.08;
    minifig.upperBodyGroup.rotation.x = isGrounded ? -0.36 : 0.48;
    minifig.leftLegPivot.rotation.x = isGrounded ? -1.15 : 0.52;
    minifig.rightLegPivot.rotation.x = isGrounded ? 0.38 : -0.35;
    minifig.leftArmPivot.rotation.x = -1.62;
    minifig.rightArmPivot.rotation.x = -1.62;
    minifig.leftArmPivot.rotation.z = 0.18;
    minifig.rightArmPivot.rotation.z = -0.18;
  }
}

export const locomotionMethods = {
  /**
   * Diminui visualmente a Minifigura e a coloca sentada 100% dentro da cabine do carro ao apertar [E],
   * voltando ao tamanho 100% normal ao sair do carro!
   */
  setSeatedInVehicle(isSeated, steerAngle = 0, openTop = false, isMotorcycle = false, wheeliePitch = 0) {
    if (isSeated) {
      this.state = 'DRIVE';
      this.root.scale.setScalar(isMotorcycle ? 0.78 : openTop ? 0.58 : 0.44);
      this.visualRoot.scale.setScalar(1.0);
      this.visualRoot.position.set(0, 0, isMotorcycle ? 0.0 : -0.12);
      this.visualRoot.rotation.set(0, 0, 0);
      if (this.hipGroup) {
        this.hipGroup.position.set(0, isMotorcycle ? 0.42 : 0.36, 0);
      }
      this.upperBodyGroup.position.set(0, isMotorcycle ? 0.52 : 0.44, 0);
      if (isMotorcycle) {
        this.upperBodyGroup.rotation.set(0.28, steerAngle * 0.25, 0);
        this.leftLegPivot.rotation.set(-0.98, 0, 0.24);
        this.rightLegPivot.rotation.set(-0.98, 0, -0.24);
        this.leftArmPivot.rotation.set(-1.32 + steerAngle * 0.35, 0, 0.16);
        this.rightArmPivot.rotation.set(-1.32 - steerAngle * 0.35, 0, -0.16);
        this.headGroup.rotation.set(-0.18 - wheeliePitch * 0.32, steerAngle * 0.35, 0);
      } else {
        this.upperBodyGroup.rotation.set(0.05, steerAngle * 0.25, 0);
        this.leftLegPivot.rotation.set(-1.55, 0, 0);
        this.rightLegPivot.rotation.set(-1.55, 0, 0);
        this.leftArmPivot.rotation.set(-1.35 + steerAngle * 0.4, 0, 0.12);
        this.rightArmPivot.rotation.set(-1.35 - steerAngle * 0.4, 0, -0.12);
        this.headGroup.rotation.set(0, steerAngle * 0.35, 0);
      }
      if (this.rifleGroup) this.rifleGroup.visible = false;
      if (this.capeMesh) this.capeMesh.visible = false;
      if (this.solarMantleGroup) this.solarMantleGroup.visible = false;
    } else {
      this.root.scale.setScalar(1.0);
      if (this.isBigFig) {
        this.visualRoot.scale.set(BIG_FIG_SCALE.x, BIG_FIG_SCALE.y, BIG_FIG_SCALE.z);
      } else if (this.currentHeroKey === 'sombra') {
        this.visualRoot.scale.set(SOMBRA_AGILE_SCALE.x, SOMBRA_AGILE_SCALE.y, SOMBRA_AGILE_SCALE.z);
      } else {
        this.visualRoot.scale.setScalar(1.0);
      }
      this.visualRoot.position.set(0, 0, 0);
      this.visualRoot.rotation.set(0, 0, 0);
      if (this.hipGroup) {
        this.hipGroup.position.set(0, 0.72, 0);
      }
      this.upperBodyGroup.position.set(0, 0.86, 0);
      this.upperBodyGroup.rotation.set(0, 0, 0);
      this.leftLegPivot.rotation.set(0, 0, 0);
      this.rightLegPivot.rotation.set(0, 0, 0);
      if (this.rifleGroup) this.rifleGroup.visible = true;
      if (this.capeMesh) this.capeMesh.visible = true;
      if (this.solarMantleGroup) this.solarMantleGroup.visible = true;
    }
  }
};
