import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import {
  BUILDING_STYLE_KEYS,
  mergeBufferGeometries,
  makeTranslatedBox
} from '../BuildingGenerator.js';

/**
 * 2. COMPLEXO MONUMENTAL DA TORRE DOS HERÓIS (O Arranha-Céu Mais Alto da Ilha: 310m no Heliponto + 352m na Antena!)
 * - Localizado no Quarteirão X = -318, Z = -180 (W = 104, D = 104, Base Podium 94 x 94)
 * - INTERIOR 100% ENTRÁVEL SEM TELA DE LOADING (Pé-direito livre de 32m, Portais Abertos Sul e Leste):
 *   1. Piso Geométrico Nobre + Grande Emblema Circular "H" Luminoso no Centro + Tapetes Táticos Azul/Ouro
 *   2. Mesa de Comando Holográfica Central (12m) com Mapa 3D da Cidade + Coluna do Reator de Fusão Solar subindo até a Claraboia
 *   3. Ala Oeste: Sala de Armaduras (Hall of Armor com 7 Cápsulas Iluminadas de Trajes LEGO) + Arsenal Tático do BOPE + 6 Alvos de Treino Quebráveis
 *   4. Ala Norte: Megatelão Curvo de Monitoramento Global (34m x 14m), Supercomputadores Quânticos, 2 Células de Contenção Laser e Elevador Quântico [E]
 *   5. Ala Leste/Sudeste: Laboratório Científico & Médico (3 Cápsulas de Regeneração Bacta), Braços Robóticos LEGO, Caixas Táticas Quebráveis e Dezenas de Studs!
 *   6. Mezanino Panorâmico Elevado (Y = 14m) + Claraboia de Vidro Blindado no Teto do Podium (Y = 33m)
 * - EXTERIOR MONUMENTAL HIPER-DETALHADO (5 Estágios Escalados até 352m):
 *   1. Pórticos Monumentais Sul e Leste com Escadarias, 2 Estátuas Heroicas Gigantes (Solaris 14m + Caveira BOPE 14m), Letreiro 3D "TORRE DOS HERÓIS" e 4 Torretas Antiaéreas
 *   2. 1º Estágio (68x68, Y=35..125m): Exoesqueleto Estrutural Diagonal em "X" (Diagrid de Titânio), Janelas Safira e Terraço de Radares
 *   3. 2º Estágio (54x54, Y=125..228m): 8 Aletas Aerodinâmicas Ciano-Neon, Painéis Solares Dourados e Hangar/Plataforma em Balanço estilo Avengers ("Cantilever Launch Deck" em Y=228m)
 *   4. 3º Estágio (44x44, Y=228..282m): 4 Emblemas Gigantes "H" (18m de altura) em Ouro e Ciano-Neon nas 4 Faces da Torre
 *   5. 4º e 5º Estágios (36x36, Y=282..310m + Antena 352m): Cúpula Orbital com 3 Anéis de Energia Solar, Heliponto Principal em Y=310.5m, Prancha de Salto Heroico e Pináculo Giratório!
 */
