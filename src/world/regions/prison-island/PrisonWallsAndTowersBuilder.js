import {
  PRISON_COMPOUND_ORIGIN,
  PRISON_OFFSET_X,
  PRISON_OFFSET_Z,
  PRISON_DOCK_OFFSET_X,
  PRISON_DOCK_OFFSET_Z,
  addPrisonBannerSign,
  addBatchedLegoPerson
} from './PrisonBatcherAndBridgeBuilder.js';
import { IS_SCALED_WORLD, ws } from '../../core/WorldLayoutScale.js';
import {
  PRISON_ISLAND_POLYGON,
  pointInPolygon,
  getDistanceToCoastAt
} from '../../CoastlineProfile.js';

function _buildArmoredCausewaySegmentX(world, batcher, x1, x2, z, roadW = 26) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const len = maxX - minX;
  if (len <= 4) return;
  const midX = (minX + maxX) * 0.5;

  batcher.addBox('island_basalt', len + 8, 1.15, roadW + 14, midX, -0.22, z);
  batcher.addBox('gunmetal_concrete', len + 4, 0.34, roadW + 7, midX, 0.19, z);
  batcher.addBox('matte_black', len, 0.14, roadW, midX, 0.34, z);
  batcher.addBox('alert_yellow', len - 6, 0.05, 0.45, midX, 0.42, z);

  for (let bx = minX + 18; bx <= maxX - 18; bx += 28) {
    for (const side of [-1, 1]) {
      const rz = z + side * (roadW * 0.5 + 2.1);
      batcher.addBox('brushed_silver', 20.0, 0.45, 0.4, bx, 0.9, rz);
      batcher.addBox('bope_black', 0.68, 1.2, 0.68, bx - 9.5, 0.9, rz);
      batcher.addBox('alert_yellow', 0.74, 0.26, 0.74, bx - 9.5, 1.44, rz);
    }
  }
  world.mapRoads.push({ x: midX, z, w: len, d: roadW, isMain: false });
}

function _buildArmoredCausewaySegmentZ(world, batcher, x, z1, z2, roadW = 26) {
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  const len = maxZ - minZ;
  if (len <= 4) return;
  const midZ = (minZ + maxZ) * 0.5;

  batcher.addBox('island_basalt', roadW + 14, 1.15, len + 8, x, -0.22, midZ);
  batcher.addBox('gunmetal_concrete', roadW + 7, 0.34, len + 4, x, 0.19, midZ);
  batcher.addBox('matte_black', roadW, 0.14, len, x, 0.34, midZ);
  batcher.addBox('alert_yellow', 0.45, 0.05, len - 6, x, 0.42, midZ);

  for (let bz = minZ + 18; bz <= maxZ - 18; bz += 28) {
    for (const side of [-1, 1]) {
      const rx = x + side * (roadW * 0.5 + 2.1);
      batcher.addBox('brushed_silver', 0.4, 0.45, 20.0, rx, 0.9, bz);
      batcher.addBox('bope_black', 0.68, 1.2, 0.68, rx, 0.9, bz - 9.5);
      batcher.addBox('alert_yellow', 0.74, 0.26, 0.74, rx, 1.44, bz - 9.5);
    }
  }
  world.mapRoads.push({ x, z: midZ, w: roadW, d: len, isMain: false });
}

/**
 * Constrói o relevo vulcânico/granítico natural da Ilha da Prisão fora do plinto da fortaleza,
 * preservando `prison_island_ground_pad` seco (`topY: 0.3`) e eliminando o antigo quadrado de concreto de 2.5km!
 */
