import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick,
  applyAnimatedLegoWaterShader
} from '../../../materials/LegoMaterials.js';
import { addClassicalIronLamp } from './CentralParkGatesAndPlaza.js';

/**
 * 6 CARRINHOS DE CACHORRO-QUENTE / SORVETE COM GUARDA-SOL COLORIDO (QUEBRÁVEIS!)
 */
export function buildBreakableParkFoodCarts(world, groundY) {
  const cartSpecs = [
    { x: -24, z: 236, color: LEGO_COLORS.red, umbrella: LEGO_COLORS.yellow },
    { x: 24, z: 236, color: 0xec4899, umbrella: 0x38bdf8 },
    { x: -24, z: 300, color: 0xf97316, umbrella: LEGO_COLORS.red },
    { x: 24, z: 300, color: 0x38bdf8, umbrella: 0xec4899 },
    { x: -195, z: 256, color: LEGO_COLORS.yellow, umbrella: LEGO_COLORS.red },
    { x: 52, z: 256, color: 0x22c55e, umbrella: LEGO_COLORS.yellow }
  ];
  for (const cfg of cartSpecs) {
    spawnBreakableFoodCart(world, cfg.x, groundY, cfg.z, cfg.color, cfg.umbrella);
  }
}

function spawnBreakableFoodCart(world, x, yBase, z, bodyColor, umbrellaColor) {
  const cartGroup = new THREE.Group();
  cartGroup.position.set(x, yBase, z);

  const body = createLegoBrick(2.6, 1.25, 1.6, bodyColor, { studStep: 0.55 });
  body.position.y = 0.85;
  const counterTop = createLegoBrick(2.8, 0.22, 1.8, LEGO_COLORS.white, { studStep: 0.5 });
  counterTop.position.y = 1.58;

  const wheelMat = getLegoMaterial(LEGO_COLORS.black);
  for (const wx of [-0.9, 0.9]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.85, 14), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.42, 0);
    cartGroup.add(wheel);
  }

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 2.4, 8),
    getLegoMaterial(LEGO_COLORS.silver)
  );
  pole.position.y = 2.7;
  const umbrella = createLegoBrick(3.6, 0.42, 3.6, umbrellaColor, { studStep: 0.7 });
  umbrella.position.y = 3.85;
  const umbrellaTop = createLegoBrick(1.8, 0.35, 1.8, LEGO_COLORS.white);
  umbrellaTop.position.y = 4.22;

  cartGroup.add(body, counterTop, pole, umbrella, umbrellaTop);
  world.scene.add(cartGroup);

  const col = world.addCollider(x, z, 2.8, 1.9, yBase + 4.2, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh: cartGroup,
      type: 'newsstand',
      hp: 24,
      radius: 1.9,
      height: 4.0,
      colliders: [col],
      debrisColors: [bodyColor, umbrellaColor, LEGO_COLORS.white, LEGO_COLORS.yellow],
      studDrops: { silver: 5, gold: 5, blue: 1, purple: 0 },
      groundY: yBase
    });
  }
}

/**
 * 3. O GRANDE LAGO NAVEGÁVEL, PÍER DE BARQUINHOS/PEDALINHOS & PONTE ARQUEADA CLÁSSICA
 */
