import * as THREE from 'three';
import {
  makeFastBox,
  flushSpatialChunkedBuckets
} from '../../BuildingGenerator.js';

export const CLASSIC_LEGO_CONTAINER_KEYS = [
  'lego_red',
  'pcc_royal',       // Azul clássico LEGO
  'forklift_yellow', // Amarelo clássico LEGO
  'lego_green',
  'lego_orange',
  'tactical_white',
  'matte_black'
];

/**
 * ACUMULADOR DE GEOMETRIAS DO IMPÉRIO INDUSTRIAL & CORPORATIVO DO PCC + PORTO (60 FPS CRAVADOS!)
 * Funde dezenas de milhares de peças 3D (Cidadela de 112m, Passarelas Aéreas Blindadas, Torres Corporativas de Lavagem
 * de 48-80m, Megagalpões de 40-48m, Baterias de Silos de 55m, Torres de Resfriamento, Chaminés de 68-85m com Fumaça,
 * Pilhas de Contêineres, Frotas de Caminhões/SUVs/Vans, Paletes de Ouro, C4 e Muralhas) em poucos Draw Calls!
 */
export class PCCIndustrialBatcher {
  constructor(world = null) {
    this.world = world;
    this.buckets = new Map();
    this.materials = new Map();
    this._initMaterials();
  }

  _terrainLift(x, z) {
    if (!this.world?.getTerrainHeightAt) return 0;
    if (x < 622 || x > 1430 || z < -720 || z > -40) return 0;
    return Math.max(0, this.world.getTerrainHeightAt(x, z));
  }

