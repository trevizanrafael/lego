// Estações elevadas (plataformas, coberturas e acessos).
import * as THREE from 'three';
import { METRO_STATIONS } from './MetroRouteData.js';
import { addMetroSignBoard } from './MetroStationProps.js';
import { isInsideAnyRoad } from './MetroSupportPlanner.js';
import { makeSidewalkLookup } from './MetroTrackAndViaduct.js';

// ============================================================================
// ESCADA DE ACESSO: sempre numa calçada livre (nunca em pista de carro nem dentro de prédio)
// ============================================================================
const STAIR_HALF_WIDTHS = [2.1, 1.8, 1.5]; // Larga quando a calçada permite; estreita em calçada apertada
const STAIR_SLOPE = 0.34; // subida por metro (mesma inclinação das escadas originais)

function hitsBuilding(world, minX, maxX, minZ, maxZ, yMin, yMax) {
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const r = Math.hypot(maxX - minX, maxZ - minZ) * 0.5 + 1;
  const cols = world.getCollidersNear ? world.getCollidersNear(cx, cz, r) : world.colliders || [];
  for (const col of cols) {
    if (col.disabled) continue;
    if (col.maxY <= yMin || (col.minY ?? 0) >= yMax) continue;
    if (maxX > col.minX && minX < col.maxX && maxZ > col.minZ && minZ < col.maxZ) return true;
  }
  return false;
}

/**
 * Escolhe a posição da escada de uma estação elevada: paralela ao trilho, do lado de fora da plataforma,
 * com o pé da escada e todo o percurso em cima de calçada (nunca no asfalto) e fora de prédios. Em calçada apertada a escada fica mais estreita.
 */
export function planElevatedStationStair(world, cfg, platY, pw, lenZ) {
  const roads = Array.isArray(world.mapRoads) ? world.mapRoads : [];
  const isSidewalk = makeSidewalkLookup(world);
  const ground = (x, z) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0);
  const side = cfg.platSide;
  const outerEdge = cfg.platCenterX + side * pw * 0.5;
  const platMinZ = cfg.trackZ - lenZ * 0.5;
  const platMaxZ = cfg.trackZ + lenZ * 0.5;

  const zTops = [];
  for (let z = platMinZ + 4; z <= platMaxZ - 4; z += 2) zTops.push(z);
  zTops.sort((a, b) => Math.abs(a - cfg.trackZ) - Math.abs(b - cfg.trackZ));

  const xOffs = [];
  for (let o = 2.0; o <= 12.0; o += 0.4) xOffs.push(o);
  for (const halfW of STAIR_HALF_WIDTHS) {
  for (const xOff of xOffs) {
    if (xOff < halfW + 0.5) continue; // não encosta na plataforma
    const stairX = outerEdge + side * xOff;
    for (const zTop of zTops) {
      for (const dir of [1, -1]) {
        let botY = ground(stairX, zTop) + 0.28;
        let len = 0;
        for (let it = 0; it < 3; it++) {
          len = Math.max(8, (platY - botY) / STAIR_SLOPE);
          botY = ground(stairX, zTop + dir * len) + 0.28;
        }
        const zBot = zTop + dir * len;
        const minZ = Math.min(zTop, zBot) - 0.8;
        const maxZ = Math.max(zTop, zBot) + 0.8;
        let ok = true;
        // Percurso inteiro fora das pistas e acima do chão
        for (let z = minZ; z <= maxZ && ok; z += 1) {
          for (const x of [stairX - halfW, stairX, stairX + halfW]) {
            // Escada inteira em cima de calçada de verdade (nunca no asfalto)
            if (isInsideAnyRoad(roads, x, z, 0.4) || !isSidewalk(x, z)) {
              ok = false;
              break;
            }
          }
          const t = THREE.MathUtils.clamp((z - zTop) / (zBot - zTop), 0, 1);
          if (THREE.MathUtils.lerp(platY, botY, t) < ground(stairX, z) - 0.1) ok = false;
        }
        if (!ok) continue;
        // Sem prédio no caminho da escada nem da passarela de ligação
        if (hitsBuilding(world, stairX - halfW, stairX + halfW, minZ, maxZ, botY + 0.6, platY + 2.5)) continue;
        const bMin = Math.min(outerEdge, stairX + side * halfW);
        const bMax = Math.max(outerEdge, stairX + side * halfW);
        if (hitsBuilding(world, bMin, bMax, zTop - 3, zTop + 3, platY - 0.8, platY + 2.5)) continue;
        return { stairX, stairHalfW: halfW, stairZTop: zTop, stairZBot: zBot, stairBotY: botY };
      }
    }
  }
  }
  return null;
}

