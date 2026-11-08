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
 * 8. REGIÃO OESTE — AEROPORTO METROPOLITANO & BASE MILITAR TERRESTRE (LAYOUT DENSO E MONUMENTAL)
 * - 1. Rodovia Expressa + Perímetro com Guaritas + GRANDE ESTACIONAMENTO COM CATRACAS/CANCELAS na entrada
 *      (X = -1022 a -1096, Z = -460 a +460), com dezenas de vagas pintadas, coberturas e carros estacionados!
 * - 2. MEGA TERMINAL INTERNACIONAL LEGO (X = -1145, Z = -480 a +480 -> 960m de comprimento cobrindo toda a
 *      frente com a cidade, 92m de largura e 32m de pé-direito livre!), 100% ENTRÁVEL por 5 portais frontais
 *      e 5 portais traseiros, com interior decorado: balcões de check-in, telões de voos, esteiras de bagagem,
 *      portais de raio-X, dezenas de fileiras de cadeiras de espera e lojas Duty Free!
 * - 3. QUARTEIRÕES FORMADOS PELAS PISTAS MENORES (TAXIWAYS) LOTADOS COM 16 GALPÕES/HANGARES ENFILEIRADOS
 *      (8 Hangares Azuis/Brancos na Ala Civil Norte + 8 Hangares Verdes/Cinzas na Ala Militar Sul), todos de
 *      teto arqueado e portas abertas, recheados de Jatos Executivos, Aviões Comerciais, Caças Supersônicos,
 *      Helicópteros de Ataque com hélices girando, Caminhões-Tanque Explosivos, Tanques e Caixas Militares!
 * - 4. 3 TORRES DE CONTROLE GIGANTES BRANCAS E VERMELHAS (124m de altura cada!) posicionadas RENTES À PISTA
 *      PRINCIPAL (X = -1582, em Z = -360, Z = 0 e Z = +360), com cabine octogonal 360° e Radar Giratório!
 * - 5. PISTA DE POUSO REAL (RUNWAY 09 / 27 em X = -1660, 96m x 1220m) com piano keys, números 09/27, linha
 *      central tracejada, luzes luminosas (verdes, brancas/amarelas e vermelhas) e 2 birutas laranja/branca!
 */
export function buildWestHighwayAndAirport(world) {
  const groundY = 0.28;

  // Grande Plataforma Continental de Concreto Aeronáutico do Complexo Oeste (X = -1015 a -1825, Z = -660 a +660)
  world._addCityBlockSidewalk(-1420, 0, 810, 1320, LEGO_COLORS.concrete);
  // Expansão Noroeste: Ala Militar Norte da Base (X = -1015 a -1825, Z = -1320 a -660 — encostando 100% na borda Norte da ilha!)
  world._addCityBlockSidewalk(-1420, -990, 810, 660, LEGO_COLORS.concrete);

  const batcher = createWestBatcher();

  // 1. Rodovia Expressa + Perímetro de Segurança + Grande Estacionamento com Catracas/Cancelas na entrada
  buildExpresswaySecurityAndParkingLot(world, batcher, groundY);

  // 2. Mega Terminal Internacional LEGO de 960m (100% Entrável e com Interior Decorado!)
  buildColossalEnterableAirportTerminal(world, batcher, groundY);

  // 3. Quarteirões das Pistas Menores (Taxiways) lotados com 16 Galpões/Hangares Verdes e Azuis Enfileirados
  buildTaxiwayBlocksAnd16RowHangars(world, batcher, groundY);

  // 4. 3 Torres de Controle Gigantes Brancas e Vermelhas (124m!) Rentes à Pista Principal + Runway 09/27
  buildThreeRunwayAtcTowersAndMainRunway(world, batcher, groundY);

  // 5. ALA MILITAR NORTE DA BASE (Canto Noroeste: Quartel Militar, Pátio de Tanques, 4 Baterias Antiaéreas, Helipontos e Hangares Extras!)
  buildNorthMilitaryBaseWing(world, batcher, groundY);

  batcher.flush(world.scene);

  world.westAirportData = {
    terminalLength: 960,
    terminalEnterable: true,
    parkingLotWithTurnstiles: true,
    atcTowersCount: 3,
    atcTowerHeight: 124,
    runwayLength: 1220,
    runwayWidth: 96,
    openHangarsCount: 16,
    extraNorthMilitaryHangarsCount: 4,
    hasNorthMilitaryWing: true,
    hasMilitaryBarracks: true,
    hasTankYard: true,
    antiAirBatteriesCount: 4,
    militaryHelipadsCount: 2,
    fighterJetsCount: 8,
    attackHelicoptersCount: 6,
    explosiveFuelTrucksCount: 4,
    militaryCratesCount: 16
  };
}

function createWestBatcher() {
  const palette = {
    steel_silver: new THREE.MeshStandardMaterial({ color: LEGO_COLORS.silver, metalness: 0.45, roughness: 0.25 }),
    steel_dark: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.35 }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42 }),
    asphalt_dark: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.68 }),
    concrete_wall: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45 }),
    terminal_floor: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.22, metalness: 0.08 }),
    white_clean: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.22 }),
    aviation_red: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.24 }),
    aviation_blue: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.22 }),
    sky_blue: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.24 }),
    highway_green: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.28 }),
    military_olive: new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.34 }),
    military_dark: new THREE.MeshStandardMaterial({ color: 0x1a2e05, roughness: 0.38 }),
    camo_tan: new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.36 }),
    gold_trim: new THREE.MeshStandardMaterial({ color: LEGO_COLORS.gold, metalness: 0.5, roughness: 0.22 }),
    orange_windsock: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.28 }),
    glass_mirror: new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.14,
      metalness: 0.35,
      emissive: 0x0284c7,
      emissiveIntensity: 0.18
    }),
    glass_cockpit: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.28,
      emissive: 0x0369a1,
      emissiveIntensity: 0.22
    }),
    mark_white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mark_yellow: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    light_green: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    light_red: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    light_warm: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    light_cyan: new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  };

  const shadowCasterKeys = new Set([
    'white_clean',
    'aviation_red',
    'aviation_blue',
    'military_olive',
    'military_dark',
    'concrete_wall'
  ]);

  const buckets = new Map();
  for (const k of Object.keys(palette)) {
    buckets.set(k, []);
  }

  return {
    addBox(key, w, h, d, x, y, z) {
      buckets.get(key).push(makeTranslatedBox(w, h, d, x, y, z));
    },
    flush(scene) {
      for (const [key, geos] of buckets.entries()) {
        if (geos.length === 0) continue;
        const mesh = new THREE.Mesh(mergeBufferGeometries(geos), palette[key]);
        if (shadowCasterKeys.has(key)) {
          mesh.castShadow = true;
        }
        mesh.receiveShadow = true;
        scene.add(mesh);
      }
    }
  };
}

/**
 * 1. RODOVIA EXPRESSA + PERÍMETRO DE SEGURANÇA + GRANDE ESTACIONAMENTO COM CATRACAS/CANCELAS!
 */
