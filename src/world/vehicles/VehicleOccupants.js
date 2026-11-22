import * as THREE from 'three';
import { getLegoMaterial, markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { HumanoidHealthModel, HUMANOID_STATES } from '../npc-health/HumanoidHealthModel.js';
import { spawnBloodHitSplatter } from '../npc-health/HumanoidHitReactions.js';

/**
 * VehicleOccupants.js
 * Sistema leve (60 FPS, zero-GC) de ocupantes sentados visíveis nas cabines de veículos IA,
 * desembarque sincronizado, tiro no motorista pelo para-brisa, ejeção de corpos carbonizados
 * e contagem exata de multi-kills por explosão.
 */

let SHARED_OCCUPANT_ASSETS = null;

function ensureOccupantAssets() {
  if (SHARED_OCCUPANT_ASSETS) return SHARED_OCCUPANT_ASSETS;
  const sh = markAsSharedAsset;
  SHARED_OCCUPANT_ASSETS = {
    torsoGeo: sh(new THREE.BoxGeometry(0.56, 0.48, 0.32)),
    shouldersGeo: sh(new THREE.BoxGeometry(0.72, 0.22, 0.28)),
    headGeo: sh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10)),
    helmetGeo: sh(new THREE.CylinderGeometry(0.24, 0.23, 0.2, 10)),
    capVisorGeo: sh(new THREE.BoxGeometry(0.32, 0.06, 0.26)),
    corpseTorsoGeo: sh(new THREE.BoxGeometry(0.68, 0.72, 0.36)),
    corpseLegsGeo: sh(new THREE.BoxGeometry(0.62, 0.68, 0.32)),
    corpseHeadGeo: sh(new THREE.CylinderGeometry(0.22, 0.22, 0.36, 10)),
    mats: {
      skinYellow: sh(getLegoMaterial(0xd4a017, { roughness: 0.45 })),
      balaclava: sh(getLegoMaterial(0x111827, { roughness: 0.72 })),
      policeTorso: sh(getLegoMaterial(0x172554, { roughness: 0.52 })),
      policeCap: sh(getLegoMaterial(0x0f172a, { roughness: 0.45 })),
      bopeTorso: sh(getLegoMaterial(0x090a0d, { roughness: 0.62, metalness: 0.2 })),
      bopeHelmet: sh(getLegoMaterial(0x18181b, { roughness: 0.48, metalness: 0.32 })),
      cvTorso: sh(getLegoMaterial(0x991b1c, { roughness: 0.55 })),
      cvCap: sh(getLegoMaterial(0x18181b, { roughness: 0.65 })),
      pccTorso: sh(getLegoMaterial(0x1e3a8a, { roughness: 0.52 })),
      pccHelmet: sh(getLegoMaterial(0x090a0d, { roughness: 0.58 })),
      aresTorso: sh(getLegoMaterial(0x475569, { roughness: 0.38, metalness: 0.48 })),
      aresHelmet: sh(getLegoMaterial(0x7e22ce, { roughness: 0.28, metalness: 0.42 })),
      civShirts: [
        sh(getLegoMaterial(0x334155, { roughness: 0.58 })),
        sh(getLegoMaterial(0x7c2d12, { roughness: 0.6 })),
        sh(getLegoMaterial(0x1e3a5f, { roughness: 0.58 })),
        sh(getLegoMaterial(0x3f3f46, { roughness: 0.6 }))
      ],
      civHair: [
        sh(getLegoMaterial(0x18181b, { roughness: 0.7 })),
        sh(getLegoMaterial(0x451a03, { roughness: 0.72 }))
      ],
      charredBody: sh(getLegoMaterial(0x18181b, { roughness: 0.94, metalness: 0.14 })),
      charredAsh: sh(getLegoMaterial(0x27272a, { roughness: 0.9, metalness: 0.1 }))
    }
  };
  return SHARED_OCCUPANT_ASSETS;
}

