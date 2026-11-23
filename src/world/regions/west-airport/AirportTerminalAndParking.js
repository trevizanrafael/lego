import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import { makeFastBox, mergeColoredGeometries } from '../../BuildingGenerator.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { IS_SCALED_WORLD, ROAD, ws } from '../../core/WorldLayoutScale.js';
import {
  getSharedPeripheryStandardVcMaterial,
  getSharedPeripheryBasicVcMaterial
} from '../../terrain/NaturalPeripheryBuilder.js';

const WEST_AIRPORT_LOD_DIST = 340;

const WEST_SECTOR_ORIGINS = [
  { key: 'airfield_south', originX: ws(-1360), originZ: 0 },
  { key: 'north_mil', originX: ws(-1420), originZ: ws(-980) }
];

const WEST_PALETTE = {
  steel_silver: { color: new THREE.Color(LEGO_COLORS.silver), basic: false },
  steel_dark: { color: new THREE.Color(0x334155), basic: false },
  charcoal: { color: new THREE.Color(0x1e293b), basic: false },
  asphalt_dark: { color: new THREE.Color(0x0f172a), basic: false },
  apron_concrete: { color: new THREE.Color(0x2a323f), basic: false },
  airfield_turf: { color: new THREE.Color(0x1f3622), basic: false },
  airfield_verge: { color: new THREE.Color(0x284028), basic: false },
  ditch_channel: { color: new THREE.Color(0x111722), basic: false },
  coastal_rock: { color: new THREE.Color(0x363e4a), basic: false },
  coastal_scrub: { color: new THREE.Color(0x2c4724), basic: false },
  concrete_wall: { color: new THREE.Color(0x94a3b8), basic: false },
  terminal_floor: { color: new THREE.Color(0xdbe3ee), basic: false },
  white_clean: { color: new THREE.Color(0xe2e8f0), basic: false },
  aviation_red: { color: new THREE.Color(0xc82424), basic: false },
  aviation_blue: { color: new THREE.Color(0x0369a1), basic: false },
  sky_blue: { color: new THREE.Color(0x0284c7), basic: false },
  highway_green: { color: new THREE.Color(0x15803d), basic: false },
  military_olive: { color: new THREE.Color(0x3f6212), basic: false },
  military_dark: { color: new THREE.Color(0x1a2e05), basic: false },
  camo_tan: { color: new THREE.Color(0xa16207), basic: false },
  gold_trim: { color: new THREE.Color(LEGO_COLORS.gold), basic: false },
  orange_windsock: { color: new THREE.Color(0xea580c), basic: false },
  glass_mirror: { color: new THREE.Color(0x0c4a6e), basic: false },
  glass_cockpit: { color: new THREE.Color(0x0369a1), basic: false },
  mark_white: { color: new THREE.Color(0xf1f5f9), basic: true },
  mark_yellow: { color: new THREE.Color(0xfacc15), basic: true },
  light_green: { color: new THREE.Color(0x22c55e), basic: true },
  light_red: { color: new THREE.Color(0xef4444), basic: true },
  light_warm: { color: new THREE.Color(0xfef08a), basic: true },
  light_cyan: { color: new THREE.Color(0x00f0ff), basic: true }
};

const WEST_SHADOW_KEYS = new Set([
  'white_clean',
  'aviation_red',
  'aviation_blue',
  'military_olive',
  'military_dark',
  'concrete_wall'
]);

let _radarMergedGeo = null;

function getSharedAtcRadarGeo() {
  if (!_radarMergedGeo) {
    _radarMergedGeo = markAsSharedAsset(
      mergeColoredGeometries([
        { geo: makeFastBox(17.0, 4.0, 2.4, 0, 0, 0), color: new THREE.Color(LEGO_COLORS.yellow) },
        { geo: makeFastBox(2.2, 2.0, 6.2, 0, 0, 2.6), color: new THREE.Color(LEGO_COLORS.silver) }
      ])
    );
  }
  return _radarMergedGeo;
}

/**
 * Batcher Vertex-Color 2-Níveis `THREE.LOD` (`340 m`) do Aeroporto & Base Militar Oeste:
 * - Zero `MeshPhysicalMaterial` (usa 1 `MeshStandardMaterial` + 1 `MeshBasicMaterial` compartilhados).
 * - Nível 0 (0..340m): todas as estruturas, detalhes, marcações de pista, balizas e carros estacionados.
 * - Nível 1 (>=340m): apenas macroestruturas (`Math.max(w, h, d) >= 3.5`), `castShadow = false`.
 */
