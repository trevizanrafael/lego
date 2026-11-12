import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from './BuildingGenerator.js';
import { getMetroCutoutFloorY } from './MetroSystemBuilder.js';

export {
  VEHICLE_SPECS,
  KMH_TO_UNITS,
  UNITS_TO_KMH,
  buildParkedLegoCars,
  createLegoCarMesh
} from './VehicleFleetBuilder.js';

// ============================================================================
// CATÁLOGO DE GEOMETRIAS PRÉ-MESCLADAS COMPARTILHADAS (60 FPS CRAVADOS PARA ~450 PROPS!)
// ============================================================================
let SHARED_TEMPLATES = null;

function makeStudsGridGeo(w, d, yCenter, step = 0.55) {
  const geos = [];
  const nx = Math.max(1, Math.floor(w / step));
  const nz = Math.max(1, Math.floor(d / step));
  const startX = -((nx - 1) * step) * 0.5;
  const startZ = -((nz - 1) * step) * 0.5;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const g = SHARED_STUD_GEO.clone();
      g.translate(startX + ix * step, yCenter, startZ + iz * step);
      geos.push(g);
    }
  }
  return mergeBufferGeometries(geos);
}

function getSharedTemplates() {
  if (SHARED_TEMPLATES) return SHARED_TEMPLATES;

  // Materiais LEGO compartilhados (reutilizados por todas as 450 instâncias!)
  const mats = {
    darkGrey: getLegoMaterial(LEGO_COLORS.darkGrey),
    charcoal: getLegoMaterial(LEGO_COLORS.charcoal),
    lightGrey: getLegoMaterial(LEGO_COLORS.lightGrey),
    silver: getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.48, roughness: 0.2 }),
    white: getLegoMaterial(LEGO_COLORS.white),
    red: getLegoMaterial(LEGO_COLORS.red),
    blue: getLegoMaterial(LEGO_COLORS.blue),
    yellow: getLegoMaterial(LEGO_COLORS.yellow),
    orange: getLegoMaterial(LEGO_COLORS.orange),
    green: getLegoMaterial(LEGO_COLORS.green),
    tan: getLegoMaterial(LEGO_COLORS.tan),
    brown: getLegoMaterial(LEGO_COLORS.brown),
    cyan: getLegoMaterial(0x06b6d4),
    pink: getLegoMaterial(0xf472b6),
    gold: getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.65, roughness: 0.18 }),
    blueGlass: getLegoMaterial(0x38bdf8, {
      transparent: true,
      opacity: 0.52,
      roughness: 0.08,
      clearcoat: 0.9
    }),
    warmBulb: getLegoMaterial(0xfef08a, { emissive: 0xfde047, emissiveIntensity: 0.9 }),
    tlRed: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    tlYellow: new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    tlGreen: new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    atmScreen: new THREE.MeshBasicMaterial({ color: 0x00f0ff })
  };

  // 1. POSTE DE LUZ LEGO (streetlamp)
  const lampPoleParts = [
    makeTranslatedBox(0.72, 0.3, 0.72, 0, 0.15, 0),
    makeStudsGridGeo(0.65, 0.65, 0.34, 0.36),
    (() => {
      const c = new THREE.CylinderGeometry(0.11, 0.14, 5.1, 8);
      c.translate(0, 2.7, 0);
      return c;
    })(),
    makeTranslatedBox(0.22, 0.22, 1.45, 0, 5.25, 0.52)
  ];
  const lampPoleGeo = mergeBufferGeometries(lampPoleParts);
  const lampBulbGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.24, 10);
  lampBulbGeo.translate(0, 5.08, 1.02);

  // 2. SEMÁFORO LEGO (traffic_light)
  const tlFrameGeo = mergeBufferGeometries([
    makeTranslatedBox(0.76, 0.3, 0.76, 0, 0.15, 0),
    (() => {
      const c = new THREE.CylinderGeometry(0.13, 0.16, 5.8, 8);
      c.translate(0, 3.05, 0);
      return c;
    })(),
    makeTranslatedBox(0.22, 0.22, 3.2, 0, 5.75, 1.45)
  ]);
  const tlHousingGeo = mergeBufferGeometries([
    makeTranslatedBox(0.52, 1.38, 0.46, 0, 5.45, 2.75),
    makeTranslatedBox(0.46, 1.15, 0.42, 0, 3.55, 0.28)
  ]);
  const tlLensRedGeo = makeTranslatedBox(0.56, 0.26, 0.26, 0, 5.86, 2.75);
  const tlLensYelGeo = makeTranslatedBox(0.56, 0.26, 0.26, 0, 5.45, 2.75);
  const tlLensGrnGeo = makeTranslatedBox(0.56, 0.26, 0.26, 0, 5.04, 2.75);

  // 3. HIDRANTE VERMELHO LEGO (hydrant)
  const hydRedGeo = mergeBufferGeometries([
    (() => {
      const b = new THREE.CylinderGeometry(0.26, 0.31, 0.92, 10);
      b.translate(0, 0.46, 0);
      return b;
    })(),
    (() => {
      const top = SHARED_STUD_GEO.clone();
      top.translate(0, 1.12, 0);
      return top;
    })()
  ]);
  const hydSilverGeo = mergeBufferGeometries([
    (() => {
      const cap = new THREE.CylinderGeometry(0.29, 0.29, 0.18, 10);
      cap.translate(0, 0.98, 0);
      return cap;
    })(),
    (() => {
      const noz = new THREE.CylinderGeometry(0.1, 0.1, 0.76, 8);
      noz.rotateZ(Math.PI / 2);
      noz.translate(0, 0.62, 0);
      return noz;
    })()
  ]);

  // 4. PONTO DE ÔNIBUS COM VIDRO AZUL (bus_stop)
  const busFrameGeo = mergeBufferGeometries([
    makeTranslatedBox(3.8, 0.16, 1.8, 0, 0.08, 0),
    makeTranslatedBox(0.18, 2.55, 0.18, -1.75, 1.35, -0.75),
    makeTranslatedBox(0.18, 2.55, 0.18, 1.75, 1.35, -0.75),
    makeTranslatedBox(0.18, 2.55, 0.18, -1.75, 1.35, 0.72),
    makeTranslatedBox(0.18, 2.55, 0.18, 1.75, 1.35, 0.72),
    makeTranslatedBox(0.14, 2.8, 0.14, 2.15, 1.4, 0.65)
  ]);
  const busRoofGeo = mergeBufferGeometries([
    makeTranslatedBox(4.1, 0.28, 2.05, 0, 2.72, 0),
    makeStudsGridGeo(3.8, 1.8, 2.9, 0.65),
    makeTranslatedBox(0.68, 0.72, 0.14, 2.15, 2.55, 0.65)
  ]);
  const busGlassGeo = mergeBufferGeometries([
    makeTranslatedBox(3.35, 2.15, 0.08, 0, 1.38, -0.75),
    makeTranslatedBox(0.08, 2.15, 1.32, -1.75, 1.38, 0)
  ]);
  const busBenchGeo = makeTranslatedBox(2.4, 0.32, 0.52, 0, 0.52, -0.35);

  // 5. CABINE TELEFÔNICA LEGO (phone_booth)
  const boothBodyGeo = mergeBufferGeometries([
    makeTranslatedBox(1.28, 0.2, 1.28, 0, 0.1, 0),
    makeTranslatedBox(0.16, 2.35, 0.16, -0.54, 1.28, -0.54),
    makeTranslatedBox(0.16, 2.35, 0.16, 0.54, 1.28, -0.54),
    makeTranslatedBox(0.16, 2.35, 0.16, -0.54, 1.28, 0.54),
    makeTranslatedBox(0.16, 2.35, 0.16, 0.54, 1.28, 0.54),
    makeTranslatedBox(1.36, 0.34, 1.36, 0, 2.58, 0),
    makeStudsGridGeo(1.15, 1.15, 2.79, 0.48)
  ]);
  const boothGlassGeo = mergeBufferGeometries([
    makeTranslatedBox(0.95, 1.95, 0.07, 0, 1.28, -0.52),
    makeTranslatedBox(0.07, 1.95, 0.95, -0.52, 1.28, 0),
    makeTranslatedBox(0.07, 1.95, 0.95, 0.52, 1.28, 0)
  ]);
  const boothInnerGeo = makeTranslatedBox(0.45, 0.58, 0.28, 0, 1.42, -0.32);

  // 6. BANCA DE JORNAL LEGO (newsstand)
  const standCounterGeo = mergeBufferGeometries([
    makeTranslatedBox(2.8, 1.08, 1.75, 0, 0.54, 0),
    makeTranslatedBox(2.8, 1.18, 0.42, 0, 1.64, -0.64),
    makeStudsGridGeo(2.5, 1.4, 1.12, 0.6)
  ]);
  const standAwningGeo = mergeBufferGeometries([
    makeTranslatedBox(3.15, 0.36, 2.1, 0, 2.36, 0.06),
    makeStudsGridGeo(2.9, 1.85, 2.58, 0.62)
  ]);
  const standMagazinesGeo = mergeBufferGeometries([
    makeTranslatedBox(0.65, 0.55, 0.12, -0.8, 1.62, -0.38),
    makeTranslatedBox(0.65, 0.55, 0.12, 0, 1.62, -0.38),
    makeTranslatedBox(0.65, 0.55, 0.12, 0.8, 1.62, -0.38)
  ]);

  // 7. CAIXA ELETRÔNICO LEGO (atm_machine — Jorram muitos Studs Dourados & Azuis!)
  const atmBodyGeo = mergeBufferGeometries([
    makeTranslatedBox(1.36, 2.25, 1.05, 0, 1.125, 0),
    makeTranslatedBox(1.44, 0.34, 1.16, 0, 2.36, 0.04),
    makeStudsGridGeo(1.2, 0.95, 2.57, 0.48)
  ]);
  const atmGoldTrimGeo = mergeBufferGeometries([
    makeTranslatedBox(1.48, 0.24, 0.22, 0, 2.12, 0.52),
    makeTranslatedBox(0.92, 0.16, 0.28, 0, 1.06, 0.54)
  ]);
  const atmScreenGeo = makeTranslatedBox(0.84, 0.62, 0.08, 0, 1.56, 0.53);

  // 8. CARRINHO DE LANCHES / PIPOCA / SORVETE (food_cart)
  const cartBodyGeo = mergeBufferGeometries([
    makeTranslatedBox(1.85, 1.02, 1.12, 0, 0.72, 0),
    makeTranslatedBox(0.1, 1.18, 0.1, -0.82, 1.78, -0.46),
    makeTranslatedBox(0.1, 1.18, 0.1, 0.82, 1.78, -0.46),
    makeTranslatedBox(0.1, 1.18, 0.1, -0.82, 1.78, 0.46),
    makeTranslatedBox(0.1, 1.18, 0.1, 0.82, 1.78, 0.46)
  ]);
  const cartCanopyGeo = mergeBufferGeometries([
    makeTranslatedBox(2.12, 0.28, 1.38, 0, 2.42, 0),
    makeStudsGridGeo(1.9, 1.15, 2.6, 0.55)
  ]);
  const cartWheelsGeo = mergeBufferGeometries([
    (() => {
      const w1 = new THREE.CylinderGeometry(0.34, 0.34, 0.18, 12);
      w1.rotateX(Math.PI / 2);
      w1.translate(-0.42, 0.34, 0.62);
      return w1;
    })(),
    (() => {
      const w2 = new THREE.CylinderGeometry(0.34, 0.34, 0.18, 12);
      w2.rotateX(Math.PI / 2);
      w2.translate(-0.42, 0.34, -0.62);
      return w2;
    })(),
    makeTranslatedBox(0.38, 0.08, 0.92, 1.08, 0.96, 0)
  ]);

  // 9. MESINHA COM GUARDA-SOL E CADEIRAS (cafe_table)
  const cafeWhiteGeo = mergeBufferGeometries([
    (() => {
      const top = new THREE.CylinderGeometry(0.82, 0.82, 0.14, 12);
      top.translate(0, 0.84, 0);
      return top;
    })(),
    (() => {
      const stem = new THREE.CylinderGeometry(0.09, 0.12, 2.55, 8);
      stem.translate(0, 1.28, 0);
      return stem;
    })(),
    // 2 Cadeiras LEGO laterais
    makeTranslatedBox(0.52, 0.46, 0.52, -1.12, 0.23, 0),
    makeTranslatedBox(0.12, 0.52, 0.52, -1.32, 0.72, 0),
    makeTranslatedBox(0.52, 0.46, 0.52, 1.12, 0.23, 0),
    makeTranslatedBox(0.12, 0.52, 0.52, 1.32, 0.72, 0)
  ]);
  const cafeUmbrellaGeo = (() => {
    const cone = new THREE.ConeGeometry(1.48, 0.68, 10);
    cone.translate(0, 2.68, 0);
    const topStud = SHARED_STUD_GEO.clone();
    topStud.translate(0, 3.05, 0);
    return mergeBufferGeometries([cone, topStud]);
  })();

  // 10. LIXEIRA LEGO (trash_can) & CAÇAMBA DE ENTULHO (dumpster)
  const trashBodyGeo = (() => {
    const body = new THREE.CylinderGeometry(0.38, 0.33, 0.96, 10);
    body.translate(0, 0.48, 0);
    return body;
  })();
  const trashLidGeo = mergeBufferGeometries([
    (() => {
      const lid = new THREE.CylinderGeometry(0.41, 0.41, 0.14, 10);
      lid.translate(0, 1.02, 0);
      return lid;
    })(),
    (() => {
      const st = SHARED_STUD_GEO.clone();
      st.translate(0, 1.13, 0);
      return st;
    })()
  ]);

  const dumpsterBodyGeo = mergeBufferGeometries([
    makeTranslatedBox(2.25, 1.28, 1.42, 0, 0.64, 0),
    makeTranslatedBox(2.38, 0.16, 1.52, 0, 1.22, 0),
    makeTranslatedBox(0.12, 0.95, 1.48, -0.68, 0.6, 0),
    makeTranslatedBox(0.12, 0.95, 1.48, 0.68, 0.6, 0)
  ]);
  const dumpsterLidGeo = mergeBufferGeometries([
    makeTranslatedBox(1.06, 0.14, 1.46, -0.55, 1.36, 0),
    makeTranslatedBox(1.06, 0.14, 1.46, 0.55, 1.36, 0),
    makeStudsGridGeo(1.9, 1.1, 1.47, 0.58)
  ]);

  // 11. BANCO DE MADEIRA (park_bench) & PLACA DE TRÂNSITO (street_sign)
  const benchWoodGeo = mergeBufferGeometries([
    makeTranslatedBox(2.15, 0.14, 0.58, 0, 0.48, 0.06),
    makeTranslatedBox(2.15, 0.52, 0.14, 0, 0.82, -0.2),
    makeStudsGridGeo(1.85, 0.42, 0.59, 0.52)
  ]);
  const benchIronGeo = mergeBufferGeometries([
    makeTranslatedBox(0.16, 0.56, 0.62, -0.88, 0.28, 0),
    makeTranslatedBox(0.16, 0.56, 0.62, 0.88, 0.28, 0)
  ]);

  const signPoleGeo = (() => {
    const base = makeTranslatedBox(0.44, 0.16, 0.44, 0, 0.08, 0);
    const pole = new THREE.CylinderGeometry(0.065, 0.075, 2.55, 8);
    pole.translate(0, 1.35, 0);
    return mergeBufferGeometries([base, pole]);
  })();
  const signPlateGeo = makeTranslatedBox(0.78, 0.78, 0.1, 0, 2.48, 0);
  const signBorderGeo = makeTranslatedBox(0.54, 0.22, 0.13, 0, 2.48, 0);

  // 12. CONE LARANJA (traffic_cone) & BARRICADA LARANJA (orange_barricade)
  const coneOrangeGeo = mergeBufferGeometries([
    makeTranslatedBox(0.58, 0.1, 0.58, 0, 0.05, 0),
    (() => {
      const c = new THREE.ConeGeometry(0.24, 0.78, 8);
      c.translate(0, 0.48, 0);
      return c;
    })(),
    (() => {
      const st = SHARED_STUD_GEO.clone();
      st.translate(0, 0.88, 0);
      return st;
    })()
  ]);
  const coneStripeGeo = (() => {
    const s = new THREE.CylinderGeometry(0.14, 0.19, 0.2, 8);
    s.translate(0, 0.45, 0);
    return s;
  })();

  const barricadeOrangeGeo = mergeBufferGeometries([
    makeTranslatedBox(1.95, 0.32, 0.18, 0, 0.86, 0),
    makeTranslatedBox(1.95, 0.24, 0.16, 0, 0.44, 0),
    makeStudsGridGeo(1.65, 0.16, 1.06, 0.55)
  ]);
  const barricadeWhiteGeo = mergeBufferGeometries([
    makeTranslatedBox(0.16, 1.05, 0.58, -0.78, 0.52, 0),
    makeTranslatedBox(0.16, 1.05, 0.58, 0.78, 0.52, 0),
    makeTranslatedBox(0.38, 0.34, 0.2, -0.45, 0.86, 0),
    makeTranslatedBox(0.38, 0.34, 0.2, 0.45, 0.86, 0)
  ]);

  SHARED_TEMPLATES = {
    mats,
    lampPoleGeo,
    lampBulbGeo,
    tlFrameGeo,
    tlHousingGeo,
    tlLensRedGeo,
    tlLensYelGeo,
    tlLensGrnGeo,
    hydRedGeo,
    hydSilverGeo,
    busFrameGeo,
    busRoofGeo,
    busGlassGeo,
    busBenchGeo,
    boothBodyGeo,
    boothGlassGeo,
    boothInnerGeo,
    standCounterGeo,
    standAwningGeo,
    standMagazinesGeo,
    atmBodyGeo,
    atmGoldTrimGeo,
    atmScreenGeo,
    cartBodyGeo,
    cartCanopyGeo,
    cartWheelsGeo,
    cafeWhiteGeo,
    cafeUmbrellaGeo,
    trashBodyGeo,
    trashLidGeo,
    dumpsterBodyGeo,
    dumpsterLidGeo,
    benchWoodGeo,
    benchIronGeo,
    signPoleGeo,
    signPlateGeo,
    signBorderGeo,
    coneOrangeGeo,
    coneStripeGeo,
    barricadeOrangeGeo,
    barricadeWhiteGeo
  };

  return SHARED_TEMPLATES;
}

