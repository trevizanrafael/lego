import { getSvgIcon } from '../TacticalIcons.js';
import { WORLD_SCALE, wsBounds, wsPos3, fromWs } from '../../world/core/WorldLayoutScale.js';

/**
 * Monta a lista unificada de regiões e interiores interativos para o Mapa Tático [M] e Viagem Rápida
 */
export function getInteractiveRegionsList(world) {
  const baseRegions = Array.isArray(world?.regions) ? [...world.regions] : [];
  const cddEntry = {
    id: 'favela_cdd_cv',
    number: 11,
    num: 'CDD',
    name: 'COMPLEXO DA CIDADE DE DEUS — DOMINIO DO CV',
    shortName: 'CIDADE DE DEUS (CV)',
    sub: 'Largo do Mirante, Baile do CV & Fortaleza no Morro',
    bounds: wsBounds({ minX: -1012, maxX: -530, minZ: -1320, maxZ: 580, minY: 0, maxY: 140 }),
    spawn: wsPos3({ x: -702, y: 26.2, z: -135 }),
    color: '#dc2626',
    icon: 'cdd'
  };
  const bankInteriorEntry = {
    id: 'super_banco_interior',
    number: 0,
    num: 'BNC',
    name: 'SUPER BANCO CENTRAL (INTERIOR)',
    shortName: 'SUPER BANCO (INTERIOR)',
    sub: '4 Andares: Saguao, Escritorios, Seguranca e Cofre',
    bounds: wsBounds({ minX: -76, maxX: 76, minZ: -235, maxZ: -120, minY: 0, maxY: 45 }),
    spawn: wsPos3({ x: 0, y: 0.4, z: -150 }),
    color: '#facc15',
    icon: 'bank'
  };
  const heroTowerInteriorEntry = {
    id: 'torre_herois_interior',
    number: 12,
    num: 'QG',
    name: 'TORRE DOS HEROIS (QG TERREO ENTRAVEL)',
    shortName: 'TORRE DOS HEROIS (QG TERREO)',
    sub: 'Hall of Armor, Mesa Holografica, Bacta Pods & Elevador [F]',
    bounds: wsBounds({ minX: -375, maxX: -260, minZ: -235, maxZ: -125, minY: 0, maxY: 36 }),
    spawn: wsPos3({ x: -318, y: 0.5, z: -138 }),
    color: '#38bdf8',
    icon: 'tower'
  };
  const metroCentralEntry = {
    id: 'metro_central_subsolo',
    number: 13,
    num: 'M01',
    name: 'LINHA 01 DO METRO LEGO (ESTACAO CENTRAL SUBSOLO)',
    shortName: 'METRO CENTRAL (SUBSOLO)',
    sub: 'Subsolo Entravel (-6.8m), Tunel Iluminado, Linha Elevada & 2 Trens LEGO',
    bounds: wsBounds({ minX: -95, maxX: 95, minZ: -125, maxZ: -95, minY: -8, maxY: 0 }),
    spawn: wsPos3({ x: 0, y: -6.7, z: -105.5 }),
    color: '#06b6d4',
    icon: 'metro'
  };
  return [...baseRegions, cddEntry, bankInteriorEntry, heroTowerInteriorEntry, metroCentralEntry];
}

