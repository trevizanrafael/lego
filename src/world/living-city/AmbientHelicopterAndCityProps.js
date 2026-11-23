import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick
} from '../../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';
import { isPointOnOrganicLand, isInsideBuiltUrbanCore } from '../CoastlineProfile.js';
import { soundFX } from '../../audio/SoundFX.js';
import { IS_SCALED_WORLD, WORLD_SCALE, ROAD, ws } from '../core/WorldLayoutScale.js';
import {
  isPointInsideGridBox,
  resolvePointOutOfObb,
  sliceSidewalkCorridorAgainstRoads
} from './OrganicTrafficPolylineHelper.js';

const CROSSWALK_HASH_CELL = 128;
const SIDEWALK_HASH_CELL = 192;
const _obbPushOut = { x: 0, z: 0 };

export const ambientHelicopterAndCityPropsMethods = {
  // ============================================================================
  // GRADE ESPACIAL 2D O(1) DE PRÉDIOS E MUROS (CÉLULAS 48m x 48m)
  // ============================================================================
  _initBuildingSpatialGrid() {
    this._buildingGrid.clear();
    const cs = this._buildingGridCellSize;
    const boxes = [];

    if (this.world?.mapBuildings) {
      for (const bld of this.world.mapBuildings) {
        const hw = (bld.w || 0) * 0.5;
        const hd = (bld.d || 0) * 0.5;
        if (hw < 1.5 || hd < 1.5) continue;
        // O interior térreo do Super Banco Central é aberto, e Estações Elevadas / Mirante não bloqueiam o térreo!
        if (IS_SCALED_WORLD ? bld.label === 'BANCO CENTRAL' : (Math.abs(bld.x) < 76 && bld.z > -231 && bld.z < -128)) continue;
        if (bld.label && (bld.label.startsWith('METRÔ') || bld.label.startsWith('MIRANTE'))) continue;
        const rotY = Number(bld.rotY) || 0;
        if (Math.abs(rotY) > 1e-3) {
          const cosYaw = Math.cos(rotY);
          const sinYaw = Math.sin(rotY);
          const extX = Math.abs(cosYaw) * hw + Math.abs(sinYaw) * hd;
          const extZ = Math.abs(sinYaw) * hw + Math.abs(cosYaw) * hd;
          boxes.push({
            minX: bld.x - extX,
            maxX: bld.x + extX,
            minZ: bld.z - extZ,
            maxZ: bld.z + extZ,
            isObb: true,
            cx: bld.x,
            cz: bld.z,
            hx: hw,
            hz: hd,
            cosYaw,
            sinYaw
          });
        } else {
          boxes.push({
            minX: bld.x - hw,
            maxX: bld.x + hw,
            minZ: bld.z - hd,
            maxZ: bld.z + hd,
            isObb: false
          });
        }
      }
    }

    if (this.world?.colliders) {
      for (const col of this.world.colliders) {
        const minY = col.minY ?? 0;
        const h = col.maxY - minY;
        const w = col.maxX - col.minX;
        const d = col.maxZ - col.minZ;
        if (col.disabled || h < 2.8 || minY >= 3.2 || (w < 2.2 && d < 2.2)) continue;
        if (col.shapeType === 'obb') {
          boxes.push({
            minX: col.minX,
            maxX: col.maxX,
            minZ: col.minZ,
            maxZ: col.maxZ,
            isObb: true,
            cx: col.cx,
            cz: col.cz,
            hx: col.halfX,
            hz: col.halfZ,
            cosYaw: col.cosYaw,
            sinYaw: col.sinYaw
          });
        } else {
          boxes.push({
            minX: col.minX,
            maxX: col.maxX,
            minZ: col.minZ,
            maxZ: col.maxZ,
            isObb: false
          });
        }
      }
    }

    for (const box of boxes) {
      const gx0 = Math.floor((box.minX - 3.0) / cs);
      const gx1 = Math.floor((box.maxX + 3.0) / cs);
      const gz0 = Math.floor((box.minZ - 3.0) / cs);
      const gz1 = Math.floor((box.maxZ + 3.0) / cs);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = ((gx & 0xffff) << 16) | (gz & 0xffff);
          let cell = this._buildingGrid.get(key);
          if (!cell) {
            cell = [];
            this._buildingGrid.set(key, cell);
          }
          cell.push(box);
        }
      }
    }
  },

  _isInsideBuilding(x, z, padding = 0.9) {
    if (!this._buildingGrid) this._initBuildingSpatialGrid();
    const cs = this._buildingGridCellSize || 48;
    const gx = Math.floor(x / cs);
    const gz = Math.floor(z / cs);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cell = this._buildingGrid.get((((gx + dx) & 0xffff) << 16) | ((gz + dz) & 0xffff));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          if (isPointInsideGridBox(cell[i], x, z, padding)) return true;
        }
      }
    }
    return false;
  },

  _resolveBuildingCollision(x, z, radius = 0.95) {
    if (!this._buildingGrid) this._initBuildingSpatialGrid();
    let curX = x;
    let curZ = z;
    let collided = false;
    const cs = this._buildingGridCellSize || 48;
    const gx = Math.floor(curX / cs);
    const gz = Math.floor(curZ / cs);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cell = this._buildingGrid.get((((gx + dx) & 0xffff) << 16) | ((gz + dz) & 0xffff));
        if (!cell || cell.length === 0) continue;

        for (let i = 0; i < cell.length; i++) {
          const box = cell[i];
          const padMinX = box.minX - radius;
          const padMaxX = box.maxX + radius;
          const padMinZ = box.minZ - radius;
          const padMaxZ = box.maxZ + radius;
          if (curX > padMinX && curX < padMaxX && curZ > padMinZ && curZ < padMaxZ) {
            if (box.isObb) {
              if (resolvePointOutOfObb(box, curX, curZ, radius, _obbPushOut)) {
                curX = _obbPushOut.x;
                curZ = _obbPushOut.z;
                collided = true;
              }
            } else {
              const dLeft = Math.abs(curX - padMinX);
              const dRight = Math.abs(padMaxX - curX);
              const dBack = Math.abs(curZ - padMinZ);
              const dFront = Math.abs(padMaxZ - curZ);
              const minD = Math.min(dLeft, dRight, dBack, dFront);
              if (minD === dLeft) curX = padMinX - 0.08;
              else if (minD === dRight) curX = padMaxX + 0.08;
              else if (minD === dBack) curZ = padMinZ - 0.08;
              else curZ = padMaxZ + 0.08;
              collided = true;
            }
          }
        }
      }
    }

    if (!this._collisionRes) {
      this._collisionRes = { x: 0, z: 0, collided: false };
    }
    this._collisionRes.x = curX;
    this._collisionRes.z = curZ;
    this._collisionRes.collided = collided;
    return this._collisionRes;
  },

  _initRoadAndSidewalkSpatialIndex() {
    this._roadRects = [];
    this._crosswalkGrid = new Map();
    this._sidewalkGrid = new Map();
    this._validSidewalkCorridors = [];
    this._corridorsByBlockId = new Map();
    this._intersectionsByRoadKey = new Map();
    if (!IS_SCALED_WORLD) return;

    const mapRoads = Array.isArray(this.world?.mapRoads) ? this.world.mapRoads : [];
    for (let i = 0; i < mapRoads.length; i++) {
      const r = mapRoads[i];
      const hw = (r.w || 0) * 0.5;
      const hd = (r.d || 0) * 0.5;
      if (hw <= 0 || hd <= 0) continue;
      const isZConst = r.w >= r.d;
      this._roadRects.push({
        minX: r.x - hw,
        maxX: r.x + hw,
        minZ: r.z - hd,
        maxZ: r.z + hd,
        axis: isZConst ? 'z_const' : 'x_const',
        roadCoord: isZConst ? r.z : r.x,
        halfRoadW: isZConst ? hd : hw,
        isMain: Boolean(r.isMain)
      });
    }

    const cwZones = Array.isArray(this.world?.crosswalkZones) ? this.world.crosswalkZones : [];
    const seenJunctions = new Set();
    for (let i = 0; i < cwZones.length; i++) {
      const cw = cwZones[i];
      const gx0 = Math.floor(cw.minX / CROSSWALK_HASH_CELL);
      const gx1 = Math.floor(cw.maxX / CROSSWALK_HASH_CELL);
      const gz0 = Math.floor(cw.minZ / CROSSWALK_HASH_CELL);
      const gz1 = Math.floor(cw.maxZ / CROSSWALK_HASH_CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = ((gx & 0xffff) << 16) | (gz & 0xffff);
          let list = this._crosswalkGrid.get(key);
          if (!list) {
            list = [];
            this._crosswalkGrid.set(key, list);
          }
          list.push(cw);
        }
      }
      const jKey = `${cw.ix},${cw.iz}`;
      if (!seenJunctions.has(jKey)) {
        seenJunctions.add(jKey);
        const hwX = cw.axis === 'x' ? (cw.maxX - cw.minX) * 0.5 : Math.abs((cw.minX + cw.maxX) * 0.5 - cw.ix) - 2.35;
        const hwZ = cw.axis === 'z' ? (cw.maxZ - cw.minZ) * 0.5 : Math.abs((cw.minZ + cw.maxZ) * 0.5 - cw.iz) - 2.35;
        const zKey = `z:${Math.round(cw.iz)}`;
        const xKey = `x:${Math.round(cw.ix)}`;
        if (!this._intersectionsByRoadKey.has(zKey)) this._intersectionsByRoadKey.set(zKey, []);
        if (!this._intersectionsByRoadKey.has(xKey)) this._intersectionsByRoadKey.set(xKey, []);
        this._intersectionsByRoadKey.get(zKey).push({ ix: cw.ix, iz: cw.iz, along: cw.ix, halfCrossW: Math.max(13, hwX) });
        this._intersectionsByRoadKey.get(xKey).push({ ix: cw.ix, iz: cw.iz, along: cw.iz, halfCrossW: Math.max(13, hwZ) });
      }
    }
    for (const list of this._intersectionsByRoadKey.values()) {
      list.sort((a, b) => a.along - b.along);
    }

    const rawCorridors = [];
    const srcCorridors = Array.isArray(this.world?.sidewalkCorridors) ? this.world.sidewalkCorridors : [];
    for (let i = 0; i < srcCorridors.length; i++) {
      const sliced = sliceSidewalkCorridorAgainstRoads(srcCorridors[i], this._roadRects);
      for (let k = 0; k < sliced.length; k++) {
        rawCorridors.push(sliced[k]);
      }
    }
    rawCorridors.push(
      { minX: ws(-490), maxX: ws(-400), minZ: ws(731), maxZ: ws(745), axis: 'x', centerCoord: ws(738), blockId: 'boardwalk_w2' },
      { minX: ws(-368), maxX: ws(-136), minZ: ws(731), maxZ: ws(745), axis: 'x', centerCoord: ws(738), blockId: 'boardwalk_w1' },
      { minX: ws(-104), maxX: ws(236), minZ: ws(731), maxZ: ws(745), axis: 'x', centerCoord: ws(738), blockId: 'boardwalk_c' },
      { minX: ws(268), maxX: ws(510), minZ: ws(731), maxZ: ws(745), axis: 'x', centerCoord: ws(738), blockId: 'boardwalk_e' }
    );

    for (let i = 0; i < rawCorridors.length; i++) {
      const rc = rawCorridors[i];
      const startAlong = (rc.axis === 'x' ? rc.minX : rc.minZ) + 4.8;
      const endAlong = (rc.axis === 'x' ? rc.maxX : rc.maxZ) - 4.8;
      if (endAlong - startAlong < 18.0) continue;
      const midAlong = (startAlong + endAlong) * 0.5;
      const mx = rc.axis === 'x' ? midAlong : rc.centerCoord;
      const mz = rc.axis === 'x' ? rc.centerCoord : midAlong;
      if (this._isInsideAsphaltRoad(mx, mz, 1.2) || !this._isValidDryLandForPedestrian(mx, mz)) continue;

      const entry = {
        axis: rc.axis,
        centerCoord: rc.centerCoord,
        startAlong,
        endAlong,
        minX: rc.minX,
        maxX: rc.maxX,
        minZ: rc.minZ,
        maxZ: rc.maxZ,
        mx,
        mz,
        blockId: rc.blockId || `sw_${i}`
      };
      this._validSidewalkCorridors.push(entry);

      let blkList = this._corridorsByBlockId.get(entry.blockId);
      if (!blkList) {
        blkList = [];
        this._corridorsByBlockId.set(entry.blockId, blkList);
      }
      blkList.push(entry);

      const gx0 = Math.floor(entry.minX / SIDEWALK_HASH_CELL);
      const gx1 = Math.floor(entry.maxX / SIDEWALK_HASH_CELL);
      const gz0 = Math.floor(entry.minZ / SIDEWALK_HASH_CELL);
      const gz1 = Math.floor(entry.maxZ / SIDEWALK_HASH_CELL);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = ((gx & 0xffff) << 16) | (gz & 0xffff);
          let bucket = this._sidewalkGrid.get(key);
          if (!bucket) {
            bucket = [];
            this._sidewalkGrid.set(key, bucket);
          }
          bucket.push(entry);
        }
      }
    }
  },

  _isInsideAsphaltRoad(x, z, margin = 0) {
    const rects = this._roadRects;
    if (!rects || rects.length === 0) return false;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (x > r.minX - margin && x < r.maxX + margin && z > r.minZ - margin && z < r.maxZ + margin) {
        return true;
      }
    }
    return false;
  },

  _isInsideCrosswalkZone(x, z, margin = 0) {
    if (!this._crosswalkGrid || this._crosswalkGrid.size === 0) return false;
    const gx = Math.floor(x / CROSSWALK_HASH_CELL);
    const gz = Math.floor(z / CROSSWALK_HASH_CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this._crosswalkGrid.get((((gx + dx) & 0xffff) << 16) | ((gz + dz) & 0xffff));
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const cw = list[i];
          if (x >= cw.minX - margin && x <= cw.maxX + margin && z >= cw.minZ - margin && z <= cw.maxZ + margin) {
            return true;
          }
        }
      }
    }
    return false;
  },

  _isTrafficLightRedForAxis(carAxis, ix, iz) {
    const phaseOff = ((Math.round(ix) * 7 + Math.round(iz) * 13) % 20 + 20) % 20;
    const t = (((this._trafficLightClock || 0) + phaseOff * 0.35) % 20 + 20) % 20;
    // 0..8.8s: verde z_const | 8.8..10.0s: vermelho total | 10.0..18.8s: verde x_const | 18.8..20.0s: vermelho total
    if (carAxis === 'z_const') return t >= 8.8;
    return t < 10.0 || t >= 18.8;
  },

  _findSafeSidewalkSpawn(x, z, maxSearchRadius = 160, seed = 0) {
    if (!IS_SCALED_WORLD || !this._validSidewalkCorridors?.length) {
      return this._findSafeStreetSpawn(x, z, 1.5);
    }
    const cellR = Math.max(1, Math.ceil(maxSearchRadius / SIDEWALK_HASH_CELL));
    const gx0 = Math.floor(x / SIDEWALK_HASH_CELL);
    const gz0 = Math.floor(z / SIDEWALK_HASH_CELL);
    let bestCorridor = null;
    let bestAlong = 0;
    let bestDistSq = maxSearchRadius * maxSearchRadius;

    for (let dx = -cellR; dx <= cellR; dx++) {
      for (let dz = -cellR; dz <= cellR; dz++) {
        const bucket = this._sidewalkGrid.get((((gx0 + dx) & 0xffff) << 16) | ((gz0 + dz) & 0xffff));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const c = bucket[i];
          const clampedAlong = c.axis === 'x'
            ? Math.max(c.startAlong, Math.min(c.endAlong, x))
            : Math.max(c.startAlong, Math.min(c.endAlong, z));
          const px = c.axis === 'x' ? clampedAlong : c.centerCoord;
          const pz = c.axis === 'x' ? c.centerCoord : clampedAlong;
          const dSq = (px - x) * (px - x) + (pz - z) * (pz - z);
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            bestCorridor = c;
            bestAlong = clampedAlong;
          }
        }
      }
    }

    if (bestCorridor) {
      const c = bestCorridor;
      const jitters = [((seed % 5) - 2) * 0.9, 0, -1.8, 1.8];
      for (let j = 0; j < jitters.length; j++) {
        const jit = jitters[j];
        for (let s = 0; s < 5; s++) {
          const shift = s === 0 ? 0 : (s % 2 === 1 ? 1 : -1) * Math.ceil(s * 0.5) * 8.0;
          const al = Math.max(c.startAlong, Math.min(c.endAlong, bestAlong + shift));
          const sx = c.axis === 'x' ? al : c.centerCoord + jit;
          const sz = c.axis === 'x' ? c.centerCoord + jit : al;
          if (
            !this._isInsideAsphaltRoad(sx, sz, 1.4) &&
            !this._isInsideBuilding(sx, sz, 1.25) &&
            this._isValidDryLandForPedestrian(sx, sz)
          ) {
            return { x: sx, z: sz, valid: true, corridor: c, laneJitter: jit };
          }
        }
      }
    }
    return { x, z, valid: false, corridor: null, laneJitter: 0 };
  },

  _isValidDryLandForPedestrian(x, z) {
    // Limites estendidos do supercontinente Pangeia (excluindo mar aberto e bocas subterrâneas do Metrô)
    if (x < ws(-3380) || x > ws(3380) || z < ws(-2900) || z > ws(2500)) return false;
    if (getMetroCutoutFloorY(x, z) !== null) return false;
    if (!isInsideBuiltUrbanCore(x, z) && !isPointOnOrganicLand(x, z)) return false;
    if (this.world?.isDeepWaterAt && this.world.isDeepWaterAt(x, z)) return false;
    return true;
  },

  _findSafeStreetSpawn(x, z, radius = 1.9) {
    const res = this._resolveBuildingCollision(x, z, radius);
    if (
      !this._isInsideBuilding(res.x, res.z, radius * 0.85) &&
      this._isValidDryLandForPedestrian(res.x, res.z)
    ) {
      return { x: res.x, z: res.z, valid: true };
    }
    for (let ring = 1; ring <= 6; ring++) {
      const dist = ring * 6.0;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const tx = x + Math.cos(ang) * dist;
        const tz = z + Math.sin(ang) * dist;
        if (!this._isValidDryLandForPedestrian(tx, tz)) continue;
        const cand = this._resolveBuildingCollision(tx, tz, radius);
        if (
          !this._isInsideBuilding(cand.x, cand.z, radius * 0.85) &&
          this._isValidDryLandForPedestrian(cand.x, cand.z)
        ) {
          return { x: cand.x, z: cand.z, valid: true };
        }
      }
    }
    return { x: res.x, z: res.z, valid: false };
  },

  // ============================================================================
  // VIDA AMBIENTE NO CÉU E NAS CALÇADAS: HELICÓPTERO CIVIL DE TV + BANCAS DE LANCHE LEGO!
  // ============================================================================
  _initCivilianSkyHelicopter() {
    const heliGroup = new THREE.Group();
    const yellowMat = getLegoMaterial(LEGO_COLORS.yellow, { roughness: 0.22, clearcoat: 0.5 });
    const skyBlueMat = getLegoMaterial(0x0284c7, { roughness: 0.22, clearcoat: 0.5 });
    const darkMat = getLegoMaterial(LEGO_COLORS.charcoal, { roughness: 0.35 });
    const glassMat = getLegoMaterial(0x38bdf8, { roughness: 0.08, metalness: 0.45 });

    const cabin = createLegoBrick(2.4, 1.6, 4.4, LEGO_COLORS.white, { studStep: 0.7 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.36, 4.44), skyBlueMat);
    stripe.position.set(0, -0.1, 0);
    const noseWindshield = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.15, 1.5), glassMat);
    noseWindshield.position.set(0, 0.1, 2.25);
    const yellowTailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.72, 4.6), yellowMat);
    yellowTailBoom.position.set(0, 0.22, -4.1);
    const tailFin = createLegoBrick(0.26, 1.55, 1.1, 0x0284c7, { studs: false });
    tailFin.position.set(0, 0.85, -6.1);

    const tvPod = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), darkMat);
    tvPod.position.set(0, -0.95, 2.1);
    for (const sx of [-1.05, 1.05]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.8, 8), darkMat);
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -1.25, 0.2);
      const strutF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.14), darkMat);
      strutF.position.set(sx, -0.95, 1.2);
      const strutR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.14), darkMat);
      strutR.position.set(sx, -0.95, -1.0);
      heliGroup.add(skid, strutF, strutR);
    }

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 10), darkMat);
    mast.position.set(0, 1.05, 0);
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 1.32, 0);
    const bladeA = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.08, 0.44), darkMat);
    const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 9.2), yellowMat);
    mainRotor.add(bladeA, bladeB);

    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.75, 0.24), yellowMat);
    tailRotor.position.set(0.22, 0.95, -6.15);

    heliGroup.add(cabin, stripe, noseWindshield, yellowTailBoom, tailFin, tvPod, mast, mainRotor, tailRotor);
    heliGroup.position.set(0, 65, ws(120));
    this.scene.add(heliGroup);

    this.civilianSkyHeli = {
      group: heliGroup,
      mainRotor,
      tailRotor,
      orbitAngle: 0.4
    };
  },

  _updateCivilianSkyHelicopter(dt) {
    if (!this.civilianSkyHeli) return;
    const h = this.civilianSkyHeli;
    const angRate = IS_SCALED_WORLD ? 0.075 / WORLD_SCALE : 0.075;
    h.orbitAngle += dt * angRate;
    const rx = ws(340);
    const rz = ws(440);
    const czBase = ws(180);
    const cx = Math.cos(h.orbitAngle) * rx;
    const cz = czBase + Math.sin(h.orbitAngle) * rz;
    const nextX = Math.cos(h.orbitAngle + 0.02) * rx;
    const nextZ = czBase + Math.sin(h.orbitAngle + 0.02) * rz;

    h.group.position.set(cx, 65 + Math.sin(h.orbitAngle * 3.0) * 1.8, cz);
    h.group.rotation.y = Math.atan2(nextX - cx, nextZ - cz);
    h.group.rotation.z = -0.12;
    h.mainRotor.rotation.y += dt * 18.0;
    h.tailRotor.rotation.x += dt * 22.0;
  },

  /**
   * BANCAS / CARRINHOS LEGO DE CACHORRO-QUENTE, SORVETE E CAFÉ NAS CALÇADAS
   */
  _initStreetVendorCarts() {
    if (!this.destructibles) return;

    const mOff = ROAD.mainWidth * 0.5 + 7.2; // 24.2m em 3x (borda interna da calçada de 10m)
    const cartSpots = IS_SCALED_WORLD
      ? [
          // Centro Financeiro & Super Banco Central (Av. Z = ws(-117), Av. X = ws(±120))
          { x: -34, z: ws(-117) - mOff, kind: 'hotdog' },
          { x: 34, z: ws(-117) - mOff, kind: 'coffee' },
          { x: -42, z: ws(-117) + mOff, kind: 'coffee' },
          { x: 42, z: ws(-117) + mOff, kind: 'hotdog' },
          { x: ws(-120) + mOff, z: ws(-155), kind: 'coffee' },
          { x: ws(120) - mOff, z: ws(-155), kind: 'hotdog' },
          // Times Square & Torre dos Heróis (Av. Z = 0, Av. X = ws(-252))
          { x: ws(-65), z: -mOff, kind: 'hotdog' },
          { x: ws(-105), z: -mOff, kind: 'icecream' },
          { x: ws(-252) + mOff, z: ws(-85), kind: 'coffee' },
          { x: ws(-252) + mOff, z: ws(-35), kind: 'hotdog' },
          { x: ws(65), z: -mOff, kind: 'coffee' },
          // Parque Central & Lago (Calçada Norte Z = ws(134) + mOff)
          { x: ws(42), z: ws(134) + mOff, kind: 'icecream' },
          { x: ws(92), z: ws(134) + mOff, kind: 'hotdog' },
          { x: ws(165), z: ws(134) + mOff, kind: 'coffee' },
          { x: ws(-120) + mOff, z: ws(65), kind: 'icecream' },
          { x: ws(120) - mOff, z: ws(65), kind: 'hotdog' },
          // Calçadão Turístico da Praia Sul
          { x: ws(-165), z: ws(734), kind: 'icecream' },
          { x: ws(-72), z: ws(734), kind: 'hotdog' },
          { x: ws(-24), z: ws(734), kind: 'icecream' },
          { x: ws(36), z: ws(734), kind: 'coffee' },
          { x: ws(135), z: ws(734), kind: 'icecream' },
          { x: ws(195), z: ws(734), kind: 'hotdog' }
        ]
      : [
          // Centro Financeiro & Super Banco Central
          { x: -30, z: -133, kind: 'hotdog' },
          { x: 30, z: -133, kind: 'coffee' },
          { x: -38, z: -101, kind: 'coffee' },
          { x: 38, z: -101, kind: 'hotdog' },
          { x: -104, z: -155, kind: 'coffee' },
          { x: 104, z: -155, kind: 'hotdog' },
          // Times Square & Torre dos Heróis
          { x: -65, z: -16, kind: 'hotdog' },
          { x: -105, z: -16, kind: 'icecream' },
          { x: -185, z: -85, kind: 'coffee' },
          { x: -215, z: -35, kind: 'hotdog' },
          { x: 65, z: -16, kind: 'coffee' },
          // Parque Central & Lago
          { x: 42, z: 22, kind: 'icecream' },
          { x: 92, z: 22, kind: 'hotdog' },
          { x: 165, z: 22, kind: 'coffee' },
          { x: 64, z: 145, kind: 'icecream' },
          { x: 135, z: 162, kind: 'hotdog' },
          // Calçadão Turístico da Praia Sul & Píer
          { x: -165, z: 728, kind: 'icecream' },
          { x: -72, z: 728, kind: 'hotdog' },
          { x: -18, z: 728, kind: 'icecream' },
          { x: 36, z: 728, kind: 'coffee' },
          { x: 125, z: 728, kind: 'icecream' },
          { x: 195, z: 728, kind: 'hotdog' }
        ];

    for (const sp of cartSpots) {
      const safe = this._findSafeStreetSpawn(sp.x, sp.z, 1.5);
      if (IS_SCALED_WORLD && this._isInsideAsphaltRoad(safe.x, safe.z, 1.8)) continue;
      const yBase = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(safe.x, safe.z) : 0;

      const primaryHex =
        sp.kind === 'hotdog' ? 0xdc2626 : sp.kind === 'icecream' ? 0xec4899 : 0x78350f;
      const secondaryHex =
        sp.kind === 'hotdog' ? 0xfacc15 : sp.kind === 'icecream' ? 0x38bdf8 : 0xfde68a;

      const cartGroup = new THREE.Group();
      const body = createLegoBrick(1.9, 1.05, 1.15, primaryHex, { studStep: 0.55 });
      body.position.set(0, 0.72, 0);
      const counterTop = createLegoBrick(2.02, 0.16, 1.25, LEGO_COLORS.white, { studStep: 0.55 });
      counterTop.position.set(0, 1.32, 0);

      const wheelMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.35 });
      for (const wx of [-0.65, 0.65]) {
        for (const wz of [-0.6, 0.6]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 12), wheelMat);
          w.rotation.x = Math.PI / 2;
          w.position.set(wx, 0.24, wz);
          cartGroup.add(w);
        }
      }

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 1.65, 8),
        getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.5, roughness: 0.2 })
      );
      pole.position.set(0, 2.15, 0);
      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(1.45, 0.62, 8),
        getLegoMaterial(secondaryHex, { roughness: 0.22 })
      );
      umbrella.position.set(0, 2.95, 0);
      const topStud = new THREE.Mesh(SHARED_STUD_GEO, getLegoMaterial(primaryHex));
      topStud.position.set(0, 3.28, 0);

      cartGroup.add(body, counterTop, pole, umbrella, topStud);
      cartGroup.position.set(safe.x, yBase, safe.z);
      this.scene.add(cartGroup);

      const col = this.world.addCollider(safe.x, safe.z, 2.0, 1.3, yBase + 2.2, yBase);
      this.destructibles.registerDestructible({
        mesh: cartGroup,
        type: 'newsstand',
        hp: 35,
        radius: 1.45,
        height: 2.8,
        colliders: [col],
        debrisColors: [primaryHex, secondaryHex, LEGO_COLORS.white, LEGO_COLORS.yellow],
        studDrops: { silver: 3, gold: 8, blue: 4, purple: 0 },
        groundY: yBase
      });
    }
  },

  // ============================================================================
  // COMANDO [G] DO COMANDANTE CAVEIRA (ENTREGA VIATURA BLINDADA PACÍFICA!)
  // ============================================================================
  triggerCaveiraRadioCommand(playerPos, facingAngle) {
    if (!playerPos || this.caveiraSupportCooldown > 0) return;
    this.caveiraSupportCooldown = 3.5;
    soundFX.playHeroSwap();

    const rawDropX = playerPos.x + Math.sin(facingAngle) * 8.0;
    const rawDropZ = playerPos.z + Math.cos(facingAngle) * 8.0;
    const safeDrop = this._findSafeStreetSpawn(rawDropX, rawDropZ, 2.8);
    const dropY = this.world.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(safeDrop.x, safeDrop.z)
      : 0;

    const vType = this.caveiraCallToggle % 2 === 0 ? 'caveirao_bope' : 'interceptor_v8';
    this.caveiraCallToggle++;
    const spec = VEHICLE_SPECS[vType];

    const carMesh = createLegoCarMesh({
      x: safeDrop.x,
      z: safeDrop.z,
      rotY: facingAngle,
      color: 0x111827,
      roofColor: vType === 'caveirao_bope' ? 0x111827 : LEGO_COLORS.white,
      type: vType
    });
    carMesh.position.set(safeDrop.x, dropY, safeDrop.z);
    carMesh.rotation.y = facingAngle;
    carMesh.userData.carType = vType;
    carMesh.userData.carName = spec.name;
    carMesh.userData.vehicleSpec = spec;
    this.scene.add(carMesh);

    const col1 = this.world.addCollider(safeDrop.x, safeDrop.z, 2.6, 5.2, dropY + 1.4, dropY);
    if (this.destructibles) {
      this.destructibles.registerDestructible({
        mesh: carMesh,
        type: 'car',
        hp: spec.hp,
        radius: 2.8,
        height: 2.2,
        colliders: [col1],
        debrisColors: [0x111827, 0xfacc15, 0xf8fafc],
        studDrops: spec.studDrops,
        groundY: dropY
      });
      this.destructibles.spawnHeroSwapEffect(
        new THREE.Vector3(safeDrop.x, dropY + 0.5, safeDrop.z),
        0xfacc15
      );
    }
  }
};
