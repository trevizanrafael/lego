import * as THREE from 'three';
import { LEGO_COLORS, getLegoMaterial } from '../../materials/LegoMaterials.js';
import { makeFastBox } from '../buildings/GeometryMergeUtils.js';
import {
  IS_SCALED_WORLD,
  ROAD,
  DESIGN_MAIN_AVENUES_X,
  DESIGN_MAIN_AVENUES_Z,
  DESIGN_SECONDARY_STREETS_X,
  DESIGN_INDUSTRIAL_STREETS_X,
  DESIGN_SECONDARY_STREETS_Z,
  MAIN_AVENUES_X,
  MAIN_AVENUES_Z,
  SECONDARY_STREETS_X,
  INDUSTRIAL_STREETS_X,
  SECONDARY_STREETS_Z,
  ws
} from '../core/WorldLayoutScale.js';
import { getUrbanCityReliefY } from './UrbanReliefFunctions.js';
import {
  RIVER_BRIDGE_SPECS,
  PANGAEA_BRIDGE_SPECS,
  RIVER_PIER_SPECS,
  addChunkedArrayToScene
} from './BridgeAndPierSpecs.js';
import { buildScaledUrbanSidewalksAndBlockPads } from './UrbanSidewalkAndBlockBuilder.js';

export {
  RIVER_BRIDGE_SPECS,
  PANGAEA_BRIDGE_SPECS,
  RIVER_PIER_SPECS,
  MAIN_AVENUES_X,
  MAIN_AVENUES_Z,
  SECONDARY_STREETS_X,
  INDUSTRIAL_STREETS_X,
  SECONDARY_STREETS_Z,
  ROAD
};

/**
 * MALHA VIÁRIA URBANA UNIFICADA COM ADAPTAÇÃO TOTAL AO RELEVO + CALÇADAS REAIS DE 10m (3x):
 * - Todas as faixas, faixas de pedestres, canteiros e semáforos acompanham `getUrbanCityReliefY(x, z)`!
 */
