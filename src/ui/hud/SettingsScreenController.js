import { soundFX } from '../../audio/SoundFX.js';
import { UI_TEXTS, DEFAULT_GAME_SETTINGS, saveGameSettings } from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';
import { playMenuMoveSound, playMenuBackSound } from './ConfirmDialog.js';

export const SETTINGS_TABS = ['audio', 'video', 'controls', 'game'];
const GRAPHICS_ORDER = ['auto', 'low', 'medium', 'ultra'];
const TIME_ORDER = ['auto', 'day', 'sunset', 'night'];
const LANG_ORDER = ['pt-BR', 'en-US'];

const byId = (id) => (typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document.getElementById(id) : null);
const cycle = (arr, cur, dir) => arr[(Math.max(0, arr.indexOf(cur)) + (dir < 0 ? -1 : 1) + arr.length) % arr.length];

function mkEl(tag, id = '', cls = [], attrs = {}, kids = []) {
  if (typeof document === 'undefined') return null;
  let el = id ? byId(id) : null;
  if (!el && typeof document.createElement === 'function') { el = document.createElement(tag); if (el && id) el.id = id; }
  else if (el && globalThis.__testEnvReady && el.tagName !== tag.toUpperCase()) { try { el.tagName = tag.toUpperCase(); } catch (_) { /* readonly */ } }
  if (!el) return null;
  if (cls.length) el.classList?.add(...cls);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'dataset' && v && el.dataset) Object.assign(el.dataset, v);
    else if (k === 'text') el.textContent = v;
    else { try { el[k] = v; } catch (_) { /* ignore */ } el.setAttribute?.(k, String(v)); }
  }
  for (const ch of kids) if (ch) el.appendChild?.(ch);
  return el;
}

const PANEL_SPECS = {
  audio: [['s', 'masterVol', 'lbl-master-vol', 'slider-master-vol', 'val-master-vol', 0, 100, 5, 85], ['s', 'musicVol', 'lbl-music-vol', 'slider-music-vol', 'val-music-vol', 0, 100, 5, 55], ['s', 'sfxVol', 'lbl-sfx-vol', 'slider-sfx-vol', 'val-sfx-vol', 0, 100, 5, 90]],
  video: [['st', 'graphicsQuality', 'lbl-graphics-quality', 'graphicsQuality', 'val-graphics-quality'], ['s', 'fov', 'lbl-fov', 'slider-fov', 'val-fov', 50, 85, 1, 60], ['st', 'fullscreen', 'lbl-fullscreen', 'fullscreen', 'val-fullscreen'], ['st', 'timeMode', 'lbl-time-mode', 'timeMode', 'btn-pause-time-mode'], ['st', 'killEffect', 'lbl-kill-effect', 'killEffect', 'val-kill-effect']],
  controls: [['s', 'mouseSens', 'lbl-mouse-sens', 'slider-mouse-sens', 'val-mouse-sens', 20, 250, 5, 100], ['st', 'invertY', 'lbl-invert-y', 'invertY', 'val-invert-y'], ['km', 'controlsList', 'lbl-controls-list', 'controls-keymap-grid']],
  game: [['st', 'language', 'lbl-lang-select', 'language', 'btn-pause-language'], ['st', 'regionToast', 'lbl-region-toast', 'regionToast', 'btn-toggle-region-toast'], ['a', 'row-reset-territories', 'resetTerritories', 'lbl-reset-territories', 'btn-pause-reset-territories', 'resetTerritories', 1]]
};

function buildSettingSpecRow([kind, a, b, c, d, e, f, g, h]) {
  if (kind === 's') return mkEl('div', '', ['option-row'], { dataset: { descKey: a } }, [mkEl('span', b, ['option-title']), mkEl('div', '', ['option-slider-wrap'], {}, [mkEl('input', c, ['tactical-slider'], { type: 'range', min: e, max: f, step: g, value: h }), mkEl('span', d, ['option-val'])])]);
  if (kind === 'st') return mkEl('div', '', ['option-row'], { dataset: { descKey: a } }, [mkEl('span', b, ['option-title']), mkEl('div', '', ['ui-stepper'], {}, [mkEl('button', '', ['stepper-arrow', 'stepper-prev'], { type: 'button', text: '◂', dataset: { stepper: c, dir: '-1' } }), mkEl('span', d, ['stepper-value'], { dataset: { stepper: c } }), mkEl('button', '', ['stepper-arrow', 'stepper-next'], { type: 'button', text: '▸', dataset: { stepper: c, dir: '1' } })])]);
  if (kind === 'km') return mkEl('div', '', ['option-row', 'option-row-keymap'], { dataset: { descKey: a } }, [mkEl('span', b, ['option-title']), mkEl('div', c, ['controls-keymap-grid'])]);
  return mkEl('div', a, ['option-row', 'ingame-only-setting'], { dataset: { descKey: b } }, [mkEl('span', c, ['option-title']), mkEl('div', '', ['option-action-wrap'], {}, [mkEl('button', d, f ? ['tactical-btn', 'danger-btn'] : ['tactical-btn'], { type: 'button', dataset: { settingAction: e } })])]);
}

