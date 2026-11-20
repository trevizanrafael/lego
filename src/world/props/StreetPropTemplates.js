import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';

// ============================================================================
// CATÁLOGO DE GEOMETRIAS PRÉ-MESCLADAS COMPARTILHADAS (60 FPS CRAVADOS PARA ~450 PROPS!)
// ============================================================================
let SHARED_TEMPLATES = null;

export function makeStudsGridGeo(w, d, yCenter, step = 0.55) {
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

export function getSharedTemplates() {
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

export function makeOptimizedGroup(parts) {
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
