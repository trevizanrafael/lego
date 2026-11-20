import * as THREE from 'three';
import { VEHICLE_SPECS } from '../../VehicleFleetBuilder.js';
import { soundFX } from '../../../audio/SoundFX.js';
import {
  UPGRADE_LEVEL_COSTS,
  UPGRADE_ATTRIBUTES,
  CUSTOMS_PAINT_PALETTE,
  CUSTOMS_FINISHES,
  CUSTOMS_DECALS,
  CUSTOMS_SPOILERS,
  CUSTOMS_FRONT_MODS,
  CUSTOMS_WHEEL_STYLES,
  CUSTOMS_ROOF_MODS,
  CUSTOMS_EXHAUST_MODS,
  CUSTOMS_WINDOW_TINTS,
  CUSTOMS_UNDERGLOW,
  CUSTOMS_SVGS,
  PAID_PART_CATALOGS,
  clampInt,
  getActiveGarageSaveData,
  createDefaultVehicleTuning,
  computeTunedVehicleStats
} from './CustomsCatalogAndSave.js';
import {
  measureVehicleBounds,
  applyTuningToVehicleObject,
  updateVehicleDynamicTuningFX
} from './CustomsVehicleApplier3D.js';
import { spawnDraggableCustomVehicle } from './CustomsBuildingAndRuntime3D.js';

// ============================================================================
// 8. ESTÚDIO 360° INTERATIVO "LS CUSTOMS // PRO TUNER" (ECU/DYNO SHOWROOM)
// ============================================================================
export class LegoCustomsStudio {
  constructor(hud) {
    this.hud = hud;
    this.isOpen = false;
    this.activeTab = 'performance'; // 'performance' | 'paint' | 'bodykit' | 'roof_wheels' | 'garage'
    this.controller = null;
    this.world = null;
    this.targetCarObj = null;
    this.activeVehicle = null;
    this.draft = null;
    this._savedSnapshot = null;
    this.cameraOrbitAngle = 0.65;
    this.cameraPitch = 0.33;
    this.cameraZoom = 1.0;
    this.autoOrbit = true;
    this.previewNitroTimer = 0;
    this.previewHydraulicTimer = 0;
    this._previewHydPhase = 0;
    this._isDraggingViewport = false;
    this._dragLastX = 0;
    this._dragLastY = 0;
    this.feedbackMsg = '';
    this._spawnedGarageCar = null;

    this.modalEl = document.getElementById('lego-customs-modal');
    this._bindModalControls();
  }

  _normalizeTabName(tab) {
    if (tab === 'mods') return 'bodykit';
    if (
      tab === 'performance' ||
      tab === 'paint' ||
      tab === 'bodykit' ||
      tab === 'roof_wheels' ||
      tab === 'garage'
    ) {
      return tab;
    }
    return 'performance';
  }

  _measureVehicleBounds(vehicleObj) {
    return measureVehicleBounds(vehicleObj || this.activeVehicle || this.targetCarObj);
  }

  _bindModalControls() {
    if (!this.modalEl) return;

    const bindBtn = (id, handler) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (btn.style) btn.style.pointerEvents = 'auto';
      btn.addEventListener('click', handler);
    };

    bindBtn('btn-customs-close', () => {
      this.close(false);
    });
    bindBtn('btn-customs-reset-stock', () => {
      this.resetToStock();
    });
    bindBtn('btn-customs-apply-drive', () => {
      this.hud.saveCurrentProgress?.();
      soundFX.playTrueHeroFanfare?.();
      this.close(true);
    });
    bindBtn('btn-customs-rot-left', () => {
      this.autoOrbit = false;
      this.cameraOrbitAngle -= 0.42;
      this._syncOrbitButtonState();
    });
    bindBtn('btn-customs-rot-right', () => {
      this.autoOrbit = false;
      this.cameraOrbitAngle += 0.42;
      this._syncOrbitButtonState();
    });
    bindBtn('btn-customs-toggle-orbit', () => {
      this.autoOrbit = !this.autoOrbit;
      this._syncOrbitButtonState();
    });
    bindBtn('btn-customs-test-nitro', () => {
      this.triggerNitroPreview();
    });
    bindBtn('btn-customs-test-hydraulics', () => {
      this.triggerHydraulicsPreview();
    });

    const tabMap = {
      'btn-customs-tab-perf': 'performance',
      'btn-customs-tab-paint': 'paint',
      'btn-customs-tab-mods': 'bodykit',
      'btn-customs-tab-roof': 'roof_wheels',
      'btn-customs-tab-garage': 'garage'
    };
    for (const [btnId, tabName] of Object.entries(tabMap)) {
      bindBtn(btnId, () => {
        this.activeTab = tabName;
        soundFX.playPlasticHit?.();
        this._renderModalBody();
      });
    }

    // Rotação 360° (horizontal), Pitch (vertical) e Zoom (Scroll) na Área Livre do Showroom!
    const isInsideUiCard = (target) => {
      if (!target || typeof target.closest !== 'function') return false;
      return Boolean(
        target.closest('.customs-side-panel, .customs-telemetry-bar, .customs-showroom-controls')
      );
    };