  _reg(key, colorHex, opts = {}) {
    this.buckets.set(key, []);
    this.materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: opts.roughness ?? 0.32,
        metalness: opts.metalness ?? 0.12,
        emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
        emissiveIntensity: opts.emissiveIntensity ?? 0.0
      })
    );
  }

  _initMaterials() {
    // Paleta Oficial do PCC: Preto Fosco, Cinza-Chumbo, Vidro Preto Espelhado, Azul-Marinho/Neon e Branco/Prata
    this._reg('matte_black', 0x090a0d, { roughness: 0.4, metalness: 0.24 });
    this._reg('gunmetal_concrete', 0x1e293b, { roughness: 0.54, metalness: 0.12 });
    this._reg('armor_slate', 0x334155, { roughness: 0.46, metalness: 0.16 });
    this._reg('dark_steel', 0x0b1120, { roughness: 0.12, metalness: 0.58 }); // Vidro preto espelhado / fumê azulado
    this._reg('pcc_navy', 0x1e3a8a, { roughness: 0.28, metalness: 0.2 });
    this._reg('pcc_royal', 0x1d4ed8, { roughness: 0.24, metalness: 0.22 });
    this._reg('pcc_neon_blue', 0x0ea5e9, {
      roughness: 0.15,
      metalness: 0.1,
      emissive: 0x0284c7,
      emissiveIntensity: 0.88
    });
    this._reg('tactical_white', 0xf8fafc, { roughness: 0.26, metalness: 0.08 });
    this._reg('brushed_silver', 0xcbd5e1, { roughness: 0.22, metalness: 0.58 });
    this._reg('stolen_gold', 0xfacc15, {
      roughness: 0.16,
      metalness: 0.68,
      emissive: 0xb45309,
      emissiveIntensity: 0.22
    });
    this._reg('pallet_wood', 0x92400e, { roughness: 0.65, metalness: 0.02 });
    this._reg('forklift_yellow', 0xeab308, { roughness: 0.26, metalness: 0.15 });
    this._reg('c4_hazard_red', 0xef4444, {
      roughness: 0.2,
      emissive: 0xdc2626,
      emissiveIntensity: 0.9
    });
    this._reg('scrap_rust', 0x7c2d12, { roughness: 0.62, metalness: 0.25 });
    this._reg('scrap_teal', 0x0f766e, { roughness: 0.4, metalness: 0.2 });
    this._reg('smoke_plume', 0x64748b, { roughness: 0.85, metalness: 0.0 });
    // Materiais Clássicos Vibrantes do Porto de Cargas & Contrabando A.R.E.S.
    this._reg('lego_red', 0xdc2626, { roughness: 0.24, metalness: 0.1 });
    this._reg('lego_green', 0x16a34a, { roughness: 0.24, metalness: 0.1 });
    this._reg('lego_orange', 0xf97316, { roughness: 0.24, metalness: 0.12 });
    this._reg('ares_neon_purple', 0xa855f7, {
      roughness: 0.18,
      metalness: 0.25,
      emissive: 0x9333ea,
      emissiveIntensity: 0.92
    });
    this._reg('ares_magenta', 0xd946ef, {
      roughness: 0.16,
      metalness: 0.28,
      emissive: 0xc026d3,
      emissiveIntensity: 0.95
    });
    this._reg('floodlight_glow', 0xfef08a, {
      roughness: 0.1,
      emissive: 0xfef08a,
      emissiveIntensity: 0.95
    });
    this._reg('coastal_turquoise', 0x06b6d4, { roughness: 0.22, metalness: 0.14 });
    this._reg('sand_gold', 0xfde047, { roughness: 0.58, metalness: 0.02 });
  }

  addBox(key, w, h, d, x, y, z, rotX = 0, rotY = 0, rotZ = 0) {
    const arr = this.buckets.get(key);
    if (!arr) return;
    const tY = this._terrainLift(x, z);
    let finalH = h;
    let finalY = y + tY;
    if (tY > 0.04 && y - h * 0.5 <= 0.65 && rotX === 0 && rotZ === 0) {
      finalH = h + 3.5;
      finalY = y + tY - 1.75;
    }
    if (rotX === 0 && rotY === 0 && rotZ === 0) {
      arr.push(makeFastBox(w, finalH, d, x, finalY, z));
      return;
    }
    const geo = new THREE.BoxGeometry(w, finalH, d);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotY !== 0) geo.rotateY(rotY);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(x, finalY, z);
    arr.push(geo);
  }

  addCylinder(key, rTop, rBot, h, x, y, z, segs = 8, rotX = 0, rotZ = 0) {
    const arr = this.buckets.get(key);
    if (!arr) return;
    const tY = this._terrainLift(x, z);
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    if (rotX !== 0) geo.rotateX(rotX);
    if (rotZ !== 0) geo.rotateZ(rotZ);
    geo.translate(x, y + tY, z);
    arr.push(geo);
  }

  createSubBatcher() {
    const sub = Object.create(PCCIndustrialBatcher.prototype);
    sub.world = this.world;
    sub.materials = this.materials;
    sub.buckets = new Map();
    for (const key of this.materials.keys()) {
      sub.buckets.set(key, []);
    }
    return sub;
  }

  finalize(scene) {
    // Sombras seletivas apenas nos materiais estruturais grandes para garantir 60 FPS cravados!
    const shadowCasterKeys = new Set([
      'matte_black',
      'gunmetal_concrete',
      'armor_slate',
      'dark_steel',
      'pcc_navy'
    ]);
    flushSpatialChunkedBuckets(scene, this.buckets, this.materials, {
      chunkSize: scene?.isScene ? 512 : 4096,
      castShadowFn: (key) => shadowCasterKeys.has(key),
      receiveShadowFn: (key) =>
        key !== 'pcc_neon_blue' && key !== 'c4_hazard_red' && key !== 'smoke_plume'
    });
    this.buckets.clear();
  }
}

/**
 * Helper: Constrói Muro Alto Fortificado do PCC com vigas de aço pretas, cercas superiores,
 * Guaritas Elevadas Blindadas nos 4 cantos da muralha, câmeras de vigilância e portões blindados.
 */
