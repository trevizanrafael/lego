import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial
} from '../../../materials/LegoMaterials.js';
import {
  buildFortifiedCompoundWalls,
  addTallIndustrialSmokestack,
  addGiantSiloBattery,
  addPCCContainerStack,
  addStolenGoldPallet,
  addSilverBriefcaseStack,
  addC4ExplosiveCrateStack,
  addPCCArmoredBoxTruck
} from './EastPortBatcherAndMaterials.js';

/**
 * 2. A CIDADELA / TORRE DO BUNKER CENTRAL DO PCC (112m DE ALTURA! QG DO "MESTRE DO COFRE")
 * - Mantém a Base Blindada Casamata de 30m (com porta-cofre gigante, frisos ciano e Rampa Subterrânea de Fuga);
 * - Faz subir do centro da base a Torre-Fortaleza Blindada Monumental até Y = 112m (dentro da faixa 85..120m!);
 * - Contrafortes blindados nas 4 quinas da torre, andares fortificados, 4 Passarelas Aéreas Blindadas (Skybridges)
 *   ligando a Torre Central aos prédios vizinhos, Radar Giratório e o Heliponto Principal do Chefe (`H`) no topo!
 */
export function buildPCCCentralCitadelAndBunker(world, batcher) {
  const cx = 866;
  const cz = -381;
  const compW = 172;
  const compD = 236;

  world.industrialPCCData.blocksCount += 2;
  world._addCityBlockSidewalk(cx, cz, compW, compD, 0x1e293b);
  buildFortifiedCompoundWalls(world, batcher, cx, cz, compW, compD, {
    wallH: 5.8,
    gateSouth: true,
    gateWest: true,
    gateWidth: 34
  });

  // 1) BASE CASAMATA BLINDADA DO BUNKER CENTRAL (X = 802..930 -> W=128, Z = -486..-370 -> D=116, H=30m)
  const bX = 866;
  const bZ = -428;
  const bW = 128;
  const bD = 116;
  const bH = 30.0;

  batcher.addBox('gunmetal_concrete', bW, bH, bD, bX, 0.28 + bH * 0.5, bZ);
  batcher.addBox('matte_black', bW - 4, 2.2, bD - 4, bX, 0.28 + bH - 0.9, bZ);
  world.addCollider(bX, bZ, bW, bD, 0.28 + bH, 0.28);
  world.industrialPCCData.bunkersCount++;

  // Paredes Externas Inclinadas da Casamata + Contrafortes Angulares
  const tilt = 0.14;
  batcher.addBox('matte_black', bW - 8, bH - 2, 3.2, bX, 0.28 + bH * 0.48, bZ + bD * 0.5 + 0.8, -tilt, 0, 0);
  batcher.addBox('matte_black', bW - 8, bH - 2, 3.2, bX, 0.28 + bH * 0.48, bZ - bD * 0.5 - 0.8, tilt, 0, 0);
  batcher.addBox('matte_black', 3.2, bH - 2, bD - 8, bX - bW * 0.5 - 0.8, 0.28 + bH * 0.48, bZ, 0, 0, tilt);
  batcher.addBox('matte_black', 3.2, bH - 2, bD - 8, bX + bW * 0.5 + 0.8, 0.28 + bH * 0.48, bZ, 0, 0, -tilt);

  for (let ox = -52; ox <= 52; ox += 26) {
    batcher.addBox('armor_slate', 4.6, bH, 6.2, bX + ox, 0.28 + bH * 0.48, bZ + bD * 0.5 + 1.6, -tilt * 1.2, 0, 0);
    batcher.addBox('armor_slate', 4.6, bH, 6.2, bX + ox, 0.28 + bH * 0.48, bZ - bD * 0.5 - 1.6, tilt * 1.2, 0, 0);
  }
  for (let oz = -44; oz <= 44; oz += 22) {
    batcher.addBox('armor_slate', 6.2, bH, 4.6, bX - bW * 0.5 - 1.6, 0.28 + bH * 0.48, bZ + oz, 0, 0, tilt * 1.2);
    batcher.addBox('armor_slate', 6.2, bH, 4.6, bX + bW * 0.5 + 1.6, 0.28 + bH * 0.48, bZ + oz, 0, 0, -tilt * 1.2);
  }

  for (const fy of [9.5, 19.5, 28.2]) {
    batcher.addBox('pcc_neon_blue', bW + 4.8, 0.55, bD + 4.8, bX, fy, bZ);
    batcher.addBox('tactical_white', bW + 4.4, 0.85, bD + 4.4, bX, fy - 1.1, bZ);
  }
  for (const wy of [13.5, 23.0]) {
    batcher.addBox('dark_steel', bW - 18, 1.6, 1.2, bX, wy, bZ + bD * 0.5 + 2.4);
    batcher.addBox('dark_steel', bW - 18, 1.6, 1.2, bX, wy, bZ - bD * 0.5 - 2.4);
    batcher.addBox('dark_steel', 1.2, 1.6, bD - 18, bX - bW * 0.5 - 2.4, wy, bZ);
    batcher.addBox('dark_steel', 1.2, 1.6, bD - 18, bX + bW * 0.5 + 2.4, wy, bZ);
  }

  // Porta Blindada Monumental Estilo Cofre na Fachada Sul (X = 838, Z = -369)
  const vDoorX = 838;
  const vDoorZ = bZ + bD * 0.5 + 2.6;
  batcher.addBox('pcc_navy', 26, 13.5, 3.2, vDoorX, 0.28 + 6.75, vDoorZ);
  batcher.addBox('brushed_silver', 22, 11.5, 3.6, vDoorX, 0.28 + 5.75, vDoorZ + 0.3);
  batcher.addBox('matte_black', 19, 10.2, 3.8, vDoorX, 0.28 + 5.1, vDoorZ + 0.5);
  batcher.addCylinder('brushed_silver', 3.4, 3.4, 1.2, vDoorX, 6.0, vDoorZ + 2.3, 12, Math.PI / 2, 0);
  batcher.addCylinder('pcc_neon_blue', 1.5, 1.5, 1.4, vDoorX, 6.0, vDoorZ + 2.4, 10, Math.PI / 2, 0);
  batcher.addBox('brushed_silver', 8.2, 0.65, 0.65, vDoorX, 6.0, vDoorZ + 2.6);
  batcher.addBox('brushed_silver', 0.65, 8.2, 0.65, vDoorX, 6.0, vDoorZ + 2.6);

  // ==========================================================================
  // 2) A CIDADELA / TORRE-FORTALEZA BLINDADA MONUMENTAL (SUBINDO ATÉ Y = 112m!)
  // ==========================================================================
  const baseRoofY = 0.28 + bH; // 30.28m
  const t1H = 34.0;
  batcher.addBox('matte_black', 68, t1H, 64, bX, baseRoofY + t1H * 0.5, bZ);
  batcher.addBox('dark_steel', 70, t1H - 4, 52, bX, baseRoofY + t1H * 0.5, bZ);
  batcher.addBox('dark_steel', 56, t1H - 4, 66, bX, baseRoofY + t1H * 0.5, bZ);
  world.addCollider(bX, bZ, 68, 64, baseRoofY + t1H, baseRoofY);

  const t2BaseY = baseRoofY + t1H;
  const t2H = 28.0;
  batcher.addBox('gunmetal_concrete', 54, t2H, 52, bX, t2BaseY + t2H * 0.5, bZ);
  batcher.addBox('dark_steel', 56, t2H - 4, 40, bX, t2BaseY + t2H * 0.5, bZ);
  batcher.addBox('dark_steel', 42, t2H - 4, 54, bX, t2BaseY + t2H * 0.5, bZ);
  world.addCollider(bX, bZ, 54, 52, t2BaseY + t2H, t2BaseY);

  const t3BaseY = t2BaseY + t2H;
  const t3H = 20.0;
  batcher.addBox('matte_black', 44, t3H, 44, bX, t3BaseY + t3H * 0.5, bZ);
  batcher.addBox('dark_steel', 46, t3H - 5, 32, bX, t3BaseY + t3H * 0.5, bZ);
  batcher.addBox('dark_steel', 32, t3H - 5, 46, bX, t3BaseY + t3H * 0.5, bZ);
  batcher.addBox('pcc_navy', 47, 2.8, 47, bX, t3BaseY + t3H - 1.4, bZ);
  world.addCollider(bX, bZ, 46, 46, t3BaseY + t3H, t3BaseY);

  const citadelTopY = t3BaseY + t3H; // 112.28m!
  world.industrialPCCData.corporateTowersCount++;

  world.mapBuildings.push({
    x: bX,
    z: bZ,
    w: bW,
    d: bD,
    height: 112,
    color: '#0ea5e9',
    label: 'CIDADELA BUNKER CENTRAL (PCC - 112m)'
  });

  // Contrafortes Blindados Gigantes nas 4 Quinas da Torre-Fortaleza (subindo de Y=30m até Y=112m!)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      batcher.addBox('armor_slate', 10, t1H + 2, 10, bX + sx * 33, baseRoofY + t1H * 0.5, bZ + sz * 31);
      batcher.addBox('pcc_navy', 11, 3.2, 11, bX + sx * 33, baseRoofY + t1H, bZ + sz * 31);
      batcher.addBox('armor_slate', 8.5, t2H + 2, 8.5, bX + sx * 26, t2BaseY + t2H * 0.5, bZ + sz * 25);
      batcher.addBox('pcc_navy', 9.5, 2.8, 9.5, bX + sx * 26, t2BaseY + t2H, bZ + sz * 25);
      batcher.addBox('matte_black', 7.2, t3H + 3.5, 7.2, bX + sx * 21, t3BaseY + t3H * 0.5, bZ + sz * 21);
      batcher.addBox('pcc_neon_blue', 2.2, t1H + t2H + t3H, 2.2, bX + sx * 22.5, baseRoofY + 41, bZ + sz * 22.5);
    }
  }

  // Andares Fortificados (Cintas de Aço Preto, Frisos Azul-Neon e Faixas Brancas a cada 8m de subida)
  for (let ay = 38; ay <= 108; ay += 8) {
    const ringW = ay < 64 ? 71 : ay < 92 ? 57 : 47;
    const ringD = ay < 64 ? 67 : ay < 92 ? 55 : 47;
    batcher.addBox('matte_black', ringW, 1.4, ringD, bX, ay, bZ);
    batcher.addBox('pcc_neon_blue', ringW + 0.6, 0.45, ringD + 0.6, bX, ay + 0.8, bZ);
    if (ay % 16 === 6) {
      batcher.addBox('tactical_white', ringW + 0.3, 0.5, ringD + 0.3, bX, ay - 0.8, bZ);
    }
  }

  // Letreiro Luminoso 3D no Alto da Cidadela ("CIDADELA PCC - 1533")
  batcher.addBox('matte_black', 38, 4.5, 2.2, bX, citadelTopY - 4.0, bZ + 23.2);
  batcher.addBox('pcc_neon_blue', 39, 0.55, 2.5, bX, citadelTopY - 1.6, bZ + 23.2);
  batcher.addBox('tactical_white', 32, 2.2, 2.6, bX, citadelTopY - 4.0, bZ + 23.3);

  // ==========================================================================
  // 3) 4 PONTES / PASSARELAS AÉREAS BLINDADAS (SKYBRIDGES) LIGANDO A CIDADELA AOS VIZINHOS
  // ==========================================================================
  _buildArmoredSkybridge(world, batcher, 760, 36.0, -446, 148, 8.5, 'x');
  _buildArmoredSkybridge(world, batcher, 976, 44.0, -446, 152, 8.5, 'x');
  _buildArmoredSkybridge(world, batcher, 866, 38.0, -522, 8.5, 92, 'z');
  _buildArmoredSkybridge(world, batcher, 764, 26.0, -356, 96, 7.5, 'x');

  // ==========================================================================
  // 4) HELIPONTO PRINCIPAL DO CHEFE (`H`) NO TOPO DA CIDADELA (Y = 112.28m) + RADAR GIRATÓRIO
  // ==========================================================================
  batcher.addBox('matte_black', 34, 0.5, 34, bX, citadelTopY + 0.25, bZ);
  batcher.addCylinder('pcc_neon_blue', 14.5, 14.5, 0.56, bX, citadelTopY + 0.28, bZ, 20);
  batcher.addCylinder('matte_black', 13.0, 13.0, 0.6, bX, citadelTopY + 0.3, bZ, 20);
  batcher.addBox('pcc_neon_blue', 2.4, 0.65, 14.0, bX - 4.5, citadelTopY + 0.33, bZ);
  batcher.addBox('pcc_neon_blue', 2.4, 0.65, 14.0, bX + 4.5, citadelTopY + 0.33, bZ);
  batcher.addBox('tactical_white', 11.4, 0.66, 2.4, bX, citadelTopY + 0.34, bZ);
  world.addCollider(bX, bZ, 36, 36, citadelTopY + 0.6, citadelTopY - 0.5);

  // Heliponto Auxiliar na Base Blindada do Bunker (X = 816, Y = 30.28m, Z = -386)
  batcher.addCylinder('pcc_neon_blue', 9.5, 9.5, 0.3, 816, baseRoofY + 0.15, -386, 16);
  batcher.addCylinder('matte_black', 8.4, 8.4, 0.34, 816, baseRoofY + 0.17, -386, 16);

  // 4 Torres de Vigia Blindadas nas 4 Esquinas da Base do Bunker (Y = 30.28m..43m)
  const towerCoords = [
    [bX - bW * 0.5 + 9, bZ - bD * 0.5 + 9],
    [bX + bW * 0.5 - 9, bZ - bD * 0.5 + 9],
    [bX - bW * 0.5 + 9, bZ + bD * 0.5 - 9],
    [bX + bW * 0.5 - 9, bZ + bD * 0.5 - 9]
  ];
  for (const [tx, tz] of towerCoords) {
    batcher.addBox('gunmetal_concrete', 11.0, 8.5, 11.0, tx, baseRoofY + 4.25, tz);
    batcher.addBox('matte_black', 12.6, 3.8, 12.6, tx, baseRoofY + 9.8, tz);
    batcher.addBox('dark_steel', 11.8, 1.8, 12.8, tx, baseRoofY + 9.8, tz);
    batcher.addBox('pcc_neon_blue', 13.0, 0.45, 13.0, tx, baseRoofY + 11.8, tz);
    batcher.addBox('pcc_navy', 13.6, 0.9, 13.6, tx, baseRoofY + 12.4, tz);
    world.addCollider(tx, tz, 12.6, 12.6, baseRoofY + 12.8, baseRoofY);
  }

  // Torre de Radar Giratório no Topo da Cidadela (X = 883, Z = -445, Y = 112.28m..121m)
  const radX = bX + 17;
  const radZ = bZ - 17;
  batcher.addBox('matte_black', 6.5, 5.5, 6.5, radX, citadelTopY + 2.75, radZ);
  batcher.addCylinder('brushed_silver', 1.0, 1.3, 4.5, radX, citadelTopY + 7.2, radZ, 8);
  const radGroupTY = batcher._terrainLift(radX, radZ);
  const radarGroup = new THREE.Group();
  radarGroup.position.set(radX, citadelTopY + 9.8 + radGroupTY, radZ);
  const radarBar = new THREE.Mesh(
    new THREE.BoxGeometry(11.0, 1.1, 1.5),
    getLegoMaterial(0x0ea5e9, { emissive: 0x0284c7, emissiveIntensity: 0.8 })
  );
  const radarDish = new THREE.Mesh(
    new THREE.CylinderGeometry(3.0, 0.8, 1.6, 10),
    getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.6, roughness: 0.2 })
  );
  radarDish.rotation.z = Math.PI / 3;
  radarDish.position.set(0, 1.3, 0);
  radarGroup.add(radarBar, radarDish);
  world.scene.add(radarGroup);
  world.rotatingElements.push({ mesh: radarGroup, axis: 'y', speed: 2.2 });

  // ==========================================================================
  // 5) RAMPA SUBTERRÂNEA / GARAGEM DE FUGA BLINDADA + ADENSAMENTO DO PÁTIO FRONTAL
  // ==========================================================================
  const rampX = 896;
  for (const rx of [rampX - 10.5, rampX + 10.5]) {
    batcher.addBox('gunmetal_concrete', 1.8, 5.2, 56, rx, 1.6, -346);
    batcher.addBox('matte_black', 2.0, 0.65, 56, rx, 4.3, -346);
    for (let lz = -368; lz <= -322; lz += 11) {
      batcher.addBox('pcc_neon_blue', 0.65, 0.55, 1.2, rx, 4.75, lz);
      batcher.addBox('tactical_white', 2.05, 1.2, 2.2, rx, 2.4, lz);
    }
    world.addCollider(rx, -346, 1.8, 56, 4.6, 0);
  }
  batcher.addBox('armor_slate', 19.2, 1.2, 54, rampX, -1.4, -346, 0.085, 0, 0);
  batcher.addBox('tactical_white', 0.45, 1.25, 48, rampX, -1.35, -346, 0.085, 0, 0);
  batcher.addBox('matte_black', 24, 11.5, 12, rampX, 4.2, -372);
  batcher.addBox('dark_steel', 18.5, 7.5, 8, rampX, 2.2, -371);
  batcher.addBox('brushed_silver', 18.8, 2.8, 1.4, rampX, 6.8, -366.2);
  batcher.addBox('pcc_neon_blue', 19.5, 0.55, 1.6, rampX, 8.6, -366.0);

  // Anexo Blindado de Segurança & Arsenal no lado sudoeste do pátio do Bunker (X = 804, Z = -302)
  batcher.addBox('matte_black', 36, 22.0, 42, 804, 0.28 + 11.0, -302);
  batcher.addBox('pcc_navy', 37.5, 2.4, 43.5, 804, 0.28 + 20.5, -302);
  batcher.addBox('pcc_neon_blue', 38.0, 0.5, 44.0, 804, 0.28 + 18.5, -302);
  world.addCollider(804, -302, 36, 42, 22.5, 0.28);

  // Pilhas de Contêineres Pretos/Azuis do PCC, Paletes de Ouro e Caixas de C4 preenchendo o leste do pátio
  addPCCContainerStack(world, batcher, 932, -338, 3, true);
  addPCCContainerStack(world, batcher, 932, -298, 2, true);
  addStolenGoldPallet(world, batcher, 838, -352, true);
  addStolenGoldPallet(world, batcher, 846, -352, false);
  addSilverBriefcaseStack(world, batcher, 854, -352);
  addC4ExplosiveCrateStack(world, batcher, 830, -352);
}

