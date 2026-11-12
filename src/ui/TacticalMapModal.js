import { getSvgIcon, drawCanvasVectorIcon } from './TacticalIcons.js';
import { TERRITORY_ZONES, FACTION_THEME } from '../world/FactionWarSystem.js';

/**
 * Modal do Mapa Tatico Completo [M] (Overhaul Completo de UX — Zero Emojis):
 * - Pins vetoriais puros desenhados no Canvas 2D (Cofre, Torre, Coroa CDD, Hexagono PCC, Ancora, Jato, Sol/Onda, Arvore, Escudo, Asas).
 * - Marcador do Aeroporta-Avioes (SKY) deslocado com linha pontilhada de chamada e tag ALTITUDE: 410m (nunca encavala com Banco ou Torre).
 * - Algoritmo Anti-Colisao AABB para rotulos dos marcos (zero sobreposicao de textos em qualquer nivel de zoom).
 * - Retangulos de regiao ocultos por padrao: so acendem o contorno brilhante e preenchimento translucido no Hover (no mapa ou na lista lateral).
 * - Lista lateral direita 100% integra (sem cortar o primeiro card), com Icone SVG exclusivo e botao explicito [ IR AGORA / TP ].
 */

function getInteractiveRegionsList(world) {
  const baseRegions = Array.isArray(world?.regions) ? [...world.regions] : [];
  const cddEntry = {
    id: 'favela_cdd_cv',
    number: 11,
    num: 'CDD',
    name: 'COMPLEXO DA CIDADE DE DEUS — DOMINIO DO CV',
    shortName: 'CIDADE DE DEUS (CV)',
    sub: 'Largo do Mirante, Baile do CV & Fortaleza no Morro',
    bounds: { minX: -1012, maxX: -530, minZ: -1320, maxZ: 580, minY: 0, maxY: 140 },
    spawn: { x: -702, y: 26.2, z: -135 },
    color: '#dc2626',
    icon: 'cdd'
  };
  const bankInteriorEntry = {
    id: 'super_banco_interior',
    number: 0,
    num: 'BNC',
    name: 'SUPER BANCO CENTRAL (INTERIOR)',
    shortName: 'SUPER BANCO (INTERIOR)',
    sub: 'Saguao Monumental de Marmore & Porta do Cofre',
    bounds: { minX: -65, maxX: 65, minZ: -235, maxZ: -120, minY: 0, maxY: 45 },
    spawn: { x: 0, y: 0.4, z: -150 },
    color: '#facc15',
    icon: 'bank'
  };
  const heroTowerInteriorEntry = {
    id: 'torre_herois_interior',
    number: 12,
    num: 'QG',
    name: 'TORRE DOS HEROIS (QG TERREO ENTRAVEL)',
    shortName: 'TORRE DOS HEROIS (QG TERREO)',
    sub: 'Hall of Armor, Mesa Holografica, Bacta Pods & Elevador [E]',
    bounds: { minX: -375, maxX: -260, minZ: -235, maxZ: -125, minY: 0, maxY: 36 },
    spawn: { x: -318, y: 0.5, z: -138 },
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
    bounds: { minX: -95, maxX: 95, minZ: -125, maxZ: -95, minY: -8, maxY: 0 },
    spawn: { x: 0, y: -6.7, z: -105.5 },
    color: '#06b6d4',
    icon: 'metro'
  };
  return [...baseRegions, cddEntry, bankInteriorEntry, heroTowerInteriorEntry, metroCentralEntry];
}

export function populateFullMapSidebar(hud, world, controller) {
  if (!hud.fullmapListEl || !world?.regions) return;
  hud.fullmapListEl.innerHTML = '';
  hud.fullmapListEl.scrollTop = 0;

  const allEntries = getInteractiveRegionsList(world);

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
      hud.hoveredRegionId = r.id;
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    });
    btn.addEventListener('mouseleave', () => {
      if (hud.hoveredRegionId === r.id) {
        hud.hoveredRegionId = null;
      }
      hud.renderFullMap(world, controller.position, controller.facingAngle, controller);
    });
    btn.addEventListener('click', () => {
      hud._teleportPlayerTo(controller, r.spawn, r.shortName || r.name);
    });

    hud.fullmapListEl.appendChild(btn);
  }
}

