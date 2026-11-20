/**
 * REGIÃO 1 — CENTRO DA METRÓPOLE (`DowntownBuilder.js`)
 * =============================================================================
 * Fachada fina de orquestração do Coração Financeiro, QG dos Heróis, Parque
 * Central e Quarteirões de Arranha-Céus / Times Square.
 *
 * Arquitetura Modular (`src/world/regions/downtown/`):
 *   - `HeroTowerComplexBuilder.js`
 *       Complexo Monumental da Torre dos Heróis (310m no heliponto / 352m na
 *       antena), saguão térreo 100% entrável (pé-direito 32m, Hall of Armor,
 *       Megatelão Global, Bacta Pods, Elevador Quântico [E]) e Porão Bio-Genético
 *       Subterrâneo OP-09 (Y = -8.2m).
 *   - `DowntownBlocksAndSkyscrapers.js`
 *       Malha de quarteirões urbanos do Centro com 5 arquétipos de quadra
 *       (quadra densa, Empire State / podium, 4 torres em cruz, corporativo em
 *       "U" com praça e Times Square com painéis neon), além da faixa norte de
 *       transição (Z = -448) e Oficina LEGO Customs.
 *   - `../SuperBankBuilder.js` (`SuperBankExteriorAndLobby.js` + `SuperBankUpperFloorsAndVault.js`)
 *       Super Banco Central aberto de 4 andares com rampas, elevador e cofre.
 *   - `../CentralParkBuilder.js` (`CentralParkGatesAndPlaza.js` + `CentralParkLakeAndNature.js`)
 *       Parque Central & Grande Lago navegável ao sul do Centro Financeiro.
 */

import { buildHeroTowerComplex as _buildHeroTowerComplex } from './downtown/HeroTowerComplexBuilder.js';
import { buildCentralParkAndLake } from './CentralParkBuilder.js';
import {
  buildDowntownSkyscrapersAndTransitionBlocks as _buildDowntownSkyscrapersAndTransitionBlocks,
  buildUrbanDowntownBlock as _buildUrbanDowntownBlock
} from './downtown/DowntownBlocksAndSkyscrapers.js';

/**
 * 1. Complexo Monumental da Torre dos Heróis (X = -318, Z = -180, H = 310m / 352m).
 *    Interior 100% entrável sem tela de loading + Porão Subterrâneo OP-09.
 */
export function buildHeroTowerComplex(world) {
  return _buildHeroTowerComplex(world);
}

/**
 * 2. Parque Central & Grande Lago (X: -490..+490, Z: +152..+384).
 *    Re-exportado para compatibilidade integral com consumidores de `DowntownBuilder.js`.
 */
export { buildCentralParkAndLake };

/**
 * 3. Malha de arranha-céus do Centro, Times Square e faixa norte de transição
 *    (incluindo a Oficina LEGO Customs em X = 60, Z = -448).
 */
export function buildDowntownSkyscrapersAndTransitionBlocks(world) {
  return _buildDowntownSkyscrapersAndTransitionBlocks(world);
}

/**
 * 4. Construtor unitário de quarteirão urbano do Centro (5 arquétipos de layout).
 */
export function buildUrbanDowntownBlock(world, bx, bz, W, D, layoutType, mainHeight, seed) {
  return _buildUrbanDowntownBlock(world, bx, bz, W, D, layoutType, mainHeight, seed);
}
