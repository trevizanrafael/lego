import { getHighwayDistanceAt } from '../../CoastlineProfile.js';
import { IS_SCALED_WORLD, ws, wsP, fromWs } from '../../core/WorldLayoutScale.js';
import {
  getFavelaEastBorderDesignX,
  getFavelaEastBorderX,
  getFavelaElevation,
  WINDING_LADEIRAS,
  getLadeiraZAtX
} from './FavelaElevationAndBatcher.js';

/**
 * 4. GERADOR DE BARRACOS E SOBRADOS (`createFavelaHouse`) COM ALICERCE DE CONCRETO NA LADEIRA
 * - Posicionado exatamente em `yBase = getFavelaElevation(x, z)` com alicerce de concreto embutido na inclinação!
 * - 60% Tijolo Baiano laranja, 20% Cimento Cinza Cru, 20% Vermelho/Preto/Branco do CV!
 */
export function createFavelaHouse(world, batcher, x, z, w, d, floors, seed, registerIndividualCollider = true) {
  const yBase = getFavelaElevation(x, z);
  const floorH = 3.5;

  // Alicerce de Concreto Cinza embutido 3.4m para baixo na inclinação da ladeira (NUNCA flutua no morro!)
  const foundationDepth = 3.4;
  batcher.addBox(
    'retaining_concrete',
    w + 0.25,
    foundationDepth,
    d + 0.25,
    x,
    yBase - foundationDepth * 0.5 + 0.25,
    z
  );

  let curY = yBase + 0.2;
  for (let f = 0; f < floors; f++) {
    const styleRoll = (seed * 7 + f * 13) % 10;
    let wallMat = 'brick_baiano';

    // 60% Tijolo Baiano (0..5), 20% Cimento Cru (6..7), 20% Cores do CV (8..9)
    if (styleRoll <= 5) {
      wallMat = styleRoll % 2 === 0 ? 'brick_baiano' : 'brick_baiano_light';
      world.favelaCDDData.brickBaianoCount++;
    } else if (styleRoll <= 7) {
      wallMat = 'cement_raw';
      world.favelaCDDData.cementRawCount++;
    } else {
      wallMat = styleRoll === 8 ? 'cv_red' : (seed + f) % 3 === 0 ? 'cv_black' : 'cv_white';
      world.favelaCDDData.cvPaintedCount++;
    }

    // Puxadinho: andares superiores projetam-se 0.55m sobre o beco estreito com mãos-francesas diagonais!
    const overhangX = f > 0 && (seed + f) % 2 === 0 ? 0.55 : 0;
    const fx = x + overhangX;

    batcher.addBox(wallMat, w, floorH, d, fx, curY + floorH * 0.5, z);
    if (overhangX > 0) {
      batcher.addSlopedBox(
        'rebar_iron',
        0.14,
        1.05,
        0.14,
        x + w * 0.5 + 0.14,
        curY - 0.35,
        z - d * 0.32,
        0,
        -0.55
      );
      batcher.addSlopedBox(
        'rebar_iron',
        0.14,
        1.05,
        0.14,
        x + w * 0.5 + 0.14,
        curY - 0.35,
        z + d * 0.32,
        0,
        -0.55
      );
    }

    if (wallMat.startsWith('brick_')) {
      batcher.addBox('brick_groove', w + 0.12, 0.2, d + 0.12, fx, curY + 1.75, z);
    }

    if (wallMat === 'cv_red' || (f === 0 && seed % 5 === 0)) {
      batcher.addBox('cv_black', w + 0.16, 0.72, d + 0.16, fx, curY + 0.45, z);
    }

    // 70% das janelas dos barracos/sobrados brilham à noite em Amarelo-Âmbar, Laranja-Lâmpada ou Branco-TV Azulado!
    const winRoll = (seed * 5 + f * 11) % 10;
    const winMat =
      winRoll < 4
        ? 'window_lit'
        : winRoll < 6
          ? 'window_orange'
          : winRoll === 6
            ? 'window_tv_blue'
            : 'window_dark';
    batcher.addBox(winMat, w + 0.18, 0.9, d * 0.48, fx, curY + 2.05, z);

    if (f === floors - 1) {
      batcher.addBox('cement_slab', w + 0.6, 0.36, d + 0.6, fx, curY + floorH + 0.18, z);
    }

    curY += floorH + 0.18;
  }

  if (registerIndividualCollider) {
    world.addCollider(x, z, w, d, curY, yBase - 2.5);
  }

  // Detalhes na Laje Superior: Vergalhões + Caixa d'Água Azul-Turquesa + Telha de Zinco/Varal + Bandeira do CV
  batcher.addBox('rebar_iron', 0.15, 1.3, 0.15, x - w * 0.44, curY + 0.65, z - d * 0.44);
  batcher.addBox('rebar_iron', 0.15, 1.3, 0.15, x + w * 0.44, curY + 0.65, z + d * 0.44);

  if (seed % 4 !== 3) {
    const tx = x - w * 0.22;
    const tz = z - d * 0.22;
    batcher.addBox('water_tank_blue', 2.0, 1.4, 2.0, tx, curY + 0.7, tz);
    batcher.addBox('water_tank_lid', 2.16, 0.22, 2.16, tx, curY + 1.48, tz);
    world.favelaCDDData.waterTanksCount++;
  }

  if (seed % 3 === 0) {
    // Telhado de zinco corrugado inclinado (meia-água caída p/ o beco, quebrando o topo reto!)
    const tiltZ = ((seed % 2 === 0 ? 1 : -1) * 0.17);
    batcher.addBox('wood_pole', 0.16, 1.45, 0.16, x + w * 0.36, curY + 0.72, z - d * 0.38);
    batcher.addBox('wood_pole', 0.16, 1.45, 0.16, x + w * 0.36, curY + 0.72, z + d * 0.38);
    batcher.addSlopedBox('zinc_roof', w * 0.66, 0.14, d + 0.55, x + w * 0.18, curY + 1.42, z, 0, tiltZ);
  } else if (seed % 3 === 1) {
    // Cobertura completa de zinco oxidado inclinada sobre a laje
    const tiltX = ((seed % 2 === 0 ? 1 : -1) * 0.13);
    batcher.addSlopedBox('zinc_roof', w + 0.5, 0.14, d * 0.64, x, curY + 1.28, z + d * 0.14, tiltX, 0);
  } else if (seed % 2 === 0) {
    batcher.addBox('wire_black', 0.1, 0.1, d * 0.68, x + w * 0.25, curY + 1.3, z);
    batcher.addBox('cv_red', 0.14, 0.65, 1.0, x + w * 0.25, curY + 0.9, z - 0.6);
    batcher.addBox('favela_yellow_faded', 0.14, 0.65, 1.0, x + w * 0.25, curY + 0.9, z + 0.6);
  }

  if (seed % 6 === 0) {
    batcher.addBox('rebar_iron', 0.18, 2.9, 0.18, x + w * 0.35, curY + 1.45, z);
    batcher.addBox('cv_red', 0.16, 1.05, 1.75, x + w * 0.35, curY + 2.4, z + 0.85);
  }

  world.favelaCDDData.housesCount++;
  return { topY: curY, yBase, height: curY - yBase };
}

