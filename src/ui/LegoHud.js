import { soundFX } from '../audio/SoundFX.js';
import { TikTokRadioSystem, getTrackCoverUrl } from '../audio/TikTokRadioSystem.js';
import { renderMinimapRadar } from './MinimapRenderer.js';
import { getSvgIcon } from './TacticalIcons.js';
import {
  populateFullMapSidebar,
  bindFullMapInteractions,
  renderFullMapCanvas
} from './TacticalMapModal.js';
import {
  HERO_CATALOG,
  getHeroInfo,
  syncOp09CatalogSlot,
  drawHeroLegoPortrait,
  renderHeroDossierModal,
  renderHeroWheelCanvas
} from './HeroWheelAndDossier.js';
import {
  CustomHeroCreatorStudio,
  createDefaultCustomHeroState,
  getActiveCustomHero,
  setActiveCustomHero
} from '../entities/CustomHeroSystem.js';
import {
  LegoCustomsStudio,
  createDefaultGarageSaveData,
  getActiveGarageSaveData,
  setActiveGarageSaveData
} from '../world/StreetCustomGarage.js';
import {
  FACTION_DATA,
  UI_TEXTS,
  getFactionLogoSvg,
  getFreeRoamLogoSvg,
  loadAllSaveSlots,
  writeSaveSlot,
  deleteSaveSlot,
  loadGameSettings,
  saveGameSettings
} from './FactionIconsAndSaveSystem.js';