    this.modalEl.addEventListener('pointerdown', (ev) => {
      if (!this.isOpen || isInsideUiCard(ev.target)) return;
      this._isDraggingViewport = true;
      this.autoOrbit = false;
      this._dragLastX = ev.clientX || 0;
      this._dragLastY = ev.clientY || 0;
      this._syncOrbitButtonState();
    });

    this.modalEl.addEventListener('pointermove', (ev) => {
      if (!this.isOpen || !this._isDraggingViewport) return;
      const cx = ev.clientX || 0;
      const cy = ev.clientY || 0;
      const dx = cx - this._dragLastX;
      const dy = cy - this._dragLastY;
      this._dragLastX = cx;
      this._dragLastY = cy;
      this.cameraOrbitAngle += dx * 0.0085;
      this.cameraPitch = THREE.MathUtils.clamp((this.cameraPitch || 0.33) + dy * 0.005, 0.08, 0.82);
    });

    const stopDrag = () => {
      this._isDraggingViewport = false;
    };
    this.modalEl.addEventListener('pointerup', stopDrag);
    this.modalEl.addEventListener('pointercancel', stopDrag);
    this.modalEl.addEventListener('pointerleave', stopDrag);

    this.modalEl.addEventListener(
      'wheel',
      (ev) => {
        if (!this.isOpen || isInsideUiCard(ev.target)) return;
        ev.preventDefault?.();
        const dir = Math.sign(ev.deltaY || 0);
        if (dir !== 0) {
          this.cameraZoom = THREE.MathUtils.clamp((this.cameraZoom || 1.0) + dir * 0.08, 0.62, 1.65);
        }
      },
      { passive: false }
    );
  }

  _syncOrbitButtonState() {
    const orbitBtn = document.getElementById('btn-customs-toggle-orbit');
    if (orbitBtn?.classList) {
      orbitBtn.classList.toggle('active', Boolean(this.autoOrbit));
    }
  }

  triggerNitroPreview() {
    this.previewNitroTimer = 1.8;
    soundFX.playFireballCast?.();
    soundFX.playCarEngineStart?.();
    this._setFeedback('TESTE DE BANCADA ECU: LABAREDAS DO NITRO & ESCAPAMENTO ATIVADAS (1.8s)');
  }

  triggerHydraulicsPreview() {
    this.previewHydraulicTimer = 1.65;
    this._previewHydPhase = 0;
    soundFX.playTacticalRoll?.();
    soundFX.playSeismicStomp?.();
    this._setFeedback('TESTE DE BANCADA: SUSPENSÃO HIDRÁULICA ACIONADA NO ELEVADOR');
  }

  resetToStock() {
    if (!this.targetCarObj) return;
    this.draft = createDefaultVehicleTuning(this.targetCarObj);
    soundFX.playHeroSwap?.();
    this._applyLiveDraftToCar();
    this._renderModalBody();
    this._setFeedback('CONFIGURAÇÃO ORIGINAL DE FÁBRICA (STOCK) RESTAURADA NO VEÍCULO');
  }

  _setStudioUiOverlayMode(active) {
    if (typeof document === 'undefined') return;
    if (active) {
      document.exitPointerLock?.();
      document.body?.classList?.add('customs-studio-open');
      if (document.body?.style) document.body.style.cursor = 'default';
      const ch = document.getElementById('crosshair');
      if (ch?.style) ch.style.display = 'none';
      document.getElementById('vehicle-prompt')?.classList?.add('hidden');
      document.getElementById('pointer-prompt')?.classList?.add('hidden');
      if (this.modalEl?.style) this.modalEl.style.pointerEvents = 'auto';
      if (typeof this.modalEl?.querySelectorAll === 'function') {
        this.modalEl
          .querySelectorAll(
            '.customs-side-panel, .customs-showroom-controls, .creator-studio-turntable-controls, .customs-telemetry-bar'
          )
          .forEach((el) => {
            if (el?.style) el.style.pointerEvents = 'auto';
          });
      }
    } else {
      document.body?.classList?.remove('customs-studio-open');
      if (document.body?.style) document.body.style.cursor = '';
      const ch = document.getElementById('crosshair');
      if (ch?.style) ch.style.display = '';
    }
  }

  open(controller, world, explicitCar = null, startTab = 'performance') {
    if (!controller || !world) return false;

    let carObj = explicitCar || controller.currentVehicle || controller.findNearbyVehicle?.();
    if (!carObj && world.destructibles) {
      const lift = world.legoCustomsData?.liftPos || { x: 68, y: 0.46, z: -454 };
      let bestD = 38.0;
      for (const obj of world.destructibles.objects) {
        if (obj.destroyed || obj.type !== 'car') continue;
        const spec = obj.mesh?.userData?.vehicleSpec;
        if (spec?.category || spec?.isColossalShip) continue;
        const d = Math.hypot(obj.mesh.position.x - lift.x, obj.mesh.position.z - lift.z);
        if (d < bestD) {
          bestD = d;
          carObj = obj;
        }
      }
      if (!carObj) {
        carObj = spawnDraggableCustomVehicle(world, {
          x: lift.x,
          y: lift.y,
          z: lift.z,
          rotY: -Math.PI / 2,
          type: 'apex_gtx',
          color: 0xfacc15,
          roofColor: 0x090a0d
        });
      }
    }

    if (!carObj) return false;
    const spec = carObj.mesh?.userData?.vehicleSpec;
    if (spec?.category || spec?.isColossalShip) return false;

    this.controller = controller;
    this.world = world;
    this.targetCarObj = carObj;
    this.activeVehicle = carObj;
    this.isOpen = true;
    this.activeTab = this._normalizeTabName(startTab);
    this.autoOrbit = true;
    this.cameraPitch = 0.33;
    this.cameraZoom = 1.0;
    this.previewNitroTimer = 0;
    this.previewHydraulicTimer = 0;
    this._previewHydPhase = 0;
    this._isDraggingViewport = false;
    this.feedbackMsg = '';

    const entryCheckPos = carObj.mesh?.position?.clone?.() || controller.position?.clone?.();
    const wantedSys = world?.livingCity?.wantedSystem;
    this._enteredUnseenByPolice = !(
      wantedSys &&
      wantedSys.stars > 0 &&
      wantedSys.hasCloseWitnessOnGarageEntry(entryCheckPos, 28.0)
    );

    if (controller.currentVehicle !== carObj) {
      if (controller.currentVehicle) controller.exitVehicle();
      controller.enterVehicle(carObj);
    }

    const lift = world.legoCustomsData?.liftPos || { x: 68, y: 0.46, z: -454 };
    controller.vehicleSpeed = 0;
    controller.vehicleAirVelY = 0;
    controller.isTurboActive = false;
    controller.isDrifting = false;
    controller.vehicleHeading = -Math.PI / 2;
    carObj.mesh.position.set(lift.x, lift.y, lift.z);
    carObj.mesh.rotation.set(0, -Math.PI / 2, 0);
    controller.position.set(lift.x, lift.y, lift.z);

    const existing = {
      ...createDefaultVehicleTuning(carObj),
      ...(carObj.mesh.userData?.customTuning || {})
    };
    this._savedSnapshot = JSON.parse(JSON.stringify(existing));
    this.draft = JSON.parse(JSON.stringify(existing));

    const ul = getActiveGarageSaveData().unlockedLevels;
    for (const attr of UPGRADE_ATTRIBUTES) {
      const k = attr.id;
      this.draft.levels[k] = clampInt(this.draft.levels[k], 0, ul[k] || 0);
    }

    this._setStudioUiOverlayMode(true);
    this._syncOrbitButtonState();
    this._setFeedback('');

    this._applyLiveDraftToCar();
    this._renderModalBody();
    this.modalEl?.classList.remove('hidden');
    soundFX.playCarEngineStart?.();
    return true;
  }

  close(keepChanges = true) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._isDraggingViewport = false;
    this.previewNitroTimer = 0;
    this.previewHydraulicTimer = 0;
    this.modalEl?.classList.add('hidden');
    this._setStudioUiOverlayMode(false);

    if (!keepChanges && this._savedSnapshot && this.targetCarObj) {
      applyTuningToVehicleObject(this.targetCarObj, this._savedSnapshot);
    } else if (this.targetCarObj && this.draft) {
      applyTuningToVehicleObject(this.targetCarObj, this.draft);
      if (
        this._savedSnapshot &&
        (this.draft.primaryColorId !== this._savedSnapshot.primaryColorId ||
          this.draft.secondaryColorId !== this._savedSnapshot.secondaryColorId)
      ) {
        this._tryTriggerPayNSprayEscape();
      }
    }

    if (this.controller && this.targetCarObj && this.world?.legoCustomsData?.courtyardExitPos) {
      const ex = this.world.legoCustomsData.courtyardExitPos;
      this.targetCarObj.mesh.position.set(ex.x, ex.y, ex.z);
      this.targetCarObj.mesh.rotation.set(0, ex.rotY, 0);
      this.controller.vehicleHeading = ex.rotY;
      this.controller.position.set(ex.x, ex.y, ex.z);
      this.controller._customsExitCooldown = 2.0;
    }

    this.controller?.relockPointer?.();
  }

  updateStudioCamera(dt) {
    const vehicle = this.activeVehicle || this.targetCarObj;
    if (!this.isOpen || !this.controller || !vehicle?.mesh) return;

    const safeDt = Math.min(0.1, Math.max(0, Number(dt) || 0.016));
    const lift = this.world?.legoCustomsData?.liftPos || { x: 68, y: 0.46, z: -454 };
    const carMesh = vehicle.mesh;

    // 1. Demonstração ao vivo de Suspensão Hidráulica sobre o Elevador
    let hydBounceY = 0;
    let hydPitchX = 0;
    if (this.previewHydraulicTimer > 0) {
      this.previewHydraulicTimer = Math.max(0, this.previewHydraulicTimer - safeDt);
      this._previewHydPhase += safeDt * 12.0;
      const env = Math.min(1.0, this.previewHydraulicTimer * 2.2);
      hydBounceY = Math.abs(Math.sin(this._previewHydPhase)) * 1.12 * env;
      hydPitchX = Math.sin(this._previewHydPhase) * 0.16 * env;
    }

    carMesh.position.set(lift.x, lift.y + hydBounceY, lift.z);
    carMesh.rotation.set(hydPitchX, -Math.PI / 2, 0);

    // 2. Pulso RGB e Demonstração ao vivo de Nitro / Labaredas nos Escapamentos & Turbinas
    const nowSec = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
    updateVehicleDynamicTuningFX(vehicle, nowSec);

    if (this.previewNitroTimer > 0) {
      this.previewNitroTimer = Math.max(0, this.previewNitroTimer - safeDt);
    }

    const showFlames = this.previewNitroTimer > 0;
    const flamePulse = showFlames ? 0.88 + 0.28 * Math.sin(nowSec * 38.0) : 1.0;

    if (Array.isArray(carMesh.userData?.turboFlames)) {
      for (const fg of carMesh.userData.turboFlames) {
        if (!fg) continue;
        fg.visible = showFlames;
        if (fg.scale) fg.scale.setScalar(flamePulse);
      }
    }
    carMesh.traverse?.((node) => {
      if (node?.userData?.isNitroFlame) {
        node.visible = showFlames;
        if (node.scale && !carMesh.userData?.turboFlames?.includes(node)) {
          node.scale.setScalar(flamePulse);
        }
      }
    });

    // 3. Enquadramento Perfeito da Câmera 3D nos 69% Livres à Esquerda (Carros, Motos, Caminhões & Ônibus)
    if (this.autoOrbit) {
      this.cameraOrbitAngle += safeDt * 0.44;
    }

    const dims = this._measureVehicleBounds(vehicle);
    let baseRadius = 8.5;
    if (dims.isMoto) {
      baseRadius = 6.8;
    } else if (dims.d > 5.2) {
      baseRadius = Math.max(9.8, dims.d * 1.38);
    }
    const radius = baseRadius * (this.cameraZoom || 1.0);
    const pitch = THREE.MathUtils.clamp(this.cameraPitch || 0.33, 0.08, 0.82);

    const camX = lift.x + Math.cos(this.cameraOrbitAngle) * radius;
    const camZ = lift.z + Math.sin(this.cameraOrbitAngle) * radius;
    const camY = lift.y + Math.max(1.25, radius * Math.sin(pitch));

    this.controller.camera.position.set(camX, camY, camZ);

    // Vetor direção da câmera ao centro do elevador no plano XZ e vetor DIREITA da câmera:
    const rawDirX = lift.x - camX;
    const rawDirZ = lift.z - camZ;
    const dirLen = Math.hypot(rawDirX, rawDirZ) || 1.0;
    const dirX = rawDirX / dirLen;
    const dirZ = rawDirZ / dirLen;
    const camRightX = -dirZ;
    const camRightZ = dirX;
    const offsetRight = radius * 0.24;

    const focusY = lift.y + Math.max(0.95, dims.fullH * 0.44);
    this.controller.camera.lookAt(
      lift.x + camRightX * offsetRight,
      focusY,
      lift.z + camRightZ * offsetRight
    );
  }

  _applyLiveDraftToCar() {
    if (!this.targetCarObj || !this.draft) return;
    const tuned = applyTuningToVehicleObject(this.targetCarObj, this.draft);
    this._updateTelemetryBox(tuned);
  }

  _tryTriggerPayNSprayEscape() {
    const ws = this.world?.livingCity?.wantedSystem;
    if (!ws || ws.stars <= 0) return false;
    if (this._enteredUnseenByPolice) {
      ws.clearWantedByPaintJob();
      this._setFeedback('PINTURA NOVA APLICADA: POLÍCIA DESPISTADA — NÍVEL DE PROCURADO ZERADO');
      return true;
    }
    this._setFeedback('ALERTA ECU: VIATURA TESTEMUNHOU SUA ENTRADA NO BOX — DESPISTE ANTES DE PINTAR');
    return false;
  }

  applyPaintColor(primaryColorId, secondaryColorId = null) {
    if (!this.draft) return false;
    const changed =
      (primaryColorId && primaryColorId !== this.draft.primaryColorId) ||
      (secondaryColorId && secondaryColorId !== this.draft.secondaryColorId);
    if (primaryColorId) this.draft.primaryColorId = primaryColorId;
    if (secondaryColorId) this.draft.secondaryColorId = secondaryColorId;
    this._applyLiveDraftToCar();
    this._renderModalBody();
    if (changed) {
      return this._tryTriggerPayNSprayEscape();
    }
    return false;
  }

  _updateTelemetryBox(tuned) {
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    const setPct = (id, ratio) => {
      const el = document.getElementById(id);
      if (el?.style) {
        const pct = Math.round(THREE.MathUtils.clamp(ratio, 0.04, 1.0) * 100);
        el.style.width = `${pct}%`;
      }
    };

    const dims = this._measureVehicleBounds(this.activeVehicle || this.targetCarObj);
    setTxt('customs-vehicle-class-badge', dims.vehicleClassLabel || 'CARRO');
    setTxt('customs-car-title', (this.draft?.customName || tuned?.name || 'VEÍCULO').toUpperCase());

    const kmh = tuned?.kmh || 200;
    const nitroKmh = tuned?.turboKmh || 250;
    const hp = tuned?.maxHp || 250;
    const jumpM = tuned?.jumpHeightMeters || 0;

    setTxt('customs-stat-kmh', `${kmh} KM/H`);
    setTxt('customs-stat-nitro', `${nitroKmh} KM/H`);
    setTxt('customs-stat-hp', `${hp} HP`);
    setTxt('customs-stat-jump', jumpM > 0 ? `${jumpM.toFixed(1)} M` : 'STOCK (0M)');
    setTxt('customs-studs-balance', `${(this.hud?.totalStuds || 0).toLocaleString('pt-BR')}`);

    setPct('customs-bar-kmh', kmh / 650);
    setPct('customs-bar-nitro', nitroKmh / 780);
    setPct('customs-bar-hp', hp / 3000);
    setPct('customs-bar-jump', jumpM / 16.0);
  }

  _setFeedback(msg) {
    this.feedbackMsg = msg;
    const fbEl = document.getElementById('customs-feedback-banner');
    if (fbEl) {
      fbEl.textContent = msg;
      fbEl.classList.toggle('hidden', !msg);
    }
  }

  _isPartUnlocked(fieldName, item) {
    if (!item || !item.cost || item.cost <= 0) return true;
    const gData = getActiveGarageSaveData();
    return Boolean(gData.unlockedParts?.[`${fieldName}:${item.id}`]);
  }

  _renderSwatches(selectedId, fieldName) {
    return CUSTOMS_PAINT_PALETTE.map(
      (c) => `
      <button type="button" class="creator-swatch customs-swatch ${c.id === selectedId ? 'active' : ''}"
        data-customs-field="${fieldName}" data-val="${c.id}"
        title="${c.name}" style="background:${c.css};pointer-events:auto;"></button>
    `
    ).join('');
  }

  _renderChips(selectedId, list, fieldName) {
    return list
      .map((item) => {
        const isSelected = item.id === selectedId;
        const unlocked = this._isPartUnlocked(fieldName, item);
        const priceBadge =
          item.cost > 0 && !unlocked
            ? `<span class="customs-part-cost">${item.cost.toLocaleString('pt-BR')} STUDS</span>`
            : isSelected && item.cost > 0
              ? `<span class="customs-part-owned">INSTALADO</span>`
              : '';
        return `
        <button type="button" class="creator-chip customs-part-chip ${isSelected ? 'active' : ''}"
          data-customs-field="${fieldName}" data-val="${item.id}" style="pointer-events:auto;">
          <span class="customs-chip-label">${item.name}</span>
          ${priceBadge}
        </button>
      `;
      })
      .join('');
  }

  _renderPartCards(selectedId, list, fieldName) {
    return list
      .map((item) => {
        const isSelected = item.id === selectedId;
        const unlocked = this._isPartUnlocked(fieldName, item);
        const rightTag =
          item.cost > 0 && !unlocked
            ? `<span class="customs-part-cost">${CUSTOMS_SVGS.stud} ${item.cost.toLocaleString('pt-BR')}</span>`
            : isSelected
              ? `<span class="customs-part-owned">${CUSTOMS_SVGS.check} INSTALADO</span>`
              : `<span class="customs-part-free">DISPONÍVEL</span>`;
        return `
        <button type="button" class="creator-power-card customs-part-card ${isSelected ? 'active' : ''}"
          data-customs-field="${fieldName}" data-val="${item.id}" style="pointer-events:auto;">
          <span class="creator-pow-title">${item.name}</span>
          ${rightTag}
        </button>
      `;
      })
      .join('');
  }

  _renderModalBody() {
    const bodyEl = document.getElementById('customs-panel-body');
    const tabPerf = document.getElementById('btn-customs-tab-perf');
    const tabPaint = document.getElementById('btn-customs-tab-paint');
    const tabMods = document.getElementById('btn-customs-tab-mods');
    const tabRoof = document.getElementById('btn-customs-tab-roof');
    const tabGar = document.getElementById('btn-customs-tab-garage');
    tabPerf?.classList.toggle('active', this.activeTab === 'performance');
    tabPaint?.classList.toggle('active', this.activeTab === 'paint');
    tabMods?.classList.toggle('active', this.activeTab === 'bodykit');
    tabRoof?.classList.toggle('active', this.activeTab === 'roof_wheels');
    tabGar?.classList.toggle('active', this.activeTab === 'garage');
    if (!bodyEl || !this.draft) return;

    const d = this.draft;
    const garageSave = getActiveGarageSaveData();
    const ul = garageSave.unlockedLevels;

    if (this.activeTab === 'performance') {
      bodyEl.innerHTML = UPGRADE_ATTRIBUTES.map((attr) => {
        const k = attr.id;
        const unlocked = clampInt(ul[k], 0, 10);
        const active = clampInt(d.levels[k], 0, unlocked);
        const nextUnlock = unlocked < 10 ? unlocked + 1 : null;
        const nextCost = nextUnlock ? UPGRADE_LEVEL_COSTS[nextUnlock] : 0;
        const canAfford = nextUnlock ? (this.hud?.totalStuds || 0) >= nextCost : false;

        const barsHtml = Array.from({ length: 10 }, (_, idx) => {
          const lv = idx + 1;
          const cls =
            lv <= active
              ? 'customs-lv-seg active'
              : lv <= unlocked
                ? 'customs-lv-seg unlocked'
                : 'customs-lv-seg';
          return `<span class="${cls}"></span>`;
        }).join('');

        return `
          <div class="creator-sec customs-upgrade-card">
            <div class="customs-upg-header">
              <span class="creator-lbl" style="margin:0;">${attr.shortLabel || attr.name}</span>
              <span class="customs-lv-badge">STAGE ${active} / ${unlocked}</span>
            </div>
            <div class="creator-pow-desc">${attr.desc}</div>
            <div class="customs-lv-bar">${barsHtml}</div>
            <div class="customs-upg-controls">
              <button type="button" class="customs-step-btn" data-upg-step="-1" data-attr="${k}" title="Reduzir Stage" style="pointer-events:auto;" ${active <= 0 ? 'disabled' : ''}>${CUSTOMS_SVGS.minus}</button>
              <button type="button" class="customs-step-btn" data-upg-step="1" data-attr="${k}" title="Subir Stage" style="pointer-events:auto;" ${active >= unlocked ? 'disabled' : ''}>${CUSTOMS_SVGS.plus}</button>
              ${
                nextUnlock
                  ? `<button type="button" class="customs-unlock-btn ${canAfford ? '' : 'locked-cost'}"
                      data-upg-unlock="${k}" style="pointer-events:auto;">
                      ${CUSTOMS_SVGS.bolt}
                      <span>STAGE ${nextUnlock} // ${nextCost.toLocaleString('pt-BR')} STUDS</span>
                    </button>`
                  : `<span class="customs-maxed-tag">${CUSTOMS_SVGS.check} STAGE 10 MAX</span>`
              }
            </div>
          </div>
        `;
      }).join('');
    } else if (this.activeTab === 'paint') {
      bodyEl.innerHTML = `
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">IDENTIFICAÇÃO DO PROJETO (ECU TAG)</label>
          <input id="customs-car-name-input" type="text" maxlength="24" value="${d.customName || ''}" class="creator-input customs-pro-input" style="pointer-events:auto;" />
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">PINTURA METÁLICA PRIMÁRIA (16 TONS)</label>
          <div class="creator-swatches-row customs-swatches-grid">${this._renderSwatches(d.primaryColorId, 'primaryColorId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">COR SECUNDÁRIA // TETO, FAIXAS & PINÇAS</label>
          <div class="creator-swatches-row customs-swatches-grid">${this._renderSwatches(d.secondaryColorId, 'secondaryColorId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ACABAMENTO AUTOMOTIVO 3D</label>
          <div class="creator-chips-grid customs-chips-grid">${this._renderChips(d.finishId, CUSTOMS_FINISHES, 'finishId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">PELÍCULA DOS VIDROS & FARÓIS</label>
          <div class="creator-pow-list">${this._renderPartCards(d.windowTintId || 'stock', CUSTOMS_WINDOW_TINTS, 'windowTintId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ADESIVOS & LIVERY DE CORRIDA</label>
          <div class="creator-chips-grid customs-chips-grid">${this._renderChips(d.decalId, CUSTOMS_DECALS, 'decalId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">NEON UNDERGLOW & COR DA LABAREDA [Q]</label>
          <div class="creator-chips-grid customs-chips-grid">${this._renderChips(d.underglowId, CUSTOMS_UNDERGLOW, 'underglowId')}</div>
        </div>
      `;
    } else if (this.activeTab === 'bodykit') {
      bodyEl.innerHTML = `
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">FRENTE, PARA-CHOQUE & RAMPA CUNHA</label>
          <div class="creator-pow-list">${this._renderPartCards(d.frontModId, CUSTOMS_FRONT_MODS, 'frontModId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">AEROFÓLIO, TURBINAS A JATO & WHEELIE BAR</label>
          <div class="creator-pow-list">${this._renderPartCards(d.spoilerId, CUSTOMS_SPOILERS, 'spoilerId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ESCAPAMENTOS, SIDE-PIPES & CHAMINÉS</label>
          <div class="creator-pow-list">${this._renderPartCards(d.exhaustModId || 'stock', CUSTOMS_EXHAUST_MODS, 'exhaustModId')}</div>
        </div>
      `;
    } else if (this.activeTab === 'roof_wheels') {
      bodyEl.innerHTML = `
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ACESSÓRIOS DE TETO, PAREDÃO CDD & GIROFLEX</label>
          <div class="creator-pow-list">${this._renderPartCards(d.roofModId || 'none', CUSTOMS_ROOF_MODS, 'roofModId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">CONJUNTO DE RODAS, PNEUS & MONSTER LIFT</label>
          <div class="creator-pow-list">${this._renderPartCards(d.wheelStyleId, CUSTOMS_WHEEL_STYLES, 'wheelStyleId')}</div>
        </div>
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">ANODIZAÇÃO / COR DOS AROS</label>
          <div class="creator-swatches-row customs-swatches-grid">${this._renderSwatches(d.wheelColorId, 'wheelColorId')}</div>
        </div>
      `;
    } else {
      bodyEl.innerHTML = `
        <div class="creator-sec customs-upgrade-card">
          <label class="creator-lbl">GARAGEM PESSOAL DO SAVE (3 BOXES)</label>
          <div class="creator-pow-desc" style="margin-bottom:10px;">
            Salve sua preparação completa em uma das 3 vagas para solicitar entrega imediata no pátio externo.
          </div>
          <div class="creator-pow-list">
            ${[0, 1, 2]
              .map((slotIdx) => {
                const saved = garageSave.savedCars[slotIdx];
                if (!saved) {
                  return `
                    <div class="creator-power-card customs-garage-slot" style="cursor:default;">
                      <div>
                        <div class="creator-pow-title">BOX 0${slotIdx + 1} // DISPONÍVEL</div>
                        <div class="creator-pow-desc">Nenhum projeto armazenado neste box.</div>
                      </div>
                      <div class="customs-slot-actions">
                        <button type="button" class="customs-action-chip" data-garage-save="${slotIdx}" style="pointer-events:auto;">${CUSTOMS_SVGS.save} <span>SALVAR PROJETO</span></button>
                      </div>
                    </div>
                  `;
                }
                const st = computeTunedVehicleStats(VEHICLE_SPECS[saved.carType], saved);
                return `
                  <div class="creator-power-card customs-garage-slot active" style="cursor:default;">
                    <div>
                      <div class="creator-pow-title">BOX 0${slotIdx + 1} // ${saved.customName || st.name}</div>
                      <div class="creator-pow-desc">
                        ${st.kmh} KM/H • NITRO ${st.turboKmh} KM/H • ${st.maxHp} HP • PULO ${st.jumpHeightMeters.toFixed(0)}M
                      </div>
                    </div>
                    <div class="customs-slot-actions">
                      <button type="button" class="customs-action-chip primary" data-garage-spawn="${slotIdx}" style="pointer-events:auto;">
                        ${CUSTOMS_SVGS.launch} <span>RETIRAR E ACELERAR</span>
                      </button>
                      <button type="button" class="customs-action-chip" data-garage-save="${slotIdx}" style="pointer-events:auto;">
                        ${CUSTOMS_SVGS.save} <span>ATUALIZAR</span>
                      </button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    }

    const nameInput = document.getElementById('customs-car-name-input');
    if (nameInput) {
      nameInput.addEventListener('input', (ev) => {
        this.draft.customName = String(ev.target.value || '').toUpperCase().slice(0, 24);
        this._applyLiveDraftToCar();
      });
    }

    if (typeof bodyEl.querySelectorAll !== 'function') return;

    // 1. Botões [-] e [+] GRÁTIS (0 até unlockedLevel)
    bodyEl.querySelectorAll('button[data-upg-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.attr;
        const delta = Number(btn.dataset.upgStep || 0);
        const maxUl = clampInt(getActiveGarageSaveData().unlockedLevels[attr], 0, 10);
        const nextVal = clampInt((this.draft.levels[attr] || 0) + delta, 0, maxUl);
        this.draft.levels[attr] = nextVal;
        soundFX.playPlasticHit?.();
        this._setFeedback(`MAPA ECU: ${attr.toUpperCase()} AJUSTADO PARA STAGE ${nextVal}`);
        this._applyLiveDraftToCar();
        this._renderModalBody();
      });
    });

    // 2. Botão DESBLOQUEAR PRÓXIMO STAGE (Paga em Studs!)
    bodyEl.querySelectorAll('button[data-upg-unlock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const attr = btn.dataset.upgUnlock;
        const gData = getActiveGarageSaveData();
        const curUl = clampInt(gData.unlockedLevels[attr], 0, 10);
        if (curUl >= 10) return;
        const nextLv = curUl + 1;
        const cost = UPGRADE_LEVEL_COSTS[nextLv];
        if ((this.hud?.totalStuds || 0) < cost) {
          soundFX.playPlasticHit?.();
          this._setFeedback(`SALDO INSUFICIENTE: NECESSÁRIO ${cost.toLocaleString('pt-BR')} STUDS`);
          return;
        }
        this.hud.totalStuds -= cost;
        this.hud.displayedStuds = this.hud.totalStuds;
        if (this.hud.studCountEl) {
          this.hud.studCountEl.textContent = this.hud.totalStuds.toLocaleString('pt-BR');
        }
        gData.unlockedLevels[attr] = nextLv;
        this.draft.levels[attr] = nextLv;
        if (attr === 'nitro') this.previewNitroTimer = 1.4;
        if (attr === 'hydraulics') {
          this.previewHydraulicTimer = 1.3;
          this._previewHydPhase = 0;
        }
        soundFX.playStudCollect?.(1000);
        this.hud.saveCurrentProgress?.();
        this._setFeedback(`STAGE ${nextLv} LIBERADO — REGULAGEM 0 A ${nextLv} DISPONÍVEL`);
        this._applyLiveDraftToCar();
        this._renderModalBody();
      });
    });

    // 3. Seletores Visuais & Compra de Peças Especiais (Teto, Escapamentos e Película)
    bodyEl.querySelectorAll('button[data-customs-field]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.customsField;
        const val = btn.dataset.val;
        if (!field || !val) return;

        const paidCatalog = PAID_PART_CATALOGS[field];
        if (paidCatalog) {
          const entry = paidCatalog.find((p) => p.id === val);
          if (entry && entry.cost > 0 && !this._isPartUnlocked(field, entry)) {
            if ((this.hud?.totalStuds ?? 0) < entry.cost) {
              soundFX.playPlasticHit?.();
              this._setFeedback(`SALDO INSUFICIENTE: ${entry.name.toUpperCase()} CUSTA ${entry.cost.toLocaleString('pt-BR')} STUDS`);
              return;
            }
            if (this.hud) {
              this.hud.totalStuds -= entry.cost;
              this.hud.displayedStuds = this.hud.totalStuds;
              if (this.hud.studCountEl) {
                this.hud.studCountEl.textContent = this.hud.totalStuds.toLocaleString('pt-BR');
              }
            }
            const gData = getActiveGarageSaveData();
            gData.unlockedParts = gData.unlockedParts || {};
            gData.unlockedParts[`${field}:${val}`] = true;
            soundFX.playStudCollect?.(1000);
            this.hud?.saveCurrentProgress?.();
            this._setFeedback(`PEÇA ADQUIRIDA E INSTALADA: ${entry.name.toUpperCase()}`);
          }
        }

        const prevVal = this.draft[field];
        this.draft[field] = val;
        if (field === 'exhaustModId' && val !== 'stock') {
          this.previewNitroTimer = 1.4;
        }
        if (field === 'spoilerId' && val === 'dual_jet_turbine') {
          this.previewNitroTimer = 1.4;
        }
        soundFX.playHeroSwap?.();
        this._applyLiveDraftToCar();
        if (
          (field === 'primaryColorId' || field === 'secondaryColorId') &&
          val !== prevVal
        ) {
          this._tryTriggerPayNSprayEscape();
        }
        this._renderModalBody();
      });
    });

    // 4. Salvar / Retirar dos 3 Slots da Garagem Pessoal
    bodyEl.querySelectorAll('button[data-garage-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = clampInt(btn.dataset.garageSave, 0, 2);
        const gData = getActiveGarageSaveData();
        gData.savedCars[idx] = JSON.parse(JSON.stringify(this.draft));
        this.hud.saveCurrentProgress?.();
        soundFX.playTrueHeroFanfare?.();
        this._setFeedback(`PROJETO SALVO NO BOX 0${idx + 1} DA GARAGEM`);
        this._renderModalBody();
      });
    });

    bodyEl.querySelectorAll('button[data-garage-spawn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = clampInt(btn.dataset.garageSpawn, 0, 2);
        this.spawnSavedGarageCar(idx);
      });
    });
  }

  spawnSavedGarageCar(slotIdx) {
    const gData = getActiveGarageSaveData();
    const saved = gData.savedCars?.[slotIdx];
    if (!saved || !this.world || !this.controller) return null;

    if (this._spawnedGarageCar && !this._spawnedGarageCar.destroyed && this.world.destructibles) {
      if (this.controller.currentVehicle === this._spawnedGarageCar) {
        this.controller.exitVehicle();
      }
      this.world.destructibles.removeDestructible(this._spawnedGarageCar);
      this._spawnedGarageCar = null;
    }

    const pad = this.world.legoCustomsData?.deliverySpawnPos || { x: 25, y: 0.38, z: -416, rotY: 0 };
    const spawned = spawnDraggableCustomVehicle(
      this.world,
      {
        x: pad.x,
        y: pad.y,
        z: pad.z,
        rotY: pad.rotY || 0,
        type: saved.carType
      },
      saved
    );
    this._spawnedGarageCar = spawned;

    if (this.isOpen) {
      this.isOpen = false;
      this.modalEl?.classList.add('hidden');
    }
    this._setStudioUiOverlayMode(false);

    if (this.controller.currentVehicle) {
      this.controller.exitVehicle();
    }
    if (spawned) {
      this.controller.enterVehicle(spawned);
      this.controller._customsExitCooldown = 2.0;
    }
    soundFX.playTrueHeroFanfare?.();
    this.controller.relockPointer?.();
    return spawned;
  }
}

export { LegoCustomsStudio as CustomsStudioModalController };
