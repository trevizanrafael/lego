import * as THREE from 'three';
import { createLegoBrick } from '../../../materials/LegoMaterials.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import {
  getFavelaEastBorderX,
  getFavelaElevation,
  WINDING_LADEIRAS,
  getLadeiraZAtX
} from './FavelaElevationAndBatcher.js';

/**
 * Cria placas e murais de facção 3D (CV / CDD / Paredão / Caixa d'Água)
 */
function addFavelaSignBoard(world, x, y, z, width, height, text, subText = '', opts = {}) {
  const rotY = typeof opts.rotY === 'number' ? opts.rotY : opts.rotY ? Math.PI / 2 : 0;
  const mesh = createSignBoardMesh({
    x,
    y,
    z,
    width,
    height,
    depth: opts.depth || 0.7,
    rotY,
    title: text,
    subText,
    bgColor: opts.bgColor || '#991b1b',
    borderColor: opts.borderColor || '#090a0d',
    textColor: opts.textColor || '#ffffff',
    subColor: opts.subColor || '#facc15',
    doubleSided: true
  });
  world.scene.add(mesh);
}

/**
 * 2. RUELAS TORTAS DE CIMENTO, LADEIRAS SERPENTEANTES & ESCADÕES DO MORRO (VERMELHO E BRANCO)
 * Sobem serpenteando pela encosta contínua (`y = getFavelaElevation(x, z)`) desde Y = 0 até o cume!
 */
export function buildWindingHillsideRoadsAndStaircases(world, batcher) {
  let ladeiraIdx = 0;
  for (const ladeira of WINDING_LADEIRAS) {
    ladeiraIdx++;
    const xEast = getFavelaEastBorderX(ladeira.zStart);
    const xWest = -975;
    const stepX = 6.0;
    let segCounter = 0;

    for (let x = xEast - 3; x >= xWest; x -= stepX) {
      segCounter++;
      const z = getLadeiraZAtX(ladeira, x);
      const nextX = x - stepX;
      const nextZ = getLadeiraZAtX(ladeira, nextX);
      const midX = (x + nextX) * 0.5;
      const midZ = (z + nextZ) * 0.5;
      const y = getFavelaElevation(midX, midZ);
      if (y <= 0.05) continue;

      const roadW = ladeira.hasStairs ? 5.8 : 7.4;

      // Base/alicerce de cimento acompanhando exatamente a inclinação da ladeira (`getFavelaElevation`)
      batcher.addBox('alley_cement', stepX + 1.4, 1.8, roadW, midX, y - 0.72, midZ);

      // Nas ladeiras de Escadão, pinta os degraus e muretas laterais de Vermelho e Branco (Cores do CV!)
      if (ladeira.hasStairs) {
        const isRed = Math.abs(Math.round(x / stepX)) % 2 === 0;
        batcher.addBox(isRed ? 'cv_red' : 'cv_white', stepX * 0.9, 0.28, roadW - 0.8, midX, y + 0.08, midZ);
        for (const side of [-1, 1]) {
          batcher.addBox('cv_red', stepX + 0.4, 0.95, 0.36, midX, y + 0.45, midZ + side * (roadW * 0.5 - 0.2));
        }
      } else {
        // Meio-fio vermelho e branco nas Ladeiras Tortas de Subida de Motos/Picapes do CV!
        const curbMat = Math.abs(Math.round(x / stepX)) % 2 === 0 ? 'cv_red' : 'cv_white';
        for (const side of [-1, 1]) {
          batcher.addBox(curbMat, stepX + 0.6, 0.38, 0.42, midX, y + 0.12, midZ + side * (roadW * 0.5 - 0.2));
        }
      }

      // Postes de Madeira & Gambiarras Luminosas nas Ladeiras Tortas (a cada 30m!)
      if (segCounter % 5 === 2 && y > 0.35) {
        const poleSide = (segCounter + ladeiraIdx) % 2 === 0 ? 1 : -1;
        const poleZ = midZ + poleSide * (roadW * 0.5 + 0.45);
        const bulbZ = midZ + poleSide * (roadW * 0.5 - 0.9);
        batcher.addBox('wood_pole', 0.32, 5.4, 0.32, midX, y + 2.7, poleZ);
        batcher.addBox('wood_pole', 0.2, 0.2, 1.55, midX, y + 5.2, (poleZ + bulbZ) * 0.5);
        batcher.addBox('favela_bulb_warm', 0.38, 0.28, 0.38, midX, y + 4.98, bulbZ);

        // Gambiarra de fio preto cruzando o alto da ladeira com lâmpadas quentes
        batcher.addBox('wire_black', 0.08, 0.08, roadW + 0.9, midX, y + 5.15, midZ);
        batcher.addBox('favela_bulb_warm', 0.24, 0.24, 0.24, midX, y + 4.98, midZ);

        world.nightLampRegistry.push({
          x: midX,
          y: y + 4.95,
          z: bulbZ,
          groundY: y + 0.1,
          warm: true,
          coneH: 4.9,
          coneR: 3.8
        });
      }
    }

    world.favelaCDDData.staircasesCount += 3;
  }

  // 3 Vielas Transversais Tortas (Norte-Sul) serpenteando a meia-encosta e ligando as ladeiras!
  for (const baseX of [-595, -695, -805]) {
    for (let z = -880; z <= 610; z += 8.0) {
      const x = baseX + Math.sin(z * 0.018) * 14 + Math.cos(z * 0.009) * 8;
      const y = getFavelaElevation(x, z);
      if (y <= 0.2) continue;
      batcher.addBox('alley_cement', 4.8, 1.6, 8.8, x, y - 0.68, z);
    }
  }
}