export function buildFortifiedCompoundWalls(world, batcher, cx, cz, w, d, opts = {}) {
  const wallH = opts.wallH ?? 5.2;
  const halfW = w * 0.5 - 1.2;
  const halfD = d * 0.5 - 1.2;
  const gateSouth = opts.gateSouth !== false;
  const gateWest = opts.gateWest ?? false;
  const gateWidth = opts.gateWidth ?? 26;

  // Muro Norte (-Z) e Muro Leste (+X)
  batcher.addBox('gunmetal_concrete', w - 2.4, wallH, 1.6, cx, 0.28 + wallH * 0.5, cz - halfD);
  batcher.addBox('brushed_silver', w - 2.4, 1.1, 0.25, cx, 0.28 + wallH + 0.55, cz - halfD);
  world.addCollider(cx, cz - halfD, w - 2.4, 1.6, 0.28 + wallH + 1.1, 0.28);

  batcher.addBox('gunmetal_concrete', 1.6, wallH, d - 2.4, cx + halfW, 0.28 + wallH * 0.5, cz);
  batcher.addBox('brushed_silver', 0.25, 1.1, d - 2.4, cx + halfW, 0.28 + wallH + 0.55, cz);
  world.addCollider(cx + halfW, cz, 1.6, d - 2.4, 0.28 + wallH + 1.1, 0.28);

  // Muro Sul (+Z) com Portão Blindado e Guarita
  if (gateSouth) {
    const segW = Math.max(8, (w - 2.4 - gateWidth) * 0.5);
    const leftX = cx - gateWidth * 0.5 - segW * 0.5;
    const rightX = cx + gateWidth * 0.5 + segW * 0.5;
    for (const sx of [leftX, rightX]) {
      batcher.addBox('gunmetal_concrete', segW, wallH, 1.6, sx, 0.28 + wallH * 0.5, cz + halfD);
      batcher.addBox('brushed_silver', segW, 1.1, 0.25, sx, 0.28 + wallH + 0.55, cz + halfD);
      world.addCollider(sx, cz + halfD, segW, 1.6, 0.28 + wallH + 1.1, 0.28);
    }
    for (const px of [cx - gateWidth * 0.5, cx + gateWidth * 0.5]) {
      batcher.addBox('matte_black', 2.8, wallH + 3.6, 2.8, px, 0.28 + (wallH + 3.6) * 0.5, cz + halfD);
      batcher.addBox('pcc_neon_blue', 1.3, 0.65, 1.3, px, 0.28 + wallH + 3.8, cz + halfD);
    }
    batcher.addBox('pcc_navy', gateWidth + 2.8, 1.8, 2.4, cx, 0.28 + wallH + 2.8, cz + halfD);
    batcher.addBox('tactical_white', gateWidth * 0.55, 0.55, 2.5, cx, 0.28 + wallH + 2.8, cz + halfD);
  } else {
    batcher.addBox('gunmetal_concrete', w - 2.4, wallH, 1.6, cx, 0.28 + wallH * 0.5, cz + halfD);
    batcher.addBox('brushed_silver', w - 2.4, 1.1, 0.25, cx, 0.28 + wallH + 0.55, cz + halfD);
    world.addCollider(cx, cz + halfD, w - 2.4, 1.6, 0.28 + wallH + 1.1, 0.28);
  }

  // Muro Oeste (-X)
  if (gateWest) {
    const segD = Math.max(8, (d - 2.4 - gateWidth) * 0.5);
    const topZ = cz - gateWidth * 0.5 - segD * 0.5;
    const botZ = cz + gateWidth * 0.5 + segD * 0.5;
    for (const sz of [topZ, botZ]) {
      batcher.addBox('gunmetal_concrete', 1.6, wallH, segD, cx - halfW, 0.28 + wallH * 0.5, sz);
      batcher.addBox('brushed_silver', 0.25, 1.1, segD, cx - halfW, 0.28 + wallH + 0.55, sz);
      world.addCollider(cx - halfW, sz, 1.6, segD, 0.28 + wallH + 1.1, 0.28);
    }
    for (const pz of [cz - gateWidth * 0.5, cz + gateWidth * 0.5]) {
      batcher.addBox('matte_black', 2.8, wallH + 3.6, 2.8, cx - halfW, 0.28 + (wallH + 3.6) * 0.5, pz);
      batcher.addBox('pcc_neon_blue', 1.3, 0.65, 1.3, cx - halfW, 0.28 + wallH + 3.8, pz);
    }
  } else {
    batcher.addBox('gunmetal_concrete', 1.6, wallH, d - 2.4, cx - halfW, 0.28 + wallH * 0.5, cz);
    batcher.addBox('brushed_silver', 0.25, 1.1, d - 2.4, cx - halfW, 0.28 + wallH + 0.55, cz);
    world.addCollider(cx - halfW, cz, 1.6, d - 2.4, 0.28 + wallH + 1.1, 0.28);
  }

  // Vigas verticais de aço preto ao longo dos muros
  for (let bx = cx - halfW; bx <= cx + halfW; bx += 22) {
    batcher.addBox('matte_black', 1.0, wallH + 0.5, 2.2, bx, 0.28 + wallH * 0.5, cz - halfD);
    if (!gateSouth || Math.abs(bx - cx) > gateWidth * 0.5 + 1) {
      batcher.addBox('matte_black', 1.0, wallH + 0.5, 2.2, bx, 0.28 + wallH * 0.5, cz + halfD);
    }
  }

  // Guaritas Blindadas Elevadas nos 4 Cantos da Muralha + Holofotes Azuis e Câmeras de Vigilância
  for (const [kx, kz] of [
    [cx - halfW + 1.5, cz - halfD + 1.5],
    [cx + halfW - 1.5, cz - halfD + 1.5],
    [cx - halfW + 1.5, cz + halfD - 1.5],
    [cx + halfW - 1.5, cz + halfD - 1.5]
  ]) {
    batcher.addBox('matte_black', 4.6, wallH + 4.8, 4.6, kx, 0.28 + (wallH + 4.8) * 0.5, kz);
    batcher.addBox('dark_steel', 5.0, 1.6, 5.0, kx, 0.28 + wallH + 3.4, kz);
    batcher.addBox('pcc_navy', 5.4, 0.85, 5.4, kx, 0.28 + wallH + 4.8, kz);
    batcher.addBox('pcc_neon_blue', 1.8, 0.5, 1.8, kx, 0.28 + wallH + 5.4, kz);
    batcher.addBox('c4_hazard_red', 0.35, 0.35, 0.35, kx, 0.28 + wallH + 4.2, kz + (kz > cz ? 2.6 : -2.6));
  }
}

