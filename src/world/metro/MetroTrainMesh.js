// Modelo 3D dos vagões do trem.
import * as THREE from 'three';
import { mergeBufferGeometries, makeTranslatedBox } from '../BuildingGenerator.js';

// ============================================================================
// 7. VAGÕES DO METRÔ AMPLIADOS (`4.6m` LARGURA, `4.5m` ALTURA INTERNA, PORTAS `2.8m`!)
// ============================================================================
export function createLegoMetroCarMesh(isFrontCab, isRearCab, materials) {
  const group = new THREE.Group();
  const carW = 4.6;         // 4.6m de largura!
  const carLen = 13.6;      // 13.6m de comprimento!
  const floorY = 0.65;      // Alinhado cravado com -10.5m no subsolo e +14.85m nas estações elevadas!
  const clearInnerH = 4.5;  // 4.5m de altura interna livre!
  const roofBottomY = floorY + clearInnerH; // 5.15m
  const roofTopY = roofBottomY + 0.28;      // 5.43m

  const staticSilver = [];
  const staticCyan = [];
  const staticYellow = [];
  const staticDark = [];
  const staticSeat = [];
  const staticGlass = [];
  const staticLight = [];

  // 1) Truques Ferroviários + Chassi + Piso Interno LEGO + Teto Alto Prateado
  staticDark.push(
    makeTranslatedBox(3.4, 0.44, 2.8, 0, 0.24, -4.2),
    makeTranslatedBox(3.4, 0.44, 2.8, 0, 0.24, 4.2),
    makeTranslatedBox(carW - 0.12, 0.22, carLen, 0, floorY - 0.12, 0)
  );
  staticSilver.push(
    makeTranslatedBox(carW, 0.16, carLen, 0, floorY, 0),
    makeTranslatedBox(carW, 0.28, carLen, 0, roofBottomY + 0.14, 0),
    makeTranslatedBox(carW - 0.7, 0.16, carLen - 0.5, 0, roofTopY + 0.06, 0)
  );

  // Luminárias internas no teto alto (5.1m) — ZERO barra no meio do corredor para não atrapalhar a câmera!
  staticLight.push(makeTranslatedBox(0.85, 0.1, carLen - 1.8, 0, roofBottomY - 0.06, 0));

  // 2) Paredes Laterais com 2 Vãos Largos de Porta de `2.80m` cada (`z = -2.85` e `z = +2.85`)!
  // Pilares ao longo de Z: [-6.8..-4.25] (2.55m), [-1.45..+1.45] (2.90m), [+4.25..+6.8] (2.55m)
  const wallPillars = [
    { cz: -5.525, len: 2.55 },
    { cz: 0.0, len: 2.9 },
    { cz: 5.525, len: 2.55 }
  ];

  for (const side of [-1, 1]) {
    const wx = side * (carW * 0.5 - 0.1);
    // Verga superior acima das portas amplas (de Y = 4.45m até 5.15m -> vão livre de porta de 3.80m de altura!)
    staticSilver.push(makeTranslatedBox(0.2, 0.68, carLen, wx, roofBottomY - 0.34, 0));
    staticCyan.push(makeTranslatedBox(0.22, 0.22, carLen + 0.02, wx, roofBottomY - 0.56, 0));

    for (const wp of wallPillars) {
      staticSilver.push(makeTranslatedBox(0.2, 1.05, wp.len, wx, floorY + 0.58, wp.cz));
      staticCyan.push(makeTranslatedBox(0.23, 0.28, wp.len + 0.02, wx, floorY + 0.88, wp.cz));
      staticYellow.push(makeTranslatedBox(0.24, 0.13, wp.len + 0.02, wx, floorY + 0.66, wp.cz));
      staticSilver.push(
        makeTranslatedBox(0.2, 2.75, 0.28, wx, floorY + 2.48, wp.cz - wp.len * 0.5 + 0.14),
        makeTranslatedBox(0.2, 2.75, 0.28, wx, floorY + 2.48, wp.cz + wp.len * 0.5 - 0.14)
      );
      staticGlass.push(makeTranslatedBox(0.09, 2.65, wp.len - 0.52, wx, floorY + 2.48, wp.cz));

      // Bancos Internos Azuis LEGO encostados nas janelas laterais (deixando corredor central de 3.3m livres!)
      staticSeat.push(
        makeTranslatedBox(0.56, 0.4, wp.len - 0.3, side * (carW * 0.5 - 0.48), floorY + 0.26, wp.cz),
        makeTranslatedBox(0.16, 0.55, wp.len - 0.3, side * (carW * 0.5 - 0.26), floorY + 0.66, wp.cz)
      );
    }
  }

  // 3) Cabeceiras Frontal (+Z) e Traseira (-Z)
  const addEndBulkhead = (zSign, isCab) => {
    const ez = zSign * (carLen * 0.5 - 0.14);
    if (isCab) {
      staticSilver.push(
        makeTranslatedBox(carW, 1.25, 0.26, 0, floorY + 0.62, ez),
        makeTranslatedBox(carW, 0.72, 0.26, 0, roofBottomY - 0.36, ez),
        makeTranslatedBox(0.55, 2.55, 0.26, -carW * 0.5 + 0.28, floorY + 2.52, ez),
        makeTranslatedBox(0.55, 2.55, 0.26, carW * 0.5 - 0.28, floorY + 2.52, ez)
      );
      staticCyan.push(makeTranslatedBox(carW + 0.04, 0.28, 0.28, 0, floorY + 0.88, ez));
      staticYellow.push(makeTranslatedBox(carW + 0.05, 0.14, 0.29, 0, floorY + 0.66, ez));
      staticGlass.push(makeTranslatedBox(carW - 1.08, 2.45, 0.1, 0, floorY + 2.52, ez));

      const hlMat = zSign > 0 ? materials.headlight : materials.taillight;
      for (const hx of [-1.45, 1.45]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.14), hlMat);
        hl.position.set(hx, floorY + 0.42, ez + zSign * 0.14);
        group.add(hl);
      }
      staticLight.push(makeTranslatedBox(2.0, 0.28, 0.3, 0, roofBottomY - 0.34, ez + zSign * 0.05));
    } else {
      // Passagem larga de 2.4m entre os vagões!
      staticSilver.push(
        makeTranslatedBox(1.05, 4.4, 0.22, -carW * 0.5 + 0.52, floorY + 2.25, ez),
        makeTranslatedBox(1.05, 4.4, 0.22, carW * 0.5 - 0.52, floorY + 2.25, ez),
        makeTranslatedBox(carW, 0.6, 0.22, 0, roofBottomY - 0.3, ez)
      );
      staticDark.push(makeTranslatedBox(2.55, 4.0, 0.72, 0, floorY + 2.05, ez + zSign * 0.38));
    }
  };
  addEndBulkhead(1, isFrontCab);
  addEndBulkhead(-1, isRearCab);

  const addMerged = (geos, mat, castShadow = false) => {
    if (geos.length === 0) return;
    const m = new THREE.Mesh(mergeBufferGeometries(geos), mat);
    for (let i = 0; i < geos.length; i++) geos[i].dispose();
    m.castShadow = castShadow;
    m.receiveShadow = true;
    group.add(m);
  };

  addMerged(staticSilver, materials.silver, true);
  addMerged(staticCyan, materials.cyan, false);
  addMerged(staticYellow, materials.yellow, false);
  addMerged(staticDark, materials.dark, false);
  addMerged(staticSeat, materials.seatBlue, false);
  addMerged(staticGlass, materials.glass, false);
  addMerged(staticLight, materials.interiorLight, false);

  // 4) PORTAS LATERAIS DESLIZANTES AMPLAS DE `2.80m` (2 Folhas de `1.40m` por vão!)
  const leftDoorLeaves = [];
  const rightDoorLeaves = [];

  for (const side of [-1, 1]) {
    const dx = side * (carW * 0.5 - 0.04);
    for (const doorCenterZ of [-2.85, 2.85]) {
      for (const leafDir of [-1, 1]) {
        const baseZ = doorCenterZ + leafDir * 0.7;
        const leafGeos = [
          makeTranslatedBox(0.11, 1.18, 1.4, 0, floorY + 0.62, 0),
          makeTranslatedBox(0.11, 0.42, 1.4, 0, floorY + 3.58, 0),
          makeTranslatedBox(0.11, 2.2, 0.2, 0, floorY + 2.28, -0.6),
          makeTranslatedBox(0.11, 2.2, 0.2, 0, floorY + 2.28, 0.6)
        ];
        const leafMesh = new THREE.Mesh(mergeBufferGeometries(leafGeos), materials.cyan);
        for (let i = 0; i < leafGeos.length; i++) leafGeos[i].dispose();
        const leafWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.12, 1.0), materials.glass);
        leafWin.position.y = floorY + 2.28;
        leafMesh.add(leafWin);
        leafMesh.position.set(dx, 0, baseZ);
        group.add(leafMesh);

        const entry = { mesh: leafMesh, baseZ, slideSign: leafDir };
        if (side > 0) leftDoorLeaves.push(entry);
        else rightDoorLeaves.push(entry);
      }
    }
  }

  return {
    group,
    leftDoorLeaves,
    rightDoorLeaves
  };
}
