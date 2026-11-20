import * as THREE from 'three';
import { buildProfileRibbon, buildGradedProfile, sampleProfile } from '../ViaductGeometry.js';
import { cosineStep01, getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import {
  createReliefAndViaductBatcher,
  buildNaturalReliefMeshes
} from './NaturalReliefMeshesBuilder.js';
import {
  AVENUE_WIDTH,
  CENTRAL_RAMP_HALF_W,
  addOverheadHighwayGantry,
  addContinuousDeck,
  addViaductSupports
} from './ViaductDeckAndSupports.js';

export function buildSegmentedExpressViaduct(world, batcher, cfg) {
  const {
    id,
    axis,
    fixedCoord,
    startC,
    endC,
    rampStartLen,
    rampEndLen,
    clearanceTarget = 12.4,
    startGroundY = 0,
    endGroundY = 0,
    deckWidth = 16.0,
    gantries = []
  } = cfg;

  const sampleGroundAlong = (c) => {
    const gx = axis === 'z_const' ? c : fixedCoord;
    const gz = axis === 'z_const' ? fixedCoord : c;
    return world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(gx, gz)) : 0;
  };

  // Envelope suavizado do solo local para que o tabuleiro mantenha SEMPRE +11.8m..+13.2m de vão livre acima da rua abaixo!
  const sampleSmoothedGround = (c) => {
    const g0 = sampleGroundAlong(c);
    const gL = sampleGroundAlong(Math.max(startC, c - 18));
    const gR = sampleGroundAlong(Math.min(endC, c + 18));
    return Math.max(g0, (gL + g0 * 2 + gR) * 0.25);
  };

  const flatStart = startC + rampStartLen;
  const flatEnd = endC - rampEndLen;
  // Trecho elevado com perfil "de projeto": rampas retas (até 5%) e concordâncias suaves, sempre com o vão livre
  // exigido sobre a rua — sem copiar cada ondulação do relevo (antes o tabuleiro ficava torto no meio).
  const middleProfile = buildGradedProfile((c) => sampleSmoothedGround(c) + clearanceTarget, flatStart, flatEnd, {
    maxGrade: 0.05,
    smoothHalf: 24
  });
  const flatStartDeckY = middleProfile(flatStart);
  const flatEndDeckY = middleProfile(flatEnd);

  const getHeightAlong = (c) => {
    if (c < startC || c > endC) return null;
    if (c < flatStart) {
      const t = cosineStep01((c - startC) / Math.max(1, rampStartLen));
      return THREE.MathUtils.lerp(startGroundY, flatStartDeckY, t);
    }
    if (c > flatEnd) {
      const t = cosineStep01((endC - c) / Math.max(1, rampEndLen));
      return THREE.MathUtils.lerp(endGroundY, flatEndDeckY, t);
    }
    return middleProfile(c);
  };

  const halfW = deckWidth * 0.5;
  const deckEntry =
    axis === 'z_const'
      ? {
          id,
          minX: startC,
          maxX: endC,
          minZ: fixedCoord - halfW,
          maxZ: fixedCoord + halfW,
          thresholdBelow: 2.5,
          getDeckY: (x) => getHeightAlong(x),
          getTopY: (x) => getHeightAlong(x)
        }
      : {
          id,
          minX: fixedCoord - halfW,
          maxX: fixedCoord + halfW,
          minZ: startC,
          maxZ: endC,
          thresholdBelow: 2.5,
          getDeckY: (_x, z) => getHeightAlong(z),
          getTopY: (_x, z) => getHeightAlong(z)
        };
  world.elevatedDecks.push(deckEntry);

  if (axis === 'z_const') {
    world.mapBlocks.push({
      x: (startC + endC) * 0.5,
      z: fixedCoord,
      w: endC - startC,
      d: deckWidth,
      color: '#475569',
      isViaductDeck: true
    });
  } else {
    world.mapBlocks.push({
      x: fixedCoord,
      z: (startC + endC) * 0.5,
      w: deckWidth,
      d: endC - startC,
      color: '#475569',
      isViaductDeck: true
    });
  }

  const step = 6.0;
  const totalLen = endC - startC;
  const numSteps = Math.round(totalLen / step);
  const realStep = totalLen / numSteps;
  const deckThickness = 0.95;
  const railW = 0.68;
  const railH = 1.15;

  for (let i = 0; i < numSteps; i++) {
    const c0 = startC + i * realStep;
    const c1 = c0 + realStep;
    const cm = (c0 + c1) * 0.5;
    const y0 = getHeightAlong(c0);
    const y1 = getHeightAlong(c1);
    const ym = (y0 + y1) * 0.5;

    const cx = axis === 'z_const' ? cm : fixedCoord;
    const cz = axis === 'z_const' ? fixedCoord : cm;
    const localGroundY = sampleGroundAlong(cm);
    const clearanceAboveGround = ym - localGroundY;

    // REGRA CRÍTICA: Aterro fechado APENAS no comecinho da rampa (< 1.35m, primeiros ~10-12m)!
    // Todo o restante da rampa (1.35m até 12.8m+) é 100% VAZADO E SUSPENSO sobre colunas!
    const isLowEmbankment = clearanceAboveGround < 1.35;

    for (const side of [-1, 1]) {
      if (id === 'viaduct_ew_north' && side === 1 && cm > -CENTRAL_RAMP_HALF_W && cm < CENTRAL_RAMP_HALF_W) {
        continue;
      }

      const edgeOff = side * (halfW - railW * 0.5);
      const rx = axis === 'z_const' ? cx : cx + edgeOff;
      const rz = axis === 'z_const' ? cz + edgeOff : cz;

      batcher.studPositionsYellow.push([rx, ym + railH + 0.06, rz]);

      if (isLowEmbankment) {
        const embH = Math.max(0.5, ym - localGroundY + 1.0);
        batcher.addBox(
          'viaduct_dark_concrete',
          axis === 'z_const' ? realStep + 0.1 : railW + 0.2,
          embH,
          axis === 'z_const' ? railW + 0.2 : realStep + 0.1,
          rx,
          ym - embH * 0.5,
          rz
        );
        world.addCollider(
          rx,
          rz,
          axis === 'z_const' ? realStep : railW + 0.2,
          axis === 'z_const' ? railW + 0.2 : realStep,
          ym + 1.45,
          localGroundY - 0.5
        );
      } else {
        // Mureta suspensa no alto: NUNCA desce colisor até o chão, deixando passagem 100% livre por baixo!
        const minSegY = Math.min(y0, y1) - deckThickness;
        const maxSegY = Math.max(y0, y1);
        world.addCollider(
          rx,
          rz,
          axis === 'z_const' ? realStep : railW + 0.2,
          axis === 'z_const' ? railW + 0.2 : realStep,
          maxSegY + 1.45,
          minSegY
        );
      }

      if (!isLowEmbankment && i % 6 === 3) {
        batcher.addBox('steel_pole', 0.26, 4.8, 0.26, rx, ym + railH + 2.4, rz);
        const armInward = -side * 1.35;
        const ax = axis === 'z_const' ? rx : rx + armInward * 0.5;
        const az = axis === 'z_const' ? rz + armInward * 0.5 : rz;
        batcher.addBox(
          'steel_pole',
          axis === 'z_const' ? 0.24 : 1.5,
          0.22,
          axis === 'z_const' ? 1.5 : 0.24,
          ax,
          ym + railH + 4.75,
          az
        );
        const gx = axis === 'z_const' ? rx : rx + armInward;
        const gz = axis === 'z_const' ? rz + armInward : rz;
        batcher.addBox('lamp_glow', 0.55, 0.2, 0.55, gx, ym + railH + 4.62, gz);
        if (!world.viaductLampSpots) world.viaductLampSpots = [];
        world.viaductLampSpots.push({ x: gx, y: ym + railH + 4.5, z: gz, deckY: ym });
      }
    }

    if (isLowEmbankment && clearanceAboveGround > 0.15) {
      const coreH = clearanceAboveGround + 1.0;
      batcher.addBox(
        'viaduct_pillar',
        axis === 'z_const' ? realStep + 0.08 : deckWidth - 1.2,
        coreH,
        axis === 'z_const' ? deckWidth - 1.2 : realStep + 0.08,
        cx,
        ym - 0.25 - coreH * 0.5,
        cz
      );
    }
  }

  // 4) PISTA CONTÍNUA (fitas extrudadas ao longo do perfil — zero emendas/degraus na inclinação)
  const samples = sampleProfile(getHeightAlong, startC, endC, 2);
  addContinuousDeck(batcher, samples, axis, fixedCoord, deckWidth, {
    deckThickness,
    railW,
    railH,
    // Junção com as rampas centrais do Viaduto 1: mureta do lado +Z aberta na largura da rampa
    railGaps: id === 'viaduct_ew_north' ? [{ side: 1, c0: -CENTRAL_RAMP_HALF_W, c1: CENTRAL_RAMP_HALF_W }] : []
  });

  // 5) APOIOS FORA DA RUA: onde o tabuleiro está alto, PÓRTICO com um pilar em cada calçada de verdade e
  //    viga atravessando a avenida; na rampa baixa (onde não passa carro por baixo), pilar central sob a rampa.
  addViaductSupports(world, batcher, {
    axis,
    fixedCoord,
    startC,
    endC,
    deckWidth,
    getHeightAlong,
    getGroundAlong: sampleGroundAlong,
    underside: deckThickness + 0.78
  });

  for (const g of gantries) {
    const gy = getHeightAlong(g.c) ?? (sampleGroundAlong(g.c) + clearanceTarget);
    const gx = axis === 'z_const' ? g.c : fixedCoord;
    const gz = axis === 'z_const' ? fixedCoord : g.c;
    addOverheadHighwayGantry(world, batcher, gx, gy, gz, deckWidth, axis, g.text, g.sub);
  }

  return { getHeightAlong };
}

