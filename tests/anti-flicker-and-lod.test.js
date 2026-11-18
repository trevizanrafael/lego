import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { setupTestEnvironment, resetTestListeners } from './setup-env.js';
import { TestBlockWorld } from '../src/world/TestBlockWorld.js';
import { DestructibleManager } from '../src/world/DestructibleManager.js';
import { Minifigure } from '../src/entities/Minifigure.js';
import { ThirdPersonController } from '../src/controls/ThirdPersonController.js';
import { LegoHud } from '../src/ui/LegoHud.js';
import { configureCrispCanvasTexture } from '../src/materials/LegoMaterials.js';
import { createCustomCanvasSignTexture } from '../src/utils/SignBoardHelper.js';
import { createVehicleDecalTexture } from '../src/world/StreetCustomGarage.js';
import { buildSkyHelicarrier } from '../src/world/regions/HelicarrierBuilder.js';

setupTestEnvironment();

test('Mipmaps trilineares, anisotropy e polygonOffset eliminam Z-fighting e shimmering em texturas', () => {
  const scene = new THREE.Scene();
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);

  // 1. Helper configureCrispCanvasTexture
  const c = document.createElement('canvas');
  const tCustom = configureCrispCanvasTexture(new THREE.CanvasTexture(c), 8);
  assert.equal(tCustom.generateMipmaps, true);
  assert.equal(tCustom.minFilter, THREE.LinearMipmapLinearFilter);
  assert.equal(tCustom.magFilter, THREE.LinearFilter);
  assert.equal(tCustom.anisotropy, 8);

  // 2. Placas de sinalização e Decais de veículos usam Mipmaps + Anisotropy 8
  const signTex = createCustomCanvasSignTexture(256, 128, () => {});
  assert.equal(signTex.minFilter, THREE.LinearMipmapLinearFilter);
  assert.ok(signTex.anisotropy >= 8);

  const decalTex = createVehicleDecalTexture('racing_stripes', 0xfacc15, 'top');
  assert.equal(decalTex.minFilter, THREE.LinearMipmapLinearFilter);
  assert.ok(decalTex.anisotropy >= 8);

  // 3. Fachadas de prédios e materiais com map usam LinearMipmapLinearFilter + anisotropy
  let facadeChecked = 0;
  let offsetMarkings = 0;
  world.scene.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    for (const mat of mats) {
      if (mat.map?.isCanvasTexture && mat.emissiveMap?.isCanvasTexture) {
        facadeChecked++;
        assert.equal(mat.map.minFilter, THREE.LinearMipmapLinearFilter);
        assert.equal(mat.emissiveMap.minFilter, THREE.LinearMipmapLinearFilter);
        assert.ok(mat.emissiveMap.anisotropy >= 8);
      }
      if (mat.polygonOffset && mat.polygonOffsetFactor < 0) {
        offsetMarkings++;
      }
    }
  });
  assert.ok(facadeChecked >= 4, `Fachadas com mipmaps/emissiveMap verificadas (${facadeChecked})`);
  assert.ok(offsetMarkings >= 4, `Materiais com polygonOffset contra Z-fighting (${offsetMarkings})`);

  // 4. Sombras direcionais com alcance longo & bias anti-shimmer
  assert.ok(world.sunLight.shadow.camera.far >= 900, 'Alcance de sombra deve cobrir torres altas e voo');
  assert.ok(world.sunLight.shadow.normalBias >= 0.04, 'NormalBias deve evitar acne/shimmer em prédios');

  world.atmosphere.update(0.016, new THREE.Vector3(0, 410, 0), { isFlying: true });
  assert.ok(world.sunLight.shadow.normalBias >= 0.055, 'NormalBias deve escalar com frustum em altitude');
});

test('Câmera adapta near plane em voo e culling usa histerese anti-popping', () => {
  resetTestListeners();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1.6, 0.65, 5200);
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);
  const hud = new LegoHud();
  hud.isTitleScreenActive = false;
  const fig = new Minifigure('caveira');
  scene.add(fig.root);

  const canvas = document.getElementById('test-flicker-canvas');
  const ctrl = new ThirdPersonController(camera, canvas, fig, world, dest, hud);

  // Em solo: near plane preciso e enxuto (>= 0.65)
  ctrl.position.set(0, 0.5, 0);
  ctrl.update(0.016);
  assert.ok(camera.near >= 0.64 && camera.near < 0.9, `Near em solo deve ficar perto de 0.65 (${camera.near})`);

  // Voando alto (Y=410m): near plane sobe para aumentar precisão do depth buffer à distância!
  ctrl.position.set(0, 410, -50);
  ctrl.update(0.016);
  assert.ok(camera.near >= 2.0, `Near em altitude deve subir (>= 2.0) contra Z-fighting (${camera.near})`);

  // Testa histerese do distance culling em props de rua (155m entra, 181m sai -> zero popping!)
  const sp = dest.objects.find((o) => o.isStreetProp && !o.destroyed);
  assert.ok(sp, 'Deve existir street prop para teste de histerese');

  // Primeiro garante visível a 20m
  dest.update(0.25, new THREE.Vector3(sp.basePos.x + 20, 0, sp.basePos.z));
  assert.equal(sp.mesh.visible, true);

  // Move para 168m (entre 155m e 181m): histerese mantém visível sem piscar!
  dest.update(0.25, new THREE.Vector3(sp.basePos.x + 168, 0, sp.basePos.z));
  assert.equal(sp.mesh.visible, true, 'Histerese deve evitar popping entre 155m e 181m');

  // Move além de 190m (> 181m): oculta com folga
  dest.update(0.25, new THREE.Vector3(sp.basePos.x + 195, 0, sp.basePos.z));
  assert.equal(sp.mesh.visible, false, 'Prop deve ocultar após superar faixa de histerese (> 181m)');

  // Testa troca de LOD do Helicarrier sem NaN em várias distâncias
  const lodTestWorld = {
    scene: new THREE.Scene(),
    rotatingElements: [],
    colliders: [],
    destructibles: null,
    addCollider: () => ({})
  };
  buildSkyHelicarrier(lodTestWorld);
  const camNear = new THREE.PerspectiveCamera(60, 1.6, 0.65, 5200);
  camNear.position.set(0, 415, -50);
  camNear.updateMatrixWorld();
  lodTestWorld.helicarrierLOD.update(camNear);
  assert.equal(lodTestWorld.helicarrierLOD.getCurrentLevel(), 0);

  const camMid = new THREE.PerspectiveCamera(60, 1.6, 2.0, 5200);
  camMid.position.set(0, 415, 580);
  camMid.updateMatrixWorld();
  lodTestWorld.helicarrierLOD.update(camMid);
  assert.equal(lodTestWorld.helicarrierLOD.getCurrentLevel(), 1);
});
