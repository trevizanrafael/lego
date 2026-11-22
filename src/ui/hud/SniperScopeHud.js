import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export const SNIPER_SCOPE_THEMES = Object.freeze({
  pcc_cobalt: Object.freeze({
    headerPrefix: 'PCC // ÓPTICA TÁTICA',
    accentPrimary: '#38bdf8',
    accentSecondary: '#2563eb',
    reticleCore: '#dc2626'
  })
});

function obtainScopeNode(tag, id, ...classes) {
  if (typeof document === 'undefined') return null;
  let el = id && typeof document.getElementById === 'function' ? document.getElementById(id) : null;
  if (!el && typeof document.createElement === 'function') {
    el = document.createElement(tag);
    if (id) el.id = id;
  }
  if (el?.classList) {
    for (const cls of classes) {
      if (cls) el.classList.add(cls);
    }
  }
  return el;
}

function buildBallisticReticleSvg() {
  return `
    <svg class="sniper-scope-svg" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="pccCobaltRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.58"/>
          <stop offset="48%" stop-color="#1e283a" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#2563eb" stop-opacity="0.64"/>
        </linearGradient>
      </defs>

      <!-- Anel chanfrado octogonal externo da carcaça tática -->
      <polygon
        points="178,16 422,16 584,178 584,422 422,584 178,584 16,422 16,178"
        stroke="rgba(56, 189, 248, 0.22)"
        stroke-width="1.2"
      />
      <polygon
        points="186,28 414,28 572,186 572,414 414,572 186,572 28,414 28,186"
        stroke="rgba(37, 99, 235, 0.34)"
        stroke-width="1"
      />

      <!-- Anéis ópticos internos da objetiva -->
      <circle cx="300" cy="300" r="258" stroke="url(#pccCobaltRimGrad)" stroke-width="1.6"/>
      <circle cx="300" cy="300" r="246" stroke="rgba(125, 211, 252, 0.16)" stroke-width="0.9" stroke-dasharray="6 8"/>
      <circle cx="300" cy="300" r="142" stroke="rgba(220, 227, 238, 0.12)" stroke-width="0.8"/>

      <!-- Cantoneiras angulares 45 graus internas de travamento de alvo -->
      <polyline points="208,224 224,208 248,208" stroke="rgba(56, 189, 248, 0.56)" stroke-width="1.4"/>
      <polyline points="392,224 376,208 352,208" stroke="rgba(56, 189, 248, 0.56)" stroke-width="1.4"/>
      <polyline points="208,376 224,392 248,392" stroke="rgba(56, 189, 248, 0.56)" stroke-width="1.4"/>
      <polyline points="392,376 376,392 352,392" stroke="rgba(56, 189, 248, 0.56)" stroke-width="1.4"/>

      <!-- Postes externos grossos de enquadramento rápido -->
      <line x1="42" y1="300" x2="148" y2="300" stroke="rgba(220, 227, 238, 0.72)" stroke-width="2.4"/>
      <line x1="452" y1="300" x2="558" y2="300" stroke="rgba(220, 227, 238, 0.72)" stroke-width="2.4"/>
      <line x1="300" y1="42" x2="300" y2="148" stroke="rgba(220, 227, 238, 0.62)" stroke-width="2.0"/>
      <line x1="300" y1="468" x2="300" y2="558" stroke="rgba(220, 227, 238, 0.72)" stroke-width="2.4"/>

      <!-- Fios capilares centrais de precisão milimétrica -->
      <line x1="148" y1="300" x2="289" y2="300" stroke="rgba(248, 250, 252, 0.88)" stroke-width="1.05"/>
      <line x1="311" y1="300" x2="452" y2="300" stroke="rgba(248, 250, 252, 0.88)" stroke-width="1.05"/>
      <line x1="300" y1="148" x2="300" y2="289" stroke="rgba(248, 250, 252, 0.82)" stroke-width="1.05"/>
      <line x1="300" y1="311" x2="300" y2="468" stroke="rgba(248, 250, 252, 0.88)" stroke-width="1.05"/>

      <!-- Marcações Mil-Dot horizontais ( deriva de vento / alvo em movimento ) -->
      <line x1="270" y1="296" x2="270" y2="304" stroke="#7dd3fc" stroke-width="1"/>
      <line x1="240" y1="294" x2="240" y2="306" stroke="#7dd3fc" stroke-width="1.1"/>
      <line x1="210" y1="296" x2="210" y2="304" stroke="#7dd3fc" stroke-width="1"/>
      <line x1="180" y1="293" x2="180" y2="307" stroke="#38bdf8" stroke-width="1.2"/>

      <line x1="330" y1="296" x2="330" y2="304" stroke="#7dd3fc" stroke-width="1"/>
      <line x1="360" y1="294" x2="360" y2="306" stroke="#7dd3fc" stroke-width="1.1"/>
      <line x1="390" y1="296" x2="390" y2="304" stroke="#7dd3fc" stroke-width="1"/>
      <line x1="420" y1="293" x2="420" y2="307" stroke="#38bdf8" stroke-width="1.2"/>

      <!-- Marcações Mil-Dot verticais superiores -->
      <line x1="296" y1="270" x2="304" y2="270" stroke="rgba(125, 211, 252, 0.65)" stroke-width="1"/>
      <line x1="294" y1="240" x2="306" y2="240" stroke="rgba(125, 211, 252, 0.65)" stroke-width="1"/>

      <!-- Escada de queda balística (BDC / Mil-Dot) no eixo vertical inferior -->
      <line x1="294" y1="330" x2="306" y2="330" stroke="#7dd3fc" stroke-width="1.1"/>
      <circle cx="300" cy="345" r="1.6" fill="#38bdf8"/>
      <line x1="291" y1="360" x2="309" y2="360" stroke="#38bdf8" stroke-width="1.2"/>
      <circle cx="300" cy="375" r="1.6" fill="#38bdf8"/>
      <line x1="288" y1="390" x2="312" y2="390" stroke="#38bdf8" stroke-width="1.2"/>
      <circle cx="300" cy="405" r="1.6" fill="#38bdf8"/>
      <line x1="284" y1="420" x2="316" y2="420" stroke="#2563eb" stroke-width="1.3"/>
      <line x1="280" y1="450" x2="320" y2="450" stroke="#2563eb" stroke-width="1.3"/>

      <!-- Árvore de compensação balística angular (Holdover Dots) -->
      <circle cx="288" cy="360" r="1.2" fill="rgba(125, 211, 252, 0.7)"/>
      <circle cx="312" cy="360" r="1.2" fill="rgba(125, 211, 252, 0.7)"/>
      <circle cx="282" cy="390" r="1.2" fill="rgba(125, 211, 252, 0.7)"/>
      <circle cx="318" cy="390" r="1.2" fill="rgba(125, 211, 252, 0.7)"/>
      <circle cx="276" cy="420" r="1.2" fill="rgba(56, 189, 248, 0.65)"/>
      <circle cx="324" cy="420" r="1.2" fill="rgba(56, 189, 248, 0.65)"/>

      <!-- Numeração discreta BDC -->
      <text x="316" y="363" fill="rgba(125, 211, 252, 0.76)" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700">2</text>
      <text x="320" y="393" fill="rgba(125, 211, 252, 0.76)" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700">4</text>
      <text x="324" y="423" fill="rgba(56, 189, 248, 0.76)" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700">6</text>

      <!-- Anel micro-óptico central + Ponto rubi/ciano de 2px sem paralaxe -->
      <polygon points="300,292 308,300 300,308 292,300" stroke="rgba(56, 189, 248, 0.72)" stroke-width="1"/>
      <rect x="298.8" y="298.8" width="2.4" height="2.4" fill="#dc2626"/>
    </svg>
  `;
}