function buildExpresswaySecurityAndParkingLot(world, batcher, groundY) {
  // Pórtico de Acesso ao Aeroporto e Base Militar posicionado na entrada do perímetro Oeste (sem cortar a Favela!)
  const gantries = [
    { x: -1018, z: -117, text: 'AEROPORTO / BASE MILITAR ' },
    { x: -1018, z: 0,    text: 'MEGA TERMINAL & ESTACIONAMENTO ' },
    { x: -1018, z: 134,  text: 'BASE MILITAR & HANGARES ' }
  ];
  for (const g of gantries) {
    batcher.addBox('steel_silver', 1.2, 11.5, 1.2, g.x, 5.75, g.z - 16.5);
    batcher.addBox('steel_silver', 1.2, 11.5, 1.2, g.x, 5.75, g.z + 16.5);
    batcher.addBox('steel_silver', 1.0, 1.2, 34.2, g.x, 11.2, g.z);
    world.addCollider(g.x, g.z - 16.5, 1.4, 1.4, 11.5, 0);
    world.addCollider(g.x, g.z + 16.5, 1.4, 1.4, 11.5, 0);
    addHighwayGreenSign(world, g.x, 11.2, g.z, 28.0, 4.2, g.text);
  }

  // Perímetro de Segurança em X = -1020 (Z = -650 a +650) com 5 Entradas de Catraca/Cancela!
  const fenceX = -1020;
  const isGateZ = (z) =>
    Math.abs(z + 340) < 18 ||
    Math.abs(z + 117) < 20 ||
    Math.abs(z) < 22 ||
    Math.abs(z - 134) < 20 ||
    Math.abs(z - 340) < 18;

  for (let fz = -640; fz <= 640; fz += 20) {
    if (isGateZ(fz)) continue;
    batcher.addBox('concrete_wall', 1.2, 1.4, 19.6, fenceX, groundY + 0.7, fz);
    batcher.addBox('steel_dark', 0.45, 2.8, 0.45, fenceX, groundY + 2.8, fz - 9.5);
    batcher.addBox('steel_silver', 0.2, 0.25, 19.6, fenceX, groundY + 2.6, fz);
    batcher.addBox('steel_silver', 0.2, 0.25, 19.6, fenceX, groundY + 3.9, fz);
    world.addCollider(fenceX, fz, 1.4, 19.8, groundY + 4.3, groundY);
  }

  // ============================================================================
  // CABINES DE ENTRADA COM CATRACAS / CANCELAS AUTOMÁTICAS E TOTENS DE TICKET (X = -1028)
  // ============================================================================
  for (const gz of [-340, -117, 0, 134, 340]) {
    // Pórtico superior da Entrada de Catracas/Cancelas
    batcher.addBox('aviation_blue', 4.2, 1.6, 36.0, -1026, groundY + 7.8, gz);
    for (const side of [-1, 1]) {
      const bz = gz + side * 17.5;
      // Guarita de Cobrança / Segurança na Entrada
      batcher.addBox('white_clean', 5.8, 4.2, 4.4, -1026, groundY + 2.1, bz);
      batcher.addBox('glass_cockpit', 6.0, 1.6, 3.8, -1026, groundY + 2.5, bz);
      batcher.addBox('aviation_blue', 6.6, 0.65, 5.2, -1026, groundY + 4.5, bz);
      world.addCollider(-1026, bz, 6.0, 4.6, groundY + 4.8, groundY);

      // Totem Amarelo de Ticket + Catraca / Cancela Automática Vermelha e Branca!
      const turnstileZ = gz + side * 11.2;
      batcher.addBox('mark_yellow', 1.2, 2.1, 1.0, -1028, groundY + 1.05, turnstileZ);
      batcher.addBox('light_green', 0.4, 0.4, 0.4, -1028, groundY + 2.25, turnstileZ);
      // Braço da Cancela/Catraca Listrado (semi-erguido para não travar a passagem!)
      batcher.addBox('aviation_red', 0.3, 0.3, 4.2, -1028, groundY + 3.6, turnstileZ - side * 2.2);
      batcher.addBox('white_clean', 0.32, 0.32, 2.0, -1028, groundY + 3.6, turnstileZ - side * 2.2);
    }
  }
  addHighwayGreenSign(world, -1024, groundY + 9.2, 0, 34.0, 3.8, 'ESTACIONAMENTO & EMBARQUE ');

  // ============================================================================
  // GRANDE ESTACIONAMENTO NA FRENTE DO MEGA TERMINAL (X = -1034 a -1094, Z = -460 a +460)
  // ============================================================================
  batcher.addBox('asphalt_dark', 58, 0.08, 920, -1064, groundY + 0.04, 0);

  // 4 Grandes Setores de Vagas Demarcadas no Estacionamento + Coberturas Solares + Carros Estacionados!
  const parkingSectorsZ = [
    [-440, -195],
    [-160, -35],
    [35, 160],
    [195, 440]
  ];
  const parkedColors = ['aviation_red', 'aviation_blue', 'white_clean', 'gold_trim', 'highway_green', 'orange_windsock'];
  let carSeed = 0;

  for (const [zStart, zEnd] of parkingSectorsZ) {
    const secLen = zEnd - zStart;
    const secMidZ = (zStart + zEnd) * 0.5;

    // Cobertura Solar Branca e Azul sobre as duas fileiras de carros do setor
    for (const rowX of [-1044, -1078]) {
      batcher.addBox('steel_dark', 0.5, 4.2, secLen - 6, rowX, groundY + 2.1, secMidZ);
      batcher.addBox('white_clean', 11.5, 0.4, secLen, rowX, groundY + 4.3, secMidZ);
      batcher.addBox('aviation_blue', 11.8, 0.25, secLen + 0.4, rowX, groundY + 4.55, secMidZ);

      // Dezenas de Linhas Brancas de Vagas + Carros Estacionados nas Baias!
      for (let vz = zStart + 8; vz <= zEnd - 8; vz += 10.5) {
        batcher.addBox('mark_white', 8.5, 0.04, 0.3, rowX, groundY + 0.09, vz - 4.8);
        // Pula as 4 vagas onde já estão os veículos dirigíveis da frota (Z = -95, -65, +65, +95)
        if (Math.abs(vz + 95) < 8 || Math.abs(vz + 65) < 8 || Math.abs(vz - 65) < 8 || Math.abs(vz - 95) < 8) {
          continue;
        }
        if (carSeed % 3 !== 2) {
          const cKey = parkedColors[carSeed % parkedColors.length];
          addParkedAirportCar(batcher, rowX, groundY + 0.08, vz, cKey);
          world.addCollider(rowX, vz, 4.8, 2.5, groundY + 1.8, groundY);
        }
        carSeed++;
      }
    }
  }
}

function addParkedAirportCar(batcher, x, yBase, z, colorKey) {
  batcher.addBox('charcoal', 4.6, 0.45, 2.3, x, yBase + 0.25, z);
  batcher.addBox(colorKey, 4.5, 0.65, 2.2, x, yBase + 0.72, z);
  batcher.addBox('glass_cockpit', 2.4, 0.55, 2.0, x + 0.2, yBase + 1.25, z);
  batcher.addBox(colorKey, 2.2, 0.22, 2.05, x + 0.2, yBase + 1.58, z);
}

/**
 * 2. MEGA TERMINAL INTERNACIONAL LEGO DE 960m DE EXTENSÃO (X = -1145, Z = -480 a +480)
 * - Cobre quase toda a frente do Aeroporto voltada para a cidade!
 * - 100% ENTRÁVEL por 5 Portais Frontais (X = -1099) e 5 Portais Traseiros (X = -1191)!
 * - Interior Decorado: Piso de granito, 8 Balcões de Check-In com Computadores e Telões de Voos,
 *   4 Esteiras Rolantes de Bagagem, 5 Pórticos de Raio-X, Bancos de Espera e Quiosques Duty Free!
 */
