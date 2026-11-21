import { soundFX } from '../../audio/SoundFX.js';
import { getHeroInfo, syncOp09CatalogSlot, drawHeroLegoPortrait } from '../HeroWheelAndDossier.js';
import { createDefaultCustomHeroState, setActiveCustomHero } from '../../entities/CustomHeroSystem.js';
import { createDefaultGarageSaveData, setActiveGarageSaveData } from '../../world/StreetCustomGarage.js';
import { createDefaultAircraftSaveData, setActiveAircraftSaveData, applySavedAircraftConfigsToCarrier } from '../../world/AircraftCustomGarage.js';
import {
  FACTION_DATA, UI_TEXTS, getFactionLogoSvg, loadAllSaveSlots, writeSaveSlot,
  deleteSaveSlot, findMostRecentSaveSlot, formatRelativeSaveDate, computeSlotProgressPct
} from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';
import { installConfirmDialog, playMenuConfirmSound, playMenuBackSound } from './ConfirmDialog.js';

const FACTION_ACRONYMS = { cv: 'CV', pcc: 'PCC', ares: 'A.R.E.S.' };
const byId = (id) => (typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document.getElementById(id) : null);
const setTxt = (id, val) => { const el = byId(id); if (el && val) el.textContent = val; };

function renderSaveSlotCard(s, idx, mode, lang, t) {
  const slotNum = `0${idx + 1}`;
  if (!s) {
    const isLoad = mode === 'load';
    const act = isLoad ? '' : `<div class="slot-actions-row"><button type="button" class="tactical-btn" data-slot-action="start-new" data-slot="${idx}">${t.startSlotBtn}</button></div>`;
    return `<div class="save-slot-card empty-slot-card${isLoad ? ' slot-disabled' : ''}" data-slot-index="${idx}"><span class="slot-ghost-num">${slotNum}</span><span class="slot-empty-title">${t.emptySlot}</span>${act}</div>`;
  }
  const heroKey = s.heroKey || 'caveira';
  const heroDisplayName = heroKey === 'op09' ? (s.customHero?.isCreated ? s.customHero.name : getHeroInfo('op09').name) : getHeroInfo(heroKey).name;
  const fKey = FACTION_DATA[s.faction] ? s.faction : 'cv';
  const fData = FACTION_DATA[fKey];
  const conqCount = Math.min(3, Array.isArray(s.conqueredTerritories) ? new Set([fKey, ...s.conqueredTerritories.filter(Boolean)]).size : 1);
  const actType = mode === 'new' ? 'start-new' : 'load';
  const actLabel = mode === 'new' ? t.overwriteSlotBtn : t.loadSlotBtn;
  return `<div class="save-slot-card" data-faction="${fKey}" data-slot-index="${idx}" style="--slot-accent:${fData.color}">
    <span class="slot-ghost-num">${slotNum}</span>
    <div class="slot-portrait-wrap"><canvas class="slot-portrait-canvas" data-hero-portrait="${heroKey}" width="48" height="48"></canvas></div>
    <div class="slot-crest-wrap">${getFactionLogoSvg(fKey, 38)}</div>
    <div class="slot-identity-col"><div class="faction-card-name" style="color:${fData.color}">${fData.name[lang] || fData.name['pt-BR']}</div><div class="slot-hero-name">${heroDisplayName}</div><div class="slot-relative-time">${formatRelativeSaveDate(s, lang)}</div></div>
    <div class="slot-stats-row"><span class="slot-stat-chip">${t.slotProgressLabel} <b>${computeSlotProgressPct(s)}%</b></span><span class="slot-stat-chip">${t.slotBasesLabel} <b>${conqCount}/3</b></span><span class="slot-stat-chip">${t.slotStudsLabel} <b>${(s.studs || 0).toLocaleString(lang)}</b></span></div>
    <div class="slot-actions-row"><button type="button" class="tactical-btn" data-slot-action="${actType}" data-slot="${idx}">${actLabel}</button><button type="button" class="tactical-btn danger-btn" data-slot-action="delete" data-slot="${idx}">${t.deleteSlotBtn}</button></div>
  </div>`;
}