function _buildScaledNaturalPrisonIslandTerrain(world, batcher, ox, oz, dxOff, dzOff) {
  const minSlabX = ws(954), maxSlabX = ws(1796), minSlabZ = ws(1118), maxSlabZ = ws(1982);
  const slabCX = (minSlabX + maxSlabX) * 0.5, slabCZ = (minSlabZ + maxSlabZ) * 0.5;
  const slabW = maxSlabX - minSlabX, slabD = maxSlabZ - minSlabZ;

  // Suporte físico seco contínuo da Ilha da Prisão (sem malha nem mapBlock quadrado gigante!)
  world.addCollider(slabCX, slabCZ, slabW, slabD, 0.3, -2.5);
  if (!world.elevatedDecks) world.elevatedDecks = [];
  world.elevatedDecks.push({
    id: 'prison_island_ground_pad', minX: minSlabX, maxX: maxSlabX, minZ: minSlabZ, maxZ: maxSlabZ,
    topY: 0.3, thresholdBelow: 2.5, getDeckY: () => 0.3, getTopY: () => 0.3
  });

  // 1. Plinto de concreto fortificado ESTRITO sob a Cidadela Panóptica 1x (860m x 880m!)
  const plinthCX = 1375 + ox;
  const plinthCZ = 1530 + oz;
  const plinthW = 860;
  const plinthD = 880;
  batcher.addBox('coastal_rock', plinthW + 28, 2.3, plinthD + 28, plinthCX, -0.88, plinthCZ);
  batcher.addBox('yard_concrete', plinthW, 1.12, plinthD, plinthCX, -0.26, plinthCZ);
  world.mapBlocks.push({ x: plinthCX, z: plinthCZ, w: plinthW, d: plinthD, color: '#334155' });

  // 2. Manto vulcânico/rochoso orgânico recortado por PRISON_ISLAND_POLYGON (fora do plinto)
  const step = 156;
  let tSeed = 11;
  for (let tx = ws(860); tx <= ws(2160); tx += step) {
    for (let tz = ws(1060); tz <= ws(2160); tz += step) {
      tSeed++;
      if (!pointInPolygon(tx, tz, PRISON_ISLAND_POLYGON)) continue;
      const distCoast = getDistanceToCoastAt(tx, tz, 130);
      if (distCoast < 42) continue;
      const inPlinth =
        Math.abs(tx - plinthCX) < plinthW * 0.5 - 24 &&
        Math.abs(tz - plinthCZ) < plinthD * 0.5 - 24;
      if (inPlinth) continue;

      const patchW = step + 18;
      const patchMat = tSeed % 3 === 0 ? 'island_turf' : tSeed % 2 === 0 ? 'island_basalt' : 'island_granite';
      batcher.addBox('coastal_rock', patchW + 10, 1.9, patchW + 10, tx, -0.82, tz);
      batcher.addBox(patchMat, patchW, 0.44, patchW, tx, 0.08, tz);
    }
  }

  // 3. Ramal Oeste do Causeway Blindado (26m) ligando o Causeway Norte à Doca Naval e ao Portão Oeste
  const bridgeAxisX = ws(1375);
  const northBranchZ = 1120 + oz - 240;
  const westPerimeterX = 995 + ox - 185;
  const westGateZ = 1550 + oz;
  const dockEastX = 928 + dxOff + 68;

  _buildArmoredCausewaySegmentX(world, batcher, westPerimeterX - 13, bridgeAxisX - 13, northBranchZ, 26);
  _buildArmoredCausewaySegmentZ(world, batcher, westPerimeterX, northBranchZ, westGateZ, 26);
  _buildArmoredCausewaySegmentX(world, batcher, dockEastX, 995 + ox - 10, westGateZ, 26);

  if (!Array.isArray(world.mapOrganicRoads)) world.mapOrganicRoads = [];
  world.mapOrganicRoads.push({
    id: 'prison_causeway_west_dock',
    label: 'RAMAL BLINDADO DOCA NAVAL',
    isMain: false,
    width: 26,
    points: [
      [bridgeAxisX, northBranchZ],
      [westPerimeterX, northBranchZ],
      [westPerimeterX, westGateZ],
      [dockEastX, 1550 + dzOff]
    ]
  });

  // 4. Escarpas de Basalto/Granito e Vegetação Rasteira Árida fora das muralhas e causeways
  const cragStep = 165;
  let cSeed = 29;
  for (let gx = ws(910); gx <= ws(2080); gx += cragStep) {
    for (let gz = ws(1110); gz <= ws(2090); gz += cragStep) {
      cSeed++;
      const cx = gx + (((cSeed * 37) % 61) - 30);
      const cz = gz + (((cSeed * 53) % 61) - 30);
      if (!pointInPolygon(cx, cz, PRISON_ISLAND_POLYGON)) continue;
      if (getDistanceToCoastAt(cx, cz, 110) < 58) continue;

      if (Math.abs(cx - plinthCX) < plinthW * 0.5 + 36 && Math.abs(cz - plinthCZ) < plinthD * 0.5 + 36) continue;
      if (Math.abs(cx - bridgeAxisX) < 48 && cz < 1125 + oz) continue;
      if (Math.abs(cz - northBranchZ) < 42 && cx >= westPerimeterX - 36 && cx <= bridgeAxisX + 36) continue;
      if (Math.abs(cx - westPerimeterX) < 42 && cz >= northBranchZ - 36 && cz <= westGateZ + 36) continue;
      if (Math.abs(cz - westGateZ) < 52 && cx <= 995 + ox + 20) continue;

      const cw = 16 + ((cSeed * 11) % 18);
      const cd = 14 + ((cSeed * 13) % 16);
      const ch = 4.2 + ((cSeed * 7) % 10);
      const rotY = ((cSeed * 19) % 12) * 0.26;

      batcher.addBox(cSeed % 2 === 0 ? 'island_basalt' : 'island_granite', cw, ch, cd, cx, ch * 0.42, cz, 0, rotY, 0);
      batcher.addBox('coastal_rock', cw * 0.65, ch * 1.28, cd * 0.62, cx + cw * 0.22, ch * 0.56, cz - cd * 0.18, 0, rotY + 0.4, 0);
      batcher.addBox('island_scrub', cw * 0.72, 1.35, cd * 0.72, cx - cw * 0.35, 0.78, cz + cd * 0.32);
      world.addCollider(cx, cz, cw * 0.9, cd * 0.9, ch * 1.15, 0.1);
    }
  }

  // 5. >= 140 Rochas Costeiras Quebra-Mar com Espuma Marinha ao redor de PRISON_ISLAND_POLYGON
  const dockCenterZ = 1550 + dzOff;
  for (let i = 0; i < PRISON_ISLAND_POLYGON.length; i++) {
    const [ax, az] = PRISON_ISLAND_POLYGON[i];
    const [bx, bz] = PRISON_ISLAND_POLYGON[(i + 1) % PRISON_ISLAND_POLYGON.length];
    for (const t of [0.16, 0.5, 0.84]) {
      const rx = ax + (bx - ax) * t, rz = az + (bz - az) * t;
      if (Math.abs(rx - bridgeAxisX) < 48 && rz < ws(1168)) continue;
      if (rx < ws(972) && Math.abs(rz - dockCenterZ) < 72) continue;
      const seed = i * 3 + Math.round(t * 3);
      const rw = 16 + ((seed * 7) % 15), rh = 3.5 + ((seed * 13) % 6.5), rd = 15 + ((seed * 11) % 13);
      batcher.addBox('coastal_rock', rw, rh, rd, rx, rh * 0.35 - 0.5, rz);
      batcher.addBox('sea_foam', rw + 4.0, 0.16, rd + 4.0, rx, -0.36, rz);
      world.addCollider(rx, rz, rw, rd, rh * 0.85 - 0.5, -1.5);
      world.prisonIslandData.coastalRocksCount++;
    }
  }
}

