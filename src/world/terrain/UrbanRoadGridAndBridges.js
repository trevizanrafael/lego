import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { makeFastBox } from '../buildings/GeometryMergeUtils.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import {
  RIVER_BRIDGE_SPECS,
  PANGAEA_BRIDGE_SPECS,
  RIVER_PIER_SPECS,
  addChunkedArrayToScene
} from './BridgeAndPierSpecs.js';

export { RIVER_BRIDGE_SPECS, PANGAEA_BRIDGE_SPECS, RIVER_PIER_SPECS };

/**
 * MALHA VIÁRIA URBANA OTIMIZADA COM ADAPTAÇÃO TOTAL AO RELEVO:
 * - Todas as faixas amarelas/brancas, faixas de pedestres, canteiros e semáforos acompanham `getUrbanCityReliefY(x, z)`!
 */
export function buildUrbanRoadGridAndMedians(world) {
  const mainAvenuesX = [-384, -252, -120, 0, 120, 252, 384];
  const mainAvenuesZ = [-382, -250, -117, 0, 134, 402, 710];
  const secondaryStreetsX = [-648, -516, 516, 648];
  const secondaryStreetsZ = [-1172, -1040, -908, -776, -644, -512, 556];

  const yellowGeos = [];
  const whiteGeos = [];
  const medianGeos = [];
  const turfGeos = [];
  const poleGeos = [];

  const sampleRoadY = (x, z) => getUrbanCityReliefY(x, z);

  const pushTerrainLineZ = (geos, xLine, widthX, zFrom, zTo, stepSize = 12, thickness = 0.045, yOff = 0.055) => {
    const total = zTo - zFrom;
    const steps = Math.max(1, Math.round(Math.abs(total) / stepSize));
    const dz = total / steps;
    for (let i = 0; i < steps; i++) {
      const z0 = zFrom + i * dz;
      const z1 = z0 + dz;
      const zm = (z0 + z1) * 0.5;
      const y0 = sampleRoadY(xLine, z0) + yOff;
      const y1 = sampleRoadY(xLine, z1) + yOff;
      const ym = (y0 + y1) * 0.5;
      const dy = y1 - y0;
      if (Math.abs(dy) < 0.004) {
        geos.push(makeFastBox(widthX, thickness, Math.abs(dz) + 0.04, xLine, ym, zm));
      } else {
        const segLen = Math.hypot(dz, dy) + 0.08;
        const g = new THREE.BoxGeometry(widthX, thickness, segLen);
        g.rotateX(-Math.atan2(dy, dz));
        g.translate(xLine, ym, zm);
        geos.push(g);
      }
    }
  };

  const pushTerrainLineX = (geos, zLine, depthZ, xFrom, xTo, stepSize = 12, thickness = 0.045, yOff = 0.055) => {
    const total = xTo - xFrom;
    const steps = Math.max(1, Math.round(Math.abs(total) / stepSize));
    const dx = total / steps;
    for (let i = 0; i < steps; i++) {
      const x0 = xFrom + i * dx;
      const x1 = x0 + dx;
      const xm = (x0 + x1) * 0.5;
      const y0 = sampleRoadY(x0, zLine) + yOff;
      const y1 = sampleRoadY(x1, zLine) + yOff;
      const ym = (y0 + y1) * 0.5;
      const dy = y1 - y0;
      if (Math.abs(dy) < 0.004) {
        geos.push(makeFastBox(Math.abs(dx) + 0.04, thickness, depthZ, xm, ym, zLine));
      } else {
        const segLen = Math.hypot(dx, dy) + 0.08;
        const g = new THREE.BoxGeometry(segLen, thickness, depthZ);
        g.rotateZ(Math.atan2(dy, dx));
        g.translate(xm, ym, zLine);
        geos.push(g);
      }
    }
  };

  // Avenidas Norte-Sul (28m de largura, de Z = -1312 até a Avenida Beira-Mar Z = 710 — 100% contínuas!)
  for (const ax of mainAvenuesX) {
    world.mapRoads.push({ x: ax, z: -301, w: 28, d: 2022, isMain: true });

    if (ax !== 0) {
      pushTerrainLineZ(yellowGeos, ax - 0.5, 0.45, -1312, 710, 12);
      pushTerrainLineZ(yellowGeos, ax + 0.5, 0.45, -1312, 710, 12);
    } else {
      // Na Av. Central X = 0, desenha as faixas fora da rampa central do Viaduto 1 (Z = -374..-286)
      pushTerrainLineZ(yellowGeos, -0.5, 0.45, -1312, -388, 12);
      pushTerrainLineZ(yellowGeos, 0.5, 0.45, -1312, -388, 12);
      pushTerrainLineZ(yellowGeos, -0.5, 0.45, -280, 710, 12);
      pushTerrainLineZ(yellowGeos, 0.5, 0.45, -280, 710, 12);
    }

    // Canteiros centrais arborizados acompanhando a inclinação da rua!
    for (const segZ of [-316, -58, 68, 556]) {
      if ((ax === 0 && (segZ === -316 || segZ === -58)) || (ax === 252 && (segZ === -58 || segZ === 556))) continue;
      pushTerrainLineZ(medianGeos, ax, 2.6, segZ - 34, segZ + 34, 12, 0.55, 0.06);
      pushTerrainLineZ(turfGeos, ax, 1.8, segZ - 32, segZ + 32, 12, 0.14, 0.36);

      const ty1 = sampleRoadY(ax, segZ - 20) + 0.38;
      const ty2 = sampleRoadY(ax, segZ + 20) + 0.38;
      world._addLegoTree(ax, ty1, segZ - 20, 1.0);
      world._addLegoTree(ax, ty2, segZ + 20, 1.0);
    }
  }

  // Avenidas Leste-Oeste (100% inteiras em Z = +134 e todas as demais!)
  for (const az of mainAvenuesZ) {
    const minX = az === 710 ? -1815 : -516;
    const maxX = az <= 134 ? 1616 : az === 710 ? 640 : 1200;
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: az, w: roadW, d: 28, isMain: true });

    pushTerrainLineX(yellowGeos, az - 0.5, 0.45, minX + 5, 526 - 5, 12);
    pushTerrainLineX(yellowGeos, az + 0.5, 0.45, minX + 5, 526 - 5, 12);

    if (maxX > 600) {
      pushTerrainLineX(yellowGeos, az - 0.5, 0.45, 599, maxX - 5, 12);
      pushTerrainLineX(yellowGeos, az + 0.5, 0.45, 599, maxX - 5, 12);
    }
  }

  // Ruas Secundárias Norte-Sul
  for (const sx of secondaryStreetsX) {
    if (sx === -648) {
      world.mapRoads.push({ x: sx, z: -912, w: 24, d: 800, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, -512, 12);
      world.mapRoads.push({ x: sx, z: 562, w: 24, d: 296, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, 414, 710, 12);
    } else if (sx === 648) {
      world.mapRoads.push({ x: sx, z: -912, w: 24, d: 800, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, -512, 12);
    } else {
      world.mapRoads.push({ x: sx, z: -301, w: 24, d: 2022, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, -1312, 710, 12);
    }
  }

  // Avenidas Táticas Norte-Sul do Domínio Industrial Leste
  for (const ix of [600, 768, 964, 1160, 1344, 1524]) {
    const minZ = -1312;
    const maxZ = 134;
    const d = maxZ - minZ;
    const cz = (minZ + maxZ) * 0.5;
    world.mapRoads.push({ x: ix, z: cz, w: 24, d, isMain: false });
    pushTerrainLineZ(whiteGeos, ix, 0.35, minZ, maxZ, 16);
  }

  // Ruas Secundárias Leste-Oeste
  for (const sz of secondaryStreetsZ) {
    const minX = -648;
    const maxX = sz >= -1172 && sz <= -512 ? 1616 : 526;
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: sz, w: roadW, d: 24, isMain: false });

    pushTerrainLineX(whiteGeos, sz, 0.35, minX + 6, 520, 12);
    if (maxX > 600) {
      pushTerrainLineX(whiteGeos, sz, 0.35, 600, maxX - 6, 16);
    }
  }

  // Faixas de Pedestres e Semáforos 3D nos cruzamentos principais do Centro (adaptados à cota de cada cruzamento!)
  for (const ix of [-384, -252, -120, 120, 252, 384]) {
    for (const iz of [-382, -250, -117, 0, 134]) {
      for (let s = -10; s <= 10; s += 2.5) {
        const yn = sampleRoadY(ix + s, iz - 16.0) + 0.055;
        const ys = sampleRoadY(ix + s, iz + 16.0) + 0.055;
        whiteGeos.push(
          makeFastBox(1.2, 0.045, 4.2, ix + s, yn, iz - 16.0),
          makeFastBox(1.2, 0.045, 4.2, ix + s, ys, iz + 16.0)
        );
      }

      const tx = ix + 15.2;
      const tz = iz + 15.2;
      const baseTY = sampleRoadY(tx, tz) + 0.28;
      poleGeos.push(
        makeFastBox(0.38, 6.2, 0.38, tx, baseTY + 3.1, tz),
        makeFastBox(3.8, 0.24, 0.24, tx - 1.8, baseTY + 5.9, tz),
        makeFastBox(0.55, 1.3, 0.55, tx - 3.2, baseTY + 5.6, tz)
      );
    }
  }

  addChunkedArrayToScene(
    world.scene,
    yellowGeos,
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    }),
    { receiveShadow: false }
  );
  addChunkedArrayToScene(
    world.scene,
    whiteGeos,
    new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2
    }),
    { receiveShadow: false }
  );
  addChunkedArrayToScene(
    world.scene,
    medianGeos,
    new THREE.MeshStandardMaterial({ color: LEGO_COLORS.concrete, roughness: 0.5 }),
    { receiveShadow: true }
  );
  addChunkedArrayToScene(
    world.scene,
    turfGeos,
    new THREE.MeshStandardMaterial({ color: LEGO_COLORS.green, roughness: 0.5 }),
    { receiveShadow: true }
  );
  addChunkedArrayToScene(world.scene, poleGeos, getLegoMaterial(LEGO_COLORS.charcoal), {
    receiveShadow: false
  });
}
