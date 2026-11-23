import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import {
  SUBURB_MATTE_VC_MAT,
  addPitchedGableRoof,
  spawnBreakableWhiteFence
} from '../../SuburbHouseGenerator.js';
import { mergeColoredGeometries, makeTranslatedBox } from '../../BuildingGenerator.js';
import { IS_SCALED_WORLD, ROAD } from '../../core/WorldLayoutScale.js';

let _sharedGasPumpGeo = null;
let _sharedPizzaGeo = null;

function getSharedGasPumpGeo() {
  if (!_sharedGasPumpGeo) {
    _sharedGasPumpGeo = markAsSharedAsset(
      mergeColoredGeometries([
        { geo: makeTranslatedBox(1.5, 2.2, 1.1, 0, 1.1, 0), color: new THREE.Color(LEGO_COLORS.red) },
        { geo: makeTranslatedBox(1.65, 0.55, 1.2, 0, 2.45, 0), color: new THREE.Color(LEGO_COLORS.white) },
        { geo: makeTranslatedBox(1.0, 0.55, 1.18, 0, 1.55, 0), color: new THREE.Color(0xfacc15) },
        { geo: makeTranslatedBox(0.18, 1.4, 0.25, 0.82, 1.15, 0), color: new THREE.Color(LEGO_COLORS.black) }
      ])
    );
    _sharedGasPumpGeo.computeBoundingBox();
    _sharedGasPumpGeo.computeBoundingSphere();
  }
  return _sharedGasPumpGeo;
}

function getSharedGiantPizzaGeo() {
  if (!_sharedPizzaGeo) {
    const mkDisc = (r, h, zOff) => {
      const g = new THREE.CylinderGeometry(r, r, h, 20);
      g.rotateX(Math.PI / 2);
      if (zOff) g.translate(0, 0, zOff);
      return g;
    };
    const parts = [
      { geo: mkDisc(5.2, 0.70, 0), color: new THREE.Color(0xd97706) },
      { geo: mkDisc(4.5, 0.76, 0), color: new THREE.Color(0xdc2626) },
      { geo: mkDisc(4.1, 0.82, 0), color: new THREE.Color(0xfacc15) }
    ];
    for (const [px, py] of [[-1.6, 1.4], [1.6, 1.4], [0, 0], [-1.8, -1.2], [1.7, -1.3], [0, 2.3], [0, -2.2]]) {
      const pep = new THREE.CylinderGeometry(0.65, 0.65, 0.9, 10);
      pep.rotateX(Math.PI / 2);
      pep.translate(px, py, 0);
      parts.push({ geo: pep, color: new THREE.Color(0x991b1b) });
    }
    _sharedPizzaGeo = markAsSharedAsset(mergeColoredGeometries(parts));
    _sharedPizzaGeo.computeBoundingBox();
    _sharedPizzaGeo.computeBoundingSphere();
  }
  return _sharedPizzaGeo;
}

function addTerrainFollowingSlab(world, batcher, matKey, w, d, cx, cz, yLift, thickness = 0.08) {
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const minX = cx - w * 0.5, maxX = cx + w * 0.5, minZ = cz - d * 0.5, maxZ = cz + d * 0.5;
  const yNW = tAt(minX, minZ), yNE = tAt(maxX, minZ), ySW = tAt(minX, maxZ), ySE = tAt(maxX, maxZ), yC = tAt(cx, cz);

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
    pos.setY(i, tAt(pos.getX(i), pos.getZ(i)) + yLift);
  }
  geo.computeVertexNormals();
  batcher.addCustomGeo(matKey, geo);
}

/**
 * QUARTEIRÃO ESPECIAL 1 (bx = 186, bz = -712 / `lm_posto` em 3x):
 * Posto de Gasolina Explosivo, Loja de Conveniência, Lava-Rápido e 6 Bombas em Reação em Cadeia!
 */
