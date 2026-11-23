import {
  remapBuildingColorToGothamNoir,
  getGothamBuildingStrokeColor,
  classifyGothamRoadKind
} from '../TacticalIcons.js';

function traceWorldPointsPath(ctx, pts, toX, toY, dxPx = 0, dyPx = 0, close = false) {
  if (!Array.isArray(pts) || pts.length < (close ? 3 : 2)) return false;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    if (!pt) continue;
    const wx = Array.isArray(pt) ? pt[0] : pt.x;
    const wz = Array.isArray(pt) ? pt[1] : pt.z;
    const px = toX(wx) + dxPx;
    const py = toY(wz) + dyPx;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  if (close) ctx.closePath();
  return true;
}

/**
 * Renderiza a malha viária retangular (ignorando ladrilhos internos `isOrganicTile`) +
 * vias orgânicas contínuas (`polyline` e `roundabout`) em 2 passes (Meio-Fio + Asfalto/Eixos).
 */
export function paintRoadsAndOrganicLayer(ctx, world, toX, toY, unitScale, opts = {}) {
  const mapRoads = Array.isArray(world?.mapRoads) ? world.mapRoads : [];
  const organicRoads = Array.isArray(world?.mapOrganicRoads) ? world.mapOrganicRoads : [];
  const bridgePad = opts.bridgePad ?? 1.5;
  const mainPad = opts.mainPad ?? 1.15;
  const localPad = opts.localPad ?? 0.75;
  const minRunwayMarkPx = opts.minRunwayMarkPx ?? 0;
  const drawRunwayThresholds = opts.drawRunwayThresholds !== false;
  const drawRectMainDashes = opts.drawRectMainDashes !== false;

  for (let i = 0; i < mapRoads.length; i++) {
    const rd = mapRoads[i];
    if (!rd || rd.isOrganicTile) continue;
    const kind = classifyGothamRoadKind(rd);
    const pad = kind === 'bridge' ? bridgePad : kind === 'main' || kind === 'runway' ? mainPad : localPad;
    ctx.fillStyle =
      kind === 'bridge' ? '#475569' : kind === 'main' || kind === 'runway' ? '#2e3d56' : '#1e293b';
    ctx.fillRect(
      toX(rd.x - rd.w * 0.5) - pad,
      toY(rd.z - rd.d * 0.5) - pad,
      rd.w * unitScale + pad * 2,
      rd.d * unitScale + pad * 2
    );
  }

  if (organicRoads.length > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < organicRoads.length; i++) {
      const item = organicRoads[i];
      if (!item) continue;
      if (item.kind === 'polyline') {
        if (!traceWorldPointsPath(ctx, item.points, toX, toY)) continue;
        const width = Number(item.width) || 18;
        ctx.strokeStyle = item.isMain ? '#2e3d56' : '#1e293b';
        ctx.lineWidth = Math.max(2.2, width * unitScale + (item.isMain ? 2.3 : 1.5));
        ctx.stroke();
      } else if (item.kind === 'roundabout') {
        const outerR = Number(item.outerR) || 0;
        if (outerR <= 0) continue;
        const rcx = item.cx ?? item.x ?? 0;
        const rcz = item.cz ?? item.z ?? 0;
        ctx.fillStyle = '#2e3d56';
        ctx.beginPath();
        ctx.arc(toX(rcx), toY(rcz), outerR * unitScale + 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  for (let i = 0; i < mapRoads.length; i++) {
    const rd = mapRoads[i];
    if (!rd || rd.isOrganicTile) continue;
    const kind = classifyGothamRoadKind(rd);
    const rx = toX(rd.x - rd.w * 0.5);
    const ry = toY(rd.z - rd.d * 0.5);
    const rw = rd.w * unitScale;
    const rh = rd.d * unitScale;

    ctx.fillStyle =
      kind === 'bridge'
        ? '#222d42'
        : kind === 'runway'
          ? '#161e2e'
          : kind === 'main'
            ? '#1b2436'
            : '#131a27';
    ctx.fillRect(rx, ry, rw, rh);

    if (kind === 'runway' && Math.max(rw, rh) >= minRunwayMarkPx) {
      const horiz = rw >= rh;
      const inset = drawRunwayThresholds ? 6 : 4;
      ctx.save();
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash(drawRunwayThresholds ? [5, 4] : [4, 4]);
      }
      ctx.strokeStyle = drawRunwayThresholds
        ? 'rgba(226, 232, 240, 0.52)'
        : 'rgba(226, 232, 240, 0.48)';
      ctx.lineWidth = drawRunwayThresholds ? 1.1 : 0.95;
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(rx + inset, ry + rh * 0.5);
        ctx.lineTo(rx + rw - inset, ry + rh * 0.5);
      } else {
        ctx.moveTo(rx + rw * 0.5, ry + inset);
        ctx.lineTo(rx + rw * 0.5, ry + rh - inset);
      }
      ctx.stroke();
      ctx.restore();

      if (drawRunwayThresholds) {
        ctx.fillStyle = 'rgba(217, 119, 6, 0.68)';
        if (horiz) {
          ctx.fillRect(rx + 2, ry + rh * 0.2, 2.5, rh * 0.6);
          ctx.fillRect(rx + rw - 4.5, ry + rh * 0.2, 2.5, rh * 0.6);
        } else {
          ctx.fillRect(rx + rw * 0.2, ry + 2, rw * 0.6, 2.5);
          ctx.fillRect(rx + rw * 0.2, ry + rh - 4.5, rw * 0.6, 2.5);
        }
      }
    } else if (drawRectMainDashes && (kind === 'main' || kind === 'bridge') && Math.max(rw, rh) >= 12) {
      const horiz = rw >= rh;
      ctx.save();
      if (typeof ctx.setLineDash === 'function') ctx.setLineDash([4, 5]);
      ctx.strokeStyle =
        kind === 'bridge' ? 'rgba(203, 213, 225, 0.34)' : 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(rx + 2, ry + rh * 0.5);
        ctx.lineTo(rx + rw - 2, ry + rh * 0.5);
      } else {
        ctx.moveTo(rx + rw * 0.5, ry + 2);
        ctx.lineTo(rx + rw * 0.5, ry + rh - 2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  if (organicRoads.length > 0) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < organicRoads.length; i++) {
      const item = organicRoads[i];
      if (!item || item.kind !== 'polyline') continue;
      if (!traceWorldPointsPath(ctx, item.points, toX, toY)) continue;
      const width = Number(item.width) || 18;
      ctx.strokeStyle = item.isMain ? '#1b2436' : '#131a27';
      ctx.lineWidth = Math.max(1.4, width * unitScale);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (typeof ctx.setLineDash === 'function') ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < organicRoads.length; i++) {
      const item = organicRoads[i];
      if (!item || item.kind !== 'polyline') continue;
      const width = Number(item.width) || 18;
      if (!item.isMain && width < 26) continue;
      if (!traceWorldPointsPath(ctx, item.points, toX, toY)) continue;
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < organicRoads.length; i++) {
      const item = organicRoads[i];
      if (!item || item.kind !== 'roundabout') continue;
      const outerR = Number(item.outerR) || 0;
      if (outerR <= 0) continue;
      const innerR = Math.max(0, Number(item.innerR) || 0);
      const sx = toX(item.cx ?? item.x ?? 0);
      const sy = toY(item.cz ?? item.z ?? 0);

      ctx.fillStyle = '#172032';
      ctx.beginPath();
      ctx.arc(sx, sy, outerR * unitScale, 0, Math.PI * 2);
      ctx.fill();

      if (innerR > 0) {
        ctx.fillStyle = '#0e1722';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(sx, sy, innerR * unitScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = '#8a6a26';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.2, 2.2 * unitScale), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Renderiza pegadas arquitetônicas Sonar 3D dos prédios (`polygon`, `rotY` e `AABB`).
 */
export function paintBuildingsSonarLayer(ctx, mapBuildings, toX, toY, unitScale, opts = {}) {
  if (!Array.isArray(mapBuildings) || mapBuildings.length === 0) return;
  const sxOff = opts.shadowDx ?? 1.6;
  const syOff = opts.shadowDy ?? 1.8;
  const lmLineWidth = opts.lmLineWidth ?? 1.5;
  const stdLineWidth = opts.stdLineWidth ?? 0.95;
  const minStrokePx = opts.minStrokePx ?? 0;

  for (let i = 0; i < mapBuildings.length; i++) {
    const bld = mapBuildings[i];
    if (!bld) continue;
    const isLm = Boolean(bld.isLandmark || bld.landmark);
    const fillColor = remapBuildingColorToGothamNoir(bld.color, isLm);
    const strokeWidth = isLm ? lmLineWidth : stdLineWidth;

    if (Array.isArray(bld.polygon) && bld.polygon.length >= 3) {
      const poly = bld.polygon;
      ctx.fillStyle = '#020306';
      traceWorldPointsPath(ctx, poly, toX, toY, sxOff, syOff, true);
      ctx.fill();

      let minPx = Infinity;
      let maxPx = -Infinity;
      let minPy = Infinity;
      let maxPy = -Infinity;
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      for (let k = 0; k < poly.length; k++) {
        const pt = poly[k];
        if (!pt) continue;
        const px = toX(Array.isArray(pt) ? pt[0] : pt.x);
        const py = toY(Array.isArray(pt) ? pt[1] : pt.z);
        if (px < minPx) minPx = px;
        if (px > maxPx) maxPx = px;
        if (py < minPy) minPy = py;
        if (py > maxPy) maxPy = py;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      if (isLm || Math.max(maxPx - minPx, maxPy - minPy) >= minStrokePx) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = getGothamBuildingStrokeColor(bld.color, isLm);
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
      }
    } else if (Math.abs(bld.rotY || 0) > 1e-3) {
      const cxPx = toX(bld.x);
      const cyPx = toY(bld.z);
      const bw = (bld.w || 0) * unitScale;
      const bd = (bld.d || 0) * unitScale;
      const canvasAngle = -bld.rotY;

      ctx.save();
      ctx.translate(cxPx + sxOff, cyPx + syOff);
      ctx.rotate(canvasAngle);
      ctx.fillStyle = '#020306';
      ctx.fillRect(-bw * 0.5, -bd * 0.5, bw, bd);
      ctx.restore();

      ctx.save();
      ctx.translate(cxPx, cyPx);
      ctx.rotate(canvasAngle);
      ctx.fillStyle = fillColor;
      ctx.fillRect(-bw * 0.5, -bd * 0.5, bw, bd);
      if (isLm || Math.max(bw, bd) >= minStrokePx) {
        ctx.strokeStyle = getGothamBuildingStrokeColor(bld.color, isLm);
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(-bw * 0.5, -bd * 0.5, bw, bd);
      }
      ctx.restore();
    } else {
      const w = bld.w || 0;
      const d = bld.d || 0;
      const bx = toX(bld.x - w * 0.5);
      const by = toY(bld.z - d * 0.5);
      const bw = w * unitScale;
      const bd = d * unitScale;

      ctx.fillStyle = '#020306';
      ctx.fillRect(bx + sxOff, by + syOff, bw, bd);

      ctx.fillStyle = fillColor;
      ctx.fillRect(bx, by, bw, bd);
      if (isLm || Math.max(bw, bd) >= minStrokePx) {
        ctx.strokeStyle = getGothamBuildingStrokeColor(bld.color, isLm);
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(bx, by, bw, bd);
      }
    }
  }
}
