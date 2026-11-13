import * as THREE from 'three';
import { BANK_SPEC } from '../regions/SuperBankBuilder.js';
import { soundFX } from '../../audio/SoundFX.js';

// ============================================================================
// 🏦 ASSALTO AO SUPER BANCO (você é o assaltante)
// ----------------------------------------------------------------------------
// Entre no banco (a pé ou com o carro da sua facção) e o assalto começa:
//   1º andar — Seguranças do banco (fracos)
//   2º andar — Polícia Federal (médios, com escudeiros)
//   3º andar — Os MONSTRÕES do BOPE (Big-Figs blindados, pancada no chão)
//   4º andar — 3 Elites do BOPE que atiram sem parar, na frente do COFRE
// Cada andar fica trancado (portão na rampa + elevador bloqueado) até você
// limpar o andar de baixo. A cada andar limpo chega reforço do SEU time (que
// também morre). Limpo o 4º, o cofre abre: pegue o ouro e FUJA DA POLÍCIA.
// ============================================================================

export const BANK_HEIST_RULES = {
  cooldown: 300, // 5 min entre assaltos
  retryCooldown: 20, // depois de cair / abortar
  abortDistance: 40, // sair tão longe do banco aborta o assalto
  grabRadius: 4.2,
  escapeStars: 4,
  escapeTimeout: 300
};

export const BANK_FLOOR_PLAN = [
  {
    name: '1º ANDAR // SEGURANÇAS',
    faction: 'guard',
    units: [
      ['rifleman', -40, -165], ['rifleman', 40, -165], ['rifleman', -10, -188],
      ['rifleman', 10, -188], ['tank', 0, -172], ['rifleman', -30, -210],
      ['rifleman', 30, -210], ['tank', -50, -190]
    ]
  },
  {
    name: '2º ANDAR // POLÍCIA FEDERAL',
    faction: 'pf',
    units: [
      ['rifleman', -32, -162], ['rifleman', 32, -162], ['tank', 0, -175],
      ['rifleman', -24, -190], ['rifleman', 24, -190], ['medic', 0, -200],
      ['tank', 40, -212], ['rifleman', -40, -214], ['rifleman', 52, -170]
    ]
  },
  {
    name: '3º ANDAR // OS MONSTRÕES',
    faction: 'bope',
    units: [['brute', -30, -172], ['brute', 30, -172], ['brute', -16, -208], ['brute', 16, -208]]
  },
  {
    name: '4º ANDAR // ELITE DO COFRE',
    faction: 'bope',
    units: [['elite', -22, -196], ['elite', 0, -199], ['elite', 22, -196]]
  }
];

// Onde o reforço do seu time aparece em cada andar (chegada da rampa / elevador)
const ALLY_ARRIVAL = [
  { x: 0, z: -144 }, // 1º: porta da frente
  { x: -60, z: -200 }, // 2º: topo da R1
  { x: 58, z: -140.5 }, // 3º: topo da R2
  { x: -60, z: -200 } // 4º: topo da R3
];

export class BankHeistEvent {
  constructor(factionWar) {
    this.fw = factionWar;
    this.state = 'IDLE'; // IDLE | FLOORS | VAULT | ESCAPE
    this.timer = 0; // cooldown até poder assaltar de novo
    this.floor = 0; // andar atual sendo limpo (0..3)
    this.defenders = [];
    this.escapeTime = 0;
    this.lootTaken = false;
  }

  get isActive() {
    return this.state !== 'IDLE';
  }

  /** O combate dentro do banco está rolando (a guerra roda aqui) */
  get isEngaged() {
    return this.state === 'FLOORS' || this.state === 'VAULT';
  }

  get bank() {
    return this.fw.world?.superBankData || null;
  }

  // --------------------------------------------------------------------------
  // Loop
  // --------------------------------------------------------------------------
  tick(dt, playerPos) {
    const bank = this.bank;
    if (!bank) return;

    if (this.state === 'IDLE') {
      if (this.timer > 0) this.timer -= dt;
      const factionOk = Boolean(this.fw.getFactionTheme && this.fw.playerFaction && this.fw.playerFaction !== 'free_roam');
      if (
        this.timer <= 0 &&
        factionOk &&
        !this.fw.isInvasionActive &&
        !this.fw.counterAttack?.isActive &&
        bank.isInside(playerPos.x, playerPos.y, playerPos.z) &&
        bank.floorAt(playerPos.y) === 0
      ) {
        this.start();
      }
      return;
    }

    if (this.state === 'ESCAPE') {
      this._updateEscape(dt);
      return;
    }

    // Saiu do banco no meio do assalto: aborta
    const S = BANK_SPEC;
    const outX = Math.max(0, Math.abs(playerPos.x) - S.maxX);
    const outZ = Math.max(0, playerPos.z - S.frontZ, S.backZ - playerPos.z);
    if (Math.hypot(outX, outZ) > BANK_HEIST_RULES.abortDistance) {
      this._abort('ASSALTO ABORTADO', 'VOCÊ SAIU DO BANCO');
      return;
    }

    if (this.state === 'FLOORS') this._updateFloors(playerPos);
    else if (this.state === 'VAULT') this._updateVault(playerPos);
  }