export function buildPrisonIslandPerimeterWallsAndCoastGuardDock(world, batcher) {
  const ox = PRISON_OFFSET_X;
  const oz = PRISON_OFFSET_Z;
  const dxOff = PRISON_DOCK_OFFSET_X;
  const dzOff = PRISON_DOCK_OFFSET_Z;

  if (!IS_SCALED_WORLD) {
    const ix = 1375, iz = 1550, islandW = 840, islandD = 860;
    batcher.addBox('coastal_rock', islandW + 32, 2.4, islandD + 32, ix, -0.85, iz);
    batcher.addBox('yard_concrete', islandW, 1.1, islandD, ix, -0.25, iz);
    world.addCollider(ix, iz, islandW, islandD, 0.3, -2.5);
    world.mapBlocks.push({ x: ix, z: iz, w: islandW, d: islandD, color: '#334155' });

    for (let rx = 940; rx <= 1810; rx += 26) {
      for (const rz of [1104, 1994]) {
        if (rz === 1104 && Math.abs(rx - ix) < 36) continue;
        const rw = 18 + ((rx * 7) % 14), rh = 3.6 + ((rx * 13) % 6), rd = 16 + ((rx * 11) % 12);
        batcher.addBox('coastal_rock', rw, rh, rd, rx, rh * 0.35 - 0.5, rz);
        batcher.addBox('sea_foam', rw + 4.0, 0.16, rd + 4.0, rx, -0.36, rz);
        world.prisonIslandData.coastalRocksCount++;
      }
    }
    for (let rz = 1125; rz <= 1975; rz += 26) {
      for (const rx of [940, 1810]) {
        if (rx === 940 && rz >= 1495 && rz <= 1605) continue;
        const rw = 16 + ((rz * 9) % 12), rh = 3.8 + ((rz * 17) % 6), rd = 18 + ((rz * 7) % 14);
        batcher.addBox('coastal_rock', rw, rh, rd, rx, rh * 0.35 - 0.5, rz);
        batcher.addBox('sea_foam', rw + 4.0, 0.16, rd + 4.0, rx, -0.36, rz);
        world.prisonIslandData.coastalRocksCount++;
      }
    }
  } else {
    _buildScaledNaturalPrisonIslandTerrain(world, batcher, ox, oz, dxOff, dzOff);
  }

  // ==========================================================================
  // DOCA NAVAL DA GUARDA COSTEIRA (CONJUNTO RÍGIDO 1X EM wsP(928, 1550))
  // ==========================================================================
  const dockX = 928 + dxOff;
  const dockZ = 1550 + dzOff;
  const dockW = 136;
  const dockD = 90;
  batcher.addBox('gunmetal_concrete', dockW, 2.2, dockD, dockX, -0.82, dockZ);
  batcher.addBox('armor_slate', dockW - 4, 0.16, dockD - 4, dockX, 0.32, dockZ);
  world.addCollider(dockX, dockZ, dockW, dockD, 0.3, -2.5);
  world.mapBlocks.push({ x: dockX, z: dockZ, w: dockW, d: dockD, color: '#1e293b' });

  batcher.addBox('alert_yellow', 2.4, 0.12, dockD - 2, 862.5 + dxOff, 0.41, dockZ);
  for (let dzBase = 1512; dzBase <= 1588; dzBase += 12) {
    const dz = dzBase + dzOff;
    batcher.addBox('matte_black', 2.5, 0.14, 4.5, 862.5 + dxOff, 0.42, dz);
    batcher.addBox('matte_black', 1.4, 1.8, 3.2, 859.6 + dxOff, -0.2, dz);
    batcher.addCylinder('dark_steel', 0.55, 0.72, 1.3, 864.8 + dxOff, 0.95, dz, 8);
  }

  for (const pierZBase of [1516, 1550, 1584]) {
    const pierZ = pierZBase + dzOff;
    batcher.addBox('gunmetal_concrete', 24, 1.4, 4.8, 848 + dxOff, -0.35, pierZ);
    batcher.addBox('alert_yellow', 24.2, 0.18, 5.0, 848 + dxOff, 0.42, pierZ);
    world.addCollider(848 + dxOff, pierZ, 24, 4.8, 0.3, -1.5);
  }

  batcher.addBox('alert_yellow', 10, 4.5, 10, 885 + dxOff, 2.5, 1518 + dzOff);
  batcher.addBox('dark_steel', 4.5, 34.0, 4.5, 885 + dxOff, 19.5, 1518 + dzOff);
  batcher.addBox('alert_yellow', 32.0, 3.2, 3.2, 874 + dxOff, 35.5, 1518 + dzOff);
  batcher.addCable('matte_black', 0.32, 862 + dxOff, 34.0, 1518 + dzOff, 862 + dxOff, 10.0, 1518 + dzOff);
  batcher.addBox('police_blue', 6.5, 3.8, 4.2, 862 + dxOff, 8.2, 1518 + dzOff);
  world.addCollider(885 + dxOff, 1518 + dzOff, 10, 10, 38, 0.28);

  for (let cxBase = 905; cxBase <= 955; cxBase += 16) {
    const cx = cxBase + dxOff;
    batcher.addBox('police_blue', 8.5, 4.2, 5.5, cx, 2.4, 1520 + dzOff);
    batcher.addBox('alert_yellow', 8.7, 0.45, 5.7, cx, 4.55, 1520 + dzOff);
    batcher.addBox('gunmetal_concrete', 7.5, 3.6, 5.0, cx, 2.1, 1580 + dzOff);
    world.addCollider(cx, 1520 + dzOff, 8.5, 5.5, 4.6, 0.28);
    world.addCollider(cx, 1580 + dzOff, 7.5, 5.0, 3.8, 0.28);
  }
  addBatchedLegoPerson(batcher, 872 + dxOff, 0.42, 1535 + dzOff, -Math.PI / 2, 'bope_guard', 'stand');
  addBatchedLegoPerson(batcher, 872 + dxOff, 0.42, 1565 + dzOff, -Math.PI / 2, 'warden_police', 'stand');
  addBatchedLegoPerson(batcher, 945 + dxOff, 0.42, 1550 + dzOff, 0, 'bope_guard', 'stand');
  world.prisonIslandData.guardsCount += 3;

  if (IS_SCALED_WORLD) {
    const dockEastX = dockX + dockW * 0.5;
    const islandWestX = ws(954);
    const abutmentSpan = Math.max(8, islandWestX - dockEastX + 24);
    const abutmentCX = dockEastX + abutmentSpan * 0.5 - 4;
    batcher.addBox('gunmetal_concrete', abutmentSpan, 2.2, dockD + 16, abutmentCX, -0.82, dockZ);
    batcher.addBox('armor_slate', abutmentSpan, 0.16, dockD + 12, abutmentCX, 0.32, dockZ);
    world.addCollider(abutmentCX, dockZ, abutmentSpan, dockD + 16, 0.3, -2.5);
    world.elevatedDecks.push({
      id: 'prison_west_naval_dock', minX: 836 + dxOff, maxX: islandWestX + 12,
      minZ: dockZ - dockD * 0.5 - 8, maxZ: dockZ + dockD * 0.5 + 8, topY: 0.3, thresholdBelow: 2.5,
      getDeckY: () => 0.3, getTopY: () => 0.3
    });
  }

  // ==========================================================================
  // MURALHA PERIMETRAL COLOSSAL (H = 40m, 760m x 810m EM ESCALA RÍGIDA 1X!)
  // ==========================================================================
  const ix = 1375 + ox, wallH = 40, wallThick = 14;
  const minX = 995 + ox, maxX = 1755 + ox, minZ = 1125 + oz, maxZ = 1935 + oz;
  const spanX = maxX - minX, spanZ = maxZ - minZ;

  _buildFortifiedWallSegment(world, batcher, ix, maxZ, spanX, wallThick, wallH, true);
  _buildFortifiedWallSegment(world, batcher, maxX, (minZ + maxZ) * 0.5, wallThick, spanZ, wallH, false);

  const westGateZ = 1550 + oz;
  _buildFortifiedWallSegment(world, batcher, minX, 1325 + oz, wallThick, 400, wallH, false);
  _buildFortifiedWallSegment(world, batcher, minX, 1755 + oz, wallThick, 360, wallH, false);
  batcher.addBox('gunmetal_concrete', 16, 22, 54, minX, 29.3, westGateZ);
  batcher.addBox('alert_yellow', 17, 1.0, 55, minX, 18.2, westGateZ);
  addPrisonBannerSign(world, minX - 8.5, 26.0, westGateZ, 42.0, 5.0, 'DOCA NAVAL — GUARDA COSTEIRA', 'ACESSO MARÍTIMO BLINDADO • BOPE / POLÍCIA FEDERAL', -Math.PI / 2);

  _buildFortifiedWallSegment(world, batcher, 1161 + ox, minZ, 332, wallThick, wallH, true);
  _buildFortifiedWallSegment(world, batcher, 1589 + ox, minZ, 332, wallThick, wallH, true);

  batcher.addBox('gunmetal_concrete', 96, 24, 16, ix, 30.3, minZ);
  batcher.addBox('bope_black', 98, 4.2, 17.5, ix, 41.2, minZ);
  batcher.addBox('alert_yellow', 98.5, 0.9, 18.0, ix, 18.6, minZ);
  batcher.addBox('alert_yellow', 98.5, 0.9, 18.0, ix, 43.0, minZ);

  for (const side of [-1, 1]) {
    const pillarX = ix + side * 22;
    batcher.addBox('dark_steel', 16, 18.5, 15, pillarX, 9.5, minZ);
    world.addCollider(pillarX, minZ, 16, 15, 42, 0.28);
    for (let bar = 0; bar < 5; bar++) {
      batcher.addCylinder('brushed_silver', 0.28, 0.28, 18.0, ix + side * (12.8 + bar * 1.1), 9.3, minZ, 8);
    }
  }
  for (let gx = ix - 12; gx <= ix + 12; gx += 2.4) {
    batcher.addCylinder('brushed_silver', 0.26, 0.26, 9.5, gx, 23.5, minZ, 8);
  }

  addPrisonBannerSign(world, ix, 32.5, minZ - 8.4, 68.0, 7.2, 'PENITENCIÁRIA DE SEGURANÇA MÁXIMA', 'COMPLEXO FEDERAL "A BALSA" — FORÇA TÁTICA / BOPE', 0, '#ef4444', '#facc15');
  addPrisonBannerSign(world, ix, 32.5, minZ + 8.4, 58.0, 6.2, 'SAÍDA CONTROLADA — PONTE BLINDADA', 'PORTÃO DUPLO DE CONTENÇÃO (SALLIE PORT)', Math.PI, '#facc15', '#facc15');

  const watchtowerCoords = [
    { x: minX, z: minZ, label: 'TORRE DE VIGIA NOROESTE' },
    { x: maxX, z: minZ, label: 'TORRE DE VIGIA NORDESTE' },
    { x: minX, z: maxZ, label: 'TORRE DE VIGIA SUDOESTE' },
    { x: maxX, z: maxZ, label: 'TORRE DE VIGIA SUDESTE' },
    { x: ix - 46, z: minZ, label: 'TORRE DO PORTÃO OESTE' },
    { x: ix + 46, z: minZ, label: 'TORRE DO PORTÃO LESTE' },
    { x: minX, z: 1515 + oz, label: 'TORRE DE VIGIA DOCA NAVAL' },
    { x: maxX, z: 1540 + oz, label: 'TORRE DE VIGIA LESTE' }
  ];

  for (const wt of watchtowerCoords) {
    _buildGiantWatchtower(world, batcher, wt.x, wt.z, 68, wt.label);
  }
}

