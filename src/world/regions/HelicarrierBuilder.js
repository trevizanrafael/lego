import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';

/**
 * 10. NO CÉU (ALTITUDE Y = 410m): AEROPORTA-AVIÕES MONUMENTAL DE CASCO ESPESSO (26m DE ESPESSURA!)
 */
export function buildSkyHelicarrier(world) {
  const hx = 0;
  const hy = 410.0;
  const hz = -50;
  const deckW = 104;
  const deckD = 260;
  const hullThickness = 26.0;

  const carrierGroup = new THREE.Group();
  carrierGroup.userData = { isHelicarrier: true, altitude: hy, hullThickness };
  world.scene.add(carrierGroup);
  world.helicarrierGroup = carrierGroup;

  // 1. CONVÉS DE VOO SUPERIOR + CASCO CENTRAL BLINDADO + QUILHA INFERIOR CHANFRADA (26m de espessura total!)
  const upperDeck = createLegoBrick(deckW, 4.0, deckD, LEGO_COLORS.darkGrey, { studStep: 8.5 });
  upperDeck.position.set(hx, hy - 1.6, hz);
  carrierGroup.add(upperDeck);

  // Extensão Lateral Angulada da Pista Secundária (Convés Duplo Naval)
  const angledDeck = createLegoBrick(26, 3.6, 150, LEGO_COLORS.darkGrey, { studStep: 8.5 });
  angledDeck.position.set(hx - 54, hy - 1.8, hz + 10);
  carrierGroup.add(angledDeck);

  // Casco Intermediário Blindado (Espessura 12m: Y = 394m a 406m)
  const midHull = createLegoBrick(deckW - 12, 12.0, deckD - 22, LEGO_COLORS.charcoal, {
    studs: false,
    metalness: 0.35,
    roughness: 0.25
  });
  midHull.position.set(hx, hy - 9.6, hz);
  carrierGroup.add(midHull);

  // Quilha Inferior Naval Chanfrada em Cinza-Metálico Escuro (Espessura 10m: Y = 384m a 394m)
  const lowerKeel1 = new THREE.Mesh(
    new THREE.BoxGeometry(deckW - 28, 6.0, deckD - 52),
    getLegoMaterial(0x1e293b, { metalness: 0.45, roughness: 0.22 })
  );
  lowerKeel1.position.set(hx, hy - 18.6, hz);
  const lowerKeel2 = new THREE.Mesh(
    new THREE.BoxGeometry(deckW - 46, 4.4, deckD - 84),
    getLegoMaterial(0x0f172a, { metalness: 0.5, roughness: 0.2 })
  );
  lowerKeel2.position.set(hx, hy - 23.8, hz);
  carrierGroup.add(lowerKeel1, lowerKeel2);

  // Reator Repulsor Central Brilhante sob a Quilha + Costelas Industriais e Luzes de Navegação
  const bellyGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const navRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const navGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const ribMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.5 });

  const bellyCore = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1.2, 24), bellyGlowMat);
  bellyCore.position.set(hx, hy - 25.8, hz);
  carrierGroup.add(bellyCore);

  for (let rz = -96; rz <= 96; rz += 32) {
    const ribL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 11.5, 4.0), ribMat);
    ribL.position.set(hx - (deckW * 0.5 - 5), hy - 9.6, hz + rz);
    const ribR = new THREE.Mesh(new THREE.BoxGeometry(2.5, 11.5, 4.0), ribMat);
    ribR.position.set(hx + (deckW * 0.5 - 5), hy - 9.6, hz + rz);
    const lightL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 3.0), navRedMat);
    lightL.position.set(hx - deckW * 0.5 - 0.4, hy - 2.0, hz + rz);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 3.0), navGreenMat);
    lightR.position.set(hx + deckW * 0.5 + 0.4, hy - 2.0, hz + rz);
    carrierGroup.add(ribL, ribR, lightL, lightR);
  }

  // Colisor 3D do Casco Completo (suporta pouso firme em Y = 410.4m e bloqueia os 26m de casco até Y = 384m!)
  world.addCollider(hx, hz, deckW, deckD, hy + 0.4, hy - hullThickness);

  // 2. CONVÉS DE VOO DUPLO (Pista Principal + Faixas + Números de Cabeceira 09 / 27 + Heliponto H)
  const asphaltDeckMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72 });
  const mainRunway = new THREE.Mesh(new THREE.BoxGeometry(34, 0.25, deckD - 18), asphaltDeckMat);
  mainRunway.position.set(hx - 14, hy + 0.35, hz);
  carrierGroup.add(mainRunway);

  const yellowStripMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const whiteStripMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

  for (const edgeX of [hx - 30, hx + 2]) {
    const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(1.2, deckD - 24), yellowStripMat);
    edgeLine.rotation.x = -Math.PI / 2;
    edgeLine.position.set(edgeX, hy + 0.5, hz);
    carrierGroup.add(edgeLine);
  }
  for (let dz = -100; dz <= 100; dz += 20) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 10), whiteStripMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(hx - 14, hy + 0.5, hz + dz);
    carrierGroup.add(dash);
  }

  // Números de Cabeceira da Pista ("09" e "27") em CanvasTexture
  for (const [numTxt, nz] of [['09', hz - 108], ['27', hz + 108]]) {
    const numCanvas = document.createElement('canvas');
    numCanvas.width = 128;
    numCanvas.height = 128;
    const nctx = numCanvas.getContext('2d');
    nctx.fillStyle = '#0f172a';
    nctx.fillRect(0, 0, 128, 128);
    nctx.fillStyle = '#facc15';
    nctx.font = '900 72px "JetBrains Mono", monospace';
    nctx.textAlign = 'center';
    nctx.fillText(numTxt, 64, 88);
    const numTex = new THREE.CanvasTexture(numCanvas);
    const numPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({ map: numTex })
    );
    numPlate.rotation.x = -Math.PI / 2;
    numPlate.position.set(hx - 14, hy + 0.52, nz);
    carrierGroup.add(numPlate);
  }

  // Heliponto Tático (H) na Popa do Convés
  const hRing = new THREE.Mesh(
    new THREE.RingGeometry(8.0, 9.6, 32),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
  );
  hRing.rotation.x = -Math.PI / 2;
  hRing.position.set(hx + 22, hy + 0.52, hz + 82);
  carrierGroup.add(hRing);

  // 3. TORRE DE CONTROLE (ILHA DE COMANDO) ALTA NA LATERAL DIREITA COM VIDRO AZUL INCLINADO & RADAR GIRATÓRIO
  const tx = hx + 36;
  const tz = hz - 18;
  const towerBase = createLegoBrick(18, 22, 54, LEGO_COLORS.charcoal, { studStep: 2.2 });
  towerBase.position.set(tx, hy + 11.4, tz);
  const towerUpper = createLegoBrick(14, 12, 36, LEGO_COLORS.darkGrey, { studStep: 2.0 });
  towerUpper.position.set(tx, hy + 28.4, tz);
  carrierGroup.add(towerBase, towerUpper);
  world.addCollider(tx, tz, 18, 54, hy + 34.5, hy);

  const bridgeGlassMat = getLegoMaterial(0x38bdf8, {
    roughness: 0.08,
    metalness: 0.2,
    transparent: true,
    opacity: 0.82
  });
  const angledGlass = new THREE.Mesh(new THREE.BoxGeometry(3.2, 5.5, 32), bridgeGlassMat);
  angledGlass.position.set(tx - 6.8, hy + 29.0, tz);
  angledGlass.rotation.z = 0.22;
  carrierGroup.add(angledGlass);

  const carrierRadar = new THREE.Group();
  carrierRadar.position.set(tx, hy + 37.0, tz - 6);
  const radarDish = createLegoBrick(13, 3.4, 2.2, LEGO_COLORS.yellow);
  carrierRadar.add(radarDish);
  carrierGroup.add(carrierRadar);
  world.rotatingElements.push({ mesh: carrierRadar, axis: 'y', speed: 2.4 });

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.6, 18, 8),
    getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.6 })
  );
  mast.position.set(tx, hy + 43.0, tz + 10);
  carrierGroup.add(mast);

  // 4. Os 3 Caças Militares e 1 Helicóptero de Ataque no Convés agora são aeronaves pilotáveis reais (em NavalAndAirFleetBuilder.js)!

  for (const [cx, cz, cColor] of [
    [hx + 16, hz - 48, LEGO_COLORS.gold],
    [hx + 18.5, hz - 48, LEGO_COLORS.green],
    [hx + 16, hz + 56, LEGO_COLORS.orange]
  ]) {
    const mCrate = createLegoBrick(1.8, 1.6, 1.8, cColor, { studStep: 0.6 });
    mCrate.position.set(cx, hy + 1.2, cz);
    world.scene.add(mCrate);
    const mCol = world.addCollider(cx, cz, 1.8, 1.8, hy + 2.0, hy);
    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: mCrate,
        type: 'crate',
        hp: 20,
        radius: 1.4,
        height: 1.6,
        colliders: [mCol],
        debrisColors: [cColor, LEGO_COLORS.darkGrey, LEGO_COLORS.yellow],
        studDrops: { silver: 4, gold: 5, blue: 2, purple: 1 },
        groundY: hy + 0.4
      });
    }
  }

  // 5. QUATRO TURBINAS ROTORAS GIGANTES NAS PONTAS LATERAIS
  const turbineOffsets = [
    [-68, -86],
    [68, -86],
    [-68, 86],
    [68, 86]
  ];
  const rimMat = getLegoMaterial(LEGO_COLORS.charcoal, { metalness: 0.4, roughness: 0.25 });
  const armorMat = getLegoMaterial(LEGO_COLORS.darkGrey, { metalness: 0.35 });

  for (const [txOff, tzOff] of turbineOffsets) {
    const turbGroup = new THREE.Group();
    turbGroup.position.set(hx + txOff, hy - 5.5, hz + tzOff);

    const strut = new THREE.Mesh(new THREE.BoxGeometry(24, 9.5, 16), armorMat);
    strut.position.set(txOff > 0 ? -14 : 14, -1.0, 0);
    turbGroup.add(strut);

    const outerShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 20, 12.0, 28, 1, true),
      rimMat
    );
    const topArmorRing = new THREE.Mesh(new THREE.RingGeometry(16.5, 21.0, 28), armorMat);
    topArmorRing.rotation.x = -Math.PI / 2;
    topArmorRing.position.y = 6.0;

    const coreGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(16.8, 16.8, 2.2, 28),
      bellyGlowMat
    );
    coreGlow.position.y = -1.5;

    const rotorGroup = new THREE.Group();
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(34, 0.9, 3.6), rimMat);
      blade.rotation.y = (b * Math.PI) / 3;
      rotorGroup.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 3.2, 16), armorMat);
    rotorGroup.add(hub);
    rotorGroup.position.y = 2.2;

    turbGroup.add(outerShroud, topArmorRing, coreGlow, rotorGroup);
    carrierGroup.add(turbGroup);

    world.rotatingElements.push({ mesh: rotorGroup, axis: 'y', speed: 7.5 });
    world.addCollider(hx + txOff, hz + tzOff, 36, 36, hy + 0.4, hy - 12.0);
  }
}

