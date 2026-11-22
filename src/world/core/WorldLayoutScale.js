/**
 * WorldLayoutScale.js
 * Fonte única de verdade para escala horizontal do mapa (`WORLD_SCALE`, preservando alturas Y em 1x),
 * dimensões viárias/calçadas (`ROAD`), malha unificada de avenidas/ruas (`URBAN_GRID_LINES_X/Z`)
 * e ancoragem de prédios na borda interna da calçada de 10m (`wsStreetAnchored`).
 */

export const DEFAULT_WORLD_SCALE = 3;

export function resolveWorldScale(searchStr = undefined) {
  if (Number.isFinite(globalThis.__FORCE_WORLD_SCALE) && globalThis.__FORCE_WORLD_SCALE > 0) {
    return Number(globalThis.__FORCE_WORLD_SCALE);
  }
  const hasExplicitArg = searchStr !== undefined;
  const rawSearch = hasExplicitArg
    ? String(searchStr || '')
    : typeof window !== 'undefined' && window.location?.search
      ? String(window.location.search)
      : '';
  if (rawSearch) {
    try {
      const qs = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
      const params = new URLSearchParams(qs);
      const rawVal = params.get('worldScale');
      if (rawVal !== null && rawVal.trim() !== '') {
        const parsed = Number(rawVal);
        if (Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 10) {
          return parsed;
        }
      }
    } catch (_) {
      // ignora query string malformada
    }
  }
  // Em testes legados Node.js sem query explícita (enquanto Ondas 1–2 migram regiões/sistemas), preserva 1x até a Onda 3
  if (!hasExplicitArg && typeof process !== 'undefined' && process.versions?.node && !globalThis.__ENABLE_3X_DEFAULT_IN_NODE) {
    return 1;
  }
  return DEFAULT_WORLD_SCALE;
}

export const WORLD_SCALE = resolveWorldScale();
export const IS_SCALED_WORLD = Math.abs(WORLD_SCALE - 1) > 1e-4;

export const ws = (v) => (v === 0 ? 0 : v * WORLD_SCALE);
export const wsP = (x, z) => ({ x: ws(x), z: ws(z) });
export const wsPos3 = (p) => (p ? { ...p, x: ws(p.x), z: ws(p.z) } : p);
export const wsBounds = (b) =>
  b
    ? {
        ...b,
        minX: ws(b.minX),
        maxX: ws(b.maxX),
        minZ: ws(b.minZ),
        maxZ: ws(b.maxZ)
      }
    : b;
export const fromWs = (v) => (v === 0 ? 0 : v / WORLD_SCALE);

export const DESIGN_ROAD = Object.freeze({
  mainWidth: 28,
  secondaryWidth: 24,
  oldSidewalkMargin: 3.0
});

export function resolveRoadSpec(scale = WORLD_SCALE) {
  return Math.abs(scale - 1) > 1e-4
    ? { mainWidth: 34, secondaryWidth: 26, sidewalk: 10, curbHeight: 0.18 }
    : { mainWidth: 28, secondaryWidth: 24, sidewalk: 0, curbHeight: 0.28 };
}

export const ROAD = Object.freeze(resolveRoadSpec(WORLD_SCALE));

// Grade viária urbana unificada (coordenadas de projeto 1x)
export const DESIGN_MAIN_AVENUES_X = Object.freeze([-384, -252, -120, 0, 120, 252, 384]);
export const DESIGN_MAIN_AVENUES_Z = Object.freeze([-382, -250, -117, 0, 134, 402, 710]);
export const DESIGN_SECONDARY_STREETS_X = Object.freeze([-648, -516, 516, 648]);
export const DESIGN_INDUSTRIAL_STREETS_X = Object.freeze([600, 768, 964, 1160, 1344, 1524]);
export const DESIGN_SECONDARY_STREETS_Z = Object.freeze([-1172, -1040, -908, -776, -644, -512, 556]);

export const MAIN_AVENUES_X = Object.freeze(DESIGN_MAIN_AVENUES_X.map(ws));
export const MAIN_AVENUES_Z = Object.freeze(DESIGN_MAIN_AVENUES_Z.map(ws));
export const SECONDARY_STREETS_X = Object.freeze(DESIGN_SECONDARY_STREETS_X.map(ws));
export const INDUSTRIAL_STREETS_X = Object.freeze(DESIGN_INDUSTRIAL_STREETS_X.map(ws));
export const SECONDARY_STREETS_Z = Object.freeze(DESIGN_SECONDARY_STREETS_Z.map(ws));

export function buildUrbanGridDescriptors(mainDesignList, secDesignLists, scale = WORLD_SCALE, roadSpec = ROAD) {
  const byDesign = new Map();
  for (const d of mainDesignList) {
    const width = roadSpec.mainWidth;
    byDesign.set(
      d,
      Object.freeze({
        designCoord: d,
        coord: d === 0 ? 0 : d * scale,
        isMain: true,
        designWidth: DESIGN_ROAD.mainWidth,
        width,
        halfWidth: width * 0.5
      })
    );
  }
  for (const list of secDesignLists) {
    for (const d of list) {
      if (byDesign.has(d)) continue;
      const width = roadSpec.secondaryWidth;
      byDesign.set(
        d,
        Object.freeze({
          designCoord: d,
          coord: d === 0 ? 0 : d * scale,
          isMain: false,
          designWidth: DESIGN_ROAD.secondaryWidth,
          width,
          halfWidth: width * 0.5
        })
      );
    }
  }
  return Object.freeze([...byDesign.values()].sort((a, b) => a.designCoord - b.designCoord));
}

