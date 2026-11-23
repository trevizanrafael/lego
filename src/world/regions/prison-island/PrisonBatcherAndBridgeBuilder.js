import * as THREE from 'three';
import { markAsSharedAsset } from '../../../materials/LegoMaterials.js';
import { makeFastBox, mergeBufferGeometries, mergeColoredGeometries } from '../../BuildingGenerator.js';
import { createSignBoardMesh } from '../../../utils/SignBoardHelper.js';
import { IS_SCALED_WORLD, ws, wsP } from '../../core/WorldLayoutScale.js';
import {
  getSharedPeripheryStandardVcMaterial,
  getSharedPeripheryBasicVcMaterial
} from '../../terrain/NaturalPeripheryBuilder.js';

export const DESIGN_PRISON_CENTER = Object.freeze({ x: 1375, z: 1540 });
export const PRISON_COMPOUND_ORIGIN = Object.freeze(wsP(DESIGN_PRISON_CENTER.x, DESIGN_PRISON_CENTER.z));
export const PRISON_OFFSET_X = PRISON_COMPOUND_ORIGIN.x - DESIGN_PRISON_CENTER.x;
export const PRISON_OFFSET_Z = PRISON_COMPOUND_ORIGIN.z - DESIGN_PRISON_CENTER.z;

export const DESIGN_PRISON_DOCK = Object.freeze({ x: 928, z: 1550 });
export const PRISON_DOCK_ORIGIN = Object.freeze(wsP(DESIGN_PRISON_DOCK.x, DESIGN_PRISON_DOCK.z));
export const PRISON_DOCK_OFFSET_X = PRISON_DOCK_ORIGIN.x - DESIGN_PRISON_DOCK.x;
export const PRISON_DOCK_OFFSET_Z = PRISON_DOCK_ORIGIN.z - DESIGN_PRISON_DOCK.z;

const PRISON_LOD_DIST = 340;

const PRISON_SECTOR_ORIGINS = [
  { key: 'bridge_and_dock', originX: ws(1160), originZ: ws(1180) },
  { key: 'fortress', originX: PRISON_COMPOUND_ORIGIN.x, originZ: PRISON_COMPOUND_ORIGIN.z }
];

const PRISON_PALETTE = {
  matte_black: { color: new THREE.Color(0x090a0d), basic: false },
  bope_black: { color: new THREE.Color(0x111827), basic: false },
  gunmetal_concrete: { color: new THREE.Color(0x1e293b), basic: false },
  armor_slate: { color: new THREE.Color(0x334155), basic: false },
  dark_steel: { color: new THREE.Color(0x0f172a), basic: false },
  yard_concrete: { color: new THREE.Color(0x3b4656), basic: false },
  coastal_rock: { color: new THREE.Color(0x18191e), basic: false },
  island_basalt: { color: new THREE.Color(0x1d2129), basic: false },
  island_granite: { color: new THREE.Color(0x2c333e), basic: false },
  island_turf: { color: new THREE.Color(0x213221), basic: false },
  island_scrub: { color: new THREE.Color(0x2f4325), basic: false },
  sea_foam: { color: new THREE.Color(0xe2e8f0), basic: true },
  brushed_silver: { color: new THREE.Color(0xcbd5e1), basic: false },
  chainlink_mesh: { color: new THREE.Color(0x94a3b8), basic: false },
  tactical_white: { color: new THREE.Color(0xf8fafc), basic: false },
  alert_yellow: { color: new THREE.Color(0xfacc15), basic: false },
  police_blue: { color: new THREE.Color(0x1d4ed8), basic: false },
  court_blue: { color: new THREE.Color(0x0284c7), basic: false },
  futsal_green: { color: new THREE.Color(0x15803d), basic: false },
  prison_orange: { color: new THREE.Color(0xf97316), basic: false },
  cv_red: { color: new THREE.Color(0xdc2626), basic: false },
  pcc_navy: { color: new THREE.Color(0x1e3a8a), basic: false },
  ares_purple: { color: new THREE.Color(0x9333ea), basic: false },
  laser_cyan: { color: new THREE.Color(0x38bdf8), basic: true },
  laser_purple: { color: new THREE.Color(0xc084fc), basic: true },
  lego_skin: { color: new THREE.Color(0xfde047), basic: false },
  smoked_glass: { color: new THREE.Color(0x0c4a6e), basic: false },
  searchlight_white: { color: new THREE.Color(0xffffff), basic: true },
  searchlight_beam: { color: new THREE.Color(0xe0f2fe), beam: true },
  siren_red: { color: new THREE.Color(0xef4444), basic: true },
  siren_blue: { color: new THREE.Color(0x38bdf8), basic: true }
};

