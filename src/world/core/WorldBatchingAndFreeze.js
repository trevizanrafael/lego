/**
 * WorldBatchingAndFreeze.js
 * Batching espacial de calçadas e árvores instanciadas, construtores auxiliares de quadras/prédios,
 * feixe 3D de waypoint, setup inicial noturno de céu/luzes e congelamento de matrizes estáticas.
 */

import * as THREE from 'three';
import { LEGO_COLORS, createLegoBrick } from '../../materials/LegoMaterials.js';
import { soundFX } from '../../audio/SoundFX.js';
import {
  buildDetailedBuilding,
  makeFastBox,
  flushSpatialChunkedBuckets
} from '../BuildingGenerator.js';
import { createLegoCarMesh } from '../StreetPropsBuilder.js';
import { buildUrbanDowntownBlock } from '../regions/DowntownBuilder.js';
import { METRO_ISLAND_CUTOUTS, sliceRectAroundCutouts } from '../MetroSystemBuilder.js';

export const worldBatchingAndFreezeMethods = {
  _freezeStaticSceneGraph(staticPhaseChildren) {
    if (!this.scene) return;
    this.scene.updateMatrixWorld(true);
    this.scene.matrixAutoUpdate = false;

    const dynamicRoots = new Set();
    const addDyn = (obj) => {
      if (obj && obj.isObject3D) dynamicRoots.add(obj);
    };

    addDyn(this.beaconGroup);
    addDyn(this.hemiLight);
    addDyn(this.sunLight);
    addDyn(this.sunLight?.target);
    addDyn(this.ferrisWheelGroup);
    if (Array.isArray(this.ferrisWheelCabins)) {
      for (const cab of this.ferrisWheelCabins) addDyn(cab);
    }
    if (Array.isArray(this.clouds)) {
      for (const c of this.clouds) addDyn(c);
    }
    if (Array.isArray(this.rotatingElements)) {
      for (const rot of this.rotatingElements) addDyn(rot?.mesh);
    }
    if (Array.isArray(this.cargoShips)) {
      for (const ship of this.cargoShips) addDyn(ship?.mesh || ship);
    }
    if (Array.isArray(this.superBankData?.gates)) {
      for (const g of this.superBankData.gates) addDyn(g?.mesh || g);
    }
    if (Array.isArray(this.metroSystem?.trains)) {
      for (const tr of this.metroSystem.trains) {
        if (Array.isArray(tr.cars)) {
          for (const car of tr.cars) addDyn(car?.group);
        }
      }
    }
    if (this.destructibles) {
      if (Array.isArray(this.destructibles._dynamicObjects)) {
        for (const obj of this.destructibles._dynamicObjects) addDyn(obj?.mesh);
      }
      if (Array.isArray(this.destructibles.ambientStuds)) {
        for (const s of this.destructibles.ambientStuds) addDyn(s?.mesh);
      }
      addDyn(this.destructibles.solarBeamGroup);
      addDyn(this.destructibles.solarMuzzleGroup);
      addDyn(this.destructibles.beamHitSphere);
      addDyn(this.destructibles.supernovaChargeGroup);
    }
    if (this.atmosphere) {
      addDyn(this.atmosphere.celestialRoot);
      if (Array.isArray(this.atmosphere.pointLightPool)) {
        for (const pl of this.atmosphere.pointLightPool) addDyn(pl);
      }
      if (Array.isArray(this.atmosphere.lighthouseBeams)) {
        for (const lb of this.atmosphere.lighthouseBeams) addDyn(lb?.pivot);
      }
      if (Array.isArray(this.atmosphere.metroLeadCones)) {
        for (const mc of this.atmosphere.metroLeadCones) addDyn(mc);
      }
    }
    if (Array.isArray(this.favelaBaileSkytrackers)) {
      for (const st of this.favelaBaileSkytrackers) addDyn(st?.pivot);
    }
    if (this.attractions) {
      if (Array.isArray(this.attractions.baileWoofers)) {
        for (const w of this.attractions.baileWoofers) addDyn(w?.pivot);
      }
      if (Array.isArray(this.attractions.baileEqBars)) {
        for (const b of this.attractions.baileEqBars) addDyn(b);
      }
      addDyn(this.attractions.djRig?.root);
      if (this.attractions.baileCrowd?.allInstMeshes) {
        for (const im of this.attractions.baileCrowd.allInstMeshes) addDyn(im);
      }
      if (Array.isArray(this.attractions.baileLaserPivots)) {
        for (const ls of this.attractions.baileLaserPivots) addDyn(ls?.pivot);
      }
      if (Array.isArray(this.attractions.coasterCars)) {
        for (const c of this.attractions.coasterCars) addDyn(c);
      }
      addDyn(this.attractions.bigDropGondola);
    }

    const dynamicSubtreeSet = new Set();
    const ancestorSet = new Set();
    for (const dyn of dynamicRoots) {
      dyn.traverse((child) => {
        dynamicSubtreeSet.add(child);
        if (child.userData) child.userData._keepDynamicMatrix = true;
      });
      let p = dyn.parent;
      while (p && p !== this.scene) {
        ancestorSet.add(p);
        p = p.parent;
      }
    }

    const freezeBranch = (node) => {
      if (dynamicSubtreeSet.has(node)) return;
      if (ancestorSet.has(node)) {
        node.matrixAutoUpdate = false;
        node.matrixWorldAutoUpdate = true;
        for (let i = 0; i < node.children.length; i++) {
          freezeBranch(node.children[i]);
        }
        return;
      }
      node.traverse((n) => {
        n.matrixAutoUpdate = false;
        n.matrixWorldAutoUpdate = false;
      });
    };

    for (const rootChild of staticPhaseChildren) {
      if (rootChild && rootChild.parent === this.scene) {
        freezeBranch(rootChild);
      }
    }
  },

  addBuildingBox(x, z, w, h, d, colorHex, opts = {}) {
    const terrainY = this.getTerrainHeightAt ? this.getTerrainHeightAt(x, z) : 0;
    const yBase = opts.yBase ?? (terrainY + 0.28);
    const overUnderground =
      (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
      (x >= -375 && x <= -260 && z >= -235 && z <= -125);
    const skirtDepth = overUnderground && terrainY < 0.2 ? 0.28 : 8.5;
    const addSkirt = opts.yBase === undefined && opts.foundation !== false && skirtDepth > 0.5;
    const totalH = addSkirt ? h + skirtDepth : h;
    const centerY = addSkirt ? yBase + h * 0.5 - skirtDepth * 0.5 : yBase + h * 0.5;
    const mesh = createLegoBrick(w, totalH, d, colorHex, {
      studs: opts.studs ?? false,
      studStep: opts.studStep ?? 3.5,
      roughness: opts.roughness ?? 0.24,
      metalness: opts.metalness ?? 0.08
    });
    mesh.position.set(x, centerY, z);
    this.scene.add(mesh);

    if (opts.collide !== false) {
      this.addCollider(x, z, w, d, yBase + h, addSkirt ? Math.max(0, yBase - skirtDepth) : yBase);
    }

    if (opts.registerMap !== false) {
      this.mapBuildings.push({
        x,
        z,
        w,
        d,
        height: h,
        color: opts.mapColor || `#${new THREE.Color(colorHex).getHexString()}`,
        label: opts.label || null
      });
    }

    return mesh;
  },

  createDetailedBuilding(x, z, w, h, d, styleKey = 'sapphire_glass', opts = {}) {
    return buildDetailedBuilding(this, x, z, w, h, d, styleKey, opts);
  },

  _buildUrbanDowntownBlock(bx, bz, W, D, layoutType, mainHeight, seed) {
    return buildUrbanDowntownBlock(this, bx, bz, W, D, layoutType, mainHeight, seed);
  },

  _createLegoCarMesh(cfg) {
    return createLegoCarMesh(cfg);
  },

  _addCityBlockSidewalk(x, z, w, d, colorHex = LEGO_COLORS.sidewalk, explicitYBase = undefined) {
    if (!this._sidewalkGeosByColor.has(colorHex)) {
      this._sidewalkGeosByColor.set(colorHex, []);
    }
    const geoBucket = this._sidewalkGeosByColor.get(colorHex);

    const minX = x - w * 0.5;
    const maxX = x + w * 0.5;
    const minZ = z - d * 0.5;
    const maxZ = z + d * 0.5;
    // Registro das calçadas (o resto da ilha é base de asfalto): usado para pilares/escadas do metrô
    if (!this.mapSidewalks) this.mapSidewalks = [];
    this.mapSidewalks.push({ minX, maxX, minZ, maxZ });

    const hitsCutout = METRO_ISLAND_CUTOUTS.some(
      (c) => c.maxX > minX && c.minX < maxX && c.maxZ > minZ && c.minZ < maxZ
    );

    if (hitsCutout) {
      const yBase = explicitYBase ?? 0;
      const pieces = sliceRectAroundCutouts({ minX, maxX, minZ, maxZ }, METRO_ISLAND_CUTOUTS);
      for (const r of pieces) {
        const pw = r.maxX - r.minX;
        const pd = r.maxZ - r.minZ;
        if (pw <= 0.02 || pd <= 0.02) continue;
        geoBucket.push(
          makeFastBox(pw, 0.28, pd, (r.minX + r.maxX) * 0.5, yBase + 0.14, (r.minZ + r.maxZ) * 0.5)
        );
      }
    } else if (explicitYBase !== undefined) {
      // Saia profunda de concreto (8.2m em ladeiras, 0.28m sobre subsolo plano) — nunca flutua em ladeiras!
      const overUnder =
        (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
        (x >= -375 && x <= -260 && z >= -235 && z <= -125);
      const slabH = overUnder && explicitYBase <= 0.2 ? 0.28 : 8.2;
      geoBucket.push(makeFastBox(w, slabH, d, x, explicitYBase + 0.28 - slabH * 0.5, z));
    } else {
      const yC = this.getTerrainHeightAt(x, z);
      const yNW = this.getTerrainHeightAt(minX, minZ);
      const yNE = this.getTerrainHeightAt(maxX, minZ);
      const ySW = this.getTerrainHeightAt(minX, maxZ);
      const ySE = this.getTerrainHeightAt(maxX, maxZ);
      const minCorner = Math.min(yC, yNW, yNE, ySW, ySE);
      const maxCorner = Math.max(yC, yNW, yNE, ySW, ySE);
      const overUnder =
        (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
        (x >= -375 && x <= -260 && z >= -235 && z <= -125);

      if (maxCorner - minCorner <= 0.16) {
        const slabH = overUnder && yC <= 0.2 ? 0.28 : 4.2;
        geoBucket.push(makeFastBox(w, slabH, d, x, yC + 0.28 - slabH * 0.5, z));
      } else {
        // Calçada orgânica subdividida acompanhando a ladeira + saia perimetral de 8.5m de profundidade!
        const segX = Math.max(3, Math.min(10, Math.round(w / 14)));
        const segZ = Math.max(3, Math.min(10, Math.round(d / 14)));
        const topGeo = new THREE.PlaneGeometry(w, d, segX, segZ);
        topGeo.rotateX(-Math.PI / 2);
        topGeo.translate(x, 0, z);
        const pos = topGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);
          pos.setY(i, this.getTerrainHeightAt(vx, vz) + 0.28);
        }
        topGeo.computeVertexNormals();
        geoBucket.push(topGeo);

        // 4 saias perimetrais de alicerce (8.5m para baixo) acompanhando cada borda do quarteirão!
        const skirtH = 8.5;
        const stepX = w / segX;
        for (let ix = 0; ix < segX; ix++) {
          const sx = minX + (ix + 0.5) * stepX;
          const yn = this.getTerrainHeightAt(sx, minZ) + 0.28;
          const ys = this.getTerrainHeightAt(sx, maxZ) + 0.28;
          geoBucket.push(
            makeFastBox(stepX + 0.08, skirtH, 1.2, sx, yn - skirtH * 0.5, minZ + 0.6),
            makeFastBox(stepX + 0.08, skirtH, 1.2, sx, ys - skirtH * 0.5, maxZ - 0.6)
          );
        }
        const stepZ = d / segZ;
        for (let iz = 0; iz < segZ; iz++) {
          const sz = minZ + (iz + 0.5) * stepZ;
          const yw = this.getTerrainHeightAt(minX, sz) + 0.28;
          const ye = this.getTerrainHeightAt(maxX, sz) + 0.28;
          geoBucket.push(
            makeFastBox(1.2, skirtH, stepZ + 0.08, minX + 0.6, yw - skirtH * 0.5, sz),
            makeFastBox(1.2, skirtH, stepZ + 0.08, maxX - 0.6, ye - skirtH * 0.5, sz)
          );
        }
      }
    }

    this.mapBlocks.push({
      x,
      z,
      w,
      d,
      color: `#${new THREE.Color(colorHex).getHexString()}`
    });
  },

  _finalizeMergedSidewalks() {
    if (this._sidewalkGeosByColor.size === 0) return;
    const mats = new Map();
    for (const colorHex of this._sidewalkGeosByColor.keys()) {
      mats.set(colorHex, new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 }));
    }
    flushSpatialChunkedBuckets(this.scene, this._sidewalkGeosByColor, mats, {
      chunkSize: 512,
      castShadowFn: () => false,
      receiveShadowFn: () => true
    });
    this._sidewalkGeosByColor.clear();
  },

  _addLegoTree(x, y, z, scale = 1.0) {
    let finalY = y;
    if (y <= 0.42 && this.getTerrainHeightAt) {
      const tY = this.getTerrainHeightAt(x, z);
      if (tY > 0.08) finalY = tY + y;
    }
    this._treeInstances.push({ x, y: finalY, z, scale });
  },

  _finalizeInstancedTrees() {
    const count = this._treeInstances.length;
    if (count === 0) return;

    const trunkGeo = new THREE.CylinderGeometry(0.42, 0.52, 2.8, 8);
    trunkGeo.translate(0, 1.4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: LEGO_COLORS.brown, roughness: 0.4 });
    const canopyGeo = new THREE.BoxGeometry(3.4, 3.2, 3.4);
    canopyGeo.translate(0, 3.8, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: LEGO_COLORS.green, roughness: 0.35 });

    // Agrupa árvores por chunks de 256m x 256m para Frustum & Shadow Culling nativo
    const chunks = new Map();
    for (let i = 0; i < count; i++) {
      const t = this._treeInstances[i];
      const key = `${Math.floor(t.x / 256)},${Math.floor(t.z / 256)}`;
      let bucket = chunks.get(key);
      if (!bucket) {
        bucket = [];
        chunks.set(key, bucket);
      }
      bucket.push(t);
    }

    const dummy = new THREE.Object3D();
    for (const bucket of chunks.values()) {
      const n = bucket.length;
      const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
      trunkInst.castShadow = false;
      trunkInst.receiveShadow = true;
      trunkInst.matrixAutoUpdate = false;

      const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, n);
      canopyInst.castShadow = true;
      canopyInst.receiveShadow = true;
      canopyInst.matrixAutoUpdate = false;

      for (let i = 0; i < n; i++) {
        const t = bucket[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);
        canopyInst.setMatrixAt(i, dummy.matrix);
      }
      trunkInst.instanceMatrix.needsUpdate = true;
      canopyInst.instanceMatrix.needsUpdate = true;
      trunkInst.updateMatrix();
      canopyInst.updateMatrix();

      this.scene.add(trunkInst, canopyInst);
    }
  },

  _initWaypointBeacon() {
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.visible = false;

    const beamGeo = new THREE.CylinderGeometry(1.3, 1.3, 240, 16, 1, true);
    beamGeo.translate(0, 120, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.beaconBeam = new THREE.Mesh(beamGeo, beamMat);

    const coreGeo = new THREE.CylinderGeometry(0.45, 0.45, 240, 12, 1, true);
    coreGeo.translate(0, 120, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.beaconCore = new THREE.Mesh(coreGeo, coreMat);

    const ringGeo = new THREE.RingGeometry(2.2, 3.4, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide
    });
    this.beaconRing = new THREE.Mesh(ringGeo, ringMat);
    this.beaconRing.position.y = 0.45;

    this.beaconGroup.add(this.beaconBeam, this.beaconCore, this.beaconRing);
    this.scene.add(this.beaconGroup);
  },

  setWaypoint(x, z, label = 'DESTINO MARCADO') {
    this.waypoint = { x, z, label };
    const wy = Math.max(0, this.getTerrainHeightAt(x, z));
    this.beaconGroup.position.set(x, wy, z);
    this.beaconGroup.visible = true;
    soundFX.playStudCollect(100);
  },

  clearWaypoint() {
    this.waypoint = null;
    this.beaconGroup.visible = false;
  },

  _setupSkyAndLights() {
    this.scene.background = new THREE.Color(0x0a101a);
    this.scene.fog = new THREE.FogExp2(0x0a101a, 0.00042);

    const hemiLight = new THREE.HemisphereLight(0x1f2d42, 0x05070c, 0.24);
    hemiLight.position.set(0, 480, 0);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const sunLight = new THREE.DirectionalLight(0x6488a8, 0.48);
    sunLight.position.set(140, 260, 120);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 920;

    const d = 95;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.normalBias = 0.048;
    sunLight.shadow.bias = -0.0005;

    if (!this.waterShaderUniforms) {
      this.waterShaderUniforms = { uTime: { value: 0 } };
    }

    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.sunLight = sunLight;
  }
};
