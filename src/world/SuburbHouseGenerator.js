import * as THREE from 'three';
import { LEGO_COLORS } from '../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from './BuildingGenerator.js';

export const HOUSE_STYLE_KEYS = [
  'american_two_story',
  'ranch_l_shape',
  'suburb_mansion_pool',
  'modern_wood_chalet',
  'townhouses'
];

export const HOUSE_WALL_PALETTE = [
  { key: 'wall_cream', hex: 0xfef08a, mapColor: '#fef08a' },        // Amarelo-creme
  { key: 'wall_sky_blue', hex: 0x60a5fa, mapColor: '#60a5fa' },     // Azul-céu vibrante
  { key: 'wall_mint', hex: 0x4ade80, mapColor: '#4ade80' },         // Verde-menta vivo
  { key: 'wall_brick', hex: 0xc2410c, mapColor: '#ea580c' },        // Tijolo à vista
  { key: 'wall_white', hex: 0xf8fafc, mapColor: '#f8fafc' },        // Branco clássico
  { key: 'wall_salmon', hex: 0xfb7185, mapColor: '#fb7185' },       // Salmão / Coral
  { key: 'wall_tan', hex: 0xd6b88a, mapColor: '#d6b88a' },          // Bege / Areia
  { key: 'wall_lightgrey', hex: 0xcbd5e1, mapColor: '#cbd5e1' },    // Cinza-claro
  { key: 'wall_lavender', hex: 0xc084fc, mapColor: '#c084fc' },     // Lilás / Lavanda
  { key: 'wall_amber', hex: 0xf59e0b, mapColor: '#f59e0b' },        // Amarelo-mostarda / Ocre
  { key: 'wall_teal', hex: 0x2dd4bf, mapColor: '#2dd4bf' },         // Turquesa / Verde-água
  { key: 'wall_colonial_red', hex: 0xdc2626, mapColor: '#dc2626' }  // Vermelho Colonial
];

export const HOUSE_ROOF_PALETTE = [
  { key: 'roof_red', hex: 0xb91c1c },         // Vermelho-telha
  { key: 'roof_brown', hex: 0x5c2d16 },       // Marrom-escuro
  { key: 'roof_slate', hex: 0x1e3a8a },       // Ardósia azul
  { key: 'roof_graphite', hex: 0x27272a },    // Grafite
  { key: 'roof_green', hex: 0x14532d },       // Verde-musgo
  { key: 'roof_terracotta', hex: 0x9a3412 }   // Terracota queimado
];

/**
 * Acumulador de Geometrias 3D do Subúrbio:
 * Agrupa milhares de detalhes arquitetônicos (telhados inclinados, chaminés, varandas, janelas,
 * piscinas, churrasqueiras, casinhas de cachorro, canteiros e calçadas) em ~22 Draw Calls!
 */
export class SuburbBatcher {
  constructor() {
    this.buckets = new Map();
    this.materials = new Map();
    this.floweringTrees = [];
    this._initMaterials();
  }

