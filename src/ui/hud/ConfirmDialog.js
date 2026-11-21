import { soundFX } from '../../audio/SoundFX.js';
import { UI_TEXTS } from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

function getActiveSfxContext() {
  if (!soundFX || typeof soundFX._ensureContext !== 'function') return null;
  const vol = (soundFX.masterVolume ?? 0.85) * (soundFX.sfxVolume ?? 0.9);
  return vol > 0.01 ? soundFX._ensureContext() : null;
}

/** 1. Foco / Movimento: tick sutil e nítido (triangle 290 Hz -> 390 Hz em 0.028s, ganho 0.042). */
export function playMenuMoveSound() {
  const ctx = getActiveSfxContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(390, now + 0.028);
    gain.gain.setValueAtTime(0.042, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
    osc.connect(gain);
    gain.connect(soundFX.sfxBus || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.032);
  } catch (_) { /* headless safe */ }
}

/** 2. Confirmação: pulso duplo quente (triangle 420 Hz -> 630 Hz + sine 210 Hz, 0.085s, ganho 0.075). */
export function playMenuConfirmSound() {
  const ctx = getActiveSfxContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const oscLead = ctx.createOscillator();
    const oscSub = ctx.createOscillator();
    const gain = ctx.createGain();
    oscLead.type = 'triangle';
    oscLead.frequency.setValueAtTime(420, now);
    oscLead.frequency.exponentialRampToValueAtTime(630, now + 0.085);
    oscSub.type = 'sine';
    oscSub.frequency.setValueAtTime(210, now);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    oscLead.connect(gain);
    oscSub.connect(gain);
    gain.connect(soundFX.sfxBus || ctx.destination);
    oscLead.start(now);
    oscSub.start(now);
    oscLead.stop(now + 0.09);
    oscSub.stop(now + 0.09);
  } catch (_) { /* headless safe */ }
}

/** 3. Voltar / Cancelar: tom descendente limpo (triangle 350 Hz -> 210 Hz em 0.07s, ganho 0.06). */
export function playMenuBackSound() {
  const ctx = getActiveSfxContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.07);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(soundFX.sfxBus || ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  } catch (_) { /* headless safe */ }
}

function obtainEl(tag, id, classes = [], text = '') {
  if (typeof document === 'undefined') return null;
  let el = id && typeof document.getElementById === 'function' ? document.getElementById(id) : null;
  if (!el && typeof document.createElement === 'function') {
    el = document.createElement(tag);
    if (el && id) el.id = id;
  } else if (el && globalThis.__testEnvReady && el.tagName !== tag.toUpperCase()) {
    try { el.tagName = tag.toUpperCase(); } catch (_) { /* readonly guard */ }
  }
  if (!el) return null;
  if (classes.length) el.classList?.add(...classes);
  if (text) el.textContent = text;
  return el;
}