/**
 * 5. AGRUPA OS BARRACOS EM CLUSTERS COLADOS PAREDE COM PAREDE (4 A 10 CASAS ENCOSTADAS!)
 * - Entre uma casa e outra do mesmo cluster a distância é ZERO (parede com parede e fundo com fundo)!
 * - Entre um cluster de barracos colados e o próximo, sobra APENAS o espaço estreito de 3.5 a 4.8 unidades
 *   para os Becos e Vielas (eliminando todo o chão cinza vazio)!
 */
export function buildGluedFavelaHouseClusters(world, batcher) {
  if (IS_SCALED_WORLD) {
    _buildScaledFavelaHouseClusters(world, batcher);
    return;
  }

  let seed = 1;

  // Verifica se (x, z) cai em cima de uma Ladeira Torta, Viela Transversal ou dos 3 Marcos Comunitários
  const isOnRoadOrLandmark = (x, z) => {
    // 1. Campinho de Futebol da CDD (X = -605, Z = +195)
    if (x >= -642 && x <= -568 && z >= 152 && z <= 238) return true;

    // 2. Quadra do Baile do CV & Paredão (X = -715, Z = -135)
    if (x >= -752 && x <= -678 && z >= -174 && z <= -96) return true;

    // 3. Fortaleza do Barão Vermelho & Caixa d'Água Comunitária (X = -865, Z = -240)
    if (x >= -902 && x <= -828 && z >= -305 && z <= -195) return true;

    // 4. As Ladeiras Tortas / Escadões que sobem serpenteando pela encosta (faixa de 6.2m de folga)
    for (const ladeira of WINDING_LADEIRAS) {
      const lz = getLadeiraZAtX(ladeira, x);
      if (Math.abs(z - lz) < 7.2) return true;
    }

    // 5. As 3 Vielas Transversais Tortas a meia-encosta (beco de 4.2m de largura)
    for (const baseX of [-595, -695, -805]) {
      const vx = baseX + Math.sin(z * 0.018) * 14 + Math.cos(z * 0.009) * 8;
      if (Math.abs(x - vx) < 5.8) return true;
    }

    // 6. Respeita qualquer Rodovia Regional da Pangeia no prolongamento Norte
    if (z < -1300 && getHighwayDistanceAt(x, z) < 28) return true;

    return false;
  };

  // Percorre a encosta da Favela criando faixas duplas de barracos COLADOS PAREDE COM PAREDE (2 casas fundo-com-fundo em X
  // e 4 a 8 casas coladas parede-com-parede em Z), separadas apenas por Becos Estreitos de 3.8m a 4.6m!
  const minZ = -1780;
  const maxZ = 645;

  // Cada faixa dupla tem ~21m de profundidade em X (duas casas de ~10.5m coladas fundo-com-fundo) + 4.2m de Beco estreito = passo de 25.2m!
  for (let stripCenterX = -552; stripCenterX >= -984; stripCenterX -= 25.2) {
    let curZ = minZ;

    while (curZ < maxZ) {
      const xEastBorder = getFavelaEastBorderX(curZ);
      if (stripCenterX > xEastBorder - 14) {
        curZ += 12;
        continue;
      }

      const elev = getFavelaElevation(stripCenterX, curZ);
      if (elev < 0.45 || isOnRoadOrLandmark(stripCenterX, curZ)) {
        curZ += 6.5;
        continue;
      }

      // Inicia um CLUSTER de 4 a 8 barracos COLADOS PAREDE COM PAREDE ao longo de Z (em fila dupla fundo-com-fundo)!
      seed++;
      const housesInClusterRow = 3 + (seed % 4); // 3 a 6 na frente + 3 a 6 atrás = 6 a 12 casas coladas no cluster!
      const clusterStartZ = curZ;
      let clusterEndZ = curZ;
      let maxClusterTopY = 0;
      let minClusterBaseY = Infinity;
      let builtInCluster = 0;

      for (let c = 0; c < housesInClusterRow; c++) {
        const houseD = 9.2 + ((seed + c) % 3) * 1.4; // 9.2m a 12.0m de largura em Z (coladas sem espaço!)
        const hz = curZ + houseD * 0.5;

        if (
          hz > maxZ ||
          stripCenterX > getFavelaEastBorderX(hz) - 14 ||
          getFavelaElevation(stripCenterX, hz) < 0.45 ||
          isOnRoadOrLandmark(stripCenterX, hz)
        ) {
          break;
        }

        // Duas casas coladas FUNDO COM FUNDO ao longo de X (zero espaço vazio entre elas!)
        const wFront = 10.2 + ((seed + c) % 2) * 1.2;
        const wBack = 10.2 + ((seed + c + 1) % 2) * 1.2;
        const xFront = stripCenterX + wBack * 0.5;
        const xBack = stripCenterX - wFront * 0.5;

        const floorsFront = 1 + ((seed + c * 3) % 4);
        const floorsBack = 2 + ((seed + c * 5) % 3); // Casa de trás geralmente mais alta subindo o morro!

        const resFront = createFavelaHouse(world, batcher, xFront, hz, wFront, houseD + 0.15, floorsFront, seed + c * 2, false);
        const resBack = createFavelaHouse(world, batcher, xBack, hz, wBack, houseD + 0.15, floorsBack, seed + c * 2 + 1, false);

        maxClusterTopY = Math.max(maxClusterTopY, resFront.topY, resBack.topY);
        minClusterBaseY = Math.min(minClusterBaseY, resFront.yBase, resBack.yBase);
        builtInCluster += 2;

        // Avança EXATAMENTE `houseD` (0.0m de espaço entre uma casa e a próxima: 100% parede com parede!)
        curZ += houseD;
        clusterEndZ = curZ;
      }

      if (builtInCluster > 0) {
        world.favelaCDDData.clustersCount++;
        const clusterDepthZ = clusterEndZ - clusterStartZ;
        const clusterMidZ = (clusterStartZ + clusterEndZ) * 0.5;
        const clusterWidthX = 21.5;

        // Registra 1 único Colisor AABB e 1 bloco de Minimapa para o Cluster inteiro de barracos colados!
        world.addCollider(stripCenterX, clusterMidZ, clusterWidthX, clusterDepthZ, maxClusterTopY, minClusterBaseY - 3.0);
        world.mapBuildings.push({
          x: stripCenterX,
          z: clusterMidZ,
          w: clusterWidthX,
          d: clusterDepthZ,
          height: maxClusterTopY - minClusterBaseY,
          color: seed % 4 === 0 ? '#dc2626' : '#c2410c'
        });

        // Planta um Poste de Madeira na quina do Beco com fios pretos ("Gatos de Luz") cruzando para o cluster vizinho!
        const poleX = stripCenterX + clusterWidthX * 0.5 + 1.4;
        const poleZ = clusterEndZ + 1.2;
        const poleY = getFavelaElevation(poleX, poleZ);
        if (poleY > 0.5) {
          batcher.addBox('wood_pole', 0.34, 8.2, 0.34, poleX, poleY + 3.8, poleZ);
          batcher.addBox('wire_black', 4.6, 0.09, 0.09, poleX + 2.1, poleY + 7.2, poleZ);
          batcher.addBox('wire_black', 0.09, 0.09, Math.min(28, clusterDepthZ), poleX, poleY + 7.4, clusterMidZ);
          batcher.addBox('cv_red', 0.55, 0.7, 0.14, poleX + 1.8, poleY + 6.8, poleZ);
        }

        // Deixa APENAS um Beco / Viela estreita de 3.8m a 4.6m de largura antes do próximo Cluster de barracos colados!
        const narrowAlleyWidth = 3.8 + (seed % 3) * 0.4;
        curZ += narrowAlleyWidth;
      } else {
        curZ += 5.0;
      }
    }
  }
}

