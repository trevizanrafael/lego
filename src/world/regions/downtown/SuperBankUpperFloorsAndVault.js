import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial, createLegoBrick } from '../../../materials/LegoMaterials.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { BANK_SPEC, FLOOR_T, addBankPlant } from './SuperBankExteriorAndLobby.js';

function rampY(ramp, z) {
  const base = BANK_SPEC.floors[ramp.fromFloor];
  const t = THREE.MathUtils.clamp((z - ramp.zLow) / (ramp.zHigh - ramp.zLow), 0, 1);
  return base + t * BANK_SPEC.floorHeight;
}

/** Buracos nas lajes por onde as rampas chegam */
function holeForFloor(floorIdx) {
  // A laje do andar N tem buraco sobre a rampa que chega nela (fromFloor = N-1)
  return BANK_SPEC.ramps.find((r) => r.fromFloor === floorIdx - 1) || null;
}

function insideRect(x, z, r, pad = 0) {
  return x >= r.minX - pad && x <= r.maxX + pad && z >= Math.min(r.zLow, r.zHigh) - pad && z <= Math.max(r.zLow, r.zHigh) + pad;
}

// ============================================================================
// 2. LAJES DOS ANDARES, RAMPAS (com corrimão) E NÚCLEO DO ELEVADOR
// ============================================================================
export function buildFloorsRampsAndElevator(world, B) {
  const S = BANK_SPEC;
  const W = S.innerMaxX - S.innerMinX;
  const D = S.innerFrontZ - S.innerBackZ;
  const midZ = (S.innerFrontZ + S.innerBackZ) / 2;

  S.floors.forEach((fy, idx) => {
    const hole = holeForFloor(idx);
    // Pisos (piso andável)
    world.elevatedDecks.push({
      id: `bank_floor_${idx + 1}`,
      minX: S.innerMinX,
      maxX: S.innerMaxX,
      minZ: S.innerBackZ,
      maxZ: S.innerFrontZ,
      thresholdBelow: 2.4,
      getDeckY: (x, z) => (hole && insideRect(x, z, hole, -0.15) ? null : fy)
    });

    if (idx > 0) {
      // Laje visível (em pedaços em volta do buraco da rampa)
      const slabY = fy - FLOOR_T / 2;
      const floorKey = idx === 1 ? 'carpetBlue' : idx === 2 ? 'concrete' : 'graniteBlack';
      if (hole) {
        const hz0 = Math.min(hole.zLow, hole.zHigh);
        const hz1 = Math.max(hole.zLow, hole.zHigh);
        const westHole = hole.minX < 0;
        // Faixa larga ao lado do buraco
        const restX0 = westHole ? hole.maxX : S.innerMinX;
        const restX1 = westHole ? S.innerMaxX : hole.minX;
        B.box(floorKey, restX1 - restX0, FLOOR_T, D, (restX0 + restX1) / 2, slabY, midZ);
        // Frente e fundo do buraco
        B.box(floorKey, hole.maxX - hole.minX, FLOOR_T, S.innerFrontZ - hz1, (hole.minX + hole.maxX) / 2, slabY, (S.innerFrontZ + hz1) / 2);
        B.box(floorKey, hole.maxX - hole.minX, FLOOR_T, hz0 - S.innerBackZ, (hole.minX + hole.maxX) / 2, slabY, (hz0 + S.innerBackZ) / 2);
        // Corrimão em volta do buraco (menos na chegada da rampa)
        const railX = westHole ? hole.maxX : hole.minX;
        const arrivalZ = hole.zHigh;
        const otherZ = hole.zLow;
        B.box('chrome', 0.3, 1.1, hz1 - hz0, railX, fy + 0.55, (hz0 + hz1) / 2);
        B.box('gold', 0.4, 0.14, hz1 - hz0, railX, fy + 1.12, (hz0 + hz1) / 2);
        world.addCollider(railX, (hz0 + hz1) / 2, 0.5, hz1 - hz0, fy + 1.3, fy - 0.2);
        B.box('chrome', hole.maxX - hole.minX, 1.1, 0.3, (hole.minX + hole.maxX) / 2, fy + 0.55, otherZ);
        world.addCollider((hole.minX + hole.maxX) / 2, otherZ, hole.maxX - hole.minX, 0.5, fy + 1.3, fy - 0.2);
        void arrivalZ;
      } else {
        B.box(floorKey, W, FLOOR_T, D, 0, slabY, midZ);
      }
      // Forro com painéis de luz do andar de baixo
      for (let lx = -56; lx <= 56; lx += 16) {
        for (let lz = -150; lz >= -218; lz -= 17) {
          if (hole && insideRect(lx, lz, hole, 2)) continue;
          B.box('lightPanel', 5.5, 0.12, 2.4, lx, fy - FLOOR_T - 0.08, lz);
          // Dois lustres monumentais no teto do saguão térreo (1º andar)
          if (fy < 14 && lz === -167 && (lx === -40 || lx === 40)) {
            const ceilY = fy - FLOOR_T;
            B.cyl('gold', 0.22, 0.22, 0.65, lx, ceilY - 0.35, lz, 8);
            B.cyl('gold', 2.3, 2.3, 0.22, lx, ceilY - 0.72, lz, 16);
            B.cyl('crystalGlow', 1.85, 1.35, 0.5, lx, ceilY - 1.05, lz, 12);
            B.cyl('crystalGlow', 1.05, 0.45, 0.42, lx, ceilY - 1.48, lz, 10);
          }
        }
      }
    }
  });

  // Teto do 4º andar (laje da cobertura) + iluminação dourada na área do Cofre
  B.box('cream', W, 0.7, D, 0, S.roofY - 0.85, midZ);
  for (let lx = -56; lx <= 56; lx += 16) {
    for (let lz = -150; lz >= -218; lz -= 17) B.box('lightPanel', 5.5, 0.12, 2.4, lx, S.roofY - 1.26, lz);
  }
  B.box('gold', 10.6, 0.22, 1.8, 0, S.roofY - 1.18, -214);
  B.box('crystalGlow', 10.0, 0.16, 1.4, 0, S.roofY - 1.32, -214);

  // Rampas largas (andáveis e dirigíveis)
  for (const r of S.ramps) {
    const zl = r.zLow;
    const zh = r.zHigh;
    const len = Math.abs(zh - zl);
    const y0 = rampY(r, zl);
    const y1 = rampY(r, zh);
    const ang = Math.atan2(y1 - y0, len);
    const midRz = (zl + zh) / 2;
    const cx = (r.minX + r.maxX) / 2;
    const w = r.maxX - r.minX;
    const dir = zh < zl ? 1 : -1; // inclinação no eixo X local
    B.box('granite', w, 0.45, Math.hypot(len, y1 - y0), cx, (y0 + y1) / 2 - 0.25, midRz, 0, dir * ang);
    // Faixas amarelas de segurança na rampa
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.5) / 6;
      const z = zl + (zh - zl) * t;
      B.box('yellowLine', w - 1.2, 0.06, 0.5, cx, rampY(r, z) + 0.02, z);
    }
    world.elevatedDecks.push({
      id: `bank_ramp_${r.id}`,
      minX: r.minX,
      maxX: r.maxX,
      minZ: Math.min(zl, zh),
      maxZ: Math.max(zl, zh),
      thresholdBelow: 1.6,
      getDeckY: (x, z) => rampY(r, z)
    });
    // Parede de apoio + corrimão no lado de dentro (segmentos para colisão)
    const innerX = r.minX < 0 ? r.maxX + 0.25 : r.minX - 0.25;
    const segs = 10;
    for (let k = 0; k < segs; k++) {
      const za = zl + ((zh - zl) * k) / segs;
      const zb = zl + ((zh - zl) * (k + 1)) / segs;
      const ya = rampY(r, za);
      const yb = rampY(r, zb);
      const ymax = Math.max(ya, yb);
      const base = S.floors[r.fromFloor];
      const zc = (za + zb) / 2;
      const segLen = Math.abs(zb - za);
      B.box('marble', 0.5, ymax - base, segLen, innerX, base + (ymax - base) / 2, zc);
      B.box('chrome', 0.25, 1.0, segLen, innerX, ymax + 0.5, zc);
      world.addCollider(innerX, zc, 0.5, segLen, ymax + 1.1, base);
    }
    B.box('gold', 0.4, 0.14, len, innerX, (y0 + y1) / 2 + 1.05, midRz, 0, dir * ang);
  }

  // Núcleo do elevador (do térreo ao terraço) com portas em cada andar
  const E = S.elevator;
  const ex = (E.minX + E.maxX) / 2;
  const ez = (E.minZ + E.maxZ) / 2;
  B.box('graniteBlack', E.maxX - E.minX, S.roofY, E.maxZ - E.minZ, ex, S.roofY / 2, ez);
  world.addCollider(ex, ez, E.maxX - E.minX, E.maxZ - E.minZ, S.roofY, 0);
  for (const fy of S.floors) {
    B.box('chrome', 0.3, 5.0, 3.0, E.minX - 0.15, fy + 2.5, ez - 1.55);
    B.box('chrome', 0.3, 5.0, 3.0, E.minX - 0.15, fy + 2.5, ez + 1.55);
    B.box('gold', 0.4, 0.5, 6.8, E.minX - 0.2, fy + 5.3, ez);
    B.box('screen', 0.2, 0.6, 1.4, E.minX - 0.3, fy + 6.0, ez);
    B.box('gold', 0.25, 0.5, 0.35, E.minX - 0.25, fy + 1.5, ez + 3.6);
    // Marca amarela no chão ([E] chamar elevador)
    B.box('yellowLine', 3.2, 0.04, 4.0, E.callX, fy + 0.03, E.callZ);
  }
}

