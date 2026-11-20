import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../../materials/LegoMaterials.js';
import { addHighwayGreenSign } from './AirportTerminalAndParking.js';

/**
 * 3. QUARTEIRÕES ENTRE AS PISTAS MENORES (TAXIWAYS) LOTADOS DE GALPÕES / HANGARES ENFILEIRADOS!
 * - 5 Pistas Menores Horizontais (Z = -560, -280, 0, +280, +560) e 3 Ruas de Pátio Verticais
 *   (X = -1215, -1380, -1545) formando 4 Grandes Quarteirões Aeronáuticos!
 * - Cada quarteirão tem 4 Grandes Galpões/Hangares de Teto Arqueado Enfileirados (16 Hangares no total!):
 *   - 8 Galpões Azuis/Brancos nos 2 Quarteirões Norte (Aviação Civil, Executiva e Cargas)
 *   - 8 Galpões Verdes-Militares/Cinzas nos 2 Quarteirões Sul (Base Militar, Caças, Helicópteros e Tanques)
 */
export function buildTaxiwayBlocksAnd16RowHangars(world, batcher, groundY) {
  // 1. Pistas Menores Horizontais (Taxiways Leste-Oeste ligando o Mega Terminal à Pista Principal!)
  const taxiwaysZ = [-560, -280, 0, 280, 560];
  for (const tz of taxiwaysZ) {
    batcher.addBox('asphalt_dark', 420, 0.1, 30, -1410, groundY + 0.05, tz);
    batcher.addBox('mark_yellow', 420, 0.04, 0.65, -1410, groundY + 0.11, tz);
    world.mapRoads.push({ x: -1410, z: tz, w: 420, d: 30, isMain: false });
  }

  // 2. Ruas de Taxiamento Verticais (Norte-Sul em X = -1215, X = -1380 e X = -1545)
  for (const tx of [-1215, -1380, -1545]) {
    batcher.addBox('asphalt_dark', 26, 0.1, 1150, tx, groundY + 0.05, 0);
    batcher.addBox('mark_yellow', 0.65, 0.04, 1150, tx, groundY + 0.11, 0);
    world.mapRoads.push({ x: tx, z: 0, w: 26, d: 1150, isMain: false });
  }

  // ============================================================================
  // 3. OS 16 GRANDES GALPÕES / HANGARES ENFILEIRADOS DENTRO DOS 4 QUARTEIRÕES!
  // ============================================================================
  const hangarColsX = [-1298, -1462];
  const hangarRowsZ = [-475, -365, -195, -85, 85, 195, 365, 475];

  for (const hx of hangarColsX) {
    for (let r = 0; r < hangarRowsZ.length; r++) {
      const hz = hangarRowsZ[r];
      const isMilitary = hz > 0;
      const wallKey = isMilitary
        ? (r % 2 === 0 ? 'military_olive' : 'steel_dark')
        : (r % 2 === 0 ? 'white_clean' : 'sky_blue');
      const roofKey = isMilitary
        ? (r % 2 === 0 ? 'military_dark' : 'military_olive')
        : 'aviation_blue';
      const label = isMilitary ? 'GALPÃO MILITAR' : 'HANGAR CIVIL';

      buildOpenArchedHangar(world, batcher, hx, groundY, hz, 88, 72, 22, wallKey, roofKey, label);
    }
  }

  // 4. 4 Caminhões-Tanque de Combustível de Aviação (Explosivos!) distribuídos pelos Quarteirões!
  for (const [tx, tz] of [[-1380, -310], [-1380, -30], [-1380, 45], [-1380, 320]]) {
    spawnExplosiveFuelTruck(world, tx, groundY, tz);
  }

  // 5. 16 Caixas Militares Verdes Quebráveis nos Galpões Militares + 2 Torres de Vigia!
  for (const hx of [-1270, -1325, -1435, -1490]) {
    for (const hz of [70, 180, 350, 460]) {
      spawnMilitaryCrate(world, hx, groundY, hz);
    }
  }
  buildMilitaryWatchtower(world, batcher, -1215, groundY, 320);
  buildMilitaryWatchtower(world, batcher, -1215, groundY, 520);
}