const PRISON_SHADOW_KEYS = new Set([
  'matte_black',
  'gunmetal_concrete',
  'armor_slate',
  'dark_steel',
  'alert_yellow',
  'bope_black',
  'prison_orange'
]);

let _sharedSearchlightBeamMat = null;

function getSharedPrisonBeamMaterial() {
  if (!_sharedSearchlightBeamMat) {
    _sharedSearchlightBeamMat = markAsSharedAsset(
      new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
      })
    );
  }
  return _sharedSearchlightBeamMat;
}

/**
 * Batcher Vertex-Color 2-Níveis `THREE.LOD` (`340 m`) da Ponte Blindada & Ilha da Prisão:
 * - Zero `MeshPhysicalMaterial` (1 `MeshStandardMaterial` + 1 `MeshBasicMaterial` + 1 `searchlight_beam`).
 * - Nível 0 (0..340m): todas as estruturas, cabos, grades, minifigs, marcações e feixes de holofote.
 * - Nível 1 (>=340m): apenas macroestruturas (`Math.max(w, h, d) >= 3.5`), `castShadow = false`.
 */
export class PrisonIslandBatcher {
  constructor() {
    this.chunks = new Map();
    this.basicEntries = [];
    this.beamEntries = [];
    this.auxOriginX = PRISON_COMPOUND_ORIGIN.x;
    this.auxOriginZ = PRISON_COMPOUND_ORIGIN.z;
  }

  _getChunk(wx, wz) {
    const bridgeEndZ = IS_SCALED_WORLD ? ws(1124) : 1126;
    const sec =
      wz < bridgeEndZ || wx < 995 + PRISON_OFFSET_X - 48
        ? PRISON_SECTOR_ORIGINS[0]
        : PRISON_SECTOR_ORIGINS[1];
    let ch = this.chunks.get(sec.key);
    if (!ch) {
      ch = {
        key: sec.key,
        originX: sec.originX,
        originZ: sec.originZ,
        l0Pbr: [],
        l1Pbr: [],
        hasShadowCaster: false
      };
      this.chunks.set(sec.key, ch);
    }
    return ch;
  }

  _pushAxisBox(spec, key, w, h, d, x, y, z, isMacroL1) {
    if (spec.beam) {
      this.beamEntries.push(makeFastBox(w, h, d, x - this.auxOriginX, y, z - this.auxOriginZ));
      return;
    }
    if (spec.basic) {
      this.basicEntries.push({
        geo: makeFastBox(w, h, d, x - this.auxOriginX, y, z - this.auxOriginZ),
        color: spec.color
      });
      return;
    }
    const ch = this._getChunk(x, z);
    const fast = makeFastBox(w, h, d, x - ch.originX, y, z - ch.originZ);
    ch.l0Pbr.push({ geo: fast, color: spec.color });
    if (PRISON_SHADOW_KEYS.has(key) && h >= 2.2) {
      ch.hasShadowCaster = true;
    }
    if (isMacroL1) {
      ch.l1Pbr.push({ geo: fast, color: spec.color });
    }
  }

