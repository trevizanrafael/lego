// Planejamento dos apoios (pilares) da linha elevada do Metrô LEGO.
//
// Regra (Etapa 2 do remodel): NENHUM pilar dentro de pista de carro.
//   - Trecho da linha que corre AO LONGO de uma rua/avenida -> PÓRTICO:
//     a partir do trilho varre TODO o asfalto para os dois lados até achar a calçada de verdade
//     (a dos quarteirões, junto aos prédios); o pilar fica em cima dessa calçada e a viga atravessa
//     a rua inteira por cima. Se encontrar prédio antes de calçada, não põe apoio ali.
//   - Trecho fora de ruas (praças, quadras) -> pilar único sob o eixo do trilho.
//   - Em cima de cruzamentos/ruas transversais -> nenhum apoio (vão livre).
//   - Cada pilar também evita prédios/objetos já existentes.
//   - Os apoios são distribuídos por igual em cada trecho livre, com um em cada ponta (antes dos cruzamentos).
//
// Função pura: recebe a curva do anel, a lista de ruas (`world.mapRoads`) e callbacks do mundo.
import * as THREE from 'three';
import {
  isInsideAnyRoad,
  parallelCorridorAt,
  onCrossRoad,
  findPortalColumns
} from '../StreetPortalPlanner.js';

export const SUPPORT_CONFIG = {
  spacing: 30,          // Distância alvo entre apoios ao longo da linha (m)
  minGap: 18,           // Distância mínima entre dois apoios aceitos (m)
  minTrackY: 4.5,       // Só a partir desta altura do trilho existe estrutura elevada com pilares
  colHalf: 0.7,         // Meia largura do pilar quadrado (1.4m)
  scanStep: 0.5,        // Passo da varredura lateral do asfalto (m)
  maxScan: 60,          // Distância lateral máxima procurando a calçada (m)
  sidewalkInset: 0.35,  // Folga entre a borda da calçada (meio-fio) e a face do pilar
  sidewalkSlide: 4.0,   // Quanto o pilar pode entrar na calçada procurando lugar livre (m)
  roadMargin: 0.25,     // Folga extra entre pilar e asfalto
  crossRoadMargin: 3.0, // Folga para considerar "em cima de rua transversal"
  minColumnH: 3.0,      // Abaixo disso não precisa de pilar
  deckUnderside: 1.09,  // Distância do topo do trilho até o fundo do tabuleiro
  beamH: 1.3,           // Altura da viga do pórtico / capitel
  headroom: 2.2         // Vão livre de uma pessoa sob a viga
};

export { isInsideAnyRoad };

/**
 * @param spline   curva do anel (`sampleAtS`, `totalLength`)
 * @param roads    `world.mapRoads`
 * @param opts.isBlocked(x, z, half, minY, maxY) -> true se há prédio/objeto no local, ou escada/passarela com altura em [minY, maxY]
 * @param opts.isDeckInRange(x, z, half, minY, maxY) -> true se há escada/passarela com altura em [minY, maxY] (checado ao longo da viga)
 * @param opts.isSidewalk(x, z)      -> true se o ponto está em calçada de verdade (quarteirões)
 * @param opts.isBuildingAt(x, z)    -> true se há prédio no ponto (fim da varredura lateral)
 * @param opts.getGroundY(x, z)      -> altura do chão
 * @returns lista de apoios: { kind: 'portal'|'single', s, trackY, beamY, cols: [{x, z, groundY}], beam: {x1,z1,x2,z2} }
 */
export function planElevatedSupports(spline, roads, opts = {}) {
  const cfg = { ...SUPPORT_CONFIG, ...(opts.config || {}) };
  const isBlocked = opts.isBlocked || (() => false);
  const isDeckInRange = opts.isDeckInRange || (() => false);
  const getGroundY = opts.getGroundY || (() => 0);
  const isSidewalk = opts.isSidewalk || (() => false);
  const isBuildingAt = opts.isBuildingAt || (() => false);
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
      cols = findPortalColumns({
        x,
        z,
        alongZ,
        roads,
        isFooting: isSidewalk,
        isBuilding: isBuildingAt,
        fits,
        config: cfg
      });
      if (!cols) return null;
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