function renderFactionCard(fKey, lang, t) {
  const f = FACTION_DATA[fKey];
  const acronym = FACTION_ACRONYMS[fKey] || fKey.toUpperCase();
  const fortress = f.fortress[lang] || f.fortress['pt-BR'];
  return `<div class="faction-choice-card" data-faction="${fKey}">
    <div class="faction-pillar-beam" aria-hidden="true"></div>
    <div class="faction-pillar-watermark" aria-hidden="true">${getFactionLogoSvg(fKey, 220)}</div>
    <div class="faction-pillar-top"><div class="faction-pillar-acronym" aria-hidden="true">${acronym}</div><div class="faction-card-code">${fortress}</div></div>
    <div class="faction-pillar-bottom">
      <div class="faction-card-top">${getFactionLogoSvg(fKey, 64)}<div><div class="faction-card-name" style="color:${f.color}">${f.name[lang] || f.name['pt-BR']}</div><div class="faction-card-fortress">${fortress}</div></div></div>
      <div class="faction-pillar-reveal"><div class="faction-card-boss"><span>${t.commanderLabel}:</span> <b>${f.bossName[lang] || f.bossName['pt-BR']}</b></div><p class="faction-card-desc">${f.desc[lang] || f.desc['pt-BR']}</p></div>
      <button type="button" class="tactical-btn faction-select-btn" data-choose-faction="${fKey}">${t.joinFactionBtn}</button>
    </div>
  </div>`;
}

function paintLoadingStormCanvas(hud) {
  if (hud.favelaCanvasEl && !hud._favelaTime && typeof hud._renderFavelaBackgroundCanvas === 'function') hud._renderFavelaBackgroundCanvas(0.016);
  const bgCanvas = hud.loadingBgCanvasEl || byId('loading-bg-canvas');
  const bgCtx = bgCanvas?.getContext?.('2d');
  if (!bgCtx || !bgCanvas) return;
  const w = Math.min(1280, Math.max(320, (typeof window !== 'undefined' && window.innerWidth) || 1280));
  const h = Math.min(720, Math.max(240, (typeof window !== 'undefined' && window.innerHeight) || 720));
  bgCanvas.width = w;
  bgCanvas.height = h;
  bgCtx.fillStyle = '#020306';
  bgCtx.fillRect(0, 0, w, h);
  if (hud.favelaCanvasEl && hud.favelaCanvasEl.width > 0 && hud.favelaCanvasEl.height > 0) {
    try { bgCtx.drawImage(hud.favelaCanvasEl, 0, 0, w, h); } catch (_) { /* headless safe */ }
  }
}