/**
 * 3.1 AS BOCAS DE ENTRADA & BARRICADAS PESADAS DO CV (NA BORDA Y = 0 ONDE TERMINAM AS RUAS DA CIDADE!)
 * Trilhos de ferro fincados no chão, blocos de concreto vermelhos, carcaças queimadas,
 * tambores explosivos e Motos/Picapes do CV estacionadas!
 */
export function buildCVBocasAndHeavyBarricades(world, batcher) {
  const bocas = [
    { x: -524, z: -382, label: 'BOCA NORTE-1 (CV)' },
    { x: -524, z: -250, label: 'BOCA CENTRAL-NORTE (CV)' },
    { x: -524, z: -117, label: 'BOCA PRINCIPAL CDD (CV)' },
    { x: -524, z: 36, label: 'BOCA CENTRAL CDD (CV)' },
    { x: -524, z: 134, label: 'BOCA CAMPINHO (CV)' },
    { x: -524, z: 380, label: 'BOCA SUL (CV)' },
    { x: -654, z: -640, label: 'BOCA SUBÚRBIO-OESTE (CV)' },
    { x: -654, z: 540, label: 'BOCA ORLA-OESTE (CV)' }
  ];

  for (let i = 0; i < bocas.length; i++) {
    const b = bocas[i];
    const by = getFavelaElevation(b.x, b.z);
    world.favelaCDDData.bocasCount++;

    // 1. Blocos de Concreto Pintados de Vermelho e Preto + Trilhos de Ferro ("Ouriços Anti-Caveirão")
    for (const side of [-1, 1]) {
      const bz = b.z + side * 6.2;
      batcher.addBox('cv_red', 2.4, 1.4, 4.2, b.x, by + 0.7, bz);
      batcher.addBox('cv_black', 2.5, 0.35, 4.3, b.x, by + 1.25, bz);
      world.addCollider(b.x, bz, 2.4, 4.2, by + 1.4, by);

      const railX = b.x + 2.4;
      const railZ = b.z + side * 3.0;
      batcher.addBox('rebar_iron', 0.35, 2.2, 0.35, railX, by + 1.1, railZ);
      batcher.addBox('rebar_iron', 1.8, 0.32, 0.32, railX, by + 1.1, railZ);
      batcher.addBox('rebar_iron', 0.32, 0.32, 1.8, railX, by + 1.1, railZ);
      world.addCollider(railX, railZ, 1.6, 1.6, by + 2.1, by);
    }

    // 2. Carcaça de Carro Queimado na Barricada Lateral
    const wreckX = b.x - 1.5;
    const wreckZ = b.z + 10.5;
    const wy = getFavelaElevation(wreckX, wreckZ);
    batcher.addBox('cv_black', 2.6, 1.2, 4.6, wreckX, wy + 0.5, wreckZ);
    batcher.addBox('rebar_iron', 2.2, 0.75, 2.4, wreckX, wy + 1.3, wreckZ - 0.2);
    world.addCollider(wreckX, wreckZ, 2.6, 4.6, wy + 1.7, wy);

    // 3. Guarita / Tenda da Boca do CV (com Guarda-Sol Vermelho e Sacos de Areia)
    const boothX = b.x - 2.8;
    const boothZ = b.z - 10.2;
    const bty = getFavelaElevation(boothX, boothZ);
    batcher.addBox('sandbag_tan', 3.4, 1.2, 3.4, boothX, bty + 0.5, boothZ);
    batcher.addBox('wood_pole', 0.25, 3.4, 0.25, boothX, bty + 1.7, boothZ);
    batcher.addBox('cv_red', 4.2, 0.45, 4.2, boothX, bty + 3.4, boothZ);
    batcher.addBox('cv_white', 2.8, 0.35, 2.8, boothX, bty + 3.7, boothZ);
    world.addCollider(boothX, boothZ, 3.4, 3.4, bty + 1.2, bty);

    // 4. Placa de Aviso da Facção na Entrada da Boca
    if (i < 6) {
      addFavelaSignBoard(
        world,
        b.x + 1.2,
        by + 4.4,
        b.z,
        14.0,
        2.4,
        'COMPLEXO DA CIDADE DE DEUS',
        'TERRITÓRIO 100% CV • REDUZA A VELOCIDADE',
        { rotY: true, bgColor: '#dc2626', borderColor: '#090a0d', textColor: '#ffffff', subColor: '#facc15' }
      );
    }

    // 5. Tambores Vermelhos Explosivos Quebráveis nas Barricadas do CV!
    for (const side of [-1, 1]) {
      const barrelGroup = new THREE.Group();
      const body = createLegoBrick(1.1, 1.6, 1.1, 0xdc2626, { studs: true });
      body.position.y = 0.8;
      const stripe = createLegoBrick(1.15, 0.3, 1.15, 0xfacc15, { studs: false });
      stripe.position.y = 0.9;
      barrelGroup.add(body, stripe);

      const bx = b.x + 1.8;
      const bz = b.z + side * 8.6;
      const barrelY = getFavelaElevation(bx, bz);
      barrelGroup.position.set(bx, barrelY, bz);
      world.scene.add(barrelGroup);

      const bCol = world.addCollider(bx, bz, 1.1, 1.1, barrelY + 1.6, barrelY);
      if (world.destructibles) {
        world.destructibles.registerDestructible({
          mesh: barrelGroup,
          type: 'explosive_barrel',
          hp: 25,
          radius: 1.2,
          height: 1.6,
          colliders: [bCol],
          debrisColors: [0xdc2626, 0xfacc15, 0x090a0d],
          studDrops: { silver: 2, gold: 3, blue: 1, purple: 0 },
          groundY: barrelY
        });
      }
    }
  }
}

