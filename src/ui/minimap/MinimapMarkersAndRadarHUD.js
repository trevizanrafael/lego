import { getSvgIcon, drawCanvasVectorIcon } from '../TacticalIcons.js';
import { TERRITORY_ZONES, FACTION_THEME } from '../../world/FactionWarSystem.js';

export function normalizeAngleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updateMinimapHeaderAndTelemetry(
  hud,
  playerPos,
  currentRegion = null,
  world = null,
  playerSpeed = 0
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

  // Barra de Status Tática no Rodapé: Relógio Urbano + Coordenadas (X, Z) + Altitude / Velocidade
  if (hud.minimapSubEl && playerPos) {
    const rx = Math.round(playerPos.x);
    const rz = Math.round(playerPos.z);
    const alt = Math.round(playerPos.y);
    const kmh = Math.round(playerSpeed * 3.6);
    const clockTag = world?.atmosphere ? `${world.atmosphere.getFormattedClock().display} // ` : '';
    const nextSub =
      kmh >= 25
        ? `${clockTag}X:${rx} Z:${rz} // ${kmh} KM/H`
        : `${clockTag}X:${rx} Z:${rz} // ALT:${alt}m`;
    if (hud._lastMinimapSubText !== nextSub) {
      hud._lastMinimapSubText = nextSub;
      hud.minimapSubEl.textContent = nextSub;
    }
  }
}

export function updateMinimapCompassIndicator(hud, cameraYaw = 0) {
  // Ângulo do Norte na tela (usado na moldura externa e no sistema Anti-Colisão Angular)
  const northScreenAngle = -cameraYaw - Math.PI * 0.5;

  // Atualiza posição orbital do indicador 'N' (Norte) no anel externo da moldura do minimapa
  if (hud.minimapCompassNEl) {
    const rx = Math.round((100 + Math.cos(northScreenAngle) * 82) * 10) * 0.1;
    const ry = Math.round((88 + Math.sin(northScreenAngle) * 74) * 10) * 0.1;
    if (hud._lastCompassRx !== rx || hud._lastCompassRy !== ry) {
      hud._lastCompassRx = rx;
      hud._lastCompassRy = ry;
      hud.minimapCompassNEl.style.left = `${rx}px`;
      hud.minimapCompassNEl.style.top = `${ry}px`;
      if (!hud._compassTransformSet) {
        hud._compassTransformSet = true;
        hud.minimapCompassNEl.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  return northScreenAngle;
}

export function createRadarScreenProjection(playerPos, cameraYaw, view) {
  return {
    playerPos,
    cosCam: Math.cos(cameraYaw),
    sinCam: Math.sin(cameraYaw),
    cx: view.cx,
    cy: view.cy,
    scale: view.scale,
    maxVisibleLocalR: Math.min(view.cx, view.cy) - 16
  };
}

export function paintRadarGridAndVisionCone(ctx, view) {
  const { w, cx, cy } = view;
  const h = view.h || w;
  const minHalf = Math.min(cx, cy);

  // Vinheta circular interna nas bordas do minimapa (profundidade de sonar Batcomputador)
  if (typeof ctx.createRadialGradient === 'function') {
    const grad = ctx.createRadialGradient(
      cx,
      cy,
      minHalf * 0.56,
      cx,
      cy,
      Math.hypot(cx, cy)
    );
    grad.addColorStop(0, 'rgba(3, 5, 9, 0)');
    grad.addColorStop(0.68, 'rgba(3, 5, 9, 0.45)');
    grad.addColorStop(1, 'rgba(2, 3, 6, 0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Aneis concentricos de sonar sutis + marcacoes cardinais discretas
  const rInner = w * 0.19;
  const rOuter = w * 0.35;
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
  ctx.beginPath();
  ctx.moveTo(cx - rOuter - 3, cy);
  ctx.lineTo(cx - rOuter + 3, cy);
  ctx.moveTo(cx + rOuter - 3, cy);
  ctx.lineTo(cx + rOuter + 3, cy);
  ctx.moveTo(cx, cy + rOuter - 3);
  ctx.lineTo(cx, cy + rOuter + 3);
  ctx.stroke();

  // Cone de visao tatico frio em aco-glacial
  const coneRadius = w * 0.35;
  const halfAngle = 0.42;
  const aStart = -Math.PI * 0.5 - halfAngle;
  const aEnd = -Math.PI * 0.5 + halfAngle;

  ctx.fillStyle = 'rgba(125, 211, 252, 0.08)';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, coneRadius, aStart, aEnd);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
  ctx.lineWidth = 1.15;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(aStart) * coneRadius, cy + Math.sin(aStart) * coneRadius);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(aEnd) * coneRadius, cy + Math.sin(aEnd) * coneRadius);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, coneRadius, aStart, aEnd);
  ctx.stroke();
}

export function paintLivingCityTacticalBlips(ctx, world, proj) {
  if (!world.livingCity) return;

  const { playerPos, cosCam, sinCam, cx, cy, scale, maxVisibleLocalR } = proj;
  const nowTime = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
  const policeBlinkIce = Math.sin(nowTime * 9.0) > 0;

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
    ctx.fillStyle = '#030509';
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
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.78)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(px, py, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#e2e8f0';
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
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.35;
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
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#030509';
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
        ctx.strokeStyle = strobeRedPhase ? '#f8fafc' : '#7dd3fc';
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
        ? policeBlinkIce
          ? '#e2e8f0'
          : '#38bdf8'
        : tv.faction === 'cv'
          ? '#ef4444'
          : tv.faction === 'pcc'
            ? '#38bdf8'
            : '#c084fc';
      ctx.strokeStyle = '#030509';
      ctx.lineWidth = 1.2;
      ctx.fillRect(px - 2.8, py - 2.8, 5.6, 5.6);
      ctx.strokeRect(px - 2.8, py - 2.8, 5.6, 5.6);
    }
  }

  // C) Combatentes (CV Vermelho, PCC Azul-Glacial, A.R.E.S. Violeta, BOPE Azul/Gelo)
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
          ? npc.isRecruitedByPlayer || policeBlinkIce
            ? '#e2e8f0'
            : '#38bdf8'
          : npc.faction === 'cv'
            ? '#ef4444'
            : npc.faction === 'pcc'
              ? '#38bdf8'
              : '#c084fc';
      const blipR = npc.isMecha ? 4.4 : 2.9;

      ctx.fillStyle = blipColor;
      ctx.strokeStyle = npc.isAllied ? '#7dd3fc' : '#030509';
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
      ctx.strokeStyle = '#030509';
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
    ctx.fillStyle = '#030509';
    ctx.strokeStyle = '#c28e2b';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(px, py, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#eab308';
    ctx.font = '900 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('$', px, py + 3.5);
  }
}