  addBox(key, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const spec = PRISON_PALETTE[key];
    if (!spec) return;
    const isMacroL1 =
      !spec.basic &&
      !spec.beam &&
      key !== 'chainlink_mesh' &&
      Math.max(w, h, d) >= 3.5 &&
      h >= 0.08 &&
      Math.min(w, d) >= 0.4;

    if (rx === 0 && ry === 0 && rz === 0) {
      this._pushAxisBox(spec, key, w, h, d, x, y, z, isMacroL1);
      return;
    }

    if (spec.beam || spec.basic) {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
      m.compose(new THREE.Vector3(x - this.auxOriginX, y, z - this.auxOriginZ), q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      if (spec.beam) this.beamEntries.push(g);
      else this.basicEntries.push({ geo: g, color: spec.color });
      return;
    }

    const ch = this._getChunk(x, z);
    const lx = x - ch.originX;
    const lz = z - ch.originZ;
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    m.compose(new THREE.Vector3(lx, y, lz), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);

    if (isMacroL1) ch.l1Pbr.push({ geo: g.clone(), color: spec.color });
    ch.l0Pbr.push({ geo: g, color: spec.color });
    if (PRISON_SHADOW_KEYS.has(key) && h >= 2.2) ch.hasShadowCaster = true;
  }

  addCable(key, thickness, x1, y1, z1, x2, y2, z2) {
    const spec = PRISON_PALETTE[key];
    if (!spec) return;
    const p1 = new THREE.Vector3(x1, y1, z1);
    const p2 = new THREE.Vector3(x2, y2, z2);
    const diff = new THREE.Vector3().subVectors(p2, p1);
    const len = diff.length();
    if (len < 0.001) return;
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    if (spec.basic) {
      const localMid = new THREE.Vector3(mid.x - this.auxOriginX, mid.y, mid.z - this.auxOriginZ);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
      const g = new THREE.BoxGeometry(thickness, len, thickness);
      g.applyMatrix4(new THREE.Matrix4().compose(localMid, q, new THREE.Vector3(1, 1, 1)));
      this.basicEntries.push({ geo: g, color: spec.color });
      return;
    }
    const ch = this._getChunk(mid.x, mid.z);
    const localMid = new THREE.Vector3(mid.x - ch.originX, mid.y, mid.z - ch.originZ);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
    const g = new THREE.BoxGeometry(thickness, len, thickness);
    const m = new THREE.Matrix4().compose(localMid, q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    ch.l0Pbr.push({ geo: g, color: spec.color });
  }

  addCylinder(key, rTop, rBottom, h, x, y, z, segs = 10, rx = 0, rz = 0) {
    const spec = PRISON_PALETTE[key];
    if (!spec) return;
    if (spec.beam || spec.basic) {
      const g = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
      if (rx !== 0 || rz !== 0) {
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
      }
      g.translate(x - this.auxOriginX, y, z - this.auxOriginZ);
      if (spec.beam) this.beamEntries.push(g);
      else this.basicEntries.push({ geo: g, color: spec.color });
      return;
    }

    const ch = this._getChunk(x, z);
    const lx = x - ch.originX;
    const lz = z - ch.originZ;
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, segs);
    if (rx !== 0 || rz !== 0) {
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz));
      g.applyMatrix4(m);
    }
    g.translate(lx, y, lz);

    const maxDim = Math.max(rTop * 2, rBottom * 2, h);
    if (maxDim >= 3.5 && Math.max(rTop, rBottom) >= 1.2) {
      const dEst = Math.max(rTop, rBottom) * 1.85;
      ch.l1Pbr.push({ geo: makeFastBox(dEst, h, dEst, lx, y, lz), color: spec.color });
    }
    ch.l0Pbr.push({ geo: g, color: spec.color });
    if (PRISON_SHADOW_KEYS.has(key) && h >= 2.2) ch.hasShadowCaster = true;
  }

  flush(scene) {
    const stdMat = getSharedPeripheryStandardVcMaterial();
    const basicMat = getSharedPeripheryBasicVcMaterial();
    const beamMat = getSharedPrisonBeamMaterial();

    for (const ch of this.chunks.values()) {
      if (ch.l0Pbr.length === 0) continue;

      const lod = new THREE.LOD();
      lod.name = `PrisonIslandLOD_${ch.key}`;
      lod.position.set(ch.originX, 0, ch.originZ);
      lod.userData = { isPrisonIslandLod: true, chunkKey: ch.key, skipStaticMerge: true };

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
      lod.addLevel(level1, PRISON_LOD_DIST);
      level0.visible = true;
      level1.visible = false;
      scene.add(lod);
    }

    if (this.basicEntries.length > 0) {
      const gb = mergeColoredGeometries(this.basicEntries);
      gb.computeBoundingBox();
      gb.computeBoundingSphere();
      const mb = new THREE.Mesh(gb, basicMat);
      mb.name = 'PrisonIslandBasicMarkings';
      mb.position.set(this.auxOriginX, 0, this.auxOriginZ);
      mb.castShadow = false;
      mb.receiveShadow = false;
      mb.matrixAutoUpdate = false;
      mb.updateMatrix();
      scene.add(mb);
    }

    if (this.beamEntries.length > 0) {
      const gBeam = mergeBufferGeometries(this.beamEntries);
      gBeam.computeBoundingBox();
      gBeam.computeBoundingSphere();
      const mBeam = new THREE.Mesh(gBeam, beamMat);
      mBeam.name = 'PrisonIslandSearchlightBeams';
      mBeam.position.set(this.auxOriginX, 0, this.auxOriginZ);
      mBeam.castShadow = false;
      mBeam.receiveShadow = false;
      mBeam.matrixAutoUpdate = false;
      mBeam.updateMatrix();
      mBeam.userData.skipStaticMerge = true;
      scene.add(mBeam);
    }

    this.chunks.clear();
    this.basicEntries.length = 0;
    this.beamEntries.length = 0;
  }
}