function resolvePalette(A, category, subKind, idx = 0) {
  const M = A.mats;
  if (category === 'police') {
    return subKind === 'bope'
      ? { torso: M.bopeTorso, head: M.balaclava, headgear: M.bopeHelmet, hasVisor: false }
      : { torso: M.policeTorso, head: M.skinYellow, headgear: M.policeCap, hasVisor: true };
  }
  if (category === 'cv') return { torso: M.cvTorso, head: M.balaclava, headgear: M.cvCap, hasVisor: true };
  if (category === 'pcc') return { torso: M.pccTorso, head: M.balaclava, headgear: M.pccHelmet, hasVisor: false };
  if (category === 'ares') return { torso: M.aresTorso, head: M.balaclava, headgear: M.aresHelmet, hasVisor: false };
  return {
    torso: M.civShirts[idx % M.civShirts.length],
    head: M.skinYellow,
    headgear: M.civHair[idx % M.civHair.length],
    hasVisor: idx % 2 === 0
  };
}

function buildSeatedBustMesh(category, subKind, seatPose, idx = 0) {
  const A = ensureOccupantAssets();
  const pal = resolvePalette(A, category, subKind, idx);
  const bust = new THREE.Group();
  bust.userData.isOccupantBust = true;
  bust.userData.skipStaticMerge = true;

  const torso = new THREE.Mesh(A.torsoGeo, pal.torso);
  torso.position.y = 0.24;
  const shoulders = new THREE.Mesh(A.shouldersGeo, pal.torso);
  shoulders.position.y = 0.36;
  const head = new THREE.Mesh(A.headGeo, pal.head);
  head.position.y = 0.64;
  const headgear = new THREE.Mesh(A.helmetGeo, pal.headgear);
  headgear.position.y = 0.78;
  for (const m of [torso, shoulders, head, headgear]) {
    m.castShadow = false;
    m.receiveShadow = false;
  }
  bust.add(torso, shoulders, head, headgear);

  if (pal.hasVisor) {
    const visor = new THREE.Mesh(A.capVisorGeo, pal.headgear);
    visor.position.set(0, 0.73, 0.14);
    visor.castShadow = false;
    bust.add(visor);
  }
  bust.position.set(seatPose.x, seatPose.y, seatPose.z);
  bust.scale.setScalar(seatPose.scale ?? 0.82);
  if (seatPose.leanX) bust.rotation.x = seatPose.leanX;
  return bust;
}

function createCharredCorpseGroup(seed = 0) {
  const A = ensureOccupantAssets();
  const root = new THREE.Group();
  root.userData.skipStaticMerge = true;
  const body = new THREE.Group();
  body.rotation.x = -Math.PI * 0.5;
  body.rotation.z = ((seed % 3) - 1) * 0.22;
  body.position.y = 0.2;

  const torso = new THREE.Mesh(A.corpseTorsoGeo, A.mats.charredBody);
  torso.position.set(0, 0.18, 0);
  const legs = new THREE.Mesh(A.corpseLegsGeo, A.mats.charredAsh);
  legs.position.set(0, -0.52, 0);
  const head = new THREE.Mesh(A.corpseHeadGeo, A.mats.charredBody);
  head.position.set(0, 0.74, 0);
  for (const m of [torso, legs, head]) {
    m.castShadow = false;
    m.receiveShadow = false;
  }
  body.add(torso, legs, head);
  root.add(body);
  return root;
}

