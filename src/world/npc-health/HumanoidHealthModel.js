export const HUMANOID_STATES = Object.freeze({
  ALIVE: 'ALIVE',
  STAGGER: 'STAGGER',
  DOWNED: 'DOWNED',
  DEAD: 'DEAD'
});

export const HUMANOID_KINDS = Object.freeze({
  CIVILIAN: 'civilian',
  POLICE: 'police',
  SOLDIER: 'soldier',
  BOSS: 'boss'
});

export const HUMANOID_TIMINGS = Object.freeze({
  STAGGER_SEC: 0.30,
  BOSS_STAGGER_SEC: 0.16,
  CIVILIAN_DOWNED_SEC: 1.20,
  COMBAT_DOWNED_SEC: 1.15,
  GETTING_UP_SEC: 0.35,
  RECENT_HIT_WINDOW_SEC: 1.50,
  CIVILIAN_HEAVY_HIT_RATIO: 0.35
});

const VALID_KINDS = new Set([
  HUMANOID_KINDS.CIVILIAN,
  HUMANOID_KINDS.POLICE,
  HUMANOID_KINDS.SOLDIER,
  HUMANOID_KINDS.BOSS
]);

/**
 * Calcula a direção normalizada do impacto no plano XZ e o eixo anatômico da queda
 * ('back' para tombar de costas/frente em X, 'side' para tombar de lado em Z).
 */
export function computeHumanoidFallVector(hitOrigin, entityPos, facingYaw = 0, shotDir = null) {
  let dirX = 0;
  let dirZ = 0;

  if (shotDir && Number.isFinite(shotDir.x) && Number.isFinite(shotDir.z)) {
    const sLen = Math.hypot(shotDir.x, shotDir.z);
    if (sLen > 0.001) {
      dirX = shotDir.x / sLen;
      dirZ = shotDir.z / sLen;
    }
  }

  if (dirX === 0 && dirZ === 0 && hitOrigin && entityPos) {
    const dx = (Number(entityPos.x) || 0) - (Number(hitOrigin.x) || 0);
    const dz = (Number(entityPos.z) || 0) - (Number(hitOrigin.z) || 0);
    const len = Math.hypot(dx, dz);
    if (len > 0.001) {
      dirX = dx / len;
      dirZ = dz / len;
    }
  }

  if (dirX === 0 && dirZ === 0) {
    const yaw = Number(facingYaw) || 0;
    dirX = -Math.sin(yaw);
    dirZ = -Math.cos(yaw);
  }

  const yaw = Number(facingYaw) || 0;
  const dotFwd = dirX * Math.sin(yaw) + dirZ * Math.cos(yaw);
  const dotSide = dirX * Math.cos(yaw) - dirZ * Math.sin(yaw);

  if (Math.abs(dotSide) > Math.abs(dotFwd) * 1.15) {
    return { fallDirX: dirX, fallDirZ: dirZ, fallAxis: 'side', fallSign: dotSide >= 0 ? -1 : 1 };
  }
  return { fallDirX: dirX, fallDirZ: dirZ, fallAxis: 'back', fallSign: dotFwd >= 0 ? 1 : -1 };
}

/**
 * Modelo unificado de vida, atordoamento (STAGGER), derrubada (DOWNED) e morte (DEAD)
 * para todos os NPCs humanoides (civis, policiais, soldados de facção e chefes).
 */
export class HumanoidHealthModel {
  constructor(opts = {}) {
    const rawKind = typeof opts.kind === 'string' ? opts.kind.toLowerCase() : HUMANOID_KINDS.CIVILIAN;
    this.kind = VALID_KINDS.has(rawKind) ? rawKind : HUMANOID_KINDS.CIVILIAN;

    const defaultMaxHp =
      this.kind === HUMANOID_KINDS.CIVILIAN ? 100 :
      this.kind === HUMANOID_KINDS.POLICE ? 65 :
      this.kind === HUMANOID_KINDS.BOSS ? 1550 : 160;
    const numericMax = Number(opts.maxHp);
    this.maxHp = Number.isFinite(numericMax) && numericMax > 0 ? numericMax : defaultMaxHp;
    this.hp = this.maxHp;

    this.state = HUMANOID_STATES.ALIVE;
    this.stateElapsed = 0;
    this.staggerTimer = 0;
    this.staggerDuration = HUMANOID_TIMINGS.STAGGER_SEC;
    this.downedTimer = 0;
    this.downedDuration = HUMANOID_TIMINGS.CIVILIAN_DOWNED_SEC;
    this.gettingUpTimer = 0;
    this.gettingUpDuration = HUMANOID_TIMINGS.GETTING_UP_SEC;
    this.isGettingUp = false;

    this.lastHitAge = Infinity;
    this.lastHitElapsed = Infinity;
    this.recentHitsInWindow = 0;
    this.totalHitsTaken = 0;

    this.fallDirX = 0;
    this.fallDirZ = -1;
    this.fallAxis = 'back';
    this.fallSign = -1;
    this.knockbackSpeed = 0;
    this.lastHitByPlayer = false;
    this.killedByPlayer = false;

    this.onRecoveredFromDowned =
      typeof opts.onRecoveredFromDowned === 'function' ? opts.onRecoveredFromDowned : null;
    this.onStateChanged =
      typeof opts.onStateChanged === 'function' ? opts.onStateChanged : null;
  }

