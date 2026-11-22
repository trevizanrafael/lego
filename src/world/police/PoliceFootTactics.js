import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { AIM_POSE, animateFactionSoldier, createFactionSoldierVisual } from '../../entities/FactionSoldierBuilder.js';
import { HumanoidHealthModel, HUMANOID_STATES } from '../npc-health/HumanoidHealthModel.js';
import { applyHumanoidHitPose, applyHumanoidKnockbackStep } from '../npc-health/HumanoidHitReactions.js';
import { AgentSeparationSystem, computeDistinctArrivalSlot } from '../collision/AgentSeparation.js';
import { projectSlideVelocity2D } from '../collision/CollisionQueries.js';
import { DISPATCH_RULES, getStarForceBudget } from './PursuitTuning.js';

const _capPos = { x: 0, y: 0, z: 0 };
const _capOut = {};
const _slideOut = { vx: 0, vz: 0, x: 0, z: 0 };

export function getMaxFootUnitsForStars(sys, tierStars = sys?.stars ?? 0) {
  const cap = getStarForceBudget(tierStars).foot || 0;
  if (cap <= 0) return 0;
  return (sys?.isEscaping || sys?.pursuitState === 'SEARCH') ? Math.max(1, Math.floor(cap * (DISPATCH_RULES.searchBudgetFactor ?? 0.5))) : cap;
}
function getNearbyCols(sys, x, z, r, key) {
  return typeof sys.world?.getCollidersNear === 'function' ? sys.world.getCollidersNear(x, z, r, sys[key] || (sys[key] = [])) : sys.world?.colliders;
}
function resolveFootGroundY(sys, x, z, refY = 0) {
  if (typeof sys.world?.getSurfaceHeightAt === 'function') return sys.world.getSurfaceHeightAt(x, z, refY);
  return typeof sys.world?.getTerrainHeightAt === 'function' ? sys.world.getTerrainHeightAt(x, z) : refY;
}
function removeFootEntry(sys, fu) {
  if (fu?.visual?.muzzleFlash) fu.visual.muzzleFlash.visible = false;
  const corpse = fu?.obj?._managedByCorpseManager ? fu.mesh : null;
  if (fu?.obj) sys.destructibles.unregisterDestructible(fu.obj);
  if (corpse && sys.scene) { if (corpse.parent !== sys.scene) sys.scene.add(corpse); }
  else if (fu?.mesh?.parent) fu.mesh.parent.remove(fu.mesh);
}