  _registerMat(key, colorHex, opts = {}) {
    this.buckets.set(key, []);
    if (opts.basic) {
      this.materials.set(key, new THREE.MeshBasicMaterial({ color: colorHex }));
    } else {
      this.materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color: colorHex,
          roughness: opts.roughness ?? 0.32,
          metalness: opts.metalness ?? 0.06,
          emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
          emissiveIntensity: opts.emissiveIntensity ?? 0
        })
      );
    }
  }

  _initMaterials() {
    for (const w of HOUSE_WALL_PALETTE) {
      this._registerMat(w.key, w.hex, { roughness: 0.28 });
    }
    for (const r of HOUSE_ROOF_PALETTE) {
      this._registerMat(r.key, r.hex, { roughness: 0.34 });
    }
    this._registerMat('trim_white', 0xffffff, { roughness: 0.25 });
    this._registerMat('wood_warm', 0x92400e, { roughness: 0.38 });
    this._registerMat('stone_grey', 0x64748b, { roughness: 0.48 });
    this._registerMat('chimney_brick', 0x991b1b, { roughness: 0.42 });
    this._registerMat('charcoal_metal', 0x1e293b, { roughness: 0.3, metalness: 0.35 });
    this._registerMat('window_warm', 0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 0.55, roughness: 0.15 });
    this._registerMat('window_glass', 0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 0.25, roughness: 0.12 });
    this._registerMat('shutter_blue', 0x1e40af, { roughness: 0.3 });
    this._registerMat('shutter_green', 0x166534, { roughness: 0.3 });
    this._registerMat('lawn_green', 0x22c55e, { roughness: 0.55 });
    this._registerMat('hedge_green', 0x15803d, { roughness: 0.5 });
    this._registerMat('driveway_concrete', 0x94a3b8, { roughness: 0.52 });
    this._registerMat('walkway_stone', 0xd6d3d1, { roughness: 0.45 });
    this._registerMat('asphalt_lot', 0x1e293b, { roughness: 0.72 });
    this._registerMat('pool_water', 0x0ea5e9, { emissive: 0x0284c7, emissiveIntensity: 0.35, roughness: 0.1 });
    this._registerMat('flower_red', 0xef4444, { roughness: 0.3 });
    this._registerMat('flower_yellow', 0xfacc15, { roughness: 0.3 });
    this._registerMat('flower_pink', 0xf472b6, { roughness: 0.3 });
    this._registerMat('court_orange', 0xea580c, { roughness: 0.45 });
    this._registerMat('court_blue', 0x2563eb, { roughness: 0.45 });
    this._registerMat('neon_pink', 0xf43f5e, { emissive: 0xf43f5e, emissiveIntensity: 0.75 });
    this._registerMat('neon_cyan', 0x06b6d4, { emissive: 0x06b6d4, emissiveIntensity: 0.75 });
    this._registerMat('gold_accent', 0xfacc15, { emissive: 0xd97706, emissiveIntensity: 0.4, metalness: 0.4 });
  }

  addBox(matKey, w, h, d, x, y, z) {
    const bucket = this.buckets.get(matKey);
    if (!bucket) return;
    bucket.push(makeTranslatedBox(w, h, d, x, y, z));
  }

  addFloweringTree(x, y, z, scale = 1.0, blossomKey = 'pink') {
    this.floweringTrees.push({ x, y, z, scale, blossomKey });
  }

  flush(scene) {
    for (const [key, geos] of this.buckets.entries()) {
      if (geos.length === 0) continue;
      const merged = mergeBufferGeometries(geos);
      if (!merged) continue;
      const mat = this.materials.get(key);
      const mesh = new THREE.Mesh(merged, mat);
      const isGround =
        key === 'lawn_green' ||
        key === 'driveway_concrete' ||
        key === 'walkway_stone' ||
        key === 'asphalt_lot' ||
        key === 'pool_water';
      mesh.castShadow = !isGround;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    // Instancia árvores floridas residenciais (Cerejeiras Rosas e Ipês Amarelos) em 3 Draw Calls
    if (this.floweringTrees.length > 0) {
      const count = this.floweringTrees.length;
      const trunkGeo = new THREE.CylinderGeometry(0.36, 0.46, 2.5, 8);
      trunkGeo.translate(0, 1.25, 0);
      const trunkInst = new THREE.InstancedMesh(
        trunkGeo,
        new THREE.MeshStandardMaterial({ color: LEGO_COLORS.brown, roughness: 0.4 }),
        count
      );

      const pinkTrees = this.floweringTrees.filter((t) => t.blossomKey === 'pink');
      const yellowTrees = this.floweringTrees.filter((t) => t.blossomKey !== 'pink');

      const canopyGeo = new THREE.BoxGeometry(3.2, 2.8, 3.2);
      canopyGeo.translate(0, 3.4, 0);

      const dummy = new THREE.Object3D();
      this.floweringTrees.forEach((t, i) => {
        dummy.position.set(t.x, t.y, t.z);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);
      });
      trunkInst.instanceMatrix.needsUpdate = true;
      scene.add(trunkInst);

      if (pinkTrees.length > 0) {
        const pinkInst = new THREE.InstancedMesh(
          canopyGeo,
          new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.32 }),
          pinkTrees.length
        );
        pinkInst.castShadow = true;
        pinkTrees.forEach((t, i) => {
          dummy.position.set(t.x, t.y, t.z);
          dummy.scale.setScalar(t.scale);
          dummy.updateMatrix();
          pinkInst.setMatrixAt(i, dummy.matrix);
        });
        pinkInst.instanceMatrix.needsUpdate = true;
        scene.add(pinkInst);
      }

      if (yellowTrees.length > 0) {
        const yellowInst = new THREE.InstancedMesh(
          canopyGeo,
          new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.32 }),
          yellowTrees.length
        );
        yellowInst.castShadow = true;
        yellowTrees.forEach((t, i) => {
          dummy.position.set(t.x, t.y, t.z);
          dummy.scale.setScalar(t.scale);
          dummy.updateMatrix();
          yellowInst.setMatrixAt(i, dummy.matrix);
        });
        yellowInst.instanceMatrix.needsUpdate = true;
        scene.add(yellowInst);
      }
    }
  }
}

/**
 * Constrói telhado de duas águas LEGO (em degraus piramidais escalonados + cumeeira + beiral)
 */