  start() {
    const fw = this.fw;
    const bank = this.bank;
    if (!bank || this.isActive) return false;
    this.state = 'FLOORS';
    this.floor = 0;
    this.lootTaken = false;
    this.defenders = [];

    fw._enterBankHeistMode();
    bank.setAllGates(false);
    this._restoreVaultDoor();
    if (fw.world.bankElevator) {
      fw.world.bankElevator.canTravel = (from, to) => this._elevatorBlock(from, to);
    }

    const theme = fw.getFactionTheme(fw.playerFaction);
    soundFX.playRadioAlertSiren?.();
    fw.hud?.showWantedBanner?.('ASSALTO AO SUPER BANCO!', 'LIMPE ANDAR POR ANDAR ATÉ O COFRE NO 4º', 'pursuit', 3800);
    fw.objectiveHud?.show({ tag: `ASSALTO // ${theme.shortTag}`, title: BANK_FLOOR_PLAN[0].name, accent: theme.color });
    fw.objectiveHud?.setTimer(null);

    this._spawnFloor(0);
    this._spawnAllies(0, 3);
    this._refreshHud();
    return true;
  }

  // --------------------------------------------------------------------------
  // Andares
  // --------------------------------------------------------------------------
  _spawnFloor(idx) {
    const plan = BANK_FLOOR_PLAN[idx];
    if (!plan) return;
    const y = BANK_SPEC.floors[idx];
    for (const [role, x, z] of plan.units) {
      const u = this.fw._spawnCombatUnit({
        faction: plan.faction,
        role,
        x,
        z,
        y,
        outpostId: `bank_f${idx}`,
        forceAllied: false
      });
      if (u) {
        u.bankFloor = idx;
        this.defenders.push(u);
      }
    }
  }

  _spawnAllies(floorIdx, count) {
    const fw = this.fw;
    const a = ALLY_ARRIVAL[floorIdx];
    const y = BANK_SPEC.floors[floorIdx];
    const roles = ['rifleman', 'tank', 'medic', 'special', 'rifleman'];
    for (let i = 0; i < count; i++) {
      fw._spawnCombatUnit({
        faction: fw.playerFaction,
        role: roles[i % roles.length],
        x: a.x + (i - (count - 1) / 2) * 2.6,
        z: a.z,
        y,
        forceAllied: true
      });
    }
  }

  _aliveOnFloor(idx) {
    let n = 0;
    for (const u of this.defenders) {
      if (u.bankFloor === idx && u.destructible && !u.destructible.destroyed) n++;
    }
    return n;
  }

  _updateFloors() {
    const fw = this.fw;
    const alive = this._aliveOnFloor(this.floor);
    if (alive > 0) {
      this._refreshHud(alive);
      return;
    }

    // Andar limpo!
    const cleared = this.floor;
    if (cleared >= BANK_FLOOR_PLAN.length - 1) {
      this._openVault();
      return;
    }
    this.bank.setGateOpen(cleared, true);
    this.floor = cleared + 1;
    this._spawnFloor(this.floor);
    // Reforço do seu time chega no próximo andar (mais gente quanto mais alto)
    this._spawnAllies(this.floor, 3 + Math.min(2, this.floor));
    soundFX.playTrueHeroFanfare();
    fw.hud?.showWantedBanner?.(
      'ANDAR LIMPO!',
      `SUBA PELA RAMPA OU ELEVADOR [E] // REFORÇO NO ${this.floor + 1}º ANDAR`,
      'escaped',
      2800
    );
    fw.objectiveHud?.setTitle(BANK_FLOOR_PLAN[this.floor].name);
    this._refreshHud();
  }

  _refreshHud(alive = null) {
    const fw = this.fw;
    const total = BANK_FLOOR_PLAN[this.floor]?.units.length || 1;
    const left = alive ?? this._aliveOnFloor(this.floor);
    fw.objectiveHud?.setWave(this.floor + 1, 4, 'ANDAR');
    fw.objectiveHud?.setProgress(1 - left / total, 'capture');
    fw.objectiveHud?.setStatus(`${left} INIMIGOS NO ANDAR`, left > 0 ? 'danger' : 'ok');
  }

  _elevatorBlock(from, to) {
    if (!this.isEngaged) return null;
    if (to > this.floor) return `LIMPE O ${this.floor + 1}º ANDAR PRIMEIRO`;
    void from;
    return null;
  }

