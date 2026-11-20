import * as THREE from 'three';

const _VOLTAICO_UP = new THREE.Vector3(0, 1, 0);
const _VOLTAICO_DIR = new THREE.Vector3();
const _VOLTAICO_PTS = Array.from({ length: 16 }, () => new THREE.Vector3());

/**
 * Atualiza todos os efeitos visuais secundários, partículas orbitais, tecidos articulados,
 * chamas vivas, arcos elétricos em ziguezague e tentáculos encadeados a cada frame.
 */
export function updateMinifigSecondaryVfx(
  minifig,
  dt,
  moveSpeed,
  maxRunSpeed,
  isGrounded,
  isFlying,
  isSupersonic
) {
  minifig.muzzleFlashTimer = Math.max(0, minifig.muzzleFlashTimer - dt);
  if (minifig.currentHeroKey === 'vingador' && minifig.vingadorWeapon === 'dual_smg') {
    const flashActive = minifig.muzzleFlashTimer > 0;
    if (minifig.leftMuzzleFlashMesh) {
      minifig.leftMuzzleFlashMesh.visible = flashActive && minifig.vingadorDualRecoilSide < 0;
    }
    if (minifig.muzzleFlashMesh) {
      minifig.muzzleFlashMesh.visible = flashActive && minifig.vingadorDualRecoilSide > 0;
    }
  } else {
    if (minifig.muzzleFlashMesh) {
      minifig.muzzleFlashMesh.visible = minifig.muzzleFlashTimer > 0;
    }
    if (minifig.leftMuzzleFlashMesh) {
      minifig.leftMuzzleFlashMesh.visible = minifig.muzzleFlashTimer > 0;
    }
  }

  if (isGrounded && !minifig.wasGrounded) {
    minifig.landingSquash = 1.0;
  }
  minifig.wasGrounded = isGrounded;
  minifig.landingSquash = THREE.MathUtils.lerp(minifig.landingSquash, 0, Math.min(1, dt * 12));

  // 1. Partículas orbitais de fogo + Cabelo de Fogo Vivo + Manto Real (Solaris / Turbo)
  if (minifig.flameParticles.length > 0) {
    for (const fp of minifig.flameParticles) {
      fp.angle += dt * fp.speed * (isSupersonic ? 2.5 : 1.0);
      const yCycle = ((minifig.animTime * 1.65 + fp.yOffset) % 2.1);
      fp.mesh.position.set(
        Math.cos(fp.angle) * fp.radius,
        0.2 + yCycle,
        Math.sin(fp.angle) * fp.radius
      );
      fp.mesh.rotation.x += dt * 4.5;
      fp.mesh.rotation.y += dt * 5.5;
      const s = 1.0 - (yCycle / 2.1) * 0.62;
      fp.mesh.scale.setScalar(isSupersonic ? s * 1.55 : s);
    }
  }

  if (minifig.crownFlameMeshes && minifig.crownFlameMeshes.length > 0) {
    const fireBoost = isSupersonic ? 1.45 : isFlying || minifig.isBeaming ? 1.25 : 1.0;
    for (const cf of minifig.crownFlameMeshes) {
      const wave = Math.sin(minifig.animTime * cf.speed + cf.phase);
      const wave2 = Math.cos(minifig.animTime * (cf.speed * 1.3) + cf.phase);
      const scaleY = (0.85 + (wave * 0.5 + 0.5) * 0.45) * fireBoost;
      const scaleXZ = 0.92 + wave2 * 0.14;
      cf.mesh.scale.set(scaleXZ, scaleY, scaleXZ);
      cf.mesh.rotation.x = cf.baseRotX + wave * 0.14;
      cf.mesh.rotation.z = cf.baseRotZ + wave2 * 0.14;
    }
  }

  if (minifig.solarMantleStrips && minifig.solarMantleStrips.length > 0) {
    const speedRatio = Math.min(1.5, moveSpeed / Math.max(1, maxRunSpeed));
    const baseLift = isSupersonic
      ? 0.58
      : isFlying
        ? 0.34 + speedRatio * 0.22
        : 0.16 + speedRatio * 0.35;
    const waveFreq = isSupersonic ? 18.0 : isFlying ? 11.0 : 6.5 + speedRatio * 5.0;
    const waveAmp = isSupersonic ? 0.22 : 0.12 + speedRatio * 0.12;
    for (const strip of minifig.solarMantleStrips) {
      const w = Math.sin(minifig.animTime * waveFreq + strip.phase);
      const wSide = Math.cos(minifig.animTime * (waveFreq * 0.75) + strip.phase);
      strip.pivot.rotation.x = baseLift + w * waveAmp;
      strip.pivot.rotation.z = strip.baseRotZ + wSide * 0.08;
      if (strip.tipCone) {
        strip.tipCone.scale.y = 0.85 + (w * 0.5 + 0.5) * 0.45;
      }
    }
  }

  // 2. Cachecol Ninja Longo de 2 Caudas + Aura Mística nas Katanas (Sombra Escarlate)
  if (minifig.sombraScarfStrips && minifig.sombraScarfStrips.length > 0) {
    const speedRatio = Math.min(1.8, moveSpeed / Math.max(1, maxRunSpeed));
    const baseLift = minifig.isGrappling
      ? 0.82
      : !isGrounded
        ? 0.55
        : 0.22 + speedRatio * 0.48;
    const waveFreq = 8.0 + speedRatio * 7.5;
    const waveAmp = 0.14 + speedRatio * 0.14;
    for (const sc of minifig.sombraScarfStrips) {
      const w = Math.sin(minifig.animTime * waveFreq + sc.phase);
      const wSide = Math.cos(minifig.animTime * (waveFreq * 0.8) + sc.phase);
      sc.pivot.rotation.x = baseLift + w * waveAmp;
      sc.pivot.rotation.z = sc.baseRotZ + wSide * 0.12;
      if (sc.tipCone) {
        sc.tipCone.scale.y = 0.85 + (w * 0.5 + 0.5) * 0.5;
      }
    }
  }

  if (minifig.katanaAuraFlames && minifig.katanaAuraFlames.length > 0) {
    for (const kf of minifig.katanaAuraFlames) {
      const pulse = 0.8 + Math.sin(minifig.animTime * 14.0 + kf.phase) * 0.35;
      const slide = Math.sin(minifig.animTime * 9.0 + kf.phase) * 0.08;
      kf.mesh.scale.set(1.0, pulse, 1.0);
      kf.mesh.position.z = kf.baseZ + slide;
    }
  }

  // 3. Abas Traseiras e Laterais do Sobretudo de Couro Preto (Vingador de Chumbo)
  if (minifig.vingadorCoatTails && minifig.vingadorCoatTails.length > 0) {
    const speedRatio = Math.min(1.6, moveSpeed / Math.max(1, maxRunSpeed));
    const baseLift = minifig.isDiveSliding
      ? 0.88
      : !isGrounded
        ? 0.56
        : 0.14 + speedRatio * 0.42;
    const waveFreq = 7.5 + speedRatio * 6.5;
    const waveAmp = 0.08 + speedRatio * 0.12;
    for (const ct of minifig.vingadorCoatTails) {
      const w = Math.sin(minifig.animTime * waveFreq + ct.phase);
      ct.pivot.rotation.x = baseLift + w * waveAmp;
      ct.pivot.rotation.z = ct.baseRotZ + ct.side * (speedRatio * 0.09 + Math.abs(w) * 0.06);
    }
  }

  // 4. Chamas Ciano da Caveira, Escapamentos V8 + Giro de Correntes (Turbo Fantasma)
  if (minifig.turboFlameMeshes && minifig.turboFlameMeshes.length > 0) {
    for (const tf of minifig.turboFlameMeshes) {
      const w = Math.sin(minifig.animTime * tf.speed + tf.phase);
      if (tf.isExhaust) {
        tf.mesh.scale.set(0.92 + w * 0.12, 0.8 + (w * 0.5 + 0.5) * 0.65, 0.92 + w * 0.12);
      } else {
        const sx = tf.baseScaleX || 0.95;
        const sz = tf.baseScaleZ || 0.95;
        tf.mesh.scale.set(sx, 0.85 + (w * 0.5 + 0.5) * 0.55, sz);
        tf.mesh.rotation.x = tf.baseRotX + w * 0.18;
        tf.mesh.rotation.z = tf.baseRotZ + Math.cos(minifig.animTime * tf.speed + tf.phase) * 0.15;
      }
    }
  }
  if (minifig.turboChainGroups && minifig.turboChainGroups.length > 0) {
    const spinAmp = minifig.punchTimer > 0 ? 18.0 : 4.5;
    for (let i = 0; i < minifig.turboChainGroups.length; i++) {
      minifig.turboChainGroups[i].rotation.z =
        Math.sin(minifig.animTime * spinAmp + i * Math.PI) * 0.35;
    }
  }

  // 5. Bobinas Tesla, Coroa de 14 Relâmpagos, Arco Dorsal em Ziguezague e Garra (Voltaico)
  if (minifig.voltaicoArcs && minifig.voltaicoArcs.length > 0) {
    const sparkScale = 0.9 + Math.sin(minifig.animTime * 28.0) * 0.18;
    for (const arc of minifig.voltaicoArcs) {
      arc.scale.setScalar(sparkScale);
    }
  }
  if (minifig.voltaicoCrownSpikes && minifig.voltaicoCrownSpikes.length > 0) {
    for (const cs of minifig.voltaicoCrownSpikes) {
      const w = Math.sin(minifig.animTime * cs.speed + cs.phase);
      cs.mesh.scale.set(0.94, 0.86 + (w * 0.5 + 0.5) * 0.45, 0.94);
      cs.mesh.rotation.x = cs.baseRotX + w * 0.14;
      cs.mesh.rotation.z = cs.baseRotZ + Math.cos(minifig.animTime * cs.speed + cs.phase) * 0.12;
    }
  }
  if (minifig.voltaicoBackArcSegments && minifig.voltaicoBackArcSegments.length > 0) {
    const first = minifig.voltaicoBackArcSegments[0];
    const n = first.total;
    const tx = first.termX;
    const ty = first.termY;
    const tz = first.termZ;
    for (let i = 0; i <= n; i++) {
      while (_VOLTAICO_PTS.length <= i) {
        _VOLTAICO_PTS.push(new THREE.Vector3());
      }
      const u = i / n;
      const x = -tx + u * (tx * 2);
      if (i === 0 || i === n) {
        _VOLTAICO_PTS[i].set(x, ty, tz);
      } else {
        const zigSign = i % 2 === 0 ? 1 : -1;
        const jitterY = Math.sin(minifig.animTime * 34.0 + i * 2.1) * 0.055 + zigSign * 0.065;
        const jitterZ = -0.04 + Math.cos(minifig.animTime * 29.0 + i * 1.7) * 0.035;
        _VOLTAICO_PTS[i].set(x, ty + 0.05 + jitterY, tz + jitterZ);
      }
    }
    for (let s = 0; s < minifig.voltaicoBackArcSegments.length; s++) {
      const seg = minifig.voltaicoBackArcSegments[s].mesh;
      const pA = _VOLTAICO_PTS[s];
      const pB = _VOLTAICO_PTS[s + 1];
      _VOLTAICO_DIR.subVectors(pB, pA);
      const len = Math.max(0.001, _VOLTAICO_DIR.length());
      seg.position.copy(pA).addScaledVector(_VOLTAICO_DIR, 0.5);
      seg.scale.set(1, len, 1);
      seg.quaternion.setFromUnitVectors(_VOLTAICO_UP, _VOLTAICO_DIR.multiplyScalar(1 / len));
    }
  }
  if (minifig.voltaicoLeftClawGroup) {
    minifig.voltaicoLeftClawGroup.rotation.z += dt * (minifig.punchTimer > 0 ? 18.0 : 6.5);
    const clawPulse = 0.94 + Math.sin(minifig.animTime * 24.0) * 0.14;
    minifig.voltaicoLeftClawGroup.scale.setScalar(clawPulse);
  }
  if (minifig.voltaicoStaffOrb) {
    minifig.voltaicoStaffOrb.rotation.x += dt * 7.5;
    minifig.voltaicoStaffOrb.rotation.y += dt * 9.5;
    const orbPulse = 0.92 + Math.sin(minifig.animTime * 22.0) * 0.22;
    minifig.voltaicoStaffOrb.scale.setScalar(orbPulse);
  }

  // 6. Ondulação Viva dos 4 Tentáculos Simbiontes de 5 Segmentos + Língua Longa 3D (Vórtex)
  if (minifig.vortexTentacles && minifig.vortexTentacles.length > 0) {
    const attackBoost = minifig.punchTimer > 0 ? 2.4 : 1.0;
    for (const t of minifig.vortexTentacles) {
      const w1 = Math.sin(minifig.animTime * 4.2 * attackBoost + t.phase);
      const w2 = Math.cos(minifig.animTime * 3.1 * attackBoost + t.phase);
      t.pivot.rotation.z = t.baseRotZ + w1 * 0.16 * attackBoost;
      t.pivot.rotation.y = t.baseRotY + w2 * 0.22 * attackBoost;
      t.pivot.rotation.x = minifig.punchTimer > 0 ? 0.65 : w1 * 0.1;

      if (t.segments) {
        for (const seg of t.segments) {
          const segWave = Math.sin(
            minifig.animTime * 5.6 * attackBoost + t.phase - seg.segIndex * 0.72
          );
          const segSide = Math.cos(
            minifig.animTime * 4.4 * attackBoost + t.phase - seg.segIndex * 0.65
          );
          seg.pivot.rotation.x = seg.baseRotX + segWave * 0.22 * attackBoost;
          seg.pivot.rotation.z = seg.baseRotZ + segSide * 0.18 * attackBoost;
        }
      }
    }
  }

  if (minifig.vortexTongueSegments && minifig.vortexTongueSegments.length > 0) {
    for (const ts of minifig.vortexTongueSegments) {
      const tw = Math.sin(minifig.animTime * 7.5 - ts.index * 0.85);
      const tz = Math.cos(minifig.animTime * 5.8 - ts.index * 0.75);
      ts.pivot.rotation.x = ts.baseX + tw * 0.18;
      ts.pivot.rotation.z = ts.baseZ + tz * 0.24;
    }
  }
}