/**
 * 3.2 O CAMPINHO DE FUTEBOL DA CDD (VÁRZEA EM X = -605, Z = +195, Y ≈ 11.5m)
 * Posicionado sobre a colina suave com alicerce de concreto embutido na encosta!
 */
export function buildCDDSoccerFieldVarzea(world, batcher, cx, yBase, cz) {
  const fieldW = 44;
  const fieldD = 68;

  // Alicerce de concreto raso nivelando o campinho na encosta suave (sem paredão gigante!)
  batcher.addBox('retaining_concrete', fieldW + 3, 4.5, fieldD + 3, cx, yBase - 2.15, cz);
  batcher.addBox('varzea_dirt', fieldW, 0.18, fieldD, cx, yBase + 0.08, cz);
  for (let gz = cz - 22; gz <= cz + 22; gz += 11) {
    batcher.addBox('varzea_grass', fieldW - 8, 0.2, 6.0, cx, yBase + 0.09, gz);
  }

  // Linhas de Cal Branca
  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.45, cx, yBase + 0.1, cz);
  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.45, cx, yBase + 0.1, cz - fieldD * 0.5 + 2);
  batcher.addBox('cv_white', fieldW - 4, 0.22, 0.45, cx, yBase + 0.1, cz + fieldD * 0.5 - 2);
  batcher.addBox('cv_white', 0.45, 0.22, fieldD - 4, cx - fieldW * 0.5 + 2, yBase + 0.1, cz);
  batcher.addBox('cv_white', 0.45, 0.22, fieldD - 4, cx + fieldW * 0.5 - 2, yBase + 0.1, cz);

  // As 2 Traves Brancas com Rede
  for (const endDir of [-1, 1]) {
    const gz = cz + endDir * (fieldD * 0.5 - 2.5);
    batcher.addBox('cv_white', 0.4, 3.4, 0.4, cx - 5.2, yBase + 1.7, gz);
    batcher.addBox('cv_white', 0.4, 3.4, 0.4, cx + 5.2, yBase + 1.7, gz);
    batcher.addBox('cv_white', 10.8, 0.4, 0.4, cx, yBase + 3.4, gz);
    batcher.addBox('fence_mesh', 10.4, 3.2, 1.4, cx, yBase + 1.6, gz + endDir * 0.8);
    world.addCollider(cx, gz + endDir * 0.8, 10.8, 1.6, yBase + 3.5, yBase);
  }

  // Alambrado de Tela Metálica Cercando o Campinho (com entradas abertas no meio)
  for (const sideX of [-1, 1]) {
    const fx = cx + sideX * (fieldW * 0.5 + 1.0);
    for (let fz = cz - 28; fz <= cz + 28; fz += 14) {
      if (Math.abs(fz - cz) < 6) continue;
      batcher.addBox('rebar_iron', 0.35, 4.4, 0.35, fx, yBase + 2.2, fz);
      batcher.addBox('fence_mesh', 0.18, 4.0, 13.6, fx, yBase + 2.0, fz);
      world.addCollider(fx, fz, 0.6, 13.6, yBase + 4.4, yBase);
    }
  }

  // Arquibancada de Cimento Vermelho e Branco + Muro do CV
  const bleachX = cx - fieldW * 0.5 - 4.2;
  for (let step = 0; step < 4; step++) {
    const sx = bleachX - step * 1.3;
    const sh = (step + 1) * 0.9;
    const sMat = step % 2 === 0 ? 'cv_red' : 'cv_white';
    batcher.addBox('retaining_concrete', 1.3, sh + 2.0, fieldD - 8, sx, yBase + sh * 0.5 - 1.0, cz);
    batcher.addBox(sMat, 1.35, 0.22, fieldD - 8, sx, yBase + sh, cz);
    world.addCollider(sx, cz, 1.3, fieldD - 8, yBase + sh, yBase);
  }

  addFavelaSignBoard(
    world,
    bleachX - 5.2,
    yBase + 5.2,
    cz,
    36.0,
    3.5,
    'CAMPINHO DA CIDADE DE DEUS (VÁRZEA)',
    'COMANDO VERMELHO • TROPA DA CDD',
    { rotY: true, bgColor: '#dc2626', borderColor: '#ffffff', textColor: '#ffffff', subColor: '#facc15' }
  );

  // 4 Torres de Refletores nos Cantos do Campinho acendendo feixes brancos sobre o gramado à noite!
  const floodConeGeo = new THREE.ConeGeometry(11.5, 19.0, 14, 1, true);
  floodConeGeo.translate(0, -9.5, 0);
  const floodConeMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ]) {
    const tx = cx + sx * (fieldW * 0.5 + 1.8);
    const tz = cz + sz * (fieldD * 0.5 - 1.5);
    batcher.addBox('rebar_iron', 0.55, 13.8, 0.55, tx, yBase + 6.9, tz);
    batcher.addBox('cv_black', 2.6, 1.35, 0.65, tx, yBase + 13.8, tz);
    batcher.addBox('floodlight_panel', 2.3, 1.05, 0.72, tx, yBase + 13.8, tz);

    const cone = new THREE.Mesh(floodConeGeo, floodConeMat);
    cone.position.set(tx, yBase + 13.5, tz);
    cone.lookAt(cx, yBase + 0.2, cz + sz * 8.0);
    cone.rotateX(Math.PI / 2);
    cone.visible = false;
    world.scene.add(cone);
    world.favelaSoccerFloodCones.push({ mesh: cone, mat: floodConeMat });

    world.nightLampRegistry?.push({
      x: cx + sx * 8.0,
      y: yBase + 11.5,
      z: cz + sz * 14.0,
      groundY: yBase + 0.12,
      warm: false,
      coneH: 11.4,
      coneR: 8.5
    });
  }

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: fieldW,
    d: fieldD,
    height: 4,
    color: '#16a34a',
    label: 'CAMPINHO CDD'
  });

  world.favelaCDDData.hasSoccerField = true;
}

