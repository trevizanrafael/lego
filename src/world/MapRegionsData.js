/**
 * Catálogo Oficial das 10 Regiões do Mapa em Escala Metropolitana Ampliada (4200 x 3000 unidades)
 */
export const MAP_REGIONS = [
  {
    id: 'centro_financeiro',
    number: 1,
    num: '01',
    name: 'CENTRO FINANCEIRO & SUPER BANCO',
    shortName: 'CENTRO FINANCEIRO',
    sub: 'Coração Metropolitano • Arranha-Céus, Times Square & Super Banco',
    bounds: { minX: -520, maxX: 520, minZ: -440, maxZ: 140, minY: 0, maxY: 250 },
    spawn: { x: 0, y: 0.5, z: -92 },
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
    bounds: { minX: -375, maxX: -260, minZ: -235, maxZ: -125, minY: 0, maxY: 360 },
    spawn: { x: -324, y: 310.85, z: -168 },
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
    bounds: { minX: -520, maxX: 520, minZ: 140, maxZ: 420, minY: 0, maxY: 90 },
    spawn: { x: 0, y: 0.6, z: 242 },
    color: '#4ade80',
    icon: 'park'
  },
  {
    id: 'suburbio_norte',
    number: 4,
    num: '04',
    name: 'BAIRRO RESIDENCIAL — ZONA NORTE',
    shortName: 'SUBÚRBIO (NORTE)',
    sub: 'Quarteirões de Casas, Mansões Costeiras, Praça, Pizzaria & Posto de Gasolina',
    bounds: { minX: -640, maxX: 550, minZ: -1320, maxZ: -440, minY: 0, maxY: 90 },
    spawn: { x: 120, y: 0.5, z: -646 },
    color: '#fb923c',
    icon: 'suburb'
  },
  {
    id: 'praia_sul',
    number: 5,
    num: '05',
    name: 'ORLA MARÍTIMA, PRAIA & RODA-GIGANTE',
    shortName: 'PRAIA & ORLA (SUL)',
    sub: 'Skyline Balneário Camboriú (232m-296m!), Calçadão, Areia Dourada, Píer 540m, Farol & Marina',
    bounds: { minX: -1825, maxX: 640, minZ: 420, maxZ: 1620, minY: 0, maxY: 325 },
    spawn: { x: 0, y: 1.5, z: 1080 },
    color: '#fde047',
    icon: 'beach'
  },
  {
    id: 'industrial_leste',
    number: 6,
    num: '06',
    name: 'DISTRITO INDUSTRIAL — IMPÉRIO BLINDADO DO PCC',
    shortName: 'DISTRITO INDUSTRIAL (PCC)',
    sub: 'Cidadela 112m, Torres de Lavagem, Silos Gigantes, Chaminés 85m & Frotas 100% PCC',
    bounds: { minX: 520, maxX: 1628, minZ: -1320, maxZ: 120, minY: 0, maxY: 140 },
    spawn: { x: 820, y: 0.5, z: -340 },
    color: '#3b82f6',
    icon: 'pcc'
  },
  {
    id: 'porto_leste',
    number: 7,
    num: '07',
    name: 'PORTO DE CARGAS & CAIS MARÍTIMO',
    shortName: 'PORTO (LESTE)',
    sub: 'Cais Pesado, Labirinto de Contêineres 4 Andares, 3 Guindastes Portainer, Docas 01/02 & Navio Cargueiro',
    bounds: { minX: 520, maxX: 1720, minZ: 110, maxZ: 880, minY: 0, maxY: 95 },
    spawn: { x: 825, y: 0.5, z: 380 },
    color: '#f59e0b',
    icon: 'port'
  },
  {
    id: 'aeroporto_oeste',
    number: 8,
    num: '08',
    name: 'AEROPORTO INTERNACIONAL & BASE MILITAR',
    shortName: 'AEROPORTO (OESTE)',
    sub: 'Mega Terminal Entrável, Ala Militar Norte, 20 Hangares, 3 Torres ATC & Pista 09/27',
    bounds: { minX: -1880, maxX: -1010, minZ: -1320, maxZ: 660, minY: 0, maxY: 165 },
    spawn: { x: -1060, y: 0.5, z: 0 },
    color: '#94a3b8',
    icon: 'airport'
  },
  {
    id: 'ilha_prisao',
    number: 9,
    num: '09',
    name: 'ILHA DA PRISÃO DE SEGURANÇA MÁXIMA',
    shortName: 'ILHA DA PRISÃO',
    sub: 'Cidadela Panóptica 126m ("A Balsa"), 6 Pavilhões (58-82m), Doca Naval & 4 Setores',
    bounds: { minX: 840, maxX: 1820, minZ: 880, maxZ: 2005, minY: 0, maxY: 150 },
    spawn: { x: 1375, y: 0.5, z: 1175 },
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
    bounds: { minX: -140, maxX: 140, minZ: -210, maxZ: 110, minY: 365, maxY: 495 },
    spawn: { x: 0, y: 411.5, z: -50 },
    color: '#60a5fa',
    icon: 'sky'
  }
];

