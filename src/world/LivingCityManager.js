import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial
} from '../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from './VehicleFleetBuilder.js';
import { soundFX } from '../audio/SoundFX.js';

const NPC_HEAD_GEO = new THREE.CylinderGeometry(0.32, 0.32, 0.48, 16);
const NPC_TORSO_GEO = new THREE.BoxGeometry(0.7, 0.72, 0.38);
const NPC_ARM_GEO = new THREE.CylinderGeometry(0.11, 0.1, 0.52, 10);
NPC_ARM_GEO.translate(0, -0.22, 0);
const NPC_LEG_GEO = new THREE.BoxGeometry(0.3, 0.62, 0.34);
NPC_LEG_GEO.translate(0, -0.31, 0);
const NPC_BULLET_GEO = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6);
NPC_BULLET_GEO.rotateX(Math.PI / 2);

/**
 * GERENCIADOR DA CIDADE VIVA (PASSO 7):
 * 1) Trânsito Urbano Vivo (Carros Esportivos, Táxis, Carros-Fortes, Viaturas BOPE e Veículos de Facções andando pelas avenidas,
 *    parando quando o jogador entra na frente e 100% dirigíveis com [E] ou arremessáveis com o Titã!)
 * 2) Pedestres LEGO 3D nas calçadas (caminham tranquilamente e correm com os braços para cima gritando quando há tiroteio!)
 * 3) Polícia / BOPE patrulhando a cidade + Rádio do Comandante Caveira [G] (recruta policiais e chama Caveirão / Helicóptero Policial!)
 * 4) As 3 Facções Inimigas em seus territórios e fronteiras:
 *    - CV (Comando Vermelho): Soldados de fuzil, Motoqueiros, Picapes Artilhadas e Artilheiros de Bazuca RPG
 *    - PCC (Primeiro Comando): Soldados de balaclava, Especialistas de C4, SUVs Blindadas e Helicóptero de Assalto
 *    - A.R.E.S. (Cyber-Mercenários): Exoesqueletos Laser, Drones Voadores e Mechas Gigantes (Big-Fig)
 * 5) IA de Guerra Entre Facções: CV, PCC, A.R.E.S. e BOPE brigam e atiram uns nos outros automaticamente nas fronteiras!
 */
export class LivingCityManager {
  constructor(world, destructibles, hud) {
    this.world = world;
    this.scene = world.scene;
    this.destructibles = destructibles;
    this.hud = hud;

    this.trafficVehicles = [];
    this.pedestrians = [];
    this.combatNpcs = [];
    this.npcProjectiles = [];
    this.pccHeli = null;
    this.caveiraSupportCooldown = 0;
    this.caveiraCallToggle = 0;
    this.playerHitInvulnTimer = 0;
    this.playerRegenTimer = 0;

    this._initUrbanTraffic();
    this._initPedestrians();
    this._initFactionsAndPolice();
    this._initPccAssaultHelicopter();
  }

  // ============================================================================
  // 1. TRÂNSITO URBANO VIVO (SUBSTITUINDO OS CARROS ESTÁTICOS DO BANCO!)
  // ============================================================================
  _initUrbanTraffic() {
    // Todos os veículos que antes ficavam estáticos na frente do Super Banco agora circulam vivos pelas avenidas!
    const trafficSpecs = [
      // Avenida Central em frente ao Super Banco Central (Z = -117, mão Leste na faixa Z = -112 e mão Oeste na faixa Z = -122)
      { type: 'apex_gtx', color: 0xfacc15, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -85, dir: 1, minC: -490, maxC: 510 },
      { type: 'taxi_metro', color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -20, dir: 1, minC: -490, maxC: 510 },
      { type: 'interceptor_v8', color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 45, dir: 1, minC: -490, maxC: 510 },
      { type: 'carro_forte', color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 135, dir: 1, minC: -490, maxC: 510 },
      { type: 'cyber_blade', color: 0xcbd5e1, roofColor: 0x06b6d4, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -230, dir: 1, minC: -490, maxC: 510 },

      { type: 'vortex_roadster', color: 0xec4899, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 65, dir: -1, minC: -490, maxC: 510 },
      { type: 'caveirao_bope', color: 0x111827, roofColor: 0x111827, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -5, dir: -1, minC: -490, maxC: 510 },
      { type: 'trovao_v8', color: 0xf97316, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -95, dir: -1, minC: -490, maxC: 510 },
      { type: 'sedan_familiar', color: 0x3b82f6, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 210, dir: -1, minC: -490, maxC: 510 },
      { type: 'suv_pcc', color: 0x090a0d, roofColor: 0x1e3a8a, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 360, dir: -1, minC: -490, maxC: 510 },

      // Avenida Times Square / Parque Central (Z = 0)
      { type: 'choque_pickup', color: 0x334155, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: -160, dir: 1, minC: -490, maxC: 510 },
      { type: 'moto_policia', color: 0x111827, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: 30, dir: 1, minC: -490, maxC: 510 },
      { type: 'taxi_metro', color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: 110, dir: -1, minC: -490, maxC: 510 },
      { type: 'apex_gtx', color: 0xdc2626, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: -90, dir: -1, minC: -490, maxC: 510 },

      // Avenida Norte-Sul Oeste do Banco (X = -120)
      { type: 'sedan_familiar', color: 0x16a34a, roofColor: LEGO_COLORS.white, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: -220, dir: 1, minC: -680, maxC: 680 },
      { type: 'moto_cv', color: 0xdc2626, roofColor: LEGO_COLORS.black, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: -40, dir: 1, minC: -680, maxC: 680 },
      { type: 'picape_cv', color: 0x991b1b, roofColor: 0x1c1917, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: 90, dir: -1, minC: -680, maxC: 680 },
      { type: 'interceptor_v8', color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: -310, dir: -1, minC: -680, maxC: 680 },

      // Avenida Norte-Sul Leste do Banco (X = 120)
      { type: 'carro_forte', color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: -180, dir: 1, minC: -680, maxC: 680 },
      { type: 'van_pcc', color: 0x1e293b, roofColor: 0x0f172a, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: -30, dir: -1, minC: -680, maxC: 680 },
      { type: 'moto_pcc', color: 0x090a0d, roofColor: 0x1e3a8a, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: 180, dir: -1, minC: -680, maxC: 680 },
      { type: 'vortex_roadster', color: 0x2563eb, roofColor: LEGO_COLORS.white, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: 80, dir: 1, minC: -680, maxC: 680 },

      // Avenida da Torre dos Heróis (X = -252) & Avenida Leste (X = 252)
      { type: 'trovao_v8', color: 0xeab308, roofColor: LEGO_COLORS.black, axis: 'x_const', roadCoord: -252, laneOffset: -5.2, posAlong: -150, dir: 1, minC: -680, maxC: 680 },
      { type: 'hover_apc_ares', color: 0x475569, roofColor: 0x9333ea, axis: 'x_const', roadCoord: 252, laneOffset: 5.2, posAlong: 220, dir: -1, minC: -680, maxC: 680 },

      // Avenida Beira-Mar Sul (Z = 710) & Subúrbio Norte (Z = -512)
      { type: 'buggy_praia', color: 0xf97316, roofColor: 0x84cc16, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: -140, dir: 1, minC: -500, maxC: 500 },
      { type: 'cyber_blade', color: 0x06b6d4, roofColor: 0x090a0d, axis: 'z_const', roadCoord: 710, laneOffset: -5.2, posAlong: 160, dir: -1, minC: -500, maxC: 500 },
      { type: 'taxi_metro', color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, axis: 'z_const', roadCoord: -512, laneOffset: 5.2, posAlong: -80, dir: 1, minC: -490, maxC: 490 },
      { type: 'interceptor_v8', color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -512, laneOffset: -5.2, posAlong: 140, dir: -1, minC: -490, maxC: 490 }
    ];

    for (const cfg of trafficSpecs) {
      this._spawnTrafficVehicle(cfg);
    }
  }