export function addPitchedGableRoof(batcher, roofKey, x, yTop, z, w, d, roofHeight = 3.2, ridgeAlongX = true) {
  const steps = 4;
  const stepH = roofHeight / steps;
  for (let i = 0; i < steps; i++) {
    const ratio = 1.0 - (i / steps) * 0.76;
    const rw = ridgeAlongX ? w + 1.2 : (w + 1.4) * ratio;
    const rd = ridgeAlongX ? (d + 1.4) * ratio : d + 1.2;
    batcher.addBox(roofKey, rw, stepH, rd, x, yTop + i * stepH + stepH * 0.5, z);
  }
  // Cumeeira superior e beiral branco
  batcher.addBox('trim_white', w + 1.5, 0.28, d + 1.5, x, yTop + 0.14, z);
}

/**
 * Adiciona janelas emolduradas com venezianas laterais (Shutters) na fachada
 */
function addFramedWindow(batcher, x, y, z, w, h, facingDirZ, shutterKey = 'shutter_blue', warm = true) {
  const zOff = facingDirZ * 0.14;
  batcher.addBox('trim_white', w + 0.36, h + 0.36, 0.22, x, y, z + zOff);
  batcher.addBox(warm ? 'window_warm' : 'window_glass', w, h, 0.26, x, y, z + zOff * 1.15);
  if (shutterKey) {
    batcher.addBox(shutterKey, 0.36, h + 0.1, 0.26, x - w * 0.5 - 0.24, y, z + zOff * 1.1);
    batcher.addBox(shutterKey, 0.36, h + 0.1, 0.26, x + w * 0.5 + 0.24, y, z + zOff * 1.1);
  }
}

/**
 * Adiciona Portão de Garagem seccional com frisos horizontais
 */
function addGarageDoor(batcher, x, yBase, z, w, h, facingDirZ, isWood = false) {
  const zOff = facingDirZ * 0.14;
  batcher.addBox('trim_white', w + 0.5, h + 0.3, 0.24, x, yBase + h * 0.5, z + zOff);
  batcher.addBox(isWood ? 'wood_warm' : 'wall_lightgrey', w, h, 0.28, x, yBase + h * 0.5, z + zOff * 1.15);
  for (let py = 0.8; py < h - 0.3; py += 0.9) {
    batcher.addBox('trim_white', w - 0.3, 0.12, 0.32, x, yBase + py, z + zOff * 1.25);
  }
}

/**
 * Constrói uma Casa Detalhada de Subúrbio entre os 5 Estilos Arquitetônicos Obrigatórios
 */
