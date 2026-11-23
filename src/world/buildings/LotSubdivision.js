/**
 * LotSubdivision.js
 * Subdivisão urbana determinística não-cartesiana de parcelas (OBB 2D) para o Centro & Transição Norte (`3x`):
 *  - Âncoras de esquina (`36–56 m × 34–42 m`) para torres com pódio e marcos Art-Deco
 *  - Lotes estreitos históricos (`13–22 m × 18–30 m`) em fita (`1.6–3.4 m` de folga de empena cega)
 *    lado a lado com arranha-céus corporativos de `40–55` andares (`140–218 m`)
 *  - Lotes corporativos médios (`26–38 m × 24–36 m`) com recuos e pátios internos (`>= 8 m`)
 *  - Eixos monumentais de visada livre (Super Banco Central e Forecourt da Torre dos Heróis)
 */

const HISTORIC_STYLES = Object.freeze(['ny_brick', 'classic_sandstone', 'white_concrete']);
const LANDMARK_TOWER_STYLES = Object.freeze([
  'sapphire_glass', 'black_granite_gold', 'cyan_modern', 'silver_corporate', 'emerald_steel'
]);
const TRANSITION_MID_STYLES = Object.freeze([
  'ny_brick', 'classic_sandstone', 'white_concrete', 'silver_corporate', 'emerald_steel'
]);

