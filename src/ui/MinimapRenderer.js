import { getSvgIcon, drawCanvasVectorIcon } from './TacticalIcons.js';
import { TERRITORY_ZONES, FACTION_THEME } from '../world/FactionWarSystem.js';

function normalizeAngleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Renderizador do Radar Local Dinamico (Minimapa na HUD — Zero Emojis):
 * - Zoom dinamico por velocidade (175m a pe -> ate 340m voando/dirigindo rapido).
 * - Gira sincronizado com a camera 3D.
 * - Icone N (Norte) orbital preso na moldura externa com prioridade maxima de camada.
 * - Marcos das regioes so aparecem quando estao REALMENTE dentro do alcance local do radar.
 * - Edge-Pinning exclusivo para Destino Marcado (Waypoint) e Emergencias Ativas, com sistema Anti-Colisao Angular contra o [N].
 * - Rodape tatico limpo com Coordenadas (X, Z) e Altitude (Y) / Velocidade (KM/H).
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
  if (currentRegion && currentRegion.id !== hud._lastRegionId) {
    const shouldShowToast = hud._hasInitializedRegion;
    hud._hasInitializedRegion = true;
    hud._lastRegionId = currentRegion.id;

    const codeNum = currentRegion.num || String(currentRegion.number || 1).padStart(2, '0');
    if (hud.minimapNumEl) hud.minimapNumEl.textContent = `R-${codeNum}`;
    if (hud.minimapNameEl) {
      const regionTitle = currentRegion.shortName || currentRegion.name;
      const svgMarkup = getSvgIcon(currentRegion.icon || 'pin', currentRegion.color || '#facc15', 13);
      hud.minimapNameEl.innerHTML = `${svgMarkup}<span>${regionTitle}</span>`;
    }

    if (shouldShowToast) {
      hud.showRegionTransitionToast(currentRegion);
    }
  }

  // Barra de Status Tatica no Rodape: Relogio Urbano + Coordenadas (X, Z) + Altitude / Velocidade
  if (hud.minimapSubEl && playerPos) {
    const rx = Math.round(playerPos.x);
    const rz = Math.round(playerPos.z);
    const alt = Math.round(playerPos.y);
    const kmh = Math.round(playerSpeed * 3.6);
    const clockTag = world?.atmosphere ? `${world.atmosphere.getFormattedClock().display} // ` : '';
    if (kmh >= 25) {
      hud.minimapSubEl.textContent = `${clockTag}X:${rx} Z:${rz} // ${kmh} KM/H`;
    } else {
      hud.minimapSubEl.textContent = `${clockTag}X:${rx} Z:${rz} // ALT:${alt}m`;
    }
  }

  // Zoom Dinamico por Velocidade (175m parado/andando -> ate 340m voando de cometa ou carro turbo)
  const speedRatio = Math.min(1, Math.max(0, (playerSpeed - 8) / 28));
  const targetRadius = 175 + speedRatio * 165;
  hud.minimapViewRadius += (targetRadius - hud.minimapViewRadius) * Math.min(1, dt * 6);

  // Angulo do Norte na tela (usado na moldura externa e no sistema Anti-Colisao Angular)
  const northScreenAngle = -cameraYaw - Math.PI * 0.5;

  // Atualiza posicao orbital do indicador 'N' (Norte) no anel externo da moldura do minimapa
  if (hud.minimapCompassNEl) {
    const rx = 100 + Math.cos(northScreenAngle) * 82;
    const ry = 88 + Math.sin(northScreenAngle) * 74;
    hud.minimapCompassNEl.style.left = `${rx}px`;
    hud.minimapCompassNEl.style.top = `${ry}px`;
    hud.minimapCompassNEl.style.transform = 'translate(-50%, -50%)';
  }

  if (!hud.minimapCanvas || !playerPos) return;
  const ctx = hud.minimapCanvas.getContext('2d');
  if (!ctx) return;

  const w = hud.minimapCanvas.width;
  const h = hud.minimapCanvas.height;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const scale = (w * 0.5) / hud.minimapViewRadius;

  ctx.clearRect(0, 0, w, h);

  // Fundo Oceano Escuro
  ctx.fillStyle = '#061322';
  ctx.fillRect(0, 0, w, h);

  // Rotaciona o contexto do radar sincronizado com a camera 3D!
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cameraYaw);

  const relX = (wx) => (wx - playerPos.x) * scale;
  const relY = (wz) => (wz - playerPos.z) * scale;

  // 1. Massa Continental Proxima (100% alinhada as Regioes + Ilha da Prisao — ZERO borda cinza vazia!)
  ctx.fillStyle = '#141821';
  ctx.fillRect(relX(-1825), relY(-1320), 2465 * scale, 2365 * scale);
  ctx.fillRect(relX(580), relY(-1320), 1048 * scale, 2055 * scale);
  ctx.fillRect(relX(955), relY(1120), 840 * scale, 860 * scale);

  if (world) {
    const cullDist = hud.minimapViewRadius * 1.75;

    // 2. Quarteiroes / Calcadas / Parques / Areia / Patios do Porto / Morro da CDD proximos ao jogador
    for (const blk of world.mapBlocks) {
      if (
        Math.abs(blk.x - playerPos.x) - blk.w * 0.5 > cullDist ||
        Math.abs(blk.z - playerPos.z) - blk.d * 0.5 > cullDist
      ) {
        continue;
      }
      ctx.fillStyle = blk.color || '#262b38';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
      ctx.lineWidth = 0.9;
      const bx = relX(blk.x - blk.w * 0.5);
      const by = relY(blk.z - blk.d * 0.5);
      ctx.fillRect(bx, by, blk.w * scale, blk.d * scale);
      ctx.strokeRect(bx, by, blk.w * scale, blk.d * scale);
    }

    // 3. Aguas Internas (Lago do Parque Central, Canais de Santos e Canal Leste)
    ctx.fillStyle = '#0284c7';
    for (const wt of world.mapWater) {
      const wx = relX(wt.x - wt.w * 0.5);
      const wy = relY(wt.z - wt.d * 0.5);
      ctx.fillRect(wx, wy, wt.w * scale, wt.d * scale);
    }

    // 4. Ruas, Ladeiras da CDD, Vias do Porto e Avenidas Locais com faixa central
    for (const rd of world.mapRoads) {
      if (
        Math.abs(rd.x - playerPos.x) - rd.w * 0.5 > cullDist ||
        Math.abs(rd.z - playerPos.z) - rd.d * 0.5 > cullDist
      ) {
        continue;
      }
      const rx = relX(rd.x - rd.w * 0.5);
      const ry = relY(rd.z - rd.d * 0.5);
      ctx.fillStyle = rd.isMain ? '#090c12' : '#11151f';
      ctx.fillRect(rx, ry, rd.w * scale, rd.d * scale);
    }

    // 5. Contorno Preciso dos Predios, Barracos, Galpoes e Conteineres Vizinhos
    for (const bld of world.mapBuildings) {
      if (
        Math.abs(bld.x - playerPos.x) - bld.w * 0.5 > cullDist ||
        Math.abs(bld.z - playerPos.z) - bld.d * 0.5 > cullDist
      ) {
        continue;
      }
      const bx = relX(bld.x - bld.w * 0.5);
      const by = relY(bld.z - bld.d * 0.5);
      ctx.fillStyle = bld.color || '#334155';
      ctx.strokeStyle = bld.isLandmark ? '#facc15' : '#090a0d';
      ctx.lineWidth = bld.isLandmark ? 1.5 : 1.0;
      ctx.fillRect(bx, by, bld.w * scale, bld.d * scale);
      ctx.strokeRect(bx, by, bld.w * scale, bld.d * scale);
    }

    // 5.2 LINHA CIRCULAR DO METRÔ LEGO (Tracejada Ciano no Subsolo + Contínua Ciano/Amarela no Trecho Elevado!)
    if (Array.isArray(world.metroLoopWaypoints) && world.metroLoopWaypoints.length > 2) {
      const wps = world.metroLoopWaypoints;
      for (let i = 0; i < wps.length; i++) {
        const a = wps[i];
        const b = wps[(i + 1) % wps.length];
        const isUnderground = a.y < -0.5 && b.y < -0.5;
        ctx.save();
        if (isUnderground && typeof ctx.setLineDash === 'function') {
          ctx.setLineDash([4, 3]);
        }
        ctx.strokeStyle = isUnderground ? 'rgba(6, 182, 212, 0.85)' : '#22d3ee';
        ctx.lineWidth = isUnderground ? 2.0 : 2.6;
        ctx.beginPath();
        ctx.moveTo(relX(a.x), relY(a.z));
        ctx.lineTo(relX(b.x), relY(b.z));
        ctx.stroke();
        ctx.restore();
      }
    }

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

    // 5.3b ESTAÇÕES DO METRÔ (quadrado amarelo alerta com contorno preto — IDV)
    if (Array.isArray(world.metroStationMarkers)) {
      for (const st of world.metroStationMarkers) {
        const sx = relX(st.x);
        const sy = relY(st.z);
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#090a0d';
        ctx.lineWidth = 1.6;
        ctx.fillRect(sx - 4.5, sy - 4.5, 9, 9);
        ctx.strokeRect(sx - 4.5, sy - 4.5, 9, 9);
        ctx.fillStyle = '#090a0d';
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
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

  // Grade Circular de Alcance do Radar + Cone de Visao da Camera
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(250, 204, 21, 0.12)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - 26, cy - 56);
  ctx.lineTo(cx + 26, cy - 56);
  ctx.closePath();
  ctx.fill();

  if (world) {
    const cosCam = Math.cos(cameraYaw);
    const sinCam = Math.sin(cameraYaw);
    const maxVisibleLocalR = Math.min(cx, cy) - 16;

    // 5.5 BLIPS TÁTICOS DA CIDADE VIVA (Polícia/BOPE + Facções CV, PCC e A.R.E.S. + Helicóptero + Zonas de Conflito + Carro-Forte $)
    const nowTime = performance.now() * 0.001;
    const policeBlinkGold = Math.sin(nowTime * 9.0) > 0;

    if (world.livingCity) {
      // A.0) Ícone Vetorial da Facção Dona nos Portões dos 3 Territórios quando no alcance local
      const liveTerritories = world.livingCity.factionWar?.territories;
      for (const [zKey, zSpec] of Object.entries(TERRITORY_ZONES)) {
        const ownerKey = liveTerritories?.[zKey]?.ownerFaction || zSpec.defaultOwner;
        const theme = FACTION_THEME[ownerKey] || FACTION_THEME.cv;
        const mainGate = zSpec.gates[0];
        if (!mainGate) continue;
        const dx = mainGate.x - playerPos.x;
        const dz = mainGate.z - playerPos.z;
        const rx = dx * cosCam - dz * sinCam;
        const ry = dx * sinCam + dz * cosCam;
        if (Math.hypot(rx * scale, ry * scale) > maxVisibleLocalR) continue;
        const px = cx + rx * scale;
        const py = cy + ry * scale;
        ctx.fillStyle = '#090a0d';
        ctx.strokeStyle = theme.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(px, py, 7.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        drawCanvasVectorIcon(ctx, theme.icon, px, py, 6.2, theme.color);
      }

      // A) Zonas de Guerra Pulsantes (Ícone de Mira / Conflito)
      if (Array.isArray(world.livingCity.activeWarzones)) {
        for (const wz of world.livingCity.activeWarzones) {
          const dx = wz.x - playerPos.x;
          const dz = wz.z - playerPos.z;
          const rx = dx * cosCam - dz * sinCam;
          const ry = dx * sinCam + dz * cosCam;
          const screenDist = Math.hypot(rx * scale, ry * scale);
          if (screenDist > maxVisibleLocalR) continue;

          const px = cx + rx * scale;
          const py = cy + ry * scale;
          const pulseR = 6.5 + Math.sin(nowTime * 6.5) * 2.5;
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(px, py, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(px - 4.5, py);
          ctx.lineTo(px + 4.5, py);
          ctx.moveTo(px, py - 4.5);
          ctx.lineTo(px, py + 4.5);
          ctx.stroke();
        }
      }

      // B) Viaturas Policiais de Perseguição Ativa (1★ a 5★), Bloqueios e Helicóptero Águia!
      const wantedSys = world.livingCity.wantedSystem;
      if (wantedSys && wantedSys.stars > 0) {
        const strobeRedPhase = Math.sin(nowTime * 14.0) > 0;
        for (const pv of wantedSys.pursuitVehicles) {
          if (pv.retreating || !pv.carObj || pv.carObj.destroyed) continue;
          const pos = pv.carObj.mesh.position;
          const dx = pos.x - playerPos.x;
          const dz = pos.z - playerPos.z;
          const rx = dx * cosCam - dz * sinCam;
          const ry = dx * sinCam + dz * cosCam;
          if (Math.hypot(rx * scale, ry * scale) > maxVisibleLocalR) continue;
          const px = cx + rx * scale;
          const py = cy + ry * scale;
          ctx.fillStyle = strobeRedPhase ? '#ef4444' : '#3b82f6';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.4;
          ctx.fillRect(px - 3.6, py - 3.6, 7.2, 7.2);
          ctx.strokeRect(px - 3.6, py - 3.6, 7.2, 7.2);
        }

        for (const rb of wantedSys.roadblocks) {
          const dx = rb.x - playerPos.x;
          const dz = rb.z - playerPos.z;
          const rx = dx * cosCam - dz * sinCam;
          const ry = dx * sinCam + dz * cosCam;
          if (Math.hypot(rx * scale, ry * scale) > maxVisibleLocalR) continue;
          const px = cx + rx * scale;
          const py = cy + ry * scale;
          ctx.fillStyle = '#f97316';
          ctx.strokeStyle = '#090a0d';
          ctx.lineWidth = 1.3;
          ctx.fillRect(px - 5.5, py - 2.2, 11.0, 4.4);
          ctx.strokeRect(px - 5.5, py - 2.2, 11.0, 4.4);
        }

        if (wantedSys.eagleHeli && !wantedSys.eagleHeli.obj?.destroyed) {
          const hPos = wantedSys.eagleHeli.mesh.position;
          const dx = hPos.x - playerPos.x;
          const dz = hPos.z - playerPos.z;
          const rx = dx * cosCam - dz * sinCam;
          const ry = dx * sinCam + dz * cosCam;
          if (Math.hypot(rx * scale, ry * scale) <= maxVisibleLocalR) {
            const px = cx + rx * scale;
            const py = cy + ry * scale;
            ctx.strokeStyle = strobeRedPhase ? '#f8fafc' : '#38bdf8';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(px, py, 5.2, 0, Math.PI * 2);
            ctx.moveTo(px - 7, py);
            ctx.lineTo(px + 7, py);
            ctx.moveTo(px, py - 7);
            ctx.lineTo(px, py + 7);
            ctx.stroke();
          }
        }
      }

      // B2) Viaturas do BOPE e Veículos de Facção no Trânsito
      if (Array.isArray(world.livingCity.trafficVehicles)) {
        for (const tv of world.livingCity.trafficVehicles) {
          if (!tv.destructible || tv.destructible.destroyed || tv.destructible.isDriven) continue;
          const isPoliceCar = tv.isPoliceVehicle;
          const isFactionCar = Boolean(tv.faction && tv.faction !== 'civilian');
          if (!isPoliceCar && !isFactionCar) continue;

          const pos = tv.mesh.position;
          const dx = pos.x - playerPos.x;
          const dz = pos.z - playerPos.z;
          const rx = dx * cosCam - dz * sinCam;
          const ry = dx * sinCam + dz * cosCam;
          if (Math.hypot(rx * scale, ry * scale) > maxVisibleLocalR) continue;

          const px = cx + rx * scale;
          const py = cy + ry * scale;
          ctx.fillStyle = isPoliceCar
            ? policeBlinkGold
              ? '#facc15'
              : '#38bdf8'
            : tv.faction === 'cv'
              ? '#ef4444'
              : tv.faction === 'pcc'
                ? '#38bdf8'
                : '#d946ef';
          ctx.strokeStyle = '#090a0d';
          ctx.lineWidth = 1.2;
          ctx.fillRect(px - 2.8, py - 2.8, 5.6, 5.6);
          ctx.strokeRect(px - 2.8, py - 2.8, 5.6, 5.6);
        }
      }

      // C) Combatentes (CV Vermelho, PCC Azul-Ciano, A.R.E.S. Roxo/Magenta, BOPE Azul/Dourado Piscante)
      if (Array.isArray(world.livingCity.combatNpcs)) {
        for (const npc of world.livingCity.combatNpcs) {
          const obj = npc.destructible;
          if (!obj || obj.destroyed || !npc.visual?.root) continue;
          const nPos = npc.visual.root.position;
          const dx = nPos.x - playerPos.x;
          const dz = nPos.z - playerPos.z;
          const rx = dx * cosCam - dz * sinCam;
          const ry = dx * sinCam + dz * cosCam;
          const screenDist = Math.hypot(rx * scale, ry * scale);
          if (screenDist > maxVisibleLocalR) continue;

          const px = cx + rx * scale;
          const py = cy + ry * scale;
          const blipColor =
            npc.faction === 'police'
              ? npc.isRecruitedByPlayer || policeBlinkGold
                ? '#facc15'
                : '#38bdf8'
              : npc.faction === 'cv'
                ? '#ef4444'
                : npc.faction === 'pcc'
                  ? '#38bdf8'
                  : '#d946ef';
          const blipR = npc.isMecha ? 4.4 : 2.9;

          ctx.fillStyle = blipColor;
          ctx.strokeStyle = npc.isAllied ? '#4ade80' : '#090a0d';
          ctx.lineWidth = npc.isAllied ? 1.6 : 1.25;
          ctx.beginPath();
          ctx.arc(px, py, blipR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // D) Helicóptero de Assalto do PCC
      const heli = world.livingCity.pccHeli;
      if (heli && heli.destructible && !heli.destructible.destroyed) {
        const hPos = heli.mesh.position;
        const dx = hPos.x - playerPos.x;
        const dz = hPos.z - playerPos.z;
        const rx = dx * cosCam - dz * sinCam;
        const ry = dx * sinCam + dz * cosCam;
        if (Math.hypot(rx * scale, ry * scale) <= maxVisibleLocalR) {
          const px = cx + rx * scale;
          const py = cy + ry * scale;
          ctx.fillStyle = '#38bdf8';
          ctx.strokeStyle = '#090a0d';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py - 5);
          ctx.lineTo(px + 5, py);
          ctx.lineTo(px, py + 5);
          ctx.lineTo(px - 5, py);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      // E) Evento Dinâmico: Comboio do Carro-Forte Blindado ($)
      const convoy = world.livingCity.armoredConvoy;
      if (convoy && convoy.active && convoy.truck?.destructible && !convoy.truck.destructible.destroyed) {
        const cPos = convoy.truck.mesh.position;
        const dx = cPos.x - playerPos.x;
        const dz = cPos.z - playerPos.z;
        const rx = dx * cosCam - dz * sinCam;
        const ry = dx * sinCam + dz * cosCam;
        const screenDist = Math.hypot(rx * scale, ry * scale);
        const clampedR = Math.min(screenDist, maxVisibleLocalR - 4);
        const ang = Math.atan2(ry, rx);
        const px = screenDist <= maxVisibleLocalR ? cx + rx * scale : cx + Math.cos(ang) * clampedR;
        const py = screenDist <= maxVisibleLocalR ? cy + ry * scale : cy + Math.sin(ang) * clampedR;

        const pulse = 7.5 + Math.sin(nowTime * 8.0) * 1.6;
        ctx.fillStyle = '#090a0d';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(px, py, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#facc15';
        ctx.font = '900 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('$', px, py + 3.5);
      }
    }

    for (const lm of world.landmarks || []) {
      const dx = lm.x - playerPos.x;
      const dz = lm.z - playerPos.z;
      const rx = dx * cosCam - dz * sinCam;
      const ry = dx * sinCam + dz * cosCam;
      const screenDist = Math.hypot(rx * scale, ry * scale);

      if (screenDist > maxVisibleLocalR) {
        // Fora do alcance do radar local -> NAO prende na borda (evita poluir o minimapa!)
        continue;
      }

      const px = cx + rx * scale;
      const py = cy + ry * scale;

      ctx.fillStyle = '#090a0d';
      ctx.strokeStyle = lm.color || '#facc15';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(px, py, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      drawCanvasVectorIcon(ctx, lm.icon, px, py, 8.5, lm.color || '#facc15');

      ctx.fillStyle = 'rgba(9, 10, 13, 0.9)';
      ctx.fillRect(px - 14, py + 9, 28, 10);
      ctx.fillStyle = lm.color || '#f8fafc';
      ctx.font = '800 7px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lm.code, px, py + 16.5);
    }

    // 7. ARO DE EDGE-PINNING EXCLUSIVO: Apenas Destino Marcado (Waypoint) e Eventos de Emergencia Ativos!
    const edgePins = [];
    if (world.waypoint) {
      edgePins.push({
        id: 'custom_waypoint',
        icon: 'waypoint',
        x: world.waypoint.x,
        z: world.waypoint.z,
        color: '#00f0ff',
        isWaypoint: true
      });
    }
    if (Array.isArray(world.activeEmergencies)) {
      for (const em of world.activeEmergencies) {
        edgePins.push({
          id: em.id || 'emergency',
          icon: 'emergency',
          x: em.x,
          z: em.z,
          color: '#ef4444',
          isEmergency: true
        });
      }
    }

    const occupiedAngles = [northScreenAngle];
    const edgePinRadius = 64; // Raio interno separado do anel externo do [N] (82px)

    for (const pin of edgePins) {
      const dx = pin.x - playerPos.x;
      const dz = pin.z - playerPos.z;
      const distMeters = Math.round(Math.hypot(dx, dz));

      const rx = dx * cosCam - dz * sinCam;
      const ry = dx * sinCam + dz * cosCam;
      const screenDist = Math.hypot(rx * scale, ry * scale);

      let px = cx + rx * scale;
      let py = cy + ry * scale;

      if (screenDist > edgePinRadius && screenDist > 0.001) {
        let ang = Math.atan2(ry, rx);

        // Sistema Anti-Colisao Angular contra o [N] e outros pins da borda (minimo 0.40 rad = ~23 graus)
        for (const occ of occupiedAngles) {
          const diff = normalizeAngleDiff(ang, occ);
          const minSep = 0.40;
          if (Math.abs(diff) < minSep) {
            ang = occ + (diff >= 0 ? minSep : -minSep);
          }
        }
        occupiedAngles.push(ang);

        px = cx + Math.cos(ang) * edgePinRadius;
        py = cy + Math.sin(ang) * edgePinRadius;
      }

      ctx.fillStyle = '#090a0d';
      ctx.strokeStyle = pin.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(px, py, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      drawCanvasVectorIcon(ctx, pin.icon, px, py, 8.5, pin.color);

      // Badge de distancia em metros (ex: 420m)
      const distText = `${distMeters}m`;
      ctx.font = '800 7.5px "JetBrains Mono", monospace';
      const rawW = typeof ctx.measureText === 'function' ? ctx.measureText(distText).width : distText.length * 5.0;
      const tw = Math.max(28, rawW + 8);
      ctx.fillStyle = '#090a0d';
      ctx.strokeStyle = pin.color;
      ctx.lineWidth = 1;
      ctx.fillRect(px - tw * 0.5, py + 9.5, tw, 10.5);
      ctx.strokeRect(px - tw * 0.5, py + 9.5, tw, 10.5);
      ctx.fillStyle = pin.color;
      ctx.textAlign = 'center';
      ctx.fillText(distText, px, py + 17);
    }
    ctx.textAlign = 'left';
  }

  // 8. Marcador Central do Jogador (Seta Tatica Amarela)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cameraYaw - playerFacingYaw + Math.PI);
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#090a0d';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6.5, 6.5);
  ctx.lineTo(0, 3.5);
  ctx.lineTo(-6.5, 6.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
