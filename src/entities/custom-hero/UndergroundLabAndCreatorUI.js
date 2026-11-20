import { soundFX } from '../../audio/SoundFX.js';
import {
  CUSTOM_HEAD_COLORS,
  CUSTOM_LEGO_PALETTE,
  CUSTOM_FACES,
  CUSTOM_HEADGEAR,
  CUSTOM_TORSO_PRINTS,
  CUSTOM_BACK_GEAR,
  CUSTOM_PRIMARY_POWERS,
  CUSTOM_MOBILITY_POWERS,
  CUSTOM_SUPER_POWERS,
  createDefaultCustomHeroState,
  getActiveCustomHero,
  setActiveCustomHero
} from './CustomHeroCatalogAndSave.js';

// ============================================================================
// PORÃO SUBTERRÂNEO DA TORRE (Y = -8.2m), CONSOLE [E] & MODAL INTERATIVO
// ============================================================================

export function initCreatorStudioState(studio, hud) {
  studio.hud = hud;
  studio.isOpen = false;
  studio.activeTab = 'appearance'; // 'appearance' | 'powers'
  studio.draft = createDefaultCustomHeroState();
  studio.previewYaw = 0;
  studio.controller = null;
  studio.world = null;

  studio.modalEl = document.getElementById('custom-hero-creator-modal');
  studio._bindModalControls();
}

export function bindCreatorModalControls(studio) {
  if (!studio.modalEl) return;

  document.getElementById('btn-creator-close')?.addEventListener('click', () => {
    studio.close(false);
  });
  document.getElementById('btn-creator-tab-app')?.addEventListener('click', () => {
    studio.activeTab = 'appearance';
    studio._renderPanelContent();
  });
  document.getElementById('btn-creator-tab-pow')?.addEventListener('click', () => {
    studio.activeTab = 'powers';
    studio._renderPanelContent();
  });
  document.getElementById('btn-creator-rot-left')?.addEventListener('click', () => {
    studio.previewYaw -= 0.45;
    studio._applyLiveDraftTo3DMinifig();
  });
  document.getElementById('btn-creator-rot-right')?.addEventListener('click', () => {
    studio.previewYaw += 0.45;
    studio._applyLiveDraftTo3DMinifig();
  });
  document.getElementById('btn-creator-reset-civilian')?.addEventListener('click', () => {
    studio.draft = createDefaultCustomHeroState();
    setActiveCustomHero(studio.draft);
    studio._applyLiveDraftTo3DMinifig();
    studio.hud.saveCurrentProgress?.();
    soundFX.playPlasticHit();
    studio.close(true);
  });
  document.getElementById('btn-creator-save-equip')?.addEventListener('click', () => {
    studio.draft.isCreated = true;
    if (!studio.draft.name || studio.draft.name === 'CIDADÃO COMUM') {
      studio.draft.name = 'GUARDIÃO NEON';
    }
    setActiveCustomHero(studio.draft);
    studio.hud.saveCurrentProgress?.();
    soundFX.playTrueHeroFanfare();
    if (studio.controller?.destructibles) {
      studio.controller.destructibles.spawnHeroSwapEffect(studio.controller.position, 0x00f0ff);
    }
    studio.close(true);
  });
}

export function openCreatorStudio(studio, controller, world) {
  if (!controller || !world) return;
  studio.controller = controller;
  studio.world = world;
  studio.isOpen = true;
  studio.activeTab = 'appearance';

  const cur = getActiveCustomHero();
  studio._savedSnapshot = { ...cur };
  studio._previousHeroKey = controller.minifigure?.currentHeroKey || 'op09';
  studio.draft = {
    ...cur,
    isCreated: true,
    name: cur.isCreated ? cur.name : 'GUARDIÃO NEON'
  };

  // Posiciona o boneco em cima do Pedestal Holográfico no Porão (Y = -8.2m)
  const ped = world.customizerLabPedestal?.pedestalPos || { x: -332, y: -7.55, z: -167 };
  if (controller.currentVehicle) controller.exitVehicle();
  controller.isFlying = false;
  controller.isSupersonic = false;
  controller.velocity.set(0, 0, 0);
  controller.position.set(ped.x, ped.y, ped.z);
  studio.previewYaw = Math.PI * 0.5; // Olhando para a câmera Leste!

  if (document.pointerLockElement && document.exitPointerLock) {
    document.exitPointerLock();
  }

  studio._applyLiveDraftTo3DMinifig();
  studio._renderPanelContent();
  studio.modalEl?.classList.remove('hidden');
  soundFX.playHeroSwap();
}

