import { soundFX } from '../../audio/SoundFX.js';
import { renderMinimapRadar } from '../MinimapRenderer.js';
import {
  populateFullMapSidebar,
  bindFullMapInteractions,
  renderFullMapCanvas
} from '../TacticalMapModal.js';
import {
  HERO_CATALOG,
  getHeroInfo,
  syncOp09CatalogSlot,
  renderHeroWheelCanvas
} from '../HeroWheelAndDossier.js';
import { definePrototypeMethods } from './HudConstantsAndPortraits.js';

export function installHudMapAndWheelBridge(LegoHud) {
  definePrototypeMethods(LegoHud, {
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
        const currentActiveKey =
          this._lastController?.minifigure?.currentHeroKey || this.currentHeroKey;
        if (
          confirmSelection &&
          this._lastController &&
          this.wheelSelectedHeroKey &&
          this.wheelSelectedHeroKey !== currentActiveKey
        ) {
          this._lastController.switchToHero(this.wheelSelectedHeroKey);
        }
        if (this._lastController && typeof this._lastController.relockPointer === 'function') {
          this._lastController.relockPointer();
        }
      }
    },

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
        soundFX.playHeroSwap();
        this._refreshHeroWheelDisplay();
      }
    },

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
        soundFX.playHeroSwap();
        this._refreshHeroWheelDisplay();
      }
    },

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
    },

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
    },

    toggleFullMap(world, controller) {
      this.setFullMapOpen(!this.isFullMapOpen, world, controller);
    },

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
    },

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
    },

    renderFullMap(world, playerPos, playerFacingYaw = 0) {
      renderFullMapCanvas(this, world, playerPos, playerFacingYaw);
    }
  });
}
