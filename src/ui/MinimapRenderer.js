import {
  updateDynamicMinimapZoom,
  paintRotatedTerrainAndRoads
} from './minimap/MinimapTerrainAndRoadsPainter.js';
import {
  updateMinimapHeaderAndTelemetry,
  updateMinimapCompassIndicator,
  createRadarScreenProjection,
  paintRadarGridAndVisionCone,
  paintLivingCityTacticalBlips,
  paintLocalLandmarks,
  paintEdgePinnedWaypoints,
  paintPlayerTacticalArrow
} from './minimap/MinimapMarkersAndRadarHUD.js';

/**
 * Renderizador do Radar Local Dinâmico (Minimapa na HUD — Zero Emojis):
 * - Fachada fina orquestrando `MinimapTerrainAndRoadsPainter` e `MinimapMarkersAndRadarHUD`.
 * - Zoom dinâmico por velocidade (175m a pé -> até 340m voando/dirigindo rápido).
 * - Gira sincronizado com a câmera 3D.
 * - Ícone N (Norte) orbital preso na moldura externa com prioridade máxima de camada.
 * - Marcos das regiões só aparecem quando estão REALMENTE dentro do alcance local do radar.
 * - Edge-Pinning exclusivo para Destino Marcado (Waypoint) e Emergências Ativas, com sistema Anti-Colisão Angular contra o [N].
 * - Rodapé tático limpo com Coordenadas (X, Z) e Altitude (Y) / Velocidade (KM/H).
 */
export function renderMinimapRadar(
  hud,
  playerPos,
  playerFacingYaw = 0,
  cameraYaw = 0,
  currentRegion = null,
  world = null,
  playerSpeed = 0,
  dt = 0.016
) {
  // 1. Cabeçalho da região atual, toast de transição e telemetria no rodapé
  updateMinimapHeaderAndTelemetry(hud, playerPos, currentRegion, world, playerSpeed);

  // 2. Zoom dinâmico por velocidade e indicador orbital da bússola [N]
  updateDynamicMinimapZoom(hud, playerSpeed, dt);
  const northScreenAngle = updateMinimapCompassIndicator(hud, cameraYaw);

  if (!hud.minimapCanvas || !playerPos) return;
  const ctx = hud.minimapCanvas.getContext('2d');
  if (!ctx) return;

  // 3. Terreno rotacionado: oceano, Pangeia, quadras, ruas, viadutos/metrô e zonas de facção
  const view = paintRotatedTerrainAndRoads(ctx, hud, playerPos, cameraYaw, world);

  // 4. Grade circular de alcance e cone de visão tático da câmera
  paintRadarGridAndVisionCone(ctx, view);

  // 5. Blips táticos da cidade viva, marcos locais e pinos de Waypoint/Emergência na borda
  if (world) {
    const proj = createRadarScreenProjection(playerPos, cameraYaw, view);
    paintLivingCityTacticalBlips(ctx, world, proj);
    paintLocalLandmarks(ctx, world, proj);
    paintEdgePinnedWaypoints(ctx, world, proj, northScreenAngle);
  }

  // 6. Seta tática central do jogador
  paintPlayerTacticalArrow(ctx, view, cameraYaw, playerFacingYaw);
}
