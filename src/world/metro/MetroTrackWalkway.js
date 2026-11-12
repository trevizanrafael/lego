// Piso andável e muretas com colisão em cima do trilho elevado do Metrô LEGO.
//
// O trilho vira um "deck" (`world.elevatedDecks`) como as plataformas e viadutos: dá para pousar,
// andar e correr em cima dele. Para não pesar no `getSurfaceHeightAt`, os pontos da linha são agrupados:
//   - trecho reto alinhado a X ou Z -> 1 deck retangular (altura interpolada ao longo do trecho);
//   - curva -> 1 deck com a caixa da curva (altura do ponto mais próximo da linha).
// As muretas laterais ganham colisão fora das estações (nas estações o lado da plataforma fica livre).
import * as THREE from 'three';

export const WALKWAY_CONFIG = {
  step: 2,            // Amostragem ao longo da linha (m)
  minY: 1.0,          // Só a partir desta altura do trilho (rampas dos portais já fora do chão)
  halfWidth: 3.4,     // Meia largura do piso andável (dentro das muretas)
  surfaceOffset: 0.18, // Topo dos dormentes acima do topo de referência do trilho
  wallOffset: 3.55,   // Eixo das muretas laterais
  wallChunk: 24,      // Comprimento máximo de cada collider de mureta (m)
  stationClear: 34    // Sem mureta com colisão a esta distância (ao longo da linha) de uma estação
};

export function buildTrackWalkway(world, spline, config = {}) {
  const cfg = { ...WALKWAY_CONFIG, ...config };
  if (!world.elevatedDecks) world.elevatedDecks = [];
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();

  // 1) Amostras da linha acima do chão
  const samples = [];
  for (let s = 0; s < spline.totalLength; s += cfg.step) {
    spline.sampleAtS(s, pos, tan);
    const hl = Math.hypot(tan.x, tan.z) || 1;
    samples.push({ s, x: pos.x, y: pos.y, z: pos.z, hx: tan.x / hl, hz: tan.z / hl, on: pos.y >= cfg.minY });
  }

  // 2) Agrupa em trechos retos (alinhados a X/Z) e curvas
  const groups = [];
  let cur = null;
  const close = () => {
    if (cur && cur.pts.length > 1) groups.push(cur);
    cur = null;
  };
  for (const p of samples) {
    if (!p.on) {
      close();
      continue;
    }
    const alongZ = Math.abs(p.hz) > 0.9995;
    const alongX = Math.abs(p.hx) > 0.9995;
    const kind = alongZ ? 'z' : alongX ? 'x' : 'curve';
    const cross = kind === 'z' ? p.x : kind === 'x' ? p.z : 0;
    if (cur && cur.kind === kind && (kind === 'curve' || Math.abs(cross - cur.cross) < 0.05)) {
      cur.pts.push(p);
    } else {
      close();
      cur = { kind, cross, pts: [p] };
    }
  }
  close();

  const isNearStation = (s) =>
    (spline.stationStops || []).some((st) => {
      let d = Math.abs(st.stopS - s);
      d = Math.min(d, spline.totalLength - d);
      return d < cfg.stationClear;
    });

  const decks = [];
  for (const g of groups) {
    const xs = g.pts.map((p) => p.x);
    const zs = g.pts.map((p) => p.z);
    const hw = cfg.halfWidth;
    if (g.kind === 'curve') {
      const pts = g.pts;
      decks.push({
        id: `metro_track_curve_${decks.length}`,
        minX: Math.min(...xs) - hw,
        maxX: Math.max(...xs) + hw,
        minZ: Math.min(...zs) - hw,
        maxZ: Math.max(...zs) + hw,
        thresholdBelow: 2.2,
        isMetroTrack: true,
        getDeckY: (x, z) => {
          let best = null;
          let bestD = Infinity;
          for (const p of pts) {
            const d = (p.x - x) ** 2 + (p.z - z) ** 2;
            if (d < bestD) {
              bestD = d;
              best = p;
            }
          }
          return bestD <= hw * hw ? best.y + cfg.surfaceOffset : null;
        }
      });
      continue;
    }

    const alongZ = g.kind === 'z';
    const along = g.pts.map((p) => (alongZ ? p.z : p.x));
    const ys = g.pts.map((p) => p.y);
    const asc = along[along.length - 1] >= along[0];
    const a = asc ? along : along.slice().reverse();
    const y = asc ? ys : ys.slice().reverse();
    const lo = a[0] - cfg.step * 0.5;
    const hi = a[a.length - 1] + cfg.step * 0.5;
    const interpY = (c) => {
      if (c <= a[0]) return y[0];
      if (c >= a[a.length - 1]) return y[y.length - 1];
      let i = 1;
      while (i < a.length - 1 && a[i] < c) i++;
      const t = (c - a[i - 1]) / Math.max(1e-6, a[i] - a[i - 1]);
      return y[i - 1] + (y[i] - y[i - 1]) * t;
    };
    decks.push({
      id: `metro_track_${g.kind}_${decks.length}`,
      minX: alongZ ? g.cross - hw : lo,
      maxX: alongZ ? g.cross + hw : hi,
      minZ: alongZ ? lo : g.cross - hw,
      maxZ: alongZ ? hi : g.cross + hw,
      thresholdBelow: 2.2,
      isMetroTrack: true,
      getDeckY: (x, z) => interpY(alongZ ? z : x) + cfg.surfaceOffset
    });

    // Muretas laterais com colisão (fora das estações), em pedaços curtos para acompanhar a rampa
    let chunk = [];
    const flush = () => {
      if (chunk.length < 2) {
        chunk = [];
        return;
      }
      const c0 = Math.min(...chunk.map((p) => (alongZ ? p.z : p.x)));
      const c1 = Math.max(...chunk.map((p) => (alongZ ? p.z : p.x)));
      const yMin = Math.min(...chunk.map((p) => p.y));
      const yMax = Math.max(...chunk.map((p) => p.y));
      const len = c1 - c0 + cfg.step;
      const mid = (c0 + c1) * 0.5;
      for (const side of [-1, 1]) {
        const wc = g.cross + side * cfg.wallOffset;
        const cx = alongZ ? wc : mid;
        const cz = alongZ ? mid : wc;
        world.addCollider(cx, cz, alongZ ? 0.3 : len, alongZ ? len : 0.3, yMax + 1.1, yMin + 0.1);
      }
      chunk = [];
    };
    for (const p of g.pts) {
      if (isNearStation(p.s)) {
        flush();
        continue;
      }
      chunk.push(p);
      if (chunk.length * cfg.step >= cfg.wallChunk) flush();
    }
    flush();
  }

  world.elevatedDecks.push(...decks);
  world.metroTrackDecks = decks;
  return decks;
}
