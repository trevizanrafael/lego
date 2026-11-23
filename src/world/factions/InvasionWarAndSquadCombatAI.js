import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { animateFactionSoldier } from '../../entities/FactionSoldierBuilder.js';
import { BANK_SPEC } from '../regions/SuperBankBuilder.js';
import { AgentSeparationSystem, computeDistinctArrivalSlot } from '../collision/AgentSeparation.js';
import { projectSlideVelocity2D } from '../collision/CollisionQueries.js';
import { FACTION_THEME } from './TerritoryZonesAndConfigs.js';
import { updateAllyHqUnitBehavior } from './GarrisonPeaceAndAlliesAI.js';
import { HUMANOID_STATES } from '../npc-health/HumanoidHealthModel.js';
import { applyHumanoidHitPose, applyHumanoidKnockbackStep } from '../npc-health/HumanoidHitReactions.js';
import { ensureSharedWarGeometries, ALLY_BULLET_MAT, ROCKET_MAT, getFactionBulletMat } from './CombatUnitsAndConvoys3D.js';

const COMBAT_CELL = 24.0;
const _capPos = { x: 0, y: 0, z: 0 };
const _capOut = {};
let _capIgnoreCols = null;
const _capFilter = (col) => !_capIgnoreCols || _capIgnoreCols.indexOf(col) === -1;
const _capOpts = { stepUpHeight: 0.38, ignoreColliders: null, filter: _capFilter, out: _capOut };
const _slideOut = { vx: 0, vz: 0, x: 0, z: 0 };
const _stepOut = { x: 0, z: 0, collided: false };
const _slotOut = { x: 0, z: 0, radius: 0, angle: 0, ring: 0 };
const _kbOut = { x: 0, z: 0, valid: true };

const _dirTmp = new THREE.Vector3();
const _lookTmp = new THREE.Vector3();
const _c4PosTmp = new THREE.Vector3();

const _projectilePool = [];
const _flashShockwavePool = [];
const _ringShockwavePool = [];

function packCombatCell(gx, gz) {
  return ((gx & 0xffff) << 16) | (gz & 0xffff);
}

function rebuildCombatSpatialGrid(sys) {
  let grid = sys._combatGrid;
  let used = sys._combatUsedBuckets;
  if (!grid) {
    grid = new Map();
    used = [];
    sys._combatGrid = grid;
    sys._combatUsedBuckets = used;
  } else {
    for (let i = 0; i < used.length; i++) used[i].length = 0;
    used.length = 0;
  }

  const list = sys.combatNpcs;
  for (let i = 0; i < list.length; i++) {
    const u = list[i];
    if (!u?.destructible || u.destructible.destroyed) continue;
    const p = u.visual.root.position;
    const key = packCombatCell(Math.floor(p.x / COMBAT_CELL), Math.floor(p.z / COMBAT_CELL));
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    if (bucket.length === 0) used.push(bucket);
    bucket.push(u);
  }
  return grid;
}

function acquireProjectileSlot(geo, mat) {
  for (let i = 0; i < _projectilePool.length; i++) {
    const slot = _projectilePool[i];
    if (!slot.active || !slot.mesh.parent) {
      slot.mesh.geometry = geo;
      slot.mesh.material = mat;
      slot.active = true;
      return slot;
    }
  }
  const mesh = new THREE.Mesh(geo, mat);
  const slot = {
    mesh,
    originPos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    isAllied: false,
    damage: 0,
    splash: 0,
    life: 0,
    active: true
  };
  _projectilePool.push(slot);
  return slot;
}

