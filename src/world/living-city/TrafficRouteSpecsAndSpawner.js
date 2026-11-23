import * as THREE from 'three';
import { LEGO_COLORS, markAsSharedAsset } from '../../materials/LegoMaterials.js';
import { makeFastBox, mergeBufferGeometries } from '../BuildingGenerator.js';
import { VEHICLE_SPECS, createLegoCarMesh } from '../VehicleFleetBuilder.js';
import { attachVehicleOccupants, restoreDefaultOccupants } from '../vehicles/VehicleOccupants.js';
import {
  IS_SCALED_WORLD,
  ROAD,
  ws,
  MAIN_AVENUES_X,
  MAIN_AVENUES_Z,
  SECONDARY_STREETS_X,
  SECONDARY_STREETS_Z,
  INDUSTRIAL_STREETS_X
} from '../core/WorldLayoutScale.js';
import {
  buildPolylineRouteTable,
  findSafePolylineAlong,
  samplePolylinePose
} from './OrganicTrafficPolylineHelper.js';

export const SHARED_BRAKE_LIGHT_OFF_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({ color: 0x450a0a })
);
SHARED_BRAKE_LIGHT_OFF_MAT.userData = {
  ...SHARED_BRAKE_LIGHT_OFF_MAT.userData,
  isDynamicMaterial: true
};

export const SHARED_BRAKE_LIGHT_ON_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({ color: 0xff1e1e })
);
SHARED_BRAKE_LIGHT_ON_MAT.userData = {
  ...SHARED_BRAKE_LIGHT_ON_MAT.userData,
  isDynamicMaterial: true
};

const SHARED_BRAKE_PAIR_GEO_CACHE = new Map();

function getSharedMergedBrakePairGeo(lxOff, rearZ) {
  const key = `${lxOff.toFixed(3)}|${rearZ.toFixed(3)}`;
  let geo = SHARED_BRAKE_PAIR_GEO_CACHE.get(key);
  if (!geo) {
    geo = markAsSharedAsset(
      mergeBufferGeometries([
        makeFastBox(0.42, 0.2, 0.08, -lxOff, 0.82, rearZ),
        makeFastBox(0.42, 0.2, 0.08, lxOff, 0.82, rearZ)
      ])
    );
    SHARED_BRAKE_PAIR_GEO_CACHE.set(key, geo);
  }
  return geo;
}

const SCALED_MAIN_X_SET = new Set(MAIN_AVENUES_X);
const SCALED_MAIN_Z_SET = new Set(MAIN_AVENUES_Z);
const SCALED_SEC_X_SET = new Set([...SECONDARY_STREETS_X, ...INDUSTRIAL_STREETS_X]);
const SCALED_SEC_Z_SET = new Set(SECONDARY_STREETS_Z);

function adaptTrafficSpecToWorldScale(raw, idx) {
  if (!IS_SCALED_WORLD) return raw;

  const isViaduct = raw.startY !== undefined && raw.startY >= 9.0 && Math.abs(raw.roadCoord) <= 1050;
  let designRoadCoord = raw.roadCoord;
  let designPosAlong = raw.posAlong;
  let minC = raw.minC;
  let maxC = raw.maxC;

  // Em 3x, alinha rotas às avenidas/ruas reais da malha (evitando calçadas de 10m e o muro fechado do Parque Central)
  if (!isViaduct) {
    if (raw.axis === 'z_const') {
      if (designRoadCoord === -252) designRoadCoord = -250;
      else if (designRoadCoord === 384) designRoadCoord = 402;
      else if (designRoadCoord === 0 && minC === -495) minC = -450;
    } else if (raw.axis === 'x_const') {
      if (designRoadCoord === 612) {
        designRoadCoord = 600;
        maxC = Math.min(maxC, 120);
      } else if (Math.abs(designRoadCoord) <= 384 && minC < 134 && maxC > 402) {
        // As avenidas N-S térreas param nas fachadas Norte (Z=134) e Sul (Z=402) do Parque Central!
        if (designPosAlong <= 125) {
          maxC = 122;
          designPosAlong = Math.min(110, Math.max(minC + 20, designPosAlong));
        } else {
          minC = 414;
          maxC = 696;
          designPosAlong = 430 + ((Math.abs(Math.round(designPosAlong)) * 37 + idx * 29) % 245);
        }
      }
    }
  }

  const roadCoord = ws(designRoadCoord);
  const isMainRoad =
    isViaduct ||
    (raw.axis === 'z_const' ? SCALED_MAIN_Z_SET.has(roadCoord) : SCALED_MAIN_X_SET.has(roadCoord));
  const roadWidth = isMainRoad ? ROAD.mainWidth : ROAD.secondaryWidth;
  const sign = raw.laneOffset >= 0 ? 1 : -1;

  let laneOffset;
  if (isViaduct) {
    laneOffset = sign * 7.2;
  } else if (isMainRoad) {
    // Distribui suavemente nas 2 faixas por sentido da avenida de 34m (6.4m e 10.0m -> média ~7.5m..8.2m, dentro de ±13.5m)
    laneOffset = sign * (idx % 2 === 0 ? 6.4 : 10.0);
  } else if (raw.axis === 'z_const' ? SCALED_SEC_Z_SET.has(roadCoord) : SCALED_SEC_X_SET.has(roadCoord)) {
    laneOffset = sign * 5.5;
  } else {
    // Rodovias inter-regionais da Pangeia (26m)
    laneOffset = sign * 5.5;
  }

  return {
    ...raw,
    roadCoord,
    laneOffset,
    posAlong: ws(designPosAlong),
    minC: ws(minC),
    maxC: ws(maxC),
    roadWidth,
    isViaduct
  };
}