function makeOptimizedGroup(parts) {
  const g = new THREE.Group();
  g.userData.isOptimizedGroup = true;
  for (let i = 0; i < parts.length; i++) {
    const m = new THREE.Mesh(parts[i].geo, parts[i].mat);
    // Desativa castShadow em props pequenos de calçada para manter 60 FPS cravados na GPU!
    m.castShadow = Boolean(parts[i].shadow === true);
    m.receiveShadow = false;
    g.add(m);
  }
  return g;
}

// ============================================================================
// VALIDAÇÃO ESPACIAL RÁPIDA DE CALÇADAS / PRAÇAS / ACOSTAMENTOS
// ============================================================================
function isProtectedZone(x, z) {
  // Entrada do Super Banco Central
  if (Math.abs(x) < 17 && z > -148 && z < -112) return true;
  // Oficina LEGO Customs (pátio, elevador e portões)
  if (x > 14 && x < 104 && z > -490 && z < -406) return true;
  // Rampa Subterrânea OP-09 da Torre dos Heróis
  if (x > -368 && x < -268 && z > -230 && z < -130) return true;
  // Palco / Pista do Baile Funk na CDD
  if (x > -742 && x < -688 && z > -162 && z < -108) return true;
  // Spawn inicial limpo do jogador
  if (Math.abs(x) < 6 && Math.abs(z + 88) < 6) return true;
  // Píer Oceânico (exceto bordas laterais de quiosques/bancos)
  if (z > 1072 && Math.abs(x) < 36) return true;
  return false;
}

