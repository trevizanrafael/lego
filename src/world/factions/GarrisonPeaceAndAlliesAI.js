import * as THREE from 'three';
import { markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { EXTRA_THEMES, FACTION_THEME } from './TerritoryZonesAndConfigs.js';

// ============================================================================
// GUARNIÇÃO PACÍFICA NO PRÓPRIO TERRITÓRIO (QG ALIADO), CONTINÊNCIA, MÉDICOS
// CURANDO COM FEIXE 3D, GARAGENS DESTRANCADAS E PERSISTÊNCIA DE CONQUISTAS
// ============================================================================

const _healStartTmp = new THREE.Vector3();
const _healEndTmp = new THREE.Vector3();

function drainPendingAllyGarrison(system, maxPerFrame = 1) {
  const q = system._pendingAllyGarrisonQueue;
  if (!q || q.length === 0 || system.activeMode !== 'ALLY_HQ') return;
  const tickId = system._allyQueueFrameCounter ?? system._aiTick ?? 0;
  if (system._lastAllyQueueDrainTick === tickId) return;
  system._lastAllyQueueDrainTick = tickId;
  const count = Math.min(maxPerFrame, q.length);
  for (let i = 0; i < count; i++) {
    const spec = q.shift();
    if (spec) system._spawnCombatUnit(spec);
  }
}

function resolveCleanGarrisonPos(system, rawX, rawZ) {
  const lc = system.livingCity;
  const res = lc._resolveBuildingCollision(rawX, rawZ, 1.15);
  if (!lc._isInsideBuilding(res.x, res.z, 1.0) && lc._isValidDryLandForPedestrian(res.x, res.z)) {
    return { x: res.x, y: system._groundAt(res.x, res.z, 2), z: res.z };
  }
  for (let ring = 1; ring <= 10; ring++) {
    const dist = 4.5 + ring * 3.5;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2 + ring * 0.25;
      const tx = rawX + Math.cos(ang) * dist;
      const tz = rawZ + Math.sin(ang) * dist;
      if (!lc._isValidDryLandForPedestrian(tx, tz)) continue;
      const cand = lc._resolveBuildingCollision(tx, tz, 1.15);
      if (!lc._isInsideBuilding(cand.x, cand.z, 1.0) && lc._isValidDryLandForPedestrian(cand.x, cand.z)) {
        return { x: cand.x, y: system._groundAt(cand.x, cand.z, 2), z: cand.z };
      }
    }
  }
  const fallback = system._findSafeZonePos(rawX, rawZ, 1.15);
  return { x: fallback.x, y: fallback.y, z: fallback.z };
}

export function getCachedAllyHqAnchors(system, zoneKey, st) {
  if (st._cachedAllyHqAnchors) return st._cachedAllyHqAnchors;
  const core = [];
  const deferred = [];
  const extraByLevel = [];

  for (const op of st.outposts) {
    const p = resolveCleanGarrisonPos(system, op.x - 5.2, op.z + 5.2);
    core.push({ role: 'rifleman', x: p.x, y: p.y, z: p.z, outpostId: op.id });
  }
  const p1 = st.outposts[0];
  const p2 = st.outposts[1] || p1;
  if (p1) {
    const m1 = resolveCleanGarrisonPos(system, p1.x + 5.2, p1.z + 5.2);
    core.push({ role: 'medic', x: m1.x, y: m1.y, z: m1.z, outpostId: p1.id });
  }
  if (p2) {
    const m2 = resolveCleanGarrisonPos(system, p2.x + 5.2, p2.z - 5.2);
    core.push({ role: 'medic', x: m2.x, y: m2.y, z: m2.z, outpostId: p2.id });
  }
  for (const g of st.spec.gates) {
    const gp = resolveCleanGarrisonPos(system, g.x + (zoneKey === 'cv' ? -9 : 9), g.z + 5);
    deferred.push({ role: 'rifleman', x: gp.x, y: gp.y, z: gp.z, outpostId: null });
  }
  for (let i = 0; i < 3; i++) {
    const op = st.outposts[i % st.outposts.length];
    if (!op) continue;
    const ep = resolveCleanGarrisonPos(system, op.x + 5.5, op.z - 5.5);
    extraByLevel.push({ role: i % 2 ? 'special' : 'tank', x: ep.x, y: ep.y, z: ep.z, outpostId: op.id });
  }

  st._cachedAllyHqAnchors = { core, deferred, extraByLevel };
  return st._cachedAllyHqAnchors;
}