export function buildThreeElevatedMetroStations(world, batcher) {
  const pw = 12.5;     // 12.5 METROS de largura de plataforma!
  const lenZ = 62.0;   // 62.0 METROS de comprimento!

  // Borda interna a EXATOS 2.38m do eixo do trilho -> platCenterX = trackX + side * (2.38 + 6.25) = trackX + side * 8.63!
  const elevatedConfigs = [
    // Estação 03 — TORRE DOS HERÓIS (`trackX = -388.5, trackZ = -60`)
    {
      stationIndex: 2,
      trackX: -388.5,
      trackZ: -60.0,
      platSide: 1,
      platCenterX: -379.87 // Borda interna em -386.12 (= -388.5 + 2.38m -> 8cm visuais do vagão!)
    },
    // Estação 04 — ORLA MARÍTIMA / PRAIA SUL (`trackX = -125.5, trackZ = +650`)
    {
      stationIndex: 3,
      trackX: -125.5,
      trackZ: 650.0,
      platSide: 1,
      platCenterX: -116.87 // Borda interna em -123.12 (= -125.5 + 2.38m!)
    },
    // Estação 05 — MARGEM DO RIO / DISTRITO LESTE (`trackX = +518.0, trackZ = -180`)
    {
      stationIndex: 4,
      trackX: 518.0,
      trackZ: -180.0,
      platSide: -1,
      platCenterX: 509.37 // Borda interna em +515.62 (= +518.0 - 2.38m!)
    }
  ];

  if (!world.metroStationStairs) world.metroStationStairs = [];
  for (const baseCfg of elevatedConfigs) {
    const st = METRO_STATIONS[baseCfg.stationIndex];
    // Altura real da plataforma (o trilho pode subir para manter o vão livre sobre a rua)
    const platY = st.platformSpawn.y;
    const roofY = platY + 8.8; // 8.8 METROS de altura livre acima da plataforma!
    const stair = planElevatedStationStair(world, baseCfg, platY, pw, lenZ);
    if (!stair) {
      console.warn(`[Metrô] Sem calçada livre para a escada da estação ${st.code}`);
      continue;
    }
    const cfg = { ...baseCfg, ...stair };
    st.streetEntrance = { x: cfg.stairX, y: cfg.stairBotY, z: cfg.stairZBot };
    world.metroStationStairs.push({ stationId: st.id, code: st.code, platY, ...stair });
    const side = cfg.platSide;
    const px = cfg.platCenterX;
    const platMinZ = cfg.trackZ - lenZ * 0.5;
    const platMaxZ = cfg.trackZ + lenZ * 0.5;

    // Estende 0.28m sob a soleira da porta do trem (2.10m do trilho) para ZERO fresta física ao embarcar!
    const deckMinX = side > 0 ? px - pw * 0.5 - 0.28 : px - pw * 0.5;
    const deckMaxX = side > 0 ? px + pw * 0.5 : px + pw * 0.5 + 0.28;

    world.elevatedDecks.push({
      id: `${st.id}_plat`,
      minX: deckMinX,
      maxX: deckMaxX,
      minZ: platMinZ,
      maxZ: platMaxZ,
      thresholdBelow: 2.5,
      getDeckY: () => platY
    });

    // Laje larga de 12.5m x 62m + Faixa Amarela Tátil colada a 2.38m do eixo do trilho!
    batcher.addBox('viaduct_girder', pw + 0.4, 1.05, lenZ, px, platY - 0.72, cfg.trackZ);
    batcher.addBox('platform_floor', pw, 0.44, lenZ, px, platY - 0.22, cfg.trackZ);
    const trackEdgeX = px - side * (pw * 0.5 - 0.36);
    batcher.addBox('subway_stripe_gold', 0.52, 0.06, lenZ - 2, trackEdgeX, platY + 0.03, cfg.trackZ);

    // Guarda-corpo externo RECORTADO com um VÃO ABERTO AMPLO DE 6.0m na junção da passarela (stairZTop ± 3.0m)!
    const outerX = px + side * (pw * 0.5 - 0.22);
    const gapHalfZ = 3.0;
    const gapMinZ = cfg.stairZTop - gapHalfZ;
    const gapMaxZ = cfg.stairZTop + gapHalfZ;

    if (gapMinZ > platMinZ + 0.3) {
      const seg1Len = gapMinZ - platMinZ;
      const seg1CZ = (platMinZ + gapMinZ) * 0.5;
      batcher.addBox('viaduct_girder', 0.38, 1.15, seg1Len, outerX, platY + 0.58, seg1CZ);
      world.addCollider(outerX, seg1CZ, 0.5, seg1Len, platY + 1.25, platY);
    }
    if (platMaxZ > gapMaxZ + 0.3) {
      const seg2Len = platMaxZ - gapMaxZ;
      const seg2CZ = (gapMaxZ + platMaxZ) * 0.5;
      batcher.addBox('viaduct_girder', 0.38, 1.15, seg2Len, outerX, platY + 0.58, seg2CZ);
      world.addCollider(outerX, seg2CZ, 0.5, seg2Len, platY + 1.25, platY);
    }

    // Cobertura Monumental Arejada em `roofY = +23.65m` (8.8m livres acima da plataforma!)
    const canopyW = pw + 7.4;
    const canopyCX = (px + cfg.trackX) * 0.5 + side * 1.6;
    batcher.addBox('viaduct_girder', canopyW, 0.75, lenZ + 3, canopyCX, roofY, cfg.trackZ);
    batcher.addBox('subway_stripe_gold', canopyW + 0.3, 0.28, lenZ + 3.2, canopyCX, roofY + 0.48, cfg.trackZ);

    // Pilares esbeltos fora do vão de 6.0m da escada + Luminárias altas + Bancos recuados
    for (let cz = cfg.trackZ - 24; cz <= cfg.trackZ + 24; cz += 16) {
      if (Math.abs(cz - cfg.stairZTop) > 3.6) {
        batcher.addBox('ny_truss_charcoal', 0.46, roofY - platY, 0.46, outerX - side * 0.35, (platY + roofY) * 0.5, cz);
      }
      batcher.addBox('fluorescent_white', 4.2, 0.16, 0.75, px, roofY - 0.42, cz);
      if (Math.abs(cz - cfg.trackZ) > 6 && Math.abs(cz - cfg.stairZTop) > 4.5) {
        batcher.addBox('bench_wood', 1.25, 0.55, 4.2, px + side * 3.2, platY + 0.28, cz);
      }
    }

    // Guarda-corpos nas cabeceiras Norte/Sul da plataforma (recortados caso a escada encoste na cabeceira)
    batcher.addBox('viaduct_girder', pw, 1.15, 0.38, px, platY + 0.58, platMinZ);
    world.addCollider(px, platMinZ, pw, 0.5, platY + 1.3, platY);
    if (Math.abs(platMaxZ - cfg.stairZTop) > 3.2) {
      batcher.addBox('viaduct_girder', pw, 1.15, 0.38, px, platY + 0.58, platMaxZ);
      world.addCollider(px, platMaxZ, pw, 0.5, platY + 1.3, platY);
    }

    // Placa Externa e Placa Interna alta na testeira da cobertura (+23.1m)
    addMetroSignBoard(
      world,
      outerX + side * 0.28,
      roofY - 0.1,
      cfg.trackZ,
      22.0,
      1.95,
      st.name,
      `PLATAFORMA ELEVADA (+${platY.toFixed(1)}M)`,
      side > 0 ? Math.PI / 2 : -Math.PI / 2,
      '#090a0d',
      true
    );

    // Passarela Lateral de 6.0m de largura (conectando direto ao centro da plataforma sem degrau nem mureta!)
    const stairBotY = cfg.stairBotY;
    const bridgeInnerX = px + side * (pw * 0.5 - 1.2);
    const bridgeOuterX = cfg.stairX + side * cfg.stairHalfW;
    const bridgeMinX = Math.min(bridgeInnerX, bridgeOuterX);
    const bridgeMaxX = Math.max(bridgeInnerX, bridgeOuterX);
    const bw = bridgeMaxX - bridgeMinX;
    const bx = (bridgeMinX + bridgeMaxX) * 0.5;
    batcher.addBox('viaduct_girder', bw, 0.6, 6.0, bx, platY - 0.3, cfg.stairZTop);
    batcher.addBox('platform_floor', bw, 0.22, 5.8, bx, platY - 0.08, cfg.stairZTop);
    world.elevatedDecks.push({
      id: `${st.id}_bridge`,
      minX: Math.min(px, bridgeMinX),
      maxX: Math.max(px, bridgeMaxX),
      minZ: cfg.stairZTop - 3.0,
      maxZ: cfg.stairZTop + 3.0,
      thresholdBelow: 2.6,
      getDeckY: () => platY
    });

    const zMinStair = Math.min(cfg.stairZTop, cfg.stairZBot);
    const zMaxStair = Math.max(cfg.stairZTop, cfg.stairZBot);
    world.elevatedDecks.push({
      id: `${st.id}_stairs`,
      minX: cfg.stairX - cfg.stairHalfW,
      maxX: cfg.stairX + cfg.stairHalfW,
      minZ: zMinStair - 0.8,
      maxZ: zMaxStair + 0.8,
      thresholdBelow: 2.8,
      getDeckY: (_x, z) => {
        const t = THREE.MathUtils.clamp((z - cfg.stairZTop) / (cfg.stairZBot - cfg.stairZTop), 0, 1);
        return THREE.MathUtils.lerp(platY, stairBotY, t);
      }
    });

    const stairSteps = Math.max(8, Math.ceil(Math.abs(cfg.stairZBot - cfg.stairZTop) / 1.35));
    for (let s = 0; s < stairSteps; s++) {
      const t = (s + 0.5) / stairSteps;
      const sz = THREE.MathUtils.lerp(cfg.stairZTop, cfg.stairZBot, t);
      const sy = THREE.MathUtils.lerp(platY, stairBotY, t);
      const stepLen = Math.abs(cfg.stairZBot - cfg.stairZTop) / stairSteps + 0.05;
      const hw = cfg.stairHalfW;
      batcher.addBox('platform_floor', hw * 2 - 0.4, 0.45, stepLen, cfg.stairX, sy - 0.2, sz);
      batcher.addBox('viaduct_girder', 0.2, 1.1, stepLen, cfg.stairX - hw + 0.15, sy + 0.48, sz);
      batcher.addBox('viaduct_girder', 0.2, 1.1, stepLen, cfg.stairX + hw - 0.15, sy + 0.48, sz);
    }

    const midStairZ = (cfg.stairZTop + cfg.stairZBot) * 0.5;
    const midGroundY = world.getTerrainHeightAt ? world.getTerrainHeightAt(cfg.stairX, midStairZ) : 0;
    const midTopY = (platY + stairBotY) * 0.5 - 0.4;
    const midColH = Math.max(2.0, midTopY - midGroundY);
    batcher.addBox('ny_truss_charcoal', 0.72, midColH + 1.2, 0.72, cfg.stairX, midGroundY + midColH * 0.5 - 0.6, midStairZ);

    world.mapBuildings.push({
      x: cfg.trackX,
      z: cfg.trackZ,
      w: 22,
      d: lenZ,
      height: 24,
      color: '#0284c7',
      isLandmark: true,
      label: st.shortName
    });
  }
}