export function buildViaduct1CentralAccessRamps(world, batcher, junctionDeckTopY) {
  const zTop = -382 + AVENUE_WIDTH * 0.5; // encosta na borda sul do Viaduto 1 (largura da avenida)
  const zBot = -282;
  const totalW = AVENUE_WIDTH; // mesma largura da Av. X = 0: a rampa encaixa 100% na rua
  const halfW = totalW * 0.5;
  const botGroundY = getUrbanCityReliefY(0, zBot);

  const getRampY = (z) => {
    if (z < zTop - 1.0 || z > zBot) return null;
    if (z <= zTop) return junctionDeckTopY;
    const t = cosineStep01((zBot - z) / (zBot - zTop));
    return THREE.MathUtils.lerp(botGroundY, junctionDeckTopY, t);
  };

  world.elevatedDecks.push({
    id: 'viaduct_ew_central_ramp_pair',
    minX: -halfW,
    maxX: halfW,
    minZ: zTop - 1.0,
    maxZ: zBot,
    thresholdBelow: 2.5,
    getDeckY: (_x, z) => getRampY(z),
    getTopY: (_x, z) => getRampY(z)
  });

  world.mapBlocks.push({
    x: 0,
    z: (zTop + zBot) * 0.5,
    w: totalW,
    d: zBot - zTop,
    color: '#64748b',
    isViaductDeck: true
  });

  const numSteps = 16;
  const dzStep = (zBot - zTop) / numSteps;

  for (let i = 0; i < numSteps; i++) {
    const z0 = zTop + i * dzStep;
    const z1 = z0 + dzStep;
    const zm = (z0 + z1) * 0.5;
    const y0 = getRampY(z0);
    const y1 = getRampY(z1);
    const ym = (y0 + y1) * 0.5;
    const gY = getUrbanCityReliefY(0, zm);
    const clr = ym - gY;

    for (const side of [-1, 1]) {
      const rx = side * (halfW - 0.35);
      batcher.studPositionsYellow.push([rx, ym + 1.16, zm]);

      // Apenas os últimos metros de toque no chão (< 1.35m) são fechados; o resto é 100% suspenso!
      if (clr < 1.35) {
        const embH = Math.max(0.5, clr + 1.0);
        batcher.addBox('viaduct_dark_concrete', 0.75, embH, dzStep + 0.1, rx, ym - embH * 0.5, zm);
        world.addCollider(rx, zm, 0.8, dzStep, ym + 1.4, gY - 0.5);
      } else {
        world.addCollider(rx, zm, 0.8, dzStep, Math.max(y0, y1) + 1.4, Math.min(y0, y1) - 0.86);
      }
    }
  }

  // Pista contínua (sem emendas) com divisória amarela central e muretas
  const rampSamples = sampleProfile(getRampY, zTop, zBot, 2);
  addContinuousDeck(batcher, rampSamples, 'x_const', 0, totalW, {
    deckThickness: 0.86,
    railW: 0.68,
    railH: 1.12,
    girders: false
  });
  batcher.addGeometry('safety_yellow', buildProfileRibbon(rampSamples, 'x_const', 0, -0.275, 0.275, 0.45, 0.45));

  // Apoios fora da rua (pórtico nas calçadas da Av. X = 0 onde está alto; pilar central onde a rampa é baixa)
  addViaductSupports(world, batcher, {
    axis: 'x_const',
    fixedCoord: 0,
    startC: zTop,
    endC: zBot,
    deckWidth: totalW,
    getHeightAlong: getRampY,
    getGroundAlong: (z) => getUrbanCityReliefY(0, z),
    underside: 0.86,
    spacing: 20
  });

  addOverheadHighwayGantry(
    world,
    batcher,
    0,
    getRampY(-360),
    -360,
    totalW,
    'x_const',
    'ACESSO CENTRO / SUPER BANCO',
    'SUBIDA OESTE • SAÍDA LESTE'
  );
}

