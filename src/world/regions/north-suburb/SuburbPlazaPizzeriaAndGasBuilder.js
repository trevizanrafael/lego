import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../../../materials/LegoMaterials.js';
import {
  addPitchedGableRoof,
  spawnBreakableWhiteFence
} from '../../SuburbHouseGenerator.js';
import { IS_SCALED_WORLD, ROAD } from '../../core/WorldLayoutScale.js';

function addTerrainFollowingSlab(world, batcher, matKey, w, d, cx, cz, yLift, thickness = 0.08) {
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const minX = cx - w * 0.5;
  const maxX = cx + w * 0.5;
  const minZ = cz - d * 0.5;
  const maxZ = cz + d * 0.5;
  const yNW = tAt(minX, minZ);
  const yNE = tAt(maxX, minZ);
  const ySW = tAt(minX, maxZ);
  const ySE = tAt(maxX, maxZ);
  const yC = tAt(cx, cz);

  if (Math.max(yNW, yNE, ySW, ySE, yC) - Math.min(yNW, yNE, ySW, ySE, yC) < 0.03) {
    batcher.addBox(matKey, w, thickness, d, cx, yC + yLift, cz);
    return;
  }

  const segX = Math.max(3, Math.min(10, Math.ceil(w / 18)));
  const segZ = Math.max(3, Math.min(10, Math.ceil(d / 18)));
  const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, cz);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    pos.setY(i, tAt(vx, vz) + yLift);
  }
  geo.computeVertexNormals();
  batcher.addCustomGeo(matKey, geo);
}

/**
 * QUARTEIRÃO ESPECIAL 1 (bx = 186, bz = -712 / `lm_posto` em 3x):
 * Posto de Gasolina Explosivo, Loja de Conveniência, Lava-Rápido e 6 Bombas em Reação em Cadeia!
 */
