import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../../BuildingGenerator.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../../core/WorldLayoutScale.js';
import {
  UMBRELLA_KEYS,
  SANTOS_CANALS_X,
  CANAL_WIDTH,
  isInsideSantosCanal,
  getSouthBeachBayOffsetZ,
  getSouthBeachBoardwalkBoundsZ,
  getSouthBeachShorelineZ,
  addCurvedLegoPalmTree,
  addNeonHotelSign
} from './BeachBatcherAndConstants.js';

const BEACH_STRETCHES_X = Object.freeze([
  [ws(-1825), SANTOS_CANALS_X[0] - CANAL_WIDTH * 0.5],
  [SANTOS_CANALS_X[0] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[1] - CANAL_WIDTH * 0.5],
  [SANTOS_CANALS_X[1] + CANAL_WIDTH * 0.5, SANTOS_CANALS_X[2] - CANAL_WIDTH * 0.5],
  [SANTOS_CANALS_X[2] + CANAL_WIDTH * 0.5, ws(538)]
]);

function detHash01(seed) {
  let h = Math.imul(seed | 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

/**
 * 2. OS 3 CANAIS ESTILO SANTOS (Canal 1, Canal 2 e Canal 3):
 * Descem da Avenida Beira-Mar, cortam o Calçadão e dividem a Areia da Praia até desaguar no Oceano (largura 1x)!
 */
export function buildSantosStyleBeachCanals(world, batcher) {
  SANTOS_CANALS_X.forEach((cx, idx) => {
    const canalNum = idx + 1;
    const canalZStart = ws(724);
    const canalZEnd = ws(1066);
    const canalLen = canalZEnd - canalZStart;
    const canalCenterZ = (canalZStart + canalZEnd) * 0.5;
    const bwBounds = getSouthBeachBoardwalkBoundsZ(cx);

    batcher.addBox('canal_water', CANAL_WIDTH - 2.4, 0.35, canalLen, cx, -0.18, canalCenterZ, false);
    world.mapWater.push({ x: cx, z: canalCenterZ, w: CANAL_WIDTH, d: canalLen });

    const leftWallX = cx - CANAL_WIDTH * 0.5;
    const rightWallX = cx + CANAL_WIDTH * 0.5;
    const footbridgeZ = ws(910);
    const bridgeZStart = IS_SCALED_WORLD ? ws(724) : 726;
    const bridgeZEnd = bwBounds.bwZEnd;
    const bridgeDepth = bridgeZEnd - bridgeZStart;
    const bridgeCenterZ = (bridgeZStart + bridgeZEnd) * 0.5;
    const bikeZ = bwBounds.bikeZ;

    const p1Start = IS_SCALED_WORLD ? bridgeZEnd + 1.5 : 727.5;
    const p1End = IS_SCALED_WORLD ? footbridgeZ - 8.5 : 892.5;
    const p1Len = p1End - p1Start;
    const p1CenterZ = (p1Start + p1End) * 0.5;

    const p2Start = IS_SCALED_WORLD ? footbridgeZ + 8.5 : 925;
    const p2End = ws(1045);
    const p2Len = p2End - p2Start;
    const p2CenterZ = (p2Start + p2End) * 0.5;

    for (const wx of [leftWallX, rightWallX]) {
      batcher.addBox('stone_grey', 1.8, 1.4, canalLen, wx, 0.1, canalCenterZ, false);
      batcher.addBox('trim_white', 0.85, 0.85, p1Len, wx, 0.95, p1CenterZ, true);
      batcher.addBox('umb_blue', 0.9, 0.22, p1Len, wx, 1.38, p1CenterZ, true);
      batcher.addBox('trim_white', 0.85, 0.85, p2Len, wx, 0.95, p2CenterZ, true);
      batcher.addBox('umb_blue', 0.9, 0.22, p2Len, wx, 1.38, p2CenterZ, true);
    }

    batcher.addBox('stone_white', CANAL_WIDTH + 4, 0.48, bridgeDepth, cx, 0.24, bridgeCenterZ, false);
    batcher.addBox('bike_red', CANAL_WIDTH + 4, 0.06, 4.8, cx, 0.51, bikeZ, false);
    batcher.addBox('trim_white', CANAL_WIDTH + 4, 1.1, 0.6, cx, 0.8, bridgeZStart + 0.5, true);
    batcher.addBox('trim_white', CANAL_WIDTH + 4, 1.1, 0.6, cx, 0.8, bridgeZEnd - 0.5, true);

    batcher.addBox('wood_deck', CANAL_WIDTH + 6, 0.55, 14, cx, 0.45, footbridgeZ, false);
    batcher.addBox('trim_white', CANAL_WIDTH + 6, 1.0, 0.45, cx, 1.1, footbridgeZ - 6.8, true);
    batcher.addBox('trim_white', CANAL_WIDTH + 6, 1.0, 0.45, cx, 1.1, footbridgeZ + 6.8, true);

    const jettyZ = IS_SCALED_WORLD ? ws(1055) : 1058;
    const jettyLen = IS_SCALED_WORLD ? 54 : 32;
    const foamZ = IS_SCALED_WORLD ? ws(1066) : 1068;
    batcher.addBox('stone_black', 3.4, 1.5, jettyLen, leftWallX, 0.25, jettyZ, false);
    batcher.addBox('stone_black', 3.4, 1.5, jettyLen, rightWallX, 0.25, jettyZ, false);
    batcher.addBox('surf_foam', CANAL_WIDTH + 8, 0.14, 8, cx, 0.04, foamZ, false);

    addNeonHotelSign(world, cx, 3.6, bwBounds.bwZStart + 1, 14, `CANAL ${canalNum}`, '#38bdf8', '#ffffff');
    world.santosCanals.push({ canalNum, x: cx, width: CANAL_WIDTH, zStart: canalZStart, zEnd: canalZEnd });
  });
}

function buildBeachShowerAndPergola(batcher, px, yBase, pz, seed) {
  for (const [dx, dz] of [[-4.2, -2.6], [4.2, -2.6], [-4.2, 2.6], [4.2, 2.6]]) {
    batcher.addBox('wood_pier', 0.36, 3.3, 0.36, px + dx, yBase + 1.65, pz + dz, true);
  }
  batcher.addBox('wood_pier', 9.2, 0.28, 0.32, px, yBase + 3.25, pz - 2.6, true);
  batcher.addBox('wood_pier', 9.2, 0.28, 0.32, px, yBase + 3.25, pz + 2.6, true);
  for (let sx = -4.0; sx <= 4.0; sx += 1.33) {
    batcher.addBox('wood_deck', 0.26, 0.18, 6.0, px + sx, yBase + 3.46, pz, true);
  }
  batcher.addBox('wood_deck', 3.6, 0.5, 1.1, px - 1.6, yBase + 0.42, pz, true);

  const shX = px + (seed % 2 === 0 ? 6.4 : -6.4);
  batcher.addBox('stone_grey', 2.4, 0.08, 2.4, shX, yBase + 0.04, pz + 1.2, true);
  batcher.addBox('trim_white', 0.24, 2.9, 0.24, shX, yBase + 1.45, pz + 0.4, true);
  batcher.addBox('trim_white', 0.22, 0.18, 0.95, shX, yBase + 2.85, pz + 0.85, true);
  batcher.addBox('glass_cyan', 0.48, 0.14, 0.48, shX, yBase + 2.74, pz + 1.22, true);
}

/**
 * 3. CALÇADÃO CURVO EM ONDAS DE PEDRAS PORTUGUESAS, CICLOVIA VERMELHA, MURETA & COQUEIROS
 */
export function buildOceanfrontBoardwalk(world, batcher) {
  const aveSouthCurbZ = ws(710) + ROAD.mainWidth * 0.5;
  const targetSegStep = IS_SCALED_WORLD ? 54 : 24;
  const kioskExclusionX = [-1580, -1320, -1060, -760, -605, -460, -250, 135, 315, 420].map(ws);

  let minOffsetZ = Infinity, maxOffsetZ = -Infinity;
  let waveStoneSegments = 0, bikeLaneSegments = 0, seawallSegments = 0, showerCount = 0;

  for (const [xStart, xEnd] of BEACH_STRETCHES_X) {
    const span = xEnd - xStart;
    const numSegs = Math.max(2, Math.round(span / targetSegStep));
    const stepX = span / numSegs;

    for (let s = 0; s < numSegs; s++) {
      const sx0 = xStart + s * stepX, sx1 = sx0 + stepX, sxMid = (sx0 + sx1) * 0.5;
      const b0 = getSouthBeachBoardwalkBoundsZ(sx0);
      const b1 = getSouthBeachBoardwalkBoundsZ(sx1);
      const bMid = getSouthBeachBoardwalkBoundsZ(sxMid);

      minOffsetZ = Math.min(minOffsetZ, b0.zOff, b1.zOff);
      maxOffsetZ = Math.max(maxOffsetZ, b0.zOff, b1.zOff);

      if (IS_SCALED_WORLD && Math.min(b0.bwZStart, b1.bwZStart) > aveSouthCurbZ + 0.4) {
        batcher.addShearedBox('stone_grey', sx0, sx1, ROAD.curbHeight, ROAD.curbHeight * 0.5, aveSouthCurbZ, b0.bwZStart, aveSouthCurbZ, b1.bwZStart, false);
      }

      batcher.addShearedBox('boardwalk_cream', sx0, sx1, 0.32, 0.16, b0.bwZStart, b0.bwZEnd, b1.bwZStart, b1.bwZEnd, false);
      world.mapBlocks.push({ x: sxMid, z: bMid.bwCenterZ, w: stepX + 0.4, d: bMid.bwDepth, color: '#e2e8f0' });

      batcher.addShearedBox('bike_red', sx0, sx1, 0.05, 0.365, b0.bikeZ - 2.4, b0.bikeZ + 2.4, b1.bikeZ - 2.4, b1.bikeZ + 2.4, false);
      for (const edgeOff of [-2.48, 2.48]) {
        batcher.addShearedBox('trim_white', sx0, sx1, 0.06, 0.375, b0.bikeZ + edgeOff - 0.14, b0.bikeZ + edgeOff + 0.14, b1.bikeZ + edgeOff - 0.14, b1.bikeZ + edgeOff + 0.14, true);
      }
      batcher.addBox('trim_white', stepX * 0.42, 0.055, 0.18, sxMid, 0.378, bMid.bikeZ, true);
      bikeLaneSegments++;

      const nearPier = Math.abs(sxMid) < 54;
      const nearKiosk = kioskExclusionX.some((kx) => Math.abs(sxMid - kx) < 18);
      if (!nearPier && !nearKiosk && s % 3 !== 1) {
        batcher.addShearedBox('trim_white', sx0 + 1.0, sx1 - 1.0, 0.58, 0.61, b0.bwZEnd - 0.95, b0.bwZEnd - 0.15, b1.bwZEnd - 0.95, b1.bwZEnd - 0.15, true);
        batcher.addShearedBox('stone_grey', sx0 + 0.8, sx1 - 0.8, 0.14, 0.96, b0.bwZEnd - 1.05, b0.bwZEnd - 0.05, b1.bwZEnd - 1.05, b1.bwZEnd - 0.05, true);
        seawallSegments++;
      }
    }

    const waveStep = IS_SCALED_WORLD ? 15 : 8;
    const waveStepsCount = Math.max(4, Math.round((xEnd - xStart - 8) / waveStep));
    const wDx = (xEnd - xStart - 8) / waveStepsCount;
    const waveFreq = IS_SCALED_WORLD ? 0.036 : 0.075;
    const waveAmp = IS_SCALED_WORLD ? 6.8 : 2.8;
    const bandRatios = IS_SCALED_WORLD ? [0.24, 0.44, 0.64, 0.83] : [0.36, 0.72];

    for (let wi = 0; wi < waveStepsCount; wi++) {
      const wx0 = xStart + 4 + wi * wDx, wx1 = wx0 + wDx;
      const wb0 = getSouthBeachBoardwalkBoundsZ(wx0), wb1 = getSouthBeachBoardwalkBoundsZ(wx1);
      const zone0Min = wb0.bikeZ + 5.5, zone0Span = Math.max(12, wb0.bwZEnd - 5.0 - zone0Min);
      const zone1Min = wb1.bikeZ + 5.5, zone1Span = Math.max(12, wb1.bwZEnd - 5.0 - zone1Min);
      const s0 = Math.sin(wx0 * waveFreq) * waveAmp, s1 = Math.sin(wx1 * waveFreq) * waveAmp;
      const halfBand = IS_SCALED_WORLD ? 1.65 : 1.05;

      for (let bi = 0; bi < bandRatios.length; bi++) {
        const r = bandRatios[bi], sign = bi % 2 === 0 ? 1 : -1;
        const z0 = zone0Min + zone0Span * r + s0 * sign * 0.85;
        const z1 = zone1Min + zone1Span * r + s1 * sign * 0.85;
        batcher.addShearedBox('stone_black', wx0, wx1, 0.04, 0.342, z0 - halfBand, z0 + halfBand, z1 - halfBand, z1 + halfBand, true);
        const crestOff = sign * (halfBand + 1.15);
        batcher.addShearedBox('trim_white', wx0, wx1, 0.036, 0.34, z0 + crestOff - 0.85, z0 + crestOff + 0.85, z1 + crestOff - 0.85, z1 + crestOff + 0.85, true);
        waveStoneSegments++;
      }
    }
  }

  const palmStep = IS_SCALED_WORLD ? 92 : 36;
  let idxCounter = 0;
  for (let px = ws(-1780); px <= ws(516); px += palmStep) {
    if (Math.abs(px) < 54 || isInsideSantosCanal(px, 14)) continue;
    idxCounter++;
    const bNorth = getSouthBeachBoardwalkBoundsZ(px);
    const bSouth = getSouthBeachBoardwalkBoundsZ(px + 14);
    const palmNorthZ = bNorth.bikeZ + (IS_SCALED_WORLD ? 11.5 : 7.0);
    const palmSouthZ = bSouth.bwZEnd - (IS_SCALED_WORLD ? 9.0 : 5.5);
    const benchZ = bNorth.bwZEnd - 3.6;

    const leanX = ((idxCounter % 3) - 1) * 0.22;
    addCurvedLegoPalmTree(batcher, px, 0.32, palmNorthZ, leanX, 0.82, 1.12);
    if (!kioskExclusionX.some((kx) => Math.abs(px + 14 - kx) < 16)) {
      addCurvedLegoPalmTree(batcher, px + 14, 0.32, palmSouthZ, -leanX * 0.9, 0.88, 1.16);
    }
    if (!kioskExclusionX.some((kx) => Math.abs(px + 7 - kx) < 16)) {
      batcher.addBox('trim_white', 3.4, 0.55, 0.9, px + 7, 0.58, benchZ, true);
      batcher.addBox('wood_deck', 3.4, 0.55, 0.22, px + 7, 0.95, benchZ - 0.4, true);
    }
    if (idxCounter % 3 === 0 && !kioskExclusionX.some((kx) => Math.abs(px - 22 - kx) < 22) && !isInsideSantosCanal(px - 22, 18)) {
      const bPerg = getSouthBeachBoardwalkBoundsZ(px - 22);
      buildBeachShowerAndPergola(batcher, px - 22, 0.32, bPerg.bwZEnd - 7.2, idxCounter);
      showerCount++;
    }
  }

  world.southBeachPromenadeData = {
    minOffsetZ, maxOffsetZ, offsetSpanZ: maxOffsetZ - minOffsetZ,
    waveStoneSegments, bikeLaneSegments, seawallSegments, showerCount
  };
}

/**
 * 4. FAIXA CURVA DE AREIA DOURADA, AREIA ÚMIDA, ESPUMA DAS ONDAS & VIDA COSTEIRA ORGÂNICA
 */
export function buildGoldenBeachAndShorelineLife(world, batcher) {
  const sandStep = IS_SCALED_WORLD ? 60 : 28;
  const wetSandD = IS_SCALED_WORLD ? 44 : 18;
  const waterOuterZ = ws(1058);

  for (const [xStart, xEnd] of BEACH_STRETCHES_X) {
    const span = xEnd - xStart;
    const numSegs = Math.max(2, Math.round(span / sandStep));
    const stepX = span / numSegs;

    for (let s = 0; s < numSegs; s++) {
      const sx0 = xStart + s * stepX, sx1 = sx0 + stepX, sxMid = (sx0 + sx1) * 0.5;
      const b0 = getSouthBeachBoardwalkBoundsZ(sx0), b1 = getSouthBeachBoardwalkBoundsZ(sx1), bMid = getSouthBeachBoardwalkBoundsZ(sxMid);
      const sh0 = getSouthBeachShorelineZ(sx0), sh1 = getSouthBeachShorelineZ(sx1), shMid = getSouthBeachShorelineZ(sxMid);

      batcher.addShearedBox('sand_dry', sx0, sx1, 0.28, -0.02, b0.bwZEnd, sh0, b1.bwZEnd, sh1, false);
      world.mapBlocks.push({ x: sxMid, z: (bMid.bwZEnd + shMid) * 0.5, w: stepX + 0.4, d: shMid - bMid.bwZEnd, color: '#b89f72' });

      batcher.addShearedBox('sand_wet', sx0, sx1, 0.24, -0.06, sh0 - 5, sh0 + wetSandD, sh1 - 5, sh1 + wetSandD, false);
      batcher.addShearedBox('surf_foam', sx0, sx1, 0.05, 0.065, sh0 + wetSandD - 5.5, sh0 + wetSandD - 0.8, sh1 + wetSandD - 5.5, sh1 + wetSandD - 0.8, false);
      batcher.addShearedBox('surf_foam', sx0, sx1, 0.04, 0.055, sh0 + wetSandD + 5.5, sh0 + wetSandD + 8.2, sh1 + wetSandD + 5.5, sh1 + wetSandD + 8.2, true);

      if (Math.min(sh0, sh1) + wetSandD < waterOuterZ - 2) {
        batcher.addShearedBox('canal_water', sx0, sx1, 0.22, -0.07, Math.min(waterOuterZ - 1, sh0 + wetSandD - 1), waterOuterZ, Math.min(waterOuterZ - 1, sh1 + wetSandD - 1), waterOuterZ, false);
      }
    }
  }

  const sandY = 0.12;
  const volleySpecs = [[-460, 858], [-210, 874], [165, 860], [340, 872]].map(([dx, dz]) => ({ x: ws(dx), z: ws(dz) + getSouthBeachBayOffsetZ(ws(dx)) }));
  const lifeguardSpecs = [[-250, 905], [185, 905]].map(([dx, dz]) => ({ x: ws(dx), z: ws(dz) + getSouthBeachBayOffsetZ(ws(dx)) }));

  const arcBandsDesignZ = [814, 868, 932, 988];
  let clusterSeed = 17;
  for (let bIdx = 0; bIdx < arcBandsDesignZ.length; bIdx++) {
    const baseZ = ws(arcBandsDesignZ[bIdx]);
    let cx = ws(-1610) + bIdx * 23;
    while (cx <= ws(512)) {
      const step = IS_SCALED_WORLD ? (Math.abs(cx) <= 520 ? 78 : 148) + Math.floor(detHash01(clusterSeed) * 26) : 52;
      const hubX = cx;
      cx += step;
      clusterSeed += 13;

      if (Math.abs(hubX) < 58 || isInsideSantosCanal(hubX, 20)) continue;
      if (hubX >= ws(-1560) && hubX <= ws(-1060) && baseZ >= ws(830) && baseZ <= ws(975)) continue;

      const bayZ = baseZ + getSouthBeachBayOffsetZ(hubX) + Math.sin(hubX * 0.014 + bIdx) * 11.0;
      if (volleySpecs.some((v) => Math.hypot(hubX - v.x, bayZ - v.z) < 28)) continue;
      if (lifeguardSpecs.some((l) => Math.hypot(hubX - l.x, bayZ - l.z) < 22)) continue;

      const subCount = IS_SCALED_WORLD ? (detHash01(clusterSeed + 3) > 0.45 ? 3 : 2) : 1;
      for (let m = 0; m < subCount; m++) {
        const ang = detHash01(clusterSeed + m * 7) * Math.PI * 2;
        const rad = m === 0 ? 0 : 6.2 + detHash01(clusterSeed + m * 11) * 4.5;
        const ux = hubX + Math.cos(ang) * rad, uz = bayZ + Math.sin(ang) * rad * 0.82;
        if (isInsideSantosCanal(ux, 15)) continue;

        const localSandY = Math.max(sandY, world.getTerrainHeightAt ? world.getTerrainHeightAt(ux, uz) : sandY);
        const uColor = UMBRELLA_KEYS[(clusterSeed + m * 3) % UMBRELLA_KEYS.length];
        const towelColor = UMBRELLA_KEYS[(clusterSeed + m * 5 + 2) % UMBRELLA_KEYS.length];

        batcher.addBox('trim_white', 0.22, 3.1, 0.22, ux, localSandY + 1.55, uz, true);
        batcher.addBox(uColor, 4.3, 0.42, 4.3, ux, localSandY + 3.1, uz, true);
        batcher.addBox('trim_white', 2.7, 0.38, 2.7, ux, localSandY + 3.45, uz, true);
        batcher.addBox(uColor, 1.15, 0.32, 1.15, ux, localSandY + 3.75, uz, true);
        batcher.addBox('trim_white', 1.25, 0.32, 2.4, ux - 1.7, localSandY + 0.16, uz + 0.4, true);
        batcher.addBox('trim_white', 1.25, 0.55, 0.5, ux - 1.7, localSandY + 0.38, uz - 0.6, true);
        batcher.addBox(towelColor, 1.4, 0.06, 2.5, ux + 1.7, localSandY + 0.03, uz + 0.5, true);
      }
    }
  }

  for (const lg of lifeguardSpecs) {
    buildLifeguardTower(world, batcher, lg.x, Math.max(sandY, world.getTerrainHeightAt ? world.getTerrainHeightAt(lg.x, lg.z) : sandY), lg.z);
  }
  for (const vc of volleySpecs) {
    buildBeachVolleyballCourt(batcher, vc.x, Math.max(sandY, world.getTerrainHeightAt ? world.getTerrainHeightAt(vc.x, vc.z) : sandY), vc.z);
  }

  const castlePositions = [
    [-440, 955], [-310, 995], [-275, 945], [-210, 1005],
    [-85, 935], [-68, 990], [-58, 845], [-175, 975],
    [62, 975], [75, 845], [95, 990], [145, 935],
    [195, 1005], [305, 945], [355, 995], [420, 955]
  ];
  for (const [dcx, dcz] of castlePositions) {
    const cx = ws(dcx), cz = ws(dcz) + getSouthBeachBayOffsetZ(cx);
    spawnBreakableSandcastle(world, cx, Math.max(sandY, world.getTerrainHeightAt ? world.getTerrainHeightAt(cx, cz) : sandY), cz);
  }
}

function buildLifeguardTower(world, batcher, x, yBase, z) {
  for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) {
    batcher.addBox('wood_pier', 0.48, 3.6, 0.48, x + dx, yBase + 1.8, z + dz, false);
  }
  batcher.addBox('wood_pier', 5.2, 0.28, 0.28, x, yBase + 1.8, z - 2.4, true);
  batcher.addBox('wood_pier', 5.2, 0.28, 0.28, x, yBase + 1.8, z + 2.4, true);

  const deckY = yBase + 3.6;
  batcher.addBox('wood_deck', 7.4, 0.35, 7.4, x, deckY + 0.18, z, false);
  batcher.addBox('trim_white', 7.4, 0.95, 0.22, x, deckY + 0.8, z + 3.6, true);
  batcher.addBox('trim_white', 0.22, 0.95, 7.4, x - 3.6, deckY + 0.8, z, true);
  batcher.addBox('trim_white', 0.22, 0.95, 7.4, x + 3.6, deckY + 0.8, z, true);

  batcher.addBox('trim_white', 4.8, 3.4, 4.8, x, deckY + 2.05, z - 0.4, false);
  batcher.addBox('umb_red', 5.0, 0.65, 5.0, x, deckY + 1.0, z - 0.4, false);
  batcher.addBox('glass_cyan', 3.8, 1.3, 5.0, x, deckY + 2.4, z - 0.4, false);
  batcher.addBox('umb_red', 6.2, 0.55, 6.2, x, deckY + 4.0, z - 0.4, false);
  batcher.addBox('umb_red', 4.2, 0.55, 4.2, x, deckY + 4.55, z - 0.4, true);

  const ladderZ = z - 4.2;
  batcher.addBox('wood_deck', 0.22, 4.0, 0.22, x - 0.65, yBase + 2.0, ladderZ, true);
  batcher.addBox('wood_deck', 0.22, 4.0, 0.22, x + 0.65, yBase + 2.0, ladderZ, true);
  for (let ry = 0.6; ry <= 3.4; ry += 0.55) {
    batcher.addBox('trim_white', 1.3, 0.14, 0.18, x, yBase + ry, ladderZ, true);
  }
  batcher.addBox('umb_red', 1.1, 1.1, 0.28, x + 1.8, deckY + 0.85, z + 3.78, true);
  batcher.addBox('trim_white', 0.5, 0.5, 0.32, x + 1.8, deckY + 0.85, z + 3.8, true);

  world.addCollider(x, z, 6.4, 6.4, deckY + 4.8, yBase);
  world.mapBuildings.push({ x, z, w: 7.4, d: 7.4, height: 8.5, color: '#ef4444', label: 'SALVA-VIDAS' });
}

function buildBeachVolleyballCourt(batcher, x, yBase, z) {
  const cw = 18.0, cd = 10.0;
  batcher.addBox('umb_blue', cw, 0.06, 0.22, x, yBase + 0.04, z - cd * 0.5, true);
  batcher.addBox('umb_blue', cw, 0.06, 0.22, x, yBase + 0.04, z + cd * 0.5, true);
  batcher.addBox('umb_blue', 0.22, 0.06, cd, x - cw * 0.5, yBase + 0.04, z, true);
  batcher.addBox('umb_blue', 0.22, 0.06, cd, x + cw * 0.5, yBase + 0.04, z, true);
  batcher.addBox('trim_white', 0.24, 2.8, 0.24, x, yBase + 1.4, z - cd * 0.5 - 0.4, true);
  batcher.addBox('trim_white', 0.24, 2.8, 0.24, x, yBase + 1.4, z + cd * 0.5 + 0.4, true);
  batcher.addBox('trim_white', 0.16, 0.22, cd + 0.8, x, yBase + 2.65, z, true);
  batcher.addBox('umb_yellow', 0.14, 0.16, cd + 0.8, x, yBase + 1.55, z, true);
  for (let nz = -cd * 0.5; nz <= cd * 0.5; nz += 0.9) {
    batcher.addBox('stone_black', 0.08, 1.1, 0.08, x, yBase + 2.1, z + nz, true);
  }
}

const SHARED_SANDCASTLE_MAT = markAsSharedAsset(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 }));
const SHARED_SANDCASTLE_GEO = (() => {
  const geo = mergeBufferGeometries([
    makeTranslatedBox(2.4, 0.75, 2.4, 0, 0.38, 0),
    makeTranslatedBox(1.1, 1.55, 1.1, 0, 0.78, 0),
    makeTranslatedBox(0.65, 1.15, 0.65, -1.0, 0.58, -1.0),
    makeTranslatedBox(0.65, 1.15, 0.65, 1.0, 0.58, -1.0),
    makeTranslatedBox(0.65, 1.15, 0.65, -1.0, 0.58, 1.0),
    makeTranslatedBox(0.65, 1.15, 0.65, 1.0, 0.58, 1.0)
  ]);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return markAsSharedAsset(geo);
})();