export function buildExpressViaductNetwork(world, batcher) {
  // VIADUTO 01 — Elevado Metropolitano Leste-Oeste (`Z = -382`, `X = -465..+465`, +12.4m acima da avenida abaixo!)
  const v1 = buildSegmentedExpressViaduct(world, batcher, {
    id: 'viaduct_ew_north',
    axis: 'z_const',
    fixedCoord: -382,
    startC: -465,
    endC: 465,
    rampStartLen: 68,
    rampEndLen: 68,
    clearanceTarget: 12.4,
    startGroundY: getUrbanCityReliefY(-465, -382),
    endGroundY: getUrbanCityReliefY(465, -382),
    deckWidth: AVENUE_WIDTH,
    blockedPillarCoords: [-384, -252, -120, 0, 120, 252, 384],
    gantries: [
      { c: -318, text: 'ELEVADO METROPOLITANO', sub: 'ALTO COMERCIAL • PONTE LESTE' },
      { c: 62, text: 'SAÍDA CENTRO / SUPER BANCO', sub: 'VÃO LIVRE ELEVADO' },
      { c: 318, text: 'PONTE LESTE • DISTRITO PCC', sub: 'VIA EXPRESSA ELEVADA' }
    ]
  });
  buildViaduct1CentralAccessRamps(world, batcher, v1.getHeightAlong(0));

  // VIADUTO 02 — Viaduto Panorâmico Norte-Sul (`X = +252`, `Z = -84..+520`, +12.4m acima da avenida abaixo!)
  buildSegmentedExpressViaduct(world, batcher, {
    id: 'viaduct_ns_panoramic',
    axis: 'x_const',
    fixedCoord: 252,
    startC: -84,
    endC: 520,
    rampStartLen: 66,
    rampEndLen: 68,
    clearanceTarget: 12.4,
    startGroundY: getUrbanCityReliefY(252, -84),
    endGroundY: getUrbanCityReliefY(252, 520),
    deckWidth: AVENUE_WIDTH,
    blockedPillarCoords: [0, 134, 187, 268, 349, 402],
    gantries: [
      { c: 65, text: 'VIADUTO PANORÂMICO LAGO', sub: 'PARQUE CENTRAL • PRAIA SUL' },
      { c: 395, text: 'CRISTA COSTEIRA • ORLA SUL', sub: 'DESCIDA PANORÂMICA' }
    ]
  });

  // VIADUTO 03 — Viaduto Expresso Oeste / Acesso Aeroporto-CDD (`Z = 0`, `X = -1036..-466`, +12.4m acima da avenida abaixo!)
  buildSegmentedExpressViaduct(world, batcher, {
    id: 'viaduct_west_airport',
    axis: 'z_const',
    fixedCoord: 0,
    startC: -1036,
    endC: -466,
    rampStartLen: 68,
    rampEndLen: 48,
    clearanceTarget: 12.4,
    startGroundY: 0.28,
    endGroundY: getUrbanCityReliefY(-466, 0),
    deckWidth: AVENUE_WIDTH,
    blockedPillarCoords: [-1020, -516],
    gantries: [
      { c: -890, text: 'EXPRESSO AEROPORTO • CENTRO', sub: 'CORREDOR CIDADE DE DEUS' },
      { c: -560, text: 'TORRE DOS HERÓIS • TIMES SQ.', sub: 'VIA EXPRESSA OESTE' }
    ]
  });
}

export function buildViaductsAndNaturalRelief(world) {
  if (!world.elevatedDecks) world.elevatedDecks = [];
  const batcher = createReliefAndViaductBatcher();

  // 1) Falésias Rochosas Norte (+22.0m), Colinas/Mirante do Parque (+14.0m), Dunas Sul e Cânion CDD
  buildNaturalReliefMeshes(world, batcher);

  // 2) Rede dos 3 Grandes Viadutos Expressos Suspensos (+12.4m acima da rua local abaixo)
  buildExpressViaductNetwork(world, batcher);

  batcher.flush(world.scene);

  world.viaductAndReliefData = {
    viaductsCount: 3,
    hasCentralAccessRamps: true,
    northPlateauHeight: 22.0,
    northwestHillHeight: 14.6,
    northeastHillHeight: 14.2,
    eastBelaVistaHillHeight: 9.6,
    southCoastalRidgeHeight: 10.5,
    eastIndustrialElevationHeight: 7.5,
    centralParkMiranteHeight: 14.0,
    southwestDunesMaxHeight: 8.5
  };
}
