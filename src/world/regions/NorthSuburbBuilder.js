import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';
import {
  SuburbBatcher,
  HOUSE_STYLE_KEYS,
  buildDetailedHouse,
  addPitchedGableRoof,
  spawnBreakableWhiteFence
} from '../SuburbHouseGenerator.js';

/**
 * 4. NORTE — BAIRRO RESIDENCIAL / SUBÚRBIO (LOTES DE GRAMA, 5 ESTILOS DE CASAS, QUINTAIS E 3 QUARTEIRÕES ESPECIAIS)
 */
export function buildNorthSuburbAndGasStation(world) {
  const batcher = new SuburbBatcher();

  const suburbBlockRowsZ = [-580, -712, -844, -976, -1108, -1240];
  const suburbBlockColsX = [-582, -450, -318, -186, -60, 60, 186, 318, 450];

  // Registra informações dos quarteirões residenciais para inspeção e testes
  world.suburbBlocks = [];

  let blockCounter = 0;
  for (let rIdx = 0; rIdx < suburbBlockRowsZ.length; rIdx++) {
    const bz = suburbBlockRowsZ[rIdx];
    const isSouthBorderRow = rIdx === 0; // bz = -580 (Fronteira Sul do Subúrbio com o Centro)

    // Registra a rua residencial estreita (10m) que corta os quarteirões ao meio no mapa (terminando na margem Oeste do Rio X = 536)
    world.mapRoads.push({ x: -53.5, z: bz, w: 1179, d: 10, isMain: false });

    for (let cIdx = 0; cIdx < suburbBlockColsX.length; cIdx++) {
      const bx = suburbBlockColsX[cIdx];
      // Quarteirões expandidos (122m / 110m) deixam ruas residenciais estreitas de apenas 10m entre eles!
      const bw = Math.abs(bx) === 60 ? 110 : 122;
      const bd = 122;

      // Os 3 Quarteirões Especiais Obrigatórios na faixa central do Subúrbio (bz = -712):
      if (bz === -712 && bx === 186) {
        buildExplosiveGasStationBlock(world, batcher, bx, bz, bw, bd);
        continue;
      }
      if (bz === -712 && bx === 60) {
        buildSuburbCommercialPizzeriaBlock(world, batcher, bx, bz, bw, bd);
        continue;
      }
      if (bz === -712 && bx === -60) {
        buildSuburbParkAndBasketballBlock(world, batcher, bx, bz, bw, bd);
        continue;
      }
      // Na última fileira costeira Norte (bz = -1240), inclui Parques Arborizados em bx = -186 e bx = 318
      if (bz === -1240 && (bx === -186 || bx === 318)) {
        buildSuburbParkAndBasketballBlock(world, batcher, bx, bz, bw, 134);
        continue;
      }

      // Divide cada célula de 122m em 2 Quarteirões Residenciais Compactos (56m de profundidade cada)
      // separados por uma rua residencial estreita de 10m no meio (bz - 33 e bz + 33)!
      blockCounter++;
      const isNorthCoastRow = bz === -1240;
      const northSubD = isNorthCoastRow ? 68 : 56;
      const northSubZ = isNorthCoastRow ? bz - 39 : bz - 33;
      buildResidentialSuburbBlock(world, batcher, bx, bz + 33, bw, 56, blockCounter * 2 - 1, isSouthBorderRow, false);
      buildResidentialSuburbBlock(world, batcher, bx, northSubZ, bw, northSubD, blockCounter * 2, false, isNorthCoastRow);
    }
  }

  // Parque Linear & Alameda Arborizada na Borda Extrema Norte (Z = -1315, de X = -643 até a margem Oeste do Rio em X = +536!)
  world._addCityBlockSidewalk(-53.5, -1315, 1179, 10, LEGO_COLORS.sidewalk);
  batcher.addBox('lawn_green', 1173, 0.1, 8, -53.5, 0.28, -1315);
  world.mapBlocks.push({ x: -53.5, z: -1315, w: 1173, d: 8, color: '#22c55e' });
  for (let tx = -610; tx <= 515; tx += 32) {
    world._addLegoTree(tx, 0.32, -1315, 1.05);
  }

  // Também adiciona Townhouses elegantes nos cantos da faixa de transição (Z = -448)
  buildTransitionTownhouseAccents(world, batcher);

  // Mescla todas as geometrias estáticas do Subúrbio em poucos Draw Calls e instancia as Árvores Floridas!
  batcher.flush(world.scene);
}

