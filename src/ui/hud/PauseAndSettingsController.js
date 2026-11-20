import { soundFX } from '../../audio/SoundFX.js';
import { getActiveCustomHero } from '../../entities/CustomHeroSystem.js';
import { getActiveGarageSaveData } from '../../world/StreetCustomGarage.js';
import { getActiveAircraftSaveData } from '../../world/AircraftCustomGarage.js';
import {
  FACTION_DATA,
  UI_TEXTS,
  writeSaveSlot,
  saveGameSettings
} from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export function installPauseAndSettingsController(LegoHud) {
  definePrototypeMethods(LegoHud, {
    /**
     * Inicializa a Tela Inicial Oficial na IDV do Jogo, Panorama da Favela 2D, Tela de Loading, Slots de Save e Pausa [ESC]
     */
    _initTitleScreenAndPauseMenu() {
      this._initTitleAndLoadingDom();
      this._initPauseAndSettingsDom();
      this._initFavelaBackgroundCanvas();

      // Aplica configurações salvas de áudio imediatamente
      soundFX.setVolumes({
        masterVolume: this.settings.masterVolume,
        musicVolume: this.settings.musicVolume,
        sfxVolume: this.settings.sfxVolume
      });

      this._bindTitleScreenButtons();
      this._bindPauseAndSettingsEvents();

      this._setTitleSubPanel('main');
      this._refreshLanguageAndOptionsUI();
    },

    _initPauseAndSettingsDom() {
      this.pauseModalEl = document.getElementById('pause-options-modal');
      this.pauseIngameActionsEl = document.getElementById('pause-ingame-actions');
      this.pauseSaveFeedbackEl = document.getElementById('pause-save-feedback');

      this.sliderMasterEl = document.getElementById('slider-master-vol');
      this.sliderMusicEl = document.getElementById('slider-music-vol');
      this.sliderSfxEl = document.getElementById('slider-sfx-vol');
      this.valMasterEl = document.getElementById('val-master-vol');
      this.valMusicEl = document.getElementById('val-music-vol');
      this.valSfxEl = document.getElementById('val-sfx-vol');
      this.btnToggleRegionToastEl = document.getElementById('btn-toggle-region-toast');
      const grpEl = document.getElementById('grp-graphics-quality');
      this.graphicsQualityButtons =
        grpEl && typeof grpEl.querySelectorAll === 'function'
          ? Array.from(grpEl.querySelectorAll('.tactical-quality-btn'))
          : typeof document.querySelectorAll === 'function'
            ? Array.from(document.querySelectorAll('#grp-graphics-quality .tactical-quality-btn'))
            : [];
      if (this.graphicsQualityButtons.length === 0) {
        this.graphicsQualityButtons = ['auto', 'low', 'medium', 'ultra']
          .map((q) => document.getElementById(`btn-quality-${q}`))
          .filter(Boolean);
      }
      this.btnPauseTimeModeEl = document.getElementById('btn-pause-time-mode');
      this.btnPauseLangEl = document.getElementById('btn-pause-language');

      document.getElementById('hud-esc-hint-pill')?.addEventListener('click', () => {
        if (!this.isTitleScreenActive && !this.isLoadingActive) {
          this.setPauseMenuOpen(true, this._lastController);
        }
      });
    },

    _bindPauseAndSettingsEvents() {
      const flushSaveSettings = () => {
        if (this._saveSettingsTimer) {
          clearTimeout(this._saveSettingsTimer);
          this._saveSettingsTimer = null;
          saveGameSettings(this.settings);
        }
      };

      const scheduleSaveSettings = () => {
        if (this._saveSettingsTimer) {
          clearTimeout(this._saveSettingsTimer);
        }
        this._saveSettingsTimer = setTimeout(() => {
          this._saveSettingsTimer = null;
          saveGameSettings(this.settings);
        }, 150);
        this._saveSettingsTimer?.unref?.();
      };

      const onVolumeChange = () => {
        const m = Number(this.sliderMasterEl?.value ?? 85) / 100;
        const mu = Number(this.sliderMusicEl?.value ?? 55) / 100;
        const s = Number(this.sliderSfxEl?.value ?? 90) / 100;
        this.settings.masterVolume = m;
        this.settings.musicVolume = mu;
        this.settings.sfxVolume = s;
        if (this.valMasterEl) this.valMasterEl.textContent = `${Math.round(m * 100)}%`;
        if (this.valMusicEl) this.valMusicEl.textContent = `${Math.round(mu * 100)}%`;
        if (this.valSfxEl) this.valSfxEl.textContent = `${Math.round(s * 100)}%`;
        soundFX.setVolumes({ masterVolume: m, musicVolume: mu, sfxVolume: s });
        scheduleSaveSettings();
      };

      this.sliderMasterEl?.addEventListener('input', onVolumeChange);
      this.sliderMusicEl?.addEventListener('input', onVolumeChange);
      this.sliderSfxEl?.addEventListener('input', onVolumeChange);
      this.sliderMasterEl?.addEventListener('change', flushSaveSettings);
      this.sliderMusicEl?.addEventListener('change', flushSaveSettings);
      this.sliderSfxEl?.addEventListener('change', flushSaveSettings);

      this.btnToggleRegionToastEl?.addEventListener('click', () => {
        this.settings.showRegionToast = !this.settings.showRegionToast;
        if (!this.settings.showRegionToast && this.regionToastEl) {
          this.regionToastEl.classList.add('hidden');
        }
        saveGameSettings(this.settings);
        soundFX.playPlasticHit();
        this._refreshLanguageAndOptionsUI();
      });

      for (const btn of this.graphicsQualityButtons) {
        btn.addEventListener('click', () => {
          const nextQuality = btn.dataset?.quality || 'auto';
          this.settings.graphicsQuality = nextQuality;
          saveGameSettings(this.settings);
          soundFX.playHeroSwap();
          if (typeof this.onChangeGraphicsQuality === 'function') {
            this.onChangeGraphicsQuality(this.settings.graphicsQuality);
          }
          this._refreshLanguageAndOptionsUI();
        });
      }

      this.btnPauseTimeModeEl?.addEventListener('click', () => {
        const order = ['auto', 'day', 'sunset', 'night'];
        const curIdx = order.indexOf(this.settings.timeMode || 'auto');
        this.settings.timeMode = order[(curIdx + 1) % order.length];
        saveGameSettings(this.settings);
        soundFX.playHeroSwap();
        if (typeof this.onChangeTimeMode === 'function') {
          this.onChangeTimeMode(this.settings.timeMode);
        }
        this._refreshLanguageAndOptionsUI();
      });

      this.btnPauseLangEl?.addEventListener('click', () => {
        this._toggleLanguage();
      });

      document.getElementById('pause-close-btn')?.addEventListener('click', () => {
        this.setPauseMenuOpen(false, this._lastController);
      });

      document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
        this.setPauseMenuOpen(false, this._lastController);
      });

      document.getElementById('btn-pause-save')?.addEventListener('click', () => {
        const lang = this.settings?.language || 'pt-BR';
        const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
        this.saveCurrentProgress();
        if (this.pauseSaveFeedbackEl) {
          this.pauseSaveFeedbackEl.textContent = t.savedFeedback;
          this.pauseSaveFeedbackEl.classList.remove('hidden');
          setTimeout(() => this.pauseSaveFeedbackEl?.classList.add('hidden'), 2400);
        }
        soundFX.playTrueHeroFanfare();
      });

      document.getElementById('btn-pause-reset-territories')?.addEventListener('click', () => {
        const lang = this.settings?.language || 'pt-BR';
        const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
        if (typeof this.onResetTerritories === 'function') {
          this.onResetTerritories();
        }
        this.saveCurrentProgress();
        if (this.pauseSaveFeedbackEl) {
          this.pauseSaveFeedbackEl.textContent = t.resetTerritoriesFeedback;
          this.pauseSaveFeedbackEl.classList.remove('hidden');
          setTimeout(() => this.pauseSaveFeedbackEl?.classList.add('hidden'), 2600);
        }
        soundFX.playTrueHeroFanfare();
      });

      document.getElementById('btn-pause-switch-faction')?.addEventListener('click', () => {
        this.setPauseMenuOpen(false, this._lastController, true);
        document.body?.classList.add('title-or-loading-active');
        this.titleOverlayEl?.classList.remove('hidden');
        this._openFactionSelectionPanel();
      });

      document.getElementById('btn-pause-save-quit')?.addEventListener('click', () => {
        this.saveCurrentProgress();
        this._lastController?.resetHeldInputs?.();
        this.setTikTokRadioOpen(false, this._lastController);
        this.tiktokRadio?.stopAllPlayback();
        soundFX.baileFunkMix = 0;
        soundFX.baileBeatPulse = 0;
        soundFX.stopWarMusic();
        this.setPauseMenuOpen(false, this._lastController, true);
        this.isTitleScreenActive = true;
        document.body?.classList.add('title-or-loading-active');
        this.titleOverlayEl?.classList.remove('hidden');
        this._setTitleSubPanel('main');
        if (document.pointerLockElement && document.exitPointerLock) {
          document.exitPointerLock();
        }
      });
    },

    _toggleLanguage() {
      this.settings.language = this.settings.language === 'en-US' ? 'pt-BR' : 'en-US';
      saveGameSettings(this.settings);
      soundFX.playHeroSwap();
      this._refreshLanguageAndOptionsUI();
      this.setPlayerFaction(this.playerFaction, false);
    },

    _refreshLanguageAndOptionsUI() {
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];

      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.textContent = val;
      };

      setTxt('title-sub-banner', t.subtitle);
      setTxt('txt-new-game', t.newGame);
      setTxt('txt-load-game', t.loadGame);
      setTxt('txt-options', t.options);
      setTxt('txt-language-btn', t.languageBtn);
      setTxt('btn-slots-back', t.backBtn);
      setTxt('btn-faction-back', t.backBtn);
      setTxt('faction-panel-tag', t.chooseFactionTag);
      setTxt('faction-panel-title', t.chooseFactionTitle);
      setTxt('faction-panel-sub', t.chooseFactionSub);

      setTxt('pause-tag', t.pauseTag);
      setTxt('pause-title', t.pauseTitle);
      setTxt('lbl-master-vol', t.masterVol);
      setTxt('lbl-music-vol', t.musicVol);
      setTxt('lbl-sfx-vol', t.sfxVol);
      setTxt('lbl-region-toast', t.regionToastToggle);
      setTxt('lbl-graphics-quality', t.graphicsQualityLabel);
      setTxt('lbl-time-mode', t.timeOfDayLabel);
      setTxt('lbl-lang-select', t.langLabel);
      setTxt('btn-pause-resume', t.resumeBtn);
      setTxt('btn-pause-save', t.saveNowBtn);
      setTxt('btn-pause-switch-faction', t.switchFactionBtn);
      setTxt('btn-pause-reset-territories', t.resetTerritoriesBtn);
      setTxt('btn-pause-save-quit', t.saveQuitBtn);
      setTxt('pause-save-feedback', t.savedFeedback);
      setTxt('hud-esc-hint-text', lang === 'en-US' ? 'OPTIONS / SAVE' : 'OPÇÕES / SALVAR');

      if (this.sliderMasterEl) this.sliderMasterEl.value = Math.round((this.settings.masterVolume ?? 0.85) * 100);
      if (this.sliderMusicEl) this.sliderMusicEl.value = Math.round((this.settings.musicVolume ?? 0.55) * 100);
      if (this.sliderSfxEl) this.sliderSfxEl.value = Math.round((this.settings.sfxVolume ?? 0.9) * 100);
      if (this.valMasterEl) this.valMasterEl.textContent = `${Math.round((this.settings.masterVolume ?? 0.85) * 100)}%`;
      if (this.valMusicEl) this.valMusicEl.textContent = `${Math.round((this.settings.musicVolume ?? 0.55) * 100)}%`;
      if (this.valSfxEl) this.valSfxEl.textContent = `${Math.round((this.settings.sfxVolume ?? 0.9) * 100)}%`;

      if (this.btnToggleRegionToastEl) {
        const on = Boolean(this.settings.showRegionToast);
        this.btnToggleRegionToastEl.classList.toggle('active', on);
        this.btnToggleRegionToastEl.textContent = on
          ? lang === 'en-US'
            ? 'ON // ENABLED'
            : 'ON // ATIVADO'
          : lang === 'en-US'
            ? 'OFF // HIDDEN'
            : 'OFF // OCULTO';
      }

      if (this.graphicsQualityButtons && this.graphicsQualityButtons.length > 0) {
        const qualityKey = this.settings.graphicsQuality || 'auto';
        const qualityLabels = t.graphicsModes || UI_TEXTS['pt-BR'].graphicsModes;
        for (const btn of this.graphicsQualityButtons) {
          const key = btn.dataset?.quality || 'auto';
          btn.textContent = qualityLabels[key] || key.toUpperCase();
          btn.classList.toggle('active', key === qualityKey);
        }
      }

      if (this.btnPauseTimeModeEl) {
        const modeKey = this.settings.timeMode || 'auto';
        const modeLabels = t.timeModes || UI_TEXTS['pt-BR'].timeModes;
        this.btnPauseTimeModeEl.textContent = modeLabels[modeKey] || modeLabels.auto;
        this.btnPauseTimeModeEl.classList.add('active');
      }

      if (this.btnPauseLangEl) {
        this.btnPauseLangEl.textContent = lang === 'en-US' ? 'EN-US // ENGLISH' : 'PT-BR // PORTUGUÊS';
      }
    },

    saveCurrentProgress() {
      writeSaveSlot(this.activeSaveSlot || 0, {
        goldenBricks: this.goldenBricks || 0,
        faction: FACTION_DATA[this.playerFaction] ? this.playerFaction : 'cv',
        studs: this.totalStuds || 0,
        heroKey: this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira',
        conqueredTerritories:
          typeof this.getConqueredTerritories === 'function' ? this.getConqueredTerritories() : [],
        territoryMeta: typeof this.getTerritoryMeta === 'function' ? this.getTerritoryMeta() : {},
        customHero: { ...getActiveCustomHero() },
        customGarage: getActiveGarageSaveData(),
        aircraftCustom: getActiveAircraftSaveData(),
        radioState: this.tiktokRadio ? this.tiktokRadio.exportSaveState() : null
      });
    },

    setPauseMenuOpen(open, controller = null, keepTitleState = false) {
      this._lastPauseToggleTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (this._saveSettingsTimer && !open) {
        clearTimeout(this._saveSettingsTimer);
        this._saveSettingsTimer = null;
        saveGameSettings(this.settings);
      }
      if (controller) {
        this._lastController = controller;
      }
      if (open && this.isCreatorOpen) {
        this.creatorStudio?.close(false);
      }
      if (open && this.isCustomsOpen) {
        this.customsStudio?.close(false);
      }
      if (open && this.isAircraftStudioOpen) {
        this.aircraftStudio?.close(false);
      }
      this.isPauseMenuOpen = Boolean(open);
      if (this.pauseModalEl) {
        this.pauseModalEl.classList.toggle('hidden', !this.isPauseMenuOpen);
      }
      if (this.pauseIngameActionsEl) {
        this.pauseIngameActionsEl.classList.toggle('hidden', this.isTitleScreenActive);
      }

      if (this.isPauseMenuOpen) {
        this._lastController?.resetHeldInputs?.();
        if (this.isFullMapOpen) this.setFullMapOpen(false);
        if (this.isDossierOpen) this.setHeroDossierOpen(false);
        if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
        if (this.isTikTokRadioOpen) this.setTikTokRadioOpen(false);
        this._refreshLanguageAndOptionsUI();
        if (document.pointerLockElement && document.exitPointerLock) {
          document.exitPointerLock();
        }
      } else if (!this.isTitleScreenActive && !this.isLoadingActive && !keepTitleState) {
        if (this._lastController && typeof this._lastController.relockPointer === 'function') {
          this._lastController.relockPointer();
        }
      }
    },

    togglePauseMenu(controller = null) {
      if (this.isTitleScreenActive || this.isLoadingActive) return;
      this.setPauseMenuOpen(!this.isPauseMenuOpen, controller);
    }
  });
}