export function updateAllyHqUnitBehavior(system, npc, dt, playerPos, healState) {
  drainPendingAllyGarrison(system, 2);

  const root = npc.visual.root;
  const pos = root.position;
  const distPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

  if (npc.visual.bodyRig) {
    const showBody = distPlayer <= 260;
    if (npc.visual.bodyRig.visible !== showBody) npc.visual.bodyRig.visible = showBody;
  }

  if (
    npc.role === 'medic' &&
    system.livingCity.playerHp < system.livingCity.playerMaxHp &&
    distPlayer < 22
  ) {
    const healStep = distPlayer > 6.5 ? npc.speed * dt : 0;
    if (healStep > 0) {
      const nx = pos.x + ((playerPos.x - pos.x) / distPlayer) * healStep;
      const nz = pos.z + ((playerPos.z - pos.z) / distPlayer) * healStep;
      const res = system.livingCity._resolveBuildingCollision(nx, nz, 0.95);
      pos.set(res.x, system._groundAt(res.x, res.z, pos.y), res.z);
    }
    root.rotation.y = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
    system._applyPlayerHeal(dt * 36, pos, playerPos, healState.beamIdx++);
    healState.playerBeingHealed = true;
  } else if (distPlayer < 13.5) {
    // Guarda Aliado vira para você e bate continência / acena!
    npc.saluting = true;
    root.rotation.y = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
    npc.visual.leftLeg.rotation.x = 0;
    npc.visual.rightLeg.rotation.x = 0;
    npc.visual.rightArm.rotation.x = -2.35 + Math.sin(system._animClock * 5.0) * 0.14;
    npc.visual.rightArm.rotation.z = -0.28;
  } else if (distPlayer <= 135) {
    // Patrulha calma ao redor do posto/portão apenas quando próximo ao jogador
    npc.saluting = false;
    npc.visual.rightArm.rotation.z = 0;
    npc.patrolAngle += dt * 0.55;
    const tx = npc.patrolAnchor.x + Math.cos(npc.patrolAngle) * 4.2;
    const tz = npc.patrolAnchor.z + Math.sin(npc.patrolAngle) * 4.2;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.35) {
      const step = Math.min(d, 2.4 * dt);
      const res = system.livingCity._resolveBuildingCollision(
        pos.x + (dx / d) * step,
        pos.z + (dz / d) * step,
        0.95
      );
      pos.set(res.x, system._groundAt(res.x, res.z, pos.y), res.z);
      root.rotation.y = Math.atan2(dx, dz);
      npc.walkPhase += dt * 5.5;
      npc.visual.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.42;
      npc.visual.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.42;
      npc.visual.rightArm.rotation.x = -0.45;
    }
  } else {
    npc.saluting = false;
  }

  npc.destructible.basePos.copy(pos);
}