function _buildFortifiedWallSegment(world, batcher, x, z, w, d, h, isHorizontal) {
  batcher.addBox('gunmetal_concrete', w, h, d, x, 0.28 + h * 0.5, z);
  batcher.addBox('armor_slate', w + 2.4, 1.2, d + 2.4, x, 0.28 + h + 0.6, z);
  if (isHorizontal) {
    batcher.addBox('chainlink_mesh', w, 3.8, 0.35, x, 0.28 + h + 3.1, z - d * 0.5 - 0.8);
    batcher.addBox('chainlink_mesh', w, 3.8, 0.35, x, 0.28 + h + 3.1, z + d * 0.5 + 0.8);
    for (let xx = x - w * 0.5 + 20; xx <= x + w * 0.5 - 20; xx += 36) {
      batcher.addBox('dark_steel', 4.4, h - 2, d + 3.2, xx, 0.28 + (h - 2) * 0.5, z);
      batcher.addBox('alert_yellow', 14.0, 2.2, d + 0.8, xx, 1.4, z);
    }
  } else {
    batcher.addBox('chainlink_mesh', 0.35, 3.8, d, x - w * 0.5 - 0.8, 0.28 + h + 3.1, z);
    batcher.addBox('chainlink_mesh', 0.35, 3.8, d, x + w * 0.5 + 0.8, 0.28 + h + 3.1, z);
    for (let zz = z - d * 0.5 + 20; zz <= z + d * 0.5 - 20; zz += 36) {
      batcher.addBox('dark_steel', w + 3.2, h - 2, 4.4, x, 0.28 + (h - 2) * 0.5, zz);
      batcher.addBox('alert_yellow', w + 0.8, 2.2, 14.0, x, 1.4, zz);
    }
  }
  world.addCollider(x, z, w, d, h + 2, 0.28);
}

