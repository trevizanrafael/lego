// ============================================================================
// ZONAS TERRITORIAIS, REGRAS DE INVASÃO E CONFIGURAÇÕES DAS FACÇÕES & POLÍCIA
// ============================================================================

import { IS_SCALED_WORLD, ws, wsP, wsBounds } from '../core/WorldLayoutScale.js';

// Temas extras (não são territórios): polícia aliada no Mega Assalto
export const EXTRA_THEMES = {
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

// Catálogo consolidado das 3 Facções + Forças Táticas Aliadas (BOPE / PF / Segurança)
export const FACTION_CONFIGS = {
  ...FACTION_THEME,
  ...EXTRA_THEMES
};

const DESIGN_TERRITORY_ZONES = {
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

function buildScaledTerritoryZones(base) {
  return {
    cv: {
      ...base.cv,
      bounds: wsBounds(base.cv.bounds),
      mapBadgePos: wsP(-770, 365),
      safeExitGate: wsP(-508, 134),
      gates: [
        { ...base.cv.gates[0], ...wsP(-528, 134) },
        { ...base.cv.gates[1], ...wsP(-528, -117) }
      ],
      garages: [
        { ...base.cv.garages[0], x: ws(-538), z: ws(158) },
        { ...base.cv.garages[1], x: ws(-702) - 2, z: ws(-135) + 24 }
      ],
      outposts: [
        { ...base.cv.outposts[0], ...wsP(-605, -355) },
        { ...base.cv.outposts[1], x: ws(-715) + 8, z: ws(-135) },
        { ...base.cv.outposts[2], x: ws(-865) + 24, z: ws(-240) }
      ],
      bossCourtyard: { x: ws(-865) + 10, z: ws(-240) + 37 },
      alliedBossSpawn: { x: ws(-865) + 24, z: ws(-240) + 18 },
      alliedEntryRoutes: [
        { startX: ws(-514), startZ: ws(134), targetX: ws(-514) - 82, targetZ: ws(134) },
        { startX: ws(-514), startZ: ws(-117), targetX: ws(-514) - 82, targetZ: ws(-117) }
      ],
      defenderMotorRoutes: [
        { startX: ws(-702) + 8, startZ: ws(-135) - 22, targetX: ws(-702) + 8, targetZ: ws(-135) + 16 },
        { startX: ws(-540), startZ: ws(95), targetX: ws(-540), targetZ: ws(134) - 12 }
      ]
    },
    pcc: {
      ...base.pcc,
      bounds: wsBounds(base.pcc.bounds),
      mapBadgePos: wsP(1080, -555),
      safeExitGate: wsP(516, -117),
      gates: [
        { ...base.pcc.gates[0], x: ws(606), z: ws(-117) },
        { ...base.pcc.gates[1], x: ws(606), z: ws(-250) }
      ],
      garages: [
        { ...base.pcc.garages[0], x: ws(684), z: ws(-316) + 113 },
        { ...base.pcc.garages[1], x: ws(866) + 172, z: ws(-316) + 133 }
      ],
      outposts: [
        { ...base.pcc.outposts[0], x: ws(684), z: ws(-250) - 40 },
        { ...base.pcc.outposts[1], x: ws(866) - 168, z: ws(-316) + 68 },
        { ...base.pcc.outposts[2], x: ws(866) + 172, z: ws(-316) + 68 }
      ],
      bossCourtyard: { x: ws(866) - 10, z: ws(-316) + 76 },
      alliedBossSpawn: { x: ws(866), z: ws(-316) + 136 },
      alliedEntryRoutes: [
        { startX: ws(595), startZ: ws(-117), targetX: ws(595) + 95, targetZ: ws(-117) },
        { startX: ws(595), startZ: ws(-250), targetX: ws(595) + 110, targetZ: ws(-250) }
      ],
      defenderMotorRoutes: [
        { startX: ws(768) - 110, startZ: ws(-250), targetX: ws(684), targetZ: ws(-250) },
        { startX: ws(866) + 115, startZ: ws(-250), targetX: ws(866), targetZ: ws(-250) - 35 }
      ]
    },
    ares: {
      ...base.ares,
      bounds: wsBounds(base.ares.bounds),
      mapBadgePos: wsP(1100, 685),
      safeExitGate: wsP(516, 134),
      gates: [
        { ...base.ares.gates[0], x: ws(606), z: ws(134) },
        { ...base.ares.gates[1], x: ws(606), z: ws(402) }
      ],
      garages: [
        { ...base.ares.garages[0], x: ws(825) - 45, z: ws(335) + 50 },
        { ...base.ares.garages[1], x: ws(995) - 165, z: ws(535) - 45 }
      ],
      outposts: [
        { ...base.ares.outposts[0], x: ws(675), z: ws(134) + 43 },
        { ...base.ares.outposts[1], x: ws(825) + 60, z: ws(402) + 14 },
        { ...base.ares.outposts[2], x: ws(995) - 165, z: ws(535) + 45 }
      ],
      bossCourtyard: { x: ws(995), z: ws(622) - 98 },
      alliedBossSpawn: { x: ws(995) - 50, z: ws(622) - 121 },
      alliedEntryRoutes: [
        { startX: ws(595), startZ: ws(134), targetX: ws(595) + 110, targetZ: ws(134) },
        { startX: ws(595), startZ: ws(402), targetX: ws(595) + 110, targetZ: ws(402) }
      ],
      defenderMotorRoutes: [
        { startX: ws(825), startZ: ws(402) - 95, targetX: ws(825), targetZ: ws(402) },
        { startX: ws(995) - 45, startZ: ws(535), targetX: ws(995) - 150, targetZ: ws(535) + 30 }
      ]
    }
  };
}

export const TERRITORY_ZONES = IS_SCALED_WORLD
  ? buildScaledTerritoryZones(DESIGN_TERRITORY_ZONES)
  : DESIGN_TERRITORY_ZONES;

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
