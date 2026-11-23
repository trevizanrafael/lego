import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment, resetTestListeners } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { SuburbBatcher, buildDetailedHouse } = await import('../src/world/SuburbHouseGenerator.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { IS_SCALED_WORLD, ws } = await import('../src/world/core/WorldLayoutScale.js');

describe('M7 (Part A) — Subúrbio Norte Residencial Denso & Consolidação Vertex-Color de SuburbBatcher', () => {
  let scene;
  let hud;
  let destructibles;
  let world;

  before(() => {
    resetTestListeners();
    scene = new THREE.Scene();
    hud = new LegoHud(35000);
    destructibles = new DestructibleManager(scene, hud);
    world = new TestBlockWorld(scene, destructibles);
  });

  it('1. Parcelas residenciais frontais compactas (14..21m médio, 16..21 lotes por face) e >= 700 casas no Subúrbio Norte em 3x', () => {
    assert.equal(IS_SCALED_WORLD, true, 'WORLD_SCALE = 3 ativo');
    assert.ok(world.suburbBlocks && world.suburbBlocks.length >= 95, `Subúrbio deve registrar todas as faces residenciais (atual: ${world.suburbBlocks.length})`);

    // Preserva contrato histórico de totalLots (4, 6, 8) e expõe actualParcelsCount / parcelWidth reais
    const lotCounts = new Set(world.suburbBlocks.map((b) => b.totalLots));
    assert.ok(lotCounts.has(4) && lotCounts.has(6) && lotCounts.has(8), 'Preserva alternância histórica 4/6/8 em totalLots');

    let sumWidth = 0;
    let totalStreetFrontParcels = 0;
    for (const blk of world.suburbBlocks) {
      assert.ok(blk.actualParcelsCount >= 16 && blk.actualParcelsCount <= 22, `Face de super-quadra deve empacotar 16..22 lotes vizinhos (obtido: ${blk.actualParcelsCount} em w=${blk.w.toFixed(1)}m)`);
      assert.ok(blk.parcelWidth >= 14.0 && blk.parcelWidth <= 21.0, `Largura de lote deve ficar entre 14..21m (obtido: ${blk.parcelWidth.toFixed(2)}m)`);
      sumWidth += blk.parcelWidth;
      totalStreetFrontParcels += blk.actualParcelsCount;
    }
    const avgParcelW = sumWidth / world.suburbBlocks.length;
    assert.ok(avgParcelW >= 14.0 && avgParcelW <= 21.0, `Largura média das parcelas frontais em 14..21m (atual: ${avgParcelW.toFixed(2)}m)`);
    assert.ok(totalStreetFrontParcels >= 1700, `Mais de 1700 lotes frontais contínuos nas avenidas do Subúrbio (atual: ${totalStreetFrontParcels})`);

    // Casas registradas dentro do Subúrbio Norte (z < -1540) e nas alamedas curvas internas
    const allNorthBuildings = world.mapBuildings.filter((b) => b.z < -1540);
    const suburbCoreHouses = world.mapBuildings.filter(
      (b) => b.z < -1540 && b.z > ws(-1315) && b.x >= ws(-648) && b.x <= ws(516)
    );
    assert.ok(allNorthBuildings.length >= 700, `>= 700 edificações em mapBuildings com z < -1540 (atual: ${allNorthBuildings.length})`);
    assert.ok(suburbCoreHouses.length >= 2200, `Alta densidade real no miolo do Subúrbio Norte (atual: ${suburbCoreHouses.length})`);
    assert.ok(world.suburbOrganicStats.interiorHouses >= 900, `Alamedas curvas e cul-de-sacs densamente povoados (atual: ${world.suburbOrganicStats.interiorHouses})`);
  });

  it('2. SuburbBatcher consolida tudo em Vertex-Color MeshStandardMaterial/MeshBasicMaterial (0 MeshPhysicalMaterial e < 45 meshes)', () => {
    const suburbBatchMeshes = [];
    let suburbPhysMats = 0;

    scene.traverse((obj) => {
      if (!obj.userData?.isSuburbBatchChunk) return;
      suburbBatchMeshes.push(obj);
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m?.isMeshPhysicalMaterial) suburbPhysMats++;
      }
      assert.ok(obj.geometry?.boundingBox, 'Todo chunk do SuburbBatcher possui boundingBox calculada');
      assert.ok(obj.geometry?.boundingSphere, 'Todo chunk do SuburbBatcher possui boundingSphere calculada');
      if (obj.isInstancedMesh) {
        assert.ok(obj.boundingBox && obj.boundingSphere, 'Todo InstancedMesh de árvores floridas possui boundingBox e boundingSphere');
      }
    });

    const staticChunkMeshes = suburbBatchMeshes.filter((o) => !o.isInstancedMesh);
    const treeChunkMeshes = suburbBatchMeshes.filter((o) => o.isInstancedMesh);
    assert.equal(suburbPhysMats, 0, 'Zero MeshPhysicalMaterial emitidos pelo SuburbBatcher na cena principal');
    assert.ok(staticChunkMeshes.length > 0 && staticChunkMeshes.length <= 24, `Chunks estáticos VC em 1..24 meshes (atual: ${staticChunkMeshes.length})`);
    assert.ok(treeChunkMeshes.length > 0 && treeChunkMeshes.length <= 20, `Chunks InstancedMesh de árvores floridas em 1..20 (atual: ${treeChunkMeshes.length})`);
    assert.ok(
      suburbBatchMeshes.length > 0 && suburbBatchMeshes.length < 45,
      `SuburbBatcher deve emitir < 45 meshes estáticos totais (atual: ${suburbBatchMeshes.length})`
    );

    // Testa SuburbBatcher isolado (sem consolidateSceneMaterials global) para provar 0 MeshPhysicalMaterial nativo
    const isoScene = new THREE.Scene();
    const isoWorld = {
      mapBuildings: [],
      colliders: [],
      addCollider() {},
      _addLegoTree() {},
      getTerrainHeightAt: () => 4.0
    };
    const isoBatcher = new SuburbBatcher();
    for (let i = 0; i < 6; i++) {
      buildDetailedHouse(isoWorld, isoBatcher, {
        x: -120 + i * 17.5,
        z: -1980,
        lotW: 17.5,
        lotD: 30,
        facingDirZ: 1,
        styleKey: ['american_two_story', 'ranch_l_shape', 'suburb_mansion_pool', 'modern_wood_chalet', 'townhouses'][i % 5],
        seed: 10 + i
      });
    }
    isoBatcher.flush(isoScene);

    const isoMats = new Set();
    let isoPhysCount = 0;
    isoScene.traverse((o) => {
      if (!o.material) return;
      isoMats.add(o.material);
      if (o.material.isMeshPhysicalMaterial) isoPhysCount++;
    });
    assert.equal(isoPhysCount, 0, 'SuburbBatcher isolado cria exatamente 0 MeshPhysicalMaterial');
    assert.ok(isoMats.size <= 2, `SuburbBatcher isolado usa no máximo 2 materiais compartilhados (atual: ${isoMats.size})`);
  });

  it('3. Marcos especiais, comércio de esquina (Padaria/Farmácia/Barbearia/Mercadinho), >= 20 mailboxes, 6 gas_pumps explosivas e 0 invasão em mapRoads', () => {
    const labels = new Set(world.mapBuildings.map((b) => b.label).filter(Boolean));
    for (const required of ['POSTO OCTAN', 'CONVENIÊNCIA', 'PIZZARIA LEGO', 'DINER & MERCADO', 'QUADRA BASQUETE']) {
      assert.ok(labels.has(required), `Marco obrigatório presente: ${required}`);
    }
    for (const shop of ['PADARIA', 'FARMÁCIA', 'BARBEARIA', 'MERCADINHO']) {
      assert.ok(labels.has(shop), `Comércio de esquina presente na faixa central do Subúrbio: ${shop}`);
    }

    const mailboxes = destructibles.objects.filter((o) => o.type === 'mailbox');
    assert.ok(mailboxes.length >= 20 && mailboxes.length <= 140, `Quantidade equilibrada de caixas de correio quebráveis (atual: ${mailboxes.length})`);

    // Verifica zero sobreposição entre qualquer edificação (incluindo casas densas e comércios novos) e as vias asfaltadas
    const groundRoads = (world.mapRoads || []).filter((r) => !r.isElevated && !r.isBridge);
    const overlaps = [];
    for (const b of world.mapBuildings) {
      if ((b.minY ?? 0) > 6.0 || b.z >= -1500) continue;
      const bMinX = b.x - b.w * 0.5 + 0.6, bMaxX = b.x + b.w * 0.5 - 0.6;
      const bMinZ = b.z - b.d * 0.5 + 0.6, bMaxZ = b.z + b.d * 0.5 - 0.6;
      for (const r of groundRoads) {
        if (bMinX < r.x + r.w * 0.5 - 0.6 && bMaxX > r.x - r.w * 0.5 + 0.6 && bMinZ < r.z + r.d * 0.5 - 0.6 && bMaxZ > r.z - r.d * 0.5 + 0.6) {
          overlaps.push({ b, r });
          break;
        }
      }
    }
    assert.equal(overlaps.length, 0, `Zero mapBuildings sobrepondo mapRoads no Subúrbio: ${JSON.stringify(overlaps.slice(0, 3))}`);

    // Detonação em reação em cadeia das 6 bombas do Posto Octan
    const pumps = destructibles.objects.filter((o) => o.type === 'gas_pump' && !o.destroyed);
    assert.equal(pumps.length, 6, 'Exatamente 6 gas_pumps ativas no Posto Octan');
    destructibles.damageObject(pumps[0], 100);
    const survivingPumps = destructibles.objects.filter((o) => o.type === 'gas_pump' && !o.destroyed);
    assert.equal(survivingPumps.length, 0, 'Todas as 6 bombas explodem em reação em cadeia');
  });
});
