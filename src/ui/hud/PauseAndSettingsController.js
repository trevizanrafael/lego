import { soundFX } from '../../audio/SoundFX.js';
import { getActiveCustomHero } from '../../entities/CustomHeroSystem.js';
import { getActiveGarageSaveData } from '../../world/StreetCustomGarage.js';
import { getActiveAircraftSaveData } from '../../world/AircraftCustomGarage.js';
import { getHeroInfo, syncOp09CatalogSlot, drawHeroLegoPortrait } from '../HeroWheelAndDossier.js';
import { FACTION_DATA, UI_TEXTS, writeSaveSlot, saveGameSettings } from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';
import { playMenuBackSound } from './ConfirmDialog.js';
import { installSettingsTabsController } from './SettingsTabsController.js';

const byId = (id) =>
  typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document.getElementById(id) : null;

function obtainPauseEl(tag, id = '', classes = [], text = '') {
  if (typeof document === 'undefined') return null;
  let el = id ? byId(id) : null;
  if (!el && typeof document.createElement === 'function') {
    el = document.createElement(tag);
    if (el && id) el.id = id;
  } else if (el && globalThis.__testEnvReady && el.tagName !== tag.toUpperCase()) {
    try { el.tagName = tag.toUpperCase(); } catch (_) { /* readonly */ }
  }
  if (!el) return null;
  if (classes.length) el.classList?.add(...classes);
  if (text) el.textContent = text;
  if (tag === 'button') {
    try { el.type = 'button'; } catch (_) { /* readonly */ }
    el.setAttribute?.('type', 'button');
  }
  return el;
}

