import * as THREE from 'three';
import { LEGO_COLORS, createLegoBrick } from '../../materials/LegoMaterials.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import {
  IS_SCALED_WORLD,
  ROAD,
  DESIGN_MAIN_AVENUES_Z,
  ws,
  fromWs,
  wsStreetAnchored
} from '../core/WorldLayoutScale.js';
import { getScaledUrbanCurbLiftAt } from '../terrain/UrbanSidewalkAndBlockBuilder.js';
import { getSharedTemplates } from './StreetPropTemplates.js';

const MAIN_Z_SET = new Set(DESIGN_MAIN_AVENUES_Z);

// ============================================================================
// VALIDAÇÃO ESPACIAL RÁPIDA DE CALÇADAS / PRAÇAS / ACOSTAMENTOS
// ============================================================================
function isProtectedZone(x, z) {
  const ux = fromWs(x);
  const uz = fromWs(z);
  if (Math.abs(x) < 17 && uz > -148 && uz < -112) return true;
  if (ux > 14 && ux < 104 && uz > -490 && uz < -406) return true;
  if (ux > -368 && ux < -268 && uz > -230 && uz < -130) return true;
  if (ux > -742 && ux < -688 && uz > -162 && uz < -108) return true;
  if (Math.abs(x) < 6 && Math.abs(z - ws(-88)) < 6) return true;
  if (uz > 1072 && Math.abs(x) < 36) return true;
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
    if (!IS_SCALED_WORLD) {
      return baseTerrain + (onRoadSurface ? 0.04 : 0.28);
    }
    if (onRoadSurface) return baseTerrain + 0.04;
    return getScaledUrbanCurbLiftAt(world, px, pz) > 0.05
      ? baseTerrain + 0.02
      : baseTerrain + ROAD.curbHeight;
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

  const mainHalfW = ROAD.mainWidth * 0.5;
  const secHalfW = ROAD.secondaryWidth * 0.5;
  const halfZRoad = (dz) => (MAIN_Z_SET.has(dz) ? mainHalfW : secHalfW);

  // --------------------------------------------------------------------------
  // 1. POSTES DE LUZ (~88) E SEMÁFOROS (~40) NA FAIXA DE SERVIÇO DE 2m DAS AVENIDAS
  // --------------------------------------------------------------------------
  const designMainAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
  const lampZStops = [-960, -820, -690, -560, -440, -310, -185, -60, 68, 210, 330, 480, 630];
  const lampCurbOff = IS_SCALED_WORLD ? mainHalfW + 1.7 : 15.6;

  for (let ia = 0; ia < designMainAvenuesX.length; ia++) {
    const ax = ws(designMainAvenuesX[ia]);
    for (let iz = 0; iz < lampZStops.length; iz++) {
      const lz = ws(lampZStops[iz]);
      const side = (ia + iz) % 2 === 0 ? -1 : 1;
      const lx = ax + side * lampCurbOff;
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

  // Postes extras na Orla da Praia e Rodovia do Aeroporto
  const beachLampZ = IS_SCALED_WORLD ? ws(710) + mainHalfW + 1.8 : 726.5;
  for (let bx = -460; bx <= 460; bx += 76) {
    spawnSharedProp({
      x: ws(bx),
      z: beachLampZ,
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
  const westHwyLampZ = IS_SCALED_WORLD ? ws(-117) - mainHalfW - 1.8 : -133.0;
  for (let wx = -1420; wx <= -720; wx += 115) {
    spawnSharedProp({
      x: ws(wx),
      z: westHwyLampZ,
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

  // Semáforos Destrutíveis LEGO nos cruzamentos principais (faixa de serviço de esquina)
  const tlIntersectionsZ = [-644, -512, -382, -250, -117, 0, 134, 402, 710];
  for (let ia = 0; ia < designMainAvenuesX.length; ia++) {
    for (let iz = 0; iz < tlIntersectionsZ.length; iz++) {
      if ((ia + iz) % 2 !== 0 && iz > 1 && iz < 7) continue;
      const dax = designMainAvenuesX[ia];
      const diz = tlIntersectionsZ[iz];
      const ix = ws(dax) - (IS_SCALED_WORLD ? mainHalfW + 1.8 : 15.6);
      const jz = ws(diz) - (IS_SCALED_WORLD ? halfZRoad(diz) + 1.8 : 15.6);
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
  // 2. HIDRANTES VERMELHOS LEGO NAS ESQUINAS (~52)
  // --------------------------------------------------------------------------
  const hydrantGridZ = [-908, -776, -644, -512, -382, -250, -117, 0, 134, 402, 710];
  for (let ia = 0; ia < designMainAvenuesX.length; ia++) {
    for (let iz = 0; iz < hydrantGridZ.length; iz++) {
      if ((ia * 3 + iz) % 2 !== 0) continue;
      const dax = designMainAvenuesX[ia];
      const dhz = hydrantGridZ[iz];
      const hx = ws(dax) - (IS_SCALED_WORLD ? mainHalfW + 1.6 : 15.4);
      const hz = ws(dhz) + (IS_SCALED_WORLD ? halfZRoad(dhz) + 1.6 : 15.4);
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
  const extraHydrants = [
    [-15, -100], [15, -100], [-15, -130], [15, -130],
    [-15.2, -16], [15.2, -16], [-15.2, 16], [15.2, 16],
    [616, -234], [784, -234], [-1160, -100], [-500, -100]
  ];
  for (const [rawHx, rawHz] of extraHydrants) {
    const p = IS_SCALED_WORLD
      ? Math.abs(rawHx) < 20
        ? { x: Math.sign(rawHx) * (mainHalfW + 1.6), z: wsStreetAnchored(rawHx, rawHz, { halfD: 0.5 }).z }
        : wsStreetAnchored(rawHx, rawHz, { halfW: 0.5, halfD: 0.5 })
      : { x: rawHx, z: rawHz };
    spawnSharedProp({
      x: p.x,
      z: p.z,
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
  // 3. PONTOS DE ÔNIBUS (~26), CABINES TELEFÔNICAS (~24) & BANCAS (~20)
  // --------------------------------------------------------------------------
  const busStopOff = IS_SCALED_WORLD ? mainHalfW + 2.1 : 16.8;
  const aveBusStops = [
    [-384, 1, -315, -Math.PI / 2], [-384, -1, -55, Math.PI / 2], [-384, 1, 260, -Math.PI / 2],
    [-252, 1, -445, -Math.PI / 2], [-252, -1, -60, Math.PI / 2], [-252, 1, 220, -Math.PI / 2],
    [-120, -1, -575, Math.PI / 2], [-120, 1, -315, -Math.PI / 2], [-120, -1, -55, Math.PI / 2], [-120, 1, 265, -Math.PI / 2],
    [0, -1, -575, Math.PI / 2], [0, 1, -210, -Math.PI / 2], [0, -1, 220, Math.PI / 2], [0, 1, 520, -Math.PI / 2],
    [120, 1, -575, -Math.PI / 2], [120, -1, -315, Math.PI / 2], [120, 1, -55, -Math.PI / 2], [120, -1, 265, Math.PI / 2],
    [252, -1, -445, Math.PI / 2], [252, 1, 220, -Math.PI / 2],
    [384, -1, -315, Math.PI / 2], [384, 1, -55, -Math.PI / 2], [384, -1, 265, Math.PI / 2]
  ];
  const busStopSpots = [
    ...aveBusStops.map(([dax, side, dbz, brot]) => [ws(dax) + side * busStopOff, ws(dbz), brot]),
    [ws(-185), IS_SCALED_WORLD ? ws(710) + mainHalfW + 2.1 : 726.8, Math.PI],
    [ws(65), IS_SCALED_WORLD ? ws(710) + mainHalfW + 2.1 : 726.8, Math.PI],
    [ws(-960), IS_SCALED_WORLD ? ws(-117) + mainHalfW + 2.1 : -100.5, 0]
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

  const boothOff = IS_SCALED_WORLD ? mainHalfW + 1.9 : 16.2;
  const phoneBoothSpots = [];
  for (const dax of designMainAvenuesX) {
    for (const pz of [-680, -335, -80, 175]) {
      phoneBoothSpots.push([ws(dax) + boothOff, ws(pz), -Math.PI / 2]);
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
  newsstandSpots.forEach(([rawNx, rawNz, nrot], idx) => {
    const np = wsStreetAnchored(rawNx, rawNz, { halfW: 1.4, halfD: 1.0 });
    const awningMats = [M.red, M.blue, M.green, M.orange];
    const awningHexes = [LEGO_COLORS.red, LEGO_COLORS.blue, LEGO_COLORS.green, LEGO_COLORS.orange];
    spawnSharedProp({
      x: np.x,
      z: np.z,
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
  // 4. CAIXAS ELETRÔNICOS (ATMs LEGO — ~28) JUNTO À BORDA INTERNA DA CALÇADA
  // --------------------------------------------------------------------------
  const atmSpots = [
    [-85, -100.5, Math.PI], [85, -100.5, Math.PI],
    [-185, -133.5, 0], [185, -133.5, 0],
    [-185, -266.5, 0], [185, -266.5, 0],
    [-58, -266.5, 0], [58, -266.5, 0],
    [-315, -100.5, Math.PI], [315, -100.5, Math.PI],
    [-315, -266.5, 0], [315, -266.5, 0],
    [-58, -398.5, 0], [185, -398.5, 0], [-185, -398.5, 0],
    [-185, -16.5, 0], [185, -16.5, 0],
    [-315, -16.5, 0], [315, -16.5, 0],
    [-60, -660.5, 0], [60, -660.5, 0], [-190, -792.5, 0], [190, -792.5, 0],
    [-210, 693.5, 0], [-60, 693.5, 0], [90, 693.5, 0], [210, 693.5, 0],
    [-1220, -100.5, Math.PI]
  ];
  for (const [rawAx, rawAz, arot] of atmSpots) {
    const ap = wsStreetAnchored(rawAx, rawAz, { halfW: 0.7, halfD: 0.6 });
    spawnSharedProp({
      x: ap.x,
      z: ap.z,
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
  // 5. CARRINHOS DE HOT-DOG/PIPOCA/SORVETE (~34) + MESINHAS COM GUARDA-SOL (~40)
  // --------------------------------------------------------------------------
  const foodCartSpots = [
    [-38, -82, 0], [38, -82, 0], [-45, 22, 0], [45, 22, 0],
    [-95, 55, Math.PI / 2], [95, 55, -Math.PI / 2],
    [-45, 114, Math.PI], [45, 114, Math.PI],
    [-420, 732, Math.PI], [-330, 732, Math.PI], [-235, 732, Math.PI], [-150, 732, Math.PI],
    [-75, 732, Math.PI], [48, 732, Math.PI], [155, 732, Math.PI], [240, 732, Math.PI],
    [345, 732, Math.PI], [430, 732, Math.PI],
    [-40, 1085, Math.PI / 2], [40, 1085, -Math.PI / 2],
    [-40, 1165, Math.PI / 2], [40, 1165, -Math.PI / 2],
    [-137, -45, Math.PI / 2], [137, -45, -Math.PI / 2],
    [-268, -165, Math.PI / 2], [268, -165, -Math.PI / 2],
    [-75, -530, 0], [75, -530, 0], [-165, -662, 0], [165, -662, 0],
    [-75, -794, 0], [75, -794, 0],
    [-1080, -100, 0], [620, -100, 0]
  ];
  foodCartSpots.forEach(([rawFx, rawFz, frot], idx) => {
    const fp = rawFz > 1000
      ? { x: rawFx, z: ws(rawFz) }
      : wsStreetAnchored(rawFx, rawFz, { halfW: 1.0, halfD: 0.8 });
    const variant = idx % 3;
    const bodyMat = variant === 0 ? M.red : variant === 1 ? M.yellow : M.cyan;
    const canopyMat = variant === 0 ? M.yellow : variant === 1 ? M.red : M.pink;
    const c1 = variant === 0 ? LEGO_COLORS.red : variant === 1 ? LEGO_COLORS.yellow : 0x06b6d4;
    const c2 = variant === 0 ? LEGO_COLORS.yellow : variant === 1 ? LEGO_COLORS.red : 0xf472b6;
    spawnSharedProp({
      x: fp.x,
      z: fp.z,
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

  cafeSpots.forEach(([rawCx, rawCz, crot], idx) => {
    const cp = rawCz === 738.0
      ? { x: ws(rawCx), z: IS_SCALED_WORLD ? ws(710) + mainHalfW + 14.0 : 738.0 }
      : wsStreetAnchored(rawCx, rawCz, { halfW: 1.2, halfD: 1.0 });
    const umbMats = [M.red, M.yellow, M.cyan, M.orange, M.pink, M.blue];
    const umbHexes = [LEGO_COLORS.red, LEGO_COLORS.yellow, 0x06b6d4, LEGO_COLORS.orange, 0xf472b6, LEGO_COLORS.blue];
    spawnSharedProp({
      x: cp.x,
      z: cp.z,
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
  // 6. LIXEIRAS (~36), CAÇAMBAS (~18), BANCOS (~32), PLACAS (~28) & CONES (~75)
  // --------------------------------------------------------------------------
  const trashZ = [-850, -600, -350, -195, -40, 90, 290, 560];
  const trashOff = IS_SCALED_WORLD ? mainHalfW + 1.6 : 15.2;
  let trashToggle = 0;
  for (const dax of designMainAvenuesX) {
    for (const tz of trashZ) {
      if ((trashToggle++ % 3) === 1) continue;
      const side = trashToggle % 2 === 0 ? 1 : -1;
      const useBlue = trashToggle % 4 === 0;
      spawnSharedProp({
        x: ws(dax) + side * trashOff,
        z: ws(tz),
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

  const dumpsterSpots = [
    [-205, -232, 0], [205, -232, 0], [-335, -364, 0], [335, -364, 0],
    [-75, -364, 0], [205, -496, 0], [-205, -496, 0],
    [-465, -232, 0], [465, -232, 0], [-465, 18, 0], [465, 18, 0],
    [622, -180, Math.PI / 2], [750, -320, 0], [945, -180, Math.PI / 2],
    [-630, -560, 0], [630, -560, 0], [-920, -135, 0], [-1310, -135, 0]
  ];
  dumpsterSpots.forEach(([rawDx, rawDz, drot], idx) => {
    const dp = wsStreetAnchored(rawDx, rawDz, { halfW: 1.2, halfD: 0.8 });
    const isYellow = idx % 2 === 0;
    spawnSharedProp({
      x: dp.x,
      z: dp.z,
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
  for (const [rawBx, rawBz, brot] of benchSpots) {
    let bp;
    if (rawBz > 1000) {
      bp = { x: rawBx, z: ws(rawBz) };
    } else if (rawBz === 725) {
      bp = { x: ws(rawBx), z: IS_SCALED_WORLD ? ws(710) + mainHalfW + 1.9 : 725 };
    } else if (IS_SCALED_WORLD && Math.abs(Math.abs(rawBx) - 136) < 0.5) {
      bp = { x: ws(Math.sign(rawBx) * 120) + Math.sign(rawBx) * (mainHalfW + 1.9), z: ws(rawBz) };
    } else {
      bp = wsStreetAnchored(rawBx, rawBz, { halfW: 1.1, halfD: 0.5 });
    }
    spawnSharedProp({
      x: bp.x,
      z: bp.z,
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

  let signIdx = 0;
  for (const dax of designMainAvenuesX) {
    for (const dsz of [-776, -512, -250, 134, 402]) {
      if ((signIdx++ % 3) === 2) continue;
      const isStop = signIdx % 2 === 0;
      spawnSharedProp({
        x: ws(dax) + (IS_SCALED_WORLD ? mainHalfW + 1.6 : 15.2),
        z: ws(dsz) - (IS_SCALED_WORLD ? halfZRoad(dsz) + 1.8 : 15.8),
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

  // Fileiras de Cones Laranjas & Barricadas nos acostamentos das grandes avenidas
  const shoulderOff = mainHalfW - 1.4; // 12.6m em 1x, 15.6m em 3x
  const coneStreaks = [
    { startX: -shoulderOff, startZ: ws(-240), dx: 0, dz: 3.2, count: 6, barricadeEnd: true },
    { startX: shoulderOff, startZ: ws(165), dx: 0, dz: 3.2, count: 6, barricadeEnd: true },
    { startX: ws(-120) + shoulderOff, startZ: ws(-460), dx: 0, dz: 3.2, count: 5, barricadeEnd: true },
    { startX: ws(120) - shoulderOff, startZ: ws(-210), dx: 0, dz: 3.2, count: 5, barricadeEnd: true },
    { startX: ws(252) + shoulderOff, startZ: ws(175), dx: 0, dz: 3.2, count: 6, barricadeEnd: true },
    { startX: ws(-252) - shoulderOff, startZ: ws(-340), dx: 0, dz: 3.2, count: 5, barricadeEnd: true },
    { startX: ws(-320), startZ: ws(710) - shoulderOff, dx: 3.5, dz: 0, count: 6, barricadeEnd: true },
    { startX: ws(150), startZ: ws(710) - shoulderOff, dx: 3.5, dz: 0, count: 6, barricadeEnd: true },
    { startX: ws(-880), startZ: ws(-117) - (mainHalfW - 1.5), dx: -4.0, dz: 0, count: 6, barricadeEnd: true },
    { startX: ws(-1180), startZ: ws(-117) + (mainHalfW - 1.5), dx: -4.0, dz: 0, count: 6, barricadeEnd: true },
    { startX: ws(535), startZ: ws(-117) - (mainHalfW - 1.8), dx: 3.6, dz: 0, count: 5, barricadeEnd: false },
    { startX: -shoulderOff, startZ: ws(-740), dx: 0, dz: -3.4, count: 6, barricadeEnd: true }
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
        noCollider: true
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

  // Barricadas Laranjas nos acostamentos dos Viadutos Elevados (junto à mureta, fora das faixas!)
  const viadEdgeOff = mainHalfW - 1.6; // 12.4m em 1x (-382 - 12.4 = -394.4), 15.4m em 3x
  const viaductBarricades = [
    { x: ws(-110), z: ws(-382) - viadEdgeOff, refY: 40.0, rotY: 0 },
    { x: ws(-110) + 4, z: ws(-382) - viadEdgeOff, refY: 40.0, rotY: 0 },
    { x: ws(110), z: ws(-382) - viadEdgeOff, refY: 40.0, rotY: 0 },
    { x: ws(110) + 4, z: ws(-382) - viadEdgeOff, refY: 40.0, rotY: 0 },
    { x: ws(252) + viadEdgeOff, z: ws(60), refY: 40.0, rotY: Math.PI / 2 },
    { x: ws(252) + viadEdgeOff, z: ws(60) + 4, refY: 40.0, rotY: Math.PI / 2 }
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
    [-19, -98, 0, LEGO_COLORS.orange],
    [-19, -98, -1.6, LEGO_COLORS.yellow],
    [19, -98, 0, LEGO_COLORS.blue],
    [19, -98, 1.6, LEGO_COLORS.green],
    [-19, -18, 0, LEGO_COLORS.orange],
    [19, -18, 0, LEGO_COLORS.blue],
    [680, -340, 0, LEGO_COLORS.red],
    [680, -340, 2.0, LEGO_COLORS.yellow]
  ];
  for (const [rawCx, rawCz, localDx, color] of crateData) {
    const cp = wsStreetAnchored(rawCx, rawCz, { halfW: 0.8, halfD: 0.8 });
    const cx = cp.x + localDx;
    const cz = cp.z;
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
