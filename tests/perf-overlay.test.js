import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { PerfOverlay, auditSceneGraph, isPerfOverlayAllowed } = await import('../src/debug/PerfOverlay.js');

describe('M1 — PerfOverlay (?perf=1) & auditSceneGraph', () => {
  it('1. isPerfOverlayAllowed ativa apenas com ?perf=1 / ?perf=true e respeita autoReset=false do renderer.info', () => {
    assert.equal(isPerfOverlayAllowed(''), false);
    assert.equal(isPerfOverlayAllowed('?debug=1'), false);
    assert.equal(isPerfOverlayAllowed('?perf=1'), true);
    assert.equal(isPerfOverlayAllowed('?foo=bar&perf=true'), true);

    let resets = 0;
    const fakeRenderer = {
      info: {
        autoReset: true,
        render: { calls: 312, triangles: 420000 },
        programs: [{}, {}, {}],
        memory: { geometries: 85, textures: 24 },
        reset() {
          resets++;
        }
      }
    };

    const overlay = new PerfOverlay(fakeRenderer, { searchStr: '?perf=1' });
    assert.equal(overlay.enabled, true);
    assert.equal(fakeRenderer.info.autoReset, false);

    overlay.cur.factionWar = 1.2;
    overlay.cur.worldTotal = 3.4;
    overlay.beginRenderFrame();
    overlay.endRenderFrame(4.5, 14.2);
    overlay.updateDom(0.3, true);

    assert.equal(resets, 1);
    const stats = overlay.getWindowStats();
    assert.equal(stats.samples, 1);
    assert.equal(stats.drawCalls.avg, 312);
    assert.equal(stats.factionWar.avg, 1.2);
    assert.ok(overlay.el.textContent.includes('DC 312'));
    overlay.dispose();
  });

  it('2. auditSceneGraph contabiliza meshes, InstancedMesh, sombras, materiais únicos por classe e triângulos', () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x090b10, 0.0005);
    const cam = new THREE.PerspectiveCamera(60, 1.77, 0.65, 3000);

    const matStd = new THREE.MeshStandardMaterial({ color: 0x334455 });
    const matPhys = new THREE.MeshPhysicalMaterial({ color: 0x112233, transparent: true, opacity: 0.6 });
    const geoBox = new THREE.BoxGeometry(2, 2, 2);

    const m1 = new THREE.Mesh(geoBox, matStd);
    m1.castShadow = true;
    const m2 = new THREE.Mesh(geoBox, matPhys);
    const inst = new THREE.InstancedMesh(geoBox, matStd, 10);
    scene.add(m1, m2, inst, new THREE.DirectionalLight(0xffffff, 1));

    const audit = auditSceneGraph(scene, cam);
    assert.equal(audit.meshes, 3);
    assert.equal(audit.instancedMeshes, 1);
    assert.equal(audit.totalInstances, 10);
    assert.equal(audit.shadowCasters, 1);
    assert.equal(audit.uniqueMaterials, 2);
    assert.equal(audit.physicalMaterials, 1);
    assert.equal(audit.standardMaterials, 1);
    assert.equal(audit.uniqueGeometries, 1);
    assert.equal(audit.transparentMeshes, 1);
    assert.equal(audit.lights.directional, 1);
    assert.equal(audit.cameraFar, 3000);
  });
});
