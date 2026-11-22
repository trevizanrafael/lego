import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial
} from '../../materials/LegoMaterials.js';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';

// ============================================================================
// CONSTANTES DE ESCALADA GTA (0 A 5 ESTRELAS) & ASSETS 3D COMPARTILHADOS
// ============================================================================
export const WANTED_STAR_THRESHOLDS = [0, 100, 230, 400, 620, 900];

export const WANTED_TIER_INFO = {
  0: { stars: 0, label: 'CIDADE PACÍFICA', division: 'PATRULHA CIVIL' },
  1: { stars: 1, label: 'PATRULHA LOCAL', division: '190 // RP LOCAL' },
  2: { stars: 2, label: 'CERCO URBANO', division: 'INTERCEPTOR V8 // PIT' },
  3: { stars: 3, label: 'BLOQUEIO & ÁGUIA', division: 'GRUPAMENTO AÉREO ÁGUIA' },
  4: { stars: 4, label: 'CHOQUE PESADO', division: 'BOPE // CAVEIRÃO BLINDADO' },
  5: { stars: 5, label: 'FORÇA MÁXIMA', division: 'EXÉRCITO // BOPE • ÁGUIA • TANQUES' }
};

let SHARED_PURSUIT_GEOS = null;

export function getSharedPursuitGeos() {
  if (SHARED_PURSUIT_GEOS) return SHARED_PURSUIT_GEOS;

  // Giroflex Policial (Base + Cúpula Vermelha + Cúpula Azul)
  const lightbarBaseGeo = makeTranslatedBox(1.15, 0.1, 0.34, 0, 0, 0);
  const lightbarRedGeo = makeTranslatedBox(0.46, 0.16, 0.3, -0.32, 0.11, 0);
  const lightbarBlueGeo = makeTranslatedBox(0.46, 0.16, 0.3, 0.32, 0.11, 0);

  // Minifigura Policial / Choque (compacta e super leve a 60 FPS)
  const officerBodyGeo = mergeBufferGeometries([
    makeTranslatedBox(0.32, 0.56, 0.34, -0.19, 0.28, 0),
    makeTranslatedBox(0.32, 0.56, 0.34, 0.19, 0.28, 0),
    makeTranslatedBox(0.76, 0.72, 0.42, 0, 0.92, 0),
    makeTranslatedBox(0.22, 0.56, 0.24, -0.5, 0.94, 0.12),
    makeTranslatedBox(0.22, 0.56, 0.24, 0.5, 0.94, 0.18)
  ]);
  const officerHeadGeo = mergeBufferGeometries([
    (() => {
      const h = new THREE.CylinderGeometry(0.29, 0.29, 0.38, 12);
      h.translate(0, 1.48, 0);
      return h;
    })(),
    (() => {
      const cap = new THREE.CylinderGeometry(0.34, 0.33, 0.14, 12);
      cap.translate(0, 1.72, 0.03);
      return cap;
    })()
  ]);
  const officerGunGeo = makeTranslatedBox(0.14, 0.18, 0.68, 0.5, 0.92, 0.48);
  const riotShieldGeo = makeTranslatedBox(0.78, 1.25, 0.1, -0.48, 0.88, 0.38);

  // Exoesqueleto Caçador de Super-Humanos (Big-Fig Tecnológico 5 Estrelas)
  const exoArmorGeo = mergeBufferGeometries([
    makeTranslatedBox(0.52, 0.92, 0.54, -0.34, 0.46, 0),
    makeTranslatedBox(0.52, 0.92, 0.54, 0.34, 0.46, 0),
    makeTranslatedBox(1.36, 1.18, 0.78, 0, 1.52, 0),
    makeTranslatedBox(0.42, 0.95, 0.44, -0.92, 1.55, 0.18),
    makeTranslatedBox(0.42, 0.95, 0.44, 0.92, 1.55, 0.24),
    makeTranslatedBox(0.44, 0.38, 0.62, -0.68, 2.24, -0.05),
    makeTranslatedBox(0.44, 0.38, 0.62, 0.68, 2.24, -0.05),
    (() => {
      const helm = new THREE.CylinderGeometry(0.42, 0.46, 0.52, 10);
      helm.translate(0, 2.34, 0.04);
      return helm;
    })()
  ]);
  const exoVisorGeo = mergeBufferGeometries([
    makeTranslatedBox(0.68, 0.18, 0.14, 0, 2.36, 0.44),
    makeTranslatedBox(0.52, 0.36, 0.12, 0, 1.58, 0.42),
    makeTranslatedBox(0.28, 0.28, 0.88, 0.92, 1.48, 0.68)
  ]);

  // Helicóptero Policial Tático "ÁGUIA" (3–5 Estrelas)
  const heliHullGeo = mergeBufferGeometries([
    makeTranslatedBox(2.2, 1.85, 4.6, 0, 0, 0.35),
    makeTranslatedBox(1.65, 1.25, 1.8, 0, -0.2, 3.15),
    makeTranslatedBox(0.68, 0.72, 4.8, 0, 0.28, -4.15),
    makeTranslatedBox(0.22, 1.65, 1.15, 0, 0.85, -6.25),
    makeTranslatedBox(0.18, 0.18, 4.2, -1.25, -1.35, 0.4),
    makeTranslatedBox(0.18, 0.18, 4.2, 1.25, -1.35, 0.4),
    makeTranslatedBox(0.16, 0.62, 0.16, -1.15, -1.02, 1.4),
    makeTranslatedBox(0.16, 0.62, 0.16, 1.15, -1.02, 1.4),
    makeTranslatedBox(0.16, 0.62, 0.16, -1.15, -1.02, -0.8),
    makeTranslatedBox(0.16, 0.62, 0.16, 1.15, -1.02, -0.8)
  ]);
  const heliCanopyGeo = makeTranslatedBox(1.85, 1.05, 1.75, 0, 0.22, 2.55);
  const heliRotorGeo = mergeBufferGeometries([
    makeTranslatedBox(9.6, 0.08, 0.42, 0, 0, 0),
    makeTranslatedBox(0.42, 0.08, 9.6, 0, 0, 0),
    new THREE.CylinderGeometry(0.28, 0.28, 0.35, 10)
  ]);

  // Cone Branco Volumétrico do Holofote Noturno (vértice em Y=0 apontando p/ baixo)
  const spotlightConeGeo = (() => {
    const g = new THREE.ConeGeometry(1.0, 1.0, 16, 1, true);
    g.translate(0, -0.5, 0);
    return g;
  })();
  const spotlightDiscGeo = (() => {
    const d = new THREE.CircleGeometry(1.0, 20);
    d.rotateX(-Math.PI / 2);
    return d;
  })();

  // Drone Rápido Caçador Anti-Herói (5 Estrelas)
  const makeRotorRing = (tx, tz) => {
    const ring = new THREE.TorusGeometry(0.45, 0.07, 6, 12);
    ring.rotateX(Math.PI / 2);
    ring.translate(tx, 0.14, tz);
    return ring;
  };
  const droneBodyGeo = mergeBufferGeometries([
    makeTranslatedBox(1.35, 0.42, 1.55, 0, 0, 0),
    makeTranslatedBox(2.45, 0.12, 0.22, 0, 0.12, 0.68),
    makeTranslatedBox(2.45, 0.12, 0.22, 0, 0.12, -0.68),
    makeRotorRing(-1.22, 0.68),
    makeRotorRing(1.22, 0.68),
    makeRotorRing(-1.22, -0.68),
    makeRotorRing(1.22, -0.68)
  ]);
  const droneEyeGeo = makeTranslatedBox(0.55, 0.2, 0.2, 0, -0.02, 0.82);

  // Rampa de Salto LEGO e Barricadas das Barreiras Policiais (3+ Estrelas)
  const roadblockRampGeo = (() => {
    const g = new THREE.BoxGeometry(4.2, 0.35, 5.6);
    g.rotateX(-0.32);
    g.translate(0, 0.88, 0);
    const support = makeTranslatedBox(4.0, 1.55, 0.8, 0, 0.78, 2.2);
    return mergeBufferGeometries([g, support]);
  })();

  const makeBarricadeStud = (sx) => {
    const s = SHARED_STUD_GEO.clone();
    s.translate(sx, 1.1, 0);
    return s;
  };
  const rbBarricadeGeo = mergeBufferGeometries([
    makeTranslatedBox(2.2, 0.34, 0.22, 0, 0.88, 0),
    makeTranslatedBox(0.18, 1.05, 0.62, -0.88, 0.52, 0),
    makeTranslatedBox(0.18, 1.05, 0.62, 0.88, 0.52, 0),
    makeBarricadeStud(-0.6),
    makeBarricadeStud(0.6)
  ]);

  // Míssil Teleguiado, Rede Energética e Projétil Policial
  const missileGeo = (() => {
    const body = new THREE.CylinderGeometry(0.12, 0.14, 1.15, 8);
    body.rotateX(Math.PI / 2);
    const tip = new THREE.ConeGeometry(0.14, 0.38, 8);
    tip.rotateX(Math.PI / 2);
    tip.translate(0, 0, 0.74);
    return mergeBufferGeometries([body, tip]);
  })();

  const energyNetProjectileGeo = new THREE.IcosahedronGeometry(0.65, 1);
  const energyCageGeo = new THREE.IcosahedronGeometry(1.75, 1);
  const policeBulletGeo = (() => {
    const b = new THREE.CylinderGeometry(0.055, 0.055, 0.78, 6);
    b.rotateX(Math.PI / 2);
    return b;
  })();

  SHARED_PURSUIT_GEOS = {
    lightbarBaseGeo,
    lightbarRedGeo,
    lightbarBlueGeo,
    officerBodyGeo,
    officerHeadGeo,
    officerGunGeo,
    riotShieldGeo,
    exoArmorGeo,
    exoVisorGeo,
    heliHullGeo,
    heliCanopyGeo,
    heliRotorGeo,
    spotlightConeGeo,
    spotlightDiscGeo,
    droneBodyGeo,
    droneEyeGeo,
    roadblockRampGeo,
    rbBarricadeGeo,
    missileGeo,
    energyNetProjectileGeo,
    energyCageGeo,
    policeBulletGeo
  };

  return SHARED_PURSUIT_GEOS;
}

