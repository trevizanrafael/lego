import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';
import { NAVAL_AIR_SPECS } from '../NavalAndAirFleetBuilder.js';
import { RIVER_BRIDGE_SPECS, RIVER_PIER_SPECS } from '../RoadGridBuilder.js';
import { buildTerritoryInfrastructureForZone } from '../FactionWarSystem.js';

/**
 * ACUMULADOR DE GEOMETRIAS DO IMPÉRIO INDUSTRIAL & CORPORATIVO DO PCC (60 FPS CRAVADOS!)
 * Funde dezenas de milhares de peças 3D (Cidadela de 112m, Passarelas Aéreas Blindadas, Torres Corporativas de Lavagem
 * de 48-80m, Megagalpões de 40-48m, Baterias de Silos de 55m, Torres de Resfriamento, Chaminés de 68-85m com Fumaça,
 * Pilhas de Contêineres Pretos/Azuis, Frotas de Caminhões/SUVs/Vans, Paletes de Ouro, C4 e Muralhas) em ~16 Draw Calls!
 */
class PCCIndustrialBatcher {
  constructor(world = null) {
    this.world = world;
    this.buckets = new Map();
    this.materials = new Map();
    this._initMaterials();
  }

  _terrainLift(x, z) {
    if (!this.world?.getTerrainHeightAt) return 0;
    if (x < 622 || x > 1430 || z < -720 || z > -40) return 0;
    return Math.max(0, this.world.getTerrainHeightAt(x, z));
  }

  _reg(key, colorHex, opts = {}) {
    this.buckets.set(key, []);
    this.materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: opts.roughness ?? 0.32,
        metalness: opts.metalness ?? 0.12,
        emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
        emissiveIntensity: opts.emissiveIntensity ?? 0.0
      })
    );
  }

  _initMaterials() {
    // Paleta Oficial do PCC: Preto Fosco, Cinza-Chumbo, Vidro Preto Espelhado, Azul-Marinho/Neon e Branco/Prata
    this._reg('matte_black', 0x090a0d, { roughness: 0.4, metalness: 0.24 });
    this._reg('gunmetal_concrete', 0x1e293b, { roughness: 0.54, metalness: 0.12 });
    this._reg('armor_slate', 0x334155, { roughness: 0.46, metalness: 0.16 });
    this._reg('dark_steel', 0x0b1120, { roughness: 0.12, metalness: 0.58 }); // Vidro preto espelhado / fumê azulado
    this._reg('pcc_navy', 0x1e3a8a, { roughness: 0.28, metalness: 0.2 });
    this._reg('pcc_royal', 0x1d4ed8, { roughness: 0.24, metalness: 0.22 });
    this._reg('pcc_neon_blue', 0x0ea5e9, {
      roughness: 0.15,
      metalness: 0.1,
      emissive: 0x0284c7,
      emissiveIntensity: 0.88
    });
    this._reg('tactical_white', 0xf8fafc, { roughness: 0.26, metalness: 0.08 });
    this._reg('brushed_silver', 0xcbd5e1, { roughness: 0.22, metalness: 0.58 });
    this._reg('stolen_gold', 0xfacc15, {
      roughness: 0.16,
      metalness: 0.68,
      emissive: 0xb45309,
      emissiveIntensity: 0.22
    });
    this._reg('pallet_wood', 0x92400e, { roughness: 0.65, metalness: 0.02 });
    this._reg('forklift_yellow', 0xeab308, { roughness: 0.26, metalness: 0.15 });
    this._reg('c4_hazard_red', 0xef4444, {
      roughness: 0.2,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9
    });
    this._reg('scrap_rust', 0x7c2d12, { roughness: 0.62, metalness: 0.25 });
    this._reg('scrap_teal', 0x0f766e, { roughness: 0.4, metalness: 0.2 });
    this._reg('smoke_plume', 0x64748b, { roughness: 0.85, metalness: 0.0 });
    // Materiais Clássicos Vibrantes do Porto de Cargas & Contrabando A.R.E.S.
    this._reg('lego_red', 0xdc2626, { roughness: 0.24, metalness: 0.1 });
    this._reg('lego_green', 0x16a34a, { roughness: 0.24, metalness: 0.1 });
    this._reg('lego_orange', 0xf97316, { roughness: 0.24, metalness: 0.12 });
    this._reg('ares_neon_purple', 0xa855f7, {
      roughness: 0.18,
      metalness: 0.25,
      emissive: 0x9333ea,
      emissiveIntensity: 0.92
    });
    this._reg('ares_magenta', 0xd946ef, {
      roughness: 0.16,
      metalness: 0.28,
      emissive: 0xc026d3,
      emissiveIntensity: 0.95
    });
    this._reg('floodlight_glow', 0xfef08a, {
      roughness: 0.1,
      emissive: 0xfef08a,
      emissiveIntensity: 0.95
    });
    this._reg('coastal_turquoise', 0x06b6d4, { roughness: 0.22, metalness: 0.14 });
    this._reg('sand_gold', 0xfde047, { roughness: 0.58, metalness: 0.02 });
  }

  addBox(key, w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
    const arr = this.buckets.get(key);
    if (!arr) return;
    const tY = this._terrainLift(x, z);
    let finalH = h;
    let finalY = y + tY;
    if (tY > 0.04 && y - h * 0.5 <= 0.65 && rotX === 0 && rotZ === 0) {
      finalH = h + 3.5;
      finalY = y + tY - 1.75;
    }
    if (rotX === 0 && rotY === 0 && rotZ === 0) {
      arr.push(makeTranslatedBox(w, finalH, d, x, finalY, z));
      return;
    }
    const geo = new THREE.BoxGeometry(w, finalH, d);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotY !== 0) geo.rotateY(rotY);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(x, finalY, z);
    arr.push(geo);
  }

  addCylinder(key, rTop, rBot, h, x, y, z, segs = 8, rotX = 0, rotZ = 0) {
    const arr = this.buckets.get(key);
    if (!arr) return;
    const tY = this._terrainLift(x, z);
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(x, y + tY, z);
    arr.push(geo);
  }

  createSubBatcher() {
    const sub = Object.create(PCCIndustrialBatcher.prototype);
    sub.world = this.world;
    sub.materials = this.materials;
    sub.buckets = new Map();
    for (const key of this.materials.keys()) {
      sub.buckets.set(key, []);
    }
    return sub;
  }

  finalize(scene) {
    // Sombras seletivas apenas nos materiais estruturais grandes para garantir 60 FPS cravados!
    const shadowCasterKeys = new Set([
      'matte_black',
      'gunmetal_concrete',
      'armor_slate',
      'dark_steel',
      'pcc_navy'
    ]);
    for (const [key, geos] of this.buckets.entries()) {
      if (geos.length === 0) continue;
      const merged = mergeBufferGeometries(geos);
      for (let i = 0; i < geos.length; i++) geos[i].dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this.materials.get(key));
      mesh.castShadow = shadowCasterKeys.has(key);
      mesh.receiveShadow = key !== 'pcc_neon_blue' && key !== 'c4_hazard_red' && key !== 'smoke_plume';
      scene.add(mesh);
    }
    this.buckets.clear();
  }
}

/**
 * 6 & 7. IMPÉRIO INDUSTRIAL & CORPORATIVO BLINDADO 100% DO PCC + PORTO METROPOLITANO
 */
export function buildEastCanalIndustrialAndPort(world) {
  const batcher = new PCCIndustrialBatcher(world);

  // Metadados Oficiais do Território 100% PCC para inspeção e testes automatizados
  world.industrialPCCData = {
    faction: 'PCC',
    factionName: 'PRIMEIRO COMANDO (PCC)',
    colors: ['matte_black', 'gunmetal_concrete', 'pcc_navy', 'pcc_neon_blue', 'tactical_white', 'brushed_silver'],
    hasCentralBunker: true,
    citadelHeight: 112,
    skybridgesCount: 0,
    hasUndergroundEscapeRamp: true,
    hasRooftopBlueHelipad: true,
    bunkerWatchtowersCount: 4,
    blocksCount: 0,
    bunkersCount: 0,
    corporateTowersCount: 0,
    c4WarehousesCount: 0,
    siloBatteriesCount: 0,
    coolingTowersCount: 0,
    tallSmokestacksCount: 0,
    industrialCranesCount: 0,
    pccContainerStacksCount: 0,
    horizontalTanksCount: 0,
    stolenGoldPalletsCount: 0,
    silverBriefcaseStacksCount: 0,
    c4CratesCount: 0,
    forkliftsCount: 0,
    boxTrucksCount: 0,
    hasChopShopYard: true,
    hasElectromagneticCrane: true,
    hasHydraulicPress: true,
    hasFleetConvoyYard: true,
    entryBarricadesCount: 0
  };

  // 1. CANAL URBANO LESTE + PONTES BLINDADAS + 5 BARRICADAS TÁTICAS DO PCC NAS ENTRADAS
  buildEastCanalBridgesAndPCCBarricades(world, batcher);

  // Eleva automaticamente colisores do Distrito Industrial Leste conforme a Elevação Industrial (+7.0m)
  const origAddCollider = world.addCollider.bind(world);
  world.addCollider = (cx, cz, cw, cd, maxY = 10, minY = 0) => {
    const tY = batcher._terrainLift(cx, cz);
    if (tY > 0.04) {
      const adjMin = minY <= 0.6 ? minY + tY - 3.5 : minY + tY;
      return origAddCollider(cx, cz, cw, cd, maxY + tY, adjMin);
    }
    return origAddCollider(cx, cz, cw, cd, maxY, minY);
  };

  try {
    // 2. A CIDADELA / TORRE DO BUNKER CENTRAL DO PCC (112m DE ALTURA + PASSARELAS AÉREAS BLINDADAS + RAMPA SUBTERRÂNEA)
    buildPCCCentralCitadelAndBunker(world, batcher);

    // 3. PÁTIO DA FROTA — "O BONDE DO PCC" (DENSO COM 2 GARAGENS BLINDADAS EM L, PILHAS DE CONTÊINERES E COMBOIO!)
    buildPCCFleetConvoyYard(world, batcher);

    // 4. PÁTIO DO DESMANCHE & FERRO-VELHO DO SINDICATO (OFICINAS EM U, CARROS-FORTES ROUBADOS, PRENSA E GUINDASTE)
    buildPCCChopShopAndScrapyard(world, batcher);

    // 5. EXPANSÃO TOTAL DOS QUARTEIRÕES DO PCC (COBRINDO 100% DA REGIÃO LESTE E NORDESTE ATÉ ENCOSTAR NO PORTO!)
    buildAllExpandedPCCIndustrialAndCorporateBlocks(world, batcher);
  } finally {
    world.addCollider = origAddCollider;
  }

  // 6. PORTO DE CARGAS & CAIS MARÍTIMO (CAIS PESADO, LABIRINTO DE CONTÊINERES 4 ANDARES, 3 PORTAINER CRANES, DOCA 01/02 E NAVIO CARGUEIRO)
  buildMetropolitanPortAndDocks(world, batcher);

  // Finaliza toda a malha estática do Império Blindado do PCC + Porto de Cargas em ~21 Draw Calls!
  batcher.finalize(world.scene);

  // 7. Infraestrutura Oficial dos 2 Territórios Leste/Sudeste: PCC (Industrial/Cidadela) e A.R.E.S. (Porto Blindado)!
  buildTerritoryInfrastructureForZone(world, 'pcc');
  buildTerritoryInfrastructureForZone(world, 'ares');
}

/**
 * 1. RIO / CANAL URBANO NAVEGÁVEL DE PONTA A PONTA (MAR NORTE Z = -1320 AO MAR SUL Z = +1068, COTA Y = -3.5),
 *    MUROS DE CAIS DE PEDRA/CONCRETO, 3 PÍERES FLUVIAIS DE MADEIRA E 9 PONTES ELEVADAS EM ARCO (Y = +5.0m)
 */
function buildEastCanalBridgesAndPCCBarricades(world, batcher) {
  const riverX = 560;
  const riverWidth = 40;
  const riverZStart = -1320;
  const riverZEnd = 1068;
  const riverLength = riverZEnd - riverZStart; // 2388m de ponta a ponta!
  const riverCenterZ = (riverZStart + riverZEnd) * 0.5; // -126
  const waterY = -3.5;

  // Registra metadados completos do Rio Navegável e das Pontes em Arco para testes e inspeção
  world.urbanRiverData = {
    xCenter: riverX,
    width: riverWidth,
    zStart: riverZStart,
    zEnd: riverZEnd,
    waterY,
    archPeakY: 5.0,
    verticalClearance: 8.5,
    horizontalClearance: 36.0,
    archedBridgesCount: RIVER_BRIDGE_SPECS.length,
    hasBeachMouthBridge: true,
    riverPiersCount: RIVER_PIER_SPECS.length,
    connectedToNorthAndSouthOcean: true,
    zeroBridgeRoadColliders: true
  };

  // 1.1 Superfície da Água do Rio Navegável na cota Y = -3.50 (ligando o Oceano Norte direto ao Oceano Sul!)
  const canalWaterMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.16,
    metalness: 0.12
  });
  const canal = new THREE.Mesh(new THREE.BoxGeometry(riverWidth, 0.3, riverLength), canalWaterMat);
  canal.position.set(riverX, waterY - 0.15, riverCenterZ);
  canal.receiveShadow = true;
  world.scene.add(canal);
  world.mapWater.push({ x: riverX, z: riverCenterZ, w: riverWidth, d: riverLength });

  // Faixas sutis de espuma/correnteza azul-clara ao longo do eixo central do Rio (em Y = -3.48)
  for (let wz = -1260; wz <= 1020; wz += 60) {
    batcher.addBox('coastal_turquoise', 1.4, 0.04, 24.0, riverX - 8.5, waterY + 0.02, wz);
    batcher.addBox('coastal_turquoise', 1.4, 0.04, 24.0, riverX + 8.5, waterY + 0.02, wz + 28);
  }

  // 1.2 Muros de Cais de Pedra Cinza/Concreto nas Duas Margens (Oeste X = 539.0 e Leste X = 581.0)
  // Descendo desde a borda das ruas (Y = +0.35) até o fundo da água (Y = -4.0)!
  const westQuayLen = 1045 - (-1320); // 2365m (de Z = -1320 até a ponta da Areia da Praia em Z = +1045)
  const westQuayCZ = (-1320 + 1045) * 0.5;
  batcher.addBox('gunmetal_concrete', 2.4, 4.35, westQuayLen, 539.0, -1.825, westQuayCZ);
  batcher.addBox('brushed_silver', 2.8, 0.24, westQuayLen, 539.0, 0.42, westQuayCZ);

  const eastQuayLen = 735 - (-1320); // 2055m (de Z = -1320 até a borda Sul do Porto em Z = +735)
  const eastQuayCZ = (-1320 + 735) * 0.5;
  batcher.addBox('gunmetal_concrete', 2.4, 4.35, eastQuayLen, 581.0, -1.825, eastQuayCZ);
  batcher.addBox('brushed_silver', 2.8, 0.24, eastQuayLen, 581.0, 0.42, eastQuayCZ);

  // Calçadão Costeiro na Margem Oeste da Foz da Praia (X = 532..540, Z = 725..1040) + Praça de Cabeceira na Ponte Z = 402
  batcher.addBox('tactical_white', 8.5, 0.34, 315, 534.5, 0.17, 882.5);
  batcher.addBox('coastal_turquoise', 1.2, 0.36, 315, 531.2, 0.18, 882.5);
  batcher.addBox('matte_black', 28.0, 0.3, 32.0, 594.0, 0.15, 402.0);

  // Molhes de Pedra / Quebra-Mar e Faroletes Náuticos nas Fozes Sul (Z = 1045..1068) e Norte (Z = -1320)
  batcher.addBox('armor_slate', 5.2, 4.6, 28, 538.0, -1.7, 1055);
  batcher.addBox('armor_slate', 5.2, 4.6, 56, 582.0, -1.7, 760);
  for (const [bx, bz, beaconKey] of [
    [538.0, 1066, 'coastal_turquoise'],
    [582.0, 785,  'c4_hazard_red'],
    [538.0, -1318, 'coastal_turquoise'],
    [582.0, -1318, 'pcc_neon_blue']
  ]) {
    batcher.addCylinder('tactical_white', 0.85, 1.25, 7.5, bx, 4.1, bz, 8);
    batcher.addBox(beaconKey, 1.8, 1.4, 1.8, bx, 8.2, bz);
    batcher.addBox('stolen_gold', 0.9, 0.5, 0.9, bx, 9.1, bz);
  }

  // Função auxiliar para checar se uma coordenada Z na margem está ocupada por Ponte ou Píer Fluvial
  const isBankOpenAt = (zPos, bankSide) => {
    for (const b of RIVER_BRIDGE_SPECS) {
      if (Math.abs(zPos - b.z) <= b.width * 0.5 + 3.5) return false;
    }
    for (const p of RIVER_PIER_SPECS) {
      if (p.bank === bankSide && Math.abs(zPos - p.z) <= p.lengthZ * 0.5 + 3.0) return false;
    }
    return true;
  };

  // Guarda-corpos de Pedra/Ferro com Studs LEGO e Postes de Iluminação Ribeirinhos ao longo das duas margens
  for (let rz = -1296; rz <= 1024; rz += 16) {
    if (isBankOpenAt(rz, 'west')) {
      batcher.addBox('armor_slate', 0.65, 0.85, 14.5, 538.8, 0.88, rz);
      batcher.addBox('brushed_silver', 0.85, 0.18, 15.2, 538.8, 1.36, rz);
      batcher.addCylinder('brushed_silver', 0.32, 0.32, 0.22, 538.8, 1.54, rz - 4.5, 6);
      batcher.addCylinder('brushed_silver', 0.32, 0.32, 0.22, 538.8, 1.54, rz + 4.5, 6);

      if (Math.abs(rz) % 64 === 0) {
        _addRiversideDoubleLamp(batcher, 537.2, 0.45, rz, rz > 650 ? 'beach' : 'urban');
      }
    }
    if (rz <= 720 && isBankOpenAt(rz, 'east')) {
      batcher.addBox('armor_slate', 0.65, 0.85, 14.5, 581.2, 0.88, rz);
      batcher.addBox('brushed_silver', 0.85, 0.18, 15.2, 581.2, 1.36, rz);
      batcher.addCylinder('brushed_silver', 0.32, 0.32, 0.22, 581.2, 1.54, rz - 4.5, 6);
      batcher.addCylinder('brushed_silver', 0.32, 0.32, 0.22, 581.2, 1.54, rz + 4.5, 6);

      if (Math.abs(rz) % 64 === 0) {
        _addRiversideDoubleLamp(batcher, 582.8, 0.45, rz, 'pcc');
      }
    }
  }

  // 1.3 Os 3 Píeres/Decks Fluviais de Madeira no Rio (Parque Central, Distrito PCC e Foz da Praia Sul)
  for (const pier of RIVER_PIER_SPECS) {
    _buildWoodenRiverPier(world, batcher, pier);
  }

  // 1.4 As 9 Pontes Monumentais Elevadas em Arco (Equação bridgeY = 5.0 * sin(t * PI) com 16 Segmentos Suaves e ZERO Colisores de Pista!)
  for (const bridgeSpec of RIVER_BRIDGE_SPECS) {
    _buildMonumentalArchedBridge(world, batcher, bridgeSpec);
  }

  // 1.5 As 5 Barricadas Táticas nas Entradas do Distrito Industrial do PCC (recuadas para X = 614 com pista central aberta!)
  const entryAvenuesZ = [-512, -382, -250, -117, 0];
  for (const ez of entryAvenuesZ) {
    world.industrialPCCData.entryBarricadesCount++;

    const gx = 614;
    const gz = ez - 15.8;
    batcher.addBox('gunmetal_concrete', 6.4, 4.2, 5.4, gx, 2.1, gz);
    batcher.addBox('matte_black', 6.8, 0.65, 5.8, gx, 4.4, gz);
    batcher.addBox('dark_steel', 5.2, 1.5, 5.5, gx, 2.5, gz);
    batcher.addBox('pcc_neon_blue', 6.9, 0.22, 5.9, gx, 4.1, gz);
    world.addCollider(gx, gz, 6.4, 5.4, 4.6, 0);

    // Pórtico elevado do Checkpoint PCC (8.8m de altura livre na pista central!)
    batcher.addBox('matte_black', 1.2, 9.2, 1.2, gx, 4.6, ez - 13.0);
    batcher.addBox('matte_black', 1.2, 9.2, 1.2, gx, 4.6, ez + 13.0);
    batcher.addBox('pcc_navy', 2.0, 1.9, 27.6, gx, 9.2, ez);
    batcher.addBox('tactical_white', 2.15, 0.65, 16.0, gx, 9.2, ez);
    batcher.addBox('pcc_neon_blue', 0.9, 0.6, 1.4, gx - 0.8, 8.2, ez - 8.5);
    batcher.addBox('pcc_neon_blue', 0.9, 0.6, 1.4, gx - 0.8, 8.2, ez + 8.5);

    // Chicane tática nas bordas externas (ez ± 10.6m), mantendo 14.4m livres no centro da avenida para carros a 290 km/h!
    for (const side of [-1, 1]) {
      const bz = ez + side * 10.6;
      batcher.addBox('matte_black', 2.2, 1.55, 5.4, 612, 0.78, bz);
      batcher.addBox('tactical_white', 2.28, 0.42, 1.8, 612, 0.95, bz - 1.3);
      batcher.addBox('tactical_white', 2.28, 0.42, 1.8, 612, 0.95, bz + 1.3);
      batcher.addBox('pcc_neon_blue', 0.45, 0.35, 0.45, 612, 1.68, bz);
      world.addCollider(612, bz, 2.2, 5.4, 1.6, 0);
    }

    _spawnPCCExplosiveBarrel(world, 610.5, ez - 8.2, 0x1d4ed8);
    _spawnPCCExplosiveBarrel(world, 610.5, ez + 8.2, 0xdc2626);
  }
}

/**
 * Poste Duplo Ornamental Ribeirinho / Ponte
 */
