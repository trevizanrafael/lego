import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment, resetTestListeners } from './setup-env.js';

setupTestEnvironment();

const { buildDetailedBuilding } = await import('../src/world/buildings/DetailedBuildingBuilder.js');
const { worldSpatialColliderMethods } = await import('../src/world/core/WorldSpatialColliderGrid.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { auditWorldCollisions } = await import('./collision-audit.test.js');

function createIsolatedBuildingWorld() {
  const world = Object.assign(Object.create(worldSpatialColliderMethods), {
    scene: new THREE.Scene(),
    colliders: [],
    _colliderGrid: new Map(),
    _dynamicColliders: [],
    colliderCellSize: 32,
    _colliderQueryId: 0,
    mapBuildings: [],
    getTerrainHeightAt: () => 0
  });
  return world;
}

describe('Onda 2 (C2-E) — Colisão Escalonada Art-Deco, Quinas 45° OBB, Cornijas, Topo & Correção de Limites Y Invertidos', () => {
  let fullScene, fullWorld;

  before(() => {
    resetTestListeners();
    fullScene = new THREE.Scene();
    const hud = new LegoHud(35000);
    hud.isTitleScreenActive = false;
    const destructibles = new DestructibleManager(fullScene, hud);
    fullWorld = new TestBlockWorld(fullScene, destructibles);
  });

  it('1. Arranha-céu Art-Deco (w=24, h=80, d=24, seed=0) tem ar livre ao redor do topo, terraços andáveis e colisores exatos (OBB 45°, cornijas, parapeitos, caixa d\'água e pináculo)', () => {
    const world = createIsolatedBuildingWorld();
    const bx = 40;
    const bz = -60;
    const w = 24;
    const h = 80;
    const d = 24;
    const group = buildDetailedBuilding(world, bx, bz, w, h, d, 'sapphire_glass', { seed: 0 });

    const yBase = 0.28;
    const tier1H = Math.round(h * 0.74 * 10) / 10; // 59.2m
    const tier2H = Math.round(h * 0.16 * 10) / 10; // 12.8m
    const tier2TopY = tier1H + tier2H; // 72.0m
    const cw = w * 0.64; // 15.36m
    const cd = d * 0.64; // 15.36m

    // Preserva exatamente os 3 Draw Calls de malha visual (bodyMesh, trimMesh, groundMesh)
    const meshes = group.children.filter((c) => c.isMesh);
    assert.equal(meshes.length, 3, 'Mantém os 3 meshes fundidos originais (zero draw calls extras)');

    // A) Ar ao redor da coroa 0.64w (x = bx + 9.8, y = yBase + 75) e do nível médio 0.82w (x = bx + 11.2, y = yBase + 66) é 100% AR LIVRE!
    const crownAirHits = world.overlapCapsule({ x: bx + 9.8, y: yBase + 75, z: bz }, 0.45, 1.85);
    assert.equal(crownAirHits.length, 0, 'Zero colisores invisíveis no ar ao redor da coroa 0.64w');

    const tier2AirHits = world.overlapCapsule({ x: bx + 11.2, y: yBase + 66, z: bz }, 0.45, 1.85);
    assert.equal(tier2AirHits.length, 0, 'Zero colisores invisíveis no ar ao redor do nível intermediário 0.82w');

    // Raycast vertical em x = bx + 9.8 passa direto pelo ar da coroa sem bater em yBase + 80
    const crownAirRay = world.raycast3D(
      { x: bx + 9.8, y: yBase + 78, z: bz },
      { x: bx + 9.8, y: yBase + 73, z: bz }
    );
    assert.equal(crownAirRay.hit, false, 'Raio vertical em x = bx + 9.8 atravessa livremente o ar ao lado da coroa');

    // Raycast vertical completo em x = bx + 9.8 pousa na cornija/terraço do Nível 2 (~yBase + tier2TopY + 0.48)
    const tier2TerraceRay = world.raycast3D(
      { x: bx + 9.8, y: yBase + 78, z: bz },
      { x: bx + 9.8, y: yBase, z: bz }
    );
    assert.equal(tier2TerraceRay.hit, true);
    assert.ok(
      Math.abs(tier2TerraceRay.point.y - (yBase + tier2TopY + 0.48)) < 0.05,
      `Esperava impacto no terraço/cornija do Tier 2 em ${yBase + tier2TopY + 0.48}, obteve ${tier2TerraceRay.point.y}`
    );
    assert.equal(tier2TerraceRay.normal.y, 1);

    // Raycast vertical em x = bx + 11.2 atravessa coroa + Tier 2 e pousa no terraço/cornija do Tier 1 (~yBase + tier1H + 0.58)
    const tier1TerraceRay = world.raycast3D(
      { x: bx + 11.2, y: yBase + 78, z: bz },
      { x: bx + 11.2, y: yBase, z: bz }
    );
    assert.equal(tier1TerraceRay.hit, true);
    assert.ok(
      Math.abs(tier1TerraceRay.point.y - (yBase + tier1H + 0.58)) < 0.05,
      `Esperava impacto no terraço/cornija do Tier 1 em ${yBase + tier1H + 0.58}, obteve ${tier1TerraceRay.point.y}`
    );
    assert.equal(tier1TerraceRay.normal.y, 1);

    // B) Pilares de quina chanfrados em 45° (OBB), aletas brutalistas, cornijas horizontais e marquises térreas
    const obbPillars = world.colliders.filter((c) => c.shapeType === 'obb');
    assert.equal(obbPillars.length, 4, '4 pilares de quina OBB rotacionados em 45°');
    const neCornerX = bx + w * 0.5 - 0.22;
    const neCornerZ = bz - d * 0.5 + 0.22;
    const cornerRay = world.raycast3D(
      { x: neCornerX + 2.0, y: yBase + 15, z: neCornerZ - 0.1 },
      { x: neCornerX, y: yBase + 15, z: neCornerZ }
    );
    assert.equal(cornerRay.hit, true, 'Raycast atinge o pilar de quina chanfrado em 45°');
    assert.equal(cornerRay.collider.shapeType, 'obb');
    assert.ok(
      Math.abs(Math.abs(cornerRay.normal.x) - Math.SQRT1_2) < 0.05 &&
      Math.abs(Math.abs(cornerRay.normal.z) - Math.SQRT1_2) < 0.05,
      `Normal chanfrada a 45° esperada (~0.707), obteve (${cornerRay.normal.x.toFixed(3)}, ${cornerRay.normal.z.toFixed(3)})`
    );

    // Aleta brutalista central (0.75 x d+0.72) e cornija horizontal intermediária (cy = 22)
    const finHits = world.overlapCapsule({ x: bx, y: yBase + 15, z: bz - (d * 0.5 + 0.25) }, 0.15, 1.5);
    assert.ok(finHits.length >= 1, 'Aleta vertical brutalista central possui colisão');
    const besideFinHits = world.overlapCapsule({ x: bx + 3.5, y: yBase + 15, z: bz - (d * 0.5 + 0.25) }, 0.1, 1.5);
    assert.equal(besideFinHits.length, 0, 'Fachada recuada ao lado da aleta central não tem falso bloco inflado');

    const corniceRay = world.raycast3D(
      { x: bx + w * 0.5 + 0.35, y: yBase + 24, z: bz + 3.0 },
      { x: bx + w * 0.5 + 0.35, y: yBase + 20, z: bz + 3.0 }
    );
    assert.equal(corniceRay.hit, true, 'Cornija horizontal saliente em cy=22 possui colisão');
    assert.ok(Math.abs(corniceRay.point.y - (yBase + 22.48)) < 0.05);

    const canopyRay = world.raycast3D(
      { x: bx, y: yBase + 6.2, z: bz - (d * 0.5 + 1.05) },
      { x: bx, y: yBase + 4.2, z: bz - (d * 0.5 + 1.05) }
    );
    assert.equal(canopyRay.hit, true, 'Marquise comercial do térreo possui colisão');
    assert.ok(Math.abs(canopyRay.point.y - (yBase + 5.38)) < 0.05);

    // C) Parapeitos da coroa, casas de máquinas, caixa d'água cilíndrica e pináculo gótico-industrial
    const roofY = yBase + h;
    const parapetRay = world.raycast3D(
      { x: bx, y: roofY + 0.8, z: bz },
      { x: bx, y: roofY + 0.8, z: bz - cd * 0.5 - 1.0 }
    );
    assert.equal(parapetRay.hit, true, 'Mureta (parapeito) norte no topo da coroa possui colisão');

    const hvacHits = world.overlapCapsule(
      { x: bx - cw * 0.2, y: roofY + 0.5, z: bz - cd * 0.18 },
      0.4,
      1.8
    );
    assert.ok(hvacHits.length >= 1, 'Casa de máquinas / HVAC no topo possui colisão');

    const wtX = bx + cw * 0.2;
    const wtZ = bz + cd * 0.18;
    const wtRay = world.raycast3D(
      { x: wtX + 3.2, y: roofY + 3.0, z: wtZ },
      { x: wtX, y: roofY + 3.0, z: wtZ }
    );
    assert.equal(wtRay.hit, true, 'Caixa d\'água cilíndrica no topo possui colisão');
    assert.equal(wtRay.collider.shapeType, 'cylinder');
    assert.ok(Math.abs(wtRay.collider.radius - 1.72) < 1e-6);

    const spireBaseRay = world.raycast3D(
      { x: bx + 3.0, y: roofY + 2.5, z: bz },
      { x: bx, y: roofY + 2.5, z: bz }
    );
    assert.equal(spireBaseRay.hit, true, 'Base piramidal/cilíndrica do pináculo possui colisão');
    assert.equal(spireBaseRay.collider.shapeType, 'cylinder');

    const spireMastRay = world.raycast3D(
      { x: bx + 2.0, y: roofY + 12.0, z: bz },
      { x: bx, y: roofY + 12.0, z: bz }
    );
    assert.equal(spireMastRay.hit, true, 'Mastro superior do pináculo gótico-industrial possui colisão');
    assert.equal(spireMastRay.collider.shapeType, 'cylinder');
  });

  it('2. TestBlockWorld completo passa em auditWorldCollisions com ZERO colisores inválidos (5 minY>maxY corrigidos) e ZERO over-boxes de setbacks Art-Deco', () => {
    const report = auditWorldCollisions(fullWorld, { log: false });

    assert.equal(
      report.invalidColliders.length,
      0,
      `Esperava 0 colisores inválidos, encontrou: ${JSON.stringify(report.invalidColliders)}`
    );
    assert.equal(report.nonFiniteColliders.length, 0, 'Zero colisores NaN/Infinity');
    assert.equal(report.invertedBoundsColliders.length, 0, 'Zero colisores com minY > maxY ou limites invertidos');

    const setbackBugs = report.setbackOverBoxMismatches ?? report.setbackMismatches;
    assert.equal(
      setbackBugs.length,
      0,
      `Esperava 0 over-boxes em prédios Art-Deco escalonados, encontrou: ${JSON.stringify(setbackBugs.slice(0, 5))}`
    );

    // Verifica explicitamente as 4 passarelas blindadas (skybridges) da Ilha da Prisão em Y = 40m (minY = 36.9, maxY = 43.4)
    for (const [sx, sz] of [[1230, 1540], [1520, 1540], [1375, 1687.5], [1375, 1370]]) {
      const skyRay = fullWorld.raycast3D(
        { x: sx, y: 46.0, z: sz },
        { x: sx, y: 34.0, z: sz }
      );
      assert.equal(skyRay.hit, true, `Skybridge blindada em (${sx}, ${sz}) deve ter colisão sólida`);
      assert.ok(
        Math.abs(skyRay.point.y - 43.4) < 0.05 && Math.abs(skyRay.collider.minY - 36.9) < 0.05,
        `Skybridge em (${sx}, ${sz}) deve ter [36.9, 43.4], obteve [${skyRay.collider.minY}, ${skyRay.collider.maxY}]`
      );
    }

    // Verifica explicitamente a verga acima da porta circular do cofre no 4º andar do Super Banco Central
    const vaultLintelCols = fullWorld.colliders.filter(
      (c) => !c.disabled && Math.abs((c.minZ + c.maxZ) * 0.5 - -206) < 0.5 && c.minY > 35 && c.maxX - c.minX <= 13
    );
    assert.equal(vaultLintelCols.length, 1, 'Verga blindada acima da porta do cofre registrada');
    assert.ok(
      vaultLintelCols[0].minY < vaultLintelCols[0].maxY && vaultLintelCols[0].maxY < 40.96,
      `Verga do cofre válida [${vaultLintelCols[0].minY}, ${vaultLintelCols[0].maxY}] e abaixo do terraço (40.96)`
    );
  });
});