function buildColossalEnterableAirportTerminal(world, batcher, groundY) {
  const termX = -1145;
  const termZ = 0;
  const termW = 92;  // X = -1191 (Fundo/Pátio) até X = -1099 (Frente/Estacionamento)
  const termD = 960; // Z = -480 até Z = +480!
  const wallH = 30.0; // 30m de pé-direito livre interno!
  const floorY = groundY + 0.18;

  // 1. Piso Interno Polido do Mega Terminal (92m x 960m!) + Faixas Guia Azuis de Embarque
  batcher.addBox('terminal_floor', termW, 0.18, termD, termX, groundY + 0.09, termZ);
  batcher.addBox('aviation_blue', 8.0, 0.04, termD - 16, termX, floorY + 0.02, termZ);
  for (const doorZ of [-340, -170, 0, 170, 340]) {
    batcher.addBox('aviation_blue', termW - 4, 0.04, 10.0, termX, floorY + 0.025, doorZ);
  }

  // 2. Paredes Norte (Z = -478.5) e Sul (Z = +478.5) fechando as extremidades do Mega Terminal
  batcher.addBox('white_clean', termW, wallH, 3.0, termX, floorY + wallH * 0.5, -478.5);
  batcher.addBox('white_clean', termW, wallH, 3.0, termX, floorY + wallH * 0.5, 478.5);
  world.addCollider(termX, -478.5, termW, 3.0, floorY + wallH, floorY);
  world.addCollider(termX, 478.5, termW, 3.0, floorY + wallH, floorY);

  // 3. Fachadas Leste (Frente X = -1100.5) e Oeste (Fundo X = -1189.5) divididas em 6 blocos
  //    para deixar 5 PORTAIS DE ENTRADA/SAÍDA DE 28m DE LARGURA TOTALMENTE ABERTOS!
  //    Portais abertos em: Z = -340, Z = -170, Z = 0, Z = +170 e Z = +340
  const wallSegmentsZ = [
    [-477, -354],
    [-326, -184],
    [-156, -14],
    [14, 156],
    [184, 326],
    [354, 477]
  ];

  for (const [z1, z2] of wallSegmentsZ) {
    const segD = z2 - z1;
    const segMidZ = (z1 + z2) * 0.5;
    for (const wallX of [termX + termW * 0.5 - 1.5, termX - termW * 0.5 + 1.5]) {
      batcher.addBox('white_clean', 3.0, 5.0, segD, wallX, floorY + 2.5, segMidZ);
      batcher.addBox('glass_mirror', 2.8, wallH - 5.0, segD, wallX, floorY + 5.0 + (wallH - 5.0) * 0.5, segMidZ);
      world.addCollider(wallX, segMidZ, 3.0, segD, floorY + wallH, floorY);
    }
  }

  // Vergas/Lintéis Superiores acima dos 5 Portais Abertos (de Y = 18m a Y = 30m -> 18m livres para entrar!)
  for (const doorZ of [-340, -170, 0, 170, 340]) {
    for (const wallX of [termX + termW * 0.5 - 1.5, termX - termW * 0.5 + 1.5]) {
      batcher.addBox('aviation_blue', 3.4, 12.0, 28.0, wallX, floorY + 24.0, doorZ);
      world.addCollider(wallX, doorZ, 3.4, 28.0, floorY + wallH, floorY + 18.0);
    }
  }

  // 4. Cobertura Metálica Branca Aerodinâmica de 968m + 24 Pares de Pilares em "V" na Fachada Frontal!
  batcher.addBox('white_clean', termW + 20, 2.8, termD + 8, termX + 3.0, floorY + wallH + 1.4, termZ);
  batcher.addBox('aviation_blue', termW + 22, 0.9, termD + 10, termX + 3.0, floorY + wallH + 3.2, termZ);
  world.addCollider(termX + 3.0, termZ, termW + 20, termD + 8, floorY + wallH + 3.6, floorY + wallH - 0.2);

  const vPillarX = termX + termW * 0.5 + 8.0; // X = -1091
  for (let pz = -450; pz <= 450; pz += 38) {
    if (Math.abs(pz) < 16 || Math.abs(pz - 170) < 16 || Math.abs(pz + 170) < 16 || Math.abs(pz - 340) < 16 || Math.abs(pz + 340) < 16) {
      continue;
    }
    batcher.addBox('white_clean', 1.4, wallH, 1.4, vPillarX, floorY + wallH * 0.5, pz - 2.6);
    batcher.addBox('white_clean', 1.4, wallH, 1.4, vPillarX, floorY + wallH * 0.5, pz + 2.6);
    batcher.addBox('steel_dark', 2.4, 1.2, 6.8, vPillarX, floorY + 0.6, pz);
  }

  // 3 Letreiros Gigantes no Topo do Mega Terminal
  addHighwayGreenSign(world, termX + 48, floorY + wallH + 6.5, 0, 96.0, 6.8, 'TERMINAL INTERNACIONAL LEGO ');
  addHighwayGreenSign(world, termX + 48, floorY + wallH + 5.8, -280, 64.0, 5.2, 'EMBARQUE DOMÉSTICO & CARGAS ');
  addHighwayGreenSign(world, termX + 48, floorY + wallH + 5.8, 280, 64.0, 5.2, 'ALA AÉREA & COMANDO MILITAR ');

  // 8 Pontes de Embarque Telescópicas ("Jetways") saindo da parte traseira do Terminal (X = -1202)
  for (const jz of [-415, -255, -115, -45, 45, 115, 255, 415]) {
    batcher.addBox('steel_silver', 22.0, 4.2, 4.6, termX - termW * 0.5 - 11.0, floorY + 11.5, jz);
    batcher.addBox('glass_cockpit', 20.0, 2.2, 4.8, termX - termW * 0.5 - 11.0, floorY + 11.8, jz);
  }

  // ============================================================================
  // 5. DECORAÇÃO INTERNA DO MEGA TERMINAL (CHECK-IN, TELÕES, ESTEIRAS DE MALAS, RAIO-X E ASSENTOS!)
  // ============================================================================
  // A) 6 Grandes Ilhas de Balcões de Check-In + Painéis Azuis Luminosos de Voos (X = -1122)
  const checkInZonesZ = [-415, -255, -85, 85, 255, 415];
  for (const cz of checkInZonesZ) {
    // Balcão longo de Check-In (36m de extensão) com computadores e balanças
    batcher.addBox('white_clean', 3.6, 1.4, 36.0, -1122, floorY + 0.7, cz);
    batcher.addBox('aviation_blue', 3.8, 0.3, 36.4, -1122, floorY + 1.55, cz);
    for (let mz = cz - 14; mz <= cz + 14; mz += 7) {
      batcher.addBox('charcoal', 0.45, 0.9, 1.4, -1121.5, floorY + 2.15, mz);
      batcher.addBox('light_cyan', 0.5, 0.7, 1.2, -1121.4, floorY + 2.15, mz);
      // Balança de bagagem com mala em cima
      batcher.addBox('steel_dark', 2.2, 0.25, 1.8, -1122, floorY + 0.15, mz + 3.2);
      batcher.addBox('aviation_red', 1.4, 1.1, 0.9, -1122, floorY + 0.8, mz + 3.2);
    }
    // Grande Painel Eletrônico Suspenso de Voos ("PARTIDAS / CHEGADAS") acima do Check-In
    batcher.addBox('charcoal', 1.4, 4.8, 28.0, -1125, floorY + 11.5, cz);
    batcher.addBox('light_cyan', 1.6, 4.0, 26.8, -1124.8, floorY + 11.5, cz);
    world.addCollider(-1122, cz, 3.8, 36.4, floorY + 2.6, floorY);
  }

  // B) 4 Esteiras Rolantes de Bagagem (Carrosséis de Malas) com Malas Coloridas (X = -1145)
  for (const bz of [-380, -120, 120, 380]) {
    batcher.addBox('steel_silver', 9.5, 0.75, 24.0, -1145, floorY + 0.38, bz);
    batcher.addBox('charcoal', 7.5, 0.82, 22.0, -1145, floorY + 0.42, bz);
    for (let lz = bz - 8; lz <= bz + 8; lz += 4) {
      batcher.addBox('orange_windsock', 1.5, 1.0, 1.1, -1142, floorY + 1.3, lz);
      batcher.addBox('sky_blue', 1.5, 1.0, 1.1, -1148, floorY + 1.3, lz + 1.5);
    }
    world.addCollider(-1145, bz, 9.5, 24.0, floorY + 1.4, floorY);
  }

  // C) Pórticos de Raio-X / Detector de Metais e Dezenas de Fileiras de Poltronas Azuis de Espera (X = -1168)
  for (const sz of [-255, -85, 85, 255]) {
    // 4 Fileiras de Poltronas de Espera por Portão de Embarque
    for (let rx = -1174; rx <= -1160; rx += 4.5) {
      batcher.addBox('steel_silver', 1.6, 0.35, 18.0, rx, floorY + 0.25, sz);
      batcher.addBox('aviation_blue', 1.4, 0.55, 17.6, rx, floorY + 0.65, sz);
      batcher.addBox('aviation_blue', 0.45, 1.1, 17.6, rx - 0.5, floorY + 1.25, sz);
      world.addCollider(rx, sz, 1.6, 18.0, floorY + 1.8, floorY);
    }
  }

  // D) Colunas Internas Cilíndricas e Lustres Modernos no teto de 30m do Terminal
  for (let cz = -420; cz <= 420; cz += 60) {
    for (const cx of [-1128, -1162]) {
      batcher.addBox('white_clean', 2.4, wallH, 2.4, cx, floorY + wallH * 0.5, cz);
      batcher.addBox('light_warm', 6.5, 0.6, 6.5, cx, floorY + wallH - 0.5, cz);
      world.addCollider(cx, cz, 2.4, 2.4, floorY + wallH, floorY);
    }
  }

  world.mapBuildings.push({
    x: termX,
    z: termZ,
    w: termW,
    d: termD,
    height: wallH + 4,
    color: '#0284c7',
    label: 'MEGA TERMINAL INTERNACIONAL'
  });
}

