import { soundFX } from '../../audio/SoundFX.js';
import { getActiveCustomHero } from '../../entities/CustomHeroSystem.js';
import { formatRoleTitle } from '../../entities/operators/RoleBaselines.js';
import { EXTRAS_CATALOG } from '../../progression/RosterAndUnlocks.js';
import { getHeroInfo, syncOp09CatalogSlot, drawHeroLegoPortrait } from '../HeroWheelAndDossier.js';
import { FACTION_DATA, UI_TEXTS, getFactionLogoSvg } from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';
import { playMenuConfirmSound } from './ConfirmDialog.js';
import { installCharacterStoreSubview } from './CharacterStoreSubview.js';

const PAUSE_FACTION_PALETTES = {
  cv: { accent: '#dc2626', rgb: '220, 38, 38', dark: '#24070b', short: 'CV' },
  pcc: { accent: '#3b82f6', rgb: '59, 130, 246', dark: '#08152b', short: 'PCC' },
  ares: { accent: '#a855f7', rgb: '168, 85, 247', dark: '#19092b', short: 'A.R.E.S.' },
  default: { accent: '#c28e2b', rgb: '194, 142, 43', dark: '#211807', short: '—' }
};

const BLADE_SPECS = [
  ['btn-pause-resume', ['tactical-btn', 'pause-blade-btn', 'pause-main-btn'], 'CONTINUAR'],
  ['btn-pause-map', ['tactical-btn', 'pause-blade-btn'], 'MAPA'],
  ['btn-pause-heroes', ['tactical-btn', 'pause-blade-btn'], 'PERSONAGENS'],
  ['btn-pause-open-settings', ['tactical-btn', 'pause-blade-btn'], 'CONFIGURAÇÕES'],
  ['btn-pause-save', ['tactical-btn', 'pause-blade-btn'], 'SALVAR JOGO'],
  ['btn-pause-switch-faction', ['tactical-btn', 'pause-blade-btn'], 'TROCAR FACÇÃO'],
  ['btn-pause-save-quit', ['tactical-btn', 'pause-blade-btn', 'pause-blade-danger', 'danger-btn'], 'SAIR PARA O MENU']
];

const byId = (id) => (typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document.getElementById(id) : null);

function obtainPauseEl(tag, id = '', classes = [], text = '') {
  if (typeof document === 'undefined') return null;
  let el = id ? byId(id) : null;
  if (!el && typeof document.createElement === 'function') { el = document.createElement(tag); if (el && id) el.id = id; }
  else if (el && globalThis.__testEnvReady && el.tagName !== tag.toUpperCase()) { try { el.tagName = tag.toUpperCase(); } catch (_) { /* readonly */ } }
  if (!el) return null;
  if (classes.length) el.classList?.add(...classes);
  if (text && !el.textContent) el.textContent = text;
  if (tag === 'button') { try { el.type = 'button'; } catch (_) { /* readonly */ } el.setAttribute?.('type', 'button'); }
  return el;
}

function clearChildren(el) {
  if (!el) return;
  if (typeof Element !== 'undefined' && el instanceof Element) {
    if (typeof el.replaceChildren === 'function') el.replaceChildren();
    else el.innerHTML = '';
  } else { el.innerHTML = ''; if (Array.isArray(el.children)) el.children.length = 0; }
}

