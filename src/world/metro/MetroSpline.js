// Curva fechada do anel, parametrizada por comprimento de arco.
import * as THREE from 'three';
import { METRO_STATIONS, METRO_LOOP_WAYPOINTS } from './MetroRouteData.js';
import { adjustMetroVerticalProfile } from './MetroVerticalProfile.js';

// ============================================================================
// 2. CURVA FECHADA PARAMETRIZADA POR COMPRIMENTO DE ARCO PARA OS 2 TRENS LEGO
// ============================================================================
/**
 * @param world (opcional) com `getTerrainHeightAt`: quando informado, a linha elevada sobe onde o relevo
 *              exigir (vão livre sobre a rua) e as estações elevadas herdam a altura real do trilho.
 */
export function buildClosedMetroLoopSpline(world = null) {
  const pts = METRO_LOOP_WAYPOINTS.map((w) => new THREE.Vector3(w.x, w.y, w.z));
  let smoothPts = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const vIn = new THREE.Vector3().subVectors(curr, prev);
    const vOut = new THREE.Vector3().subVectors(next, curr);
    const lenIn = vIn.length();
    const lenOut = vOut.length();
    vIn.normalize();
    vOut.normalize();

    const dot = vIn.dot(vOut);
    if (dot < 0.96 && lenIn > 12 && lenOut > 12) {
      const trim = Math.min(11.0, lenIn * 0.35, lenOut * 0.35);
      const pA = curr.clone().addScaledVector(vIn, -trim);
      const pB = curr.clone().addScaledVector(vOut, trim);
      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const omt = 1 - t;
        const px = omt * omt * pA.x + 2 * omt * t * curr.x + t * t * pB.x;
        const py = omt * omt * pA.y + 2 * omt * t * curr.y + t * t * pB.y;
        const pz = omt * omt * pA.z + 2 * omt * t * curr.z + t * t * pB.z;
        smoothPts.push(new THREE.Vector3(px, py, pz));
      }
    } else {
      smoothPts.push(curr.clone());
    }
  }

  if (world?.getTerrainHeightAt) {
    smoothPts = adjustMetroVerticalProfile(smoothPts, (x, z) => world.getTerrainHeightAt(x, z), METRO_STATIONS);
  }

  const cumLengths = [0];
  let totalLen = 0;
  for (let i = 0; i < smoothPts.length; i++) {
    const a = smoothPts[i];
    const b = smoothPts[(i + 1) % smoothPts.length];
    totalLen += a.distanceTo(b);
    cumLengths.push(totalLen);
  }

  const sampleAtS = (rawS, outPos = new THREE.Vector3(), outTan = new THREE.Vector3()) => {
    const s = ((rawS % totalLen) + totalLen) % totalLen;
    let lo = 0;
    let hi = smoothPts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (cumLengths[mid + 1] <= s) lo = mid + 1;
      else if (cumLengths[mid] > s) hi = mid - 1;
      else {
        lo = mid;
        break;
      }
    }
    const idx = Math.min(lo, smoothPts.length - 1);
    const segStart = cumLengths[idx];
    const segLen = Math.max(0.0001, cumLengths[idx + 1] - segStart);
    const t = (s - segStart) / segLen;
    const p0 = smoothPts[idx];
    const p1 = smoothPts[(idx + 1) % smoothPts.length];
    outPos.lerpVectors(p0, p1, t);
    outTan.subVectors(p1, p0).normalize();
    return { pos: outPos, tangent: outTan };
  };

  // Busca só no plano (x, z): a altura do trilho pode ter sido ajustada pelo relevo
  const findClosestS = (tx, tz) => {
    let bestS = 0;
    let bestDistSq = Infinity;
    const pos = new THREE.Vector3();
    for (let s = 0; s < totalLen; s += 1.0) {
      sampleAtS(s, pos);
      const dSq = (pos.x - tx) ** 2 + (pos.z - tz) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestS = s;
      }
    }
    return bestS;
  };

  const tmpPos = new THREE.Vector3();
  const stationStops = METRO_STATIONS.map((st) => {
    const stopS = findClosestS(st.trackPos.x, st.trackPos.z);
    if (st.kind === 'elevated') {
      // A plataforma fica sempre 0.65m acima do topo do trilho (piso do vagão), na altura real da linha
      const trackY = sampleAtS(stopS, tmpPos).pos.y;
      st.trackPos.y = trackY;
      st.y = trackY + 0.65;
      st.platformSpawn.y = trackY + 0.65;
    }
    return { ...st, stopS };
  });

  return {
    points: smoothPts,
    totalLength: totalLen,
    sampleAtS,
    stationStops
  };
}
