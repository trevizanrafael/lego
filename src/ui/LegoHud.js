import { soundFX } from '../audio/SoundFX.js';

/**
 * Gerencia a HUD Clássica Estilo LEGO:
 * - Retrato do personagem atual (Canvas 2D estilo cabeça LEGO)
 * - 4 Corações de LEGO de vida
 * - Contador animado de Studs (moedinhas) + popups de coleta (+10, +100, +1.000, +10.000)
 * - Barra de Progresso "True Hero" (Verdadeiro Herói) no topo
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
    this.portraitCanvas = document.getElementById('hud-portrait-canvas');
    this.heartsContainer = document.getElementById('hud-hearts');
    this.trueHeroSegmentsEl = document.getElementById('true-hero-segments');
    this.trueHeroPercentEl = document.getElementById('true-hero-percent');
    this.trueHeroBadgeEl = document.getElementById('true-hero-badge');

    this._gainTimeout = null;
    this._initHearts();
    this._initTrueHeroBar();
    this.setCharacterPortrait('caveira', 'Comandante Caveira');
  }

  _initHearts() {
    if (!this.heartsContainer) return;
    this.heartsContainer.innerHTML = '';
    for (let i = 0; i < this.maxHearts; i++) {
      const heart = document.createElement('div');
      heart.className = 'lego-heart active';
      heart.innerHTML = `
        <svg viewBox="0 0 32 32" width="24" height="24">
          <path d="M16 28 C16 28 3 19.5 3 10.5 C3 6 6.5 3 10.5 3 C13.2 3 15.2 4.5 16 6.5 C16.8 4.5 18.8 3 21.5 3 C25.5 3 29 6 29 10.5 C29 19.5 16 28 16 28 Z"
            fill="#ef4444" stroke="#7f1d1d" stroke-width="2.2"/>
          <ellipse cx="10.5" cy="9.5" rx="3" ry="1.8" transform="rotate(-25 10.5 9.5)" fill="rgba(255,255,255,0.55)"/>
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

  /**
   * Adiciona Studs coletados e dispara animações na HUD
   */
  addStuds(amount, colorName = 'silver') {
    this.totalStuds += amount;

    // Atualiza cor da moedinha da HUD conforme o último Stud pego
    if (this.studCoinEl) {
      this.studCoinEl.dataset.tier = colorName;
      this.studCoinEl.classList.remove('pop');
      void this.studCoinEl.offsetWidth;
      this.studCoinEl.classList.add('pop');
    }

    // Mostra popup do valor coletado (+10, +100, +1.000, +10.000)
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
        this.trueHeroBadgeEl.textContent = '★ VERDADEIRO HERÓI LEGO! ★';
      }
      soundFX.playTrueHeroFanfare();
    }
  }

  /**
   * Desenha o retrato 2D estilizado de cabeça LEGO no canto superior esquerdo
   */
  setCharacterPortrait(presetKey, displayName) {
    if (this.charNameEl && displayName) {
      this.charNameEl.textContent = displayName;
    }
    if (!this.portraitCanvas) return;
    const ctx = this.portraitCanvas.getContext('2d');
    const w = this.portraitCanvas.width;
    const h = this.portraitCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Fundo radial dentro do medalhão
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, 6, w * 0.5, h * 0.5, w * 0.52);
    if (presetKey === 'solaris') {
      bgGrad.addColorStop(0, '#f97316');
      bgGrad.addColorStop(1, '#7f1d1d');
    } else if (presetKey === 'classic') {
      bgGrad.addColorStop(0, '#3b82f6');
      bgGrad.addColorStop(1, '#1e3a8a');
    } else {
      bgGrad.addColorStop(0, '#334155');
      bgGrad.addColorStop(1, '#0f172a');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Pino superior da cabeça LEGO (Stud)
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(w * 0.37, 9, w * 0.26, 9, 3);
    ctx.fill();
    ctx.stroke();

    // Cabeça cilíndrica amarela LEGO
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(w * 0.22, 17, w * 0.56, 38, 9);
    ctx.fill();
    ctx.stroke();

    // Ombros/tronco na base
    ctx.fillStyle =
      presetKey === 'solaris' ? '#dc2626' :
      presetKey === 'classic' ? '#2563eb' : '#171717';
    ctx.beginPath();
    ctx.roundRect(w * 0.14, 54, w * 0.72, 24, 6);
    ctx.fill();
    ctx.stroke();

    if (presetKey === 'caveira') {
      // Boina Preta do BOPE
      ctx.fillStyle = '#171717';
      ctx.beginPath();
      ctx.ellipse(w * 0.48, 17, 22, 7, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Óculos escuros táticos
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(w * 0.27, 28, 14, 9);
      ctx.fillRect(w * 0.53, 28, 14, 9);
      ctx.fillRect(w * 0.41, 30, 8, 3);

      // Sorriso
      ctx.strokeStyle = '#171717';
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

      ctx.strokeStyle = '#171717';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(w * 0.5, 42, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else {
      // Rosto clássico LEGO
      ctx.fillStyle = '#171717';
      ctx.beginPath();
      ctx.arc(w * 0.38, 33, 3.5, 0, Math.PI * 2);
      ctx.arc(w * 0.62, 33, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#171717';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(w * 0.5, 41, 8, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  update(dt) {
    // Faz o contador de Studs rolar suavemente até o total atual
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

