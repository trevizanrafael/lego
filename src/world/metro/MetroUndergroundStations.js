// Estações subterrâneas, escadarias de calçada e túnel.
import * as THREE from 'three';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from './MetroRouteData.js';
import { addMetroSignBoard, spawnBreakableMetroTurnstile, spawnBreakableTicketMachine } from './MetroStationProps.js';

// ============================================================================
// 5. CONSTRUÇÃO DAS 2 ESTAÇÕES SUBTERRÂNEAS AMPLAS (`Y = -10.5m`, PÉ-DIREITO 9.6m!)
// ============================================================================
export function buildSidewalkSubwayEntrance(world, batcher, cutout, enterFromEast) {
  const { minX, maxX, minZ, maxZ } = cutout;
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;
  const w = maxX - minX; // 28.0m!
  const d = maxZ - minZ; // 4.4m!
  const groundY = 0.28;

  // Grade Verde/Aço Estilo Metrô de NY/SP cercando os 3 lados da boca da escada na calçada!
  // Colisores laterais levemente recuados (w - 0.8) no pé da escada para nunca estreitar a saída em Y = -10.5m!
  const sideColX = cx + (enterFromEast ? 0.35 : -0.35);
  batcher.addBox('ny_entrance_green', w + 0.2, 1.18, 0.24, cx, groundY + 0.59, minZ - 0.14);
  batcher.addBox('ny_entrance_green', w + 0.2, 1.18, 0.24, cx, groundY + 0.59, maxZ + 0.14);
  world.addCollider(sideColX, minZ - 0.22, w - 0.7, 0.34, groundY + 1.28, -10.8);
  world.addCollider(sideColX, maxZ + 0.22, w - 0.7, 0.34, groundY + 1.28, -10.8);

  // REGRA CRÍTICA: A grade closedX existe APENAS na calçada (minY = groundY - 0.2, maxY = groundY + 1.35),
  // deixando um vão 100% LIVRE de Y = -10.5m até Y = -1.2m no pé da escada para entrar direto na plataforma!
  const closedX = enterFromEast ? minX - 0.16 : maxX + 0.16;
  const openX = enterFromEast ? maxX : minX;
  batcher.addBox('ny_entrance_green', 0.3, 1.18, d + 0.45, closedX, groundY + 0.59, cz);
  world.addCollider(closedX, cz, 0.44, d + 0.45, groundY + 1.35, groundY - 0.2);

  // Paredes laterais de ladrilhos brancos LEGO descendo até Y = -10.5m + Degraus largos!
  batcher.addBox('subway_tile_white', w - 0.2, 11.2, 0.32, sideColX, -5.2, minZ - 0.2);
  batcher.addBox('subway_tile_white', w - 0.2, 11.2, 0.32, sideColX, -5.2, maxZ + 0.2);
  batcher.addBox('subway_stripe_blue', w - 0.3, 0.42, 0.36, sideColX, -3.2, minZ - 0.18);
  batcher.addBox('subway_stripe_blue', w - 0.3, 0.42, 0.36, sideColX, -3.2, maxZ + 0.18);

  const steps = 32;
  for (let s = 0; s < steps; s++) {
    const t = (s + 0.5) / steps;
    const sx = enterFromEast ? THREE.MathUtils.lerp(maxX, minX, t) : THREE.MathUtils.lerp(minX, maxX, t);
    const sy = THREE.MathUtils.lerp(0.24, -10.5, t);
    batcher.addBox('platform_floor', w / steps + 0.16, 0.55, d, sx, sy - 0.26, cz);
  }

  // Pórtico Alto "METRÔ" (4.4m de altura livre na entrada da escada!) + 2 Globos Luminosos Verde-Esmeralda
  for (const pz of [minZ - 0.16, maxZ + 0.16]) {
    batcher.addBox('ny_entrance_green', 0.36, 4.5, 0.36, openX, groundY + 2.25, pz);
    batcher.addSphere('globe_emerald', 0.38, openX, groundY + 4.75, pz);
  }
  batcher.addBox('ny_entrance_green', 0.42, 0.9, d + 0.72, openX, groundY + 4.2, cz);
  addMetroSignBoard(
    world,
    openX + (enterFromEast ? 0.24 : -0.24),
    groundY + 4.2,
    cz,
    d + 0.4,
    0.84,
    'METRÔ • LINHA 01',
    'SUBSOLO MONUMENTAL',
    enterFromEast ? Math.PI / 2 : -Math.PI / 2,
    '#14532d',
    true
  );
}

