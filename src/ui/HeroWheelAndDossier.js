/**
 * Fachada fina da Roda Radial de Operadores [TAB] e Dossiê Tático Individual [H].
 *
 * Submódulos em `./wheel-dossier/`:
 * - `HeroWheelCanvasRenderer.js`: Metadados dos operadores, retratos LEGO em Canvas 2D e roda radial `[TAB]` estilo GTA V.
 * - `HeroDossierModalController.js`: Fichas táticas de poderes, passivas, controles e controlador do modal de Dossiê `[H]`.
 */
import {
  HERO_CATALOG,
  syncOp09CatalogSlot as syncWheelOp09CatalogSlot,
  getHeroInfo as resolveHeroCatalogInfo,
  drawHeroLegoPortrait as paintHeroLegoPortrait,
  renderHeroWheelCanvas as paintHeroWheelCanvas
} from './wheel-dossier/HeroWheelCanvasRenderer.js';
import {
  hydrateHeroCatalogPowerSheets,
  renderHeroDossierModal as updateHeroDossierModal
} from './wheel-dossier/HeroDossierModalController.js';

// Garante que todas as fichas de poderes estejam hidratadas na instância oficial de HERO_CATALOG
hydrateHeroCatalogPowerSheets(HERO_CATALOG);

export { HERO_CATALOG };

/**
 * Sincroniza o slot customizável OP-09 no catálogo tático ativo.
 */
export function syncOp09CatalogSlot() {
  return syncWheelOp09CatalogSlot();
}

/**
 * Retorna os metadados e ficha completa do operador informado (com fallback para OP-01).
 */
export function getHeroInfo(heroKey) {
  return resolveHeroCatalogInfo(heroKey);
}

/**
 * Desenha o retrato vetorial LEGO 2D de qualquer operador em um contexto Canvas 2D.
 */
export function drawHeroLegoPortrait(ctx, w, h, presetKey) {
  return paintHeroLegoPortrait(ctx, w, h, presetKey);
}

/**
 * Atualiza e renderiza o modal do Dossiê Tático Individual `[H]` para o operador selecionado.
 */
export function renderHeroDossierModal(hud, heroKey) {
  return updateHeroDossierModal(hud, heroKey);
}

/**
 * Renderiza a Roda Radial `[TAB]` estilo GTA V em Canvas 2D com destaque direcional e telemetria central.
 */
export function renderHeroWheelCanvas(canvas, selectedHeroKey, activeHeroKey) {
  return paintHeroWheelCanvas(canvas, selectedHeroKey, activeHeroKey);
}
