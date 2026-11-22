import { soundFX } from '../../audio/SoundFX.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export const HITMARKER_NORMAL_DURATION_MS = 120;
export const HITMARKER_HEADSHOT_DURATION_MS = 165;
export const HITMARKER_KILL_DURATION_MS = 220;
export const KILL_FLASH_FALLBACK_DURATION_MS = 180;
export const KILL_CATEGORIES = Object.freeze(['police', 'civilian', 'cv', 'pcc', 'ares']);

const SPOKE_CLASSES = ['hm-tl', 'hm-tr', 'hm-bl', 'hm-br'];

export function classifyKillCategory(victim) {
  if (typeof victim === 'string') {
    const norm = victim.trim().toLowerCase();
    if (KILL_CATEGORIES.includes(norm)) return norm;
    if (norm === 'guard') return 'police';
    return 'civilian';
  }
  const fac = String(victim?.faction || victim?.npcRef?.faction || '').trim().toLowerCase();
  if (fac === 'cv' || fac === 'pcc' || fac === 'ares') return fac;
  if (fac === 'guard' || fac === 'police') return 'police';
  if (
    victim?.isPoliceUnit ||
    victim?.npcRef?.isPoliceUnit ||
    victim?.kind === 'police' ||
    victim?.npcRef?.kind === 'police' ||
    victim?.type === 'police_helicopter' ||
    victim?.type === 'police_car' ||
    victim?.type === 'police_officer'
  ) {
    return 'police';
  }
  if (
    victim?.isCivilianPedestrian ||
    victim?.npcRef?.isCivilianPedestrian ||
    victim?.type === 'pedestrian_civilian' ||
    victim?.kind === 'civilian' ||
    victim?.npcRef?.kind === 'civilian'
  ) {
    return 'civilian';
  }
  return 'civilian';
}

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
    _ensureSessionKills() {
      if (!this.sessionKills || typeof this.sessionKills !== 'object') {
        this.sessionKills = { total: 0, police: 0, civilian: 0, cv: 0, pcc: 0, ares: 0 };
      } else {
        for (const cat of KILL_CATEGORIES) {
          const v = Number(this.sessionKills[cat]);
          this.sessionKills[cat] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
        }
        const sum =
          this.sessionKills.police +
          this.sessionKills.civilian +
          this.sessionKills.cv +
          this.sessionKills.pcc +
          this.sessionKills.ares;
        const rawTotal = Number(this.sessionKills.total);
        this.sessionKills.total = Number.isFinite(rawTotal) && rawTotal >= sum ? Math.floor(rawTotal) : sum;
      }
      return this.sessionKills;
    },

    resetSessionKills(initial = null) {
      const src = initial && typeof initial === 'object' ? initial : null;
      const next = { total: 0, police: 0, civilian: 0, cv: 0, pcc: 0, ares: 0 };
      if (src) {
        for (const cat of KILL_CATEGORIES) {
          const v = Number(src[cat]);
          next[cat] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
        }
        const sum = next.police + next.civilian + next.cv + next.pcc + next.ares;
        const rawTotal = Number(src.total);
        next.total = Number.isFinite(rawTotal) && rawTotal >= sum ? Math.floor(rawTotal) : sum;
      }
      this.sessionKills = next;
      this._playerKillCount = next.total;
      if (this.isPauseMenuOpen) this._updatePauseHeroCard?.();
      return { ...this.sessionKills };
    },

    getSessionKills() {
      return { ...this._ensureSessionKills() };
    },

    recordPlayerKill(victimOrCategory, count = 1) {
      const stats = this._ensureSessionKills();
      const cat = classifyKillCategory(victimOrCategory);
      const n = Math.max(1, Math.floor(Number(count) || 1));
      stats[cat] = (stats[cat] || 0) + n;
      stats.total = (stats.total || 0) + n;
      this._playerKillCount = stats.total;
      return { category: cat, added: n, total: stats.total };
    },

    _initHitmarkerHud() {
      const stats = this._ensureSessionKills();
      if (typeof this._playerKillCount !== 'number') this._playerKillCount = stats.total;
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
      el.classList?.remove('is-visible', 'is-hit', 'is-headshot', 'is-kill');
      if (el.dataset) el.dataset.variant = '';
      if (el.style) {
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%, -50%) scale(0.88)';
      }
    },

    triggerHitmarker(isKill = false, opts = {}) {
      this._initHitmarkerHud();
      const kill = Boolean(isKill);
      const isHeadshot = Boolean(opts?.isHeadshot) && !kill;
      const variant = kill ? 'kill' : isHeadshot ? 'headshot' : 'hit';
      const durationMs = kill
        ? HITMARKER_KILL_DURATION_MS
        : isHeadshot
          ? HITMARKER_HEADSHOT_DURATION_MS
          : HITMARKER_NORMAL_DURATION_MS;

      // Reinicia o timer sem somar/acumular em rajadas rápidas
      if (this._hitmarkerTimeout) {
        clearTimeout(this._hitmarkerTimeout);
        this._hitmarkerTimeout = null;
      }

      this._hitmarkerRemainingSec = durationMs / 1000;
      this._hitmarkerTotalSec = this._hitmarkerRemainingSec;
      this.isHitmarkerVisible = true;
      this.hitmarkerVariant = variant;

      const el = this.hitmarkerEl;
      if (el) {
        el.classList?.remove('hidden', 'is-hit', 'is-headshot', 'is-kill');
        el.classList?.add('is-visible', `is-${variant}`);
        if (el.dataset) {
          el.dataset.variant = variant;
        }
        if (el.style) {
          el.style.opacity = '1';
          el.style.transform = kill
            ? 'translate(-50%, -50%) scale(1.38)'
            : isHeadshot
              ? 'translate(-50%, -50%) scale(1.24)'
              : 'translate(-50%, -50%) scale(1)';
        }
      }

      if (isHeadshot) {
        if (typeof soundFX.playHeadshotTink === 'function') {
          soundFX.playHeadshotTink();
        } else {
          soundFX.playHitmarkerTick?.();
        }
      } else if (!kill) {
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

    triggerPlayerKillFeedback(victimObj = null, opts = {}) {
      this._initHitmarkerHud();
      if (Array.isArray(opts?.categories) && opts.categories.length > 0) {
        for (const cat of opts.categories) {
          this.recordPlayerKill(cat, 1);
        }
      } else {
        this.recordPlayerKill(victimObj, Math.max(1, Math.floor(Number(opts?.killCount) || 1)));
      }
      this._lastKilledVictim = victimObj || null;
      this._lastKillWasHeadshot = Boolean(opts?.isHeadshot);

      // Hitmarker vermelho arterial sempre aparece no centro da mira ao eliminar (1x por evento)
      this.triggerHitmarker(true, opts);

      const fxEnabled = this.settings?.killEffect !== false;
      if (fxEnabled) {
        if (opts?.isHeadshot) soundFX.playHeadshotTink?.();
        soundFX.playKillConfirm?.();
        if (typeof this.onTriggerKillFlash === 'function') {
          this.onTriggerKillFlash(victimObj);
        } else {
          this._pulseCssKillFlashFallback();
        }
      } else {
        this._clearCssKillFlashFallback();
      }
      if (this.isPauseMenuOpen) {
        this._updatePauseHeroCard?.();
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
