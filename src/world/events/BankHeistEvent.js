import * as THREE from 'three';
import { getLegoMaterial, getSharedNpcFaceMaterial, SHARED_STUD_GEO } from '../../materials/LegoMaterials.js';
import { createLegoCarMesh, VEHICLE_SPECS } from '../VehicleFleetBuilder.js';
import { soundFX } from '../../audio/SoundFX.js';

// ============================================================================
// 🏦 MEGA ASSALTO AO SUPER BANCO CENTRAL
// ----------------------------------------------------------------------------
// IDLE -> ALARME (cerco na fachada + saguão + técnico plantando C4 no cofre)
//      -> se o C4 completar: COFRE EXPLODE -> FUGA (carregadores de ouro correm
//         para as SUVs, que fogem pela avenida; destrua para recuperar)
//      -> CHEFE (Mestre do Cofre / Barão Vermelho) no saguão
//      -> FIM (recompensa + Bloco Dourado + bandidos presos) -> COOLDOWN
// Quem assalta: uma facção RIVAL da sua (PCC por padrão; se você for PCC, o CV).
// A polícia (BOPE) chega para ajudar você.
// ============================================================================

export const BANK_HEIST_RULES = {
  firstDelay: 360, // primeiro assalto ~6 min depois de entrar no jogo
  cooldownMin: 600,
  cooldownMax: 900,
  engageRadius: 135, // a partir daqui as tropas aparecem
  c4Time: 60, // segundos de técnico encostado no cofre
  techRespawn: 8,
  escapeSpeed: 17,
  escapeEndX: 220
};

export const BANK_LAYOUT = {
  x: 0,
  z: -180,
  floorY: 0.36,
  frontZ: -136,
  vaultDoor: { x: 0, z: -197.2 },
  stairs: [
    { x: -9, z: -131 },
    { x: -3, z: -130.5 },
    { x: 4, z: -131 },
    { x: 10, z: -130.5 }
  ],
  lobby: [
    { x: -16, z: -150 },
    { x: 16, z: -150 },
    { x: -22, z: -166 },
    { x: 22, z: -166 },
    { x: -9, z: -178 },
    { x: 9, z: -178 }
  ],
  hostages: [
    { x: -6, z: -158 },
    { x: -3, z: -160 },
    { x: 3, z: -160 },
    { x: 6, z: -158 },
    { x: -1, z: -163 },
    { x: 2, z: -164 }
  ],
  getaway: [
    { x: -16, z: -114, rotY: Math.PI / 2 },
    { x: 18, z: -114, rotY: Math.PI / 2 }
  ],
  policeArrival: { x: 0, z: -104 },
  escapeZ: -114
};

const HEIST_FACTION_NAMES = {
  pcc: { short: 'PCC', boss: 'MESTRE DO COFRE' },
  cv: { short: 'CV', boss: 'BARÃO VERMELHO' },
  ares: { short: 'A.R.E.S.', boss: 'GENERAL OVERLORD' }
};

export class BankHeistEvent {
  constructor(factionWar) {
    this.fw = factionWar;
    this.state = 'IDLE';
    this.timer = BANK_HEIST_RULES.firstDelay;
    this.robberFaction = 'pcc';
    this.engaged = false;
    this.c4Progress = 0;
    this.techUnit = null;
    this.techRespawnTimer = 0;
    this.robbers = [];
    this.carriers = [];
    this.getawayCars = [];
    this.hostages = [];
    this.boss = null;
    this.bagsRecovered = 0;
    this.bagsEscaped = 0;
    this.arrests = 0;
    this.vaultBlown = false;
    this._sirenClock = 0;
    this.sirens = null;
  }

  get isActive() {
    return this.state !== 'IDLE';
  }

  /** O jogador está perto do banco com o assalto rolando: a guerra roda aqui */
  get isEngaged() {
    return this.isActive && this.engaged;
  }

  pickRobberFaction() {
    const pf = this.fw.playerFaction;
    return pf === 'pcc' ? 'cv' : 'pcc';
  }

  // --------------------------------------------------------------------------
  // Disparo
  // --------------------------------------------------------------------------
  tick(dt, playerPos) {
    if (this.state === 'IDLE') {
      if (this.fw.isInvasionActive || this.fw.counterAttack?.isActive) return;
      this.timer -= dt;
      if (this.timer <= 0) this.start();
      return;
    }
    this._update(dt, playerPos);
  }

