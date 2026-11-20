/**
 * Fachada fina do Modal do Mapa Tático Completo [M] (Overhaul Completo de UX — Zero Emojis):
 * - Pins vetoriais puros desenhados no Canvas 2D (Cofre, Torre, Coroa CDD, Hexágono PCC, Âncora, Jato, Sol/Onda, Árvore, Escudo, Asas).
 * - Marcador do Aeroporta-Aviões (SKY) deslocado com linha pontilhada de chamada e tag ALTITUDE: 410m.
 * - Algoritmo Anti-Colisão AABB para rótulos dos marcos (zero sobreposição de textos em qualquer nível de zoom).
 * - Retângulos de região ocultos por padrão: só acendem contorno brilhante no Hover.
 *
 * Submódulos em `./map/`:
 * - `TacticalMapCanvasPainter.js`: Renderização vetorial 2D das 10 regiões, costa da Pangeia, vias, metrô, facções e legenda.
 * - `TacticalMapInteractionController.js`: Zoom/pan no canvas sem vazar scroll para a câmera 3D, Waypoint 3D e Viagem Rápida.
 */
import { renderFullMapCanvas as paintFullMapCanvas } from './map/TacticalMapCanvasPainter.js';
import {
  populateFullMapSidebar as buildFullMapSidebar,
  bindFullMapInteractions as attachFullMapInteractions,
  screenToWorldMapCoords as projectScreenToWorldMapCoords
} from './map/TacticalMapInteractionController.js';

/**
 * Popula a lista lateral direita de regiões e interiores com ícone SVG exclusivo e botão `[ IR AGORA / TP ]`.
 * @param {object} hud Instância do controlador HUD principal.
 * @param {object} world Instância do mundo 3D contendo `regions`.
 * @param {object} controller Controlador ativo do jogador para teleporte e posição.
 */
export function populateFullMapSidebar(hud, world, controller) {
  return buildFullMapSidebar(hud, world, controller);
}

/**
 * Registra os eventos de zoom, pan por arraste, hover de regiões/marcos, Waypoint 3D e Viagem Rápida
 * sobre o canvas tático bloqueando vazamento de scroll (`wheel`) para a câmera 3D.
 * @param {object} hud Instância do controlador HUD principal.
 * @param {object} world Instância do mundo 3D.
 * @param {object} controller Controlador ativo do jogador.
 */
export function bindFullMapInteractions(hud, world, controller) {
  return attachFullMapInteractions(hud, world, controller);
}

/**
 * Converte coordenadas de clique/ponteiro na tela para coordenadas `(wx, wz)` do mundo 3D no mapa.
 * @param {object} hud Instância do controlador HUD com `fullmapCanvas`, `mapZoom`, `mapPanX` e `mapPanY`.
 * @param {MouseEvent} e Evento de mouse sobre o canvas do mapa.
 * @returns {{ wx: number, wz: number } | null}
 */
export function screenToWorldMapCoords(hud, e) {
  return projectScreenToWorldMapCoords(hud, e);
}

/**
 * Renderiza todo o Canvas 2D do Mapa Tático `[M]` com a Pangeia, regiões, metrô, facções, pins e jogador.
 * @param {object} hud Instância do controlador HUD principal.
 * @param {object} world Instância do mundo 3D.
 * @param {{ x: number, z: number } | null} playerPos Posição atual do herói.
 * @param {number} [playerFacingYaw=0] Ângulo de orientação horizontal do herói.
 */
export function renderFullMapCanvas(hud, world, playerPos, playerFacingYaw = 0) {
  return paintFullMapCanvas(hud, world, playerPos, playerFacingYaw);
}