export function addGiantSiloBattery(world, batcher, startX, z, count = 4, height = 54) {
  world.industrialPCCData.siloBatteriesCount++;
  const spacing = 12.5;
  const totalW = (count - 1) * spacing;
  for (let i = 0; i < count; i++) {
    const sx = startX - totalW * 0.5 + i * spacing;
    batcher.addCylinder('brushed_silver', 5.2, 5.4, height, sx, 0.28 + height * 0.5, z, 10);
    batcher.addCylinder('matte_black', 5.35, 5.35, 6.0, sx, 0.28 + height * 0.35, z, 10);
    batcher.addCylinder('pcc_navy', 5.4, 5.4, 4.5, sx, 0.28 + height * 0.78, z, 10);
    batcher.addCylinder('pcc_neon_blue', 5.5, 5.5, 0.65, sx, 0.28 + height * 0.85, z, 10);
  }
  batcher.addBox('matte_black', totalW + 10, 1.2, 4.2, startX, 0.28 + height + 0.6, z);
  batcher.addBox('pcc_neon_blue', totalW + 10.4, 0.35, 4.5, startX, 0.28 + height + 1.4, z);
  world.addCollider(startX, z, totalW + 11, 11, 0.28 + height + 1.5, 0.28);
}

export function addIndustrialCoolingTower(world, batcher, x, z, height = 48) {
  world.industrialPCCData.coolingTowersCount++;
  batcher.addCylinder('gunmetal_concrete', 7.2, 10.2, height * 0.65, x, 0.28 + height * 0.325, z, 12);
  batcher.addCylinder('gunmetal_concrete', 8.4, 7.2, height * 0.35, x, 0.28 + height * 0.825, z, 12);
  batcher.addCylinder('pcc_navy', 8.6, 8.6, 2.4, x, 0.28 + height - 2.0, z, 12);
  batcher.addCylinder('pcc_neon_blue', 8.75, 8.75, 0.55, x, 0.28 + height - 0.5, z, 12);
  batcher.addBox('smoke_plume', 9.5, 4.5, 9.5, x, 0.28 + height + 3.2, z);
  batcher.addBox('smoke_plume', 12.0, 5.2, 12.0, x + 2.5, 0.28 + height + 8.0, z - 1.5);
  world.addCollider(x, z, 19, 19, 0.28 + height, 0.28);
}