function isInsideAsphaltLane(world, x, z, margin = 0.2) {
  if (!Array.isArray(world.mapRoads)) return false;
  for (let i = 0; i < world.mapRoads.length; i++) {
    const r = world.mapRoads[i];
    const hw = r.w * 0.5 + margin;
    const hd = r.d * 0.5 + margin;
    if (Math.abs(x - r.x) < hw && Math.abs(z - r.z) < hd) {
      return true;
    }
  }
  return false;
}

function hitsExistingCollider(world, x, z, yBase, radius) {
  const r = radius + 0.28;
  const cols = world.getCollidersNear ? world.getCollidersNear(x, z, r) : world.colliders;
  if (!Array.isArray(cols)) return false;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (col.disabled) continue;
    const minY = col.minY ?? 0;
    if (col.maxY <= yBase + 0.35 || minY > yBase + 2.6) continue;
    if (x + r > col.minX && x - r < col.maxX && z + r > col.minZ && z - r < col.maxZ) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// CONSTRUTOR PRINCIPAL: ~450 OBJETOS QUEBRÁVEIS EM TODA A CIDADE A 60 FPS!
// ============================================================================
export function buildStreetProps(world) {
  const T = getSharedTemplates();
  const M = T.mats;
  const placedList = [];

  const getGroundAndSidewalkY = (px, pz, onRoadSurface = false, refY = null) => {
    const baseTerrain =
      refY !== null && world.getSurfaceHeightAt
        ? world.getSurfaceHeightAt(px, pz, refY)
        : world.getTerrainHeightAt
          ? world.getTerrainHeightAt(px, pz)
          : 0;
    return baseTerrain + (onRoadSurface ? 0.04 : 0.28);
  };

  const canPlaceAt = (x, z, radius, yBase, allowRoadEdge = false, minPeerDist = 2.4) => {
    if (getMetroCutoutFloorY(x, z) !== null) return false;
    if (world.isDeepWaterAt?.(x, z, { forCar: true })) return false;
    if (isProtectedZone(x, z)) return false;
    if (!allowRoadEdge && isInsideAsphaltLane(world, x, z, -0.35)) return false;
    if (hitsExistingCollider(world, x, z, yBase, radius)) return false;

    const minSq = minPeerDist * minPeerDist;
    for (let i = 0; i < placedList.length; i++) {
      const p = placedList[i];
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < minSq && Math.abs(p.y - yBase) < 3.0) {
        return false;
      }
    }
    return true;
  };

  const spawnSharedProp = ({
    x,
    z,
    rotY = 0,
    type,
    parts,
    hp,
    radius,
    height,
    colW,
    colD,
    debrisColors,
    studDrops,
    chaosValue = 4,
    onRoadSurface = false,
    allowRoadEdge = false,
    minPeerDist = 2.4,
    refY = null,
    noCollider = false
  }) => {
    const yBase = getGroundAndSidewalkY(x, z, onRoadSurface, refY);
    if (!canPlaceAt(x, z, radius, yBase, allowRoadEdge, minPeerDist)) return false;

    const group = makeOptimizedGroup(parts);
    group.position.set(x, yBase, z);
    group.rotation.y = rotY;
    world.scene.add(group);

    const colliders = [];
    if (!noCollider) {
      const swap = Math.abs(Math.sin(rotY)) > 0.707;
      const cw = swap ? colD : colW;
      const cd = swap ? colW : colD;
      colliders.push(world.addCollider(x, z, cw, cd, yBase + height, yBase));
    }

    placedList.push({ x, y: yBase, z });

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: group,
        type,
        hp,
        radius,
        height,
        colliders,
        debrisColors,
        studDrops,
        groundY: yBase,
        isStreetProp: true,
        chaosValue
      });
    }
    return true;
  };

  // --------------------------------------------------------------------------
  // 1. POSTES DE LUZ (~88) E SEMÁFOROS (~40) AO LONGO DAS GRANDES AVENIDAS
  // --------------------------------------------------------------------------
  const mainAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
  const lampZStops = [-960, -820, -690, -560, -440, -310, -185, -60, 68, 210, 330, 480, 630];

  for (let ia = 0; ia < mainAvenuesX.length; ia++) {
    const ax = mainAvenuesX[ia];
    for (let iz = 0; iz < lampZStops.length; iz++) {
      const lz = lampZStops[iz];
      const side = (ia + iz) % 2 === 0 ? -1 : 1;
      const lx = ax + side * 15.6;
      const rotY = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      spawnSharedProp({
        x: lx,
        z: lz,
        rotY,
        type: 'streetlamp',
        parts: [
          { geo: T.lampPoleGeo, mat: M.darkGrey },
          { geo: T.lampBulbGeo, mat: M.warmBulb, shadow: false }
        ],
        hp: 26,
        radius: 1.0,
        height: 5.3,
        colW: 0.72,
        colD: 0.72,
        debrisColors: [LEGO_COLORS.darkGrey, LEGO_COLORS.lightGrey, LEGO_COLORS.yellow],
        studDrops: { silver: 4, gold: 2, blue: 0, purple: 0 },
        chaosValue: 4
      });
    }
  }

  // Postes extras na Orla da Praia (Z = 726), Rodovia do Aeroporto (Z = -133) e Pontes Leste
  for (let bx = -460; bx <= 460; bx += 76) {
    spawnSharedProp({
      x: bx,
      z: 726.5,
      rotY: Math.PI,
      type: 'streetlamp',
      parts: [
        { geo: T.lampPoleGeo, mat: M.darkGrey },
        { geo: T.lampBulbGeo, mat: M.warmBulb, shadow: false }
      ],
      hp: 26,
      radius: 1.0,
      height: 5.3,
      colW: 0.72,
      colD: 0.72,
      debrisColors: [LEGO_COLORS.darkGrey, LEGO_COLORS.yellow],
      studDrops: { silver: 4, gold: 2, blue: 0, purple: 0 },
      chaosValue: 4
    });
  }
  for (let wx = -1420; wx <= -720; wx += 115) {
    spawnSharedProp({
      x: wx,
      z: -133.0,
      rotY: 0,
      type: 'streetlamp',
      parts: [
        { geo: T.lampPoleGeo, mat: M.darkGrey },
        { geo: T.lampBulbGeo, mat: M.warmBulb, shadow: false }
      ],
      hp: 26,
      radius: 1.0,
      height: 5.3,
      colW: 0.72,
      colD: 0.72,
      debrisColors: [LEGO_COLORS.darkGrey, LEGO_COLORS.yellow],
      studDrops: { silver: 4, gold: 2, blue: 0, purple: 0 },
      chaosValue: 4
    });
  }

  // Semáforos Destrutíveis LEGO nos cruzamentos principais (canto Noroeste -15.6, -15.6)
  const tlIntersectionsZ = [-644, -512, -382, -250, -117, 0, 134, 402, 710];
  for (let ia = 0; ia < mainAvenuesX.length; ia++) {
    for (let iz = 0; iz < tlIntersectionsZ.length; iz++) {
      if ((ia + iz) % 2 !== 0 && iz > 1 && iz < 7) continue;
      const ix = mainAvenuesX[ia] - 15.6;
      const jz = tlIntersectionsZ[iz] - 15.6;
      spawnSharedProp({
        x: ix,
        z: jz,
        rotY: Math.PI / 2,
        type: 'traffic_light',
        parts: [
          { geo: T.tlFrameGeo, mat: M.charcoal },
          { geo: T.tlHousingGeo, mat: M.yellow },
          { geo: T.tlLensRedGeo, mat: M.tlRed, shadow: false },
          { geo: T.tlLensYelGeo, mat: M.tlYellow, shadow: false },
          { geo: T.tlLensGrnGeo, mat: M.tlGreen, shadow: false }
        ],
        hp: 30,
        radius: 1.1,
        height: 5.8,
        colW: 0.76,
        colD: 0.76,
        debrisColors: [LEGO_COLORS.charcoal, LEGO_COLORS.yellow, LEGO_COLORS.red, LEGO_COLORS.green],
        studDrops: { silver: 5, gold: 3, blue: 0, purple: 0 },
        chaosValue: 5
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. HIDRANTES VERMELHOS LEGO NAS ESQUINAS (~52 — Gêiser de 8m por 7s!)
  // --------------------------------------------------------------------------
  const hydrantGridZ = [-908, -776, -644, -512, -382, -250, -117, 0, 134, 402, 710];
  for (let ia = 0; ia < mainAvenuesX.length; ia++) {
    for (let iz = 0; iz < hydrantGridZ.length; iz++) {
      if ((ia * 3 + iz) % 2 !== 0) continue;
      const hx = mainAvenuesX[ia] - 15.4;
      const hz = hydrantGridZ[iz] + 15.4;
      spawnSharedProp({
        x: hx,
        z: hz,
        rotY: 0,
        type: 'hydrant',
        parts: [
          { geo: T.hydRedGeo, mat: M.red },
          { geo: T.hydSilverGeo, mat: M.silver }
        ],
        hp: 15,
        radius: 0.95,
        height: 1.15,
        colW: 0.75,
        colD: 0.75,
        debrisColors: [LEGO_COLORS.red, LEGO_COLORS.silver],
        studDrops: { silver: 4, gold: 3, blue: 1, purple: 0 },
        chaosValue: 4
      });
    }
  }
  // Hidrantes clássicos próximos ao Banco Central e Parque
  const extraHydrants = [
    [-15, -100], [15, -100], [-15, -130], [15, -130],
    [-15.2, -16], [15.2, -16], [-15.2, 16], [15.2, 16],
    [616, -234], [784, -234], [-1160, -100], [-500, -100]
  ];
  for (const [hx, hz] of extraHydrants) {
    spawnSharedProp({
      x: hx,
      z: hz,
      rotY: 0,
      type: 'hydrant',
      parts: [
        { geo: T.hydRedGeo, mat: M.red },
        { geo: T.hydSilverGeo, mat: M.silver }
      ],
      hp: 15,
      radius: 0.95,
      height: 1.15,
      colW: 0.75,
      colD: 0.75,
      debrisColors: [LEGO_COLORS.red, LEGO_COLORS.silver],
      studDrops: { silver: 4, gold: 3, blue: 1, purple: 0 },
      chaosValue: 4
    });
  }

  // --------------------------------------------------------------------------
  // 3. PONTOS DE ÔNIBUS COM VIDRO AZUL (~26), CABINES TELEFÔNICAS (~24) & BANCAS (~20)
  // --------------------------------------------------------------------------
  const busStopSpots = [
    [-384 + 16.8, -315, -Math.PI / 2], [-384 - 16.8, -55, Math.PI / 2], [-384 + 16.8, 260, -Math.PI / 2],
    [-252 + 16.8, -445, -Math.PI / 2], [-252 - 16.8, -60, Math.PI / 2], [-252 + 16.8, 220, -Math.PI / 2],
    [-120 - 16.8, -575, Math.PI / 2], [-120 + 16.8, -315, -Math.PI / 2], [-120 - 16.8, -55, Math.PI / 2], [-120 + 16.8, 265, -Math.PI / 2],
    [0 - 16.8, -575, Math.PI / 2], [0 + 16.8, -210, -Math.PI / 2], [0 - 16.8, 220, Math.PI / 2], [0 + 16.8, 520, -Math.PI / 2],
    [120 + 16.8, -575, -Math.PI / 2], [120 - 16.8, -315, Math.PI / 2], [120 + 16.8, -55, -Math.PI / 2], [120 - 16.8, 265, Math.PI / 2],
    [252 - 16.8, -445, Math.PI / 2], [252 + 16.8, 220, -Math.PI / 2],
    [384 - 16.8, -315, Math.PI / 2], [384 + 16.8, -55, -Math.PI / 2], [384 - 16.8, 265, Math.PI / 2],
    [-185, 726.8, Math.PI], [65, 726.8, Math.PI], [-960, -100.5, 0]
  ];
  for (const [bx, bz, brot] of busStopSpots) {
    spawnSharedProp({
      x: bx,
      z: bz,
      rotY: brot,
      type: 'bus_stop',
      parts: [
        { geo: T.busFrameGeo, mat: M.silver },
        { geo: T.busRoofGeo, mat: M.blue },
        { geo: T.busGlassGeo, mat: M.blueGlass, shadow: false },
        { geo: T.busBenchGeo, mat: M.yellow }
      ],
      hp: 38,
      radius: 2.1,
      height: 2.9,
      colW: 3.8,
      colD: 1.8,
      debrisColors: [LEGO_COLORS.blue, LEGO_COLORS.silver, 0x38bdf8, LEGO_COLORS.yellow],
      studDrops: { silver: 6, gold: 5, blue: 2, purple: 0 },
      chaosValue: 8
    });
  }

  // Cabines Telefônicas Vermelhas & Azuis LEGO
  const phoneBoothSpots = [];
  for (const ax of [-384, -252, -120, 0, 120, 252, 384]) {
    for (const pz of [-680, -335, -80, 175]) {
      phoneBoothSpots.push([ax + 16.2, pz, -Math.PI / 2]);
    }
  }
  phoneBoothSpots.forEach(([px, pz, prot], idx) => {
    const bodyMat = idx % 3 === 0 ? M.blue : M.red;
    const mainHex = idx % 3 === 0 ? LEGO_COLORS.blue : LEGO_COLORS.red;
    spawnSharedProp({
      x: px,
      z: pz,
      rotY: prot,
      type: 'phone_booth',
      parts: [
        { geo: T.boothBodyGeo, mat: bodyMat },
        { geo: T.boothGlassGeo, mat: M.blueGlass, shadow: false },
        { geo: T.boothInnerGeo, mat: M.yellow }
      ],
      hp: 28,
      radius: 1.05,
      height: 2.8,
      colW: 1.28,
      colD: 1.28,
      debrisColors: [mainHex, 0x38bdf8, LEGO_COLORS.yellow, LEGO_COLORS.white],
      studDrops: { silver: 5, gold: 4, blue: 1, purple: 0 },
      chaosValue: 6
    });
  });

  // Bancas de Jornal espalhadas pela cidade
  const newsstandSpots = [
    [-24, -102, 0], [24, -102, 0],
    [-137, -101, 0], [137, -101, 0],
    [-269, -101, 0], [269, -101, 0],
    [-137, -234, 0], [137, -234, 0],
    [-137, 150, Math.PI], [137, 150, Math.PI],
    [-269, 150, Math.PI], [269, 150, Math.PI],
    [-60, -528, 0], [60, -528, 0],
    [-180, -660, 0], [180, -660, 0],
    [-310, 728, Math.PI], [-60, 728, Math.PI], [185, 728, Math.PI], [330, 728, Math.PI]
  ];
  newsstandSpots.forEach(([nx, nz, nrot], idx) => {
    const awningMats = [M.red, M.blue, M.green, M.orange];
    const awningHexes = [LEGO_COLORS.red, LEGO_COLORS.blue, LEGO_COLORS.green, LEGO_COLORS.orange];
    spawnSharedProp({
      x: nx,
      z: nz,
      rotY: nrot,
      type: 'newsstand',
      parts: [
        { geo: T.standCounterGeo, mat: M.tan },
        { geo: T.standAwningGeo, mat: awningMats[idx % 4] },
        { geo: T.standMagazinesGeo, mat: M.white }
      ],
      hp: 34,
      radius: 1.85,
      height: 2.6,
      colW: 2.8,
      colD: 1.9,
      debrisColors: [awningHexes[idx % 4], LEGO_COLORS.tan, LEGO_COLORS.white],
      studDrops: { silver: 6, gold: 5, blue: 2, purple: 0 },
      chaosValue: 7
    });
  });

  // --------------------------------------------------------------------------
  // 4. CAIXAS ELETRÔNICOS (ATMs LEGO — ~32) NAS FACHADAS COMERCIAIS!
  //    (Quando destruídos, jorram MUITOS Studs Dourados & Azuis + sobem Caos!)
  // --------------------------------------------------------------------------
  const atmSpots = [
    // Centro Financeiro & Super Banco arredores
    [-32, -133.5, 0], [32, -133.5, 0],
    [-58, -133.5, 0], [58, -133.5, 0],
    [-85, -100.5, Math.PI], [85, -100.5, Math.PI],
    [-185, -133.5, 0], [185, -133.5, 0],
    [-185, -266.5, 0], [185, -266.5, 0],
    [-58, -266.5, 0], [58, -266.5, 0],
    [-315, -100.5, Math.PI], [315, -100.5, Math.PI],
    [-315, -266.5, 0], [315, -266.5, 0],
    [-58, -398.5, 0], [185, -398.5, 0], [-185, -398.5, 0],
    // Times Square / Av. Z=0 & Z=134
    [-185, -16.5, 0], [185, -16.5, 0],
    [-315, -16.5, 0], [315, -16.5, 0],
    // Subúrbio Comercial Norte & Posto
    [-60, -660.5, 0], [60, -660.5, 0], [-190, -792.5, 0], [190, -792.5, 0],
    // Hotéis da Orla Sul & Aeroporto
    [-210, 693.5, 0], [-60, 693.5, 0], [90, 693.5, 0], [210, 693.5, 0],
    [-1220, -100.5, Math.PI]
  ];
  for (const [ax, az, arot] of atmSpots) {
    spawnSharedProp({
      x: ax,
      z: az,
      rotY: arot,
      type: 'atm_machine',
      parts: [
        { geo: T.atmBodyGeo, mat: M.blue },
        { geo: T.atmGoldTrimGeo, mat: M.gold },
        { geo: T.atmScreenGeo, mat: M.atmScreen, shadow: false }
      ],
      hp: 40,
      radius: 1.15,
      height: 2.55,
      colW: 1.38,
      colD: 1.08,
      debrisColors: [LEGO_COLORS.blue, LEGO_COLORS.gold, 0x00f0ff, LEGO_COLORS.silver],
      studDrops: { silver: 4, gold: 16, blue: 10, purple: 1 },
      chaosValue: 55
    });
  }

  // --------------------------------------------------------------------------
  // 5. CARRINHOS DE HOT-DOG, PIPOCA E SORVETE (~34) + MESINHAS COM GUARDA-SOL (~40)
  // --------------------------------------------------------------------------
  const foodCartSpots = [
    // Parque Central & Praça do Banco
    [-38, -82, 0], [38, -82, 0], [-45, 22, 0], [45, 22, 0],
    [-95, 55, Math.PI / 2], [95, 55, -Math.PI / 2],
    [-45, 114, Math.PI], [45, 114, Math.PI],
    // Calçadão da Praia Sul & Entrada do Mega Píer
    [-420, 732, Math.PI], [-330, 732, Math.PI], [-235, 732, Math.PI], [-150, 732, Math.PI],
    [-75, 732, Math.PI], [48, 732, Math.PI], [155, 732, Math.PI], [240, 732, Math.PI],
    [345, 732, Math.PI], [430, 732, Math.PI],
    [-40, 1085, Math.PI / 2], [40, 1085, -Math.PI / 2],
    [-40, 1165, Math.PI / 2], [40, 1165, -Math.PI / 2],
    // Centro, Times Square & Subúrbio
    [-137, -45, Math.PI / 2], [137, -45, -Math.PI / 2],
    [-268, -165, Math.PI / 2], [268, -165, -Math.PI / 2],
    [-75, -530, 0], [75, -530, 0], [-165, -662, 0], [165, -662, 0],
    [-75, -794, 0], [75, -794, 0],
    [-1080, -100, 0], [620, -100, 0]
  ];
  foodCartSpots.forEach(([fx, fz, frot], idx) => {
    // 0: Hot-Dog (Vermelho/Amarelo), 1: Pipoca (Amarelo/Vermelho), 2: Sorvete (Ciano/Rosa)
    const variant = idx % 3;
    const bodyMat = variant === 0 ? M.red : variant === 1 ? M.yellow : M.cyan;
    const canopyMat = variant === 0 ? M.yellow : variant === 1 ? M.red : M.pink;
    const c1 = variant === 0 ? LEGO_COLORS.red : variant === 1 ? LEGO_COLORS.yellow : 0x06b6d4;
    const c2 = variant === 0 ? LEGO_COLORS.yellow : variant === 1 ? LEGO_COLORS.red : 0xf472b6;
    spawnSharedProp({
      x: fx,
      z: fz,
      rotY: frot,
      type: 'food_cart',
      parts: [
        { geo: T.cartBodyGeo, mat: bodyMat },
        { geo: T.cartCanopyGeo, mat: canopyMat },
        { geo: T.cartWheelsGeo, mat: M.charcoal }
      ],
      hp: 26,
      radius: 1.35,
      height: 2.6,
      colW: 1.9,
      colD: 1.2,
      debrisColors: [c1, c2, LEGO_COLORS.white, LEGO_COLORS.charcoal],
      studDrops: { silver: 5, gold: 6, blue: 2, purple: 0 },
      chaosValue: 6
    });
  });

  // Mesinhas com Guarda-Sol (Calçadão da Praia, Praças do Centro e Subúrbio)
  const cafeSpots = [];
  for (let bx = -450; bx <= 450; bx += 38) {
    if (Math.abs(bx) < 28) continue;
    cafeSpots.push([bx, 738.0, 0]);
  }
  const extraCafeSpots = [
    [-65, -96, 0], [65, -96, 0], [-72, -96, 0.4], [72, -96, -0.4],
    [-65, 25, 0], [65, 25, 0], [-65, 95, 0], [65, 95, 0],
    [-195, -100, 0], [195, -100, 0], [-195, 150, 0], [195, 150, 0],
    [-85, -662, 0], [-93, -662, 0], [85, -662, 0], [93, -662, 0],
    [-85, -925, 0], [85, -925, 0]
  ];
  for (const s of extraCafeSpots) cafeSpots.push(s);

  cafeSpots.forEach(([cx, cz, crot], idx) => {
    const umbMats = [M.red, M.yellow, M.cyan, M.orange, M.pink, M.blue];
    const umbHexes = [LEGO_COLORS.red, LEGO_COLORS.yellow, 0x06b6d4, LEGO_COLORS.orange, 0xf472b6, LEGO_COLORS.blue];
    spawnSharedProp({
      x: cx,
      z: cz,
      rotY: crot,
      type: 'cafe_table',
      parts: [
        { geo: T.cafeWhiteGeo, mat: M.white },
        { geo: T.cafeUmbrellaGeo, mat: umbMats[idx % umbMats.length] }
      ],
      hp: 18,
      radius: 1.45,
      height: 3.0,
      colW: 2.3,
      colD: 1.4,
      debrisColors: [umbHexes[idx % umbHexes.length], LEGO_COLORS.white, LEGO_COLORS.tan],
      studDrops: { silver: 4, gold: 3, blue: 1, purple: 0 },
      chaosValue: 4
    });
  });

  // --------------------------------------------------------------------------
  // 6. LIXEIRAS (~36), CAÇAMBAS (~18), BANCOS (~32), PLACAS (~28) E
  //    FILEIRAS DE CONES / BARRICADAS LARANJAS (~75) PARA ATROPELAR A 300 KM/H!
  // --------------------------------------------------------------------------
  // Lixeiras nas calçadas
  const trashZ = [-850, -600, -350, -195, -40, 90, 290, 560];
  let trashToggle = 0;
  for (const ax of [-384, -252, -120, 0, 120, 252, 384]) {
    for (const tz of trashZ) {
      if ((trashToggle++ % 3) === 1) continue;
      const side = trashToggle % 2 === 0 ? 1 : -1;
      const useBlue = trashToggle % 4 === 0;
      spawnSharedProp({
        x: ax + side * 15.2,
        z: tz,
        rotY: 0,
        type: 'trash_can',
        parts: [
          { geo: T.trashBodyGeo, mat: useBlue ? M.blue : M.green },
          { geo: T.trashLidGeo, mat: M.darkGrey }
        ],
        hp: 12,
        radius: 0.75,
        height: 1.15,
        colW: 0.78,
        colD: 0.78,
        debrisColors: [useBlue ? LEGO_COLORS.blue : LEGO_COLORS.green, LEGO_COLORS.darkGrey, LEGO_COLORS.silver],
        studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 },
        chaosValue: 2
      });
    }
  }

  // Caçambas de Entulho LEGO (Dumpsters)
  const dumpsterSpots = [
    [-205, -232, 0], [205, -232, 0], [-335, -364, 0], [335, -364, 0],
    [-75, -364, 0], [205, -496, 0], [-205, -496, 0],
    [-465, -232, 0], [465, -232, 0], [-465, 18, 0], [465, 18, 0],
    [622, -180, Math.PI / 2], [750, -320, 0], [945, -180, Math.PI / 2],
    [-630, -560, 0], [630, -560, 0], [-920, -135, 0], [-1310, -135, 0]
  ];
  dumpsterSpots.forEach(([dx, dz, drot], idx) => {
    const isYellow = idx % 2 === 0;
    spawnSharedProp({
      x: dx,
      z: dz,
      rotY: drot,
      type: 'dumpster',
      parts: [
        { geo: T.dumpsterBodyGeo, mat: isYellow ? M.yellow : M.green },
        { geo: T.dumpsterLidGeo, mat: M.charcoal }
      ],
      hp: 36,
      radius: 1.45,
      height: 1.5,
      colW: 2.25,
      colD: 1.45,
      debrisColors: [isYellow ? LEGO_COLORS.yellow : LEGO_COLORS.green, LEGO_COLORS.charcoal, LEGO_COLORS.tan],
      studDrops: { silver: 6, gold: 4, blue: 1, purple: 0 },
      chaosValue: 5
    });
  });

  // Bancos de Madeira LEGO (Parque Central, Orla da Praia, Praças e Avenidas)
  const benchSpots = [
    [-32, 16, 0], [32, 16, 0], [-32, 118, Math.PI], [32, 118, Math.PI],
    [-102, 42, Math.PI / 2], [-102, 88, Math.PI / 2], [102, 42, -Math.PI / 2], [102, 88, -Math.PI / 2],
    [-395, 725, Math.PI], [-290, 725, Math.PI], [-195, 725, Math.PI], [-95, 725, Math.PI],
    [95, 725, Math.PI], [195, 725, Math.PI], [290, 725, Math.PI], [395, 725, Math.PI],
    [-42, 1120, Math.PI / 2], [42, 1120, -Math.PI / 2], [-42, 1210, Math.PI / 2], [42, 1210, -Math.PI / 2],
    [-55, -660, 0], [55, -660, 0], [-185, -792, 0], [185, -792, 0],
    [-55, -924, 0], [55, -924, 0], [-310, -528, 0], [310, -528, 0],
    [-136, -155, Math.PI / 2], [136, -155, -Math.PI / 2]
  ];
  for (const [bx, bz, brot] of benchSpots) {
    spawnSharedProp({
      x: bx,
      z: bz,
      rotY: brot,
      type: 'park_bench',
      parts: [
        { geo: T.benchWoodGeo, mat: M.brown },
        { geo: T.benchIronGeo, mat: M.charcoal }
      ],
      hp: 16,
      radius: 1.25,
      height: 1.05,
      colW: 2.15,
      colD: 0.65,
      debrisColors: [LEGO_COLORS.brown, LEGO_COLORS.tan, LEGO_COLORS.charcoal],
      studDrops: { silver: 4, gold: 2, blue: 0, purple: 0 },
      chaosValue: 3
    });
  }

  // Placas de Trânsito LEGO nas esquinas
  let signIdx = 0;
  for (const ax of [-384, -252, -120, 0, 120, 252, 384]) {
    for (const sz of [-776, -512, -250, 134, 402]) {
      if ((signIdx++ % 3) === 2) continue;
      const isStop = signIdx % 2 === 0;
      spawnSharedProp({
        x: ax + 15.2,
        z: sz - 15.8,
        rotY: 0,
        type: 'street_sign',
        parts: [
          { geo: T.signPoleGeo, mat: M.silver },
          { geo: T.signPlateGeo, mat: isStop ? M.red : M.yellow },
          { geo: T.signBorderGeo, mat: M.white }
        ],
        hp: 12,
        radius: 0.8,
        height: 2.85,
        colW: 0.55,
        colD: 0.55,
        debrisColors: [isStop ? LEGO_COLORS.red : LEGO_COLORS.yellow, LEGO_COLORS.silver, LEGO_COLORS.white],
        studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 },
        chaosValue: 2
      });
    }
  }

  // Fileiras suculentas de Cones Laranjas & Barricadas Laranjas (perfeitas para atropelar em sequência a 300+ km/h!)
  const coneStreaks = [
    // Acostamentos das grandes avenidas Norte-Sul (sem bloquear a faixa de tráfego!)
    { startX: -12.6, startZ: -240, dx: 0, dz: 3.2, count: 6, barricadeEnd: true },
    { startX: 12.6, startZ: 165, dx: 0, dz: 3.2, count: 6, barricadeEnd: true },
    { startX: -120 + 12.6, startZ: -460, dx: 0, dz: 3.2, count: 5, barricadeEnd: true },
    { startX: 120 - 12.6, startZ: -210, dx: 0, dz: 3.2, count: 5, barricadeEnd: true },
    { startX: 252 + 12.6, startZ: 175, dx: 0, dz: 3.2, count: 6, barricadeEnd: true },
    { startX: -252 - 12.6, startZ: -340, dx: 0, dz: 3.2, count: 5, barricadeEnd: true },
    // Avenida Beira-Mar (Z = 710) & Rodovia Expressa do Aeroporto (Z = -117 Oeste)
    { startX: -320, startZ: 697.4, dx: 3.5, dz: 0, count: 6, barricadeEnd: true },
    { startX: 150, startZ: 697.4, dx: 3.5, dz: 0, count: 6, barricadeEnd: true },
    { startX: -880, startZ: -129.5, dx: -4.0, dz: 0, count: 6, barricadeEnd: true },
    { startX: -1180, startZ: -104.5, dx: -4.0, dz: 0, count: 6, barricadeEnd: true },
    // Ponte Leste & Avenida Central Norte
    { startX: 535, startZ: -129.2, dx: 3.6, dz: 0, count: 5, barricadeEnd: false },
    { startX: -12.6, startZ: -740, dx: 0, dz: -3.4, count: 6, barricadeEnd: true }
  ];

  for (const streak of coneStreaks) {
    for (let i = 0; i < streak.count; i++) {
      const cx = streak.startX + streak.dx * i;
      const cz = streak.startZ + streak.dz * i;
      spawnSharedProp({
        x: cx,
        z: cz,
        rotY: 0,
        type: 'traffic_cone',
        parts: [
          { geo: T.coneOrangeGeo, mat: M.orange },
          { geo: T.coneStripeGeo, mat: M.white }
        ],
        hp: 8,
        radius: 0.72,
        height: 0.9,
        colW: 0.55,
        colD: 0.55,
        debrisColors: [LEGO_COLORS.orange, LEGO_COLORS.white],
        studDrops: { silver: 2, gold: 1, blue: 0, purple: 0 },
        chaosValue: 1,
        onRoadSurface: true,
        allowRoadEdge: true,
        minPeerDist: 1.4,
        noCollider: true // Zero perda de velocidade ao sair varrendo fileiras de cones a 300 km/h!
      });
    }
    if (streak.barricadeEnd) {
      const bx = streak.startX + streak.dx * streak.count;
      const bz = streak.startZ + streak.dz * streak.count;
      const brot = Math.abs(streak.dx) > Math.abs(streak.dz) ? Math.PI / 2 : 0;
      spawnSharedProp({
        x: bx,
        z: bz,
        rotY: brot,
        type: 'orange_barricade',
        parts: [
          { geo: T.barricadeOrangeGeo, mat: M.orange },
          { geo: T.barricadeWhiteGeo, mat: M.white }
        ],
        hp: 14,
        radius: 1.15,
        height: 1.1,
        colW: 1.9,
        colD: 0.58,
        debrisColors: [LEGO_COLORS.orange, LEGO_COLORS.white, LEGO_COLORS.yellow],
        studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 },
        chaosValue: 2,
        onRoadSurface: true,
        allowRoadEdge: true,
        minPeerDist: 1.6,
        noCollider: true
      });
    }
  }

  // Fileiras de Barricadas Laranjas nos Viadutos Elevados (superfície em Y elevado!)
  const viaductBarricades = [
    { x: -110, z: -389.2, refY: 12.0, rotY: 0 },
    { x: -106, z: -389.2, refY: 12.0, rotY: 0 },
    { x: 110, z: -389.2, refY: 12.0, rotY: 0 },
    { x: 114, z: -389.2, refY: 12.0, rotY: 0 },
    { x: 259.2, z: -180, refY: 12.0, rotY: Math.PI / 2 },
    { x: 259.2, z: -176, refY: 12.0, rotY: Math.PI / 2 },
    { x: 259.2, z: 60, refY: 12.0, rotY: Math.PI / 2 },
    { x: 259.2, z: 64, refY: 12.0, rotY: Math.PI / 2 }
  ];
  for (const vb of viaductBarricades) {
    spawnSharedProp({
      x: vb.x,
      z: vb.z,
      rotY: vb.rotY,
      type: 'orange_barricade',
      parts: [
        { geo: T.barricadeOrangeGeo, mat: M.orange },
        { geo: T.barricadeWhiteGeo, mat: M.white }
      ],
      hp: 14,
      radius: 1.15,
      height: 1.1,
      colW: 1.9,
      colD: 0.58,
      debrisColors: [LEGO_COLORS.orange, LEGO_COLORS.white, LEGO_COLORS.yellow],
      studDrops: { silver: 3, gold: 2, blue: 0, purple: 0 },
      chaosValue: 2,
      onRoadSurface: true,
      allowRoadEdge: true,
      minPeerDist: 1.5,
      refY: vb.refY,
      noCollider: true
    });
  }

  // Caixas LEGO clássicas nas esquinas e galpões
  const crateData = [
    [-19, -98, LEGO_COLORS.orange],
    [-20.6, -98, LEGO_COLORS.yellow],
    [19, -98, LEGO_COLORS.blue],
    [20.6, -98, LEGO_COLORS.green],
    [-19, -18, LEGO_COLORS.orange],
    [19, -18, LEGO_COLORS.blue],
    [680, -340, LEGO_COLORS.red],
    [682, -340, LEGO_COLORS.yellow]
  ];
  for (const [cx, cz, color] of crateData) {
    const sidewalkY = getGroundAndSidewalkY(cx, cz, false);
    const crate = createLegoBrick(1.3, 1.3, 1.3, color, { studStep: 0.55, castShadow: false });
    crate.traverse((c) => {
      if (c.isMesh) c.castShadow = false;
    });
    crate.position.set(cx, sidewalkY + 0.65, cz);
    world.scene.add(crate);
    const col = world.addCollider(cx, cz, 1.3, 1.3, sidewalkY + 1.3, sidewalkY);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: crate,
        type: 'crate',
        hp: 12,
        radius: 1.05,
        height: 1.3,
        colliders: [col],
        debrisColors: [color, LEGO_COLORS.tan, LEGO_COLORS.brown],
        studDrops: { silver: 4, gold: 2, blue: 0, purple: 0 },
        groundY: sidewalkY,
        isStreetProp: true,
        chaosValue: 2
      });
    }
  }
}

