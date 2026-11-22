import { soundFX } from '../../audio/SoundFX.js';
import { definePrototypeMethods } from '../hud/HudConstantsAndPortraits.js';
import { playMenuMoveSound, playMenuConfirmSound, playMenuBackSound } from '../hud/ConfirmDialog.js';
import { FACTION_DATA, getFactionLogoSvg } from '../FactionIconsAndSaveSystem.js';
import { drawHeroLegoPortrait, getHeroInfo, syncOp09CatalogSlot } from '../HeroWheelAndDossier.js';
import { getOperatorSpec, normalizeFactionKey } from '../../entities/operators/OperatorCatalog.js';
import { formatRoleTitle } from '../../entities/operators/RoleBaselines.js';
import { OPERATOR_WEAPONS } from '../../entities/operators/WeaponCatalog.js';
import {
  EXTRAS_CATALOG, getPlayableRosterForFaction, getCharacterAbilityDescriptors, isCharacterUnlocked
} from '../../progression/RosterAndUnlocks.js';

const ANGULAR_PADLOCK_SVG = `<svg viewBox="0 0 28 28" width="22" height="22" class="char-grid-lock-svg" aria-hidden="true"><polygon points="9,12 9,7 12,4 16,4 19,7 19,12 16.8,12 16.8,7.8 15.2,6.2 12.8,6.2 11.2,7.8 11.2,12" fill="#cbd5e1"/><polygon points="7,12 21,12 23,14 23,23 21,25 7,25 5,23 5,14" fill="#05070c" stroke="#94a3b8" stroke-width="1.6"/><polygon points="13,16 15,16 15.6,21.5 12.4,21.5" fill="#d99b16"/></svg>`;

const SHORT_EXTRA_LABELS = Object.freeze({
  'pt-BR': { cv_marretao: 'MARRETÃO', cv_fogueteira: 'FOGUETEIRA', pcc_contador: 'CONTADOR', pcc_muralha: 'MURALHA', ares_bastiao: 'BASTIÃO-7', ares_agulha: 'AGULHA', op09: 'OP-09', caveira: 'CAVEIRA', solaris: 'SOLARIS', sombra: 'SOMBRA', turbo: 'TURBO', vingador: 'VINGADOR', voltaico: 'VOLTAICO', tita: 'TITÃ', vortex: 'VÓRTEX', boss_cv: 'BARÃO', boss_pcc: 'MESTRE', boss_ares: 'OVERLORD' },
  'en-US': { cv_marretao: 'MARRETÃO', cv_fogueteira: 'FOGUETEIRA', pcc_contador: 'CONTADOR', pcc_muralha: 'MURALHA', ares_bastiao: 'BASTIÃO-7', ares_agulha: 'AGULHA', op09: 'OP-09', caveira: 'SKULL', solaris: 'SOLARIS', sombra: 'SHADOW', turbo: 'TURBO', vingador: 'AVENGER', voltaico: 'VOLTAIC', tita: 'TITAN', vortex: 'VORTEX', boss_cv: 'RED BARON', boss_pcc: 'VAULT MASTER', boss_ares: 'OVERLORD' }
});

