// Perfil vertical da linha elevada do Metrô LEGO.
//
// Regra: o trilho elevado nunca passa baixo sobre a rua. Entre o fundo da viga dos pórticos e o chão
// embaixo (incluindo calçadas dos dois lados) sobram pelo menos `minClearance` metros, para ônibus e
// caminhões passarem com folga. Onde o relevo sobe (morros), a linha sobe junto com rampas suaves
// (`maxGrade`), e cada estação elevada continua 100% plana.
import * as THREE from 'three';

export const PROFILE_CONFIG = {
  minClearance: 9.0,   // Vão livre mínimo entre o fundo da viga e o chão (m)
  structureDepth: 2.39, // Topo do trilho até o fundo da viga do pórtico (1.09 tabuleiro + 1.3 viga)
  lateralReach: 16,    // Mede o chão até esta distância para cada lado do trilho (pista + calçadas)
  maxGrade: 0.04,      // Inclinação máxima das rampas criadas (4%)
  elevatedBaseY: 12,   // Pontos com altura de projeto >= isto fazem parte da linha elevada
  sampleStep: 4,       // Densidade dos pontos do perfil (m)
  stationHalfLen: 40   // Trecho plano em volta de cada estação elevada (m para cada lado)
};

/** Subdivide a polilinha fechada para que nenhum trecho passe de `step` metros. */
export function densifyClosedPolyline(points, step) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const len = a.distanceTo(b);
    const k = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < k; j++) {
      out.push(new THREE.Vector3().lerpVectors(a, b, j / k));
    }
  }
  return out;
}

/**
 * Ajusta a altura dos pontos da linha elevada para respeitar o vão livre sobre o chão.
 * @param points   polilinha fechada (já com as curvas suavizadas)
 * @param getGroundY(x, z)
 * @param stations lista de estações `{ kind, trackPos: {x, z} }`
 * @returns nova polilinha densa
 */
export function adjustMetroVerticalProfile(points, getGroundY, stations = [], config = {}) {
  const cfg = { ...PROFILE_CONFIG, ...config };
  const pts = densifyClosedPolyline(points, cfg.sampleStep);
  const n = pts.length;

  const elevated = pts.map((p) => p.y >= cfg.elevatedBaseY);
  const baseY = pts.map((p) => p.y);
  const ds = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = pts[(i + 1) % n];
    ds[i] = Math.hypot(b.x - pts[i].x, b.z - pts[i].z);
  }

  // 1) Altura mínima exigida pelo chão embaixo (pista + calçadas dos dois lados)
  const req = new Array(n).fill(-Infinity);
  for (let i = 0; i < n; i++) {
    if (!elevated[i]) continue;
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    let gMax = -Infinity;
    for (let o = -cfg.lateralReach; o <= cfg.lateralReach; o += 2) {
      gMax = Math.max(gMax, getGroundY(pts[i].x - tz * o, pts[i].z + tx * o));
    }
    req[i] = Math.max(0, gMax) + cfg.minClearance + cfg.structureDepth;
  }

  // 2) Trechos planos das estações elevadas
  const stationWindows = [];
  for (const st of stations) {
    if (st.kind !== 'elevated') continue;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(pts[i].x - st.trackPos.x, pts[i].z - st.trackPos.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const idx = [best];
    for (const dir of [1, -1]) {
      let acc = 0;
      let i = best;
      while (acc < cfg.stationHalfLen) {
        const j = (i + dir + n) % n;
        acc += dir > 0 ? ds[i] : ds[j];
        i = j;
        if (!elevated[i]) break;
        idx.push(i);
      }
    }
    stationWindows.push(idx);
  }

  const y = pts.map((p, i) => (elevated[i] ? Math.max(baseY[i], req[i]) : baseY[i]));

  const flattenStations = () => {
    for (const win of stationWindows) {
      let m = -Infinity;
      for (const i of win) m = Math.max(m, y[i]);
      for (const i of win) y[i] = m;
    }
  };
  // 3) Rampas suaves: só sobe pontos (nunca rebaixa), limitando a inclinação a `maxGrade`
  const limitGrade = () => {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const j = (i - 1 + n) % n;
        if (elevated[i] && elevated[j]) y[i] = Math.max(y[i], y[j] - cfg.maxGrade * ds[j]);
      }
      for (let i = n - 1; i >= 0; i--) {
        const j = (i + 1) % n;
        if (elevated[i] && elevated[j]) y[i] = Math.max(y[i], y[j] - cfg.maxGrade * ds[i]);
      }
    }
  };
  for (let it = 0; it < 4; it++) {
    flattenStations();
    limitGrade();
  }
  flattenStations();

  for (let i = 0; i < n; i++) pts[i].y = y[i];
  return pts;
}
