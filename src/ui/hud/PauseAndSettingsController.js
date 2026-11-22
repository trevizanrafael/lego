import { soundFX } from '../../audio/SoundFX.js';
import { getActiveCustomHero } from '../../entities/CustomHeroSystem.js';
import { getActiveGarageSaveData } from '../../world/StreetCustomGarage.js';
import { getActiveAircraftSaveData } from '../../world/AircraftCustomGarage.js';
import { FACTION_DATA, UI_TEXTS, writeSaveSlot, saveGameSettings } from '../FactionIconsAndSaveSystem.js';
import { getDefaultHybridOperatorKey } from '../../entities/operators/OperatorCatalog.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';
import { installConfirmDialog } from './ConfirmDialog.js';
import { installMenuFocusNavigation, installMenuNavigationController } from './MenuFocusNavigation.js';
import { installPauseMenuController } from './PauseMenuController.js';
import { installSettingsScreenController, installSettingsTabsController } from './SettingsScreenController.js';

export {
  installMenuFocusNavigation,
  installMenuNavigationController,
  installPauseMenuController,
  installSettingsScreenController,
  installSettingsTabsController
};

const byId = (id) =>
  typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document.getElementById(id) : null;

export function installPauseAndSettingsController(LegoHud) {
  if (typeof LegoHud.prototype.openConfirmDialog !== 'function') installConfirmDialog(LegoHud);
  if (typeof LegoHud.prototype._initMenuNavigation !== 'function') installMenuFocusNavigation(LegoHud);
  if (typeof LegoHud.prototype._initPauseMenuDom !== 'function') installPauseMenuController(LegoHud);
  if (typeof LegoHud.prototype._initSettingsTabsDom !== 'function') installSettingsScreenController(LegoHud);

  definePrototypeMethods(LegoHud, {
    _initTitleScreenAndPauseMenu() {
      this._initTitleAndLoadingDom?.();
      this._initPauseMenuDom?.();
      this._initSettingsTabsDom?.();
      this._initFavelaBackgroundCanvas?.();
      soundFX.setVolumes({
        masterVolume: this.settings.masterVolume,
        musicVolume: this.settings.musicVolume,
        sfxVolume: this.settings.sfxVolume
      });
      this._bindTitleScreenButtons?.();
      this._bindPauseMenuEvents?.();
      this._bindSettingsTabsEvents?.();
      this._initMenuNavigation?.();
      this._setTitleSubPanel?.('main');
      this._refreshTitleContinueAndLoadState?.();
      this._refreshLanguageAndOptionsUI();
      this.refreshMenuNavigationFocus?.(true);
    },

    saveCurrentProgress() {
      const validFaction = FACTION_DATA[this.playerFaction] ? this.playerFaction : 'cv';
      const activeCharKey =
        this.currentHeroKey ||
        this._lastController?.minifigure?.currentHeroKey ||
        getDefaultHybridOperatorKey(validFaction);
      writeSaveSlot(this.activeSaveSlot || 0, {
        goldenBricks: this.goldenBricks || 0,
        faction: validFaction,
        studs: this.totalStuds || 0,
        operatorKey: activeCharKey,
        heroKey: activeCharKey,
        unlockedExtras: Array.isArray(this.unlockedExtras) ? [...this.unlockedExtras] : [],
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
        if (this.isConfirmDialogOpen) this.cancelConfirmDialog?.();
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
        if (this.isRadioWheelOpen) this.setRadioWheelOpen?.(false, this._lastController);
        this._refreshLanguageAndOptionsUI();
        if (typeof document !== 'undefined' && document.pointerLockElement && document.exitPointerLock) {
          document.exitPointerLock();
        }
        if (!this.isTitleScreenActive) {
          document.body?.classList?.add('is-paused', 'game-paused');
          document.body?.classList?.remove('settings-over-title');
          this.openPauseMainView?.(null);
        } else {
          document.body?.classList?.add('settings-over-title');
          document.body?.classList?.remove('is-paused', 'game-paused');
          this.openSettingsSubview?.(this._activeSettingsTab || 'audio');
        }
      } else {
        this.settingsSubviewEl?.classList?.add('hidden');
        this.pauseModalEl?.classList?.remove('pause-anim-in');
        document.body?.classList?.remove('is-paused', 'game-paused', 'settings-over-title');
        if (!this.isTitleScreenActive && !this.isLoadingActive && !keepTitleState) {
          this._lastController?.relockPointer?.();
        }
        this.refreshMenuNavigationFocus?.(true);
      }
    },

    togglePauseMenu(controller = null) {
      if (this.isTitleScreenActive || this.isLoadingActive) return;
      this.setPauseMenuOpen(!this.isPauseMenuOpen, controller);
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
      this._syncTitlePanelTexts?.();
      for (const [id, val] of [
        ['txt-language-btn', t.languageBtn],
        ['hud-esc-hint-text', lang === 'en-US' ? 'OPTIONS / SAVE' : 'OPÇÕES / SALVAR']
      ]) {
        const el = byId(id);
        if (el && val !== undefined) el.textContent = val;
      }
      this._refreshTitleLanguageUI?.();
      this._refreshPauseMenuLabels?.();
      this._refreshSettingsTabsUI?.();
      if (this.isPauseMenuOpen && !this.isTitleScreenActive) this._updatePauseContextPanel?.();
      this.refreshMenuKeyHints?.();
    }
  });
}