/**
 * 3. QUARTEIRÕES ENTRE AS PISTAS MENORES (TAXIWAYS) LOTADOS DE GALPÕES / HANGARES ENFILEIRADOS!
 * - 5 Pistas Menores Horizontais (Z = -560, -280, 0, +280, +560) e 3 Ruas de Pátio Verticais
 *   (X = -1215, -1380, -1545) formando 4 Grandes Quarteirões Aeronáuticos!
 * - Cada quarteirão tem 4 Grandes Galpões/Hangares de Teto Arqueado Enfileirados (16 Hangares no total!):
 *   - 8 Galpões Azuis/Brancos nos 2 Quarteirões Norte (Aviação Civil, Executiva e Cargas)
 *   - 8 Galpões Verdes-Militares/Cinzas nos 2 Quarteirões Sul (Base Militar, Caças, Helicópteros e Tanques)
 */
function buildTaxiwayBlocksAnd16RowHangars(world, batcher, groundY) {
  // 1. Pistas Menores Horizontais (Taxiways Leste-Oeste ligando o Mega Terminal à Pista Principal!)
  const taxiwaysZ = [-560, -280, 0, 280, 560];
  for (const tz of taxiwaysZ) {
    batcher.addBox('asphalt_dark', 420, 0.1, 30, -1410, groundY + 0.05, tz);
    batcher.addBox('mark_yellow', 420, 0.04, 0.65, -1410, groundY + 0.11, tz);
    world.mapRoads.push({ x: -1410, z: tz, w: 420, d: 30, isMain: false });
  }

  // 2. Ruas de Taxiamento Verticais (Norte-Sul em X = -1215, X = -1380 e X = -1545)
  for (const tx of [-1215, -1380, -1545]) {
    batcher.addBox('asphalt_dark', 26, 0.1, 1150, tx, groundY + 0.05, 0);
    batcher.addBox('mark_yellow', 0.65, 0.04, 1150, tx, groundY + 0.11, 0);
    world.mapRoads.push({ x: tx, z: 0, w: 26, d: 1150, isMain: false });
  }

  // ============================================================================
  // 3. OS 16 GRANDES GALPÕES / HANGARES ENFILEIRADOS DENTRO DOS 4 QUARTEIRÕES!
  //    2 Colunas de X (-1298 e -1462) x 8 Fileiras de Z:
  //    - Quarteirão 1 (Norte Extremo): Z = -475, Z = -365 (Azuis/Brancos)
  //    - Quarteirão 2 (Norte Central): Z = -195, Z = -85  (Azuis/Brancos)
  //    - Quarteirão 3 (Sul Central):   Z = +85,  Z = +195 (Verdes/Cinzas Militares)
  //    - Quarteirão 4 (Sul Extremo):   Z = +365, Z = +475 (Verdes/Cinzas Militares)
  // ============================================================================
  const hangarColsX = [-1298, -1462];
  const hangarRowsZ = [-475, -365, -195, -85, 85, 195, 365, 475];

  for (const hx of hangarColsX) {
    for (let r = 0; r < hangarRowsZ.length; r++) {
      const hz = hangarRowsZ[r];
      const isMilitary = hz > 0;
      const wallKey = isMilitary
        ? (r % 2 === 0 ? 'military_olive' : 'steel_dark')
        : (r % 2 === 0 ? 'white_clean' : 'sky_blue');
      const roofKey = isMilitary
        ? (r % 2 === 0 ? 'military_dark' : 'military_olive')
        : 'aviation_blue';
      const label = isMilitary ? 'GALPÃO MILITAR' : 'HANGAR CIVIL';

      buildOpenArchedHangar(world, batcher, hx, groundY, hz, 88, 72, 22, wallKey, roofKey, label);
    }
  }

  // ============================================================================
  // 4. AERONAVES, CAÇAS, HELICÓPTEROS, CAMINHÕES-TANQUE E CAIXAS DENTRO E AO LADO DOS 16 GALPÕES!
  //    (Os Aviões Comerciais, Jatos VIP, Caças F-99 e Helicópteros agora são pilotáveis em NavalAndAirFleetBuilder.js!)
  // ============================================================================

  // D) 4 Caminhões-Tanque de Combustível de Aviação (Explosivos!) distribuídos pelos Quarteirões!
  for (const [tx, tz] of [[-1380, -310], [-1380, -30], [-1380, 45], [-1380, 320]]) {
    spawnExplosiveFuelTruck(world, tx, groundY, tz);
  }

  // E) 16 Caixas Militares Verdes Quebráveis nos Galpões Militares + 2 Torres de Vigia!
  for (const hx of [-1270, -1325, -1435, -1490]) {
    for (const hz of [70, 180, 350, 460]) {
      spawnMilitaryCrate(world, hx, groundY, hz);
    }
  }
  buildMilitaryWatchtower(world, batcher, -1215, groundY, 320);
  buildMilitaryWatchtower(world, batcher, -1215, groundY, 520);
}