export function buildGrandLakeBoatsAndArchedBridge(world, batcher, px, pz, groundY) {
  const lakeX = 205;
  const lakeZ = pz;
  const lakeW = 270;
  const lakeD = 162;

  const deepBed = new THREE.Mesh(
    new THREE.BoxGeometry(lakeW + 2, 0.12, lakeD + 2),
    new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.3 })
  );
  deepBed.position.set(lakeX, groundY + 0.02, lakeZ);

  if (!world.waterShaderUniforms) {
    world.waterShaderUniforms = { uTime: { value: 0 } };
  }
  const lakeWaterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    roughness: 0.05,
    metalness: 0.08,
    clearcoat: 0.96,
    transparent: true,
    opacity: 0.86
  });
  applyAnimatedLegoWaterShader(lakeWaterMat, world.waterShaderUniforms, {
    waveAmp: 0.025,
    waveFreq: 0.22,
    fresnelBoost: 0.2,
    variant: 'lake'
  });
  const lakeSurface = new THREE.Mesh(
    new THREE.BoxGeometry(lakeW, 0.24, lakeD),
    lakeWaterMat
  );
  lakeSurface.position.set(lakeX, groundY + 0.12, lakeZ);
  lakeSurface.receiveShadow = true;
  world.scene.add(deepBed, lakeSurface);
  world.mapWater.push({ x: lakeX, z: lakeZ, w: lakeW, d: lakeD });

  const minLX = lakeX - lakeW * 0.5; // +70
  const maxLX = lakeX + lakeW * 0.5; // +340
  const minLZ = lakeZ - lakeD * 0.5; // 187
  const maxLZ = lakeZ + lakeD * 0.5; // 349

  let rockSeed = 1;
  for (let rx = minLX; rx <= maxLX; rx += 8.5) {
    if (Math.abs(rx - lakeX) < 12) continue;
    for (const rz of [minLZ, maxLZ]) {
      const rw = 6.5 + (rockSeed % 4) * 1.4;
      const rh = 0.75 + (rockSeed % 3) * 0.45;
      const rd = 4.2 + (rockSeed % 3) * 1.0;
      batcher.addBox(rockSeed % 2 === 0 ? 'stone_wall' : 'stone_dark', rw, rh, rd, rx, groundY + rh * 0.5, rz);
      rockSeed++;
    }
  }
  for (let rz = minLZ + 8; rz <= maxLZ - 8; rz += 8.5) {
    for (const rx of [minLX, maxLX]) {
      if (rx === minLX && Math.abs(rz - lakeZ) < 16) continue;
      const rw = 4.2 + (rockSeed % 3) * 1.0;
      const rh = 0.75 + (rockSeed % 3) * 0.45;
      const rd = 6.5 + (rockSeed % 4) * 1.4;
      batcher.addBox(rockSeed % 2 === 0 ? 'stone_dark' : 'stone_wall', rw, rh, rd, rx, groundY + rh * 0.5, rz);
      rockSeed++;
    }
  }

  // Píer de Madeira na margem Oeste do Lago
  const pierX = minLX + 16;
  const pierW = 36;
  const pierD = 16;
  batcher.addBox('wood_brown', pierW, 0.45, pierD, pierX, groundY + 0.42, lakeZ);
  for (const pxPile of [pierX - 12, pierX, pierX + 14]) {
    for (const pzPile of [lakeZ - 6.5, lakeZ + 6.5]) {
      batcher.addBox('wood_light', 0.65, 1.3, 0.65, pxPile, groundY + 0.65, pzPile);
    }
  }
  world.addCollider(pierX, lakeZ, pierW, pierD, groundY + 0.65, groundY);

  // Os 8 Pedalinhos Cisne e Barcos do Lago agora são veículos interativos reais (em NavalAndAirFleetBuilder.js)!

  // PONTE ARQUEADA CLÁSSICA DE PEDRA E MADEIRA (X = 205)
  const bridgeX = lakeX;
  const bridgeW = 16.0;
  const rampSteps = [
    { zOffset: 76, d: 10, topY: groundY + 0.55, minY: groundY },
    { zOffset: 66, d: 10, topY: groundY + 1.10, minY: groundY },
    { zOffset: 56, d: 10, topY: groundY + 1.65, minY: groundY },
    { zOffset: 46, d: 10, topY: groundY + 2.20, minY: groundY },
    { zOffset: 36, d: 10, topY: groundY + 2.80, minY: groundY + 1.4 },
    { zOffset: 26, d: 10, topY: groundY + 3.45, minY: groundY + 2.2 }
  ];

  for (const side of [-1, 1]) {
    for (const st of rampSteps) {
      const sz = lakeZ + side * st.zOffset;
      const slabH = st.topY - st.minY;
      batcher.addBox('stone_wall', bridgeW, slabH, st.d + 0.4, bridgeX, st.minY + slabH * 0.5, sz);
      batcher.addBox('wood_brown', bridgeW - 2.4, 0.22, st.d + 0.2, bridgeX, st.topY + 0.08, sz);
      batcher.addBox('stone_dark', 0.9, 1.15, st.d + 0.4, bridgeX - bridgeW * 0.5 + 0.45, st.topY + 0.55, sz);
      batcher.addBox('stone_dark', 0.9, 1.15, st.d + 0.4, bridgeX + bridgeW * 0.5 - 0.45, st.topY + 0.55, sz);
      batcher.addBox('wood_light', 1.1, 0.25, st.d + 0.4, bridgeX - bridgeW * 0.5 + 0.45, st.topY + 1.2, sz);
      batcher.addBox('wood_light', 1.1, 0.25, st.d + 0.4, bridgeX + bridgeW * 0.5 - 0.45, st.topY + 1.2, sz);

      world.addCollider(bridgeX, sz, bridgeW, st.d, st.topY + 0.15, st.minY);
    }

    const pierZ = lakeZ + side * 21.0;
    batcher.addBox('stone_dark', bridgeW + 1.6, 4.2, 3.6, bridgeX, groundY + 2.1, pierZ);
    world.addCollider(bridgeX, pierZ, bridgeW + 1.2, 3.4, groundY + 4.2, groundY);
  }

  const archSpanD = 42.0;
  const archMinY = groundY + 3.25;
  const archTopY = groundY + 4.0;
  batcher.addBox('stone_wall', bridgeW, 0.75, archSpanD, bridgeX, archMinY + 0.38, lakeZ);
  batcher.addBox('wood_brown', bridgeW - 2.4, 0.24, archSpanD, bridgeX, archTopY + 0.1, lakeZ);
  for (const sideX of [-1, 1]) {
    const railX = bridgeX + sideX * (bridgeW * 0.5 - 0.45);
    batcher.addBox('stone_dark', 0.9, 1.2, archSpanD, railX, archTopY + 0.6, lakeZ);
    batcher.addBox('wood_light', 1.15, 0.28, archSpanD, railX, archTopY + 1.28, lakeZ);
    addClassicalIronLamp(batcher, railX, archTopY + 1.35, lakeZ - 12);
    addClassicalIronLamp(batcher, railX, archTopY + 1.35, lakeZ + 12);
  }
  world.addCollider(bridgeX, lakeZ, bridgeW, archSpanD, archTopY + 0.18, archMinY);
}

