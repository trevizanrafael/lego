// Modelo 3D dos vagões do Metrô LEGO (Etapa 5 — visual moderno).
//
// Estilo: metrô urbano LEGO moderno, seguindo a IDV (preto asfalto + amarelo alerta):
//   - carroceria branca de plástico ABS, saia inferior cinza-escuro e truques pretos com rodas à mostra;
//   - faixa de janelas preta contínua (vidro escuro) e faixa amarela de alerta na altura da cintura;
//   - portas deslizantes amarelas com janela escura;
//   - cabines com frente inclinada, para-choque preto, painel amarelo de alerta, faróis e letreiro "M1";
//   - teto cinza-claro com pinos LEGO e equipamentos de ar-condicionado.
//
// As MEDIDAS e a INTERFACE são as mesmas do vagão anterior (largura 4.6m, comprimento 13.6m, piso a 0.65m,
// teto a ~5.45m, portas de 2.80m em z = ±2.85) — embarque, colisão e teto andável continuam iguais.
import * as THREE from 'three';
import { SHARED_STUD_GEO, markAsSharedAsset } from '../../materials/LegoMaterials.js';
import {
  mergeBufferGeometries,
  mergeColoredGeometries,
  makeTranslatedBox
} from '../BuildingGenerator.js';

const SHARED_METRO_SOLID_VC_MAT = markAsSharedAsset(
  new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0.1 })
);
const SHARED_METRO_BASIC_VC_MAT = markAsSharedAsset(
  new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true })
);

export const METRO_CAR_DIMENSIONS = {
  width: 4.6,
  length: 13.6,
  floorY: 0.65,
  roofTopY: 5.43,
  doorCentersZ: [-2.85, 2.85],
  doorLeafLen: 1.4
};

function boxGeo(w, h, d, x, y, z, rotX = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  g.translate(x, y, z);
  return g;
}