/**
 * 3.3 A QUADRA DO BAILE DO CV (PAREDÃO DE SOM GIGANTE EM X = -715, Z = -135, Y ≈ 25.0m)
 */
export function buildCVBailePlazaAndGiantParedao(world, batcher, cx, yBase, cz) {
  const plazaW = 50;
  const plazaD = 58;

  // Alicerce de concreto embutido na colina + piso vermelho e preto da Quadra do Baile
  batcher.addBox('retaining_concrete', plazaW + 2, 4.5, plazaD + 2, cx, yBase - 2.15, cz);
  batcher.addBox('cv_black', plazaW, 0.14, plazaD, cx, yBase + 0.07, cz);
  batcher.addBox('cv_red', plazaW - 8, 0.08, plazaD - 8, cx, yBase + 0.18, cz);

  // O PAREDÃO DE SOM COLOSSAL DO BAILE DA CDD
  const paredaoX = cx - 19.0;
  const paredaoW = 5.4;
  const paredaoH = 11.5;
  const paredaoD = 21.0;

  batcher.addBox('cv_black', paredaoW, paredaoH, paredaoD, paredaoX, yBase + paredaoH * 0.5, cz);
  batcher.addBox('cv_red', paredaoW + 0.3, 1.2, paredaoD + 0.6, paredaoX, yBase + paredaoH + 0.6, cz);
  world.addCollider(paredaoX, cz, paredaoW, paredaoD, yBase + paredaoH + 1.2, yBase);

  for (let row = 0; row < 4; row++) {
    const sy = yBase + 1.6 + row * 2.5;
    const neonKey = row % 2 === 0 ? 'neon_red' : row === 1 ? 'neon_gold' : 'neon_cyan';
    batcher.addBox(neonKey, 0.35, 0.28, paredaoD - 1.2, paredaoX + paredaoW * 0.5 + 0.15, sy + 1.1, cz);

    for (let col = -2; col <= 2; col++) {
      const sz = cz + col * 3.8;
      batcher.addBox('cv_red', 0.45, 2.0, 3.2, paredaoX + paredaoW * 0.5 + 0.1, sy, sz);
      batcher.addBox('cv_black', 0.6, 1.3, 2.0, paredaoX + paredaoW * 0.5 + 0.2, sy, sz);
      batcher.addBox('neon_gold', 0.7, 0.45, 0.45, paredaoX + paredaoW * 0.5 + 0.25, sy, sz);
    }
  }

  // Palco do DJ / MC na frente do Paredão
  batcher.addBox('retaining_concrete', 5.2, 1.4, 13.5, paredaoX + 5.0, yBase + 0.7, cz);
  batcher.addBox('neon_red', 0.3, 0.3, 13.7, paredaoX + 7.6, yBase + 1.4, cz);
  world.addCollider(paredaoX + 5.0, cz, 5.2, 13.5, yBase + 1.4, yBase);

  addFavelaSignBoard(
    world,
    paredaoX + paredaoW * 0.5 + 0.4,
    yBase + paredaoH + 2.4,
    cz,
    21.0,
    3.4,
    'BAILE DA CIDADE DE DEUS',
    'PAREDÃO MONSTRO • COMANDO VERMELHO',
    { rotY: true, bgColor: '#090a0d', borderColor: '#ff1e42', textColor: '#ff1e42', subColor: '#facc15' }
  );

  // Barraquinhas de Lanche / Bebida nas laterais + Mesas de Plástico Vermelhas e Amarelas!
  for (const sideZ of [-1, 1]) {
    const stallZ = cz + sideZ * 22.5;
    for (const sx of [cx - 5, cx + 8]) {
      batcher.addBox('brick_baiano', 6.2, 3.2, 4.2, sx, yBase + 1.6, stallZ);
      batcher.addBox('cv_red', 7.0, 0.45, 5.2, sx, yBase + 3.4, stallZ);
      world.addCollider(sx, stallZ, 6.2, 4.2, yBase + 3.6, yBase);
    }
  }

  // Mesas de Plástico Vermelhas e Amarelas nas bordas Norte/Sul, deixando o centro da pista 100% livre pro Baile!
  for (let mx = cx - 6; mx <= cx + 14; mx += 6.5) {
    for (const mz of [cz - 17.5, cz + 17.5]) {
      const tableMat = (Math.abs(Math.round(mx + mz)) % 2 === 0) ? 'cv_red' : 'favela_yellow_faded';
      batcher.addBox(tableMat, 1.6, 0.85, 1.6, mx, yBase + 0.42, mz);
      batcher.addBox(tableMat, 0.55, 0.5, 0.55, mx - 1.2, yBase + 0.25, mz);
      batcher.addBox(tableMat, 0.55, 0.5, 0.55, mx + 1.2, yBase + 0.25, mz);
    }
  }

  // Cordões de Luzes Neon e Bandeirinhas Vermelhas cruzando o alto da Quadra do Baile!
  for (let lz = cz - 18; lz <= cz + 18; lz += 12) {
    batcher.addBox('wire_black', 36.0, 0.12, 0.12, cx, yBase + 8.5, lz);
    for (let lx = cx - 14; lx <= cx + 14; lx += 4.5) {
      batcher.addBox('cv_red', 0.65, 0.85, 0.15, lx, yBase + 8.0, lz);
      batcher.addBox('neon_gold', 0.35, 0.35, 0.35, lx + 2.2, yBase + 8.3, lz);
    }
  }

  // 3 Feixes Skytracker (Rosa, Ciano e Amarelo) no topo do Paredão girando para o céu noturno!
  const skyBeamGeo = new THREE.ConeGeometry(5.8, 72.0, 14, 1, true);
  skyBeamGeo.translate(0, 36.0, 0);
  const trackerSpecs = [
    { dz: -7.5, hex: 0xec4899, phase: 0.0 },
    { dz: 0.0, hex: 0x00f0ff, phase: 2.1 },
    { dz: 7.5, hex: 0xfacc15, phase: 4.2 }
  ];
  for (const ts of trackerSpecs) {
    const mat = new THREE.MeshBasicMaterial({
      color: ts.hex,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const pivot = new THREE.Group();
    pivot.position.set(paredaoX, yBase + paredaoH + 1.35, cz + ts.dz);
    const beam = new THREE.Mesh(skyBeamGeo, mat);
    pivot.add(beam);
    pivot.visible = false;
    world.scene.add(pivot);
    world.favelaBaileSkytrackers.push({ pivot, mat, phase: ts.phase });
  }

  world.nightLampRegistry?.push({
    x: cx,
    y: yBase + 8.2,
    z: cz,
    groundY: yBase + 0.15,
    warm: true,
    coneH: 8.0,
    coneR: 7.5
  });

  world.mapBuildings.push({
    x: cx,
    z: cz,
    w: plazaW,
    d: plazaD,
    height: 12,
    color: '#dc2626',
    label: 'BAILE DO CV (PAREDÃO)'
  });

  world.favelaCDDData.hasBaileParedao = true;
}

/**
 * 3.4 O TOPO DO MORRO — FORTALEZA DO BARÃO VERMELHO & CAIXA D'ÁGUA COMUNITÁRIA GIGANTE (X = -865, Z = -240, Y ≈ 42.5m)
 */
export function buildRedBaronSummitFortress(world, batcher, cx, yBase, cz) {
  const fortW = 46;
  const fortD = 60;

  // Alicerce de concreto do Cume integrado suavemente no topo da colina
  batcher.addBox('retaining_concrete', fortW + 4, 5.0, fortD + 4, cx, yBase - 2.4, cz);
  batcher.addBox('alley_cement', fortW + 2, 0.3, fortD + 2, cx, yBase + 0.05, cz);

  // ==========================================================================
  // 1. A CAIXA D'ÁGUA COMUNITÁRIA GIGANTE ("CIDADE DE DEUS") NO TOPO DO MORRO!
  // ==========================================================================
  const towerX = cx + 10;
  const towerZ = cz - 46;
  const towerY = getFavelaElevation(towerX, towerZ);
  const towerH = 32.0;

  batcher.addBox('retaining_concrete', 14.0, 4.5, 14.0, towerX, towerY - 2.0, towerZ);
  for (const [dx, dz] of [[-4.8, -4.8], [4.8, -4.8], [-4.8, 4.8], [4.8, 4.8]]) {
    batcher.addBox('retaining_concrete', 2.2, 16.0, 2.2, towerX + dx, towerY + 8.0, towerZ + dz);
  }
  batcher.addCylinder('cv_red', 9.5, 9.5, 5.0, towerX, towerY + 18.5, towerZ, 14);
  batcher.addCylinder('cv_white', 9.6, 9.6, 5.0, towerX, towerY + 23.5, towerZ, 14);
  batcher.addCylinder('cv_red', 9.5, 9.5, 5.0, towerX, towerY + 28.5, towerZ, 14);
  batcher.addCylinder('cv_dark_red', 10.2, 10.2, 1.2, towerX, towerY + 31.6, towerZ, 14);
  batcher.addBox('rebar_iron', 0.6, 9.0, 0.6, towerX, towerY + 36.5, towerZ);
  batcher.addBox('neon_red', 1.2, 1.2, 1.2, towerX, towerY + 41.2, towerZ);
  world.addCollider(towerX, towerZ, 15.5, 15.5, towerY + towerH, towerY - 2);

  // Luzes Vermelhas Aeronáuticas Piscantes no Topo da Caixa d'Água e Antena do Cume!
  const aeroCoreMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
  const aeroHaloMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  for (const [bx, by, bz, phase] of [
    [towerX, towerY + 41.5, towerZ, 0.0],
    [cx - 8, yBase + 25.9, cz - 5, 1.6]
  ]) {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, by, bz);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 10), aeroCoreMat);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 12), aeroHaloMat.clone());
    bGroup.add(core, halo);
    world.scene.add(bGroup);
    world.favelaSummitBeacons.push({ group: bGroup, haloMat: halo.material, phase });
  }

  addFavelaSignBoard(
    world,
    towerX + 10.2,
    towerY + 23.5,
    towerZ,
    24.0,
    4.6,
    'CIDADE DE DEUS',
    'COMANDO VERMELHO • QG CENTRAL',
    { rotY: true, bgColor: '#dc2626', borderColor: '#ffffff', textColor: '#ffffff', subColor: '#facc15' }
  );
  addFavelaSignBoard(
    world,
    towerX - 10.2,
    towerY + 23.5,
    towerZ,
    24.0,
    4.6,
    'CIDADE DE DEUS',
    'FORTALEZA DO BARÃO VERMELHO',
    { rotY: true, bgColor: '#dc2626', borderColor: '#ffffff', textColor: '#ffffff', subColor: '#facc15' }
  );

  // ==========================================================================
  // 2. A MANSÃO-BUNKER DE TIJOLOS DO BARÃO VERMELHO (QG CENTRAL DO CV)
  // ==========================================================================
  batcher.addBox('brick_baiano', fortW, 3.2, 1.4, cx, yBase + 1.6, cz - fortD * 0.5);
  batcher.addBox('brick_baiano', fortW, 3.2, 1.4, cx, yBase + 1.6, cz + fortD * 0.5);
  batcher.addBox('brick_baiano', 1.4, 3.2, fortD, cx - fortW * 0.5, yBase + 1.6, cz);
  batcher.addBox('brick_baiano', 1.4, 3.2, 20, cx + fortW * 0.5, yBase + 1.6, cz - 19);
  batcher.addBox('brick_baiano', 1.4, 3.2, 20, cx + fortW * 0.5, yBase + 1.6, cz + 19);
  batcher.addBox('sandbag_tan', 2.2, 1.4, 16, cx + fortW * 0.5 + 1.2, yBase + 0.7, cz - 17);
  batcher.addBox('sandbag_tan', 2.2, 1.4, 16, cx + fortW * 0.5 + 1.2, yBase + 0.7, cz + 17);

  for (const [tx, tz] of [
    [cx - 21, cz - 28],
    [cx + 21, cz - 28],
    [cx - 21, cz + 28],
    [cx + 21, cz + 28]
  ]) {
    batcher.addBox('cv_dark_red', 5.0, 11.0, 5.0, tx, yBase + 5.5, tz);
    batcher.addBox('cv_black', 6.0, 1.4, 6.0, tx, yBase + 11.4, tz);
    batcher.addBox('cv_red', 6.4, 0.8, 6.4, tx, yBase + 14.2, tz);
    batcher.addBox('sandbag_tan', 5.6, 1.1, 5.6, tx, yBase + 12.4, tz);
    world.addCollider(tx, tz, 5.4, 5.4, yBase + 14.5, yBase);
  }

  const mansionX = cx - 6;
  const mansionZ = cz;
  batcher.addBox('retaining_concrete', 24, 6.0, 34, mansionX, yBase + 3.0, mansionZ);
  batcher.addBox('cv_red', 24.6, 0.8, 34.6, mansionX, yBase + 6.2, mansionZ);
  batcher.addBox('brick_baiano', 20, 5.8, 28, mansionX, yBase + 9.2, mansionZ);
  batcher.addBox('window_lit', 20.4, 1.8, 22, mansionX, yBase + 9.5, mansionZ);
  batcher.addBox('cement_slab', 23, 0.7, 31, mansionX, yBase + 12.3, mansionZ);
  batcher.addBox('cv_dark_red', 15, 5.2, 19, mansionX - 2, yBase + 15.0, mansionZ);
  batcher.addBox('cement_slab', 17, 0.7, 21, mansionX - 2, yBase + 17.8, mansionZ);
  batcher.addBox('rebar_iron', 0.4, 8.0, 0.4, mansionX - 2, yBase + 21.8, mansionZ - 5);
  batcher.addBox('cv_red', 4.5, 2.6, 0.25, mansionX + 0.2, yBase + 24.2, mansionZ - 5);
  world.addCollider(mansionX, mansionZ, 24, 34, yBase + 18.2, yBase);

  // Piscina Panorâmica no Terraço Frontal da Fortaleza
  const poolX = cx + 12.5;
  const poolZ = cz;
  batcher.addBox('cv_white', 10.5, 1.1, 19.0, poolX, yBase + 0.55, poolZ);
  batcher.addBox('pool_water', 8.8, 1.15, 17.2, poolX, yBase + 0.6, poolZ);
  for (const pz of [poolZ - 6, poolZ + 6]) {
    batcher.addBox('cv_white', 2.2, 0.45, 1.2, poolX - 6.4, yBase + 0.25, pz);
    batcher.addBox('wood_pole', 0.2, 2.8, 0.2, poolX - 6.4, yBase + 1.4, pz);
    batcher.addBox('cv_red', 3.2, 0.35, 3.2, poolX - 6.4, yBase + 2.8, pz);
  }

  if (world.destructibles && typeof world.destructibles.spawnAmbientStud === 'function') {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const sx = poolX + Math.cos(angle) * 6.0;
      const sz = poolZ + Math.sin(angle) * 9.0;
      const kind = i % 4 === 0 ? 'purple' : i % 2 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(sx, yBase + 1.2, sz, kind);
    }
  }

  world.mapBuildings.push(
    {
      x: towerX,
      z: towerZ,
      w: 19,
      d: 19,
      height: 32,
      color: '#dc2626',
      label: 'CAIXA D\'ÁGUA CDD'
    },
    {
      x: cx,
      z: cz,
      w: fortW,
      d: fortD,
      height: 18,
      color: '#991b1b',
      label: 'QG BARÃO VERMELHO (CV)'
    }
  );

  world.favelaCDDData.hasRedBaronFortress = true;
  world.favelaCDDData.hasCommunityWaterTower = true;
}