  _spawnTrafficVehicle(cfg) {
    const spec = VEHICLE_SPECS[cfg.type] || VEHICLE_SPECS.sedan_familiar;
    const x = cfg.axis === 'z_const' ? cfg.posAlong : cfg.roadCoord + cfg.laneOffset;
    const z = cfg.axis === 'z_const' ? cfg.roadCoord + cfg.laneOffset : cfg.posAlong;
    const rotY = cfg.axis === 'z_const' ? (cfg.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (cfg.dir > 0 ? 0 : Math.PI);
    const yBase = this.world.getRoadElevation ? this.world.getRoadElevation(x, z) : 0;

    const carGroup = createLegoCarMesh({
      x,
      z,
      rotY,
      color: cfg.color,
      roofColor: cfg.roofColor,
      type: cfg.type
    });
    carGroup.position.set(x, yBase, z);
    carGroup.rotation.y = rotY;
    carGroup.userData.carType = cfg.type;
    carGroup.userData.carName = spec.name;
    carGroup.userData.vehicleSpec = spec;
    carGroup.userData.isTrafficVehicle = true;
    this.scene.add(carGroup);

    const isMoto = Boolean(spec.isMotorcycle);
    const baseW = isMoto ? 1.45 : 2.5;
    const baseD = isMoto ? 3.8 : 5.0;
    const isRotated90 = Math.abs(Math.sin(rotY)) > 0.7;
    const carWidth = isRotated90 ? baseD : baseW;
    const carDepth = isRotated90 ? baseW : baseD;

    const col1 = this.world.addCollider(x, z, carWidth, carDepth, yBase + 1.25, yBase);
    const col2 = this.world.addCollider(x, z, carWidth * 0.85, carDepth * 0.6, yBase + 2.05, yBase);

    let destructibleEntry = null;
    if (this.destructibles) {
      this.destructibles.registerDestructible({
        mesh: carGroup,
        type: 'car',
        hp: spec.hp,
        radius: Math.max(carWidth, carDepth) * 0.52,
        height: 2.1,
        colliders: [col1, col2],
        debrisColors: [cfg.color, cfg.roofColor, LEGO_COLORS.black, LEGO_COLORS.yellow],
        studDrops: spec.studDrops,
        groundY: yBase
      });
      destructibleEntry = this.destructibles.objects[this.destructibles.objects.length - 1];
    }

    const cruiseSpeed = Math.min(22.0, Math.max(13.5, (spec.kmh || 180) * 0.082));
    this.trafficVehicles.push({
      cfg,
      spec,
      mesh: carGroup,
      destructible: destructibleEntry,
      col1,
      col2,
      baseW,
      baseD,
      axis: cfg.axis,
      roadCoord: cfg.roadCoord,
      laneOffset: cfg.laneOffset,
      posAlong: cfg.posAlong,
      dir: cfg.dir,
      minC: cfg.minC,
      maxC: cfg.maxC,
      cruiseSpeed,
      currentSpeed: cruiseSpeed,
      hijackedByPlayer: false
    });
  }

  _updateUrbanTraffic(dt, playerPos) {
    for (const tv of this.trafficVehicles) {
      const obj = tv.destructible;
      if (!obj || obj.destroyed) continue;

      // Se o jogador entrou no carro ([E]) ou o Titã Blindado agarrou o carro, desativa o piloto automático de trânsito!
      if (obj.isDriven || obj.isGrabbed) {
        tv.hijackedByPlayer = true;
        continue;
      }
      if (tv.hijackedByPlayer) {
        // Carro foi deixado pelo jogador em outro ponto da cidade -> permanece estacionado onde o jogador deixou!
        continue;
      }

      const pos = tv.mesh.position;
      const fwdX = Math.sin(tv.mesh.rotation.y);
      const fwdZ = Math.cos(tv.mesh.rotation.y);

      // Verifica se o jogador ou outro veículo está logo à frente na mesma mão para frear!
      let obstacleAhead = false;
      if (playerPos) {
        const dxP = playerPos.x - pos.x;
        const dzP = playerPos.z - pos.z;
        const distAheadP = dxP * fwdX + dzP * fwdZ;
        const latDistP = Math.abs(dxP * fwdZ - dzP * fwdX);
        if (distAheadP > 1.2 && distAheadP < 15.5 && latDistP < 3.4 && Math.abs(playerPos.y - pos.y) < 4.0) {
          obstacleAhead = true;
        }
      }

      if (!obstacleAhead) {
        for (const other of this.trafficVehicles) {
          if (other === tv || !other.destructible || other.destructible.destroyed) continue;
          const oPos = other.mesh.position;
          const dxO = oPos.x - pos.x;
          const dzO = oPos.z - pos.z;
          const distAheadO = dxO * fwdX + dzO * fwdZ;
          const latDistO = Math.abs(dxO * fwdZ - dzO * fwdX);
          if (distAheadO > 2.0 && distAheadO < 14.0 && latDistO < 2.8) {
            obstacleAhead = true;
            break;
          }
        }
      }

      const targetSpeed = obstacleAhead ? 0 : tv.cruiseSpeed;
      const accelRate = obstacleAhead ? 38.0 : 14.0;
      tv.currentSpeed = THREE.MathUtils.lerp(tv.currentSpeed, targetSpeed, Math.min(1, dt * (accelRate / 10)));

      if (tv.currentSpeed > 0.05) {
        tv.posAlong += tv.dir * tv.currentSpeed * dt;
        if (tv.posAlong > tv.maxC) {
          tv.posAlong = tv.minC;
        } else if (tv.posAlong < tv.minC) {
          tv.posAlong = tv.maxC;
        }

        const nx = tv.axis === 'z_const' ? tv.posAlong : tv.roadCoord + tv.laneOffset;
        const nz = tv.axis === 'z_const' ? tv.roadCoord + tv.laneOffset : tv.posAlong;
        const ny = this.world.getRoadElevation ? this.world.getRoadElevation(nx, nz) : 0;

        tv.mesh.position.set(nx, ny, nz);
        obj.basePos.copy(tv.mesh.position);
        obj.baseRot.copy(tv.mesh.rotation);
        obj.groundY = ny;

        // Atualiza os colisores AABB junto com o veículo em movimento
        const isRotated90 = Math.abs(Math.sin(tv.mesh.rotation.y)) > 0.7;
        const w = isRotated90 ? tv.baseD : tv.baseW;
        const d = isRotated90 ? tv.baseW : tv.baseD;
        if (tv.col1) {
          tv.col1.minX = nx - w * 0.5;
          tv.col1.maxX = nx + w * 0.5;
          tv.col1.minZ = nz - d * 0.5;
          tv.col1.maxZ = nz + d * 0.5;
          tv.col1.minY = ny;
          tv.col1.maxY = ny + 1.25;
        }
        if (tv.col2) {
          tv.col2.minX = nx - w * 0.425;
          tv.col2.maxX = nx + w * 0.425;
          tv.col2.minZ = nz - d * 0.3;
          tv.col2.maxZ = nz + d * 0.3;
          tv.col2.minY = ny;
          tv.col2.maxY = ny + 2.05;
        }
      }
    }
  }

  // ============================================================================
  // 2. PEDESTRES CIVIS LEGO NAS CALÇADAS (CORREM EM PÂNICO NO TIROTEIO!)
  // ============================================================================
  _initPedestrians() {
    const shirtPalette = [0x2563eb, 0x16a34a, 0xd97706, 0x9333ea, 0x0891b2, 0xe11d48, 0xf8fafc];
    const pantsPalette = [0x1e293b, 0x334155, 0x1e3a8a, 0x3f3f46, 0x0f172a];

    const sidewalkRoutes = [
      // Calçada em frente ao Super Banco Central e Centro Financeiro
      { x1: -44, z1: -133, x2: 44, z2: -133 },
      { x1: 44, z1: -133, x2: -44, z2: -133 },
      { x1: -48, z1: -101, x2: 48, z2: -101 },
      { x1: 48, z1: -101, x2: -48, z2: -101 },
      { x1: -104, z1: -195, x2: -104, z2: -40 },
      { x1: 104, z1: -195, x2: 104, z2: -40 },
      // Times Square & Torre dos Heróis
      { x1: -236, z1: -101, x2: -136, z2: -101 },
      { x1: -136, z1: -15, x2: -40, z2: -15 },
      { x1: 20, z1: -15, x2: 104, z2: -15 },
      // Parque Central
      { x1: 25, z1: 18, x2: 105, z2: 18 },
      { x1: 140, z1: 18, x2: 235, z2: 18 },
      // Subúrbio Norte (Praça e Pizzaria)
      { x1: -90, z1: -528, x2: 90, z2: -528 },
      { x1: 20, z1: -662, x2: 105, z2: -662 },
      // Calçadão da Praia Sul
      { x1: -180, z1: 728, x2: -20, z2: 728 },
      { x1: 20, z1: 728, x2: 180, z2: 728 },
      { x1: -80, z1: 765, x2: 80, z2: 765 }
    ];

    sidewalkRoutes.forEach((rt, idx) => {
      for (const uStart of [0.22, 0.74]) {
        const shirtColor = shirtPalette[(idx + Math.round(uStart * 10)) % shirtPalette.length];
        const pantsColor = pantsPalette[idx % pantsPalette.length];
        const x = THREE.MathUtils.lerp(rt.x1, rt.x2, uStart);
        const z = THREE.MathUtils.lerp(rt.z1, rt.z2, uStart);
        const npcVisual = this._buildLegoNpcMesh({
          faction: 'civilian',
          headColor: LEGO_COLORS.yellow,
          torsoColor: shirtColor,
          legColor: pantsColor,
          hatColor: idx % 2 === 0 ? shirtColor : null
        });
        npcVisual.root.position.set(x, 0.28, z);
        this.scene.add(npcVisual.root);

        this.pedestrians.push({
          visual: npcVisual,
          x1: rt.x1,
          z1: rt.z1,
          x2: rt.x2,
          z2: rt.z2,
          dir: uStart < 0.5 ? 1 : -1,
          walkSpeed: 3.1 + (idx % 3) * 0.45,
          panicTimer: 0,
          panicDirX: 0,
          panicDirZ: 1,
          animTime: idx * 1.3
        });
      }
    });
  }

  /**
   * Faz todos os pedestres próximos (até 45m) fugirem gritando com os braços levantados quando há tiros/explosões!
   */
  triggerPedestrianPanicNear(origin, radius = 45.0) {
    for (const ped of this.pedestrians) {
      const pos = ped.visual.root.position;
      const dx = pos.x - origin.x;
      const dz = pos.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius) {
        ped.panicTimer = 6.5;
        const len = Math.max(0.1, dist);
        ped.panicDirX = dx / len;
        ped.panicDirZ = dz / len;
      }
    }
  }