/**
 * Constrói Passarela Aérea Blindada (Skybridge) em Aço Preto, Vidro Fumê e Frisos Azul-Neon
 */
function _buildArmoredSkybridge(world, batcher, cx, y, cz, w, d, axis = 'x') {
  world.industrialPCCData.skybridgesCount++;
  batcher.addBox('matte_black', w, 1.2, d, cx, y, cz);
  batcher.addBox('dark_steel', w - 2, 4.2, d - 0.8, cx, y + 2.6, cz);
  batcher.addBox('pcc_navy', w, 1.1, d + 0.4, cx, y + 5.2, cz);
  batcher.addBox('pcc_neon_blue', w + 0.4, 0.4, d + 0.8, cx, y + 0.2, cz);
  batcher.addBox('pcc_neon_blue', w + 0.4, 0.4, d + 0.8, cx, y + 5.6, cz);
  const steps = 6;
  for (let i = -steps; i <= steps; i += 2) {
    const px = axis === 'x' ? cx + (i / steps) * (w * 0.44) : cx;
    const pz = axis === 'z' ? cz + (i / steps) * (d * 0.44) : cz;
    const bw = axis === 'x' ? 1.4 : w + 0.6;
    const bd = axis === 'z' ? 1.4 : d + 0.6;
    batcher.addBox('armor_slate', bw, 5.8, bd, px, y + 2.8, pz);
  }
  world.addCollider(cx, cz, w, d, y + 5.8, y);
}