  start(robberFaction = null) {
    if (this.isActive) return false;
    this.robberFaction = robberFaction || this.pickRobberFaction();
    this.state = 'ALARM';
    this.engaged = false;
    this.c4Progress = 0;
    this.vaultBlown = false;
    this.bagsRecovered = 0;
    this.bagsEscaped = 0;
    this.arrests = 0;
    this.boss = null;
    this.techUnit = null;
    this.robbers = [];
    this.carriers = [];
    const names = HEIST_FACTION_NAMES[this.robberFaction];
    const theme = this.fw.getFactionTheme(this.robberFaction);

    this._buildSirens();
    this._spawnGetawayCars();
    soundFX.playRadioAlertSiren?.();
    this.fw.hud?.showWantedBanner?.(
      'MEGA ASSALTO AO SUPER BANCO!',
      `${names.short} ESTÁ ARROMBANDO O COFRE // CORRA PARA O CENTRO`,
      'pursuit',
      4200
    );
    this.fw.objectiveHud?.show({
      tag: `ASSALTO // ${names.short}`,
      title: 'IMPEÇA O C4 NO COFRE',
      accent: theme.color
    });
    this.fw.objectiveHud?.setWave(null, null);
    this._setMapMarker(true);
    return true;
  }

  // --------------------------------------------------------------------------
  // Loop
  // --------------------------------------------------------------------------
  _update(dt, playerPos) {
    const fw = this.fw;
    this._sirenClock += dt;
    this._animateSirens();

    const dBank = Math.hypot(playerPos.x - BANK_LAYOUT.x, playerPos.z - (BANK_LAYOUT.z + 30));
    const inRange = dBank < BANK_HEIST_RULES.engageRadius;
    if (inRange && !this.engaged) this._engage();
    else if (!inRange && this.engaged && dBank > BANK_HEIST_RULES.engageRadius + 30) this._disengage();

    if (this.state === 'ALARM') {
      this._updateC4(dt);
      if (this.engaged) this._updateHostages(playerPos);
      const robbersAlive = this._aliveCount(this.robbers);
      if (this.engaged && robbersAlive === 0 && this.c4Progress < 1) {
        this._startBoss('O ASSALTO FOI CONTIDO!');
      } else if (this.c4Progress >= 1) {
        this._blowVault();
      }
      fw.objectiveHud?.setProgress(this.c4Progress, 'danger');
      fw.objectiveHud?.setTimer(BANK_HEIST_RULES.c4Time * (1 - this.c4Progress));
      const techNear = this._techAtVault();
      fw.objectiveHud?.setStatus(
        this.engaged ? (techNear ? `C4 ${Math.round(this.c4Progress * 100)}% // DERRUBE O TÉCNICO` : `${robbersAlive} ASSALTANTES`) : 'CORRA PARA O BANCO',
        techNear ? 'danger' : ''
      );
    } else if (this.state === 'ESCAPE') {
      this._updateEscape(dt);
    } else if (this.state === 'BOSS') {
      const b = this.boss;
      const ratio = b?.destructible ? Math.max(0, b.destructible.hp / (b.destructible.maxHp || 1)) : 0;
      fw.objectiveHud?.setProgress(ratio, 'danger');
      fw.objectiveHud?.setStatus(`CHEFE ${Math.round(ratio * 100)}%`, 'danger');
      fw.objectiveHud?.setTimer(null);
      if (!this.engaged) {
        // Saiu de perto: o chefe foge com o que sobrou
        this._finish(false, this.boss ? 'O CHEFE ESCAPOU' : '');
      } else if (!b || b.destructible.destroyed) {
        this._finish(true);
      }
    }
  }

