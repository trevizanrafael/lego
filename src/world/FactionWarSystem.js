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
        }))
      };
    }

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

  applySavedConquests(conqueredIds = [], playerFaction = this.playerFaction) {
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

  _findSafeZonePos(x, z, radius = 1.4) {
    const safe = this.livingCity._findSafeStreetSpawn(x, z, radius);
    const y = this._groundAt(safe.x, safe.z, 2);
    return { x: safe.x, y, z: safe.z };
  }

  // ============================================================================
  // CRIAÇÃO DE SOLDADOS MINIFIGURA LEGO ARTICULADOS & BOSSES BIG-FIG COLOSSAIS
  // ============================================================================
  _spawnCombatUnit({ faction, role = 'rifleman', x, z, outpostId = null, patrolAnchor = null }) {
    const geos = ensureSharedWarGeometries();
    const theme = FACTION_THEME[faction] || FACTION_THEME.cv;
    const isAllied = faction === this.playerFaction;
    const isBoss = role === 'boss';
    const isTank = role === 'tank';
    const isMedic = role === 'medic';

    const safePos = this._findSafeZonePos(x, z, isBoss ? 2.2 : 1.15);
    const root = new THREE.Group();
    root.userData.skipStaticMerge = true;

    const unitScale = isBoss ? 2.32 : isTank ? 1.14 : 1.0;
    const bodyRig = new THREE.Group();
    bodyRig.scale.setScalar(unitScale);
    root.add(bodyRig);

    const primaryHex = isMedic ? 0xf8fafc : theme.hex;
    const legHex = faction === 'ares' ? 0x334155 : 0x0f172a;
    const vestMats = getTacticalVestMaterials(faction, role, primaryHex);
    const legMat = getLegoMaterial(legHex, { roughness: 0.3 });
    const armMat = getLegoMaterial(isMedic ? theme.hex : theme.darkHex, { roughness: 0.26 });
    const skinHex = faction === 'pcc' || faction === 'ares' ? 0x111827 : LEGO_COLORS.yellow;
    const handMat = getLegoMaterial(0x111827, { roughness: 0.3 });

    const hip = new THREE.Mesh(geos.hipGeo, legMat);
    hip.position.y = 0.72;
    const torso = new THREE.Mesh(geos.torsoGeo, vestMats);
    torso.position.y = 1.16;
    torso.castShadow = true;

    const leftLeg = new THREE.Mesh(geos.legGeo, legMat);
    leftLeg.position.set(-0.2, 0.66, 0);
    const rightLeg = new THREE.Mesh(geos.legGeo, legMat);
    rightLeg.position.set(0.2, 0.66, 0);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.56, 1.44, 0);
    const lArmMesh = new THREE.Mesh(geos.armGeo, armMat);
    const lHand = new THREE.Mesh(geos.handGeo, handMat);
    lHand.position.set(0, -0.55, 0.03);
    leftArm.add(lArmMesh, lHand);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.56, 1.44, 0);
    const rArmMesh = new THREE.Mesh(geos.armGeo, armMat);
    const rHand = new THREE.Mesh(geos.handGeo, handMat);
    rHand.position.set(0, -0.55, 0.03);
    rightArm.add(rArmMesh, rHand);

    // Cabeça Cilíndrica LEGO + Pino Stud Superior + Capacete/Bandana da Facção
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.84;
    const faceMat = getSharedNpcFaceMaterial(
      faction === 'cv' ? 'bandit_fierce' : faction === 'pcc' ? 'masked_balaclava' : 'visor_cyan',
      skinHex
    );
    const headMesh = new THREE.Mesh(geos.headCyl, faceMat);
    const topStud = new THREE.Mesh(SHARED_STUD_GEO, getLegoMaterial(skinHex));
    topStud.position.y = 0.3;
    headGroup.add(headMesh, topStud);

    if (faction === 'cv') {
      const bandana = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.16, 14),
        getLegoMaterial(0xef4444, { roughness: 0.28 })
      );
      bandana.position.y = 0.14;
      headGroup.add(bandana);
    } else if (faction === 'pcc') {
      const tacCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.295, 0.285, 0.2, 14),
        getLegoMaterial(0x1d4ed8, { roughness: 0.25 })
      );
      tacCap.position.y = 0.16;
      headGroup.add(tacCap);
    } else {
      const cyberHelm = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.54, 0.6),
        getLegoMaterial(0x334155, { metalness: 0.45, roughness: 0.22 })
      );
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.16, 0.63),
        new THREE.MeshBasicMaterial({ color: 0xd946ef })
      );
      visor.position.y = 0.04;
      headGroup.add(cyberHelm, visor);
    }

    // Ombreiras Colossal Big-Fig para Bosses + Armamento 3D na Mão Direita
    if (isBoss) {
      for (const sx of [-0.74, 0.74]) {
        const pauldron = createLegoBrick(0.52, 0.44, 0.62, theme.hex, { studStep: 0.26 });
        pauldron.position.set(sx, 1.56, 0);
        bodyRig.add(pauldron);
      }
      const crest = createLegoBrick(0.75, 0.34, 0.45, theme.accentHex, { studs: false });
      crest.position.set(0, 2.24, 0);
      bodyRig.add(crest);
    }

    const weaponMat = getLegoMaterial(
      isMedic ? 0x22c55e : faction === 'ares' ? 0xd946ef : 0x1e293b,
      { roughness: 0.25, metalness: 0.35 }
    );
    const weaponMesh = new THREE.Mesh(geos.rifleGeo, weaponMat);
    rightArm.add(weaponMesh);
    rightArm.rotation.x = -0.52;

    const muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: isMedic ? 0x4ade80 : 0xfacc15 })
    );
    muzzleFlash.position.set(0, -0.43, 1.08);
    muzzleFlash.visible = false;
    rightArm.add(muzzleFlash);

    if (isTank || isBoss) {
      const shieldMesh = new THREE.Mesh(
        geos.shieldGeo,
        getLegoMaterial(theme.secondaryHex, { roughness: 0.25, metalness: 0.4 })
      );
      leftArm.add(shieldMesh);
      leftArm.rotation.x = -0.45;
    }

    // Losango Verde Discreto APENAS nos Aliados (Zero barras de vida flutuando na tela!)
    const allyMarker = new THREE.Mesh(
      geos.allyDiamond,
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    allyMarker.position.set(0, isBoss ? 5.85 : 2.62, 0);
    allyMarker.visible = isAllied;
    root.add(allyMarker);

    bodyRig.add(hip, torso, leftLeg, rightLeg, leftArm, rightArm, headGroup);
    root.position.set(safePos.x, safePos.y, safePos.z);
    this.scene.add(root);

    const hp = isBoss ? 1550 : isTank ? 280 : isMedic ? 175 : 160;
    const destructible = this.destructibles.registerDestructible({
      mesh: root,
      type: isBoss ? 'npc_boss' : 'npc_fighter',
      hp,
      radius: isBoss ? 2.45 : 1.05,
      height: isBoss ? 5.2 : 2.25,
      colliders: [],
      debrisColors: [theme.hex, theme.secondaryHex, theme.accentHex, LEGO_COLORS.yellow],
      studDrops: isBoss
        ? { silver: 0, gold: 18, blue: 10, purple: 4 }
        : { silver: 2, gold: 4, blue: isTank ? 2 : 1, purple: 0 },
      groundY: safePos.y
    });

    destructible.isCombatNpc = true;
    destructible.isTankNpc = isTank;
    destructible.isBossNpc = isBoss;
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
      speed: isBoss ? 5.2 : isTank ? 4.4 : isMedic ? 5.8 : 5.3,
      destructible,
      visual: {
        root,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        muzzleFlash,
        allyMarker
      }
    };

    destructible.onShattered = () => {
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
  _spawnMotorizedSquad({ faction, isAllied, zoneState, playerPos }) {
    const theme = FACTION_THEME[faction] || FACTION_THEME.cv;
    const routes = isAllied ? zoneState.spec.alliedEntryRoutes : zoneState.spec.defenderMotorRoutes;
    if (!routes || routes.length === 0) return null;

    // Escolhe a rota mais próxima do jogador
    let bestRoute = routes[0];
    let bestDist = Infinity;
    for (const r of routes) {
      const d = Math.hypot(r.targetX - playerPos.x, r.targetZ - playerPos.z);
      if (d < bestDist) {
        bestDist = d;
        bestRoute = r;
      }
    }

    const startSafe = this._findSafeZonePos(bestRoute.startX, bestRoute.startZ, 2.4);
    const blendX = THREE.MathUtils.lerp(bestRoute.targetX, playerPos.x, 0.35);
    const blendZ = THREE.MathUtils.lerp(bestRoute.targetZ, playerPos.z, 0.35);
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
      squadRoles: isAllied
        ? ['rifleman', 'rifleman', 'tank', 'medic']
        : ['rifleman', 'rifleman', 'tank']
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
      { dx: 2.6, dz: 1.8 }
    ];

    convoy.squadRoles.forEach((role, idx) => {
      const off = offsets[idx % offsets.length];
      this._spawnCombatUnit({
        faction: convoy.faction,
        role,
        x: cx + off.dx,
        z: cz + off.dz
      });
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
    this.activeZoneId = zoneKey;
    this.activeMode = 'ALLY_HQ';
    this.isInvasionActive = false;

    const st = this.territories[zoneKey];
    if (!st) return;

    // 2 Guardas Aliados nos Portões + 1 Guarda em cada Outpost + 2 Médicos da Base
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

    // Civis próximos da fronteira correm para fora da zona invadida!
    this.livingCity.triggerPedestrianPanicNear(playerPos, 72);
    soundFX.playHeroSwap();

    // Registra os Outposts inimigos como zonas quentes no Minimapa / Mapa [M]
    this.activeWarzones.length = 0;
    for (const op of st.outposts) {
      if (op.ownerFaction !== this.playerFaction) {
        this.activeWarzones.push({ x: op.x, z: op.z, outpostId: op.id });
        // Esquadrão defensor inicial em cada um dos 3 Outposts (Soldado + Tanque + Médico)
        this._spawnCombatUnit({
          faction: defenderFaction,
          role: 'rifleman',
          x: op.x - 3.2,
          z: op.z - 2.2,
          outpostId: op.id
        });
        this._spawnCombatUnit({
          faction: defenderFaction,
          role: 'tank',
          x: op.x + 3.0,
          z: op.z + 2.2,
          outpostId: op.id
        });
        this._spawnCombatUnit({
          faction: defenderFaction,
          role: 'medic',
          x: op.x - 1.5,
          z: op.z + 3.4,
          outpostId: op.id
        });
      }
    }

    // Despacha IMEDIATAMENTE o Comboio de Invasão da SUA FACÇÃO + Reforço Motorizado Inimigo!
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
      playerPos
    });
  }

  _captureOutpost(zoneState, op, playerPos) {
    if (op.ownerFaction === this.playerFaction) return;
    op.ownerFaction = this.playerFaction;
    op.captureHoldTimer = 0;

    this._syncZone3DColors(zoneState.id);
    soundFX.playTrueHeroFanfare();

    // Remove o alerta vermelho daquele posto no radar
    const wzIdx = this.activeWarzones.findIndex((w) => w.outpostId === op.id);
    if (wzIdx !== -1) this.activeWarzones.splice(wzIdx, 1);

    // Recompensa em Studs no Piso do Outpost + Tropas Aliadas passando a spawnar dele!
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      this.destructibles.spawnAmbientStud(
        op.x + Math.cos(ang) * 2.5,
        op.y + 0.65,
        op.z + Math.sin(ang) * 2.5,
        i % 2 === 0 ? 'blue' : 'gold'
      );
    }

    this._spawnCombatUnit({
      faction: this.playerFaction,
      role: 'rifleman',
      x: op.x - 2.2,
      z: op.z + 2.0,
      outpostId: op.id
    });
    this._spawnCombatUnit({
      faction: this.playerFaction,
      role: 'medic',
      x: op.x + 2.2,
      z: op.z + 2.0,
      outpostId: op.id
    });

    const capturedCount = zoneState.outposts.filter(
      (o) => o.ownerFaction === this.playerFaction
    ).length;

    // CLÍMAX NO 2º PONTO CAPTURADO: Duelo Colossal de Bosses (Boss Defensor vs Boss Aliado!)
    if (capturedCount >= 2 && !zoneState.bossPhaseTriggered) {
      this._triggerBossClimaxDuel(zoneState, playerPos);
    }

    // Verifica se já derrotou o Boss e capturou os 3 Pontos!
    if (capturedCount >= 3 && zoneState.enemyBossDefeated) {
      this._conquerTerritory(zoneState, playerPos);
    }
  }

  _triggerBossClimaxDuel(zoneState, playerPos) {
    zoneState.bossPhaseTriggered = true;
    const defenderFaction = zoneState.ownerFaction;

    const court = zoneState.spec.bossCourtyard;
    const distToCourt = Math.hypot(court.x - playerPos.x, court.z - playerPos.z);
    // Se o jogador estiver perto do pátio usa o pátio; se estiver longe, posiciona na direção do 3º ponto!
    const remainingOp =
      zoneState.outposts.find((o) => o.ownerFaction !== this.playerFaction) || court;
    const bossSpawnX = distToCourt < 150 ? court.x : remainingOp.x;
    const bossSpawnZ = distToCourt < 150 ? court.z : remainingOp.z;

    zoneState.enemyBoss = this._spawnCombatUnit({
      faction: defenderFaction,
      role: 'boss',
      x: bossSpawnX,
      z: bossSpawnZ
    });

    // O seu time envia o BOSS COLOSSAL ALIADO para lutar ao seu lado!
    const allyBossX = THREE.MathUtils.lerp(playerPos.x, bossSpawnX, 0.35);
    const allyBossZ = THREE.MathUtils.lerp(playerPos.z, bossSpawnZ, 0.35);
    zoneState.alliedBoss = this._spawnCombatUnit({
      faction: this.playerFaction,
      role: 'boss',
      x: allyBossX,
      z: allyBossZ
    });

    this.activeWarzones.push({ x: bossSpawnX, z: bossSpawnZ, outpostId: 'boss_duel' });
  }

  _conquerTerritory(zoneState, playerPos) {
    zoneState.ownerFaction = this.playerFaction;
    zoneState.conqueredByPlayer = true;
    for (const op of zoneState.outposts) {
      op.ownerFaction = this.playerFaction;
    }
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

    // Restaura os 4 Corações LEGO, salva a conquista e transforma o território em QG Aliado!
    this.livingCity.playerHp = this.livingCity.playerMaxHp;
    this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
    this._enterAllyHqMode(zoneState.id);
    this.hud?.saveCurrentProgress?.();
  }

  // ============================================================================
  // ATUALIZAÇÃO POR FRAME (60 FPS CRAVADOS)
  // ============================================================================
  update(dt, playerPos, controller = null) {
    if (!playerPos) return;
    this._animClock += dt;

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
      const desiredMode = shouldBeAllyHq ? 'ALLY_HQ' : 'INVASION_1V1';

      if (this.activeZoneId !== strictZone.id || this.activeMode !== desiredMode) {
        if (desiredMode === 'ALLY_HQ') {
          this._enterAllyHqMode(strictZone.id);
        } else {
          this._enterInvasionWarMode(strictZone.id, playerPos);
        }
      }
    } else if (this.activeZoneId && !hysteresisZone) {
      // DESENGAJAMENTO LIMPO AO SAIR DO TERRITÓRIO PARA A CIDADE CIVIL!
      this._cleanupActiveZoneUnits();
      this.activeZoneId = null;
      this.activeMode = 'PEACEFUL_CITY';
      this.isInvasionActive = false;
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
      return;
    }

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

    // Verifica captura de cada um dos 3 Outposts
    for (const op of zoneState.outposts) {
      if (op.ownerFaction === this.playerFaction) continue;

      let defendersNearOp = 0;
      let alliesNearOp = 0;
      for (const npc of this.combatNpcs) {
        if (!npc.destructible || npc.destructible.destroyed) continue;
        const pos = npc.visual.root.position;
        const dOp = Math.hypot(pos.x - op.x, pos.z - op.z);
        if (!npc.isAllied && (npc.outpostId === op.id || dOp < 28)) {
          defendersNearOp++;
        } else if (npc.isAllied && dOp < 28) {
          alliesNearOp++;
        }
      }

      const playerDistOp = Math.hypot(playerPos.x - op.x, playerPos.z - op.z);
      if (defendersNearOp === 0 && (playerDistOp < 38 || alliesNearOp > 0)) {
        op.captureHoldTimer += dt;
        if (op.captureHoldTimer >= 0.45 || playerDistOp < 16) {
          this._captureOutpost(zoneState, op, playerPos);
          if (this.activeMode !== 'INVASION_1V1') return;
        }
      } else {
        op.captureHoldTimer = Math.max(0, op.captureHoldTimer - dt * 0.5);
      }
    }

    const capturedCount = zoneState.outposts.filter(
      (o) => o.ownerFaction === this.playerFaction
    ).length;

    if (capturedCount >= 3 && zoneState.bossPhaseTriggered && zoneState.enemyBossDefeated) {
      this._conquerTerritory(zoneState, playerPos);
      return;
    }

    // Ondas de Reforço Defensivo Inimigo (Dos Outposts não capturados + Carros Inimigos!)
    zoneState.enemyWaveTimer -= dt;
    if (zoneState.enemyWaveTimer <= 0) {
      zoneState.enemyWaveTimer = 11.0;
      const enemyOps = zoneState.outposts.filter((o) => o.ownerFaction !== this.playerFaction);
      if (enemyOps.length > 0 && enemyCount < 11) {
        this._spawnMotorizedSquad({
          faction: zoneState.ownerFaction,
          isAllied: false,
          zoneState,
          playerPos
        });
      }
    }

    // Ondas de Reforço do Comboio Aliado (Do portão ou dos Outposts já capturados!)
    zoneState.alliedWaveTimer -= dt;
    if (zoneState.alliedWaveTimer <= 0) {
      zoneState.alliedWaveTimer = 11.5;
      if (allyCount < 8) {
        const alliedOps = zoneState.outposts.filter((o) => o.ownerFaction === this.playerFaction);
        if (alliedOps.length > 0 && Math.random() < 0.5) {
          const srcOp = alliedOps[Math.floor(Math.random() * alliedOps.length)];
          this._spawnCombatUnit({
            faction: this.playerFaction,
            role: hasAlliedMedic ? 'rifleman' : 'medic',
            x: srcOp.x + 2.2,
            z: srcOp.z - 2.0
          });
          this._spawnCombatUnit({
            faction: this.playerFaction,
            role: 'tank',
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

      // Seleção de alvo 1x1 (Aliados focam Defensores; Defensores focam Aliados ou Jogador!)
      let bestTargetPos = null;
      let bestTargetNpc = null;
      let bestDist = 72;

      for (const other of this.combatNpcs) {
        if (other === npc || other.isAllied === npc.isAllied) continue;
        if (!other.destructible || other.destructible.destroyed) continue;
        const oPos = other.visual.root.position;
        const d = Math.hypot(oPos.x - pos.x, oPos.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          bestTargetNpc = other;
          bestTargetPos = oPos;
        }
      }

      if (!npc.isAllied) {
        const dPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);
        if (dPlayer < bestDist * 0.92 && dPlayer < 65) {
          bestDist = dPlayer;
          bestTargetNpc = null;
          bestTargetPos = playerPos;
        }
      }

      // Movimento tático (Aliados avançam junto com o jogador quando sem alvo próximo)
      let moveTarget = bestTargetPos;
      let stopRange = npc.isBoss ? 14.0 : 16.5;
      if (!moveTarget && npc.isAllied && zoneState) {
        const nextOp = zoneState.outposts.find((o) => o.ownerFaction !== this.playerFaction);
        moveTarget = nextOp ? { x: nextOp.x, z: nextOp.z } : playerPos;
        stopRange = 6.5;
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
      if (npc.isBoss && bestTargetPos && bestDist < 12.5) {
        npc.slamCooldown -= dt;
        if (npc.slamCooldown <= 0) {
          npc.slamCooldown = 5.2;
          this._triggerBossGroundSlam(npc, bestTargetPos === playerPos ? controller : null, playerPos);
        }
      }

      // Disparo com verificação estrita de Linha de Visão (Zero tiro através de paredes!)
      npc.fireCooldown -= dt;
      if (bestTargetPos && bestDist < 54 && npc.fireCooldown <= 0) {
        npc.fireCooldown = npc.isBoss ? 0.55 : npc.role === 'tank' ? 0.95 : 0.82 + Math.random() * 0.35;
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
    const startY = origin.y + (npc.isBoss ? 3.1 : 1.38);
    const targetY = (targetPos.y ?? origin.y) + (targetNpc?.isBoss ? 2.6 : 1.2);

    const dir = new THREE.Vector3(
      targetPos.x - origin.x + (Math.random() - 0.5) * 1.4,
      targetY - startY,
      targetPos.z - origin.z + (Math.random() - 0.5) * 1.4
    ).normalize();

    const bulletMesh = new THREE.Mesh(
      geos.bulletGeo,
      new THREE.MeshBasicMaterial({ color: npc.isAllied ? 0x4ade80 : theme.hex })
    );
    bulletMesh.position.set(origin.x + dir.x * 1.1, startY, origin.z + dir.z * 1.1);
    bulletMesh.lookAt(bulletMesh.position.clone().add(dir));
    this.scene.add(bulletMesh);

    npc.visual.muzzleFlash.visible = true;
    npc.muzzleTimer = 0.08;

    this.npcProjectiles.push({
      mesh: bulletMesh,
      vel: dir.multiplyScalar(npc.isBoss ? 48 : 42),
      isAllied: npc.isAllied,
      damage: npc.isBoss ? 16 : npc.role === 'tank' ? 11 : 8,
      life: 1.45
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
      sw.scale += dt * 18.0;
      sw.mesh.scale.setScalar(sw.scale);
      sw.mat.opacity = Math.max(0, sw.life * 1.6);
      if (sw.life <= 0) {
        if (sw.mesh.parent) sw.mesh.parent.remove(sw.mesh);
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
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
        continue;
      }

      let hit = false;
      for (const npc of this.combatNpcs) {
        if (npc.isAllied === p.isAllied || !npc.destructible || npc.destructible.destroyed) continue;
        const nPos = npc.visual.root.position;
        const hitR = npc.isBoss ? 2.3 : 1.05;
        const hitH = npc.isBoss ? 5.0 : 2.3;
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
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        this.npcProjectiles.splice(i, 1);
      }
    }
  }

  _damagePlayerInInvasion(amount, controller, zoneState = null) {
    if (!this.isInvasionActive) return;
    const dmg = controller?.currentVehicle ? amount * 0.35 : amount;
    this.livingCity.playerHp = Math.max(0, this.livingCity.playerHp - dmg);
    this.hud?.setPlayerHealth(this.livingCity.playerHp, this.livingCity.playerMaxHp, false);

    if (this.livingCity.playerHp <= 0) {
      // Recuo tático estilo LEGO para a entrada do território com os 4 Corações cheios (zero Game Over travado!)
      this.livingCity.playerHp = this.livingCity.playerMaxHp;
      this.hud?.setPlayerHealth(this.livingCity.playerMaxHp, this.livingCity.playerMaxHp, false);
      soundFX.playLegoBreak(false);

      const exitGate = zoneState?.spec?.safeExitGate || { x: 0, z: -92 };
      const ey = this._groundAt(exitGate.x, exitGate.z, 1) + 0.5;
      if (controller) {
        if (controller.currentVehicle) controller.exitVehicle();
        controller.position.set(exitGate.x, ey, exitGate.z);
        controller.velocity?.set(0, 0, 0);
        if (controller.minifigure?.root) {
          controller.minifigure.root.position.copy(controller.position);
        }
      }
      this._cleanupActiveZoneUnits();
      this.activeZoneId = null;
      this.activeMode = 'PEACEFUL_CITY';
      this.isInvasionActive = false;
    }
  }
}