export function addLakePedalBoatOrRowboat(batcher, x, yWater, z, colorKey, isSwan) {
  batcher.addBox('water_foam', 3.4, 0.08, 5.4, x, yWater - 0.04, z);
  batcher.addBox(colorKey, 2.8, 0.55, 4.6, x, yWater + 0.25, z);
  batcher.addBox('white_marble', 2.2, 0.42, 2.6, x, yWater + 0.62, z - 0.3);

  if (isSwan) {
    batcher.addBox('white_marble', 0.65, 2.1, 0.65, x, yWater + 1.5, z + 1.5);
    batcher.addBox('white_marble', 0.85, 0.75, 1.1, x, yWater + 2.45, z + 1.8);
    batcher.addBox('autumn_orange', 0.55, 0.35, 0.75, x, yWater + 2.38, z + 2.45);
    batcher.addBox('white_marble', 0.35, 1.1, 2.8, x - 1.35, yWater + 0.95, z - 0.2);
    batcher.addBox('white_marble', 0.35, 1.1, 2.8, x + 1.35, yWater + 0.95, z - 0.2);
  } else {
    batcher.addBox('wood_brown', 2.6, 0.22, 0.55, x, yWater + 0.65, z - 0.6);
    batcher.addBox('wood_brown', 2.6, 0.22, 0.55, x, yWater + 0.65, z + 0.8);
    batcher.addBox('wood_light', 4.6, 0.14, 0.22, x, yWater + 0.68, z);
  }
}

/**
 * 4. SELVA / FLORESTA URBANA DENSA COM MAIS DE 550 ÁRVORES GIGANTES (18m A 38m DE ALTURA!),
 *    GALHOS ABERTOS, CIPÓS PENDURADOS, SALGUEIROS-CHORÕES, SAMAMBAIAS, ROCHAS MUSGOSAS E FLORES!
 */