export function closeCreatorStudio(studio, keepEdited = false) {
  if (!studio.isOpen) return;
  studio.isOpen = false;
  studio.modalEl?.classList.add('hidden');

  if (!keepEdited && studio._savedSnapshot) {
    // Restaura o estado salvo caso tenha fechado no [X] sem salvar
    setActiveCustomHero(studio._savedSnapshot);
  }
  studio.hud?.syncOp09UI?.();
  studio.controller?.switchToHero(keepEdited ? 'op09' : (studio._previousHeroKey || 'op09'));

  if (studio.controller && studio.world?.customizerLabPedestal?.exitPos) {
    const ex = studio.world.customizerLabPedestal.exitPos;
    studio.controller.position.set(ex.x, ex.y, ex.z);
    studio.controller.minifigure.root.position.copy(studio.controller.position);
  }
  studio.controller?.relockPointer?.();
}

export function renderCreatorColorSwatches(selectedId, palette, attrName) {
  return palette
    .map(
      (c) => `
        <button class="creator-swatch ${c.id === selectedId ? 'active' : ''}"
          data-creator-field="${attrName}" data-val="${c.id}"
          title="${c.name}" style="background:${c.css}"></button>
      `
    )
    .join('');
}

export function renderCreatorOptionChips(selectedId, list, attrName) {
  return list
    .map(
      (item) => `
        <button class="creator-chip ${item.id === selectedId ? 'active' : ''}"
          data-creator-field="${attrName}" data-val="${item.id}">
          ${item.name}
        </button>
      `
    )
    .join('');
}

export function renderCreatorPowerCards(selectedId, list, attrName) {
  return list
    .map(
      (p) => `
        <button class="creator-power-card ${p.id === selectedId ? 'active' : ''}"
          data-creator-field="${attrName}" data-val="${p.id}">
          <div class="creator-pow-title">${p.name}</div>
          <div class="creator-pow-desc">${p.desc}</div>
        </button>
      `
    )
    .join('');
}

