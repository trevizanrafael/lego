import * as THREE from 'three';
import { soundFX } from '../../../audio/SoundFX.js';
import { createNavalOrAircraftMesh } from '../../NavalAndAirFleetBuilder.js';
import {
  CUSTOMS_PAINT_PALETTE,
  CUSTOMS_FINISHES,
  CUSTOMS_WINDOW_TINTS
} from '../street-customs/CustomsCatalogAndSave.js';
import {
  AIRCRAFT_STUDIO_TYPES,
  AIRCRAFT_PATTERNS,
  AIRCRAFT_INSIGNIAS,
  AIRCRAFT_TAIL_NUMBERS,
  AIRCRAFT_WEAPON_MODS,
  AIRCRAFT_WING_MODS,
  AIRCRAFT_THRUSTER_MODS,
  createDefaultAircraftConfig,
  getActiveAircraftSaveData,
  setActiveAircraftSaveData,
  computeCustomAircraftStats,
  applyAircraftCustomization,
  applySavedAircraftConfigsToCarrier,
  spawnCustomizedCarrierAircraft
} from './AircraftCatalogAndApplier.js';

export class AircraftCustomStudio {
  constructor(hud) {
    this.hud = hud;
    this.isOpen = false;
    this.activeTab = 'paint';
    this.draftConfig = createDefaultAircraftConfig('jato_caca');
    this.autoSpin = true;
    this.thrustersPreview = false;

    this._world = null;
    this._controller = null;
    this._previewGroup = null;
    this._previewMesh = null;
    this._padPos = new THREE.Vector3(20, 410.48, 64);

    this.camYaw = 0.68;
    this.camPitch = 0.34;
    this.camDist = 17.5;
    this.targetYaw = 0.68;
    this.targetPitch = 0.34;
    this.targetDist = 17.5;
    this._spinAngle = 0.35;
    this._isDragging = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;

    this.modalEl = document.getElementById('aircraft-customs-modal');
    this.closeBtn = document.getElementById('aircraft-customs-close-btn');
    this.tabsContainer = document.getElementById('aircraft-customs-tabs');
    this.bodyContainer = document.getElementById('aircraft-customs-body');
    this.statsEl = document.getElementById('aircraft-customs-stats');
    this.titleEl = document.getElementById('aircraft-customs-vehicle-title');
    this.applyBtn = document.getElementById('aircraft-customs-apply-btn');
    this.saveBtn = document.getElementById('aircraft-customs-save-btn');
    this.launchBtn = document.getElementById('aircraft-customs-launch-btn');
    this.spinBtn = document.getElementById('aircraft-customs-spin-btn');
    this.thrustBtn = document.getElementById('aircraft-customs-thrust-btn');
    this.resetBtn = document.getElementById('aircraft-customs-reset-btn');

    this._bindEvents();
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => this.close(true));
    this.applyBtn?.addEventListener('click', () => this.applyToWorldOnly());
    this.saveBtn?.addEventListener('click', () => this.saveCurrentConfig(true));
    this.launchBtn?.addEventListener('click', () => this.saveAndLaunch());
    this.spinBtn?.addEventListener('click', () => {
      this.autoSpin = !this.autoSpin;
      if (this.spinBtn) {
        this.spinBtn.textContent = this.autoSpin ? 'GIRO AUTO: ON' : 'GIRO AUTO: OFF';
      }
    });
    this.thrustBtn?.addEventListener('click', () => {
      this.thrustersPreview = !this.thrustersPreview;
      if (this.thrustBtn) {
        this.thrustBtn.textContent = this.thrustersPreview ? 'PROPULSORES: ON' : 'TESTAR TURBINAS';
      }
      soundFX.playMenuClick?.();
    });
    this.resetBtn?.addEventListener('click', () => {
      this.draftConfig = createDefaultAircraftConfig(this.draftConfig.aircraftType);
      this.rebuildPreviewMesh();
      this.render();
      soundFX.playMenuClick?.();
    });

