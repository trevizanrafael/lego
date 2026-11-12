// Leito dos trilhos, rampas dos portais e estrutura elevada.
import * as THREE from 'three';

// ============================================================================
// 6. TRILHOS CONTÍNUOS, LINHA ELEVADA (`Y = +14.2m`) & 3 ESTAÇÕES ELEVADAS GRANDES
// ============================================================================
export function buildTrackBedAndElevatedManhattanStructure(world, batcher, spline) {
  const step = 6.0;
  const count = Math.floor(spline.totalLength / step);
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();
  const tan = new THREE.Vector3();

  const crossAvenuesX = [-516, -384, -252, -120, 0, 120, 252, 384, 516];
  const crossAvenuesZ = [-250, -117, 0, 134, 402, 556, 710];

  for (let i = 0; i < count; i++) {
    const s0 = i * step;
    const s1 = (i + 1) * step;
    spline.sampleAtS(s0, posA, tan);
    spline.sampleAtS(s1, posB);

    const mx = (posA.x + posB.x) * 0.5;
    const my = (posA.y + posB.y) * 0.5;
    const mz = (posA.z + posB.z) * 0.5;
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dz = posB.z - posA.z;
    const horizLen = Math.hypot(dx, dz) || 0.001;
    const segLen = Math.hypot(horizLen, dy) + 0.14;
    const rotY = Math.atan2(dx, dz);
    const rotX = -Math.atan2(dy, horizLen);

    // 1) Dormentes Largos + Trilhos Duplos Prateados para os novos vagões de 4.6m!
    batcher.addOrientedBox('wood_sleeper', 4.4, 0.18, 0.56, mx, my + 0.09, mz, rotX, rotY, 0);
    batcher.addOrientedBox('wood_sleeper', 4.4, 0.18, 0.56, posA.x, posA.y + 0.09, posA.z, rotX, rotY, 0);

    const perpX = Math.cos(rotY);
    const perpZ = -Math.sin(rotY);
    for (const rOff of [-1.35, 1.35]) {
      batcher.addOrientedBox(
        'rail_silver',
        0.18,
        0.24,
        segLen,
        mx + perpX * rOff,
        my + 0.25,
        mz + perpZ * rOff,
        rotX,
        rotY,
        0
      );
    }

    // 2) Rampa Blindada Fechada nos Portais (`my` entre `-11.0m` e `+4.5m`) — Caixa maciça de concreto sob os trilhos!
    if (my > -11.0 && my < 4.5) {
      batcher.addOrientedBox('tunnel_concrete', 7.8, 2.2, segLen + 0.2, mx, my - 1.1, mz, rotX, rotY, 0);
      if (my >= -0.5) {
        for (const gSide of [-3.65, 3.65]) {
          batcher.addOrientedBox(
            'ny_truss_green',
            0.45,
            1.35,
            segLen,
            mx + perpX * gSide,
            my + 0.65,
            mz + perpZ * gSide,
            rotX,
            rotY,
            0
          );
        }
      }
    }

    // 3) ESTRUTURA ELEVADA ESTILO MANHATTAN (`my >= 4.5m` até `+14.2m`)
    if (my >= 4.5) {
      batcher.addOrientedBox('ny_truss_green', 7.2, 1.05, segLen, mx, my - 0.56, mz, rotX, rotY, 0);
      batcher.addOrientedBox('ny_truss_charcoal', 7.6, 0.26, segLen, mx, my - 0.06, mz, rotX, rotY, 0);

      for (const gSide of [-3.55, 3.55]) {
        batcher.addOrientedBox(
          'ny_truss_charcoal',
          0.28,
          0.92,
          segLen,
          mx + perpX * gSide,
          my + 0.46,
          mz + perpZ * gSide,
          rotX,
          rotY,
          0
        );
      }

      if (my >= 8.0 && i % 6 === 0) {
        const mostlyAlongZ = Math.abs(dz) > Math.abs(dx);
        const hitsCrossRoad = mostlyAlongZ
          ? crossAvenuesZ.some((cz) => Math.abs(mz - cz) < 15.0)
          : crossAvenuesX.some((cx) => Math.abs(mx - cx) < 15.0);

        if (!hitsCrossRoad) {
          const groundY = world.getTerrainHeightAt ? Math.max(0, world.getTerrainHeightAt(mx, mz)) : 0;
          const topColY = my - 1.02;
          const colH = topColY - groundY;
          if (colH > 3.0) {
            batcher.addOrientedBox('ny_truss_green', 7.6, 0.95, 1.2, mx, topColY - 0.35, mz, 0, rotY, 0);
            batcher.addBox('ny_truss_charcoal', 1.65, colH + 2.0, 1.65, mx, groundY + colH * 0.5 - 1.0, mz);
            world.addCollider(mx, mz, 1.7, 1.7, topColY, groundY);
          }
        }
      }
    }
  }
}