export function buildHeroTowerComplex(world) {
  const tx = -318;
  const tz = -180;
  const blockW = 104;
  const blockD = 104;
  const bw = 94;
  const bd = 94;
  const halfW = bw * 0.5; // 47
  const halfD = bd * 0.5; // 47
  const floorY = 0.36;
  const lobbyWallH = 32.2;
  const podiumRoofBottomY = floorY + lobbyWallH; // 32.56m
  const podiumRoofTopY = 34.8;

  world._addCityBlockSidewalk(tx, tz, blockW, blockD, LEGO_COLORS.sidewalk);

  // Materiais compartilhados para performance máxima (60 FPS)
  const darkTitaniumMat = getLegoMaterial(0x0f172a, { roughness: 0.22, metalness: 0.55, clearcoat: 0.65 });
  const slateSteelMat = getLegoMaterial(0x1e293b, { roughness: 0.25, metalness: 0.48, clearcoat: 0.55 });
  const silverMat = getLegoMaterial(0xcbd5e1, { roughness: 0.18, metalness: 0.72, clearcoat: 0.8 });
  const whiteMarbleMat = getLegoMaterial(0xf8fafc, { roughness: 0.14, metalness: 0.08, clearcoat: 0.85 });
  const sapphireMat = getLegoMaterial(0x0284c7, { roughness: 0.16, metalness: 0.35, clearcoat: 0.75 });
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, {
    roughness: 0.15,
    metalness: 0.72,
    clearcoat: 0.88,
    emissive: 0xb45309,
    emissiveIntensity: 0.2
  });
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const neonBlueMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const solarOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const solarGoldGlowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const emeraldGlowMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
  const alertRedGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const purpleGlowMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

  const glassFacadeMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.08,
    metalness: 0.12,
    transparent: true,
    opacity: 0.38,
    clearcoat: 0.9
  });
  const holoCyanMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide
  });
  const bactaGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x34d399,
    roughness: 0.1,
    transparent: true,
    opacity: 0.48
  });

  // Acumuladores de geometria estática por material (Batching 60 FPS)
  const darkGeos = [];
  const slateGeos = [];
  const silverGeos = [];
  const whiteGeos = [];
  const sapphireGeos = [];
  const goldGeos = [];
  const cyanGeos = [];
  const blueGlowGeos = [];
  const orangeGlowGeos = [];
  const emeraldGeos = [];
  const redGlowGeos = [];
  const purpleGeos = [];
  const glassGeos = [];

  // ============================================================================
  // 1. PISO NOBRE DO QG DOS HERÓIS + EMBLEMA CENTRAL "H" + ESCADARIAS DE ENTRADA
  // ============================================================================
  darkGeos.push(makeTranslatedBox(bw, floorY, bd, tx, floorY * 0.5, tz));

  // Malha de ladrilhos polidos no saguão (90m x 90m)
  const tileStep = 6.0;
  for (let lx = -42; lx <= 42; lx += tileStep) {
    for (let lz = -42; lz <= 42; lz += tileStep) {
      const ix = Math.round((lx + 42) / tileStep);
      const iz = Math.round((lz + 42) / tileStep);
      if ((ix + iz) % 2 === 0) {
        slateGeos.push(makeTranslatedBox(tileStep - 0.18, 0.04, tileStep - 0.18, tx + lx, floorY + 0.02, tz + lz));
      } else {
        whiteGeos.push(makeTranslatedBox(tileStep - 0.35, 0.03, tileStep - 0.35, tx + lx, floorY + 0.015, tz + lz));
      }
    }
  }

  // Passarelas / Tapetes Táticos cruzando do Portal Sul (Z = +47) e Portal Leste (X = +47) até o Centro
  sapphireGeos.push(
    makeTranslatedBox(10.0, 0.05, 86.0, tx, floorY + 0.03, tz + 2.0),
    makeTranslatedBox(86.0, 0.05, 10.0, tx + 2.0, floorY + 0.03, tz)
  );
  goldGeos.push(
    makeTranslatedBox(0.45, 0.06, 86.0, tx - 5.1, floorY + 0.035, tz + 2.0),
    makeTranslatedBox(0.45, 0.06, 86.0, tx + 5.1, floorY + 0.035, tz + 2.0),
    makeTranslatedBox(86.0, 0.06, 0.45, tx + 2.0, floorY + 0.035, tz - 5.1),
    makeTranslatedBox(86.0, 0.06, 0.45, tx + 2.0, floorY + 0.035, tz + 5.1)
  );

  // Grande Emblema Circular "H" no Centro do Piso do Saguão
  cyanGeos.push(
    makeTranslatedBox(22.0, 0.06, 0.8, tx, floorY + 0.04, tz - 11.0),
    makeTranslatedBox(22.0, 0.06, 0.8, tx, floorY + 0.04, tz + 11.0),
    makeTranslatedBox(0.8, 0.06, 22.0, tx - 11.0, floorY + 0.04, tz),
    makeTranslatedBox(0.8, 0.06, 22.0, tx + 11.0, floorY + 0.04, tz)
  );
  goldGeos.push(
    makeTranslatedBox(2.2, 0.07, 14.0, tx - 5.2, floorY + 0.045, tz),
    makeTranslatedBox(2.2, 0.07, 14.0, tx + 5.2, floorY + 0.045, tz),
    makeTranslatedBox(10.4, 0.07, 2.4, tx, floorY + 0.045, tz)
  );

  // ============================================================================
  // 2. PAREDES DO PODIUM TÉRREO (COM PORTAIS SUL E LESTE 100% ABERTOS!) & COLISORES
  // ============================================================================
  const wallT = 2.6;
  const portalW = 22.0; // Vão livre de 22m nos portais Sul e Leste!
  const portalH = 22.0;
  const sideSegLen = (bw - portalW) * 0.5; // 36.0m de cada lado do portal

  // Parede Oeste (X = tx - halfW + wallT/2 = -363.7) — Fechada com vitrines internas e janelas blindadas
  darkGeos.push(makeTranslatedBox(wallT, lobbyWallH, bd, tx - halfW + wallT * 0.5, floorY + lobbyWallH * 0.5, tz));
  world.addCollider(tx - halfW + wallT * 0.5, tz, wallT, bd, podiumRoofBottomY, floorY);

  // Parede Norte (Z = tz - halfD + wallT/2 = -225.7) — Fechada sustentando o Megatelão Global
  darkGeos.push(makeTranslatedBox(bw, lobbyWallH, wallT, tx, floorY + lobbyWallH * 0.5, tz - halfD + wallT * 0.5));
  world.addCollider(tx, tz - halfD + wallT * 0.5, bw, wallT, podiumRoofBottomY, floorY);

  // Parede Sul Frontal (Z = tz + halfD - wallT/2 = -134.3) — Dividida em Esquerda, Direita e Verga Superior (Portal Sul Aberto!)
  const southZ = tz + halfD - wallT * 0.5;
  const leftSegX = tx - halfW + sideSegLen * 0.5;
  const rightSegX = tx + halfW - sideSegLen * 0.5;
  darkGeos.push(
    makeTranslatedBox(sideSegLen, lobbyWallH, wallT, leftSegX, floorY + lobbyWallH * 0.5, southZ),
    makeTranslatedBox(sideSegLen, lobbyWallH, wallT, rightSegX, floorY + lobbyWallH * 0.5, southZ),
    makeTranslatedBox(portalW, lobbyWallH - portalH, wallT, tx, floorY + portalH + (lobbyWallH - portalH) * 0.5, southZ)
  );
  glassGeos.push(
    makeTranslatedBox(sideSegLen - 8, 18.0, 0.6, leftSegX, floorY + 13.0, southZ + 1.1),
    makeTranslatedBox(sideSegLen - 8, 18.0, 0.6, rightSegX, floorY + 13.0, southZ + 1.1)
  );
  world.addCollider(leftSegX, southZ, sideSegLen, wallT, podiumRoofBottomY, floorY);
  world.addCollider(rightSegX, southZ, sideSegLen, wallT, podiumRoofBottomY, floorY);
  world.addCollider(tx, southZ, portalW, wallT, podiumRoofBottomY, floorY + portalH);

  // Parede Leste (X = tx + halfW - wallT/2 = -272.3) — Dividida em Norte, Sul e Verga Superior (Portal Leste Aberto!)
  const eastX = tx + halfW - wallT * 0.5;
  const northSegZ = tz - halfD + sideSegLen * 0.5;
  const southSegZ = tz + halfD - sideSegLen * 0.5;
  darkGeos.push(
    makeTranslatedBox(wallT, lobbyWallH, sideSegLen, eastX, floorY + lobbyWallH * 0.5, northSegZ),
    makeTranslatedBox(wallT, lobbyWallH, sideSegLen, eastX, floorY + lobbyWallH * 0.5, southSegZ),
    makeTranslatedBox(wallT, lobbyWallH - portalH, portalW, eastX, floorY + portalH + (lobbyWallH - portalH) * 0.5, tz)
  );
  glassGeos.push(
    makeTranslatedBox(0.6, 18.0, sideSegLen - 8, eastX + 1.1, floorY + 13.0, northSegZ),
    makeTranslatedBox(0.6, 18.0, sideSegLen - 8, eastX + 1.1, floorY + 13.0, southSegZ)
  );
  world.addCollider(eastX, northSegZ, wallT, sideSegLen, podiumRoofBottomY, floorY);
  world.addCollider(eastX, southSegZ, wallT, sideSegLen, podiumRoofBottomY, floorY);
  world.addCollider(eastX, tz, wallT, portalW, podiumRoofBottomY, floorY + portalH);

  // Laje do Teto do Podium (Y = 32.56m..34.8m) com Claraboia Central de Vidro Blindado (28m x 28m)
  const skyHole = 28.0;
  const roofSide = (bw - skyHole) * 0.5; // 33.0m
  const roofMidY = (podiumRoofBottomY + podiumRoofTopY) * 0.5;
  const roofH = podiumRoofTopY - podiumRoofBottomY;
  slateGeos.push(
    makeTranslatedBox(bw, roofH, roofSide, tx, roofMidY, tz - halfD + roofSide * 0.5),
    makeTranslatedBox(bw, roofH, roofSide, tx, roofMidY, tz + halfD - roofSide * 0.5),
    makeTranslatedBox(roofSide, roofH, skyHole, tx - halfW + roofSide * 0.5, roofMidY, tz),
    makeTranslatedBox(roofSide, roofH, skyHole, tx + halfW - roofSide * 0.5, roofMidY, tz)
  );
  glassGeos.push(makeTranslatedBox(skyHole, 0.65, skyHole, tx, roofMidY, tz));
  // Colisor de teto/terraço do Podium (bloqueia de baixo para cima como teto e sustenta quem pisa em Y = 34.8m!)
  world.addCollider(tx, tz, bw, bd, podiumRoofTopY, podiumRoofBottomY);

  // ============================================================================
  // 3. PÓRTICOS MONUMENTAIS EXTERNOS, LETREIRO 3D E 2 ESTÁTUAS HEROICAS GIGANTES (14m!)
  // ============================================================================
  // Pórtico Principal Sul (frente para a Avenida Central Z = -133)
  const frontPortalZ = tz + halfD + 1.8;
  for (const sx of [-1, 1]) {
    const px = tx + sx * (portalW * 0.5 + 2.4);
    sapphireGeos.push(makeTranslatedBox(4.8, lobbyWallH + 1.5, 4.8, px, floorY + (lobbyWallH + 1.5) * 0.5, frontPortalZ));
    goldGeos.push(makeTranslatedBox(5.4, 2.2, 5.4, px, floorY + 1.1, frontPortalZ));
    cyanGeos.push(makeTranslatedBox(1.1, lobbyWallH - 2.0, 5.2, px, floorY + lobbyWallH * 0.5, frontPortalZ));
  }
  // Marquise / Frontão Superior do Pórtico Sul + Letreiro Luminoso "TORRE DOS HERÓIS"
  darkGeos.push(makeTranslatedBox(portalW + 14.0, 5.2, 6.2, tx, floorY + portalH + 3.2, frontPortalZ + 0.8));
  goldGeos.push(makeTranslatedBox(portalW + 14.6, 0.8, 6.6, tx, floorY + portalH + 5.9, frontPortalZ + 0.8));
  cyanGeos.push(makeTranslatedBox(portalW + 10.0, 2.4, 0.5, tx, floorY + portalH + 3.2, frontPortalZ + 4.0));

  // Pórtico Leste (frente para o Super Banco Central X = -271)
  const eastPortalX = tx + halfW + 1.8;
  for (const sz of [-1, 1]) {
    const pz = tz + sz * (portalW * 0.5 + 2.4);
    sapphireGeos.push(makeTranslatedBox(4.8, lobbyWallH + 1.5, 4.8, eastPortalX, floorY + (lobbyWallH + 1.5) * 0.5, pz));
    goldGeos.push(makeTranslatedBox(5.4, 2.2, 5.4, eastPortalX, floorY + 1.1, pz));
    cyanGeos.push(makeTranslatedBox(5.2, lobbyWallH - 2.0, 1.1, eastPortalX, floorY + lobbyWallH * 0.5, pz));
  }
  darkGeos.push(makeTranslatedBox(6.2, 5.2, portalW + 14.0, eastPortalX + 0.8, floorY + portalH + 3.2, tz));
  goldGeos.push(makeTranslatedBox(6.6, 0.8, portalW + 14.6, eastPortalX + 0.8, floorY + portalH + 5.9, tz));
  cyanGeos.push(makeTranslatedBox(0.5, 2.4, portalW + 10.0, eastPortalX + 4.0, floorY + portalH + 3.2, tz));

  // 2 Estátuas / Totens Heroicos Gigantes de LEGO (14m de altura!) flanqueando a Entrada Sul:
  // Esquerda (X = tx - 20): Estátua Dourada/Solar do SOLARIS | Direita (X = tx + 20): Estátua Tática do COMANDANTE CAVEIRA (BOPE)
  for (const [sx, isSolaris] of [[-1, true], [1, false]]) {
    const stX = tx + sx * 20.5;
    const stZ = tz + halfD + 3.8;
    // Pedestal escalonado em granito e ouro
    darkGeos.push(makeTranslatedBox(5.6, 2.8, 5.6, stX, 1.4, stZ));
    goldGeos.push(makeTranslatedBox(4.8, 0.6, 4.8, stX, 3.1, stZ));
    // Pernas, Tronco, Braços, Cabeça Cilíndrica LEGO com Pino (Stud) e Insígnia Luminosa
    if (isSolaris) {
      goldGeos.push(
        makeTranslatedBox(1.5, 3.4, 1.5, stX - 0.95, 5.1, stZ),
        makeTranslatedBox(1.5, 3.4, 1.5, stX + 0.95, 5.1, stZ),
        makeTranslatedBox(3.8, 4.2, 2.2, stX, 8.9, stZ),
        makeTranslatedBox(1.3, 3.8, 1.3, stX - 2.6, 9.2, stZ + 0.4),
        makeTranslatedBox(1.3, 3.8, 1.3, stX + 2.6, 9.2, stZ + 0.4),
        makeTranslatedBox(2.4, 2.4, 2.4, stX, 12.2, stZ),
        makeTranslatedBox(1.2, 0.5, 1.2, stX, 13.65, stZ)
      );
      // Capa Solar & Orbe de Fogo
      orangeGlowGeos.push(
        makeTranslatedBox(4.2, 6.8, 0.4, stX, 8.2, stZ - 1.3),
        makeTranslatedBox(1.8, 1.8, 0.5, stX, 9.2, stZ + 1.25),
        makeTranslatedBox(1.4, 1.4, 1.4, stX + 2.6, 11.4, stZ + 1.2)
      );
    } else {
      darkGeos.push(
        makeTranslatedBox(1.5, 3.4, 1.5, stX - 0.95, 5.1, stZ),
        makeTranslatedBox(1.5, 3.4, 1.5, stX + 0.95, 5.1, stZ),
        makeTranslatedBox(3.8, 4.2, 2.2, stX, 8.9, stZ),
        makeTranslatedBox(1.3, 3.8, 1.3, stX - 2.6, 9.0, stZ),
        makeTranslatedBox(1.3, 3.8, 1.3, stX + 2.6, 9.4, stZ + 0.8),
        makeTranslatedBox(2.4, 2.4, 2.4, stX, 12.2, stZ),
        makeTranslatedBox(3.0, 0.8, 2.8, stX, 13.5, stZ) // Boina Preta do BOPE
      );
      // Emblema da Caveira Dourada no Peito + Fuzil Tático Gigante na Mão Direita
      goldGeos.push(makeTranslatedBox(1.6, 1.6, 0.4, stX, 9.2, stZ + 1.2));
      silverGeos.push(makeTranslatedBox(0.7, 1.1, 4.6, stX + 2.6, 9.6, stZ + 2.4));
    }
    world.addCollider(stX, stZ, 5.6, 5.6, 14.2, 0);
  }

  // Pilastras Externas do Podium + 4 Torretas Antiaéreas dos Heróis nas Esquinas do Terraço (Y = 34.8m)
  for (let i = -36; i <= 36; i += 18) {
    // Pilastras Oeste e Norte
    silverGeos.push(
      makeTranslatedBox(1.8, lobbyWallH, 2.2, tx - halfW - 0.4, floorY + lobbyWallH * 0.5, tz + i),
      makeTranslatedBox(2.2, lobbyWallH, 1.8, tx + i, floorY + lobbyWallH * 0.5, tz - halfD - 0.4)
    );
    cyanGeos.push(
      makeTranslatedBox(0.4, lobbyWallH - 4, 0.8, tx - halfW - 1.35, floorY + lobbyWallH * 0.5, tz + i),
      makeTranslatedBox(0.8, lobbyWallH - 4, 0.4, tx + i, floorY + lobbyWallH * 0.5, tz - halfD - 1.35)
    );
  }
  for (const [cx, cz] of [[-41, -41], [41, -41], [-41, 41], [41, 41]]) {
    // Torretas Defensivas nas 4 esquinas do Terraço do Podium (Y = 34.8m)
    darkGeos.push(makeTranslatedBox(6.4, 3.2, 6.4, tx + cx, podiumRoofTopY + 1.6, tz + cz));
    silverGeos.push(makeTranslatedBox(4.2, 2.4, 4.2, tx + cx, podiumRoofTopY + 4.4, tz + cz));
    cyanGeos.push(
      makeTranslatedBox(0.6, 0.6, 4.8, tx + cx - 1.1, podiumRoofTopY + 4.8, tz + cz + (cz > 0 ? 3.2 : -3.2)),
      makeTranslatedBox(0.6, 0.6, 4.8, tx + cx + 1.1, podiumRoofTopY + 4.8, tz + cz + (cz > 0 ? 3.2 : -3.2))
    );
  }

  // ============================================================================
  // 4. INTERIOR COMPLETO DO QG DOS HERÓIS (CENÁRIO INTERNO RICO SEM LOADING!)
  // ============================================================================
  // 4.1) MESA HOLOGRÁFICA TÁTICA CENTRAL (12m) + COLUNA DO REATOR DE FUSÃO SOLAR (Y = 0.4m..33m)
  darkGeos.push(
    makeTranslatedBox(11.6, 1.3, 11.6, tx, floorY + 0.65, tz),
    makeTranslatedBox(9.2, 0.6, 9.2, tx, floorY + 1.5, tz)
  );
  goldGeos.push(makeTranslatedBox(12.2, 0.25, 12.2, tx, floorY + 1.25, tz));
  cyanGeos.push(makeTranslatedBox(8.6, 0.18, 8.6, tx, floorY + 1.82, tz));
  world.addCollider(tx, tz, 11.8, 11.8, floorY + 4.5, floorY);

  // Mapa 3D Holográfico da Metrópole flutuando sobre a Mesa Central + Coluna Energética até o Teto
  const holoGroup = new THREE.Group();
  holoGroup.position.set(tx, floorY + 1.9, tz);
  const holoCityPositions = [
    [0, 0, 1.4, 4.2, 1.4], [-2.2, -1.5, 1.1, 2.6, 1.1], [2.1, -1.4, 1.2, 3.1, 1.2],
    [-1.8, 1.9, 1.0, 2.2, 1.0], [2.0, 1.8, 1.3, 2.8, 1.3], [0, -2.6, 1.6, 1.8, 1.1],
    [-3.1, 0.2, 0.9, 1.9, 1.4], [3.1, 0.3, 1.0, 2.4, 1.2]
  ];
  for (const [hx, hz, hw, hh, hd] of holoCityPositions) {
    const hBox = new THREE.Mesh(new THREE.BoxGeometry(hw, hh, hd), holoCyanMat);
    hBox.position.set(hx, hh * 0.5, hz);
    holoGroup.add(hBox);
  }
  const reactorCoreMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.35, lobbyWallH - 2.0, 16, 1, true),
    holoCyanMat
  );
  reactorCoreMesh.position.set(0, (lobbyWallH - 2.0) * 0.5, 0);
  holoGroup.add(reactorCoreMesh);
  world.scene.add(holoGroup);

  // Anéis energéticos ao redor da Coluna do Reator Solar + 8 Cadeiras Táticas ao redor da Mesa
  for (let ry = 5.0; ry <= 29.0; ry += 6.0) {
    goldGeos.push(makeTranslatedBox(4.2, 0.45, 4.2, tx, floorY + ry, tz));
    cyanGeos.push(makeTranslatedBox(4.6, 0.22, 4.6, tx, floorY + ry + 0.35, tz));
  }
  for (const [cx, cz] of [[-8.2, 0], [8.2, 0], [0, -8.2], [0, 8.2], [-6.2, -6.2], [6.2, -6.2], [-6.2, 6.2], [6.2, 6.2]]) {
    darkGeos.push(
      makeTranslatedBox(1.6, 1.1, 1.6, tx + cx, floorY + 0.55, tz + cz),
      makeTranslatedBox(1.6, 2.1, 0.4, tx + cx * 1.08, floorY + 1.6, tz + cz * 1.08)
    );
    goldGeos.push(makeTranslatedBox(1.7, 0.18, 1.7, tx + cx, floorY + 1.12, tz + cz));
  }

  // 4.2) ALA OESTE (X = tx - 39..-30): SALA DE ARMADURAS ("HALL OF ARMOR" — 7 CÁPSULAS DE TRAJES LEGO) & ARSENAL DO BOPE
  const armorSuitColors = [
    0x111827, // 1. Comandante Caveira (BOPE)
    0xf97316, // 2. Solaris (Guerreiro Solar)
    0x2563eb, // 3. Titã Blindado (Mecha Policial)
    0x475569, // 4. Vingador de Chumbo (Justiceiro)
    0xdc2626, // 5. Sombra Escarlate (Ninja)
    0x06b6d4, // 6. Turbo Fantasma (Motociclista)
    0xfacc15  // 7. Voltaico (Tempestade)
  ];
  for (let i = 0; i < 7; i++) {
    const bayZ = tz - 30 + i * 10.0;
    const bayX = tx - 40.5;
    // Estrutura da Cápsula de Armadura (Bay Vertical)
    darkGeos.push(
      makeTranslatedBox(4.6, 0.8, 6.8, bayX, floorY + 0.4, bayZ),
      makeTranslatedBox(4.6, 0.8, 6.8, bayX, floorY + 9.2, bayZ),
      makeTranslatedBox(0.8, 9.2, 6.8, bayX - 2.1, floorY + 4.6, bayZ)
    );
    goldGeos.push(
      makeTranslatedBox(4.8, 0.25, 7.0, bayX, floorY + 0.85, bayZ),
      makeTranslatedBox(4.8, 0.25, 7.0, bayX, floorY + 8.75, bayZ)
    );
    cyanGeos.push(
      makeTranslatedBox(0.3, 8.0, 0.4, bayX + 2.1, floorY + 4.8, bayZ - 3.1),
      makeTranslatedBox(0.3, 8.0, 0.4, bayX + 2.1, floorY + 4.8, bayZ + 3.1)
    );
    glassGeos.push(makeTranslatedBox(0.25, 7.8, 6.0, bayX + 2.1, floorY + 4.8, bayZ));

    // Manequim / Armadura 3D LEGO em exposição dentro da Cápsula
    const suitMesh = createLegoBrick(1.8, 4.2, 2.4, armorSuitColors[i], { studStep: 0.6, castShadow: false });
    suitMesh.position.set(bayX, floorY + 3.1, bayZ);
    const helmMesh = createLegoBrick(1.4, 1.4, 1.4, i === 1 || i === 6 ? LEGO_COLORS.gold : armorSuitColors[i], {
      studs: true,
      studStep: 0.7,
      castShadow: false
    });
    helmMesh.position.set(bayX, floorY + 5.9, bayZ);
    world.scene.add(suitMesh, helmMesh);
  }
  world.addCollider(tx - 40.5, tz, 5.0, 72.0, floorY + 9.6, floorY);

  // Bancada de Armas do BOPE + 6 Alvos de Treino Táticos Quebráveis na Ala Oeste/Sudoeste
  const weaponRackX = tx - 26.0;
  darkGeos.push(makeTranslatedBox(3.2, 2.2, 22.0, weaponRackX, floorY + 1.1, tz - 16.0));
  silverGeos.push(makeTranslatedBox(3.4, 0.25, 22.4, weaponRackX, floorY + 2.25, tz - 16.0));
  world.addCollider(weaponRackX, tz - 16.0, 3.4, 22.4, floorY + 2.5, floorY);

  let breakableTargetsCount = 0;
  for (let tIdx = 0; tIdx < 6; tIdx++) {
    const targZ = tz + 10.0 + tIdx * 5.2;
    const targX = tx - 28.0;
    const targetDummy = createLegoBrick(1.4, 3.2, 1.4, tIdx % 2 === 0 ? 0xdc2626 : 0x9333ea, {
      studs: true,
      studStep: 0.7,
      castShadow: false
    });
    targetDummy.position.set(targX, floorY + 1.6, targZ);
    world.scene.add(targetDummy);
    const tCol = world.addCollider(targX, targZ, 1.5, 1.5, floorY + 3.2, floorY);
    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: targetDummy,
        type: 'crate',
        hp: 35,
        radius: 1.4,
        height: 3.2,
        colliders: [tCol],
        debrisColors: [0xdc2626, 0xfacc15, LEGO_COLORS.black],
        studDrops: { silver: 2, gold: 2, blue: 1, purple: 0 },
        groundY: floorY
      });
    }
    breakableTargetsCount++;
  }

  // 4.3) ALA NORTE (Z = tz - 42..-28): MEGATELÃO GLOBAL (34m x 14m), SUPERCOMPUTADORES, CÉLULAS DE CONTENÇÃO & ELEVADOR QUÂNTICO [E]
  const northWallInnerZ = tz - halfD + wallT + 1.2; // -223.2
  // Moldura e Tela Luminosa do Megatelão de Monitoramento Global na Parede Norte
  darkGeos.push(makeTranslatedBox(36.0, 15.6, 1.4, tx, floorY + 13.5, northWallInnerZ));
  goldGeos.push(makeTranslatedBox(36.8, 0.6, 1.6, tx, floorY + 21.5, northWallInnerZ));
  blueGlowGeos.push(makeTranslatedBox(33.6, 13.2, 0.4, tx, floorY + 13.5, northWallInnerZ + 0.8));
  // Alertas de Facções e Gráficos Táticos desenhados em relevo 3D no Megatelão
  redGlowGeos.push(makeTranslatedBox(6.5, 4.2, 0.5, tx - 10.5, floorY + 15.0, northWallInnerZ + 0.95));
  cyanGeos.push(makeTranslatedBox(8.5, 5.0, 0.5, tx, floorY + 13.5, northWallInnerZ + 0.95));
  purpleGeos.push(makeTranslatedBox(6.5, 4.2, 0.5, tx + 10.5, floorY + 15.0, northWallInnerZ + 0.95));

  // Fileiras de Supercomputadores Quânticos e Consoles de Operadores no Setor Norte
  for (const sx of [-16.0, 16.0]) {
    darkGeos.push(makeTranslatedBox(8.5, 3.8, 4.2, tx + sx, floorY + 1.9, tz - 31.0));
    cyanGeos.push(makeTranslatedBox(7.8, 1.2, 4.4, tx + sx, floorY + 2.6, tz - 31.0));
    world.addCollider(tx + sx, tz - 31.0, 8.5, 4.2, floorY + 3.8, floorY);
  }

  // 2 Células de Contenção Laser nos Cantos Noroeste e Nordeste (Guardando Tecnologia A.R.E.S. / Vilões)
  for (const sx of [-1, 1]) {
    const cellX = tx + sx * 35.0;
    const cellZ = tz - 36.5;
    darkGeos.push(
      makeTranslatedBox(12.0, 0.8, 10.0, cellX, floorY + 0.4, cellZ),
      makeTranslatedBox(12.0, 1.0, 10.0, cellX, floorY + 9.5, cellZ)
    );
    // Barras verticais de laser ciano/roxo
    for (let bx = -5.0; bx <= 5.0; bx += 2.0) {
      if (sx < 0) {
        cyanGeos.push(makeTranslatedBox(0.28, 8.6, 0.28, cellX + bx, floorY + 4.8, cellZ + 4.8));
      } else {
        purpleGeos.push(makeTranslatedBox(0.28, 8.6, 0.28, cellX + bx, floorY + 4.8, cellZ + 4.8));
      }
    }
    // Protótipo / Drone Capturado dentro da Célula
    silverGeos.push(makeTranslatedBox(3.2, 4.6, 3.2, cellX, floorY + 3.1, cellZ));
    purpleGeos.push(makeTranslatedBox(2.2, 1.2, 3.5, cellX, floorY + 4.2, cellZ));
    world.addCollider(cellX, cellZ, 12.0, 10.0, floorY + 10.0, floorY);
  }

  // PLATAFORMA DO ELEVADOR QUÂNTICO DOS HERÓIS (Térreo Z = tz - 24 -> Topo Heliponto Y = 310.8m com tecla [E]!)
  const elevGroundPos = { x: tx, y: floorY + 0.2, z: tz - 24.0 };
  const elevRoofPos = { x: tx, y: 310.85, z: tz - 11.5 };
  goldGeos.push(makeTranslatedBox(6.8, 0.35, 6.8, elevGroundPos.x, floorY + 0.18, elevGroundPos.z));
  cyanGeos.push(
    makeTranslatedBox(5.2, 0.42, 5.2, elevGroundPos.x, floorY + 0.22, elevGroundPos.z),
    makeTranslatedBox(0.6, 12.0, 0.6, elevGroundPos.x - 3.1, floorY + 6.0, elevGroundPos.z - 3.1),
    makeTranslatedBox(0.6, 12.0, 0.6, elevGroundPos.x + 3.1, floorY + 6.0, elevGroundPos.z - 3.1)
  );

  // 4.4) ALA LESTE & SUDESTE (X = tx + 18..+38): LABORATÓRIO CIENTÍFICO, CÁPSULAS MÉDICAS BACTA, CAIXAS QUEBRÁVEIS & STUDS!
  // 3 Cápsulas Cilíndricas de Regeneração Médica (Bacta Pods) no Setor Nordeste Interno (Z = tz - 22..-10)
  for (let pIdx = 0; pIdx < 3; pIdx++) {
    const podX = tx + 32.0;
    const podZ = tz - 25.0 + pIdx * 7.5;
    darkGeos.push(
      makeTranslatedBox(4.4, 1.0, 4.4, podX, floorY + 0.5, podZ),
      makeTranslatedBox(4.4, 1.0, 4.4, podX, floorY + 7.8, podZ)
    );
    emeraldGeos.push(makeTranslatedBox(3.4, 0.3, 3.4, podX, floorY + 1.05, podZ));
    const bactaCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 6.4, 16), bactaGlassMat);
    bactaCyl.position.set(podX, floorY + 4.2, podZ);
    world.scene.add(bactaCyl);
    world.addCollider(podX, podZ, 4.4, 4.4, floorY + 8.4, floorY);
  }

  // Bancada de Engenharia LEGO com Braços Robóticos Amarelos + Caixas de Suprimentos Quebráveis no Setor Sudeste Interno
  const labX = tx + 26.0;
  const labZ = tz + 22.0;
  slateGeos.push(makeTranslatedBox(10.0, 2.0, 14.0, labX, floorY + 1.0, labZ));
  goldGeos.push(
    makeTranslatedBox(1.2, 4.5, 1.2, labX - 3.0, floorY + 4.2, labZ - 4.0),
    makeTranslatedBox(3.6, 0.9, 0.9, labX - 1.5, floorY + 6.2, labZ - 4.0),
    makeTranslatedBox(1.2, 4.5, 1.2, labX + 3.0, floorY + 4.2, labZ + 4.0),
    makeTranslatedBox(3.6, 0.9, 0.9, labX + 1.5, floorY + 6.2, labZ + 4.0)
  );
  world.addCollider(labX, labZ, 10.0, 14.0, floorY + 2.5, floorY);

  // Caixas Táticas Quebráveis + Fileiras de Studs Dourados, Azuis e Roxos dentro do QG dos Heróis!
  for (let cIdx = 0; cIdx < 6; cIdx++) {
    const cx = tx + 16.0 + (cIdx % 2) * 4.2;
    const cz = tz + 15.0 + Math.floor(cIdx / 2) * 4.5;
    const supplyCrate = createLegoBrick(2.2, 2.0, 2.2, cIdx % 2 === 0 ? 0x0284c7 : LEGO_COLORS.gold, {
      studs: true,
      studStep: 0.8,
      castShadow: false
    });
    supplyCrate.position.set(cx, floorY + 1.0, cz);
    world.scene.add(supplyCrate);
    const cCol = world.addCollider(cx, cz, 2.2, 2.2, floorY + 2.0, floorY);
    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: supplyCrate,
        type: 'crate',
        hp: 40,
        radius: 1.6,
        height: 2.0,
        colliders: [cCol],
        debrisColors: [0x0284c7, LEGO_COLORS.gold, LEGO_COLORS.white],
        studDrops: { silver: 2, gold: 4, blue: 2, purple: 1 },
        groundY: floorY
      });
    }
  }

  if (world.destructibles) {
    // 24 Studs de Alto Valor (Azuis, Dourados e Roxos) espalhados pelo Saguão do QG dos Heróis!
    for (let sIdx = 0; sIdx < 12; sIdx++) {
      const ang = (sIdx / 12) * Math.PI * 2;
      const sx = tx + Math.cos(ang) * 14.5;
      const sz = tz + Math.sin(ang) * 14.5;
      const kind = sIdx % 3 === 0 ? 'purple' : sIdx % 2 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(new THREE.Vector3(sx, floorY + 0.55, sz), kind);
    }
  }

  // 4.5) MEZANINO INTERNO PANORÂMICO (Y = 14.5m) + 4 COLUNAS DE TITÂNIO INTERNAS + LUSTRES NO TETO ALTO
  for (const [px, pz] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) {
    silverGeos.push(makeTranslatedBox(3.4, lobbyWallH, 3.4, tx + px, floorY + lobbyWallH * 0.5, tz + pz));
    cyanGeos.push(makeTranslatedBox(3.8, lobbyWallH - 4.0, 0.6, tx + px, floorY + lobbyWallH * 0.5, tz + pz));
    world.addCollider(tx + px, tz + pz, 3.4, 3.4, podiumRoofBottomY, floorY);
  }
  // Galeria do Mezanino Interno em Y = 14.5m ao longo das paredes Oeste e Norte
  slateGeos.push(
    makeTranslatedBox(10.0, 0.8, 78.0, tx - 39.0, 14.5, tz),
    makeTranslatedBox(78.0, 0.8, 10.0, tx, 14.5, tz - 39.0)
  );
  glassGeos.push(
    makeTranslatedBox(0.35, 2.0, 78.0, tx - 34.0, 15.8, tz),
    makeTranslatedBox(78.0, 2.0, 0.35, tx, 15.8, tz - 34.0)
  );
  world.addCollider(tx - 39.0, tz, 10.0, 78.0, 14.9, 14.0);
  world.addCollider(tx, tz - 39.0, 78.0, 10.0, 14.9, 14.0);

  // ============================================================================
  // 5. CORPO ESCALONADO DA SUPERTORRE EXTERNA (SUBINDO DE Y = 34.8m ATÉ 352m!)
  // ============================================================================
  // ESTÁGIO 1 (Y = 34.8m..125m, 68m x 68m): Exoesqueleto Estrutural Diagonal de Titânio + Janelas Safira
  const s1W = 68;
  const s1Bottom = 34.8;
  const s1Top = 125.0;
  const s1H = s1Top - s1Bottom;
  sapphireGeos.push(makeTranslatedBox(s1W, s1H, s1W, tx, s1Bottom + s1H * 0.5, tz));
  world.addCollider(tx, tz, s1W, s1W, s1Top, s1Bottom);

  // Anéis horizontais de aço escuro e colunas de quina chanfradas no Estágio 1
  for (let y = 42; y <= 122; y += 10) {
    darkGeos.push(makeTranslatedBox(s1W + 1.2, 1.6, s1W + 1.2, tx, y, tz));
    if (y % 20 === 2) {
      cyanGeos.push(makeTranslatedBox(s1W + 1.5, 0.45, s1W + 1.5, tx, y + 1.0, tz));
    }
  }
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    silverGeos.push(makeTranslatedBox(4.8, s1H, 4.8, tx + cx * (s1W * 0.5), s1Bottom + s1H * 0.5, tz + cz * (s1W * 0.5)));
  }
  // Terraço Técnico do Estágio 1 (Y = 125m) com Parapeitos e 4 Torres de Radar
  slateGeos.push(makeTranslatedBox(s1W + 2.0, 1.4, s1W + 2.0, tx, s1Top + 0.7, tz));
  for (const [rx, rz] of [[-29, -29], [29, -29], [-29, 29], [29, 29]]) {
    silverGeos.push(makeTranslatedBox(3.2, 8.5, 3.2, tx + rx, s1Top + 4.2, tz + rz));
    cyanGeos.push(makeTranslatedBox(4.8, 4.8, 1.2, tx + rx, s1Top + 9.0, tz + rz));
  }

  // ESTÁGIO 2 (Y = 125m..228m, 54m x 54m): Núcleo Ciano-Moderno + 8 Aletas Aerodinâmicas + Painéis Solares Dourados
  const s2W = 54;
  const s2Bottom = 125.0;
  const s2Top = 228.0;
  const s2H = s2Top - s2Bottom;
  darkGeos.push(makeTranslatedBox(s2W, s2H, s2W, tx, s2Bottom + s2H * 0.5, tz));
  glassGeos.push(makeTranslatedBox(s2W + 0.6, s2H - 4.0, s2W + 0.6, tx, s2Bottom + s2H * 0.5, tz));
  world.addCollider(tx, tz, s2W, s2W, s2Top, s2Bottom);

  for (let y = 135; y <= 220; y += 12) {
    silverGeos.push(makeTranslatedBox(s2W + 1.4, 1.4, s2W + 1.4, tx, y, tz));
    goldGeos.push(makeTranslatedBox(s2W + 1.6, 0.4, s2W + 1.6, tx, y - 0.9, tz));
  }
  // Painéis Coletores Solares Dourados nas 4 faces + Aletas Verticais Ciano-Neon nas Quinas
  for (const s of [-1, 1]) {
    goldGeos.push(
      makeTranslatedBox(14.0, s2H - 12.0, 1.2, tx, s2Bottom + s2H * 0.5, tz + s * (s2W * 0.5 + 0.6)),
      makeTranslatedBox(1.2, s2H - 12.0, 14.0, tx + s * (s2W * 0.5 + 0.6), s2Bottom + s2H * 0.5, tz)
    );
  }

  // PLATAFORMA / HANGAR EM BALANÇO ESTILO AVENGERS TOWER ("CANTILEVER LAUNCH DECK" EM Y = 228m PROJETADO PARA O SUL!)
  const deckW = 36.0;
  const deckD = 26.0;
  const deckZ = tz + s2W * 0.5 + deckD * 0.5 - 4.0; // Avança 22m para fora da torre na direção Sul!
  darkGeos.push(
    makeTranslatedBox(deckW, 3.2, deckD, tx, s2Top - 1.6, deckZ),
    makeTranslatedBox(deckW - 6.0, 4.5, deckD - 6.0, tx, s2Top - 5.2, deckZ - 3.0)
  );
  goldGeos.push(makeTranslatedBox(deckW + 0.8, 0.6, deckD + 0.8, tx, s2Top + 0.1, deckZ));
  cyanGeos.push(
    makeTranslatedBox(1.2, 0.25, deckD - 3.0, tx - 10.0, s2Top + 0.42, deckZ),
    makeTranslatedBox(1.2, 0.25, deckD - 3.0, tx + 10.0, s2Top + 0.42, deckZ),
    makeTranslatedBox(14.0, 0.25, 1.2, tx, s2Top + 0.42, deckZ + deckD * 0.5 - 2.0)
  );
  world.addCollider(tx, deckZ, deckW, deckD, s2Top + 0.4, s2Top - 6.0);

  // ESTÁGIO 3 (Y = 228m..282m, 44m x 44m): Seção dos 4 Emblemas Gigantes "H" (18m de altura!) nas 4 Faces
  const s3W = 44;
  const s3Bottom = 228.0;
  const s3Top = 282.0;
  const s3H = s3Top - s3Bottom;
  sapphireGeos.push(makeTranslatedBox(s3W, s3H, s3W, tx, s3Bottom + s3H * 0.5, tz));
  world.addCollider(tx, tz, s3W, s3W, s3Top, s3Bottom);

  for (let y = 236; y <= 278; y += 14) {
    darkGeos.push(makeTranslatedBox(s3W + 1.0, 1.2, s3W + 1.0, tx, y, tz));
  }

  // Os 4 Emblemas Gigantes "H" (18m de altura x 14m de largura) em Ouro e Ciano-Neon nas faces Norte, Sul, Leste e Oeste!
  const emblemY = 256.0;
  const faceDist = s3W * 0.5 + 0.65;
  for (const sign of [-1, 1]) {
    // Faces Norte e Sul
    goldGeos.push(
      makeTranslatedBox(3.2, 18.0, 1.2, tx - 5.4, emblemY, tz + sign * faceDist),
      makeTranslatedBox(3.2, 18.0, 1.2, tx + 5.4, emblemY, tz + sign * faceDist),
      makeTranslatedBox(14.0, 3.4, 1.2, tx, emblemY, tz + sign * faceDist)
    );
    cyanGeos.push(
      makeTranslatedBox(1.4, 16.0, 1.5, tx - 5.4, emblemY, tz + sign * (faceDist + 0.2)),
      makeTranslatedBox(1.4, 16.0, 1.5, tx + 5.4, emblemY, tz + sign * (faceDist + 0.2)),
      makeTranslatedBox(12.0, 1.5, 1.5, tx, emblemY, tz + sign * (faceDist + 0.2))
    );
    // Faces Leste e Oeste
    goldGeos.push(
      makeTranslatedBox(1.2, 18.0, 3.2, tx + sign * faceDist, emblemY, tz - 5.4),
      makeTranslatedBox(1.2, 18.0, 3.2, tx + sign * faceDist, emblemY, tz + 5.4),
      makeTranslatedBox(1.2, 3.4, 14.0, tx + sign * faceDist, emblemY, tz)
    );
    cyanGeos.push(
      makeTranslatedBox(1.5, 16.0, 1.4, tx + sign * (faceDist + 0.2), emblemY, tz - 5.4),
      makeTranslatedBox(1.5, 16.0, 1.4, tx + sign * (faceDist + 0.2), emblemY, tz + 5.4),
      makeTranslatedBox(1.5, 1.5, 12.0, tx + sign * (faceDist + 0.2), emblemY, tz)
    );
  }

  // ESTÁGIO 4 (Y = 282m..310m, 36m x 36m): Cúpula Orbital de Comando & 3 Anéis de Energia Solar
  const s4W = 36;
  const s4Bottom = 282.0;
  const s4Top = 310.0;
  const s4H = s4Top - s4Bottom;
  darkGeos.push(makeTranslatedBox(s4W, s4H, s4W, tx, s4Bottom + s4H * 0.5, tz));
  glassGeos.push(makeTranslatedBox(s4W + 0.5, s4H - 6.0, s4W + 0.5, tx, s4Bottom + s4H * 0.5, tz));
  world.addCollider(tx, tz, s4W, s4W, s4Top, s4Bottom);

  for (const ringY of [288.0, 296.0, 304.0]) {
    goldGeos.push(makeTranslatedBox(s4W + 3.2, 1.4, s4W + 3.2, tx, ringY, tz));
    cyanGeos.push(makeTranslatedBox(s4W + 3.8, 0.55, s4W + 3.8, tx, ringY + 0.8, tz));
  }

  // Aletas Verticais Luminosas Ciano-Neon Contínuas nas 4 Quinas da Supertorre (de Y = 35m até Y = 310m!)
  for (const [fx, fz] of [[-22.3, -22.3], [22.3, -22.3], [-22.3, 22.3], [22.3, 22.3]]) {
    cyanGeos.push(makeTranslatedBox(1.8, 274.0, 1.8, tx + fx, 172.0, tz + fz));
  }

  // ============================================================================
  // 6. TOPO MONUMENTAL (Y = 310m..352m): HELIPONTO PRINCIPAL, PRANCHA DE SALTO, ELEVADOR & PINÁCULO SOLAR
  // ============================================================================
  const helipad = createLegoBrick(38, 0.8, 38, LEGO_COLORS.charcoal, { studs: false });
  helipad.position.set(tx, 310.4, tz);
  world.scene.add(helipad);
  world.addCollider(tx, tz, 38, 38, 310.8, 309.8);

  // Anel luminoso "H" do Heliponto Principal em Y = 310.85m
  const hCircle = new THREE.Mesh(
    new THREE.RingGeometry(10.5, 12.5, 32),
    solarGoldGlowMat
  );
  hCircle.rotation.x = -Math.PI / 2;
  hCircle.position.set(tx, 310.86, tz);
  world.scene.add(hCircle);

  cyanGeos.push(
    makeTranslatedBox(2.2, 0.12, 12.0, tx - 4.2, 310.85, tz),
    makeTranslatedBox(2.2, 0.12, 12.0, tx + 4.2, 310.85, tz),
    makeTranslatedBox(8.4, 0.12, 2.2, tx, 310.85, tz)
  );

  // Plataforma de Salto Heroico ("Diving Board" em balanço sobre a avenida Sul em Y = 310.8m!)
  goldGeos.push(makeTranslatedBox(6.0, 0.6, 14.0, tx, 310.5, tz + 24.0));
  cyanGeos.push(makeTranslatedBox(4.4, 0.15, 12.5, tx, 310.85, tz + 24.5));
  world.addCollider(tx, tz + 24.0, 6.0, 14.0, 310.8, 310.0);

  // Plataforma Superior do Elevador Quântico no Topo (X = tx, Y = 310.85m, Z = tz - 11.5)
  goldGeos.push(makeTranslatedBox(5.6, 0.35, 5.6, elevRoofPos.x, 310.9, elevRoofPos.z));
  cyanGeos.push(makeTranslatedBox(4.2, 0.42, 4.2, elevRoofPos.x, 310.95, elevRoofPos.z));

  // Pináculo / Antena do Reator Solar no Canto Norte do Topo (Subindo de Y = 310.8m até Y = 352.0m!)
  const spireX = tx - 13.5;
  const spireZ = tz - 13.5;
  silverGeos.push(
    makeTranslatedBox(4.6, 16.0, 4.6, spireX, 318.8, spireZ),
    makeTranslatedBox(2.6, 16.0, 2.6, spireX, 334.8, spireZ),
    makeTranslatedBox(1.1, 12.0, 1.1, spireX, 346.8, spireZ)
  );
  orangeGlowGeos.push(
    makeTranslatedBox(6.4, 1.4, 6.4, spireX, 326.0, spireZ),
    makeTranslatedBox(4.8, 1.2, 4.8, spireX, 338.0, spireZ),
    makeTranslatedBox(3.2, 3.2, 3.2, spireX, 352.0, spireZ)
  );

  // Consolida todos os lotes de geometria da Torre dos Heróis em pouquíssimos Draw Calls (60 FPS!)
  const batches = [
    [darkGeos, darkTitaniumMat, true],
    [slateGeos, slateSteelMat, true],
    [silverGeos, silverMat, true],
    [whiteGeos, whiteMarbleMat, false],
    [sapphireGeos, sapphireMat, true],
    [goldGeos, goldMat, false],
    [cyanGeos, neonCyanMat, false],
    [blueGlowGeos, neonBlueMat, false],
    [orangeGlowGeos, solarOrangeMat, false],
    [emeraldGeos, emeraldGlowMat, false],
    [redGlowGeos, alertRedGlowMat, false],
    [purpleGeos, purpleGlowMat, false],
    [glassGeos, glassFacadeMat, false]
  ];
  for (const [geos, mat, castShad] of batches) {
    if (geos.length === 0) continue;
    const mesh = new THREE.Mesh(mergeBufferGeometries(geos), mat);
    mesh.castShadow = castShad;
    mesh.receiveShadow = true;
    world.scene.add(mesh);
  }

  // Registra no Mapa 2D e salva metadados completos em world.heroTowerData
  world.mapBuildings.push({
    x: tx,
    z: tz,
    w: bw,
    d: bd,
    height: 310,
    color: '#38bdf8',
    label: 'TORRE DOS HERÓIS (310m)'
  });

  world.heroTowerData = {
    x: tx,
    z: tz,
    width: bw,
    depth: bd,
    helipadHeight: 310.8,
    spireTopHeight: 352.0,
    cantileverDeckHeight: 228.0,
    enterable: true,
    lobbyClearHeight: lobbyWallH,
    openPortalsCount: 2,
    heroStatuesCount: 2,
    armorPodsCount: 7,
    containmentCellsCount: 2,
    bactaPodsCount: 3,
    breakableTargetsCount,
    hasHologramCommandTable: true,
    hasGlobalMonitorScreen: true,
    hasCantileverAvengersDeck: true,
    elevatorPads: {
      ground: elevGroundPos,
      roof: elevRoofPos
    }
  };
}

