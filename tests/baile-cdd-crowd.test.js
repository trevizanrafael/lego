import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { setupTestEnvironment, resetTestListeners } from './setup-env.js';
import { TestBlockWorld } from '../src/world/TestBlockWorld.js';
import { DestructibleManager } from '../src/world/DestructibleManager.js';
import { Minifigure } from '../src/entities/Minifigure.js';
import { LegoHud } from '../src/ui/LegoHud.js';
import { ThirdPersonController } from '../src/controls/ThirdPersonController.js';

setupTestEnvironment();

test('Baile da CDD spawna 64 NPCs fora da origem e livres de colisões, sem frustum culling na origem', () => {
  const scene = new THREE.Scene();
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);
  const attr = world.attractions;

  assert.ok(attr?.baileCrowd, 'baileCrowd deve existir');
  assert.equal(attr.baileCrowd.count, 28, 'Core dancefloor mantém compatibilidade count === 28');
  assert.ok(attr.baileCrowd.totalCount >= 60, `Multidão expandida deve ter >= 60 NPCs (${attr.baileCrowd.totalCount})`);
  assert.equal(attr.baileCrowd.allDancers.length, attr.baileCrowd.totalCount);

  const bc = attr.baileCenter;
  const mat4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();

  // Verifica Frame 0 sem esperar update(): nenhuma instância deve ficar em (0,0,0)!
  for (let i = 0; i < attr.baileCrowd.totalCount; i++) {
    attr.baileCrowd.bodyInst.getMatrixAt(i, mat4);
    pos.setFromMatrixPosition(mat4);
    assert.ok(
      pos.distanceTo(bc) < 38,
      `NPC #${i} deve nascer no Baile em vez da origem (pos=${pos.x.toFixed(1)},${pos.z.toFixed(1)})`
    );

    attr.baileCrowd.farLodInst.getMatrixAt(i, mat4);
    pos.setFromMatrixPosition(mat4);
    assert.ok(pos.distanceTo(bc) < 38, `farLodInst #${i} também inicializado no Baile`);

    // Verifica ausência de colisão no Paredão / Palco / Mesas / Barracas
    const d = attr.baileCrowd.allDancers[i];
    if (d.tier !== 'stage') {
      const insideStageOrParedao = d.x >= bc.x - 22.5 && d.x <= bc.x - 10.6 && Math.abs(d.z - bc.z) <= 11.2;
      assert.equal(insideStageOrParedao, false, `NPC #${i} em (${d.x},${d.z}) não deve colidir com palco/paredão`);
    } else {
      assert.ok(d.y >= bc.y + 1.35, 'Dançarinos hype do palco devem ficar sobre o tablado (yBase + 1.4m)');
    }
  }

  // Todos os meshes da multidão devem desabilitar culling na origem & ter boundingSphere centrada no Baile
  for (const im of attr.baileCrowd.allInstMeshes) {
    assert.equal(im.frustumCulled, false, 'frustumCulled=false impede sumir ao desviar câmera do centro');
    assert.ok(im.boundingSphere.center.distanceTo(bc) < 5, 'boundingSphere centrada no Baile da CDD');
  }
});

test('Baile da CDD usa LOD em 2 níveis (articulado vs distante), 5 estilos de dança e reage ao emote [B]', () => {
  resetTestListeners();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1.6, 0.65, 5200);
  const dest = new DestructibleManager(scene);
  const world = new TestBlockWorld(scene, dest);
  const hud = new LegoHud();
  hud.isTitleScreenActive = false;
  const fig = new Minifigure('caveira');
  scene.add(fig.root);

  const canvas = document.getElementById('test-baile-canvas');
  const ctrl = new ThirdPersonController(camera, canvas, fig, world, dest, hud);
  const attr = world.attractions;
  const bc = attr.baileCenter;

  // Confirma diversidade de estilos (0..4)
  const styles = new Set(attr.baileCrowd.allDancers.map((d) => d.danceStyle));
  assert.equal(styles.size, 5, 'Deve haver 5 estilos variados de dança/interação na multidão');

  // 1) Longe (> 460m): oculta tudo
  attr.update(0.1, new THREE.Vector3(0, 1, 0), ctrl);
  assert.equal(attr.baileCrowd.lodMode, 'hidden');
  assert.equal(attr.baileCrowd.bodyInst.visible, false);
  assert.equal(attr.baileCrowd.farLodInst.visible, false);

  // 2) Distância média/aérea (~240m): exibe LOD distante em 1 draw call (não some da tela!)
  attr.update(0.1, new THREE.Vector3(bc.x + 240, bc.y + 30, bc.z), ctrl);
  assert.equal(attr.baileCrowd.lodMode, 'far');
  assert.equal(attr.baileCrowd.farLodInst.visible, true, 'LOD distante deve permanecer visível até 420m');
  assert.equal(attr.baileCrowd.bodyInst.visible, false, 'Partes pesadas ficam ocultas em LOD distante');

  // 3) Perto na quadra (12m): exibe todas as 7 partes articuladas com animação real
  ctrl.position.set(bc.x + 6, bc.y + 0.5, bc.z);
  attr.update(0.1, ctrl.position, ctrl);
  assert.equal(attr.baileCrowd.lodMode, 'near');
  assert.equal(attr.baileCrowd.bodyInst.visible, true);
  assert.equal(attr.baileCrowd.leftLegInst.visible, true);
  assert.equal(attr.baileCrowd.rightArmInst.visible, true);
  assert.equal(attr.baileCrowd.farLodInst.visible, false);

  const matA = new THREE.Matrix4();
  const matB = new THREE.Matrix4();
  attr.baileCrowd.leftArmInst.getMatrixAt(0, matA);
  attr.update(0.25, ctrl.position, ctrl);
  attr.baileCrowd.leftArmInst.getMatrixAt(0, matB);
  assert.equal(matA.equals(matB), false, 'Braços devem se movimentar ao longo do tempo (sem T-pose travado)');

  // 4) Interação: jogador dançando [B] na pista faz NPCs reagirem
  fig.startEmote?.('passinho');
  assert.doesNotThrow(() => attr.update(0.1, ctrl.position, ctrl));
});