function getSeatPosesForVehicle(carObj, opts = {}) {
  const carType = opts.carType || carObj?.mesh?.userData?.carType || '';
  const spec = carObj?.mesh?.userData?.vehicleSpec || null;
  if (carObj?.type === 'police_helicopter' || opts.vehicleKind === 'police_helicopter') {
    return {
      pilot: { x: -0.36, y: -0.22, z: 0.86, scale: 0.76 },
      gunner: { x: 0.36, y: -0.22, z: 0.86, scale: 0.76 }
    };
  }
  if (opts.isMoto || spec?.isMotorcycle || carType.startsWith('moto_')) {
    return {
      driver: { x: 0, y: 1.16, z: -0.26, scale: 0.84, leanX: 0.24 },
      passenger: { x: 0, y: 1.28, z: -0.88, scale: 0.82, leanX: 0.18 }
    };
  }
  if (opts.isBus || carType === 'onibus_urbano') {
    return {
      driver: { x: -0.76, y: 1.46, z: 3.05, scale: 0.84 },
      passenger: { x: 0.76, y: 1.52, z: 0.75, scale: 0.84 },
      rearL: { x: -0.76, y: 1.52, z: -1.55, scale: 0.84 },
      rearR: { x: 0.76, y: 1.52, z: -2.65, scale: 0.84 }
    };
  }
  if (['caveirao_bope', 'van_pcc', 'carro_forte', 'hover_apc_ares'].includes(carType)) {
    return {
      driver: { x: -0.46, y: 1.34, z: 0.42, scale: 0.82 },
      passenger: { x: 0.46, y: 1.34, z: 0.42, scale: 0.82 },
      rearL: { x: -0.48, y: 1.34, z: -0.72, scale: 0.82 },
      rearR: { x: 0.48, y: 1.34, z: -0.72, scale: 0.82 }
    };
  }
  return {
    driver: { x: -0.42, y: 1.02, z: -0.14, scale: 0.82 },
    passenger: { x: 0.42, y: 1.02, z: -0.14, scale: 0.82 },
    rearL: { x: -0.42, y: 1.02, z: -0.88, scale: 0.8 },
    rearR: { x: 0.42, y: 1.02, z: -0.88, scale: 0.8 }
  };
}

function buildSeatManifest(carObj, opts = {}) {
  const carType = opts.carType || carObj?.mesh?.userData?.carType || '';
  const spec = carObj?.mesh?.userData?.vehicleSpec || null;
  const isMoto = Boolean(opts.isMoto || spec?.isMotorcycle || carType.startsWith('moto_'));
  const isBus = Boolean(opts.isBus || carType === 'onibus_urbano');
  const isTank = Boolean(opts.isTank || spec?.isTank || carType === 'tanque_titan');

  if (carObj?.type === 'police_helicopter' || opts.vehicleKind === 'police_helicopter') {
    return {
      hiddenInHull: false,
      entries: [
        { seat: 'pilot', category: 'police', subKind: 'police' },
        { seat: 'gunner', category: 'police', subKind: 'police' }
      ]
    };
  }
  if (isTank) {
    return {
      hiddenInHull: true,
      entries: [
        { seat: 'driver', category: 'police', subKind: 'bope' },
        { seat: 'passenger', category: 'police', subKind: 'bope' }
      ]
    };
  }
  if (opts.source === 'police_pursuit') {
    const isBopeHeavy = opts.role === 'bope_heavy' || carType === 'caveirao_bope';
    const subKind = isBopeHeavy || opts.role === 'choque_pickup' ? 'bope' : 'police';
    const seats = isBopeHeavy ? ['driver', 'passenger', 'rearL', 'rearR'] : ['driver', 'passenger'];
    return { hiddenInHull: false, entries: seats.map((seat) => ({ seat, category: 'police', subKind })) };
  }
  if (opts.source === 'convoy') {
    const faction = opts.faction || 'cv';
    const count = Math.max(1, Math.min(4, Number(opts.count) || 3));
    const seatOrder = isMoto ? ['driver'] : ['driver', 'passenger', 'rearL', 'rearR'];
    return {
      hiddenInHull: false,
      entries: seatOrder.slice(0, Math.min(seatOrder.length, count)).map((seat) => ({
        seat, category: faction, subKind: faction, isAllied: Boolean(opts.isAllied)
      }))
    };
  }
  if (opts.source === 'traffic') {
    if (opts.isPoliceVehicle) {
      const seats = isMoto ? ['driver'] : ['driver', 'passenger'];
      const subKind = carType === 'caveirao_bope' || carType === 'choque_pickup' ? 'bope' : 'police';
      return { hiddenInHull: false, entries: seats.map((seat) => ({ seat, category: 'police', subKind })) };
    }
    if (isMoto) return { hiddenInHull: false, entries: [{ seat: 'driver', category: 'civilian', subKind: 'civilian' }] };
    if (isBus) {
      return {
        hiddenInHull: false,
        entries: ['driver', 'passenger', 'rearL'].map((seat) => ({ seat, category: 'civilian', subKind: 'civilian' }))
      };
    }
    const seed = Number.isFinite(opts.seedIndex)
      ? Math.abs(Math.floor(opts.seedIndex))
      : Math.abs(Math.round((carObj?.basePos?.x || 0) * 13 + (carObj?.basePos?.z || 0) * 7));
    const seats = seed % 2 === 0 ? ['driver', 'passenger'] : ['driver'];
    return { hiddenInHull: false, entries: seats.map((seat) => ({ seat, category: 'civilian', subKind: 'civilian' })) };
  }
  if (Array.isArray(opts.entries)) return { hiddenInHull: Boolean(opts.hiddenInHull), entries: opts.entries };
  return { hiddenInHull: false, entries: [] };
}