/**
 * Em `WORLD_SCALE > 1`: move as âncoras dos clusters de barracos via `wsP(...)` preservando
 * estritamente o tamanho `1x` (largura, profundidade e altura) de cada barraco colado!
 */
function _buildScaledFavelaHouseClusters(world, batcher) {
  let seed = 1;
  const soccerPos = wsP(-605, 195);
  const bailePos = wsP(-715, -135);
  const miranteEastX = ws(-702) + 20;
  const summitPos = wsP(-865, -240);

  const isWorldSpotBlocked = (wx, wz) => {
    // 1. Corredor da Via Expressa / Cânion em Z = 0 + Muretas de Arrimo
    if (Math.abs(wz) < 34) return true;
    // 2. Campinho de Futebol da CDD (44x68m + arquibancadas)
    if (Math.abs(wx - soccerPos.x) < 40 && Math.abs(wz - soccerPos.z) < 48) return true;
    // 3. Quadra do Baile do CV + Paredão + Mirante de Chegada (`lm_cdd.spawn`)
    if (wx >= bailePos.x - 40 && wx <= miranteEastX && Math.abs(wz - bailePos.z) < 44) return true;
    // 4. Fortaleza do Barão Vermelho + Caixa d'Água Comunitária
    if (Math.abs(wx - summitPos.x) < 40 && wz >= summitPos.z - 68 && wz <= summitPos.z + 46) return true;
    // 5. Ladeiras Tortas e Escadões (largura 1x + margem para meia-largura do cluster)
    for (const ladeira of WINDING_LADEIRAS) {
      if (Math.abs(wz - getLadeiraZAtX(ladeira, wx)) < 12.5) return true;
    }
    // 6. Vielas Transversais Tortas Norte-Sul
    const uz = fromWs(wz);
    for (const baseDX of [-595, -695, -805]) {
      const vx = ws(baseDX) + ws(Math.sin(uz * 0.018) * 14 + Math.cos(uz * 0.009) * 8);
      if (Math.abs(wx - vx) < 15.5) return true;
    }
    // 7. Rodovias Regionais da Pangeia no Norte
    if (wz < ws(-1300) && getHighwayDistanceAt(wx, wz) < 32) return true;
    return false;
  };

  const minDesignZ = -1780;
  const maxDesignZ = 645;

  for (let designStripX = -552; designStripX >= -984; designStripX -= 25.2) {
    let designCurZ = minDesignZ;

    while (designCurZ < maxDesignZ) {
      if (designStripX > getFavelaEastBorderDesignX(designCurZ) - 14) {
        designCurZ += 12;
        continue;
      }

      seed++;
      const housesInClusterRow = 3 + (seed % 4);
      const rowSpecs = [];
      let totalClusterD = 0;
      for (let c = 0; c < housesInClusterRow; c++) {
        const houseD = 9.2 + ((seed + c) % 3) * 1.4;
        rowSpecs.push({ c, houseD });
        totalClusterD += houseD;
      }

      const designMidZ = designCurZ + totalClusterD * 0.5;
      const anchor = wsP(designStripX, designMidZ);

      let curLocalZ = anchor.z - totalClusterD * 0.5;
      let builtInCluster = 0;
      let clusterStartZ = Infinity;
      let clusterEndZ = -Infinity;
      let maxClusterTopY = 0;
      let minClusterBaseY = Infinity;

      for (let idx = 0; idx < rowSpecs.length; idx++) {
        const { c, houseD } = rowSpecs[idx];
        const hz = curLocalZ + houseD * 0.5;
        curLocalZ += houseD;

        if (
          hz > ws(maxDesignZ) ||
          anchor.x > getFavelaEastBorderX(hz) - 18 ||
          getFavelaElevation(anchor.x, hz) < 0.55 ||
          isWorldSpotBlocked(anchor.x, hz)
        ) {
          if (builtInCluster > 0) break;
          continue;
        }

        const wFront = 10.2 + ((seed + c) % 2) * 1.2;
        const wBack = 10.2 + ((seed + c + 1) % 2) * 1.2;
        const xFront = anchor.x + wBack * 0.5;
        const xBack = anchor.x - wFront * 0.5;
        if (getFavelaElevation(xFront, hz) < 0.35 || getFavelaElevation(xBack, hz) < 0.35) {
          if (builtInCluster > 0) break;
          continue;
        }

        const floorsFront = 1 + ((seed + c * 3) % 4);
        const floorsBack = 2 + ((seed + c * 5) % 3);

        const resFront = createFavelaHouse(world, batcher, xFront, hz, wFront, houseD + 0.15, floorsFront, seed + c * 2, false);
        const resBack = createFavelaHouse(world, batcher, xBack, hz, wBack, houseD + 0.15, floorsBack, seed + c * 2 + 1, false);

        clusterStartZ = Math.min(clusterStartZ, hz - houseD * 0.5);
        clusterEndZ = Math.max(clusterEndZ, hz + houseD * 0.5);
        maxClusterTopY = Math.max(maxClusterTopY, resFront.topY, resBack.topY);
        minClusterBaseY = Math.min(minClusterBaseY, resFront.yBase, resBack.yBase);
        builtInCluster += 2;
      }

      if (builtInCluster > 0) {
        world.favelaCDDData.clustersCount++;
        const clusterDepthZ = clusterEndZ - clusterStartZ;
        const clusterMidZ = (clusterStartZ + clusterEndZ) * 0.5;
        const clusterWidthX = 21.5;

        world.addCollider(anchor.x, clusterMidZ, clusterWidthX, clusterDepthZ, maxClusterTopY, minClusterBaseY - 3.0);
        world.mapBuildings.push({
          x: anchor.x,
          z: clusterMidZ,
          w: clusterWidthX,
          d: clusterDepthZ,
          height: maxClusterTopY - minClusterBaseY,
          color: seed % 4 === 0 ? '#dc2626' : '#c2410c'
        });

        const poleX = anchor.x + clusterWidthX * 0.5 + 1.4;
        const poleZ = clusterEndZ + 1.2;
        const poleY = getFavelaElevation(poleX, poleZ);
        if (poleY > 0.5 && Math.abs(poleZ) > 26) {
          batcher.addBox('wood_pole', 0.34, 8.2, 0.34, poleX, poleY + 3.8, poleZ);
          batcher.addBox('wire_black', 4.6, 0.09, 0.09, poleX + 2.1, poleY + 7.2, poleZ);
          batcher.addBox('wire_black', 0.09, 0.09, Math.min(28, clusterDepthZ), poleX, poleY + 7.4, clusterMidZ);
          batcher.addBox('cv_red', 0.55, 0.7, 0.14, poleX + 1.8, poleY + 6.8, poleZ);
        }

        const narrowAlleyWidth = 3.8 + (seed % 3) * 0.4;
        designCurZ += totalClusterD + narrowAlleyWidth;
      } else {
        designCurZ += 14.0;
      }
    }
  }
}