export function lotHash01(seed, salt = 0) {
  let h = Math.imul((seed | 0) ^ Math.imul(salt | 0, 0x9e3779b1), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const randInt = (seed, salt, minV, maxV) => minV + Math.floor(lotHash01(seed, salt) * (maxV - minV + 1));

const MONUMENTAL_VISTA_KEEPOUTS = Object.freeze([
  Object.freeze({ id: 'bank_monumental_vista', minX: -58, maxX: 58, minZ: -505, maxZ: -245 }),
  Object.freeze({ id: 'bank_flank_nw', minX: -125, maxX: -79, minZ: -450, maxZ: -406 }),
  Object.freeze({ id: 'bank_flank_ne', minX: 79, maxX: 125, minZ: -450, maxZ: -406 }),
  Object.freeze({ id: 'bank_flank_sw', minX: -108, maxX: -64, minZ: -309, maxZ: -267 }),
  Object.freeze({ id: 'bank_flank_se', minX: 64, maxX: 108, minZ: -309, maxZ: -267 }),
  Object.freeze({ id: 'hero_forecourt_south', minX: -1020, maxX: -912, minZ: -469, maxZ: -372 }),
  Object.freeze({ id: 'hero_forecourt_east', minX: -919, maxX: -825, minZ: -568, maxZ: -464 }),
  Object.freeze({ id: 'metro_west_portal_join', minX: -272, maxX: -220, minZ: -752, maxZ: -596 }),
  Object.freeze({ id: 'metro_east_portal_join', minX: 220, maxX: 272, minZ: -752, maxZ: -596 })
]);

export function getMonumentalVistaKeepouts() {
  return MONUMENTAL_VISTA_KEEPOUTS;
}

function resolveRowBlindSides(idxInRow, rowCount, plusCursorIsRight) {
  if (rowCount <= 1) return 'none';
  if (idxInRow > 0 && idxInRow < rowCount - 1) return 'both';
  if (idxInRow < rowCount - 1) return plusCursorIsRight ? 'right' : 'left';
  return plusCursorIsRight ? 'left' : 'right';
}

function makeEdgeParcel(axis, fixedEdge, inSign, rotY, plusRight, centerAlong, w, d, setback, meta) {
  const perp = inSign * (d * 0.5 + setback);
  const cx = Math.round((axis === 'x' ? centerAlong : fixedEdge + perp) * 100) / 100;
  const cz = Math.round((axis === 'x' ? fixedEdge + perp : centerAlong) * 100) / 100;
  return {
    cx, cz, w, d, rotY, setback,
    plusCursorIsRight: plusRight,
    streetTargetX: axis === 'x' ? cx : fixedEdge - inSign * 18,
    streetTargetZ: axis === 'x' ? fixedEdge - inSign * 18 : cz,
    ...meta
  };
}

/**
 * Subdivide uma borda de super-quadra (`axis = 'x' | 'z'`) em parcelas urbanas variadas (`13–56 m` × `18–42 m`).
 */
export function subdivideEdgeIntoParcels(edgeSpec, seed = 1) {
  const axis = edgeSpec.axis === 'z' ? 'z' : 'x';
  const from = Number(edgeSpec.from ?? edgeSpec.minCoord ?? 0);
  const to = Number(edgeSpec.to ?? edgeSpec.maxCoord ?? 0);
  const fixedEdge = Number(edgeSpec.fixedEdge ?? 0);
  const inSign = edgeSpec.inSign >= 0 ? 1 : -1;
  const includeCorners = edgeSpec.includeCorners !== false;
  const totalSpan = to - from;
  if (totalSpan < 26) return [];

  const rotY = axis === 'x' ? (inSign < 0 ? 0 : Math.PI) : (inSign > 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
  const plusRight = Math.cos(rotY) * (axis === 'x' ? 1 : 0) - Math.sin(rotY) * (axis === 'x' ? 0 : 1) >= 0;
  const parcels = [];
  let cursor = from + 2.0;
  let rightLimit = to - 2.0;

  if (includeCorners && totalSpan >= 108) {
    const w0 = randInt(seed, 11, 39, 56);
    const d0 = Math.max(w0 - 20, randInt(seed, 12, 34, 42));
    parcels.push(makeEdgeParcel(axis, fixedEdge, inSign, rotY, plusRight, cursor + w0 * 0.5, w0, d0, 0.4, {
      lotClass: 'corner_anchor', blindSides: 'none', minGap: 3.6, adjacentToHistoric: false,
      fallbackW: 36, fallbackD: 32, seed: seed * 31 + 3
    }));
    cursor += w0 + 4.6 + lotHash01(seed, 13) * 1.8;

    if (rightLimit - cursor >= 92) {
      const w1 = randInt(seed, 14, 38, 55);
      const d1 = Math.max(w1 - 20, randInt(seed, 15, 34, 42));
      parcels.push(makeEdgeParcel(axis, fixedEdge, inSign, rotY, plusRight, rightLimit - w1 * 0.5, w1, d1, 0.4, {
        lotClass: 'corner_anchor', blindSides: 'none', minGap: 3.6, adjacentToHistoric: false,
        fallbackW: 36, fallbackD: 32, seed: seed * 31 + 7
      }));
      rightLimit -= w1 + 4.6 + lotHash01(seed, 16) * 1.8;
    }
  }

  let clusterIdx = 0;
  let prevWasHistoric = false;
  while (cursor + 14 <= rightLimit) {
    const cSeed = seed * 59 + clusterIdx * 23 + Math.round(cursor);
    const rem = rightLimit - cursor;
    if (!prevWasHistoric && rem >= 34 && lotHash01(cSeed, 1) < 0.52) {
      const rowCount = randInt(cSeed, 2, 2, rem >= 68 ? 3 : 2);
      const widths = [];
      let rowSpan = 0;
      const partyGap = Math.round((1.7 + lotHash01(cSeed, 3) * 1.5) * 10) / 10;
      for (let r = 0; r < rowCount; r++) {
        const nw = randInt(cSeed + r * 17, 4, 13, 21);
        if (rowSpan + nw + (r > 0 ? partyGap : 0) > rem) break;
        widths.push(nw);
        rowSpan += nw + (r > 0 ? partyGap : 0);
      }
      for (let r = 0; r < widths.length; r++) {
        const nw = widths[r];
        const nd = randInt(cSeed + r * 19, 5, 18, 29);
        const sb = Math.round(lotHash01(cSeed + r * 7, 6) * 1.1 * 10) / 10;
        parcels.push(makeEdgeParcel(axis, fixedEdge, inSign, rotY, plusRight, cursor + nw * 0.5, nw, nd, sb, {
          lotClass: 'narrow_historic', blindSides: resolveRowBlindSides(r, widths.length, plusRight),
          minGap: 1.5, adjacentToHistoric: true, fallbackW: Math.max(13, nw - 2),
          fallbackD: Math.max(18, nd - 2), seed: cSeed + r * 11
        }));
        cursor += nw + (r < widths.length - 1 ? partyGap : 4.6 + lotHash01(cSeed, 8) * 2.0);
      }
      prevWasHistoric = widths.length > 0;
    } else {
      const wantLandmark = prevWasHistoric && rem >= 40 && lotHash01(cSeed, 9) < 0.48;
      const cw = Math.min(wantLandmark ? randInt(cSeed, 10, 38, 46) : randInt(cSeed, 10, 26, 38), Math.floor(rem));
      if (cw < 13) break;
      const isNarrow = cw <= 22;
      const cd = isNarrow ? randInt(cSeed, 11, 18, 28) : Math.max(cw - 16, randInt(cSeed, 11, 24, 36));
      const sb = isNarrow ? 0.4 : Math.round((0.6 + lotHash01(cSeed, 12) * 2.2) * 10) / 10;
      parcels.push(makeEdgeParcel(axis, fixedEdge, inSign, rotY, plusRight, cursor + cw * 0.5, cw, cd, sb, {
        lotClass: isNarrow ? 'narrow_historic' : wantLandmark ? 'corner_anchor' : 'medium_corporate',
        blindSides: 'none', minGap: isNarrow ? 2.0 : 3.6, adjacentToHistoric: prevWasHistoric,
        fallbackW: Math.max(15, Math.min(28, cw - 6)), fallbackD: Math.max(18, Math.min(24, cd - 4)),
        seed: cSeed + 5
      }));
      cursor += cw + 4.8 + lotHash01(cSeed, 13) * 2.6;
      prevWasHistoric = isNarrow;
    }
    clusterIdx++;
  }
  return parcels;
}

/**
 * Subdivide os lados (`side = -1 | +1`) de um segmento viário orgânico em lotes orientados (`rotY`).
 */
export function subdivideSegmentCorridorLots(seg, side, seed = 1) {
  if (!seg || seg.len < 32) return [];
  const sgn = side >= 0 ? 1 : -1;
  const tx = (seg.x2 - seg.x1) / seg.len;
  const tz = (seg.z2 - seg.z1) / seg.len;
  const nx = -tz * sgn;
  const nz = tx * sgn;
  const rotY = Math.atan2(-nx, -nz);
  const plusRight = Math.cos(rotY) * tx - Math.sin(rotY) * tz >= 0;
  const baseClear = (seg.halfWidth || 13) + (seg.sidewalk ?? 10) + 2.4;

  const makeSegLot = (sPos, w, d, setback, meta) => {
    const sx = seg.x1 + tx * sPos;
    const sz = seg.z1 + tz * sPos;
    const perpDist = baseClear + setback + d * 0.5;
    return {
      cx: Math.round((sx + nx * perpDist) * 100) / 100,
      cz: Math.round((sz + nz * perpDist) * 100) / 100,
      w, d, rotY, setback, streetTargetX: sx, streetTargetZ: sz, ...meta
    };
  };

  if (seg.len < 68) {
    const w = Math.max(15, Math.min(38, Math.floor(seg.len - 10)));
    const d = randInt(seed, 21, 20, 28);
    return [makeSegLot(seg.len * 0.5, w, d, 0.4, {
      lotClass: w <= 22 ? 'narrow_historic' : 'medium_corporate', blindSides: 'none', minGap: 2.8,
      adjacentToHistoric: false, fallbackW: Math.max(14, w - 6), fallbackD: Math.max(18, d - 4), seed: seed * 29 + 1
    })];
  }

  const lots = [];
  let sCursor = 16;
  const sLimit = seg.len - 16;
  let stepIdx = 0;
  let prevHist = false;

  while (sCursor + 14 <= sLimit) {
    const lSeed = seed * 41 + stepIdx * 17 + (sgn > 0 ? 7 : 3) + Math.round(sCursor);
    const rem = sLimit - sCursor;
    if ((stepIdx === 0 || rem <= 52) && seg.len >= 132 && rem >= 38 && lotHash01(lSeed, 1) < 0.62) {
      const w = Math.min(randInt(lSeed, 2, 36, 46), Math.floor(rem));
      const d = randInt(lSeed, 3, 30, 38);
      lots.push(makeSegLot(sCursor + w * 0.5, w, d, 0.4, {
        lotClass: 'corner_anchor', blindSides: 'none', minGap: 3.6, adjacentToHistoric: prevHist,
        fallbackW: 28, fallbackD: 24, seed: lSeed
      }));
      sCursor += w + 5.0;
      prevHist = false;
    } else if (!prevHist && rem >= 34 && lotHash01(lSeed, 4) < 0.46) {
      const w1 = randInt(lSeed, 5, 14, 21);
      const w2 = randInt(lSeed, 6, 14, 20);
      const count = w1 + 2.1 + w2 <= rem ? 2 : 1;
      for (let r = 0; r < count; r++) {
        const nw = r === 0 ? w1 : w2;
        const nd = randInt(lSeed + r * 9, 7, 18, 28);
        lots.push(makeSegLot(sCursor + nw * 0.5, nw, nd, 0.3, {
          lotClass: 'narrow_historic', blindSides: resolveRowBlindSides(r, count, plusRight), minGap: 1.6,
          adjacentToHistoric: true, fallbackW: Math.max(13, nw - 2), fallbackD: Math.max(17, nd - 2), seed: lSeed + r * 13
        }));
        sCursor += nw + (r < count - 1 ? 2.1 : 4.8);
      }
      prevHist = true;
    } else {
      const w = Math.min(randInt(lSeed, 8, 26, 38), Math.floor(rem));
      if (w < 14) break;
      const d = randInt(lSeed, 9, 22, 34);
      const sb = Math.round((0.5 + lotHash01(lSeed, 10) * 1.8) * 10) / 10;
      lots.push(makeSegLot(sCursor + w * 0.5, w, d, sb, {
        lotClass: w <= 22 ? 'narrow_historic' : 'medium_corporate', blindSides: 'none', minGap: 3.6,
        adjacentToHistoric: prevHist, fallbackW: 24, fallbackD: 20, seed: lSeed
      }));
      sCursor += w + 5.4;
      prevHist = w <= 22;
    }
    stepIdx++;
  }
  return lots;
}

/**
 * Gera sub-lotes internos de pátio / miolo de quadra com recuo generoso (`>= 8.5 m` de viela/respiro traseiro).
 */
export function generateCourtyardBackLots(blockInnerBounds, localSegments = [], seed = 1) {
  const lots = [];
  for (let gx = blockInnerBounds.minX + 52; gx <= blockInnerBounds.maxX - 52; gx += 58) {
    for (let gz = blockInnerBounds.minZ + 52; gz <= blockInnerBounds.maxZ - 52; gz += 58) {
      const iSeed = seed * 71 + Math.round(gx * 3 + gz * 5);
      const cx = Math.round((gx + (lotHash01(iSeed, 1) - 0.5) * 8) * 100) / 100;
      const cz = Math.round((gz + (lotHash01(iSeed, 2) - 0.5) * 8) * 100) / 100;
      let rotY = 0;
      let bestDistSq = 90 * 90;
      for (let i = 0; i < localSegments.length; i++) {
        const s = localSegments[i];
        const dSq = (cx - (s.x1 + s.x2) * 0.5) ** 2 + (cz - (s.z1 + s.z2) * 0.5) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          rotY = Math.atan2(s.x2 - s.x1, s.z2 - s.z1) + Math.PI * 0.5;
        }
      }
      lots.push({
        cx, cz, w: randInt(iSeed, 3, 22, 38), d: randInt(iSeed, 4, 20, 34), rotY,
        lotClass: 'courtyard_back', blindSides: 'none', minGap: 8.5, adjacentToHistoric: false, seed: iSeed
      });
    }
  }
  return lots;
}

/**
 * Classifica o arquétipo arquitetônico, altura final e estilo contextual de uma parcela urbana.
 */
export function classifyDowntownArchitecturalArchetype(parcel, skyEnvelopeH, opts = {}) {
  const isNorthTransition = Boolean(opts.isNorthTransition);
  const seed = Number(parcel.seed ?? opts.seed ?? 1);
  const r0 = lotHash01(seed, 31);
  const r1 = lotHash01(seed, 37);
  const sIdx = Math.floor(r1 * 997);

  if (parcel.lotClass === 'narrow_historic' || parcel.w <= 22) {
    if (isNorthTransition || r0 < 0.74) {
      const floors = 3 + Math.floor(lotHash01(seed, 41) * 4);
      const h = Math.round((floors * 3.85 + 3.2 + lotHash01(seed, 43) * 1.4) * 10) / 10;
      return {
        archetype: 'historic_lowrise',
        height: Math.min(27.6, Math.max(15.2, h)),
        styleKey: HISTORIC_STYLES[sIdx % HISTORIC_STYLES.length],
        blindSides: parcel.blindSides || 'both'
      };
    }
    return {
      archetype: 'blind_party_wall',
      height: Math.round(Math.min(92, Math.max(44, skyEnvelopeH * (0.52 + r0 * 0.24))) * 10) / 10,
      styleKey: HISTORIC_STYLES[(sIdx + 1) % HISTORIC_STYLES.length],
      blindSides: parcel.blindSides && parcel.blindSides !== 'none' ? parcel.blindSides : 'both'
    };
  }

  if (isNorthTransition) {
    return r0 < 0.28
      ? {
          archetype: 'historic_lowrise',
          height: Math.round((18 + r1 * 9.2) * 10) / 10,
          styleKey: HISTORIC_STYLES[sIdx % HISTORIC_STYLES.length],
          blindSides: 'none'
        }
      : {
          archetype: 'stepped_art_deco',
          height: Math.round(Math.min(56, Math.max(30, skyEnvelopeH)) * 10) / 10,
          styleKey: TRANSITION_MID_STYLES[sIdx % TRANSITION_MID_STYLES.length],
          blindSides: 'none'
        };
  }

  if (parcel.lotClass === 'corner_anchor') {
    const height = Math.round(Math.min(218, Math.max(88, skyEnvelopeH * (1.06 + lotHash01(seed, 47) * 0.12))) * 10) / 10;
    return {
      archetype: height >= 95 && parcel.w >= 26 && parcel.d >= 24 ? 'podium_tower' : 'stepped_art_deco',
      height,
      styleKey: LANDMARK_TOWER_STYLES[sIdx % LANDMARK_TOWER_STYLES.length],
      blindSides: 'none'
    };
  }

  if (parcel.lotClass === 'courtyard_back') {
    if (r0 < 0.24) {
      return {
        archetype: 'historic_lowrise',
        height: Math.round((18.5 + r1 * 8.5) * 10) / 10,
        styleKey: HISTORIC_STYLES[sIdx % HISTORIC_STYLES.length],
        blindSides: 'none'
      };
    }
    const backH = Math.round(Math.min(186, Math.max(54, skyEnvelopeH * (0.82 + r0 * 0.2))) * 10) / 10;
    return {
      archetype: backH >= 115 && parcel.w >= 28 && parcel.d >= 26 && r1 > 0.5 ? 'podium_tower' : 'stepped_art_deco',
      height: backH,
      styleKey: opts.fallbackStyleKey || LANDMARK_TOWER_STYLES[sIdx % LANDMARK_TOWER_STYLES.length],
      blindSides: 'none'
    };
  }

  const surge = parcel.adjacentToHistoric ? 1.08 + r0 * 0.14 : 0.88 + r0 * 0.24;
  const corpH = Math.round(Math.min(214, Math.max(66, skyEnvelopeH * surge)) * 10) / 10;
  return {
    archetype: corpH >= 108 && parcel.w >= 26 && parcel.d >= 24 && r0 > 0.42 ? 'podium_tower' : 'stepped_art_deco',
    height: corpH,
    styleKey: opts.fallbackStyleKey || LANDMARK_TOWER_STYLES[sIdx % LANDMARK_TOWER_STYLES.length],
    blindSides: 'none'
  };
}
