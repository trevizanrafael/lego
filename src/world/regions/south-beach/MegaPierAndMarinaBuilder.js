import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../../materials/LegoMaterials.js';
import { UMBRELLA_KEYS, addNeonHotelSign } from './BeachBatcherAndConstants.js';

/**
 * 3B. QUIOSQUES DE PRAIA DO CALÇADÃO CENTRAL E PONTA DA PRAIA / COSTÃO OESTE
 */
export function buildOceanfrontKiosks(world, batcher) {
  const kioskXList = [-460, -250, 135, 420];
  kioskXList.forEach((kx, idx) => {
    buildBeachKiosk(world, batcher, kx, 761, idx, 'QUIOSQUE ORLA');
  });
  const westKioskXList = [-1580, -1320, -1060, -760];
  westKioskXList.forEach((kx, idx) => {
    buildBeachKiosk(world, batcher, kx, 761, idx + 2, 'QUIOSQUE PONTA DA PRAIA');
  });
}

export function buildBeachKiosk(world, batcher, kx, kz, idx, label = 'QUIOSQUE ORLA') {
  const yBase = 0.32;
  const roofColor = UMBRELLA_KEYS[idx % UMBRELLA_KEYS.length];

  batcher.addBox('wood_deck', 14.0, 0.24, 14.0, kx, yBase + 0.12, kz);
  batcher.addBox('coastal_white', 8.6, 1.25, 8.6, kx, yBase + 0.75, kz);
  batcher.addBox('wood_pier', 9.4, 0.22, 9.4, kx, yBase + 1.42, kz);

  batcher.addBox('wood_pier', 3.6, 3.4, 3.6, kx, yBase + 1.8, kz - 1.0);
  batcher.addBox('coastal_turquoise', 1.8, 1.3, 1.4, kx + 2.2, yBase + 1.5, kz - 1.2);
  batcher.addBox('glass_cyan', 1.5, 1.0, 1.4, kx + 2.2, yBase + 2.65, kz - 1.2);

  for (const [dx, dz] of [[-3.8, -3.8], [3.8, -3.8], [-3.8, 3.8], [3.8, 3.8]]) {
    batcher.addBox('wood_pier', 0.45, 3.8, 0.45, kx + dx, yBase + 2.0, kz + dz);
  }
  batcher.addBox(roofColor, 12.2, 0.65, 12.2, kx, yBase + 4.1, kz);
  batcher.addBox('trim_white', 9.2, 0.65, 9.2, kx, yBase + 4.75, kz);
  batcher.addBox(roofColor, 5.6, 0.75, 5.6, kx, yBase + 5.45, kz);

  for (const [mx, mz] of [[-8.5, -3.5], [8.5, -3.5], [-8.5, 4.5], [8.5, 4.5]]) {
    const tx = kx + mx;
    const tz = kz + mz;
    batcher.addBox('trim_white', 1.6, 0.8, 1.6, tx, yBase + 0.4, tz);
    batcher.addBox('trim_white', 0.18, 2.5, 0.18, tx, yBase + 1.3, tz);
    batcher.addBox(roofColor, 3.2, 0.42, 3.2, tx, yBase + 2.6, tz);
    batcher.addBox('trim_white', 0.6, 0.55, 0.6, tx - 1.3, yBase + 0.28, tz);
    batcher.addBox('trim_white', 0.6, 0.55, 0.6, tx + 1.3, yBase + 0.28, tz);
  }

  if (world.destructibles) {
    for (let c = 0; c < 2; c++) {
      const crateX = kx - 5.2 + c * 1.6;
      const crateZ = kz - 5.2;
      const crateMesh = createLegoBrick(1.2, 1.2, 1.2, c === 0 ? LEGO_COLORS.tan : LEGO_COLORS.orange);
      crateMesh.position.set(crateX, yBase + 0.6, crateZ);
      world.scene.add(crateMesh);
      const col = world.addCollider(crateX, crateZ, 1.2, 1.2, yBase + 1.2, yBase);
      world.destructibles.registerDestructible({
        mesh: crateMesh,
        type: 'crate',
        hp: 15,
        radius: 0.9,
        height: 1.2,
        colliders: [col],
        debrisColors: [LEGO_COLORS.tan, LEGO_COLORS.orange, LEGO_COLORS.yellow],
        studDrops: { silver: 3, gold: 3, blue: 0, purple: 0 },
        groundY: yBase
      });
    }
  }

  world.addCollider(kx, kz, 9.2, 9.2, yBase + 4.5, yBase);
  world.mapBuildings.push({
    x: kx,
    z: kz,
    w: 11,
    d: 11,
    height: 5.5,
    color: '#fb923c',
    label
  });
}

