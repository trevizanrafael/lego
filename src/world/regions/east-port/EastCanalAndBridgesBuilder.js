import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  applyAnimatedLegoWaterShader
} from '../../../materials/LegoMaterials.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../../core/WorldLayoutScale.js';
import { RIVER_BRIDGE_SPECS, RIVER_PIER_SPECS } from '../../RoadGridBuilder.js';

/**
 * 1. RIO / CANAL URBANO NAVEGÁVEL DE PONTA A PONTA (MAR NORTE Z = ws(-1320) AO MAR SUL Z = ws(+1068), COTA Y = -3.5),
 *    MUROS DE CAIS DE PEDRA/CONCRETO, 3 PÍERES FLUVIAIS DE MADEIRA E 9 PONTES ELEVADAS EM ARCO (Y = +5.0m)
 */
export function buildEastCanalBridgesAndPCCBarricades(world, batcher) {
  const riverX = ws(560);
  const riverWidth = ws(40);
  const riverZStart = ws(-1320);
  const riverZEnd = ws(1068);
  const riverLength = riverZEnd - riverZStart; // 2388m (1x) / 7164m (3x) de ponta a ponta!
  const riverCenterZ = (riverZStart + riverZEnd) * 0.5;
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
    horizontalClearance: IS_SCALED_WORLD ? ws(36.0) : 36.0,
    archedBridgesCount: RIVER_BRIDGE_SPECS.length,
    hasBeachMouthBridge: true,
    riverPiersCount: RIVER_PIER_SPECS.length,
    connectedToNorthAndSouthOcean: true,
    zeroBridgeRoadColliders: true
  };

  // 1.1 Superfície da Água do Rio Navegável na cota Y = -3.50 (ligando o Oceano Norte direto ao Oceano Sul!)
  if (!world.waterShaderUniforms) {
    world.waterShaderUniforms = { uTime: { value: 0 } };
  }
  const canalWaterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
    reflectivity: 0.8
  });
  applyAnimatedLegoWaterShader(canalWaterMat, world.waterShaderUniforms, {
    waveAmp: 0.035,
    waveFreq: 0.18,
    fresnelBoost: 0.22,
    variant: 'canal'
  });
  const canal = new THREE.Mesh(new THREE.BoxGeometry(riverWidth, 0.3, riverLength), canalWaterMat);
  canal.position.set(riverX, waterY - 0.15, riverCenterZ);
  canal.receiveShadow = true;
  world.scene.add(canal);
  world.mapWater.push({ x: riverX, z: riverCenterZ, w: riverWidth, d: riverLength });

  // Faixas sutis de espuma/correnteza azul-clara ao longo do eixo central do Rio (em Y = -3.48)
  const foamStep = ws(60);
  for (let wz = ws(-1260); wz <= ws(1020); wz += foamStep) {
    batcher.addBox('coastal_turquoise', 1.4, 0.04, 24.0, riverX - ws(8.5), waterY + 0.02, wz);
    batcher.addBox('coastal_turquoise', 1.4, 0.04, 24.0, riverX + ws(8.5), waterY + 0.02, wz + 28);
  }

  // 1.2 Muros de Cais de Pedra Cinza/Concreto nas Duas Margens (borda Oeste ws(540)-1 e borda Leste ws(580)+1)
  // Descendo desde a borda das ruas (Y = +0.35) até o fundo da água (Y = -4.0)!
  const westBankX = ws(540);
  const eastBankX = ws(580);
  const westQuayX = westBankX - 1.0;
  const eastQuayX = eastBankX + 1.0;

  const westQuayZ0 = ws(-1320);
  const westQuayZ1 = ws(1045);
  const eastQuayZ0 = ws(-1320);
  const eastQuayZ1 = ws(735);

  if (!IS_SCALED_WORLD) {
    const westQuayLen = westQuayZ1 - westQuayZ0;
    const westQuayCZ = (westQuayZ0 + westQuayZ1) * 0.5;
    batcher.addBox('gunmetal_concrete', 2.4, 4.35, westQuayLen, westQuayX, -1.825, westQuayCZ);
    batcher.addBox('brushed_silver', 2.8, 0.24, westQuayLen, westQuayX, 0.42, westQuayCZ);

    const eastQuayLen = eastQuayZ1 - eastQuayZ0;
    const eastQuayCZ = (eastQuayZ0 + eastQuayZ1) * 0.5;
    batcher.addBox('gunmetal_concrete', 2.4, 4.35, eastQuayLen, eastQuayX, -1.825, eastQuayCZ);
    batcher.addBox('brushed_silver', 2.8, 0.24, eastQuayLen, eastQuayX, 0.42, eastQuayCZ);
  } else {
    const segMax = 480;
    for (let z0 = westQuayZ0; z0 < westQuayZ1 - 0.01; z0 += segMax) {
      const z1 = Math.min(westQuayZ1, z0 + segMax);
      const len = z1 - z0;
      const cz = (z0 + z1) * 0.5;
      batcher.addBox('gunmetal_concrete', 2.4, 4.35, len, westQuayX, -1.825, cz);
      batcher.addBox('brushed_silver', 2.8, 0.24, len, westQuayX, 0.42, cz);
    }
    for (let z0 = eastQuayZ0; z0 < eastQuayZ1 - 0.01; z0 += segMax) {
      const z1 = Math.min(eastQuayZ1, z0 + segMax);
      const len = z1 - z0;
      const cz = (z0 + z1) * 0.5;
      batcher.addBox('gunmetal_concrete', 2.4, 4.35, len, eastQuayX, -1.825, cz);
      batcher.addBox('brushed_silver', 2.8, 0.24, len, eastQuayX, 0.42, cz);
    }
  }

  // Calçadão Costeiro na Margem Oeste da Foz da Praia (Z = ws(725)..ws(1040)) + Praça de Cabeceira na Ponte Z = ws(402)
  const promLen = ws(315);
  const promCZ = ws(882.5);
  batcher.addBox('tactical_white', 8.5, 0.34, promLen, westBankX - 5.5, 0.17, promCZ);
  batcher.addBox('coastal_turquoise', 1.2, 0.36, promLen, westBankX - 8.8, 0.18, promCZ);
  batcher.addBox(
    'matte_black',
    28.0,
    0.3,
    IS_SCALED_WORLD ? ROAD.mainWidth + 2.0 : 32.0,
    ws(594.0),
    0.15,
    ws(402.0)
  );

  // Molhes de Pedra / Quebra-Mar e Faroletes Náuticos nas Fozes Sul e Norte
  const westBreakX = westBankX - 2.0;
  const eastBreakX = eastBankX + 2.0;
  batcher.addBox('armor_slate', 5.2, 4.6, ws(28), westBreakX, -1.7, ws(1055));
  batcher.addBox('armor_slate', 5.2, 4.6, ws(56), eastBreakX, -1.7, ws(760));
  for (const [bx, bz, beaconKey] of [
    [westBreakX, ws(1068) - 2, 'coastal_turquoise'],
    [eastBreakX, ws(785), 'c4_hazard_red'],
    [westBreakX, ws(-1320) + 2, 'coastal_turquoise'],
    [eastBreakX, ws(-1320) + 2, 'pcc_neon_blue']
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
  const westRailX = westBankX - 1.2;
  const westLampX = westBankX - 2.8;
  const eastRailX = eastBankX + 1.2;
  const eastLampX = eastBankX + 2.8;
  for (let rz = ws(-1296); rz <= ws(1024); rz += 16) {
    if (isBankOpenAt(rz, 'west')) {
      batcher.addBox('armor_slate', 0.65, 0.85, 14.5, westRailX, 0.88, rz);
      batcher.addBox('brushed_silver', 0.85, 0.18, 15.2, westRailX, 1.36, rz);
      batcher.addCylinder('brushed_silver', 0.32, 0.32, 0.22, westRailX, 1.54, rz - 4.5, 6);
      batcher.addCylinder('brushed_silver', 0.32, 0.32, 0.22, westRailX, 1.54, rz + 4.5, 6);

      if (Math.abs(rz) % 64 === 0) {
        _addRiversideDoubleLamp(batcher, westLampX, 0.45, rz, rz > ws(650) ? 'beach' : 'urban');
      }
    }
    if (rz <= ws(720) && isBankOpenAt(rz, 'east')) {
      batcher.addBox('armor_slate', 0.65, 0.85, 14.5, eastRailX, 0.88, rz);
      batcher.addBox('brushed_silver', 0.85, 0.18, 15.2, eastRailX, 1.36, rz);
      batcher.addCylinder('brushed_silver', 0.32, 0.32, 0.22, eastRailX, 1.54, rz - 4.5, 6);
      batcher.addCylinder('brushed_silver', 0.32, 0.32, 0.22, eastRailX, 1.54, rz + 4.5, 6);

      if (Math.abs(rz) % 64 === 0) {
        _addRiversideDoubleLamp(batcher, eastLampX, 0.45, rz, 'pcc');
      }
    }
  }

  // 1.3 Os 3 Píeres/Decks Fluviais de Madeira no Rio (Parque Central, Distrito PCC e Foz da Praia Sul)
  for (const pier of RIVER_PIER_SPECS) {
    _buildWoodenRiverPier(world, batcher, pier);
  }

  // 1.4 As 9 Pontes Monumentais Elevadas em Arco (Equação bridgeY = 5.0 * sin(t * PI) e ZERO Colisores de Pista!)
  for (const bridgeSpec of RIVER_BRIDGE_SPECS) {
    _buildMonumentalArchedBridge(world, batcher, bridgeSpec);
  }

  // 1.5 As 5 Barricadas Táticas nas Entradas do Distrito Industrial do PCC (com pista central 100% livre!)
  const designEntryAvenuesZ = [-512, -382, -250, -117, 0];
  for (const dz of designEntryAvenuesZ) {
    world.industrialPCCData.entryBarricadesCount++;

    const ez = ws(dz);
    const gx = ws(614);
    const halfRoad = IS_SCALED_WORLD
      ? (dz === -512 ? ROAD.secondaryWidth : ROAD.mainWidth) * 0.5
      : 13.0;
    const guardLift = IS_SCALED_WORLD ? ROAD.curbHeight : 0;
    const gz = IS_SCALED_WORLD ? ez - (halfRoad + 3.2) : ez - 15.8;

    batcher.addBox('gunmetal_concrete', 6.4, 4.2, 5.4, gx, guardLift + 2.1, gz);
    batcher.addBox('matte_black', 6.8, 0.65, 5.8, gx, guardLift + 4.4, gz);
    batcher.addBox('dark_steel', 5.2, 1.5, 5.5, gx, guardLift + 2.5, gz);
    batcher.addBox('pcc_neon_blue', 6.9, 0.22, 5.9, gx, guardLift + 4.1, gz);
    world.addCollider(gx, gz, 6.4, 5.4, guardLift + 4.6, 0);

    // Pórtico elevado do Checkpoint PCC (8.8m de altura livre na pista central!)
    const pillarOffZ = IS_SCALED_WORLD ? halfRoad + 0.8 : 13.0;
    const gantrySpanD = IS_SCALED_WORLD ? halfRoad * 2 + 2.8 : 27.6;
    batcher.addBox('matte_black', 1.2, 9.2, 1.2, gx, 4.6, ez - pillarOffZ);
    batcher.addBox('matte_black', 1.2, 9.2, 1.2, gx, 4.6, ez + pillarOffZ);
    batcher.addBox('pcc_navy', 2.0, 1.9, gantrySpanD, gx, 9.2, ez);
    batcher.addBox('tactical_white', 2.15, 0.65, 16.0, gx, 9.2, ez);
    batcher.addBox('pcc_neon_blue', 0.9, 0.6, 1.4, gx - 0.8, 8.2, ez - 8.5);
    batcher.addBox('pcc_neon_blue', 0.9, 0.6, 1.4, gx - 0.8, 8.2, ez + 8.5);

    // Chicane tática nas bordas externas mantendo o centro da avenida livre para carros a 290 km/h!
    const chicaneX = ws(612);
    const chicaneOffZ = IS_SCALED_WORLD ? halfRoad - 3.4 : 10.6;
    for (const side of [-1, 1]) {
      const bz = ez + side * chicaneOffZ;
      batcher.addBox('matte_black', 2.2, 1.55, 5.4, chicaneX, 0.78, bz);
      batcher.addBox('tactical_white', 2.28, 0.42, 1.8, chicaneX, 0.95, bz - 1.3);
      batcher.addBox('tactical_white', 2.28, 0.42, 1.8, chicaneX, 0.95, bz + 1.3);
      batcher.addBox('pcc_neon_blue', 0.45, 0.35, 0.45, chicaneX, 1.68, bz);
      world.addCollider(chicaneX, bz, 2.2, 5.4, 1.6, 0);
    }

    const barrelX = ws(610.5);
    const barrelOffZ = IS_SCALED_WORLD ? halfRoad - 5.8 : 8.2;
    _spawnPCCExplosiveBarrel(world, barrelX, ez - barrelOffZ, 0x1d4ed8);
    _spawnPCCExplosiveBarrel(world, barrelX, ez + barrelOffZ, 0xdc2626);
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
  const spanL = xEnd - xStart; // 68m (1x) / 204m (3x)
  const halfW = width * 0.5;
  const roadW = width - 5.2;
  const sidewalkW = 2.2;
  const segCount = IS_SCALED_WORLD ? 32 : 16;

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
      batcher.addBox(pillarMat, 3.8, 16.5, 3.2, px, 4.75, pz);
      batcher.addBox(trussMainMat, 4.2, 1.2, 3.6, px, 13.2, pz);
      batcher.addBox(trussAccentMat, 3.4, 0.7, 2.8, px, 14.1, pz);
      batcher.addBox(glowMat, 1.8, 1.1, 1.8, px, 14.9, pz);
      batcher.addCylinder(trussAccentMat, 0.55, 0.55, 0.35, px, 15.6, pz, 8);
    }
  }

  // 3. Grandes Arcos Superiores de Treliça de Aço nas Duas Laterais (subindo até Y = 15.2m no centro!)
  const archXStart = xStart + 3.5;
  const archXEnd = xEnd - 3.5;
  const archSpan = archXEnd - archXStart;
  const archSegs = IS_SCALED_WORLD ? 24 : 12;

  for (const side of [-1, 1]) {
    const tz = bz + side * (halfW + 0.55);

    for (let a = 0; a < archSegs; a++) {
      const t0 = a / archSegs;
      const t1 = (a + 1) / archSegs;
      const x0 = archXStart + t0 * archSpan;
      const x1 = archXStart + t1 * archSpan;

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

      const xMid = (x0 + x1) * 0.5;
      const deckYMid = archHeight * Math.sin(((xMid - xStart) / spanL) * Math.PI);
      const hangerH = Math.max(1.2, cyTop - deckYMid);
      batcher.addBox('brushed_silver', 0.38, hangerH, 0.38, xMid, deckYMid + hangerH * 0.5, tz);

      const deckY0 = archHeight * Math.sin(((x0 - xStart) / spanL) * Math.PI);
      const diagDy = yTop1 - deckY0;
      const diagLen = Math.hypot(dx, diagDy);
      const diagRotZ = Math.atan2(diagDy, dx);
      batcher.addBox(trussMainMat, diagLen, 0.32, 0.32, cx, (deckY0 + yTop1) * 0.5, tz, 0, 0, diagRotZ);
    }

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

  // 4. Três Travessas Superiores de Contraventamento unindo os dois arcos lá no alto (Y = 12.6m a 15.2m)
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
    (world.getTerrainHeightAt && x > ws(622) && x < ws(1430) && z > ws(-720) && z < ws(-40)
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