export function buildDetailedHouse(world, batcher, cfg) {
  const {
    x,
    z,
    lotW = 28,
    lotD = 44,
    facingDirZ = 1, // +1: frente para rua Sul (+Z); -1: frente para rua Norte (-Z)
    styleKey = 'american_two_story',
    seed = 1
  } = cfg;

  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = baseY + 0.30;
  if (baseY > 0.15) {
    batcher.addBox('stone_grey', lotW - 0.3, 2.4, lotD - 0.3, x, baseY - 0.92, z);
    batcher.addBox('lawn_green', lotW - 0.2, 0.1, lotD - 0.2, x, baseY + 0.28, z);
  }
  const wallEntry = HOUSE_WALL_PALETTE[Math.floor(Math.random() * HOUSE_WALL_PALETTE.length)];
  const roofEntry = HOUSE_ROOF_PALETTE[Math.floor(Math.random() * HOUSE_ROOF_PALETTE.length)];
  const shutterKey = Math.random() < 0.5 ? 'shutter_blue' : 'shutter_green';

  const frontEdgeZ = z + facingDirZ * (lotD * 0.5);
  const backEdgeZ = z - facingDirZ * (lotD * 0.5);
  // Posiciona a casa bem próxima da calçada da rua (~2.2m da borda) para que os quarteirões fiquem bem colados e cheios!
  const houseZ = frontEdgeZ - facingDirZ * Math.min(9.6, lotD * 0.36);
  const backyardZ = backEdgeZ + facingDirZ * Math.min(4.8, lotD * 0.22);

  if (styleKey === 'american_two_story') {
    // 1. SOBRADO AMERICANO CLÁSSICO (2 Andares + Garagem Acoplada + Varanda + Chaminé)
    const mainW = Math.min(14, lotW * 0.52);
    const mainD = 13;
    const mainH = 9.2;
    const garW = Math.min(9.5, lotW * 0.34);
    const garD = 10.5;
    const garH = 4.8;

    const mainX = x - garW * 0.45;
    const garX = x + mainW * 0.52;

    // Corpo 2 Andares + Telhado Triangular + Chaminé de Tijolos
    batcher.addBox(wallEntry.key, mainW, mainH, mainD, mainX, yBase + mainH * 0.5, houseZ);
    addPitchedGableRoof(batcher, roofEntry.key, mainX, yBase + mainH, houseZ, mainW, mainD, 3.4, true);
    batcher.addBox('chimney_brick', 1.5, 4.5, 1.5, mainX - mainW * 0.35, yBase + mainH + 2.2, houseZ - facingDirZ * 2.0);
    batcher.addBox('trim_white', 1.8, 0.3, 1.8, mainX - mainW * 0.35, yBase + mainH + 4.5, houseZ - facingDirZ * 2.0);

    // Garagem acoplada + Rampa Driveway até a rua
    batcher.addBox(wallEntry.key, garW, garH, garD, garX, yBase + garH * 0.5, houseZ + facingDirZ * 0.8);
    addPitchedGableRoof(batcher, roofEntry.key, garX, yBase + garH, houseZ + facingDirZ * 0.8, garW, garD, 2.0, true);
    addGarageDoor(batcher, garX, yBase, houseZ + facingDirZ * (0.8 + garD * 0.5), garW - 1.6, 3.6, facingDirZ, Math.random() < 0.5);

    const driveLen = Math.abs(frontEdgeZ - (houseZ + facingDirZ * (0.8 + garD * 0.5))) + 4.2;
    const driveCenterZ = (frontEdgeZ + facingDirZ * 4.0 + houseZ + facingDirZ * (0.8 + garD * 0.5)) * 0.5;
    batcher.addBox('driveway_concrete', garW - 1.0, 0.08, driveLen, garX, yBase + 0.02, driveCenterZ);

    // Varanda frontal coberta com pilastras brancas + Porta + Caminho de Pedras
    const porchZ = houseZ + facingDirZ * (mainD * 0.5 + 1.4);
    batcher.addBox('walkway_stone', mainW - 1.0, 0.4, 2.8, mainX, yBase + 0.2, porchZ);
    batcher.addBox(roofEntry.key, mainW - 0.6, 0.45, 3.2, mainX, yBase + 4.1, porchZ);
    for (const px of [mainX - mainW * 0.38, mainX + mainW * 0.38]) {
      batcher.addBox('trim_white', 0.42, 3.8, 0.42, px, yBase + 2.0, porchZ + facingDirZ * 1.1);
    }

    // Porta principal e janelas do 1º e 2º andar
    const fZ = houseZ + facingDirZ * (mainD * 0.5);
    batcher.addBox('wood_warm', 1.6, 2.9, 0.3, mainX - 1.8, yBase + 1.5, fZ + facingDirZ * 0.12);
    addFramedWindow(batcher, mainX + 2.2, yBase + 2.2, fZ, 2.4, 1.8, facingDirZ, shutterKey, true);
    addFramedWindow(batcher, mainX - 2.4, yBase + 6.4, fZ, 2.2, 1.7, facingDirZ, shutterKey, false);
    addFramedWindow(batcher, mainX + 2.4, yBase + 6.4, fZ, 2.2, 1.7, facingDirZ, shutterKey, true);

    // Caminho de blocos/pedras da calçada até a porta
    const walkLen = Math.abs(frontEdgeZ - porchZ);
    batcher.addBox('walkway_stone', 1.8, 0.08, walkLen, mainX - 1.8, yBase + 0.03, (frontEdgeZ + porchZ) * 0.5);

    world.addCollider(x, houseZ, mainW + garW, mainD, yBase + mainH + 3.0, yBase);
    world.mapBuildings.push({ x, z: houseZ, w: mainW + garW, d: mainD, height: mainH, color: wallEntry.mapColor });
  } else if (styleKey === 'ranch_l_shape') {
    // 2. CASA TÉRREA LARGA EM FORMATO DE "L" (Ranch House + Telhado Cruzado + Canteiros de Flores)
    const wingW = Math.min(22, lotW - 4);
    const wingD = 10.5;
    const wingH = 5.4;
    const fwdW = Math.min(10, wingW * 0.44);
    const fwdD = 8.5;
    const garX = x - wingW * 0.5 + fwdW * 0.5;
    const mainZ = houseZ - facingDirZ * 1.5;
    const fwdZ = mainZ + facingDirZ * ((wingD + fwdD) * 0.5 - 1.0);

    batcher.addBox(wallEntry.key, wingW, wingH, wingD, x, yBase + wingH * 0.5, mainZ);
    addPitchedGableRoof(batcher, roofEntry.key, x, yBase + wingH, mainZ, wingW, wingD, 2.5, true);

    batcher.addBox(wallEntry.key, fwdW, wingH, fwdD, garX, yBase + wingH * 0.5, fwdZ);
    addPitchedGableRoof(batcher, roofEntry.key, garX, yBase + wingH, fwdZ, fwdW, fwdD, 2.4, false);

    // Garagem dupla na ponta do "L" + Rampa Driveway
    addGarageDoor(batcher, garX, yBase, fwdZ + facingDirZ * (fwdD * 0.5), fwdW - 1.6, 3.6, facingDirZ, Math.random() < 0.5);
    const garFrontZ = fwdZ + facingDirZ * (fwdD * 0.5);
    batcher.addBox(
      'driveway_concrete',
      fwdW - 1.0,
      0.08,
      Math.abs(frontEdgeZ - garFrontZ) + 4.0,
      garX,
      yBase + 0.02,
      (frontEdgeZ + facingDirZ * 3.8 + garFrontZ) * 0.5
    );

    // Janelões frontais iluminados + Canteiros de flores sob as janelas
    const rightCenterX = x + fwdW * 0.45;
    const fZ = mainZ + facingDirZ * (wingD * 0.5);
    addFramedWindow(batcher, rightCenterX + 1.8, yBase + 2.6, fZ, 3.8, 2.0, facingDirZ, shutterKey, true);
    batcher.addBox('wood_warm', 1.6, 2.9, 0.3, rightCenterX - 2.2, yBase + 1.5, fZ + facingDirZ * 0.12);
    batcher.addBox('walkway_stone', 1.8, 0.08, Math.abs(frontEdgeZ - fZ), rightCenterX - 2.2, yBase + 0.03, (frontEdgeZ + fZ) * 0.5);

    // Canteiros de flores LEGO sob o janelão
    batcher.addBox('hedge_green', 4.2, 0.55, 1.0, rightCenterX + 1.8, yBase + 0.28, fZ + facingDirZ * 0.65);
    batcher.addBox('flower_red', 1.0, 0.35, 0.5, rightCenterX + 0.8, yBase + 0.68, fZ + facingDirZ * 0.65);
    batcher.addBox('flower_yellow', 1.0, 0.35, 0.5, rightCenterX + 2.8, yBase + 0.68, fZ + facingDirZ * 0.65);

    world.addCollider(x, houseZ, wingW, wingD + fwdD * 0.6, yBase + wingH + 2.4, yBase);
    world.mapBuildings.push({ x, z: mainZ, w: wingW, d: wingD, height: wingH, color: wallEntry.mapColor });
  } else if (styleKey === 'suburb_mansion_pool') {
    // 3. MANSÃO DE SUBÚRBIO COM PISCINA NO QUINTAL (2 Andares + Colunas + Sacada + Piscina Azul Brilhante)
    const manW = Math.min(22, lotW - 5);
    const manD = 14;
    const manH = 10.4;

    batcher.addBox(wallEntry.key, manW, manH, manD, x, yBase + manH * 0.5, houseZ);
    addPitchedGableRoof(batcher, roofEntry.key, x, yBase + manH, houseZ, manW, manD, 3.4, true);

    const fZ = houseZ + facingDirZ * (manD * 0.5);
    // Pórtico Clássico com Colunas e Sacada no 2º Andar
    batcher.addBox('trim_white', 7.2, 0.45, 3.0, x, yBase + 5.2, fZ + facingDirZ * 1.4);
    batcher.addBox('trim_white', 7.0, 0.85, 0.25, x, yBase + 5.8, fZ + facingDirZ * 2.75); // Guarda-corpo da sacada
    for (const cx of [x - 2.8, x + 2.8]) {
      batcher.addBox('trim_white', 0.55, 5.0, 0.55, cx, yBase + 2.5, fZ + facingDirZ * 2.5);
    }

    batcher.addBox('wood_warm', 2.2, 3.4, 0.3, x, yBase + 1.7, fZ + facingDirZ * 0.14);
    addFramedWindow(batcher, x - 6.2, yBase + 2.6, fZ, 3.2, 2.2, facingDirZ, shutterKey, true);
    addFramedWindow(batcher, x + 6.2, yBase + 2.6, fZ, 3.2, 2.2, facingDirZ, shutterKey, true);
    addFramedWindow(batcher, x - 6.2, yBase + 7.4, fZ, 3.0, 2.0, facingDirZ, shutterKey, false);
    addFramedWindow(batcher, x, yBase + 7.4, fZ, 3.4, 2.2, facingDirZ, null, true);
    addFramedWindow(batcher, x + 6.2, yBase + 7.4, fZ, 3.0, 2.0, facingDirZ, shutterKey, false);

    // Driveway Circular / Lateral e Caminho Nobre
    batcher.addBox('driveway_concrete', 5.0, 0.08, Math.abs(frontEdgeZ - fZ) + 4.0, x + manW * 0.32, yBase + 0.02, (frontEdgeZ + facingDirZ * 3.8 + fZ) * 0.5);
    batcher.addBox('walkway_stone', 2.8, 0.08, Math.abs(frontEdgeZ - fZ), x, yBase + 0.03, (frontEdgeZ + fZ) * 0.5);

    // PISCINA AZUL BRILHANTE NO QUINTAL DOS FUNDOS + Borda Branca + Espreguiçadeiras + Guarda-Sol!
    const poolW = Math.min(13, lotW * 0.52);
    const poolD = 7.2;
    batcher.addBox('trim_white', poolW + 2.2, 0.18, poolD + 2.2, x, yBase + 0.09, backyardZ);
    batcher.addBox('pool_water', poolW, 0.24, poolD, x, yBase + 0.15, backyardZ);
    // 2 Espreguiçadeiras + Guarda-sol ao lado da piscina
    const sunbedX = x - poolW * 0.5 - 2.2;
    batcher.addBox('trim_white', 1.2, 0.35, 2.4, sunbedX, yBase + 0.22, backyardZ - 1.4);
    batcher.addBox('trim_white', 1.2, 0.35, 2.4, sunbedX, yBase + 0.22, backyardZ + 1.4);
    batcher.addBox('trim_white', 0.2, 2.4, 0.2, sunbedX, yBase + 1.2, backyardZ);
    batcher.addBox('flower_red', 2.6, 0.4, 2.6, sunbedX, yBase + 2.4, backyardZ);

    world.addCollider(x, houseZ, manW, manD, yBase + manH + 3.2, yBase);
    world.mapBuildings.push({ x, z: houseZ, w: manW, d: manD, height: manH, color: wallEntry.mapColor, label: 'MANSÃO' });
  } else if (styleKey === 'modern_wood_chalet') {
    // 4. CHALÉ MODERNO DE MADEIRA E PEDRA (Telhado Alto + Base de Pedra + Deck de Madeira)
    const chW = Math.min(17, lotW - 5);
    const chD = 12.5;
    const chH = 8.6;

    // Base de pedra cinza no 1º andar + Cor sorteada / Madeira no 2º andar + Telhado sorteado
    batcher.addBox('stone_grey', chW, 3.8, chD, x, yBase + 1.9, houseZ);
    batcher.addBox(wallEntry.key, chW - 0.6, chH - 3.8, chD - 0.6, x, yBase + 3.8 + (chH - 3.8) * 0.5, houseZ);
    addPitchedGableRoof(batcher, roofEntry.key, x, yBase + chH, houseZ, chW + 0.8, chD + 0.8, 4.2, false);
    batcher.addBox('stone_grey', 1.8, chH + 4.8, 1.8, x + chW * 0.36, yBase + (chH + 4.8) * 0.5, houseZ);

    // Deck lateral/frontal de madeira + Garagem integrada
    const fZ = houseZ + facingDirZ * (chD * 0.5);
    batcher.addBox('wood_warm', chW * 0.55, 0.35, 3.2, x - chW * 0.2, yBase + 0.18, fZ + facingDirZ * 1.5);
    addGarageDoor(batcher, x + chW * 0.26, yBase, fZ, 6.2, 3.4, facingDirZ, true);
    batcher.addBox('driveway_concrete', 5.8, 0.08, Math.abs(frontEdgeZ - fZ) + 4.0, x + chW * 0.26, yBase + 0.02, (frontEdgeZ + facingDirZ * 3.8 + fZ) * 0.5);
    batcher.addBox('walkway_stone', 1.8, 0.08, Math.abs(frontEdgeZ - fZ), x - chW * 0.2, yBase + 0.03, (frontEdgeZ + fZ) * 0.5);

    addFramedWindow(batcher, x - chW * 0.22, yBase + 2.3, fZ, 2.8, 1.9, facingDirZ, null, true);
    addFramedWindow(batcher, x, yBase + 6.2, fZ, 4.2, 2.2, facingDirZ, null, true);

    world.addCollider(x, houseZ, chW, chD, yBase + chH + 3.8, yBase);
    world.mapBuildings.push({ x, z: houseZ, w: chW, d: chD, height: chH, color: wallEntry.mapColor });
  } else if (styleKey === 'townhouses') {
    // 5. TOWNHOUSES / SOBRADOS GEMINADOS (Fileira de 3 a 4 Sobrados de 3 Andares colados parede com parede)
    const count = lotW >= 36 ? 4 : 3;
    const totalW = lotW - 2.0;
    const unitW = totalW / count;
    const thD = 14.5;

    for (let i = 0; i < count; i++) {
      const ux = x - totalW * 0.5 + (i + 0.5) * unitW;
      const thH = 13.0 + Math.floor(Math.random() * 4) * 1.1;
      const uWall = HOUSE_WALL_PALETTE[Math.floor(Math.random() * HOUSE_WALL_PALETTE.length)];
      const uRoof = HOUSE_ROOF_PALETTE[Math.floor(Math.random() * HOUSE_ROOF_PALETTE.length)];

      batcher.addBox(uWall.key, unitW - 0.15, thH, thD, ux, yBase + thH * 0.5, houseZ);
      // Cornija clássica no topo do sobrado
      batcher.addBox('trim_white', unitW + 0.2, 0.7, thD + 0.6, ux, yBase + thH + 0.35, houseZ);
      batcher.addBox(uRoof.key, unitW - 0.6, 0.5, thD - 0.6, ux, yBase + thH + 0.75, houseZ);

      // Escadinha frontal individual (Stoop estilo NY/Brooklyn) + Porta Clássica
      const fZ = houseZ + facingDirZ * (thD * 0.5);
      const stoopX = ux - unitW * 0.22;
      batcher.addBox('stone_grey', 2.2, 1.1, 2.4, stoopX, yBase + 0.55, fZ + facingDirZ * 1.2);
      batcher.addBox('stone_grey', 2.2, 0.55, 1.2, stoopX, yBase + 0.28, fZ + facingDirZ * 2.8);
      batcher.addBox('wood_warm', 1.4, 2.8, 0.3, stoopX, yBase + 2.4, fZ + facingDirZ * 0.14);
      batcher.addBox('walkway_stone', 2.0, 0.08, Math.abs(frontEdgeZ - fZ), stoopX, yBase + 0.03, (frontEdgeZ + fZ) * 0.5);

      // Janelas alinhadas nos 3 andares
      const winX = ux + unitW * 0.2;
      addFramedWindow(batcher, winX, yBase + 2.5, fZ, 2.0, 1.8, facingDirZ, null, i % 2 === 0);
      addFramedWindow(batcher, ux - unitW * 0.2, yBase + 6.8, fZ, 1.8, 1.8, facingDirZ, null, true);
      addFramedWindow(batcher, winX, yBase + 6.8, fZ, 1.8, 1.8, facingDirZ, null, false);
      addFramedWindow(batcher, ux - unitW * 0.2, yBase + 10.8, fZ, 1.8, 1.7, facingDirZ, null, false);
      addFramedWindow(batcher, winX, yBase + 10.8, fZ, 1.8, 1.7, facingDirZ, null, true);
    }

    world.addCollider(x, houseZ, totalW, thD, yBase + 16.0, yBase);
    world.mapBuildings.push({ x, z: houseZ, w: totalW, d: thD, height: 14.5, color: '#ea580c' });
  }

  // ============================================================================
  // DETALHES DE QUINTAL E FRENTE DO LOTE (Sebes/Muros, Churrasqueira, Casinha de Cachorro, Caixa de Correio e Cercas Quebráveis)
  // ============================================================================
  // Sebes divisórias laterais e de fundo do lote
  const fenceKey = seed % 3 === 0 ? 'chimney_brick' : 'hedge_green';
  batcher.addBox(fenceKey, 0.7, 1.25, lotD - 4.0, x - lotW * 0.5, yBase + 0.62, z);
  batcher.addBox(fenceKey, 0.7, 1.25, lotD - 4.0, x + lotW * 0.5, yBase + 0.62, z);
  batcher.addBox(fenceKey, lotW, 1.35, 0.7, x, yBase + 0.67, backEdgeZ);

  // Churrasqueira de tijolos e Casinha de Cachorro nos quintais (exceto onde já há piscina da mansão)
  if (styleKey !== 'suburb_mansion_pool') {
    // Churrasqueira de tijolos
    const bbqX = x - lotW * 0.28;
    batcher.addBox('chimney_brick', 1.8, 1.5, 1.2, bbqX, yBase + 0.75, backyardZ);
    batcher.addBox('charcoal_metal', 1.6, 0.25, 1.0, bbqX, yBase + 1.6, backyardZ);
    batcher.addBox('chimney_brick', 0.7, 1.4, 0.7, bbqX - 0.4, yBase + 2.2, backyardZ);

    // Casinha de cachorro LEGO
    if (seed % 2 === 0) {
      const dogX = x + lotW * 0.26;
      batcher.addBox('wall_cream', 1.6, 1.3, 1.8, dogX, yBase + 0.65, backyardZ + facingDirZ * 1.5);
      batcher.addBox('roof_red', 1.9, 0.55, 2.1, dogX, yBase + 1.5, backyardZ + facingDirZ * 1.5);
    } else {
      // Mesa de quintal com guarda-sol colorido
      const patX = x + lotW * 0.22;
      batcher.addBox('trim_white', 2.2, 0.9, 2.2, patX, yBase + 0.45, backyardZ);
      batcher.addBox('trim_white', 0.22, 2.3, 0.22, patX, yBase + 1.4, backyardZ);
      batcher.addBox(seed % 4 === 1 ? 'flower_yellow' : 'flower_pink', 2.8, 0.45, 2.8, patX, yBase + 2.5, backyardZ);
    }
  }

  // Árvore residencial na frente do lote (alternando Árvore Verde e Árvore Florida Cerejeira/Ipê)
  const treeX = x - lotW * 0.32;
  const treeZ = frontEdgeZ - facingDirZ * 2.6;
  if (seed % 2 === 0) {
    batcher.addFloweringTree(treeX, yBase, treeZ, 0.95 + (seed % 3) * 0.12, seed % 4 === 0 ? 'pink' : 'yellow');
  } else {
    world._addLegoTree(treeX, yBase, treeZ, 1.0);
  }

  // Objetos na Calçada/Frente da Casa (Caixa de Correio Colorida + Cerca Branca LEGO)
  const isNearActionZone = Math.abs(x) <= 360 && z >= -790 && z <= -530;
  if (world.destructibles && isNearActionZone && seed % 2 === 0) {
    spawnBreakableMailbox(world, x + 2.2, frontEdgeZ + facingDirZ * 1.2, seed);
    spawnBreakableWhiteFence(world, x - lotW * 0.26, frontEdgeZ - facingDirZ * 0.4, 5.2);
  } else {
    // Nos quarteirões mais distantes, desenha a mesma Cerca Branca e Caixa de Correio mescladas em 0 Draw Calls!
    const mbX = x + 2.2;
    const mbZ = frontEdgeZ + facingDirZ * 1.2;
    batcher.addBox('trim_white', 0.22, 1.15, 0.22, mbX, yBase + 0.58, mbZ);
    batcher.addBox(seed % 2 === 0 ? 'court_blue' : 'flower_red', 0.58, 0.48, 0.78, mbX, yBase + 1.25, mbZ);

    const fX = x - lotW * 0.26;
    const fZ = frontEdgeZ - facingDirZ * 0.4;
    batcher.addBox('trim_white', 5.2, 0.18, 0.22, fX, yBase + 0.85, fZ);
    batcher.addBox('trim_white', 5.2, 0.18, 0.22, fX, yBase + 0.42, fZ);
    batcher.addBox('trim_white', 0.24, 1.1, 0.26, fX - 2.4, yBase + 0.55, fZ);
    batcher.addBox('trim_white', 0.24, 1.1, 0.26, fX, yBase + 0.55, fZ);
    batcher.addBox('trim_white', 0.24, 1.1, 0.26, fX + 2.4, yBase + 0.55, fZ);
  }
}