/**
 * 4B. PISTA PRINCIPAL DE POUSO E DECOLAGEM (RUNWAY 09 / 27 em X = -1660, 96m x 1220m) COM LUZES E BIRUTAS!
 */
export function buildMainRunway0927(world, batcher, groundY) {
  const rwX = -1660;
  const rwZ = 0;
  const rwW = 96;
  const rwD = 1220;

  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.68 });
  const runway = new THREE.Mesh(new THREE.BoxGeometry(rwW, 0.14, rwD), runwayMat);
  runway.position.set(rwX, groundY + 0.05, rwZ);
  runway.receiveShadow = true;
  world.scene.add(runway);
  world.mapRoads.push({ x: rwX, z: rwZ, w: rwW, d: rwD, isMain: true });

  const markY = groundY + 0.16;

  // Linhas Laterais Contínuas + Linha Central Tracejada Branca
  batcher.addBox('mark_white', 1.2, 0.03, rwD - 20, rwX - rwW * 0.5 + 3.5, markY, rwZ);
  batcher.addBox('mark_white', 1.2, 0.03, rwD - 20, rwX + rwW * 0.5 - 3.5, markY, rwZ);
  for (let dz = -460; dz <= 460; dz += 42) {
    batcher.addBox('mark_white', 1.8, 0.03, 22.0, rwX, markY, dz);
  }

  // Cabeceiras ("Piano Keys") e Zonas de Toque nas duas pontas
  for (const endZ of [-580, 580]) {
    for (let px = -36; px <= 36; px += 9) {
      if (Math.abs(px) < 3) continue;
      batcher.addBox('mark_white', 4.2, 0.03, 28.0, rwX + px, markY, endZ);
    }
    const tdZ = endZ > 0 ? 490 : -490;
    batcher.addBox('mark_white', 8.0, 0.03, 22.0, rwX - 18, markY, tdZ);
    batcher.addBox('mark_white', 8.0, 0.03, 22.0, rwX + 18, markY, tdZ);
  }

  // Números "09" e "27" na Pista
  drawRunwayNumber09(batcher, rwX, markY, -535);
  drawRunwayNumber27(batcher, rwX, markY, 535);

  // Fileiras de Luzes de Pista Luminosas (Verdes no início, Brancas/Amarelas nas laterais, Vermelhas no fim)
  for (let lx = -44; lx <= 44; lx += 8) {
    batcher.addBox('light_green', 0.9, 0.45, 0.9, rwX + lx, groundY + 0.3, -606);
    batcher.addBox('light_red', 0.9, 0.45, 0.9, rwX + lx, groundY + 0.3, 606);
  }
  for (let lz = -590; lz <= 590; lz += 28) {
    const sideLightKey = Math.abs(lz) > 420 ? 'mark_yellow' : 'light_warm';
    batcher.addBox(sideLightKey, 0.85, 0.5, 0.85, rwX - rwW * 0.5 - 1.5, groundY + 0.32, lz);
    batcher.addBox(sideLightKey, 0.85, 0.5, 0.85, rwX + rwW * 0.5 + 1.5, groundY + 0.32, lz);
    batcher.addBox('mark_white', 0.55, 0.12, 0.55, rwX, groundY + 0.14, lz);
  }

  // 2 Birutas Laranja e Branca (Windsocks) ao lado da Pista Principal
  for (const wz of [-450, 450]) {
    const wx = rwX + rwW * 0.5 + 10; // -1602 (entre a pista e as torres!)
    batcher.addBox('steel_silver', 0.45, 9.5, 0.45, wx, groundY + 4.75, wz);
    for (let s = 0; s < 5; s++) {
      const segW = 1.6 - s * 0.22;
      batcher.addBox(
        s % 2 === 0 ? 'orange_windsock' : 'white_clean',
        1.1,
        segW,
        segW,
        wx + 1.0 + s * 1.05,
        groundY + 9.2 - s * 0.12,
        wz
      );
    }
  }
}