export function createInitialPrisonIslandData() {
  const bx = ws(1375);
  const zStart = IS_SCALED_WORLD ? ws(734) : 735;
  const zEnd = IS_SCALED_WORLD ? ws(1122) : 1125;
  return {
    bridgeAlignedWithPort: true,
    bridgeCenterX: bx,
    bridgeStartZ: zStart,
    bridgeEndZ: zEnd,
    bridgeLength: zEnd - zStart,
    bridgeLanes: 4,
    bridgeConcretePillarsCount: 0,
    bridgeSteelTowersCount: 2,
    bridgeTowerHeight: 94,
    bridgeStayCablesCount: 0,
    bridgeStayCablesFixedOrientation: true,
    bopeCheckpointsCount: 2,
    islandWidth: IS_SCALED_WORLD ? ws(842) : 840,
    islandDepth: IS_SCALED_WORLD ? ws(864) : 860,
    coastalRocksCount: 0,
    hasExternalCoastGuardDock: true,
    coastGuardSpeedboatsCount: 2,
    perimeterWallHeight: 40,
    hasMonumentalArmoredGate: true,
    hasSalliePortDoubleGate: true,
    watchtowersCount: 0,
    watchtowerHeight: 68,
    hasCentralCommandTower: true,
    centralTowerHeight: 126,
    hasPoliceHelipad: true,
    helipadsCount: 2,
    bopeHelicoptersOnCitadelCount: 2,
    skybridgesCount: 4,
    skybridgeElevation: 40,
    detentionPavilionsCount: 6,
    pavilionHeights: [82, 66, 66, 58, 58, 60],
    omegaContainmentHeight: 82,
    energyContainmentCellsCount: 0,
    visibleGroundCellsCount: 0,
    prisonersInCellsCount: 0,
    orangePrisonersCount: 0,
    cvPrisonersCount: 0,
    pccPrisonersCount: 0,
    aresPrisonersCount: 0,
    guardsCount: 0,
    elevatedGuardCatwalksCount: 0,
    hasSportsCourt: true,
    sportsCourtsCount: 2,
    hasConcreteBleachers: true,
    weightBenchesCount: 0,
    cafeteriaTablesCount: 0,
    armoredPrisonBusesCount: 0,
    substationTransformersCount: 0,
    dieselGeneratorsCount: 0,
    powerCoilsCount: 0,
    powerTowersCount: 0,
    waterTowersCount: 0
  };
}

export function addPrisonBannerSign(
  world,
  x,
  y,
  z,
  width,
  height,
  text,
  subText = '',
  rotY = 0,
  borderColor = '#facc15',
  textColor = '#facc15'
) {
  const signMesh = createSignBoardMesh({
    x,
    y,
    z,
    width,
    height,
    depth: 1.1,
    rotY,
    title: text,
    subText,
    bgColor: '#090a0d',
    borderColor,
    textColor,
    subColor: '#f8fafc',
    doubleSided: true
  });
  world.scene.add(signMesh);
}

