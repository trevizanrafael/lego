/**
 * ============================================================================
 * BuildingGenerator.js — Fachada Modular de Geração de Edifícios & Batching 3D
 * ============================================================================
 *
 * Ponto de entrada unificado que preserva 100% da API pública histórica de
 * `BuildingGenerator.js`, delegando toda a lógica de geometria, cache PBR de
 * fachadas e montagem arquitetônica para submódulos pequenos e especializados
 * dentro de `src/world/buildings/`:
 *
 *  1. `buildings/VertexColorBufferMerge.js`:
 *     - Descritores zero-allocation de tijolos (`makeFastBox`), caixas pré-
 *       transladadas (`makeTranslatedBox`), fusão linear de `BufferGeometry`
 *       (`mergeBufferGeometries`), consolidação de peças opacas via Vertex
 *       Colors (`mergeColoredGeometries`) e materiais PBR compartilhados
 *       (`getSharedVertexColorMaterial`, `markAsSharedAsset`).
 *
 *  2. `buildings/GeometryMergeUtils.js`:
 *     - Cálculo de chave de chunk espacial (`getGeometryChunkKey`), detecção de
 *       materiais elegíveis a consolidação (`isOpaqueVertexColorableMaterial`),
 *       flush de buckets estáticos regionais (`flushSpatialChunkedBuckets`) e
 *       fusão de malhas estáticas de veículos/aeronaves preservando pivôs
 *       animados (`optimizeStaticGroupMeshes`).
 *
 *  3. `buildings/BuildingStylesAndFacades.js`:
 *     - Catálogo dos 8 estilos arquitetônicos Gotham Noir (`BUILDING_STYLES`,
 *       `BUILDING_STYLE_KEYS`) e geração procedural cacheada de texturas/materiais
 *       de fachada com mipmaps, fuligem urbana e `emissiveMap` noturno
 *       (`getFacadeMaterial`, `getCachedFacadeMaterials`).
 *
 *  4. `buildings/DetailedBuildingBuilder.js`:
 *     - Construtor de edifícios 3D studless com recuos Art-Deco/Brutalistas,
 *       pilares de quina chanfrados em 45°, aletas verticais, cornijas, caixa
 *       d'água cônica no terraço, pináculos gótico-industriais, térreo com
 *       marquises e registro automático de colisores/minimapa
 *       (`buildDetailedBuilding`).
 *
 * Regra de Arquitetura:
 *  - Nenhum consumidor externo precisa mudar seus imports (`./BuildingGenerator.js`).
 *  - Submódulos internos importam diretamente entre si em DAG estrito (zero ciclos).
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. Utilitários de Fusão de Geometria, Chunks Espaciais & Otimização de Grupos
// ----------------------------------------------------------------------------
export {
  markAsSharedAsset,
  getSharedVertexColorMaterial,
  makeFastBox,
  makeTranslatedBox,
  mergeBufferGeometries,
  mergeColoredGeometries,
  getGeometryChunkKey,
  isOpaqueVertexColorableMaterial,
  flushSpatialChunkedBuckets,
  optimizeStaticGroupMeshes
} from './buildings/GeometryMergeUtils.js';

// ----------------------------------------------------------------------------
// 2. Estilos Arquitetônicos Gotham Noir & Cache de Fachadas Procedurais PBR
// ----------------------------------------------------------------------------
export {
  BUILDING_STYLES,
  BUILDING_STYLE_KEYS,
  getCachedFacadeMaterials,
  getFacadeMaterial
} from './buildings/BuildingStylesAndFacades.js';

// ----------------------------------------------------------------------------
// 3. Construtor de Edifícios Detalhados Art-Deco / Brutalistas, Flatirons & LOD
// ----------------------------------------------------------------------------
export {
  buildDetailedBuilding
} from './buildings/DetailedBuildingBuilder.js';

export {
  buildFlatironWedgeBuilding
} from './buildings/FlatironWedgeBuilder.js';

export {
  ChunkedBuildingLodBatcher,
  BUILDING_LOD_CHUNK_SIZE,
  BUILDING_LOD1_DISTANCE,
  BUILDING_LOD2_DISTANCE
} from './buildings/ChunkedBuildingLodBatcher.js';