export function buildUrbanRoadGridAndMedians(world) {
  const mainW = ROAD.mainWidth;
  const secW = ROAD.secondaryWidth;
  const lineStep = IS_SCALED_WORLD ? 24 : 12;

  const yellowGeos = [];
  const whiteGeos = [];
  const medianGeos = [];
  const turfGeos = [];
  const poleGeos = [];

  const sampleRoadY = (x, z) => getUrbanCityReliefY(x, z);

  const pushTerrainLineZ = (geos, xLine, widthX, zFrom, zTo, stepSize = lineStep, thickness = 0.045, yOff = 0.055) => {
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

  const pushTerrainLineX = (geos, zLine, depthZ, xFrom, xTo, stepSize = lineStep, thickness = 0.045, yOff = 0.055) => {
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

  // Avenidas Norte-Sul (Z = ws(-1312) até a Avenida Beira-Mar Z = ws(710))
  const zAveMin = ws(-1312);
  const zAveMax = ws(710);
  const zAveCenter = (zAveMin + zAveMax) * 0.5;
  const zAveSpan = zAveMax - zAveMin;
  const zRampGapTop = ws(-382) - 6;
  const zRampGapBot = ws(-382) + 102;

  for (const dax of DESIGN_MAIN_AVENUES_X) {
    const ax = ws(dax);
    world.mapRoads.push({ x: ax, z: zAveCenter, w: mainW, d: zAveSpan, isMain: true });

    if (dax !== 0) {
      pushTerrainLineZ(yellowGeos, ax - 0.5, 0.45, zAveMin, zAveMax, lineStep);
      pushTerrainLineZ(yellowGeos, ax + 0.5, 0.45, zAveMin, zAveMax, lineStep);
    } else {
      pushTerrainLineZ(yellowGeos, -0.5, 0.45, zAveMin, zRampGapTop, lineStep);
      pushTerrainLineZ(yellowGeos, 0.5, 0.45, zAveMin, zRampGapTop, lineStep);
      pushTerrainLineZ(yellowGeos, -0.5, 0.45, zRampGapBot, zAveMax, lineStep);
      pushTerrainLineZ(yellowGeos, 0.5, 0.45, zRampGapBot, zAveMax, lineStep);
    }

    for (const dSegZ of [-316, -58, 68, 556]) {
      if ((dax === 0 && (dSegZ === -316 || dSegZ === -58)) || (dax === 252 && (dSegZ === -58 || dSegZ === 556))) continue;
      const segZ = ws(dSegZ);
      pushTerrainLineZ(medianGeos, ax, 2.6, segZ - 34, segZ + 34, 12, 0.55, 0.06);
      pushTerrainLineZ(turfGeos, ax, 1.8, segZ - 32, segZ + 32, 12, 0.14, 0.36);

      const ty1 = sampleRoadY(ax, segZ - 20) + 0.38;
      const ty2 = sampleRoadY(ax, segZ + 20) + 0.38;
      world._addLegoTree(ax, ty1, segZ - 20, 1.0);
      world._addLegoTree(ax, ty2, segZ + 20, 1.0);
    }
  }

  // Avenidas Leste-Oeste
  for (const daz of DESIGN_MAIN_AVENUES_Z) {
    const az = ws(daz);
    const minX = ws(daz === 710 ? -1815 : -516);
    const maxX = ws(daz <= 134 ? 1616 : daz === 710 ? 640 : 1200);
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: az, w: roadW, d: mainW, isMain: true });

    pushTerrainLineX(yellowGeos, az - 0.5, 0.45, minX + 5, ws(526) - 5, lineStep);
    pushTerrainLineX(yellowGeos, az + 0.5, 0.45, minX + 5, ws(526) - 5, lineStep);

    if (maxX > ws(600)) {
      pushTerrainLineX(yellowGeos, az - 0.5, 0.45, ws(599), maxX - 5, lineStep);
      pushTerrainLineX(yellowGeos, az + 0.5, 0.45, ws(599), maxX - 5, lineStep);
    }
  }

  // Ruas Secundárias Norte-Sul
  for (const dsx of DESIGN_SECONDARY_STREETS_X) {
    const sx = ws(dsx);
    if (dsx === -648) {
      world.mapRoads.push({ x: sx, z: ws(-912), w: secW, d: ws(800), isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, ws(-1312), ws(-512), lineStep);
      world.mapRoads.push({ x: sx, z: ws(562), w: secW, d: ws(296), isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, ws(414), ws(710), lineStep);
    } else if (dsx === 648) {
      world.mapRoads.push({ x: sx, z: ws(-912), w: secW, d: ws(800), isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, ws(-1312), ws(-512), lineStep);
    } else {
      world.mapRoads.push({ x: sx, z: zAveCenter, w: secW, d: zAveSpan, isMain: false });
      pushTerrainLineZ(whiteGeos, sx, 0.35, zAveMin, zAveMax, lineStep);
    }
  }

  // Avenidas Táticas Norte-Sul do Domínio Industrial Leste
  for (const dix of DESIGN_INDUSTRIAL_STREETS_X) {
    const ix = ws(dix);
    const minZ = ws(-1312);
    const maxZ = ws(134);
    const d = maxZ - minZ;
    const cz = (minZ + maxZ) * 0.5;
    world.mapRoads.push({ x: ix, z: cz, w: secW, d, isMain: false });
    pushTerrainLineZ(whiteGeos, ix, 0.35, minZ, maxZ, IS_SCALED_WORLD ? 28 : 16);
  }

  // Ruas Secundárias Leste-Oeste
  for (const dsz of DESIGN_SECONDARY_STREETS_Z) {
    const sz = ws(dsz);
    const minX = ws(-648);
    const maxX = ws(dsz >= -1172 && dsz <= -512 ? 1616 : 526);
    const roadW = maxX - minX;
    const roadCX = (minX + maxX) * 0.5;
    world.mapRoads.push({ x: roadCX, z: sz, w: roadW, d: secW, isMain: false });

    pushTerrainLineX(whiteGeos, sz, 0.35, minX + 6, ws(520), lineStep);
    if (maxX > ws(600)) {
      pushTerrainLineX(whiteGeos, sz, 0.35, ws(600), maxX - 6, IS_SCALED_WORLD ? 28 : 16);
    }
  }

  // Faixas de Pedestres e Semáforos 3D nos cruzamentos principais do Centro
  const cwHalf = IS_SCALED_WORLD ? 12.5 : 10;
  const cwOff = mainW * 0.5 + 2.0; // 16.0 em 1x, 19.0 em 3x
  const poleOff = IS_SCALED_WORLD ? mainW * 0.5 + 1.8 : 15.2;

  for (const dix of [-384, -252, -120, 120, 252, 384]) {
    const ix = ws(dix);
    for (const diz of [-382, -250, -117, 0, 134]) {
      const iz = ws(diz);
      for (let s = -cwHalf; s <= cwHalf; s += 2.5) {
        const yn = sampleRoadY(ix + s, iz - cwOff) + 0.055;
        const ys = sampleRoadY(ix + s, iz + cwOff) + 0.055;
        whiteGeos.push(
          makeFastBox(1.2, 0.045, 4.2, ix + s, yn, iz - cwOff),
          makeFastBox(1.2, 0.045, 4.2, ix + s, ys, iz + cwOff)
        );
        if (IS_SCALED_WORLD) {
          const yw = sampleRoadY(ix - cwOff, iz + s) + 0.055;
          const ye = sampleRoadY(ix + cwOff, iz + s) + 0.055;
          whiteGeos.push(
            makeFastBox(4.2, 0.045, 1.2, ix - cwOff, yw, iz + s),
            makeFastBox(4.2, 0.045, 1.2, ix + cwOff, ye, iz + s)
          );
        }
      }

      const tx = ix + poleOff;
      const tz = iz + poleOff;
      const baseTY = sampleRoadY(tx, tz) + ROAD.curbHeight;
      poleGeos.push(
        makeFastBox(0.38, 6.2, 0.38, tx, baseTY + 3.1, tz),
        makeFastBox(3.8, 0.24, 0.24, tx - 1.8, baseTY + 5.9, tz),
        makeFastBox(0.55, 1.3, 0.55, tx - 3.2, baseTY + 5.6, tz)
      );
    }
  }

  // Calçadas reais de 10m + guias de 0.18m + rampas de esquina + miolos lisos (apenas em escala > 1x)
  if (IS_SCALED_WORLD) {
    buildScaledUrbanSidewalksAndBlockPads(world);
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
