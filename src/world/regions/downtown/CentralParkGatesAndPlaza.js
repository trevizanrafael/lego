import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  SHARED_STUD_GEO
} from '../../../materials/LegoMaterials.js';
import {
  makeFastBox,
  flushSpatialChunkedBuckets
} from '../../BuildingGenerator.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';

/**
 * Batcher dedicado de materiais para manter 60 FPS cravados no Parque Central.
 */
export function createParkBatcher() {
  const palette = {
    stone_wall: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42 }),
    stone_dark: new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.48 }),
    stone_path: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.36 }),
    brick_red: new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.42 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35 }),
    iron_black: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.28, metalness: 0.45 }),
    lamp_globe: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    gold: getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.68, roughness: 0.16 }),
    white_marble: getLegoMaterial(0xf8fafc, { roughness: 0.18, clearcoat: 0.7 }),
    wood_brown: new THREE.MeshStandardMaterial({ color: 0x5c2d0c, roughness: 0.45 }),
    wood_light: new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.4 }),
    water_bright: new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      roughness: 0.08,
      clearcoat: 0.95,
      transparent: true,
      opacity: 0.86
    }),
    water_foam: new THREE.MeshBasicMaterial({ color: 0xe0f2fe }),
    turf_emerald: new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.48 }),
    oak_dark: new THREE.MeshStandardMaterial({ color: 0x0f3f22, roughness: 0.38 }),
    oak_mid: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.36 }),
    jungle_lush: new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.35 }),
    willow_lime: new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.36 }),
    pine_green: new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.4 }),
    autumn_orange: new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.32 }),
    autumn_yellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }),
    autumn_red: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32 }),
    bush_green: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.38 }),
    flower_pink: new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.25 }),
    flower_yellow: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.25 }),
    flower_red: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25 }),
    flower_purple: new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.25 }),
    flower_cyan: new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25 })
  };

  const buckets = new Map();
  for (const k of Object.keys(palette)) {
    buckets.set(k, []);
  }

  return {
    treeCount: 0,
    undergrowthCount: 0,
    addBox(key, w, h, d, x, y, z) {
      buckets.get(key).push(makeFastBox(w, h, d, x, y, z));
    },
    flush(scene) {
      flushSpatialChunkedBuckets(scene, buckets, palette, {
        chunkSize: 768,
        castShadowFn: (key) => key !== 'lamp_globe' && key !== 'water_foam' && key !== 'stone_path',
        receiveShadowFn: () => true
      });
    }
  };
}

/**
 * 1. PERÍMETRO DE PEDRA CINZA/TIJOLO COM PINOS DE LEGO, POSTES DE FERRO PRETO & 4 PORTÕES CLÁSSICOS
 */
