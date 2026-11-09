import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  getSharedNpcFaceMaterial
} from '../materials/LegoMaterials.js';
import { VEHICLE_SPECS, createLegoCarMesh } from './VehicleFleetBuilder.js';
import { soundFX } from '../audio/SoundFX.js';

const NPC_HEAD_GEO = new THREE.CylinderGeometry(0.32, 0.32, 0.48, 16);
const NPC_FACE_SHELL_GEO = new THREE.CylinderGeometry(
  0.324,
  0.324,
  0.43,
  18,
  1,
  true,
  -Math.PI * 0.45,
  Math.PI * 0.9
);
const NPC_TORSO_GEO = new THREE.BoxGeometry(0.7, 0.72, 0.38);
const NPC_ARM_GEO = new THREE.CylinderGeometry(0.11, 0.1, 0.52, 10);
NPC_ARM_GEO.translate(0, -0.22, 0);
const NPC_LEG_GEO = new THREE.BoxGeometry(0.3, 0.62, 0.34);
NPC_LEG_GEO.translate(0, -0.31, 0);
const NPC_BULLET_GEO = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6);
NPC_BULLET_GEO.rotateX(Math.PI / 2);

const HP_BAR_BG_GEO = new THREE.PlaneGeometry(1.12, 0.16);
const HP_BAR_FILL_GEO = new THREE.PlaneGeometry(1.04, 0.1);
HP_BAR_FILL_GEO.translate(0.52, 0, 0); // Ancorado à esquerda para escalar em X de 0 a 1

const MUZZLE_FLASH_GEO = new THREE.OctahedronGeometry(0.22, 0);

