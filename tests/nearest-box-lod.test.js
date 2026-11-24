import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const { NearestBoxLOD } = await import('../src/world/core/NearestBoxLOD.js');

// Etapa 2.1: chunks de 740–2150 m trocavam para a versão grosseira medindo do CENTRO;
// colado num prédio na borda do chunk o jogador via o bloco preto/branco liso.
test('LOD de chunk grande fica no detalhe máximo para quem está colado na borda', () => {
  const level0 = new THREE.Mesh(new THREE.BoxGeometry(1000, 100, 1000));
  const lod = new NearestBoxLOD();
  lod.addLevel(level0, 0);
  lod.addLevel(new THREE.Object3D(), 210);
  lod.addLevel(new THREE.Object3D(), 740);
  lod.updateMatrixWorld(true);
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(495, 2, 0); // dentro do chunk, a 495 m do centro
  cam.updateMatrixWorld(true);
  lod.update(cam);
  assert.equal(lod.getCurrentLevel(), 0);
  const plain = new THREE.LOD();
  plain.addLevel(new THREE.Object3D(), 0); plain.addLevel(new THREE.Object3D(), 210); plain.addLevel(new THREE.Object3D(), 740);
  plain.updateMatrixWorld(true); plain.update(cam);
  assert.equal(plain.getCurrentLevel(), 1, 'o LOD antigo (centro) já simplificava aqui');
  cam.position.set(500 + 300, 2, 0); cam.updateMatrixWorld(true); lod.update(cam);
  assert.equal(lod.getCurrentLevel(), 1, 'a 300 m da borda vai para o L1');
  cam.position.set(500 + 900, 2, 0); cam.updateMatrixWorld(true); lod.update(cam);
  assert.equal(lod.getCurrentLevel(), 2, 'a 900 m da borda vai para o L2');
});