function spawnBreakableSandcastle(world, x, yBase, z) {
  const mesh = new THREE.Mesh(SHARED_SANDCASTLE_GEO, SHARED_SANDCASTLE_MAT);
  mesh.position.set(x, yBase, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.scene.add(mesh);

  const col = world.addCollider(x, z, 2.5, 2.5, yBase + 1.6, yBase);
  if (world.destructibles) {
    const item = world.destructibles.registerDestructible({
      mesh, type: 'sandcastle', hp: 10, radius: 1.5, height: 1.6, colliders: [col],
      debrisColors: [0xfde047, 0xfacc15, LEGO_COLORS.tan],
      studDrops: { silver: 4, gold: 3, blue: 0, purple: 0 }, groundY: yBase
    });
    world.beachSandcastles.push(item);
  }
}

/**
 * 6A. PONTA DA PRAIA / COSTÃO SUDOESTE — FAROL MARÍTIMO (67m 1x!) & DUNAS DE AREIA COM COQUEIROS
 */
export function buildSouthwestPointLighthouseAndDunes(world, batcher) {
  const lhX = ws(-1735), lhZ = ws(945);
  batcher.addBox('stone_black', 150, 4.2, 160, lhX, 2.1, lhZ, false);
  batcher.addBox('stone_grey', 112, 7.6, 120, lhX, 5.8, lhZ, false);
  batcher.addBox('stone_black', 76, 10.8, 82, lhX, 9.6, lhZ, false);
  world.addCollider(lhX, lhZ, 76, 82, 15.0, 0);
  world.mapBlocks.push({ x: lhX, z: lhZ, w: 150, d: 160, color: '#334155' });

  for (const [rx, rz, rw, rh, rd] of [[-75, 45, 22, 6.5, 20], [-68, -35, 18, 5.2, 18], [68, 50, 24, 6.0, 22], [0, 78, 28, 5.8, 18], [-42, 76, 20, 4.8, 16]]) {
    batcher.addBox('stone_black', rw, rh, rd, lhX + rx, rh * 0.5 - 0.2, lhZ + rz, false);
    batcher.addBox('surf_foam', rw + 5, 0.14, rd + 5, lhX + rx, 0.08, lhZ + rz, true);
  }

  const baseTopY = 15.0;
  for (let s = 0; s < 8; s++) {
    const segW = 16.0 - s * 1.15;
    batcher.addBox(s % 2 === 0 ? 'umb_red' : 'trim_white', segW, 6.0, segW, lhX, baseTopY + s * 6.0 + 3.0, lhZ, false);
  }
  const lanternBaseY = baseTopY + 48.0;
  batcher.addBox('stone_black', 11.2, 1.2, 11.2, lhX, lanternBaseY + 0.6, lhZ, false);
  batcher.addBox('window_warm', 7.8, 5.4, 7.8, lhX, lanternBaseY + 3.9, lhZ, false);
  batcher.addBox('umb_red', 9.8, 2.8, 9.8, lhX, lanternBaseY + 8.0, lhZ, false);
  batcher.addBox('umb_red', 5.2, 2.4, 5.2, lhX, lanternBaseY + 10.6, lhZ, false);
  world.addCollider(lhX, lhZ, 16, 16, lanternBaseY + 12.0, baseTopY);

  batcher.addBox('coastal_white', 22, 7.5, 16, lhX + 22, baseTopY + 3.75, lhZ - 8, false);
  batcher.addBox('umb_red', 24, 1.8, 18, lhX + 22, baseTopY + 8.4, lhZ - 8, false);
  addNeonHotelSign(world, lhX, lanternBaseY + 9.2, lhZ + 5.4, 16, 'FAROL SUDOESTE', '#ef4444', '#ffffff');
  world.mapBuildings.push({ x: lhX, z: lhZ, w: 26, d: 26, height: 67, color: '#ef4444', isLandmark: true, label: 'FAROL COSTÃO OESTE' });

  const duneClusters = [
    { x: ws(-1510), z: ws(875), w: 96, d: 58, h: 4.8 },
    { x: ws(-1395), z: ws(915), w: 112, d: 64, h: 6.2 },
    { x: ws(-1275), z: ws(868), w: 104, d: 56, h: 5.4 },
    { x: ws(-1155), z: ws(908), w: 98, d: 62, h: 4.6 }
  ];
  for (const d of duneClusters) {
    const groundY = Math.max(0, world.getTerrainHeightAt ? world.getTerrainHeightAt(d.x, d.z) : 0);
    batcher.addBox('coastal_sun', d.w, d.h * 0.45, d.d, d.x, groundY + d.h * 0.22, d.z, false);
    batcher.addBox('sand_wet', d.w * 0.68, d.h * 0.4, d.d * 0.68, d.x, groundY + d.h * 0.62, d.z, false);
    batcher.addBox('coastal_sun', d.w * 0.38, d.h * 0.32, d.d * 0.38, d.x, groundY + d.h * 0.92, d.z, false);
    addCurvedLegoPalmTree(batcher, d.x - d.w * 0.22, groundY + d.h * 0.65, d.z - 6, -0.22, 0.85, 1.15);
    addCurvedLegoPalmTree(batcher, d.x + d.w * 0.22, groundY + d.h * 0.65, d.z + 6, 0.24, 0.82, 1.1);
  }

  world.southwestBeachData = {
    hasSouthwestLighthouse: true,
    lighthousePos: { x: lhX, y: baseTopY, z: lhZ, height: 67 },
    hasSandDunes: true,
    dunesCount: duneClusters.length,
    hasWestMarina: false,
    westMarinaPos: null
  };
}