/**
 * 3. PARQUE CENTRAL & LAGO (X: -490..+490, Z: +152..+384)
 */
export { buildCentralParkAndLake } from './CentralParkBuilder.js';

/**
 * 4. RECONSTRUÇÃO TOTAL DOS QUARTEIRÕES DO CENTRO (5 LAYOUTS DE QUADRA URBANA + FECHAMENTO PERFEITO DA CALÇADA)
 */
export function buildDowntownSkyscrapersAndTransitionBlocks(world) {
  const downtownGrid = [
    // Fileira Norte do Centro (Z = -316, D = 104, entre as avenidas Z = -382 e Z = -250)
    { x: -450, z: -316, w: 104, d: 104, layout: 0, baseH: 92 },
    { x: -318, z: -316, w: 104, d: 104, layout: 2, baseH: 118 },
    { x: -186, z: -316, w: 104, d: 104, layout: 1, baseH: 148 },
    { x: -60,  z: -316, w: 92,  d: 104, layout: 3, baseH: 112 },
    { x: 60,   z: -316, w: 92,  d: 104, layout: 0, baseH: 116 },
    { x: 186,  z: -316, w: 104, d: 104, layout: 2, baseH: 126 },
    { x: 318,  z: -316, w: 104, d: 104, layout: 3, baseH: 104 },
    { x: 450,  z: -316, w: 104, d: 104, layout: 0, baseH: 88 },

    // Fileira do Super Banco & Torre dos Heróis (Z = -180, D = 104)
    { x: -450, z: -180, w: 104, d: 104, layout: 3, baseH: 102 },
    { x: -186, z: -180, w: 104, d: 104, layout: 4, baseH: 138 },
    { x: 186,  z: -180, w: 104, d: 104, layout: 1, baseH: 162 },
    { x: 318,  z: -180, w: 104, d: 104, layout: 2, baseH: 128 },
    { x: 450,  z: -180, w: 104, d: 104, layout: 0, baseH: 96 },

    // Fileira Central Times Square (Z = -58, D = 90, entre as avenidas Z = -117 e Z = 0)
    { x: -450, z: -58,  w: 104, d: 90,  layout: 2, baseH: 98 },
    { x: -318, z: -58,  w: 104, d: 90,  layout: 4, baseH: 132 },
    { x: -186, z: -58,  w: 104, d: 90,  layout: 1, baseH: 156 },
    { x: -60,  z: -58,  w: 92,  d: 90,  layout: 4, baseH: 142 },
    { x: 60,   z: -58,  w: 92,  d: 90,  layout: 4, baseH: 144 },
    { x: 186,  z: -58,  w: 104, d: 90,  layout: 0, baseH: 134 },
    { x: 318,  z: -58,  w: 104, d: 90,  layout: 4, baseH: 124 },
    { x: 450,  z: -58,  w: 104, d: 90,  layout: 3, baseH: 94 },

    // Fileira Sul do Centro / Frente para o Parque Central (Z = +68, D = 104)
    { x: -450, z: 68,   w: 104, d: 104, layout: 0, baseH: 90 },
    { x: -318, z: 68,   w: 104, d: 104, layout: 3, baseH: 115 },
    { x: -186, z: 68,   w: 104, d: 104, layout: 2, baseH: 128 },
    { x: -60,  z: 68,   w: 92,  d: 104, layout: 3, baseH: 118 },
    { x: 60,   z: 68,   w: 92,  d: 104, layout: 1, baseH: 150 },
    { x: 186,  z: 68,   w: 104, d: 104, layout: 2, baseH: 122 },
    { x: 318,  z: 68,   w: 104, d: 104, layout: 0, baseH: 108 },
    { x: 450,  z: 68,   w: 104, d: 104, layout: 3, baseH: 92 }
  ];

  downtownGrid.forEach((blk, idx) => {
    buildUrbanDowntownBlock(world, blk.x, blk.z, blk.w, blk.d, blk.layout, blk.baseH, idx + 1);
  });

  // TRANSIÇÃO CENTRO NORTE (Z = -448): Quarteirões de Prédios Médios (30m a 48m) fechando a calçada
  const transColsX = [-450, -318, -186, -60, 60, 186, 318, 450];
  transColsX.forEach((tx, idx) => {
    const tw = Math.abs(tx) === 60 ? 92 : 104;
    const td = 96;
    const innerW = tw - 10;
    const innerD = td - 10;
    world._addCityBlockSidewalk(tx, -448, tw, td, LEGO_COLORS.sidewalk);

    const lotW = (innerW - 6) * 0.5;
    const s1 = BUILDING_STYLE_KEYS[(idx * 2) % BUILDING_STYLE_KEYS.length];
    const s2 = BUILDING_STYLE_KEYS[(idx * 2 + 3) % BUILDING_STYLE_KEYS.length];
    world.createDetailedBuilding(tx - (lotW + 6) * 0.5, -448, lotW, 34 + (idx % 3) * 5, innerD, s1, {
      seed: idx * 17 + 1
    });
    world.createDetailedBuilding(tx + (lotW + 6) * 0.5, -448, lotW, 28 + ((idx + 1) % 3) * 5, innerD, s2, {
      seed: idx * 17 + 2
    });
    world._addLegoTree(tx, 0.3, -448, 1.15);
  });
}

