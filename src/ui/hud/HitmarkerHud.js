import { soundFX } from '../../audio/SoundFX.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export const HITMARKER_NORMAL_DURATION_MS = 120;
export const HITMARKER_KILL_DURATION_MS = 220;
export const KILL_FLASH_FALLBACK_DURATION_MS = 180;

const SPOKE_CLASSES = ['hm-tl', 'hm-tr', 'hm-bl', 'hm-br'];

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

function ensureSpokesOnHitmarker(hitmarkerEl) {
  if (!hitmarkerEl || typeof document === 'undefined') return;
  const hasSpokes =
    (typeof Element !== 'undefined' &&
      hitmarkerEl instanceof Element &&
      Boolean(hitmarkerEl.querySelector('.hm-spoke'))) ||
    (Array.isArray(hitmarkerEl.children) &&
      hitmarkerEl.children.some((ch) => ch?.classList?.contains?.('hm-spoke')));
  if (hasSpokes || typeof document.createElement !== 'function') return;

  for (const spokeCls of SPOKE_CLASSES) {
    const spoke = document.createElement('span');
    if (!spoke) continue;
    spoke.classList?.add('hm-spoke', spokeCls);
    spoke.setAttribute?.('aria-hidden', 'true');
    hitmarkerEl.appendChild?.(spoke);
  }
}

/**
 * Instala na HUD os métodos de Hitmarker Tático Central (`#hud-hitmarker`)
 * e Feedback Audiovisual de Kill Estilo GTA V (`triggerPlayerKillFeedback`).
 */
