import * as THREE from 'three';
import {
  LEGO_COLORS,
  SHARED_STUD_GEO,
  getLegoMaterial,
  createLegoBrick,
  getSharedNpcFaceMaterial
} from '../materials/LegoMaterials.js';
import { mergeBufferGeometries } from './BuildingGenerator.js';
import { VEHICLE_SPECS, createLegoCarMesh } from './VehicleFleetBuilder.js';
import { createSignBoardMesh } from '../utils/SignBoardHelper.js';
import { soundFX } from '../audio/SoundFX.js';
import { createFactionSoldierVisual, animateFactionSoldier, AIM_POSE } from '../entities/FactionSoldierBuilder.js';
import { CaptureZone } from './events/CaptureZone.js';
import { buildFactionSquad } from './events/WaveDirector.js';
import { ObjectiveHud } from '../ui/ObjectiveHud.js';
import { TerritoryCounterAttack } from './events/TerritoryCounterAttack.js';
import { BankHeistEvent } from './events/BankHeistEvent.js';
import { BANK_SPEC } from './regions/SuperBankBuilder.js';

// Temas extras (não são territórios): polícia aliada no Mega Assalto
const EXTRA_THEMES = {
  guard: {
    id: 'guard',
    shortTag: 'SEGURANÇA',
    name: 'SEGURANÇA DO BANCO',
    color: '#f1f5f9',
    hex: 0xf1f5f9,
    darkHex: 0x1f2937,
    secondaryHex: 0x111827,
    accentHex: 0xfacc15,
    convoyVehicles: ['suv_pcc'],
    bossTitle: 'CHEFE DA SEGURANÇA'
  },
  pf: {
    id: 'pf',
    shortTag: 'PF',
    name: 'POLÍCIA FEDERAL',
    color: '#facc15',
    hex: 0x0f1d3a,
    darkHex: 0x0b1226,
    secondaryHex: 0x0a0b0f,
    accentHex: 0xfacc15,
    convoyVehicles: ['suv_pcc'],
    bossTitle: 'DELEGADO FEDERAL'
  },
  bope: {
    id: 'bope',
    shortTag: 'BOPE',
    name: 'BOPE',
    color: '#facc15',
    hex: 0x15161a,
    darkHex: 0x0b0c0f,
    secondaryHex: 0x1f2328,
    accentHex: 0xfacc15,
    convoyVehicles: ['suv_pcc'],
    bossTitle: 'CAPITÃO DO BOPE'
  }
};

// Regras da Invasão em Sequência (Gardens & Graveyards)
export const INVASION_RULES = {
  startClock: 240, // 4:00 iniciais
  clockPerCapture: 90, // +1:30 por posto tomado
  captureRadius: 13,
  captureTime: 10,
  reinforceInterval: 13,
  enemyCapBase: 8,
  enemyCapPerPoint: 3
};

const ALLY_MARKER_MAT = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
const ALLY_BULLET_MAT = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
const ROCKET_MAT = new THREE.MeshBasicMaterial({ color: 0x84cc16 });
const BULLET_MATS = new Map();
function getFactionBulletMat(faction, hex) {
  if (!BULLET_MATS.has(faction)) BULLET_MATS.set(faction, new THREE.MeshBasicMaterial({ color: hex }));
  return BULLET_MATS.get(faction);
}

// ============================================================================
// TEMA VISUAL E CATÁLOGO OFICIAL DOS 3 TERRITÓRIOS DE FACÇÃO
// ============================================================================
export const FACTION_THEME = {
  cv: {
    id: 'cv',
    shortTag: 'CV',
    name: 'COMANDO VERMELHO',
    color: '#ef4444',
    hex: 0xef4444,
    darkHex: 0x991b1b,
    secondaryHex: 0x090a0d,
    accentHex: 0xfacc15,
    icon: 'cdd',
    convoyVehicles: ['picape_cv', 'suv_pcc'],
    bossTitle: 'TROVÃO RUBRO'
  },
  pcc: {
    id: 'pcc',
    shortTag: 'PCC',
    name: 'PRIMEIRO COMANDO',
    color: '#38bdf8',
    hex: 0x38bdf8,
    darkHex: 0x1d4ed8,
    secondaryHex: 0x0f172a,
    accentHex: 0xcbd5e1,
    icon: 'pcc',
    convoyVehicles: ['suv_pcc', 'van_pcc'],
    bossTitle: 'BLINDADO SUPREMO Z-15'
  },
  ares: {
    id: 'ares',
    shortTag: 'A.R.E.S.',
    name: 'SYNDICATO A.R.E.S.',
    color: '#d946ef',
    hex: 0xd946ef,
    darkHex: 0x701a75,
    secondaryHex: 0x334155,
    accentHex: 0xfacc15,
    icon: 'ares',
    convoyVehicles: ['hover_apc_ares', 'interceptor_v8'],
    bossTitle: 'OVERLORD QUÂNTICO'
  }
};

export const TERRITORY_ZONES = {
  cv: {
    id: 'cv',
    defaultOwner: 'cv',
    title: 'COMPLEXO DA CIDADE DE DEUS',
    subTitle: 'TERRITÓRIO OFICIAL // MORRO OESTE',
    bounds: { minX: -1012, maxX: -528, minZ: -520, maxZ: 420 },
    mapBadgePos: { x: -770, z: 365 },
    safeExitGate: { x: -508, z: 134 },
    gates: [
      {
        id: 'cv_gate_main',
        x: -528,
        z: 134,
        rotY: Math.PI / 2,
        title: 'TERRITÓRIO CV // CDD',
        subText: 'ENTRADA PRINCIPAL LESTE'
      },
      {
        id: 'cv_gate_central',
        x: -528,
        z: -117,
        rotY: Math.PI / 2,
        title: 'FORTALEZA DO MORRO',
        subText: 'POSTO DE FRONTEIRA CV'
      }
    ],
    garages: [
      {
        id: 'cv_garage_1',
        x: -560,
        z: 158,
        rotY: 0,
        title: 'GARAGEM DO TIME CV 01',
        fleet: [
          { type: 'picape_cv', color: 0xdc2626, roofColor: 0x090a0d, dx: -5.4, dz: 0 },
          { type: 'moto_cv', color: 0xef4444, roofColor: 0x090a0d, dx: 0, dz: 0 },
          {
            type: 'suv_pcc',
            color: 0xb91c1c,
            roofColor: 0x090a0d,
            customName: 'SUV BLINDADO RUBRO (CV)',
            dx: 5.4,
            dz: 0
          }
        ]
      },
      {
        id: 'cv_garage_2',
        x: -705,
        z: -52,
        rotY: Math.PI,
        title: 'GARAGEM DO BAILE CV 02',
        fleet: [
          { type: 'picape_cv', color: 0x991b1b, roofColor: 0x090a0d, dx: -5.4, dz: 0 },
          {
            type: 'suv_pcc',
            color: 0xdc2626,
            roofColor: 0x111827,
            customName: 'SUV BLINDADO RUBRO (CV)',
            dx: 0,
            dz: 0
          },
          { type: 'moto_cv', color: 0xef4444, roofColor: 0x090a0d, dx: 5.4, dz: 0 }
        ]
      }
    ],
    outposts: [
      { id: 'cv_p1', code: 'P1', name: 'POSTO P1 — ACESSO NORTE CDD', x: -605, z: -355 },
      { id: 'cv_p2', code: 'P2', name: 'POSTO P2 — QUADRA DO BAILE', x: -705, z: -82 },
      { id: 'cv_p3', code: 'P3', name: 'POSTO P3 — TOPO DO MORRO', x: -828, z: -228 }
    ],
    bossCourtyard: { x: -805, z: -205 },
    alliedBossSpawn: { x: -762, z: -182 },
    alliedEntryRoutes: [
      { startX: -514, startZ: 134, targetX: -578, targetZ: 134 },
      { startX: -520, startZ: -5, targetX: -622, targetZ: -5 }
    ],
    defenderMotorRoutes: [
      { startX: -692, startZ: 38, targetX: -598, targetZ: 115 },
      { startX: -755, startZ: -5, targetX: -658, targetZ: -5 }
    ]
  },

  pcc: {
    id: 'pcc',
    defaultOwner: 'pcc',
    title: 'DISTRITO INDUSTRIAL & CIDADELA',
    subTitle: 'TERRITÓRIO OFICIAL // BUNKER LESTE',
    bounds: { minX: 580, maxX: 1580, minZ: -620, maxZ: 110 },
    mapBadgePos: { x: 1080, z: -555 },
    safeExitGate: { x: 516, z: -117 },
    gates: [
      {
        id: 'pcc_gate_main',
        x: 604,
        z: -117,
        rotY: -Math.PI / 2,
        title: 'TERRITÓRIO PCC // CIDADELA',
        subText: 'PORTÃO BLINDADO CENTRAL'
      },
      {
        id: 'pcc_gate_north',
        x: 604,
        z: -250,
        rotY: -Math.PI / 2,
        title: 'SINDICATO INDUSTRIAL PCC',
        subText: 'PORTÃO TÁTICO NORTE'
      }
    ],
    garages: [
      {
        id: 'pcc_garage_1',
        x: 646,
        z: -185,
        rotY: 0,
        title: 'GARAGEM EXECUTIVA PCC 01',
        fleet: [
          { type: 'suv_pcc', color: 0x1d4ed8, roofColor: 0xcbd5e1, dx: -5.5, dz: 0 },
          { type: 'van_pcc', color: 0x0f172a, roofColor: 0x38bdf8, dx: 0, dz: 0 },
          { type: 'moto_pcc', color: 0x2563eb, roofColor: 0xe2e8f0, dx: 5.5, dz: 0 }
        ]
      },
      {
        id: 'pcc_garage_2',
        x: 1025,
        z: -265,
        rotY: Math.PI,
        title: 'GARAGEM BLINDADA PCC 02',
        fleet: [
          { type: 'van_pcc', color: 0x1e3a8a, roofColor: 0xcbd5e1, dx: -5.5, dz: 0 },
          { type: 'suv_pcc', color: 0x090a0d, roofColor: 0x38bdf8, dx: 0, dz: 0 },
          { type: 'moto_pcc', color: 0x38bdf8, roofColor: 0x090a0d, dx: 5.5, dz: 0 }
        ]
      }
    ],
    outposts: [
      { id: 'pcc_p1', code: 'P1', name: 'POSTO P1 — AVENIDA DA PONTE', x: 652, z: -117 },
      { id: 'pcc_p2', code: 'P2', name: 'POSTO P2 — PÁTIO DA CIDADELA', x: 850, z: -300 },
      { id: 'pcc_p3', code: 'P3', name: 'POSTO P3 — TERMINAL LESTE', x: 1060, z: -195 }
    ],
    bossCourtyard: { x: 885, z: -300 },
    alliedBossSpawn: { x: 832, z: -300 },
    alliedEntryRoutes: [
      { startX: 590, startZ: -117, targetX: 678, targetZ: -117 },
      { startX: 590, startZ: -250, targetX: 686, targetZ: -250 }
    ],
    defenderMotorRoutes: [
      { startX: 835, startZ: -117, targetX: 715, targetZ: -117 },
      { startX: 965, startZ: -250, targetX: 805, targetZ: -250 }
    ]
  },

  ares: {
    id: 'ares',
    defaultOwner: 'ares',
    title: 'PORTO BLINDADO SUDESTE',
    subTitle: 'TERRITÓRIO OFICIAL // DOCAS A.R.E.S.',
    bounds: { minX: 580, maxX: 1620, minZ: 120, maxZ: 740 },
    mapBadgePos: { x: 1100, z: 685 },
    safeExitGate: { x: 516, z: 140 },
    gates: [
      {
        id: 'ares_gate_main',
        x: 604,
        z: 140,
        rotY: -Math.PI / 2,
        title: 'TERRITÓRIO A.R.E.S. // DOCAS',
        subText: 'PORTÃO CYBER NORTE'
      },
      {
        id: 'ares_gate_south',
        x: 604,
        z: 402,
        rotY: -Math.PI / 2,
        title: 'BASE PORTUÁRIA A.R.E.S.',
        subText: 'PORTÃO BLINDADO SUL'
      }
    ],
    garages: [
      {
        id: 'ares_garage_1',
        x: 745,
        z: 315,
        rotY: 0,
        title: 'GARAGEM TÁTICA A.R.E.S. 01',
        fleet: [
          { type: 'hover_apc_ares', color: 0x334155, roofColor: 0xd946ef, dx: -5.8, dz: 0 },
          {
            type: 'cyber_blade',
            color: 0x581c87,
            roofColor: 0xfacc15,
            customName: 'CYBER-BLADE TÁTICO (A.R.E.S.)',
            dx: 0,
            dz: 0
          },
          {
            type: 'interceptor_v8',
            color: 0x475569,
            roofColor: 0xd946ef,
            customName: 'INTERCEPTADOR A.R.E.S.',
            dx: 5.8,
            dz: 0
          }
        ]
      },
      {
        id: 'ares_garage_2',
        x: 745,
        z: 525,
        rotY: Math.PI,
        title: 'GARAGEM TÁTICA A.R.E.S. 02',
        fleet: [
          { type: 'hover_apc_ares', color: 0x1e293b, roofColor: 0xfacc15, dx: -5.8, dz: 0 },
          {
            type: 'interceptor_v8',
            color: 0x334155,
            roofColor: 0xd946ef,
            customName: 'INTERCEPTADOR A.R.E.S.',
            dx: 0,
            dz: 0
          },
          {
            type: 'cyber_blade',
            color: 0x701a75,
            roofColor: 0xfacc15,
            customName: 'CYBER-BLADE TÁTICO (A.R.E.S.)',
            dx: 5.8,
            dz: 0
          }
        ]
      }
    ],
    outposts: [
      { id: 'ares_p1', code: 'P1', name: 'POSTO P1 — ACESSO DAS DOCAS', x: 675, z: 140 },
      { id: 'ares_p2', code: 'P2', name: 'POSTO P2 — PÁTIO PORTAINER', x: 815, z: 420 },
      { id: 'ares_p3', code: 'P3', name: 'POSTO P3 — CAIS DE EMBARQUE', x: 815, z: 560 }
    ],
    bossCourtyard: { x: 815, z: 485 },
    alliedBossSpawn: { x: 768, z: 455 },
    alliedEntryRoutes: [
      { startX: 590, startZ: 140, targetX: 692, targetZ: 140 },
      { startX: 590, startZ: 402, targetX: 705, targetZ: 402 }
    ],
    defenderMotorRoutes: [
      { startX: 815, startZ: 220, targetX: 710, targetZ: 155 },
      { startX: 815, startZ: 515, targetX: 815, targetZ: 405 }
    ]
  }
};