function drawRunwayNumber09(batcher, cx, y, cz) {
  const x0 = cx - 9;
  batcher.addBox('mark_white', 1.8, 0.04, 14.0, x0 - 4, y, cz);
  batcher.addBox('mark_white', 1.8, 0.04, 14.0, x0 + 4, y, cz);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x0, y, cz - 6);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x0, y, cz + 6);

  const x9 = cx + 9;
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x9, y, cz - 6);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x9, y, cz);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x9, y, cz + 6);
  batcher.addBox('mark_white', 1.8, 0.04, 7.0, x9 - 4, y, cz - 3);
  batcher.addBox('mark_white', 1.8, 0.04, 14.0, x9 + 4, y, cz);
}

function drawRunwayNumber27(batcher, cx, y, cz) {
  const x2 = cx - 9;
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x2, y, cz - 6);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x2, y, cz);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x2, y, cz + 6);
  batcher.addBox('mark_white', 1.8, 0.04, 7.0, x2 + 4, y, cz - 3);
  batcher.addBox('mark_white', 1.8, 0.04, 7.0, x2 - 4, y, cz + 3);

  const x7 = cx + 9;
  batcher.addBox('mark_white', 9.8, 0.04, 2.2, x7, y, cz - 6);
  batcher.addBox('mark_white', 2.0, 0.04, 14.0, x7 + 3.5, y, cz);
}

function buildOpenArchedHangar(world, batcher, hx, yBase, hz, w, d, wallH, wallKey, roofKey, label) {
  const halfD = d * 0.5;
  batcher.addBox(wallKey, w, wallH, 2.8, hx, yBase + wallH * 0.5, hz - halfD + 1.4);
  batcher.addBox(wallKey, w, wallH, 2.8, hx, yBase + wallH * 0.5, hz + halfD - 1.4);
  world.addCollider(hx, hz - halfD + 1.4, w, 2.8, yBase + wallH, yBase);
  world.addCollider(hx, hz + halfD - 1.4, w, 2.8, yBase + wallH, yBase);

  batcher.addBox('mark_yellow', w - 6, 0.05, 0.65, hx, yBase + 0.03, hz - halfD + 5.5);
  batcher.addBox('mark_yellow', w - 6, 0.05, 0.65, hx, yBase + 0.03, hz + halfD - 5.5);
  batcher.addBox('mark_yellow', w - 8, 0.05, 0.5, hx, yBase + 0.03, hz);

  const archSegments = [
    { dz: -27, sw: 13, dy: 1.5 },
    { dz: -18, sw: 13, dy: 4.5 },
    { dz: -9, sw: 13, dy: 7.0 },
    { dz: 0, sw: 14, dy: 8.2 },
    { dz: 9, sw: 13, dy: 7.0 },
    { dz: 18, sw: 13, dy: 4.5 },
    { dz: 27, sw: 13, dy: 1.5 }
  ];
  for (const seg of archSegments) {
    batcher.addBox(roofKey, w + 2.0, 2.0, seg.sw, hx, yBase + wallH + seg.dy, hz + seg.dz);
  }
  world.addCollider(hx, hz, w + 2, d, yBase + wallH + 9.5, yBase + wallH - 0.5);

  world.mapBuildings.push({
    x: hx,
    z: hz,
    w,
    d,
    height: wallH + 9,
    color: wallKey === 'white_clean' || wallKey === 'sky_blue' ? '#0284c7' : '#3f6212',
    label
  });
}

