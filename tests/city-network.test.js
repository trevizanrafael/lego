import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment, resetTestListeners } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { Minifigure } = await import('../src/entities/Minifigure.js');
const { consolidateSceneMaterials } = await import('../src/graphics/MaterialRegistry.js');
const { GraphicsPipeline } = await import('../src/graphics/GraphicsPipeline.js');
const { auditSceneGraph } = await import('../src/debug/PerfOverlay.js');
const { METRO_ISLAND_CUTOUTS } = await import('../src/world/MetroSystemBuilder.js');
const { ws } = await import('../src/world/core/WorldLayoutScale.js');
const { isPointInCartesianGridAsphalt } = await import('../src/world/terrain/OrganicRoadSpatialIndex.js');
const {
  ROAD_HIERARCHY_TIERS,
  getUnifiedCityRoadNetwork,
  computeRoadNetworkDiagnostics
} = await import('../src/world/terrain/CityRoadNetworkSpec.js');
const { getDowntownOrganicNetwork } = await import('../src/world/terrain/OrganicDowntownNetworkSpec.js');
const {
  ensurePoliceRoadGraph,
  findRoadPathAStar,
  findNearestRoadNode
} = await import('../src/world/police/PoliceRoadGraph.js');

function segmentIntersectsRect(x1, z1, x2, z2, halfW, r) {
  const minX = r.minX - halfW;
  const maxX = r.maxX + halfW;
  const minZ = r.minZ - halfW;
  const maxZ = r.maxZ + halfW;
  for (let s = 0; s <= 16; s++) {
    const t = s / 16;
    const px = x1 + (x2 - x1) * t;
    const pz = z1 + (z2 - z1) * t;
    if (px >= minX && px <= maxX && pz >= minZ && pz <= maxZ) return true;
  }
  return false;
}

