import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  markAsSharedAsset,
  disposeTransientObject3D
} from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { FIREBALL_GEO, TRAIL_CUBE_GEO } from './DestructibleRegistryAndCulling.js';

const BULLET_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.065, 0.065, 0.85, 8).rotateX(Math.PI / 2));
const SHARED_ROCKET_BODY_GEO = markAsSharedAsset(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 12));
const SHARED_ROCKET_NOSE_GEO = markAsSharedAsset(new THREE.ConeGeometry(0.15, 0.38, 12));
const SHARED_ROCKET_JET_GEO = markAsSharedAsset(new THREE.ConeGeometry(0.14, 0.42, 10));
const SHARED_GRENADE_BODY_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.36, 0.22, 0.44));
const SHARED_GRENADE_STRAP_GEO = markAsSharedAsset(new THREE.BoxGeometry(0.38, 0.24, 0.12));

export const PROJECTILES_AND_BALLISTICS_METHODS = {
  /**
   * Calcula o ponto 3D exato que está na mira central (#crosshair)
   */
  getAimTargetPoint(camera, maxDist = 75) {
    const ox = camera.position.x;
    const oy = camera.position.y;
    const oz = camera.position.z;
    if (!this._aimDirScratch) this._aimDirScratch = new THREE.Vector3();
    const rayDir = this._aimDirScratch;
    camera.getWorldDirection(rayDir);
    const dxR = rayDir.x;
    const dyR = rayDir.y;
    const dzR = rayDir.z;

    let closestDist = maxDist;
    let hitObj = null;

    const midX = ox + dxR * (maxDist * 0.5);
    const midZ = oz + dzR * (maxDist * 0.5);
    const candidates = this.getObjectsNear(midX, midZ, maxDist * 0.5 + 8.0);

    for (let i = 0; i < candidates.length; i++) {
      const obj = candidates[i];
      if (obj.destroyed || obj.isDriven || obj.isAlliedToPlayer) continue;

      const cx = obj._isDynamicIndexed ? (obj.mesh?.position?.x ?? obj.basePos.x) : obj.basePos.x;
      const cy = (obj._isDynamicIndexed ? (obj.mesh?.position?.y ?? obj.basePos.y) : obj.basePos.y) + obj.height * 0.5;
      const cz = obj._isDynamicIndexed ? (obj.mesh?.position?.z ?? obj.basePos.z) : obj.basePos.z;

      const tx = cx - ox;
      const ty = cy - oy;
      const tz = cz - oz;
      const t = tx * dxR + ty * dyR + tz * dzR;
      if (t < 1.5 || t > closestDist) continue;

      const px = ox + dxR * t - cx;
      const py = Math.abs(oy + dyR * t - cy);
      const pz = oz + dzR * t - cz;

      if (px * px + pz * pz <= (obj.radius * 0.95) * (obj.radius * 0.95) && py <= obj.height * 0.65) {
        closestDist = t;
        hitObj = obj;
      }
    }

    if (!hitObj && dyR < -0.02) {
      const floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(ox, oz) : 0;
      const groundT = (floorY - oy) / dyR;
      if (groundT > 2.0 && groundT < closestDist) {
        closestDist = groundT;
      }
    }

    const point = new THREE.Vector3(ox + dxR * closestDist, oy + dyR * closestDist, oz + dzR * closestDist);
    return { point, hitObj, distance: closestDist };
  },

  performMeleeAttack(playerPos, facingAngle, range = 2.7, damage = 20) {
    soundFX.playPunchSwing();

    const attackCenter = new THREE.Vector3(
      playerPos.x + Math.sin(facingAngle) * 1.35,
      playerPos.y + 1.0,
      playerPos.z + Math.cos(facingAngle) * 1.35
    );
    this.world?.livingCity?.triggerPedestrianPanicNear(attackCenter, 22);

    let hitAny = false;
    const meleeCandidates = this.getObjectsNear(attackCenter.x, attackCenter.z, range + 3.0);
    for (let i = 0; i < meleeCandidates.length; i++) {
      const obj = meleeCandidates[i];
      if (obj.destroyed) continue;
      const bx = obj._isDynamicIndexed ? (obj.mesh?.position?.x ?? obj.basePos.x) : obj.basePos.x;
      const by = obj._isDynamicIndexed ? (obj.mesh?.position?.y ?? obj.basePos.y) : obj.basePos.y;
      const bz = obj._isDynamicIndexed ? (obj.mesh?.position?.z ?? obj.basePos.z) : obj.basePos.z;
      const distHoriz = Math.hypot(bx - attackCenter.x, bz - attackCenter.z);
      const dy = Math.abs(by + obj.height * 0.5 - attackCenter.y);

      if (distHoriz <= obj.radius + range * 0.55 && dy <= obj.height + 1.4) {
        this.damageObject(obj, damage, attackCenter, false, {
          sourceIsPlayer: true,
          isMelee: true
        });
        hitAny = true;
      }
    }

    return hitAny;
  },

  spawnRifleBullet(origin, targetPoint) {
    soundFX.playRifleShot();
    this.world?.livingCity?.triggerPedestrianPanicNear(origin, 32);

    const dir = targetPoint.clone().sub(origin).normalize();
    const mat = getLegoMaterial(LEGO_COLORS.yellow, {
      emissive: 0xfef08a,
      emissiveIntensity: 1.8,
      roughness: 0.1
    });

    const mesh = new THREE.Mesh(BULLET_GEO, mat);
    mesh.position.copy(origin);
    mesh.lookAt(targetPoint);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      type: 'bullet',
      originPos: origin.clone(),
      vel: dir.multiplyScalar(72),
      life: 1.2,
      damage: 14,
      isSolar: false,
      sourceIsPlayer: true
    });
  },

  spawnFireball(origin, targetPoint) {
    soundFX.playFireballCast();
    this.world?.livingCity?.triggerPedestrianPanicNear(origin, 34);

    const dir = targetPoint.clone().sub(origin).normalize();
    const group = new THREE.Group();
    const coreMat = getLegoMaterial(0xfef08a, { emissive: 0xf97316, emissiveIntensity: 2.0 });
    group.add(new THREE.Mesh(FIREBALL_GEO, coreMat));
    group.position.copy(origin);
    this.scene.add(group);

    this.projectiles.push({
      mesh: group,
      type: 'fireball',
      originPos: origin.clone(),
      vel: dir.multiplyScalar(42),
      life: 1.8,
      damage: 30,
      isSolar: true,
      isExplosion: true,
      sourceIsPlayer: true
    });
  },

  spawnVehicleProjectile(origin, targetPoint, weaponType) {
    const dir = targetPoint.clone().sub(origin).normalize();

    if (weaponType === 'smg' || weaponType === 'machinegun') {
      soundFX.playRifleShot();
      const tracerMat = getLegoMaterial(0xf97316, {
        emissive: 0xfef08a,
        emissiveIntensity: 2.4,
        roughness: 0.1
      });
      const mesh = new THREE.Mesh(BULLET_GEO, tracerMat);
      mesh.scale.set(1.8, 1.8, 2.4);
      mesh.position.copy(origin);
      mesh.lookAt(targetPoint);
      this.scene.add(mesh);

      this.projectiles.push({
        mesh,
        type: 'bullet',
        originPos: origin.clone(),
        vel: dir.multiplyScalar(88),
        life: 1.4,
        damage: weaponType === 'machinegun' ? 28 : 20,
        isSolar: false,
        sourceIsPlayer: true
      });
    } else if (weaponType === 'plasma_laser') {
      soundFX.playFireballCast();
      const plasmaGroup = new THREE.Group();
      const plasmaMat = getLegoMaterial(0x00f0ff, {
        emissive: 0xa855f7,
        emissiveIntensity: 2.8,
        roughness: 0.08
      });
      const bolt = new THREE.Mesh(BULLET_GEO, plasmaMat);
      bolt.scale.set(2.4, 2.4, 3.8);
      plasmaGroup.add(bolt);
      plasmaGroup.position.copy(origin);
      plasmaGroup.lookAt(targetPoint);
      this.scene.add(plasmaGroup);

      this.projectiles.push({
        mesh: plasmaGroup,
        type: 'fireball',
        originPos: origin.clone(),
        vel: dir.multiplyScalar(76),
        life: 1.6,
        damage: 65,
        blastRadius: 4.8,
        isSolar: true,
        isExplosion: true,
        sourceIsPlayer: true
      });
    } else if (weaponType === 'tank_cannon') {
      soundFX.playExplosion(1.1);
      const shellGroup = new THREE.Group();
      const shellMat = getLegoMaterial(0xf59e0b, { emissive: 0xef4444, emissiveIntensity: 2.5 });
      const shell = new THREE.Mesh(FIREBALL_GEO, shellMat);
      shell.scale.setScalar(1.45);
      shellGroup.add(shell);
      shellGroup.position.copy(origin);
      this.scene.add(shellGroup);

      this.projectiles.push({
        mesh: shellGroup,
        type: 'fireball',
        originPos: origin.clone(),
        vel: dir.multiplyScalar(68),
        life: 2.0,
        damage: 260,
        blastRadius: 9.5,
        isSupernovaBlast: true,
        isSolar: true,
        isExplosion: true,
        sourceIsPlayer: true,
        canBreakCrackedWall: true,
        canBreakSilver: true
      });
    }
  },

  spawnTitaRotaryBullet(origin, targetPoint) {
    soundFX.playMinigunShot();
    const jitterTarget = targetPoint.clone().add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.42,
        (Math.random() - 0.5) * 0.32,
        (Math.random() - 0.5) * 0.42
      )
    );
    const dir = jitterTarget.clone().sub(origin).normalize();
    const mat = getLegoMaterial(0xfef2f2, {
      emissive: 0xef4444,
      emissiveIntensity: 2.6,
      roughness: 0.1
    });
    const mesh = new THREE.Mesh(BULLET_GEO, mat);
    mesh.scale.set(1.5, 1.5, 2.8);
    mesh.position.copy(origin);
    mesh.lookAt(jitterTarget);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      type: 'bullet',
      originPos: origin.clone(),
      vel: dir.multiplyScalar(105),
      life: 1.25,
      damage: 22,
      isSolar: false,
      sourceIsPlayer: true
    });
  },

  throwGrabbedCar(carObj, origin, targetPoint, worldColliders = []) {
    if (!carObj) return;
    soundFX.playPunchSwing();

    carObj.isGrabbed = false;
    carObj.mesh.position.copy(origin);
    const dir = targetPoint.clone().sub(origin).normalize();
    const vel = dir.multiplyScalar(42.0);
    if (dir.y > -0.2) vel.y += 4.5;

    this.thrownCars.push({
      carObj,
      vel,
      worldColliders,
      timer: 2.2,
      sourceIsPlayer: true
    });
  },

  _spawnEjectedBrassShell(origin, isShotgunShell = false) {
    this._spawnFxParticle(
      TRAIL_CUBE_GEO,
      isShotgunShell ? 0xdc2626 : 0xf59e0b,
      0.95,
      origin.x, origin.y, origin.z,
      isShotgunShell ? 0.65 : 0.45,
      isShotgunShell ? 0.65 : 0.45,
      isShotgunShell ? 1.35 : 0.95,
      (Math.random() - 0.5) * 5.5,
      3.2 + Math.random() * 3.5,
      (Math.random() - 0.5) * 5.5,
      0.55
    );
  },

  _triggerMicroImpactBlast(hitPos, sourceIsPlayer = true) {
    soundFX.playPlasticHit();
    this._spawnFxParticle(
      FIREBALL_GEO, 0xf97316, 0.92,
      hitPos.x, hitPos.y, hitPos.z,
      1.85, 1.85, 1.85,
      0, 0.5, 0,
      0.14
    );

    const sparkColors = [0xffffff, 0xfef08a, 0xf97316, 0xef4444];
    for (let i = 0; i < 8; i++) {
      this._spawnFxParticle(
        TRAIL_CUBE_GEO, sparkColors[i % sparkColors.length], 0.95,
        hitPos.x, hitPos.y, hitPos.z,
        0.85, 0.85, 0.85,
        (Math.random() - 0.5) * 14.0,
        2.5 + Math.random() * 8.5,
        (Math.random() - 0.5) * 14.0,
        0.24
      );
    }

    const nearBlast = this.getObjectsNear(hitPos.x, hitPos.z, 6.5);
    for (let i = 0; i < nearBlast.length; i++) {
      const obj = nearBlast[i];
      if (obj.destroyed || obj.isDriven) continue;
      const d = Math.hypot(obj.basePos.x - hitPos.x, obj.basePos.z - hitPos.z);
      const dy = Math.abs((obj.basePos.y + obj.height * 0.5) - hitPos.y);
      if (d <= obj.radius + 2.4 && dy <= obj.height + 1.8) {
        this.damageObject(obj, 22, hitPos, false, {
          canBreakCrackedWall: true,
          isExplosion: true,
          sourceIsPlayer: Boolean(sourceIsPlayer)
        });
      }
    }
  },

  spawnDualSmgBullets(leftOrigin, rightOrigin, targetPoint, recoilSide = 0) {
    soundFX.playRifleShot();
    soundFX.playExplosion(0.32);

    const coreMat = getLegoMaterial(0xffffff, { emissive: 0xfef08a, emissiveIntensity: 2.6, roughness: 0.08 });
    const jacketMat = getLegoMaterial(0xff1e42, { emissive: 0xf97316, emissiveIntensity: 2.2, roughness: 0.12 });

    const origins = recoilSide < 0 ? [leftOrigin] : recoilSide > 0 ? [rightOrigin] : [leftOrigin, rightOrigin];
    for (const orig of origins) {
      this._spawnEjectedBrassShell(orig, false);

      const spreadTarget = targetPoint.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.32, (Math.random() - 0.5) * 0.45)
      );
      const dir = spreadTarget.sub(orig).normalize();

      const bulletGroup = new THREE.Group();
      const coreMesh = new THREE.Mesh(BULLET_GEO, coreMat);
      coreMesh.scale.set(2.1, 2.1, 1.8);
      const auraMesh = new THREE.Mesh(BULLET_GEO, jacketMat);
      auraMesh.scale.set(2.9, 2.9, 1.4);
      bulletGroup.add(auraMesh, coreMesh);

      bulletGroup.position.copy(orig);
      bulletGroup.lookAt(orig.clone().add(dir));
      this.scene.add(bulletGroup);

      this.projectiles.push({
        mesh: bulletGroup,
        type: 'punisher_50cal',
        originPos: orig.clone(),
        vel: dir.multiplyScalar(115.0),
        life: 0.95,
        damage: 36,
        isSolar: false,
        sourceIsPlayer: true,
        canBreakCrackedWall: true
      });
    }
  },

  spawnShotgunBlast(origin, targetPoint) {
    soundFX.playExplosion(0.92);
    soundFX.playRifleShot();
    this._spawnEjectedBrassShell(origin, true);

    const mainDir = targetPoint.clone().sub(origin).normalize();
    const pelletColors = [0xffffff, 0xfef08a, 0xf97316, 0xef4444];

    for (let s = 0; s < 10; s++) {
      const smokeMat = new THREE.MeshBasicMaterial({
        color: s < 5 ? 0xf97316 : 0x334155,
        transparent: true,
        opacity: 0.86
      });
      const puff = new THREE.Mesh(FIREBALL_GEO, smokeMat);
      puff.position.copy(origin).addScaledVector(mainDir, 0.5 + Math.random() * 0.8);
      puff.scale.setScalar(0.9 + Math.random() * 0.9);
      this.scene.add(puff);
      this.fxParticles.push({
        mesh: puff,
        vel: mainDir.clone().multiplyScalar(8 + Math.random() * 10).add(
          new THREE.Vector3((Math.random() - 0.5) * 5, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 5)
        ),
        life: 0.28,
        maxLife: 0.28
      });
    }

    for (let i = 0; i < 18; i++) {
      const pelletMat = getLegoMaterial(pelletColors[i % pelletColors.length], {
        emissive: i % 2 === 0 ? 0xf97316 : 0xef4444,
        emissiveIntensity: 2.5
      });

      const spreadDir = mainDir.clone().add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.26,
          (Math.random() - 0.5) * 0.16,
          (Math.random() - 0.5) * 0.26
        )
      ).normalize();

      const mesh = new THREE.Mesh(BULLET_GEO, pelletMat);
      mesh.scale.set(1.85, 1.85, 1.5);
      mesh.position.copy(origin);
      mesh.lookAt(origin.clone().add(spreadDir));
      this.scene.add(mesh);

      this.projectiles.push({
        mesh,
        type: 'shotgun_pellet',
        originPos: origin.clone(),
        vel: spreadDir.multiplyScalar(74.0 + (Math.random() - 0.5) * 10.0),
        life: 0.46,
        damage: 22,
        isSolar: false,
        isCloseShotgun: true,
        sourceIsPlayer: true,
        canBreakCrackedWall: true
      });
    }
  },

  spawnRpgRocket(origin, targetPoint, onExplode = null) {
    soundFX.playExplosion(1.05);
    const dir = targetPoint.clone().sub(origin).normalize();

    const rocketGroup = new THREE.Group();
    const bodyMat = getLegoMaterial(0x1e293b, { roughness: 0.25, metalness: 0.5 });
    const noseMat = getLegoMaterial(0xdc2626, { emissive: 0xef4444, emissiveIntensity: 1.8 });
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const body = new THREE.Mesh(SHARED_ROCKET_BODY_GEO, bodyMat);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(SHARED_ROCKET_NOSE_GEO, noseMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.52;
    const jetCone = new THREE.Mesh(SHARED_ROCKET_JET_GEO, thrusterMat);
    jetCone.rotation.x = -Math.PI / 2;
    jetCone.position.z = -0.52;
    rocketGroup.add(body, nose, jetCone);

    rocketGroup.position.copy(origin);
    rocketGroup.lookAt(targetPoint);
    this.scene.add(rocketGroup);

    this.projectiles.push({
      mesh: rocketGroup,
      type: 'rpg_rocket',
      originPos: origin.clone(),
      vel: dir.multiplyScalar(85.0),
      life: 2.2,
      damage: 210,
      blastRadius: 9.5,
      isSolar: false,
      isExplosion: true,
      sourceIsPlayer: true,
      canBreakSilver: true,
      canBreakCrackedWall: true,
      onExplode
    });
  },

  throwGrenade(origin, targetPoint, worldColliders = [], onExplode = null, getTerrainHeightAt = null) {
    soundFX.playPunchSwing();

    const nadeGroup = new THREE.Group();
    const bodyMat = getLegoMaterial(0x1e293b, { roughness: 0.28, metalness: 0.45 });
    const strapMat = getLegoMaterial(LEGO_COLORS.gold, { roughness: 0.2, metalness: 0.6 });
    const topLedMat = getLegoMaterial(LEGO_COLORS.orange, { emissive: 0xf97316, emissiveIntensity: 2.4 });

    const body = new THREE.Mesh(SHARED_GRENADE_BODY_GEO, bodyMat);
    body.castShadow = true;
    const strap = new THREE.Mesh(SHARED_GRENADE_STRAP_GEO, strapMat);
    const topStud = new THREE.Mesh(SHARED_STUD_GEO, topLedMat);
    topStud.position.y = 0.14;
    nadeGroup.add(body, strap, topStud);

    nadeGroup.position.copy(origin);
    this.scene.add(nadeGroup);

    const dir = targetPoint.clone().sub(origin).normalize();
    const dist = origin.distanceTo(targetPoint);
    const vel = dir.multiplyScalar(36.0);
    if (dist > 6.0 && dir.y > -0.25) {
      vel.y += Math.min(4.5, dist * 0.14);
    }

    this.grenades.push({
      mesh: nadeGroup,
      vel,
      worldColliders,
      onExplode,
      getTerrainHeightAt,
      age: 0,
      timer: 1.5,
      isExplosion: true,
      sourceIsPlayer: true
    });
  },

  detonateActiveCaveiraGrenade() {
    if (!this.grenades || this.grenades.length === 0) return false;
    const g = this.grenades.pop();
    const blastPos = g.mesh.position.clone();
    this._triggerExplosion(blastPos, 8.2, 85, true, false, {
      sourceIsPlayer: true,
      isExplosion: true
    });
    if (typeof g.onExplode === 'function') {
      g.onExplode(blastPos);
    }
    this.scene.remove(g.mesh);
    disposeTransientObject3D(g.mesh);
    return true;
  }
};
