import * as THREE from 'three';
import { getLegoMaterial } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import { getSharedPursuitGeos } from './PolicePursuitAssets.js';
import {
  spawnPoliceHelicopter,
  removeEagleHelicopter,
  clearAllPoliceHelicopters,
  updatePoliceHelicopters
} from './PoliceHelicopterPilot.js';
import {
  spawnFootTrooper,
  clearAllFootUnits,
  updateFootUnits,
  findTacticalCoverSpot
} from './PoliceFootTactics.js';

const TANK_SHELL_MAT = getLegoMaterial(0xf97316, {
  emissive: 0xf59e0b,
  emissiveIntensity: 0.9,
  roughness: 0.22
});

function closestPointOnSegment(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const lenSq = abx * abx + aby * aby + abz * abz;
  const t = lenSq < 1e-8 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby + (pz - az) * abz) / lenSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  const cz = az + abz * t;
  return { distSq: (px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2, x: cx, y: cy, z: cz };
}

function didProjectileHitWallCollider(sys, pos) {
  const cols = typeof sys.world?.getCollidersNear === 'function'
    ? sys.world.getCollidersNear(pos.x, pos.z, 0.8, sys._projColScratch || (sys._projColScratch = []))
    : sys.world?.colliders;
  if (!Array.isArray(cols)) return false;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (!c || c.disabled || (c.maxY ?? 0) < 3.0) continue;
    if (pos.x >= c.minX && pos.x <= c.maxX && pos.z >= c.minZ && pos.z <= c.maxZ && pos.y >= (c.minY ?? 0) && pos.y <= (c.maxY ?? 10)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// ORQUESTRADOR FINO: TROPAS A PÉ, HELICÓPTEROS ÁGUIA & BALÍSTICA / OBUSES 5★
// ============================================================================
export const policeHelicopterAndTacticalMethods = {
  _spawnFootTrooper(spawnPos, tierStars = this.stars, opts = null) {
    return spawnFootTrooper(this, spawnPos, tierStars, opts);
  },
  _clearAllFootUnits() {
    clearAllFootUnits(this);
  },
  _updateFootUnits(dt, playerPos, controller = null) {
    updateFootUnits(this, dt, playerPos, controller);
  },
  _findTacticalCoverSpot(fu, playerPos) {
    return findTacticalCoverSpot(this, fu, playerPos);
  },

  _spawnEagleHelicopter(playerPos) {
    return spawnPoliceHelicopter(this, playerPos);
  },
  _removeEagleHelicopter(targetHeli = null) {
    removeEagleHelicopter(this, targetHeli);
  },
  _clearAllPoliceHelicopters() {
    clearAllPoliceHelicopters(this);
  },
  _updateEagleHelicopter(dt, playerPos, controller) {
    updatePoliceHelicopters(this, dt, playerPos, controller);
  },
  _updatePoliceHelicopters(dt, playerPos, controller) {
    updatePoliceHelicopters(this, dt, playerPos, controller);
  },

  _spawnHunterDrone() {
    return null;
  },
  _clearAllHunterDrones() {
    if (!Array.isArray(this.hunterDrones)) return;
    for (const dr of this.hunterDrones) {
      if (dr?.obj) this.destructibles.unregisterDestructible(dr.obj);
    }
    this.hunterDrones.length = 0;
  },
  _updateHunterDrones() {
    if (Array.isArray(this.hunterDrones) && this.hunterDrones.length > 0) this._clearAllHunterDrones();
  },

  _spawnPursuitProjectile(origin, targetPos, kind = 'bullet') {
    if (this.enemyProjectiles.length >= 44) {
      if (kind !== 'tank_shell' && kind !== 'missile') return null;
      const dropIdx = this.enemyProjectiles.findIndex((p) => p.kind === 'bullet');
      if (dropIdx === -1) return null;
      this.scene.remove(this.enemyProjectiles[dropIdx].mesh);
      this.enemyProjectiles.splice(dropIdx, 1);
    }

    const G = getSharedPursuitGeos();
    const dir = targetPos.clone().sub(origin).normalize();
    let mesh = new THREE.Mesh(G.policeBulletGeo, this.mats.policeBullet);
    let speed = 62.0;
    let life = 1.6;
    let damage = this.stars >= 5 ? 13 : this.stars >= 4 ? 10 : 7;

    if (kind === 'tank_shell') {
      if (this.mats && !this.mats.tankShell) this.mats.tankShell = TANK_SHELL_MAT;
      mesh = new THREE.Mesh(G.missileGeo, this.mats?.tankShell || TANK_SHELL_MAT);
      speed = 74.0;
      life = 2.2;
      damage = 38;
      soundFX.playExplosion?.(0.48);
    } else if (kind === 'missile') {
      mesh = new THREE.Mesh(G.missileGeo, this.mats.missileBody);
      speed = 38.0;
      life = 3.4;
      damage = 24;
      soundFX.playExplosion?.(0.32);
    } else if (kind === 'energy_net') {
      mesh = new THREE.Mesh(G.energyNetProjectileGeo, this.mats.energyNetWire);
      speed = 46.0;
      life = 2.4;
      damage = 10;
      soundFX.playLaserShot?.();
    }

    mesh.position.copy(origin);
    mesh.lookAt(targetPos);
    this.scene.add(mesh);
    const entry = { mesh, kind, vel: dir.multiplyScalar(speed), speed, life, damage, traveled: 0 };
    this.enemyProjectiles.push(entry);
    return entry;
  },

  _clearAllEnemyProjectiles() {
    for (const p of this.enemyProjectiles) this.scene.remove(p.mesh);
    this.enemyProjectiles.length = 0;
  },

  _applyEnergyNetHit(playerPos, controller) {
    if (!controller) return;
    controller.energyNetSlowTimer = 1.85;
    if (controller.isFlying && controller.velocity) controller.velocity.y = Math.min(controller.velocity.y, -8.5);
    if (!this.energyCageMesh) {
      this.energyCageMesh = new THREE.Mesh(getSharedPursuitGeos().energyCageGeo, this.mats.energyNetWire);
      this.scene.add(this.energyCageMesh);
    }
    this.energyCageMesh.visible = true;
    this.energyCageMesh.position.set(playerPos.x, playerPos.y + 1.1, playerPos.z);
  },

  _updateEnemyProjectiles(dt, playerPos, controller) {
    const targetCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.05, playerPos.z);
    const triggerPoliceExplosion = (pos, radius, dmg) =>
      this.destructibles?._triggerExplosion?.(pos, radius, dmg, false, false, {
        fromPursuitPolice: true, isExplosion: true, sourceIsPlayer: false
      });

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i];
      p.life -= dt;

      if (p.kind === 'tank_shell') {
        p.vel.y -= 4.5 * dt;
        p.mesh.lookAt(p.mesh.position.x + p.vel.x, p.mesh.position.y + p.vel.y, p.mesh.position.z + p.vel.z);
        if (Math.random() < 0.75) this.destructibles?.spawnFlameTrailParticle?.(p.mesh.position, 0.72, 0xf59e0b);
      } else if (p.kind === 'missile') {
        const desiredDir = targetCenter.clone().sub(p.mesh.position).normalize();
        const curDir = p.vel.clone().normalize().lerp(desiredDir, Math.min(1, dt * 3.2)).normalize();
        p.vel.copy(curDir.multiplyScalar(p.speed));
        p.mesh.lookAt(p.mesh.position.clone().add(p.vel));
        if (Math.random() < 0.7) this.destructibles?.spawnFlameTrailParticle?.(p.mesh.position, 0.65, 0xf97316);
      } else if (p.kind === 'energy_net') {
        p.mesh.rotation.x += dt * 8.0;
        p.mesh.rotation.y += dt * 8.0;
      }

      const prevX = p.mesh.position.x;
      const prevY = p.mesh.position.y;
      const prevZ = p.mesh.position.z;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.traveled = (p.traveled || 0) + Math.hypot(p.mesh.position.x - prevX, p.mesh.position.y - prevY, p.mesh.position.z - prevZ);

      const hitRadius = controller?.currentVehicle ? 2.45 : 1.15;
      const segHit = closestPointOnSegment(
        targetCenter.x, targetCenter.y, targetCenter.z,
        prevX, prevY, prevZ, p.mesh.position.x, p.mesh.position.y, p.mesh.position.z
      );
      let removeProj = p.life <= 0;

      if (segHit.distSq <= hitRadius * hitRadius) {
        const impactPos = new THREE.Vector3(segHit.x, segHit.y, segHit.z);
        if (p.kind === 'energy_net') this._applyEnergyNetHit(playerPos, controller);
        else if (p.kind === 'tank_shell') triggerPoliceExplosion(impactPos, 6.4, 42);
        else if (p.kind === 'missile') triggerPoliceExplosion(impactPos, 5.2, 35);
        this.applyPursuitDamageToPlayer(
          p.damage, controller, p.kind === 'tank_shell' || p.kind === 'missile' ? { isExplosion: true } : {}
        );
        removeProj = true;
      } else {
        const floorY = this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(p.mesh.position.x, p.mesh.position.z) : 0;
        const hitGround = p.mesh.position.y <= floorY + 0.15;
        const hitBuilding =
          (p.mesh.position.y < 24.0 && Boolean(this._isSegmentBlockedByBuilding?.(prevX, prevZ, p.mesh.position.x, p.mesh.position.z))) ||
          (p.traveled > 4.0 && didProjectileHitWallCollider(this, p.mesh.position));

        if (hitGround || hitBuilding) {
          const impactPos = p.mesh.position.clone();
          if (hitGround) impactPos.y = floorY + 0.15;
          if (p.kind === 'tank_shell') triggerPoliceExplosion(impactPos, 6.4, 42);
          else if (p.kind === 'missile') triggerPoliceExplosion(impactPos, 5.0, 30);
          removeProj = true;
        }
      }

      if (removeProj) {
        this.scene.remove(p.mesh);
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }
};
