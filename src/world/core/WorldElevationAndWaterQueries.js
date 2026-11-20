/**
 * WorldElevationAndWaterQueries.js
 * Consultas contínuas de relevo, viadutos/subsolo empilhados, cotas hídricas,
 * detecção de água profunda e mapeamento de regiões/sub-regiões (`TestBlockWorld.prototype`).
 */

import {
  RIVER_BRIDGE_SPECS,
  RIVER_PIER_SPECS,
  PANGAEA_BRIDGE_SPECS
} from '../RoadGridBuilder.js';
import {
  isPointOnOrganicLand,
  getIsletSampleAt,
  getPangaeaElevationAt
} from '../CoastlineProfile.js';
import { getFavelaElevation } from '../regions/FavelaCDDBuilder.js';
import {
  getUrbanCityReliefY,
  getSouthwestBeachReliefY
} from '../ViaductAndReliefBuilder.js';
import { getMetroCutoutFloorY } from '../MetroSystemBuilder.js';

export const worldElevationAndWaterMethods = {
  _createStaticSubRegions() {
    return {
      porao: {
        ...this.regions[1],
        id: 'porao_torre_herois',
        num: 'LAB',
        name: 'PORÃO DA TORRE — LABORATÓRIO OP-09',
        shortName: 'PORÃO DOS HERÓIS (OP-09)',
        sub: 'Laboratório Bio-Genético Subterrâneo • Criação de Personagem [E]',
        color: '#00f0ff',
        icon: 'tower'
      },
      metro: {
        ...this.regions[0],
        id: 'metro_subterraneo',
        num: 'M1',
        name: 'METRÔ METROPOLITANO (SUBSOLO)',
        shortName: 'METRÔ SUBSOLO',
        sub: 'Linha 01 Circular • Estações Subterrâneas & Túnel Iluminado',
        color: '#06b6d4',
        icon: 'metro'
      },
      customs: {
        ...this.regions[0],
        id: 'lego_customs',
        num: 'CUS',
        name: 'LEGO CUSTOMS — OFICINA DE TUNING',
        shortName: 'LEGO CUSTOMS',
        sub: 'Tuning 0–10 • Pintura • Decals • Monster Truck & Rampa Cunha [E]',
        color: '#facc15',
        icon: 'customs'
      },
      bankInterior: {
        ...this.regions[0],
        id: 'super_banco_interior',
        name: 'SUPER BANCO (INTERIOR)',
        shortName: 'SUPER BANCO (INTERIOR)',
        sub: '4 Andares: Saguão, Escritórios, Segurança e Cofre'
      },
      favela: {
        id: 'favela_cdd_cv',
        number: 8,
        num: 'CDD',
        name: 'COMPLEXO DA CIDADE DE DEUS — DOMÍNIO DO CV',
        shortName: 'CIDADE DE DEUS (CV)',
        sub: 'Morro Contínuo, Vielas, Campinho, Baile do CV & Fortaleza do Barão Vermelho',
        bounds: { minX: -1012, maxX: -530, minZ: -1820, maxZ: 580, minY: 0, maxY: 140 },
        spawn: { x: -702, y: 26.2, z: -135 },
        color: '#dc2626',
        icon: 'cdd'
      }
    };
  },

  /**
   * Retorna a cota Y da superfície da água em (x, z):
   * - Grande Lago do Parque Central: Y = 0.42
   * - Rio / Canal Urbano Leste (X = 539..581, Z = -1325..+1075): Y = -3.50 (com transição suave nas fozes oceânicas)
   * - Canais de Santos e Oceano Atlântico: Y = -0.15
   */
  getWaterSurfaceY(x, z) {
    if (x >= 70 && x <= 340 && z >= 187 && z <= 349) {
      return 0.42;
    }
    if (x >= 539 && x <= 581 && z >= -2950 && z <= 1075) {
      if (z > 1050) {
        const t = Math.min(1, (z - 1050) / 25);
        return -3.5 + t * 3.35;
      }
      if (z < -1305) {
        const t = Math.min(1, (-1305 - z) / 20);
        return -3.5 + t * 3.35;
      }
      return -3.5;
    }
    return -0.15;
  },

  /**
   * Retorna a elevação contínua das Pontes em Arco (bridgeY = 5.0 * sin(t * PI)) e dos Píeres Fluviais de Madeira:
   * - Permite que veículos a 290+ km/h e pedestres subam e desçam as 9 Pontes em Arco suavemente sem bater em colisores!
   */
  getRoadElevation(x, z) {
    if (x >= 526 && x <= 594) {
      for (const b of RIVER_BRIDGE_SPECS) {
        if (Math.abs(z - b.z) <= b.width * 0.5) {
          const t = Math.max(0, Math.min(1, (x - b.xStart) / (b.xEnd - b.xStart)));
          return b.archHeight * Math.sin(t * Math.PI);
        }
      }
      for (const b of PANGAEA_BRIDGE_SPECS) {
        if (Math.abs(z - b.z) <= b.width * 0.5) {
          const t = Math.max(0, Math.min(1, (x - b.xStart) / (b.xEnd - b.xStart)));
          return b.archHeight * Math.sin(t * Math.PI);
        }
      }
    }
    if (x >= 530 && x <= 590) {
      for (const p of RIVER_PIER_SPECS) {
        if (Math.abs(z - p.z) <= p.lengthZ * 0.5) {
          if (x >= p.deckXMin && x <= p.deckXMax) {
            return p.deckY;
          }
          if (x >= p.rampXMin && x <= p.rampXMax) {
            const t = (x - p.rampXMin) / (p.rampXMax - p.rampXMin);
            return p.bank === 'west'
              ? 0.2 * (1 - t) + p.deckY * t
              : p.deckY * (1 - t) + 0.2 * t;
          }
        }
      }
    }
    return 0;
  },

  /**
   * Retorna a elevação contínua do solo base em (x, z):
   * - Recortes de escadarias subterrâneas e trincheiras portais do Metrô (até Y = -6.8m / -7.35m)
   * - 9 Pontes em Arco e 3 Píeres Fluviais do Rio Urbano (`getRoadElevation`)
   * - Platô Panorâmico & Ladeiras do Subúrbio Norte (`0m -> +11.5m`), Colinas do Parque Central (`0m -> +10.5m`),
   *   Dunas & Costão Sudoeste da Praia (`+2.5m -> +8.5m`) e Morro da Cidade de Deus (`0m -> +43m`, com passagem em Z = 0).
   */
  getTerrainHeightAt(x, z) {
    const metroCutY = getMetroCutoutFloorY(x, z);
    if (metroCutY !== null) return metroCutY;

    const roadY = this.getRoadElevation(x, z);
    if (roadY !== 0) return roadY;

    const isletSample = getIsletSampleAt(x, z);
    if (isletSample) return isletSample.height;

    // Orla Sul construída (Calçadão Z=726..778 em Y=0.32m e Faixa de Areia Z=778..1056 em Y=0.12m) — zero flutuação!
    if (x >= -1825 && x <= 538 && z >= 726 && z <= 1056 && !(x < -1530 && z > 1020)) {
      const inSantosCanal =
        (Math.abs(x - -384) < 9.5 || Math.abs(x - -120) < 9.5 || Math.abs(x - 252) < 9.5) &&
        !((z >= 725 && z <= 778) || (z >= 902 && z <= 918));
      if (!inSantosCanal) {
        if (z < 778) {
          return Math.max(0.32, getUrbanCityReliefY(x, z));
        }
        if (!(Math.abs(x) <= 48 && z >= 1020)) {
          const wetSlope = z <= 1036 ? 0.12 : 0.12 - ((z - 1036) / 20.0) * 0.24;
          return Math.max(wetSlope, getSouthwestBeachReliefY(x, z));
        }
      }
    }

    return Math.max(
      getFavelaElevation(x, z),
      getUrbanCityReliefY(x, z),
      getPangaeaElevationAt(x, z)
    );
  },

  /**
   * Suporte físico real a múltiplos níveis empilhados (`elevatedDecks` + `undergroundFloors`) — ZERO bug de teleporte:
   * - Viadutos, Rampas e Estações Elevadas (`deckY` entre `0m` e `+12.75m`): retorna `deckY` SOMENTE se `currentY >= deckY - thresholdBelow`,
   *   permitindo dirigir e caminhar livremente POR BAIXO dos 3 viadutos (`0m`)!
   * - Subsolo do Metrô (`floorY = -6.8m` / `-7.35m`): se o jogador desceu as escadas (`currentY < -0.6`), retorna a plataforma/túnel
   *   subterrâneo, enquanto quem está na rua acima (`currentY >= -0.4`) continua normalmente sobre o asfalto (`0m`)!
   */
  getSurfaceHeightAt(x, z, currentY = 0) {
    // 1. Subsolo do Metrô (quando já desceu abaixo da rua: currentY < -0.6)
    if (currentY < -0.6) {
      const cutY = getMetroCutoutFloorY(x, z);
      if (cutY !== null) return cutY;

      if (this.undergroundFloors && this.undergroundFloors.length > 0) {
        let bestUnderY = -Infinity;
        for (let i = 0; i < this.undergroundFloors.length; i++) {
          const uf = this.undergroundFloors[i];
          if (x >= uf.minX && x <= uf.maxX && z >= uf.minZ && z <= uf.maxZ) {
            const ceilY = uf.ceilingY ?? -1.0;
            if (currentY <= ceilY + 0.5 && uf.floorY > bestUnderY) {
              bestUnderY = uf.floorY;
            }
          }
        }
        if (bestUnderY > -Infinity) {
          return bestUnderY;
        }
      }
    }

    // 2. Tabuleiros e Rampas Elevadas (Viadutos 1, 2, 3 + Plataformas/Escadas Elevadas do Metrô)
    if (this.elevatedDecks && this.elevatedDecks.length > 0) {
      let bestDeckY = -Infinity;
      for (let i = 0; i < this.elevatedDecks.length; i++) {
        const d = this.elevatedDecks[i];
        if (x >= d.minX && x <= d.maxX && z >= d.minZ && z <= d.maxZ) {
          const deckY = d.getDeckY(x, z);
          if (deckY !== null && currentY >= deckY - (d.thresholdBelow ?? 2.4)) {
            if (deckY > bestDeckY) bestDeckY = deckY;
          }
        }
      }
      if (bestDeckY > -Infinity) {
        return bestDeckY;
      }
    }

    // 3. Solo base contínuo (ruas térreas sob viadutos, colinas, platô norte, dunas, pontes e escadarias abertas)
    return this.getTerrainHeightAt(x, z);
  },

  /**
   * Verifica se a coordenada (x, z) é ÁGUA PROFUNDA (Lago do Parque, Rio Urbano, Canais ou Oceano Atlântico):
   * - opts.forBoat = true: permite que barcos/lanchas/jet-skis passem livremente por baixo de TODAS as 9 Pontes em Arco!
   * - opts.forCar / padrão: considera as 9 Pontes em Arco, os 3 Píeres Fluviais e os decks da marina como piso seco!
   */
  isDeepWaterAt(x, z, opts = {}) {
    const forBoat = Boolean(opts.forBoat);

    // 1. GRANDE LAGO DO PARQUE CENTRAL (X: 73..337, Z: 190..346)
    if (x >= 73 && x <= 337 && z >= 190 && z <= 346) {
      if (!forBoat && x <= 107 && z >= 259 && z <= 277) return false;
      if (x >= 196.5 && x <= 213.5) {
        if (!forBoat) return false;
        if (Math.abs(z - 268) >= 20 && Math.abs(z - 268) <= 24) return false;
      }
      return true;
    }

    // 2. OS 3 CANAIS ESTILO SANTOS NA ORLA SUL (X = -384, -120, +252, largura 22m, Z: 726..1055)
    for (const cx of [-384, -120, 252]) {
      if (Math.abs(x - cx) < 9.5 && z >= 726 && z <= 1055) {
        if (!forBoat) {
          if ((z >= 725 && z <= 778) || (z >= 902 && z <= 918)) return false;
        }
        return true;
      }
    }

    // 3. RIO / CANAL URBANO & FIORDE BOREAL LESTE NAVEGÁVEL (X: 540..580, Z: -2950..+1075)
    if (x >= 540 && x <= 580 && z >= -2950 && z <= 1075) {
      if (!forBoat) {
        for (const b of RIVER_BRIDGE_SPECS) {
          if (Math.abs(z - b.z) <= b.width * 0.5) return false;
        }
        for (const b of PANGAEA_BRIDGE_SPECS) {
          if (Math.abs(z - b.z) <= b.width * 0.5) return false;
        }
        for (const p of RIVER_PIER_SPECS) {
          const minPX = Math.min(p.deckXMin, p.rampXMin);
          const maxPX = Math.max(p.deckXMax, p.rampXMax);
          if (Math.abs(z - p.z) <= p.lengthZ * 0.5 && x >= minPX && x <= maxPX) {
            return false;
          }
        }
      }
      return true;
    }

    // 4. TERRA FIRME (Ilha Principal Orgânica, Ilhotas do Arquipélago, Península Leste, Prisão e Píeres/Marinas)
    if (isPointOnOrganicLand(x, z)) return false;
    if (x >= -1825 && x <= 540 && z >= -1320 && z <= 1045) return false;
    if (x >= 580 && x <= 1628 && z >= -1320 && z <= 736) return false;
    // 2 Grandes Navios Porta-Contêineres no Cais Leste + 1 Navio Blindado A.R.E.S. na Doca Sul (Rampas + Convés Dinâmico Pilotável!)
    if (!forBoat && x >= 1618 && x <= 1650 && z >= 120 && z <= 695) return false;
    if (!forBoat && x >= 995 && x <= 1255 && z >= 734 && z <= 752) return false;
    if (!forBoat && this.cargoShips) {
      for (const ship of this.cargoShips) {
        const sx = ship.mesh.position.x;
        const sz = ship.mesh.position.z;
        const yaw = ship.mesh.rotation.y;
        const dx = x - sx;
        const dz = z - sz;
        const cosY = Math.cos(yaw);
        const sinY = Math.sin(yaw);
        const localX = dx * cosY - dz * sinY;
        const localZ = dx * sinY + dz * cosY;
        if (Math.abs(localX) <= ship.halfW && Math.abs(localZ) <= ship.halfL) {
          return false;
        }
      }
    }
    // Ilha-Fortaleza da Prisão de Segurança Máxima (2x Maior: X = 955..1795, Z = 1120..1980) + Píer Naval da Guarda Costeira (X = 860..995)
    if (x >= 955 && x <= 1795 && z >= 1118 && z <= 1980) return false;
    if (!forBoat && x >= 860 && x <= 995 && z >= 1505 && z <= 1595) return false;

    // Grande Ponte Blindada Retilínea (X = 1351..1399, Z = 735..1125) ligando o Porto direto à Ilha da Prisão!
    if (!forBoat && x >= 1351 && x <= 1399 && z >= 735 && z <= 1126) return false;

    if (!forBoat) {
      if (Math.abs(x) <= 48 && z >= 1020 && z <= 1422) return false;
      if (Math.abs(x) <= 69 && z >= 1405 && z <= 1572) return false;
      if (x >= 43 && x <= 108 && z >= 1076 && z <= 1094) return false;
      if (x >= 95 && x <= 109 && z >= 1062 && z <= 1228) return false;
      for (const dz of [1095, 1135, 1175, 1215]) {
        if (x >= 105 && x <= 151 && Math.abs(z - dz) <= 3.5) return false;
      }
      // Marina Oeste na Ponta da Praia / Costão Sudoeste (X = -1388..-1332, Z = 1040..1230)
      if (x >= -1388 && x <= -1372 && z >= 1040 && z <= 1230) return false;
      for (const dz of [1095, 1135, 1175, 1215]) {
        if (x >= -1376 && x <= -1328 && Math.abs(z - dz) <= 3.5) return false;
      }
    }

    return true;
  },

  getRegionAt(x, y, z) {
    const skyRegion = this.regions[9];
    if (
      y >= skyRegion.bounds.minY &&
      x >= skyRegion.bounds.minX &&
      x <= skyRegion.bounds.maxX &&
      z >= skyRegion.bounds.minZ &&
      z <= skyRegion.bounds.maxZ
    ) {
      return skyRegion;
    }

    if (y < -2.2) {
      if (x >= -360 && x <= -280 && z >= -202 && z <= -135) {
        return this._subRegions.porao;
      }
      return this._subRegions.metro;
    }

    if (y < 24.0 && x >= 14 && x <= 106 && z >= -496 && z <= -400) {
      return this._subRegions.customs;
    }

    if (y < 41.0 && x >= -74 && x <= 74 && z >= -229 && z <= -130) {
      return this._subRegions.bankInterior;
    }

    // Detecção do Complexo da Cidade de Deus (Morro contínuo do CV estendido até a encosta Boreal Z = -1820!)
    if (
      x >= -1012 &&
      x <= -528 &&
      z >= -1820 &&
      z <= 580 &&
      (x <= -658 || (z >= -508 && z <= 415))
    ) {
      return this._subRegions.favela;
    }

    if (z < -1320 && x >= -1650 && x <= 540 && y < 120) {
      return this.regions[3];
    }

    const priorityOrder = [1, 2, 8, 3, 4, 5, 6, 7, 0];
    for (const idx of priorityOrder) {
      const reg = this.regions[idx];
      const b = reg.bounds;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        return reg;
      }
    }

    return this.regions[0];
  }
};
