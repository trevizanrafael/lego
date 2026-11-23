import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment, resetTestListeners } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { Minifigure } = await import('../src/entities/Minifigure.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { ThirdPersonController } = await import('../src/controls/ThirdPersonController.js');
const { TERRITORY_ZONES } = await import('../src/world/factions/TerritoryZonesAndConfigs.js');
const { ws, wsP } = await import('../src/world/core/WorldLayoutScale.js');
const {
  FAVELA_LOD1_DISTANCE,
  getFavelaEastBorderX,
  getFavelaElevation,
  createFavelaWallAtlasTexture
} = await import('../src/world/regions/favela-cdd/FavelaElevationAndBatcher.js');

describe('M7 — Favela CDD Parede-com-Parede & THREE.LOD 2 Níveis: <40 Meshes, >=82% Cobertura Core & -70% Triângulos Distantes', () => {
  let scene;
  let camera;
  let hud;
  let destructibles;
  let world;
  let controller;

  before(() => {
    resetTestListeners();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 3100);
    hud = new LegoHud(25000);
    hud.isTitleScreenActive = false;
    destructibles = new DestructibleManager(scene, hud);
    world = new TestBlockWorld(scene, destructibles);
    const fig = new Minifigure('cv_marretao');
    scene.add(fig.root);
    const domEl = globalThis.document.getElementById('game-container');
    controller = new ThirdPersonController(camera, domEl, fig, world, destructibles, hud);
  });

  it('1. Orçamento estrito (< 40 meshes totais e ativos na Favela), 5 THREE.LOD de 2 níveis cortando >= 65% dos triângulos distantes e Atlas 512x512', () => {
    const allFavelaMeshes = [];
    const activeFavelaMeshes = [];
    const hillChunks = [];
    const favelaLods = [];

    scene.traverse((obj) => {
      if (obj?.isLOD && obj.userData?.isFavelaLod) favelaLods.push(obj);
      if (obj?.isMesh && obj.userData?.isFavelaMesh) {
        allFavelaMeshes.push(obj);
        if (obj.userData.isFavelaHillChunk) hillChunks.push(obj);
      }
    });
    scene.traverseVisible((obj) => {
      if (obj?.isMesh && obj.userData?.isFavelaMesh) activeFavelaMeshes.push(obj);
    });

    const fxMeshCount =
      (world.favelaSoccerFloodCones?.length || 0) +
      (world.favelaBaileSkytrackers?.length || 0) +
      (world.favelaSummitBeacons?.length || 0);

    assert.equal(hillChunks.length, 5, `Colina da CDD dividida em 5 faixas Z (atual: ${hillChunks.length})`);
    assert.equal(favelaLods.length, 5, `5 objetos THREE.LOD por faixa Z na Favela (atual: ${favelaLods.length})`);
    assert.ok(activeFavelaMeshes.length <= 24, `Meshes estáticos visíveis da Favela <= 24 (atual: ${activeFavelaMeshes.length})`);
    assert.ok(allFavelaMeshes.length + fxMeshCount < 40, `Total absoluto de meshes da Favela (incluindo LOD1 oculto + FX) < 40 (atual: ${allFavelaMeshes.length + fxMeshCount})`);

    let sumL0Tris = 0, sumL1Tris = 0;
    for (const lod of favelaLods) {
      assert.equal(lod.levels.length, 2, 'Cada faixa Z da Favela possui exatamente 2 níveis de LOD');
      assert.equal(lod.levels[0].distance, 0);
      assert.equal(lod.levels[1].distance, FAVELA_LOD1_DISTANCE);
      assert.equal(lod.levels[0].object.visible, true);
      assert.equal(lod.levels[1].object.visible, false);
      sumL0Tris += lod.userData.l0Triangles || 0;
      sumL1Tris += lod.userData.l1Triangles || 0;
    }
    assert.ok(
      sumL1Tris > 0 && sumL1Tris <= sumL0Tris * 0.34,
      `LOD1 distante deve cortar >= 66% dos triângulos das construções (L0=${sumL0Tris} vs L1=${sumL1Tris})`
    );

    // Verifica comutação real do THREE.LOD: perto do Baile (L0) vs Centro Financeiro distante (L1)
    const baile = wsP(-715, -135);
    camera.position.set(baile.x, 30, baile.z);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    for (const lod of favelaLods) lod.update(camera);
    assert.ok(favelaLods.some((l) => l.levels[0].object.visible), 'Perto do Baile, a faixa Z local permanece em LOD0 detalhado');

    camera.position.set(0, 12, ws(-117));
    camera.updateMatrixWorld(true);
    for (const lod of favelaLods) lod.update(camera);
    assert.ok(favelaLods.every((l) => l.levels[1].object.visible && !l.levels[0].object.visible), 'Do Centro Financeiro, todas as 5 faixas usam LOD1 leve');

    // Restaura estado padrão L0 visível / L1 oculto
    for (const lod of favelaLods) { lod.levels[0].object.visible = true; lod.levels[1].object.visible = false; }

    for (const hm of hillChunks) {
      assert.ok(hm.geometry.boundingSphere.radius < 1500, `Raio compacto do chunk Z < 1500m`);
      const colAttr = hm.geometry.attributes.color;
      let sumRedExcess = 0;
      for (let i = 0; i < colAttr.count; i++) sumRedExcess += colAttr.getX(i) - colAttr.getY(i);
      assert.ok(sumRedExcess / colAttr.count < 0.04, 'Terreno sem marrom/vermelho chapado');
    }

    const atlas = createFavelaWallAtlasTexture();
    assert.equal(atlas.image.width, 512);
    assert.equal(atlas.image.height, 512);
  });

  it('2. Orientação orgânica (< 30% alinhadas a 0°/90°) e larguras realistas de barraco/sobrado (median w <= 8.5m, >= 2,400 lotes)', () => {
    const favelaParcels = (world.mapBuildings || []).filter((b) => b.isFavelaParcel);
    assert.ok(
      favelaParcels.length >= 2400 && favelaParcels.length <= 3300,
      `Deve gerar 2.400 a 3.300 lotes orgânicos parede-com-parede (atual: ${favelaParcels.length})`
    );

    const deg5Sin2 = Math.sin((10 * Math.PI) / 180);
    let axisAlignedCount = 0;
    const widths = [];
    for (let i = 0; i < favelaParcels.length; i++) {
      const p = favelaParcels[i];
      widths.push(p.w);
      if (Math.abs(Math.sin(2 * (p.rotY || 0))) < deg5Sin2) axisAlignedCount++;
    }

    const axisRatio = axisAlignedCount / favelaParcels.length;
    assert.ok(axisRatio < 0.30, `< 30% alinhadas em ±5° de 0°/90° (atual: ${(axisRatio * 100).toFixed(1)}%)`);

    widths.sort((a, b) => a - b);
    const medianW = widths[Math.floor(widths.length * 0.5)];
    assert.ok(medianW >= 5.5 && medianW <= 8.5, `Largura mediana realista em [5.5..8.5]m (atual: ${medianW.toFixed(2)}m)`);
  });

  it('3. Tecido Parede-com-Parede: cobertura urbanizada >= 82% e casas diretas >= 70% na encosta central da CDD', () => {
    const { circulation, parcelIndex } = world.favelaCDDData;
    assert.ok(circulation && parcelIndex, 'Índices espaciais de becos e lotes da CDD disponíveis');

    const cellSize = 32;
    const halfCell = cellSize * 0.5;
    let totalCells = 0, occupiedCells = 0, houseCells = 0;

    for (let z = ws(-510) + halfCell; z <= ws(410) - halfCell; z += cellSize) {
      if (Math.abs(z) < 42) continue;
      const xMax = getFavelaEastBorderX(z) - 16 - halfCell;
      for (let x = ws(-965) + halfCell; x <= xMax; x += cellSize) {
        if (getFavelaElevation(x, z) < 0.9) continue;
        totalCells++;
        const hasHouse = parcelIndex.hasObbInCell(x, z, halfCell);
        const hasWayOrLandmark = circulation.hasCirculationOrLandmarkAt(x, z, halfCell);
        if (hasHouse) houseCells++;
        if (hasHouse || hasWayOrLandmark) occupiedCells++;
      }
    }

    const coverageRatio = occupiedCells / Math.max(1, totalCells);
    const houseCellRatio = houseCells / Math.max(1, totalCells);
    console.info(`[M7-FavelaCoverage] coreCoveragePct=${(coverageRatio * 100).toFixed(1)}% directHouseCellPct=${(houseCellRatio * 100).toFixed(1)}% totalCells=${totalCells}`);
    assert.ok(
      coverageRatio >= 0.82 && houseCellRatio >= 0.70,
      `Cobertura Core CDD >= 82% e casas >= 70% (atual: cob=${(coverageRatio * 100).toFixed(1)}%, casas=${(houseCellRatio * 100).toFixed(1)}%)`
    );
  });

  it('4. Proporção ~80%+ Tijolo Baiano + Reboco Rústico, Ladeiras caminháveis e Outposts CV livres', () => {
    const d = world.favelaCDDData;
    const totalWalls = d.brickBaianoCount + d.cementRawCount + d.cvPaintedCount;
    const rawMasonryRatio = (d.brickBaianoCount + d.cementRawCount) / Math.max(1, totalWalls);

    assert.ok(rawMasonryRatio >= 0.78, `>= 78% alvenaria rústica (atual: ${(rawMasonryRatio * 100).toFixed(1)}%)`);
    assert.ok(d.brickBaianoCount > d.cementRawCount, 'Tijolo Baiano supera Reboco Cinza');
    assert.ok(d.cvPaintedCount >= 60 && d.biroscasCount >= 10 && d.chapelsCount >= 2 && d.hasMototaxiPoint);

    for (const ld of d.circulation.ladeiras) {
      assert.ok(ld.maxSlope <= 0.18, `Ladeira ${ld.id} inclinação <= 18%`);
      const midPt = ld.points[Math.floor(ld.points.length * 0.5)];
      const groundY = world.getTerrainHeightAt(midPt[0], midPt[1]);
      const hits = world.overlapCapsule(new THREE.Vector3(midPt[0], groundY + 0.5, midPt[1]), 0.42, 1.8);
      assert.equal(hits.length, 0, `Ladeira ${ld.id} livre de colisores OBB`);
    }

    for (const op of TERRITORY_ZONES.cv.outposts) {
      const oy = world.getTerrainHeightAt(op.x, op.z);
      const hits = world.overlapCapsule(new THREE.Vector3(op.x, oy + 0.5, op.z), 0.45, 1.8);
      assert.equal(hits.length, 0, `Outpost ${op.id} livre de barraco`);
    }

    const samplePt = d.circulation.ladeiras[0].points[4];
    const sampleY = world.getTerrainHeightAt(samplePt[0], samplePt[1]);
    controller.position.set(samplePt[0], sampleY + 2.2, samplePt[1]);
    controller.velocity.set(0, 0, 0);
    for (let i = 0; i < 20; i++) controller.update(1 / 30);
    assert.ok(Math.abs(controller.position.y - sampleY) < 1.2, 'Jogador pisa firme na ladeira orgânica');

    let l0Tris = 0, l1Tris = 0, activeMeshes = 0, allMeshes = 0;
    scene.traverse((o) => {
      if (o?.isLOD && o.userData?.isFavelaLod) { l0Tris += o.userData.l0Triangles; l1Tris += o.userData.l1Triangles; }
      if (o?.isMesh && o.userData?.isFavelaMesh) allMeshes++;
    });
    scene.traverseVisible((o) => { if (o?.isMesh && o.userData?.isFavelaMesh) activeMeshes++; });
    console.info(
      `[M7-FavelaTelemetry] activeMeshes=${activeMeshes} allStaticMeshes=${allMeshes} fxMeshes=${(world.favelaSoccerFloodCones?.length || 0) + (world.favelaBaileSkytrackers?.length || 0) + (world.favelaSummitBeacons?.length || 0)} houses=${d.housesCount} clusters=${d.clustersCount} l0Tris=${l0Tris} l1Tris=${l1Tris} reductionPct=${((1 - l1Tris / l0Tris) * 100).toFixed(1)}%`
    );
  });
});
