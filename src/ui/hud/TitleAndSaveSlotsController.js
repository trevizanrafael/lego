import { soundFX } from '../../audio/SoundFX.js';
import { getHeroInfo, syncOp09CatalogSlot } from '../HeroWheelAndDossier.js';
import {
  createDefaultCustomHeroState,
  setActiveCustomHero
} from '../../entities/CustomHeroSystem.js';
import {
  createDefaultGarageSaveData,
  setActiveGarageSaveData
} from '../../world/StreetCustomGarage.js';
import {
  createDefaultAircraftSaveData,
  setActiveAircraftSaveData,
  applySavedAircraftConfigsToCarrier
} from '../../world/AircraftCustomGarage.js';
import {
  FACTION_DATA,
  UI_TEXTS,
  getFreeRoamLogoSvg,
  getFactionLogoSvg,
  loadAllSaveSlots,
  writeSaveSlot,
  deleteSaveSlot
} from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

const FACTION_ACRONYMS = {
  cv: 'CV',
  pcc: 'PCC',
  ares: 'A.R.E.S.'
};

export function installTitleAndSaveSlotsController(LegoHud) {
  definePrototypeMethods(LegoHud, {
    _initTitleAndLoadingDom() {
      this.titleOverlayEl = document.getElementById('title-screen-overlay');
      this.favelaCanvasEl = document.getElementById('title-favela-bg-canvas');
      this.titleMainPanelEl = document.getElementById('title-main-panel');
      this.titleSlotsPanelEl = document.getElementById('title-slots-panel');
      this.titleFactionPanelEl = document.getElementById('title-faction-panel');
      this.saveSlotsGridEl = document.getElementById('save-slots-grid');
      this.factionCardsGridEl = document.getElementById('faction-cards-grid');

      this.loadingScreenEl = document.getElementById('tactical-loading-screen');
      this.loadingFactionLogoEl = document.getElementById('loading-faction-logo');
      this.loadingFactionTitleEl = document.getElementById('loading-faction-title');
      this.loadingStageTextEl = document.getElementById('loading-stage-text');
      this.loadingPctTextEl = document.getElementById('loading-pct-text');
      this.loadingLegoBarEl = document.getElementById('loading-lego-bar');
      this.loadingTipTextEl = document.getElementById('loading-tip-text');
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
    },

    _bindTitleScreenButtons() {
      document.getElementById('btn-title-new-game')?.addEventListener('click', () => {
        soundFX.playHeroSwap();
        soundFX.startWarMusic();
        this._openSaveSlotsPanel('new');
      });

      document.getElementById('btn-title-load-game')?.addEventListener('click', () => {
        soundFX.playHeroSwap();
        soundFX.startWarMusic();
        this._openSaveSlotsPanel('load');
      });

      document.getElementById('btn-title-options')?.addEventListener('click', () => {
        soundFX.playTacticalRoll();
        soundFX.startWarMusic();
        this.setPauseMenuOpen(true, this._lastController, true);
      });

      document.getElementById('btn-title-language')?.addEventListener('click', () => {
        this._toggleLanguage();
      });

      document.getElementById('btn-slots-back')?.addEventListener('click', () => {
        soundFX.playTacticalRoll();
        this._setTitleSubPanel('main');
      });

      document.getElementById('btn-faction-back')?.addEventListener('click', () => {
        soundFX.playTacticalRoll();
        if (this.isTitleScreenActive) {
          this._setTitleSubPanel('slots');
        } else {
          this.titleOverlayEl?.classList.add('hidden');
          document.body?.classList.remove('title-or-loading-active');
          this.setPauseMenuOpen(true, this._lastController);
        }
      });
    },

    _setTitleSubPanel(panelName = 'main') {
      if (this.titleMainPanelEl) {
        this.titleMainPanelEl.classList.toggle('hidden', panelName !== 'main');
      }
      if (this.titleSlotsPanelEl) {
        this.titleSlotsPanelEl.classList.toggle('hidden', panelName !== 'slots');
      }
      if (this.titleFactionPanelEl) {
        this.titleFactionPanelEl.classList.toggle('hidden', panelName !== 'faction');
      }
    },

    _openSaveSlotsPanel(mode = 'new') {
      this._slotsMode = mode;
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];

      this._setTitleSubPanel('slots');

      const titleEl = document.getElementById('slots-panel-title');
      if (titleEl) {
        titleEl.textContent = mode === 'new' ? t.selectSlotNew : t.selectSlotLoad;
      }

      const slots = loadAllSaveSlots();
      if (!this.saveSlotsGridEl) return;

      const standbyTag = lang === 'en-US' ? 'STANDBY' : 'INATIVO';
      const activeTag = lang === 'en-US' ? 'ENCRYPTED' : 'GRAVADO';
      const unregLabel = lang === 'en-US' ? 'UNREGISTERED' : 'NÃO REGISTRADO';

      this.saveSlotsGridEl.innerHTML = [0, 1, 2]
        .map((idx) => {
          const slotNum = `0${idx + 1}`;
          const s = slots[idx];
          if (!s) {
            return `
              <div class="save-slot-card empty-slot-card" data-slot-index="${idx}">
                <span class="slot-ghost-num" aria-hidden="true">${slotNum}</span>
                <div class="slot-crest-wrap">${getFreeRoamLogoSvg(46)}</div>
                <div class="slot-identity-col">
                  <div class="slot-header-row">
                    <span class="dossier-tag">DOSSIÊ // SLOT ${slotNum}</span>
                    <span class="slot-status-tag">${standbyTag}</span>
                  </div>
                  <div class="slot-meta-list slot-empty-copy">
                    <span>${t.emptySlot}</span>
                  </div>
                </div>
                <div class="slot-actions-row">
                  <button class="tactical-btn" data-slot-action="start-new" data-slot="${idx}">
                    ${t.startSlotBtn}
                  </button>
                </div>
              </div>
            `;
          }

          const op09Label = s.customHero?.isCreated ? s.customHero.name : unregLabel;
          const heroDisplayName =
            s.heroKey === 'op09' ? op09Label : getHeroInfo(s.heroKey || 'caveira').name;
          const fKey = FACTION_DATA[s.faction] ? s.faction : 'cv';
          const fData = FACTION_DATA[fKey];
          const conqCount = Array.isArray(s.conqueredTerritories)
            ? new Set([fKey, ...s.conqueredTerritories]).size
            : 1;
          return `
            <div class="save-slot-card" data-faction="${fKey}" data-slot-index="${idx}" style="--slot-accent:${fData.color}">
              <span class="slot-ghost-num" aria-hidden="true">${slotNum}</span>
              <div class="slot-crest-wrap">${getFactionLogoSvg(fKey, 48)}</div>
              <div class="slot-identity-col">
                <div class="slot-header-row">
                  <span class="dossier-tag">SLOT ${slotNum} // ${s.updatedAt || ''}</span>
                  <span class="slot-status-tag active">${activeTag}</span>
                </div>
                <div class="faction-card-name" style="color:${fData.color}">
                  ${fData.name[lang] || fData.name['pt-BR']}
                </div>
              </div>
              <div class="slot-meta-list">
                <span><b>STUDS:</b> ${(s.studs || 0).toLocaleString('pt-BR')} • <b>BASES:</b> ${conqCount}/3</span>
                <span><b>OPERADOR:</b> ${heroDisplayName} • <b>OP-09:</b> ${op09Label}</span>
              </div>
              <div class="slot-actions-row">
                <button class="tactical-btn" data-slot-action="${mode === 'new' ? 'start-new' : 'load'}" data-slot="${idx}">
                  ${mode === 'new' ? t.overwriteSlotBtn : t.loadSlotBtn}
                </button>
                <button class="tactical-btn danger-btn" data-slot-action="delete" data-slot="${idx}">
                  ${t.deleteSlotBtn}
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      const triggerSlotAction = (idx, action) => {
        if (action === 'delete') {
          deleteSaveSlot(idx);
          soundFX.playPlasticHit();
          this._openSaveSlotsPanel(mode);
        } else if (action === 'load') {
          const currentSlots = loadAllSaveSlots();
          const saved = currentSlots[idx];
          if (saved) {
            this.activeSaveSlot = idx;
            this.startLoadingSequence(saved, false);
          }
        } else {
          this.pendingSlotIndex = idx;
          this.activeSaveSlot = idx;
          soundFX.playHeroSwap();
          this._openFactionSelectionPanel();
        }
      };

      if (typeof this.saveSlotsGridEl?.querySelectorAll === 'function') {
        this.saveSlotsGridEl.querySelectorAll('button[data-slot-action]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e?.stopPropagation?.();
            const idx = Number(btn.dataset.slot || 0);
            triggerSlotAction(idx, btn.dataset.slotAction);
          });
        });

        this.saveSlotsGridEl.querySelectorAll('.save-slot-card').forEach((rowEl) => {
          rowEl.addEventListener('click', (e) => {
            if (e?.target?.closest?.('button[data-slot-action]')) return;
            const idx = Number(rowEl.dataset?.slotIndex || 0);
            const hasSave = Boolean(slots[idx]);
            const defaultAction = !hasSave || mode === 'new' ? 'start-new' : 'load';
            triggerSlotAction(idx, defaultAction);
          });
        });
      }
    },

    _openFactionSelectionPanel() {
      const lang = this.settings?.language || 'pt-BR';
      this._setTitleSubPanel('faction');
      if (!this.factionCardsGridEl) return;

      const commanderLbl = lang === 'en-US' ? 'WAR COMMANDER' : 'COMANDANTE';
      const ctaText = lang === 'en-US' ? '[ TAKE COMMAND ▸ ]' : '[ ASSUMIR COMANDO ▸ ]';

      this.factionCardsGridEl.innerHTML = ['cv', 'pcc', 'ares']
        .map((fKey) => {
          const f = FACTION_DATA[fKey];
          const acronym = FACTION_ACRONYMS[fKey] || fKey.toUpperCase();
          return `
            <div class="faction-choice-card" data-faction="${fKey}">
              <div class="faction-pillar-beam" aria-hidden="true"></div>
              <div class="faction-pillar-watermark" aria-hidden="true">
                ${getFactionLogoSvg(fKey, 220)}
              </div>
              <div class="faction-pillar-top">
                <div class="faction-pillar-acronym" aria-hidden="true">${acronym}</div>
                <div class="faction-card-code">PROTOCOLO // ${fKey.toUpperCase()}</div>
              </div>
              <div class="faction-pillar-bottom">
                <div class="faction-card-top">
                  ${getFactionLogoSvg(fKey, 72)}
                  <div>
                    <div class="faction-card-name" style="color:${f.color}">
                      ${f.name[lang] || f.name['pt-BR']}
                    </div>
                    <div class="faction-card-fortress">
                      ${f.fortress[lang] || f.fortress['pt-BR']}
                    </div>
                  </div>
                </div>
                <div class="faction-pillar-reveal">
                  <div class="faction-card-boss">
                    <span>${commanderLbl}:</span>
                    <b>${f.bossName[lang] || f.bossName['pt-BR']}</b>
                  </div>
                  <p class="faction-card-desc">
                    ${f.desc[lang] || f.desc['pt-BR']}
                  </p>
                </div>
                <button class="tactical-btn faction-select-btn" data-choose-faction="${fKey}">
                  ${ctaText}
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      const commitFactionChoice = (chosenFaction = 'cv') => {
        this.activeSaveSlot = this.pendingSlotIndex ?? this.activeSaveSlot ?? 0;

        if (!this.isTitleScreenActive) {
          this.setPlayerFaction(chosenFaction, true);
          this.saveCurrentProgress();
          this.titleOverlayEl?.classList.add('hidden');
          document.body?.classList.remove('title-or-loading-active');
          soundFX.playTrueHeroFanfare();
          if (this._lastController && typeof this._lastController.relockPointer === 'function') {
            this._lastController.relockPointer();
          }
          return;
        }

        const defaultCustom = createDefaultCustomHeroState();
        const defaultGarage = createDefaultGarageSaveData();
        const defaultAircraft = createDefaultAircraftSaveData();
        setActiveCustomHero(defaultCustom);
        setActiveGarageSaveData(defaultGarage);
        setActiveAircraftSaveData(defaultAircraft);
        syncOp09CatalogSlot();
        if (this.tiktokRadio) {
          this.tiktokRadio.importSaveState(null);
        }
        const slotData = writeSaveSlot(this.activeSaveSlot, {
          faction: chosenFaction,
          studs: 0,
          heroKey: 'caveira',
          conqueredTerritories: [],
          customHero: defaultCustom,
          customGarage: defaultGarage,
          aircraftCustom: defaultAircraft,
          radioState: this.tiktokRadio ? this.tiktokRadio.exportSaveState() : null
        });
        this.startLoadingSequence(slotData, true);
      };

      if (typeof this.factionCardsGridEl?.querySelectorAll === 'function') {
        this.factionCardsGridEl.querySelectorAll('button[data-choose-faction]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e?.stopPropagation?.();
            commitFactionChoice(btn.dataset.chooseFaction || 'cv');
          });
        });

        this.factionCardsGridEl.querySelectorAll('.faction-choice-card').forEach((card) => {
          card.addEventListener('click', (e) => {
            if (e?.target?.closest?.('button[data-choose-faction]')) return;
            commitFactionChoice(card.dataset?.faction || 'cv');
          });
        });
      }
    },

    _setLoadingProgressUI(pct, stageText) {
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      if (this.loadingPctTextEl) {
        this.loadingPctTextEl.textContent = `${clamped}%`;
      }
      if (this.loadingStageTextEl && stageText) {
        this.loadingStageTextEl.textContent = stageText;
      }
      if (this._loadingBarSegs && this._loadingBarSegs.length > 0) {
        const litCount = Math.round((clamped / 100) * this._loadingBarSegs.length);
        this._loadingBarSegs.forEach((seg, idx) => {
          seg.classList.toggle('lit', idx < litCount);
        });
      }
    },

    startLoadingSequence(slotData, isNewOrSwitch = false) {
      this.isTitleScreenActive = false;
      this.isLoadingActive = true;
      document.body?.classList.add('title-or-loading-active');

      this._lastController?.resetHeldInputs?.();
      this.setTikTokRadioOpen(false, this._lastController);
      this.tiktokRadio?.stopAllPlayback();
      soundFX.baileFunkMix = 0;
      soundFX.baileBeatPulse = 0;
      soundFX.stopWarMusic();
      if (this.tiktokRadio) {
        this.tiktokRadio.importSaveState(slotData?.radioState || null);
      }

      this.titleOverlayEl?.classList.add('hidden');
      this.setPauseMenuOpen(false, this._lastController, true);

      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];

      const chosenFaction = FACTION_DATA[slotData?.faction] ? slotData.faction : 'cv';
      const fInfo = FACTION_DATA[chosenFaction];

      if (this.loadingFactionLogoEl) {
        this.loadingFactionLogoEl.innerHTML = getFactionLogoSvg(chosenFaction, 76);
      }
      if (this.loadingFactionTitleEl) {
        this.loadingFactionTitleEl.textContent = fInfo.name[lang] || fInfo.name['pt-BR'] || t.subtitle;
        this.loadingFactionTitleEl.style.color = fInfo.color;
      }
      if (this.loadingTipTextEl) {
        const tips =
          lang === 'en-US'
            ? [
                'Press [E] near any Interceptor, Armored SUV, Tactical Bike or Street Coupe to commandeer vehicles across all 10 Metropolis Sectors.',
                'Hold [TAB] at any moment to engage the Tactical Wheel in slow-motion and switch between all 8 Elite Operators on the fly.',
                'With Solaris, double-tap [SPACE] for thermal hover and hold [SHIFT] to tear through the storm in Supersonic Comet Flight.',
                'Open the Satellite Map with [M] to project 3D Tactical Beacons across the skyline or trigger Rapid Extraction to any sector.',
                'Crossing into rival strongholds ignites 1v1 turf warfare and deploys War Commanders — use rooftops, alleys and armored convoys.'
              ]
            : [
                'Pressione [E] próximo a qualquer Interceptor, SUV Blindado, Moto Tática ou Cupê Urbano para assumir a direção pelas 10 Regiões.',
                'Segure [TAB] a qualquer instante para acionar o Seletor Tático em câmera lenta e alternar entre os 8 Operadores de Elite.',
                'Com Solaris, pressione [ESPAÇO] duas vezes para levitação térmica e mantenha [SHIFT] para cortar a tempestade em Voo Supersônico.',
                'Abra o Mapa Satelital em [M] para projetar Balizas Táticas no horizonte ou acionar Extração Rápida entre os bairros.',
                'Invadir bastiões rivais deflagra guerra territorial 1x1 e convoca Comandantes de Guerra — domine terraços, becos e blindados.'
              ];
        this.loadingTipTextEl.textContent = tips[Math.floor(Math.random() * tips.length)];
      }

      if (this.loadingScreenEl) {
        this.loadingScreenEl.classList.remove('hidden');
        this.loadingScreenEl.style.opacity = '1';
      }

      this._setLoadingProgressUI(
        10,
        lang === 'en-US'
          ? 'DEPLOYING OPERATOR & SYNCING DARK METROPOLIS...'
          : 'POSICIONANDO OPERADOR & SINCRONIZANDO METRÓPOLE SOMBRIA...'
      );

      const nextFrame = (fn) =>
        typeof requestAnimationFrame === 'function'
          ? requestAnimationFrame(fn)
          : setTimeout(fn, 0);

      const safeWarmup = (stage, idx = 0) => {
        if (typeof this.onWarmupStep === 'function') {
          try {
            return this.onWarmupStep(stage, idx) !== false;
          } catch (err) {
            console.warn(`[Warmup ${stage}]`, err);
            return false;
          }
        }
        return true;
      };

      nextFrame(() => {
        const engineOk = safeWarmup('init_engine', 0);
        if (!engineOk) {
          this.isLoadingActive = false;
          this.isTitleScreenActive = true;
          this.loadingScreenEl?.classList.add('hidden');
          this.titleOverlayEl?.classList.remove('hidden');
          this._setTitleSubPanel('main');
          return;
        }

        try {
          setActiveCustomHero(slotData?.customHero || createDefaultCustomHeroState());
          setActiveGarageSaveData(slotData?.customGarage || createDefaultGarageSaveData());
          setActiveAircraftSaveData(slotData?.aircraftCustom || createDefaultAircraftSaveData());
          applySavedAircraftConfigsToCarrier(this._lastController?.world);
          syncOp09CatalogSlot();
          this.totalStuds = Number(slotData?.studs || 0);
          this.displayedStuds = this.totalStuds;
          if (this.studCountEl) {
            this.studCountEl.textContent = this.totalStuds.toLocaleString('pt-BR');
          }
          const initialHeroKey = slotData?.heroKey || 'caveira';
          if (this._lastController) {
            this._lastController.switchToHero(initialHeroKey);
          }
          if (initialHeroKey === 'op09') {
            this.syncOp09UI();
          }
          this.setPlayerFaction(
            chosenFaction,
            true,
            Array.isArray(slotData?.conqueredTerritories) ? slotData.conqueredTerritories : []
          );
          this.onApplyTerritoryMeta?.(slotData?.territoryMeta || null);
          this.goldenBricks = Number(slotData?.goldenBricks || 0);
          this._lastController?.world?.livingCity?.wantedSystem?.clearWanted?.('reset');
          this.setPlayerHealth(250, 250, false);
        } catch (err) {
          console.warn('[Loading Stage 1]', err);
        }

        safeWarmup('matrices', 0);
        this._setLoadingProgressUI(
          28,
          lang === 'en-US'
            ? 'MOBILIZING NIGHT TRAFFIC, PATROLS & UNDERWORLD...'
            : 'MOBILIZANDO TRÁFEGO NOTURNO, PATRULHAS & SUBMUNDO...'
        );

        nextFrame(() => {
          safeWarmup('simulate_entities', 0);
          this._setLoadingProgressUI(
            52,
            lang === 'en-US'
              ? 'COMPILING PBR NOIR SHADERS & GPU TEXTURES...'
              : 'COMPILANDO SHADERS PBR SOMBRIOS & TEXTURAS NA GPU...'
          );

          nextFrame(() => {
            safeWarmup('compile_shaders', 0);
            this._setLoadingProgressUI(
              68,
              lang === 'en-US'
                ? 'STREAMING 360° URBAN GEOMETRY WARM-UP (1/4)...'
                : 'AQUECENDO GEOMETRIA URBANA 360° ANTI-ENGASGO (1/4)...'
            );

            const runAngleStep = (angleIdx) => {
              if (angleIdx < 4) {
                safeWarmup('render_360', angleIdx);
                const pct = 68 + Math.round(((angleIdx + 1) / 4) * 28);
                this._setLoadingProgressUI(
                  pct,
                  lang === 'en-US'
                    ? `STREAMING 360° URBAN GEOMETRY WARM-UP (${angleIdx + 1}/4)...`
                    : `AQUECENDO GEOMETRIA URBANA 360° ANTI-ENGASGO (${angleIdx + 1}/4)...`
                );
                nextFrame(() => runAngleStep(angleIdx + 1));
                return;
              }

              safeWarmup('finish', 0);
              this._setLoadingProgressUI(
                100,
                lang === 'en-US'
                  ? 'ALL TACTICAL SYSTEMS ONLINE. ENTERING METROPOLIS...'
                  : 'SISTEMAS OPERACIONAIS. INICIANDO INFILTRAÇÃO...'
              );

              nextFrame(() => {
                this.isLoadingActive = false;
                document.body?.classList.remove('title-or-loading-active');
                if (this.loadingScreenEl) {
                  this.loadingScreenEl.classList.add('hidden');
                }

                soundFX.playTrueHeroFanfare();
                soundFX.startWarMusic();

                if (this._lastController && typeof this._lastController.relockPointer === 'function') {
                  this._lastController.relockPointer();
                }
              });
            };

            nextFrame(() => runAngleStep(0));
          });
        });
      });
    }
  });
}
