import * as THREE from 'three';
import { LEGO_COLORS } from '../../materials/LegoMaterials.js';
import { optimizeStaticGroupMeshes } from '../BuildingGenerator.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { createFactionSoldierVisual, AIM_POSE } from '../../entities/FactionSoldierBuilder.js';
import { FACTION_THEME } from './TerritoryZonesAndConfigs.js';
import { IS_SCALED_WORLD } from '../core/WorldLayoutScale.js';
import { HumanoidHealthModel } from '../npc-health/HumanoidHealthModel.js';
import { attachVehicleOccupants, disembarkOccupants } from '../vehicles/VehicleOccupants.js';

// ============================================================================
// POOL RECICLÁVEL DE SOLDADOS ARTICULADOS, CACHE DE COMBOIOS & BALÍSTICA 3D
// (Zero picos de alocação no frame 0 de invasão — < 1.5 ms cravados!)
// ============================================================================

export const ALLY_MARKER_MAT = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
export const ALLY_BULLET_MAT = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
export const ROCKET_MAT = new THREE.MeshBasicMaterial({ color: 0x84cc16 });

const BULLET_MATS = new Map();
export function getFactionBulletMat(faction, hex) {
  if (!BULLET_MATS.has(faction)) {
    BULLET_MATS.set(faction, new THREE.MeshBasicMaterial({ color: hex }));
  }
  return BULLET_MATS.get(faction);
}

let SHARED_WAR_GEOS = null;
const CONVOY_CAR_TEMPLATES = new Map();

export function ensureSharedWarGeometries() {
  if (SHARED_WAR_GEOS) return SHARED_WAR_GEOS;
  const allyDiamond = new THREE.OctahedronGeometry(0.17, 0);
  allyDiamond.scale(0.85, 1.25, 0.85);
  const shockwaveGeo = new THREE.RingGeometry(0.8, 1.25, 24);
  shockwaveGeo.rotateX(-Math.PI / 2);

  SHARED_WAR_GEOS = {
    allyDiamond,
    bulletGeo: new THREE.BoxGeometry(0.16, 0.16, 0.72),
    rocketGeo: new THREE.CylinderGeometry(0.0, 0.16, 0.9, 8).rotateX(Math.PI / 2),
    blastGeo: new THREE.SphereGeometry(1, 14, 10),
    shockwaveGeo
  };
  return SHARED_WAR_GEOS;
}

function getOrBuildConvoyCarTemplate(vType, colorHex, roofHex) {
  const key = `${vType}|${colorHex}|${roofHex}`;
  let tpl = CONVOY_CAR_TEMPLATES.get(key);
  if (!tpl) {
    tpl = createLegoCarMesh({ x: 0, z: 0, rotY: 0, color: colorHex, roofColor: roofHex, type: vType });
    tpl.position.set(0, 0, 0);
    tpl.rotation.set(0, 0, 0);
    optimizeStaticGroupMeshes(tpl, []);
    tpl.userData.isOptimizedGroup = true;
    CONVOY_CAR_TEMPLATES.set(key, tpl);
  }
  return tpl;
}

function resetSoldierVisualState(vis, unitScale, isBoss, isAllied) {
  const { root, bodyRig, leftLeg, rightLeg, leftArm, rightArm, head, muzzleFlash, allyMarker, drone, hasShield } = vis;
  root.rotation.order = 'YXZ';
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  root.visible = true;
  root.matrixAutoUpdate = true;
  root.matrixWorldAutoUpdate = true;
  if (bodyRig) { bodyRig.position.set(0, 0, 0); bodyRig.rotation.set(0, 0, 0); bodyRig.scale.setScalar(unitScale); }
  leftLeg.position.set(-0.2, 0.68, 0); leftLeg.rotation.set(0, 0, 0);
  rightLeg.position.set(0.2, 0.68, 0); rightLeg.rotation.set(0, 0, 0);
  rightArm.position.set(0.56, 1.44, 0); rightArm.rotation.set(AIM_POSE.rightArmX, 0, -0.08);
  leftArm.position.set(-0.56, 1.44, 0);
  leftArm.rotation.set(hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX, 0, hasShield ? 0.08 : AIM_POSE.leftArmZ);
  if (head) { head.position.set(0, 1.62, 0); head.rotation.set(0, 0, 0); }
  if (muzzleFlash) muzzleFlash.visible = false;
  if (drone) { drone.visible = true; drone.position.set(0.7, 2.7, -0.3); drone.rotation.set(0, 0, 0); }
  allyMarker.position.set(0, isBoss ? 6.1 : 2.78, 0);
  allyMarker.rotation.set(0, 0, 0);
  allyMarker.visible = Boolean(isAllied);
}