  _updatePedestrians(dt, playerPos) {
    for (const ped of this.pedestrians) {
      const root = ped.visual.root;
      if (playerPos) {
        const dSq = (root.position.x - playerPos.x) ** 2 + (root.position.z - playerPos.z) ** 2;
        root.visible = dSq <= 340 * 340;
        if (!root.visible) continue;
      }

      ped.animTime += dt;
      let moveX = 0;
      let moveZ = 0;
      let speed = ped.walkSpeed;

      if (ped.panicTimer > 0) {
        ped.panicTimer -= dt;
        speed = 8.4; // Corre desesperado!
        moveX = ped.panicDirX;
        moveZ = ped.panicDirZ;
      } else {
        const targetX = ped.dir > 0 ? ped.x2 : ped.x1;
        const targetZ = ped.dir > 0 ? ped.z2 : ped.z1;
        const dx = targetX - root.position.x;
        const dz = targetZ - root.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.2) {
          ped.dir *= -1;
        } else {
          moveX = dx / dist;
          moveZ = dz / dist;
        }
      }

      root.position.x += moveX * speed * dt;
      root.position.z += moveZ * speed * dt;
      root.position.y = 0.28;
      if (Math.hypot(moveX, moveZ) > 0.01) {
        root.rotation.y = Math.atan2(moveX, moveZ);
      }

      // Animação articulada de caminhada ou fuga em pânico (braços levantados pro alto!)
      const swing = Math.sin(ped.animTime * (ped.panicTimer > 0 ? 15.0 : 7.0)) * (ped.panicTimer > 0 ? 0.85 : 0.48);
      ped.visual.leftLeg.rotation.x = swing;
      ped.visual.rightLeg.rotation.x = -swing;
      if (ped.panicTimer > 0) {
        ped.visual.leftArm.rotation.x = -2.65 + swing * 0.35;
        ped.visual.rightArm.rotation.x = -2.65 - swing * 0.35;
      } else {
        ped.visual.leftArm.rotation.x = -swing * 0.8;
        ped.visual.rightArm.rotation.x = swing * 0.8;
      }
    }
  }

  // ============================================================================
  // 3. AS 3 FACÇÕES INIMIGAS (CV, PCC, A.R.E.S.) + POLÍCIA / BOPE + ZONAS DE GUERRA!
  // ============================================================================
  _initFactionsAndPolice() {
    const spawns = [
      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 1: CENTRO FINANCEIRO / AVENIDA DO SUPER BANCO (BOPE vs PCC vs CV)
      // ------------------------------------------------------------------------
      { faction: 'police', role: 'bope_rifle', x: -18, z: -130, homeX: -18, homeZ: -130 },
      { faction: 'police', role: 'bope_rifle', x: 18, z: -130, homeX: 18, homeZ: -130 },
      { faction: 'police', role: 'bope_rifle', x: 68, z: -124, homeX: 68, homeZ: -124 },
      { faction: 'police', role: 'bope_rifle', x: 74, z: -124, homeX: 74, homeZ: -124 },
      { faction: 'pcc', role: 'pcc_smg', x: 96, z: -112, homeX: 96, homeZ: -112 },
      { faction: 'pcc', role: 'pcc_c4', x: 102, z: -120, homeX: 102, homeZ: -120 },
      { faction: 'cv', role: 'cv_rifle', x: 86, z: -98, homeX: 86, homeZ: -98 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 2: FRONTEIRA OESTE — ENTRADA DA CIDADE DE DEUS (CV vs BOPE vs A.R.E.S.)
      // ------------------------------------------------------------------------
      { faction: 'cv', role: 'cv_rifle', x: -508, z: -122, homeX: -508, homeZ: -122 },
      { faction: 'cv', role: 'cv_rpg', x: -514, z: -112, homeX: -514, homeZ: -112 },
      { faction: 'cv', role: 'cv_rifle', x: -506, z: -246, homeX: -506, homeZ: -246 },
      { faction: 'cv', role: 'cv_rpg', x: -514, z: -254, homeX: -514, homeZ: -254 },
      { faction: 'cv', role: 'cv_rifle', x: -565, z: -180, homeX: -565, homeZ: -180 },
      { faction: 'cv', role: 'cv_rifle', x: -475, z: -118, homeX: -475, homeZ: -118 },
      { faction: 'police', role: 'bope_rifle', x: -448, z: -120, homeX: -448, homeZ: -120 },
      { faction: 'police', role: 'bope_rifle', x: -444, z: -112, homeX: -444, homeZ: -112 },
      { faction: 'ares', role: 'ares_exo', x: -462, z: -96, homeX: -462, homeZ: -96 },
      { faction: 'ares', role: 'ares_drone', x: -458, z: -102, homeX: -458, homeZ: -102 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 3: FRONTEIRA LESTE — PONTE DO CENTRO FINANCEIRO & DISTRITO INDUSTRIAL (PCC vs CV vs BOPE)
      // ------------------------------------------------------------------------
      { faction: 'pcc', role: 'pcc_smg', x: 598, z: -122, homeX: 598, homeZ: -122 },
      { faction: 'pcc', role: 'pcc_c4', x: 604, z: -112, homeX: 604, homeZ: -112 },
      { faction: 'pcc', role: 'pcc_smg', x: 602, z: -248, homeX: 602, homeZ: -248 },
      { faction: 'pcc', role: 'pcc_c4', x: 610, z: -254, homeX: 610, homeZ: -254 },
      { faction: 'pcc', role: 'pcc_smg', x: 668, z: -315, homeX: 668, homeZ: -315 },
      { faction: 'pcc', role: 'pcc_smg', x: 685, z: -315, homeX: 685, homeZ: -315 },
      { faction: 'cv', role: 'cv_rifle', x: 514, z: -120, homeX: 514, homeZ: -120 },
      { faction: 'cv', role: 'cv_rpg', x: 508, z: -112, homeX: 508, homeZ: -112 },
      { faction: 'police', role: 'bope_rifle', x: 500, z: -126, homeX: 500, homeZ: -126 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 4: DIVISA INDUSTRIAL / PORTO LESTE (A.R.E.S. MECHAS & DRONES vs PCC vs CV)
      // ------------------------------------------------------------------------
      { faction: 'ares', role: 'ares_mecha', x: 775, z: 152, homeX: 775, homeZ: 152 },
      { faction: 'ares', role: 'ares_exo', x: 768, z: 160, homeX: 768, homeZ: 160 },
      { faction: 'ares', role: 'ares_drone', x: 782, z: 146, homeX: 782, homeZ: 146 },
      { faction: 'pcc', role: 'pcc_smg', x: 764, z: 118, homeX: 764, homeZ: 118 },
      { faction: 'pcc', role: 'pcc_c4', x: 774, z: 116, homeX: 774, homeZ: 116 },
      { faction: 'cv', role: 'cv_rpg', x: 752, z: 132, homeX: 752, homeZ: 132 },

      // Base Portuária da A.R.E.S. no Porto Leste & Base Militar Oeste
      { faction: 'ares', role: 'ares_mecha', x: 965, z: 590, homeX: 965, homeZ: 590 },
      { faction: 'ares', role: 'ares_exo', x: 952, z: 585, homeX: 952, homeZ: 585 },
      { faction: 'ares', role: 'ares_drone', x: 978, z: 585, homeX: 978, homeZ: 585 },
      { faction: 'ares', role: 'ares_mecha', x: -1140, z: 360, homeX: -1140, homeZ: 360 },
      { faction: 'ares', role: 'ares_drone', x: -1128, z: 350, homeX: -1128, homeZ: 350 },

      // Patrulhas Policiais na Praia Sul, Subúrbio Norte e Ponte da Prisão
      { faction: 'police', role: 'bope_rifle', x: 0, z: 702, homeX: 0, homeZ: 702 },
      { faction: 'police', role: 'bope_rifle', x: 185, z: -685, homeX: 185, homeZ: -685 },
      { faction: 'police', role: 'bope_rifle', x: 1368, z: 762, homeX: 1368, homeZ: 762 },
      { faction: 'pcc', role: 'pcc_smg', x: 1372, z: 795, homeX: 1372, homeZ: 795 }
    ];

    for (const sp of spawns) {
      this._spawnCombatNpc(sp);
    }
  }

  _spawnCombatNpc(sp) {
    const isMecha = sp.role === 'ares_mecha';
    const isDrone = sp.role === 'ares_drone';
    const visual = isDrone
      ? this._buildAresDroneMesh()
      : this._buildLegoNpcMesh({
          faction: sp.faction,
          role: sp.role,
          isMecha
        });

    const groundY = this.world.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(sp.x, sp.z)
      : 0.28;
    const baseY = isDrone ? groundY + 4.2 : groundY;
    visual.root.position.set(sp.x, baseY, sp.z);
    this.scene.add(visual.root);

    const maxHp = isMecha ? 260 : isDrone ? 75 : 65;
    const radius = isMecha ? 1.55 : isDrone ? 1.05 : 0.85;
    const height = isMecha ? 3.4 : isDrone ? 1.6 : 1.9;

    const debrisColors =
      sp.faction === 'cv'
        ? [0xdc2626, 0x090a0d, 0x7f1d1d]
        : sp.faction === 'pcc'
          ? [0x090a0d, 0x1d4ed8, 0x334155]
          : sp.faction === 'ares'
            ? [0x475569, 0xa855f7, 0xd946ef]
            : [0x090a0d, 0xfacc15, 0x334155];

    const studDrops = isMecha
      ? { silver: 4, gold: 8, blue: 4, purple: 1 }
      : { silver: 3, gold: 3, blue: 1, purple: 0 };

    let destructibleObj = null;
    if (this.destructibles) {
      this.destructibles.registerDestructible({
        mesh: visual.root,
        type: 'npc_fighter',
        hp: maxHp,
        radius,
        height,
        colliders: [],
        debrisColors,
        studDrops,
        groundY
      });
      destructibleObj = this.destructibles.objects[this.destructibles.objects.length - 1];
      destructibleObj.isCharacterNpc = true;
      destructibleObj.faction = sp.faction;
    }

    const npc = {
      faction: sp.faction,
      role: sp.role,
      isMecha,
      isDrone,
      visual,
      destructible: destructibleObj,
      homeX: sp.homeX,
      homeZ: sp.homeZ,
      moveSpeed: isMecha ? 4.8 : isDrone ? 8.2 : 6.2,
      fireCooldown: 0.4 + Math.random() * 1.1,
      fireInterval:
        sp.role === 'cv_rpg' || sp.role === 'pcc_c4'
          ? 2.6
          : isMecha
            ? 0.55
            : 0.72,
      attackRange: isMecha ? 54 : 46,
      isRecruitedByPlayer: false,
      animTime: Math.random() * 10
    };

    if (destructibleObj) {
      destructibleObj.onShattered = () => {
        npc.isRecruitedByPlayer = false;
        if (npc.visual.recruitRing) {
          npc.visual.recruitRing.visible = false;
        }
        // Respawn mais rápido (14s) nas fronteiras para manter a guerra urbana sempre viva!
        destructibleObj.respawnTimer = 14.0;
        destructibleObj.basePos.set(npc.homeX, baseY, npc.homeZ);
      };
    }

    this.combatNpcs.push(npc);
    return npc;
  }

  _buildAresDroneMesh() {
    const root = new THREE.Group();
    const steelMat = getLegoMaterial(0x334155, { metalness: 0.75, roughness: 0.2 });
    const neonPurple = getLegoMaterial(0xa855f7, {
      emissive: 0x9333ea,
      emissiveIntensity: 2.4,
      roughness: 0.1
    });
    const darkMat = getLegoMaterial(0x090a0d, { roughness: 0.3 });

    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.32, 8), steelMat);
    const eyeCore = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), neonPurple);
    eyeCore.position.set(0, -0.04, 0.42);
    const laserBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.48, 8), darkMat);
    laserBarrel.rotation.x = Math.PI / 2;
    laserBarrel.position.set(0, -0.18, 0.35);
    root.add(hull, eyeCore, laserBarrel);

    const rotors = [];
    for (const sx of [-0.58, 0.58]) {
      for (const sz of [-0.58, 0.58]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.55), steelMat);
        arm.position.set(sx * 0.6, 0.05, sz * 0.6);
        arm.rotation.y = Math.atan2(sx, sz);

        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 14), neonPurple);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(sx, 0.1, sz);

        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.07), darkMat);
        blade.position.set(sx, 0.11, sz);
        root.add(arm, ring, blade);
        rotors.push(blade);
      }
    }

    return { root, rotors, isDrone: true };
  }

  _buildLegoNpcMesh(cfg) {
    const root = new THREE.Group();
    const isMecha = Boolean(cfg.isMecha);
    if (isMecha) {
      root.scale.set(1.85, 1.75, 1.85);
    }

    const faction = cfg.faction || 'civilian';
    const headColor =
      cfg.headColor ??
      (faction === 'pcc'
        ? 0x090a0d
        : faction === 'ares'
          ? 0x334155
          : LEGO_COLORS.yellow);
    const torsoColor =
      cfg.torsoColor ??
      (faction === 'cv'
        ? 0xdc2626
        : faction === 'pcc'
          ? 0x090a0d
          : faction === 'ares'
            ? 0x475569
            : faction === 'police'
              ? 0x090a0d
              : 0x2563eb);
    const legColor =
      cfg.legColor ??
      (faction === 'cv'
        ? 0x1c1917
        : faction === 'pcc'
          ? 0x1e3a8a
          : faction === 'ares'
            ? 0x1e293b
            : 0x090a0d);

    const headMat = getLegoMaterial(headColor, { roughness: 0.22 });
    const torsoMat = getLegoMaterial(torsoColor, { roughness: 0.25 });
    const legMat = getLegoMaterial(legColor, { roughness: 0.26 });
    const blackMat = getLegoMaterial(0x090a0d, { roughness: 0.28 });

    // Pernas Articuladas
    const leftLeg = new THREE.Mesh(NPC_LEG_GEO, legMat);
    leftLeg.position.set(-0.18, 0.62, 0);
    const rightLeg = new THREE.Mesh(NPC_LEG_GEO, legMat);
    rightLeg.position.set(0.18, 0.62, 0);
    root.add(leftLeg, rightLeg);

    // Tronco LEGO
    const torso = new THREE.Mesh(NPC_TORSO_GEO, torsoMat);
    torso.position.set(0, 0.98, 0);
    root.add(torso);

    // Detalhe Tático no Peito por Facção
    if (faction === 'cv') {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.48, 0.42), blackMat);
      vest.position.set(0, 0.96, 0);
      const redBand = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.14, 0.44),
        getLegoMaterial(0xef4444, { emissive: 0x991b1b, emissiveIntensity: 0.4 })
      );
      redBand.position.set(0, 1.12, 0);
      root.add(vest, redBand);
    } else if (faction === 'pcc') {
      const bluePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.5, 0.42),
        getLegoMaterial(0x1d4ed8, { metalness: 0.35, roughness: 0.22 })
      );
      bluePlate.position.set(0, 0.98, 0);
      root.add(bluePlate);
    } else if (faction === 'ares') {
      const neonMat = getLegoMaterial(0xa855f7, { emissive: 0x9333ea, emissiveIntensity: 2.2 });
      const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.44), neonMat);
      chestCore.position.set(0, 1.02, 0);
      root.add(chestCore);
      if (isMecha) {
        for (const side of [-1, 1]) {
          const shoulderPod = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.48), torsoMat);
          shoulderPod.position.set(side * 0.52, 1.32, 0);
          root.add(shoulderPod);
        }
      }
    } else if (faction === 'police') {
      const goldBadge = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.42),
        getLegoMaterial(0xfacc15, { emissive: 0xd97706, emissiveIntensity: 0.5 })
      );
      goldBadge.position.set(0, 1.05, 0);
      root.add(goldBadge);
    }

    // Cabeça Cilíndrica LEGO + Pino Superior (Stud)
    const head = new THREE.Mesh(NPC_HEAD_GEO, headMat);
    head.position.set(0, 1.6, 0);
    const stud = new THREE.Mesh(SHARED_STUD_GEO, headMat);
    stud.position.set(0, 1.88, 0);
    root.add(head, stud);

    // Capacete / Boina / Visor por Facção
    if (faction === 'cv') {
      const redCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.16, 14),
        getLegoMaterial(0xdc2626)
      );
      redCap.position.set(0, 1.8, 0);
      root.add(redCap);
    } else if (faction === 'pcc') {
      const eyeVisor = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.1, 0.12),
        getLegoMaterial(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.5 })
      );
      eyeVisor.position.set(0, 1.62, 0.28);
      root.add(eyeVisor);
    } else if (faction === 'ares') {
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.14, 0.16),
        getLegoMaterial(0xd946ef, { emissive: 0xa855f7, emissiveIntensity: 2.5 })
      );
      visor.position.set(0, 1.62, 0.28);
      root.add(visor);
    } else if (faction === 'police') {
      const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.14, 14), blackMat);
      beret.position.set(-0.04, 1.82, 0);
      beret.rotation.z = 0.16;
      root.add(beret);
    }

    // Braços Articulados + Arma 3D na Mão Direita
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.44, 1.26, 0);
    leftArm.add(new THREE.Mesh(NPC_ARM_GEO, torsoMat));

    const rightArm = new THREE.Group();
    rightArm.position.set(0.44, 1.26, 0);
    rightArm.add(new THREE.Mesh(NPC_ARM_GEO, torsoMat));

    if (faction !== 'civilian') {
      rightArm.rotation.x = -Math.PI * 0.42;
      const gunLen = cfg.role === 'cv_rpg' ? 1.15 : isMecha ? 0.95 : 0.72;
      const gunColor =
        faction === 'ares' ? 0xa855f7 : cfg.role === 'cv_rpg' ? 0x3f6212 : 0x1e293b;
      const gunMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, gunLen),
        getLegoMaterial(gunColor, { roughness: 0.25 })
      );
      gunMesh.position.set(0, -0.44, 0.28);
      gunMesh.rotation.x = Math.PI * 0.42;
      rightArm.add(gunMesh);
    }

    root.add(leftArm, rightArm);

    // Anel Dourado nos pés para Policiais recrutados pelo Comandante Caveira [G]
    let recruitRing = null;
    if (faction === 'police') {
      const ringGeo = new THREE.TorusGeometry(0.62, 0.05, 8, 20);
      ringGeo.rotateX(Math.PI / 2);
      recruitRing = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      recruitRing.position.y = 0.08;
      recruitRing.visible = false;
      root.add(recruitRing);
    }

    return { root, leftLeg, rightLeg, leftArm, rightArm, recruitRing };
  }

  // ============================================================================
  // 4. HELICÓPTERO DE ASSALTO DO PCC (PATRULHA AÉREA E APOIO DE FOGO!)
  // ============================================================================
  _initPccAssaultHelicopter() {
    const heliGroup = new THREE.Group();
    const blackArmor = getLegoMaterial(0x090a0d, { roughness: 0.22, metalness: 0.45 });
    const pccBlue = getLegoMaterial(0x1d4ed8, { roughness: 0.2, metalness: 0.5 });
    const glassMat = getLegoMaterial(0x38bdf8, { roughness: 0.1, clearcoat: 0.9 });

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.1, 6.2), blackArmor);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.42, 5.8), pccBlue);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 2.2), glassMat);
    cockpit.position.set(0, 0.15, 2.4);
    const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 5.2), blackArmor);
    tailBoom.position.set(0, 0.35, -5.2);

    const mainRotor = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.08, 0.48), pccBlue);
    mainRotor.position.set(0, 1.35, 0);
    const crossRotor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 8.8), blackArmor);
    crossRotor.position.set(0, 1.37, 0);
    const rotorHub = new THREE.Group();
    rotorHub.add(mainRotor, crossRotor);

    heliGroup.add(fuselage, stripe, cockpit, tailBoom, rotorHub);
    heliGroup.position.set(560, 26.0, -117);
    this.scene.add(heliGroup);

    let destructibleObj = null;
    if (this.destructibles) {
      this.destructibles.registerDestructible({
        mesh: heliGroup,
        type: 'car',
        hp: 420,
        radius: 4.2,
        height: 3.2,
        colliders: [],
        debrisColors: [0x090a0d, 0x1d4ed8, 0x38bdf8],
        studDrops: { silver: 6, gold: 10, blue: 6, purple: 1 },
        groundY: 0.3
      });
      destructibleObj = this.destructibles.objects[this.destructibles.objects.length - 1];
      destructibleObj.faction = 'pcc';
    }

    this.pccHeli = {
      mesh: heliGroup,
      rotorHub,
      destructible: destructibleObj,
      orbitAngle: 0,
      centerX: 540,
      centerZ: -117,
      radiusX: 110,
      radiusZ: 75,
      fireCooldown: 1.5
    };
  }

  // ============================================================================
  // 5. COMANDO DE RÁDIO DO COMANDANTE CAVEIRA [G]: RECRUTA BOPE & CHAMA CAVEIRÃO/HELI!
  // ============================================================================
  triggerCaveiraRadioCommand(playerPos, facingAngle) {
    soundFX.playHeroSwap();
    let recruitedCount = 0;

    // 1. Recruta todos os policiais num raio de 65m para seguirem o Comandante Caveira
    for (const npc of this.combatNpcs) {
      if (npc.faction !== 'police' || !npc.destructible || npc.destructible.destroyed) continue;
      const d = Math.hypot(
        npc.visual.root.position.x - playerPos.x,
        npc.visual.root.position.z - playerPos.z
      );
      if (d <= 75.0) {
        npc.isRecruitedByPlayer = true;
        if (npc.visual.recruitRing) {
          npc.visual.recruitRing.visible = true;
        }
        recruitedCount++;
      }
    }

    // Se houver poucos policiais por perto, despacha 2 soldados de elite do BOPE imediatamente ao lado do Caveira!
    if (recruitedCount < 2) {
      for (const side of [-1, 1]) {
        const spawnX = playerPos.x + Math.cos(facingAngle) * side * 3.2 - Math.sin(facingAngle) * 2.5;
        const spawnZ = playerPos.z - Math.sin(facingAngle) * side * 3.2 - Math.cos(facingAngle) * 2.5;
        const newCop = this._spawnCombatNpc({
          faction: 'police',
          role: 'bope_rifle',
          x: spawnX,
          z: spawnZ,
          homeX: spawnX,
          homeZ: spawnZ
        });
        newCop.isRecruitedByPlayer = true;
        if (newCop.visual.recruitRing) {
          newCop.visual.recruitRing.visible = true;
        }
        recruitedCount++;
      }
    }

    // 2. Entrega Imediata de Apoio Veicular do BOPE (Alterna entre Caveirão Blindado e Interceptor V8)
    let vehicleLabel = 'ESQUADRÃO BOPE RECRUTADO';
    if (this.caveiraSupportCooldown <= 0) {
      this.caveiraSupportCooldown = 4.0;
      const dropX = playerPos.x + Math.sin(facingAngle) * 8.5;
      const dropZ = playerPos.z + Math.cos(facingAngle) * 8.5;
      const dropY = this.world.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(dropX, dropZ)
        : 0;
      const vType = this.caveiraCallToggle % 2 === 0 ? 'caveirao_bope' : 'interceptor_v8';
      this.caveiraCallToggle++;
      const spec = VEHICLE_SPECS[vType];

      const carMesh = createLegoCarMesh({
        x: dropX,
        z: dropZ,
        rotY: facingAngle,
        color: 0x111827,
        roofColor: vType === 'caveirao_bope' ? 0x111827 : LEGO_COLORS.white,
        type: vType
      });
      carMesh.position.set(dropX, dropY, dropZ);
      carMesh.rotation.y = facingAngle;
      carMesh.userData.carType = vType;
      carMesh.userData.carName = spec.name;
      carMesh.userData.vehicleSpec = spec;
      this.scene.add(carMesh);

      const col1 = this.world.addCollider(dropX, dropZ, 2.6, 5.2, dropY + 1.4, dropY);
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
        this.destructibles.spawnHeroSwapEffect(new THREE.Vector3(dropX, dropY + 0.5, dropZ), 0xfacc15);
      }
      vehicleLabel = vType === 'caveirao_bope' ? 'CAVEIRÃO DO BOPE ENTREGUE!' : 'INTERCEPTOR BOPE ENTREGUE!';
    }

    if (this.hud) {
      this.hud.setCharacterPortrait(
        'caveira',
        `COMANDANTE CAVEIRA [${recruitedCount} BOPE]`,
        `${vehicleLabel} • TROPA BOPE EM FORMAÇÃO TÁTICA!`
      );
    }
  }

  // ============================================================================
  // 6. IA DE GUERRA ENTRE FACÇÕES (CV vs PCC vs A.R.E.S. vs POLÍCIA vs JOGADOR)
  // ============================================================================
  _updateCombatNpcs(dt, playerPos, controller) {
    // Atualiza o Helicóptero de Assalto do PCC
    if (this.pccHeli && this.pccHeli.destructible && !this.pccHeli.destructible.destroyed) {
      const h = this.pccHeli;
      if (!h.destructible.isDriven && !h.destructible.isGrabbed) {
        h.orbitAngle += dt * 0.32;
        const hx = h.centerX + Math.cos(h.orbitAngle) * h.radiusX;
        const hz = h.centerZ + Math.sin(h.orbitAngle) * h.radiusZ;
        const nextX = h.centerX + Math.cos(h.orbitAngle + 0.05) * h.radiusX;
        const nextZ = h.centerZ + Math.sin(h.orbitAngle + 0.05) * h.radiusZ;
        h.mesh.position.set(hx, 26.0 + Math.sin(h.orbitAngle * 3.0) * 1.5, hz);
        h.mesh.rotation.y = Math.atan2(nextX - hx, nextZ - hz);
        h.destructible.basePos.copy(h.mesh.position);
        h.rotorHub.rotation.y += dt * 22.0;

        h.fireCooldown -= dt;
        if (h.fireCooldown <= 0 && playerPos) {
          const distToPlayer = Math.hypot(playerPos.x - hx, playerPos.z - hz);
          if (distToPlayer < 160) {
            const target = this._findBestTargetForPosition('pcc', h.mesh.position, 72.0, playerPos, controller);
            if (target) {
              h.fireCooldown = 1.05;
              this._fireNpcWeapon('pcc', 'pcc_smg', h.mesh.position.clone().add(new THREE.Vector3(0, -1.2, 0)), target.pos);
            }
          }
        }
      }
    }

    for (let i = 0; i < this.combatNpcs.length; i++) {
      const npc = this.combatNpcs[i];
      const obj = npc.destructible;
      if (!obj || obj.destroyed) continue;

      const root = npc.visual.root;
      if (playerPos) {
        const dSq = (root.position.x - playerPos.x) ** 2 + (root.position.z - playerPos.z) ** 2;
        root.visible = dSq <= 380 * 380;
        if (!root.visible) continue;
      }

      npc.animTime += dt;
      npc.fireCooldown = Math.max(0, npc.fireCooldown - dt);

      if (npc.isDrone && npc.visual.rotors) {
        for (const r of npc.visual.rotors) {
          r.rotation.y += dt * 28.0;
        }
      }

      // Busca o melhor alvo inimigo (Facções rivais brigam entre si e contra a Polícia/Jogador!)
      const target = this._findBestTargetForPosition(
        npc.faction,
        root.position,
        npc.attackRange,
        playerPos,
        controller
      );

      let moveDirX = 0;
      let moveDirZ = 0;
      let isMoving = false;

      if (npc.isRecruitedByPlayer && playerPos) {
        // Policial recrutado pelo Comandante Caveira acompanha o jogador mantendo formação!
        const dxP = playerPos.x - root.position.x;
        const dzP = playerPos.z - root.position.z;
        const distP = Math.hypot(dxP, dzP);
        if (distP > 6.5) {
          moveDirX = dxP / distP;
          moveDirZ = dzP / distP;
          isMoving = true;
        }
      } else if (target) {
        const dxT = target.pos.x - root.position.x;
        const dzT = target.pos.z - root.position.z;
        const distT = Math.hypot(dxT, dzT);
        if (distT > 16.0) {
          moveDirX = dxT / distT;
          moveDirZ = dzT / distT;
          isMoving = true;
        } else if (distT < 8.5) {
          moveDirX = -dxT / Math.max(0.1, distT);
          moveDirZ = -dzT / Math.max(0.1, distT);
          isMoving = true;
        }
      } else {
        // Patrulha suave ao redor do ponto de origem (homeX, homeZ)
        const patrolX = npc.homeX + Math.sin(npc.animTime * 0.55 + i) * 7.5;
        const patrolZ = npc.homeZ + Math.cos(npc.animTime * 0.45 + i) * 7.5;
        const dxH = patrolX - root.position.x;
        const dzH = patrolZ - root.position.z;
        const distH = Math.hypot(dxH, dzH);
        if (distH > 1.2) {
          moveDirX = dxH / distH;
          moveDirZ = dzH / distH;
          isMoving = true;
        }
      }

      if (isMoving) {
        const spd = npc.isRecruitedByPlayer ? 11.5 : npc.moveSpeed;
        root.position.x += moveDirX * spd * dt;
        root.position.z += moveDirZ * spd * dt;
      }

      const groundY = this.world.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(root.position.x, root.position.z)
        : 0.28;
      root.position.y = npc.isDrone
        ? groundY + 4.2 + Math.sin(npc.animTime * 3.2) * 0.35
        : Math.max(0.28, groundY);

      obj.basePos.copy(root.position);
      obj.groundY = groundY;

      if (target) {
        root.rotation.y = Math.atan2(target.pos.x - root.position.x, target.pos.z - root.position.z);
        if (npc.fireCooldown <= 0) {
          npc.fireCooldown = npc.fireInterval * (0.85 + Math.random() * 0.35);
          const muzzleOrigin = new THREE.Vector3(
            root.position.x + Math.sin(root.rotation.y) * 0.85,
            root.position.y + (npc.isMecha ? 2.1 : npc.isDrone ? 0.0 : 1.15),
            root.position.z + Math.cos(root.rotation.y) * 0.85
          );
          this._fireNpcWeapon(npc.faction, npc.role, muzzleOrigin, target.pos);
        }
      } else if (isMoving) {
        root.rotation.y = Math.atan2(moveDirX, moveDirZ);
      }

      // Animação de pernas das Minifiguras e Mechas
      if (!npc.isDrone && npc.visual.leftLeg && npc.visual.rightLeg) {
        const swing = isMoving ? Math.sin(npc.animTime * 9.0) * 0.55 : 0;
        npc.visual.leftLeg.rotation.x = swing;
        npc.visual.rightLeg.rotation.x = -swing;
      }
    }
  }

  _findBestTargetForPosition(myFaction, myPos, maxRange, playerPos, controller) {
    let bestTarget = null;
    let bestScore = maxRange;

    // 1. Checa todos os outros NPCs armados (CV, PCC, A.R.E.S. e Polícia brigam entre si!)
    for (const other of this.combatNpcs) {
      if (other.faction === myFaction || !other.destructible || other.destructible.destroyed) continue;
      const oPos = other.visual.root.position;
      const d = Math.hypot(oPos.x - myPos.x, oPos.z - myPos.z);
      if (d < bestScore) {
        bestScore = d;
        bestTarget = {
          type: 'npc',
          npc: other,
          pos: new THREE.Vector3(oPos.x, oPos.y + (other.isMecha ? 1.8 : 1.0), oPos.z)
        };
      }
    }

    // 2. Se for uma das 3 facções criminosas (CV, PCC, A.R.E.S.), também ataca o Jogador se estiver perto e visível!
    if (myFaction !== 'police' && playerPos && (!controller || !(controller.stealthTimer > 0))) {
      const dPlayer = Math.hypot(playerPos.x - myPos.x, playerPos.z - myPos.z);
      // Prioriza o jogador se estiver a menos de 28m ou se não houver rival mais perto
      if (dPlayer < Math.min(maxRange, bestScore + 6.0)) {
        bestTarget = {
          type: 'player',
          pos: new THREE.Vector3(playerPos.x, playerPos.y + 1.05, playerPos.z)
        };
      }
    }

    return bestTarget;
  }

  _fireNpcWeapon(faction, role, origin, targetPos) {
    // Dispara pânico nos pedestres próximos ao tiroteio!
    this.triggerPedestrianPanicNear(origin, 42.0);

    const dir = targetPos.clone().sub(origin);
    dir.x += (Math.random() - 0.5) * 1.1;
    dir.y += (Math.random() - 0.5) * 0.5;
    dir.z += (Math.random() - 0.5) * 1.1;
    dir.normalize();

    const isRpg = role === 'cv_rpg' || role === 'pcc_c4';
    const isLaser = faction === 'ares';
    const colorHex =
      faction === 'ares'
        ? 0xd946ef
        : faction === 'cv'
          ? 0xef4444
          : faction === 'pcc'
            ? 0x60a5fa
            : 0xfacc15;

    const projMat = new THREE.MeshBasicMaterial({ color: colorHex });
    const projMesh = new THREE.Mesh(NPC_BULLET_GEO, projMat);
    projMesh.scale.set(isRpg ? 2.4 : 1.3, isRpg ? 2.4 : 1.3, isLaser ? 2.6 : 1.8);
    projMesh.position.copy(origin);
    projMesh.lookAt(origin.clone().add(dir));
    this.scene.add(projMesh);

    const speed = isRpg ? 36.0 : isLaser ? 68.0 : 58.0;
    this.npcProjectiles.push({
      mesh: projMesh,
      faction,
      isRpg,
      vel: dir.multiplyScalar(speed),
      life: 1.35,
      damage: isRpg ? 28 : role === 'ares_mecha' ? 18 : 11
    });
  }

  _updateNpcProjectiles(dt, playerPos, controller) {
    for (let i = this.npcProjectiles.length - 1; i >= 0; i--) {
      const p = this.npcProjectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      let hit = false;

      // 1. Acertou um NPC rival (Guerra entre Facções / Polícia)?
      for (const npc of this.combatNpcs) {
        if (npc.faction === p.faction || !npc.destructible || npc.destructible.destroyed) continue;
        const nPos = npc.visual.root.position;
        const dH = Math.hypot(p.mesh.position.x - nPos.x, p.mesh.position.z - nPos.z);
        const dV = Math.abs(p.mesh.position.y - (nPos.y + 1.0));
        if (dH <= (npc.isMecha ? 1.6 : 0.95) && dV <= (npc.isMecha ? 2.2 : 1.3)) {
          if (p.isRpg && this.destructibles) {
            this.destructibles._triggerExplosion(p.mesh.position.clone(), 4.5, p.damage, false, false);
          } else if (this.destructibles) {
            this.destructibles.damageObject(npc.destructible, p.damage, p.mesh.position);
          }
          hit = true;
          break;
        }
      }

      // 2. Acertou o Jogador? (Apenas projéteis de CV, PCC e A.R.E.S.)
      if (!hit && p.faction !== 'police' && playerPos) {
        const dH = Math.hypot(p.mesh.position.x - playerPos.x, p.mesh.position.z - playerPos.z);
        const dV = Math.abs(p.mesh.position.y - (playerPos.y + 1.0));
        if (dH <= 0.95 && dV <= 1.25) {
          this._applyPlayerHitDamage(controller);
          hit = true;
        }
      }

      if (hit || p.life <= 0 || p.mesh.position.y <= 0.15) {
        this.scene.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
      }
    }
  }

  _applyPlayerHitDamage(controller) {
    if (!this.hud || this.playerHitInvulnTimer > 0) return;
    // Invulnerável durante rolamento tático, mergulho, invisibilidade ou dentro do Caveirão!
    if (
      controller &&
      (controller.stealthTimer > 0 ||
        controller.vingadorDiveTimer > 0 ||
        controller.minifigure?.rollTimer > 0)
    ) {
      return;
    }

    this.playerHitInvulnTimer = 1.35;
    this.playerRegenTimer = 5.5;
    const nextHearts = Math.max(1, (this.hud.hearts || 4) - 1);
    if (typeof this.hud.setHearts === 'function') {
      this.hud.setHearts(nextHearts);
    }
  }

  update(dt, playerPos, controller = null) {
    this.caveiraSupportCooldown = Math.max(0, this.caveiraSupportCooldown - dt);
    if (this.playerHitInvulnTimer > 0) {
      this.playerHitInvulnTimer = Math.max(0, this.playerHitInvulnTimer - dt);
    }
    if (this.playerRegenTimer > 0) {
      this.playerRegenTimer -= dt;
      if (this.playerRegenTimer <= 0 && this.hud && this.hud.hearts < this.hud.maxHearts) {
        if (typeof this.hud.setHearts === 'function') {
          this.hud.setHearts(this.hud.maxHearts);
        }
      }
    }

    this._updateUrbanTraffic(dt, playerPos);
    this._updatePedestrians(dt, playerPos);
    this._updateCombatNpcs(dt, playerPos, controller);
    this._updateNpcProjectiles(dt, playerPos, controller);
  }
}