/**
 * Constrói um Quarteirão Residencial com Borda de Calçada (S=5), Interior 100% Grama Verde Viva
 * e Divisão Simétrica em 4, 6 ou 8 Lotes com cercas, garagens (driveways), caminhos e quintais detalhados
 */
function buildResidentialSuburbBlock(world, batcher, bx, bz, bw, bd, seed, isSouthBorderRow, isNorthCoastRow = false) {
  const S = 3;
  const innerW = bw - S * 2;
  const innerD = bd - S * 2;

  // 1. Calçada de concreto externa (largura 5 nos 4 lados) + Gramado Verde Vivo em todo o interior!
  world._addCityBlockSidewalk(bx, bz, bw, bd, LEGO_COLORS.sidewalk);
  batcher.addBox('lawn_green', innerW, 0.08, innerD, bx, 0.28, bz);
  world.mapBlocks.push({
    x: bx,
    z: bz,
    w: innerW,
    d: innerD,
    color: '#22c55e'
  });

  // 2. Define a quantidade simétrica de lotes no quarteirão: 4, 6 ou 8 lotes (2, 3 ou 4 por face Norte/Sul)
  const lotsPerRow = isSouthBorderRow || isNorthCoastRow ? 2 : seed % 3 === 0 ? 4 : seed % 2 === 0 ? 3 : 2;
  const totalLots = lotsPerRow * 2;
  const lotW = innerW / lotsPerRow;
  const lotD = innerD * 0.5;

  world.suburbBlocks.push({
    x: bx,
    z: bz,
    w: bw,
    d: bd,
    innerW,
    innerD,
    totalLots,
    isSouthBorderRow
  });

  for (let i = 0; i < lotsPerRow; i++) {
    const lotX = bx - innerW * 0.5 + (i + 0.5) * lotW;

    // Lote Sul (virado de frente para a rua Sul, facingDirZ = +1)
    const southSeed = seed * 13 + i * 3 + Math.floor(Math.random() * 100);
    let southStyle = HOUSE_STYLE_KEYS[Math.floor(Math.random() * 4)];
    if (isSouthBorderRow) {
      // Na fronteira sul do Subúrbio (perto do Centro), usa Townhouses geminados de 3 andares!
      southStyle = 'townhouses';
    } else if (lotsPerRow === 2 && i === 0 && seed <= 4) {
      southStyle = 'suburb_mansion_pool';
    }

    buildDetailedHouse(world, batcher, {
      x: lotX,
      z: bz + lotD * 0.5,
      lotW,
      lotD,
      facingDirZ: 1,
      styleKey: southStyle,
      seed: southSeed
    });

    // Lote Norte (virado de frente para a rua Norte, facingDirZ = -1)
    const northSeed = seed * 17 + i * 5 + Math.floor(Math.random() * 100);
    let northStyle = HOUSE_STYLE_KEYS[Math.floor(Math.random() * 4)];
    if (isNorthCoastRow) {
      northStyle = i === 0 ? 'suburb_mansion_pool' : 'modern_wood_chalet';
    } else if (lotsPerRow === 3 && i === 1 && seed <= 6) {
      northStyle = 'modern_wood_chalet';
    }

    buildDetailedHouse(world, batcher, {
      x: lotX,
      z: bz - lotD * 0.5,
      lotW,
      lotD,
      facingDirZ: -1,
      styleKey: northStyle,
      seed: northSeed
    });
  }

  // Postes residenciais aconchegantes mais baixos nas esquinas da calçada
  for (const cx of [bx - innerW * 0.46, bx + innerW * 0.46]) {
    for (const cz of [bz - innerD * 0.5 - 2.2, bz + innerD * 0.5 + 2.2]) {
      batcher.addBox('charcoal_metal', 0.24, 3.6, 0.24, cx, 0.28 + 1.8, cz);
      batcher.addBox('window_warm', 0.52, 0.48, 0.52, cx, 0.28 + 3.7, cz);
    }
  }
}

/**
 * QUARTEIRÃO ESPECIAL 1 (bx = 186, bz = -712):
 * Posto de Gasolina Explosivo, Loja de Conveniência, Lava-Rápido e 6 Bombas em Reação em Cadeia!
 */