export function createWestBatcher() {
  const chunks = new Map();
  const basicEntries = [];
  const basicOriginX = ws(-1380);
  const basicOriginZ = ws(-240);

  const getChunk = (_wx, wz) => {
    const sec = wz < ws(-610) ? WEST_SECTOR_ORIGINS[1] : WEST_SECTOR_ORIGINS[0];
    let ch = chunks.get(sec.key);
    if (!ch) {
      ch = {
        key: sec.key,
        originX: sec.originX,
        originZ: sec.originZ,
        l0Pbr: [],
        l1Pbr: [],
        hasShadowCaster: false
      };
      chunks.set(sec.key, ch);
    }
    return ch;
  };

  const pushBoxTile = (spec, key, w, h, d, x, y, z, isMacroL1) => {
    if (spec.basic) {
      basicEntries.push({
        geo: makeFastBox(w, h, d, x - basicOriginX, y, z - basicOriginZ),
        color: spec.color
      });
      return;
    }
    const ch = getChunk(x, z);
    const fast = makeFastBox(w, h, d, x - ch.originX, y, z - ch.originZ);
    ch.l0Pbr.push({ geo: fast, color: spec.color });
    if (WEST_SHADOW_KEYS.has(key) && h >= 2.2) {
      ch.hasShadowCaster = true;
    }
    if (isMacroL1) {
      ch.l1Pbr.push({ geo: fast, color: spec.color });
    }
  };

  return {
    addBox(key, w, h, d, x, y, z) {
      const spec = WEST_PALETTE[key];
      if (!spec) return;
      const isMacroL1 = !spec.basic && Math.max(w, h, d) >= 3.5 && h >= 0.08 && Math.min(w, d) >= 0.4;
      pushBoxTile(spec, key, w, h, d, x, y, z, isMacroL1);
    },

    addCylinder(key, rTop, rBottom, h, x, y, z, segs = 8) {
      const spec = WEST_PALETTE[key];
      if (!spec) return;
      if (spec.basic) {
        const gb = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
        gb.translate(x - basicOriginX, y, z - basicOriginZ);
        basicEntries.push({ geo: gb, color: spec.color });
        return;
      }
      const ch = getChunk(x, z);
      const lx = x - ch.originX;
      const lz = z - ch.originZ;
      const g = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
      g.translate(lx, y, lz);
      ch.l0Pbr.push({ geo: g, color: spec.color });
      const span = Math.max(rTop * 2, rBottom * 2, h);
      if (span >= 3.5) {
        const dEst = Math.max(rTop, rBottom) * 1.85;
        ch.l1Pbr.push({ geo: makeFastBox(dEst, h, dEst, lx, y, lz), color: spec.color });
      }
    },

    flush(scene) {
      const stdMat = getSharedPeripheryStandardVcMaterial();
      const basicMat = getSharedPeripheryBasicVcMaterial();

      for (const ch of chunks.values()) {
        if (ch.l0Pbr.length === 0) continue;

        const lod = new THREE.LOD();
        lod.name = `WestAirportLOD_${ch.key}`;
        lod.position.set(ch.originX, 0, ch.originZ);
        lod.userData = { isWestAirportLod: true, chunkKey: ch.key, skipStaticMerge: true };

        const level0 = new THREE.Group();
        const g0 = mergeColoredGeometries(ch.l0Pbr);
        g0.computeBoundingBox();
        g0.computeBoundingSphere();
        const m0 = new THREE.Mesh(g0, stdMat);
        m0.castShadow = ch.hasShadowCaster;
        m0.receiveShadow = true;
        m0.matrixAutoUpdate = false;
        m0.updateMatrix();
        m0.userData.skipStaticMerge = true;
        level0.add(m0);

        const level1 = new THREE.Group();
        if (ch.l1Pbr.length > 0) {
          const g1 = mergeColoredGeometries(ch.l1Pbr);
          g1.computeBoundingBox();
          g1.computeBoundingSphere();
          const m1 = new THREE.Mesh(g1, stdMat);
          m1.castShadow = false;
          m1.receiveShadow = true;
          m1.matrixAutoUpdate = false;
          m1.updateMatrix();
          m1.userData.skipStaticMerge = true;
          level1.add(m1);
        }

        lod.addLevel(level0, 0);
        lod.addLevel(level1, WEST_AIRPORT_LOD_DIST);
        level0.visible = true;
        level1.visible = false;
        scene.add(lod);
      }

      if (basicEntries.length > 0) {
        const gb = mergeColoredGeometries(basicEntries);
        gb.computeBoundingBox();
        gb.computeBoundingSphere();
        const mb = new THREE.Mesh(gb, basicMat);
        mb.name = 'WestAirportBasicMarkings';
        mb.position.set(basicOriginX, 0, basicOriginZ);
        mb.castShadow = false;
        mb.receiveShadow = false;
        mb.matrixAutoUpdate = false;
        mb.updateMatrix();
        scene.add(mb);
      }

      chunks.clear();
      basicEntries.length = 0;
    }
  };
}

/**
 * Cria um pátio aeronáutico/militar justo (tarmac + borda de grama aparada + colisor em `groundY = 0.28`)
 * substituindo os antigos lajões retangulares de 2.4km x 4km.
 */
export function addTightAirportApronPad(world, batcher, cx, cz, w, d, groundY, opts = {}) {
  const matKey = opts.matKey || 'apron_concrete';
  const turfBorder = opts.turfBorder ?? 14;
  if (turfBorder > 0) {
    batcher.addBox('airfield_turf', w + turfBorder * 2, 0.24, d + turfBorder * 2, cx, 0.02, cz);
  }
  batcher.addBox(matKey, w, groundY + 0.32, d, cx, (groundY - 0.32) * 0.5, cz);
  world.addCollider(cx, cz, w, d, groundY, -1.8);
  if (opts.mapColor) {
    world.mapBlocks.push({ x: cx, z: cz, w, d, color: opts.mapColor });
  }
}

