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
import { IS_SCALED_WORLD, ws, wsBounds, wsPos3, fromWs } from './WorldLayoutScale.js';
import { getScaledUrbanCurbLiftAt } from '../terrain/UrbanSidewalkAndBlockBuilder.js';

export const worldElevationAndWaterMethods = {
  _createStaticSubRegions() {
    return {
      porao: {
        ...this.regions[1],
        id: 'porao_torre_herois',
        num: 'LAB',
        name: 'PORÃO DA TORRE — LABORATÓRIO OP-09',
        shortName: 'PORÃO DOS HERÓIS (OP-09)',
        sub: 'Laboratório Bio-Genético Subterrâneo • Criação de Personagem [F]',
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
        sub: 'Tuning 0–10 • Pintura • Decals • Monster Truck & Rampa Cunha [F]',
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
        bounds: wsBounds({ minX: -1012, maxX: -530, minZ: -1820, maxZ: 580, minY: 0, maxY: 140 }),
        spawn: wsPos3({ x: -702, y: 26.2, z: -135 }),
        color: '#dc2626',
        icon: 'cdd'
      }
    };
  },

  /**
   * Retorna a cota Y da superfície da água em (x, z)
   */
  getWaterSurfaceY(x, z) {
    const ux = fromWs(x);
    const uz = fromWs(z);
    if (ux >= 70 && ux <= 340 && uz >= 187 && uz <= 349) {
      return 0.42;
    }
    if (ux >= 539 && ux <= 581 && uz >= -2950 && uz <= 1075) {
      if (uz > 1050) {
        const t = Math.min(1, (uz - 1050) / 25);
        return -3.5 + t * 3.35;
      }
      if (uz < -1305) {
        const t = Math.min(1, (-1305 - uz) / 20);
        return -3.5 + t * 3.35;
      }
      return -3.5;
    }
    return -0.15;
  },

  /**
   * Retorna a elevação contínua das Pontes em Arco e dos Píeres Fluviais de Madeira
   */
  getRoadElevation(x, z) {
    if (x >= ws(526) && x <= ws(594)) {
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
    if (x >= ws(540) - 10 && x <= ws(580) + 10) {
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
   * Retorna a elevação contínua do solo base em (x, z), incluindo o degrau suave de +0.18m
   * das calçadas reais de 10m quando `IS_SCALED_WORLD` está ativo!
   */
  getTerrainHeightAt(x, z) {
    const metroCutY = getMetroCutoutFloorY(x, z);
    if (metroCutY !== null) return metroCutY;

    const roadY = this.getRoadElevation(x, z);
    if (roadY !== 0) return roadY;

    const isletSample = getIsletSampleAt(x, z);
    if (isletSample) return isletSample.height;

    // Orla Sul construída (Calçadão e Faixa de Areia)
    if (x >= ws(-1825) && x <= ws(538) && z >= ws(726) && z <= ws(1056) && !(x < ws(-1530) && z > ws(1020))) {
      const inSantosCanal =
        (Math.abs(x - ws(-384)) < 9.5 || Math.abs(x - ws(-120)) < 9.5 || Math.abs(x - ws(252)) < 9.5) &&
        !((z >= ws(725) && z <= ws(778)) || Math.abs(z - ws(910)) <= 8);
      if (!inSantosCanal) {
        if (z < ws(778)) {
          return Math.max(0.32, getUrbanCityReliefY(x, z));
        }
        if (!(Math.abs(x) <= 48 && z >= ws(1020))) {
          const zWetStart = ws(1056) - 20;
          const wetSlope = z <= zWetStart ? 0.12 : 0.12 - ((z - zWetStart) / 20.0) * 0.24;
          return Math.max(wetSlope, getSouthwestBeachReliefY(x, z));
        }
      }
    }

    const baseY = Math.max(
      getFavelaElevation(x, z),
      getUrbanCityReliefY(x, z),
      getPangaeaElevationAt(x, z)
    );
    if (!IS_SCALED_WORLD) return baseY;
    return baseY + getScaledUrbanCurbLiftAt(this, x, z);
  },

  /**
   * Suporte físico real a múltiplos níveis empilhados (`elevatedDecks` + `undergroundFloors`)
   */
  getSurfaceHeightAt(x, z, currentY = 0) {
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

    return this.getTerrainHeightAt(x, z);
  },

  /**
   * Verifica se a coordenada (x, z) é ÁGUA PROFUNDA (Lago do Parque, Rio Urbano, Canais ou Oceano Atlântico)
   */
  isDeepWaterAt(x, z, opts = {}) {
    const forBoat = Boolean(opts.forBoat);
    const ux = fromWs(x);
    const uz = fromWs(z);

    // 1. GRANDE LAGO DO PARQUE CENTRAL
    if (ux >= 73 && ux <= 337 && uz >= 190 && uz <= 346) {
      if (!forBoat && ux <= 107 && uz >= 259 && uz <= 277) return false;
      if (Math.abs(x - ws(205)) <= 8.5) {
        if (!forBoat) return false;
        if (Math.abs(uz - 268) >= 20 && Math.abs(uz - 268) <= 24) return false;
      }
      return true;
    }

    // 2. OS 3 CANAIS ESTILO SANTOS NA ORLA SUL (meia-largura 9.5m em 1x!)
    for (const dcx of [-384, -120, 252]) {
      const cx = ws(dcx);
      if (Math.abs(x - cx) < 9.5 && z >= ws(726) && z <= ws(1055)) {
        if (!forBoat) {
          if ((z >= ws(725) && z <= ws(778)) || Math.abs(z - ws(910)) <= 8) return false;
        }
        return true;
      }
    }

    // 3. RIO / CANAL URBANO & FIORDE BOREAL LESTE NAVEGÁVEL
    if (x >= ws(540) && x <= ws(580) && z >= ws(-2950) && z <= ws(1075)) {
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

    // 4. TERRA FIRME
    if (isPointOnOrganicLand(x, z)) return false;
    if (x >= ws(-1825) && x <= ws(540) && z >= ws(-1320) && z <= ws(1045)) return false;
    if (x >= ws(580) && x <= ws(1628) && z >= ws(-1320) && z <= ws(736)) return false;
    if (!forBoat && ux >= 1618 && ux <= 1650 && uz >= 120 && uz <= 695) return false;
    if (!forBoat && ux >= 995 && ux <= 1255 && uz >= 734 && uz <= 752) return false;
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
    if (x >= ws(955) && x <= ws(1795) && z >= ws(1118) && z <= ws(1980)) return false;
    if (!forBoat && ux >= 860 && ux <= 995 && uz >= 1505 && uz <= 1595) return false;

    // Grande Ponte Blindada Retilínea ligando o Porto direto à Ilha da Prisão
    if (!forBoat && Math.abs(x - ws(1375)) <= 24 && z >= ws(735) && z <= ws(1126)) return false;

    if (!forBoat) {
      if (Math.abs(x) <= 48 && z >= ws(1020) && z <= ws(1422)) return false;
      if (Math.abs(x) <= 69 && z >= ws(1405) && z <= ws(1572)) return false;
      if (x >= 43 && x <= 108 && Math.abs(z - ws(1085)) <= 9) return false;
      if (x >= 95 && x <= 109 && z >= ws(1062) && z <= ws(1228)) return false;
      for (const ddz of [1095, 1135, 1175, 1215]) {
        if (x >= 105 && x <= 151 && Math.abs(z - ws(ddz)) <= 3.5) return false;
      }
      // Marina Oeste
      const mwX = ws(-1380);
      if (x >= mwX - 8 && x <= mwX + 8 && z >= ws(1040) && z <= ws(1230)) return false;
      for (const ddz of [1095, 1135, 1175, 1215]) {
        if (x >= mwX + 4 && x <= mwX + 52 && Math.abs(z - ws(ddz)) <= 3.5) return false;
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

    const ux = fromWs(x);
    const uz = fromWs(z);

    if (y < -2.2) {
      if (Math.abs(x - ws(-320)) <= 45 && Math.abs(z - ws(-168)) <= 45) {
        return this._subRegions.porao;
      }
      return this._subRegions.metro;
    }

    const customsBox = this.streetCustomsData;
    if (y < 24.0) {
      if (customsBox) {
        if (
          Math.abs(x - customsBox.x) <= (customsBox.w || 92) * 0.5 &&
          Math.abs(z - customsBox.z) <= (customsBox.d || 96) * 0.5
        ) {
          return this._subRegions.customs;
        }
      } else if (Math.abs(x - ws(60)) <= 46 && Math.abs(z - ws(-448)) <= 48) {
        return this._subRegions.customs;
      }
    }

    if (y < 41.0 && Math.abs(x) <= 74 && z >= ws(-175) - 54 && z <= ws(-175) + 45) {
      return this._subRegions.bankInterior;
    }

    if (
      ux >= -1012 &&
      ux <= -528 &&
      uz >= -1820 &&
      uz <= 580 &&
      (ux <= -658 || (uz >= -508 && uz <= 415))
    ) {
      return this._subRegions.favela;
    }

    if (uz < -1320 && ux >= -1650 && ux <= 540 && y < 120) {
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