export function buildDenseJungleForestVegetation(world, batcher, px, pz, pw, pd, groundY) {
  const halfW = pw * 0.5 - 8; // 482
  const halfD = pd * 0.5 - 7; // 109

  // Função precisa que mantém as Alamedas, Trilhas, Praça Central, Coretos e Lago desimpedidos no chão,
  // permitindo que as árvores fiquem coladas nas bordas das trilhas e fechem as copas por cima!
  const isClearForTreeTrunk = (x, z) => {
    // Alamedas Horizontais (Z = 268 Central, Z = 178 Norte, Z = 358 Sul)
    if (Math.abs(z - pz) < 9.2) return false;
    if (Math.abs(z - 178) < 6.2) return false;
    if (Math.abs(z - 358) < 6.2) return false;
    // Trilhas Horizontais dos Coretos na Mata Oeste (Z = 212 e Z = 324, X < -35)
    if (x < -35 && (Math.abs(z - 212) < 5.5 || Math.abs(z - 324) < 5.5)) return false;

    // 8 Caminhos Transversais Norte-Sul
    for (const txPath of [-435, -355, -275, -195, -105, 0, 205, 395, 450]) {
      const clearW = txPath === 0 ? 11.0 : txPath === 205 ? 10.5 : 5.8;
      if (Math.abs(x - txPath) < clearW) return false;
    }

    // Praça Circular Central da Fonte (Raio 39.5m)
    if (Math.hypot(x - px, z - pz) < 39.5) return false;

    // Grande Lago Leste (X = 68..342, Z = 185..351)
    if (x > 68 && x < 342 && z > 185 && z < 351) return false;

    // Os 3 Coretos/Gazebos
    if (Math.hypot(x + 355, z - 212) < 12.5) return false;
    if (Math.hypot(x + 355, z - 324) < 12.5) return false;
    if (Math.hypot(x + 135, z - 212) < 12.5) return false;

    // Viaduto Panorâmico Norte-Sul (X = +252) & Mirante Circular / Rampas da Colina Oeste (-215, 296)
    if (Math.abs(x - 252) < 14.5) return false;
    if (Math.hypot(x + 215, z - 296) < 19.5) return false;
    if (Math.hypot(x + 408, z - 268) < 12.0) return false;
    if (x >= -205 && x <= -120 && Math.abs(z - 296) < 7.5) return false;
    if (z >= 238 && z <= 284 && Math.abs(x + 215) < 7.5) return false;

    return true;
  };

  // Gerador pseudo-aleatório determinístico para distribuir a selva de forma 100% orgânica e variada
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const autumnKeys = ['autumn_orange', 'autumn_yellow', 'autumn_red', 'flower_pink'];
  const flowerKeys = ['flower_pink', 'flower_yellow', 'flower_red', 'flower_purple', 'flower_cyan'];
  const canopyGreenKeys = ['oak_dark', 'oak_mid', 'jungle_lush', 'willow_lime'];

  // ============================================================================
  // 4A. MALHA DENSA E ORGÂNICA DE ÁRVORES GIGANTES (PASSO DE 14m X 13m COM JITTER FORTE!)
  //     Cria mais de 550 árvores de 18m a 38m de altura que cobrem o Parque como uma Selva!
  // ============================================================================
  for (let gx = -halfW; gx <= halfW; gx += 14.5) {
    for (let gz = pz - halfD; gz <= pz + halfD; gz += 13.5) {
      const tx = gx + (rand() - 0.5) * 11.5;
      const tz = gz + (rand() - 0.5) * 10.5;

      if (!isClearForTreeTrunk(tx, tz)) continue;

      const treeY = Math.max(groundY, world.getTerrainHeightAt ? world.getTerrainHeightAt(tx, tz) : groundY);

      // Escala vertical alta (1.35x a 2.65x -> árvores de 18m até 38m de altura!)
      const hScale = 1.35 + rand() * 1.3;
      const wScale = 1.25 + rand() * 0.95;
      const rType = rand();

      if (rType < 0.42) {
        // 1. CARVALHO / SEQUOIA GIGANTE DE SELVA (Copa colossal com galhos abertos e cipós pendurados!)
        const leafKey = canopyGreenKeys[Math.floor(rand() * canopyGreenKeys.length)];
        const leafKey2 = canopyGreenKeys[Math.floor(rand() * canopyGreenKeys.length)];
        addColossalJungleCanopyTree(batcher, tx, treeY, tz, wScale, hScale, leafKey, leafKey2, rand() < 0.65);
      } else if (rType < 0.72) {
        // 2. ÁRVORE GIGANTE DE OUTONO / IPÊ (Laranja, Amarela, Vermelha ou Rosa-Ipê!)
        const autKey = autumnKeys[Math.floor(rand() * autumnKeys.length)];
        addGiantAutumnTree(batcher, tx, treeY, tz, wScale, hScale, autKey);
      } else {
        // 3. PINHEIRO / ARAUCÁRIA GIGANTE DE FLORESTA (20m a 36m de altura!)
        addGiantConiferPineTree(batcher, tx, treeY, tz, wScale, hScale);
      }
      batcher.treeCount++;

      // Sub-bosque denso ao redor de cada árvore: Samambaias Gigantes, Arbustos Floridos e Rochas Musgosas!
      const underCount = 1 + Math.floor(rand() * 2);
      for (let u = 0; u < underCount; u++) {
        const ux = tx + (rand() - 0.5) * 8.5;
        const uz = tz + (rand() - 0.5) * 8.5;
        if (!isClearForTreeTrunk(ux, uz)) continue;
        const underY = Math.max(groundY, world.getTerrainHeightAt ? world.getTerrainHeightAt(ux, uz) : groundY);
        const flKey = flowerKeys[Math.floor(rand() * flowerKeys.length)];
        addJungleUndergrowthCluster(batcher, ux, underY, uz, 0.9 + rand() * 0.9, flKey, u % 2 === 0);
        batcher.undergrowthCount++;
      }
    }
  }

  // ============================================================================
  // 4B. SALGUEIROS-CHORÕES GIGANTES (WEEPING WILLOWS) CONTORNANDO O GRANDE LAGO E A PRAÇA!
  // ============================================================================
  // Ao redor da margem do Grande Lago (X = 68..342, Z = 185..351)
  for (let wx = 78; wx <= 332; wx += 24) {
    if (Math.abs(wx - 205) < 16 || Math.abs(wx - 252) < 16) continue;
    addGiantWeepingWillow(batcher, wx + (rand() - 0.5) * 5, groundY, 184, 1.35 + rand() * 0.45);
    addGiantWeepingWillow(batcher, wx + (rand() - 0.5) * 5, groundY, 352, 1.35 + rand() * 0.45);
    batcher.treeCount += 2;
  }
  for (let wz = 200; wz <= 336; wz += 24) {
    if (Math.abs(wz - pz) < 18) continue;
    addGiantWeepingWillow(batcher, 66, groundY, wz + (rand() - 0.5) * 5, 1.4 + rand() * 0.4);
    addGiantWeepingWillow(batcher, 344, groundY, wz + (rand() - 0.5) * 5, 1.4 + rand() * 0.4);
    batcher.treeCount += 2;
  }

  // Anel Monumental de Árvores Gigantes de Outono e Carvalhos cercando a Praça Circular Central!
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    const ax = px + Math.cos(ang) * 43.0;
    const az = pz + Math.sin(ang) * 43.0;
    if (!isClearForTreeTrunk(ax, az)) continue;
    if (a % 2 === 0) {
      addGiantAutumnTree(batcher, ax, groundY, az, 1.45, 1.75, autumnKeys[a % autumnKeys.length]);
    } else {
      addColossalJungleCanopyTree(batcher, ax, groundY, az, 1.5, 1.85, 'oak_dark', 'jungle_lush', true);
    }
    batcher.treeCount++;
  }

  // 32 Canteiros de Flores Silvestres e Arbustos ao longo das Alamedas e Entradas!
  const flowerBedCoords = [
    [-420, 257], [-420, 279], [-315, 257], [-315, 279],
    [-235, 257], [-235, 279], [-150, 257], [-150, 279],
    [-70, 257], [-70, 279], [365, 257], [365, 279],
    [425, 257], [425, 279], [-14, 168], [14, 168],
    [-14, 202], [14, 202], [-14, 334], [14, 334],
    [-14, 368], [14, 368], [130, 170], [280, 170],
    [130, 366], [280, 366]
  ];
  flowerBedCoords.forEach(([fx, fz], fIdx) => {
    const flKey1 = flowerKeys[fIdx % flowerKeys.length];
    const flKey2 = flowerKeys[(fIdx + 2) % flowerKeys.length];
    batcher.addBox('stone_wall', 6.4, 0.42, 3.2, fx, groundY + 0.21, fz);
    batcher.addBox('bush_green', 5.8, 0.55, 2.6, fx, groundY + 0.35, fz);
    for (let bxFl = -2.2; bxFl <= 2.2; bxFl += 1.1) {
      batcher.addBox(bxFl < 0 ? flKey1 : flKey2, 0.78, 0.5, 0.78, fx + bxFl, groundY + 0.75, fz - 0.5);
      batcher.addBox(bxFl < 0 ? flKey2 : flKey1, 0.78, 0.5, 0.78, fx + bxFl, groundY + 0.75, fz + 0.5);
    }
  });
}