export const URBAN_GRID_LINES_X = buildUrbanGridDescriptors(
  DESIGN_MAIN_AVENUES_X,
  [DESIGN_SECONDARY_STREETS_X, DESIGN_INDUSTRIAL_STREETS_X]
);

export const URBAN_GRID_LINES_Z = buildUrbanGridDescriptors(
  DESIGN_MAIN_AVENUES_Z,
  [DESIGN_SECONDARY_STREETS_Z]
);

/**
 * Ancora uma coordenada 1D de projeto (`designVal`) à borda interna da calçada de 10m da rua
 * mais próxima quando `scale > 1`, preservando o tamanho 1x do prédio e deixando o miolo livre.
 * Quando `scale === 1`, retorna `designVal` bit-a-bit inalterado!
 */
export function computeStreetAnchoredCoord(
  designVal,
  gridLines,
  halfBuildingSpan = 0,
  scaleOverride = WORLD_SCALE,
  roadOverride = undefined
) {
  if (Math.abs(scaleOverride - 1) <= 1e-4) {
    return designVal;
  }
  if (!Array.isArray(gridLines) || gridLines.length === 0) {
    return designVal === 0 ? 0 : designVal * scaleOverride;
  }

  const scale = scaleOverride;
  const roadSpec = roadOverride || resolveRoadSpec(scale);
  const firstLine = gridLines[0];
  const lastLine = gridLines[gridLines.length - 1];

  // Fora da malha urbana (> 90m além da última via da grade): escala linearmente
  if (designVal < firstLine.designCoord - 90 || designVal > lastLine.designCoord + 90) {
    return designVal === 0 ? 0 : designVal * scale;
  }

  let nearestLine = firstLine;
  let nearestDist = Math.abs(designVal - firstLine.designCoord);
  let lineA = null;
  let lineB = null;

  for (let i = 0; i < gridLines.length; i++) {
    const ln = gridLines[i];
    const dist = Math.abs(designVal - ln.designCoord);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestLine = ln;
    }
    if (ln.designCoord <= designVal) {
      lineA = ln;
    }
    if (lineB === null && ln.designCoord >= designVal) {
      lineB = ln;
    }
  }

  // Elemento alinhado sobre o próprio eixo da avenida/rua (ex.: canteiro, ponte ou Super Banco em X = 0)
  if (nearestDist < nearestLine.designWidth * 0.45) {
    const baseScaled = nearestLine.designCoord === 0 ? 0 : nearestLine.designCoord * scale;
    return baseScaled + (designVal - nearestLine.designCoord);
  }

  let nearLine = nearestLine;
  const isEnclosed = Boolean(lineA && lineB && lineA !== lineB);
  if (isEnclosed) {
    nearLine =
      Math.abs(designVal - lineA.designCoord) <= Math.abs(lineB.designCoord - designVal)
        ? lineA
        : lineB;
  }

  const dir = designVal >= nearLine.designCoord ? 1 : -1;
  const newRoadW = nearLine.isMain ? roadSpec.mainWidth : roadSpec.secondaryWidth;
  const newHalfRoadW = newRoadW * 0.5;
  const oldAsphaltEdge = nearLine.designCoord + dir * (nearLine.designWidth * 0.5);
  const distFromOldAsphalt = Math.abs(designVal - oldAsphaltEdge);
  const offsetFromSidewalkInner = Math.max(
    halfBuildingSpan + 0.5,
    distFromOldAsphalt - DESIGN_ROAD.oldSidewalkMargin
  );
  const scaledNearCoord = nearLine.designCoord === 0 ? 0 : nearLine.designCoord * scale;
  const newSidewalkInner = scaledNearCoord + dir * (newHalfRoadW + roadSpec.sidewalk);
  let anchored = newSidewalkInner + dir * offsetFromSidewalkInner;

  if (isEnclosed) {
    const blockMid = (lineA.designCoord + lineB.designCoord) * 0.5 * scale;
    if (dir > 0) {
      anchored = Math.min(anchored, blockMid - halfBuildingSpan);
    } else {
      anchored = Math.max(anchored, blockMid + halfBuildingSpan);
    }
  }

  return anchored;
}

export function wsStreetAnchored(designX, designZ, opts = {}) {
  const scale = opts.scale ?? WORLD_SCALE;
  if (Math.abs(scale - 1) <= 1e-4) {
    return { x: designX, z: designZ };
  }
  const halfW = opts.halfW ?? opts.halfSpanX ?? 0;
  const halfD = opts.halfD ?? opts.halfSpanZ ?? 0;
  const road = opts.road ?? (Math.abs(scale - WORLD_SCALE) <= 1e-4 ? ROAD : resolveRoadSpec(scale));
  return {
    x: computeStreetAnchoredCoord(designX, URBAN_GRID_LINES_X, halfW, scale, road),
    z: computeStreetAnchoredCoord(designZ, URBAN_GRID_LINES_Z, halfD, scale, road)
  };
}
