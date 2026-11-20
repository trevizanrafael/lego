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

export const STATIC_MAP_MIN_WX = -3700;
export const STATIC_MAP_MIN_WZ = -3250;
export const STATIC_MAP_SPAN = 7400;
export const STATIC_MAP_PX = 2960; // 0.40 px/m cobrindo toda a Pangeia com nitidez

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

  // Fundo Oceano Escuro
  cctx.fillStyle = '#061322';
  cctx.fillRect(0, 0, STATIC_MAP_PX, STATIC_MAP_PX);

  // 1. Halo de recife/onda rasa & Faixa Contínua de Areia ao redor de toda a Pangeia + Ilha da Prisão
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
    cctx.lineWidth = Math.max(8, 56 * pxPerMeter);
    cctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    cctx.stroke();
    cctx.lineWidth = Math.max(5, 34 * pxPerMeter);
    cctx.strokeStyle = '#ca8a04';
    cctx.stroke();
  }
  cctx.restore();

  cctx.fillStyle = '#252932';
  for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
    if (!poly || poly.length < 3) continue;
    cctx.beginPath();
    cctx.moveTo(toX(poly[0][0]), toY(poly[0][1]));
    for (let i = 1; i < poly.length; i++) {
      cctx.lineTo(toX(poly[i][0]), toY(poly[i][1]));
    }
    cctx.closePath();
    cctx.fill();
  }

  // Rodovias Regionais da Pangeia (traço contínuo inclusive em trechos curvos/diagonais)
  cctx.save();
  cctx.lineCap = 'round';
  cctx.lineJoin = 'round';
  cctx.strokeStyle = '#090c12';
  cctx.lineWidth = Math.max(4, 24 * pxPerMeter);
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

  // Ilhotas do Arquipélago
  for (const isl of ARCHIPELAGO_ISLETS) {
    cctx.beginPath();
    cctx.ellipse(toX(isl.x), toY(isl.z), isl.rx * pxPerMeter, isl.rz * pxPerMeter, 0, 0, Math.PI * 2);
    cctx.fill();
  }

  // Biomas sutis & Fronteiras claras entre regiões recortados dentro da costa orgânica
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
    cctx.fillStyle = reg.tint;
    cctx.globalAlpha = 0.24;
    cctx.fillRect(
      toX(reg.minX),
      toY(reg.minZ),
      (reg.maxX - reg.minX) * pxPerMeter,
      (reg.maxZ - reg.minZ) * pxPerMeter
    );
  }
  cctx.globalAlpha = 0.72;
  cctx.setLineDash([4, 4]);
  cctx.lineWidth = 1.2;
  for (const brd of REGION_BORDER_LINES) {
    cctx.strokeStyle = brd.color;
    cctx.beginPath();
    cctx.moveTo(toX(brd.from[0]), toY(brd.from[1]));
    cctx.lineTo(toX(brd.to[0]), toY(brd.to[1]));
    cctx.stroke();
  }
  cctx.restore();

  // 2. Quarteirões / Calçadas / Parques / Areia / Pátios / Morro da CDD
  if (Array.isArray(world.mapBlocks)) {
    cctx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
    cctx.lineWidth = 0.9;
    for (let i = 0; i < world.mapBlocks.length; i++) {
      const blk = world.mapBlocks[i];
      cctx.fillStyle = blk.color || '#262b38';
      const bx = toX(blk.x - blk.w * 0.5);
      const by = toY(blk.z - blk.d * 0.5);
      const bw = blk.w * pxPerMeter;
      const bd = blk.d * pxPerMeter;
      cctx.fillRect(bx, by, bw, bd);
      cctx.strokeRect(bx, by, bw, bd);
    }
  }

  // 3. Águas Internas
  if (Array.isArray(world.mapWater)) {
    cctx.fillStyle = '#0284c7';
    for (let i = 0; i < world.mapWater.length; i++) {
      const wt = world.mapWater[i];
      cctx.fillRect(
        toX(wt.x - wt.w * 0.5),
        toY(wt.z - wt.d * 0.5),
        wt.w * pxPerMeter,
        wt.d * pxPerMeter
      );
    }
  }

  // 4. Ruas, Ladeiras da CDD, Vias do Porto e Avenidas
  if (Array.isArray(world.mapRoads)) {
    for (let i = 0; i < world.mapRoads.length; i++) {
      const rd = world.mapRoads[i];
      cctx.fillStyle = rd.isMain ? '#090c12' : '#11151f';
      cctx.fillRect(
        toX(rd.x - rd.w * 0.5),
        toY(rd.z - rd.d * 0.5),
        rd.w * pxPerMeter,
        rd.d * pxPerMeter
      );
    }
  }

  // 5. Contorno Preciso dos Prédios, Barracos, Galpões e Contêineres
  if (Array.isArray(world.mapBuildings)) {
    for (let i = 0; i < world.mapBuildings.length; i++) {
      const bld = world.mapBuildings[i];
      const bx = toX(bld.x - bld.w * 0.5);
      const by = toY(bld.z - bld.d * 0.5);
      const bw = bld.w * pxPerMeter;
      const bd = bld.d * pxPerMeter;
      cctx.fillStyle = bld.color || '#334155';
      cctx.strokeStyle = bld.isLandmark ? '#facc15' : '#090a0d';
      cctx.lineWidth = bld.isLandmark ? 1.5 : 1.0;
      cctx.fillRect(bx, by, bw, bd);
      cctx.strokeRect(bx, by, bw, bd);
    }
  }

  // 5.2 Linha Circular do Metrô LEGO (estática, com viadutos elevados e túneis tracejados)
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
      cctx.strokeStyle = isUnderground ? 'rgba(6, 182, 212, 0.85)' : '#22d3ee';
      cctx.lineWidth = isUnderground ? 2.0 : 2.6;
      cctx.beginPath();
      cctx.moveTo(toX(a.x), toY(a.z));
      cctx.lineTo(toX(b.x), toY(b.z));
      cctx.stroke();
      cctx.restore();
    }
  }

  // 5.3b Estações do Metrô (estáticas)
  if (Array.isArray(world.metroStationMarkers)) {
    for (let i = 0; i < world.metroStationMarkers.length; i++) {
      const st = world.metroStationMarkers[i];
      const sx = toX(st.x);
      const sy = toY(st.z);
      cctx.fillStyle = '#facc15';
      cctx.strokeStyle = '#090a0d';
      cctx.lineWidth = 1.6;
      cctx.fillRect(sx - 4.5, sy - 4.5, 9, 9);
      cctx.strokeRect(sx - 4.5, sy - 4.5, 9, 9);
      cctx.fillStyle = '#090a0d';
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

  // Fundo Oceano Escuro
  ctx.fillStyle = '#061322';
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
    ctx.fillStyle = '#141821';
    for (const poly of [MAIN_WEST_POLYGON, EAST_PENINSULA_POLYGON, PRISON_ISLAND_POLYGON]) {
      if (!poly || poly.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(relX(poly[0][0]), relY(poly[0][1]));
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(relX(poly[i][0]), relY(poly[i][1]));
      }
      ctx.closePath();
      ctx.fill();
    }
    for (const isl of ARCHIPELAGO_ISLETS) {
      ctx.beginPath();
      ctx.ellipse(relX(isl.x), relY(isl.z), isl.rx * scale, isl.rz * scale, 0, 0, Math.PI * 2);
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
        ctx.fillStyle = tr.state === 'STOPPED' ? '#facc15' : '#06b6d4';
        ctx.strokeStyle = '#090a0d';
        ctx.lineWidth = 1.4;
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
      ctx.fillStyle = `${theme.color}18`;
      ctx.fillRect(rx, ry, rw, rh);
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([5, 4]);
      }
      ctx.strokeStyle = theme.color;
      ctx.lineWidth = 2.0;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();

      const outposts = liveState?.outposts || zSpec.outposts;
      for (const op of outposts) {
        const opTheme = FACTION_THEME[op.ownerFaction || ownerKey] || theme;
        const ox = relX(op.x);
        const oy = relY(op.z);
        ctx.fillStyle = '#090a0d';
        ctx.strokeStyle = opTheme.color;
        ctx.lineWidth = 1.7;
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