// ============================================================================
// 4. 2º ANDAR — CÂMBIO & ESCRITÓRIOS
// ============================================================================
export function buildOfficeFloor(world, B) {
  const S = BANK_SPEC;
  const fy = S.floors[1];
  // Fileiras de mesas com computadores (baixas: servem de cobertura)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const x = -40 + col * 16;
      const z = -154 - row * 13;
      B.box('white', 6.4, 0.25, 3.2, x, fy + 1.2, z);
      B.box('steel', 0.3, 1.2, 3.0, x - 3.0, fy + 0.6, z);
      B.box('steel', 0.3, 1.2, 3.0, x + 3.0, fy + 0.6, z);
      B.box('black', 1.6, 1.1, 0.2, x - 1.4, fy + 1.9, z - 0.9);
      B.box('screen', 1.4, 0.9, 0.05, x - 1.4, fy + 1.9, z - 0.78);
      B.box('black', 1.6, 1.1, 0.2, x + 1.4, fy + 1.9, z - 0.9);
      B.box('screen', 1.4, 0.9, 0.05, x + 1.4, fy + 1.9, z - 0.78);
      B.box('carpetBlue', 6.6, 1.6, 0.25, x, fy + 2.1, z - 1.7); // divisória
      B.box('black', 1.1, 0.9, 1.1, x - 1.4, fy + 0.45, z + 2.0); // cadeiras
      B.box('black', 1.1, 0.9, 1.1, x + 1.4, fy + 0.45, z + 2.0);
      world.addCollider(x, z, 6.4, 3.4, fy + 1.4, fy);
    }
  }
  // Sala de reunião de vidro (fundo)
  B.box('glass', 30, 6, 0.3, 0, fy + 3, -206);
  B.box('glass', 0.3, 6, 14, -15, fy + 3, -213);
  B.box('glass', 0.3, 6, 14, 15, fy + 3, -213);
  B.box('wood', 18, 0.4, 5, 0, fy + 1.4, -214);
  B.box('gold', 30.4, 0.3, 0.4, 0, fy + 6.1, -206);
  // Balcão de câmbio com painel de cotações
  B.box('wood', 30, 1.3, 2.4, 0, fy + 0.65, -144.5);
  world.addCollider(0, -144.5, 30, 2.4, fy + 1.4, fy);
  B.box('graniteBlack', 24, 3.2, 0.4, 0, fy + 6.5, -140.4);
  for (let i = 0; i < 6; i++) B.box(i % 2 ? 'screenGreen' : 'ledRed', 3.0, 0.5, 0.1, -9 + i * 3.6, fy + 6.5, -140.15);
  // Arquivos e plantas
  for (let i = 0; i < 6; i++) B.box('steel', 2.2, 3.2, 1.4, -30 + i * 2.4, fy + 1.6, -224.5);
  addBankPlant(B, 30, fy, -224);
  addBankPlant(B, 40, fy, -140.6);
  addBankPlant(B, -40, fy, -140.6);
  // Bebedouros
  for (const x of [-50, 50]) {
    B.box('white', 1.2, 2.6, 1.2, x, fy + 1.3, -224.5);
    B.cyl('glass', 0.5, 0.5, 1.4, x, fy + 3.2, -224.5, 12);
  }
}