export function paintLocalLandmarks(ctx, world, proj) {
  const { playerPos, cosCam, sinCam, cx, cy, scale, maxVisibleLocalR } = proj;

  for (const lm of world.landmarks || []) {
    const dx = lm.x - playerPos.x;
    const dz = lm.z - playerPos.z;
    const rx = dx * cosCam - dz * sinCam;
    const ry = dx * sinCam + dz * cosCam;
    const screenDist = Math.hypot(rx * scale, ry * scale);

    if (screenDist > maxVisibleLocalR) {
      // Fora do alcance do radar local -> NÃO prende na borda (evita poluir o minimapa!)
      continue;
    }

    const px = cx + rx * scale;
    const py = cy + ry * scale;
    const accent = lm.color || '#c28e2b';

    ctx.fillStyle = '#05070c';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(px, py, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawCanvasVectorIcon(ctx, lm.icon, px, py, 8.5, accent);

    ctx.fillStyle = 'rgba(5, 7, 12, 0.94)';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.fillRect(px - 14, py + 9, 28, 10);
    ctx.strokeRect(px - 14, py + 9, 28, 10);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 7px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(lm.code, px, py + 16.5);
  }
}

export function paintEdgePinnedWaypoints(ctx, world, proj, northScreenAngle) {
  const { playerPos, cosCam, sinCam, cx, cy, scale } = proj;

  // 7. ARO DE EDGE-PINNING EXCLUSIVO: Apenas Destino Marcado (Waypoint) e Eventos de Emergência Ativos!
  const edgePins = [];
  if (world.waypoint) {
    edgePins.push({
      id: 'custom_waypoint',
      icon: 'waypoint',
      x: world.waypoint.x,
      z: world.waypoint.z,
      color: '#7dd3fc',
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

      // Sistema Anti-Colisão Angular contra o [N] e outros pins da borda (mínimo 0.40 rad = ~23 graus)
      for (const occ of occupiedAngles) {
        const diff = normalizeAngleDiff(ang, occ);
        const minSep = 0.4;
        if (Math.abs(diff) < minSep) {
          ang = occ + (diff >= 0 ? minSep : -minSep);
        }
      }
      occupiedAngles.push(ang);

      px = cx + Math.cos(ang) * edgePinRadius;
      py = cy + Math.sin(ang) * edgePinRadius;
    }

    ctx.fillStyle = '#030509';
    ctx.strokeStyle = pin.color;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.arc(px, py, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    drawCanvasVectorIcon(ctx, pin.icon, px, py, 8.5, pin.color);

    // Badge de distância em metros (ex: 420m)
    const distText = `${distMeters}m`;
    ctx.font = '800 7.5px "JetBrains Mono", monospace';
    const rawW = typeof ctx.measureText === 'function' ? ctx.measureText(distText).width : distText.length * 5.0;
    const tw = Math.max(28, rawW + 8);
    ctx.fillStyle = '#05070c';
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

export function paintPlayerTacticalArrow(ctx, view, cameraYaw = 0, playerFacingYaw = 0) {
  const { cx, cy } = view;

  // 8. Marcador Central do Jogador (Seta Tatica Afiada em Branco/Gelo com Halo Preto #030509)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cameraYaw - playerFacingYaw + Math.PI);

  ctx.fillStyle = 'rgba(3, 5, 9, 0.72)';
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.32)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(0, 0, 9.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f1f5f9';
  ctx.strokeStyle = '#030509';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, -9.0);
  ctx.lineTo(6.4, 6.6);
  ctx.lineTo(0, 3.0);
  ctx.lineTo(-6.4, 6.6);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();

  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(0, -7.2);
  ctx.lineTo(0, 2.4);
  ctx.stroke();

  ctx.restore();
}