  isAlive() {
    return this.state !== HUMANOID_STATES.DEAD;
  }

  isDead() {
    return this.state === HUMANOID_STATES.DEAD;
  }

  isDowned() {
    return this.state === HUMANOID_STATES.DOWNED;
  }

  isStaggered() {
    return this.state === HUMANOID_STATES.STAGGER;
  }

  isIncapacitated() {
    return this.state === HUMANOID_STATES.DOWNED || this.state === HUMANOID_STATES.DEAD;
  }

  getStaggerProgress() {
    if (this.state !== HUMANOID_STATES.STAGGER || this.staggerDuration <= 0) return 0;
    return Math.max(0, Math.min(1, 1 - this.staggerTimer / this.staggerDuration));
  }

  getGettingUpProgress() {
    if (this.state !== HUMANOID_STATES.DOWNED || !this.isGettingUp || this.gettingUpDuration <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(1, 1 - this.gettingUpTimer / this.gettingUpDuration));
  }

  _buildResult(prevState, killed, damageApplied) {
    return {
      state: this.state,
      prevState,
      changed: prevState !== this.state,
      killed,
      damageApplied,
      hp: this.hp,
      fallAxis: this.fallAxis,
      fallDirX: this.fallDirX,
      fallDirZ: this.fallDirZ,
      fallSign: this.fallSign
    };
  }

  _transitionTo(nextState) {
    const prev = this.state;
    this.state = nextState;
    if (prev !== nextState) {
      this.stateElapsed = 0;
      if (this.onStateChanged) this.onStateChanged(nextState, prev, this);
    }
  }

  applyDamage(amount, hitInfo = {}) {
    if (this.state === HUMANOID_STATES.DEAD) {
      return this._buildResult(HUMANOID_STATES.DEAD, false, 0);
    }

    const numericAmount = Math.max(0, Number(amount) || 0);
    if (numericAmount <= 0) {
      return this._buildResult(this.state, false, 0);
    }

    const prevState = this.state;
    const prevHp = this.hp;
    this.hp = Math.max(0, this.hp - numericAmount);
    const damageApplied = prevHp - this.hp;

    const isExplosion = Boolean(hitInfo.isExplosion);
    const isCloseShotgun = Boolean(hitInfo.isCloseShotgun);
    const sourceIsPlayer = Boolean(hitInfo.sourceIsPlayer);
    this.lastHitByPlayer = sourceIsPlayer;

    const fall = computeHumanoidFallVector(
      hitInfo.hitOrigin || null,
      hitInfo.entityPos || null,
      hitInfo.facingYaw || 0,
      hitInfo.shotDir || null
    );
    if (this.state !== HUMANOID_STATES.DOWNED || this.hp <= 0 || isExplosion) {
      this.fallDirX = fall.fallDirX;
      this.fallDirZ = fall.fallDirZ;
      this.fallAxis = fall.fallAxis;
      this.fallSign = fall.fallSign;
    }

    this.recentHitsInWindow =
      this.lastHitAge <= HUMANOID_TIMINGS.RECENT_HIT_WINDOW_SEC
        ? this.recentHitsInWindow + 1
        : 1;
    this.lastHitAge = 0;
    this.lastHitElapsed = 0;
    this.totalHitsTaken += 1;

    if (this.hp <= 0) {
      this.staggerTimer = 0;
      this.downedTimer = 0;
      this.gettingUpTimer = 0;
      this.isGettingUp = false;
      this.killedByPlayer = sourceIsPlayer;
      this.knockbackSpeed = isExplosion ? 6.5 : isCloseShotgun ? 5.2 : 2.8;
      this._transitionTo(HUMANOID_STATES.DEAD);
      return this._buildResult(prevState, true, damageApplied);
    }

    if (this.kind === HUMANOID_KINDS.CIVILIAN) {
      const isHeavyHit = numericAmount >= this.maxHp * HUMANOID_TIMINGS.CIVILIAN_HEAVY_HIT_RATIO;
      const shouldKnockDown =
        isHeavyHit || this.recentHitsInWindow >= 2 || isExplosion || isCloseShotgun;

      if (this.state !== HUMANOID_STATES.DOWNED) {
        if (shouldKnockDown) {
          this.downedDuration = HUMANOID_TIMINGS.CIVILIAN_DOWNED_SEC;
          this.downedTimer = this.downedDuration;
          this.gettingUpDuration = HUMANOID_TIMINGS.GETTING_UP_SEC;
          this.gettingUpTimer = 0;
          this.isGettingUp = false;
          this.staggerTimer = 0;
          this.knockbackSpeed = isExplosion ? 7.2 : isCloseShotgun ? 5.8 : 3.6;
          this._transitionTo(HUMANOID_STATES.DOWNED);
        } else {
          this.staggerDuration = HUMANOID_TIMINGS.STAGGER_SEC;
          this.staggerTimer = this.staggerDuration;
          this.knockbackSpeed = 3.2;
          this._transitionTo(HUMANOID_STATES.STAGGER);
        }
      }
    } else if (this.kind === HUMANOID_KINDS.POLICE || this.kind === HUMANOID_KINDS.SOLDIER) {
      if (isExplosion || isCloseShotgun) {
        this.downedDuration = HUMANOID_TIMINGS.COMBAT_DOWNED_SEC;
        this.downedTimer = this.downedDuration;
        this.gettingUpDuration = HUMANOID_TIMINGS.GETTING_UP_SEC;
        this.gettingUpTimer = 0;
        this.isGettingUp = false;
        this.staggerTimer = 0;
        this.knockbackSpeed = isExplosion ? 6.8 : 5.0;
        this._transitionTo(HUMANOID_STATES.DOWNED);
      } else if (this.state !== HUMANOID_STATES.DOWNED) {
        this.staggerDuration = HUMANOID_TIMINGS.STAGGER_SEC;
        this.staggerTimer = this.staggerDuration;
        this.knockbackSpeed = 2.4;
        this._transitionTo(HUMANOID_STATES.STAGGER);
      }
    } else {
      this.staggerDuration = HUMANOID_TIMINGS.BOSS_STAGGER_SEC;
      this.staggerTimer = this.staggerDuration;
      this.knockbackSpeed = 1.1;
      this._transitionTo(HUMANOID_STATES.STAGGER);
    }

    return this._buildResult(prevState, false, damageApplied);
  }