/**
 * Gerencia a HUD Tática Urbana Angular Limpa (IDV LEGO: Cidade de Deus):
 * - Canto Superior Esquerdo Limpo: Retrato LEGO em moldura chanfrada 45° + Nome + 4 Corações + Studs
 * - Canto Superior Direito: Velocímetro Estilizado IDV (exibido apenas ao dirigir/pilotar veículos)
 * - Roda Tática de Seleção de Personagem Estilo GTA V [TAB] com Câmera Lenta, Filtro e Giro em WASD
 * - Ficha Tática Individual do Operador [H]
 * - Radar Local Dinâmico no canto inferior direito e Mapa Completo [M]
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
    this.hpBarWrapEl = document.getElementById('hud-hp-bar-wrap');
    this.hpBarFillEl = document.getElementById('hud-hp-bar-fill');
    this.hpBarTextEl = document.getElementById('hud-hp-bar-text');
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

    // Ficha Tática Individual [H]
    this.dossierModalEl = document.getElementById('hero-dossier-modal');
    this.dossierCloseBtn = document.getElementById('dossier-close-btn');
    this.isDossierOpen = false;

    // Roda de Seleção de Personagens Estilo GTA V [TAB]
    this.wheelOverlayEl = document.getElementById('hero-wheel-overlay');
    this.wheelCanvasEl = document.getElementById('hero-wheel-canvas');
    this.wheelTitleEl = document.getElementById('wheel-hero-title');
    this.wheelRoleEl = document.getElementById('wheel-hero-role');
    this.wheelSpecEl = document.getElementById('wheel-hero-spec');
    this.isHeroWheelOpen = false;
    this.wheelSelectedHeroKey = 'caveira';

    // Toast de Transição de Região
    this.regionToastEl = document.getElementById('region-toast');
    this.regionToastCodeEl = document.getElementById('region-toast-code');
    this.regionToastTitleEl = document.getElementById('region-toast-title');
    this.regionToastSubEl = document.getElementById('region-toast-sub');
    this._toastTimeout = null;
    this._hasInitializedRegion = false;

    // Elementos do Minimapa (Radar Local Dinâmico) e Mapa Completo [M]
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

    // Estado de Zoom e Pan do Mapa Completo [M]
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

  syncOp09UI() {
    const info = syncOp09CatalogSlot();
    if (this.currentHeroKey === 'op09') {
      this.setCharacterPortrait('op09', info.name);
    }
  }

  _initHearts() {
    if (!this.heartsContainer) return;
    this.heartsContainer.innerHTML = '';
    for (let i = 0; i < this.maxHearts; i++) {
      const heart = document.createElement('div');
      heart.className = 'lego-heart active';
      heart.innerHTML = `
        <svg viewBox="0 0 32 30" width="23" height="22">
          <polygon points="16,28 3,15 3,7 8,2 13,2 16,6 19,2 24,2 29,7 29,15"
            fill="#ef4444" stroke="#090a0d" stroke-width="2.6" stroke-linejoin="miter"/>
          <polygon points="8,5 12,5 14,8 6,12 6,7" fill="rgba(255,255,255,0.45)"/>
        </svg>
      `;
      this.heartsContainer.appendChild(heart);
    }
  }

  setHearts(activeCount) {
    this.hearts = Math.max(0, Math.min(this.maxHearts, Math.round(activeCount)));
    if (typeof this.heartsContainer?.querySelectorAll !== 'function') return;
    const nodes = this.heartsContainer.querySelectorAll('.lego-heart');
    nodes.forEach((node, idx) => {
      node.classList.toggle('active', idx < this.hearts);
    });
  }

  _initSpeedometerBars() {
    if (!this.speedoBarsEl) return;
    this.speedoBarsEl.innerHTML = '';
    this._speedoBarNodes = [];
    for (let i = 0; i < 14; i++) {
      const bar = document.createElement('div');
      bar.className = 'speedo-bar-seg';
      this.speedoBarsEl.appendChild(bar);
      this._speedoBarNodes.push(bar);
    }
  }

  /**
   * Atualiza o Scroll de Silhuetas Estilo CS no canto superior direito para o Vingador de Chumbo (OP-04)
   */
  updateVingadorWeaponHud(activeWeapon = this.currentVingadorWeapon, isFurorActive = this.isVingadorFuror) {
    this.currentVingadorWeapon = activeWeapon || 'dual_smg';
    this.isVingadorFuror = Boolean(isFurorActive);
    if (!this.vingadorWeaponHudEl) return;

    const shouldShow = this.currentHeroKey === 'vingador' && !this._isDrivingVehicle;
    this.vingadorWeaponHudEl.classList.toggle('hidden', !shouldShow);
    if (!shouldShow) return;

    this.vingadorWeaponHudEl.classList.toggle('furor-active', this.isVingadorFuror);

    const order = ['dual_smg', 'shotgun', 'rpg'];
    const activeIdx = Math.max(0, order.indexOf(this.currentVingadorWeapon));
    const prevWeapon = order[(activeIdx + order.length - 1) % order.length];
    const nextWeapon = order[(activeIdx + 1) % order.length];

    for (const slotEl of this.vingadorSlotEls) {
      const wKey = slotEl.dataset.weapon;
      slotEl.classList.remove('slot-prev', 'slot-active', 'slot-next');
      if (wKey === this.currentVingadorWeapon) {
        slotEl.classList.add('slot-active');
      } else if (wKey === prevWeapon) {
        slotEl.classList.add('slot-prev');
      } else if (wKey === nextWeapon) {
        slotEl.classList.add('slot-next');
      }
    }
  }

  /**
   * Atualiza o Velocímetro Estilizado IDV no canto superior direito (visível apenas quando em um veículo)
   */
  updateVehicleSpeedometer(vehicleObj, rawSpeed = 0, verticalSpeed = 0, isTurbo = false, isDrifting = false) {
    const wasDriving = this._isDrivingVehicle;
    this._isDrivingVehicle = Boolean(vehicleObj);
    if (wasDriving !== this._isDrivingVehicle) {
      this.updateVingadorWeaponHud();
    }

    if (!this.speedoContainerEl) return;

    if (!vehicleObj) {
      this.speedoContainerEl.classList.add('hidden');
      return;
    }

    this.speedoContainerEl.classList.remove('hidden');
    this.speedoContainerEl.classList.toggle('turbo-active', Boolean(isTurbo));
    this.speedoContainerEl.classList.toggle('drift-active', Boolean(isDrifting));

    const carName = vehicleObj.mesh?.userData?.carName || 'VEÍCULO TÁTICO';
    const spec = vehicleObj.mesh?.userData?.vehicleSpec || {};
    const category = spec.category || 'car';

    const totalSpeed = Math.hypot(rawSpeed, verticalSpeed || 0);
    const kmh = Math.round(totalSpeed * (45 / 14));
    const maxKmh = spec.kmh || 140;

    if (this.speedoNameEl) {
      this.speedoNameEl.textContent = carName.toUpperCase();
    }
    if (this.speedoKmhEl) {
      this.speedoKmhEl.textContent = String(kmh).padStart(3, '0');
    }

    if (this.speedoGearEl) {
      let gear = 'N';
      if (category === 'helicopter' || category === 'plane') {
        gear = 'AIR';
      } else if (category === 'boat') {
        gear = rawSpeed < -0.5 ? 'R' : kmh > 2 ? 'NAV' : 'N';
      } else if (rawSpeed < -0.5) {
        gear = 'R';
      } else if (kmh > 1) {
        const gearNum = Math.min(6, Math.max(1, Math.ceil((kmh / maxKmh) * 6)));
        gear = `D${gearNum}`;
      }
      this.speedoGearEl.textContent = gear;
    }

    if (this.speedoModeEl) {
      if (isTurbo) {
        this.speedoModeEl.textContent = 'NITRO // ATIVO';
      } else if (isDrifting) {
        this.speedoModeEl.textContent = 'DRIFT // TÁTICO';
      } else if (category === 'helicopter' || category === 'plane') {
        this.speedoModeEl.textContent = 'PROPULSÃO AÉREA';
      } else if (category === 'boat') {
        this.speedoModeEl.textContent = 'PROPULSÃO NAVAL';
      } else {
        this.speedoModeEl.textContent = 'TRAÇÃO URBANA';
      }
    }

    if (this._speedoBarNodes.length > 0) {
      const ratio = Math.min(1, kmh / Math.max(60, maxKmh));
      const litCount = kmh > 1 ? Math.max(1, Math.round(ratio * this._speedoBarNodes.length)) : 0;
      this._speedoBarNodes.forEach((bar, idx) => {
        const active = idx < litCount;
        bar.classList.toggle('lit', active);
        bar.classList.toggle('high', active && idx >= 9 && idx < 12);
        bar.classList.toggle('redline', active && idx >= 12);
      });
    }
  }

  addStuds(amount, colorName = 'silver') {
    this.totalStuds += amount;

    if (this.studCoinEl) {
      this.studCoinEl.dataset.tier = colorName;
      this.studCoinEl.classList.remove('pop');
      void this.studCoinEl.offsetWidth;
      this.studCoinEl.classList.add('pop');
    }

    if (this.studGainEl) {
      this.studGainEl.textContent = `+${amount.toLocaleString('pt-BR')}`;
      this.studGainEl.dataset.tier = colorName;
      this.studGainEl.classList.add('show');
      clearTimeout(this._gainTimeout);
      this._gainTimeout = setTimeout(() => {
        this.studGainEl.classList.remove('show');
      }, 1100);
    }
  }

  setCharacterPortrait(presetKey, displayName) {
    this.currentHeroKey = presetKey;
    const info = getHeroInfo(presetKey);
    if (this.charNameEl) {
      this.charNameEl.textContent = (displayName || info.name).toUpperCase();
    }
    if (this.opTagEl) {
      this.opTagEl.textContent = info.opCode;
    }
    if (this.crosshairEl) {
      this.crosshairEl.dataset.hero = presetKey;
    }
    if (this.portraitCanvas) {
      const ctx = this.portraitCanvas.getContext('2d');
      drawHeroLegoPortrait(ctx, this.portraitCanvas.width, this.portraitCanvas.height, presetKey);
    }
    this.updateVingadorWeaponHud();
    if (this.isDossierOpen) {
      renderHeroDossierModal(this, presetKey);
    }
  }

  /**
   * Abre/Fecha a Ficha Tática Individual [H] do personagem que o jogador está usando
   */
  setHeroDossierOpen(open, controller = null) {
    if (open && (this.isCreatorOpen || this.isCustomsOpen)) return;
    if (controller) {
      this._lastController = controller;
    }
    this.isDossierOpen = Boolean(open);
    if (this.dossierModalEl) {
      this.dossierModalEl.classList.toggle('hidden', !this.isDossierOpen);
    }
    if (this.isDossierOpen) {
      this._lastController?.resetHeldInputs?.();
      if (this.isFullMapOpen) this.setFullMapOpen(false);
      if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
      if (this.isTikTokRadioOpen) this.setTikTokRadioOpen(false);
      const activeKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira';
      renderHeroDossierModal(this, activeKey);
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } else if (this._lastController && typeof this._lastController.relockPointer === 'function') {
      this._lastController.relockPointer();
    }
  }

  toggleHeroDossier(controller = null) {
    this.setHeroDossierOpen(!this.isDossierOpen, controller);
  }

  /**
   * Abre/Fecha a Roda de Seleção de Personagem Estilo GTA V [TAB] com câmera lenta e filtro tático
   */
  setHeroWheelOpen(open, controller = null, confirmSelection = true) {
    if (open && (this.isCreatorOpen || this.isCustomsOpen)) return;
    if (controller) {
      this._lastController = controller;
    }
    const nextState = Boolean(open);
    if (this.isHeroWheelOpen === nextState) return;

    this.isHeroWheelOpen = nextState;
    document.body?.classList.toggle('hero-wheel-active', this.isHeroWheelOpen);

    if (this.wheelOverlayEl) {
      this.wheelOverlayEl.classList.toggle('hidden', !this.isHeroWheelOpen);
    }

    if (this.isHeroWheelOpen) {
      if (this.isFullMapOpen) this.setFullMapOpen(false);
      if (this.isDossierOpen) this.setHeroDossierOpen(false);
      if (this.isTikTokRadioOpen) this.setTikTokRadioOpen(false);
      const activeKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira';
      this.wheelSelectedHeroKey = activeKey;
      this._refreshHeroWheelDisplay();
      soundFX.playTacticalRoll();
    } else {
      if (confirmSelection && this._lastController && this.wheelSelectedHeroKey) {
        this._lastController.switchToHero(this.wheelSelectedHeroKey);
      }
      if (this._lastController && typeof this._lastController.relockPointer === 'function') {
        this._lastController.relockPointer();
      }
    }
  }

  /**
   * Gira a seleção na Roda de Personagens (+1 horário ou -1 anti-horário) via WASD
   */
  stepHeroWheelSelection(stepDelta = 1) {
    if (!this.isHeroWheelOpen) return;
    syncOp09CatalogSlot();
    const idx = HERO_CATALOG.findIndex((h) => h.key === this.wheelSelectedHeroKey);
    const nextIdx = (idx + stepDelta + HERO_CATALOG.length) % HERO_CATALOG.length;
    const nextHero = HERO_CATALOG[nextIdx];
    if (nextHero && nextHero.key !== this.wheelSelectedHeroKey) {
      this.wheelSelectedHeroKey = nextHero.key;
      if (this._lastController) {
        this._lastController.switchToHero(this.wheelSelectedHeroKey);
      }
      soundFX.playHeroSwap();
      this._refreshHeroWheelDisplay();
    }
  }

  /**
   * Seleciona um setor da Roda de Personagens diretamente por vetor 2D (WASD combinado ou mouse)
   */
  setHeroWheelDirection(dx, dy) {
    if (!this.isHeroWheelOpen) return;
    if (Math.hypot(dx, dy) < 0.2) return;
    syncOp09CatalogSlot();
    // Ângulo a partir do Topo (0 rad no topo, crescendo em sentido horário)
    let angleFromTop = Math.atan2(dy, dx) + Math.PI / 2;
    if (angleFromTop < 0) angleFromTop += Math.PI * 2;
    const stepAngle = (Math.PI * 2) / HERO_CATALOG.length;
    const idx = Math.floor(((angleFromTop + stepAngle * 0.5) % (Math.PI * 2)) / stepAngle);
    const targetHero = HERO_CATALOG[idx];
    if (targetHero && targetHero.key !== this.wheelSelectedHeroKey) {
      this.wheelSelectedHeroKey = targetHero.key;
      if (this._lastController) {
        this._lastController.switchToHero(this.wheelSelectedHeroKey);
      }
      soundFX.playHeroSwap();
      this._refreshHeroWheelDisplay();
    }
  }

  _refreshHeroWheelDisplay() {
    const info = getHeroInfo(this.wheelSelectedHeroKey);
    const activeKey = this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey;
    renderHeroWheelCanvas(this.wheelCanvasEl, this.wheelSelectedHeroKey, activeKey);

    if (this.wheelTitleEl) {
      this.wheelTitleEl.textContent = `${info.opCode} // ${info.name}`;
      this.wheelTitleEl.style.color = info.accent;
    }
    if (this.wheelRoleEl) {
      this.wheelRoleEl.textContent = info.role;
    }
    if (this.wheelSpecEl) {
      this.wheelSpecEl.textContent = info.specialty;
    }
  }

  showRegionTransitionToast(region) {
    if (!this.regionToastEl) return;
    if (!this.settings?.showRegionToast || this.isTitleScreenActive || this.isLoadingActive) {
      this.regionToastEl.classList.add('hidden');
      return;
    }
    if (!region) return;

    if (this.regionToastCodeEl) this.regionToastCodeEl.textContent = `SETOR ${region.code || 'R-01'}`;
    if (this.regionToastTitleEl) this.regionToastTitleEl.textContent = region.name || '';
    if (this.regionToastSubEl) this.regionToastSubEl.textContent = region.subtitle || '';

    this.regionToastEl.classList.remove('hidden');
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.regionToastEl?.classList.add('hidden');
    }, 2600);
  }

  /**
   * Atualiza o Painel de Estrelas de Procurado LEGO (0★ = 100% oculto; 1–5★ = Dourado/Piscante; Fuga = Piscando Azul/Cinza)
   */
  updateWantedHud(stars = 0, isEscaping = false, escapeTimer = 0, escapeDuration = 18.0, tierInfo = null) {
    this.wantedStars = Math.max(0, Math.min(5, Math.floor(stars)));
    this.wantedIsEscaping = Boolean(isEscaping && this.wantedStars > 0);

    if (!this.wantedPanelEl) return;

    if (this.wantedStars <= 0) {
      this.wantedPanelEl.classList.add('hidden');
      this.wantedPanelEl.classList.remove('escaping-mode', 'antihero-mode');
      return;
    }

    this.wantedPanelEl.classList.remove('hidden');
    this.wantedPanelEl.classList.toggle('escaping-mode', this.wantedIsEscaping);
    this.wantedPanelEl.classList.toggle(
      'antihero-mode',
      this.wantedStars >= 5 && !this.wantedIsEscaping
    );

    if (this.wantedStarNodes.length > 0) {
      this.wantedStarNodes.forEach((node, idx) => {
        node.classList.toggle('active', idx < this.wantedStars);
      });
    }

    if (this.wantedStatusTagEl) {
      if (this.wantedIsEscaping) {
        this.wantedStatusTagEl.textContent = 'DESPISTANDO... // SEM VISÃO';
      } else if (this.wantedStars >= 5) {
        this.wantedStatusTagEl.textContent = '5★ // CAÇADORES ANTI-HERÓI';
      } else {
        this.wantedStatusTagEl.textContent = `PROCURADO // ${tierInfo?.label || 'CERCO POLICIAL'}`;
      }
    }

    if (this.wantedEscapeWrapEl) {
      this.wantedEscapeWrapEl.classList.toggle('hidden', !this.wantedIsEscaping);
      if (this.wantedIsEscaping) {
        const pct = Math.max(0, Math.min(100, (escapeTimer / Math.max(1, escapeDuration)) * 100));
        const remSec = Math.max(1, Math.ceil(escapeDuration - escapeTimer));
        if (this.wantedEscapeFillEl) {
          this.wantedEscapeFillEl.style.width = `${pct.toFixed(1)}%`;
        }
        if (this.wantedEscapeSecEl) {
          this.wantedEscapeSecEl.textContent = `${remSec}s`;
        }
      }
    }
  }

  showWantedBanner(title, subtitle = '', variant = 'pursuit', durationMs = 3100) {
    if (!this.wantedBannerEl) return;
    if (this.isTitleScreenActive || this.isLoadingActive) return;

    this.wantedBannerEl.dataset.variant = variant;
    if (this.wantedBannerTitleEl) this.wantedBannerTitleEl.textContent = title || '';
    if (this.wantedBannerSubEl) this.wantedBannerSubEl.textContent = subtitle || '';
    this.wantedBannerEl.classList.remove('hidden');

    if (this._wantedBannerTimeout) clearTimeout(this._wantedBannerTimeout);
    this._wantedBannerTimeout = setTimeout(() => {
      this.wantedBannerEl?.classList.add('hidden');
    }, durationMs);
    if (typeof this._wantedBannerTimeout?.unref === 'function') {
      this._wantedBannerTimeout.unref();
    }
  }

  /**
   * Desativado no Modo Livre para manter a tela limpa sem alertas de guerra.
   */
  showTacticalAlertToast(_code, _title, _subtitle = '', _accentColor = '#facc15', _icon = 'emergency', _durationMs = 3800) {
    return;
  }

  setFullMapOpen(open, world = null, controller = null) {
    if (open && (this.isCreatorOpen || this.isCustomsOpen)) return;
    if (controller) {
      this._lastController = controller;
    }
    this.isFullMapOpen = Boolean(open);
    if (this.fullmapModalEl) {
      this.fullmapModalEl.classList.toggle('hidden', !this.isFullMapOpen);
    }
    if (this.isFullMapOpen) {
      this._lastController?.resetHeldInputs?.();
      if (this.isDossierOpen) this.setHeroDossierOpen(false);
      if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
      if (this.isTikTokRadioOpen) this.setTikTokRadioOpen(false);
      const promptEl = document.getElementById('pointer-prompt');
      if (promptEl) {
        promptEl.classList.remove('visible');
      }
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
      if (world && this._lastController) {
        bindFullMapInteractions(this, world, this._lastController);
        populateFullMapSidebar(this, world, this._lastController);
        this.renderFullMap(world, this._lastController.position, this._lastController.facingAngle, this._lastController);
      }
    } else if (this._lastController && typeof this._lastController.relockPointer === 'function') {
      this._lastController.relockPointer();
    }
  }

  toggleFullMap(world, controller) {
    this.setFullMapOpen(!this.isFullMapOpen, world, controller);
  }

  _teleportPlayerTo(controller, target, label = 'SETOR SELECIONADO') {
    if (!controller || !target) return;
    this.setFullMapOpen(false);

    if (typeof controller.startFastTravel === 'function') {
      controller.startFastTravel(target, label);
    } else {
      if (controller.currentVehicle) {
        controller.exitVehicle();
      }
      controller.position.set(target.x, target.y, target.z);
      controller.velocity.set(0, 0, 0);
      controller.currentSpeed = 0;
      controller.isFlying = false;
      controller.isSupersonic = false;
      controller.isGrounded = true;
      if (controller.minifigure?.root) {
        controller.minifigure.root.position.copy(controller.position);
      }
    }
  }

  updateMinimap(
    playerPos,
    playerFacingYaw = 0,
    cameraYaw = 0,
    currentRegion = null,
    world = null,
    playerSpeed = 0,
    dt = 0.016
  ) {
    renderMinimapRadar(this, playerPos, playerFacingYaw, cameraYaw, currentRegion, world, playerSpeed, dt);
  }

  renderFullMap(world, playerPos, playerFacingYaw = 0) {
    renderFullMapCanvas(this, world, playerPos, playerFacingYaw);
  }

  _formatRadioTime(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  }

  _getSpotifySvgs() {
    if (!this._spotifySvgsCache) {
      this._spotifySvgsCache = {
        musicNote: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
        musicNoteSmall: `<svg class="spotify-inline-svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
        heartOutline: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
        heartFilled: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="15" height="15" fill="#1ed760" stroke="#1ed760" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
        camera: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
        trash: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
        plus: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        refresh: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
        play: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"/></svg>`,
        pause: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
        pauseSmall: `<svg class="spotify-inline-svg" viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
        speakerSmall: `<svg class="spotify-inline-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
        bassWave: `<svg class="spotify-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
      };
    }
    return this._spotifySvgsCache;
  }

  _initTikTokRadioModal() {
    this.spotifyFilterMode = 'all'; // 'all' | 'liked' | 'custom'
    this.spotifySearchQuery = '';
    this._pendingCoverTrackId = null;

    this.tiktokModalEl = document.getElementById('tiktok-radio-modal');
    this.tiktokCloseBtn = document.getElementById('btn-tiktok-close');
    this.tiktokPrevBtn = document.getElementById('btn-tiktok-prev');
    this.tiktokPlayPauseBtn = document.getElementById('btn-tiktok-play-pause');
    this.tiktokNextBtn = document.getElementById('btn-tiktok-next');
    this.tiktokShuffleBtn = document.getElementById('btn-tiktok-shuffle');
    this.spotifyRepeatBtn = document.getElementById('btn-spotify-repeat');
    this.tiktokBassBoostBtn = document.getElementById('btn-tiktok-bass-boost');
    this.tiktokVolSlider = document.getElementById('slider-tiktok-vol');
    this.tiktokVolValEl = document.getElementById('val-tiktok-vol');
    this.tiktokTrackListEl = document.getElementById('tiktok-track-list');
    this.tiktokNowTitleEl = document.getElementById('tiktok-now-playing-title');
    this.tiktokNowMetaEl = document.getElementById('tiktok-now-playing-meta');
    this.tiktokNowStatusEl = document.getElementById('tiktok-now-status-badge');
    this.tiktokImportBtn = document.getElementById('btn-tiktok-import-mp3');
    this.tiktokFileInput = document.getElementById('input-tiktok-mp3-file');
    this.spotifyCoverInput = document.getElementById('input-spotify-cover-file');
    this.tiktokHudPillEl = document.getElementById('hud-tiktok-radio-pill');
    this.hudSpotifyDiscImg = document.getElementById('hud-spotify-disc-img');
    this.hudSpotifyMarqueeTitleEl = document.getElementById('hud-spotify-marquee-title');
    this.tiktokToastEl = document.getElementById('tiktok-radio-toast');
    this.tiktokToastTitleEl = document.getElementById('tiktok-toast-title');

    // Elementos exclusivos da interface Spotify Desktop
    this.spotifyFilterAllBtn = document.getElementById('btn-spotify-filter-all');
    this.spotifyFilterLikedBtn = document.getElementById('btn-spotify-filter-liked');
    this.spotifyFilterCustomBtn = document.getElementById('btn-spotify-filter-custom');
    this.spotifyFeaturedCoverImg = document.getElementById('spotify-featured-cover-img');
    this.spotifyHeroCoverImg = document.getElementById('spotify-hero-cover-img');
    this.spotifyBottomCoverImg = document.getElementById('spotify-bottom-cover-img');
    this.spotifyChangeCurrentCoverBtn = document.getElementById('btn-spotify-change-current-cover');
    this.spotifyClearAllBtn = document.getElementById('btn-spotify-clear-all');
    this.spotifyRestoreDefaultsBtn = document.getElementById('btn-spotify-restore-defaults');
    this.spotifyHeroBannerEl = document.getElementById('spotify-playlist-hero');
    this.spotifyCountBadgeEl = document.getElementById('spotify-playlist-count-badge');
    this.spotifySearchInput = document.getElementById('input-spotify-search');
    this.spotifyBottomTitleEl = document.getElementById('spotify-bottom-title');
    this.spotifyBottomArtistEl = document.getElementById('spotify-bottom-artist');
    this.spotifyLikeCurrentBtn = document.getElementById('btn-spotify-like-current');
    this.spotifyCoverCurrentBtn = document.getElementById('btn-spotify-cover-current');
    this.spotifySeekSlider = document.getElementById('spotify-seek-slider');
    this.spotifyTimeCurEl = document.getElementById('spotify-time-cur');
    this.spotifyTimeDurEl = document.getElementById('spotify-time-dur');

    const setFilter = (mode) => {
      this.spotifyFilterMode = mode;
      this.refreshTikTokRadioUI();
    };
    this.spotifyFilterAllBtn?.addEventListener('click', () => setFilter('all'));
    this.spotifyFilterLikedBtn?.addEventListener('click', () => setFilter('liked'));
    this.spotifyFilterCustomBtn?.addEventListener('click', () => setFilter('custom'));

    this.spotifySearchInput?.addEventListener('input', (e) => {
      this.spotifySearchQuery = String(e.target?.value || '').trim().toLowerCase();
      this.refreshTikTokRadioUI();
    });

    const openCoverPickerForTrack = (trackId) => {
      const targetId = trackId || this.tiktokRadio?.currentTrack?.id;
      if (!targetId) return;
      this._pendingCoverTrackId = targetId;
      if (this.spotifyCoverInput) {
        this.spotifyCoverInput.value = '';
        this.spotifyCoverInput.click?.();
      }
    };

    this.spotifyChangeCurrentCoverBtn?.addEventListener('click', () => {
      openCoverPickerForTrack(this.tiktokRadio?.currentTrack?.id);
    });
    this.spotifyCoverCurrentBtn?.addEventListener('click', () => {
      openCoverPickerForTrack(this.tiktokRadio?.currentTrack?.id);
    });

    this.spotifyCoverInput?.addEventListener('change', (e) => {
      const file = e.target?.files?.[0];
      const targetId = this._pendingCoverTrackId || this.tiktokRadio?.currentTrack?.id;
      if (file && targetId) {
        this.tiktokRadio.setTrackCoverFromFile(targetId, file);
      }
    });

    this.spotifyClearAllBtn?.addEventListener('click', () => {
      this.tiktokRadio.clearAllTracks();
    });

    this.spotifyRestoreDefaultsBtn?.addEventListener('click', () => {
      this.tiktokRadio.restoreDefaultTracks();
    });

    this.spotifyLikeCurrentBtn?.addEventListener('click', () => {
      if (this.tiktokRadio?.currentTrack) {
        this.tiktokRadio.toggleLikeTrack(this.tiktokRadio.currentTrack.id);
      }
    });

    this.tiktokCloseBtn?.addEventListener('click', () => {
      this.setTikTokRadioOpen(false, this._lastController);
    });
    this.tiktokHudPillEl?.addEventListener('click', () => {
      this.toggleTikTokRadioModal(this._lastController);
    });
    this.tiktokPrevBtn?.addEventListener('click', () => {
      this.tiktokRadio.prevTrack(false);
    });
    this.tiktokPlayPauseBtn?.addEventListener('click', () => {
      this.tiktokRadio.togglePlayPause();
    });
    this.tiktokNextBtn?.addEventListener('click', () => {
      this.tiktokRadio.nextTrack(false);
    });
    this.tiktokShuffleBtn?.addEventListener('click', () => {
      this.tiktokRadio.toggleShuffle();
    });
    this.spotifyRepeatBtn?.addEventListener('click', () => {
      this.tiktokRadio.toggleRepeatOne();
    });
    this.tiktokBassBoostBtn?.addEventListener('click', () => {
      this.tiktokRadio.toggleBassBoost();
    });

    if (this.spotifySeekSlider) {
      this.spotifySeekSlider.addEventListener('input', (e) => {
        const val = Math.max(0, Math.min(1000, Number(e.target.value) || 0));
        this.tiktokRadio.seekToRatio(val / 1000);
        this._syncSpotifyTimeBar();
      });
    }

    if (this.tiktokVolSlider) {
      this.tiktokVolSlider.addEventListener('input', (e) => {
        const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
        this.tiktokRadio.setVolume(pct / 100);
      });
    }

    this.tiktokImportBtn?.addEventListener('click', () => {
      if (this.tiktokFileInput) {
        this.tiktokFileInput.value = '';
        this.tiktokFileInput.click?.();
      }
    });

    this.tiktokFileInput?.addEventListener('change', (e) => {
      const files = e.target?.files;
      if (files && files.length > 0) {
        this.tiktokRadio.importLocalAudioFiles(files);
      }
    });

    this.refreshTikTokRadioUI();
  }

  _syncSpotifyTimeBar() {
    if (!this.tiktokRadio) return;
    const info = this.tiktokRadio.getPlaybackTimeInfo();
    if (this.spotifyTimeCurEl) {
      this.spotifyTimeCurEl.textContent = this._formatRadioTime(info.currentSec);
    }
    if (this.spotifyTimeDurEl) {
      this.spotifyTimeDurEl.textContent = this._formatRadioTime(info.durationSec);
    }
    if (this.spotifySeekSlider) {
      this.spotifySeekSlider.value = String(Math.round((info.ratio || 0) * 1000));
    }
  }

  _setMarqueeText(el, text, charThreshold = 20, forceScroll = false) {
    if (!el) return;
    const raw = String(text || '');
    const shouldScroll = Boolean(raw) && (forceScroll || raw.length > charThreshold);
    const cacheKey = `${raw}::${shouldScroll ? 1 : 0}`;
    if (el._lastMarqueeKey === cacheKey) return;
    el._lastMarqueeKey = cacheKey;

    if (!shouldScroll) {
      el.classList.remove('is-scrolling');
      el.textContent = raw;
      if (raw && typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
          if (el._lastMarqueeKey !== cacheKey) return;
          if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 4) {
            el._lastMarqueeKey = '';
            this._setMarqueeText(el, raw, 0, true);
          }
        });
      }
      return;
    }

    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const durSec = Math.max(7.5, Math.min(22, raw.length * 0.28)).toFixed(1);
    el.classList.add('is-scrolling');
    el.innerHTML = `<span class="spotify-marquee-track" data-marquee="${escaped}" style="--marquee-dur:${durSec}s"><span class="spotify-marquee-copy">${escaped}</span></span>`;
  }

  setTikTokRadioOpen(open, controller = null) {
    if (open && (this.isCreatorOpen || this.isCustomsOpen || this.isTitleScreenActive)) return;
    if (controller) {
      this._lastController = controller;
    }
    this.isTikTokRadioOpen = Boolean(open);
    document.body?.classList.toggle('tiktok-radio-open', this.isTikTokRadioOpen);
    if (this.tiktokModalEl) {
      this.tiktokModalEl.classList.toggle('hidden', !this.isTikTokRadioOpen);
    }

    if (this.isTikTokRadioOpen) {
      this._lastController?.resetHeldInputs?.();
      if (this.isFullMapOpen) this.setFullMapOpen(false);
      if (this.isDossierOpen) this.setHeroDossierOpen(false);
      if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
      const promptEl = document.getElementById('pointer-prompt');
      if (promptEl) promptEl.classList.remove('visible');
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
      this.refreshTikTokRadioUI();
    } else if (this._lastController && typeof this._lastController.relockPointer === 'function') {
      this._lastController.relockPointer();
    }
  }

  toggleTikTokRadioModal(controller = null) {
    this.setTikTokRadioOpen(!this.isTikTokRadioOpen, controller);
  }

  showTikTokRadioToast(track = this.tiktokRadio?.currentTrack) {
    if (!this.tiktokToastEl || !track) return;
    if (this.tiktokToastTitleEl) {
      this.tiktokToastTitleEl.textContent = `${track.title} (${track.bpm} BPM)`;
    }
    this.tiktokToastEl.classList.remove('hidden');
    if (this._tiktokToastTimeout) clearTimeout(this._tiktokToastTimeout);
    this._tiktokToastTimeout = setTimeout(() => {
      this.tiktokToastEl?.classList.add('hidden');
    }, 3200);
    if (typeof this._tiktokToastTimeout?.unref === 'function') {
      this._tiktokToastTimeout.unref();
    }
  }

  refreshTikTokRadioUI() {
    if (!this.tiktokRadio) return;
    const svgs = this._getSpotifySvgs();
    const track = this.tiktokRadio.currentTrack;
    const playing = this.tiktokRadio.isPlaying;
    const totalCount = this.tiktokRadio.tracks.length;
    const coverUrl = track ? getTrackCoverUrl(track) : getTrackCoverUrl({ id: 'empty', title: 'VAZIO', color: '#334155', bpm: 0, style: 'SEM FAIXAS' });

    // Filtros da Sidebar
    this.spotifyFilterAllBtn?.classList.toggle('active', this.spotifyFilterMode === 'all');
    this.spotifyFilterLikedBtn?.classList.toggle('active', this.spotifyFilterMode === 'liked');
    this.spotifyFilterCustomBtn?.classList.toggle('active', this.spotifyFilterMode === 'custom');

    // Capas sincronizadas (Sidebar 136x136, Banner Hero 112x112 e Player Inferior 56x56)
    if (this.spotifyFeaturedCoverImg) this.spotifyFeaturedCoverImg.src = coverUrl;
    if (this.spotifyHeroCoverImg) this.spotifyHeroCoverImg.src = coverUrl;
    if (this.spotifyBottomCoverImg) this.spotifyBottomCoverImg.src = coverUrl;

    if (this.spotifyHeroBannerEl) {
      const accent = track?.color || '#1ed760';
      this.spotifyHeroBannerEl.style.background = `linear-gradient(180deg, ${accent}47 0%, rgba(18, 18, 18, 0.95) 85%, #121212 100%)`;
    }
    if (this.spotifyCountBadgeEl) {
      this.spotifyCountBadgeEl.textContent = `${totalCount} ${totalCount === 1 ? 'música na playlist' : 'músicas na playlist'}`;
    }

    if (this.tiktokNowTitleEl) {
      this._setMarqueeText(
        this.tiktokNowTitleEl,
        track ? track.title : 'Playlist vazia — Adicione ou restaure músicas',
        26
      );
    }
    if (this.tiktokNowMetaEl) {
      this.tiktokNowMetaEl.textContent = track
        ? `${track.artist} • ${track.bpm} BPM • ${track.style}`
        : 'Use os botões da barra esquerda para importar MP3 ou restaurar as 8 originais';
    }
    if (this.tiktokNowStatusEl) {
      this.tiktokNowStatusEl.innerHTML =
        playing && track
          ? `${svgs.speakerSmall} <span>Tocando Agora</span>`
          : `${svgs.pauseSmall} <span>Pausado</span>`;
      this.tiktokNowStatusEl.classList.toggle('playing', Boolean(playing && track));
    }

    if (this.spotifyBottomTitleEl) {
      this._setMarqueeText(
        this.spotifyBottomTitleEl,
        track ? track.title : 'Nenhuma música selecionada',
        18
      );
    }
    if (this.spotifyBottomArtistEl) {
      this.spotifyBottomArtistEl.textContent = track ? track.artist : 'Spotify // [P]';
    }
    if (this.spotifyLikeCurrentBtn) {
      const isLiked = Boolean(track?.liked);
      this.spotifyLikeCurrentBtn.classList.toggle('liked', isLiked);
      this.spotifyLikeCurrentBtn.innerHTML = isLiked ? svgs.heartFilled : svgs.heartOutline;
    }

    if (this.tiktokPlayPauseBtn) {
      this.tiktokPlayPauseBtn.innerHTML = playing ? svgs.pause : svgs.play;
    }
    if (this.tiktokShuffleBtn) {
      this.tiktokShuffleBtn.classList.toggle('active', Boolean(this.tiktokRadio.isShuffle));
    }
    if (this.spotifyRepeatBtn) {
      this.spotifyRepeatBtn.classList.toggle('active', Boolean(this.tiktokRadio.isRepeatOne));
    }
    if (this.tiktokBassBoostBtn) {
      const bb = this.tiktokRadio.isBassBoostActive;
      this.tiktokBassBoostBtn.classList.toggle('active', bb);
      this.tiktokBassBoostBtn.innerHTML = `${svgs.bassWave} <span>Bass +6dB: ${bb ? 'ON' : 'OFF'}</span>`;
    }
    if (this.tiktokVolValEl) {
      this.tiktokVolValEl.textContent = `${Math.round(this.tiktokRadio.volume * 100)}%`;
    }
    if (this.tiktokVolSlider) {
      this.tiktokVolSlider.value = String(Math.round(this.tiktokRadio.volume * 100));
    }
    const isHudPlaying = Boolean(playing && track);
    if (this.tiktokHudPillEl) {
      this.tiktokHudPillEl.classList.toggle('playing', isHudPlaying);
    }
    if (this.hudSpotifyDiscImg) {
      if (isHudPlaying && this.hudSpotifyDiscImg._lastSrc !== coverUrl) {
        this.hudSpotifyDiscImg._lastSrc = coverUrl;
        this.hudSpotifyDiscImg.src = coverUrl;
      }
    }
    if (this.hudSpotifyMarqueeTitleEl) {
      if (isHudPlaying) {
        this._setMarqueeText(this.hudSpotifyMarqueeTitleEl, track.title, 0, true);
      } else {
        this._setMarqueeText(this.hudSpotifyMarqueeTitleEl, '', 999, false);
      }
    }

    this._syncSpotifyTimeBar();

    if (this.tiktokTrackListEl) {
      const q = this.spotifySearchQuery || '';
      const filtered = this.tiktokRadio.tracks
        .map((t, idx) => ({ t, idx }))
        .filter(({ t }) => {
          if (this.spotifyFilterMode === 'liked' && !t.liked) return false;
          if (this.spotifyFilterMode === 'custom' && !t.isCustomFile) return false;
          if (q) {
            const hay = `${t.title} ${t.artist} ${t.style}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });

      if (filtered.length === 0) {
        const emptyMsg =
          totalCount === 0
            ? 'Sua playlist está vazia! Você removeu todas as músicas.'
            : this.spotifyFilterMode === 'liked'
              ? 'Você ainda não curtiu nenhuma música.'
              : this.spotifyFilterMode === 'custom'
                ? 'Você ainda não importou nenhum arquivo MP3 do seu PC.'
                : 'Nenhuma música encontrada para essa busca.';
        this.tiktokTrackListEl.innerHTML = `
          <div class="spotify-empty-state">
            <div class="spotify-empty-title">${svgs.musicNote} <span>${emptyMsg}</span></div>
            <div class="spotify-empty-actions">
              <button type="button" class="spotify-action-btn primary" data-spotify-empty-action="import">
                ${svgs.plus}
                <span>Adicionar Música (MP3)</span>
              </button>
              <button type="button" class="spotify-action-btn secondary" data-spotify-empty-action="restore">
                ${svgs.refresh}
                <span>Restaurar 8 Originais</span>
              </button>
            </div>
          </div>
        `;
        this.tiktokTrackListEl.querySelectorAll('button[data-spotify-empty-action]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.spotifyEmptyAction;
            if (act === 'import') {
              this.tiktokFileInput?.click?.();
            } else if (act === 'restore') {
              this.spotifyFilterMode = 'all';
              this.tiktokRadio.restoreDefaultTracks();
            }
          });
        });
        return;
      }

      this.tiktokTrackListEl.innerHTML = filtered
        .map(({ t, idx }) => {
          const isCurrent = idx === this.tiktokRadio.currentTrackIndex;
          const rowCover = getTrackCoverUrl(t);
          const numDisplay = isCurrent && playing ? svgs.speakerSmall : String(idx + 1).padStart(2, '0');
          return `
            <div class="spotify-track-row tiktok-track-item ${isCurrent ? 'active' : ''}" data-track-idx="${idx}" data-track-id="${t.id}">
              <span class="spotify-row-num">${numDisplay}</span>
              <div class="spotify-row-main">
                <img class="spotify-row-cover" src="${rowCover}" alt="Capa" />
                <div class="spotify-row-text">
                  <span class="spotify-row-title">${t.title}</span>
                  <span class="spotify-row-artist">${t.artist}</span>
                </div>
              </div>
              <span class="spotify-row-badge">${t.bpm} BPM • ${t.style}</span>
              <div class="spotify-row-actions">
                <button type="button" class="spotify-row-action-btn ${t.liked ? 'liked' : ''}" data-like-track-id="${t.id}" title="Curtir / Favoritar">
                  ${t.liked ? svgs.heartFilled : svgs.heartOutline}
                </button>
                <button type="button" class="spotify-row-action-btn photo-btn" data-cover-track-id="${t.id}" title="Escolher Foto de Capa">
                  ${svgs.camera}
                  <span>Foto</span>
                </button>
                <button type="button" class="spotify-row-action-btn delete-btn" data-remove-track-id="${t.id}" title="Remover Música da Playlist">
                  ${svgs.trash}
                </button>
              </div>
            </div>
          `;
        })
        .join('');

      // Clique na linha toca a música
      this.tiktokTrackListEl.querySelectorAll('.spotify-track-row[data-track-idx]').forEach((row) => {
        row.addEventListener('click', (e) => {
          if (e.target && typeof e.target.closest === 'function' && e.target.closest('.spotify-row-actions')) {
            return;
          }
          const idx = Number(row.dataset.trackIdx);
          this.tiktokRadio.playTrack(idx, false);
        });
      });

      // Botão Curtir na linha
      this.tiktokTrackListEl.querySelectorAll('button[data-like-track-id]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.tiktokRadio.toggleLikeTrack(btn.dataset.likeTrackId);
        });
      });

      // Botão Escolher Foto de Capa na linha
      this.tiktokTrackListEl.querySelectorAll('button[data-cover-track-id]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._pendingCoverTrackId = btn.dataset.coverTrackId;
          if (this.spotifyCoverInput) {
            this.spotifyCoverInput.value = '';
            this.spotifyCoverInput.click?.();
          }
        });
      });

      // Botão Remover Música na linha
      this.tiktokTrackListEl.querySelectorAll('button[data-remove-track-id]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.tiktokRadio.removeTrack(btn.dataset.removeTrackId);
        });
      });
    }
  }

  update(dt) {
    if (this.isTitleScreenActive) {
      this._renderFavelaBackgroundCanvas(dt);
    }
    if (this.isTitleScreenActive || this.isLoadingActive) {
      // Garante que nenhuma música da Rádio [P] continue tocando no Menu Inicial ou no Loading!
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

  /**
   * Atualiza a vida do jogador (250 HP) exclusivamente nos 4 Corações LEGO Clássicos
   */
  setPlayerHealth(hp, maxHp = 250, isHealing = false) {
    this.playerMaxHp = Math.max(1, maxHp);
    this.playerHp = Math.max(0, Math.min(this.playerMaxHp, Math.round(hp)));

    const activeHearts =
      this.playerHp <= 0
        ? 0
        : Math.max(0, Math.min(4, Math.ceil((this.playerHp / this.playerMaxHp) * 4)));
    this.setHearts(activeHearts);

    if (this.heartsContainer) {
      this.heartsContainer.classList.toggle('healing-pulse', Boolean(isHealing));
    }
  }

  setPlayerFaction(factionKey = 'cv', notifyWorld = true, conqueredTerritories = null) {
    const fData = FACTION_DATA[factionKey] || FACTION_DATA.cv;
    this.playerFaction = fData.id;
    if (notifyWorld && typeof this.onSelectFaction === 'function' && !this._isSyncingFaction) {
      this._isSyncingFaction = true;
      try {
        this.onSelectFaction(fData.id, conqueredTerritories);
      } finally {
        this._isSyncingFaction = false;
      }
    }
  }

  /**
   * Mantido como no-op para manter a tela limpa sem painéis de ameaça/boss no topo
   */
  updateWorldWarHud() {}

  /**
   * Inicializa a Tela Inicial Oficial na IDV do Jogo, Panorama da Favela 2D, Tela de Loading, Slots de Save e Pausa [ESC]
   */
  _initTitleScreenAndPauseMenu() {
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
    this.btnPauseTimeModeEl = document.getElementById('btn-pause-time-mode');
    this.btnPauseLangEl = document.getElementById('btn-pause-language');

    document.getElementById('hud-esc-hint-pill')?.addEventListener('click', () => {
      if (!this.isTitleScreenActive && !this.isLoadingActive) {
        this.setPauseMenuOpen(true, this._lastController);
      }
    });

    this._initFavelaBackgroundCanvas();

    // Aplica configurações salvas de áudio imediatamente
    soundFX.setVolumes({
      masterVolume: this.settings.masterVolume,
      musicVolume: this.settings.musicVolume,
      sfxVolume: this.settings.sfxVolume
    });

    // Botões do Menu Inicial
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

    // Sliders e Toggles do Modal de Opções / Pausa [ESC]
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
      saveGameSettings(this.settings);
    };

    this.sliderMasterEl?.addEventListener('input', onVolumeChange);
    this.sliderMusicEl?.addEventListener('input', onVolumeChange);
    this.sliderSfxEl?.addEventListener('input', onVolumeChange);

    this.btnToggleRegionToastEl?.addEventListener('click', () => {
      this.settings.showRegionToast = !this.settings.showRegionToast;
      if (!this.settings.showRegionToast && this.regionToastEl) {
        this.regionToastEl.classList.add('hidden');
      }
      saveGameSettings(this.settings);
      soundFX.playPlasticHit();
      this._refreshLanguageAndOptionsUI();
    });

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

    this._setTitleSubPanel('main');
    this._refreshLanguageAndOptionsUI();
  }

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
  }

  /**
   * Constrói o Cenário Panorâmico Ilustrado da Favela LEGO (Cidade de Deus) em 3 Camadas Parallax
   * para rodar leve a 60 FPS no fundo da Tela Inicial sem usar o motor 3D no fundo!
   */
  _initFavelaBackgroundCanvas() {
    this._favelaTime = 0;
    this._titleMouseX = 0;
    this._titleMouseY = 0;

    window.addEventListener('mousemove', (e) => {
      if (!this.isTitleScreenActive) return;
      this._titleMouseX = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      this._titleMouseY = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    });

    // Estrelas cintilantes no céu noturno
    this._favelaStars = Array.from({ length: 75 }, (_, i) => ({
      x: ((i * 73) % 100) / 100,
      y: ((i * 41) % 48) / 100,
      r: 1.0 + (i % 3) * 0.7,
      phase: i * 0.8
    }));

    // 3 Camadas de Barracos e Predinhos LEGO subindo o Morro da Cidade de Deus
    const brickPalette = [
      '#9a3412', // Tijolo baiano escuro
      '#b45309', // Tijolo ocre quente
      '#7f1d1d', // Vermelho favela
      '#1e3a8a', // Azul fachada
      '#ca8a04', // Amarelo ocre
      '#14532d', // Verde musgo
      '#334155', // Concreto aparente
      '#7c2d12'  // Terracota
    ];

    this._favelaLayers = [0, 1, 2].map((layerIdx) => {
      const count = layerIdx === 0 ? 38 : layerIdx === 1 ? 48 : 42;
      const houses = [];
      for (let i = 0; i < count; i++) {
        const u = i / count;
        // Formato de morro (mais alto nas laterais e centro-esquerda)
        const hillCurve =
          Math.sin(u * Math.PI) * 0.22 +
          Math.cos((u - 0.28) * Math.PI * 2.2) * 0.09 +
          (layerIdx === 0 ? 0.36 : layerIdx === 1 ? 0.24 : 0.12);
        const w = 0.032 + ((i * 17) % 5) * 0.008;
        const h = 0.065 + ((i * 23) % 6) * 0.022;
        const color =
          layerIdx === 0
            ? '#131629'
            : brickPalette[(i * 7 + layerIdx * 3) % brickPalette.length];
        const hasWaterTank = layerIdx > 0 && (i * 11) % 4 === 0;
        const hasAntenna = layerIdx > 0 && (i * 5) % 3 === 0;
        const winRows = 2 + (i % 3);
        const winCols = 2 + ((i + 1) % 2);
        houses.push({
          u: u - 0.04 + ((i * 13) % 7) * 0.003,
          hillCurve,
          w,
          h,
          color,
          hasWaterTank,
          hasAntenna,
          winRows,
          winCols,
          seed: i * 19 + layerIdx * 101
        });
      }
      return {
        parallax: (layerIdx + 1) * 14,
        houses
      };
    });

    // Fagulhas/Brasas douradas subindo na frente da favela
    this._favelaEmbers = Array.from({ length: 34 }, (_, i) => ({
      x: ((i * 53) % 100) / 100,
      y: ((i * 29) % 100) / 100,
      spdY: 0.03 + (i % 5) * 0.012,
      spdX: ((i % 3) - 1) * 0.01,
      size: 2 + (i % 3),
      color: i % 2 === 0 ? '#facc15' : '#ef4444'
    }));

    this._renderFavelaBackgroundCanvas(0.016);
  }

  _renderFavelaBackgroundCanvas(dt = 0.016) {
    const canvas = this.favelaCanvasEl;
    if (!canvas) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this._favelaTime += dt;
    const t = this._favelaTime;
    const px = this._titleMouseX;
    const py = this._titleMouseY;

    // 1. Céu Crepúsculo / Noturno Tático
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0.0, '#05070f');
    skyGrad.addColorStop(0.38, '#131636');
    skyGrad.addColorStop(0.72, '#3b1528');
    skyGrad.addColorStop(1.0, '#5c1f19');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Estrelas cintilantes
    for (const st of this._favelaStars) {
      const alpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.8 + st.phase));
      ctx.fillStyle = `rgba(248, 250, 252, ${alpha.toFixed(2)})`;
      ctx.fillRect(st.x * W + px * 4, st.y * H + py * 3, st.r * 2, st.r * 2);
    }

    // 3. Dois Feixes de Holofote Policial varrendo o céu atrás do Morro
    for (let b = 0; b < 2; b++) {
      const baseX = W * (b === 0 ? 0.24 : 0.76);
      const baseY = H * 0.85;
      const sway = Math.sin(t * (b === 0 ? 0.65 : 0.52) + b * 2.1) * 0.45;
      const topX = baseX + Math.sin(sway) * W * 0.42;
      const topY = -40;

      const beamGrad = ctx.createLinearGradient(baseX, baseY, topX, topY);
      beamGrad.addColorStop(0, 'rgba(250, 204, 21, 0.16)');
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(baseX - 18, baseY);
      ctx.lineTo(topX - 135, topY);
      ctx.lineTo(topX + 135, topY);
      ctx.lineTo(baseX + 18, baseY);
      ctx.closePath();
      ctx.fill();
    }

    // 4. As 3 Camadas do Morro da Favela LEGO (Cidade de Deus)
    this._favelaLayers.forEach((layer, lIdx) => {
      const offX = px * layer.parallax;
      const offY = py * (layer.parallax * 0.45);

      // Silhueta escura de terra do morro por baixo dos barracos
      ctx.fillStyle = lIdx === 0 ? '#0c0f1d' : lIdx === 1 ? '#111320' : '#090a0f';
      ctx.beginPath();
      ctx.moveTo(-60, H + 40);
      for (let step = 0; step <= 24; step++) {
        const u = step / 24;
        const hillY =
          H *
          (1.0 -
            (Math.sin(u * Math.PI) * 0.22 +
              (lIdx === 0 ? 0.36 : lIdx === 1 ? 0.24 : 0.12)));
        ctx.lineTo(u * (W + 120) - 60 + offX, hillY + offY);
      }
      ctx.lineTo(W + 60, H + 40);
      ctx.closePath();
      ctx.fill();

      // Desenha cada casinha/barraco LEGO empilhado no morro
      for (const h of layer.houses) {
        const bx = h.u * (W + 140) - 40 + offX;
        const bw = h.w * W;
        const bh = h.h * H;
        const by = H * (1.0 - h.hillCurve) - bh * 0.65 + offY;

        // Corpo do barraco LEGO + borda preta chanfrada
        ctx.fillStyle = h.color;
        ctx.fillRect(bx, by, bw, bh + 90);
        ctx.strokeStyle = '#090a0d';
        ctx.lineWidth = lIdx === 0 ? 1 : 2;
        ctx.strokeRect(bx, by, bw, bh + 90);

        // Pinos de LEGO (Studs) no topo da laje!
        const studCount = Math.max(2, Math.min(5, Math.floor(bw / 14)));
        const studW = Math.max(6, (bw / studCount) * 0.52);
        for (let s = 0; s < studCount; s++) {
          const sx = bx + (s + 0.24) * (bw / studCount);
          ctx.fillStyle = h.color;
          ctx.fillRect(sx, by - 5, studW, 5);
          ctx.strokeRect(sx, by - 5, studW, 5);
        }

        // Caixa d'água azul LEGO na laje
        if (h.hasWaterTank) {
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(bx + bw * 0.2, by - 14, bw * 0.42, 11);
          ctx.strokeRect(bx + bw * 0.2, by - 14, bw * 0.42, 11);
        }

        // Antena de TV na laje
        if (h.hasAntenna) {
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.75, by);
          ctx.lineTo(bx + bw * 0.75, by - 22);
          ctx.moveTo(bx + bw * 0.75 - 7, by - 17);
          ctx.lineTo(bx + bw * 0.75 + 7, by - 17);
          ctx.stroke();
        }

        // Janelinhas amarelas/laranjas acesas no morro!
        const winW = Math.max(4, bw / (h.winCols * 2.4));
        const winH = 6;
        for (let r = 0; r < h.winRows; r++) {
          for (let c = 0; c < h.winCols; c++) {
            const flicker = Math.sin(t * 1.4 + h.seed + r * 7 + c * 13);
            if (flicker < -0.35) continue;
            const wx = bx + ((c + 0.5) / h.winCols) * bw - winW * 0.5;
            const wy = by + 12 + r * 16;
            ctx.fillStyle = (h.seed + r + c) % 3 === 0 ? '#f97316' : '#facc15';
            ctx.fillRect(wx, wy, winW, winH);
          }
        }
      }
    });

    // 5. Postes e Fios Elétricos de Quebrada no 1º Plano + Lâmpadas de Rua com Halo
    const polePositions = [W * 0.11 + px * 26, W * 0.89 + px * 26];
    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 2.2;
    for (let wire = 0; wire < 3; wire++) {
      const yStart = H * (0.26 + wire * 0.035) + py * 12;
      ctx.beginPath();
      ctx.moveTo(0, yStart - 15);
      ctx.quadraticCurveTo(W * 0.5, yStart + 42, W, yStart - 10);
      ctx.stroke();
    }

    for (const poleX of polePositions) {
      ctx.fillStyle = '#07090e';
      ctx.fillRect(poleX - 6, H * 0.2, 12, H * 0.85);
      ctx.fillRect(poleX - 28, H * 0.23, 56, 7);

      // Lâmpada de rua amarela acesa
      const lampGlow = ctx.createRadialGradient(poleX, H * 0.24, 2, poleX, H * 0.24, 54);
      lampGlow.addColorStop(0, 'rgba(250, 204, 21, 0.85)');
      lampGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = lampGlow;
      ctx.beginPath();
      ctx.arc(poleX, H * 0.24, 54, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Fagulhas / Brasas Douradas Subindo
    for (const emb of this._favelaEmbers) {
      emb.y -= emb.spdY * dt;
      emb.x += emb.spdX * dt;
      if (emb.y < -0.05) emb.y = 1.05;
      if (emb.x < 0) emb.x = 1;
      if (emb.x > 1) emb.x = 0;
      ctx.fillStyle = emb.color;
      ctx.fillRect(emb.x * W, emb.y * H, emb.size, emb.size);
    }

    // Vinheta tática nas bordas para destacar a Logo e os Botões
    const vig = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.22, W * 0.5, H * 0.5, W * 0.72);
    vig.addColorStop(0, 'rgba(7, 9, 19, 0.18)');
    vig.addColorStop(1, 'rgba(5, 7, 14, 0.84)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  _toggleLanguage() {
    this.settings.language = this.settings.language === 'en-US' ? 'pt-BR' : 'en-US';
    saveGameSettings(this.settings);
    soundFX.playHeroSwap();
    this._refreshLanguageAndOptionsUI();
    this.setPlayerFaction(this.playerFaction, false);
  }

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

    if (this.btnPauseTimeModeEl) {
      const modeKey = this.settings.timeMode || 'auto';
      const modeLabels = t.timeModes || UI_TEXTS['pt-BR'].timeModes;
      this.btnPauseTimeModeEl.textContent = modeLabels[modeKey] || modeLabels.auto;
      this.btnPauseTimeModeEl.classList.add('active');
    }

    if (this.btnPauseLangEl) {
      this.btnPauseLangEl.textContent = lang === 'en-US' ? 'EN-US // ENGLISH' : 'PT-BR // PORTUGUÊS';
    }
  }

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
  }

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
          setActiveCustomHero(defaultCustom);
          setActiveGarageSaveData(defaultGarage);
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
            radioState: this.tiktokRadio ? this.tiktokRadio.exportSaveState() : null
          });
          this.startLoadingSequence(slotData, true);
        });
      });
    }
  }

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
  }

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

  saveCurrentProgress() {
    writeSaveSlot(this.activeSaveSlot || 0, {
      faction: FACTION_DATA[this.playerFaction] ? this.playerFaction : 'cv',
      studs: this.totalStuds || 0,
      heroKey: this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira',
      conqueredTerritories:
        typeof this.getConqueredTerritories === 'function' ? this.getConqueredTerritories() : [],
      customHero: { ...getActiveCustomHero() },
      customGarage: JSON.parse(JSON.stringify(getActiveGarageSaveData())),
      radioState: this.tiktokRadio ? this.tiktokRadio.exportSaveState() : null
    });
  }

  setPauseMenuOpen(open, controller = null, keepTitleState = false) {
    if (controller) {
      this._lastController = controller;
    }
    if (open && this.isCreatorOpen) {
      this.creatorStudio?.close(false);
    }
    if (open && this.isCustomsOpen) {
      this.customsStudio?.close(false);
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
  }

  togglePauseMenu(controller = null) {
    if (this.isTitleScreenActive || this.isLoadingActive) return;
    this.setPauseMenuOpen(!this.isPauseMenuOpen, controller);
  }
}