export function installConfirmDialog(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _ensureConfirmDialogDom() {
      if (this._confirmDialogBound && this.confirmDialogEl) return this.confirmDialogEl;
      if (typeof document === 'undefined') return null;

      const dialogEl = obtainEl('div', 'menu-confirm-dialog');
      if (!dialogEl) return null;

      const hasStructure =
        Boolean(dialogEl.classList?.contains('menu-confirm-dialog')) &&
        ((Array.isArray(dialogEl.children) && dialogEl.children.length > 0) ||
          Boolean(dialogEl.querySelector?.('.confirm-dialog-panel')));

      let panelEl, titleEl, msgEl, cancelBtn, acceptBtn;
      if (hasStructure) {
        panelEl = dialogEl.querySelector?.('.confirm-dialog-panel') || dialogEl.children?.[0] || null;
        titleEl = document.getElementById?.('confirm-dialog-title') || null;
        msgEl = document.getElementById?.('confirm-dialog-msg') || null;
        cancelBtn = document.getElementById?.('btn-confirm-cancel') || null;
        acceptBtn = document.getElementById?.('btn-confirm-accept') || null;
      } else if (typeof document.createElement === 'function') {
        dialogEl.classList?.add('menu-confirm-dialog', 'hidden');
        dialogEl.setAttribute?.('role', 'dialog');
        dialogEl.setAttribute?.('aria-modal', 'true');

        panelEl = obtainEl('div', '', ['confirm-dialog-panel']);
        titleEl = obtainEl('div', 'confirm-dialog-title', ['confirm-dialog-title'], 'CONFIRMAR');
        msgEl = obtainEl('div', 'confirm-dialog-msg', ['confirm-dialog-msg']);
        const actionsEl = obtainEl('div', '', ['confirm-dialog-actions']);
        cancelBtn = obtainEl('button', 'btn-confirm-cancel', ['tactical-btn', 'confirm-dialog-btn'], 'CANCELAR');
        acceptBtn = obtainEl('button', 'btn-confirm-accept', ['tactical-btn', 'confirm-dialog-btn'], 'CONFIRMAR');
        for (const btn of [cancelBtn, acceptBtn]) {
          if (btn) {
            btn.type = 'button';
            btn.setAttribute?.('type', 'button');
            actionsEl?.appendChild?.(btn);
          }
        }
        for (const child of [titleEl, msgEl, actionsEl]) {
          if (child) panelEl?.appendChild?.(child);
        }
        if (panelEl) dialogEl.appendChild?.(panelEl);
        const host = document.getElementById?.('ui-overlay') || document.body;
        if (host && !dialogEl.parentNode) host.appendChild?.(dialogEl);
      }

      this.confirmDialogEl = dialogEl;
      this.confirmDialogPanelEl = panelEl;
      this.confirmDialogTitleEl = titleEl;
      this.confirmDialogMsgEl = msgEl;
      this.btnConfirmCancelEl = cancelBtn;
      this.btnConfirmAcceptEl = acceptBtn;

      if (!this._confirmDialogBound) {
        this._confirmDialogBound = true;
        cancelBtn?.addEventListener?.('click', (e) => { e?.stopPropagation?.(); this.cancelConfirmDialog(); });
        acceptBtn?.addEventListener?.('click', (e) => { e?.stopPropagation?.(); this.acceptConfirmDialog(); });
        cancelBtn?.addEventListener?.('mouseover', () => {
          if (this.isConfirmDialogOpen && this._confirmFocusedBtn !== 'cancel') this._setConfirmDialogFocus('cancel', true);
        });
        acceptBtn?.addEventListener?.('mouseover', () => {
          if (this.isConfirmDialogOpen && this._confirmFocusedBtn !== 'confirm') this._setConfirmDialogFocus('confirm', true);
        });
        dialogEl?.addEventListener?.('click', (e) => {
          if (e?.target === dialogEl && this.isConfirmDialogOpen) this.cancelConfirmDialog();
        });
      }
      return dialogEl;
    },

    _setConfirmDialogFocus(target = 'confirm', withSound = false) {
      const next = target === 'cancel' ? 'cancel' : 'confirm';
      const changed = this._confirmFocusedBtn !== next;
      this._confirmFocusedBtn = next;
      this.btnConfirmCancelEl?.classList?.toggle('is-nav-focused', next === 'cancel');
      this.btnConfirmAcceptEl?.classList?.toggle('is-nav-focused', next === 'confirm');
      if (withSound && changed) playMenuMoveSound();
    },

    openConfirmDialog({
      title, message, confirmLabel, cancelLabel,
      danger = false, defaultFocus = 'confirm', onConfirm = null, onCancel = null
    } = {}) {
      this._ensureConfirmDialogDom();
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS?.[lang] || UI_TEXTS?.['pt-BR'] || {};
      const isEn = lang === 'en-US';

      this.isConfirmDialogOpen = true;
      this._confirmOnAccept = typeof onConfirm === 'function' ? onConfirm : null;
      this._confirmOnCancel = typeof onCancel === 'function' ? onCancel : null;

      if (this.confirmDialogTitleEl) this.confirmDialogTitleEl.textContent = title || (isEn ? 'CONFIRM OPERATION' : 'CONFIRMAR OPERAÇÃO');
      if (this.confirmDialogMsgEl) this.confirmDialogMsgEl.textContent = message || '';
      if (this.btnConfirmCancelEl) this.btnConfirmCancelEl.textContent = cancelLabel || t.confirmCancel || (isEn ? 'CANCEL' : 'CANCELAR');
      if (this.btnConfirmAcceptEl) this.btnConfirmAcceptEl.textContent = confirmLabel || t.confirmYes || (isEn ? 'CONFIRM' : 'CONFIRMAR');

      const isDanger = Boolean(danger);
      this.confirmDialogPanelEl?.classList?.toggle('is-danger', isDanger);
      this.btnConfirmAcceptEl?.classList?.toggle('danger-btn', isDanger);
      this.confirmDialogEl?.classList?.remove('hidden');

      this._setConfirmDialogFocus(defaultFocus === 'cancel' ? 'cancel' : 'confirm', false);
      this.refreshMenuKeyHints?.();
    },

    stepConfirmDialogFocus() {
      if (!this.isConfirmDialogOpen) return;
      this._setConfirmDialogFocus(this._confirmFocusedBtn === 'cancel' ? 'confirm' : 'cancel', true);
    },

    acceptConfirmDialog() { this.closeConfirmDialog(true); },
    cancelConfirmDialog() { this.closeConfirmDialog(false); },

    closeConfirmDialog(confirmed = false) {
      if (!this.isConfirmDialogOpen) {
        this.confirmDialogEl?.classList?.add('hidden');
        return;
      }
      const isAccepted = Boolean(confirmed);
      const cb = isAccepted ? this._confirmOnAccept : this._confirmOnCancel;
      this._confirmOnAccept = null;
      this._confirmOnCancel = null;

      this.isConfirmDialogOpen = false;
      this.confirmDialogEl?.classList?.add('hidden');
      this.btnConfirmCancelEl?.classList?.remove('is-nav-focused');
      this.btnConfirmAcceptEl?.classList?.remove('is-nav-focused');

      if (isAccepted) playMenuConfirmSound();
      else playMenuBackSound();

      cb?.();
      if (!this.isConfirmDialogOpen) this.refreshMenuNavigationFocus?.(false);
    }
  });
}