export function buildExplosiveGasStationBlock(world, batcher, gx, gz, bw, bd, opts = {}) {
  const dirZ = opts.facingDirZ ?? 1; // +1: frente p/ +Z; -1: frente p/ -Z
  const padLift = IS_SCALED_WORLD ? 0.06 : 0.28;
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const terrainY = tAt(gx, gz);
  const yBase = terrainY + padLift;

  if (!opts.skipSidewalkSlab) {
    world._addCityBlockSidewalk(gx, gz, bw, bd, LEGO_COLORS.sidewalk, terrainY);
  }
  batcher.addBox('stone_grey', bw - (IS_SCALED_WORLD ? 10 : -0.4), 3.8, bd - (IS_SCALED_WORLD ? 10 : -0.4), gx, terrainY - 1.9, gz);

  // Pátio amplo asfaltado fácil de entrar dirigindo + Canteiro gramado nas bordas
  if (IS_SCALED_WORLD) {
    addTerrainFollowingSlab(world, batcher, 'lawn_green', bw - 10, bd - 10, gx, gz, 0.05, 0.06);
    addTerrainFollowingSlab(world, batcher, 'asphalt_lot', bw - 14, bd - 16, gx, gz + dirZ * 4, 0.08, 0.08);
    // Rampas de acesso do pátio atravessando a calçada de 10m até a rua (zero colisor!)
    const swZ = (opts.frontSidewalkInnerZ ?? (gz + dirZ * (bd * 0.5 - 5))) + dirZ * (ROAD.sidewalk * 0.5 - 0.2);
    for (const dxApron of [-22, 24]) {
      const ax = gx + dxApron;
      batcher.addBox('driveway_concrete', 14.0, 0.05, ROAD.sidewalk - 0.4, ax, tAt(ax, swZ) + 0.025, swZ);
    }
  } else {
    batcher.addBox('lawn_green', bw - 10, 0.06, bd - 10, gx, yBase + 0.01, gz);
    batcher.addBox('asphalt_lot', bw - 14, 0.1, bd - 16, gx, yBase + 0.05, gz + 4);
  }

  // Faixas brancas de vagas
  const stripeZ = gz - dirZ * 10;
  for (let vx = gx - 36; vx <= gx - 12; vx += 6) {
    const sy = IS_SCALED_WORLD ? tAt(vx, stripeZ) + padLift : yBase;
    batcher.addBox('trim_white', 0.25, 0.12, 5.5, vx, sy + 0.07, stripeZ);
  }

  // 1. LOJA DE CONVENIÊNCIA & LAVA-RÁPIDO (Ao fundo do lote)
  const storeX = gx - 14;
  const storeZ = gz - dirZ * 28;
  const storeW = 46;
  const storeH = 8.5;
  const storeD = 20;
  const storeBaseY = IS_SCALED_WORLD ? tAt(storeX, storeZ) + padLift : yBase;

  batcher.addBox('stone_grey', storeW + 0.6, 3.2, storeD + 0.6, storeX, storeBaseY - 1.5, storeZ);
  batcher.addBox('wall_white', storeW, storeH, storeD, storeX, storeBaseY + storeH * 0.5, storeZ);
  // Frisos de cobertura estilo Octan (Vermelho + Verde + Amarelo)
  batcher.addBox('roof_red', storeW + 1.2, 1.1, storeD + 1.2, storeX, storeBaseY + storeH + 0.55, storeZ);
  batcher.addBox('hedge_green', storeW + 1.4, 0.6, storeD + 1.4, storeX, storeBaseY + storeH + 1.4, storeZ);
  // Vitrine larga de vidro iluminado + Prateleiras coloridas visíveis + Porta dupla
  batcher.addBox('window_glass', 26, 4.6, 0.35, storeX - 4, storeBaseY + 2.6, storeZ + dirZ * (storeD * 0.5 + 0.12));
  batcher.addBox('flower_yellow', 20, 1.2, 1.0, storeX - 4, storeBaseY + 2.0, storeZ + dirZ * (storeD * 0.5 - 1.2));
  batcher.addBox('charcoal_metal', 3.4, 4.2, 0.4, storeX - 4, storeBaseY + 2.1, storeZ + dirZ * (storeD * 0.5 + 0.2));

  world.addCollider(storeX, storeZ, storeW, storeD, storeBaseY + storeH + 1.8, storeBaseY);
  world.mapBuildings.push({
    x: storeX,
    z: storeZ,
    w: storeW,
    d: storeD,
    height: storeH,
    color: '#f8fafc',
    label: 'CONVENIÊNCIA'
  });

  // 2. TÚNEL DE LAVA-RÁPIDO / OFICINA (Na direita do fundo)
  const washX = gx + 24;
  const washZ = gz - dirZ * 28;
  const washBaseY = IS_SCALED_WORLD ? tAt(washX, washZ) + padLift : yBase;
  batcher.addBox('stone_grey', 22.6, 3.2, 20.6, washX, washBaseY - 1.5, washZ);
  batcher.addBox('wall_lightgrey', 22, 8.0, 20, washX, washBaseY + 4.0, washZ);
  batcher.addBox('court_blue', 23, 1.2, 21, washX, washBaseY + 8.6, washZ);
  // Escovas cilíndricas azuis na entrada do Lava-Rápido
  batcher.addBox('window_glass', 2.2, 6.2, 2.2, washX - 5.5, washBaseY + 3.1, washZ + dirZ * 9.5);
  batcher.addBox('window_glass', 2.2, 6.2, 2.2, washX + 5.5, washBaseY + 3.1, washZ + dirZ * 9.5);
  world.addCollider(washX, washZ, 22, 20, washBaseY + 9.2, washBaseY);

  // 3. GRANDE COBERTURA (MARQUISE) VERMELHA, BRANCA E AMARELA SOBRE AS ILHAS DE ABASTECIMENTO
  const canX = gx + 6;
  const canZ = gz + dirZ * 12;
  const canW = 54;
  const canD = 30;
  const canBaseY = IS_SCALED_WORLD ? tAt(canX, canZ) + padLift : yBase;
  const canY = canBaseY + 8.92;

  batcher.addBox('trim_white', canW, 0.9, canD, canX, canY, canZ);
  batcher.addBox('roof_red', canW + 0.8, 1.1, canD + 0.8, canX, canY + 0.9, canZ);
  batcher.addBox('gold_accent', canW + 1.0, 0.45, canD + 1.0, canX, canY + 1.65, canZ);
  // Letreiro luminoso no topo da Marquise voltado p/ a rua frontal
  const signZ = canZ + dirZ * (canD * 0.5 - 1.2);
  batcher.addBox('roof_red', 24, 2.6, 1.6, canX, canY + 3.1, signZ);
  batcher.addBox('window_warm', 21, 1.6, 1.8, canX, canY + 3.1, signZ);

  // 4 Colunas de sustentação e 2 Ilhas de concreto para as bombas
  for (const ix of [canX - 16, canX + 16]) {
    const islandBaseY = IS_SCALED_WORLD ? tAt(ix, canZ) + padLift : yBase;
    batcher.addBox('walkway_stone', 6.5, 0.32, 22, ix, islandBaseY + 0.16, canZ);
    for (const iz of [canZ - 7.5, canZ + 7.5]) {
      const colFloorY = IS_SCALED_WORLD ? tAt(ix, iz) + padLift : yBase;
      const colH = canY - colFloorY;
      batcher.addBox('trim_white', 1.2, colH, 1.2, ix, colFloorY + colH * 0.5, iz);
      batcher.addBox('roof_red', 1.4, 2.2, 1.4, ix, colFloorY + 1.1, iz);
      world.addCollider(ix, iz, 1.3, 1.3, canY, colFloorY);
    }
  }

  world.addCollider(canX, canZ, canW, canD, canY + 2.0, canY - 0.5);
  world.mapBuildings.push({
    x: canX,
    z: canZ,
    w: canW,
    d: canD,
    height: IS_SCALED_WORLD ? 9.2 : canY,
    color: '#fb923c',
    label: 'POSTO OCTAN'
  });

  // Totem de Preços Luminoso na Esquina Frontal do Posto (estritamente dentro do lote!)
  const totemX = gx - 36;
  const totemZ = gz + dirZ * 38;
  const totemBaseY = IS_SCALED_WORLD ? tAt(totemX, totemZ) + padLift : yBase;
  batcher.addBox('roof_red', 3.4, 11.5, 1.2, totemX, totemBaseY + 5.75, totemZ);
  batcher.addBox('trim_white', 3.8, 0.6, 1.5, totemX, totemBaseY + 11.6, totemZ);
  batcher.addBox('window_warm', 2.6, 4.2, 1.35, totemX, totemBaseY + 8.2, totemZ);
  world.addCollider(totemX, totemZ, 3.4, 1.2, totemBaseY + 12.0, totemBaseY);

  // 4. AS 6 BOMBAS DE GASOLINA 3D DETALHADAS (Espaçamento local 1x -> Explodem todas as 6 em Reação em Cadeia!)
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
    const pumpY = IS_SCALED_WORLD ? tAt(px, pz) + padLift : yBase;
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(px, pumpY, pz);

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
    const col = world.addCollider(px, pz, 1.6, 1.2, pumpY + 2.75, pumpY);

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
        groundY: pumpY
      });
    }
  }
}

