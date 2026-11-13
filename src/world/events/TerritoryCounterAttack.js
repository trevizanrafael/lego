import * as THREE from 'three';
import { getLegoMaterial, createLegoBrick } from '../../materials/LegoMaterials.js';
import { WaveDirector, WAVE_STATE, buildFactionSquad } from './WaveDirector.js';
import { soundFX } from '../../audio/SoundFX.js';

// ============================================================================
// CONTRA-ATAQUE (estilo "Garden Ops" + "Flag of Power")
// ----------------------------------------------------------------------------
// Território conquistado NÃO é para sempre. De tempos em tempos o dono antigo
// volta para retomar:
//   1. ALERTA: você tem 90s para chegar na Bandeira do QG (pátio do território)
//   2. DEFESA: 5 ondas com 10s de pausa (caixas LEGO de cura/studs na pausa)
//      - Onda 3 = Roleta do Chefe (mini-chefe, esquadrão de elite ou JACKPOT)
//      - Onda 5 = Chefe da facção
//      - Inimigos parados na bandeira sem oposição enchem a barra de POSSE
//   3. RESULTADO: defendeu -> recompensa + guarnição sobe de nível
//                 perdeu (bandeira tomada / você caiu) -> território volta pra facção
//   Se você não aparecer, a guarnição luta sozinha (chance cresce com o nível).
// ============================================================================

export const COUNTER_ATTACK_RULES = {
  threatInterval: 720, // 12 minutos de jogo entre contra-ataques
  firstThreatDelay: 600, // primeiro contra-ataque 10 min após conquistar
  alertWindow: 90,
  flagRadius: 11,
  flagCaptureTime: 14,
  waveBreak: 10,
  maxGarrisonLevel: 3
};

const ROULETTE_OPTIONS = ['MINI-CHEFE', 'ESQUADRÃO DE ELITE', 'JACKPOT DE STUDS'];

export class TerritoryCounterAttack {
  constructor(factionWar) {
    this.fw = factionWar;
    this.phase = 'IDLE'; // IDLE | ALERT | DEFENSE
    this.zoneId = null;
    this.attacker = null;
    this.alertTimer = 0;
    this.flagProgress = 0;
    this.director = null;
    this.flag = null;
    this.crates = [];
    this._rouletteResult = null;
  }

  get isActive() {
    return this.phase !== 'IDLE';
  }

  // --------------------------------------------------------------------------
  // Timers de ameaça
  // --------------------------------------------------------------------------
  armThreat(zoneState, seconds = COUNTER_ATTACK_RULES.firstThreatDelay) {
    zoneState.threatTimer = seconds;
  }

  tick(dt, playerPos) {
    const fw = this.fw;

    if (this.phase === 'IDLE') {
      // Timers só correm quando você NÃO está invadindo nada
      if (fw.isInvasionActive) return;
      for (const st of Object.values(fw.territories)) {
        if (!st.conqueredByPlayer) continue;
        if (st.threatTimer === null || st.threatTimer === undefined) {
          this.armThreat(st);
          continue;
        }
        // Mais rápido quando você está longe do território
        const inside = fw.activeZoneId === st.id;
        st.threatTimer -= dt * (inside ? 0.5 : 1);
        if (st.threatTimer <= 0) {
          this.startAlert(st.id);
          break;
        }
      }
      return;
    }

    if (this.phase === 'ALERT') {
      const st = fw.territories[this.zoneId];
      if (!st || !st.conqueredByPlayer) {
        this._finish();
        return;
      }
      this.alertTimer -= dt;
      fw.objectiveHud?.setTimer(this.alertTimer);
      const court = st.spec.bossCourtyard;
      const dist = Math.hypot(playerPos.x - court.x, playerPos.z - court.z);
      fw.objectiveHud?.setStatus(`BANDEIRA A ${Math.round(dist)}m`, 'danger');
      fw.objectiveHud?.setProgress(1 - this.alertTimer / COUNTER_ATTACK_RULES.alertWindow, 'danger');
      if (this.alertTimer <= 0) {
        this._resolveAbsent(st);
      }
      return;
    }

    if (this.phase === 'DEFENSE') {
      this._updateDefense(dt, playerPos);
    }
  }

