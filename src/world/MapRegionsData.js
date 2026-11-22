import { PANGAEA_OUTPOST_LANDMARKS } from './CoastlineProfile.js';
import { ws, wsBounds, wsPos3 } from './core/WorldLayoutScale.js';

/**
 * Catálogo Oficial das 10 Regiões do Mapa em Escala Supercontinental Pangeia
 */
export const MAP_REGIONS = [
  {
    id: 'centro_financeiro',
    number: 1,
    num: '01',
    name: 'CENTRO FINANCEIRO & SUPER BANCO',
    shortName: 'CENTRO FINANCEIRO',
    sub: 'Coração Metropolitano • Arranha-Céus, Times Square & Super Banco',
    bounds: wsBounds({ minX: -520, maxX: 520, minZ: -440, maxZ: 140, minY: 0, maxY: 250 }),
    spawn: wsPos3({ x: 0, y: 0.5, z: -92 }),
    color: '#facc15',
    icon: 'bank'
  },
  {
    id: 'torre_herois',
    number: 2,
    num: '02',
    name: 'COMPLEXO DA TORRE DOS HERÓIS',
    shortName: 'TORRE DOS HERÓIS',
    sub: 'Arranha-Céu Mais Alto da Ilha (310m!) • QG Entrável, Hangar Aéreo & Heliponto',
    bounds: wsBounds({ minX: -375, maxX: -260, minZ: -235, maxZ: -125, minY: 0, maxY: 360 }),
    spawn: wsPos3({ x: -324, y: 310.85, z: -168 }),
    color: '#38bdf8',
    icon: 'tower'
  },
  {
    id: 'parque_central',
    number: 3,
    num: '03',
    name: 'PARQUE CENTRAL & LAGO',
    shortName: 'PARQUE CENTRAL',
    sub: 'Pulmão Verde da Metrópole • Grande Lago, Pontes de Pedra & Quiosques',
    bounds: wsBounds({ minX: -520, maxX: 520, minZ: 140, maxZ: 420, minY: 0, maxY: 90 }),
    spawn: wsPos3({ x: 0, y: 0.6, z: 242 }),
    color: '#4ade80',
    icon: 'park'
  },
  {
    id: 'suburbio_norte',
    number: 4,
    num: '04',
    name: 'BAIRRO RESIDENCIAL — ZONA NORTE',
    shortName: 'SUBÚRBIO (NORTE)',
    sub: 'Quarteirões Residenciais, Planalto Boreal Norte, Pinhal & Rodovia Panorâmica',
    bounds: wsBounds({ minX: -1010, maxX: 540, minZ: -2920, maxZ: -440, minY: 0, maxY: 110 }),
    spawn: wsPos3({ x: 120, y: 2.2, z: -646 }),
    color: '#fb923c',
    icon: 'suburb'
  },
  {
    id: 'praia_sul',
    number: 5,
    num: '05',
    name: 'ORLA MARÍTIMA, PRAIA & PENÍNSULA DAS DUNAS',
    shortName: 'PRAIA & DUNAS (SUL)',
    sub: 'Skyline Beira-Mar (232m-296m!), Píer 540m, Farol, Marina & Vila Sudoeste',
    bounds: wsBounds({ minX: -3450, maxX: 640, minZ: 420, maxZ: 2580, minY: 0, maxY: 325 }),
    spawn: wsPos3({ x: 0, y: 1.5, z: 1080 }),
    color: '#fde047',
    icon: 'beach'
  },
  {
    id: 'industrial_leste',
    number: 6,
    num: '06',
    name: 'DISTRITO INDUSTRIAL, PARQUE EÓLICO & REFINARIA',
    shortName: 'INDUSTRIAL & EÓLICO (PCC)',
    sub: 'Cidadela PCC, Refinaria Tétis & 8 Aerogeradores Gigantes do Chifre Nordeste',
    bounds: wsBounds({ minX: 520, maxX: 3450, minZ: -2750, maxZ: 120, minY: 0, maxY: 160 }),
    spawn: wsPos3({ x: 820, y: 7.2, z: -340 }),
    color: '#3b82f6',
    icon: 'pcc'
  },
  {
    id: 'porto_leste',
    number: 7,
    num: '07',
    name: 'PORTO DE CARGAS & GOLFO DE TÉTIS',
    shortName: 'PORTO (LESTE)',
    sub: 'Cais Pesado, Labirinto de Contêineres, Portainers & Saída pro Golfo de Tétis',
    bounds: wsBounds({ minX: 520, maxX: 1950, minZ: 110, maxZ: 960, minY: 0, maxY: 95 }),
    spawn: wsPos3({ x: 825, y: 0.5, z: 380 }),
    color: '#f59e0b',
    icon: 'port'
  },
  {
    id: 'aeroporto_oeste',
    number: 8,
    num: '08',
    name: 'AEROPORTO, BASE MILITAR & CABO RADAR',
    shortName: 'AEROPORTO & CABO OESTE',
    sub: 'Mega Terminal, Ala Militar Norte, Hangares, Pista 09/27 & Cabo Radar Noroeste',
    bounds: wsBounds({ minX: -3450, maxX: -1010, minZ: -2920, maxZ: 660, minY: 0, maxY: 165 }),
    spawn: wsPos3({ x: -1060, y: 0.5, z: 0 }),
    color: '#94a3b8',
    icon: 'airport'
  },
  {
    id: 'ilha_prisao',
    number: 9,
    num: '09',
    name: 'ILHA DA PRISÃO DE SEGURANÇA MÁXIMA',
    shortName: 'ILHA DA PRISÃO',
    sub: 'Cidadela Panóptica 126m ("A Balsa"), 6 Pavilhões, Orla Arenosa & Doca Naval',
    bounds: wsBounds({ minX: 780, maxX: 2350, minZ: 880, maxZ: 2350, minY: 0, maxY: 150 }),
    spawn: wsPos3({ x: 1375, y: 0.5, z: 1175 }),
    color: '#f87171',
    icon: 'prison'
  },
  {
    id: 'aeroporta_avioes',
    number: 10,
    num: '10',
    name: 'AEROPORTA-AVIÕES NO CÉU (ALTITUDE Y=410m)',
    shortName: 'AEROPORTA-AVIÕES',
    sub: 'Fortaleza Aérea de Casco Pesado Sustentada por 4 Turbinas Rotoras',
    bounds: { minX: ws(0) - 140, maxX: ws(0) + 140, minZ: ws(-50) - 160, maxZ: ws(-50) + 160, minY: 365, maxY: 495 },
    spawn: wsPos3({ x: 0, y: 411.5, z: -50 }),
    color: '#60a5fa',
    icon: 'sky'
  }
];

