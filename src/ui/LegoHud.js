import { soundFX } from '../audio/SoundFX.js';

/**
 * Gerencia a HUD Tática Urbana Angular (IDV LEGO: Cidade de Deus):
 * - Retrato LEGO em moldura chanfrada 45° + tag operacional (OP-01 / OP-02)
 * - 4 Corações de LEGO facetados angulares
 * - Contador de Studs solto de alto contraste + popups técnicos
 * - Régua compacta de blocos paralelogramos "True Hero" no topo
 */
export class LegoHud {
  constructor(trueHeroGoal = 35000) {
    this.totalStuds = 0;
    this.displayedStuds = 0;
    this.trueHeroGoal = trueHeroGoal;
    this.isTrueHero = false;
    this.hearts = 4;
    this.maxHearts = 4;

    this.studCountEl = document.getElementById('hud-stud-count');
    this.studGainEl = document.getElementById('hud-stud-gain');
    this.studCoinEl = document.getElementById('hud-stud-coin');
    this.charNameEl = document.getElementById('hud-char-name');
    this.charSubEl = document.getElementById('hud-char-sub');
    this.opTagEl = document.getElementById('hud-op-tag');
    this.portraitCanvas = document.getElementById('hud-portrait-canvas');
    this.heartsContainer = document.getElementById('hud-hearts');
    this.trueHeroSegmentsEl = document.getElementById('true-hero-segments');
    this.trueHeroPercentEl = document.getElementById('true-hero-percent');
    this.trueHeroBadgeEl = document.getElementById('true-hero-badge');
    this.crosshairEl = document.getElementById('crosshair');
    this.pillCaveiraEl = document.getElementById('pill-caveira');
    this.pillSolarisEl = document.getElementById('pill-solaris');

    this._gainTimeout = null;
    this._initHearts();
    this._initTrueHeroBar();
    this.setCharacterPortrait(
      'caveira',
      'COMANDANTE CAVEIRA',
      'BOPE // FUZIL • GRANADA JUMP • ROLAMENTO'
    );
  }

  _initHearts() {
    if (!this.heartsContainer) return;
    this.heartsContainer.innerHTML = '';
    for (let i = 0; i < this.maxHearts; i++) {
      const heart = document.createElement('div');
      heart.className = 'lego-heart active';
      // Coração LEGO Facetado Angular (Cortes geométricos 45° + pino superior)
      heart.innerHTML = `
        <svg viewBox="0 0 32 30" width="23" height="22">
          <polygon points="16,28 3,15 3,7 8,2 13,2 16,6 19,2 24,2 29,7 29,15"
            fill="#ef4444" stroke="#090a0d" stroke-width="2.6" stroke-linejoin="miter"/>
          <polygon points="8,5 12,5 14,8 6,12 6,7" fill="rgba(255,255,255,0.45)"/>
        </svg>
      `;
      this.heartsContainer.appendChild(heart);
    }
  }

  _initTrueHeroBar() {
    if (!this.trueHeroSegmentsEl) return;
    this.trueHeroSegmentsEl.innerHTML = '';
    this.segmentEls = [];
    for (let i = 0; i < 10; i++) {
      const seg = document.createElement('div');
      seg.className = 'true-hero-stud-seg';
      this.trueHeroSegmentsEl.appendChild(seg);
      this.segmentEls.push(seg);
    }
  }

  addStuds(amount, colorName = 'silver') {
    this.totalStuds += amount;

    if (this.studCoinEl) {
      this.studCoinEl.dataset.tier = colorName;
      this.studCoinEl.classList.remove('pop');
      void this.studCoinEl.offsetWidth;
      this.studCoinEl.classList.add('pop');
    }

    if (this.studGainEl) {
      this.studGainEl.textContent = `+${amount.toLocaleString('pt-BR')}`;
      this.studGainEl.dataset.tier = colorName;
      this.studGainEl.classList.add('show');
      clearTimeout(this._gainTimeout);
      this._gainTimeout = setTimeout(() => {
        this.studGainEl.classList.remove('show');
      }, 1100);
    }

    this._updateTrueHeroProgress();
  }

