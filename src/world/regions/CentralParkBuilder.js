import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick,
  SHARED_STUD_GEO
} from '../../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from '../BuildingGenerator.js';
import { createSignBoardMesh } from '../../utils/SignBoardHelper.js';

/**
 * PARQUE CENTRAL & LAGO — FLORESTA URBANA / SELVA DENSA (X: -490..+490, Z: +152..+384)
 * - 1. Perímetro de Pedra Cinza/Tijolo com Pinos de LEGO no topo, Postes Clássicos de Ferro Preto
 *      com globos de luz amarela e 4 Entradas Monumentais (Norte, Sul, Leste, Oeste) com arcos e escadarias.
 * - 2. Rede Densa de Caminhos e Trilhas Sinuosas cortando a floresta inteira (3 Alamedas Leste-Oeste,
 *      7 Caminhos Norte-Sul, 4 Trilhas Diagonais na Mata e Passeio da Orla do Lago) convergindo para a
 *      Praça Circular Central com Chafariz/Fonte de Água em 3 Camadas (jorrando água + cheio de Studs!),
 *      Bancos de Madeira, Lixeiras, Bebedouros, 3 Coreto/Gazebos e 6 Carrinhos de Hot-Dog/Sorvete quebráveis!
 * - 3. Grande Lago Navegável de Água Azul Translúcida/Brilhante com Bordas de Pedras Naturais,
 *      Píer de Madeira com Barquinhos e Pedalinhos LEGO, e Ponte Arqueada Clássica de Pedra e Madeira
 *      onde o jogador pode caminhar por cima ou passar por baixo!
 * - 4. SELVA / FLORESTA DENSA DE ÁRVORES GIGANTES (18m a 38m de altura!):
 *      Mais de 550 árvores colossais com galhos abertos, cipós pendurados, Carvalhos Anciões Gigantes,
 *      Árvores de Outono (laranja, amarela, vermelha e rosa-ipê), Pinheiros Gigantes, Salgueiros-Chorões
 *      na beira do lago e centenas de Samambaias, Rochas Musgosas, Troncos Caídos e Arbustos Floridos!
 */
export function buildCentralParkAndLake(world) {
  const px = 0;
  const pz = 268;
  const pw = 980; // X: -490..+490
  const pd = 232; // Z: +152..+384
  const groundY = 0.34;

  // Calçada Externa Perimetral contornando todo o Parque junto às avenidas (994m x 244m)
  world._addCityBlockSidewalk(px, pz, pw + 14, pd + 12, LEGO_COLORS.sidewalk);

  // Gramado Verde Vibrante Principal cobrindo todo o Parque Central
  const parkGrass = createLegoBrick(pw, groundY, pd, 0x15803d, {
    studs: false,
    roughness: 0.52
  });
  parkGrass.position.set(px, groundY * 0.5, pz);
  world.scene.add(parkGrass);
  world.mapBlocks.push({ x: px, z: pz, w: pw, d: pd, color: '#15803d' });

  // Batcher dedicado de materiais para manter 60 FPS cravados mesmo com milhares de árvores e arbustos!
  const batcher = createParkBatcher();

  // 1. Perímetro de Mureta de Pedra/Tijolo com Studs no topo, Postes de Ferro e 4 Portões Clássicos
  buildStonePerimeterWallsAndGates(world, batcher, px, pz, pw, pd, groundY);

  // 2. Rede Completa de Caminhos/Trilhas na Mata, Praça Circular, Fonte de 3 Camadas, Gazebos, Bancos e Carrinhos
  buildPavedPathsCentralPlazaAndFountain(world, batcher, px, pz, pw, pd, groundY);

  // 3. O Grande Lago Navegável, Bordas de Rochas, Píer com Pedalinhos/Barcos & Ponte Arqueada Clássica
  buildGrandLakeBoatsAndArchedBridge(world, batcher, px, pz, groundY);

  // 4. SELVA / FLORESTA URBANA DENSA (550+ Árvores Gigantes de 18m a 38m, Cipós, Samambaias, Rochas e Flores!)
  buildDenseJungleForestVegetation(world, batcher, px, pz, pw, pd, groundY);

  // Finaliza e adiciona todas as geometrias agrupadas por material na cena (poucos Draw Calls!)
  batcher.flush(world.scene);

  // Metadados do Parque Central para validação e testes automatizados
  world.centralParkData = {
    x: px,
    z: pz,
    width: pw,
    depth: pd,
    gatesCount: 4,
    fountainPos: { x: 0, z: pz },
    lakeCenter: { x: 205, z: pz, width: 270, depth: 162 },
    bridgeCenter: { x: 205, z: pz, archClearanceY: 3.6, deckTopY: 4.35 },
    gazebosCount: 3,
    breakableFoodCartsCount: 6,
    treeCount: batcher.treeCount,
    undergrowthCount: batcher.undergrowthCount
  };
}

function createParkBatcher() {
  const palette = {
    stone_wall: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42 }),
    stone_dark: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.48 }),
    stone_path: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.36 }),
    brick_red: new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.42 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35 }),
    iron_black: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.28, metalness: 0.45 }),
    lamp_globe: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    gold: getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.68, roughness: 0.16 }),
    white_marble: getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.7 }),
    wood_brown: new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.45 }),
    wood_light: new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.4 }),
    water_bright: new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.08,
      clearcoat: 0.95,
      transparent: true,
      opacity: 0.86
    }),
    water_foam: new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
    turf_emerald: new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.48 }),
    oak_dark: new THREE.MeshStandardMaterial({ color: 0x0f3f22, roughness: 0.38 }),
    oak_mid: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.36 }),
    jungle_lush: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.35 }),
    willow_lime: new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.36 }),
    pine_green: new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.4 }),
    autumn_orange: new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32 }),
    autumn_yellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }),
    autumn_red: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32 }),
    bush_green: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.38 }),
    flower_pink: new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.25 }),
    flower_yellow: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.25 }),
    flower_red: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 }),
    flower_purple: new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.25 }),
    flower_cyan: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25 })
  };

  const buckets = new Map();
  for (const k of Object.keys(palette)) {
    buckets.set(k, []);
  }

  return {
    treeCount: 0,
    undergrowthCount: 0,
    addBox(key, w, h, d, x, y, z) {
      buckets.get(key).push(makeTranslatedBox(w, h, d, x, y, z));
    },
    flush(scene) {
      for (const [key, geos] of buckets.entries()) {
        if (geos.length === 0) continue;
        const mesh = new THREE.Mesh(mergeBufferGeometries(geos), palette[key]);
        if (key !== 'lamp_globe' && key !== 'water_foam' && key !== 'stone_path') {
          mesh.castShadow = true;
        }
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    }
  };
}

/**
 * 1. PERÍMETRO DE PEDRA CINZA/TIJOLO COM PINOS DE LEGO, POSTES DE FERRO PRETO & 4 PORTÕES CLÁSSICOS
 */