  // --------------------------------------------------------------------------
  // Cofre
  // --------------------------------------------------------------------------
  _openVault() {
    const fw = this.fw;
    this.state = 'VAULT';
    const door = this.bank.vaultDoor;
    if (door && !door.destroyed) {
      fw.destructibles.damageObject(door, 99999, new THREE.Vector3(0, BANK_SPEC.floors[3] + 5, BANK_SPEC.vaultWallZ + 3), false, {});
    }
    soundFX.playExplosion?.(1.3);
    fw.hud?.showWantedBanner?.('O COFRE ABRIU!', 'ENTRE E PEGUE O OURO NO PEDESTAL', 'escaped', 3000);
    fw.objectiveHud?.setTitle('PEGUE O OURO DO COFRE');
    fw.objectiveHud?.setProgress(1, 'capture');
    fw.objectiveHud?.setStatus('COFRE ABERTO', 'ok');
  }

  _updateVault(playerPos) {
    const g = this.bank.goldPile;
    if (Math.abs(playerPos.y - g.y) < 3 && Math.hypot(playerPos.x - g.x, playerPos.z - g.z) < BANK_HEIST_RULES.grabRadius) {
      this._grabLoot(playerPos);
    }
  }

  _grabLoot(playerPos) {
    const fw = this.fw;
    this.lootTaken = true;
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const r = 1.5 + (i % 3) * 1.2;
      fw.destructibles.spawnAmbientStud(
        playerPos.x + Math.cos(a) * r,
        playerPos.y + 0.9 + (i % 4) * 0.3,
        playerPos.z + Math.sin(a) * r,
        i % 3 === 0 ? 'purple' : 'blue'
      );
    }
    fw.hud?.addGoldenBrick?.(1);
    soundFX.playTrueHeroFanfare();

    // Fuga: libera o banco e coloca a polícia atrás de você
    this.state = 'ESCAPE';
    this.escapeTime = 0;
    fw._leaveBankHeistMode();
    this.bank.setAllGates(true);
    if (fw.world.bankElevator) fw.world.bankElevator.canTravel = null;
    const wanted = fw.livingCity?.wantedSystem;
    if (wanted) {
      wanted.lastClearReason = null;
      wanted.setWantedStars(BANK_HEIST_RULES.escapeStars);
    }
    fw.hud?.showWantedBanner?.('OURO NA MÃO! FUJA!', `${BANK_HEIST_RULES.escapeStars} ESTRELAS // DESPISTE A POLÍCIA`, 'pursuit', 3600);
    fw.objectiveHud?.setTitle('DESPISTE A POLÍCIA');
    fw.objectiveHud?.setWave(null, null);
  }

  _updateEscape(dt) {
    const fw = this.fw;
    this.escapeTime += dt;
    const wanted = fw.livingCity?.wantedSystem;
    const stars = wanted?.stars ?? 0;
    fw.objectiveHud?.setStatus(stars > 0 ? `${stars} ESTRELAS` : 'LIVRE', stars > 0 ? 'danger' : 'ok');
    fw.objectiveHud?.setProgress(stars / 5, 'danger');
    if (stars > 0 && this.escapeTime < BANK_HEIST_RULES.escapeTimeout) return;
    if (stars > 0) {
      // Tempo esgotado sem resolver a perseguição: encerra o evento sem bônus
      this._finish(BANK_HEIST_RULES.cooldown);
      return;
    }

    const busted = wanted?.lastClearReason === 'busted';
    if (busted) {
      fw.hud?.showWantedBanner?.('PEGO NA FUGA!', 'A POLÍCIA RECUPEROU PARTE DO OURO', 'busted', 3200);
    } else {
      fw.hud?.addStuds?.(25000, 'purple');
      fw.hud?.showWantedBanner?.('ASSALTO PERFEITO!', 'VOCÊ FUGIU COM O OURO DO SUPER BANCO // +25.000 STUDS', 'escaped', 4200);
      soundFX.playTrueHeroFanfare();
    }
    this._finish(BANK_HEIST_RULES.cooldown);
  }

  // --------------------------------------------------------------------------
  // Fim / aborto
  // --------------------------------------------------------------------------
  onPlayerDown() {
    this._abort('VOCÊ CAIU!', 'O ASSALTO FRACASSOU // TENTE DE NOVO');
  }

  _abort(title, sub) {
    this.fw.hud?.showWantedBanner?.(title, sub, 'busted', 3000);
    this._finish(BANK_HEIST_RULES.retryCooldown);
  }

  _finish(cooldown) {
    const fw = this.fw;
    const wasEngaged = this.isEngaged;
    this.state = 'IDLE';
    this.timer = cooldown;
    this.defenders = [];
    this.floor = 0;
    if (wasEngaged) fw._leaveBankHeistMode();
    this.bank?.setAllGates(true);
    if (fw.world.bankElevator) fw.world.bankElevator.canTravel = null;
    fw.objectiveHud?.hide();
    fw.hud?.saveCurrentProgress?.();
  }

  _restoreVaultDoor() {
    const door = this.bank?.vaultDoor;
    if (door && door.destroyed && typeof this.fw.destructibles._restoreObject === 'function') {
      this.fw.destructibles._restoreObject(door);
    }
  }
}