export function addTallIndustrialSmokestack(world, batcher, x, z, height = 76) {
  world.industrialPCCData.tallSmokestacksCount++;
  batcher.addCylinder('matte_black', 2.4, 3.8, height, x, 0.28 + height * 0.5, z, 10);
  batcher.addCylinder('tactical_white', 2.65, 2.75, 3.5, x, 0.28 + height - 8.0, z, 10);
  batcher.addCylinder('pcc_navy', 2.55, 2.65, 3.5, x, 0.28 + height - 4.0, z, 10);
  batcher.addCylinder('c4_hazard_red', 2.7, 2.7, 1.1, x, 0.28 + height - 0.8, z, 10);
  batcher.addBox('smoke_plume', 5.2, 3.8, 5.2, x, 0.28 + height + 2.6, z);
  batcher.addBox('smoke_plume', 7.4, 4.6, 7.4, x + 2.2, 0.28 + height + 6.8, z - 1.4);
  batcher.addBox('smoke_plume', 9.6, 5.2, 9.6, x + 5.0, 0.28 + height + 11.8, z - 2.8);
  world.addCollider(x, z, 7.2, 7.2, 0.28 + height, 0.28);
}

export function addPCCContainerStack(world, batcher, x, z, layers = 3, rotated = false) {
  world.industrialPCCData.pccContainerStacksCount++;
  const cw = rotated ? 13.0 : 5.4;
  const cd = rotated ? 5.4 : 13.0;
  const ch = 4.2;
  const keys = ['matte_black', 'pcc_navy', 'armor_slate'];
  for (let s = 0; s < layers; s++) {
    const key = keys[s % keys.length];
    batcher.addBox(key, cw, ch, cd, x, 0.28 + s * ch + ch * 0.5, z);
    batcher.addBox('pcc_neon_blue', cw + 0.15, 0.25, cd + 0.15, x, 0.28 + (s + 1) * ch - 0.3, z);
  }
  const ox = rotated ? 0 : 6.0;
  const oz = rotated ? 6.0 : 0;
  for (let s = 0; s < Math.max(1, layers - 1); s++) {
    const key = keys[(s + 1) % keys.length];
    batcher.addBox(key, cw, ch, cd, x + ox, 0.28 + s * ch + ch * 0.5, z + oz);
  }
  world.addCollider(x + ox * 0.5, z + oz * 0.5, cw + ox, cd + oz, 0.28 + layers * ch, 0.28);
}