function _buildGiantWatchtower(world, batcher, x, z, h, label) {
  batcher.addBox('bope_black', 22, 18, 22, x, 9.2, z);
  batcher.addBox('dark_steel', 16, h - 14, 16, x, 0.28 + (h - 14) * 0.5, z);
  for (const bandY of [18, 34, 50]) {
    batcher.addBox('alert_yellow', 17.2, 1.8, 17.2, x, bandY, z);
  }
  const deckY = h - 12;
  batcher.addBox('gunmetal_concrete', 25, 2.2, 25, x, deckY, z);
  batcher.addBox('alert_yellow', 25.6, 0.65, 25.6, x, deckY + 1.2, z);
  batcher.addCylinder('bope_black', 10.5, 10.5, 8.5, x, deckY + 5.2, z, 8);
  batcher.addCylinder('smoked_glass', 10.8, 10.8, 4.2, x, deckY + 5.6, z, 8);
  batcher.addCylinder('dark_steel', 12.2, 12.2, 1.8, x, deckY + 9.8, z, 8);
  batcher.addCylinder('brushed_silver', 0.35, 0.5, 6.5, x, h + 1.5, z, 8);
  batcher.addBox('siren_red', 1.6, 1.6, 1.6, x, h + 5.0, z);
  batcher.addBox('searchlight_white', 2.6, 1.8, 2.6, x, deckY + 2.4, z);
  const dirX = x < PRISON_COMPOUND_ORIGIN.x ? 1 : -1;
  const dirZ = z < PRISON_COMPOUND_ORIGIN.z ? 1 : -1;
  batcher.addCylinder(
    'searchlight_beam',
    1.2,
    8.5,
    28.0,
    x + dirX * 8,
    deckY - 10,
    z + dirZ * 8,
    10,
    dirZ * 0.45,
    -dirX * 0.45
  );
  addBatchedLegoPerson(batcher, x + dirX * 9.2, deckY + 1.2, z, dirX > 0 ? Math.PI / 2 : -Math.PI / 2, 'bope_guard', 'stand');
  world.prisonIslandData.guardsCount++;
  world.prisonIslandData.watchtowersCount++;
  world.addCollider(x, z, 22, 22, h, 0.28);
  world.mapBuildings.push({ x, z, w: 22, d: 22, height: h, color: '#0f172a', label });
}

export function buildCitadelRooftopHelipadsAndRadar(batcher, cx, cz, roofY) {
  batcher.addBox('armor_slate', 90, 0.5, 90, cx, roofY, cz);

  for (const heliX of [cx - 23, cx + 23]) {
    batcher.addCylinder('matte_black', 17.5, 17.5, 0.36, heliX, roofY + 0.32, cz, 24);
    batcher.addCylinder('alert_yellow', 15.8, 15.8, 0.38, heliX, roofY + 0.34, cz, 24);
    batcher.addCylinder('matte_black', 14.2, 14.2, 0.4, heliX, roofY + 0.36, cz, 24);
    batcher.addBox('tactical_white', 2.0, 0.12, 12.0, heliX - 4.0, roofY + 0.46, cz);
    batcher.addBox('tactical_white', 2.0, 0.12, 12.0, heliX + 4.0, roofY + 0.46, cz);
    batcher.addBox('tactical_white', 8.0, 0.12, 2.0, heliX, roofY + 0.46, cz);
  }

  batcher.addBox('dark_steel', 18, 8.5, 12, cx, roofY + 4.2, cz - 34);
  batcher.addCylinder('brushed_silver', 0.8, 1.1, 12.0, cx, roofY + 14.0, cz - 34, 8);
  batcher.addBox('alert_yellow', 12.0, 2.2, 1.4, cx, roofY + 19.5, cz - 34);
  batcher.addBox('siren_red', 1.8, 1.8, 1.8, cx - 7, roofY + 9.2, cz - 34);
  batcher.addBox('siren_blue', 1.8, 1.8, 1.8, cx + 7, roofY + 9.2, cz - 34);
  for (const antX of [cx - 32, cx + 32]) {
    batcher.addCylinder('brushed_silver', 0.35, 0.65, 15.0, antX, roofY + 7.5, cz + 34, 8);
    batcher.addBox('siren_red', 1.4, 1.4, 1.4, antX, roofY + 15.5, cz + 34);
  }
}