function _addRiversideDoubleLamp(batcher, x, yBase, z, theme = 'urban') {
  const poleMat = theme === 'beach' ? 'tactical_white' : 'matte_black';
  const accentMat = theme === 'beach' ? 'coastal_turquoise' : theme === 'pcc' ? 'pcc_neon_blue' : 'stolen_gold';
  const glowMat = theme === 'pcc' ? 'pcc_neon_blue' : 'floodlight_glow';

  batcher.addCylinder(poleMat, 0.22, 0.34, 6.2, x, yBase + 3.1, z, 6);
  batcher.addBox(accentMat, 0.6, 0.45, 0.6, x, yBase + 0.35, z);
  batcher.addBox(poleMat, 2.4, 0.2, 0.24, x, yBase + 6.1, z);
  batcher.addBox(glowMat, 0.65, 0.28, 0.45, x - 1.0, yBase + 5.95, z);
  batcher.addBox(glowMat, 0.65, 0.28, 0.45, x + 1.0, yBase + 5.95, z);
}

/**
 * Constrói um Píer Fluvial de Madeira com Rampa de Acesso Suave da Margem (Y = 0) até o Deck na Água (Y = -2.9)
 */
function _buildWoodenRiverPier(world, batcher, pier) {
  const isWest = pier.bank === 'west';
  const deckW = pier.deckXMax - pier.deckXMin;
  const deckCX = (pier.deckXMin + pier.deckXMax) * 0.5;
  const deckY = pier.deckY; // -2.9 (60cm acima da água Y = -3.5)

  // Plataforma flutuante de madeira com tábuas e borda branca/dourada
  batcher.addBox('pallet_wood', deckW, 0.38, pier.lengthZ, deckCX, deckY - 0.19, pier.z);
  batcher.addBox('tactical_white', 0.28, 0.44, pier.lengthZ, isWest ? pier.deckXMax : pier.deckXMin, deckY - 0.14, pier.z);

  // Estacas cilíndricas de madeira/aço cravadas na água e cabeços de amarração para os Jet-Skis e Lanchas
  for (let pz = pier.z - pier.lengthZ * 0.42; pz <= pier.z + pier.lengthZ * 0.42; pz += 7.5) {
    batcher.addCylinder('pallet_wood', 0.34, 0.34, 2.6, pier.deckXMin + 0.6, deckY - 0.4, pz, 6);
    batcher.addCylinder('pallet_wood', 0.34, 0.34, 2.6, pier.deckXMax - 0.6, deckY - 0.4, pz, 6);
    // Cabeços de amarração dourados/pretos na borda da água
    const bollardX = isWest ? pier.deckXMax - 0.45 : pier.deckXMin + 0.45;
    batcher.addCylinder('matte_black', 0.26, 0.22, 0.55, bollardX, deckY + 0.26, pz, 6);
    batcher.addCylinder('stolen_gold', 0.3, 0.3, 0.14, bollardX, deckY + 0.58, pz, 6);
  }

  // Rampa de Madeira inclinada conectando a rua/calçada (Y = 0.2) ao Deck Fluvial (Y = -2.9) em 8 segmentos suaves
  const rampSegs = 8;
  const rampSpanX = pier.rampXMax - pier.rampXMin;
  const rampW = 10.0;
  for (let s = 0; s < rampSegs; s++) {
    const t0 = s / rampSegs;
    const t1 = (s + 1) / rampSegs;
    const x0 = pier.rampXMin + t0 * rampSpanX;
    const x1 = pier.rampXMin + t1 * rampSpanX;
    const y0 = isWest ? (0.2 * (1 - t0) + deckY * t0) : (deckY * (1 - t0) + 0.2 * t0);
    const y1 = isWest ? (0.2 * (1 - t1) + deckY * t1) : (deckY * (1 - t1) + 0.2 * t1);
    const cx = (x0 + x1) * 0.5;
    const cy = (y0 + y1) * 0.5;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLen = Math.hypot(dx, dy) + 0.12;
    const rotZ = Math.atan2(dy, dx);

    batcher.addBox('pallet_wood', segLen, 0.28, rampW, cx, cy - 0.12, pier.z, 0, 0, rotZ);
    batcher.addBox('tactical_white', segLen, 0.55, 0.28, cx, cy + 0.25, pier.z - rampW * 0.48, 0, 0, rotZ);
    batcher.addBox('tactical_white', segLen, 0.55, 0.28, cx, cy + 0.25, pier.z + rampW * 0.48, 0, 0, rotZ);
  }

  // Iluminação náutica no píer
  const theme = pier.id === 'south_beach_mouth_pier' ? 'beach' : pier.id === 'pcc_industrial_pier' ? 'pcc' : 'urban';
  _addRiversideDoubleLamp(batcher, deckCX, deckY, pier.z - pier.lengthZ * 0.38, theme);
  _addRiversideDoubleLamp(batcher, deckCX, deckY, pier.z + pier.lengthZ * 0.38, theme);

  world.mapBlocks.push({
    x: deckCX,
    z: pier.z,
    w: deckW + 6,
    d: pier.lengthZ,
    color: '#b45309',
    label: pier.label
  });
}

/**
 * Constrói uma Ponte Monumental Elevada em Arco sobre o Rio Urbano:
 * - Curva senoidal suave em 16 segmentos: bridgeY = archHeight * Math.sin(t * Math.PI)
 * - ZERO colisores na pista (a física usa world.getRoadElevation(x, z), permitindo passar a 290+ km/h sem bater!)
 * - 8.5m de vão livre vertical sob o centro do arco (água Y = -3.5 até topo do arco Y = +5.0) e 36m de largura livre para lanchas!
 * - Arcos Superiores de Treliça de Aço, 4 Pilares Monumentais nas Cabeceiras, Calçadas, Muretas com Studs LEGO e Postes Duplos!
 */
function _buildMonumentalArchedBridge(world, batcher, spec) {
  const { z: bz, width, xStart, xEnd, archHeight, style } = spec;
  const spanL = xEnd - xStart; // 68m
  const halfW = width * 0.5;
  const roadW = width - 5.2;
  const sidewalkW = 2.2;
  const segCount = 16;

  const isBeach = style === 'beach';
  const isPort = style === 'port_gate';
  const trussMainMat = isBeach ? 'tactical_white' : isPort ? 'armor_slate' : 'matte_black';
  const trussAccentMat = isBeach ? 'coastal_turquoise' : isPort ? 'forklift_yellow' : 'stolen_gold';
  const pillarMat = isBeach ? 'tactical_white' : 'gunmetal_concrete';
  const glowMat = isBeach ? 'coastal_turquoise' : isPort ? 'floodlight_glow' : 'pcc_neon_blue';

  // 1. Tabuleiro em Arco Contínuo de 16 Segmentos Inclinados (Asfalto + Faixa Dupla Amarela + Calçadas + Muretas com Studs)
  for (let i = 0; i < segCount; i++) {
    const t0 = i / segCount;
    const t1 = (i + 1) / segCount;
    const x0 = xStart + t0 * spanL;
    const x1 = xStart + t1 * spanL;
    const y0 = archHeight * Math.sin(t0 * Math.PI);
    const y1 = archHeight * Math.sin(t1 * Math.PI);

    const cx = (x0 + x1) * 0.5;
    const cy = (y0 + y1) * 0.5;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const segLen = Math.hypot(dx, dy) + 0.22;
    const rotZ = Math.atan2(dy, dx);

    // Base estrutural de concreto/aço sob o tabuleiro + Pista Asfaltada Preta no topo (superfície exata em cy)
    batcher.addBox('gunmetal_concrete', segLen, 0.56, width, cx, cy - 0.34, bz, 0, 0, rotZ);
    batcher.addBox('matte_black', segLen, 0.14, roadW, cx, cy - 0.04, bz, 0, 0, rotZ);

    // Faixa Dupla Amarela Central + Linhas Brancas de Acostamento acompanhando a inclinação exata do arco!
    batcher.addBox('forklift_yellow', segLen - 0.05, 0.05, 0.42, cx, cy + 0.03, bz - 0.55, 0, 0, rotZ);
    batcher.addBox('forklift_yellow', segLen - 0.05, 0.05, 0.42, cx, cy + 0.03, bz + 0.55, 0, 0, rotZ);
    batcher.addBox('tactical_white', segLen - 0.05, 0.04, 0.3, cx, cy + 0.03, bz - roadW * 0.46, 0, 0, rotZ);
    batcher.addBox('tactical_white', segLen - 0.05, 0.04, 0.3, cx, cy + 0.03, bz + roadW * 0.46, 0, 0, rotZ);

    // Calçadas de Pedestres nos dois lados + Muretas de Proteção Lateral de Pedra/Ferro com Studs LEGO
    for (const side of [-1, 1]) {
      const swZ = bz + side * (halfW - sidewalkW * 0.5 - 0.35);
      const railZ = bz + side * (halfW - 0.32);
      batcher.addBox('brushed_silver', segLen, 0.24, sidewalkW, cx, cy + 0.1, swZ, 0, 0, rotZ);
      batcher.addBox(pillarMat, segLen, 0.68, 0.58, cx, cy + 0.34, railZ, 0, 0, rotZ);
      batcher.addBox(trussAccentMat, segLen, 0.18, 0.66, cx, cy + 0.76, railZ, 0, 0, rotZ);

      // Pinos clássicos de LEGO (Studs) no topo das muretas laterais da ponte
      if (i % 2 === 0) {
        batcher.addCylinder(trussAccentMat, 0.28, 0.28, 0.2, cx, cy + 0.92, railZ, 6);
      }
    }
  }

  // 2. Os 4 Pilares Monumentais nas Cabeceiras da Ponte (fora da largura da pista para NUNCA bloquear veículos!)
  for (const px of [xStart + 3.5, xEnd - 3.5]) {
    for (const side of [-1, 1]) {
      const pz = bz + side * (halfW + 1.35);
      // Base de pedra que desce até a margem/água + Coluna monumental de 13.5m
      batcher.addBox(pillarMat, 3.8, 16.5, 3.2, px, 4.75, pz);
      batcher.addBox(trussMainMat, 4.2, 1.2, 3.6, px, 13.2, pz);
      batcher.addBox(trussAccentMat, 3.4, 0.7, 2.8, px, 14.1, pz);
      batcher.addBox(glowMat, 1.8, 1.1, 1.8, px, 14.9, pz);
      batcher.addCylinder(trussAccentMat, 0.55, 0.55, 0.35, px, 15.6, pz, 8);
    }
  }

  // 3. Grandes Arcos Superiores de Treliça de Aço nas Duas Laterais (X = 530..590, subindo até Y = 15.2m no centro!)
  const archXStart = xStart + 3.5;
  const archXEnd = xEnd - 3.5;
  const archSpan = archXEnd - archXStart; // 61m
  const archSegs = 12;

  for (const side of [-1, 1]) {
    const tz = bz + side * (halfW + 0.55);

    for (let a = 0; a < archSegs; a++) {
      const t0 = a / archSegs;
      const t1 = (a + 1) / archSegs;
      const x0 = archXStart + t0 * archSpan;
      const x1 = archXStart + t1 * archSpan;

      // Corda superior parabólica do arco de aço (de Y = 5.5m nos pilares até Y = 15.2m no ápice central)
      const yTop0 = 5.5 + 9.7 * Math.sin(t0 * Math.PI);
      const yTop1 = 5.5 + 9.7 * Math.sin(t1 * Math.PI);
      const cx = (x0 + x1) * 0.5;
      const cyTop = (yTop0 + yTop1) * 0.5;
      const dx = x1 - x0;
      const dy = yTop1 - yTop0;
      const chordLen = Math.hypot(dx, dy) + 0.35;
      const chordRotZ = Math.atan2(dy, dx);

      batcher.addBox(trussMainMat, chordLen, 0.95, 0.95, cx, cyTop, tz, 0, 0, chordRotZ);
      batcher.addBox(trussAccentMat, chordLen, 0.24, 1.08, cx, cyTop + 0.52, tz, 0, 0, chordRotZ);

      // Montante vertical de suspensão (Hanger Cable/Strut) ligando o arco superior ao tabuleiro da ponte
      const tMid = (t0 + t1) * 0.5;
      const xMid = (x0 + x1) * 0.5;
      const deckYMid = archHeight * Math.sin(((xMid - xStart) / spanL) * Math.PI);
      const hangerH = Math.max(1.2, cyTop - deckYMid);
      batcher.addBox('brushed_silver', 0.38, hangerH, 0.38, xMid, deckYMid + hangerH * 0.5, tz);

      // Diagonal de treliça Warren (em X) para visual de ponte metálica monumental
      const deckY0 = archHeight * Math.sin(((x0 - xStart) / spanL) * Math.PI);
      const diagDy = yTop1 - deckY0;
      const diagLen = Math.hypot(dx, diagDy);
      const diagRotZ = Math.atan2(diagDy, dx);
      batcher.addBox(trussMainMat, diagLen, 0.32, 0.32, cx, (deckY0 + yTop1) * 0.5, tz, 0, 0, diagRotZ);
    }

    // Postes de Iluminação Duplos ao longo do tabuleiro da ponte
    for (const lampT of [0.22, 0.5, 0.78]) {
      const lx = xStart + lampT * spanL;
      const ly = archHeight * Math.sin(lampT * Math.PI);
      _addRiversideDoubleLamp(
        batcher,
        lx,
        ly + 0.25,
        bz + side * (halfW - 0.45),
        isBeach ? 'beach' : isPort ? 'urban' : 'pcc'
      );
    }
  }

  // 4. Três Travessas Superiores de Contraventamento unindo os dois arcos lá no alto (Y = 12.6m a 15.2m — >9.5m livres sobre a pista!)
  for (const crossT of [0.28, 0.5, 0.72]) {
    const crossX = archXStart + crossT * archSpan;
    const crossY = 5.5 + 9.7 * Math.sin(crossT * Math.PI);
    batcher.addBox(trussMainMat, 1.4, 1.1, width + 1.8, crossX, crossY, bz);
    batcher.addBox(trussAccentMat, 1.55, 0.32, width + 1.4, crossX, crossY + 0.62, bz);
    batcher.addBox(glowMat, 1.65, 0.28, 12.0, crossX, crossY - 0.45, bz);
  }

  world.mapRoads.push({ x: (xStart + xEnd) * 0.5, z: bz, w: spanL, d: width, isMain: true });
}

function _spawnPCCExplosiveBarrel(world, x, z, colorHex = 0x1d4ed8) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.68, 1.85, 8),
    getLegoMaterial(colorHex, { roughness: 0.28 })
  );
  body.position.y = 0.92;
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.36, 8),
    getLegoMaterial(LEGO_COLORS.white, { roughness: 0.3 })
  );
  stripe.position.y = 0.95;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.16, 8),
    getLegoMaterial(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 0.8 })
  );
  cap.position.y = 1.9;
  const c4GroundY =
    0.28 +
    (world.getTerrainHeightAt && x > 622 && x < 1430 && z > -720 && z < -40
      ? Math.max(0, world.getTerrainHeightAt(x, z))
      : 0);
  group.add(body, stripe, cap);
  group.position.set(x, c4GroundY, z);
  world.scene.add(group);

  const col = world.addCollider(x, z, 1.4, 1.4, 2.1, 0.28);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: group,
      type: 'explosive_barrel',
      hp: 35,
      radius: 1.5,
      height: 1.9,
      colliders: [col],
      debrisColors: [colorHex, LEGO_COLORS.white, LEGO_COLORS.black, 0x38bdf8],
      studDrops: { silver: 3, gold: 3, blue: 1, purple: 0 },
      groundY: c4GroundY
    });
  }
}

/**
 * Helper: Constrói Muro Alto Fortificado do PCC com vigas de aço pretas, cercas superiores,
 * Guaritas Elevadas Blindadas nos 4 cantos da muralha, câmeras de vigilância e portões blindados.
 */
function buildFortifiedCompoundWalls(world, batcher, cx, cz, w, d, opts = {}) {
  const wallH = opts.wallH ?? 5.2;
  const halfW = w * 0.5 - 1.2;
  const halfD = d * 0.5 - 1.2;
  const gateSouth = opts.gateSouth !== false;
  const gateWest = opts.gateWest ?? false;
  const gateWidth = opts.gateWidth ?? 26;

  // Muro Norte (-Z) e Muro Leste (+X)
  batcher.addBox('gunmetal_concrete', w - 2.4, wallH, 1.6, cx, 0.28 + wallH * 0.5, cz - halfD);
  batcher.addBox('brushed_silver', w - 2.4, 1.1, 0.25, cx, 0.28 + wallH + 0.55, cz - halfD);
  world.addCollider(cx, cz - halfD, w - 2.4, 1.6, 0.28 + wallH + 1.1, 0.28);

  batcher.addBox('gunmetal_concrete', 1.6, wallH, d - 2.4, cx + halfW, 0.28 + wallH * 0.5, cz);
  batcher.addBox('brushed_silver', 0.25, 1.1, d - 2.4, cx + halfW, 0.28 + wallH + 0.55, cz);
  world.addCollider(cx + halfW, cz, 1.6, d - 2.4, 0.28 + wallH + 1.1, 0.28);

  // Muro Sul (+Z) com Portão Blindado e Guarita
  if (gateSouth) {
    const segW = Math.max(8, (w - 2.4 - gateWidth) * 0.5);
    const leftX = cx - gateWidth * 0.5 - segW * 0.5;
    const rightX = cx + gateWidth * 0.5 + segW * 0.5;
    for (const sx of [leftX, rightX]) {
      batcher.addBox('gunmetal_concrete', segW, wallH, 1.6, sx, 0.28 + wallH * 0.5, cz + halfD);
      batcher.addBox('brushed_silver', segW, 1.1, 0.25, sx, 0.28 + wallH + 0.55, cz + halfD);
      world.addCollider(sx, cz + halfD, segW, 1.6, 0.28 + wallH + 1.1, 0.28);
    }
    for (const px of [cx - gateWidth * 0.5, cx + gateWidth * 0.5]) {
      batcher.addBox('matte_black', 2.8, wallH + 3.6, 2.8, px, 0.28 + (wallH + 3.6) * 0.5, cz + halfD);
      batcher.addBox('pcc_neon_blue', 1.3, 0.65, 1.3, px, 0.28 + wallH + 3.8, cz + halfD);
    }
    batcher.addBox('pcc_navy', gateWidth + 2.8, 1.8, 2.4, cx, 0.28 + wallH + 2.8, cz + halfD);
    batcher.addBox('tactical_white', gateWidth * 0.55, 0.55, 2.5, cx, 0.28 + wallH + 2.8, cz + halfD);
  } else {
    batcher.addBox('gunmetal_concrete', w - 2.4, wallH, 1.6, cx, 0.28 + wallH * 0.5, cz + halfD);
    batcher.addBox('brushed_silver', w - 2.4, 1.1, 0.25, cx, 0.28 + wallH + 0.55, cz + halfD);
    world.addCollider(cx, cz + halfD, w - 2.4, 1.6, 0.28 + wallH + 1.1, 0.28);
  }

  // Muro Oeste (-X)
  if (gateWest) {
    const segD = Math.max(8, (d - 2.4 - gateWidth) * 0.5);
    const topZ = cz - gateWidth * 0.5 - segD * 0.5;
    const botZ = cz + gateWidth * 0.5 + segD * 0.5;
    for (const sz of [topZ, botZ]) {
      batcher.addBox('gunmetal_concrete', 1.6, wallH, segD, cx - halfW, 0.28 + wallH * 0.5, sz);
      batcher.addBox('brushed_silver', 0.25, 1.1, segD, cx - halfW, 0.28 + wallH + 0.55, sz);
      world.addCollider(cx - halfW, sz, 1.6, segD, 0.28 + wallH + 1.1, 0.28);
    }
    for (const pz of [cz - gateWidth * 0.5, cz + gateWidth * 0.5]) {
      batcher.addBox('matte_black', 2.8, wallH + 3.6, 2.8, cx - halfW, 0.28 + (wallH + 3.6) * 0.5, pz);
      batcher.addBox('pcc_neon_blue', 1.3, 0.65, 1.3, cx - halfW, 0.28 + wallH + 3.8, pz);
    }
  } else {
    batcher.addBox('gunmetal_concrete', 1.6, wallH, d - 2.4, cx - halfW, 0.28 + wallH * 0.5, cz);
    batcher.addBox('brushed_silver', 0.25, 1.1, d - 2.4, cx - halfW, 0.28 + wallH + 0.55, cz);
    world.addCollider(cx - halfW, cz, 1.6, d - 2.4, 0.28 + wallH + 1.1, 0.28);
  }

  // Vigas verticais de aço preto ao longo dos muros
  for (let bx = cx - halfW; bx <= cx + halfW; bx += 22) {
    batcher.addBox('matte_black', 1.0, wallH + 0.5, 2.2, bx, 0.28 + wallH * 0.5, cz - halfD);
    if (!gateSouth || Math.abs(bx - cx) > gateWidth * 0.5 + 1) {
      batcher.addBox('matte_black', 1.0, wallH + 0.5, 2.2, bx, 0.28 + wallH * 0.5, cz + halfD);
    }
  }

  // Guaritas Blindadas Elevadas nos 4 Cantos da Muralha + Holofotes Azuis e Câmeras de Vigilância
  for (const [kx, kz] of [
    [cx - halfW + 1.5, cz - halfD + 1.5],
    [cx + halfW - 1.5, cz - halfD + 1.5],
    [cx - halfW + 1.5, cz + halfD - 1.5],
    [cx + halfW - 1.5, cz + halfD - 1.5]
  ]) {
    batcher.addBox('matte_black', 4.6, wallH + 4.8, 4.6, kx, 0.28 + (wallH + 4.8) * 0.5, kz);
    batcher.addBox('dark_steel', 5.0, 1.6, 5.0, kx, 0.28 + wallH + 3.4, kz);
    batcher.addBox('pcc_navy', 5.4, 0.85, 5.4, kx, 0.28 + wallH + 4.8, kz);
    batcher.addBox('pcc_neon_blue', 1.8, 0.5, 1.8, kx, 0.28 + wallH + 5.4, kz);
    batcher.addBox('c4_hazard_red', 0.35, 0.35, 0.35, kx, 0.28 + wallH + 4.2, kz + (kz > cz ? 2.6 : -2.6));
  }
}

/**
 * 2. A CIDADELA / TORRE DO BUNKER CENTRAL DO PCC (112m DE ALTURA! QG DO "MESTRE DO COFRE")
 * - Mantém a Base Blindada Casamata de 30m (com porta-cofre gigante, frisos ciano e Rampa Subterrânea de Fuga);
 * - Faz subir do centro da base a Torre-Fortaleza Blindada Monumental até Y = 112m (dentro da faixa 85..120m!);
 * - Contrafortes blindados nas 4 quinas da torre, andares fortificados, 4 Passarelas Aéreas Blindadas (Skybridges)
 *   ligando a Torre Central aos prédios vizinhos, Radar Giratório e o Heliponto Principal do Chefe (`H`) no topo!
 */