function buildStonePerimeterWallsAndGates(world, batcher, px, pz, pw, pd, groundY) {
  const halfW = pw * 0.5; // 490
  const halfD = pd * 0.5; // 116
  const northZ = pz - halfD; // 152
  const southZ = pz + halfD; // 384
  const westX = px - halfW;  // -490
  const eastX = px + halfW;  // +490

  const studPositions = [];

  const isGateOpeningX = (x) =>
    Math.abs(x) < 15 ||
    Math.abs(x + 355) < 10 ||
    Math.abs(x + 195) < 10 ||
    Math.abs(x - 205) < 13 ||
    Math.abs(x - 395) < 10;
  const isGateOpeningZ = (z) => Math.abs(z - pz) < 14 || Math.abs(z - 196) < 8 || Math.abs(z - 340) < 8;

  // Mureta Baixa Norte e Sul (Z = 152 e Z = 384) com Pinos de LEGO no topo!
  for (const wallZ of [northZ, southZ]) {
    for (let x = westX + 8; x <= eastX - 8; x += 16) {
      if (isGateOpeningX(x)) continue;
      batcher.addBox('stone_dark', 15.6, 0.45, 1.35, x, groundY + 0.22, wallZ);
      batcher.addBox('brick_red', 15.2, 0.75, 1.1, x, groundY + 0.82, wallZ);
      batcher.addBox('stone_wall', 15.8, 0.28, 1.45, x, groundY + 1.34, wallZ);

      for (let sx = x - 6; sx <= x + 6; sx += 2.0) {
        studPositions.push([sx, groundY + 1.54, wallZ]);
      }

      if (Math.abs(x % 32) < 1) {
        const pillarX = x + 8;
        if (!isGateOpeningX(pillarX)) {
          batcher.addBox('stone_wall', 1.9, 2.1, 1.9, pillarX, groundY + 1.05, wallZ);
          batcher.addBox('stone_dark', 2.2, 0.35, 2.2, pillarX, groundY + 2.2, wallZ);
          addClassicalIronLamp(batcher, pillarX, groundY + 2.35, wallZ);
        }
      }
      world.addCollider(x, wallZ, 15.8, 1.4, groundY + 1.6, groundY);
    }
  }

  // Mureta Baixa Oeste e Leste (X = -490 e X = +490)
  for (const wallX of [westX, eastX]) {
    for (let z = northZ + 8; z <= southZ - 8; z += 16) {
      if (isGateOpeningZ(z)) continue;
      batcher.addBox('stone_dark', 1.35, 0.45, 15.6, wallX, groundY + 0.22, z);
      batcher.addBox('brick_red', 1.1, 0.75, 15.2, wallX, groundY + 0.82, z);
      batcher.addBox('stone_wall', 1.45, 0.28, 15.8, wallX, groundY + 1.34, z);

      for (let sz = z - 6; sz <= z + 6; sz += 2.0) {
        studPositions.push([wallX, groundY + 1.54, sz]);
      }

      if (Math.abs((z - northZ) % 32) < 1) {
        const pillarZ = z + 8;
        if (!isGateOpeningZ(pillarZ)) {
          batcher.addBox('stone_wall', 1.9, 2.1, 1.9, wallX, groundY + 1.05, pillarZ);
          batcher.addBox('stone_dark', 2.2, 0.35, 2.2, wallX, groundY + 2.2, pillarZ);
          addClassicalIronLamp(batcher, wallX, groundY + 2.35, pillarZ);
        }
      }
      world.addCollider(wallX, z, 1.4, 15.8, groundY + 1.6, groundY);
    }
  }

  // Instancia todos os Pinos de LEGO (Studs) do topo da mureta perimetral em 1 único InstancedMesh!
  if (studPositions.length > 0) {
    const studMat = getLegoMaterial(0x94a3b8, { roughness: 0.35 });
    const inst = new THREE.InstancedMesh(SHARED_STUD_GEO, studMat, studPositions.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < studPositions.length; i++) {
      const [sx, sy, sz] = studPositions[i];
      dummy.position.set(sx, sy, sz);
      dummy.scale.set(1.6, 1.4, 1.6);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    world.scene.add(inst);
  }

  // AS 4 ENTRADAS MONUMENTAIS (NORTE, SUL, LESTE E OESTE)
  buildMonumentalParkGate(world, batcher, 0, groundY, northZ, false, 'PARQUE CENTRAL ');
  buildMonumentalParkGate(world, batcher, 0, groundY, southZ, false, 'PARQUE CENTRAL ');
  buildMonumentalParkGate(world, batcher, westX, groundY, pz, true, 'PORTÃO OESTE ');
  buildMonumentalParkGate(world, batcher, eastX, groundY, pz, true, 'PORTÃO LESTE ');

  // Pilares Clássicos nos Portões Secundários das Trilhas (X = -355, -195, +205, +395)
  for (const gx of [-355, -195, 205, 395]) {
    for (const gz of [northZ, southZ]) {
      for (const side of [-1, 1]) {
        const pxGate = gx + side * 10.5;
        batcher.addBox('stone_wall', 2.8, 6.5, 2.8, pxGate, groundY + 3.25, gz);
        batcher.addBox('brick_red', 2.4, 4.2, 2.4, pxGate, groundY + 3.25, gz);
        batcher.addBox('gold', 3.2, 0.55, 3.2, pxGate, groundY + 6.6, gz);
        addClassicalIronLamp(batcher, pxGate, groundY + 6.9, gz);
        world.addCollider(pxGate, gz, 2.8, 2.8, groundY + 7.0, groundY);
      }
    }
  }
}

function addClassicalIronLamp(batcher, x, yBase, z) {
  batcher.addBox('iron_black', 0.65, 0.45, 0.65, x, yBase + 0.22, z);
  batcher.addBox('iron_black', 0.24, 3.8, 0.24, x, yBase + 2.1, z);
  batcher.addBox('iron_black', 1.4, 0.22, 0.22, x, yBase + 3.9, z);
  batcher.addBox('lamp_globe', 0.72, 0.72, 0.72, x, yBase + 4.35, z);
  batcher.addBox('lamp_globe', 0.48, 0.48, 0.48, x - 0.65, yBase + 4.2, z);
  batcher.addBox('lamp_globe', 0.48, 0.48, 0.48, x + 0.65, yBase + 4.2, z);
}

function buildMonumentalParkGate(world, batcher, gx, groundY, gz, isEastWest, gateTitle) {
  const span = 24.0;
  const halfSpan = span * 0.5;

  const stepW = isEastWest ? 6.5 : 26.0;
  const stepD = isEastWest ? 26.0 : 6.5;
  batcher.addBox('stone_path', stepW, 0.14, stepD, gx, groundY + 0.04, gz);
  batcher.addBox('gold', isEastWest ? 0.35 : 26.2, 0.16, isEastWest ? 26.2 : 0.35, gx, groundY + 0.05, gz);

  for (const side of [-1, 1]) {
    for (const outer of [0, 1]) {
      const offset = side * (halfSpan + outer * 4.2);
      const colX = isEastWest ? gx : gx + offset;
      const colZ = isEastWest ? gz + offset : gz;
      const colH = outer === 0 ? 12.5 : 9.8;

      batcher.addBox('stone_dark', 3.4, 1.8, 3.4, colX, groundY + 0.9, colZ);
      batcher.addBox('stone_wall', 2.8, colH - 2.6, 2.8, colX, groundY + 1.8 + (colH - 2.6) * 0.5, colZ);
      batcher.addBox('brick_red', 2.2, colH - 4.0, 2.2, colX, groundY + 2.4 + (colH - 4.0) * 0.5, colZ);
      batcher.addBox('gold', 3.5, 0.75, 3.5, colX, groundY + colH - 0.4, colZ);
      addClassicalIronLamp(batcher, colX, groundY + colH, colZ);

      world.addCollider(colX, colZ, 3.2, 3.2, groundY + colH, groundY);
    }
  }

  const archW = isEastWest ? 3.6 : span + 4.0;
  const archD = isEastWest ? span + 4.0 : 3.6;
  batcher.addBox('stone_wall', archW, 2.2, archD, gx, groundY + 12.2, gz);
  batcher.addBox('gold', isEastWest ? 3.9 : span + 4.6, 0.65, isEastWest ? span + 4.6 : 3.9, gx, groundY + 13.5, gz);
  batcher.addBox('stone_dark', isEastWest ? 3.2 : 14.0, 1.6, isEastWest ? 14.0 : 3.2, gx, groundY + 14.5, gz);
  world.addCollider(gx, gz, archW, archD, groundY + 15.2, groundY + 11.0);

  const signMesh = createSignBoardMesh({
    x: gx,
    y: groundY + 12.3,
    z: gz,
    width: 18.0,
    height: 2.6,
    depth: 0.65,
    rotY: isEastWest ? Math.PI / 2 : 0,
    title: gateTitle,
    bgColor: '#0f172a',
    borderColor: '#facc15',
    textColor: '#facc15',
    doubleSided: true
  });
  world.scene.add(signMesh);
}

/**
 * 2. REDE DENSA DE CAMINHOS & TRILHAS NA SELVA DO PARQUE, PRAÇA CIRCULAR CENTRAL,
 *       CHAFARIZ DE 3 CAMADAS, BANCOS, LIXEIRAS, BEBEDOUROS, 3 CORETOS & 6 CARRINHOS QUEBRÁVEIS!
 */
function buildPavedPathsCentralPlazaAndFountain(world, batcher, px, pz, pw, pd, groundY) {
  // ============================================================================
  // 2A. REDE COMPLETA DE ALAMEDAS E TRILHAS DE PEDRA CORTANDO A FLORESTA DO PARQUE!
  // ============================================================================
  // 1. Alameda Central Leste-Oeste (Z = 268):
  //    - Trecho Oeste até o Grande Lago (X = -488..+72, comprimento 560m, largura 15m)
  batcher.addBox('stone_dark', 560, 0.06, 15.4, -208, groundY + 0.02, pz);
  batcher.addBox('stone_path', 558, 0.08, 13.8, -208, groundY + 0.04, pz);
  //    - Trecho Leste do Grande Lago até o Portão Leste (X = +338..+488, comprimento 150m)
  batcher.addBox('stone_dark', 150, 0.06, 15.4, 413, groundY + 0.02, pz);
  batcher.addBox('stone_path', 148, 0.08, 13.8, 413, groundY + 0.04, pz);

  // 2. DUAS NOVAS ALAMEDAS FLORESTAIS LONGITUDINAIS (Norte Z = 178 e Sul Z = 358, de X = -488 a +488!)
  //    Essas duas trilhas atravessam os bosques Norte e Sul inteiros e contornam as margens do Grande Lago!
  for (const trailZ of [178, 358]) {
    batcher.addBox('stone_dark', 976, 0.05, 9.6, 0, groundY + 0.02, trailZ);
    batcher.addBox('stone_path', 974, 0.07, 8.2, 0, groundY + 0.035, trailZ);
  }

  // 3. DUAS TRILHAS INTERMEDIÁRIAS NA MATA OESTE (Z = 212 e Z = 324, de X = -465 até X = -40, ligando os 3 Coretos!)
  for (const midZ of [212, 324]) {
    batcher.addBox('stone_dark', 425, 0.05, 8.4, -252.5, groundY + 0.02, midZ);
    batcher.addBox('stone_path', 423, 0.07, 7.2, -252.5, groundY + 0.035, midZ);
  }

  // 4. SETE CAMINHOS TRANSVERSAIS NORTE-SUL CORTANDO A SELVA DE PONTA A PONTA (Z = 152..384):
  //    X = -435, X = -355, X = -275, X = -195, X = -105, X = 0 (Alameda Principal), X = +395, X = +450
  const northSouthTrailsX = [-435, -355, -275, -195, -105, 395, 450];
  for (const tx of northSouthTrailsX) {
    batcher.addBox('stone_dark', 9.2, 0.05, pd - 4, tx, groundY + 0.02, pz);
    batcher.addBox('stone_path', 7.8, 0.07, pd - 6, tx, groundY + 0.035, pz);
  }

  // Alameda Central Norte-Sul (X = 0, Z = 152..384, largura 18m)
  batcher.addBox('stone_dark', 19.6, 0.06, pd - 2, px, groundY + 0.02, pz);
  batcher.addBox('stone_path', 18.0, 0.08, pd - 4, px, groundY + 0.04, pz);

  // Acesso Norte e Sul à Ponte Arqueada do Lago (X = +205)
  batcher.addBox('stone_path', 14.0, 0.07, 36, 205, groundY + 0.035, 170);
  batcher.addBox('stone_path', 14.0, 0.07, 36, 205, groundY + 0.035, 366);

  // 5. QUATRO TRILHAS DIAGONAIS DE PLACAS DE PEDRA (STEPPING STONES) SERPENTEANDO PELA MATA!
  const diagTrails = [
    { x1: -355, z1: 212, x2: -275, z2: 268 },
    { x1: -355, z1: 324, x2: -275, z2: 268 },
    { x1: -195, z1: 268, x2: -135, z2: 212 },
    { x1: -105, z1: 324, x2: -32,  z2: 268 }
  ];
  for (const dt of diagTrails) {
    const steps = 16;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sx = dt.x1 + (dt.x2 - dt.x1) * t;
      const sz = dt.z1 + (dt.z2 - dt.z1) * t;
      batcher.addBox('stone_path', 5.4, 0.08, 5.4, sx, groundY + 0.04, sz);
    }
  }

  // ============================================================================
  // PRAÇA CIRCULAR NO CENTRO DO PARQUE (X = 0, Z = 268, Raio 38m)
  // ============================================================================
  const plazaDiscOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(38.0, 38.0, 0.1, 40),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.34 })
  );
  plazaDiscOuter.position.set(px, groundY + 0.05, pz);
  plazaDiscOuter.receiveShadow = true;

  const plazaRingTerracotta = new THREE.Mesh(
    new THREE.CylinderGeometry(28.0, 28.0, 0.12, 36),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.36 })
  );
  plazaRingTerracotta.position.set(px, groundY + 0.06, pz);
  plazaRingTerracotta.receiveShadow = true;

  const plazaInnerMarble = new THREE.Mesh(
    new THREE.CylinderGeometry(22.0, 22.0, 0.14, 36),
    getLegoMaterial(0xf8fafc, { roughness: 0.2 })
  );
  plazaInnerMarble.position.set(px, groundY + 0.07, pz);
  plazaInnerMarble.receiveShadow = true;
  world.scene.add(plazaDiscOuter, plazaRingTerracotta, plazaInnerMarble);

  // ============================================================================
  // CHAFARIZ / FONTE MONUMENTAL DE ÁGUA EM 3 CAMADAS (X = 0, Z = 268)
  // ============================================================================
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(px, groundY + 0.1, pz);

  const stoneMat = getLegoMaterial(0xf1f5f9, { roughness: 0.22, clearcoat: 0.6 });
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.72, roughness: 0.15 });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.06,
    clearcoat: 0.95,
    transparent: true,
    opacity: 0.88
  });

  const outerRim = new THREE.Mesh(new THREE.CylinderGeometry(10.6, 11.2, 1.35, 28), stoneMat);
  outerRim.position.y = 0.68;
  const poolWater = new THREE.Mesh(new THREE.CylinderGeometry(9.8, 9.8, 1.05, 28), waterMat);
  poolWater.position.y = 0.55;
  const colPedestal1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 3.4, 20), stoneMat);
  colPedestal1.position.y = 1.7;

  const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 4.2, 0.95, 24), stoneMat);
  midBowl.position.y = 3.4;
  const midWater = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.35, 24), waterMat);
  midWater.position.y = 3.78;
  const colPedestal2 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 2.8, 16), goldMat);
  colPedestal2.position.y = 4.8;

  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 2.1, 0.75, 20), stoneMat);
  topBowl.position.y = 6.2;
  const topSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 2.2, 16), goldMat);
  topSpire.position.y = 7.4;

  fountainGroup.add(outerRim, poolWater, colPedestal1, midBowl, midWater, colPedestal2, topBowl, topSpire);

  const waterJetsGroup = new THREE.Group();
  const jetDropMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const jetFoamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let j = 0; j < 16; j++) {
    const ang = (j / 16) * Math.PI * 2;
    const dropTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 2.4, 0.28),
      j % 2 === 0 ? jetDropMat : jetFoamMat
    );
    dropTop.position.set(Math.cos(ang) * 3.1, 4.9, Math.sin(ang) * 3.1);
    const dropMid = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 2.6, 0.34),
      j % 2 === 0 ? jetFoamMat : jetDropMat
    );
    dropMid.position.set(Math.cos(ang) * 5.8, 2.1, Math.sin(ang) * 5.8);
    const crownJet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.8, 0.32), jetFoamMat);
    crownJet.position.set(Math.cos(ang) * 1.1, 8.8 + (j % 3) * 0.4, Math.sin(ang) * 1.1);
    waterJetsGroup.add(dropTop, dropMid, crownJet);
  }
  fountainGroup.add(waterJetsGroup);
  world.scene.add(fountainGroup);
  world.rotatingElements.push({ mesh: waterJetsGroup, axis: 'y', speed: 2.2 });

  world.addCollider(px, pz, 5.8, 5.8, groundY + 8.5, groundY);
  world.mapWater.push({ x: px, z: pz, w: 21, d: 21 });

  // 20 Studs Dourados, Azuis e Roxos dentro da água do Chafariz Central!
  if (world.destructibles && typeof world.destructibles.spawnAmbientStud === 'function') {
    for (let s = 0; s < 20; s++) {
      const ang = (s / 20) * Math.PI * 2;
      const rad = s % 2 === 0 ? 7.6 : 5.4;
      const tier = s % 5 === 0 ? 'purple' : s % 2 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(
        px + Math.cos(ang) * rad,
        groundY + 1.18,
        pz + Math.sin(ang) * rad,
        tier
      );
    }
  }

  // Postes Clássicos de Ferro Preto com Globos Amarelos ao longo dos Caminhos e da Praça
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + Math.PI / 8;
    addClassicalIronLamp(batcher, px + Math.cos(ang) * 35.5, groundY, pz + Math.sin(ang) * 35.5);
  }
  for (let lx = -450; lx <= 450; lx += 52) {
    if (Math.abs(lx) < 42 || (lx > 55 && lx < 345)) continue;
    addClassicalIronLamp(batcher, lx, groundY, pz - 8.2);
    addClassicalIronLamp(batcher, lx, groundY, pz + 8.2);
    addClassicalIronLamp(batcher, lx, groundY, 178 - 5.2);
    addClassicalIronLamp(batcher, lx, groundY, 358 + 5.2);
  }

  // BANCOS DE MADEIRA, LIXEIRAS E BEBEDOUROS AO LONGO DOS CAMINHOS E TRILHAS
  for (let b = 0; b < 8; b++) {
    const ang = (b / 8) * Math.PI * 2;
    const bxBench = px + Math.cos(ang) * 31.0;
    const bzBench = pz + Math.sin(ang) * 31.0;
    addParkBenchTrashAndFountain(batcher, bxBench, groundY, bzBench, b % 2 === 0);
  }
  for (let bxPath = -440; bxPath <= 440; bxPath += 54) {
    if (Math.abs(bxPath) < 48 || (bxPath > 50 && bxPath < 350)) continue;
    addParkBenchTrashAndFountain(batcher, bxPath, groundY, pz - 8.6, true);
    addParkBenchTrashAndFountain(batcher, bxPath, groundY, pz + 8.6, false);
    addParkBenchTrashAndFountain(batcher, bxPath, groundY, 183.5, false);
    addParkBenchTrashAndFountain(batcher, bxPath, groundY, 352.5, false);
  }

  // 3 QUIOSQUES DE MADEIRA (CORETO / GAZEBO CLÁSSICO OCTOGONAL)
  const gazeboCoords = [
    [-355, 212],
    [-355, 324],
    [-135, 212]
  ];
  for (const [gx, gz] of gazeboCoords) {
    buildWoodenGazeboCoreto(world, batcher, gx, groundY, gz);
  }

  // 6 CARRINHOS DE CACHORRO-QUENTE / SORVETE COM GUARDA-SOL COLORIDO (QUEBRÁVEIS!)
  const cartSpecs = [
    { x: -24, z: 236, color: LEGO_COLORS.red, umbrella: LEGO_COLORS.yellow },
    { x: 24,  z: 236, color: 0xec4899,        umbrella: 0x38bdf8 },
    { x: -24, z: 300, color: 0xf97316,        umbrella: LEGO_COLORS.red },
    { x: 24,  z: 300, color: 0x38bdf8,        umbrella: 0xec4899 },
    { x: -195, z: 256, color: LEGO_COLORS.yellow, umbrella: LEGO_COLORS.red },
    { x: 52,   z: 256, color: 0x22c55e,        umbrella: LEGO_COLORS.yellow }
  ];
  for (const cfg of cartSpecs) {
    spawnBreakableFoodCart(world, cfg.x, groundY, cfg.z, cfg.color, cfg.umbrella);
  }
}