/**
 * 4. AS 3 TORRES DE CONTROLE GIGANTES BRANCAS E VERMELHAS (124m!) RENTES À PISTA PRINCIPAL
 *       + PISTA DE POUSO REAL (RUNWAY 09 / 27) COM LUZES E BIRUTAS!
 */
function buildThreeRunwayAtcTowersAndMainRunway(world, batcher, groundY) {
  // ============================================================================
  // 4A. TRÊS TORRES DE CONTROLE GIGANTES (124m!) RENTES À BORDA DA PISTA PRINCIPAL (X = -1582)
  // ============================================================================
  const atcPositionsZ = [-360, 0, 360];
  for (let i = 0; i < atcPositionsZ.length; i++) {
    buildSingleGiantAtcTower(world, batcher, -1582, groundY, atcPositionsZ[i], i + 1);
  }

  // ============================================================================
  // 4B. PISTA PRINCIPAL DE POUSO E DECOLAGEM (RUNWAY 09 / 27 em X = -1660, 96m x 1220m)
  // ============================================================================
  const rwX = -1660;
  const rwZ = 0;
  const rwW = 96;
  const rwD = 1220;

  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.68 });
  const runway = new THREE.Mesh(new THREE.BoxGeometry(rwW, 0.14, rwD), runwayMat);
  runway.position.set(rwX, groundY + 0.05, rwZ);
  runway.receiveShadow = true;
  world.scene.add(runway);
  world.mapRoads.push({ x: rwX, z: rwZ, w: rwW, d: rwD, isMain: true });

  const markY = groundY + 0.13;

  // Linhas Laterais Contínuas + Linha Central Tracejada Branca
  batcher.addBox('mark_white', 1.2, 0.03, rwD - 20, rwX - rwW * 0.5 + 3.5, markY, rwZ);
  batcher.addBox('mark_white', 1.2, 0.03, rwD - 20, rwX + rwW * 0.5 - 3.5, markY, rwZ);
  for (let dz = -460; dz <= 460; dz += 42) {
    batcher.addBox('mark_white', 1.8, 0.03, 22.0, rwX, markY, dz);
  }

  // Cabeceiras ("Piano Keys") e Zonas de Toque nas duas pontas
  for (const endZ of [-580, 580]) {
    for (let px = -36; px <= 36; px += 9) {
      if (Math.abs(px) < 3) continue;
      batcher.addBox('mark_white', 4.2, 0.03, 28.0, rwX + px, markY, endZ);
    }
    const tdZ = endZ > 0 ? 490 : -490;
    batcher.addBox('mark_white', 8.0, 0.03, 22.0, rwX - 18, markY, tdZ);
    batcher.addBox('mark_white', 8.0, 0.03, 22.0, rwX + 18, markY, tdZ);
  }

  // Números "09" e "27" na Pista
  drawRunwayNumber09(batcher, rwX, markY, -535);
  drawRunwayNumber27(batcher, rwX, markY, 535);

  // Fileiras de Luzes de Pista Luminosas (Verdes no início, Brancas/Amarelas nas laterais, Vermelhas no fim)
  for (let lx = -44; lx <= 44; lx += 8) {
    batcher.addBox('light_green', 0.9, 0.45, 0.9, rwX + lx, groundY + 0.3, -606);
    batcher.addBox('light_red', 0.9, 0.45, 0.9, rwX + lx, groundY + 0.3, 606);
  }
  for (let lz = -590; lz <= 590; lz += 28) {
    const sideLightKey = Math.abs(lz) > 420 ? 'mark_yellow' : 'light_warm';
    batcher.addBox(sideLightKey, 0.85, 0.5, 0.85, rwX - rwW * 0.5 - 1.5, groundY + 0.32, lz);
    batcher.addBox(sideLightKey, 0.85, 0.5, 0.85, rwX + rwW * 0.5 + 1.5, groundY + 0.32, lz);
    batcher.addBox('mark_white', 0.55, 0.12, 0.55, rwX, groundY + 0.14, lz);
  }

  // 2 Birutas Laranja e Branca (Windsocks) ao lado da Pista Principal
  for (const wz of [-450, 450]) {
    const wx = rwX + rwW * 0.5 + 10; // -1602 (entre a pista e as torres!)
    batcher.addBox('steel_silver', 0.45, 9.5, 0.45, wx, groundY + 4.75, wz);
    for (let s = 0; s < 5; s++) {
      const segW = 1.6 - s * 0.22;
      batcher.addBox(
        s % 2 === 0 ? 'orange_windsock' : 'white_clean',
        1.1,
        segW,
        segW,
        wx + 1.0 + s * 1.05,
        groundY + 9.2 - s * 0.12,
        wz
      );
    }
  }
}

function buildSingleGiantAtcTower(world, batcher, atcX, groundY, atcZ, towerIndex) {
  const shaftH = 98.0;

  batcher.addBox('concrete_wall', 22, 10, 22, atcX, groundY + 5, atcZ);
  for (let s = 0; s < 9; s++) {
    const segY = groundY + 10 + s * 9.8;
    const segW = 15.5 - s * 0.42;
    const matKey = s % 2 === 0 ? 'white_clean' : 'aviation_red';
    batcher.addBox(matKey, segW, 9.8, segW, atcX, segY + 4.9, atcZ);
  }

  for (const [dx, dz] of [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]]) {
    batcher.addBox('steel_silver', 1.2, shaftH, 1.2, atcX + dx, groundY + shaftH * 0.5, atcZ + dz);
  }

  const deckY = groundY + shaftH;
  batcher.addBox('steel_dark', 26.0, 1.8, 26.0, atcX, deckY + 0.9, atcZ);
  batcher.addBox('white_clean', 26.4, 1.3, 0.5, atcX, deckY + 2.4, atcZ - 13.0);
  batcher.addBox('white_clean', 26.4, 1.3, 0.5, atcX, deckY + 2.4, atcZ + 13.0);
  batcher.addBox('white_clean', 0.5, 1.3, 26.4, atcX - 13.0, deckY + 2.4, atcZ);
  batcher.addBox('white_clean', 0.5, 1.3, 26.4, atcX + 13.0, deckY + 2.4, atcZ);

  const cabCore = new THREE.Mesh(
    new THREE.CylinderGeometry(11.2, 9.2, 10.5, 8),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.06,
      metalness: 0.18,
      clearcoat: 0.95,
      transparent: true,
      opacity: 0.76
    })
  );
  cabCore.position.set(atcX, deckY + 7.0, atcZ);
  const cabRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(12.0, 11.6, 2.2, 8),
    getLegoMaterial(LEGO_COLORS.white)
  );
  cabRoof.position.set(atcX, deckY + 13.2, atcZ);
  world.scene.add(cabCore, cabRoof);

  const topRoofY = deckY + 14.3;
  batcher.addBox('aviation_red', 5.0, 4.8, 5.0, atcX, topRoofY + 2.4, atcZ);
  batcher.addBox('steel_silver', 0.6, 11.5, 0.6, atcX - 5.5, topRoofY + 5.75, atcZ - 5.5);
  batcher.addBox('light_red', 1.2, 1.2, 1.2, atcX - 5.5, topRoofY + 11.8, atcZ - 5.5);

  const radarGroup = new THREE.Group();
  radarGroup.position.set(atcX, topRoofY + 6.4, atcZ);
  const radarDish = createLegoBrick(17.0, 4.0, 2.4, LEGO_COLORS.yellow, { studStep: 1.5 });
  const radarFeed = createLegoBrick(2.2, 2.0, 6.2, LEGO_COLORS.silver);
  radarFeed.position.z = 2.6;
  radarGroup.add(radarDish, radarFeed);
  world.scene.add(radarGroup);
  world.rotatingElements.push({ mesh: radarGroup, axis: 'y', speed: 1.9 + towerIndex * 0.25 });

  world.addCollider(atcX, atcZ, 21, 21, 124, groundY);
  world.mapBuildings.push({
    x: atcX,
    z: atcZ,
    w: 22,
    d: 22,
    height: 124,
    color: '#ef4444',
    label: `TORRE ATC ${towerIndex} (124m)`
  });
}