function ensurePanelHasRow(panelEl, descKey, rowSpec) {
  if (!panelEl) return;
  const exists =
    (typeof Element !== 'undefined' && panelEl instanceof Element && Boolean(panelEl.querySelector(`[data-desc-key="${descKey}"]`))) ||
    (Array.isArray(panelEl.children) && panelEl.children.some((ch) => ch?.dataset?.descKey === descKey));
  if (!exists) {
    const rowEl = buildSettingSpecRow(rowSpec);
    if (rowEl) panelEl.appendChild?.(rowEl);
  }
}

function buildHeadlessSettingsSubview(subview) {
  subview.classList?.add('hidden', 'settings-screen');
  const panelsWrap = mkEl('div', 'settings-panels-wrap', ['settings-panels-wrap'], {}, SETTINGS_TABS.map((tab) =>
    mkEl('div', `settings-panel-${tab}`, tab === 'audio' ? ['settings-tab-panel'] : ['settings-tab-panel', 'hidden'], {}, PANEL_SPECS[tab].map(buildSettingSpecRow))
  ));
  const footerTop = mkEl('div', '', ['settings-footer-top'], {}, [mkEl('div', 'settings-option-desc'), mkEl('button', 'btn-settings-restore-defaults', ['tactical-btn'], { type: 'button', text: 'RESTAURAR PADRÃO' })]);
  const blocks = [
    mkEl('div', '', ['settings-header-bar'], {}, [mkEl('h2', 'settings-title', ['settings-title'], { text: 'CONFIGURAÇÕES' }), mkEl('button', 'pause-close-btn', ['tactical-btn'], { type: 'button', text: 'VOLTAR' })]),
    mkEl('div', 'settings-tabs-bar', ['settings-tabs-bar'], {}, [mkEl('span', '', ['tab-key-badge'], { text: 'Q' }), ...SETTINGS_TABS.map((tab) => mkEl('button', `tab-btn-${tab}`, ['settings-tab-btn'], { type: 'button', dataset: { settingsTab: tab } })), mkEl('span', '', ['tab-key-badge'], { text: 'E' })]),
    panelsWrap,
    mkEl('div', 'settings-footer-row', ['settings-footer-row'], {}, [footerTop, mkEl('div', 'settings-keyhints-row', ['settings-keyhints-row'])])
  ];
  for (const bl of blocks) if (bl) subview.appendChild?.(bl);
  const modal = byId('pause-options-modal');
  if (modal && !subview.parentNode) modal.appendChild?.(subview);
}