export function buildNewsstandsAndFences(world) {
  const getSidewalkY = (px, pz) =>
    (world.getTerrainHeightAt ? world.getTerrainHeightAt(px, pz) : 0) + 0.28;

  // Cercas brancas LEGO quebráveis nas praças e no Subúrbio Norte!
  const fencePositions = [
    { x: -28.0, z: -104.0, rotY: 0 },
    { x: 28.0, z: -104.0, rotY: 0 },
    { x: -22.5, z: -16.4, rotY: 0 },
    { x: 22.5, z: -16.4, rotY: 0 },
    { x: -72.0, z: -658.0, rotY: 0 },
    { x: -69.5, z: -658.0, rotY: 0 },
    { x: 69.5, z: -658.0, rotY: 0 },
    { x: 72.0, z: -658.0, rotY: 0 },
    { x: -172.0, z: -790.0, rotY: 0 },
    { x: 172.0, z: -790.0, rotY: 0 }
  ];

  fencePositions.forEach((f) => {
    const sidewalkY = getSidewalkY(f.x, f.z);
    const fenceGroup = new THREE.Group();
    fenceGroup.position.set(f.x, sidewalkY, f.z);
    fenceGroup.rotation.y = f.rotY;

    const railTop = createLegoBrick(2.2, 0.9, 0.25, LEGO_COLORS.white, {
      studStep: 0.45,
      castShadow: false
    });
    railTop.traverse((c) => {
      if (c.isMesh) c.castShadow = false;
    });
    railTop.position.set(0, 0.45, 0);
    fenceGroup.add(railTop);
    world.scene.add(fenceGroup);

    const col = world.addCollider(f.x, f.z, 2.2, 0.45, sidewalkY + 0.95, sidewalkY);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: fenceGroup,
        type: 'fence',
        hp: 10,
        radius: 1.25,
        height: 1.0,
        colliders: [col],
        debrisColors: [LEGO_COLORS.white, LEGO_COLORS.lightGrey],
        studDrops: { silver: 3, gold: 1, blue: 0, purple: 0 },
        groundY: sidewalkY,
        isStreetProp: true,
        chaosValue: 2
      });
    }
  });
}