export function buildLegoClouds(world) {
  const cloudCoords = [
    // Camada alta ao redor do Aeroporta-Aviões (Y = 380 a 445)
    [-145, 398, -110], [150, 418, -95], [-130, 428, 35], [160, 392, 40],
    [0, 442, -230], [-210, 385, -210], [220, 405, -180],
    // Camada média sobre a metrópole (Y = 260 a 320)
    [-550, 275, -480], [480, 290, -560], [-320, 285, 480],
    [620, 270, 340], [-920, 265, 160], [1040, 280, 620]
  ];

  cloudCoords.forEach(([cx, cy, cz]) => {
    const cloud = new THREE.Group();
    const b1 = createLegoBrick(34, 6.0, 20, LEGO_COLORS.white, { studStep: 3.5, castShadow: false });
    const b2 = createLegoBrick(22, 5.2, 14, LEGO_COLORS.white, { studStep: 3.5, castShadow: false });
    const b3 = createLegoBrick(16, 4.2, 12, LEGO_COLORS.white, { studStep: 3.5, castShadow: false });
    b2.position.set(7.5, 4.2, 2.0);
    b3.position.set(-8.0, 3.0, -2.5);
    cloud.add(b1, b2, b3);
    cloud.position.set(cx, cy, cz);
    world.scene.add(cloud);
    world.clouds.push(cloud);
  });
}