export function findTacticalCoverSpot(sys, fu, playerPos, anchor = null, isFallback = false) {
  if (!sys || !fu?.mesh?.position || !playerPos) return null;
  const pos = fu.mesh.position;
  const carCols = sys._footVehicleColSet || (sys._footVehicleColSet = new Set());
  carCols.clear();
  if (Array.isArray(sys.pursuitVehicles)) for (const pv of sys.pursuitVehicles) if (pv?.col) carCols.add(pv.col);

  let bestSpot = null, bestScore = Infinity;
  const evalSpot = (sx, sz, bonus = 0) => {
    const dp = Math.hypot(sx - playerPos.x, sz - playerPos.z);
    if (dp < 13.0 || dp > 30.0 || sys.world?.isDeepWaterAt?.(sx, sz)) return;
    if (sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, sx, sz) || sys._isSegmentBlockedByBuilding?.(sx, sz, playerPos.x, playerPos.z)) return;
    const wCols = getNearbyCols(sys, sx, sz, 1.5, '_footWallScratch');
    if (Array.isArray(wCols)) {
      for (const wc of wCols) {
        if (wc && !wc.disabled && !carCols.has(wc) && (wc.maxY ?? 10) >= pos.y + 0.5 && (wc.minY ?? 0) <= pos.y + 1.5) {
          if (sx >= wc.minX - 0.5 && sx <= wc.maxX + 0.5 && sz >= wc.minZ - 0.5 && sz <= wc.maxZ + 0.5) return;
        }
      }
    }
    for (const o of sys.footUnits) if (o && o !== fu && !o.obj?.destroyed && o.coverSpot && Math.hypot(o.coverSpot.x - sx, o.coverSpot.z - sz) < 2.2) return;
    const ancPen = anchor ? Math.hypot(sx - anchor.x, sz - anchor.z) * 1.15 : 0;
    const score = Math.hypot(sx - pos.x, sz - pos.z) * (isFallback ? 0.45 : 0.8) + ancPen + Math.abs(dp - (isFallback ? 24.5 : 21.0)) * 0.75 - bonus;
    if (score < bestScore) { bestScore = score; bestSpot = { x: sx, z: sz }; }
  };
  const evalObstacle = (ox, oz, bonus) => {
    if (Math.hypot(ox - pos.x, oz - pos.z) > 28.0) return;
    const dx = ox - playerPos.x, dz = oz - playerPos.z, d = Math.hypot(dx, dz);
    if (d >= 1.0) evalSpot(ox + (dx / d) * 1.8, oz + (dz / d) * 1.8, bonus);
  };
  if (Array.isArray(sys.pursuitVehicles)) {
    for (const pv of sys.pursuitVehicles) if (pv && !pv.retreating && pv.carObj && !pv.carObj.destroyed && pv.carObj.mesh) evalObstacle(pv.carObj.mesh.position.x, pv.carObj.mesh.position.z, 3.5);
  }
  if (typeof sys.destructibles?.getObjectsNear === 'function') {
    for (const obj of sys.destructibles.getObjectsNear(pos.x, pos.z, 24, sys._footObjScratch || (sys._footObjScratch = []))) {
      if (!obj || obj.destroyed || obj.isCombatNpc || obj.isCivilianPedestrian || obj === fu.obj) continue;
      if (obj.type !== 'car' && ((obj.radius || 0) < 0.85 || (obj.height || 0) < 1.0)) continue;
      if (obj.colliders) for (const c of obj.colliders) if (c) carCols.add(c);
      evalObstacle(obj.mesh?.position?.x ?? obj.basePos?.x ?? 0, obj.mesh?.position?.z ?? obj.basePos?.z ?? 0, obj.type === 'car' ? 2.5 : 1.5);
    }
  }
  const cols = getNearbyCols(sys, pos.x, pos.z, 22, '_footColScratch');
  if (Array.isArray(cols)) {
    for (const c of cols) {
      if (!c || c.disabled || carCols.has(c) || (c.maxY ?? 0) < pos.y + 1.1 || (c.minY ?? 0) > pos.y + 1.2) continue;
      if (Math.hypot(Math.max(c.minX, Math.min(c.maxX, pos.x)) - pos.x, Math.max(c.minZ, Math.min(c.maxZ, pos.z)) - pos.z) > 22.0) continue;
      const cx = (c.minX + c.maxX) * 0.5, cz = (c.minZ + c.maxZ) * 0.5, hw = (c.maxX - c.minX) * 0.5, hd = (c.maxZ - c.minZ) * 0.5;
      const dx = cx - playerPos.x, dz = cz - playerPos.z, d = Math.hypot(dx, dz);
      if (d < 1.0) continue;
      const ux = dx / d, uz = dz / d;
      const t = Math.min(Math.abs(ux) > 1e-4 ? hw / Math.abs(ux) : 1e6, Math.abs(uz) > 1e-4 ? hd / Math.abs(uz) : 1e6);
      evalSpot(cx + ux * (t + 1.8), cz + uz * (t + 1.8), 2.0);
      if (hw > 2.5 || hd > 2.5) {
        const span = Math.abs(uz) * hw + Math.abs(ux) * hd + 1.1;
        evalSpot(cx + uz * span + ux * 1.8, cz - ux * span + uz * 1.8, 1.8);
        evalSpot(cx - uz * span + ux * 1.8, cz + ux * span + uz * 1.8, 1.8);
      }
    }
  }
  return bestSpot;
}