export function addBatchedLegoPerson(batcher, x, y, z, rotY = 0, preset = 'prisoner_orange', pose = 'stand') {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const toWorld = (lx, ly, lz) => [x + lx * cos + lz * sin, y + ly, z - lx * sin + lz * cos];

  let torsoKey = 'prison_orange';
  let legsKey = 'prison_orange';
  let hatKey = null;
  let hasRifle = false;
  let hasBarbell = false;

  if (preset === 'prisoner_cv') {
    torsoKey = 'cv_red'; legsKey = 'matte_black'; hatKey = 'cv_red';
  } else if (preset === 'prisoner_pcc') {
    torsoKey = 'pcc_navy'; legsKey = 'matte_black'; hatKey = 'matte_black';
  } else if (preset === 'prisoner_ares') {
    torsoKey = 'ares_purple'; legsKey = 'dark_steel'; hatKey = 'brushed_silver';
  } else if (preset === 'bope_guard') {
    torsoKey = 'bope_black'; legsKey = 'matte_black'; hatKey = 'bope_black'; hasRifle = true;
  } else if (preset === 'warden_police') {
    torsoKey = 'police_blue'; legsKey = 'matte_black'; hatKey = 'tactical_white'; hasRifle = true;
  }

  if (pose === 'bench_press') hasBarbell = true;

  const [lx1, ly1, lz1] = toWorld(-0.22, 0.42, 0);
  const [lx2, ly2, lz2] = toWorld(0.22, 0.42, 0);
  batcher.addBox(legsKey, 0.36, 0.84, 0.42, lx1, ly1, lz1, 0, rotY, 0);
  batcher.addBox(legsKey, 0.36, 0.84, 0.42, lx2, ly2, lz2, 0, rotY, 0);

  const [tx, ty, tz] = toWorld(0, 1.24, 0);
  batcher.addBox(torsoKey, 0.92, 0.88, 0.48, tx, ty, tz, 0, rotY, 0);
  if (preset === 'bope_guard' || preset === 'warden_police') {
    const [vx, vy, vz] = toWorld(0, 1.26, 0.04);
    batcher.addBox('alert_yellow', 0.64, 0.24, 0.52, vx, vy, vz, 0, rotY, 0);
  } else if (preset === 'prisoner_orange') {
    const [sx, sy, sz] = toWorld(0, 1.32, 0.02);
    batcher.addBox('tactical_white', 0.72, 0.18, 0.5, sx, sy, sz, 0, rotY, 0);
  } else if (preset === 'prisoner_ares') {
    const [sx, sy, sz] = toWorld(0, 1.28, 0.04);
    batcher.addBox('laser_cyan', 0.56, 0.24, 0.52, sx, sy, sz, 0, rotY, 0);
  }

  const armElevation = pose === 'hands_bars' || pose === 'bench_press' ? 0.22 : 0;
  const armForward = pose === 'hands_bars' ? 0.26 : hasRifle ? 0.18 : 0;
  const [ax1, ay1, az1] = toWorld(-0.62, 1.22 + armElevation, armForward);
  const [ax2, ay2, az2] = toWorld(0.62, 1.22 + armElevation, armForward);
  batcher.addBox(torsoKey, 0.28, 0.74, 0.32, ax1, ay1, az1, 0, rotY, 0);
  batcher.addBox(torsoKey, 0.28, 0.74, 0.32, ax2, ay2, az2, 0, rotY, 0);

  const [hx1, hy1, hz1] = toWorld(-0.62, 0.82 + armElevation, armForward + 0.08);
  const [hx2, hy2, hz2] = toWorld(0.62, 0.82 + armElevation, armForward + 0.08);
  batcher.addBox('lego_skin', 0.24, 0.24, 0.24, hx1, hy1, hz1, 0, rotY, 0);
  batcher.addBox('lego_skin', 0.24, 0.24, 0.24, hx2, hy2, hz2, 0, rotY, 0);

  const [hdx, hdy, hdz] = toWorld(0, 1.98, 0);
  batcher.addCylinder('lego_skin', 0.34, 0.34, 0.56, hdx, hdy, hdz, 8);
  batcher.addCylinder('lego_skin', 0.18, 0.18, 0.12, hdx, hdy + 0.34, hdz, 8);
  if (hatKey) batcher.addCylinder(hatKey, 0.38, 0.38, 0.26, hdx, hdy + 0.22, hdz, 8);

  if (hasRifle) {
    const [rx, ry, rz] = toWorld(0.35, 1.15, 0.48);
    batcher.addBox('matte_black', 0.16, 0.24, 1.15, rx, ry, rz, 0, rotY, 0);
  }
  if (hasBarbell) {
    const [bx, by, bz] = toWorld(0, 1.65, 0.38);
    batcher.addBox('brushed_silver', 2.2, 0.12, 0.12, bx, by, bz, 0, rotY, 0);
    const [wx1, wy1, wz1] = toWorld(-0.95, 1.65, 0.38);
    const [wx2, wy2, wz2] = toWorld(0.95, 1.65, 0.38);
    batcher.addBox('matte_black', 0.22, 0.65, 0.65, wx1, wy1, wz1, 0, rotY, 0);
    batcher.addBox('matte_black', 0.22, 0.65, 0.65, wx2, wy2, wz2, 0, rotY, 0);
  }
}