export function buildStonePerimeterWallsAndGates(world, batcher, px, pz, pw, pd, groundY) {
  const halfW = pw * 0.5; // 490
  const halfD = pd * 0.5; // 116
  const northZ = pz - halfD; // 152
  const southZ = pz + halfD; // 384
  const westX = px - halfW;  // -490
  const eastX = px + halfW;  // +490

  const studPositions = [];

  const isGateOpeningX = (x) =>
    Math.abs(x) < 15 ||
    Math.abs(x + 355) < 10 ||
    Math.abs(x + 195) < 10 ||
    Math.abs(x - 205) < 13 ||
    Math.abs(x - 395) < 10;
  const isGateOpeningZ = (z) => Math.abs(z - pz) < 14 || Math.abs(z - 196) < 8 || Math.abs(z - 340) < 8;

  // Mureta Baixa Norte e Sul (Z = 152 e Z = 384) com Pinos de LEGO no topo!
  for (const wallZ of [northZ, southZ]) {
    for (let x = westX + 8; x <= eastX - 8; x += 16) {
      if (isGateOpeningX(x)) continue;
      batcher.addBox('stone_dark', 15.6, 0.45, 1.35, x, groundY + 0.22, wallZ);
      batcher.addBox('brick_red', 15.2, 0.75, 1.1, x, groundY + 0.82, wallZ);
      batcher.addBox('stone_wall', 15.8, 0.28, 1.45, x, groundY + 1.34, wallZ);

      for (let sx = x - 6; sx <= x + 6; sx += 2.0) {
        studPositions.push([sx, groundY + 1.54, wallZ]);
      }

      if (Math.abs(x % 32) < 1) {
        const pillarX = x + 8;
        if (!isGateOpeningX(pillarX)) {
          batcher.addBox('stone_wall', 1.9, 2.1, 1.9, pillarX, groundY + 1.05, wallZ);
          batcher.addBox('stone_dark', 2.2, 0.35, 2.2, pillarX, groundY + 2.2, wallZ);
          addClassicalIronLamp(batcher, pillarX, groundY + 2.35, wallZ);
        }
      }
      world.addCollider(x, wallZ, 15.8, 1.4, groundY + 1.6, groundY);
    }
  }

  // Mureta Baixa Oeste e Leste (X = -490 e X = +490)
  for (const wallX of [westX, eastX]) {
    for (let z = northZ + 8; z <= southZ - 8; z += 16) {
      if (isGateOpeningZ(z)) continue;
      batcher.addBox('stone_dark', 1.35, 0.45, 15.6, wallX, groundY + 0.22, z);
      batcher.addBox('brick_red', 1.1, 0.75, 15.2, wallX, groundY + 0.82, z);
      batcher.addBox('stone_wall', 1.45, 0.28, 15.8, wallX, groundY + 1.34, z);

      for (let sz = z - 6; sz <= z + 6; sz += 2.0) {
        studPositions.push([wallX, groundY + 1.54, sz]);
      }

      if (Math.abs((z - northZ) % 32) < 1) {
        const pillarZ = z + 8;
        if (!isGateOpeningZ(pillarZ)) {
          batcher.addBox('stone_wall', 1.9, 2.1, 1.9, wallX, groundY + 1.05, pillarZ);
          batcher.addBox('stone_dark', 2.2, 0.35, 2.2, wallX, groundY + 2.2, pillarZ);
          addClassicalIronLamp(batcher, wallX, groundY + 2.35, pillarZ);
        }
      }
      world.addCollider(wallX, z, 1.4, 15.8, groundY + 1.6, groundY);
    }
  }

  // Instancia todos os Pinos de LEGO (Studs) do topo da mureta perimetral em 1 único InstancedMesh!
  if (studPositions.length > 0) {
    const studMat = getLegoMaterial(0x94a3b8, { roughness: 0.35 });
    const inst = new THREE.InstancedMesh(SHARED_STUD_GEO, studMat, studPositions.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < studPositions.length; i++) {
      const [sx, sy, sz] = studPositions[i];
      dummy.position.set(sx, sy, sz);
      dummy.scale.set(1.6, 1.4, 1.6);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    world.scene.add(inst);
  }

  // AS 4 ENTRADAS MONUMENTAIS (NORTE, SUL, LESTE E OESTE)
  buildMonumentalParkGate(world, batcher, 0, groundY, northZ, false, 'PARQUE CENTRAL ');
  buildMonumentalParkGate(world, batcher, 0, groundY, southZ, false, 'PARQUE CENTRAL ');
  buildMonumentalParkGate(world, batcher, westX, groundY, pz, true, 'PORTÃO OESTE ');
  buildMonumentalParkGate(world, batcher, eastX, groundY, pz, true, 'PORTÃO LESTE ');

  // Pilares Clássicos nos Portões Secundários das Trilhas (X = -355, -195, +205, +395)
  for (const gx of [-355, -195, 205, 395]) {
    for (const gz of [northZ, southZ]) {
      for (const side of [-1, 1]) {
        const pxGate = gx + side * 10.5;
        batcher.addBox('stone_wall', 2.8, 6.5, 2.8, pxGate, groundY + 3.25, gz);
        batcher.addBox('brick_red', 2.4, 4.2, 2.4, pxGate, groundY + 3.25, gz);
        batcher.addBox('gold', 3.2, 0.55, 3.2, pxGate, groundY + 6.6, gz);
        addClassicalIronLamp(batcher, pxGate, groundY + 6.9, gz);
        world.addCollider(pxGate, gz, 2.8, 2.8, groundY + 7.0, groundY);
      }
    }
  }
}

export function addClassicalIronLamp(batcher, x, yBase, z) {
  batcher.addBox('iron_black', 0.65, 0.45, 0.65, x, yBase + 0.22, z);
  batcher.addBox('iron_black', 0.24, 3.8, 0.24, x, yBase + 2.1, z);
  batcher.addBox('iron_black', 1.4, 0.22, 0.22, x, yBase + 3.9, z);
  batcher.addBox('lamp_globe', 0.72, 0.72, 0.72, x, yBase + 4.35, z);
  batcher.addBox('lamp_globe', 0.48, 0.48, 0.48, x - 0.65, yBase + 4.2, z);
  batcher.addBox('lamp_globe', 0.48, 0.48, 0.48, x + 0.65, yBase + 4.2, z);
}

function buildMonumentalParkGate(world, batcher, gx, groundY, gz, isEastWest, gateTitle) {
  const span = 24.0;
  const halfSpan = span * 0.5;

  const stepW = isEastWest ? 6.5 : 26.0;
  const stepD = isEastWest ? 26.0 : 6.5;
  batcher.addBox('stone_path', stepW, 0.14, stepD, gx, groundY + 0.04, gz);
  batcher.addBox('gold', isEastWest ? 0.35 : 26.2, 0.16, isEastWest ? 26.2 : 0.35, gx, groundY + 0.05, gz);

  for (const side of [-1, 1]) {
    for (const outer of [0, 1]) {
      const offset = side * (halfSpan + outer * 4.2);
      const colX = isEastWest ? gx : gx + offset;
      const colZ = isEastWest ? gz + offset : gz;
      const colH = outer === 0 ? 12.5 : 9.8;

      batcher.addBox('stone_dark', 3.4, 1.8, 3.4, colX, groundY + 0.9, colZ);
      batcher.addBox('stone_wall', 2.8, colH - 2.6, 2.8, colX, groundY + 1.8 + (colH - 2.6) * 0.5, colZ);
      batcher.addBox('brick_red', 2.2, colH - 4.0, 2.2, colX, groundY + 2.4 + (colH - 4.0) * 0.5, colZ);
      batcher.addBox('gold', 3.5, 0.75, 3.5, colX, groundY + colH - 0.4, colZ);
      addClassicalIronLamp(batcher, colX, groundY + colH, colZ);

      world.addCollider(colX, colZ, 3.2, 3.2, groundY + colH, groundY);
    }
  }

  const archW = isEastWest ? 3.6 : span + 4.0;
  const archD = isEastWest ? span + 4.0 : 3.6;
  batcher.addBox('stone_wall', archW, 2.2, archD, gx, groundY + 12.2, gz);
  batcher.addBox('gold', isEastWest ? 3.9 : span + 4.6, 0.65, isEastWest ? span + 4.6 : 3.9, gx, groundY + 13.5, gz);
  batcher.addBox('stone_dark', isEastWest ? 3.2 : 14.0, 1.6, isEastWest ? 14.0 : 3.2, gx, groundY + 14.5, gz);
  world.addCollider(gx, gz, archW, archD, groundY + 15.2, groundY + 11.0);

  const signMesh = createSignBoardMesh({
    x: gx,
    y: groundY + 12.3,
    z: gz,
    width: 18.0,
    height: 2.6,
    depth: 0.65,
    rotY: isEastWest ? Math.PI / 2 : 0,
    title: gateTitle,
    bgColor: '#0f172a',
    borderColor: '#facc15',
    textColor: '#facc15',
    doubleSided: true
  });
  world.scene.add(signMesh);
}

/**
 * 2. REDE DENSA DE CAMINHOS & TRILHAS NA SELVA DO PARQUE, PRAÇA CIRCULAR CENTRAL,
 *    CHAFARIZ DE 3 CAMADAS COM STUDS, BANCOS, LIXEIRAS, BEBEDOUROS & 3 CORETOS!
 */
export function buildPavedPathsCentralPlazaAndFountain(world, batcher, px, pz, pw, pd, groundY) {
  // ============================================================================
  // 2A. REDE COMPLETA DE ALAMEDAS E TRILHAS DE PEDRA CORTANDO A FLORESTA DO PARQUE!
  // ============================================================================
  // 1. Alameda Central Leste-Oeste (Z = 268):
  //    - Trecho Oeste até o Grande Lago (X = -488..+72, comprimento 560m, largura 15m)
  batcher.addBox('stone_dark', 560, 0.06, 15.4, -208, groundY + 0.02, pz);
  batcher.addBox('stone_path', 558, 0.08, 13.8, -208, groundY + 0.04, pz);
  //    - Trecho Leste do Grande Lago até o Portão Leste (X = +338..+488, comprimento 150m)
  batcher.addBox('stone_dark', 150, 0.06, 15.4, 413, groundY + 0.02, pz);
  batcher.addBox('stone_path', 148, 0.08, 13.8, 413, groundY + 0.04, pz);

  // 2. DUAS NOVAS ALAMEDAS FLORESTAIS LONGITUDINAIS (Norte Z = 178 e Sul Z = 358, de X = -488 a +488!)
  //    Essas duas trilhas atravessam os bosques Norte e Sul inteiros e contornam as margens do Grande Lago!
  for (const trailZ of [178, 358]) {
    batcher.addBox('stone_dark', 976, 0.05, 9.6, 0, groundY + 0.02, trailZ);
    batcher.addBox('stone_path', 974, 0.07, 8.2, 0, groundY + 0.035, trailZ);
  }

  // 3. DUAS TRILHAS INTERMEDIÁRIAS NA MATA OESTE (Z = 212 e Z = 324, de X = -465 até X = -40, ligando os 3 Coretos!)
  for (const midZ of [212, 324]) {
    batcher.addBox('stone_dark', 425, 0.05, 8.4, -252.5, groundY + 0.02, midZ);
    batcher.addBox('stone_path', 423, 0.07, 7.2, -252.5, groundY + 0.035, midZ);
  }

  // 4. SETE CAMINHOS TRANSVERSAIS NORTE-SUL CORTANDO A SELVA DE PONTA A PONTA (Z = 152..384):
  //    X = -435, X = -355, X = -275, X = -195, X = -105, X = 0 (Alameda Principal), X = +395, X = +450
  const northSouthTrailsX = [-435, -355, -275, -195, -105, 395, 450];
  for (const tx of northSouthTrailsX) {
    batcher.addBox('stone_dark', 9.2, 0.05, pd - 4, tx, groundY + 0.02, pz);
    batcher.addBox('stone_path', 7.8, 0.07, pd - 6, tx, groundY + 0.035, pz);
  }

  // Alameda Central Norte-Sul (X = 0, Z = 152..384, largura 18m)
  batcher.addBox('stone_dark', 19.6, 0.06, pd - 2, px, groundY + 0.02, pz);
  batcher.addBox('stone_path', 18.0, 0.08, pd - 4, px, groundY + 0.04, pz);

  // Acesso Norte e Sul à Ponte Arqueada do Lago (X = +205)
  batcher.addBox('stone_path', 14.0, 0.07, 36, 205, groundY + 0.035, 170);
  batcher.addBox('stone_path', 14.0, 0.07, 36, 205, groundY + 0.035, 366);

  // 5. QUATRO TRILHAS DIAGONAIS DE PLACAS DE PEDRA (STEPPING STONES) SERPENTEANDO PELA MATA!
  const diagTrails = [
    { x1: -355, z1: 212, x2: -275, z2: 268 },
    { x1: -355, z1: 324, x2: -275, z2: 268 },
    { x1: -195, z1: 268, x2: -135, z2: 212 },
    { x1: -105, z1: 324, x2: -32, z2: 268 }
  ];
  for (const dt of diagTrails) {
    const steps = 16;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const sx = dt.x1 + (dt.x2 - dt.x1) * t;
      const sz = dt.z1 + (dt.z2 - dt.z1) * t;
      batcher.addBox('stone_path', 5.4, 0.08, 5.4, sx, groundY + 0.04, sz);
    }
  }

  // ============================================================================
  // PRAÇA CIRCULAR NO CENTRO DO PARQUE (X = 0, Z = 268, Raio 38m)
  // ============================================================================
  const plazaDiscOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(38.0, 38.0, 0.1, 40),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.34 })
  );
  plazaDiscOuter.position.set(px, groundY + 0.05, pz);
  plazaDiscOuter.receiveShadow = true;

  const plazaRingTerracotta = new THREE.Mesh(
    new THREE.CylinderGeometry(28.0, 28.0, 0.12, 36),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.36 })
  );
  plazaRingTerracotta.position.set(px, groundY + 0.06, pz);
  plazaRingTerracotta.receiveShadow = true;

  const plazaInnerMarble = new THREE.Mesh(
    new THREE.CylinderGeometry(22.0, 22.0, 0.14, 36),
    getLegoMaterial(0xf8fafc, { roughness: 0.2 })
  );
  plazaInnerMarble.position.set(px, groundY + 0.07, pz);
  plazaInnerMarble.receiveShadow = true;
  world.scene.add(plazaDiscOuter, plazaRingTerracotta, plazaInnerMarble);

  // ============================================================================
  // CHAFARIZ / FONTE MONUMENTAL DE ÁGUA EM 3 CAMADAS (X = 0, Z = 268)
  // ============================================================================
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(px, groundY + 0.1, pz);

  const stoneMat = getLegoMaterial(0xf1f5f9, { roughness: 0.22, clearcoat: 0.6 });
  const goldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.72, roughness: 0.15 });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.06,
    clearcoat: 0.95,
    transparent: true,
    opacity: 0.88
  });

  const outerRim = new THREE.Mesh(new THREE.CylinderGeometry(10.6, 11.2, 1.35, 28), stoneMat);
  outerRim.position.y = 0.68;
  const poolWater = new THREE.Mesh(new THREE.CylinderGeometry(9.8, 9.8, 1.05, 28), waterMat);
  poolWater.position.y = 0.55;
  const colPedestal1 = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 3.4, 20), stoneMat);
  colPedestal1.position.y = 1.7;

  const midBowl = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 4.2, 0.95, 24), stoneMat);
  midBowl.position.y = 3.4;
  const midWater = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.35, 24), waterMat);
  midWater.position.y = 3.78;
  const colPedestal2 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 2.8, 16), goldMat);
  colPedestal2.position.y = 4.8;

  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 2.1, 0.75, 20), stoneMat);
  topBowl.position.y = 6.2;
  const topSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 2.2, 16), goldMat);
  topSpire.position.y = 7.4;

  fountainGroup.add(outerRim, poolWater, colPedestal1, midBowl, midWater, colPedestal2, topBowl, topSpire);

  const waterJetsGroup = new THREE.Group();
  const jetDropMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const jetFoamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let j = 0; j < 16; j++) {
    const ang = (j / 16) * Math.PI * 2;
    const dropTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 2.4, 0.28),
      j % 2 === 0 ? jetDropMat : jetFoamMat
    );
    dropTop.position.set(Math.cos(ang) * 3.1, 4.9, Math.sin(ang) * 3.1);
    const dropMid = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 2.6, 0.34),
      j % 2 === 0 ? jetFoamMat : jetDropMat
    );
    dropMid.position.set(Math.cos(ang) * 5.8, 2.1, Math.sin(ang) * 5.8);
    const crownJet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.8, 0.32), jetFoamMat);
    crownJet.position.set(Math.cos(ang) * 1.1, 8.8 + (j % 3) * 0.4, Math.sin(ang) * 1.1);
    waterJetsGroup.add(dropTop, dropMid, crownJet);
  }
  fountainGroup.add(waterJetsGroup);
  world.scene.add(fountainGroup);
  world.rotatingElements.push({ mesh: waterJetsGroup, axis: 'y', speed: 2.2 });

  world.addCollider(px, pz, 5.8, 5.8, groundY + 8.5, groundY);
  world.mapWater.push({ x: px, z: pz, w: 21, d: 21 });

  // 20 Studs Dourados, Azuis e Roxos dentro da água do Chafariz Central!
  if (world.destructibles && typeof world.destructibles.spawnAmbientStud === 'function') {
    for (let s = 0; s < 20; s++) {
      const ang = (s / 20) * Math.PI * 2;
      const rad = s % 2 === 0 ? 7.6 : 5.4;
      const tier = s % 5 === 0 ? 'purple' : s % 2 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(
        px + Math.cos(ang) * rad,
        groundY + 1.18,
        pz + Math.sin(ang) * rad,
        tier
      );
    }
  }

  // Postes Clássicos de Ferro Preto com Globos Amarelos ao longo dos Caminhos e da Praça
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2 + Math.PI / 8;
    addClassicalIronLamp(batcher, px + Math.cos(ang) * 35.5, groundY, pz + Math.sin(ang) * 35.5);
  }
  for (let lx = -450; lx <= 450; lx += 52) {
    if (Math.abs(lx) < 42 || (lx > 55 && lx < 345)) continue;
    addClassicalIronLamp(batcher, lx, groundY, pz - 8.2);
    addClassicalIronLamp(batcher, lx, groundY, pz + 8.2);
    addClassicalIronLamp(batcher, lx, groundY, 178 - 5.2);
    addClassicalIronLamp(batcher, lx, groundY, 358 + 5.2);
  }

  // BANCOS DE MADEIRA, LIXEIRAS E BEBEDOUROS AO LONGO DOS CAMINHOS E TRILHAS
  for (let b = 0; b < 8; b++) {
    const ang = (b / 8) * Math.PI * 2;
    const bxBench = px + Math.cos(ang) * 31.0;
    const bzBench = pz + Math.sin(ang) * 31.0;
    addParkBenchTrashAndFountain(batcher, bxBench, groundY, bzBench, b % 2 === 0);
  }
  for (let bxPath = -440; bxPath <= 440; bxPath += 54) {
    if (Math.abs(bxPath) < 48 || (bxPath > 50 && bxPath < 350)) continue;
    addParkBenchTrashAndFountain(batcher, bxPath, groundY, pz - 8.6, true);
    addParkBenchTrashAndFountain(batcher, bxPath, groundY, pz + 8.6, false);
    addParkBenchTrashAndFountain(batcher, bxPath, groundY, 183.5, false);
    addParkBenchTrashAndFountain(batcher, bxPath, groundY, 352.5, false);
  }

  // 3 QUIOSQUES DE MADEIRA (CORETO / GAZEBO CLÁSSICO OCTOGONAL)
  const gazeboCoords = [
    [-355, 212],
    [-355, 324],
    [-135, 212]
  ];
  for (const [gx, gz] of gazeboCoords) {
    buildWoodenGazeboCoreto(world, batcher, gx, groundY, gz);
  }
}