/**
 * 1. CARVALHO / SEQUOIA ANCIÃ GIGANTE DE SELVA (18m a 38m de altura!)
 */
function addColossalJungleCanopyTree(batcher, x, yBase, z, ws, hs, leafKey1, leafKey2, hasVines) {
  const trunkH = 9.5 * hs;
  const trunkW = 1.65 * ws;

  // Raízes largas expostas na base + Tronco Principal Colossal
  batcher.addBox('wood_brown', trunkW * 1.9, 1.3 * hs, trunkW * 0.85, x, yBase + 0.65 * hs, z);
  batcher.addBox('wood_brown', trunkW * 0.85, 1.3 * hs, trunkW * 1.9, x, yBase + 0.65 * hs, z);
  batcher.addBox('wood_brown', trunkW, trunkH, trunkW, x, yBase + trunkH * 0.5, z);

  // Galhos Grossos Laterais sustentando a Copa Gigante
  const branchY = yBase + trunkH * 0.78;
  batcher.addBox('wood_light', 6.8 * ws, 0.9 * hs, 0.95 * ws, x, branchY, z);
  batcher.addBox('wood_light', 0.95 * ws, 0.9 * hs, 6.8 * ws, x, branchY + 0.8 * hs, z);

  // 5 Blocos Frondosos Gigantes formando um Dossel de Selva (12m a 22m de largura de copa!)
  const cBaseY = yBase + trunkH * 0.82;
  batcher.addBox(leafKey1, 10.5 * ws, 3.8 * hs, 10.5 * ws, x, cBaseY + 1.6 * hs, z);
  batcher.addBox(leafKey2, 8.6 * ws, 3.4 * hs, 8.2 * ws, x - 2.6 * ws, cBaseY + 3.4 * hs, z + 1.8 * ws);
  batcher.addBox(leafKey2, 8.2 * ws, 3.4 * hs, 8.6 * ws, x + 2.5 * ws, cBaseY + 3.8 * hs, z - 1.8 * ws);
  batcher.addBox(leafKey1, 7.6 * ws, 3.2 * hs, 7.6 * ws, x, cBaseY + 5.8 * hs, z);
  batcher.addBox(leafKey2, 4.8 * ws, 2.4 * hs, 4.8 * ws, x, cBaseY + 8.0 * hs, z);

  // Cipós Verdes de Selva (Vines) pendurados das bordas da copa!
  if (hasVines) {
    const vineLen = 4.2 * hs;
    const vineY = cBaseY - vineLen * 0.35;
    for (const [vx, vz] of [[-4.4 * ws, -3.2 * ws], [4.4 * ws, 3.2 * ws], [-3.2 * ws, 4.4 * ws], [3.2 * ws, -4.4 * ws]]) {
      batcher.addBox('willow_lime', 0.38, vineLen, 0.38, x + vx, vineY, z + vz);
    }
  }
}