export function installHitmarkerHud(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _initHitmarkerHud() {
      if (typeof this._playerKillCount !== 'number') this._playerKillCount = 0;
      if (typeof this._hitmarkerRemainingSec !== 'number') this._hitmarkerRemainingSec = 0;
      if (typeof this._hitmarkerTotalSec !== 'number') this._hitmarkerTotalSec = 0;
      if (typeof this._killFlashCssRemainingSec !== 'number') this._killFlashCssRemainingSec = 0;
      if (typeof this._killFlashCssIntensity !== 'number') this._killFlashCssIntensity = 0;

      if (typeof document === 'undefined') return;

      let hmEl = this.hitmarkerEl || getDocById('hud-hitmarker');
      if (!hmEl && typeof document.createElement === 'function') {
        hmEl = document.createElement('div');
        if (hmEl) hmEl.id = 'hud-hitmarker';
      }
      if (hmEl) {
        hmEl.classList?.add('hud-hitmarker');
        hmEl.setAttribute?.('aria-hidden', 'true');
        ensureSpokesOnHitmarker(hmEl);
        const host = getDocById('ui-overlay') || document.body;
        if (host && !isAttachedNode(hmEl, host)) {
          host.appendChild?.(hmEl);
        }
        this.hitmarkerEl = hmEl;
      }

      let flashEl = this.killFlashOverlayEl || getDocById('kill-flash-overlay');
      if (!flashEl && typeof document.createElement === 'function') {
        flashEl = document.createElement('div');
        if (flashEl) flashEl.id = 'kill-flash-overlay';
      }
      if (flashEl) {
        flashEl.classList?.add('kill-flash-overlay');
        flashEl.setAttribute?.('aria-hidden', 'true');
        if (!flashEl.classList?.contains?.('is-active') && !flashEl.style?.opacity) {
          if (flashEl.style) flashEl.style.opacity = '0';
        }
        if (document.body && !isAttachedNode(flashEl, document.body)) {
          document.body.appendChild?.(flashEl);
        }
        this.killFlashOverlayEl = flashEl;
      }
    },

    _hideHitmarkerDom() {
      if (this._hitmarkerTimeout) {
        clearTimeout(this._hitmarkerTimeout);
        this._hitmarkerTimeout = null;
      }
      this._hitmarkerRemainingSec = 0;
      this.isHitmarkerVisible = false;
      this.hitmarkerVariant = null;
      const el = this.hitmarkerEl;
      if (!el) return;
      el.classList?.remove('is-visible', 'is-hit', 'is-kill');
      if (el.dataset) el.dataset.variant = '';
      if (el.style) {
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%, -50%) scale(0.88)';
      }
    },

    triggerHitmarker(isKill = false) {
      this._initHitmarkerHud();
      const kill = Boolean(isKill);
      const durationMs = kill ? HITMARKER_KILL_DURATION_MS : HITMARKER_NORMAL_DURATION_MS;

      // Reinicia o timer sem somar/acumular em rajadas rápidas
      if (this._hitmarkerTimeout) {
        clearTimeout(this._hitmarkerTimeout);
        this._hitmarkerTimeout = null;
      }

      this._hitmarkerRemainingSec = durationMs / 1000;
      this._hitmarkerTotalSec = this._hitmarkerRemainingSec;
      this.isHitmarkerVisible = true;
      this.hitmarkerVariant = kill ? 'kill' : 'hit';

      const el = this.hitmarkerEl;
      if (el) {
        el.classList?.remove('hidden', 'is-hit', 'is-kill');
        el.classList?.add('is-visible', kill ? 'is-kill' : 'is-hit');
        if (el.dataset) {
          el.dataset.variant = kill ? 'kill' : 'hit';
        }
        if (el.style) {
          el.style.opacity = '1';
          el.style.transform = kill
            ? 'translate(-50%, -50%) scale(1.38)'
            : 'translate(-50%, -50%) scale(1)';
        }
      }

      if (!kill) {
        soundFX.playHitmarkerTick?.();
      }

      this._hitmarkerTimeout = setTimeout(() => {
        this._hitmarkerTimeout = null;
        this._hideHitmarkerDom();
      }, durationMs);
      this._hitmarkerTimeout?.unref?.();

      return true;
    },

    _pulseCssKillFlashFallback() {
      this._initHitmarkerHud();
      if (this._killFlashCssTimeout) {
        clearTimeout(this._killFlashCssTimeout);
        this._killFlashCssTimeout = null;
      }

      // Kills em sequência reiniciam o pulso em 1.0 (0.18s) sem somar acima de 1.0
      this._killFlashCssRemainingSec = KILL_FLASH_FALLBACK_DURATION_MS / 1000;
      this._killFlashCssIntensity = 1.0;

      const el = this.killFlashOverlayEl;
      if (el) {
        el.classList?.remove('hidden');
        el.classList?.add('is-active');
        if (el.style) el.style.opacity = '1';
      }

      this._killFlashCssTimeout = setTimeout(() => {
        this._killFlashCssTimeout = null;
        this._clearCssKillFlashFallback();
      }, KILL_FLASH_FALLBACK_DURATION_MS);
      this._killFlashCssTimeout?.unref?.();

      return true;
    },

    _clearCssKillFlashFallback() {
      if (this._killFlashCssTimeout) {
        clearTimeout(this._killFlashCssTimeout);
        this._killFlashCssTimeout = null;
      }
      this._killFlashCssRemainingSec = 0;
      this._killFlashCssIntensity = 0;
      const el = this.killFlashOverlayEl;
      if (!el) return;
      el.classList?.remove('is-active');
      if (el.style) el.style.opacity = '0';
    },

    triggerPlayerKillFeedback(victimObj = null) {
      this._initHitmarkerHud();
      this._playerKillCount = (this._playerKillCount || 0) + 1;
      this._lastKilledVictim = victimObj || null;

      // Hitmarker vermelho arterial sempre aparece no centro da mira ao eliminar
      this.triggerHitmarker(true);

      const fxEnabled = this.settings?.killEffect !== false;
      if (fxEnabled) {
        soundFX.playKillConfirm?.();
        if (typeof this.onTriggerKillFlash === 'function') {
          this.onTriggerKillFlash(victimObj);
        } else {
          this._pulseCssKillFlashFallback();
        }
      } else {
        this._clearCssKillFlashFallback();
      }
      return fxEnabled;
    },

    updateHitmarkerHud(dt = 0.016) {
      const step = Math.max(0, Number(dt) || 0);
      if (step <= 0) return;

      if (this._hitmarkerRemainingSec > 0) {
        this._hitmarkerRemainingSec = Math.max(0, this._hitmarkerRemainingSec - step);
        if (this._hitmarkerRemainingSec <= 0) {
          this._hideHitmarkerDom();
        }
      }

      if (this._killFlashCssRemainingSec > 0) {
        const durSec = KILL_FLASH_FALLBACK_DURATION_MS / 1000;
        this._killFlashCssRemainingSec = Math.max(0, this._killFlashCssRemainingSec - step);
        if (this._killFlashCssRemainingSec <= 0) {
          this._clearCssKillFlashFallback();
        } else {
          const k = Math.pow(this._killFlashCssRemainingSec / durSec, 1.6);
          this._killFlashCssIntensity = k;
          if (this.killFlashOverlayEl?.style) {
            this.killFlashOverlayEl.style.opacity = String(Number(k.toFixed(4)));
          }
        }
      }
    },

    clearHitmarkerHud() {
      this._hideHitmarkerDom();
      this._clearCssKillFlashFallback();
    }
  });
}