export function attachVehicleOccupants(carObj, opts = {}) {
  if (!carObj) return [];
  if (!opts.skipSaveDefault) carObj._defaultOccupantOpts = { ...opts };
  carObj.driverKilled = false;
  carObj._bailedOutFromFire = false;
  if (carObj._occupantsGroup?.parent) carObj._occupantsGroup.parent.remove(carObj._occupantsGroup);
  carObj._occupantsGroup = null;
  carObj.occupants = [];

  const manifest = buildSeatManifest(carObj, opts);
  if (!manifest.entries?.length) return carObj.occupants;

  const poses = getSeatPosesForVehicle(carObj, opts);
  const group = new THREE.Group();
  group.name = 'vehicle_occupants_group';
  group.userData.isOccupantsGroup = true;
  group.userData.skipStaticMerge = true;
  group.visible = !manifest.hiddenInHull;

  const seedBase = Number.isFinite(opts.seedIndex) ? Math.abs(Math.floor(opts.seedIndex)) : 0;
  for (let i = 0; i < manifest.entries.length; i++) {
    const spec = manifest.entries[i];
    const bustMesh = buildSeatedBustMesh(spec.category, spec.subKind, poses[spec.seat] || poses.driver, seedBase + i);
    if (manifest.hiddenInHull) bustMesh.visible = false;
    group.add(bustMesh);
    carObj.occupants.push({
      seat: spec.seat,
      category: spec.category,
      subKind: spec.subKind || spec.category,
      isAllied: Boolean(spec.isAllied),
      mesh: bustMesh,
      alive: true
    });
  }
  if (carObj.mesh) {
    carObj.mesh.add(group);
    carObj.mesh.userData._occupantsGroup = group;
  }
  carObj._occupantsGroup = group;
  return carObj.occupants;
}

export function getAliveOccupants(carObj) {
  if (!Array.isArray(carObj?.occupants)) return [];
  return carObj.occupants.filter((o) => o && o.alive);
}

export function getAliveOccupantCount(carObj) {
  if (!Array.isArray(carObj?.occupants)) return 0;
  let count = 0;
  for (let i = 0; i < carObj.occupants.length; i++) {
    if (carObj.occupants[i]?.alive) count++;
  }
  return count;
}

