// Estações elevadas (plataformas, coberturas e acessos).
import * as THREE from 'three';
import { METRO_STATIONS } from './MetroRouteData.js';
import { addMetroSignBoard } from './MetroStationProps.js';

export function buildThreeElevatedMetroStations(world, batcher) {
  const platY = 14.85;
  const roofY = 23.65; // 8.8 METROS de altura livre acima da plataforma!
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
      platCenterX: -379.87, // Borda interna em -386.12 (= -388.5 + 2.38m -> 8cm visuais do vagão!)
      stairX: -368.0,
      stairZTop: -35.0,     // 6.0m dentro da plataforma (-91..-29), longe do guarda-corpo de cabeceira!
      stairZBot: 8.0
    },
    // Estação 04 — ORLA MARÍTIMA / PRAIA SUL (`trackX = -125.5, trackZ = +650`)
    {
      stationIndex: 3,
      trackX: -125.5,
      trackZ: 650.0,
      platSide: 1,
      platCenterX: -116.87, // Borda interna em -123.12 (= -125.5 + 2.38m!)
      stairX: -105.5,
      stairZTop: 668.0,     // Bem dentro da plataforma (619..681)!
      stairZBot: 700.0
    },
    // Estação 05 — MARGEM DO RIO / DISTRITO LESTE (`trackX = +518.0, trackZ = -180`)
    {
      stationIndex: 4,
      trackX: 518.0,
      trackZ: -180.0,
      platSide: -1,
      platCenterX: 509.37,  // Borda interna em +515.62 (= +518.0 - 2.38m!)
      stairX: 499.8,
      stairZTop: -155.0,    // 6.0m dentro da plataforma (-211..-149), longe da cabeceira Sul!
      stairZBot: -116.0
    }
  ];

  for (const cfg of elevatedConfigs) {
    const st = METRO_STATIONS[cfg.stationIndex];
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
    batcher.addBox('ny_truss_green', pw + 0.4, 1.05, lenZ, px, platY - 0.72, cfg.trackZ);
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
      batcher.addBox('ny_truss_green', 0.38, 1.15, seg1Len, outerX, platY + 0.58, seg1CZ);
      world.addCollider(outerX, seg1CZ, 0.5, seg1Len, platY + 1.25, platY);
    }
    if (platMaxZ > gapMaxZ + 0.3) {
      const seg2Len = platMaxZ - gapMaxZ;
      const seg2CZ = (gapMaxZ + platMaxZ) * 0.5;
      batcher.addBox('ny_truss_green', 0.38, 1.15, seg2Len, outerX, platY + 0.58, seg2CZ);
      world.addCollider(outerX, seg2CZ, 0.5, seg2Len, platY + 1.25, platY);
    }

    // Cobertura Monumental Arejada em `roofY = +23.65m` (8.8m livres acima da plataforma!)
    const canopyW = pw + 7.4;
    const canopyCX = (px + cfg.trackX) * 0.5 + side * 1.6;
    batcher.addBox('ny_truss_green', canopyW, 0.75, lenZ + 3, canopyCX, roofY, cfg.trackZ);
    batcher.addBox('subway_stripe_blue', canopyW + 0.3, 0.28, lenZ + 3.2, canopyCX, roofY + 0.48, cfg.trackZ);

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
    batcher.addBox('ny_truss_green', pw, 1.15, 0.38, px, platY + 0.58, platMinZ);
    world.addCollider(px, platMinZ, pw, 0.5, platY + 1.3, platY);
    if (Math.abs(platMaxZ - cfg.stairZTop) > 3.2) {
      batcher.addBox('ny_truss_green', pw, 1.15, 0.38, px, platY + 0.58, platMaxZ);
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
      'PLATAFORMA ELEVADA (+14.9M)',
      side > 0 ? Math.PI / 2 : -Math.PI / 2,
      '#14532d',
      true
    );

    // Passarela Lateral de 6.0m de largura (conectando direto ao centro da plataforma sem degrau nem mureta!)
    const stairBotY = (world.getTerrainHeightAt ? world.getTerrainHeightAt(cfg.stairX, cfg.stairZBot) : 0) + 0.28;
    const bridgeInnerX = px + side * (pw * 0.5 - 1.2);
    const bridgeOuterX = cfg.stairX + side * 2.0;
    const bridgeMinX = Math.min(bridgeInnerX, bridgeOuterX);
    const bridgeMaxX = Math.max(bridgeInnerX, bridgeOuterX);
    const bw = bridgeMaxX - bridgeMinX;
    const bx = (bridgeMinX + bridgeMaxX) * 0.5;
    batcher.addBox('ny_truss_green', bw, 0.6, 6.0, bx, platY - 0.3, cfg.stairZTop);
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
      minX: cfg.stairX - 2.1,
      maxX: cfg.stairX + 2.1,
      minZ: zMinStair - 0.8,
      maxZ: zMaxStair + 0.8,
      thresholdBelow: 2.8,
      getDeckY: (_x, z) => {
        const t = THREE.MathUtils.clamp((z - cfg.stairZTop) / (cfg.stairZBot - cfg.stairZTop), 0, 1);
        return THREE.MathUtils.lerp(platY, stairBotY, t);
      }
    });

    const stairSteps = 32;
    for (let s = 0; s < stairSteps; s++) {
      const t = (s + 0.5) / stairSteps;
      const sz = THREE.MathUtils.lerp(cfg.stairZTop, cfg.stairZBot, t);
      const sy = THREE.MathUtils.lerp(platY, stairBotY, t);
      batcher.addBox('platform_floor', 3.8, 0.45, 1.4, cfg.stairX, sy - 0.2, sz);
      batcher.addBox('ny_truss_green', 0.2, 1.1, 1.4, cfg.stairX - 1.95, sy + 0.48, sz);
      batcher.addBox('ny_truss_green', 0.2, 1.1, 1.4, cfg.stairX + 1.95, sy + 0.48, sz);
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
