import { drawCanvasVectorIcon } from '../TacticalIcons.js';
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
 * Renderização vetorial 2D completa do Mapa Tático [M]: costa da Pangeia, 10 regiões, vias,
 * Linha 01 do Metrô, territórios das facções, combate ao vivo, pins anti-colisão e legenda de hover.
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

  // 1. Oceano Atlantico Escuro + Grade Tatica de Coordenadas da Pangeia
  ctx.fillStyle = '#061220';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
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

  // 2. Supercontinente Pangeia + Ilha da Prisao com Orla de Areia Dourada Contínua
  ctx.fillStyle = '#141821';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  const drawPolyPath = (poly) => {
    if (!poly || poly.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    ctx.closePath();
  };

  // Halos de água rasa costeira + Faixa contínua de Areia Dourada ao redor de todo o continente
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    drawPolyPath(poly);
    ctx.lineWidth = Math.max(5, 48 * scale);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
    ctx.stroke();
    ctx.lineWidth = Math.max(3, 28 * scale);
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.72)';
    ctx.stroke();
  }
  ctx.restore();

  // Base terrestre orgânica
  ctx.fillStyle = '#1e222b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.6;
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    drawPolyPath(poly);
    ctx.fill();
    ctx.stroke();
  }

  // Rodovias Inter-Regionais da Pangeia no Mapa [M]
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = Math.max(2.2, 24 * scale);
  for (const hwy of PANGAEA_HIGHWAYS) {
    if (!hwy.points || hwy.points.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(toX(hwy.points[0][0]), toY(hwy.points[0][1]));
    for (let i = 1; i < hwy.points.length; i++) {
      ctx.lineTo(toX(hwy.points[i][0]), toY(hwy.points[i][1]));
    }
    ctx.stroke();
  }
  ctx.restore();

  // Ilhotas ao redor
  for (const isl of ARCHIPELAGO_ISLETS) {
    ctx.beginPath();
    ctx.ellipse(toX(isl.x), toY(isl.z), isl.rx * scale, isl.rz * scale, 0, 0, Math.PI * 2);
    ctx.fillStyle = isl.biome === 'sand' ? '#4a3d22' : isl.biome === 'forest' ? '#1c3b29' : '#2f3747';
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Realce sutil de Biomas e Linhas de Fronteira recortados dentro das massas de terra
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
    ctx.fillStyle = reg.tint;
    ctx.globalAlpha = 0.22;
    ctx.fillRect(
      toX(reg.minX),
      toY(reg.minZ),
      (reg.maxX - reg.minX) * scale,
      (reg.maxZ - reg.minZ) * scale
    );
  }
  ctx.globalAlpha = 0.85;
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = Math.max(1.2, 2.5 * scale);
  for (const brd of REGION_BORDER_LINES) {
    ctx.strokeStyle = brd.color;
    ctx.beginPath();
    ctx.moveTo(toX(brd.from[0]), toY(brd.from[1]));
    ctx.lineTo(toX(brd.to[0]), toY(brd.to[1]));
    ctx.stroke();
  }
  ctx.restore();

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

  // 6.6 ESTACOES DO METRO (quadrado amarelo alerta + codigo M01..M05 em JetBrains Mono — IDV)
  if (Array.isArray(world.metroStationMarkers)) {
    for (const st of world.metroStationMarkers) {
      const sx = toX(st.x);
      const sy = toY(st.z);
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#090a0d';
      ctx.lineWidth = 2;
      ctx.fillRect(sx - 6, sy - 6, 12, 12);
      ctx.strokeRect(sx - 6, sy - 6, 12, 12);
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeText(st.code, sx + 9, sy);
      ctx.fillStyle = '#facc15';
      ctx.fillText(st.code, sx + 9, sy);
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

  // 8.2 Desenha os Pins Vetoriais e as Plaquetas de Rotulo sem sobreposicao
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
