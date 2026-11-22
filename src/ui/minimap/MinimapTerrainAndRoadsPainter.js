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
  remapBlockColorToGothamNoir,
  remapBuildingColorToGothamNoir,
  getGothamBuildingStrokeColor,
  remapBiomeTintToGothamNoir,
  remapRegionBorderToGothamNoir,
  classifyGothamRoadKind
} from '../TacticalIcons.js';
import { IS_SCALED_WORLD, ws } from '../../world/core/WorldLayoutScale.js';

export const STATIC_MAP_MIN_WX = ws(-3700);
export const STATIC_MAP_MIN_WZ = ws(-3250);
export const STATIC_MAP_SPAN = ws(7400);
export const STATIC_MAP_PX = IS_SCALED_WORLD && !globalThis.__testEnvReady ? 4096 : 2048;

export function getStaticMinimapCache(world) {
  if (!world) return null;
  const bldCount = world.mapBuildings?.length || 0;
  const rdCount = world.mapRoads?.length || 0;
  const blkCount = world.mapBlocks?.length || 0;
  if (
    world._staticMinimapCache &&
    world._staticMinimapCache.bldCount === bldCount &&
    world._staticMinimapCache.rdCount === rdCount &&
    world._staticMinimapCache.blkCount === blkCount
  ) {
    return world._staticMinimapCache;
  }

  let canvas = null;
  if (typeof OffscreenCanvas === 'function') {
    try {
      canvas = new OffscreenCanvas(STATIC_MAP_PX, STATIC_MAP_PX);
    } catch (_) {
      canvas = null;
    }
  }
  if (!canvas && typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = STATIC_MAP_PX;
    canvas.height = STATIC_MAP_PX;
  }
  const cctx = canvas?.getContext?.('2d');
  if (!cctx) return null;

  const pxPerMeter = STATIC_MAP_PX / STATIC_MAP_SPAN;
  const toX = (wx) => (wx - STATIC_MAP_MIN_WX) * pxPerMeter;
  const toY = (wz) => (wz - STATIC_MAP_MIN_WZ) * pxPerMeter;

  // 0. Oceano transparente para preservar a grade militar no Mapa [M] (o fundo #030509 é pintado no canvas de destino)
  cctx.clearRect(0, 0, STATIC_MAP_PX, STATIC_MAP_PX);

  // 1. Linhas Batimetricas Costeiras Sutis (ZERO ciano brilhante e ZERO orla amarela)
  cctx.save();
  cctx.lineJoin = 'round';
  cctx.lineCap = 'round';
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    if (!poly || poly.length < 3) continue;
    cctx.beginPath();
    cctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      cctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    cctx.closePath();
    cctx.lineWidth = Math.max(7, 50 * pxPerMeter);
    cctx.strokeStyle = 'rgba(71, 85, 105, 0.14)';
    cctx.stroke();
    cctx.lineWidth = Math.max(3.5, 22 * pxPerMeter);
    cctx.strokeStyle = 'rgba(71, 85, 105, 0.28)';
    cctx.stroke();
  }
  cctx.restore();

  // Massa Continental da Ilha em Noir (#090c13) + Borda Costeira em Aco Escuro (#1e293b)
  cctx.fillStyle = '#090c13';
  cctx.strokeStyle = '#1e293b';
  cctx.lineWidth = Math.max(1.5, 4.2 * pxPerMeter);
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    if (!poly || poly.length < 3) continue;
    cctx.beginPath();
    cctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      cctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    cctx.closePath();
    cctx.fill();
    cctx.stroke();
  }

  // Ilhotas do Arquipelago em Rocha/Vulcanico Sombrio
  for (const isl of ARCHIPELAGO_ISLETS) {
    cctx.fillStyle =
      isl.biome === 'sand' ? '#161513' : isl.biome === 'forest' ? '#0b1613' : '#0f141e';
    cctx.strokeStyle = '#1e293b';
    cctx.lineWidth = 1.1;
    cctx.beginPath();
    if (typeof cctx.ellipse === 'function') {
      cctx.ellipse(toX(isl.x), toY(isl.z), isl.rx * pxPerMeter, isl.rz * pxPerMeter, 0, 0, Math.PI * 2);
    } else {
      cctx.arc(toX(isl.x), toY(isl.z), Math.max(isl.rx, isl.rz) * pxPerMeter, 0, Math.PI * 2);
    }
    cctx.fill();
    cctx.stroke();
  }

  // Biomas Noturnos Dessaturados & Fronteiras Tracejadas (Aco / Bronze / Carmesim)
  cctx.save();
  cctx.beginPath();
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    if (!poly || poly.length < 3) continue;
    cctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      cctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    cctx.closePath();
  }
  cctx.clip();
  for (const reg of REGION_BIOME_MAP) {
    cctx.fillStyle = remapBiomeTintToGothamNoir(reg.tint);
    cctx.globalAlpha = 0.09;
    cctx.fillRect(
      toX(reg.minX),
      toY(reg.minZ),
      (reg.maxX - reg.minX) * pxPerMeter,
      (reg.maxZ - reg.minZ) * pxPerMeter
    );
  }
  cctx.globalAlpha = 0.56;
  if (typeof cctx.setLineDash === 'function') {
    cctx.setLineDash([4, 4]);
  }
  cctx.lineWidth = 1.15;
  for (const brd of REGION_BORDER_LINES) {
    cctx.strokeStyle = remapRegionBorderToGothamNoir(brd.color);
    cctx.beginPath();
    cctx.moveTo(toX(brd.from[0]), toY(brd.from[1]));
    cctx.lineTo(toX(brd.to[0]), toY(brd.to[1]));
    cctx.stroke();
  }
  cctx.restore();

  // Rodovias Regionais da Pangeia (Meio-Fio #2e3d56 + Asfalto Grafite #1b2436 + Eixo Tracejado)
  cctx.save();
  cctx.lineCap = 'round';
  cctx.lineJoin = 'round';
  for (const hwy of PANGAEA_HIGHWAYS) {
    if (!hwy.points || hwy.points.length < 2) continue;
    cctx.beginPath();
    cctx.moveTo(toX(hwy.points[0][0]), toY(hwy.points[0][1]));
    for (let i = 1; i < hwy.points.length; i++) {
      cctx.lineTo(toX(hwy.points[i][0]), toY(hwy.points[i][1]));
    }
    cctx.strokeStyle = '#2e3d56';
    cctx.lineWidth = Math.max(5.4, 27 * pxPerMeter);
    cctx.stroke();

    cctx.strokeStyle = '#1b2436';
    cctx.lineWidth = Math.max(4.0, 23 * pxPerMeter);
    cctx.stroke();
  }
  if (typeof cctx.setLineDash === 'function') {
    cctx.setLineDash([5, 6]);
  }
  cctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  cctx.lineWidth = 0.9;
  for (const hwy of PANGAEA_HIGHWAYS) {
    if (!hwy.points || hwy.points.length < 2) continue;
    cctx.beginPath();
    cctx.moveTo(toX(hwy.points[0][0]), toY(hwy.points[0][1]));
    for (let i = 1; i < hwy.points.length; i++) {
      cctx.lineTo(toX(hwy.points[i][0]), toY(hwy.points[i][1]));
    }
    cctx.stroke();
  }
  cctx.restore();

  // 2. Quarteiroes / Calcadas / Parques / Orla Vulcanica / Patios / Morro da CDD
  if (Array.isArray(world.mapBlocks)) {
    cctx.strokeStyle = 'rgba(30, 41, 59, 0.72)';
    cctx.lineWidth = 0.85;
    for (let i = 0; i < world.mapBlocks.length; i++) {
      const blk = world.mapBlocks[i];
      cctx.fillStyle = remapBlockColorToGothamNoir(blk.color, blk.type);
      const bx = toX(blk.x - blk.w * 0.5);
      const by = toY(blk.z - blk.d * 0.5);
      const bw = blk.w * pxPerMeter;
      const bd = blk.d * pxPerMeter;
      cctx.fillRect(bx, by, bw, bd);
      cctx.strokeRect(bx, by, bw, bd);
    }
  }

  // 3. Canais e Lagos Internos (#050912 Abissal + Margem em Aco Escuro)
  if (Array.isArray(world.mapWater)) {
    cctx.fillStyle = '#050912';
    cctx.strokeStyle = '#172234';
    cctx.lineWidth = 0.9;
    for (let i = 0; i < world.mapWater.length; i++) {
      const wt = world.mapWater[i];
      const wx = toX(wt.x - wt.w * 0.5);
      const wy = toY(wt.z - wt.d * 0.5);
      const ww = wt.w * pxPerMeter;
      const wd = wt.d * pxPerMeter;
      cctx.fillRect(wx, wy, ww, wd);
      cctx.strokeRect(wx, wy, ww, wd);
    }
  }

  // 4. Malha Viaria em 2 Passes (Meio-Fio/Guarda-Corpos Nitidos + Leito Asfaltico/Pista/Pontes)
  if (Array.isArray(world.mapRoads)) {
    // Passe 4A: Meio-fio (#2e3d56 avenidas / #1e293b locais) e guarda-corpos de pontes (#475569)
    for (let i = 0; i < world.mapRoads.length; i++) {
      const rd = world.mapRoads[i];
      const kind = classifyGothamRoadKind(rd);
      const pad = kind === 'bridge' ? 1.5 : kind === 'main' || kind === 'runway' ? 1.15 : 0.75;
      cctx.fillStyle =
        kind === 'bridge' ? '#475569' : kind === 'main' || kind === 'runway' ? '#2e3d56' : '#1e293b';
      cctx.fillRect(
        toX(rd.x - rd.w * 0.5) - pad,
        toY(rd.z - rd.d * 0.5) - pad,
        rd.w * pxPerMeter + pad * 2,
        rd.d * pxPerMeter + pad * 2
      );
    }

    // Passe 4B: Superficie asfaltica + eixos tracejados e cabeceiras da pista do aeroporto
    for (let i = 0; i < world.mapRoads.length; i++) {
      const rd = world.mapRoads[i];
      const kind = classifyGothamRoadKind(rd);
      const rx = toX(rd.x - rd.w * 0.5);
      const ry = toY(rd.z - rd.d * 0.5);
      const rw = rd.w * pxPerMeter;
      const rh = rd.d * pxPerMeter;

      cctx.fillStyle =
        kind === 'bridge'
          ? '#222d42'
          : kind === 'runway'
            ? '#161e2e'
            : kind === 'main'
              ? '#1b2436'
              : '#131a27';
      cctx.fillRect(rx, ry, rw, rh);

      if (kind === 'runway') {
        const horiz = rw >= rh;
        cctx.save();
        if (typeof cctx.setLineDash === 'function') cctx.setLineDash([5, 4]);
        cctx.strokeStyle = 'rgba(226, 232, 240, 0.52)';
        cctx.lineWidth = 1.1;
        cctx.beginPath();
        if (horiz) {
          cctx.moveTo(rx + 6, ry + rh * 0.5);
          cctx.lineTo(rx + rw - 6, ry + rh * 0.5);
        } else {
          cctx.moveTo(rx + rw * 0.5, ry + 6);
          cctx.lineTo(rx + rw * 0.5, ry + rh - 6);
        }
        cctx.stroke();
        cctx.restore();

        cctx.fillStyle = 'rgba(217, 119, 6, 0.68)';
        if (horiz) {
          cctx.fillRect(rx + 2, ry + rh * 0.2, 2.5, rh * 0.6);
          cctx.fillRect(rx + rw - 4.5, ry + rh * 0.2, 2.5, rh * 0.6);
        } else {
          cctx.fillRect(rx + rw * 0.2, ry + 2, rw * 0.6, 2.5);
          cctx.fillRect(rx + rw * 0.2, ry + rh - 4.5, rw * 0.6, 2.5);
        }
      } else if ((kind === 'main' || kind === 'bridge') && Math.max(rw, rh) >= 12) {
        const horiz = rw >= rh;
        cctx.save();
        if (typeof cctx.setLineDash === 'function') cctx.setLineDash([4, 5]);
        cctx.strokeStyle =
          kind === 'bridge' ? 'rgba(203, 213, 225, 0.34)' : 'rgba(148, 163, 184, 0.22)';
        cctx.lineWidth = 0.8;
        cctx.beginPath();
        if (horiz) {
          cctx.moveTo(rx + 2, ry + rh * 0.5);
          cctx.lineTo(rx + rw - 2, ry + rh * 0.5);
        } else {
          cctx.moveTo(rx + rw * 0.5, ry + 2);
          cctx.lineTo(rx + rw * 0.5, ry + rh - 2);
        }
        cctx.stroke();
        cctx.restore();
      }
    }
  }

  // 5. Pegadas Arquitetonicas Sonar 3D dos Predios (Sombra #020306 + Aco/Ardosia + Contorno #334155 / Bronze)
  if (Array.isArray(world.mapBuildings)) {
    for (let i = 0; i < world.mapBuildings.length; i++) {
      const bld = world.mapBuildings[i];
      const isLm = Boolean(bld.isLandmark || bld.landmark);
      const bx = toX(bld.x - bld.w * 0.5);
      const by = toY(bld.z - bld.d * 0.5);
      const bw = bld.w * pxPerMeter;
      const bd = bld.d * pxPerMeter;

      cctx.fillStyle = '#020306';
      cctx.fillRect(bx + 1.6, by + 1.8, bw, bd);

      cctx.fillStyle = remapBuildingColorToGothamNoir(bld.color, isLm);
      cctx.strokeStyle = getGothamBuildingStrokeColor(bld.color, isLm);
      cctx.lineWidth = isLm ? 1.5 : 0.95;
      cctx.fillRect(bx, by, bw, bd);
      cctx.strokeRect(bx, by, bw, bd);
    }
  }

  // 5.2 Linha Circular do Metro (Viadutos Elevados e Tuneis Tracejados em Aco-Glacial)
  if (Array.isArray(world.metroLoopWaypoints) && world.metroLoopWaypoints.length > 2) {
    const wps = world.metroLoopWaypoints;
    for (let i = 0; i < wps.length; i++) {
      const a = wps[i];
      const b = wps[(i + 1) % wps.length];
      const isUnderground = a.y < -0.5 && b.y < -0.5;
      cctx.save();
      if (isUnderground && typeof cctx.setLineDash === 'function') {
        cctx.setLineDash([4, 3]);
      }
      if (!isUnderground) {
        cctx.strokeStyle = '#030509';
        cctx.lineWidth = 3.8;
        cctx.beginPath();
        cctx.moveTo(toX(a.x), toY(a.z));
        cctx.lineTo(toX(b.x), toY(b.z));
        cctx.stroke();
      }
      cctx.strokeStyle = isUnderground ? 'rgba(56, 189, 248, 0.50)' : '#38bdf8';
      cctx.lineWidth = isUnderground ? 1.8 : 2.2;
      cctx.beginPath();
      cctx.moveTo(toX(a.x), toY(a.z));
      cctx.lineTo(toX(b.x), toY(b.z));
      cctx.stroke();
      cctx.restore();
    }
  }

  // 5.3b Estacoes do Metro (estaticas em Bronze/Gelo Noturno)
  if (Array.isArray(world.metroStationMarkers)) {
    for (let i = 0; i < world.metroStationMarkers.length; i++) {
      const st = world.metroStationMarkers[i];
      const sx = toX(st.x);
      const sy = toY(st.z);
      cctx.fillStyle = '#05070c';
      cctx.strokeStyle = '#c28e2b';
      cctx.lineWidth = 1.6;
      cctx.fillRect(sx - 4.5, sy - 4.5, 9, 9);
      cctx.strokeRect(sx - 4.5, sy - 4.5, 9, 9);
      cctx.fillStyle = '#e2e8f0';
      cctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }
  }

  const cache = {
    canvas,
    pxPerMeter,
    bldCount,
    rdCount,
    blkCount
  };
  world._staticMinimapCache = cache;
  return cache;
}

