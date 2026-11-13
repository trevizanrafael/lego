// ============================================================================
// PAINEL DE OBJETIVO (Topo Central) — IDV Tático Urbano
// Invasão de território, Contra-Ataque e Mega Assalto usam o mesmo painel:
//   [TAG]  TÍTULO DO OBJETIVO                     ⏱ 03:42
//   ▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱  CAPTURANDO 38%          ONDA 3/5
// ============================================================================

const SEGMENTS = 20;

export class ObjectiveHud {
  constructor(doc = globalThis.document) {
    this.doc = doc;
    this.visible = false;
    this.root = null;
    this._lastSegLit = -1;
    this._lastVariant = '';
    this._rouletteTimer = null;
    this._build();
  }

  _build() {
    const doc = this.doc;
    if (!doc || typeof doc.createElement !== 'function') return;

    const root = doc.createElement('div');
    root.id = 'objective-hud';
    root.className = 'objective-hud hidden';

    const head = doc.createElement('div');
    head.className = 'objective-head';
    this.tagEl = doc.createElement('span');
    this.tagEl.className = 'objective-tag';
    this.titleEl = doc.createElement('span');
    this.titleEl.className = 'objective-title';
    this.timerEl = doc.createElement('span');
    this.timerEl.className = 'objective-timer';
    head.appendChild(this.tagEl);
    head.appendChild(this.titleEl);
    head.appendChild(this.timerEl);

    const row = doc.createElement('div');
    row.className = 'objective-row';
    this.barEl = doc.createElement('div');
    this.barEl.className = 'objective-bar';
    this.segEls = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const seg = doc.createElement('i');
      seg.className = 'objective-seg';
      this.barEl.appendChild(seg);
      this.segEls.push(seg);
    }
    this.statusEl = doc.createElement('span');
    this.statusEl.className = 'objective-status';
    this.waveEl = doc.createElement('span');
    this.waveEl.className = 'objective-wave';
    row.appendChild(this.barEl);
    row.appendChild(this.statusEl);
    row.appendChild(this.waveEl);

    this.rouletteEl = doc.createElement('div');
    this.rouletteEl.className = 'objective-roulette hidden';

    root.appendChild(head);
    root.appendChild(row);
    root.appendChild(this.rouletteEl);

    const host = doc.getElementById?.('game-container') || doc.body;
    host?.appendChild?.(root);
    this.root = root;
  }

  show({ tag = '', title = '', accent = '#facc15' } = {}) {
    if (!this.root) return;
    this.tagEl.textContent = tag;
    this.titleEl.textContent = title;
    if (this.root.style) this.root.style.setProperty?.('--objective-accent', accent);
    this.root.classList.remove('hidden');
    this.visible = true;
  }

  setTitle(title) {
    if (this.titleEl) this.titleEl.textContent = title;
  }

  hide() {
    if (!this.root) return;
    this.root.classList.add('hidden');
    this.rouletteEl?.classList.add('hidden');
    this.visible = false;
    this._lastSegLit = -1;
  }

  /**
   * @param {number} ratio 0..1
   * @param {'capture'|'contested'|'danger'|'neutral'} variant
   */
  setProgress(ratio, variant = 'capture') {
    if (!this.root) return;
    const lit = Math.round(Math.max(0, Math.min(1, ratio)) * SEGMENTS);
    if (lit !== this._lastSegLit || variant !== this._lastVariant) {
      for (let i = 0; i < SEGMENTS; i++) {
        const seg = this.segEls[i];
        if (i < lit) seg.classList.add('on');
        else seg.classList.remove('on');
      }
      this.barEl.dataset.variant = variant;
      this._lastSegLit = lit;
      this._lastVariant = variant;
    }
  }

  setStatus(text, variant = '') {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.dataset.variant = variant;
  }

  setTimer(seconds) {
    if (!this.timerEl) return;
    if (seconds === null || seconds === undefined) {
      this.timerEl.textContent = '';
      return;
    }
    const s = Math.max(0, Math.ceil(seconds));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    this.timerEl.textContent = `${mm}:${ss}`;
    this.timerEl.dataset.variant = s <= 30 ? 'danger' : '';
  }

  setWave(current, total) {
    if (!this.waveEl) return;
    this.waveEl.textContent = current && total ? `ONDA ${current}/${total}` : '';
  }

  /**
   * Roleta do chefe (caça-níquel): gira nomes e para no resultado.
   */
  spinRoulette(options, resultLabel, durationMs = 1800) {
    if (!this.rouletteEl) return;
    this.rouletteEl.classList.remove('hidden');
    this.rouletteEl.dataset.variant = 'spin';
    let i = 0;
    const started = Date.now();
    if (this._rouletteTimer) clearInterval(this._rouletteTimer);
    this._rouletteTimer = setInterval(() => {
      if (Date.now() - started >= durationMs) {
        clearInterval(this._rouletteTimer);
        this._rouletteTimer = null;
        this.rouletteEl.textContent = `▶ ${resultLabel} ◀`;
        this.rouletteEl.dataset.variant = 'result';
        const t = setTimeout(() => this.rouletteEl?.classList.add('hidden'), 2600);
        t?.unref?.();
        return;
      }
      this.rouletteEl.textContent = options[i % options.length];
      i++;
    }, 90);
    this._rouletteTimer?.unref?.();
  }
}