  // --------------------------------------------------------------------------
  // Fase 1: ALERTA
  // --------------------------------------------------------------------------
  startAlert(zoneId) {
    const fw = this.fw;
    const st = fw.territories[zoneId];
    if (!st || !st.conqueredByPlayer || this.isActive) return false;
    this.phase = 'ALERT';
    this.zoneId = zoneId;
    this.attacker = st.spec.defaultOwner;
    this.alertTimer = COUNTER_ATTACK_RULES.alertWindow;
    const theme = fw.getFactionTheme(this.attacker);

    soundFX.playRadioAlertSiren?.();
    fw.hud?.showWantedBanner?.(
      `CONTRA-ATAQUE: ${theme.shortTag} VOLTOU!`,
      `${st.spec.title} // CHEGUE NA BANDEIRA EM 90s`,
      'pursuit',
      4200
    );
    fw.objectiveHud?.show({
      tag: `CONTRA-ATAQUE // ${theme.shortTag}`,
      title: `DEFENDA O QG: ${st.spec.title}`,
      accent: theme.color
    });
    fw.objectiveHud?.setWave(null, null);
    this._pushMapMarker(st);

    // Se você já estiver dentro do território, a defesa começa na hora
    if (fw.activeZoneId === zoneId) this.beginDefense();
    return true;
  }

  _pushMapMarker(st) {
    const court = st.spec.bossCourtyard;
    const list = this.fw.activeWarzones;
    if (!list.some((w) => w.outpostId === 'counter_flag')) {
      list.push({ x: court.x, z: court.z, outpostId: 'counter_flag' });
    }
  }

  // --------------------------------------------------------------------------
  // Fase 2: DEFESA EM ONDAS
  // --------------------------------------------------------------------------
  beginDefense() {
    const fw = this.fw;
    const st = fw.territories[this.zoneId];
    if (!st) return;
    this.phase = 'DEFENSE';
    this.flagProgress = 0;

    fw._cleanupActiveZoneUnits();
    fw.activeZoneId = st.id;
    fw.activeMode = 'COUNTER_ATTACK';
    fw.isInvasionActive = true;
    this._pushMapMarker(st);

    const court = st.spec.bossCourtyard;
    this._buildFlag(court, st);

    // Guarnição aliada (cresce com o nível)
    const guards = 2 + st.garrisonLevel * 2;
    for (let i = 0; i < guards; i++) {
      const a = (i / guards) * Math.PI * 2;
      fw._spawnCombatUnit({
        faction: fw.playerFaction,
        role: i === 0 ? 'medic' : i % 3 === 2 ? 'tank' : 'rifleman',
        x: court.x + Math.cos(a) * 5,
        z: court.z + Math.sin(a) * 5,
        patrolAnchor: { x: court.x, z: court.z }
      });
    }

    const f = this.attacker;
    this.director = new WaveDirector({
      breakTime: COUNTER_ATTACK_RULES.waveBreak,
      firstBreak: 5,
      maxAlive: 10 + st.garrisonLevel,
      waves: [
        { roles: buildFactionSquad(f, 0).concat(['rifleman']), label: 'ONDA 1' },
        { roles: buildFactionSquad(f, 1).concat(['rifleman']), label: 'ONDA 2' },
        { roles: [], label: 'ROLETA', roulette: true },
        { roles: buildFactionSquad(f, 3), label: 'ONDA 4' },
        { roles: ['boss', ...buildFactionSquad(f, 2)], label: 'CHEFE', isBoss: true }
      ]
    });
    this.director.onWaveStart = (idx, wave) => this._onWaveStart(idx, wave);
    this.director.onWaveCleared = (idx) => this._onWaveCleared(idx);
    this.director.onAllCleared = () => this._win();
    this.director.start();

    const theme = fw.getFactionTheme(f);
    fw.objectiveHud?.show({
      tag: `CONTRA-ATAQUE // ${theme.shortTag}`,
      title: 'SEGURE A BANDEIRA DO QG',
      accent: theme.color
    });
    fw.objectiveHud?.setTimer(null);
    fw.objectiveHud?.setWave(1, this.director.totalWaves);
  }

