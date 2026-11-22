import { soundFX } from '../../audio/SoundFX.js';
import { WANTED_STAR_THRESHOLDS, WANTED_TIER_INFO } from './PolicePursuitAssets.js';
import {
  PURSUIT_STATES,
  SEARCH_DURATION_BY_STAR,
  WITNESS_TUNING,
  getSearchDurationForStars
} from './PursuitTuning.js';

/**
 * PursuitStateMachine.js
 * Máquina de Estados estilo GTA V (`CLEAN / ALERT / PURSUIT / SEARCH`),
 * cronômetro estrito de busca por estrela (`25 / 40 / 55 / 70 / 85s`) com
 * reset imediato para zero ao ser reavistado, chamada de testemunha (`ALERT`)
 * e truque tático de troca de operador/máscara fora de visão em `1★–2★`.
 */

export function syncPursuitStateFlags(sys, nextState) {
  if (!sys) return;
  sys.pursuitState = nextState;
  sys.isEscaping = nextState === PURSUIT_STATES.SEARCH;
  if (nextState === PURSUIT_STATES.CLEAN || nextState === PURSUIT_STATES.ALERT) {
    sys._hasLineOfSight = false;
    sys.escapeTimer = 0;
  } else if (nextState === PURSUIT_STATES.PURSUIT) {
    sys._hasLineOfSight = true;
    sys.escapeTimer = 0;
  } else if (nextState === PURSUIT_STATES.SEARCH) {
    sys._hasLineOfSight = false;
  }
}

/**
 * Atualiza a janela `ALERT` (4–8s de ligação para o 190 antes de virar `PURSUIT`).
 */
export function tickWitnessAlert(sys, dt) {
  if (!sys || sys.stars > 0 || sys.pursuitState !== PURSUIT_STATES.ALERT) return false;
  if ((sys._witnessAlertTimer || 0) <= 0) {
    syncPursuitStateFlags(sys, PURSUIT_STATES.CLEAN);
    return false;
  }

  sys._witnessAlertTimer = Math.max(0, sys._witnessAlertTimer - dt);
  if (sys._witnessAlertTimer <= 0) {
    const points = Math.max(100, sys._pendingWitnessChaos || 105);
    const crimePos = sys._witnessCrimePos;
    sys._pendingWitnessChaos = 0;
    sys._witnessCrimePos = null;
    if (crimePos && sys._lastKnownPlayerPos) {
      sys._lastKnownPlayerPos.set(crimePos.x, crimePos.y || 0, crimePos.z);
    }
    sys.addChaos?.(points, true);
    return true;
  }
  return false;
}

/**
 * Loop principal de transição `PURSUIT <-> SEARCH`, contagem de evasão por estrela
 * (`25 / 40 / 55 / 70 / 85s`), reset instantâneo ao ser reavistado e sincronização da HUD.
 */