  heal(amount) {
    if (this.state === HUMANOID_STATES.DEAD) return 0;
    const gain = Math.max(0, Number(amount) || 0);
    if (gain <= 0) return 0;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + gain);
    return this.hp - before;
  }

  update(dt) {
    const step = Math.max(0, Number(dt) || 0);
    if (step <= 0) return this.state;

    this.stateElapsed += step;
    if (Number.isFinite(this.lastHitAge)) {
      this.lastHitAge += step;
      this.lastHitElapsed = this.lastHitAge;
      if (this.lastHitAge > HUMANOID_TIMINGS.RECENT_HIT_WINDOW_SEC) {
        this.recentHitsInWindow = 0;
      }
    }

    if (this.knockbackSpeed > 0) {
      this.knockbackSpeed = Math.max(0, this.knockbackSpeed - step * 14.0);
    }

    if (this.state === HUMANOID_STATES.STAGGER) {
      this.staggerTimer -= step;
      if (this.staggerTimer <= 0) {
        this.staggerTimer = 0;
        this.knockbackSpeed = 0;
        this._transitionTo(HUMANOID_STATES.ALIVE);
      }
    } else if (this.state === HUMANOID_STATES.DOWNED) {
      if (!this.isGettingUp) {
        this.downedTimer -= step;
        if (this.downedTimer <= 0) {
          const overflow = -this.downedTimer;
          this.downedTimer = 0;
          this.isGettingUp = true;
          this.gettingUpTimer = Math.max(0, this.gettingUpDuration - overflow);
          if (this.gettingUpTimer <= 0) this._finishRecoveryFromDowned();
        }
      } else {
        this.gettingUpTimer -= step;
        if (this.gettingUpTimer <= 0) this._finishRecoveryFromDowned();
      }
    }

    return this.state;
  }

  _finishRecoveryFromDowned() {
    this.gettingUpTimer = 0;
    this.downedTimer = 0;
    this.isGettingUp = false;
    this.knockbackSpeed = 0;
    this.recentHitsInWindow = 0;
    this._transitionTo(HUMANOID_STATES.ALIVE);
    if (this.onRecoveredFromDowned) this.onRecoveredFromDowned(this);
  }

  reset(newMaxHp = null) {
    if (Number.isFinite(Number(newMaxHp)) && Number(newMaxHp) > 0) {
      this.maxHp = Number(newMaxHp);
    }
    this.hp = this.maxHp;
    this.state = HUMANOID_STATES.ALIVE;
    this.stateElapsed = 0;
    this.staggerTimer = 0;
    this.downedTimer = 0;
    this.gettingUpTimer = 0;
    this.isGettingUp = false;
    this.lastHitAge = Infinity;
    this.lastHitElapsed = Infinity;
    this.recentHitsInWindow = 0;
    this.totalHitsTaken = 0;
    this.knockbackSpeed = 0;
    this.lastHitByPlayer = false;
    this.killedByPlayer = false;
  }
}

export function createHumanoidHealthModel(opts = {}) {
  return new HumanoidHealthModel(opts);
}