function addExpressHighwayStripX(world, batcher, groundY, xEast, xWest, z, roadW, isMain = true) {
  const len = xEast - xWest;
  if (len <= 1) return;
  const cx = (xEast + xWest) * 0.5;
  batcher.addBox('airfield_verge', len + 8, 0.24, roadW + 14, cx, 0.02, z);
  batcher.addBox('apron_concrete', len + 2, groundY + 0.28, roadW + 6, cx, (groundY - 0.28) * 0.5, z);
  batcher.addBox('asphalt_dark', len, 0.08, roadW, cx, groundY + 0.04, z);
  batcher.addBox('mark_yellow', len - 4, 0.04, 0.35, cx, groundY + 0.095, z - 0.45);
  batcher.addBox('mark_yellow', len - 4, 0.04, 0.35, cx, groundY + 0.095, z + 0.45);
  for (let dx = xWest + 12; dx <= xEast - 12; dx += 20) {
    batcher.addBox('mark_white', 7.5, 0.04, 0.25, dx, groundY + 0.095, z - roadW * 0.25);
    batcher.addBox('mark_white', 7.5, 0.04, 0.25, dx, groundY + 0.095, z + roadW * 0.25);
  }
  world.addCollider(cx, z, len + 4, roadW + 8, groundY, -1.5);
  world.mapRoads.push({ x: cx, z, w: len, d: roadW, isMain });
}

/**
 * 1. RODOVIA EXPRESSA + PERÍMETRO DE SEGURANÇA + PÁTIO JUSTO DO TERMINAL & ESTACIONAMENTO
 */