export const garrisonPeaceAndAlliesMethods = {
  _initHealBeamPool() {
    const geo = markAsSharedAsset(new THREE.CylinderGeometry(0.09, 0.13, 1.0, 8));
    geo.rotateX(Math.PI / 2);
    const mat = markAsSharedAsset(new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.82 }));
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(geo, mat);
      beam.visible = false;
      this.scene.add(beam);
      this.healBeams.push(beam);
    }
  },

  getConqueredTerritoryIds() {
    return Object.values(this.territories).filter((t) => t.conqueredByPlayer).map((t) => t.id);
  },

  getFactionTheme(factionKey) {
    return FACTION_THEME[factionKey] || EXTRA_THEMES[factionKey] || FACTION_THEME.cv;
  },

  /** Depuração: começa o assalto agora (console: __legoGame.world.livingCity.factionWar.debugBankHeist()) */
  debugBankHeist() {
    this.bankHeist.timer = 0;
    return this.bankHeist.start();
  },

  _enterBankHeistMode() {
    this._cleanupActiveZoneUnits();
    this.activeZoneId = 'bank';
    this.activeMode = 'BANK_HEIST';
    this.isInvasionActive = true;
  },

  _leaveBankHeistMode() {
    this._cleanupActiveZoneUnits();
    if (this.activeZoneId === 'bank') {
      this.activeZoneId = null;
      this.activeMode = 'PEACEFUL_CITY';
      this.isInvasionActive = false;
    }
  },

  /** Território volta para a facção que contra-atacou */
  loseTerritory(zoneState, attacker = zoneState.spec.defaultOwner) {
    zoneState.ownerFaction = attacker;
    zoneState.conqueredByPlayer = false;
    zoneState.threatTimer = null;
    zoneState.garrisonLevel = 0;
    zoneState.bossPhaseTriggered = false;
    zoneState.enemyBossDefeated = false;
    for (const op of zoneState.outposts) op.ownerFaction = attacker;
    zoneState.captureZones.forEach((cz) => cz.reset());
    this._syncZone3DColors(zoneState.id);
  },

  /** Dados extras do território para o save (nível da guarnição e tempo até o próximo contra-ataque) */
  getTerritoryMeta() {
    const meta = {};
    for (const [k, st] of Object.entries(this.territories)) {
      if (!st.conqueredByPlayer) continue;
      meta[k] = {
        garrisonLevel: st.garrisonLevel || 0,
        threatTimer: Number.isFinite(st.threatTimer) ? Math.max(30, Math.round(st.threatTimer)) : null
      };
    }
    return meta;
  },

  applyTerritoryMeta(meta = null) {
    if (!meta || typeof meta !== 'object') return;
    for (const [k, m] of Object.entries(meta)) {
      const st = this.territories[k];
      if (!st || !st.conqueredByPlayer || !m) continue;
      st.garrisonLevel = Math.max(0, Math.min(3, Number(m.garrisonLevel) || 0));
      st.threatTimer = Number.isFinite(m.threatTimer) ? m.threatTimer : null;
    }
  },

  /** Depuração: força um contra-ataque agora (console: __legoGame.world.livingCity.factionWar.debugCounterAttack('pcc')) */
  debugCounterAttack(zoneId = null) {
    const id = zoneId || Object.values(this.territories).find((t) => t.conqueredByPlayer)?.id;
    if (!id) return false;
    return this.counterAttack.startAlert(id);
  },

  applySavedConquests(conqueredIds = [], playerFaction = this.playerFaction) {
    if (this.counterAttack?.isActive) this.counterAttack._finish();
    if (!Array.isArray(conqueredIds)) return;
    for (const zKey of Object.keys(this.territories)) {
      const st = this.territories[zKey];
      if (conqueredIds.includes(zKey) && FACTION_THEME[playerFaction]) {
        st.ownerFaction = playerFaction;
        st.conqueredByPlayer = true;
      } else {
        st.ownerFaction = st.spec.defaultOwner;
        st.conqueredByPlayer = false;
      }
      st.bossPhaseTriggered = false;
      st.enemyBossDefeated = false;
      for (const op of st.outposts) {
        op.ownerFaction = st.ownerFaction;
      }
      this._syncZone3DColors(zKey);
    }
  },

  resetConqueredTerritories() {
    if (this.counterAttack?.isActive) this.counterAttack._finish();
    this._cleanupActiveZoneUnits();
    this.activeZoneId = null;
    this.activeMode = 'PEACEFUL_CITY';
    this.isInvasionActive = false;
    this.activeWarzones.length = 0;

    for (const [zKey, st] of Object.entries(this.territories)) {
      st.ownerFaction = st.spec.defaultOwner;
      st.conqueredByPlayer = false;
      st.bossPhaseTriggered = false;
      st.enemyBossDefeated = false;
      st.enemyBoss = null;
      st.alliedBoss = null;
      st.garrisonLevel = 0;
      st.threatTimer = null;
      st.captureZones.forEach((cz) => cz.reset());
      for (const op of st.outposts) {
        op.ownerFaction = st.spec.defaultOwner;
        op.captureHoldTimer = 0;
      }
      this._syncZone3DColors(zKey);
    }
  },

  setPlayerFaction(factionKey, controller = null, savedConquests = null) {
    const validKey = FACTION_THEME[factionKey] ? factionKey : 'cv';
    const changed = this.playerFaction !== validKey;
    this.playerFaction = validKey;
    this.livingCity.playerFaction = validKey;

    if (Array.isArray(savedConquests)) {
      this.applySavedConquests(savedConquests, validKey);
    } else if (changed) {
      // Ao trocar de facção, mantém territórios originais íntegros para permitir novas invasões
      for (const [zKey, st] of Object.entries(this.territories)) {
        if (!st.conqueredByPlayer) {
          st.ownerFaction = st.spec.defaultOwner;
          for (const op of st.outposts) {
            op.ownerFaction = st.ownerFaction;
          }
          this._syncZone3DColors(zKey);
        }
      }
    }

    // Se havia unidades ativas, reinicializa o estado da zona atual com a nova aliança
    if (this.activeZoneId) {
      this._cleanupActiveZoneUnits();
      this.activeZoneId = null;
      this.activeMode = 'PEACEFUL_CITY';
      this.isInvasionActive = false;
    }

    if (controller && controller.position) {
      this.update(0.016, controller.position, controller);
    }
  },

  _cleanupActiveZoneUnits() {
    this._clearPendingSpawnQueue?.();
    if (this._pendingAllyGarrisonQueue) this._pendingAllyGarrisonQueue.length = 0;

    for (const npc of this.combatNpcs) {
      if (npc.visual?.bodyRig) npc.visual.bodyRig.visible = true;
      if (npc.destructible) {
        this.destructibles.unregisterDestructible(npc.destructible);
      }
      if (npc.visual && !npc.destructible?._managedByCorpseManager) {
        this._releaseSoldierVisual?.(npc.visual);
      }
    }
    this.combatNpcs.length = 0;

    for (const proj of this.npcProjectiles) {
      if (proj.mesh?.parent) proj.mesh.parent.remove(proj.mesh);
      proj.active = false;
    }
    this.npcProjectiles.length = 0;

    for (const sw of this.activeShockwaves) {
      if (sw.mesh?.parent) sw.mesh.parent.remove(sw.mesh);
      sw.active = false;
      if (!sw._pooled) sw.mat?.dispose?.();
    }
    this.activeShockwaves.length = 0;

    for (const cv of this.activeConvoyDrops) {
      if (cv.destructible && !cv.destructible.isDriven) {
        this.destructibles.unregisterDestructible(cv.destructible);
      }
    }
    this.activeConvoyDrops.length = 0;

    for (const car of this.warSpawnedCars) {
      if (car && !car.isDriven) {
        this.destructibles.unregisterDestructible(car);
      }
    }
    this.warSpawnedCars.length = 0;

    for (const beam of this.healBeams) {
      beam.visible = false;
    }
    this.activeWarzones.length = 0;
  },

  _drainPendingAllyGarrison(maxPerFrame = 1) {
    drainPendingAllyGarrison(this, maxPerFrame);
  },

  prewarmTerritoryAnchors() {
    if (!this.territories) return;
    for (const [zKey, st] of Object.entries(this.territories)) {
      if (!st) continue;
      getCachedAllyHqAnchors(this, zKey, st);
      for (const r of st.spec?.alliedEntryRoutes || []) {
        if (r && !r._cachedStartSafe) r._cachedStartSafe = this._findSafeZonePos(r.startX, r.startZ, 2.4);
      }
      for (const r of st.spec?.defenderMotorRoutes || []) {
        if (r && !r._cachedStartSafe) r._cachedStartSafe = this._findSafeZonePos(r.startX, r.startZ, 2.4);
      }
    }
  },

  _enterAllyHqMode(zoneKey) {
    this._cleanupActiveZoneUnits();
    this._prewarmWarPoolsOnce?.();
    this.objectiveHud?.hide();
    this.activeZoneId = zoneKey;
    this.activeMode = 'ALLY_HQ';
    this.isInvasionActive = false;

    const st = this.territories[zoneKey];
    if (!st) return;

    const anchors = getCachedAllyHqAnchors(this, zoneKey, st);
    const faction = this.playerFaction;

    // Frame 0: spawna imediatamente os 5 guardas/médicos dos postos (reutilizando _soldierVisualPool em < 0.3 ms)
    for (let i = 0; i < anchors.core.length; i++) {
      const s = anchors.core[i];
      this._spawnCombatUnit({ faction, role: s.role, x: s.x, y: s.y, z: s.z, outpostId: s.outpostId });
    }

    // Escalonado (<= 2 por frame): guardas de portão + guarnição extra por nível
    const queue = this._pendingAllyGarrisonQueue || (this._pendingAllyGarrisonQueue = []);
    queue.length = 0;
    for (let i = 0; i < anchors.deferred.length; i++) {
      const s = anchors.deferred[i];
      queue.push({ faction, role: s.role, x: s.x, y: s.y, z: s.z, outpostId: s.outpostId });
    }
    const gLevel = Math.min(anchors.extraByLevel.length, st.garrisonLevel || 0);
    for (let i = 0; i < gLevel; i++) {
      const s = anchors.extraByLevel[i];
      queue.push({ faction, role: s.role, x: s.x, y: s.y, z: s.z, outpostId: s.outpostId });
    }
  },

  _applyPlayerHeal(amount, medicPos, playerPos, beamSlot) {
    this.livingCity.playerHp = Math.min(
      this.livingCity.playerMaxHp,
      this.livingCity.playerHp + amount
    );
    this.hud?.setPlayerHealth(this.livingCity.playerHp, this.livingCity.playerMaxHp, true);

    const beam = this.healBeams[beamSlot];
    if (beam) {
      _healStartTmp.set(medicPos.x, medicPos.y + 1.35, medicPos.z);
      _healEndTmp.set(playerPos.x, playerPos.y + 1.15, playerPos.z);
      const dist = _healStartTmp.distanceTo(_healEndTmp);
      beam.visible = true;
      beam.position.copy(_healStartTmp).lerp(_healEndTmp, 0.5);
      beam.scale.set(1, 1, Math.max(0.2, dist));
      beam.lookAt(_healEndTmp);
    }
  }
};