function buildPCCCentralCitadelAndBunker(world, batcher) {
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
  // Estágio 1 da Torre (Y = 30.28m até Y = 64.28m, 68m x 64m)
  const t1H = 34.0;
  batcher.addBox('matte_black', 68, t1H, 64, bX, baseRoofY + t1H * 0.5, bZ);
  batcher.addBox('dark_steel', 70, t1H - 4, 52, bX, baseRoofY + t1H * 0.5, bZ);
  batcher.addBox('dark_steel', 56, t1H - 4, 66, bX, baseRoofY + t1H * 0.5, bZ);
  world.addCollider(bX, bZ, 68, 64, baseRoofY + t1H, baseRoofY);

  // Estágio 2 da Torre (Y = 64.28m até Y = 92.28m, 54m x 52m)
  const t2BaseY = baseRoofY + t1H;
  const t2H = 28.0;
  batcher.addBox('gunmetal_concrete', 54, t2H, 52, bX, t2BaseY + t2H * 0.5, bZ);
  batcher.addBox('dark_steel', 56, t2H - 4, 40, bX, t2BaseY + t2H * 0.5, bZ);
  batcher.addBox('dark_steel', 42, t2H - 4, 54, bX, t2BaseY + t2H * 0.5, bZ);
  world.addCollider(bX, bZ, 54, 52, t2BaseY + t2H, t2BaseY);

  // Estágio 3 — Cúpula/Cidadela de Comando do "Mestre do Cofre" (Y = 92.28m até Y = 112.28m, 44m x 44m)
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
      // Contraforte Nível 1 (Y = 30..64m)
      batcher.addBox('armor_slate', 10, t1H + 2, 10, bX + sx * 33, baseRoofY + t1H * 0.5, bZ + sz * 31);
      batcher.addBox('pcc_navy', 11, 3.2, 11, bX + sx * 33, baseRoofY + t1H, bZ + sz * 31);
      // Contraforte Nível 2 (Y = 64..92m)
      batcher.addBox('armor_slate', 8.5, t2H + 2, 8.5, bX + sx * 26, t2BaseY + t2H * 0.5, bZ + sz * 25);
      batcher.addBox('pcc_navy', 9.5, 2.8, 9.5, bX + sx * 26, t2BaseY + t2H, bZ + sz * 25);
      // Contraforte Nível 3 (Y = 92..114m)
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
  // Skybridge 1 (Oeste, Y = 36m): Liga a Cidadela (X = 832) à Torre do Complexo Logístico Oeste (X = 684, Z = -446)
  _buildArmoredSkybridge(world, batcher, 760, 36.0, -446, 148, 8.5, 'x');
  // Skybridge 2 (Leste, Y = 44m): Liga a Cidadela (X = 900) à Torre Corporativa de Lavagem Leste (X = 1062, Z = -446)
  _buildArmoredSkybridge(world, batcher, 976, 44.0, -446, 152, 8.5, 'x');
  // Skybridge 3 (Norte, Y = 38m): Liga a Cidadela (Z = -486) à Torre de Planejamento Norte (X = 866, Z = -578)
  _buildArmoredSkybridge(world, batcher, 866, 38.0, -522, 8.5, 92, 'z');
  // Skybridge 4 (Sul-Oeste, Y = 26m): Liga o Bunker Central à Garagem Blindada do Bonde do PCC (X = 760, Z = -348)
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

  // Pilhas de Contêineres Pretos/Azuis do PCC, Paletes de Ouro e Caminhões Blindados preenchendo o leste do pátio
  _addPCCContainerStack(world, batcher, 932, -338, 3, true);
  _addPCCContainerStack(world, batcher, 932, -298, 2, true);
  _addStolenGoldPallet(world, batcher, 838, -352, true);
  _addStolenGoldPallet(world, batcher, 846, -352, false);
  _addSilverBriefcaseStack(world, batcher, 854, -352);
  _addC4ExplosiveCrateStack(world, batcher, 830, -352);
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
  // Treliças verticais blindadas ao longo da ponte aérea
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
 * Possui 2 Grandes Garagens/Edifícios Blindados em L, Passarela de Ferro, Pilhas de Contêineres e a Frota do Bonde
 */
function buildPCCFleetConvoyYard(world, batcher) {
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

  // Pilhas de Contêineres do PCC, Paletes de Ouro e Caixas de C4 preenchendo os cantos do pátio
  _addPCCContainerStack(world, batcher, cx - 54, cz + 28, 3, false);
  _addStolenGoldPallet(world, batcher, cx + 32, cz - 14, false);
  _addC4ExplosiveCrateStack(world, batcher, cx + 32, cz + 14);
}

/**
 * 4. PÁTIO DO DESMANCHE & FERRO-VELHO DO SINDICATO (X = 976..1148, Z = -368..-131 — 100% PREENCHIDO!)
 * - 3 Grandes Galpões de Blindagem & Desmanche em formato de U (H = 32m..44m);
 * - Guindaste Eletromagnético Gigante (48m), Prensa Hidráulica Colossal e Chaminé de Fundição de 72m;
 * - Carros-Fortes roubados, Viaturas capturadas, Pilhas de Carros Amassados e Contêineres do PCC!
 */
function buildPCCChopShopAndScrapyard(world, batcher) {
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

  // Chaminé Altíssima de Fundição de Aço do Desmanche (H = 74m!) soltando fumaça
  _addTallIndustrialSmokestack(world, batcher, 1126, -342, 74);

  // Bateria de 3 Silos de Aço Químico no Canto Nordeste do Desmanche (H = 48m!)
  _addGiantSiloBattery(world, batcher, 1122, -158, 3, 48);

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

  _addPCCContainerStack(world, batcher, 994, -192, 3, false);
  _addStolenGoldPallet(world, batcher, 996, -310, true);
  _addStolenGoldPallet(world, batcher, 1004, -310, false);
  _addPCCArmoredBoxTruck(world, batcher, 1072, -296);
}

/**
 * 5. EXPANSÃO E ADENSAMENTO COMPLETO DOS QUARTEIRÕES DO PCC (ZERO ESPAÇO CINZA VAZIO!)
 * Preenche TODAS as colunas (X = 612 até X = 1625) e TODAS as linhas (Z = -1108 até encostar no Porto em Z = +110),
 * além da faixa logística oeste do Porto (X = 612..748, Z = 180..640)!
 */
function buildAllExpandedPCCIndustrialAndCorporateBlocks(world, batcher) {
  // Grade Completa de Quarteirões do Império do PCC (cobrindo 100% do Leste e Nordeste até a borda Norte da ilha Z = -1320!)
  const pccGridBlocks = [
    // BORDA EXTREMA NORTE / NORDESTE (Z = -1248, encostando 100% na beira Norte da ilha em Z = -1318!)
    { cx: 684,  cz: -1248, w: 144, d: 140, type: 'corporate_tower', h: 72, label: 'TORRE COSTEIRA NORTE PCC' },
    { cx: 866,  cz: -1248, w: 172, d: 140, type: 'heavy_silos',     h: 64, label: 'REFINARIA MARÍTIMA NORTE' },
    { cx: 1062, cz: -1248, w: 172, d: 140, type: 'c4_factory',      h: 50, label: 'COMPLEXO DE ARMAMENTOS NORTE' },
    { cx: 1252, cz: -1248, w: 160, d: 140, type: 'corporate_tower', h: 76, label: 'SEDE FINANCEIRA EXTREMO NORTE' },
    { cx: 1434, cz: -1248, w: 160, d: 140, type: 'heavy_silos',     h: 62, label: 'BATERIA DE SILOS DO ATLÂNTICO' },
    { cx: 1580, cz: -1248, w: 96,  d: 140, type: 'coastal_fort',    h: 58, label: 'FORTALEZA COSTEIRA NORDESTE' },

    // SETOR NORDESTE EXTREMO (Z = -1108 e Z = -976, ao lado leste do Rio Urbano até o mar X = 1620)
    { cx: 684,  cz: -1108, w: 144, d: 112, type: 'heavy_silos',     h: 56, label: 'REFINARIA NORTE PCC' },
    { cx: 866,  cz: -1108, w: 172, d: 112, type: 'corporate_tower', h: 68, label: 'TORRE FINANCEIRA PCC NORTE' },
    { cx: 1062, cz: -1108, w: 172, d: 112, type: 'c4_factory',      h: 46, label: 'USINA DE SÍNTESE C4' },
    { cx: 1252, cz: -1108, w: 160, d: 112, type: 'heavy_silos',     h: 62, label: 'TERMINAL DE SILOS BLINDADOS' },
    { cx: 1434, cz: -1108, w: 160, d: 112, type: 'c4_factory',      h: 48, label: 'TERMOELÉTRICA DO SINDICATO' },
    { cx: 1580, cz: -1108, w: 96,  d: 112, type: 'coastal_fort',    h: 54, label: 'BASTIÃO COSTEIRO NORTE' },

    { cx: 684,  cz: -976,  w: 144, d: 112, type: 'corporate_tower', h: 58, label: 'EDIFÍCIO BLINDADO 1533' },
    { cx: 866,  cz: -976,  w: 172, d: 112, type: 'c4_factory',      h: 48, label: 'COMPLEXO QUÍMICO PCC' },
    { cx: 1062, cz: -976,  w: 172, d: 112, type: 'corporate_tower', h: 74, label: 'TORRE DE LAVAGEM SINDICATO' },
    { cx: 1252, cz: -976,  w: 160, d: 112, type: 'c4_factory',      h: 46, label: 'FÁBRICA DE DETONADORES' },
    { cx: 1434, cz: -976,  w: 160, d: 112, type: 'heavy_silos',     h: 58, label: 'BATERIA DE SILOS LESTE' },
    { cx: 1580, cz: -976,  w: 96,  d: 112, type: 'coastal_fort',    h: 52, label: 'TORRE DE RADAR COSTEIRA' },

    // LINHA NORTE-CENTRAL (Z = -842)
    { cx: 684,  cz: -842,  w: 144, d: 108, type: 'c4_factory',      h: 44, label: 'DEPÓSITO BLINDADO OESTE' },
    { cx: 866,  cz: -842,  w: 172, d: 108, type: 'heavy_silos',     h: 60, label: 'PETROQUÍMICA DO PCC' },
    { cx: 1062, cz: -842,  w: 172, d: 108, type: 'c4_factory',      h: 48, label: 'FUNDIÇÃO DE BLINDADOS' },
    { cx: 1252, cz: -842,  w: 160, d: 108, type: 'corporate_tower', h: 72, label: 'HOLDING INTERNACIONAL PCC' },
    { cx: 1434, cz: -842,  w: 160, d: 108, type: 'c4_factory',      h: 46, label: 'GALPÃO DE MUNIÇÕES PESADAS' },
    { cx: 1580, cz: -842,  w: 96,  d: 108, type: 'coastal_fort',    h: 56, label: 'FORTE MARÍTIMO PCC' },

    // LINHA INDUSTRIAL ALTA (Z = -710)
    { cx: 684,  cz: -710,  w: 144, d: 108, type: 'corporate_tower', h: 64, label: 'CENTRO DE DADOS & HACKING' },
    { cx: 866,  cz: -710,  w: 172, d: 108, type: 'c4_factory',      h: 48, label: 'FÁBRICA CENTRAL DE C4' },
    { cx: 1062, cz: -710,  w: 172, d: 108, type: 'heavy_silos',     h: 58, label: 'REFINARIA DE EXPLOSIVOS' },
    { cx: 1252, cz: -710,  w: 160, d: 108, type: 'c4_factory',      h: 46, label: 'LOGÍSTICA DE CARROS-FORTES' },
    { cx: 1434, cz: -710,  w: 160, d: 108, type: 'corporate_tower', h: 68, label: 'BANCO CLANDESTINO PCC' },
    { cx: 1580, cz: -710,  w: 96,  d: 108, type: 'coastal_fort',    h: 52, label: 'DOCAS DE CONTRABANDO' },

    // LINHA DO ANEL DE COMANDO (Z = -578)
    { cx: 684,  cz: -578,  w: 144, d: 108, type: 'heavy_silos',     h: 54, label: 'RESERVATÓRIO QUÍMICO' },
    { cx: 866,  cz: -578,  w: 172, d: 108, type: 'corporate_tower', h: 78, label: 'TORRE DE PLANEJAMENTO (PCC)' },
    { cx: 1062, cz: -578,  w: 172, d: 108, type: 'c4_factory',      h: 48, label: 'ARSENAL DE ASSALTO PESADO' },
    { cx: 1252, cz: -578,  w: 160, d: 108, type: 'heavy_silos',     h: 60, label: 'USINA DE FORÇA BLINDADA' },
    { cx: 1434, cz: -578,  w: 160, d: 108, type: 'c4_factory',      h: 46, label: 'CENTRAL DE CONTÊINERES PCC' },
    { cx: 1580, cz: -578,  w: 96,  d: 108, type: 'coastal_fort',    h: 58, label: 'BATERIA ANTIAÉREA LESTE' },

    // LINHA CENTRAL (Z = -446 e Z = -316 — ao redor da Cidadela Central X=866 e do Desmanche X=1062)
    { cx: 684,  cz: -446,  w: 144, d: 108, type: 'corporate_tower', h: 74, label: 'TORRE OESTE DE LAVAGEM' },
    { cx: 1062, cz: -446,  w: 172, d: 108, type: 'corporate_tower', h: 80, label: 'TORRE LESTE DO COFRE (PCC)' },
    { cx: 1252, cz: -446,  w: 160, d: 108, type: 'c4_factory',      h: 48, label: 'COMPLEXO METALÚRGICO PCC' },
    { cx: 1434, cz: -446,  w: 160, d: 108, type: 'heavy_silos',     h: 62, label: 'SILOS GIGANTES DO SINDICATO' },
    { cx: 1580, cz: -446,  w: 96,  d: 108, type: 'coastal_fort',    h: 54, label: 'HELIPONTO COSTEIRO PCC' },

    { cx: 1252, cz: -316,  w: 160, d: 108, type: 'corporate_tower', h: 70, label: 'TORRE DE COMUNICAÇÕES PCC' },
    { cx: 1434, cz: -316,  w: 160, d: 108, type: 'c4_factory',      h: 48, label: 'MONTADORA DE BLINDADOS' },
    { cx: 1580, cz: -316,  w: 96,  d: 108, type: 'coastal_fort',    h: 52, label: 'GUARITA MARÍTIMA CENTRAL' },

    // LINHA SUL-CENTRAL (Z = -184 — Coluna 3 já é ocupada pelo Sul do Desmanche X=1062)
    { cx: 684,  cz: -184,  w: 144, d: 108, type: 'c4_factory',      h: 46, label: 'DOCAS DE OURO ROUBADO' },
    { cx: 866,  cz: -184,  w: 172, d: 108, type: 'heavy_silos',     h: 58, label: 'COMPLEXO DE SILOS & VAPOR' },
    { cx: 1252, cz: -184,  w: 160, d: 108, type: 'c4_factory',      h: 48, label: 'DEPÓSITO DE CARROS-FORTES' },
    { cx: 1434, cz: -184,  w: 160, d: 108, type: 'corporate_tower', h: 66, label: 'EDIFÍCIO LOGÍSTICO SUL' },
    { cx: 1580, cz: -184,  w: 96,  d: 108, type: 'coastal_fort',    h: 54, label: 'TORRE DE VIGIA LESTE' },

    // LINHA DE FRONTEIRA COM O PORTO (Z = -58 e Z = +58 — encostando 100% no Porto Metropolitano em Z = +110!)
    { cx: 684,  cz: -58,   w: 144, d: 96,  type: 'corporate_tower', h: 62, label: 'TORRE DO CANAL LESTE' },
    { cx: 866,  cz: -58,   w: 172, d: 96,  type: 'c4_factory',      h: 46, label: 'GALPÃO QUEBRA-COFRE SUL' },
    { cx: 1062, cz: -58,   w: 172, d: 96,  type: 'heavy_silos',     h: 56, label: 'TERMINAL DE COMBUSTÍVEL PCC' },
    { cx: 1252, cz: -58,   w: 160, d: 96,  type: 'corporate_tower', h: 64, label: 'SEDE ADUANEIRA DO PCC' },
    { cx: 1434, cz: -58,   w: 160, d: 96,  type: 'c4_factory',      h: 46, label: 'HANGAR DE CAMINHÕES BAÚ' },
    { cx: 1580, cz: -58,   w: 96,  d: 96,  type: 'coastal_fort',    h: 50, label: 'FORTALEZA DO CANAL' },

    { cx: 684,  cz: 58,    w: 144, d: 96,  type: 'c4_factory',      h: 44, label: 'ENTREPOSTO PORTUÁRIO PCC' },
    { cx: 866,  cz: 58,    w: 172, d: 96,  type: 'corporate_tower', h: 58, label: 'CONTROLADORIA DO PORTO (PCC)' },
    { cx: 1062, cz: 58,    w: 172, d: 96,  type: 'c4_factory',      h: 46, label: 'TERMINAL DE EXPORTAÇÃO PCC' },
    { cx: 1252, cz: 58,    w: 160, d: 96,  type: 'heavy_silos',     h: 54, label: 'SILOS PORTUÁRIOS BLINDADOS' },
    { cx: 1434, cz: 58,    w: 160, d: 96,  type: 'c4_factory',      h: 46, label: 'DOCAS BLINDADAS LESTE' },
    { cx: 1580, cz: 58,    w: 96,  d: 96,  type: 'coastal_fort',    h: 52, label: 'FAROL BLINDADO DO SINDICATO' }
  ];

  pccGridBlocks.forEach((blk, idx) => {
    world.industrialPCCData.blocksCount++;
    world._addCityBlockSidewalk(blk.cx, blk.cz, blk.w, blk.d, 0x1e293b);
    buildFortifiedCompoundWalls(world, batcher, blk.cx, blk.cz, blk.w, blk.d, {
      wallH: 5.0,
      gateSouth: true,
      gateWest: idx % 2 === 0,
      gateWidth: Math.min(28, blk.w * 0.32)
    });

    if (blk.type === 'corporate_tower') {
      _PopulatePCCCorporateTowerBlock(world, batcher, blk, idx);
    } else if (blk.type === 'heavy_silos') {
      _PopulatePCCHeavySiloAndCoolingBlock(world, batcher, blk, idx);
    } else if (blk.type === 'coastal_fort') {
      _PopulatePCCCoastalFortressBlock(world, batcher, blk, idx);
    } else {
      _PopulatePCCC4FactoryAndLogisticsBlock(world, batcher, blk, idx);
    }
  });
}

/**
 * TIPO A: QUARTEIRÃO DE PRÉDIOS CORPORATIVOS DE FACHADA / LAVAGEM DE DINHEIRO DO PCC (52m a 80m!)
 * - Constrói 1 Torre Corporativa Fortificada Alta (52-80m, 10-16 andares) + 1 Edifício Anexo Blindado (34-44m)
 *   + 1 Galpão de Cofres em formato de U, ligados por passarela aérea e dutos;
 * - Pátio 100% lotado com Contêineres Pretos/Azuis, Caminhões Baú, SUVs, Paletes de Ouro, Maletas e C4!
 */
function _PopulatePCCCorporateTowerBlock(world, batcher, blk, idx) {
  const { cx, cz, w, d, h, label } = blk;
  const towerX = cx - w * 0.22;
  const towerZ = cz - d * 0.16;
  const towerW = w * 0.42;
  const towerD = d * 0.48;

  // 1) Torre Corporativa Principal (H = 52..80m) em Vidro Preto Espelhado, Aço Preto e Frisos Azul-Neon/Ciano
  batcher.addBox('matte_black', towerW, h, towerD, towerX, 0.28 + h * 0.5, towerZ);
  batcher.addBox('dark_steel', towerW + 0.8, h - 6, towerD - 6, towerX, 0.28 + h * 0.5, towerZ);
  batcher.addBox('dark_steel', towerW - 6, h - 6, towerD + 0.8, towerX, 0.28 + h * 0.5, towerZ);
  for (let fy = 8; fy <= h - 2; fy += 6.5) {
    batcher.addBox('pcc_navy', towerW + 1.4, 1.2, towerD + 1.4, towerX, fy, towerZ);
    if (fy % 13 < 7) {
      batcher.addBox('pcc_neon_blue', towerW + 1.8, 0.38, towerD + 1.8, towerX, fy + 0.7, towerZ);
    }
  }
  // Cofre de Cobertura, Guarita e Antena de Comunicação no Teto da Torre
  batcher.addBox('gunmetal_concrete', towerW * 0.55, 5.5, towerD * 0.55, towerX, 0.28 + h + 2.75, towerZ);
  batcher.addCylinder('brushed_silver', 0.4, 0.7, 14.0, towerX, 0.28 + h + 11.0, towerZ, 8);
  batcher.addBox('pcc_neon_blue', 1.2, 1.2, 1.2, towerX, 0.28 + h + 18.2, towerZ);
  world.addCollider(towerX, towerZ, towerW, towerD, 0.28 + h + 5.5, 0.28);

  // 2) Edifício Anexo de Contabilidade & Cofres (Leste da Quadra, H = 38m)
  const annexX = cx + w * 0.24;
  const annexZ = cz - d * 0.14;
  const annexW = w * 0.36;
  const annexD = d * 0.52;
  const annexH = Math.max(34, h * 0.56);
  batcher.addBox('gunmetal_concrete', annexW, annexH, annexD, annexX, 0.28 + annexH * 0.5, annexZ);
  batcher.addBox('dark_steel', annexW + 0.6, annexH - 6, annexD - 6, annexX, 0.28 + annexH * 0.5, annexZ);
  batcher.addBox('pcc_navy', annexW + 1.2, 2.2, annexD + 1.2, annexX, 0.28 + annexH - 1.5, annexZ);
  batcher.addBox('tactical_white', annexW + 1.4, 0.5, annexD + 1.4, annexX, 0.28 + annexH - 3.2, annexZ);
  world.addCollider(annexX, annexZ, annexW, annexD, 0.28 + annexH, 0.28);

  // Passarela Aérea de Ferro e Tubulações ligando a Torre Principal ao Anexo (em Y = 22m)
  const spanW = (annexX - annexW * 0.5) - (towerX + towerW * 0.5) + 2;
  const midX = (towerX + towerW * 0.5 + (annexX - annexW * 0.5)) * 0.5;
  batcher.addBox('matte_black', spanW, 3.6, 5.2, midX, 22.0, towerZ);
  batcher.addBox('pcc_neon_blue', spanW + 0.4, 0.4, 5.6, midX, 23.9, towerZ);

  // 3) Galpão Lateral de Blindados (Sul-Oeste da Quadra, H = 22m — formando U!)
  const wingX = cx - w * 0.26;
  const wingZ = cz + d * 0.25;
  const wingW = w * 0.34;
  const wingD = d * 0.26;
  batcher.addBox('matte_black', wingW, 22.0, wingD, wingX, 0.28 + 11.0, wingZ);
  batcher.addBox('pcc_navy', wingW + 0.8, 1.8, wingD + 0.8, wingX, 0.28 + 21.0, wingZ);
  world.addCollider(wingX, wingZ, wingW, wingD, 22.5, 0.28);

  world.industrialPCCData.bunkersCount += 3;
  world.industrialPCCData.corporateTowersCount += 2;

  world.mapBuildings.push({
    x: towerX,
    z: towerZ,
    w: towerW,
    d: towerD,
    height: h,
    color: '#1d4ed8',
    label
  });
  world.mapBuildings.push({
    x: annexX,
    z: annexZ,
    w: annexW,
    d: annexD,
    height: annexH,
    color: '#0f172a',
    label: null
  });

  // Preenchimento Denso do Pátio (Contêineres de 3 andares, Caminhão Baú, SUVs Estáticas, Ouro e C4)
  _addPCCContainerStack(world, batcher, cx + w * 0.26, cz + d * 0.26, 3, false);
  _addPCCArmoredBoxTruck(world, batcher, cx + 4, cz + d * 0.24);
  _addStaticPCCSuvOrVan(world, batcher, cx - 8, cz + d * 0.26, true);
  _addStolenGoldPallet(world, batcher, midX - 3, cz + 4, false);
  _addSilverBriefcaseStack(world, batcher, midX + 3, cz + 4);
  _addC4ExplosiveCrateStack(world, batcher, annexX - 8, cz + 6);
  _addLegoForklift(world, batcher, cx - 2, cz + 12);
}

/**
 * TIPO B: COMPLEXO INDUSTRIAL DE BATERIAS DE SILOS GIGANTES (54-62m), TORRES DE RESFRIAMENTO & CHAMINÉS DE 82m!
 */
function _PopulatePCCHeavySiloAndCoolingBlock(world, batcher, blk, idx) {
  const { cx, cz, w, d, h, label } = blk;

  // 1) Megagalpão de Processamento Químico (Oeste da Quadra, H = 42m!)
  const facX = cx - w * 0.22;
  const facZ = cz - d * 0.14;
  const facW = w * 0.44;
  const facD = d * 0.54;
  const facH = 42.0;
  batcher.addBox('matte_black', facW, facH, facD, facX, 0.28 + facH * 0.5, facZ);
  batcher.addBox('pcc_navy', facW + 1.2, 3.2, facD + 1.2, facX, 0.28 + facH - 2.2, facZ);
  batcher.addBox('pcc_neon_blue', facW + 1.6, 0.5, facD + 1.6, facX, 0.28 + facH - 4.2, facZ);
  // Telhado Dente-de-Serra Gigante no topo (Y = 42m..47m)
  for (let t = -1; t <= 1; t++) {
    batcher.addBox('pcc_navy', facW - 2, 4.5, facD * 0.28, facX, 0.28 + facH + 2.0, facZ + t * (facD * 0.31), 0.3, 0, 0);
  }
  world.addCollider(facX, facZ, facW, facD, 0.28 + facH + 4.5, 0.28);

  // 2) Bateria de 4 Silos Cilíndricos Gigantes (Leste-Norte da Quadra, H = h = 54..62m!) com Passarelas no Topo
  const siloBaseX = cx + w * 0.22;
  const siloBaseZ = cz - d * 0.22;
  _addGiantSiloBattery(world, batcher, siloBaseX, siloBaseZ, 4, h);

  // 3) Torre de Resfriamento Hiperbólica/Cilíndrica Gigante (Sudeste da Quadra, H = 48m!) + Chaminé de 82m!
  const coolX = cx + w * 0.24;
  const coolZ = cz + d * 0.18;
  _addIndustrialCoolingTower(world, batcher, coolX, coolZ, 48);
  _addTallIndustrialSmokestack(world, batcher, facX - facW * 0.32, facZ - facD * 0.32, 82);

  // Tubulações Aéreas Grossas e Passarela Dupla de Ferro ligando o Megagalpão aos Silos (Y = 24m e Y = 36m)
  batcher.addBox('brushed_silver', w * 0.38, 0.8, 4.2, cx, 26.0, siloBaseZ);
  batcher.addCylinder('brushed_silver', 1.1, 1.1, w * 0.42, cx, 32.0, siloBaseZ + 5, 8, 0, Math.PI / 2);
  batcher.addCylinder('pcc_royal', 0.95, 0.95, w * 0.42, cx, 29.5, siloBaseZ + 5, 8, 0, Math.PI / 2);

  world.industrialPCCData.bunkersCount += 2;
  world.industrialPCCData.c4WarehousesCount++;

  world.mapBuildings.push({
    x: facX,
    z: facZ,
    w: facW,
    d: facD,
    height: facH,
    color: '#1e3a8a',
    label
  });

  // Preenchimento Total do Pátio Sul-Oeste: Tanques Químicos Horizontais, Contêineres de 3 Andares, Caminhão e C4
  _addHorizontalChemicalTank(world, batcher, cx - w * 0.24, cz + d * 0.26);
  _addHorizontalChemicalTank(world, batcher, cx - w * 0.04, cz + d * 0.26);
  _addPCCContainerStack(world, batcher, cx - w * 0.34, cz + d * 0.24, 3, false);
  _addPCCArmoredBoxTruck(world, batcher, cx + 6, cz + d * 0.24);
  _addStolenGoldPallet(world, batcher, cx - 6, cz + 8, false);
  _addC4ExplosiveCrateStack(world, batcher, cx + 4, cz + 8);
  _addLegoForklift(world, batcher, cx, cz + 18);
}

/**
 * TIPO C: MEGACOMPLEXO DE FÁBRICAS DE C4, LOGÍSTICA DE ASSALTO, GUINDASTE & CHAMINÉS DE 76m!
 * - 3 Grandes Galpões/Fábricas em U (H = 38m..48m) interligados por passarelas de ferro e tubulações;
 * - Bateria de 3 Silos (48m), Chaminé Industrial de 76m soltando fumaça e Guindaste Industrial (54m);
 * - Pátio 100% lotado com Contêineres Pretos/Azuis, Caminhões Baú, SUVs, Vans, Carros-Fortes, Ouro e C4!
 */
function _PopulatePCCC4FactoryAndLogisticsBlock(world, batcher, blk, idx) {
  const { cx, cz, w, d, h, label } = blk;
  const w1X = cx - w * 0.23;
  const w2X = cx + w * 0.23;
  const whZ = cz - d * 0.16;
  const w1W = w * 0.42;
  const w2W = w * 0.38;
  const whD = d * 0.52;
  const w1H = h; // 44..48m!
  const w2H = h - 6; // 38..42m!

  // 1) Megagalpão Oeste (H = 44..48m) com Telhado Dente-de-Serra e Frisos Azul-Neon
  batcher.addBox('matte_black', w1W, w1H, whD, w1X, 0.28 + w1H * 0.5, whZ);
  batcher.addBox('pcc_navy', w1W + 1.0, 3.0, whD + 1.0, w1X, 0.28 + w1H - 2.4, whZ);
  batcher.addBox('pcc_neon_blue', w1W + 1.4, 0.5, whD + 1.4, w1X, 0.28 + w1H - 4.2, whZ);
  for (let t = -1; t <= 1; t++) {
    batcher.addBox('pcc_navy', w1W - 2, 4.0, whD * 0.28, w1X, 0.28 + w1H + 1.8, whZ + t * (whD * 0.3), 0.32, 0, 0);
  }
  world.addCollider(w1X, whZ, w1W, whD, 0.28 + w1H + 4.0, 0.28);

  // 2) Megagalpão Leste (H = 38..42m) com Telhado Arqueado Blindado
  batcher.addBox('gunmetal_concrete', w2W, w2H, whD, w2X, 0.28 + w2H * 0.5, whZ);
  batcher.addBox('matte_black', w2W + 0.8, 2.6, whD + 0.8, w2X, 0.28 + w2H - 2.2, whZ);
  batcher.addBox('tactical_white', w2W + 1.2, 0.55, whD + 1.2, w2X, 0.28 + w2H - 4.0, whZ);
  batcher.addBox('pcc_navy', w2W * 0.76, 3.4, whD - 2, w2X, 0.28 + w2H + 1.7, whZ);
  world.addCollider(w2X, whZ, w2W, whD, 0.28 + w2H + 3.4, 0.28);

  // 3) Terceiro Edifício / Galpão Transversal no Sul-Leste (H = 28m — fechando o quarteirão em L/U!)
  const w3X = cx + w * 0.25;
  const w3Z = cz + d * 0.25;
  const w3W = w * 0.36;
  const w3D = d * 0.26;
  batcher.addBox('matte_black', w3W, 28.0, w3D, w3X, 0.28 + 14.0, w3Z);
  batcher.addBox('pcc_navy', w3W + 0.8, 2.0, w3D + 0.8, w3X, 0.28 + 26.8, w3Z);
  world.addCollider(w3X, w3Z, w3W, w3D, 28.5, 0.28);

  // Chaminé Industrial Altíssima (72m a 85m!) + Bateria de 3 Silos no topo/lateral
  const stackH = 70 + (idx % 4) * 5; // 70, 75, 80, 85m!
  _addTallIndustrialSmokestack(world, batcher, w2X + w2W * 0.28, whZ - whD * 0.28, stackH);
  _addGiantSiloBattery(world, batcher, cx, whZ - whD * 0.35, 3, 46);

  // Passarelas de Ferro Duplas (Y = 16m e Y = 28m) + Tubulações Externas
  const spanW = (w2X - w2W * 0.5) - (w1X + w1W * 0.5) + 2.0;
  batcher.addBox('brushed_silver', spanW, 0.65, 4.0, cx, 16.0, whZ);
  batcher.addBox('brushed_silver', spanW, 0.65, 4.0, cx, 28.0, whZ + 8);
  batcher.addCylinder('brushed_silver', 0.85, 0.85, spanW + 4, cx, 22.0, whZ - 5, 8, 0, Math.PI / 2);
  batcher.addCylinder('pcc_royal', 0.75, 0.75, spanW + 4, cx, 20.0, whZ - 5, 8, 0, Math.PI / 2);

  world.industrialPCCData.bunkersCount += 3;
  world.industrialPCCData.c4WarehousesCount += 2;

  world.mapBuildings.push({
    x: w1X,
    z: whZ,
    w: w1W,
    d: whD,
    height: w1H,
    color: '#1e3a8a',
    label
  });
  world.mapBuildings.push({
    x: w2X,
    z: whZ,
    w: w2W,
    d: whD,
    height: w2H,
    color: '#0f172a',
    label: null
  });

  // Pátio Interno 100% Lotado: Pilhas de Contêineres Pretos/Azuis (3 andares), Tanque Químico, Caminhão Baú, SUV/Van, Ouro, Maletas, C4 e Empilhadeira
  const dockZ = cz + d * 0.23;
  _addPCCContainerStack(world, batcher, cx - w * 0.32, dockZ, 3, false);
  _addHorizontalChemicalTank(world, batcher, cx - w * 0.14, dockZ + 4);
  _addStolenGoldPallet(world, batcher, w1X - 4, dockZ - 10, false);
  _addStolenGoldPallet(world, batcher, w1X + 3, dockZ - 10, false);
  _addSilverBriefcaseStack(world, batcher, w1X + 10, dockZ - 10);
  _addC4ExplosiveCrateStack(world, batcher, cx + 4, dockZ - 10);
  _addLegoForklift(world, batcher, cx - 2, dockZ - 2);
  _addPCCArmoredBoxTruck(world, batcher, cx + 6, dockZ + 2);
  _addStaticPCCSuvOrVan(world, batcher, cx - 10, dockZ - 2, idx % 2 === 0);
}

/**
 * TIPO D: BASTIÃO COSTEIRO LESTE DO PCC (X = 1580 — FECHANDO A BORDA LESTE ATÉ O MAR!)
 * Constrói Fortaleza Costeira (50-58m), Silos Marítimos, Chaminé de 70m, Guindaste e Pilhas de Contêineres
 */
function _PopulatePCCCoastalFortressBlock(world, batcher, blk, idx) {
  const { cx, cz, w, d, h, label } = blk;
  // Torre Costeira Blindada (H = 50..58m) + Galpão Marítimo Anexo (H = 34m)
  batcher.addBox('matte_black', w * 0.56, h, d * 0.46, cx, 0.28 + h * 0.5, cz - d * 0.16);
  batcher.addBox('dark_steel', w * 0.58, h - 8, d * 0.36, cx, 0.28 + h * 0.5, cz - d * 0.16);
  batcher.addBox('pcc_navy', w * 0.6, 2.8, d * 0.48, cx, 0.28 + h - 2.0, cz - d * 0.16);
  batcher.addBox('pcc_neon_blue', w * 0.62, 0.5, d * 0.5, cx, 0.28 + h - 4.0, cz - d * 0.16);
  world.addCollider(cx, cz - d * 0.16, w * 0.56, d * 0.46, 0.28 + h, 0.28);

  batcher.addBox('gunmetal_concrete', w * 0.62, 32.0, d * 0.28, cx, 0.28 + 16.0, cz + d * 0.22);
  world.addCollider(cx, cz + d * 0.22, w * 0.62, d * 0.28, 32.5, 0.28);

  _addTallIndustrialSmokestack(world, batcher, cx + w * 0.26, cz - d * 0.28, 68 + (idx % 3) * 5);
  _addPCCContainerStack(world, batcher, cx - w * 0.24, cz + d * 0.22, 3, true);
  _addC4ExplosiveCrateStack(world, batcher, cx + 8, cz + 4);

  world.industrialPCCData.bunkersCount += 2;
  world.industrialPCCData.corporateTowersCount++;
  world.mapBuildings.push({
    x: cx,
    z: cz - d * 0.16,
    w: w * 0.56,
    d: d * 0.46,
    height: h,
    color: '#0f172a',
    label
  });
}

/**
 * Constrói Bateria de 3 a 4 Silos Cilíndricos Gigantes (44m a 62m) em Aço Preto/Prata com Faixas Azuis e Passarela no Topo
 */
function _addGiantSiloBattery(world, batcher, startX, z, count = 4, height = 54) {
  world.industrialPCCData.siloBatteriesCount++;
  const spacing = 12.5;
  const totalW = (count - 1) * spacing;
  for (let i = 0; i < count; i++) {
    const sx = startX - totalW * 0.5 + i * spacing;
    batcher.addCylinder('brushed_silver', 5.2, 5.4, height, sx, 0.28 + height * 0.5, z, 10);
    batcher.addCylinder('matte_black', 5.35, 5.35, 6.0, sx, 0.28 + height * 0.35, z, 10);
    batcher.addCylinder('pcc_navy', 5.4, 5.4, 4.5, sx, 0.28 + height * 0.78, z, 10);
    batcher.addCylinder('pcc_neon_blue', 5.5, 5.5, 0.65, sx, 0.28 + height * 0.85, z, 10);
  }
  // Passarela Metálica Unificada no Topo dos Silos
  batcher.addBox('matte_black', totalW + 10, 1.2, 4.2, startX, 0.28 + height + 0.6, z);
  batcher.addBox('pcc_neon_blue', totalW + 10.4, 0.35, 4.5, startX, 0.28 + height + 1.4, z);
  world.addCollider(startX, z, totalW + 11, 11, 0.28 + height + 1.5, 0.28);
}

/**
 * Constrói Torre de Resfriamento Industrial Gigante (46m a 56m) com Vapor/Fumaça no Topo
 */
function _addIndustrialCoolingTower(world, batcher, x, z, height = 48) {
  world.industrialPCCData.coolingTowersCount++;
  batcher.addCylinder('gunmetal_concrete', 7.2, 10.2, height * 0.65, x, 0.28 + height * 0.325, z, 12);
  batcher.addCylinder('gunmetal_concrete', 8.4, 7.2, height * 0.35, x, 0.28 + height * 0.825, z, 12);
  batcher.addCylinder('pcc_navy', 8.6, 8.6, 2.4, x, 0.28 + height - 2.0, z, 12);
  batcher.addCylinder('pcc_neon_blue', 8.75, 8.75, 0.55, x, 0.28 + height - 0.5, z, 12);
  // Nuvens 3D de vapor saindo da boca da Torre de Resfriamento
  batcher.addBox('smoke_plume', 9.5, 4.5, 9.5, x, 0.28 + height + 3.2, z);
  batcher.addBox('smoke_plume', 12.0, 5.2, 12.0, x + 2.5, 0.28 + height + 8.0, z - 1.5);
  world.addCollider(x, z, 19, 19, 0.28 + height, 0.28);
}

/**
 * Constrói Chaminé Industrial Altíssima (68m a 85m!) com Luzes de Alerta Vermelhas/Azuis e Fumaça 3D no Topo
 */
function _addTallIndustrialSmokestack(world, batcher, x, z, height = 76) {
  world.industrialPCCData.tallSmokestacksCount++;
  batcher.addCylinder('matte_black', 2.4, 3.8, height, x, 0.28 + height * 0.5, z, 10);
  batcher.addCylinder('tactical_white', 2.65, 2.75, 3.5, x, 0.28 + height - 8.0, z, 10);
  batcher.addCylinder('pcc_navy', 2.55, 2.65, 3.5, x, 0.28 + height - 4.0, z, 10);
  batcher.addCylinder('c4_hazard_red', 2.7, 2.7, 1.1, x, 0.28 + height - 0.8, z, 10);
  // Pluma de Fumaça Industrial 3D subindo no céu a partir do topo da chaminé!
  batcher.addBox('smoke_plume', 5.2, 3.8, 5.2, x, 0.28 + height + 2.6, z);
  batcher.addBox('smoke_plume', 7.4, 4.6, 7.4, x + 2.2, 0.28 + height + 6.8, z - 1.4);
  batcher.addBox('smoke_plume', 9.6, 5.2, 9.6, x + 5.0, 0.28 + height + 11.8, z - 2.8);
  world.addCollider(x, z, 7.2, 7.2, 0.28 + height, 0.28);
}

/**
 * Constrói Pilha de Contêineres Pretos e Azul-Marinho do PCC (2 a 3 andares) para lotar os pátios
 */
function _addPCCContainerStack(world, batcher, x, z, layers = 3, rotated = false) {
  world.industrialPCCData.pccContainerStacksCount++;
  const cw = rotated ? 13.0 : 5.4;
  const cd = rotated ? 5.4 : 13.0;
  const ch = 4.2;
  const keys = ['matte_black', 'pcc_navy', 'armor_slate'];
  for (let s = 0; s < layers; s++) {
    const key = keys[s % keys.length];
    batcher.addBox(key, cw, ch, cd, x, 0.28 + s * ch + ch * 0.5, z);
    batcher.addBox('pcc_neon_blue', cw + 0.15, 0.25, cd + 0.15, x, 0.28 + (s + 1) * ch - 0.3, z);
  }
  // Segunda fileira colada ao lado para formar bloco maciço de contêineres
  const ox = rotated ? 0 : 6.0;
  const oz = rotated ? 6.0 : 0;
  for (let s = 0; s < Math.max(1, layers - 1); s++) {
    const key = keys[(s + 1) % keys.length];
    batcher.addBox(key, cw, ch, cd, x + ox, 0.28 + s * ch + ch * 0.5, z + oz);
  }
  world.addCollider(x + ox * 0.5, z + oz * 0.5, cw + ox, cd + oz, 0.28 + layers * ch, 0.28);
}

/**
 * Constrói Tanque Químico Cilíndrico Horizontal em berço de concreto armado
 */
function _addHorizontalChemicalTank(world, batcher, x, z) {
  world.industrialPCCData.horizontalTanksCount++;
  batcher.addBox('gunmetal_concrete', 10.5, 1.4, 4.2, x, 0.98, z);
  batcher.addCylinder('brushed_silver', 2.1, 2.1, 11.5, x, 3.2, z, 10, 0, Math.PI / 2);
  batcher.addCylinder('pcc_navy', 2.2, 2.2, 1.8, x - 2.8, 3.2, z, 10, 0, Math.PI / 2);
  batcher.addCylinder('pcc_navy', 2.2, 2.2, 1.8, x + 2.8, 3.2, z, 10, 0, Math.PI / 2);
  world.addCollider(x, z, 11.6, 4.4, 5.4, 0.28);
}

/**
 * Constrói SUV Blindada Preta ou Van Quebra-Cofre estática mesclada no Batcher (0 Draw Calls extras!)
 */
function _addStaticPCCSuvOrVan(world, batcher, x, z, isVan = false) {
  const h = isVan ? 2.4 : 1.9;
  const d = isVan ? 5.6 : 4.8;
  batcher.addBox('matte_black', 2.5, h, d, x, 0.28 + h * 0.5, z);
  batcher.addBox('dark_steel', 2.35, 0.75, d * 0.65, x, 0.28 + h * 0.72, z);
  batcher.addBox('pcc_navy', 2.58, 0.28, d - 0.3, x, 0.28 + h * 0.45, z);
  batcher.addBox('pcc_neon_blue', 2.6, 0.12, d - 0.5, x, 0.28 + h * 0.58, z);
  world.addCollider(x, z, 2.6, d, 0.28 + h, 0.28);
}

function _addStolenGoldPallet(world, batcher, x, z, spawnStuds = false) {
  world.industrialPCCData.stolenGoldPalletsCount++;
  batcher.addBox('pallet_wood', 3.4, 0.36, 3.4, x, 0.46, z);
  batcher.addBox('stolen_gold', 2.8, 0.65, 2.8, x, 0.96, z);
  batcher.addBox('stolen_gold', 2.2, 0.65, 2.2, x, 1.6, z);
  batcher.addBox('stolen_gold', 1.4, 0.55, 1.4, x, 2.2, z);
  world.addCollider(x, z, 3.4, 3.4, 2.6, 0.28);

  if (spawnStuds && world.destructibles) {
    const palTY = batcher._terrainLift(x, z);
    world.destructibles.spawnAmbientStud(x - 0.8, 2.75 + palTY, z, 'gold');
    world.destructibles.spawnAmbientStud(x + 0.8, 2.75 + palTY, z, 'blue');
    world.destructibles.spawnAmbientStud(x, 2.95 + palTY, z, 'purple');
  }
}

function _addSilverBriefcaseStack(world, batcher, x, z) {
  world.industrialPCCData.silverBriefcaseStacksCount++;
  batcher.addBox('pallet_wood', 3.0, 0.32, 3.0, x, 0.44, z);
  for (let ly = 0; ly < 3; ly++) {
    batcher.addBox('brushed_silver', 2.4 - ly * 0.3, 0.5, 1.8, x, 0.85 + ly * 0.54, z);
    batcher.addBox('matte_black', 0.6, 0.54, 1.86, x, 0.85 + ly * 0.54, z);
  }
  world.addCollider(x, z, 3.0, 3.0, 2.4, 0.28);
}

function _addC4ExplosiveCrateStack(world, batcher, x, z) {
  world.industrialPCCData.c4CratesCount += 3;
  batcher.addBox('matte_black', 3.6, 1.4, 2.6, x, 0.98, z);
  batcher.addBox('pcc_navy', 3.7, 0.35, 2.7, x, 1.15, z);
  batcher.addBox('c4_hazard_red', 0.55, 0.35, 2.75, x - 0.9, 1.45, z);
  batcher.addBox('pcc_neon_blue', 0.55, 0.35, 2.75, x + 0.9, 1.45, z);

  batcher.addBox('matte_black', 2.6, 1.1, 2.0, x, 2.2, z);
  batcher.addBox('c4_hazard_red', 0.45, 0.3, 2.1, x, 2.55, z);
  world.addCollider(x, z, 3.6, 2.6, 2.8, 0.28);
}

function _addLegoForklift(world, batcher, x, z) {
  world.industrialPCCData.forkliftsCount++;
  batcher.addBox('forklift_yellow', 2.2, 1.3, 3.2, x, 0.95, z);
  batcher.addBox('matte_black', 2.0, 1.35, 2.1, x, 2.25, z - 0.2);
  batcher.addBox('matte_black', 1.8, 3.2, 0.32, x, 1.9, z + 1.75);
  batcher.addBox('brushed_silver', 1.6, 0.18, 1.8, x, 1.15, z + 2.65);
  batcher.addBox('stolen_gold', 1.4, 0.75, 1.4, x, 1.62, z + 2.65);
  world.addCollider(x, z + 0.5, 2.4, 4.8, 3.2, 0.28);
}

function _addPCCArmoredBoxTruck(world, batcher, x, z) {
  world.industrialPCCData.boxTrucksCount++;
  batcher.addBox('matte_black', 3.4, 3.8, 8.6, x, 2.4, z);
  batcher.addBox('pcc_navy', 3.5, 0.75, 8.7, x, 2.5, z);
  batcher.addBox('tactical_white', 3.54, 0.25, 8.4, x, 3.1, z);
  batcher.addBox('gunmetal_concrete', 3.2, 2.8, 2.8, x, 1.9, z + 5.6);
  batcher.addBox('dark_steel', 2.9, 1.1, 2.9, x, 2.45, z + 5.65);
  batcher.addBox('matte_black', 3.6, 0.95, 10.8, x, 0.75, z + 1.2);
  world.addCollider(x, z + 1.2, 3.6, 11.4, 4.4, 0.28);
}

/**
 * 6. PORTO DE CARGAS, BASE A.R.E.S. & CAIS MARÍTIMO (NO EXTREMO LESTE/SUDESTE: X = 600..1620, Z = 115..735)
 * 1) Avenidas Logísticas Asfaltadas, Rotatórias de Caminhões, Setores Demarcados com Baias, Cercas e Portarias (Zero Lajão Vazio!);
 * 2) Contêineres 2.5x Maiores (18m x 6m x 6m) em 12 Grandes Quadras/Blocos Maciços (Yard Blocks) de 3, 4 e 5 Andares (18m a 30m!)
 *    + 12 Pórticos Rolantes (RTG Cranes de 36m) + 16 Torres Altas de Refletores (48m);
 * 3) 8 Grandes Armazéns e Terminais Logísticos (`DOCA 01` a `DOCA 08`, 34m a 44m), Terminal de Combustível Marítimo
 *    (8 Grandes Tanques Cilíndricos 38m–54m + 4 Esferas de Gás + Tubulações) e Torre da Capitania dos Portos (92m com Radar e Heliponto);
 * 4) Base Portuária Fortificada da 3ª Facção `A.R.E.S.` (Hangar Blindado de 52m Cinza-Titânio/Roxo-Neon, Contêineres Pretos/Roxos,
 *    4 Torretas Laser, Antenas Sci-Fi, Geradores de Plasma e Frota de Hover-APCs);
 * 5) 5 Guindastes Portuários Gigantes (Portainers de 76m: 3 no Cais Leste + 2 na Borda Sul) e 3 Grandes Navios Atracados
 *    (2 Navios Porta-Contêineres no Cais Leste + 1 Navio de Guerra/Cargueiro Blindado da `A.R.E.S.` na Doca Sul) com 6 Rampas!
 */
function buildMetropolitanPortAndDocks(world, batcher) {
  world.eastPortData = {
    hasHeavyConcreteQuay: true,
    logisticsAvenuesCount: 9,
    truckRoundaboutsCount: 4,
    demarcatedCargoYardsCount: 10,
    dockGatehousesCount: 6,
    zebraStripesSegments: 0,
    bollardsCount: 0,
    rubberFendersCount: 0,
    floodlightTowersCount: 0,
    floodlightTowerHeight: 48,
    containerDimensions: { length: 18, width: 6, height: 6 },
    yardBlocksCount: 40,
    rtgCranesCount: 18,
    rtgCraneHeight: 56,
    detailedContainersCount: 0,
    fourStoryStacksCount: 0,
    fiveStoryStacksCount: 0,
    sixToEightStoryStacksCount: 0,
    containerSkybridgesCount: 0,
    rooftopCatwalksCount: 0,
    openAresContainersCount: 0,
    numberedWarehouses: [
      'DOCA 01',
      'DOCA 02',
      'DOCA 03',
      'DOCA 04',
      'DOCA 05',
      'DOCA 06',
      'DOCA 07',
      'DOCA 08',
      'DOCA 09',
      'DOCA 10'
    ],
    fuelTanksCount: 12,
    petroTowersCount: 2,
    gasSpheresCount: 4,
    hasHarborMasterTower: true,
    harborMasterTowerHeight: 92,
    hasAresPortBase: true,
    aresHangarHeight: 52,
    aresCyberTowerHeight: 88,
    aresLaserTurretsCount: 4,
    aresPlasmaGeneratorsCount: 6,
    portainerCranesCount: 5,
    portainerHeight: 76,
    craneDriveThroughClearanceWidth: 42,
    hasMooredCargoShip: true,
    mooredCargoShipsCount: 3,
    hasAresWarship: true,
    cargoShipLength: 250,
    cargoShipBridgeFloors: 4,
    shipGangwaysCount: 6,
    cargoTrucksCount: 0
  };

  const classicLegoContainerKeys = [
    'lego_red',
    'pcc_royal',       // Azul clássico LEGO
    'forklift_yellow', // Amarelo clássico LEGO
    'lego_green',
    'lego_orange',
    'tactical_white',
    'matte_black'
  ];

  // ==========================================================================
  // 1. VIAS PORTUÁRIAS ASFALTADAS, ROTATÓRIAS DE CAMINHÕES, SETORES DEMARCADOS, CERCAS & CAIS PESADO
  // ==========================================================================
  _buildPortLogisticsRoadNetworkAndQuay(world, batcher);

  // ==========================================================================
  // 2. OS 8 GRANDES ARMAZÉNS (`DOCA 01` A `DOCA 08`), TERMINAL DE COMBUSTÍVEL (SILOS/ESFERAS) & TORRE DA CAPITANIA (92m)
  // ==========================================================================
  _buildEightPortWarehousesFuelTerminalAndHarborTower(world, batcher, classicLegoContainerKeys);

  // ==========================================================================
  // 3. CONTÊINERES 2.5x MAIORES (18x6x6) EM 12 BLOCOS MACIÇOS (3, 4 E 5 ANDARES = 18m A 30m) + 12 PÓRTICOS RTG
  // ==========================================================================
  _buildMassiveContainerYardBlocksAndRTGCranes(world, batcher, classicLegoContainerKeys);

  // ==========================================================================
  // 4. BASE PORTUÁRIA FORTIFICADA DA 3ª FACÇÃO: `A.R.E.S.` (CYBER-MERCENÁRIOS TECNOLÓGICOS)
  // ==========================================================================
  _buildAresCyberMercenaryPortBase(world, batcher);

  // ==========================================================================
  // 5. OS 5 GUINDASTES PORTUÁRIOS GIGANTES (76m: 3 LESTE + 2 SUL) & 3 GRANDES NAVIOS ATRACADOS (2 CONTÊINERES + 1 A.R.E.S.)
  // ==========================================================================
  const eastCraneZCoords = [215, 415, 605];
  eastCraneZCoords.forEach((gz, idx) => {
    _buildColossalPortainerCrane(world, batcher, 1555, gz, classicLegoContainerKeys[idx % classicLegoContainerKeys.length], false);
  });
  const southCraneXCoords = [1045, 1215];
  southCraneXCoords.forEach((gx, idx) => {
    _buildColossalPortainerCrane(world, batcher, gx, 695, idx === 0 ? 'ares_neon_purple' : 'lego_orange', true);
  });

  // 2 Grandes Navios Porta-Contêineres no Cais Leste (Z = 240 e Z = 535) + 1 Navio Blindado A.R.E.S. na Doca Sul (X = 1125, Z = 768)
  _buildMooredLegoCargoShip(world, batcher, 1668, 240, classicLegoContainerKeys, [185, 295], 'NAVIO PORTA-CONTÊINERES 01');
  _buildMooredLegoCargoShip(world, batcher, 1668, 535, classicLegoContainerKeys, [362, 502], 'NAVIO PORTA-CONTÊINERES 02');
  _buildMooredAresDreadnoughtShip(world, batcher, 1125, 768);

  // Caminhões-Carreta extras nas Avenidas Principais do Porto (estacionado na lateral em X=814,Z=362 deixando a pista X=825,Z=380 100% livre para o TP!)
  _addPortCargoSemiTruck(world, batcher, 814, 362, 'lego_red', false);
  _addPortCargoSemiTruck(world, batcher, 1545, 250, 'pcc_royal', false);
}

/**
 * 1. Constrói as Avenidas Logísticas Asfaltadas, 4 Rotatórias de Caminhões, 10 Pátios de Carga Demarcados,
 * Cercas de Tela Metálica, 6 Portarias de Doca, Bordas Zebradas, Cabeços, Defensas e 16 Torres Altas de Refletores (48m)
 */
function _buildPortLogisticsRoadNetworkAndQuay(world, batcher) {
  // 10 Pátios de Carga Demarcados (substituindo o antigo tapete cinza único por setores industriais diferenciados!)
  const sectors = [
    { x: 718,  z: 235, w: 184, d: 166, mat: 'gunmetal_concrete', mapColor: '#1e293b' }, // Setor Docas 01-02
    { x: 718,  z: 435, w: 184, d: 166, mat: 'armor_slate',       mapColor: '#334155' }, // Setor Docas 03-04
    { x: 718,  z: 622, w: 184, d: 138, mat: 'gunmetal_concrete', mapColor: '#1e293b' }, // Setor Docas 05-06
    { x: 992,  z: 235, w: 286, d: 166, mat: 'armor_slate',       mapColor: '#334155' }, // Setor Docas 07-08 + Capitania
    { x: 1265, z: 235, w: 172, d: 166, mat: 'gunmetal_concrete', mapColor: '#1e293b' }, // Setor Terminal de Combustível
    { x: 992,  z: 435, w: 286, d: 166, mat: 'gunmetal_concrete', mapColor: '#1e293b' }, // Pátio Central de Contêineres Oeste
    { x: 1265, z: 435, w: 172, d: 166, mat: 'armor_slate',       mapColor: '#334155' }, // Pátio Central de Contêineres Leste
    { x: 995,  z: 625, w: 286, d: 142, mat: 'matte_black',       mapColor: '#0f172a' }, // Setor Fortificado A.R.E.S.
    { x: 1265, z: 625, w: 172, d: 142, mat: 'gunmetal_concrete', mapColor: '#1e293b' }, // Pátio Sul de Contêineres
    { x: 1498, z: 425, w: 204, d: 616, mat: 'armor_slate',       mapColor: '#334155' }  // Plataforma Pesada do Cais Leste
  ];

  for (const sec of sectors) {
    batcher.addBox(sec.mat, sec.w, 0.28, sec.d, sec.x, 0.14, sec.z);
    world.mapBlocks.push({ x: sec.x, z: sec.z, w: sec.w, d: sec.d, color: sec.mapColor });
    // Linhas Amarelas/Brancas perimetrais demarcando o Pátio de Carga
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

    // Setas Direcionais Brancas pintadas no asfalto a cada 95m
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

  // 4 Rotatórias Logísticas de Caminhões nos cruzamentos principais ([825, 335], [1158, 335], [1375, 335], [1375, 535])
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

  // Cercas de Tela Metálica dividindo os setores internos + 6 Portarias de Doca (Guaritas + Cancelas)
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

  // Faixas Zebradas Amarelas e Pretas de Segurança ao longo de toda a borda leste (X = 1616) e sul (Z = 731.5)
  for (let zz = 122; zz <= 728; zz += 6) {
    const isYellow = Math.floor((zz - 122) / 6) % 2 === 0;
    batcher.addBox(isYellow ? 'forklift_yellow' : 'matte_black', 3.6, 0.14, 6.0, 1616.2, 0.31, zz);
    world.eastPortData.zebraStripesSegments++;
  }
  for (let xx = 610; xx <= 1610; xx += 8) {
    // Deixa a pista de 4 faixas da Avenida Portuária (X = 1375) 100% aberta para encaixar na Grande Ponte Blindada da Prisão!
    if (xx >= 1354 && xx <= 1396) continue;
    const isYellow = Math.floor((xx - 610) / 8) % 2 === 0;
    batcher.addBox(isYellow ? 'forklift_yellow' : 'matte_black', 8.0, 0.14, 3.4, xx, 0.31, 731.5);
    world.eastPortData.zebraStripesSegments++;
  }

  // Cabeços de Amarração de Ferro Fundido (Mooring Bollards) + Defensas de Borracha Preta na Parede do Cais Leste e Sul
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
 * 3. SELVA DE CONTÊINERES ULTRA-DENSA (40 GRANDES MACIÇOS LABIRÍNTICOS DE 5 A 8 ANDARES = 30m A 48m DE ALTURA!)
 * - Ocupação de 90% de todos os pátios do Porto (zero quadradão cinza vazio!);
 * - Cânions verticais claustrofóbicos de 36m a 48m, paredões em L, U, T e diagonal, e escadarias em degraus (1 -> 8 andares);
 * - Pontes Aéreas de Contêineres Suspensos (Y = 24m e Y = 36m) e rede contínua de Passarelas Metálicas no topo;
 * - 18 Pórticos Rolantes RTG Gigantes de 56m de altura com contêineres suspensos por cabos sobre os corredores!
 */
function _buildMassiveContainerYardBlocksAndRTGCranes(world, batcher, colorKeys) {
  // 40 Grandes Maciços de Contêineres cobrindo 90% de todos os pátios do Porto (Central-Oeste, Central-Leste, Sul-Leste, Cais Leste e Docas!)
  const yardBlocks = [
    // SETOR 1: PÁTIO CENTRAL-OESTE COMPLETO (X = 852..1142, Z = 356..518) — 10 Maciços de 6 a 8 Andares (36m a 48m!)
    { bx: 868,  bz: 386, rows: 4, bays: 3, maxFloors: 7, shape: 'L', hasRTG: true,  seed: 1 },
    { bx: 922,  bz: 386, rows: 4, bays: 3, maxFloors: 8, shape: 'U', hasRTG: false, seed: 2 },
    { bx: 976,  bz: 386, rows: 4, bays: 3, maxFloors: 7, shape: 'T', hasRTG: true,  seed: 3 },
    { bx: 1034, bz: 386, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 4 },
    { bx: 1098, bz: 386, rows: 5, bays: 3, maxFloors: 7, shape: 'L', hasRTG: false, seed: 5 },

    { bx: 868,  bz: 478, rows: 4, bays: 3, maxFloors: 7, shape: 'U', hasRTG: false, seed: 6 },
    { bx: 922,  bz: 478, rows: 4, bays: 3, maxFloors: 8, shape: 'L', hasRTG: true,  seed: 7 },
    { bx: 976,  bz: 478, rows: 4, bays: 3, maxFloors: 6, shape: 'U', hasRTG: false, seed: 8 },
    { bx: 1034, bz: 478, rows: 5, bays: 3, maxFloors: 8, shape: 'T', hasRTG: true,  seed: 9 },
    { bx: 1098, bz: 478, rows: 5, bays: 3, maxFloors: 7, shape: 'U', hasRTG: true,  seed: 10 },

    // SETOR 2: PÁTIO CENTRAL-LESTE COMPLETO (X = 1180..1352, Z = 356..518) — 6 Maciços de 6 a 8 Andares (36m a 48m!)
    { bx: 1202, bz: 386, rows: 4, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 11 },
    { bx: 1258, bz: 386, rows: 5, bays: 3, maxFloors: 7, shape: 'T', hasRTG: false, seed: 12 },
    { bx: 1318, bz: 386, rows: 5, bays: 3, maxFloors: 8, shape: 'L', hasRTG: true,  seed: 13 },

    { bx: 1202, bz: 478, rows: 4, bays: 3, maxFloors: 7, shape: 'L', hasRTG: false, seed: 14 },
    { bx: 1258, bz: 478, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 15 },
    { bx: 1318, bz: 478, rows: 5, bays: 3, maxFloors: 7, shape: 'U', hasRTG: false, seed: 16 },

    // SETOR 3: PÁTIO SUL-LESTE (X = 1180..1352, Z = 556..692 — FIM DO QUADRADÃO CINZA VAZIO!) — 6 Maciços de 6 a 8 Andares!
    { bx: 1202, bz: 586, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 17 },
    { bx: 1260, bz: 586, rows: 5, bays: 3, maxFloors: 7, shape: 'T', hasRTG: false, seed: 18 },
    { bx: 1318, bz: 586, rows: 5, bays: 3, maxFloors: 8, shape: 'L', hasRTG: true,  seed: 19 },

    { bx: 1202, bz: 658, rows: 5, bays: 2, maxFloors: 7, shape: 'L', hasRTG: false, seed: 20 },
    { bx: 1260, bz: 658, rows: 5, bays: 2, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 21 },
    { bx: 1318, bz: 658, rows: 5, bays: 2, maxFloors: 7, shape: 'T', hasRTG: false, seed: 22 },

    // SETOR 4: FAIXA COMPLETA DO CAIS LESTE (X = 1396..1524, Z = 158..688) — 12 Maciços Colossais de 6 a 8 Andares!
    { bx: 1424, bz: 194, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 23 },
    { bx: 1488, bz: 194, rows: 5, bays: 3, maxFloors: 7, shape: 'L', hasRTG: false, seed: 24 },
    { bx: 1424, bz: 282, rows: 5, bays: 3, maxFloors: 7, shape: 'T', hasRTG: false, seed: 25 },
    { bx: 1488, bz: 282, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 26 },

    { bx: 1424, bz: 386, rows: 5, bays: 3, maxFloors: 8, shape: 'L', hasRTG: true,  seed: 27 },
    { bx: 1488, bz: 386, rows: 5, bays: 3, maxFloors: 7, shape: 'U', hasRTG: false, seed: 28 },
    { bx: 1424, bz: 478, rows: 5, bays: 3, maxFloors: 7, shape: 'U', hasRTG: false, seed: 29 },
    { bx: 1488, bz: 478, rows: 5, bays: 3, maxFloors: 8, shape: 'T', hasRTG: true,  seed: 30 },

    { bx: 1424, bz: 586, rows: 5, bays: 3, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 31 },
    { bx: 1488, bz: 586, rows: 5, bays: 3, maxFloors: 7, shape: 'L', hasRTG: false, seed: 32 },
    { bx: 1424, bz: 658, rows: 5, bays: 2, maxFloors: 7, shape: 'L', hasRTG: false, seed: 33 },
    { bx: 1488, bz: 658, rows: 5, bays: 2, maxFloors: 8, shape: 'U', hasRTG: true,  seed: 34 },

    // SETOR 5: CORREDORES LABIRÍNTICOS ENTRE OS ARMAZÉNS E CAPITANIA (X = 620..1150) — 6 Maciços de 5 a 7 Andares!
    { bx: 713,  bz: 304, rows: 4, bays: 1, maxFloors: 6, shape: 'L', hasRTG: false, seed: 35 },
    { bx: 713,  bz: 504, rows: 4, bays: 1, maxFloors: 6, shape: 'L', hasRTG: false, seed: 36 },
    { bx: 713,  bz: 682, rows: 4, bays: 1, maxFloors: 5, shape: 'L', hasRTG: false, seed: 37 },
    { bx: 950,  bz: 304, rows: 5, bays: 1, maxFloors: 7, shape: 'U', hasRTG: false, seed: 38 },
    { bx: 1054, bz: 298, rows: 3, bays: 1, maxFloors: 6, shape: 'L', hasRTG: false, seed: 39 },
    { bx: 1142, bz: 298, rows: 3, bays: 1, maxFloors: 6, shape: 'L', hasRTG: false, seed: 40 }
  ];

  world.eastPortData.yardBlocksCount = yardBlocks.length;
  let rtgCount = 0;

  yardBlocks.forEach((yb, bIdx) => {
    const { bx, bz, rows, bays, maxFloors, shape, hasRTG, seed } = yb;
    const colSpacingX = 6.35;
    const baySpacingZ = 18.4;

    const bayStart = bays === 1 ? 0 : bays === 2 ? -0.5 : -1;
    const bayEnd = bays === 1 ? 0 : bays === 2 ? 0.5 : 1;

    for (let r = 0; r < rows; r++) {
      const rx = bx + (r - (rows - 1) * 0.5) * colSpacingX;
      for (let bay = bayStart; bay <= bayEnd; bay += 1) {
        const rz = bz + bay * baySpacingZ;

        // Escadaria de Parkour em degraus nas pontas (1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 andares!) + Paredões de 6 a 8 andares no núcleo
        let floors = maxFloors;
        if (bays >= 3 && bay === bayEnd && r === 0) {
          floors = 2; // Degrau inicial (12m) + contêiner térreo ao lado (6m)
        } else if (bays >= 3 && bay === bayEnd && r === 1) {
          floors = 4; // 24m
        } else if (bays >= 3 && bay === bayEnd && r === 2) {
          floors = 6; // 36m
        } else if (shape === 'U' && r > 0 && r < rows - 1 && bay === 0) {
          // Pátio secreto em U no miolo do maciço (corredor interno cercado por paredões de 42m-48m!)
          floors = Math.max(3, maxFloors - 3);
        } else if ((r + Math.round(bay) + seed) % 3 === 0) {
          floors = Math.max(5, maxFloors - 1);
        }

        _addCorrugatedContainerStack(world, batcher, rx, rz, floors, false, colorKeys, seed + r * 3 + Math.round(bay) + 2);
        if (floors >= 4) world.eastPortData.fourStoryStacksCount++;
        if (floors >= 5) world.eastPortData.fiveStoryStacksCount++;
        if (floors >= 6) world.eastPortData.sixToEightStoryStacksCount++;
      }
    }

    // Degrau 1 (1 andar = 6m e 3 andares = 18m) na ponta de entrada do bloco para garantir subida 1->2->3->4->5->6->7->8 a pé!
    const stairX = bx - ((rows - 1) * 0.5 + 1.0) * colSpacingX;
    const stairZ = bz + bayEnd * baySpacingZ;
    _addCorrugatedContainerStack(world, batcher, stairX, stairZ, 1, false, colorKeys, seed + 19);
    if (bays >= 2) {
      _addCorrugatedContainerStack(world, batcher, stairX, bz, 3, false, colorKeys, seed + 23);
      _addCorrugatedContainerStack(world, batcher, stairX, bz - bayEnd * baySpacingZ, 5, false, colorKeys, seed + 29);
      world.eastPortData.fiveStoryStacksCount++;
    }

    // Fechamentos Transversais em L, U e T (Contêineres rotacionados 18m x 6m formando labirintos e corredores em zigue-zague!)
    if (shape === 'U' || shape === 'L' || shape === 'T') {
      const capZNorth = bz - (bayEnd + 0.72) * baySpacingZ;
      const capFloors = Math.max(5, maxFloors - 1);
      _addCorrugatedContainerStack(world, batcher, bx, capZNorth, capFloors, true, colorKeys, seed + 31);
      world.eastPortData.fourStoryStacksCount++;
      world.eastPortData.fiveStoryStacksCount++;
      if (capFloors >= 6) world.eastPortData.sixToEightStoryStacksCount++;

      if (shape === 'U' && bays >= 2) {
        const capZSouth = bz + (bayEnd + 0.72) * baySpacingZ;
        _addCorrugatedContainerStack(world, batcher, bx + 4.0, capZSouth, capFloors, true, colorKeys, seed + 37);
        world.eastPortData.fourStoryStacksCount++;
        world.eastPortData.fiveStoryStacksCount++;
      }
    }

    // Passarelas Metálicas Cruzadas no Topo do Maciço (Y = 30m, 36m e 42m!)
    const blockSpanW = rows * colSpacingX + 2.4;
    for (const catFloor of [5, maxFloors]) {
      const catwalkY = 0.28 + catFloor * 6.0;
      batcher.addBox('brushed_silver', blockSpanW, 0.45, 3.8, bx, catwalkY + 0.18, bz - bayEnd * baySpacingZ);
      batcher.addBox('brushed_silver', blockSpanW, 0.45, 3.8, bx, catwalkY + 0.18, bz + bayEnd * baySpacingZ);
      batcher.addBox('brushed_silver', 3.8, 0.45, (bayEnd * 2) * baySpacingZ + 12.0, bx, catwalkY + 0.18, bz);
      world.addCollider(bx, bz - bayEnd * baySpacingZ, blockSpanW, 3.8, catwalkY + 0.45, catwalkY - 0.3);
      world.addCollider(bx, bz + bayEnd * baySpacingZ, blockSpanW, 3.8, catwalkY + 0.45, catwalkY - 0.3);
      world.addCollider(bx, bz, 3.8, (bayEnd * 2) * baySpacingZ + 12.0, catwalkY + 0.45, catwalkY - 0.3);
      world.eastPortData.rooftopCatwalksCount += 3;
    }

    // Pórtico Metálico Rolante Gigante (RTG Crane de 56m de altura!) abraçando o maciço de 6-8 andares
    if (hasRTG) {
      rtgCount++;
      _buildRTGGantryCraneOverBlock(
        world,
        batcher,
        bx,
        bz,
        blockSpanW + 8.5,
        56.0,
        colorKeys[(bIdx + 1) % colorKeys.length]
      );
    }

    // Caminhões-Carreta estacionados nos corredores dos cânions de contêineres (12 carretas nos pátios)
    if (bIdx < 12) {
      _addPortCargoSemiTruck(
        world,
        batcher,
        bx + blockSpanW * 0.5 + 6.8,
        bz,
        colorKeys[(bIdx * 2) % colorKeys.length],
        false
      );
    }
  });

  world.eastPortData.rtgCranesCount = rtgCount;

  // ==========================================================================
  // PONTES AÉREAS DE CONTÊINERES SUSPENSOS (Y = 24m, Y = 30m e Y = 36m) & PASSARELAS AÉREAS ENTRE OS CÂNIONS!
  // Permite correr e lutar por cima do "teto da selva de contêineres" de uma ponta a outra do Porto sem tocar no chão!
  // ==========================================================================
  const containerSkybridges = [
    // Pontes de Contêineres no Pátio Central-Oeste (a 24m e 36m de altura!)
    { x: 895,  y: 24.28, z: 386, rotated: true,  color: 'lego_red' },
    { x: 949,  y: 36.28, z: 386, rotated: true,  color: 'forklift_yellow' },
    { x: 1005, y: 30.28, z: 386, rotated: true,  color: 'pcc_royal' },
    { x: 1066, y: 36.28, z: 386, rotated: true,  color: 'lego_orange' },
    { x: 895,  y: 30.28, z: 478, rotated: true,  color: 'lego_green' },
    { x: 949,  y: 36.28, z: 478, rotated: true,  color: 'lego_red' },
    { x: 1005, y: 24.28, z: 478, rotated: true,  color: 'tactical_white' },
    { x: 1066, y: 36.28, z: 478, rotated: true,  color: 'forklift_yellow' },
    // Pontes longitudinais cruzando o corredor Z = 432 no alto (Y = 30m e 36m)
    { x: 868,  y: 30.28, z: 432, rotated: false, color: 'lego_orange' },
    { x: 976,  y: 36.28, z: 432, rotated: false, color: 'pcc_royal' },
    { x: 1098, y: 30.28, z: 432, rotated: false, color: 'lego_red' },

    // Pontes de Contêineres no Pátio Central-Leste & Sul-Leste (a 24m, 30m e 36m!)
    { x: 1230, y: 36.28, z: 386, rotated: true,  color: 'lego_orange' },
    { x: 1288, y: 30.28, z: 386, rotated: true,  color: 'pcc_royal' },
    { x: 1230, y: 30.28, z: 478, rotated: true,  color: 'forklift_yellow' },
    { x: 1288, y: 36.28, z: 478, rotated: true,  color: 'lego_red' },
    { x: 1258, y: 36.28, z: 432, rotated: false, color: 'lego_green' },
    { x: 1230, y: 36.28, z: 586, rotated: true,  color: 'lego_red' },
    { x: 1288, y: 30.28, z: 586, rotated: true,  color: 'forklift_yellow' },
    { x: 1230, y: 30.28, z: 658, rotated: true,  color: 'pcc_royal' },
    { x: 1288, y: 36.28, z: 658, rotated: true,  color: 'lego_orange' },

    // Pontes de Contêineres no Cais Leste (X = 1456, ligando as fileiras de 8 andares!)
    { x: 1456, y: 36.28, z: 194, rotated: true,  color: 'lego_red' },
    { x: 1456, y: 30.28, z: 282, rotated: true,  color: 'forklift_yellow' },
    { x: 1456, y: 36.28, z: 386, rotated: true,  color: 'pcc_royal' },
    { x: 1456, y: 36.28, z: 478, rotated: true,  color: 'lego_orange' },
    { x: 1456, y: 36.28, z: 586, rotated: true,  color: 'lego_green' },
    { x: 1456, y: 30.28, z: 658, rotated: true,  color: 'lego_red' }
  ];

  for (const sb of containerSkybridges) {
    const cw = sb.rotated ? 18.0 : 6.0;
    const cd = sb.rotated ? 6.0 : 18.0;
    const ch = 6.0;
    _addSingleDetailedContainerGeometry(batcher, sb.color, sb.x, sb.y + ch * 0.5, sb.z, cw, ch, cd, sb.rotated);
    // Vigas de aço sob o contêiner-ponte + guarda-corpo no topo (caminhável!)
    batcher.addBox('matte_black', cw + 0.6, 0.45, cd + 0.6, sb.x, sb.y - 0.15, sb.z);
    batcher.addBox('brushed_silver', cw + 0.8, 0.35, cd + 0.8, sb.x, sb.y + ch + 0.18, sb.z);
    world.addCollider(sb.x, sb.z, cw + 0.8, cd + 0.8, sb.y + ch + 0.35, sb.y);
    world.eastPortData.detailedContainersCount++;
    world.eastPortData.containerSkybridgesCount++;
    world.eastPortData.rooftopCatwalksCount++;
  }

  // Contêineres em Diagonal nos cruzamentos internos da selva (quebrando a ortogonalidade e criando barricadas táticas!)
  const diagonalContainers = [
    { x: 950,  z: 432, floors: 3, angle: 0.38,  color: 'lego_red' },
    { x: 1065, z: 432, floors: 4, angle: -0.42, color: 'forklift_yellow' },
    { x: 1230, z: 432, floors: 3, angle: 0.35,  color: 'pcc_royal' },
    { x: 1318, z: 624, floors: 4, angle: -0.36, color: 'lego_orange' },
    { x: 1456, z: 335, floors: 3, angle: 0.40,  color: 'lego_green' },
    { x: 1456, z: 535, floors: 3, angle: -0.38, color: 'lego_red' }
  ];
  for (const dc of diagonalContainers) {
    for (let s = 0; s < dc.floors; s++) {
      const cy = 0.28 + s * 6.0 + 3.0;
      const cKey = colorKeys[(s + Math.round(dc.x)) % colorKeys.length];
      batcher.addBox(cKey, 6.0, 5.85, 18.0, dc.x, cy, dc.z, 0, dc.angle, 0);
      batcher.addBox('brushed_silver', 6.2, 0.35, 18.2, dc.x, cy + 2.8, dc.z, 0, dc.angle, 0);
      world.eastPortData.detailedContainersCount++;
    }
    world.addCollider(dc.x, dc.z, 11.0, 14.0, 0.28 + dc.floors * 6.0, 0.28);
  }
}

/**
 * Constrói 1 Pórtico Metálico Rolante Gigante (RTG Crane, H = 56m) em Amarelo Industrial e Cinza-Aço
 * abraçando as pilhas de 6 a 8 andares e segurando um Contêiner 18x6x6 suspenso por cabos no ar!
 */
function _buildRTGGantryCraneOverBlock(world, batcher, cx, cz, spanW, h, suspendedColorKey) {
  const halfW = spanW * 0.5;
  const legZOff = 13.5;
  // 4 Colunas Gigantes com pneus de borracha preta + Vigas transversais no topo (Y = 56m!)
  for (const sx of [-1, 1]) {
    const lx = cx + sx * halfW;
    for (const sz of [-1, 1]) {
      const lz = cz + sz * legZOff;
      batcher.addCylinder('matte_black', 1.5, 1.5, 1.3, lx, 1.5, lz, 8, 0, Math.PI / 2);
      batcher.addBox('forklift_yellow', 2.4, h, 2.4, lx, 0.28 + h * 0.5, lz);
      world.addCollider(lx, lz, 2.6, 2.6, h, 0.28);
    }
    batcher.addBox('armor_slate', 2.6, 2.4, legZOff * 2 + 2.6, lx, h - 1.2, cz);
    batcher.addBox('forklift_yellow', 2.2, 1.8, legZOff * 2 + 2.2, lx, 28.0, cz);
  }
  // Duas Vigas Principais Superiores atravessando todo o bloco de contêineres + Trolley central
  batcher.addBox('forklift_yellow', spanW + 4.5, 2.8, 2.6, cx, h + 1.2, cz - legZOff);
  batcher.addBox('forklift_yellow', spanW + 4.5, 2.8, 2.6, cx, h + 1.2, cz + legZOff);
  batcher.addBox('lego_orange', spanW + 4.8, 0.6, 2.8, cx, h + 2.7, cz - legZOff);
  batcher.addBox('lego_orange', spanW + 4.8, 0.6, 2.8, cx, h + 2.7, cz + legZOff);
  batcher.addBox('matte_black', 8.2, 2.4, legZOff * 2 + 3.0, cx, h + 3.0, cz);
  batcher.addBox('brushed_silver', 6.8, 1.0, 18.4, cx, h - 2.0, cz);

  // Contêiner 18x6x6 suspenso por 4 cabos de aço lá no alto sob o Trolley do RTG (Y = h - 6.5m)!
  const suspY = h - 6.5;
  batcher.addCylinder('brushed_silver', 0.16, 0.16, 4.5, cx - 2.2, h - 3.8, cz - 5.5, 6);
  batcher.addCylinder('brushed_silver', 0.16, 0.16, 4.5, cx + 2.2, h - 3.8, cz - 5.5, 6);
  batcher.addCylinder('brushed_silver', 0.16, 0.16, 4.5, cx - 2.2, h - 3.8, cz + 5.5, 6);
  batcher.addCylinder('brushed_silver', 0.16, 0.16, 4.5, cx + 2.2, h - 3.8, cz + 5.5, 6);
  _addSingleDetailedContainerGeometry(batcher, suspendedColorKey, cx, suspY, cz, 6.0, 6.0, 18.0, false);
  world.eastPortData.detailedContainersCount++;
}

/**
 * Constrói uma pilha de 1 a 8 andares de Contêineres Marítimos 3D em Escala Real (18m x 6m x 6m — até 48m de altura!)
 */
function _addCorrugatedContainerStack(world, batcher, x, z, floors, rotated, colorKeys, seed) {
  const cw = rotated ? 18.0 : 6.0;
  const cd = rotated ? 6.0 : 18.0;
  const ch = 6.0;

  for (let s = 0; s < floors; s++) {
    const colorKey = colorKeys[(seed + s * 2) % colorKeys.length];
    const cy = 0.28 + s * ch + ch * 0.5;
    _addSingleDetailedContainerGeometry(batcher, colorKey, x, cy, z, cw, ch, cd, rotated);
    world.eastPortData.detailedContainersCount++;
  }

  world.addCollider(x, z, cw, cd, 0.28 + floors * ch, 0.28);
  world.mapBuildings.push({
    x,
    z,
    w: cw,
    d: cd,
    height: floors * ch,
    color: '#f59e0b'
  });
}

/**
 * Desenha 1 Contêiner Marítimo 3D em Escala Real (18m x 6m x 6m) com paredes laterais frisadas e portas duplas com travas
 * (Geometria otimizada para manter 60 FPS mesmo com >2.500 contêineres na tela!)
 */
function _addSingleDetailedContainerGeometry(batcher, colorKey, x, cy, z, cw, ch, cd, rotated) {
  batcher.addBox(colorKey, cw - 0.2, ch - 0.14, cd - 0.2, x, cy, z);

  // Frisos/caneluras laterais salientes dando textura pesada de contêiner marítimo LEGO
  if (!rotated) {
    for (const rzOff of [-5.2, 0, 5.2]) {
      batcher.addBox(colorKey, cw + 0.24, ch - 0.42, 2.2, x, cy, z + rzOff);
    }
    batcher.addBox('brushed_silver', 3.2, ch - 0.4, cd + 0.16, x, cy, z);
  } else {
    for (const rxOff of [-5.2, 0, 5.2]) {
      batcher.addBox(colorKey, 2.2, ch - 0.42, cd + 0.24, x + rxOff, cy, z);
    }
    batcher.addBox('brushed_silver', cw + 0.16, ch - 0.4, 3.2, x, cy, z);
  }
}

/**
 * Constrói 1 Contêiner Blindado Aberto da A.R.E.S. (18m x 6m x 6m) com frisos roxo-neon, cargas de armas laser e Studs dentro!
 */
function _addOpenAresContrabandContainer(world, batcher, x, z) {
  world.eastPortData.openAresContainersCount++;
  world.eastPortData.detailedContainersCount++;
  const cw = 6.2;
  const ch = 6.0;
  const cd = 18.0;
  const y0 = 0.28;

  batcher.addBox('matte_black', cw, 0.38, cd, x, y0 + 0.19, z);
  batcher.addBox('matte_black', cw, 0.38, cd, x, y0 + ch - 0.19, z);
  batcher.addBox('gunmetal_concrete', 0.38, ch, cd, x - cw * 0.5 + 0.19, y0 + ch * 0.5, z);
  batcher.addBox('gunmetal_concrete', 0.38, ch, cd, x + cw * 0.5 - 0.19, y0 + ch * 0.5, z);
  batcher.addBox('gunmetal_concrete', cw, ch, 0.38, x, y0 + ch * 0.5, z - cd * 0.5 + 0.19);
  // Frisos luminosos Roxo-Neon nas laterais e topo do contêiner blindado da A.R.E.S.
  batcher.addBox('ares_neon_purple', cw + 0.3, 0.42, cd + 0.2, x, y0 + ch - 0.5, z);

  // Portas duplas blindadas escancaradas na frente (+Z)
  batcher.addBox('matte_black', 0.34, ch - 0.2, 3.2, x - cw * 0.5 - 0.9, y0 + ch * 0.5, z + cd * 0.5 + 1.2, 0, -0.55, 0);
  batcher.addBox('matte_black', 0.34, ch - 0.2, 3.2, x + cw * 0.5 + 0.9, y0 + ch * 0.5, z + cd * 0.5 + 1.2, 0, 0.55, 0);

  // Cargas de Armas Laser & Núcleos de Plasma da A.R.E.S. dentro do contêiner
  for (const czOff of [-5.2, -1.0, 3.2]) {
    batcher.addBox('matte_black', 3.8, 1.65, 2.8, x, y0 + 1.15, z + czOff);
    batcher.addBox('brushed_silver', 3.9, 0.32, 2.9, x, y0 + 1.85, z + czOff);
    batcher.addBox('ares_magenta', 3.95, 0.42, 2.95, x, y0 + 1.25, z + czOff);
  }

  world.addCollider(x - cw * 0.5 + 0.2, z, 0.5, cd, y0 + ch, y0);
  world.addCollider(x + cw * 0.5 - 0.2, z, 0.5, cd, y0 + ch, y0);
  world.addCollider(x, z - cd * 0.5 + 0.2, cw, 0.5, y0 + ch, y0);

  if (world.destructibles) {
    world.destructibles.spawnAmbientStud(x - 0.9, y0 + 2.2, z + 4.5, 'blue');
    world.destructibles.spawnAmbientStud(x + 0.9, y0 + 2.2, z + 4.5, 'gold');
    world.destructibles.spawnAmbientStud(x, y0 + 2.2, z + 6.2, 'purple');
  }
}

/**
 * 2. Constrói os 10 Grandes Armazéns e Terminais Logísticos (`DOCA 01` a `DOCA 10`, 44m a 54m de altura cercados por paredões de contêineres!),
 * a Refinaria / Terminal de Combustível Marítimo (12 Grandes Silos Cilíndricos 48m–68m + 2 Torres Petroquímicas de 78m + 4 Esferas de Gás)
 * e a Torre da Capitania dos Portos & Controle Naval (92m de altura com Radar Giratório e Heliponto no Topo!)
 */
function _buildEightPortWarehousesFuelTerminalAndHarborTower(world, batcher, colorKeys) {
  const warehouses = [
    { cx: 668,  cz: 215, w: 66, d: 102, h: 46, bodyMat: 'scrap_teal',   trimMat: 'forklift_yellow', num: '01', label: 'DOCA 01' },
    { cx: 758,  cz: 215, w: 66, d: 102, h: 50, bodyMat: 'scrap_rust',   trimMat: 'tactical_white',  num: '02', label: 'DOCA 02' },
    { cx: 668,  cz: 415, w: 66, d: 102, h: 48, bodyMat: 'armor_slate',  trimMat: 'forklift_yellow', num: '03', label: 'DOCA 03' },
    { cx: 758,  cz: 415, w: 66, d: 102, h: 54, bodyMat: 'pcc_navy',     trimMat: 'lego_orange',     num: '04', label: 'DOCA 04' },
    { cx: 668,  cz: 602, w: 66, d: 92,  h: 44, bodyMat: 'scrap_rust',   trimMat: 'forklift_yellow', num: '05', label: 'DOCA 05' },
    { cx: 758,  cz: 602, w: 66, d: 92,  h: 52, bodyMat: 'scrap_teal',   trimMat: 'tactical_white',  num: '06', label: 'DOCA 06' },
    { cx: 892,  cz: 215, w: 72, d: 102, h: 50, bodyMat: 'pcc_navy',     trimMat: 'forklift_yellow', num: '07', label: 'DOCA 07' },
    { cx: 994,  cz: 215, w: 72, d: 102, h: 54, bodyMat: 'armor_slate',  trimMat: 'lego_orange',     num: '08', label: 'DOCA 08' },
    { cx: 634,  cz: 304, w: 34, d: 46,  h: 46, bodyMat: 'pcc_navy',     trimMat: 'tactical_white',  num: '09', label: 'DOCA 09' },
    { cx: 792,  cz: 304, w: 34, d: 46,  h: 48, bodyMat: 'scrap_teal',   trimMat: 'forklift_yellow', num: '10', label: 'DOCA 10' }
  ];

  warehouses.forEach((wh, idx) => {
    const { cx, cz, w, d, h, bodyMat, trimMat, num, label } = wh;
    // Corpo principal alto do Armazém Portuário (44m a 54m) + Claraboias + Guindaste de Teto
    batcher.addBox(bodyMat, w, h, d, cx, 0.28 + h * 0.5, cz);
    batcher.addBox('gunmetal_concrete', w + 1.2, 4.4, d + 1.2, cx, 0.28 + h - 2.8, cz);
    batcher.addBox(trimMat, w + 1.6, 1.1, d + 1.6, cx, 0.28 + h - 5.6, cz);
    batcher.addBox('dark_steel', w * 0.72, 4.2, d - 8, cx, 0.28 + h + 2.1, cz);
    // Passarela Externa Metálica a meia-altura + Pórtico de Guindaste no Teto
    batcher.addBox('brushed_silver', w + 3.6, 0.65, d + 3.6, cx, 0.28 + h * 0.55, cz);
    batcher.addBox('forklift_yellow', w * 0.85, 3.2, 4.2, cx, 0.28 + h + 5.6, cz - d * 0.24);
    batcher.addBox('forklift_yellow', w * 0.85, 3.2, 4.2, cx, 0.28 + h + 5.6, cz + d * 0.24);
    world.addCollider(cx, cz, w, d, 0.28 + h + 6.0, 0.28);

    // Docas de Caminhões nas fachadas com Portões Industriais e Caixas de Carga
    if (d >= 90) {
      for (let b = -1.5; b <= 1.5; b += 1.0) {
        const dz = cz + b * 22;
        batcher.addBox('matte_black', 1.8, 11.0, 14.0, cx + w * 0.5 + 0.3, 0.28 + 5.5, dz);
        batcher.addBox('brushed_silver', 2.0, 2.8, 13.8, cx + w * 0.5 + 0.5, 0.28 + 9.8, dz);
        batcher.addBox('pallet_wood', 3.4, 2.6, 3.4, cx - w * 0.5 - 2.8, 1.58, dz);
      }
    }

    // Painel 3D Monumental no Topo com Letreiro "DOCA 01" .. "DOCA 10"
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

    // Paredões de 3 a 5 Andares de Contêineres colados nas paredes laterais e fundos dos Armazéns (integrando os galpões na selva!)
    if (idx < 8) {
      const sideX = idx % 2 === 0 ? cx - w * 0.5 - 3.6 : cx + w * 0.5 + 3.6;
      for (const zOff of [-28, -9, 10, 29]) {
        const fl = 3 + ((idx + Math.abs(zOff)) % 3); // 3, 4 e 5 andares (18m a 30m!)
        _addCorrugatedContainerStack(world, batcher, sideX, cz + zOff, fl, false, colorKeys, idx * 5 + zOff);
        if (fl >= 4) world.eastPortData.fourStoryStacksCount++;
        if (fl >= 5) world.eastPortData.fiveStoryStacksCount++;
      }
      // Fileira transversal colada no fundo norte de cada armazém
      _addCorrugatedContainerStack(world, batcher, cx - 12, cz - d * 0.5 - 3.6, 4, true, colorKeys, idx * 7 + 1);
      _addCorrugatedContainerStack(world, batcher, cx + 12, cz - d * 0.5 - 3.6, 5, true, colorKeys, idx * 7 + 3);
      world.eastPortData.fourStoryStacksCount += 2;
      world.eastPortData.fiveStoryStacksCount++;

      // Caminhões-Carreta estacionados nas docas dos 8 Armazéns principais!
      for (const tzOff of [-20, 20]) {
        _addPortCargoSemiTruck(
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

  // ==========================================================================
  // REFINARIA & TERMINAL DE COMBUSTÍVEL MARÍTIMO (12 GRANDES SILOS CILÍNDRICOS 48m–68m + 2 TORRES PETROQUÍMICAS DE 78m + 4 ESFERAS)
  // ==========================================================================
  const tankPositions = [
    { x: 1204, z: 176, r: 11.5, h: 58, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1236, z: 176, r: 11.5, h: 66, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1268, z: 176, r: 11.5, h: 62, color: 'lego_orange',    stripe: 'tactical_white' },
    { x: 1300, z: 176, r: 11.5, h: 54, color: 'tactical_white', stripe: 'lego_orange' },

    { x: 1204, z: 218, r: 11.5, h: 52, color: 'lego_orange',    stripe: 'tactical_white' },
    { x: 1236, z: 218, r: 11.5, h: 68, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1268, z: 218, r: 11.5, h: 60, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1300, z: 218, r: 11.5, h: 48, color: 'lego_orange',    stripe: 'tactical_white' },

    { x: 1204, z: 256, r: 10.5, h: 50, color: 'tactical_white', stripe: 'forklift_yellow' },
    { x: 1236, z: 256, r: 10.5, h: 56, color: 'forklift_yellow', stripe: 'matte_black' },
    { x: 1268, z: 256, r: 10.5, h: 54, color: 'tactical_white', stripe: 'lego_orange' },
    { x: 1300, z: 256, r: 10.5, h: 48, color: 'lego_orange',    stripe: 'tactical_white' }
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

  // 2 Torres Petroquímicas de Craqueamento de 78m de altura com Chamas/Fumaça no topo!
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

  // Muralhas de Contêineres Químicos Laranjas/Amarelos/Brancos cercando a Refinaria (X = 1184 e Z = 308)
  const chemColors = ['lego_orange', 'forklift_yellow', 'tactical_white'];
  for (const czChem of [178, 198, 218, 238, 258, 278]) {
    _addCorrugatedContainerStack(world, batcher, 1184, czChem, 5, false, chemColors, czChem);
    world.eastPortData.fourStoryStacksCount++;
    world.eastPortData.fiveStoryStacksCount++;
  }
  for (const cxChem of [1206, 1228, 1250, 1272, 1294, 1316]) {
    _addCorrugatedContainerStack(world, batcher, cxChem, 308, 4, true, chemColors, cxChem);
    world.eastPortData.fourStoryStacksCount++;
  }

  // Passarelas metálicas aéreas interligando os 12 Silos Cilíndricos no topo (Y = 46m)
  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262, 46.2, 176);
  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262, 46.2, 218);
  batcher.addBox('brushed_silver', 132, 0.8, 3.6, 1262, 46.2, 256);

  // 4 Esferas de Gás Pressurizado (Z = 286, X = 1204, 1236, 1268, 1300, H = 28m)
  for (const gx of [1204, 1236, 1268, 1300]) {
    batcher.addCylinder('tactical_white', 8.5, 10.5, 11.0, gx, 16.5, 286, 12);
    batcher.addCylinder('tactical_white', 10.5, 8.5, 11.0, gx, 25.5, 286, 12);
    batcher.addCylinder('lego_orange', 10.8, 10.8, 1.8, gx, 21.0, 286, 12);
    for (const [lx, lz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      batcher.addBox('armor_slate', 1.6, 16.0, 1.6, gx + lx, 8.2, 286 + lz);
    }
    world.addCollider(gx, 286, 20, 20, 31, 0.28);
  }

  // Rede de Tubulações Industriais Grossas (Dutos Amarelos/Prateados/Laranjas) ligando o Terminal ao Cais Leste (X = 1262..1612, Z = 158)
  for (const [py, pMat] of [[11.5, 'forklift_yellow'], [13.5, 'brushed_silver'], [15.5, 'lego_orange']]) {
    batcher.addBox(pMat, 350, 1.35, 1.35, 1436, py, 158);
  }
  for (let px = 1280; px <= 1600; px += 40) {
    batcher.addBox('gunmetal_concrete', 2.4, 16.0, 3.6, px, 8.2, 158);
  }

  // ==========================================================================
  // TORRE DA CAPITANIA DOS PORTOS & CONTROLE NAVAL (X = 1105, Z = 235, H = 92m — DENTRO DE 80..100!)
  // ==========================================================================
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

/**
 * 4. BASE PORTUÁRIA FORTIFICADA DA 3ª FACÇÃO: `A.R.E.S.` (CYBER-MERCENÁRIOS TECNOLÓGICOS — X = 855..1135, Z = 555..695)
 * - Hangar Blindado de Alta Tecnologia (H = 52m) coroado pela TORRE DE COMANDO CYBER-MILITAR ESCALONADA DE 88m DE ALTURA!
 * - Selva / Fortaleza de Contêineres Pretos e Roxo-Neon (5 a 7 Andares = 30m a 42m em L e U), Pontes Aéreas Roxo-Neon
 *   e 12 Contêineres Abertos com Cargas de Armas Laser e Studs escondidos nos corredores do labirinto!
 */
function _buildAresCyberMercenaryPortBase(world, batcher) {
  const ax = 995;
  const az = 622;
  const hw = 96;
  const hd = 60;
  const hh = 52; // Base do Hangar em 52m
  const towerH = 88; // Torre Cyber-Militar escalonada subindo até 88m!

  // 1) Mega-Hangar Blindado da A.R.E.S. (52m) + Torre Cyber-Militar Escalonada de 88m no Topo!
  batcher.addBox('gunmetal_concrete', hw, hh, hd, ax, 0.28 + hh * 0.5, az);
  batcher.addBox('matte_black', hw + 2.4, 8.5, hd + 2.4, ax, 0.28 + hh - 5.2, az);
  batcher.addBox('armor_slate', hw * 0.78, 6.0, hd - 6, ax, 0.28 + hh + 3.0, az);

  // Torre Cyber-Militar Escalonada (Y = 52m até Y = 88m) em Preto Fosco, Cinza-Titânio e Feixes Roxo-Neon / Magenta!
  batcher.addBox('matte_black', 54, 18, 42, ax, 52.28 + 9.0, az);
  batcher.addBox('ares_neon_purple', 56, 1.2, 44, ax, 69.5, az);
  batcher.addBox('gunmetal_concrete', 38, 18, 32, ax, 70.28 + 9.0, az);
  batcher.addBox('ares_magenta', 40, 1.2, 34, ax, 87.2, az);

  // 4 Feixes Verticais de Energia Roxo-Neon e Magenta subindo da base até os 88m da Torre Cyber!
  for (const txOff of [-16, 16]) {
    for (const tzOff of [-13, 13]) {
      batcher.addBox('matte_black', 4.2, towerH, 4.2, ax + txOff, 0.28 + towerH * 0.5, az + tzOff);
      batcher.addBox('ares_neon_purple', 1.6, towerH + 1.0, 4.6, ax + txOff, 0.28 + towerH * 0.5, az + tzOff);
      batcher.addBox('ares_magenta', 4.6, towerH + 1.0, 1.6, ax + txOff, 0.28 + towerH * 0.5, az + tzOff);
    }
  }

  // Heliponto Roxo-Neon no Topo da Torre Cyber da A.R.E.S. (Y = 88.5m) + Radar Sci-Fi Giratório!
  batcher.addCylinder('matte_black', 15.0, 15.0, 0.6, ax, 88.5, az, 16);
  batcher.addCylinder('ares_neon_purple', 15.6, 15.6, 0.35, ax, 88.55, az, 16);
  batcher.addBox('ares_magenta', 2.0, 0.18, 9.5, ax - 3.5, 88.85, az);
  batcher.addBox('ares_magenta', 2.0, 0.18, 9.5, ax + 3.5, 88.85, az);
  batcher.addBox('ares_magenta', 7.0, 0.18, 2.0, ax, 88.85, az);

  const aresRadarGroup = new THREE.Group();
  aresRadarGroup.position.set(ax + 13, 91.8, az - 11);
  const aresRadarBar = new THREE.Mesh(
    new THREE.BoxGeometry(11.0, 1.4, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 0.9 })
  );
  aresRadarGroup.add(aresRadarBar);
  world.scene.add(aresRadarGroup);
  world.rotatingElements.push({ mesh: aresRadarGroup, axis: 'y', speed: 3.1 });

  // Contrafortes Sci-Fi inclinados + Frisos Luminosos Roxo-Neon e Magenta na fachada do Hangar
  for (let fx = ax - 40; fx <= ax + 40; fx += 20) {
    batcher.addBox('matte_black', 5.0, hh + 2, hd + 4.2, fx, 0.28 + hh * 0.5, az);
    batcher.addBox('ares_neon_purple', 1.4, hh - 4, hd + 4.8, fx, 0.28 + hh * 0.5, az);
  }
  for (const bandY of [14, 28, 42, 50]) {
    batcher.addBox('ares_magenta', hw + 3.2, 1.15, hd + 3.2, ax, bandY, az);
  }
  for (const sideZ of [-1, 1]) {
    const gz = az + sideZ * (hd * 0.5 + 0.4);
    batcher.addBox('dark_steel', 42, 24, 1.6, ax, 12.28, gz);
    batcher.addBox('ares_neon_purple', 44, 1.2, 2.0, ax, 24.5, gz);
  }
  world.addCollider(ax, az, hw, hd, 0.28 + towerH, 0.28);
  world.mapBuildings.push({
    x: ax,
    z: az,
    w: hw,
    d: hd,
    height: towerH,
    color: '#9333ea',
    label: 'TORRE & HANGAR CYBER A.R.E.S.'
  });

  // 2) SELVA / FORTALEZA DE CONTÊINERES BLINDADOS PRETOS E ROXO-NEON (5 A 7 ANDARES = 30m A 42m EM L E U!)
  const aresContainerKeys = ['matte_black', 'gunmetal_concrete', 'armor_slate'];
  const aresFortressStacks = [
    // Ala Oeste da Fortaleza A.R.E.S. (X = 864..936, Z = 566..682) — Paredões em U de 5 a 7 Andares!
    { x: 866, z: 582, floors: 7, rotated: false },
    { x: 866, z: 602, floors: 6, rotated: false },
    { x: 866, z: 622, floors: 7, rotated: false },
    { x: 866, z: 642, floors: 6, rotated: false },
    { x: 866, z: 662, floors: 7, rotated: false },
    { x: 896, z: 582, floors: 6, rotated: false },
    { x: 896, z: 622, floors: 7, rotated: false },
    { x: 896, z: 662, floors: 6, rotated: false },
    { x: 926, z: 582, floors: 5, rotated: false },
    { x: 926, z: 622, floors: 6, rotated: false },
    { x: 926, z: 662, floors: 5, rotated: false },
    { x: 884, z: 562, floors: 6, rotated: true },
    { x: 914, z: 562, floors: 5, rotated: true },
    { x: 884, z: 684, floors: 6, rotated: true },
    { x: 914, z: 684, floors: 5, rotated: true },

    // Ala Leste da Fortaleza A.R.E.S. (X = 1054..1126, Z = 566..682) — Paredões em U de 5 a 7 Andares!
    { x: 1064, z: 582, floors: 5, rotated: false },
    { x: 1064, z: 622, floors: 6, rotated: false },
    { x: 1064, z: 662, floors: 5, rotated: false },
    { x: 1094, z: 582, floors: 6, rotated: false },
    { x: 1094, z: 622, floors: 7, rotated: false },
    { x: 1094, z: 662, floors: 6, rotated: false },
    { x: 1124, z: 582, floors: 7, rotated: false },
    { x: 1124, z: 602, floors: 6, rotated: false },
    { x: 1124, z: 622, floors: 7, rotated: false },
    { x: 1124, z: 642, floors: 6, rotated: false },
    { x: 1124, z: 662, floors: 7, rotated: false },
    { x: 1076, z: 562, floors: 5, rotated: true },
    { x: 1106, z: 562, floors: 6, rotated: true },
    { x: 1076, z: 684, floors: 5, rotated: true },
    { x: 1106, z: 684, floors: 6, rotated: true }
  ];

  aresFortressStacks.forEach((st, idx) => {
    _addCorrugatedContainerStack(world, batcher, st.x, st.z, st.floors, st.rotated, aresContainerKeys, idx);
    const cw = st.rotated ? 18.0 : 6.2;
    const cd = st.rotated ? 6.2 : 18.0;
    const topY = 0.28 + st.floors * 6.0;
    batcher.addBox(idx % 2 === 0 ? 'ares_neon_purple' : 'ares_magenta', cw + 0.25, 0.45, cd + 0.25, st.x, topY - 0.35, st.z);
    world.eastPortData.fourStoryStacksCount++;
    world.eastPortData.fiveStoryStacksCount++;
    if (st.floors >= 6) world.eastPortData.sixToEightStoryStacksCount++;
  });

  // Pontes Aéreas Roxo-Neon ligando as pilhas de 5-7 andares diretamente ao teto do Hangar da A.R.E.S. (Y = 30m e Y = 36m)!
  for (const bridgeZ of [582, 622, 662]) {
    for (const bridgeX of [940, 1050]) {
      batcher.addBox('matte_black', 22.0, 0.7, 4.6, bridgeX, 30.5, bridgeZ);
      batcher.addBox('ares_neon_purple', 22.4, 0.4, 5.0, bridgeX, 30.9, bridgeZ);
      world.addCollider(bridgeX, bridgeZ, 22.0, 4.6, 31.1, 30.2);
      world.eastPortData.rooftopCatwalksCount++;
    }
  }

  // 12 Contêineres Blindados Abertos da A.R.E.S. com Armas Laser e Studs escondidos nos corredores do labirinto!
  const aresOpenCoords = [
    [881, 582], [911, 582], [1079, 582], [1109, 582],
    [881, 622], [911, 622], [1079, 622], [1109, 622],
    [881, 662], [911, 662], [1079, 662], [1109, 662]
  ];
  for (const [ox, oz] of aresOpenCoords) {
    _addOpenAresContrabandContainer(world, batcher, ox, oz);
    // Empilha +4 andares de contêineres blindados pretos/roxos da A.R.E.S. por cima (total 5 andares = 30m!)
    for (let s = 1; s <= 4; s++) {
      const cy = 0.28 + s * 6.0 + 3.0;
      _addSingleDetailedContainerGeometry(batcher, s % 2 === 0 ? 'matte_black' : 'gunmetal_concrete', ox, cy, oz, 6.0, 6.0, 18.0, false);
      batcher.addBox(s % 2 === 0 ? 'ares_neon_purple' : 'ares_magenta', 6.3, 0.42, 18.2, ox, cy + 2.7, oz);
      world.eastPortData.detailedContainersCount++;
    }
    world.eastPortData.fourStoryStacksCount++;
    world.eastPortData.fiveStoryStacksCount++;
  }

  // 3) 4 Torretas Laser Automatizadas nas 4 Esquinas do Setor Fortificado da A.R.E.S.
  const turretCoords = [
    [856, 558],
    [1134, 558],
    [856, 690],
    [1134, 690]
  ];
  for (const [tx, tz] of turretCoords) {
    batcher.addBox('matte_black', 7.5, 8.5, 7.5, tx, 4.5, tz);
    batcher.addBox('ares_neon_purple', 8.0, 0.9, 8.0, tx, 8.2, tz);
    batcher.addCylinder('gunmetal_concrete', 3.2, 3.8, 3.6, tx, 10.4, tz, 8);
    batcher.addBox('ares_magenta', 0.85, 0.85, 7.5, tx - 1.4, 11.2, tz + 3.2);
    batcher.addBox('ares_magenta', 0.85, 0.85, 7.5, tx + 1.4, 11.2, tz + 3.2);
    world.addCollider(tx, tz, 7.5, 7.5, 12.5, 0.28);
  }

  // 4) 3 Antenas Parabólicas Sci-Fi + 6 Geradores de Plasma Roxo-Neon Pulsantes no Pátio da A.R.E.S.
  for (const sx of [958, 995, 1032]) {
    batcher.addBox('matte_black', 5.2, 9.0, 5.2, sx, 4.78, 568);
    batcher.addCylinder('brushed_silver', 6.2, 1.4, 3.2, sx, 11.2, 568, 10, 0.35, 0);
    batcher.addCylinder('ares_magenta', 0.45, 0.45, 5.0, sx, 13.5, 569, 6);
    world.addCollider(sx, 568, 5.5, 5.5, 14.0, 0.28);
  }
  for (let g = 0; g < 6; g++) {
    const gx = 950 + g * 18;
    const gz = 678;
    batcher.addCylinder('matte_black', 2.8, 3.2, 8.5, gx, 4.5, gz, 10);
    batcher.addCylinder('ares_neon_purple', 2.4, 2.4, 5.2, gx, 4.5, gz, 10);
    batcher.addCylinder('ares_magenta', 3.1, 3.1, 0.75, gx, 4.5, gz, 10);
    world.addCollider(gx, gz, 6.0, 6.0, 9.0, 0.28);
  }
}

/**
 * Constrói 1 Guindaste Portuário Colossal (Portainer Crane, H = 76m — dentro de 65 a 85!):
 * - Suporta orientação Leste (`rotatedSouth = false`) e orientação Sul (`rotatedSouth = true`);
 * - 4 pernas de pórtico altas e abertas onde carros e caminhões passam por baixo;
 * - Cabine no alto (Y = 52m) e lança horizontal gigante segurando contêiner de 18x6x6 suspenso por cabos!
 */
function _buildColossalPortainerCrane(world, batcher, cx, cz, suspendedColorKey, rotatedSouth = false) {
  const legSpanA = 23.0; // Vão livre de 42m entre as pernas!
  const legSpanB = 14.0;
  const portalClearanceY = 19.5;
  const boomY = 56.0;
  const apexY = 76.0; // 76 unidades de altura (dentro de 65..85!)

  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      const lx = rotatedSouth ? cx + sb * legSpanB : cx + sa * legSpanA;
      const lz = rotatedSouth ? cz + sa * legSpanA : cz + sb * legSpanB;
      batcher.addBox('matte_black', 4.8, 2.4, 4.8, lx, 1.48, lz);
      batcher.addBox('lego_orange', 5.0, 0.7, 5.0, lx, 2.8, lz);
      batcher.addBox('forklift_yellow', 3.8, boomY, 3.8, lx, 0.28 + boomY * 0.5, lz);
      world.addCollider(lx, lz, 4.4, 4.4, boomY, 0.28);
    }
  }

  // Plataforma Superior & Casa de Máquinas no Alto (Y = 56m..63m) + Torre A-Frame até Y = 76m!
  batcher.addBox('armor_slate', rotatedSouth ? 34 : 54, 3.2, rotatedSouth ? 54 : 34, cx, boomY, cz);
  batcher.addBox('pcc_navy', 22, 6.8, 22, cx, boomY + 4.8, cz);
  batcher.addBox('forklift_yellow', rotatedSouth ? 30 : 4.8, 20.0, rotatedSouth ? 4.8 : 30, cx, boomY + 10.0, cz);
  batcher.addBox('lego_orange', rotatedSouth ? 32 : 5.6, 2.4, rotatedSouth ? 5.6 : 32, cx, apexY, cz);
  batcher.addBox('c4_hazard_red', 1.6, 1.6, 1.6, cx, apexY + 1.8, cz);

  // Lança Horizontal Gigante avançando sobre a água e sobre os Navios + Contêiner 18x6x6 Suspenso por Cabos
  if (!rotatedSouth) {
    batcher.addBox('forklift_yellow', 168, 4.2, 12.0, cx + 44, boomY + 2.0, cz);
    batcher.addBox('lego_orange', 169, 0.85, 12.4, cx + 44, boomY + 4.2, cz);
    batcher.addBox('brushed_silver', 86, 0.5, 0.5, cx + 52, boomY + 11.2, cz, 0, 0, -0.21);

    const dropX = 1656;
    batcher.addBox('matte_black', 9.2, 2.2, 9.8, dropX, boomY - 0.8, cz);
    for (const [cxOff, czOff] of [[-2.2, -5.0], [2.2, -5.0], [-2.2, 5.0], [2.2, 5.0]]) {
      batcher.addCylinder('brushed_silver', 0.18, 0.18, 19.0, dropX + cxOff, boomY - 10.5, cz + czOff, 6);
    }
    _addSingleDetailedContainerGeometry(batcher, suspendedColorKey, dropX, boomY - 23.5, cz, 6.0, 6.0, 18.0, false);
  } else {
    batcher.addBox('forklift_yellow', 12.0, 4.2, 168, cx, boomY + 2.0, cz + 44);
    batcher.addBox('lego_orange', 12.4, 0.85, 169, cx, boomY + 4.2, cz + 44);
    batcher.addBox('brushed_silver', 0.5, 0.5, 86, cx, boomY + 11.2, cz + 52, 0.21, 0, 0);

    const dropZ = 766;
    batcher.addBox('matte_black', 9.8, 2.2, 9.2, cx, boomY - 0.8, dropZ);
    for (const [cxOff, czOff] of [[-5.0, -2.2], [5.0, -2.2], [-5.0, 2.2], [5.0, 2.2]]) {
      batcher.addCylinder('brushed_silver', 0.18, 0.18, 19.0, cx + cxOff, boomY - 10.5, dropZ + czOff, 6);
    }
    _addSingleDetailedContainerGeometry(batcher, suspendedColorKey, cx, boomY - 23.5, dropZ, 18.0, 6.0, 6.0, true);
  }
  world.eastPortData.detailedContainersCount++;

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: rotatedSouth ? 34 : 54,
    d: rotatedSouth ? 54 : 34,
    height: apexY,
    color: '#facc15',
    label: 'GUINDASTE PORTAINER'
  });
}

function _addShipLocalCollider(world, shipColliders, shipX, shipZ, rotY, localX, localZ, localW, localD, maxY, minY) {
  const isRot90 = Math.abs(Math.sin(rotY)) > 0.7;
  const wx = isRot90 ? shipX + localZ : shipX + localX;
  const wz = isRot90 ? shipZ - localX : shipZ + localZ;
  const ww = isRot90 ? localD : localW;
  const wd = isRot90 ? localW : localD;
  const col = world.addCollider(wx, wz, ww, wd, maxY, minY);
  col.localX = localX;
  col.localZ = localZ;
  col.localW = localW;
  col.localD = localD;
  col.localMinY = minY;
  col.localMaxY = maxY;
  shipColliders.push(col);
  return col;
}

/**
 * Constrói 1 Grande Navio Porta-Contêineres LEGO 100% Pilotável Atracado no Cais Leste (X = 1668, Z = 240 e Z = 535):
 * - Casco vermelho e preto (250m x 46m), ponte de comando branca de 4 andares na popa,
 *   convés carregado de contêineres 18x6x6 e 2 Rampas Metálicas de Acesso caminháveis!
 */
function _buildMooredLegoCargoShip(world, batcher, shipX, shipZ, colorKeys, gangwayZList, shipLabel) {
  const hullW = 46;
  const hullL = 220;
  const deckY = 9.2;

  const shipBatcher = batcher.createSubBatcher();
  const shipGroup = new THREE.Group();
  shipGroup.rotation.order = 'YXZ';
  const shipColliders = [];

  shipBatcher.addBox('matte_black', hullW, 3.65, hullL, 0, 1.38, 0);
  shipBatcher.addBox('lego_red', hullW + 0.8, 6.0, hullL + 2.0, 0, 6.2, 0);
  shipBatcher.addBox('matte_black', 32, 3.65, 22, 0, 1.38, hullL * 0.5 + 10);
  shipBatcher.addBox('lego_red', 34, 6.0, 20, 0, 6.2, hullL * 0.5 + 9);
  shipBatcher.addBox('tactical_white', hullW + 1.4, 0.75, hullL + 4.0, 0, deckY - 0.35, 0);

  shipBatcher.addBox('armor_slate', hullW, 0.5, hullL + 24, 0, deckY, 10);
  _addShipLocalCollider(world, shipColliders, shipX, shipZ, 0, 0, 10, hullW, hullL + 24, deckY + 0.25, 0);

  // Ponte de Comando Branca de 4 Andares na Popa (localZ = -82)
  const bridgeLocalZ = -82;
  const floorH = 5.0;
  for (let f = 0; f < 4; f++) {
    const fw = 38 - f * 2.5;
    const fd = 26 - f * 2.0;
    const fy = deckY + f * floorH + floorH * 0.5;
    shipBatcher.addBox('tactical_white', fw, floorH, fd, 0, fy, bridgeLocalZ);
    shipBatcher.addBox('dark_steel', fw + 0.5, 1.8, fd - 3.0, 0, fy + 0.5, bridgeLocalZ);
    shipBatcher.addBox('pcc_navy', fw + 0.8, 0.55, fd + 0.8, 0, fy + floorH * 0.5 - 0.25, bridgeLocalZ);
  }
  const bridgeTopY = deckY + 4 * floorH;
  shipBatcher.addCylinder('lego_orange', 3.2, 3.8, 11.0, 0, bridgeTopY + 5.2, bridgeLocalZ - 6, 10);
  shipBatcher.addBox('smoke_plume', 7.5, 4.5, 7.5, 0, bridgeTopY + 13.5, bridgeLocalZ - 6);
  _addShipLocalCollider(world, shipColliders, shipX, shipZ, 0, 0, bridgeLocalZ, 38, 26, bridgeTopY, deckY);

  // Convés carregado de Contêineres LEGO 18x6x6
  for (const bzOff of [-36, -12, 16, 44, 72]) {
    for (const bxOff of [-11, 0, 11]) {
      const layers = 1 + ((Math.abs(bzOff) + Math.abs(bxOff)) % 3);
      for (let s = 0; s < layers; s++) {
        const cKey = colorKeys[(s + (bxOff > 0 ? 2 : 0) + (bzOff > 0 ? 1 : 3)) % colorKeys.length];
        _addSingleDetailedContainerGeometry(
          shipBatcher,
          cKey,
          bxOff,
          deckY + 0.25 + s * 6.0 + 3.0,
          bzOff,
          6.0,
          6.0,
          18.0,
          false
        );
        world.eastPortData.detailedContainersCount++;
      }
      _addShipLocalCollider(world, shipColliders, shipX, shipZ, 0, bxOff, bzOff, 6.0, 18.0, deckY + 0.25 + layers * 6.0, deckY);
    }
  }

  shipBatcher.finalize(shipGroup);
  shipGroup.position.set(shipX, 0, shipZ);
  shipGroup.rotation.y = 0;
  shipGroup.userData.isOptimizedGroup = true;
  shipGroup.userData.carType = 'navio_cargueiro';
  shipGroup.userData.carName = `${shipLabel} (PORTA-CONTÊINERES)`;
  shipGroup.userData.vehicleSpec = NAVAL_AIR_SPECS.navio_cargueiro;
  world.scene.add(shipGroup);

  if (!world.cargoShips) world.cargoShips = [];
  world.cargoShips.push({ mesh: shipGroup, halfW: 26, halfL: 126 });

  if (!world._pendingPortVehicles) world._pendingPortVehicles = [];
  world._pendingPortVehicles.push({
    mesh: shipGroup,
    type: 'car',
    hp: NAVAL_AIR_SPECS.navio_cargueiro.hp,
    radius: 28,
    height: bridgeTopY,
    colliders: shipColliders,
    debrisColors: [0xdc2626, 0x090a0d, 0xf8fafc, 0xfacc15],
    studDrops: NAVAL_AIR_SPECS.navio_cargueiro.studDrops,
    groundY: 0
  });

  // 2 Rampas Metálicas de Acesso Caminháveis (Gangways) ligando o Cais Leste ao Convés!
  for (const gz of gangwayZList) {
    batcher.addBox('brushed_silver', 30.0, 0.7, 7.6, 1632.0, 4.8, gz, 0, 0, 0.31);
    batcher.addBox('forklift_yellow', 30.0, 1.4, 0.35, 1632.0, 5.6, gz - 3.6, 0, 0, 0.31);
    batcher.addBox('forklift_yellow', 30.0, 1.4, 0.35, 1632.0, 5.6, gz + 3.6, 0, 0, 0.31);
    const steps = 14;
    for (let st = 0; st <= steps; st++) {
      const t = st / steps;
      const gCol = world.addCollider(1617.0 + t * 29.0, gz, 3.2, 7.6, 0.35 + t * (deckY - 0.35), 0);
      gCol.isGangway = true;
    }
  }

  world.mapBuildings.push({
    x: shipX,
    z: shipZ,
    w: hullW,
    d: hullL,
    height: bridgeTopY,
    color: '#dc2626',
    label: shipLabel
  });
}

/**
 * Constrói o Navio de Guerra / Cargueiro Blindado Preto e Roxo-Neon da Facção `A.R.E.S.` (100% Pilotável)
 * atracado na Doca Sul/Sudeste (X = 1125, Z = 768 — 230m x 44m), com superestrutura cyber de 4 andares,
 * canhões laser navais, contêineres blindados roxo-neon no convés e 2 Rampas de Acesso caminháveis!
 */
function _buildMooredAresDreadnoughtShip(world, batcher, shipX, shipZ) {
  const hullL = 220;
  const hullW = 44;
  const deckY = 9.2;

  const shipBatcher = batcher.createSubBatcher();
  const shipGroup = new THREE.Group();
  shipGroup.rotation.order = 'YXZ';
  const shipColliders = [];
  const rotY = Math.PI / 2;

  // Casco Furtivo Angular orientado com proa em +Z local (que rotacionado em +90 graus aponta para Leste +X!)
  shipBatcher.addBox('matte_black', hullW, 3.8, hullL, 0, 1.45, 0);
  shipBatcher.addBox('gunmetal_concrete', hullW + 1.0, 5.8, hullL + 4, 0, 6.2, 0);
  shipBatcher.addBox('ares_neon_purple', hullW + 1.6, 0.65, hullL + 6, 0, 4.6, 0);
  shipBatcher.addBox('ares_magenta', hullW + 1.6, 0.65, hullL + 6, 0, 8.6, 0);
  shipBatcher.addBox('armor_slate', hullW, 0.5, hullL + 16, 0, deckY, 0);
  _addShipLocalCollider(world, shipColliders, shipX, shipZ, rotY, 0, 0, hullW, hullL + 16, deckY + 0.25, 0);

  // Superestrutura de Comando Cyber de 4 Andares na Popa (localZ = -68 -> worldX = shipX - 68)
  const bridgeLocalZ = -68;
  for (let f = 0; f < 4; f++) {
    const fy = deckY + f * 5.2 + 2.6;
    shipBatcher.addBox('matte_black', 34 - f * 2.5, 5.2, 28 - f * 2, 0, fy, bridgeLocalZ);
    shipBatcher.addBox('ares_neon_purple', 35 - f * 2.5, 0.55, 29 - f * 2, 0, fy + 2.2, bridgeLocalZ);
    shipBatcher.addBox('dark_steel', 30 - f * 2.5, 1.8, 28.5 - f * 2, 0, fy + 0.4, bridgeLocalZ);
  }
  _addShipLocalCollider(world, shipColliders, shipX, shipZ, rotY, 0, bridgeLocalZ, 34, 28, deckY + 21.0, deckY);

  // Canhão Naval Duplo de Plasma na Proa (localZ = +82 -> worldX = shipX + 82) + Pilhas de Contêineres Blindados A.R.E.S.
  shipBatcher.addCylinder('gunmetal_concrete', 6.5, 7.8, 4.5, 0, deckY + 2.5, 82, 10);
  shipBatcher.addBox('ares_magenta', 1.1, 1.1, 12.0, -2.2, deckY + 3.4, 90);
  shipBatcher.addBox('ares_magenta', 1.1, 1.1, 12.0, 2.2, deckY + 3.4, 90);

  for (const bzOff of [-22, 6, 34, 58]) {
    for (const bxOff of [-10, 10]) {
      _addSingleDetailedContainerGeometry(shipBatcher, 'matte_black', bxOff, deckY + 3.25, bzOff, 6.0, 6.0, 18.0, false);
      shipBatcher.addBox('ares_neon_purple', 6.3, 0.45, 18.2, bxOff, deckY + 5.8, bzOff);
      world.eastPortData.detailedContainersCount++;
      _addShipLocalCollider(world, shipColliders, shipX, shipZ, rotY, bxOff, bzOff, 6.0, 18.0, deckY + 6.25, deckY);
    }
  }

  shipBatcher.finalize(shipGroup);
  shipGroup.position.set(shipX, 0, shipZ);
  shipGroup.rotation.y = rotY;
  shipGroup.userData.isOptimizedGroup = true;
  shipGroup.userData.carType = 'navio_ares';
  shipGroup.userData.carName = NAVAL_AIR_SPECS.navio_ares.name;
  shipGroup.userData.vehicleSpec = NAVAL_AIR_SPECS.navio_ares;
  world.scene.add(shipGroup);

  if (!world.cargoShips) world.cargoShips = [];
  world.cargoShips.push({ mesh: shipGroup, halfW: 25, halfL: 120 });

  if (!world._pendingPortVehicles) world._pendingPortVehicles = [];
  world._pendingPortVehicles.push({
    mesh: shipGroup,
    type: 'car',
    hp: NAVAL_AIR_SPECS.navio_ares.hp,
    radius: 28,
    height: deckY + 21,
    colliders: shipColliders,
    debrisColors: [0x090a0d, 0x334155, 0xa855f7, 0xd946ef],
    studDrops: NAVAL_AIR_SPECS.navio_ares.studDrops,
    groundY: 0
  });

  // 2 Rampas Metálicas de Acesso Caminháveis (X = 1075 e X = 1175) ligando o Cais Sul (Z = 733) ao Convés (Z = 749, Y = 9.2m)!
  for (const gx of [1075, 1175]) {
    batcher.addBox('brushed_silver', 7.6, 0.7, 22.0, gx, 4.8, 741.0, -0.38, 0, 0);
    batcher.addBox('ares_neon_purple', 0.4, 1.4, 22.0, gx - 3.6, 5.6, 741.0, -0.38, 0, 0);
    batcher.addBox('ares_neon_purple', 0.4, 1.4, 22.0, gx + 3.6, 5.6, 741.0, -0.38, 0, 0);
    const steps = 12;
    for (let st = 0; st <= steps; st++) {
      const t = st / steps;
      const gCol = world.addCollider(gx, 733.0 + t * 16.0, 7.6, 3.0, 0.35 + t * (deckY - 0.35), 0);
      gCol.isGangway = true;
    }
  }

  world.mapBuildings.push({
    x: shipX,
    z: shipZ,
    w: hullL,
    d: hullW,
    height: deckY + 21,
    color: '#9333ea',
    label: 'NAVIO BLINDADO A.R.E.S.'
  });
}

const SHARED_TRUCK_WHEEL_TIRE_GEO = new THREE.CylinderGeometry(0.68, 0.68, 0.56, 10);
SHARED_TRUCK_WHEEL_TIRE_GEO.rotateZ(Math.PI / 2);
const SHARED_TRUCK_WHEEL_RIM_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 8);
SHARED_TRUCK_WHEEL_RIM_GEO.rotateZ(Math.PI / 2);
const SHARED_TRUCK_FLAME_GEO = new THREE.ConeGeometry(0.36, 2.2, 8);
SHARED_TRUCK_FLAME_GEO.rotateX(-Math.PI / 2);
const SHARED_TRUCK_FLAME_MAT = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

/**
 * Constrói 1 Caminhão-Carreta Portuário 100% Pilotável (Semi-Truck com Contêiner 18x6x6 na carreta, rodas articuladas e Turbo Nitro)
 */
function _addPortCargoSemiTruck(world, batcher, x, z, containerColorKey, rotated90 = false) {
  world.eastPortData.cargoTrucksCount++;

  const truckBatcher = batcher.createSubBatcher();
  const truckGroup = new THREE.Group();
  truckGroup.rotation.order = 'YXZ';

  const cabColorKey = rotated90 ? 'tactical_white' : 'lego_orange';

  // Chassi pesado longo (4.8m x 1.2m x 22.5m) + Para-choques cromados + Cabine Frontal (+Z)
  truckBatcher.addBox('matte_black', 4.8, 1.2, 22.5, 0, 1.05, 0);
  truckBatcher.addBox('brushed_silver', 4.95, 0.65, 0.45, 0, 0.9, 11.2);
  truckBatcher.addBox('brushed_silver', 3.4, 1.55, 0.25, 0, 2.05, 10.95);
  truckBatcher.addBox(cabColorKey, 4.6, 4.2, 4.6, 0, 2.85, 8.6);
  truckBatcher.addBox(cabColorKey, 4.4, 1.05, 2.6, 0, 5.25, 7.8, -0.24, 0, 0);
  truckBatcher.addBox('dark_steel', 4.66, 1.6, 1.6, 0, 3.35, 10.15);
  // Faróis dianteiros e lanternas traseiras + 2 escapamentos verticais cromados atrás da cabine
  truckBatcher.addBox('floodlight_glow', 0.85, 0.45, 0.2, -1.75, 1.55, 10.96);
  truckBatcher.addBox('floodlight_glow', 0.85, 0.45, 0.2, 1.75, 1.55, 10.96);
  truckBatcher.addBox('c4_hazard_red', 0.9, 0.42, 0.2, -1.8, 1.05, -11.28);
  truckBatcher.addBox('c4_hazard_red', 0.9, 0.42, 0.2, 1.8, 1.05, -11.28);
  truckBatcher.addCylinder('brushed_silver', 0.22, 0.22, 4.8, -2.35, 3.7, 6.0, 8);
  truckBatcher.addCylinder('brushed_silver', 0.22, 0.22, 4.8, 2.35, 3.7, 6.0, 8);

  // Contêiner Marítimo LEGO 18m x 6m x 6m acoplado sobre a carreta (em coordenadas locais do caminhão)
  _addSingleDetailedContainerGeometry(truckBatcher, containerColorKey, 0, 4.65, -2.4, 6.0, 6.0, 18.0, false);

  truckBatcher.finalize(truckGroup);

  // 8 Rodas Articuladas (4 eixos: dianteiro direcional em z=+8.6, tração em z=+4.4 e 2 eixos da carreta em z=-5.5 e z=-8.8)
  const wheels = [];
  const tireMat = batcher.materials.get('matte_black');
  const rimMat = batcher.materials.get('brushed_silver');
  const axleZList = [
    { wz: 8.6, isFront: true },
    { wz: 4.4, isFront: false },
    { wz: -5.5, isFront: false },
    { wz: -8.8, isFront: false }
  ];
  for (const { wz, isFront } of axleZList) {
    for (const wx of [-2.35, 2.35]) {
      const steerGroup = new THREE.Group();
      steerGroup.position.set(wx, 0.68, wz);
      const spinGroup = new THREE.Group();
      const tireMesh = new THREE.Mesh(SHARED_TRUCK_WHEEL_TIRE_GEO, tireMat);
      const rimMesh = new THREE.Mesh(SHARED_TRUCK_WHEEL_RIM_GEO, rimMat);
      spinGroup.add(tireMesh, rimMesh);
      steerGroup.add(spinGroup);
      truckGroup.add(steerGroup);
      wheels.push({ steerGroup, spinGroup, isFront });
    }
  }

  // Chamas de Turbo Nitro na traseira da carreta
  const flameGroup = new THREE.Group();
  flameGroup.visible = false;
  for (const fx of [-1.4, 1.4]) {
    const fm = new THREE.Mesh(SHARED_TRUCK_FLAME_GEO, SHARED_TRUCK_FLAME_MAT);
    fm.position.set(fx, 1.05, -12.3);
    flameGroup.add(fm);
  }
  truckGroup.add(flameGroup);

  const rotY = rotated90 ? Math.PI / 2 : 0;
  const truckTY = world.getTerrainHeightAt && x > 622 && x < 1430 && z > -720 && z < -40
    ? Math.max(0, world.getTerrainHeightAt(x, z))
    : 0;
  truckGroup.position.set(x, truckTY, z);
  truckGroup.rotation.y = rotY;
  truckGroup.userData.isOptimizedGroup = true;
  truckGroup.userData.carType = 'caminhao_carreta';
  truckGroup.userData.carName = NAVAL_AIR_SPECS.caminhao_carreta.name;
  truckGroup.userData.vehicleSpec = NAVAL_AIR_SPECS.caminhao_carreta;
  truckGroup.userData.wheels = wheels;
  truckGroup.userData.turboFlames = [flameGroup];
  world.scene.add(truckGroup);

  const colW = rotated90 ? 23.0 : 5.2;
  const colD = rotated90 ? 5.2 : 23.0;
  const col = world.addCollider(x, z, colW, colD, 7.6, 0.28);

  if (!world._pendingPortVehicles) world._pendingPortVehicles = [];
  world._pendingPortVehicles.push({
    mesh: truckGroup,
    type: 'car',
    hp: NAVAL_AIR_SPECS.caminhao_carreta.hp,
    radius: 11.5,
    height: 7.6,
    colliders: [col],
    debrisColors: [0xf97316, 0x090a0d, 0xf8fafc, 0xfacc15],
    studDrops: NAVAL_AIR_SPECS.caminhao_carreta.studDrops,
    groundY: truckTY
  });
}