function addParkBenchTrashAndFountain(batcher, x, yBase, z, includeExtras) {
  batcher.addBox('iron_black', 0.25, 0.55, 1.3, x - 1.5, yBase + 0.28, z);
  batcher.addBox('iron_black', 0.25, 0.55, 1.3, x + 1.5, yBase + 0.28, z);
  batcher.addBox('wood_light', 3.6, 0.16, 1.2, x, yBase + 0.58, z);
  batcher.addBox('wood_brown', 3.6, 0.72, 0.18, x, yBase + 0.98, z - 0.52);

  if (includeExtras) {
    batcher.addBox('iron_black', 0.75, 1.15, 0.75, x + 2.6, yBase + 0.58, z);
    batcher.addBox('gold', 0.82, 0.18, 0.82, x + 2.6, yBase + 1.2, z);
    batcher.addBox('stone_wall', 0.7, 1.05, 0.7, x - 2.6, yBase + 0.52, z);
    batcher.addBox('white_marble', 0.9, 0.22, 0.9, x - 2.6, yBase + 1.1, z);
    batcher.addBox('water_bright', 0.22, 0.28, 0.22, x - 2.6, yBase + 1.32, z);
  }
}

function buildWoodenGazeboCoreto(world, batcher, gx, yBase, gz) {
  batcher.addBox('stone_wall', 16.5, 0.85, 16.5, gx, yBase + 0.42, gz);
  batcher.addBox('wood_brown', 15.6, 0.3, 15.6, gx, yBase + 0.98, gz);
  batcher.addBox('wood_light', 5.2, 0.45, 2.2, gx, yBase + 0.22, gz + 9.0);

  const deckY = yBase + 1.12;
  const posts = [
    [-6.5, -6.5], [0, -6.8], [6.5, -6.5],
    [-6.8, 0],               [6.8, 0],
    [-6.5, 6.5],             [6.5, 6.5]
  ];
  for (const [dx, dz] of posts) {
    batcher.addBox('white_marble', 0.55, 4.6, 0.55, gx + dx, deckY + 2.3, gz + dz);
  }
  batcher.addBox('wood_light', 14.0, 0.95, 0.3, gx, deckY + 0.5, gz - 6.6);
  batcher.addBox('wood_light', 0.3, 0.95, 14.0, gx - 6.6, deckY + 0.5, gz);
  batcher.addBox('wood_light', 0.3, 0.95, 14.0, gx + 6.6, deckY + 0.5, gz);

  batcher.addBox('brick_red', 17.8, 0.9, 17.8, gx, deckY + 5.0, gz);
  batcher.addBox('wood_brown', 13.2, 0.95, 13.2, gx, deckY + 5.9, gz);
  batcher.addBox('brick_red', 8.2, 1.0, 8.2, gx, deckY + 6.85, gz);
  batcher.addBox('gold', 2.2, 1.8, 2.2, gx, deckY + 8.1, gz);

  world.addCollider(gx, gz, 15.5, 15.5, deckY + 8.5, yBase);
  world.mapBuildings.push({
    x: gx,
    z: gz,
    w: 16.5,
    d: 16.5,
    height: 9.5,
    color: '#9a3412',
    label: 'CORETO DO PARQUE'
  });
}

