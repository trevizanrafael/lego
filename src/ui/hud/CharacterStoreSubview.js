import { soundFX } from '../../audio/SoundFX.js';
import { getActiveCustomHero } from '../../entities/CustomHeroSystem.js';
import { formatRoleTitle } from '../../entities/operators/RoleBaselines.js';
import { getOperatorSpec, resolveCombatantSheet, normalizeFactionKey } from '../../entities/operators/OperatorCatalog.js';
import {
  EXTRAS_CATALOG, getCharacterAbilityDescriptors, getPlayableRosterForFaction,
  isCharacterUnlocked, getCharacterPrice, purchaseExtraCharacter
} from '../../progression/RosterAndUnlocks.js';
import { FACTION_DATA, UI_TEXTS, getFactionLogoSvg } from '../FactionIconsAndSaveSystem.js';
import { getHeroInfo, syncOp09CatalogSlot, drawHeroLegoPortrait } from '../HeroWheelAndDossier.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';
import { ABILITY_SVG_ICONS } from './AbilityCooldownHud.js';
import { playMenuMoveSound, playMenuConfirmSound, playMenuBackSound } from './ConfirmDialog.js';

export const CHARACTER_STORE_TABS = Object.freeze(['all', 'faction', 'rivals', 'extras', 'bosses']);
const ICON_ALIAS_MAP = {
  grenade: 'c4', sunburst: 'solar', wings: 'flare', rocket_fist: 'charge', skull: 'weapons',
  arsenal: 'weapons', smoke: 'eye_off', hook: 'katana', light_wall: 'bike', chain: 'bike',
  emp: 'pulse', tendrils: 'tentacle', claw: 'tentacle', jet: 'charge'
};
const EXTRA_WEAPON_NAMES = {
  caveira: ['Fuzil Tático Parafal', 'Tactical Assault Rifle'], solaris: ['Orbes & Feixe Solar', 'Solar Orbs & Plasma Beam'],
  tita: ['Minigun Rotativa & Punhos', 'Rotary Minigun & Fists'], vingador: ['SMGs Duplas / Escopeta / RPG', 'Dual SMGs / Shotgun / RPG'],
  sombra: ['Katanas Gêmeas & Shurikens', 'Twin Katanas & Shurikens'], turbo: ['Correntes de Plasma Ciano', 'Cyan Plasma Chains'],
  voltaico: ['Arcos de Alta Tensão', 'High-Voltage Lightning'], vortex: ['Tentáculos Abissais Simbiontes', 'Abyssal Symbiote Tendrils'],
  op09: ['Módulo Bio-Genético Custom', 'Custom Bio-Genetic Module'], boss_cv: ['Lança-Foguetes Rubro Pesado', 'Heavy Crimson Launcher'],
  boss_pcc: ['Fuzil Perfurante Blindado', 'Armored AP Rifle'], boss_ares: ['Canhão de Plasma Overlord', 'Overlord Plasma Cannon']
};

const LOCK_SVG = '<svg class="char-lock-svg" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="7" width="10" height="7"/><path d="M5,7 V4.8 C5,3.1 6.3,2 8,2 C9.7,2 11,3.1 11,4.8 V7"/></svg>';
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

function clearNode(el) {
  if (!el) return;
  if (typeof Element !== 'undefined' && el instanceof Element && typeof el.replaceChildren === 'function') el.replaceChildren();
  else { el.innerHTML = ''; if (Array.isArray(el.children)) el.children.length = 0; }
}

function resolveDisplayNames(charKey, lang = 'pt-BR') {
  const loc = lang === 'en-US' ? 'en-US' : 'pt-BR';
  const op = getOperatorSpec(charKey);
  if (op) return { shortName: op.displayName?.[loc] || op.name, fullName: op.displayName?.[loc] || op.name, subtitle: op.codename?.[loc] || '' };
  if (charKey === 'op09') {
    syncOp09CatalogSlot();
    const cfg = getActiveCustomHero(), info = getHeroInfo('op09');
    const customName = cfg?.isCreated && cfg?.name ? String(cfg.name).toUpperCase() : 'OP-09';
    return { shortName: customName, fullName: cfg?.isCreated ? customName : (EXTRAS_CATALOG.op09?.name?.[loc] || 'OP-09').toUpperCase(), subtitle: info?.cleanRole?.[loc] || 'OP-09' };
  }
  const extra = EXTRAS_CATALOG[charKey], info = getHeroInfo(charKey);
  const baseName = String(extra?.name?.[loc] || info?.cleanName || info?.name || charKey).toUpperCase();
  const sub = extra?.category === 'secret_boss' ? `${loc === 'en-US' ? 'TERRITORY BOSS' : 'CHEFE DE TERRITÓRIO'} · ${(extra.bossFaction || '').toUpperCase()}` : (info?.cleanRole?.[loc] || '');
  return { shortName: info?.shortName && extra?.category !== 'secret_boss' ? info.shortName : baseName, fullName: baseName, subtitle: sub };
}

