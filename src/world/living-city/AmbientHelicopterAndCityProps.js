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
        if (Math.abs(bld.x) < 76 && bld.z > -231 && bld.z < -128) continue;
        if (bld.label && (bld.label.startsWith('METRÔ') || bld.label.startsWith('MIRANTE'))) continue;
        boxes.push({
          minX: bld.x - hw,
          maxX: bld.x + hw,
          minZ: bld.z - hd,
          maxZ: bld.z + hd
        });
      }
    }

    if (this.world?.colliders) {
      for (const col of this.world.colliders) {
        const minY = col.minY ?? 0;
        const h = col.maxY - minY;
        const w = col.maxX - col.minX;
        const d = col.maxZ - col.minZ;
        if (col.disabled || h < 2.8 || minY >= 3.2 || (w < 2.2 && d < 2.2)) continue;
        boxes.push({
          minX: col.minX,
          maxX: col.maxX,
          minZ: col.minZ,
          maxZ: col.maxZ
        });
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
          const box = cell[i];
          if (
            x > box.minX - padding &&
            x < box.maxX + padding &&
            z > box.minZ - padding &&
            z < box.maxZ + padding
          ) {
            return true;
          }
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
            const dLeft = Math.abs(curX - padMinX);
            const dRight = Math.abs(padMaxX - curX);
            const dBack = Math.abs(curZ - padMinZ);
            const dFront = Math.abs(curZ - padMaxZ);
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

    if (!this._collisionRes) {
      this._collisionRes = { x: 0, z: 0, collided: false };
    }
    this._collisionRes.x = curX;
    this._collisionRes.z = curZ;
    this._collisionRes.collided = collided;
    return this._collisionRes;
  },

  _isValidDryLandForPedestrian(x, z) {
    // Limites estendidos do supercontinente Pangeia (excluindo mar aberto e bocas subterrâneas do Metrô)
    if (x < -3380 || x > 3380 || z < -2900 || z > 2500) return false;
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
    heliGroup.position.set(0, 65, 120);
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
    h.orbitAngle += dt * 0.075;
    const cx = Math.cos(h.orbitAngle) * 340;
    const cz = 180 + Math.sin(h.orbitAngle) * 440;
    const nextX = Math.cos(h.orbitAngle + 0.02) * 340;
    const nextZ = 180 + Math.sin(h.orbitAngle + 0.02) * 440;

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

    const cartSpots = [
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
