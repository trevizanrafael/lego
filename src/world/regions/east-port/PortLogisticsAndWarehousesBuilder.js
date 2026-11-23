import * as THREE from 'three';
import { IS_SCALED_WORLD, ws } from '../../core/WorldLayoutScale.js';
import { TERRITORY_ZONES } from '../../factions/TerritoryZonesAndConfigs.js';
import { addCorrugatedContainerStack } from './EastPortBatcherAndMaterials.js';
import { addPortCargoSemiTruck } from './CargoShipsAndDocksBuilder.js';

function _addSegmentedBoxX(batcher, key, totalW, h, d, cx, y, z, maxSeg = 520) {
  if (totalW <= maxSeg) {
    batcher.addBox(key, totalW, h, d, cx, y, z);
    return;
  }
  const n = Math.ceil(totalW / maxSeg), sw = totalW / n, x0 = cx - totalW * 0.5;
  for (let i = 0; i < n; i++) batcher.addBox(key, sw + 0.05, h, d, x0 + (i + 0.5) * sw, y, z);
}

function _addSegmentedBoxZ(batcher, key, w, h, totalD, x, y, cz, maxSeg = 520) {
  if (totalD <= maxSeg) {
    batcher.addBox(key, w, h, totalD, x, y, cz);
    return;
  }
  const n = Math.ceil(totalD / maxSeg), sd = totalD / n, z0 = cz - totalD * 0.5;
  for (let i = 0; i < n; i++) batcher.addBox(key, w, h, sd + 0.05, x, y, z0 + (i + 0.5) * sd);
}

/**
 * 1. Constrói as Avenidas Logísticas Asfaltadas, 4 Rotatórias de Caminhões, 10 Pátios de Carga Demarcados,
 * Cercas de Tela Metálica, 6 Portarias de Doca, Bordas Zebradas, Cabeços, Defensas e 16 Torres Altas de Refletores (48m)
 */