export function spawnFootTrooper(sys, spawnPos, tierStars = sys.stars, opts = null) {
  if (sys.footUnits.length >= getMaxFootUnitsForStars(sys, tierStars)) return null;
  const idx = sys.footUnits.length, bope = tierStars >= 5, riot = tierStars === 4;
  const faction = bope || riot ? 'bope' : 'pf', role = bope ? (idx % 2 === 0 ? 'special' : 'tank') : riot ? 'tank' : 'rifleman';
  const soldier = createFactionSoldierVisual(faction, role);
  const root = soldier.root || new THREE.Group();
  root.rotation.order = 'YXZ'; root.userData.skipStaticMerge = true;
  if (!soldier.root) { root.add(soldier.bodyRig); soldier.root = root; }
  const unitScale = bope ? 1.04 : 1.0;
  if (bope && soldier.bodyRig) soldier.bodyRig.scale.setScalar(unitScale);
  if (!soldier.torso) soldier.torso = soldier.bodyRig;
  if (!soldier.weapon) soldier.weapon = soldier.weaponMount;
  soldier.rightArm.rotation.x = AIM_POSE.rightArmX;
  soldier.leftArm.rotation.x = soldier.hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX;
  soldier.leftArm.rotation.z = soldier.hasShield ? 0.08 : AIM_POSE.leftArmZ;
  soldier.root.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
  sys.scene.add(soldier.root);
  const maxHp = bope ? 125 : riot ? 95 : 65, humanoidHealth = new HumanoidHealthModel({ kind: 'police', maxHp });
  const drops = bope ? { silver: 2, gold: 8, blue: 6, purple: 1 } : riot ? { silver: 3, gold: 5, blue: 2, purple: 0 } : { silver: 4, gold: 4, blue: 1, purple: 0 };
  const colors = bope || riot ? [0x15161a, 0x0b0c0f, 0xf59e0b, LEGO_COLORS.yellow] : [0x0f1d3a, 0x111827, 0xf59e0b, LEGO_COLORS.yellow];
  const obj = sys.destructibles.registerDestructible({ mesh: soldier.root, type: 'npc_fighter', hp: maxHp, radius: 0.95, height: 2.05, colliders: [], debrisColors: colors, studDrops: drops, groundY: spawnPos.y, isPoliceUnit: true, noAutoRespawn: true });
  Object.assign(obj, { maxHp, isCombatNpc: true, isPoliceUnit: true, isTankNpc: riot || bope, unitScale, visual: soldier, humanoidHealth });
  const unit = {
    mesh: soldier.root, visual: soldier, obj, destructible: obj, humanoidHealth, unitScale, faction, role, className: soldier.className,
    isEliteBope: bope, isRiotElite: riot, tacticalRole: opts?.tacticalRole || (tierStars <= 1 ? 'arresting' : idx % 2 === 0 ? 'suppressor' : 'flanker'),
    flankSign: Math.floor(idx / 2) % 2 === 0 ? 1 : -1, flankAngleRad: ((58 + Math.random() * 17) * Math.PI) / 180, flankRadius: 17.0 + Math.random() * 7.0,
    coverSpot: null, repositionTimer: 0, isAtCover: false, isDuckingInCover: false, burstShotsLeft: 0, burstShotTimer: 0, muzzleTimer: 0,
    walkPhase: Math.random() * Math.PI * 2, phaseOffset: Math.random() * Math.PI * 2, searchPatrolAngle: Math.random() * Math.PI * 2,
    moveSpeed: bope ? 10.6 : riot ? 9.5 : 8.5, shootCooldown: 0.45 + Math.random() * 0.45
  };
  obj.npcRef = unit;
  sys.footUnits.push(unit);
  return unit;
}

export function clearAllFootUnits(sys) {
  for (const fu of sys.footUnits) removeFootEntry(sys, fu);
  sys.footUnits.length = 0; sys._arrestProgress = 0; sys._shownArrestWarning = false;
  if (sys.stars <= 0) sys._playerHostileActionInPursuit = false;
}

function clampOfficerCapsule(sys, fu, candX, candZ, curY) {
  if (typeof sys.world?.resolveCapsulePenetration !== 'function') return null;
  const ownCol = fu.obj?.colliders?.[0];
  _capPos.x = candX; _capPos.y = curY; _capPos.z = candZ;
  return sys.world.resolveCapsulePenetration(_capPos, 0.48, 2.0, {
    stepUpHeight: 0.36, filter: (col) => col !== ownCol, out: _capOut
  });
}

