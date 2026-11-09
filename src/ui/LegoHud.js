import { soundFX } from '../audio/SoundFX.js';
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
  drawHeroLegoPortrait,
  renderHeroDossierModal,
  renderHeroWheelCanvas
} from './HeroWheelAndDossier.js';
import {
  FACTION_DATA,
  UI_TEXTS,
  getFactionLogoSvg,
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
    this.isPauseMenuOpen = false;
    this.settings = loadGameSettings();

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

    // Visor de Arsenal Estilo CS:GO no Canto Superior Direito (Exclusivo do Vingador de Chumbo a pé)
    this.vingadorWeaponHudEl = document.getElementById('vingador-weapon-hud');
    this.vingadorKeyhintEl = document.getElementById('vingador-hud-keyhint');
    this.vingadorSlotEls = this.vingadorWeaponHudEl
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
    this._initHearts();
    this._initSpeedometerBars();
    this._initTitleScreenAndPauseMenu();
    this.setCharacterPortrait('caveira', 'COMANDANTE CAVEIRA');
    this.setPlayerHealth(250, 250, false);
    this.setPlayerFaction(this.playerFaction);
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
    this.hearts = Math.max(1, Math.min(this.maxHearts, Math.round(activeCount)));
    if (!this.heartsContainer) return;
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
    if (controller) {
      this._lastController = controller;
    }
    this.isDossierOpen = Boolean(open);
    if (this.dossierModalEl) {
      this.dossierModalEl.classList.toggle('hidden', !this.isDossierOpen);
    }
    if (this.isDossierOpen) {
      if (this.isFullMapOpen) this.setFullMapOpen(false);
      if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
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
    if (controller) {
      this._lastController = controller;
    }
    const nextState = Boolean(open);
    if (this.isHeroWheelOpen === nextState) return;

    this.isHeroWheelOpen = nextState;
    document.body.classList.toggle('hero-wheel-active', this.isHeroWheelOpen);

    if (this.wheelOverlayEl) {
      this.wheelOverlayEl.classList.toggle('hidden', !this.isHeroWheelOpen);
    }

    if (this.isHeroWheelOpen) {
      if (this.isFullMapOpen) this.setFullMapOpen(false);
      if (this.isDossierOpen) this.setHeroDossierOpen(false);
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
    if (!this.settings?.showRegionToast) {
      if (this.regionToastEl) this.regionToastEl.classList.add('hidden');
      return;
    }
    if (!this.regionToastEl || !region) return;
    const codeNum = region.num || String(region.number || 1).padStart(2, '0');
    const accent = region.color || '#facc15';
    if (this.regionToastCodeEl) {
      this.regionToastCodeEl.textContent = `SETOR R-${codeNum} // TRANSIÇÃO DE ZONA`;
    }
    if (this.regionToastTitleEl) {
      const iconSvg = getSvgIcon(region.icon || 'pin', accent, 18);
      this.regionToastTitleEl.innerHTML = `${iconSvg} <span>${region.name}</span>`;
    }
    if (this.regionToastSubEl) {
      this.regionToastSubEl.textContent = region.sub || region.shortName || '';
    }
    this.regionToastEl.style.borderLeftColor = accent;
    this.regionToastEl.classList.remove('hidden');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.regionToastEl.classList.add('hidden');
    }, 2500);
  }

  /**
   * Exibe um Alerta Tático Urbano no topo da tela (Eventos Dinâmicos, Comboio do Carro-Forte e Reforços de Facção)
   */
  showTacticalAlertToast(code, title, subtitle = '', accentColor = '#facc15', icon = 'emergency', durationMs = 3800) {
    if (!this.regionToastEl) return;
    if (this.regionToastCodeEl) {
      this.regionToastCodeEl.textContent = code;
      this.regionToastCodeEl.style.color = accentColor;
    }
    if (this.regionToastTitleEl) {
      const iconSvg = getSvgIcon(icon || 'emergency', accentColor, 18);
      this.regionToastTitleEl.innerHTML = `${iconSvg} <span>${title}</span>`;
    }
    if (this.regionToastSubEl) {
      this.regionToastSubEl.textContent = subtitle;
    }
    this.regionToastEl.style.borderLeftColor = accentColor;
    this.regionToastEl.classList.remove('hidden');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      this.regionToastEl.classList.add('hidden');
    }, durationMs);
  }

  setFullMapOpen(open, world = null, controller = null) {
    if (controller) {
      this._lastController = controller;
    }
    this.isFullMapOpen = Boolean(open);
    if (this.fullmapModalEl) {
      this.fullmapModalEl.classList.toggle('hidden', !this.isFullMapOpen);
    }
    if (this.isFullMapOpen) {
      if (this.isDossierOpen) this.setHeroDossierOpen(false);
      if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
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

  update(dt) {
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
   * Atualiza a Barra Numérica de 250 HP + 4 Corações LEGO + Indicador de Feixe Médico Aliado
   */
  setPlayerHealth(hp, maxHp = 250, isBeingHealed = false) {
    this.playerMaxHp = Math.max(1, maxHp);
    this.playerHp = Math.max(0, Math.min(this.playerMaxHp, Math.round(hp)));
    const ratio = this.playerHp / this.playerMaxHp;

    const heartCount = this.playerHp <= 0 ? 0 : Math.max(1, Math.ceil(ratio * this.maxHearts));
    this.setHearts(heartCount);

    if (this.hpBarFillEl) {
      this.hpBarFillEl.style.width = `${Math.round(ratio * 100)}%`;
      if (!isBeingHealed) {
        this.hpBarFillEl.style.background =
          ratio < 0.3
            ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)'
            : ratio < 0.65
              ? 'linear-gradient(90deg, #d97706 0%, #facc15 100%)'
              : 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)';
      }
    }
    if (this.hpBarWrapEl) {
      this.hpBarWrapEl.classList.toggle('healing', Boolean(isBeingHealed));
    }
    if (this.hpBarTextEl) {
      this.hpBarTextEl.textContent = `${this.playerHp} / ${this.playerMaxHp} HP`;
    }
    if (this.medicHealTagEl) {
      const lang = this.settings?.language || 'pt-BR';
      this.medicHealTagEl.textContent = UI_TEXTS[lang]?.medicHealing || UI_TEXTS['pt-BR'].medicHealing;
      this.medicHealTagEl.classList.toggle('hidden', !isBeingHealed);
    }
  }

  setPlayerFaction(factionKey = 'cv') {
    const fData = FACTION_DATA[factionKey] || FACTION_DATA.cv;
    this.playerFaction = fData.id;
    const lang = this.settings?.language || 'pt-BR';
    if (this.factionBadgeEl) {
      this.factionBadgeEl.dataset.faction = fData.id;
      this.factionBadgeEl.textContent = fData.shortName[lang] || fData.shortName['pt-BR'];
    }
    if (typeof this.onSelectFaction === 'function') {
      this.onSelectFaction(fData.id);
    }
  }

  /**
   * Atualiza o Painel Central Superior da Guerra Mundial (Escalada de Batalha + Barras dos Bosses Colossais)
   */
  updateWorldWarHud(escalationRatio = 0.35, activeBosses = [], isInvasionWave = false) {
    const lang = this.settings?.language || 'pt-BR';
    const texts = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];

    if (this.wwTitleEl) {
      this.wwTitleEl.textContent = isInvasionWave ? texts.invasionActive : texts.worldWarFront;
      this.wwTitleEl.style.color = isInvasionWave ? '#ef4444' : '#facc15';
    }
    if (this.wwPctEl) {
      this.wwPctEl.textContent = `${Math.round(escalationRatio * 100)}%`;
    }
    if (this.wwFillEl) {
      this.wwFillEl.style.width = `${Math.max(8, Math.min(100, Math.round(escalationRatio * 100)))}%`;
    }

    if (this.wwBossBarsContainerEl) {
      if (!activeBosses || activeBosses.length === 0) {
        this.wwBossBarsContainerEl.classList.add('hidden');
        this.wwBossBarsContainerEl.innerHTML = '';
        return;
      }

      this.wwBossBarsContainerEl.classList.remove('hidden');
      this.wwBossBarsContainerEl.innerHTML = activeBosses
        .map((b) => {
          const isAllied = b.faction === this.playerFaction;
          const fInfo = FACTION_DATA[b.faction] || FACTION_DATA.cv;
          const bossTitle = fInfo.bossName[lang] || fInfo.bossName['pt-BR'];
          const tag = isAllied ? (lang === 'en-US' ? '[ALLIED BOSS]' : '[BOSS ALIADO]') : '[BOSS INIMIGO]';
          const hp = Math.max(0, Math.round(b.destructible?.hp || 0));
          const maxHp = Math.max(1, Math.round(b.destructible?.maxHp || 1200));
          const pct = Math.max(2, Math.min(100, Math.round((hp / maxHp) * 100)));
          return `
            <div class="ww-boss-bar-row ${isAllied ? 'allied-boss' : ''}">
              <div class="ww-boss-bar-top">
                <span>${tag} ${bossTitle}</span>
                <span>${hp} / ${maxHp} HP</span>
              </div>
              <div class="ww-boss-bar-track">
                <div class="ww-boss-bar-fill" style="width:${pct}%"></div>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  /**
   * Inicializa a Tela Inicial Oficial na IDV do Jogo, Slots de Save, Seleção de Facção e Menu de Pausa [ESC]
   */
  _initTitleScreenAndPauseMenu() {
    this.titleOverlayEl = document.getElementById('title-screen-overlay');
    this.titleMainPanelEl = document.getElementById('title-main-panel');
    this.titleSlotsPanelEl = document.getElementById('title-slots-panel');
    this.titleFactionPanelEl = document.getElementById('title-faction-panel');
    this.saveSlotsGridEl = document.getElementById('save-slots-grid');
    this.factionCardsGridEl = document.getElementById('faction-cards-grid');

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
    this.btnPauseLangEl = document.getElementById('btn-pause-language');

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
      this.titleSlotsPanelEl?.classList.add('hidden');
      this.titleMainPanelEl?.classList.remove('hidden');
    });

    document.getElementById('btn-faction-back')?.addEventListener('click', () => {
      soundFX.playTacticalRoll();
      this.titleFactionPanelEl?.classList.add('hidden');
      if (this.isTitleScreenActive) {
        this.titleSlotsPanelEl?.classList.remove('hidden');
      } else {
        this.titleOverlayEl?.classList.add('hidden');
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
      this.saveCurrentProgress();
      if (this.pauseSaveFeedbackEl) {
        this.pauseSaveFeedbackEl.classList.remove('hidden');
        setTimeout(() => this.pauseSaveFeedbackEl?.classList.add('hidden'), 2400);
      }
      soundFX.playTrueHeroFanfare();
    });

    document.getElementById('btn-pause-switch-faction')?.addEventListener('click', () => {
      this.setPauseMenuOpen(false, this._lastController, true);
      this.titleOverlayEl?.classList.remove('hidden');
      this.titleMainPanelEl?.classList.add('hidden');
      this.titleSlotsPanelEl?.classList.add('hidden');
      this._openFactionSelectionPanel();
    });

    document.getElementById('btn-pause-save-quit')?.addEventListener('click', () => {
      this.saveCurrentProgress();
      this.setPauseMenuOpen(false, this._lastController, true);
      this.isTitleScreenActive = true;
      this.titleOverlayEl?.classList.remove('hidden');
      this.titleMainPanelEl?.classList.remove('hidden');
      this.titleSlotsPanelEl?.classList.add('hidden');
      this.titleFactionPanelEl?.classList.add('hidden');
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    });

    this._refreshLanguageAndOptionsUI();
  }

  _toggleLanguage() {
    this.settings.language = this.settings.language === 'en-US' ? 'pt-BR' : 'en-US';
    saveGameSettings(this.settings);
    soundFX.playHeroSwap();
    this._refreshLanguageAndOptionsUI();
    this.setPlayerFaction(this.playerFaction);
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
    setTxt('lbl-lang-select', t.langLabel);
    setTxt('btn-pause-resume', t.resumeBtn);
    setTxt('btn-pause-save', t.saveNowBtn);
    setTxt('btn-pause-switch-faction', t.switchFactionBtn);
    setTxt('btn-pause-save-quit', t.saveQuitBtn);
    setTxt('pause-save-feedback', t.savedFeedback);

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

    if (this.btnPauseLangEl) {
      this.btnPauseLangEl.textContent = lang === 'en-US' ? 'EN-US // ENGLISH' : 'PT-BR // PORTUGUÊS';
    }
  }

  _openSaveSlotsPanel(mode = 'new') {
    this._slotsMode = mode;
    const lang = this.settings?.language || 'pt-BR';
    const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];

    this.titleMainPanelEl?.classList.add('hidden');
    this.titleFactionPanelEl?.classList.add('hidden');
    this.titleSlotsPanelEl?.classList.remove('hidden');

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

        const fInfo = FACTION_DATA[s.faction] || FACTION_DATA.cv;
        const heroInfo = getHeroInfo(s.heroKey || 'caveira');
        return `
          <div class="save-slot-card" style="border-top-color:${fInfo.color}">
            <div class="faction-card-top">
              ${getFactionLogoSvg(fInfo.id, 58)}
              <div>
                <div class="dossier-tag">SLOT 0${idx + 1} // ${s.updatedAt || ''}</div>
                <div class="faction-card-name" style="color:${fInfo.color}; font-size:1.35rem;">
                  ${fInfo.name[lang] || fInfo.name['pt-BR']}
                </div>
              </div>
            </div>
            <div class="slot-meta-list">
              <span><b>STUDS:</b> ${(s.studs || 0).toLocaleString('pt-BR')}</span>
              <span><b>OPERADOR:</b> ${heroInfo.name}</span>
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
            this._startCampaignWithSlotData(saved, false);
          }
        } else {
          this.pendingSlotIndex = idx;
          this.titleSlotsPanelEl?.classList.add('hidden');
          this._openFactionSelectionPanel();
        }
      });
    });
  }

  _openFactionSelectionPanel() {
    const lang = this.settings?.language || 'pt-BR';
    const t = UI_TEXTS[lang] || UI_TEXTS['pt-BR'];
    this.titleFactionPanelEl?.classList.remove('hidden');
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

    this.factionCardsGridEl.querySelectorAll('button[data-choose-faction]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosenFaction = btn.dataset.chooseFaction || 'cv';
        this.activeSaveSlot = this.pendingSlotIndex ?? this.activeSaveSlot ?? 0;
        const slotData = writeSaveSlot(this.activeSaveSlot, {
          faction: chosenFaction,
          studs: this.isTitleScreenActive ? 0 : this.totalStuds,
          heroKey: this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira'
        });
        this._startCampaignWithSlotData(slotData, true);
      });
    });
  }

  _startCampaignWithSlotData(slotData, isNewOrSwitch = false) {
    this.isTitleScreenActive = false;
    this.titleOverlayEl?.classList.add('hidden');
    this.setPauseMenuOpen(false, this._lastController, true);

    this.totalStuds = Number(slotData.studs || 0);
    this.displayedStuds = this.totalStuds;
    if (this.studCountEl) {
      this.studCountEl.textContent = this.totalStuds.toLocaleString('pt-BR');
    }

    if (this._lastController && slotData.heroKey) {
      this._lastController.switchToHero(slotData.heroKey);
    }

    this.setPlayerFaction(slotData.faction || 'cv');
    this.setPlayerHealth(250, 250, false);

    soundFX.playTrueHeroFanfare();
    soundFX.startWarMusic();

    if (this._lastController && typeof this._lastController.relockPointer === 'function') {
      this._lastController.relockPointer();
    }

    if (isNewOrSwitch) {
      const fInfo = FACTION_DATA[this.playerFaction] || FACTION_DATA.cv;
      const lang = this.settings?.language || 'pt-BR';
      this.showTacticalAlertToast(
        'GUERRA MUNDIAL DE FACÇÕES // ALIANÇA ATIVA',
        `${fInfo.name[lang] || fInfo.name['pt-BR']}`,
        'Exército, Médicos de Combate e Boss Colossal da sua facção agora lutam ao seu lado!',
        fInfo.color,
        'emergency',
        4500
      );
    }
  }

  saveCurrentProgress() {
    writeSaveSlot(this.activeSaveSlot || 0, {
      faction: this.playerFaction || 'cv',
      studs: this.totalStuds || 0,
      heroKey: this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey || 'caveira'
    });
  }

  setPauseMenuOpen(open, controller = null, keepTitleState = false) {
    if (controller) {
      this._lastController = controller;
    }
    this.isPauseMenuOpen = Boolean(open);
    if (this.pauseModalEl) {
      this.pauseModalEl.classList.toggle('hidden', !this.isPauseMenuOpen);
    }
    if (this.pauseIngameActionsEl) {
      this.pauseIngameActionsEl.classList.toggle('hidden', this.isTitleScreenActive);
    }

    if (this.isPauseMenuOpen) {
      if (this.isFullMapOpen) this.setFullMapOpen(false);
      if (this.isDossierOpen) this.setHeroDossierOpen(false);
      if (this.isHeroWheelOpen) this.setHeroWheelOpen(false);
      this._refreshLanguageAndOptionsUI();
      if (document.pointerLockElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } else if (!this.isTitleScreenActive && !keepTitleState) {
      if (this._lastController && typeof this._lastController.relockPointer === 'function') {
        this._lastController.relockPointer();
      }
    }
  }

  togglePauseMenu(controller = null) {
    if (this.isTitleScreenActive) return;
    this.setPauseMenuOpen(!this.isPauseMenuOpen, controller);
  }
}