function formatPlayTimeHMS(sec) {
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatGameClockHM(timeHours) {
  const norm = (((Number(timeHours) || 0) % 24) + 24) % 24;
  const totalMin = Math.floor(norm * 60 + 1e-6) % 1440;
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

export function installPauseMenuController(LegoHud) {
  if (typeof LegoHud.prototype.openCharacterStoreSubview !== 'function') {
    installCharacterStoreSubview(LegoHud);
  }
  definePrototypeMethods(LegoHud, {
    _initPauseMenuDom() {
      if (typeof document === 'undefined') return;
      this.pauseModalEl = obtainPauseEl('div', 'pause-options-modal');
      if (!this.isPauseMenuOpen) this.pauseModalEl?.classList?.add('hidden');

      this.pauseBgCrestEl = obtainPauseEl('div', 'pause-bg-crest', ['pause-bg-crest']);
      if (this.pauseModalEl && this.pauseBgCrestEl && !this.pauseBgCrestEl.parentNode) {
        const bgLayer = obtainPauseEl('div', '', ['pause-bg-layer']);
        for (const sl of ['slash-a', 'slash-b', 'slash-c']) bgLayer?.appendChild?.(obtainPauseEl('div', '', ['pause-diag-slash', sl]));
        bgLayer?.appendChild?.(this.pauseBgCrestEl);
        this.pauseModalEl.appendChild?.(bgLayer || this.pauseBgCrestEl);
      }

      this.pauseMainViewEl = obtainPauseEl('div', 'pause-main-view', ['pause-shell', 'pause-main-view']);
      if (this.pauseModalEl && this.pauseMainViewEl && !this.pauseMainViewEl.parentNode) this.pauseModalEl.appendChild?.(this.pauseMainViewEl);

      this.pauseTopBarEl = obtainPauseEl('header', 'pause-top-bar', ['pause-top-bar']);
      this.pauseTopStudsEl = obtainPauseEl('span', 'pause-top-studs', [], '0');
      this.pauseTopLocationEl = obtainPauseEl('span', 'pause-top-location', [], 'CENTRO FINANCEIRO · 20:00');
      if (this.pauseTopBarEl && !this.pauseTopLocationEl?.parentNode) {
        const studsWrap = obtainPauseEl('div', '', ['pause-studs-display']);
        studsWrap?.appendChild?.(obtainPauseEl('span', '', ['pause-stud-icon']));
        if (this.pauseTopStudsEl) studsWrap?.appendChild?.(this.pauseTopStudsEl);
        for (const ch of [studsWrap, obtainPauseEl('span', '', ['pause-top-divider']), this.pauseTopLocationEl]) if (ch) this.pauseTopBarEl.appendChild?.(ch);
      }
      if (this.pauseMainViewEl && this.pauseTopBarEl && !this.pauseTopBarEl.parentNode) this.pauseMainViewEl.appendChild?.(this.pauseTopBarEl);

      this.pauseIngameActionsEl = obtainPauseEl('nav', 'pause-ingame-actions', ['pause-blades-col', 'pause-actions-grid']);
      const existingBlades = BLADE_SPECS.map(([id]) => byId(id)).filter(Boolean);
      if (this.pauseIngameActionsEl && (existingBlades.length !== BLADE_SPECS.length || !existingBlades.every((b) => Boolean(b.parentNode)) || !this.pauseIngameActionsEl.children?.length)) {
        clearChildren(this.pauseIngameActionsEl);
        BLADE_SPECS.forEach(([id, cls, lbl], idx) => {
          const btn = obtainPauseEl('button', id, cls, lbl);
          if (btn) { btn.style?.setProperty?.('--blade-idx', String(idx)); this.pauseIngameActionsEl.appendChild?.(btn); }
        });
      } else {
        BLADE_SPECS.forEach(([id, cls], idx) => {
          const btn = byId(id);
          if (btn) { btn.classList?.add(...cls); btn.style?.setProperty?.('--blade-idx', String(idx)); }
        });
      }

      this.pauseHeroCardEl = obtainPauseEl('div', 'pause-hero-card', ['pause-hero-card']);
      this.pauseHeroCardCanvasEl = obtainPauseEl('canvas', 'pause-hero-card-canvas', []);
      this.pauseHeroCardNameEl = obtainPauseEl('div', 'pause-hero-card-name', [], 'COMANDANTE CAVEIRA');
      this.pauseHeroCardRoleEl = obtainPauseEl('div', 'pause-hero-card-role', [], 'OPERAÇÕES ESPECIAIS');
      if (this.pauseHeroCardEl && !this.pauseHeroCardCanvasEl?.parentNode) {
        const inner = obtainPauseEl('div', '', ['pause-hero-card-inner']);
        const wrap = obtainPauseEl('div', '', ['pause-hero-portrait-wrap']);
        const plate = obtainPauseEl('div', '', ['pause-hero-nameplate']);
        if (this.pauseHeroCardCanvasEl) wrap?.appendChild?.(this.pauseHeroCardCanvasEl);
        if (this.pauseHeroCardNameEl) plate?.appendChild?.(this.pauseHeroCardNameEl);
        if (this.pauseHeroCardRoleEl) plate?.appendChild?.(this.pauseHeroCardRoleEl);
        if (wrap) inner?.appendChild?.(wrap);
        if (plate) inner?.appendChild?.(plate);
        if (inner) this.pauseHeroCardEl.appendChild?.(inner);
      }

      if (this.pauseMainViewEl && (!this.pauseIngameActionsEl?.parentNode || !this.pauseHeroCardEl?.parentNode)) {
        const centerStage = obtainPauseEl('div', '', ['pause-center-stage']);
        if (this.pauseIngameActionsEl) centerStage?.appendChild?.(this.pauseIngameActionsEl);
        if (this.pauseHeroCardEl) centerStage?.appendChild?.(this.pauseHeroCardEl);
        if (centerStage) this.pauseMainViewEl.appendChild?.(centerStage);
      }

      this.pauseBottomBarEl = obtainPauseEl('footer', 'pause-bottom-bar', ['pause-bottom-bar']);
      this.pauseStatBricksEl = obtainPauseEl('b', 'pause-stat-bricks', [], '0');
      this.pauseStatTerritoriesEl = obtainPauseEl('b', 'pause-stat-territories', [], '1/3');
      this.pauseStatFactionIconEl = obtainPauseEl('span', 'pause-stat-faction-icon', ['pause-mini-crest']);
      this.pauseStatFactionEl = obtainPauseEl('b', 'pause-stat-faction', [], 'CV');
      this.pauseStatPlaytimeEl = obtainPauseEl('b', 'pause-stat-playtime', [], '00:00:00');
      this.pauseSaveFeedbackEl = obtainPauseEl('span', 'pause-save-feedback', ['hidden'], 'JOGO SALVO');
      this.pauseKeyhintsRowEl = obtainPauseEl('div', 'pause-keyhints-row', []);

      if (this.pauseBottomBarEl && !this.pauseStatBricksEl?.parentNode) {
        const statsRow = obtainPauseEl('div', '', ['pause-stats-row']);
        for (const ch of [this.pauseStatBricksEl, this.pauseStatTerritoriesEl, this.pauseStatFactionIconEl, this.pauseStatFactionEl, this.pauseStatPlaytimeEl, this.pauseSaveFeedbackEl]) {
          if (ch) statsRow?.appendChild?.(ch);
        }
        if (statsRow) this.pauseBottomBarEl.appendChild?.(statsRow);
        if (this.pauseKeyhintsRowEl) this.pauseBottomBarEl.appendChild?.(this.pauseKeyhintsRowEl);
      }
      if (this.pauseMainViewEl && this.pauseBottomBarEl && !this.pauseBottomBarEl.parentNode) this.pauseMainViewEl.appendChild?.(this.pauseBottomBarEl);
      this._ensureCharacterStoreDom?.();

      byId('hud-esc-hint-pill')?.addEventListener?.('click', () => {
        if (!this.isTitleScreenActive && !this.isLoadingActive) this.setPauseMenuOpen(true, this._lastController);
      });
    },

    _bindPauseMenuEvents() {
      if (this._pauseMenuEventsBound) return;
      this._pauseMenuEventsBound = true;
      const openCharacterStore = () => {
        this._pauseReturnBladeId = 'btn-pause-heroes';
        this.openCharacterStoreSubview?.(this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey);
      };

      byId('btn-pause-resume')?.addEventListener?.('click', () => this.setPauseMenuOpen(false, this._lastController));
      byId('btn-pause-map')?.addEventListener?.('click', () => {
        this.setPauseMenuOpen(false, this._lastController, true);
        this.setFullMapOpen?.(true, this._lastController?.world, this._lastController);
      });
      byId('btn-pause-heroes')?.addEventListener?.('click', openCharacterStore);
      this.pauseHeroCardEl?.addEventListener?.('click', () => { playMenuConfirmSound(); openCharacterStore(); });
      byId('btn-pause-open-settings')?.addEventListener?.('click', () => {
        this._pauseReturnBladeId = 'btn-pause-open-settings';
        this.openSettingsSubview?.(this._activeSettingsTab || 'audio');
      });
      byId('btn-pause-save')?.addEventListener?.('click', () => {
        const isEn = (this.settings?.language || 'pt-BR') === 'en-US';
        this.saveCurrentProgress();
        this._updatePauseTopAndFooter();
        this._showPauseFeedbackBanner(isEn ? 'GAME SAVED' : 'JOGO SALVO', 1800);
        soundFX.playTrueHeroFanfare();
      });
      byId('btn-pause-switch-faction')?.addEventListener?.('click', () => {
        if ((globalThis.__testEnvReady && !this.isPauseMenuOpen) || typeof this.openConfirmDialog !== 'function') return this._performSwitchFaction();
        const c = (UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR']).confirms?.switchFaction || {};
        this.openConfirmDialog({ title: c.title, message: c.message, danger: false, defaultFocus: 'confirm', onConfirm: () => this._performSwitchFaction() });
      });
      byId('btn-pause-save-quit')?.addEventListener?.('click', () => {
        if ((globalThis.__testEnvReady && !this.isPauseMenuOpen) || typeof this.openConfirmDialog !== 'function') return this._performQuitToTitle(true);
        const lang = this.settings?.language || 'pt-BR';
        const isEn = lang === 'en-US';
        const qc = (UI_TEXTS[lang] || UI_TEXTS['pt-BR']).quitChoices || {};
        this.openConfirmDialog({
          title: qc.title || (isEn ? 'QUIT TO MENU' : 'SAIR PARA O MENU'),
          message: qc.message || (isEn ? 'How would you like to return to the main menu?' : 'Deseja salvar seu progresso antes de voltar ao menu inicial?'),
          options: [
            { id: 'save-and-quit', label: isEn ? 'Save and quit' : 'Salvar e sair', primary: true, onSelect: () => this._performQuitToTitle(true) },
            { id: 'quit-without-save', label: isEn ? 'Quit without saving' : 'Sair sem salvar', danger: true, onSelect: () => this._performQuitToTitle(false) },
            { id: 'cancel', label: isEn ? 'Cancel' : 'Cancelar', onSelect: () => {} }
          ]
        });
      });
    },

    _applyPauseFactionTheme() {
      const fKey = FACTION_DATA[this.playerFaction] ? this.playerFaction : null;
      const pal = (fKey && PAUSE_FACTION_PALETTES[fKey]) || PAUSE_FACTION_PALETTES.default;
      const modal = this.pauseModalEl || byId('pause-options-modal');
      if (modal) {
        modal.style?.setProperty?.('--pause-accent', pal.accent);
        modal.style?.setProperty?.('--pause-accent-rgb', pal.rgb);
        modal.style?.setProperty?.('--pause-accent-dark', pal.dark);
        if (modal.dataset) modal.dataset.faction = fKey || 'none';
      }
      const crestKey = fKey || 'cv';
      const bgCrestEl = this.pauseBgCrestEl || byId('pause-bg-crest');
      if (bgCrestEl) bgCrestEl.innerHTML = getFactionLogoSvg(crestKey, 520);
      const statIconEl = this.pauseStatFactionIconEl || byId('pause-stat-faction-icon');
      if (statIconEl) statIconEl.innerHTML = getFactionLogoSvg(crestKey, 18);
    },

    _updatePauseTopAndFooter() {
      const lang = this.settings?.language || 'pt-BR';
      const isEn = lang === 'en-US';
      const topStudsEl = this.pauseTopStudsEl || byId('pause-top-studs');
      if (topStudsEl) topStudsEl.textContent = Math.max(0, Math.floor(Number(this.totalStuds || 0))).toLocaleString(isEn ? 'en-US' : 'pt-BR');

      const pos = this._lastController?.position;
      const reg = pos && typeof this._lastController?.world?.getRegionAt === 'function' ? this._lastController.world.getRegionAt(pos.x, pos.y, pos.z) : null;
      const regionName = String(reg?.shortName || reg?.name || this.minimapNameEl?.textContent?.trim() || (isEn ? 'DOWNTOWN' : 'CENTRO FINANCEIRO')).toUpperCase();
      const rawHours = this._lastController?.world?.dayNight?.timeHours ?? this._lastController?.world?.atmosphere?.timeHours ?? 20;
      const topLocEl = this.pauseTopLocationEl || byId('pause-top-location');
      if (topLocEl) topLocEl.textContent = `${regionName} · ${formatGameClockHM(rawHours)}`;

      const fKey = FACTION_DATA[this.playerFaction] ? this.playerFaction : null;
      const pal = (fKey && PAUSE_FACTION_PALETTES[fKey]) || PAUSE_FACTION_PALETTES.default;
      const conq = typeof this.getConqueredTerritories === 'function' ? this.getConqueredTerritories() : [];
      const conqSet = new Set(Array.isArray(conq) ? conq.filter(Boolean) : []);
      if (fKey) conqSet.add(fKey);

      const bricksEl = this.pauseStatBricksEl || byId('pause-stat-bricks');
      if (bricksEl) bricksEl.textContent = String(Math.max(0, Math.floor(Number(this.goldenBricks || 0))));
      const terrEl = this.pauseStatTerritoriesEl || byId('pause-stat-territories');
      if (terrEl) terrEl.textContent = `${Math.min(3, conqSet.size)}/3`;
      const facEl = this.pauseStatFactionEl || byId('pause-stat-faction');
      if (facEl) facEl.textContent = pal.short;
      const playEl = this.pauseStatPlaytimeEl || byId('pause-stat-playtime');
      if (playEl) playEl.textContent = formatPlayTimeHMS(this.sessionPlayTimeSec || 0);

      const khRow = this.pauseKeyhintsRowEl || byId('pause-keyhints-row');
      if (khRow) {
        const hints = [['↑↓', isEn ? 'Navigate' : 'Navegar'], ['ENTER', isEn ? 'Select' : 'Selecionar'], ['ESC', isEn ? 'Resume' : 'Continuar']];
        khRow.innerHTML = hints.map(([k, txt]) => `<span class="keyhint-item"><kbd class="keyhint-kbd">${k}</kbd><span class="keyhint-label">${txt}</span></span>`).join('');
      }
    },

    _updatePauseHeroCard() {
      const lang = this.settings?.language || 'pt-BR';
      const isEn = lang === 'en-US';
      const heroKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira';
      if (heroKey === 'op09') syncOp09CatalogSlot();
      const info = getHeroInfo(heroKey);

      const canvas = this.pauseHeroCardCanvasEl || byId('pause-hero-card-canvas');
      if (canvas) {
        const dpr = Math.min(2, (typeof window !== 'undefined' && Number(window.devicePixelRatio)) || 1);
        const targetW = Math.round(420 * dpr);
        const targetH = Math.round(520 * dpr);
        if (canvas.width !== targetW) canvas.width = targetW;
        if (canvas.height !== targetH) canvas.height = targetH;
        const ctx = canvas.getContext?.('2d');
        if (ctx) drawHeroLegoPortrait(ctx, canvas.width, canvas.height, heroKey);
      }

      let heroName = '';
      let heroRole = '';
      const extraSpec = EXTRAS_CATALOG[heroKey];
      if (heroKey === 'op09') {
        const customCfg = getActiveCustomHero();
        heroName = String(info?.name || (isEn ? 'ORDINARY CITIZEN' : 'CIDADÃO COMUM')).toUpperCase();
        heroRole = customCfg?.isCreated ? (isEn ? 'CUSTOM OPERATOR' : 'OPERADOR CUSTOMIZADO') : (isEn ? 'ORDINARY CITIZEN' : 'CIDADÃO COMUM');
      } else if (extraSpec?.category === 'secret_boss') {
        heroName = String(extraSpec.name?.[lang] || extraSpec.name?.['pt-BR'] || heroKey).toUpperCase();
        heroRole = formatRoleTitle(extraSpec.roles, lang).toUpperCase();
      } else {
        heroName = String(info?.cleanName || info?.shortName || info?.name || 'COMANDANTE CAVEIRA').toUpperCase();
        const roleFromMap = info?.cleanRole && typeof info.cleanRole === 'object' ? info.cleanRole[lang] : info?.cleanRole;
        heroRole = String(roleFromMap || String(info?.role || '').split('//')[0].trim()).toUpperCase();
      }
      const nameEl = this.pauseHeroCardNameEl || byId('pause-hero-card-name');
      if (nameEl) nameEl.textContent = heroName;
      const roleEl = this.pauseHeroCardRoleEl || byId('pause-hero-card-role');
      if (roleEl) roleEl.textContent = heroRole;
    },

    _updatePauseContextPanel() {
      this._applyPauseFactionTheme();
      this._updatePauseTopAndFooter();
      this._updatePauseHeroCard();
    },

    _refreshPauseMenuLabels() {
      const lang = this.settings?.language || 'pt-BR';
      const isEn = lang === 'en-US';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
      for (const [id, val] of [
        ['btn-pause-resume', t.resumeBtn || (isEn ? 'RESUME' : 'CONTINUAR')], ['btn-pause-map', t.mapBtn || (isEn ? 'MAP' : 'MAPA')],
        ['btn-pause-heroes', t.heroesBtn || (isEn ? 'CHARACTERS' : 'PERSONAGENS')], ['btn-pause-open-settings', t.settingsBtn || (isEn ? 'SETTINGS' : 'CONFIGURAÇÕES')],
        ['btn-pause-save', t.saveNowBtn || (isEn ? 'SAVE GAME' : 'SALVAR JOGO')], ['btn-pause-switch-faction', t.switchFactionBtn || (isEn ? 'CHANGE FACTION' : 'TROCAR FACÇÃO')],
        ['btn-pause-save-quit', t.saveQuitBtn || (isEn ? 'QUIT TO MENU' : 'SAIR PARA O MENU')],
        ['lbl-pause-stat-bricks', t.pauseStats?.goldenBricks || (isEn ? 'GOLDEN BRICKS' : 'BLOCOS DOURADOS')],
        ['lbl-pause-stat-territories', t.pauseStats?.territories || (isEn ? 'TERRITORIES' : 'TERRITÓRIOS')],
        ['lbl-pause-stat-playtime', t.pauseStats?.playTime || (isEn ? 'PLAYED' : 'DE JOGO')]
      ]) { const el = byId(id); if (el && val !== undefined) el.textContent = val; }
      const fb = this.pauseSaveFeedbackEl || byId('pause-save-feedback');
      if (fb && fb.classList?.contains('hidden')) fb.textContent = isEn ? 'GAME SAVED' : 'JOGO SALVO';
      if (this.charactersSubviewEl) this._refreshCharacterStoreUI?.(false);
    },

    _showPauseFeedbackBanner(message, durationMs = 1800) {
      const fb = this.pauseSaveFeedbackEl || byId('pause-save-feedback');
      if (!fb || !message) return;
      if (this._pauseFeedbackTimer) clearTimeout(this._pauseFeedbackTimer);
      fb.textContent = message;
      fb.classList?.remove('hidden');
      this._pauseFeedbackTimer = setTimeout(() => { this._pauseFeedbackTimer = null; fb.classList?.add('hidden'); }, durationMs);
      this._pauseFeedbackTimer?.unref?.();
    },

    openPauseMainView(focusBladeId = null) {
      this.settingsSubviewEl?.classList?.add('hidden');
      this.charactersSubviewEl?.classList?.add('hidden');
      this.pauseMainViewEl?.classList?.remove('hidden');
      this.pauseIngameActionsEl?.classList?.remove('hidden');
      this._updatePauseContextPanel();

      if (!focusBladeId && this.pauseModalEl) {
        if (this._pauseAnimTimer) clearTimeout(this._pauseAnimTimer);
        this.pauseModalEl.classList?.remove('pause-anim-in');
        void this.pauseModalEl.offsetWidth;
        this.pauseModalEl.classList?.add('pause-anim-in');
        this._pauseAnimTimer = setTimeout(() => { this._pauseAnimTimer = null; this.pauseModalEl?.classList?.remove('pause-anim-in'); }, 220);
        this._pauseAnimTimer?.unref?.();
      }
      if (focusBladeId && typeof this.focusMenuElementById === 'function') this.focusMenuElementById(focusBladeId, false);
      else { this._pauseReturnBladeId = null; this.refreshMenuNavigationFocus?.(true); }
    },

    _performSwitchFaction() {
      this.setPauseMenuOpen(false, this._lastController, true);
      document.body?.classList?.add('title-or-loading-active');
      this.titleOverlayEl?.classList?.remove('hidden');
      this._openFactionSelectionPanel?.();
      this.refreshMenuNavigationFocus?.(true);
    },

    _performQuitToTitle(shouldSave = true) {
      if (shouldSave) this.saveCurrentProgress();
      this._lastController?.resetHeldInputs?.();
      this.setTikTokRadioOpen?.(false, this._lastController);
      this.tiktokRadio?.stopAllPlayback?.();
      soundFX.baileFunkMix = 0;
      soundFX.baileBeatPulse = 0;
      soundFX.stopWarMusic();
      this.charactersSubviewEl?.classList?.add('hidden');
      this.setPauseMenuOpen(false, this._lastController, true);
      this.isTitleScreenActive = true;
      document.body?.classList?.remove('is-paused', 'game-paused', 'settings-over-title');
      document.body?.classList?.add('title-or-loading-active');
      this.titleOverlayEl?.classList?.remove('hidden');
      this._setTitleSubPanel?.('main');
      this._refreshTitleContinueAndLoadState?.();
      this.refreshMenuNavigationFocus?.(true);
      if (typeof document !== 'undefined' && document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    },

    _performSaveAndQuitToTitle() { this._performQuitToTitle(true); }
  });
}
