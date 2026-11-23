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
 * - Colina contínua subdividida em 5 chunks Z frustum-culled com piso urbano de concreto/terra batida
 *   e encosta externa de capim/granito úmido (zero chão marrom-avermelhado chapado!).
 * - Atlas procedural 2x2 de Tijolo Baiano 8 furos, Reboco Parcial, Chapisco Cinza e Pintura Descascando.
 * - Ladeiras dirigíveis (`<= 18%`), Becos em Curva de Nível e Escadões com corrimão, postes tortos e "gatos".
 * - ~2.000+ barracos, sobrados, biroscas, igrejinhas e ponto de mototáxi orientados ao longo das curvas (`< 40` draw calls!).
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
    biroscasCount: 0,
    chapelsCount: 0,
    hasMototaxiPoint: false,
    hasSoccerField: false,
    hasBaileParedao: false,
    hasRedBaronFortress: false,
    hasCommunityWaterTower: false
  };

  // 1. Relevo Contínuo em 5 Chunks Z (Frustum Culling Limpo + Concreto/Terra de Beco/Capim de Encosta)
  buildContinuousSmoothHillMesh(world);

  // 2. Vias de Encosta Legadas (apenas fallback `1x`; em `3x`, `FavelaContoursAndAlleys` cria a malha orgânica)
  buildWindingHillsideRoadsAndStaircases(world, batcher);

  // 3. Marcos Comunitários e Táticos da Cidade de Deus (Bocas, Campinho, Baile/Paredão e Fortaleza + Caixa d'Água)
  const soccerPos = wsP(-605, 195);
  const bailePos = wsP(-715, -135);
  const summitPos = wsP(-865, -240);

  buildCVBocasAndHeavyBarricades(world, batcher);
  buildCDDSoccerFieldVarzea(world, batcher, soccerPos.x, getFavelaElevation(soccerPos.x, soccerPos.z), soccerPos.z);
  buildCVBailePlazaAndGiantParedao(world, batcher, bailePos.x, getFavelaElevation(bailePos.x, bailePos.z), bailePos.z);
  buildRedBaronSummitFortress(world, batcher, summitPos.x, getFavelaElevation(summitPos.x, summitPos.z), summitPos.z);

  // 4. Tecido Orgânico de Barracos, Sobrados, Puxadinhos, Quintais Murados e Pontos Comunitários
  buildGluedFavelaHouseClusters(world, batcher);

  // 5. Fusão Espacial Unificada (< 25 meshes / draw calls para toda a Favela CDD!)
  batcher.flush(world.scene);

  // 6. Infraestrutura Oficial da Guerra Territorial do CV (Portões, 2 Garagens e 3 Outposts P1..P3)
  buildTerritoryInfrastructureForZone(world, 'cv');
}
