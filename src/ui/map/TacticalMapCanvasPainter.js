import {
  drawCanvasVectorIcon,
  remapBlockColorToGothamNoir,
  remapBuildingColorToGothamNoir,
  getGothamBuildingStrokeColor,
  remapBiomeTintToGothamNoir,
  remapRegionBorderToGothamNoir,
  classifyGothamRoadKind
} from '../TacticalIcons.js';
import { TERRITORY_ZONES, FACTION_THEME } from '../../world/FactionWarSystem.js';
import {
  MAIN_WEST_POLYGON,
  EAST_PENINSULA_POLYGON,
  PRISON_ISLAND_POLYGON,
  ARCHIPELAGO_ISLETS,
  REGION_BIOME_MAP,
  REGION_BORDER_LINES,
  PANGAEA_HIGHWAYS
} from '../../world/CoastlineProfile.js';
import {
  getInteractiveRegionsList,
  getLandmarkPinWorldCoords
} from './TacticalMapInteractionController.js';

function drawChamferedPlaque(ctx, x, y, w, h, cut, fillStyle, strokeStyle, lineWidth = 1.2) {
  const c = Math.min(cut, w * 0.25, h * 0.45);
  ctx.fillStyle = fillStyle;
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + c);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Resolve colisoes AABB entre as caixas de rotulo dos marcos e os pins para garantir ZERO texto encavalado!
 */