export function disembarkOccupants(carObj, count = Infinity) {
  if (!Array.isArray(carObj?.occupants) || count <= 0) return [];
  const maxRemove = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : carObj.occupants.length;
  const removed = [];
  for (let pass = 0; pass < 2 && removed.length < maxRemove; pass++) {
    for (let i = carObj.occupants.length - 1; i >= 0 && removed.length < maxRemove; i--) {
      const occ = carObj.occupants[i];
      if (!occ || !occ.alive) continue;
      if (pass === 0 && (occ.seat === 'driver' || occ.seat === 'pilot')) continue;
      occ.alive = false;
      if (occ.mesh) occ.mesh.visible = false;
      carObj.occupants.splice(i, 1);
      removed.push(occ);
    }
  }
  if (carObj._occupantsGroup && getAliveOccupantCount(carObj) === 0) {
    carObj._occupantsGroup.visible = false;
  }
  return removed;
}

export function restoreDefaultOccupants(carObj) {
  if (!carObj) return [];
  carObj.driverKilled = false;
  carObj._bailedOutFromFire = false;
  return carObj._defaultOccupantOpts
    ? attachVehicleOccupants(carObj, { ...carObj._defaultOccupantOpts, skipSaveDefault: true })
    : (carObj.occupants || []);
}

export function recordVehicleOccupantKills(destructibles, carObj, victims, worldPos, causedByPlayer = true, opts = {}) {
  if (!Array.isArray(victims) || victims.length === 0) return 0;
  const enemyOrCivVictims = victims.filter((v) => v && !v.isAllied);
  if (!causedByPlayer || enemyOrCivVictims.length === 0) return 0;

  const categories = enemyOrCivVictims.map((v) => v.category);
  const firstCat = categories[0];
  const primaryMockVictim = {
    type: firstCat === 'civilian' ? 'pedestrian_civilian' : 'npc_fighter',
    category: firstCat,
    faction: firstCat,
    isPoliceUnit: firstCat === 'police',
    isCivilianPedestrian: firstCat === 'civilian',
    isCombatNpc: firstCat !== 'civilian',
    mesh: carObj?.mesh || null,
    basePos: worldPos || carObj?.basePos || null
  };

  destructibles?.hud?.triggerPlayerKillFeedback?.(primaryMockVictim, {
    killCount: categories.length,
    categories,
    isHeadshot: Boolean(opts.isHeadshot),
    isVehicleExplosion: Boolean(opts.isVehicleExplosion)
  });

  const ws = destructibles?.world?.livingCity?.wantedSystem;
  if (ws?.addChaos) {
    for (let i = 0; i < categories.length; i++) {
      if (categories[i] === 'civilian') ws.addChaos(105, true);
      else if (categories[i] === 'police') ws.addChaos(120, true);
    }
  }
  return categories.length;
}