function tryStep(sys, fu, tx, tz, speed, dt) {
  const pos = fu.mesh.position;
  const dx = tx - pos.x, dz = tz - pos.z, dist = Math.hypot(dx, dz);
  if (dist < 0.08) return false;
  const step = Math.min(dist, speed * dt);
  let dirX = dx / dist, dirZ = dz / dist;
  if (fu._avoidX || fu._avoidZ) {
    dirX += fu._avoidX * 0.55; dirZ += fu._avoidZ * 0.55;
    const dLen = Math.hypot(dirX, dirZ);
    if (dLen > 1e-5) { dirX /= dLen; dirZ /= dLen; }
  }

  if (typeof sys.world?.resolveCapsulePenetration === 'function') {
    const rawX = pos.x + dirX * step, rawZ = pos.z + dirZ * step;
    if (!sys.world?.isDeepWaterAt?.(rawX, rawZ)) {
      const cap = clampOfficerCapsule(sys, fu, rawX, rawZ, pos.y);
      let fx = cap.x, fz = cap.z;
      if (cap.collided && Math.hypot(fx - pos.x, fz - pos.z) < step * 0.3) {
        projectSlideVelocity2D(dirX, dirZ, cap.hitNormalX, cap.hitNormalZ, 0, _slideOut);
        let sx = _slideOut.vx, sz = _slideOut.vz, sLen = Math.hypot(sx, sz);
        if (sLen < 0.2) {
          const sign = fu.flankSign || 1;
          sx = -cap.hitNormalZ * sign; sz = cap.hitNormalX * sign; sLen = Math.hypot(sx, sz);
        }
        if (sLen > 1e-4) {
          const scx = cap.x + (sx / sLen) * step * 0.88, scz = cap.z + (sz / sLen) * step * 0.88;
          if (!sys.world?.isDeepWaterAt?.(scx, scz)) {
            const capSlide = clampOfficerCapsule(sys, fu, scx, scz, pos.y);
            fx = capSlide.x; fz = capSlide.z;
          }
        }
      }
      if (!sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, fx, fz)) {
        const moved = Math.hypot(fx - pos.x, fz - pos.z) > 1e-4;
        pos.set(fx, resolveFootGroundY(sys, fx, fz, pos.y), fz);
        if (fu.obj?.basePos) fu.obj.basePos.copy(pos);
        if (fu.obj) fu.obj.groundY = pos.y;
        return moved;
      }
    }
  }

  const ang = Math.atan2(dirX, dirZ);
  for (const off of [0, 0.85, -0.85]) {
    const nx = pos.x + Math.sin(ang + off) * step, nz = pos.z + Math.cos(ang + off) * step;
    if (!sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, nx, nz) && !sys.world?.isDeepWaterAt?.(nx, nz)) {
      pos.set(nx, resolveFootGroundY(sys, nx, nz, pos.y), nz);
      if (fu.obj?.basePos) fu.obj.basePos.copy(pos);
      if (fu.obj) fu.obj.groundY = pos.y;
      return true;
    }
  }
  return false;
}