/**
 * 5. MEGA PÍER PARQUE DE MADEIRA (540m MAR ADENTRO!), RESTAURANTE 2 ANDARES, FLIPERAMA,
 * CARROSSEL GIRATÓRIO, MONTANHA-RUSSA, TORRE BIG DROP, RODA-GIGANTE COLOSSAL, FAROL & MARINA LESTE!
 */
export function buildMonumentalPierFerrisWheelAndMarina(world, batcher) {
  const pierX = 0;
  // Passarela Principal do Píer: 96m de largura, de Z = 1040 até Z = 1420 (380m)
  const mainPierZ = 1230;
  const mainPierW = 96;
  const mainPierD = 380;
  // Grande Praça Oceânica na Ponta Funda do Píer: 136m de largura, de Z = 1420 até Z = 1570 (150m) -> Total: 530m mar adentro!
  const endPlazaZ = 1495;
  const endPlazaW = 136;
  const endPlazaD = 150;
  const deckTopY = 1.6;

  // Rampa Larga de Entrada do Píer saindo da Areia (Z = 1020..1042)
  const entryRamp = createLegoBrick(mainPierW - 10, 1.2, 24, LEGO_COLORS.brown, { studStep: 2.5 });
  entryRamp.position.set(pierX, 0.6, 1030);
  world.scene.add(entryRamp);
  world.addCollider(pierX, 1030, mainPierW - 10, 24, 1.2, 0);

  // Tabuleiro Principal (96m x 380m) + Praça Oceânica Final (136m x 150m)
  const pierDeck = createLegoBrick(mainPierW, 1.6, mainPierD, LEGO_COLORS.brown, { studStep: 8.0 });
  pierDeck.position.set(pierX, deckTopY * 0.5, mainPierZ);
  world.scene.add(pierDeck);
  world.addCollider(pierX, mainPierZ, mainPierW, mainPierD, deckTopY, 0);
  world.mapBlocks.push({ x: pierX, z: mainPierZ, w: mainPierW, d: mainPierD, color: '#92400e' });

  const plazaDeck = createLegoBrick(endPlazaW, 1.6, endPlazaD, LEGO_COLORS.brown, { studStep: 8.0 });
  plazaDeck.position.set(pierX, deckTopY * 0.5, endPlazaZ);
  world.scene.add(plazaDeck);
  world.addCollider(pierX, endPlazaZ, endPlazaW, endPlazaD, deckTopY, 0);
  world.mapBlocks.push({ x: pierX, z: endPlazaZ, w: endPlazaW, d: endPlazaD, color: '#78350f' });

  // Mais de 140 Estacas / Pilares de Madeira com Travessas fincados no Oceano sob todo o Mega Píer!
  for (let pz = 1048; pz <= 1564; pz += 22) {
    const halfW = pz >= 1420 ? endPlazaW * 0.5 - 4 : mainPierW * 0.5 - 4;
    for (const px of [-halfW, -halfW * 0.5, 0, halfW * 0.5, halfW]) {
      batcher.addBox('wood_pilings', 1.6, 3.4, 1.6, px, -0.2, pz);
    }
    batcher.addBox('wood_pilings', halfW * 2, 0.45, 0.45, 0, -0.1, pz);
  }

  // Cercas Laterais Brancas de Segurança + Postes Duplos Estilo Parque Temático ao longo dos 530m
  batcher.addBox('trim_white', 0.5, 1.2, mainPierD, -mainPierW * 0.5 + 0.6, deckTopY + 0.6, mainPierZ);
  batcher.addBox('trim_white', 0.5, 1.2, mainPierD, mainPierW * 0.5 - 0.6, deckTopY + 0.6, mainPierZ);
  batcher.addBox('trim_white', 0.5, 1.2, endPlazaD, -endPlazaW * 0.5 + 0.6, deckTopY + 0.6, endPlazaZ);
  batcher.addBox('trim_white', 0.5, 1.2, endPlazaD, endPlazaW * 0.5 - 0.6, deckTopY + 0.6, endPlazaZ);
  batcher.addBox('trim_white', endPlazaW, 1.2, 0.5, pierX, deckTopY + 0.6, 1569.4);

  for (let lz = 1055; lz <= 1555; lz += 25) {
    const railX = lz >= 1420 ? endPlazaW * 0.5 - 3.5 : mainPierW * 0.5 - 3.5;
    for (const lx of [-railX, railX]) {
      batcher.addBox('stone_black', 0.4, 5.2, 0.4, lx, deckTopY + 2.6, lz);
      batcher.addBox('window_warm', 1.1, 1.1, 1.1, lx, deckTopY + 5.4, lz);
    }
  }

  // 1. PÓRTICO MONUMENTAL DE ENTRADA DO PÍER + BILHETERIAS (Z = 1046)
  batcher.addBox('trim_white', 3.2, 14.5, 3.2, -26, deckTopY + 7.25, 1046);
  batcher.addBox('trim_white', 3.2, 14.5, 3.2, 26, deckTopY + 7.25, 1046);
  batcher.addBox('neon_pink', 56.0, 3.2, 1.8, 0, deckTopY + 14.8, 1046);
  addNeonHotelSign(world, 0, deckTopY + 15.2, 1044.5, 48, 'PÍER PARQUE ATLÂNTICO ', '#00f0ff', '#fde047');

  // 2. RESTAURANTE MARÍTIMO DE 2 ANDARES COM TERRAÇO PANORÂMICO (X = -28, Z = 1125)
  const restX = -28;
  const restZ = 1125;
  batcher.addBox('coastal_white', 24, 1.4, 34, restX, deckTopY + 0.7, restZ);
  batcher.addBox('glass_cyan', 22.8, 3.6, 32.8, restX, deckTopY + 3.2, restZ);
  batcher.addBox('wood_deck', 26, 0.7, 36, restX, deckTopY + 5.35, restZ);
  batcher.addBox('coastal_turquoise', 16, 4.4, 20, restX - 3, deckTopY + 7.9, restZ - 4);
  batcher.addBox('umb_orange', 18, 0.9, 22, restX - 3, deckTopY + 10.55, restZ - 4);
  for (const tz of [restZ + 8, restZ + 14]) {
    batcher.addBox('trim_white', 1.6, 0.8, 1.6, restX + 5, deckTopY + 6.1, tz);
    batcher.addBox('umb_red', 3.2, 0.4, 3.2, restX + 5, deckTopY + 8.1, tz);
  }
  addNeonHotelSign(world, restX + 12.5, deckTopY + 8.5, restZ, 24, 'RESTAURANTE DO PÍER', '#fb923c', '#ffffff');
  world.addCollider(restX, restZ, 25, 35, deckTopY + 10.5, deckTopY);

  // 3. FLIPERAMA / ARCADE NEON 3D (X = +28, Z = 1125) — camadas verticais sem z-fighting!
  const arcX = 28;
  const arcZ = 1125;
  batcher.addBox('window_warm', 22, 3.6, 32, arcX, deckTopY + 1.8, arcZ);
  batcher.addBox('neon_pink', 25, 0.9, 35, arcX, deckTopY + 4.05, arcZ);
  batcher.addBox('stone_black', 24, 3.7, 34, arcX, deckTopY + 6.35, arcZ);
  batcher.addBox('neon_cyan', 25.4, 0.9, 35.4, arcX, deckTopY + 8.65, arcZ);
  addNeonHotelSign(world, arcX - 12.5, deckTopY + 7.2, arcZ, 24, 'MEGA ARCADE LEGO ', '#ec4899', '#00f0ff');
  world.addCollider(arcX, arcZ, 25, 35, deckTopY + 9.2, deckTopY);

  // 4. OITO BARRAQUINHAS TEMÁTICAS COLORIDAS (Sorveteria com Casquinha Gigante, Pipoca, Churros, Tiro ao Alvo)
  const boothZList = [1185, 1225, 1265, 1385];
  boothZList.forEach((bz, bIdx) => {
    for (const side of [-1, 1]) {
      const bx = side * 32.0;
      const bColor = UMBRELLA_KEYS[(bIdx * 2 + (side > 0 ? 1 : 0)) % UMBRELLA_KEYS.length];
      batcher.addBox('trim_white', 9.5, 4.2, 9.5, bx, deckTopY + 2.1, bz);
      batcher.addBox(bColor, 10.8, 0.95, 10.8, bx, deckTopY + 4.6, bz);
      batcher.addBox('trim_white', 7.8, 0.85, 7.8, bx, deckTopY + 5.4, bz);
      batcher.addBox('window_warm', 7.2, 1.6, 9.7, bx, deckTopY + 2.5, bz);
      // Sorvete / Casquinha 3D gigante decorativa no topo das primeiras barraquinhas!
      if (bIdx % 2 === 0) {
        batcher.addBox('wood_deck', 1.6, 2.2, 1.6, bx, deckTopY + 6.8, bz);
        batcher.addBox('umb_pink', 2.6, 2.2, 2.6, bx, deckTopY + 8.6, bz);
        batcher.addBox('trim_white', 1.8, 1.4, 1.8, bx, deckTopY + 10.1, bz);
      }
      world.addCollider(bx, bz, 9.6, 9.6, deckTopY + 5.6, deckTopY);
    }
  });

  // 5. MONTANHA-RUSSA OCEÂNICA EM CIRCUITO FECHADO (Construída dinamicamente em `InteractiveAttractionsAndEmotes.js`!)

  // 6. CARROSSEL CLÁSSICO GIRATÓRIO 3D (X = -16, Z = 1325) — Gira continuamente no loop!
  const carouselGroup = new THREE.Group();
  carouselGroup.position.set(-16, deckTopY, 1325);
  const cBase = createLegoBrick(18, 0.8, 18, LEGO_COLORS.white);
  cBase.position.y = 0.4;
  const cPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 8.5, 16),
    getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.6, roughness: 0.2 })
  );
  cPillar.position.y = 4.6;
  const cRoof1 = new THREE.Mesh(
    new THREE.ConeGeometry(11.5, 4.5, 16),
    getLegoMaterial(0xec4899, { roughness: 0.25 })
  );
  cRoof1.position.y = 10.2;
  carouselGroup.add(cBase, cPillar, cRoof1);

  for (let h = 0; h < 8; h++) {
    const ang = (h / 8) * Math.PI * 2;
    const hx = Math.cos(ang) * 6.8;
    const hz = Math.sin(ang) * 6.8;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 7.5, 8),
      getLegoMaterial(LEGO_COLORS.gold)
    );
    pole.position.set(hx, 4.4, hz);
    const mount = createLegoBrick(1.4, 1.2, 2.4, h % 2 === 0 ? LEGO_COLORS.white : 0x38bdf8);
    mount.position.set(hx, 2.2 + (h % 2) * 0.8, hz);
    mount.rotation.y = -ang;
    carouselGroup.add(pole, mount);
  }
  world.scene.add(carouselGroup);
  world.rotatingElements.push({ mesh: carouselGroup, axis: 'y', speed: 0.85 });
  world.addCollider(-16, 1325, 18, 18, deckTopY + 12, deckTopY);

  // 7. TORRE DE QUEDA LIVRE "BIG DROP" DE 58m DE ALTURA! (X = +24, Z = 1325 — Gôndola animada em `InteractiveAttractionsAndEmotes.js`!)
  const dropX = 24;
  const dropZ = 1325;
  const dropH = 58.0;
  batcher.addBox('umb_red', 5.2, dropH, 5.2, dropX, deckTopY + dropH * 0.5, dropZ);
  batcher.addBox('umb_yellow', 6.4, 3.2, 6.4, dropX, deckTopY + dropH, dropZ);
  batcher.addBox('neon_cyan', 7.8, 1.8, 7.8, dropX, deckTopY + dropH + 2.2, dropZ);
  world.addCollider(dropX, dropZ, 5.4, 5.4, deckTopY + dropH + 3.0, deckTopY);

  // ============================================================================
  // 8. RODA-GIGANTE 3D COLOSSAL NA PRAÇA FUNDA DO PÍER (Z = 1480, Raio 32m, 16 Cabines!)
  // ============================================================================
  const wheelZ = 1480;
  const wheelCenterY = 42.0;
  const wheelRadius = 31.0;
  const cabinCount = 16;

  batcher.addBox('trim_white', 34, 2.6, 52, 0, deckTopY + 1.3, wheelZ);
  world.addCollider(0, wheelZ, 34, 52, deckTopY + 2.6, deckTopY);

  const supportMat = getLegoMaterial(LEGO_COLORS.white);
  const neonHubMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const neonPinkMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

  for (const sx of [-7.5, 7.5]) {
    const legA = new THREE.Mesh(new THREE.BoxGeometry(2.2, 45, 2.6), supportMat);
    legA.position.set(sx, 23.0, wheelZ - 11.0);
    legA.rotation.x = -0.24;
    const legB = new THREE.Mesh(new THREE.BoxGeometry(2.2, 45, 2.6), supportMat);
    legB.position.set(sx, 23.0, wheelZ + 11.0);
    legB.rotation.x = 0.24;
    const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 2.6, 20), neonPinkMat);
    hubCap.rotation.z = Math.PI / 2;
    hubCap.position.set(sx, wheelCenterY, wheelZ);
    world.scene.add(legA, legB, hubCap);
  }

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(0, wheelCenterY, wheelZ);

  const rimMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.2 });
  const innerNeonMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

  for (const rx of [-3.8, 3.8]) {
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.85, 12, 48), rimMat);
    outerRing.rotation.y = Math.PI / 2;
    outerRing.position.x = rx;
    wheelGroup.add(outerRing);

    const neonRing = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius * 0.72, 0.45, 10, 40), neonHubMat);
    neonRing.rotation.y = Math.PI / 2;
    neonRing.position.x = rx * 0.92;
    wheelGroup.add(neonRing);
  }

  const centerAxle = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 16.0, 20), innerNeonMat);
  centerAxle.rotation.z = Math.PI / 2;
  wheelGroup.add(centerAxle);

  const cabinColors = [
    LEGO_COLORS.red,
    LEGO_COLORS.blue,
    LEGO_COLORS.yellow,
    LEGO_COLORS.orange,
    LEGO_COLORS.green,
    0xec4899,
    0x06b6d4,
    0xa855f7
  ];

  const ferrisCabins = [];
  for (let i = 0; i < cabinCount; i++) {
    const angle = (i / cabinCount) * Math.PI * 2;
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    for (const rx of [-3.6, 3.6]) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, wheelRadius * 2, 8), rimMat);
      spoke.position.x = rx;
      spoke.rotation.x = angle;
      wheelGroup.add(spoke);
    }

    const cabinColor = cabinColors[i % cabinColors.length];
    const cabinGroup = new THREE.Group();
    const cabinBody = createLegoBrick(5.0, 2.0, 4.0, cabinColor, { studs: false });
    cabinBody.position.y = -1.0;
    const cabinGlass = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 1.3, 3.8),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.45 })
    );
    cabinGlass.position.y = 0.45;
    const cabinRoof = createLegoBrick(5.2, 0.6, 4.2, cabinColor);
    cabinRoof.position.y = 1.35;

    cabinGroup.add(cabinBody, cabinGlass, cabinRoof);
    cabinGroup.position.set(0, sinA * wheelRadius, cosA * wheelRadius);
    wheelGroup.add(cabinGroup);
    ferrisCabins.push(cabinGroup);
  }

  world.scene.add(wheelGroup);
  world.ferrisWheelGroup = wheelGroup;
  world.ferrisWheelCabins = ferrisCabins;
  world.ferrisWheelCabinCount = cabinCount;
  world.pierData = { zStart: 1030, zEnd: 1570, length: 540, width: mainPierW, plazaWidth: endPlazaW };

  // 9. FAROL MARÍTIMO LISTRADO VERMELHO E BRANCO NA PONTA FINAL DO PÍER (Z = 1552, 36m de altura!)
  const lhZ = 1552;
  for (let s = 0; s < 6; s++) {
    const segW = 8.4 - s * 0.7;
    const segColor = s % 2 === 0 ? 'umb_red' : 'trim_white';
    batcher.addBox(segColor, segW, 5.2, segW, 0, deckTopY + s * 5.2 + 2.6, lhZ);
  }
  const lanternY = deckTopY + 31.2;
  batcher.addBox('stone_black', 6.5, 0.8, 6.5, 0, lanternY + 0.4, lhZ);
  batcher.addBox('window_warm', 4.6, 3.6, 4.6, 0, lanternY + 2.6, lhZ);
  batcher.addBox('umb_red', 5.8, 2.2, 5.8, 0, lanternY + 5.2, lhZ);
  world.addCollider(0, lhZ, 8.5, 8.5, lanternY + 6.5, deckTopY);

  // ============================================================================
  // 10. MARINA LESTE / RAMPA NÁUTICA AMPLIADA COM DOCAS (X = +48..+150)
  // ============================================================================
  const marinaX = 102;
  const marinaZ = 1145;

  batcher.addBox('wood_deck', 58, 0.6, 14, 72, 0.45, 1085);
  batcher.addBox('wood_deck', 12, 0.55, 165, marinaX, 0.15, marinaZ);
  world.addCollider(marinaX, marinaZ, 12, 165, 0.8, 0);
  world.mapBlocks.push({ x: marinaX, z: marinaZ, w: 85, d: 165, color: '#b45309' });

  const dockZList = [1095, 1135, 1175, 1215];

  dockZList.forEach((dz) => {
    batcher.addBox('wood_deck', 46, 0.45, 5.8, marinaX + 26, 0.1, dz);
    batcher.addBox('trim_white', 0.48, 0.9, 0.48, marinaX + 14, 0.55, dz - 2.3);
    batcher.addBox('trim_white', 0.48, 0.9, 0.48, marinaX + 38, 0.55, dz - 2.3);
    // As Lanchas e Jet-Skis da Marina agora são veículos pilotáveis reais (em NavalAndAirFleetBuilder.js)!
  });
}