// ============================================================================
// 5. 3º ANDAR — CENTRO DE SEGURANÇA
// ============================================================================
export function buildSecurityFloor(world, B) {
  const S = BANK_SPEC;
  const fy = S.floors[2];
  // Parede de monitores (fundo)
  B.box('graniteBlack', 70, 8, 1.0, 0, fy + 4.6, -224.8);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 10; c++) {
      B.box((r + c) % 3 === 0 ? 'screenGreen' : 'screen', 5.6, 2.0, 0.1, -31.5 + c * 7, fy + 2.4 + r * 2.4, -224.25);
    }
  }
  B.box('steel', 40, 1.2, 3, 0, fy + 0.6, -218);
  world.addCollider(0, -218, 40, 3, fy + 1.3, fy);
  // Racks de servidores com LEDs
  for (let i = 0; i < 6; i++) {
    for (const x of [-46, 46]) {
      const z = -160 - i * 9;
      B.box('black', 3.2, 6.5, 2.2, x, fy + 3.25, z);
      for (let k = 0; k < 5; k++) B.box(k % 2 ? 'screenGreen' : 'ledRed', 0.1, 0.2, 1.6, x + (x < 0 ? 1.62 : -1.62), fy + 1.2 + k * 1.1, z);
      world.addCollider(x, z, 3.2, 2.2, fy + 6.5, fy);
    }
  }
  // Barricadas de sacos de areia / caixotes blindados (cobertura)
  for (const [x, z] of [[-24, -160], [24, -160], [-12, -185], [12, -185], [-30, -200], [30, -200]]) {
    B.box('concrete', 8, 2.0, 1.8, x, fy + 1.0, z);
    B.box('yellowLine', 8.2, 0.25, 1.9, x, fy + 2.05, z);
    world.addCollider(x, z, 8, 1.8, fy + 2.1, fy);
  }
  // Detectores de metal (pórticos)
  for (const x of [-10, 0, 10]) {
    B.box('steel', 0.5, 4.2, 1.0, x - 1.6, fy + 2.1, -146);
    B.box('steel', 0.5, 4.2, 1.0, x + 1.6, fy + 2.1, -146);
    B.box('steel', 3.7, 0.5, 1.0, x, fy + 4.35, -146);
    B.box('ledRed', 0.3, 0.3, 0.3, x, fy + 4.75, -146);
  }
  // Armários do arsenal
  for (let i = 0; i < 8; i++) {
    B.box('steelDark', 2.0, 4.0, 1.2, -18 + i * 2.2, fy + 2.0, -140.6);
    B.box('gold', 0.1, 0.5, 0.1, -17.4 + i * 2.2, fy + 2.2, -140.0);
  }
  // Faixas de alerta no chão
  for (let i = 0; i < 10; i++) B.box('yellowLine', 2.4, 0.03, 0.6, -45 + i * 10, fy + 0.03, -192, 0.6);
}

