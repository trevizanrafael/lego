import { buildTerritoryInfrastructureForZone } from '../FactionWarSystem.js';
import { wsP } from '../core/WorldLayoutScale.js';
import {
  getFavelaEastBorderX,
  getFavelaElevation,
  FavelaBatcher,
  buildContinuousSmoothHillMesh
} from './favela-cdd/FavelaElevationAndBatcher.js';
import {
  buildWindingHillsideRoadsAndStaircases,
  buildCVBocasAndHeavyBarricades,
  buildCDDSoccerFieldVarzea,
  buildCVBailePlazaAndGiantParedao,
  buildRedBaronSummitFortress
} from './favela-cdd/FavelaLandmarksBuilder.js';
import { buildGluedFavelaHouseClusters } from './favela-cdd/FavelaHouseClustersBuilder.js';

export { getFavelaEastBorderX, getFavelaElevation };

/**
 * CONSTRUTOR PRINCIPAL (FACHADA FINA): FAVELA / COMPLEXO DA CIDADE DE DEUS (TERRITÓRIO 100% CV)
 * - Colina / Ladeira Suave e Contínua (`PlaneGeometry` subdividido com `getFavelaElevation(x, z)` partindo de Y = 0 nas bordas!)
 * - Zero avenidas retas de quarteirão dentro da Favela (substituídas por Ladeiras Tortas e Escadões serpenteando pela encosta!)
 * - Aglomerados densos de Barracos e Sobrados COLADOS PAREDE COM PAREDE (clusters de 5 a 10 casas encostadas, deixando apenas
 *   becos estreitos de 3.5 a 5 unidades entre um bloco e outro!)
 */
export function buildFavelaCidadeDeDeus(world) {
  const batcher = new FavelaBatcher();
  if (!world.nightLampRegistry) world.nightLampRegistry = [];
  world.favelaEmissiveMats = {
    windows: [
      batcher.materials.get('window_lit'),
      batcher.materials.get('window_orange'),
      batcher.materials.get('window_tv_blue')
    ],
    bulbs: [
      batcher.materials.get('favela_bulb_warm'),
      batcher.materials.get('floodlight_panel')
    ]
  };
  world.favelaSoccerFloodCones = [];
  world.favelaBaileSkytrackers = [];
  world.favelaSummitBeacons = [];

  world.favelaCDDData = {
    faction: 'CV',
    factionName: 'COMANDO VERMELHO',
    isContinuousSmoothHill: true,
    hillLevels: [8, 18, 30, 42, 55],
    housesCount: 0,
    clustersCount: 0,
    brickBaianoCount: 0,
    cementRawCount: 0,
    cvPaintedCount: 0,
    waterTanksCount: 0,
    staircasesCount: 0,
    bocasCount: 0,
    hasSoccerField: false,
    hasBaileParedao: false,
    hasRedBaronFortress: false,
    hasCommunityWaterTower: false
  };

  // 1. MALHA CONTÍNUA DE COLINA / LADEIRA SUAVE (`PlaneGeometry` subdividido com `getFavelaElevation(x, z)`, partindo de Y = 0!)
  buildContinuousSmoothHillMesh(world);

  // 2. RUELAS TORTAS DE CIMENTO, LADEIRAS SERPENTEANTES E ESCADÕES DO MORRO (VERMELHO E BRANCO)
  buildWindingHillsideRoadsAndStaircases(world, batcher);

  // 3. OS 4 PONTOS ICÔNICOS DA CIDADE DE DEUS (Posicionados em `y = getFavelaElevation(x, z)` com alicerce na encosta!):
  const soccerPos = wsP(-605, 195);
  const bailePos = wsP(-715, -135);
  const summitPos = wsP(-865, -240);

  buildCVBocasAndHeavyBarricades(world, batcher);
  buildCDDSoccerFieldVarzea(world, batcher, soccerPos.x, getFavelaElevation(soccerPos.x, soccerPos.z), soccerPos.z);
  buildCVBailePlazaAndGiantParedao(world, batcher, bailePos.x, getFavelaElevation(bailePos.x, bailePos.z), bailePos.z);
  buildRedBaronSummitFortress(world, batcher, summitPos.x, getFavelaElevation(summitPos.x, summitPos.z), summitPos.z);

  // 4. AGLOMERADOS DENSOS DE BARRACOS E SOBRADOS COLADOS PAREDE COM PAREDE (`clusters` de 5 a 10 casas coladas!)
  buildGluedFavelaHouseClusters(world, batcher);

  // 5. Mescla todas as geometrias estáticas em poucos Draw Calls mantendo 60 FPS!
  batcher.flush(world.scene);

  // 6. Infraestrutura Oficial da Fortaleza do CV: Portões com Bandeira, 2 Garagens Exclusivas e 3 Outposts Táticos!
  buildTerritoryInfrastructureForZone(world, 'cv');
}
