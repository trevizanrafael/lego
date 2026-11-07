import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';

export class TestBlockWorld {
  constructor(scene, destructibleManager = null) {
    this.scene = scene;
    this.destructibles = destructibleManager;
    this.colliders = []; // Lista de AABBs: { minX, maxX, minZ, maxZ, maxY, disabled }
    this.clouds = [];

    this._setupSkyAndLights();
    this._buildAsphaltAndRoadMarkings();
    this._buildSidewalksWithStuds();
    this._buildSurroundingBuildings();
    this._buildParkedLegoCars();
    this._buildStreetProps();
    this._buildNewsstandsAndFences();
    this._buildGoldenLegoObjectsAndRooftops();
    this._buildLegoClouds();
  }

  addCollider(x, z, width, depth, height) {
    const col = {
      minX: x - width * 0.5,
      maxX: x + width * 0.5,
      minZ: z - depth * 0.5,
      maxZ: z + depth * 0.5,
      maxY: height,
      disabled: false
    };
    this.colliders.push(col);
    return col;
  }

  _setupSkyAndLights() {
    this.scene.background = new THREE.Color(0x60a5fa);
    this.scene.fog = new THREE.FogExp2(0x93c5fd, 0.0042);

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x475569, 0.85);
    hemiLight.position.set(0, 80, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    sunLight.position.set(42, 68, 36);
    sunLight.castShadow = true;

    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 180;
    const d = 65;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    this.scene.add(sunLight);

    const sunGroup = new THREE.Group();
    const sunCore = new THREE.Mesh(
      new THREE.BoxGeometry(8, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    sunGroup.add(sunCore);
    sunGroup.position.set(95, 130, 80);
    this.scene.add(sunGroup);
  }

  _buildAsphaltAndRoadMarkings() {
    const asphaltMat = getLegoMaterial(0x1e293b, {
      roughness: 0.55,
      clearcoat: 0.15
    });

    const groundGeo = new THREE.PlaneGeometry(220, 220);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMesh = new THREE.Mesh(groundGeo, asphaltMat);
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    const yellowStripeMat = getLegoMaterial(LEGO_COLORS.yellow, { roughness: 0.3 });
    const whiteStripeMat = getLegoMaterial(LEGO_COLORS.white, { roughness: 0.3 });

    for (const offsetZ of [-52, 52]) {
      const segLen = 68;
      for (const xOff of [-0.25, 0.25]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, segLen), yellowStripeMat);
        line.position.set(xOff, 0.015, offsetZ);
        line.receiveShadow = true;
        this.scene.add(line);
      }
    }

    for (const offsetX of [-52, 52]) {
      const segLen = 68;
      for (const zOff of [-0.25, 0.25]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.03, 0.18), yellowStripeMat);
        line.position.set(offsetX, 0.015, zOff);
        line.receiveShadow = true;
        this.scene.add(line);
      }
    }

    for (let z = -80; z <= 80; z += 7) {
      if (Math.abs(z) < 18) continue;
      for (const xLane of [-4.8, 4.8]) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 3.2), whiteStripeMat);
        dash.position.set(xLane, 0.015, z);
        dash.receiveShadow = true;
        this.scene.add(dash);
      }
    }

    for (let x = -80; x <= 80; x += 7) {
      if (Math.abs(x) < 18) continue;
      for (const zLane of [-4.8, 4.8]) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.2), whiteStripeMat);
        dash.position.set(x, 0.015, zLane);
        dash.receiveShadow = true;
        this.scene.add(dash);
      }
    }

    this._createCrosswalk(0, -14.5, true, whiteStripeMat);
    this._createCrosswalk(0, 14.5, true, whiteStripeMat);
    this._createCrosswalk(-14.5, 0, false, whiteStripeMat);
    this._createCrosswalk(14.5, 0, false, whiteStripeMat);
  }

  _createCrosswalk(cx, cz, alongX, mat) {
    const count = 9;
    const spacing = 1.65;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const w = alongX ? 0.9 : 3.2;
      const d = alongX ? 3.2 : 0.9;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, d), mat);
      stripe.position.set(
        alongX ? cx + offset : cx,
        0.018,
        alongX ? cz : cz + offset
      );
      stripe.receiveShadow = true;
      this.scene.add(stripe);
    }
  }

  _buildSidewalksWithStuds() {
    const sidewalkHeight = 0.26;
    const blockSize = 72;
    const blockOffset = 10 + blockSize * 0.5;

    const quadrants = [
      { x: -blockOffset, z: -blockOffset },
      { x: blockOffset, z: -blockOffset },
      { x: -blockOffset, z: blockOffset },
      { x: blockOffset, z: blockOffset }
    ];

    const curbMat = getLegoMaterial(LEGO_COLORS.lightGrey, { roughness: 0.28, clearcoat: 0.35 });
    const tileMat = getLegoMaterial(LEGO_COLORS.darkGrey, { roughness: 0.3, clearcoat: 0.35 });

    quadrants.forEach((q) => {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(blockSize, sidewalkHeight, blockSize),
        curbMat
      );
      base.position.set(q.x, sidewalkHeight * 0.5, q.z);
      base.receiveShadow = true;
      base.castShadow = true;
      this.scene.add(base);

      const inner = new THREE.Mesh(
        new THREE.BoxGeometry(blockSize - 1.6, 0.04, blockSize - 1.6),
        tileMat
      );
      inner.position.set(q.x, sidewalkHeight + 0.02, q.z);
      inner.receiveShadow = true;
      this.scene.add(inner);

      this.addCollider(q.x, q.z, blockSize, blockSize, sidewalkHeight);
      this._populateSidewalkStuds(q.x, q.z, blockSize, sidewalkHeight, curbMat);
    });
  }

  _populateSidewalkStuds(qx, qz, size, height, mat) {
    const step = 0.8;
    const half = size * 0.5 - 0.5;
    const positions = [];

    const edgeX = qx < 0 ? qx + half : qx - half;
    const edgeZ = qz < 0 ? qz + half : qz - half;

    for (let t = -half; t <= half; t += step) {
      positions.push([edgeX, height, qz + t]);
      positions.push([edgeX + (qx < 0 ? -0.6 : 0.6), height, qz + t]);

      positions.push([qx + t, height, edgeZ]);
      positions.push([qx + t, height, edgeZ + (qz < 0 ? -0.6 : 0.6)]);
    }

    const instanced = new THREE.InstancedMesh(SHARED_STUD_GEO, mat, positions.length);
    instanced.castShadow = true;
    instanced.receiveShadow = true;

    const dummy = new THREE.Object3D();
    positions.forEach((pos, idx) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.updateMatrix();
      instanced.setMatrixAt(idx, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    this.scene.add(instanced);
  }

  _buildSurroundingBuildings() {
    const sidewalkY = 0.26;

    const buildings = [
      {
        x: -26, z: -26, w: 18, d: 18, h: 24,
        color: LEGO_COLORS.blue, accent: LEGO_COLORS.white, roofStudColor: LEGO_COLORS.blue
      },
      {
        x: -48, z: -24, w: 16, d: 14, h: 14,
        color: LEGO_COLORS.red, accent: LEGO_COLORS.tan, roofStudColor: LEGO_COLORS.red
      },
      {
        x: -25, z: -48, w: 15, d: 16, h: 16,
        color: LEGO_COLORS.sandGreen, accent: LEGO_COLORS.white, roofStudColor: LEGO_COLORS.sandGreen
      },
      {
        x: 26, z: -26, w: 20, d: 18, h: 28,
        color: LEGO_COLORS.charcoal, accent: LEGO_COLORS.gold, roofStudColor: LEGO_COLORS.gold
      },
      {
        x: 50, z: -25, w: 16, d: 16, h: 15,
        color: LEGO_COLORS.orange, accent: LEGO_COLORS.white, roofStudColor: LEGO_COLORS.orange
      },
      {
        x: 26, z: -50, w: 16, d: 16, h: 19,
        color: LEGO_COLORS.navy, accent: LEGO_COLORS.lightGrey, roofStudColor: LEGO_COLORS.navy
      },
      {
        x: -26, z: 26, w: 18, d: 16, h: 18,
        color: LEGO_COLORS.tan, accent: LEGO_COLORS.brown, roofStudColor: LEGO_COLORS.tan
      },
      {
        x: -48, z: 26, w: 16, d: 16, h: 22,
        color: LEGO_COLORS.purple, accent: LEGO_COLORS.cyan, roofStudColor: LEGO_COLORS.purple
      },
      {
        x: 26, z: 26, w: 18, d: 18, h: 21,
        color: LEGO_COLORS.white, accent: LEGO_COLORS.blue, roofStudColor: LEGO_COLORS.blue
      },
      {
        x: 48, z: 26, w: 15, d: 16, h: 13,
        color: LEGO_COLORS.green, accent: LEGO_COLORS.yellow, roofStudColor: LEGO_COLORS.green
      }
    ];

    const glassMat = getLegoMaterial(0x38bdf8, {
      roughness: 0.08,
      metalness: 0.25,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.78
    });

    buildings.forEach((b) => {
      const group = new THREE.Group();
      group.position.set(b.x, sidewalkY, b.z);

      const wallMat = getLegoMaterial(b.color, { roughness: 0.25, clearcoat: 0.4 });
      const accentMat = getLegoMaterial(b.accent, { roughness: 0.25, clearcoat: 0.4 });

      const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
      body.position.y = b.h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      const roofRim = createLegoBrick(b.w + 0.6, 0.7, b.d + 0.6, b.roofStudColor, {
        studStep: 1.2
      });
      roofRim.position.y = b.h + 0.35;
      group.add(roofRim);

      const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 3.2, b.d + 0.4), accentMat);
      baseTrim.position.y = 1.6;
      baseTrim.castShadow = true;
      baseTrim.receiveShadow = true;
      group.add(baseTrim);

      const floors = Math.floor((b.h - 4) / 3.4);
      const colsX = Math.floor((b.w - 3) / 3.2);
      const colsZ = Math.floor((b.d - 3) / 3.2);

      for (let f = 0; f < floors; f++) {
        const wy = 4.6 + f * 3.3;

        for (let c = 0; c < colsX; c++) {
          const wx = (c - (colsX - 1) * 0.5) * 3.1;
          for (const dir of [-1, 1]) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.9, 0.16), glassMat);
            win.position.set(wx, wy, dir * (b.d * 0.5 + 0.05));
            group.add(win);
          }
        }

        for (let c = 0; c < colsZ; c++) {
          const wz = (c - (colsZ - 1) * 0.5) * 3.1;
          for (const dir of [-1, 1]) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 1.8), glassMat);
            win.position.set(dir * (b.w * 0.5 + 0.05), wy, wz);
            group.add(win);
          }
        }
      }

      this.scene.add(group);
      this.addCollider(b.x, b.z, b.w + 0.4, b.d + 0.4, sidewalkY + b.h + 0.7);
    });
  }

  /**
   * Carros Estacionados LEGO (Subíveis e Quebráveis com Chuva de Studs!)
   */
  _buildParkedLegoCars() {
    const cars = [
      { x: -7.2, z: -8.0, rotY: 0, color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'police' },
      { x: 7.2, z: -9.5, rotY: Math.PI, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi' },
      { x: -7.2, z: 18.0, rotY: 0, color: LEGO_COLORS.red, roofColor: LEGO_COLORS.white, type: 'sport' },
      { x: 7.2, z: 20.0, rotY: Math.PI, color: LEGO_COLORS.green, roofColor: LEGO_COLORS.white, type: 'sport' },
      { x: -22.0, z: 7.2, rotY: Math.PI / 2, color: LEGO_COLORS.blue, roofColor: LEGO_COLORS.white, type: 'suv' },
      { x: 22.0, z: -7.2, rotY: -Math.PI / 2, color: LEGO_COLORS.charcoal, roofColor: LEGO_COLORS.black, type: 'police' },
      { x: -25.0, z: -7.2, rotY: Math.PI / 2, color: LEGO_COLORS.orange, roofColor: LEGO_COLORS.yellow, type: 'taxi' }
    ];

    cars.forEach((cfg) => {
      const carGroup = this._createLegoCarMesh(cfg);
      carGroup.position.set(cfg.x, 0, cfg.z);
      carGroup.rotation.y = cfg.rotY;
      this.scene.add(carGroup);

      const isRotated90 = Math.abs(Math.sin(cfg.rotY)) > 0.7;
      const carWidth = isRotated90 ? 4.8 : 2.4;
      const carDepth = isRotated90 ? 2.4 : 4.8;
      const cabinWidth = isRotated90 ? 2.5 : 2.1;
      const cabinDepth = isRotated90 ? 2.1 : 2.5;

      const col1 = this.addCollider(cfg.x, cfg.z, carWidth, carDepth, 1.15);
      const col2 = this.addCollider(cfg.x, cfg.z, cabinWidth, cabinDepth, 1.82);

      if (this.destructibles) {
        this.destructibles.registerDestructible({
          mesh: carGroup,
          type: 'car',
          hp: 54,
          radius: 2.5,
          height: 1.9,
          colliders: [col1, col2],
          debrisColors: [cfg.color, cfg.roofColor, LEGO_COLORS.black, LEGO_COLORS.yellow],
          studDrops: { silver: 6, gold: 5, blue: 2, purple: cfg.type === 'sport' ? 1 : 0 },
          groundY: 0.0
        });
      }
    });
  }

  _createLegoCarMesh(cfg) {
    const group = new THREE.Group();

    const bumperMat = getLegoMaterial(LEGO_COLORS.lightGrey, { roughness: 0.3 });
    const tireMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.65, clearcoat: 0.05 });
    const rimMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.4, roughness: 0.25 });
    const glassMat = getLegoMaterial(0x7dd3fc, {
      roughness: 0.1,
      transparent: true,
      opacity: 0.72
    });

    const chassis = createLegoBrick(2.3, 0.75, 4.7, cfg.color, { studStep: 0.65 });
    chassis.position.set(0, 0.72, 0);
    group.add(chassis);

    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 0.35), bumperMat);
    frontBumper.position.set(0, 0.46, 2.38);
    frontBumper.castShadow = true;
    group.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 0.35), bumperMat);
    rearBumper.position.set(0, 0.46, -2.38);
    rearBumper.castShadow = true;
    group.add(rearBumper);

    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.58, 2.3), glassMat);
    cabinGlass.position.set(0, 1.38, -0.1);
    cabinGlass.castShadow = true;
    group.add(cabinGlass);

    const roofPlate = createLegoBrick(2.06, 0.18, 2.36, cfg.roofColor, { studStep: 0.6 });
    roofPlate.position.set(0, 1.72, -0.1);
    group.add(roofPlate);

    if (cfg.type === 'police') {
      const redLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.18, 0.32),
        getLegoMaterial(LEGO_COLORS.red, { emissive: 0xdc2626, emissiveIntensity: 0.6 })
      );
      redLight.position.set(-0.34, 1.9, -0.1);
      group.add(redLight);

      const blueLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.18, 0.32),
        getLegoMaterial(LEGO_COLORS.blue, { emissive: 0x2563eb, emissiveIntensity: 0.6 })
      );
      blueLight.position.set(0.34, 1.9, -0.1);
      group.add(blueLight);
    } else if (cfg.type === 'taxi') {
      const taxiSign = createLegoBrick(0.9, 0.24, 0.4, LEGO_COLORS.orange, { studs: false });
      taxiSign.position.set(0, 1.92, -0.1);
      group.add(taxiSign);
    }

    const headLightMat = getLegoMaterial(0xfef08a, { emissive: 0xfef08a, emissiveIntensity: 0.7 });
    const tailLightMat = getLegoMaterial(0xef4444, { emissive: 0xef4444, emissiveIntensity: 0.6 });

    for (const xSide of [-0.78, 0.78]) {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), headLightMat);
      hl.rotation.x = Math.PI / 2;
      hl.position.set(xSide, 0.78, 2.38);
      group.add(hl);

      const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16), tailLightMat);
      tl.rotation.x = Math.PI / 2;
      tl.position.set(xSide, 0.78, -2.38);
      group.add(tl);
    }

    const wheelOffsets = [
      [-1.15, 0.42, 1.45],
      [1.15, 0.42, 1.45],
      [-1.15, 0.42, -1.45],
      [1.15, 0.42, -1.45]
    ];

    wheelOffsets.forEach(([wx, wy, wz]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, wy, wz);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 20), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.38, 16), rimMat);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);

      group.add(wheelGroup);
    });

    return group;
  }

  _buildStreetProps() {
    const sidewalkY = 0.26;

    // 1. Postes de Luz Quebráveis
    const lampCoords = [
      [-11.2, -11.2], [11.2, -11.2], [-11.2, 11.2], [11.2, 11.2],
      [-11.2, -26], [11.2, -26], [-11.2, 26], [11.2, 26],
      [-26, -11.2], [26, -11.2], [-26, 11.2], [26, 11.2]
    ];

    const poleMat = getLegoMaterial(LEGO_COLORS.darkGrey);
    const bulbMat = getLegoMaterial(0xfef08a, { emissive: 0xfde047, emissiveIntensity: 0.8 });

    lampCoords.forEach(([lx, lz]) => {
      const lamp = new THREE.Group();
      lamp.position.set(lx, sidewalkY, lz);

      const base = createLegoBrick(0.7, 0.3, 0.7, LEGO_COLORS.darkGrey, { studs: true });
      base.position.y = 0.15;
      lamp.add(base);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.2, 12), poleMat);
      pole.position.y = 2.75;
      pole.castShadow = true;
      lamp.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 1.4), poleMat);
      arm.position.set(0, 5.3, lx < 0 ? 0.5 : -0.5);
      lamp.add(arm);

      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.25, 16), bulbMat);
      bulb.position.set(0, 5.15, lx < 0 ? 0.95 : -0.95);
      lamp.add(bulb);

      this.scene.add(lamp);
      const col = this.addCollider(lx, lz, 0.7, 0.7, sidewalkY + 5.4);

      if (this.destructibles) {
        this.destructibles.registerDestructible({
          mesh: lamp,
          type: 'streetlamp',
          hp: 30,
          radius: 1.0,
          height: 5.3,
          colliders: [col],
          debrisColors: [LEGO_COLORS.darkGrey, LEGO_COLORS.lightGrey, LEGO_COLORS.yellow],
          studDrops: { silver: 5, gold: 3, blue: 0, purple: 0 },
          groundY: sidewalkY
        });
      }
    });

    // 2. Hidrantes Vermelhos LEGO (Esguicham Água ao Quebrar!)
    const hydrantCoords = [
      [-11.2, -15.5], [11.2, -15.5], [-11.2, 15.5], [11.2, 15.5],
      [-15.5, -11.2], [15.5, -11.2], [-15.5, 11.2], [15.5, 11.2]
    ];
    const redMat = getLegoMaterial(LEGO_COLORS.red);
    const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.4 });

    hydrantCoords.forEach(([hx, hz]) => {
      const hyd = new THREE.Group();
      hyd.position.set(hx, sidewalkY, hz);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 16), redMat);
      body.position.y = 0.45;
      body.castShadow = true;
      hyd.add(body);

      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.66, 12), silverMat);
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.y = 0.55;
      hyd.add(nozzle);

      const topStud = new THREE.Mesh(SHARED_STUD_GEO, redMat);
      topStud.position.y = 0.9;
      hyd.add(topStud);

      this.scene.add(hyd);
      const col = this.addCollider(hx, hz, 0.65, 0.65, sidewalkY + 0.98);

      if (this.destructibles) {
        this.destructibles.registerDestructible({
          mesh: hyd,
          type: 'hydrant',
          hp: 18,
          radius: 0.95,
          height: 1.1,
          colliders: [col],
          debrisColors: [LEGO_COLORS.red, LEGO_COLORS.silver, 0x38bdf8],
          studDrops: { silver: 4, gold: 3, blue: 1, purple: 0 },
          groundY: sidewalkY
        });
      }
    });

    // 3. Árvores de LEGO nas calçadas
    const treeCoords = [
      [-14.5, -24], [-14.5, -36], [14.5, -24], [14.5, -36],
      [-14.5, 24], [-14.5, 36], [14.5, 24], [14.5, 36]
    ];
    const trunkMat = getLegoMaterial(LEGO_COLORS.brown);

    treeCoords.forEach(([tx, tz]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, sidewalkY, tz);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.2, 12), trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      tree.add(trunk);

      const c1 = createLegoBrick(2.6, 1.1, 2.6, LEGO_COLORS.green, { studStep: 0.65 });
      c1.position.y = 2.6;
      tree.add(c1);

      const c2 = createLegoBrick(2.0, 1.0, 2.0, LEGO_COLORS.darkGreen, { studStep: 0.65 });
      c2.position.y = 3.65;
      tree.add(c2);

      const c3 = createLegoBrick(1.2, 0.8, 1.2, LEGO_COLORS.green, { studStep: 0.6 });
      c3.position.y = 4.55;
      tree.add(c3);

      this.scene.add(tree);
      this.addCollider(tx, tz, 0.9, 0.9, sidewalkY + 4.8);
    });

    // 4. Caixas Quebráveis de LEGO (Incluindo Caixas Douradas/Roxas de Recompensa!)
    const crateConfigs = [
      // Escada de caixas na esquina Noroeste
      { x: -15.5, z: -14.0, w: 1.5, d: 1.5, h: 1.0, color: LEGO_COLORS.orange, special: false },
      { x: -15.5, z: -15.8, w: 1.5, d: 1.5, h: 1.8, color: LEGO_COLORS.yellow, special: false },
      { x: -15.5, z: -17.6, w: 1.5, d: 1.5, h: 2.6, color: LEGO_COLORS.red, special: true },
      // Caixas perto do jogador na calçada Sudoeste e Sudeste
      { x: -12.8, z: 13.2, w: 1.4, d: 1.4, h: 1.2, color: LEGO_COLORS.gold, special: true },
      { x: -14.4, z: 13.2, w: 1.3, d: 1.3, h: 1.0, color: LEGO_COLORS.orange, special: false },
      { x: 12.8, z: 13.2, w: 1.4, d: 1.4, h: 1.2, color: LEGO_COLORS.purple, special: true },
      { x: 14.4, z: 13.2, w: 1.3, d: 1.3, h: 1.0, color: LEGO_COLORS.blue, special: false },
      { x: 12.8, z: -13.2, w: 1.4, d: 1.4, h: 1.2, color: LEGO_COLORS.gold, special: true }
    ];

    crateConfigs.forEach((c) => {
      const crate = createLegoBrick(c.w, c.h, c.d, c.color, { studStep: 0.55 });
      crate.position.set(c.x, sidewalkY + c.h * 0.5, c.z);
      this.scene.add(crate);
      const col = this.addCollider(c.x, c.z, c.w, c.d, sidewalkY + c.h);

      if (this.destructibles) {
        this.destructibles.registerDestructible({
          mesh: crate,
          type: 'crate',
          hp: c.special ? 24 : 15,
          radius: 1.15,
          height: c.h,
          colliders: [col],
          debrisColors: [c.color, LEGO_COLORS.yellow, LEGO_COLORS.brown],
          studDrops: c.special
            ? { silver: 3, gold: 4, blue: 2, purple: 1 }
            : { silver: 5, gold: 2, blue: 0, purple: 0 },
          groundY: sidewalkY
        });
      }
    });
  }

  /**
   * Bancas de Jornal e Cercas Quebráveis de LEGO nas 4 calçadas
   */
  _buildNewsstandsAndFences() {
    const sidewalkY = 0.26;

    // 1. Bancas de Jornal (Newsstands) nas 4 esquinas
    const stands = [
      { x: -14.0, z: -19.5, rotY: Math.PI / 2, awningColor: LEGO_COLORS.red },
      { x: 14.0, z: -19.5, rotY: -Math.PI / 2, awningColor: LEGO_COLORS.blue },
      { x: -14.0, z: 19.5, rotY: Math.PI / 2, awningColor: LEGO_COLORS.green },
      { x: 14.0, z: 19.5, rotY: -Math.PI / 2, awningColor: LEGO_COLORS.orange }
    ];

    stands.forEach((cfg) => {
      const standGroup = new THREE.Group();
      standGroup.position.set(cfg.x, sidewalkY, cfg.z);
      standGroup.rotation.y = cfg.rotY;

      // Base/Balcão da banca de jornal
      const counter = createLegoBrick(2.8, 1.1, 1.7, LEGO_COLORS.tan, { studStep: 0.6 });
      counter.position.y = 0.55;
      standGroup.add(counter);

      // Parede de fundo e colunas laterais
      const backWall = createLegoBrick(2.8, 1.3, 0.35, LEGO_COLORS.brown, { studs: false });
      backWall.position.set(0, 1.75, -0.68);
      standGroup.add(backWall);

      // Revistas e jornais coloridos no balcão
      const magColors = [LEGO_COLORS.red, LEGO_COLORS.yellow, LEGO_COLORS.cyan, LEGO_COLORS.purple];
      magColors.forEach((mc, idx) => {
        const mag = createLegoBrick(0.5, 0.12, 0.65, mc, { studs: true, studStep: 0.25 });
        mag.position.set(-0.9 + idx * 0.6, 1.16, 0.25);
        standGroup.add(mag);
      });

      // Toldo superior de LEGO com pinos (Studs)
      const awning = createLegoBrick(3.1, 0.38, 2.1, cfg.awningColor, { studStep: 0.6 });
      awning.position.set(0, 2.55, 0);
      standGroup.add(awning);

      this.scene.add(standGroup);
      const col = this.addCollider(cfg.x, cfg.z, 2.1, 3.0, sidewalkY + 2.75);

      if (this.destructibles) {
        this.destructibles.registerDestructible({
          mesh: standGroup,
          type: 'newsstand',
          hp: 34,
          radius: 1.9,
          height: 2.7,
          colliders: [col],
          debrisColors: [cfg.awningColor, LEGO_COLORS.tan, LEGO_COLORS.white, LEGO_COLORS.yellow],
          studDrops: { silver: 6, gold: 4, blue: 2, purple: 0 },
          groundY: sidewalkY
        });
      }
    });

    // 2. Cercas Brancas de LEGO ao longo das calçadas (Quebram facilmente com 1 golpe ou tiro!)
    const fencePositions = [
      // Cercas horizontais (ao longo de X)
      { x: -19.5, z: -11.4, rotY: 0 },
      { x: -22.2, z: -11.4, rotY: 0 },
      { x: 19.5, z: -11.4, rotY: 0 },
      { x: 22.2, z: -11.4, rotY: 0 },
      { x: -19.5, z: 11.4, rotY: 0 },
      { x: -22.2, z: 11.4, rotY: 0 },
      { x: 19.5, z: 11.4, rotY: 0 },
      { x: 22.2, z: 11.4, rotY: 0 }
    ];

    fencePositions.forEach((f) => {
      const fenceGroup = new THREE.Group();
      fenceGroup.position.set(f.x, sidewalkY, f.z);
      fenceGroup.rotation.y = f.rotY;

      // Dois pilares com pinos + duas barras horizontais estilo cerca LEGO clássica
      const postL = createLegoBrick(0.32, 1.05, 0.32, LEGO_COLORS.white);
      postL.position.set(-0.95, 0.52, 0);
      const postR = createLegoBrick(0.32, 1.05, 0.32, LEGO_COLORS.white);
      postR.position.set(0.95, 0.52, 0);

      const railTop = createLegoBrick(2.2, 0.18, 0.2, LEGO_COLORS.white, { studStep: 0.45 });
      railTop.position.set(0, 0.85, 0);
      const railBot = createLegoBrick(2.2, 0.18, 0.2, LEGO_COLORS.white, { studs: false });
      railBot.position.set(0, 0.38, 0);

      fenceGroup.add(postL, postR, railTop, railBot);
      this.scene.add(fenceGroup);

      const col = this.addCollider(f.x, f.z, 2.2, 0.45, sidewalkY + 1.05);

      if (this.destructibles) {
        this.destructibles.registerDestructible({
          mesh: fenceGroup,
          type: 'fence',
          hp: 10,
          radius: 1.25,
          height: 1.05,
          colliders: [col],
          debrisColors: [LEGO_COLORS.white, LEGO_COLORS.lightGrey],
          studDrops: { silver: 3, gold: 1, blue: 0, purple: 0 },
          groundY: sidewalkY
        });
      }
    });
  }

  /**
   * Cria Objetos Dourados de LEGO (que só derretem com o Raio Solar do Solaris)
   * nas esquinas e nos terraços dos prédios mais altos!
   */
  _buildGoldenLegoObjectsAndRooftops() {
    const sidewalkY = 0.26;

    const goldVaultLocations = [
      // Na calçada perto do cruzamento para teste rápido
      { x: -12.6, z: -12.6, y: sidewalkY, scale: 1.0 },
      { x: 12.6, z: 12.6, y: sidewalkY, scale: 1.0 },
      // No topo do Prédio Mais Alto (Nordeste: x=26, z=-26, altura=28.96)
      { x: 26.0, z: -26.0, y: sidewalkY + 28.7, scale: 1.35 },
      // No topo da Torre Comercial (Noroeste: x=-26, z=-26, altura=24.96)
      { x: -26.0, z: -26.0, y: sidewalkY + 24.7, scale: 1.25 }
    ];

    const goldShinyMat = getLegoMaterial(LEGO_COLORS.gold, {
      metalness: 0.72,
      roughness: 0.14,
      clearcoat: 0.85,
      emissive: 0xd97706,
      emissiveIntensity: 0.28
    });

    goldVaultLocations.forEach((loc) => {
      const vaultGroup = new THREE.Group();
      vaultGroup.position.set(loc.x, loc.y, loc.z);

      const w = 1.9 * loc.scale;
      const h = 2.1 * loc.scale;
      const d = 1.9 * loc.scale;

      // Pedestal + Cofre/Monolito de Ouro LEGO
      const base = createLegoBrick(w + 0.3, 0.35, d + 0.3, LEGO_COLORS.gold, {
        metalness: 0.65,
        roughness: 0.16,
        studStep: 0.55
      });
      base.position.y = 0.175;
      vaultGroup.add(base);

      const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldShinyMat);
      core.position.y = 0.35 + h * 0.5;
      core.castShadow = true;
      vaultGroup.add(core);

      // Porta circular de cofre dourado na frente e trás
      const dialGeo = new THREE.CylinderGeometry(w * 0.32, w * 0.32, 0.18, 20);
      dialGeo.rotateX(Math.PI / 2);
      for (const dir of [-1, 1]) {
        const dial = new THREE.Mesh(dialGeo, goldShinyMat);
        dial.position.set(0, 0.35 + h * 0.5, dir * (d * 0.5 + 0.05));
        vaultGroup.add(dial);
      }

      // Topo cravejado de pinos dourados (Studs)
      const topPlate = createLegoBrick(w, 0.25, d, LEGO_COLORS.gold, {
        metalness: 0.7,
        roughness: 0.15,
        studStep: 0.5
      });
      topPlate.position.y = 0.35 + h + 0.125;
      vaultGroup.add(topPlate);

      this.scene.add(vaultGroup);
      const col = this.addCollider(loc.x, loc.z, w + 0.2, d + 0.2, loc.y + h + 0.5);

      if (this.destructibles) {
        this.destructibles.registerDestructible({
          mesh: vaultGroup,
          type: 'gold_vault',
          hp: 45,
          radius: w * 0.85,
          height: h + 0.6,
          colliders: [col],
          debrisColors: [LEGO_COLORS.gold, LEGO_COLORS.yellow, 0xfef08a],
          studDrops: { silver: 0, gold: 8, blue: 4, purple: 2 },
          groundY: loc.y,
          goldOnly: true // Só derrete com o Raio Solar Contínuo / Supernova do Solaris!
        });
      }
    });

    // Heliponto no topo do prédio mais alto (x=26, z=-26, y=28.96)
    const heliPad = new THREE.Group();
    heliPad.position.set(26, sidewalkY + 28.72, -26);
    const padCircle = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 6.5, 0.08, 32),
      getLegoMaterial(LEGO_COLORS.darkGrey)
    );
    const hLine1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.12, 5.2),
      getLegoMaterial(LEGO_COLORS.yellow)
    );
    hLine1.position.x = -1.8;
    const hLine2 = hLine1.clone();
    hLine2.position.x = 1.8;
    const hCross = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.12, 0.6),
      getLegoMaterial(LEGO_COLORS.yellow)
    );
    heliPad.add(padCircle, hLine1, hLine2, hCross);
    this.scene.add(heliPad);
  }

  _buildLegoClouds() {
    const cloudCoords = [
      [-45, 52, -40], [35, 58, -55], [-20, 62, 45], [55, 50, 30], [0, 66, -15]
    ];

    cloudCoords.forEach(([cx, cy, cz]) => {
      const cloud = new THREE.Group();
      const b1 = createLegoBrick(9, 2.2, 5, LEGO_COLORS.white, { studStep: 1.5, castShadow: false });
      const b2 = createLegoBrick(6, 2.0, 4, LEGO_COLORS.white, { studStep: 1.5, castShadow: false });
      b2.position.set(2.5, 1.6, 0.5);
      cloud.add(b1, b2);
      cloud.position.set(cx, cy, cz);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    });
  }

  update(dt) {
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.8;
      if (cloud.position.x > 110) {
        cloud.position.x = -110;
      }
    }
  }
}