/**
 * Marcos Principais (Landmarks) para Radar Local e Mapa Tático Completo [M] (Ícones Vetoriais Puros)
 */
export const MAP_LANDMARKS = [
  { id: 'lm_banco', code: 'BNC', icon: 'bank', label: 'SUPER BANCO', x: ws(0), y: 0.5, z: ws(-175), labelPos: 'top', color: '#facc15', spawn: { x: ws(0), y: 0.5, z: ws(-175) + 60 } },
  { id: 'lm_torre', code: 'TRR', icon: 'tower', label: 'TORRE HERÓIS', x: ws(-324) + 6, y: 310.8, z: ws(-168) - 12, labelPos: 'bottom', color: '#38bdf8', spawn: wsPos3({ x: -324, y: 310.85, z: -168 }) },
  { id: 'lm_parque', code: 'PRQ', icon: 'park', label: 'PARQUE CENTRAL', x: ws(0), y: 2.2, z: ws(268), labelPos: 'bottom', color: '#4ade80', spawn: wsPos3({ x: 0, y: 0.6, z: 242 }) },
  { id: 'lm_posto', code: 'PST', icon: 'suburb', label: 'SUBÚRBIO / POSTO', x: ws(204), y: 3.5, z: ws(-740), labelPos: 'top', color: '#fb923c', spawn: wsPos3({ x: 120, y: 2.2, z: -646 }) },
  { id: 'lm_praia', code: 'PRA', icon: 'beach', label: 'PÍER & RODA-GIGANTE', x: ws(0), y: 1.5, z: ws(1140), labelPos: 'bottom', color: '#fde047', spawn: wsPos3({ x: 0, y: 1.5, z: 1080 }) },
  { id: 'lm_cdd', code: 'CDD', icon: 'cdd', label: 'CIDADE DE DEUS (CV)', x: ws(-715), y: 26.2, z: ws(-135), labelPos: 'left', color: '#dc2626', spawn: wsPos3({ x: -702, y: 26.2, z: -135 }) },
  { id: 'lm_ind', code: 'PCC', icon: 'pcc', label: 'BUNKER INDUSTRIAL (PCC)', x: ws(820), y: 6.8, z: ws(-340), labelPos: 'right', color: '#3b82f6', spawn: wsPos3({ x: 820, y: 7.2, z: -340 }) },
  { id: 'lm_porto', code: 'PRT', icon: 'port', label: 'PORTO LESTE', x: ws(1020), y: 0.5, z: ws(380), labelPos: 'right', color: '#f59e0b', spawn: wsPos3({ x: 825, y: 0.5, z: 380 }) },
  { id: 'lm_aero', code: 'AER', icon: 'airport', label: 'AEROPORTO OESTE', x: ws(-1340), y: 0.5, z: ws(0), labelPos: 'left', color: '#94a3b8', spawn: wsPos3({ x: -1060, y: 0.5, z: 0 }) },
  { id: 'lm_prisao', code: 'PRI', icon: 'prison', label: 'ILHA DA PRISÃO', x: ws(1375), y: 0.8, z: ws(1540), labelPos: 'bottom', color: '#f87171', spawn: wsPos3({ x: 1375, y: 0.5, z: 1175 }) },
  { id: 'lm_sky', code: 'SKY', icon: 'sky', label: 'AEROPORTA-AVIÕES', x: ws(0), y: 411.5, z: ws(-50), displayX: ws(295), displayZ: ws(-255), altitudeLabel: 'ALTITUDE: 410m', labelPos: 'right', color: '#60a5fa', spawn: wsPos3({ x: 0, y: 411.5, z: -50 }) },
  { id: 'lm_hangar', code: 'HGR', icon: 'sky', label: 'HANGAR AERONAVES (CUSTOM)', x: ws(0) + 20, y: 411.5, z: ws(-50) + 104, displayX: ws(295), displayZ: ws(-175), altitudeLabel: 'HANGAR 410m', labelPos: 'right', color: '#00f0ff', spawn: { x: ws(0) + 10, y: 411.5, z: ws(-50) + 96 } },
  // Oficina de Rua LEGO Customs (Cidade Neutra: X = 60, Z = -448)
  { id: 'lm_customs', code: 'CUS', icon: 'customs', label: 'LEGO CUSTOMS (OFICINA)', x: ws(60), y: 0.5, z: ws(-448), labelPos: 'right', color: '#facc15', spawn: wsPos3({ x: 24, y: 0.5, z: -416 }) },
  // 5 Estações da Linha 01 Circular do Metrô LEGO (2 Subterrâneas em Y = -10.5m + 3 Elevadas em Y = +14.85m)
  { id: 'lm_metro_01', code: 'M01', icon: 'metro', label: 'METRÔ CENTRAL (SUBSOLO)', x: ws(0), y: -10.5, z: ws(-104), labelPos: 'bottom', color: '#06b6d4', spawn: wsPos3({ x: 0, y: -10.4, z: -101.5 }) },
  { id: 'lm_metro_02', code: 'M02', icon: 'metro', label: 'METRÔ TIMES SQ. (SUBSOLO)', x: ws(-77), y: -10.5, z: ws(20), labelPos: 'left', color: '#06b6d4', spawn: wsPos3({ x: -77.5, y: -10.4, z: 32 }) },
  { id: 'lm_metro_03', code: 'M03', icon: 'metro', label: 'METRÔ TORRE (+14.9m)', x: ws(-380), y: 14.85, z: ws(-60), labelPos: 'left', color: '#22d3ee', spawn: wsPos3({ x: -379.6, y: 14.95, z: -60 }) },
  { id: 'lm_metro_04', code: 'M04', icon: 'metro', label: 'METRÔ PRAIA SUL (+14.9m)', x: ws(-117), y: 14.85, z: ws(650), labelPos: 'left', color: '#22d3ee', spawn: wsPos3({ x: -116.6, y: 14.95, z: 650 }) },
  { id: 'lm_metro_05', code: 'M05', icon: 'metro', label: 'METRÔ RIO LESTE (+14.9m)', x: ws(509), y: 14.85, z: ws(-180), labelPos: 'right', color: '#22d3ee', spawn: wsPos3({ x: 509.1, y: 14.95, z: -180 }) },
  ...PANGAEA_OUTPOST_LANDMARKS
];