function addHighwayGreenSign(world, x, y, z, width, height, text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14532d';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 32px "Chakra Petch", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 74);
  const tex = new THREE.CanvasTexture(canvas);

  const signMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, height, width),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  signMesh.position.set(x, y, z);
  world.scene.add(signMesh);
}

function drawRunwayNumber09(batcher, cx, y, cz) {
  const x0 = cx - 9;
  batcher.addBox('mark_white', 1.8, 0.04, 14.0, x0 - 4, y, cz);
  batcher.addBox('mark_white', 1.8, 0.04, 14.0, x0 + 4, y, cz);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x0, y, cz - 6);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x0, y, cz + 6);

  const x9 = cx + 9;
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x9, y, cz - 6);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x9, y, cz);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x9, y, cz + 6);
  batcher.addBox('mark_white', 1.8, 0.04, 7.0, x9 - 4, y, cz - 3);
  batcher.addBox('mark_white', 1.8, 0.04, 14.0, x9 + 4, y, cz);
}

function drawRunwayNumber27(batcher, cx, y, cz) {
  const x2 = cx - 9;
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x2, y, cz - 6);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x2, y, cz);
  batcher.addBox('mark_white', 9.8, 0.04, 2.0, x2, y, cz + 6);
  batcher.addBox('mark_white', 1.8, 0.04, 7.0, x2 + 4, y, cz - 3);
  batcher.addBox('mark_white', 1.8, 0.04, 7.0, x2 - 4, y, cz + 3);

  const x7 = cx + 9;
  batcher.addBox('mark_white', 9.8, 0.04, 2.2, x7, y, cz - 6);
  batcher.addBox('mark_white', 2.0, 0.04, 14.0, x7 + 3.5, y, cz);
}

function buildOpenArchedHangar(world, batcher, hx, yBase, hz, w, d, wallH, wallKey, roofKey, label) {
  const halfD = d * 0.5;
  batcher.addBox(wallKey, w, wallH, 2.8, hx, yBase + wallH * 0.5, hz - halfD + 1.4);
  batcher.addBox(wallKey, w, wallH, 2.8, hx, yBase + wallH * 0.5, hz + halfD - 1.4);
  world.addCollider(hx, hz - halfD + 1.4, w, 2.8, yBase + wallH, yBase);
  world.addCollider(hx, hz + halfD - 1.4, w, 2.8, yBase + wallH, yBase);

  batcher.addBox('mark_yellow', w - 6, 0.05, 0.65, hx, yBase + 0.03, hz - halfD + 5.5);
  batcher.addBox('mark_yellow', w - 6, 0.05, 0.65, hx, yBase + 0.03, hz + halfD - 5.5);
  batcher.addBox('mark_yellow', w - 8, 0.05, 0.5, hx, yBase + 0.03, hz);

  const archSegments = [
    { dz: -27, sw: 13, dy: 1.5 },
    { dz: -18, sw: 13, dy: 4.5 },
    { dz: -9,  sw: 13, dy: 7.0 },
    { dz: 0,   sw: 14, dy: 8.2 },
    { dz: 9,   sw: 13, dy: 7.0 },
    { dz: 18,  sw: 13, dy: 4.5 },
    { dz: 27,  sw: 13, dy: 1.5 }
  ];
  for (const seg of archSegments) {
    batcher.addBox(roofKey, w + 2.0, 2.0, seg.sw, hx, yBase + wallH + seg.dy, hz + seg.dz);
  }
  world.addCollider(hx, hz, w + 2, d, yBase + wallH + 9.5, yBase + wallH - 0.5);

  world.mapBuildings.push({
    x: hx,
    z: hz,
    w,
    d,
    height: wallH + 9,
    color: wallKey === 'white_clean' || wallKey === 'sky_blue' ? '#0284c7' : '#3f6212',
    label
  });
}

function buildCommercialAirlinerLego(world, batcher, ax, yBase, az) {
  batcher.addBox('white_clean', 6.4, 5.8, 38.0, ax, yBase + 4.8, az);
  batcher.addBox('aviation_blue', 6.6, 1.8, 38.4, ax, yBase + 2.6, az);
  batcher.addBox('glass_cockpit', 5.2, 2.2, 4.5, ax, yBase + 5.6, az - 19.5);
  batcher.addBox('white_clean', 44.0, 0.75, 7.6, ax, yBase + 4.2, az - 1.5);
  batcher.addBox('steel_silver', 3.2, 2.8, 6.2, ax - 11.5, yBase + 2.5, az - 2.5);
  batcher.addBox('steel_silver', 3.2, 2.8, 6.2, ax + 11.5, yBase + 2.5, az - 2.5);
  batcher.addBox('aviation_blue', 1.2, 9.5, 6.8, ax, yBase + 11.5, az + 15.5);
  batcher.addBox('gold_trim', 1.4, 2.2, 5.2, ax, yBase + 15.2, az + 16.0);
  batcher.addBox('white_clean', 16.0, 0.55, 4.4, ax, yBase + 5.4, az + 16.5);
  batcher.addBox('charcoal', 0.9, 2.2, 0.9, ax, yBase + 1.1, az - 15.0);
  batcher.addBox('charcoal', 1.2, 2.2, 1.2, ax - 3.2, yBase + 1.1, az + 1.0);
  batcher.addBox('charcoal', 1.2, 2.2, 1.2, ax + 3.2, yBase + 1.1, az + 1.0);

  world.addCollider(ax, az, 12, 38, yBase + 9.0, yBase);
}

function buildExecutiveVipJet(world, batcher, jx, yBase, jz) {
  batcher.addBox('white_clean', 18.0, 2.8, 3.2, jx, yBase + 2.2, jz);
  batcher.addBox('gold_trim', 18.2, 0.45, 3.3, jx, yBase + 2.0, jz);
  batcher.addBox('glass_cockpit', 3.2, 1.4, 2.6, jx - 7.5, yBase + 2.8, jz);
  batcher.addBox('white_clean', 4.6, 0.45, 18.0, jx + 0.5, yBase + 1.9, jz);
  batcher.addBox('aviation_blue', 3.6, 4.2, 0.65, jx + 7.2, yBase + 5.2, jz);
  world.addCollider(jx, jz, 18, 12, yBase + 5.5, yBase);
}

