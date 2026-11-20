import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import {
  SHARED_UNIT_CYL_6,
  SHARED_UNIT_SPHERE_10,
  SHARED_UNIT_SPHERE_20
} from './DestructibleRegistryAndCulling.js';

const _BOLT_UP = new THREE.Vector3(0, 1, 0);
const _BOLT_MID = new THREE.Vector3();
const _BOLT_DIR = new THREE.Vector3();
const _BOLT_PTS = Array.from({ length: 20 }, () => new THREE.Vector3());

export const VOLTAICO_STORM_HERO_VFX_METHODS = {
  /**
   * Desenha um Feixe de Raio Elétrico 3D Multi-Filamento entre 2 pontos no espaço
   */
  _spawnJaggedLightningBolt(startPt, endPt, radius = 0.11, duration = 0.28, isSkyBolt = false) {
    const dist = startPt.distanceTo(endPt);
    const segments = Math.max(5, Math.min(16, Math.ceil(dist / 2.2)));
    const boltGroup = new THREE.Group();

    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
    const cyanMat = new THREE.MeshBasicMaterial({
      color: isSkyBolt ? 0x38bdf8 : 0x22d3ee,
      transparent: true,
      opacity: 0.92
    });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 });

    const buildStrand = (mat, rad, jitterScale) => {
      while (_BOLT_PTS.length <= segments) {
        _BOLT_PTS.push(new THREE.Vector3());
      }
      _BOLT_PTS[0].copy(startPt);
      for (let i = 1; i < segments; i++) {
        const u = i / segments;
        const p = _BOLT_PTS[i].lerpVectors(startPt, endPt, u);
        const jitter = (isSkyBolt ? 1.65 : 0.85) * jitterScale;
        p.x += (Math.random() - 0.5) * jitter;
        p.y += (Math.random() - 0.5) * jitter * 0.75;
        p.z += (Math.random() - 0.5) * jitter;
      }
      _BOLT_PTS[segments].copy(endPt);

      for (let i = 0; i < segments; i++) {
        const a = _BOLT_PTS[i];
        const b = _BOLT_PTS[i + 1];
        _BOLT_DIR.subVectors(b, a);
        const segLen = Math.max(0.05, _BOLT_DIR.length());
        _BOLT_MID.addVectors(a, b).multiplyScalar(0.5);

        const segMesh = new THREE.Mesh(SHARED_UNIT_CYL_6, mat);
        segMesh.position.copy(_BOLT_MID);
        segMesh.scale.set(rad, segLen, rad);
        segMesh.quaternion.setFromUnitVectors(_BOLT_UP, _BOLT_DIR.multiplyScalar(1 / segLen));
        boltGroup.add(segMesh);
      }
    };

    buildStrand(coreMat, radius * 0.78, 0.75);
    buildStrand(cyanMat, radius * 1.35, 1.0);
    buildStrand(goldMat, radius * 0.58, 1.45);

    const startFlare = new THREE.Mesh(SHARED_UNIT_SPHERE_10, coreMat);
    startFlare.position.copy(startPt);
    startFlare.scale.setScalar(radius * 2.2);
    const endFlare = new THREE.Mesh(SHARED_UNIT_SPHERE_10, cyanMat);
    endFlare.position.copy(endPt);
    endFlare.scale.setScalar(radius * 2.8);
    boltGroup.add(startFlare, endFlare);

    this.scene.add(boltGroup);
    this.timedBeams.push({
      mesh: boltGroup,
      materials: [
        { mat: coreMat, baseOpacity: 1.0 },
        { mat: cyanMat, baseOpacity: 0.92 },
        { mat: goldMat, baseOpacity: 0.85 }
      ],
      life: duration,
      maxLife: duration
    });
  },

  /**
   * Efeito Visual 3D de Planagem Eletromagnética & Corrida Tempestuosa do Voltaico
   */
  spawnVoltaicoElectricGlideFX(playerPos, isAirborne = true) {
    const hoverGroup = new THREE.Group();
    hoverGroup.position.set(playerPos.x, playerPos.y + 0.14, playerPos.z);

    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 });
    const goldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.92 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96 });

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(isAirborne ? 1.25 : 0.95, 0.065, 8, 24),
      cyanMat
    );
    outerRing.rotation.x = Math.PI / 2;

    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(isAirborne ? 0.72 : 0.55, 0.05, 8, 20),
      goldMat
    );
    innerRing.rotation.x = Math.PI / 2;

    const coreDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16), whiteMat);
    hoverGroup.add(outerRing, innerRing, coreDisc);

    this.scene.add(hoverGroup);
    this.timedBeams.push({
      mesh: hoverGroup,
      materials: [
        { mat: cyanMat, baseOpacity: 0.88 },
        { mat: goldMat, baseOpacity: 0.92 },
        { mat: whiteMat, baseOpacity: 0.96 }
      ],
      life: 0.18,
      maxLife: 0.18,
      onUpdate: (dt, ratio) => {
        const s = 1.0 + (1.0 - ratio) * 0.65;
        hoverGroup.scale.set(s, 1.0, s);
        hoverGroup.rotation.y += dt * 12.0;
      }
    });

    for (let i = 0; i < 2; i++) {
      const ang = Math.random() * Math.PI * 2;
      const bodyPt = new THREE.Vector3(
        playerPos.x + (Math.random() - 0.5) * 0.5,
        playerPos.y + 0.75 + Math.random() * 0.8,
        playerPos.z + (Math.random() - 0.5) * 0.5
      );
      const ringPt = new THREE.Vector3(
        playerPos.x + Math.cos(ang) * 1.35,
        playerPos.y + 0.1,
        playerPos.z + Math.sin(ang) * 1.35
      );
      this._spawnJaggedLightningBolt(bodyPt, ringPt, 0.055, 0.12, false);
    }
  },

  /**
   * Dispara Corrente de Raios (Chain Lightning) [Mouse 1] do Voltaico
   */
  fireChainLightning(origin, targetPoint) {
    soundFX.playLaserShot();
    soundFX.playExplosion(0.32);

    const visited = new Set();
    let currentPt = origin.clone();

    let firstTargetObj = null;
    let bestDist = 9.5;
    const firstCandidates = this.getObjectsNear(targetPoint.x, targetPoint.z, 14.0);
    for (let i = 0; i < firstCandidates.length; i++) {
      const obj = firstCandidates[i];
      if (obj.destroyed || obj.isDriven) continue;
      const dx = obj.basePos.x - targetPoint.x;
      const dy = (obj.basePos.y + obj.height * 0.5) - targetPoint.y;
      const dz = obj.basePos.z - targetPoint.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < bestDist + obj.radius) {
        bestDist = d;
        firstTargetObj = obj;
      }
    }

    const firstPt = firstTargetObj
      ? new THREE.Vector3(
          firstTargetObj.basePos.x,
          firstTargetObj.basePos.y + firstTargetObj.height * 0.5,
          firstTargetObj.basePos.z
        )
      : targetPoint.clone();

    this._spawnJaggedLightningBolt(currentPt, firstPt, 0.13, 0.28, false);
    this._triggerMicroImpactBlast(firstPt);

    const firstSplash = this.getObjectsNear(firstPt.x, firstPt.z, 9.0);
    for (let i = 0; i < firstSplash.length; i++) {
      const obj = firstSplash[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - firstPt.x, obj.basePos.z - firstPt.z);
      if (d <= obj.radius + 4.8 && Math.abs(obj.basePos.y - firstPt.y) <= obj.height + 3.5) {
        visited.add(obj);
        this.damageObject(obj, 145, currentPt, true, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }
    currentPt = firstPt;

    for (let bounce = 0; bounce < 6; bounce++) {
      let nextObj = null;
      let minDist = 22.0;
      const bounceNear = this.getObjectsNear(currentPt.x, currentPt.z, 24.0);
      for (let i = 0; i < bounceNear.length; i++) {
        const obj = bounceNear[i];
        if (obj.destroyed || obj.isDriven || visited.has(obj)) continue;
        const d = Math.hypot(obj.basePos.x - currentPt.x, obj.basePos.z - currentPt.z);
        if (d < minDist) {
          minDist = d;
          nextObj = obj;
        }
      }
      if (!nextObj) break;

      visited.add(nextObj);
      const nextPt = new THREE.Vector3(
        nextObj.basePos.x,
        nextObj.basePos.y + nextObj.height * 0.5,
        nextObj.basePos.z
      );
      this._spawnJaggedLightningBolt(currentPt, nextPt, 0.1, 0.3, false);
      this._triggerMicroImpactBlast(nextPt);
      this.damageObject(nextObj, 130, currentPt, true, {
        canBreakCrackedWall: true,
        canBreakSilver: true
      });
      currentPt = nextPt;
    }
  },

  /**
   * Teleporte Elétrico (Lightning Blink) [Mouse 2 / F / G] do Voltaico
   */
  spawnLightningTeleportStrike(fromPos, toPos) {
    soundFX.playExplosion(0.72);
    soundFX.playLaserShot();

    const skyFrom = new THREE.Vector3(fromPos.x, fromPos.y + 48.0, fromPos.z);
    const skyTo = new THREE.Vector3(toPos.x, toPos.y + 48.0, toPos.z);
    this._spawnJaggedLightningBolt(skyFrom, fromPos, 0.28, 0.38, true);
    this._spawnJaggedLightningBolt(skyTo, toPos, 0.34, 0.42, true);
    this._spawnJaggedLightningBolt(
      new THREE.Vector3(fromPos.x, fromPos.y + 1.2, fromPos.z),
      new THREE.Vector3(toPos.x, toPos.y + 1.2, toPos.z),
      0.18,
      0.36,
      false
    );

    this.spawnVoltaicoElectricGlideFX(toPos, true);

    const tpNear = this.getObjectsNear(toPos.x, toPos.z, 15.0);
    for (let i = 0; i < tpNear.length; i++) {
      const obj = tpNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - toPos.x, obj.basePos.z - toPos.z);
      if (d <= obj.radius + 10.5 && Math.abs(obj.basePos.y - toPos.y) <= 7.5) {
        this.damageObject(obj, 160, toPos, true, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }
  },

  /**
   * Super Pulso EMP & Tempestade de Trovões [Q] do Voltaico (Raio 28m)
   */
  triggerVoltaicoEmpPulse(centerPos, radius = 28.0) {
    soundFX.playExplosion(1.35);
    soundFX.playLaserShot();

    const center = new THREE.Vector3(centerPos.x, centerPos.y + 1.1, centerPos.z);
    const domeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.68 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95 });
    const sphereMesh = new THREE.Mesh(SHARED_UNIT_SPHERE_20, domeMat);
    sphereMesh.position.copy(center);
    this.scene.add(sphereMesh);

    const ringGeo = new THREE.TorusGeometry(1, 0.09, 10, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(center);
    this.scene.add(ringMesh);

    this.explosions.push({
      sphereMesh,
      ringMesh,
      innerCoreMesh: null,
      extraMeshes: [],
      extraRings: [],
      eruptionSpikes: [],
      isSupernova: true,
      maxRadius: radius,
      age: 0,
      duration: 0.68
    });

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const dist = 6.0 + (i % 3) * 7.0;
      const strikePt = new THREE.Vector3(
        centerPos.x + Math.cos(ang) * dist,
        centerPos.y,
        centerPos.z + Math.sin(ang) * dist
      );
      const skyPt = new THREE.Vector3(strikePt.x, strikePt.y + 48.0, strikePt.z);
      this._spawnJaggedLightningBolt(skyPt, strikePt, 0.24, 0.48, true);
    }

    const empNear = this.getObjectsNear(centerPos.x, centerPos.z, radius + 5.0);
    for (let i = 0; i < empNear.length; i++) {
      const obj = empNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - centerPos.x, obj.basePos.z - centerPos.z);
      if (d <= radius + obj.radius && Math.abs(obj.basePos.y - centerPos.y) <= 15.0) {
        this.damageObject(obj, 185, center, true, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }
  }
};