export function installSettingsScreenController(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _initSettingsTabsDom() {
      this._activeSettingsTab = this._activeSettingsTab || 'audio';
      if (typeof document === 'undefined') return;
      const subview = mkEl('div', 'settings-subview', ['settings-subview', 'settings-screen']);
      const hasStructure = Boolean(subview && ((Array.isArray(subview.children) && subview.children.length > 0) || subview.querySelector?.('.settings-tab-panel')));
      if (subview && !hasStructure && typeof document.createElement === 'function') buildHeadlessSettingsSubview(subview);
      else if (subview && !byId('settings-keyhints-row')) {
        const kh = mkEl('div', 'settings-keyhints-row', ['settings-keyhints-row']);
        if (kh) (byId('settings-footer-row') || subview).appendChild?.(kh);
      }
      byId('row-switch-faction')?.classList?.add('hidden');

      this.settingsSubviewEl = subview;
      this.settingsTabBtns = SETTINGS_TABS.map((t) => byId(`tab-btn-${t}`)).filter(Boolean);
      this.settingsTabPanels = Object.fromEntries(SETTINGS_TABS.map((t) => [t, byId(`settings-panel-${t}`)]));
      ensurePanelHasRow(this.settingsTabPanels.video, 'killEffect', ['st', 'killEffect', 'lbl-kill-effect', 'killEffect', 'val-kill-effect']);
      for (const [prop, id] of [
        ['settingsTabsBarEl', 'settings-tabs-bar'], ['sliderMasterEl', 'slider-master-vol'], ['sliderMusicEl', 'slider-music-vol'],
        ['sliderSfxEl', 'slider-sfx-vol'], ['valMasterEl', 'val-master-vol'], ['valMusicEl', 'val-music-vol'], ['valSfxEl', 'val-sfx-vol'],
        ['valGraphicsQualityEl', 'val-graphics-quality'], ['sliderFovEl', 'slider-fov'], ['valFovEl', 'val-fov'],
        ['valFullscreenEl', 'val-fullscreen'], ['btnPauseTimeModeEl', 'btn-pause-time-mode'], ['valKillEffectEl', 'val-kill-effect'],
        ['sliderMouseSensEl', 'slider-mouse-sens'], ['valMouseSensEl', 'val-mouse-sens'], ['valInvertYEl', 'val-invert-y'],
        ['controlsKeymapGridEl', 'controls-keymap-grid'], ['btnPauseLangEl', 'btn-pause-language'], ['btnToggleRegionToastEl', 'btn-toggle-region-toast'],
        ['rowResetTerritoriesEl', 'row-reset-territories'], ['settingsOptionDescEl', 'settings-option-desc'],
        ['btnRestoreDefaultsEl', 'btn-settings-restore-defaults'], ['settingsKeyhintsRowEl', 'settings-keyhints-row']
      ]) this[prop] = byId(id);

      this.graphicsQualityButtons = GRAPHICS_ORDER.map((q) => byId(`btn-quality-${q}`))
        .filter((el) => el && (el.classList?.contains('tactical-quality-btn') || el.dataset?.quality));
    },

    _flushSaveSettings() {
      if (!this._saveSettingsTimer) return;
      clearTimeout(this._saveSettingsTimer);
      this._saveSettingsTimer = null;
      saveGameSettings(this.settings);
    },

    _scheduleSaveSettings() {
      if (this._saveSettingsTimer) clearTimeout(this._saveSettingsTimer);
      this._saveSettingsTimer = setTimeout(() => { this._saveSettingsTimer = null; saveGameSettings(this.settings); }, 150);
      this._saveSettingsTimer?.unref?.();
    },

    _bindSettingsTabsEvents() {
      if (this._settingsTabsEventsBound) return;
      this._settingsTabsEventsBound = true;

      byId('pause-close-btn')?.addEventListener?.('click', () => {
        playMenuBackSound();
        if (this.isTitleScreenActive) {
          this.setPauseMenuOpen(false, this._lastController, true);
          this._setTitleSubPanel?.('main');
          this.refreshMenuNavigationFocus?.(true);
        } else this.openPauseMainView?.(this._pauseReturnBladeId || 'btn-pause-open-settings');
      });

      for (const btn of this.settingsTabBtns || []) {
        btn.addEventListener?.('click', () => {
          const tab = btn.dataset?.settingsTab || 'audio';
          if (tab !== this._activeSettingsTab) playMenuMoveSound();
          this.setActiveSettingsTab(tab, true);
        });
      }

      const bindRange = (el, onIn) => { el?.addEventListener?.('input', onIn); el?.addEventListener?.('change', () => this._flushSaveSettings()); };
      const onVol = () => {
        const m = Math.max(0, Math.min(1, Number(this.sliderMasterEl?.value ?? 85) / 100));
        const mu = Math.max(0, Math.min(1, Number(this.sliderMusicEl?.value ?? 55) / 100));
        const s = Math.max(0, Math.min(1, Number(this.sliderSfxEl?.value ?? 90) / 100));
        Object.assign(this.settings, { masterVolume: m, musicVolume: mu, sfxVolume: s });
        if (this.valMasterEl) this.valMasterEl.textContent = `${Math.round(m * 100)}%`;
        if (this.valMusicEl) this.valMusicEl.textContent = `${Math.round(mu * 100)}%`;
        if (this.valSfxEl) this.valSfxEl.textContent = `${Math.round(s * 100)}%`;
        soundFX.setVolumes({ masterVolume: m, musicVolume: mu, sfxVolume: s });
        this._scheduleSaveSettings();
      };
      for (const sEl of [this.sliderMasterEl, this.sliderMusicEl, this.sliderSfxEl]) bindRange(sEl, onVol);

      bindRange(this.sliderFovEl, () => {
        const fov = Math.max(50, Math.min(85, Math.round(Number(this.sliderFovEl?.value ?? 60))));
        this.settings.fov = fov;
        if (this.valFovEl) this.valFovEl.textContent = `${fov}°`;
        if (this._lastController?.camera) { this._lastController.camera.fov = fov; this._lastController.camera.updateProjectionMatrix?.(); }
        this._scheduleSaveSettings();
      });

      bindRange(this.sliderMouseSensEl, () => {
        const pct = Math.max(20, Math.min(250, Math.round(Number(this.sliderMouseSensEl?.value ?? 100))));
        this.settings.mouseSensitivity = Number((pct / 100).toFixed(2));
        if (this.valMouseSensEl) this.valMouseSensEl.textContent = `${pct}%`;
        this._scheduleSaveSettings();
      });

      const stepperNodes = [];
      if (typeof Element !== 'undefined' && this.settingsSubviewEl instanceof Element) stepperNodes.push(...Array.from(this.settingsSubviewEl.querySelectorAll('[data-stepper]')));
      else { const walk = (n) => { if (n?.dataset?.stepper) stepperNodes.push(n); if (Array.isArray(n?.children)) for (const c of n.children) walk(c); }; walk(this.settingsSubviewEl); }
      for (const node of stepperNodes) {
        if (!node._stepperBound) { node._stepperBound = true; node.addEventListener?.('click', () => this._stepSettingValue(node.dataset.stepper, Number(node.dataset?.dir) < 0 ? -1 : 1)); }
      }
      for (const [node, key] of [[this.valGraphicsQualityEl, 'graphicsQuality'], [this.valFullscreenEl, 'fullscreen'], [this.btnPauseTimeModeEl, 'timeMode'], [this.valKillEffectEl, 'killEffect'], [this.valInvertYEl, 'invertY'], [this.btnPauseLangEl, 'language'], [this.btnToggleRegionToastEl, 'regionToast']]) {
        if (node && !node._stepperBound) { node._stepperBound = true; node.addEventListener?.('click', () => this._stepSettingValue(key, 1)); }
      }
      for (const btn of this.graphicsQualityButtons || []) btn.addEventListener?.('click', () => this.setGraphicsQuality(btn.dataset?.quality || 'auto'));

      byId('btn-pause-reset-territories')?.addEventListener?.('click', () => {
        if ((globalThis.__testEnvReady && !this.isPauseMenuOpen) || typeof this.openConfirmDialog !== 'function') return this._performResetTerritories();
        const c = (UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR']).confirms?.resetTerritories || {};
        this.openConfirmDialog({ title: c.title, message: c.message, danger: true, defaultFocus: 'confirm', onConfirm: () => this._performResetTerritories() });
      });
      this.btnRestoreDefaultsEl?.addEventListener?.('click', () => {
        const t = UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR'];
        if (typeof this.openConfirmDialog !== 'function') return this.restoreActiveSettingsTabDefaults();
        const c = t.confirms?.restoreDefaults || {};
        this.openConfirmDialog({ title: c.title, message: c.message, danger: false, defaultFocus: 'confirm', onConfirm: () => this.restoreActiveSettingsTabDefaults() });
      });
      document?.addEventListener?.('fullscreenchange', () => { this._isFullscreenFallback = Boolean(document.fullscreenElement); this._refreshSettingsTabsUI(); });
    },

    _performResetTerritories() {
      const t = UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR'];
      this.onResetTerritories?.();
      this.saveCurrentProgress?.();
      this._updatePauseContextPanel?.();
      this._showPauseFeedbackBanner?.(t.resetTerritoriesFeedback, 2200);
      if (this.settingsOptionDescEl && t.resetTerritoriesFeedback) this.settingsOptionDescEl.textContent = t.resetTerritoriesFeedback;
      soundFX.playTrueHeroFanfare();
    },

    openSettingsSubview(tabId = null) {
      if (!this.isTitleScreenActive) this._pauseReturnBladeId = this._pauseReturnBladeId || 'btn-pause-open-settings';
      this.pauseMainViewEl?.classList?.add('hidden');
      this.pauseIngameActionsEl?.classList?.add('hidden');
      this.settingsSubviewEl?.classList?.remove('hidden');
      this.setActiveSettingsTab(tabId || this._activeSettingsTab || 'audio', false);
      this._refreshSettingsTabsUI();
      this.refreshMenuNavigationFocus?.(true);
    },

    openSettingsFromTitle(tabId = 'audio') {
      this._activeSettingsTab = SETTINGS_TABS.includes(tabId) ? tabId : 'audio';
      this.setPauseMenuOpen?.(true, this._lastController, true);
      this.openSettingsSubview(this._activeSettingsTab);
    },

    setActiveSettingsTab(tabId = 'audio', refreshNav = true) {
      const next = SETTINGS_TABS.includes(tabId) ? tabId : 'audio';
      this._activeSettingsTab = next;
      for (const btn of this.settingsTabBtns || []) {
        const active = btn.dataset?.settingsTab === next;
        btn.classList?.toggle('active', active);
        btn.setAttribute?.('aria-selected', active ? 'true' : 'false');
      }
      for (const key of SETTINGS_TABS) this.settingsTabPanels?.[key]?.classList?.toggle('hidden', key !== next);
      this._syncIngameOnlySettingsRows();
      if (refreshNav) this.refreshMenuNavigationFocus?.(true);
    },

    stepSettingsTab(dir = 1) { this.setActiveSettingsTab(cycle(SETTINGS_TABS, this._activeSettingsTab || 'audio', dir), true); },
    _syncIngameOnlySettingsRows() { byId('row-switch-faction')?.classList?.add('hidden'); this.rowResetTerritoriesEl?.classList?.toggle('hidden', Boolean(this.isTitleScreenActive)); },

    setGraphicsQuality(nextQuality = 'auto') {
      const valid = GRAPHICS_ORDER.includes(nextQuality) ? nextQuality : 'auto';
      this.settings.graphicsQuality = valid;
      saveGameSettings(this.settings);
      soundFX.playHeroSwap();
      this.onChangeGraphicsQuality?.(valid);
      this._refreshLanguageAndOptionsUI?.();
    },

    _isFullscreenActive() { return typeof document !== 'undefined' && document.documentElement?.requestFullscreen ? Boolean(document.fullscreenElement) : Boolean(this._isFullscreenFallback); },

    _toggleFullscreen() {
      if (typeof document !== 'undefined' && document.documentElement?.requestFullscreen) {
        this._isFullscreenFallback = !document.fullscreenElement;
        if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {});
        else document.documentElement.requestFullscreen()?.catch?.(() => {});
      } else this._isFullscreenFallback = !this._isFullscreenFallback;
      soundFX.playPlasticHit();
      this._refreshSettingsTabsUI();
    },

    _stepSettingValue(stepperKey, dir = 1) {
      if (stepperKey === 'graphicsQuality') return this.setGraphicsQuality(cycle(GRAPHICS_ORDER, this.settings.graphicsQuality || 'auto', dir));
      if (stepperKey === 'fullscreen') return this._toggleFullscreen();
      if (stepperKey === 'timeMode') {
        this.settings.timeMode = cycle(TIME_ORDER, this.settings.timeMode || 'auto', dir);
        saveGameSettings(this.settings);
        soundFX.playHeroSwap();
        this.onChangeTimeMode?.(this.settings.timeMode);
        return this._refreshLanguageAndOptionsUI?.();
      }
      if (stepperKey === 'killEffect') {
        this.settings.killEffect = this.settings.killEffect === false;
        saveGameSettings(this.settings);
        soundFX.playPlasticHit();
        this.onChangeKillEffect?.(this.settings.killEffect);
        return this._refreshSettingsTabsUI();
      }
      if (stepperKey === 'invertY') { this.settings.invertY = !this.settings.invertY; saveGameSettings(this.settings); soundFX.playPlasticHit(); return this._refreshSettingsTabsUI(); }
      if (stepperKey === 'language') { if (cycle(LANG_ORDER, this.settings.language || 'pt-BR', dir) !== this.settings.language) this._toggleLanguage?.(); return; }
      if (stepperKey === 'regionToast') {
        this.settings.showRegionToast = !this.settings.showRegionToast;
        if (!this.settings.showRegionToast) this.regionToastEl?.classList?.add('hidden');
        saveGameSettings(this.settings);
        soundFX.playPlasticHit();
        this._refreshLanguageAndOptionsUI?.();
      }
    },

    restoreActiveSettingsTabDefaults(tabId = this._activeSettingsTab) {
      const tab = SETTINGS_TABS.includes(tabId) ? tabId : 'audio';
      const d = DEFAULT_GAME_SETTINGS;
      if (tab === 'audio') {
        Object.assign(this.settings, { masterVolume: d.masterVolume, musicVolume: d.musicVolume, sfxVolume: d.sfxVolume });
        soundFX.setVolumes({ masterVolume: d.masterVolume, musicVolume: d.musicVolume, sfxVolume: d.sfxVolume });
      } else if (tab === 'video') {
        Object.assign(this.settings, { graphicsQuality: d.graphicsQuality, fov: d.fov, timeMode: d.timeMode, killEffect: d.killEffect });
        if (this._isFullscreenActive()) { this._isFullscreenFallback = false; document?.fullscreenElement && document.exitFullscreen?.()?.catch?.(() => {}); }
        this.onChangeGraphicsQuality?.(d.graphicsQuality);
        this.onChangeTimeMode?.(d.timeMode);
        this.onChangeKillEffect?.(d.killEffect);
        if (this._lastController?.camera) { this._lastController.camera.fov = d.fov; this._lastController.camera.updateProjectionMatrix?.(); }
      } else if (tab === 'controls') {
        Object.assign(this.settings, { mouseSensitivity: d.mouseSensitivity, invertY: d.invertY });
      } else if (tab === 'game') {
        const prevLang = this.settings.language;
        Object.assign(this.settings, { language: d.language, showRegionToast: d.showRegionToast });
        if (prevLang !== d.language) this.setPlayerFaction?.(this.playerFaction, false);
      }
      saveGameSettings(this.settings);
      if (typeof this._refreshLanguageAndOptionsUI === 'function') this._refreshLanguageAndOptionsUI();
      else this._refreshSettingsTabsUI();
      const t = UI_TEXTS[this.settings.language] || UI_TEXTS['pt-BR'];
      if (this.settingsOptionDescEl && t.restoredFeedback) this.settingsOptionDescEl.textContent = t.restoredFeedback;
    },

    _updateFocusedOptionDescription(focusedEl) {
      if (!this.settingsOptionDescEl) return;
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
      const key = focusedEl?.dataset?.descKey || (typeof focusedEl?.closest === 'function' ? focusedEl.closest('[data-desc-key]')?.dataset?.descKey : '') || '';
      if (key && t.optionDescs?.[key]) this.settingsOptionDescEl.textContent = t.optionDescs[key];
      else if (focusedEl?.id === 'btn-settings-restore-defaults') this.settingsOptionDescEl.textContent = t.confirms?.restoreDefaults?.message || '';
      else if (focusedEl?.id === 'settings-tabs-bar') this.settingsOptionDescEl.textContent = lang === 'en-US' ? 'Use Q / E or Left / Right to switch tabs.' : 'Use Q / E ou as setas laterais para alternar abas.';
    },

    _refreshSettingsTabsUI() {
      const lang = this.settings?.language || 'pt-BR';
      const isEn = lang === 'en-US';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
      for (const [id, val] of [
        ['settings-title', t.settingsTitle], ['pause-close-btn', t.backBtn], ['tab-btn-audio', t.settingsTabs?.audio],
        ['tab-btn-video', t.settingsTabs?.video], ['tab-btn-controls', t.settingsTabs?.controls], ['tab-btn-game', t.settingsTabs?.game],
        ['lbl-master-vol', t.masterVol], ['lbl-music-vol', t.musicVol], ['lbl-sfx-vol', t.sfxVol],
        ['lbl-graphics-quality', t.graphicsQualityLabel], ['lbl-fov', t.fovLabel], ['lbl-fullscreen', t.fullscreenLabel],
        ['lbl-time-mode', t.timeOfDayLabel], ['lbl-kill-effect', t.killEffectLabel], ['lbl-mouse-sens', t.mouseSensLabel], ['lbl-invert-y', t.invertYLabel],
        ['lbl-controls-list', t.controlsSectionTitle], ['lbl-lang-select', t.langLabel], ['lbl-region-toast', t.regionToastToggle],
        ['lbl-reset-territories', t.resetTerritoriesBtn], ['btn-pause-reset-territories', t.resetTerritoriesBtn],
        ['btn-settings-restore-defaults', t.restoreDefaultsBtn]
      ]) { const el = byId(id); if (el && val !== undefined) el.textContent = val; }

      const mPct = Math.round((this.settings.masterVolume ?? 0.85) * 100);
      const muPct = Math.round((this.settings.musicVolume ?? 0.55) * 100);
      const sPct = Math.round((this.settings.sfxVolume ?? 0.9) * 100);
      const fov = Math.max(50, Math.min(85, Math.round(Number(this.settings.fov ?? 60))));
      const sensPct = Math.max(20, Math.min(250, Math.round(Number(this.settings.mouseSensitivity ?? 1.0) * 100)));
      for (const [sEl, vEl, num, suf] of [
        [this.sliderMasterEl, this.valMasterEl, mPct, '%'], [this.sliderMusicEl, this.valMusicEl, muPct, '%'],
        [this.sliderSfxEl, this.valSfxEl, sPct, '%'], [this.sliderFovEl, this.valFovEl, fov, '°'], [this.sliderMouseSensEl, this.valMouseSensEl, sensPct, '%']
      ]) { if (sEl) sEl.value = String(num); if (vEl) vEl.textContent = `${num}${suf}`; }

      const qKey = this.settings.graphicsQuality || 'auto';
      const qLabels = t.graphicsModes || UI_TEXTS['pt-BR'].graphicsModes;
      if (this.valGraphicsQualityEl) this.valGraphicsQualityEl.textContent = qLabels[qKey] || qLabels.auto;
      for (const btn of this.graphicsQualityButtons || []) {
        const key = btn.dataset?.quality || 'auto';
        btn.textContent = qLabels[key] || key.toUpperCase();
        btn.classList?.toggle('active', key === qKey);
      }

      const mLabels = { ...(t.timeModes || UI_TEXTS['pt-BR'].timeModes), sunset: isEn ? 'SUNSET' : 'PÔR DO SOL' };
      if (this.valFullscreenEl) this.valFullscreenEl.textContent = this._isFullscreenActive() ? t.toggleOn : t.toggleOff;
      if (this.btnPauseTimeModeEl) this.btnPauseTimeModeEl.textContent = mLabels[this.settings.timeMode || 'auto'] || mLabels.auto;
      if (this.valKillEffectEl) {
        const killOn = this.settings.killEffect !== false;
        this.valKillEffectEl.textContent = killOn ? t.toggleOn : t.toggleOff;
        this.valKillEffectEl.classList?.toggle('active', killOn);
      }
      if (this.valInvertYEl) this.valInvertYEl.textContent = this.settings.invertY ? t.toggleOn : t.toggleOff;
      if (this.btnPauseLangEl) this.btnPauseLangEl.textContent = t.langModes?.[lang] || (isEn ? 'ENGLISH' : 'PORTUGUÊS');
      if (this.btnToggleRegionToastEl) {
        const on = Boolean(this.settings.showRegionToast);
        this.btnToggleRegionToastEl.classList?.toggle('active', on);
        this.btnToggleRegionToastEl.textContent = on ? t.toggleOn : t.toggleOff;
      }
      if (this.controlsKeymapGridEl && Array.isArray(t.controlsList)) {
        this.controlsKeymapGridEl.innerHTML = t.controlsList.map(([keys, label]) => `<div class="keymap-row"><span class="keymap-action">${label}</span><span class="keymap-keys">${keys}</span></div>`).join('');
      }
      const khEl = this.settingsKeyhintsRowEl || byId('settings-keyhints-row');
      if (khEl) {
        const hints = t.keyHints?.settings || [['Q/E', isEn ? 'Tab' : 'Aba'], ['◂▸', isEn ? 'Adjust' : 'Ajustar'], ['R', isEn ? 'Restore defaults' : 'Restaurar padrão'], ['ESC', isEn ? 'Back' : 'Voltar']];
        khEl.innerHTML = hints.map(([k, txt]) => `<span class="keyhint-item"><kbd class="keyhint-kbd">${k}</kbd><span class="keyhint-label">${txt}</span></span>`).join('');
      }
      this._syncIngameOnlySettingsRows();
      if (this._focusedMenuEl) this._updateFocusedOptionDescription(this._focusedMenuEl);
    }
  });
}

export const installSettingsTabsController = installSettingsScreenController;