function buildExplosiveGasStationBlock(world, batcher, gx, gz, bw, bd) {
  const yBase = 0.28;
  world._addCityBlockSidewalk(gx, gz, bw, bd, LEGO_COLORS.sidewalk);

  // Pátio amplo asfaltado de esquina fácil de entrar dirigindo + Canteiro gramado nas bordas traseiras
  batcher.addBox('lawn_green', bw - 10, 0.06, bd - 10, gx, yBase + 0.01, gz);
  batcher.addBox('asphalt_lot', bw - 14, 0.1, bd - 16, gx, yBase + 0.05, gz + 4);

  // Faixas amarelas de entrada/saída de veículos e vagas
  for (let vx = gx - 36; vx <= gx - 12; vx += 6) {
    batcher.addBox('trim_white', 0.25, 0.12, 5.5, vx, yBase + 0.07, gz - 10);
  }

  // 1. LOJA DE CONVENIÊNCIA & LAVA-RÁPIDO (Ao fundo do lote, em gz - 28)
  const storeX = gx - 14;
  const storeZ = gz - 28;
  const storeW = 46;
  const storeH = 8.5;
  const storeD = 20;

  batcher.addBox('wall_white', storeW, storeH, storeD, storeX, yBase + storeH * 0.5, storeZ);
  // Frisos de cobertura estilo Octan (Vermelho + Verde + Amarelo)
  batcher.addBox('roof_red', storeW + 1.2, 1.1, storeD + 1.2, storeX, yBase + storeH + 0.55, storeZ);
  batcher.addBox('hedge_green', storeW + 1.4, 0.6, storeD + 1.4, storeX, yBase + storeH + 1.4, storeZ);
  // Vitrine larga de vidro iluminado + Prateleiras coloridas visíveis + Porta dupla
  batcher.addBox('window_glass', 26, 4.6, 0.35, storeX - 4, yBase + 2.6, storeZ + storeD * 0.5 + 0.12);
  batcher.addBox('flower_yellow', 20, 1.2, 1.0, storeX - 4, yBase + 2.0, storeZ + storeD * 0.5 - 1.2);
  batcher.addBox('charcoal_metal', 3.4, 4.2, 0.4, storeX - 4, yBase + 2.1, storeZ + storeD * 0.5 + 0.2);

  world.addCollider(storeX, storeZ, storeW, storeD, yBase + storeH + 1.8, yBase);
  world.mapBuildings.push({
    x: storeX,
    z: storeZ,
    w: storeW,
    d: storeD,
    height: storeH,
    color: '#f8fafc',
    label: 'CONVENIÊNCIA'
  });

  // 2. TÚNEL DE LAVA-RÁPIDO / OFICINA (Na direita do fundo, gx + 24, gz - 28)
  const washX = gx + 24;
  const washZ = gz - 28;
  batcher.addBox('wall_lightgrey', 22, 8.0, 20, washX, yBase + 4.0, washZ);
  batcher.addBox('court_blue', 23, 1.2, 21, washX, yBase + 8.6, washZ);
  // Escovas cilíndricas azuis na entrada do Lava-Rápido
  batcher.addBox('window_glass', 2.2, 6.2, 2.2, washX - 5.5, yBase + 3.1, washZ + 9.5);
  batcher.addBox('window_glass', 2.2, 6.2, 2.2, washX + 5.5, yBase + 3.1, washZ + 9.5);
  world.addCollider(washX, washZ, 22, 20, yBase + 9.2, yBase);

  // 3. GRANDE COBERTURA (MARQUISE) VERMELHA, BRANCA E AMARELA SOBRE AS ILHAS DE ABASTECIMENTO
  const canX = gx + 6;
  const canZ = gz + 12;
  const canW = 54;
  const canD = 30;
  const canY = 9.2;

  batcher.addBox('trim_white', canW, 0.9, canD, canX, canY, canZ);
  batcher.addBox('roof_red', canW + 0.8, 1.1, canD + 0.8, canX, canY + 0.9, canZ);
  batcher.addBox('gold_accent', canW + 1.0, 0.45, canD + 1.0, canX, canY + 1.65, canZ);
  // Letreiro luminoso no topo da Marquise
  batcher.addBox('roof_red', 24, 2.6, 1.6, canX, canY + 3.1, canZ + canD * 0.5 - 1.2);
  batcher.addBox('window_warm', 21, 1.6, 1.8, canX, canY + 3.1, canZ + canD * 0.5 - 1.2);

  // 4 Colunas de sustentação e 2 Ilhas de concreto para as bombas
  for (const ix of [canX - 16, canX + 16]) {
    batcher.addBox('walkway_stone', 6.5, 0.32, 22, ix, yBase + 0.16, canZ);
    for (const iz of [canZ - 7.5, canZ + 7.5]) {
      batcher.addBox('trim_white', 1.2, canY - yBase, 1.2, ix, yBase + (canY - yBase) * 0.5, iz);
      batcher.addBox('roof_red', 1.4, 2.2, 1.4, ix, yBase + 1.1, iz);
      world.addCollider(ix, iz, 1.3, 1.3, canY, yBase);
    }
  }

  world.addCollider(canX, canZ, canW, canD, canY + 2.0, canY - 0.5);
  world.mapBuildings.push({
    x: canX,
    z: canZ,
    w: canW,
    d: canD,
    height: canY,
    color: '#fb923c',
    label: 'POSTO OCTAN'
  });

  // Totem de Preços Luminoso na Esquina Sul-Oeste do Posto
  const totemX = gx - 36;
  const totemZ = gz + 38;
  batcher.addBox('roof_red', 3.4, 11.5, 1.2, totemX, yBase + 5.75, totemZ);
  batcher.addBox('trim_white', 3.8, 0.6, 1.5, totemX, yBase + 11.6, totemZ);
  batcher.addBox('window_warm', 2.6, 4.2, 1.35, totemX, yBase + 8.2, totemZ);
  world.addCollider(totemX, totemZ, 3.4, 1.2, yBase + 12.0, yBase);

  // 4. AS 6 BOMBAS DE GASOLINA 3D DETALHADAS (Explodem em Reação em Cadeia quando baleadas!)
  const pumpCoords = [
    [canX - 16, canZ - 4.2],
    [canX - 16, canZ],
    [canX - 16, canZ + 4.2],
    [canX + 16, canZ - 4.2],
    [canX + 16, canZ],
    [canX + 16, canZ + 4.2]
  ];

  const redMat = getLegoMaterial(LEGO_COLORS.red);
  const whiteMat = getLegoMaterial(LEGO_COLORS.white);
  const screenMat = getLegoMaterial(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.7 });
  const hoseMat = getLegoMaterial(LEGO_COLORS.black);

  for (const [px, pz] of pumpCoords) {
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(px, yBase, pz);

    const baseBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 1.1), redMat);
    baseBody.position.y = 1.1;
    pumpGroup.add(baseBody);

    const header = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 1.2), whiteMat);
    header.position.y = 2.45;
    pumpGroup.add(header);

    const display = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 1.18), screenMat);
    display.position.y = 1.55;
    pumpGroup.add(display);

    const hose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.25), hoseMat);
    hose.position.set(0.82, 1.15, 0);
    pumpGroup.add(hose);

    world.scene.add(pumpGroup);
    const col = world.addCollider(px, pz, 1.6, 1.2, yBase + 2.75, yBase);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: pumpGroup,
        type: 'gas_pump',
        hp: 16,
        radius: 1.8,
        height: 2.7,
        colliders: [col],
        debrisColors: [LEGO_COLORS.red, LEGO_COLORS.yellow, LEGO_COLORS.orange, LEGO_COLORS.white],
        studDrops: { silver: 4, gold: 8, blue: 4, purple: 1 },
        groundY: yBase
      });
    }
  }
}

