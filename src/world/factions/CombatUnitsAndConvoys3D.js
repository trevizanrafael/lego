import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries } from '../BuildingGenerator.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { createFactionSoldierVisual, AIM_POSE } from '../../entities/FactionSoldierBuilder.js';
import { FACTION_THEME } from './TerritoryZonesAndConfigs.js';
import { IS_SCALED_WORLD } from '../core/WorldLayoutScale.js';
import { HumanoidHealthModel } from '../npc-health/HumanoidHealthModel.js';
import { attachVehicleOccupants, disembarkOccupants } from '../vehicles/VehicleOccupants.js';

// ============================================================================
// GEOMETRIAS PRÉ-FUNDIDAS COMPARTILHADAS, UNIDADES DE COMBATE & COMBOIOS 3D
// (Zero custo extra de Draw Calls / GC — 60 FPS cravados!)
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
const VEST_MAT_CACHE = new Map();

export function ensureSharedWarGeometries() {
  if (SHARED_WAR_GEOS) return SHARED_WAR_GEOS;

  // Tronco Trapezoidal LEGO Clássico
  const torso = new THREE.BoxGeometry(1, 0.76, 0.44);
  const tPos = torso.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    tPos.setX(i, tPos.getX(i) * (y > 0 ? 0.95 : 0.78));
  }
  torso.computeVertexNormals();
  const neck = new THREE.CylinderGeometry(0.19, 0.22, 0.08, 12);
  neck.translate(0, 0.41, 0);
  const torsoGeo = mergeBufferGeometries([torso, neck]);

  const hipW = new THREE.BoxGeometry(0.78, 0.14, 0.42);
  const hipT = new THREE.BoxGeometry(0.11, 0.22, 0.4);
  hipT.translate(0, -0.1, 0);
  const hipGeo = mergeBufferGeometries([hipW, hipT]);

  const thigh = new THREE.BoxGeometry(0.31, 0.28, 0.34);
  thigh.translate(0, -0.15, 0);
  const shin = new THREE.BoxGeometry(0.3, 0.26, 0.33);
  shin.translate(0, -0.42, 0);
  const boot = new THREE.BoxGeometry(0.31, 0.13, 0.43);
  boot.translate(0, -0.585, 0.045);
  const legGeo = mergeBufferGeometries([thigh, shin, boot]);

  const shldr = new THREE.SphereGeometry(0.145, 8, 8);
  shldr.translate(0, -0.04, 0);
  const uArm = new THREE.CylinderGeometry(0.12, 0.11, 0.28, 8);
  uArm.translate(0, -0.18, 0);
  const fArm = new THREE.CylinderGeometry(0.11, 0.1, 0.24, 8);
  fArm.translate(0, -0.41, 0);
  const armGeo = mergeBufferGeometries([shldr, uArm, fArm]);

  const wrist = new THREE.CylinderGeometry(0.075, 0.075, 0.08, 8);
  const claw = new THREE.TorusGeometry(0.105, 0.042, 6, 12, Math.PI * 1.45);
  claw.rotateY(Math.PI / 2);
  claw.rotateX(Math.PI * 0.75);
  claw.translate(0, -0.11, 0.02);
  const handGeo = mergeBufferGeometries([wrist, claw]);

  const headCyl = new THREE.CylinderGeometry(0.27, 0.27, 0.5, 16);

  // Armas 3D LEGO Detalhadas (Fuzil de Assalto, Medi-Gun e Escudo Balístico)
  const rBody = new THREE.BoxGeometry(0.12, 0.18, 0.68);
  rBody.translate(0, -0.46, 0.34);
  const rBarrel = new THREE.CylinderGeometry(0.035, 0.035, 0.38, 8);
  rBarrel.rotateX(Math.PI / 2);
  rBarrel.translate(0, -0.43, 0.84);
  const rMag = new THREE.BoxGeometry(0.09, 0.26, 0.14);
  rMag.rotateX(0.25);
  rMag.translate(0, -0.61, 0.42);
  const rScope = new THREE.BoxGeometry(0.08, 0.08, 0.24);
  rScope.translate(0, -0.33, 0.36);
  const rifleGeo = mergeBufferGeometries([rBody, rBarrel, rMag, rScope]);

  const shieldPlate = new THREE.BoxGeometry(0.76, 1.24, 0.1);
  shieldPlate.translate(-0.14, -0.38, 0.34);
  const shieldRim = new THREE.BoxGeometry(0.82, 0.14, 0.13);
  shieldRim.translate(-0.14, 0.19, 0.34);
  const shieldGeo = mergeBufferGeometries([shieldPlate, shieldRim]);

  // Losango Verde Discreto de Aliado (SOMENTE visível no time do jogador!)
  const allyDiamond = new THREE.OctahedronGeometry(0.17, 0);
  allyDiamond.scale(0.85, 1.25, 0.85);

  SHARED_WAR_GEOS = {
    torsoGeo,
    hipGeo,
    legGeo,
    armGeo,
    handGeo,
    headCyl,
    rifleGeo,
    shieldGeo,
    allyDiamond,
    bulletGeo: new THREE.BoxGeometry(0.16, 0.16, 0.72),
    rocketGeo: new THREE.CylinderGeometry(0.0, 0.16, 0.9, 8).rotateX(Math.PI / 2),
    blastGeo: new THREE.SphereGeometry(1, 14, 10),
    shockwaveGeo: new THREE.RingGeometry(0.8, 1.25, 24)
  };
  SHARED_WAR_GEOS.shockwaveGeo.rotateX(-Math.PI / 2);
  return SHARED_WAR_GEOS;
}

