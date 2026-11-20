import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { soundFX } from '../../audio/SoundFX.js';
import { WANTED_STAR_THRESHOLDS, WANTED_TIER_INFO } from './PolicePursuitAssets.js';

// Interseção rápida Segmento 2D vs AABB (detecta esconderijos atrás de prédios e becos)
function segmentIntersectsRect2D(ax, az, bx, bz, minX, maxX, minZ, maxZ) {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;

  const clip = (p, q) => {
    if (Math.abs(p) < 1e-6) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  return (
    clip(-dx, ax - minX) &&
    clip(dx, maxX - ax) &&
    clip(-dz, az - minZ) &&
    clip(dz, maxZ - az) &&
    t0 <= t1
  );
}

function reasonNeedsReset(controller) {
  return Boolean(controller && controller.position);
}

// Regeneração automática dos 4 Corações após 6s sem tomar dano durante perseguição
export function tickPursuitRegeneration(sys, dt) {
  sys.timeSinceLastDamage += dt;
  if (
    sys.timeSinceLastDamage >= 6.0 &&
    sys.livingCity &&
    sys.livingCity.playerHp < sys.livingCity.playerMaxHp
  ) {
    sys.livingCity.playerHp = Math.min(
      sys.livingCity.playerMaxHp,
      sys.livingCity.playerHp + dt * 46.0
    );
    const stillHealing = sys.livingCity.playerHp < sys.livingCity.playerMaxHp;
    sys.hud?.setPlayerHealth?.(sys.livingCity.playerHp, sys.livingCity.playerMaxHp, stillHealing);
  }
}

// Cooldown de evasão ("Dar Fuga" 18s em 1-3★ ou 25s em 4-5★) e sincronização do HUD
export function tickPursuitEscapeAndHud(sys, dt, playerPos, controller) {
  sys._hasLineOfSight = sys._computeLineOfSight(playerPos, controller);
  sys.escapeDuration = sys.stars >= 4 ? 25.0 : 18.0;

  if (!sys._hasLineOfSight) {
    sys.isEscaping = true;
    sys.escapeTimer += dt;
    if (sys.escapeTimer >= sys.escapeDuration) {
      const escapedStars = sys.stars;
      const studBonus = escapedStars * 1500;
      sys.clearWanted('escaped', { studBonus, escapedStars });
      return true;
    }
  } else {
    sys.isEscaping = false;
    sys.escapeTimer = Math.max(0, sys.escapeTimer - dt * 2.2);
  }

  const tier = WANTED_TIER_INFO[sys.stars] || WANTED_TIER_INFO[1];
  sys.hud?.updateWantedHud?.(
    sys.stars,
    sys.isEscaping,
    sys.escapeTimer,
    sys.escapeDuration,
    tier
  );
  return false;
}

export const wantedEscalationAndEscapeMethods = {
  _bindDestructibleChaosHooks() {
    if (!this.destructibles) return;

    const prevDamaged = this.destructibles.onObjectDamaged;
    this.destructibles.onObjectDamaged = (obj, dmg, hitOrigin, opts) => {
      if (typeof prevDamaged === 'function') prevDamaged(obj, dmg, hitOrigin, opts);
      this._handlePlayerDamagedObject(obj, dmg);
    };

    const prevDestroyed = this.destructibles.onObjectDestroyed;
    this.destructibles.onObjectDestroyed = (obj, hitOrigin, opts) => {
      if (typeof prevDestroyed === 'function') prevDestroyed(obj, hitOrigin, opts);
      this._handlePlayerDestroyedObject(obj);
    };
  },

  _isFactionWarContext(obj) {
    if (obj?.isFactionWarUnit) return true;
    if (this.livingCity?.factionWar?.isInvasionActive && !obj?.isPoliceUnit) return true;
    return false;
  },

  _handlePlayerDamagedObject(obj, dmg) {
    if (!obj || obj.isDriven || this._isFactionWarContext(obj)) return;

    const carType = obj.mesh?.userData?.carType || '';
    const isPoliceTarget =
      Boolean(obj.isPoliceUnit) ||
      carType === 'interceptor_v8' ||
      carType === 'caveirao_bope';

    if (isPoliceTarget && dmg >= 22) {
      this.addChaos(Math.max(52, dmg * 0.9), true);
    }
  },

  _handlePlayerDestroyedObject(obj) {
    if (!obj || this._isFactionWarContext(obj)) return;

    const carType = obj.mesh?.userData?.carType || '';
    const isPoliceTarget =
      Boolean(obj.isPoliceUnit) ||
      obj.type === 'police_helicopter' ||
      obj.type === 'hunter_drone' ||
      carType === 'interceptor_v8' ||
      carType === 'caveirao_bope';

    if (isPoliceTarget) {
      this.addChaos(120, true);
      return;
    }

    if (obj.type === 'car') {
      this.addChaos(54, true);
      return;
    }

    if (obj.type === 'atm_machine') {
      this.addChaos(56, true);
      return;
    }

    if (obj.type === 'gas_pump' || obj.type === 'fuel_truck' || obj.type === 'bank_vault_door') {
      this.addChaos(125, true);
      return;
    }

    if (obj.isStreetProp) {
      this._consecutivePropsDestroyed = (this._consecutivePropsDestroyed || 0) + 1;
      this._propComboResetTimer = 14.0;

      // 1 a 4 pequenos props somam calor < 100 (0★); a partir do 5º prop seguido sobe 1★ -> 5★
      if (this.stars === 0 && this._consecutivePropsDestroyed <= 3) {
        this.chaosScore = Math.min(85, this.chaosScore + 14);
      } else if (this.stars === 0 && this._consecutivePropsDestroyed === 4) {
        this.chaosScore = Math.min(85, this.chaosScore + 30);
      } else {
        const propChaos = Math.max(38, Math.min(44, (obj.chaosValue || 10) + 32));
        this.addChaos(propChaos, true);
      }
    }
  },

  addChaos(points, isMajorCrime = false) {
    if (points <= 0) return;
    this.chaosScore = Math.min(1150, this.chaosScore + points);

    if (this.stars > 0 && isMajorCrime) {
      this.isEscaping = false;
      this.escapeTimer = 0;
      this._hasLineOfSight = true;
      this._pursuitEngageGraceTimer = Math.max(this._pursuitEngageGraceTimer, 8.0);
      if (this._lastPlayerPos && (this._lastPlayerPos.x !== 0 || this._lastPlayerPos.z !== 0)) {
        this._lastKnownPlayerPos.copy(this._lastPlayerPos);
      }
    }

    this._recomputeStarsFromChaos();
  },

  setWantedStars(targetStars) {
    const clamped = Math.max(0, Math.min(5, Math.floor(targetStars)));
    if (clamped === 0) {
      this.clearWanted('manual');
      return;
    }
    this.chaosScore = WANTED_STAR_THRESHOLDS[clamped] + 15;
    this._recomputeStarsFromChaos(clamped);
  },

  _recomputeStarsFromChaos(forcedStars = null) {
    let nextStars = this.stars;
    if (forcedStars !== null) {
      nextStars = forcedStars;
    } else {
      for (let s = 5; s >= 1; s--) {
        if (this.chaosScore >= WANTED_STAR_THRESHOLDS[s]) {
          nextStars = Math.max(nextStars, s);
          break;
        }
      }
    }

    if (nextStars > this.stars) {
      const prevStars = this.stars;
      this.stars = nextStars;
      this.isEscaping = false;
      this.escapeTimer = 0;
      this.escapeDuration = this.stars >= 4 ? 25.0 : 18.0;
      this._hasLineOfSight = true;
      this._pursuitEngageGraceTimer = Math.max(this._pursuitEngageGraceTimer, 10.0);
      this._spawnTickTimer = 0;
      if (this._lastPlayerPos && (this._lastPlayerPos.x !== 0 || this._lastPlayerPos.z !== 0)) {
        this._lastKnownPlayerPos.copy(this._lastPlayerPos);
      }

      // Despacha forças policiais imediatamente no frame 0 da nova estrela
      this._spawnImmediateWaveForStars(this._lastPlayerPos);

      soundFX.playCarHorn(0.95, true);
      const tier = WANTED_TIER_INFO[this.stars] || WANTED_TIER_INFO[1];
      this.hud?.updateWantedHud?.(this.stars, false, 0, this.escapeDuration, tier);
      if (prevStars === 0 || this.stars >= 3) {
        this.hud?.showWantedBanner?.(
          `PROCURADO: ${'★'.repeat(this.stars)}`,
          `${tier.label} // ${tier.division}`,
          this.stars >= 5 ? 'antihero' : 'pursuit'
        );
      }
    }
  },

  hasCloseWitnessOnGarageEntry(entryPos, witnessRadius = 28.0) {
    if (this.stars <= 0 || !entryPos) return false;
    const rSq = witnessRadius * witnessRadius;

    for (const pv of this.pursuitVehicles) {
      if (pv.retreating || pv.carObj?.destroyed) continue;
      const pos = pv.carObj.mesh.position;
      const dx = pos.x - entryPos.x;
      const dz = pos.z - entryPos.z;
      if (dx * dx + dz * dz <= rSq && !this._isSegmentBlockedByBuilding(pos.x, pos.z, entryPos.x, entryPos.z)) {
        return true;
      }
    }
    for (const fu of this.footUnits) {
      if (fu.obj?.destroyed) continue;
      const pos = fu.mesh.position;
      const dx = pos.x - entryPos.x;
      const dz = pos.z - entryPos.z;
      if (dx * dx + dz * dz <= rSq && !this._isSegmentBlockedByBuilding(pos.x, pos.z, entryPos.x, entryPos.z)) {
        return true;
      }
    }
    return false;
  },

  clearWantedByPaintJob() {
    if (this.stars <= 0) return false;
    const cleared = this.stars;
    this.clearWanted('paint_job');
    soundFX.playTrueHeroFanfare();
    this.hud?.showWantedBanner?.(
      'PINTURA NOVA // 0 ESTRELAS!',
      `CARRO DISFARÇADO NA LEGO CUSTOMS • ${cleared}★ DESPISTADAS NA HORA!`,
      'escaped'
    );
    return true;
  },

  clearWanted(reason = 'escaped', meta = {}) {
    this.lastClearReason = reason;
    this.stars = 0;
    this.chaosScore = 0;
    this.isEscaping = false;
    this.escapeTimer = 0;
    this._hasLineOfSight = false;
    this._pursuitEngageGraceTimer = 0;
    this._consecutivePropsDestroyed = 0;
    this._propComboResetTimer = 0;

    for (const pv of this.pursuitVehicles) {
      pv.retreating = true;
      pv.retreatLife = 5.5;
      if (pv.strobeRed) pv.strobeRed.material = this.mats.strobeOff;
      if (pv.strobeBlue) pv.strobeBlue.material = this.mats.strobeOff;
    }

    this._clearAllFootUnits();
    this._clearAllRoadblocks();
    this._removeEagleHelicopter();
    this._clearAllHunterDrones();
    this._clearAllEnemyProjectiles();
    if (this.energyCageMesh) {
      this.energyCageMesh.visible = false;
    }

    if (this.livingCity) {
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth?.(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    }

    this.hud?.updateWantedHud?.(0, false, 0, 18, WANTED_TIER_INFO[0]);

    if (reason === 'escaped' && meta.studBonus > 0) {
      soundFX.playTrueHeroFanfare();
      this.hud?.addStuds?.(meta.studBonus, 'blue');
      this.hud?.showWantedBanner?.(
        'FUGA PERFEITA!',
        `POLÍCIA DESPISTADA • BÔNUS DE FUGA +${meta.studBonus.toLocaleString('pt-BR')} STUDS!`,
        'escaped'
      );
    }
  },

  triggerPlayerBusted(controller = null) {
    const bustedStars = Math.max(1, this.stars);
    const currentStuds = this.hud?.totalStuds || 0;
    const fine = Math.min(currentStuds, Math.min(2500, bustedStars * 350));

    if (this.hud && fine > 0) {
      this.hud.totalStuds = Math.max(0, this.hud.totalStuds - fine);
      this.hud.displayedStuds = this.hud.totalStuds;
      if (this.hud.studCountEl) {
        this.hud.studCountEl.textContent = this.hud.totalStuds.toLocaleString('pt-BR');
      }
    }

    this.clearWanted('busted');
    if (reasonNeedsReset(controller)) {
      if (controller.currentVehicle) {
        controller.exitVehicle?.();
      }
      controller.energyNetSlowTimer = 0;
      const spawnX = 0;
      const spawnZ = -88;
      const spawnY = (this.world?.getTerrainHeightAt ? this.world.getTerrainHeightAt(spawnX, spawnZ) : 0) + 0.5;
      controller.position.set(spawnX, spawnY, spawnZ);
      controller.velocity?.set?.(0, 0, 0);
      if (controller.minifigure?.group) {
        controller.minifigure.group.position.copy(controller.position);
      }
    }

    if (this.livingCity) {
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth?.(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    }

    soundFX.playExplosion(0.65);
    this.hud?.showWantedBanner?.(
      'DETIDO!',
      fine > 0
        ? `LIBERADO NA DELEGACIA CENTRAL • FIANÇA: -${fine.toLocaleString('pt-BR')} STUDS`
        : 'LIBERADO NA DELEGACIA CENTRAL • FICHA LIMPA!',
      'busted'
    );
  },

  applyPursuitDamageToPlayer(amount, controller = null) {
    if (this.stars <= 0 || !this.livingCity) return;
    if (this.playerHitIFrameTimer > 0) return;
    if (controller?.rollTimer > 0) return;

    this.playerHitIFrameTimer = 0.35;
    this.timeSinceLastDamage = 0;

    const inVehicleMult = controller?.currentVehicle ? 0.65 : 1.0;
    const finalDmg = Math.max(2, Math.round(amount * inVehicleMult));

    this.livingCity.playerHp = Math.max(0, this.livingCity.playerHp - finalDmg);
    this.hud?.setPlayerHealth?.(this.livingCity.playerHp, this.livingCity.playerMaxHp, false);
    soundFX.playPlasticHit();

    if (this.livingCity.playerHp <= 0) {
      this.triggerPlayerBusted(controller);
    }
  },

  _isPlayerInUndergroundTunnel(playerPos) {
    if (!playerPos) return false;
    if (playerPos.y < -1.85) return true;
    const cutY = getMetroCutoutFloorY(playerPos.x, playerPos.z);
    return cutY !== null && playerPos.y < -1.2;
  },

  _isPlayerUnderViaduct(playerPos) {
    if (!playerPos || !Array.isArray(this.world?.elevatedDecks)) return false;
    for (let i = 0; i < this.world.elevatedDecks.length; i++) {
      const d = this.world.elevatedDecks[i];
      if (
        playerPos.x >= d.minX - 1.5 &&
        playerPos.x <= d.maxX + 1.5 &&
        playerPos.z >= d.minZ - 1.5 &&
        playerPos.z <= d.maxZ + 1.5
      ) {
        const deckTopY = typeof d.getTopY === 'function' ? d.getTopY(playerPos.x, playerPos.z) : (d.topY ?? 11.5);
        if (playerPos.y < deckTopY - 2.6) {
          return true;
        }
      }
    }
    return false;
  },

  _ensureMapBuildingGrid(buildings) {
    if (this._mapBuildingGrid && this._mapBuildingGridLen === buildings.length) {
      return this._mapBuildingGrid;
    }
    const cs = 48;
    const grid = new Map();
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if ((b.height || 10) < 3.2) continue;
      const hw = b.w * 0.5;
      const hd = b.d * 0.5;
      const entry = {
        minX: b.x - hw,
        maxX: b.x + hw,
        minZ: b.z - hd,
        maxZ: b.z + hd,
        _losQid: 0
      };
      const gx0 = Math.floor(entry.minX / cs);
      const gx1 = Math.floor(entry.maxX / cs);
      const gz0 = Math.floor(entry.minZ / cs);
      const gz1 = Math.floor(entry.maxZ / cs);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = ((gx & 0xffff) << 16) | (gz & 0xffff);
          let bucket = grid.get(key);
          if (!bucket) {
            bucket = [];
            grid.set(key, bucket);
          }
          bucket.push(entry);
        }
      }
    }
    this._mapBuildingGrid = grid;
    this._mapBuildingGridLen = buildings.length;
    this._losQueryId = this._losQueryId || 0;
    return grid;
  },

  _isSegmentBlockedByBuilding(ax, az, bx, bz) {
    const buildings = this.world?.mapBuildings;
    if (!Array.isArray(buildings) || buildings.length === 0) return false;
    const grid = this._ensureMapBuildingGrid(buildings);
    const minSegX = Math.min(ax, bx) - 1;
    const maxSegX = Math.max(ax, bx) + 1;
    const minSegZ = Math.min(az, bz) - 1;
    const maxSegZ = Math.max(az, bz) + 1;
    const cs = 48;
    const gx0 = Math.floor(minSegX / cs);
    const gx1 = Math.floor(maxSegX / cs);
    const gz0 = Math.floor(minSegZ / cs);
    const gz1 = Math.floor(maxSegZ / cs);
    const qid = (this._losQueryId = (this._losQueryId || 0) + 1);

    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const bucket = grid.get(((gx & 0xffff) << 16) | (gz & 0xffff));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const b = bucket[i];
          if (b._losQid === qid) continue;
          b._losQid = qid;
          if (b.maxX < minSegX || b.minX > maxSegX || b.maxZ < minSegZ || b.minZ > maxSegZ) continue;
          if (segmentIntersectsRect2D(ax, az, bx, bz, b.minX, b.maxX, b.minZ, b.maxZ)) {
            return true;
          }
        }
      }
    }
    return false;
  },

  _isInsideCoveredGarage(playerPos) {
    return (
      playerPos.x > 40.5 &&
      playerPos.x < 95.5 &&
      playerPos.z > -480.5 &&
      playerPos.z < -427.5 &&
      playerPos.y < 13.5
    );
  },

  _computeLineOfSight(playerPos, controller) {
    if (!playerPos || this.stars <= 0) return false;
    if ((controller?.stealthTimer || 0) > 0) return false;

    const cloudCeiling = this.stars >= 5 ? 235.0 : 185.0;
    if (playerPos.y > cloudCeiling) return false;

    const inUnderground = this._isPlayerInUndergroundTunnel(playerPos);
    const underViaduct = this._isPlayerUnderViaduct(playerPos);
    const insideGarage = this._isInsideCoveredGarage(playerPos);

    if (this._pursuitEngageGraceTimer > 0 && !inUnderground && !underViaduct && !insideGarage) {
      this._lastKnownPlayerPos.copy(playerPos);
      return true;
    }

    let aerialHasLOS = false;
    if (!inUnderground && !underViaduct && !insideGarage) {
      if (this.eagleHeli && !this.eagleHeli.obj?.destroyed) {
        const hPos = this.eagleHeli.mesh.position;
        if (Math.hypot(hPos.x - playerPos.x, hPos.z - playerPos.z) <= 165.0) {
          aerialHasLOS = true;
        }
      }
      if (!aerialHasLOS && this.hunterDrones.length > 0) {
        for (const dr of this.hunterDrones) {
          if (dr.obj?.destroyed) continue;
          if (dr.mesh.position.distanceTo(playerPos) <= 165.0) {
            aerialHasLOS = true;
            break;
          }
        }
      }
    }

    let groundHasLOS = false;
    if (!inUnderground) {
      const inTacticalRefuge = underViaduct || insideGarage;

      for (const pv of this.pursuitVehicles) {
        if (pv.retreating || pv.carObj?.destroyed) continue;
        const vPos = pv.carObj.mesh.position;
        if (Math.abs(vPos.y - playerPos.y) > 18.0) continue;
        const dist = Math.hypot(vPos.x - playerPos.x, vPos.z - playerPos.z);
        if (dist > 145.0) continue;
        if (
          dist <= 16.0 ||
          (!inTacticalRefuge && dist <= 65.0) ||
          !this._isSegmentBlockedByBuilding(vPos.x, vPos.z, playerPos.x, playerPos.z)
        ) {
          groundHasLOS = true;
          break;
        }
      }

      if (!groundHasLOS) {
        for (const fu of this.footUnits) {
          if (fu.obj?.destroyed) continue;
          const fPos = fu.mesh.position;
          if (Math.abs(fPos.y - playerPos.y) > 14.0) continue;
          const dist = Math.hypot(fPos.x - playerPos.x, fPos.z - playerPos.z);
          if (dist > 115.0) continue;
          if (
            dist <= 15.0 ||
            (!inTacticalRefuge && dist <= 65.0) ||
            !this._isSegmentBlockedByBuilding(fPos.x, fPos.z, playerPos.x, playerPos.z)
          ) {
            groundHasLOS = true;
            break;
          }
        }
      }
    }

    if (aerialHasLOS || groundHasLOS) {
      this._lastKnownPlayerPos.copy(playerPos);
      return true;
    }
    return false;
  }
};
