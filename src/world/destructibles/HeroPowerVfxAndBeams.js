import * as THREE from 'three';
import { disposeTransientObject3D } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { TRAIL_CUBE_GEO } from './DestructibleRegistryAndCulling.js';

export const HERO_POWER_VFX_AND_BEAMS_METHODS = {
  _initSolarBeamMesh() {
    this.solarBeamGroup = new THREE.Group();
    this.solarBeamGroup.visible = false;

    const coreGeo = new THREE.CylinderGeometry(0.22, 0.22, 1, 16);
    coreGeo.translate(0, 0.5, 0);
    coreGeo.rotateX(Math.PI / 2);
    this.beamCore = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));

    const mantleGeo = new THREE.CylinderGeometry(0.45, 0.45, 1, 18);
    mantleGeo.translate(0, 0.5, 0);
    mantleGeo.rotateX(Math.PI / 2);
    this.beamGlow = new THREE.Mesh(
      mantleGeo,
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.78 })
    );

    const coronaGeo = new THREE.CylinderGeometry(0.72, 0.72, 1, 18);
    coronaGeo.translate(0, 0.5, 0);
    coronaGeo.rotateX(Math.PI / 2);
    this.beamCorona = new THREE.Mesh(
      coronaGeo,
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.44 })
    );

    this.solarBeamGroup.add(this.beamCore, this.beamGlow, this.beamCorona);
    this.scene.add(this.solarBeamGroup);

    this.solarMuzzleGroup = new THREE.Group();
    this.solarMuzzleGroup.visible = false;
    const muzzleSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const muzzleOuter = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.72 })
    );
    this.muzzleRingA = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.055, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    this.muzzleRingB = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.045, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    this.muzzleRingB.rotation.x = Math.PI / 2;
    this.solarMuzzleGroup.add(muzzleSphere, muzzleOuter, this.muzzleRingA, this.muzzleRingB);
    this.scene.add(this.solarMuzzleGroup);

    this.solarBeamRings = [];
    const beamRingGeo = new THREE.TorusGeometry(0.62, 0.06, 8, 20);
    for (let i = 0; i < 8; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xfef08a : 0xf97316,
        transparent: true,
        opacity: 0.88
      });
      const ringMesh = new THREE.Mesh(beamRingGeo, ringMat);
      ringMesh.visible = false;
      this.scene.add(ringMesh);
      this.solarBeamRings.push(ringMesh);
    }

    this.beamHitSphere = new THREE.Group();
    this.beamHitSphere.visible = false;

    const hitCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const hitDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.78 })
    );
    const vortexRingGeo = new THREE.TorusGeometry(1.6, 0.14, 10, 28);
    vortexRingGeo.rotateX(Math.PI / 2);
    this.beamVortexRing = new THREE.Mesh(
      vortexRingGeo,
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.92 })
    );
    this.beamVortexSpikes = new THREE.Group();
    for (let s = 0; s < 6; s++) {
      const ang = (s / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 1.35, 5),
        new THREE.MeshBasicMaterial({ color: s % 2 === 0 ? 0xfef08a : 0xef4444 })
      );
      spike.position.set(Math.cos(ang) * 1.15, 0.45, Math.sin(ang) * 1.15);
      spike.rotation.z = -Math.cos(ang) * 0.42;
      spike.rotation.x = Math.sin(ang) * 0.42;
      this.beamVortexSpikes.add(spike);
    }
    this.beamHitSphere.add(hitCore, hitDome, this.beamVortexRing, this.beamVortexSpikes);
    this.scene.add(this.beamHitSphere);

    this._initSupernovaChargeMeter();
  },

  _initSupernovaChargeMeter() {
    this.supernovaChargeGroup = new THREE.Group();
    this.supernovaChargeGroup.visible = false;

    this.chargeArcSegments = [];
    const segCount = 24;
    const segRadius = 1.95;
    const segGeo = new THREE.BoxGeometry(0.36, 0.16, 0.24);
    for (let i = 0; i < segCount; i++) {
      const angle = (i / segCount) * Math.PI * 2;
      const segMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95 });
      const segMesh = new THREE.Mesh(segGeo, segMat);
      segMesh.position.set(Math.sin(angle) * segRadius, 0.12, Math.cos(angle) * segRadius);
      segMesh.rotation.y = angle;
      this.supernovaChargeGroup.add(segMesh);
      this.chargeArcSegments.push(segMesh);
    }

    this.chargeInnerSunGroup = new THREE.Group();
    const innerRingGeo = new THREE.TorusGeometry(1.35, 0.08, 8, 28);
    innerRingGeo.rotateX(Math.PI / 2);
    this.chargeInnerRing = new THREE.Mesh(
      innerRingGeo,
      new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.9 })
    );
    this.chargeInnerRing.position.y = 0.08;
    this.chargeInnerSunGroup.add(this.chargeInnerRing);

    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * Math.PI * 2;
      const ray = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.85, 4),
        new THREE.MeshBasicMaterial({ color: r % 2 === 0 ? 0xfacc15 : 0xf97316 })
      );
      ray.rotation.x = Math.PI / 2;
      ray.rotation.z = -ang;
      ray.position.set(Math.sin(ang) * 0.95, 0.09, Math.cos(ang) * 0.95);
      this.chargeInnerSunGroup.add(ray);
    }
    this.supernovaChargeGroup.add(this.chargeInnerSunGroup);

    const rangeRingGeo = new THREE.TorusGeometry(1.0, 0.018, 10, 64);
    rangeRingGeo.rotateX(Math.PI / 2);
    this.chargeRangeRingMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.88 });
    this.chargeRangeRing = new THREE.Mesh(rangeRingGeo, this.chargeRangeRingMat);
    this.chargeRangeRing.position.y = 0.14;
    this.supernovaChargeGroup.add(this.chargeRangeRing);

    const rangeSubRingGeo = new THREE.TorusGeometry(1.0, 0.01, 8, 48);
    rangeSubRingGeo.rotateX(Math.PI / 2);
    this.chargeSubRingMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.65 });
    this.chargeSubRing = new THREE.Mesh(rangeSubRingGeo, this.chargeSubRingMat);
    this.chargeSubRing.position.y = 0.12;
    this.supernovaChargeGroup.add(this.chargeSubRing);

    this.scene.add(this.supernovaChargeGroup);
  },

  spawnCaveiraBlastJumpTrail(pos) {
    const colors = [0x1e293b, 0x334155, 0xf97316, 0xfacc15];
    for (let i = 0; i < 2; i++) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      this._spawnFxParticle(
        TRAIL_CUBE_GEO, c, 0.9,
        pos.x + (Math.random() - 0.5) * 0.55,
        pos.y + 0.18 + Math.random() * 0.35,
        pos.z + (Math.random() - 0.5) * 0.55,
        1.15, 1.15, 1.15,
        (Math.random() - 0.5) * 2.6,
        0.8 + Math.random() * 2.2,
        (Math.random() - 0.5) * 2.6,
        0.34
      );
    }
  },

  updateSolarBeam(isActive, handOrigin, aimData, dt) {
    if (!isActive) {
      this.solarBeamGroup.visible = false;
      this.beamHitSphere.visible = false;
      if (this.solarMuzzleGroup) this.solarMuzzleGroup.visible = false;
      if (this.solarBeamRings) {
        for (const r of this.solarBeamRings) r.visible = false;
      }
      return;
    }

    this.solarBeamGroup.visible = true;
    this.beamHitSphere.visible = true;
    if (this.solarMuzzleGroup) this.solarMuzzleGroup.visible = true;

    const targetPt = aimData.point;
    const dist = Math.max(0.5, handOrigin.distanceTo(targetPt));
    const nowSec = performance.now() * 0.001;

    this.solarBeamGroup.position.copy(handOrigin);
    this.solarBeamGroup.lookAt(targetPt);
    const pulse = 0.92 + Math.sin(nowSec * 36.0) * 0.22;
    this.solarBeamGroup.scale.set(pulse, pulse, dist);

    if (this.solarMuzzleGroup) {
      this.solarMuzzleGroup.position.copy(handOrigin);
      this.solarMuzzleGroup.lookAt(targetPt);
      const muzzleScale = 0.9 + Math.sin(nowSec * 42.0) * 0.18;
      this.solarMuzzleGroup.scale.setScalar(muzzleScale);
      if (this.muzzleRingA) {
        this.muzzleRingA.rotation.z += dt * 12.0;
        this.muzzleRingA.rotation.x = Math.sin(nowSec * 8.0) * 0.45;
      }
      if (this.muzzleRingB) {
        this.muzzleRingB.rotation.y += dt * 15.0;
        this.muzzleRingB.rotation.z += dt * 9.0;
      }
    }

    if (this.solarBeamRings && this.solarBeamRings.length > 0) {
      const ringCount = this.solarBeamRings.length;
      for (let i = 0; i < ringCount; i++) {
        const ring = this.solarBeamRings[i];
        ring.visible = true;
        const u = (nowSec * 3.8 + i / ringCount) % 1.0;
        ring.position.lerpVectors(handOrigin, targetPt, u);
        ring.lookAt(targetPt);
        ring.rotation.z = nowSec * 10.0 + i * 0.8;
        const s = 0.65 + Math.sin(u * Math.PI) * 0.75;
        ring.scale.setScalar(s);
        ring.material.opacity = (1.0 - u * 0.55) * 0.92;
      }
    }

    this.beamHitSphere.position.copy(targetPt);
    const hitScale = 0.92 + Math.sin(nowSec * 38.0) * 0.24;
    this.beamHitSphere.scale.setScalar(hitScale);
    if (this.beamVortexRing) {
      this.beamVortexRing.rotation.z += dt * 10.0;
    }
    if (this.beamVortexSpikes) {
      this.beamVortexSpikes.rotation.y -= dt * 14.0;
    }

    this.beamSoundCooldown -= dt;
    if (this.beamSoundCooldown <= 0) {
      this.beamSoundCooldown = 0.085;
      soundFX.playSolarBeamTick();
    }

    if (Math.random() < 0.82) {
      this.spawnFlameTrailParticle(targetPt, 1.25);
    }

    const beamDps = 62;
    if (aimData.hitObj && !aimData.hitObj.destroyed) {
      this.damageObject(aimData.hitObj, beamDps * dt, targetPt, true);
    } else {
      const beamNear = this.getObjectsNear(targetPt.x, targetPt.z, 5.0);
      for (let i = 0; i < beamNear.length; i++) {
        const obj = beamNear[i];
        if (obj.destroyed) continue;
        const dHoriz = Math.hypot(obj.basePos.x - targetPt.x, obj.basePos.z - targetPt.z);
        const dVert = Math.abs((obj.basePos.y + obj.height * 0.5) - targetPt.y);
        if (dHoriz <= obj.radius + 1.15 && dVert <= obj.height * 0.75 + 0.9) {
          this.damageObject(obj, beamDps * dt, targetPt, true);
        }
      }
    }
  },

  updateSupernovaChargeVisual(isActive, playerPos, chargeRatio = 0, currentRadius = 12, dt = 0.016, groundY = null) {
    if (!this.supernovaChargeGroup) return;
    if (!isActive) {
      this.supernovaChargeGroup.visible = false;
      return;
    }

    this.supernovaChargeGroup.visible = true;
    const clamped = THREE.MathUtils.clamp(chargeRatio, 0, 1);
    const floorY = groundY !== null ? groundY : playerPos.y;
    this.supernovaChargeGroup.position.set(playerPos.x, floorY + 0.05, playerPos.z);

    const isMax = clamped >= 0.98;
    const flashWhite = isMax && Math.sin(performance.now() * 0.045) > 0;
    const activeColorHex = flashWhite
      ? 0xffffff
      : clamped >= 0.75
        ? 0xef4444
        : clamped >= 0.35
          ? 0xf97316
          : 0xfacc15;

    const totalSegs = this.chargeArcSegments.length;
    const litCount = Math.max(1, Math.ceil(clamped * totalSegs));
    for (let i = 0; i < totalSegs; i++) {
      const seg = this.chargeArcSegments[i];
      if (i < litCount) {
        seg.material.color.setHex(activeColorHex);
        seg.material.opacity = 0.96;
        const pop = i === litCount - 1 ? 1.45 : 1.0 + clamped * 0.35;
        seg.scale.set(1.0, pop, 1.0 + clamped * 0.3);
      } else {
        seg.material.color.setHex(0x451a03);
        seg.material.opacity = 0.35;
        seg.scale.set(0.85, 0.55, 0.85);
      }
    }

    if (this.chargeInnerSunGroup) {
      this.chargeInnerSunGroup.rotation.y += dt * (2.5 + clamped * 14.0);
      const innerScale = 0.95 + clamped * 0.55;
      this.chargeInnerSunGroup.scale.set(innerScale, 1.0, innerScale);
    }

    if (this.chargeRangeRing) {
      this.chargeRangeRing.scale.set(currentRadius, currentRadius, 1.0);
      this.chargeRangeRingMat.color.setHex(activeColorHex);
      this.chargeRangeRingMat.opacity = 0.75 + Math.sin(performance.now() * 0.025) * 0.2;
    }
    if (this.chargeSubRing) {
      const subR = currentRadius * (0.55 + ((performance.now() * 0.0015) % 0.45));
      this.chargeSubRing.scale.set(subR, subR, 1.0);
      this.chargeSubRingMat.color.setHex(flashWhite ? 0xffffff : 0xfef08a);
    }

    if (Math.random() < 0.45 + clamped * 0.5) {
      const ang = Math.random() * Math.PI * 2;
      const r = 1.6 + Math.random() * (1.5 + clamped * 4.5);
      this.spawnFlameTrailParticle(
        new THREE.Vector3(playerPos.x + Math.cos(ang) * r, floorY + 0.25, playerPos.z + Math.sin(ang) * r),
        0.95 + clamped * 0.9
      );
    }
  },

  triggerSupernova(centerPos, chargeRatio = 0, groundY = null) {
    if (this.supernovaChargeGroup) {
      this.supernovaChargeGroup.visible = false;
    }
    const clampedCharge = THREE.MathUtils.clamp(chargeRatio, 0, 1);
    const blastRadius = THREE.MathUtils.lerp(12.0, 52.0, clampedCharge);
    const blastDamage = THREE.MathUtils.lerp(110.0, 350.0, clampedCharge);

    const origin = centerPos.clone();
    origin.y += 1.1;
    const floorY = groundY !== null ? groundY : centerPos.y;

    this._triggerExplosion(origin, blastRadius, blastDamage, false, true, {
      canBreakCrackedWall: true,
      canBreakSilver: clampedCharge >= 0.35,
      chargeRatio: clampedCharge,
      groundY: floorY
    });
  },

  spawnFlameTrailParticle(pos, scale = 1.0, customHex = null) {
    const colors = [0xfef08a, 0xfacc15, 0xf97316, 0xef4444];
    const c = typeof customHex === 'number' ? customHex : colors[Math.floor(Math.random() * colors.length)];
    this._spawnFxParticle(
      TRAIL_CUBE_GEO, c, 0.9,
      pos.x + (Math.random() - 0.5) * 0.45,
      pos.y + (Math.random() - 0.5) * 0.45,
      pos.z + (Math.random() - 0.5) * 0.45,
      scale, scale, scale,
      (Math.random() - 0.5) * 2.4,
      1.5 + Math.random() * 2.5,
      (Math.random() - 0.5) * 2.4,
      0.38
    );
  },

  spawnHeroSwapEffect(pos, colorHex = 0xfacc15) {
    soundFX.playHeroSwap();
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      this._spawnFxParticle(
        TRAIL_CUBE_GEO, colorHex, 0.95,
        pos.x + Math.cos(angle) * 0.6,
        pos.y + 1.0,
        pos.z + Math.sin(angle) * 0.6,
        1, 1, 1,
        Math.cos(angle) * 4.5,
        2.2 + Math.random() * 2.5,
        Math.sin(angle) * 4.5,
        0.42
      );
    }
  },

  _updateFxParticlesAndBeams(dt) {
    for (let i = this.fxParticles.length - 1; i >= 0; i--) {
      const fp = this.fxParticles[i];
      fp.life -= dt;
      if (fp.life <= 0) {
        this.scene.remove(fp.mesh);
        if (fp._pooled && this._fxPool.length < 512) {
          this._fxPool.push(fp);
        } else {
          disposeTransientObject3D(fp.mesh);
        }
        this.fxParticles.splice(i, 1);
        continue;
      }
      fp.mesh.position.addScaledVector(fp.vel, dt);
      fp.mesh.rotation.x += dt * 6;
      fp.mesh.rotation.y += dt * 6;
      const ratio = fp.life / fp.maxLife;
      fp.mesh.scale.setScalar(ratio);
      if (fp.mesh.material) {
        fp.mesh.material.opacity = ratio;
      }
    }

    for (let i = this.timedBeams.length - 1; i >= 0; i--) {
      const tb = this.timedBeams[i];
      tb.life -= dt;
      if (tb.life <= 0) {
        this.scene.remove(tb.mesh);
        disposeTransientObject3D(tb.mesh);
        this.timedBeams.splice(i, 1);
        continue;
      }
      const ratio = Math.max(0, tb.life / tb.maxLife);
      if (typeof tb.onUpdate === 'function') {
        tb.onUpdate(dt, ratio);
      }
      if (Array.isArray(tb.materials)) {
        for (const m of tb.materials) {
          if (m.mat) {
            m.mat.opacity = m.baseOpacity * ratio;
          }
        }
      }
    }

    for (let i = this.lightWallSegments.length - 1; i >= 0; i--) {
      const seg = this.lightWallSegments[i];
      seg.life -= dt;
      if (seg.life <= 0) {
        this.scene.remove(seg.mesh);
        disposeTransientObject3D(seg.mesh);
        this.lightWallSegments.splice(i, 1);
        continue;
      }
      if (seg.life < 0.65) {
        const fade = seg.life / 0.65;
        seg.wallMat.opacity = 0.72 * fade;
        seg.railMat.opacity = 0.96 * fade;
      }
      if (seg.maxLife - seg.life > 0.15) {
        const segNear = this.getObjectsNear(seg.midPos.x, seg.midPos.z, seg.halfLen + 5.0);
        for (let si = 0; si < segNear.length; si++) {
          const obj = segNear[si];
          if (obj.destroyed || obj.isDriven || obj.isGrabbed) continue;
          const ox = obj._isDynamicIndexed ? (obj.mesh?.position?.x ?? obj.basePos.x) : obj.basePos.x;
          const oy = obj._isDynamicIndexed ? (obj.mesh?.position?.y ?? obj.basePos.y) : obj.basePos.y;
          const oz = obj._isDynamicIndexed ? (obj.mesh?.position?.z ?? obj.basePos.z) : obj.basePos.z;
          const d = Math.hypot(ox - seg.midPos.x, oz - seg.midPos.z);
          if (d <= obj.radius + seg.halfLen && Math.abs(oy - seg.midPos.y) <= 2.6) {
            this.damageObject(obj, 220, seg.midPos, false, { canBreakCrackedWall: true });
          }
        }
      }
    }
  }
};