function spawnBreakableFoodCart(world, x, yBase, z, bodyColor, umbrellaColor) {
  const cartGroup = new THREE.Group();
  cartGroup.position.set(x, yBase, z);

  const body = createLegoBrick(2.6, 1.25, 1.6, bodyColor, { studStep: 0.55 });
  body.position.y = 0.85;
  const counterTop = createLegoBrick(2.8, 0.22, 1.8, LEGO_COLORS.white, { studStep: 0.5 });
  counterTop.position.y = 1.58;

  const wheelMat = getLegoMaterial(LEGO_COLORS.black);
  for (const wx of [-0.9, 0.9]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.85, 14), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.42, 0);
    cartGroup.add(wheel);
  }

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8),
    getLegoMaterial(LEGO_COLORS.silver)
  );
  pole.position.y = 2.7;
  const umbrella = createLegoBrick(3.6, 0.42, 3.6, umbrellaColor, { studStep: 0.7 });
  umbrella.position.y = 3.85;
  const umbrellaTop = createLegoBrick(1.8, 0.35, 1.8, LEGO_COLORS.white);
  umbrellaTop.position.y = 4.22;

  cartGroup.add(body, counterTop, pole, umbrella, umbrellaTop);
  world.scene.add(cartGroup);

  const col = world.addCollider(x, z, 2.8, 1.9, yBase + 4.2, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: cartGroup,
      type: 'newsstand',
      hp: 24,
      radius: 1.9,
      height: 4.0,
      colliders: [col],
      debrisColors: [bodyColor, umbrellaColor, LEGO_COLORS.white, LEGO_COLORS.yellow],
      studDrops: { silver: 5, gold: 5, blue: 1, purple: 0 },
      groundY: yBase
    });
  }
}

