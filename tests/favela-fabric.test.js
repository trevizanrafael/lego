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
const { ws } = await import('../src/world/core/WorldLayoutScale.js');
const {
  getFavelaEastBorderX,
  getFavelaElevation,
  createFavelaWallAtlasTexture
} = await import('../src/world/regions/favela-cdd/FavelaElevationAndBatcher.js');

describe('M6 — Favela CDD Realista: <40 Draw Calls, Tijolo Baiano/Reboco Atlas, Curvas de Nível & Becos Caminháveis', () => {
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

  it('1. Orçamento estrito de draw calls (< 40 meshes na Favela), colina em 5 chunks Z frustum-culled sem chão vermelho/marrom e Atlas 512x512', () => {
    const favelaStaticMeshes = [];
    const hillChunks = [];
    scene.traverse((obj) => {
      if (obj?.isMesh && obj.userData?.isFavelaMesh) {
        favelaStaticMeshes.push(obj);
        if (obj.userData.isFavelaHillChunk) hillChunks.push(obj);
      }
    });

    const fxMeshCount =
      (world.favelaSoccerFloodCones?.length || 0) +
      (world.favelaBaileSkytrackers?.length || 0) +
      (world.favelaSummitBeacons?.length || 0);
    const totalFavelaDrawCalls = favelaStaticMeshes.length + fxMeshCount;

    assert.equal(hillChunks.length, 5, `Colina da CDD deve ser dividida em 5 faixas Z para frustum culling (atual: ${hillChunks.length})`);
    assert.ok(
      favelaStaticMeshes.length >= 14 && favelaStaticMeshes.length <= 28,
      `Meshes estáticos fundidos da Favela devem ficar em ~18..26 (atual: ${favelaStaticMeshes.length})`
    );
    assert.ok(
      totalFavelaDrawCalls < 40,
      `Total de meshes/draw calls da Favela CDD (incluindo cones/skytrackers/beacons) deve ser < 40 (atual: ${totalFavelaDrawCalls})`
    );

    for (const hm of hillChunks) {
      assert.ok(hm.geometry.boundingBox && hm.geometry.boundingSphere, 'Cada chunk Z do morro possui boundingBox e boundingSphere');
      assert.ok(
        hm.geometry.boundingSphere.radius < 1500,
        `Chunk Z do morro deve ter raio compacto (<1500m em vez de 3643m) para frustum culling: r=${hm.geometry.boundingSphere.radius.toFixed(1)}`
      );
      const colAttr = hm.geometry.attributes.color;
      let sumRedExcess = 0;
      for (let i = 0; i < colAttr.count; i++) {
        sumRedExcess += colAttr.getX(i) - colAttr.getY(i);
      }
      const avgRedExcess = sumRedExcess / colAttr.count;
      assert.ok(
        avgRedExcess < 0.04,
        `Terreno da Favela não pode ser marrom/vermelho chapado (avg R-G = ${avgRedExcess.toFixed(4)})`
      );
    }

    const atlas = createFavelaWallAtlasTexture();
    assert.equal(atlas.image.width, 512);
    assert.equal(atlas.image.height, 512);
    assert.equal(atlas.image.data.length, 512 * 512 * 4);
  });

  it('2. Orientação orgânica não-cartesiana (< 30% alinhadas a 0°/90°) e lotes pequenos realistas (median w <= 9m, >= 1,400 casas)', () => {
    const favelaParcels = (world.mapBuildings || []).filter((b) => b.isFavelaParcel);
    assert.ok(
      favelaParcels.length >= 1400 && favelaParcels.length <= 2400,
      `Deve gerar 1.400 a 2.400 lotes orgânicos de barracos/sobrados (atual: ${favelaParcels.length})`
    );

    const deg5Sin2 = Math.sin((10 * Math.PI) / 180);
    let axisAlignedCount = 0;
    const widths = [];
    for (let i = 0; i < favelaParcels.length; i++) {
      const p = favelaParcels[i];
      widths.push(p.w);
      if (Math.abs(Math.sin(2 * (p.rotY || 0))) < deg5Sin2) {
        axisAlignedCount++;
      }
    }

    const axisRatio = axisAlignedCount / favelaParcels.length;
    assert.ok(
      axisRatio < 0.30,
      `Menos de 30% das casas podem estar alinhadas em ±5° de 0° ou 90° (atual: ${(axisRatio * 100).toFixed(1)}%)`
    );

    widths.sort((a, b) => a - b);
    const medianW = widths[Math.floor(widths.length * 0.5)];
    assert.ok(medianW >= 4.4 && medianW <= 9.0, `Largura mediana dos lotes deve ser pequena e realista <= 9m (atual: ${medianW.toFixed(2)}m)`);
  });

  it('3. Cobertura urbanizada >= 70% na encosta central da CDD (zero clareiras gigantes vazias no morro)', () => {
    const { circulation, parcelIndex } = world.favelaCDDData;
    assert.ok(circulation && parcelIndex, 'Índices espaciais de becos e lotes da CDD disponíveis');

    const cellSize = 32;
    const halfCell = cellSize * 0.5;
    let totalCells = 0;
    let occupiedCells = 0;
    let houseCells = 0;

    for (let z = ws(-510) + halfCell; z <= ws(410) - halfCell; z += cellSize) {
      if (Math.abs(z) < 40) continue; // Exclui Cânion da Via Expressa Z=0
      const xMax = getFavelaEastBorderX(z) - 16 - halfCell;
      for (let x = ws(-985) + halfCell; x <= xMax; x += cellSize) {
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
    assert.ok(
      coverageRatio >= 0.70,
      `Cobertura urbanizada da encosta central CDD deve ser >= 70% (atual: ${(coverageRatio * 100).toFixed(1)}%, casas diretas: ${(houseCellRatio * 100).toFixed(1)}%)`
    );
  });

  it('4. Proporção ~80%+ Tijolo Baiano + Reboco Rústico, Ladeiras/Becos caminháveis e Garagens/Outposts CV livres', () => {
    const d = world.favelaCDDData;
    const totalWalls = d.brickBaianoCount + d.cementRawCount + d.cvPaintedCount;
    const rawMasonryRatio = (d.brickBaianoCount + d.cementRawCount) / Math.max(1, totalWalls);

    assert.ok(
      rawMasonryRatio >= 0.78,
      `Pelo menos 78% das paredes devem ser Tijolo Baiano cru + Reboco/Chapisco rústico (atual: ${(rawMasonryRatio * 100).toFixed(1)}%)`
    );
    assert.ok(d.brickBaianoCount > d.cementRawCount, 'Tijolo Baiano deve superar Reboco Cinza');
    assert.ok(d.cvPaintedCount >= 60, `Pintura desbotada / acentos CV presentes (atual: ${d.cvPaintedCount})`);
    assert.ok(d.biroscasCount >= 10 && d.chapelsCount >= 2 && d.hasMototaxiPoint, 'Biroscas, Igrejinhas e Ponto de Mototáxi presentes');

    const cddRoads = (world.mapOrganicRoads || []).filter((r) => r.district === 'favela_cdd');
    assert.ok(cddRoads.length >= 2, `Pelo menos 2 ladeiras dirigíveis registradas em mapOrganicRoads (atual: ${cddRoads.length})`);

    for (const ld of d.circulation.ladeiras) {
      assert.ok(ld.maxSlope <= 0.18, `Ladeira ${ld.id} respeita inclinação <= 18% (atual: ${(ld.maxSlope * 100).toFixed(1)}%)`);
      const midPt = ld.points[Math.floor(ld.points.length * 0.5)];
      const groundY = world.getTerrainHeightAt(midPt[0], midPt[1]);
      const hits = world.overlapCapsule(new THREE.Vector3(midPt[0], groundY + 0.5, midPt[1]), 0.42, 1.8);
      assert.equal(hits.length, 0, `Eixo central da ladeira ${ld.id} deve estar 100% livre de colisores OBB`);
    }

    // Verifica que Outposts P1..P3 e Garagens do CV estão livres de barracos em cima
    const cvZone = TERRITORY_ZONES.cv;
    for (const op of cvZone.outposts) {
      const oy = world.getTerrainHeightAt(op.x, op.z);
      const hits = world.overlapCapsule(new THREE.Vector3(op.x, oy + 0.5, op.z), 0.45, 1.8);
      assert.equal(hits.length, 0, `Centro do Outpost ${op.id} deve estar livre de colisor de barraco`);
    }

    // Física real do jogador pisando firme numa ladeira orgânica da CDD
    const samplePt = d.circulation.ladeiras[0].points[4];
    const sampleY = world.getTerrainHeightAt(samplePt[0], samplePt[1]);
    controller.position.set(samplePt[0], sampleY + 2.2, samplePt[1]);
    controller.velocity.set(0, 0, 0);
    for (let i = 0; i < 20; i++) controller.update(1 / 30);
    assert.ok(
      Math.abs(controller.position.y - sampleY) < 1.2,
      `Jogador pisa firme na ladeira orgânica da CDD (y=${controller.position.y.toFixed(2)} vs ground=${sampleY.toFixed(2)})`
    );

    const staticMeshes = [];
    scene.traverse((o) => { if (o?.isMesh && o.userData?.isFavelaMesh) staticMeshes.push(o); });
    const parcels = (world.mapBuildings || []).filter((b) => b.isFavelaParcel);
    const axisCnt = parcels.filter((p) => Math.abs(Math.sin(2 * (p.rotY || 0))) < Math.sin((10 * Math.PI) / 180)).length;
    const widths = parcels.map((p) => p.w).sort((a, b) => a - b);
    console.info(
      `[M6-FavelaTelemetry] staticMeshes=${staticMeshes.length} fxMeshes=${(world.favelaSoccerFloodCones?.length || 0) + (world.favelaBaileSkytrackers?.length || 0) + (world.favelaSummitBeacons?.length || 0)} houses=${d.housesCount} parcels=${parcels.length} axisAlignedPct=${((axisCnt / parcels.length) * 100).toFixed(2)}% medianW=${widths[Math.floor(widths.length * 0.5)].toFixed(2)}m rawMasonryPct=${(rawMasonryRatio * 100).toFixed(1)}% biroscas=${d.biroscasCount} chapels=${d.chapelsCount}`
    );
  });
});