export function createLegoMetroCarMesh(isFrontCab, isRearCab, materials) {
  const group = new THREE.Group();
  const { width: carW, length: carLen, floorY } = METRO_CAR_DIMENSIONS;
  const half = carW * 0.5;
  const roofBottomY = floorY + 4.5; // 5.15m
  const roofTopY = roofBottomY + 0.28; // 5.43m
  const winBottom = floorY + 1.15;
  const winTop = floorY + 3.75;

  const geos = {
    body: [],
    skirt: [],
    black: [],
    yellow: [],
    roof: [],
    glass: [],
    seat: [],
    floor: [],
    light: [],
    glowEntries: []
  };

  // 1) Chassi, piso e truques com rodas à mostra
  geos.skirt.push(makeTranslatedBox(carW - 0.1, 0.42, carLen - 0.2, 0, floorY - 0.22, 0));
  geos.floor.push(makeTranslatedBox(carW - 0.3, 0.1, carLen - 0.3, 0, floorY + 0.02, 0));
  for (const bz of [-4.3, 4.3]) {
    geos.black.push(makeTranslatedBox(3.2, 0.36, 2.9, 0, 0.3, bz));
    for (const wx of [-1.42, 1.42]) {
      for (const wz of [-0.9, 0.9]) {
        const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 14);
        wheel.rotateZ(Math.PI / 2);
        wheel.translate(wx, 0.36, bz + wz);
        geos.black.push(wheel);
      }
    }
  }

  // 2) Paredes laterais: branco embaixo/em cima, faixa de janelas preta e faixa amarela de alerta
  const wallX = half - 0.1;
  // Trechos de parede entre as portas (portas em z = ±2.85 com 2.80m de vão)
  const wallSegs = [
    { cz: -5.525, len: 2.55 },
    { cz: 0.0, len: 2.9 },
    { cz: 5.525, len: 2.55 }
  ];
  for (const side of [-1, 1]) {
    const wx = side * wallX;
    // Verga e faixa alta brancas por cima das portas (contínuas)
    geos.body.push(makeTranslatedBox(0.2, roofBottomY - winTop, carLen, wx, (winTop + roofBottomY) * 0.5, 0));
    for (const ws of wallSegs) {
      // Parte baixa branca + faixa amarela de alerta + faixa preta das janelas
      geos.body.push(makeTranslatedBox(0.2, winBottom - floorY, ws.len, wx, (floorY + winBottom) * 0.5, ws.cz));
      geos.yellow.push(makeTranslatedBox(0.24, 0.26, ws.len + 0.01, wx, floorY + 0.72, ws.cz));
      geos.black.push(
        makeTranslatedBox(0.21, winTop - winBottom, 0.22, wx, (winBottom + winTop) * 0.5, ws.cz - ws.len * 0.5 + 0.11),
        makeTranslatedBox(0.21, winTop - winBottom, 0.22, wx, (winBottom + winTop) * 0.5, ws.cz + ws.len * 0.5 - 0.11)
      );
      geos.glass.push(makeTranslatedBox(0.1, winTop - winBottom - 0.1, ws.len - 0.44, wx, (winBottom + winTop) * 0.5, ws.cz));
      // Bancos internos encostados nas janelas (cinza-escuro com encosto amarelo)
      geos.seat.push(makeTranslatedBox(0.56, 0.4, ws.len - 0.3, side * (half - 0.48), floorY + 0.26, ws.cz));
      geos.yellow.push(makeTranslatedBox(0.16, 0.55, ws.len - 0.3, side * (half - 0.26), floorY + 0.66, ws.cz));
    }
  }

  // 3) Teto: laje cinza-claro, cumeeira e unidades de ar-condicionado; luz interna
  geos.roof.push(
    makeTranslatedBox(carW, 0.28, carLen, 0, roofBottomY + 0.14, 0),
    makeTranslatedBox(carW - 0.8, 0.14, carLen - 0.6, 0, roofTopY + 0.07, 0)
  );
  for (const az of [-3.6, 3.6]) geos.skirt.push(makeTranslatedBox(2.0, 0.36, 2.4, 0, roofTopY + 0.32, az));
  geos.light.push(makeTranslatedBox(0.85, 0.08, carLen - 1.8, 0, roofBottomY - 0.05, 0));

  // 4) Cabeceiras: cabine com frente inclinada (pontas do trem) ou passagem com sanfona preta
  const addEnd = (zSign, isCab) => {
    const ez = zSign * (carLen * 0.5 - 0.14);
    if (isCab) {
      // Frente inclinada: para-brisa escuro inclinado e capô branco
      const tilt = -zSign * 0.32;
      geos.glass.push(boxGeo(carW - 0.7, 2.35, 0.12, 0, floorY + 2.75, ez + zSign * 0.12, tilt));
      geos.body.push(
        boxGeo(carW, 0.5, 0.3, 0, roofBottomY - 0.15, ez - zSign * 0.18),
        makeTranslatedBox(0.36, 2.6, 0.3, -half + 0.18, floorY + 2.7, ez),
        makeTranslatedBox(0.36, 2.6, 0.3, half - 0.18, floorY + 2.7, ez),
        makeTranslatedBox(carW, 1.1, 0.34, 0, floorY + 0.75, ez + zSign * 0.06)
      );
      // Painel amarelo de alerta + para-choque preto + letreiro
      geos.yellow.push(makeTranslatedBox(carW - 0.4, 0.42, 0.12, 0, floorY + 0.98, ez + zSign * 0.25));
      geos.black.push(makeTranslatedBox(carW + 0.06, 0.34, 0.5, 0, floorY + 0.1, ez + zSign * 0.12));
      geos.black.push(makeTranslatedBox(1.9, 0.42, 0.1, 0, roofBottomY - 0.2, ez + zSign * 0.04));
      geos.glowEntries.push({
        geo: makeTranslatedBox(1.7, 0.3, 0.04, 0, roofBottomY - 0.2, ez + zSign * 0.1),
        color: materials.signGlow.color
      });
      const lightMat = zSign > 0 ? materials.headlight : materials.taillight;
      for (const hx of [-1.6, 1.6]) {
        geos.glowEntries.push({
          geo: makeTranslatedBox(0.6, 0.24, 0.1, hx, floorY + 0.55, ez + zSign * 0.26),
          color: lightMat.color
        });
      }
    } else {
      // Passagem entre vagões com sanfona preta
      geos.body.push(
        makeTranslatedBox(1.0, 4.4, 0.22, -half + 0.5, floorY + 2.25, ez),
        makeTranslatedBox(1.0, 4.4, 0.22, half - 0.5, floorY + 2.25, ez),
        makeTranslatedBox(carW, 0.6, 0.22, 0, roofBottomY - 0.3, ez)
      );
      geos.black.push(makeTranslatedBox(2.7, 4.1, 0.75, 0, floorY + 2.1, ez + zSign * 0.4));
    }
  };
  addEnd(1, isFrontCab);
  addEnd(-1, isRearCab);

  const solidEntries = [];
  const pushVc = (list, color) => {
    for (let i = 0; i < list.length; i++) solidEntries.push({ geo: list[i], color });
  };
  pushVc(geos.body, materials.white.color);
  pushVc(geos.skirt, materials.grey.color);
  pushVc(geos.black, materials.dark.color);
  pushVc(geos.yellow, materials.yellow.color);
  pushVc(geos.roof, materials.roof.color);
  pushVc(geos.seat, materials.seat.color);
  pushVc(geos.floor, materials.floor.color);

  if (solidEntries.length > 0) {
    const solidMesh = new THREE.Mesh(mergeColoredGeometries(solidEntries), SHARED_METRO_SOLID_VC_MAT);
    solidMesh.castShadow = true;
    solidMesh.receiveShadow = true;
    group.add(solidMesh);
  }
  for (let i = 0; i < geos.light.length; i++) {
    geos.glowEntries.push({ geo: geos.light[i], color: materials.interiorLight.color });
  }
  if (geos.glowEntries.length > 0) {
    const glowMesh = new THREE.Mesh(mergeColoredGeometries(geos.glowEntries), SHARED_METRO_BASIC_VC_MAT);
    group.add(glowMesh);
  }
  if (geos.glass.length > 0) {
    const glassMesh = new THREE.Mesh(mergeBufferGeometries(geos.glass), materials.glass);
    group.add(glassMesh);
  }

  // 5) Pinos LEGO no teto (2 fileiras ao longo do vagão)
  const studXs = [-1.6, 1.6];
  const studCount = 14;
  const studs = new THREE.InstancedMesh(SHARED_STUD_GEO, materials.roof, studXs.length * studCount);
  const dummy = new THREE.Object3D();
  let si = 0;
  for (const sx of studXs) {
    for (let k = 0; k < studCount; k++) {
      dummy.position.set(sx, roofBottomY + 0.28 + 0.06, -carLen * 0.5 + 0.6 + (k * (carLen - 1.2)) / (studCount - 1));
      dummy.updateMatrix();
      studs.setMatrixAt(si++, dummy.matrix);
    }
  }
  studs.instanceMatrix.needsUpdate = true;
  group.add(studs);

  // 6) PORTAS LATERAIS DESLIZANTES AMARELAS (2 folhas de 1.40m por vão de 2.80m)
  const leftDoorLeaves = [];
  const rightDoorLeaves = [];
  for (const side of [-1, 1]) {
    const dx = side * (half - 0.04);
    for (const doorCenterZ of METRO_CAR_DIMENSIONS.doorCentersZ) {
      for (const leafDir of [-1, 1]) {
        const baseZ = doorCenterZ + leafDir * 0.7;
        const leafEntries = [
          { geo: makeTranslatedBox(0.11, 1.18, 1.4, 0, floorY + 0.62, 0), color: materials.yellow.color },
          { geo: makeTranslatedBox(0.11, 0.5, 1.4, 0, floorY + 3.55, 0), color: materials.yellow.color },
          { geo: makeTranslatedBox(0.11, 2.2, 0.16, 0, floorY + 2.3, -0.62), color: materials.yellow.color },
          { geo: makeTranslatedBox(0.11, 2.2, 0.16, 0, floorY + 2.3, 0.62), color: materials.yellow.color },
          { geo: makeTranslatedBox(0.06, 2.12, 1.06, 0, floorY + 2.3, 0), color: materials.dark.color }
        ];
        const leafMesh = new THREE.Mesh(mergeColoredGeometries(leafEntries), SHARED_METRO_SOLID_VC_MAT);
        leafMesh.position.set(dx, 0, baseZ);
        group.add(leafMesh);

        const entry = { mesh: leafMesh, baseZ, slideSign: leafDir };
        if (side > 0) leftDoorLeaves.push(entry);
        else rightDoorLeaves.push(entry);
      }
    }
  }

  return { group, leftDoorLeaves, rightDoorLeaves };
}
