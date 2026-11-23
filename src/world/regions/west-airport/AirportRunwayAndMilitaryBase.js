import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../../materials/LegoMaterials.js';
import { IS_SCALED_WORLD, ws } from '../../core/WorldLayoutScale.js';
import { addHighwayGreenSign } from './AirportTerminalAndParking.js';

function addTaxiwayStripX(world, batcher, groundY, xEast, xWest, z, roadD = 30) {
  const w = xEast - xWest;
  if (w <= 1) return;
  const cx = (xEast + xWest) * 0.5;
  batcher.addBox('asphalt_dark', w, 0.1, roadD, cx, groundY + 0.05, z);
  batcher.addBox('mark_yellow', w - 2, 0.04, 0.65, cx, groundY + 0.11, z);
  world.mapRoads.push({ x: cx, z, w, d: roadD, isMain: false });
}

function addTaxiwayStripZ(world, batcher, groundY, x, zNorth, zSouth, roadW = 26) {
  const d = zSouth - zNorth;
  if (d <= 1) return;
  const cz = (zNorth + zSouth) * 0.5;
  batcher.addBox('asphalt_dark', roadW, 0.1, d, x, groundY + 0.05, cz);
  batcher.addBox('mark_yellow', 0.65, 0.04, d - 2, x, groundY + 0.11, cz);
  world.mapRoads.push({ x, z: cz, w: roadW, d, isMain: false });
}

/**
 * 3. QUARTEIRÕES ENTRE AS PISTAS MENORES (TAXIWAYS) LOTADOS DE GALPÕES / HANGARES ENFILEIRADOS!
 * - 5 Pistas Menores Horizontais (Z = ws(-560), ws(-280), 0, ws(+280), ws(+560)) e 3 Ruas de Pátio Verticais
 *   (X = ws(-1215), ws(-1380), ws(-1545)) formando 4 Grandes Quarteirões Aeronáuticos!
 * - 16 Hangares de Teto Arqueado (88m x 72m x 22m em 1x estrito!) posicionados nos âncoras wsP(hx, hz).
 */