function buildCommercialAirlinerLego(world, batcher, ax, yBase, az) {
  batcher.addBox('white_clean', 6.4, 5.8, 38.0, ax, yBase + 4.8, az);
  batcher.addBox('aviation_blue', 6.6, 1.8, 38.4, ax, yBase + 2.6, az);
  batcher.addBox('glass_cockpit', 5.2, 2.2, 4.5, ax, yBase + 5.6, az - 19.5);
  batcher.addBox('white_clean', 44.0, 0.75, 7.6, ax, yBase + 4.2, az - 1.5);
  batcher.addBox('steel_silver', 3.2, 2.8, 6.2, ax - 11.5, yBase + 2.5, az - 2.5);
  batcher.addBox('steel_silver', 3.2, 2.8, 6.2, ax + 11.5, yBase + 2.5, az - 2.5);
  batcher.addBox('aviation_blue', 1.2, 9.5, 6.8, ax, yBase + 11.5, az + 15.5);
  batcher.addBox('gold_trim', 1.4, 2.2, 5.2, ax, yBase + 15.2, az + 16.0);
  batcher.addBox('white_clean', 16.0, 0.55, 4.4, ax, yBase + 5.4, az + 16.5);
  batcher.addBox('charcoal', 0.9, 2.2, 0.9, ax, yBase + 1.1, az - 15.0);
  batcher.addBox('charcoal', 1.2, 2.2, 1.2, ax - 3.2, yBase + 1.1, az + 1.0);
  batcher.addBox('charcoal', 1.2, 2.2, 1.2, ax + 3.2, yBase + 1.1, az + 1.0);

  world.addCollider(ax, az, 12, 38, yBase + 9.0, yBase);
}

function buildExecutiveVipJet(world, batcher, jx, yBase, jz) {
  batcher.addBox('white_clean', 18.0, 2.8, 3.2, jx, yBase + 2.2, jz);
  batcher.addBox('gold_trim', 18.2, 0.45, 3.3, jx, yBase + 2.0, jz);
  batcher.addBox('glass_cockpit', 3.2, 1.4, 2.6, jx - 7.5, yBase + 2.8, jz);
  batcher.addBox('white_clean', 4.6, 0.45, 18.0, jx + 0.5, yBase + 1.9, jz);
  batcher.addBox('aviation_blue', 3.6, 4.2, 0.65, jx + 7.2, yBase + 5.2, jz);
  world.addCollider(jx, jz, 18, 12, yBase + 5.5, yBase);
}

function buildSupersonicFighterJet(world, batcher, fx, yBase, fz) {
  batcher.addBox('steel_dark', 19.5, 1.8, 3.6, fx, yBase + 2.1, fz);
  batcher.addBox('charcoal', 5.5, 1.2, 2.2, fx - 10.5, yBase + 1.9, fz);
  batcher.addBox('glass_cockpit', 4.8, 1.35, 1.9, fx - 4.5, yBase + 3.1, fz);
  batcher.addBox('steel_dark', 8.5, 0.38, 15.6, fx + 1.5, yBase + 2.0, fz);
  batcher.addBox('aviation_red', 4.2, 0.45, 0.45, fx + 1.5, yBase + 2.0, fz - 7.9);
  batcher.addBox('aviation_red', 4.2, 0.45, 0.45, fx + 1.5, yBase + 2.0, fz + 7.9);
  batcher.addBox('charcoal', 3.4, 3.4, 0.45, fx + 7.2, yBase + 4.2, fz - 1.5);
  batcher.addBox('charcoal', 3.4, 3.4, 0.45, fx + 7.2, yBase + 4.2, fz + 1.5);
  batcher.addBox('orange_windsock', 1.2, 1.3, 2.4, fx + 9.8, yBase + 2.1, fz);

  world.addCollider(fx, fz, 19.5, 14.5, yBase + 4.8, yBase);
}

