// Planejamento compartilhado de PÓRTICOS sobre a rua (metrô elevado e viadutos de carro).
//
// Regra da cidade: nada que encosta no chão fica na rua. Quem passa por cima de uma avenida
// apoia num pórtico: um pilar em cada CALÇADA DE VERDADE (a dos quarteirões, calçadão, praça,
// parque ou água) e uma viga atravessando a rua inteira por cima.
//
// A base da ilha é asfalto: tudo que não é calçada/bloco registrado conta como rua.

export const PORTAL_SCAN_CONFIG = {
  scanStep: 0.5,       // Passo da varredura lateral do asfalto (m)
  maxScan: 60,         // Distância lateral máxima procurando a calçada (m)
  colHalf: 0.7,        // Meia largura do pilar quadrado
  sidewalkInset: 0.35, // Folga entre o meio-fio e a face do pilar
  sidewalkSlide: 4.0,  // Quanto o pilar pode entrar na calçada procurando lugar livre (m)
  roadMargin: 0.25     // Folga extra entre o pilar e a pista registrada
};

function roadAlongZ(r) {
  return r.d >= r.w;
}

function pointInRoad(r, x, z, margin = 0) {
  return Math.abs(x - r.x) <= r.w * 0.5 + margin && Math.abs(z - r.z) <= r.d * 0.5 + margin;
}

export function isInsideAnyRoad(roads, x, z, margin = 0) {
  for (let i = 0; i < roads.length; i++) {
    if (pointInRoad(roads[i], x, z, margin)) return true;
  }
  return false;
}

/** Faixa transversal (união das ruas paralelas ao eixo que contêm o ponto), ou null. */
export function parallelCorridorAt(roads, x, z, alongZ) {
  let lo = Infinity;
  let hi = -Infinity;
  let found = false;
  let grew = true;
  // Expande pela união de ruas paralelas sobrepostas (algumas regiões registram ruas duplicadas).
  while (grew) {
    grew = false;
    for (const r of roads) {
      if (roadAlongZ(r) !== alongZ) continue;
      const along = alongZ ? z : x;
      const rAlongC = alongZ ? r.z : r.x;
      const rAlongHalf = (alongZ ? r.d : r.w) * 0.5;
      if (Math.abs(along - rAlongC) > rAlongHalf) continue;
      const rc = alongZ ? r.x : r.z;
      const rh = (alongZ ? r.w : r.d) * 0.5;
      const cross = alongZ ? x : z;
      const touches = found ? rc + rh >= lo - 0.01 && rc - rh <= hi + 0.01 : Math.abs(cross - rc) <= rh;
      if (!touches) continue;
      if (rc - rh < lo - 0.01 || rc + rh > hi + 0.01 || !found) {
        lo = Math.min(lo, rc - rh);
        hi = Math.max(hi, rc + rh);
        found = true;
        grew = true;
      }
    }
  }
  return found ? { lo, hi } : null;
}

/** Ponto em cima de rua transversal (perpendicular ao eixo), com folga. */
export function onCrossRoad(roads, x, z, alongZ, margin) {
  for (const r of roads) {
    if (roadAlongZ(r) === alongZ) continue;
    if (pointInRoad(r, x, z, margin)) return true;
  }
  return false;
}

/**
 * Consulta rápida (grade de 32m): o ponto está em chão que NÃO é rua?
 * Calçadas dos quarteirões (`world.mapSidewalks`) e blocos não-viários do mapa (`world.mapBlocks`:
 * calçadão da praia, praças, parques, quadras). O resto da base da ilha é asfalto = rua.
 * `extraBlocks` permite ignorar blocos que não são chão de verdade (ex.: tabuleiros de viaduto).
 */
