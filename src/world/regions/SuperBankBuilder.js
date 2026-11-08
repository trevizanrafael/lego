import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  makeTranslatedBox
} from '../BuildingGenerator.js';

/**
 * SUPER BANCO CENTRAL MONUMENTAL (Quarteirão Nobre Exclusivo no Coração do Centro Financeiro)
 * - Localizado em X: 0, Z: -180 (frente voltada para a Grande Praça e Avenida Central Z = -117)
 * - Único prédio do jogo com interior 100% aberto sem tela de loading!
 * - Pé-direito altíssimo de 36 unidades livres (conforto total para câmera 3ª pessoa e voo interno)
 * - Exterior: Mármore Branco/Creme, Granito Escuro, Ouro Brilhante LEGO, Grande Escadaria Frontal,
 *   8 Colunas Clássicas Gigantes (base + capitel), 2 Estátuas Douradas LEGO nas pontas, Letreiro 3D
 *   "BANCO CENTRAL" em ouro, Terraço com Heliponto (H), Cofres de Ventilação e Claraboia de Vidro!
 * - Interior: Portas Duplas de Vidro/Ouro abertas, Piso de Mármore Quadriculado Reflexivo + Tapete Vermelho,
 *   2 Fileiras de Colunas Internas de Mármore quebráveis, Lustres Dourados no teto alto, Balcões de Atendimento
 *   com Guichês de Vidro, Computadores LEGO, Cadeiras de Espera, Divisórias de Cordão Vermelho, Corredor de
 *   Segurança com Grades, Feixes de Laser Vermelhos e Câmeras/Alarmes piscando!
 * - Cofre Forte no Fundo: Parede Blindada de Aço Escuro, Porta Circular Gigante com Volante Dourado e
 *   Engrenagens Grossas, Sala do Cofre com Prateleiras Metálicas, Barras de Ouro Brilhantes, Pilhas de
 *   Cédulas Verdes LEGO, Maletas Prateadas quebráveis, Caixas-Fortes nas paredes e dezenas de Studs
 *   Dourados, Azuis e Roxos!
 */
export function buildSuperBancoCentral(world) {
  const bx = 0;
  const bz = -180;
  const bw = 98;
  const bd = 88;
  const wallH = 36.0; // Pé-direito altíssimo de 36 unidades livres (entre 32 e 42 un)!
  const floorY = 0.36;
  const roofBottomY = floorY + wallH; // 36.36m
  const roofThickness = 2.8;
  const roofTopY = roofBottomY + roofThickness; // 39.16m

  // Calçada Nobre do Quarteirão do Banco (X: -54..+54, Z: -229..-131)
  world._addCityBlockSidewalk(bx, bz, 108, 98, LEGO_COLORS.sidewalk);

  // Materiais nobres compartilhados
  const marbleWhiteMat = getLegoMaterial(0xf8fafc, {
    roughness: 0.12,
    metalness: 0.06,
    clearcoat: 0.88
  });
  const marbleCreamMat = getLegoMaterial(0xfef3c7, {
    roughness: 0.18,
    metalness: 0.05,
    clearcoat: 0.72
  });
  const graniteDarkMat = getLegoMaterial(0x1e293b, {
    roughness: 0.24,
    metalness: 0.18,
    clearcoat: 0.55
  });
  const steelVaultMat = getLegoMaterial(0x0f172a, {
    roughness: 0.22,
    metalness: 0.65,
    clearcoat: 0.6
  });
  const silverMat = getLegoMaterial(LEGO_COLORS.silver, {
    roughness: 0.16,
    metalness: 0.78,
    clearcoat: 0.85
  });
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, {
    roughness: 0.14,
    metalness: 0.72,
    clearcoat: 0.88,
    emissive: 0xb45309,
    emissiveIntensity: 0.18
  });
  const glassSkyMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.42,
    clearcoat: 0.9
  });
  const redVelvetMat = getLegoMaterial(0xb91c1c, { roughness: 0.45 });
  const cashGreenMat = getLegoMaterial(0x16a34a, { roughness: 0.3 });

  // ============================================================================
  // 1. PISO DE MÁRMORE QUADRICULADO REFLEXIVO + TAPETE VERMELHO IMPERIAL
  // ============================================================================
  buildCheckeredMarbleFloorAndCarpet(world, bx, bz, bw, bd, floorY, marbleWhiteMat, marbleCreamMat, goldMat, redVelvetMat);

  // ============================================================================
  // 2. GRANDE ESCADARIA FRONTAL, 8 COLUNAS CLÁSSICAS GIGANTES & ESTÁTUAS DOURADAS
  // ============================================================================
  buildMonumentalExteriorAndFacade(
    world,
    bx,
    bz,
    bw,
    bd,
    wallH,
    floorY,
    marbleWhiteMat,
    marbleCreamMat,
    graniteDarkMat,
    goldMat,
    glassSkyMat,
    redVelvetMat
  );

  // ============================================================================
  // 3. TETO COM CLARABOIA DE VIDRO (OLHANDO PRO SAGUÃO), HELIPONTO (H) E VENTILAÇÃO
  // ============================================================================
  buildRoofSkylightHelipadAndHvac(
    world,
    bx,
    bz,
    bw,
    bd,
    roofBottomY,
    roofThickness,
    roofTopY,
    graniteDarkMat,
    goldMat,
    silverMat,
    glassSkyMat
  );

  // ============================================================================
  // 4. SAGUÃO INTERNO: COLUNAS QUEBRÁVEIS, LUSTRES, ATENDIMENTO & LASERS DE SEGURANÇA
  // ============================================================================
  buildGrandLobbyInteriorAndSecurity(
    world,
    bx,
    bz,
    wallH,
    floorY,
    roofBottomY,
    marbleWhiteMat,
    marbleCreamMat,
    graniteDarkMat,
    goldMat,
    silverMat,
    glassSkyMat,
    redVelvetMat
  );

  // ============================================================================
  // 5. COFRE FORTE GIGANTE NO FUNDO: PORTA CIRCULAR + SALA DE OURO, NOTAS E STUDS!
  // ============================================================================
  buildGiantVaultDoorAndTreasureRoom(
    world,
    bx,
    bz,
    bw,
    wallH,
    floorY,
    steelVaultMat,
    silverMat,
    goldMat,
    cashGreenMat
  );

  // Registra metadados para inspeção e testes automatizados
  world.superBankData = {
    x: bx,
    z: bz,
    width: bw,
    depth: bd,
    interiorHeight: wallH,
    roofTopY,
    frontColumnsCount: 8,
    goldenStatuesCount: 2,
    hasSkylight: true,
    hasRooftopHelipad: true
  };
}

/**
 * 1. PISO DE MÁRMORE QUADRICULADO REFLEXIVO + TAPETE VERMELHO CENTRAL
 */