/**
 * QUARTEIRÃO ESPECIAL 2 (bx = 60, bz = -712):
 * Quarteirão Comercial do Bairro — Pizzaria LEGO (com Pizza 3D Gigante no telhado + Mesas na calçada),
 * Lanchonete Diner Retrô (Neon) & Mercadinho + Estacionamento Frontal Pintado!
 */
function buildSuburbCommercialPizzeriaBlock(world, batcher, cx, cz, bw, bd) {
  const yBase = 0.28;
  world._addCityBlockSidewalk(cx, cz, bw, bd, LEGO_COLORS.sidewalk);

  // Piso de estacionamento frontal com faixas brancas pintadas
  batcher.addBox('asphalt_lot', bw - 10, 0.08, bd - 10, cx, yBase + 0.02, cz);
  for (let sx = cx - 34; sx <= cx + 34; sx += 7.5) {
    batcher.addBox('trim_white', 0.25, 0.1, 6.2, sx, yBase + 0.05, cz + 32);
  }

  // 1. PIZZARIA LEGO (Lado Oeste do quarteirão: cx - 20, cz - 8)
  const pizX = cx - 20;
  const pizZ = cz - 8;
  const pizW = 34;
  const pizH = 10.5;
  const pizD = 28;

  // Fachada italiana alegre (Creme + Faixas Vermelha e Verde + Chaminé do Forno a Lenha)
  batcher.addBox('wall_cream', pizW, pizH, pizD, pizX, yBase + pizH * 0.5, pizZ);
  batcher.addBox('roof_red', pizW + 0.8, 1.4, pizD + 0.8, pizX, yBase + pizH + 0.7, pizZ);
  batcher.addBox('hedge_green', pizW + 1.0, 0.9, pizD + 1.0, pizX, yBase + 4.8, pizZ);
  batcher.addBox('chimney_brick', 3.2, pizH + 5.5, 3.2, pizX - pizW * 0.35, yBase + (pizH + 5.5) * 0.5, pizZ - 6);

  // Vitrines iluminadas + Toldos listrados (Vermelho e Branco) sobre a calçada frontal
  const frontZ = pizZ + pizD * 0.5;
  batcher.addBox('window_warm', 10, 3.6, 0.3, pizX - 8, yBase + 2.5, frontZ + 0.15);
  batcher.addBox('window_warm', 10, 3.6, 0.3, pizX + 8, yBase + 2.5, frontZ + 0.15);
  batcher.addBox('wood_warm', 3.2, 3.8, 0.35, pizX, yBase + 1.9, frontZ + 0.18);

  for (let s = -14; s <= 14; s += 2.8) {
    const stripeKey = Math.abs(Math.round(s / 2.8)) % 2 === 0 ? 'roof_red' : 'trim_white';
    batcher.addBox(stripeKey, 2.7, 0.45, 3.6, pizX + s, yBase + 4.4, frontZ + 1.8);
  }

  // PIZZA 3D GIGANTE DECORATIVA NO TOPO DO TELHADO!
  const roofY = yBase + pizH + 1.5;
  const pizzaGroup = new THREE.Group();
  pizzaGroup.position.set(pizX, roofY + 3.6, pizZ + 4);
  pizzaGroup.rotation.x = 0.38; // Inclinada para ser vista da rua!

  const crust = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.2, 0.7, 24),
    getLegoMaterial(0xd97706, { roughness: 0.35 })
  );
  crust.rotation.x = Math.PI / 2;
  pizzaGroup.add(crust);

  const sauce = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 0.76, 24),
    getLegoMaterial(0xdc2626, { roughness: 0.3 })
  );
  sauce.rotation.x = Math.PI / 2;
  pizzaGroup.add(sauce);

  const cheese = new THREE.Mesh(
    new THREE.CylinderGeometry(4.1, 4.1, 0.82, 24),
    getLegoMaterial(0xfacc15, { emissive: 0xf59e0b, emissiveIntensity: 0.25 })
  );
  cheese.rotation.x = Math.PI / 2;
  pizzaGroup.add(cheese);

  const pepMat = getLegoMaterial(0x991b1b, { roughness: 0.28 });
  const pepOffsets = [
    [-1.6, 1.4], [1.6, 1.4], [0, 0], [-1.8, -1.2], [1.7, -1.3], [0, 2.3], [0, -2.2]
  ];
  for (const [px, py] of pepOffsets) {
    const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.9, 12), pepMat);
    pep.rotation.x = Math.PI / 2;
    pep.position.set(px, py, 0);
    pizzaGroup.add(pep);
  }
  world.scene.add(pizzaGroup);
  world.rotatingElements.push({ mesh: pizzaGroup, speed: 0.9, axis: 'y' });

  // Mesinhas com Guarda-Sol na calçada da Pizzaria
  for (const tx of [pizX - 11, pizX - 4, pizX + 4, pizX + 11]) {
    const tz = frontZ + 4.8;
    batcher.addBox('trim_white', 2.0, 0.85, 2.0, tx, yBase + 0.42, tz);
    batcher.addBox('trim_white', 0.22, 2.4, 0.22, tx, yBase + 1.4, tz);
    batcher.addBox(tx < pizX ? 'roof_red' : 'hedge_green', 2.8, 0.45, 2.8, tx, yBase + 2.5, tz);
  }

  world.addCollider(pizX, pizZ, pizW, pizD, yBase + pizH + 2.0, yBase);
  world.mapBuildings.push({
    x: pizX,
    z: pizZ,
    w: pizW,
    d: pizD,
    height: pizH,
    color: '#ef4444',
    label: 'PIZZARIA LEGO'
  });

  // 2. LANCHONETE DINER RETRÔ ANOS 50 & MERCADINHO (Lado Leste: cx + 21, cz - 8)
  const dinX = cx + 21;
  const dinZ = cz - 8;
  const dinW = 34;
  const dinH = 8.2;
  const dinD = 26;

  batcher.addBox('wall_lightgrey', dinW, dinH, dinD, dinX, yBase + dinH * 0.5, dinZ);
  batcher.addBox('neon_pink', dinW + 1.0, 0.65, dinD + 1.0, dinX, yBase + dinH + 0.3, dinZ);
  batcher.addBox('neon_cyan', dinW + 0.8, 0.55, dinD + 0.8, dinX, yBase + 4.2, dinZ);
  batcher.addBox('window_glass', dinW - 6, 3.4, 0.35, dinX, yBase + 2.2, dinZ + dinD * 0.5 + 0.15);

  world.addCollider(dinX, dinZ, dinW, dinD, yBase + dinH + 1.2, yBase);
  world.mapBuildings.push({
    x: dinX,
    z: dinZ,
    w: dinW,
    d: dinD,
    height: dinH,
    color: '#ec4899',
    label: 'DINER & MERCADO'
  });
}