export const policePursuitAssetMethods = {
  _initSharedMaterials() {
    this.mats = {
      policeBlack: getLegoMaterial(0x111827),
      policeWhite: getLegoMaterial(LEGO_COLORS.white),
      policeBlue: getLegoMaterial(0x1d4ed8),
      bopeGold: getLegoMaterial(LEGO_COLORS.gold, { metalness: 0.5, roughness: 0.2 }),
      skinYellow: getLegoMaterial(LEGO_COLORS.yellow),
      gunSteel: getLegoMaterial(LEGO_COLORS.charcoal, { metalness: 0.45 }),
      riotShield: getLegoMaterial(0x38bdf8, { transparent: true, opacity: 0.62, roughness: 0.1 }),
      exoArmor: getLegoMaterial(0x0f172a, { metalness: 0.68, roughness: 0.18 }),
      exoNeon: new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
      exoRed: new THREE.MeshBasicMaterial({ color: 0xef4444 }),
      strobeRedOn: new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
      strobeBlueOn: new THREE.MeshBasicMaterial({ color: 0x2563eb }),
      strobeOff: getLegoMaterial(0x1e293b),
      heliGlass: getLegoMaterial(0x38bdf8, { transparent: true, opacity: 0.55, roughness: 0.08 }),
      spotlightCone: new THREE.MeshBasicMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      spotlightDisc: new THREE.MeshBasicMaterial({
        color: 0xfef9c3,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }),
      orangePlastic: getLegoMaterial(LEGO_COLORS.orange),
      yellowHazard: getLegoMaterial(LEGO_COLORS.yellow),
      policeBullet: new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      missileBody: getLegoMaterial(0xe11d48, { emissive: 0xbe123c, emissiveIntensity: 0.5 }),
      energyNetWire: new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.92
      })
    };
  },

  _attachPoliceLightbar(carMesh, roofY = 1.65) {
    const G = getSharedPursuitGeos();
    const group = new THREE.Group();
    group.position.set(0, roofY, -0.1);
    const base = new THREE.Mesh(G.lightbarBaseGeo, this.mats.gunSteel);
    const strobeRed = new THREE.Mesh(G.lightbarRedGeo, this.mats.strobeRedOn);
    const strobeBlue = new THREE.Mesh(G.lightbarBlueGeo, this.mats.strobeBlueOn);
    group.add(base, strobeRed, strobeBlue);
    carMesh.add(group);
    return { strobeRed, strobeBlue };
  }
};