const SHARED_FENCE_MAT = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
const SHARED_MAILBOX_MATS = [
  new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.28 }),
  new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.28 }),
  new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.28 }),
  new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.28 })
];

/**
 * Cria uma Cerca Branca de LEGO quebrável em 1 único Mesh otimizado
 */
export function spawnBreakableWhiteFence(world, x, z, width = 5.2) {
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = baseY + 0.28;
  const geos = [
    makeTranslatedBox(width, 0.18, 0.22, 0, 0.85, 0),
    makeTranslatedBox(width, 0.18, 0.22, 0, 0.42, 0)
  ];
  const posts = Math.max(3, Math.floor(width / 1.1));
  for (let i = 0; i < posts; i++) {
    const px = -width * 0.5 + (i / (posts - 1)) * width;
    geos.push(makeTranslatedBox(0.24, 1.1, 0.26, px, 0.55, 0));
  }
  const mesh = new THREE.Mesh(mergeBufferGeometries(geos), SHARED_FENCE_MAT);
  mesh.position.set(x, yBase, z);
  mesh.receiveShadow = true;
  world.scene.add(mesh);

  const col = world.addCollider(x, z, width, 0.45, yBase + 1.1, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh,
      type: 'fence',
      hp: 10,
      radius: width * 0.45,
      height: 1.1,
      colliders: [col],
      debrisColors: [LEGO_COLORS.white, LEGO_COLORS.lightGrey],
      studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 },
      groundY: yBase
    });
  }
}