/**
 * Constrói um Quarteirão Urbano do Centro garantindo FECHAMENTO PERFEITO DA CALÇADA:
 * - Calçada externa tem largura S = 5 nos 4 lados -> Borda edificável exata: innerW = W - 10, innerD = D - 10.
 */
export function buildUrbanDowntownBlock(world, bx, bz, W, D, layoutType, mainHeight, seed) {
  world._addCityBlockSidewalk(bx, bz, W, D, LEGO_COLORS.sidewalk);

  const S = 5;
  const innerW = W - S * 2;
  const innerD = D - S * 2;
  const pickStyle = (offset) => BUILDING_STYLE_KEYS[(seed * 3 + offset) % BUILDING_STYLE_KEYS.length];

  world.downtownBlockLayouts.push({
    x: bx,
    z: bz,
    W,
    D,
    innerW,
    innerD,
    layoutType
  });

  if (layoutType === 0) {
    // MODELO 1: QUADRA DENSA DE 6 EDIFÍCIOS ENCOSTADOS
    const alleyD = 6;
    const rowD = (innerD - alleyD) * 0.5;
    const w1 = Math.round(innerW * 0.34);
    const w2 = Math.round(innerW * 0.32);
    const w3 = innerW - w1 - w2;

    const x1 = bx - innerW * 0.5 + w1 * 0.5;
    const x2 = bx - innerW * 0.5 + w1 + w2 * 0.5;
    const x3 = bx + innerW * 0.5 - w3 * 0.5;
    const zNorth = bz - innerD * 0.5 + rowD * 0.5;
    const zSouth = bz + innerD * 0.5 - rowD * 0.5;

    world.createDetailedBuilding(x1, zNorth, w1, mainHeight, rowD, pickStyle(0), { seed: seed * 11 + 1 });
    world.createDetailedBuilding(x2, zNorth, w2, Math.max(48, mainHeight - 36), rowD, pickStyle(1), { seed: seed * 11 + 2 });
    world.createDetailedBuilding(x3, zNorth, w3, Math.max(54, mainHeight - 22), rowD, pickStyle(2), { seed: seed * 11 + 3 });

    world.createDetailedBuilding(x1, zSouth, w1, Math.max(52, mainHeight - 28), rowD, pickStyle(3), { seed: seed * 11 + 4 });
    world.createDetailedBuilding(x2, zSouth, w2, Math.max(64, mainHeight - 12), rowD, pickStyle(4), { seed: seed * 11 + 5 });
    world.createDetailedBuilding(x3, zSouth, w3, Math.max(46, mainHeight - 38), rowD, pickStyle(5), { seed: seed * 11 + 6 });
  } else if (layoutType === 1) {
    // MODELO 2: ARRANHA-CÉU ESTILO EMPIRE STATE / PODIUM
    world.createDetailedBuilding(bx, bz, innerW, 20, innerD, pickStyle(0), {
      rooftop: true,
      seed: seed * 13 + 1
    });

    const s1W = Math.round(innerW * 0.68);
    const s1D = Math.round(innerD * 0.68);
    const h1 = Math.round(mainHeight * 0.64);
    world.createDetailedBuilding(bx, bz, s1W, h1, s1D, pickStyle(1), {
      groundFloor: false,
      rooftop: true,
      registerMap: false,
      seed: seed * 13 + 2
    });

    const s2W = Math.round(innerW * 0.46);
    const s2D = Math.round(innerD * 0.46);
    const h2 = Math.round(mainHeight * 0.86);
    world.createDetailedBuilding(bx, bz, s2W, h2, s2D, pickStyle(1), {
      groundFloor: false,
      rooftop: true,
      registerMap: false,
      seed: seed * 13 + 3
    });

    const s3W = Math.round(innerW * 0.28);
    const s3D = Math.round(innerD * 0.28);
    world.createDetailedBuilding(bx, bz, s3W, mainHeight, s3D, pickStyle(2), {
      groundFloor: false,
      rooftop: true,
      spire: true,
      spireHeight: 24,
      seed: seed * 13 + 4
    });
  } else if (layoutType === 2) {
    // MODELO 3: QUADRA DE 4 TORRES COM BECO EM CRUZ
    const alley = 6;
    const lotW = (innerW - alley) * 0.5;
    const lotD = (innerD - alley) * 0.5;
    const offX = (lotW + alley) * 0.5;
    const offZ = (lotD + alley) * 0.5;

    const corners = [
      [-offX, -offZ, mainHeight, pickStyle(0)],
      [offX, -offZ, Math.max(56, mainHeight - 24), pickStyle(1)],
      [-offX, offZ, Math.max(62, mainHeight - 16), pickStyle(2)],
      [offX, offZ, Math.max(50, mainHeight - 34), pickStyle(3)]
    ];
    corners.forEach(([dx, dz, ch, st], cIdx) => {
      world.createDetailedBuilding(bx + dx, bz + dz, lotW, ch, lotD, st, {
        seed: seed * 19 + cIdx
      });
    });

    const dumpster = createLegoBrick(2.4, 1.6, 1.8, LEGO_COLORS.green, { studStep: 0.8, castShadow: false });
    dumpster.position.set(bx - 1.5, 0.28 + 0.8, bz);
    const crate = createLegoBrick(1.6, 1.4, 1.6, LEGO_COLORS.brown, { studStep: 0.8, castShadow: false });
    crate.position.set(bx + 1.5, 0.28 + 0.7, bz);
    world.scene.add(dumpster, crate);
  } else if (layoutType === 3) {
    // MODELO 4: COMPLEXO CORPORATIVO EM "U" COM PRAÇA FRONTAL
    const backD = Math.round(innerD * 0.38);
    const wingW = Math.round(innerW * 0.28);
    const wingD = innerD - backD;

    world.createDetailedBuilding(
      bx,
      bz - innerD * 0.5 + backD * 0.5,
      innerW,
      mainHeight,
      backD,
      pickStyle(0),
      { seed: seed * 23 + 1 }
    );

    world.createDetailedBuilding(
      bx - innerW * 0.5 + wingW * 0.5,
      bz - innerD * 0.5 + backD + wingD * 0.5,
      wingW,
      Math.max(54, mainHeight - 28),
      wingD,
      pickStyle(1),
      { seed: seed * 23 + 2 }
    );

    world.createDetailedBuilding(
      bx + innerW * 0.5 - wingW * 0.5,
      bz - innerD * 0.5 + backD + wingD * 0.5,
      wingW,
      Math.max(54, mainHeight - 28),
      wingD,
      pickStyle(1),
      { seed: seed * 23 + 3 }
    );

    const plazaZ = bz + innerD * 0.5 - wingD * 0.5;
    const fountainBase = createLegoBrick(9.5, 0.9, 9.5, LEGO_COLORS.lightGrey, { studStep: 1.5 });
    fountainBase.position.set(bx, 0.28 + 0.45, plazaZ);
    const fountainWater = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.95, 7.5),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    fountainWater.position.set(bx, 0.28 + 0.5, plazaZ);
    const statue = createLegoBrick(2.2, 5.2, 2.2, LEGO_COLORS.gold, { metalness: 0.7, roughness: 0.15 });
    statue.position.set(bx, 0.28 + 2.6, plazaZ);
    world.scene.add(fountainBase, fountainWater, statue);
    world.addCollider(bx, plazaZ, 9.5, 9.5, 4.5, 0.28);

    world._addLegoTree(bx - 11, 0.3, plazaZ + 6, 1.05);
    world._addLegoTree(bx + 11, 0.3, plazaZ + 6, 1.05);
  } else {
    // MODELO 5: QUADRA TIMES SQUARE (NEON & TELÕES COLORIDOS)
    const alley = 4;
    const lotW = (innerW - alley) * 0.5;
    const lotD = (innerD - alley) * 0.5;
    const offX = (lotW + alley) * 0.5;
    const offZ = (lotD + alley) * 0.5;

    const tsBuildings = [
      [-offX, -offZ, mainHeight, 'black_granite_gold'],
      [offX, -offZ, Math.max(66, mainHeight - 18), 'sapphire_glass'],
      [-offX, offZ, Math.max(72, mainHeight - 12), 'cyan_modern'],
      [offX, offZ, Math.max(60, mainHeight - 24), 'silver_corporate']
    ];
    tsBuildings.forEach(([dx, dz, th, st], tIdx) => {
      world.createDetailedBuilding(bx + dx, bz + dz, lotW, th, lotD, st, {
        seed: seed * 29 + tIdx
      });
    });

    const neonPalette = [0xef4444, 0x00f0ff, 0xfacc15, 0xec4899, 0x22c55e];
    for (let b = 0; b < 4; b++) {
      const nColor = neonPalette[(seed + b) % neonPalette.length];
      const nMat = new THREE.MeshBasicMaterial({ color: nColor });
      const screenZ = b < 2 ? bz - innerD * 0.5 - 0.45 : bz + innerD * 0.5 + 0.45;
      const screenX = b % 2 === 0 ? bx - offX : bx + offX;
      const screen = new THREE.Mesh(new THREE.BoxGeometry(lotW * 0.76, 9.5, 0.6), nMat);
      screen.position.set(screenX, 16 + (b % 2) * 11, screenZ);
      world.scene.add(screen);
    }
  }
}