/**
 * 3. PÁTIO DA FROTA — "O BONDE DO PCC" (X = 612..756, Z = -368..-264 — 100% PREENCHIDO!)
 */
export function buildPCCFleetConvoyYard(world, batcher) {
  const cx = 684;
  const cz = -316;
  const w = 144;
  const d = 104;

  world.industrialPCCData.blocksCount++;
  world._addCityBlockSidewalk(cx, cz, w, d, 0x0f172a);
  buildFortifiedCompoundWalls(world, batcher, cx, cz, w, d, {
    wallH: 5.0,
    gateSouth: true,
    gateWest: true,
    gateWidth: 28
  });

  // 1) Edifício de Comando da Frota & Arsenal no Fundo Norte (H = 38m, 118m x 26m)
  batcher.addBox('matte_black', 118, 38.0, 26, cx, 0.28 + 19.0, cz - 35);
  batcher.addBox('dark_steel', 112, 30.0, 27.2, cx, 0.28 + 20.0, cz - 35);
  for (const fy of [12, 22, 32, 37.5]) {
    batcher.addBox('pcc_navy', 120, 1.8, 27.6, cx, fy, cz - 35);
    batcher.addBox('pcc_neon_blue', 120.6, 0.45, 28.0, cx, fy + 1.0, cz - 35);
  }
  world.addCollider(cx, cz - 35, 118, 26, 38.5, 0.28);
  world.industrialPCCData.bunkersCount++;
  world.industrialPCCData.corporateTowersCount++;

  // 2) Galpão de Blindagem Rápida & Munição no Lado Leste (H = 28m, 26m x 56m — formando um L!)
  batcher.addBox('gunmetal_concrete', 26, 28.0, 56, cx + 52, 0.28 + 14.0, cz + 6);
  batcher.addBox('pcc_navy', 27.2, 2.4, 57.2, cx + 52, 0.28 + 26.8, cz + 6);
  batcher.addBox('pcc_neon_blue', 27.6, 0.45, 57.6, cx + 52, 0.28 + 25.0, cz + 6);
  world.addCollider(cx + 52, cz + 6, 26, 56, 28.5, 0.28);
  world.industrialPCCData.bunkersCount++;

  world.mapBuildings.push({
    x: cx,
    z: cz - 35,
    w: 118,
    d: 26,
    height: 38,
    color: '#1e3a8a',
    label: 'QUARTEL DA FROTA — BONDE DO PCC'
  });

  // Coberturas Táticas Metálicas sobre as fileiras de SUVs Blindadas e Vans Quebra-Cofre
  for (const canopyZ of [-338, -292]) {
    batcher.addBox('matte_black', 102, 0.9, 15, cx - 10, 7.2, canopyZ);
    batcher.addBox('pcc_navy', 104, 0.6, 16, cx - 10, 7.8, canopyZ);
    batcher.addBox('pcc_neon_blue', 104, 0.28, 0.6, cx - 10, 6.8, canopyZ + (canopyZ < cz ? 7.8 : -7.8));
  }
  for (let lx = 630; lx <= 728; lx += 18) {
    batcher.addBox('tactical_white', 0.35, 0.08, 13, lx, 0.3, -338);
    batcher.addBox('tactical_white', 0.35, 0.08, 13, lx, 0.3, -292);
  }

  addPCCContainerStack(world, batcher, cx - 54, cz + 28, 3, false);
  addStolenGoldPallet(world, batcher, cx + 32, cz - 14, false);
  addC4ExplosiveCrateStack(world, batcher, cx + 32, cz + 14);
}

