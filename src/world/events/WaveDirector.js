// ============================================================================
// DIRETOR DE ONDAS (estilo "Garden Ops" / "Flag of Power")
// ----------------------------------------------------------------------------
// Controla ondas numeradas com pausa entre elas, soltando inimigos aos poucos
// (respeitando um teto de vivos) e avisando quando a onda foi limpa.
// Não cria nada sozinho: devolve "pedidos de spawn" para quem usa o diretor.
// ============================================================================

export const WAVE_STATE = {
  IDLE: 'IDLE',
  BREAK: 'BREAK',
  SPAWNING: 'SPAWNING',
  FIGHTING: 'FIGHTING',
  DONE: 'DONE'
};

/**
 * Receitas de esquadrão por facção. `tier` cresce a cada ponto/onda.
 * Retorna uma lista de papéis (roles) para spawnar.
 */
export function buildFactionSquad(faction, tier = 0) {
  const t = Math.max(0, Math.floor(tier));
  const squad = ['rifleman', 'rifleman'];
  if (t >= 1) squad.push('tank');
  if (t >= 1) squad.push('special');
  if (t >= 2) squad.push('rifleman');
  if (t >= 2 && faction !== 'cv') squad.push('medic');
  if (t >= 3) squad.push(faction === 'cv' ? 'special' : 'tank');
  if (t >= 4) squad.push('rifleman', 'special');
  return squad;
}

export class WaveDirector {
  /**
   * @param {object} opts
   * @param {Array<{roles:string[], isBoss?:boolean, label?:string}>} opts.waves
   * @param {number} [opts.breakTime=10] pausa entre ondas (segundos)
   * @param {number} [opts.maxAlive=12] teto de inimigos vivos ao mesmo tempo
   * @param {number} [opts.spawnInterval=0.55] intervalo entre cada inimigo
   */
  constructor({ waves = [], breakTime = 10, maxAlive = 12, spawnInterval = 0.55, firstBreak = 4 } = {}) {
    this.waves = waves;
    this.breakTime = breakTime;
    this.firstBreak = firstBreak;
    this.maxAlive = maxAlive;
    this.spawnInterval = spawnInterval;
    this.state = WAVE_STATE.IDLE;
    this.waveIndex = -1;
    this.timer = 0;
    this.pending = [];
    this.units = [];
    this.onWaveStart = null;
    this.onWaveCleared = null;
    this.onAllCleared = null;
  }

  get totalWaves() {
    return this.waves.length;
  }

  get currentWave() {
    return this.waves[this.waveIndex] || null;
  }

  /** Número da onda para o HUD (1-based) */
  get waveNumber() {
    return Math.max(0, this.waveIndex + 1);
  }

  start() {
    this.state = WAVE_STATE.BREAK;
    this.waveIndex = -1;
    this.timer = this.firstBreak;
    this.pending = [];
    this.units = [];
  }

  stop() {
    this.state = WAVE_STATE.IDLE;
    this.pending = [];
    this.units = [];
  }

  /** Registra a unidade criada a partir de um pedido de spawn */
  register(unit) {
    if (unit) this.units.push(unit);
  }

  aliveCount() {
    let n = 0;
    for (const u of this.units) {
      if (u && u.destructible && !u.destructible.destroyed) n++;
    }
    return n;
  }

  /**
   * @param {number} dt
   * @returns {string[]} papéis (roles) a spawnar neste frame
   */
  update(dt) {
    const requests = [];
    if (this.state === WAVE_STATE.IDLE || this.state === WAVE_STATE.DONE) return requests;

    if (this.state === WAVE_STATE.BREAK) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.waveIndex++;
        if (this.waveIndex >= this.waves.length) {
          this.state = WAVE_STATE.DONE;
          if (this.onAllCleared) this.onAllCleared();
          return requests;
        }
        this.units = [];
        this.pending = [...(this.waves[this.waveIndex].roles || [])];
        this.state = WAVE_STATE.SPAWNING;
        this.timer = 0;
        if (this.onWaveStart) this.onWaveStart(this.waveIndex, this.waves[this.waveIndex]);
      }
      return requests;
    }

    if (this.state === WAVE_STATE.SPAWNING) {
      this.timer -= dt;
      while (this.timer <= 0 && this.pending.length > 0 && this.aliveCount() + requests.length < this.maxAlive) {
        requests.push(this.pending.shift());
        this.timer += this.spawnInterval;
      }
      if (this.timer < 0) this.timer = 0;
      if (this.pending.length === 0) this.state = WAVE_STATE.FIGHTING;
      return requests;
    }

    if (this.state === WAVE_STATE.FIGHTING) {
      if (this.aliveCount() === 0) {
        const cleared = this.waveIndex;
        if (this.onWaveCleared) this.onWaveCleared(cleared, this.waves[cleared]);
        if (cleared >= this.waves.length - 1) {
          this.state = WAVE_STATE.DONE;
          if (this.onAllCleared) this.onAllCleared();
        } else {
          this.state = WAVE_STATE.BREAK;
          this.timer = this.breakTime;
        }
      }
    }
    return requests;
  }

  /** Segundos restantes da pausa (para o HUD) */
  breakRemaining() {
    return this.state === WAVE_STATE.BREAK ? Math.max(0, this.timer) : 0;
  }
}
