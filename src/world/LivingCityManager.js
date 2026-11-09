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

    // Estado de Rádio do Caveira e Sistema de Vida de 250 HP + Guerra Mundial (Estilo PvZ GW2 Backyard Battleground)
    this.playerFaction = 'cv';
    this.playerMaxHp = 250;
    this.playerHp = 250;
    this.timeSinceLastHit = 10.0;
    this.playerBeingHealed = false;
    this._healChimeTimer = 0;

    this.worldWarEscalation = 0.35;
    this.bossWaveActive = false;
    this.bossWaveCooldown = 0;
    this.activeBosses = [];
    this.healStations = [];
    this.healthCrystals = [];
    this.centralFlagBeacon = null;

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

    this._initCentralBattlegroundProps();
    this._initUrbanTraffic();
    this._initPedestrians();
    this._initFactionsAndPolice();
    this._initPccAssaultHelicopter();
    this._spawnArmoredConvoyEvent();
  }

  // ============================================================================
  // 0. FRONT CENTRAL DE GUERRA MUNDIAL (ESTILO PVZ GW2 BACKYARD BATTLEGROUND)
  // ============================================================================
  _initCentralBattlegroundProps() {
    const steelMat = getLegoMaterial(0x1e293b, { metalness: 0.6, roughness: 0.25 });
    const darkMat = getLegoMaterial(0x090a0d, { roughness: 0.3 });
    const goldMat = getLegoMaterial(0xfacc15, { emissive: 0xd97706, emissiveIntensity: 0.7 });

    // Mastro Central da Bandeira de Poder (Flag of Power) na Praça/Avenida Central (0, 0, -96)
    const pylonGroup = new THREE.Group();
    const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.45, 16), darkMat);
    baseRing.position.y = 0.22;
    const innerPad = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.55, 16), steelMat);
    innerPad.position.y = 0.28;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 9.5, 12), steelMat);
    pole.position.y = 4.9;
    const topCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), goldMat);
    topCrown.position.y = 10.1;

    const flagMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide
    });
    const flagBanner = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), flagMat);
    flagBanner.position.set(1.9, 8.2, 0);

    const auraGeo = new THREE.TorusGeometry(3.6, 0.12, 8, 28);
    auraGeo.rotateX(Math.PI / 2);
    const auraRing = new THREE.Mesh(auraGeo, new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    auraRing.position.y = 0.15;

    pylonGroup.add(baseRing, innerPad, pole, topCrown, flagBanner, auraRing);
    pylonGroup.position.set(0, 0, -96);
    this.scene.add(pylonGroup);
    this.centralFlagBeacon = {
      group: pylonGroup,
      topCrown,
      flagMat,
      auraRing
    };

    // Trincheiras e Bunkers Táticos LEGO das 3 Facções no Front Central
    const bunkerSpecs = [
      { x: -26, z: -96, rotY: Math.PI * 0.45, color: 0xdc2626 }, // Bunker Avançado CV (Oeste)
      { x: 26, z: -96, rotY: -Math.PI * 0.45, color: 0x2563eb }, // Bunker Avançado PCC (Leste)
      { x: 0, z: -74, rotY: Math.PI, color: 0xa855f7 }           // Bunker Avançado A.R.E.S. (Sul)
    ];
    for (const b of bunkerSpecs) {
      const bGroup = new THREE.Group();
      const wallMat = getLegoMaterial(b.color, { roughness: 0.25 });
      const wMain = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.45, 0.9), steelMat);
      wMain.position.y = 0.72;
      const wStripe = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.38, 0.96), wallMat);
      wStripe.position.y = 1.05;
      bGroup.add(wMain, wStripe);
      for (let sx = -2.0; sx <= 2.0; sx += 1.0) {
        const st = new THREE.Mesh(SHARED_STUD_GEO, wallMat);
        st.position.set(sx, 1.52, 0);
        bGroup.add(st);
      }
      bGroup.position.set(b.x, 0, b.z);
      bGroup.rotation.y = b.rotY;
      this.scene.add(bGroup);
    }
  }

  /**
   * Define a Facção Aliada do Jogador ('cv', 'pcc' ou 'ares'), atualiza todos os anéis verdes de aliado,
   * restaura 250 HP e despacha um Esquadrão Aliado pessoal (com Cientista/Médico de Cura + Tanque de Escudo)!
   */
  setPlayerFaction(factionKey, controller = null) {
    if (!['cv', 'pcc', 'ares'].includes(factionKey)) {
      factionKey = 'cv';
    }
    this.playerFaction = factionKey;
    this.playerHp = this.playerMaxHp;
    this.timeSinceLastHit = 10.0;

    if (this.hud) {
      this.hud.setPlayerFaction(factionKey);
      this.hud.setPlayerHealth(this.playerHp, this.playerMaxHp, false);
    }

    if (this.centralFlagBeacon) {
      const cHex = factionKey === 'cv' ? 0xef4444 : factionKey === 'pcc' ? 0x38bdf8 : 0xd946ef;
      this.centralFlagBeacon.flagMat.color.setHex(cHex);
      this.centralFlagBeacon.auraRing.material.color.setHex(cHex);
    }

    // Atualiza o status de Aliado vs Inimigo em todas as tropas vivas na cidade!
    for (const npc of this.combatNpcs) {
      this._syncNpcAllegiance(npc);
    }

    // Spawna 1 Médico Aliado + 1 Tanque de Escudo Aliado + 1 Fuzileiro Aliado escoltando o jogador!
    const pPos = controller?.position || new THREE.Vector3(0, 0.3, -92);
    const escortRoles = [
      `${factionKey}_medic`,
      `${factionKey}_tank`,
      factionKey === 'cv' ? 'cv_rifle' : factionKey === 'pcc' ? 'pcc_smg' : 'ares_exo'
    ];
    escortRoles.forEach((role, idx) => {
      const ang = (idx / escortRoles.length) * Math.PI * 2;
      const sx = pPos.x + Math.cos(ang) * 5.5;
      const sz = pPos.z + Math.sin(ang) * 5.5;
      const unit = this._spawnCombatNpc({
        faction: factionKey,
        role,
        x: sx,
        z: sz,
        homeX: sx,
        homeZ: sz
      });
      unit.isEscortingPlayer = true;
    });

    // Também cria uma Estação de Cura 3D Aliada perto do ponto inicial!
    this._spawnLegoHealStation(
      new THREE.Vector3(pPos.x + 3.8, pPos.y, pPos.z - 2.5),
      factionKey,
      true
    );
  }

  _isFactionAlliedToPlayer(faction, isRecruited = false) {
    if (isRecruited) return true;
    if (faction === this.playerFaction) return true;
    if (faction === 'police' && this.playerFaction === 'ares') return true;
    return false;
  }

  _syncNpcAllegiance(npc) {
    const isAllied =
      npc.faction === this.playerFaction ||
      npc.isRecruitedByPlayer ||
      (npc.faction === 'police' && this.playerFaction === 'ares');
    npc.isAlliedToPlayer = isAllied;
    if (npc.destructible) {
      npc.destructible.isAlliedToPlayer = isAllied;
    }
    if (npc.visual?.allyRing) {
      npc.visual.allyRing.visible = isAllied;
    }
    if (npc.visual?.hpFillMat) {
      npc.visual.hpFillMat.color.setHex(
        isAllied ? 0x22c55e : npc.isBoss ? 0xfacc15 : 0xef4444
      );
    }
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
  // 3. AS 3 FACÇÕES (CV, PCC, A.R.E.S.) + MÉDICOS DE CURA, TANQUES E CHEFÕES!
  // ============================================================================
  _initFactionsAndPolice() {
    const spawns = [
      // ------------------------------------------------------------------------
      // FRONT CENTRAL DE GUERRA MUNDIAL (ESTILO PVZ GW2 BACKYARD BATTLEGROUND)
      // ------------------------------------------------------------------------
      // Esquadrão CV no Front Central (com Médico Cientista e Tanque de Escudo!)
      { faction: 'cv', role: 'cv_medic', x: -24, z: -96, homeX: -24, homeZ: -96 },
      { faction: 'cv', role: 'cv_tank', x: -18, z: -92, homeX: -18, homeZ: -92 },
      { faction: 'cv', role: 'cv_rifle', x: -28, z: -88, homeX: -28, homeZ: -88 },
      { faction: 'cv', role: 'cv_rpg', x: -22, z: -102, homeX: -22, homeZ: -102 },

      // Esquadrão PCC no Front Central (com Médico Cientista e Tanque de Escudo!)
      { faction: 'pcc', role: 'pcc_medic', x: 24, z: -96, homeX: 24, homeZ: -96 },
      { faction: 'pcc', role: 'pcc_tank', x: 18, z: -92, homeX: 18, homeZ: -92 },
      { faction: 'pcc', role: 'pcc_smg', x: 28, z: -88, homeX: 28, homeZ: -88 },
      { faction: 'pcc', role: 'pcc_c4', x: 22, z: -102, homeX: 22, homeZ: -102 },

      // Esquadrão A.R.E.S. no Front Central (com Cientista Quântico e Tanque de Escudo!)
      { faction: 'ares', role: 'ares_medic', x: 0, z: -72, homeX: 0, homeZ: -72 },
      { faction: 'ares', role: 'ares_tank', x: -6, z: -76, homeX: -6, homeZ: -76 },
      { faction: 'ares', role: 'ares_exo', x: 6, z: -76, homeX: 6, homeZ: -76 },
      { faction: 'ares', role: 'ares_drone', x: 0, z: -66, homeX: 0, homeZ: -66 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 1: CENTRO FINANCEIRO / AVENIDA DO SUPER BANCO (BOPE vs PCC vs CV)
      // ------------------------------------------------------------------------
      { faction: 'police', role: 'bope_rifle', x: -18, z: -130, homeX: -18, homeZ: -130 },
      { faction: 'police', role: 'bope_rifle', x: 18, z: -130, homeX: 18, homeZ: -130 },
      { faction: 'police', role: 'bope_rifle', x: 64, z: -124, homeX: 64, homeZ: -124 },
      { faction: 'police', role: 'bope_rifle', x: 72, z: -124, homeX: 72, homeZ: -124 },
      { faction: 'police', role: 'bope_rifle', x: 68, z: -108, homeX: 68, homeZ: -108 },
      { faction: 'pcc', role: 'pcc_smg', x: 94, z: -112, homeX: 94, homeZ: -112 },
      { faction: 'pcc', role: 'pcc_medic', x: 98, z: -116, homeX: 98, homeZ: -116 },
      { faction: 'pcc', role: 'pcc_c4', x: 102, z: -120, homeX: 102, homeZ: -120 },
      { faction: 'pcc', role: 'pcc_tank', x: 108, z: -106, homeX: 108, homeZ: -106 },
      { faction: 'cv', role: 'cv_rifle', x: 86, z: -96, homeX: 86, homeZ: -96 },
      { faction: 'cv', role: 'cv_rpg', x: 92, z: -92, homeX: 92, homeZ: -92 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 2: FRONTEIRA OESTE — ENTRADA DA CIDADE DE DEUS (CV vs BOPE vs A.R.E.S.)
      // ------------------------------------------------------------------------
      { faction: 'cv', role: 'cv_tank', x: -508, z: -122, homeX: -508, homeZ: -122 },
      { faction: 'cv', role: 'cv_medic', x: -512, z: -118, homeX: -512, homeZ: -118 },
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
      // INTERIOR DO MORRO DA CIDADE DE DEUS (5 NÍVEIS DE TROPAS, MÉDICOS E TANQUES DO CV!)
      // ------------------------------------------------------------------------
      { faction: 'cv', role: 'cv_rifle', x: -585, z: -140, homeX: -585, homeZ: -140 },
      { faction: 'cv', role: 'cv_medic', x: -600, z: -132, homeX: -600, homeZ: -132 },
      { faction: 'cv', role: 'cv_rpg', x: -612, z: -125, homeX: -612, homeZ: -125 },
      { faction: 'cv', role: 'cv_tank', x: -648, z: -135, homeX: -648, homeZ: -135 },
      { faction: 'cv', role: 'cv_rpg', x: -692, z: -138, homeX: -692, homeZ: -138 },
      { faction: 'cv', role: 'cv_medic', x: -720, z: -136, homeX: -720, homeZ: -136 },
      { faction: 'cv', role: 'cv_rifle', x: -735, z: -135, homeX: -735, homeZ: -135 },
      { faction: 'cv', role: 'cv_rpg', x: -780, z: -142, homeX: -780, homeZ: -142 },
      { faction: 'cv', role: 'cv_tank', x: -835, z: -130, homeX: -835, homeZ: -130 },
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
      { faction: 'pcc', role: 'pcc_tank', x: 598, z: -122, homeX: 598, homeZ: -122 },
      { faction: 'pcc', role: 'pcc_medic', x: 602, z: -116, homeX: 602, homeZ: -116 },
      { faction: 'pcc', role: 'pcc_c4', x: 604, z: -112, homeX: 604, homeZ: -112 },
      { faction: 'pcc', role: 'pcc_smg', x: 602, z: -248, homeX: 602, homeZ: -248 },
      { faction: 'pcc', role: 'pcc_c4', x: 610, z: -254, homeX: 610, homeZ: -254 },
      { faction: 'cv', role: 'cv_rifle', x: 514, z: -120, homeX: 514, homeZ: -120 },
      { faction: 'cv', role: 'cv_rpg', x: 508, z: -112, homeX: 508, homeZ: -112 },
      { faction: 'police', role: 'bope_rifle', x: 500, z: -126, homeX: 500, homeZ: -126 },
      { faction: 'police', role: 'bope_rifle', x: 496, z: -248, homeX: 496, homeZ: -248 },

      // Quadras e Galpões Internos do PCC no Leste
      { faction: 'pcc', role: 'pcc_smg', x: 668, z: -315, homeX: 668, homeZ: -315 },
      { faction: 'pcc', role: 'pcc_medic', x: 676, z: -315, homeX: 676, homeZ: -315 },
      { faction: 'pcc', role: 'pcc_c4', x: 685, z: -315, homeX: 685, homeZ: -315 },
      { faction: 'pcc', role: 'pcc_tank', x: 735, z: -245, homeX: 735, homeZ: -245 },
      { faction: 'pcc', role: 'pcc_c4', x: 750, z: -120, homeX: 750, homeZ: -120 },
      { faction: 'pcc', role: 'pcc_medic', x: 680, z: -115, homeX: 680, homeZ: -115 },
      { faction: 'pcc', role: 'pcc_tank', x: 820, z: -185, homeX: 820, homeZ: -185 },
      { faction: 'pcc', role: 'pcc_c4', x: 840, z: -195, homeX: 840, homeZ: -195 },
      { faction: 'pcc', role: 'pcc_smg', x: 710, z: -15, homeX: 710, homeZ: -15 },
      { faction: 'pcc', role: 'pcc_c4', x: 790, z: -410, homeX: 790, homeZ: -410 },

      // ------------------------------------------------------------------------
      // ZONA DE GUERRA 4 & PORTO DE CONTÊINERES / BASE MILITAR (DOMÍNIO DA A.R.E.S.)
      // ------------------------------------------------------------------------
      { faction: 'ares', role: 'ares_mecha', x: 775, z: 152, homeX: 775, homeZ: 152 },
      { faction: 'ares', role: 'ares_medic', x: 770, z: 158, homeX: 770, homeZ: 158 },
      { faction: 'ares', role: 'ares_tank', x: 768, z: 160, homeX: 768, homeZ: 160 },
      { faction: 'ares', role: 'ares_drone', x: 782, z: 146, homeX: 782, homeZ: 146 },
      { faction: 'pcc', role: 'pcc_smg', x: 764, z: 118, homeX: 764, homeZ: 118 },
      { faction: 'pcc', role: 'pcc_c4', x: 774, z: 116, homeX: 774, homeZ: 116 },
      { faction: 'cv', role: 'cv_rpg', x: 752, z: 132, homeX: 752, homeZ: 132 },

      // Interior do Porto Leste (Guindastes, Pátio de Contêineres e Doca A.R.E.S.)
      { faction: 'ares', role: 'ares_mecha', x: 965, z: 590, homeX: 965, homeZ: 590 },
      { faction: 'ares', role: 'ares_medic', x: 958, z: 586, homeX: 958, homeZ: 586 },
      { faction: 'ares', role: 'ares_tank', x: 952, z: 585, homeX: 952, homeZ: 585 },
      { faction: 'ares', role: 'ares_drone', x: 978, z: 585, homeX: 978, homeZ: 585 },
      { faction: 'ares', role: 'ares_exo', x: 1060, z: 340, homeX: 1060, homeZ: 340 },
      { faction: 'ares', role: 'ares_medic', x: 1070, z: 345, homeX: 1070, homeZ: 345 },
      { faction: 'ares', role: 'ares_drone', x: 1080, z: 350, homeX: 1080, homeZ: 350 },
      { faction: 'ares', role: 'ares_mecha', x: 1190, z: 460, homeX: 1190, homeZ: 460 },
      { faction: 'ares', role: 'ares_exo', x: 1175, z: 450, homeX: 1175, homeZ: 450 },

      // Base Militar Oeste & Aeroporto
      { faction: 'ares', role: 'ares_mecha', x: -1140, z: 360, homeX: -1140, homeZ: 360 },
      { faction: 'ares', role: 'ares_medic', x: -1134, z: 355, homeX: -1134, homeZ: 355 },
      { faction: 'ares', role: 'ares_drone', x: -1128, z: 350, homeX: -1128, homeZ: 350 },
      { faction: 'ares', role: 'ares_tank', x: -1155, z: 375, homeX: -1155, homeZ: 375 },
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

    // Já cria 3 Estações de Cura 3D no Front Central (uma para cada facção)!
    this._spawnLegoHealStation(new THREE.Vector3(-25, 0, -93), 'cv', true);
    this._spawnLegoHealStation(new THREE.Vector3(25, 0, -93), 'pcc', true);
    this._spawnLegoHealStation(new THREE.Vector3(0, 0, -71), 'ares', true);
  }

  _spawnCombatNpc(sp) {
    const isBoss = ['cv_boss', 'pcc_boss', 'ares_boss'].includes(sp.role);
    const isMecha = sp.role === 'ares_mecha';
    const isDrone = sp.role === 'ares_drone';
    const isMedic = String(sp.role || '').endsWith('_medic');
    const isTank = String(sp.role || '').endsWith('_tank');

    const visual = isDrone
      ? this._buildAresDroneMesh()
      : this._buildLegoNpcMesh({
          faction: sp.faction,
          role: sp.role,
          isBoss,
          isMecha,
          isMedic,
          isTank
        });

    const groundY = this.world.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(sp.x, sp.z)
      : 0.28;
    const baseY = isDrone ? groundY + 4.2 : Math.max(0.28, groundY);
    visual.root.position.set(sp.x, baseY, sp.z);
    this.scene.add(visual.root);

    // Barra de HP 3D Flutuante acima da cabeça
    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, isBoss ? 2.45 : isMecha ? 2.25 : isDrone ? 0.95 : 2.35, 0);
    hpBarGroup.visible = isBoss;
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

    const maxHp = isBoss
      ? 1200
      : isMecha
        ? 260
        : isTank
          ? 165
          : isMedic
            ? 95
            : isDrone
              ? 75
              : 65;
    const radius = isBoss ? 2.15 : isMecha ? 1.55 : isTank ? 1.15 : isDrone ? 1.05 : 0.85;
    const height = isBoss ? 4.4 : isMecha ? 3.4 : isTank ? 2.4 : isDrone ? 1.6 : 1.9;

    const debrisColors =
      sp.faction === 'cv'
        ? [0xdc2626, 0x090a0d, 0xfacc15]
        : sp.faction === 'pcc'
          ? [0x090a0d, 0x1d4ed8, 0x38bdf8]
          : sp.faction === 'ares'
            ? [0x475569, 0xa855f7, 0xd946ef]
            : [0x090a0d, 0xfacc15, 0x334155];

    const studDrops = isBoss
      ? { purple: 6, blue: 14, gold: 24, silver: 10 }
      : isMecha
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

    const bossNameMap = {
      cv_boss: 'TROVÃO RUBRO (COLOSSO DO MORRO)',
      pcc_boss: 'BLINDADO SUPREMO Z-15',
      ares_boss: 'OVERLORD QUÂNTICO'
    };

    const npc = {
      faction: sp.faction,
      role: sp.role,
      name: sp.name || bossNameMap[sp.role] || sp.role,
      isBoss,
      isMecha,
      isDrone,
      isMedic,
      isTank,
      isBigFig: isBoss || isMecha,
      isAlliedToPlayer: false,
      isEscortingPlayer: Boolean(sp.isEscortingPlayer),
      visual,
      destructible: destructibleObj,
      destructibleObj,
      x: sp.x,
      z: sp.z,
      homeX: sp.homeX,
      homeZ: sp.homeZ,
      moveSpeed: isBoss ? 5.6 : isMecha ? 4.8 : isTank ? 5.2 : isDrone ? 8.2 : 6.4,
      fireCooldown: 0.4 + Math.random() * 0.9,
      fireInterval: isBoss
        ? 0.45
        : sp.role === 'cv_rpg' || sp.role === 'pcc_c4'
          ? 2.4
          : isMecha || isTank
            ? 0.55
            : 0.72,
      attackRange: isBoss ? 68 : isMecha ? 54 : 46,
      healStationCooldown: 3.0 + Math.random() * 5.0,
      isRecruitedByPlayer: false,
      hitFlashTimer: 0,
      muzzleFlashTimer: 0,
      knockbackVelX: 0,
      knockbackVelZ: 0,
      animTime: Math.random() * 10
    };

    this._syncNpcAllegiance(npc);

    if (destructibleObj) {
      destructibleObj.onDamaged = (amount, hitOrigin) => {
        npc.hitFlashTimer = 0.14;
        if (npc.visual.hpBarGroup && npc.visual.hpFillMesh) {
          npc.visual.hpBarGroup.visible = true;
          const ratio = Math.max(0.04, Math.min(1, destructibleObj.hp / destructibleObj.maxHp));
          npc.visual.hpFillMesh.scale.x = ratio;
        }
        if (hitOrigin) {
          const dx = visual.root.position.x - hitOrigin.x;
          const dz = visual.root.position.z - hitOrigin.z;
          const len = Math.max(0.1, Math.hypot(dx, dz));
          const pushForce = npc.isBoss ? 1.8 : npc.isMecha || npc.isTank ? 4.2 : 9.0;
          npc.knockbackVelX = (dx / len) * pushForce;
          npc.knockbackVelZ = (dz / len) * pushForce;
        }
      };

      destructibleObj.onShattered = () => {
        npc.isRecruitedByPlayer = false;
        if (npc.visual.recruitRing) {
          npc.visual.recruitRing.visible = false;
        }
        if (npc.visual.allyRing) {
          npc.visual.allyRing.visible = false;
        }
        if (npc.visual.healBeamMesh) {
          npc.visual.healBeamMesh.visible = false;
        }
        if (npc.visual.hpBarGroup) {
          npc.visual.hpBarGroup.visible = false;
        }

        // Dropa Cristal Verde de Vida (+50 HP) ao derrotar inimigos!
        if (!npc.isAlliedToPlayer) {
          const crystalCount = npc.isBoss ? 3 : 1;
          for (let c = 0; c < crystalCount; c++) {
            this._spawnHealthCrystal(
              new THREE.Vector3(
                visual.root.position.x + (c - (crystalCount - 1) * 0.5) * 1.4,
                visual.root.position.y + 0.5,
                visual.root.position.z
              )
            );
          }
        }

        if (npc.isBoss) {
          // Chefão Colossal derrotado: não dá respawn automático, solta chuva épica de Studs!
          destructibleObj.respawnTimer = 999999;
          this.activeBosses = this.activeBosses.filter((b) => b !== npc);
          if (this.activeBosses.length === 0) {
            this.bossWaveActive = false;
            soundFX.setBossMusicIntensity(false);
          }
          if (!npc.isAlliedToPlayer && this.hud && typeof this.hud.showTacticalAlertToast === 'function') {
            soundFX.playTrueHeroFanfare();
            this.hud.showTacticalAlertToast(
              'VITÓRIA NA GUERRA MUNDIAL // CHEFÃO ABATIDO!',
              `${npc.name} DESTRUÍDO!`,
              'Chuva de Studs Roxos + 3 Cristais de Vida (+150 HP) liberados!',
              '#22c55e',
              'bank',
              4500
            );
          }
          return;
        }

        destructibleObj.respawnTimer = 14.0;
        destructibleObj.basePos.set(npc.homeX, baseY, npc.homeZ);

        // Registra eliminação para o Sistema de Escalada / Guerra Mundial!
        if (!npc.isAlliedToPlayer && (npc.faction === 'cv' || npc.faction === 'pcc' || npc.faction === 'ares')) {
          this._recordFactionKillForEscalation(npc.faction, visual.root.position);
        }
      };
    }

    this.combatNpcs.push(npc);
    if (isBoss) {
      this.activeBosses.push(npc);
    }
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

    const allyRingGeo = new THREE.TorusGeometry(0.65, 0.045, 8, 20);
    allyRingGeo.rotateX(Math.PI / 2);
    const allyRing = new THREE.Mesh(
      allyRingGeo,
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    allyRing.position.y = -0.35;
    allyRing.visible = false;

    root.add(hull, eyeCore, laserBarrel, muzzleFlashMesh, allyRing);

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

    return { root, rotors, muzzleFlashMesh, allyRing, isDrone: true };
  }

  _buildLegoNpcMesh(cfg) {
    const root = new THREE.Group();
    const isBoss = Boolean(cfg.isBoss);
    const isMecha = Boolean(cfg.isMecha);
    const isMedic = Boolean(cfg.isMedic);
    const isTank = Boolean(cfg.isTank);

    if (isBoss) {
      root.scale.set(2.42, 2.38, 2.42);
    } else if (isMecha) {
      root.scale.set(1.85, 1.75, 1.85);
    } else if (isTank) {
      root.scale.set(1.28, 1.24, 1.28);
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
    const whiteMat = getLegoMaterial(0xf8fafc, { roughness: 0.2 });
    const medicGreenMat = getLegoMaterial(0x22c55e, {
      emissive: 0x16a34a,
      emissiveIntensity: 1.8,
      roughness: 0.15
    });

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
      if (isMecha || isBoss) {
        for (const side of [-1, 1]) {
          const shoulderPod = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.48), torsoMat);
          shoulderPod.position.set(side * 0.52, 1.32, 0);
          root.add(shoulderPod);
        }
      }
    } else if (faction === 'police') {
      const bopeVest = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.52, 0.42), blackMat);
      bopeVest.position.set(0, 0.98, 0);
      const goldBadge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.45), goldMat);
      goldBadge.position.set(0.14, 1.06, 0);
      root.add(bopeVest, goldBadge);
    } else if ((cfg.styleIdx || 0) % 2 === 0) {
      const backpack = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.5, 0.22),
        getLegoMaterial((cfg.styleIdx || 0) % 4 === 0 ? 0xd97706 : 0x1e293b)
      );
      backpack.position.set(0, 1.02, -0.28);
      root.add(backpack);
    }

    // ------------------------------------------------------------------------
    // MOCHILA MÉDICA 3D COM CRUZ VERDE BRILHANTE (+) + RAIO DE CURA 3D (ESTILO CIENTISTA / GIRASSOL PVZ GW2!)
    // ------------------------------------------------------------------------
    let healBeamMesh = null;
    if (isMedic) {
      const medPack = new THREE.Group();
      const packBox = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.28), whiteMat);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.32), medicGreenMat);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.32), medicGreenMat);
      const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.56, 10), medicGreenMat);
      tankL.position.set(-0.32, 0, 0);
      const tankR = tankL.clone();
      tankR.position.set(0.32, 0, 0);
      medPack.add(packBox, crossV, crossH, tankL, tankR);
      medPack.position.set(0, 1.04, -0.32);

      // Emblema de Cruz Médica no Peito Frontal
      const chestCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.48), medicGreenMat);
      chestCrossV.position.set(0, 1.02, 0);
      const chestCrossH = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.48), medicGreenMat);
      chestCrossH.position.set(0, 1.02, 0);
      root.add(medPack, chestCrossV, chestCrossH);

      // Raio de Cura Contínuo 3D (Ancorado na base para apontar e esticar até o Jogador ou Aliado!)
      const beamGeo = new THREE.CylinderGeometry(0.11, 0.16, 1.0, 10);
      beamGeo.rotateX(Math.PI / 2);
      beamGeo.translate(0, 0, 0.5);
      healBeamMesh = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          color: 0x22c55e,
          transparent: true,
          opacity: 0.85
        })
      );
      healBeamMesh.position.set(0, 1.15, 0);
      healBeamMesh.visible = false;
      root.add(healBeamMesh);
    }

    // ------------------------------------------------------------------------
    // ARMADURA COLOSSAL EXCLUSIVA DOS 3 CHEFÕES DE GUERRA MUNDIAL (BIG-FIG 2.4x!)
    // ------------------------------------------------------------------------
    let bossShieldRing = null;
    if (isBoss) {
      if (faction === 'cv') {
        // TROVÃO RUBRO: Ombreiras blindadas com morteiros de fogo + Coroa Dourada
        const redGlowMat = getLegoMaterial(0xef4444, { emissive: 0xdc2626, emissiveIntensity: 1.6 });
        for (const side of [-1, 1]) {
          const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.52), goldMat);
          pauldron.position.set(side * 0.56, 1.34, 0);
          const mortarTube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 10), blackMat);
          mortarTube.position.set(side * 0.48, 1.65, -0.18);
          mortarTube.rotation.x = -0.35;
          const flameTip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 8), redGlowMat);
          flameTip.position.set(side * 0.48, 1.92, -0.08);
          root.add(pauldron, mortarTube, flameTip);
        }
      } else if (faction === 'pcc') {
        // BLINDADO SUPREMO Z-15: Cúpula blindada azul-neon + Pods duplos de mísseis nos ombros
        const cyanGlowMat = getLegoMaterial(0x38bdf8, { emissive: 0x0284c7, emissiveIntensity: 1.8 });
        for (const side of [-1, 1]) {
          const missilePod = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.56), blackMat);
          missilePod.position.set(side * 0.56, 1.42, -0.05);
          const podFront = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.6), cyanGlowMat);
          podFront.position.set(side * 0.56, 1.42, -0.05);
          root.add(missilePod, podFront);
        }
      } else if (faction === 'ares') {
        // OVERLORD QUÂNTICO: Anel Eletromagnético Rotativo 3D + Ombreiras Douradas Quânticas
        const purpleGlow = getLegoMaterial(0xd946ef, { emissive: 0xa855f7, emissiveIntensity: 2.4 });
        for (const side of [-1, 1]) {
          const wingPylon = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.48), goldMat);
          wingPylon.position.set(side * 0.58, 1.42, -0.08);
          root.add(wingPylon);
        }
        bossShieldRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.95, 0.06, 10, 28),
          purpleGlow
        );
        bossShieldRing.position.set(0, 1.08, 0);
        root.add(bossShieldRing);
      }
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
      const bandanaMat = getLegoMaterial(isBoss ? 0xfacc15 : 0xdc2626);
      const redBandana = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.14, 14), bandanaMat);
      redBandana.position.set(0, 1.78, 0);
      const knot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), bandanaMat);
      knot.position.set(0, 1.74, -0.34);
      root.add(redBandana, knot);
    } else if (faction === 'pcc') {
      const hoodCap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 14), isBoss ? goldMat : blackMat);
      hoodCap.position.set(0, 1.8, 0);
      root.add(hoodCap);
    } else if (faction === 'ares') {
      const helmetTop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.2, 0.68), isBoss ? goldMat : torsoMat);
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
      const sIdx = (cfg.styleIdx || 0) % 4;
      const hairColors = [0x451a03, 0x090a0d, 0xd97706, 0x991b1b];
      const hMat = getLegoMaterial(cfg.hatColor || hairColors[sIdx]);
      if (sIdx === 0) {
        const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.15, 14), hMat);
        capCrown.position.set(0, 1.8, 0);
        const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.32), hMat);
        capBrim.position.set(0, 1.75, 0.26);
        root.add(capCrown, capBrim);
      } else if (sIdx === 1) {
        const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.66), hMat);
        hairTop.position.set(0, 1.82, 0.02);
        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.34, 0.18), hMat);
        hairBack.position.set(0, 1.66, -0.28);
        root.add(hairTop, hairBack);
      } else if (sIdx === 2) {
        const arc = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.14), hMat);
        arc.position.set(0, 1.86, 0);
        root.add(arc);
      }
    }

    // Braços Articulados + Escudo Tático dos Tanques + Arma 3D Detalhada
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.44, 1.26, 0);
    leftArm.add(new THREE.Mesh(NPC_ARM_GEO, torsoMat));

    // Escudo de Energia Translúcido 3D para os Tanques Pesados (Estilo Citron / All-Star PvZ GW2!)
    if (isTank) {
      leftArm.rotation.x = -Math.PI * 0.35;
      const shieldColor =
        faction === 'cv' ? 0xef4444 : faction === 'pcc' ? 0x38bdf8 : 0xd946ef;
      const shieldFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 1.18, 0.08),
        blackMat
      );
      shieldFrame.position.set(-0.08, -0.34, 0.36);
      shieldFrame.rotation.x = Math.PI * 0.35;
      const shieldGlass = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 1.06, 0.1),
        new THREE.MeshBasicMaterial({
          color: shieldColor,
          transparent: true,
          opacity: 0.65
        })
      );
      shieldGlass.position.copy(shieldFrame.position);
      shieldGlass.rotation.copy(shieldFrame.rotation);
      leftArm.add(shieldFrame, shieldGlass);
    }

    const rightArm = new THREE.Group();
    rightArm.position.set(0.44, 1.26, 0);
    rightArm.add(new THREE.Mesh(NPC_ARM_GEO, torsoMat));

    let muzzleFlashMesh = null;
    if (faction !== 'civilian') {
      rightArm.rotation.x = -Math.PI * 0.42;
      const isRpg = cfg.role === 'cv_rpg';
      const gunLen = isBoss ? 1.32 : isRpg ? 1.2 : isMecha || isTank ? 0.98 : 0.76;
      const gunColor = isMedic
        ? 0x22c55e
        : isBoss
          ? 0xfacc15
          : faction === 'ares'
            ? 0xa855f7
            : isRpg
              ? 0x3f6212
              : 0x1e293b;
      const gunGroup = new THREE.Group();
      gunGroup.position.set(0, -0.44, 0.28);
      gunGroup.rotation.x = Math.PI * 0.42;

      const receiver = new THREE.Mesh(
        new THREE.BoxGeometry(isBoss ? 0.2 : 0.12, isBoss ? 0.22 : 0.15, gunLen),
        getLegoMaterial(gunColor, { roughness: 0.25 })
      );
      gunGroup.add(receiver);

      if (isRpg) {
        const warhead = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.38, 8),
          getLegoMaterial(0xdc2626, { roughness: 0.2 })
        );
        warhead.rotation.x = Math.PI / 2;
        warhead.position.set(0, 0, gunLen * 0.55);
        gunGroup.add(warhead);
      } else {
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

    // Anel Verde Brilhante nos pés de todas as unidades da Facção Aliada do Jogador!
    let allyRing = null;
    if (faction !== 'civilian') {
      const aRingGeo = new THREE.TorusGeometry(0.64, 0.05, 8, 22);
      aRingGeo.rotateX(Math.PI / 2);
      allyRing = new THREE.Mesh(
        aRingGeo,
        new THREE.MeshBasicMaterial({ color: 0x22c55e })
      );
      allyRing.position.y = 0.06;
      allyRing.visible = false;
      root.add(allyRing);
    }

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
      healBeamMesh,
      bossShieldRing,
      allyRing,
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
   * Sistema de Escalada de Guerra Mundial (Estilo Bandeira de Poder / Invasão de Base do PvZ GW2):
   * - Cada inimigo eliminado aumenta a Barra de Escalada de Guerra Mundial (+18%).
   * - Ao chegar em 100% (ou a cada 4 abates na base inimiga), dispara uma ONDA DE CHEFÕES COLOSSAIS:
   *   Spawna o CHEFÃO GIGANTE INIMIGO + O CHEFÃO GIGANTE DA SUA FACÇÃO ALIADA para travarem um duelo titânico!
   */
  _recordFactionKillForEscalation(faction, deathPos) {
    if (faction === this.playerFaction) return;
    this.factionKills[faction] = (this.factionKills[faction] || 0) + 1;
    this.worldWarEscalation = Math.min(1.0, this.worldWarEscalation + 0.22);

    if (this.worldWarEscalation >= 1.0 && !this.bossWaveActive && this.bossWaveCooldown <= 0) {
      this.spawnWorldWarBossWave(faction, deathPos);
      return;
    }

    if (this.reinforcementCooldown > 0) return;

    if (this.factionKills[faction] % 3 === 0) {
      this.reinforcementCooldown = 14.0;
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
          '⚠️ ALERTA DE FACÇÃO: ESQUADRÃO DE ELITE + MÉDICO DESPACHADOS!',
          `Tropas de escudo, cientista médico e reforços da facção ${faction.toUpperCase()} chegaram!`,
          accent,
          'emergency',
          4200
        );
      }

      const roles =
        faction === 'cv'
          ? ['cv_tank', 'cv_medic', 'cv_rifle', 'cv_rpg']
          : faction === 'pcc'
            ? ['pcc_tank', 'pcc_medic', 'pcc_smg', 'pcc_c4']
            : ['ares_tank', 'ares_medic', 'ares_exo', 'ares_mecha'];

      roles.forEach((role, idx) => {
        const ang = (idx / roles.length) * Math.PI * 2 + Math.random() * 0.4;
        const sx = deathPos.x + Math.cos(ang) * 20.0;
        const sz = deathPos.z + Math.sin(ang) * 20.0;
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

  /**
   * Dispara uma Onda Épica de Chefões de Guerra Mundial (Chefão Inimigo vs Chefão Aliado + Médicos + Tanques)!
   */
  spawnWorldWarBossWave(enemyFaction, centerPos) {
    if (!['cv', 'pcc', 'ares'].includes(enemyFaction) || enemyFaction === this.playerFaction) {
      enemyFaction = this.playerFaction === 'cv' ? 'pcc' : 'cv';
    }
    this.bossWaveActive = true;
    this.bossWaveCooldown = 28.0;
    this.worldWarEscalation = 1.0;

    soundFX.playRadioAlertSiren();
    soundFX.setBossMusicIntensity(true);

    // 1. Spawna o CHEFÃO COLOSSAL INIMIGO (1200 HP, escala 2.42x) + 1 Médico Inimigo + 1 Tanque Inimigo
    const enemyBossRole = `${enemyFaction}_boss`;
    const eX = centerPos.x + 18.0;
    const eZ = centerPos.z - 8.0;
    const enemyBoss = this._spawnCombatNpc({
      faction: enemyFaction,
      role: enemyBossRole,
      x: eX,
      z: eZ,
      homeX: centerPos.x,
      homeZ: centerPos.z
    });
    this._spawnCombatNpc({
      faction: enemyFaction,
      role: `${enemyFaction}_medic`,
      x: eX + 4.5,
      z: eZ + 3.5,
      homeX: centerPos.x,
      homeZ: centerPos.z
    });
    this._spawnCombatNpc({
      faction: enemyFaction,
      role: `${enemyFaction}_tank`,
      x: eX - 4.5,
      z: eZ + 3.5,
      homeX: centerPos.x,
      homeZ: centerPos.z
    });

    // 2. Spawna também o CHEFÃO COLOSSAL DA SUA FACÇÃO ALIADA + 1 Médico Aliado para lutar ao seu lado!
    const allyFaction = this.playerFaction || 'cv';
    const hasAliveAllyBoss = this.activeBosses.some(
      (b) => b.faction === allyFaction && b.destructible && !b.destructible.destroyed
    );
    if (!hasAliveAllyBoss) {
      const aX = centerPos.x - 16.0;
      const aZ = centerPos.z + 8.0;
      this._spawnCombatNpc({
        faction: allyFaction,
        role: `${allyFaction}_boss`,
        x: aX,
        z: aZ,
        homeX: centerPos.x,
        homeZ: centerPos.z
      });
      this._spawnCombatNpc({
        faction: allyFaction,
        role: `${allyFaction}_medic`,
        x: aX - 3.5,
        z: aZ - 3.5,
        homeX: centerPos.x,
        homeZ: centerPos.z
      });
    }

    if (this.hud && typeof this.hud.showTacticalAlertToast === 'function') {
      const accent =
        enemyFaction === 'cv' ? '#ef4444' : enemyFaction === 'pcc' ? '#38bdf8' : '#d946ef';
      this.hud.showTacticalAlertToast(
        'GUERRA MUNDIAL // ONDA DE CHEFÕES COLOSSAIS!',
        `⚠️ ${enemyBoss.name} ENTROU EM CAMPO!`,
        `O Colosso da sua Facção Aliada (${allyFaction.toUpperCase()}) também avançou para o confronto!`,
        accent,
        'emergency',
        5200
      );
    }
  }

  /**
   * Cria uma Estação de Cura LEGO 3D no chão (Totem Médico com Cruz Verde + Anel Pulsante de Cura em Área de 6.8m)!
   */
  _spawnLegoHealStation(pos, faction = 'cv', permanent = false) {
    const groundY = this.world.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(pos.x, pos.z)
      : 0;
    const group = new THREE.Group();
    const whiteMat = getLegoMaterial(0xf8fafc, { roughness: 0.2 });
    const greenGlow = getLegoMaterial(0x22c55e, {
      emissive: 0x16a34a,
      emissiveIntensity: 2.0,
      roughness: 0.15
    });

    const basePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.28, 12), whiteMat);
    basePedestal.position.y = 0.14;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 1.25, 10), whiteMat);
    pillar.position.y = 0.85;

    const crossGroup = new THREE.Group();
    const cV = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.24), greenGlow);
    const cH = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.24), greenGlow);
    crossGroup.add(cV, cH);
    crossGroup.position.y = 1.72;

    const auraGeo = new THREE.TorusGeometry(5.8, 0.09, 8, 28);
    auraGeo.rotateX(Math.PI / 2);
    const auraRing = new THREE.Mesh(
      auraGeo,
      new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.75
      })
    );
    auraRing.position.y = 0.1;

    group.add(basePedestal, pillar, crossGroup, auraRing);
    group.position.set(pos.x, Math.max(0.05, groundY), pos.z);
    this.scene.add(group);

    this.healStations.push({
      group,
      crossGroup,
      auraRing,
      faction,
      permanent,
      life: permanent ? 999999 : 16.0,
      radius: 6.5
    });
  }

  /**
   * Cria um Cristal Verde de Vida 3D (+50 HP) quando um inimigo é derrotado!
   */
  _spawnHealthCrystal(pos) {
    const groundY = this.world.getTerrainHeightAt
      ? this.world.getTerrainHeightAt(pos.x, pos.z)
      : 0;
    const crystalGroup = new THREE.Group();
    const crystalMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), crystalMat);
    coreMesh.scale.set(0.85, 1.35, 0.85);
    const ringGeo = new THREE.TorusGeometry(0.55, 0.04, 6, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ringMesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x86efac })
    );
    crystalGroup.add(coreMesh, ringMesh);
    crystalGroup.position.set(pos.x, Math.max(0.75, groundY + 0.75), pos.z);
    this.scene.add(crystalGroup);

    this.healthCrystals.push({
      mesh: crystalGroup,
      baseY: Math.max(0.75, groundY + 0.75),
      healAmount: 50,
      life: 24.0,
      age: 0
    });
  }

  _updateHealthCrystalsAndHealStations(dt, playerPos) {
    // 1. Atualiza Cristais Verdes de Vida (+50 HP ao pegar!)
    for (let i = this.healthCrystals.length - 1; i >= 0; i--) {
      const c = this.healthCrystals[i];
      c.age += dt;
      c.life -= dt;
      c.mesh.rotation.y += dt * 3.2;
      c.mesh.position.y = c.baseY + Math.sin(c.age * 4.5) * 0.18;

      if (playerPos) {
        const dx = playerPos.x - c.mesh.position.x;
        const dz = playerPos.z - c.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        // Puxão magnético quando o jogador chega a 8.5m!
        if (dist < 8.5 && dist > 1.2) {
          c.mesh.position.x += (dx / dist) * 16.0 * dt;
          c.mesh.position.z += (dz / dist) * 16.0 * dt;
        }
        if (dist <= 1.65) {
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + c.healAmount);
          soundFX.playHealTick();
          if (this.hud) {
            this.hud.setPlayerHealth(this.playerHp, this.playerMaxHp, true);
          }
          this.scene.remove(c.mesh);
          this.healthCrystals.splice(i, 1);
          continue;
        }
      }

      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        this.healthCrystals.splice(i, 1);
      }
    }

    // 2. Atualiza Estações de Cura 3D no chão (Curam o jogador e aliados próximos!)
    for (let i = this.healStations.length - 1; i >= 0; i--) {
      const st = this.healStations[i];
      if (!st.permanent) {
        st.life -= dt;
      }
      st.crossGroup.rotation.y += dt * 2.4;
      const pulse = 0.94 + Math.sin(performance.now() * 0.006) * 0.06;
      st.auraRing.scale.set(pulse, pulse, 1);

      const isAlliedStation = this._isFactionAlliedToPlayer(st.faction);
      if (isAlliedStation && playerPos && this.playerHp < this.playerMaxHp) {
        const dP = Math.hypot(
          playerPos.x - st.group.position.x,
          playerPos.z - st.group.position.z
        );
        if (dP <= st.radius) {
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 18.0 * dt);
          this.playerBeingHealed = true;
        }
      }

      if (!st.permanent && st.life <= 0) {
        this.scene.remove(st.group);
        this.healStations.splice(i, 1);
      }
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
        this._syncNpcAllegiance(npc);
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
        this._syncNpcAllegiance(newCop);
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
  // 7. IA DE GUERRA MUNDIAL + RAIO DE CURA 3D DOS MÉDICOS + CHEFÕES COLOSSAIS!
  // ============================================================================
  _updateCombatNpcs(dt, playerPos, controller) {
    if (this.pccHeli && this.pccHeli.destructible && !this.pccHeli.destructible.destroyed) {
      const h = this.pccHeli;
      h.destructible.isAlliedToPlayer = this.playerFaction === 'pcc';
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
      if (!obj || obj.destroyed) {
        if (npc.visual?.healBeamMesh) {
          npc.visual.healBeamMesh.visible = false;
        }
        continue;
      }

      const root = npc.visual.root;
      if (playerPos) {
        const dSq = (root.position.x - playerPos.x) ** 2 + (root.position.z - playerPos.z) ** 2;
        root.visible = dSq <= 410 * 410;
        if (!root.visible) continue;
      }

      npc.animTime += dt;
      npc.fireCooldown = Math.max(0, npc.fireCooldown - dt);

      // Gira o Anel de Escudo Eletromagnético do Overlord Quântico (A.R.E.S. Boss)
      if (npc.visual.bossShieldRing) {
        npc.visual.bossShieldRing.rotation.y += dt * 2.8;
        npc.visual.bossShieldRing.rotation.x = Math.sin(npc.animTime * 2.2) * 0.35;
      }

      // Atualiza Clarão de Disparo (Muzzle Flash)
      if (npc.muzzleFlashTimer > 0) {
        npc.muzzleFlashTimer -= dt;
        if (npc.muzzleFlashTimer <= 0 && npc.visual.muzzleFlashMesh) {
          npc.visual.muzzleFlashMesh.visible = false;
        }
      }

      // Atualiza Escala e Piscar de Dano (Hit Flash) respeitando o tamanho de Chefão / Mecha / Tanque!
      const baseScaleX = npc.isBoss ? 2.42 : npc.isMecha ? 1.85 : npc.isTank ? 1.28 : 1.0;
      const baseScaleY = npc.isBoss ? 2.38 : npc.isMecha ? 1.75 : npc.isTank ? 1.24 : 1.0;
      if (npc.hitFlashTimer > 0) {
        npc.hitFlashTimer -= dt;
        const sMul = 1.0 + Math.sin(npc.hitFlashTimer * 40) * 0.06;
        root.scale.set(baseScaleX * sMul, baseScaleY * sMul, baseScaleX * sMul);
      } else {
        root.scale.set(baseScaleX, baseScaleY, baseScaleX);
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

      // ----------------------------------------------------------------------
      // LÓGICA DE CURA CONTÍNUA 3D DOS MÉDICOS / CIENTISTAS (ESTILO PVZ GW2!)
      // ----------------------------------------------------------------------
      let healingTargetPos = null;
      if (npc.isMedic && npc.visual.healBeamMesh) {
        npc.healStationCooldown -= dt;
        if (npc.healStationCooldown <= 0 && this.healStations.length < 10) {
          npc.healStationCooldown = 22.0;
          this._spawnLegoHealStation(root.position, npc.faction, false);
        }

        // 1) Se for Médico da Facção Aliada do Jogador e o jogador estiver com menos de 250 HP (até 26m), CURA O JOGADOR!
        if (npc.isAlliedToPlayer && playerPos && this.playerHp < this.playerMaxHp) {
          const dP = Math.hypot(playerPos.x - root.position.x, playerPos.z - root.position.z);
          if (dP <= 26.0) {
            this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 20.0 * dt);
            this.playerBeingHealed = true;
            healingTargetPos = new THREE.Vector3(playerPos.x, playerPos.y + 1.1, playerPos.z);
          }
        }

        // 2) Se não estiver curando o jogador, procura um Chefão, Tanque ou Soldado da mesma facção ferido até 24m!
        if (!healingTargetPos) {
          let bestWounded = null;
          let bestWoundedDist = 24.0;
          for (const ally of this.combatNpcs) {
            if (ally === npc || ally.faction !== npc.faction || !ally.destructible || ally.destructible.destroyed) {
              continue;
            }
            if (ally.destructible.hp < ally.destructible.maxHp) {
              const dA = Math.hypot(
                ally.visual.root.position.x - root.position.x,
                ally.visual.root.position.z - root.position.z
              );
              // Prioriza curar Chefões e Tanques!
              const priorityBonus = ally.isBoss ? -8.0 : ally.isTank ? -4.0 : 0;
              if (dA + priorityBonus < bestWoundedDist) {
                bestWoundedDist = dA + priorityBonus;
                bestWounded = ally;
              }
            }
          }
          if (bestWounded) {
            bestWounded.destructible.hp = Math.min(
              bestWounded.destructible.maxHp,
              bestWounded.destructible.hp + 18.0 * dt
            );
            if (bestWounded.visual.hpFillMesh) {
              bestWounded.visual.hpFillMesh.scale.x = Math.min(
                1,
                bestWounded.destructible.hp / bestWounded.destructible.maxHp
              );
            }
            const aPos = bestWounded.visual.root.position;
            healingTargetPos = new THREE.Vector3(
              aPos.x,
              aPos.y + (bestWounded.isBoss ? 2.4 : 1.15),
              aPos.z
            );
          }
        }

        if (healingTargetPos) {
          const beam = npc.visual.healBeamMesh;
          beam.visible = true;
          const beamWorldStart = new THREE.Vector3(
            root.position.x,
            root.position.y + 1.15 * baseScaleY,
            root.position.z
          );
          const distBeam = Math.max(0.5, beamWorldStart.distanceTo(healingTargetPos));
          root.rotation.y = Math.atan2(
            healingTargetPos.x - root.position.x,
            healingTargetPos.z - root.position.z
          );
          beam.scale.set(
            0.85 + Math.sin(npc.animTime * 18.0) * 0.2,
            0.85 + Math.sin(npc.animTime * 18.0) * 0.2,
            distBeam / baseScaleX
          );
        } else {
          npc.visual.healBeamMesh.visible = false;
        }
      }

      const target = this._findBestTargetForPosition(
        npc.faction,
        root.position,
        npc.attackRange,
        playerPos,
        controller,
        npc.isAlliedToPlayer
      );

      let moveDirX = 0;
      let moveDirZ = 0;
      let isMoving = false;

      if ((npc.isRecruitedByPlayer || npc.isEscortingPlayer || (npc.isMedic && npc.isAlliedToPlayer && this.playerHp < this.playerMaxHp)) && playerPos) {
        const dxP = playerPos.x - root.position.x;
        const dzP = playerPos.z - root.position.z;
        const distP = Math.hypot(dxP, dzP);
        if (distP > 7.5 && distP < 85.0) {
          moveDirX = dxP / distP;
          moveDirZ = dzP / distP;
          isMoving = true;
        }
      } else if (target) {
        const dxT = target.pos.x - root.position.x;
        const dzT = target.pos.z - root.position.z;
        const distT = Math.hypot(dxT, dzT);
        const preferredDist = npc.isBoss || npc.isTank ? 11.0 : 16.0;
        if (distT > preferredDist) {
          moveDirX = dxT / distT;
          moveDirZ = dzT / distT;
          isMoving = true;
        } else if (distT < 7.0 && !npc.isBoss && !npc.isTank) {
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
        const spd = npc.isRecruitedByPlayer || npc.isEscortingPlayer ? 11.0 : npc.moveSpeed;
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

      if (target && !healingTargetPos) {
        root.rotation.y = Math.atan2(target.pos.x - root.position.x, target.pos.z - root.position.z);
        if (npc.fireCooldown <= 0) {
          npc.fireCooldown = npc.fireInterval * (0.85 + Math.random() * 0.35);
          const muzzleOrigin = new THREE.Vector3(
            root.position.x + Math.sin(root.rotation.y) * (npc.isBoss ? 1.8 : 0.85),
            root.position.y + (npc.isBoss ? 2.6 : npc.isMecha ? 2.1 : npc.isDrone ? 0.0 : 1.15),
            root.position.z + Math.cos(root.rotation.y) * (npc.isBoss ? 1.8 : 0.85)
          );
          if (npc.visual.muzzleFlashMesh) {
            npc.visual.muzzleFlashMesh.visible = true;
            npc.visual.muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
            npc.muzzleFlashTimer = 0.065;
          }
          this._fireNpcWeapon(
            npc.faction,
            npc.role,
            muzzleOrigin,
            target.pos,
            playerPos,
            false,
            npc.isAlliedToPlayer
          );
        }
      } else if (isMoving && !healingTargetPos) {
        root.rotation.y = Math.atan2(moveDirX, moveDirZ);
      }

      if (!npc.isDrone && npc.visual.leftLeg && npc.visual.rightLeg) {
        const swing = isMoving ? Math.sin(npc.animTime * 9.0) * 0.55 : 0;
        npc.visual.leftLeg.rotation.x = swing;
        npc.visual.rightLeg.rotation.x = -swing;
      }
    }
  }

  _findBestTargetForPosition(myFaction, myPos, maxRange, playerPos, controller, isAlliedUnit = false) {
    let bestTarget = null;
    let bestScore = maxRange;
    const iAmAllied = isAlliedUnit || this._isFactionAlliedToPlayer(myFaction);

    for (const other of this.combatNpcs) {
      if (other.faction === myFaction || !other.destructible || other.destructible.destroyed) continue;
      if (iAmAllied && other.isAlliedToPlayer) continue;
      const oPos = other.visual.root.position;
      const d = Math.hypot(oPos.x - myPos.x, oPos.z - myPos.z);
      // Prioriza focar Chefões Rivais na Guerra Mundial!
      const bossPriority = other.isBoss ? -12.0 : 0;
      if (d + bossPriority < bestScore) {
        bestScore = d + bossPriority;
        bestTarget = {
          type: 'npc',
          npc: other,
          pos: new THREE.Vector3(
            oPos.x,
            oPos.y + (other.isBoss ? 2.4 : other.isMecha ? 1.8 : 1.0),
            oPos.z
          )
        };
      }
    }

    // Unidades da Facção Aliada do Jogador NUNCA miram no jogador!
    if (!iAmAllied && playerPos && (!controller || !(controller.stealthTimer > 0))) {
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

  _fireNpcWeapon(faction, role, origin, targetPos, playerPos = null, isConvoyFire = false, isAlliedShot = false) {
    this.triggerPedestrianPanicNear(origin, 44.0);

    const isBoss = ['cv_boss', 'pcc_boss', 'ares_boss'].includes(role);
    const isRpg = role === 'cv_rpg' || role === 'pcc_c4' || isBoss;
    const isTankOrExo = String(role || '').endsWith('_tank') || role === 'ares_exo' || role === 'ares_drone';
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
    const scaleXY = isBoss ? 3.1 : isRpg ? 2.4 : 1.3;
    projMesh.scale.set(scaleXY, scaleXY, isLaser ? 2.8 : 1.8);
    projMesh.position.copy(origin);
    projMesh.lookAt(origin.clone().add(dir));
    this.scene.add(projMesh);

    // Dano Específico Balanceado (para o Sistema de 250 HP do Jogador!):
    // - Soldado Comum: 4 de dano
    // - Tanque / Exoesqueleto / Drone: 8 de dano
    // - RPG / Mecha / Chefão Colossal: 18 de dano
    const playerSpecificDamage = isBoss || isRpg || role === 'ares_mecha' ? 18 : isTankOrExo ? 8 : 4;
    const npcVsNpcDamage = isBoss ? 38 : isRpg ? 26 : role === 'ares_mecha' ? 18 : 12;

    const speed = isRpg ? 38.0 : isLaser ? 68.0 : 58.0;
    this.npcProjectiles.push({
      mesh: projMesh,
      faction,
      isAlliedShot,
      isRpg,
      isConvoyFire,
      vel: dir.multiplyScalar(speed),
      life: 1.35,
      damage: npcVsNpcDamage,
      playerDamage: playerSpecificDamage
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
        if (p.isAlliedShot && npc.isAlliedToPlayer) continue;
        const nPos = npc.visual.root.position;
        const dH = Math.hypot(p.mesh.position.x - nPos.x, p.mesh.position.z - nPos.z);
        const dV = Math.abs(p.mesh.position.y - (nPos.y + 1.0));
        const hitRad = npc.isBoss ? 2.3 : npc.isMecha ? 1.6 : 0.95;
        const hitHeight = npc.isBoss ? 3.4 : npc.isMecha ? 2.2 : 1.3;
        if (dH <= hitRad && dV <= hitHeight) {
          if (this.destructibles) {
            this.destructibles.damageObject(npc.destructible, p.damage, p.mesh.position, false, {
              fromEnemyNpc: true
            });
          }
          hit = true;
          break;
        }
      }

      // Tiros de facções inimigas acertam o jogador com Dano Específico Balanceado (Aliados nunca causam dano!)
      if (!hit && !p.isAlliedShot && !this._isFactionAlliedToPlayer(p.faction) && playerPos) {
        const dH = Math.hypot(p.mesh.position.x - playerPos.x, p.mesh.position.z - playerPos.z);
        const dV = Math.abs(p.mesh.position.y - (playerPos.y + 1.0));
        if (dH <= 0.95 && dV <= 1.25) {
          this._applyPlayerHitDamage(controller, p.playerDamage || 4);
          hit = true;
        }
      }

      if (hit || p.life <= 0 || p.mesh.position.y <= 0.15) {
        this.scene.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
      }
    }
  }

  _applyPlayerHitDamage(controller, rawDamage = 4) {
    if (!this.hud || this.playerHitInvulnTimer > 0) return;
    if (
      controller &&
      (controller.stealthTimer > 0 ||
        controller.vingadorDiveTimer > 0 ||
        controller.minifigure?.rollTimer > 0)
    ) {
      return;
    }

    this.playerHitInvulnTimer = 0.28;
    this.timeSinceLastHit = 0.0;
    this.playerHp = Math.max(0, this.playerHp - rawDamage);

    // Se o HP chegar a 0, aciona Resgate Médico Tático da sua Facção Aliada (sem Game Over frustrante!)
    if (this.playerHp <= 0) {
      this.playerHp = this.playerMaxHp;
      this.playerHitInvulnTimer = 2.5;
      if (controller?.position && this.destructibles) {
        this.destructibles.spawnHeroSwapEffect(controller.position, 0x22c55e);
      }
      if (this.hud && typeof this.hud.showTacticalAlertToast === 'function') {
        this.hud.showTacticalAlertToast(
          'SUPORTE MÉDICO ALIADO // REANIMAÇÃO TÁTICA!',
          'CIENTISTA ALIADO RESTAUROU 250 / 250 HP!',
          'O Médico da sua Facção Aliada aplicou Desfibrilador Quântico de Emergência!',
          '#22c55e',
          'police',
          3600
        );
      }
    }

    if (this.hud && typeof this.hud.setPlayerHealth === 'function') {
      this.hud.setPlayerHealth(this.playerHp, this.playerMaxHp, this.playerBeingHealed);
    }
  }

  update(dt, playerPos, controller = null) {
    this.caveiraSupportCooldown = Math.max(0, this.caveiraSupportCooldown - dt);
    this.reinforcementCooldown = Math.max(0, this.reinforcementCooldown - dt);
    this.bossWaveCooldown = Math.max(0, this.bossWaveCooldown - dt);
    this._npcGunSoundCooldown = Math.max(0, this._npcGunSoundCooldown - dt);

    if (this.playerHitInvulnTimer > 0) {
      this.playerHitInvulnTimer = Math.max(0, this.playerHitInvulnTimer - dt);
    }

    this.playerBeingHealed = false;
    this.timeSinceLastHit += dt;

    // Auto-Regeneração Tática fora de combate (após 3.5s sem tomar tiro, regenera +25 HP/s até 250 HP!)
    if (this.timeSinceLastHit >= 3.5 && this.playerHp < this.playerMaxHp) {
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 25.0 * dt);
      this.playerBeingHealed = true;
    }

    // Gira o cristal da Bandeira Central de Guerra Mundial
    if (this.centralFlagBeacon) {
      this.centralFlagBeacon.topCrown.rotation.y += dt * 1.8;
    }

    // Se o jogador estiver no Front Central ou invadindo a base de uma facção rival, sobe gradualmente a Escalada de Guerra Mundial!
    if (playerPos && !this.bossWaveActive) {
      const inCentralFront = Math.hypot(playerPos.x - 0, playerPos.z - -96) < 68.0;
      const inEnemyCdd = this.playerFaction !== 'cv' && playerPos.x < -480;
      const inEnemyPcc = this.playerFaction !== 'pcc' && playerPos.x > 550 && playerPos.z < 50;
      const inEnemyAres = this.playerFaction !== 'ares' && ((playerPos.x > 740 && playerPos.z > 120) || playerPos.x < -1050);

      if (inCentralFront || inEnemyCdd || inEnemyPcc || inEnemyAres) {
        this.worldWarEscalation = Math.min(1.0, this.worldWarEscalation + dt * 0.018);
        if (this.worldWarEscalation >= 1.0 && this.bossWaveCooldown <= 0) {
          const invadedFaction = inEnemyCdd
            ? 'cv'
            : inEnemyPcc
              ? 'pcc'
              : inEnemyAres
                ? 'ares'
                : this.playerFaction === 'cv'
                  ? 'pcc'
                  : 'cv';
          this.spawnWorldWarBossWave(invadedFaction, playerPos);
        }
      }
    }

    this._updateUrbanTraffic(dt, playerPos);
    this._updateArmoredConvoyEvent(dt, playerPos);
    this._updatePedestrians(dt, playerPos);
    this._updateCombatNpcs(dt, playerPos, controller);
    this._updateNpcProjectiles(dt, playerPos, controller);
    this._updateHealthCrystalsAndHealStations(dt, playerPos);

    if (this.playerBeingHealed) {
      this._healChimeTimer -= dt;
      if (this._healChimeTimer <= 0) {
        this._healChimeTimer = 0.65;
        soundFX.playHealTick();
      }
    }

    if (this.hud) {
      if (typeof this.hud.setPlayerHealth === 'function') {
        this.hud.setPlayerHealth(this.playerHp, this.playerMaxHp, this.playerBeingHealed);
      }
      if (typeof this.hud.updateWorldWarHud === 'function') {
        this.activeBosses = this.activeBosses.filter(
          (b) => b.destructible && !b.destructible.destroyed
        );
        const bossHudData = this.activeBosses.map((b) => ({
          name: b.name,
          faction: b.faction,
          hp: b.destructible.hp,
          maxHp: b.destructible.maxHp,
          isAlly: b.isAlliedToPlayer
        }));
        this.hud.updateWorldWarHud(this.worldWarEscalation, bossHudData, this.bossWaveActive);
      }
    }
  }
}
