import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

const FPS_REFRESH_INTERVAL_SEC = 0.25;
const WORST_BUCKET_INTERVAL_SEC = 0.5;
const FLOAT_EPS = 1e-6;

function getDocById(id) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    return null;
  }
  return document.getElementById(id);
}

function isAttachedNode(el, parentCandidate) {
  if (!el) return false;
  if (el.isConnected || el.parentNode) return true;
  if (Array.isArray(parentCandidate?.children) && parentCandidate.children.includes(el)) {
    return true;
  }
  return false;
}

/**
 * Instala na HUD a telemetria enxuta e frameless de FPS / Frame-Time (`#hud-fps-counter`),
 * operando com janela móvel de 0,5s (média), pior quadro de 1,0s em O(1) (zero arrays/GC)
 * e atualização de DOM limitada a no máximo 4×/s.
 */
export function installFpsCounterHud(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _initFpsCounterHud() {
      if (!this.settings || typeof this.settings !== 'object') {
        this.settings = { showFps: true };
      } else if (this.settings.showFps === undefined) {
        this.settings.showFps = true;
      }

      // Acumuladores escalares O(1) — zero alocações no heap por frame
      this._fpsCurMsSum = 0;
      this._fpsCurCount = 0;
      this._fpsPrevMsSum = 0;
      this._fpsPrevCount = 0;
      this._fpsRefreshAccumSec = 0;

      // Rastreador de pior quadro nos últimos ~0,5–1,0s em dois baldes de 0,5s
      this._worstHalfA = 0;
      this._worstHalfB = 0;
      this._worstBucketSec = 0;

      this._fpsRefreshCount = 0;
      this._lastFpsText = '';
      this._lastFpsTier = '';
      this._lastWorstMsStr = '';

      if (!this.fpsStats || typeof this.fpsStats !== 'object') {
        this.fpsStats = { fps: 0, avgMs: 0, worstMs: 0 };
      } else {
        this.fpsStats.fps = 0;
        this.fpsStats.avgMs = 0;
        this.fpsStats.worstMs = 0;
      }

      this._fpsHudInitialized = true;

      if (typeof document === 'undefined') return;

      let fpsEl = this.fpsCounterEl || getDocById('hud-fps-counter');
      if (!fpsEl && typeof document.createElement === 'function') {
        fpsEl = document.createElement('div');
        if (fpsEl) fpsEl.id = 'hud-fps-counter';
      }
      if (!fpsEl) return;

      fpsEl.classList?.add('hud-fps-counter');
      fpsEl.setAttribute?.('aria-hidden', 'true');

      const clusterHost = getDocById('top-right-cluster');
      const fallbackHost = clusterHost || getDocById('ui-overlay') || document.body;
      if (fallbackHost && !isAttachedNode(fpsEl, fallbackHost)) {
        const radioPill = getDocById('hud-tiktok-radio-pill');
        if (
          clusterHost &&
          radioPill &&
          radioPill.parentNode === clusterHost &&
          typeof clusterHost.insertBefore === 'function'
        ) {
          clusterHost.insertBefore(fpsEl, radioPill.nextSibling);
        } else {
          fallbackHost.appendChild?.(fpsEl);
        }
      }

      this.fpsCounterEl = fpsEl;
      this._syncFpsCounterVisibility();
    },

    _syncFpsCounterVisibility() {
      const el = this.fpsCounterEl;
      if (!el) return false;
      const shouldShow =
        this.settings?.showFps !== false &&
        !this.isTitleScreenActive &&
        !this.isLoadingActive;

      if (shouldShow) {
        if (this._fpsHiddenState !== false || el.classList?.contains?.('hidden')) {
          el.classList?.remove('hidden');
          if (el.style && el.style.display === 'none') {
            el.style.display = '';
          }
          this._fpsHiddenState = false;
        }
      } else if (this._fpsHiddenState !== true || !el.classList?.contains?.('hidden')) {
        el.classList?.add('hidden');
        if (el.style) {
          el.style.display = 'none';
        }
        this._fpsHiddenState = true;
      }
      return shouldShow;
    },

    setShowFpsEnabled(enabled) {
      if (!this._fpsHudInitialized) {
        this._initFpsCounterHud();
      }
      if (!this.settings || typeof this.settings !== 'object') {
        this.settings = {};
      }
      this.settings.showFps = Boolean(enabled);
      this._syncFpsCounterVisibility();
      return this.settings.showFps;
    },

    recordRenderFrameTiming(dtSec) {
      return this.updateFpsCounterHud(dtSec);
    },

    updateFpsCounterHud(dtSec) {
      if (!this._fpsHudInitialized) {
        this._initFpsCounterHud();
      }

      if (!this._syncFpsCounterVisibility()) {
        return false;
      }

      const rawDt = Number(dtSec);
      if (!Number.isFinite(rawDt) || rawDt <= 0) {
        return false;
      }

      const clampedDt = rawDt > 1.0 ? 1.0 : rawDt;
      const frameMs = clampedDt * 1000;

      this._fpsCurMsSum += frameMs;
      this._fpsCurCount += 1;
      this._fpsRefreshAccumSec += clampedDt;

      if (frameMs > this._worstHalfA) {
        this._worstHalfA = frameMs;
      }
      this._worstBucketSec += clampedDt;

      if (this._fpsRefreshAccumSec + FLOAT_EPS < FPS_REFRESH_INTERVAL_SEC) {
        return false;
      }

      const totalMs = this._fpsPrevMsSum + this._fpsCurMsSum;
      const totalCount = this._fpsPrevCount + this._fpsCurCount;
      const avgMs = totalCount > 0 ? totalMs / totalCount : frameMs;
      const fps = Math.min(999, Math.round(1000 / Math.max(0.5, avgMs)));
      const worstMs = Math.max(this._worstHalfA, this._worstHalfB);

      // Rotaciona janela de 0,5s (2 sub-janelas de 0,25s)
      this._fpsPrevMsSum = this._fpsCurMsSum;
      this._fpsPrevCount = this._fpsCurCount;
      this._fpsCurMsSum = 0;
      this._fpsCurCount = 0;
      this._fpsRefreshAccumSec =
        this._fpsRefreshAccumSec >= WORST_BUCKET_INTERVAL_SEC
          ? 0
          : Math.max(0, this._fpsRefreshAccumSec - FPS_REFRESH_INTERVAL_SEC);

      // Rotaciona rastreador de pior quadro de 1,0s (2 baldes de 0,5s)
      if (this._worstBucketSec + FLOAT_EPS >= WORST_BUCKET_INTERVAL_SEC) {
        this._worstHalfB = this._worstHalfA;
        this._worstHalfA = 0;
        this._worstBucketSec =
          this._worstBucketSec >= 1.0
            ? 0
            : Math.max(0, this._worstBucketSec - WORST_BUCKET_INTERVAL_SEC);
      }

      this.fpsStats.fps = fps;
      this.fpsStats.avgMs = avgMs;
      this.fpsStats.worstMs = worstMs;
      this._fpsRefreshCount += 1;

      const el = this.fpsCounterEl;
      if (!el) return true;

      const tier = fps >= 55 ? 'good' : fps >= 30 ? 'warn' : 'bad';
      const roundedWorst = Math.round(worstMs);
      const worstMsStr = String(roundedWorst);
      const nextText =
        worstMs >= 26
          ? `${fps} FPS · ${avgMs.toFixed(1)} ms (${roundedWorst} ms)`
          : `${fps} FPS · ${avgMs.toFixed(1)} ms`;

      if (this._lastFpsText !== nextText) {
        this._lastFpsText = nextText;
        el.textContent = nextText;
      }
      if (this._lastFpsTier !== tier) {
        this._lastFpsTier = tier;
        if (el.dataset) el.dataset.tier = tier;
      }
      if (this._lastWorstMsStr !== worstMsStr) {
        this._lastWorstMsStr = worstMsStr;
        if (el.dataset) el.dataset.worstMs = worstMsStr;
      }

      return true;
    }
  });
}