function paintPortrait(canvas, w, h, charKey, isBossSilhouette) {
  if (!canvas) return;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  drawHeroLegoPortrait(ctx, w, h, charKey, { silhouette: Boolean(isBossSilhouette) });
}

function buildStoreEntries(playerFaction, unlockedExtras) {
  const roster = getPlayableRosterForFaction(normalizeFactionKey(playerFaction), unlockedExtras);
  const nativeEntries = roster.primaryPair.map((op) => ({
    key: op.key, tabGroup: 'faction', category: 'faction_native', originFaction: op.faction,
    unlockMethod: 'free', unlocked: true, effectivePrice: 0, roles: [...op.roles], isBigFig: false
  }));
  const extraEntries = roster.extras.map((ex) => ({
    key: ex.key, tabGroup: ex.category === 'rival_operator' ? 'rivals' : ex.category === 'secret_boss' ? 'bosses' : 'extras',
    category: ex.category, originFaction: ex.originFaction || ex.bossFaction || null,
    unlockMethod: ex.unlockMethod, unlocked: ex.unlocked, effectivePrice: ex.effectivePrice, roles: [...ex.roles], isBigFig: Boolean(ex.isBigFig)
  }));
  const all = [...nativeEntries, ...extraEntries.filter((e) => e.tabGroup === 'rivals'), ...extraEntries.filter((e) => e.tabGroup === 'extras'), ...extraEntries.filter((e) => e.tabGroup === 'bosses')];
  return { all, unlockedCount: roster.unlockedSet.size, totalCount: all.length };
}

