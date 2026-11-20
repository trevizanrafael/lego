/**
 * Fachada pública unificada de Materiais PBR, Shaders de Superfície/Água e Texturas Procedurais LEGO.
 *
 * Arquitetura modularizada (`src/materials/modules/*`):
 * - `PaletteAndPbrCache.js`       — Paleta `LEGO_COLORS`, geometria `SHARED_STUD_GEO`, cache PBR,
 *                                   descarte seguro de assets compartilhados, `getLegoMaterial` e `createLegoBrick`.
 * - `SceneAndWaterShaders.js`     — Uniforms globais `LEGO_SHADER_GLOBALS`, micro-chanfro ABS,
 *                                   Height-Fog urbano (`applyLegoSurfaceFX`) e água animada (`applyAnimatedLegoWaterShader`).
 * - `ProceduralFaceTextures.js`   — Geradores Canvas 2D de rostos de heróis, facções e civis
 *                                   (`createMinifigFaceTexture`, `createNpcFaceTexture`, `getSharedNpcFaceMaterial`),
 *                                   apoiados pelos pintores modulares `HeroCoreFacePainters.js`,
 *                                   `HeroVigilanteFacePainters.js` e `HeroElementalFacePainters.js`.
 * - `ProceduralTorsoTextures.js`  — Gerador Canvas 2D de torsos, uniformes táticos, armaduras e trajes
 *                                   (`createMinifigTorsoTexture`).
 *
 * Mantém 100% dos mesmos exports nomeados, constantes, caches e assinaturas originais sem mudança
 * de comportamento visual ou lógico.
 */

// --- 1. Paleta Noir, Geometria Stud Compartilhada, Cache PBR e Construtores Base ---
export {
  LEGO_COLORS,
  markAsSharedAsset,
  isSharedAsset,
  disposeMaterialSafe,
  disposeTransientObject3D,
  getLegoMaterial,
  SHARED_STUD_GEO,
  createLegoBrick,
  configureCrispCanvasTexture
} from './modules/PaletteAndPbrCache.js';

// --- 2. Shaders Procedurais de Superfície ABS, Height-Fog Urbano e Água Animada ---
export {
  LEGO_SHADER_GLOBALS,
  setLegoShaderQualityFX,
  applyLegoSurfaceFX,
  applyLegoSceneShaderEnhancements,
  applyAnimatedLegoWaterShader
} from './modules/SceneAndWaterShaders.js';

// --- 3. Texturas e Materiais Procedurais Canvas 2D de Rostos (Heróis, Facções e Civis) ---
export {
  createMinifigFaceTexture,
  SHARED_NPC_FACE_TEXTURES,
  createNpcFaceTexture,
  getSharedNpcFaceMaterial
} from './modules/ProceduralFaceTextures.js';

// --- 4. Texturas Procedurais Canvas 2D de Torsos, Uniformes Táticos e Armaduras ---
export {
  createMinifigTorsoTexture
} from './modules/ProceduralTorsoTextures.js';