export function buildArmoredCableStayedBridgeAndCheckpoints(world, batcher) {
  const bx = ws(1375);
  const zStart = IS_SCALED_WORLD ? ws(734) : 735;
  const zEnd = IS_SCALED_WORLD ? ws(1122) : 1125;
  const bridgeLen = zEnd - zStart;
  const bridgeMidZ = (zStart + zEnd) * 0.5;
  const deckW = 46;
  const roadW = 34;

  const segCount = IS_SCALED_WORLD ? Math.max(2, Math.round(bridgeLen / 194)) : 1;
  const segLen = bridgeLen / segCount;
  const segPad = IS_SCALED_WORLD ? 0.2 : 0;
  const stripeInset = IS_SCALED_WORLD ? 0.5 : 4;
  for (let s = 0; s < segCount; s++) {
    const sz = zStart + (s + 0.5) * segLen;
    batcher.addBox('gunmetal_concrete', deckW, 2.2, segLen + segPad, bx, -0.82, sz);
    batcher.addBox('matte_black', roadW, 0.12, segLen + segPad, bx, 0.24, sz);
    batcher.addBox('alert_yellow', 0.45, 0.05, segLen - stripeInset, bx - 0.55, 0.31, sz);
    batcher.addBox('alert_yellow', 0.45, 0.05, segLen - stripeInset, bx + 0.55, 0.31, sz);
  }

  if (IS_SCALED_WORLD) {
    if (!world.elevatedDecks) world.elevatedDecks = [];
    const getBridgeDeckY = (_x, z) => (z < zStart + 8 ? 0.3 * Math.max(0, (z - zStart) / 8) : 0.3);
    world.elevatedDecks.push({
      id: 'prison_armored_bridge', minX: bx - deckW * 0.5, maxX: bx + deckW * 0.5, minZ: zStart, maxZ: zEnd,
      topY: 0.3, thresholdBelow: 2.5, getDeckY: getBridgeDeckY, getTopY: getBridgeDeckY
    });
  }

  world.addCollider(bx, bridgeMidZ, deckW, bridgeLen, 0.3, -2.0);
  world.mapRoads.push({ x: bx, z: bridgeMidZ, w: roadW, d: bridgeLen, isMain: true });

  for (let zz = zStart + 10; zz <= zEnd - 10; zz += 14) {
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx - 8.5, 0.31, zz);
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx + 8.5, 0.31, zz);
  }

  for (const side of [-1, 1]) {
    const grX = bx + side * 17.6;
    const walkX = bx + side * 20.2;
    const wallX = bx + side * 22.2;
    for (let s = 0; s < segCount; s++) {
      const sz = zStart + (s + 0.5) * segLen;
      batcher.addBox('armor_slate', 4.4, 0.36, segLen + segPad, walkX, 0.46, sz);
      batcher.addBox('brushed_silver', 0.48, 1.15, segLen + segPad, grX, 0.88, sz);
      batcher.addBox('matte_black', 0.55, 0.28, segLen + segPad, grX, 1.35, sz);
      batcher.addBox('gunmetal_concrete', 1.8, 2.4, segLen + segPad, wallX, 1.48, sz);
      batcher.addBox('alert_yellow', 1.9, 0.32, segLen + segPad, wallX, 2.52, sz);
    }
    world.addCollider(wallX, bridgeMidZ, 1.8, bridgeLen, 2.7, 0.28);
  }

  let pillarZList = [768, 814, 860, 906, 954, 1000, 1046, 1092];
  if (IS_SCALED_WORLD) {
    const innerSpan = bridgeLen - 72;
    const intervals = Math.max(2, Math.round(innerSpan / 46));
    pillarZList = Array.from({ length: intervals + 1 }, (_, i) => zStart + 36 + (i * innerSpan) / intervals);
  }

  for (const pz of pillarZList) {
    batcher.addBox('gunmetal_concrete', deckW + 6, 3.2, 6.5, bx, -2.4, pz);
    for (const side of [-1, 1]) {
      const px = bx + side * 18.5;
      batcher.addBox('coastal_rock', 11.5, 3.0, 11.5, px, -2.2, pz);
      batcher.addBox('gunmetal_concrete', 7.8, 5.5, 7.8, px, -1.5, pz);
      batcher.addBox('alert_yellow', 8.2, 0.6, 8.2, px, 0.1, pz);
      world.prisonIslandData.bridgeConcretePillarsCount++;

      const lampX = bx + side * 21.8;
      batcher.addCylinder('dark_steel', 0.28, 0.36, 12.0, lampX, 6.4, pz, 8);
      batcher.addBox('dark_steel', 3.4, 0.32, 0.45, lampX - side * 1.4, 12.2, pz);
      batcher.addBox('searchlight_white', 1.6, 0.24, 0.75, lampX - side * 2.4, 12.0, pz);
    }
  }

  const towerIdx = Math.max(1, Math.round((pillarZList.length - 1) * 0.29));
  const towerZPositions = !IS_SCALED_WORLD
    ? [860, 1000]
    : [pillarZList[towerIdx], pillarZList[pillarZList.length - 1 - towerIdx]];
  const towerH = 94;
  for (const tz of towerZPositions) {
    for (const side of [-1, 1]) {
      const tx = bx + side * 24.5;
      batcher.addBox('coastal_rock', 16.0, 3.6, 18.0, tx, -1.8, tz);
      batcher.addBox('gunmetal_concrete', 11.0, 18.0, 12.0, tx, 8.5, tz);
      batcher.addBox('dark_steel', 7.6, towerH, 8.6, tx, towerH * 0.5, tz);
      for (const bandY of [18, 36, 54, 72, 88]) {
        batcher.addBox('alert_yellow', 8.2, 2.2, 9.2, tx, bandY, tz);
      }
      batcher.addCylinder('brushed_silver', 0.35, 0.55, 5.0, tx, towerH + 2.5, tz, 8);
      batcher.addBox('siren_red', 1.5, 1.5, 1.5, tx, towerH + 5.4, tz);
      world.addCollider(tx, tz, 9.5, 10.5, towerH + 4, 0);
    }

    for (const beamY of [32, 62, 90]) {
      batcher.addBox('dark_steel', 56.0, 4.6, 6.4, bx, beamY, tz);
      batcher.addBox('alert_yellow', 56.6, 0.75, 6.8, bx, beamY - 2.1, tz);
      batcher.addBox('alert_yellow', 56.6, 0.75, 6.8, bx, beamY + 2.1, tz);
    }

    const cableSpans = [20, 34, 48, 62, 76];
    for (const side of [-1, 1]) {
      const towerAnchorX = bx + side * 23.2;
      const deckAnchorX = bx + side * 22.0;
      for (const dirZ of [-1, 1]) {
        cableSpans.forEach((spanZ, idx) => {
          const towerAnchorY = 86 - idx * 3.6;
          const towerAnchorZ = tz + dirZ * 2.5;
          const deckAnchorZ = tz + dirZ * spanZ;
          batcher.addCable('brushed_silver', 0.42, towerAnchorX, towerAnchorY, towerAnchorZ, deckAnchorX, 2.4, deckAnchorZ);
          batcher.addBox('alert_yellow', 0.95, 1.1, 1.2, deckAnchorX, 2.5, deckAnchorZ);
          world.prisonIslandData.bridgeStayCablesCount++;
        });
      }
    }
  }

  _buildBridgeBopeCheckpoint(world, batcher, bx, IS_SCALED_WORLD ? zStart + 14 : 746, 'CONTROLE PONTE — BOPE (PORTO)', 0);
  _buildBridgeBopeCheckpoint(world, batcher, bx, IS_SCALED_WORLD ? zEnd - 23 : 1102, 'BLOQUEIO PENITENCIÁRIO — BOPE', Math.PI);

  if (IS_SCALED_WORLD && 1120 + PRISON_OFFSET_Z > zEnd + 8) {
    _buildArmoredNorthCauseway(world, batcher, bx, zEnd, 1120 + PRISON_OFFSET_Z);
  }
}