export function buildPortLogisticsRoadNetworkAndQuay(world, batcher) {
  const sectors = [
    { x: 718, z: 235, w: 184, d: 166, mat: 'gunmetal_concrete', mapColor: '#1e293b' },
    { x: 718, z: 435, w: 184, d: 166, mat: 'armor_slate', mapColor: '#334155' },
    { x: 718, z: 622, w: 184, d: 138, mat: 'gunmetal_concrete', mapColor: '#1e293b' },
    { x: 992, z: 235, w: 286, d: 166, mat: 'armor_slate', mapColor: '#334155' },
    { x: 1265, z: 235, w: 172, d: 166, mat: 'gunmetal_concrete', mapColor: '#1e293b' },
    { x: 992, z: 435, w: 286, d: 166, mat: 'gunmetal_concrete', mapColor: '#1e293b' },
    { x: 1265, z: 435, w: 172, d: 166, mat: 'armor_slate', mapColor: '#334155' },
    { x: 995, z: 625, w: 286, d: 142, mat: 'matte_black', mapColor: '#0f172a' },
    { x: 1265, z: 625, w: 172, d: 142, mat: 'gunmetal_concrete', mapColor: '#1e293b' },
    { x: 1498, z: 425, w: 204, d: 616, mat: 'armor_slate', mapColor: '#334155' }
  ];

  for (const sec of sectors) {
    const sx = ws(sec.x), sz = ws(sec.z), sw = ws(sec.w), sd = ws(sec.d);
    _addSegmentedBoxZ(batcher, sec.mat, sw, 0.28, sd, sx, 0.14, sz, 600);
    world.mapBlocks.push({ x: sx, z: sz, w: sw, d: sd, color: sec.mapColor });
    _addSegmentedBoxX(batcher, 'forklift_yellow', sw - 4, 0.04, 0.65, sx, 0.29, sz - sd * 0.5 + 2.5, 600);
    _addSegmentedBoxX(batcher, 'forklift_yellow', sw - 4, 0.04, 0.65, sx, 0.29, sz + sd * 0.5 - 2.5, 600);
    _addSegmentedBoxZ(batcher, 'tactical_white', 0.65, 0.04, sd - 4, sx - sw * 0.5 + 2.5, 0.29, sz, 600);
    _addSegmentedBoxZ(batcher, 'tactical_white', 0.65, 0.04, sd - 4, sx + sw * 0.5 - 2.5, 0.29, sz, 600);
  }

  // Avenidas Logísticas Asfaltadas Leste-Oeste e Norte-Sul (fatiadas p/ culling preciso em chunks de 920m)
  const ewAvenuesZ = [134, 335, 535, 708].map(ws);
  const roadW = ws(1010), roadCX = ws(1100), arrowStartX = ws(660), arrowEndX = ws(1520), arrowStepX = ws(95);
  for (const az of ewAvenuesZ) {
    _addSegmentedBoxX(batcher, 'matte_black', roadW, 0.3, 28.0, roadCX, 0.15, az, 520);
    _addSegmentedBoxX(batcher, 'forklift_yellow', roadW - 16, 0.05, 0.45, roadCX, 0.31, az - 0.55, 520);
    _addSegmentedBoxX(batcher, 'forklift_yellow', roadW - 16, 0.05, 0.45, roadCX, 0.31, az + 0.55, 520);
    world.mapRoads.push({ x: roadCX, z: az, w: roadW, d: 28, isMain: true });

    for (let sx = arrowStartX; sx <= arrowEndX; sx += arrowStepX) {
      batcher.addBox('tactical_white', 5.5, 0.05, 0.55, sx, 0.31, az - 6.5);
      batcher.addBox('tactical_white', 1.8, 0.05, 1.8, sx + 2.8, 0.31, az - 6.5, 0, Math.PI / 4, 0);
      batcher.addBox('tactical_white', 5.5, 0.05, 0.55, sx, 0.31, az + 6.5);
      batcher.addBox('tactical_white', 1.8, 0.05, 1.8, sx - 2.8, 0.31, az + 6.5, 0, Math.PI / 4, 0);
    }
  }

  const nsAvenuesX = [600, 825, 1158, 1375, 1545].map(ws);
  const bridgeAveX = ws(1375), nsBaseD = ws(610), nsLineD = ws(600), nsBaseZ = ws(425.0);
  for (const ax of nsAvenuesX) {
    const isBridgeAve = ax === bridgeAveX;
    const w = isBridgeAve ? 34.0 : 28.0;
    const roadD = IS_SCALED_WORLD && isBridgeAve ? nsBaseD + 14.0 : nsBaseD;
    const roadZ = IS_SCALED_WORLD && isBridgeAve ? nsBaseZ + 7.0 : nsBaseZ;
    _addSegmentedBoxZ(batcher, 'matte_black', w, 0.3, roadD, ax, 0.15, roadZ, 520);
    _addSegmentedBoxZ(batcher, 'forklift_yellow', 0.45, 0.05, nsLineD, ax - 0.55, 0.31, nsBaseZ, 520);
    _addSegmentedBoxZ(batcher, 'forklift_yellow', 0.45, 0.05, nsLineD, ax + 0.55, 0.31, nsBaseZ, 520);
    world.mapRoads.push({ x: ax, z: roadZ, w, d: roadD, isMain: true });
  }

  // 4 Rotatórias Logísticas de Caminhões nos cruzamentos principais (raio e altura ×1)
  const roundabouts = [
    [ws(825), ws(335)],
    [ws(1158), ws(335)],
    [ws(1375), ws(335)],
    [ws(1375), ws(535)]
  ];
  for (const [rx, rz] of roundabouts) {
    batcher.addCylinder('forklift_yellow', 7.2, 7.6, 0.42, rx, 0.36, rz, 12);
    batcher.addCylinder('gunmetal_concrete', 5.8, 5.8, 0.58, rx, 0.48, rz, 12);
    batcher.addCylinder('armor_slate', 0.55, 0.85, 18.0, rx, 9.2, rz, 8);
    batcher.addBox('floodlight_glow', 4.6, 0.9, 4.6, rx, 18.2, rz);
  }

  // 6 Portarias de Doca (Guaritas + Cancelas em tamanho ×1 encostadas nas avenidas sem bloquear faixas)
  const gatehouseCoords = IS_SCALED_WORLD
    ? [
        [ws(825) - 17, ws(200)], [ws(825) - 17, ws(435)], [ws(825) - 17, ws(595)],
        [ws(1158) - 18, ws(200)], [ws(1158) - 18, ws(435)], [ws(1158) - 18, ws(595)]
      ]
    : [
        [808, 200], [808, 400], [808, 595],
        [1140, 200], [1140, 400], [1140, 595]
      ];
  for (const [gx, gz] of gatehouseCoords) {
    batcher.addBox('pcc_navy', 5.2, 4.4, 5.8, gx, 2.48, gz);
    batcher.addBox('dark_steel', 5.4, 1.5, 4.2, gx, 3.1, gz);
    batcher.addBox('forklift_yellow', 5.8, 0.55, 6.2, gx, 4.8, gz);
    batcher.addBox('lego_red', 6.5, 0.24, 0.24, gx + 4.5, 1.65, gz + 3.4);
    batcher.addBox('tactical_white', 3.2, 0.26, 0.26, gx + 4.5, 1.65, gz + 3.4);
    world.addCollider(gx, gz, 5.2, 5.8, 5.0, 0.28);
  }

  // Parede vertical maciça do Cais à Beira-Mar Leste (X = ws(1619.2)) e Sul (Z = ws(734.2))
  const eastQuayX = ws(1619.2);
  const southQuayZ = ws(734.2);
  _addSegmentedBoxZ(batcher, 'gunmetal_concrete', 3.4, 2.6, ws(620), eastQuayX, -0.35, ws(425), 480);
  if (!IS_SCALED_WORLD) {
    batcher.addBox('gunmetal_concrete', 1020, 2.6, 3.4, 1110, -0.35, 734.2);
  } else {
    const qMinX = ws(600), qMaxX = ws(1620), gapMinX = bridgeAveX - 24.0, gapMaxX = bridgeAveX + 24.0;
    _addSegmentedBoxX(batcher, 'gunmetal_concrete', gapMinX - qMinX, 2.6, 3.4, (qMinX + gapMinX) * 0.5, -0.35, southQuayZ, 480);
    _addSegmentedBoxX(batcher, 'gunmetal_concrete', qMaxX - gapMaxX, 2.6, 3.4, (gapMaxX + qMaxX) * 0.5, -0.35, southQuayZ, 480);
  }

  // Faixas Zebradas Amarelas e Pretas de Segurança (props ×1, passo escalado para 60 FPS!)
  const zzStart = ws(122);
  const zzEnd = ws(728);
  const zzStep = ws(6);
  const eastZebraX = IS_SCALED_WORLD ? eastQuayX - 3.0 : 1616.2;
  for (let zz = zzStart; zz <= zzEnd; zz += zzStep) {
    const isYellow = Math.round((zz - zzStart) / zzStep) % 2 === 0;
    batcher.addBox(isYellow ? 'forklift_yellow' : 'matte_black', 3.6, 0.14, 6.0, eastZebraX, 0.31, zz);
    world.eastPortData.zebraStripesSegments++;
  }
  const xxStart = ws(610);
  const xxEnd = ws(1610);
  const xxStep = ws(8);
  const southZebraZ = IS_SCALED_WORLD ? southQuayZ - 2.7 : 731.5;
  const bridgeSkipHalf = IS_SCALED_WORLD ? 24.0 : 21.0;
  for (let xx = xxStart; xx <= xxEnd; xx += xxStep) {
    if (xx >= bridgeAveX - bridgeSkipHalf && xx <= bridgeAveX + bridgeSkipHalf) continue;
    const isYellow = Math.round((xx - xxStart) / xxStep) % 2 === 0;
    batcher.addBox(isYellow ? 'forklift_yellow' : 'matte_black', 8.0, 0.14, 3.4, xx, 0.31, southZebraZ);
    world.eastPortData.zebraStripesSegments++;
  }

  // Cabeços de Amarração de Ferro Fundido (Mooring Bollards) + Defensas de Borracha Preta (×1 prop size)
  const bzStart = ws(135);
  const bzEnd = ws(715);
  const bzStep = ws(24);
  const bollardX = IS_SCALED_WORLD ? eastQuayX - 6.2 : 1613.0;
  const fenderBoxX = IS_SCALED_WORLD ? eastQuayX + 2.0 : 1621.2;
  const fenderCylX = IS_SCALED_WORLD ? eastQuayX + 2.4 : 1621.6;
  for (let bz = bzStart; bz <= bzEnd; bz += bzStep) {
    batcher.addBox('gunmetal_concrete', 2.4, 0.45, 3.8, bollardX, 0.5, bz);
    batcher.addCylinder('matte_black', 0.58, 0.48, 1.4, bollardX, 1.35, bz - 0.9, 8);
    batcher.addCylinder('matte_black', 0.58, 0.48, 1.4, bollardX, 1.35, bz + 0.9, 8);
    batcher.addBox('matte_black', 0.9, 0.25, 3.2, bollardX, 1.95, bz);
    world.eastPortData.bollardsCount++;

    batcher.addBox('matte_black', 1.4, 2.1, 4.6, fenderBoxX, -0.1, bz);
    batcher.addCylinder('matte_black', 0.85, 0.85, 4.2, fenderCylX, 0.0, bz + 12, 8, Math.PI / 2, 0);
    world.eastPortData.rubberFendersCount += 2;
  }

  // 16 Torres Altas de Refletores Portuários (High-Mast Floodlight Towers, H = 48m ×1!)
  const floodlightCoords = [
    [630, 152], [842, 152], [1142, 152], [1485, 152],
    [630, 320], [842, 320], [1142, 320], [1485, 320],
    [630, 518], [842, 518], [1142, 518], [1485, 518],
    [630, 692], [842, 692], [1142, 692], [1485, 692]
  ].map(([fx, fz]) => [ws(fx), ws(fz)]);
  for (const [fx, fz] of floodlightCoords) {
    world.eastPortData.floodlightTowersCount++;
    batcher.addBox('gunmetal_concrete', 4.2, 2.6, 4.2, fx, 1.58, fz);
    batcher.addCylinder('armor_slate', 0.85, 1.55, 46.0, fx, 24.5, fz, 8);
    batcher.addBox('matte_black', 10.4, 3.0, 2.6, fx, 47.8, fz);
    batcher.addBox('floodlight_glow', 9.6, 2.1, 2.9, fx, 47.8, fz);
    batcher.addBox('c4_hazard_red', 0.85, 0.85, 0.85, fx, 49.8, fz);
    world.addCollider(fx, fz, 4.2, 4.2, 49.0, 0.28);
  }
}