function acquireShockwaveSlot(isFlash, geo, colorHex, initScale, life) {
  const pool = isFlash ? _flashShockwavePool : _ringShockwavePool;
  for (let i = 0; i < pool.length; i++) {
    const slot = pool[i];
    if (!slot.active || !slot.mesh.parent) {
      slot.mesh.geometry = geo;
      slot.mat.color.setHex(colorHex);
      slot.mat.opacity = 0.9;
      slot.scale = initScale;
      slot.mesh.scale.setScalar(initScale);
      slot.life = life;
      slot.isFlash = isFlash;
      slot.active = true;
      return slot;
    }
  }
  const mat = markAsSharedAsset(
    new THREE.MeshBasicMaterial(
      isFlash
        ? { color: colorHex, transparent: true, opacity: 0.9, depthWrite: false }
        : { color: colorHex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }
    )
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(initScale);
  const slot = { mesh, mat, scale: initScale, life, isFlash, active: true, _pooled: true };
  pool.push(slot);
  return slot;
}

function resolveSoldierCapsule(sys, npc, candX, candZ, curY) {
  const radius = npc.isBoss ? 0.92 : 0.48, height = npc.isBoss ? 2.6 : 2.0;
  if (typeof sys.world?.resolveCapsulePenetration === 'function') {
    const ownCols = npc.destructible?.colliders;
    _capPos.x = candX; _capPos.y = curY; _capPos.z = candZ;
    _capIgnoreCols = ownCols && ownCols.length > 0 ? ownCols : null;
    _capOpts.ignoreColliders = _capIgnoreCols;
    return sys.world.resolveCapsulePenetration(_capPos, radius, height, _capOpts);
  }
  return sys.livingCity._resolveBuildingCollision(candX, candZ, npc.isBoss ? 1.85 : 0.95);
}

function stepFactionSoldier(sys, npc, pos, dx, dz, dist, stepDist) {
  if (dist < 1e-4 || stepDist <= 1e-4) {
    _stepOut.x = pos.x; _stepOut.z = pos.z; _stepOut.collided = false;
    return _stepOut;
  }
  let dirX = dx / dist, dirZ = dz / dist;
  if (npc._avoidX || npc._avoidZ) {
    dirX += npc._avoidX * 0.55; dirZ += npc._avoidZ * 0.55;
    const dLen = Math.hypot(dirX, dirZ);
    if (dLen > 1e-5) { dirX /= dLen; dirZ /= dLen; }
  }
  const res = resolveSoldierCapsule(sys, npc, pos.x + dirX * stepDist, pos.z + dirZ * stepDist, pos.y);
  let fx = res.x, fz = res.z;
  const collided = Boolean(res.collided);
  if (collided && typeof sys.world?.resolveCapsulePenetration === 'function') {
    const hitNx = res.hitNormalX || 0, hitNz = res.hitNormalZ || 0;
    if (Math.abs(hitNx) > 1e-4 || Math.abs(hitNz) > 1e-4) {
      projectSlideVelocity2D(dirX, dirZ, hitNx, hitNz, 0, _slideOut);
      let sx = _slideOut.vx, sz = _slideOut.vz, sLen = Math.hypot(sx, sz);
      if (sLen < 0.25) {
        const sign = (npc._slotIndex || 0) % 2 === 0 ? 1 : -1;
        sx = -hitNz * sign; sz = hitNx * sign; sLen = Math.hypot(sx, sz);
      }
      if (sLen > 1e-4 && Math.hypot(fx - pos.x, fz - pos.z) < stepDist * 0.75) {
        const slideRes = resolveSoldierCapsule(sys, npc, res.x + (sx / sLen) * stepDist * 0.92, res.z + (sz / sLen) * stepDist * 0.92, pos.y);
        fx = slideRes.x; fz = slideRes.z;
      }
    }
  }
  _stepOut.x = fx; _stepOut.z = fz; _stepOut.collided = collided;
  return _stepOut;
}

function applySafeSoldierFloorPos(sys, pos, nx, nz) {
  const ny = sys._groundAt(nx, nz, pos.y);
  if (sys.activeMode === 'BANK_HEIST' && Math.abs(ny - pos.y) > 2.2) return false;
  pos.set(nx, ny, nz);
  return true;
}

function separateCombatSquads(sys, playerPos) {
  const sepSys = sys._factionSeparationSys || (sys._factionSeparationSys = new AgentSeparationSystem({ cellSize: 4.0, maxActiveDist: 185, passes: 2 }));
  const agents = sys._factionSepAgents || (sys._factionSepAgents = []);
  const pool = sys._factionSepPool || (sys._factionSepPool = []);
  agents.length = 0;
  let pIdx = 0;
  const alloc = () => pool[pIdx++] || (pool[pIdx - 1] = {});

  for (let i = 0; i < sys.combatNpcs.length; i++) {
    const npc = sys.combatNpcs[i];
    if (!npc?.destructible || npc.destructible.destroyed || npc.humanoidHealth?.state === HUMANOID_STATES.DEAD) continue;
    const pos = npc.visual.root.position, e = alloc();
    e.npc = npc; e.x = pos.x; e.y = pos.y; e.z = pos.z;
    e.radius = npc.isBoss ? 1.25 : 0.68; e.weight = npc.isBoss ? 4.0 : 1.0; e.immovable = false;
    agents.push(e);
  }
  if (agents.length < 2) return;

  for (let iter = 0; iter < 2; iter++) {
    sepSys.separateAgents(agents, playerPos || null);
    let wallClamped = false;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i], npc = a.npc, pos = npc.visual.root.position;
      if (iter === 0) { npc._avoidX = a.avoidX; npc._avoidZ = a.avoidZ; }
      if (a.sepPushX === 0 && a.sepPushZ === 0) continue;
      const res = resolveSoldierCapsule(sys, npc, pos.x + a.sepPushX, pos.z + a.sepPushZ, pos.y);
      if (res.collided) wallClamped = true;
      if (applySafeSoldierFloorPos(sys, pos, res.x, res.z)) {
        npc.destructible.basePos.copy(pos);
        npc.destructible.groundY = pos.y;
      }
      a.x = pos.x; a.y = pos.y; a.z = pos.z;
    }
    if (!wallClamped) break;
  }
}