  // Tropas aparecem quando você chega perto (e somem se você for embora)
  _engage() {
    const fw = this.fw;
    this.engaged = true;
    fw._enterBankHeistMode();
    const f = this.robberFaction;

    if (this.state === 'ALARM') {
      BANK_LAYOUT.stairs.forEach((p, i) => {
        this.robbers.push(this._spawnRobber(i === 1 ? 'special' : i === 2 ? 'tank' : 'rifleman', p.x, p.z));
      });
      BANK_LAYOUT.lobby.forEach((p, i) => {
        this.robbers.push(this._spawnRobber(i === 0 ? 'medic' : i === 3 ? 'tank' : 'rifleman', p.x, p.z));
      });
      this._spawnTech();
      this._spawnHostages();
    } else if (this.state === 'ESCAPE') {
      // Os carregadores já estão na rua
      for (let i = 0; i < 3; i++) this.robbers.push(this._spawnRobber('rifleman', -6 + i * 6, -126));
    } else if (this.state === 'BOSS') {
      this._spawnBossUnit();
    }

    // BOPE chega para ajudar
    for (let i = 0; i < 4; i++) {
      fw._spawnCombatUnit({
        faction: 'bope',
        role: i === 3 ? 'medic' : i === 2 ? 'tank' : 'rifleman',
        x: BANK_LAYOUT.policeArrival.x - 6 + i * 4,
        z: BANK_LAYOUT.policeArrival.z,
        forceAllied: true
      });
    }
    void f;
  }

  _disengage() {
    this.engaged = false;
    this.techUnit = null;
    this._clearHostages();
    this.robbers = [];
    this.carriers = [];
    this.fw._leaveBankHeistMode();
  }

  _spawnRobber(role, x, z, anchor = null) {
    const u = this.fw._spawnCombatUnit({
      faction: this.robberFaction,
      role,
      x,
      z,
      outpostId: 'bank',
      patrolAnchor: anchor || { x, z },
      forceAllied: false
    });
    if (u) u.isBankRobber = true;
    return u;
  }

  _spawnTech() {
    const v = BANK_LAYOUT.vaultDoor;
    this.techUnit = this._spawnRobber('special', v.x - 4, v.z + 10, { x: v.x, z: v.z + 2.4 });
    if (this.techUnit) {
      this.techUnit.retreating = true; // vai direto para a porta do cofre
      this.techUnit.isC4Tech = true;
      this.robbers.push(this.techUnit);
    }
    this.techRespawnTimer = BANK_HEIST_RULES.techRespawn;
  }

  _techAtVault() {
    const t = this.techUnit;
    if (!t || !t.destructible || t.destructible.destroyed) return false;
    const p = t.visual.root.position;
    return Math.hypot(p.x - BANK_LAYOUT.vaultDoor.x, p.z - BANK_LAYOUT.vaultDoor.z) < 5.2;
  }

