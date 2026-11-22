import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export const SNIPER_SCOPE_THEMES = Object.freeze({
  classic_black: Object.freeze({
    postStroke: '#020305',
    crossStroke: '#050608'
  }),
  pcc_cobalt: Object.freeze({
    postStroke: '#020305',
    crossStroke: '#050608'
  })
});

const ZOOM_ADJUST_FADE_MS = 650;

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

function formatScopeZoom(zoom, zoomLabel) {
  if (typeof zoomLabel === 'string' && zoomLabel.trim().length > 0) {
    return zoomLabel.trim().toUpperCase();
  }
  const num = Number(zoom);
  const clamped = Number.isFinite(num) && num > 0 ? Math.max(1.0, Math.min(100.0, num)) : 4.0;
  return `${clamped.toFixed(1)}X`;
}

function buildMinimalistCrosshairSvg() {
  return `
    <svg class="sniper-scope-svg" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <clipPath id="sniperScopeLensClip">
          <circle cx="300" cy="300" r="300"/>
        </clipPath>
      </defs>
      <g clip-path="url(#sniperScopeLensClip)">
        <line x1="155" y1="300" x2="445" y2="300" stroke="rgba(255, 255, 255, 0.22)" stroke-width="2.4"/>
        <line x1="300" y1="155" x2="300" y2="445" stroke="rgba(255, 255, 255, 0.22)" stroke-width="2.4"/>
        <line x1="155" y1="300" x2="445" y2="300" stroke="#050608" stroke-width="1.25"/>
        <line x1="300" y1="155" x2="300" y2="445" stroke="#050608" stroke-width="1.25"/>
        <line x1="0" y1="300" x2="155" y2="300" stroke="#020305" stroke-width="3.2"/>
        <line x1="445" y1="300" x2="600" y2="300" stroke="#020305" stroke-width="3.2"/>
        <line x1="300" y1="0" x2="300" y2="155" stroke="#020305" stroke-width="3.2"/>
        <line x1="300" y1="445" x2="300" y2="600" stroke="#020305" stroke-width="3.2"/>
      </g>
    </svg>
  `;
}

/**
 * Luneta Sniper Clássica Minimalista (Exterior 100% preto #000000 + Lente circular limpa + Cruz preta).
 * Oculta a mira padrão #crosshair e exibe indicação discreta de zoom (1.0X a 10.0X) no canto externo.
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

      const stage = obtainScopeNode('div', 'sniper-scope-reticle-stage', 'sniper-scope-reticle-stage');
      const svgHolder = obtainScopeNode('div', 'sniper-scope-svg-wrap', 'sniper-scope-svg-wrap');
      svgHolder.innerHTML = buildMinimalistCrosshairSvg();

      const vignetteMask = obtainScopeNode('div', 'sniper-scope-vignette', 'sniper-scope-vignette');
      const zoomEl = obtainScopeNode('span', 'sniper-scope-zoom', 'sniper-scope-zoom-txt');
      zoomEl.textContent = '4.0X';

      stage.appendChild(svgHolder);
      stage.appendChild(vignetteMask);

      overlay.appendChild(stage);
      overlay.appendChild(zoomEl);

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
      this.sniperScopeZoomEl = zoomEl;
      this.isSniperScopeActive = false;
      this._sniperScopeState = {
        active: false,
        zoom: '4.0X',
        transform: '',
        adjustTimer: null
      };
    },

    updateSniperScopeHud({
      active = false,
      zoom = 4.0,
      zoomLabel = null,
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
      let justActivated = false;

      if (st.active !== shouldShow) {
        justActivated = shouldShow;
        st.active = shouldShow;
        this.isSniperScopeActive = shouldShow;
        this.sniperScopeOverlayEl.classList.toggle('hidden', !shouldShow);
        this.sniperScopeOverlayEl.classList.toggle('is-active', shouldShow);
        if (typeof document !== 'undefined') {
          document.body?.classList?.toggle('sniper-scope-active', shouldShow);
          const ch = this.crosshairEl || document.getElementById?.('crosshair');
          ch?.classList?.toggle('scope-hidden', shouldShow);
        }
        if (!shouldShow) {
          if (st.adjustTimer) {
            clearTimeout(st.adjustTimer);
            st.adjustTimer = null;
          }
          this.sniperScopeZoomEl?.classList?.remove('is-adjusting');
          if (st.transform !== '') {
            st.transform = '';
            if (this.sniperScopeStageEl?.style) this.sniperScopeStageEl.style.transform = '';
          }
        }
      }

      if (!shouldShow) return;

      const nextZoom = formatScopeZoom(zoom, zoomLabel);
      if (justActivated) {
        if (st.zoom !== nextZoom) {
          st.zoom = nextZoom;
          if (this.sniperScopeZoomEl) this.sniperScopeZoomEl.textContent = nextZoom;
        }
      } else if (st.zoom !== nextZoom) {
        st.zoom = nextZoom;
        if (this.sniperScopeZoomEl) {
          this.sniperScopeZoomEl.textContent = nextZoom;
          this.sniperScopeZoomEl.classList?.add('is-adjusting');
          if (st.adjustTimer) clearTimeout(st.adjustTimer);
          st.adjustTimer = setTimeout(() => {
            st.adjustTimer = null;
            this.sniperScopeZoomEl?.classList?.remove('is-adjusting');
          }, ZOOM_ADJUST_FADE_MS);
          st.adjustTimer?.unref?.();
        }
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