const GRID_UI_STRINGS = Object.freeze({
  'pt-BR': {
    headerTag: 'REDE TÁTICA // CÂMERA LENTA ATIVA', headerTitle: 'GRADE DE PERSONAGENS',
    pairHeading: 'DUPLA DA SUA FACÇÃO', extrasHeading: 'OPERADORES EXTRAS & RECRUTÁVEIS',
    inField: 'EM CAMPO', factionOp: 'OPERADOR DA FACÇÃO', deserterOp: 'DESERTOR ALIADO',
    extraRole: 'EXTRA', secretBoss: 'CHEFE SECRETO', mysteryBossPrefix: 'ALVO CONFIDENCIAL // CHEFE',
    lockedStuds: 'BLOQUEADO — DESBLOQUEIE EM PAUSA › PERSONAGENS',
    lockedBoss: 'BLOQUEADO — DERROTE ESTE CHEFE NA GUERRA TERRITORIAL',
    closeLabel: 'FECHAR',
    hints: [['SETAS / WASD', 'Navegar'], ['ENTER / CLIQUE', 'Escolher'], ['1 / 2', 'Dupla da Facção'], ['TAB / ESC', 'Fechar']]
  },
  'en-US': {
    headerTag: 'TACTICAL NET // SLOW-MO ACTIVE', headerTitle: 'CHARACTER GRID',
    pairHeading: 'YOUR FACTION PAIR', extrasHeading: 'EXTRA & RECRUITABLE OPERATORS',
    inField: 'ACTIVE', factionOp: 'FACTION OPERATOR', deserterOp: 'ALLIED DESERTER',
    extraRole: 'EXTRA', secretBoss: 'SECRET BOSS', mysteryBossPrefix: 'CLASSIFIED TARGET // BOSS',
    lockedStuds: 'LOCKED — UNLOCK IN PAUSE › CHARACTERS',
    lockedBoss: 'LOCKED — DEFEAT THIS BOSS IN TERRITORY WAR',
    closeLabel: 'CLOSE',
    hints: [['ARROWS / WASD', 'Navigate'], ['ENTER / CLICK', 'Select'], ['1 / 2', 'Faction Pair'], ['TAB / ESC', 'Close']]
  }
});

function createEl(tag, className = '', id = '', text = '') {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const el = document.createElement(tag);
  if (!el) return null;
  if (id) el.id = id;
  if (className) el.classList?.add(...className.split(/\s+/).filter(Boolean));
  if (text) el.textContent = text;
  return el;
}

function appendAll(parent, ...children) {
  if (!parent) return parent;
  for (const child of children) if (child) parent.appendChild?.(child);
  return parent;
}

function clearContainer(el) {
  if (!el) return;
  if (typeof el.replaceChildren === 'function') el.replaceChildren();
  else { el.innerHTML = ''; if (Array.isArray(el.children)) el.children.length = 0; }
}

function paintGridPortraitCanvas(canvas, charKey, logicalW, logicalH, silhouette = false) {
  if (!canvas) return;
  const dpr = Math.max(1, Math.min(2, (typeof window !== 'undefined' && Number(window.devicePixelRatio)) || 1));
  const pxW = Math.round(logicalW * dpr);
  const pxH = Math.round(logicalH * dpr);
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  try { drawHeroLegoPortrait(ctx, pxW, pxH, charKey, { silhouette: Boolean(silhouette) }); }
  catch (_) { ctx.fillStyle = '#05070c'; ctx.fillRect?.(0, 0, pxW, pxH); }
}

function findGridPosition(matrix, targetKey) {
  if (!Array.isArray(matrix)) return null;
  for (let r = 0; r < matrix.length; r++) {
    const c = Array.isArray(matrix[r]) ? matrix[r].indexOf(targetKey) : -1;
    if (c !== -1) return { row: r, col: c };
  }
  return null;
}