function buildSupersonicFighterJet(world, batcher, fx, yBase, fz) {
  batcher.addBox('steel_dark', 19.5, 1.8, 3.6, fx, yBase + 2.1, fz);
  batcher.addBox('charcoal', 5.5, 1.2, 2.2, fx - 10.5, yBase + 1.9, fz);
  batcher.addBox('glass_cockpit', 4.8, 1.35, 1.9, fx - 4.5, yBase + 3.1, fz);
  batcher.addBox('steel_dark', 8.5, 0.38, 15.6, fx + 1.5, yBase + 2.0, fz);
  batcher.addBox('aviation_red', 4.2, 0.45, 0.45, fx + 1.5, yBase + 2.0, fz - 7.9);
  batcher.addBox('aviation_red', 4.2, 0.45, 0.45, fx + 1.5, yBase + 2.0, fz + 7.9);
  batcher.addBox('charcoal', 3.4, 3.4, 0.45, fx + 7.2, yBase + 4.2, fz - 1.5);
  batcher.addBox('charcoal', 3.4, 3.4, 0.45, fx + 7.2, yBase + 4.2, fz + 1.5);
  batcher.addBox('orange_windsock', 1.2, 1.3, 2.4, fx + 9.8, yBase + 2.1, fz);

  world.addCollider(fx, fz, 19.5, 14.5, yBase + 4.8, yBase);
}

function buildMilitaryAttackHelicopter(world, batcher, hx, yBase, hz) {
  batcher.addBox('charcoal', 9.0, 0.35, 0.35, hx, yBase + 0.2, hz - 1.8);
  batcher.addBox('charcoal', 9.0, 0.35, 0.35, hx, yBase + 0.2, hz + 1.8);
  batcher.addBox('military_olive', 10.5, 3.2, 3.4, hx - 1.0, yBase + 2.2, hz);
  batcher.addBox('glass_cockpit', 4.2, 2.2, 3.0, hx - 4.8, yBase + 2.3, hz);
  batcher.addBox('military_dark', 5.2, 0.55, 8.8, hx - 0.5, yBase + 2.1, hz);
  batcher.addBox('military_olive', 9.5, 1.3, 1.1, hx + 8.2, yBase + 2.6, hz);
  batcher.addBox('military_dark', 1.8, 3.2, 0.45, hx + 12.2, yBase + 3.6, hz);

  const rotorGroup = new THREE.Group();
  rotorGroup.position.set(hx - 0.5, yBase + 4.2, hz);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.9, 10),
    getLegoMaterial(LEGO_COLORS.black)
  );
  const blade1 = new THREE.Mesh(
    new THREE.BoxGeometry(15.5, 0.14, 0.85),
    getLegoMaterial(LEGO_COLORS.charcoal)
  );
  blade1.position.y = 0.35;
  const blade2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.14, 15.5),
    getLegoMaterial(LEGO_COLORS.charcoal)
  );
  blade2.position.y = 0.35;
  rotorGroup.add(mast, blade1, blade2);
  world.scene.add(rotorGroup);
  world.rotatingElements.push({ mesh: rotorGroup, axis: 'y', speed: 8.5 });

  world.addCollider(hx, hz, 16, 8.5, yBase + 4.5, yBase);
}

function buildMilitaryWatchtower(world, batcher, tx, yBase, tz) {
  for (const [dx, dz] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) {
    batcher.addBox('steel_dark', 0.65, 14.0, 0.65, tx + dx, yBase + 7.0, tz + dz);
  }
  const cabY = yBase + 14.0;
  batcher.addBox('military_olive', 7.6, 1.4, 7.6, tx, cabY + 0.7, tz);
  batcher.addBox('glass_cockpit', 6.8, 2.4, 6.8, tx, cabY + 2.6, tz);
  batcher.addBox('military_dark', 8.4, 0.85, 8.4, tx, cabY + 4.2, tz);
  batcher.addBox('light_warm', 1.2, 1.2, 1.2, tx - 3.6, cabY + 2.2, tz);
  world.addCollider(tx, tz, 7.2, 7.2, cabY + 4.8, yBase);
}

function spawnExplosiveFuelTruck(world, x, yBase, z) {
  const truckGroup = new THREE.Group();
  truckGroup.position.set(x, yBase, z);

  const cab = createLegoBrick(3.6, 2.8, 4.2, LEGO_COLORS.white, { studs: false });
  cab.position.set(0, 1.6, -5.2);
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.2, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  windshield.position.set(0, 2.2, -7.2);

  const tankCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 9.6, 18),
    getLegoMaterial(LEGO_COLORS.white)
  );
  tankCyl.rotation.x = Math.PI / 2;
  tankCyl.position.set(0, 2.4, 1.8);
  const redStripe = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 0.65, 9.4),
    getLegoMaterial(LEGO_COLORS.red)
  );
  redStripe.position.set(0, 2.4, 1.8);

  truckGroup.add(cab, windshield, tankCyl, redStripe);
  world.scene.add(truckGroup);

  const col = world.addCollider(x, z, 4.4, 14.5, yBase + 4.6, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: truckGroup,
      type: 'fuel_truck',
      hp: 40,
      radius: 5.5,
      height: 4.5,
      colliders: [col],
      debrisColors: [LEGO_COLORS.white, LEGO_COLORS.red, LEGO_COLORS.green, LEGO_COLORS.yellow],
      studDrops: { silver: 6, gold: 10, blue: 4, purple: 1 },
      groundY: yBase
    });
  }
}

function spawnMilitaryCrate(world, x, yBase, z) {
  const crateMesh = createLegoBrick(2.2, 1.8, 2.2, 0x3f6212, { studStep: 0.7 });
  crateMesh.position.set(x, yBase + 0.9, z);
  world.scene.add(crateMesh);

  const col = world.addCollider(x, z, 2.2, 2.2, yBase + 1.8, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: crateMesh,
      type: 'crate',
      hp: 20,
      radius: 1.6,
      height: 1.8,
      colliders: [col],
      debrisColors: [0x3f6212, 0x1a2e05, LEGO_COLORS.gold],
      studDrops: { silver: 4, gold: 6, blue: 2, purple: 0 },
      groundY: yBase
    });
  }
}

/**
 * 5. ALA MILITAR NORTE DA BASE (CANTO NOROESTE: X = -1825..-1015, Z = -1320..-660)
 * Preenche 100% do canto Noroeste da ilha acima do Aeroporto e a Oeste da Favela Cidade de Deus com:
 * - Malha Viária Militar & Muralha Perimetral Norte;
 * - Quartel Militar / Comando Norte do Exército (X = -1115, Z = -990, H = 38m);
 * - 4 Hangares Militares Extras (X = -1298 e -1462, Z = -730 e -855);
 * - Grande Pátio Blindado de Tanques (X = -1380, Z = -1135) com 6 Tanques Pesados e Galpão de Blindados;
 * - 4 Baterias Antiaéreas SAM / Radar (X = -1680, Z = -1230, -1080, -930, -780) e 2 Helipontos Militares Norte!
 */