export function getTerritoryZoneAt(x, z, margin = 0) {
  for (const zone of Object.values(TERRITORY_ZONES)) {
    const b = zone.bounds;
    if (
      x >= b.minX - margin &&
      x <= b.maxX + margin &&
      z >= b.minZ - margin &&
      z <= b.maxZ + margin
    ) {
      return zone;
    }
  }
  return null;
}

// ============================================================================
// CONSTRUÇÃO FÍSICA 3D DOS PORTÕES, GARAGENS E 3 OUTPOSTS DE CADA TERRITÓRIO
// (Chamado por FavelaCDDBuilder.js, EastPortBuilder.js e LivingCityManager.js)
// ============================================================================
export function buildTerritoryInfrastructureForZone(world, zoneKey) {
  if (!world || !TERRITORY_ZONES[zoneKey]) return null;
  if (!world.territoryInfra) {
    world.territoryInfra = {};
  }
  if (world.territoryInfra[zoneKey]) {
    return world.territoryInfra[zoneKey];
  }

  const zone = TERRITORY_ZONES[zoneKey];
  const theme = FACTION_THEME[zone.defaultOwner] || FACTION_THEME.cv;
  const infra = {
    zoneKey,
    gates: [],
    garages: [],
    outposts: []
  };

  const terrainAt = (x, z) =>
    typeof world.getTerrainHeightAt === 'function' ? world.getTerrainHeightAt(x, z) : 0;

  // 1. PORTÕES DE FRONTEIRA LEGO (Guarita + Mastro com Bandeira Dinâmica + Pórtico + Cancela)
  for (const gSpec of zone.gates) {
    const yBase = terrainAt(gSpec.x, gSpec.z);
    const gateGroup = new THREE.Group();
    gateGroup.position.set(gSpec.x, yBase, gSpec.z);
    gateGroup.rotation.y = gSpec.rotY || 0;

    // Guarita Blindada LEGO no acostamento esquerdo (-13.2m) deixando a pista 100% livre para carros e comboios!
    const boothWall = createLegoBrick(3.6, 3.3, 3.6, theme.secondaryHex, { studStep: 0.9 });
    boothWall.position.set(-13.2, 1.65, 0);
    const boothStripe = createLegoBrick(3.75, 0.55, 3.75, theme.hex, { studs: false });
    boothStripe.position.set(-13.2, 2.35, 0);
    const boothRoof = createLegoBrick(4.2, 0.42, 4.2, theme.accentHex, { studStep: 0.9 });
    boothRoof.position.set(-13.2, 3.5, 0);
    const boothVisor = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.85, 3.72),
      getLegoMaterial(0x38bdf8, { roughness: 0.12, emissive: 0x0284c7, emissiveIntensity: 0.35 })
    );
    boothVisor.position.set(-13.2, 2.15, 0);

    // Mastro Alto (8.8m) + Bandeira 3D Dinâmica que troca de cor ao conquistar o território!
    const poleMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 8.8, 10),
      getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.55, roughness: 0.25 })
    );
    poleMesh.position.set(-13.2, 4.4, -1.5);

    const flagMat = new THREE.MeshStandardMaterial({
      color: theme.hex,
      emissive: new THREE.Color(theme.hex),
      emissiveIntensity: 0.35,
      roughness: 0.28
    });
    const flagMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.85, 0.18), flagMat);
    flagMesh.position.set(-11.4, 7.65, -1.5);

    // Pilar Direito (+13.2m) + Cancela Listrada Erguida em 38° + Barricada Lateral LEGO
    const rightPillar = createLegoBrick(2.4, 7.6, 2.4, theme.secondaryHex, { studStep: 0.8 });
    rightPillar.position.set(13.2, 3.8, 0);
    const leftGantryCol = createLegoBrick(2.0, 7.6, 2.0, theme.secondaryHex, { studs: false });
    leftGantryCol.position.set(-10.8, 3.8, 1.4);

    const boomPivot = new THREE.Group();
    boomPivot.position.set(11.8, 1.35, 0);
    boomPivot.rotation.z = 0.62; // Cancela semi-erguida permitindo passagem fluida de veículos!
    const boomBar = createLegoBrick(6.2, 0.26, 0.28, theme.hex, { studs: false });
    boomBar.position.set(-3.1, 0, 0);
    const boomTip = createLegoBrick(1.4, 0.3, 0.32, LEGO_COLORS.yellow, { studs: false });
    boomTip.position.set(-5.6, 0, 0);
    boomPivot.add(boomBar, boomTip);

    // Viga Superior do Pórtico (Y = +7.5m — altura livre de 7.1m para caminhões, ônibus e APCs!)
    const gantryBeam = createLegoBrick(26.4, 0.75, 1.2, theme.secondaryHex, { studStep: 1.2 });
    gantryBeam.position.set(1.2, 7.55, 0.7);

    const signMesh = createSignBoardMesh({
      x: 1.2,
      y: 8.55,
      z: 0.7,
      width: 15.5,
      height: 2.35,
      depth: 0.55,
      rotY: 0,
      title: gSpec.title,
      subText: gSpec.subText,
      bgColor: '#090a0d',
      borderColor: theme.color,
      textColor: '#f8fafc',
      subColor: theme.color,
      doubleSided: true
    });

    gateGroup.add(
      boothWall,
      boothStripe,
      boothRoof,
      boothVisor,
      poleMesh,
      flagMesh,
      rightPillar,
      leftGantryCol,
      boomPivot,
      gantryBeam,
      signMesh
    );
    gateGroup.userData.skipStaticMerge = true;
    world.scene.add(gateGroup);

    // Colisor apenas na guarita lateral esquerda para nunca travar a pista!
    const cosR = Math.cos(gSpec.rotY || 0);
    const sinR = Math.sin(gSpec.rotY || 0);
    const boothWorldX = gSpec.x + -13.2 * cosR;
    const boothWorldZ = gSpec.z - -13.2 * sinR;
    world.addCollider(boothWorldX, boothWorldZ, 4.0, 4.0, yBase + 3.9, yBase - 1.5);

    infra.gates.push({
      id: gSpec.id,
      x: gSpec.x,
      z: gSpec.z,
      group: gateGroup,
      flagMesh,
      flagMat,
      stripeMesh: boothStripe,
      boomBar
    });
  }

  // 2. GARAGENS OFICIAIS DO TIME + FROTA EXCLUSIVA DIRIGÍVEL ESTACIONADA (2 por Território)
  for (const gar of zone.garages) {
    const gy = terrainAt(gar.x, gar.z);
    const garGroup = new THREE.Group();
    garGroup.position.set(gar.x, gy, gar.z);
    garGroup.rotation.y = gar.rotY || 0;

    // Piso demarcado de oficina tática LEGO (18.6m x 8.6m) + Cobertura sustentada nos cantos traseiros
    const padFloor = createLegoBrick(18.6, 0.22, 8.6, 0x1e293b, { studs: false });
    padFloor.position.set(0, 0.08, 0);
    const padBorder = createLegoBrick(19.0, 0.14, 9.0, theme.hex, { studs: false });
    padBorder.position.set(0, 0.03, 0);

    for (const px of [-8.8, 8.8]) {
      for (const pz of [-3.8, 3.6]) {
        const colMesh = createLegoBrick(0.75, 4.8, 0.75, theme.secondaryHex, { studs: false });
        colMesh.position.set(px, 2.4, pz);
        garGroup.add(colMesh);
      }
    }

    const backWall = createLegoBrick(18.2, 3.6, 0.55, theme.secondaryHex, { studStep: 1.0 });
    backWall.position.set(0, 1.8, -4.1);
    const canopyRoof = createLegoBrick(19.2, 0.48, 9.2, theme.secondaryHex, { studStep: 1.2 });
    canopyRoof.position.set(0, 4.95, 0);
    const neonTrim = new THREE.Mesh(
      new THREE.BoxGeometry(19.3, 0.22, 0.32),
      new THREE.MeshBasicMaterial({ color: theme.hex })
    );
    neonTrim.position.set(0, 4.72, 4.55);

    const garSign = createSignBoardMesh({
      x: 0,
      y: 5.95,
      z: 4.35,
      width: 13.5,
      height: 1.85,
      depth: 0.45,
      rotY: 0,
      title: gar.title,
      subText: `FROTA EXCLUSIVA // ${theme.name}`,
      bgColor: '#090a0d',
      borderColor: theme.color,
      textColor: '#facc15',
      subColor: theme.color,
      doubleSided: true
    });

    garGroup.add(padFloor, padBorder, backWall, canopyRoof, neonTrim, garSign);
    garGroup.userData.skipStaticMerge = true;
    world.scene.add(garGroup);

    // Estaciona os 3 veículos exclusivos da facção prontos para dirigir com [E]!
    const parkedVehicles = [];
    const cosG = Math.cos(gar.rotY || 0);
    const sinG = Math.sin(gar.rotY || 0);

    for (const vCfg of gar.fleet) {
      const spec = VEHICLE_SPECS[vCfg.type] || VEHICLE_SPECS.suv_pcc;
      const vx = gar.x + vCfg.dx * cosG + vCfg.dz * sinG;
      const vz = gar.z - vCfg.dx * sinG + vCfg.dz * cosG;
      const vy = terrainAt(vx, vz) + 0.18;

      const carMesh = createLegoCarMesh({
        x: vx,
        z: vz,
        rotY: gar.rotY || 0,
        color: vCfg.color,
        roofColor: vCfg.roofColor,
        type: vCfg.type
      });
      carMesh.position.set(vx, vy, vz);
      carMesh.rotation.y = gar.rotY || 0;
      carMesh.userData.carType = vCfg.type;
      carMesh.userData.carName = vCfg.customName || spec.name;
      carMesh.userData.vehicleSpec = spec;
      carMesh.userData.factionGarageOwner = zoneKey;
      world.scene.add(carMesh);

      const isMoto = Boolean(spec.isMotorcycle);
      const col = world.addCollider(
        vx,
        vz,
        isMoto ? 1.4 : 2.5,
        isMoto ? 2.6 : 4.8,
        vy + (isMoto ? 1.3 : 1.7),
        vy
      );

      let destructible = null;
      if (world.destructibles) {
        destructible = world.destructibles.registerDestructible({
          mesh: carMesh,
          type: 'car',
          hp: spec.hp,
          radius: isMoto ? 1.8 : 2.75,
          height: isMoto ? 1.6 : 2.2,
          colliders: [col],
          debrisColors: [vCfg.color, vCfg.roofColor || 0x090a0d, theme.accentHex],
          studDrops: spec.studDrops,
          groundY: vy
        });
      }
      parkedVehicles.push({ mesh: carMesh, destructible, spec });
    }

    infra.garages.push({
      id: gar.id,
      x: gar.x,
      z: gar.z,
      group: garGroup,
      neonTrim,
      parkedVehicles
    });
  }

  // 3. OS 3 PONTOS DE SPAWN TÁTICOS / POSTOS DE COMANDO (OUTPOSTS P1, P2, P3)
  for (const op of zone.outposts) {
    const oy = terrainAt(op.x, op.z);
    const opGroup = new THREE.Group();
    opGroup.position.set(op.x, oy, op.z);

    // Piso Tático Demarcado LEGO (9.4m x 9.4m) em área aberta
    const baseSlab = createLegoBrick(9.4, 0.22, 9.4, 0x0f172a, { studs: false });
    baseSlab.position.set(0, 0.08, 0);

    const ringGeo = new THREE.RingGeometry(3.85, 4.55, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: theme.hex,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, 0.21, 0);

    // 4 Balizas de Canto com Studs Luminosos
    const bollardMats = new THREE.MeshStandardMaterial({
      color: theme.hex,
      emissive: new THREE.Color(theme.hex),
      emissiveIntensity: 0.45,
      roughness: 0.25
    });
    for (const bx of [-4.1, 4.1]) {
      for (const bz of [-4.1, 4.1]) {
        const post = createLegoBrick(0.65, 1.05, 0.65, theme.secondaryHex, { studs: false });
        post.position.set(bx, 0.58, bz);
        const cap = new THREE.Mesh(SHARED_STUD_GEO, bollardMats);
        cap.scale.set(1.6, 1.6, 1.6);
        cap.position.set(bx, 1.16, bz);
        opGroup.add(post, cap);
      }
    }

    // Torre de Antena de Rádio LEGO na borda do piso (+3.6m, -3.6m) deixando o centro livre!
    const towerX = 3.55;
    const towerZ = -3.55;
    const towerBase = createLegoBrick(1.8, 1.6, 1.8, theme.secondaryHex, { studStep: 0.6 });
    towerBase.position.set(towerX, 0.85, towerZ);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.34, 8.4, 8),
      getLegoMaterial(LEGO_COLORS.silver, { metalness: 0.6, roughness: 0.25 })
    );
    mast.position.set(towerX, 5.2, towerZ);

    // Prato de Radar Giratório + Giroflex/Farol Esférico no Topo + Holofote Vertical Translúcido
    const dishGroup = new THREE.Group();
    dishGroup.position.set(towerX, 7.6, towerZ);
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.55, 10, 1, true),
      getLegoMaterial(theme.accentHex, { metalness: 0.4, roughness: 0.22 })
    );
    dish.rotation.z = Math.PI / 2.4;
    dish.position.set(0.45, 0, 0);
    dishGroup.add(dish);

    const beaconMat = new THREE.MeshBasicMaterial({ color: theme.hex });
    const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 10), beaconMat);
    beaconMesh.position.set(towerX, 9.65, towerZ);

    const sirenBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 0.28), beaconMat);
    sirenBar.position.set(towerX, 9.15, towerZ);

    const spotlightMat = new THREE.MeshBasicMaterial({
      color: theme.hex,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const spotlightCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 3.1, 13.5, 14, 1, true),
      spotlightMat
    );
    spotlightCone.position.set(0, 6.85, 0);

    const opSign = createSignBoardMesh({
      x: towerX,
      y: 2.55,
      z: towerZ,
      width: 3.4,
      height: 1.05,
      depth: 0.26,
      rotY: -Math.PI / 4,
      title: `${op.code} // ${theme.shortTag}`,
      subText: 'POSTO DE COMANDO',
      bgColor: '#090a0d',
      borderColor: theme.color,
      textColor: '#f8fafc',
      subColor: theme.color,
      doubleSided: true
    });

    opGroup.add(
      baseSlab,
      ringMesh,
      towerBase,
      mast,
      dishGroup,
      beaconMesh,
      sirenBar,
      spotlightCone,
      opSign
    );
    opGroup.userData.skipStaticMerge = true;
    world.scene.add(opGroup);

    world.addCollider(op.x + towerX, op.z + towerZ, 1.9, 1.9, oy + 4.5, oy - 1.0);

    infra.outposts.push({
      id: op.id,
      code: op.code,
      name: op.name,
      x: op.x,
      y: oy,
      z: op.z,
      ownerFaction: zone.defaultOwner,
      group: opGroup,
      ringMat,
      bollardMats,
      beaconMat,
      spotlightMat,
      spotlightCone,
      dishGroup,
      sirenBar
    });
  }

  world.territoryInfra[zoneKey] = infra;
  return infra;
}

