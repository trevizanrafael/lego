// Planejamento dos apoios (pilares) da linha elevada do Metrô LEGO.
//
// Regra (Etapa 2 do remodel): NENHUM pilar dentro de pista de carro.
//   - Trecho da linha que corre AO LONGO de uma rua/avenida -> PÓRTICO:
//     um pilar em cada calçada (logo após o meio-fio) + viga atravessando a rua por cima.
//   - Trecho fora de ruas (praças, quadras) -> pilar único sob o eixo do trilho.
//   - Em cima de cruzamentos/ruas transversais -> nenhum apoio (vão livre).
//   - Cada pilar também evita prédios/objetos já existentes.
//   - Os apoios são distribuídos por igual em cada trecho livre, com um em cada ponta (antes dos cruzamentos).
//
// Função pura: recebe a curva do anel, a lista de ruas (`world.mapRoads`) e callbacks do mundo.
import * as THREE from 'three';

export const SUPPORT_CONFIG = {
  spacing: 30,          // Distância alvo entre apoios ao longo da linha (m)
  minGap: 18,           // Distância mínima entre dois apoios aceitos (m)
  minTrackY: 4.5,       // Só a partir desta altura do trilho existe estrutura elevada com pilares
  colHalf: 0.7,         // Meia largura do pilar quadrado (1.4m)
  curbOffsets: [1.5, 2.5, 3.5, 4.5, 6.0], // Centro do pilar a partir do meio-fio (tenta o mais perto primeiro)
  roadMargin: 0.25,     // Folga extra entre pilar e asfalto
  crossRoadMargin: 3.0, // Folga para considerar "em cima de rua transversal"
  minColumnH: 3.0,      // Abaixo disso não precisa de pilar
  deckUnderside: 1.09,  // Distância do topo do trilho até o fundo do tabuleiro
  beamH: 1.3,           // Altura da viga do pórtico / capitel
  headroom: 2.2         // Vão livre de uma pessoa sob a viga
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

/** Faixa transversal (união das ruas paralelas à linha que contêm o ponto), ou null. */
function parallelCorridorAt(roads, x, z, alongZ) {
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

function onCrossRoad(roads, x, z, alongZ, margin) {
  for (const r of roads) {
    if (roadAlongZ(r) === alongZ) continue;
    if (pointInRoad(r, x, z, margin)) return true;
  }
  return false;
}

/**
 * @param spline   curva do anel (`sampleAtS`, `totalLength`)
 * @param roads    `world.mapRoads`
 * @param opts.isBlocked(x, z, half, minY, maxY) -> true se há prédio/objeto no local, ou escada/passarela com altura em [minY, maxY]
 * @param opts.isDeckInRange(x, z, half, minY, maxY) -> true se há escada/passarela com altura em [minY, maxY] (checado ao longo da viga)
 * @param opts.getGroundY(x, z)      -> altura do chão
 * @returns lista de apoios: { kind: 'portal'|'single', s, trackY, beamY, cols: [{x, z, groundY}], beam: {x1,z1,x2,z2} }
 */
export function planElevatedSupports(spline, roads, opts = {}) {
  const cfg = { ...SUPPORT_CONFIG, ...(opts.config || {}) };
  const isBlocked = opts.isBlocked || (() => false);
  const isDeckInRange = opts.isDeckInRange || (() => false);
  const getGroundY = opts.getGroundY || (() => 0);
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const tanA = new THREE.Vector3();
  const tanB = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  const colOk = (x, z, minY, maxY) =>
    !isInsideAnyRoad(roads, x, z, cfg.colHalf + cfg.roadMargin) && !isBlocked(x, z, cfg.colHalf, minY, maxY);

  const tryBentAt = (s) => {
    spline.sampleAtS(s, pos, tan);
    if (pos.y < cfg.minTrackY) return null;
    // Só em trecho reto e alinhado aos eixos da cidade (curvas ficam em cima de cruzamentos)
    spline.sampleAtS(s - 4, tmp, tanA);
    spline.sampleAtS(s + 4, tmp, tanB);
    // Direções só no plano horizontal (a inclinação das rampas não conta como curva)
    for (const v of [tan, tanA, tanB]) {
      v.y = 0;
      v.normalize();
    }
    const alongZ = Math.abs(tan.z) > Math.abs(tan.x);
    const axisDot = Math.max(Math.abs(tan.x), Math.abs(tan.z));
    if (axisDot < 0.97 || tanA.dot(tanB) < 0.995) return null;

    const x = pos.x;
    const z = pos.z;
    if (onCrossRoad(roads, x, z, alongZ, cfg.crossRoadMargin)) return null;

    const beamTop = pos.y - cfg.deckUnderside;
    const beamY = beamTop - cfg.beamH * 0.5;
    const corridor = parallelCorridorAt(roads, x, z, alongZ);
    const beamTopY = beamY + cfg.beamH * 0.5;
    const beamBottomY = beamY - cfg.beamH * 0.5;
    const fits = (c) => {
      // Pilar não pode atravessar escada/passarela que esteja abaixo do topo da viga
      if (!colOk(c.x, c.z, -Infinity, beamTopY + 0.3)) return false;
      c.groundY = getGroundY(c.x, c.z);
      return beamY - cfg.beamH * 0.5 - c.groundY >= cfg.minColumnH;
    };
    let cols;
    let kind;
    if (corridor) {
      kind = 'portal';
      cols = [];
      // Cada pilar tenta ficar logo após o meio-fio; se a calçada estiver ocupada (escada, banca...), afasta mais
      for (const [edge, dir] of [[corridor.lo, -1], [corridor.hi, 1]]) {
        let placed = null;
        for (const off of cfg.curbOffsets) {
          const cross = edge + dir * off;
          const c = alongZ ? { x: cross, z } : { x, z: cross };
          if (fits(c)) {
            placed = c;
            break;
          }
        }
        if (!placed) return null;
        cols.push(placed);
      }
    } else {
      kind = 'single';
      const c = { x, z };
      if (!fits(c)) return null;
      cols = [c];
    }
    const beam = { x1: cols[0].x, z1: cols[0].z, x2: cols[cols.length - 1].x, z2: cols[cols.length - 1].z };
    // A viga não pode passar por cima de escadas/passarelas na altura da cabeça de quem sobe
    const beamLen = Math.hypot(beam.x2 - beam.x1, beam.z2 - beam.z1);
    for (let d = 0; d <= beamLen; d += 1) {
      const t = beamLen > 0 ? d / beamLen : 0;
      const bx = beam.x1 + (beam.x2 - beam.x1) * t;
      const bz = beam.z1 + (beam.z2 - beam.z1) * t;
      // Deck por CIMA da viga (plataforma apoiada) é ok; na altura da cabeça de quem passa, não.
      if (isDeckInRange(bx, bz, 0.8, beamBottomY - cfg.headroom, beamTopY + 0.3)) return null;
    }
    return { kind, s, trackY: pos.y, beamY, alongZ, corridor, cols, beam };
  };

  // 1) Trechos contínuos (resolução de 1m) onde um apoio é possível
  const step = 1;
  const intervals = [];
  let cur = null;
  for (let s = 0; s < spline.totalLength; s += step) {
    const ok = tryBentAt(s) !== null;
    if (ok && !cur) cur = { a: s, b: s };
    else if (ok) cur.b = s;
    else if (cur) {
      intervals.push(cur);
      cur = null;
    }
  }
  if (cur) intervals.push(cur);

  // 2) Distribui os apoios por igual em cada trecho, com um em cada ponta
  //    (pilar logo antes de cada cruzamento, como num viaduto de verdade)
  const candidates = [];
  for (const it of intervals) {
    const len = it.b - it.a;
    if (len < cfg.minGap) {
      candidates.push(it.a + len * 0.5);
      continue;
    }
    const n = Math.ceil(len / cfg.spacing);
    for (let k = 0; k <= n; k++) candidates.push(it.a + (len * k) / n);
  }

  // 3) Remove apoios colados (inclusive no fechamento do anel)
  const bents = [];
  let lastS = -Infinity;
  for (const s of candidates) {
    if (s - lastS < cfg.minGap) continue;
    const bent = tryBentAt(s);
    if (!bent) continue;
    bents.push(bent);
    lastS = s;
  }
  if (bents.length > 1) {
    const first = bents[0];
    const last = bents[bents.length - 1];
    if (first.s + spline.totalLength - last.s < cfg.minGap) bents.pop();
  }
  return bents;
}