export function populateFullMapSidebar(hud, world, controller) {
  if (!hud.fullmapListEl || !world?.regions) return;

  const allEntries = getInteractiveRegionsList(world);
  if (
    hud._sidebarRegionCount === allEntries.length &&
    hud._sidebarWorldRef === world &&
    hud.fullmapListEl.children?.length > 0
  ) {
    return;
  }
  hud._sidebarRegionCount = allEntries.length;
  hud._sidebarWorldRef = world;

  hud.fullmapListEl.innerHTML = '';
  hud.fullmapListEl.scrollTop = 0;

  for (const r of allEntries) {
    const codeNum = r.num || String(r.number || 1).padStart(2, '0');
    const titleText = r.shortName || r.name;
    const subText = r.sub || r.name;
    const accentColor = r.color || '#facc15';
    const svgIcon = getSvgIcon(r.icon || 'pin', accentColor, 18);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'region-item-btn';
    btn.dataset.regionId = r.id;
    btn.style.borderLeftColor = accentColor;
    btn.innerHTML = `
      <div class="region-item-main">
        <div class="region-item-icon-box" style="border-color: ${accentColor}66">
          ${svgIcon}
        </div>
        <div class="region-item-left">
          <span class="region-item-title">${titleText}</span>
          <span class="region-item-sub">${subText}</span>
        </div>
      </div>
      <div class="region-item-right">
        <span class="region-item-code" style="border-left-color: ${accentColor}">R-${codeNum}</span>
        <span class="region-item-tp-btn">[ IR AGORA / TP ]</span>
      </div>
    `;

    btn.addEventListener('mouseenter', () => {
      const ctrl = hud._lastController || controller;
      hud.hoveredRegionId = r.id;
      hud.renderFullMap(world, ctrl?.position, ctrl?.facingAngle, ctrl);
    });
    btn.addEventListener('mouseleave', () => {
      const ctrl = hud._lastController || controller;
      if (hud.hoveredRegionId === r.id) {
        hud.hoveredRegionId = null;
      }
      hud.renderFullMap(world, ctrl?.position, ctrl?.facingAngle, ctrl);
    });
    btn.addEventListener('click', () => {
      const ctrl = hud._lastController || controller;
      hud._teleportPlayerTo(ctrl, r.spawn, r.shortName || r.name);
    });

    hud.fullmapListEl.appendChild(btn);
  }
}

export function findHoveredRegionOnMap(world, wx, wz) {
  if (!world?.regions) return null;
  const ux = fromWs(wx);
  const uz = fromWs(wz);
  if (ux >= -375 && ux <= -260 && uz >= -235 && uz <= -125) {
    return 'torre_herois';
  }
  if (
    ux >= -1012 &&
    ux <= -528 &&
    uz >= -1320 &&
    uz <= 580 &&
    (ux <= -658 || (uz >= -508 && uz <= 415))
  ) {
    return 'favela_cdd_cv';
  }
  for (const r of world.regions) {
    if (r.id === 'aeroporta_avioes' || r.id === 'torre_herois') continue;
    const b = r.bounds;
    if (wx >= b.minX && wx <= b.maxX && wz >= b.minZ && wz <= b.maxZ) {
      return r.id;
    }
  }
  return null;
}

export function getLandmarkPinWorldCoords(lm) {
  return {
    pinX: lm.displayX ?? lm.x,
    pinZ: lm.displayZ ?? lm.z
  };
}

