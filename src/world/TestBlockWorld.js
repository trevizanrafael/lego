import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick
} from '../materials/LegoMaterials.js';

export class TestBlockWorld {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // Lista de AABBs: { minX, maxX, minZ, maxZ, maxY }
    this.clouds = [];

    this._setupSkyAndLights();
    this._buildAsphaltAndRoadMarkings();
    this._buildSidewalksWithStuds();
    this._buildSurroundingBuildings();
    this._buildParkedLegoCars();
    this._buildStreetProps();
    this._buildLegoClouds();
  }

  addCollider(x, z, width, depth, height) {
    this.colliders.push({
      minX: x - width * 0.5,
      maxX: x + width * 0.5,
      minZ: z - depth * 0.5,
      maxZ: z + depth * 0.5,
      maxY: height
    });
  }

  _setupSkyAndLights() {
    // Céu diurno vibrante
    this.scene.background = new THREE.Color(0x60a5fa);
    this.scene.fog = new THREE.FogExp2(0x93c5fd, 0.0042);

    // Iluminação Hemisférica (Céu azul claro / Rebatedor quente do chão)
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x475569, 0.85);
    hemiLight.position.set(0, 80, 0);
    this.scene.add(hemiLight);

    // Luz Solar Direcional com Sombras em Tempo Real
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

    // Sol de blocos LEGO brilhante no céu
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
    // Base de asfalto principal
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

    // Faixa dupla amarela central na Avenida Principal (Eixo Z, X = 0)
    for (const offsetZ of [-52, 52]) {
      const segLen = 68;
      for (const xOff of [-0.25, 0.25]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, segLen), yellowStripeMat);
        line.position.set(xOff, 0.015, offsetZ);
        line.receiveShadow = true;
        this.scene.add(line);
      }
    }

    // Faixa dupla amarela na Rua Transversal (Eixo X, Z = 0)
    for (const offsetX of [-52, 52]) {
      const segLen = 68;
      for (const zOff of [-0.25, 0.25]) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.03, 0.18), yellowStripeMat);
        line.position.set(offsetX, 0.015, zOff);
        line.receiveShadow = true;
        this.scene.add(line);
      }
    }

    // Faixas tracejadas brancas nas pistas
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

    // 4 Faixas de Pedestre (Crosswalks) no cruzamento central
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
    // 4 grandes quarteirões de calçada ao redor do cruzamento (Avenida largura 20: X e Z de -10 a +10)
    const sidewalkHeight = 0.26;
    const blockSize = 72;
    const blockOffset = 10 + blockSize * 0.5; // Centro em +-46

    const quadrants = [
      { x: -blockOffset, z: -blockOffset },
      { x: blockOffset, z: -blockOffset },
      { x: -blockOffset, z: blockOffset },
      { x: blockOffset, z: blockOffset }
    ];

    const curbMat = getLegoMaterial(LEGO_COLORS.lightGrey, { roughness: 0.28, clearcoat: 0.35 });
    const tileMat = getLegoMaterial(LEGO_COLORS.darkGrey, { roughness: 0.3, clearcoat: 0.35 });

    quadrants.forEach((q) => {
      // Base da calçada
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(blockSize, sidewalkHeight, blockSize),
        curbMat
      );
      base.position.set(q.x, sidewalkHeight * 0.5, q.z);
      base.receiveShadow = true;
      base.castShadow = true;
      this.scene.add(base);

      // Piso interno escuro estilo placas LEGO
      const inner = new THREE.Mesh(
        new THREE.BoxGeometry(blockSize - 1.6, 0.04, blockSize - 1.6),
        tileMat
      );
      inner.position.set(q.x, sidewalkHeight + 0.02, q.z);
      inner.receiveShadow = true;
      this.scene.add(inner);

      // Registra colisão da calçada (permite subir/pular nela)
      this.addCollider(q.x, q.z, blockSize, blockSize, sidewalkHeight);

      // Fileiras de Pinos de LEGO (Studs) nas bordas da calçada
      this._populateSidewalkStuds(q.x, q.z, blockSize, sidewalkHeight, curbMat);
    });
  }

  _populateSidewalkStuds(qx, qz, size, height, mat) {
    const step = 0.8;
    const half = size * 0.5 - 0.5;
    const positions = [];

    // Pinos ao longo das duas bordas voltadas para a rua
    const edgeX = qx < 0 ? qx + half : qx - half;
    const edgeZ = qz < 0 ? qz + half : qz - half;

    for (let t = -half; t <= half; t += step) {
      // Duas fileiras de pinos LEGO no meio-fio
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

    // Lista de prédios LEGO ao redor do quarteirão central para compor a cidade
    const buildings = [
      // Quarteirão Noroeste (-X, -Z)
      {
        x: -26, z: -26, w: 18, d: 18, h: 24,
        color: LEGO_COLORS.blue, accent: LEGO_COLORS.white, roofStudColor: LEGO_COLORS.blue,
        title: 'TORRE COMERCIAL LEGO'
      },
      {
        x: -48, z: -24, w: 16, d: 14, h: 14,
        color: LEGO_COLORS.red, accent: LEGO_COLORS.tan, roofStudColor: LEGO_COLORS.red
      },
      {
        x: -25, z: -48, w: 15, d: 16, h: 16,
        color: LEGO_COLORS.sandGreen, accent: LEGO_COLORS.white, roofStudColor: LEGO_COLORS.sandGreen
      },

      // Quarteirão Nordeste (+X, -Z)
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

      // Quarteirão Sudoeste (-X, +Z)
      {
        x: -26, z: 26, w: 18, d: 16, h: 18,
        color: LEGO_COLORS.tan, accent: LEGO_COLORS.brown, roofStudColor: LEGO_COLORS.tan
      },
      {
        x: -48, z: 26, w: 16, d: 16, h: 22,
        color: LEGO_COLORS.purple, accent: LEGO_COLORS.cyan, roofStudColor: LEGO_COLORS.purple
      },

      // Quarteirão Sudeste (+X, +Z)
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

      // Corpo do prédio
      const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
      body.position.y = b.h * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Cornija / Topo com Pinos de LEGO (Studs) no terraço
      const roofRim = createLegoBrick(b.w + 0.6, 0.7, b.d + 0.6, b.roofStudColor, {
        studStep: 1.2
      });
      roofRim.position.y = b.h + 0.35;
      group.add(roofRim);

      // Base térrea destacada
      const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 3.2, b.d + 0.4), accentMat);
      baseTrim.position.y = 1.6;
      baseTrim.castShadow = true;
      baseTrim.receiveShadow = true;
      group.add(baseTrim);

      // Janelas 3D nas 4 fachadas
      const floors = Math.floor((b.h - 4) / 3.4);
      const colsX = Math.floor((b.w - 3) / 3.2);
      const colsZ = Math.floor((b.d - 3) / 3.2);

      for (let f = 0; f < floors; f++) {
        const wy = 4.6 + f * 3.3;

        // Frente e Trás
        for (let c = 0; c < colsX; c++) {
          const wx = (c - (colsX - 1) * 0.5) * 3.1;
          for (const dir of [-1, 1]) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.9, 0.16), glassMat);
            win.position.set(wx, wy, dir * (b.d * 0.5 + 0.05));
            group.add(win);
          }
        }

        // Laterais
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
   * Constrói carros estacionados de LEGO 3D com colisores em degrau (capô + teto)
   * para o jogador poder pular em cima deles livremente!
   */
  _buildParkedLegoCars() {
    const cars = [
      // Viatura Policial / BOPE estacionada perto do jogador
      { x: -7.2, z: -8.0, rotY: 0, color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, type: 'police' },
      // Táxi Amarelo LEGO
      { x: 7.2, z: -22.0, rotY: Math.PI, color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, type: 'taxi' },
      // Supercarro Esportivo Vermelho LEGO
      { x: -7.2, z: 22.0, rotY: 0, color: LEGO_COLORS.red, roofColor: LEGO_COLORS.white, type: 'sport' },
      // Caminhonete Azul LEGO na rua transversal
      { x: -23.0, z: 7.2, rotY: Math.PI / 2, color: LEGO_COLORS.blue, roofColor: LEGO_COLORS.white, type: 'suv' },
      // Viatura Preta na outra esquina
      { x: 23.0, z: -7.2, rotY: -Math.PI / 2, color: LEGO_COLORS.charcoal, roofColor: LEGO_COLORS.black, type: 'police' }
    ];

    cars.forEach((cfg) => {
      const carGroup = this._createLegoCarMesh(cfg);
      carGroup.position.set(cfg.x, 0, cfg.z);
      carGroup.rotation.y = cfg.rotY;
      this.scene.add(carGroup);

      // Calcula dimensões alinhadas ao mundo para o colisor do chassi/capô e da cabine
      const isRotated90 = Math.abs(Math.sin(cfg.rotY)) > 0.7;
      const carWidth = isRotated90 ? 4.8 : 2.4;
      const carDepth = isRotated90 ? 2.4 : 4.8;
      const cabinWidth = isRotated90 ? 2.5 : 2.1;
      const cabinDepth = isRotated90 ? 2.1 : 2.5;

      // Colisor 1: Capô / Porta-malas (altura 1.15m - fácil de pular em cima do chão ou calçada!)
      this.addCollider(cfg.x, cfg.z, carWidth, carDepth, 1.15);
      // Colisor 2: Teto da cabine (altura 1.82m - dá para subir do capô para o teto!)
      this.addCollider(cfg.x, cfg.z, cabinWidth, cabinDepth, 1.82);
    });
  }

  _createLegoCarMesh(cfg) {
    const group = new THREE.Group();

    const bodyMat = getLegoMaterial(cfg.color, { roughness: 0.2, clearcoat: 0.55 });
    const roofMat = getLegoMaterial(cfg.roofColor, { roughness: 0.22, clearcoat: 0.5 });
    const bumperMat = getLegoMaterial(LEGO_COLORS.lightGrey, { roughness: 0.3 });
    const tireMat = getLegoMaterial(LEGO_COLORS.black, { roughness: 0.65, clearcoat: 0.05 });
    const rimMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.4, roughness: 0.25 });
    const glassMat = getLegoMaterial(0x7dd3fc, {
      roughness: 0.1,
      transparent: true,
      opacity: 0.72
    });

    // Chassi principal de blocos LEGO
    const chassis = createLegoBrick(2.3, 0.75, 4.7, cfg.color, { studStep: 0.65 });
    chassis.position.set(0, 0.72, 0);
    group.add(chassis);

    // Para-choques dianteiro e traseiro
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 0.35), bumperMat);
    frontBumper.position.set(0, 0.46, 2.38);
    frontBumper.castShadow = true;
    group.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 0.35), bumperMat);
    rearBumper.position.set(0, 0.46, -2.38);
    rearBumper.castShadow = true;
    group.add(rearBumper);

    // Cabine com para-brisa e teto com pinos LEGO
    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.58, 2.3), glassMat);
    cabinGlass.position.set(0, 1.38, -0.1);
    cabinGlass.castShadow = true;
    group.add(cabinGlass);

    const roofPlate = createLegoBrick(2.06, 0.18, 2.36, cfg.roofColor, { studStep: 0.6 });
    roofPlate.position.set(0, 1.72, -0.1);
    group.add(roofPlate);

    // Sirene policial ou placa de Táxi
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

    // Faróis Dianteiros (Amarelo/Branco) e Lanternas Traseiras (Vermelho)
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

    // 4 Rodas LEGO com calota e pino central
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

    // Postes de Luz LEGO nas esquinas e ao longo da avenida
    const lampCoords = [
      [-11.5, -11.5], [11.5, -11.5], [-11.5, 11.5], [11.5, 11.5],
      [-11.5, -28], [11.5, -28], [-11.5, 28], [11.5, 28],
      [-28, -11.5], [28, -11.5], [-28, 11.5], [28, 11.5]
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
      this.addCollider(lx, lz, 0.7, 0.7, sidewalkY + 5.4);
    });

    // Hidrantes Vermelhos LEGO nas calçadas
    const hydrantCoords = [
      [-11.5, -18], [11.5, 18], [-18, 11.5], [18, -11.5]
    ];
    const redMat = getLegoMaterial(LEGO_COLORS.red);
    const silverMat = getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.4 });

    hydrantCoords.forEach(([hx, hz]) => {
      const hyd = new THREE.Group();
      hyd.position.set(hx, sidewalkY, hz);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.85, 16), redMat);
      body.position.y = 0.42;
      body.castShadow = true;
      hyd.add(body);

      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.62, 12), silverMat);
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.y = 0.52;
      hyd.add(nozzle);

      const topStud = new THREE.Mesh(SHARED_STUD_GEO, redMat);
      topStud.position.y = 0.85;
      hyd.add(topStud);

      this.scene.add(hyd);
      this.addCollider(hx, hz, 0.6, 0.6, sidewalkY + 0.95);
    });

    // Árvores de LEGO nas calçadas
    const treeCoords = [
      [-14, -22], [-14, -36], [14, -22], [14, -36],
      [-14, 22], [-14, 36], [14, 22], [14, 36]
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

    // Caixas / Degraus de LEGO empilhados perto da esquina Noroeste para testar pulos altos
    const crateConfigs = [
      { x: -15.5, z: -14.0, w: 1.6, d: 1.6, h: 1.0, color: LEGO_COLORS.orange },
      { x: -15.5, z: -15.8, w: 1.6, d: 1.6, h: 1.9, color: LEGO_COLORS.yellow },
      { x: -15.5, z: -17.6, w: 1.6, d: 1.6, h: 2.8, color: LEGO_COLORS.red }
    ];

    crateConfigs.forEach((c) => {
      const crate = createLegoBrick(c.w, c.h, c.d, c.color, { studStep: 0.55 });
      crate.position.set(c.x, sidewalkY + c.h * 0.5, c.z);
      this.scene.add(crate);
      this.addCollider(c.x, c.z, c.w, c.d, sidewalkY + c.h);
    });
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
    // Movimento suave das nuvens de LEGO no céu
    for (const cloud of this.clouds) {
      cloud.position.x += dt * 0.8;
      if (cloud.position.x > 110) {
        cloud.position.x = -110;
      }
    }
  }
}