/**
 * QUARTEIRÃO ESPECIAL 3 (bx = -60, bz = -712):
 * Praça Residencial & Quadra de Basquete de Rua (com 2 Tabelas/Cestas 3D, Coreto/Chafariz e Árvores Floridas)
 */
function buildSuburbParkAndBasketballBlock(world, batcher, px, pz, bw, bd) {
  const yBase = 0.28;
  world._addCityBlockSidewalk(px, pz, bw, bd, LEGO_COLORS.sidewalk);

  const innerW = bw - 10;
  const innerD = bd - 10;
  batcher.addBox('lawn_green', innerW, 0.1, innerD, px, yBase + 0.03, pz);
  world.mapBlocks.push({ x: px, z: pz, w: innerW, d: innerD, color: '#22c55e' });

  // Caminhos pavimentados de pedra cruzando a praça
  batcher.addBox('walkway_stone', innerW - 4, 0.14, 5.2, px, yBase + 0.06, pz);
  batcher.addBox('walkway_stone', 5.2, 0.14, innerD - 4, px - 18, yBase + 0.06, pz);

  // 1. CORETO CLÁSSICO & CHAFARIZ DE ÁGUA AZUL (Lado Oeste da Praça: px - 18, pz)
  const gazX = px - 18;
  const gazZ = pz;
  batcher.addBox('trim_white', 14, 0.65, 14, gazX, yBase + 0.32, gazZ);
  batcher.addBox('pool_water', 10.5, 0.78, 10.5, gazX, yBase + 0.4, gazZ);
  batcher.addBox('trim_white', 7.2, 1.1, 7.2, gazX, yBase + 0.55, gazZ);
  for (const gxOff of [-2.8, 2.8]) {
    for (const gzOff of [-2.8, 2.8]) {
      batcher.addBox('trim_white', 0.55, 5.2, 0.55, gazX + gxOff, yBase + 3.2, gazZ + gzOff);
    }
  }
  addPitchedGableRoof(batcher, 'roof_red', gazX, yBase + 5.8, gazZ, 8.2, 8.2, 2.8, true);
  world.addCollider(gazX, gazZ, 8.0, 8.0, yBase + 8.5, yBase);

  // 2. QUADRA DE BASQUETE DE RUA COMPLETA (Lado Leste da Praça: px + 18, pz)
  const crtX = px + 18;
  const crtZ = pz;
  const crtW = 24;
  const crtD = 42;

  // Piso azul/laranja com linhas brancas de quadra e garrafão
  batcher.addBox('court_blue', crtW + 2.4, 0.12, crtD + 2.4, crtX, yBase + 0.05, crtZ);
  batcher.addBox('court_orange', crtW, 0.15, crtD, crtX, yBase + 0.07, crtZ);
  batcher.addBox('trim_white', crtW, 0.17, 0.35, crtX, yBase + 0.08, crtZ); // Linha central
  batcher.addBox('court_blue', 7.2, 0.17, 9.5, crtX, yBase + 0.08, crtZ - crtD * 0.5 + 4.8); // Garrafão Norte
  batcher.addBox('court_blue', 7.2, 0.17, 9.5, crtX, yBase + 0.08, crtZ + crtD * 0.5 - 4.8); // Garrafão Sul

  // 2 Tabelas e Cestas de Basquete 3D nas pontas Norte e Sul da quadra!
  for (const dir of [-1, 1]) {
    const hoopZ = crtZ + dir * (crtD * 0.5 - 1.2);
    // Poste metálico + Braço + Tabela Branca + Alvo Vermelho + Aro Laranja
    batcher.addBox('charcoal_metal', 0.38, 4.8, 0.38, crtX, yBase + 2.4, hoopZ + dir * 0.8);
    batcher.addBox('charcoal_metal', 0.32, 0.32, 1.2, crtX, yBase + 4.6, hoopZ + dir * 0.2);
    batcher.addBox('trim_white', 2.8, 1.9, 0.2, crtX, yBase + 4.7, hoopZ);
    batcher.addBox('flower_red', 1.1, 0.85, 0.24, crtX, yBase + 4.5, hoopZ);
    batcher.addBox('court_orange', 0.85, 0.16, 0.85, crtX, yBase + 4.1, hoopZ - dir * 0.5);
    world.addCollider(crtX, hoopZ + dir * 0.8, 0.8, 0.8, yBase + 5.0, yBase);
  }

  // Mureta/alambrado baixo nas laterais da quadra
  batcher.addBox('stone_grey', 0.4, 1.2, crtD, crtX - crtW * 0.5 - 1.2, yBase + 0.6, crtZ);
  batcher.addBox('stone_grey', 0.4, 1.2, crtD, crtX + crtW * 0.5 + 1.2, yBase + 0.6, crtZ);

  world.mapBuildings.push({
    x: crtX,
    z: crtZ,
    w: crtW,
    d: crtD,
    height: 1.0,
    color: '#ea580c',
    label: 'QUADRA BASQUETE'
  });

  // Árvores floridas (Cerejeiras Rosas e Ipês Amarelos) ao redor da Praça + Cercas Quebráveis
  const treeSpots = [
    [px - 34, pz - 34, 'pink'],
    [px - 34, pz + 34, 'yellow'],
    [px - 4, pz - 34, 'pink'],
    [px - 4, pz + 34, 'yellow'],
    [px + 34, pz - 36, 'pink'],
    [px + 34, pz + 36, 'yellow']
  ];
  for (const [tx, tz, bKey] of treeSpots) {
    batcher.addFloweringTree(tx, yBase, tz, 1.25, bKey);
  }
  spawnBreakableWhiteFence(world, px - 22, pz - 44, 8.0);
  spawnBreakableWhiteFence(world, px - 22, pz + 44, 8.0);
}

