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
import { LivingCityManager } from './LivingCityManager.js';

export { MAP_REGIONS, MAP_LANDMARKS, BUILDING_STYLES, BUILDING_STYLE_KEYS };

export class TestBlockWorld {
  constructor(scene, destructibleManager = null) {
    this.scene = scene;
    this.destructibles = destructibleManager;
    if (this.destructibles) {
      this.destructibles.world = this;
    }
    this.colliders = []; // AABBs: { minX, maxX, minZ, maxZ, minY, maxY, disabled }
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
  }

  addCollider(x, z, width, depth, height = 10, minY = 0) {
    const col = {
      minX: x - width * 0.5,
      maxX: x + width * 0.5,
      minZ: z - depth * 0.5,
      maxZ: z + depth * 0.5,
      minY,
      maxY: height,
      disabled: false
    };
    this.colliders.push(col);
    return col;
  }

  addBuildingBox(x, z, w, h, d, colorHex, opts = {}) {
    const yBase = opts.yBase ?? 0.28;
    const mesh = createLegoBrick(w, h, d, colorHex, {
      studs: opts.studs ?? false,
      studStep: opts.studStep ?? 3.5,
      roughness: opts.roughness ?? 0.24,
      metalness: opts.metalness ?? 0.08
    });
    mesh.position.set(x, yBase + h * 0.5, z);
    this.scene.add(mesh);

    if (opts.collide !== false) {
      this.addCollider(x, z, w, d, yBase + h, yBase);
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

  _addCityBlockSidewalk(x, z, w, d, colorHex = LEGO_COLORS.sidewalk) {
    if (!this._sidewalkGeosByColor.has(colorHex)) {
      this._sidewalkGeosByColor.set(colorHex, []);
    }
    this._sidewalkGeosByColor.get(colorHex).push(
      makeTranslatedBox(w, 0.28, d, x, 0.14, z)
    );

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
      mergedSlab.receiveShadow = true;
      this.scene.add(mergedSlab);
    }
    this._sidewalkGeosByColor.clear();
  }

  _addLegoTree(x, y, z, scale = 1.0) {
    this._treeInstances.push({ x, y, z, scale });
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
    this.beaconGroup.position.set(x, 0, z);
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
   * Retorna a elevação contínua do terreno em (x, z):
   * - Nas 9 Pontes em Arco e nos 3 Píeres Fluviais do Rio Urbano, segue a curva contínua getRoadElevation(x, z)!
   * - Na Favela Cidade de Deus, sobe suavemente de Y = 0 na rua até Y ≈ 43m no cume do morro!
   * - No restante da ilha, retorna 0.
   */
  getTerrainHeightAt(x, z) {
    const roadY = this.getRoadElevation(x, z);
    if (roadY !== 0) return roadY;
    return getFavelaElevation(x, z);
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
      if (Math.abs(x) <= 30 && z >= 1030 && z <= 1410) return false;
      if (Math.abs(x) <= 69 && z >= 1405 && z <= 1565) return false;
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

    if (playerPos && this.sunLight) {
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