export function makeFootingLookup(world, { ignoreBlock = null } = {}) {
  const cell = 32;
  const grid = new Map();
  const rects = [
    ...(world.mapSidewalks || []),
    ...(world.mapBlocks || [])
      .filter((b) => !ignoreBlock || !ignoreBlock(b))
      .map((b) => ({
        minX: b.x - b.w * 0.5,
        maxX: b.x + b.w * 0.5,
        minZ: b.z - b.d * 0.5,
        maxZ: b.z + b.d * 0.5
      }))
  ];
  for (const r of rects) {
    for (let gx = Math.floor(r.minX / cell); gx <= Math.floor(r.maxX / cell); gx++) {
      for (let gz = Math.floor(r.minZ / cell); gz <= Math.floor(r.maxZ / cell); gz++) {
        const k = `${gx},${gz}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(r);
      }
    }
  }
  return (x, z) => {
    const list = grid.get(`${Math.floor(x / cell)},${Math.floor(z / cell)}`);
    if (!list) return false;
    for (const r of list) if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return true;
    return false;
  };
}

/** Prédio (collider grande que nasce no chão) no ponto: fim da varredura lateral do asfalto. */
export function isBuildingAt(world, x, z) {
  const cols = world.getCollidersNear ? world.getCollidersNear(x, z, 0.5) : world.colliders || [];
  for (const col of cols) {
    if (col.disabled) continue;
    if ((col.minY ?? 0) > 2.0 || col.maxY < 3.0) continue;
    if ((col.maxX - col.minX) * (col.maxZ - col.minZ) < 9) continue; // postes, árvores, placas não contam
    if (x >= col.minX && x <= col.maxX && z >= col.minZ && z <= col.maxZ) return true;
  }
  return false;
}

/**
 * Pilares de um pórtico atravessando a rua no ponto (x, z) de uma via que corre ao longo de Z (`alongZ`)
 * ou de X. Varre o asfalto para os dois lados até a calçada de verdade e põe cada pilar inteiro nela.
 * @param fits(c) -> true se o pilar `c = {x, z}` cabe ali (objetos, escadas, altura...) — pode preencher `c.groundY`
 * @returns `[colLado-, colLado+]` ou null (prédio antes da calçada, nenhuma posição livre...)
 */
export function findPortalColumns({ x, z, alongZ, roads, isFooting, isBuilding, fits, config = {} }) {
  const cfg = { ...PORTAL_SCAN_CONFIG, ...config };
  const cross0 = alongZ ? x : z;
  const pt = (c) => (alongZ ? { x: c, z } : { x, z: c });
  const footOnFooting = (c) => {
    const h = cfg.colHalf;
    const corners = alongZ
      ? [[c - h, z - h], [c + h, z - h], [c - h, z + h], [c + h, z + h], [c, z]]
      : [[x - h, c - h], [x + h, c - h], [x - h, c + h], [x + h, c + h], [x, c]];
    return corners.every(([px, pz]) => isFooting(px, pz) && !isInsideAnyRoad(roads, px, pz, cfg.roadMargin));
  };
  const cols = [];
  for (const dir of [-1, 1]) {
    // 1) Varre o asfalto até a calçada de verdade (prédio antes = sem apoio aqui)
    let curb = null;
    for (let d = cfg.scanStep; d <= cfg.maxScan; d += cfg.scanStep) {
      const c = cross0 + dir * d;
      const p = pt(c);
      if (isFooting(p.x, p.z) && !isInsideAnyRoad(roads, p.x, p.z, 0)) {
        curb = c;
        break;
      }
      if (isBuilding(p.x, p.z)) break;
    }
    if (curb === null) return null;
    // 2) Pilar inteiro em cima da calçada, livre de objetos/escadas
    let placed = null;
    for (let k = cfg.colHalf + cfg.sidewalkInset; k <= cfg.colHalf + cfg.sidewalkInset + cfg.sidewalkSlide; k += 0.25) {
      const cc = curb + dir * k;
      if (!footOnFooting(cc)) continue;
      const c = pt(cc);
      if (fits(c)) {
        placed = c;
        break;
      }
    }
    if (!placed) return null;
    cols.push(placed);
  }
  return cols;
}