// ============================================================================
// GEOMETRIAS PRÉ-FUNDIDAS COMPARTILHADAS PARA SOLDADOS LEGO & BOSSES BIG-FIG
// (Zero custo extra de Draw Calls / GC — 60 FPS cravados!)
// ============================================================================
let SHARED_WAR_GEOS = null;
const VEST_MAT_CACHE = new Map();

function ensureSharedWarGeometries() {
  if (SHARED_WAR_GEOS) return SHARED_WAR_GEOS;

  // Tronco Trapezoidal LEGO Clássico
  const torso = new THREE.BoxGeometry(1, 0.76, 0.44);
  const tPos = torso.attributes.position;
  for (let i = 0; i < tPos.count; i++) {
    const y = tPos.getY(i);
    tPos.setX(i, tPos.getX(i) * (y > 0 ? 0.95 : 0.78));
  }
  torso.computeVertexNormals();
  const neck = new THREE.CylinderGeometry(0.19, 0.22, 0.08, 12);
  neck.translate(0, 0.41, 0);
  const torsoGeo = mergeBufferGeometries([torso, neck]);

  const hipW = new THREE.BoxGeometry(0.78, 0.14, 0.42);
  const hipT = new THREE.BoxGeometry(0.11, 0.22, 0.4);
  hipT.translate(0, -0.1, 0);
  const hipGeo = mergeBufferGeometries([hipW, hipT]);

  const thigh = new THREE.BoxGeometry(0.31, 0.28, 0.34);
  thigh.translate(0, -0.15, 0);
  const shin = new THREE.BoxGeometry(0.3, 0.26, 0.33);
  shin.translate(0, -0.42, 0);
  const boot = new THREE.BoxGeometry(0.31, 0.13, 0.43);
  boot.translate(0, -0.585, 0.045);
  const legGeo = mergeBufferGeometries([thigh, shin, boot]);

  const shldr = new THREE.SphereGeometry(0.145, 8, 8);
  shldr.translate(0, -0.04, 0);
  const uArm = new THREE.CylinderGeometry(0.12, 0.11, 0.28, 8);
  uArm.translate(0, -0.18, 0);
  const fArm = new THREE.CylinderGeometry(0.11, 0.1, 0.24, 8);
  fArm.translate(0, -0.41, 0);
  const armGeo = mergeBufferGeometries([shldr, uArm, fArm]);

  const wrist = new THREE.CylinderGeometry(0.075, 0.075, 0.08, 8);
  const claw = new THREE.TorusGeometry(0.105, 0.042, 6, 12, Math.PI * 1.45);
  claw.rotateY(Math.PI / 2);
  claw.rotateX(Math.PI * 0.75);
  claw.translate(0, -0.11, 0.02);
  const handGeo = mergeBufferGeometries([wrist, claw]);

  const headCyl = new THREE.CylinderGeometry(0.27, 0.27, 0.5, 16);

  // Armas 3D LEGO Detalhadas (Fuzil de Assalto, Medi-Gun e Escudo Balístico)
  const rBody = new THREE.BoxGeometry(0.12, 0.18, 0.68);
  rBody.translate(0, -0.46, 0.34);
  const rBarrel = new THREE.CylinderGeometry(0.035, 0.035, 0.38, 8);
  rBarrel.rotateX(Math.PI / 2);
  rBarrel.translate(0, -0.43, 0.84);
  const rMag = new THREE.BoxGeometry(0.09, 0.26, 0.14);
  rMag.rotateX(0.25);
  rMag.translate(0, -0.61, 0.42);
  const rScope = new THREE.BoxGeometry(0.08, 0.08, 0.24);
  rScope.translate(0, -0.33, 0.36);
  const rifleGeo = mergeBufferGeometries([rBody, rBarrel, rMag, rScope]);

  const shieldPlate = new THREE.BoxGeometry(0.76, 1.24, 0.1);
  shieldPlate.translate(-0.14, -0.38, 0.34);
  const shieldRim = new THREE.BoxGeometry(0.82, 0.14, 0.13);
  shieldRim.translate(-0.14, 0.19, 0.34);
  const shieldGeo = mergeBufferGeometries([shieldPlate, shieldRim]);

  // Losango Verde Discreto de Aliado (SOMENTE visível no time do jogador!)
  const allyDiamond = new THREE.OctahedronGeometry(0.17, 0);
  allyDiamond.scale(0.85, 1.25, 0.85);

  SHARED_WAR_GEOS = {
    torsoGeo,
    hipGeo,
    legGeo,
    armGeo,
    handGeo,
    headCyl,
    rifleGeo,
    shieldGeo,
    allyDiamond,
    bulletGeo: new THREE.BoxGeometry(0.16, 0.16, 0.72),
    rocketGeo: new THREE.CylinderGeometry(0.0, 0.16, 0.9, 8).rotateX(Math.PI / 2),
    blastGeo: new THREE.SphereGeometry(1, 14, 10),
    shockwaveGeo: new THREE.RingGeometry(0.8, 1.25, 24)
  };
  SHARED_WAR_GEOS.shockwaveGeo.rotateX(-Math.PI / 2);
  return SHARED_WAR_GEOS;
}