  _onWaveStart(idx, wave) {
    const fw = this.fw;
    fw.objectiveHud?.setWave(idx + 1, this.director.totalWaves);
    if (wave.roulette) {
      // Caça-níquel: sorteia o conteúdo da onda 3
      const pick = Math.floor(Math.random() * ROULETTE_OPTIONS.length);
      this._rouletteResult = ROULETTE_OPTIONS[pick];
      fw.objectiveHud?.spinRoulette(ROULETTE_OPTIONS, this._rouletteResult);
      if (pick === 0) {
        wave.roles = ['tank', 'tank', 'special', 'special', 'medic'];
        this.director.pending = [...wave.roles];
      } else if (pick === 1) {
        wave.roles = buildFactionSquad(this.attacker, 4);
        this.director.pending = [...wave.roles];
      } else {
        // JACKPOT: chuva de studs e onda vazia
        this._studRain(14, 'purple');
        this.director.pending = [];
      }
    } else {
      fw.hud?.showWantedBanner?.(wave.isBoss ? 'ONDA FINAL: CHEFÃO!' : `${wave.label}`, 'ELES ESTÃO SUBINDO PARA A BANDEIRA', 'pursuit', 2200);
    }
  }

  _onWaveCleared(idx) {
    // Pausa: 2 caixas LEGO de suprimento perto da bandeira
    if (idx < this.director.totalWaves - 1) {
      this._dropCrates();
      this.fw.hud?.showWantedBanner?.(`ONDA ${idx + 1} LIMPA!`, 'PEGUE AS CAIXAS // 10s DE PAUSA', 'escaped', 2200);
    }
  }

  _spawnAttacker(role) {
    const fw = this.fw;
    const st = fw.territories[this.zoneId];
    const gates = st.spec.gates || [];
    const routes = st.spec.defenderMotorRoutes || [];
    const sources = [...gates.map((g) => ({ x: g.x, z: g.z })), ...routes.map((r) => ({ x: r.startX, z: r.startZ }))];
    const src = sources[Math.floor(Math.random() * sources.length)] || st.spec.bossCourtyard;
    const court = st.spec.bossCourtyard;
    const unit = fw._spawnCombatUnit({
      faction: this.attacker,
      role,
      x: src.x + (Math.random() - 0.5) * 6,
      z: src.z + (Math.random() - 0.5) * 6,
      outpostId: 'counter_flag',
      patrolAnchor: { x: court.x + (Math.random() - 0.5) * 5, z: court.z + (Math.random() - 0.5) * 5 }
    });
    if (unit) {
      unit.isAllied = false;
      unit.retreating = true; // corre até a bandeira
      unit.destructible.isAlliedToPlayer = false;
      unit.visual.allyMarker.visible = false;
    }
    return unit;
  }

  _updateDefense(dt, playerPos) {
    const fw = this.fw;
    const st = fw.territories[this.zoneId];
    if (!st) return this._finish();

    // Saiu do território no meio da defesa: guarnição decide sozinha
    if (fw.activeZoneId !== st.id || fw.activeMode !== 'COUNTER_ATTACK') {
      return this._resolveAbsent(st);
    }

    const requests = this.director.update(dt);
    if (this.phase !== 'DEFENSE' || !this.director) return; // vitória disparada pelo diretor
    for (const role of requests) {
      this.director.register(this._spawnAttacker(role));
    }

    // Posse da bandeira
    const court = st.spec.bossCourtyard;
    const R = COUNTER_ATTACK_RULES.flagRadius;
    let enemies = 0;
    let defenders = Math.hypot(playerPos.x - court.x, playerPos.z - court.z) < R ? 1 : 0;
    for (const npc of fw.combatNpcs) {
      if (!npc.destructible || npc.destructible.destroyed) continue;
      const p = npc.visual.root.position;
      if (Math.hypot(p.x - court.x, p.z - court.z) > R) continue;
      if (npc.isAllied) defenders++;
      else enemies++;
    }
    const rate = dt / COUNTER_ATTACK_RULES.flagCaptureTime;
    if (enemies > 0 && defenders === 0) this.flagProgress = Math.min(1, this.flagProgress + rate);
    else if (defenders > 0 && enemies === 0) this.flagProgress = Math.max(0, this.flagProgress - rate * 0.6);
    this._animateFlag(dt);

    const contested = enemies > 0 && defenders > 0;
    fw.objectiveHud?.setProgress(this.flagProgress, this.flagProgress > 0 ? 'danger' : 'neutral');
    if (this.director.state === WAVE_STATE.BREAK) {
      fw.objectiveHud?.setStatus(`PAUSA ${Math.ceil(this.director.breakRemaining())}s`, 'ok');
    } else if (contested) {
      fw.objectiveHud?.setStatus(`DISPUTA ${Math.round(this.flagProgress * 100)}%`, 'contested');
    } else if (enemies > 0) {
      fw.objectiveHud?.setStatus(`TOMANDO ${Math.round(this.flagProgress * 100)}%`, 'danger');
    } else {
      fw.objectiveHud?.setStatus(`${this.director.aliveCount()} INIMIGOS VIVOS`, '');
    }

    this._updateCrates(dt, playerPos);

    if (this.flagProgress >= 1) this._lose('A BANDEIRA FOI TOMADA');
  }