export function updateCapeBillow(minifig, lerpSpeed, isGrounded, isFlying, isSupersonic) {
  if (!minifig.capeMesh) return;
  const targetCapeAngle =
    isSupersonic ? 0.18 :
      isFlying ? 0.42 :
        minifig.state === 'RUN' ? 0.55 :
          minifig.state === 'WALK' ? 0.3 :
            !isGrounded ? 0.65 : 0.12;
  minifig.capeMesh.rotation.x = THREE.MathUtils.lerp(
    minifig.capeMesh.rotation.x,
    targetCapeAngle + Math.sin(minifig.animTime * 7) * 0.05,
    lerpSpeed
  );
}

export function updateTitaSirensAndThrusters(minifig, isGrounded, verticalVelocity) {
  if (minifig.titaSirenLights && minifig.titaSirenLights.length > 0) {
    const sirenCycle = Math.sin(minifig.animTime * 14.0) > 0;
    for (const s of minifig.titaSirenLights) {
      const active = s.isRed ? sirenCycle : !sirenCycle;
      s.mesh.scale.setScalar(active ? 1.16 : 0.88);
    }
  }
  if (minifig.titaDashFlameMeshes && minifig.titaDashFlameMeshes.length > 0) {
    const showJetFlames =
      minifig.isDashing ||
      minifig.titaJumpChargeRatio > 0.05 ||
      (!isGrounded && verticalVelocity > 2.0);
    const flamePulse = 0.85 + Math.sin(minifig.animTime * 42.0) * 0.35;
    for (const jf of minifig.titaDashFlameMeshes) {
      jf.visible = showJetFlames;
      if (showJetFlames) {
        const boost = minifig.isDashing ? 1.45 : 0.8 + minifig.titaJumpChargeRatio * 0.85;
        jf.scale.set(1.0, flamePulse * boost, 1.0);
      }
    }
  }
}