export function installCharacterGridOverlay(LegoHud) {
  Object.defineProperties(LegoHud.prototype, {
    isCharacterGridOpen: { value: false, writable: true, configurable: true, enumerable: false },
    gridSelectedCharKey: { value: null, writable: true, configurable: true, enumerable: false }
  });

  definePrototypeMethods(LegoHud, {
    _ensureCharacterGridDom() {
      if (!Array.isArray(this._gridNavMatrix)) this._gridNavMatrix = [];
      if (!Array.isArray(this.unlockedExtras)) this.unlockedExtras = [];
      if (!(this._gridCardMap instanceof Map)) this._gridCardMap = new Map();
      if (typeof document === 'undefined') return null;

      const overlayEl = (typeof document.getElementById === 'function' && document.getElementById('character-grid-overlay')) || createEl('div', '', 'character-grid-overlay');
      if (!overlayEl) return null;
      if (this._characterGridDomReady && this.characterGridOverlayEl === overlayEl && this.gridExtrasMatrixEl) return overlayEl;

      overlayEl.classList?.add('character-grid-overlay');
      if (!this.isCharacterGridOpen) overlayEl.classList?.add('hidden');
      overlayEl.setAttribute?.('role', 'dialog');
      overlayEl.setAttribute?.('aria-modal', 'true');
      clearContainer(overlayEl);

      const crestEl = createEl('div', 'char-grid-faction-crest');
      const headerTagEl = createEl('div', 'char-grid-header-tag', 'char-grid-header-tag');
      const headerTitleEl = createEl('div', 'char-grid-header-title', 'char-grid-header-title');
      const headerLeftEl = appendAll(createEl('div', 'char-grid-header-left'), crestEl, appendAll(createEl('div', 'char-grid-header-titles'), headerTagEl, headerTitleEl));

      const closeBtnEl = createEl('button', 'tactical-btn-sm char-grid-close-btn', 'char-grid-close-btn');
      closeBtnEl?.setAttribute?.('type', 'button');
      closeBtnEl?.addEventListener?.('click', (e) => { e?.stopPropagation?.(); this.setCharacterGridOpen(false, this._lastController, false); });
      const headerEl = appendAll(createEl('div', 'char-grid-header'), headerLeftEl, closeBtnEl);

      const pairHeadingEl = createEl('div', 'char-grid-section-label', 'char-grid-pair-heading');
      const pairRowEl = createEl('div', 'char-grid-pair-row', 'char-grid-pair-row');
      const extrasHeadingEl = createEl('div', 'char-grid-section-label', 'char-grid-extras-heading');
      const extrasMatrixEl = createEl('div', 'char-grid-extras-matrix', 'char-grid-extras-matrix');
      const inspectBarEl = createEl('div', 'char-grid-inspect-bar', 'char-grid-inspect-bar');
      const footerHintsEl = createEl('div', 'char-grid-footer-hints', 'char-grid-footer-hints');

      const shellEl = appendAll(
        createEl('div', 'char-grid-shell'),
        headerEl,
        appendAll(createEl('div', 'char-grid-section'), pairHeadingEl, pairRowEl),
        appendAll(createEl('div', 'char-grid-section'), extrasHeadingEl, extrasMatrixEl),
        inspectBarEl,
        footerHintsEl
      );
      appendAll(overlayEl, shellEl);
      if (!overlayEl.parentNode && document.body?.appendChild) document.body.appendChild(overlayEl);

      Object.assign(this, {
        characterGridOverlayEl: overlayEl, gridFactionCrestEl: crestEl, gridHeaderTagEl: headerTagEl,
        gridHeaderTitleEl: headerTitleEl, gridCloseBtnEl: closeBtnEl, gridPairHeadingEl: pairHeadingEl,
        gridPairRowEl: pairRowEl, gridExtrasHeadingEl: extrasHeadingEl, gridExtrasMatrixEl: extrasMatrixEl,
        gridInspectBarEl: inspectBarEl, gridFooterHintsEl: footerHintsEl, _characterGridDomReady: true
      });
      return overlayEl;
    },

    _buildCharacterGridRosterState() {
      const validFaction = normalizeFactionKey(this.playerFaction || 'cv');
      const roster = getPlayableRosterForFaction(validFaction, this.unlockedExtras || []);
      this._gridRosterSnapshot = roster;
      this._gridNavMatrix = [
        roster.primaryPair.map((op) => op.key),
        roster.extras.slice(0, 8).map((item) => item.key),
        roster.extras.slice(8, 16).map((item) => item.key)
      ].filter((row) => row.length > 0);
      return { validFaction, roster };
    },

    _bindGridCardEvents(btnEl, charKey) {
      btnEl?.addEventListener?.('mouseenter', () => {
        if (!this.isCharacterGridOpen || this.gridSelectedCharKey === charKey) return;
        this.gridSelectedCharKey = charKey;
        this.wheelSelectedHeroKey = charKey;
        this._syncGridFocusClasses();
        this._renderGridInspectionBar(false);
        playMenuMoveSound();
      });
      btnEl?.addEventListener?.('click', (e) => {
        e?.stopPropagation?.();
        if (this.isCharacterGridOpen) this.confirmCharacterGridSelection(charKey);
      });
    },

    _renderCharacterGridCards() {
      this._ensureCharacterGridDom();
      const { validFaction, roster } = this._buildCharacterGridRosterState();
      const lang = this.settings?.language === 'en-US' ? 'en-US' : 'pt-BR';
      const ui = GRID_UI_STRINGS[lang];
      const fData = FACTION_DATA[validFaction] || FACTION_DATA.cv;
      const activeKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey;

      if (this.characterGridOverlayEl?.dataset) this.characterGridOverlayEl.dataset.faction = validFaction;
      this.characterGridOverlayEl?.style?.setProperty?.('--grid-faction-accent', fData.color);
      if (this.gridFactionCrestEl) this.gridFactionCrestEl.innerHTML = getFactionLogoSvg(validFaction, 36);
      if (this.gridHeaderTagEl) this.gridHeaderTagEl.textContent = `${fData.shortName[lang] || fData.shortName['pt-BR']} // ${ui.headerTag}`;
      if (this.gridHeaderTitleEl) this.gridHeaderTitleEl.textContent = ui.headerTitle;
      if (this.gridCloseBtnEl) this.gridCloseBtnEl.textContent = `[TAB] ${ui.closeLabel}`;
      if (this.gridPairHeadingEl) this.gridPairHeadingEl.textContent = ui.pairHeading;
      if (this.gridExtrasHeadingEl) this.gridExtrasHeadingEl.textContent = ui.extrasHeading;

      this._gridCardMap.clear();
      clearContainer(this.gridPairRowEl);
      clearContainer(this.gridExtrasMatrixEl);
      try { syncOp09CatalogSlot(); } catch (_) { /* noop */ }

      roster.primaryPair.forEach((op, idx) => {
        const cardBtn = createEl('button', 'char-grid-card char-grid-pair-card');
        cardBtn?.setAttribute?.('type', 'button');
        if (cardBtn?.dataset) { cardBtn.dataset.charKey = op.key; cardBtn.dataset.gridSlot = String(idx + 1); }
        if (op.key === activeKey) cardBtn?.classList?.add('is-active-hero');

        const canvas = createEl('canvas', 'char-grid-portrait-canvas');
        paintGridPortraitCanvas(canvas, op.key, 112, 136, false);
        const portraitWrap = appendAll(createEl('div', 'char-grid-pair-portrait'), canvas, createEl('span', 'char-grid-shortcut-badge', '', `[${idx + 1}]`));

        const topRow = appendAll(createEl('div', 'char-grid-pair-topline'), createEl('span', 'char-grid-pair-role', '', formatRoleTitle(op.roles, lang).toUpperCase()));
        if (op.key === activeKey) topRow?.appendChild?.(createEl('span', 'char-grid-active-badge', '', ui.inField));

        const kitText = `${OPERATOR_WEAPONS[op.weaponKey]?.name?.[lang] || ''} • [Q] ${op.abilities?.q?.name?.[lang] || ''} • [E] ${op.abilities?.e?.name?.[lang] || ''}`;
        const metaCol = appendAll(createEl('div', 'char-grid-pair-meta'), topRow, createEl('div', 'char-grid-pair-name', '', (op.displayName?.[lang] || op.name).toUpperCase()), createEl('div', 'char-grid-pair-kit', '', kitText));

        appendAll(cardBtn, portraitWrap, metaCol);
        this._bindGridCardEvents(cardBtn, op.key);
        this._gridCardMap.set(op.key, cardBtn);
        this.gridPairRowEl?.appendChild?.(cardBtn);
      });

      const shortDict = SHORT_EXTRA_LABELS[lang] || SHORT_EXTRA_LABELS['pt-BR'];
      roster.extras.forEach((item) => {
        const unlocked = roster.unlockedSet.has(item.key);
        const tileBtn = createEl('button', 'char-grid-card char-grid-extra-card');
        tileBtn?.setAttribute?.('type', 'button');
        if (tileBtn?.dataset) { tileBtn.dataset.charKey = item.key; tileBtn.dataset.locked = unlocked ? 'false' : 'true'; }
        if (!unlocked) tileBtn?.classList?.add('is-locked');
        if (unlocked && item.key === activeKey) tileBtn?.classList?.add('is-active-hero');

        const canvas = createEl('canvas', 'char-grid-portrait-canvas');
        paintGridPortraitCanvas(canvas, item.key, 72, 72, !unlocked);
        const boxEl = appendAll(createEl('div', 'char-grid-extra-portrait-box'), canvas);

        if (!unlocked) {
          const lockWrap = createEl('span', 'char-grid-lock-overlay');
          if (lockWrap) lockWrap.innerHTML = ANGULAR_PADLOCK_SVG;
          boxEl?.appendChild?.(lockWrap);
        } else if (item.category === 'rival_operator') {
          const allySeal = createEl('span', 'char-grid-ally-seal');
          if (allySeal) allySeal.innerHTML = getFactionLogoSvg(validFaction, 16);
          boxEl?.appendChild?.(allySeal);
        }
        if (unlocked && item.key === activeKey) boxEl?.appendChild?.(createEl('span', 'char-grid-extra-active-dot', '', ui.inField));

        const shortName = !unlocked && item.unlockMethod === 'defeat_boss'
          ? `??? ${(item.bossFaction || '').toUpperCase()}`
          : (shortDict[item.key] || item.name?.[lang] || item.key).toUpperCase();
        appendAll(tileBtn, boxEl, createEl('span', 'char-grid-extra-name', '', shortName));
        this._bindGridCardEvents(tileBtn, item.key);
        this._gridCardMap.set(item.key, tileBtn);
        this.gridExtrasMatrixEl?.appendChild?.(tileBtn);
      });

      if (this.gridFooterHintsEl) {
        this.gridFooterHintsEl.innerHTML = ui.hints.map(([k, txt]) => `<span class="char-grid-hint"><kbd>${k}</kbd><span>${txt}</span></span>`).join('');
      }
      this._syncGridFocusClasses();
      this._renderGridInspectionBar(false);
    },

    _syncGridFocusClasses() {
      if (!(this._gridCardMap instanceof Map)) return;
      for (const [key, el] of this._gridCardMap.entries()) el?.classList?.toggle('is-grid-focused', key === this.gridSelectedCharKey);
    },

    _renderGridInspectionBar(emphasizeLock = false) {
      if (!this.gridInspectBarEl) return;
      const validFaction = normalizeFactionKey(this.playerFaction || 'cv');
      const roster = this._gridRosterSnapshot || getPlayableRosterForFaction(validFaction, this.unlockedExtras || []);
      const lang = this.settings?.language === 'en-US' ? 'en-US' : 'pt-BR';
      const ui = GRID_UI_STRINGS[lang];
      const key = this.gridSelectedCharKey || this._gridNavMatrix?.[0]?.[0];
      if (!key) return;

      const unlocked = roster.unlockedSet.has(key);
      const op = getOperatorSpec(key);
      const extra = EXTRAS_CATALOG[key];
      this.gridInspectBarEl.classList?.toggle('is-locked-inspect', !unlocked);
      this.gridInspectBarEl.classList?.toggle('is-lock-alert', Boolean(!unlocked && emphasizeLock));

      if (!unlocked) {
        const isBoss = extra?.unlockMethod === 'defeat_boss';
        const title = isBoss ? `${ui.mysteryBossPrefix} ${(extra.bossFaction || '').toUpperCase()}` : (extra?.name?.[lang] || key).toUpperCase();
        this.gridInspectBarEl.innerHTML = `<div class="char-grid-inspect-main"><span class="char-grid-inspect-name">${title}</span><span class="char-grid-inspect-lock-msg">${isBoss ? ui.lockedBoss : ui.lockedStuds}</span></div>`;
        return;
      }

      const name = key === 'op09'
        ? (syncOp09CatalogSlot()?.cleanName || 'OP-09').toUpperCase()
        : (op ? (op.displayName?.[lang] || op.name) : (extra?.name?.[lang] || getHeroInfo(key)?.cleanName || key)).toUpperCase();
      const roleTitle = formatRoleTitle(op?.roles || extra?.roles || ['damage'], lang);
      const categoryTag = op
        ? (op.faction === validFaction ? ui.factionOp : `${ui.deserterOp} (${validFaction.toUpperCase()})`)
        : (extra?.category === 'secret_boss' ? ui.secretBoss : ui.extraRole);
      const abilities = getCharacterAbilityDescriptors(key);
      const weaponChip = op && OPERATOR_WEAPONS[op.weaponKey] ? `<span class="char-grid-inspect-chip">${OPERATOR_WEAPONS[op.weaponKey].name[lang]}</span>` : '';
      const qLabel = abilities?.q?.name?.[lang] || abilities?.q?.name?.['pt-BR'] || 'Q';
      const eLabel = abilities?.e?.name?.[lang] || abilities?.e?.name?.['pt-BR'] || 'E';

      this.gridInspectBarEl.innerHTML = `<div class="char-grid-inspect-main"><span class="char-grid-inspect-name">${name}</span><span class="char-grid-inspect-role">${roleTitle} • ${categoryTag}</span></div><div class="char-grid-inspect-abilities">${weaponChip}<span class="char-grid-inspect-chip"><b>[Q]</b> ${qLabel}</span><span class="char-grid-inspect-chip"><b>[E]</b> ${eLabel}</span></div>`;
    },

    setCharacterGridOpen(open, controller = null, confirmSelection = false) {
      if (open && (this.isCreatorOpen || this.isCustomsOpen || this.isAircraftStudioOpen)) return;
      if (controller) this._lastController = controller;
      this._ensureCharacterGridDom();

      const nextOpen = Boolean(open);
      if (Boolean(this.isCharacterGridOpen) === nextOpen) return;

      if (nextOpen) {
        this._lastController?.resetHeldInputs?.();
        if (this.isFullMapOpen) this.setFullMapOpen?.(false);
        if (this.isDossierOpen) this.setHeroDossierOpen?.(false);
        if (this.isRadioWheelOpen || this.isTikTokRadioOpen) this.setRadioWheelOpen?.(false);

        this.isCharacterGridOpen = true;
        this.isHeroWheelOpen = true;
        document.body?.classList?.toggle('character-grid-active', true);
        document.body?.classList?.toggle('hero-wheel-active', false);
        this.wheelOverlayEl?.classList?.add('hidden');
        this.characterGridOverlayEl?.classList?.remove('hidden');

        if (typeof document !== 'undefined') {
          document.getElementById?.('pointer-prompt')?.classList?.remove('visible');
          if (document.pointerLockElement && typeof document.exitPointerLock === 'function') document.exitPointerLock();
        }

        this._buildCharacterGridRosterState();
        const activeKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey;
        const startKey = findGridPosition(this._gridNavMatrix, activeKey) ? activeKey : (this._gridNavMatrix[0]?.[0] || activeKey);
        this.gridSelectedCharKey = startKey;
        this.wheelSelectedHeroKey = startKey;
        this._renderCharacterGridCards();
        soundFX.playTacticalRoll?.();
        return;
      }

      const candidateKey = this.gridSelectedCharKey;
      this.isCharacterGridOpen = false;
      this.isHeroWheelOpen = false;
      document.body?.classList?.toggle('character-grid-active', false);
      document.body?.classList?.toggle('hero-wheel-active', false);
      this.characterGridOverlayEl?.classList?.add('hidden');

      if (confirmSelection && candidateKey && isCharacterUnlocked(candidateKey, this.playerFaction, this.unlockedExtras)) {
        this._lastController?.switchToHero?.(candidateKey);
        this.currentHeroKey = candidateKey;
      }
      (controller || this._lastController)?.relockPointer?.();
    },

    toggleCharacterGrid(controller = null) {
      this.setCharacterGridOpen(!this.isCharacterGridOpen, controller, false);
    },

    stepCharacterGridSelection(dx = 0, dy = 0) {
      if (!this.isCharacterGridOpen) return;
      if (!Array.isArray(this._gridNavMatrix) || !this._gridNavMatrix.length) this._buildCharacterGridRosterState();
      const matrix = this._gridNavMatrix;
      if (!matrix.length) return;

      const cur = findGridPosition(matrix, this.gridSelectedCharKey) || { row: 0, col: 0 };
      let nextRow = cur.row;
      let nextCol = cur.col;

      if (dy !== 0) {
        const fromLen = Math.max(1, matrix[nextRow].length);
        nextRow = ((nextRow + Math.sign(dy)) % matrix.length + matrix.length) % matrix.length;
        const toLen = Math.max(1, matrix[nextRow].length);
        nextCol = Math.min(toLen - 1, Math.floor((nextCol * toLen) / fromLen));
      }
      if (dx !== 0) {
        const rowLen = Math.max(1, matrix[nextRow].length);
        nextCol = ((nextCol + Math.sign(dx)) % rowLen + rowLen) % rowLen;
      }

      const nextKey = matrix[nextRow]?.[nextCol];
      if (!nextKey) return;
      const changed = nextKey !== this.gridSelectedCharKey;
      this.gridSelectedCharKey = nextKey;
      this.wheelSelectedHeroKey = nextKey;
      this._syncGridFocusClasses();
      this._renderGridInspectionBar(false);
      if (changed) playMenuMoveSound();
    },

    confirmCharacterGridSelection(targetKey = this.gridSelectedCharKey) {
      if (!targetKey) return false;
      this.gridSelectedCharKey = targetKey;
      this.wheelSelectedHeroKey = targetKey;

      if (!isCharacterUnlocked(targetKey, this.playerFaction, this.unlockedExtras)) {
        this._syncGridFocusClasses();
        this._renderGridInspectionBar(true);
        const cardEl = this._gridCardMap?.get?.(targetKey);
        if (cardEl) {
          cardEl.classList?.remove('grid-shake-locked');
          cardEl.classList?.add('grid-shake-locked');
          if (this._gridShakeTimer) clearTimeout(this._gridShakeTimer);
          this._gridShakeTimer = setTimeout(() => cardEl.classList?.remove('grid-shake-locked'), 320);
          this._gridShakeTimer?.unref?.();
        }
        playMenuBackSound();
        return false;
      }

      playMenuConfirmSound();
      this._lastController?.switchToHero?.(targetKey);
      this.currentHeroKey = targetKey;
      this.setCharacterGridOpen(false, this._lastController, false);
      return true;
    },

    setHeroWheelOpen(open, ctrl = null, confirm = false) {
      this.setCharacterGridOpen(open, ctrl, confirm);
    },

    stepHeroWheelSelection(delta = 1) {
      this.stepCharacterGridSelection(delta, 0);
    }
  });
}