  // --------------------------------------------------------------------------
  // Resultados
  // --------------------------------------------------------------------------
  _win() {
    const fw = this.fw;
    const st = fw.territories[this.zoneId];
    if (st) {
      st.garrisonLevel = Math.min(COUNTER_ATTACK_RULES.maxGarrisonLevel, (st.garrisonLevel || 0) + 1);
      st.threatTimer = COUNTER_ATTACK_RULES.threatInterval;
      fw.hud?.showWantedBanner?.(
        'CONTRA-ATAQUE REPELIDO!',
        `GUARNIÇÃO NÍVEL ${st.garrisonLevel} // ${st.spec.title} CONTINUA SEU`,
        'escaped',
        4000
      );
    }
    soundFX.playTrueHeroFanfare();
    this._studRain(20, 'purple');
    fw.livingCity.playerHp = fw.livingCity.playerMaxHp;
    fw.hud?.setPlayerHealth?.(fw.livingCity.playerMaxHp, fw.livingCity.playerMaxHp, false);
    const zoneId = this.zoneId;
    this._finish();
    if (st) fw._enterAllyHqMode(zoneId);
    fw.hud?.saveCurrentProgress?.();
  }

  _lose(reason = 'O TERRITÓRIO CAIU') {
    const fw = this.fw;
    const st = fw.territories[this.zoneId];
    const attacker = this.attacker;
    this._finish();
    if (!st) return;
    fw.loseTerritory(st, attacker);
    fw._failInvasion(st, 'TERRITÓRIO PERDIDO!', `${reason} // RETOME COM UMA NOVA INVASÃO`);
    fw.hud?.saveCurrentProgress?.();
  }

  /** Você não apareceu (ou saiu): a guarnição luta sozinha */
  _resolveAbsent(st) {
    const fw = this.fw;
    const chance = Math.min(0.9, 0.35 + 0.18 * (st.garrisonLevel || 0));
    const held = Math.random() < chance;
    const attacker = this.attacker;
    const wasInside = fw.activeMode === 'COUNTER_ATTACK';
    this._finish();
    if (held) {
      st.threatTimer = COUNTER_ATTACK_RULES.threatInterval;
      fw.hud?.showWantedBanner?.('A GUARNIÇÃO SEGUROU!', `${st.spec.title} CONTINUA SEU // DESSA VEZ`, 'escaped', 3600);
    } else {
      fw.loseTerritory(st, attacker);
      fw.hud?.showWantedBanner?.('TERRITÓRIO PERDIDO!', `${st.spec.title} VOLTOU PARA ${fw.getFactionTheme(attacker).shortTag}`, 'busted', 3800);
    }
    if (wasInside) {
      fw._cleanupActiveZoneUnits();
      fw.activeZoneId = null;
      fw.activeMode = 'PEACEFUL_CITY';
      fw.isInvasionActive = false;
    }
    fw.hud?.saveCurrentProgress?.();
    return held;
  }

  _finish() {
    const fw = this.fw;
    this.phase = 'IDLE';
    this.director?.stop();
    this.director = null;
    this._removeFlag();
    for (const c of this.crates) c.mesh.parent?.remove(c.mesh);
    this.crates.length = 0;
    const idx = fw.activeWarzones.findIndex((w) => w.outpostId === 'counter_flag');
    if (idx !== -1) fw.activeWarzones.splice(idx, 1);
    fw.objectiveHud?.hide();
    this.zoneId = null;
  }