export const invasionSquadCombatMethods = {
  _updateCombatUnitsAndHealBeams(dt, playerPos, controller, zoneState) {
    this._aiTick = ((this._aiTick || 0) + 1) | 0;
    for (let bi = 0; bi < this.healBeams.length; bi++) this.healBeams[bi].visible = false;
    const healState = this._healStateScratch || (this._healStateScratch = { beamIdx: 0, playerBeingHealed: false });
    healState.beamIdx = 0;
    healState.playerBeingHealed = false;

    let alliedTotal = 0, enemyTotal = 0;
    for (let k = 0; k < this.combatNpcs.length; k++) {
      const u = this.combatNpcs[k];
      if (!u?.destructible || u.destructible.destroyed) continue;
      u._slotIndex = u.isAllied ? alliedTotal++ : enemyTotal++;
    }

    const combatGrid = rebuildCombatSpatialGrid(this);
    const throttleAI = dt < 0.08;
    const isPlayerStealthed = Boolean(controller?.operatorAbilities?.isStealthed?.() || (controller?.stealthTimer || 0) > 0);
    const curZoneIdx = zoneState ? zoneState.activeIndex : -1;

    for (let i = this.combatNpcs.length - 1; i >= 0; i--) {
      const npc = this.combatNpcs[i], obj = npc.destructible;
      if (!obj || obj.destroyed) {
        if (obj) {
          const keepCorpse = obj._managedByCorpseManager ? npc.visual?.root : null;
          if (npc.visual?.allyMarker) npc.visual.allyMarker.visible = false;
          if (npc.visual?.muzzleFlash) npc.visual.muzzleFlash.visible = false;
          if (npc.visual?.drone) npc.visual.drone.visible = false;
          this.destructibles.unregisterDestructible(obj);
          if (keepCorpse && this.scene && keepCorpse.parent !== this.scene) this.scene.add(keepCorpse);
        }
        this.combatNpcs.splice(i, 1);
        continue;
      }

      const root = npc.visual.root, pos = root.position;
      npc.visual.allyMarker.visible = npc.isAllied;
      if (npc.isAllied) npc.visual.allyMarker.rotation.y += dt * 2.8;
      if (npc.muzzleTimer > 0 && (npc.muzzleTimer -= dt) <= 0) npc.visual.muzzleFlash.visible = false;
      if (obj._signalMarkedTimer > 0) obj._signalMarkedTimer = Math.max(0, obj._signalMarkedTimer - dt);

      if (npc.humanoidHealth) {
        npc.humanoidHealth.update(dt);
        if (npc.humanoidHealth.state === HUMANOID_STATES.STAGGER || npc.humanoidHealth.state === HUMANOID_STATES.DOWNED) {
          npc.visual.muzzleFlash.visible = false;
          applyHumanoidKnockbackStep(root, npc.humanoidHealth, dt, (nx, nz) => {
            const res = resolveSoldierCapsule(this, npc, nx, nz, pos.y);
            _kbOut.x = res.x; _kbOut.z = res.z; _kbOut.valid = true;
            return _kbOut;
          });
          const gY = this._groundAt(pos.x, pos.z, pos.y);
          applyHumanoidHitPose(npc.visual, npc.humanoidHealth, gY, dt, { unitScale: npc.unitScale || 1 });
          obj.basePos.set(pos.x, gY, pos.z); obj.groundY = gY;
          continue;
        }
      }

      root.rotation.x = 0; root.rotation.z = 0;
      npc.visual.leftLeg.rotation.z = 0; npc.visual.rightLeg.rotation.z = 0;
      animateFactionSoldier(npc.visual, this._animClock, npc.patrolAngle);

      if (npc.stunTimer > 0) {
        npc.stunTimer = Math.max(0, npc.stunTimer - dt);
        npc.visual.muzzleFlash.visible = false;
        npc.visual.leftLeg.rotation.x *= 0.85; npc.visual.rightLeg.rotation.x *= 0.85;
        obj.basePos.copy(pos);
        continue;
      }

      if (this.activeMode === 'ALLY_HQ') {
        updateAllyHqUnitBehavior(this, npc, dt, playerPos, healState);
        continue;
      }

      const sideCount = npc.isAllied ? alliedTotal : enemyTotal;
      const slotIdx = npc._slotIndex || 0;

      if (npc.isAllied && npc.role === 'medic') {
        const dPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (this.livingCity.playerHp < this.livingCity.playerMaxHp && dPlayer < 20) {
          this._applyPlayerHeal(dt * 34, pos, playerPos, healState.beamIdx++);
          healState.playerBeingHealed = true;
        }
        if (dPlayer > 6.5) {
          const mSlot = computeDistinctArrivalSlot(playerPos.x, playerPos.z, slotIdx, Math.max(1, sideCount), 4.5, 2.5, _slotOut);
          const mdx = mSlot.x - pos.x, mdz = mSlot.z - pos.z, md = Math.hypot(mdx, mdz);
          const res = stepFactionSoldier(this, npc, pos, mdx, mdz, md, Math.min(md, npc.speed * dt));
          applySafeSoldierFloorPos(this, pos, res.x, res.z);
          root.rotation.y = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
          npc.walkPhase += dt * 8.5;
          const sw = Math.sin(npc.walkPhase) * 0.55;
          npc.visual.leftLeg.rotation.x = sw;
          npc.visual.rightLeg.rotation.x = -sw;
          obj.basePos.copy(pos);
          continue;
        }
      }

      if (npc.retreating && npc.patrolAnchor) {
        const rGoal = sideCount > 1
          ? computeDistinctArrivalSlot(npc.patrolAnchor.x, npc.patrolAnchor.z, slotIdx, sideCount, 2.4, 2.0, _slotOut)
          : npc.patrolAnchor;
        const rdx = rGoal.x - pos.x, rdz = rGoal.z - pos.z, rd = Math.hypot(rdx, rdz);
        if (rd < 2.8) {
          npc.retreating = false;
          npc._cachedDecision = false;
        } else {
          const step = Math.min(rd, npc.speed * 1.25 * dt);
          const res = stepFactionSoldier(this, npc, pos, rdx, rdz, rd, step);
          if (res.collided && Math.hypot(res.x - pos.x, res.z - pos.z) < step * 0.08) {
            npc.retreating = false;
            npc._cachedDecision = false;
          }
          applySafeSoldierFloorPos(this, pos, res.x, res.z);
          root.rotation.y = Math.atan2(rdx, rdz);
          npc.walkPhase += dt * 11;
          const sw = Math.sin(npc.walkPhase) * 0.7;
          npc.visual.leftLeg.rotation.x = sw;
          npc.visual.rightLeg.rotation.x = -sw;
          obj.basePos.copy(pos);
          continue;
        }
      }

      const cachedNpcDead =
        npc._cachedBestTargetNpc &&
        (!npc._cachedBestTargetNpc.destructible || npc._cachedBestTargetNpc.destructible.destroyed);
      const stealthInvalidated = npc._cachedTargetIsPlayer && isPlayerStealthed;
      const modeChanged = npc._cachedMode !== this.activeMode || npc._cachedZoneIdx !== curZoneIdx;
      const shouldThink =
        !throttleAI ||
        !npc._cachedDecision ||
        (i + this._aiTick) % 6 === 0 ||
        cachedNpcDead ||
        stealthInvalidated ||
        modeChanged;

      let bestTargetPos = null;
      let bestTargetNpc = null;
      let bestDist = 72;

      if (shouldThink) {
        let bestDistSq = 72 * 72;
        const cgx = Math.floor(pos.x / COMBAT_CELL);
        const cgz = Math.floor(pos.z / COMBAT_CELL);
        for (let dx = -3; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const bucket = combatGrid.get(packCombatCell(cgx + dx, cgz + dz));
            if (!bucket || bucket.length === 0) continue;
            for (let bi = 0; bi < bucket.length; bi++) {
              const other = bucket[bi];
              if (other === npc || other.isAllied === npc.isAllied || !other.destructible || other.destructible.destroyed) continue;
              const oPos = other.visual.root.position;
              if (Math.abs(oPos.y - pos.y) > 4.5) continue;
              const ddx = oPos.x - pos.x, ddz = oPos.z - pos.z;
              const dSq = ddx * ddx + ddz * ddz;
              if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestTargetNpc = other;
                bestTargetPos = oPos;
              }
            }
          }
        }
        if (bestTargetPos) bestDist = Math.sqrt(bestDistSq);

        if (!npc.isAllied && !isPlayerStealthed) {
          const dPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
          if (dPlayer < bestDist * 0.92 && dPlayer < 65 && Math.abs(playerPos.y - pos.y) < 4.5) {
            bestDist = dPlayer;
            bestTargetNpc = null;
            bestTargetPos = playerPos;
          }
        }

        let moveTarget = bestTargetPos, stopRange = npc.isBoss ? 14.0 : 16.5, useFormationSlot = false;
        if (!moveTarget && npc.isAllied && this.activeMode === 'BANK_HEIST') {
          moveTarget = Math.abs(playerPos.y - pos.y) < 3 ? playerPos : npc.patrolAnchor;
          stopRange = 3.5; useFormationSlot = sideCount > 1;
        } else if (!moveTarget && npc.isAllied && zoneState && this.activeMode === 'COUNTER_ATTACK') {
          moveTarget = npc.patrolAnchor || zoneState.spec.bossCourtyard;
          stopRange = 3.0; useFormationSlot = sideCount > 1;
        } else if (!moveTarget && npc.isAllied && zoneState) {
          const nextOp = zoneState.outposts[zoneState.activeIndex];
          moveTarget = nextOp || (zoneState.bossPhaseTriggered ? zoneState.spec.bossCourtyard : null) || playerPos;
          stopRange = 2.5; useFormationSlot = sideCount > 1;
        } else if (!moveTarget && !npc.isAllied && npc.patrolAnchor) {
          moveTarget = npc.patrolAnchor;
          stopRange = sideCount > 1 ? 1.5 : 3.5; useFormationSlot = sideCount > 1;
        } else if (moveTarget && sideCount > 1) {
          useFormationSlot = true;
        }
        if (npc.role === 'special' && npc.faction === 'pcc' && bestTargetPos && !npc.isAllied) {
          stopRange = 1.2; useFormationSlot = false;
        }

        let goalX = 0, goalZ = 0, effStop = stopRange;
        if (moveTarget) {
          const goal = useFormationSlot
            ? computeDistinctArrivalSlot(
                moveTarget.x,
                moveTarget.z,
                slotIdx,
                sideCount,
                bestTargetPos ? Math.min(stopRange * 0.65, 6.5) : 2.6,
                bestTargetPos ? 3.2 : 2.2,
                _slotOut
              )
            : moveTarget;
          goalX = goal.x;
          goalZ = goal.z;
          effStop = useFormationSlot && !bestTargetPos ? 0.9 : (useFormationSlot ? Math.max(1.8, stopRange * 0.55) : stopRange);
        }

        npc._cachedDecision = true;
        npc._cachedMode = this.activeMode;
        npc._cachedZoneIdx = curZoneIdx;
        npc._cachedBestTargetNpc = bestTargetNpc;
        npc._cachedTargetIsPlayer = bestTargetPos === playerPos;
        npc._cachedHasTarget = Boolean(bestTargetPos);
        npc._cachedHasMove = Boolean(moveTarget);
        npc._cachedUseSlot = useFormationSlot;
        npc._cachedGoalX = goalX;
        npc._cachedGoalZ = goalZ;
        npc._cachedLookX = moveTarget ? moveTarget.x : 0;
        npc._cachedLookZ = moveTarget ? moveTarget.z : 0;
        npc._cachedStopRange = effStop;
      } else {
        if (npc._cachedTargetIsPlayer && !isPlayerStealthed && Math.abs(playerPos.y - pos.y) < 4.5) {
          bestTargetPos = playerPos;
          bestTargetNpc = null;
          bestDist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        } else if (npc._cachedBestTargetNpc?.destructible && !npc._cachedBestTargetNpc.destructible.destroyed) {
          bestTargetNpc = npc._cachedBestTargetNpc;
          bestTargetPos = bestTargetNpc.visual.root.position;
          if (Math.abs(bestTargetPos.y - pos.y) <= 4.5) {
            bestDist = Math.hypot(bestTargetPos.x - pos.x, bestTargetPos.z - pos.z);
          } else {
            bestTargetPos = null;
            bestTargetNpc = null;
          }
        }
      }

      if (npc._cachedHasMove) {
        const goalX = !npc._cachedUseSlot && bestTargetPos ? bestTargetPos.x : npc._cachedGoalX;
        const goalZ = !npc._cachedUseSlot && bestTargetPos ? bestTargetPos.z : npc._cachedGoalZ;
        const lookX = bestTargetPos ? bestTargetPos.x : npc._cachedLookX;
        const lookZ = bestTargetPos ? bestTargetPos.z : npc._cachedLookZ;
        const effStop = npc._cachedStopRange;
        const dx = goalX - pos.x, dz = goalZ - pos.z, dist = Math.hypot(dx, dz);
        root.rotation.y = Math.atan2(lookX - pos.x, lookZ - pos.z);

        if (dist > effStop) {
          const step = Math.min(dist - effStop * 0.65, npc.speed * dt);
          const res = stepFactionSoldier(this, npc, pos, dx, dz, dist, Math.max(0.02, step));
          applySafeSoldierFloorPos(this, pos, res.x, res.z);
          npc.walkPhase += dt * (npc.isBoss ? 6.0 : 8.5);
          const sw = Math.sin(npc.walkPhase) * 0.55;
          npc.visual.leftLeg.rotation.x = sw;
          npc.visual.rightLeg.rotation.x = -sw;
        } else {
          npc.visual.leftLeg.rotation.x *= 0.85; npc.visual.rightLeg.rotation.x *= 0.85;
        }
      }

      if ((npc.isBoss || npc.heavyClass === 'brute') && bestTargetPos && bestDist < 12.5 && (npc.slamCooldown -= dt) <= 0) {
        npc.slamCooldown = 5.2;
        this._triggerBossGroundSlam(npc, bestTargetPos === playerPos ? controller : null, playerPos);
      }

      if (npc.role === 'special' && npc.faction === 'pcc' && bestTargetPos && bestDist < 3.4) {
        this._detonateC4Runner(npc, bestTargetPos === playerPos ? controller : null, playerPos, zoneState);
        continue;
      }

      npc.fireCooldown -= dt;
      if (bestTargetPos && bestDist < 54 && npc.fireCooldown <= 0 && Math.abs((bestTargetPos.y ?? pos.y) - pos.y) <= 4.5) {
        npc.fireCooldown =
          npc.heavyClass === 'elite' ? 0.2 : npc.heavyClass === 'brute' ? 0.75 : npc.isBoss ? 0.55 :
          npc.role === 'tank' ? 0.95 : npc.role === 'special' ? (npc.faction === 'cv' ? 3.2 : npc.faction === 'ares' ? 0.42 : 1.1) :
          0.82 + Math.random() * 0.35;
        if (this._hasClearLineOfSight(pos.x, pos.z, bestTargetPos.x, bestTargetPos.z)) {
          this._fireUnitProjectile(npc, bestTargetPos, bestTargetNpc);
        }
      }
      obj.basePos.copy(pos);
    }

    if (!(throttleAI && this.combatNpcs.length > 10 && (this._aiTick & 1) === 1)) {
      separateCombatSquads(this, playerPos);
    }
    if (!healState.playerBeingHealed && this.hud?.heartsContainer) this.hud.heartsContainer.classList.remove('healing-pulse');
  },

  _fireUnitProjectile(npc, targetPos, targetNpc) {
    const geos = ensureSharedWarGeometries(), theme = FACTION_THEME[npc.faction] || FACTION_THEME.cv;
    const origin = npc.visual.root.position;
    const isRpg = npc.role === 'special' && npc.faction === 'cv';
    const isDrone = npc.role === 'special' && npc.faction === 'ares' && npc.visual.drone;
    const startY = origin.y + (npc.isBoss ? 3.1 : npc.hitH ? npc.hitH * 0.6 : isDrone ? 2.7 : isRpg ? 1.62 : 1.38);
    const targetY = (targetPos.y ?? origin.y) + (targetNpc?.isBoss ? 2.6 : 1.2);
    _dirTmp.set(
      targetPos.x - origin.x + (Math.random() - 0.5) * 1.4,
      targetY - startY,
      targetPos.z - origin.z + (Math.random() - 0.5) * 1.4
    ).normalize();

    const slot = acquireProjectileSlot(
      isRpg ? geos.rocketGeo : geos.bulletGeo,
      isRpg ? ROCKET_MAT : npc.isAllied ? ALLY_BULLET_MAT : getFactionBulletMat(npc.faction, theme.hex)
    );
    const bulletMesh = slot.mesh;
    bulletMesh.position.set(origin.x + _dirTmp.x * 1.1, startY, origin.z + _dirTmp.z * 1.1);
    _lookTmp.copy(bulletMesh.position).add(_dirTmp);
    bulletMesh.lookAt(_lookTmp);
    this.scene.add(bulletMesh);

    npc.visual.muzzleFlash.visible = true; npc.muzzleTimer = 0.08;
    slot.originPos.copy(bulletMesh.position);
    slot.vel.copy(_dirTmp).multiplyScalar(npc.isBoss ? 48 : isRpg ? 26 : 42);
    slot.isAllied = npc.isAllied;
    slot.damage = npc.heavyClass === 'elite' ? 6 : npc.heavyClass === 'brute' ? 13 : npc.isBoss ? 16 : isRpg ? 22 : isDrone ? 4 : npc.faction === 'guard' ? 5 : npc.role === 'tank' ? 11 : 8;
    slot.splash = isRpg ? 5.5 : 0;
    slot.life = isRpg ? 2.4 : 1.45;
    this.npcProjectiles.push(slot);
  },

  _triggerBossGroundSlam(bossNpc, controller, playerPos) {
    const geos = ensureSharedWarGeometries(), theme = FACTION_THEME[bossNpc.faction] || FACTION_THEME.cv;
    const bPos = bossNpc.visual.root.position;
    const swSlot = acquireShockwaveSlot(false, geos.shockwaveGeo, theme.hex, 1.0, 0.55);
    swSlot.mesh.position.set(bPos.x, bPos.y + 0.25, bPos.z);
    this.scene.add(swSlot.mesh);
    this.activeShockwaves.push(swSlot);

    for (let k = 0; k < this.combatNpcs.length; k++) {
      const other = this.combatNpcs[k];
      if (other.isAllied === bossNpc.isAllied || !other.destructible || other.destructible.destroyed) continue;
      if (Math.hypot(other.visual.root.position.x - bPos.x, other.visual.root.position.z - bPos.z) < 11.5) {
        this.destructibles.damageObject(other.destructible, 65, bPos, false, { fromEnemyNpc: true, isExplosion: true, sourceIsPlayer: false });
      }
    }
    if (!bossNpc.isAllied && playerPos && Math.hypot(playerPos.x - bPos.x, playerPos.z - bPos.z) < 10.5 && Math.abs(playerPos.y - bPos.y) < 3.5) {
      this._damagePlayerInInvasion(18, controller, null, bPos);
    }
  },

  _updateProjectilesAndShockwaves(dt, playerPos, controller, zoneState) {
    for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
      const sw = this.activeShockwaves[i];
      sw.life -= dt; sw.scale += dt * (sw.isFlash ? 9.0 : 18.0);
      sw.mesh.scale.setScalar(sw.scale);
      sw.mat.opacity = Math.max(0, sw.life * (sw.isFlash ? 2.2 : 1.6));
      if (sw.life <= 0) {
        if (sw.mesh.parent) sw.mesh.parent.remove(sw.mesh);
        sw.active = false;
        if (!sw._pooled) sw.mat.dispose?.();
        this.activeShockwaves.splice(i, 1);
      }
    }

    if (this.npcProjectiles.length === 0) return;
    const combatGrid = rebuildCombatSpatialGrid(this);

    for (let i = this.npcProjectiles.length - 1; i >= 0; i--) {
      const p = this.npcProjectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const px = p.mesh.position.x, py = p.mesh.position.y, pz = p.mesh.position.z;

      if (p.life <= 0 || this.livingCity._isInsideBuilding(px, pz, 0.15)) {
        if (p.splash) this._npcExplosion(p.mesh.position, p.splash, p.damage, p.isAllied, controller, zoneState);
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.active = false;
        this.npcProjectiles.splice(i, 1);
        continue;
      }
      if (!p.isAllied && controller?.operatorAbilities?.isProjectileBlocked?.(p.mesh.position, p.originPos)) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.active = false;
        this.npcProjectiles.splice(i, 1);
        continue;
      }

      let hit = false;
      const pgx = Math.floor(px / COMBAT_CELL);
      const pgz = Math.floor(pz / COMBAT_CELL);
      for (let dx = -1; dx <= 1 && !hit; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = combatGrid.get(packCombatCell(pgx + dx, pgz + dz));
          if (!bucket || bucket.length === 0) continue;
          for (let bi = 0; bi < bucket.length; bi++) {
            const npc = bucket[bi];
            if (npc.isAllied === p.isAllied || !npc.destructible || npc.destructible.destroyed) continue;
            const nPos = npc.visual.root.position;
            const hitR = npc.hitR ?? (npc.isBoss ? 2.3 : 1.05), hitH = npc.hitH ?? (npc.isBoss ? 5.0 : 2.3);
            if (Math.abs(px - nPos.x) < hitR && Math.abs(pz - nPos.z) < hitR && py >= nPos.y && py <= nPos.y + hitH) {
              this.destructibles.damageObject(npc.destructible, p.damage * 2.2, p.mesh.position, false, {
                fromEnemyNpc: true, isExplosion: Boolean(p.splash), sourceIsPlayer: false, shotOrigin: p.originPos || null, shotDir: p.vel
              });
              hit = true; break;
            }
          }
          if (hit) break;
        }
      }
      if (!hit && !p.isAllied && this.isInvasionActive && playerPos) {
        if (Math.abs(px - playerPos.x) < 0.95 && Math.abs(pz - playerPos.z) < 0.95 && py >= playerPos.y - 0.2 && py <= playerPos.y + 2.3) {
          this._damagePlayerInInvasion(p.damage, controller, zoneState, p.originPos || p.mesh.position);
          hit = true;
        }
      }
      if (hit) {
        if (p.splash) this._npcExplosion(p.mesh.position, p.splash, p.damage, p.isAllied, controller, zoneState);
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        p.active = false;
        this.npcProjectiles.splice(i, 1);
      }
    }
  },

  _npcExplosion(center, radius, damage, fromAllied, controller, zoneState) {
    const geos = ensureSharedWarGeometries();
    soundFX.playExplosion(0.85);
    const flashSlot = acquireShockwaveSlot(true, geos.blastGeo, 0xf97316, 0.6, 0.4);
    flashSlot.mesh.position.copy(center);
    this.scene.add(flashSlot.mesh);
    this.activeShockwaves.push(flashSlot);

    const ringSlot = acquireShockwaveSlot(false, geos.shockwaveGeo, 0xf59e0b, 1.0, 0.45);
    ringSlot.mesh.position.set(center.x, center.y - 0.6, center.z);
    this.scene.add(ringSlot.mesh);
    this.activeShockwaves.push(ringSlot);

    for (let k = 0; k < this.combatNpcs.length; k++) {
      const other = this.combatNpcs[k];
      if (other.isAllied === fromAllied || !other.destructible || other.destructible.destroyed) continue;
      const op = other.visual.root.position, d = Math.hypot(op.x - center.x, op.z - center.z);
      if (d < radius) this.destructibles.damageObject(other.destructible, damage * 3 * (1 - d / (radius * 1.4)), center, false, { fromEnemyNpc: true, isExplosion: true, sourceIsPlayer: false });
    }
    const pp = this._lastController?.position;
    if (!fromAllied && pp) {
      const dp = Math.hypot(pp.x - center.x, pp.z - center.z);
      if (dp < radius && Math.abs(pp.y - center.y) < 4) this._damagePlayerInInvasion(damage * (1 - dp / (radius * 1.3)), controller, zoneState, center);
    }
  },

  _detonateC4Runner(npc, controller, playerPos, zoneState) {
    _c4PosTmp.copy(npc.visual.root.position); _c4PosTmp.y += 1.0;
    this._npcExplosion(_c4PosTmp, 6.5, 30, npc.isAllied, controller, zoneState);
    if (npc.destructible && !npc.destructible.destroyed) this.destructibles.damageObject(npc.destructible, 99999, _c4PosTmp, false, { fromEnemyNpc: true, isExplosion: true, sourceIsPlayer: false });
  },

  _damagePlayerInInvasion(amount, controller, zoneState = null, attackerPos = null) {
    if (!this.isInvasionActive || amount <= 0) return;
    if (controller?.operatorAbilities?.isStealthed?.() && attackerPos && controller?.position && Math.hypot(attackerPos.x - controller.position.x, attackerPos.z - controller.position.z) > 6.0) return;
    const baseDmg = controller?.currentVehicle ? amount * 0.35 : amount;
    const dmg = this.livingCity?.applyMitigatedDamageToPlayer ? this.livingCity.applyMitigatedDamageToPlayer(baseDmg, controller, { attackerPos }) : baseDmg;
    this.livingCity.playerHp = Math.max(0, this.livingCity.playerHp - dmg);
    this.hud?.setPlayerHealth(this.livingCity.playerHp, this.livingCity.playerMaxHp, false);
    if (this.livingCity.playerHp <= 0) {
      if (controller) this._lastController = controller;
      if (this.activeMode === 'BANK_HEIST' && this.bankHeist.isActive) {
        const c = this._lastController, sx = 0, sz = BANK_SPEC.frontZ + 14;
        this.bankHeist.onPlayerDown();
        this.livingCity.playerHp = this.livingCity.playerMaxHp;
        this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
        if (c?.position) {
          if (c.currentVehicle) c.exitVehicle?.();
          c.position.set(sx, this._groundAt(sx, sz, 1) + 0.5, sz); c.velocity?.set(0, 0, 0);
          if (c.minifigure?.root) c.minifigure.root.position.copy(c.position);
        }
        return;
      }
      if (this.activeMode === 'COUNTER_ATTACK' && this.counterAttack.isActive) { this.counterAttack._lose('VOCÊ CAIU DEFENDENDO A BANDEIRA'); return; }
      this._failInvasion(zoneState || this.territories[this.activeZoneId], 'VOCÊ CAIU!', 'RECUO TÁTICO PARA O PORTÃO // OS POSTOS VOLTARAM AO DONO');
    }
  }
};