export function tickPursuitStateMachineAndHud(sys, dt, playerPos, controller) {
  if (!sys || sys.stars <= 0) {
    if (sys && sys.pursuitState !== PURSUIT_STATES.ALERT) {
      syncPursuitStateFlags(sys, PURSUIT_STATES.CLEAN);
    }
    return false;
  }

  const forceImmediate = dt >= 0.25;
  const anyUnitSeesPlayer = sys._computeLineOfSight(playerPos, controller, {
    dt,
    forceImmediate
  });

  sys._hasLineOfSight = anyUnitSeesPlayer;
  sys.escapeDuration = getSearchDurationForStars(sys.stars);

  if (anyUnitSeesPlayer) {
    syncPursuitStateFlags(sys, PURSUIT_STATES.PURSUIT);
    if (playerPos && sys._lastKnownPlayerPos) {
      sys._lastKnownPlayerPos.copy(playerPos);
    }
  } else {
    syncPursuitStateFlags(sys, PURSUIT_STATES.SEARCH);
    sys.escapeTimer += dt;
    if (sys.escapeTimer >= sys.escapeDuration) {
      const escapedStars = sys.stars;
      const studBonus = escapedStars * 1500;
      sys.clearWanted('escaped', { studBonus, escapedStars });
      return true;
    }
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

export const pursuitStateMachineMethods = {
  getPursuitState() {
    if (!this.pursuitState) {
      this.pursuitState =
        this.stars > 0
          ? this.isEscaping
            ? PURSUIT_STATES.SEARCH
            : PURSUIT_STATES.PURSUIT
          : PURSUIT_STATES.CLEAN;
    }
    return this.pursuitState;
  },

  getEscapeDurationForStars(stars = this.stars) {
    return getSearchDurationForStars(stars);
  },

  enterPursuitState(playerPos = null) {
    syncPursuitStateFlags(this, PURSUIT_STATES.PURSUIT);
    this.escapeDuration = getSearchDurationForStars(this.stars);
    this._pursuitEngageGraceTimer = 0;
    if (playerPos && (playerPos.x !== 0 || playerPos.z !== 0) && this._lastKnownPlayerPos) {
      this._lastKnownPlayerPos.copy(playerPos);
    }
  },

  enterSearchState() {
    if (this.stars <= 0) return;
    syncPursuitStateFlags(this, PURSUIT_STATES.SEARCH);
    this.escapeDuration = getSearchDurationForStars(this.stars);
  },

  triggerWitnessAlert(crimePos, chaosPoints = 105, delaySec = null) {
    if (this.stars > 0) return false;
    const span = WITNESS_TUNING.callDelayMaxSec - WITNESS_TUNING.callDelayMinSec;
    this._witnessAlertTimer =
      typeof delaySec === 'number'
        ? Math.max(0.1, delaySec)
        : WITNESS_TUNING.callDelayMinSec + Math.random() * span;
    this._pendingWitnessChaos = chaosPoints;
    this._witnessCrimePos = crimePos
      ? { x: crimePos.x, y: crimePos.y || 0, z: crimePos.z }
      : null;
    syncPursuitStateFlags(this, PURSUIT_STATES.ALERT);
    return true;
  },

  cancelWitnessAlert() {
    if (this.pursuitState !== PURSUIT_STATES.ALERT) return false;
    this._witnessAlertTimer = 0;
    this._pendingWitnessChaos = 0;
    this._witnessCrimePos = null;
    syncPursuitStateFlags(this, PURSUIT_STATES.CLEAN);
    return true;
  },

  tickWitnessAlert(dt) {
    return tickWitnessAlert(this, dt);
  },

  /**
   * Truque GTA V de Máscara / Troca de Operador:
   * Em 1★ ou 2★, enquanto oculto em `SEARCH` (`!_hasLineOfSight`) e no máximo 1x por perseguição,
   * trocar de operador reduz imediatamente 1★ (1★ -> limpa ficha com bônus; 2★ -> cai para 1★ / 25s).
   */
  notifyPlayerOperatorSwapped(newCharKey = null) {
    const currentState = this.getPursuitState();
    if (this.stars < 1 || this.stars > 2) return false;
    if (currentState !== PURSUIT_STATES.SEARCH || this._hasLineOfSight) return false;
    if (this._usedDisguiseThisPursuit) return false;

    this._usedDisguiseThisPursuit = true;
    this._lastDisguiseCharKey = newCharKey;

    if (this.stars === 1) {
      this.clearWanted('disguise_swap', { studBonus: 750, escapedStars: 1 });
      return true;
    }

    // 2★ -> reduz para 1★ mantendo estado SEARCH e ajustando teto para 25s
    this.stars = 1;
    this.chaosScore = WANTED_STAR_THRESHOLDS[1] + 5;
    this.escapeDuration = SEARCH_DURATION_BY_STAR[1];
    this.escapeTimer = Math.min(this.escapeTimer, Math.max(0, this.escapeDuration - 0.1));
    syncPursuitStateFlags(this, PURSUIT_STATES.SEARCH);

    soundFX.playHeroSwap?.();
    const tier = WANTED_TIER_INFO[1];
    this.hud?.updateWantedHud?.(
      this.stars,
      this.isEscaping,
      this.escapeTimer,
      this.escapeDuration,
      tier
    );
    this.hud?.showWantedBanner?.(
      'DISFARCE TÁTICO // -1 ESTRELA',
      'IDENTIDADE TROCADA FORA DE VISÃO • BUSCA REDUZIDA PARA 1★!',
      'pursuit'
    );
    return true;
  }
};