function buildMilitaryAttackHelicopter(world, batcher, hx, yBase, hz) {
  batcher.addBox('charcoal', 9.0, 0.35, 0.35, hx, yBase + 0.2, hz - 1.8);
  batcher.addBox('charcoal', 9.0, 0.35, 0.35, hx, yBase + 0.2, hz + 1.8);
  batcher.addBox('military_olive', 10.5, 3.2, 3.4, hx - 1.0, yBase + 2.2, hz);
  batcher.addBox('glass_cockpit', 4.2, 2.2, 3.0, hx - 4.8, yBase + 2.3, hz);
  batcher.addBox('military_dark', 5.2, 0.55, 8.8, hx - 0.5, yBase + 2.1, hz);
  batcher.addBox('military_olive', 9.5, 1.3, 1.1, hx + 8.2, yBase + 2.6, hz);
  batcher.addBox('military_dark', 1.8, 3.2, 0.45, hx + 12.2, yBase + 3.6, hz);

  const rotorGroup = new THREE.Group();
  rotorGroup.position.set(hx - 0.5, yBase + 4.2, hz);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10),
    getLegoMaterial(LEGO_COLORS.black)
  );
  const blade1 = new THREE.Mesh(
    new THREE.BoxGeometry(15.5, 0.14, 0.85),
    getLegoMaterial(LEGO_COLORS.charcoal)
  );
  blade1.position.y = 0.35;
  const blade2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.14, 15.5),
    getLegoMaterial(LEGO_COLORS.charcoal)
  );
  blade2.position.y = 0.35;
  rotorGroup.add(mast, blade1, blade2);
  world.scene.add(rotorGroup);
  world.rotatingElements.push({ mesh: rotorGroup, axis: 'y', speed: 8.5 });

  world.addCollider(hx, hz, 16, 8.5, yBase + 4.5, yBase);
}

function buildMilitaryWatchtower(world, batcher, tx, yBase, tz) {
  for (const [dx, dz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) {
    batcher.addBox('steel_dark', 0.65, 14.0, 0.65, tx + dx, yBase + 7.0, tz + dz);
  }
  const cabY = yBase + 14.0;
  batcher.addBox('military_olive', 7.6, 1.4, 7.6, tx, cabY + 0.7, tz);
  batcher.addBox('glass_cockpit', 6.8, 2.4, 6.8, tx, cabY + 2.6, tz);
  batcher.addBox('military_dark', 8.4, 0.85, 8.4, tx, cabY + 4.2, tz);
  batcher.addBox('light_warm', 1.2, 1.2, 1.2, tx - 3.6, cabY + 2.2, tz);
  world.addCollider(tx, tz, 7.2, 7.2, cabY + 4.8, yBase);
}

function spawnExplosiveFuelTruck(world, x, yBase, z) {
  const truckGroup = new THREE.Group();
  truckGroup.position.set(x, yBase, z);

  const cab = createLegoBrick(3.6, 2.8, 4.2, LEGO_COLORS.white, { studs: false });
  cab.position.set(0, 1.6, -5.2);
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.2, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  windshield.position.set(0, 2.2, -7.2);

  const tankCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 9.6, 18),
    getLegoMaterial(LEGO_COLORS.white)
  );
  tankCyl.rotation.x = Math.PI / 2;
  tankCyl.position.set(0, 2.4, 1.8);
  const redStripe = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 0.65, 9.4),
    getLegoMaterial(LEGO_COLORS.red)
  );
  redStripe.position.set(0, 2.4, 1.8);

  truckGroup.add(cab, windshield, tankCyl, redStripe);
  world.scene.add(truckGroup);

  const col = world.addCollider(x, z, 4.4, 14.5, yBase + 4.6, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: truckGroup,
      type: 'fuel_truck',
      hp: 40,
      radius: 5.5,
      height: 4.5,
      colliders: [col],
      debrisColors: [LEGO_COLORS.white, LEGO_COLORS.red, LEGO_COLORS.green, LEGO_COLORS.yellow],
      studDrops: { silver: 6, gold: 10, blue: 4, purple: 1 },
      groundY: yBase
    });
  }
}

function spawnMilitaryCrate(world, x, yBase, z) {
  const crateMesh = createLegoBrick(2.2, 1.8, 2.2, 0x3f6212, { studStep: 0.7 });
  crateMesh.position.set(x, yBase + 0.9, z);
  world.scene.add(crateMesh);

  const col = world.addCollider(x, z, 2.2, 2.2, yBase + 1.8, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: crateMesh,
      type: 'crate',
      hp: 20,
      radius: 1.6,
      height: 1.8,
      colliders: [col],
      debrisColors: [0x3f6212, 0x1a2e05, LEGO_COLORS.gold],
      studDrops: { silver: 4, gold: 6, blue: 2, purple: 0 },
      groundY: yBase
    });
  }
}

