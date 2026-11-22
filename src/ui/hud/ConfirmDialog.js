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

function obtainEl(tag, id = '', classes = [], text = '') {
  if (typeof document === 'undefined') return null;
  let el = id && typeof document.getElementById === 'function' ? document.getElementById(id) : null;
  if (!el && typeof document.createElement === 'function') { el = document.createElement(tag); if (el && id) el.id = id; }
  else if (el && globalThis.__testEnvReady && el.tagName !== tag.toUpperCase()) { try { el.tagName = tag.toUpperCase(); } catch (_) { /* readonly */ } }
  if (!el) return null;
  if (classes.length) el.classList?.add(...classes);
  if (text) el.textContent = text;
  return el;
}

function clearActionButtons(container) {
  if (!container) return;
  if (typeof Element !== 'undefined' && container instanceof Element) {
    if (typeof container.replaceChildren === 'function') container.replaceChildren();
    else container.innerHTML = '';
  } else {
    container.innerHTML = '';
    if (Array.isArray(container.children)) container.children.length = 0;
  }
}

export function installConfirmDialog(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _ensureConfirmDialogDom() {
      if (this._confirmDialogBound && this.confirmDialogEl) return this.confirmDialogEl;
      if (typeof document === 'undefined') return null;
      const dialogEl = obtainEl('div', 'menu-confirm-dialog');
      if (!dialogEl) return null;
      const hasStructure = Boolean(dialogEl.classList?.contains('menu-confirm-dialog')) &&
        ((Array.isArray(dialogEl.children) && dialogEl.children.length > 0) || Boolean(dialogEl.querySelector?.('.confirm-dialog-panel')));

      let panelEl, titleEl, msgEl, actionsEl;
      if (hasStructure) {
        panelEl = dialogEl.querySelector?.('.confirm-dialog-panel') || dialogEl.children?.[0] || null;
        titleEl = document.getElementById?.('confirm-dialog-title') || null;
        msgEl = document.getElementById?.('confirm-dialog-msg') || null;
        actionsEl = panelEl?.querySelector?.('.confirm-dialog-actions') || panelEl?.children?.find?.((c) => c?.classList?.contains?.('confirm-dialog-actions')) || null;
      } else if (typeof document.createElement === 'function') {
        dialogEl.classList?.add('menu-confirm-dialog', 'hidden');
        dialogEl.setAttribute?.('role', 'dialog');
        dialogEl.setAttribute?.('aria-modal', 'true');
        panelEl = obtainEl('div', '', ['confirm-dialog-panel']);
        titleEl = obtainEl('div', 'confirm-dialog-title', ['confirm-dialog-title'], 'CONFIRMAR');
        msgEl = obtainEl('div', 'confirm-dialog-msg', ['confirm-dialog-msg']);
        actionsEl = obtainEl('div', 'confirm-dialog-actions', ['confirm-dialog-actions']);
        for (const ch of [titleEl, msgEl, actionsEl]) if (ch) panelEl?.appendChild?.(ch);
        if (panelEl) dialogEl.appendChild?.(panelEl);
        const host = document.getElementById?.('ui-overlay') || document.body;
        if (host && !dialogEl.parentNode) host.appendChild?.(dialogEl);
      }
      if (!actionsEl && panelEl) {
        actionsEl = obtainEl('div', 'confirm-dialog-actions', ['confirm-dialog-actions']);
        if (actionsEl) panelEl.appendChild?.(actionsEl);
      }
      this.confirmDialogEl = dialogEl;
      this.confirmDialogPanelEl = panelEl;
      this.confirmDialogTitleEl = titleEl;
      this.confirmDialogMsgEl = msgEl;
      this.confirmDialogActionsEl = actionsEl;
      if (!this._confirmDialogBound) {
        this._confirmDialogBound = true;
        dialogEl?.addEventListener?.('click', (e) => { if (e?.target === dialogEl && this.isConfirmDialogOpen) this.cancelConfirmDialog(); });
      }
      return dialogEl;
    },

    _renderConfirmOptionButtons(optionsList) {
      clearActionButtons(this.confirmDialogActionsEl);
      this._confirmButtonEls = [];
      this.btnConfirmCancelEl = null;
      this.btnConfirmAcceptEl = null;
      optionsList.forEach((opt, idx) => {
        const btn = opt.domId ? obtainEl('button', opt.domId) : document.createElement?.('button');
        if (!btn) return;
        try { btn.type = 'button'; } catch (_) { /* readonly */ }
        btn.setAttribute?.('type', 'button');
        btn.classList?.remove('danger-btn', 'primary-btn', 'is-danger', 'is-nav-focused');
        btn.classList?.add('tactical-btn', 'confirm-dialog-btn');
        if (opt.danger) btn.classList?.add('danger-btn');
        if (opt.primary) btn.classList?.add('primary-btn');
        if (btn.dataset) btn.dataset.optionId = opt.id;
        btn.textContent = opt.label;
        btn._confirmIdx = idx;
        if (!btn._confirmBound) {
          btn._confirmBound = true;
          btn.addEventListener?.('click', (e) => {
            e?.stopPropagation?.();
            if (!this.isConfirmDialogOpen) return;
            const i = Number(btn._confirmIdx ?? 0);
            this._setConfirmDialogFocusIndex(i, false);
            if (!this._confirmHasCustomOptions && this._confirmOptions?.[i]?.isCancel) this.cancelConfirmDialog();
            else this.acceptConfirmDialog();
          });
          btn.addEventListener?.('mouseover', () => {
            const i = Number(btn._confirmIdx ?? 0);
            if (this.isConfirmDialogOpen && this._confirmFocusIdx !== i) this._setConfirmDialogFocusIndex(i, true);
          });
        }
        if (opt.domId === 'btn-confirm-cancel') this.btnConfirmCancelEl = btn;
        if (opt.domId === 'btn-confirm-accept') this.btnConfirmAcceptEl = btn;
        this.confirmDialogActionsEl?.appendChild?.(btn);
        this._confirmButtonEls.push(btn);
      });
    },

    _setConfirmDialogFocusIndex(index = 0, withSound = false) {
      const opts = this._confirmOptions || [];
      if (!opts.length) return;
      const clamped = ((Number(index) % opts.length) + opts.length) % opts.length;
      const changed = this._confirmFocusIdx !== clamped;
      this._confirmFocusIdx = clamped;
      this._confirmFocusedBtn = opts[clamped]?.id || (clamped === 0 ? 'cancel' : 'confirm');
      (this._confirmButtonEls || []).forEach((btn, idx) => btn?.classList?.toggle('is-nav-focused', idx === clamped));
      if (withSound && changed) playMenuMoveSound();
    },

    _setConfirmDialogFocus(target = 'confirm', withSound = false) {
      const opts = this._confirmOptions || [];
      if (typeof target === 'number') return this._setConfirmDialogFocusIndex(target, withSound);
      const found = opts.findIndex((o) => o.id === target);
      this._setConfirmDialogFocusIndex(found !== -1 ? found : target === 'cancel' ? 0 : Math.min(1, opts.length - 1), withSound);
    },

    openConfirmDialog(rawConfig = {}) {
      const { title, message, options, confirmLabel, cancelLabel, danger = false, defaultFocus, onConfirm = null, onCancel = null } = rawConfig;
      this._ensureConfirmDialogDom();
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS?.[lang] || UI_TEXTS?.['pt-BR'] || {};
      const isEn = lang === 'en-US';
      const hasCustom = Array.isArray(options) && options.length > 0;
      this.isConfirmDialogOpen = true;
      this._confirmHasCustomOptions = hasCustom;
      this._confirmOnAccept = typeof onConfirm === 'function' ? onConfirm : null;
      this._confirmOnCancel = typeof onCancel === 'function' ? onCancel : null;
      this._confirmOptions = hasCustom
        ? options.map((opt, i) => ({ id: opt?.id || `opt-${i}`, domId: opt?.domId || (opt?.id ? `btn-confirm-${opt.id}` : ''), label: String(opt?.label ?? ''), danger: Boolean(opt?.danger), primary: Boolean(opt?.primary), isCancel: false, onSelect: typeof opt?.onSelect === 'function' ? opt.onSelect : null }))
        : [
            { id: 'cancel', domId: 'btn-confirm-cancel', label: cancelLabel || t.confirmCancel || (isEn ? 'CANCEL' : 'CANCELAR'), danger: false, primary: false, isCancel: true, onSelect: this._confirmOnCancel },
            { id: 'confirm', domId: 'btn-confirm-accept', label: confirmLabel || t.confirmYes || (isEn ? 'CONFIRM' : 'CONFIRMAR'), danger: Boolean(danger), primary: !danger, isCancel: false, onSelect: this._confirmOnAccept }
          ];
      if (this.confirmDialogTitleEl) this.confirmDialogTitleEl.textContent = title || (isEn ? 'CONFIRM OPERATION' : 'CONFIRMAR OPERAÇÃO');
      if (this.confirmDialogMsgEl) this.confirmDialogMsgEl.textContent = message || '';
      this._renderConfirmOptionButtons(this._confirmOptions);
      this.confirmDialogPanelEl?.classList?.toggle('is-danger', Boolean(danger));
      this.confirmDialogPanelEl?.classList?.toggle('has-three-options', this._confirmOptions.length >= 3);
      this.confirmDialogEl?.classList?.remove('hidden');
      const startIdx = hasCustom
        ? (typeof defaultFocus === 'number' ? defaultFocus : typeof defaultFocus === 'string' ? Math.max(0, this._confirmOptions.findIndex((o) => o.id === defaultFocus)) : 0)
        : (defaultFocus === 'cancel' ? 0 : 1);
      this._confirmFocusIdx = -1;
      this._setConfirmDialogFocusIndex(startIdx, false);
      this.refreshMenuKeyHints?.();
    },

    stepConfirmDialogFocus(dir = 1) {
      if (this.isConfirmDialogOpen && this._confirmOptions?.length) this._setConfirmDialogFocusIndex((this._confirmFocusIdx ?? 0) + (Number(dir) < 0 ? -1 : 1), true);
    },

    _teardownOpenConfirmDialog() {
      this._confirmOnAccept = null;
      this._confirmOnCancel = null;
      this.isConfirmDialogOpen = false;
      this.confirmDialogEl?.classList?.add('hidden');
      this.confirmDialogPanelEl?.classList?.remove('has-three-options');
      (this._confirmButtonEls || []).forEach((btn) => btn?.classList?.remove('is-nav-focused'));
    },

    acceptConfirmDialog() {
      if (!this.isConfirmDialogOpen) { this.confirmDialogEl?.classList?.add('hidden'); return; }
      const chosen = this._confirmOptions?.[this._confirmFocusIdx ?? 0];
      if (!this._confirmHasCustomOptions && chosen?.isCancel) return this.cancelConfirmDialog();
      const cb = chosen?.onSelect || (!this._confirmHasCustomOptions ? this._confirmOnAccept : null);
      this._teardownOpenConfirmDialog();
      playMenuConfirmSound();
      cb?.();
      if (!this.isConfirmDialogOpen) this.refreshMenuNavigationFocus?.(false);
    },

    cancelConfirmDialog() {
      if (!this.isConfirmDialogOpen) { this.confirmDialogEl?.classList?.add('hidden'); return; }
      const cb = this._confirmOnCancel;
      this._teardownOpenConfirmDialog();
      playMenuBackSound();
      cb?.();
      if (!this.isConfirmDialogOpen) this.refreshMenuNavigationFocus?.(false);
    },

    closeConfirmDialog(confirmed = false) {
      if (!confirmed) return this.cancelConfirmDialog();
      if (!this.isConfirmDialogOpen) { this.confirmDialogEl?.classList?.add('hidden'); return; }
      if (this._confirmHasCustomOptions) return this.acceptConfirmDialog();
      const cb = this._confirmOnAccept;
      this._teardownOpenConfirmDialog();
      playMenuConfirmSound();
      cb?.();
      if (!this.isConfirmDialogOpen) this.refreshMenuNavigationFocus?.(false);
    }
  });
}