/**
 * 3. O GRANDE LAGO NAVEGÁVEL, PÍER DE BARQUINHOS/PEDALINHOS & PONTE ARQUEADA CLÁSSICA
 */
function buildGrandLakeBoatsAndArchedBridge(world, batcher, px, pz, groundY) {
  const lakeX = 205;
  const lakeZ = pz;
  const lakeW = 270;
  const lakeD = 162;

  const deepBed = new THREE.Mesh(
    new THREE.BoxGeometry(lakeW + 2, 0.12, lakeD + 2),
    new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.3 })
  );
  deepBed.position.set(lakeX, groundY + 0.02, lakeZ);

  const lakeSurface = new THREE.Mesh(
    new THREE.BoxGeometry(lakeW, 0.24, lakeD),
    new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      roughness: 0.05,
      metalness: 0.08,
      clearcoat: 0.96,
      transparent: true,
      opacity: 0.86
    })
  );
  lakeSurface.position.set(lakeX, groundY + 0.12, lakeZ);
  lakeSurface.receiveShadow = true;
  world.scene.add(deepBed, lakeSurface);
  world.mapWater.push({ x: lakeX, z: lakeZ, w: lakeW, d: lakeD });

  const minLX = lakeX - lakeW * 0.5; // +70
  const maxLX = lakeX + lakeW * 0.5; // +340
  const minLZ = lakeZ - lakeD * 0.5; // 187
  const maxLZ = lakeZ + lakeD * 0.5; // 349

  let rockSeed = 1;
  for (let rx = minLX; rx <= maxLX; rx += 8.5) {
    if (Math.abs(rx - lakeX) < 12) continue;
    for (const rz of [minLZ, maxLZ]) {
      const rw = 6.5 + (rockSeed % 4) * 1.4;
      const rh = 0.75 + (rockSeed % 3) * 0.45;
      const rd = 4.2 + (rockSeed % 3) * 1.0;
      batcher.addBox(rockSeed % 2 === 0 ? 'stone_wall' : 'stone_dark', rw, rh, rd, rx, groundY + rh * 0.5, rz);
      rockSeed++;
    }
  }
  for (let rz = minLZ + 8; rz <= maxLZ - 8; rz += 8.5) {
    for (const rx of [minLX, maxLX]) {
      if (rx === minLX && Math.abs(rz - lakeZ) < 16) continue;
      const rw = 4.2 + (rockSeed % 3) * 1.0;
      const rh = 0.75 + (rockSeed % 3) * 0.45;
      const rd = 6.5 + (rockSeed % 4) * 1.4;
      batcher.addBox(rockSeed % 2 === 0 ? 'stone_dark' : 'stone_wall', rw, rh, rd, rx, groundY + rh * 0.5, rz);
      rockSeed++;
    }
  }

  // Píer de Madeira na margem Oeste do Lago
  const pierX = minLX + 16;
  const pierW = 36;
  const pierD = 16;
  batcher.addBox('wood_brown', pierW, 0.45, pierD, pierX, groundY + 0.42, lakeZ);
  for (const pxPile of [pierX - 12, pierX, pierX + 14]) {
    for (const pzPile of [lakeZ - 6.5, lakeZ + 6.5]) {
      batcher.addBox('wood_light', 0.65, 1.3, 0.65, pxPile, groundY + 0.65, pzPile);
    }
  }
  world.addCollider(pierX, lakeZ, pierW, pierD, groundY + 0.65, groundY);

  // Os 8 Pedalinhos Cisne e Barcos do Lago agora são veículos interativos reais (em NavalAndAirFleetBuilder.js)!

  // PONTE ARQUEADA CLÁSSICA DE PEDRA E MADEIRA (X = 205)
  const bridgeX = lakeX;
  const bridgeW = 16.0;
  const rampSteps = [
    { zOffset: 76, d: 10, topY: groundY + 0.55, minY: groundY },
    { zOffset: 66, d: 10, topY: groundY + 1.10, minY: groundY },
    { zOffset: 56, d: 10, topY: groundY + 1.65, minY: groundY },
    { zOffset: 46, d: 10, topY: groundY + 2.20, minY: groundY },
    { zOffset: 36, d: 10, topY: groundY + 2.80, minY: groundY + 1.4 },
    { zOffset: 26, d: 10, topY: groundY + 3.45, minY: groundY + 2.2 }
  ];

  for (const side of [-1, 1]) {
    for (const st of rampSteps) {
      const sz = lakeZ + side * st.zOffset;
      const slabH = st.topY - st.minY;
      batcher.addBox('stone_wall', bridgeW, slabH, st.d + 0.4, bridgeX, st.minY + slabH * 0.5, sz);
      batcher.addBox('wood_brown', bridgeW - 2.4, 0.22, st.d + 0.2, bridgeX, st.topY + 0.08, sz);
      batcher.addBox('stone_dark', 0.9, 1.15, st.d + 0.4, bridgeX - bridgeW * 0.5 + 0.45, st.topY + 0.55, sz);
      batcher.addBox('stone_dark', 0.9, 1.15, st.d + 0.4, bridgeX + bridgeW * 0.5 - 0.45, st.topY + 0.55, sz);
      batcher.addBox('wood_light', 1.1, 0.25, st.d + 0.4, bridgeX - bridgeW * 0.5 + 0.45, st.topY + 1.2, sz);
      batcher.addBox('wood_light', 1.1, 0.25, st.d + 0.4, bridgeX + bridgeW * 0.5 - 0.45, st.topY + 1.2, sz);

      world.addCollider(bridgeX, sz, bridgeW, st.d, st.topY + 0.15, st.minY);
    }

    const pierZ = lakeZ + side * 21.0;
    batcher.addBox('stone_dark', bridgeW + 1.6, 4.2, 3.6, bridgeX, groundY + 2.1, pierZ);
    world.addCollider(bridgeX, pierZ, bridgeW + 1.2, 3.4, groundY + 4.2, groundY);
  }

  const archSpanD = 42.0;
  const archMinY = groundY + 3.25;
  const archTopY = groundY + 4.0;
  batcher.addBox('stone_wall', bridgeW, 0.75, archSpanD, bridgeX, archMinY + 0.38, lakeZ);
  batcher.addBox('wood_brown', bridgeW - 2.4, 0.24, archSpanD, bridgeX, archTopY + 0.1, lakeZ);
  for (const sideX of [-1, 1]) {
    const railX = bridgeX + sideX * (bridgeW * 0.5 - 0.45);
    batcher.addBox('stone_dark', 0.9, 1.2, archSpanD, railX, archTopY + 0.6, lakeZ);
    batcher.addBox('wood_light', 1.15, 0.28, archSpanD, railX, archTopY + 1.28, lakeZ);
    addClassicalIronLamp(batcher, railX, archTopY + 1.35, lakeZ - 12);
    addClassicalIronLamp(batcher, railX, archTopY + 1.35, lakeZ + 12);
  }
  world.addCollider(bridgeX, lakeZ, bridgeW, archSpanD, archTopY + 0.18, archMinY);
}