/**
 * 5. ALA MILITAR NORTE DA BASE (CANTO NOROESTE: X = -1825..-1015, Z = -1320..-660)
 */
export function buildNorthMilitaryBaseWing(world, batcher, groundY) {
  // 1. Avenidas Táticas Internas da Ala Militar Norte
  for (const tz of [-660, -960, -1285]) {
    batcher.addBox('asphalt_dark', 760, 0.1, 28, -1410, groundY + 0.05, tz);
    batcher.addBox('mark_yellow', 750, 0.04, 0.65, -1410, groundY + 0.11, tz);
    world.mapRoads.push({ x: -1410, z: tz, w: 760, d: 28, isMain: false });
  }
  for (const tx of [-1215, -1380, -1545]) {
    batcher.addBox('asphalt_dark', 26, 0.1, 640, tx, groundY + 0.05, -980);
    batcher.addBox('mark_yellow', 0.65, 0.04, 640, tx, groundY + 0.11, -980);
    world.mapRoads.push({ x: tx, z: -980, w: 26, d: 640, isMain: false });
  }

  // 2. Quartel Militar / Comando Norte do Exército (X = -1115, Z = -990, 144m x 540m, H = 38m)
  const bx = -1115;
  const bz = -990;
  batcher.addBox('military_dark', 144, 1.2, 540, bx, groundY + 0.6, bz);
  world.mapBlocks.push({ x: bx, z: bz, w: 144, d: 540, color: '#1a2e05' });

  const barracksSpecs = [
    { z: -1170, h: 36, label: 'QUARTEL DE COMANDO NORTE' },
    { z: -990, h: 42, label: 'QG DO EXÉRCITO & INTELIGÊNCIA' },
    { z: -810, h: 34, label: 'ARSENAL & PAIOL MILITAR NORTE' }
  ];
  for (const bSpec of barracksSpecs) {
    batcher.addBox('military_olive', 108, bSpec.h, 132, bx, groundY + bSpec.h * 0.5, bSpec.z);
    batcher.addBox('military_dark', 112, 3.6, 136, bx, groundY + bSpec.h - 1.8, bSpec.z);
    batcher.addBox('mark_yellow', 113, 0.85, 137, bx, groundY + bSpec.h + 0.4, bSpec.z);
    for (let fy = 8; fy <= bSpec.h - 6; fy += 7) {
      batcher.addBox('glass_cockpit', 110, 2.6, 118, bx, groundY + fy, bSpec.z);
    }
    world.addCollider(bx, bSpec.z, 108, 132, groundY + bSpec.h + 1, groundY);
    world.mapBuildings.push({
      x: bx,
      z: bSpec.z,
      w: 108,
      d: 132,
      height: bSpec.h,
      color: '#3f6212',
      label: bSpec.label
    });
  }
  addHighwayGreenSign(world, -1042, groundY + 40, -990, 78.0, 5.8, 'QUARTEL GENERAL — ALA MILITAR NORTE ');

  // 3. 4 Hangares Militares Extras (X = -1298 e -1462, Z = -735 e -865)
  for (const hx of [-1298, -1462]) {
    for (const hz of [-735, -865]) {
      buildOpenArchedHangar(world, batcher, hx, groundY, hz, 88, 76, 24, 'military_olive', 'military_dark', 'HANGAR MILITAR NORTE');
      buildSupersonicFighterJet(world, batcher, hx, groundY, hz);
    }
  }

  // 4. Grande Pátio Blindado de Tanques (X = -1380, Z = -1135, 290m x 260m)
  const tyX = -1380;
  const tyZ = -1135;
  batcher.addBox('asphalt_dark', 290, 0.16, 260, tyX, groundY + 0.08, tyZ);
  world.mapBlocks.push({ x: tyX, z: tyZ, w: 290, d: 260, color: '#334155' });

  batcher.addBox('steel_dark', 250, 30, 62, tyX, groundY + 15, -1225);
  batcher.addBox('military_olive', 254, 3.2, 66, tyX, groundY + 28.5, -1225);
  batcher.addBox('mark_yellow', 255, 0.85, 67, tyX, groundY + 30.4, -1225);
  world.addCollider(tyX, -1225, 250, 62, groundY + 31, groundY);
  world.mapBuildings.push({
    x: tyX,
    z: -1225,
    w: 250,
    d: 62,
    height: 30,
    color: '#1a2e05',
    label: 'OFICINA DE TANQUES TITAN'
  });

  // 6 Tanques de Guerra Pesados Estacionados nas Baias Amarelas do Pátio Norte
  for (const tankX of [-1480, -1430, -1380, -1330, -1280, -1235]) {
    batcher.addBox('mark_yellow', 18, 0.05, 28, tankX, groundY + 0.18, -1085);
    batcher.addBox('charcoal', 7.2, 1.8, 12.6, tankX, groundY + 1.1, -1085);
    batcher.addBox('military_olive', 6.4, 2.2, 11.4, tankX, groundY + 2.4, -1085);
    batcher.addBox('military_dark', 4.6, 1.8, 5.8, tankX, groundY + 4.1, -1085);
    batcher.addBox('steel_dark', 0.85, 0.85, 9.5, tankX, groundY + 4.2, -1078);
    world.addCollider(tankX, -1085, 7.4, 13.0, groundY + 5.2, groundY);
  }

  // 5. 4 Baterias Antiaéreas SAM / Radar Costeiras & 2 Helipontos Militares Norte (X = -1680, Z = -1230..-750)
  batcher.addBox('military_dark', 220, 0.2, 620, -1685, groundY + 0.1, -990);
  world.mapBlocks.push({ x: -1685, z: -990, w: 220, d: 620, color: '#1e293b' });

  const samZCoords = [-1235, -1085, -935, -785];
  for (const sz of samZCoords) {
    const sx = -1710;
    batcher.addBox('concrete_wall', 42, 8.5, 42, sx, groundY + 4.25, sz);
    batcher.addBox('military_olive', 36, 4.0, 36, sx, groundY + 10.5, sz);
    batcher.addBox('mark_yellow', 43, 0.75, 43, sx, groundY + 8.6, sz);
    batcher.addBox('steel_dark', 10, 6.5, 10, sx, groundY + 15.5, sz);
    for (const mxOff of [-3.2, -1.1, 1.1, 3.2]) {
      batcher.addBox('white_clean', 1.4, 2.2, 11.5, sx + mxOff, groundY + 19.5, sz);
      batcher.addBox('aviation_red', 1.5, 2.3, 2.2, sx + mxOff, groundY + 20.2, sz - 5.2);
    }
    world.addCollider(sx, sz, 42, 42, groundY + 22, groundY);
    world.mapBuildings.push({
      x: sx,
      z: sz,
      w: 42,
      d: 42,
      height: 22,
      color: '#475569',
      label: 'BATERIA ANTIAÉREA SAM'
    });
  }

  // 2 Helipontos Militares Norte (X = -1605, Z = -1160 e Z = -860) com Helicópteros de Ataque Falcon-X
  for (const hz of [-1160, -860]) {
    const hx = -1605;
    batcher.addBox('asphalt_dark', 38, 0.3, 38, hx, groundY + 0.2, hz);
    batcher.addBox('mark_yellow', 34, 0.06, 1.4, hx, groundY + 0.38, hz - 16);
    batcher.addBox('mark_yellow', 34, 0.06, 1.4, hx, groundY + 0.38, hz + 16);
    batcher.addBox('mark_white', 2.2, 0.08, 14.0, hx - 4.5, groundY + 0.39, hz);
    batcher.addBox('mark_white', 2.2, 0.08, 14.0, hx + 4.5, groundY + 0.39, hz);
    batcher.addBox('mark_white', 9.0, 0.08, 2.2, hx, groundY + 0.39, hz);
    buildMilitaryAttackHelicopter(world, batcher, hx, groundY + 0.35, hz);
  }

  buildMilitaryWatchtower(world, batcher, -1555, groundY, -1275);
  buildMilitaryWatchtower(world, batcher, -1795, groundY, -1275);
}