/**
 * Adiciona Townhouses de 3 andares nas extremidades Leste/Oeste da faixa de transição (Z = -448)
 */
function buildTransitionTownhouseAccents(world, batcher) {
  for (const tx of [-582]) {
    const bw = 104;
    const bd = 96;
    world._addCityBlockSidewalk(tx, -448, bw, bd, LEGO_COLORS.sidewalk);
    batcher.addBox('lawn_green', bw - 10, 0.08, bd - 10, tx, 0.28, -448);

    buildDetailedHouse(world, batcher, {
      x: tx - 22,
      z: -448 + 20,
      lotW: 44,
      lotD: 42,
      facingDirZ: 1,
      styleKey: 'townhouses',
      seed: tx < 0 ? 101 : 202
    });
    buildDetailedHouse(world, batcher, {
      x: tx + 22,
      z: -448 + 20,
      lotW: 44,
      lotD: 42,
      facingDirZ: 1,
      styleKey: 'townhouses',
      seed: tx < 0 ? 103 : 204
    });
    buildDetailedHouse(world, batcher, {
      x: tx - 22,
      z: -448 - 20,
      lotW: 44,
      lotD: 42,
      facingDirZ: -1,
      styleKey: 'american_two_story',
      seed: tx < 0 ? 105 : 206
    });
    buildDetailedHouse(world, batcher, {
      x: tx + 22,
      z: -448 - 20,
      lotW: 44,
      lotD: 42,
      facingDirZ: -1,
      styleKey: 'suburb_mansion_pool',
      seed: tx < 0 ? 107 : 208
    });
  }
}