export function buildTaxiwayBlocksAnd16RowHangars(world, batcher, groundY) {
  if (!IS_SCALED_WORLD) {
    const taxiwaysZ = [-560, -280, 0, 280, 560];
    for (const tz of taxiwaysZ) {
      batcher.addBox('asphalt_dark', 420, 0.1, 30, -1410, groundY + 0.05, tz);
      batcher.addBox('mark_yellow', 420, 0.04, 0.65, -1410, groundY + 0.11, tz);
      world.mapRoads.push({ x: -1410, z: tz, w: 420, d: 30, isMain: false });
    }
    for (const tx of [-1215, -1380, -1545]) {
      batcher.addBox('asphalt_dark', 26, 0.1, 1150, tx, groundY + 0.05, 0);
      batcher.addBox('mark_yellow', 0.65, 0.04, 1150, tx, groundY + 0.11, 0);
      world.mapRoads.push({ x: tx, z: 0, w: 26, d: 1150, isMain: false });
    }
  } else {
    const termRearApronX = ws(-1145) - 72; // Pátio traseiro do Mega Terminal
    const eastBlvdX = ws(-1145) + 180;     // Boulevard Perimetral N-S
    const txEast = ws(-1215);
    const txMid = ws(-1380);
    const txWest = ws(-1545);
    const rwyEdgeX = ws(-1660) + 40;

    // Pátio traseiro norte-sul atrás das 8 pontes de embarque do Terminal (960m)
    addTaxiwayStripZ(world, batcher, groundY, termRearApronX, -475, 475, 28);

    // 3 Ruas de Taxiamento Verticais (largura 26m 1x!) cruzando todos os 4 quarteirões aeronáuticos
    for (const tx of [txEast, txMid, txWest]) {
      addTaxiwayStripZ(world, batcher, groundY, tx, ws(-560) - 15, ws(560) + 15, 26);
    }

    // 5 Taxiways Horizontais: Z = ±280 ligam o Pátio do Terminal direto às cabeceiras da Pista 09/27;
    // Z = 0 para em txWest (livre da Torre ATC Central em ws(-1582), 0!); Z = ±560 ligam o Boulevard até txWest
    addTaxiwayStripX(world, batcher, groundY, termRearApronX, txWest, 0, 30);
    addTaxiwayStripX(world, batcher, groundY, eastBlvdX, rwyEdgeX, ws(-280), 30);
    addTaxiwayStripX(world, batcher, groundY, eastBlvdX, rwyEdgeX, ws(280), 30);
    addTaxiwayStripX(world, batcher, groundY, eastBlvdX, txWest, ws(-560), 30);
    addTaxiwayStripX(world, batcher, groundY, eastBlvdX, txWest, ws(560), 30);
    // Saídas rápidas intermediárias da Pista 09/27 (livres das Torres ATC em ws(±360) = ±1080 e 0!)
    addTaxiwayStripX(world, batcher, groundY, txWest, rwyEdgeX, -420, 26);
    addTaxiwayStripX(world, batcher, groundY, txWest, rwyEdgeX, 420, 26);
  }

  // ============================================================================
  // 3. OS 16 GRANDES GALPÕES / HANGARES ENFILEIRADOS (88m x 72m x 22m — 1x ESTRITO!)
  // ============================================================================
  const hangarColsX = [-1298, -1462].map(ws);
  const hangarRowsZ = [-475, -365, -195, -85, 85, 195, 365, 475].map(ws);

  if (IS_SCALED_WORLD) {
    // Pistas curtas de pátio conectando as bocas Leste/Oeste de cada fileira de hangares às Taxiways Verticais
    for (const hz of hangarRowsZ) {
      addTaxiwayStripX(world, batcher, groundY, ws(-1215), ws(-1298) + 44, hz, 24);
      addTaxiwayStripX(world, batcher, groundY, ws(-1298) - 44, ws(-1462) + 44, hz, 24);
      addTaxiwayStripX(world, batcher, groundY, ws(-1462) - 44, ws(-1545), hz, 24);
    }
  }

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

      if (IS_SCALED_WORLD) {
        world.mapBlocks.push({
          x: hx,
          z: hz,
          w: 136,
          d: 96,
          color: isMilitary ? '#1a2e05' : '#1e293b'
        });
      }
      buildOpenArchedHangar(world, batcher, hx, groundY, hz, 88, 72, 22, wallKey, roofKey, label);
    }
  }

  // 4. 4 Caminhões-Tanque de Combustível de Aviação (Explosivos!) distribuídos pelos Quarteirões!
  const truckBaseX = IS_SCALED_WORLD ? ws(-1380) + 22 : -1380;
  for (const dz of [-310, -30, 45, 320]) {
    spawnExplosiveFuelTruck(world, truckBaseX, groundY, ws(dz));
  }

  // 5. 16 Caixas Militares Verdes Quebráveis dentro dos 8 Galpões Militares + 2 Torres de Vigia!
  const milRowsZ = [85, 195, 365, 475].map(ws);
  const crateOffsetsX = [28, -27];
  for (let c = 0; c < hangarColsX.length; c++) {
    const colOffsets = c === 0 ? crateOffsetsX : [27, -28];
    for (const dxOff of colOffsets) {
      for (const mhz of milRowsZ) {
        spawnMilitaryCrate(world, hangarColsX[c] + dxOff, groundY, mhz - 15);
      }
    }
  }

  const wtSouthX = IS_SCALED_WORLD ? ws(-1215) + 22 : -1215;
  buildMilitaryWatchtower(world, batcher, wtSouthX, groundY, ws(320));
  buildMilitaryWatchtower(world, batcher, wtSouthX, groundY, ws(520));
}

/**
 * 4B. PISTA PRINCIPAL DE POUSO E DECOLAGEM (RUNWAY 09 / 27 em X = ws(-1660), largura 96m 1x!)
 */
