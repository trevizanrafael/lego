import { TikTokRadioSystem } from '../audio/TikTokRadioSystem.js';
import { CustomHeroCreatorStudio } from '../entities/CustomHeroSystem.js';
import { LegoCustomsStudio } from '../world/StreetCustomGarage.js';
import { AircraftCustomStudio } from '../world/AircraftCustomGarage.js';
import { loadGameSettings } from './FactionIconsAndSaveSystem.js';
import { installHudConstantsAndPortraits } from './hud/HudConstantsAndPortraits.js';
import { installOperatorCombatAndVehicleHud } from './hud/OperatorCombatAndVehicleHud.js';
import { installHudMapAndWheelBridge } from './hud/HudMapAndWheelBridge.js';
import { installHudRadioModalBridge } from './hud/HudRadioModalBridge.js';
import { installTitleAndSaveSlotsController } from './hud/TitleAndSaveSlotsController.js';
import { installPauseAndSettingsController } from './hud/PauseAndSettingsController.js';

/**
 * Orquestrador da HUD Tática Urbana Angular Limpa (IDV LEGO: Cidade de Deus).
 * Submódulos especializados em `src/ui/hud/` instalam seus métodos no protótipo de `LegoHud`.
 */
export class LegoHud {
  constructor() {
    this.totalStuds = 0;
    this.displayedStuds = 0;
    this.hearts = 4;
    this.maxHearts = 4;
    this.playerHp = 250;
    this.playerMaxHp = 250;
    this.currentHeroKey = 'caveira';
    this.playerFaction = 'cv';
    this.activeSaveSlot = 0;
    this.pendingSlotIndex = 0;
    this.isTitleScreenActive = true;
    this.isLoadingActive = false;
    this.isPauseMenuOpen = false;
    this.settings = loadGameSettings();
    document.body?.classList.add('title-or-loading-active');

    this.studCountEl = document.getElementById('hud-stud-count');
    this.studGainEl = document.getElementById('hud-stud-gain');
    this.studCoinEl = document.getElementById('hud-stud-coin');
    this.charNameEl = document.getElementById('hud-char-name');
    this.opTagEl = document.getElementById('hud-op-tag');
    this.portraitCanvas = document.getElementById('hud-portrait-canvas');
    this.heartsContainer = document.getElementById('hud-hearts');
    this.operatorChassisEl = document.getElementById('lego-classic-hud');
    this.hpBarWrapEl = document.getElementById('hud-hp-bar-wrap');
    this.hpGhostFillEl = document.getElementById('hud-hp-ghost-fill');
    this.hpBarFillEl = document.getElementById('hud-hp-bar-fill');
    this.hpBarTextEl = document.getElementById('hud-hp-bar-text');
    this.abilityStripEl = document.getElementById('hud-ability-strip');
    this.factionBadgeEl = document.getElementById('hud-faction-badge');
    this.medicHealTagEl = document.getElementById('hud-medic-heal-tag');
    this.crosshairEl = document.getElementById('crosshair');

    // Painel Superior da Guerra Mundial de Facções & Bosses
    this.wwTitleEl = document.getElementById('ww-front-title');
    this.wwPctEl = document.getElementById('ww-escalation-pct');
    this.wwFillEl = document.getElementById('ww-escalation-fill');
    this.wwBossBarsContainerEl = document.getElementById('ww-boss-bars-container');

    // Velocímetro Tático no Canto Superior Direito (Apenas em Veículos)
    this.speedoContainerEl = document.getElementById('vehicle-speedometer');
    this.speedoNameEl = document.getElementById('speedo-vehicle-name');
    this.speedoGearEl = document.getElementById('speedo-gear-badge');
    this.speedoKmhEl = document.getElementById('speedo-kmh-val');
    this.speedoModeEl = document.getElementById('speedo-mode-tag');
    this.speedoBarsEl = document.getElementById('speedo-rpm-bars');
    this._speedoBarNodes = [];

    // Estrelas de Procurado LEGO Estilo GTA (1 a 5 Estrelas — 100% Ocultas em 0 Estrelas!)
    this.wantedPanelEl = document.getElementById('hud-wanted-panel');
    this.wantedStatusTagEl = document.getElementById('wanted-status-tag');
    this.wantedStarsRowEl = document.getElementById('wanted-stars-row');
    this.wantedStarNodes =
      typeof this.wantedStarsRowEl?.querySelectorAll === 'function'
        ? Array.from(this.wantedStarsRowEl.querySelectorAll('.wanted-lego-star'))
        : [];
    this.wantedEscapeWrapEl = document.getElementById('wanted-escape-bar-wrap');
    this.wantedEscapeFillEl = document.getElementById('wanted-escape-bar-fill');
    this.wantedEscapeSecEl = document.getElementById('wanted-escape-sec');
    this.wantedBannerEl = document.getElementById('wanted-event-banner');
    this.wantedBannerTitleEl = document.getElementById('wanted-banner-title');
    this.wantedBannerSubEl = document.getElementById('wanted-banner-sub');
    this._wantedBannerTimeout = null;
    this.wantedStars = 0;
    this.wantedIsEscaping = false;

    // Visor de Arsenal Estilo CS:GO no Canto Superior Direito (Exclusivo do Vingador de Chumbo a pé)
    this.vingadorWeaponHudEl = document.getElementById('vingador-weapon-hud');
    this.vingadorKeyhintEl = document.getElementById('vingador-hud-keyhint');
    this.vingadorSlotEls =
      typeof this.vingadorWeaponHudEl?.querySelectorAll === 'function'
        ? Array.from(this.vingadorWeaponHudEl.querySelectorAll('.csgo-weapon-slot'))
        : [];
    this.currentVingadorWeapon = 'dual_smg';
    this.isVingadorFuror = false;
    this._isDrivingVehicle = false;

    // Ficha Tática Individual [H] e Roda de Seleção [TAB]
    this.dossierModalEl = document.getElementById('hero-dossier-modal');
    this.dossierCloseBtn = document.getElementById('dossier-close-btn');
    this.isDossierOpen = false;
    this.wheelOverlayEl = document.getElementById('hero-wheel-overlay');
    this.wheelCanvasEl = document.getElementById('hero-wheel-canvas');
    this.wheelTitleEl = document.getElementById('wheel-hero-title');
    this.wheelRoleEl = document.getElementById('wheel-hero-role');
    this.wheelSpecEl = document.getElementById('wheel-hero-spec');
    this.isHeroWheelOpen = false;
    this.wheelSelectedHeroKey = 'caveira';

    // Toast de Transição de Região, Minimapa e Mapa Completo [M]
    this.regionToastEl = document.getElementById('region-toast');
    this.regionToastCodeEl = document.getElementById('region-toast-code');
    this.regionToastTitleEl = document.getElementById('region-toast-title');
    this.regionToastSubEl = document.getElementById('region-toast-sub');
    this._toastTimeout = null;
    this._hasInitializedRegion = false;

    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCompassNEl = document.getElementById('minimap-compass-n');
    this.minimapNumEl = document.getElementById('minimap-region-num');
    this.minimapNameEl = document.getElementById('minimap-region-name');
    this.minimapSubEl = document.getElementById('minimap-sub');
    this.minimapViewRadius = 175;

    this.fullmapModalEl = document.getElementById('fullmap-modal');
    this.fullmapCanvas = document.getElementById('fullmap-canvas');
    this.fullmapCloseBtn = document.getElementById('fullmap-close-btn');
    this.fullmapZoomInBtn = document.getElementById('fullmap-zoom-in');
    this.fullmapZoomOutBtn = document.getElementById('fullmap-zoom-out');
    this.fullmapResetBtn = document.getElementById('fullmap-reset-view');
    this.fullmapClearWpBtn = document.getElementById('fullmap-clear-wp');
    this.fullmapListEl = document.getElementById('fullmap-region-list');

    this.isFullMapOpen = false;
    this._lastRegionId = '';
    this.hoveredRegionId = null;
    this.mapZoom = 1.0;
    this.mapPanX = 0;
    this.mapPanY = 0;
    this._isDraggingMap = false;
    this._dragMoved = false;
    this._dragStartX = 0;
    this._dragStartY = 0;

    if (this.fullmapCloseBtn) {
      this.fullmapCloseBtn.addEventListener('click', () => {
        this.setFullMapOpen(false);
      });
    }
    if (this.dossierCloseBtn) {
      this.dossierCloseBtn.addEventListener('click', () => {
        this.setHeroDossierOpen(false);
      });
    }

    this._gainTimeout = null;
    this.creatorStudio = new CustomHeroCreatorStudio(this);
    this.customsStudio = new LegoCustomsStudio(this);
    this.aircraftStudio = new AircraftCustomStudio(this);
    this.tiktokRadio = new TikTokRadioSystem(this);
    this.isTikTokRadioOpen = false;
    this._tiktokToastTimeout = null;
    this._initHearts();
    this._initSpeedometerBars();
    this._initTikTokRadioModal();
    this._initTitleScreenAndPauseMenu();
    this.setCharacterPortrait('caveira', 'COMANDANTE CAVEIRA');
    this.setPlayerHealth(250, 250, false);
    this.setPlayerFaction(this.playerFaction);
  }

