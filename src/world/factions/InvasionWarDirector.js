import * as THREE from 'three';
import { soundFX } from '../../audio/SoundFX.js';
import { buildFactionSquad } from '../events/WaveDirector.js';
import {
  INVASION_RULES,
  FACTION_THEME,
  getTerritoryZoneAt
} from './TerritoryZonesAndConfigs.js';
import { IS_SCALED_WORLD, ws } from '../core/WorldLayoutScale.js';
import {
  unlockDefeatedBossExtra,
  EXTRAS_CATALOG
} from '../../progression/RosterAndUnlocks.js';

// ============================================================================
// DIRETOR DA INVASÃO EM SEQUÊNCIA (P1 -> P2 -> P3 -> CHEFE), RELÓGIO, ANEL
// CONTESTADO, TRANSIÇÃO DE FRONTEIRAS E DESENGAJAMENTO LIMPO NA CIDADE CIVIL
// ============================================================================

export const invasionWarDirectorMethods = {
  _enterInvasionWarMode(zoneKey, playerPos) {
    this._cleanupActiveZoneUnits();
    this.activeZoneId = zoneKey;
    this.activeMode = 'INVASION_1V1';
    this.isInvasionActive = true;

    const st = this.territories[zoneKey];
    if (!st) return;

    const defenderFaction = st.ownerFaction;
    st.bossPhaseTriggered = false;
    st.enemyBossDefeated = false;
    st.enemyBoss = null;
    st.alliedBoss = null;
    st.enemyWaveTimer = 9.5;
    st.alliedWaveTimer = 10.5;
    st.invasionClock = INVASION_RULES.startClock;
    st.reinforceTimer = 7;

    // Invasão em SEQUÊNCIA: P1 -> P2 -> P3 -> Pátio do Chefe
    for (const op of st.outposts) op.ownerFaction = defenderFaction;
    this._syncZone3DColors(zoneKey);
    st.activeIndex = 0;
    st.captureZones.forEach((cz, idx) => {
      cz.reset();
      cz.setActive(idx === 0);
    });

    // Civis próximos da fronteira correm para fora da zona invadida!
    this.livingCity.triggerPedestrianPanicNear(playerPos, 72);
    soundFX.playHeroSwap();

    // Guarnição forte no ponto ativo + vigias nos próximos (a frente de batalha)
    st.outposts.forEach((op, idx) => {
      this._spawnOutpostGarrison(st, op, idx === 0 ? 'full' : 'picket', idx);
    });
    this._refreshInvasionWarzones(st);

    // Comboio de Invasão da SUA FACÇÃO + Reforço Motorizado Inimigo
    this._spawnMotorizedSquad({
      faction: this.playerFaction,
      isAllied: true,
      zoneState: st,
      playerPos
    });
    this._spawnMotorizedSquad({
      faction: defenderFaction,
      isAllied: false,
      zoneState: st,
      playerPos,
      roles: buildFactionSquad(defenderFaction, 0),
      target: st.outposts[0]
    });

    const theme = FACTION_THEME[defenderFaction] || FACTION_THEME.cv;
    this.objectiveHud?.show({
      tag: `INVASÃO // ${theme.shortTag}`,
      title: `CAPTURE ${st.outposts[0]?.name || 'O POSTO'}`,
      accent: theme.color
    });
    this.hud?.showWantedBanner?.(
      `INVASÃO: ${st.spec.title}`,
      'TOME P1 → P2 → P3 E DERROTE O CHEFE',
      'pursuit',
      3400
    );
  },

  /**
   * Guarnição de um posto. 'full' = defesa do ponto ativo; 'picket' = vigias leves.
   */
  _spawnOutpostGarrison(zoneState, op, mode = 'full', tier = 0) {
    const faction = zoneState.ownerFaction;
    const roles =
      mode === 'full'
        ? [
            'rifleman',
            'rifleman',
            'tank',
            'medic',
            ...(tier >= 1 ? ['special'] : []),
            ...(tier >= 2 ? ['special', 'rifleman'] : [])
          ]
        : ['rifleman', 'rifleman'];
    roles.forEach((role, i) => {
      const ang = (i / roles.length) * Math.PI * 2 + tier;
      const rad = role === 'tank' ? 3.2 : 4.6;
      this._spawnCombatUnit({
        faction,
        role,
        x: op.x + Math.cos(ang) * rad,
        z: op.z + Math.sin(ang) * rad,
        outpostId: op.id
      });
    });
  },

  _refreshInvasionWarzones(zoneState) {
    this.activeWarzones.length = 0;
    const op = zoneState.outposts[zoneState.activeIndex];
    if (op) {
      this.activeWarzones.push({ x: op.x, z: op.z, outpostId: op.id });
    } else if (zoneState.bossPhaseTriggered && !zoneState.enemyBossDefeated) {
      const court = zoneState.spec.bossCourtyard;
      this.activeWarzones.push({ x: court.x, z: court.z, outpostId: 'boss_duel' });
    }
  },

  _captureOutpost(zoneState, op, playerPos) {
    if (op.ownerFaction === this.playerFaction) return;
    op.ownerFaction = this.playerFaction;
    op.captureHoldTimer = 0;

    const opIdx = zoneState.outposts.indexOf(op);
    zoneState.captureZones[opIdx]?.markCaptured();

    this._syncZone3DColors(zoneState.id);
    soundFX.playTrueHeroFanfare();

    // Recompensa em Studs no Piso do Outpost
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      this.destructibles.spawnAmbientStud(
        op.x + Math.cos(ang) * 2.5,
        (op.y ?? this._groundAt(op.x, op.z, 1)) + 0.65,
        op.z + Math.sin(ang) * 2.5,
        i % 2 === 0 ? 'blue' : 'gold'
      );
    }

    // Tropas aliadas passam a nascer do posto conquistado
    this._spawnCombatUnit({
      faction: this.playerFaction,
      role: 'rifleman',
      x: op.x - 2.2,
      z: op.z + 2.0,
      outpostId: op.id
    });
    this._spawnCombatUnit({
      faction: this.playerFaction,
      role: 'medic',
      x: op.x + 2.2,
      z: op.z + 2.0,
      outpostId: op.id
    });

    // +1:30 no relógio
    zoneState.invasionClock += INVASION_RULES.clockPerCapture;

    // Próximo objetivo da sequência
    zoneState.activeIndex = opIdx + 1;
    const nextOp = zoneState.outposts[zoneState.activeIndex];

    // RECUO: sobreviventes do posto perdido correm para reforçar o próximo
    const fallback = nextOp || zoneState.spec.bossCourtyard;
    for (const npc of this.combatNpcs) {
      if (npc.isAllied || npc.outpostId !== op.id) continue;
      npc.outpostId = nextOp ? nextOp.id : 'boss_court';
      npc.patrolAnchor = {
        x: fallback.x + (Math.random() - 0.5) * 6,
        z: fallback.z + (Math.random() - 0.5) * 6
      };
      npc.retreating = true;
    }

    if (nextOp) {
      zoneState.captureZones[zoneState.activeIndex]?.setActive(true);
      this._spawnOutpostGarrison(zoneState, nextOp, 'full', zoneState.activeIndex);
      this.objectiveHud?.setTitle(`CAPTURE ${nextOp.name}`);
      this.hud?.showWantedBanner?.(
        `${op.code} CAPTURADO!`,
        `+1:30 // PRÓXIMO: ${nextOp.code}`,
        'escaped',
        2600
      );
    } else {
      // Os 3 postos são seus: o chefe aparece no pátio!
      this._triggerBossClimaxDuel(zoneState, playerPos);
      this.objectiveHud?.setTitle(
        `DERROTE ${FACTION_THEME[zoneState.ownerFaction]?.bossTitle || 'O CHEFE'}`
      );
      this.hud?.showWantedBanner?.(
        'CHEFÃO NO PÁTIO!',
        'OS 3 POSTOS SÃO SEUS // DERRUBE O CHEFE',
        'pursuit',
        3200
      );
    }
    this._refreshInvasionWarzones(zoneState);
  },

  _triggerBossClimaxDuel(zoneState, playerPos) {
    zoneState.bossPhaseTriggered = true;
    const defenderFaction = zoneState.ownerFaction;
    const court = zoneState.spec.bossCourtyard;

    zoneState.enemyBoss = this._spawnCombatUnit({
      faction: defenderFaction,
      role: 'boss',
      x: court.x,
      z: court.z,
      outpostId: 'boss_court'
    });
    // Escolta do chefe
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this._spawnCombatUnit({
        faction: defenderFaction,
        role: i === 0 ? 'special' : 'rifleman',
        x: court.x + Math.cos(a) * 6,
        z: court.z + Math.sin(a) * 6,
        outpostId: 'boss_court'
      });
    }

    // O seu time envia o BOSS COLOSSAL ALIADO para lutar ao seu lado!
    let allyBossX = THREE.MathUtils.lerp(playerPos.x, court.x, 0.35);
    let allyBossZ = THREE.MathUtils.lerp(playerPos.z, court.z, 0.35);
    if (IS_SCALED_WORLD && Math.hypot(allyBossX - court.x, allyBossZ - court.z) > 65) {
      const fallbackSpawn = zoneState.spec.alliedBossSpawn;
      if (fallbackSpawn) {
        allyBossX = fallbackSpawn.x;
        allyBossZ = fallbackSpawn.z;
      }
    }
    zoneState.alliedBoss = this._spawnCombatUnit({
      faction: this.playerFaction,
      role: 'boss',
      x: allyBossX,
      z: allyBossZ
    });
  },

  _conquerTerritory(zoneState, playerPos) {
    zoneState.ownerFaction = this.playerFaction;
    zoneState.conqueredByPlayer = true;
    zoneState.garrisonLevel = 0;
    this.counterAttack.armThreat(zoneState);
    for (const op of zoneState.outposts) {
      op.ownerFaction = this.playerFaction;
    }
    zoneState.captureZones.forEach((cz) => cz.reset());
    this._syncZone3DColors(zoneState.id);
    soundFX.playTrueHeroFanfare();

    // Chuva Gigante Comemorativa de Studs Roxos (10.000) e Dourados (100)!
    const baseY = this._groundAt(playerPos.x, playerPos.z, playerPos.y) + 0.85;
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const rad = 2.4 + (i % 3) * 1.8;
      const tier = i % 3 === 0 ? 'purple' : i % 2 === 0 ? 'blue' : 'gold';
      this.destructibles.spawnAmbientStud(
        playerPos.x + Math.cos(ang) * rad,
        baseY + (i % 4) * 0.35,
        playerPos.z + Math.sin(ang) * rad,
        tier
      );
    }

    const bossRes = unlockDefeatedBossExtra(zoneState.id, this.hud?.unlockedExtras || []);
    if (bossRes.ok && this.hud) {
      this.hud.unlockedExtras = bossRes.unlockedExtras;
    }
    const bossLabel =
      EXTRAS_CATALOG[bossRes.bossKey]?.name?.['pt-BR']?.toUpperCase() ||
      FACTION_THEME[zoneState.id]?.bossTitle ||
      'CHEFE SECRETO';
    const bannerSubtitle = bossRes.ok && bossRes.newlyUnlocked
      ? `${zoneState.spec.title} // ${bossLabel} LIBERADO NA GRADE [TAB]!`
      : `${zoneState.spec.title} // FIQUE DE OLHO: ELES VÃO VOLTAR`;

    this.objectiveHud?.hide();
    this.hud?.showWantedBanner?.(
      'TERRITÓRIO CONQUISTADO!',
      bannerSubtitle,
      'escaped',
      bossRes.newlyUnlocked ? 4600 : 3800
    );

    // Restaura os 4 Corações LEGO, salva a conquista e transforma o território em QG Aliado!
    this.livingCity.playerHp = this.livingCity.playerMaxHp;
    this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    this._enterAllyHqMode(zoneState.id);
    this.onTerritoryConquered?.(zoneState);
    this.hud?.saveCurrentProgress?.();
  },

  /**
   * Invasão falhou (tempo esgotado ou jogador derrubado): volta ao portão e os postos voltam ao dono.
   */
  _failInvasion(
    zoneState,
    title = 'INVASÃO FRACASSADA',
    subtitle = 'A FACÇÃO SEGUROU O TERRITÓRIO'
  ) {
    const controller = this._lastController;
    const exitGate = zoneState?.spec?.safeExitGate || { x: 0, z: ws(-92) };
    const ey = this._groundAt(exitGate.x, exitGate.z, 1) + 0.5;
    if (controller) {
      if (controller.currentVehicle) controller.exitVehicle?.();
      controller.position?.set(exitGate.x, ey, exitGate.z);
      controller.velocity?.set(0, 0, 0);
      if (controller.minifigure?.root && controller.position) {
        controller.minifigure.root.position.copy(controller.position);
      }
    }
    if (zoneState && !zoneState.conqueredByPlayer) {
      for (const op of zoneState.outposts) op.ownerFaction = zoneState.ownerFaction;
      zoneState.captureZones.forEach((cz) => cz.reset());
      this._syncZone3DColors(zoneState.id);
    }
    this.livingCity.playerHp = this.livingCity.playerMaxHp;
    this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    soundFX.playLegoBreak(false);
    this._cleanupActiveZoneUnits();
    this.objectiveHud?.hide();
    this.hud?.showWantedBanner?.(title, subtitle, 'busted', 3200);
    this.activeZoneId = null;
    this.activeMode = 'PEACEFUL_CITY';
    this.isInvasionActive = false;
  },

  // ==========================================================================
  // ATUALIZAÇÃO POR FRAME (60 FPS CRAVADOS)
  // ==========================================================================
  update(dt, playerPos, controller = null) {
    if (!playerPos) return;
    this._animClock += dt;
    if (controller) this._lastController = controller;

    // Anima antenas de radar e giroflex dos 9 Outposts
    for (const st of Object.values(this.territories)) {
      const inThisWar = this.isInvasionActive && this.activeZoneId === st.id;
      for (const op of st.outposts) {
        if (op.dishGroup) {
          op.dishGroup.rotation.y += dt * (inThisWar ? 3.8 : 1.1);
        }
        if (op.sirenBar) {
          op.sirenBar.rotation.y += dt * (inThisWar ? 9.5 : 1.5);
        }
        if (op.spotlightMat) {
          op.spotlightMat.opacity = inThisWar
            ? 0.16 + 0.12 * Math.abs(Math.sin(this._animClock * 6.5))
            : 0.12;
        }
      }
    }

    // Assalto ao Super Banco (roda no Centro, fora dos territórios)
    this.world.superBankData?.update?.(dt);
    this.bankHeist.tick(dt, playerPos);
    if (this.bankHeist.isEngaged) {
      this._updateConvoyDrops(dt);
      this._updateCombatUnitsAndHealBeams(dt, playerPos, controller, this._bankZoneState);
      this._updateProjectilesAndShockwaves(dt, playerPos, controller, this._bankZoneState);
      return;
    }

    // Modo Livre sem facção escolhida -> apenas cidade pacífica
    if (!FACTION_THEME[this.playerFaction]) {
      if (this.activeZoneId) {
        this._cleanupActiveZoneUnits();
        this.activeZoneId = null;
        this.activeMode = 'PEACEFUL_CITY';
        this.isInvasionActive = false;
      }
      return;
    }

    const strictZone = getTerritoryZoneAt(playerPos.x, playerPos.z, 0);
    const hysteresisZone = getTerritoryZoneAt(playerPos.x, playerPos.z, 14);

    if (strictZone) {
      const targetState = this.territories[strictZone.id];
      const shouldBeAllyHq = targetState.ownerFaction === this.playerFaction;
      const ca = this.counterAttack;
      const underAttack = shouldBeAllyHq && ca.isActive && ca.zoneId === strictZone.id;
      const desiredMode = underAttack
        ? 'COUNTER_ATTACK'
        : shouldBeAllyHq
          ? 'ALLY_HQ'
          : 'INVASION_1V1';

      if (this.activeZoneId !== strictZone.id || this.activeMode !== desiredMode) {
        if (desiredMode === 'COUNTER_ATTACK') {
          ca.beginDefense();
        } else if (desiredMode === 'ALLY_HQ') {
          this._enterAllyHqMode(strictZone.id);
        } else {
          this._enterInvasionWarMode(strictZone.id, playerPos);
        }
      }
    } else if (this.activeZoneId && !hysteresisZone) {
      // DESENGAJAMENTO LIMPO AO SAIR DO TERRITÓRIO PARA A CIDADE CIVIL!
      const leftZone = this.territories[this.activeZoneId];
      if (this.isInvasionActive && leftZone && !leftZone.conqueredByPlayer) {
        // Saiu no meio da invasão: postos tomados voltam ao dono
        for (const op of leftZone.outposts) op.ownerFaction = leftZone.ownerFaction;
        leftZone.captureZones.forEach((cz) => cz.reset());
        this._syncZone3DColors(leftZone.id);
      }
      this.objectiveHud?.hide();
      this._cleanupActiveZoneUnits();
      this.activeZoneId = null;
      this.activeMode = 'PEACEFUL_CITY';
      this.isInvasionActive = false;
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
      return;
    }

    this.counterAttack.tick(dt, playerPos);

    if (!this.activeZoneId) return;

    const currentZone = this.territories[this.activeZoneId];
    this._updateConvoyDrops(dt);
    this._updateCombatUnitsAndHealBeams(dt, playerPos, controller, currentZone);
    this._updateProjectilesAndShockwaves(dt, playerPos, controller, currentZone);

    if (this.activeMode === 'INVASION_1V1' && currentZone) {
      this._updateInvasionProgression(dt, playerPos, currentZone);
    }
  },

  _updateInvasionProgression(dt, playerPos, zoneState) {
    let enemyCount = 0;
    let allyCount = 0;
    let hasAlliedMedic = false;
    for (const npc of this.combatNpcs) {
      if (!npc.destructible || npc.destructible.destroyed) continue;
      if (npc.isAllied) {
        allyCount++;
        if (npc.role === 'medic') hasAlliedMedic = true;
      } else {
        enemyCount++;
      }
    }

    // Relógio da invasão
    zoneState.invasionClock -= dt;
    this.objectiveHud?.setTimer(zoneState.invasionClock);
    if (zoneState.invasionClock <= 0) {
      this._failInvasion(
        zoneState,
        'TEMPO ESGOTADO',
        'A FACÇÃO SEGUROU O TERRITÓRIO // TENTE DE NOVO'
      );
      return;
    }

    const activeOp = zoneState.outposts[zoneState.activeIndex];
    if (activeOp) {
      // Conta quem está DENTRO do anel de captura
      const zone = zoneState.captureZones[zoneState.activeIndex];
      let attackers = 0;
      let defenders = 0;
      if (
        zone.isInside(playerPos.x, playerPos.z) &&
        Math.abs(playerPos.y - (activeOp.y ?? playerPos.y)) < 12
      ) {
        attackers++;
      }
      for (const npc of this.combatNpcs) {
        if (!npc.destructible || npc.destructible.destroyed) continue;
        const pos = npc.visual.root.position;
        if (!zone.isInside(pos.x, pos.z)) continue;
        if (npc.isAllied) attackers++;
        else defenders++;
      }
      // O jogador é necessário para iniciar; aliados sozinhos só ajudam se você estiver perto
      const playerNear =
        Math.hypot(playerPos.x - activeOp.x, playerPos.z - activeOp.z) < zone.radius + 18;
      const effectiveAttackers = playerNear ? attackers : 0;
      const done = zone.update(dt, { attackers: effectiveAttackers, defenders });

      const pct = Math.round(zone.progress * 100);
      if (zone.state === 'CONTESTED') {
        this.objectiveHud?.setProgress(zone.progress, 'contested');
        this.objectiveHud?.setStatus(`CONTESTADO ${pct}%`, 'contested');
      } else if (zone.state === 'CAPTURING') {
        this.objectiveHud?.setProgress(zone.progress, 'capture');
        this.objectiveHud?.setStatus(`CAPTURANDO ${pct}%`, 'capture');
      } else {
        this.objectiveHud?.setProgress(zone.progress, 'neutral');
        this.objectiveHud?.setStatus(
          defenders > 0 ? `${defenders} DEFENSORES NO PONTO` : `ENTRE NO ANEL ${activeOp.code}`,
          ''
        );
      }
      this.objectiveHud?.setWave(
        zoneState.activeIndex + 1,
        zoneState.outposts.length + 1,
        'ETAPA'
      );

      if (done) {
        this._captureOutpost(zoneState, activeOp, playerPos);
        if (this.activeMode !== 'INVASION_1V1') return;
      }
    } else if (zoneState.bossPhaseTriggered) {
      const boss = zoneState.enemyBoss;
      const ratio = boss?.destructible
        ? Math.max(0, boss.destructible.hp / (boss.destructible.maxHp || 1550))
        : 0;
      this.objectiveHud?.setProgress(ratio, 'danger');
      this.objectiveHud?.setStatus(`CHEFE ${Math.round(ratio * 100)}%`, 'danger');
      this.objectiveHud?.setWave(
        zoneState.outposts.length + 1,
        zoneState.outposts.length + 1,
        'ETAPA'
      );
      if (zoneState.enemyBossDefeated) {
        this._conquerTerritory(zoneState, playerPos);
        return;
      }
    }

    // Ondas de reforço da facção dona, chegando no PONTO ATIVO (não em você)
    zoneState.reinforceTimer -= dt;
    const enemyCap =
      INVASION_RULES.enemyCapBase + INVASION_RULES.enemyCapPerPoint * zoneState.activeIndex;
    if (zoneState.reinforceTimer <= 0) {
      zoneState.reinforceTimer = INVASION_RULES.reinforceInterval;
      if (enemyCount < enemyCap) {
        const target = activeOp || zoneState.spec.bossCourtyard;
        this._spawnMotorizedSquad({
          faction: zoneState.ownerFaction,
          isAllied: false,
          zoneState,
          playerPos,
          roles: buildFactionSquad(zoneState.ownerFaction, zoneState.activeIndex + 1),
          target
        });
      }
    }

    // Ondas de Reforço do Comboio Aliado (Do portão ou dos Outposts já capturados!)
    zoneState.alliedWaveTimer -= dt;
    if (zoneState.alliedWaveTimer <= 0) {
      zoneState.alliedWaveTimer = 12;
      if (allyCount < 8) {
        const alliedOps = zoneState.outposts.filter((o) => o.ownerFaction === this.playerFaction);
        if (alliedOps.length > 0 && Math.random() < 0.5) {
          const srcOp = alliedOps[alliedOps.length - 1];
          this._spawnCombatUnit({
            faction: this.playerFaction,
            role: hasAlliedMedic ? 'rifleman' : 'medic',
            x: srcOp.x + 2.2,
            z: srcOp.z - 2.0
          });
          this._spawnCombatUnit({
            faction: this.playerFaction,
            role: Math.random() < 0.5 ? 'tank' : 'special',
            x: srcOp.x - 2.2,
            z: srcOp.z + 2.0
          });
        } else {
          this._spawnMotorizedSquad({
            faction: this.playerFaction,
            isAllied: true,
            zoneState,
            playerPos
          });
        }
      }
    }
  }
};