/**
 * 4. PÁTIO DO DESMANCHE & FERRO-VELHO DO SINDICATO (X = 976..1148, Z = -368..-131 — 100% PREENCHIDO!)
 */
export function buildPCCChopShopAndScrapyard(world, batcher) {
  const cx = 1062;
  const cz = -250;
  const w = 172;
  const d = 236;

  world.industrialPCCData.blocksCount += 2;
  world._addCityBlockSidewalk(cx, cz, w, d, 0x1e293b);
  buildFortifiedCompoundWalls(world, batcher, cx, cz, w, d, {
    wallH: 5.4,
    gateSouth: true,
    gateWest: true,
    gateWidth: 32
  });

  // 1) Galpão Norte de Desmanche Pesado & Fundição de Ouro (H = 42m, 138m x 38m em Z = -342)
  const shopX = 1054;
  const shopZ = -342;
  batcher.addBox('matte_black', 138, 42.0, 38, shopX, 0.28 + 21.0, shopZ);
  batcher.addBox('pcc_navy', 140, 3.2, 40, shopX, 0.28 + 39.5, shopZ);
  batcher.addBox('pcc_neon_blue', 140.6, 0.55, 40.6, shopX, 0.28 + 37.5, shopZ);
  for (let bx = shopX - 48; bx <= shopX + 48; bx += 24) {
    batcher.addBox('dark_steel', 16, 11.0, 3.0, bx, 0.28 + 5.5, shopZ + 18.2);
    batcher.addBox('pcc_neon_blue', 14, 0.45, 0.6, bx, 0.28 + 10.8, shopZ + 19.5);
  }
  world.addCollider(shopX, shopZ, 138, 38, 42.5, 0.28);
  world.industrialPCCData.bunkersCount++;
  world.industrialPCCData.c4WarehousesCount++;

  // 2) Galpão Leste de Blindagem de Comboios (H = 36m, 36m x 136m em X = 1124, Z = -238)
  batcher.addBox('gunmetal_concrete', 36, 36.0, 136, 1124, 0.28 + 18.0, -238);
  batcher.addBox('matte_black', 37.2, 2.8, 137.2, 1124, 0.28 + 34.0, -238);
  batcher.addBox('tactical_white', 37.6, 0.6, 137.6, 1124, 0.28 + 31.5, -238);
  world.addCollider(1124, -238, 36, 136, 36.5, 0.28);
  world.industrialPCCData.bunkersCount++;

  addTallIndustrialSmokestack(world, batcher, 1126, -342, 74);
  addGiantSiloBattery(world, batcher, 1122, -158, 3, 48);

  world.mapBuildings.push({
    x: shopX,
    z: shopZ,
    w: 138,
    d: 38,
    height: 42,
    color: '#1d4ed8',
    label: 'COMPLEXO DE DESMANCHE & BLINDAGEM (PCC)'
  });

  // 3) Guindaste Eletromagnético Gigante (X = 1082, Z = -225, Altura 54m!)
  const craneX = 1082;
  const craneZ = -225;
  batcher.addBox('matte_black', 15, 5.0, 15, craneX, 0.28 + 2.5, craneZ);
  batcher.addBox('forklift_yellow', 7.2, 48.0, 7.2, craneX, 0.28 + 26.5, craneZ);
  batcher.addBox('matte_black', 10.5, 6.0, 12.0, craneX, 0.28 + 49.0, craneZ);
  batcher.addBox('pcc_navy', 52.0, 3.8, 5.6, craneX - 18.0, 0.28 + 52.0, craneZ);
  const magX = craneX - 34.0;
  batcher.addCylinder('brushed_silver', 0.28, 0.28, 26.0, magX, 0.28 + 39.0, craneZ, 8);
  batcher.addCylinder('matte_black', 4.5, 4.5, 1.5, magX, 0.28 + 25.5, craneZ, 12);
  batcher.addCylinder('pcc_neon_blue', 4.0, 4.0, 0.65, magX, 0.28 + 24.6, craneZ, 12);
  batcher.addBox('scrap_rust', 3.0, 1.5, 5.6, magX, 0.28 + 23.2, craneZ, 0.12, 0.25, -0.08);
  world.addCollider(craneX, craneZ, 15, 15, 54.0, 0.28);
  world.industrialPCCData.industrialCranesCount++;

  // 4) Prensa Hidráulica Industrial Colossal (X = 1014, Z = -215, Altura 26m)
  const pressX = 1014;
  const pressZ = -215;
  batcher.addBox('gunmetal_concrete', 24, 2.8, 20, pressX, 0.28 + 1.4, pressZ);
  batcher.addBox('matte_black', 3.6, 22.0, 18, pressX - 9.5, 0.28 + 12.4, pressZ);
  batcher.addBox('matte_black', 3.6, 22.0, 18, pressX + 9.5, 0.28 + 12.4, pressZ);
  batcher.addBox('pcc_navy', 24, 4.4, 19, pressX, 0.28 + 23.6, pressZ);
  batcher.addCylinder('brushed_silver', 1.6, 1.6, 12.0, pressX - 4.0, 0.28 + 16.5, pressZ, 8);
  batcher.addCylinder('brushed_silver', 1.6, 1.6, 12.0, pressX + 4.0, 0.28 + 16.5, pressZ, 8);
  batcher.addBox('forklift_yellow', 14.5, 2.6, 14.5, pressX, 0.28 + 9.5, pressZ);
  batcher.addBox('scrap_teal', 11.5, 2.0, 6.8, pressX, 0.28 + 3.8, pressZ);
  world.addCollider(pressX, pressZ, 24, 20, 26.0, 0.28);

  // 5) Pilhas Densas de Carros Amassados + Pilhas de Contêineres do PCC + Caminhões e Ouro Roubado
  const scrapStacks = [
    [1092, -162, 5],
    [1068, -162, 4],
    [1044, -162, 5],
    [1020, -162, 4],
    [996, -162, 5],
    [1092, -268, 4],
    [996, -255, 4]
  ];
  const scrapKeys = ['scrap_rust', 'scrap_teal', 'armor_slate', 'pcc_navy', 'forklift_yellow'];
  let sIdx = 0;
  for (const [sx, sz, layers] of scrapStacks) {
    for (let l = 0; l < layers; l++) {
      const key = scrapKeys[(sIdx + l) % scrapKeys.length];
      batcher.addBox(key, 5.8, 1.75, 3.4, sx, 0.28 + l * 1.8 + 0.9, sz, 0, (l % 2) * 0.12, 0);
    }
    world.addCollider(sx, sz, 6.0, 3.6, 0.28 + layers * 1.8, 0.28);
    sIdx++;
  }

  addPCCContainerStack(world, batcher, 994, -192, 3, false);
  addStolenGoldPallet(world, batcher, 996, -310, true);
  addStolenGoldPallet(world, batcher, 1004, -310, false);
  addPCCArmoredBoxTruck(world, batcher, 1072, -296);
}
