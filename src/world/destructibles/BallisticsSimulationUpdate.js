import * as THREE from 'three';
import { disposeTransientObject3D } from '../../materials/LegoMaterials.js';
import { FIREBALL_GEO, TRAIL_CUBE_GEO, _TMP_IMPACT_VEC } from './DestructibleRegistryAndCulling.js';

export const BALLISTICS_SIMULATION_UPDATE_METHODS = {
  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      if (
        p.type === 'katana_slash' ||
        p.type === 'turbo_plasma_slash' ||
        p.type === 'vortex_symbiote_wave'
      ) {
        p.mesh.position.addScaledVector(p.vel, dt);
        if (p.mesh.userData?.spinRing) {
          p.mesh.userData.spinRing.rotation.y += dt * 32.0;
        }
        if (p.type === 'katana_slash' && Math.random() < 0.85) {
          this.spawnSombraShadowStepTrail(p.mesh.position, 1.4);
        } else if (p.type === 'turbo_plasma_slash' && Math.random() < 0.88) {
          this._spawnFxParticle(
            TRAIL_CUBE_GEO,
            Math.random() > 0.4 ? 0x22d3ee : 0xe0f2fe,
            0.92,
            p.mesh.position.x, p.mesh.position.y, p.mesh.position.z,
            1.35, 1.35, 1.35,
            (Math.random() - 0.5) * 6, 2.5 + Math.random() * 4, (Math.random() - 0.5) * 6,
            0.25
          );
        } else if (p.type === 'vortex_symbiote_wave' && Math.random() < 0.88) {
          this._spawnFxParticle(
            FIREBALL_GEO,
            Math.random() > 0.45 ? 0x090a0d : 0xa855f7,
            0.94,
            p.mesh.position.x, p.mesh.position.y, p.mesh.position.z,
            1.1, 1.1, 1.1,
            (Math.random() - 0.5) * 5, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 5,
            0.24
          );
        }

        const slashR = p.slashRadius ?? 2.2;
        const slashCandidates = this.getObjectsNear(p.mesh.position.x, p.mesh.position.z, slashR + 3.5);
        for (const obj of slashCandidates) {
          if (obj.destroyed || obj.isDriven || (p.hitObjects && p.hitObjects.has(obj))) continue;
          const ox = obj._isDynamicIndexed ? (obj.mesh?.position?.x ?? obj.basePos.x) : obj.basePos.x;
          const oy = obj._isDynamicIndexed ? (obj.mesh?.position?.y ?? obj.basePos.y) : obj.basePos.y;
          const oz = obj._isDynamicIndexed ? (obj.mesh?.position?.z ?? obj.basePos.z) : obj.basePos.z;
          const dx = p.mesh.position.x - ox;
          const dz = p.mesh.position.z - oz;
          const dy = p.mesh.position.y - (oy + obj.height * 0.5);
          if (Math.hypot(dx, dz) <= obj.radius + slashR && Math.abs(dy) <= obj.height * 0.75 + 1.8) {
            if (p.hitObjects) p.hitObjects.add(obj);
            if (p.type === 'turbo_plasma_slash' || p.type === 'vortex_symbiote_wave') {
              _TMP_IMPACT_VEC.set(ox, oy + 0.8, oz);
              this._triggerMicroImpactBlast(
                _TMP_IMPACT_VEC,
                p.sourceIsPlayer !== undefined ? Boolean(p.sourceIsPlayer) : true
              );
            }
            this.damageObject(obj, p.damage, p.mesh.position, false, {
              canBreakCrackedWall: Boolean(p.canBreakCrackedWall),
              canBreakSilver: Boolean(p.canBreakSilver),
              sourceIsPlayer: p.sourceIsPlayer !== undefined ? Boolean(p.sourceIsPlayer) : true,
              isCloseShotgun: Boolean(p.isCloseShotgun),
              isExplosion: Boolean(p.isExplosion),
              shotOrigin: p.originPos || null,
              shotDir: p.vel
            });
          }
        }
        if (p.life <= 0) {
          this.scene.remove(p.mesh);
          disposeTransientObject3D(p.mesh);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      const startX = p.mesh.position.x;
      const startY = p.mesh.position.y;
      const startZ = p.mesh.position.z;
      const stepX = p.vel.x * dt;
      const stepY = p.vel.y * dt;
      const stepZ = p.vel.z * dt;
      const stepDist = Math.hypot(stepX, stepY, stepZ);
      const projFromPlayer = p.sourceIsPlayer !== undefined ? Boolean(p.sourceIsPlayer) : true;
      const checksWorldCols =
        p.type === 'rpg_rocket' || p.type === 'punisher_50cal' || p.weaponKey === 'pcc_dmr';

      let hit = false;
      const projCandidates = this.getObjectsNear(
        startX + stepX * 0.5,
        startZ + stepZ * 0.5,
        stepDist * 0.5 + 5.0
      );
      const steps = Math.max(1, Math.min(28, Math.ceil(stepDist / 1.15)));

      for (let s = 1; s <= steps && !hit; s++) {
        const frac = s / steps;
        p.mesh.position.set(startX + stepX * frac, startY + stepY * frac, startZ + stepZ * frac);

        if (s === 1) {
          if ((p.type === 'fireball' || p.type === 'rpg_rocket') && Math.random() < 0.78) {
            this.spawnFlameTrailParticle(p.mesh.position, p.type === 'rpg_rocket' ? 1.1 : 0.7);
          } else if (p.type === 'shotgun_pellet' && Math.random() < 0.35) {
            this.spawnFlameTrailParticle(p.mesh.position, 0.55);
          }
        }

        for (const obj of projCandidates) {
          if (obj.destroyed || obj.isDriven) continue;
          const ox = obj._isDynamicIndexed ? (obj.mesh?.position?.x ?? obj.basePos.x) : obj.basePos.x;
          const oy = obj._isDynamicIndexed ? (obj.mesh?.position?.y ?? obj.basePos.y) : obj.basePos.y;
          const oz = obj._isDynamicIndexed ? (obj.mesh?.position?.z ?? obj.basePos.z) : obj.basePos.z;
          const dx = p.mesh.position.x - ox;
          const dz = p.mesh.position.z - oz;
          const dy = p.mesh.position.y - (oy + obj.height * 0.5);

          if (Math.hypot(dx, dz) <= obj.radius + 0.45 && Math.abs(dy) <= obj.height * 0.65 + 0.5) {
            const isCloseShotgun = p.type === 'shotgun_pellet' || Boolean(p.isCloseShotgun);
            const isExplosion =
              p.type === 'fireball' || p.type === 'rpg_rocket' || Boolean(p.isExplosion);

            if (p.type === 'fireball' || p.type === 'rpg_rocket') {
              const blastPos = p.mesh.position.clone();
              this._triggerExplosion(
                blastPos,
                p.blastRadius ?? 4.2,
                p.damage,
                false,
                Boolean(p.isSupernovaBlast),
                {
                  canBreakSilver: Boolean(p.canBreakSilver),
                  canBreakCrackedWall: Boolean(p.canBreakCrackedWall),
                  sourceIsPlayer: projFromPlayer,
                  isExplosion: true
                }
              );
              if (typeof p.onExplode === 'function') {
                p.onExplode(blastPos);
              }
            } else if (p.type === 'punisher_50cal') {
              this.damageObject(obj, p.damage, p.mesh.position, false, {
                canBreakCrackedWall: true,
                sourceIsPlayer: projFromPlayer,
                shotOrigin: p.originPos || null,
                shotDir: p.vel
              });
              this._triggerMicroImpactBlast(p.mesh.position.clone(), projFromPlayer);
            } else {
              this.damageObject(obj, p.damage, p.mesh.position, p.isSolar, {
                canBreakSilver: Boolean(p.canBreakSilver),
                canBreakCrackedWall: Boolean(p.canBreakCrackedWall),
                sourceIsPlayer: projFromPlayer,
                isCloseShotgun,
                isExplosion,
                shotOrigin: p.originPos || null,
                shotDir: p.vel
              });
            }
            hit = true;
            break;
          }
        }
        if (hit) break;

        // Colisão contra prédios/muros via grade espacial O(1) para Bazuca RPG, Calibre .50 e Sniper DMR
        if (checksWorldCols && this.world?.colliders) {
          const px = p.mesh.position.x;
          const py = p.mesh.position.y;
          const pz = p.mesh.position.z;
          const colPad = p.weaponKey === 'pcc_dmr' ? 0.0 : 0.25;
          const nearProjCols = this.world.getCollidersNear
            ? this.world.getCollidersNear(px, pz, 2.5)
            : this.world.colliders;
          for (const col of nearProjCols) {
            if (col.disabled) continue;
            const colMinY = col.minY ?? 0;
            if (
              px >= col.minX - colPad &&
              px <= col.maxX + colPad &&
              pz >= col.minZ - colPad &&
              pz <= col.maxZ + colPad &&
              py >= colMinY &&
              py <= col.maxY
            ) {
              if (p.type === 'rpg_rocket') {
                const blastPos = p.mesh.position.clone();
                this._triggerExplosion(blastPos, p.blastRadius ?? 9.5, p.damage, false, true, {
                  canBreakSilver: true,
                  canBreakCrackedWall: true,
                  sourceIsPlayer: projFromPlayer,
                  isExplosion: true
                });
                if (typeof p.onExplode === 'function') {
                  p.onExplode(blastPos);
                }
              } else if (p.type === 'punisher_50cal') {
                this._triggerMicroImpactBlast(p.mesh.position.clone(), projFromPlayer);
              } else {
                this._spawnFxParticle?.(
                  TRAIL_CUBE_GEO, 0xfbbf24, 0.92, px, py, pz,
                  0.35, 0.35, 0.35, (Math.random() - 0.5) * 6, 1.8 + Math.random() * 2.5, (Math.random() - 0.5) * 6, 0.16
                );
              }
              hit = true;
              break;
            }
          }
        }
        if (hit) break;

        const floorY = this.world?.getTerrainHeightAt
          ? this.world.getTerrainHeightAt(p.mesh.position.x, p.mesh.position.z)
          : 0;
        if (p.mesh.position.y <= floorY + 0.22) {
          const blastPos = new THREE.Vector3(p.mesh.position.x, floorY + 0.2, p.mesh.position.z);
          if (p.type === 'fireball' || p.type === 'rpg_rocket') {
            this._triggerExplosion(
              blastPos,
              p.blastRadius ?? 4.2,
              p.damage,
              false,
              Boolean(p.isSupernovaBlast),
              {
                canBreakSilver: Boolean(p.canBreakSilver),
                canBreakCrackedWall: Boolean(p.canBreakCrackedWall),
                sourceIsPlayer: projFromPlayer,
                isExplosion: true
              }
            );
            if (typeof p.onExplode === 'function') {
              p.onExplode(blastPos);
            }
          } else if (p.type === 'punisher_50cal') {
            this._triggerMicroImpactBlast(blastPos, projFromPlayer);
          }
          hit = true;
          break;
        }
      }

      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        disposeTransientObject3D(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  },

  _updateThrownCars(dt) {
    for (let i = this.thrownCars.length - 1; i >= 0; i--) {
      const tc = this.thrownCars[i];
      tc.timer -= dt;
      tc.vel.y -= 20.0 * dt;
      const carObj = tc.carObj;
      if (!carObj || carObj.destroyed) {
        this.thrownCars.splice(i, 1);
        continue;
      }
      carObj.mesh.position.addScaledVector(tc.vel, dt);
      carObj.mesh.rotation.x += dt * 7.5;
      carObj.mesh.rotation.z += dt * 5.2;

      const cx = carObj.mesh.position.x;
      const cy = carObj.mesh.position.y;
      const cz = carObj.mesh.position.z;
      let hitAny = cy <= (carObj.groundY ?? 0) + 0.25;

      if (!hitAny) {
        const thrownNear = this.getObjectsNear(cx, cz, 5.5);
        for (const obj of thrownNear) {
          if (obj.destroyed || obj === carObj || obj.isDriven) continue;
          const dHoriz = Math.hypot(cx - obj.basePos.x, cz - obj.basePos.z);
          const dVert = Math.abs(cy - (obj.basePos.y + obj.height * 0.5));
          if (dHoriz <= obj.radius + 2.2 && dVert <= obj.height + 1.8) {
            hitAny = true;
            break;
          }
        }
      }

      if (hitAny || tc.timer <= 0) {
        const fromPlayer = tc.sourceIsPlayer !== undefined ? Boolean(tc.sourceIsPlayer) : true;
        const blastPos = carObj.mesh.position.clone();
        carObj.basePos.copy(blastPos);
        this._shatterObject(carObj, blastPos, { sourceIsPlayer: fromPlayer });
        this._triggerExplosion(blastPos, 9.5, 180, false, true, {
          canBreakCrackedWall: true,
          canBreakSilver: true,
          sourceIsPlayer: fromPlayer,
          isExplosion: true
        });
        this.thrownCars.splice(i, 1);
      }
    }
  },

  _updateGrenades(dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      g.age = (g.age || 0) + dt;
      g.timer -= dt;
      g.vel.y -= 18.0 * dt;
      g.mesh.position.addScaledVector(g.vel, dt);
      g.mesh.rotation.x += dt * 12;
      g.mesh.rotation.z += dt * 9;

      const gx = g.mesh.position.x;
      const gy = g.mesh.position.y;
      const gz = g.mesh.position.z;
      const r = 0.22;

      let hitCollision = false;

      const groundY = typeof g.getTerrainHeightAt === 'function' ? g.getTerrainHeightAt(gx, gz) : 0;
      if (gy <= groundY + 0.22) {
        g.mesh.position.y = groundY + 0.22;
        hitCollision = true;
      }

      if (!hitCollision && (this.world?.getCollidersNear || g.worldColliders)) {
        const grenCols = this.world?.getCollidersNear
          ? this.world.getCollidersNear(gx, gz, 2.0)
          : g.worldColliders;
        for (const col of grenCols) {
          if (col.disabled) continue;
          const colMinY = col.minY ?? 0;
          if (
            gx + r >= col.minX &&
            gx - r <= col.maxX &&
            gz + r >= col.minZ &&
            gz - r <= col.maxZ &&
            gy - r <= col.maxY &&
            gy + r >= colMinY
          ) {
            hitCollision = true;
            break;
          }
        }
      }

      if (!hitCollision) {
        const grenObjs = this.getObjectsNear(gx, gz, 3.0);
        for (const obj of grenObjs) {
          if (obj.destroyed) continue;
          const dHoriz = Math.hypot(gx - obj.basePos.x, gz - obj.basePos.z);
          const dVert = Math.abs(gy - (obj.basePos.y + obj.height * 0.5));
          if (dHoriz <= obj.radius + r && dVert <= obj.height * 0.6 + r) {
            hitCollision = true;
            break;
          }
        }
      }

      if (hitCollision || g.timer <= 0) {
        const fromPlayer = g.sourceIsPlayer !== undefined ? Boolean(g.sourceIsPlayer) : true;
        const blastPos = g.mesh.position.clone();
        this._triggerExplosion(blastPos, 6.8, 70, true, false, {
          sourceIsPlayer: fromPlayer,
          isExplosion: true
        });
        if (typeof g.onExplode === 'function') {
          g.onExplode(blastPos);
        }
        this.scene.remove(g.mesh);
        disposeTransientObject3D(g.mesh);
        this.grenades.splice(i, 1);
      }
    }
  }
};
