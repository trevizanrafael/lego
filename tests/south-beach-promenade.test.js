import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment({ search: '' });

const { ROAD, ws } = await import('../src/world/core/WorldLayoutScale.js');
const {
  SANTOS_CANALS_X,
  getSouthBeachBayOffsetZ,
  buildSouthBeachAndFerrisWheel
} = await import('../src/world/regions/SouthBeachBuilder.js');
const {
  getSouthBeachBoardwalkBoundsZ,
  getSouthBeachStandardVcMat,
  getSouthBeachBasicVcMat
} = await import('../src/world/regions/south-beach/BeachBatcherAndConstants.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');

describe('M8 — Orla Sul Curva, Calçadão em Ondas Portuguesas, Skyline Escalonado & Batching LOD', () => {
  let scene;
  let hud;
  let destructibles;
  let world;

  before(() => {
    scene = new THREE.Scene();
    hud = new LegoHud();
    destructibles = new DestructibleManager(scene, hud);
    world = new TestBlockWorld(scene, destructibles);
  });

  it('1. Baía curva suave (maxZ - minZ >= 18m), ondas portuguesas + ciclovia contínuas, 3 Canais de Santos e areia seca em ws(150), ws(900)', () => {
    let minOff = Infinity;
    let maxOff = -Infinity;
    const minSafeBwStart = ws(710) + ROAD.mainWidth * 0.5 + 2;

    for (let x = ws(-1825); x <= ws(538); x += 25) {
      const zOff = getSouthBeachBayOffsetZ(x);
      const bounds = getSouthBeachBoardwalkBoundsZ(x);
      minOff = Math.min(minOff, zOff);
      maxOff = Math.max(maxOff, zOff);
      assert.ok(
        bounds.bwZStart >= minSafeBwStart,
        `Calçadão em x=${x} (bwZStart=${bounds.bwZStart.toFixed(2)}) nunca pode invadir a Av. Beira-Mar (${minSafeBwStart})`
      );
    }

    const spanZ = maxOff - minOff;
    assert.ok(spanZ >= 18, `Variação da curva da baía deve ser >= 18m (atual: ${spanZ.toFixed(2)}m, min=${minOff.toFixed(1)}, max=${maxOff.toFixed(1)})`);
    assert.ok(Math.abs(getSouthBeachBayOffsetZ(0)) < 0.05, 'Curva da baía deve alinhar em ~0m na raiz do Mega Píer (x = 0)');
    for (const cx of SANTOS_CANALS_X) {
      assert.ok(Math.abs(getSouthBeachBayOffsetZ(cx)) < 0.05, `Curva da baía deve alinhar em ~0m na boca do canal x=${cx}`);
    }

    assert.ok(world.southBeachPromenadeData, 'Dados do calçadão curvo registrados');
    assert.ok(world.southBeachPromenadeData.waveStoneSegments >= 300, 'Mosaico contínuo de pedras portuguesas em ondas presente');
    assert.ok(world.southBeachPromenadeData.bikeLaneSegments >= 40, 'Ciclovia vermelha curva contínua presente');
    assert.ok(world.southBeachPromenadeData.seawallSegments >= 20, 'Mureta costeira baixa (parapeito da orla) presente');
    assert.ok(world.southBeachPromenadeData.showerCount >= 6, 'Pérgolas e chuveirinhos de praia presentes');

    assert.equal(world.santosCanals.length, 3, '3 Canais de Santos intactos');
    assert.deepEqual(world.santosCanals.map((c) => c.x), SANTOS_CANALS_X);
    assert.ok(world.santosCanals.every((c) => c.zStart <= ws(726) && c.zEnd >= ws(1045)));

    const sandX = ws(150);
    const sandZ = ws(900);
    assert.equal(world.isDeepWaterAt(sandX, sandZ), false, 'ws(150), ws(900) deve permanecer em areia seca');
    const terrainY = world.getTerrainHeightAt(sandX, sandZ);
    const pedY = world.livingCity?._getPedestrianGroundY
      ? world.livingCity._getPedestrianGroundY(sandX, sandZ)
      : terrainY;
    assert.ok(terrainY >= -0.02 && terrainY <= 0.22, `Altura da areia seca válida em ws(150), ws(900): ${terrainY}`);
    assert.ok(pedY >= -0.02 && pedY <= 0.22, `Altura de pedestre na areia válida em ws(150), ws(900): ${pedY}`);
  });

  it('2. Escalonamento costeiro de alturas (frente-mar > 160m > quadras internas), travessas da praia e ZERO sobreposição prédio/rua', () => {
    assert.ok(world.southBeachHotels.length >= 30, `Hotéis/torres costeiras >= 30 (${world.southBeachHotels.length})`);
    const sigHotels = world.southBeachHotels.filter((h) => h.isFrontSignature && h.height >= 230);
    assert.equal(sigHotels.length, 8, '8 super-arranha-céus frontais exclusivos (>= 230m)');
    assert.equal(world.southBeachHotels.filter((h) => h.x > ws(538)).length, 0, 'Zero hotéis além da foz do Rio Urbano');

    // Verifica recuo Z escalonado nas 8 torres frontais (não colineares!)
    const sigZSet = new Set(sigHotels.map((h) => Math.round(h.z)));
    assert.ok(sigZSet.size >= 4, `Torres frontais possuem stagger orgânico em Z (${sigZSet.size} cotas distintas)`);

    const frontRowTowers = world.southBeachHotels.filter((h) => h.isFrontRow);
    const frontAvgH = frontRowTowers.reduce((acc, h) => acc + h.height, 0) / frontRowTowers.length;

    const inlandCoastalBuildings = world.mapBuildings.filter(
      (b) => b.x >= ws(-648) && b.x <= ws(516) && b.z >= ws(402) && b.z <= ws(665)
    );
    assert.ok(inlandCoastalBuildings.length >= 40, `Quadras costeiras internas povoadas (${inlandCoastalBuildings.length})`);
    const inlandAvgH = inlandCoastalBuildings.reduce((acc, b) => acc + (b.height || 24), 0) / inlandCoastalBuildings.length;

    assert.ok(frontAvgH > 160, `Média de altura da frente-mar deve superar 160m (atual: ${frontAvgH.toFixed(1)}m)`);
    assert.ok(frontAvgH > inlandAvgH + 60, `Frente-mar (${frontAvgH.toFixed(1)}m) deve ser bem mais alta que o interior costeiro (${inlandAvgH.toFixed(1)}m)`);

    assert.ok(world.coastalUrbanStats?.travessasCount >= 8, `Travessas da praia presentes (${world.coastalUrbanStats?.travessasCount})`);
    assert.ok(world.coastalUrbanStats?.surfCafeMidrises >= 12, `Mid-rises costeiros com cafés/surf shops ativos (${world.coastalUrbanStats?.surfCafeMidrises})`);

    // Contratos obrigatórios de quiosques, salva-vidas, castelos e Mega Píer
    assert.equal(world.mapBuildings.filter((b) => b.label === 'QUIOSQUE ORLA').length, 4);
    assert.equal(world.mapBuildings.filter((b) => b.label === 'SALVA-VIDAS').length, 2);
    assert.equal(destructibles.objects.filter((o) => o.type === 'sandcastle').length, 16);
    assert.equal(world.pierData.length, 540);
    assert.equal(world.ferrisWheelCabinCount, 16);

    // Zero sobreposição entre mapBuildings e mapRoads terrestres
    const groundRoads = (world.mapRoads || []).filter((r) => !r.isElevated && !r.isBridge);
    let overlaps = 0;
    for (const b of world.mapBuildings) {
      if ((b.minY ?? 0) > 6.0) continue;
      for (const r of groundRoads) {
        if (
          b.x - b.w * 0.5 + 0.6 < r.x + r.w * 0.5 - 0.6 &&
          b.x + b.w * 0.5 - 0.6 > r.x - r.w * 0.5 + 0.6 &&
          b.z - b.d * 0.5 + 0.6 < r.z + r.d * 0.5 - 0.6 &&
          b.z + b.d * 0.5 - 0.6 > r.z - r.d * 0.5 + 0.6
        ) {
          overlaps++;
          break;
        }
      }
    }
    assert.equal(overlaps, 0, 'Zero edifícios/quiosques sobrepondo vias terrestres');
  });

  it('3. Consolidação Vertex-Color + LOD de 2 níveis no SouthBeachBatcher (0 MeshPhysicalMaterial adicionados pela Orla Sul)', () => {
    const isolatedScene = new THREE.Scene();
    const isolatedWorld = {
      scene: isolatedScene,
      mapWater: [],
      mapBlocks: [],
      mapBuildings: [],
      mapRoads: [],
      mapOrganicRoads: [],
      colliders: [],
      elevatedDecks: [],
      rotatingElements: [],
      destructibles: null,
      addCollider: () => ({}),
      addCylinderCollider: () => ({}),
      _addCityBlockSidewalk: () => {},
      getTerrainHeightAt: () => 0
    };

    buildSouthBeachAndFerrisWheel(isolatedWorld);

    let physicalMatCount = 0;
    let batchLodCount = 0;
    const stdVc = getSouthBeachStandardVcMat();
    const basicVc = getSouthBeachBasicVcMat();
    let usesSharedStdVc = 0;
    let usesSharedBasicVc = 0;

    isolatedScene.traverse((obj) => {
      if (obj instanceof THREE.LOD && obj.userData?.isSouthBeachBatchLOD) {
        batchLodCount++;
        assert.equal(obj.userData.skipStaticMerge, true, 'Chunk LOD marcado com skipStaticMerge');
        assert.equal(obj.levels.length, 2, 'Chunk do SouthBeachBatcher possui 2 níveis (0m e 280m)');
        assert.equal(obj.levels[0].distance, 0);
        assert.equal(obj.levels[1].distance, 280);

        obj.levels[1].object.traverse((l1Child) => {
          if (l1Child.isMesh) {
            assert.equal(l1Child.castShadow, false, 'Malhas L1 (>= 280m) desligam castShadow');
          }
        });
      }
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.isMeshPhysicalMaterial) physicalMatCount++;
        if (m === stdVc) usesSharedStdVc++;
        if (m === basicVc) usesSharedBasicVc++;
      }
      assert.ok(obj.geometry.boundingBox || (obj.geometry.computeBoundingBox(), obj.geometry.boundingBox));
    });

    assert.equal(physicalMatCount, 0, `Orla Sul deve adicionar 0 MeshPhysicalMaterials (encontrados: ${physicalMatCount})`);
    assert.ok(batchLodCount >= 10, `Chunks THREE.LOD ativos no SouthBeachBatcher (${batchLodCount})`);
    assert.ok(usesSharedStdVc >= 10, 'Malhas consolidadas compartilham o MeshStandardMaterial Vertex-Color único');
    assert.ok(usesSharedBasicVc >= 4, 'Malhas emissivas/espuma compartilham o MeshBasicMaterial Vertex-Color único');

    let nanCount = 0;
    isolatedScene.traverse((obj) => {
      const pos = obj.geometry?.attributes?.position;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) {
          nanCount++;
        }
      }
    });
    assert.equal(nanCount, 0, 'Zero vértices NaN em todas as geometrias da Orla Sul');
  });
});