export function addLegoSpeedboat(batcher, x, yWater, z, hullKey) {
  batcher.addBox('trim_white', 3.4, 0.85, 8.8, x, yWater + 0.3, z);
  batcher.addBox(hullKey, 3.55, 0.38, 8.9, x, yWater + 0.52, z);
  batcher.addBox('trim_white', 2.4, 0.75, 2.4, x, yWater + 0.35, z + 5.2);
  batcher.addBox('glass_cyan', 2.9, 0.75, 1.4, x, yWater + 0.98, z + 1.4);
  batcher.addBox('trim_white', 2.4, 0.65, 1.2, x, yWater + 0.82, z - 0.6);
  batcher.addBox('stone_black', 1.1, 1.1, 1.1, x, yWater + 0.65, z - 4.6);
  batcher.addBox('surf_foam', 4.2, 0.08, 10.6, x, yWater - 0.16, z - 0.6);
}

/**
 * 6B. MARINA OESTE COM PÍER DE MADEIRA, CLUBE NÁUTICO & 4 DOCAS DE LANCHAS (X = -1380, Z = 1045..1230)
 */
export function buildWestMarina(world, batcher) {
  const westMarinaX = -1380;
  const westMarinaZ = 1135;

  // Clube Náutico Oeste na entrada da Marina (Z = 1032)
  batcher.addBox('wood_deck', 56, 0.8, 26, westMarinaX, 0.4, 1032);
  batcher.addBox('coastal_white', 38, 1.6, 16, westMarinaX, 1.6, 1030);
  batcher.addBox('glass_cyan', 34, 4.4, 14.8, westMarinaX, 4.6, 1030);
  batcher.addBox('coastal_turquoise', 42, 1.2, 19, westMarinaX, 7.4, 1030);
  addNeonHotelSign(world, westMarinaX, 9.2, 1020.5, 32, 'MARINA OESTE ', '#06b6d4', '#fde047');
  world.addCollider(westMarinaX, 1030, 38, 16, 8.5, 0);
  world.mapBuildings.push({
    x: westMarinaX,
    z: 1030,
    w: 42,
    d: 19,
    height: 9,
    color: '#06b6d4',
    label: 'MARINA OESTE'
  });

  // Passarela Principal da Marina Oeste (14m x 185m avançando no mar até Z = 1225)
  batcher.addBox('wood_deck', 14, 0.65, 185, westMarinaX, 0.25, westMarinaZ);
  world.addCollider(westMarinaX, westMarinaZ, 14, 185, 0.9, 0);
  world.mapBlocks.push({ x: westMarinaX, z: westMarinaZ, w: 92, d: 185, color: '#b45309' });

  const westDockZList = [1095, 1135, 1175, 1215];
  westDockZList.forEach((dz) => {
    batcher.addBox('wood_deck', 48, 0.48, 6.0, westMarinaX + 28, 0.15, dz);
    batcher.addBox('trim_white', 0.5, 0.95, 0.5, westMarinaX + 14, 0.6, dz - 2.4);
    batcher.addBox('trim_white', 0.5, 0.95, 0.5, westMarinaX + 42, 0.6, dz - 2.4);
  });

  world.southwestBeachData = {
    hasSouthwestLighthouse: true,
    lighthousePos: { x: -1735, y: 15.0, z: 945, height: 67 },
    hasSandDunes: true,
    dunesCount: 4,
    ...(world.southwestBeachData || {}),
    hasWestMarina: true,
    westMarinaPos: { x: westMarinaX, z: westMarinaZ, docksCount: westDockZList.length }
  };
}