function buildCheckeredMarbleFloorAndCarpet(world, bx, bz, bw, bd, floorY, marbleWhiteMat, marbleCreamMat, goldMat, redVelvetMat) {
  // Base principal de mármore branco polido
  const baseFloor = new THREE.Mesh(new THREE.BoxGeometry(bw, floorY, bd), marbleWhiteMat);
  baseFloor.position.set(bx, floorY * 0.5, bz);
  baseFloor.receiveShadow = true;
  world.scene.add(baseFloor);

  // Malha de ladrilhos quadriculados em mármore creme/dourado (mesclada em 1 único Mesh para 60 FPS!)
  const tileGeos = [];
  const tileSize = 6.0;
  for (let tx = -42; tx <= 42; tx += tileSize) {
    for (let tz = -216; tz <= -140; tz += tileSize) {
      const ix = Math.round((tx + 42) / tileSize);
      const iz = Math.round((tz + 216) / tileSize);
      if ((ix + iz) % 2 === 0) {
        tileGeos.push(makeTranslatedBox(tileSize - 0.15, 0.04, tileSize - 0.15, tx, floorY + 0.01, tz));
      }
    }
  }
  const checkeredTiles = new THREE.Mesh(mergeBufferGeometries(tileGeos), marbleCreamMat);
  checkeredTiles.receiveShadow = true;
  world.scene.add(checkeredTiles);

  // Tapete Vermelho Imperial com bordas de Ouro LEGO levando da Escadaria até a Porta do Cofre
  const carpetLen = 68.0;
  const carpetZ = bz + 3.0;
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.06, carpetLen), redVelvetMat);
  carpet.position.set(bx, floorY + 0.03, carpetZ);
  carpet.receiveShadow = true;
  world.scene.add(carpet);

  const trimGeos = [
    makeTranslatedBox(0.45, 0.07, carpetLen, bx - 5.2, floorY + 0.035, carpetZ),
    makeTranslatedBox(0.45, 0.07, carpetLen, bx + 5.2, floorY + 0.035, carpetZ)
  ];
  world.scene.add(new THREE.Mesh(mergeBufferGeometries(trimGeos), goldMat));
}

/**
 * 2. EXTERIOR MONUMENTAL: ESCADARIA, 8 COLUNAS GIGANTES, 2 ESTÁTUAS DOURADAS E PORTAS ABERTAS
 */