export function bindFullMapInteractions(hud, world, controller) {
  if (!hud.fullmapCanvas || hud._fullmapEventsBound) return;
  hud._fullmapEventsBound = true;
  const maxMapZoom = 5.5 * WORLD_SCALE;

  if (hud.fullmapZoomInBtn) {
    hud.fullmapZoomInBtn.addEventListener('click', () => {
      hud.mapZoom = Math.min(maxMapZoom, hud.mapZoom * 1.3);
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    });
  }
  if (hud.fullmapZoomOutBtn) {
    hud.fullmapZoomOutBtn.addEventListener('click', () => {
      hud.mapZoom = Math.max(0.85, hud.mapZoom / 1.3);
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    });
  }
  if (hud.fullmapResetBtn) {
    hud.fullmapResetBtn.addEventListener('click', () => {
      hud.mapZoom = 1.0;
      hud.mapPanX = 0;
      hud.mapPanY = 0;
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    });
  }
  if (hud.fullmapClearWpBtn) {
    hud.fullmapClearWpBtn.addEventListener('click', () => {
      world.clearWaypoint();
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    });
  }

  if (hud.fullmapModalEl) {
    hud.fullmapModalEl.addEventListener(
      'wheel',
      (e) => {
        e.stopPropagation();
      },
      { passive: true }
    );
  }

  hud.fullmapCanvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      hud.mapZoom = Math.max(0.85, Math.min(maxMapZoom, hud.mapZoom * factor));
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    },
    { passive: false }
  );

  hud.fullmapCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      hud._isDraggingMap = true;
      hud._dragMoved = false;
      hud._dragStartX = e.clientX - hud.mapPanX;
      hud._dragStartY = e.clientY - hud.mapPanY;
    }
  });

  hud.fullmapCanvas.addEventListener('mousemove', (e) => {
    if (hud._isDraggingMap || !hud.isFullMapOpen) return;
    const coords = screenToWorldMapCoords(hud, e);
    if (!coords) return;

    const hitRadiusWorld = (82 * WORLD_SCALE) / hud.mapZoom;
    let foundLandmark = null;
    for (const lm of world.landmarks || []) {
      const { pinX, pinZ } = getLandmarkPinWorldCoords(lm);
      if (
        Math.hypot(coords.wx - pinX, coords.wz - pinZ) <= hitRadiusWorld ||
        Math.hypot(coords.wx - lm.x, coords.wz - lm.z) <= hitRadiusWorld * 0.75
      ) {
        foundLandmark = lm;
        break;
      }
    }

    const foundRegionId =
      foundLandmark?.id === 'lm_sky'
        ? 'aeroporta_avioes'
        : foundLandmark?.id === 'lm_cdd'
          ? 'favela_cdd_cv'
          : findHoveredRegionOnMap(world, coords.wx, coords.wz);

    if (hud.hoveredLandmark?.id !== foundLandmark?.id || hud.hoveredRegionId !== foundRegionId) {
      hud.hoveredLandmark = foundLandmark;
      hud.hoveredRegionId = foundRegionId;
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    }
  });

  hud.fullmapCanvas.addEventListener('mouseleave', () => {
    if (hud.hoveredLandmark || hud.hoveredRegionId) {
      hud.hoveredLandmark = null;
      hud.hoveredRegionId = null;
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!hud._isDraggingMap || !hud.isFullMapOpen) return;
    const nx = e.clientX - hud._dragStartX;
    const ny = e.clientY - hud._dragStartY;
    if (Math.hypot(nx - hud.mapPanX, ny - hud.mapPanY) > 5) {
      hud._dragMoved = true;
    }
    hud.mapPanX = nx;
    hud.mapPanY = ny;
    hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
  });

  window.addEventListener('mouseup', () => {
    hud._isDraggingMap = false;
  });

  hud.fullmapCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const coords = screenToWorldMapCoords(hud, e);
    if (coords) {
      world.setWaypoint(coords.wx, coords.wz);
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    }
  });

  hud.fullmapCanvas.addEventListener('click', (e) => {
    if (hud._dragMoved) return;
    const coords = screenToWorldMapCoords(hud, e);
    if (!coords) return;

    const hitRadiusWorld = (82 * WORLD_SCALE) / hud.mapZoom;
    for (const lm of world.landmarks || []) {
      const { pinX, pinZ } = getLandmarkPinWorldCoords(lm);
      if (
        Math.hypot(coords.wx - pinX, coords.wz - pinZ) <= hitRadiusWorld ||
        Math.hypot(coords.wx - lm.x, coords.wz - lm.z) <= hitRadiusWorld * 0.75
      ) {
        hud._teleportPlayerTo(controller, lm.spawn, lm.label);
        return;
      }
    }

    world.setWaypoint(coords.wx, coords.wz);
    hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
  });
}

export function screenToWorldMapCoords(hud, e) {
  if (!hud.fullmapCanvas) return null;
  const rect = hud.fullmapCanvas.getBoundingClientRect();
  const w = hud.fullmapCanvas.width;
  const h = hud.fullmapCanvas.height;
  const clickX = ((e.clientX - rect.left) / rect.width) * w;
  const clickY = ((e.clientY - rect.top) / rect.height) * h;

  const baseScale = 0.088 / WORLD_SCALE;
  const scale = baseScale * hud.mapZoom;
  const cx = w * 0.48 + hud.mapPanX;
  const cy = h * 0.48 + hud.mapPanY;

  return {
    wx: (clickX - cx) / scale,
    wz: (clickY - cy) / scale
  };
}
