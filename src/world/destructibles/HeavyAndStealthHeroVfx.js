import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { FIREBALL_GEO, TRAIL_CUBE_GEO, _TMP_IMPACT_VEC } from './DestructibleRegistryAndCulling.js';
import { DEBRIS_BRICK_GEO, DEBRIS_STUD_GEO } from './DebrisAndStudMagnetPhysics.js';

export const HEAVY_AND_STEALTH_HERO_VFX_METHODS = {
  /**
   * Investida / Dash Demolidor do Titã Blindado [Mouse 2 / V]
   */
  triggerTitaRocketPunch(playerPos, facingAngle) {
    soundFX.playExplosion(1.05);
    const impactCenter = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 2.8,
      playerPos.y + 1.45,
      playerPos.z + Math.cos(facingAngle) * 2.8
    );

    const ringGeo = new THREE.TorusGeometry(1, 0.16, 12, 28);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.95 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(impactCenter);
    ringMesh.rotation.y = facingAngle;
    this.scene.add(ringMesh);

    const whiteRingGeo = new THREE.TorusGeometry(1, 0.1, 10, 28);
    const whiteRingMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.92 });
    const whiteRingMesh = new THREE.Mesh(whiteRingGeo, whiteRingMat);
    whiteRingMesh.position.copy(impactCenter);
    whiteRingMesh.rotation.y = facingAngle;
    this.scene.add(whiteRingMesh);

    this.explosions.push({
      sphereMesh: null,
      ringMesh,
      extraMeshes: [whiteRingMesh],
      extraRings: [{ mesh: whiteRingMesh, speedMult: 1.32 }],
      maxRadius: 6.4,
      age: 0,
      duration: 0.28
    });

    for (let i = 0; i < 14; i++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xef4444 : 0xf8fafc,
        transparent: true,
        opacity: 0.95
      });
      const pMesh = new THREE.Mesh(DEBRIS_STUD_GEO, pMat);
      pMesh.position.copy(impactCenter);
      this.scene.add(pMesh);
      const ang = facingAngle + (Math.random() - 0.5) * 1.4;
      const spd = 12 + Math.random() * 18;
      this.fxParticles.push({
        mesh: pMesh,
        vel: new THREE.Vector3(Math.sin(ang) * spd, 2 + Math.random() * 8, Math.cos(ang) * spd),
        life: 0.28 + Math.random() * 0.18,
        maxLife: 0.45
      });
    }

    const punchNear = this.getObjectsNear(impactCenter.x, impactCenter.z, 9.5);
    for (let i = 0; i < punchNear.length; i++) {
      const obj = punchNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const dx = obj.basePos.x - impactCenter.x;
      const dz = obj.basePos.z - impactCenter.z;
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - impactCenter.y);
      if (Math.hypot(dx, dz) <= obj.radius + 5.4 && dy <= obj.height + 3.0) {
        this.damageObject(obj, 140, impactCenter, false, {
          canBreakCrackedWall: true,
          canBreakSilver: false
        });
      }
    }
  },

  /**
   * Pisada Sísmica no Chão [Q] e Impacto do Super-Pulo do Titã Blindado
   */
  triggerTitaGroundSlam(centerPos, radius = 22.0, damage = 150, groundY = null) {
    soundFX.playSeismicStomp();
    const floorY = groundY !== null
      ? groundY
      : (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(centerPos.x, centerPos.z) : centerPos.y);
    const slamCenter = new THREE.Vector3(centerPos.x, floorY + 0.12, centerPos.z);

    const ringGeo = new THREE.TorusGeometry(1, 0.18, 12, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.96 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(slamCenter);
    this.scene.add(ringMesh);

    const extraMeshes = [];
    const extraRings = [];

    const ringConfigs = [
      { color: 0xf8fafc, tube: 0.13, speedMult: 1.22, yOff: 0.08 },
      { color: 0x94a3b8, tube: 0.11, speedMult: 0.78, yOff: 0.05 }
    ];
    for (const rc of ringConfigs) {
      const rGeo = new THREE.TorusGeometry(1, rc.tube, 10, 44);
      rGeo.rotateX(Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({ color: rc.color, transparent: true, opacity: 0.92 });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.set(centerPos.x, floorY + rc.yOff, centerPos.z);
      this.scene.add(rMesh);
      extraMeshes.push(rMesh);
      extraRings.push({ mesh: rMesh, speedMult: rc.speedMult });
    }

    const eruptionSpikes = [];
    for (let i = 0; i < 20; i++) {
      const isOuter = i >= 10;
      const idxInRing = isOuter ? i - 10 : i;
      const angle = (idxInRing / 10) * Math.PI * 2 + (isOuter ? 0.31 : 0);
      const dist = isOuter ? radius * 0.68 : radius * 0.32;
      const slabH = (isOuter ? 3.4 : 2.5) + Math.random() * 1.4;
      const slabW = isOuter ? 1.55 : 1.15;

      const slabGeo = new THREE.BoxGeometry(slabW, slabH, 0.52);
      slabGeo.translate(0, slabH * 0.5, 0);
      const slabColor = i % 3 === 0 ? 0xef4444 : i % 2 === 0 ? 0x334155 : 0x475569;
      const slabMat = new THREE.MeshBasicMaterial({ color: slabColor, transparent: true, opacity: 0.96 });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(centerPos.x + Math.cos(angle) * dist, floorY, centerPos.z + Math.sin(angle) * dist);
      slabMesh.rotation.y = -angle + Math.PI * 0.5;
      slabMesh.rotation.x = -0.38;
      slabMesh.scale.set(1, 0.01, 1);
      this.scene.add(slabMesh);
      extraMeshes.push(slabMesh);
      eruptionSpikes.push({ mesh: slabMesh, delay: isOuter ? 0.12 : 0.02 });
    }

    for (let i = 0; i < 8; i++) {
      const crackAng = (i / 8) * Math.PI * 2;
      const crackLen = radius * 0.82;
      const crackGeo = new THREE.BoxGeometry(0.28, 0.08, crackLen);
      crackGeo.translate(0, 0.04, crackLen * 0.5);
      const crackMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xef4444 : 0xf8fafc,
        transparent: true,
        opacity: 0.92
      });
      const crackMesh = new THREE.Mesh(crackGeo, crackMat);
      crackMesh.position.set(centerPos.x, floorY + 0.03, centerPos.z);
      crackMesh.rotation.y = crackAng;
      this.scene.add(crackMesh);
      extraMeshes.push(crackMesh);
      eruptionSpikes.push({ mesh: crackMesh, delay: 0.0 });
    }

    for (let i = 0; i < 32; i++) {
      const pColor = i % 3 === 0 ? 0xef4444 : i % 2 === 0 ? 0x334155 : 0xf8fafc;
      const pMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.95 });
      const pMesh = new THREE.Mesh(i % 2 === 0 ? DEBRIS_BRICK_GEO : DEBRIS_STUD_GEO, pMat);
      const ang = Math.random() * Math.PI * 2;
      const rOff = 1.0 + Math.random() * (radius * 0.55);
      pMesh.position.set(centerPos.x + Math.cos(ang) * rOff, floorY + 0.35, centerPos.z + Math.sin(ang) * rOff);
      pMesh.scale.setScalar(1.35);
      this.scene.add(pMesh);
      const spd = 8 + Math.random() * 22;
      this.fxParticles.push({
        mesh: pMesh,
        vel: new THREE.Vector3(Math.cos(ang) * spd, 9 + Math.random() * 18, Math.sin(ang) * spd),
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8
      });
    }

    this.explosions.push({
      sphereMesh: null,
      ringMesh,
      extraMeshes,
      extraRings,
      eruptionSpikes,
      maxRadius: radius,
      age: 0,
      duration: 0.62
    });

    const slamNear = this.getObjectsNear(slamCenter.x, slamCenter.z, radius + 5.0);
    for (let i = 0; i < slamNear.length; i++) {
      const obj = slamNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const dHoriz = Math.hypot(obj.basePos.x - slamCenter.x, obj.basePos.z - slamCenter.z);
      const dVert = Math.abs(obj.basePos.y - floorY);
      if (dHoriz <= radius + obj.radius && dVert <= 7.5) {
        this.damageObject(obj, damage, slamCenter, false, {
          canBreakCrackedWall: true,
          canBreakSilver: false
        });
      }
    }
  },

  spawnVingadorThrusterBlast(centerPos) {
    soundFX.playExplosion(1.1);
    soundFX.playTacticalRoll();

    const origin = new THREE.Vector3(centerPos.x, centerPos.y + 0.55, centerPos.z);

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const isFire = i % 2 === 0;
      const pMat = new THREE.MeshBasicMaterial({
        color: isFire ? 0xf97316 : 0x1e293b,
        transparent: true,
        opacity: 0.92
      });
      const puff = new THREE.Mesh(isFire ? TRAIL_CUBE_GEO : FIREBALL_GEO, pMat);
      puff.position.set(origin.x + Math.cos(angle) * 0.7, origin.y, origin.z + Math.sin(angle) * 0.7);
      puff.scale.setScalar(isFire ? 1.65 : 1.35);
      this.scene.add(puff);

      this.fxParticles.push({
        mesh: puff,
        vel: new THREE.Vector3(
          Math.cos(angle) * (14.0 + Math.random() * 8.0),
          1.5 + Math.random() * 4.0,
          Math.sin(angle) * (14.0 + Math.random() * 8.0)
        ),
        life: 0.36,
        maxLife: 0.36
      });

      if (i % 2 === 0) {
        this._spawnEjectedBrassShell(origin, i % 4 === 0);
      }
    }

    const thrusterNear = this.getObjectsNear(origin.x, origin.z, 10.5);
    for (let i = 0; i < thrusterNear.length; i++) {
      const obj = thrusterNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - origin.x, obj.basePos.z - origin.z);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - origin.y);
      if (d <= obj.radius + 6.8 && dy <= obj.height + 3.2) {
        this.damageObject(obj, 130, origin, false, { canBreakCrackedWall: true });
      }
    }
  },

  spawnVingadorShellAndSmokeTrail(pos) {
    this._spawnFxParticle(
      TRAIL_CUBE_GEO,
      Math.random() < 0.35 ? 0xdc2626 : 0x111827,
      0.84,
      pos.x + (Math.random() - 0.5) * 0.65,
      pos.y + 0.25 + Math.random() * 0.65,
      pos.z + (Math.random() - 0.5) * 0.65,
      1.35, 1.35, 1.35,
      (Math.random() - 0.5) * 2.2,
      1.2 + Math.random() * 2.2,
      (Math.random() - 0.5) * 2.2,
      0.34
    );

    if (Math.random() < 0.45) {
      _TMP_IMPACT_VEC.set(pos.x, pos.y + 1.1, pos.z);
      this._spawnEjectedBrassShell(_TMP_IMPACT_VEC, false);
    }
  },

  /**
   * Combo de 3 Cortes da Lua de Sangue [Mouse 1 / V] do Sombra Escarlate
   */
  performKatanaSlash(playerPos, facingAngle, targetPoint = null) {
    soundFX.playPunchSwing();
    soundFX.playLaserShot();

    this._katanaComboIndex = ((this._katanaComboIndex || 0) + 1) % 3;
    const isCrossX = this._katanaComboIndex === 0;
    const rollAngles = isCrossX ? [0.61, -0.61] : [this._katanaComboIndex === 1 ? 0.61 : -0.61];

    const origin = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.35,
      playerPos.y + 1.28,
      playerPos.z + Math.cos(facingAngle) * 1.35
    );

    const slashDir = targetPoint
      ? targetPoint.clone().sub(origin).normalize()
      : new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle)).normalize();

    const slashGroup = new THREE.Group();
    const crescentRadius = isCrossX ? 2.15 : 1.8;

    const buildCrescentArc = (rollAngle) => {
      const arcWrapper = new THREE.Group();

      const shadowGeo = new THREE.TorusGeometry(crescentRadius * 1.04, 0.16, 8, 28, Math.PI * 1.15);
      shadowGeo.rotateX(Math.PI / 2);
      shadowGeo.rotateY(-Math.PI * 0.575);
      const shadowMesh = new THREE.Mesh(
        shadowGeo,
        new THREE.MeshBasicMaterial({ color: 0x090a0d, transparent: true, opacity: 0.88 })
      );
      shadowMesh.scale.set(1.0, 0.35, 1.35);
      arcWrapper.add(shadowMesh);

      const crimsonGeo = new THREE.TorusGeometry(crescentRadius, 0.12, 10, 28, Math.PI * 1.12);
      crimsonGeo.rotateX(Math.PI / 2);
      crimsonGeo.rotateY(-Math.PI * 0.56);
      const crimsonMesh = new THREE.Mesh(
        crimsonGeo,
        new THREE.MeshBasicMaterial({ color: 0xff1e42, transparent: true, opacity: 0.96 })
      );
      crimsonMesh.scale.set(1.0, 0.42, 1.28);
      arcWrapper.add(crimsonMesh);

      const coreGeo = new THREE.TorusGeometry(crescentRadius * 0.96, 0.065, 8, 26, Math.PI * 1.05);
      coreGeo.rotateX(Math.PI / 2);
      coreGeo.rotateY(-Math.PI * 0.525);
      const coreMesh = new THREE.Mesh(
        coreGeo,
        new THREE.MeshBasicMaterial({ color: 0xfecaca, transparent: true, opacity: 0.98 })
      );
      coreMesh.scale.set(1.0, 0.45, 1.22);
      arcWrapper.add(coreMesh);

      arcWrapper.rotation.z = rollAngle;
      return arcWrapper;
    };

    for (const ang of rollAngles) {
      slashGroup.add(buildCrescentArc(ang));
    }

    slashGroup.position.copy(origin);
    slashGroup.lookAt(origin.clone().add(slashDir));
    this.scene.add(slashGroup);

    for (let i = 0; i < (isCrossX ? 18 : 10); i++) {
      const pColor = i % 3 === 0 ? 0x090a0d : i % 2 === 0 ? 0xff1e42 : 0xfecaca;
      const pMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.94 });
      const pMesh = new THREE.Mesh(TRAIL_CUBE_GEO, pMat);
      pMesh.position.copy(origin).add(
        new THREE.Vector3((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.8)
      );
      pMesh.scale.set(1.4, 0.4, 2.2);
      this.scene.add(pMesh);
      this.fxParticles.push({
        mesh: pMesh,
        vel: slashDir.clone().multiplyScalar(18 + Math.random() * 16).add(
          new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8)
        ),
        life: 0.32 + Math.random() * 0.18,
        maxLife: 0.5
      });
    }

    const slashNear = this.getObjectsNear(origin.x, origin.z, 7.5);
    for (let i = 0; i < slashNear.length; i++) {
      const obj = slashNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const dx = obj.basePos.x - origin.x;
      const dz = obj.basePos.z - origin.z;
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - origin.y);
      if (Math.hypot(dx, dz) <= obj.radius + 3.4 && dy <= obj.height + 2.2) {
        this.damageObject(obj, isCrossX ? 120 : 75, origin, false, { canBreakCrackedWall: true });
      }
    }

    this.projectiles.push({
      mesh: slashGroup,
      type: 'katana_slash',
      vel: slashDir.clone().multiplyScalar(56.0),
      life: 0.58,
      damage: isCrossX ? 120 : 75,
      slashRadius: isCrossX ? 2.8 : 2.2,
      hitObjects: new Set(),
      canBreakCrackedWall: true
    });
  },

  spawnSmokeBombCloud(centerPos) {
    soundFX.playTacticalRoll();
    const colors = [0x090a0d, 0x18181b, 0x991b1b, 0xff1e42];
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.92 });
      const puff = new THREE.Mesh(FIREBALL_GEO, mat);
      const angle = (i / 28) * Math.PI * 2;
      const r = 0.35 + Math.random() * 1.25;
      puff.position.set(
        centerPos.x + Math.cos(angle) * r,
        centerPos.y + 0.35 + Math.random() * 1.35,
        centerPos.z + Math.sin(angle) * r
      );
      puff.scale.setScalar(1.65 + Math.random() * 1.45);
      this.scene.add(puff);

      this.fxParticles.push({
        mesh: puff,
        vel: new THREE.Vector3(
          Math.cos(angle) * (3.5 + Math.random() * 4.5),
          2.2 + Math.random() * 3.5,
          Math.sin(angle) * (3.5 + Math.random() * 4.5)
        ),
        life: 0.85,
        maxLife: 0.85
      });
    }
  },

  spawnSombraShadowStepTrail(pos, scaleMult = 1.0) {
    const colors = [0x090a0d, 0x18181b, 0xdc2626, 0xff1e42];
    const c = colors[Math.floor(Math.random() * colors.length)];
    this._spawnFxParticle(
      TRAIL_CUBE_GEO, c, 0.86,
      pos.x + (Math.random() - 0.5) * 0.7,
      pos.y + 0.18 + Math.random() * 0.45,
      pos.z + (Math.random() - 0.5) * 0.7,
      1.3 * scaleMult, 0.45 * scaleMult, 1.8 * scaleMult,
      (Math.random() - 0.5) * 2.4,
      1.2 + Math.random() * 2.4,
      (Math.random() - 0.5) * 2.4,
      0.32
    );
  },

  performMagneticPull(playerPos, aimData) {
    soundFX.playHeroSwap();
    const origin = playerPos.clone().add(new THREE.Vector3(0, 1.25, 0));
    const targetPt = aimData.point.clone();

    for (let i = 0; i < 10; i++) {
      const u = i / 10;
      const pt = new THREE.Vector3().lerpVectors(targetPt, origin, u);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xff1e42 : 0xa855f7,
        transparent: true,
        opacity: 0.92
      });
      const mesh = new THREE.Mesh(TRAIL_CUBE_GEO, mat);
      mesh.position.copy(pt);
      this.scene.add(mesh);

      const pullVel = origin.clone().sub(pt).normalize().multiplyScalar(18.0);
      this.fxParticles.push({
        mesh,
        vel: pullVel,
        life: 0.32,
        maxLife: 0.32
      });
    }

    if (aimData.hitObj && !aimData.hitObj.destroyed) {
      this.damageObject(aimData.hitObj, 48, origin, false);
    }

    for (const s of this.studsList) {
      if (s.mesh.position.distanceTo(origin) <= 28.0) {
        s.magnetized = true;
      }
    }
    for (const s of this.ambientStuds) {
      if (!s.collected && s.mesh.position.distanceTo(origin) <= 28.0) {
        s.magnetized = true;
      }
    }
  }
};