export function buildGoldenLegoObjects(world) {
  const sidewalkY = 0.28;
  const goldVaultLocations = [
    // Praça em frente ao Super Banco Central
    { x: -16.0, z: -112.0, y: sidewalkY, scale: 1.0 },
    // Topo da Torre dos Heróis (Y = 310.8m)
    { x: -318.0, z: -180.0, y: 310.8, scale: 1.35 },
    // Convés do Aeroporta-Aviões no Céu (Y = 410.4m)
    { x: 0.0, z: -80.0, y: 410.4, scale: 1.35 }
  ];

  const goldShinyMat = getLegoMaterial(LEGO_COLORS.gold, {
    metalness: 0.72,
    roughness: 0.14,
    clearcoat: 0.85,
    emissive: 0xd97706,
    emissiveIntensity: 0.28
  });

  goldVaultLocations.forEach((loc) => {
    const vaultGroup = new THREE.Group();
    vaultGroup.position.set(loc.x, loc.y, loc.z);

    const w = 1.9 * loc.scale;
    const h = 2.1 * loc.scale;
    const d = 1.9 * loc.scale;

    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldShinyMat);
    core.position.y = h * 0.5;
    core.castShadow = true;
    vaultGroup.add(core);

    const topPlate = createLegoBrick(w, 0.25, d, LEGO_COLORS.gold, {
      metalness: 0.7,
      roughness: 0.15,
      studStep: 0.5
    });
    topPlate.position.y = h + 0.125;
    vaultGroup.add(topPlate);

    world.scene.add(vaultGroup);
    const col = world.addCollider(loc.x, loc.z, w + 0.2, d + 0.2, loc.y + h + 0.3, loc.y);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: vaultGroup,
        type: 'gold_vault',
        hp: 45,
        radius: w * 0.85,
        height: h + 0.5,
        colliders: [col],
        debrisColors: [LEGO_COLORS.gold, LEGO_COLORS.yellow, 0xfef08a],
        studDrops: { silver: 0, gold: 8, blue: 4, purple: 2 },
        groundY: loc.y,
        goldOnly: true
      });
    }
  });

  // ============================================================================
  // PASSO 5A: PAREDES RACHADAS LEGO (Destruídas pelo Soco Foguete / Terremoto do Titã Blindado!)
  // ============================================================================
  const crackedWallLocations = [
    { x: 24.0, z: -116.0, y: sidewalkY, rotY: 0 },
    { x: -26.0, z: -132.0, y: sidewalkY, rotY: Math.PI / 2 },
    { x: -286.0, z: -142.0, y: sidewalkY, rotY: 0 },
    { x: -652.0, z: -88.0, y: sidewalkY, rotY: 0.35 },
    { x: 646.0, z: -292.0, y: sidewalkY, rotY: 0 },
    { x: 848.0, z: 368.0, y: sidewalkY, rotY: Math.PI / 2 }
  ];

  const wallConcreteMat = getLegoMaterial(0x334155, { roughness: 0.38 });
  const crackGlowMat = getLegoMaterial(0x00f0ff, {
    emissive: 0x00f0ff,
    emissiveIntensity: 1.5,
    roughness: 0.15
  });
  const hazardGoldMat = getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.4, roughness: 0.2 });

  crackedWallLocations.forEach((loc) => {
    const locGroundY =
      (world.getTerrainHeightAt ? world.getTerrainHeightAt(loc.x, loc.z) : 0) + loc.y;
    const wallGroup = new THREE.Group();
    wallGroup.position.set(loc.x, locGroundY, loc.z);
    wallGroup.rotation.y = loc.rotY || 0;

    const w = 3.6;
    const h = 3.2;
    const d = 1.05;

    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallConcreteMat);
    slab.position.y = h * 0.5;
    slab.castShadow = true;
    slab.receiveShadow = true;
    wallGroup.add(slab);

    const topBrick = createLegoBrick(w, 0.28, d, LEGO_COLORS.darkGrey, { studStep: 0.6 });
    topBrick.position.y = h + 0.14;
    wallGroup.add(topBrick);

    const crackAngles = [
      { x: 0, y: 1.6, w: 0.22, h: 1.9, rz: 0.48 },
      { x: -0.45, y: 1.95, w: 0.16, h: 1.25, rz: -0.62 },
      { x: 0.52, y: 1.25, w: 0.16, h: 1.3, rz: -0.55 },
      { x: 0.1, y: 1.6, w: 0.36, h: 0.36, rz: Math.PI / 4 }
    ];
    for (const c of crackAngles) {
      const fissure = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, d + 0.08), crackGlowMat);
      fissure.position.set(c.x, c.y, 0);
      fissure.rotation.z = c.rz;
      wallGroup.add(fissure);
    }

    for (const sx of [-w * 0.46, w * 0.46]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, h, d + 0.1), hazardGoldMat);
      post.position.set(sx, h * 0.5, 0);
      wallGroup.add(post);
    }

    world.scene.add(wallGroup);
    const colW = Math.abs(Math.sin(loc.rotY || 0)) > 0.7 ? d : w;
    const colD = Math.abs(Math.sin(loc.rotY || 0)) > 0.7 ? w : d;
    const col = world.addCollider(loc.x, loc.z, colW + 0.2, colD + 0.2, locGroundY + h + 0.3, locGroundY);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: wallGroup,
        type: 'cracked_wall',
        hp: 60,
        radius: 2.1,
        height: h + 0.4,
        colliders: [col],
        debrisColors: [0x334155, LEGO_COLORS.darkGrey, LEGO_COLORS.gold, 0x00f0ff],
        studDrops: { silver: 0, gold: 8, blue: 5, purple: 2 },
        groundY: locGroundY,
        crackedWallOnly: true
      });
    }
  });

  // ============================================================================
  // PASSO 5B: OBJETOS PRATEADOS BRILHANTES LEGO (Destruídos pela Bazuca RPG do Vingador de Chumbo!)
  // ============================================================================
  const silverVaultLocations = [
    { x: 16.0, z: -112.0, y: sidewalkY, scale: 1.0 },
    { x: -15.5, z: -185.0, y: 0.36, scale: 1.05 },
    { x: -312.0, z: -192.0, y: 310.8, scale: 1.2 },
    { x: 668.0, z: -318.0, y: sidewalkY, scale: 1.1 },
    { x: 838.0, z: 392.0, y: sidewalkY, scale: 1.15 },
    { x: -1085.0, z: -25.0, y: sidewalkY, scale: 1.15 }
  ];

  const silverMirrorMat = getLegoMaterial(0xe2e8f0, {
    metalness: 0.88,
    roughness: 0.08,
    clearcoat: 0.95,
    emissive: 0x475569,
    emissiveIntensity: 0.25
  });
  const redBeaconMat = getLegoMaterial(0xef4444, {
    emissive: 0xef4444,
    emissiveIntensity: 1.6
  });

  silverVaultLocations.forEach((loc) => {
    const silverGroup = new THREE.Group();
    silverGroup.position.set(loc.x, loc.y, loc.z);

    const w = 2.0 * loc.scale;
    const h = 2.2 * loc.scale;
    const d = 2.0 * loc.scale;

    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), silverMirrorMat);
    core.position.y = h * 0.5;
    core.castShadow = true;
    silverGroup.add(core);

    const topPlate = createLegoBrick(w, 0.26, d, LEGO_COLORS.silver, {
      metalness: 0.85,
      roughness: 0.1,
      studStep: 0.5
    });
    topPlate.position.y = h + 0.13;
    silverGroup.add(topPlate);

    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.25, 14), redBeaconMat);
    beacon.position.y = h + 0.38;
    silverGroup.add(beacon);

    world.scene.add(silverGroup);
    const col = world.addCollider(loc.x, loc.z, w + 0.2, d + 0.2, loc.y + h + 0.4, loc.y);

    if (world.destructibles) {
      world.destructibles.registerDestructible({
        mesh: silverGroup,
        type: 'silver_lego',
        hp: 55,
        radius: w * 0.88,
        height: h + 0.5,
        colliders: [col],
        debrisColors: [0xe2e8f0, LEGO_COLORS.silver, LEGO_COLORS.lightGrey, 0xef4444],
        studDrops: { silver: 6, gold: 8, blue: 5, purple: 2 },
        groundY: loc.y,
        silverOnly: true
      });
    }
  });
}