/**
 * Marcos Principais (Landmarks) para Radar Local e Mapa Tático Completo [M] (Ícones Vetoriais Puros)
 */
export const MAP_LANDMARKS = [
  { id: 'lm_banco', code: 'BNC', icon: 'bank', label: 'SUPER BANCO', x: 0, y: 0.5, z: -175, labelPos: 'top', color: '#facc15', spawn: { x: 0, y: 0.5, z: -115 } },
  { id: 'lm_torre', code: 'TRR', icon: 'tower', label: 'TORRE HERÓIS', x: -318, y: 310.8, z: -180, labelPos: 'bottom', color: '#38bdf8', spawn: { x: -324, y: 310.85, z: -168 } },
  { id: 'lm_parque', code: 'PRQ', icon: 'park', label: 'PARQUE CENTRAL', x: 0, y: 2.2, z: 268, labelPos: 'bottom', color: '#4ade80', spawn: { x: 0, y: 0.6, z: 242 } },
  { id: 'lm_posto', code: 'PST', icon: 'suburb', label: 'SUBÚRBIO / POSTO', x: 204, y: 0.5, z: -740, labelPos: 'top', color: '#fb923c', spawn: { x: 120, y: 0.5, z: -646 } },
  { id: 'lm_praia', code: 'PRA', icon: 'beach', label: 'PÍER & RODA-GIGANTE', x: 0, y: 1.5, z: 1140, labelPos: 'bottom', color: '#fde047', spawn: { x: 0, y: 1.5, z: 1080 } },
  { id: 'lm_cdd', code: 'CDD', icon: 'cdd', label: 'CIDADE DE DEUS (CV)', x: -715, y: 26.2, z: -135, labelPos: 'left', color: '#dc2626', spawn: { x: -702, y: 26.2, z: -135 } },
  { id: 'lm_ind', code: 'PCC', icon: 'pcc', label: 'BUNKER INDUSTRIAL (PCC)', x: 820, y: 0.5, z: -340, labelPos: 'right', color: '#3b82f6', spawn: { x: 820, y: 0.5, z: -340 } },
  { id: 'lm_porto', code: 'PRT', icon: 'port', label: 'PORTO LESTE', x: 1020, y: 0.5, z: 380, labelPos: 'right', color: '#f59e0b', spawn: { x: 825, y: 0.5, z: 380 } },
  { id: 'lm_aero', code: 'AER', icon: 'airport', label: 'AEROPORTO OESTE', x: -1340, y: 0.5, z: 0, labelPos: 'left', color: '#94a3b8', spawn: { x: -1060, y: 0.5, z: 0 } },
  { id: 'lm_prisao', code: 'PRI', icon: 'prison', label: 'ILHA DA PRISÃO', x: 1375, y: 0.8, z: 1540, labelPos: 'bottom', color: '#f87171', spawn: { x: 1375, y: 0.5, z: 1175 } },
  { id: 'lm_sky', code: 'SKY', icon: 'sky', label: 'AEROPORTA-AVIÕES', x: 0, y: 411.5, z: -50, displayX: 295, displayZ: -255, altitudeLabel: 'ALTITUDE: 410m', labelPos: 'right', color: '#60a5fa', spawn: { x: 0, y: 411.5, z: -50 } }
];