function addLakePedalBoatOrRowboat(batcher, x, yWater, z, colorKey, isSwan) {
  batcher.addBox('water_foam', 3.4, 0.08, 5.4, x, yWater - 0.04, z);
  batcher.addBox(colorKey, 2.8, 0.55, 4.6, x, yWater + 0.25, z);
  batcher.addBox('white_marble', 2.2, 0.42, 2.6, x, yWater + 0.62, z - 0.3);

  if (isSwan) {
    batcher.addBox('white_marble', 0.65, 2.1, 0.65, x, yWater + 1.5, z + 1.5);
    batcher.addBox('white_marble', 0.85, 0.75, 1.1, x, yWater + 2.45, z + 1.8);
    batcher.addBox('autumn_orange', 0.55, 0.35, 0.75, x, yWater + 2.38, z + 2.45);
    batcher.addBox('white_marble', 0.35, 1.1, 2.8, x - 1.35, yWater + 0.95, z - 0.2);
    batcher.addBox('white_marble', 0.35, 1.1, 2.8, x + 1.35, yWater + 0.95, z - 0.2);
  } else {
    batcher.addBox('wood_brown', 2.6, 0.22, 0.55, x, yWater + 0.65, z - 0.6);
    batcher.addBox('wood_brown', 2.6, 0.22, 0.55, x, yWater + 0.65, z + 0.8);
    batcher.addBox('wood_light', 4.6, 0.14, 0.22, x, yWater + 0.68, z);
  }
}

/**
 * 4. SELVA / FLORESTA URBANA DENSA COM MAIS DE 550 ÁRVORES GIGANTES (18m A 38m DE ALTURA!),
 *       GALHOS ABERTOS, CIPÓS PENDURADOS, SALGUEIROS-CHORÕES, SAMAMBAIAS, ROCHAS MUSGOSAS E FLORES!
 */