function buildNorthMilitaryBaseWing(world, batcher, groundY) {
  // 1. Avenidas Táticas Internas da Ala Militar Norte
  for (const tz of [-660, -960, -1285]) {
    batcher.addBox('asphalt_dark', 760, 0.1, 28, -1410, groundY + 0.05, tz);
    batcher.addBox('mark_yellow', 750, 0.04, 0.65, -1410, groundY + 0.11, tz);
    world.mapRoads.push({ x: -1410, z: tz, w: 760, d: 28, isMain: false });
  }
  for (const tx of [-1215, -1380, -1545]) {
    batcher.addBox('asphalt_dark', 26, 0.1, 640, tx, groundY + 0.05, -980);
    batcher.addBox('mark_yellow', 0.65, 0.04, 640, tx, groundY + 0.11, -980);
    world.mapRoads.push({ x: tx, z: -980, w: 26, d: 640, isMain: false });
  }

  // 2. Quartel Militar / Comando Norte do Exército (X = -1115, Z = -990, 144m x 540m, H = 38m)
  const bx = -1115;
  const bz = -990;
  batcher.addBox('military_dark', 144, 1.2, 540, bx, groundY + 0.6, bz);
  world.mapBlocks.push({ x: bx, z: bz, w: 144, d: 540, color: '#1a2e05' });

  // Três grandes blocos de Quartel & Comando dentro do complexo (Z = -1170, -990, -810)
  const barracksSpecs = [
    { z: -1170, h: 36, label: 'QUARTEL DE COMANDO NORTE' },
    { z: -990,  h: 42, label: 'QG DO EXÉRCITO & INTELIGÊNCIA' },
    { z: -810,  h: 34, label: 'ARSENAL & PAIOL MILITAR NORTE' }
  ];
  for (const bSpec of barracksSpecs) {
    batcher.addBox('military_olive', 108, bSpec.h, 132, bx, groundY + bSpec.h * 0.5, bSpec.z);
    batcher.addBox('military_dark', 112, 3.6, 136, bx, groundY + bSpec.h - 1.8, bSpec.z);
    batcher.addBox('mark_yellow', 113, 0.85, 137, bx, groundY + bSpec.h + 0.4, bSpec.z);
    for (let fy = 8; fy <= bSpec.h - 6; fy += 7) {
      batcher.addBox('glass_cockpit', 110, 2.6, 118, bx, groundY + fy, bSpec.z);
    }
    world.addCollider(bx, bSpec.z, 108, 132, groundY + bSpec.h + 1, groundY);
    world.mapBuildings.push({
      x: bx,
      z: bSpec.z,
      w: 108,
      d: 132,
      height: bSpec.h,
      color: '#3f6212',
      label: bSpec.label
    });
  }
  addHighwayGreenSign(world, -1042, groundY + 40, -990, 78.0, 5.8, 'QUARTEL GENERAL — ALA MILITAR NORTE ');

  // 3. 4 Hangares Militares Extras (X = -1298 e -1462, Z = -735 e -865)
  for (const hx of [-1298, -1462]) {
    for (const hz of [-735, -865]) {
      buildOpenArchedHangar(world, batcher, hx, groundY, hz, 88, 76, 24, 'military_olive', 'military_dark', 'HANGAR MILITAR NORTE');
      buildSupersonicFighterJet(world, batcher, hx, groundY, hz);
    }
  }

  // 4. Grande Pátio Blindado de Tanques (X = -1380, Z = -1135, 290m x 260m)
  const tyX = -1380;
  const tyZ = -1135;
  batcher.addBox('asphalt_dark', 290, 0.16, 260, tyX, groundY + 0.08, tyZ);
  world.mapBlocks.push({ x: tyX, z: tyZ, w: 290, d: 260, color: '#334155' });

  // Galpão Pesado de Manutenção de Tanques no fundo Norte do Pátio (Z = -1225, H = 30m)
  batcher.addBox('steel_dark', 250, 30, 62, tyX, groundY + 15, -1225);
  batcher.addBox('military_olive', 254, 3.2, 66, tyX, groundY + 28.5, -1225);
  batcher.addBox('mark_yellow', 255, 0.85, 67, tyX, groundY + 30.4, -1225);
  world.addCollider(tyX, -1225, 250, 62, groundY + 31, groundY);
  world.mapBuildings.push({
    x: tyX,
    z: -1225,
    w: 250,
    d: 62,
    height: 30,
    color: '#1a2e05',
    label: 'OFICINA DE TANQUES TITAN'
  });

  // 6 Tanques de Guerra Pesados Estacionados nas Baias Amarelas do Pátio Norte
  for (const tankX of [-1480, -1430, -1380, -1330, -1280, -1235]) {
    batcher.addBox('mark_yellow', 18, 0.05, 28, tankX, groundY + 0.18, -1085);
    // Chassi, esteiras, torre e canhão longo do Tanque Militar LEGO
    batcher.addBox('charcoal', 7.2, 1.8, 12.6, tankX, groundY + 1.1, -1085);
    batcher.addBox('military_olive', 6.4, 2.2, 11.4, tankX, groundY + 2.4, -1085);
    batcher.addBox('military_dark', 4.6, 1.8, 5.8, tankX, groundY + 4.1, -1085);
    batcher.addBox('steel_dark', 0.85, 0.85, 9.5, tankX, groundY + 4.2, -1078);
    world.addCollider(tankX, -1085, 7.4, 13.0, groundY + 5.2, groundY);
  }

  // 5. 4 Baterias Antiaéreas SAM / Radar Costeiras & 2 Helipontos Militares Norte (X = -1680, Z = -1230..-750)
  batcher.addBox('military_dark', 220, 0.2, 620, -1685, groundY + 0.1, -990);
  world.mapBlocks.push({ x: -1685, z: -990, w: 220, d: 620, color: '#1e293b' });

  const samZCoords = [-1235, -1085, -935, -785];
  for (const sz of samZCoords) {
    const sx = -1710;
    // Bunker Octogonal/Quadrado de Concreto da Bateria Antiaérea + Lançador Quádruplo de Mísseis SAM
    batcher.addBox('concrete_wall', 42, 8.5, 42, sx, groundY + 4.25, sz);
    batcher.addBox('military_olive', 36, 4.0, 36, sx, groundY + 10.5, sz);
    batcher.addBox('mark_yellow', 43, 0.75, 43, sx, groundY + 8.6, sz);
    batcher.addBox('steel_dark', 10, 6.5, 10, sx, groundY + 15.5, sz);
    for (const mxOff of [-3.2, -1.1, 1.1, 3.2]) {
      batcher.addBox('white_clean', 1.4, 2.2, 11.5, sx + mxOff, groundY + 19.5, sz);
      batcher.addBox('aviation_red', 1.5, 2.3, 2.2, sx + mxOff, groundY + 20.2, sz - 5.2);
    }
    world.addCollider(sx, sz, 42, 42, groundY + 22, groundY);
    world.mapBuildings.push({
      x: sx,
      z: sz,
      w: 42,
      d: 42,
      height: 22,
      color: '#475569',
      label: 'BATERIA ANTIAÉREA SAM'
    });
  }

  // 2 Helipontos Militares Norte (X = -1605, Z = -1160 e Z = -860) com Helicópteros de Ataque Falcon-X
  for (const hz of [-1160, -860]) {
    const hx = -1605;
    batcher.addBox('asphalt_dark', 38, 0.3, 38, hx, groundY + 0.2, hz);
    batcher.addBox('mark_yellow', 34, 0.06, 1.4, hx, groundY + 0.38, hz - 16);
    batcher.addBox('mark_yellow', 34, 0.06, 1.4, hx, groundY + 0.38, hz + 16);
    batcher.addBox('mark_white', 2.2, 0.08, 14.0, hx - 4.5, groundY + 0.39, hz);
    batcher.addBox('mark_white', 2.2, 0.08, 14.0, hx + 4.5, groundY + 0.39, hz);
    batcher.addBox('mark_white', 9.0, 0.08, 2.2, hx, groundY + 0.39, hz);
    buildMilitaryAttackHelicopter(world, batcher, hx, groundY + 0.35, hz);
  }

  buildMilitaryWatchtower(world, batcher, -1555, groundY, -1275);
  buildMilitaryWatchtower(world, batcher, -1795, groundY, -1275);
}