  _updateTrueHeroProgress() {
    const ratio = Math.min(1, this.totalStuds / this.trueHeroGoal);
    const pct = Math.floor(ratio * 100);

    if (this.trueHeroPercentEl) {
      this.trueHeroPercentEl.textContent = `${pct}%`;
    }

    if (this.segmentEls) {
      const filledCount = Math.floor(ratio * 10);
      this.segmentEls.forEach((el, idx) => {
        el.classList.toggle('filled', idx < filledCount);
      });
    }

    if (ratio >= 1 && !this.isTrueHero) {
      this.isTrueHero = true;
      if (this.trueHeroBadgeEl) {
        this.trueHeroBadgeEl.classList.add('achieved');
        this.trueHeroBadgeEl.textContent = '★ VERDADEIRO HERÓI ★';
      }
      soundFX.playTrueHeroFanfare();
    }
  }

  setCharacterPortrait(presetKey, displayName, subtitle = '') {
    if (this.charNameEl && displayName) {
      this.charNameEl.textContent = displayName.toUpperCase();
    }
    if (this.charSubEl && subtitle) {
      this.charSubEl.textContent = subtitle.toUpperCase();
    }
    if (this.opTagEl) {
      this.opTagEl.textContent = presetKey === 'solaris' ? 'OP-02' : 'OP-01';
    }
    if (this.crosshairEl) {
      this.crosshairEl.dataset.hero = presetKey;
    }
    if (this.pillCaveiraEl) {
      this.pillCaveiraEl.classList.toggle('active', presetKey === 'caveira');
    }
    if (this.pillSolarisEl) {
      this.pillSolarisEl.classList.toggle('active', presetKey === 'solaris');
    }
    if (!this.portraitCanvas) return;

    const ctx = this.portraitCanvas.getContext('2d');
    const w = this.portraitCanvas.width;
    const h = this.portraitCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Fundo tático seco em Preto Asfalto + Faixa Diagonal Militar
    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = presetKey === 'solaris' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(250, 204, 21, 0.18)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w * 0.75, 0);
    ctx.moveTo(w * 0.25, h);
    ctx.lineTo(w, h * 0.25);
    ctx.stroke();

    // Pino superior da cabeça LEGO (Stud)
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(w * 0.37, 9, w * 0.26, 9, 2);
    ctx.fill();
    ctx.stroke();

    // Cabeça cilíndrica amarela LEGO
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(w * 0.22, 17, w * 0.56, 38, 6);
    ctx.fill();
    ctx.stroke();

    // Ombros/tronco na base
    ctx.fillStyle =
      presetKey === 'solaris' ? '#dc2626' :
      presetKey === 'classic' ? '#2563eb' : '#171717';
    ctx.beginPath();
    ctx.roundRect(w * 0.14, 54, w * 0.72, 24, 4);
    ctx.fill();
    ctx.stroke();

    if (presetKey === 'caveira') {
      // Boina Preta do BOPE
      ctx.fillStyle = '#171717';
      ctx.beginPath();
      ctx.ellipse(w * 0.48, 17, 22, 7, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Óculos escuros táticos angulares
      ctx.fillStyle = '#090a0d';
      ctx.fillRect(w * 0.26, 27, 15, 9);
      ctx.fillRect(w * 0.53, 27, 15, 9);
      ctx.fillRect(w * 0.41, 29, 12, 3);

      // Sorriso
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(w * 0.5, 43, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (presetKey === 'solaris') {
      // Coroa Solar Dourada
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(w * 0.21, 16, w * 0.58, 7);

      // Olhos brilhantes
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(w * 0.38, 33, 4, 0, Math.PI * 2);
      ctx.arc(w * 0.62, 33, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(w * 0.5, 42, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  update(dt) {
    if (this.displayedStuds < this.totalStuds) {
      const diff = this.totalStuds - this.displayedStuds;
      const step = Math.max(1, Math.ceil(diff * Math.min(1, dt * 16)));
      this.displayedStuds = Math.min(this.totalStuds, this.displayedStuds + step);
      if (this.studCountEl) {
        this.studCountEl.textContent = this.displayedStuds.toLocaleString('pt-BR');
      }
    }
  }
}
