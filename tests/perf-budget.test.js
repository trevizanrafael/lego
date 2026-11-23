import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { Minifigure } = await import('../src/entities/Minifigure.js');
const { consolidateSceneMaterials } = await import('../src/graphics/MaterialRegistry.js');
const { GraphicsPipeline } = await import('../src/graphics/GraphicsPipeline.js');
const { auditSceneGraph } = await import('../src/debug/PerfOverlay.js');

describe('ORÇAMENTO DE PERFORMANCE DE CENA (M2 + M3 — Meshes, Materiais, Geometrias, Transparências & Sombras)', () => {
  it('Mantém meshes < 3000, materiais <= 200, geometrias < 2500, transparentes < 80 e shadowCasters < 400', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.65, 3100);
    camera.position.set(0, 4, -276);

    const dest = new DestructibleManager(scene);
    const world = new TestBlockWorld(scene, dest);
    const fig = new Minifigure('cv_marretao');
    scene.add(fig.root);

    consolidateSceneMaterials(scene, world);

    const mockRenderer = { shadowMap: { enabled: true, autoUpdate: true, needsUpdate: false } };
    const pipeline = new GraphicsPipeline(mockRenderer, scene, camera, world, 'medium');

    const audit = auditSceneGraph(scene, camera);

    assert.ok(
      audit.meshes < 3000,
      `Meshes totais da cena devem ser < 3000 (atual: ${audit.meshes})`
    );
    assert.ok(
      audit.uniqueMaterials <= 200,
      `Materiais únicos da cena devem ser <= 200 (atual: ${audit.uniqueMaterials})`
    );
    assert.ok(
      audit.uniqueGeometries < 2500,
      `Geometrias únicas da cena devem ser < 2500 (atual: ${audit.uniqueGeometries})`
    );
    assert.ok(
      audit.transparentMeshes < 80,
      `Meshes transparentes da cena devem ser < 80 (atual: ${audit.transparentMeshes})`
    );
    assert.ok(
      audit.shadowCasters < 400,
      `Shadow casters ativos devem ser < 400 (atual: ${audit.shadowCasters})`
    );
    assert.ok(
      audit.cameraFar <= 4500,
      `camera.far em solo deve ser <= 4500m (atual: ${audit.cameraFar})`
    );
    assert.ok(
      audit.fogDensity >= 0.0005,
      `Densidade da névoa Noir deve ser >= 0.0005 (atual: ${audit.fogDensity})`
    );

    pipeline.dispose();
  });
});