function buildFreshSoldierVisual(faction, visualRole) {
  const geos = ensureSharedWarGeometries();
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  root.userData.skipStaticMerge = true;
  const bodyRig = new THREE.Group();
  root.add(bodyRig);
  const soldier = createFactionSoldierVisual(faction, visualRole);
  bodyRig.add(soldier.bodyRig);
  const allyMarker = new THREE.Mesh(geos.allyDiamond, ALLY_MARKER_MAT);
  root.add(allyMarker);
  return {
    root, bodyRig, leftLeg: soldier.leftLeg, rightLeg: soldier.rightLeg,
    leftArm: soldier.leftArm, rightArm: soldier.rightArm, muzzleFlash: soldier.muzzleFlash,
    allyMarker, head: soldier.head, drone: soldier.drone, hasShield: soldier.hasShield,
    weaponKind: soldier.weaponKind, className: soldier.className,
    _poolKey: `${faction}|${visualRole}`, _inPool: false
  };
}

export const combatUnitsAndConvoysMethods = {
  _hasClearLineOfSight(x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1, dist = Math.hypot(dx, dz);
    if (dist < 2.2) return true;
    const steps = Math.min(12, Math.max(4, Math.ceil(dist / 6.0)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.livingCity._isInsideBuilding(x1 + dx * t, z1 + dz * t, 0.3)) return false;
    }
    return true;
  },

  _groundAt(x, z, refY = 0) {
    if (typeof this.world.getSurfaceHeightAt === 'function') return this.world.getSurfaceHeightAt(x, z, refY);
    return typeof this.world.getTerrainHeightAt === 'function' ? this.world.getTerrainHeightAt(x, z) : 0;
  },

  _findSafeZonePos(x, z, radius = 1.4, refY = null) {
    const safe = this.livingCity._findSafeStreetSpawn(x, z, radius);
    if (IS_SCALED_WORLD && !safe.valid && typeof this.world?.resolveCapsulePenetration === 'function') {
      const approxY = this._groundAt(x, z, refY === null ? 2 : refY + 0.6);
      const cap = this.world.resolveCapsulePenetration({ x, y: approxY, z }, radius, 2.0, { stepUpHeight: 0.4 });
      return { x: cap.x, y: this._groundAt(cap.x, cap.z, refY === null ? approxY + 1 : refY + 0.6), z: cap.z };
    }
    return { x: safe.x, y: this._groundAt(safe.x, safe.z, refY === null ? 2 : refY + 0.6), z: safe.z };
  },

  _ensureWarPools() {
    if (!this._soldierVisualPool) this._soldierVisualPool = new Map();
    if (!this._convoyCarPool) this._convoyCarPool = new Map();
  },

  _prewarmWarPoolsOnce() {
    if (this._warPoolsPrewarmed) return;
    this._warPoolsPrewarmed = true;
    this._ensureWarPools();
    const warmCounts = [['rifleman', 5], ['tank', 2], ['medic', 2], ['special', 1]];
    for (const fKey of ['cv', 'pcc', 'ares']) {
      for (const [role, qty] of warmCounts) {
        const pKey = `${fKey}|${role}`;
        let bucket = this._soldierVisualPool.get(pKey);
        if (!bucket) { bucket = []; this._soldierVisualPool.set(pKey, bucket); }
        while (bucket.length < qty) {
          const vis = buildFreshSoldierVisual(fKey, role);
          vis._inPool = true;
          bucket.push(vis);
        }
      }
      const theme = FACTION_THEME[fKey];
      if (theme?.convoyVehicles) {
        for (const vType of theme.convoyVehicles) {
          const tpl = getOrBuildConvoyCarTemplate(vType, theme.hex, theme.secondaryHex);
          const cKey = `${vType}|${theme.hex}|${theme.secondaryHex}`;
          let cBucket = this._convoyCarPool.get(cKey);
          if (!cBucket) { cBucket = []; this._convoyCarPool.set(cKey, cBucket); }
          while (cBucket.length < 2) {
            const m = tpl.clone(true);
            m.userData = { ...tpl.userData, isOptimizedGroup: true, _convoyPoolKey: cKey, _inConvoyPool: true };
            cBucket.push(m);
          }
        }
      }
    }
  },

  _acquireSoldierVisual(faction, visualRole, unitScale, isBoss, isAllied) {
    this._ensureWarPools();
    const bucket = this._soldierVisualPool.get(`${faction}|${visualRole}`);
    const vis = bucket && bucket.length > 0 ? bucket.pop() : buildFreshSoldierVisual(faction, visualRole);
    vis._inPool = false;
    resetSoldierVisualState(vis, unitScale, isBoss, isAllied);
    return vis;
  },

  _releaseSoldierVisual(vis) {
    if (!vis || vis._inPool || !vis._poolKey) return;
    this._ensureWarPools();
    if (vis.root?.parent) vis.root.parent.remove(vis.root);
    if (vis.muzzleFlash) vis.muzzleFlash.visible = false;
    if (vis.allyMarker) vis.allyMarker.visible = false;
    let bucket = this._soldierVisualPool.get(vis._poolKey);
    if (!bucket) { bucket = []; this._soldierVisualPool.set(vis._poolKey, bucket); }
    if (bucket.length < 18) { vis._inPool = true; bucket.push(vis); }
  },

  _acquireConvoyCarMesh(vType, colorHex, roofHex) {
    this._ensureWarPools();
    const key = `${vType}|${colorHex}|${roofHex}`;
    const bucket = this._convoyCarPool.get(key);
    let mesh = bucket && bucket.length > 0 ? bucket.pop() : null;
    if (!mesh) {
      const tpl = getOrBuildConvoyCarTemplate(vType, colorHex, roofHex);
      mesh = tpl.clone(true);
      mesh.userData = { ...tpl.userData, isOptimizedGroup: true };
    }
    mesh.scale.set(1, 1, 1);
    mesh.rotation.set(0, 0, 0);
    mesh.visible = true;
    mesh.matrixAutoUpdate = true;
    mesh.matrixWorldAutoUpdate = true;
    mesh.userData._convoyPoolKey = key;
    mesh.userData._inConvoyPool = false;
    return mesh;
  },

  _releaseConvoyCarMesh(mesh) {
    const key = mesh?.userData?._convoyPoolKey;
    if (!mesh || !key || mesh.userData._inConvoyPool) return;
    this._ensureWarPools();
    if (mesh.parent) mesh.parent.remove(mesh);
    let bucket = this._convoyCarPool.get(key);
    if (!bucket) { bucket = []; this._convoyCarPool.set(key, bucket); }
    if (bucket.length < 8) { mesh.userData._inConvoyPool = true; bucket.push(mesh); }
  },

  _spawnCombatUnit({ faction, role = 'rifleman', x, z, y = null, outpostId = null, patrolAnchor = null, forceAllied = null }) {
    const theme = this.getFactionTheme(faction);
    const isAllied = forceAllied ?? faction === this.playerFaction;
    const heavyClass = role === 'brute' || role === 'elite' ? role : null;
    const visualRole = role === 'brute' ? 'tank' : role === 'elite' ? 'boss' : role;
    const isBoss = role === 'boss', isTank = role === 'tank', isMedic = role === 'medic';

    const safePos = this._findSafeZonePos(x, z, isBoss || heavyClass ? 2.2 : 1.15, y);
    const unitScale = role === 'brute' ? 2.0 : role === 'elite' ? 1.5 : isBoss ? 2.32 : isTank ? 1.14 : 1.0;

    const visual = this._acquireSoldierVisual(faction, visualRole, unitScale, isBoss, isAllied);
    const root = visual.root;
    root.position.set(safePos.x, safePos.y, safePos.z);
    this.scene.add(root);

    const big = isBoss || heavyClass;
    const hp =
      role === 'brute' ? 1100 : role === 'elite' ? 1400 : isBoss ? 1550 :
      faction === 'guard' ? (isTank ? 170 : 95) : isTank ? 280 : isMedic ? 175 : 160;
    const destructible = this.destructibles.registerDestructible({
      mesh: root,
      type: big ? 'npc_boss' : 'npc_fighter',
      hp,
      radius: big ? 1.05 * unitScale + 0.2 : 1.05,
      height: 2.25 * unitScale,
      colliders: [],
      debrisColors: [theme.hex, theme.secondaryHex, theme.accentHex, LEGO_COLORS.yellow],
      studDrops: big ? { silver: 0, gold: 18, blue: 10, purple: 4 } : { silver: 2, gold: 4, blue: isTank ? 2 : 1, purple: 0 },
      groundY: safePos.y
    });

    const humanoidHealth = new HumanoidHealthModel({ kind: isBoss || heavyClass ? 'boss' : 'soldier', maxHp: hp });
    Object.assign(destructible, {
      maxHp: hp, isCombatNpc: true, isTankNpc: isTank, isBossNpc: isBoss || Boolean(heavyClass),
      isAlliedToPlayer: isAllied, noAutoRespawn: true, unitScale, humanoidHealth
    });

    const npc = {
      faction, role, isAllied, isMecha: isBoss, isBoss, unitScale, humanoidHealth, outpostId,
      patrolAnchor: patrolAnchor || { x: safePos.x, z: safePos.z },
      patrolAngle: Math.random() * Math.PI * 2, saluting: false,
      fireCooldown: 0.55 + Math.random() * 0.75, slamCooldown: 4.5, muzzleTimer: 0,
      walkPhase: Math.random() * 6.28,
      speed: role === 'brute' ? 4.0 : isBoss ? 5.2 : isTank ? 4.4 : isMedic ? 5.8 : 5.3,
      heavyClass, hitR: 1.05 * unitScale, hitH: 2.3 * unitScale,
      destructible, visual, className: visual.className
    };
    destructible.visual = visual;
    destructible.npcRef = npc;
    destructible.onUnregistered = (dItem) => {
      if (!dItem._managedByCorpseManager) this._releaseSoldierVisual(visual);
    };
    destructible.onShattered = () => {
      if (npc.isBankRobber) this.bankHeist.onRobberDefeated(npc);
      if (isBoss && !isAllied && this.activeZoneId) {
        const zState = this.territories[this.activeZoneId];
        if (zState && zState.enemyBoss === npc) zState.enemyBossDefeated = true;
      }
    };

    this.combatNpcs.push(npc);
    return npc;
  },

  _spawnMotorizedSquad({ faction, isAllied, zoneState, playerPos, roles = null, target = null }) {
    const theme = FACTION_THEME[faction] || FACTION_THEME.cv;
    const routes = isAllied ? zoneState.spec.alliedEntryRoutes : zoneState.spec.defenderMotorRoutes;
    if (!routes || routes.length === 0) return null;

    const focus = target || playerPos;
    let bestRoute = routes[0], bestDist = Infinity;
    for (const r of routes) {
      const d = Math.hypot(r.targetX - focus.x, r.targetZ - focus.z);
      if (d < bestDist) { bestDist = d; bestRoute = r; }
    }

    const startSafe = bestRoute._cachedStartSafe || (bestRoute._cachedStartSafe = this._findSafeZonePos(bestRoute.startX, bestRoute.startZ, 2.4));
    const fDist = Math.hypot(focus.x - bestRoute.targetX, focus.z - bestRoute.targetZ);
    const pull = IS_SCALED_WORLD ? (fDist > 1e-3 ? Math.min(0.35, 65 / fDist) : 0) : 0.35;
    const targetSafe = this._findSafeZonePos(
      THREE.MathUtils.lerp(bestRoute.targetX, focus.x, pull),
      THREE.MathUtils.lerp(bestRoute.targetZ, focus.z, pull),
      2.4
    );

    const vType = theme.convoyVehicles[Math.floor(Math.random() * theme.convoyVehicles.length)];
    const spec = VEHICLE_SPECS[vType] || VEHICLE_SPECS.suv_pcc;
    const heading = Math.atan2(targetSafe.x - startSafe.x, targetSafe.z - startSafe.z);

    const carMesh = this._acquireConvoyCarMesh(vType, theme.hex, theme.secondaryHex);
    carMesh.position.set(startSafe.x, startSafe.y + 0.16, startSafe.z);
    carMesh.rotation.y = heading;
    carMesh.userData.carType = vType;
    carMesh.userData.carName = `${spec.name} // ${theme.shortTag}`;
    carMesh.userData.vehicleSpec = spec;
    this.scene.add(carMesh);

    const col = this.world.addCollider(startSafe.x, startSafe.z, 2.5, 4.8, startSafe.y + 1.8, startSafe.y);
    col.disabled = true;

    const destructible = this.destructibles.registerDestructible({
      mesh: carMesh, type: 'car', hp: spec.hp, radius: 2.75, height: 2.2, colliders: [col],
      debrisColors: [theme.hex, theme.secondaryHex, theme.accentHex],
      studDrops: spec.studDrops, groundY: startSafe.y
    });
    destructible.noAutoRespawn = true;
    destructible.onUnregistered = (dItem) => {
      if (!dItem.isBurnedWreck && !dItem.isDriven && dItem.damageStage === 'intact') {
        disembarkOccupants(dItem, Infinity);
        this._releaseConvoyCarMesh(carMesh);
      }
    };

    this.warSpawnedCars.push(destructible);
    while (this.warSpawnedCars.length > 5) {
      const oldest = this.warSpawnedCars.shift();
      if (oldest && !oldest.isDriven) this.destructibles.unregisterDestructible(oldest);
    }

    const squadRoles = roles ? roles.slice(0, 6) : isAllied ? ['rifleman', 'rifleman', 'tank', 'medic'] : ['rifleman', 'rifleman', 'tank'];
    attachVehicleOccupants(destructible, {
      source: 'convoy', carType: vType, faction, isAllied: Boolean(isAllied), count: Math.min(4, squadRoles.length)
    });

    const convoy = {
      faction, isAllied, mesh: carMesh, destructible, collider: col,
      targetX: targetSafe.x, targetZ: targetSafe.z, speed: 24.0,
      maxTravelTimer: IS_SCALED_WORLD ? 6.0 : 4.5, disembarked: false,
      squadRoles, anchor: target ? { x: target.x, z: target.z } : null, outpostId: target?.id || null
    };
    this.activeConvoyDrops.push(convoy);
    return convoy;
  },

  _disembarkConvoySquad(convoy) {
    if (convoy.disembarked) return;
    convoy.disembarked = true;
    disembarkOccupants(convoy.destructible, Infinity);

    const cx = convoy.mesh.position.x, cz = convoy.mesh.position.z;
    const cy = this._groundAt(cx, cz, convoy.mesh.position.y);
    convoy.mesh.position.y = cy + 0.16;
    convoy.destructible.basePos.copy(convoy.mesh.position);
    convoy.destructible.groundY = cy;

    if (convoy.collider) {
      convoy.collider.minX = cx - 1.25; convoy.collider.maxX = cx + 1.25;
      convoy.collider.minZ = cz - 2.4; convoy.collider.maxZ = cz + 2.4;
      convoy.collider.minY = cy; convoy.collider.maxY = cy + 1.8;
      convoy.collider.disabled = false;
    }

    this.destructibles.spawnHeroSwapEffect(
      new THREE.Vector3(cx, cy + 0.4, cz),
      FACTION_THEME[convoy.faction]?.hex || 0xf59e0b
    );

    const offsets = [
      { dx: -2.8, dz: -1.4 }, { dx: 2.8, dz: -1.4 }, { dx: -2.6, dz: 1.8 },
      { dx: 2.6, dz: 1.8 }, { dx: 0, dz: -3.2 }, { dx: 0, dz: 3.4 }
    ];

    convoy.squadRoles.forEach((role, idx) => {
      const off = offsets[idx % offsets.length];
      const spec = {
        faction: convoy.faction,
        role,
        x: cx + off.dx,
        z: cz + off.dz,
        outpostId: convoy.outpostId,
        patrolAnchor: convoy.anchor ? { x: convoy.anchor.x + off.dx, z: convoy.anchor.z + off.dz } : null
      };
      if (this.activeMode === 'INVASION_1V1' && (this._disembarkedThisTick || 0) >= 3 && typeof this._enqueuePendingUnit === 'function') {
        this._enqueuePendingUnit(spec, Boolean(convoy.anchor), convoy.onUnit || null);
      } else {
        this._disembarkedThisTick = (this._disembarkedThisTick || 0) + 1;
        const unit = this._spawnCombatUnit(spec);
        if (unit && convoy.anchor) unit.retreating = true;
        if (unit && convoy.onUnit) convoy.onUnit(unit);
      }
    });
  },

  _updateConvoyDrops(dt) {
    this._disembarkedThisTick = 0;
    for (let i = this.activeConvoyDrops.length - 1; i >= 0; i--) {
      const cv = this.activeConvoyDrops[i];
      if (!cv.destructible || cv.destructible.destroyed) {
        this.activeConvoyDrops.splice(i, 1);
        continue;
      }

      cv.maxTravelTimer -= dt;
      const dx = cv.targetX - cv.mesh.position.x;
      const dz = cv.targetZ - cv.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= 3.2 || cv.maxTravelTimer <= 0 || cv.destructible.driverKilled) {
        this._disembarkConvoySquad(cv);
        this.activeConvoyDrops.splice(i, 1);
        continue;
      }

      const engineMult = this.destructibles?.getVehicleEngineSpeedMultiplier
        ? this.destructibles.getVehicleEngineSpeedMultiplier(cv.destructible)
        : 1.0;
      const effSpeed = cv.speed * engineMult;
      cv.destructible._aiCurrentSpeed = effSpeed;
      const step = Math.min(dist, effSpeed * dt);
      const nx = cv.mesh.position.x + (dx / dist) * step;
      const nz = cv.mesh.position.z + (dz / dist) * step;
      const resolved = this.livingCity._resolveBuildingCollision(nx, nz, 2.1);
      const ny = this._groundAt(resolved.x, resolved.z, cv.mesh.position.y);

      cv.mesh.position.set(resolved.x, ny + 0.16, resolved.z);
      cv.mesh.rotation.y = Math.atan2(dx, dz);
      cv.destructible.basePos.copy(cv.mesh.position);

      if (resolved.collided) {
        this._disembarkConvoySquad(cv);
        this.activeConvoyDrops.splice(i, 1);
      }
    }
  }
};
