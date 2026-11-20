// ============================================================================
// SISTEMA DO OPERADOR CUSTOMIZÁVEL OP-09 — FACHADA FINA ORQUESTRADORA
// Submódulos em `src/entities/custom-hero/*`:
//   - CustomHeroCatalogAndSave.js | CustomHero3DAssembler.js
//   - CustomHeroPowerRuntime.js   | UndergroundLabAndCreatorUI.js
// ============================================================================

import { applyLiveDraftTo3DMinifig, updateCustomHeroStudioCamera } from './custom-hero/CustomHero3DAssembler.js';
import {
  initPowerRuntimeState, onCustomHeroSwitched, getCustomHeroSpeedMultiplier,
  fireCustomHeroPrimary, handleCustomHeroSpacePress, triggerCustomHeroMobilityKey,
  triggerCustomHeroSuperAbility, damageConeAhead, damageRadius,
  spawnExpandingRing, spawnIceCrystalCluster, updateCustomHeroPowerRuntime
} from './custom-hero/CustomHeroPowerRuntime.js';
import {
  initCreatorStudioState, bindCreatorModalControls, openCreatorStudio, closeCreatorStudio,
  renderCreatorColorSwatches, renderCreatorOptionChips, renderCreatorPowerCards, renderCreatorPanelContent
} from './custom-hero/UndergroundLabAndCreatorUI.js';

export {
  CUSTOM_HEAD_COLORS, CUSTOM_LEGO_PALETTE, CUSTOM_FACES, CUSTOM_HEADGEAR,
  CUSTOM_TORSO_PRINTS, CUSTOM_BACK_GEAR, CUSTOM_PRIMARY_POWERS,
  CUSTOM_MOBILITY_POWERS, CUSTOM_SUPER_POWERS,
  createDefaultCustomHeroState, getActiveCustomHero, setActiveCustomHero,
  findHeadColor, findPaletteColor, getOp09CatalogEntry, getOp09MinifigPreset
} from './custom-hero/CustomHeroCatalogAndSave.js';

export {
  drawCustomFaceDetails2D, createCustomFaceTexture, createCustomTorsoTexture,
  drawOp09Portrait2D, attachOp09CustomRigToMinifigure
} from './custom-hero/CustomHero3DAssembler.js';

export class CustomHeroPowerRuntime {
  constructor(controller) { initPowerRuntimeState(this, controller); }
  onHeroSwitched(newHeroKey) { onCustomHeroSwitched(this, newHeroKey); }
  getSpeedMultiplier() { return getCustomHeroSpeedMultiplier(this); }
  firePrimary(aimPoint) { fireCustomHeroPrimary(this, aimPoint); }
  handleSpacePress(deltaTap) { return handleCustomHeroSpacePress(this, deltaTap); }
  triggerMobilityKey() { triggerCustomHeroMobilityKey(this); }
  triggerSuperAbility() { triggerCustomHeroSuperAbility(this); }
  _damageConeAhead(origin, yaw, maxDist, damage, knockCars = false) {
    damageConeAhead(this, origin, yaw, maxDist, damage, knockCars);
  }
  _damageRadius(center, radius, damage, canBreakHeavy = false) {
    damageRadius(this, center, radius, damage, canBreakHeavy);
  }
  _spawnExpandingRing(pos, hex, maxScale = 12.0, duration = 0.45) {
    spawnExpandingRing(this, pos, hex, maxScale, duration);
  }
  _spawnIceCrystalCluster(pos) { spawnIceCrystalCluster(this, pos); }
  update(dt) { updateCustomHeroPowerRuntime(this, dt); }
}

export class CustomHeroCreatorStudio {
  constructor(hud) { initCreatorStudioState(this, hud); }
  _bindModalControls() { bindCreatorModalControls(this); }
  open(controller, world) { openCreatorStudio(this, controller, world); }
  close(keepEdited = false) { closeCreatorStudio(this, keepEdited); }
  updateStudioCamera(dt) { updateCustomHeroStudioCamera(this, dt); }
  _applyLiveDraftTo3DMinifig() { applyLiveDraftTo3DMinifig(this); }
  _renderColorSwatches(selectedId, palette, attrName) {
    return renderCreatorColorSwatches(selectedId, palette, attrName);
  }
  _renderOptionChips(selectedId, list, attrName) {
    return renderCreatorOptionChips(selectedId, list, attrName);
  }
  _renderPowerCards(selectedId, list, attrName) {
    return renderCreatorPowerCards(selectedId, list, attrName);
  }
  _renderPanelContent() { renderCreatorPanelContent(this); }
}