// ============================================================================
// 6. 4º ANDAR — COFRE CIRCULAR GIGANTE, BARRAS DE OURO E STUDS
// ============================================================================
export function buildVaultFloor(world, B) {
  const S = BANK_SPEC;
  const fy = S.floors[3];
  const vz = S.vaultWallZ;
  const hw = S.vaultDoorHalfW;
  const wallH = S.roofY - fy - 1.2;

  // Piso nobre de mármore com faixas douradas
  B.box('marble', S.innerMaxX - S.innerMinX - 12, 0.05, 58, 6, fy + 0.03, -175.5);
  for (let i = 0; i < 8; i++) B.box('gold', 120, 0.04, 0.4, 6, fy + 0.07, -150 - i * 7.6);
  B.box('velvet', 10, 0.05, 52, 0, fy + 0.08, -178);
  // Parede blindada do cofre com abertura circular no centro
  B.box('steel', S.innerMaxX - hw, wallH, 2.8, (S.innerMaxX + hw) / 2, fy + wallH / 2, vz);
  B.box('steel', S.innerMaxX - hw, wallH, 2.8, -(S.innerMaxX + hw) / 2, fy + wallH / 2, vz);
  B.box('steel', hw * 2, wallH - 10.6, 2.8, 0, fy + 10.6 + (wallH - 10.6) / 2, vz);
  B.box('gold', S.innerMaxX * 2, 0.5, 3.0, 0, fy + wallH - 0.4, vz);
  B.box('gold', S.innerMaxX * 2, 0.5, 3.0, 0, fy + 0.3, vz);
  world.addCollider((S.innerMaxX + hw) / 2, vz, S.innerMaxX - hw, 2.8, fy + wallH, fy);
  world.addCollider(-(S.innerMaxX + hw) / 2, vz, S.innerMaxX - hw, 2.8, fy + wallH, fy);
  world.addCollider(0, vz, hw * 2, 2.8, fy + wallH, fy + 10.6);
  // Rebites e faixas de aço
  for (let x = -66; x <= 66; x += 6) {
    if (Math.abs(x) < hw + 2) continue;
    B.box('chrome', 0.5, wallH - 1, 0.3, x, fy + wallH / 2, vz + 1.5);
  }
  // Moldura circular da porta (anel cromado + anel dourado)
  B.torus('chrome', 6.1, 0.55, 0, fy + 5.6, vz + 1.5);
  B.torus('gold', 6.75, 0.22, 0, fy + 5.6, vz + 1.55);
  // Grades de laser na frente do cofre (só visual)
  for (const ly of [1.0, 2.2, 3.4]) {
    B.cyl('laser', 0.05, 0.05, 30, 0, fy + ly, vz + 7, 6, 0, Math.PI / 2);
  }
  B.box('steel', 0.6, 4, 0.6, -15, fy + 2, vz + 7);
  B.box('steel', 0.6, 4, 0.6, 15, fy + 2, vz + 7);

  // PORTA CIRCULAR GIGANTE (destrutível)
  const door = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 1.4, 40),
    getLegoMaterial(0x94a3b8, { metalness: 0.85, roughness: 0.18 })
  );
  disc.rotation.x = Math.PI / 2;
  door.add(disc);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.28, 10, 32), getLegoMaterial(0xfacc15, { metalness: 0.8, roughness: 0.15 }));
  wheel.position.z = 0.9;
  door.add(wheel);
  for (let k = 0; k < 4; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.3, 0.3), getLegoMaterial(0xfacc15, { metalness: 0.8, roughness: 0.15 }));
    spoke.rotation.z = (k / 4) * Math.PI;
    spoke.position.z = 0.9;
    door.add(spoke);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 10), getLegoMaterial(0x334155, { metalness: 0.7 }));
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 0.8);
    door.add(bolt);
  }
  door.position.set(0, fy + 5.6, vz + 0.6);
  door.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  world.scene.add(door);
  const doorCol = world.addCollider(0, vz, hw * 2, 3.0, fy + 10.6, fy);
  let vaultDoor = null;
  if (world.destructibles) {
    vaultDoor = world.destructibles.registerDestructible({
      mesh: door,
      type: 'bank_vault_door',
      hp: 75,
      radius: 5.5,
      height: 11,
      colliders: [doorCol],
      debrisColors: [LEGO_COLORS.silver, LEGO_COLORS.gold, LEGO_COLORS.charcoal],
      studDrops: { silver: 0, gold: 14, blue: 10, purple: 5 },
      groundY: fy,
      goldOnly: false
    });
  }

  // SALA DO OURO (Z -226..-207)
  const roomZ0 = vz - 1.4;
  // Prateleiras de cédulas nas paredes laterais
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = roomZ0 - 2 - i * 3.8;
      B.box('steel', 2.0, 6.4, 3.2, sx * 64, fy + 3.2, z);
      for (let k = 0; k < 4; k++) B.box('cash', 1.6, 0.8, 2.6, sx * 64, fy + 0.9 + k * 1.5, z);
    }
  }
  // Caixas-fortes na parede do fundo
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 16; c++) {
      B.box('chrome', 3.6, 1.8, 0.3, -27 + c * 3.6, fy + 1.2 + r * 2.0, S.innerBackZ + 0.4);
      B.cyl('gold', 0.18, 0.18, 0.2, -27 + c * 3.6 + 1.2, fy + 1.2 + r * 2.0, S.innerBackZ + 0.6, 8, Math.PI / 2);
    }
  }
  // 4 pilhas grandes de barras de ouro (destrutíveis só com raio solar) em Z = -211
  for (const gx of [-12, -4, 4, 12]) addGoldStack(world, gx, fy, -211, 3.6, 2.6, 3.0);
  // 2 pilhas extras + pedestal central do "Ouro Lendário"
  addGoldStack(world, -24, fy, -219, 3.2, 2.2, 2.6);
  addGoldStack(world, 24, fy, -219, 3.2, 2.2, 2.6);
  B.box('graniteBlack', 6, 1.4, 6, S.goldPile.x, fy + 0.7, S.goldPile.z - 4);
  B.box('gold', 3.6, 1.6, 2.2, S.goldPile.x, fy + 2.2, S.goldPile.z - 4);
  B.box('gold', 2.4, 1.0, 1.6, S.goldPile.x, fy + 3.5, S.goldPile.z - 4);
  // Maletas prateadas
  for (const [mx, mz] of [[-16, -208.5], [16, -208.5], [-8, -223], [8, -223]]) {
    const brief = createLegoBrick(1.6, 1.0, 0.6, LEGO_COLORS.silver, { metalness: 0.7, roughness: 0.2, studs: false });
    brief.position.set(mx, fy + 0.5, mz);
    world.scene.add(brief);
    world.destructibles?.registerDestructible({
      mesh: brief,
      type: 'crate',
      hp: 20,
      radius: 1.0,
      height: 1.0,
      colliders: [],
      debrisColors: [LEGO_COLORS.silver, LEGO_COLORS.gold],
      studDrops: { silver: 4, gold: 6, blue: 2, purple: 1 },
      groundY: fy
    });
  }
  // 36 Studs girando na sala do cofre
  if (world.destructibles?.spawnAmbientStud) {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 6 + (i % 3) * 3;
      const tier = i % 6 === 0 ? 'purple' : i % 3 === 0 ? 'blue' : 'gold';
      world.destructibles.spawnAmbientStud(Math.cos(a) * r, fy + 0.9, -216 + Math.sin(a) * r * 0.45, tier);
    }
  }

  return { vaultDoor };
}

