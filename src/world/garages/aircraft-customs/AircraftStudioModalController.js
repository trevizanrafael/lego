import * as THREE from 'three';
import { soundFX } from '../../../audio/SoundFX.js';
import { getLegoMaterial, markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import { createNavalOrAircraftMesh } from '../../NavalAndAirFleetBuilder.js';
import { IS_SCALED_WORLD, ws } from '../../core/WorldLayoutScale.js';
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

// Geometrias e materiais compartilhados do pedestal giratório do Hangar (0 alocações / 0 PointLights extras!)
export const SHARED_HANGAR_TURNTABLE_GEO = markAsSharedAsset(
  new THREE.CylinderGeometry(6.8, 7.2, 0.36, 36)
);
export const SHARED_HANGAR_TURNTABLE_RING_GEO = markAsSharedAsset(
  new THREE.TorusGeometry(6.85, 0.11, 8, 48).rotateX(Math.PI / 2)
);
export const SHARED_HANGAR_TURNTABLE_MAT = markAsSharedAsset(
  getLegoMaterial(0x111827, { roughness: 0.36, metalness: 0.62, clearcoat: 0.28 })
);
export const SHARED_HANGAR_TURNTABLE_RING_MAT = markAsSharedAsset(
  getLegoMaterial(0x38bdf8, { roughness: 0.14, metalness: 0.2, emissive: 0x0ea5e9, emissiveIntensity: 1.45 })
);

const CAM_PRESETS = {
  front: [0.0, 0.24, 16.5],
  wing: [Math.PI * 0.5, 0.28, 18.0],
  tail: [Math.PI, 0.26, 16.5],
  top: [0.3, 0.96, 20.0]
};

const STUDIO_TABS = [
  { id: 'paint', label: 'AERONAVE & PINTURA' },
  { id: 'livery', label: 'PADRÕES & INSÍGNIAS' },
  { id: 'parts', label: 'ARMAMENTO & PEÇAS' }
];

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
    this._padPos = new THREE.Vector3(20, 410.48, IS_SCALED_WORLD ? ws(-50) + 114 : 64);

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
      if (this.spinBtn) this.spinBtn.textContent = this.autoSpin ? 'GIRO AUTO: ON' : 'GIRO AUTO: OFF';
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
        const preset = CAM_PRESETS[btn.dataset.camPreset];
        if (preset) [this.targetYaw, this.targetPitch, this.targetDist] = preset;
      });
    });

    window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', () => this.handleMouseUp());
    window.addEventListener('wheel', (e) => this.handleWheel(e), { passive: true });
  }

  _resolveCarrierPadPos(world = this._world) {
    if (world?.helicarrierHangarData?.padPos) {
      return world.helicarrierHangarData.padPos;
    }
    const hx = world?.helicarrierData?.hx ?? 0;
    const hy = world?.helicarrierData?.hy ?? 410.0;
    const hz = world?.helicarrierData?.hz ?? (IS_SCALED_WORLD ? ws(-50) : -50);
    return { x: hx + 20, y: hy + 0.48, z: hz + 114 };
  }

  _resolveCarrierLaunchPos(world = this._world, aircraftType = 'jato_caca') {
    const isHeli = String(aircraftType || '').startsWith('heli');
    const hangar = world?.helicarrierHangarData;
    if (isHeli && hangar?.heliLaunchPos) return hangar.heliLaunchPos;
    if (!isHeli && hangar?.launchPos) return hangar.launchPos;
    const hx = world?.helicarrierData?.hx ?? 0;
    const hy = world?.helicarrierData?.hy ?? 410.0;
    const hz = world?.helicarrierData?.hz ?? (IS_SCALED_WORLD ? ws(-50) : -50);
    return isHeli
      ? { x: hx + 22, y: hy + 0.48, z: hz + 82, rotY: Math.PI }
      : { x: hx - 14, y: hy + 0.48, z: hz + 86, rotY: Math.PI };
  }

  open(world, controller, initialType = null) {
    this._world = world;
    this._controller = controller;
    this.isOpen = true;

    const saveData = getActiveAircraftSaveData();
    const chosenType = initialType || saveData.selectedAircraftType || 'jato_caca';
    const savedCfg = saveData.configsByType?.[chosenType] || createDefaultAircraftConfig(chosenType);
    this.draftConfig = { ...savedCfg, aircraftType: chosenType };

    const pad = this._resolveCarrierPadPos(world);
    this._padPos.set(pad.x, pad.y, pad.z);

    if (controller) {
      controller.resetHeldInputs?.();
      if (controller.minifigure?.root) controller.minifigure.root.visible = false;
    }
    if (world?.helicarrierShowcaseHolo) world.helicarrierShowcaseHolo.visible = false;
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

    if (this._previewMesh && this._previewGroup) this._previewGroup.remove(this._previewMesh);
    this._previewMesh = null;
    if (this._previewGroup?.parent) this._previewGroup.parent.remove(this._previewGroup);

    if (this._controller?.minifigure?.root && !this._controller.currentVehicle) {
      this._controller.minifigure.root.visible = true;
    }
    if (this._world?.helicarrierShowcaseHolo) this._world.helicarrierShowcaseHolo.visible = true;

    document.body?.classList.remove('aircraft-studio-open');
    this.modalEl?.classList.add('hidden');
    if (relockPointer) this._controller?.relockPointer?.();
  }

  selectAircraftType(aircraftType) {
    const saveData = getActiveAircraftSaveData();
    const baseCfg = saveData.configsByType?.[aircraftType] || createDefaultAircraftConfig(aircraftType);
    this.draftConfig = { ...baseCfg, aircraftType };
    this.rebuildPreviewMesh();
    this.render();
    soundFX.playMenuClick?.();
  }

  _ensurePooledShowroomGroup() {
    if (this._previewGroup) return this._previewGroup;
    const group = markAsSharedAsset(new THREE.Group());
    group.name = 'AircraftStudioShowroomGroup';

    const padMesh = markAsSharedAsset(new THREE.Mesh(SHARED_HANGAR_TURNTABLE_GEO, SHARED_HANGAR_TURNTABLE_MAT));
    padMesh.position.set(0, -1.27, 0);
    padMesh.receiveShadow = true;

    const rimMesh = markAsSharedAsset(new THREE.Mesh(SHARED_HANGAR_TURNTABLE_RING_GEO, SHARED_HANGAR_TURNTABLE_RING_MAT));
    rimMesh.position.set(0, -1.08, 0);

    group.add(padMesh, rimMesh);
    this._previewGroup = group;
    return group;
  }

  rebuildPreviewMesh() {
    if (!this._world?.scene) return;
    const pad = this._resolveCarrierPadPos(this._world);
    this._padPos.set(pad.x, pad.y, pad.z);
    const group = this._ensurePooledShowroomGroup();
    group.position.set(this._padPos.x, this._padPos.y + 1.45, this._padPos.z);
    if (group.parent !== this._world.scene) this._world.scene.add(group);

    if (this._previewMesh) {
      group.remove(this._previewMesh);
      this._previewMesh = null;
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
    group.add(mesh);
  }

  _persistDraftToWorld() {
    const saveData = getActiveAircraftSaveData();
    saveData.selectedAircraftType = this.draftConfig.aircraftType;
    saveData.configsByType[this.draftConfig.aircraftType] = { ...this.draftConfig };
    setActiveAircraftSaveData(saveData);
    applySavedAircraftConfigsToCarrier(this._world);
  }

  applyToWorldOnly() {
    this._persistDraftToWorld();
    this.hud?.showWantedBanner?.(
      'PERSONALIZAÇÃO APLICADA',
      `${this.draftConfig.aircraftType.toUpperCase()} #${this.draftConfig.tailNumber} ATUALIZADA NO CONVÉS`,
      'escaped',
      2200
    );
    soundFX.playMenuClick?.();
  }

  saveCurrentConfig(showToast = false) {
    this._persistDraftToWorld();
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
    const launchOverride =
      IS_SCALED_WORLD && !world?.helicarrierHangarData?.launchPos
        ? this._resolveCarrierLaunchPos(world, cfg.aircraftType)
        : null;
    this.close(false);

    const vehicle = spawnCustomizedCarrierAircraft(world, cfg, launchOverride);
    if (vehicle && typeof ctrl?.enterVehicle === 'function') {
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
    if (!this.isOpen || e.target?.closest?.('.aircraft-studio-panel, .aircraft-studio-topbar, button')) return;
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
    if (this.autoSpin && !this._isDragging) this._spinAngle += safeDt * 0.55;

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
    const blend = Math.min(1, safeDt * 10);
    this.camYaw += (this.targetYaw - this.camYaw) * blend;
    this.camPitch += (this.targetPitch - this.camPitch) * blend;
    this.camDist += (this.targetDist - this.camDist) * blend;

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
      AIRCRAFT_STUDIO_TYPES.find((t) => t.id === this.draftConfig.aircraftType) || AIRCRAFT_STUDIO_TYPES[0];
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
      this.tabsContainer.innerHTML = STUDIO_TABS.map(
        (t) =>
          `<button type="button" class="aircraft-tab-btn ${this.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`
      ).join('');
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
            (p) => `<button type="button" class="aircraft-swatch-btn ${this.draftConfig[field] === p.id ? 'active' : ''}" data-field="${field}" data-val="${p.id}" title="${p.name}" style="background:${p.css};"></button>`
          ).join('')}
        </div>
      </div>`;

    const chipRow = (field, label, items, keyField = 'id', textField = 'name') => `
      <div class="aircraft-field-block">
        <div class="aircraft-field-label">${label}</div>
        <div class="aircraft-chip-grid">
          ${items
            .map(
              (item) => `<button type="button" class="aircraft-chip-btn ${this.draftConfig[field] === item[keyField] ? 'active' : ''}" data-field="${field}" data-val="${item[keyField]}">${item[textField]}</button>`
            )
            .join('')}
        </div>
      </div>`;

    let html = '';
    if (this.activeTab === 'paint') {
      html += `<div class="aircraft-field-block"><div class="aircraft-field-label">ESCOLHER AERONAVE DO HANGAR</div><div class="aircraft-type-grid">${AIRCRAFT_STUDIO_TYPES.map(
        (t) => `<button type="button" class="aircraft-type-btn ${this.draftConfig.aircraftType === t.id ? 'active' : ''}" data-aircraft-type="${t.id}"><strong>${t.label}</strong><small>${t.role}</small></button>`
      ).join('')}</div></div>`;
      html += swatchRow('primaryColor', 'COR DA FUSELAGEM PRINCIPAL');
      html += swatchRow('secondaryColor', 'COR SECUNDÁRIA & DETALHES');
      html += swatchRow('wingColor', 'COR DAS ASAS & CAUDA');
      html += chipRow('finishStyle', 'ACABAMENTO LEGO', CUSTOMS_FINISHES);
      html += chipRow('windowTint', 'VIDRO DA CABINE', CUSTOMS_WINDOW_TINTS);
    } else if (this.activeTab === 'livery') {
      html += chipRow('pattern', 'PADRÃO DE PINTURA / CAMUFLAGEM', AIRCRAFT_PATTERNS);
      html += chipRow('insignia', 'INSÍGNIA / ADESIVO DE ESQUADRÃO', AIRCRAFT_INSIGNIAS);
      html += `<div class="aircraft-field-block"><div class="aircraft-field-label">NÚMERO TÁTICO</div><div class="aircraft-chip-grid">${AIRCRAFT_TAIL_NUMBERS.map(
        (num) => `<button type="button" class="aircraft-chip-btn ${this.draftConfig.tailNumber === num ? 'active' : ''}" data-field="tailNumber" data-val="${num}">#${num}</button>`
      ).join('')}</div></div>`;
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
        this.draftConfig[btn.dataset.field] = btn.dataset.val;
        this.rebuildPreviewMesh();
        this.render();
        soundFX.playMenuClick?.();
      });
    });
  }
}

export { AircraftCustomStudio as AircraftStudioModalController };
