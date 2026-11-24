// Mapa Tático no controle, no padrão GTA (V/VI):
//  • Analógico esquerdo move o cursor; encostar na borda arrasta o mapa.
//  • Analógico direito arrasta o mapa direto.
//  • RT aproxima / LT afasta (zoom suave, ancorado no ponto sob o cursor).
//  • A = selecionar (viagem rápida num marco / waypoint no resto do mapa).
//  • X = limpar waypoint • Y = recentralizar • B ou ☰ = fechar.

import { WORLD_SCALE } from '../../../world/core/WorldLayoutScale.js';

export const MAP_ZOOM_MIN = 0.85;
export const MAP_ZOOM_MAX = 5.5 * WORLD_SCALE;
export const MAP_ZOOM_RATE = 1.7; // ln(zoom)/s com o gatilho no talo
export const MAP_STICK_PAN_SPEED = 900; // px de canvas/s (analógico direito)
export const MAP_EDGE_PAN_SPEED = 700; // px de canvas/s (cursor encostado na borda)
export const MAP_EDGE_FRACTION = 0.1;

/** Escala de desenho idêntica a `screenToWorldMapCoords`/painter do mapa. */
function mapScale(zoom) {
  return (0.088 / WORLD_SCALE) * zoom;
}

/**
 * Aplica zoom mantendo fixo o ponto do mundo sob (px, py) em coordenadas de canvas.
 * Retorna o novo { zoom, panX, panY } (função pura, testável).
 */
export function zoomMapAroundPoint(state, px, py, canvasW, canvasH, factor) {
  const zoom0 = state.zoom;
  const zoom1 = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, zoom0 * factor));
  const cx0 = canvasW * 0.48 + state.panX;
  const cy0 = canvasH * 0.48 + state.panY;
  const wx = (px - cx0) / mapScale(zoom0);
  const wz = (py - cy0) / mapScale(zoom0);
  const cx1 = px - wx * mapScale(zoom1);
  const cy1 = py - wz * mapScale(zoom1);
  return { zoom: zoom1, panX: cx1 - canvasW * 0.48, panY: cy1 - canvasH * 0.48 };
}

export class GamepadMapNavigator {
  constructor(runtime) {
    this.runtime = runtime;
  }

  _canvasInfo(hud) {
    const canvas = hud?.fullmapCanvas;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect?.() || { left: 0, top: 0, width: canvas.width || 1, height: canvas.height || 1 };
    if (!rect.width || !rect.height) return null;
    return { canvas, rect, w: canvas.width || rect.width, h: canvas.height || rect.height };
  }

  _render(hud, ctl) {
    if (!ctl) return;
    hud.renderFullMap?.(ctl.world, ctl.position, ctl.facingAngle, ctl);
  }

  /** Um frame de navegação com o mapa aberto. `edge(name)` devolve 'down'/'up'/null. */
  update(dt, pressed, left, right, triggers, edge) {
    const rt = this.runtime;
    const hud = rt.hud;
    const ctl = rt.controller;
    const cursor = rt.cursor;
    const info = this._canvasInfo(hud);
    let dirty = false;

    if (left.mag > 0) cursor?.move?.(left.x, left.y, dt);

    if (info) {
      const { rect, w, h } = info;
      const toCanvasX = (cx) => ((cx - rect.left) / rect.width) * w;
      const toCanvasY = (cy) => ((cy - rect.top) / rect.height) * h;
      const cursorX = cursor ? toCanvasX(cursor.x) : w * 0.5;
      const cursorY = cursor ? toCanvasY(cursor.y) : h * 0.5;

      // Arrasto pelo analógico direito.
      if (right.mag > 0) {
        hud.mapPanX -= right.x * MAP_STICK_PAN_SPEED * dt;
        hud.mapPanY -= right.y * MAP_STICK_PAN_SPEED * dt;
        dirty = true;
      }
      // Cursor encostado na borda arrasta o mapa (como no GTA).
      if (cursor && left.mag > 0) {
        const fx = (cursor.x - rect.left) / rect.width;
        const fy = (cursor.y - rect.top) / rect.height;
        if ((fx < MAP_EDGE_FRACTION && left.x < 0) || (fx > 1 - MAP_EDGE_FRACTION && left.x > 0)) { hud.mapPanX -= left.x * MAP_EDGE_PAN_SPEED * dt; dirty = true; }
        if ((fy < MAP_EDGE_FRACTION && left.y < 0) || (fy > 1 - MAP_EDGE_FRACTION && left.y > 0)) { hud.mapPanY -= left.y * MAP_EDGE_PAN_SPEED * dt; dirty = true; }
      }
      // Zoom suave nos gatilhos, ancorado no cursor.
      const zoomAxis = (triggers.rt || 0) - (triggers.lt || 0);
      if (Math.abs(zoomAxis) > 0.05) {
        const next = zoomMapAroundPoint({ zoom: hud.mapZoom || 1, panX: hud.mapPanX || 0, panY: hud.mapPanY || 0 }, cursorX, cursorY, w, h, Math.exp(zoomAxis * MAP_ZOOM_RATE * dt));
        hud.mapZoom = next.zoom; hud.mapPanX = next.panX; hud.mapPanY = next.panY;
        dirty = true;
      }
    }

    if (edge('A') === 'down') cursor?.press?.();
    if (edge('A') === 'up') cursor?.release?.();
    if (edge('X') === 'down') { ctl?.world?.clearWaypoint?.(); dirty = true; }
    if (edge('Y') === 'down') { hud.mapZoom = 1.0; hud.mapPanX = 0; hud.mapPanY = 0; dirty = true; }
    if (edge('B') === 'down' || edge('VIEW') === 'down') { rt.emitKey('Escape', true); rt.emitKey('Escape', false); }
    if (edge('MENU') === 'down') { rt.emitKey('KeyM', true); rt.emitKey('KeyM', false); }

    if (dirty) this._render(hud, ctl);
  }
}