function addGoldStack(world, x, fy, z, w, h, d) {
  const stack = createLegoBrick(w, h, d, LEGO_COLORS.gold, { metalness: 0.78, roughness: 0.12, studStep: 0.65 });
  stack.position.set(x, fy + h / 2, z);
  world.scene.add(stack);
  const col = world.addCollider(x, z, w, d, fy + h, fy);
  world.destructibles?.registerDestructible({
    mesh: stack,
    type: 'gold_vault',
    hp: 40,
    radius: Math.max(w, d) * 0.65,
    height: h,
    colliders: [col],
    debrisColors: [LEGO_COLORS.gold, LEGO_COLORS.yellow],
    studDrops: { silver: 0, gold: 12, blue: 8, purple: 5 },
    groundY: fy,
    goldOnly: true
  });
}

// ============================================================================
// 7. TERRAÇO: heliponto, claraboia em pirâmide, jardins, antena e máquinas
// ============================================================================
export function buildRooftop(world, B) {
  const S = BANK_SPEC;
  const ry = S.roofY;
  const W = S.maxX - S.minX;
  const D = S.frontZ - S.backZ;
  const midZ = (S.frontZ + S.backZ) / 2;

  // Laje do terraço (andável) + parapeito com pinos LEGO
  B.box('concrete', W, 0.5, D, 0, ry - 0.25, midZ);
  world.elevatedDecks.push({
    id: 'bank_roof',
    minX: S.minX,
    maxX: S.maxX,
    minZ: S.backZ,
    maxZ: S.frontZ,
    thresholdBelow: 2.4,
    getDeckY: () => ry
  });
  const parH = S.wallTopY - ry;
  for (let x = S.minX + 2; x <= S.maxX - 2; x += 1.6) {
    B.cyl('gold', 0.28, 0.28, 0.25, x, S.wallTopY + 0.12, S.frontZ - 1.5, 8);
    B.cyl('gold', 0.28, 0.28, 0.25, x, S.wallTopY + 0.12, S.backZ + 1.5, 8);
  }
  void parH;

  // Heliponto (oeste)
  const hx = -40;
  const hz = -195;
  B.cyl('graniteBlack', 13, 13, 0.6, hx, ry + 0.3, hz, 40);
  B.cyl('yellowLine', 12, 12, 0.62, hx, ry + 0.31, hz, 40);
  B.cyl('graniteBlack', 11.2, 11.2, 0.64, hx, ry + 0.32, hz, 40);
  B.box('white', 1.4, 0.05, 9, hx - 2.8, ry + 0.66, hz);
  B.box('white', 1.4, 0.05, 9, hx + 2.8, ry + 0.66, hz);
  B.box('white', 4.2, 0.05, 1.4, hx, ry + 0.66, hz);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    B.box('ledRed', 0.5, 0.3, 0.5, hx + Math.cos(a) * 12.6, ry + 0.75, hz + Math.sin(a) * 12.6);
  }

  // Claraboia em pirâmide de vidro (centro) com moldura dourada
  B.box('gold', 22, 0.8, 22, 10, ry + 0.4, -168);
  B.cone('glass', 15.2, 9, 10, ry + 5.3, -168, 4);
  for (const [dx, dz] of [[-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]]) {
    B.box('gold', 0.4, 0.4, 14.5, 10 + dx * 0.5, ry + 5, -168 + dz * 0.5, Math.atan2(dx, dz), 0.85);
  }
  world.addCollider(10, -168, 22, 22, ry + 3.5, ry);

  // Jardins suspensos (canteiros com árvores LEGO) e bancos
  for (const [gx, gz] of [[46, -150], [46, -212], [-12, -150], [-12, -214]]) {
    B.box('wood', 14, 1.2, 6, gx, ry + 0.6, gz);
    B.box('plant', 13.4, 0.4, 5.4, gx, ry + 1.3, gz);
    for (let t = -1; t <= 1; t++) {
      B.cyl('pot', 0.25, 0.3, 2.4, gx + t * 4.5, ry + 2.5, gz, 8);
      B.sphere('plant', 1.6, gx + t * 4.5, ry + 4.4, gz, 1.1);
    }
    world.addCollider(gx, gz, 14, 6, ry + 1.5, ry);
  }

  // Máquinas de ar-condicionado com ventoinhas
  for (let i = 0; i < 4; i++) {
    const x = 32 + (i % 2) * 9;
    const z = -180 - Math.floor(i / 2) * 9;
    B.box('chrome', 7, 3, 6, x, ry + 1.5, z);
    B.cyl('black', 2.2, 2.2, 0.2, x, ry + 3.05, z, 20);
    B.box('steel', 3.8, 0.1, 0.4, x, ry + 3.2, z, i * 0.7);
    world.addCollider(x, z, 7, 6, ry + 3, ry);
  }

  // Caixa d'água + gerador
  B.cyl('steel', 4, 4, 6, -62, ry + 5.2, -218, 20);
  B.cone('steel', 4.4, 2, -62, ry + 9.2, -218, 20);
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) B.box('steelDark', 0.5, 2.2, 0.5, -62 + dx, ry + 1.1, -218 + dz);
  world.addCollider(-62, -218, 8.4, 8.4, ry + 8.2, ry);
  B.box('yellowLine', 8, 3.4, 4, -62, ry + 1.7, -150);
  B.box('black', 8.2, 0.6, 4.2, -62, ry + 3.6, -150);
  world.addCollider(-62, -150, 8, 4, ry + 3.9, ry);

  // Antena de comunicação com luz vermelha
  B.box('steelDark', 2.4, 1, 2.4, 60, ry + 0.5, -222);
  B.cyl('chrome', 0.35, 0.6, 18, 60, ry + 10, -222, 10);
  for (let k = 0; k < 4; k++) B.box('chrome', 3.2 - k * 0.6, 0.15, 0.15, 60, ry + 6 + k * 3, -222);
  B.sphere('ledRed', 0.6, 60, ry + 19.4, -222);

  // Letreiro dourado no topo da fachada (de frente para a avenida)
  const roofSign = createSignBoardMesh({
    x: 0,
    y: S.wallTopY + 3.4,
    z: S.frontZ - 2.2,
    width: 44,
    height: 5.2,
    depth: 0.5,
    title: '$ SUPER BANCO $',
    bgColor: '#090a0d',
    borderColor: '#facc15',
    textColor: '#facc15',
    doubleSided: true
  });
  world.scene.add(roofSign);
  B.box('steelDark', 0.6, 3.6, 0.6, -18, S.wallTopY + 0.4, S.frontZ - 2.2);
  B.box('steelDark', 0.6, 3.6, 0.6, 18, S.wallTopY + 0.4, S.frontZ - 2.2);

  // Bandeiras nas torres da frente
  for (const fx of [S.minX - 1, S.maxX + 1]) {
    B.cyl('chrome', 0.15, 0.15, 6, fx, S.wallTopY + 14, S.frontZ + 1, 8);
  }
}