export function computeNonOverlappingLandmarkLabels(ctx, landmarks, toX, toY) {
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

/**
 * Renderização vetorial 2D completa do Mapa Tático [M] estilo Batcomputador / Gotham Dark Sonar:
 * costa batimétrica, 10 regiões noturnas, malha viária grafite, prédios sonar 3D, Linha 01 do Metrô,
 * territórios de facção, combate ao vivo, pins anti-colisão chanfrados e card de setor.
 */
export function renderFullMapCanvas(hud, world, playerPos, playerFacingYaw = 0) {
  if (!hud.fullmapCanvas || !world) return;
  const ctx = hud.fullmapCanvas.getContext('2d');
  if (!ctx) return;

  const w = hud.fullmapCanvas.width;
  const h = hud.fullmapCanvas.height;
  const baseScale = 0.088; // 680px cobre toda a super-escala Pangeia (~7700m na visao 1.0x)
  const scale = baseScale * hud.mapZoom;
  const cx = w * 0.48 + hud.mapPanX;
  const cy = h * 0.48 + hud.mapPanY;

  const toX = (wx) => cx + wx * scale;
  const toY = (wz) => cy + wz * scale;

  ctx.clearRect(0, 0, w, h);

  // 1. Oceano Abissal Gotham (#030509) + Grade Tatica Militar Escura
  ctx.fillStyle = '#030509';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(71, 85, 105, 0.12)';
  ctx.lineWidth = 1;
  for (let g = -3600; g <= 3600; g += 400) {
    ctx.beginPath();
    ctx.moveTo(toX(g), 0);
    ctx.lineTo(toX(g), h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toY(g));
    ctx.lineTo(w, toY(g));
    ctx.stroke();
  }

  const drawPolyPath = (poly) => {
    if (!poly || poly.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    ctx.closePath();
  };

  // 2. Linhas Batimetricas Costeiras de Sonar (ZERO ciano brilhante e ZERO praia amarela)
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    drawPolyPath(poly);
    ctx.lineWidth = Math.max(5, 46 * scale);
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.14)';
    ctx.stroke();
    ctx.lineWidth = Math.max(2.6, 22 * scale);
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)';
    ctx.stroke();
  }
  ctx.restore();

  // Massa Continental (#090c13) + Contorno Costeiro em Aco Escuro (#243044)
  ctx.fillStyle = '#090c13';
  ctx.strokeStyle = '#243044';
  ctx.lineWidth = 1.8;
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    drawPolyPath(poly);
    ctx.fill();
    ctx.stroke();
  }

  // Ilhotas do Arquipelago em Tons Sombrios (ZERO borda amarela)
  for (const isl of ARCHIPELAGO_ISLETS) {
    ctx.beginPath();
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(toX(isl.x), toY(isl.z), isl.rx * scale, isl.rz * scale, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(toX(isl.x), toY(isl.z), Math.max(isl.rx, isl.rz) * scale, 0, Math.PI * 2);
    }
    ctx.fillStyle =
      isl.biome === 'sand' ? '#161513' : isl.biome === 'forest' ? '#0b1613' : '#0f141e';
    ctx.fill();
    ctx.strokeStyle = '#243044';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Biomas Noturnos Dessaturados (globalAlpha = 0.09) & Fronteiras Tracejadas em Aco/Bronze/Carmesim
  ctx.save();
  ctx.beginPath();
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    if (!poly || poly.length < 3) continue;
    ctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    ctx.closePath();
  }
  ctx.clip();
  for (const reg of REGION_BIOME_MAP) {
    ctx.fillStyle = remapBiomeTintToGothamNoir(reg.tint);
    ctx.globalAlpha = 0.09;
    ctx.fillRect(
      toX(reg.minX),
      toY(reg.minZ),
      (reg.maxX - reg.minX) * scale,
      (reg.maxZ - reg.minZ) * scale
    );
  }
  ctx.globalAlpha = 0.68;
  if (typeof ctx.setLineDash === 'function') {
    ctx.setLineDash([6, 4]);
  }
  ctx.lineWidth = Math.max(1.2, 2.2 * scale);
  for (const brd of REGION_BORDER_LINES) {
    ctx.strokeStyle = remapRegionBorderToGothamNoir(brd.color);
    ctx.beginPath();
    ctx.moveTo(toX(brd.from[0]), toY(brd.from[1]));
    ctx.lineTo(toX(brd.to[0]), toY(brd.to[1]));
    ctx.stroke();
  }
  ctx.restore();

  // Rodovias Inter-Regionais da Pangeia (Meio-Fio #2e3d56 + Asfalto Grafite #1b2436)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const hwy of PANGAEA_HIGHWAYS) {
    if (!hwy.points || hwy.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(toX(hwy.points[0][0]), toY(hwy.points[0][1]));
    for (let i = 1; i < hwy.points.length; i++) {
      ctx.lineTo(toX(hwy.points[i][0]), toY(hwy.points[i][1]));
    }
    ctx.strokeStyle = '#2e3d56';
    ctx.lineWidth = Math.max(3.2, 27 * scale);
    ctx.stroke();

    ctx.strokeStyle = '#1b2436';
    ctx.lineWidth = Math.max(2.2, 23 * scale);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Quarteiroes, Orla Vulcanica, Morro da CDD, Patios do Porto e Parques em Gotham Noir
  const mapBlocks = world.mapBlocks || [];
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.55)';
  ctx.lineWidth = 0.7;
  for (const blk of mapBlocks) {
    const bx = toX(blk.x - blk.w * 0.5);
    const by = toY(blk.z - blk.d * 0.5);
    const bw = blk.w * scale;
    const bd = blk.d * scale;
    ctx.fillStyle = remapBlockColorToGothamNoir(blk.color, blk.type);
    ctx.fillRect(bx, by, bw, bd);
    if (scale >= 0.11) ctx.strokeRect(bx, by, bw, bd);
  }

  // 4. Lago Central e Canais Urbanos (#050912 Abissal + Borda Aco)
  ctx.fillStyle = '#050912';
  ctx.strokeStyle = '#172234';
  ctx.lineWidth = 0.9;
  for (const wt of world.mapWater || []) {
    const wx = toX(wt.x - wt.w * 0.5);
    const wy = toY(wt.z - wt.d * 0.5);
    const ww = wt.w * scale;
    const wd = wt.d * scale;
    ctx.fillRect(wx, wy, ww, wd);
    ctx.strokeRect(wx, wy, ww, wd);
  }

  // 5. Malha Viaria em 2 Passes (Avenidas #1b2436 + Meio-Fio #2e3d56, Locais #131a27, Pontes #222d42, Pista #161e2e)
  const mapRoads = world.mapRoads || [];
  for (const rd of mapRoads) {
    const kind = classifyGothamRoadKind(rd);
    const pad = kind === 'bridge' ? 1.2 : kind === 'main' || kind === 'runway' ? 0.9 : 0.5;
    ctx.fillStyle =
      kind === 'bridge' ? '#475569' : kind === 'main' || kind === 'runway' ? '#2e3d56' : '#1e293b';
    ctx.fillRect(
      toX(rd.x - rd.w * 0.5) - pad,
      toY(rd.z - rd.d * 0.5) - pad,
      rd.w * scale + pad * 2,
      rd.d * scale + pad * 2
    );
  }
  for (const rd of mapRoads) {
    const kind = classifyGothamRoadKind(rd);
    const rx = toX(rd.x - rd.w * 0.5);
    const ry = toY(rd.z - rd.d * 0.5);
    const rw = rd.w * scale;
    const rh = rd.d * scale;
    ctx.fillStyle =
      kind === 'bridge'
        ? '#222d42'
        : kind === 'runway'
          ? '#161e2e'
          : kind === 'main'
            ? '#1b2436'
            : '#131a27';
    ctx.fillRect(rx, ry, rw, rh);

    if (kind === 'runway' && Math.max(rw, rh) >= 14) {
      const horiz = rw >= rh;
      ctx.save();
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.48)';
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(rx + 4, ry + rh * 0.5);
        ctx.lineTo(rx + rw - 4, ry + rh * 0.5);
      } else {
        ctx.moveTo(rx + rw * 0.5, ry + 4);
        ctx.lineTo(rx + rw * 0.5, ry + rh - 4);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // 6. Predios, Barracos, Silos, Conteineres e Landmarks em Sonar 3D
  for (const bld of world.mapBuildings || []) {
    const isLm = Boolean(bld.isLandmark || bld.landmark);
    const bx = toX(bld.x - bld.w * 0.5);
    const by = toY(bld.z - bld.d * 0.5);
    const bw = bld.w * scale;
    const bd = bld.d * scale;

    ctx.fillStyle = '#020306';
    ctx.fillRect(bx + 1.1, by + 1.3, bw, bd);

    ctx.fillStyle = remapBuildingColorToGothamNoir(bld.color, isLm);
    ctx.fillRect(bx, by, bw, bd);

    if (isLm || Math.max(bw, bd) >= 3.2) {
      ctx.strokeStyle = getGothamBuildingStrokeColor(bld.color, isLm);
      ctx.lineWidth = isLm ? 1.35 : 0.75;
      ctx.strokeRect(bx, by, bw, bd);
    }
  }

  // 6.5 LINHA 01 CIRCULAR DO METRÔ (Subsolo Tracejado + Elevado em Aco-Glacial + Trens ao Vivo)
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
      ctx.strokeStyle = '#030509';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(toX(a.x), toY(a.z));
      ctx.lineTo(toX(b.x), toY(b.z));
      ctx.stroke();

      ctx.strokeStyle = isUnderground ? 'rgba(56, 189, 248, 0.58)' : '#38bdf8';
      ctx.lineWidth = 2.1;
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
      ctx.fillStyle = tr.state === 'STOPPED' ? '#c28e2b' : '#7dd3fc';
      ctx.strokeStyle = '#030509';
      ctx.lineWidth = 1.8;
      ctx.fillRect(tx - 4.5, ty - 4.5, 9, 9);
      ctx.strokeRect(tx - 4.5, ty - 4.5, 9, 9);
    }
  }

  // 6.6 ESTACOES DO METRO (Placa #05070c + Borda Bronze #c28e2b + Codigo M01..M05)
  if (Array.isArray(world.metroStationMarkers)) {
    for (const st of world.metroStationMarkers) {
      const sx = toX(st.x);
      const sy = toY(st.z);
      ctx.save();
      ctx.fillStyle = '#05070c';
      ctx.strokeStyle = '#c28e2b';
      ctx.lineWidth = 1.8;
      ctx.fillRect(sx - 5.5, sy - 5.5, 11, 11);
      ctx.strokeRect(sx - 5.5, sy - 5.5, 11, 11);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(sx - 1.8, sy - 1.8, 3.6, 3.6);

      ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#030509';
      ctx.lineWidth = 3.2;
      ctx.strokeText(st.code, sx + 8.5, sy);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(st.code, sx + 8.5, sy);
      ctx.restore();
    }
  }

  // 7. Destaque Inteligente de Regiao APENAS no Hover
  const allRegions = getInteractiveRegionsList(world);
  if (hud.hoveredRegionId) {
    const hoveredRegion = allRegions.find((r) => r.id === hud.hoveredRegionId);
    if (hoveredRegion && hoveredRegion.bounds) {
      const rx = toX(hoveredRegion.bounds.minX);
      const ry = toY(hoveredRegion.bounds.minZ);
      const rw = (hoveredRegion.bounds.maxX - hoveredRegion.bounds.minX) * scale;
      const rh = (hoveredRegion.bounds.maxZ - hoveredRegion.bounds.minZ) * scale;

      ctx.save();
      if (hoveredRegion.id === 'aeroporta_avioes' && typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([7, 5]);
      }
      ctx.fillStyle = 'rgba(194, 142, 43, 0.10)';
      ctx.strokeStyle = hoveredRegion.color || '#c28e2b';
      ctx.lineWidth = 2.4;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }
  }

  // 7.2 CONTORNOS PONTILHADOS DAS 3 ZONAS DE FACÇÃO (CV, PCC e A.R.E.S.) + BADGE CHANFRADO + 3 OUTPOSTS
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
    ctx.fillStyle = `${theme.color}14`;
    ctx.fillRect(zx, zy, zw, zh);
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([8, 6]);
    }
    ctx.strokeStyle = theme.color;
    ctx.lineWidth = 2.2;
    ctx.strokeRect(zx, zy, zw, zh);
    ctx.restore();

    const badgePos = zSpec.mapBadgePos || {
      x: (b.minX + b.maxX) * 0.5,
      z: (b.minZ + b.maxZ) * 0.5
    };
    const bx = toX(badgePos.x);
    const by = toY(badgePos.z);

    ctx.save();
    ctx.fillStyle = '#05070c';
    ctx.strokeStyle = theme.color;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.arc(bx, by, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawCanvasVectorIcon(ctx, theme.icon, bx, by, 10.5, theme.color);

    const tagLabel = `DOMINIO: ${theme.shortTag}`;
    ctx.font = '800 9.5px "JetBrains Mono", monospace';
    const measuredW =
      typeof ctx.measureText === 'function'
        ? ctx.measureText(tagLabel).width
        : tagLabel.length * 6.0;
    const tw = measuredW + 14;
    drawChamferedPlaque(ctx, bx - tw * 0.5, by + 15, tw, 15, 4, '#05070c', '#1e293b', 1.2);
    ctx.fillStyle = theme.color;
    ctx.textAlign = 'center';
    ctx.fillText(tagLabel, bx, by + 25.5);
    ctx.textAlign = 'left';
    ctx.restore();

    const outposts = liveState?.outposts || zSpec.outposts;
    for (const op of outposts) {
      const opOwner = op.ownerFaction || ownerKey;
      const opTheme = FACTION_THEME[opOwner] || theme;
      const ox = toX(op.x);
      const oy = toY(op.z);

      ctx.save();
      ctx.fillStyle = '#05070c';
      ctx.strokeStyle = opTheme.color;
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.arc(ox, oy, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '800 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(op.code, ox, oy + 3);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  // 7.5 Telemetria Viva no Mapa [M]: Zonas de Guerra, Combatentes e Comboio ($)
  if (world.livingCity) {
    const nowTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
    const policeBlinkIce = Math.sin(nowTime * 8.0) > 0;

    if (Array.isArray(world.livingCity.activeWarzones)) {
      for (const wz of world.livingCity.activeWarzones) {
        const wx = toX(wz.x);
        const wy = toY(wz.z);
        ctx.fillStyle = 'rgba(185, 28, 28, 0.22)';
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
            ? policeBlinkIce
              ? '#e2e8f0'
              : '#38bdf8'
            : npc.faction === 'cv'
              ? '#ef4444'
              : npc.faction === 'pcc'
                ? '#38bdf8'
                : '#c084fc';
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
      ctx.fillStyle = '#05070c';
      ctx.strokeStyle = '#c28e2b';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.arc(cxMap, cyMap, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#eab308';
      ctx.font = '900 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('$', cxMap, cyMap + 3.5);
      ctx.textAlign = 'left';
    }
  }

  // 8. Pins Vetoriais + Plaquetas Chanfradas Anti-Colisao (#05070c + #1e293b / #c28e2b)
  const labelLayouts = computeNonOverlappingLandmarkLabels(ctx, world.landmarks || [], toX, toY);

  for (const item of labelLayouts) {
    const { lm, lx, ly } = item;
    if (lm.displayX !== undefined || lm.displayZ !== undefined) {
      const gx = toX(lm.x);
      const gy = toY(lm.z);

      ctx.save();
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([5, 4]);
      }
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(125, 211, 252, 0.14)';
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(gx, gy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  for (const item of labelLayouts) {
    const { lm, lx, ly, bx, by, boxW, boxH, titleText, subText } = item;
    const isHoveredLm = hud.hoveredLandmark?.id === lm.id;
    const pinR = isHoveredLm ? 12 : 10;
    const pinAccent = lm.color || '#c28e2b';

    ctx.fillStyle = '#05070c';
    ctx.strokeStyle = isHoveredLm ? '#f8fafc' : pinAccent;
    ctx.lineWidth = isHoveredLm ? 2.6 : 1.9;
    ctx.beginPath();
    ctx.arc(lx, ly, pinR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawCanvasVectorIcon(ctx, lm.icon, lx, ly, pinR, isHoveredLm ? '#f8fafc' : pinAccent);

    const plaqueBorder = isHoveredLm ? '#c28e2b' : '#1e293b';
    drawChamferedPlaque(
      ctx,
      bx,
      by,
      boxW,
      boxH,
      4,
      '#05070c',
      plaqueBorder,
      isHoveredLm ? 1.8 : 1.2
    );

    ctx.fillStyle = isHoveredLm ? '#ffffff' : '#e2e8f0';
    ctx.font = '700 9.5px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, bx + boxW * 0.5, by + 11);

    if (subText) {
      ctx.fillStyle = '#c28e2b';
      ctx.font = '800 8px "JetBrains Mono", monospace';
      ctx.fillText(subText, bx + boxW * 0.5, by + 21.5);
    }
  }
  ctx.textAlign = 'left';

  // 9. Waypoint Personalizado em Aco-Glacial (Retícula Vetorial — Zero Emoji)
  if (world.waypoint && playerPos) {
    const wpx = toX(world.waypoint.x);
    const wpy = toY(world.waypoint.z);
    const ppx = toX(playerPos.x);
    const ppy = toY(playerPos.z);

    ctx.save();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([5, 5]);
    }
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(ppx, ppy);
    ctx.lineTo(wpx, wpy);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#05070c';
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(wpx, wpy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawCanvasVectorIcon(ctx, 'waypoint', wpx, wpy, 10, '#7dd3fc');

    const distM = Math.round(Math.hypot(world.waypoint.x - playerPos.x, world.waypoint.z - playerPos.z));
    const wpLabel = `DESTINO MARCADO (${distM}m)`;
    ctx.font = '800 9.5px "JetBrains Mono", monospace';
    const wpw = (typeof ctx.measureText === 'function' ? ctx.measureText(wpLabel).width : wpLabel.length * 5.8) + 16;
    drawChamferedPlaque(ctx, wpx + 13, wpy - 8, wpw, 16, 4, '#05070c', '#7dd3fc', 1.3);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(wpLabel, wpx + 21, wpy + 3.5);
  }

  // 10. Marcador Atual do Jogador (Seta Tatica Branco/Gelo com Halo #030509)
  if (playerPos) {
    const px = toX(playerPos.x);
    const py = toY(playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-playerFacingYaw + Math.PI);

    ctx.fillStyle = 'rgba(3, 5, 9, 0.72)';
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.40)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f1f5f9';
    ctx.strokeStyle = '#030509';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(0, -10.5);
    ctx.lineTo(7.5, 7.5);
    ctx.lineTo(0, 3.6);
    ctx.lineTo(-7.5, 7.5);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  // 11. Card Tatico Chanfrado de Setor no Canto Superior Esquerdo (#05070c + Bronze #c28e2b)
  const activeRegion = hud.hoveredRegionId
    ? allRegions.find((r) => r.id === hud.hoveredRegionId)
    : null;
  if (activeRegion) {
    const cardX = 14;
    const cardY = 14;
    const cardW = 326;
    const cardH = 54;

    drawChamferedPlaque(ctx, cardX, cardY, cardW, cardH, 8, '#05070c', '#c28e2b', 1.8);

    ctx.fillStyle = '#c28e2b';
    ctx.fillRect(cardX, cardY + 8, 4, cardH - 8);

    const codeStr = `SETOR R-${activeRegion.num || '01'} // CLIQUE NO PIN OU LISTA PARA VIAGEM RAPIDA`;
    ctx.fillStyle = '#c28e2b';
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