export const trafficRouteSpecsAndSpawnerMethods = {
  // ============================================================================
  // FROTA DE TRÂNSITO VIVO ESTILO MANHATTAN (~78 VEÍCULOS DISTRIBUÍDOS EM 3X)
  // ============================================================================
  _initUrbanTraffic() {
    const YEL = 0xc88a14; // Âmbar Gotham Envelhecido p/ Táxis
    const WHT = 0x181e29; // Teto Grafite/Obsidiana Sombrio
    const BLK = LEGO_COLORS.black;

    const trafficSpecs = [
      // 1. Avenida Central em frente ao Super Banco Central (Z = -117)
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -410, dir: 1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0x1e293b, roofColor: 0x0f172a, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -265, dir: 1, minC: -495, maxC: 515 },
      { type: 'apex_gtx', color: 0x7f1d1d, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -130, dir: 1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: -32, dir: 1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'sedan_familiar', color: 0x1e3a5f, roofColor: WHT, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 65, dir: 1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'carro_forte', color: 0x172554, roofColor: LEGO_COLORS.gold, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 185, dir: 1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: 5.2, posAlong: 340, dir: 1, minC: -495, maxC: 515, skipInScaled: true },

      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 410, dir: -1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0x451a1a, roofColor: 0x111827, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 255, dir: -1, minC: -495, maxC: 515 },
      { type: 'vortex_roadster', color: 0x334155, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 115, dir: -1, minC: -495, maxC: 515 },
      { type: 'interceptor_v8', color: BLK, roofColor: 0xcbd5e1, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: 15, dir: -1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -88, dir: -1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'sedan_familiar', color: 0x143828, roofColor: WHT, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -220, dir: -1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'trovao_v8', color: 0x7c2d12, roofColor: BLK, axis: 'z_const', roadCoord: -117, laneOffset: -5.2, posAlong: -365, dir: -1, minC: -495, maxC: 515, skipInScaled: true },

      // 2. Avenida Times Square / Parque Central (Z = 0)
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: -340, dir: 1, minC: -495, maxC: 515 },
      { type: 'vortex_roadster', color: 0x164e63, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: -180, dir: 1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0x172554, roofColor: 0x0f172a, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: -25, dir: 1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: 135, dir: 1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'sedan_familiar', color: 0x6b1426, roofColor: WHT, axis: 'z_const', roadCoord: 0, laneOffset: 5.2, posAlong: 310, dir: 1, minC: -495, maxC: 515, skipInScaled: true },

      { type: 'cyber_blade', color: 0x0f172a, roofColor: 0x090a0d, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: 360, dir: -1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: 195, dir: -1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'sedan_familiar', color: 0x3f3f46, roofColor: WHT, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: 55, dir: -1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'apex_gtx', color: 0xb47b12, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: -95, dir: -1, minC: -495, maxC: 515 },
      { type: 'moto_policia', color: 0x111827, roofColor: 0xcbd5e1, axis: 'z_const', roadCoord: 0, laneOffset: -5.2, posAlong: -270, dir: -1, minC: -495, maxC: 515 },

      // 3. Avenidas Leste-Oeste Norte do Banco (Z = -252) & Sul do Parque (Z = 384)
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -252, laneOffset: 5.2, posAlong: -290, dir: 1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0x1e3a5f, roofColor: WHT, axis: 'z_const', roadCoord: -252, laneOffset: 5.2, posAlong: -40, dir: 1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'onibus_urbano', color: 0x27303f, roofColor: 0x143828, axis: 'z_const', roadCoord: -252, laneOffset: 5.2, posAlong: 220, dir: 1, minC: -495, maxC: 515 },
      { type: 'trovao_v8', color: 0x7f1d1d, roofColor: BLK, axis: 'z_const', roadCoord: -252, laneOffset: -5.2, posAlong: 280, dir: -1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -252, laneOffset: -5.2, posAlong: 20, dir: -1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'sedan_familiar', color: 0x2e1a47, roofColor: WHT, axis: 'z_const', roadCoord: -252, laneOffset: -5.2, posAlong: -210, dir: -1, minC: -495, maxC: 515 },

      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: 384, laneOffset: 5.2, posAlong: -280, dir: 1, minC: -495, maxC: 515 },
      { type: 'sedan_familiar', color: 0x143828, roofColor: WHT, axis: 'z_const', roadCoord: 384, laneOffset: 5.2, posAlong: 35, dir: 1, minC: -495, maxC: 515, skipInScaled: true },
      { type: 'vortex_roadster', color: 0x7c2d12, roofColor: BLK, axis: 'z_const', roadCoord: 384, laneOffset: 5.2, posAlong: 290, dir: 1, minC: -495, maxC: 515 },
      { type: 'onibus_urbano', color: 0x451a1a, roofColor: 0x111827, axis: 'z_const', roadCoord: 384, laneOffset: -5.2, posAlong: 210, dir: -1, minC: -495, maxC: 515 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: 384, laneOffset: -5.2, posAlong: -85, dir: -1, minC: -495, maxC: 515 },

      // 4. Avenida Norte-Sul Oeste do Banco (X = -120)
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: -460, dir: 1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0x164e63, roofColor: WHT, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: -220, dir: 1, minC: -680, maxC: 680, skipInScaled: true },
      { type: 'onibus_urbano', color: 0x1e293b, roofColor: 0x172554, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: 10, dir: 1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: 260, dir: 1, minC: -680, maxC: 680, skipInScaled: true },
      { type: 'apex_gtx', color: 0x172554, roofColor: BLK, axis: 'x_const', roadCoord: -120, laneOffset: -5.2, posAlong: 490, dir: 1, minC: -680, maxC: 680 },

      { type: 'interceptor_v8', color: BLK, roofColor: 0xcbd5e1, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: 430, dir: -1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: 185, dir: -1, minC: -680, maxC: 680, skipInScaled: true },
      { type: 'sedan_familiar', color: 0x6b1426, roofColor: WHT, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: -65, dir: -1, minC: -680, maxC: 680 },
      { type: 'trovao_v8', color: 0x143828, roofColor: BLK, axis: 'x_const', roadCoord: -120, laneOffset: 5.2, posAlong: -310, dir: -1, minC: -680, maxC: 680 },

      // 5. Avenida Norte-Sul Leste do Banco (X = 120)
      { type: 'carro_forte', color: 0x172554, roofColor: LEGO_COLORS.gold, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: -380, dir: 1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: -140, dir: 1, minC: -680, maxC: 680, skipInScaled: true },
      { type: 'vortex_roadster', color: 0x1e3a5f, roofColor: BLK, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: 95, dir: 1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0x475569, roofColor: WHT, axis: 'x_const', roadCoord: 120, laneOffset: -5.2, posAlong: 340, dir: 1, minC: -680, maxC: 680 },

      { type: 'onibus_urbano', color: 0x172554, roofColor: 0x0f172a, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: 410, dir: -1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: 160, dir: -1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0x334155, roofColor: WHT, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: -90, dir: -1, minC: -680, maxC: 680, skipInScaled: true },
      { type: 'cyber_blade', color: 0x1e1b4b, roofColor: BLK, axis: 'x_const', roadCoord: 120, laneOffset: 5.2, posAlong: -350, dir: -1, minC: -680, maxC: 680 },

      // 6. Avenida da Torre dos Heróis (X = -252) & Avenida do Parque Leste (X = 252)
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: -252, laneOffset: -5.2, posAlong: -260, dir: 1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0x113e32, roofColor: WHT, axis: 'x_const', roadCoord: -252, laneOffset: -5.2, posAlong: 120, dir: 1, minC: -680, maxC: 680 },
      { type: 'trovao_v8', color: 0x92400e, roofColor: BLK, axis: 'x_const', roadCoord: -252, laneOffset: 5.2, posAlong: 210, dir: -1, minC: -680, maxC: 680 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: -252, laneOffset: 5.2, posAlong: -180, dir: -1, minC: -680, maxC: 680, skipInScaled: true },

      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: 252, laneOffset: -5.2, posAlong: -240, dir: 1, minC: -680, maxC: 680, skipInScaled: true },
      { type: 'apex_gtx', color: 0x155e75, roofColor: BLK, axis: 'x_const', roadCoord: 252, laneOffset: -5.2, posAlong: 150, dir: 1, minC: -680, maxC: 680 },
      { type: 'onibus_urbano', color: 0x27303f, roofColor: 0x7f1d1d, axis: 'x_const', roadCoord: 252, laneOffset: 5.2, posAlong: 260, dir: -1, minC: -680, maxC: 680 },
      { type: 'sedan_familiar', color: 0x1e293b, roofColor: WHT, axis: 'x_const', roadCoord: 252, laneOffset: 5.2, posAlong: -130, dir: -1, minC: -680, maxC: 680 },

      // 7. Via Expressa Oeste (X = -516) & Avenida Leste / Porto (X = 612)
      { type: 'onibus_urbano', color: 0x172554, roofColor: 0x0f172a, axis: 'x_const', roadCoord: -516, laneOffset: -5.2, posAlong: -260, dir: 1, minC: -620, maxC: 520 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: -516, laneOffset: -5.2, posAlong: 90, dir: 1, minC: -620, maxC: 520, skipInScaled: true },
      { type: 'sedan_familiar', color: 0x7f1d1d, roofColor: WHT, axis: 'x_const', roadCoord: -516, laneOffset: 5.2, posAlong: 190, dir: -1, minC: -620, maxC: 520 },
      { type: 'interceptor_v8', color: BLK, roofColor: 0xcbd5e1, axis: 'x_const', roadCoord: 612, laneOffset: -5.2, posAlong: -240, dir: 1, minC: -580, maxC: 480 },
      { type: 'carro_forte', color: 0x172554, roofColor: LEGO_COLORS.gold, axis: 'x_const', roadCoord: 612, laneOffset: 5.2, posAlong: 160, dir: -1, minC: -580, maxC: 480 },

      // 8. Avenida Beira-Mar Sul (Z = 710 — Buggies de Praia, Conversíveis e Táxis!)
      { type: 'buggy_praia', color: 0x9a3412, roofColor: 0x1e293b, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: -360, dir: 1, minC: -520, maxC: 520 },
      { type: 'vortex_roadster', color: 0x6b1426, roofColor: BLK, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: -110, dir: 1, minC: -520, maxC: 520 },
      { type: 'buggy_praia', color: 0x155e75, roofColor: 0xb47b12, axis: 'z_const', roadCoord: 710, laneOffset: 5.2, posAlong: 140, dir: 1, minC: -520, maxC: 520, skipInScaled: true },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: 710, laneOffset: -5.2, posAlong: 310, dir: -1, minC: -520, maxC: 520 },
      { type: 'buggy_praia', color: 0x2b3620, roofColor: 0x9a3412, axis: 'z_const', roadCoord: 710, laneOffset: -5.2, posAlong: 40, dir: -1, minC: -520, maxC: 520 },
      { type: 'cyber_blade', color: 0x0f172a, roofColor: BLK, axis: 'z_const', roadCoord: 710, laneOffset: -5.2, posAlong: -230, dir: -1, minC: -520, maxC: 520, skipInScaled: true },

      // 9. Subúrbio Norte (Z = -512) & Ladeiras Norte-Sul até o Platô Costeiro (+11.5m)
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -512, laneOffset: 5.2, posAlong: -280, dir: 1, minC: -490, maxC: 490 },
      { type: 'sedan_familiar', color: 0x1e3a5f, roofColor: WHT, axis: 'z_const', roadCoord: -512, laneOffset: 5.2, posAlong: 85, dir: 1, minC: -490, maxC: 490 },
      { type: 'onibus_urbano', color: 0x1e293b, roofColor: 0x172554, axis: 'z_const', roadCoord: -512, laneOffset: -5.2, posAlong: 220, dir: -1, minC: -490, maxC: 490 },
      { type: 'sedan_familiar', color: 0x143828, roofColor: WHT, axis: 'z_const', roadCoord: -512, laneOffset: -5.2, posAlong: -140, dir: -1, minC: -490, maxC: 490, skipInScaled: true },

      // 10. REDE DOS 3 GRANDES VIADUTOS EXPRESSOS LEGO (Y = +12.4m / +10.2m / +9.2m!)
      // Viaduto 01 — Elevado Leste-Oeste (Z = -382, X = -465..+465, Y = +12.4m)
      { type: 'apex_gtx', color: 0x991b1b, roofColor: BLK, axis: 'z_const', roadCoord: -382, laneOffset: 3.8, posAlong: -310, dir: 1, minC: -495, maxC: 505, startY: 12.4 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -382, laneOffset: 3.8, posAlong: -65, dir: 1, minC: -495, maxC: 505, startY: 12.4, skipInScaled: true },
      { type: 'onibus_urbano', color: 0x172554, roofColor: 0x0f172a, axis: 'z_const', roadCoord: -382, laneOffset: 3.8, posAlong: 185, dir: 1, minC: -495, maxC: 505, startY: 12.4 },
      { type: 'vortex_roadster', color: 0x164e63, roofColor: BLK, axis: 'z_const', roadCoord: -382, laneOffset: -3.8, posAlong: 315, dir: -1, minC: -495, maxC: 505, startY: 12.4 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: -382, laneOffset: -3.8, posAlong: 40, dir: -1, minC: -495, maxC: 505, startY: 12.4, skipInScaled: true },
      { type: 'interceptor_v8', color: BLK, roofColor: 0xcbd5e1, axis: 'z_const', roadCoord: -382, laneOffset: -3.8, posAlong: -225, dir: -1, minC: -495, maxC: 505, startY: 12.4 },

      // Viaduto 02 — Panorâmico Norte-Sul sobre o Grande Lago (X = +252, Z = -84..+520, Y = +10.2m)
      { type: 'vortex_roadster', color: 0xb47b12, roofColor: BLK, axis: 'x_const', roadCoord: 252, laneOffset: -3.8, posAlong: 55, dir: 1, minC: -102, maxC: 542, startY: 10.2 },
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'x_const', roadCoord: 252, laneOffset: -3.8, posAlong: 295, dir: 1, minC: -102, maxC: 542, startY: 10.2, skipInScaled: true },
      { type: 'cyber_blade', color: 0x2e1065, roofColor: BLK, axis: 'x_const', roadCoord: 252, laneOffset: 3.8, posAlong: 390, dir: -1, minC: -102, maxC: 542, startY: 10.2 },
      { type: 'sedan_familiar', color: 0x143828, roofColor: WHT, axis: 'x_const', roadCoord: 252, laneOffset: 3.8, posAlong: 135, dir: -1, minC: -102, maxC: 542, startY: 10.2 },

      // Viaduto 03 — Expresso Oeste Aeroporto <-> Centro / CDD (Z = 0, X = -1036..-466, Y = +9.2m)
      { type: 'taxi_metro', color: YEL, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: 3.8, posAlong: -880, dir: 1, minC: -1048, maxC: -446, startY: 9.2, wrapY: 0.28, skipInScaled: true },
      { type: 'onibus_urbano', color: 0x1e293b, roofColor: 0x172554, axis: 'z_const', roadCoord: 0, laneOffset: 3.8, posAlong: -620, dir: 1, minC: -1048, maxC: -446, startY: 9.2, wrapY: 0.28 },
      { type: 'apex_gtx', color: 0x1e3a5f, roofColor: BLK, axis: 'z_const', roadCoord: 0, laneOffset: -3.8, posAlong: -560, dir: -1, minC: -1048, maxC: -446, startY: 9.2, wrapY: 0 },
      { type: 'interceptor_v8', color: BLK, roofColor: 0xcbd5e1, axis: 'z_const', roadCoord: 0, laneOffset: -3.8, posAlong: -810, dir: -1, minC: -1048, maxC: -446, startY: 9.2, wrapY: 0 },

      // Rodovias Inter-Regionais da Pangeia
      { type: 'sedan_familiar', color: 0x22c55e, roofColor: WHT, axis: 'x_const', roadCoord: -1215, laneOffset: 5.0, posAlong: -1920, dir: 1, minC: -2600, maxC: -1310, startY: 8.5, skipInScaled: true },
      { type: 'onibus_urbano', color: 0xfacc15, roofColor: 0x166534, axis: 'x_const', roadCoord: -1215, laneOffset: -5.0, posAlong: -1540, dir: -1, minC: -2600, maxC: -1310, startY: 8.5 },
      { type: 'apex_gtx', color: 0xf97316, roofColor: BLK, axis: 'z_const', roadCoord: -2150, laneOffset: 5.0, posAlong: -450, dir: 1, minC: -2440, maxC: 2140, startY: 11.5 },
      { type: 'trovao_v8', color: 0x2563eb, roofColor: WHT, axis: 'z_const', roadCoord: -2150, laneOffset: -5.0, posAlong: 1180, dir: -1, minC: -2440, maxC: 2140, startY: 11.5, skipInScaled: true },
      { type: 'carro_forte', color: 0x1e3a8a, roofColor: LEGO_COLORS.gold, axis: 'x_const', roadCoord: 964, laneOffset: 5.0, posAlong: -1750, dir: 1, minC: -2130, maxC: -1310, startY: 8.5 },
      { type: 'vortex_roadster', color: 0x38bdf8, roofColor: BLK, axis: 'z_const', roadCoord: -908, laneOffset: 5.0, posAlong: 2100, dir: 1, minC: 1620, maxC: 2660, startY: 4.5 },
      { type: 'sedan_familiar', color: 0xfef08a, roofColor: WHT, axis: 'x_const', roadCoord: 2680, laneOffset: -5.0, posAlong: -1320, dir: -1, minC: -1700, maxC: -920, startY: 4.5, skipInScaled: true },
      { type: 'interceptor_v8', color: BLK, roofColor: WHT, axis: 'z_const', roadCoord: -1285, laneOffset: 5.0, posAlong: -2420, dir: 1, minC: -3010, maxC: -1800, startY: 4.5 },
      { type: 'cyber_blade', color: 0xe11d48, roofColor: BLK, axis: 'x_const', roadCoord: -2460, laneOffset: 5.0, posAlong: 320, dir: 1, minC: -2130, maxC: 2080, startY: 4.5, skipInScaled: true },
      { type: 'taxi_metro', color: YEL, roofColor: YEL, axis: 'z_const', roadCoord: 710, laneOffset: -5.0, posAlong: -2360, dir: -1, minC: -2900, maxC: -1815, startY: 4.2, skipInScaled: true }
    ];

    for (let i = 0; i < trafficSpecs.length; i++) {
      if (IS_SCALED_WORLD && trafficSpecs[i].skipInScaled) continue;
      this._spawnTrafficVehicle(adaptTrafficSpecToWorldScale(trafficSpecs[i], i));
    }

    // Em escala 3x, adiciona veículos vivos trafegando nas grandes diagonais (Broadway & Diagonal Leste) e curvas em S (~78 veículos totais)!
    if (IS_SCALED_WORLD && Array.isArray(this.world?.mapOrganicRoads)) {
      const byId = new Map();
      for (const r of this.world.mapOrganicRoads) {
        if (r?.kind === 'polyline' && r.id && Array.isArray(r.points)) byId.set(r.id, r);
      }
      const polySpecs = [
        { polyId: 'broadway_metro_nw_se', lane: 5.4, trim: 22, cars: [
          ['taxi_metro', YEL, BLK, 0.14, 1], ['onibus_urbano', 0x1e293b, 0x0f172a, 0.58, 1],
          ['vortex_roadster', 0x164e63, BLK, 0.34, -1], ['sedan_familiar', 0x334155, WHT, 0.78, -1]
        ] },
        { polyId: 'boulevard_diag_ne_sw', lane: 5.2, trim: 22, cars: [
          ['taxi_metro', YEL, BLK, 0.20, 1], ['cyber_blade', 0x0f172a, BLK, 0.68, 1],
          ['onibus_urbano', 0x172554, 0x0f172a, 0.36, -1], ['trovao_v8', 0x7c2d12, BLK, 0.82, -1]
        ] },
        { polyId: 'r1_c0_scurve', lane: 4.5, trim: 20, cars: [['sedan_familiar', 0x143828, WHT, 0.45, 1]] },
        { polyId: 'r1_c5_scurve', lane: 4.5, trim: 20, cars: [['vortex_roadster', 0x1e3a5f, BLK, 0.45, 1]] },
        { polyId: 'r3_c1_scurve', lane: 4.5, trim: 20, cars: [['taxi_metro', YEL, BLK, 0.48, 1]] },
        { polyId: 'r4_c1_scurve', lane: 4.5, trim: 20, cars: [['buggy_praia', 0x155e75, 0xb47b12, 0.48, 1]] }
      ];

      for (const ps of polySpecs) {
        const org = byId.get(ps.polyId);
        if (!org) continue;
        const polyTable = buildPolylineRouteTable(org.points, ps.trim);
        if (!polyTable) continue;
        for (const [type, color, roofColor, frac, dir] of ps.cars) {
          const prefS = polyTable.minS + (polyTable.maxS - polyTable.minS) * frac;
          const safe = findSafePolylineAlong(this.world, polyTable, prefS, dir, ps.lane);
          this._spawnTrafficVehicle({
            type,
            color,
            roofColor,
            isPolylineRoute: true,
            polyId: ps.polyId,
            polyTable,
            axis: `poly_${ps.polyId}`,
            roadCoord: 0,
            roadWidth: org.width || ROAD.secondaryWidth,
            laneOffset: ps.lane,
            posAlong: safe.s,
            dir,
            minC: polyTable.minS,
            maxC: polyTable.maxS,
            spawnPose: safe.pose
          });
        }
      }
    }
  },

  _spawnTrafficVehicle(cfg) {
    const spec = VEHICLE_SPECS[cfg.type] || VEHICLE_SPECS.sedan_familiar;
    const isMoto = Boolean(spec.isMotorcycle);
    let x;
    let z;
    let rotY;
    if (cfg.isPolylineRoute && cfg.polyTable) {
      const pose = cfg.spawnPose || samplePolylinePose(cfg.polyTable, cfg.posAlong, cfg.dir, cfg.laneOffset);
      x = pose.x;
      z = pose.z;
      rotY = pose.rotY;
    } else {
      x = cfg.axis === 'z_const' ? cfg.posAlong : cfg.roadCoord + cfg.laneOffset;
      z = cfg.axis === 'z_const' ? cfg.roadCoord + cfg.laneOffset : cfg.posAlong;
      rotY =
        cfg.axis === 'z_const'
          ? cfg.dir > 0
            ? Math.PI / 2
            : -Math.PI / 2
          : cfg.dir > 0
            ? 0
            : Math.PI;
    }
    const localTerrainY =
      IS_SCALED_WORLD && cfg.isViaduct && this.world.getTerrainHeightAt
        ? Math.max(0, this.world.getTerrainHeightAt(x, z))
        : 0;
    const refStartY = (cfg.startY ?? 0) + localTerrainY;
    const yBase = this.world.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(x, z, refStartY)
      : (this.world.getRoadElevation ? this.world.getRoadElevation(x, z) : 0);

    const carGroup = createLegoCarMesh({
      x,
      z,
      rotY,
      color: cfg.color,
      roofColor: cfg.roofColor,
      type: cfg.type,
      ...(isMoto ? {} : { trafficLite: true, finishStyle: 'traffic_lite' })
    });
    carGroup.position.set(x, yBase, z);
    carGroup.rotation.y = rotY;
    carGroup.userData.carType = cfg.type;
    carGroup.userData.carName = spec.name;
    carGroup.userData.vehicleSpec = spec;
    carGroup.userData.isTrafficVehicle = true;
    this.scene.add(carGroup);

    const isPoliceVehicle = ['caveirao_bope', 'interceptor_v8', 'choque_pickup', 'moto_policia'].includes(cfg.type);
    const isBus = cfg.type === 'onibus_urbano';

    const baseW = isMoto ? 1.45 : isBus ? 2.85 : 2.5;
    const baseD = isMoto ? 3.8 : isBus ? 8.5 : 5.0;
    const baseH = isBus ? 2.75 : 2.1;

    // Par de Luzes de Freio Traseiras pré-mesclado em 1 único Mesh com geometria compartilhada
    const brakeLights = [];
    if (!isMoto) {
      const rearZ = -baseD * 0.5 - 0.05;
      const lxOff = baseW * 0.34;
      const blMesh = new THREE.Mesh(
        getSharedMergedBrakePairGeo(lxOff, rearZ),
        SHARED_BRAKE_LIGHT_OFF_MAT
      );
      blMesh.castShadow = false;
      blMesh.receiveShadow = false;
      carGroup.add(blMesh);
      brakeLights.push(blMesh);
    }

    const isRotated90 = Math.abs(Math.sin(rotY)) > 0.7;
    const carWidth = isRotated90 ? baseD : baseW;
    const carDepth = isRotated90 ? baseW : baseD;

    const col1 = this.world.addCollider(x, z, carWidth, carDepth, yBase + 1.35, yBase);
    const col2 = this.world.addCollider(x, z, carWidth * 0.88, carDepth * 0.72, yBase + baseH, yBase);

    let destructibleEntry = null;
    if (this.destructibles) {
      this.destructibles.registerDestructible({
        mesh: carGroup,
        type: 'car',
        hp: spec.hp,
        radius: Math.max(carWidth, carDepth) * 0.52,
        height: baseH,
        colliders: [col1, col2],
        debrisColors: [cfg.color, cfg.roofColor, LEGO_COLORS.black, LEGO_COLORS.yellow],
        studDrops: spec.studDrops,
        groundY: yBase
      });
      destructibleEntry = this.destructibles.objects[this.destructibles.objects.length - 1];
      attachVehicleOccupants(destructibleEntry, {
        source: 'traffic',
        carType: cfg.type,
        isPoliceVehicle,
        isMoto,
        isBus,
        seedIndex: this.trafficVehicles.length
      });
    }

    const cruiseSpeed = isBus
      ? 14.5
      : Math.min(20.5, Math.max(14.0, (spec.kmh || 160) * 0.082));
    const tvEntry = {
      cfg,
      spec,
      faction: 'civilian',
      isPoliceVehicle,
      brakeLights,
      nightLightRig: null,
      isBraking: false,
      mesh: carGroup,
      destructible: destructibleEntry,
      col1,
      col2,
      baseW,
      baseD,
      baseH,
      axis: cfg.axis,
      roadCoord: cfg.roadCoord,
      roadWidth: cfg.roadWidth || ROAD.mainWidth,
      isViaduct: Boolean(cfg.isViaduct),
      isPolylineRoute: Boolean(cfg.isPolylineRoute),
      polyTable: cfg.polyTable || null,
      laneOffset: cfg.laneOffset,
      baseLaneOffset: cfg.laneOffset,
      targetLaneOffset: cfg.laneOffset,
      posAlong: cfg.posAlong,
      dir: cfg.dir,
      minC: cfg.minC,
      maxC: cfg.maxC,
      cruiseSpeed,
      currentSpeed: cruiseSpeed,
      stuckTimer: 0,
      surroundedTimer: 0,
      respawnFadeTimer: 0,
      abandonedTimer: 0,
      panicTimer: 0,
      hornCooldown: 0,
      hijackedByPlayer: false
    };
    this.trafficVehicles.push(tvEntry);
    return tvEntry;
  },

  _relocateStuckTrafficVehicle(tv, playerPos = null) {
    if (!tv || !tv.destructible || tv.destructible.destroyed) return false;
    const obj = tv.destructible;
    const span = Math.max(60, (tv.maxC - 25) - (tv.minC + 25));

    let chosenPosAlong = tv.dir > 0 ? tv.minC + 25 : tv.maxC - 25;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidatePosAlong = tv.minC + 25 + ((attempt + 0.5) / 12) * span;
      const cx = tv.axis === 'z_const' ? candidatePosAlong : tv.roadCoord + tv.baseLaneOffset;
      const cz = tv.axis === 'z_const' ? tv.roadCoord + tv.baseLaneOffset : candidatePosAlong;

      if (playerPos && Math.hypot(cx - playerPos.x, cz - playerPos.z) < 65.0) {
        continue;
      }

      let laneFree = true;
      for (const other of this.trafficVehicles) {
        if (other === tv || !other.destructible || other.destructible.destroyed) continue;
        if (other.axis !== tv.axis || Math.abs(other.roadCoord - tv.roadCoord) > 4.0) continue;
        if (
          Math.abs(other.laneOffset - tv.baseLaneOffset) < 2.8 &&
          Math.abs(other.posAlong - candidatePosAlong) < 24.0
        ) {
          laneFree = false;
          break;
        }
      }

      if (laneFree) {
        chosenPosAlong = candidatePosAlong;
        break;
      }
    }

    tv.posAlong = chosenPosAlong;
    tv.laneOffset = tv.baseLaneOffset;
    tv.targetLaneOffset = tv.baseLaneOffset;
    tv.currentSpeed = tv.cruiseSpeed;
    tv.stuckTimer = 0;
    tv.surroundedTimer = 0;
    tv.abandonedTimer = 0;
    tv.respawnFadeTimer = 0.35;

    if (tv.isBraking) {
      tv.isBraking = false;
      for (const bl of tv.brakeLights) {
        bl.material = SHARED_BRAKE_LIGHT_OFF_MAT;
      }
    }

    let nx;
    let nz;
    let rotY;
    if (tv.isPolylineRoute && tv.polyTable) {
      const safe = findSafePolylineAlong(this.world, tv.polyTable, chosenPosAlong, tv.dir, tv.laneOffset);
      tv.posAlong = safe.s;
      nx = safe.pose.x;
      nz = safe.pose.z;
      rotY = safe.pose.rotY;
    } else {
      nx = tv.axis === 'z_const' ? tv.posAlong : tv.roadCoord + tv.laneOffset;
      nz = tv.axis === 'z_const' ? tv.roadCoord + tv.laneOffset : tv.posAlong;
      rotY =
        tv.axis === 'z_const'
          ? tv.dir > 0
            ? Math.PI / 2
            : -Math.PI / 2
          : tv.dir > 0
            ? 0
            : Math.PI;
    }
    const baseGroundY = this.world.getTerrainHeightAt ? this.world.getTerrainHeightAt(nx, nz) : 0;
    const refY =
      IS_SCALED_WORLD && tv.isViaduct
        ? Math.max(0, baseGroundY) + (tv.cfg?.startY ?? 12.4)
        : (tv.cfg?.startY ?? tv.cfg?.wrapY ?? baseGroundY);
    const ny = this.world.getSurfaceHeightAt
      ? this.world.getSurfaceHeightAt(nx, nz, refY)
      : (this.world.getRoadElevation ? this.world.getRoadElevation(nx, nz) : 0);

    tv.mesh.position.set(nx, ny, nz);
    tv.mesh.rotation.set(0, rotY, 0, 'YXZ');
    obj.basePos.copy(tv.mesh.position);
    obj.baseRot.copy(tv.mesh.rotation);
    obj.groundY = ny;
    obj.hp = obj.maxHp;
    obj.isBurning = false;
    obj.engineFireTimer = 0;
    obj.damageStage = 'intact';
    obj.driverKilled = false;
    restoreDefaultOccupants(obj);

    const isRotated90 = Math.abs(Math.sin(rotY)) > 0.7;
    const w = isRotated90 ? tv.baseD : tv.baseW;
    const d = isRotated90 ? tv.baseW : tv.baseD;
    if (tv.col1) {
      tv.col1.minX = nx - w * 0.5;
      tv.col1.maxX = nx + w * 0.5;
      tv.col1.minZ = nz - d * 0.5;
      tv.col1.maxZ = nz + d * 0.5;
      tv.col1.minY = ny;
      tv.col1.maxY = ny + 1.35;
    }
    if (tv.col2) {
      tv.col2.minX = nx - w * 0.44;
      tv.col2.maxX = nx + w * 0.44;
      tv.col2.minZ = nz - d * 0.36;
      tv.col2.maxZ = nz + d * 0.36;
      tv.col2.minY = ny;
      tv.col2.maxY = ny + tv.baseH;
    }
    return true;
  }
};