/**
 * 2. Constrói os 10 Grandes Armazéns e Terminais Logísticos (`DOCA 01` a `DOCA 10`, 44m a 54m de altura),
 * a Refinaria / Terminal de Combustível Marítimo e a Torre da Capitania dos Portos & Controle Naval (92m)
 */
export function buildEightPortWarehousesFuelTerminalAndHarborTower(world, batcher, colorKeys) {
  const warehouses = [
    { cx: 668, cz: 215, w: 66, d: 102, h: 46, bodyMat: 'scrap_teal', trimMat: 'forklift_yellow', num: '01', label: 'DOCA 01' },
    { cx: 758, cz: 215, w: 66, d: 102, h: 50, bodyMat: 'scrap_rust', trimMat: 'tactical_white', num: '02', label: 'DOCA 02' },
    { cx: 668, cz: 415, w: 66, d: 102, h: 48, bodyMat: 'armor_slate', trimMat: 'forklift_yellow', num: '03', label: 'DOCA 03' },
    { cx: 758, cz: 415, w: 66, d: 102, h: 54, bodyMat: 'pcc_navy', trimMat: 'lego_orange', num: '04', label: 'DOCA 04' },
    { cx: 668, cz: 602, w: 66, d: 92, h: 44, bodyMat: 'scrap_rust', trimMat: 'forklift_yellow', num: '05', label: 'DOCA 05' },
    { cx: 758, cz: 602, w: 66, d: 92, h: 52, bodyMat: 'scrap_teal', trimMat: 'tactical_white', num: '06', label: 'DOCA 06' },
    { cx: 892, cz: 215, w: 72, d: 102, h: 50, bodyMat: 'pcc_navy', trimMat: 'forklift_yellow', num: '07', label: 'DOCA 07' },
    { cx: 994, cz: 215, w: 72, d: 102, h: 54, bodyMat: 'armor_slate', trimMat: 'lego_orange', num: '08', label: 'DOCA 08' },
    { cx: 634, cz: 304, w: 34, d: 46, h: 46, bodyMat: 'pcc_navy', trimMat: 'tactical_white', num: '09', label: 'DOCA 09' },
    { cx: 792, cz: 304, w: 34, d: 46, h: 48, bodyMat: 'scrap_teal', trimMat: 'forklift_yellow', num: '10', label: 'DOCA 10' }
  ];

  warehouses.forEach((wh, idx) => {
    const cx = ws(wh.cx);
    // Em 3x, desloca DOCA 03/04 (+40m em Z) para liberar totalmente a avenida Z = ws(402) = 1206 e o pátio sul
    const cz = IS_SCALED_WORLD && wh.cz === 415 ? 1285 : ws(wh.cz);
    const { w, d, h, bodyMat, trimMat, num, label } = wh;
    batcher.addBox(bodyMat, w, h, d, cx, 0.28 + h * 0.5, cz);
    batcher.addBox('gunmetal_concrete', w + 1.2, 4.4, d + 1.2, cx, 0.28 + h - 2.8, cz);
    batcher.addBox(trimMat, w + 1.6, 1.1, d + 1.6, cx, 0.28 + h - 5.6, cz);
    batcher.addBox('dark_steel', w * 0.72, 4.2, d - 8, cx, 0.28 + h + 2.1, cz);
    batcher.addBox('brushed_silver', w + 3.6, 0.65, d + 3.6, cx, 0.28 + h * 0.55, cz);
    batcher.addBox('forklift_yellow', w * 0.85, 3.2, 4.2, cx, 0.28 + h + 5.6, cz - d * 0.24);
    batcher.addBox('forklift_yellow', w * 0.85, 3.2, 4.2, cx, 0.28 + h + 5.6, cz + d * 0.24);
    world.addCollider(cx, cz, w, d, 0.28 + h + 6.0, 0.28);

    if (d >= 90) {
      batcher.addBox('armor_slate', 3.4, 1.12, d - 6.0, cx + w * 0.5 + 1.7, 0.84, cz);
      for (let dz = cz - d * 0.5 + 12; dz <= cz + d * 0.5 - 12; dz += 9.0) {
        batcher.addBox('brushed_silver', 0.45, 5.4, 5.2, cx + w * 0.5 + 0.25, 1.4 + 2.7, dz);
        batcher.addBox('forklift_yellow', 0.6, 1.3, 0.46, cx + w * 0.5 + 0.42, 1.85, dz - 2.85);
        batcher.addBox('forklift_yellow', 0.6, 1.3, 0.46, cx + w * 0.5 + 0.42, 1.85, dz + 2.85);
      }
      for (let b = -1.5; b <= 1.5; b += 1.0) {
        const dz = cz + b * 22;
        batcher.addBox('pallet_wood', 3.4, 2.6, 3.4, cx - w * 0.5 - 2.8, 1.58, dz);
      }
    }

    const signX = cx + w * 0.5 + 0.8;
    const signD = Math.min(44.0, d - 6.0);
    batcher.addBox('matte_black', 2.2, 8.5, signD, signX, 0.28 + h + 4.2, cz);
    batcher.addBox(trimMat, 2.6, 0.8, signD + 1.0, signX, 0.28 + h + 8.5, cz);
    batcher.addBox('tactical_white', 2.8, 4.4, signD * 0.45, signX, 0.28 + h + 4.2, cz - signD * 0.2);
    batcher.addBox('forklift_yellow', 2.9, 4.8, signD * 0.28, signX, 0.28 + h + 4.2, cz + signD * 0.22);
    void num;

    world.mapBuildings.push({
      x: cx,
      z: cz,
      w,
      d,
      height: h,
      color: '#0f766e',
      label
    });

    if (idx < 8) {
      const sideX = idx % 2 === 0 ? cx - w * 0.5 - 3.6 : cx + w * 0.5 + 3.6;
      for (const zOff of [-28, -9, 10, 29]) {
        const fl = 3 + ((idx + Math.abs(zOff)) % 3);
        addCorrugatedContainerStack(world, batcher, sideX, cz + zOff, fl, false, colorKeys, idx * 5 + zOff);
        if (fl >= 4) world.eastPortData.fourStoryStacksCount++;
        if (fl >= 5) world.eastPortData.fiveStoryStacksCount++;
      }
      addCorrugatedContainerStack(world, batcher, cx - 12, cz - d * 0.5 - 3.6, 4, true, colorKeys, idx * 7 + 1);
      addCorrugatedContainerStack(world, batcher, cx + 12, cz - d * 0.5 - 3.6, 5, true, colorKeys, idx * 7 + 3);
      world.eastPortData.fourStoryStacksCount += 2;
      world.eastPortData.fiveStoryStacksCount++;

      for (const tzOff of [-20, 20]) {
        addPortCargoSemiTruck(
          world,
          batcher,
          cx + tzOff,
          cz + d * 0.5 + 9.5,
          colorKeys[(idx * 2 + (tzOff > 0 ? 1 : 0)) % colorKeys.length],
          true
        );
      }
    }
  });

  // REFINARIA & TERMINAL DE COMBUSTÍVEL MARÍTIMO (âncora escalada via ws, tamanhos e sub-offsets ×1!)
  const refOx = ws(1252) - 1252;
  const refOz = ws(232) - 232;
  const tankPositions = [
    { x: 1204, z: 176, r: 11.5, h: 58, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1236, z: 176, r: 11.5, h: 66, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1268, z: 176, r: 11.5, h: 62, color: 'lego_orange', stripe: 'tactical_white' },
    { x: 1300, z: 176, r: 11.5, h: 54, color: 'tactical_white', stripe: 'lego_orange' },

    { x: 1204, z: 218, r: 11.5, h: 52, color: 'lego_orange', stripe: 'tactical_white' },
    { x: 1236, z: 218, r: 11.5, h: 68, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1268, z: 218, r: 11.5, h: 60, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1300, z: 218, r: 11.5, h: 48, color: 'lego_orange', stripe: 'tactical_white' },

    { x: 1204, z: 256, r: 10.5, h: 50, color: 'tactical_white', stripe: 'forklift_yellow' },
    { x: 1236, z: 256, r: 10.5, h: 56, color: 'forklift_yellow', stripe: 'matte_black' },
    { x: 1268, z: 256, r: 10.5, h: 54, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1300, z: 256, r: 10.5, h: 48, color: 'lego_orange', stripe: 'tactical_white' }
  ];

  for (const tk of tankPositions) {
    const tx = tk.x + refOx;
    const tz = tk.z + refOz;
    batcher.addCylinder(tk.color, tk.r, tk.r, tk.h, tx, 0.28 + tk.h * 0.5, tz, 14);
    batcher.addCylinder(tk.stripe, tk.r + 0.25, tk.r + 0.25, 4.2, tx, 0.28 + tk.h * 0.68, tz, 14);
    batcher.addCylinder('gunmetal_concrete', tk.r * 0.85, tk.r, 2.4, tx, 0.28 + tk.h + 1.2, tz, 14);
    batcher.addBox('dark_steel', 1.6, tk.h, 1.6, tx, 0.28 + tk.h * 0.5, tz + tk.r + 0.6);
    world.addCollider(tx, tz, tk.r * 2, tk.r * 2, 0.28 + tk.h + 2, 0.28);
    world.mapBuildings.push({
      x: tx,
      z: tz,
      w: tk.r * 2,
      d: tk.r * 2,
      height: tk.h,
      color: '#f97316',
      label: 'SILO DE COMBUSTÍVEL NAVAL'
    });
  }

  for (const basePz of [196, 246]) {
    const px = 1334 + refOx;
    const pz = basePz + refOz;
    const ph = 78;
    batcher.addCylinder('brushed_silver', 5.2, 6.8, ph, px, 0.28 + ph * 0.5, pz, 12);
    for (let ringY = 16; ringY <= 68; ringY += 13) {
      batcher.addCylinder('forklift_yellow', 6.8, 6.8, 1.4, px, ringY, pz, 12);
    }
    batcher.addCylinder('lego_orange', 2.4, 3.2, 6.5, px, ph + 3.0, pz, 10);
    batcher.addBox('c4_hazard_red', 4.5, 4.5, 4.5, px, ph + 7.2, pz);
    batcher.addBox('smoke_plume', 9.5, 6.0, 9.5, px, ph + 12.5, pz);
    world.addCollider(px, pz, 13.0, 13.0, ph + 4, 0.28);
  }

  const chemColors = ['lego_orange', 'forklift_yellow', 'tactical_white'];
  for (const czChem of [178, 198, 218, 238, 258, 278]) {
    addCorrugatedContainerStack(world, batcher, 1184 + refOx, czChem + refOz, 5, false, chemColors, czChem);
    world.eastPortData.fourStoryStacksCount++;
    world.eastPortData.fiveStoryStacksCount++;
  }
  for (const cxChem of [1206, 1228, 1250, 1272, 1294, 1316]) {
    addCorrugatedContainerStack(world, batcher, cxChem + refOx, 308 + refOz, 4, true, chemColors, cxChem);
    world.eastPortData.fourStoryStacksCount++;
  }

  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262 + refOx, 46.2, 176 + refOz);
  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262 + refOx, 46.2, 218 + refOz);
  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262 + refOx, 46.2, 256 + refOz);

  for (const baseGx of [1204, 1236, 1268, 1300]) {
    const gx = baseGx + refOx;
    const gz = 286 + refOz;
    batcher.addCylinder('tactical_white', 8.5, 10.5, 11.0, gx, 16.5, gz, 12);
    batcher.addCylinder('tactical_white', 10.5, 8.5, 11.0, gx, 25.5, gz, 12);
    batcher.addCylinder('lego_orange', 10.8, 10.8, 1.8, gx, 21.0, gz, 12);
    for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      batcher.addBox('armor_slate', 1.6, 16.0, 1.6, gx + lx, 8.2, gz + lz);
    }
    world.addCollider(gx, gz, 20, 20, 31, 0.28);
  }

  const pipeZ = 158 + refOz;
  const pipeStartX = 1280 + refOx;
  const pipeEndX = ws(1600);
  const pipeW = IS_SCALED_WORLD ? pipeEndX - pipeStartX + 30 : 350;
  const pipeCX = IS_SCALED_WORLD ? (pipeStartX + pipeEndX) * 0.5 : 1436;
  const pipeStep = IS_SCALED_WORLD ? 112 : 40;
  for (const [py, pMat] of [[11.5, 'forklift_yellow'], [13.5, 'brushed_silver'], [15.5, 'lego_orange']]) {
    batcher.addBox(pMat, pipeW, 1.35, 1.35, pipeCX, py, pipeZ);
  }
  for (let px = pipeStartX; px <= pipeEndX; px += pipeStep) {
    if (IS_SCALED_WORLD && (Math.abs(px - ws(1375)) < 24 || Math.abs(px - ws(1545)) < 20)) continue;
    batcher.addBox('gunmetal_concrete', 2.4, 16.0, 3.6, px, 8.2, pipeZ);
  }

  // TORRE DA CAPITANIA DOS PORTOS & CONTROLE NAVAL (X = ws(1105), Z = ws(235), H = 92m ×1)
  const htx = ws(1105);
  const htz = ws(235);
  const hth = 92;

  batcher.addBox('pcc_navy', 48, 22, 48, htx, 11.28, htz);
  batcher.addBox('tactical_white', 34, hth - 18, 34, htx, 18.28 + (hth - 18) * 0.5, htz);
  for (let fy = 24; fy <= 76; fy += 8.5) {
    batcher.addBox('dark_steel', 35.2, 4.8, 28.0, htx, fy, htz);
    batcher.addBox('dark_steel', 28.0, 4.8, 35.2, htx, fy, htz);
    batcher.addBox('forklift_yellow', 35.8, 0.75, 35.8, htx, fy - 2.8, htz);
  }

  batcher.addCylinder('pcc_navy', 21.0, 18.0, 4.2, htx, 80.0, htz, 12);
  batcher.addCylinder('dark_steel', 22.0, 20.5, 6.5, htx, 85.2, htz, 12);
  batcher.addCylinder('tactical_white', 21.5, 22.5, 3.8, htx, 90.4, htz, 12);
  batcher.addCylinder('armor_slate', 16.5, 16.5, 0.5, htx, 92.45, htz, 16);
  batcher.addBox('forklift_yellow', 2.2, 0.16, 10.5, htx - 3.8, 92.75, htz);
  batcher.addBox('forklift_yellow', 2.2, 0.16, 10.5, htx + 3.8, 92.75, htz);
  batcher.addBox('forklift_yellow', 7.6, 0.16, 2.2, htx, 92.75, htz);

  const navRadarGroup = new THREE.Group();
  navRadarGroup.position.set(htx + 12, 95.8, htz - 12);
  const navRadarBar = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 1.3, 1.5),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25 })
  );
  navRadarGroup.add(navRadarBar);
  world.scene.add(navRadarGroup);
  world.rotatingElements.push({ mesh: navRadarGroup, axis: 'y', speed: 2.2 });

  world.addCollider(htx, htz, 46, 46, 92.6, 0.28);
  world.mapBuildings.push({
    x: htx,
    z: htz,
    w: 48,
    d: 48,
    height: hth,
    color: '#0284c7',
    label: 'TORRE DA CAPITANIA DOS PORTOS'
  });

  if (IS_SCALED_WORLD) {
    _buildPortQuayIntermodalStacks(world, batcher, colorKeys);
  }
}