// ============================================================================
// 8. PORTÕES DE SEGURANÇA NO PÉ DE CADA RAMPA (fecham durante o assalto)
// ============================================================================
export function buildRampGates(world) {
  const S = BANK_SPEC;
  const gateMat = getLegoMaterial(0x334155, { metalness: 0.7, roughness: 0.25 });
  const stripeMat = getLegoMaterial(0xfacc15, { roughness: 0.4 });
  return S.ramps.map((r, idx) => {
    const floorY = S.floors[r.fromFloor];
    const w = r.maxX - r.minX;
    const cx = (r.minX + r.maxX) / 2;
    const gz = r.zLow + (r.zHigh < r.zLow ? 1.4 : -1.4);
    const mesh = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 4.4, 0.4), gateMat);
    mesh.add(plate);
    for (let k = 0; k < 4; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.45), stripeMat);
      s.position.y = -1.6 + k * 1.1;
      mesh.add(s);
    }
    mesh.position.set(cx, floorY - 4.2, gz);
    mesh.visible = false;
    mesh.userData.skipStaticMerge = true;
    world.scene.add(mesh);
    const collider = world.addCollider(cx, gz, w, 0.6, floorY + 4.4, floorY + 0.05, { isDynamic: true });
    collider.disabled = true;
    return { idx, rampId: r.id, floorIdx: r.fromFloor, floorY, mesh, collider, open: true };
  });
}