function separateFootOfficers(sys, active, playerPos, ctrl) {
  const sepSys = sys._footSeparationSys || (sys._footSeparationSys = new AgentSeparationSystem({ cellSize: 4.0, maxActiveDist: 155, passes: 4 }));
  const agents = sys._footSepAgents || (sys._footSepAgents = []);
  const pool = sys._footSepPool || (sys._footSepPool = []);
  agents.length = 0;
  let pIdx = 0;
  const alloc = () => pool[pIdx++] || (pool[pIdx - 1] = {});

  for (let i = 0; i < active.length; i++) {
    const fu = active[i], pos = fu.mesh.position, e = alloc();
    e.fu = fu; e.x = pos.x; e.y = pos.y; e.z = pos.z;
    e.radius = 0.72; e.weight = 1.0; e.immovable = false;
    agents.push(e);
  }
  if (playerPos && !ctrl?.currentVehicle && !ctrl?.isFlying) {
    const pe = alloc();
    pe.fu = null; pe.x = playerPos.x; pe.y = playerPos.y ?? 0; pe.z = playerPos.z;
    pe.radius = 0.58; pe.weight = 8.0; pe.immovable = true;
    agents.push(pe);
  }
  if (agents.length < 2) return;

  const f = agents[0]?.fu ? agents[0] : null;
  const sepCenter = (sys.isEscaping && f && playerPos && Math.hypot(f.x - playerPos.x, f.z - playerPos.z) > 145 && sys._lastKnownPlayerPos)
    ? sys._lastKnownPlayerPos : playerPos;

  for (let iter = 0; iter < 2; iter++) {
    sepSys.separateAgents(agents, sepCenter);
    let wallClamped = false;
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i], fu = a.fu;
      if (!fu) continue;
      if (iter === 0) { fu._avoidX = a.avoidX; fu._avoidZ = a.avoidZ; }
      const pos = fu.mesh.position;
      let cx = pos.x + a.sepPushX, cz = pos.z + a.sepPushZ;
      if (sys.world?.isDeepWaterAt?.(cx, cz)) { a.x = pos.x; a.z = pos.z; continue; }
      const cap = clampOfficerCapsule(sys, fu, cx, cz, pos.y);
      if (cap) {
        if (cap.collided) wallClamped = true;
        cx = cap.x; cz = cap.z;
      } else if (sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, cx, cz)) {
        cx = pos.x; cz = pos.z;
      }
      pos.set(cx, resolveFootGroundY(sys, cx, cz, pos.y), cz);
      if (fu.obj?.basePos) fu.obj.basePos.copy(pos);
      if (fu.obj) fu.obj.groundY = pos.y;
      a.x = cx; a.y = pos.y; a.z = cz;
    }
    if (!wallClamped) break;
  }
}

function tickBurstFire(sys, fu, pos, vis, playerPos, dist, playerSpeed, dt) {
  if (fu._cachedSeesPlayer === false || dist > 58.0 || sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, playerPos.x, playerPos.z)) {
    fu.burstShotsLeft = 0; fu.burstShotTimer = 0;
    if (fu.shootCooldown > 0) fu.shootCooldown = Math.max(0, fu.shootCooldown - dt);
    return;
  }
  if ((fu.burstShotsLeft || 0) <= 0 && (fu.shootCooldown = (fu.shootCooldown ?? 0.6) - dt) <= 0) { fu.burstShotsLeft = 3; fu.burstShotTimer = 0; }
  if (fu.burstShotsLeft > 0 && (fu.burstShotTimer = (fu.burstShotTimer || 0) - dt) <= 0) {
    const spread = 0.42 + dist * 0.03 + playerSpeed * 0.11;
    fu.lastAimSpread = spread;
    if (vis?.muzzleFlash) { vis.muzzleFlash.visible = true; fu.muzzleTimer = 0.07; }
    const muzzle = new THREE.Vector3(pos.x, pos.y + (fu.isEliteBope ? 1.44 : 1.38), pos.z);
    const aim = new THREE.Vector3(playerPos.x + (Math.random() - 0.5) * 2.0 * spread, playerPos.y + 1.0 + (Math.random() - 0.5) * spread * 0.45, playerPos.z + (Math.random() - 0.5) * 2.0 * spread);
    sys._spawnPursuitProjectile(muzzle, aim, 'bullet');
    fu.burstShotTimer = --fu.burstShotsLeft > 0 ? 0.15 : 0;
    if (fu.burstShotsLeft <= 0) fu.shootCooldown = (fu.isEliteBope ? 1.25 : fu.isRiotElite ? 1.32 : 1.4) + Math.random() * 0.25;
  }
}
function applyPose(vis, fu, moved, scanHead, clock, dt) {
  if (!vis) return;
  if (vis.bodyRig) vis.bodyRig.position.y = fu.isDuckingInCover ? -0.18 : 0;
  const lx = vis.hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX;
  vis.leftArm.rotation.z = vis.hasShield ? 0.08 : AIM_POSE.leftArmZ;
  if (moved) {
    const sw = Math.sin((fu.walkPhase = (fu.walkPhase || 0) + dt * 9.0));
    vis.leftLeg.rotation.x = sw * 0.62; vis.rightLeg.rotation.x = -sw * 0.62;
    vis.rightArm.rotation.x = AIM_POSE.rightArmX + sw * 0.16; vis.leftArm.rotation.x = lx - sw * 0.22;
  } else if (fu.isDuckingInCover) {
    vis.leftLeg.rotation.x = 0.28; vis.rightLeg.rotation.x = -0.22;
    vis.rightArm.rotation.x = AIM_POSE.rightArmX + 0.18; vis.leftArm.rotation.x = vis.hasShield ? lx : lx + 0.12;
  } else {
    const damp = Math.max(0, 1 - dt * 10.0);
    vis.leftLeg.rotation.x *= damp; vis.rightLeg.rotation.x *= damp;
    vis.rightArm.rotation.x = AIM_POSE.rightArmX; vis.leftArm.rotation.x = lx;
  }
  animateFactionSoldier(vis, clock, fu.phaseOffset || 0);
  if (scanHead && vis.head) vis.head.rotation.y = Math.sin(clock * 2.2 + (fu.phaseOffset || 0)) * 0.55;
}