describe('M4 — Rede Viária Unificada da Ilha, Interseções Chanfradas, Praças Triangulares & Grafo Conectado', () => {
  let scene;
  let camera;
  let destructibles;
  let world;
  let diagnostics;

  before(() => {
    resetTestListeners();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 3100);
    camera.position.set(0, 4, -276);
    destructibles = new DestructibleManager(scene);
    world = new TestBlockWorld(scene, destructibles);
    diagnostics = computeRoadNetworkDiagnostics(world);
  });

  it('1. CityRoadNetworkSpec expõe os 4 níveis hierárquicos, rotatórias e praças triangulares com 0 NaN e 0 invasões em Metrô/Banco/Torre', () => {
    const net = getUnifiedCityRoadNetwork();
    const compatNet = getDowntownOrganicNetwork();

    assert.deepEqual(ROAD_HIERARCHY_TIERS, ['expressway', 'arterial', 'collector', 'local']);
    for (const tier of ROAD_HIERARCHY_TIERS) {
      assert.ok(
        Array.isArray(net.tiers[tier]) && net.tiers[tier].length > 0,
        `Tier '${tier}' deve estar populado (atual: ${net.tiers[tier]?.length})`
      );
    }

    assert.ok(net.roundabouts.length >= 4, 'Preserva as 4 rotatórias monumentais');
    assert.ok(net.triangularPlazas.length >= 6, 'Expõe praças triangulares / gore islands oblíquas');
    assert.equal(compatNet.polylines.length, net.polylines.length, 'getDowntownOrganicNetwork permanece 100% compatível');
    assert.equal(compatNet.triangularPlazas.length, net.triangularPlazas.length);

    // Conectores inter-distritais registrados em world.mapOrganicRoads com tier, width, sidewalk e isMain
    const interDistrictPolys = net.polylines.filter((p) => p.isInterDistrict);
    assert.ok(interDistrictPolys.length >= 6, 'Possui conectores arteriais/coletores inter-distritais');
    for (const conn of interDistrictPolys) {
      const reg = world.mapOrganicRoads.find((r) => r.id === conn.id);
      assert.ok(reg, `Conector ${conn.id} registrado em world.mapOrganicRoads`);
      assert.ok(ROAD_HIERARCHY_TIERS.includes(reg.tier), `Conector ${conn.id} possui tier válido (${reg.tier})`);
      assert.ok(reg.width > 0 && reg.sidewalk >= 0 && typeof reg.isMain === 'boolean');
    }

    // Zero coordenadas NaN em polilinhas, rotatórias e praças triangulares
    for (const poly of net.polylines) {
      for (const [px, pz] of poly.points) {
        assert.ok(Number.isFinite(px) && Number.isFinite(pz), `Coordenada finita em ${poly.id}`);
      }
    }
    for (const rb of net.roundabouts) {
      assert.ok(Number.isFinite(rb.cx) && Number.isFinite(rb.cz) && Number.isFinite(rb.innerR) && Number.isFinite(rb.outerR));
    }

    const coreKeepouts = net.keepouts.filter(
      (k) => k.id === 'super_bank_and_m01' || k.id === 'hero_tower_complex'
    );
    assert.equal(coreKeepouts.length, 2, 'Keepouts do Super Banco e Torre dos Heróis presentes');

    // Zero intrusões asfálticas nos recortes subterrâneos do Metrô ou nos keepouts do Super Banco / Torre dos Heróis
    for (const seg of net.segments) {
      for (const cut of METRO_ISLAND_CUTOUTS) {
        assert.equal(
          segmentIntersectsRect(seg.x1, seg.z1, seg.x2, seg.z2, seg.halfWidth, cut),
          false,
          `Segmento ${seg.polyId}[${seg.segIdx}] não pode invadir recorte do Metrô ${cut.id}`
        );
      }
      for (const ko of coreKeepouts) {
        assert.equal(
          segmentIntersectsRect(seg.x1, seg.z1, seg.x2, seg.z2, seg.halfWidth, ko),
          false,
          `Segmento ${seg.polyId}[${seg.segIdx}] não pode invadir keepout ${ko.id}`
        );
      }
    }

    // Praças triangulares com 0 NaN, fora de pistas de rolamento e fora de keepouts/Metrô
    for (const plaza of net.triangularPlazas) {
      assert.ok(Number.isFinite(plaza.cx) && Number.isFinite(plaza.cz) && plaza.points.length === 3);
      for (const [vx, vz] of plaza.points) {
        assert.ok(Number.isFinite(vx) && Number.isFinite(vz), `Vértice finito em ${plaza.id}`);
        assert.equal(
          isPointInCartesianGridAsphalt(vx, vz, 0.5),
          false,
          `Praça ${plaza.id} fora das faixas cartesianas de veículos`
        );
        for (const cut of METRO_ISLAND_CUTOUTS) {
          assert.equal(
            vx >= cut.minX && vx <= cut.maxX && vz >= cut.minZ && vz <= cut.maxZ,
            false,
            `Praça ${plaza.id} fora do recorte de Metrô ${cut.id}`
          );
        }
        for (const ko of coreKeepouts) {
          assert.equal(
            vx >= ko.minX && vx <= ko.maxX && vz >= ko.minZ && vz <= ko.maxZ,
            false,
            `Praça ${plaza.id} fora do keepout ${ko.id}`
          );
        }
      }
      for (const seg of net.segments) {
        const dx = seg.x2 - seg.x1, dz = seg.z2 - seg.z1;
        for (const [vx, vz] of plaza.points) {
          const t = Math.max(0, Math.min(1, ((vx - seg.x1) * dx + (vz - seg.z1) * dz) / (seg.len * seg.len)));
          const dist = Math.hypot(vx - (seg.x1 + dx * t), vz - (seg.z1 + dz * t));
          assert.ok(dist > seg.halfWidth + 1.0, `Praça ${plaza.id} fora da pista orgânica ${seg.polyId}`);
        }
      }
    }
  });

  it('2. Conectividade total TestBlockWorld + PoliceRoadGraph A*/BFS do Centro para todos os 6 distritos principais e 0 componentes isolados', () => {
    const graph = ensurePoliceRoadGraph(world.livingCity.wantedSystem);
    assert.ok(graph.nodes.length >= 250, `Grafo viário unificado denso (${graph.nodes.length} nós)`);
    assert.equal(
      diagnostics.districtConnectivity.isolatedComponentsCount,
      0,
      `Zero componentes isolados no grafo viário (atual: ${diagnostics.districtConnectivity.isolatedComponentsCount})`
    );
    assert.equal(diagnostics.districtConnectivity.allDistrictsConnected, true);

    const start = { x: 0, z: ws(-117) };
    const districtGoals = [
      ['suburbio_norte', ws(120), ws(-644)],
      ['praia_sul', 0, ws(710)],
      ['industrial_leste', ws(768), ws(-250)],
      ['porto_leste', ws(825), ws(335)],
      ['aeroporto_oeste', ws(-1060), 0],
      ['ilha_prisao', ws(1375), ws(1260)]
    ];

    for (const [districtId, gx, gz] of districtGoals) {
      const targetNode = findNearestRoadNode(graph, gx, gz, (n) => n.neighbors.length > 0);
      assert.ok(targetNode, `Nó viário encontrado em ${districtId}`);
      const path = findRoadPathAStar(graph, start.x, start.z, gx, gz);
      assert.ok(path.length >= 2, `Rota A* válida de centro_financeiro até ${districtId}`);
      assert.ok(
        Math.hypot(path[path.length - 1].x - targetNode.x, path[path.length - 1].z - targetNode.z) < 1.0,
        `A* alcança efetivamente o nó de destino em ${districtId}`
      );
      for (const wp of path) {
        assert.equal(
          world.isDeepWaterAt(wp.x, wp.z, { forCar: true }),
          false,
          `Waypoint (${wp.x}, ${wp.z}) rumo a ${districtId} permanece em pista seca ou ponte`
        );
      }
    }
  });

  it('3. Auditoria de inclinação longitudinal: arteriais/coletoras <= 12% (0.12) e ladeiras de encosta <= 18% (0.18)', () => {
    assert.equal(
      diagnostics.slopeAudit.slopeViolations.length,
      0,
      `Zero segmentos arteriais/coletores acima de 12%: ${JSON.stringify(diagnostics.slopeAudit.slopeViolations.slice(0, 5))}`
    );
    assert.ok(
      diagnostics.slopeAudit.maxStandardSlope <= 0.12,
      `Inclinação longitudinal máxima arterial/coletora <= 0.12 (atual: ${diagnostics.slopeAudit.maxStandardSlope})`
    );
    assert.equal(
      diagnostics.slopeAudit.ladeiraViolations.length,
      0,
      `Zero ladeiras acima de 18%: ${JSON.stringify(diagnostics.slopeAudit.ladeiraViolations.slice(0, 5))}`
    );
    assert.ok(
      diagnostics.slopeAudit.maxLadeiraSlope <= 0.18,
      `Inclinação longitudinal máxima nas ladeiras <= 0.18 (atual: ${diagnostics.slopeAudit.maxLadeiraSlope})`
    );
  });

  it('4. Orçamento de cena e auditoria de colisores permanecem verdes (meshes < 3000, invalidColliders === 0)', () => {
    const fig = new Minifigure('cv_marretao');
    scene.add(fig.root);
    consolidateSceneMaterials(scene, world);
    const mockRenderer = { shadowMap: { enabled: true, autoUpdate: true, needsUpdate: false } };
    const pipeline = new GraphicsPipeline(mockRenderer, scene, camera, world, 'medium');

    const audit = auditSceneGraph(scene, camera);
    assert.ok(audit.meshes < 3000, `Meshes < 3000 (atual: ${audit.meshes})`);
    assert.ok(audit.uniqueMaterials <= 200, `Materiais <= 200 (atual: ${audit.uniqueMaterials})`);
    assert.ok(audit.uniqueGeometries < 2500, `Geometrias < 2500 (atual: ${audit.uniqueGeometries})`);
    assert.ok(audit.transparentMeshes < 80, `Transparentes < 80 (atual: ${audit.transparentMeshes})`);
    assert.ok(audit.shadowCasters < 400, `ShadowCasters < 400 (atual: ${audit.shadowCasters})`);

    const invalidColliders = world.colliders.filter(
      (c) =>
        !c ||
        (!c.disabled &&
          (!Number.isFinite(c.minX) ||
            !Number.isFinite(c.maxX) ||
            !Number.isFinite(c.minY) ||
            !Number.isFinite(c.maxY) ||
            !Number.isFinite(c.minZ) ||
            !Number.isFinite(c.maxZ) ||
            c.minX > c.maxX ||
            c.minY > c.maxY ||
            c.minZ > c.maxZ))
    );
    assert.equal(invalidColliders.length, 0, `Zero colisores inválidos (encontrados: ${invalidColliders.length})`);

    pipeline.dispose();
    scene.remove(fig.root);
  });
});
