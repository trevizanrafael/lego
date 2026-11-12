import * as THREE from 'three';
import {
  LEGO_COLORS,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';
import { soundFX } from '../audio/SoundFX.js';
import { MAP_REGIONS, MAP_LANDMARKS } from './MapRegionsData.js';
import {
  BUILDING_STYLES,
  BUILDING_STYLE_KEYS,
  buildDetailedBuilding,
  mergeBufferGeometries,
  makeTranslatedBox
} from './BuildingGenerator.js';
import {
  RIVER_BRIDGE_SPECS,
  RIVER_PIER_SPECS,
  buildOceanAndMainIsland,
  buildUrbanRoadGridAndMedians
} from './RoadGridBuilder.js';
import {
  buildParkedLegoCars,
  createLegoCarMesh,
  buildStreetProps,
  buildNewsstandsAndFences,
  buildGoldenLegoObjects
} from './StreetPropsBuilder.js';
import { buildBoatsAndAircraftFleet } from './NavalAndAirFleetBuilder.js';
import { buildSuperBancoCentral } from './regions/SuperBankBuilder.js';
import {
  buildHeroTowerComplex,
  buildCentralParkAndLake,
  buildDowntownSkyscrapersAndTransitionBlocks,
  buildUrbanDowntownBlock
} from './regions/DowntownBuilder.js';
import { buildNorthSuburbAndGasStation } from './regions/NorthSuburbBuilder.js';
import { buildSouthBeachAndFerrisWheel } from './regions/SouthBeachBuilder.js';
import { buildEastCanalIndustrialAndPort } from './regions/EastPortBuilder.js';
import { buildWestHighwayAndAirport } from './regions/WestAirportBuilder.js';
import { buildFavelaCidadeDeDeus, getFavelaElevation } from './regions/FavelaCDDBuilder.js';
import { buildSoutheastPrisonIsland } from './regions/PrisonIslandBuilder.js';
import { buildSkyHelicarrier, buildLegoClouds } from './regions/HelicarrierBuilder.js';
import {
  buildViaductsAndNaturalRelief,
  getUrbanCityReliefY
} from './ViaductAndReliefBuilder.js';
import {
  buildMetroSystem,
  METRO_ISLAND_CUTOUTS,
  sliceRectAroundCutouts,
  getMetroCutoutFloorY
} from './MetroSystemBuilder.js';
import { LivingCityManager } from './LivingCityManager.js';
import { DayNightAtmosphereManager } from './DayNightAtmosphereManager.js';
import { InteractiveAttractionsManager } from './InteractiveAttractionsAndEmotes.js';

export { MAP_REGIONS, MAP_LANDMARKS, BUILDING_STYLES, BUILDING_STYLE_KEYS };

export class TestBlockWorld {
  constructor(scene, destructibleManager = null) {
    this.scene = scene;
    this.destructibles = destructibleManager;
    if (this.destructibles) {
      this.destructibles.world = this;
    }
    this.colliders = []; // AABBs: { minX, maxX, minZ, maxZ, minY, maxY, disabled }
    this._colliderGrid = new Map();
    this._dynamicColliders = [];
    this.colliderCellSize = 32;
    this._colliderQueryId = 0;
    this.elevatedDecks = [];     // Tabuleiros/rampas de viadutos e estações elevadas para getSurfaceHeightAt
    this.undergroundFloors = []; // Pisos e túneis subterrâneos do Metrô (Y = -6.8m / -7.35m)
    this.metroTotems = [];       // Totens interativos [E] nas 5 estações do Metrô
    this.metroStations = [];
    this.metroLoopWaypoints = [];
    this.metroSystem = null;
    this.clouds = [];
    this.rotatingElements = [];
    this.cargoShips = [];
    this._pendingPortVehicles = [];
    this.regions = MAP_REGIONS;
    this.landmarks = MAP_LANDMARKS;
    this.downtownBlockLayouts = [];

    // Acumuladores de batching para reduzir centenas de calçadas e árvores a poucos Draw Calls
    this._treeInstances = [];
    this._sidewalkGeosByColor = new Map();
    this._lastSunUpdatePos = new THREE.Vector3(99999, 99999, 99999);

    // Geometria 2D indexada para renderização precisa no Radar Local (Minimapa) e Mapa [M]
    this.mapRoads = [];     // { x, z, w, d, isMain }
    this.mapBlocks = [];    // { x, z, w, d, color }
    this.mapBuildings = []; // { x, z, w, d, color, label, styleKey, height }
    this.mapWater = [];     // { x, z, w, d }

    // Waypoint Personalizado (Pin Azul/Ciano + Feixe de Luz Vertical no mundo 3D)
    this.waypoint = null; // { x, z, label }
    this._initWaypointBeacon();

    this._setupSkyAndLights();
    buildOceanAndMainIsland(this);
    buildUrbanRoadGridAndMedians(this);

    // 1. CENTRO: Super Banco Central Monumental, Torre dos Heróis (220m), Parque Central e 5 Layouts de Quadra
    buildSuperBancoCentral(this);
    buildHeroTowerComplex(this);
    buildCentralParkAndLake(this);
    buildDowntownSkyscrapersAndTransitionBlocks(this);

    // 2. NORTE: Subúrbio de Casas + Praça + Pizzaria + Posto Explosivo
    buildNorthSuburbAndGasStation(this);

    // 3. SUL: Orla Hoteleira + Avenida Beira-Mar + Calçadão + Praia + Píer & Roda-Gigante
    buildSouthBeachAndFerrisWheel(this);

    // 4. LESTE: Canal Urbano + Pontes + Distrito Industrial/Becos + Porto & Contêineres
    buildEastCanalIndustrialAndPort(this);

    // 5. OESTE: Complexo da Cidade de Deus (Morro do CV em 5 Níveis) + Rodovia Expressa + Aeroporto Internacional & Base Militar
    buildFavelaCidadeDeDeus(this);
    buildWestHighwayAndAirport(this);

    // 6. SUDESTE: Ponte Blindada Longa + Ilha da Prisão de Segurança Máxima
    buildSoutheastPrisonIsland(this);

    // 7. CÉU (Y = 410m): Aeroporta-Aviões Monumental de Casco Espesso nas Nuvens
    buildSkyHelicarrier(this);

    // 7.5 VERTICALIDADE METROPOLITANA: Relevo Natural Escalonado + 3 Grandes Viadutos Expressos + Sistema Completo de Metrô LEGO
    buildViaductsAndNaturalRelief(this);
    buildMetroSystem(this);

    // 8. Objetos Quebráveis de Rua, Carros Dirigíveis, Embarcações, Aeronaves e Nuvens LEGO
    buildParkedLegoCars(this);
    buildBoatsAndAircraftFleet(this);
    if (this.destructibles && this._pendingPortVehicles?.length) {
      for (const pv of this._pendingPortVehicles) {
        this.destructibles.registerDestructible(pv);
      }
      this._pendingPortVehicles.length = 0;
    }
    buildStreetProps(this);
    buildNewsstandsAndFences(this);
    buildGoldenLegoObjects(this);
    buildLegoClouds(this);

    // 9. Finaliza os lotes instanciados/mesclados (Calçadas e Árvores da Cidade Inteira em 5 Draw Calls!)
    this._finalizeMergedSidewalks();
    this._finalizeInstancedTrees();

    // 10. Cidade Viva (PASSO 7): Trânsito em Movimento, Pedestres com Pânico, Patrulhas do BOPE e Guerra das 3 Facções (CV, PCC e A.R.E.S.)
    this.livingCity = new LivingCityManager(this, this.destructibles, this.destructibles?.hud);

    // 11. Ciclo Cinematográfico Dia / Pôr do Sol Dourado / Noite Neon + Iluminação Artificial 60 FPS!
    const savedTimeMode = this.destructibles?.hud?.settings?.timeMode || 'auto';
    this.atmosphere = new DayNightAtmosphereManager(this, savedTimeMode);

    // 12. Atrações Interativas Vivas: Baile Funk da CDD + Parque de Diversões Embarcável no Mega Píer!
    this.attractions = new InteractiveAttractionsManager(this);
  }

  addCollider(x, z, width, depth, height = 10, minY = 0, opts = {}) {
    const isDynamic = Boolean(opts.isDynamic);
    const col = {
      minX: x - width * 0.5,
      maxX: x + width * 0.5,
      minZ: z - depth * 0.5,
      maxZ: z + depth * 0.5,
      minY,
      maxY: height,
      disabled: false,
      isDynamic,
      _qid: 0,
      _gridKeys: null
    };
    this.colliders.push(col);

    if (isDynamic) {
      this._dynamicColliders.push(col);
    } else {
      const cs = this.colliderCellSize;
      const minCX = Math.floor(col.minX / cs);
      const maxCX = Math.floor(col.maxX / cs);
      const minCZ = Math.floor(col.minZ / cs);
      const maxCZ = Math.floor(col.maxZ / cs);
      const keys = [];
      for (let cx = minCX; cx <= maxCX; cx++) {
        for (let cz = minCZ; cz <= maxCZ; cz++) {
          const k = `${cx},${cz}`;
          keys.push(k);
          let bucket = this._colliderGrid.get(k);
          if (!bucket) {
            bucket = [];
            this._colliderGrid.set(k, bucket);
          }
          bucket.push(col);
        }
      }
      col._gridKeys = keys;
    }

    return col;
  }

  /**
   * Move um colisor de veículo/portão para a lista dinâmica rápida para que atualizações de minX..maxZ funcionem em tempo real!
   */
  promoteDynamicCollider(col) {
    if (!col || col.isDynamic) return;
    if (Array.isArray(col._gridKeys)) {
      for (let i = 0; i < col._gridKeys.length; i++) {
        const bucket = this._colliderGrid.get(col._gridKeys[i]);
        if (bucket) {
          const idx = bucket.indexOf(col);
          if (idx !== -1) bucket.splice(idx, 1);
        }
      }
      col._gridKeys = null;
    }
    col.isDynamic = true;
    this._dynamicColliders.push(col);
  }

  /**
   * Consulta espacial O(1) em células 32m x 32m (~25 colisores em vez de ~9.000 por frame!)
   */
  getCollidersNear(x, z, radius = 2.5) {
    const out = [];
    const qid = ++this._colliderQueryId;
    const cs = this.colliderCellSize;
    const minCX = Math.floor((x - radius) / cs);
    const maxCX = Math.floor((x + radius) / cs);
    const minCZ = Math.floor((z - radius) / cs);
    const maxCZ = Math.floor((z + radius) / cs);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const bucket = this._colliderGrid.get(`${cx},${cz}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const col = bucket[i];
          if (col.disabled || col._qid === qid) continue;
          col._qid = qid;
          out.push(col);
        }
      }
    }

    for (let i = 0; i < this._dynamicColliders.length; i++) {
      const col = this._dynamicColliders[i];
      if (col.disabled || col._qid === qid) continue;
      if (
        x + radius >= col.minX &&
        x - radius <= col.maxX &&
        z + radius >= col.minZ &&
        z - radius <= col.maxZ
      ) {
        col._qid = qid;
        out.push(col);
      }
    }

    return out;
  }

  /**
   * Consulta espacial ao longo de um segmento 2D (câmera em 3ª pessoa, gancho e mira)
   */
  getCollidersAlongRay2D(x0, z0, x1, z1, pad = 1.5) {
    const minX = Math.min(x0, x1) - pad;
    const maxX = Math.max(x0, x1) + pad;
    const minZ = Math.min(z0, z1) - pad;
    const maxZ = Math.max(z0, z1) + pad;
    const out = [];
    const qid = ++this._colliderQueryId;
    const cs = this.colliderCellSize;
    const minCX = Math.floor(minX / cs);
    const maxCX = Math.floor(maxX / cs);
    const minCZ = Math.floor(minZ / cs);
    const maxCZ = Math.floor(maxZ / cs);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const bucket = this._colliderGrid.get(`${cx},${cz}`);
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const col = bucket[i];
          if (col.disabled || col._qid === qid) continue;
          col._qid = qid;
          out.push(col);
        }
      }
    }

    for (let i = 0; i < this._dynamicColliders.length; i++) {
      const col = this._dynamicColliders[i];
      if (col.disabled || col._qid === qid) continue;
      if (col.maxX >= minX && col.minX <= maxX && col.maxZ >= minZ && col.minZ <= maxZ) {
        col._qid = qid;
        out.push(col);
      }
    }
    return out;
  }

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
  }

  createDetailedBuilding(x, z, w, h, d, styleKey = 'sapphire_glass', opts = {}) {
    return buildDetailedBuilding(this, x, z, w, h, d, styleKey, opts);
  }

  _buildUrbanDowntownBlock(bx, bz, W, D, layoutType, mainHeight, seed) {
    return buildUrbanDowntownBlock(this, bx, bz, W, D, layoutType, mainHeight, seed);
  }

  _createLegoCarMesh(cfg) {
    return createLegoCarMesh(cfg);
  }

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
          makeTranslatedBox(pw, 0.28, pd, (r.minX + r.maxX) * 0.5, yBase + 0.14, (r.minZ + r.maxZ) * 0.5)
        );
      }
    } else if (explicitYBase !== undefined) {
      // Saia profunda de concreto (8.2m em ladeiras, 0.28m sobre subsolo plano) — nunca flutua em ladeiras!
      const overUnder =
        (x >= -115 && x <= 115 && z >= -210 && z <= 85) ||
        (x >= -375 && x <= -260 && z >= -235 && z <= -125);
      const slabH = overUnder && explicitYBase <= 0.2 ? 0.28 : 8.2;
      geoBucket.push(makeTranslatedBox(w, slabH, d, x, explicitYBase + 0.28 - slabH * 0.5, z));
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
        geoBucket.push(makeTranslatedBox(w, slabH, d, x, yC + 0.28 - slabH * 0.5, z));
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
            makeTranslatedBox(stepX + 0.08, skirtH, 1.2, sx, yn - skirtH * 0.5, minZ + 0.6),
            makeTranslatedBox(stepX + 0.08, skirtH, 1.2, sx, ys - skirtH * 0.5, maxZ - 0.6)
          );
        }
        const stepZ = d / segZ;
        for (let iz = 0; iz < segZ; iz++) {
          const sz = minZ + (iz + 0.5) * stepZ;
          const yw = this.getTerrainHeightAt(minX, sz) + 0.28;
          const ye = this.getTerrainHeightAt(maxX, sz) + 0.28;
          geoBucket.push(
            makeTranslatedBox(1.2, skirtH, stepZ + 0.08, minX + 0.6, yw - skirtH * 0.5, sz),
            makeTranslatedBox(1.2, skirtH, stepZ + 0.08, maxX - 0.6, ye - skirtH * 0.5, sz)
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
  }

  _finalizeMergedSidewalks() {
    for (const [colorHex, geos] of this._sidewalkGeosByColor.entries()) {
      if (geos.length === 0) continue;
      const mergedSlab = new THREE.Mesh(
        mergeBufferGeometries(geos),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.45 })
      );
      for (let i = 0; i < geos.length; i++) geos[i].dispose();
      mergedSlab.receiveShadow = true;
      this.scene.add(mergedSlab);
    }
    this._sidewalkGeosByColor.clear();
  }

  _addLegoTree(x, y, z, scale = 1.0) {
    let finalY = y;
    if (y <= 0.42 && this.getTerrainHeightAt) {
      const tY = this.getTerrainHeightAt(x, z);
      if (tY > 0.08) finalY = tY + y;
    }
    this._treeInstances.push({ x, y: finalY, z, scale });
  }

  _finalizeInstancedTrees() {
    const count = this._treeInstances.length;
    if (count === 0) return;

    const trunkGeo = new THREE.CylinderGeometry(0.42, 0.52, 2.8, 8);
    trunkGeo.translate(0, 1.4, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: LEGO_COLORS.brown, roughness: 0.4 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunkInst.castShadow = false;
    trunkInst.receiveShadow = true;

    const canopyGeo = new THREE.BoxGeometry(3.4, 3.2, 3.4);
    canopyGeo.translate(0, 3.8, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: LEGO_COLORS.green, roughness: 0.35 });
    const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    canopyInst.castShadow = true;
    canopyInst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const t = this._treeInstances[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.scale.set(t.scale, t.scale, t.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);
      canopyInst.setMatrixAt(i, dummy.matrix);
    }
    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;

    this.scene.add(trunkInst, canopyInst);
  }

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
  }

  setWaypoint(x, z, label = 'DESTINO MARCADO') {
    this.waypoint = { x, z, label };
    const wy = Math.max(0, this.getTerrainHeightAt(x, z));
    this.beaconGroup.position.set(x, wy, z);
    this.beaconGroup.visible = true;
    soundFX.playStudCollect(100);
  }

  clearWaypoint() {
    this.waypoint = null;
    this.beaconGroup.visible = false;
  }

  /**
   * Retorna a cota Y da superfície da água em (x, z):
   * - Grande Lago do Parque Central: Y = 0.42
   * - Rio / Canal Urbano Leste (X = 539..581, Z = -1325..+1075): Y = -3.50 (com transição suave nas fozes oceânicas)
   * - Canais de Santos e Oceano Atlântico: Y = -0.15
   */
  getWaterSurfaceY(x, z) {
    if (x >= 70 && x <= 340 && z >= 187 && z <= 349) {
      return 0.42;
    }
    if (x >= 539 && x <= 581 && z >= -1325 && z <= 1075) {
      if (z > 1050) {
        const t = Math.min(1, (z - 1050) / 25);
        return -3.5 + t * 3.35;
      }
      if (z < -1305) {
        const t = Math.min(1, (-1305 - z) / 20);
        return -3.5 + t * 3.35;
      }
      return -3.5;
    }
    return -0.15;
  }

  /**
   * Retorna a elevação contínua das Pontes em Arco (bridgeY = 5.0 * sin(t * PI)) e dos Píeres Fluviais de Madeira:
   * - Permite que veículos a 290+ km/h e pedestres subam e desçam as 9 Pontes em Arco suavemente sem bater em colisores!
   */
  getRoadElevation(x, z) {
    if (x >= 526 && x <= 594) {
      for (const b of RIVER_BRIDGE_SPECS) {
        if (Math.abs(z - b.z) <= b.width * 0.5) {
          const t = Math.max(0, Math.min(1, (x - b.xStart) / (b.xEnd - b.xStart)));
          return b.archHeight * Math.sin(t * Math.PI);
        }
      }
    }
    if (x >= 530 && x <= 590) {
      for (const p of RIVER_PIER_SPECS) {
        if (Math.abs(z - p.z) <= p.lengthZ * 0.5) {
          if (x >= p.deckXMin && x <= p.deckXMax) {
            return p.deckY;
          }
          if (x >= p.rampXMin && x <= p.rampXMax) {
            const t = (x - p.rampXMin) / (p.rampXMax - p.rampXMin);
            return p.bank === 'west'
              ? 0.2 * (1 - t) + p.deckY * t
              : p.deckY * (1 - t) + 0.2 * t;
          }
        }
      }
    }
    return 0;
  }

  /**
   * Retorna a elevação contínua do solo base em (x, z):
   * - Recortes de escadarias subterrâneas e trincheiras portais do Metrô (até Y = -6.8m / -7.35m)
   * - 9 Pontes em Arco e 3 Píeres Fluviais do Rio Urbano (`getRoadElevation`)
   * - Platô Panorâmico & Ladeiras do Subúrbio Norte (`0m -> +11.5m`), Colinas do Parque Central (`0m -> +10.5m`),
   *   Dunas & Costão Sudoeste da Praia (`+2.5m -> +8.5m`) e Morro da Cidade de Deus (`0m -> +43m`, com passagem em Z = 0).
   */
  getTerrainHeightAt(x, z) {
    const metroCutY = getMetroCutoutFloorY(x, z);
    if (metroCutY !== null) return metroCutY;

    const roadY = this.getRoadElevation(x, z);
    if (roadY !== 0) return roadY;

    return Math.max(
      getFavelaElevation(x, z),
      getUrbanCityReliefY(x, z)
    );
  }

  /**
   * Suporte físico real a múltiplos níveis empilhados (`elevatedDecks` + `undergroundFloors`) — ZERO bug de teleporte:
   * - Viadutos, Rampas e Estações Elevadas (`deckY` entre `0m` e `+12.75m`): retorna `deckY` SOMENTE se `currentY >= deckY - thresholdBelow`,
   *   permitindo dirigir e caminhar livremente POR BAIXO dos 3 viadutos (`0m`)!
   * - Subsolo do Metrô (`floorY = -6.8m` / `-7.35m`): se o jogador desceu as escadas (`currentY < -0.6`), retorna a plataforma/túnel
   *   subterrâneo, enquanto quem está na rua acima (`currentY >= -0.4`) continua normalmente sobre o asfalto (`0m`)!
   */
  getSurfaceHeightAt(x, z, currentY = 0) {
    // 1. Subsolo do Metrô (quando já desceu abaixo da rua: currentY < -0.6)
    if (currentY < -0.6) {
      const cutY = getMetroCutoutFloorY(x, z);
      if (cutY !== null) return cutY;

      if (this.undergroundFloors && this.undergroundFloors.length > 0) {
        let bestUnderY = -Infinity;
        for (let i = 0; i < this.undergroundFloors.length; i++) {
          const uf = this.undergroundFloors[i];
          if (x >= uf.minX && x <= uf.maxX && z >= uf.minZ && z <= uf.maxZ) {
            const ceilY = uf.ceilingY ?? -1.0;
            if (currentY <= ceilY + 0.5 && uf.floorY > bestUnderY) {
              bestUnderY = uf.floorY;
            }
          }
        }
        if (bestUnderY > -Infinity) {
          return bestUnderY;
        }
      }
    }

    // 2. Tabuleiros e Rampas Elevadas (Viadutos 1, 2, 3 + Plataformas/Escadas Elevadas do Metrô)
    if (this.elevatedDecks && this.elevatedDecks.length > 0) {
      let bestDeckY = -Infinity;
      for (let i = 0; i < this.elevatedDecks.length; i++) {
        const d = this.elevatedDecks[i];
        if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) {
          const deckY = d.getDeckY(x, z);
          if (deckY !== null && currentY >= deckY - (d.thresholdBelow ?? 2.4)) {
            if (deckY > bestDeckY) bestDeckY = deckY;
          }
        }
      }
      if (bestDeckY > -Infinity) {
        return bestDeckY;
      }
    }

    // 3. Solo base contínuo (ruas térreas sob viadutos, colinas, platô norte, dunas, pontes e escadarias abertas)
    return this.getTerrainHeightAt(x, z);
  }

  /**
   * Verifica se a coordenada (x, z) é ÁGUA PROFUNDA (Lago do Parque, Rio Urbano, Canais ou Oceano Atlântico):
   * - opts.forBoat = true: permite que barcos/lanchas/jet-skis passem livremente por baixo de TODAS as 9 Pontes em Arco!
   * - opts.forCar / padrão: considera as 9 Pontes em Arco, os 3 Píeres Fluviais e os decks da marina como piso seco!
   */
  isDeepWaterAt(x, z, opts = {}) {
    const forBoat = Boolean(opts.forBoat);

    // 1. GRANDE LAGO DO PARQUE CENTRAL (X: 73..337, Z: 190..346)
    if (x >= 73 && x <= 337 && z >= 190 && z <= 346) {
      if (!forBoat && x <= 107 && z >= 259 && z <= 277) return false;
      if (x >= 196.5 && x <= 213.5) {
        if (!forBoat) return false;
        if (Math.abs(z - 268) >= 20 && Math.abs(z - 268) <= 24) return false;
      }
      return true;
    }

    // 2. OS 3 CANAIS ESTILO SANTOS NA ORLA SUL (X = -384, -120, +252, largura 22m, Z: 726..1055)
    for (const cx of [-384, -120, 252]) {
      if (Math.abs(x - cx) < 9.5 && z >= 726 && z <= 1055) {
        if (!forBoat) {
          if ((z >= 725 && z <= 778) || (z >= 902 && z <= 918)) return false;
        }
        return true;
      }
    }

    // 3. RIO / CANAL URBANO LESTE NAVEGÁVEL DE PONTA A PONTA (X: 540..580, Z: -1325..+1075 — Mar Norte ao Mar Sul!)
    if (x >= 540 && x <= 580 && z >= -1325 && z <= 1075) {
      if (!forBoat) {
        for (const b of RIVER_BRIDGE_SPECS) {
          if (Math.abs(z - b.z) <= b.width * 0.5) return false;
        }
        for (const p of RIVER_PIER_SPECS) {
          const minPX = Math.min(p.deckXMin, p.rampXMin);
          const maxPX = Math.max(p.deckXMax, p.rampXMax);
          if (Math.abs(z - p.z) <= p.lengthZ * 0.5 && x >= minPX && x <= maxPX) {
            return false;
          }
        }
      }
      return true;
    }

    // 4. TERRA FIRME (Ilha Principal X <= 540, Praia Sul + Ponta Sudoeste, Aeroporto + Ala Militar Norte, PCC + Porto Leste X >= 580, Ilha da Prisão e Píeres/Marinas)
    if (x >= -1825 && x <= 540 && z >= -1320 && z <= 1045) return false;
    if (x >= 580 && x <= 1628 && z >= -1320 && z <= 736) return false;
    // 2 Grandes Navios Porta-Contêineres no Cais Leste + 1 Navio Blindado A.R.E.S. na Doca Sul (Rampas + Convés Dinâmico Pilotável!)
    if (!forBoat && x >= 1618 && x <= 1650 && z >= 120 && z <= 695) return false;
    if (!forBoat && x >= 995 && x <= 1255 && z >= 734 && z <= 752) return false;
    if (!forBoat && this.cargoShips) {
      for (const ship of this.cargoShips) {
        const sx = ship.mesh.position.x;
        const sz = ship.mesh.position.z;
        const yaw = ship.mesh.rotation.y;
        const dx = x - sx;
        const dz = z - sz;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const localX = dx * cosY - dz * sinY;
        const localZ = dx * sinY + dz * cosY;
        if (Math.abs(localX) <= ship.halfW && Math.abs(localZ) <= ship.halfL) {
          return false;
        }
      }
    }
    // Ilha-Fortaleza da Prisão de Segurança Máxima (2x Maior: X = 955..1795, Z = 1120..1980) + Píer Naval da Guarda Costeira (X = 860..995)
    if (x >= 955 && x <= 1795 && z >= 1118 && z <= 1980) return false;
    if (!forBoat && x >= 860 && x <= 995 && z >= 1505 && z <= 1595) return false;

    // Grande Ponte Blindada Retilínea (X = 1351..1399, Z = 735..1125) ligando o Porto direto à Ilha da Prisão!
    if (!forBoat && x >= 1351 && x <= 1399 && z >= 735 && z <= 1126) return false;

    if (!forBoat) {
      if (Math.abs(x) <= 48 && z >= 1020 && z <= 1422) return false;
      if (Math.abs(x) <= 69 && z >= 1405 && z <= 1572) return false;
      if (x >= 43 && x <= 108 && z >= 1076 && z <= 1094) return false;
      if (x >= 95 && x <= 109 && z >= 1062 && z <= 1228) return false;
      for (const dz of [1095, 1135, 1175, 1215]) {
        if (x >= 105 && x <= 151 && Math.abs(z - dz) <= 3.5) return false;
      }
      // Marina Oeste na Ponta da Praia / Costão Sudoeste (X = -1388..-1332, Z = 1040..1230)
      if (x >= -1388 && x <= -1372 && z >= 1040 && z <= 1230) return false;
      for (const dz of [1095, 1135, 1175, 1215]) {
        if (x >= -1376 && x <= -1328 && Math.abs(z - dz) <= 3.5) return false;
      }
    }

    return true;
  }

  getRegionAt(x, y, z) {
    const skyRegion = this.regions[9];
    if (
      y >= skyRegion.bounds.minY &&
      x >= skyRegion.bounds.minX &&
      x <= skyRegion.bounds.maxX &&
      z >= skyRegion.bounds.minZ &&
      z <= skyRegion.bounds.maxZ
    ) {
      return skyRegion;
    }

    if (y < -2.2) {
      if (x >= -360 && x <= -280 && z >= -202 && z <= -135) {
        return {
          ...this.regions[1],
          id: 'porao_torre_herois',
          num: 'LAB',
          name: 'PORÃO DA TORRE — LABORATÓRIO OP-09',
          shortName: 'PORÃO DOS HERÓIS (OP-09)',
          sub: 'Laboratório Bio-Genético Subterrâneo • Criação de Personagem [E]',
          color: '#00f0ff',
          icon: 'tower'
        };
      }
      return {
        ...this.regions[0],
        id: 'metro_subterraneo',
        num: 'M1',
        name: 'METRÔ METROPOLITANO (SUBSOLO)',
        shortName: 'METRÔ SUBSOLO',
        sub: 'Linha 01 Circular • Estações Subterrâneas & Túnel Iluminado',
        color: '#06b6d4',
        icon: 'metro'
      };
    }

    if (y < 24.0 && x >= 14 && x <= 106 && z >= -496 && z <= -400) {
      return {
        ...this.regions[0],
        id: 'lego_customs',
        num: 'CUS',
        name: 'LEGO CUSTOMS — OFICINA DE TUNING',
        shortName: 'LEGO CUSTOMS',
        sub: 'Tuning 0–10 • Pintura • Decals • Monster Truck & Rampa Cunha [E]',
        color: '#facc15',
        icon: 'customs'
      };
    }

    if (y < 38.0 && x >= -54 && x <= 54 && z >= -228 && z <= -130) {
      return {
        ...this.regions[0],
        id: 'super_banco_interior',
        name: 'SUPER BANCO (INTERIOR)',
        shortName: 'SUPER BANCO (INTERIOR)',
        sub: 'Saguão Monumental de Mármore & Sala Forte do Cofre'
      };
    }

    // Detecção do Complexo da Cidade de Deus (Morro contínuo do CV entre a Cidade e o Aeroporto, estendido até a borda Norte Z = -1320!)
    if (
      x >= -1012 &&
      x <= -528 &&
      z >= -1320 &&
      z <= 580 &&
      (x <= -658 || (z >= -508 && z <= 415))
    ) {
      return {
        id: 'favela_cdd_cv',
        number: 8,
        num: 'CDD',
        name: 'COMPLEXO DA CIDADE DE DEUS — DOMÍNIO DO CV',
        shortName: 'CIDADE DE DEUS (CV)',
        sub: 'Morro Contínuo, Vielas, Campinho, Baile do CV & Fortaleza do Barão Vermelho',
        bounds: { minX: -1012, maxX: -530, minZ: -1320, maxZ: 580, minY: 0, maxY: 140 },
        spawn: { x: -702, y: 26.2, z: -135 },
        color: '#dc2626',
        icon: 'cdd'
      };
    }

    const priorityOrder = [1, 2, 8, 3, 4, 5, 6, 7, 0];
    for (const idx of priorityOrder) {
      const reg = this.regions[idx];
      const b = reg.bounds;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return reg;
      }
    }

    return this.regions[0];
  }

  _setupSkyAndLights() {
    this.scene.background = new THREE.Color(0x68b5f8);
    this.scene.fog = new THREE.FogExp2(0x7ec2fc, 0.00028);

    const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 0.94);
    hemiLight.position.set(0, 480, 0);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.25);
    sunLight.position.set(140, 260, 120);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 15;
    sunLight.shadow.camera.far = 520;

    const d = 140;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.normalBias = 0.06;
    sunLight.shadow.bias = -0.0008;

    this.scene.add(sunLight);
    this.scene.add(sunLight.target);
    this.sunLight = sunLight;
  }

  update(dt, playerPos = null, controller = null) {
    if (this.metroSystem) {
      this.metroSystem.update(dt, playerPos);
      // Herói sentado no vagão acompanha o trem no mesmo quadro (sem atraso de 1 frame).
      if (controller?.activeRide?.type === 'metro') {
        controller._applyRideSeatAndCamera?.(0);
      }
    }
    if (this.customsRuntime) {
      this.customsRuntime.update(dt);
    }
    if (this.attractions) {
      this.attractions.update(dt, playerPos, controller);
    }
    if (this.livingCity) {
      this.livingCity.update(dt, playerPos, controller);
    }

    for (const c of this.clouds) {
      c.position.x += dt * 1.8;
      if (c.position.x > 1600) c.position.x = -1600;
    }

    for (const rot of this.rotatingElements) {
      rot.mesh.rotation[rot.axis] += rot.speed * dt;
    }

    if (this.atmosphere) {
      this.atmosphere.update(dt, playerPos, controller);
    } else if (playerPos && this.sunLight) {
      if (playerPos.distanceToSquared(this._lastSunUpdatePos) > 9.0) {
        this._lastSunUpdatePos.copy(playerPos);
        this.sunLight.position.set(playerPos.x + 120, playerPos.y + 200, playerPos.z + 100);
        this.sunLight.target.position.copy(playerPos);
        this.sunLight.target.updateMatrixWorld();
      }
    }

    if (this.waypoint && this.beaconGroup.visible) {
      const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.22;
      this.beaconRing.scale.set(pulse, pulse, 1);

      if (playerPos) {
        const dist = Math.hypot(playerPos.x - this.waypoint.x, playerPos.z - this.waypoint.z);
        if (dist < 14.0) {
          this.clearWaypoint();
          soundFX.playHeroSwap();
        }
      }
    }
  }
}