  _updateC4(dt) {
    if (!this.engaged) {
      // Sem você lá, os assaltantes trabalham em paz
      this.c4Progress = Math.min(1, this.c4Progress + dt / BANK_HEIST_RULES.c4Time);
      return;
    }
    const t = this.techUnit;
    if (this._techAtVault()) {
      // Técnico fica parado plantando
      t.retreating = true;
      t.patrolAnchor = { x: BANK_LAYOUT.vaultDoor.x, z: BANK_LAYOUT.vaultDoor.z + 2.4 };
      this.c4Progress = Math.min(1, this.c4Progress + dt / BANK_HEIST_RULES.c4Time);
    } else if (!t || !t.destructible || t.destructible.destroyed) {
      this.techRespawnTimer -= dt;
      if (this.techRespawnTimer <= 0) {
        this._spawnTech();
        this.fw.hud?.showWantedBanner?.('NOVO TÉCNICO DE C4!', 'ELE ESTÁ INDO PARA O COFRE', 'pursuit', 2000);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Reféns (encoste neles para libertar)
  // --------------------------------------------------------------------------
  _spawnHostages() {
    this._clearHostages();
    const fw = this.fw;
    BANK_LAYOUT.hostages.forEach((p, i) => {
      const mesh = buildHostageMesh(i);
      mesh.position.set(p.x, BANK_LAYOUT.floorY, p.z);
      mesh.rotation.y = Math.PI + (i - 2.5) * 0.25;
      fw.scene.add(mesh);
      this.hostages.push({ mesh, x: p.x, z: p.z, freed: false, runT: 0 });
    });
  }

  _updateHostages(playerPos) {
    for (const h of this.hostages) {
      if (h.freed) {
        // Corre para fora do banco
        h.runT += 0.016;
        h.mesh.position.z += 0.35;
        h.mesh.rotation.y = 0;
        if (h.mesh.position.z > BANK_LAYOUT.frontZ + 8 && h.mesh.parent) h.mesh.parent.remove(h.mesh);
        continue;
      }
      h.mesh.position.y = BANK_LAYOUT.floorY + Math.abs(Math.sin(this._sirenClock * 6 + h.x)) * 0.05;
      if (Math.hypot(playerPos.x - h.x, playerPos.z - h.z) < 2.6) {
        h.freed = true;
        h.mesh.userData.armsUp?.forEach((a) => (a.rotation.x = 0));
        this.fw.destructibles.spawnAmbientStud(h.x, BANK_LAYOUT.floorY + 1, h.z, 'blue');
        soundFX.playStudCollect?.(1000);
        const left = this.hostages.filter((x) => !x.freed).length;
        this.fw.hud?.showWantedBanner?.('REFÉM LIBERTADO!', left > 0 ? `FALTAM ${left}` : 'TODOS OS REFÉNS A SALVO', 'escaped', 1600);
      }
    }
  }

  _clearHostages() {
    for (const h of this.hostages) h.mesh.parent?.remove(h.mesh);
    this.hostages = [];
  }

  // --------------------------------------------------------------------------
  // Cofre explode -> FUGA
  // --------------------------------------------------------------------------
  _blowVault() {
    const fw = this.fw;
    this.vaultBlown = true;
    const door = fw.destructibles.objects?.find((o) => o.type === 'bank_vault_door' && !o.destroyed);
    if (door) {
      fw.destructibles.damageObject(door, 99999, new THREE.Vector3(0, 4, BANK_LAYOUT.vaultDoor.z + 2), false, {});
    }
    soundFX.playExplosion?.(1.4);
    fw.hud?.showWantedBanner?.('O COFRE EXPLODIU!', 'OS CARREGADORES ESTÃO FUGINDO COM O OURO', 'busted', 3200);
    fw.objectiveHud?.setTitle('RECUPERE O OURO // DESTRUA AS SUVs');
    this.state = 'ESCAPE';

    // 3 carregadores com sacos de ouro saem do cofre para as SUVs
    this.carriers = [];
    if (this.engaged) {
      for (let i = 0; i < 3; i++) {
        const car = this.getawayCars[i % this.getawayCars.length];
        const u = this._spawnRobber('rifleman', -3 + i * 3, BANK_LAYOUT.vaultDoor.z - 4, { x: car.x, z: car.z + 3 });
        if (u) {
          u.retreating = true;
          u.goldBag = attachGoldBag(u);
          u.targetCar = car;
          this.carriers.push(u);
          this.robbers.push(u);
        }
      }
    }
    this._escapeTimer = 0;
  }

  _spawnGetawayCars() {
    const fw = this.fw;
    this._removeGetawayCars();
    const theme = fw.getFactionTheme(this.robberFaction);
    const type = this.robberFaction === 'cv' ? 'picape_cv' : this.robberFaction === 'ares' ? 'hover_apc_ares' : 'suv_pcc';
    const spec = VEHICLE_SPECS[type] || VEHICLE_SPECS.suv_pcc;
    for (const g of BANK_LAYOUT.getaway) {
      const mesh = createLegoCarMesh({ x: g.x, z: g.z, rotY: g.rotY, color: theme.hex, roofColor: theme.secondaryHex, type });
      mesh.position.set(g.x, 0.16, g.z);
      mesh.rotation.y = g.rotY;
      mesh.userData.carType = type;
      mesh.userData.carName = `FUGA // ${theme.shortTag}`;
      mesh.userData.vehicleSpec = spec;
      fw.scene.add(mesh);
      const destructible = fw.destructibles.registerDestructible({
        mesh,
        type: 'car',
        hp: Math.round((spec.hp || 300) * 1.6),
        radius: 2.75,
        height: 2.2,
        colliders: [],
        debrisColors: [theme.hex, theme.secondaryHex, 0xfacc15],
        studDrops: { silver: 4, gold: 10, blue: 4, purple: 1 },
        groundY: 0
      });
      destructible.noAutoRespawn = true;
      this.getawayCars.push({ x: g.x, z: g.z, mesh, destructible, loaded: 0, driving: false, gone: false });
    }
  }

  _removeGetawayCars() {
    for (const c of this.getawayCars) {
      if (c.destructible && !c.destructible.destroyed && !c.destructible.isDriven) {
        this.fw.destructibles.unregisterDestructible(c.destructible);
      }
      c.mesh.parent?.remove(c.mesh);
    }
    this.getawayCars = [];
  }

  _updateEscape(dt) {
    const fw = this.fw;
    this._escapeTimer += dt;

    if (!this.engaged) {
      // Sem você lá, eles fogem
      if (this._escapeTimer > 20) {
        this.bagsEscaped = 3;
        this._startBoss(null);
      }
      fw.objectiveHud?.setStatus('ELES ESTÃO FUGINDO!', 'danger');
      return;
    }

    // Carregadores chegando nas SUVs
    for (const u of this.carriers) {
      if (!u || u.boarded) continue;
      if (u.destructible.destroyed) {
        if (!u.bagDropped) {
          u.bagDropped = true;
          this.bagsRecovered++;
          const p = u.visual.root.position;
          for (let i = 0; i < 6; i++) fw.destructibles.spawnAmbientStud(p.x + Math.cos(i) * 1.5, p.y + 1, p.z + Math.sin(i) * 1.5, i % 2 ? 'gold' : 'blue');
          fw.hud?.showWantedBanner?.('SACO DE OURO RECUPERADO!', `${this.bagsRecovered} DE 3`, 'escaped', 1500);
        }
        continue;
      }
      const car = u.targetCar;
      const p = u.visual.root.position;
      if (car && !car.destructible.destroyed && Math.hypot(p.x - car.x, p.z - car.z) < 4.5) {
        u.boarded = true;
        car.loaded++;
        fw.destructibles.unregisterDestructible(u.destructible);
        u.destructible.destroyed = true; // entrou na SUV: sai da luta
        u.visual.root.parent?.remove(u.visual.root);
      }
    }

    // SUVs com ouro arrancam pela avenida
    const carriersPending = this.carriers.filter((u) => !u.boarded && !u.destructible.destroyed).length;
    for (const car of this.getawayCars) {
      if (car.gone) continue;
      if (car.destructible.destroyed) {
        if (car.loaded > 0) {
          this.bagsRecovered += car.loaded;
          fw.hud?.showWantedBanner?.('SUV DE FUGA DESTRUÍDA!', `+${car.loaded} SACO(S) DE OURO RECUPERADO(S)`, 'escaped', 2000);
          const p = car.mesh.position;
          for (let i = 0; i < 10; i++) fw.destructibles.spawnAmbientStud(p.x + Math.cos(i) * 2, 1, p.z + Math.sin(i) * 2, i % 3 ? 'gold' : 'purple');
          car.loaded = 0;
        }
        car.gone = true;
        continue;
      }
      if (!car.driving && car.loaded > 0 && (carriersPending === 0 || this._escapeTimer > 14)) {
        car.driving = true;
      }
      if (car.driving) {
        car.mesh.position.x += BANK_HEIST_RULES.escapeSpeed * dt;
        car.mesh.position.z = THREE.MathUtils.lerp(car.mesh.position.z, BANK_LAYOUT.escapeZ, 0.05);
        car.mesh.rotation.y = Math.PI / 2;
        car.x = car.mesh.position.x;
        car.z = car.mesh.position.z;
        car.destructible.basePos?.copy(car.mesh.position);
        if (car.mesh.position.x > BANK_HEIST_RULES.escapeEndX) {
          this.bagsEscaped += car.loaded;
          car.loaded = 0;
          car.gone = true;
          fw.destructibles.unregisterDestructible(car.destructible);
          car.mesh.parent?.remove(car.mesh);
          fw.hud?.showWantedBanner?.('UMA SUV ESCAPOU!', 'O OURO SE FOI', 'busted', 1800);
        }
      }
    }

    const bagsLeft = 3 - this.bagsRecovered - this.bagsEscaped;
    fw.objectiveHud?.setProgress(this.bagsRecovered / 3, 'capture');
    fw.objectiveHud?.setStatus(`OURO ${this.bagsRecovered}/3 // ${bagsLeft} EM FUGA`, bagsLeft > 0 ? 'danger' : 'ok');
    fw.objectiveHud?.setTimer(null);

    if (bagsLeft <= 0 || this._escapeTimer > 75) {
      this.bagsEscaped += Math.max(0, bagsLeft);
      this._startBoss(null);
    }
  }

  // --------------------------------------------------------------------------
  // Chefe
  // --------------------------------------------------------------------------
  _startBoss(bannerTitle) {
    const fw = this.fw;
    this.state = 'BOSS';
    const names = HEIST_FACTION_NAMES[this.robberFaction];
    fw.objectiveHud?.setTitle(`DERROTE ${names.boss}`);
    fw.hud?.showWantedBanner?.(bannerTitle || `${names.boss} APARECEU!`, `O CHEFE DO ${names.short} ESTÁ NO SAGUÃO`, 'pursuit', 3000);
    if (this.engaged) this._spawnBossUnit();
  }

  _spawnBossUnit() {
    this.boss = this._spawnRobber('boss', 0, -168, { x: 0, z: -160 });
  }

  // --------------------------------------------------------------------------
  // Fim
  // --------------------------------------------------------------------------
  _finish(success, failReason = '') {
    const fw = this.fw;
    const names = HEIST_FACTION_NAMES[this.robberFaction];
    const arrested = this.arrests;
    if (success) {
      const fullStop = !this.vaultBlown;
      const reward = fullStop ? 20 : 8 + this.bagsRecovered * 4;
      const pp = fw._lastController?.position || new THREE.Vector3(0, 0, -150);
      for (let i = 0; i < reward; i++) {
        const a = (i / reward) * Math.PI * 2;
        fw.destructibles.spawnAmbientStud(pp.x + Math.cos(a) * 3, pp.y + 1 + (i % 3) * 0.3, pp.z + Math.sin(a) * 3, i % 2 ? 'purple' : 'blue');
      }
      if (fullStop || this.bagsRecovered >= 2) fw.hud?.addGoldenBrick?.(1);
      soundFX.playTrueHeroFanfare();
      fw.hud?.showWantedBanner?.(
        fullStop ? 'ASSALTO IMPEDIDO!' : 'ASSALTO CONTIDO!',
        `${names.boss} PRESO // ${arrested} BANDIDOS A CAMINHO DA ILHA DA PRISÃO`,
        'escaped',
        4200
      );
    } else {
      fw.hud?.showWantedBanner?.('ASSALTO CONCLUÍDO', failReason || `O ${names.short} FUGIU COM O OURO`, 'busted', 3600);
    }
    this._sendToPrison(arrested + (success ? 1 : 0));

    // Limpeza e cooldown
    this._clearHostages();
    this._removeSirens();
    this._removeGetawayCars();
    this._setMapMarker(false);
    fw.objectiveHud?.hide();
    if (this.engaged) fw._leaveBankHeistMode();
    this.engaged = false;
    this.robbers = [];
    this.carriers = [];
    this.boss = null;
    this.techUnit = null;
    this.state = 'IDLE';
    this.timer = BANK_HEIST_RULES.cooldownMin + Math.random() * (BANK_HEIST_RULES.cooldownMax - BANK_HEIST_RULES.cooldownMin);
    this._restoreVaultDoorLater();
    fw.hud?.saveCurrentProgress?.();
  }

  /** Chamado pelo FactionWarSystem quando um assaltante cai */
  onRobberDefeated(npc) {
    if (!npc?.isBankRobber) return;
    this.arrests++;
  }

  _sendToPrison(count) {
    const data = this.fw.world?.prisonIslandData;
    if (!data || count <= 0) return;
    data.prisonersInCellsCount += count;
    const key = `${this.robberFaction}PrisonersCount`;
    if (key in data) data[key] += count;
    this.fw.world?.prisonRoster?.addPrisoners?.(this.robberFaction, count);
  }

  _restoreVaultDoorLater() {
    // A porta do cofre se reconstrói depois do evento (cooldown)
    const door = this.fw.destructibles.objects?.find((o) => o.type === 'bank_vault_door');
    if (door && door.destroyed && typeof this.fw.destructibles._restoreObject === 'function') {
      this._vaultRestoreTimer = setTimeout(() => {
        if (door.destroyed) this.fw.destructibles._restoreObject(door);
      }, 60000);
      this._vaultRestoreTimer?.unref?.();
    }
  }

  _aliveCount(list) {
    let n = 0;
    for (const u of list) if (u && u.destructible && !u.destructible.destroyed) n++;
    return n;
  }

  _setMapMarker(on) {
    const list = this.fw.activeWarzones;
    const idx = list.findIndex((w) => w.outpostId === 'bank_heist');
    if (on && idx === -1) list.push({ x: BANK_LAYOUT.x, z: BANK_LAYOUT.frontZ - 10, outpostId: 'bank_heist' });
    if (!on && idx !== -1) list.splice(idx, 1);
  }

  // --------------------------------------------------------------------------
  // Sirenes vermelhas na fachada
  // --------------------------------------------------------------------------
  _buildSirens() {
    this._removeSirens();
    const g = new THREE.Group();
    g.userData.skipStaticMerge = true;
    this.sirenMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const geo = new THREE.BoxGeometry(1.4, 0.8, 0.8);
    for (const x of [-13.5, 13.5]) {
      const m = new THREE.Mesh(geo, this.sirenMat);
      m.position.set(x, 12, BANK_LAYOUT.frontZ + 1.2);
      g.add(m);
    }
    for (const x of [-6, 6]) {
      const m = new THREE.Mesh(geo, this.sirenMat);
      m.position.set(x, 9.6, BANK_LAYOUT.vaultDoor.z + 6);
      g.add(m);
    }
    this.fw.scene.add(g);
    this.sirens = g;
  }

  _animateSirens() {
    if (!this.sirenMat) return;
    const on = Math.sin(this._sirenClock * 9) > 0;
    this.sirenMat.color.setHex(on ? 0xef4444 : 0x450a0a);
    if (this.sirens) this.sirens.children.forEach((m, i) => (m.rotation.y = this._sirenClock * 6 + i));
  }

  _removeSirens() {
    this.sirens?.parent?.remove(this.sirens);
    this.sirens = null;
    this.sirenMat = null;
  }
}

// ----------------------------------------------------------------------------
// Visuais auxiliares
// ----------------------------------------------------------------------------
const HOSTAGE_COLORS = [0x2563eb, 0x16a34a, 0xf97316, 0xdb2777, 0x0891b2, 0x9333ea];
const HOSTAGE_HEAD_GEO = (() => {
  const g = new THREE.CylinderGeometry(0.27, 0.27, 0.5, 18);
  g.rotateY(Math.PI);
  return g;
})();

/** Civil LEGO sentado no chão com as mãos para cima */
export function buildHostageMesh(i = 0) {
  const g = new THREE.Group();
  g.userData.skipStaticMerge = true;
  const shirt = getLegoMaterial(HOSTAGE_COLORS[i % HOSTAGE_COLORS.length]);
  const pants = getLegoMaterial(i % 2 ? 0x1e3a8a : 0x374151);
  const skin = getLegoMaterial(0xfacc15);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.76, 0.44), shirt);
  torso.position.y = 0.78;
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.44), pants);
  hips.position.y = 0.3;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.7), pants);
  legs.position.set(0, 0.14, 0.3);
  const head = new THREE.Mesh(HOSTAGE_HEAD_GEO, getSharedNpcFaceMaterial('civ_panic'));
  head.position.y = 1.43;
  const stud = new THREE.Mesh(SHARED_STUD_GEO, skin);
  stud.position.y = 1.68;
  g.add(torso, hips, legs, head, stud);

  const armsUp = [];
  for (const sx of [-0.52, 0.52]) {
    const arm = new THREE.Group();
    arm.position.set(sx, 1.06, 0);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 8), shirt);
    a.position.y = 0.28;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), skin);
    hand.position.y = 0.62;
    arm.add(a, hand);
    arm.rotation.z = sx > 0 ? -0.25 : 0.25;
    g.add(arm);
    armsUp.push(arm);
  }
  g.userData.armsUp = armsUp;
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

const BAG_MAT = getLegoMaterial(0xfacc15, { metalness: 0.5, roughness: 0.2 });
const BAG_GEO = new THREE.SphereGeometry(0.42, 12, 10);

function attachGoldBag(npc) {
  const bag = new THREE.Mesh(BAG_GEO, BAG_MAT);
  bag.scale.set(1, 1.15, 0.8);
  bag.position.set(0, 1.3, -0.52);
  const knot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.2, 8), getLegoMaterial(0x92400e));
  knot.position.y = 0.5;
  bag.add(knot);
  npc.visual.root.add(bag);
  return bag;
}
