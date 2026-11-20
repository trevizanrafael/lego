import * as THREE from 'three';
import { addCorrugatedContainerStack } from './EastPortBatcherAndMaterials.js';
import { addPortCargoSemiTruck } from './CargoShipsAndDocksBuilder.js';

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
    batcher.addBox(sec.mat, sec.w, 0.28, sec.d, sec.x, 0.14, sec.z);
    world.mapBlocks.push({ x: sec.x, z: sec.z, w: sec.w, d: sec.d, color: sec.mapColor });
    batcher.addBox('forklift_yellow', sec.w - 4, 0.04, 0.65, sec.x, 0.29, sec.z - sec.d * 0.5 + 2.5);
    batcher.addBox('forklift_yellow', sec.w - 4, 0.04, 0.65, sec.x, 0.29, sec.z + sec.d * 0.5 - 2.5);
    batcher.addBox('tactical_white', 0.65, 0.04, sec.d - 4, sec.x - sec.w * 0.5 + 2.5, 0.29, sec.z);
    batcher.addBox('tactical_white', 0.65, 0.04, sec.d - 4, sec.x + sec.w * 0.5 - 2.5, 0.29, sec.z);
  }

  // Avenidas Logísticas Asfaltadas Leste-Oeste (Z = 134, 335, 535, 708) e Norte-Sul (X = 600, 825, 1158, 1375, 1545)
  const ewAvenuesZ = [134, 335, 535, 708];
  for (const az of ewAvenuesZ) {
    const roadW = 1010;
    const roadCX = 1100;
    batcher.addBox('matte_black', roadW, 0.3, 28.0, roadCX, 0.15, az);
    batcher.addBox('forklift_yellow', roadW - 16, 0.05, 0.45, roadCX, 0.31, az - 0.55);
    batcher.addBox('forklift_yellow', roadW - 16, 0.05, 0.45, roadCX, 0.31, az + 0.55);
    world.mapRoads.push({ x: roadCX, z: az, w: roadW, d: 28, isMain: true });

    for (let sx = 660; sx <= 1520; sx += 95) {
      batcher.addBox('tactical_white', 5.5, 0.05, 0.55, sx, 0.31, az - 6.5);
      batcher.addBox('tactical_white', 1.8, 0.05, 1.8, sx + 2.8, 0.31, az - 6.5, 0, Math.PI / 4, 0);
      batcher.addBox('tactical_white', 5.5, 0.05, 0.55, sx, 0.31, az + 6.5);
      batcher.addBox('tactical_white', 1.8, 0.05, 1.8, sx - 2.8, 0.31, az + 6.5, 0, Math.PI / 4, 0);
    }
  }

  const nsAvenuesX = [600, 825, 1158, 1375, 1545];
  for (const ax of nsAvenuesX) {
    const w = ax === 1375 ? 34.0 : 28.0;
    batcher.addBox('matte_black', w, 0.3, 610, ax, 0.15, 425.0);
    batcher.addBox('forklift_yellow', 0.45, 0.05, 600, ax - 0.55, 0.31, 425.0);
    batcher.addBox('forklift_yellow', 0.45, 0.05, 600, ax + 0.55, 0.31, 425.0);
    world.mapRoads.push({ x: ax, z: 425, w, d: 610, isMain: true });
  }

  // 4 Rotatórias Logísticas de Caminhões nos cruzamentos principais
  const roundabouts = [
    [825, 335],
    [1158, 335],
    [1375, 335],
    [1375, 535]
  ];
  for (const [rx, rz] of roundabouts) {
    batcher.addCylinder('forklift_yellow', 7.2, 7.6, 0.42, rx, 0.36, rz, 12);
    batcher.addCylinder('gunmetal_concrete', 5.8, 5.8, 0.58, rx, 0.48, rz, 12);
    batcher.addCylinder('armor_slate', 0.55, 0.85, 18.0, rx, 9.2, rz, 8);
    batcher.addBox('floodlight_glow', 4.6, 0.9, 4.6, rx, 18.2, rz);
  }

  // 6 Portarias de Doca (Guaritas + Cancelas)
  const gatehouseCoords = [
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

  // Parede vertical maciça do Cais à Beira-Mar Leste (X = 1619.2) e Sul (Z = 734.2)
  batcher.addBox('gunmetal_concrete', 3.4, 2.6, 620, 1619.2, -0.35, 425);
  batcher.addBox('gunmetal_concrete', 1020, 2.6, 3.4, 1110, -0.35, 734.2);

  // Faixas Zebradas Amarelas e Pretas de Segurança
  for (let zz = 122; zz <= 728; zz += 6) {
    const isYellow = Math.floor((zz - 122) / 6) % 2 === 0;
    batcher.addBox(isYellow ? 'forklift_yellow' : 'matte_black', 3.6, 0.14, 6.0, 1616.2, 0.31, zz);
    world.eastPortData.zebraStripesSegments++;
  }
  for (let xx = 610; xx <= 1610; xx += 8) {
    if (xx >= 1354 && xx <= 1396) continue;
    const isYellow = Math.floor((xx - 610) / 8) % 2 === 0;
    batcher.addBox(isYellow ? 'forklift_yellow' : 'matte_black', 8.0, 0.14, 3.4, xx, 0.31, 731.5);
    world.eastPortData.zebraStripesSegments++;
  }

  // Cabeços de Amarração de Ferro Fundido (Mooring Bollards) + Defensas de Borracha Preta
  for (let bz = 135; bz <= 715; bz += 24) {
    batcher.addBox('gunmetal_concrete', 2.4, 0.45, 3.8, 1613.0, 0.5, bz);
    batcher.addCylinder('matte_black', 0.58, 0.48, 1.4, 1613.0, 1.35, bz - 0.9, 8);
    batcher.addCylinder('matte_black', 0.58, 0.48, 1.4, 1613.0, 1.35, bz + 0.9, 8);
    batcher.addBox('matte_black', 0.9, 0.25, 3.2, 1613.0, 1.95, bz);
    world.eastPortData.bollardsCount++;

    batcher.addBox('matte_black', 1.4, 2.1, 4.6, 1621.2, -0.1, bz);
    batcher.addCylinder('matte_black', 0.85, 0.85, 4.2, 1621.6, 0.0, bz + 12, 8, Math.PI / 2, 0);
    world.eastPortData.rubberFendersCount += 2;
  }

  // 16 Torres Altas de Refletores Portuários (High-Mast Floodlight Towers, H = 48m!)
  const floodlightCoords = [
    [630, 152], [842, 152], [1142, 152], [1485, 152],
    [630, 320], [842, 320], [1142, 320], [1485, 320],
    [630, 518], [842, 518], [1142, 518], [1485, 518],
    [630, 692], [842, 692], [1142, 692], [1485, 692]
  ];
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
    const { cx, cz, w, d, h, bodyMat, trimMat, num, label } = wh;
    batcher.addBox(bodyMat, w, h, d, cx, 0.28 + h * 0.5, cz);
    batcher.addBox('gunmetal_concrete', w + 1.2, 4.4, d + 1.2, cx, 0.28 + h - 2.8, cz);
    batcher.addBox(trimMat, w + 1.6, 1.1, d + 1.6, cx, 0.28 + h - 5.6, cz);
    batcher.addBox('dark_steel', w * 0.72, 4.2, d - 8, cx, 0.28 + h + 2.1, cz);
    batcher.addBox('brushed_silver', w + 3.6, 0.65, d + 3.6, cx, 0.28 + h * 0.55, cz);
    batcher.addBox('forklift_yellow', w * 0.85, 3.2, 4.2, cx, 0.28 + h + 5.6, cz - d * 0.24);
    batcher.addBox('forklift_yellow', w * 0.85, 3.2, 4.2, cx, 0.28 + h + 5.6, cz + d * 0.24);
    world.addCollider(cx, cz, w, d, 0.28 + h + 6.0, 0.28);

    if (d >= 90) {
      for (let b = -1.5; b <= 1.5; b += 1.0) {
        const dz = cz + b * 22;
        batcher.addBox('matte_black', 1.8, 11.0, 14.0, cx + w * 0.5 + 0.3, 0.28 + 5.5, dz);
        batcher.addBox('brushed_silver', 2.0, 2.8, 13.8, cx + w * 0.5 + 0.5, 0.28 + 9.8, dz);
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

  // REFINARIA & TERMINAL DE COMBUSTÍVEL MARÍTIMO (12 SILOS CILÍNDRICOS 48m–68m + 2 TORRES PETROQUÍMICAS 78m + 4 ESFERAS)
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
    batcher.addCylinder(tk.color, tk.r, tk.r, tk.h, tk.x, 0.28 + tk.h * 0.5, tk.z, 14);
    batcher.addCylinder(tk.stripe, tk.r + 0.25, tk.r + 0.25, 4.2, tk.x, 0.28 + tk.h * 0.68, tk.z, 14);
    batcher.addCylinder('gunmetal_concrete', tk.r * 0.85, tk.r, 2.4, tk.x, 0.28 + tk.h + 1.2, tk.z, 14);
    batcher.addBox('dark_steel', 1.6, tk.h, 1.6, tk.x, 0.28 + tk.h * 0.5, tk.z + tk.r + 0.6);
    world.addCollider(tk.x, tk.z, tk.r * 2, tk.r * 2, 0.28 + tk.h + 2, 0.28);
    world.mapBuildings.push({
      x: tk.x,
      z: tk.z,
      w: tk.r * 2,
      d: tk.r * 2,
      height: tk.h,
      color: '#f97316',
      label: 'SILO DE COMBUSTÍVEL NAVAL'
    });
  }

  for (const pz of [196, 246]) {
    const px = 1334;
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
    addCorrugatedContainerStack(world, batcher, 1184, czChem, 5, false, chemColors, czChem);
    world.eastPortData.fourStoryStacksCount++;
    world.eastPortData.fiveStoryStacksCount++;
  }
  for (const cxChem of [1206, 1228, 1250, 1272, 1294, 1316]) {
    addCorrugatedContainerStack(world, batcher, cxChem, 308, 4, true, chemColors, cxChem);
    world.eastPortData.fourStoryStacksCount++;
  }

  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262, 46.2, 176);
  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262, 46.2, 218);
  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262, 46.2, 256);

  for (const gx of [1204, 1236, 1268, 1300]) {
    batcher.addCylinder('tactical_white', 8.5, 10.5, 11.0, gx, 16.5, 286, 12);
    batcher.addCylinder('tactical_white', 10.5, 8.5, 11.0, gx, 25.5, 286, 12);
    batcher.addCylinder('lego_orange', 10.8, 10.8, 1.8, gx, 21.0, 286, 12);
    for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      batcher.addBox('armor_slate', 1.6, 16.0, 1.6, gx + lx, 8.2, 286 + lz);
    }
    world.addCollider(gx, 286, 20, 20, 31, 0.28);
  }

  for (const [py, pMat] of [[11.5, 'forklift_yellow'], [13.5, 'brushed_silver'], [15.5, 'lego_orange']]) {
    batcher.addBox(pMat, 350, 1.35, 1.35, 1436, py, 158);
  }
  for (let px = 1280; px <= 1600; px += 40) {
    batcher.addBox('gunmetal_concrete', 2.4, 16.0, 3.6, px, 8.2, 158);
  }

  // TORRE DA CAPITANIA DOS PORTOS & CONTROLE NAVAL (X = 1105, Z = 235, H = 92m)
  const htx = 1105;
  const htz = 235;
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
}
