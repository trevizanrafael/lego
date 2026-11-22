import { UI_TEXTS } from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';
import { playMenuMoveSound, playMenuConfirmSound, playMenuBackSound } from './ConfirmDialog.js';

const byId = (id) => (typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document.getElementById(id) : null);
const isNativeEl = (el) => typeof Element !== 'undefined' && el instanceof Element;
const hasCls = (el, c) => Boolean(el?.classList?.contains(c));

function isVisibleEnabled(el) {
  if (!el || el.disabled) return false;
  if (hasCls(el, 'hidden') || hasCls(el, 'slot-disabled') || hasCls(el, 'is-disabled')) return false;
  if (el.style?.display === 'none' || el.style?.visibility === 'hidden') return false;
  return !(typeof el.closest === 'function' && el.closest('.hidden'));
}

function querySubtree(container, selector, predicate) {
  if (!container) return [];
  if (isNativeEl(container)) return Array.from(container.querySelectorAll(selector)).filter(predicate);
  const out = [];
  const seen = new Set();
  const walk = (node) => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    if (node !== container && predicate(node)) out.push(node);
    if (Array.isArray(node.children)) for (const ch of node.children) walk(ch);
    if (Array.isArray(node._parsedChildren)) for (const ch of node._parsedChildren) walk(ch);
  };
  walk(container);
  return out;
}

const queryEnabled = (root, sel, pred) => querySubtree(root, sel, (el) => pred(el) && isVisibleEnabled(el));
const containsNode = (root, target) => Boolean(root && target) &&
  (root === target || (typeof root.contains === 'function' ? root.contains(target) : querySubtree(root, '*', (n) => n === target).length > 0));
const isRealBtn = (el) => Boolean(el) && (isNativeEl(el) || el.tagName === 'BUTTON' || Boolean(el.textContent) || hasCls(el, 'tactical-btn'));
const emitEvt = (el, type) => el?.dispatchEvent?.(typeof Event === 'function' ? new Event(type, { bubbles: true }) : { type, target: el, currentTarget: el });