function buildMonumentalExteriorAndFacade(
  world,
  bx,
  bz,
  bw,
  bd,
  wallH,
  floorY,
  marbleWhiteMat,
  marbleCreamMat,
  graniteDarkMat,
  goldMat,
  glassSkyMat,
  redVelvetMat
) {
  const halfW = bw * 0.5; // 49
  const halfD = bd * 0.5; // 44
  const frontZ = bz + halfD; // -136
  const backZ = bz - halfD;  // -224

  // Paredes Externas Maciças de 36m de altura (Mármore Creme, Granito Escuro e Frisos de Ouro)
  // Parede Oeste (X = -47.5)
  world.addBuildingBox(bx - halfW + 1.5, bz, 3.0, wallH, bd, 0xfef3c7, {
    yBase: floorY,
    studs: false,
    mapColor: '#eab308',
    label: 'SUPER BANCO CENTRAL'
  });
  // Parede Leste (X = +47.5)
  world.addBuildingBox(bx + halfW - 1.5, bz, 3.0, wallH, bd, 0xfef3c7, {
    yBase: floorY,
    studs: false,
    mapColor: '#eab308'
  });
  // Parede Traseira Blindada (Z = -222.5)
  world.addBuildingBox(bx, backZ + 1.5, bw, wallH, 3.0, 0x1e293b, {
    yBase: floorY,
    studs: false,
    mapColor: '#eab308'
  });

  // Fachada Frontal Esquerda e Direita (Z = -137.5), deixando Portal Central Francamente Aberto de 24m (X: -12..+12)!
  world.addBuildingBox(bx - 30.5, frontZ - 1.5, 37, wallH, 3.0, 0xfef3c7, {
    yBase: floorY,
    studs: false,
    mapColor: '#eab308'
  });
  world.addBuildingBox(bx + 30.5, frontZ - 1.5, 37, wallH, 3.0, 0xfef3c7, {
    yBase: floorY,
    studs: false,
    mapColor: '#eab308'
  });

  // Lintel Superior Acima da Entrada Principal (de Y = 22.0m até Y = 36.36m -> 22m de vão livre na porta!)
  const portalHeight = 22.0;
  const lintelH = wallH - portalHeight; // 14.0m
  const lintel = createLegoBrick(24, lintelH, 3.4, LEGO_COLORS.gold, {
    metalness: 0.68,
    roughness: 0.16,
    studs: false
  });
  lintel.position.set(bx, floorY + portalHeight + lintelH * 0.5, frontZ - 1.5);
  world.scene.add(lintel);
  world.addCollider(bx, frontZ - 1.5, 24, 3.4, floorY + wallH, floorY + portalHeight);

  // Detalhamento Arquitetônico das Fachadas Externas (Plinto de Granito, Pilastras de Mármore e Cornijas de Ouro)
  const graniteGeos = [];
  const marbleExtGeos = [];
  const goldExtGeos = [];

  // Plinto Inferior de Granito Cinza-Escuro ao redor do Banco
  graniteGeos.push(
    makeTranslatedBox(3.6, 5.2, bd + 0.6, bx - halfW + 1.5, floorY + 2.6, bz),
    makeTranslatedBox(3.6, 5.2, bd + 0.6, bx + halfW - 1.5, floorY + 2.6, bz),
    makeTranslatedBox(bw + 0.6, 5.2, 3.6, bx, floorY + 2.6, backZ + 1.5),
    makeTranslatedBox(37.4, 5.2, 3.6, bx - 30.5, floorY + 2.6, frontZ - 1.5),
    makeTranslatedBox(37.4, 5.2, 3.6, bx + 30.5, floorY + 2.6, frontZ - 1.5)
  );

  // Pilastras e Janelões Blindados nas Fachadas Laterais (Oeste e Leste)
  for (let pz = bz - 32; pz <= bz + 32; pz += 16) {
    for (const side of [-1, 1]) {
      const wx = bx + side * (halfW + 0.25);
      marbleExtGeos.push(makeTranslatedBox(0.9, wallH - 6, 3.2, wx, floorY + 3 + (wallH - 6) * 0.5, pz));
      if (pz < bz + 32) {
        const winZ = pz + 8;
        graniteGeos.push(makeTranslatedBox(0.6, 20, 8.5, wx, floorY + 16, winZ));
        goldExtGeos.push(
          makeTranslatedBox(0.8, 0.7, 9.2, wx, floorY + 6.0, winZ),
          makeTranslatedBox(0.8, 0.9, 9.2, wx, floorY + 26.2, winZ),
          makeTranslatedBox(0.75, 20, 0.35, wx, floorY + 16, winZ - 2.2),
          makeTranslatedBox(0.75, 20, 0.35, wx, floorY + 16, winZ + 2.2)
        );
      }
    }
  }

  // Cornijas e Frisos Dourados Monumentais no Topo das 4 Fachadas (Y = 34m..39m)
  goldExtGeos.push(
    makeTranslatedBox(bw + 3.2, 1.4, bd + 3.2, bx, floorY + wallH - 0.5, bz),
    makeTranslatedBox(bw + 4.4, 1.6, bd + 4.4, bx, floorY + wallH + 2.4, bz),
    // Moldura Dourada Monumental ao redor do Portal de Entrada (24m x 22m)
    makeTranslatedBox(1.8, portalHeight + 1.5, 4.2, bx - 12.2, floorY + portalHeight * 0.5, frontZ - 1.2),
    makeTranslatedBox(1.8, portalHeight + 1.5, 4.2, bx + 12.2, floorY + portalHeight * 0.5, frontZ - 1.2),
    makeTranslatedBox(26.8, 2.2, 4.4, bx, floorY + portalHeight + 0.6, frontZ - 1.2)
  );

  // PORTAS DUPLAS GIGANTES DE VIDRO E OURO TOTALMENTE ABERTAS (Escancaradas nas laterais do vão!)
  for (const side of [-1, 1]) {
    const doorPivotX = bx + side * 11.2;
    const doorCenterZ = frontZ - 4.8;
    // Moldura de Ouro da Folha Gigante Aberta (20m de altura x 6.5m de profundidade aberta para dentro)
    goldExtGeos.push(
      makeTranslatedBox(0.55, 20.0, 0.55, doorPivotX, floorY + 10.0, frontZ - 1.5),
      makeTranslatedBox(0.55, 20.0, 0.55, doorPivotX, floorY + 10.0, frontZ - 8.0),
      makeTranslatedBox(0.55, 0.65, 6.8, doorPivotX, floorY + 19.8, doorCenterZ),
      makeTranslatedBox(0.55, 0.65, 6.8, doorPivotX, floorY + 10.0, doorCenterZ),
      makeTranslatedBox(0.55, 0.65, 6.8, doorPivotX, floorY + 0.4, doorCenterZ),
      // Puxador Cilíndrico Vertical de Ouro
      makeTranslatedBox(0.85, 4.5, 0.35, doorPivotX - side * 0.35, floorY + 5.0, frontZ - 7.0)
    );
    const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 19.2, 6.2), glassSkyMat);
    doorGlass.position.set(doorPivotX, floorY + 10.0, doorCenterZ);
    world.scene.add(doorGlass);
  }

  // GRANDE ESCADARIA FRONTAL (Subindo da Calçada Z = -130.2 até o Pórtico Z = -136.0)
  // Degraus largos e suaves (sem colisor alto para o boneco subir caminhando suavemente!)
  const stairsWidth = 54.0;
  for (let s = 0; s < 5; s++) {
    const stepD = 6.2 - s * 1.1;
    const stepY = 0.06 + s * 0.06;
    const stepZ = frontZ + 2.8 - s * 0.55;
    marbleExtGeos.push(makeTranslatedBox(stairsWidth, 0.08, stepD, bx, stepY, stepZ));
    goldExtGeos.push(makeTranslatedBox(stairsWidth + 0.2, 0.04, 0.18, bx, stepY + 0.03, stepZ + stepD * 0.5));
  }
  const stairsCarpet = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.09, 6.6), redVelvetMat);
  stairsCarpet.position.set(bx, 0.33, frontZ + 2.6);
  world.scene.add(stairsCarpet);

  // ============================================================================
  // 8 COLUNAS CLÁSSICAS GIGANTES NA FACHADA (Base Quadrada + Fuste Cilíndrico + Capitel Dourado!)
  // ============================================================================
  const colXPositions = [-41, -31, -21, -13.5, 13.5, 21, 31, 41];
  const colZ = frontZ + 2.2; // Z = -133.8
  const colShaftH = wallH - 3.6;

  for (const cx of colXPositions) {
    // 1. Base Clássica Escalonada (Granito Escuro + Mármore + Anel Dourado)
    graniteGeos.push(makeTranslatedBox(3.8, 1.4, 3.8, bx + cx, floorY + 0.7, colZ));
    marbleExtGeos.push(makeTranslatedBox(3.3, 0.8, 3.3, bx + cx, floorY + 1.8, colZ));
    goldExtGeos.push(makeTranslatedBox(3.0, 0.45, 3.0, bx + cx, floorY + 2.4, colZ));

    // 2. Fuste Cilíndrico Gigante de Mármore Branco
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.52, colShaftH, 20), marbleWhiteMat);
    shaft.position.set(bx + cx, floorY + 2.6 + colShaftH * 0.5, colZ);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    world.scene.add(shaft);

    // 3. Capitel Clássico Coríntio/Jônico em Ouro Brilhante e Mármore no Topo
    const capY = floorY + wallH - 1.2;
    goldExtGeos.push(
      makeTranslatedBox(3.2, 0.9, 3.2, bx + cx, capY, colZ),
      makeTranslatedBox(3.9, 0.65, 3.9, bx + cx, capY + 0.75, colZ)
    );
    marbleExtGeos.push(makeTranslatedBox(3.6, 0.5, 3.6, bx + cx, capY + 1.25, colZ));

    world.addCollider(bx + cx, colZ, 3.2, 3.2, floorY + wallH, floorY);
  }

  // Frontão Clássico / Entablamento Monumental no Topo da Fachada Frontal (Z = -133.8)
  marbleExtGeos.push(makeTranslatedBox(92.0, 3.4, 5.2, bx, floorY + wallH + 1.5, colZ - 1.2));
  goldExtGeos.push(
    makeTranslatedBox(93.0, 0.8, 5.6, bx, floorY + wallH + 3.4, colZ - 1.2),
    // Frontão Escalonado Central (Pedimento Clássico) acima do Letreiro
    makeTranslatedBox(54.0, 2.2, 4.2, bx, floorY + wallH + 9.8, colZ - 1.0),
    makeTranslatedBox(38.0, 2.0, 4.2, bx, floorY + wallH + 11.8, colZ - 1.0),
    makeTranslatedBox(20.0, 2.0, 4.2, bx, floorY + wallH + 13.8, colZ - 1.0),
    makeTranslatedBox(6.0, 2.4, 4.2, bx, floorY + wallH + 15.8, colZ - 1.0)
  );

  // ============================================================================
  // 2 ESTÁTUAS DOURADAS DE LEGO NAS PONTAS DA ESCADARIA FRONTAL!
  // ============================================================================
  for (const side of [-1, 1]) {
    const sx = bx + side * 27.5;
    const sz = frontZ + 4.8; // Z = -131.2 (nas duas pontas da Grande Escadaria Frontal!)
    buildGoldenLegoGuardianStatue(world, sx, floorY, sz, side, graniteGeos, marbleExtGeos, goldExtGeos, goldMat);
  }

  // Adiciona as malhas externas mescladas à cena
  const graniteMesh = new THREE.Mesh(mergeBufferGeometries(graniteGeos), graniteDarkMat);
  graniteMesh.castShadow = true;
  graniteMesh.receiveShadow = true;
  const marbleExtMesh = new THREE.Mesh(mergeBufferGeometries(marbleExtGeos), marbleWhiteMat);
  marbleExtMesh.castShadow = true;
  marbleExtMesh.receiveShadow = true;
  const goldExtMesh = new THREE.Mesh(mergeBufferGeometries(goldExtGeos), goldMat);
  goldExtMesh.castShadow = true;
  goldExtMesh.receiveShadow = true;
  world.scene.add(graniteMesh, marbleExtMesh, goldExtMesh);

  // ============================================================================
  // LETREIRO LUMINOSO 3D EM OURO NO TOPO DA FACHADA: "BANCO CENTRAL"
  // ============================================================================
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 192;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#090a0d';
  sctx.fillRect(0, 0, 1024, 192);
  sctx.strokeStyle = '#facc15';
  sctx.lineWidth = 14;
  sctx.strokeRect(10, 10, 1004, 172);
  sctx.fillStyle = '#facc15';
  sctx.font = '900 86px "Chakra Petch", Arial, sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('BANCO CENTRAL ', 512, 124);
  const signTex = new THREE.CanvasTexture(signCanvas);

  const signY = floorY + wallH + 6.2;
  const signZ = colZ + 0.6;
  // Caixa 3D de Ouro Brilhante + Placa Luminosa Frontal "BANCO CENTRAL"
  const signFrame = createLegoBrick(48.0, 6.6, 1.8, LEGO_COLORS.gold, {
    metalness: 0.75,
    roughness: 0.14,
    studStep: 2.0
  });
  signFrame.position.set(bx, signY, signZ - 0.5);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(46.4, 5.6, 0.5),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  signBoard.position.set(bx, signY, signZ + 0.5);
  world.scene.add(signFrame, signBoard);

  // Registra o Super Banco Central no Mapa 2D [M] e Radar
  world.mapBuildings.push({
    x: bx,
    z: bz,
    w: bw,
    d: bd,
    height: floorY + wallH + 16,
    styleKey: 'black_granite_gold',
    color: '#facc15',
    label: 'BANCO CENTRAL'
  });
}