// ============================================================================
// 9. ELEVADOR [E]: leva ao próximo andar (no topo, volta ao térreo)
// ============================================================================
export function createBankElevator(world) {
  const S = BANK_SPEC;
  const E = S.elevator;
  const elevator = {
    callX: E.callX,
    callZ: E.callZ,
    radius: 3.6,
    cooldown: 0,
    /** Gancho do assalto: retorna mensagem de bloqueio ou null */
    canTravel: null,
    nearestFloor(pos) {
      if (Math.hypot(pos.x - E.callX, pos.z - E.callZ) > this.radius) return -1;
      let best = -1;
      for (let i = 0; i < S.floors.length; i++) {
        if (Math.abs(pos.y - S.floors[i]) < 2.5) best = i;
      }
      return best;
    },
    /** Usado pelo [E] do controle. Retorna true se tratou a interação. */
    tryUse(controller) {
      if (!controller?.position || controller.currentVehicle) return false;
      const from = this.nearestFloor(controller.position);
      if (from < 0 || this.cooldown > 0) return from >= 0;
      const to = from >= S.floors.length - 1 ? 0 : from + 1;
      const block = this.canTravel ? this.canTravel(from, to) : null;
      const hud = world.destructibles?.hud;
      if (block) {
        hud?.showWantedBanner?.('ELEVADOR BLOQUEADO', block, 'busted', 2000);
        return true;
      }
      const y = S.floors[to] + 0.05;
      controller.position.set(E.callX, y, E.callZ);
      controller.velocity?.set(0, 0, 0);
      if (controller.minifigure?.root) controller.minifigure.root.position.copy(controller.position);
      this.cooldown = 1.2;
      const names = ['1º ANDAR // SAGUÃO', '2º ANDAR // ESCRITÓRIOS', '3º ANDAR // SEGURANÇA', '4º ANDAR // COFRE'];
      hud?.showWantedBanner?.('ELEVADOR', names[to], 'escaped', 1600);
      return true;
    },
    update(dt) {
      if (this.cooldown > 0) this.cooldown -= dt;
    }
  };
  return elevator;
}
