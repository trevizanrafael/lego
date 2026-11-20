import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../../materials/LegoMaterials.js';
import {
  makeFastBox,
  flushSpatialChunkedBuckets
} from '../../BuildingGenerator.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';

export function createWestBatcher() {
  const legoPlastic = (color, opts = {}) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: opts.roughness ?? 0.25,
      metalness: opts.metalness ?? 0.04,
      clearcoat: opts.clearcoat ?? 0.4,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.15,
      reflectivity: 0.72,
      ...(opts.emissive !== undefined ? { emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity ?? 0.2 } : {})
    });
  const palette = {
    steel_silver: legoPlastic(LEGO_COLORS.silver, { metalness: 0.45, roughness: 0.25, clearcoat: 0.35 }),
    steel_dark: legoPlastic(0x334155, { roughness: 0.35, metalness: 0.35, clearcoat: 0.28 }),
    charcoal: legoPlastic(0x1e293b, { roughness: 0.42, clearcoat: 0.18 }),
    asphalt_dark: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.68 }),
    concrete_wall: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45 }),
    terminal_floor: legoPlastic(0xf1f5f9, { roughness: 0.22, metalness: 0.08, clearcoat: 0.55 }),
    white_clean: legoPlastic(0xf8fafc, { roughness: 0.22 }),
    aviation_red: legoPlastic(0xdc2626, { roughness: 0.24 }),
    aviation_blue: legoPlastic(0x0284c7, { roughness: 0.22 }),
    sky_blue: legoPlastic(0x38bdf8, { roughness: 0.24 }),
    highway_green: legoPlastic(0x15803d, { roughness: 0.28 }),
    military_olive: legoPlastic(0x3f6212, { roughness: 0.34, clearcoat: 0.28 }),
    military_dark: legoPlastic(0x1a2e05, { roughness: 0.38, clearcoat: 0.22 }),
    camo_tan: legoPlastic(0xa16207, { roughness: 0.36, clearcoat: 0.24 }),
    gold_trim: legoPlastic(LEGO_COLORS.gold, { metalness: 0.5, roughness: 0.22, clearcoat: 0.48 }),
    orange_windsock: legoPlastic(0xf97316, { roughness: 0.28 }),
    glass_mirror: legoPlastic(0x0ea5e9, {
      roughness: 0.1,
      metalness: 0.42,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06,
      emissive: 0x0284c7,
      emissiveIntensity: 0.18
    }),
    glass_cockpit: legoPlastic(0x38bdf8, {
      roughness: 0.1,
      metalness: 0.32,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06,
      emissive: 0x0369a1,
      emissiveIntensity: 0.22
    }),
    mark_white: new THREE.MeshBasicMaterial({
      color: 0xffffff,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3
    }),
    mark_yellow: new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -3
    }),
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
      buckets.get(key).push(makeFastBox(w, h, d, x, y, z));
    },
    flush(scene) {
      flushSpatialChunkedBuckets(scene, buckets, palette, {
        chunkSize: 768,
        castShadowFn: (key) => shadowCasterKeys.has(key),
        receiveShadowFn: () => true
      });
    }
  };
}

/**
 * 1. RODOVIA EXPRESSA + PERÍMETRO DE SEGURANÇA + GRANDE ESTACIONAMENTO COM CATRACAS/CANCELAS!
 */
export function buildExpresswaySecurityAndParkingLot(world, batcher, groundY) {
  // Pórtico de Acesso ao Aeroporto e Base Militar posicionado na entrada do perímetro Oeste (sem cortar a Favela!)
  const gantries = [
    { x: -1018, z: -117, text: 'AEROPORTO / BASE MILITAR ' },
    { x: -1018, z: 0, text: 'MEGA TERMINAL & ESTACIONAMENTO ' },
    { x: -1018, z: 134, text: 'BASE MILITAR & HANGARES ' }
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
export function buildColossalEnterableAirportTerminal(world, batcher, groundY) {
  const termX = -1145;
  const termZ = 0;
  const termW = 92;  // X = -1191 (Fundo/Pátio) até X = -1099 (Frente/Estacionamento)
  const termD = 960; // Z = -480 até Z +480!
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
 * 4A. AS 3 TORRES DE CONTROLE GIGANTES BRANCAS E VERMELHAS (124m!) RENTES À PISTA PRINCIPAL (X = -1582)
 */
export function buildThreeRunwayAtcTowers(world, batcher, groundY) {
  const atcPositionsZ = [-360, 0, 360];
  for (let i = 0; i < atcPositionsZ.length; i++) {
    buildSingleGiantAtcTower(world, batcher, -1582, groundY, atcPositionsZ[i], i + 1);
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

export function addHighwayGreenSign(world, x, y, z, width, height, text) {
  const signMesh = createSignBoardMesh({
    x,
    y,
    z,
    width,
    height,
    depth: 1.1,
    rotY: Math.PI / 2,
    title: text,
    bgColor: '#14532d',
    borderColor: '#ffffff',
    textColor: '#ffffff',
    topStripeColor: '#facc15',
    doubleSided: true
  });
  world.scene.add(signMesh);
}