export function buildFourInternalCourtyardSectors(world, batcher) {
  const ox = PRISON_OFFSET_X;
  const oz = PRISON_OFFSET_Z;
  const aveX = 1375 + ox;
  const aveZ = 1305 + oz;

  batcher.addBox('matte_black', 42, 0.14, 360, aveX, 0.34, aveZ);
  batcher.addBox('alert_yellow', 0.45, 0.06, 350, aveX - 0.6, 0.41, aveZ);
  batcher.addBox('alert_yellow', 0.45, 0.06, 350, aveX + 0.6, 0.41, aveZ);
  world.mapRoads.push({ x: aveX, z: aveZ, w: 42, d: 360, isMain: true });

  const catwalks = [
    [1315 + ox, 1525 + oz, 6.0, 420, false],
    [1240 + ox, 1310 + oz, 150, 6.0, true],
    [1240 + ox, 1525 + oz, 150, 6.0, true],
    [1240 + ox, 1740 + oz, 150, 6.0, true],
    [1435 + ox, 1465 + oz, 6.0, 360, false],
    [1515 + ox, 1388 + oz, 160, 6.0, true]
  ];
  for (const [cwX, cwZ, cwW, cwD, isHoriz] of catwalks) {
    world.prisonIslandData.elevatedGuardCatwalksCount++;
    batcher.addBox('dark_steel', cwW, 0.8, cwD, cwX, 9.5, cwZ);
    batcher.addBox('alert_yellow', cwW + 0.4, 0.25, cwD + 0.4, cwX, 9.9, cwZ);
    batcher.addBox('chainlink_mesh', isHoriz ? cwW : 0.35, 8.8, isHoriz ? 0.35 : cwD, cwX - (isHoriz ? 0 : 1.8), 4.7, cwZ - (isHoriz ? 1.8 : 0));
    batcher.addBox('chainlink_mesh', isHoriz ? cwW : 0.35, 8.8, isHoriz ? 0.35 : cwD, cwX + (isHoriz ? 0 : 1.8), 4.7, cwZ + (isHoriz ? 1.8 : 0));
    addBatchedLegoPerson(batcher, cwX, 10.0, cwZ, isHoriz ? 0 : -Math.PI / 2, 'bope_guard', 'stand');
    addBatchedLegoPerson(
      batcher,
      cwX + (isHoriz ? 28 : 0),
      10.0,
      cwZ + (isHoriz ? 0 : 35),
      isHoriz ? Math.PI : -Math.PI / 2,
      'warden_police',
      'stand'
    );
    world.prisonIslandData.guardsCount += 2;
  }

  const futX = 1235 + ox, futZ = 1375 + oz;
  batcher.addBox('futsal_green', 62, 0.14, 82, futX, 0.34, futZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ - 39);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ + 39);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, futX - 29, 0.42, futZ);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, futX + 29, 0.42, futZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, futX, 0.42, futZ);
  batcher.addCylinder('tactical_white', 7.0, 7.0, 0.06, futX, 0.42, futZ, 16);
  for (const dir of [-1, 1]) {
    const goalZ = futZ + dir * 38.5;
    batcher.addBox('tactical_white', 11.0, 0.38, 0.38, futX, 3.6, goalZ);
    batcher.addBox('tactical_white', 0.38, 3.4, 0.38, futX - 5.3, 1.98, goalZ);
    batcher.addBox('tactical_white', 0.38, 3.4, 0.38, futX + 5.3, 1.98, goalZ);
  }
  for (let step = 0; step < 4; step++) {
    batcher.addBox('gunmetal_concrete', 3.2, (step + 1) * 1.1, 72, 1274 + ox + step * 3.2, 0.28 + (step + 1) * 0.55, futZ);
  }

  const bskX = 1235 + ox, bskZ = 1472 + oz;
  batcher.addBox('court_blue', 62, 0.14, 82, bskX, 0.34, bskZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ - 39);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ + 39);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, bskX - 29, 0.42, bskZ);
  batcher.addBox('tactical_white', 0.65, 0.06, 78, bskX + 29, 0.42, bskZ);
  batcher.addBox('tactical_white', 58, 0.06, 0.65, bskX, 0.42, bskZ);
  for (const dir of [-1, 1]) {
    const hoopZ = bskZ + dir * 37.5;
    batcher.addBox('prison_orange', 14, 0.06, 15, bskX, 0.41, bskZ + dir * 31);
    batcher.addCylinder('dark_steel', 0.35, 0.42, 6.8, bskX, 3.68, hoopZ + dir * 2.0, 8);
    batcher.addBox('tactical_white', 4.8, 3.2, 0.35, bskX, 6.4, hoopZ + dir * 0.5);
    batcher.addBox('prison_orange', 1.6, 0.24, 1.6, bskX, 5.4, hoopZ - dir * 0.3);
  }
  for (let step = 0; step < 4; step++) {
    batcher.addBox('gunmetal_concrete', 3.2, (step + 1) * 1.1, 72, 1274 + ox + step * 3.2, 0.28 + (step + 1) * 0.55, bskZ);
  }

  const sportsInmates = [
    [futX - 10, futZ - 18, 0, 'prisoner_orange'], [futX + 12, futZ - 12, 0.6, 'prisoner_cv'],
    [futX - 6, futZ + 8, -0.5, 'prisoner_pcc'], [futX + 14, futZ + 20, 2.4, 'prisoner_orange'],
    [futX, futZ - 34, 0, 'prisoner_orange'], [futX, futZ + 34, Math.PI, 'prisoner_cv'],
    [bskX - 12, bskZ - 16, 0.4, 'prisoner_orange'], [bskX + 10, bskZ - 8, -0.8, 'prisoner_pcc'],
    [bskX - 8, bskZ + 14, 1.8, 'prisoner_cv'], [bskX + 12, bskZ + 22, -2.2, 'prisoner_orange'],
    [1277 + ox, futZ - 15, -Math.PI / 2, 'prisoner_orange'], [1277 + ox, futZ + 15, -Math.PI / 2, 'prisoner_cv'],
    [1277 + ox, bskZ - 15, -Math.PI / 2, 'prisoner_pcc'], [1277 + ox, bskZ + 15, -Math.PI / 2, 'prisoner_orange']
  ];
  for (const [px, pz, rot, preset] of sportsInmates) {
    addBatchedLegoPerson(batcher, px, 0.42, pz, rot, preset, 'stand');
    if (preset === 'prisoner_cv') world.prisonIslandData.cvPrisonersCount++;
    else if (preset === 'prisoner_pcc') world.prisonIslandData.pccPrisonersCount++;
    else world.prisonIslandData.orangePrisonersCount++;
  }

  const gymX = 1235 + ox, gymZ = 1585 + oz;
  batcher.addBox('matte_black', 92, 0.14, 78, gymX, 0.34, gymZ);
  batcher.addBox('alert_yellow', 92.5, 0.08, 1.2, gymX, 0.38, gymZ - 38.5);
  batcher.addBox('alert_yellow', 92.5, 0.08, 1.2, gymX, 0.38, gymZ + 38.5);
  batcher.addBox('dark_steel', 24.0, 4.4, 5.0, gymX, 2.5, gymZ);

  for (let row = -1; row <= 1; row += 2) {
    for (let col = -2.5; col <= 2.5; col += 1) {
      const bx = gymX + col * 13.5, bz = gymZ + row * 18.0;
      world.prisonIslandData.weightBenchesCount++;
      batcher.addBox('dark_steel', 1.5, 0.75, 4.2, bx, 0.75, bz);
      batcher.addBox('prison_orange', 1.6, 0.25, 4.0, bx, 1.22, bz);
      batcher.addBox('brushed_silver', 2.4, 2.2, 0.35, bx, 1.45, bz - 1.5);
      batcher.addBox('brushed_silver', 4.4, 0.22, 0.22, bx, 2.35, bz - 1.5);
      for (const side of [-1, 1]) {
        batcher.addCylinder('bope_black', 0.75, 0.75, 0.32, bx + side * 1.65, 2.35, bz - 1.5, 8, 0, Math.PI / 2);
      }
      const preset = col < 0 ? 'prisoner_cv' : 'prisoner_orange';
      addBatchedLegoPerson(batcher, bx, 0.42, bz + 2.8, 0, preset, 'bench_press');
      if (preset === 'prisoner_cv') world.prisonIslandData.cvPrisonersCount++;
      else world.prisonIslandData.orangePrisonersCount++;
    }
  }

  const cafeX = 1235 + ox, cafeZ = 1685 + oz;
  batcher.addBox('armor_slate', 92, 0.16, 82, cafeX, 0.35, cafeZ);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const tx = cafeX - 32 + c * 16, tz = cafeZ - 26 + r * 17;
      world.prisonIslandData.cafeteriaTablesCount++;
      batcher.addBox('brushed_silver', 4.8, 1.15, 2.2, tx, 0.92, tz);
      batcher.addBox('gunmetal_concrete', 4.8, 0.68, 0.9, tx, 0.68, tz - 1.9);
      batcher.addBox('gunmetal_concrete', 4.8, 0.68, 0.9, tx, 0.68, tz + 1.9);
      if ((r + c) % 2 === 0) {
        addBatchedLegoPerson(batcher, tx - 1.2, 0.42, tz - 2.6, 0, 'prisoner_orange', 'stand');
        addBatchedLegoPerson(batcher, tx + 1.2, 0.42, tz + 2.6, Math.PI, 'prisoner_pcc', 'stand');
        world.prisonIslandData.orangePrisonersCount++;
        world.prisonIslandData.pccPrisonersCount++;
      }
    }
  }

  const garX = 1515 + ox, garZ = 1330 + oz;
  batcher.addBox('matte_black', 148, 0.14, 92, garX, 0.34, garZ);
  for (let vxBase = 1445; vxBase <= 1585; vxBase += 18) {
    const vx = vxBase + ox;
    batcher.addBox('alert_yellow', 0.45, 0.06, 22.0, vx, 0.41, 1315 + oz);
    batcher.addBox('alert_yellow', 0.45, 0.06, 22.0, vx, 0.41, 1355 + oz);
  }
  for (const [bx, bz, rotY] of [
    [1454 + ox, 1355 + oz, Math.PI],
    [1478 + ox, 1355 + oz, Math.PI],
    [1502 + ox, 1355 + oz, Math.PI],
    [1526 + ox, 1355 + oz, Math.PI]
  ]) {
    _addArmoredPrisonTransportBus(world, batcher, bx, bz, rotY);
  }
  const maintX = 1568 + ox, maintZ = 1330 + oz;
  batcher.addBox('bope_black', 34, 22, 76, maintX, 11.28, maintZ);
  batcher.addBox('alert_yellow', 35, 0.9, 77, maintX, 22.2, maintZ);
  world.addCollider(maintX, maintZ, 34, 76, 23, 0.28);

  const subX = 1515 + ox, subZ = 1465 + oz;
  batcher.addBox('gunmetal_concrete', 146, 0.22, 116, subX, 0.36, subZ);
  batcher.addBox('alert_yellow', 146, 2.2, 1.6, subX, 1.38, subZ - 57);
  batcher.addBox('alert_yellow', 146, 2.2, 1.6, subX, 1.38, subZ + 57);

  for (let txBase = 1456; txBase <= 1556; txBase += 20) {
    const tx = txBase + ox;
    world.prisonIslandData.substationTransformersCount++;
    batcher.addBox('armor_slate', 10.5, 11.0, 12.0, tx, 5.8, subZ - 26);
    batcher.addBox('dark_steel', 11.5, 8.5, 13.0, tx, 5.5, subZ - 26);
    batcher.addBox('alert_yellow', 11.6, 0.65, 13.2, tx, 11.2, subZ - 26);
    for (const bxOff of [-3, 0, 3]) {
      batcher.addCylinder('brushed_silver', 0.45, 0.65, 4.5, tx + bxOff, 13.5, subZ - 26, 8);
      batcher.addCylinder('laser_cyan', 0.55, 0.55, 0.8, tx + bxOff, 15.8, subZ - 26, 8);
      world.prisonIslandData.powerCoilsCount++;
    }
    world.addCollider(tx, subZ - 26, 11.5, 13.0, 14, 0.28);
  }

  for (let gxBase = 1456; gxBase <= 1556; gxBase += 20) {
    const gx = gxBase + ox;
    world.prisonIslandData.dieselGeneratorsCount++;
    batcher.addBox('bope_black', 11.0, 7.2, 16.0, gx, 3.9, subZ + 18);
    batcher.addBox('alert_yellow', 11.4, 1.2, 16.4, gx, 3.8, subZ + 18);
    batcher.addCylinder('brushed_silver', 0.55, 0.55, 5.0, gx - 2.5, 9.5, subZ + 14, 8);
    batcher.addCylinder('brushed_silver', 0.55, 0.55, 5.0, gx + 2.5, 9.5, subZ + 14, 8);
    world.addCollider(gx, subZ + 18, 11.0, 16.0, 8.5, 0.28);
  }

  for (const [ptX, ptZ] of [
    [1452 + ox, subZ - 46],
    [1576 + ox, subZ - 46],
    [1452 + ox, subZ + 46],
    [1576 + ox, subZ + 46]
  ]) {
    world.prisonIslandData.powerTowersCount++;
    batcher.addBox('dark_steel', 5.2, 42.0, 5.2, ptX, 21.28, ptZ);
    batcher.addBox('alert_yellow', 16.0, 1.4, 2.2, ptX, 32.0, ptZ);
    batcher.addBox('alert_yellow', 12.0, 1.4, 2.2, ptX, 39.5, ptZ);
    batcher.addBox('laser_cyan', 1.2, 1.8, 1.2, ptX - 7.2, 31.0, ptZ);
    batcher.addBox('laser_cyan', 1.2, 1.8, 1.2, ptX + 7.2, 31.0, ptZ);
    world.addCollider(ptX, ptZ, 5.5, 5.5, 42, 0.28);
  }

  const wtZ = 1608 + oz;
  for (const wtXBase of [1462, 1498, 1534, 1570]) {
    const wtX = wtXBase + ox;
    world.prisonIslandData.waterTowersCount++;
    batcher.addCylinder('dark_steel', 6.5, 7.2, 14.0, wtX, 7.28, wtZ, 12);
    batcher.addCylinder('bope_black', 8.2, 8.2, 22.0, wtX, 24.5, wtZ, 16);
    batcher.addCylinder('alert_yellow', 8.4, 8.4, 2.6, wtX, 24.5, wtZ, 16);
    batcher.addCylinder('alert_yellow', 8.4, 8.4, 1.8, wtX, 34.8, wtZ, 16);
    world.addCollider(wtX, wtZ, 16.5, 16.5, 36, 0.28);
  }
}

