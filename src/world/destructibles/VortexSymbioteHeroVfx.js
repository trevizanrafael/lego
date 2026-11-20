import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { FIREBALL_GEO, SHARED_UNIT_SPHERE_20 } from './DestructibleRegistryAndCulling.js';

const _LASSO_VPOS = new THREE.Vector3();
const _LASSO_TOVEC = new THREE.Vector3();

export const VORTEX_SYMBIOTE_HERO_VFX_METHODS = {
  spawnVortexSymbioteTrail(pos, scaleMult = 1.0) {
    const colors = [0x090a0d, 0x581c87, 0x9333ea, 0xa855f7, 0xd8b4fe];
    const c = colors[Math.floor(Math.random() * colors.length)];
    this._spawnFxParticle(
      FIREBALL_GEO, c, 0.92,
      pos.x + (Math.random() - 0.5) * 0.85,
      pos.y + 0.35 + Math.random() * 0.85,
      pos.z + (Math.random() - 0.5) * 0.85,
      1.1 * scaleMult, 0.7 * scaleMult, 1.5 * scaleMult,
      (Math.random() - 0.5) * 3.0,
      1.5 + Math.random() * 2.8,
      (Math.random() - 0.5) * 3.0,
      0.34
    );
  },

  /**
   * Constrói um Tentáculo Simbionte 3D Orgânico Curvado (CatmullRomCurve3 + TubeGeometry)
   */
  _spawnCurvedSymbioteTentacle(startPt, endPt, opts = {}) {
    const {
      baseRadius = 0.28,
      duration = 0.34,
      curveArchY = 1.4,
      curveSideOffset = 1.2,
      hasMawTip = true
    } = opts;

    const tentacleGroup = new THREE.Group();
    const dir = endPt.clone().sub(startPt);
    const dist = Math.max(1.0, dir.length());
    const fwd = dir.clone().normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    right.normalize();

    const p0 = startPt.clone();
    const p1 = startPt.clone()
      .addScaledVector(fwd, dist * 0.28)
      .addScaledVector(right, curveSideOffset * 0.85)
      .add(new THREE.Vector3(0, curveArchY, 0));
    const p2 = startPt.clone()
      .addScaledVector(fwd, dist * 0.62)
      .addScaledVector(right, -curveSideOffset * 0.55)
      .add(new THREE.Vector3(0, curveArchY * 0.55, 0));
    const p3 = endPt.clone();

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    const tubeGeo = new THREE.TubeGeometry(curve, 18, baseRadius, 8, false);

    const blackMat = new THREE.MeshBasicMaterial({ color: 0x090a0d, transparent: true, opacity: 0.98 });
    const purpleVeinMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.92 });
    const boneWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.96 });

    tentacleGroup.add(new THREE.Mesh(tubeGeo, blackMat));

    const v1 = p1.clone().addScaledVector(right, -curveSideOffset * 0.45).add(new THREE.Vector3(0, 0.22, 0));
    const v2 = p2.clone().addScaledVector(right, curveSideOffset * 0.45).add(new THREE.Vector3(0, -0.18, 0));
    const veinCurve = new THREE.CatmullRomCurve3([p0, v1, v2, p3]);
    tentacleGroup.add(new THREE.Mesh(new THREE.TubeGeometry(veinCurve, 16, baseRadius * 0.46, 6, false), purpleVeinMat));

    const thornCount = Math.min(8, Math.max(4, Math.floor(dist / 2.4)));
    for (let i = 1; i <= thornCount; i++) {
      const u = i / (thornCount + 1);
      const pt = curve.getPointAt(u);
      const thorn = new THREE.Mesh(
        new THREE.ConeGeometry(baseRadius * 0.55, baseRadius * 2.4, 5),
        i % 2 === 0 ? boneWhiteMat : purpleVeinMat
      );
      thorn.position.copy(pt);
      thorn.rotation.set((i % 2 === 0 ? 1 : -1) * 0.65, i * 1.1, (i % 3 - 1) * 0.55);
      tentacleGroup.add(thorn);
    }

    if (hasMawTip) {
      const mawGroup = new THREE.Group();
      mawGroup.position.copy(endPt);
      mawGroup.lookAt(endPt.clone().add(fwd));

      const mawHead = new THREE.Mesh(
        new THREE.ConeGeometry(baseRadius * 1.55, baseRadius * 3.8, 6),
        purpleVeinMat
      );
      mawHead.rotation.x = Math.PI / 2;
      mawGroup.add(mawHead);

      for (let f = 0; f < 3; f++) {
        const ang = (f / 3) * Math.PI * 2;
        const fang = new THREE.Mesh(
          new THREE.ConeGeometry(baseRadius * 0.48, baseRadius * 2.6, 4),
          boneWhiteMat
        );
        fang.position.set(
          Math.cos(ang) * baseRadius * 1.1,
          Math.sin(ang) * baseRadius * 1.1,
          baseRadius * 1.4
        );
        fang.rotation.x = Math.PI / 2 - 0.25;
        mawGroup.add(fang);
      }
      tentacleGroup.add(mawGroup);
    }

    this.scene.add(tentacleGroup);
    this.timedBeams.push({
      mesh: tentacleGroup,
      materials: [
        { mat: blackMat, baseOpacity: 0.98 },
        { mat: purpleVeinMat, baseOpacity: 0.92 },
        { mat: boneWhiteMat, baseOpacity: 0.96 }
      ],
      life: duration,
      maxLife: duration
    });
  },

  spawnSymbioteMorphBurst(centerPos, toMonster = true) {
    soundFX.playHeroSwap();
    soundFX.playExplosion(toMonster ? 0.75 : 0.45);

    const colors = [0x090a0d, 0x581c87, 0x9333ea, 0xa855f7];
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.94 });
      const blob = new THREE.Mesh(FIREBALL_GEO, mat);
      blob.position.set(centerPos.x, centerPos.y + 1.2, centerPos.z);
      blob.scale.setScalar(toMonster ? 1.55 : 1.15);
      this.scene.add(blob);
      this.fxParticles.push({
        mesh: blob,
        vel: new THREE.Vector3(
          Math.cos(ang) * (7.5 + Math.random() * 6.5),
          2.5 + Math.random() * 5.5,
          Math.sin(ang) * (7.5 + Math.random() * 6.5)
        ),
        life: 0.42,
        maxLife: 0.42
      });
    }
  },

  /**
   * Combo de 3 Golpes de Tentáculos Simbiontes [Mouse 1 / V] do Vórtex
   */
  performVortexTentacleStrike(playerPos, facingAngle, isMonsterForm = false, targetPoint = null) {
    soundFX.playPunchSwing();
    soundFX.playExplosion(isMonsterForm ? 0.68 : 0.42);

    this._vortexComboStep = ((this._vortexComboStep || 0) + 1) % 3;
    const step = this._vortexComboStep;
    const reach = isMonsterForm ? 18.5 : 13.5;
    const baseRad = isMonsterForm ? 0.34 : 0.22;

    const origin = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.1,
      playerPos.y + (isMonsterForm ? 2.15 : 1.35),
      playerPos.z + Math.cos(facingAngle) * 1.1
    );

    if (step === 1) {
      for (let t = -2; t <= 2; t++) {
        const spreadYaw = facingAngle + t * 0.22;
        const tipPt = new THREE.Vector3(
          origin.x + Math.sin(spreadYaw) * reach,
          playerPos.y + 0.8 + Math.abs(t) * 0.25,
          origin.z + Math.cos(spreadYaw) * reach
        );
        this._spawnCurvedSymbioteTentacle(origin, tipPt, {
          baseRadius: baseRad,
          duration: 0.32,
          curveArchY: 1.3 + (t % 2) * 0.6,
          curveSideOffset: t * 0.95,
          hasMawTip: true
        });
      }
    } else if (step === 2) {
      const crushCenter = new THREE.Vector3(
        origin.x + Math.sin(facingAngle) * (reach * 0.88),
        playerPos.y + 1.0,
        origin.z + Math.cos(facingAngle) * (reach * 0.88)
      );
      for (const side of [-1, 1]) {
        const shoulderStart = new THREE.Vector3(
          origin.x - Math.cos(facingAngle) * side * 1.2,
          origin.y + 0.3,
          origin.z + Math.sin(facingAngle) * side * 1.2
        );
        this._spawnCurvedSymbioteTentacle(shoulderStart, crushCenter, {
          baseRadius: baseRad * 1.45,
          duration: 0.36,
          curveArchY: 1.8,
          curveSideOffset: side * 4.2,
          hasMawTip: true
        });
      }
      this._triggerMicroImpactBlast(crushCenter);
    } else {
      for (let t = 0; t < 6; t++) {
        const spreadYaw = facingAngle + (t - 2.5) * 0.16;
        const dist = reach * (0.75 + (t % 2) * 0.32);
        const tipPt = new THREE.Vector3(
          origin.x + Math.sin(spreadYaw) * dist,
          playerPos.y + 1.4 + (t % 3) * 0.6,
          origin.z + Math.cos(spreadYaw) * dist
        );
        this._spawnCurvedSymbioteTentacle(origin, tipPt, {
          baseRadius: baseRad * 1.25,
          duration: 0.38,
          curveArchY: 2.2,
          curveSideOffset: (t % 2 === 0 ? 1 : -1) * 1.6,
          hasMawTip: true
        });
      }
    }

    const projDir = targetPoint
      ? targetPoint.clone().sub(origin).normalize()
      : new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle)).normalize();

    const waveGroup = new THREE.Group();
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x090a0d, transparent: true, opacity: 0.96 });
    const purpleMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.95 });
    const fangMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.98 });

    const waveScale = isMonsterForm ? 1.38 : 1.0;
    const jawArcOuter = new THREE.Mesh(
      new THREE.TorusGeometry(2.1 * waveScale, 0.24 * waveScale, 10, 24, Math.PI * 1.15),
      blackMat
    );
    jawArcOuter.rotation.x = Math.PI / 2;
    const jawArcVein = new THREE.Mesh(
      new THREE.TorusGeometry(1.95 * waveScale, 0.12 * waveScale, 8, 22, Math.PI * 1.1),
      purpleMat
    );
    jawArcVein.rotation.x = Math.PI / 2;
    waveGroup.add(jawArcOuter, jawArcVein);

    for (let f = -3; f <= 3; f++) {
      const ang = f * 0.36;
      const fang = new THREE.Mesh(
        new THREE.ConeGeometry(0.16 * waveScale, 0.68 * waveScale, 4),
        f % 2 === 0 ? fangMat : purpleMat
      );
      fang.position.set(Math.sin(ang) * 2.1 * waveScale, 0, Math.cos(ang) * 2.1 * waveScale);
      fang.rotation.x = Math.PI / 2;
      fang.rotation.z = -ang;
      waveGroup.add(fang);
    }

    waveGroup.position.copy(origin);
    waveGroup.lookAt(origin.clone().add(projDir));
    this.scene.add(waveGroup);

    this.projectiles.push({
      mesh: waveGroup,
      type: 'vortex_symbiote_wave',
      vel: projDir.clone().multiplyScalar(64.0),
      life: 0.78,
      damage: isMonsterForm ? 195 : 140,
      slashRadius: isMonsterForm ? 3.8 : 2.9,
      hitObjects: new Set(),
      canBreakCrackedWall: true,
      canBreakSilver: true
    });

    const strikeCenter = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * (reach * 0.55),
      playerPos.y + 1.2,
      playerPos.z + Math.cos(facingAngle) * (reach * 0.55)
    );
    const hitRadius = isMonsterForm ? 11.5 : 8.2;
    const vortexNear = this.getObjectsNear(strikeCenter.x, strikeCenter.z, hitRadius + 5.0);
    for (let i = 0; i < vortexNear.length; i++) {
      const obj = vortexNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - strikeCenter.x, obj.basePos.z - strikeCenter.z);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - strikeCenter.y);
      if (d <= obj.radius + hitRadius && dy <= obj.height + 4.8) {
        this.damageObject(obj, isMonsterForm ? 185 : 130, origin, false, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }
  },

  /**
   * Laço Abissal Simbionte [Mouse 2 / G] do Vórtex
   */
  performAbyssalLasso(playerPos, facingAngle, camera, worldColliders = []) {
    soundFX.playPunchSwing();
    soundFX.playLaserShot();

    const handOrigin = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 0.75,
      playerPos.y + 1.55,
      playerPos.z + Math.cos(facingAngle) * 0.75
    );
    const rayDir = new THREE.Vector3();
    camera.getWorldDirection(rayDir);
    const camToPlayerDist = Math.max(0, camera.position.distanceTo(handOrigin) - 0.5);
    const rayOrigin = camera.position.clone().addScaledVector(rayDir, camToPlayerDist);

    let bestVehicle = null;
    let bestScore = Infinity;
    for (let i = 0; i < this._dynamicObjects.length; i++) {
      const obj = this._dynamicObjects[i];
      if (obj.destroyed || obj.type !== 'car' || obj.isDriven) continue;
      _LASSO_VPOS.set(obj.mesh.position.x, obj.mesh.position.y + 1.0, obj.mesh.position.z);
      _LASSO_TOVEC.subVectors(_LASSO_VPOS, rayOrigin);
      const dist = _LASSO_TOVEC.length();
      if (dist < 2.5 || dist > 92.0) continue;
      const forwardDot = _LASSO_TOVEC.multiplyScalar(1 / dist).dot(rayDir);
      if (forwardDot < 0.82) continue;
      const perpDist = dist * Math.sqrt(Math.max(0, 1 - forwardDot * forwardDot));
      if (perpDist <= (obj.radius || 3.0) + 4.2 && dist < bestScore) {
        bestScore = dist;
        bestVehicle = obj;
      }
    }

    if (bestVehicle) {
      const vehPos = bestVehicle.mesh.position.clone().add(new THREE.Vector3(0, 0.9, 0));
      this._spawnCurvedSymbioteTentacle(handOrigin, vehPos, {
        baseRadius: 0.28,
        duration: 0.42,
        curveArchY: 1.5,
        curveSideOffset: 1.2,
        hasMawTip: true
      });
      this._spawnCurvedSymbioteTentacle(handOrigin, vehPos, {
        baseRadius: 0.22,
        duration: 0.42,
        curveArchY: 0.6,
        curveSideOffset: -1.2,
        hasMawTip: false
      });

      const slamPoint = new THREE.Vector3(
        playerPos.x + Math.sin(facingAngle) * 7.5,
        playerPos.y + 0.2,
        playerPos.z + Math.cos(facingAngle) * 7.5
      );
      this.throwGrabbedCar(bestVehicle, vehPos, slamPoint, worldColliders);
      return { pulledVehicle: bestVehicle, pullPoint: null };
    }

    const maxDist = 96.0;
    let bestT = maxDist;
    let exactAnchor = null;

    if (Array.isArray(worldColliders)) {
      for (const col of worldColliders) {
        if (col.disabled) continue;
        const colMinY = col.minY ?? 0;
        let tMin = 0.0;
        let tMax = bestT;
        const axes = [
          [rayOrigin.x, rayDir.x, col.minX, col.maxX],
          [rayOrigin.y, rayDir.y, colMinY, col.maxY],
          [rayOrigin.z, rayDir.z, col.minZ, col.maxZ]
        ];
        let hitBox = true;
        for (const [orig, d, minB, maxB] of axes) {
          if (Math.abs(d) < 1e-6) {
            if (orig < minB || orig > maxB) {
              hitBox = false;
              break;
            }
          } else {
            let t1 = (minB - orig) / d;
            let t2 = (maxB - orig) / d;
            if (t1 > t2) {
              const tmp = t1;
              t1 = t2;
              t2 = tmp;
            }
            tMin = Math.max(tMin, t1);
            tMax = Math.min(tMax, t2);
            if (tMin > tMax) {
              hitBox = false;
              break;
            }
          }
        }
        if (hitBox && tMin >= 3.0 && tMin < bestT) {
          bestT = tMin;
          exactAnchor = rayOrigin.clone().addScaledVector(rayDir, tMin);
        }
      }
    }

    if (rayDir.y < -0.01) {
      for (let d = 3.0; d <= bestT; d += 1.5) {
        const px = rayOrigin.x + rayDir.x * d;
        const py = rayOrigin.y + rayDir.y * d;
        const pz = rayOrigin.z + rayDir.z * d;
        const terrainY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(px, pz) : 0;
        if (py <= terrainY + 0.25) {
          bestT = d;
          exactAnchor = new THREE.Vector3(px, terrainY + 0.4, pz);
          break;
        }
      }
    }

    if (!exactAnchor) {
      const reach = 68.0;
      const fx = rayOrigin.x + rayDir.x * reach;
      const fz = rayOrigin.z + rayDir.z * reach;
      const floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(fx, fz) : 0;
      const fy = Math.max(floorY + 0.5, rayOrigin.y + rayDir.y * reach);
      exactAnchor = new THREE.Vector3(fx, fy, fz);
    }

    this._spawnCurvedSymbioteTentacle(handOrigin, exactAnchor, {
      baseRadius: 0.24,
      duration: 0.42,
      curveArchY: 0.9,
      curveSideOffset: 0.65,
      hasMawTip: true
    });
    return { pulledVehicle: null, pullPoint: exactAnchor };
  },

  /**
   * Erupção Abissal de Tentáculos e Espinhos [Q] do Vórtex (Raio 24m)
   */
  triggerVortexAbyssalEruption(centerPos, radius = 24.0, groundY = 0) {
    soundFX.playExplosion(1.35);

    const floorY = groundY ?? centerPos.y;
    const center = new THREE.Vector3(centerPos.x, floorY + 1.0, centerPos.z);

    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x581c87, transparent: true, opacity: 0.72 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.94 });

    const sphereMesh = new THREE.Mesh(SHARED_UNIT_SPHERE_20, sphereMat);
    sphereMesh.position.copy(center);
    this.scene.add(sphereMesh);

    const ringGeo = new THREE.TorusGeometry(1, 0.08, 10, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(center);
    this.scene.add(ringMesh);

    const extraMeshes = [];
    const eruptionSpikes = [];
    const spikeColors = [0x090a0d, 0x581c87, 0x9333ea, 0xa855f7];

    for (let s = 0; s < 22; s++) {
      const ang = (s / 22) * Math.PI * 2;
      const dist = (0.3 + (s % 3) * 0.28) * radius;
      const h = 6.5 + (s % 4) * 2.5;
      const sMat = new THREE.MeshBasicMaterial({
        color: spikeColors[s % spikeColors.length],
        transparent: true,
        opacity: 0.96
      });
      const sGeo = new THREE.ConeGeometry(0.75, h, 6);
      sGeo.translate(0, h * 0.5, 0);
      const sMesh = new THREE.Mesh(sGeo, sMat);
      sMesh.position.set(centerPos.x + Math.cos(ang) * dist, floorY, centerPos.z + Math.sin(ang) * dist);
      sMesh.rotation.z = -Math.cos(ang) * 0.28;
      sMesh.rotation.x = Math.sin(ang) * 0.28;
      sMesh.scale.set(1, 0.05, 1);
      this.scene.add(sMesh);
      extraMeshes.push(sMesh);
      eruptionSpikes.push({ mesh: sMesh, delay: (s % 3) * 0.08 });
    }

    this.explosions.push({
      sphereMesh,
      ringMesh,
      innerCoreMesh: null,
      extraMeshes,
      extraRings: [],
      eruptionSpikes,
      isSupernova: true,
      maxRadius: radius,
      age: 0,
      duration: 0.78
    });

    const erupNear = this.getObjectsNear(centerPos.x, centerPos.z, radius + 5.0);
    for (let i = 0; i < erupNear.length; i++) {
      const obj = erupNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - centerPos.x, obj.basePos.z - centerPos.z);
      if (d <= radius + obj.radius && Math.abs(obj.basePos.y - floorY) <= 12.0) {
        this.damageObject(obj, 175, center, false, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }
  }
};