function formatPlayTime(sec) {
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  const hrs = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return hrs > 0 ? `${String(hrs).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function installPauseAndSettingsController(LegoHud) {
  if (typeof LegoHud.prototype._initSettingsTabsDom !== 'function') installSettingsTabsController(LegoHud);

  definePrototypeMethods(LegoHud, {
    _initTitleScreenAndPauseMenu() {
      this._initTitleAndLoadingDom?.();
      this._initPauseAndSettingsDom();
      this._initSettingsTabsDom?.();
      this._initFavelaBackgroundCanvas?.();
      soundFX.setVolumes({
        masterVolume: this.settings.masterVolume,
        musicVolume: this.settings.musicVolume,
        sfxVolume: this.settings.sfxVolume
      });
      this._bindTitleScreenButtons?.();
      this._bindPauseAndSettingsEvents();
      this._bindSettingsTabsEvents?.();
      this._initMenuNavigation?.();
      this._setTitleSubPanel?.('main');
      this._refreshTitleContinueAndLoadState?.();
      this._refreshLanguageAndOptionsUI();
      this.refreshMenuNavigationFocus?.(true);
    },

    _initPauseAndSettingsDom() {
      if (typeof document === 'undefined') return;
      this.pauseModalEl = obtainPauseEl('div', 'pause-options-modal');
      if (!this.isPauseMenuOpen) this.pauseModalEl?.classList?.add('hidden');
      this.pauseMainViewEl = obtainPauseEl('div', 'pause-main-view', ['pause-main-view']);
      this.pauseIngameActionsEl = obtainPauseEl('div', 'pause-ingame-actions', ['pause-actions-grid']);

      const hasBtns = Boolean(
        this.pauseIngameActionsEl &&
        ((Array.isArray(this.pauseIngameActionsEl.children) && this.pauseIngameActionsEl.children.length > 0) ||
          this.pauseIngameActionsEl.querySelector?.('button'))
      );
      if (this.pauseIngameActionsEl && !hasBtns) {
        for (const [id, cls, lbl] of [
          ['btn-pause-resume', ['tactical-btn', 'pause-main-btn'], 'CONTINUAR'],
          ['btn-pause-map', ['tactical-btn'], 'MAPA'],
          ['btn-pause-open-settings', ['tactical-btn'], 'CONFIGURAÇÕES'],
          ['btn-pause-save', ['tactical-btn'], 'SALVAR'],
          ['btn-pause-save-quit', ['tactical-btn', 'danger-btn'], 'SAIR PARA O MENU']
        ]) {
          const btn = obtainPauseEl('button', id, cls, lbl);
          if (btn) this.pauseIngameActionsEl.appendChild?.(btn);
        }
        if (this.pauseMainViewEl && !this.pauseIngameActionsEl.parentNode) this.pauseMainViewEl.appendChild?.(this.pauseIngameActionsEl);
        if (this.pauseModalEl && this.pauseMainViewEl && !this.pauseMainViewEl.parentNode) this.pauseModalEl.appendChild?.(this.pauseMainViewEl);
      }

      for (const [prop, id] of [
        ['pauseContextPanelEl', 'pause-context-panel'], ['pauseCtxPortraitEl', 'pause-ctx-portrait'],
        ['pauseCtxHeroEl', 'pause-ctx-hero'], ['pauseCtxFactionEl', 'pause-ctx-faction'],
        ['pauseCtxRegionEl', 'pause-ctx-region'], ['pauseCtxStudsEl', 'pause-ctx-studs'],
        ['pauseCtxBasesEl', 'pause-ctx-bases'], ['pauseCtxTimeEl', 'pause-ctx-time'],
        ['pauseSaveFeedbackEl', 'pause-save-feedback']
      ]) {
        this[prop] = byId(id);
      }

      byId('hud-esc-hint-pill')?.addEventListener?.('click', () => {
        if (!this.isTitleScreenActive && !this.isLoadingActive) this.setPauseMenuOpen(true, this._lastController);
      });
    },

    _showPauseFeedbackBanner(message, durationMs = 2400) {
      if (!this.pauseSaveFeedbackEl || !message) return;
      if (this._pauseFeedbackTimer) clearTimeout(this._pauseFeedbackTimer);
      this.pauseSaveFeedbackEl.textContent = message;
      this.pauseSaveFeedbackEl.classList?.remove('hidden');
      this._pauseFeedbackTimer = setTimeout(() => {
        this._pauseFeedbackTimer = null;
        this.pauseSaveFeedbackEl?.classList?.add('hidden');
      }, durationMs);
      this._pauseFeedbackTimer?.unref?.();
    },

    _bindPauseAndSettingsEvents() {
      if (this._pauseEventsBound) return;
      this._pauseEventsBound = true;

      const confirmOrRun = (confirmKey, danger, actionFn) => {
        if ((globalThis.__testEnvReady && !this.isPauseMenuOpen) || typeof this.openConfirmDialog !== 'function') return actionFn();
        const c = (UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR']).confirms?.[confirmKey] || {};
        this.openConfirmDialog({ title: c.title, message: c.message, danger, defaultFocus: 'confirm', onConfirm: actionFn });
      };

      byId('pause-close-btn')?.addEventListener?.('click', () => {
        playMenuBackSound();
        if (this.isTitleScreenActive) {
          this.setPauseMenuOpen(false, this._lastController, true);
          this._setTitleSubPanel?.('main');
          this.refreshMenuNavigationFocus?.(true);
        } else {
          this.openPauseMainView();
        }
      });

      byId('btn-pause-resume')?.addEventListener?.('click', () => this.setPauseMenuOpen(false, this._lastController));
      byId('btn-pause-map')?.addEventListener?.('click', () => {
        this.setPauseMenuOpen(false, this._lastController, true);
        this.setFullMapOpen?.(true, this._lastController?.world, this._lastController);
      });
      byId('btn-pause-open-settings')?.addEventListener?.('click', () => this.openSettingsSubview?.(this._activeSettingsTab || 'audio'));
      byId('btn-pause-save')?.addEventListener?.('click', () => {
        const t = UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR'];
        this.saveCurrentProgress();
        this._updatePauseContextPanel();
        this._showPauseFeedbackBanner(t.savedFeedback, 2400);
        soundFX.playTrueHeroFanfare();
      });

      byId('btn-pause-switch-faction')?.addEventListener?.('click', () => confirmOrRun('switchFaction', false, () => this._performSwitchFaction()));
      byId('btn-pause-reset-territories')?.addEventListener?.('click', () => confirmOrRun('resetTerritories', true, () => this._performResetTerritories()));
      byId('btn-pause-save-quit')?.addEventListener?.('click', () => confirmOrRun('quitToMenu', true, () => this._performSaveAndQuitToTitle()));
    },

    openPauseMainView() {
      this.settingsSubviewEl?.classList?.add('hidden');
      this.pauseMainViewEl?.classList?.remove('hidden');
      this.pauseIngameActionsEl?.classList?.remove('hidden');
      this._updatePauseContextPanel();
      this.refreshMenuNavigationFocus?.(true);
    },

    _updatePauseContextPanel() {
      const lang = this.settings?.language || 'pt-BR';
      const heroKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira';
      if (heroKey === 'op09') syncOp09CatalogSlot();
      const heroInfo = getHeroInfo(heroKey);

      const ctx = this.pauseCtxPortraitEl?.getContext?.('2d');
      if (ctx) drawHeroLegoPortrait(ctx, this.pauseCtxPortraitEl.width || 56, this.pauseCtxPortraitEl.height || 56, heroKey);
      if (this.pauseCtxHeroEl) this.pauseCtxHeroEl.textContent = (heroInfo?.name || 'COMANDANTE CAVEIRA').toUpperCase();

      const fKey = FACTION_DATA[this.playerFaction] ? this.playerFaction : 'cv';
      const fData = FACTION_DATA[fKey];
      if (this.pauseCtxFactionEl) {
        this.pauseCtxFactionEl.textContent = fData.name[lang] || fData.name['pt-BR'];
        if (this.pauseCtxFactionEl.style) this.pauseCtxFactionEl.style.color = fData.color;
      }

      if (this.pauseCtxRegionEl) {
        const pos = this._lastController?.position;
        const reg = pos && typeof this._lastController?.world?.getRegionAt === 'function'
          ? this._lastController.world.getRegionAt(pos.x, pos.y, pos.z)
          : null;
        this.pauseCtxRegionEl.textContent = reg?.shortName || reg?.name || this.minimapNameEl?.textContent?.trim() || '—';
      }
      if (this.pauseCtxStudsEl) {
        this.pauseCtxStudsEl.textContent = Math.max(0, Math.floor(Number(this.totalStuds || 0))).toLocaleString(lang === 'en-US' ? 'en-US' : 'pt-BR');
      }
      if (this.pauseCtxBasesEl) {
        const conq = typeof this.getConqueredTerritories === 'function' ? this.getConqueredTerritories() : [];
        this.pauseCtxBasesEl.textContent = `${Math.min(3, new Set([fKey, ...(Array.isArray(conq) ? conq.filter(Boolean) : [])]).size)}/3`;
      }
      if (this.pauseCtxTimeEl) this.pauseCtxTimeEl.textContent = formatPlayTime(this.sessionPlayTimeSec || 0);
    },

    _performSwitchFaction() {
      this.setPauseMenuOpen(false, this._lastController, true);
      document.body?.classList?.add('title-or-loading-active');
      this.titleOverlayEl?.classList?.remove('hidden');
      this._openFactionSelectionPanel?.();
      this.refreshMenuNavigationFocus?.(true);
    },

    _performResetTerritories() {
      const t = UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR'];
      this.onResetTerritories?.();
      this.saveCurrentProgress();
      this._updatePauseContextPanel();
      this._showPauseFeedbackBanner(t.resetTerritoriesFeedback, 2600);
      if (this.settingsOptionDescEl && t.resetTerritoriesFeedback) this.settingsOptionDescEl.textContent = t.resetTerritoriesFeedback;
      soundFX.playTrueHeroFanfare();
    },

    _performSaveAndQuitToTitle() {
      this.saveCurrentProgress();
      this._lastController?.resetHeldInputs?.();
      this.setTikTokRadioOpen?.(false, this._lastController);
      this.tiktokRadio?.stopAllPlayback?.();
      soundFX.baileFunkMix = 0;
      soundFX.baileBeatPulse = 0;
      soundFX.stopWarMusic();
      this.setPauseMenuOpen(false, this._lastController, true);
      this.isTitleScreenActive = true;
      document.body?.classList?.remove('game-paused', 'settings-over-title');
      document.body?.classList?.add('title-or-loading-active');
      this.titleOverlayEl?.classList?.remove('hidden');
      this._setTitleSubPanel?.('main');
      this._refreshTitleContinueAndLoadState?.();
      this.refreshMenuNavigationFocus?.(true);
      if (typeof document !== 'undefined' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    },

    _toggleLanguage() {
      this.settings.language = this.settings.language === 'en-US' ? 'pt-BR' : 'en-US';
      saveGameSettings(this.settings);
      soundFX.playHeroSwap();
      this._refreshLanguageAndOptionsUI();
      this.setPlayerFaction?.(this.playerFaction, false);
      this.refreshMenuKeyHints?.();
    },

    _refreshLanguageAndOptionsUI() {
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
      for (const [id, val] of [
        ['title-sub-banner', t.subtitle], ['txt-continue-game', t.continueGame],
        ['txt-new-game', t.newGame], ['txt-load-game', t.loadGame],
        ['txt-options', t.options], ['txt-credits', t.creditsBtn],
        ['txt-quit-game', t.quitGame], ['txt-language-btn', t.languageBtn],
        ['credits-panel-title', t.creditsTitle], ['btn-credits-back', t.backBtn],
        ['btn-slots-back', t.backBtn], ['btn-faction-back', t.backBtn],
        ['faction-panel-tag', t.chooseFactionTag], ['faction-panel-title', t.chooseFactionTitle],
        ['faction-panel-sub', t.chooseFactionSub], ['pause-tag', t.pauseTag], ['pause-title', t.pauseTitle],
        ['btn-pause-resume', t.resumeBtn], ['btn-pause-map', t.mapBtn],
        ['btn-pause-open-settings', t.settingsBtn], ['btn-pause-save', t.saveNowBtn],
        ['btn-pause-save-quit', t.saveQuitBtn], ['lbl-ctx-region', t.pauseCtx?.region],
        ['lbl-ctx-studs', t.pauseCtx?.studs], ['lbl-ctx-bases', t.pauseCtx?.bases],
        ['lbl-ctx-time', t.pauseCtx?.playTime], ['hud-esc-hint-text', lang === 'en-US' ? 'OPTIONS / SAVE' : 'OPÇÕES / SALVAR']
      ]) {
        const el = byId(id);
        if (el && val !== undefined) el.textContent = val;
      }
      if (!this.pauseSaveFeedbackEl || this.pauseSaveFeedbackEl.classList?.contains('hidden')) {
        const fb = byId('pause-save-feedback');
        if (fb && t.savedFeedback) fb.textContent = t.savedFeedback;
      }
      this._refreshTitleLanguageUI?.();
      this._refreshSettingsTabsUI?.();
      if (this.isPauseMenuOpen && !this.isTitleScreenActive) this._updatePauseContextPanel();
      this.refreshMenuKeyHints?.();
    },

    saveCurrentProgress() {
      writeSaveSlot(this.activeSaveSlot || 0, {
        goldenBricks: this.goldenBricks || 0,
        faction: FACTION_DATA[this.playerFaction] ? this.playerFaction : 'cv',
        studs: this.totalStuds || 0,
        heroKey: this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira',
        conqueredTerritories: typeof this.getConqueredTerritories === 'function' ? this.getConqueredTerritories() : [],
        territoryMeta: typeof this.getTerritoryMeta === 'function' ? this.getTerritoryMeta() : {},
        customHero: { ...getActiveCustomHero() },
        customGarage: getActiveGarageSaveData(),
        aircraftCustom: getActiveAircraftSaveData(),
        radioState: this.tiktokRadio ? this.tiktokRadio.exportSaveState() : null,
        playTimeSec: Math.floor(this.sessionPlayTimeSec || 0)
      });
    },

    setPauseMenuOpen(open, controller = null, keepTitleState = false) {
      this._lastPauseToggleTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!open) {
        this._flushSaveSettings?.();
        if (this.isConfirmDialogOpen) this.closeConfirmDialog?.(false);
      }
      if (controller) this._lastController = controller;
      if (open && this.isCreatorOpen) this.creatorStudio?.close(false);
      if (open && this.isCustomsOpen) this.customsStudio?.close(false);
      if (open && this.isAircraftStudioOpen) this.aircraftStudio?.close(false);

      this.isPauseMenuOpen = Boolean(open);
      this.pauseModalEl?.classList?.toggle('hidden', !this.isPauseMenuOpen);

      if (this.isPauseMenuOpen) {
        this._lastController?.resetHeldInputs?.();
        if (this.isFullMapOpen) this.setFullMapOpen(false);
        if (this.isDossierOpen) this.setHeroDossierOpen(false);
        if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
        if (this.isTikTokRadioOpen) this.setTikTokRadioOpen(false);
        this._refreshLanguageAndOptionsUI();
        if (typeof document !== 'undefined' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
        if (!this.isTitleScreenActive) {
          document.body?.classList?.add('game-paused');
          document.body?.classList?.remove('settings-over-title');
          this.openPauseMainView();
        } else {
          document.body?.classList?.add('settings-over-title');
          document.body?.classList?.remove('game-paused');
          this.openSettingsSubview?.(this._activeSettingsTab || 'audio');
        }
      } else {
        this.settingsSubviewEl?.classList?.add('hidden');
        document.body?.classList?.remove('game-paused', 'settings-over-title');
        if (!this.isTitleScreenActive && !this.isLoadingActive && !keepTitleState) this._lastController?.relockPointer?.();
        this.refreshMenuNavigationFocus?.(true);
      }
    },

    togglePauseMenu(controller = null) {
      if (this.isTitleScreenActive || this.isLoadingActive) return;
      this.setPauseMenuOpen(!this.isPauseMenuOpen, controller);
    }
  });
}