/**
 * GERENCIADOR DA CIDADE VIVA — UPGRADE MASSIVO (PASSO 7):
 * 1) Rostos LEGO Expressivos em 100% dos NPCs (4 rostos civis + pânico, CV de Juliet/Bandana/Corrente de Ouro, PCC de Balaclava, BOPE com pintura de guerra e A.R.E.S. Cyber)
 * 2) Alta Densidade Urbana (~78 Pedestres com Y dinâmico de terreno nas calçadas/praia/morro + ~78 Combatentes nas Zonas de Guerra e interiores da CDD, PCC e Porto)
 * 3) Trânsito Inteligente (~48 Veículos): Buzinas ao frear, Fuga em Pânico no tiroteio, Giroflex Policial piscando e Carjacking Estilo GTA ao roubar carro com [E]!
 * 4) Combate Sonoro Espacial, Clarão de Disparo (Muzzle Flash), Barras de HP Flutuantes 3D, Knockback Físico e Blips Vivos no Minimapa/Mapa [M]
 * 5) Eventos Dinâmicos ("Perseguição ao Carro-Forte" com ícone $ e chuva de Studs Roxos/Azuis) + Sistema de Escalada/Reforços de Elite das Facções (Nível 1 a 5)!
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

    // Zonas de Conflito Ativas exibidas no Minimapa e no Mapa [M]
    this.activeWarzones = [
      { id: 'wz_bank', x: 75, z: -117, label: 'CONFLITO: AVENIDA DO BANCO' },
      { id: 'wz_cdd', x: -485, z: -120, label: 'FRONTEIRA OESTE: CIDADE DE DEUS' },
      { id: 'wz_pcc_bridge', x: 560, z: -117, label: 'PONTE LESTE: TERRITÓRIO PCC' },
      { id: 'wz_ares_port', x: 770, z: 145, label: 'DIVISA DO PORTO: A.R.E.S. vs PCC' },
      { id: 'wz_prison', x: 1370, z: 780, label: 'PONTE BLINDADA DA PRISÃO' }
    ];

    // Estado de Rádio do Caveira e Dano do Jogador
    this.caveiraSupportCooldown = 0;
    this.caveiraCallToggle = 0;
    this.playerHitInvulnTimer = 0;
    this.playerRegenTimer = 0;
    this._npcGunSoundCooldown = 0;
    this._sirenPhase = 0;

    // Sistema de Escalada / Reforços de Facção (Nível de Procurado 1 a 5)
    this.factionKills = { cv: 0, pcc: 0, ares: 0 };
    this.factionHeatLevel = { cv: 0, pcc: 0, ares: 0 };
    this.reinforcementCooldown = 0;

    // Evento Dinâmico de Rua: Comboio do Carro-Forte Blindado ($)
    this.armoredConvoy = null;
    this.convoyRespawnTimer = 8.0;

    this._initUrbanTraffic();
    this._initPedestrians();
    this._initFactionsAndPolice();
    this._initPccAssaultHelicopter();
    this._spawnArmoredConvoyEvent();
  }

  // ============================================================================
  // 1. TRÂNSITO URBANO INTELIGENTE (~48 VEÍCULOS, BUZINAS, GIROFLEX & CARJACKING)
  // ============================================================================
  _initUrbanTraffic() {
    const trafficSpecs = [
      // 1. Avenida Central em frente ao Super Banco Central (Z = -117)
      { type: 'apex_gtx', color: 0xfacc15, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -110, dir: 1, minC: -490, maxC: 510 },
      { type: 'taxi_metro', color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -35, dir: 1, minC: -490, maxC: 510 },
      { type: 'interceptor_v8', color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 45, dir: 1, minC: -490, maxC: 510 },
      { type: 'carro_forte', color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 140, dir: 1, minC: -490, maxC: 510 },
      { type: 'cyber_blade', color: 0xcbd5e1, roofColor: 0x06b6d4, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -260, dir: 1, minC: -490, maxC: 510 },
      { type: 'sedan_familiar', color: 0x16a34a, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 310, dir: 1, minC: -490, maxC: 510 },

      { type: 'vortex_roadster', color: 0xec4899, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 75, dir: -1, minC: -490, maxC: 510 },
      { type: 'caveirao_bope', color: 0x111827, roofColor: 0x111827, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -5, dir: -1, minC: -490, maxC: 510 },
      { type: 'trovao_v8', color: 0xf97316, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -95, dir: -1, minC: -490, maxC: 510 },
      { type: 'sedan_familiar', color: 0x3b82f6, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 210, dir: -1, minC: -490, maxC: 510 },
      { type: 'suv_pcc', color: 0x090a0d, roofColor: 0x1e3a8a, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 360, dir: -1, minC: -490, maxC: 510 },
      { type: 'moto_policia', color: 0x111827, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -310, dir: -1, minC: -490, maxC: 510 },

      // 2. Avenida Times Square / Parque Central (Z = 0)
      { type: 'choque_pickup', color: 0x334155, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: -180, dir: 1, minC: -490, maxC: 510 },
      { type: 'moto_policia', color: 0x111827, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: 25, dir: 1, minC: -490, maxC: 510 },
      { type: 'vortex_roadster', color: 0x06b6d4, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: 240, dir: 1, minC: -490, maxC: 510 },
      { type: 'taxi_metro', color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: 110, dir: -1, minC: -490, maxC: 510 },
      { type: 'apex_gtx', color: 0xdc2626, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: -90, dir: -1, minC: -490, maxC: 510 },
      { type: 'interceptor_v8', color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: -320, dir: -1, minC: -490, maxC: 510 },

      // 3. Avenida Leste-Oeste Norte do Banco (Z = -252) & Sul do Parque (Z = 384)
      { type: 'sedan_familiar', color: 0xe11d48, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -252, laneOffset: 5.2, posAlong: -150, dir: 1, minC: -490, maxC: 510 },
      { type: 'suv_pcc', color: 0x090a0d, roofColor: 0x1e3a8a, axis: 'z_const', roadCoord: -252, laneOffset: -5.2, posAlong: 190, dir: -1, minC: -490, maxC: 510 },
      { type: 'taxi_metro', color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, axis: 'z_const', roadCoord: 384, laneOffset: 5.2, posAlong: -120, dir: 1, minC: -490, maxC: 510 },
      { type: 'trovao_v8', color: 0x8b5cf6, roofColor: LEGO_COLORS.black, axis: 'z_const', roadCoord: 384, laneOffset: -5.2, posAlong: 140, dir: -1, minC: -490, maxC: 510 },

      // 4. Avenida Norte-Sul Oeste do Banco (X = -120)
      { type: 'sedan_familiar', color: 0x16a34a, roofColor: LEGO_COLORS.white, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: -220, dir: 1, minC: -680, maxC: 680 },
      { type: 'moto_cv', color: 0xdc2626, roofColor: LEGO_COLORS.black, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: -40, dir: 1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: 260, dir: 1, minC: -680, maxC: 680 },
      { type: 'picape_cv', color: 0x991b1b, roofColor: 0x1c1917, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: 90, dir: -1, minC: -680, maxC: 680 },
      { type: 'interceptor_v8', color: LEGO_COLORS.black, roofColor: LEGO_COLORS.white, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: -310, dir: -1, minC: -680, maxC: 680 },
      { type: 'apex_gtx', color: 0x2563eb, roofColor: LEGO_COLORS.white, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: 420, dir: -1, minC: -680, maxC: 680 },

      // 5. Avenida Norte-Sul Leste do Banco (X = 120)
      { type: 'carro_forte', color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: -180, dir: 1, minC: -680, maxC: 680 },
      { type: 'vortex_roadster', color: 0x2563eb, roofColor: LEGO_COLORS.white, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: 80, dir: 1, minC: -680, maxC: 680 },
      { type: 'caveirao_bope', color: 0x111827, roofColor: 0x111827, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: 340, dir: 1, minC: -680, maxC: 680 },
      { type: 'van_pcc', color: 0x1e293b, roofColor: 0x0f172a, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: -30, dir: -1, minC: -680, maxC: 680 },
      { type: 'moto_pcc', color: 0x090a0d, roofColor: 0x1e3a8a, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: 180, dir: -1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0xf59e0b, roofColor: LEGO_COLORS.white, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: -380, dir: -1, minC: -680, maxC: 680 },

      // 6. Avenida da Torre dos Heróis (X = -252) & Avenida Leste (X = 252)
      { type: 'trovao_v8', color: 0xeab308, roofColor: LEGO_COLORS.black, axis: 'x_const', roadCoord: -252, laneOffset: -5.2, posAlong: -150, dir: 1, minC: -680, maxC: 680 },
      { type: 'choque_pickup', color: 0x334155, roofColor: LEGO_COLORS.black, axis: 'x_const', roadCoord: -252, laneOffset: 5.2, posAlong: 140, dir: -1, minC: -680, maxC: 680 },
      { type: 'hover_apc_ares', color: 0x475569, roofColor: 0x9333ea, axis: 'x_const', roadCoord: 252, laneOffset: 5.2, posAlong: 220, dir: -1, minC: -680, maxC: 680 },
      { type: 'cyber_blade', color: 0x06b6d4, roofColor: 0x090a0d, axis: 'x_const', roadCoord: 252, laneOffset: -5.2, posAlong: -190, dir: 1, minC: -680, maxC: 680 },

      // 7. Via Expressa Oeste / Entrada da CDD (X = -516) & Avenida Industrial Leste (X = 612)
      { type: 'picape_cv', color: 0xdc2626, roofColor: 0x090a0d, axis: 'x_const', roadCoord: -516, laneOffset: -5.2, posAlong: -220, dir: 1, minC: -620, maxC: 520 },
      { type: 'moto_cv', color: 0xef4444, roofColor: 0x090a0d, axis: 'x_const', roadCoord: -516, laneOffset: 5.2, posAlong: 80, dir: -1, minC: -620, maxC: 520 },
      { type: 'suv_pcc', color: 0x090a0d, roofColor: 0x1d4ed8, axis: 'x_const', roadCoord: 612, laneOffset: -5.2, posAlong: -240, dir: 1, minC: -580, maxC: 480 },
      { type: 'hover_apc_ares', color: 0x475569, roofColor: 0xa855f7, axis: 'x_const', roadCoord: 612, laneOffset: 5.2, posAlong: 160, dir: -1, minC: -580, maxC: 480 },

      // 8. Avenida Beira-Mar Sul (Z = 710) & Subúrbio Norte (Z = -512)
      { type: 'buggy_praia', color: 0xf97316, roofColor: 0x84cc16, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: -180, dir: 1, minC: -500, maxC: 500 },
      { type: 'buggy_praia', color: 0x06b6d4, roofColor: 0xfacc15, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: 90, dir: 1, minC: -500, maxC: 500 },
      { type: 'cyber_blade', color: 0x06b6d4, roofColor: 0x090a0d, axis: 'z_const', roadCoord: 710, laneOffset: -5.2, posAlong: 190, dir: -1, minC: -500, maxC: 500 },
      { type: 'taxi_metro', color: LEGO_COLORS.yellow, roofColor: LEGO_COLORS.yellow, axis: 'z_const', roadCoord: -512, laneOffset: 5.2, posAlong: -120, dir: 1, minC: -490, maxC: 490 },
      { type: 'sedan_familiar', color: 0x2563eb, roofColor: LEGO_COLORS.white, axis: 'z_const', roadCoord: -512, laneOffset: 5.2, posAlong: 160, dir: 1, minC: -490, maxC: 490 },
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

    const isPoliceVehicle = ['caveirao_bope', 'interceptor_v8', 'choque_pickup', 'moto_policia'].includes(cfg.type);
    const faction =
      cfg.type.includes('_cv') ? 'cv' :
      cfg.type.includes('_pcc') ? 'pcc' :
      cfg.type.includes('_ares') ? 'ares' :
      isPoliceVehicle ? 'police' : 'civilian';

    // Giroflex Policial 3D no teto das viaturas para piscar em tempo real!
    let sirenRedMesh = null;
    let sirenBlueMesh = null;
    if (isPoliceVehicle) {
      const sirenY = cfg.type === 'caveirao_bope' ? 2.58 : cfg.type === 'moto_policia' ? 1.42 : 1.98;
      const sirenZ = cfg.type === 'moto_policia' ? -1.15 : -0.15;
      sirenRedMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.16, 0.24),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      sirenRedMesh.position.set(-0.28, sirenY, sirenZ);
      sirenBlueMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.16, 0.24),
        new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
      );
      sirenBlueMesh.position.set(0.28, sirenY, sirenZ);
      carGroup.add(sirenRedMesh, sirenBlueMesh);
    }

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

    const cruiseSpeed = Math.min(22.5, Math.max(14.0, (spec.kmh || 180) * 0.082));
    const tvEntry = {
      cfg,
      spec,
      faction,
      isPoliceVehicle,
      sirenRedMesh,
      sirenBlueMesh,
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
      panicTimer: 0,
      hornCooldown: 0,
      hijackedByPlayer: false
    };
    this.trafficVehicles.push(tvEntry);
    return tvEntry;
  }

  /**
   * Quando tiroteio/explosão acontece perto de carros civis, eles aceleram em pânico!
   */
  triggerTrafficPanicNear(origin, radius = 32.0) {
    for (const tv of this.trafficVehicles) {
      if (tv.hijackedByPlayer || tv.isPoliceVehicle || tv.faction !== 'civilian') continue;
      if (!tv.destructible || tv.destructible.destroyed) continue;
      const d = Math.hypot(tv.mesh.position.x - origin.x, tv.mesh.position.z - origin.z);
      if (d <= radius) {
        tv.panicTimer = 6.0;
      }
    }
  }

  /**
   * CARJACKING ESTILO GTA: Quando o jogador rouba um carro em movimento com [E], ejeta o motorista pela porta esquerda!
   */
  _ejectDriverOnCarjack(tv, playerPos) {
    const pos = tv.mesh.position;
    const rotY = tv.mesh.rotation.y;
    // Porta esquerda do veículo
    const leftX = pos.x - Math.cos(rotY) * 2.2;
    const leftZ = pos.z + Math.sin(rotY) * 2.2;

    if (tv.faction === 'cv' || tv.faction === 'pcc' || tv.faction === 'ares' || tv.faction === 'police') {
      // Motorista armado de facção ou policial salta do veículo e entra em combate!
      const roleMap = {
        cv: 'cv_rifle',
        pcc: 'pcc_smg',
        ares: 'ares_exo',
        police: 'bope_rifle'
      };
      this._spawnCombatNpc({
        faction: tv.faction,
        role: roleMap[tv.faction] || 'cv_rifle',
        x: leftX,
        z: leftZ,
        homeX: leftX,
        homeZ: leftZ
      });
      if (tv.faction !== 'police') {
        soundFX.playNpcGunshot(tv.faction, false, 0.85);
      }
    } else {
      // Motorista civil sai em pânico com os braços levantados gritando!
      const shirtColors = [0x2563eb, 0x16a34a, 0xd97706, 0xe11d48];
      const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
      const npcVisual = this._buildLegoNpcMesh({
        faction: 'civilian',
        faceKey: 'civ_panic',
        headColor: LEGO_COLORS.yellow,
        torsoColor: shirtColor,
        legColor: 0x1e293b,
        styleIdx: 1
      });
      const groundY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(leftX, leftZ) : 0;
      npcVisual.root.position.set(leftX, Math.max(0.28, groundY + 0.28), leftZ);
      this.scene.add(npcVisual.root);

      const fleeAngle = Math.atan2(leftX - pos.x, leftZ - pos.z);
      this.pedestrians.push({
        visual: npcVisual,
        normalFaceKey: 'civ_smile',
        isPanickingFace: true,
        x1: leftX,
        z1: leftZ,
        x2: leftX + Math.sin(fleeAngle) * 45,
        z2: leftZ + Math.cos(fleeAngle) * 45,
        dir: 1,
        walkSpeed: 3.4,
        panicTimer: 8.5,
        panicDirX: Math.sin(fleeAngle),
        panicDirZ: Math.cos(fleeAngle),
        animTime: Math.random() * 5
      });
      soundFX.playCarHorn(0.85, false);
    }
  }

  _updateUrbanTraffic(dt, playerPos) {
    this._sirenPhase += dt * 11.0;
    const redOn = Math.sin(this._sirenPhase) > 0;

    for (const tv of this.trafficVehicles) {
      const obj = tv.destructible;
      if (!obj || obj.destroyed) continue;

      // Piscar giroflex vermelho/azul nas viaturas do BOPE/Polícia
      if (tv.isPoliceVehicle && tv.sirenRedMesh && tv.sirenBlueMesh) {
        tv.sirenRedMesh.scale.setScalar(redOn ? 1.25 : 0.75);
        tv.sirenBlueMesh.scale.setScalar(redOn ? 0.75 : 1.25);
        tv.sirenRedMesh.material.color.setHex(redOn ? 0xff2222 : 0x450a0a);
        tv.sirenBlueMesh.material.color.setHex(redOn ? 0x1e3a8a : 0x38bdf8);
      }

      tv.hornCooldown = Math.max(0, tv.hornCooldown - dt);
      tv.panicTimer = Math.max(0, tv.panicTimer - dt);

      // Se o jogador entrou no carro ([E]) ou o Titã Blindado agarrou o carro, ejeta o motorista na 1ª vez!
      if (obj.isDriven || obj.isGrabbed) {
        if (!tv.hijackedByPlayer) {
          tv.hijackedByPlayer = true;
          this._ejectDriverOnCarjack(tv, playerPos);
        }
        continue;
      }
      if (tv.hijackedByPlayer) {
        continue;
      }

      const pos = tv.mesh.position;
      const fwdX = Math.sin(tv.mesh.rotation.y);
      const fwdZ = Math.cos(tv.mesh.rotation.y);

      let obstacleAhead = false;
      let playerBlocking = false;
      if (playerPos) {
        const dxP = playerPos.x - pos.x;
        const dzP = playerPos.z - pos.z;
        const distAheadP = dxP * fwdX + dzP * fwdZ;
        const latDistP = Math.abs(dxP * fwdZ - dzP * fwdX);
        if (distAheadP > 1.2 && distAheadP < 16.0 && latDistP < 3.5 && Math.abs(playerPos.y - pos.y) < 4.5) {
          obstacleAhead = true;
          playerBlocking = true;
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

      // Buzina quando o jogador bloqueia a frente do veículo!
      if (playerBlocking && tv.hornCooldown <= 0 && playerPos) {
        const distToPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (distToPlayer < 42.0) {
          tv.hornCooldown = 2.8 + Math.random() * 1.8;
          soundFX.playCarHorn(1.0 - distToPlayer / 45.0, tv.isPoliceVehicle);
        }
      }

      const desiredCruise = tv.panicTimer > 0 ? tv.cruiseSpeed * 1.65 : tv.cruiseSpeed;
      const targetSpeed = obstacleAhead ? 0 : desiredCruise;
      const accelRate = obstacleAhead ? 38.0 : tv.panicTimer > 0 ? 24.0 : 14.0;
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
  // 2. PEDESTRES CIVIS LEGO (~78 PEDESTRES COM ROSTOS, CABELOS & Y DINÂMICO!)
  // ============================================================================
  _initPedestrians() {
    const shirtPalette = [0x2563eb, 0x16a34a, 0xd97706, 0x9333ea, 0x0891b2, 0xe11d48, 0xf8fafc, 0xf97316, 0xec4899];
    const pantsPalette = [0x1e293b, 0x334155, 0x1e3a8a, 0x3f3f46, 0x0f172a, 0x78350f];
    const faceVariants = ['civ_smile', 'civ_shades', 'civ_cool'];

    const sidewalkRoutes = [
      // 1. Calçadas do Super Banco Central e Centro Financeiro
      { x1: -44, z1: -133, x2: 44, z2: -133 },
      { x1: 44, z1: -133, x2: -44, z2: -133 },
      { x1: -48, z1: -101, x2: 48, z2: -101 },
      { x1: 48, z1: -101, x2: -48, z2: -101 },
      { x1: -104, z1: -195, x2: -104, z2: -40 },
      { x1: 104, z1: -195, x2: 104, z2: -40 },
      { x1: -136, z1: -195, x2: -136, z2: -40 },
      { x1: 136, z1: -195, x2: 136, z2: -40 },

      // 2. Times Square, Avenidas Centrais & Complexo da Torre dos Heróis
      { x1: -236, z1: -101, x2: -136, z2: -101 },
      { x1: -236, z1: -133, x2: -136, z2: -133 },
      { x1: -136, z1: -15, x2: -40, z2: -15 },
      { x1: 20, z1: -15, x2: 104, z2: -15 },
      { x1: -236, z1: -15, x2: -140, z2: -15 },
      { x1: 140, z1: -101, x2: 236, z2: -101 },
      { x1: 140, z1: -133, x2: 236, z2: -133 },

      // 3. Parque Central & Arredores do Lago
      { x1: 25, z1: 18, x2: 105, z2: 18 },
      { x1: 140, z1: 18, x2: 235, z2: 18 },
      { x1: -95, z1: 18, x2: -15, z2: 18 },
      { x1: 60, z1: 165, x2: 180, z2: 165 },
      { x1: 60, z1: 360, x2: 210, z2: 360 },

      // 4. Subúrbio Norte (Praça, Casas Coloridas, Pizzaria & Posto)
      { x1: -95, z1: -528, x2: 95, z2: -528 },
      { x1: -95, z1: -496, x2: 95, z2: -496 },
      { x1: 20, z1: -662, x2: 105, z2: -662 },
      { x1: -220, z1: -528, x2: -135, z2: -528 },
      { x1: 140, z1: -528, x2: 240, z2: -528 },
      { x1: -104, z1: -650, x2: -104, z2: -535 },

      // 5. Calçadão Turístico & Faixa de Areia da Praia Sul (Banhistas)
      { x1: -220, z1: 728, x2: -60, z2: 728 },
      { x1: -50, z1: 728, x2: 90, z2: 728 },
      { x1: 100, z1: 728, x2: 235, z2: 728 },
      { x1: -110, z1: 768, x2: 110, z2: 768 },
      { x1: -180, z1: 810, x2: -40, z2: 810 },
      { x1: 40, z1: 815, x2: 185, z2: 815 },

      // 6. Ruas e Ladeiras do Morro da Cidade de Deus (Com Altura Y Dinâmica!)
      { x1: -610, z1: -140, x2: -685, z2: -140 },
      { x1: -640, z1: -230, x2: -720, z2: -230 },
      { x1: -620, z1: -45, x2: -710, z2: -45 },
      { x1: -660, z1: 80, x2: -745, z2: 80 },

      // 7. Quebrada Leste / Distrito Industrial (Território PCC)
      { x1: 630, z1: -133, x2: 740, z2: -133 },
      { x1: 630, z1: -265, x2: 740, z2: -265 },
      { x1: 640, z1: -15, x2: 750, z2: -15 }
    ];

    sidewalkRoutes.forEach((rt, idx) => {
      for (const uStart of [0.22, 0.74]) {
        const variantSeed = idx * 2 + (uStart > 0.5 ? 1 : 0);
        const shirtColor = shirtPalette[variantSeed % shirtPalette.length];
        const pantsColor = pantsPalette[variantSeed % pantsPalette.length];
        const normalFaceKey = faceVariants[variantSeed % faceVariants.length];
        const x = THREE.MathUtils.lerp(rt.x1, rt.x2, uStart);
        const z = THREE.MathUtils.lerp(rt.z1, rt.z2, uStart);
        const terrainY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(x, z) : 0;

        const npcVisual = this._buildLegoNpcMesh({
          faction: 'civilian',
          faceKey: normalFaceKey,
          headColor: LEGO_COLORS.yellow,
          torsoColor: shirtColor,
          legColor: pantsColor,
          hatColor: variantSeed % 3 === 0 ? shirtColor : variantSeed % 3 === 1 ? 0x1e293b : null,
          styleIdx: variantSeed
        });
        npcVisual.root.position.set(x, Math.max(0.28, terrainY + 0.28), z);
        this.scene.add(npcVisual.root);

        this.pedestrians.push({
          visual: npcVisual,
          normalFaceKey,
          isPanickingFace: false,
          x1: rt.x1,
          z1: rt.z1,
          x2: rt.x2,
          z2: rt.z2,
          dir: uStart < 0.5 ? 1 : -1,
          walkSpeed: 3.1 + (variantSeed % 3) * 0.45,
          panicTimer: 0,
          panicDirX: 0,
          panicDirZ: 1,
          animTime: variantSeed * 0.9
        });
      }
    });
  }

  /**
   * Faz todos os pedestres e carros civis próximos fugirem em pânico quando há tiros/explosões!
   */
  triggerPedestrianPanicNear(origin, radius = 48.0) {
    this.triggerTrafficPanicNear(origin, Math.min(36.0, radius));
    for (const ped of this.pedestrians) {
      const pos = ped.visual.root.position;
      const dx = pos.x - origin.x;
      const dz = pos.z - origin.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius) {
        ped.panicTimer = 7.0;
        const len = Math.max(0.1, dist);
        ped.panicDirX = dx / len;
        ped.panicDirZ = dz / len;
        if (!ped.isPanickingFace && ped.visual.faceShell) {
          ped.isPanickingFace = true;
          ped.visual.faceShell.material = getSharedNpcFaceMaterial('civ_panic');
        }
      }
    }
  }

  _updatePedestrians(dt, playerPos) {
    for (const ped of this.pedestrians) {
      const root = ped.visual.root;
      if (playerPos) {
        const dSq = (root.position.x - playerPos.x) ** 2 + (root.position.z - playerPos.z) ** 2;
        root.visible = dSq <= 360 * 360;
        if (!root.visible) continue;
      }

      ped.animTime += dt;
      let moveX = 0;
      let moveZ = 0;
      let speed = ped.walkSpeed;

      if (ped.panicTimer > 0) {
        ped.panicTimer -= dt;
        speed = 8.6;
        moveX = ped.panicDirX;
        moveZ = ped.panicDirZ;
        if (ped.panicTimer <= 0 && ped.isPanickingFace && ped.visual.faceShell) {
          ped.isPanickingFace = false;
          ped.visual.faceShell.material = getSharedNpcFaceMaterial(ped.normalFaceKey || 'civ_smile');
        }
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

      // Correção de altura Y seguindo pontes, rampas e o Morro da Cidade de Deus!
      const terrainY = this.world.getTerrainHeightAt
        ? this.world.getTerrainHeightAt(root.position.x, root.position.z)
        : 0;
      root.position.y = Math.max(0.28, terrainY + 0.28);

      if (Math.hypot(moveX, moveZ) > 0.01) {
        root.rotation.y = Math.atan2(moveX, moveZ);
      }

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
  // 3. AS 3 FACÇÕES INIMIGAS (CV, PCC, A.R.E.S.) + POLÍCIA / BOPE (~78 TROPAS)
  // ============================================================================
  _initFactionsAndPolice() {
    const spawns = [
      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 1: CENTRO FINANCEIRO / AVENIDA DO SUPER BANCO (BOPE vs PCC vs CV)
      // ------------------------------------------------------------------------
      { faction: 'police', role: 'bope_rifle', x: -18, z: -130, homeX: -18, homeZ: -130 },
      { faction: 'police', role: 'bope_rifle', x: 18, z: -130, homeX: 18, homeZ: -130 },
      { faction: 'police', role: 'bope_rifle', x: 64, z: -124, homeX: 64, homeZ: -124 },
      { faction: 'police', role: 'bope_rifle', x: 72, z: -124, homeX: 72, homeZ: -124 },
      { faction: 'police', role: 'bope_rifle', x: 68, z: -108, homeX: 68, homeZ: -108 },
      { faction: 'pcc', role: 'pcc_smg', x: 94, z: -112, homeX: 94, homeZ: -112 },
      { faction: 'pcc', role: 'pcc_c4', x: 102, z: -120, homeX: 102, homeZ: -120 },
      { faction: 'pcc', role: 'pcc_smg', x: 108, z: -106, homeX: 108, homeZ: -106 },
      { faction: 'cv', role: 'cv_rifle', x: 86, z: -96, homeX: 86, homeZ: -96 },
      { faction: 'cv', role: 'cv_rpg', x: 92, z: -92, homeX: 92, homeZ: -92 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 2: FRONTEIRA OESTE — ENTRADA DA CIDADE DE DEUS (CV vs BOPE vs A.R.E.S.)
      // ------------------------------------------------------------------------
      { faction: 'cv', role: 'cv_rifle', x: -508, z: -122, homeX: -508, homeZ: -122 },
      { faction: 'cv', role: 'cv_rpg', x: -514, z: -112, homeX: -514, homeZ: -112 },
      { faction: 'cv', role: 'cv_rifle', x: -506, z: -246, homeX: -506, homeZ: -246 },
      { faction: 'cv', role: 'cv_rpg', x: -514, z: -254, homeX: -514, homeZ: -254 },
      { faction: 'cv', role: 'cv_rifle', x: -475, z: -118, homeX: -475, homeZ: -118 },
      { faction: 'police', role: 'bope_rifle', x: -448, z: -120, homeX: -448, homeZ: -120 },
      { faction: 'police', role: 'bope_rifle', x: -444, z: -112, homeX: -444, homeZ: -112 },
      { faction: 'police', role: 'bope_rifle', x: -452, z: -246, homeX: -452, homeZ: -246 },
      { faction: 'ares', role: 'ares_exo', x: -462, z: -96, homeX: -462, homeZ: -96 },
      { faction: 'ares', role: 'ares_drone', x: -458, z: -102, homeX: -458, homeZ: -102 },

      // ------------------------------------------------------------------------
      // INTERIOR DO MORRO DA CIDADE DE DEUS (5 NÍVEIS DE TROPAS E OLHEIROS DO CV!)
      // ------------------------------------------------------------------------
      { faction: 'cv', role: 'cv_rifle', x: -585, z: -140, homeX: -585, homeZ: -140 },
      { faction: 'cv', role: 'cv_rpg', x: -612, z: -125, homeX: -612, homeZ: -125 },
      { faction: 'cv', role: 'cv_rifle', x: -648, z: -135, homeX: -648, homeZ: -135 },
      { faction: 'cv', role: 'cv_rpg', x: -692, z: -138, homeX: -692, homeZ: -138 },
      { faction: 'cv', role: 'cv_rifle', x: -735, z: -135, homeX: -735, homeZ: -135 },
      { faction: 'cv', role: 'cv_rpg', x: -780, z: -142, homeX: -780, homeZ: -142 },
      { faction: 'cv', role: 'cv_rifle', x: -835, z: -130, homeX: -835, homeZ: -130 },
      { faction: 'cv', role: 'cv_rpg', x: -885, z: -120, homeX: -885, homeZ: -120 },
      { faction: 'cv', role: 'cv_rifle', x: -635, z: -245, homeX: -635, homeZ: -245 },
      { faction: 'cv', role: 'cv_rpg', x: -705, z: -250, homeX: -705, homeZ: -250 },
      { faction: 'cv', role: 'cv_rifle', x: -640, z: -35, homeX: -640, homeZ: -35 },
      { faction: 'cv', role: 'cv_rpg', x: -715, z: -25, homeX: -715, homeZ: -25 },
      { faction: 'cv', role: 'cv_rifle', x: -670, z: 95, homeX: -670, homeZ: 95 },
      { faction: 'cv', role: 'cv_rpg', x: -740, z: 110, homeX: -740, homeZ: 110 },
      { faction: 'cv', role: 'cv_rifle', x: -650, z: -420, homeX: -650, homeZ: -420 },
      { faction: 'cv', role: 'cv_rpg', x: -720, z: -440, homeX: -720, homeZ: -440 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 3 & INTERIOR DA QUEBRADA LESTE (DOMÍNIO DO PCC vs CV vs BOPE)
      // ------------------------------------------------------------------------
      { faction: 'pcc', role: 'pcc_smg', x: 598, z: -122, homeX: 598, homeZ: -122 },
      { faction: 'pcc', role: 'pcc_c4', x: 604, z: -112, homeX: 604, homeZ: -112 },
      { faction: 'pcc', role: 'pcc_smg', x: 602, z: -248, homeX: 602, homeZ: -248 },
      { faction: 'pcc', role: 'pcc_c4', x: 610, z: -254, homeX: 610, homeZ: -254 },
      { faction: 'cv', role: 'cv_rifle', x: 514, z: -120, homeX: 514, homeZ: -120 },
      { faction: 'cv', role: 'cv_rpg', x: 508, z: -112, homeX: 508, homeZ: -112 },
      { faction: 'police', role: 'bope_rifle', x: 500, z: -126, homeX: 500, homeZ: -126 },
      { faction: 'police', role: 'bope_rifle', x: 496, z: -248, homeX: 496, homeZ: -248 },

      // Quadras e Galpões Internos do PCC no Leste
      { faction: 'pcc', role: 'pcc_smg', x: 668, z: -315, homeX: 668, homeZ: -315 },
      { faction: 'pcc', role: 'pcc_c4', x: 685, z: -315, homeX: 685, homeZ: -315 },
      { faction: 'pcc', role: 'pcc_smg', x: 735, z: -245, homeX: 735, homeZ: -245 },
      { faction: 'pcc', role: 'pcc_c4', x: 750, z: -120, homeX: 750, homeZ: -120 },
      { faction: 'pcc', role: 'pcc_smg', x: 680, z: -115, homeX: 680, homeZ: -115 },
      { faction: 'pcc', role: 'pcc_smg', x: 820, z: -185, homeX: 820, homeZ: -185 },
      { faction: 'pcc', role: 'pcc_c4', x: 840, z: -195, homeX: 840, homeZ: -195 },
      { faction: 'pcc', role: 'pcc_smg', x: 710, z: -15, homeX: 710, homeZ: -15 },
      { faction: 'pcc', role: 'pcc_c4', x: 790, z: -410, homeX: 790, homeZ: -410 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 4 & PORTO DE CONTÊINERES / BASE MILITAR (DOMÍNIO DA A.R.E.S.)
      // ------------------------------------------------------------------------
      { faction: 'ares', role: 'ares_mecha', x: 775, z: 152, homeX: 775, homeZ: 152 },
      { faction: 'ares', role: 'ares_exo', x: 768, z: 160, homeX: 768, homeZ: 160 },
      { faction: 'ares', role: 'ares_drone', x: 782, z: 146, homeX: 782, homeZ: 146 },
      { faction: 'pcc', role: 'pcc_smg', x: 764, z: 118, homeX: 764, homeZ: 118 },
      { faction: 'pcc', role: 'pcc_c4', x: 774, z: 116, homeX: 774, homeZ: 116 },
      { faction: 'cv', role: 'cv_rpg', x: 752, z: 132, homeX: 752, homeZ: 132 },

      // Interior do Porto Leste (Guindastes, Pátio de Contêineres e Doca A.R.E.S.)
      { faction: 'ares', role: 'ares_mecha', x: 965, z: 590, homeX: 965, homeZ: 590 },
      { faction: 'ares', role: 'ares_exo', x: 952, z: 585, homeX: 952, homeZ: 585 },
      { faction: 'ares', role: 'ares_drone', x: 978, z: 585, homeX: 978, homeZ: 585 },
      { faction: 'ares', role: 'ares_exo', x: 1060, z: 340, homeX: 1060, homeZ: 340 },
      { faction: 'ares', role: 'ares_drone', x: 1080, z: 350, homeX: 1080, homeZ: 350 },
      { faction: 'ares', role: 'ares_mecha', x: 1190, z: 460, homeX: 1190, homeZ: 460 },
      { faction: 'ares', role: 'ares_exo', x: 1175, z: 450, homeX: 1175, homeZ: 450 },

      // Base Militar Oeste & Aeroporto
      { faction: 'ares', role: 'ares_mecha', x: -1140, z: 360, homeX: -1140, homeZ: 360 },
      { faction: 'ares', role: 'ares_drone', x: -1128, z: 350, homeX: -1128, homeZ: 350 },
      { faction: 'ares', role: 'ares_exo', x: -1155, z: 375, homeX: -1155, homeZ: 375 },
      { faction: 'ares', role: 'ares_exo', x: -1240, z: -210, homeX: -1240, homeZ: -210 },
      { faction: 'ares', role: 'ares_drone', x: -1225, z: -195, homeX: -1225, homeZ: -195 },

      // Patrulhas Policiais e Confronto na Ponte da Prisão
      { faction: 'police', role: 'bope_rifle', x: 0, z: 702, homeX: 0, homeZ: 702 },
      { faction: 'police', role: 'bope_rifle', x: 185, z: -685, homeX: 185, homeZ: -685 },
      { faction: 'police', role: 'bope_rifle', x: -180, z: -15, homeX: -180, homeZ: -15 },
      { faction: 'police', role: 'bope_rifle', x: 1368, z: 762, homeX: 1368, homeZ: 762 },
      { faction: 'police', role: 'bope_rifle', x: 1380, z: 762, homeX: 1380, homeZ: 762 },
      { faction: 'pcc', role: 'pcc_smg', x: 1372, z: 795, homeX: 1372, homeZ: 795 },
      { faction: 'pcc', role: 'pcc_c4', x: 1382, z: 802, homeX: 1382, homeZ: 802 }
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
    const baseY = isDrone ? groundY + 4.2 : Math.max(0.28, groundY);
    visual.root.position.set(sp.x, baseY, sp.z);
    this.scene.add(visual.root);

    // Barra de HP 3D Flutuante acima da cabeça (Invisível com 100% de HP, aparece ao tomar dano!)
    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, isMecha ? 2.25 : isDrone ? 0.95 : 2.35, 0);
    hpBarGroup.visible = false;
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x090a0d, side: THREE.DoubleSide });
    const bgMesh = new THREE.Mesh(HP_BAR_BG_GEO, bgMat);
    const fillColor =
      sp.faction === 'ares' ? 0xd946ef : sp.faction === 'police' ? 0x38bdf8 : 0x22c55e;
    const fillMat = new THREE.MeshBasicMaterial({ color: fillColor, side: THREE.DoubleSide });
    const fillMesh = new THREE.Mesh(HP_BAR_FILL_GEO, fillMat);
    fillMesh.position.set(-0.52, 0, 0.01);
    hpBarGroup.add(bgMesh, fillMesh);
    visual.root.add(hpBarGroup);
    visual.hpBarGroup = hpBarGroup;
    visual.hpFillMesh = fillMesh;
    visual.hpFillMat = fillMat;

    const maxHp = isMecha ? 260 : isDrone ? 75 : 65;
    const radius = isMecha ? 1.55 : isDrone ? 1.05 : 0.85;
    const height = isMecha ? 3.4 : isDrone ? 1.6 : 1.9;

    const debrisColors =
      sp.faction === 'cv'
        ? [0xdc2626, 0x090a0d, 0xfacc15]
        : sp.faction === 'pcc'
          ? [0x090a0d, 0x1d4ed8, 0x38bdf8]
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
      destructibleObj.isCombatNpc = true;
      destructibleObj.faction = sp.faction;
    }

    const npc = {
      faction: sp.faction,
      role: sp.role,
      isMecha,
      isDrone,
      isBigFig: isMecha,
      visual,
      destructible: destructibleObj,
      destructibleObj,
      x: sp.x,
      z: sp.z,
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
      hitFlashTimer: 0,
      muzzleFlashTimer: 0,
      knockbackVelX: 0,
      knockbackVelZ: 0,
      animTime: Math.random() * 10
    };

    if (destructibleObj) {
      // Ao sofrer dano: exibe barra de HP 3D + aplica Knockback físico e flash de impacto!
      destructibleObj.onDamaged = (amount, hitOrigin) => {
        npc.hitFlashTimer = 0.14;
        if (npc.visual.hpBarGroup && npc.visual.hpFillMesh) {
          npc.visual.hpBarGroup.visible = true;
          const ratio = Math.max(0.04, Math.min(1, destructibleObj.hp / destructibleObj.maxHp));
          npc.visual.hpFillMesh.scale.x = ratio;
          if (!npc.isMecha) {
            npc.visual.hpFillMat.color.setHex(ratio < 0.35 ? 0xef4444 : ratio < 0.65 ? 0xfacc15 : 0x22c55e);
          }
        }
        if (hitOrigin) {
          const dx = visual.root.position.x - hitOrigin.x;
          const dz = visual.root.position.z - hitOrigin.z;
          const len = Math.max(0.1, Math.hypot(dx, dz));
          const pushForce = npc.isMecha ? 4.5 : 9.5;
          npc.knockbackVelX = (dx / len) * pushForce;
          npc.knockbackVelZ = (dz / len) * pushForce;
        }
      };

      destructibleObj.onShattered = () => {
        npc.isRecruitedByPlayer = false;
        if (npc.visual.recruitRing) {
          npc.visual.recruitRing.visible = false;
        }
        if (npc.visual.hpBarGroup) {
          npc.visual.hpBarGroup.visible = false;
        }
        destructibleObj.respawnTimer = 14.0;
        destructibleObj.basePos.set(npc.homeX, baseY, npc.homeZ);

        // Registra eliminação para o Sistema de Escalada / Reforços de Elite da Facção!
        if (npc.faction === 'cv' || npc.faction === 'pcc' || npc.faction === 'ares') {
          this._recordFactionKillForEscalation(npc.faction, visual.root.position);
        }
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

    const muzzleFlashMesh = new THREE.Mesh(
      MUZZLE_FLASH_GEO,
      new THREE.MeshBasicMaterial({ color: 0xf5d0fe })
    );
    muzzleFlashMesh.position.set(0, -0.18, 0.65);
    muzzleFlashMesh.visible = false;

    root.add(hull, eyeCore, laserBarrel, muzzleFlashMesh);

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

    return { root, rotors, muzzleFlashMesh, isDrone: true };
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
    const goldMat = getLegoMaterial(0xfacc15, { metalness: 0.65, roughness: 0.18 });

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

    // Detalhe Tático no Peito por Facção / Mochila Civil
    if (faction === 'cv') {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.48, 0.42), blackMat);
      vest.position.set(0, 0.96, 0);
      const redBand = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.14, 0.44),
        getLegoMaterial(0xef4444, { emissive: 0x991b1b, emissiveIntensity: 0.4 })
      );
      redBand.position.set(0, 1.12, 0);
      // Corrente de Ouro Grossa 3D no Pescoço do Soldado do CV!
      const goldChain = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 8, 16), goldMat);
      goldChain.rotation.x = Math.PI * 0.42;
      goldChain.position.set(0, 1.32, 0.06);
      root.add(vest, redBand, goldChain);
    } else if (faction === 'pcc') {
      const bluePlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.5, 0.42),
        getLegoMaterial(0x1d4ed8, { metalness: 0.35, roughness: 0.22 })
      );
      bluePlate.position.set(0, 0.98, 0);
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.46), blackMat);
      pouch.position.set(0, 0.84, 0);
      root.add(bluePlate, pouch);
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
      const bopeVest = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.52, 0.42), blackMat);
      bopeVest.position.set(0, 0.98, 0);
      const goldBadge = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.45),
        goldMat
      );
      goldBadge.position.set(0.14, 1.06, 0);
      root.add(bopeVest, goldBadge);
    } else if ((cfg.styleIdx || 0) % 2 === 0) {
      // Mochila 3D nas costas de pedestres civis
      const backpack = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.5, 0.22),
        getLegoMaterial((cfg.styleIdx || 0) % 4 === 0 ? 0xd97706 : 0x1e293b)
      );
      backpack.position.set(0, 1.02, -0.28);
      root.add(backpack);
    }

    // Cabeça Cilíndrica LEGO + Rosto Texturizado em 100% dos NPCs!
    const head = new THREE.Mesh(NPC_HEAD_GEO, headMat);
    head.position.set(0, 1.6, 0);
    const stud = new THREE.Mesh(SHARED_STUD_GEO, headMat);
    stud.position.set(0, 1.88, 0);

    const resolvedFaceKey =
      cfg.faceKey ||
      (faction === 'cv'
        ? 'cv_juliet'
        : faction === 'pcc'
          ? 'pcc_balaclava'
          : faction === 'ares'
            ? 'ares_cyber'
            : faction === 'police'
              ? 'bope_tactical'
              : 'civ_smile');
    const faceShell = new THREE.Mesh(
      NPC_FACE_SHELL_GEO,
      getSharedNpcFaceMaterial(resolvedFaceKey)
    );
    faceShell.position.set(0, 1.6, 0);
    root.add(head, faceShell, stud);

    // Capacete / Boina / Bandana / Cabelo / Boné por Facção e Estilo Civil
    if (faction === 'cv') {
      const bandanaMat = getLegoMaterial(0xdc2626);
      const redBandana = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.14, 14), bandanaMat);
      redBandana.position.set(0, 1.78, 0);
      const knot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), bandanaMat);
      knot.position.set(0, 1.74, -0.34);
      root.add(redBandana, knot);
    } else if (faction === 'pcc') {
      const hoodCap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 14), blackMat);
      hoodCap.position.set(0, 1.8, 0);
      root.add(hoodCap);
    } else if (faction === 'ares') {
      const helmetTop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.68), torsoMat);
      helmetTop.position.set(0, 1.82, 0);
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.12, 0.12),
        getLegoMaterial(0xd946ef, { emissive: 0xa855f7, emissiveIntensity: 2.2 })
      );
      visor.position.set(0, 1.62, 0.3);
      root.add(helmetTop, visor);
    } else if (faction === 'police') {
      const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.34, 0.14, 14), blackMat);
      beret.position.set(-0.04, 1.82, 0);
      beret.rotation.z = 0.16;
      const beretBadge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), goldMat);
      beretBadge.position.set(0.1, 1.83, 0.33);
      root.add(beret, beretBadge);
    } else {
      // Variedade de Cabelos e Bonés para os Pedestres Civis!
      const sIdx = (cfg.styleIdx || 0) % 4;
      const hairColors = [0x451a03, 0x090a0d, 0xd97706, 0x991b1b];
      const hMat = getLegoMaterial(cfg.hatColor || hairColors[sIdx]);
      if (sIdx === 0) {
        // Boné com aba frontal
        const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.15, 14), hMat);
        capCrown.position.set(0, 1.8, 0);
        const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.32), hMat);
        capBrim.position.set(0, 1.75, 0.26);
        root.add(capCrown, capBrim);
      } else if (sIdx === 1) {
        // Cabelo esculpido com topete
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.66), hMat);
        hairTop.position.set(0, 1.82, 0.02);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.34, 0.18), hMat);
        hairBack.position.set(0, 1.66, -0.28);
        root.add(hairTop, hairBack);
      } else if (sIdx === 2) {
        // Fone de ouvido (Headset Urbano)
        const arc = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.14), hMat);
        arc.position.set(0, 1.86, 0);
        root.add(arc);
      }
    }

    // Braços Articulados + Arma 3D Detalhada + Clarão de Disparo (Muzzle Flash)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.44, 1.26, 0);
    leftArm.add(new THREE.Mesh(NPC_ARM_GEO, torsoMat));

    const rightArm = new THREE.Group();
    rightArm.position.set(0.44, 1.26, 0);
    rightArm.add(new THREE.Mesh(NPC_ARM_GEO, torsoMat));

    let muzzleFlashMesh = null;
    if (faction !== 'civilian') {
      rightArm.rotation.x = -Math.PI * 0.42;
      const isRpg = cfg.role === 'cv_rpg';
      const gunLen = isRpg ? 1.2 : isMecha ? 0.98 : 0.76;
      const gunColor =
        faction === 'ares' ? 0xa855f7 : isRpg ? 0x3f6212 : 0x1e293b;
      const gunGroup = new THREE.Group();
      gunGroup.position.set(0, -0.44, 0.28);
      gunGroup.rotation.x = Math.PI * 0.42;

      const receiver = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.15, gunLen),
        getLegoMaterial(gunColor, { roughness: 0.25 })
      );
      gunGroup.add(receiver);

      if (isRpg) {
        // Ogiva cônica explosiva na ponta da Bazuca RPG do CV!
        const warhead = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.38, 8),
          getLegoMaterial(0xdc2626, { roughness: 0.2 })
        );
        warhead.rotation.x = Math.PI / 2;
        warhead.position.set(0, 0, gunLen * 0.55);
        gunGroup.add(warhead);
      } else {
        // Carregador + Cano metálico do Fuzil AK/AR/SMG
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.26, 0.14), blackMat);
        mag.position.set(0, -0.16, 0.1);
        mag.rotation.x = 0.25;
        gunGroup.add(mag);
      }

      const flashColor =
        faction === 'ares' ? 0xf5d0fe : faction === 'pcc' ? 0xbae6fd : 0xfef08a;
      muzzleFlashMesh = new THREE.Mesh(
        MUZZLE_FLASH_GEO,
        new THREE.MeshBasicMaterial({ color: flashColor })
      );
      muzzleFlashMesh.position.set(0, 0, gunLen * 0.62);
      muzzleFlashMesh.visible = false;
      gunGroup.add(muzzleFlashMesh);

      rightArm.add(gunGroup);
    }

    root.add(leftArm, rightArm);

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

    return {
      root,
      head,
      faceShell,
      torso,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      muzzleFlashMesh,
      recruitRing
    };
  }

  // ============================================================================
  // 4. EVENTO DINÂMICO DE RUA: "PERSEGUIÇÃO AO CARRO-FORTE" ($) + REFORÇOS DE ELITE!
  // ============================================================================
  _spawnArmoredConvoyEvent() {
    // Cria 1 Carro-Forte Blindado escoltado/perseguido por 2 veículos de facção (Picape CV + SUV PCC) na Avenida Z = -117 ou X = 120
    const truckCfg = {
      type: 'carro_forte',
      color: 0x1e3a8a,
      roofColor: LEGO_COLORS.gold,
      axis: 'z_const',
      roadCoord: -117,
      laneOffset: 5.2,
      posAlong: -340,
      dir: 1,
      minC: -490,
      maxC: 510
    };
    const chaser1Cfg = {
      type: 'picape_cv',
      color: 0xdc2626,
      roofColor: 0x090a0d,
      axis: 'z_const',
      roadCoord: -117,
      laneOffset: 5.2,
      posAlong: -356,
      dir: 1,
      minC: -490,
      maxC: 510
    };
    const chaser2Cfg = {
      type: 'suv_pcc',
      color: 0x090a0d,
      roofColor: 0x1d4ed8,
      axis: 'z_const',
      roadCoord: -117,
      laneOffset: -5.2,
      posAlong: -368,
      dir: 1,
      minC: -490,
      maxC: 510
    };

    const truck = this._spawnTrafficVehicle(truckCfg);
    const chaser1 = this._spawnTrafficVehicle(chaser1Cfg);
    const chaser2 = this._spawnTrafficVehicle(chaser2Cfg);

    truck.cruiseSpeed = 18.5;
    chaser1.cruiseSpeed = 18.5;
    chaser2.cruiseSpeed = 18.5;

    if (truck.destructible) {
      truck.destructible.hp = 520;
      truck.destructible.maxHp = 520;
      truck.destructible.studDrops = { purple: 6, blue: 14, gold: 20, silver: 10 };
    }

    this.armoredConvoy = {
      active: true,
      rewarded: false,
      truck,
      chasers: [chaser1, chaser2],
      shootTimer: 0.9
    };
  }

  _updateArmoredConvoyEvent(dt, playerPos) {
    if (!this.armoredConvoy || !this.armoredConvoy.active) {
      this.convoyRespawnTimer -= dt;
      if (this.convoyRespawnTimer <= 0) {
        this.convoyRespawnTimer = 55.0;
        this._spawnArmoredConvoyEvent();
        if (this.hud && typeof this.hud.showTacticalAlertToast === 'function') {
          this.hud.showTacticalAlertToast(
            'EVENTO DINÂMICO // ALERTA BANCÁRIO [$]',
            'PERSEGUIÇÃO AO CARRO-FORTE NA AVENIDA!',
            'Intercepte o Comboio Blindado ($) no Minimapa para ganhar Chuva de Studs Roxos!',
            '#facc15',
            'bank',
            4000
          );
        }
      }
      return;
    }

    const cv = this.armoredConvoy;
    const truckObj = cv.truck?.destructible;
    const aliveChasers = cv.chasers.filter((c) => c.destructible && !c.destructible.destroyed);

    // Mantém os perseguidores colados atrás do Carro-Forte e trocando tiros em movimento!
    if (truckObj && !truckObj.destroyed && !truckObj.isDriven) {
      cv.chasers.forEach((chaser, idx) => {
        if (!chaser.destructible || chaser.destructible.destroyed || chaser.hijackedByPlayer) return;
        chaser.posAlong = cv.truck.posAlong - (idx + 1) * 14.5;
        chaser.currentSpeed = cv.truck.currentSpeed;
      });

      cv.shootTimer -= dt;
      if (cv.shootTimer <= 0 && aliveChasers.length > 0) {
        cv.shootTimer = 0.85 + Math.random() * 0.5;
        const shooter = aliveChasers[Math.floor(Math.random() * aliveChasers.length)];
        const origin = shooter.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0));
        const targetPos = cv.truck.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0));
        this._fireNpcWeapon(shooter.faction || 'cv', 'cv_rifle', origin, targetPos, playerPos, true);
      }
    }

    // Condição de vitória do Evento: Jogador destruiu os assaltantes OU explodiu/tomou o Carro-Forte!
    const truckDestroyedOrTaken = !truckObj || truckObj.destroyed || truckObj.isDriven;
    const allChasersDestroyed = aliveChasers.length === 0;

    if (!cv.rewarded && (truckDestroyedOrTaken || allChasersDestroyed)) {
      cv.rewarded = true;
      cv.active = false;
      this.convoyRespawnTimer = 50.0;

      const dropOrigin = cv.truck?.mesh?.position
        ? cv.truck.mesh.position.clone()
        : playerPos
          ? playerPos.clone()
          : new THREE.Vector3(0, 1, -117);
      if (this.destructibles && typeof this.destructibles.spawnRewardStudFountain === 'function') {
        this.destructibles.spawnRewardStudFountain(dropOrigin, dropOrigin.y, {
          purple: 5,
          blue: 16,
          gold: 22
        });
      }
      soundFX.playTrueHeroFanfare();
      if (this.hud && typeof this.hud.showTacticalAlertToast === 'function') {
        this.hud.showTacticalAlertToast(
          'EVENTO CONCLUÍDO // RECOMPENSA ÉPICA [$]',
          'COMBOIO INTERCEPTADO! +RECOMPENSA MÁXIMA',
          'Chuva de Studs Roxos (10.000) e Azuis (1.000) liberada na pista!',
          '#facc15',
          'bank',
          4400
        );
      }
    }
  }

  /**
   * Sistema de Escalada / Reforços de Facção (Nível de Procurado 1 a 5):
   * Quando o jogador elimina 4 membros de uma facção, despacha um Esquadrão de Elite com alerta na HUD!
   */
  _recordFactionKillForEscalation(faction, deathPos) {
    this.factionKills[faction] = (this.factionKills[faction] || 0) + 1;
    if (this.reinforcementCooldown > 0) return;

    if (this.factionKills[faction] % 4 === 0) {
      this.reinforcementCooldown = 18.0;
      this.factionHeatLevel[faction] = Math.min(5, (this.factionHeatLevel[faction] || 0) + 1);
      const heat = this.factionHeatLevel[faction];

      const factionTitle =
        faction === 'cv'
          ? 'COMANDO VERMELHO (CV)'
          : faction === 'pcc'
            ? 'PRIMEIRO COMANDO (PCC)'
            : 'DIVISÃO CYBER A.R.E.S.';
      const accent =
        faction === 'cv' ? '#ef4444' : faction === 'pcc' ? '#38bdf8' : '#d946ef';

      soundFX.playRadioAlertSiren();
      if (this.hud && typeof this.hud.showTacticalAlertToast === 'function') {
        this.hud.showTacticalAlertToast(
          `NÍVEL DE AMEAÇA ${'★'.repeat(heat)} // ${factionTitle}`,
          '⚠️ ALERTA DE FACÇÃO: ESQUADRÃO DE ELITE DESPACHADO!',
          `Tropas de choque e blindados da facção ${faction.toUpperCase()} cercaram sua posição!`,
          accent,
          'emergency',
          4200
        );
      }

      // Despacha 3 soldados de elite + 1 Mecha/Artilheiro pesado a ~24m do ponto de conflito!
      const roles =
        faction === 'cv'
          ? ['cv_rifle', 'cv_rpg', 'cv_rifle', 'cv_rpg']
          : faction === 'pcc'
            ? ['pcc_smg', 'pcc_c4', 'pcc_smg', 'pcc_c4']
            : ['ares_exo', 'ares_drone', 'ares_exo', 'ares_mecha'];

      roles.forEach((role, idx) => {
        const ang = (idx / roles.length) * Math.PI * 2 + Math.random() * 0.4;
        const sx = deathPos.x + Math.cos(ang) * 22.0;
        const sz = deathPos.z + Math.sin(ang) * 22.0;
        this._spawnCombatNpc({
          faction,
          role,
          x: sx,
          z: sz,
          homeX: sx,
          homeZ: sz
        });
      });
    }
  }

  // ============================================================================
  // 5. HELICÓPTERO DE ASSALTO DO PCC (PATRULHA AÉREA E APOIO DE FOGO!)
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
  // 6. COMANDO DE RÁDIO DO COMANDANTE CAVEIRA [G]: RECRUTA BOPE & CHAMA CAVEIRÃO!
  // ============================================================================
  triggerCaveiraRadioCommand(playerPos, facingAngle) {
    soundFX.playHeroSwap();
    let recruitedCount = 0;

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
      if (typeof this.hud.showTacticalAlertToast === 'function') {
        this.hud.showTacticalAlertToast(
          `COMANDO BOPE // RÁDIO TÁTICO [G]`,
          vehicleLabel,
          `${recruitedCount} Operadores do BOPE em formação de escolta e fogo!`,
          '#38bdf8',
          'police',
          3200
        );
      }
    }
  }

  // ============================================================================
  // 7. IA DE GUERRA ENTRE FACÇÕES + BARRAS DE HP FLUTUANTES + CLARÃO E SOM!
  // ============================================================================
  _updateCombatNpcs(dt, playerPos, controller) {
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
              this._fireNpcWeapon('pcc', 'pcc_smg', h.mesh.position.clone().add(new THREE.Vector3(0, -1.2, 0)), target.pos, playerPos);
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
        root.visible = dSq <= 390 * 390;
        if (!root.visible) continue;
      }

      npc.animTime += dt;
      npc.fireCooldown = Math.max(0, npc.fireCooldown - dt);

      // Atualiza Clarão de Disparo (Muzzle Flash)
      if (npc.muzzleFlashTimer > 0) {
        npc.muzzleFlashTimer -= dt;
        if (npc.muzzleFlashTimer <= 0 && npc.visual.muzzleFlashMesh) {
          npc.visual.muzzleFlashMesh.visible = false;
        }
      }

      // Atualiza Piscar de Dano (Hit Flash) e Barra de HP Flutuante virada para o jogador
      if (npc.hitFlashTimer > 0) {
        npc.hitFlashTimer -= dt;
        const s = 1.0 + Math.sin(npc.hitFlashTimer * 40) * 0.08;
        if (!npc.isMecha) root.scale.set(s, s, s);
      } else if (!npc.isMecha) {
        root.scale.set(1, 1, 1);
      }

      if (npc.visual.hpBarGroup && npc.visual.hpBarGroup.visible && playerPos) {
        npc.visual.hpBarGroup.lookAt(playerPos.x, playerPos.y + 3.5, playerPos.z);
      }

      // Aplica recuo físico (Knockback) ao ser atingido
      if (Math.hypot(npc.knockbackVelX, npc.knockbackVelZ) > 0.1) {
        root.position.x += npc.knockbackVelX * dt;
        root.position.z += npc.knockbackVelZ * dt;
        npc.knockbackVelX *= Math.max(0, 1 - dt * 10);
        npc.knockbackVelZ *= Math.max(0, 1 - dt * 10);
      }

      if (npc.isDrone && npc.visual.rotors) {
        for (const r of npc.visual.rotors) {
          r.rotation.y += dt * 28.0;
        }
      }

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

      npc.x = root.position.x;
      npc.z = root.position.z;
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
          if (npc.visual.muzzleFlashMesh) {
            npc.visual.muzzleFlashMesh.visible = true;
            npc.visual.muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
            npc.muzzleFlashTimer = 0.065;
          }
          this._fireNpcWeapon(npc.faction, npc.role, muzzleOrigin, target.pos, playerPos);
        }
      } else if (isMoving) {
        root.rotation.y = Math.atan2(moveDirX, moveDirZ);
      }

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

    if (myFaction !== 'police' && playerPos && (!controller || !(controller.stealthTimer > 0))) {
      const dPlayer = Math.hypot(playerPos.x - myPos.x, playerPos.z - myPos.z);
      if (dPlayer < Math.min(maxRange, bestScore + 6.0)) {
        bestTarget = {
          type: 'player',
          pos: new THREE.Vector3(playerPos.x, playerPos.y + 1.05, playerPos.z)
        };
      }
    }

    return bestTarget;
  }

  _fireNpcWeapon(faction, role, origin, targetPos, playerPos = null, isConvoyFire = false) {
    this.triggerPedestrianPanicNear(origin, 44.0);

    const isRpg = role === 'cv_rpg' || role === 'pcc_c4';
    const isLaser = faction === 'ares';

    // Som Espacial Atenuado pela Distância até o Jogador (até 95m)!
    if (playerPos && (this._npcGunSoundCooldown <= 0 || isRpg)) {
      const distToPlayer = Math.hypot(origin.x - playerPos.x, origin.z - playerPos.z);
      if (distToPlayer < 95.0) {
        const volScale = Math.max(0.06, 1.0 - distToPlayer / 95.0);
        soundFX.playNpcGunshot(faction, isRpg, volScale);
        this._npcGunSoundCooldown = 0.055;
      }
    }

    const dir = targetPos.clone().sub(origin);
    dir.x += (Math.random() - 0.5) * 1.1;
    dir.y += (Math.random() - 0.5) * 0.5;
    dir.z += (Math.random() - 0.5) * 1.1;
    dir.normalize();

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
      isConvoyFire,
      vel: dir.multiplyScalar(speed),
      life: 1.35,
      damage: isConvoyFire ? 4 : isRpg ? 28 : role === 'ares_mecha' ? 18 : 11
    });
  }

  _updateNpcProjectiles(dt, playerPos, controller) {
    for (let i = this.npcProjectiles.length - 1; i >= 0; i--) {
      const p = this.npcProjectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      let hit = false;

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
    this.reinforcementCooldown = Math.max(0, this.reinforcementCooldown - dt);
    this._npcGunSoundCooldown = Math.max(0, this._npcGunSoundCooldown - dt);

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
    this._updateArmoredConvoyEvent(dt, playerPos);
    this._updatePedestrians(dt, playerPos);
    this._updateCombatNpcs(dt, playerPos, controller);
    this._updateNpcProjectiles(dt, playerPos, controller);
  }
}