export function buildExpresswaySecurityAndParkingLot(world, batcher, groundY) {
  if (!IS_SCALED_WORLD) {
    // Pátio justo do Terminal + Estacionamento + Guaritas em 1x (226m x 1030m)
    addTightAirportApronPad(world, batcher, -1126, 0, 228, 1030, groundY, {
      matKey: 'apron_concrete',
      mapColor: '#262f3d'
    });

    const gantries = [
      { x: -1018, z: -117, text: 'AEROPORTO / BASE MILITAR ' },
      { x: -1018, z: 0, text: 'MEGA TERMINAL & ESTACIONAMENTO ' },
      { x: -1018, z: 134, text: 'BASE MILITAR & HANGARES ' }
    ];
    for (const g of gantries) {
      batcher.addBox('steel_silver', 1.2, 11.5, 1.2, g.x, 5.75, g.z - 16.5);
      batcher.addBox('steel_silver', 1.2, 11.5, 1.2, g.x, 5.75, g.z + 16.5);
      batcher.addBox('steel_silver', 1.0, 1.2, 34.2, g.x, 11.2, g.z);
      world.addCollider(g.x, g.z - 16.5, 1.4, 1.4, 11.5, 0);
      world.addCollider(g.x, g.z + 16.5, 1.4, 1.4, 11.5, 0);
      addHighwayGreenSign(world, g.x, 11.2, g.z, 28.0, 4.2, g.text);
    }

    const fenceX = -1020;
    const isGateZ = (z) =>
      Math.abs(z + 340) < 18 ||
      Math.abs(z + 117) < 20 ||
      Math.abs(z) < 22 ||
      Math.abs(z - 134) < 20 ||
      Math.abs(z - 340) < 18;

    for (let fz = -640; fz <= 640; fz += 20) {
      if (isGateZ(fz)) continue;
      batcher.addBox('concrete_wall', 1.2, 1.4, 19.6, fenceX, groundY + 0.7, fz);
      batcher.addBox('steel_dark', 0.45, 2.8, 0.45, fenceX, groundY + 2.8, fz - 9.5);
      batcher.addBox('steel_silver', 0.2, 0.25, 19.6, fenceX, groundY + 2.6, fz);
      batcher.addBox('steel_silver', 0.2, 0.25, 19.6, fenceX, groundY + 3.9, fz);
      world.addCollider(fenceX, fz, 1.4, 19.8, groundY + 4.3, groundY);
    }

    for (const gz of [-340, -117, 0, 134, 340]) {
      batcher.addBox('aviation_blue', 4.2, 1.6, 36.0, -1026, groundY + 7.8, gz);
      for (const side of [-1, 1]) {
        const bz = gz + side * 17.5;
        batcher.addBox('white_clean', 5.8, 4.2, 4.4, -1026, groundY + 2.1, bz);
        batcher.addBox('glass_cockpit', 6.0, 1.6, 3.8, -1026, groundY + 2.5, bz);
        batcher.addBox('aviation_blue', 6.6, 0.65, 5.2, -1026, groundY + 4.5, bz);
        world.addCollider(-1026, bz, 6.0, 4.6, groundY + 4.8, groundY);

        const turnstileZ = gz + side * 11.2;
        batcher.addBox('mark_yellow', 1.2, 2.1, 1.0, -1028, groundY + 1.05, turnstileZ);
        batcher.addBox('light_green', 0.4, 0.4, 0.4, -1028, groundY + 2.25, turnstileZ);
        batcher.addBox('aviation_red', 0.3, 0.3, 4.2, -1028, groundY + 3.6, turnstileZ - side * 2.2);
        batcher.addBox('white_clean', 0.32, 0.32, 2.0, -1028, groundY + 3.6, turnstileZ - side * 2.2);
      }
    }
    addHighwayGreenSign(world, -1024, groundY + 9.2, 0, 34.0, 3.8, 'ESTACIONAMENTO & EMBARQUE ');

    batcher.addBox('asphalt_dark', 58, 0.08, 920, -1064, groundY + 0.04, 0);
    buildParkingSectors(world, batcher, groundY, [-1044, -1078]);
    return;
  }

  // ============================================================================
  // ESCALA 3x: PÁTIO JUSTO DO TERMINAL + FORECOURT + ESTACIONAMENTO (ZERO LAJÃO!)
  // ============================================================================
  const termX = ws(-1145);
  const termDropoffX = termX + 71;
  const parkCenterX = termX + 127;
  const forecourtBlvdX = termX + 180;
  const boothX = ws(-1052);
  const fenceX = ws(-1048);
  const gantryX = ws(-1044);
  const hwyEastX = ws(-1010);
  const viaductFootX = ws(-1036);

  // 1) Pátio de concreto aeronáutico justo sob Terminal, Pontes de Embarque, Forecourt e Estacionamento
  const apronMinX = termX - 96;
  const apronMaxX = forecourtBlvdX + 26;
  addTightAirportApronPad(
    world,
    batcher,
    (apronMinX + apronMaxX) * 0.5,
    0,
    apronMaxX - apronMinX,
    1040,
    groundY,
    { matKey: 'apron_concrete', turfBorder: 18, mapColor: '#262f3d' }
  );

  // 2) Praças de Pedágio / Guaritas justas nos 5 portões (incluindo spawn aeroporto_oeste em ws(-1060), 0)
  const gateCentersZ = [ws(-340), ws(-117), 0, ws(134), ws(340)];
  for (const gz of gateCentersZ) {
    const padEast = Math.abs(gz) <= ws(140) ? viaductFootX + 8 : boothX + 22;
    const padWest = Math.abs(gz) <= 360 ? apronMaxX - 4 : forecourtBlvdX - 16;
    if (padEast > padWest) {
      addTightAirportApronPad(
        world,
        batcher,
        (padEast + padWest) * 0.5,
        gz,
        padEast - padWest,
        74,
        groundY,
        { matKey: 'apron_concrete', turfBorder: 10 }
      );
    }
  }

  // Sapata estreita sob o muro perimetral de segurança
  batcher.addBox('apron_concrete', 6.5, groundY + 0.25, ws(1290), fenceX, (groundY - 0.25) * 0.5, 0);

  // 3) Rodovia Expressa Oeste Principal em Z = 0
  world.mapRoads.push({
    x: (hwyEastX + termDropoffX) * 0.5,
    z: 0,
    w: hwyEastX - termDropoffX,
    d: ROAD.mainWidth,
    isMain: true
  });
  world.addCollider((hwyEastX + termDropoffX) * 0.5, 0, hwyEastX - termDropoffX, ROAD.mainWidth + 12, groundY, -1.5);
  batcher.addBox(
    'asphalt_dark',
    viaductFootX - termDropoffX,
    0.08,
    ROAD.mainWidth,
    (viaductFootX + termDropoffX) * 0.5,
    groundY + 0.04,
    0
  );
  batcher.addBox('mark_yellow', viaductFootX - termDropoffX - 6, 0.04, 0.35, (viaductFootX + termDropoffX) * 0.5, groundY + 0.095, -0.45);
  batcher.addBox('mark_yellow', viaductFootX - termDropoffX - 6, 0.04, 0.35, (viaductFootX + termDropoffX) * 0.5, groundY + 0.095, 0.45);
  for (let dx = termDropoffX + 14; dx <= viaductFootX - 10; dx += 20) {
    batcher.addBox('mark_white', 7.5, 0.04, 0.25, dx, groundY + 0.095, -ROAD.mainWidth * 0.25);
    batcher.addBox('mark_white', 7.5, 0.04, 0.25, dx, groundY + 0.095, ROAD.mainWidth * 0.25);
  }

  // 4) Avenidas Paralelas de Acesso + Via Frontal de Embarque + Boulevard N-S com base própria
  for (const accZ of [ws(-117), ws(134)]) {
    addExpressHighwayStripX(world, batcher, groundY, hwyEastX, termDropoffX, accZ, ROAD.mainWidth, true);
  }
  for (const portalZ of [-340, 340]) {
    addExpressHighwayStripX(world, batcher, groundY, forecourtBlvdX, termDropoffX, portalZ, ROAD.secondaryWidth, false);
  }

  batcher.addBox('asphalt_dark', ROAD.secondaryWidth, 0.08, 960, termDropoffX, groundY + 0.04, 0);
  batcher.addBox('mark_yellow', 0.45, 0.04, 948, termDropoffX, groundY + 0.095, 0);
  world.mapRoads.push({ x: termDropoffX, z: 0, w: ROAD.secondaryWidth, d: 960, isMain: false });

  const blvdNorthZ = ws(-1285);
  const blvdSouthZ = ws(560);
  const blvdLenZ = blvdSouthZ - blvdNorthZ;
  const blvdMidZ = (blvdNorthZ + blvdSouthZ) * 0.5;
  batcher.addBox('airfield_verge', ROAD.secondaryWidth + 16, 0.24, blvdLenZ + 8, forecourtBlvdX, 0.02, blvdMidZ);
  batcher.addBox('apron_concrete', ROAD.secondaryWidth + 6, groundY + 0.28, blvdLenZ + 4, forecourtBlvdX, (groundY - 0.28) * 0.5, blvdMidZ);
  batcher.addBox('asphalt_dark', ROAD.secondaryWidth, 0.08, blvdLenZ, forecourtBlvdX, groundY + 0.04, blvdMidZ);
  batcher.addBox('mark_yellow', 0.45, 0.04, blvdLenZ - 12, forecourtBlvdX, groundY + 0.095, blvdMidZ);
  world.addCollider(forecourtBlvdX, blvdMidZ, ROAD.secondaryWidth + 8, blvdLenZ + 4, groundY, -1.5);
  world.mapRoads.push({ x: forecourtBlvdX, z: blvdMidZ, w: ROAD.secondaryWidth, d: blvdLenZ, isMain: true });

  // 5) 3 Pórticos Rodoviários de Entrada
  const halfPillarSpan = ROAD.mainWidth * 0.5 + 1.8;
  const gantries = [
    { x: gantryX, z: ws(-117), text: 'AEROPORTO / BASE MILITAR ' },
    { x: gantryX, z: 0, text: 'MEGA TERMINAL & ESTACIONAMENTO ' },
    { x: gantryX, z: ws(134), text: 'BASE MILITAR & HANGARES ' }
  ];
  for (const g of gantries) {
    batcher.addBox('steel_silver', 1.2, 11.5, 1.2, g.x, 5.75, g.z - halfPillarSpan);
    batcher.addBox('steel_silver', 1.2, 11.5, 1.2, g.x, 5.75, g.z + halfPillarSpan);
    batcher.addBox('steel_silver', 1.0, 1.2, halfPillarSpan * 2 + 1.2, g.x, 11.2, g.z);
    world.addCollider(g.x, g.z - halfPillarSpan, 1.4, 1.4, 11.5, 0);
    world.addCollider(g.x, g.z + halfPillarSpan, 1.4, 1.4, 11.5, 0);
    addHighwayGreenSign(world, g.x, 11.2, g.z, 28.0, 4.2, g.text);
  }

  // 6) Perímetro de Segurança + 5 Conjuntos de Guaritas / Catracas / Cancelas
  const isGateZ = (z) => gateCentersZ.some((gz) => Math.abs(z - gz) < 25);
  for (let fz = ws(-640); fz <= ws(640); fz += 20) {
    if (isGateZ(fz)) continue;
    batcher.addBox('concrete_wall', 1.2, 1.4, 19.6, fenceX, groundY + 0.7, fz);
    batcher.addBox('steel_dark', 0.45, 2.8, 0.45, fenceX, groundY + 2.8, fz - 9.5);
    batcher.addBox('steel_silver', 0.2, 0.25, 19.6, fenceX, groundY + 2.6, fz);
    batcher.addBox('steel_silver', 0.2, 0.25, 19.6, fenceX, groundY + 3.9, fz);
    world.addCollider(fenceX, fz, 1.4, 19.8, groundY + 4.3, groundY);
  }

  const boothSideOff = ROAD.mainWidth * 0.5 + 3.5;
  const turnstileSideOff = ROAD.mainWidth * 0.5 + 0.6;
  for (const gz of gateCentersZ) {
    batcher.addBox('aviation_blue', 4.2, 1.6, boothSideOff * 2 + 3.0, boothX, groundY + 7.8, gz);
    for (const side of [-1, 1]) {
      const bz = gz + side * boothSideOff;
      batcher.addBox('white_clean', 5.8, 4.2, 4.4, boothX, groundY + 2.1, bz);
      batcher.addBox('glass_cockpit', 6.0, 1.6, 3.8, boothX, groundY + 2.5, bz);
      batcher.addBox('aviation_blue', 6.6, 0.65, 5.2, boothX, groundY + 4.5, bz);
      world.addCollider(boothX, bz, 6.0, 4.6, groundY + 4.8, groundY);

      const turnstileZ = gz + side * turnstileSideOff;
      batcher.addBox('mark_yellow', 1.2, 2.1, 1.0, boothX - 2, groundY + 1.05, turnstileZ);
      batcher.addBox('light_green', 0.4, 0.4, 0.4, boothX - 2, groundY + 2.25, turnstileZ);
      batcher.addBox('aviation_red', 0.3, 0.3, 4.2, boothX - 2, groundY + 3.6, turnstileZ - side * 2.2);
      batcher.addBox('white_clean', 0.32, 0.32, 2.0, boothX - 2, groundY + 3.6, turnstileZ - side * 2.2);
    }
  }
  addHighwayGreenSign(world, boothX + 2, groundY + 9.2, 0, 34.0, 3.8, 'ESTACIONAMENTO & EMBARQUE ');

  // 7) Grande Estacionamento 1x (58m x 920m) na frente do Mega Terminal
  batcher.addBox('asphalt_dark', 58, 0.08, 920, parkCenterX, groundY + 0.04, 0);
  world.mapBlocks.push({ x: parkCenterX, z: 0, w: 66, d: 920, color: '#1e293b' });
  buildParkingSectors(world, batcher, groundY, [parkCenterX + 20, parkCenterX - 14]);
}