/**
 * Zoom dinâmico por velocidade (175m parado/andando -> até 340m voando de cometa ou carro turbo)
 */
export function updateDynamicMinimapZoom(hud, playerSpeed = 0, dt = 0.016) {
  const speedRatio = Math.min(1, Math.max(0, (playerSpeed - 8) / 28));
  const targetRadius = 175 + speedRatio * 165;
  hud.minimapViewRadius += (targetRadius - hud.minimapViewRadius) * Math.min(1, dt * 6);
  return hud.minimapViewRadius;
}

/**
 * Renderização rotacionada de oceano, ilha Pangeia, quadras, ruas, viadutos/composições do metrô e territórios
 */
export function paintRotatedTerrainAndRoads(ctx, hud, playerPos, cameraYaw = 0, world = null) {
  const w = hud.minimapCanvas.width;
  const h = hud.minimapCanvas.height;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const scale = (w * 0.5) / hud.minimapViewRadius;

  ctx.clearRect(0, 0, w, h);

  // Fundo Oceano Abissal Gotham Sonar
  ctx.fillStyle = '#030509';
  ctx.fillRect(0, 0, w, h);

  // Rotaciona o contexto do radar sincronizado com a câmera 3D!
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cameraYaw);

  const relX = (wx) => (wx - playerPos.x) * scale;
  const relY = (wz) => (wz - playerPos.z) * scale;

  const staticCache = getStaticMinimapCache(world);
  if (staticCache && typeof ctx.drawImage === 'function') {
    const viewWorldHalf = hud.minimapViewRadius * 1.5;
    const wMinX = Math.max(STATIC_MAP_MIN_WX, playerPos.x - viewWorldHalf);
    const wMaxX = Math.min(STATIC_MAP_MIN_WX + STATIC_MAP_SPAN, playerPos.x + viewWorldHalf);
    const wMinZ = Math.max(STATIC_MAP_MIN_WZ, playerPos.z - viewWorldHalf);
    const wMaxZ = Math.min(STATIC_MAP_MIN_WZ + STATIC_MAP_SPAN, playerPos.z + viewWorldHalf);
    if (wMaxX > wMinX && wMaxZ > wMinZ) {
      const sx = (wMinX - STATIC_MAP_MIN_WX) * staticCache.pxPerMeter;
      const sy = (wMinZ - STATIC_MAP_MIN_WZ) * staticCache.pxPerMeter;
      const sw = (wMaxX - wMinX) * staticCache.pxPerMeter;
      const sh = (wMaxZ - wMinZ) * staticCache.pxPerMeter;
      ctx.drawImage(
        staticCache.canvas,
        sx,
        sy,
        sw,
        sh,
        relX(wMinX),
        relY(wMinZ),
        (wMaxX - wMinX) * scale,
        (wMaxZ - wMinZ) * scale
      );
    }
  } else {
    ctx.fillStyle = '#090c13';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.4;
    for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
      if (!poly || poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(relX(poly[0][0]), relY(poly[0][1]));
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(relX(poly[i][0]), relY(poly[i][1]));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    for (const isl of ARCHIPELAGO_ISLETS) {
      ctx.beginPath();
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(relX(isl.x), relY(isl.z), isl.rx * scale, isl.rz * scale, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(relX(isl.x), relY(isl.z), Math.max(isl.rx, isl.rz) * scale, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  if (world) {
    // 5.3 COMPOSIÇÕES EM MOVIMENTO DO METRÔ LEGO NO RADAR LOCAL
    if (world.metroSystem && Array.isArray(world.metroSystem.trains)) {
      for (const tr of world.metroSystem.trains) {
        const leadCar = tr.cars?.[1] || tr.cars?.[0];
        if (!leadCar) continue;
        const tx = relX(leadCar.pos.x);
        const ty = relY(leadCar.pos.z);
        ctx.fillStyle = tr.state === 'STOPPED' ? '#c28e2b' : '#7dd3fc';
        ctx.strokeStyle = '#030509';
        ctx.lineWidth = 1.5;
        ctx.fillRect(tx - 3.6, ty - 3.6, 7.2, 7.2);
        ctx.strokeRect(tx - 3.6, ty - 3.6, 7.2, 7.2);
      }
    }

    // 5.4 CONTORNOS PONTILHADOS DOS 3 TERRITÓRIOS DE FACÇÃO (CV, PCC e A.R.E.S.) + 3 OUTPOSTS
    const liveTerritories = world.livingCity?.factionWar?.territories;
    for (const [zKey, zSpec] of Object.entries(TERRITORY_ZONES)) {
      const liveState = liveTerritories?.[zKey];
      const ownerKey = liveState?.ownerFaction || zSpec.defaultOwner;
      const theme = FACTION_THEME[ownerKey] || FACTION_THEME.cv;
      const b = zSpec.bounds;
      const rx = relX(b.minX);
      const ry = relY(b.minZ);
      const rw = (b.maxX - b.minX) * scale;
      const rh = (b.maxZ - b.minZ) * scale;

      ctx.save();
      ctx.fillStyle = `${theme.color}12`;
      ctx.fillRect(rx, ry, rw, rh);
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([5, 4]);
      }
      ctx.strokeStyle = theme.color;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();

      const outposts = liveState?.outposts || zSpec.outposts;
      for (const op of outposts) {
        const opTheme = FACTION_THEME[op.ownerFaction || ownerKey] || theme;
        const ox = relX(op.x);
        const oy = relY(op.z);
        ctx.fillStyle = '#030509';
        ctx.strokeStyle = opTheme.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(ox, oy, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  return { w, h, cx, cy, scale };
}