export function addHorizontalChemicalTank(world, batcher, x, z) {
  world.industrialPCCData.horizontalTanksCount++;
  batcher.addBox('gunmetal_concrete', 10.5, 1.4, 4.2, x, 0.98, z);
  batcher.addCylinder('brushed_silver', 2.1, 2.1, 11.5, x, 3.2, z, 10, 0, Math.PI / 2);
  batcher.addCylinder('pcc_navy', 2.2, 2.2, 1.8, x - 2.8, 3.2, z, 10, 0, Math.PI / 2);
  batcher.addCylinder('pcc_navy', 2.2, 2.2, 1.8, x + 2.8, 3.2, z, 10, 0, Math.PI / 2);
  world.addCollider(x, z, 11.6, 4.4, 5.4, 0.28);
}

export function addStaticPCCSuvOrVan(world, batcher, x, z, isVan = false) {
  const h = isVan ? 2.4 : 1.9;
  const d = isVan ? 5.6 : 4.8;
  batcher.addBox('matte_black', 2.5, h, d, x, 0.28 + h * 0.5, z);
  batcher.addBox('dark_steel', 2.35, 0.75, d * 0.65, x, 0.28 + h * 0.72, z);
  batcher.addBox('pcc_navy', 2.58, 0.28, d - 0.3, x, 0.28 + h * 0.45, z);
  batcher.addBox('pcc_neon_blue', 2.6, 0.12, d - 0.5, x, 0.28 + h * 0.58, z);
  world.addCollider(x, z, 2.6, d, 0.28 + h, 0.28);
}

export function addStolenGoldPallet(world, batcher, x, z, spawnStuds = false) {
  world.industrialPCCData.stolenGoldPalletsCount++;
  batcher.addBox('pallet_wood', 3.4, 0.36, 3.4, x, 0.46, z);
  batcher.addBox('stolen_gold', 2.8, 0.65, 2.8, x, 0.96, z);
  batcher.addBox('stolen_gold', 2.2, 0.65, 2.2, x, 1.6, z);
  batcher.addBox('stolen_gold', 1.4, 0.55, 1.4, x, 2.2, z);
  world.addCollider(x, z, 3.4, 3.4, 2.6, 0.28);

  if (spawnStuds && world.destructibles) {
    const palTY = batcher._terrainLift(x, z);
    world.destructibles.spawnAmbientStud(x - 0.8, 2.75 + palTY, z, 'gold');
    world.destructibles.spawnAmbientStud(x + 0.8, 2.75 + palTY, z, 'blue');
    world.destructibles.spawnAmbientStud(x, 2.95 + palTY, z, 'purple');
  }
}

export function addSilverBriefcaseStack(world, batcher, x, z) {
  world.industrialPCCData.silverBriefcaseStacksCount++;
  batcher.addBox('pallet_wood', 3.0, 0.32, 3.0, x, 0.44, z);
  for (let ly = 0; ly < 3; ly++) {
    batcher.addBox('brushed_silver', 2.4 - ly * 0.3, 0.5, 1.8, x, 0.85 + ly * 0.54, z);
    batcher.addBox('matte_black', 0.6, 0.54, 1.86, x, 0.85 + ly * 0.54, z);
  }
  world.addCollider(x, z, 3.0, 3.0, 2.4, 0.28);
}

export function addC4ExplosiveCrateStack(world, batcher, x, z) {
  world.industrialPCCData.c4CratesCount += 3;
  batcher.addBox('matte_black', 3.6, 1.4, 2.6, x, 0.98, z);
  batcher.addBox('pcc_navy', 3.7, 0.35, 2.7, x, 1.15, z);
  batcher.addBox('c4_hazard_red', 0.55, 0.35, 2.75, x - 0.9, 1.45, z);
  batcher.addBox('pcc_neon_blue', 0.55, 0.35, 2.75, x + 0.9, 1.45, z);

  batcher.addBox('matte_black', 2.6, 1.1, 2.0, x, 2.2, z);
  batcher.addBox('c4_hazard_red', 0.45, 0.3, 2.1, x, 2.55, z);
  world.addCollider(x, z, 3.6, 2.6, 2.8, 0.28);
}