export function installCharacterStoreSubview(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _ensureCharacterStoreDom() {
      this._activeCharStoreTab = CHARACTER_STORE_TABS.includes(this._activeCharStoreTab) ? this._activeCharStoreTab : 'all';
      if (typeof document === 'undefined') return null;
      const subview = mkEl('div', 'characters-subview', ['characters-subview', 'characters-screen']);
      if (!subview) return null;
      const hasStructure = Boolean((Array.isArray(subview.children) && subview.children.length > 0) ||
        (typeof Element !== 'undefined' && subview instanceof Element && subview.querySelector?.('.char-store-workspace')));

      if (!hasStructure && typeof document.createElement === 'function') {
        subview.classList?.add('hidden');
        const headerBar = mkEl('div', '', ['char-store-header-bar'], {}, [
          mkEl('div', '', ['char-store-header-left'], {}, [mkEl('h2', 'characters-title', ['characters-title'], { text: 'PERSONAGENS' }), mkEl('span', 'char-store-unlocked-count', ['char-store-unlocked-count'], { text: '2 / 18 LIBERADOS' }), mkEl('span', 'char-store-feedback', ['char-store-feedback', 'hidden'])]),
          mkEl('div', '', ['char-store-header-right'], {}, [mkEl('div', '', ['char-store-studs-box'], {}, [mkEl('span', '', ['pause-stud-icon', 'char-store-stud-icon']), mkEl('span', 'char-store-studs', ['char-store-studs'], { text: '0' })]), mkEl('button', 'characters-back-btn', ['tactical-btn'], { type: 'button', text: 'VOLTAR' })])
        ]);
        const tabsBar = mkEl('div', 'char-store-tabs-bar', ['char-store-tabs-bar'], {}, [
          mkEl('span', '', ['tab-key-badge'], { text: 'Q' }),
          ...CHARACTER_STORE_TABS.map((tab) => mkEl('button', `char-tab-${tab}`, ['char-store-tab-btn'], { type: 'button', dataset: { charTab: tab } })),
          mkEl('span', '', ['tab-key-badge'], { text: 'E' })
        ]);
        const showcaseTop = mkEl('div', '', ['char-showcase-top'], {}, [
          mkEl('div', 'char-showcase-portrait-wrap', ['char-showcase-portrait-wrap'], {}, [mkEl('canvas', 'char-showcase-canvas', ['char-showcase-canvas']), mkEl('span', 'char-showcase-status-pill', ['char-showcase-status-pill'])]),
          mkEl('div', '', ['char-showcase-meta-col'], {}, [mkEl('div', 'char-showcase-origin', ['char-showcase-origin']), mkEl('h3', 'char-showcase-name', ['char-showcase-name']), mkEl('div', 'char-showcase-role', ['char-showcase-role']), mkEl('div', 'char-showcase-stats', ['char-showcase-stats'])])
        ]);
        const showcaseEl = mkEl('aside', 'char-store-showcase', ['char-store-showcase'], {}, [showcaseTop, mkEl('div', 'char-showcase-allegiance', ['char-showcase-allegiance', 'hidden']), mkEl('div', 'char-showcase-loadout', ['char-showcase-loadout']), mkEl('button', 'btn-char-store-action', ['tactical-btn', 'char-store-action-btn'], { type: 'button', text: 'EQUIPAR' })]);
        const workspace = mkEl('div', '', ['char-store-workspace'], {}, [mkEl('div', 'char-store-grid-wrap', ['char-store-grid-wrap'], {}, [mkEl('div', 'char-store-grid', ['char-store-grid'])]), showcaseEl]);
        const footerRow = mkEl('div', 'characters-footer-row', ['characters-footer-row'], {}, [mkEl('div', 'characters-keyhints-row', ['characters-keyhints-row'])]);
        for (const blk of [headerBar, tabsBar, workspace, footerRow]) if (blk) subview.appendChild?.(blk);
      }

      const modal = this.pauseModalEl || byId('pause-options-modal');
      if (modal && !subview.parentNode && !(Array.isArray(modal.children) && modal.children.includes(subview))) modal.appendChild?.(subview);
      this.charactersSubviewEl = subview;
      for (const [prop, id] of [
        ['charStoreTitleEl', 'characters-title'], ['charStoreUnlockedEl', 'char-store-unlocked-count'], ['charStoreFeedbackEl', 'char-store-feedback'],
        ['charStoreStudsEl', 'char-store-studs'], ['charStoreBackBtnEl', 'characters-back-btn'], ['charStoreTabsBarEl', 'char-store-tabs-bar'],
        ['charStoreGridEl', 'char-store-grid'], ['charShowcaseEl', 'char-store-showcase'], ['charShowcasePortraitWrapEl', 'char-showcase-portrait-wrap'],
        ['charShowcaseCanvasEl', 'char-showcase-canvas'], ['charShowcaseStatusEl', 'char-showcase-status-pill'], ['charShowcaseOriginEl', 'char-showcase-origin'],
        ['charShowcaseNameEl', 'char-showcase-name'], ['charShowcaseRoleEl', 'char-showcase-role'], ['charShowcaseStatsEl', 'char-showcase-stats'],
        ['charShowcaseAllegianceEl', 'char-showcase-allegiance'], ['charShowcaseLoadoutEl', 'char-showcase-loadout'],
        ['btnCharStoreActionEl', 'btn-char-store-action'], ['charStoreKeyhintsEl', 'characters-keyhints-row']
      ]) this[prop] = byId(id);
      this.charStoreTabBtns = CHARACTER_STORE_TABS.map((t) => byId(`char-tab-${t}`)).filter(Boolean);
      this._bindCharacterStoreEvents();
      return subview;
    },

    _bindCharacterStoreEvents() {
      if (this._charStoreEventsBound) return;
      this._charStoreEventsBound = true;
      this.charStoreBackBtnEl?.addEventListener?.('click', () => { playMenuBackSound(); this.openPauseMainView?.(this._pauseReturnBladeId || 'btn-pause-heroes'); });
      for (const btn of this.charStoreTabBtns || []) {
        btn.addEventListener?.('click', () => {
          const tab = btn.dataset?.charTab || 'all';
          if (tab !== this._activeCharStoreTab) playMenuMoveSound();
          this.setActiveCharacterStoreTab(tab, true);
        });
      }
      this.btnCharStoreActionEl?.addEventListener?.('click', () => this.triggerCharacterStorePrimaryAction());
    },

    openCharacterStoreSubview(initialCharKey = null) {
      this._ensureCharacterStoreDom();
      this._pauseReturnBladeId = this._pauseReturnBladeId || 'btn-pause-heroes';
      this.settingsSubviewEl?.classList?.add('hidden');
      this.pauseMainViewEl?.classList?.add('hidden');
      this.pauseIngameActionsEl?.classList?.add('hidden');
      this.charactersSubviewEl?.classList?.remove('hidden');
      this._selectedCharStoreKey = initialCharKey || this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'cv_marretao';
      this._activeCharStoreTab = 'all';
      this._applyPauseFactionTheme?.();
      this._refreshCharacterStoreUI(true);
    },

    setActiveCharacterStoreTab(tabId = 'all', refreshNav = true) {
      const next = CHARACTER_STORE_TABS.includes(tabId) ? tabId : 'all';
      this._activeCharStoreTab = next;
      const { all } = buildStoreEntries(this.playerFaction, this.unlockedExtras);
      const filtered = next === 'all' ? all : all.filter((e) => e.tabGroup === next);
      if (filtered.length && !filtered.some((e) => e.key === this._selectedCharStoreKey)) this._selectedCharStoreKey = filtered[0].key;
      this._refreshCharacterStoreUI(refreshNav);
    },

    stepCharacterStoreCategory(dir = 1) { playMenuMoveSound(); this.setActiveCharacterStoreTab(cycle(CHARACTER_STORE_TABS, this._activeCharStoreTab || 'all', dir), true); },

    _syncCharacterStoreHoverFocus(charKey) {
      if (!charKey || charKey === this._selectedCharStoreKey) return;
      this._selectedCharStoreKey = charKey;
      for (const card of this._charStoreCardEls || []) card?.classList?.toggle('is-selected', card.dataset?.charKey === charKey);
      this._renderCharacterStoreShowcase(charKey);
    },

    selectCharacterStoreCard(charKey, withSound = false) {
      if (!charKey) return;
      const items = this._getNavigableItems?.('pause-characters') || this._charStoreCardEls || [];
      const idx = items.findIndex((el) => el?.dataset?.charKey === charKey);
      this._selectedCharStoreKey = charKey;
      for (const card of this._charStoreCardEls || []) card?.classList?.toggle('is-selected', card.dataset?.charKey === charKey);
      this._renderCharacterStoreShowcase(charKey);
      if (idx !== -1 && typeof this._applyNavFocusToItems === 'function') this._applyNavFocusToItems(items, idx, withSound, true);
      else if (withSound) playMenuMoveSound();
    },

    stepCharacterStoreFocus(dx = 0, dy = 0) {
      const items = this._getNavigableItems?.('pause-characters') || this._charStoreCardEls || [];
      const n = items.length;
      if (!n) return;
      let curIdx = items.findIndex((el) => el?.dataset?.charKey === this._selectedCharStoreKey);
      if (curIdx === -1) curIdx = Math.max(0, Math.min(n - 1, this._menuFocusIndex || 0));
      let cols = 3;
      if (n >= 2 && typeof items[0]?.getBoundingClientRect === 'function') {
        const top0 = items[0].getBoundingClientRect().top;
        let rowCount = 0;
        for (const it of items) { if (Math.abs(it.getBoundingClientRect().top - top0) < 8) rowCount++; else break; }
        if (rowCount >= 1) cols = rowCount;
      }
      let nextIdx = curIdx;
      if (dx !== 0) nextIdx = (curIdx + dx + n) % n;
      else if (dy !== 0) {
        const cand = curIdx + dy * cols;
        if (cand >= 0 && cand < n) nextIdx = cand;
        else if (dy > 0) nextIdx = Math.floor(curIdx / cols) < Math.floor((n - 1) / cols) ? n - 1 : curIdx % cols;
        else nextIdx = Math.min(n - 1, Math.floor((n - 1) / cols) * cols + (curIdx % cols));
      }
      if (items[nextIdx]?.dataset?.charKey) this.selectCharacterStoreCard(items[nextIdx].dataset.charKey, true);
    },

    _showCharacterStoreFeedback(message, durationMs = 2200) {
      const el = this.charStoreFeedbackEl || byId('char-store-feedback');
      if (el && message) {
        if (this._charStoreFeedbackTimer) clearTimeout(this._charStoreFeedbackTimer);
        el.textContent = message;
        el.classList?.remove('hidden');
        this._charStoreFeedbackTimer = setTimeout(() => { this._charStoreFeedbackTimer = null; el.classList?.add('hidden'); }, durationMs);
        this._charStoreFeedbackTimer?.unref?.();
      }
      this._showPauseFeedbackBanner?.(message, durationMs);
    },

    _syncAllStudCounters() {
      const loc = (this.settings?.language || 'pt-BR') === 'en-US' ? 'en-US' : 'pt-BR';
      const formatted = Math.max(0, Math.floor(Number(this.totalStuds) || 0)).toLocaleString(loc);
      for (const el of [this.studCountEl || byId('hud-stud-count'), this.pauseTopStudsEl || byId('pause-top-studs'), this.charStoreStudsEl || byId('char-store-studs')]) {
        if (el) el.textContent = formatted;
      }
    },

    _equipCharacterFromStore(charKey) {
      if (!isCharacterUnlocked(charKey, this.playerFaction, this.unlockedExtras)) return false;
      const lang = this.settings?.language || 'pt-BR', cs = (UI_TEXTS[lang] || UI_TEXTS['pt-BR']).characterStore || {};
      const names = resolveDisplayNames(charKey, lang);
      this.currentHeroKey = charKey;
      this._lastController?.switchToHero?.(charKey, true);
      if (this._lastController?.minifigure) this._lastController.minifigure.currentHeroKey = charKey;
      this.setCharacterPortrait?.(charKey, names.fullName);
      const lc = this._lastController?.world?.livingCity;
      if (lc?.syncPlayerCharacterStats) lc.syncPlayerCharacterStats(charKey, this.playerFaction, false);
      else { const sheet = resolveCombatantSheet(charKey, this.playerFaction); this.setPlayerHealth?.(sheet.hp, sheet.hp, false); }
      this.saveCurrentProgress?.();
      this._updatePauseHeroCard?.();
      this._updatePauseTopAndFooter?.();
      this._refreshCharacterStoreUI(false);
      playMenuConfirmSound();
      this._showCharacterStoreFeedback((cs.equippedFeedback || '{name} EM CAMPO').replace('{name}', names.fullName));
      return true;
    },

    _confirmCharacterStorePurchase(charKey) {
      const res = purchaseExtraCharacter({ charKey, playerFaction: this.playerFaction, currentStuds: this.totalStuds, unlockedExtras: this.unlockedExtras });
      if (!res.ok) return res;
      const lang = this.settings?.language || 'pt-BR', cs = (UI_TEXTS[lang] || UI_TEXTS['pt-BR']).characterStore || {};
      const names = resolveDisplayNames(charKey, lang);
      this.totalStuds = res.remainingStuds;
      this.displayedStuds = res.remainingStuds;
      this.unlockedExtras = res.unlockedExtras;
      this._selectedCharStoreKey = charKey;
      this._syncAllStudCounters();
      this.saveCurrentProgress?.();
      soundFX.playTrueHeroFanfare?.();
      this._refreshCharacterStoreUI(false);
      this._showCharacterStoreFeedback((cs.unlockedFeedback || '{name} DESBLOQUEADO!').replace('{name}', names.fullName), 2600);
      return res;
    },

    triggerCharacterStorePrimaryAction() {
      const btn = this.btnCharStoreActionEl || byId('btn-char-store-action'), charKey = this._selectedCharStoreKey;
      if (!charKey || !btn || btn.disabled || btn.classList?.contains('is-disabled')) return false;
      const state = btn.dataset?.actionState;
      if (state === 'equip') return this._equipCharacterFromStore(charKey);
      if (state === 'buy') {
        const lang = this.settings?.language || 'pt-BR', loc = lang === 'en-US' ? 'en-US' : 'pt-BR';
        const cs = (UI_TEXTS[lang] || UI_TEXTS['pt-BR']).characterStore || {};
        const price = getCharacterPrice(charKey, this.playerFaction), names = resolveDisplayNames(charKey, lang);
        const msg = (cs.confirmMsg || 'Comprar {name} por {price} studs?').replace('{name}', names.fullName).replace('{price}', price.toLocaleString(loc));
        playMenuConfirmSound();
        if (typeof this.openConfirmDialog === 'function') {
          this.openConfirmDialog({
            title: cs.confirmTitle || (loc === 'en-US' ? 'BUY CHARACTER' : 'COMPRAR PERSONAGEM'),
            message: msg, confirmLabel: cs.buyBtn || (loc === 'en-US' ? 'BUY' : 'COMPRAR'),
            danger: false, defaultFocus: 'confirm', onConfirm: () => this._confirmCharacterStorePurchase(charKey)
          });
        } else this._confirmCharacterStorePurchase(charKey);
        return true;
      }
      return false;
    },

    _refreshCharacterStoreUI(refreshNav = false) {
      this._ensureCharacterStoreDom();
      if (!this.charactersSubviewEl) return;
      const lang = this.settings?.language || 'pt-BR', loc = lang === 'en-US' ? 'en-US' : 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'], cs = t.characterStore || UI_TEXTS['pt-BR'].characterStore;
      const activeHeroKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'cv_marretao';
      const studs = Math.max(0, Math.floor(Number(this.totalStuds) || 0));
      const { all, unlockedCount, totalCount } = buildStoreEntries(this.playerFaction, this.unlockedExtras);
      if (!all.some((e) => e.key === this._selectedCharStoreKey)) this._selectedCharStoreKey = all.some((e) => e.key === activeHeroKey) ? activeHeroKey : all[0]?.key;

      if (this.charStoreTitleEl) this.charStoreTitleEl.textContent = cs.title;
      if (this.charStoreBackBtnEl) this.charStoreBackBtnEl.textContent = t.backBtn || (loc === 'en-US' ? 'BACK' : 'VOLTAR');
      if (this.charStoreUnlockedEl) this.charStoreUnlockedEl.textContent = cs.unlockedCounter.replace('{unlocked}', String(unlockedCount)).replace('{total}', String(totalCount));
      this._syncAllStudCounters();

      for (const btn of this.charStoreTabBtns || []) {
        const tabKey = btn.dataset?.charTab || 'all', active = tabKey === this._activeCharStoreTab;
        btn.textContent = cs.tabs?.[tabKey] || tabKey.toUpperCase();
        btn.classList?.toggle('active', active);
        btn.setAttribute?.('aria-selected', active ? 'true' : 'false');
      }

      const filtered = this._activeCharStoreTab === 'all' ? all : all.filter((e) => e.tabGroup === this._activeCharStoreTab);
      if (filtered.length && !filtered.some((e) => e.key === this._selectedCharStoreKey)) this._selectedCharStoreKey = filtered[0].key;

      clearNode(this.charStoreGridEl);
      this._charStoreCardEls = [];
      const tilePx = Math.round(88 * Math.min(2, (typeof window !== 'undefined' && Number(window.devicePixelRatio)) || 1));
      for (const entry of filtered) {
        const names = resolveDisplayNames(entry.key, lang), isCurrent = entry.key === activeHeroKey;
        const isBossLocked = entry.unlockMethod === 'defeat_boss' && !entry.unlocked;
        const cardCls = ['char-store-card', entry.unlocked ? 'is-unlocked' : 'is-locked'];
        if (isCurrent) cardCls.push('is-active-char');
        if (isBossLocked) cardCls.push('is-locked-boss');
        if (entry.unlockMethod === 'studs' && !entry.unlocked && studs >= entry.effectivePrice) cardCls.push('is-affordable');
        if (entry.key === this._selectedCharStoreKey) cardCls.push('is-selected');
        const badgeEl = mkEl('span', '', ['char-card-badge']);
        if (isCurrent) { badgeEl.classList?.add('badge-active'); badgeEl.textContent = cs.activeBtn; }
        else if (entry.unlocked) { badgeEl.classList?.add('badge-unlocked'); badgeEl.textContent = cs.unlockedBadge; }
        else if (isBossLocked) { badgeEl.classList?.add('badge-boss'); badgeEl.innerHTML = `${LOCK_SVG}<span>${cs.bossBadge}</span>`; }
        else { badgeEl.classList?.add('badge-price'); badgeEl.innerHTML = `${LOCK_SVG}<span class="char-mini-stud"></span><span>${entry.effectivePrice.toLocaleString(loc)}</span>`; }
        const cvs = mkEl('canvas', '', ['char-card-canvas']);
        paintPortrait(cvs, tilePx, tilePx, entry.key, isBossLocked);
        const cardBtn = mkEl('button', '', cardCls, { type: 'button', dataset: { charKey: entry.key } }, [
          mkEl('div', '', ['char-card-portrait'], {}, [cvs, badgeEl]),
          mkEl('div', '', ['char-card-nameplate'], {}, [mkEl('span', '', ['char-card-name'], { text: names.shortName }), mkEl('span', '', ['char-card-role'], { text: formatRoleTitle(entry.roles, lang).toUpperCase() })])
        ]);
        cardBtn?.addEventListener?.('click', () => this.selectCharacterStoreCard(entry.key, this._selectedCharStoreKey !== entry.key));
        cardBtn?.addEventListener?.('dblclick', () => { this.selectCharacterStoreCard(entry.key, false); this.triggerCharacterStorePrimaryAction(); });
        if (cardBtn) { this.charStoreGridEl?.appendChild?.(cardBtn); this._charStoreCardEls.push(cardBtn); }
      }

      this._renderCharacterStoreShowcase(this._selectedCharStoreKey);
      if (this.charStoreKeyhintsEl) {
        const hints = t.keyHints?.characters || [['Q/E', 'Filtro'], ['↑↓←→', 'Navegar'], ['ENTER', 'Comprar / Equipar'], ['ESC', 'Voltar']];
        this.charStoreKeyhintsEl.innerHTML = hints.map(([k, txt]) => `<span class="keyhint-item"><kbd class="keyhint-kbd">${k}</kbd><span class="keyhint-label">${txt}</span></span>`).join('');
      }
      if (refreshNav) this.refreshMenuNavigationFocus?.(false);
    },

    _renderCharacterStoreShowcase(charKey) {
      if (!charKey) return;
      const lang = this.settings?.language || 'pt-BR', loc = lang === 'en-US' ? 'en-US' : 'pt-BR';
      const cs = (UI_TEXTS[lang] || UI_TEXTS['pt-BR']).characterStore || UI_TEXTS['pt-BR'].characterStore;
      const activeHeroKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'cv_marretao';
      const playerFaction = normalizeFactionKey(this.playerFaction);
      const sheet = resolveCombatantSheet(charKey, playerFaction), extraSpec = EXTRAS_CATALOG[charKey];
      const unlocked = isCharacterUnlocked(charKey, playerFaction, this.unlockedExtras);
      const price = getCharacterPrice(charKey, playerFaction), studs = Math.max(0, Math.floor(Number(this.totalStuds) || 0));
      const unlockMethod = sheet.isFactionOperator && !sheet.isDeserter ? 'free' : (extraSpec?.unlockMethod || 'studs');
      const isBossLocked = unlockMethod === 'defeat_boss' && !unlocked;
      const names = resolveDisplayNames(charKey, lang);
      const dpr = Math.min(2, (typeof window !== 'undefined' && Number(window.devicePixelRatio)) || 1);

      paintPortrait(this.charShowcaseCanvasEl, Math.round(280 * dpr), Math.round(340 * dpr), charKey, isBossLocked);
      this.charShowcasePortraitWrapEl?.classList?.toggle('is-silhouette', isBossLocked);
      if (this.charShowcaseStatusEl) {
        this.charShowcaseStatusEl.textContent = charKey === activeHeroKey ? cs.activeBtn
          : unlocked ? cs.unlockedBadge : unlockMethod === 'defeat_boss' ? cs.bossBadge : `${price.toLocaleString(loc)} STUDS`;
      }
      const originLabel = sheet.originFaction ? (FACTION_DATA[sheet.originFaction]?.name?.[lang] || sheet.originFaction.toUpperCase())
        : charKey === 'op09' ? (loc === 'en-US' ? 'HERO TOWER LAB' : 'LABORATÓRIO DA TORRE') : (loc === 'en-US' ? 'CLASSIC EXTRA HERO' : 'HERÓI CLÁSSICO EXTRA');
      if (this.charShowcaseOriginEl) this.charShowcaseOriginEl.textContent = `${originLabel}${sheet.isBigFig ? ' · BIG-FIG' : ''}`;
      if (this.charShowcaseNameEl) this.charShowcaseNameEl.textContent = names.fullName;
      if (this.charShowcaseRoleEl) {
        const roleTxt = formatRoleTitle(sheet.roles, lang).toUpperCase();
        this.charShowcaseRoleEl.textContent = names.subtitle ? `${roleTxt} // ${names.subtitle.toUpperCase()}` : roleTxt;
      }
      if (this.charShowcaseAllegianceEl) {
        let html = '', kind = '';
        if (sheet.isFactionOperator && sheet.isDeserter) { kind = 'deserter'; html = `<span class="allegiance-crest">${getFactionLogoSvg(playerFaction, 20)}</span><span>${cs.deserterBanner}</span>`; }
        else if (sheet.isFactionOperator) { kind = 'native'; html = `<span class="allegiance-crest">${getFactionLogoSvg(playerFaction, 20)}</span><span>${cs.factoryUnlockedTag}</span>`; }
        else if (isBossLocked) { kind = 'boss'; html = `${LOCK_SVG}<span>${cs.bossUnlockHint}</span>`; }
        else if (charKey === 'op09' && unlocked) { kind = 'lab'; html = `<span>${cs.op09LabHint}</span>`; }
        this.charShowcaseAllegianceEl.className = html ? `char-showcase-allegiance is-${kind}` : 'char-showcase-allegiance hidden';
        this.charShowcaseAllegianceEl.innerHTML = html;
      }
      if (this.charShowcaseStatsEl) {
        const dmg = Math.round(sheet.damageMultiplier * 100), spd = Math.round(sheet.speedMultiplier * 100), mit = Math.round(sheet.damageReduction * 100);
        const rows = [[cs.stats.hp, `${sheet.hp}`, Math.min(100, Math.round((sheet.hp / 540) * 100))], [cs.stats.damage, `${dmg}%`, Math.min(100, Math.round((dmg / 125) * 100))],
          [cs.stats.speed, `${spd}%`, Math.min(100, Math.round((spd / 115) * 100))], [cs.stats.mitigation, `${mit}%`, Math.min(100, Math.round((mit / 38) * 100))]];
        this.charShowcaseStatsEl.innerHTML = rows.map(([l, v, p]) => `<div class="char-stat-item"><div class="char-stat-head"><span>${l}</span><b>${v}</b></div><div class="char-stat-track"><div class="char-stat-fill" style="width:${p}%"></div></div></div>`).join('');
      }
      if (this.charShowcaseLoadoutEl) {
        const wpnName = sheet.weapon ? `${sheet.weapon.name?.[lang] || sheet.weapon.key} · ${sheet.weapon.magSize}/${sheet.weapon.reserveMax}` : (EXTRA_WEAPON_NAMES[charKey]?.[loc === 'en-US' ? 1 : 0] || 'Arsenal Especial');
        const abilities = getCharacterAbilityDescriptors(charKey);
        const renderAb = (k, ab) => ab ? `<div class="char-ability-row"><span class="char-ability-icon">${ABILITY_SVG_ICONS[ICON_ALIAS_MAP[ab.icon] || ab.icon] || ABILITY_SVG_ICONS.star}</span><div class="char-ability-copy"><div class="char-ability-head"><kbd>${k.toUpperCase()}</kbd><b>${ab.name?.[loc] || ab.name?.['pt-BR']}</b><span>${ab.cooldownSec}s</span></div><p>${ab.desc?.[loc] || ab.desc?.['pt-BR'] || ''}</p></div></div>` : '';
        this.charShowcaseLoadoutEl.innerHTML = `<div class="char-weapon-strip"><span class="char-loadout-lbl">${cs.weaponLabel}</span><b>${wpnName}</b></div>` + (abilities ? `<div class="char-abilities-list">${renderAb('q', abilities.q)}${renderAb('e', abilities.e)}</div>` : '');
      }
      const btn = this.btnCharStoreActionEl;
      if (btn) {
        btn.classList?.remove('is-in-field', 'is-equip', 'is-buy', 'is-insufficient', 'is-boss-locked', 'is-disabled');
        const setBtn = (dis, cls, st, txt) => { btn.disabled = dis; btn.classList?.add(...cls); if (btn.dataset) btn.dataset.actionState = st; btn.textContent = txt; };
        if (unlocked && charKey === activeHeroKey) setBtn(true, ['is-in-field', 'is-disabled'], 'active', cs.activeBtn);
        else if (unlocked) setBtn(false, ['is-equip'], 'equip', cs.equipBtn);
        else if (unlockMethod === 'studs' && studs >= price) setBtn(false, ['is-buy'], 'buy', cs.buyForStudsBtn.replace('{price}', price.toLocaleString(loc)));
        else if (unlockMethod === 'studs') setBtn(true, ['is-insufficient', 'is-disabled'], 'insufficient', cs.missingStudsBtn.replace('{n}', Math.max(1, price - studs).toLocaleString(loc)));
        else setBtn(true, ['is-boss-locked', 'is-disabled'], 'boss_locked', cs.bossLockedBtn);
      }
    }
  });
}