export function buildMainRunway0927(world, batcher, groundY) {
  const rwX = ws(-1660);
  const rwZ = 0;
  const rwW = 96; // Largura estritamente 1x!
  const rwD = IS_SCALED_WORLD ? 1800 : 1220; // ~1.48x em 3x, conectando taxiways Z = ±840 (ws(±280))!
  const halfD = rwD * 0.5;

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
  const dashMaxZ = halfD - 150;
  for (let dz = -dashMaxZ; dz <= dashMaxZ; dz += 42) {
    batcher.addBox('mark_white', 1.8, 0.03, 22.0, rwX, markY, dz);
  }

  // Cabeceiras ("Piano Keys") e Zonas de Toque nas duas pontas (dimensões 1x!)
  const pianoOffZ = halfD - 30;
  const tdOffZ = halfD - 120;
  for (const endZ of [-pianoOffZ, pianoOffZ]) {
    for (let px = -36; px <= 36; px += 9) {
      if (Math.abs(px) < 3) continue;
      batcher.addBox('mark_white', 4.2, 0.03, 28.0, rwX + px, markY, endZ);
    }
    const tdZ = endZ > 0 ? tdOffZ : -tdOffZ;
    batcher.addBox('mark_white', 8.0, 0.03, 22.0, rwX - 18, markY, tdZ);
    batcher.addBox('mark_white', 8.0, 0.03, 22.0, rwX + 18, markY, tdZ);
  }

  // Números "09" e "27" na Pista
  const numOffZ = halfD - 75;
  drawRunwayNumber09(batcher, rwX, markY, -numOffZ);
  drawRunwayNumber27(batcher, rwX, markY, numOffZ);

  // Fileiras de Luzes de Pista Luminosas
  const threshLightZ = halfD - 4;
  for (let lx = -44; lx <= 44; lx += 8) {
    batcher.addBox('light_green', 0.9, 0.45, 0.9, rwX + lx, groundY + 0.3, -threshLightZ);
    batcher.addBox('light_red', 0.9, 0.45, 0.9, rwX + lx, groundY + 0.3, threshLightZ);
  }
  const edgeMaxZ = halfD - 20;
  const yellowZoneZ = halfD - 190;
  for (let lz = -edgeMaxZ; lz <= edgeMaxZ; lz += 28) {
    const sideLightKey = Math.abs(lz) > yellowZoneZ ? 'mark_yellow' : 'light_warm';
    batcher.addBox(sideLightKey, 0.85, 0.5, 0.85, rwX - rwW * 0.5 - 1.5, groundY + 0.32, lz);
    batcher.addBox(sideLightKey, 0.85, 0.5, 0.85, rwX + rwW * 0.5 + 1.5, groundY + 0.32, lz);
    batcher.addBox('mark_white', 0.55, 0.12, 0.55, rwX, groundY + 0.14, lz);
  }

  // 2 Birutas Laranja e Branca (Windsocks 1x!) ao lado da Pista Principal
  const wsOffZ = halfD - 160;
  for (const wz of [-wsOffZ, wsOffZ]) {
    const wx = rwX + rwW * 0.5 + 10;
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

  return rwD;
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
 * 5. ALA MILITAR NORTE DA BASE (CANTO NOROESTE: X = ws(-1825)..ws(-1015), Z = ws(-1320)..ws(-660))
 */
export function buildNorthMilitaryBaseWing(world, batcher, groundY) {
  const bx = ws(-1115);
  const bz = ws(-990);
  const tyX = ws(-1380);
  const tyZ = ws(-1135);

  // 1. Avenidas Táticas Internas da Ala Militar Norte
  if (!IS_SCALED_WORLD) {
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
  } else {
    const eastBlvdX = ws(-1145) + 180; // -3255 (rente à frente do Quartel Militar!)
    const westRadarTieX = ws(-1790);   // -5370 (conecta direto com hwy_nw_radar!)

    // Avenidas Leste-Oeste conectando o Boulevard Perimetral até o Cabo Radar (-1790, -1285)
    addTaxiwayStripX(world, batcher, groundY, eastBlvdX, westRadarTieX, ws(-660), 28);
    addTaxiwayStripX(world, batcher, groundY, ws(-1215), westRadarTieX, ws(-960), 28);
    addTaxiwayStripX(world, batcher, groundY, eastBlvdX, westRadarTieX, ws(-1285), 28);

    // Avenidas Norte-Sul conectando as Taxiways do Aeroporto (ws(-560)) até a Rodovia Boreal Norte (ws(-1300))
    addTaxiwayStripZ(world, batcher, groundY, ws(-1215), ws(-1300), ws(-560), 26);
    addTaxiwayStripZ(world, batcher, groundY, ws(-1380), tyZ + 132, ws(-560), 26);
    addTaxiwayStripZ(world, batcher, groundY, ws(-1545), ws(-1300), ws(-560), 26);
  }

  // 2. Quartel Militar / Comando Norte do Exército (âncora wsP(-1115, -990), dimensões 1x: 144m x 540m!)
  batcher.addBox('military_dark', 144, 1.2, 540, bx, groundY + 0.6, bz);
  world.mapBlocks.push({ x: bx, z: bz, w: 144, d: 540, color: '#1a2e05' });

  const barracksSpecs = [
    { z: bz - 180, h: 36, label: 'QUARTEL DE COMANDO NORTE' },
    { z: bz, h: 42, label: 'QG DO EXÉRCITO & INTELIGÊNCIA' },
    { z: bz + 180, h: 34, label: 'ARSENAL & PAIOL MILITAR NORTE' }
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
  addHighwayGreenSign(world, bx + 73, groundY + 40, bz, 78.0, 5.8, 'QUARTEL GENERAL — ALA MILITAR NORTE ');

  // 3. 4 Hangares Militares Extras (âncoras wsP(hx, hz), 88m x 76m x 24m em 1x estrito!)
  const northHangarColsX = [-1298, -1462].map(ws);
  const northHangarRowsZ = [-735, -865].map(ws);
  if (IS_SCALED_WORLD) {
    for (const hz of northHangarRowsZ) {
      addTaxiwayStripX(world, batcher, groundY, ws(-1215), ws(-1298) + 44, hz, 24);
      addTaxiwayStripX(world, batcher, groundY, ws(-1298) - 44, ws(-1462) + 44, hz, 24);
      addTaxiwayStripX(world, batcher, groundY, ws(-1462) - 44, ws(-1545), hz, 24);
    }
  }
  for (const hx of northHangarColsX) {
    for (const hz of northHangarRowsZ) {
      if (IS_SCALED_WORLD) {
        world.mapBlocks.push({ x: hx, z: hz, w: 136, d: 100, color: '#1a2e05' });
      }
      buildOpenArchedHangar(world, batcher, hx, groundY, hz, 88, 76, 24, 'military_olive', 'military_dark', 'HANGAR MILITAR NORTE');
      buildSupersonicFighterJet(world, batcher, hx, groundY, hz);
    }
  }

  // 4. Grande Pátio Blindado de Tanques (âncora wsP(-1380, -1135), Oficina e Tanques 1x!)
  const yardW = IS_SCALED_WORLD ? 340 : 290;
  const workshopZ = tyZ - 90;
  const tankBayZ = IS_SCALED_WORLD ? tyZ + 75 : tyZ + 50;
  batcher.addBox('asphalt_dark', yardW, 0.16, 260, tyX, groundY + 0.08, tyZ);
  world.mapBlocks.push({ x: tyX, z: tyZ, w: yardW, d: 260, color: '#334155' });

  batcher.addBox('steel_dark', 250, 30, 62, tyX, groundY + 15, workshopZ);
  batcher.addBox('military_olive', 254, 3.2, 66, tyX, groundY + 28.5, workshopZ);
  batcher.addBox('mark_yellow', 255, 0.85, 67, tyX, groundY + 30.4, workshopZ);
  world.addCollider(tyX, workshopZ, 250, 62, groundY + 31, groundY);
  world.mapBuildings.push({
    x: tyX,
    z: workshopZ,
    w: 250,
    d: 62,
    height: 30,
    color: '#1a2e05',
    label: 'OFICINA DE TANQUES TITAN'
  });

  // 6 Tanques de Guerra Pesados Estacionados nas Baias Amarelas do Pátio Norte (1x!)
  for (const dxOff of [-100, -50, 0, 50, 100, 145]) {
    const tankX = tyX + dxOff;
    batcher.addBox('mark_yellow', 18, 0.05, 28, tankX, groundY + 0.18, tankBayZ);
    batcher.addBox('charcoal', 7.2, 1.8, 12.6, tankX, groundY + 1.1, tankBayZ);
    batcher.addBox('military_olive', 6.4, 2.2, 11.4, tankX, groundY + 2.4, tankBayZ);
    batcher.addBox('military_dark', 4.6, 1.8, 5.8, tankX, groundY + 4.1, tankBayZ);
    batcher.addBox('steel_dark', 0.85, 0.85, 9.5, tankX, groundY + 4.2, tankBayZ + 7);
    world.addCollider(tankX, tankBayZ, 7.4, 13.0, groundY + 5.2, groundY);
  }

  // 5. 4 Baterias Antiaéreas SAM / Radar Costeiras & 2 Helipontos Militares Norte (âncoras wsP, 1x!)
  if (!IS_SCALED_WORLD) {
    batcher.addBox('military_dark', 220, 0.2, 620, -1685, groundY + 0.1, -990);
    world.mapBlocks.push({ x: -1685, z: -990, w: 220, d: 620, color: '#1e293b' });
  } else {
    addTaxiwayStripZ(world, batcher, groundY, ws(-1655), ws(-1285), ws(-660), 24);
  }

  const samX = ws(-1710);
  const samZCoords = [-1235, -1085, -935, -785].map(ws);
  for (const sz of samZCoords) {
    if (IS_SCALED_WORLD) {
      batcher.addBox('military_dark', 72, 0.2, 72, samX, groundY + 0.1, sz);
      world.mapBlocks.push({ x: samX, z: sz, w: 72, d: 72, color: '#1e293b' });
    }
    batcher.addBox('concrete_wall', 42, 8.5, 42, samX, groundY + 4.25, sz);
    batcher.addBox('military_olive', 36, 4.0, 36, samX, groundY + 10.5, sz);
    batcher.addBox('mark_yellow', 43, 0.75, 43, samX, groundY + 8.6, sz);
    batcher.addBox('steel_dark', 10, 6.5, 10, samX, groundY + 15.5, sz);
    for (const mxOff of [-3.2, -1.1, 1.1, 3.2]) {
      batcher.addBox('white_clean', 1.4, 2.2, 11.5, samX + mxOff, groundY + 19.5, sz);
      batcher.addBox('aviation_red', 1.5, 2.3, 2.2, samX + mxOff, groundY + 20.2, sz - 5.2);
    }
    world.addCollider(samX, sz, 42, 42, groundY + 22, groundY);
    world.mapBuildings.push({
      x: samX,
      z: sz,
      w: 42,
      d: 42,
      height: 22,
      color: '#475569',
      label: 'BATERIA ANTIAÉREA SAM'
    });
  }

  // 2 Helipontos Militares Norte (âncoras wsP(-1605, -1160/-860), 38m x 38m 1x!)
  const heliX = ws(-1605);
  for (const hz of [-1160, -860].map(ws)) {
    if (IS_SCALED_WORLD) {
      world.mapBlocks.push({ x: heliX, z: hz, w: 54, d: 54, color: '#1e293b' });
    }
    batcher.addBox('asphalt_dark', 38, 0.3, 38, heliX, groundY + 0.2, hz);
    batcher.addBox('mark_yellow', 34, 0.06, 1.4, heliX, groundY + 0.38, hz - 16);
    batcher.addBox('mark_yellow', 34, 0.06, 1.4, heliX, groundY + 0.38, hz + 16);
    batcher.addBox('mark_white', 2.2, 0.08, 14.0, heliX - 4.5, groundY + 0.39, hz);
    batcher.addBox('mark_white', 2.2, 0.08, 14.0, heliX + 4.5, groundY + 0.39, hz);
    batcher.addBox('mark_white', 9.0, 0.08, 2.2, heliX, groundY + 0.39, hz);
    buildMilitaryAttackHelicopter(world, batcher, heliX, groundY + 0.35, hz);
  }

  buildMilitaryWatchtower(world, batcher, ws(-1555), groundY, ws(-1275));
  buildMilitaryWatchtower(world, batcher, ws(-1795), groundY, ws(-1275));
}