/**
 * Constrói uma Estátua Monumental Dourada de LEGO (Guardião Imperial com Cetro e Escudo)
 */
function buildGoldenLegoGuardianStatue(world, sx, floorY, sz, side, graniteGeos, marbleExtGeos, goldExtGeos, goldMat) {
  // Pedestal Clássico de Granito Escuro, Mármore e Ouro (4.8m de altura)
  graniteGeos.push(makeTranslatedBox(4.8, 2.2, 4.8, sx, floorY + 1.1, sz));
  marbleExtGeos.push(makeTranslatedBox(4.0, 2.0, 4.0, sx, floorY + 3.2, sz));
  goldExtGeos.push(makeTranslatedBox(4.4, 0.5, 4.4, sx, floorY + 4.45, sz));

  const baseStatueY = floorY + 4.7;
  // Pernas Douradas LEGO
  goldExtGeos.push(
    makeTranslatedBox(1.1, 2.8, 1.2, sx - 0.65, baseStatueY + 1.4, sz),
    makeTranslatedBox(1.1, 2.8, 1.2, sx + 0.65, baseStatueY + 1.4, sz),
    // Quadril e Torso Imperial Dourado
    makeTranslatedBox(2.6, 0.7, 1.4, sx, baseStatueY + 3.15, sz),
    makeTranslatedBox(3.0, 3.2, 1.6, sx, baseStatueY + 5.1, sz),
    // Ombreiras e Braços Articulados Dourados
    makeTranslatedBox(0.95, 2.8, 1.1, sx - 1.95, baseStatueY + 5.0, sz + 0.3),
    makeTranslatedBox(0.95, 2.8, 1.1, sx + 1.95, baseStatueY + 5.0, sz + 0.3),
    // Escudo de Ouro na mão interna + Cetro Solar Dourado alto na mão externa!
    makeTranslatedBox(2.0, 3.2, 0.35, sx - side * 1.8, baseStatueY + 4.6, sz + 1.1),
    makeTranslatedBox(0.32, 7.5, 0.32, sx + side * 1.95, baseStatueY + 6.8, sz + 0.9),
    makeTranslatedBox(1.1, 1.1, 1.1, sx + side * 1.95, baseStatueY + 10.8, sz + 0.9)
  );

  // Cabeça Cilíndrica Clássica de LEGO em Ouro Brilhante + Pino (Stud) Superior!
  const headCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.9, 18), goldMat);
  headCyl.position.set(sx, baseStatueY + 7.75, sz);
  const headStud = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 16), goldMat);
  headStud.position.set(sx, baseStatueY + 8.9, sz);
  world.scene.add(headCyl, headStud);

  world.addCollider(sx, sz, 4.8, 4.8, baseStatueY + 11.0, floorY);
}

/**
 * 3. TERRAÇO NO TOPO DO BANCO: CLARABOIA DE VIDRO (OLHANDO PRO SAGUÃO), HELIPONTO (H) E VENTILAÇÃO
 */