function addParkBenchTrashAndFountain(batcher, x, yBase, z, includeExtras) {
  batcher.addBox('iron_black', 0.25, 0.55, 1.3, x - 1.5, yBase + 0.28, z);
  batcher.addBox('iron_black', 0.25, 0.55, 1.3, x + 1.5, yBase + 0.28, z);
  batcher.addBox('wood_light', 3.6, 0.16, 1.2, x, yBase + 0.58, z);
  batcher.addBox('wood_brown', 3.6, 0.72, 0.18, x, yBase + 0.98, z - 0.52);

  if (includeExtras) {
    batcher.addBox('iron_black', 0.75, 1.15, 0.75, x + 2.6, yBase + 0.58, z);
    batcher.addBox('gold', 0.82, 0.18, 0.82, x + 2.6, yBase + 1.2, z);
    batcher.addBox('stone_wall', 0.7, 1.05, 0.7, x - 2.6, yBase + 0.52, z);
    batcher.addBox('white_marble', 0.9, 0.22, 0.9, x - 2.6, yBase + 1.1, z);
    batcher.addBox('water_bright', 0.22, 0.28, 0.22, x - 2.6, yBase + 1.32, z);
  }
}

function buildWoodenGazeboCoreto(world, batcher, gx, yBase, gz) {
  batcher.addBox('stone_wall', 16.5, 0.85, 16.5, gx, yBase + 0.42, gz);
  batcher.addBox('wood_brown', 15.6, 0.3, 15.6, gx, yBase + 0.98, gz);
  batcher.addBox('wood_light', 5.2, 0.45, 2.2, gx, yBase + 0.22, gz + 9.0);

  const deckY = yBase + 1.12;
  const posts = [
    [-6.5, -6.5], [0, -6.8], [6.5, -6.5],
    [-6.8, 0], [6.8, 0],
    [-6.5, 6.5], [6.5, 6.5]
  ];
  for (const [dx, dz] of posts) {
    batcher.addBox('white_marble', 0.55, 4.6, 0.55, gx + dx, deckY + 2.3, gz + dz);
  }
  batcher.addBox('wood_light', 14.0, 0.95, 0.3, gx, deckY + 0.5, gz - 6.6);
  batcher.addBox('wood_light', 0.3, 0.95, 14.0, gx - 6.6, deckY + 0.5, gz);
  batcher.addBox('wood_light', 0.3, 0.95, 14.0, gx + 6.6, deckY + 0.5, gz);

  batcher.addBox('brick_red', 17.8, 0.9, 17.8, gx, deckY + 5.0, gz);
  batcher.addBox('wood_brown', 13.2, 0.95, 13.2, gx, deckY + 5.9, gz);
  batcher.addBox('brick_red', 8.2, 1.0, 8.2, gx, deckY + 6.85, gz);
  batcher.addBox('gold', 2.2, 1.8, 2.2, gx, deckY + 8.1, gz);

  world.addCollider(gx, gz, 15.5, 15.5, deckY + 8.5, yBase);
  world.mapBuildings.push({
    x: gx,
    z: gz,
    w: 16.5,
    d: 16.5,
    height: 9.5,
    color: '#9a3412',
    label: 'CORETO DO PARQUE'
  });
}