function getTacticalVestMaterials(factionKey, roleKey, baseHex) {
  const cacheKey = `${factionKey}_${roleKey}`;
  if (VEST_MAT_CACHE.has(cacheKey)) return VEST_MAT_CACHE.get(cacheKey);

  const plainMat = getLegoMaterial(baseHex, { roughness: 0.25, clearcoat: 0.42 });
  const doc = globalThis.document;
  if (!doc || typeof doc.createElement !== 'function') {
    const arr = [plainMat, plainMat, plainMat, plainMat, plainMat, plainMat];
    VEST_MAT_CACHE.set(cacheKey, arr);
    return arr;
  }

  const canvas = doc.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const arr = [plainMat, plainMat, plainMat, plainMat, plainMat, plainMat];
    VEST_MAT_CACHE.set(cacheKey, arr);
    return arr;
  }

  const theme = FACTION_THEME[factionKey] || FACTION_THEME.cv;
  ctx.fillStyle = `#${baseHex.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 128, 128);

  // Colete Balístico LEGO em Alto Contraste
  ctx.fillStyle = '#090a0d';
  ctx.fillRect(16, 14, 96, 98);
  ctx.strokeStyle = theme.color;
  ctx.lineWidth = 5;
  ctx.strokeRect(20, 18, 88, 88);

  if (roleKey === 'medic') {
    // Emblema de Médico de Combate (Cruz Verde/Branca Tática)
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(54, 34, 20, 52);
    ctx.fillRect(38, 50, 52, 20);
  } else {
    // Placas Cerâmicas + Porta-Carregadores Táticos
    ctx.fillStyle = '#334155';
    ctx.fillRect(28, 28, 72, 30);
    ctx.fillStyle = theme.color;
    for (let p = 0; p < 3; p++) {
      ctx.fillRect(26 + p * 26, 70, 20, 28);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const frontMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.28,
    metalness: 0.08
  });

  const mats = [plainMat, plainMat, plainMat, plainMat, frontMat, plainMat];
  VEST_MAT_CACHE.set(cacheKey, mats);
  return mats;
}

// ============================================================================
// SISTEMA CENTRAL DE GUERRA TERRITORIAL DE INVASÃO (1 FACÇÃO VS 1 FACÇÃO)
// ============================================================================
export class FactionWarSystem {
  constructor(livingCity) {
    this.livingCity = livingCity;
    this.world = livingCity.world;
    this.scene = livingCity.scene;
    this.destructibles = livingCity.destructibles;
    this.hud = livingCity.hud;

    // Garante que os 3 Territórios tenham Portões, Garagens e 3 Outposts construídos
    buildTerritoryInfrastructureForZone(this.world, 'cv');
    buildTerritoryInfrastructureForZone(this.world, 'pcc');
    buildTerritoryInfrastructureForZone(this.world, 'ares');

    this.playerFaction = 'cv';
    this.activeZoneId = null;
    this.activeMode = 'PEACEFUL_CITY'; // 'PEACEFUL_CITY' | 'ALLY_HQ' | 'INVASION_1V1'
    this.isInvasionActive = false;

    this.combatNpcs = livingCity.combatNpcs;
    this.npcProjectiles = livingCity.npcProjectiles;
    this.activeWarzones = livingCity.activeWarzones;
    this.activeConvoyDrops = [];
    this.activeShockwaves = [];
    this.warSpawnedCars = [];

    // Pool leve de Feixes 3D de Cura (Medi-Beam Verde)
    this.healBeams = [];
    this._initHealBeamPool();

    // Estado vivo dos 3 Territórios (Dono atual, Outposts capturados, Bosses ativos)
    this.territories = {};
    for (const [zKey, zSpec] of Object.entries(TERRITORY_ZONES)) {
      const infra = this.world.territoryInfra?.[zKey];
      this.territories[zKey] = {
        id: zKey,
        spec: zSpec,
        ownerFaction: zSpec.defaultOwner,
        conqueredByPlayer: false,
        bossPhaseTriggered: false,
        enemyBossDefeated: false,
        enemyBoss: null,
        alliedBoss: null,
        enemyWaveTimer: 3.5,
        alliedWaveTimer: 2.0,
        outposts: (infra?.outposts || []).map((op) => ({
          ...op,
          ownerFaction: zSpec.defaultOwner,
          captureHoldTimer: 0
        })),
        // Invasão 2.0
        activeIndex: 0,
        invasionClock: INVASION_RULES.startClock,
        reinforceTimer: 6,
        // Contra-Ataque
        garrisonLevel: 0,
        threatTimer: null
      };
      const st = this.territories[zKey];
      st.captureZones = st.outposts.map(
        (op) =>
          new CaptureZone({
            id: op.id,
            x: op.x,
            y: op.y ?? 0,
            z: op.z,
            radius: INVASION_RULES.captureRadius,
            captureTime: INVASION_RULES.captureTime,
            scene: this.scene,
            label: op.code,
            groundAt: (gx, gz, ref) => this._groundAt(gx, gz, ref)
          })
      );
    }

    this.objectiveHud = new ObjectiveHud();
    this._lastController = null;
    this.counterAttack = new TerritoryCounterAttack(this);
    this.bankHeist = new BankHeistEvent(this);
    this._bankZoneState = {
      id: 'bank',
      spec: {
        title: 'SUPER BANCO CENTRAL',
        bossCourtyard: { x: 0, z: -165 },
        safeExitGate: { x: 0, z: BANK_SPEC.frontZ + 14 }
      },
      outposts: [],
      captureZones: [],
      activeIndex: 0,
      conqueredByPlayer: true,
      bossPhaseTriggered: false
    };

    this._animClock = 0;
  }

  _initHealBeamPool() {
    const geo = new THREE.CylinderGeometry(0.09, 0.13, 1.0, 8);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.82
    });
    for (let i = 0; i < 4; i++) {
      const beam = new THREE.Mesh(geo, mat);
      beam.visible = false;
      this.scene.add(beam);
      this.healBeams.push(beam);
    }
  }

  getConqueredTerritoryIds() {
    return Object.values(this.territories)
      .filter((t) => t.conqueredByPlayer)
      .map((t) => t.id);
  }

  getFactionTheme(factionKey) {
    return FACTION_THEME[factionKey] || EXTRA_THEMES[factionKey] || FACTION_THEME.cv;
  }

  /** Depuração: começa o assalto agora (console: __legoGame.world.livingCity.factionWar.debugBankHeist()) */
  debugBankHeist() {
    this.bankHeist.timer = 0;
    return this.bankHeist.start();
  }

  _enterBankHeistMode() {
    this._cleanupActiveZoneUnits();
    this.activeZoneId = 'bank';
    this.activeMode = 'BANK_HEIST';
    this.isInvasionActive = true;
  }

  _leaveBankHeistMode() {
    this._cleanupActiveZoneUnits();
    if (this.activeZoneId === 'bank') {
      this.activeZoneId = null;
      this.activeMode = 'PEACEFUL_CITY';
      this.isInvasionActive = false;
    }
  }

  /** Território volta para a facção que contra-atacou */
  loseTerritory(zoneState, attacker = zoneState.spec.defaultOwner) {
    zoneState.ownerFaction = attacker;
    zoneState.conqueredByPlayer = false;
    zoneState.threatTimer = null;
    zoneState.garrisonLevel = 0;
    zoneState.bossPhaseTriggered = false;
    zoneState.enemyBossDefeated = false;
    for (const op of zoneState.outposts) op.ownerFaction = attacker;
    zoneState.captureZones.forEach((cz) => cz.reset());
    this._syncZone3DColors(zoneState.id);
  }

  /** Dados extras do território para o save (nível da guarnição e tempo até o próximo contra-ataque) */
  getTerritoryMeta() {
    const meta = {};
    for (const [k, st] of Object.entries(this.territories)) {
      if (!st.conqueredByPlayer) continue;
      meta[k] = {
        garrisonLevel: st.garrisonLevel || 0,
        threatTimer: Number.isFinite(st.threatTimer) ? Math.max(30, Math.round(st.threatTimer)) : null
      };
    }
    return meta;
  }

  applyTerritoryMeta(meta = null) {
    if (!meta || typeof meta !== 'object') return;
    for (const [k, m] of Object.entries(meta)) {
      const st = this.territories[k];
      if (!st || !st.conqueredByPlayer || !m) continue;
      st.garrisonLevel = Math.max(0, Math.min(3, Number(m.garrisonLevel) || 0));
      st.threatTimer = Number.isFinite(m.threatTimer) ? m.threatTimer : null;
    }
  }

  /** Depuração: força um contra-ataque agora (console: __legoGame.world.livingCity.factionWar.debugCounterAttack('pcc')) */
  debugCounterAttack(zoneId = null) {
    const id = zoneId || Object.values(this.territories).find((t) => t.conqueredByPlayer)?.id;
    if (!id) return false;
    return this.counterAttack.startAlert(id);
  }

  applySavedConquests(conqueredIds = [], playerFaction = this.playerFaction) {
    if (this.counterAttack?.isActive) this.counterAttack._finish();
    if (!Array.isArray(conqueredIds)) return;
    for (const zKey of Object.keys(this.territories)) {
      const st = this.territories[zKey];
      if (conqueredIds.includes(zKey) && FACTION_THEME[playerFaction]) {
        st.ownerFaction = playerFaction;
        st.conqueredByPlayer = true;
      } else {
        st.ownerFaction = st.spec.defaultOwner;
        st.conqueredByPlayer = false;
      }
      st.bossPhaseTriggered = false;
      st.enemyBossDefeated = false;
      for (const op of st.outposts) {
        op.ownerFaction = st.ownerFaction;
      }
      this._syncZone3DColors(zKey);
    }
  }

  resetConqueredTerritories() {
    if (this.counterAttack?.isActive) this.counterAttack._finish();
    this._cleanupActiveZoneUnits();
    this.activeZoneId = null;
    this.activeMode = 'PEACEFUL_CITY';
    this.isInvasionActive = false;
    this.activeWarzones.length = 0;

    for (const [zKey, st] of Object.entries(this.territories)) {
      st.ownerFaction = st.spec.defaultOwner;
      st.conqueredByPlayer = false;
      st.bossPhaseTriggered = false;
      st.enemyBossDefeated = false;
      st.enemyBoss = null;
      st.alliedBoss = null;
      st.garrisonLevel = 0;
      st.threatTimer = null;
      st.captureZones.forEach((cz) => cz.reset());
      for (const op of st.outposts) {
        op.ownerFaction = st.spec.defaultOwner;
        op.captureHoldTimer = 0;
      }
      this._syncZone3DColors(zKey);
    }
  }

  setPlayerFaction(factionKey, controller = null, savedConquests = null) {
    const validKey = FACTION_THEME[factionKey] ? factionKey : 'cv';
    const changed = this.playerFaction !== validKey;
    this.playerFaction = validKey;
    this.livingCity.playerFaction = validKey;

    if (Array.isArray(savedConquests)) {
      this.applySavedConquests(savedConquests, validKey);
    } else if (changed) {
      // Ao trocar de facção, mantém territórios originais íntegros para permitir novas invasões
      for (const [zKey, st] of Object.entries(this.territories)) {
        if (!st.conqueredByPlayer) {
          st.ownerFaction = st.spec.defaultOwner;
          for (const op of st.outposts) {
            op.ownerFaction = st.ownerFaction;
          }
          this._syncZone3DColors(zKey);
        }
      }
    }

    // Se havia unidades ativas, reinicializa o estado da zona atual com a nova aliança
    if (this.activeZoneId) {
      this._cleanupActiveZoneUnits();
      this.activeZoneId = null;
      this.activeMode = 'PEACEFUL_CITY';
      this.isInvasionActive = false;
    }

    if (controller && controller.position) {
      this.update(0.016, controller.position, controller);
    }
  }

  _syncZone3DColors(zoneKey) {
    const st = this.territories[zoneKey];
    const infra = this.world.territoryInfra?.[zoneKey];
    if (!st || !infra) return;

    const zoneTheme = FACTION_THEME[st.ownerFaction] || FACTION_THEME.cv;
    for (const g of infra.gates) {
      if (g.flagMat) {
        g.flagMat.color.setHex(zoneTheme.hex);
        g.flagMat.emissive.setHex(zoneTheme.hex);
      }
    }
    for (const opState of st.outposts) {
      const opTheme = FACTION_THEME[opState.ownerFaction] || zoneTheme;
      opState.ringMat?.color.setHex(opTheme.hex);
      opState.bollardMats?.color.setHex(opTheme.hex);
      opState.bollardMats?.emissive.setHex(opTheme.hex);
      opState.beaconMat?.color.setHex(opTheme.hex);
      opState.spotlightMat?.color.setHex(opTheme.hex);
    }
  }

  // ============================================================================
  // LINHA DE VISÃO (LOS) E TERRENO SEGURO (ZERO TIRO ATRAVÉS DE PRÉDIOS!)
  // ============================================================================
  _hasClearLineOfSight(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.2) return true;
    const steps = Math.min(12, Math.max(4, Math.ceil(dist / 6.0)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = x1 + dx * t;
      const sz = z1 + dz * t;
      if (this.livingCity._isInsideBuilding(sx, sz, 0.3)) {
        return false;
      }
    }
    return true;
  }

  _groundAt(x, z, refY = 0) {
    if (typeof this.world.getSurfaceHeightAt === 'function') {
      return this.world.getSurfaceHeightAt(x, z, refY);
    }
    return typeof this.world.getTerrainHeightAt === 'function'
      ? this.world.getTerrainHeightAt(x, z)
      : 0;
  }

  _findSafeZonePos(x, z, radius = 1.4, refY = null) {
    const safe = this.livingCity._findSafeStreetSpawn(x, z, radius);
    const y = this._groundAt(safe.x, safe.z, refY === null ? 2 : refY + 0.6);
    return { x: safe.x, y, z: safe.z };
  }

  // ============================================================================
  // CRIAÇÃO DE SOLDADOS MINIFIGURA LEGO ARTICULADOS & BOSSES BIG-FIG COLOSSAIS
  // ============================================================================
  _spawnCombatUnit({ faction, role = 'rifleman', x, z, y = null, outpostId = null, patrolAnchor = null, forceAllied = null }) {
    const geos = ensureSharedWarGeometries();
    const theme = this.getFactionTheme(faction);
    const isAllied = forceAllied ?? faction === this.playerFaction;
    // Classes pesadas do Super Banco: "brute" (monstrão Big-Fig) e "elite" (atira sem parar)
    const heavyClass = role === 'brute' || role === 'elite' ? role : null;
    const visualRole = role === 'brute' ? 'tank' : role === 'elite' ? 'boss' : role;
    const isBoss = role === 'boss';
    const isTank = role === 'tank';
    const isMedic = role === 'medic';

    const safePos = this._findSafeZonePos(x, z, isBoss || heavyClass ? 2.2 : 1.15, y);
    const root = new THREE.Group();
    root.userData.skipStaticMerge = true;

    const unitScale = role === 'brute' ? 2.0 : role === 'elite' ? 1.5 : isBoss ? 2.32 : isTank ? 1.14 : 1.0;
    const bodyRig = new THREE.Group();
    bodyRig.scale.setScalar(unitScale);
    root.add(bodyRig);

    // Minifigura de combate detalhada (kit visual por facção + classe)
    const soldier = createFactionSoldierVisual(faction, visualRole);
    bodyRig.add(soldier.bodyRig);
    const { leftLeg, rightLeg, leftArm, rightArm, muzzleFlash } = soldier;
    rightArm.rotation.x = AIM_POSE.rightArmX;
    leftArm.rotation.x = soldier.hasShield ? AIM_POSE.shieldArmX : AIM_POSE.leftArmX;
    if (!soldier.hasShield) leftArm.rotation.z = AIM_POSE.leftArmZ; // mão de apoio na arma
    void geos;

    // Losango Verde Discreto APENAS nos Aliados (Zero barras de vida flutuando na tela!)
    const allyMarker = new THREE.Mesh(
      ensureSharedWarGeometries().allyDiamond,
      ALLY_MARKER_MAT
    );
    allyMarker.position.set(0, isBoss ? 6.1 : 2.78, 0);
    allyMarker.visible = isAllied;
    root.add(allyMarker);

    root.position.set(safePos.x, safePos.y, safePos.z);
    this.scene.add(root);

    const big = isBoss || heavyClass;
    const hp =
      role === 'brute'
        ? 1100
        : role === 'elite'
          ? 1400
          : isBoss
            ? 1550
            : faction === 'guard'
              ? isTank
                ? 170
                : 95
              : isTank
                ? 280
                : isMedic
                  ? 175
                  : 160;
    const destructible = this.destructibles.registerDestructible({
      mesh: root,
      type: big ? 'npc_boss' : 'npc_fighter',
      hp,
      radius: big ? 1.05 * unitScale + 0.2 : 1.05,
      height: 2.25 * unitScale,
      colliders: [],
      debrisColors: [theme.hex, theme.secondaryHex, theme.accentHex, LEGO_COLORS.yellow],
      studDrops: big
        ? { silver: 0, gold: 18, blue: 10, purple: 4 }
        : { silver: 2, gold: 4, blue: isTank ? 2 : 1, purple: 0 },
      groundY: safePos.y
    });

    destructible.isCombatNpc = true;
    destructible.isTankNpc = isTank;
    destructible.isBossNpc = isBoss || Boolean(heavyClass);
    destructible.isAlliedToPlayer = isAllied;
    destructible.noAutoRespawn = true;

    const npc = {
      faction,
      role,
      isAllied,
      isMecha: isBoss,
      isBoss,
      outpostId,
      patrolAnchor: patrolAnchor || { x: safePos.x, z: safePos.z },
      patrolAngle: Math.random() * Math.PI * 2,
      saluting: false,
      fireCooldown: 0.55 + Math.random() * 0.75,
      slamCooldown: 4.5,
      muzzleTimer: 0,
      walkPhase: Math.random() * 6.28,
      speed: role === 'brute' ? 4.0 : isBoss ? 5.2 : isTank ? 4.4 : isMedic ? 5.8 : 5.3,
      heavyClass,
      hitR: 1.05 * unitScale,
      hitH: 2.3 * unitScale,
      destructible,
      visual: {
        root,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        muzzleFlash,
        allyMarker,
        head: soldier.head,
        drone: soldier.drone,
        weaponKind: soldier.weaponKind
      },
      className: soldier.className
    };

    destructible.onShattered = () => {
      if (npc.isBankRobber) this.bankHeist.onRobberDefeated(npc);
      if (isBoss && !isAllied && this.activeZoneId) {
        const zState = this.territories[this.activeZoneId];
        if (zState && zState.enemyBoss === npc) {
          zState.enemyBossDefeated = true;
        }
      }
    };

    this.combatNpcs.push(npc);
    return npc;
  }

  // ============================================================================
  // DESPACHO DE REFORÇOS MOTORIZADOS (CARROS DO TIME ALIADO & CARROS INIMIGOS!)
  // ============================================================================
  _spawnMotorizedSquad({ faction, isAllied, zoneState, playerPos, roles = null, target = null }) {
    const theme = FACTION_THEME[faction] || FACTION_THEME.cv;
    const routes = isAllied ? zoneState.spec.alliedEntryRoutes : zoneState.spec.defenderMotorRoutes;
    if (!routes || routes.length === 0) return null;

    // Escolhe a rota mais próxima do jogador
    const focus = target || playerPos;
    let bestRoute = routes[0];
    let bestDist = Infinity;
    for (const r of routes) {
      const d = Math.hypot(r.targetX - focus.x, r.targetZ - focus.z);
      if (d < bestDist) {
        bestDist = d;
        bestRoute = r;
      }
    }

    const startSafe = this._findSafeZonePos(bestRoute.startX, bestRoute.startZ, 2.4);
    const blendX = THREE.MathUtils.lerp(bestRoute.targetX, focus.x, 0.35);
    const blendZ = THREE.MathUtils.lerp(bestRoute.targetZ, focus.z, 0.35);
    const targetSafe = this._findSafeZonePos(blendX, blendZ, 2.4);

    const vType = theme.convoyVehicles[Math.floor(Math.random() * theme.convoyVehicles.length)];
    const spec = VEHICLE_SPECS[vType] || VEHICLE_SPECS.suv_pcc;
    const heading = Math.atan2(targetSafe.x - startSafe.x, targetSafe.z - startSafe.z);

    const carMesh = createLegoCarMesh({
      x: startSafe.x,
      z: startSafe.z,
      rotY: heading,
      color: theme.hex,
      roofColor: theme.secondaryHex,
      type: vType
    });
    carMesh.position.set(startSafe.x, startSafe.y + 0.16, startSafe.z);
    carMesh.rotation.y = heading;
    carMesh.userData.carType = vType;
    carMesh.userData.carName = `${spec.name} // ${theme.shortTag}`;
    carMesh.userData.vehicleSpec = spec;
    this.scene.add(carMesh);

    const col = this.world.addCollider(
      startSafe.x,
      startSafe.z,
      2.5,
      4.8,
      startSafe.y + 1.8,
      startSafe.y
    );
    col.disabled = true; // Habilitado quando o carro freia e estaciona!

    const destructible = this.destructibles.registerDestructible({
      mesh: carMesh,
      type: 'car',
      hp: spec.hp,
      radius: 2.75,
      height: 2.2,
      colliders: [col],
      debrisColors: [theme.hex, theme.secondaryHex, theme.accentHex],
      studDrops: spec.studDrops,
      groundY: startSafe.y
    });
    destructible.noAutoRespawn = true;

    // Recicla carros de comboio antigos não dirigidos para manter 60 FPS limpos
    this.warSpawnedCars.push(destructible);
    while (this.warSpawnedCars.length > 5) {
      const oldest = this.warSpawnedCars.shift();
      if (oldest && !oldest.isDriven) {
        this.destructibles.unregisterDestructible(oldest);
      }
    }

    const convoy = {
      faction,
      isAllied,
      mesh: carMesh,
      destructible,
      collider: col,
      targetX: targetSafe.x,
      targetZ: targetSafe.z,
      speed: 24.0,
      maxTravelTimer: 4.5,
      disembarked: false,
      squadRoles: roles
        ? roles.slice(0, 6)
        : isAllied
          ? ['rifleman', 'rifleman', 'tank', 'medic']
          : ['rifleman', 'rifleman', 'tank'],
      anchor: target ? { x: target.x, z: target.z } : null,
      outpostId: target?.id || null
    };
    this.activeConvoyDrops.push(convoy);
    return convoy;
  }

  _disembarkConvoySquad(convoy) {
    if (convoy.disembarked) return;
    convoy.disembarked = true;

    const cx = convoy.mesh.position.x;
    const cz = convoy.mesh.position.z;
    const cy = this._groundAt(cx, cz, convoy.mesh.position.y);
    convoy.mesh.position.y = cy + 0.16;
    convoy.destructible.basePos.copy(convoy.mesh.position);
    convoy.destructible.groundY = cy;

    if (convoy.collider) {
      convoy.collider.minX = cx - 1.25;
      convoy.collider.maxX = cx + 1.25;
      convoy.collider.minZ = cz - 2.4;
      convoy.collider.maxZ = cz + 2.4;
      convoy.collider.minY = cy;
      convoy.collider.maxY = cy + 1.8;
      convoy.collider.disabled = false;
    }

    // Efeito visual de derrapagem/desembarque tático
    this.destructibles.spawnHeroSwapEffect(
      new THREE.Vector3(cx, cy + 0.4, cz),
      FACTION_THEME[convoy.faction]?.hex || 0xfacc15
    );

    const offsets = [
      { dx: -2.8, dz: -1.4 },
      { dx: 2.8, dz: -1.4 },
      { dx: -2.6, dz: 1.8 },
      { dx: 2.6, dz: 1.8 },
      { dx: 0, dz: -3.2 },
      { dx: 0, dz: 3.4 }
    ];

    convoy.squadRoles.forEach((role, idx) => {
      const off = offsets[idx % offsets.length];
      const unit = this._spawnCombatUnit({
        faction: convoy.faction,
        role,
        x: cx + off.dx,
        z: cz + off.dz,
        outpostId: convoy.outpostId,
        patrolAnchor: convoy.anchor
          ? { x: convoy.anchor.x + off.dx, z: convoy.anchor.z + off.dz }
          : null
      });
      if (unit && convoy.anchor) unit.retreating = true; // corre até o ponto antes de lutar
      if (unit && convoy.onUnit) convoy.onUnit(unit);
    });
  }

  // ============================================================================
  // ENTRADA / SAÍDA DOS TERRITÓRIOS (PAZ CIVIL VS QG ALIADO VS INVASÃO 1X1)
  // ============================================================================
  _cleanupActiveZoneUnits() {
    for (const npc of this.combatNpcs) {
      if (npc.destructible) {
        this.destructibles.unregisterDestructible(npc.destructible);
      }
    }
    this.combatNpcs.length = 0;

    for (const proj of this.npcProjectiles) {
      if (proj.mesh?.parent) proj.mesh.parent.remove(proj.mesh);
    }
    this.npcProjectiles.length = 0;

    for (const sw of this.activeShockwaves) {
      if (sw.mesh?.parent) sw.mesh.parent.remove(sw.mesh);
    }
    this.activeShockwaves.length = 0;

    for (const cv of this.activeConvoyDrops) {
      if (cv.destructible && !cv.destructible.isDriven) {
        this.destructibles.unregisterDestructible(cv.destructible);
      }
    }
    this.activeConvoyDrops.length = 0;

    for (const car of this.warSpawnedCars) {
      if (car && !car.isDriven) {
        this.destructibles.unregisterDestructible(car);
      }
    }
    this.warSpawnedCars.length = 0;

    for (const beam of this.healBeams) {
      beam.visible = false;
    }
    this.activeWarzones.length = 0;
  }

  _enterAllyHqMode(zoneKey) {
    this._cleanupActiveZoneUnits();
    this.objectiveHud?.hide();
    this.activeZoneId = zoneKey;
    this.activeMode = 'ALLY_HQ';
    this.isInvasionActive = false;

    const st = this.territories[zoneKey];
    if (!st) return;

    // 2 Guardas Aliados nos Portões + 1 Guarda em cada Outpost + 2 Médicos da Base (+ guarnição extra por nível)
    for (let i = 0; i < (st.garrisonLevel || 0); i++) {
      const op = st.outposts[i % st.outposts.length];
      this._spawnCombatUnit({ faction: this.playerFaction, role: i % 2 ? 'special' : 'tank', x: op.x + 3, z: op.z - 3, outpostId: op.id });
    }
    for (const g of st.spec.gates) {
      this._spawnCombatUnit({
        faction: this.playerFaction,
        role: 'rifleman',
        x: g.x + (zoneKey === 'cv' ? -9 : 9),
        z: g.z + 5
      });
    }
    for (const op of st.outposts) {
      this._spawnCombatUnit({
        faction: this.playerFaction,
        role: 'rifleman',
        x: op.x - 2.5,
        z: op.z + 2.5,
        outpostId: op.id
      });
    }
    const p1 = st.outposts[0];
    const p2 = st.outposts[1] || p1;
    if (p1) {
      this._spawnCombatUnit({
        faction: this.playerFaction,
        role: 'medic',
        x: p1.x + 2.5,
        z: p1.z + 2.5
      });
    }
    if (p2) {
      this._spawnCombatUnit({
        faction: this.playerFaction,
        role: 'medic',
        x: p2.x + 2.5,
        z: p2.z + 2.5
      });
    }
  }

  _enterInvasionWarMode(zoneKey, playerPos) {
    this._cleanupActiveZoneUnits();
    this.activeZoneId = zoneKey;
    this.activeMode = 'INVASION_1V1';
    this.isInvasionActive = true;

    const st = this.territories[zoneKey];
    if (!st) return;

    const defenderFaction = st.ownerFaction;
    st.bossPhaseTriggered = false;
    st.enemyBossDefeated = false;
    st.enemyBoss = null;
    st.alliedBoss = null;
    st.enemyWaveTimer = 9.5;
    st.alliedWaveTimer = 10.5;
    st.invasionClock = INVASION_RULES.startClock;
    st.reinforceTimer = 7;

    // Invasão em SEQUÊNCIA: P1 -> P2 -> P3 -> Pátio do Chefe
    for (const op of st.outposts) op.ownerFaction = defenderFaction;
    this._syncZone3DColors(zoneKey);
    st.activeIndex = 0;
    st.captureZones.forEach((cz, idx) => {
      cz.reset();
      cz.setActive(idx === 0);
    });

    // Civis próximos da fronteira correm para fora da zona invadida!
    this.livingCity.triggerPedestrianPanicNear(playerPos, 72);
    soundFX.playHeroSwap();

    // Guarnição forte no ponto ativo + vigias nos próximos (a frente de batalha)
    st.outposts.forEach((op, idx) => {
      this._spawnOutpostGarrison(st, op, idx === 0 ? 'full' : 'picket', idx);
    });
    this._refreshInvasionWarzones(st);

    // Comboio de Invasão da SUA FACÇÃO + Reforço Motorizado Inimigo
    this._spawnMotorizedSquad({
      faction: this.playerFaction,
      isAllied: true,
      zoneState: st,
      playerPos
    });
    this._spawnMotorizedSquad({
      faction: defenderFaction,
      isAllied: false,
      zoneState: st,
      playerPos,
      roles: buildFactionSquad(defenderFaction, 0),
      target: st.outposts[0]
    });

    const theme = FACTION_THEME[defenderFaction] || FACTION_THEME.cv;
    this.objectiveHud?.show({
      tag: `INVASÃO // ${theme.shortTag}`,
      title: `CAPTURE ${st.outposts[0]?.name || 'O POSTO'}`,
      accent: theme.color
    });
    this.hud?.showWantedBanner?.(
      `INVASÃO: ${st.spec.title}`,
      'TOME P1 → P2 → P3 E DERROTE O CHEFE',
      'pursuit',
      3400
    );
  }

  /**
   * Guarnição de um posto. 'full' = defesa do ponto ativo; 'picket' = vigias leves.
   */
  _spawnOutpostGarrison(zoneState, op, mode = 'full', tier = 0) {
    const faction = zoneState.ownerFaction;
    const roles =
      mode === 'full'
        ? ['rifleman', 'rifleman', 'tank', 'medic', ...(tier >= 1 ? ['special'] : []), ...(tier >= 2 ? ['special', 'rifleman'] : [])]
        : ['rifleman', 'rifleman'];
    roles.forEach((role, i) => {
      const ang = (i / roles.length) * Math.PI * 2 + tier;
      const rad = role === 'tank' ? 3.2 : 4.6;
      this._spawnCombatUnit({
        faction,
        role,
        x: op.x + Math.cos(ang) * rad,
        z: op.z + Math.sin(ang) * rad,
        outpostId: op.id
      });
    });
  }

  _refreshInvasionWarzones(zoneState) {
    this.activeWarzones.length = 0;
    const op = zoneState.outposts[zoneState.activeIndex];
    if (op) {
      this.activeWarzones.push({ x: op.x, z: op.z, outpostId: op.id });
    } else if (zoneState.bossPhaseTriggered && !zoneState.enemyBossDefeated) {
      const court = zoneState.spec.bossCourtyard;
      this.activeWarzones.push({ x: court.x, z: court.z, outpostId: 'boss_duel' });
    }
  }

  _captureOutpost(zoneState, op, playerPos) {
    if (op.ownerFaction === this.playerFaction) return;
    op.ownerFaction = this.playerFaction;
    op.captureHoldTimer = 0;

    const opIdx = zoneState.outposts.indexOf(op);
    zoneState.captureZones[opIdx]?.markCaptured();

    this._syncZone3DColors(zoneState.id);
    soundFX.playTrueHeroFanfare();

    // Recompensa em Studs no Piso do Outpost
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      this.destructibles.spawnAmbientStud(
        op.x + Math.cos(ang) * 2.5,
        (op.y ?? this._groundAt(op.x, op.z, 1)) + 0.65,
        op.z + Math.sin(ang) * 2.5,
        i % 2 === 0 ? 'blue' : 'gold'
      );
    }

    // Tropas aliadas passam a nascer do posto conquistado
    this._spawnCombatUnit({ faction: this.playerFaction, role: 'rifleman', x: op.x - 2.2, z: op.z + 2.0, outpostId: op.id });
    this._spawnCombatUnit({ faction: this.playerFaction, role: 'medic', x: op.x + 2.2, z: op.z + 2.0, outpostId: op.id });

    // +1:30 no relógio
    zoneState.invasionClock += INVASION_RULES.clockPerCapture;

    // Próximo objetivo da sequência
    zoneState.activeIndex = opIdx + 1;
    const nextOp = zoneState.outposts[zoneState.activeIndex];

    // RECUO: sobreviventes do posto perdido correm para reforçar o próximo
    const fallback = nextOp || zoneState.spec.bossCourtyard;
    for (const npc of this.combatNpcs) {
      if (npc.isAllied || npc.outpostId !== op.id) continue;
      npc.outpostId = nextOp ? nextOp.id : 'boss_court';
      npc.patrolAnchor = { x: fallback.x + (Math.random() - 0.5) * 6, z: fallback.z + (Math.random() - 0.5) * 6 };
      npc.retreating = true;
    }

    if (nextOp) {
      zoneState.captureZones[zoneState.activeIndex]?.setActive(true);
      this._spawnOutpostGarrison(zoneState, nextOp, 'full', zoneState.activeIndex);
      this.objectiveHud?.setTitle(`CAPTURE ${nextOp.name}`);
      this.hud?.showWantedBanner?.(`${op.code} CAPTURADO!`, `+1:30 // PRÓXIMO: ${nextOp.code}`, 'escaped', 2600);
    } else {
      // Os 3 postos são seus: o chefe aparece no pátio!
      this._triggerBossClimaxDuel(zoneState, playerPos);
      this.objectiveHud?.setTitle(`DERROTE ${FACTION_THEME[zoneState.ownerFaction]?.bossTitle || 'O CHEFE'}`);
      this.hud?.showWantedBanner?.('CHEFÃO NO PÁTIO!', 'OS 3 POSTOS SÃO SEUS // DERRUBE O CHEFE', 'pursuit', 3200);
    }
    this._refreshInvasionWarzones(zoneState);
  }

  _triggerBossClimaxDuel(zoneState, playerPos) {
    zoneState.bossPhaseTriggered = true;
    const defenderFaction = zoneState.ownerFaction;
    const court = zoneState.spec.bossCourtyard;

    zoneState.enemyBoss = this._spawnCombatUnit({
      faction: defenderFaction,
      role: 'boss',
      x: court.x,
      z: court.z,
      outpostId: 'boss_court'
    });
    // Escolta do chefe
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this._spawnCombatUnit({
        faction: defenderFaction,
        role: i === 0 ? 'special' : 'rifleman',
        x: court.x + Math.cos(a) * 6,
        z: court.z + Math.sin(a) * 6,
        outpostId: 'boss_court'
      });
    }

    // O seu time envia o BOSS COLOSSAL ALIADO para lutar ao seu lado!
    const allyBossX = THREE.MathUtils.lerp(playerPos.x, court.x, 0.35);
    const allyBossZ = THREE.MathUtils.lerp(playerPos.z, court.z, 0.35);
    zoneState.alliedBoss = this._spawnCombatUnit({
      faction: this.playerFaction,
      role: 'boss',
      x: allyBossX,
      z: allyBossZ
    });
  }

  _conquerTerritory(zoneState, playerPos) {
    zoneState.ownerFaction = this.playerFaction;
    zoneState.conqueredByPlayer = true;
    zoneState.garrisonLevel = 0;
    this.counterAttack.armThreat(zoneState);
    for (const op of zoneState.outposts) {
      op.ownerFaction = this.playerFaction;
    }
    zoneState.captureZones.forEach((cz) => cz.reset());
    this._syncZone3DColors(zoneState.id);
    soundFX.playTrueHeroFanfare();

    // Chuva Gigante Comemorativa de Studs Roxos (10.000) e Dourados (100)!
    const baseY = this._groundAt(playerPos.x, playerPos.z, playerPos.y) + 0.85;
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2;
      const rad = 2.4 + (i % 3) * 1.8;
      const tier = i % 3 === 0 ? 'purple' : i % 2 === 0 ? 'blue' : 'gold';
      this.destructibles.spawnAmbientStud(
        playerPos.x + Math.cos(ang) * rad,
        baseY + (i % 4) * 0.35,
        playerPos.z + Math.sin(ang) * rad,
        tier
      );
    }

    this.objectiveHud?.hide();
    this.hud?.showWantedBanner?.('TERRITÓRIO CONQUISTADO!', `${zoneState.spec.title} // FIQUE DE OLHO: ELES VÃO VOLTAR`, 'escaped', 3800);

    // Restaura os 4 Corações LEGO, salva a conquista e transforma o território em QG Aliado!
    this.livingCity.playerHp = this.livingCity.playerMaxHp;
    this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    this._enterAllyHqMode(zoneState.id);
    this.onTerritoryConquered?.(zoneState);
    this.hud?.saveCurrentProgress?.();
  }

  /**
   * Invasão falhou (tempo esgotado ou jogador derrubado): volta ao portão e os postos voltam ao dono.
   */
  _failInvasion(zoneState, title = 'INVASÃO FRACASSADA', subtitle = 'A FACÇÃO SEGUROU O TERRITÓRIO') {
    const controller = this._lastController;
    const exitGate = zoneState?.spec?.safeExitGate || { x: 0, z: -92 };
    const ey = this._groundAt(exitGate.x, exitGate.z, 1) + 0.5;
    if (controller) {
      if (controller.currentVehicle) controller.exitVehicle?.();
      controller.position?.set(exitGate.x, ey, exitGate.z);
      controller.velocity?.set(0, 0, 0);
      if (controller.minifigure?.root && controller.position) {
        controller.minifigure.root.position.copy(controller.position);
      }
    }
    if (zoneState && !zoneState.conqueredByPlayer) {
      for (const op of zoneState.outposts) op.ownerFaction = zoneState.ownerFaction;
      zoneState.captureZones.forEach((cz) => cz.reset());
      this._syncZone3DColors(zoneState.id);
    }
    this.livingCity.playerHp = this.livingCity.playerMaxHp;
    this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    soundFX.playLegoBreak(false);
    this._cleanupActiveZoneUnits();
    this.objectiveHud?.hide();
    this.hud?.showWantedBanner?.(title, subtitle, 'busted', 3200);
    this.activeZoneId = null;
    this.activeMode = 'PEACEFUL_CITY';
    this.isInvasionActive = false;
  }

  // ============================================================================
  // ATUALIZAÇÃO POR FRAME (60 FPS CRAVADOS)
  // ============================================================================
  update(dt, playerPos, controller = null) {
    if (!playerPos) return;
    this._animClock += dt;
    if (controller) this._lastController = controller;

    // Anima antenas de radar e giroflex dos 9 Outposts
    for (const st of Object.values(this.territories)) {
      const inThisWar = this.isInvasionActive && this.activeZoneId === st.id;
      for (const op of st.outposts) {
        if (op.dishGroup) {
          op.dishGroup.rotation.y += dt * (inThisWar ? 3.8 : 1.1);
        }
        if (op.sirenBar) {
          op.sirenBar.rotation.y += dt * (inThisWar ? 9.5 : 1.5);
        }
        if (op.spotlightMat) {
          op.spotlightMat.opacity = inThisWar
            ? 0.16 + 0.12 * Math.abs(Math.sin(this._animClock * 6.5))
            : 0.12;
        }
      }
    }

    // 🏦 Assalto ao Super Banco (roda no Centro, fora dos territórios)
    this.world.superBankData?.update?.(dt);
    this.bankHeist.tick(dt, playerPos);
    if (this.bankHeist.isEngaged) {
      this._updateConvoyDrops(dt);
      this._updateCombatUnitsAndHealBeams(dt, playerPos, controller, this._bankZoneState);
      this._updateProjectilesAndShockwaves(dt, playerPos, controller, this._bankZoneState);
      return;
    }

    // Modo Livre sem facção escolhida -> apenas cidade pacífica
    if (!FACTION_THEME[this.playerFaction]) {
      if (this.activeZoneId) {
        this._cleanupActiveZoneUnits();
        this.activeZoneId = null;
        this.activeMode = 'PEACEFUL_CITY';
        this.isInvasionActive = false;
      }
      return;
    }

    const strictZone = getTerritoryZoneAt(playerPos.x, playerPos.z, 0);
    const hysteresisZone = getTerritoryZoneAt(playerPos.x, playerPos.z, 14);

    if (strictZone) {
      const targetState = this.territories[strictZone.id];
      const shouldBeAllyHq = targetState.ownerFaction === this.playerFaction;
      const ca = this.counterAttack;
      const underAttack = shouldBeAllyHq && ca.isActive && ca.zoneId === strictZone.id;
      const desiredMode = underAttack ? 'COUNTER_ATTACK' : shouldBeAllyHq ? 'ALLY_HQ' : 'INVASION_1V1';

      if (this.activeZoneId !== strictZone.id || this.activeMode !== desiredMode) {
        if (desiredMode === 'COUNTER_ATTACK') {
          ca.beginDefense();
        } else if (desiredMode === 'ALLY_HQ') {
          this._enterAllyHqMode(strictZone.id);
        } else {
          this._enterInvasionWarMode(strictZone.id, playerPos);
        }
      }
    } else if (this.activeZoneId && !hysteresisZone) {
      // DESENGAJAMENTO LIMPO AO SAIR DO TERRITÓRIO PARA A CIDADE CIVIL!
      const leftZone = this.territories[this.activeZoneId];
      if (this.isInvasionActive && leftZone && !leftZone.conqueredByPlayer) {
        // Saiu no meio da invasão: postos tomados voltam ao dono
        for (const op of leftZone.outposts) op.ownerFaction = leftZone.ownerFaction;
        leftZone.captureZones.forEach((cz) => cz.reset());
        this._syncZone3DColors(leftZone.id);
      }
      this.objectiveHud?.hide();
      this._cleanupActiveZoneUnits();
      this.activeZoneId = null;
      this.activeMode = 'PEACEFUL_CITY';
      this.isInvasionActive = false;
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
      return;
    }

    this.counterAttack.tick(dt, playerPos);

    if (!this.activeZoneId) return;

    const currentZone = this.territories[this.activeZoneId];
    this._updateConvoyDrops(dt);
    this._updateCombatUnitsAndHealBeams(dt, playerPos, controller, currentZone);
    this._updateProjectilesAndShockwaves(dt, playerPos, controller, currentZone);

    if (this.activeMode === 'INVASION_1V1' && currentZone) {
      this._updateInvasionProgression(dt, playerPos, currentZone);
    }
  }

  _updateConvoyDrops(dt) {
    for (let i = this.activeConvoyDrops.length - 1; i >= 0; i--) {
      const cv = this.activeConvoyDrops[i];
      if (!cv.destructible || cv.destructible.destroyed) {
        this.activeConvoyDrops.splice(i, 1);
        continue;
      }

      cv.maxTravelTimer -= dt;
      const dx = cv.targetX - cv.mesh.position.x;
      const dz = cv.targetZ - cv.mesh.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= 3.2 || cv.maxTravelTimer <= 0) {
        this._disembarkConvoySquad(cv);
        this.activeConvoyDrops.splice(i, 1);
        continue;
      }

      const step = Math.min(dist, cv.speed * dt);
      const nx = cv.mesh.position.x + (dx / dist) * step;
      const nz = cv.mesh.position.z + (dz / dist) * step;
      const resolved = this.livingCity._resolveBuildingCollision(nx, nz, 2.1);
      const ny = this._groundAt(resolved.x, resolved.z, cv.mesh.position.y);

      cv.mesh.position.set(resolved.x, ny + 0.16, resolved.z);
      cv.mesh.rotation.y = Math.atan2(dx, dz);
      cv.destructible.basePos.copy(cv.mesh.position);

      if (resolved.collided) {
        this._disembarkConvoySquad(cv);
        this.activeConvoyDrops.splice(i, 1);
      }
    }
  }

  _updateInvasionProgression(dt, playerPos, zoneState) {
    let enemyCount = 0;
    let allyCount = 0;
    let hasAlliedMedic = false;
    for (const npc of this.combatNpcs) {
      if (!npc.destructible || npc.destructible.destroyed) continue;
      if (npc.isAllied) {
        allyCount++;
        if (npc.role === 'medic') hasAlliedMedic = true;
      } else {
        enemyCount++;
      }
    }

    // Relógio da invasão
    zoneState.invasionClock -= dt;
    this.objectiveHud?.setTimer(zoneState.invasionClock);
    if (zoneState.invasionClock <= 0) {
      this._failInvasion(zoneState, 'TEMPO ESGOTADO', 'A FACÇÃO SEGUROU O TERRITÓRIO // TENTE DE NOVO');
      return;
    }

    const activeOp = zoneState.outposts[zoneState.activeIndex];
    if (activeOp) {
      // Conta quem está DENTRO do anel de captura
      const zone = zoneState.captureZones[zoneState.activeIndex];
      let attackers = 0;
      let defenders = 0;
      if (zone.isInside(playerPos.x, playerPos.z) && Math.abs(playerPos.y - (activeOp.y ?? playerPos.y)) < 12) {
        attackers++;
      }
      for (const npc of this.combatNpcs) {
        if (!npc.destructible || npc.destructible.destroyed) continue;
        const pos = npc.visual.root.position;
        if (!zone.isInside(pos.x, pos.z)) continue;
        if (npc.isAllied) attackers++;
        else defenders++;
      }
      // O jogador é necessário para iniciar; aliados sozinhos só ajudam se você estiver perto
      const playerNear = Math.hypot(playerPos.x - activeOp.x, playerPos.z - activeOp.z) < zone.radius + 18;
      const effectiveAttackers = playerNear ? attackers : 0;
      const done = zone.update(dt, { attackers: effectiveAttackers, defenders });

      const pct = Math.round(zone.progress * 100);
      if (zone.state === 'CONTESTED') {
        this.objectiveHud?.setProgress(zone.progress, 'contested');
        this.objectiveHud?.setStatus(`CONTESTADO ${pct}%`, 'contested');
      } else if (zone.state === 'CAPTURING') {
        this.objectiveHud?.setProgress(zone.progress, 'capture');
        this.objectiveHud?.setStatus(`CAPTURANDO ${pct}%`, 'capture');
      } else {
        this.objectiveHud?.setProgress(zone.progress, 'neutral');
        this.objectiveHud?.setStatus(defenders > 0 ? `${defenders} DEFENSORES NO PONTO` : `ENTRE NO ANEL ${activeOp.code}`, '');
      }
      this.objectiveHud?.setWave(zoneState.activeIndex + 1, zoneState.outposts.length + 1, 'ETAPA');

      if (done) {
        this._captureOutpost(zoneState, activeOp, playerPos);
        if (this.activeMode !== 'INVASION_1V1') return;
      }
    } else if (zoneState.bossPhaseTriggered) {
      const boss = zoneState.enemyBoss;
      const ratio = boss?.destructible ? Math.max(0, boss.destructible.hp / (boss.destructible.maxHp || 1550)) : 0;
      this.objectiveHud?.setProgress(ratio, 'danger');
      this.objectiveHud?.setStatus(`CHEFE ${Math.round(ratio * 100)}%`, 'danger');
      this.objectiveHud?.setWave(zoneState.outposts.length + 1, zoneState.outposts.length + 1, 'ETAPA');
      if (zoneState.enemyBossDefeated) {
        this._conquerTerritory(zoneState, playerPos);
        return;
      }
    }

    // Ondas de reforço da facção dona, chegando no PONTO ATIVO (não em você)
    zoneState.reinforceTimer -= dt;
    const enemyCap = INVASION_RULES.enemyCapBase + INVASION_RULES.enemyCapPerPoint * zoneState.activeIndex;
    if (zoneState.reinforceTimer <= 0) {
      zoneState.reinforceTimer = INVASION_RULES.reinforceInterval;
      if (enemyCount < enemyCap) {
        const target = activeOp || zoneState.spec.bossCourtyard;
        this._spawnMotorizedSquad({
          faction: zoneState.ownerFaction,
          isAllied: false,
          zoneState,
          playerPos,
          roles: buildFactionSquad(zoneState.ownerFaction, zoneState.activeIndex + 1),
          target
        });
      }
    }

    // Ondas de Reforço do Comboio Aliado (Do portão ou dos Outposts já capturados!)
    zoneState.alliedWaveTimer -= dt;
    if (zoneState.alliedWaveTimer <= 0) {
      zoneState.alliedWaveTimer = 12;
      if (allyCount < 8) {
        const alliedOps = zoneState.outposts.filter((o) => o.ownerFaction === this.playerFaction);
        if (alliedOps.length > 0 && Math.random() < 0.5) {
          const srcOp = alliedOps[alliedOps.length - 1];
          this._spawnCombatUnit({
            faction: this.playerFaction,
            role: hasAlliedMedic ? 'rifleman' : 'medic',
            x: srcOp.x + 2.2,
            z: srcOp.z - 2.0
          });
          this._spawnCombatUnit({
            faction: this.playerFaction,
            role: Math.random() < 0.5 ? 'tank' : 'special',
            x: srcOp.x - 2.2,
            z: srcOp.z + 2.0
          });
        } else {
          this._spawnMotorizedSquad({
            faction: this.playerFaction,
            isAllied: true,
            zoneState,
            playerPos
          });
        }
      }
    }
  }

  _updateCombatUnitsAndHealBeams(dt, playerPos, controller, zoneState) {
    for (const beam of this.healBeams) {
      beam.visible = false;
    }
    let beamIdx = 0;
    let playerBeingHealed = false;

    for (let i = this.combatNpcs.length - 1; i >= 0; i--) {
      const npc = this.combatNpcs[i];
      const obj = npc.destructible;
      if (!obj || obj.destroyed) {
        if (obj) this.destructibles.unregisterDestructible(obj);
        this.combatNpcs.splice(i, 1);
        continue;
      }

      const root = npc.visual.root;
      const pos = root.position;
      npc.visual.allyMarker.visible = npc.isAllied;
      npc.visual.allyMarker.rotation.y += dt * 2.8;
      animateFactionSoldier(npc.visual, this._animClock, npc.patrolAngle);

      if (npc.muzzleTimer > 0) {
        npc.muzzleTimer -= dt;
        if (npc.muzzleTimer <= 0) {
          npc.visual.muzzleFlash.visible = false;
        }
      }

      // ======================================================================
      // MODO 1: QG ALIADO EM PAZ (Patrulha calma, Continência/Aceno e Cura!)
      // ======================================================================
      if (this.activeMode === 'ALLY_HQ') {
        const distPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

        if (npc.role === 'medic' && this.livingCity.playerHp < this.livingCity.playerMaxHp && distPlayer < 22) {
          const healStep = distPlayer > 6.5 ? npc.speed * dt : 0;
          if (healStep > 0) {
            const nx = pos.x + ((playerPos.x - pos.x) / distPlayer) * healStep;
            const nz = pos.z + ((playerPos.z - pos.z) / distPlayer) * healStep;
            const res = this.livingCity._resolveBuildingCollision(nx, nz, 0.95);
            pos.set(res.x, this._groundAt(res.x, res.z, pos.y), res.z);
          }
          root.rotation.y = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
          this._applyPlayerHeal(dt * 36, pos, playerPos, beamIdx++);
          playerBeingHealed = true;
        } else if (distPlayer < 13.5) {
          // Guarda Aliado vira para você e bate continência / acena!
          npc.saluting = true;
          root.rotation.y = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
          npc.visual.leftLeg.rotation.x = 0;
          npc.visual.rightLeg.rotation.x = 0;
          npc.visual.rightArm.rotation.x = -2.35 + Math.sin(this._animClock * 5.0) * 0.14;
          npc.visual.rightArm.rotation.z = -0.28;
        } else {
          // Patrulha calma ao redor do posto/portão
          npc.saluting = false;
          npc.visual.rightArm.rotation.z = 0;
          npc.patrolAngle += dt * 0.55;
          const tx = npc.patrolAnchor.x + Math.cos(npc.patrolAngle) * 4.2;
          const tz = npc.patrolAnchor.z + Math.sin(npc.patrolAngle) * 4.2;
          const dx = tx - pos.x;
          const dz = tz - pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.35) {
            const step = Math.min(d, 2.4 * dt);
            const res = this.livingCity._resolveBuildingCollision(
              pos.x + (dx / d) * step,
              pos.z + (dz / d) * step,
              0.95
            );
            pos.set(res.x, this._groundAt(res.x, res.z, pos.y), res.z);
            root.rotation.y = Math.atan2(dx, dz);
            npc.walkPhase += dt * 5.5;
            npc.visual.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.42;
            npc.visual.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.42;
            npc.visual.rightArm.rotation.x = -0.45;
          }
        }

        obj.basePos.copy(pos);
        continue;
      }

      // ======================================================================
      // MODO 2: GUERRA DE INVASÃO 1X1 (SUA FACÇÃO vs FACÇÃO DONA DO TERRITÓRIO)
      // ======================================================================
      // Médico de Combate Aliado acompanha o jogador e cura com Feixe Médico 3D!
      if (npc.isAllied && npc.role === 'medic') {
        const dPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (this.livingCity.playerHp < this.livingCity.playerMaxHp && dPlayer < 20) {
          this._applyPlayerHeal(dt * 34, pos, playerPos, beamIdx++);
          playerBeingHealed = true;
        }
        if (dPlayer > 6.5) {
          const step = Math.min(dPlayer - 5.5, npc.speed * dt);
          const res = this.livingCity._resolveBuildingCollision(
            pos.x + ((playerPos.x - pos.x) / dPlayer) * step,
            pos.z + ((playerPos.z - pos.z) / dPlayer) * step,
            0.95
          );
          pos.set(res.x, this._groundAt(res.x, res.z, pos.y), res.z);
          root.rotation.y = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
          npc.walkPhase += dt * 8.5;
          npc.visual.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.55;
          npc.visual.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.55;
          obj.basePos.copy(pos);
          continue;
        }
      }

      // RECUO / CHEGADA: corre até o ponto designado antes de voltar a lutar
      if (npc.retreating && npc.patrolAnchor) {
        const rdx = npc.patrolAnchor.x - pos.x;
        const rdz = npc.patrolAnchor.z - pos.z;
        const rd = Math.hypot(rdx, rdz);
        if (rd < 3.2) {
          npc.retreating = false;
        } else {
          const step = Math.min(rd, npc.speed * 1.25 * dt);
          const res = this.livingCity._resolveBuildingCollision(
            pos.x + (rdx / rd) * step,
            pos.z + (rdz / rd) * step,
            npc.isBoss ? 1.85 : 0.95
          );
          if (res.collided && Math.hypot(res.x - pos.x, res.z - pos.z) < step * 0.2) {
            npc.retreating = false; // travou em parede: volta a lutar
          }
          pos.set(res.x, this._groundAt(res.x, res.z, pos.y), res.z);
          root.rotation.y = Math.atan2(rdx, rdz);
          npc.walkPhase += dt * 11;
          npc.visual.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.7;
          npc.visual.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.7;
          obj.basePos.copy(pos);
          continue;
        }
      }

      // Seleção de alvo 1x1 (Aliados focam Defensores; Defensores focam Aliados ou Jogador!)
      let bestTargetPos = null;
      let bestTargetNpc = null;
      let bestDist = 72;

      for (const other of this.combatNpcs) {
        if (other === npc || other.isAllied === npc.isAllied) continue;
        if (!other.destructible || other.destructible.destroyed) continue;
        const oPos = other.visual.root.position;
        if (Math.abs(oPos.y - pos.y) > 4.5) continue; // outro andar: não enxerga através da laje
        const d = Math.hypot(oPos.x - pos.x, oPos.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          bestTargetNpc = other;
          bestTargetPos = oPos;
        }
      }

      if (!npc.isAllied) {
        const dPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (dPlayer < bestDist * 0.92 && dPlayer < 65 && Math.abs(playerPos.y - pos.y) < 4.5) {
          bestDist = dPlayer;
          bestTargetNpc = null;
          bestTargetPos = playerPos;
        }
      }

      // Movimento tático (Aliados avançam junto com o jogador quando sem alvo próximo)
      let moveTarget = bestTargetPos;
      let stopRange = npc.isBoss ? 14.0 : 16.5;
      if (!moveTarget && npc.isAllied && this.activeMode === 'BANK_HEIST') {
        // Seu time segue você no mesmo andar; em outro andar, segura a posição
        moveTarget = Math.abs(playerPos.y - pos.y) < 3 ? playerPos : npc.patrolAnchor;
        stopRange = 5;
      } else if (!moveTarget && npc.isAllied && zoneState && this.activeMode === 'COUNTER_ATTACK') {
        // Defesa da bandeira: aliados seguram o pátio
        moveTarget = npc.patrolAnchor || zoneState.spec.bossCourtyard;
        stopRange = 4.5;
      } else if (!moveTarget && npc.isAllied && zoneState) {
        // Aliados avançam para o objetivo ativo da sequência
        const nextOp = zoneState.outposts[zoneState.activeIndex];
        const court = zoneState.bossPhaseTriggered ? zoneState.spec.bossCourtyard : null;
        moveTarget = nextOp ? { x: nextOp.x, z: nextOp.z } : court || playerPos;
        stopRange = 6.5;
      } else if (!moveTarget && !npc.isAllied && npc.patrolAnchor) {
        // Defensor sem alvo volta a guardar o seu ponto
        moveTarget = npc.patrolAnchor;
        stopRange = 3.5;
      }
      // Especialista C4: corre direto no alvo para detonar
      if (npc.role === 'special' && npc.faction === 'pcc' && bestTargetPos && !npc.isAllied) {
        stopRange = 1.2;
      }

      if (moveTarget) {
        const dx = moveTarget.x - pos.x;
        const dz = moveTarget.z - pos.z;
        const dist = Math.hypot(dx, dz);
        root.rotation.y = Math.atan2(dx, dz);

        if (dist > stopRange) {
          const step = Math.min(dist - stopRange * 0.85, npc.speed * dt);
          const res = this.livingCity._resolveBuildingCollision(
            pos.x + (dx / dist) * step,
            pos.z + (dz / dist) * step,
            npc.isBoss ? 1.85 : 0.95
          );
          pos.set(res.x, this._groundAt(res.x, res.z, pos.y), res.z);
          npc.walkPhase += dt * (npc.isBoss ? 6.0 : 8.5);
          npc.visual.leftLeg.rotation.x = Math.sin(npc.walkPhase) * 0.55;
          npc.visual.rightLeg.rotation.x = -Math.sin(npc.walkPhase) * 0.55;
        } else {
          npc.visual.leftLeg.rotation.x *= 0.85;
          npc.visual.rightLeg.rotation.x *= 0.85;
        }
      }

      // Ataque Especial de Terremoto dos Bosses Colossais Big-Fig
      if ((npc.isBoss || npc.heavyClass === 'brute') && bestTargetPos && bestDist < 12.5) {
        npc.slamCooldown -= dt;
        if (npc.slamCooldown <= 0) {
          npc.slamCooldown = 5.2;
          this._triggerBossGroundSlam(npc, bestTargetPos === playerPos ? controller : null, playerPos);
        }
      }

      // Demolidor C4 do PCC: detona ao encostar no alvo
      if (npc.role === 'special' && npc.faction === 'pcc' && bestTargetPos && bestDist < 3.4) {
        this._detonateC4Runner(npc, bestTargetPos === playerPos ? controller : null, playerPos, zoneState);
        continue;
      }

      // Disparo com verificação estrita de Linha de Visão (Zero tiro através de paredes!)
      npc.fireCooldown -= dt;
      if (bestTargetPos && bestDist < 54 && npc.fireCooldown <= 0) {
        npc.fireCooldown = npc.heavyClass === 'elite'
          ? 0.2 // atira pra caramba
          : npc.heavyClass === 'brute'
            ? 0.75
            : npc.isBoss
          ? 0.55
          : npc.role === 'tank'
            ? 0.95
            : npc.role === 'special'
              ? npc.faction === 'cv'
                ? 3.2 // RPG: lento e pesado
                : npc.faction === 'ares'
                  ? 0.42 // drone: rajada rápida
                  : 1.1
              : 0.82 + Math.random() * 0.35;
        if (this._hasClearLineOfSight(pos.x, pos.z, bestTargetPos.x, bestTargetPos.z)) {
          this._fireUnitProjectile(npc, bestTargetPos, bestTargetNpc);
        }
      }

      obj.basePos.copy(pos);
    }

    if (!playerBeingHealed && this.hud?.heartsContainer) {
      this.hud.heartsContainer.classList.remove('healing-pulse');
    }
  }

  _applyPlayerHeal(amount, medicPos, playerPos, beamSlot) {
    this.livingCity.playerHp = Math.min(
      this.livingCity.playerMaxHp,
      this.livingCity.playerHp + amount
    );
    this.hud?.setPlayerHealth(this.livingCity.playerHp, this.livingCity.playerMaxHp, true);

    const beam = this.healBeams[beamSlot];
    if (beam) {
      const start = new THREE.Vector3(medicPos.x, medicPos.y + 1.35, medicPos.z);
      const end = new THREE.Vector3(playerPos.x, playerPos.y + 1.15, playerPos.z);
      const dist = start.distanceTo(end);
      beam.visible = true;
      beam.position.copy(start).lerp(end, 0.5);
      beam.scale.set(1, 1, Math.max(0.2, dist));
      beam.lookAt(end);
    }
  }

  _fireUnitProjectile(npc, targetPos, targetNpc) {
    const geos = ensureSharedWarGeometries();
    const theme = FACTION_THEME[npc.faction] || FACTION_THEME.cv;
    const origin = npc.visual.root.position;
    const isRpg = npc.role === 'special' && npc.faction === 'cv';
    const isDrone = npc.role === 'special' && npc.faction === 'ares' && npc.visual.drone;
    const startY = origin.y + (npc.isBoss ? 3.1 : npc.hitH ? npc.hitH * 0.6 : isDrone ? 2.7 : isRpg ? 1.62 : 1.38);
    const targetY = (targetPos.y ?? origin.y) + (targetNpc?.isBoss ? 2.6 : 1.2);

    const dir = new THREE.Vector3(
      targetPos.x - origin.x + (Math.random() - 0.5) * 1.4,
      targetY - startY,
      targetPos.z - origin.z + (Math.random() - 0.5) * 1.4
    ).normalize();

    const bulletMesh = new THREE.Mesh(
      isRpg ? geos.rocketGeo : geos.bulletGeo,
      isRpg ? ROCKET_MAT : npc.isAllied ? ALLY_BULLET_MAT : getFactionBulletMat(npc.faction, theme.hex)
    );
    bulletMesh.position.set(origin.x + dir.x * 1.1, startY, origin.z + dir.z * 1.1);
    bulletMesh.lookAt(bulletMesh.position.clone().add(dir));
    this.scene.add(bulletMesh);

    npc.visual.muzzleFlash.visible = true;
    npc.muzzleTimer = 0.08;

    this.npcProjectiles.push({
      mesh: bulletMesh,
      vel: dir.multiplyScalar(npc.isBoss ? 48 : isRpg ? 26 : 42),
      isAllied: npc.isAllied,
      damage: npc.heavyClass === 'elite'
        ? 6
        : npc.heavyClass === 'brute'
          ? 13
          : npc.isBoss
            ? 16
            : isRpg
              ? 22
              : isDrone
                ? 4
                : npc.faction === 'guard'
                  ? 5
                  : npc.role === 'tank'
                    ? 11
                    : 8,
      splash: isRpg ? 5.5 : 0,
      life: isRpg ? 2.4 : 1.45
    });
  }

  _triggerBossGroundSlam(bossNpc, controller, playerPos) {
    const geos = ensureSharedWarGeometries();
    const theme = FACTION_THEME[bossNpc.faction] || FACTION_THEME.cv;
    const bPos = bossNpc.visual.root.position;

    const ringMat = new THREE.MeshBasicMaterial({
      color: theme.hex,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(geos.shockwaveGeo, ringMat);
    ringMesh.position.set(bPos.x, bPos.y + 0.25, bPos.z);
    this.scene.add(ringMesh);
    this.activeShockwaves.push({ mesh: ringMesh, mat: ringMat, scale: 1.0, life: 0.55 });

    // Dano em área nos oponentes próximos
    for (const other of this.combatNpcs) {
      if (other.isAllied === bossNpc.isAllied || !other.destructible || other.destructible.destroyed) {
        continue;
      }
      const d = Math.hypot(
        other.visual.root.position.x - bPos.x,
        other.visual.root.position.z - bPos.z
      );
      if (d < 11.5) {
        this.destructibles.damageObject(other.destructible, 65, bPos, false, {
          fromEnemyNpc: true
        });
      }
    }

    if (!bossNpc.isAllied && playerPos) {
      const dp = Math.hypot(playerPos.x - bPos.x, playerPos.z - bPos.z);
      if (dp < 10.5 && Math.abs(playerPos.y - bPos.y) < 3.5) {
        this._damagePlayerInInvasion(18, controller);
      }
    }
  }

  _updateProjectilesAndShockwaves(dt, playerPos, controller, zoneState) {
    for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
      const sw = this.activeShockwaves[i];
      sw.life -= dt;
      sw.scale += dt * (sw.isFlash ? 9.0 : 18.0);
      sw.mesh.scale.setScalar(sw.scale);
      sw.mat.opacity = Math.max(0, sw.life * (sw.isFlash ? 2.2 : 1.6));
      if (sw.life <= 0) {
        if (sw.mesh.parent) sw.mesh.parent.remove(sw.mesh);
        sw.mat.dispose?.();
        this.activeShockwaves.splice(i, 1);
      }
    }

    for (let i = this.npcProjectiles.length - 1; i >= 0; i--) {
      const p = this.npcProjectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      const px = p.mesh.position.x;
      const py = p.mesh.position.y;
      const pz = p.mesh.position.z;

      if (p.life <= 0 || this.livingCity._isInsideBuilding(px, pz, 0.15)) {
        if (p.splash) this._npcExplosion(p.mesh.position, p.splash, p.damage, p.isAllied, controller, zoneState);
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
        continue;
      }

      let hit = false;
      for (const npc of this.combatNpcs) {
        if (npc.isAllied === p.isAllied || !npc.destructible || npc.destructible.destroyed) continue;
        const nPos = npc.visual.root.position;
        const hitR = npc.hitR ?? (npc.isBoss ? 2.3 : 1.05);
        const hitH = npc.hitH ?? (npc.isBoss ? 5.0 : 2.3);
        if (
          Math.abs(px - nPos.x) < hitR &&
          Math.abs(pz - nPos.z) < hitR &&
          py >= nPos.y &&
          py <= nPos.y + hitH
        ) {
          this.destructibles.damageObject(npc.destructible, p.damage * 2.2, p.mesh.position, false, {
            fromEnemyNpc: true
          });
          hit = true;
          break;
        }
      }

      if (!hit && !p.isAllied && this.isInvasionActive && playerPos) {
        if (
          Math.abs(px - playerPos.x) < 0.95 &&
          Math.abs(pz - playerPos.z) < 0.95 &&
          py >= playerPos.y - 0.2 &&
          py <= playerPos.y + 2.3
        ) {
          this._damagePlayerInInvasion(p.damage, controller, zoneState);
          hit = true;
        }
      }

      if (hit) {
        if (p.splash) this._npcExplosion(p.mesh.position, p.splash, p.damage, p.isAllied, controller, zoneState);
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
      }
    }
  }

  /**
   * Explosão de facção (RPG / C4): só fere o lado oposto e o jogador (se vier do inimigo).
   */
  _npcExplosion(center, radius, damage, fromAllied, controller, zoneState) {
    const geos = ensureSharedWarGeometries();
    soundFX.playExplosion(0.85);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 });
    const flash = new THREE.Mesh(geos.blastGeo, flashMat);
    flash.position.copy(center);
    this.scene.add(flash);
    this.activeShockwaves.push({ mesh: flash, mat: flashMat, scale: 0.6, life: 0.4, isFlash: true });

    const ringMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geos.shockwaveGeo, ringMat);
    ring.position.set(center.x, center.y - 0.6, center.z);
    this.scene.add(ring);
    this.activeShockwaves.push({ mesh: ring, mat: ringMat, scale: 1.0, life: 0.45 });

    for (const other of this.combatNpcs) {
      if (other.isAllied === fromAllied || !other.destructible || other.destructible.destroyed) continue;
      const op = other.visual.root.position;
      const d = Math.hypot(op.x - center.x, op.z - center.z);
      if (d < radius) {
        this.destructibles.damageObject(other.destructible, damage * 3 * (1 - d / (radius * 1.4)), center, false, {
          fromEnemyNpc: true
        });
      }
    }
    const pp = this._lastController?.position;
    if (!fromAllied && pp) {
      const dp = Math.hypot(pp.x - center.x, pp.z - center.z);
      if (dp < radius && Math.abs(pp.y - center.y) < 4) {
        this._damagePlayerInInvasion(damage * (1 - dp / (radius * 1.3)), controller, zoneState);
      }
    }
  }

  _detonateC4Runner(npc, controller, playerPos, zoneState) {
    const pos = npc.visual.root.position.clone();
    pos.y += 1.0;
    this._npcExplosion(pos, 6.5, 30, npc.isAllied, controller, zoneState);
    if (npc.destructible && !npc.destructible.destroyed) {
      this.destructibles.damageObject(npc.destructible, 99999, pos, false, { fromEnemyNpc: true });
    }
  }

  _damagePlayerInInvasion(amount, controller, zoneState = null) {
    if (!this.isInvasionActive) return;
    const dmg = controller?.currentVehicle ? amount * 0.35 : amount;
    this.livingCity.playerHp = Math.max(0, this.livingCity.playerHp - dmg);
    this.hud?.setPlayerHealth(this.livingCity.playerHp, this.livingCity.playerMaxHp, false);

    if (this.livingCity.playerHp <= 0) {
      if (controller) this._lastController = controller;
      if (this.activeMode === 'BANK_HEIST' && this.bankHeist.isActive) {
        const c = this._lastController;
        const sx = 0;
        const sz = BANK_SPEC.frontZ + 14;
        this.bankHeist.onPlayerDown();
        this.livingCity.playerHp = this.livingCity.playerMaxHp;
        this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
        if (c?.position) {
          if (c.currentVehicle) c.exitVehicle?.();
          c.position.set(sx, this._groundAt(sx, sz, 1) + 0.5, sz);
          c.velocity?.set(0, 0, 0);
          if (c.minifigure?.root) c.minifigure.root.position.copy(c.position);
        }
        return;
      }
      if (this.activeMode === 'COUNTER_ATTACK' && this.counterAttack.isActive) {
        this.counterAttack._lose('VOCÊ CAIU DEFENDENDO A BANDEIRA');
        return;
      }
      this._failInvasion(zoneState || this.territories[this.activeZoneId], 'VOCÊ CAIU!', 'RECUO TÁTICO PARA O PORTÃO // OS POSTOS VOLTARAM AO DONO');
    }
  }
}