export function buildExplosiveGasStationBlock(world, batcher, gx, gz, bw, bd, opts = {}) {
  const dirZ = opts.facingDirZ ?? 1;
  const padLift = IS_SCALED_WORLD ? 0.06 : 0.28;
  const tAt = (px, pz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0);
  const terrainY = tAt(gx, gz);
  const yBase = terrainY + padLift;

  if (!opts.skipSidewalkSlab) {
    world._addCityBlockSidewalk(gx, gz, bw, bd, LEGO_COLORS.sidewalk, terrainY);
  }
  batcher.addBox('stone_grey', bw - (IS_SCALED_WORLD ? 10 : -0.4), 3.8, bd - (IS_SCALED_WORLD ? 10 : -0.4), gx, terrainY - 1.9, gz);

  if (IS_SCALED_WORLD) {
    addTerrainFollowingSlab(world, batcher, 'lawn_green', bw - 10, bd - 10, gx, gz, 0.05, 0.06);
    addTerrainFollowingSlab(world, batcher, 'asphalt_lot', bw - 14, bd - 16, gx, gz + dirZ * 4, 0.085, 0.08);
    const swZ = (opts.frontSidewalkInnerZ ?? (gz + dirZ * (bd * 0.5 - 5))) + dirZ * (ROAD.sidewalk * 0.5 - 0.2);
    for (const dxApron of [-22, 24]) {
      const ax = gx + dxApron;
      batcher.addBox('driveway_concrete', 14.0, 0.05, ROAD.sidewalk - 0.4, ax, tAt(ax, swZ) + 0.03, swZ);
    }
  } else {
    batcher.addBox('lawn_green', bw - 10, 0.06, bd - 10, gx, yBase + 0.01, gz);
    batcher.addBox('asphalt_lot', bw - 14, 0.1, bd - 16, gx, yBase + 0.05, gz + 4);
  }

  const stripeZ = gz - dirZ * 10;
  for (let vx = gx - 36; vx <= gx - 12; vx += 6) {
    const sy = IS_SCALED_WORLD ? tAt(vx, stripeZ) + padLift : yBase;
    batcher.addBox('stripe_white', 0.25, 0.04, 5.5, vx, sy + 0.09, stripeZ);
  }

  const storeX = gx - 14, storeZ = gz - dirZ * 28, storeW = 46, storeH = 8.5, storeD = 20;
  const storeBaseY = IS_SCALED_WORLD ? tAt(storeX, storeZ) + padLift : yBase;
  batcher.addBox('stone_grey', storeW + 0.6, 3.2, storeD + 0.6, storeX, storeBaseY - 1.5, storeZ);
  batcher.addBox('wall_white', storeW, storeH, storeD, storeX, storeBaseY + storeH * 0.5, storeZ);
  batcher.addBox('roof_red', storeW + 1.2, 1.1, storeD + 1.2, storeX, storeBaseY + storeH + 0.55, storeZ);
  batcher.addBox('hedge_green', storeW + 1.4, 0.6, storeD + 1.4, storeX, storeBaseY + storeH + 1.4, storeZ);
  batcher.addBox('window_glass', 26, 4.6, 0.35, storeX - 4, storeBaseY + 2.6, storeZ + dirZ * (storeD * 0.5 + 0.12));
  batcher.addBox('flower_yellow', 20, 1.2, 1.0, storeX - 4, storeBaseY + 2.0, storeZ + dirZ * (storeD * 0.5 - 1.2));
  batcher.addBox('charcoal_metal', 3.4, 4.2, 0.4, storeX - 4, storeBaseY + 2.1, storeZ + dirZ * (storeD * 0.5 + 0.2));

  world.addCollider(storeX, storeZ, storeW, storeD, storeBaseY + storeH + 1.8, storeBaseY);
  world.mapBuildings.push({ x: storeX, z: storeZ, w: storeW, d: storeD, height: storeH, color: '#f8fafc', label: 'CONVENIÊNCIA' });

  const washX = gx + 24, washZ = gz - dirZ * 28;
  const washBaseY = IS_SCALED_WORLD ? tAt(washX, washZ) + padLift : yBase;
  batcher.addBox('stone_grey', 22.6, 3.2, 20.6, washX, washBaseY - 1.5, washZ);
  batcher.addBox('wall_lightgrey', 22, 8.0, 20, washX, washBaseY + 4.0, washZ);
  batcher.addBox('court_blue', 23, 1.2, 21, washX, washBaseY + 8.6, washZ);
  batcher.addBox('window_glass', 2.2, 6.2, 2.2, washX - 5.5, washBaseY + 3.1, washZ + dirZ * 9.5);
  batcher.addBox('window_glass', 2.2, 6.2, 2.2, washX + 5.5, washBaseY + 3.1, washZ + dirZ * 9.5);
  world.addCollider(washX, washZ, 22, 20, washBaseY + 9.2, washBaseY);

  const canX = gx + 6, canZ = gz + dirZ * 12, canW = 54, canD = 30;
  const canBaseY = IS_SCALED_WORLD ? tAt(canX, canZ) + padLift : yBase;
  const canY = canBaseY + 8.92;
  batcher.addBox('trim_white', canW, 0.9, canD, canX, canY, canZ);
  batcher.addBox('roof_red', canW + 0.8, 1.1, canD + 0.8, canX, canY + 0.9, canZ);
  batcher.addBox('gold_accent', canW + 1.0, 0.45, canD + 1.0, canX, canY + 1.65, canZ);
  const signZ = canZ + dirZ * (canD * 0.5 - 1.2);
  batcher.addBox('roof_red', 24, 2.6, 1.6, canX, canY + 3.1, signZ);
  batcher.addBox('window_warm', 21, 1.6, 1.8, canX, canY + 3.1, signZ);

  for (const ix of [canX - 16, canX + 16]) {
    const islandBaseY = IS_SCALED_WORLD ? tAt(ix, canZ) + padLift : yBase;
    batcher.addBox('walkway_stone', 6.5, 0.32, 22, ix, islandBaseY + 0.18, canZ);
    for (const iz of [canZ - 7.5, canZ + 7.5]) {
      const colFloorY = IS_SCALED_WORLD ? tAt(ix, iz) + padLift : yBase;
      const colH = canY - colFloorY;
      batcher.addBox('trim_white', 1.2, colH, 1.2, ix, colFloorY + colH * 0.5, iz);
      batcher.addBox('roof_red', 1.4, 2.2, 1.4, ix, colFloorY + 1.1, iz);
      world.addCollider(ix, iz, 1.3, 1.3, canY, colFloorY);
    }
  }

  world.addCollider(canX, canZ, canW, canD, canY + 2.0, canY - 0.5);
  world.mapBuildings.push({ x: canX, z: canZ, w: canW, d: canD, height: IS_SCALED_WORLD ? 9.2 : canY, color: '#fb923c', label: 'POSTO OCTAN' });

  const totemX = gx - 36, totemZ = gz + dirZ * 38;
  const totemBaseY = IS_SCALED_WORLD ? tAt(totemX, totemZ) + padLift : yBase;
  batcher.addBox('roof_red', 3.4, 11.5, 1.2, totemX, totemBaseY + 5.75, totemZ);
  batcher.addBox('trim_white', 3.8, 0.6, 1.5, totemX, totemBaseY + 11.6, totemZ);
  batcher.addBox('window_warm', 2.6, 4.2, 1.35, totemX, totemBaseY + 8.2, totemZ);
  world.addCollider(totemX, totemZ, 3.4, 1.2, totemBaseY + 12.0, totemBaseY);

  const pumpGeo = getSharedGasPumpGeo();
  const pumpCoords = [
    [canX - 16, canZ - 4.2], [canX - 16, canZ], [canX - 16, canZ + 4.2],
    [canX + 16, canZ - 4.2], [canX + 16, canZ], [canX + 16, canZ + 4.2]
  ];
  for (const [px, pz] of pumpCoords) {
    const pumpY = IS_SCALED_WORLD ? tAt(px, pz) + padLift : yBase;
    const pumpGroup = new THREE.Group();
    pumpGroup.position.set(px, pumpY, pz);
    const pumpMesh = new THREE.Mesh(pumpGeo, SUBURB_MATTE_VC_MAT);
    pumpMesh.castShadow = true;
    pumpMesh.receiveShadow = true;
    pumpGroup.add(pumpMesh);
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
 * Pizzaria LEGO (com Pizza 3D Gigante giratória no telhado) + Diner Retrô & Mercadinho!
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

  if (IS_SCALED_WORLD) {
    addTerrainFollowingSlab(world, batcher, 'asphalt_lot', bw - 10, bd - 10, cx, cz, 0.075, 0.08);
    const apronZ = cz + bd * 0.5 - 5 + ROAD.sidewalk * 0.5 - 0.2;
    batcher.addBox('driveway_concrete', 14.0, 0.05, ROAD.sidewalk - 0.4, cx, tAt(cx, apronZ) + 0.03, apronZ);
  } else {
    batcher.addBox('asphalt_lot', bw - 10, 0.08, bd - 10, cx, yBase + 0.02, cz);
  }
  for (let sx = cx - 34; sx <= cx + 34; sx += 7.5) {
    const sy = IS_SCALED_WORLD ? tAt(sx, cz + 32) + padLift : yBase;
    batcher.addBox('stripe_white', 0.25, 0.04, 6.2, sx, sy + 0.075, cz + 32);
  }

  const pizX = cx - 20, pizZ = cz - 8, pizW = 34, pizH = 10.5, pizD = 28;
  const pizBaseY = IS_SCALED_WORLD ? tAt(pizX, pizZ) + padLift : yBase;
  batcher.addBox('stone_grey', pizW + 0.6, 3.0, pizD + 0.6, pizX, pizBaseY - 1.4, pizZ);
  batcher.addBox('wall_cream', pizW, pizH, pizD, pizX, pizBaseY + pizH * 0.5, pizZ);
  batcher.addBox('roof_red', pizW + 0.8, 1.4, pizD + 0.8, pizX, pizBaseY + pizH + 0.7, pizZ);
  batcher.addBox('hedge_green', pizW + 1.0, 0.9, pizD + 1.0, pizX, pizBaseY + 4.8, pizZ);
  batcher.addBox('chimney_brick', 3.2, pizH + 5.5, 3.2, pizX - pizW * 0.35, pizBaseY + (pizH + 5.5) * 0.5, pizZ - 6);

  const frontZ = pizZ + pizD * 0.5;
  batcher.addBox('window_warm', 10, 3.6, 0.3, pizX - 8, pizBaseY + 2.5, frontZ + 0.15);
  batcher.addBox('window_warm', 10, 3.6, 0.3, pizX + 8, pizBaseY + 2.5, frontZ + 0.15);
  batcher.addBox('wood_warm', 3.2, 3.8, 0.35, pizX, pizBaseY + 1.9, frontZ + 0.18);
  for (let s = -14; s <= 14; s += 2.8) {
    const stripeKey = Math.abs(Math.round(s / 2.8)) % 2 === 0 ? 'roof_red' : 'trim_white';
    batcher.addBox(stripeKey, 2.7, 0.45, 3.6, pizX + s, pizBaseY + 4.4, frontZ + 1.8);
  }

  const roofY = pizBaseY + pizH + 1.5;
  const pizzaGroup = new THREE.Group();
  pizzaGroup.position.set(pizX, roofY + 3.6, pizZ + 4);
  pizzaGroup.rotation.x = 0.38;
  const pizzaMesh = new THREE.Mesh(getSharedGiantPizzaGeo(), SUBURB_MATTE_VC_MAT);
  pizzaMesh.castShadow = true;
  pizzaGroup.add(pizzaMesh);
  world.scene.add(pizzaGroup);
  world.rotatingElements.push({ mesh: pizzaGroup, speed: 0.9, axis: 'y' });

  for (const tx of [pizX - 11, pizX - 4, pizX + 4, pizX + 11]) {
    const tz = frontZ + 4.8;
    const tblY = IS_SCALED_WORLD ? tAt(tx, tz) + padLift : yBase;
    batcher.addBox('trim_white', 2.0, 0.85, 2.0, tx, tblY + 0.42, tz);
    batcher.addBox('trim_white', 0.22, 2.4, 0.22, tx, tblY + 1.4, tz);
    batcher.addBox(tx < pizX ? 'roof_red' : 'hedge_green', 2.8, 0.45, 2.8, tx, tblY + 2.5, tz);
  }

  world.addCollider(pizX, pizZ, pizW, pizD, pizBaseY + pizH + 2.0, pizBaseY);
  world.mapBuildings.push({ x: pizX, z: pizZ, w: pizW, d: pizD, height: pizH, color: '#ef4444', label: 'PIZZARIA LEGO' });

  const dinX = cx + 21, dinZ = cz - 8, dinW = 34, dinH = 8.2, dinD = 26;
  const dinBaseY = IS_SCALED_WORLD ? tAt(dinX, dinZ) + padLift : yBase;
  batcher.addBox('stone_grey', dinW + 0.6, 3.0, dinD + 0.6, dinX, dinBaseY - 1.4, dinZ);
  batcher.addBox('wall_lightgrey', dinW, dinH, dinD, dinX, dinBaseY + dinH * 0.5, dinZ);
  batcher.addBox('neon_pink', dinW + 1.0, 0.65, dinD + 1.0, dinX, dinBaseY + dinH + 0.3, dinZ);
  batcher.addBox('neon_cyan', dinW + 0.8, 0.55, dinD + 0.8, dinX, dinBaseY + 4.2, dinZ);
  batcher.addBox('window_glass', dinW - 6, 3.4, 0.35, dinX, dinBaseY + 2.2, dinZ + dinD * 0.5 + 0.15);

  world.addCollider(dinX, dinZ, dinW, dinD, dinBaseY + dinH + 1.2, dinBaseY);
  world.mapBuildings.push({ x: dinX, z: dinZ, w: dinW, d: dinD, height: dinH, color: '#ec4899', label: 'DINER & MERCADO' });
}

/**
 * QUARTEIRÃO ESPECIAL 3 (bx = -60, bz = -712):
 * Praça Residencial & Quadra de Basquete de Rua (2 Tabelas/Cestas 3D, Coreto/Chafariz e Árvores Floridas)
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

  const innerW = bw - 10, innerD = bd - 10;
  if (IS_SCALED_WORLD) {
    addTerrainFollowingSlab(world, batcher, 'lawn_green', innerW, innerD, px, pz, 0.06, 0.08);
    addTerrainFollowingSlab(world, batcher, 'walkway_stone', innerW - 4, 5.2, px, pz, 0.095, 0.09);
    addTerrainFollowingSlab(world, batcher, 'walkway_stone', 5.2, innerD - 4, px - 18, pz, 0.10, 0.09);
  } else {
    batcher.addBox('lawn_green', innerW, 0.1, innerD, px, yBase + 0.03, pz);
    batcher.addBox('walkway_stone', innerW - 4, 0.14, 5.2, px, yBase + 0.06, pz);
    batcher.addBox('walkway_stone', 5.2, 0.14, innerD - 4, px - 18, yBase + 0.06, pz);
  }
  world.mapBlocks.push({ x: px, z: pz, w: innerW, d: innerD, color: '#22c55e' });

  const gazX = px - 18, gazZ = pz;
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

  const crtX = px + 18, crtZ = pz, crtW = 24, crtD = 42;
  const crtBaseY = IS_SCALED_WORLD
    ? Math.max(tAt(crtX, crtZ - crtD * 0.5), tAt(crtX, crtZ + crtD * 0.5), tAt(crtX, crtZ)) + padLift
    : yBase;
  if (IS_SCALED_WORLD) {
    batcher.addBox('stone_grey', crtW + 3.2, 2.0, crtD + 3.2, crtX, crtBaseY - 0.98, crtZ);
  }
  batcher.addBox('court_blue', crtW + 2.4, 0.10, crtD + 2.4, crtX, crtBaseY + 0.05, crtZ);
  batcher.addBox('court_orange', crtW, 0.12, crtD, crtX, crtBaseY + 0.075, crtZ);
  batcher.addBox('court_blue', 7.2, 0.13, 9.5, crtX, crtBaseY + 0.095, crtZ - crtD * 0.5 + 4.8);
  batcher.addBox('court_blue', 7.2, 0.13, 9.5, crtX, crtBaseY + 0.095, crtZ + crtD * 0.5 - 4.8);
  batcher.addBox('stripe_white', crtW, 0.14, 0.35, crtX, crtBaseY + 0.11, crtZ);

  for (const dir of [-1, 1]) {
    const hoopZ = crtZ + dir * (crtD * 0.5 - 1.2);
    batcher.addBox('charcoal_metal', 0.38, 4.8, 0.38, crtX, crtBaseY + 2.4, hoopZ + dir * 0.8);
    batcher.addBox('charcoal_metal', 0.32, 0.32, 1.2, crtX, crtBaseY + 4.6, hoopZ + dir * 0.2);
    batcher.addBox('trim_white', 2.8, 1.9, 0.2, crtX, crtBaseY + 4.7, hoopZ);
    batcher.addBox('flower_red', 1.1, 0.85, 0.24, crtX, crtBaseY + 4.5, hoopZ);
    batcher.addBox('court_orange', 0.85, 0.16, 0.85, crtX, crtBaseY + 4.1, hoopZ - dir * 0.5);
    world.addCollider(crtX, hoopZ + dir * 0.8, 0.8, 0.8, crtBaseY + 5.0, crtBaseY);
  }

  batcher.addBox('stone_grey', 0.4, 1.2, crtD, crtX - crtW * 0.5 - 1.2, crtBaseY + 0.6, crtZ);
  batcher.addBox('stone_grey', 0.4, 1.2, crtD, crtX + crtW * 0.5 + 1.2, crtBaseY + 0.6, crtZ);
  world.mapBuildings.push({ x: crtX, z: crtZ, w: crtW, d: crtD, height: 1.0, color: '#ea580c', label: 'QUADRA BASQUETE' });

  for (const [tx, tz, bKey] of [
    [px - 34, pz - 34, 'pink'], [px - 34, pz + 34, 'yellow'], [px - 4, pz - 34, 'pink'],
    [px - 4, pz + 34, 'yellow'], [px + 34, pz - 36, 'pink'], [px + 34, pz + 36, 'yellow']
  ]) {
    batcher.addFloweringTree(tx, IS_SCALED_WORLD ? tAt(tx, tz) + padLift : yBase, tz, 1.25, bKey);
  }
  spawnBreakableWhiteFence(world, px - 22, pz - 44, 8.0);
  spawnBreakableWhiteFence(world, px - 22, pz + 44, 8.0);
}

const CORNER_SHOP_CATALOG = [
  { label: 'PADARIA', wall: 'wall_amber', trim: 'roof_red', awningA: 'roof_red', awningB: 'gold_accent', glow: 'window_warm', mapColor: '#b45309', h: 9.2, hasTables: true },
  { label: 'FARMÁCIA', wall: 'wall_white', trim: 'court_blue', awningA: 'court_blue', awningB: 'trim_white', glow: 'neon_cyan', mapColor: '#0284c7', h: 8.6, hasCross: true },
  { label: 'BARBEARIA', wall: 'wall_brick', trim: 'charcoal_metal', awningA: 'shutter_blue', awningB: 'roof_red', glow: 'window_warm', mapColor: '#991b1b', h: 9.8, hasPole: true },
  { label: 'MERCADINHO', wall: 'wall_cream', trim: 'hedge_green', awningA: 'hedge_green', awningB: 'trim_white', glow: 'window_warm', mapColor: '#15803d', h: 8.4, hasCrates: true }
];

/**
 * Faixa Comercial de Bairro (`rIdx === 1` em 3x): Padaria, Farmácia, Barbearia e Mercadinho
 * com marquises/toldos, vitrines iluminadas e baias frontais de estacionamento em 45°!
 */
export function buildSuburbNeighborhoodCornerStrip(world, batcher, cfg) {
  const { minX, maxX, frontEdgeZ, depth = 42, facingDirZ = 1, variant = 0 } = cfg;
  const spanW = maxX - minX;
  if (spanW < 42) return;
  const tAt = (qx, qz) => (world.getTerrainHeightAt ? world.getTerrainHeightAt(qx, qz) : 0);
  const centerX = (minX + maxX) * 0.5;
  const centerZ = frontEdgeZ - facingDirZ * (depth * 0.5);

  addTerrainFollowingSlab(world, batcher, 'asphalt_lot', spanW - 2.0, depth - 2.0, centerX, centerZ, 0.075, 0.08);
  const promZ = frontEdgeZ - facingDirZ * 12.2;
  addTerrainFollowingSlab(world, batcher, 'walkway_stone', spanW - 3.0, 4.4, centerX, promZ, 0.098, 0.09);

  const apronZ = frontEdgeZ + facingDirZ * (ROAD.sidewalk * 0.5 - 0.25);
  for (const ax of [minX + 16, maxX - 16]) {
    batcher.addBox('driveway_concrete', 11.5, 0.05, ROAD.sidewalk - 0.5, ax, tAt(ax, apronZ) + 0.03, apronZ);
  }

  const bayZ = frontEdgeZ - facingDirZ * 5.6;
  const bayYaw = facingDirZ > 0 ? 0.62 : -0.62;
  for (let bx = minX + 12; bx <= maxX - 12; bx += 6.2) {
    const by = tAt(bx, bayZ);
    batcher.setTransform(bx, bayZ, bayYaw, world, by);
    batcher.addBox('stripe_white', 0.24, 0.03, 5.4, bx, by + 0.105, bayZ);
    batcher.clearTransform();
  }

  const shopCount = Math.max(2, Math.min(7, Math.floor(spanW / 24.5)));
  const slotW = (spanW - 4.0) / shopCount;
  const shopD = Math.min(20.5, depth - 16.5);
  const shopZ = frontEdgeZ - facingDirZ * (14.8 + shopD * 0.5);
  const facadeZ = shopZ + facingDirZ * (shopD * 0.5);

  for (let i = 0; i < shopCount; i++) {
    const spec = CORNER_SHOP_CATALOG[(i + variant) % CORNER_SHOP_CATALOG.length];
    const sx = minX + 2.0 + (i + 0.5) * slotW;
    const sw = slotW - 0.8;
    const sh = spec.h + ((i + variant) % 2) * 1.1;
    const sY = tAt(sx, shopZ) + 0.06;

    batcher.addBox('stone_grey', sw + 0.3, 2.8, shopD + 0.3, sx, sY - 1.35, shopZ);
    batcher.addBox(spec.wall, sw, sh, shopD, sx, sY + sh * 0.5, shopZ);
    batcher.addBox(spec.trim, sw + 0.5, 0.85, shopD + 0.5, sx, sY + sh + 0.42, shopZ);
    batcher.addBox('charcoal_metal', 2.8, 1.1, 2.4, sx - sw * 0.24, sY + sh + 1.35, shopZ - facingDirZ * 3.0);

    const winW = Math.max(3.2, sw * 0.33);
    batcher.addBox('wood_warm', 2.2, 3.3, 0.28, sx, sY + 1.65, facadeZ + facingDirZ * 0.14);
    batcher.addBox(spec.glow, winW, 2.7, 0.26, sx - sw * 0.28, sY + 2.15, facadeZ + facingDirZ * 0.14);
    batcher.addBox('window_glass', winW, 2.7, 0.26, sx + sw * 0.28, sY + 2.15, facadeZ + facingDirZ * 0.14);
    batcher.addBox(spec.glow, sw * 0.66, 0.95, 0.32, sx, sY + sh - 1.35, facadeZ + facingDirZ * 0.18);

    const awnStripes = Math.max(4, Math.floor((sw - 1.2) / 2.2));
    const awnStep = (sw - 1.2) / awnStripes;
    for (let k = 0; k < awnStripes; k++) {
      const ax = sx - (sw - 1.2) * 0.5 + (k + 0.5) * awnStep;
      batcher.addBox(k % 2 === 0 ? spec.awningA : spec.awningB, awnStep - 0.08, 0.38, 2.6, ax, sY + 3.95, facadeZ + facingDirZ * 1.3);
    }

    if (spec.hasCross) {
      batcher.addBox('neon_cyan', 0.45, 1.5, 0.38, sx + sw * 0.38, sY + 5.6, facadeZ + facingDirZ * 0.24);
      batcher.addBox('neon_cyan', 1.5, 0.45, 0.38, sx + sw * 0.38, sY + 5.6, facadeZ + facingDirZ * 0.24);
    } else if (spec.hasPole) {
      const poleX = sx - 1.65, poleZ = facadeZ + facingDirZ * 0.42;
      batcher.addBox('trim_white', 0.34, 1.45, 0.34, poleX, sY + 2.3, poleZ);
      batcher.addBox('roof_red', 0.38, 0.36, 0.38, poleX, sY + 2.6, poleZ);
      batcher.addBox('court_blue', 0.38, 0.36, 0.38, poleX, sY + 2.0, poleZ);
    } else if (spec.hasTables) {
      for (const dxT of [-sw * 0.26, sw * 0.26]) {
        const tz = facadeZ + facingDirZ * 2.1;
        batcher.addBox('trim_white', 1.4, 0.78, 1.4, sx + dxT, sY + 0.44, tz);
      }
    } else if (spec.hasCrates) {
      batcher.addBox('flower_yellow', 2.8, 0.65, 1.1, sx - sw * 0.26, sY + 0.42, facadeZ + facingDirZ * 0.9);
      batcher.addBox('flower_red', 2.8, 0.65, 1.1, sx + sw * 0.26, sY + 0.42, facadeZ + facingDirZ * 0.9);
    }

    world.addCollider(sx, shopZ, sw, shopD, sY + sh + 1.0, sY);
    world.mapBuildings.push({ x: sx, z: shopZ, w: sw, d: shopD, height: sh, color: spec.mapColor, label: spec.label });
  }
}