export function addLegoForklift(world, batcher, x, z) {
  world.industrialPCCData.forkliftsCount++;
  batcher.addBox('forklift_yellow', 2.2, 1.3, 3.2, x, 0.95, z);
  batcher.addBox('matte_black', 2.0, 1.35, 2.1, x, 2.25, z - 0.2);
  batcher.addBox('matte_black', 1.8, 3.2, 0.32, x, 1.9, z + 1.75);
  batcher.addBox('brushed_silver', 1.6, 0.18, 1.8, x, 1.15, z + 2.65);
  batcher.addBox('stolen_gold', 1.4, 0.75, 1.4, x, 1.62, z + 2.65);
  world.addCollider(x, z + 0.5, 2.4, 4.8, 3.2, 0.28);
}

export function addPCCArmoredBoxTruck(world, batcher, x, z) {
  world.industrialPCCData.boxTrucksCount++;
  batcher.addBox('matte_black', 3.4, 3.8, 8.6, x, 2.4, z);
  batcher.addBox('pcc_navy', 3.5, 0.75, 8.7, x, 2.5, z);
  batcher.addBox('tactical_white', 3.54, 0.25, 8.4, x, 3.1, z);
  batcher.addBox('gunmetal_concrete', 3.2, 2.8, 2.8, x, 1.9, z + 5.6);
  batcher.addBox('dark_steel', 2.9, 1.1, 2.9, x, 2.45, z + 5.65);
  batcher.addBox('matte_black', 3.6, 0.95, 10.8, x, 0.75, z + 1.2);
  world.addCollider(x, z + 1.2, 3.6, 11.4, 4.4, 0.28);
}

/**
 * Constrói uma pilha de 1 a 8 andares de Contêineres Marítimos 3D em Escala Real (18m x 6m x 6m — até 48m de altura!)
 */
export function addCorrugatedContainerStack(world, batcher, x, z, floors, rotated, colorKeys, seed) {
  const cw = rotated ? 18.0 : 6.0;
  const cd = rotated ? 6.0 : 18.0;
  const ch = 6.0;

  for (let s = 0; s < floors; s++) {
    const colorKey = colorKeys[(seed + s * 2) % colorKeys.length];
    const cy = 0.28 + s * ch + ch * 0.5;
    addSingleDetailedContainerGeometry(batcher, colorKey, x, cy, z, cw, ch, cd, rotated);
    world.eastPortData.detailedContainersCount++;
  }

  world.addCollider(x, z, cw, cd, 0.28 + floors * ch, 0.28);
  world.mapBuildings.push({
    x,
    z,
    w: cw,
    d: cd,
    height: floors * ch,
    color: '#f59e0b'
  });
}

/**
 * Desenha 1 Contêiner Marítimo 3D em Escala Real (18m x 6m x 6m) com paredes laterais frisadas e portas duplas com travas
 */
export function addSingleDetailedContainerGeometry(batcher, colorKey, x, cy, z, cw, ch, cd, rotated) {
  batcher.addBox(colorKey, cw - 0.2, ch - 0.14, cd - 0.2, x, cy, z);

  if (!rotated) {
    for (const rzOff of [-5.2, 0, 5.2]) {
      batcher.addBox(colorKey, cw + 0.24, ch - 0.42, 2.2, x, cy, z + rzOff);
    }
    batcher.addBox('brushed_silver', 3.2, ch - 0.4, cd + 0.16, x, cy, z);
  } else {
    for (const rxOff of [-5.2, 0, 5.2]) {
      batcher.addBox(colorKey, 2.2, ch - 0.42, cd + 0.24, x + rxOff, cy, z);
    }
    batcher.addBox('brushed_silver', cw + 0.16, ch - 0.4, 3.2, x, cy, z);
  }
}