export function renderCreatorPanelContent(studio) {
  const bodyEl = document.getElementById('creator-panel-body');
  const tabApp = document.getElementById('btn-creator-tab-app');
  const tabPow = document.getElementById('btn-creator-tab-pow');
  tabApp?.classList.toggle('active', studio.activeTab === 'appearance');
  tabPow?.classList.toggle('active', studio.activeTab === 'powers');
  if (!bodyEl) return;

  const d = studio.draft;
  if (studio.activeTab === 'appearance') {
    bodyEl.innerHTML = `
        <div class="creator-sec">
          <label class="creator-lbl">NOME DO OPERADOR (ATÉ 20 LETRAS)</label>
          <input id="creator-name-input" type="text" maxlength="20" value="${d.name}" class="creator-input" />
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">COR DA CABEÇA / PELE (10 CORES LEGO)</label>
          <div class="creator-swatches-row">${studio._renderColorSwatches(d.headColorId, CUSTOM_HEAD_COLORS, 'headColorId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">ROSTO / EXPRESSÃO (8 INÉDITOS)</label>
          <div class="creator-chips-grid">${studio._renderOptionChips(d.faceId, CUSTOM_FACES, 'faceId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">CABELO / CAPACETE (10 MODELOS 3D INÉDITOS + COR)</label>
          <div class="creator-chips-grid">${studio._renderOptionChips(d.hairId, CUSTOM_HEADGEAR, 'hairId')}</div>
          <div class="creator-swatches-row" style="margin-top:6px;">${studio._renderColorSwatches(d.hairColorId, CUSTOM_LEGO_PALETTE, 'hairColorId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">ESTAMPA DO TORSO (8 INÉDITAS) & COR DO TORSO</label>
          <div class="creator-chips-grid">${studio._renderOptionChips(d.torsoPrintId, CUSTOM_TORSO_PRINTS, 'torsoPrintId')}</div>
          <div class="creator-swatches-row" style="margin-top:6px;">${studio._renderColorSwatches(d.torsoColorId, CUSTOM_LEGO_PALETTE, 'torsoColorId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">COR DOS BRAÇOS, MÃOS/LUVAS & CALÇAS</label>
          <div class="creator-mini-sub">BRAÇOS:</div>
          <div class="creator-swatches-row">${studio._renderColorSwatches(d.armColorId, CUSTOM_LEGO_PALETTE, 'armColorId')}</div>
          <div class="creator-mini-sub">MÃOS / LUVAS:</div>
          <div class="creator-swatches-row">${studio._renderColorSwatches(d.handColorId, [...CUSTOM_HEAD_COLORS.slice(0, 4), ...CUSTOM_LEGO_PALETTE.slice(0, 10)], 'handColorId')}</div>
          <div class="creator-mini-sub">PERNAS / CALÇA:</div>
          <div class="creator-swatches-row">${studio._renderColorSwatches(d.legColorId, CUSTOM_LEGO_PALETTE, 'legColorId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">ACESSÓRIO DE COSTAS (5 OPÇÕES + COR)</label>
          <div class="creator-chips-grid">${studio._renderOptionChips(d.backId, CUSTOM_BACK_GEAR, 'backId')}</div>
          <div class="creator-swatches-row" style="margin-top:6px;">${studio._renderColorSwatches(d.backColorId, CUSTOM_LEGO_PALETTE, 'backColorId')}</div>
        </div>
      `;
  } else {
    bodyEl.innerHTML = `
        <div class="creator-sec">
          <label class="creator-lbl">1. ATAQUE PRINCIPAL [MOUSE 1] (4 INÉDITOS)</label>
          <div class="creator-pow-list">${studio._renderPowerCards(d.primaryPowerId, CUSTOM_PRIMARY_POWERS, 'primaryPowerId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">2. MOBILIDADE ESPECIAL [ESPAÇO NO AR / F] (4 INÉDITAS)</label>
          <div class="creator-pow-list">${studio._renderPowerCards(d.mobilityPowerId, CUSTOM_MOBILITY_POWERS, 'mobilityPowerId')}</div>
        </div>
        <div class="creator-sec">
          <label class="creator-lbl">3. SUPER-HABILIDADE [Q] (4 INÉDITAS)</label>
          <div class="creator-pow-list">${studio._renderPowerCards(d.superPowerId, CUSTOM_SUPER_POWERS, 'superPowerId')}</div>
        </div>
      `;
  }

  const nameInput = document.getElementById('creator-name-input');
  if (nameInput) {
    nameInput.addEventListener('input', (ev) => {
      studio.draft.name = String(ev.target.value || '').toUpperCase().slice(0, 20);
      studio._applyLiveDraftTo3DMinifig();
    });
  }

  if (typeof bodyEl.querySelectorAll === 'function') {
    bodyEl.querySelectorAll('button[data-creator-field]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const field = btn.dataset.creatorField;
        const val = btn.dataset.val;
        if (field && val) {
          studio.draft[field] = val;
          soundFX.playPlasticHit();
          studio._applyLiveDraftTo3DMinifig();
          studio._renderPanelContent();
        }
      });
    });
  }
}