    this.modalEl?.querySelectorAll('[data-cam-preset]')?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.camPreset;
        if (p === 'front') {
          this.targetYaw = 0.0;
          this.targetPitch = 0.24;
          this.targetDist = 16.5;
        } else if (p === 'wing') {
          this.targetYaw = Math.PI * 0.5;
          this.targetPitch = 0.28;
          this.targetDist = 18.0;
        } else if (p === 'tail') {
          this.targetYaw = Math.PI;
          this.targetPitch = 0.26;
          this.targetDist = 16.5;
        } else if (p === 'top') {
          this.targetYaw = 0.3;
          this.targetPitch = 0.96;
          this.targetDist = 20.0;
        }
      });
    });

    window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', () => this.handleMouseUp());
    window.addEventListener('wheel', (e) => this.handleWheel(e), { passive: true });
  }

  open(world, controller, initialType = null) {
    this._world = world;
    this._controller = controller;
    this.isOpen = true;

    const saveData = getActiveAircraftSaveData();
    const chosenType = initialType || saveData.selectedAircraftType || 'jato_caca';
    const savedCfg = saveData.configsByType?.[chosenType] || createDefaultAircraftConfig(chosenType);
    this.draftConfig = { ...savedCfg, aircraftType: chosenType };

    const pad = world?.helicarrierHangarData?.padPos || { x: 20, y: 410.48, z: 64 };
    this._padPos.set(pad.x, pad.y, pad.z);

    if (controller) {
      controller.resetHeldInputs?.();
      if (controller.minifigure?.root) {
        controller.minifigure.root.visible = false;
      }
    }
    if (world?.helicarrierShowcaseHolo) {
      world.helicarrierShowcaseHolo.visible = false;
    }
    if (document.pointerLockElement && document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch (_) {}
    }

    document.body?.classList.add('aircraft-studio-open');
    this.modalEl?.classList.remove('hidden');

    this.targetYaw = 0.68;
    this.targetPitch = 0.34;
    this.targetDist = 17.5;
    this.camYaw = this.targetYaw;
    this.camPitch = this.targetPitch;
    this.camDist = this.targetDist;

    this.rebuildPreviewMesh();
    this.render();
    soundFX.playMenuClick?.();
  }

  close(relockPointer = false) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._isDragging = false;
    this.thrustersPreview = false;

    if (this._previewGroup && this._world?.scene) {
      this._world.scene.remove(this._previewGroup);
    }
    this._previewGroup = null;
    this._previewMesh = null;

    if (this._controller?.minifigure?.root && !this._controller.currentVehicle) {
      this._controller.minifigure.root.visible = true;
    }
    if (this._world?.helicarrierShowcaseHolo) {
      this._world.helicarrierShowcaseHolo.visible = true;
    }

    document.body?.classList.remove('aircraft-studio-open');
    this.modalEl?.classList.add('hidden');

    if (relockPointer && typeof this._controller?.relockPointer === 'function') {
      this._controller.relockPointer();
    }
  }

  selectAircraftType(aircraftType) {
    const saveData = getActiveAircraftSaveData();
    const baseCfg = saveData.configsByType?.[aircraftType] || createDefaultAircraftConfig(aircraftType);
    this.draftConfig = { ...baseCfg, aircraftType };
    this.rebuildPreviewMesh();
    this.render();
    soundFX.playMenuClick?.();
  }

  rebuildPreviewMesh() {
    if (!this._world?.scene) return;
    if (!this._previewGroup) {
      this._previewGroup = new THREE.Group();
      this._previewGroup.position.copy(this._padPos);
      this._previewGroup.position.y += 1.45;
      const keyLight = new THREE.PointLight(0xffffff, 2.2, 42);
      keyLight.position.set(8, 12, 10);
      const rimLight = new THREE.PointLight(0x38bdf8, 1.8, 36);
      rimLight.position.set(-10, 6, -10);
      this._previewGroup.add(keyLight, rimLight);
      this._world.scene.add(this._previewGroup);
    }

    if (this._previewMesh) {
      this._previewGroup.remove(this._previewMesh);
    }
    const mesh = createNavalOrAircraftMesh({
      type: this.draftConfig.aircraftType,
      x: 0,
      y: 0,
      z: 0,
      rotY: this._spinAngle
    });
    if (!mesh) return;
    applyAircraftCustomization(mesh, this.draftConfig);
    this._previewMesh = mesh;
    this._previewGroup.add(mesh);
  }

  applyToWorldOnly() {
    const saveData = getActiveAircraftSaveData();
    saveData.selectedAircraftType = this.draftConfig.aircraftType;
    saveData.configsByType[this.draftConfig.aircraftType] = { ...this.draftConfig };
    setActiveAircraftSaveData(saveData);
    applySavedAircraftConfigsToCarrier(this._world);
    this.hud?.showWantedBanner?.(
      'PERSONALIZAÇÃO APLICADA',
      `${this.draftConfig.aircraftType.toUpperCase()} #${this.draftConfig.tailNumber} ATUALIZADA NO CONVÉS`,
      'escaped',
      2200
    );
    soundFX.playMenuClick?.();
  }

  saveCurrentConfig(showToast = false) {
    const saveData = getActiveAircraftSaveData();
    saveData.selectedAircraftType = this.draftConfig.aircraftType;
    saveData.configsByType[this.draftConfig.aircraftType] = { ...this.draftConfig };
    setActiveAircraftSaveData(saveData);
    applySavedAircraftConfigsToCarrier(this._world);
    this.hud?.saveCurrentProgress?.();

    if (showToast) {
      this.hud?.showWantedBanner?.(
        'AERONAVE SALVA NO HANGAR',
        `${this.draftConfig.aircraftType.toUpperCase()} #${this.draftConfig.tailNumber} PRONTA PARA DECOLAGEM`,
        'escaped',
        2600
      );
      soundFX.playTrueHeroFanfare?.();
    }
  }

  saveAndLaunch() {
    this.saveCurrentConfig(false);
    const world = this._world;
    const ctrl = this._controller;
    const cfg = { ...this.draftConfig };
    this.close(false);

    const vehicle = spawnCustomizedCarrierAircraft(world, cfg);
    if (vehicle && ctrl && typeof ctrl.enterVehicle === 'function') {
      ctrl.enterVehicle(vehicle);
      ctrl.relockPointer?.();
    }
    this.hud?.showWantedBanner?.(
      'PRONTO PARA DECOLAR',
      'USE [W] PARA ACELERAR NA PISTA E [ESPAÇO] PARA SUBIR',
      'escaped',
      3200
    );
    soundFX.playTrueHeroFanfare?.();
  }

  handleMouseDown(e) {
    if (!this.isOpen) return;
    const target = e.target;
    if (target?.closest?.('.aircraft-studio-panel, .aircraft-studio-topbar, button')) return;
    this._isDragging = true;
    this._lastMouseX = e.clientX;
    this._lastMouseY = e.clientY;
  }

  handleMouseMove(e) {
    if (!this.isOpen || !this._isDragging) return;
    const dx = e.clientX - this._lastMouseX;
    const dy = e.clientY - this._lastMouseY;
    this._lastMouseX = e.clientX;
    this._lastMouseY = e.clientY;
    this.targetYaw -= dx * 0.008;
    this.targetPitch = Math.max(0.08, Math.min(1.25, this.targetPitch + dy * 0.006));
  }

  handleMouseUp() {
    this._isDragging = false;
  }

  handleWheel(e) {
    if (!this.isOpen) return;
    this.targetDist = Math.max(10, Math.min(28, this.targetDist + Math.sign(e.deltaY) * 1.4));
  }

  updateStudioCamera(dt, camera) {
    if (!this.isOpen) return;
    const safeDt = Math.min(dt || 0.016, 0.05);

    if (this.autoSpin && !this._isDragging) {
      this._spinAngle += safeDt * 0.55;
    }
    if (this._previewMesh) {
      this._previewMesh.rotation.y = this._spinAngle;
      const ud = this._previewMesh.userData || {};
      const rotorSpeed = this.thrustersPreview ? 16 : 3.2;
      if (ud.mainRotorGroup) ud.mainRotorGroup.rotation.y += safeDt * rotorSpeed;
      if (ud.tailRotorGroup) ud.tailRotorGroup.rotation.x += safeDt * (rotorSpeed * 1.4);
      if (Array.isArray(ud.turboFlames)) {
        for (const fl of ud.turboFlames) {
          if (fl) fl.visible = Boolean(this.thrustersPreview);
        }
      }
    }

    if (!camera) return;
    this.camYaw += (this.targetYaw - this.camYaw) * Math.min(1, safeDt * 10);
    this.camPitch += (this.targetPitch - this.camPitch) * Math.min(1, safeDt * 10);
    this.camDist += (this.targetDist - this.camDist) * Math.min(1, safeDt * 10);

    const cx = this._padPos.x;
    const cy = this._padPos.y + 2.0;
    const cz = this._padPos.z;
    const horiz = Math.cos(this.camPitch) * this.camDist;
    camera.position.set(
      cx + Math.sin(this.camYaw) * horiz,
      cy + Math.sin(this.camPitch) * this.camDist,
      cz + Math.cos(this.camYaw) * horiz
    );
    camera.lookAt(cx, cy, cz);
  }

  render() {
    const spec = computeCustomAircraftStats(this.draftConfig.aircraftType, this.draftConfig);
    const typeEntry =
      AIRCRAFT_STUDIO_TYPES.find((t) => t.id === this.draftConfig.aircraftType) ||
      AIRCRAFT_STUDIO_TYPES[0];
    if (this.titleEl) {
      this.titleEl.textContent = `${typeEntry.label.toUpperCase()} • #${this.draftConfig.tailNumber}`;
    }

    if (this.statsEl) {
      this.statsEl.innerHTML = `
        <div class="aircraft-stat-item"><span>VEL. MAX</span><strong>${spec.kmh} KM/H</strong></div>
        <div class="aircraft-stat-item"><span>TURBO</span><strong>${spec.turboKmh} KM/H</strong></div>
        <div class="aircraft-stat-item"><span>BLINDAGEM</span><strong>${spec.hp} HP</strong></div>
        <div class="aircraft-stat-item"><span>ARMAMENTO</span><strong>${(spec.weapon || 'NENHUM').toUpperCase()}</strong></div>
      `;
    }

    if (this.tabsContainer) {
      const tabs = [
        { id: 'paint', label: 'AERONAVE & PINTURA' },
        { id: 'livery', label: 'PADRÕES & INSÍGNIAS' },
        { id: 'parts', label: 'ARMAMENTO & PEÇAS' }
      ];
      this.tabsContainer.innerHTML = tabs
        .map(
          (t) =>
            `<button type="button" class="aircraft-tab-btn ${this.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
        )
        .join('');
      this.tabsContainer.querySelectorAll('.aircraft-tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeTab = btn.dataset.tab;
          this.render();
          soundFX.playMenuClick?.();
        });
      });
    }

    if (!this.bodyContainer) return;

    const swatchRow = (field, label) => `
      <div class="aircraft-field-block">
        <div class="aircraft-field-label">${label}</div>
        <div class="aircraft-swatch-grid">
          ${CUSTOMS_PAINT_PALETTE.map(
            (p) => `
            <button type="button" class="aircraft-swatch-btn ${this.draftConfig[field] === p.id ? 'active' : ''}"
              data-field="${field}" data-val="${p.id}" title="${p.name}"
              style="background:${p.css};"></button>`
          ).join('')}
        </div>
      </div>
    `;

    const chipRow = (field, label, items, keyField = 'id', textField = 'name') => `
      <div class="aircraft-field-block">
        <div class="aircraft-field-label">${label}</div>
        <div class="aircraft-chip-grid">
          ${items
            .map(
              (item) => `
              <button type="button" class="aircraft-chip-btn ${this.draftConfig[field] === item[keyField] ? 'active' : ''}"
                data-field="${field}" data-val="${item[keyField]}">${item[textField]}</button>`
            )
            .join('')}
        </div>
      </div>
    `;

    let html = '';
    if (this.activeTab === 'paint') {
      html += `
        <div class="aircraft-field-block">
          <div class="aircraft-field-label">ESCOLHER AERONAVE DO HANGAR</div>
          <div class="aircraft-type-grid">
            ${AIRCRAFT_STUDIO_TYPES.map(
              (t) => `
              <button type="button" class="aircraft-type-btn ${this.draftConfig.aircraftType === t.id ? 'active' : ''}"
                data-aircraft-type="${t.id}">
                <strong>${t.label}</strong>
                <small>${t.role}</small>
              </button>`
            ).join('')}
          </div>
        </div>
      `;
      html += swatchRow('primaryColor', 'COR DA FUSELAGEM PRINCIPAL');
      html += swatchRow('secondaryColor', 'COR SECUNDÁRIA & DETALHES');
      html += swatchRow('wingColor', 'COR DAS ASAS & CAUDA');
      html += chipRow('finishStyle', 'ACABAMENTO LEGO', CUSTOMS_FINISHES);
      html += chipRow('windowTint', 'VIDRO DA CABINE', CUSTOMS_WINDOW_TINTS);
    } else if (this.activeTab === 'livery') {
      html += chipRow('pattern', 'PADRÃO DE PINTURA / CAMUFLAGEM', AIRCRAFT_PATTERNS);
      html += chipRow('insignia', 'INSÍGNIA / ADESIVO DE ESQUADRÃO', AIRCRAFT_INSIGNIAS);
      html += `
        <div class="aircraft-field-block">
          <div class="aircraft-field-label">NÚMERO TÁTICO</div>
          <div class="aircraft-chip-grid">
            ${AIRCRAFT_TAIL_NUMBERS.map(
              (num) => `
              <button type="button" class="aircraft-chip-btn ${this.draftConfig.tailNumber === num ? 'active' : ''}"
                data-field="tailNumber" data-val="${num}">#${num}</button>`
            ).join('')}
          </div>
        </div>
      `;
    } else {
      html += chipRow('weaponMod', 'ARMAMENTO & CASULOS', AIRCRAFT_WEAPON_MODS);
      html += chipRow('wingMod', 'ASAS, WINGLETS & RADAR', AIRCRAFT_WING_MODS);
      html += chipRow('thrusterMod', 'PROPULSORES & PÓS-COMBUSTÃO', AIRCRAFT_THRUSTER_MODS);
    }

    this.bodyContainer.innerHTML = html;

    this.bodyContainer.querySelectorAll('[data-aircraft-type]').forEach((btn) => {
      btn.addEventListener('click', () => this.selectAircraftType(btn.dataset.aircraftType));
    });
    this.bodyContainer.querySelectorAll('[data-field]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.field;
        const val = btn.dataset.val;
        this.draftConfig[field] = val;
        this.rebuildPreviewMesh();
        this.render();
        soundFX.playMenuClick?.();
      });
    });
  }
}

export { AircraftCustomStudio as AircraftStudioModalController };
