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
    this.currentHeroKey = 'caveira';

    this.studCountEl = document.getElementById('hud-stud-count');
    this.studGainEl = document.getElementById('hud-stud-gain');
    this.studCoinEl = document.getElementById('hud-stud-coin');
    this.charNameEl = document.getElementById('hud-char-name');
    this.opTagEl = document.getElementById('hud-op-tag');
    this.portraitCanvas = document.getElementById('hud-portrait-canvas');
    this.heartsContainer = document.getElementById('hud-hearts');
    this.crosshairEl = document.getElementById('crosshair');

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
    this.setCharacterPortrait('caveira', 'COMANDANTE CAVEIRA');
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
}