function findHoveredRegionOnMap(world, wx, wz) {
  if (!world?.regions) return null;
  // Prioriza regioes especificas menores (Torre dos Herois, Aeroporta-Avioes, CDD) antes de regioes amplas
  if (wx >= -375 && wx <= -260 && wz >= -235 && wz <= -125) {
    return 'torre_herois';
  }
  if (
    wx >= -1012 &&
    wx <= -528 &&
    wz >= -1320 &&
    wz <= 580 &&
    (wx <= -658 || (wz >= -508 && wz <= 415))
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

function getLandmarkPinWorldCoords(lm) {
  return {
    pinX: lm.displayX ?? lm.x,
    pinZ: lm.displayZ ?? lm.z
  };
}

export function bindFullMapInteractions(hud, world, controller) {
  if (!hud.fullmapCanvas || hud._fullmapEventsBound) return;
  hud._fullmapEventsBound = true;

  if (hud.fullmapZoomInBtn) {
    hud.fullmapZoomInBtn.addEventListener('click', () => {
      hud.mapZoom = Math.min(5.5, hud.mapZoom * 1.3);
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
      hud.mapZoom = Math.max(0.85, Math.min(5.5, hud.mapZoom * factor));
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

    const hitRadiusWorld = 82 / hud.mapZoom;
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

    const hitRadiusWorld = 82 / hud.mapZoom;
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

  const baseScale = 0.138;
  const scale = baseScale * hud.mapZoom;
  const cx = w * 0.48 + hud.mapPanX;
  const cy = h * 0.48 + hud.mapPanY;

  return {
    wx: (clickX - cx) / scale,
    wz: (clickY - cy) / scale
  };
}

/**
 * Resolve colisoes AABB entre as caixas de rotulo dos marcos e os pins para garantir ZERO texto encavalado!
 */
function computeNonOverlappingLandmarkLabels(ctx, landmarks, toX, toY) {
  const placedBoxes = [];
  const pinCircles = landmarks.map((lm) => {
    const { pinX, pinZ } = getLandmarkPinWorldCoords(lm);
    return { x: toX(pinX), y: toY(pinZ), r: 13 };
  });

  const results = [];

  for (const lm of landmarks) {
    const { pinX, pinZ } = getLandmarkPinWorldCoords(lm);
    const lx = toX(pinX);
    const ly = toY(pinZ);

    ctx.font = '700 9.5px "Chakra Petch", sans-serif';
    const titleText = `${lm.code} // ${lm.label}`;
    const textW = typeof ctx.measureText === 'function' ? ctx.measureText(titleText).width : titleText.length * 5.6;
    const subText = lm.altitudeLabel || '';
    const subW = subText
      ? typeof ctx.measureText === 'function'
        ? ctx.measureText(subText).width
        : subText.length * 5.2
      : 0;

    const boxW = Math.ceil(Math.max(textW, subW) + 14);
    const boxH = subText ? 25 : 15;

    let bx = lx - boxW * 0.5;
    let by = ly + 13;

    if (lm.labelPos === 'top') {
      bx = lx - boxW * 0.5;
      by = ly - 13 - boxH;
    } else if (lm.labelPos === 'left') {
      bx = lx - 14 - boxW;
      by = ly - boxH * 0.5;
    } else if (lm.labelPos === 'right') {
      bx = lx + 14;
      by = ly - boxH * 0.5;
    }

    // Passo Anti-Colisao AABB deterministico
    for (let iter = 0; iter < 12; iter++) {
      let moved = false;

      // Evita cobrir qualquer pin vetorial
      for (const pc of pinCircles) {
        const closestX = Math.max(bx, Math.min(pc.x, bx + boxW));
        const closestY = Math.max(by, Math.min(pc.y, by + boxH));
        if (Math.hypot(pc.x - closestX, pc.y - closestY) < pc.r + 2) {
          by += by + boxH * 0.5 < pc.y ? -8 : 8;
          moved = true;
        }
      }

      // Evita cruzar com outros rotulos ja posicionados
      for (const other of placedBoxes) {
        const pad = 3;
        const overlapX = bx < other.bx + other.boxW + pad && bx + boxW + pad > other.bx;
        const overlapY = by < other.by + other.boxH + pad && by + boxH + pad > other.by;
        if (overlapX && overlapY) {
          const dy = by + boxH * 0.5 - (other.by + other.boxH * 0.5);
          by += dy >= 0 ? other.by + other.boxH + pad - by : other.by - pad - (by + boxH);
          moved = true;
        }
      }

      if (!moved) break;
    }

    placedBoxes.push({ bx, by, boxW, boxH });
    results.push({ lm, lx, ly, bx, by, boxW, boxH, titleText, subText });
  }

  return results;
}

export function renderFullMapCanvas(hud, world, playerPos, playerFacingYaw = 0) {
  if (!hud.fullmapCanvas || !world) return;
  const ctx = hud.fullmapCanvas.getContext('2d');
  if (!ctx) return;

  const w = hud.fullmapCanvas.width;
  const h = hud.fullmapCanvas.height;
  const baseScale = 0.138; // 680px cobre ~4900m na visao 1.0x
  const scale = baseScale * hud.mapZoom;
  const cx = w * 0.48 + hud.mapPanX;
  const cy = h * 0.48 + hud.mapPanY;

  const toX = (wx) => cx + wx * scale;
  const toY = (wz) => cy + wz * scale;

  ctx.clearRect(0, 0, w, h);

  // 1. Oceano Atlantico Escuro + Grade Tatica de Coordenadas
  ctx.fillStyle = '#061220';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
  ctx.lineWidth = 1;
  for (let g = -2000; g <= 2000; g += 250) {
    ctx.beginPath();
    ctx.moveTo(toX(g), 0);
    ctx.lineTo(toX(g), h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toY(g));
    ctx.lineTo(w, toY(g));
    ctx.stroke();
  }

  // 2. Massa Continental da Grande Ilha Metropolitana + Ilha da Prisao (100% alinhadas — ZERO tapetao cinza vazio!)
  ctx.fillStyle = '#141821';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.fillRect(toX(-1825), toY(-1320), 2465 * scale, 2365 * scale);
  ctx.strokeRect(toX(-1825), toY(-1320), 2465 * scale, 2365 * scale);
  ctx.fillRect(toX(580), toY(-1320), 1048 * scale, 2055 * scale);
  ctx.strokeRect(toX(580), toY(-1320), 1048 * scale, 2055 * scale);
  ctx.fillRect(toX(955), toY(1120), 840 * scale, 860 * scale);
  ctx.strokeRect(toX(955), toY(1120), 840 * scale, 860 * scale);

  // 3. Quarteiroes, Praias, Morro da CDD, Patios do Porto e Parques
  for (const blk of world.mapBlocks) {
    ctx.fillStyle = blk.color || '#1e293b';
    ctx.fillRect(toX(blk.x - blk.w * 0.5), toY(blk.z - blk.d * 0.5), blk.w * scale, blk.d * scale);
  }

  // 4. Lago Central, Canais de Santos e Canal Urbano Leste
  ctx.fillStyle = '#0284c7';
  for (const wt of world.mapWater) {
    ctx.fillRect(toX(wt.x - wt.w * 0.5), toY(wt.z - wt.d * 0.5), wt.w * scale, wt.d * scale);
  }

  // 5. Malha Viaria (Avenidas, Ladeiras da CDD, Vias do Porto e Ponte Blindada)
  for (const rd of world.mapRoads) {
    ctx.fillStyle = rd.isMain ? '#090a0d' : '#111827';
    ctx.fillRect(toX(rd.x - rd.w * 0.5), toY(rd.z - rd.d * 0.5), rd.w * scale, rd.d * scale);
  }

  // 6. Predios, Barracos, Silos, Conteineres e Estruturas em todos os Quarteiroes
  for (const bld of world.mapBuildings) {
    ctx.fillStyle = bld.color || '#475569';
    ctx.fillRect(toX(bld.x - bld.w * 0.5), toY(bld.z - bld.d * 0.5), bld.w * scale, bld.d * scale);
  }

  // 6.5 LINHA 01 CIRCULAR DO METRÔ LEGO (Tracejada no Subsolo Y = -6.8m + Contínua no Elevado Y = +12.2m + 2 Trens ao Vivo!)
  if (Array.isArray(world.metroLoopWaypoints) && world.metroLoopWaypoints.length > 2) {
    const wps = world.metroLoopWaypoints;
    for (let i = 0; i < wps.length; i++) {
      const a = wps[i];
      const b = wps[(i + 1) % wps.length];
      const isUnderground = a.y < -0.5 && b.y < -0.5;
      ctx.save();
      if (isUnderground && typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([5, 4]);
      }
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(toX(a.x), toY(a.z));
      ctx.lineTo(toX(b.x), toY(b.z));
      ctx.stroke();

      ctx.strokeStyle = isUnderground ? '#06b6d4' : '#22d3ee';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(toX(a.x), toY(a.z));
      ctx.lineTo(toX(b.x), toY(b.z));
      ctx.stroke();
      ctx.restore();
    }
  }

  if (world.metroSystem && Array.isArray(world.metroSystem.trains)) {
    for (const tr of world.metroSystem.trains) {
      const leadCar = tr.cars?.[1] || tr.cars?.[0];
      if (!leadCar) continue;
      const tx = toX(leadCar.pos.x);
      const ty = toY(leadCar.pos.z);
      ctx.fillStyle = tr.state === 'STOPPED' ? '#facc15' : '#22d3ee';
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 1.8;
      ctx.fillRect(tx - 4.5, ty - 4.5, 9, 9);
      ctx.strokeRect(tx - 4.5, ty - 4.5, 9, 9);
    }
  }

  // 7. Destaque Inteligente de Regiao APENAS no Hover (Sem retangulos cruzados fixos poluindo o mapa!)
  const allRegions = getInteractiveRegionsList(world);
  if (hud.hoveredRegionId) {
    const hoveredRegion = allRegions.find((r) => r.id === hud.hoveredRegionId);
    if (hoveredRegion && hoveredRegion.bounds) {
      const rx = toX(hoveredRegion.bounds.minX);
      const ry = toY(hoveredRegion.bounds.minZ);
      const rw = (hoveredRegion.bounds.maxX - hoveredRegion.bounds.minX) * scale;
      const rh = (hoveredRegion.bounds.maxZ - hoveredRegion.bounds.minZ) * scale;

      ctx.save();
      if (hoveredRegion.id === 'aeroporta_avioes') {
        ctx.setLineDash([7, 5]);
      }
      ctx.fillStyle = `${hoveredRegion.color}36`;
      ctx.strokeStyle = hoveredRegion.color;
      ctx.lineWidth = 3.2;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  }

  // 7.2 CONTORNOS PONTILHADOS DAS 3 ZONAS DE FACÇÃO (CV, PCC e A.R.E.S.) + ÍCONE DA FACÇÃO DONA + 3 OUTPOSTS
  const liveTerritories = world.livingCity?.factionWar?.territories;
  for (const [zKey, zSpec] of Object.entries(TERRITORY_ZONES)) {
    const liveState = liveTerritories?.[zKey];
    const ownerKey = liveState?.ownerFaction || zSpec.defaultOwner;
    const theme = FACTION_THEME[ownerKey] || FACTION_THEME.cv;
    const b = zSpec.bounds;

    const zx = toX(b.minX);
    const zy = toY(b.minZ);
    const zw = (b.maxX - b.minX) * scale;
    const zh = (b.maxZ - b.minZ) * scale;

    ctx.save();
    ctx.fillStyle = `${theme.color}1c`;
    ctx.fillRect(zx, zy, zw, zh);
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([8, 6]);
    }
    ctx.strokeStyle = theme.color;
    ctx.lineWidth = 2.6;
    ctx.strokeRect(zx, zy, zw, zh);
    ctx.restore();

    // Emblema da Facção Dona do Território (CV / PCC / A.R.E.S.) + Sigla
    const badgePos = zSpec.mapBadgePos || {
      x: (b.minX + b.maxX) * 0.5,
      z: (b.minZ + b.maxZ) * 0.5
    };
    const bx = toX(badgePos.x);
    const by = toY(badgePos.z);

    ctx.save();
    ctx.fillStyle = 'rgba(9, 10, 13, 0.92)';
    ctx.strokeStyle = theme.color;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(bx, by, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawCanvasVectorIcon(ctx, theme.icon, bx, by, 10.5, theme.color);

    const tagLabel = `DOMÍNIO: ${theme.shortTag}`;
    ctx.font = '800 10px "JetBrains Mono", monospace';
    const measuredW =
      typeof ctx.measureText === 'function'
        ? ctx.measureText(tagLabel).width
        : tagLabel.length * 6.2;
    const tw = measuredW + 12;
    ctx.fillStyle = 'rgba(9, 10, 13, 0.92)';
    ctx.fillRect(bx - tw * 0.5, by + 15, tw, 15);
    ctx.strokeRect(bx - tw * 0.5, by + 15, tw, 15);
    ctx.fillStyle = theme.color;
    ctx.textAlign = 'center';
    ctx.fillText(tagLabel, bx, by + 26);
    ctx.textAlign = 'left';
    ctx.restore();

    // Marcadores dos 3 Postos de Comando (P1, P2, P3) na cor da facção controladora daquele posto!
    const outposts = liveState?.outposts || zSpec.outposts;
    for (const op of outposts) {
      const opOwner = op.ownerFaction || ownerKey;
      const opTheme = FACTION_THEME[opOwner] || theme;
      const ox = toX(op.x);
      const oy = toY(op.z);

      ctx.save();
      ctx.fillStyle = '#090a0d';
      ctx.strokeStyle = opTheme.color;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(ox, oy, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = opTheme.color;
      ctx.font = '800 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(op.code, ox, oy + 3);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  // 7.5 Telemetria Viva no Mapa [M]: Zonas de Guerra, Combatentes (BOPE/CV/PCC/A.R.E.S.) e Comboio do Carro-Forte ($)
  if (world.livingCity) {
    const nowTime = performance.now() * 0.001;
    const policeBlinkGold = Math.sin(nowTime * 8.0) > 0;

    if (Array.isArray(world.livingCity.activeWarzones)) {
      for (const wz of world.livingCity.activeWarzones) {
        const wx = toX(wz.x);
        const wy = toY(wz.z);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(wx, wy, 11 * Math.max(0.85, hud.mapZoom * 0.65), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (Array.isArray(world.livingCity.combatNpcs)) {
      for (const npc of world.livingCity.combatNpcs) {
        if (!npc.destructible || npc.destructible.destroyed || !npc.visual?.root) continue;
        const pos = npc.visual.root.position;
        const nx = toX(pos.x);
        const ny = toY(pos.z);
        ctx.fillStyle =
          npc.faction === 'police'
            ? policeBlinkGold
              ? '#facc15'
              : '#38bdf8'
            : npc.faction === 'cv'
              ? '#ef4444'
              : npc.faction === 'pcc'
                ? '#38bdf8'
                : '#d946ef';
        ctx.beginPath();
        ctx.arc(nx, ny, npc.isMecha ? 3.8 : 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const convoy = world.livingCity.armoredConvoy;
    if (convoy && convoy.active && convoy.truck?.destructible && !convoy.truck.destructible.destroyed) {
      const cPos = convoy.truck.mesh.position;
      const cxMap = toX(cPos.x);
      const cyMap = toY(cPos.z);
      ctx.fillStyle = '#090a0d';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cxMap, cyMap, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', cxMap, cyMap + 3.5);
      ctx.textAlign = 'left';
    }
  }

  // 8. Pins Vetoriais Elegantes + Rotulos Anti-Colisao + Linha de Chamada para o Aeroporta-Avioes (SKY)
  const labelLayouts = computeNonOverlappingLandmarkLabels(ctx, world.landmarks || [], toX, toY);

  // 8.1 Desenha primeiro a linha de chamada pontilhada para marcos aereos deslocados (ex: SKY Aeroporta-Avioes)
  for (const item of labelLayouts) {
    const { lm, lx, ly } = item;
    if (lm.displayX !== undefined || lm.displayZ !== undefined) {
      const gx = toX(lm.x);
      const gy = toY(lm.z);

      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = lm.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.restore();

      // Anel de projecao vertical no solo sob o Aeroporta-Avioes
      ctx.fillStyle = 'rgba(96, 165, 250, 0.25)';
      ctx.strokeStyle = lm.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gx, gy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 8.2 Desenha os Pins Vetoriais e as Pliquetas de Rotulo sem sobreposicao
  for (const item of labelLayouts) {
    const { lm, lx, ly, bx, by, boxW, boxH, titleText, subText } = item;
    const isHoveredLm = hud.hoveredLandmark?.id === lm.id;
    const pinR = isHoveredLm ? 12 : 10;

    // Pin Circular/Octogonal Tatico com sombra dura
    ctx.fillStyle = '#090a0d';
    ctx.strokeStyle = isHoveredLm ? '#ffffff' : lm.color;
    ctx.lineWidth = isHoveredLm ? 2.8 : 2.0;
    ctx.beginPath();
    ctx.arc(lx, ly, pinR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Icone Vetorial Exclusivo dentro do Pin
    drawCanvasVectorIcon(ctx, lm.icon, lx, ly, pinR, lm.color);

    // Plaqueta de Rotulo Anti-Colisao
    ctx.fillStyle = 'rgba(9, 10, 13, 0.92)';
    ctx.strokeStyle = isHoveredLm ? '#ffffff' : `${lm.color}aa`;
    ctx.lineWidth = isHoveredLm ? 1.8 : 1.1;
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 9.5px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, bx + boxW * 0.5, by + 11);

    if (subText) {
      ctx.fillStyle = lm.color;
      ctx.font = '800 8px "JetBrains Mono", monospace';
      ctx.fillText(subText, bx + boxW * 0.5, by + 21.5);
    }
  }
  ctx.textAlign = 'left';

  // 9. Waypoint Personalizado (Com Reticula Vetorial — Zero Emoji)
  if (world.waypoint && playerPos) {
    const wpx = toX(world.waypoint.x);
    const wpy = toY(world.waypoint.z);
    const ppx = toX(playerPos.x);
    const ppy = toY(playerPos.z);

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ppx, ppy);
    ctx.lineTo(wpx, wpy);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#090a0d';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(wpx, wpy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawCanvasVectorIcon(ctx, 'waypoint', wpx, wpy, 10, '#00f0ff');

    const distM = Math.round(Math.hypot(world.waypoint.x - playerPos.x, world.waypoint.z - playerPos.z));
    const wpLabel = `DESTINO MARCADO (${distM}m)`;
    ctx.font = '800 9.5px "JetBrains Mono", monospace';
    const wpw = (typeof ctx.measureText === 'function' ? ctx.measureText(wpLabel).width : wpLabel.length * 5.8) + 14;
    ctx.fillStyle = 'rgba(9, 10, 13, 0.92)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.4;
    ctx.fillRect(wpx + 13, wpy - 8, wpw, 16);
    ctx.strokeRect(wpx + 13, wpy - 8, wpw, 16);
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(wpLabel, wpx + 20, wpy + 3.5);
  }

  // 10. Marcador Atual do Jogador (Seta Tatica Amarela)
  if (playerPos) {
    const px = toX(playerPos.x);
    const py = toY(playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-playerFacingYaw + Math.PI);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#090a0d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7.5, 7.5);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7.5, 7.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 11. Card Tatico de Detalhes no Canto Superior Esquerdo quando uma Regiao ou Marco esta em Hover
  const activeRegion = hud.hoveredRegionId
    ? allRegions.find((r) => r.id === hud.hoveredRegionId)
    : null;
  if (activeRegion) {
    const cardX = 14;
    const cardY = 14;
    const cardW = 320;
    const cardH = 54;

    ctx.fillStyle = 'rgba(9, 10, 13, 0.94)';
    ctx.strokeStyle = activeRegion.color || '#facc15';
    ctx.lineWidth = 2;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.fillStyle = activeRegion.color || '#facc15';
    ctx.fillRect(cardX, cardY, 5, cardH);

    const codeStr = `SETOR R-${activeRegion.num || '01'} // CLIQUE NO PIN OU LISTA PARA VIAGEM RAPIDA`;
    ctx.font = '800 8.5px "JetBrains Mono", monospace';
    ctx.fillText(codeStr, cardX + 14, cardY + 16);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 12px "Chakra Petch", sans-serif';
    ctx.fillText(activeRegion.name, cardX + 14, cardY + 33);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 8.5px "JetBrains Mono", monospace';
    ctx.fillText((activeRegion.sub || '').slice(0, 48), cardX + 14, cardY + 46);
  }
}