export function tryHitVehicleOccupantFromShot(destructibles, carObj, impactPoint, damage, damageOpts = {}) {
  if (!carObj || carObj.isDriven || damageOpts?.isExplosion || damage < 18 || carObj.type !== 'car') return false;
  const carType = carObj.mesh?.userData?.carType || '';
  if (carObj.mesh?.userData?.vehicleSpec?.isTank || carType === 'tanque_titan' || !impactPoint || !carObj.mesh) {
    return false;
  }
  const driver = Array.isArray(carObj.occupants) ? carObj.occupants.find((o) => o?.alive && o.seat === 'driver') : null;
  if (!driver) return false;

  const pos = carObj.mesh.position;
  const yaw = carObj.mesh.rotation.y || 0;
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const dx = impactPoint.x - pos.x, dy = impactPoint.y - pos.y, dz = impactPoint.z - pos.z;
  const localX = dx * cosY - dz * sinY, localY = dy, localZ = dx * sinY + dz * cosY;
  const isBus = carType === 'onibus_urbano';
  const maxLocalY = isBus ? 2.15 : 1.75, maxLocalZ = isBus ? 3.85 : 1.35;

  let hitDriverWindow =
    localY >= 0.88 && localY <= maxLocalY && localZ >= -0.45 && localZ <= maxLocalZ && localX >= -1.25 && localX <= 0.35;

  if (!hitDriverWindow && damageOpts?.shotDir && localZ >= -0.55) {
    const vx = damageOpts.shotDir.x || 0, vy = damageOpts.shotDir.y || 0, vz = damageOpts.shotDir.z || 0;
    const vLen = Math.hypot(vx, vy, vz);
    if (vLen > 1e-4) {
      const lvx = (vx * cosY - vz * sinY) / vLen, lvy = vy / vLen, lvz = (vx * sinY + vz * cosY) / vLen;
      for (let s = 0.35; s <= 3.15; s += 0.35) {
        const sx = localX + lvx * s, sy = localY + lvy * s, sz = localZ + lvz * s;
        if (sy >= 0.88 && sy <= maxLocalY && sz >= -0.45 && sz <= maxLocalZ && sx >= -1.15 && sx <= 0.35) {
          hitDriverWindow = true;
          break;
        }
      }
    }
  }
  if (!hitDriverWindow) return false;

  driver.alive = false;
  if (driver.mesh) driver.mesh.visible = false;
  carObj.driverKilled = true;
  if (carObj._occupantsGroup && getAliveOccupantCount(carObj) === 0) carObj._occupantsGroup.visible = false;

  spawnBloodHitSplatter(destructibles, impactPoint, damageOpts?.shotDir || null, true);
  const causedByPlayer = damageOpts?.sourceIsPlayer !== undefined ? Boolean(damageOpts.sourceIsPlayer) : true;
  recordVehicleOccupantKills(destructibles, carObj, [driver], impactPoint, causedByPlayer, { isHeadshot: true });
  return true;
}

export function killRemainingOccupantsOnExplosion(destructibles, carObj, blastPos, causedByPlayer = true) {
  if (!carObj || !Array.isArray(carObj.occupants) || carObj.occupants.length === 0) return 0;
  const aliveVictims = [];
  for (let i = 0; i < carObj.occupants.length; i++) {
    const occ = carObj.occupants[i];
    if (!occ || !occ.alive) continue;
    occ.alive = false;
    if (occ.mesh) occ.mesh.visible = false;
    aliveVictims.push(occ);
  }
  carObj.occupants.length = 0;
  if (carObj._occupantsGroup) carObj._occupantsGroup.visible = false;
  if (aliveVictims.length === 0) return 0;

  const world = destructibles?.world;
  const corpseMgr = world?.livingCity?.corpseManager;
  if (corpseMgr && blastPos) {
    const corpseCount = Math.min(aliveVictims.length, 2);
    const baseYaw = carObj.mesh?.rotation?.y || 0;
    for (let k = 0; k < corpseCount; k++) {
      const dist = 2.0 + k * 0.65;
      const ang = baseYaw + (k === 0 ? -1 : 1) * (Math.PI * 0.48) + k * 0.25;
      const cx = blastPos.x + Math.sin(ang) * dist, cz = blastPos.z + Math.cos(ang) * dist;
      if (world?.isDeepWaterAt?.(cx, cz)) continue;
      const groundY = world?.getSurfaceHeightAt
        ? world.getSurfaceHeightAt(cx, cz, blastPos.y)
        : (world?.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : 0);

      const corpseGroup = createCharredCorpseGroup(k + Math.abs(Math.round(cx)));
      corpseGroup.position.set(cx, groundY, cz);
      corpseGroup.rotation.y = ang;
      const hm = new HumanoidHealthModel({ kind: aliveVictims[k].category === 'civilian' ? 'civilian' : 'soldier', maxHp: 100 });
      hm.hp = 0;
      hm.state = HUMANOID_STATES.DEAD;
      hm.fallDirX = Math.sin(ang);
      hm.fallDirZ = Math.cos(ang);
      corpseMgr.registerCorpse({ isInstancedPedestrian: false, mesh: corpseGroup, healthModel: hm, groundY });
    }
  }
  return recordVehicleOccupantKills(destructibles, carObj, aliveVictims, blastPos, causedByPlayer, { isVehicleExplosion: true });
}