function buildRoofSkylightHelipadAndHvac(
  world,
  bx,
  bz,
  bw,
  bd,
  roofBottomY,
  roofThickness,
  roofTopY,
  graniteDarkMat,
  goldMat,
  silverMat,
  glassSkyMat
) {
  // O Teto possui uma ABERTURA CENTRAL REAL de 28m x 26m (X: -14..+14, Z: -188..-162)
  // coberta pela Claraboia de Vidro, permitindo olhar do terraço direto para o saguão lá embaixo!
  const skyMinX = -14;
  const skyMaxX = 14;
  const skyMinZ = -188;
  const skyMaxZ = -162;

  const roofPieces = [
    // Faixa Oeste do Teto (X: -49..-14, largura 35m, profundidade 88m)
    { x: -31.5, z: bz, w: 35, d: bd },
    // Faixa Leste do Teto (X: +14..+49, largura 35m, profundidade 88m)
    { x: 31.5, z: bz, w: 35, d: bd },
    // Faixa Sul/Frontal entre o vão (X: -14..+14, Z: -162..-136, profundidade 26m)
    { x: 0, z: -149, w: 28, d: 26 },
    // Faixa Norte/Fundo entre o vão (X: -14..+14, Z: -224..-188, profundidade 36m)
    { x: 0, z: -206, w: 28, d: 36 }
  ];

  for (const rp of roofPieces) {
    const slab = createLegoBrick(rp.w, roofThickness, rp.d, LEGO_COLORS.darkGrey, { studStep: 3.5 });
    slab.position.set(rp.x, roofBottomY + roofThickness * 0.5, rp.z);
    world.scene.add(slab);
    world.addCollider(rp.x, rp.z, rp.w, rp.d, roofTopY, roofBottomY - 0.2);
  }

  // CLARABOIA DE VIDRO MONUMENTAL NO CENTRO DO TETO (X = 0, Z = -175, 28m x 26m)
  const skyCenterZ = (skyMinZ + skyMaxZ) * 0.5; // -175
  const skyW = skyMaxX - skyMinX; // 28m
  const skyD = skyMaxZ - skyMinZ; // 26m

  // Vidro translúcido da Claraboia (sustenta o boneco se ele caminhar sobre o vidro, mas deixa ver todo o saguão!)
  const skylightGlass = new THREE.Mesh(new THREE.BoxGeometry(skyW, 0.45, skyD), glassSkyMat);
  skylightGlass.position.set(bx, roofTopY + 0.35, skyCenterZ);
  world.scene.add(skylightGlass);
  world.addCollider(bx, skyCenterZ, skyW, skyD, roofTopY + 0.6, roofTopY - 0.4);

  // Treliça e Arcos Dourados da Claraboia de Vidro
  const skyFrameGeos = [
    makeTranslatedBox(skyW + 1.6, 1.2, 1.0, bx, roofTopY + 0.6, skyMinZ),
    makeTranslatedBox(skyW + 1.6, 1.2, 1.0, bx, roofTopY + 0.6, skyMaxZ),
    makeTranslatedBox(1.0, 1.2, skyD + 1.6, skyMinX, roofTopY + 0.6, skyCenterZ),
    makeTranslatedBox(1.0, 1.2, skyD + 1.6, skyMaxX, roofTopY + 0.6, skyCenterZ)
  ];
  for (let gx = skyMinX + 7; gx < skyMaxX; gx += 7) {
    skyFrameGeos.push(makeTranslatedBox(0.55, 1.4, skyD, gx, roofTopY + 0.75, skyCenterZ));
  }
  for (let gz = skyMinZ + 6.5; gz < skyMaxZ; gz += 6.5) {
    skyFrameGeos.push(makeTranslatedBox(skyW, 1.4, 0.55, bx, roofTopY + 0.75, gz));
  }
  world.scene.add(new THREE.Mesh(mergeBufferGeometries(skyFrameGeos), goldMat));

  // HELIPONTO DEMARCADO ("H") NO TERRAÇO OESTE (X = -31, Z = -180)
  const heliX = -31.5;
  const heliZ = -180;
  const heliPad = createLegoBrick(24, 0.6, 24, 0x334155, { studs: false });
  heliPad.position.set(heliX, roofTopY + 0.3, heliZ);
  world.scene.add(heliPad);
  world.addCollider(heliX, heliZ, 24, 24, roofTopY + 0.6, roofTopY);

  const heliRing = new THREE.Mesh(
    new THREE.RingGeometry(8.2, 9.4, 28),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
  );
  heliRing.rotation.x = -Math.PI / 2;
  heliRing.position.set(heliX, roofTopY + 0.64, heliZ);
  world.scene.add(heliRing);

  // Letra "H" em blocos amarelos brilhantes no centro do Heliponto
  const hMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const hGeos = [
    makeTranslatedBox(1.8, 0.12, 9.5, heliX - 3.2, roofTopY + 0.64, heliZ),
    makeTranslatedBox(1.8, 0.12, 9.5, heliX + 3.2, roofTopY + 0.64, heliZ),
    makeTranslatedBox(6.4, 0.12, 1.8, heliX, roofTopY + 0.64, heliZ)
  ];
  world.scene.add(new THREE.Mesh(mergeBufferGeometries(hGeos), hMat));

  // COFRES E UNIDADES DE VENTILAÇÃO (HVAC) NO TERRAÇO LESTE (X = +31, Z = -165..-198)
  const hvacGeos = [];
  for (const hz of [-160, -178, -196]) {
    hvacGeos.push(
      makeTranslatedBox(10.0, 4.2, 8.0, 31.5, roofTopY + 2.1, hz),
      makeTranslatedBox(3.2, 1.2, 3.2, 29.0, roofTopY + 4.8, hz),
      makeTranslatedBox(3.2, 1.2, 3.2, 34.0, roofTopY + 4.8, hz),
      // Dutos metálicos conectando as centrais de ventilação
      makeTranslatedBox(1.8, 1.6, 18.0, 31.5, roofTopY + 1.4, hz + 5.0)
    );
    world.addCollider(31.5, hz, 10.2, 8.2, roofTopY + 5.2, roofTopY);
  }
  const hvacMesh = new THREE.Mesh(mergeBufferGeometries(hvacGeos), silverMat);
  hvacMesh.castShadow = true;
  world.scene.add(hvacMesh);
}

/**
 * 4. GRANDE SAGUÃO INTERNO: 2 FILEIRAS DE COLUNAS QUEBRÁVEIS, LUSTRES ALTOS,
 * GUICHÊS DE ATENDIMENTO COM COMPUTADORES, CADEIRAS, CORDÃO VERMELHO E CORREDOR DE LASERS!
 */