export function buildUndergroundStationsAndTunnel(world, batcher) {
  if (!world.undergroundFloors) world.undergroundFloors = [];

  const platFloorY = -10.5;
  const trackFloorY = -11.2;
  const ceilY = -0.9; // Pé-direito livre monumental de 9.6 METROS (-10.5m até -0.9m)!
  const wallH = ceilY - trackFloorY + 0.8; // 11.1m
  const wallMidY = (ceilY + trackFloorY) * 0.5; // -6.05m

  // --------------------------------------------------------------------------
  // 1) ESTAÇÃO 01 — CENTRAL / SUPER BANCO (`X = -94..+94, Z = -122..-89`, Piso `-10.5m`)
  //    Borda da plataforma a EXATOS 2.38m do trilho (`Z = -116.0 + 2.38 = -113.62` -> 8cm visuais e ZERO fresta!)
  // --------------------------------------------------------------------------
  const s1MinX = -94;
  const s1MaxX = 94;
  const s1MinZ = -122.0;
  const s1MaxZ = -89.0;
  const s1PlatEdgeZ = -113.62; // -116.0 + 2.38m (colada nos halfW = 2.30m do vagão!)
  const s1PlatDepth = s1MaxZ - s1PlatEdgeZ; // 24.62m
  const s1PlatCenterZ = (s1PlatEdgeZ + s1MaxZ) * 0.5;
  const s1W = s1MaxX - s1MinX; // 188m!
  const s1CX = 0;

  world.undergroundFloors.push(
    // Estende 0.28m sob a soleira da porta (-113.90) para ZERO fresta física ao embarcar!
    { id: 'st01_platform', minX: s1MinX, maxX: s1MaxX, minZ: s1PlatEdgeZ - 0.28, maxZ: s1MaxZ, floorY: platFloorY, ceilingY: ceilY },
    { id: 'st01_tracks', minX: s1MinX, maxX: s1MaxX, minZ: s1MinZ, maxZ: s1PlatEdgeZ - 0.28, floorY: trackFloorY, ceilingY: ceilY }
  );

  // Salão da Plataforma Sul (`Z = -113.62 .. -89.0`) + Faixa Tátil Amarela na Borda + Fosso de Trilhos
  batcher.addBox('platform_floor', s1W, 0.7, s1PlatDepth, s1CX, platFloorY - 0.35, s1PlatCenterZ);
  batcher.addBox('subway_stripe_gold', s1W - 6, 0.08, 0.68, s1CX, platFloorY + 0.04, s1PlatEdgeZ + 0.45);
  for (let sx = -76; sx <= 76; sx += 4.5) {
    batcher.studPositions.push([sx, platFloorY + 0.1, s1PlatEdgeZ + 0.45]);
  }
  batcher.addBox('tunnel_dark', s1W, 0.8, 9.2, s1CX, trackFloorY - 0.4, -117.6);

  // Teto Subterrâneo Alto em Y = -0.9m (recortado nas 2 escadarias longas de 28m!)
  const st1RoofRects = sliceRectAroundCutouts(
    { minX: s1MinX, maxX: s1MaxX, minZ: s1MinZ, maxZ: s1MaxZ },
    [METRO_ISLAND_CUTOUTS[0], METRO_ISLAND_CUTOUTS[1]]
  );
  for (const r of st1RoofRects) {
    const rw = r.maxX - r.minX;
    const rd = r.maxZ - r.minZ;
    const rx = (r.minX + r.maxX) * 0.5;
    const rz = (r.minZ + r.maxZ) * 0.5;
    batcher.addBox('subway_tile_white', rw, 0.62, rd, rx, ceilY + 0.31, rz);
    world.addCollider(rx, rz, rw, rd, -0.25, ceilY);
  }

  // Paredes de Ladrilhos Brancos LEGO Norte/Sul/Leste/Oeste + Placas COLADAS RENTE ÀS PAREDES DE FUNDO!
  batcher.addBox('subway_tile_white', s1W, wallH, 0.7, s1CX, wallMidY, s1MinZ);
  batcher.addBox('subway_stripe_blue', s1W, 0.75, 0.78, s1CX, -4.8, s1MinZ);
  batcher.addBox('subway_stripe_gold', s1W, 0.28, 0.8, s1CX, -5.3, s1MinZ);
  world.addCollider(s1CX, s1MinZ, s1W, 0.9, -0.5, trackFloorY - 0.5);

  batcher.addBox('subway_tile_white', s1W, wallH, 0.7, s1CX, wallMidY, s1MaxZ);
  batcher.addBox('subway_stripe_blue', s1W, 0.75, 0.78, s1CX, -4.8, s1MaxZ);
  batcher.addBox('subway_stripe_gold', s1W, 0.28, 0.8, s1CX, -5.3, s1MaxZ);
  world.addCollider(s1CX, s1MaxZ, s1W, 0.9, -0.5, trackFloorY - 0.5);

  // Paredes de fechamento Leste/Oeste na área da plataforma (deixando o túnel dos trilhos aberto!)
  batcher.addBox('subway_tile_white', 0.7, wallH, 22.4, s1MinX, wallMidY, -100.0);
  batcher.addBox('subway_tile_white', 0.7, wallH, 22.4, s1MaxX, wallMidY, -100.0);
  world.addCollider(s1MinX, -100.0, 0.9, 22.4, -0.5, trackFloorY - 0.5);
  world.addCollider(s1MaxX, -100.0, 0.9, 22.4, -0.5, trackFloorY - 0.5);

  // Colunas esbeltas afastadas no fundo, Luminárias no teto alto (-0.9m) e Bancos recuados (Z = -93.2)!
  for (let px = -72; px <= 72; px += 24) {
    batcher.addBox('ny_truss_charcoal', 0.75, ceilY - platFloorY, 0.75, px, (ceilY + platFloorY) * 0.5, -96.0);
    batcher.addBox('fluorescent_white', 6.8, 0.16, 1.1, px, ceilY - 0.08, -101.0);
    batcher.addBox('fluorescent_white', 6.8, 0.16, 0.85, px, ceilY - 0.08, -115.5);
    if (Math.abs(px) >= 18 && Math.abs(px) <= 54) {
      batcher.addBox('bench_wood', 4.4, 0.55, 1.2, px, platFloorY + 0.28, -92.2);
    }
  }

  // Placas 100% rentes às paredes Norte e Sul (ZERO placa pendurada no meio do caminho da câmera!)
  for (const sx of [-42, 0, 42]) {
    addMetroSignBoard(world, sx, -4.6, s1MaxZ - 0.42, 16.5, 2.1, 'ESTAÇÃO CENTRAL • SUPER BANCO', 'LINHA 01 CIRCULAR', Math.PI);
    addMetroSignBoard(world, sx, -4.6, s1MinZ + 0.42, 16.5, 2.1, 'CENTRAL / SUPER BANCO', 'SENTIDO TIMES SQ. • TORRE', 0);
  }

  for (const tz of [-106.5, -103.5, -100.5]) {
    spawnBreakableMetroTurnstile(world, -54.0, platFloorY, tz, Math.PI / 2);
    spawnBreakableMetroTurnstile(world, 54.0, platFloorY, tz, -Math.PI / 2);
  }
  spawnBreakableTicketMachine(world, -44.0, platFloorY, s1MaxZ - 0.9, Math.PI);
  spawnBreakableTicketMachine(world, 44.0, platFloorY, s1MaxZ - 0.9, Math.PI);

  // --------------------------------------------------------------------------
  // 2) ESTAÇÃO 02 — TIMES SQUARE / PARQUE (`X = -99..-54, Z = -24..+64`, Piso `-10.5m`)
  //    Borda da plataforma a EXATOS 2.38m do trilho (`X = -93.0 + 2.38 = -90.62` -> 8cm visuais e ZERO fresta!)
  // --------------------------------------------------------------------------
  const s2MinX = -99.0;
  const s2MaxX = -54.0;
  const s2MinZ = -24.0;
  const s2MaxZ = 64.0;
  const s2PlatEdgeX = -90.62; // -93.0 + 2.38m!
  const s2PlatW = s2MaxX - s2PlatEdgeX; // 36.62m
  const s2PlatCenterX = (s2PlatEdgeX + s2MaxX) * 0.5;
  const s2D = s2MaxZ - s2MinZ; // 88m!
  const s2CZ = (s2MinZ + s2MaxZ) * 0.5; // +20.0

  world.undergroundFloors.push(
    { id: 'st02_platform', minX: s2PlatEdgeX - 0.28, maxX: s2MaxX, minZ: s2MinZ, maxZ: s2MaxZ, floorY: platFloorY, ceilingY: ceilY },
    { id: 'st02_tracks', minX: s2MinX, maxX: s2PlatEdgeX - 0.28, minZ: s2MinZ, maxZ: s2MaxZ, floorY: trackFloorY, ceilingY: ceilY }
  );

  // Salão da Plataforma Leste (`X = -90.62 .. -54.0`) + Faixa Tátil Amarela + Fosso dos Trilhos
  batcher.addBox('platform_floor', s2PlatW, 0.7, s2D, s2PlatCenterX, platFloorY - 0.35, s2CZ);
  batcher.addBox('subway_stripe_gold', 0.68, 0.08, s2D - 6, s2PlatEdgeX + 0.45, platFloorY + 0.04, s2CZ);
  for (let sz = -16; sz <= 56; sz += 4.5) {
    batcher.studPositions.push([s2PlatEdgeX + 0.45, platFloorY + 0.1, sz]);
  }
  batcher.addBox('tunnel_dark', 9.2, 0.8, s2D, -94.8, trackFloorY - 0.4, s2CZ);

  const st2RoofRects = sliceRectAroundCutouts(
    { minX: s2MinX, maxX: s2MaxX, minZ: s2MinZ, maxZ: s2MaxZ },
    [METRO_ISLAND_CUTOUTS[2]]
  );
  for (const r of st2RoofRects) {
    const rw = r.maxX - r.minX;
    const rd = r.maxZ - r.minZ;
    const rx = (r.minX + r.maxX) * 0.5;
    const rz = (r.minZ + r.maxZ) * 0.5;
    batcher.addBox('subway_tile_white', rw, 0.62, rd, rx, ceilY + 0.31, rz);
    world.addCollider(rx, rz, rw, rd, -0.25, ceilY);
  }

  // Paredes Oeste, Leste, Norte e Sul da Estação 02
  batcher.addBox('subway_tile_white', 0.7, wallH, s2D, s2MinX, wallMidY, s2CZ);
  batcher.addBox('subway_stripe_blue', 0.78, 0.75, s2D, s2MinX, -4.8, s2CZ);
  batcher.addBox('subway_stripe_gold', 0.8, 0.28, s2D, s2MinX, -5.3, s2CZ);
  world.addCollider(s2MinX, s2CZ, 0.9, s2D, -0.5, trackFloorY - 0.5);

  batcher.addBox('subway_tile_white', 0.7, wallH, s2D, s2MaxX, wallMidY, s2CZ);
  batcher.addBox('subway_stripe_blue', 0.78, 0.75, s2D, s2MaxX, -4.8, s2CZ);
  world.addCollider(s2MaxX, s2CZ, 0.9, s2D, -0.5, trackFloorY - 0.5);

  batcher.addBox('subway_tile_white', 34.4, wallH, 0.7, -71.0, wallMidY, s2MinZ);
  batcher.addBox('subway_tile_white', 34.4, wallH, 0.7, -71.0, wallMidY, s2MaxZ);
  world.addCollider(-71.0, s2MinZ, 34.4, 0.9, -0.5, trackFloorY - 0.5);
  world.addCollider(-71.0, s2MaxZ, 34.4, 0.9, -0.5, trackFloorY - 0.5);

  for (let pz = -12; pz <= 52; pz += 16) {
    batcher.addBox('ny_truss_charcoal', 0.75, ceilY - platFloorY, 0.75, -66.0, (ceilY + platFloorY) * 0.5, pz);
    batcher.addBox('fluorescent_white', 1.1, 0.16, 6.4, -76.0, ceilY - 0.08, pz);
    batcher.addBox('fluorescent_white', 0.85, 0.16, 6.4, -93.0, ceilY - 0.08, pz);
    if (pz === -12 || pz === 4 || pz === 36 || pz === 52) {
      batcher.addBox('bench_wood', 1.2, 0.55, 4.2, -60.5, platFloorY + 0.28, pz);
    }
  }

  // Placas rentes às paredes Oeste e Leste (nunca no meio do ar!)
  for (const sz of [0, 40]) {
    addMetroSignBoard(world, s2MinX + 0.42, -4.6, sz, 16.5, 2.1, 'TIMES SQUARE • PARQUE', 'SENTIDO TORRE DOS HERÓIS', Math.PI / 2);
    addMetroSignBoard(world, s2MaxX - 0.42, -4.6, sz, 16.5, 2.1, 'ESTAÇÃO TIMES SQUARE', 'SAÍDA PARQUE CENTRAL', -Math.PI / 2);
  }

  for (const tx of [-80.5, -77.5, -74.5]) {
    spawnBreakableMetroTurnstile(world, tx, platFloorY, 10.5, 0);
  }
  spawnBreakableTicketMachine(world, -55.2, platFloorY, 32.0, -Math.PI / 2);
  spawnBreakableTicketMachine(world, -55.2, platFloorY, 36.0, -Math.PI / 2);

  // Entradas Amplas de 28m na Calçada das 2 Estações Subterrâneas
  buildSidewalkSubwayEntrance(world, batcher, METRO_ISLAND_CUTOUTS[0], true);
  buildSidewalkSubwayEntrance(world, batcher, METRO_ISLAND_CUTOUTS[1], false);
  buildSidewalkSubwayEntrance(world, batcher, METRO_ISLAND_CUTOUTS[2], true);

  // --------------------------------------------------------------------------
  // 3) TÚNEIS SUBTERRÂNEOS AMPLOS (`Y = -11.2m .. -0.9m`) & 2 PRAÇAS-PORTAL BLINDADAS (`X = ±82`)
  // --------------------------------------------------------------------------
  const tunnelCorridors = [
    // Portal Leste (X=82, Z=-136) -> Parede Norte da Estação 01 (Z=-122)
    { minX: 76, maxX: 90, minZ: -136, maxZ: -122 },
    // Parede Sul da Estação 01 (Z=-89) -> Parede Norte da Estação 02 (Z=-24) — sem cortar o salão da Estação 01!
    { minX: -99, maxX: -87, minZ: -89, maxZ: -24 },
    // Estação 02 (Z=+64) -> Alça Subterrânea Oeste (X=-174..-162) -> Portal Oeste (X=-82, Z=-136)
    { minX: -174, maxX: -87, minZ: 64, maxZ: 80 },
    { minX: -174, maxX: -162, minZ: -135, maxZ: 68 },
    { minX: -168, maxX: -76, minZ: -136, maxZ: -123 }
  ];

  for (const tc of tunnelCorridors) {
    world.undergroundFloors.push({
      id: 'metro_tunnel_seg',
      minX: tc.minX,
      maxX: tc.maxX,
      minZ: tc.minZ,
      maxZ: tc.maxZ,
      floorY: trackFloorY,
      ceilingY: ceilY
    });

    const cw = tc.maxX - tc.minX;
    const cd = tc.maxZ - tc.minZ;
    const cx = (tc.minX + tc.maxX) * 0.5;
    const cz = (tc.minZ + tc.maxZ) * 0.5;

    batcher.addBox('tunnel_dark', cw, 0.8, cd, cx, trackFloorY - 0.4, cz);
    batcher.addBox('tunnel_concrete', cw, 0.65, cd, cx, ceilY + 0.32, cz);
    world.addCollider(cx, cz, cw, cd, -0.25, ceilY);

    if (cw > cd) {
      batcher.addBox('tunnel_concrete', cw, wallH, 0.65, cx, wallMidY, tc.minZ);
      batcher.addBox('tunnel_concrete', cw, wallH, 0.65, cx, wallMidY, tc.maxZ);
      for (let lx = tc.minX + 10; lx <= tc.maxX - 10; lx += 18) {
        batcher.addBox('fluorescent_white', 4.6, 0.16, 0.55, lx, ceilY - 0.08, cz);
      }
    } else {
      batcher.addBox('tunnel_concrete', 0.65, wallH, cd, tc.minX, wallMidY, cz);
      batcher.addBox('tunnel_concrete', 0.65, wallH, cd, tc.maxX, wallMidY, cz);
      for (let lz = tc.minZ + 10; lz <= tc.maxZ - 10; lz += 18) {
        batcher.addBox('fluorescent_white', 0.55, 0.16, 4.6, cx, ceilY - 0.08, lz);
      }
    }
  }

  // Constrói as 2 Praças-Portal Blindadas Simétricas (X = -82 e X = +82, Z = -232..-131) — 100% fechadas sem vazar vazio!
  const buildArmoredPlazaPortal = (cutout, labelTitle) => {
    const { minX, maxX, minZ, maxZ } = cutout;
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;
    const w = maxX - minX; // 9.6m
    const d = maxZ - minZ; // 62.0m (-196..-134)

    // Calçamento Arquitetônico nas Praças Laterais ao redor da rampa (X = cx ± 22m, Z = -230..-131)
    batcher.addBox('plaza_granite', 14.0, 0.28, 98.0, cx - 13.0, 0.14, -180.5);
    batcher.addBox('plaza_granite', 14.0, 0.28, 98.0, cx + 13.0, 0.14, -180.5);

    // Caixa de Concreto Maciça no Fundo e Laterais da Trincheira (de Y = -12.4m até +1.65m — ZERO vazamento do vazio!)
    batcher.addBox('tunnel_dark', w + 2.0, 1.4, d + 2.0, cx, -12.1, cz);
    for (const sideX of [minX - 0.45, maxX + 0.45]) {
      batcher.addBox('tunnel_concrete', 0.9, 14.2, d + 1.6, sideX, -5.4, cz);
      batcher.addBox('ny_truss_green', 0.6, 1.25, d + 1.6, sideX, 1.15, cz);
      world.addCollider(sideX, cz, 0.95, d + 1.6, 1.8, -12.0);
    }
    // Mureta de cabeceira Sul em Z = maxZ (-134.0) + Pórtico Monumental do Túnel!
    batcher.addBox('tunnel_concrete', w + 1.8, 5.8, 1.6, cx, -1.2, maxZ);
    batcher.addBox('ny_truss_green', w + 2.0, 1.15, 1.2, cx, 2.1, maxZ);
    world.addCollider(cx, maxZ, w + 1.8, 1.6, 2.7, -3.8);

    addMetroSignBoard(
      world,
      cx,
      1.95,
      maxZ + 0.85,
      w + 1.2,
      1.35,
      labelTitle,
      'TRANSIÇÃO SUBSOLO • ELEVADO',
      0,
      '#14532d',
      true
    );
  };

  buildArmoredPlazaPortal(METRO_ISLAND_CUTOUTS[3], 'PORTAL OESTE • LINHA 01');
  buildArmoredPlazaPortal(METRO_ISLAND_CUTOUTS[4], 'PORTAL LESTE • LINHA 01');
}