export function installTitleAndSaveSlotsController(LegoHud) {
  if (typeof LegoHud?.prototype?.openConfirmDialog !== 'function') installConfirmDialog(LegoHud);

  definePrototypeMethods(LegoHud, {
    _initTitleAndLoadingDom() {
      this.sessionPlayTimeSec = Number(this.sessionPlayTimeSec || 0);
      const domMap = {
        titleOverlayEl: 'title-screen-overlay', favelaCanvasEl: 'title-favela-bg-canvas', titleMainPanelEl: 'title-main-panel',
        titleSlotsPanelEl: 'title-slots-panel', titleFactionPanelEl: 'title-faction-panel', titleCreditsPanelEl: 'title-credits-panel',
        saveSlotsGridEl: 'save-slots-grid', factionCardsGridEl: 'faction-cards-grid', creditsGridBodyEl: 'credits-grid-body',
        titleQuitToastEl: 'title-quit-toast', btnTitleContinueEl: 'btn-title-continue', btnTitleNewGameEl: 'btn-title-new-game',
        btnTitleLoadGameEl: 'btn-title-load-game', loadingScreenEl: 'tactical-loading-screen', loadingBgCanvasEl: 'loading-bg-canvas',
        loadingWatermarkCrestEl: 'loading-watermark-crest', loadingFactionLogoEl: 'loading-faction-logo', loadingOpTagEl: 'loading-op-tag',
        loadingFactionTitleEl: 'loading-faction-title', loadingStageTextEl: 'loading-stage-text', loadingPctTextEl: 'loading-pct-text',
        loadingLegoBarEl: 'loading-lego-bar', loadingTipBadgeEl: 'loading-tip-badge', loadingTipTextEl: 'loading-tip-text'
      };
      for (const [prop, id] of Object.entries(domMap)) this[prop] = byId(id);
      this._loadingBarSegs = [];
      if (this.loadingLegoBarEl) {
        this.loadingLegoBarEl.innerHTML = '';
        for (let i = 0; i < 20; i++) {
          const seg = document.createElement('div');
          seg.className = 'loading-lego-seg';
          this.loadingLegoBarEl.appendChild(seg);
          this._loadingBarSegs.push(seg);
        }
      }
      this._refreshTitleContinueAndLoadState();
    },

    _syncTitlePanelTexts() {
      const t = UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR'];
      const pairs = [
        ['title-sub-banner', t.subtitle], ['txt-continue-game', t.continueGame], ['txt-new-game', t.newGame],
        ['txt-load-game', t.loadGame], ['txt-options', t.options], ['txt-credits', t.creditsBtn],
        ['txt-quit-game', t.quitGame], ['credits-panel-title', t.creditsTitle], ['btn-credits-back', t.backBtn],
        ['btn-slots-back', t.backBtn], ['btn-faction-back', t.backBtn], ['faction-panel-tag', t.chooseFactionTag],
        ['faction-panel-title', t.chooseFactionTitle], ['faction-panel-sub', t.chooseFactionSub]
      ];
      for (const [id, val] of pairs) setTxt(id, val);
    },

    _refreshTitleContinueAndLoadState() {
      const mostRecent = findMostRecentSaveSlot();
      const hasSave = Boolean(mostRecent && mostRecent.data);
      const continueBtn = this.btnTitleContinueEl || byId('btn-title-continue');
      const newBtn = this.btnTitleNewGameEl || byId('btn-title-new-game');
      const loadBtn = this.btnTitleLoadGameEl || byId('btn-title-load-game');
      if (continueBtn) { continueBtn.classList.toggle('hidden', !hasSave); continueBtn.classList.toggle('primary-btn', hasSave); }
      if (newBtn) newBtn.classList.toggle('primary-btn', !hasSave);
      if (loadBtn) { loadBtn.disabled = !hasSave; loadBtn.classList.toggle('is-disabled', !hasSave); }
      return mostRecent;
    },

    _bindTitleScreenButtons() {
      byId('btn-title-continue')?.addEventListener('click', () => {
        const mostRecent = findMostRecentSaveSlot();
        if (!mostRecent?.data) return;
        playMenuConfirmSound();
        soundFX.startWarMusic();
        this.activeSaveSlot = mostRecent.slotIndex;
        this.startLoadingSequence(mostRecent.data, false);
      });
      byId('btn-title-new-game')?.addEventListener('click', () => { playMenuConfirmSound(); soundFX.startWarMusic(); this._openSaveSlotsPanel('new'); });
      byId('btn-title-load-game')?.addEventListener('click', (e) => {
        const btn = e?.currentTarget || byId('btn-title-load-game');
        if (btn?.disabled || btn?.classList?.contains('is-disabled') || !findMostRecentSaveSlot()?.data) return;
        playMenuConfirmSound();
        soundFX.startWarMusic();
        this._openSaveSlotsPanel('load');
      });
      byId('btn-title-options')?.addEventListener('click', () => {
        playMenuConfirmSound();
        soundFX.startWarMusic();
        if (typeof this.openSettingsFromTitle === 'function') this.openSettingsFromTitle();
        else this.setPauseMenuOpen(true, this._lastController, true);
      });
      byId('btn-title-credits')?.addEventListener('click', () => { playMenuConfirmSound(); soundFX.startWarMusic(); this._openCreditsPanel(); });
      byId('btn-title-quit')?.addEventListener('click', () => {
        playMenuConfirmSound();
        try { window.close?.(); } catch (_) { /* tab close blocked */ }
        const t = UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR'];
        const toastEl = this.titleQuitToastEl || byId('title-quit-toast');
        if (toastEl) {
          toastEl.textContent = t.quitToast;
          toastEl.classList.remove('hidden');
          if (this._quitToastTimer) clearTimeout(this._quitToastTimer);
          this._quitToastTimer = setTimeout(() => { toastEl.classList.add('hidden'); this._quitToastTimer = null; }, 4500);
          this._quitToastTimer?.unref?.();
        }
      });
      byId('btn-slots-back')?.addEventListener('click', () => { playMenuBackSound(); this._setTitleSubPanel('main'); });
      byId('btn-credits-back')?.addEventListener('click', () => { playMenuBackSound(); this._setTitleSubPanel('main'); });
      byId('btn-faction-back')?.addEventListener('click', () => {
        playMenuBackSound();
        if (this.isTitleScreenActive) this._setTitleSubPanel('slots');
        else this._cancelIngameFactionSwitch();
      });
    },

    _setTitleSubPanel(panelName = 'main') {
      this._syncTitlePanelTexts();
      (this.titleQuitToastEl || byId('title-quit-toast'))?.classList.add('hidden');
      if (panelName === 'main') this._refreshTitleContinueAndLoadState();
      this.titleMainPanelEl?.classList.toggle('hidden', panelName !== 'main');
      this.titleSlotsPanelEl?.classList.toggle('hidden', panelName !== 'slots');
      this.titleFactionPanelEl?.classList.toggle('hidden', panelName !== 'faction');
      (this.titleCreditsPanelEl || byId('title-credits-panel'))?.classList.toggle('hidden', panelName !== 'credits');
      this.refreshMenuNavigationFocus?.(true);
    },

    _openCreditsPanel() {
      const t = UI_TEXTS[this.settings?.language || 'pt-BR'] || UI_TEXTS['pt-BR'];
      const gridEl = this.creditsGridBodyEl || byId('credits-grid-body');
      if (gridEl) {
        gridEl.innerHTML = (Array.isArray(t.creditsRows) ? t.creditsRows : [])
          .map(([role, value]) => `<div class="credits-row"><span class="credits-role">${role}</span><span class="credits-value">${value}</span></div>`)
          .join('');
      }
      this._setTitleSubPanel('credits');
      this.refreshMenuNavigationFocus?.(true);
    },

    _cancelIngameFactionSwitch() {
      this.titleOverlayEl?.classList.add('hidden');
      document.body?.classList.remove('title-or-loading-active');
      if (typeof this.openSettingsSubview === 'function') {
        this.setPauseMenuOpen(true, this._lastController);
        this.openSettingsSubview('game');
      } else {
        this.setPauseMenuOpen(true, this._lastController);
      }
      this.refreshMenuNavigationFocus?.(true);
    },

    _openSaveSlotsPanel(mode = 'new') {
      this._slotsMode = mode;
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
      this._setTitleSubPanel('slots');
      setTxt('slots-panel-title', mode === 'new' ? t.selectSlotNew : t.selectSlotLoad);
      if (!this.saveSlotsGridEl) return;

      const slots = loadAllSaveSlots();
      this.saveSlotsGridEl.innerHTML = [0, 1, 2].map((idx) => renderSaveSlotCard(slots[idx], idx, mode, lang, t)).join('');
      const startSlot = (idx) => { this.pendingSlotIndex = idx; this.activeSaveSlot = idx; this._openFactionSelectionPanel(); };

      const triggerSlotAction = (idx, action) => {
        const saved = loadAllSaveSlots()[idx];
        if (action === 'delete') {
          if (!saved) return;
          playMenuConfirmSound();
          return this.openConfirmDialog({
            title: t.confirms.deleteSlot.title, message: t.confirms.deleteSlot.message, danger: true, defaultFocus: 'confirm',
            onConfirm: () => { deleteSaveSlot(idx); this._refreshTitleContinueAndLoadState(); this._openSaveSlotsPanel(mode); }
          });
        }
        if (action === 'load') {
          if (!saved) return;
          playMenuConfirmSound();
          this.activeSaveSlot = idx;
          return this.startLoadingSequence(saved, false);
        }
        playMenuConfirmSound();
        if (saved) {
          return this.openConfirmDialog({
            title: t.confirms.overwriteSlot.title, message: t.confirms.overwriteSlot.message,
            danger: true, defaultFocus: 'confirm', onConfirm: () => startSlot(idx)
          });
        }
        startSlot(idx);
      };

      if (typeof this.saveSlotsGridEl.querySelectorAll === 'function') {
        this.saveSlotsGridEl.querySelectorAll('canvas[data-hero-portrait]').forEach((cvs) => {
          const hKey = cvs?.dataset?.heroPortrait;
          const ctx = hKey ? cvs.getContext?.('2d') : null;
          if (ctx) drawHeroLegoPortrait(ctx, 48, 48, hKey);
        });
        this.saveSlotsGridEl.querySelectorAll('button[data-slot-action]').forEach((btn) => {
          btn.addEventListener('click', (e) => { e?.stopPropagation?.(); triggerSlotAction(Number(btn.dataset.slot || 0), btn.dataset.slotAction); });
        });
        this.saveSlotsGridEl.querySelectorAll('.save-slot-card').forEach((rowEl) => {
          rowEl.addEventListener('click', (e) => {
            if (rowEl.classList?.contains('slot-disabled') || e?.target?.closest?.('button[data-slot-action]')) return;
            const idx = Number(rowEl.dataset?.slotIndex ?? -1);
            if (idx < 0 || (mode === 'load' && !loadAllSaveSlots()[idx])) return;
            triggerSlotAction(idx, mode === 'load' ? 'load' : 'start-new');
          });
        });
      }
      this.refreshMenuNavigationFocus?.(true);
    },

    _openFactionSelectionPanel() {
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
      this._setTitleSubPanel('faction');
      if (!this.factionCardsGridEl) return;
      this.factionCardsGridEl.innerHTML = ['cv', 'pcc', 'ares'].map((fKey) => renderFactionCard(fKey, lang, t)).join('');

      const applyIngameFactionSwitch = (chosenFaction) => {
        this.setPlayerFaction(chosenFaction, true);
        this.saveCurrentProgress();
        this._refreshTitleContinueAndLoadState();
        this.titleOverlayEl?.classList.add('hidden');
        document.body?.classList.remove('title-or-loading-active');
        soundFX.playTrueHeroFanfare();
        this._lastController?.relockPointer?.();
        this.refreshMenuNavigationFocus?.(true);
      };

      const commitFactionChoice = (chosenFaction = 'cv') => {
        this.activeSaveSlot = this.pendingSlotIndex ?? this.activeSaveSlot ?? 0;
        playMenuConfirmSound();
        if (!this.isTitleScreenActive) {
          return this.openConfirmDialog({
            title: t.confirms.switchFaction.title, message: t.confirms.switchFaction.message,
            danger: false, defaultFocus: 'confirm', onConfirm: () => applyIngameFactionSwitch(chosenFaction)
          });
        }
        const defaultCustom = createDefaultCustomHeroState();
        const defaultGarage = createDefaultGarageSaveData();
        const defaultAircraft = createDefaultAircraftSaveData();
        setActiveCustomHero(defaultCustom);
        setActiveGarageSaveData(defaultGarage);
        setActiveAircraftSaveData(defaultAircraft);
        syncOp09CatalogSlot();
        this.tiktokRadio?.importSaveState(null);
        const slotData = writeSaveSlot(this.activeSaveSlot, {
          faction: chosenFaction, studs: 0, heroKey: 'caveira', conqueredTerritories: [], playTimeSec: 0,
          customHero: defaultCustom, customGarage: defaultGarage, aircraftCustom: defaultAircraft,
          radioState: this.tiktokRadio ? this.tiktokRadio.exportSaveState() : null
        });
        this._refreshTitleContinueAndLoadState();
        this.startLoadingSequence(slotData, true);
      };

      if (typeof this.factionCardsGridEl.querySelectorAll === 'function') {
        this.factionCardsGridEl.querySelectorAll('button[data-choose-faction]').forEach((btn) => {
          btn.addEventListener('click', (e) => { e?.stopPropagation?.(); commitFactionChoice(btn.dataset.chooseFaction || 'cv'); });
        });
        this.factionCardsGridEl.querySelectorAll('.faction-choice-card').forEach((card) => {
          card.addEventListener('click', (e) => { if (!e?.target?.closest?.('button[data-choose-faction]')) commitFactionChoice(card.dataset?.faction || 'cv'); });
        });
      }
      this.refreshMenuNavigationFocus?.(true);
    },

    _setLoadingProgressUI(pct, stageText) {
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      if (this.loadingPctTextEl) this.loadingPctTextEl.textContent = `${clamped}%`;
      if (this.loadingStageTextEl && stageText) this.loadingStageTextEl.textContent = stageText;
      if (this._loadingBarSegs?.length) {
        const litCount = Math.round((clamped / 100) * this._loadingBarSegs.length);
        this._loadingBarSegs.forEach((seg, idx) => seg.classList.toggle('lit', idx < litCount));
      }
    },

    startLoadingSequence(slotData, isNewOrSwitch = false) {
      this.sessionPlayTimeSec = Number(slotData?.playTimeSec || 0);
      this.isTitleScreenActive = false;
      this.isLoadingActive = true;
      document.body?.classList.add('title-or-loading-active');

      this._lastController?.resetHeldInputs?.();
      this.setTikTokRadioOpen(false, this._lastController);
      this.tiktokRadio?.stopAllPlayback();
      soundFX.baileFunkMix = 0;
      soundFX.baileBeatPulse = 0;
      soundFX.stopWarMusic();
      this.tiktokRadio?.importSaveState(slotData?.radioState || null);

      this.titleOverlayEl?.classList.add('hidden');
      this.setPauseMenuOpen(false, this._lastController, true);
      this.refreshMenuNavigationFocus?.(true);

      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
      const stages = t.loadingStages || UI_TEXTS['pt-BR'].loadingStages;
      const chosenFaction = FACTION_DATA[slotData?.faction] ? slotData.faction : 'cv';
      const fInfo = FACTION_DATA[chosenFaction];

      if (this.loadingScreenEl) {
        if (this.loadingScreenEl.dataset) this.loadingScreenEl.dataset.faction = chosenFaction;
        this.loadingScreenEl.classList.remove('hidden');
        this.loadingScreenEl.style.opacity = '1';
      }
      const watermarkEl = this.loadingWatermarkCrestEl || byId('loading-watermark-crest');
      if (watermarkEl) watermarkEl.innerHTML = getFactionLogoSvg(chosenFaction, 420);
      if (this.loadingFactionLogoEl) this.loadingFactionLogoEl.innerHTML = getFactionLogoSvg(chosenFaction, 72);
      const opTagEl = this.loadingOpTagEl || byId('loading-op-tag');
      if (opTagEl) opTagEl.textContent = fInfo.fortress[lang] || fInfo.fortress['pt-BR'];
      if (this.loadingFactionTitleEl) {
        this.loadingFactionTitleEl.textContent = fInfo.name[lang] || fInfo.name['pt-BR'];
        this.loadingFactionTitleEl.style.color = fInfo.color;
      }
      const tipBadgeEl = this.loadingTipBadgeEl || byId('loading-tip-badge');
      if (tipBadgeEl) tipBadgeEl.textContent = t.loadingTipBadge;
      if (this.loadingTipTextEl) {
        const tips = Array.isArray(t.loadingTips) && t.loadingTips.length ? t.loadingTips : UI_TEXTS['pt-BR'].loadingTips;
        this.loadingTipTextEl.textContent = tips[Math.floor(Math.random() * tips.length)];
      }
      paintLoadingStormCanvas(this);
      this._setLoadingProgressUI(10, stages.init);

      const nextFrame = (fn) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 0));
      const safeWarmup = (stage, idx = 0) => {
        if (typeof this.onWarmupStep !== 'function') return true;
        try { return this.onWarmupStep(stage, idx) !== false; } catch (err) { console.warn(`[Warmup ${stage}]`, err); return false; }
      };

      const hydrateWorldState = () => {
        try {
          setActiveCustomHero(slotData?.customHero || createDefaultCustomHeroState());
          setActiveGarageSaveData(slotData?.customGarage || createDefaultGarageSaveData());
          setActiveAircraftSaveData(slotData?.aircraftCustom || createDefaultAircraftSaveData());
          applySavedAircraftConfigsToCarrier(this._lastController?.world);
          syncOp09CatalogSlot();
          this.totalStuds = Number(slotData?.studs || 0);
          this.displayedStuds = this.totalStuds;
          if (this.studCountEl) this.studCountEl.textContent = this.totalStuds.toLocaleString(lang);
          const initialHeroKey = slotData?.heroKey || 'caveira';
          this._lastController?.switchToHero?.(initialHeroKey);
          if (initialHeroKey === 'op09') this.syncOp09UI();
          this.setPlayerFaction(chosenFaction, true, Array.isArray(slotData?.conqueredTerritories) ? slotData.conqueredTerritories : []);
          this.onApplyTerritoryMeta?.(slotData?.territoryMeta || null);
          this.goldenBricks = Number(slotData?.goldenBricks || 0);
          this._lastController?.world?.livingCity?.wantedSystem?.clearWanted?.('reset');
          this.setPlayerHealth(250, 250, false);
        } catch (err) { console.warn('[Loading Stage 1]', err); }
      };

      const steps = [
        () => { hydrateWorldState(); safeWarmup('matrices', 0); this._setLoadingProgressUI(28, stages.world); },
        () => { safeWarmup('simulate_entities', 0); this._setLoadingProgressUI(52, stages.light); },
        () => { safeWarmup('compile_shaders', 0); this._setLoadingProgressUI(68, stages.stream); },
        ...[0, 1, 2, 3].map((i) => () => { safeWarmup('render_360', i); this._setLoadingProgressUI(68 + Math.round(((i + 1) / 4) * 28), stages.stream); }),
        () => { safeWarmup('finish', 0); this._setLoadingProgressUI(100, stages.ready); },
        () => {
          this.isLoadingActive = false;
          document.body?.classList.remove('title-or-loading-active');
          this.loadingScreenEl?.classList.add('hidden');
          this.refreshMenuNavigationFocus?.(true);
          soundFX.playTrueHeroFanfare();
          soundFX.startWarMusic();
          this._lastController?.relockPointer?.();
        }
      ];

      nextFrame(() => {
        if (!safeWarmup('init_engine', 0)) {
          this.isLoadingActive = false;
          this.isTitleScreenActive = true;
          this.loadingScreenEl?.classList.add('hidden');
          this.titleOverlayEl?.classList.remove('hidden');
          return this._setTitleSubPanel('main');
        }
        const runStep = (idx) => { steps[idx](); if (idx + 1 < steps.length) nextFrame(() => runStep(idx + 1)); };
        runStep(0);
      });
    }
  });
}
