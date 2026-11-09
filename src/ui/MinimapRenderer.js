import { getSvgIcon, drawCanvasVectorIcon } from './TacticalIcons.js';

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

  // Barra de Status Tatica no Rodape: Coordenadas (X, Z) e Altitude (Y) ou Velocidade (KM/H)
  if (hud.minimapSubEl && playerPos) {
    const rx = Math.round(playerPos.x);
    const rz = Math.round(playerPos.z);
    const alt = Math.max(0, Math.round(playerPos.y));
    const kmh = Math.round(playerSpeed * 3.6);
    if (kmh >= 25) {
      hud.minimapSubEl.textContent = `X:${rx} Z:${rz} // ALT:${alt}m // ${kmh} KM/H`;
    } else {
      hud.minimapSubEl.textContent = `X: ${rx}  Z: ${rz} // ALT: ${alt}m`;
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

    // 6. MARCOS DAS REGIOES: So aparecem quando estao REALMENTE dentro da area visivel do radar local!
    // 5.5 BLIPS TÁTICOS DA CIDADE VIVA (Polícia/BOPE + Facções CV, PCC e A.R.E.S.)
    if (world.livingCity?.combatNpcs) {
      for (const npc of world.livingCity.combatNpcs) {
        if (!npc.destructibleObj || npc.destructibleObj.destroyed) continue;
        const dx = npc.x - playerPos.x;
        const dz = npc.z - playerPos.z;
        const rx = dx * cosCam - dz * sinCam;
        const ry = dx * sinCam + dz * cosCam;
        const screenDist = Math.hypot(rx * scale, ry * scale);
        if (screenDist > maxVisibleLocalR) continue;

        const px = cx + rx * scale;
        const py = cy + ry * scale;
        const blipColor =
          npc.faction === 'police' ? '#38bdf8' :
          npc.faction === 'cv' ? '#ef4444' :
          npc.faction === 'pcc' ? '#60a5fa' : '#c084fc';
        const blipR = npc.isBigFig ? 4.2 : 2.8;

        ctx.fillStyle = blipColor;
        ctx.strokeStyle = '#090a0d';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px, py, blipR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
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