/**
 * QUARTEIRÃO ESPECIAL 2 (bx = 60, bz = -712):
 * Quarteirão Comercial do Bairro — Pizzaria LEGO (com Pizza 3D Gigante no telhado + Mesas na calçada),
 * Lanchonete Diner Retrô (Neon) & Mercadinho + Estacionamento Frontal Pintado!
 */
export function buildSuburbCommercialPizzeriaBlock(world, batcher, cx, cz, bw, bd, opts = {}) {
  const padLift = IS_SCALED_WORLD ? 0.06 : 0.28;
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const terrainY = tAt(cx, cz);
  const yBase = terrainY + padLift;

  if (!opts.skipSidewalkSlab) {
    world._addCityBlockSidewalk(cx, cz, bw, bd, LEGO_COLORS.sidewalk, terrainY);
  }
  batcher.addBox('stone_grey', bw - (IS_SCALED_WORLD ? 10 : -0.4), 3.8, bd - (IS_SCALED_WORLD ? 10 : -0.4), cx, terrainY - 1.9, cz);

  // Piso de estacionamento frontal com faixas brancas pintadas
  if (IS_SCALED_WORLD) {
    addTerrainFollowingSlab(world, batcher, 'asphalt_lot', bw - 10, bd - 10, cx, cz, 0.06, 0.08);
    // Rampa de entrada de veículos atravessando a calçada Sul de 10m
    const apronZ = cz + bd * 0.5 - 5 + ROAD.sidewalk * 0.5 - 0.2;
    batcher.addBox('driveway_concrete', 14.0, 0.05, ROAD.sidewalk - 0.4, cx, tAt(cx, apronZ) + 0.025, apronZ);
  } else {
    batcher.addBox('asphalt_lot', bw - 10, 0.08, bd - 10, cx, yBase + 0.02, cz);
  }
  for (let sx = cx - 34; sx <= cx + 34; sx += 7.5) {
    const sy = IS_SCALED_WORLD ? tAt(sx, cz + 32) + padLift : yBase;
    batcher.addBox('trim_white', 0.25, 0.1, 6.2, sx, sy + 0.05, cz + 32);
  }

  // 1. PIZZARIA LEGO (Lado Oeste do quarteirão: cx - 20, cz - 8)
  const pizX = cx - 20;
  const pizZ = cz - 8;
  const pizW = 34;
  const pizH = 10.5;
  const pizD = 28;
  const pizBaseY = IS_SCALED_WORLD ? tAt(pizX, pizZ) + padLift : yBase;

  // Fachada italiana alegre (Creme + Faixas Vermelha e Verde + Chaminé do Forno a Lenha)
  batcher.addBox('stone_grey', pizW + 0.6, 3.0, pizD + 0.6, pizX, pizBaseY - 1.4, pizZ);
  batcher.addBox('wall_cream', pizW, pizH, pizD, pizX, pizBaseY + pizH * 0.5, pizZ);
  batcher.addBox('roof_red', pizW + 0.8, 1.4, pizD + 0.8, pizX, pizBaseY + pizH + 0.7, pizZ);
  batcher.addBox('hedge_green', pizW + 1.0, 0.9, pizD + 1.0, pizX, pizBaseY + 4.8, pizZ);
  batcher.addBox('chimney_brick', 3.2, pizH + 5.5, 3.2, pizX - pizW * 0.35, pizBaseY + (pizH + 5.5) * 0.5, pizZ - 6);

  // Vitrines iluminadas + Toldos listrados (Vermelho e Branco) sobre a calçada frontal
  const frontZ = pizZ + pizD * 0.5;
  batcher.addBox('window_warm', 10, 3.6, 0.3, pizX - 8, pizBaseY + 2.5, frontZ + 0.15);
  batcher.addBox('window_warm', 10, 3.6, 0.3, pizX + 8, pizBaseY + 2.5, frontZ + 0.15);
  batcher.addBox('wood_warm', 3.2, 3.8, 0.35, pizX, pizBaseY + 1.9, frontZ + 0.18);

  for (let s = -14; s <= 14; s += 2.8) {
    const stripeKey = Math.abs(Math.round(s / 2.8)) % 2 === 0 ? 'roof_red' : 'trim_white';
    batcher.addBox(stripeKey, 2.7, 0.45, 3.6, pizX + s, pizBaseY + 4.4, frontZ + 1.8);
  }

  // PIZZA 3D GIGANTE DECORATIVA NO TOPO DO TELHADO!
  const roofY = pizBaseY + pizH + 1.5;
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

  // Mesinhas com Guarda-Sol na frente da Pizzaria
  for (const tx of [pizX - 11, pizX - 4, pizX + 4, pizX + 11]) {
    const tz = frontZ + 4.8;
    const tblY = IS_SCALED_WORLD ? tAt(tx, tz) + padLift : yBase;
    batcher.addBox('trim_white', 2.0, 0.85, 2.0, tx, tblY + 0.42, tz);
    batcher.addBox('trim_white', 0.22, 2.4, 0.22, tx, tblY + 1.4, tz);
    batcher.addBox(tx < pizX ? 'roof_red' : 'hedge_green', 2.8, 0.45, 2.8, tx, tblY + 2.5, tz);
  }

  world.addCollider(pizX, pizZ, pizW, pizD, pizBaseY + pizH + 2.0, pizBaseY);
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
  const dinBaseY = IS_SCALED_WORLD ? tAt(dinX, dinZ) + padLift : yBase;

  batcher.addBox('stone_grey', dinW + 0.6, 3.0, dinD + 0.6, dinX, dinBaseY - 1.4, dinZ);
  batcher.addBox('wall_lightgrey', dinW, dinH, dinD, dinX, dinBaseY + dinH * 0.5, dinZ);
  batcher.addBox('neon_pink', dinW + 1.0, 0.65, dinD + 1.0, dinX, dinBaseY + dinH + 0.3, dinZ);
  batcher.addBox('neon_cyan', dinW + 0.8, 0.55, dinD + 0.8, dinX, dinBaseY + 4.2, dinZ);
  batcher.addBox('window_glass', dinW - 6, 3.4, 0.35, dinX, dinBaseY + 2.2, dinZ + dinD * 0.5 + 0.15);

  world.addCollider(dinX, dinZ, dinW, dinD, dinBaseY + dinH + 1.2, dinBaseY);
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
export function buildSuburbParkAndBasketballBlock(world, batcher, px, pz, bw, bd, opts = {}) {
  const padLift = IS_SCALED_WORLD ? 0.06 : 0.28;
  const tAt = (qx, qz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(qx, qz) : 0);
  const terrainY = tAt(px, pz);
  const yBase = terrainY + padLift;

  if (!opts.skipSidewalkSlab) {
    world._addCityBlockSidewalk(px, pz, bw, bd, LEGO_COLORS.sidewalk, terrainY);
  }
  if (terrainY > 0.15) {
    batcher.addBox('stone_grey', bw - (IS_SCALED_WORLD ? 10 : -0.3), 2.4, bd - (IS_SCALED_WORLD ? 10 : -0.3), px, terrainY - 1.2, pz);
  }

  const innerW = bw - 10;
  const innerD = bd - 10;
  if (IS_SCALED_WORLD) {
    addTerrainFollowingSlab(world, batcher, 'lawn_green', innerW, innerD, px, pz, 0.06, 0.08);
    addTerrainFollowingSlab(world, batcher, 'walkway_stone', innerW - 4, 5.2, px, pz, 0.09, 0.10);
    addTerrainFollowingSlab(world, batcher, 'walkway_stone', 5.2, innerD - 4, px - 18, pz, 0.09, 0.10);
  } else {
    batcher.addBox('lawn_green', innerW, 0.1, innerD, px, yBase + 0.03, pz);
    batcher.addBox('walkway_stone', innerW - 4, 0.14, 5.2, px, yBase + 0.06, pz);
    batcher.addBox('walkway_stone', 5.2, 0.14, innerD - 4, px - 18, yBase + 0.06, pz);
  }
  world.mapBlocks.push({ x: px, z: pz, w: innerW, d: innerD, color: '#22c55e' });

  // 1. CORETO CLÁSSICO & CHAFARIZ DE ÁGUA AZUL (Lado Oeste da Praça: px - 18, pz)
  const gazX = px - 18;
  const gazZ = pz;
  const gazBaseY = IS_SCALED_WORLD ? tAt(gazX, gazZ) + padLift : yBase;
  batcher.addBox('trim_white', 14, 0.65, 14, gazX, gazBaseY + 0.32, gazZ);
  batcher.addBox('pool_water', 10.5, 0.78, 10.5, gazX, gazBaseY + 0.4, gazZ);
  batcher.addBox('trim_white', 7.2, 1.1, 7.2, gazX, gazBaseY + 0.55, gazZ);
  for (const gxOff of [-2.8, 2.8]) {
    for (const gzOff of [-2.8, 2.8]) {
      batcher.addBox('trim_white', 0.55, 5.2, 0.55, gazX + gxOff, gazBaseY + 3.2, gazZ + gzOff);
    }
  }
  addPitchedGableRoof(batcher, 'roof_red', gazX, gazBaseY + 5.8, gazZ, 8.2, 8.2, 2.8, true);
  world.addCollider(gazX, gazZ, 8.0, 8.0, gazBaseY + 8.5, gazBaseY);

  // 2. QUADRA DE BASQUETE DE RUA COMPLETA (Lado Leste da Praça: px + 18, pz)
  const crtX = px + 18;
  const crtZ = pz;
  const crtW = 24;
  const crtD = 42;
  const crtBaseY = IS_SCALED_WORLD
    ? Math.max(tAt(crtX, crtZ - crtD * 0.5), tAt(crtX, crtZ + crtD * 0.5), tAt(crtX, crtZ)) + padLift
    : yBase;
  if (IS_SCALED_WORLD) {
    batcher.addBox('stone_grey', crtW + 3.2, 2.0, crtD + 3.2, crtX, crtBaseY - 0.98, crtZ);
  }

  // Piso azul/laranja com linhas brancas de quadra e garrafão
  batcher.addBox('court_blue', crtW + 2.4, 0.12, crtD + 2.4, crtX, crtBaseY + 0.05, crtZ);
  batcher.addBox('court_orange', crtW, 0.15, crtD, crtX, crtBaseY + 0.07, crtZ);
  batcher.addBox('trim_white', crtW, 0.17, 0.35, crtX, crtBaseY + 0.08, crtZ); // Linha central
  batcher.addBox('court_blue', 7.2, 0.17, 9.5, crtX, crtBaseY + 0.08, crtZ - crtD * 0.5 + 4.8); // Garrafão Norte
  batcher.addBox('court_blue', 7.2, 0.17, 9.5, crtX, crtBaseY + 0.08, crtZ + crtD * 0.5 - 4.8); // Garrafão Sul

  // 2 Tabelas e Cestas de Basquete 3D nas pontas Norte e Sul da quadra!
  for (const dir of [-1, 1]) {
    const hoopZ = crtZ + dir * (crtD * 0.5 - 1.2);
    // Poste metálico + Braço + Tabela Branca + Alvo Vermelho + Aro Laranja
    batcher.addBox('charcoal_metal', 0.38, 4.8, 0.38, crtX, crtBaseY + 2.4, hoopZ + dir * 0.8);
    batcher.addBox('charcoal_metal', 0.32, 0.32, 1.2, crtX, crtBaseY + 4.6, hoopZ + dir * 0.2);
    batcher.addBox('trim_white', 2.8, 1.9, 0.2, crtX, crtBaseY + 4.7, hoopZ);
    batcher.addBox('flower_red', 1.1, 0.85, 0.24, crtX, crtBaseY + 4.5, hoopZ);
    batcher.addBox('court_orange', 0.85, 0.16, 0.85, crtX, crtBaseY + 4.1, hoopZ - dir * 0.5);
    world.addCollider(crtX, hoopZ + dir * 0.8, 0.8, 0.8, crtBaseY + 5.0, crtBaseY);
  }

  // Mureta/alambrado baixo nas laterais da quadra
  batcher.addBox('stone_grey', 0.4, 1.2, crtD, crtX - crtW * 0.5 - 1.2, crtBaseY + 0.6, crtZ);
  batcher.addBox('stone_grey', 0.4, 1.2, crtD, crtX + crtW * 0.5 + 1.2, crtBaseY + 0.6, crtZ);

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
    batcher.addFloweringTree(tx, IS_SCALED_WORLD ? tAt(tx, tz) + padLift : yBase, tz, 1.25, bKey);
  }
  spawnBreakableWhiteFence(world, px - 22, pz - 44, 8.0);
  spawnBreakableWhiteFence(world, px - 22, pz + 44, 8.0);
}