function buildParkingSectors(world, batcher, groundY, rowXs) {
  const parkingSectorsZ = [
    [-440, -195],
    [-160, -35],
    [35, 160],
    [195, 440]
  ];
  const parkedColors = ['aviation_red', 'aviation_blue', 'white_clean', 'gold_trim', 'highway_green', 'orange_windsock'];
  let carSeed = 0;

  for (const [zStart, zEnd] of parkingSectorsZ) {
    const secLen = zEnd - zStart;
    const secMidZ = (zStart + zEnd) * 0.5;

    for (const rowX of rowXs) {
      batcher.addBox('steel_dark', 0.5, 4.2, secLen - 6, rowX, groundY + 2.1, secMidZ);
      batcher.addBox('white_clean', 11.5, 0.4, secLen, rowX, groundY + 4.3, secMidZ);
      batcher.addBox('aviation_blue', 11.8, 0.25, secLen + 0.4, rowX, groundY + 4.55, secMidZ);

      for (let vz = zStart + 8; vz <= zEnd - 8; vz += 10.5) {
        batcher.addBox('mark_white', 8.5, 0.04, 0.3, rowX, groundY + 0.09, vz - 4.8);
        if (
          Math.abs(vz + 95) < 8 ||
          Math.abs(vz + 65) < 8 ||
          Math.abs(vz - 65) < 8 ||
          Math.abs(vz - 95) < 8 ||
          (IS_SCALED_WORLD && (Math.abs(vz + 351) < 18 || Math.abs(vz - 402) < 18))
        ) {
          continue;
        }
        if (carSeed % 3 !== 2) {
          const cKey = parkedColors[carSeed % parkedColors.length];
          addParkedAirportCar(batcher, rowX, groundY + 0.08, vz, cKey);
          world.addCollider(rowX, vz, 4.8, 2.5, groundY + 1.8, groundY);
        }
        carSeed++;
      }
    }
  }
}