function _addArmoredPrisonTransportBus(world, batcher, x, z, rotY = 0) {
  world.prisonIslandData.armoredPrisonBusesCount++;
  batcher.addBox('matte_black', 4.6, 1.2, 16.2, x, 0.9, z, 0, rotY, 0);
  batcher.addBox('gunmetal_concrete', 4.8, 3.4, 15.8, x, 3.0, z, 0, rotY, 0);
  batcher.addBox('bope_black', 4.95, 0.9, 16.0, x, 2.3, z, 0, rotY, 0);
  batcher.addBox('alert_yellow', 5.0, 0.35, 16.1, x, 1.8, z, 0, rotY, 0);
  batcher.addBox('smoked_glass', 4.2, 1.2, 1.2, x, 3.3, z + 7.5, 0, rotY, 0);
  batcher.addBox('brushed_silver', 4.9, 0.95, 11.5, x, 3.55, z - 0.8, 0, rotY, 0);
  batcher.addBox('siren_red', 1.4, 0.45, 0.8, x - 1.1, 4.9, z + 5.5, 0, rotY, 0);
  batcher.addBox('siren_blue', 1.4, 0.45, 0.8, x + 1.1, 4.9, z + 5.5, 0, rotY, 0);
  world.addCollider(x, z, 5.0, 16.4, 5.0, 0.28);
}