/**
 * 2. ÁRVORE GIGANTE DE OUTONO / IPÊ FLORIDO (18m a 32m de altura!)
 */
function addGiantAutumnTree(batcher, x, yBase, z, ws, hs, autumnKey) {
  const trunkH = 8.8 * hs;
  const trunkW = 1.35 * ws;

  batcher.addBox('wood_brown', trunkW * 1.6, 1.1 * hs, trunkW * 1.6, x, yBase + 0.55 * hs, z);
  batcher.addBox('wood_brown', trunkW, trunkH, trunkW, x, yBase + trunkH * 0.5, z);
  batcher.addBox('wood_light', 5.4 * ws, 0.75 * hs, 0.8 * ws, x, yBase + trunkH * 0.75, z);

  const cY = yBase + trunkH * 0.8;
  batcher.addBox(autumnKey, 9.2 * ws, 3.5 * hs, 9.2 * ws, x, cY + 1.5 * hs, z);
  batcher.addBox(autumnKey, 7.4 * ws, 3.2 * hs, 7.4 * ws, x + 1.8 * ws, cY + 3.6 * hs, z - 1.4 * ws);
  batcher.addBox(autumnKey, 7.0 * ws, 3.0 * hs, 7.0 * ws, x - 1.6 * ws, cY + 4.2 * hs, z + 1.5 * ws);
  batcher.addBox(autumnKey, 4.8 * ws, 2.5 * hs, 4.8 * ws, x, cY + 6.4 * hs, z);
}