function buildDenseJungleForestVegetation(world, batcher, px, pz, pw, pd, groundY) {
  const halfW = pw * 0.5 - 8; // 482
  const halfD = pd * 0.5 - 7; // 109

  // Função precisa que mantém as Alamedas, Trilhas, Praça Central, Coretos e Lago desimpedidos no chão,
  // permitindo que as árvores fiquem coladas nas bordas das trilhas e fechem as copas por cima!
  const isClearForTreeTrunk = (x, z) => {
    // Alamedas Horizontais (Z = 268 Central, Z = 178 Norte, Z = 358 Sul)
    if (Math.abs(z - pz) < 9.2) return false;
    if (Math.abs(z - 178) < 6.2) return false;
    if (Math.abs(z - 358) < 6.2) return false;
    // Trilhas Horizontais dos Coretos na Mata Oeste (Z = 212 e Z = 324, X < -35)
    if (x < -35 && (Math.abs(z - 212) < 5.5 || Math.abs(z - 324) < 5.5)) return false;

    // 8 Caminhos Transversais Norte-Sul
    for (const txPath of [-435, -355, -275, -195, -105, 0, 205, 395, 450]) {
      const clearW = txPath === 0 ? 11.0 : txPath === 205 ? 10.5 : 5.8;
      if (Math.abs(x - txPath) < clearW) return false;
    }

    // Praça Circular Central da Fonte (Raio 39.5m)
    if (Math.hypot(x - px, z - pz) < 39.5) return false;

    // Grande Lago Leste (X = 68..342, Z = 185..351)
    if (x > 68 && x < 342 && z > 185 && z < 351) return false;

    // Os 3 Coretos/Gazebos
    if (Math.hypot(x + 355, z - 212) < 12.5) return false;
    if (Math.hypot(x + 355, z - 324) < 12.5) return false;
    if (Math.hypot(x + 135, z - 212) < 12.5) return false;

    // Viaduto Panorâmico Norte-Sul (X = +252) & Mirante Circular / Rampas da Colina Oeste (-215, 296)
    if (Math.abs(x - 252) < 14.5) return false;
    if (Math.hypot(x + 215, z - 296) < 19.5) return false;
    if (Math.hypot(x + 408, z - 268) < 12.0) return false;
    if (x >= -205 && x <= -120 && Math.abs(z - 296) < 7.5) return false;
    if (z >= 238 && z <= 284 && Math.abs(x + 215) < 7.5) return false;

    return true;
  };

  // Gerador pseudo-aleatório determinístico para distribuir a selva de forma 100% orgânica e variada
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const autumnKeys = ['autumn_orange', 'autumn_yellow', 'autumn_red', 'flower_pink'];
  const flowerKeys = ['flower_pink', 'flower_yellow', 'flower_red', 'flower_purple', 'flower_cyan'];
  const canopyGreenKeys = ['oak_dark', 'oak_mid', 'jungle_lush', 'willow_lime'];

  // ============================================================================
  // 4A. MALHA DENSA E ORGÂNICA DE ÁRVORES GIGANTES (PASSO DE 14m X 13m COM JITTER FORTE!)
  //     Cria mais de 550 árvores de 18m a 38m de altura que cobrem o Parque como uma Selva!
  // ============================================================================
  for (let gx = -halfW; gx <= halfW; gx += 14.5) {
    for (let gz = pz - halfD; gz <= pz + halfD; gz += 13.5) {
      const tx = gx + (rand() - 0.5) * 11.5;
      const tz = gz + (rand() - 0.5) * 10.5;

      if (!isClearForTreeTrunk(tx, tz)) continue;

      const treeY = Math.max(groundY, world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, tz) : groundY);

      // Escala vertical alta (1.35x a 2.65x -> árvores de 18m até 38m de altura!)
      const hScale = 1.35 + rand() * 1.3;
      const wScale = 1.25 + rand() * 0.95;
      const rType = rand();

      if (rType < 0.42) {
        // 1. CARVALHO / SEQUOIA GIGANTE DE SELVA (Copa colossal com galhos abertos e cipós pendurados!)
        const leafKey = canopyGreenKeys[Math.floor(rand() * canopyGreenKeys.length)];
        const leafKey2 = canopyGreenKeys[Math.floor(rand() * canopyGreenKeys.length)];
        addColossalJungleCanopyTree(batcher, tx, treeY, tz, wScale, hScale, leafKey, leafKey2, rand() < 0.65);
      } else if (rType < 0.72) {
        // 2. ÁRVORE GIGANTE DE OUTONO / IPÊ (Laranja, Amarela, Vermelha ou Rosa-Ipê!)
        const autKey = autumnKeys[Math.floor(rand() * autumnKeys.length)];
        addGiantAutumnTree(batcher, tx, treeY, tz, wScale, hScale, autKey);
      } else {
        // 3. PINHEIRO / ARAUCÁRIA GIGANTE DE FLORESTA (20m a 36m de altura!)
        addGiantConiferPineTree(batcher, tx, treeY, tz, wScale, hScale);
      }
      batcher.treeCount++;

      // Sub-bosque denso ao redor de cada árvore: Samambaias Gigantes, Arbustos Floridos e Rochas Musgosas!
      const underCount = 1 + Math.floor(rand() * 2);
      for (let u = 0; u < underCount; u++) {
        const ux = tx + (rand() - 0.5) * 8.5;
        const uz = tz + (rand() - 0.5) * 8.5;
        if (!isClearForTreeTrunk(ux, uz)) continue;
        const underY = Math.max(groundY, world.getTerrainHeightAt ? world.getTerrainHeightAt(ux, uz) : groundY);
        const flKey = flowerKeys[Math.floor(rand() * flowerKeys.length)];
        addJungleUndergrowthCluster(batcher, ux, underY, uz, 0.9 + rand() * 0.9, flKey, u % 2 === 0);
        batcher.undergrowthCount++;
      }
    }
  }

  // ============================================================================
  // 4B. SALGUEIROS-CHORÕES GIGANTES (WEEPING WILLOWS) CONTORNANDO O GRANDE LAGO E A PRAÇA!
  // ============================================================================
  // Ao redor da margem do Grande Lago (X = 68..342, Z = 185..351)
  for (let wx = 78; wx <= 332; wx += 24) {
    if (Math.abs(wx - 205) < 16 || Math.abs(wx - 252) < 16) continue;
    addGiantWeepingWillow(batcher, wx + (rand() - 0.5) * 5, groundY, 184, 1.35 + rand() * 0.45);
    addGiantWeepingWillow(batcher, wx + (rand() - 0.5) * 5, groundY, 352, 1.35 + rand() * 0.45);
    batcher.treeCount += 2;
  }
  for (let wz = 200; wz <= 336; wz += 24) {
    if (Math.abs(wz - pz) < 18) continue;
    addGiantWeepingWillow(batcher, 66, groundY, wz + (rand() - 0.5) * 5, 1.4 + rand() * 0.4);
    addGiantWeepingWillow(batcher, 344, groundY, wz + (rand() - 0.5) * 5, 1.4 + rand() * 0.4);
    batcher.treeCount += 2;
  }

  // Anel Monumental de Árvores Gigantes de Outono e Carvalhos cercando a Praça Circular Central!
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    const ax = px + Math.cos(ang) * 43.0;
    const az = pz + Math.sin(ang) * 43.0;
    if (!isClearForTreeTrunk(ax, az)) continue;
    if (a % 2 === 0) {
      addGiantAutumnTree(batcher, ax, groundY, az, 1.45, 1.75, autumnKeys[a % autumnKeys.length]);
    } else {
      addColossalJungleCanopyTree(batcher, ax, groundY, az, 1.5, 1.85, 'oak_dark', 'jungle_lush', true);
    }
    batcher.treeCount++;
  }

  // 32 Canteiros de Flores Silvestres e Arbustos ao longo das Alamedas e Entradas!
  const flowerBedCoords = [
    [-420, 257], [-420, 279], [-315, 257], [-315, 279],
    [-235, 257], [-235, 279], [-150, 257], [-150, 279],
    [-70, 257],  [-70, 279],  [365, 257],  [365, 279],
    [425, 257],  [425, 279],  [-14, 168],  [14, 168],
    [-14, 202],  [14, 202],   [-14, 334],  [14, 334],
    [-14, 368],  [14, 368],   [130, 170],  [280, 170],
    [130, 366],  [280, 366]
  ];
  flowerBedCoords.forEach(([fx, fz], fIdx) => {
    const flKey1 = flowerKeys[fIdx % flowerKeys.length];
    const flKey2 = flowerKeys[(fIdx + 2) % flowerKeys.length];
    batcher.addBox('stone_wall', 6.4, 0.42, 3.2, fx, groundY + 0.21, fz);
    batcher.addBox('bush_green', 5.8, 0.55, 2.6, fx, groundY + 0.35, fz);
    for (let bxFl = -2.2; bxFl <= 2.2; bxFl += 1.1) {
      batcher.addBox(bxFl < 0 ? flKey1 : flKey2, 0.78, 0.5, 0.78, fx + bxFl, groundY + 0.75, fz - 0.5);
      batcher.addBox(bxFl < 0 ? flKey2 : flKey1, 0.78, 0.5, 0.78, fx + bxFl, groundY + 0.75, fz + 0.5);
    }
  });
}

/**
 * 1. CARVALHO / SEQUOIA ANCIÃ GIGANTE DE SELVA (18m a 38m de altura!)
 * - Raízes largas no chão, tronco grosso, galhos laterais de madeira, 5 camadas largas de copa e cipós pendurados!
 */