/**
 * Causeway Logístico Blindado Norte (26m de largura + guard-rails + balizadores BOPE)
 * ligando a chegada Sul da Ponte Estaiada (`zEnd = ws(1122)`) ao Portão Monumental Norte (`1120 + oz`).
 */
function _buildArmoredNorthCauseway(world, batcher, bx, zFrom, zTo) {
  const roadW = 26;
  const len = zTo - zFrom;
  const midZ = (zFrom + zTo) * 0.5;
  const westBranchZ = 1120 + PRISON_OFFSET_Z - 240;

  batcher.addBox('island_basalt', roadW + 14, 1.2, len + 4, bx, -0.22, midZ);
  batcher.addBox('gunmetal_concrete', roadW + 8, 0.36, len + 2, bx, 0.2, midZ);
  batcher.addBox('matte_black', roadW, 0.14, len, bx, 0.34, midZ);
  batcher.addBox('alert_yellow', 0.45, 0.05, len - 4, bx - 0.55, 0.42, midZ);
  batcher.addBox('alert_yellow', 0.45, 0.05, len - 4, bx + 0.55, 0.42, midZ);

  for (let zz = zFrom + 12; zz <= zTo - 12; zz += 14) {
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx - 6.5, 0.42, zz);
    batcher.addBox('tactical_white', 0.35, 0.05, 7.5, bx + 6.5, 0.42, zz);
  }

  for (let bz = zFrom + 22; bz <= zTo - 18; bz += 26) {
    for (const side of [-1, 1]) {
      if (side === -1 && Math.abs(bz - westBranchZ) < 24) continue;
      const railX = bx + side * (roadW * 0.5 + 2.2);
      batcher.addBox('brushed_silver', 0.42, 0.48, 20.0, railX, 0.92, bz);
      batcher.addBox('bope_black', 0.7, 1.25, 0.7, railX, 0.92, bz - 9.5);
      batcher.addBox('alert_yellow', 0.76, 0.28, 0.76, railX, 1.48, bz - 9.5);
    }
  }

  for (let pz = zFrom + 42; pz <= zTo - 32; pz += 56) {
    for (const side of [-1, 1]) {
      if (side === -1 && Math.abs(pz - westBranchZ) < 24) continue;
      const lampX = bx + side * (roadW * 0.5 + 4.4);
      batcher.addCylinder('dark_steel', 0.28, 0.36, 12.0, lampX, 6.3, pz, 8);
      batcher.addBox('dark_steel', 3.4, 0.32, 0.45, lampX - side * 1.4, 12.1, pz);
      batcher.addBox('searchlight_white', 1.6, 0.24, 0.75, lampX - side * 2.4, 11.9, pz);
      world.addCollider(lampX, pz, 1.0, 1.0, 12.4, 0.28);
    }
  }

  world.mapRoads.push({ x: bx, z: midZ, w: roadW, d: len, isMain: true });
  if (!Array.isArray(world.mapOrganicRoads)) world.mapOrganicRoads = [];
  world.mapOrganicRoads.push({
    id: 'prison_causeway_north',
    label: 'CAUSEWAY BLINDADO NORTE',
    isMain: true,
    width: roadW,
    points: [[bx, zFrom], [bx, zTo]]
  });
}