function addParkedAirportCar(batcher, x, yBase, z, colorKey) {
  batcher.addBox('charcoal', 4.6, 0.45, 2.3, x, yBase + 0.25, z);
  batcher.addBox(colorKey, 4.5, 0.65, 2.2, x, yBase + 0.72, z);
  batcher.addBox('glass_cockpit', 2.4, 0.55, 2.0, x + 0.2, yBase + 1.25, z);
  batcher.addBox(colorKey, 2.2, 0.22, 2.05, x + 0.2, yBase + 1.58, z);
}

/**
 * 2. MEGA TERMINAL INTERNACIONAL LEGO DE 960m DE EXTENSÃO (X = ws(-1145), Z = -480 a +480)
 */
export function buildColossalEnterableAirportTerminal(world, batcher, groundY) {
  const termX = ws(-1145);
  const termZ = 0;
  const termW = 92;
  const termD = 960;
  const wallH = 30.0;
  const floorY = groundY + 0.18;

  batcher.addBox('terminal_floor', termW, 0.18, termD, termX, groundY + 0.09, termZ);
  batcher.addBox('aviation_blue', 8.0, 0.04, termD - 16, termX, floorY + 0.02, termZ);
  for (const doorZ of [-340, -170, 0, 170, 340]) {
    batcher.addBox('aviation_blue', termW - 4, 0.04, 10.0, termX, floorY + 0.025, doorZ);
  }

  batcher.addBox('white_clean', termW, wallH, 3.0, termX, floorY + wallH * 0.5, -478.5);
  batcher.addBox('white_clean', termW, wallH, 3.0, termX, floorY + wallH * 0.5, 478.5);
  world.addCollider(termX, -478.5, termW, 3.0, floorY + wallH, floorY);
  world.addCollider(termX, 478.5, termW, 3.0, floorY + wallH, floorY);

  const wallSegmentsZ = [
    [-477, -354],
    [-326, -184],
    [-156, -14],
    [14, 156],
    [184, 326],
    [354, 477]
  ];

  for (const [z1, z2] of wallSegmentsZ) {
    const segD = z2 - z1;
    const segMidZ = (z1 + z2) * 0.5;
    for (const wallX of [termX + termW * 0.5 - 1.5, termX - termW * 0.5 + 1.5]) {
      batcher.addBox('white_clean', 3.0, 5.0, segD, wallX, floorY + 2.5, segMidZ);
      batcher.addBox('glass_mirror', 2.8, wallH - 5.0, segD, wallX, floorY + 5.0 + (wallH - 5.0) * 0.5, segMidZ);
      world.addCollider(wallX, segMidZ, 3.0, segD, floorY + wallH, floorY);
    }
  }

  for (const doorZ of [-340, -170, 0, 170, 340]) {
    for (const wallX of [termX + termW * 0.5 - 1.5, termX - termW * 0.5 + 1.5]) {
      batcher.addBox('aviation_blue', 3.4, 12.0, 28.0, wallX, floorY + 24.0, doorZ);
      world.addCollider(wallX, doorZ, 3.4, 28.0, floorY + wallH, floorY + 18.0);
    }
  }

  batcher.addBox('white_clean', termW + 20, 2.8, termD + 8, termX + 3.0, floorY + wallH + 1.4, termZ);
  batcher.addBox('aviation_blue', termW + 22, 0.9, termD + 10, termX + 3.0, floorY + wallH + 3.2, termZ);
  world.addCollider(termX + 3.0, termZ, termW + 20, termD + 8, floorY + wallH + 3.6, floorY + wallH - 0.2);

  const vPillarX = termX + termW * 0.5 + 8.0;
  for (let pz = -450; pz <= 450; pz += 38) {
    if (Math.abs(pz) < 16 || Math.abs(pz - 170) < 16 || Math.abs(pz + 170) < 16 || Math.abs(pz - 340) < 16 || Math.abs(pz + 340) < 16) {
      continue;
    }
    batcher.addBox('white_clean', 1.4, wallH, 1.4, vPillarX, floorY + wallH * 0.5, pz - 2.6);
    batcher.addBox('white_clean', 1.4, wallH, 1.4, vPillarX, floorY + wallH * 0.5, pz + 2.6);
    batcher.addBox('steel_dark', 2.4, 1.2, 6.8, vPillarX, floorY + 0.6, pz);
  }

  addHighwayGreenSign(world, termX + 48, floorY + wallH + 6.5, 0, 96.0, 6.8, 'TERMINAL INTERNACIONAL LEGO ');
  addHighwayGreenSign(world, termX + 48, floorY + wallH + 5.8, -280, 64.0, 5.2, 'EMBARQUE DOMÉSTICO & CARGAS ');
  addHighwayGreenSign(world, termX + 48, floorY + wallH + 5.8, 280, 64.0, 5.2, 'ALA AÉREA & COMANDO MILITAR ');

  for (const jz of [-415, -255, -115, -45, 45, 115, 255, 415]) {
    batcher.addBox('steel_silver', 22.0, 4.2, 4.6, termX - termW * 0.5 - 11.0, floorY + 11.5, jz);
    batcher.addBox('glass_cockpit', 20.0, 2.2, 4.8, termX - termW * 0.5 - 11.0, floorY + 11.8, jz);
  }

  const checkInX = termX + 23;
  const flightBoardX = termX + 20;
  const checkInZonesZ = [-415, -255, -85, 85, 255, 415];
  for (const cz of checkInZonesZ) {
    batcher.addBox('white_clean', 3.6, 1.4, 36.0, checkInX, floorY + 0.7, cz);
    batcher.addBox('aviation_blue', 3.8, 0.3, 36.4, checkInX, floorY + 1.55, cz);
    for (let mz = cz - 14; mz <= cz + 14; mz += 7) {
      batcher.addBox('charcoal', 0.45, 0.9, 1.4, checkInX + 0.5, floorY + 2.15, mz);
      batcher.addBox('light_cyan', 0.5, 0.7, 1.2, checkInX + 0.6, floorY + 2.15, mz);
      batcher.addBox('steel_dark', 2.2, 0.25, 1.8, checkInX, floorY + 0.15, mz + 3.2);
      batcher.addBox('aviation_red', 1.4, 1.1, 0.9, checkInX, floorY + 0.8, mz + 3.2);
    }
    batcher.addBox('charcoal', 1.4, 4.8, 28.0, flightBoardX, floorY + 11.5, cz);
    batcher.addBox('light_cyan', 1.6, 4.0, 26.8, flightBoardX + 0.2, floorY + 11.5, cz);
    world.addCollider(checkInX, cz, 3.8, 36.4, floorY + 2.6, floorY);
  }

  for (const bz of [-380, -120, 120, 380]) {
    batcher.addBox('steel_silver', 9.5, 0.75, 24.0, termX, floorY + 0.38, bz);
    batcher.addBox('charcoal', 7.5, 0.82, 22.0, termX, floorY + 0.42, bz);
    for (let lz = bz - 8; lz <= bz + 8; lz += 4) {
      batcher.addBox('orange_windsock', 1.5, 1.0, 1.1, termX + 3, floorY + 1.3, lz);
      batcher.addBox('sky_blue', 1.5, 1.0, 1.1, termX - 3, floorY + 1.3, lz + 1.5);
    }
    world.addCollider(termX, bz, 9.5, 24.0, floorY + 1.4, floorY);
  }

  for (const sz of [-255, -85, 85, 255]) {
    for (let rxOff = -29; rxOff <= -15; rxOff += 4.5) {
      const rx = termX + rxOff;
      batcher.addBox('steel_silver', 1.6, 0.35, 18.0, rx, floorY + 0.25, sz);
      batcher.addBox('aviation_blue', 1.4, 0.55, 17.6, rx, floorY + 0.65, sz);
      batcher.addBox('aviation_blue', 0.45, 1.1, 17.6, rx - 0.5, floorY + 1.25, sz);
      world.addCollider(rx, sz, 1.6, 18.0, floorY + 1.8, floorY);
    }
  }

  for (let cz = -420; cz <= 420; cz += 60) {
    for (const cx of [termX + 17, termX - 17]) {
      batcher.addBox('white_clean', 2.4, wallH, 2.4, cx, floorY + wallH * 0.5, cz);
      batcher.addBox('light_warm', 6.5, 0.6, 6.5, cx, floorY + wallH - 0.5, cz);
      world.addCollider(cx, cz, 2.4, 2.4, floorY + wallH, floorY);
    }
  }

  world.mapBuildings.push({
    x: termX,
    z: termZ,
    w: termW,
    d: termD,
    height: wallH + 4,
    color: '#0284c7',
    label: 'MEGA TERMINAL INTERNACIONAL'
  });
}

