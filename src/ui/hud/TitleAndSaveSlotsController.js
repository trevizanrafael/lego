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
  getFactionLogoSvg,
  loadAllSaveSlots,
  writeSaveSlot,
  deleteSaveSlot
} from '../FactionIconsAndSaveSystem.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

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

    /**
     * Máquina de estados exclusiva para os 3 subpainéis da Tela Inicial ('main' | 'slots' | 'faction')
     * Garante que APENAS UM painel fique visível por vez abaixo da Logo Oficial!
     */
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

      this.saveSlotsGridEl.innerHTML = [0, 1, 2]
        .map((idx) => {
          const s = slots[idx];
          if (!s) {
            return `
              <div class="save-slot-card">
                <div class="dossier-tag">SLOT 0${idx + 1}</div>
                <div class="slot-meta-list" style="padding: 18px 0; color: #94a3b8;">
                  <span>${t.emptySlot}</span>
                </div>
                <div class="slot-actions-row">
                  <button class="tactical-btn" data-slot-action="start-new" data-slot="${idx}">
                    ${t.startSlotBtn}
                  </button>
                </div>
              </div>
            `;
          }

          const op09Label = s.customHero?.isCreated ? s.customHero.name : 'CIDADÃO COMUM';
          const heroDisplayName =
            s.heroKey === 'op09' ? op09Label : getHeroInfo(s.heroKey || 'caveira').name;
          const fKey = FACTION_DATA[s.faction] ? s.faction : 'cv';
          const fData = FACTION_DATA[fKey];
          const conqCount = Array.isArray(s.conqueredTerritories)
            ? new Set([fKey, ...s.conqueredTerritories]).size
            : 1;
          return `
            <div class="save-slot-card" style="border-top-color:${fData.color}">
              <div class="faction-card-top">
                ${getFactionLogoSvg(fKey, 58)}
                <div>
                  <div class="dossier-tag">SLOT 0${idx + 1} // ${s.updatedAt || ''}</div>
                  <div class="faction-card-name" style="color:${fData.color}; font-size:1.35rem;">
                    ${fData.name[lang] || fData.name['pt-BR']}
                  </div>
                </div>
              </div>
              <div class="slot-meta-list">
                <span><b>STUDS:</b> ${(s.studs || 0).toLocaleString('pt-BR')} • <b>BASES:</b> ${conqCount}/3</span>
                <span><b>ATIVO:</b> ${heroDisplayName} • <b>OP-09:</b> ${op09Label}</span>
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

      if (typeof this.saveSlotsGridEl?.querySelectorAll === 'function') {
        this.saveSlotsGridEl.querySelectorAll('button[data-slot-action]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.slot || 0);
            const action = btn.dataset.slotAction;
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
              // Novo Jogo: abre o Painel de Escolha das 3 Facções (CV / PCC / A.R.E.S.)!
              this.pendingSlotIndex = idx;
              this.activeSaveSlot = idx;
              soundFX.playHeroSwap();
              this._openFactionSelectionPanel();
            }
          });
        });
      }
    },

    _openFactionSelectionPanel() {
      const lang = this.settings?.language || 'pt-BR';
      const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
      this._setTitleSubPanel('faction');
      if (!this.factionCardsGridEl) return;

      this.factionCardsGridEl.innerHTML = ['cv', 'pcc', 'ares']
        .map((fKey) => {
          const f = FACTION_DATA[fKey];
          return `
            <div class="faction-choice-card" data-faction="${fKey}">
              <div>
                <div class="faction-card-top">
                  ${getFactionLogoSvg(fKey, 76)}
                  <div>
                    <div class="faction-card-name" style="color:${f.color}">
                      ${f.name[lang] || f.name['pt-BR']}
                    </div>
                    <div class="faction-card-fortress">
                      ${f.fortress[lang] || f.fortress['pt-BR']}
                    </div>
                  </div>
                </div>
                <p class="faction-card-desc" style="margin-top:12px;">
                  ${f.desc[lang] || f.desc['pt-BR']}
                </p>
              </div>
              <button class="tactical-btn" data-choose-faction="${fKey}" style="border-color:${f.color}; color:${f.color}; width:100%;">
                ${t.joinFactionBtn}
              </button>
            </div>
          `;
        })
        .join('');

      if (typeof this.factionCardsGridEl?.querySelectorAll === 'function') {
        this.factionCardsGridEl.querySelectorAll('button[data-choose-faction]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const chosenFaction = btn.dataset.chooseFaction || 'cv';
            this.activeSaveSlot = this.pendingSlotIndex ?? this.activeSaveSlot ?? 0;

            if (!this.isTitleScreenActive) {
              // Troca instantânea de Facção durante a partida via [ESC] sem recarregar o motor 3D!
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

    /**
     * Executa a Tela de Loading Real (0% -> 100%) com Compilação de Shaders WebGL e Warm-Up 360° Anti-Lag!
     */
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
        this.loadingFactionLogoEl.innerHTML = getFactionLogoSvg(chosenFaction, 78);
      }
      if (this.loadingFactionTitleEl) {
        this.loadingFactionTitleEl.textContent = fInfo.name[lang] || fInfo.name['pt-BR'] || t.subtitle;
        this.loadingFactionTitleEl.style.color = fInfo.color;
      }
      if (this.loadingTipTextEl) {
        const tips =
          lang === 'en-US'
            ? [
                'Press [E] near any Yellow Taxi, LEGO City Bus, Supercar or Beach Buggy to cruise freely across all 10 Regions!',
                'Hold [TAB] at any time to open the Hero Wheel in slow-motion and switch between all 8 LEGO Operators!',
                'With Solaris, double-jump with [SPACE] to hover and hold [SHIFT] for Supersonic Comet Flight across the skyline!',
                'Open the Full Map with [M] to place 3D Sky Beacons or trigger GTA-style Satellite Fast Travel anywhere!'
              ]
            : [
                'Aperte [E] perto de qualquer Táxi Amarelo, Ônibus LEGO, Supercarro ou Buggy de Praia para dirigir pelas 10 Regiões!',
                'Segure [TAB] a qualquer momento para abrir a Roda de Heróis em Câmera Lenta e alternar entre os 8 Operadores LEGO!',
                'Com o Solaris, aperte [ESPAÇO] duas vezes para pairar e segure [SHIFT] para ativar o Voo Supersônico de Cometa!',
                'Abra o Mapa Completo com [M] para marcar Feixes de Luz 3D ou fazer Viagem Rápida por Satélite para qualquer bairro!'
              ];
        this.loadingTipTextEl.textContent = tips[Math.floor(Math.random() * tips.length)];
      }

      if (this.loadingScreenEl) {
        this.loadingScreenEl.classList.remove('hidden');
        this.loadingScreenEl.style.opacity = '1';
      }

      this._setLoadingProgressUI(
        8,
        lang === 'en-US'
          ? 'POSITIONING OPERATOR & SYNCING METROPOLIS...'
          : 'POSICIONANDO OPERADOR & SINCRONIZANDO METRÓPOLE...'
      );

      const nextFrame = (fn, delay = 28) => setTimeout(() => requestAnimationFrame(fn), delay);

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

      // ETAPA 1 (0% -> 24%): Inicializa Motor WebGL + Cidade 3D sob demanda, Save, Herói, Corações e Matrizes
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
          24,
          lang === 'en-US'
            ? 'POPULATING SIDEWALKS, TRAFFIC & CITY LIFE...'
            : 'POPULANDO CALÇADAS, TRÂNSITO & VIDA URBANA...'
        );

        // ETAPA 2 (24% -> 46%): Aquecimento da simulação das facções, carros e partículas
        nextFrame(() => {
          safeWarmup('simulate_entities', 0);
          this._setLoadingProgressUI(
            48,
            lang === 'en-US'
              ? 'COMPILING 3D WEBGL SHADERS & GPU TEXTURES...'
              : 'COMPILANDO SHADERS 3D & TEXTURAS NA PLACA DE VÍDEO...'
          );

          // ETAPA 3 (48% -> 68%): Compilação explícita de Shaders WebGL na GPU
          nextFrame(() => {
            safeWarmup('compile_shaders', 0);
            this._setLoadingProgressUI(
              68,
              lang === 'en-US'
                ? 'RENDERING 360° ANTI-STUTTER WARM-UP FRAMES (1/8)...'
                : 'RENDERIZANDO FRAMES DE AQUECIMENTO 360° ANTI-LAG (1/8)...'
            );

            // ETAPA 4 (68% -> 96%): Renderiza 8 direções (0°..315°) para carregar toda a geometria na VRAM!
            const runAngleStep = (angleIdx) => {
              if (angleIdx < 8) {
                safeWarmup('render_360', angleIdx);
                const pct = 68 + Math.round(((angleIdx + 1) / 8) * 28);
                this._setLoadingProgressUI(
                  pct,
                  lang === 'en-US'
                    ? `RENDERING 360° ANTI-STUTTER WARM-UP FRAMES (${angleIdx + 1}/8)...`
                    : `RENDERIZANDO FRAMES DE AQUECIMENTO 360° ANTI-LAG (${angleIdx + 1}/8)...`
                );
                nextFrame(() => runAngleStep(angleIdx + 1), 22);
                return;
              }

              // ETAPA 5 (100%): Restaura câmera, zera dt e libera o jogo a 60 FPS!
              safeWarmup('finish', 0);
              this._setLoadingProgressUI(
                100,
                lang === 'en-US'
                  ? 'ALL SYSTEMS READY! ENTERING METROPOLIS...'
                  : 'TUDO PRONTO! ENTRANDO NA METRÓPOLE...'
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
              }, 140);
            };

            nextFrame(() => runAngleStep(0), 25);
          });
        });
      });
    }
  });
}