/**
 * Cria uma Caixa de Correio colorida quebrável na calçada da casa em 1 único Mesh
 */
export function spawnBreakableMailbox(world, x, z, seed = 0) {
  const baseY = world.getTerrainHeightAt ? world.getTerrainHeightAt(x, z) : 0;
  const yBase = baseY + 0.28;
  const geos = [
    makeTranslatedBox(0.22, 1.15, 0.22, 0, 0.58, 0),
    makeTranslatedBox(0.58, 0.48, 0.78, 0, 1.25, 0)
  ];
  const mat = SHARED_MAILBOX_MATS[seed % SHARED_MAILBOX_MATS.length];
  const mesh = new THREE.Mesh(mergeBufferGeometries(geos), mat);
  mesh.position.set(x, yBase, z);
  world.scene.add(mesh);

  const col = world.addCollider(x, z, 0.65, 0.75, yBase + 1.5, yBase);
  if (world.destructibles) {
    world.destructibles.registerDestructible({
      mesh,
      type: 'mailbox',
      hp: 8,
      radius: 0.75,
      height: 1.5,
      colliders: [col],
      debrisColors: [LEGO_COLORS.blue, LEGO_COLORS.red, LEGO_COLORS.white, LEGO_COLORS.yellow],
      studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 },
      groundY: yBase
    });
  }
}