/**
 * 4A. AS 3 TORRES DE CONTROLE GIGANTES (124m) COM PÁTIOS DE SERVIÇO JUSTOS RENTES À PISTA 09/27
 */
export function buildThreeRunwayAtcTowers(world, batcher, groundY) {
  const atcX = ws(-1582);
  const rwyX = ws(-1660);
  const atcPositionsZ = [-360, 0, 360].map(ws);
  for (let i = 0; i < atcPositionsZ.length; i++) {
    const az = atcPositionsZ[i];
    addTightAirportApronPad(world, batcher, (atcX + rwyX) * 0.5 + 14, az, Math.abs(atcX - rwyX) + 46, 56, groundY, {
      matKey: 'apron_concrete',
      turfBorder: 12,
      mapColor: '#334155'
    });
    buildSingleGiantAtcTower(world, batcher, atcX, groundY, az, i + 1);
  }
}

function buildSingleGiantAtcTower(world, batcher, atcX, groundY, atcZ, towerIndex) {
  const shaftH = 98.0;

  batcher.addBox('concrete_wall', 22, 10, 22, atcX, groundY + 5, atcZ);
  for (let s = 0; s < 9; s++) {
    const segY = groundY + 10 + s * 9.8;
    const segW = 15.5 - s * 0.42;
    const matKey = s % 2 === 0 ? 'white_clean' : 'aviation_red';
    batcher.addBox(matKey, segW, 9.8, segW, atcX, segY + 4.9, atcZ);
  }

  for (const [dx, dz] of [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]]) {
    batcher.addBox('steel_silver', 1.2, shaftH, 1.2, atcX + dx, groundY + shaftH * 0.5, atcZ + dz);
  }

  const deckY = groundY + shaftH;
  batcher.addBox('steel_dark', 26.0, 1.8, 26.0, atcX, deckY + 0.9, atcZ);
  batcher.addBox('white_clean', 26.4, 1.3, 0.5, atcX, deckY + 2.4, atcZ - 13.0);
  batcher.addBox('white_clean', 26.4, 1.3, 0.5, atcX, deckY + 2.4, atcZ + 13.0);
  batcher.addBox('white_clean', 0.5, 1.3, 26.4, atcX - 13.0, deckY + 2.4, atcZ);
  batcher.addBox('white_clean', 0.5, 1.3, 26.4, atcX + 13.0, deckY + 2.4, atcZ);

  // Cabine panorâmica octogonal e teto 100% integrados ao Batcher Vertex-Color (zero MeshPhysicalMaterial!)
  batcher.addCylinder('glass_cockpit', 11.2, 9.2, 10.5, atcX, deckY + 7.0, atcZ, 8);
  batcher.addCylinder('white_clean', 12.0, 11.6, 2.2, atcX, deckY + 13.2, atcZ, 8);

  const topRoofY = deckY + 14.3;
  batcher.addBox('aviation_red', 5.0, 4.8, 5.0, atcX, topRoofY + 2.4, atcZ);
  batcher.addBox('steel_silver', 0.6, 11.5, 0.6, atcX - 5.5, topRoofY + 5.75, atcZ - 5.5);
  batcher.addBox('light_red', 1.2, 1.2, 1.2, atcX - 5.5, topRoofY + 11.8, atcZ - 5.5);

  const radarGroup = new THREE.Group();
  radarGroup.position.set(atcX, topRoofY + 6.4, atcZ);
  radarGroup.add(new THREE.Mesh(getSharedAtcRadarGeo(), getSharedPeripheryStandardVcMaterial()));
  world.scene.add(radarGroup);
  world.rotatingElements.push({ mesh: radarGroup, axis: 'y', speed: 1.9 + towerIndex * 0.25 });

  world.addCollider(atcX, atcZ, 21, 21, 124, groundY);
  world.mapBuildings.push({
    x: atcX,
    z: atcZ,
    w: 22,
    d: 22,
    height: 124,
    color: '#ef4444',
    label: `TORRE ATC ${towerIndex} (124m)`
  });
}

export function addHighwayGreenSign(world, x, y, z, width, height, text) {
  const signMesh = createSignBoardMesh({
    x,
    y,
    z,
    width,
    height,
    depth: 1.1,
    rotY: Math.PI / 2,
    title: text,
    bgColor: '#14532d',
    borderColor: '#ffffff',
    textColor: '#ffffff',
    topStripeColor: '#facc15',
    doubleSided: true
  });
  world.scene.add(signMesh);
}