function addColossalJungleCanopyTree(batcher, x, yBase, z, ws, hs, leafKey1, leafKey2, hasVines) {
  const trunkH = 9.5 * hs;
  const trunkW = 1.65 * ws;

  // Raízes largas expostas na base + Tronco Principal Colossal
  batcher.addBox('wood_brown', trunkW * 1.9, 1.3 * hs, trunkW * 0.85, x, yBase + 0.65 * hs, z);
  batcher.addBox('wood_brown', trunkW * 0.85, 1.3 * hs, trunkW * 1.9, x, yBase + 0.65 * hs, z);
  batcher.addBox('wood_brown', trunkW, trunkH, trunkW, x, yBase + trunkH * 0.5, z);

  // Galhos Grossos Laterais sustentando a Copa Gigante
  const branchY = yBase + trunkH * 0.78;
  batcher.addBox('wood_light', 6.8 * ws, 0.9 * hs, 0.95 * ws, x, branchY, z);
  batcher.addBox('wood_light', 0.95 * ws, 0.9 * hs, 6.8 * ws, x, branchY + 0.8 * hs, z);

  // 5 Blocos Frondosos Gigantes formando um Dossel de Selva (12m a 22m de largura de copa!)
  const cBaseY = yBase + trunkH * 0.82;
  batcher.addBox(leafKey1, 10.5 * ws, 3.8 * hs, 10.5 * ws, x, cBaseY + 1.6 * hs, z);
  batcher.addBox(leafKey2, 8.6 * ws, 3.4 * hs, 8.2 * ws, x - 2.6 * ws, cBaseY + 3.4 * hs, z + 1.8 * ws);
  batcher.addBox(leafKey2, 8.2 * ws, 3.4 * hs, 8.6 * ws, x + 2.5 * ws, cBaseY + 3.8 * hs, z - 1.8 * ws);
  batcher.addBox(leafKey1, 7.6 * ws, 3.2 * hs, 7.6 * ws, x, cBaseY + 5.8 * hs, z);
  batcher.addBox(leafKey2, 4.8 * ws, 2.4 * hs, 4.8 * ws, x, cBaseY + 8.0 * hs, z);

  // Cipós Verdes de Selva (Vines) pendurados das bordas da copa!
  if (hasVines) {
    const vineLen = 4.2 * hs;
    const vineY = cBaseY - vineLen * 0.35;
    for (const [vx, vz] of [[-4.4 * ws, -3.2 * ws], [4.4 * ws, 3.2 * ws], [-3.2 * ws, 4.4 * ws], [3.2 * ws, -4.4 * ws]]) {
      batcher.addBox('willow_lime', 0.38, vineLen, 0.38, x + vx, vineY, z + vz);
    }
  }
}

/**
 * 2. ÁRVORE GIGANTE DE OUTONO / IPÊ FLORIDO (18m a 32m de altura!)
 */
function addGiantAutumnTree(batcher, x, yBase, z, ws, hs, autumnKey) {
  const trunkH = 8.8 * hs;
  const trunkW = 1.35 * ws;

  batcher.addBox('wood_brown', trunkW * 1.6, 1.1 * hs, trunkW * 1.6, x, yBase + 0.55 * hs, z);
  batcher.addBox('wood_brown', trunkW, trunkH, trunkW, x, yBase + trunkH * 0.5, z);
  batcher.addBox('wood_light', 5.4 * ws, 0.75 * hs, 0.8 * ws, x, yBase + trunkH * 0.75, z);

  const cY = yBase + trunkH * 0.8;
  batcher.addBox(autumnKey, 9.2 * ws, 3.5 * hs, 9.2 * ws, x, cY + 1.5 * hs, z);
  batcher.addBox(autumnKey, 7.4 * ws, 3.2 * hs, 7.4 * ws, x + 1.8 * ws, cY + 3.6 * hs, z - 1.4 * ws);
  batcher.addBox(autumnKey, 7.0 * ws, 3.0 * hs, 7.0 * ws, x - 1.6 * ws, cY + 4.2 * hs, z + 1.5 * ws);
  batcher.addBox(autumnKey, 4.8 * ws, 2.5 * hs, 4.8 * ws, x, cY + 6.4 * hs, z);
}

/**
 * 3. PINHEIRO / SEQUOIA CONÍFERA GIGANTE (20m a 36m de altura!)
 */
function addGiantConiferPineTree(batcher, x, yBase, z, ws, hs) {
  const trunkH = 7.5 * hs;
  batcher.addBox('wood_brown', 1.4 * ws, trunkH, 1.4 * ws, x, yBase + trunkH * 0.5, z);

  const bY = yBase + 4.2 * hs;
  batcher.addBox('pine_green', 8.8 * ws, 3.2 * hs, 8.8 * ws, x, bY, z);
  batcher.addBox('pine_green', 7.2 * ws, 3.2 * hs, 7.2 * ws, x, bY + 2.6 * hs, z);
  batcher.addBox('pine_green', 5.6 * ws, 3.2 * hs, 5.6 * ws, x, bY + 5.2 * hs, z);
  batcher.addBox('pine_green', 4.0 * ws, 3.0 * hs, 4.0 * ws, x, bY + 7.6 * hs, z);
  batcher.addBox('pine_green', 2.2 * ws, 2.8 * hs, 2.2 * ws, x, bY + 9.9 * hs, z);
}

/**
 * 4. SALGUEIRO-CHORÃO GIGANTE (WEEPING WILLOW) COM CORTINAS DE FOLHAGEM CAINDO ATÉ O CHÃO!
 */
function addGiantWeepingWillow(batcher, x, yBase, z, s) {
  const trunkH = 9.2 * s;
  batcher.addBox('wood_brown', 1.8 * s, trunkH, 1.8 * s, x, yBase + trunkH * 0.5, z);
  batcher.addBox('willow_lime', 11.0 * s, 3.2 * s, 11.0 * s, x, yBase + trunkH + 0.8 * s, z);
  batcher.addBox('jungle_lush', 8.2 * s, 2.6 * s, 8.2 * s, x, yBase + trunkH + 3.0 * s, z);

  // 8 Cortinas Longas de Folhagem de Salgueiro pendendo até quase tocar a grama/água!
  const curtainH = 7.2 * s;
  for (let c = 0; c < 8; c++) {
    const ang = (c / 8) * Math.PI * 2;
    const cx = x + Math.cos(ang) * 4.8 * s;
    const cz = z + Math.sin(ang) * 4.8 * s;
    batcher.addBox('willow_lime', 0.95 * s, curtainH, 0.95 * s, cx, yBase + trunkH - curtainH * 0.42, cz);
  }
}

/**
 * 5. SUB-BOSQUE DE SELVA: SAMAMBAIAS GIGANTES, ARBUSTOS ALTOS, ROCHAS MUSGOSAS E TRONCOS CAÍDOS!
 */
function addJungleUndergrowthCluster(batcher, x, yBase, z, s, flowerKey, withBoulderOrLog) {
  // Moita alta de folhagem de selva + samambaia aberta
  batcher.addBox('bush_green', 3.4 * s, 1.6 * s, 3.4 * s, x, yBase + 0.8 * s, z);
  batcher.addBox('jungle_lush', 2.4 * s, 2.2 * s, 2.4 * s, x, yBase + 1.4 * s, z);
  batcher.addBox('willow_lime', 4.6 * s, 0.45 * s, 1.1 * s, x, yBase + 1.1 * s, z);
  batcher.addBox('willow_lime', 1.1 * s, 0.45 * s, 4.6 * s, x, yBase + 1.1 * s, z);

  // Flores silvestres no topo do arbusto
  batcher.addBox(flowerKey, 0.75 * s, 0.55 * s, 0.75 * s, x - 0.8 * s, yBase + 1.85 * s, z + 0.6 * s);
  batcher.addBox(flowerKey, 0.75 * s, 0.55 * s, 0.75 * s, x + 0.8 * s, yBase + 1.85 * s, z - 0.6 * s);
  batcher.addBox(flowerKey, 0.85 * s, 0.6 * s, 0.85 * s, x, yBase + 2.55 * s, z);

  if (withBoulderOrLog) {
    // Rocha musgosa ou tronco caído na mata
    batcher.addBox('stone_dark', 2.4 * s, 1.2 * s, 1.9 * s, x + 1.8 * s, yBase + 0.6 * s, z);
    batcher.addBox('oak_mid', 1.8 * s, 0.35 * s, 1.4 * s, x + 1.8 * s, yBase + 1.25 * s, z);
  }
}