export function installMenuFocusNavigation(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _initMenuNavigation() {
      this._menuFocusIndex = 0;
      this.isConfirmDialogOpen = Boolean(this.isConfirmDialogOpen);
      this._activeMenuContext = 'title-main';
      this._focusedMenuEl = null;
      this._trackedFocusedEls = [];

      if (typeof document !== 'undefined') {
        if (globalThis.__testEnvReady) {
          for (const id of ['settings-subview', 'title-credits-panel', 'title-faction-panel', 'title-slots-panel']) {
            const el = byId(id);
            if (el && !el.children?.length && el.innerHTML === '' && !(id === 'title-slots-panel' && this._slotsMode)) el.classList?.add('hidden');
          }
        }
        let hintsBar = byId('menu-keyhints-bar');
        if (!hintsBar && typeof document.createElement === 'function') { hintsBar = document.createElement('div'); if (hintsBar) hintsBar.id = 'menu-keyhints-bar'; }
        if (hintsBar) {
          hintsBar.classList?.add('menu-keyhints-bar');
          const host = byId('ui-overlay') || document.body;
          if (host && !hintsBar.parentNode && (!isNativeEl(hintsBar) || !hintsBar.isConnected)) host.appendChild?.(hintsBar);
        }
        this.menuKeyHintsBarEl = hintsBar;
      }
      this._ensureConfirmDialogDom?.();
      if (!this._menuNavBound && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        this._menuNavBound = true;
        window.addEventListener('keydown', (e) => this._onMenuKeyDown(e), true);
        window.addEventListener('mouseover', (e) => this._onMenuMouseOver(e));
      }
      this.refreshMenuNavigationFocus(true);
    },

    _isPanelVisible(cachedEl, id) {
      const el = cachedEl || byId(id);
      return Boolean(el && !hasCls(el, 'hidden'));
    },

    _resolveActiveMenuScreen() {
      if (this.isLoadingActive) return 'loading';
      if (this.isConfirmDialogOpen) return 'dialog';
      if (this.isPauseMenuOpen) {
        if (this._isPanelVisible(this.settingsSubviewEl, 'settings-subview')) return 'settings';
        if (this.isTitleScreenActive && hasCls(this.pauseIngameActionsEl, 'hidden')) return 'settings';
        return 'pause-main';
      }
      if (this.isTitleScreenActive) {
        if (this._isPanelVisible(this.titleCreditsPanelEl, 'title-credits-panel')) return 'title-credits';
        if (this._isPanelVisible(this.titleFactionPanelEl, 'title-faction-panel')) return 'title-faction';
        if (this._isPanelVisible(this.titleSlotsPanelEl, 'title-slots-panel')) return 'title-slots';
        return 'title-main';
      }
      if (!this.isTitleScreenActive && this.titleOverlayEl && !hasCls(this.titleOverlayEl, 'hidden') && !hasCls(this.titleFactionPanelEl, 'hidden')) return 'ingame-faction';
      return null;
    },

    _getNavigableItems(screen) {
      if (typeof document === 'undefined' || !screen) return [];
      if (screen === 'title-main') {
        const panel = this.titleMainPanelEl || byId('title-main-panel');
        const btns = queryEnabled(panel, '.title-action-btn', (el) => hasCls(el, 'title-action-btn'));
        return btns.length ? btns : queryEnabled(panel, 'button', (el) => el.tagName === 'BUTTON');
      }
      if (screen === 'title-slots') {
        const grid = this.saveSlotsGridEl || byId('save-slots-grid');
        let cards = queryEnabled(grid, '.save-slot-card', (el) => hasCls(el, 'save-slot-card'));
        if (!cards.length) cards = queryEnabled(grid, 'button[data-slot-action]', (el) => el.dataset?.slotAction === 'start-new' || el.dataset?.slotAction === 'load');
        const backBtn = byId('btn-slots-back');
        return isRealBtn(backBtn) && isVisibleEnabled(backBtn) ? [...cards, backBtn] : cards;
      }
      if (screen === 'title-faction' || screen === 'ingame-faction') {
        const grid = this.factionCardsGridEl || byId('faction-cards-grid');
        const cards = queryEnabled(grid, '.faction-choice-card', (el) => hasCls(el, 'faction-choice-card'));
        return cards.length ? cards : queryEnabled(grid, 'button[data-choose-faction]', (el) => el.dataset?.chooseFaction !== undefined);
      }
      if (screen === 'title-credits') return [byId('btn-credits-back')].filter((el) => Boolean(el) && isVisibleEnabled(el));
      if (screen === 'pause-main') return queryEnabled(this.pauseIngameActionsEl || byId('pause-ingame-actions'), 'button', (el) => el.tagName === 'BUTTON');
      if (screen === 'settings') {
        const root = this.settingsSubviewEl || (this._isPanelVisible(null, 'settings-subview') && byId('settings-subview')) || this.pauseModalEl || byId('pause-options-modal');
        const tabs = querySubtree(root, '.settings-tab-panel', (el) => hasCls(el, 'settings-tab-panel') && !hasCls(el, 'hidden'));
        const rows = queryEnabled(tabs[0] || root, '.option-row, .settings-action-row', (el) => hasCls(el, 'option-row') || hasCls(el, 'settings-action-row'));
        const restoreBtn = byId('btn-settings-restore-defaults');
        if (isRealBtn(restoreBtn) && isVisibleEnabled(restoreBtn) && !rows.some((r) => containsNode(r, restoreBtn))) rows.push(restoreBtn);
        const tabsBar = this.settingsTabsBarEl || byId('settings-tabs-bar');
        if (tabsBar && isVisibleEnabled(tabsBar) && !rows.includes(tabsBar)) rows.push(tabsBar);
        return rows;
      }
      return [];
    },

    _clearTrackedNavFocus(items = null) {
      if (Array.isArray(this._trackedFocusedEls)) {
        for (const el of this._trackedFocusedEls) el?.classList?.remove('is-nav-focused');
        this._trackedFocusedEls.length = 0;
      }
      if (Array.isArray(items)) for (const item of items) item?.classList?.remove('is-nav-focused');
    },

    _applyNavFocusToItems(items, index, withSound = false, scroll = true) {
      this._clearTrackedNavFocus(items);
      if (!items || !items.length) { this._menuFocusIndex = 0; this._focusedMenuEl = null; return null; }
      const wrapped = ((index % items.length) + items.length) % items.length;
      const targetEl = items[wrapped];
      const changed = this._focusedMenuEl !== targetEl || this._menuFocusIndex !== wrapped;
      this._menuFocusIndex = wrapped;
      this._focusedMenuEl = targetEl;
      targetEl?.classList?.add('is-nav-focused');
      this._trackedFocusedEls.push(targetEl);
      if (scroll) targetEl?.scrollIntoView?.({ block: 'nearest' });
      this._updateFocusedOptionDescription?.(targetEl);
      if (withSound && changed) playMenuMoveSound();
      return targetEl;
    },

    focusMenuElementById(targetId, withSound = false) {
      const screen = this._resolveActiveMenuScreen();
      const items = this._getNavigableItems(screen);
      this._activeMenuContext = screen;
      const idx = targetId ? items.findIndex((el) => el?.id === targetId) : -1;
      const chosen = this._applyNavFocusToItems(items, idx !== -1 ? idx : 0, withSound, false);
      this.refreshMenuKeyHints();
      return chosen;
    },

    _onMenuMouseOver(e) {
      const screen = this._resolveActiveMenuScreen();
      if (!screen || screen === 'loading' || screen === 'dialog' || !e?.target) return;
      const items = this._getNavigableItems(screen);
      const idx = items.findIndex((item) => containsNode(item, e.target));
      if (idx !== -1 && (idx !== this._menuFocusIndex || this._focusedMenuEl !== items[idx])) {
        this._applyNavFocusToItems(items, idx, true, false);
        this.refreshMenuKeyHints();
      }
    },

    _adjustFocusedSettingRow(rowEl, dir) {
      if (!rowEl || rowEl.id === 'settings-tabs-bar') return false;
      const sliders = rowEl.tagName === 'INPUT' && rowEl.type === 'range'
        ? [rowEl]
        : querySubtree(rowEl, 'input[type="range"], .tactical-slider', (el) => (el.tagName === 'INPUT' && (el.type === 'range' || !el.type)) || hasCls(el, 'tactical-slider'));
      if (sliders.length) {
        const s = sliders[0];
        const min = s.min !== '' && s.min !== undefined ? Number(s.min) : 0;
        const max = s.max !== '' && s.max !== undefined ? Number(s.max) : 100;
        const cur = Number(s.value ?? 0);
        const next = Math.max(min, Math.min(max, cur + dir * (Number(s.step) || 5)));
        if (next !== cur) { s.value = String(next); emitEvt(s, 'input'); emitEvt(s, 'change'); playMenuMoveSound(); }
        return true;
      }
      const stepCls = dir < 0 ? 'stepper-prev' : 'stepper-next';
      const stepBtns = queryEnabled(rowEl, `.${stepCls}`, (el) => hasCls(el, stepCls));
      if (stepBtns.length) { playMenuMoveSound(); stepBtns[0].click?.(); return true; }
      const qBtns = queryEnabled(rowEl, '.tactical-quality-btn', (el) => hasCls(el, 'tactical-quality-btn'));
      if (qBtns.length > 1) {
        const curIdx = Math.max(0, qBtns.findIndex((b) => hasCls(b, 'active')));
        qBtns[(curIdx + dir + qBtns.length) % qBtns.length]?.click?.();
        return true;
      }
      const toggles = hasCls(rowEl, 'tactical-toggle-btn') ? [rowEl] : queryEnabled(rowEl, '.tactical-toggle-btn', (el) => hasCls(el, 'tactical-toggle-btn'));
      if (toggles.length) { toggles[0].click?.(); return true; }
      return false;
    },

    _activateFocusedMenuItem(screen, focusedEl) {
      if (!focusedEl) return;
      if (screen === 'pause-main') {
        if (focusedEl.id === 'btn-pause-open-settings') this._pauseReturnBladeId = 'btn-pause-open-settings';
        playMenuConfirmSound();
        return focusedEl.click?.();
      }
      if (screen === 'title-main' || screen === 'title-credits') { playMenuConfirmSound(); return focusedEl.click?.(); }
      if (screen === 'title-slots') {
        playMenuConfirmSound();
        if (focusedEl.id === 'btn-slots-back' || focusedEl.tagName === 'BUTTON') return focusedEl.click?.();
        const primary = queryEnabled(focusedEl, 'button[data-slot-action]', (el) => el.dataset?.slotAction === 'start-new' || el.dataset?.slotAction === 'load');
        return (primary[0] || focusedEl).click?.();
      }
      if (screen === 'title-faction' || screen === 'ingame-faction') {
        const choose = queryEnabled(focusedEl, 'button[data-choose-faction]', (el) => el.dataset?.chooseFaction !== undefined);
        playMenuConfirmSound();
        return (choose[0] || focusedEl).click?.();
      }
      if (screen === 'settings') {
        if (focusedEl.id === 'settings-tabs-bar') { this.stepSettingsTab?.(1); playMenuMoveSound(); return this.focusMenuElementById('settings-tabs-bar', false); }
        if (focusedEl.tagName === 'BUTTON') { playMenuConfirmSound(); return focusedEl.click?.(); }
        const targets = queryEnabled(focusedEl, '[data-setting-action], .stepper-value, .tactical-toggle-btn', (el) =>
          el.dataset?.settingAction !== undefined || hasCls(el, 'stepper-value') || hasCls(el, 'tactical-toggle-btn'));
        if (targets.length) { playMenuConfirmSound(); targets[0].click?.(); }
      }
    },

    _handleMenuBackNavigation(screen, nowMs) {
      if (screen === 'title-main') return;
      this._lastPauseToggleTime = nowMs;
      playMenuBackSound();
      if (screen === 'title-credits' || screen === 'title-slots') { this._setTitleSubPanel?.('main'); return this.refreshMenuNavigationFocus(true); }
      if (screen === 'title-faction') { this._setTitleSubPanel?.('slots'); return this.refreshMenuNavigationFocus(true); }
      if (screen === 'ingame-faction') {
        this.titleOverlayEl?.classList?.add('hidden');
        document.body?.classList?.remove('title-or-loading-active');
        this.setPauseMenuOpen?.(true, this._lastController);
        return this.openPauseMainView?.('btn-pause-switch-faction');
      }
      if (screen === 'settings') {
        if (this.isTitleScreenActive) {
          this.setPauseMenuOpen?.(false, this._lastController, true);
          this._setTitleSubPanel?.('main');
          return this.refreshMenuNavigationFocus(true);
        }
        return this.openPauseMainView?.(this._pauseReturnBladeId || 'btn-pause-open-settings');
      }
      if (screen === 'pause-main') this.setPauseMenuOpen?.(false, this._lastController);
    },

    _onMenuKeyDown(e) {
      const tag = e.target?.tagName;
      const isTextInput = (tag === 'INPUT' && e.target?.type !== 'range' && e.target?.type !== 'button' && e.target?.type !== 'checkbox') ||
        tag === 'TEXTAREA' || Boolean(e.target?.isContentEditable);
      if (isTextInput && e.code !== 'Escape') return;

      const code = e.code || '';
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const screen = this._resolveActiveMenuScreen();
      if (!screen) {
        if (code === 'Escape' && !e.repeat && this._lastController && !this.isTitleScreenActive && !this.isLoadingActive &&
          !this.isCreatorOpen && !this.isCustomsOpen && !this.isAircraftStudioOpen && !this.isRadioWheelOpen &&
          !this.isHeroWheelOpen && !this.isFullMapOpen && !this.isDossierOpen && nowMs - (this._lastPauseToggleTime ?? -999) >= 120) {
          e.preventDefault?.();
          e.stopPropagation?.();
          this.setPauseMenuOpen?.(true, this._lastController);
        }
        return;
      }
      if (screen === 'loading') return;

      if (screen === 'dialog') {
        e.preventDefault?.();
        e.stopPropagation?.();
        if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowUp' || code === 'KeyW') this.stepConfirmDialogFocus?.(-1);
        else if (code === 'ArrowRight' || code === 'KeyD' || code === 'ArrowDown' || code === 'KeyS' || code === 'Tab') this.stepConfirmDialogFocus?.(1);
        else if ((code === 'Enter' || code === 'Space') && !e.repeat) this.acceptConfirmDialog?.();
        else if ((code === 'Escape' || code === 'Backspace') && !e.repeat) { this._lastPauseToggleTime = nowMs; this.cancelConfirmDialog?.(); }
        return;
      }

      const items = this._getNavigableItems(screen);
      const focusedEl = items.length ? items[((this._menuFocusIndex % items.length) + items.length) % items.length] : null;
      const isHoriz = screen === 'title-faction' || screen === 'ingame-faction';
      const prev = code === 'ArrowUp' || code === 'KeyW' || (isHoriz && (code === 'ArrowLeft' || code === 'KeyA'));
      const next = code === 'ArrowDown' || code === 'KeyS' || (isHoriz && (code === 'ArrowRight' || code === 'KeyD'));
      if (prev || next) {
        e.preventDefault?.();
        e.stopPropagation?.();
        if (items.length) { this._applyNavFocusToItems(items, this._menuFocusIndex + (next ? 1 : -1), true, true); this.refreshMenuKeyHints(); }
        return;
      }

      if (screen === 'settings') {
        if (code === 'KeyQ' || code === 'PageUp' || code === 'KeyE' || code === 'PageDown') {
          e.preventDefault?.();
          e.stopPropagation?.();
          if (!e.repeat) { this.stepSettingsTab?.(code === 'KeyQ' || code === 'PageUp' ? -1 : 1); playMenuMoveSound(); this.refreshMenuNavigationFocus(true); }
          return;
        }
        if (code === 'KeyR') {
          e.preventDefault?.();
          e.stopPropagation?.();
          if (!e.repeat) {
            const restoreBtn = this.btnRestoreDefaultsEl || byId('btn-settings-restore-defaults');
            if (restoreBtn) { playMenuConfirmSound(); restoreBtn.click?.(); }
          }
          return;
        }
        if (code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowRight' || code === 'KeyD') {
          e.preventDefault?.();
          e.stopPropagation?.();
          const dir = code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1;
          if (!this._adjustFocusedSettingRow(focusedEl, dir) && !e.repeat && (code === 'ArrowLeft' || code === 'ArrowRight')) {
            const onTabsBar = focusedEl?.id === 'settings-tabs-bar';
            this.stepSettingsTab?.(dir);
            playMenuMoveSound();
            if (onTabsBar) this.focusMenuElementById('settings-tabs-bar', false);
          }
          return;
        }
      }

      if (screen === 'title-slots' && (code === 'Delete' || code === 'KeyX')) {
        e.preventDefault?.();
        e.stopPropagation?.();
        if (!e.repeat && focusedEl) queryEnabled(focusedEl, 'button[data-slot-action="delete"]', (el) => el.dataset?.slotAction === 'delete')[0]?.click?.();
        return;
      }
      if (code === 'Enter' || code === 'Space') { e.preventDefault?.(); e.stopPropagation?.(); if (!e.repeat) this._activateFocusedMenuItem(screen, focusedEl); }
      else if (code === 'Escape' || code === 'Backspace') { e.preventDefault?.(); e.stopPropagation?.(); if (!e.repeat) this._handleMenuBackNavigation(screen, nowMs); }
    },

    refreshMenuNavigationFocus(resetIndex = true) {
      const screen = this._resolveActiveMenuScreen();
      if (!screen || screen === 'loading') {
        this._clearTrackedNavFocus();
        this._activeMenuContext = screen;
        this._focusedMenuEl = null;
        return this.refreshMenuKeyHints();
      }
      if (screen === 'dialog') { this._setConfirmDialogFocusIndex?.(this._confirmFocusIdx ?? 0, false); return this.refreshMenuKeyHints(); }
      if (resetIndex || this._activeMenuContext !== screen) this._menuFocusIndex = 0;
      this._activeMenuContext = screen;
      this._applyNavFocusToItems(this._getNavigableItems(screen), this._menuFocusIndex, false, false);
      this.refreshMenuKeyHints();
    },

    refreshMenuKeyHints() {
      const barEl = this.menuKeyHintsBarEl || byId('menu-keyhints-bar');
      if (!barEl) return;
      const screen = this._resolveActiveMenuScreen();
      if (!screen || screen === 'loading' || screen === 'pause-main' || screen === 'settings') { barEl.classList?.add('hidden'); return; }
      barEl.classList?.remove('hidden');
      const lang = this.settings?.language || 'pt-BR';
      const isEn = lang === 'en-US';
      const kh = UI_TEXTS?.[lang]?.keyHints || {};
      const backLbl = UI_TEXTS?.[lang]?.backBtn || (isEn ? 'Back' : 'Voltar');
      const map = {
        dialog: kh.dialog || [['←/→', isEn ? 'Switch' : 'Alternar'], ['ENTER', isEn ? 'Confirm' : 'Confirmar'], ['ESC', isEn ? 'Cancel' : 'Cancelar']],
        'title-main': kh.title || [['↑/↓', isEn ? 'Navigate' : 'Navegar'], ['ENTER', isEn ? 'Select' : 'Selecionar']],
        'title-slots': [...(kh.subpanel || [['↑/↓', isEn ? 'Navigate' : 'Navegar'], ['ENTER', isEn ? 'Select' : 'Selecionar'], ['ESC', backLbl]]), ['DEL', isEn ? 'Delete' : 'Apagar']],
        'title-faction': kh.faction || [['←/→', isEn ? 'Choose faction' : 'Escolher facção'], ['ENTER', isEn ? 'Confirm' : 'Confirmar'], ['ESC', backLbl]],
        'ingame-faction': kh.faction || [['←/→', isEn ? 'Choose faction' : 'Escolher facção'], ['ENTER', isEn ? 'Confirm' : 'Confirmar'], ['ESC', backLbl]],
        'title-credits': [['ESC / ENTER', backLbl]]
      };
      barEl.innerHTML = `<div class="keyhints-left">${(map[screen] || []).map(([k, txt]) => `<span class="keyhint-item"><kbd class="keyhint-kbd">${k}</kbd><span class="keyhint-label">${txt}</span></span>`).join('')}</div>`;
    }
  });
}

export const installMenuNavigationController = installMenuFocusNavigation;