export function updateFootUnits(sys, dt, playerPos, controller) {
  if (!playerPos) return;
  const ctrl = controller !== undefined ? controller : sys.hud?._lastController || null;
  const clock = (sys._footAnimClock = (sys._footAnimClock || 0) + dt);

  sys._playerHostileActionInPursuit = Boolean(sys._playerHostileActionInPursuit);
  if (sys.stars === 1) {
    const fired = (ctrl?.operatorWeapons?.fireCooldown || 0) > 0;
    if (sys._playerHostileActionInPursuit || fired || Math.abs(ctrl?.vehicleSpeed || 0) > 9.5) {
      sys._playerHostileActionInPursuit = true;
      sys._arrestProgress = 0; sys._shownArrestWarning = false;
      sys.setWantedStars?.(2);
    }
  }

  const hasCam = Boolean(ctrl && typeof ctrl.yaw === 'number');
  const camX = hasCam ? -Math.sin(ctrl.yaw) : sys._playerVelDir?.x || 0;
  const camZ = hasCam ? -Math.cos(ctrl.yaw) : sys._playerVelDir?.z || -1;
  const active = sys._activeFootScratch || (sys._activeFootScratch = []);
  active.length = 0;

  for (let i = sys.footUnits.length - 1; i >= 0; i--) {
    const fu = sys.footUnits[i];
    if (!fu?.obj || fu.obj.destroyed) { removeFootEntry(sys, fu); sys.footUnits.splice(i, 1); continue; }
    const pos = fu.mesh.position;
    const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
    if (dist > 185.0) {
      const blocked = sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, playerPos.x, playerPos.z);
      const dotCam = ((pos.x - playerPos.x) * camX + (pos.z - playerPos.z) * camZ) / dist;
      if (!hasCam || dotCam < 0.25 || blocked || sys.isEscaping || dist > 240.0) {
        removeFootEntry(sys, fu); sys.footUnits.splice(i, 1); continue;
      }
    }

    const vis = fu.visual;
    if (fu.muzzleTimer > 0 && (fu.muzzleTimer -= dt) <= 0 && vis?.muzzleFlash) vis.muzzleFlash.visible = false;
    if (fu.humanoidHealth) {
      fu.humanoidHealth.update(dt);
      const st = fu.humanoidHealth.state;
      if (st === HUMANOID_STATES.STAGGER || st === HUMANOID_STATES.DOWNED) {
        if (vis?.muzzleFlash) vis.muzzleFlash.visible = false;
        if (vis?.bodyRig) vis.bodyRig.position.y = 0;
        applyHumanoidKnockbackStep(fu.mesh, fu.humanoidHealth, dt, (nx, nz, cx, cz) => {
          const cap = clampOfficerCapsule(sys, fu, nx, nz, pos.y);
          if (cap) return { x: cap.x, z: cap.z, valid: true };
          return sys._isSegmentBlockedByBuilding?.(cx, cz, nx, nz) ? { blocked: true } : { x: nx, z: nz, valid: true };
        });
        const gY = resolveFootGroundY(sys, pos.x, pos.z, pos.y);
        applyHumanoidHitPose(vis, fu.humanoidHealth, gY, dt, { unitScale: fu.unitScale || 1 });
        fu.obj.basePos.set(pos.x, gY, pos.z); fu.obj.groundY = gY;
        continue;
      }
    }
    active.push(fu);
  }
  active.reverse();

  const arrestMode = sys.stars === 1 && !ctrl?.currentVehicle && !ctrl?.isFlying && !sys._playerHostileActionInPursuit && !sys.isEscaping;
  let nearestArrest = null, nearestDist = Infinity;
  if (arrestMode) {
    for (const u of active) {
      const d = Math.hypot(playerPos.x - u.mesh.position.x, playerPos.z - u.mesh.position.z);
      if (d < nearestDist) { nearestDist = d; nearestArrest = u; }
    }
  }

  const supPos = active[0]?.mesh?.position;
  const frontAng = supPos ? Math.atan2(supPos.x - playerPos.x, supPos.z - playerPos.z) : 0;
  const playerSpeed = ctrl?.getHorizontalSpeed?.() ?? (ctrl?.currentVehicle ? Math.abs(ctrl.vehicleSpeed || 0) : ctrl?.velocity ? Math.hypot(ctrl.velocity.x || 0, ctrl.velocity.z || 0) : 0);

  for (let idx = 0; idx < active.length; idx++) {
    const fu = active[idx], pos = fu.mesh.position, vis = fu.visual, spd = fu.moveSpeed || 8.5;
    const dist = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
    fu.mesh.rotation.x = 0; fu.mesh.rotation.z = 0;
    if (vis) { vis.leftLeg.rotation.z = 0; vis.rightLeg.rotation.z = 0; }
    if (fu.investigatePos && (fu.investigatePos.timer -= dt) <= 0) fu.investigatePos = null;

    let moved = false, scanHead = false;
    fu.isAtCover = false; fu.isDuckingInCover = false;
    const clearLos = !sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, playerPos.x, playerPos.z);
    const seesNow = fu._cachedSeesPlayer === true || (!sys.isEscaping && dist <= 45.0 && clearLos && fu._cachedSeesPlayer !== false);

    if (sys.isEscaping || (fu.investigatePos && !seesNow)) {
      fu.burstShotsLeft = 0;
      const lkx = sys._lastKnownPlayerPos?.x ?? playerPos.x, lkz = sys._lastKnownPlayerPos?.z ?? playerPos.z;
      const slot = computeDistinctArrivalSlot(lkx, lkz, idx, active.length, 7.5, 4.5);
      const pAng = slot.angle + clock * 0.28;
      const tx = fu.investigatePos ? fu.investigatePos.x : lkx + Math.cos(pAng) * slot.radius;
      const tz = fu.investigatePos ? fu.investigatePos.z : lkz + Math.sin(pAng) * slot.radius;
      const dTarget = Math.hypot(tx - pos.x, tz - pos.z);
      fu.mesh.rotation.y = (dTarget > 0.5 ? Math.atan2(tx - pos.x, tz - pos.z) : fu.mesh.rotation.y) + Math.sin(clock * 2.2 + (fu.phaseOffset || 0)) * 0.55;
      if (typeof fu.heading === 'number') fu.heading = fu.mesh.rotation.y;
      scanHead = true;
      if (dTarget > 1.4) moved = tryStep(sys, fu, tx, tz, spd * 0.72, dt);
    } else if (sys.stars === 1) {
      const ang = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
      fu.mesh.rotation.y = ang;
      fu.tacticalRole = !arrestMode || fu === nearestArrest ? 'arresting' : 'arrest_backup';
      if (fu.tacticalRole === 'arresting' || active.length <= 1) {
        const targetD = dist > 4.4 ? 3.6 : dist < 2.8 ? 3.15 : -1;
        if (targetD > 0) moved = tryStep(sys, fu, playerPos.x - Math.sin(ang) * targetD, playerPos.z - Math.cos(ang) * targetD, dist < 2.8 ? spd * 0.65 : spd, dt);
      } else {
        const slot = computeDistinctArrivalSlot(playerPos.x, playerPos.z, idx, active.length, 5.2, 2.8);
        if (Math.hypot(slot.x - pos.x, slot.z - pos.z) > 1.1) moved = tryStep(sys, fu, slot.x, slot.z, spd, dt);
      }
    } else {
      fu.tacticalRole = idx >= 1 && idx % 2 === 1 ? 'flanker' : 'suppressor';
      fu.mesh.rotation.y = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
      let flankWp = null;
      if (fu.tacticalRole === 'flanker') {
        const fAng = frontAng + (fu.flankSign || 1) * (fu.flankAngleRad || 1.12), fRad = fu.flankRadius || 20.5;
        flankWp = { x: playerPos.x + Math.sin(fAng) * fRad, z: playerPos.z + Math.cos(fAng) * fRad };
        fu.flankWaypoint = flankWp;
      }
      fu.repositionTimer = (fu.repositionTimer || 0) - dt;
      const cd = fu.coverSpot ? Math.hypot(fu.coverSpot.x - playerPos.x, fu.coverSpot.z - playerPos.z) : 0;
      if (!fu.coverSpot || fu.repositionTimer <= 0 || dist < 10.0 || cd < 13.0 || cd > 30.0 || sys._isSegmentBlockedByBuilding?.(fu.coverSpot.x, fu.coverSpot.z, playerPos.x, playerPos.z)) {
        fu.coverSpot = findTacticalCoverSpot(sys, fu, playerPos, flankWp, dist < 10.0);
        fu.repositionTimer = 4.5 + Math.random() * 2.3;
      }
      if (fu.coverSpot) {
        if (Math.hypot(fu.coverSpot.x - pos.x, fu.coverSpot.z - pos.z) >= 1.4) moved = tryStep(sys, fu, fu.coverSpot.x, fu.coverSpot.z, spd, dt);
        fu.isAtCover = Math.hypot(fu.coverSpot.x - pos.x, fu.coverSpot.z - pos.z) < 1.4;
      } else if (fu.tacticalRole === 'flanker' && flankWp && Math.hypot(flankWp.x - pos.x, flankWp.z - pos.z) > 1.5) {
        moved = tryStep(sys, fu, flankWp.x, flankWp.z, spd, dt);
      } else if (fu.tacticalRole === 'suppressor') {
        const slot = computeDistinctArrivalSlot(playerPos.x, playerPos.z, idx, active.length, 19.5, 3.8);
        if (dist < 16.0 || dist > 26.0) moved = tryStep(sys, fu, slot.x, slot.z, spd, dt);
      }
      tickBurstFire(sys, fu, pos, vis, playerPos, dist, playerSpeed, dt);
      if (fu.isAtCover && !moved) fu.isDuckingInCover = !(fu.burstShotsLeft > 0 || (fu.shootCooldown ?? 1) <= 0.22);
    }
    fu._movedThisFrame = moved;
    fu._scanHeadThisFrame = scanHead;
  }

  separateFootOfficers(sys, active, playerPos, ctrl);

  let anyHoldArrest = false;
  for (let idx = 0; idx < active.length; idx++) {
    const fu = active[idx], pos = fu.mesh.position;
    applyPose(fu.visual, fu, fu._movedThisFrame, fu._scanHeadThisFrame, clock, dt);
    if (arrestMode && fu.tacticalRole === 'arresting' && Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z) <= 4.8 && !sys._isSegmentBlockedByBuilding?.(pos.x, pos.z, playerPos.x, playerPos.z)) {
      anyHoldArrest = true;
    }
  }

  if (arrestMode && anyHoldArrest && playerSpeed < 9.0) {
    sys._arrestProgress = (sys._arrestProgress || 0) + dt / 2.0;
    if (sys._arrestProgress > 0.15 && !sys._shownArrestWarning) {
      sys._shownArrestWarning = true;
      sys.hud?.showWantedBanner?.('PARADO! MÃO NA CABEÇA!', '1★ ABORDAGEM POLICIAL • CORRA OU REVIDE!', 'pursuit');
    }
    if (sys._arrestProgress >= 1.0) {
      sys._arrestProgress = 0; sys._shownArrestWarning = false;
      sys.triggerPlayerBusted?.(ctrl);
    }
  } else if ((sys._arrestProgress || 0) > 0) {
    sys._arrestProgress = Math.max(0, sys._arrestProgress - dt * 0.8);
  }
}

export const _findTacticalCoverSpot = findTacticalCoverSpot;
