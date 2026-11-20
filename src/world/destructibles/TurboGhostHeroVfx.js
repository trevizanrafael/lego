import * as THREE from 'three';
import { getLegoMaterial } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { TRAIL_CUBE_GEO } from './DestructibleRegistryAndCulling.js';

export const TURBO_GHOST_HERO_VFX_METHODS = {
  /**
   * Invoca ou materializa instantaneamente a Moto Energética Ciano ("INTERCEPTOR FANTASMA")
   */
  summonTurboEnergyBike(pos, facingAngle) {
    soundFX.playHeroSwap();
    soundFX.playLaserShot();

    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x22d3ee : 0xe0f2fe,
        transparent: true,
        opacity: 0.94
      });
      const spark = new THREE.Mesh(TRAIL_CUBE_GEO, mat);
      spark.position.set(pos.x + Math.cos(ang) * 1.4, pos.y + 0.6, pos.z + Math.sin(ang) * 1.4);
      spark.scale.setScalar(1.4);
      this.scene.add(spark);
      this.fxParticles.push({
        mesh: spark,
        vel: new THREE.Vector3(Math.cos(ang) * 8.5, 4.5 + Math.random() * 4.5, Math.sin(ang) * 8.5),
        life: 0.45,
        maxLife: 0.45
      });
    }

    if (this._turboGhostBikeObj) {
      const bike = this._turboGhostBikeObj;
      bike.destroyed = false;
      bike.hp = bike.maxHp;
      bike.isGrabbed = false;
      bike.isDriven = false;
      bike.mesh.visible = true;
      bike.mesh.position.set(pos.x, pos.y, pos.z);
      bike.mesh.rotation.set(0, facingAngle, 0);
      bike.basePos.copy(bike.mesh.position);
      bike.baseRot.copy(bike.mesh.rotation);
      bike.groundY = pos.y;
      for (const col of bike.colliders) col.disabled = true;
      return bike;
    }

    const bikeGroup = new THREE.Group();
    bikeGroup.position.set(pos.x, pos.y, pos.z);
    bikeGroup.rotation.set(0, facingAngle, 0);

    const blackMat = getLegoMaterial(0x090a0d, { roughness: 0.18, clearcoat: 0.78 });
    const chromeMat = getLegoMaterial(0xe2e8f0, { metalness: 0.88, roughness: 0.12 });
    const cyanGlow = getLegoMaterial(0x22d3ee, {
      emissive: 0x06b6d4,
      emissiveIntensity: 2.6,
      roughness: 0.08
    });
    const whiteCyanGlow = getLegoMaterial(0xe0f2fe, {
      emissive: 0x38bdf8,
      emissiveIntensity: 3.0,
      roughness: 0.05
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.54, 2.75), blackMat);
    body.position.set(0, 0.58, 0);
    body.castShadow = true;
    bikeGroup.add(body);

    const reactorCore = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.92, 16), whiteCyanGlow);
    reactorCore.rotation.z = Math.PI / 2;
    reactorCore.position.set(0, 0.56, 0.12);
    bikeGroup.add(reactorCore);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.36, 1.38), cyanGlow);
    canopy.position.set(0, 0.9, 0.44);
    canopy.rotation.x = 0.24;
    bikeGroup.add(canopy);

    const skullHeadlight = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 1), whiteCyanGlow);
    skullHeadlight.position.set(0, 0.78, 1.36);
    bikeGroup.add(skullHeadlight);

    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.98, 10), chromeMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.06, 0.48);
    bikeGroup.add(handlebar);

    for (const sx of [-0.45, 0.45]) {
      const neonStrip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.14, 2.58), whiteCyanGlow);
      neonStrip.position.set(sx, 0.64, 0);
      bikeGroup.add(neonStrip);
    }

    const wheels = [];
    for (const [wz, isFront] of [[-1.15, false], [1.15, true]]) {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(0, 0.54, wz);
      const spinGroup = new THREE.Group();

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.38, 24), blackMat);
      tire.rotation.z = Math.PI / 2;
      const rimGlow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 10, 24), cyanGlow);
      rimGlow.rotation.y = Math.PI / 2;
      rimGlow.position.set(0.2, 0, 0);
      const rimGlowL = rimGlow.clone();
      rimGlowL.position.x = -0.2;
      const hubGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 14), whiteCyanGlow);
      hubGlow.rotation.z = Math.PI / 2;

      spinGroup.add(tire, rimGlow, rimGlowL, hubGlow);
      steerGroup.add(spinGroup);
      bikeGroup.add(steerGroup);
      wheels.push({ steerGroup, spinGroup, isFront });
    }
    bikeGroup.userData.wheels = wheels;

    const turboFlames = [];
    for (const sx of [-0.28, 0.28]) {
      const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.62, 12), chromeMat);
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(sx, 0.74, -1.38);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.95, 10), whiteCyanGlow);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(sx, 0.74, -1.96);
      flame.visible = false;
      bikeGroup.add(thruster, flame);
      turboFlames.push(flame);
    }
    bikeGroup.userData.turboFlames = turboFlames;

    bikeGroup.userData.isOptimizedGroup = true;
    bikeGroup.userData.isDriveableCar = true;
    bikeGroup.userData.carName = 'MOTO FANTASMA CIANO (740 KM/H)';
    bikeGroup.userData.vehicleSpec = {
      id: 'moto_fantasma_turbo',
      category: 'car',
      isGhostBike: true,
      isMotorcycle: true,
      openTop: true,
      canWheelie: true,
      rammingPower: 'unstoppable',
      maxForward: 68.0,
      turboSpeed: 232.0,
      maxReverse: -36.0,
      accel: 38.0,
      turboAccel: 76.0,
      brakeDecel: 245.0,
      coastFriction: 68.0,
      turnRate: 3.4,
      driftTurnRate: 4.6,
      seatedYOffset: 0.78,
      seatZOffset: -0.26,
      rearAxleZ: 1.15,
      enterRadius: 5.5
    };

    this.scene.add(bikeGroup);
    const bikeObj = this.registerDestructible({
      mesh: bikeGroup,
      type: 'car',
      hp: 450,
      radius: 1.65,
      height: 1.45,
      colliders: [],
      debrisColors: [0x090a0d, 0x22d3ee, 0xe0f2fe],
      studDrops: { silver: 4, gold: 4, blue: 2, purple: 0 },
      groundY: pos.y
    });
    this._turboGhostBikeObj = bikeObj;
    return bikeObj;
  },

  /**
   * Cria um segmento sólido da Muralha de Luz Ciano (Light Wall estilo Tron)
   */
  spawnTurboLightWallSegment(fromPos, toPos) {
    const dx = toPos.x - fromPos.x;
    const dz = toPos.z - fromPos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.35 || len > 26.0) return;

    const midX = (fromPos.x + toPos.x) * 0.5;
    const midZ = (fromPos.z + toPos.z) * 0.5;
    const baseY = Math.min(fromPos.y, toPos.y);
    const wallH = 1.85;
    const yaw = Math.atan2(dx, dz);

    const wallGroup = new THREE.Group();
    wallGroup.position.set(midX, baseY + wallH * 0.5, midZ);
    wallGroup.rotation.y = yaw;

    const wallMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.76 });
    wallGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, wallH, len + 0.18), wallMat));

    const railMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.98 });
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, len + 0.2), railMat);
    topRail.position.y = wallH * 0.5;
    const botRail = topRail.clone();
    botRail.position.y = -wallH * 0.5 + 0.08;
    wallGroup.add(topRail, botRail);

    this.scene.add(wallGroup);
    this.lightWallSegments.push({
      mesh: wallGroup,
      wallMat,
      railMat,
      midPos: new THREE.Vector3(midX, baseY + wallH * 0.5, midZ),
      halfLen: len * 0.5 + 0.45,
      life: 4.5,
      maxLife: 4.5
    });
  },

  /**
   * Golpe da Espada Colossal de Plasma Ciano + Projétil Motosserra de Corrente [Mouse 1 / V]
   */
  performTurboChainWhip(playerPos, facingAngle, targetPoint = null) {
    soundFX.playPunchSwing();
    soundFX.playLaserShot();

    const origin = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.45,
      playerPos.y + 1.28,
      playerPos.z + Math.cos(facingAngle) * 1.45
    );
    const dir = targetPoint
      ? targetPoint.clone().sub(origin).normalize()
      : new THREE.Vector3(Math.sin(facingAngle), 0, Math.cos(facingAngle)).normalize();

    const projGroup = new THREE.Group();
    const cyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.94 });
    const brightCyanMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.98 });
    const whiteHotMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 1.0 });

    const crescentOuter = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.16, 10, 28, Math.PI * 1.15), cyanMat);
    crescentOuter.rotation.x = Math.PI / 2;
    crescentOuter.rotation.z = -Math.PI * 0.08;

    const crescentCore = new THREE.Mesh(new THREE.TorusGeometry(2.08, 0.085, 8, 26, Math.PI * 1.08), whiteHotMat);
    crescentCore.rotation.x = Math.PI / 2;
    crescentCore.rotation.z = -Math.PI * 0.04;
    projGroup.add(crescentOuter, crescentCore);

    const sawRingGroup = new THREE.Group();
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.09, 8, 24), brightCyanMat);
    innerRing.rotation.x = Math.PI / 2;
    sawRingGroup.add(innerRing);

    for (let b = 0; b < 8; b++) {
      const ang = (b / 8) * Math.PI * 2;
      const tooth = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.72, 4),
        b % 2 === 0 ? whiteHotMat : brightCyanMat
      );
      tooth.position.set(Math.cos(ang) * 1.55, 0, Math.sin(ang) * 1.55);
      tooth.rotation.x = Math.PI / 2;
      tooth.rotation.z = -ang - 0.35;
      sawRingGroup.add(tooth);
    }
    projGroup.add(sawRingGroup);
    projGroup.userData.spinRing = sawRingGroup;

    projGroup.position.copy(origin);
    projGroup.lookAt(origin.clone().add(dir));
    this.scene.add(projGroup);

    const turboNear = this.getObjectsNear(origin.x, origin.z, 11.5);
    for (let i = 0; i < turboNear.length; i++) {
      const obj = turboNear[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - origin.x, obj.basePos.z - origin.z);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - origin.y);
      if (d <= obj.radius + 7.2 && dy <= obj.height + 3.2) {
        this.damageObject(obj, 185, origin, false, {
          canBreakCrackedWall: true,
          canBreakSilver: true
        });
      }
    }

    this.projectiles.push({
      mesh: projGroup,
      type: 'turbo_plasma_slash',
      vel: dir.clone().multiplyScalar(82.0),
      life: 0.95,
      damage: 195,
      slashRadius: 3.8,
      hitObjects: new Set(),
      canBreakCrackedWall: true,
      canBreakSilver: true
    });
  }
};