function _buildPortQuayIntermodalStacks(world, batcher, colorKeys) {
  const groundRoads = (world.mapRoads || []).filter((r) => !r.isElevated && !r.isBridge && r.x + r.w * 0.5 > 1750 && r.z + r.d * 0.5 > 320);
  const existingBuildings = (world.mapBuildings || []).filter((b) => b.x > 1750 && b.z > 320);

  // Reservas futuras para Setores 1..5 de PortCranesAndContainers, Base A.R.E.S., Portainers, Ramal Ferroviário e Spawns
  const keepRects = [
    { minX: ws(842), maxX: ws(1152), minZ: ws(548), maxZ: ws(704) }, // Base A.R.E.S.
    { minX: 4742, maxX: 4865, minZ: 465, maxZ: 2210 },              // Ramal Ferroviário do Cais (x=4760..4806) + Portainers Leste
    { minX: 4075, maxX: 4765, minZ: 240, maxZ: 515 },               // Curva Norte do Ramal Ferroviário
    { minX: ws(1015), maxX: ws(1250), minZ: ws(695), maxZ: ws(740) } // Portainers Sul
  ];
  const yardCenters = [
    [868, 370], [922, 370], [976, 370], [1034, 370], [1098, 370],
    [868, 478], [922, 478], [976, 478], [1034, 478], [1098, 478],
    [1202, 370], [1258, 370], [1318, 370], [1202, 478], [1258, 478], [1318, 478],
    [1202, 586], [1260, 586], [1318, 586], [1202, 658], [1260, 658], [1318, 658],
    [1424, 194], [1488, 194], [1424, 282], [1488, 282], [1424, 370], [1488, 370],
    [1424, 478], [1488, 478], [1424, 586], [1488, 586], [1424, 658], [1488, 658],
    [713, 304], [713, 504], [713, 682], [950, 304], [1054, 298], [1142, 298]
  ];
  for (const [bx, bz] of yardCenters) {
    keepRects.push({ minX: ws(bx) - 34, maxX: ws(bx) + 34, minZ: ws(bz) - 44, maxZ: ws(bz) + 44 });
  }

  const keepPoints = [];
  for (const reg of world.regions || []) if (reg?.spawn) keepPoints.push(reg.spawn);
  for (const lm of world.landmarks || []) if (lm?.spawn) keepPoints.push(lm.spawn);
  for (const zone of [TERRITORY_ZONES?.pcc, TERRITORY_ZONES?.ares]) {
    if (!zone) continue;
    for (const pt of [...(zone.outposts || []), ...(zone.gates || []), ...(zone.garages || []), zone.bossCourtyard, zone.alliedBossSpawn]) {
      if (pt) keepPoints.push(pt);
    }
  }

  const isClear = (sx, sz, cw, cd) => {
    const minX = sx - cw * 0.5 - 6.0, maxX = sx + cw * 0.5 + 6.0;
    const minZ = sz - cd * 0.5 - 6.0, maxZ = sz + cd * 0.5 + 6.0;
    for (let i = 0; i < groundRoads.length; i++) {
      const r = groundRoads[i];
      if (minX < r.x + r.w * 0.5 && maxX > r.x - r.w * 0.5 && minZ < r.z + r.d * 0.5 && maxZ > r.z - r.d * 0.5) return false;
    }
    for (let i = 0; i < keepRects.length; i++) {
      const k = keepRects[i];
      if (minX < k.maxX && maxX > k.minX && minZ < k.maxZ && maxZ > k.minZ) return false;
    }
    for (let i = 0; i < existingBuildings.length; i++) {
      const b = existingBuildings[i];
      if (minX < b.x + b.w * 0.5 + 4 && maxX > b.x - b.w * 0.5 - 4 && minZ < b.z + b.d * 0.5 + 4 && maxZ > b.z - b.d * 0.5 - 4) return false;
    }
    for (let i = 0; i < keepPoints.length; i++) {
      if (Math.hypot(sx - keepPoints[i].x, sz - keepPoints[i].z) < 32) return false;
    }
    return true;
  };

  // Fileiras intermodais organizadas (2 a 4 andares) no pátio do cais entre os armazéns, corredores RTG e Portainers
  const quayRowPairsX = [
    [2096, 2104], [2168, 2176], [2362, 2370], [2416, 2424],
    [2764, 2772], [2836, 2844], [3128, 3136],
    [4174, 4182], [4358, 4366], [4546, 4554],
    [4674, 4682], [4718, 4726]
  ];

  let seed = 17;
  for (let pIdx = 0; pIdx < quayRowPairsX.length; pIdx++) {
    const pairX = quayRowPairsX[pIdx];
    for (let zCluster = 548; zCluster <= 2035; zCluster += 74) {
      for (const bayOff of [-10.5, 10.5]) {
        const sz = zCluster + bayOff;
        for (let c = 0; c < pairX.length; c++) {
          const sx = pairX[c];
          if (!isClear(sx, sz, 6.0, 18.0)) continue;
          seed = (seed + 3 + pIdx + c) | 0;
          const tiers = 2 + ((seed + pIdx + c) % 3); // 2..4 tiers high
          addCorrugatedContainerStack(world, batcher, sx, sz, tiers, false, colorKeys, seed);
          if (tiers >= 4) world.eastPortData.fourStoryStacksCount++;
        }
      }
    }
  }
}