function buildGrandLobbyInteriorAndSecurity(
  world,
  bx,
  bz,
  wallH,
  floorY,
  roofBottomY,
  marbleWhiteMat,
  marbleCreamMat,
  graniteDarkMat,
  goldMat,
  silverMat,
  glassSkyMat,
  redVelvetMat
) {
  // ============================================================================
  // 4A. DUAS FILEIRAS DE COLUNAS INTERNAS DE MÁRMORE QUEBRÁVEIS (8 Colunas no Saguão!)
  // ============================================================================
  const internalColCoords = [
    [-16.5, -146], [16.5, -146],
    [-16.5, -158], [16.5, -158],
    [-16.5, -170], [16.5, -170],
    [-16.5, -182], [16.5, -182]
  ];
  const intColH = 26.0;

  for (const [px, pz] of internalColCoords) {
    const colGroup = new THREE.Group();
    colGroup.position.set(px, floorY, pz);

    const base = createLegoBrick(3.4, 1.4, 3.4, LEGO_COLORS.gold, { studStep: 1.0 });
    base.position.y = 0.7;
    const shaft = createLegoBrick(2.6, intColH - 2.8, 2.6, LEGO_COLORS.white, { studStep: 1.1 });
    shaft.position.y = 1.4 + (intColH - 2.8) * 0.5;
    const capital = createLegoBrick(3.6, 1.4, 3.6, LEGO_COLORS.gold, { studStep: 1.0 });
    capital.position.y = intColH - 0.7;

    colGroup.add(base, shaft, capital);
    world.scene.add(colGroup);

    const col = world.addCollider(px, pz, 3.2, 3.2, floorY + intColH, floorY);
    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: colGroup,
        type: 'newsstand',
        hp: 45,
        radius: 2.3,
        height: intColH,
        colliders: [col],
        debrisColors: [LEGO_COLORS.white, LEGO_COLORS.gold, LEGO_COLORS.lightGrey],
        studDrops: { silver: 6, gold: 8, blue: 2, purple: 0 },
        groundY: floorY
      });
    }
  }

  // ============================================================================
  // 4B. GRANDES LUSTRES DOURADOS PENDURADOS NO TETO ALTO (Y = 30.5m — 30m livres abaixo!)
  // ============================================================================
  const crystalMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const chandelierPositions = [
    [-16.5, -152], [16.5, -152],
    [-16.5, -176], [16.5, -176],
    [0, -144],     [0, -193]
  ];
  for (const [cx, cz] of chandelierPositions) {
    const chandGroup = new THREE.Group();
    chandGroup.position.set(cx, roofBottomY - 5.8, cz); // Y = 30.56m!

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.6, 8), goldMat);
    chain.position.y = 2.8;
    const ringOuter = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.75, 20), goldMat);
    const ringInner = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.2, 16), crystalMat);
    ringInner.position.y = -0.5;
    chandGroup.add(chain, ringOuter, ringInner);
    world.scene.add(chandGroup);
  }

  // ============================================================================
  // 4C. ÁREA DE ATENDIMENTO NAS LATERAIS: BALCÕES, GUICHÊS DE VIDRO, COMPUTADORES LEGO,
  //     CADEIRAS DE ESPERA E DIVISÓRIAS DE CORDÃO VERMELHO!
  // ============================================================================
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const darkPcMat = getLegoMaterial(LEGO_COLORS.black);

  const counterSpecs = [
    { x: -34, z: -152, side: -1 },
    { x: 34,  z: -152, side: 1 },
    { x: -34, z: -174, side: -1 },
    { x: 34,  z: -174, side: 1 }
  ];

  for (const cfg of counterSpecs) {
    const tellerGroup = new THREE.Group();
    tellerGroup.position.set(cfg.x, floorY, cfg.z);

    // Base longa de Madeira Nobre e Topo de Mármore Branco (16m de comprimento!)
    const woodBase = createLegoBrick(3.4, 1.3, 16.0, LEGO_COLORS.brown, { studs: false });
    woodBase.position.y = 0.65;
    const marbleTop = createLegoBrick(3.8, 0.3, 16.4, LEGO_COLORS.white, { studStep: 1.2 });
    marbleTop.position.y = 1.45;
    tellerGroup.add(woodBase, marbleTop);

    // Guichês de Vidro Blindado com divisórias douradas + 3 Computadores LEGO por balcão!
    for (const gz of [-5.2, 0, 5.2]) {
      const glassPane = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.1, 4.4), glassSkyMat);
      glassPane.position.set(-cfg.side * 1.1, 2.65, gz);
      const goldPost = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.3, 0.35), goldMat);
      goldPost.position.set(-cfg.side * 1.1, 2.65, gz + 2.35);

      // Computador LEGO (Monitor + Tela Luminosa + Teclado)
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.95, 1.35), darkPcMat);
      monitor.position.set(cfg.side * 0.2, 2.15, gz);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.75, 1.15), screenMat);
      screen.position.set(cfg.side * 0.25, 2.15, gz);
      const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.1), darkPcMat);
      keyboard.position.set(cfg.side * 0.85, 1.66, gz);

      tellerGroup.add(glassPane, goldPost, monitor, screen, keyboard);
    }

    world.scene.add(tellerGroup);
    const col = world.addCollider(cfg.x, cfg.z, 3.8, 16.4, floorY + 3.8, floorY);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: tellerGroup,
        type: 'newsstand',
        hp: 35,
        radius: 5.5,
        height: 3.8,
        colliders: [col],
        debrisColors: [LEGO_COLORS.brown, LEGO_COLORS.white, LEGO_COLORS.gold, 0x38bdf8],
        studDrops: { silver: 6, gold: 7, blue: 2, purple: 0 },
        groundY: floorY
      });
    }
  }

  // Cadeiras / Poltronas de Espera nas Laterais do Saguão (X = -25 e X = +25)
  const chairGeosRed = [];
  const chairGeosGold = [];
  for (const side of [-1, 1]) {
    const chX = side * 25.0;
    for (const chZ of [-148, -155, -170, -177]) {
      chairGeosGold.push(makeTranslatedBox(1.8, 0.35, 4.2, chX, floorY + 0.18, chZ));
      chairGeosRed.push(
        makeTranslatedBox(1.6, 0.45, 4.0, chX, floorY + 0.55, chZ),
        makeTranslatedBox(0.45, 1.1, 4.0, chX + side * 0.6, floorY + 1.2, chZ)
      );
      world.addCollider(chX, chZ, 1.8, 4.2, floorY + 1.8, floorY);
    }
  }
  world.scene.add(
    new THREE.Mesh(mergeBufferGeometries(chairGeosRed), redVelvetMat),
    new THREE.Mesh(mergeBufferGeometries(chairGeosGold), goldMat)
  );

  // Divisórias de Cordão Vermelho (Stanchions Quebráveis) organizando a fila do Saguão!
  const stanchionCoords = [
    [-8.5, -148], [8.5, -148],
    [-8.5, -162], [8.5, -162],
    [-8.5, -176], [8.5, -176]
  ];
  for (const [sx, sz] of stanchionCoords) {
    const stGroup = new THREE.Group();
    stGroup.position.set(sx, floorY, sz);

    const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 1.3, 12), goldMat);
    postA.position.set(0, 0.65, -2.2);
    const postB = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.25, 1.3, 12), goldMat);
    postB.position.set(0, 0.65, 2.2);
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.4), redVelvetMat);
    rope.position.set(0, 1.05, 0);

    stGroup.add(postA, postB, rope);
    world.scene.add(stGroup);
    const col = world.addCollider(sx, sz, 0.7, 4.6, floorY + 1.35, floorY);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: stGroup,
        type: 'fence',
        hp: 12,
        radius: 2.3,
        height: 1.35,
        colliders: [col],
        debrisColors: [LEGO_COLORS.gold, LEGO_COLORS.red],
        studDrops: { silver: 4, gold: 2, blue: 0, purple: 0 },
        groundY: floorY
      });
    }
  }

  // ============================================================================
  // 4D. SISTEMA DE SEGURANÇA ANTES DO COFRE (Corredor com Grades Laterais, Feixes de
  //     Laser Vermelhos Horizontais + Câmeras e Alarmes Vermelhos Piscando!)
  // ============================================================================
  const secCorridorZ = -193.5; // Entre Z = -188 e Z = -199 (antes da porta do cofre em Z = -200)
  const secBarGeos = [];
  const secGoldGeos = [];

  for (const side of [-1, 1]) {
    const gx = side * 9.5;
    // Grades metálicas laterais formando o Corredor Blindado de Segurança até a Porta do Cofre
    secGoldGeos.push(
      makeTranslatedBox(0.6, 8.5, 0.6, gx, floorY + 4.25, -187.5),
      makeTranslatedBox(0.6, 8.5, 0.6, gx, floorY + 4.25, -199.0),
      makeTranslatedBox(0.5, 0.5, 12.0, gx, floorY + 8.3, secCorridorZ),
      makeTranslatedBox(0.5, 0.5, 12.0, gx, floorY + 4.2, secCorridorZ)
    );
    for (let bzBar = -188.5; bzBar >= -198.5; bzBar -= 1.25) {
      secBarGeos.push(makeTranslatedBox(0.24, 8.2, 0.24, gx, floorY + 4.1, bzBar));
    }
    world.addCollider(gx, secCorridorZ, 0.8, 12.0, floorY + 8.5, floorY);
  }
  world.scene.add(
    new THREE.Mesh(mergeBufferGeometries(secBarGeos), silverMat),
    new THREE.Mesh(mergeBufferGeometries(secGoldGeos), goldMat)
  );

  // Feixes de Laser Vermelhos Horizontais atravessando o corredor antes do Cofre!
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff1133 });
  for (const lz of [-190.5, -194.0, -197.0]) {
    for (const ly of [1.1, 2.3, 3.6, 5.0]) {
      const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 18.4, 8), laserMat);
      laserBeam.rotation.z = Math.PI / 2;
      laserBeam.position.set(bx, floorY + ly, lz);
      world.scene.add(laserBeam);
    }
  }

  // Câmeras de Vigilância 3D + Sirenes/Alarmes Vermelhos Giratórios Piscando nas paredes!
  const alarmGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  for (const side of [-1, 1]) {
    const camX = side * 9.2;
    const camZ = -188.0;
    const camBody = createLegoBrick(0.9, 0.7, 1.6, LEGO_COLORS.white, { studs: false });
    camBody.position.set(camX, floorY + 8.8, camZ);
    camBody.rotation.y = side * 0.45;
    camBody.rotation.x = 0.35;
    world.scene.add(camBody);

    // Giroflex / Alarme Vermelho Giratório acima da entrada do corredor e ao lado do Cofre
    for (const az of [-188.0, -198.8]) {
      const alarmGroup = new THREE.Group();
      alarmGroup.position.set(side * 8.8, floorY + 9.6, az);
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.45), alarmGlowMat);
      alarmGroup.add(beacon);
      world.scene.add(alarmGroup);
      world.rotatingElements.push({ mesh: alarmGroup, axis: 'y', speed: 6.5 });
    }
  }
}