/**
 * Luneta Óptica Tática 4.0X (Noir Tático Urbano Angular — PCC Contador DMR).
 * Oculta a mira padrão #crosshair e projeta retículo Mil-Dot com telêmetro e munição ao vivo.
 */
export function installSniperScopeHud(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _initSniperScopeHud() {
      if (typeof document === 'undefined') return;
      if (this.sniperScopeOverlayEl && this._sniperScopeState) return;

      const overlay = obtainScopeNode('div', 'sniper-scope-overlay', 'sniper-scope-overlay', 'hidden');
      if (!overlay) return;
      if (typeof overlay.setAttribute === 'function') {
        overlay.setAttribute('aria-hidden', 'true');
      }
      overlay.innerHTML = '';
      if (Array.isArray(overlay.children)) overlay.children.length = 0;

      const vignetteMask = obtainScopeNode('div', 'sniper-scope-vignette', 'sniper-scope-vignette');
      const cobaltGlint = obtainScopeNode('div', 'sniper-scope-glint', 'sniper-scope-glint');
      const stage = obtainScopeNode('div', 'sniper-scope-reticle-stage', 'sniper-scope-reticle-stage');

      const svgHolder = obtainScopeNode('div', 'sniper-scope-svg-wrap', 'sniper-scope-svg-wrap');
      svgHolder.innerHTML = buildBallisticReticleSvg();

      const leftWing = obtainScopeNode('div', 'sniper-scope-wing-left', 'sniper-scope-wing', 'wing-left');
      const labelEl = obtainScopeNode('span', 'sniper-scope-label', 'sniper-scope-telemetry-txt');
      labelEl.textContent = 'PCC // ÓPTICA TÁTICA 4.0X';
      leftWing.appendChild(labelEl);

      const rightWing = obtainScopeNode('div', 'sniper-scope-wing-right', 'sniper-scope-wing', 'wing-right');
      const rangeEl = obtainScopeNode('span', 'sniper-scope-range', 'sniper-scope-range-txt');
      rangeEl.textContent = 'ALVO: 000m';
      rightWing.appendChild(rangeEl);

      const bottomReadout = obtainScopeNode('div', 'sniper-scope-bottom', 'sniper-scope-bottom');
      const ammoEl = obtainScopeNode('span', 'sniper-scope-ammo', 'sniper-scope-ammo-txt');
      ammoEl.textContent = '18 / 108';
      bottomReadout.appendChild(ammoEl);

      stage.appendChild(svgHolder);
      stage.appendChild(leftWing);
      stage.appendChild(rightWing);
      stage.appendChild(bottomReadout);

      overlay.appendChild(vignetteMask);
      overlay.appendChild(cobaltGlint);
      overlay.appendChild(stage);

      const host =
        (typeof document.getElementById === 'function' ? document.getElementById('ui-overlay') : null) ||
        document.body;
      if (host && typeof host.appendChild === 'function' && !overlay.parentElement) {
        if (!Array.isArray(host.children) || !host.children.includes(overlay)) {
          host.appendChild(overlay);
        }
      }

      this.sniperScopeOverlayEl = overlay;
      this.sniperScopeStageEl = stage;
      this.sniperScopeLabelEl = labelEl;
      this.sniperScopeRangeEl = rangeEl;
      this.sniperScopeAmmoEl = ammoEl;
      this.isSniperScopeActive = false;
      this._sniperScopeState = {
        active: false,
        label: 'PCC // ÓPTICA TÁTICA 4.0X',
        range: 'ALVO: 000m',
        ammo: '18 / 108',
        lowAmmo: false,
        transform: ''
      };
    },

    updateSniperScopeHud({
      active = false,
      scopeTheme = 'pcc_cobalt',
      zoomLabel = '4.0X',
      distanceMeters = 0,
      inMag = 18,
      magSize = 18,
      reserve = 108,
      recoilKick = 0
    } = {}) {
      if (!this.sniperScopeOverlayEl || !this._sniperScopeState) {
        this._initSniperScopeHud();
      }
      if (!this.sniperScopeOverlayEl || !this._sniperScopeState) return;

      const blockedByModal = Boolean(
        this.isTitleScreenActive ||
        this.isLoadingActive ||
        this.isPauseMenuOpen ||
        this.isFullMapOpen ||
        this.isDossierOpen ||
        this.isCharacterGridOpen ||
        this.isCreatorOpen ||
        this.isCustomsOpen ||
        this.isAircraftStudioOpen
      );
      const shouldShow = Boolean(active) && !blockedByModal;
      const st = this._sniperScopeState;

      if (st.active !== shouldShow) {
        st.active = shouldShow;
        this.isSniperScopeActive = shouldShow;
        this.sniperScopeOverlayEl.classList.toggle('hidden', !shouldShow);
        this.sniperScopeOverlayEl.classList.toggle('is-active', shouldShow);
        if (typeof document !== 'undefined') {
          document.body?.classList?.toggle('sniper-scope-active', shouldShow);
          const ch = this.crosshairEl || document.getElementById?.('crosshair');
          ch?.classList?.toggle('scope-hidden', shouldShow);
        }
        if (!shouldShow && st.transform !== '') {
          st.transform = '';
          if (this.sniperScopeStageEl?.style) this.sniperScopeStageEl.style.transform = '';
        }
      }

      if (!shouldShow) return;

      const theme = SNIPER_SCOPE_THEMES[scopeTheme] || SNIPER_SCOPE_THEMES.pcc_cobalt;
      const zoomStr = String(zoomLabel || '4.0X').toUpperCase();
      const nextLabel = `${theme.headerPrefix} ${zoomStr}`;
      if (st.label !== nextLabel) {
        st.label = nextLabel;
        this.sniperScopeLabelEl.textContent = nextLabel;
      }

      const clampedDist = Math.max(0, Math.min(999, Math.round(Number(distanceMeters) || 0)));
      const nextRange = `ALVO: ${String(clampedDist).padStart(3, '0')}m`;
      if (st.range !== nextRange) {
        st.range = nextRange;
        this.sniperScopeRangeEl.textContent = nextRange;
      }

      const magVal = Math.max(0, Math.floor(Number(inMag) || 0));
      const maxMag = Math.max(1, Math.floor(Number(magSize) || 18));
      const resVal = Math.max(0, Math.floor(Number(reserve) || 0));
      const nextAmmo = `${magVal} / ${resVal}`;
      if (st.ammo !== nextAmmo) {
        st.ammo = nextAmmo;
        this.sniperScopeAmmoEl.textContent = nextAmmo;
      }

      const isLow = magVal <= Math.ceil(maxMag * 0.25);
      if (st.lowAmmo !== isLow) {
        st.lowAmmo = isLow;
        this.sniperScopeAmmoEl.classList.toggle('is-low-ammo', isLow);
      }

      const kick = Math.max(0, Math.min(1.2, Number(recoilKick) || 0));
      const nextTransform = kick > 0.005
        ? `translate3d(0, ${(-kick * 9.5).toFixed(2)}px, 0) scale(${(1 + kick * 0.034).toFixed(4)})`
        : '';
      if (st.transform !== nextTransform) {
        st.transform = nextTransform;
        if (this.sniperScopeStageEl?.style) {
          this.sniperScopeStageEl.style.transform = nextTransform;
        }
      }
    }
  });
}
