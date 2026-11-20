import * as THREE from 'three';
import { LEGO_COLORS, createLegoBrick } from '../../materials/LegoMaterials.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { getSharedTemplates } from './StreetPropTemplates.js';

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

  // Registry de Instancing para reduzir ~1.200+ Draw Calls dos ~450 objetos de rua para ~24 Draw Calls!
  const instPoolByKey = new Map();
  const dirtyInstPools = new Set();
  const propSlots = [];
  const _pMat4 = new THREE.Matrix4();
  const _pQuat = new THREE.Quaternion();
  const _pScaleOne = new THREE.Vector3(1, 1, 1);
  const _pScaleZero = new THREE.Vector3(0, 0, 0);

  const registerInstancedPart = (geo, mat, dProxy) => {
    let byMat = instPoolByKey.get(geo);
    if (!byMat) {
      byMat = new Map();
      instPoolByKey.set(geo, byMat);
    }
    let pool = byMat.get(mat);
    if (!pool) {
      pool = { geo, mat, entries: [], inst: null, dirty: false };
      byMat.set(mat, pool);
    }
    const slot = pool.entries.length;
    pool.entries.push(dProxy);
    return { pool, slot };
  };

  const syncStreetPropInstance = (obj) => {
    const slots = obj._propInstSlots;
    if (!slots) return;
    const isVisible = Boolean(obj.mesh && obj.mesh.visible && !obj.destroyed);
    _pQuat.setFromEuler(obj.mesh.rotation);
    _pMat4.compose(obj.mesh.position, _pQuat, isVisible ? _pScaleOne : _pScaleZero);
    for (let i = 0; i < slots.length; i++) {
      const { pool, slot } = slots[i];
      if (!pool.inst) continue;
      pool.inst.setMatrixAt(slot, _pMat4);
      if (!pool.dirty) {
        pool.dirty = true;
        dirtyInstPools.add(pool);
      }
    }
  };

  const flushStreetPropInstances = () => {
    if (dirtyInstPools.size === 0) return;
    for (const pool of dirtyInstPools) {
      if (pool.inst) {
        pool.inst.instanceMatrix.needsUpdate = true;
      }
      pool.dirty = false;
    }
    dirtyInstPools.clear();
  };

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

    // Grupo-proxy leve (0 nós na scene!) — a geometria 3D é desenhada via InstancedMesh compartilhada
    const group = new THREE.Group();
    group.userData.isOptimizedGroup = true;
    group.position.set(x, yBase, z);
    group.rotation.y = rotY;

    const slots = [];
    for (let i = 0; i < parts.length; i++) {
      slots.push(registerInstancedPart(parts[i].geo, parts[i].mat, group));
    }

    const colliders = [];
    if (!noCollider) {
      const swap = Math.abs(Math.sin(rotY)) > 0.707;
      const cw = swap ? colD : colW;
      const cd = swap ? colW : colD;
      colliders.push(world.addCollider(x, z, cw, cd, yBase + height, yBase));
    }

    placedList.push({ x, y: yBase, z });

    if (world.destructibles) {
      const dObj = world.destructibles.registerDestructible({
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
      dObj._propInstSlots = slots;
      dObj._syncInstancedVisual = syncStreetPropInstance;
      propSlots.push(dObj);
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
    // (os 4 caixas da calçada do Super Banco foram para dentro do saguão)
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
  // (no acostamento, encostadas na mureta: as faixas do viaduto ficam livres)
  const viaductBarricades = [
    { x: -110, z: -394.4, refY: 40.0, rotY: 0 },
    { x: -106, z: -394.4, refY: 40.0, rotY: 0 },
    { x: 110, z: -394.4, refY: 40.0, rotY: 0 },
    { x: 114, z: -394.4, refY: 40.0, rotY: 0 },
    { x: 264.4, z: 60, refY: 40.0, rotY: Math.PI / 2 },
    { x: 264.4, z: 64, refY: 40.0, rotY: Math.PI / 2 }
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

  // Consolida todos os StreetProps em lotes InstancedMesh (~24 Draw Calls no total!)
  for (const byMat of instPoolByKey.values()) {
    for (const pool of byMat.values()) {
      const count = pool.entries.length;
      if (count === 0) continue;
      const inst = new THREE.InstancedMesh(pool.geo, pool.mat, count);
      inst.castShadow = false;
      inst.receiveShadow = false;
      inst.frustumCulled = false;
      inst.matrixAutoUpdate = false;
      inst.updateMatrix();
      for (let i = 0; i < count; i++) {
        const proxy = pool.entries[i];
        _pQuat.setFromEuler(proxy.rotation);
        _pMat4.compose(proxy.position, _pQuat, _pScaleOne);
        inst.setMatrixAt(i, _pMat4);
      }
      inst.instanceMatrix.needsUpdate = true;
      pool.inst = inst;
      world.scene.add(inst);
    }
  }
  if (world.destructibles) {
    world.destructibles._flushStreetPropInstancedBatches = flushStreetPropInstances;
  }
}