export function getTacticalVestMaterials(factionKey, roleKey, baseHex) {
  const cacheKey = `${factionKey}_${roleKey}`;
  if (VEST_MAT_CACHE.has(cacheKey)) return VEST_MAT_CACHE.get(cacheKey);

  const plainMat = getLegoMaterial(baseHex, { roughness: 0.25, clearcoat: 0.42 });
  const doc = globalThis.document;
  if (!doc || typeof doc.createElement !== 'function') {
    const arr = [plainMat, plainMat, plainMat, plainMat, plainMat, plainMat];
    VEST_MAT_CACHE.set(cacheKey, arr);
    return arr;
  }

  const canvas = doc.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const arr = [plainMat, plainMat, plainMat, plainMat, plainMat, plainMat];
    VEST_MAT_CACHE.set(cacheKey, arr);
    return arr;
  }

  const theme = FACTION_THEME[factionKey] || FACTION_THEME.cv;
  ctx.fillStyle = `#${baseHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 128, 128);

  // Colete Balístico LEGO em Alto Contraste
  ctx.fillStyle = '#090a0d';
  ctx.fillRect(16, 14, 96, 98);
  ctx.strokeStyle = theme.color;
  ctx.lineWidth = 5;
  ctx.strokeRect(20, 18, 88, 88);

  if (roleKey === 'medic') {
    // Emblema de Médico de Combate (Cruz Verde/Branca Tática)
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(54, 34, 20, 52);
    ctx.fillRect(38, 50, 52, 20);
  } else {
    // Placas Cerâmicas + Porta-Carregadores Táticos
    ctx.fillStyle = '#334155';
    ctx.fillRect(28, 28, 72, 30);
    ctx.fillStyle = theme.color;
    for (let p = 0; p < 3; p++) {
      ctx.fillRect(26 + p * 26, 70, 20, 28);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const frontMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.28,
    metalness: 0.08
  });

  const mats = [plainMat, plainMat, plainMat, plainMat, frontMat, plainMat];
  VEST_MAT_CACHE.set(cacheKey, mats);
  return mats;
}

export const combatUnitsAndConvoysMethods = {
  // ==========================================================================
  // LINHA DE VISÃO (LOS) E TERRENO SEGURO (ZERO TIRO ATRAVÉS DE PRÉDIOS!)
  // ==========================================================================
  _hasClearLineOfSight(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.2) return true;
    const steps = Math.min(12, Math.max(4, Math.ceil(dist / 6.0)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = x1 + dx * t;
      const sz = z1 + dz * t;
      if (this.livingCity._isInsideBuilding(sx, sz, 0.3)) {
        return false;
      }
    }
    return true;
  },

  _groundAt(x, z, refY = 0) {
    if (typeof this.world.getSurfaceHeightAt === 'function') {
      return this.world.getSurfaceHeightAt(x, z, refY);
    }
    return typeof this.world.getTerrainHeightAt === 'function'
      ? this.world.getTerrainHeightAt(x, z)
      : 0;
  },

  _findSafeZonePos(x, z, radius = 1.4, refY = null) {
    const safe = this.livingCity._findSafeStreetSpawn(x, z, radius);
    if (IS_SCALED_WORLD && !safe.valid && typeof this.world?.resolveCapsulePenetration === 'function') {
      const approxY = this._groundAt(x, z, refY === null ? 2 : refY + 0.6);
      const cap = this.world.resolveCapsulePenetration(
        { x, y: approxY, z },
        radius,
        2.0,
        { stepUpHeight: 0.4 }
      );
      const cy = this._groundAt(cap.x, cap.z, refY === null ? approxY + 1 : refY + 0.6);
      return { x: cap.x, y: cy, z: cap.z };
    }
    const y = this._groundAt(safe.x, safe.z, refY === null ? 2 : refY + 0.6);
    return { x: safe.x, y, z: safe.z };
  },

  // ==========================================================================
  // CRIAÇÃO DE SOLDADOS MINIFIGURA LEGO ARTICULADOS & BOSSES BIG-FIG COLOSSAIS
  // ==========================================================================
  _spawnCombatUnit({
    faction,
    role = 'rifleman',
    x,
    z,
    y = null,
    outpostId = null,
    patrolAnchor = null,
    forceAllied = null
  }) {
    const geos = ensureSharedWarGeometries();
    const theme = this.getFactionTheme(faction);
    const isAllied = forceAllied ?? faction === this.playerFaction;
    // Classes pesadas do Super Banco: "brute" (monstrão Big-Fig) e "elite" (atira sem parar)
    const heavyClass = role === 'brute' || role === 'elite' ? role : null;
    const visualRole = role === 'brute' ? 'tank' : role === 'elite' ? 'boss' : role;
    const isBoss = role === 'boss';
    const isTank = role === 'tank';
    const isMedic = role === 'medic';

    const safePos = this._findSafeZonePos(x, z, isBoss || heavyClass ? 2.2 : 1.15, y);
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    root.userData.skipStaticMerge = true;

    const unitScale =
      role === 'brute' ? 2.0 : role === 'elite' ? 1.5 : isBoss ? 2.32 : isTank ? 1.14 : 1.0;
    const bodyRig = new THREE.Group();
    bodyRig.scale.setScalar(unitScale);
    root.add(bodyRig);

    // Minifigura de combate detalhada (kit visual por facção + classe)
    const soldier = createFactionSoldierVisual(faction, visualRole);
    bodyRig.add(soldier.bodyRig);
    const { leftLeg, rightLeg, leftArm, rightArm, muzzleFlash } = soldier;
    rightArm.rotation.x = AIM_POSE.rightArmX;
    leftArm.rotation.x = soldier.hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX;
    if (!soldier.hasShield) leftArm.rotation.z = AIM_POSE.leftArmZ; // mão de apoio na arma

    // Losango Verde Discreto APENAS nos Aliados (Zero barras de vida flutuando na tela!)
    const allyMarker = new THREE.Mesh(geos.allyDiamond, ALLY_MARKER_MAT);
    allyMarker.position.set(0, isBoss ? 6.1 : 2.78, 0);
    allyMarker.visible = isAllied;
    root.add(allyMarker);

    root.position.set(safePos.x, safePos.y, safePos.z);
    this.scene.add(root);

    const big = isBoss || heavyClass;
    const hp =
      role === 'brute'
        ? 1100
        : role === 'elite'
          ? 1400
          : isBoss
            ? 1550
            : faction === 'guard'
              ? isTank
                ? 170
                : 95
              : isTank
                ? 280
                : isMedic
                  ? 175
                  : 160;
    const destructible = this.destructibles.registerDestructible({
      mesh: root,
      type: big ? 'npc_boss' : 'npc_fighter',
      hp,
      radius: big ? 1.05 * unitScale + 0.2 : 1.05,
      height: 2.25 * unitScale,
      colliders: [],
      debrisColors: [theme.hex, theme.secondaryHex, theme.accentHex, LEGO_COLORS.yellow],
      studDrops: big
        ? { silver: 0, gold: 18, blue: 10, purple: 4 }
        : { silver: 2, gold: 4, blue: isTank ? 2 : 1, purple: 0 },
      groundY: safePos.y
    });

    const humanoidHealth = new HumanoidHealthModel({
      kind: isBoss || heavyClass ? 'boss' : 'soldier',
      maxHp: hp
    });
    destructible.maxHp = hp;
    destructible.isCombatNpc = true;
    destructible.isTankNpc = isTank;
    destructible.isBossNpc = isBoss || Boolean(heavyClass);
    destructible.isAlliedToPlayer = isAllied;
    destructible.noAutoRespawn = true;
    destructible.unitScale = unitScale;
    destructible.humanoidHealth = humanoidHealth;

    const npc = {
      faction,
      role,
      isAllied,
      isMecha: isBoss,
      isBoss,
      unitScale,
      humanoidHealth,
      outpostId,
      patrolAnchor: patrolAnchor || { x: safePos.x, z: safePos.z },
      patrolAngle: Math.random() * Math.PI * 2,
      saluting: false,
      fireCooldown: 0.55 + Math.random() * 0.75,
      slamCooldown: 4.5,
      muzzleTimer: 0,
      walkPhase: Math.random() * 6.28,
      speed: role === 'brute' ? 4.0 : isBoss ? 5.2 : isTank ? 4.4 : isMedic ? 5.8 : 5.3,
      heavyClass,
      hitR: 1.05 * unitScale,
      hitH: 2.3 * unitScale,
      destructible,
      visual: {
        root,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        muzzleFlash,
        allyMarker,
        head: soldier.head,
        drone: soldier.drone,
        weaponKind: soldier.weaponKind
      },
      className: soldier.className
    };
    destructible.visual = npc.visual;
    destructible.npcRef = npc;

    destructible.onShattered = () => {
      if (npc.isBankRobber) this.bankHeist.onRobberDefeated(npc);
      if (isBoss && !isAllied && this.activeZoneId) {
        const zState = this.territories[this.activeZoneId];
        if (zState && zState.enemyBoss === npc) {
          zState.enemyBossDefeated = true;
        }
      }
    };

    this.combatNpcs.push(npc);
    return npc;
  },

  // ==========================================================================
  // DESPACHO DE REFORÇOS MOTORIZADOS (CARROS DO TIME ALIADO & CARROS INIMIGOS!)
  // ==========================================================================
  _spawnMotorizedSquad({
    faction,
    isAllied,
    zoneState,
    playerPos,
    roles = null,
    target = null
  }) {
    const theme = FACTION_THEME[faction] || FACTION_THEME.cv;
    const routes = isAllied ? zoneState.spec.alliedEntryRoutes : zoneState.spec.defenderMotorRoutes;
    if (!routes || routes.length === 0) return null;

    // Escolhe a rota mais próxima do jogador
    const focus = target || playerPos;
    let bestRoute = routes[0];
    let bestDist = Infinity;
    for (const r of routes) {
      const d = Math.hypot(r.targetX - focus.x, r.targetZ - focus.z);
      if (d < bestDist) {
        bestDist = d;
        bestRoute = r;
      }
    }

    const startSafe = this._findSafeZonePos(bestRoute.startX, bestRoute.startZ, 2.4);
    const fdx = focus.x - bestRoute.targetX;
    const fdz = focus.z - bestRoute.targetZ;
    const fDist = Math.hypot(fdx, fdz);
    const pull = IS_SCALED_WORLD ? (fDist > 1e-3 ? Math.min(0.35, 65 / fDist) : 0) : 0.35;
    const blendX = THREE.MathUtils.lerp(bestRoute.targetX, focus.x, pull);
    const blendZ = THREE.MathUtils.lerp(bestRoute.targetZ, focus.z, pull);
    const targetSafe = this._findSafeZonePos(blendX, blendZ, 2.4);

    const vType = theme.convoyVehicles[Math.floor(Math.random() * theme.convoyVehicles.length)];
    const spec = VEHICLE_SPECS[vType] || VEHICLE_SPECS.suv_pcc;
    const heading = Math.atan2(targetSafe.x - startSafe.x, targetSafe.z - startSafe.z);

    const carMesh = createLegoCarMesh({
      x: startSafe.x,
      z: startSafe.z,
      rotY: heading,
      color: theme.hex,
      roofColor: theme.secondaryHex,
      type: vType
    });
    carMesh.position.set(startSafe.x, startSafe.y + 0.16, startSafe.z);
    carMesh.rotation.y = heading;
    carMesh.userData.carType = vType;
    carMesh.userData.carName = `${spec.name} // ${theme.shortTag}`;
    carMesh.userData.vehicleSpec = spec;
    this.scene.add(carMesh);

    const col = this.world.addCollider(
      startSafe.x,
      startSafe.z,
      2.5,
      4.8,
      startSafe.y + 1.8,
      startSafe.y
    );
    col.disabled = true; // Habilitado quando o carro freia e estaciona!

    const destructible = this.destructibles.registerDestructible({
      mesh: carMesh,
      type: 'car',
      hp: spec.hp,
      radius: 2.75,
      height: 2.2,
      colliders: [col],
      debrisColors: [theme.hex, theme.secondaryHex, theme.accentHex],
      studDrops: spec.studDrops,
      groundY: startSafe.y
    });
    destructible.noAutoRespawn = true;

    // Recicla carros de comboio antigos não dirigidos para manter 60 FPS limpos
    this.warSpawnedCars.push(destructible);
    while (this.warSpawnedCars.length > 5) {
      const oldest = this.warSpawnedCars.shift();
      if (oldest && !oldest.isDriven) {
        this.destructibles.unregisterDestructible(oldest);
      }
    }

    const squadRoles = roles
      ? roles.slice(0, 6)
      : isAllied
        ? ['rifleman', 'rifleman', 'tank', 'medic']
        : ['rifleman', 'rifleman', 'tank'];
    attachVehicleOccupants(destructible, {
      source: 'convoy',
      carType: vType,
      faction,
      isAllied: Boolean(isAllied),
      count: Math.min(4, squadRoles.length)
    });

    const convoy = {
      faction,
      isAllied,
      mesh: carMesh,
      destructible,
      collider: col,
      targetX: targetSafe.x,
      targetZ: targetSafe.z,
      speed: 24.0,
      maxTravelTimer: IS_SCALED_WORLD ? 6.0 : 4.5,
      disembarked: false,
      squadRoles,
      anchor: target ? { x: target.x, z: target.z } : null,
      outpostId: target?.id || null
    };
    this.activeConvoyDrops.push(convoy);
    return convoy;
  },

  _disembarkConvoySquad(convoy) {
    if (convoy.disembarked) return;
    convoy.disembarked = true;
    disembarkOccupants(convoy.destructible, Infinity);

    const cx = convoy.mesh.position.x;
    const cz = convoy.mesh.position.z;
    const cy = this._groundAt(cx, cz, convoy.mesh.position.y);
    convoy.mesh.position.y = cy + 0.16;
    convoy.destructible.basePos.copy(convoy.mesh.position);
    convoy.destructible.groundY = cy;

    if (convoy.collider) {
      convoy.collider.minX = cx - 1.25;
      convoy.collider.maxX = cx + 1.25;
      convoy.collider.minZ = cz - 2.4;
      convoy.collider.maxZ = cz + 2.4;
      convoy.collider.minY = cy;
      convoy.collider.maxY = cy + 1.8;
      convoy.collider.disabled = false;
    }

    // Efeito visual de derrapagem/desembarque tático
    this.destructibles.spawnHeroSwapEffect(
      new THREE.Vector3(cx, cy + 0.4, cz),
      FACTION_THEME[convoy.faction]?.hex || 0xf59e0b
    );

    const offsets = [
      { dx: -2.8, dz: -1.4 },
      { dx: 2.8, dz: -1.4 },
      { dx: -2.6, dz: 1.8 },
      { dx: 2.6, dz: 1.8 },
      { dx: 0, dz: -3.2 },
      { dx: 0, dz: 3.4 }
    ];

    convoy.squadRoles.forEach((role, idx) => {
      const off = offsets[idx % offsets.length];
      const unit = this._spawnCombatUnit({
        faction: convoy.faction,
        role,
        x: cx + off.dx,
        z: cz + off.dz,
        outpostId: convoy.outpostId,
        patrolAnchor: convoy.anchor
          ? { x: convoy.anchor.x + off.dx, z: convoy.anchor.z + off.dz }
          : null
      });
      if (unit && convoy.anchor) unit.retreating = true; // corre até o ponto antes de lutar
      if (unit && convoy.onUnit) convoy.onUnit(unit);
    });
  },

  _updateConvoyDrops(dt) {
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