function _buildBridgeBopeCheckpoint(world, batcher, cx, cz, signTitle, facingRotY) {
  for (const side of [-1, 1]) {
    const px = cx + side * 19.5;
    batcher.addBox('bope_black', 3.2, 15.5, 3.6, px, 7.75, cz);
    batcher.addBox('alert_yellow', 3.4, 1.2, 3.8, px, 3.2, cz);
    batcher.addBox('alert_yellow', 3.4, 1.2, 3.8, px, 12.8, cz);

    const gx = cx + side * 15.2;
    const gz = cz + (facingRotY === 0 ? -5.5 : 5.5);
    batcher.addBox('gunmetal_concrete', 5.2, 4.4, 5.8, gx, 2.5, gz);
    batcher.addBox('smoked_glass', 5.4, 1.5, 4.2, gx, 3.1, gz);
    batcher.addBox('bope_black', 6.0, 0.85, 6.6, gx, 4.9, gz);
    batcher.addBox('alert_yellow', 6.1, 0.28, 6.7, gx, 5.35, gz);
    batcher.addBox('siren_red', 0.65, 0.65, 0.65, gx - side * 1.4, 5.65, gz);
    batcher.addBox('siren_blue', 0.65, 0.65, 0.65, gx + side * 1.4, 5.65, gz);
    world.addCollider(gx, gz, 5.2, 5.8, 5.5, 0.28);

    const barX = cx + side * 11.2;
    batcher.addBox('gunmetal_concrete', 4.6, 1.35, 1.6, barX, 0.95, cz);
    batcher.addBox('alert_yellow', 4.7, 0.35, 1.7, barX, 1.45, cz);
    world.addCollider(barX, cz, 4.6, 1.6, 1.8, 0.28);

    const gatePivotX = cx + side * 12.6;
    batcher.addBox('bope_black', 1.1, 1.8, 1.1, gatePivotX, 1.18, cz + 2.2);
    for (let s = 0; s < 4; s++) {
      const segX = gatePivotX - side * (1.2 + s * 1.15);
      batcher.addBox(s % 2 === 0 ? 'cv_red' : 'tactical_white', 1.15, 0.26, 0.26, segX, 1.82, cz + 2.2);
    }

    addBatchedLegoPerson(batcher, cx + side * 10.2, 0.3, cz - 2.6, facingRotY, 'bope_guard', 'stand');
    addBatchedLegoPerson(batcher, cx + side * 14.0, 0.3, cz + 2.8, facingRotY, 'warden_police', 'stand');
    world.prisonIslandData.guardsCount += 2;
  }

  batcher.addBox('bope_black', 42.0, 3.2, 3.8, cx, 15.8, cz);
  batcher.addBox('alert_yellow', 42.4, 0.45, 4.0, cx, 14.2, cz);
  for (const lx of [-14, -6, 6, 14]) {
    batcher.addBox('searchlight_white', 2.4, 0.9, 0.6, cx + lx, 14.0, cz + (facingRotY === 0 ? -2.0 : 2.0));
  }
  addPrisonBannerSign(
    world,
    cx,
    15.9,
    cz + (facingRotY === 0 ? -2.1 : 2.1),
    26.0,
    2.6,
    signTitle,
    'ÁREA DE SEGURANÇA MÁXIMA — REDUZA A VELOCIDADE',
    facingRotY
  );
}