/**
 * 3. PINHEIRO / SEQUOIA CONÍFERA GIGANTE (20m a 36m de altura!)
 */
function addGiantConiferPineTree(batcher, x, yBase, z, ws, hs) {
  const trunkH = 7.5 * hs;
  batcher.addBox('wood_brown', 1.4 * ws, trunkH, 1.4 * ws, x, yBase + trunkH * 0.5, z);

  const bY = yBase + 4.2 * hs;
  batcher.addBox('pine_green', 8.8 * ws, 3.2 * hs, 8.8 * ws, x, bY, z);
  batcher.addBox('pine_green', 7.2 * ws, 3.2 * hs, 7.2 * ws, x, bY + 2.6 * hs, z);
  batcher.addBox('pine_green', 5.6 * ws, 3.2 * hs, 5.6 * ws, x, bY + 5.2 * hs, z);
  batcher.addBox('pine_green', 4.0 * ws, 3.0 * hs, 4.0 * ws, x, bY + 7.6 * hs, z);
  batcher.addBox('pine_green', 2.2 * ws, 2.8 * hs, 2.2 * ws, x, bY + 9.9 * hs, z);
}

/**
 * 4. SALGUEIRO-CHORÃO GIGANTE (WEEPING WILLOW) COM CORTINAS DE FOLHAGEM CAINDO ATÉ O CHÃO!
 */
function addGiantWeepingWillow(batcher, x, yBase, z, s) {
  const trunkH = 9.2 * s;
  batcher.addBox('wood_brown', 1.8 * s, trunkH, 1.8 * s, x, yBase + trunkH * 0.5, z);
  batcher.addBox('willow_lime', 11.0 * s, 3.2 * s, 11.0 * s, x, yBase + trunkH + 0.8 * s, z);
  batcher.addBox('jungle_lush', 8.2 * s, 2.6 * s, 8.2 * s, x, yBase + trunkH + 3.0 * s, z);

  // 8 Cortinas Longas de Folhagem de Salgueiro pendendo até quase tocar a grama/água!
  const curtainH = 7.2 * s;
  for (let c = 0; c < 8; c++) {
    const ang = (c / 8) * Math.PI * 2;
    const cx = x + Math.cos(ang) * 4.8 * s;
    const cz = z + Math.sin(ang) * 4.8 * s;
    batcher.addBox('willow_lime', 0.95 * s, curtainH, 0.95 * s, cx, yBase + trunkH - curtainH * 0.42, cz);
  }
}

/**
 * 5. SUB-BOSQUE DE SELVA: SAMAMBAIAS GIGANTES, ARBUSTOS ALTOS, ROCHAS MUSGOSAS E TRONCOS CAÍDOS!
 */
function addJungleUndergrowthCluster(batcher, x, yBase, z, s, flowerKey, withBoulderOrLog) {
  // Moita alta de folhagem de selva + samambaia aberta
  batcher.addBox('bush_green', 3.4 * s, 1.6 * s, 3.4 * s, x, yBase + 0.8 * s, z);
  batcher.addBox('jungle_lush', 2.4 * s, 2.2 * s, 2.4 * s, x, yBase + 1.4 * s, z);
  batcher.addBox('willow_lime', 4.6 * s, 0.45 * s, 1.1 * s, x, yBase + 1.1 * s, z);
  batcher.addBox('willow_lime', 1.1 * s, 0.45 * s, 4.6 * s, x, yBase + 1.1 * s, z);

  // Flores silvestres no topo do arbusto
  batcher.addBox(flowerKey, 0.75 * s, 0.55 * s, 0.75 * s, x - 0.8 * s, yBase + 1.85 * s, z + 0.6 * s);
  batcher.addBox(flowerKey, 0.75 * s, 0.55 * s, 0.75 * s, x + 0.8 * s, yBase + 1.85 * s, z - 0.6 * s);
  batcher.addBox(flowerKey, 0.85 * s, 0.6 * s, 0.85 * s, x, yBase + 2.55 * s, z);

  if (withBoulderOrLog) {
    // Rocha musgosa ou tronco caído na mata
    batcher.addBox('stone_dark', 2.4 * s, 1.2 * s, 1.9 * s, x + 1.8 * s, yBase + 0.6 * s, z);
    batcher.addBox('oak_mid', 1.8 * s, 0.35 * s, 1.4 * s, x + 1.8 * s, yBase + 1.25 * s, z);
  }
}