  // --------------------------------------------------------------------------
  // Visuais: Bandeira do QG, caixas de suprimento, chuva de studs
  // --------------------------------------------------------------------------
  _buildFlag(court, st) {
    this._removeFlag();
    const fw = this.fw;
    const y = fw._groundAt(court.x, court.z, 2);
    const g = new THREE.Group();
    g.userData.skipStaticMerge = true;
    g.position.set(court.x, y, court.z);

    const base = createLegoBrick(2.4, 0.6, 2.4, 0x262b38, { studStep: 0.6 });
    base.position.y = 0.3;
    g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 10), getLegoMaterial(0xcbd5e1, { metalness: 0.6 }));
    pole.position.y = 4.1;
    g.add(pole);

    const ownMat = new THREE.MeshStandardMaterial({ color: fw.getFactionTheme(fw.playerFaction).hex, roughness: 0.4, side: THREE.DoubleSide });
    this.flagMat = ownMat;
    this.flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6, 8, 2), ownMat);
    this.flagCloth.position.set(1.35, 6.6, 0);
    g.add(this.flagCloth);
    this.flagBaseY = 6.6;

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(COUNTER_ATTACK_RULES.flagRadius - 0.5, COUNTER_ATTACK_RULES.flagRadius, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);

    fw.scene.add(g);
    this.flag = g;
    this._flagClock = 0;
    void st;
  }

  _animateFlag(dt) {
    if (!this.flagCloth) return;
    this._flagClock += dt;
    // A bandeira desce conforme a posse inimiga sobe e muda de cor no fim
    this.flagCloth.position.y = this.flagBaseY - this.flagProgress * 4.6;
    this.flagCloth.rotation.y = Math.sin(this._flagClock * 3) * 0.18;
    const fw = this.fw;
    const own = fw.getFactionTheme(fw.playerFaction).hex;
    const enemy = fw.getFactionTheme(this.attacker).hex;
    this.flagMat.color.setHex(this.flagProgress > 0.5 && Math.sin(this._flagClock * 12) > 0 ? enemy : own);
  }

  _removeFlag() {
    if (this.flag?.parent) this.flag.parent.remove(this.flag);
    this.flag = null;
    this.flagCloth = null;
  }

  _dropCrates() {
    const fw = this.fw;
    const st = fw.territories[this.zoneId];
    if (!st) return;
    const court = st.spec.bossCourtyard;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = court.x + Math.cos(a) * 6;
      const z = court.z + Math.sin(a) * 6;
      const y = fw._groundAt(x, z, 2);
      const crate = createLegoBrick(1.2, 1.0, 1.2, i === 0 ? 0x22c55e : 0xfacc15, { studStep: 0.4 });
      crate.position.set(x, y + 0.5, z);
      crate.userData.skipStaticMerge = true;
      fw.scene.add(crate);
      this.crates.push({ mesh: crate, kind: i === 0 ? 'heal' : 'studs', x, z });
    }
  }

  _updateCrates(dt, playerPos) {
    const fw = this.fw;
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.mesh.rotation.y += dt * 1.5;
      if (Math.hypot(playerPos.x - c.x, playerPos.z - c.z) < 2.4) {
        if (c.kind === 'heal') {
          fw.livingCity.playerHp = fw.livingCity.playerMaxHp;
          fw.hud?.setPlayerHealth?.(fw.livingCity.playerMaxHp, fw.livingCity.playerMaxHp, true);
          soundFX.playHealTick?.();
        } else {
          this._studRain(8, 'blue', c.x, c.z);
        }
        c.mesh.parent?.remove(c.mesh);
        this.crates.splice(i, 1);
      }
    }
  }

  _studRain(count, tier, cx = null, cz = null) {
    const fw = this.fw;
    const st = fw.territories[this.zoneId];
    const court = st?.spec.bossCourtyard || { x: 0, z: 0 };
    const x0 = cx ?? court.x;
    const z0 = cz ?? court.z;
    const y = fw._groundAt(x0, z0, 2) + 0.9;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 1.5 + (i % 3) * 1.4;
      fw.destructibles.spawnAmbientStud(x0 + Math.cos(a) * r, y + (i % 4) * 0.3, z0 + Math.sin(a) * r, i % 3 === 0 ? tier : 'gold');
    }
  }
}