/**
 * 5. PAREDE BLINDADA, PORTA CIRCULAR GIGANTE DO COFRE & SALA DO TESOURO!
 */
function buildGiantVaultDoorAndTreasureRoom(
  world,
  bx,
  bz,
  bw,
  wallH,
  floorY,
  steelVaultMat,
  silverMat,
  goldMat,
  cashGreenMat
) {
  const vaultWallZ = -200.0; // Z = -200 (exigido pelos testes!)

  // Parede Blindada de Aço Escuro dividindo o Saguão da Sala Forte do Cofre (36m de altura!)
  world.addBuildingBox(bx - 27.0, vaultWallZ, 41.0, wallH, 2.8, LEGO_COLORS.charcoal, {
    yBase: floorY,
    studs: false,
    registerMap: false
  });
  world.addBuildingBox(bx + 27.0, vaultWallZ, 41.0, wallH, 2.8, LEGO_COLORS.charcoal, {
    yBase: floorY,
    studs: false,
    registerMap: false
  });
  // Bloco blindado superior acima da Porta Circular do Cofre (de Y = 12.0m até Y = 36.36m)
  const headerH = wallH - 11.6;
  const vaultHeader = createLegoBrick(14.0, headerH, 2.8, LEGO_COLORS.charcoal, { studs: false });
  vaultHeader.position.set(bx, floorY + 11.6 + headerH * 0.5, vaultWallZ);
  world.scene.add(vaultHeader);
  world.addCollider(bx, vaultWallZ, 14.0, 2.8, floorY + wallH, floorY + 11.6);

  // Moldura Circular Permanente de Aço e Ouro + Dobradiça Colossal na Parede do Cofre
  const portalFrameRing = new THREE.Mesh(new THREE.TorusGeometry(5.8, 0.65, 14, 32), goldMat);
  portalFrameRing.position.set(bx, floorY + 5.8, vaultWallZ + 1.45);
  const hingePillar = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 10.5, 16), silverMat);
  hingePillar.position.set(bx + 6.4, floorY + 5.6, vaultWallZ + 1.6);
  world.scene.add(portalFrameRing, hingePillar);

  // ============================================================================
  // A PORTA CIRCULAR GIGANTE DO COFRE (Destrutível: type = 'bank_vault_door' em Z = -200!)
  // Equipada com Disco de Aço Prateado, Volante de Tranca Dourado e Engrenagens Grossas!
  // ============================================================================
  const vaultDoorGroup = new THREE.Group();
  vaultDoorGroup.position.set(bx, floorY, vaultWallZ);

  // Disco principal blindado de 10.8m de diâmetro
  const doorDisc = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 1.4, 32), silverMat);
  doorDisc.rotation.x = Math.PI / 2;
  doorDisc.position.y = 5.6;
  vaultDoorGroup.add(doorDisc);

  // Anel de Ouro e 4 Engrenagens Grossas Aparentes na face da Porta Circular!
  const gearPositions = [
    [-2.3, 7.4], [2.3, 7.4],
    [-2.3, 3.8], [2.3, 3.8]
  ];
  for (const [gx, gy] of gearPositions) {
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.65, 12), goldMat);
    gear.rotation.x = Math.PI / 2;
    gear.position.set(gx, gy, 0.15);
    vaultDoorGroup.add(gear);
  }

  // Volante Central de Tranca Dourado com 8 Raios e Travas Cilíndricas
  const goldWheel = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.8, 20), goldMat);
  goldWheel.rotation.x = Math.PI / 2;
  goldWheel.position.set(0, 5.6, 0.25);
  vaultDoorGroup.add(goldWheel);

  for (let r = 0; r < 4; r++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.42, 1.75), goldMat);
    spoke.position.set(0, 5.6, 0.2);
    spoke.rotation.z = (r / 4) * Math.PI;
    vaultDoorGroup.add(spoke);
  }

  world.scene.add(vaultDoorGroup);
  const vaultCol = world.addCollider(bx, vaultWallZ, 10.8, 1.8, floorY + 11.2, floorY);

  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: vaultDoorGroup,
      type: 'bank_vault_door',
      hp: 75,
      radius: 5.5,
      height: 11.0,
      colliders: [vaultCol],
      debrisColors: [LEGO_COLORS.silver, LEGO_COLORS.gold, LEGO_COLORS.charcoal],
      studDrops: { silver: 0, gold: 14, blue: 10, purple: 5 },
      groundY: floorY,
      goldOnly: false
    });
  }

  // ============================================================================
  // DENTRO DA SALA DO COFRE (Z = -202 a Z = -221, X = -45 a +45):
  // 1. Caixas-Fortes nas Paredes (Safe Deposit Boxes)
  // 2. Prateleiras Metálicas cheias de Barras de Ouro Brilhantes e Pilhas de Cédulas Verdes
  // 3. 4 Grandes Pallets de Barras de Ouro LEGO (Z = -211) + 2 Pallets Extras (Z = -217)
  // 4. 8 Maletas Prateadas Quebráveis
  // 5. 36 Studs Dourados, Azuis e Roxos girando prontos para coletar!
  // ============================================================================
  const shelfSteelGeos = [];
  const goldBarGeos = [];
  const cashStackGeos = [];

  // 1. Caixas-Fortes nas Paredes Laterais da Sala do Cofre (X = -44.8 e X = +44.8)
  for (const side of [-1, 1]) {
    const wallX = side * 44.8;
    shelfSteelGeos.push(makeTranslatedBox(1.2, 14.0, 18.0, wallX, floorY + 7.0, -211.0));
    for (let rowY = 1.5; rowY <= 12.5; rowY += 2.2) {
      for (let colZ = -218.5; colZ <= -203.5; colZ += 2.5) {
        goldBarGeos.push(makeTranslatedBox(1.35, 1.6, 2.0, wallX, floorY + rowY, colZ));
      }
    }
  }

  // 2. Prateleiras Metálicas Pesadas (Esquerda, Direita e Fundo da Sala do Cofre)
  // Forradas de Barras de Ouro Brilhantes e Pilhas de Cédulas Verdes LEGO!
  const rackXList = [-34, -23, 23, 34];
  for (const rx of rackXList) {
    const rz = -211.0;
    // Colunas e 4 níveis de prateleiras metálicas
    shelfSteelGeos.push(
      makeTranslatedBox(4.2, 0.35, 14.0, rx, floorY + 1.2, rz),
      makeTranslatedBox(4.2, 0.35, 14.0, rx, floorY + 3.4, rz),
      makeTranslatedBox(4.2, 0.35, 14.0, rx, floorY + 5.6, rz),
      makeTranslatedBox(4.2, 0.35, 14.0, rx, floorY + 7.8, rz),
      makeTranslatedBox(0.4, 8.4, 0.4, rx - 1.9, floorY + 4.2, rz - 6.6),
      makeTranslatedBox(0.4, 8.4, 0.4, rx + 1.9, floorY + 4.2, rz - 6.6),
      makeTranslatedBox(0.4, 8.4, 0.4, rx - 1.9, floorY + 4.2, rz + 6.6),
      makeTranslatedBox(0.4, 8.4, 0.4, rx + 1.9, floorY + 4.2, rz + 6.6)
    );
    world.addCollider(rx, rz, 4.2, 14.0, floorY + 8.4, floorY);

    // Lingotes de Ouro Brilhantes + Pacotes de Cédulas Verdes em cada prateleira!
    for (const sy of [1.4, 3.6, 5.8, 8.0]) {
      for (let sz = rz - 5.0; sz <= rz + 5.0; sz += 2.5) {
        if (Math.abs(rx) > 28) {
          goldBarGeos.push(makeTranslatedBox(2.6, 0.9, 1.6, rx, floorY + sy + 0.45, sz));
        } else {
          cashStackGeos.push(makeTranslatedBox(2.6, 1.0, 1.7, rx, floorY + sy + 0.5, sz));
        }
      }
    }
  }

  world.scene.add(
    new THREE.Mesh(mergeBufferGeometries(shelfSteelGeos), steelVaultMat),
    new THREE.Mesh(mergeBufferGeometries(goldBarGeos), goldMat),
    new THREE.Mesh(mergeBufferGeometries(cashStackGeos), cashGreenMat)
  );

  // 3. AS 4 GRANDES PILHAS CENTRAIS DE BARRAS DE OURO DESTRUTÍVEIS (Z = -211, exigidas pelo Teste 2!)
  const goldStackPositions = [-12, -4, 4, 12];
  for (const gx of goldStackPositions) {
    const goldStack = createLegoBrick(3.6, 2.6, 3.0, LEGO_COLORS.gold, {
      metalness: 0.78,
      roughness: 0.12,
      studStep: 0.65
    });
    goldStack.position.set(bx + gx, floorY + 1.3, bz - 31); // z = -211
    world.scene.add(goldStack);
    const gCol = world.addCollider(bx + gx, bz - 31, 3.6, 3.0, floorY + 2.6, floorY);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: goldStack,
        type: 'gold_vault',
        hp: 40,
        radius: 2.3,
        height: 2.6,
        colliders: [gCol],
        debrisColors: [LEGO_COLORS.gold, LEGO_COLORS.yellow],
        studDrops: { silver: 0, gold: 12, blue: 8, purple: 5 },
        groundY: floorY,
        goldOnly: true
      });
    }
  }

  // 4. OITO MALETAS PRATEADAS QUEBRÁVEIS DENTRO DA SALA DO COFRE!
  const briefcaseCoords = [
    [-16, -206], [-8, -206], [8, -206], [16, -206],
    [-16, -217], [-8, -217], [8, -217], [16, -217]
  ];
  for (const [mcx, mcz] of briefcaseCoords) {
    const caseMesh = createLegoBrick(1.8, 1.2, 1.1, LEGO_COLORS.silver, {
      metalness: 0.8,
      roughness: 0.15,
      studStep: 0.55
    });
    caseMesh.position.set(mcx, floorY + 0.6, mcz);
    world.scene.add(caseMesh);
    const cCol = world.addCollider(mcx, mcz, 1.8, 1.1, floorY + 1.2, floorY);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: caseMesh,
        type: 'crate',
        hp: 18,
        radius: 1.3,
        height: 1.2,
        colliders: [cCol],
        debrisColors: [LEGO_COLORS.silver, 0x16a34a, LEGO_COLORS.gold],
        studDrops: { silver: 4, gold: 8, blue: 4, purple: 1 },
        groundY: floorY
      });
    }
  }

  // 5. DEZENAS DE STUDS DOURADOS, AZUIS E ROXOS ESPALHADOS PELA SALA DO COFRE PARA COLETAR!
  if (world.destructibles && typeof world.destructibles.spawnAmbientStud === 'function') {
    const studRowsZ = [-204.5, -208.0, -214.5, -218.5];
    const studColsX = [-18, -14, -10, -6, -2, 2, 6, 10, 14, 18];
    let idx = 0;
    for (const sz of studRowsZ) {
      for (const sx of studColsX) {
        const tier = idx % 5 === 0 ? 'purple' : idx % 2 === 0 ? 'blue' : 'gold';
        world.destructibles.spawnAmbientStud(sx, floorY + 0.22, sz, tier);
        idx++;
      }
    }
  }
}