  get isCreatorOpen() {
    return Boolean(this.creatorStudio?.isOpen);
  }

  get isCustomsOpen() {
    return Boolean(this.customsStudio?.isOpen);
  }

  get isAircraftStudioOpen() {
    return Boolean(this.aircraftStudio?.isOpen);
  }

  update(dt) {
    if (this.isTitleScreenActive) {
      this._renderFavelaBackgroundCanvas(dt);
    }
    if (this.isTitleScreenActive || this.isLoadingActive) {
      if (this.tiktokRadio?.isPlaying) {
        this.tiktokRadio.stopAllPlayback();
      }
    } else if (this.tiktokRadio) {
      this.tiktokRadio.update(dt);
      if (this.isTikTokRadioOpen) {
        this._syncSpotifyTimeBar();
      }
    }
    if (this.displayedStuds < this.totalStuds) {
      const diff = this.totalStuds - this.displayedStuds;
      const step = Math.max(1, Math.ceil(diff * Math.min(1, dt * 16)));
      this.displayedStuds = Math.min(this.totalStuds, this.displayedStuds + step);
      if (this.studCountEl) {
        this.studCountEl.textContent = this.displayedStuds.toLocaleString('pt-BR');
      }
    }
  }
}

installHudConstantsAndPortraits(LegoHud);
installOperatorCombatAndVehicleHud(LegoHud);
installHudMapAndWheelBridge(LegoHud);
installHudRadioModalBridge(LegoHud);
installTitleAndSaveSlotsController(LegoHud);
installPauseAndSettingsController(LegoHud);
