import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { LEGO_COLORS, getLegoMaterial, createLegoBrick } = await import('../src/materials/LegoMaterials.js');
const { Minifigure, MINIFIG_PRESETS } = await import('../src/entities/Minifigure.js');

test('Materiais LEGO devem usar MeshPhysicalMaterial com plástico ABS brilhante (clearcoat e baixo roughness)', () => {
  const mat1 = getLegoMaterial(LEGO_COLORS.red);
  const mat2 = getLegoMaterial(LEGO_COLORS.red);

  assert.equal(mat1, mat2, 'Materiais idênticos devem ser cacheados e reutilizados');
  assert.ok(mat1 instanceof THREE.MeshPhysicalMaterial, 'Deve ser instância de MeshPhysicalMaterial');
  assert.ok(mat1.roughness <= 0.3, `Roughness (${mat1.roughness}) deve simular plástico liso`);
  assert.ok(mat1.clearcoat >= 0.35, `Clearcoat (${mat1.clearcoat}) deve dar brilho verniz LEGO`);
});

test('createLegoBrick deve criar peça 3D com corpo BoxGeometry e pinos (Studs) InstancedMesh no topo', () => {
  const brick = createLegoBrick(2.4, 1.0, 1.2, LEGO_COLORS.yellow, { studStep: 0.6 });
  assert.equal(brick.children.length, 2, 'Deve conter malha do bloco + InstancedMesh de pinos');

  const instancedStuds = brick.children.find((c) => c instanceof THREE.InstancedMesh);
  assert.ok(instancedStuds, 'Pinos superiores devem usar InstancedMesh para performance de 60 FPS');
  assert.equal(instancedStuds.count, 8, 'Bloco 2.4x1.2 com step 0.6 deve ter 4x2 = 8 pinos LEGO');
});

test('Minifigura 3D deve construir hierarquia articulada completa para Comandante Caveira e Solaris', () => {
  const minifig = new Minifigure('caveira');

  assert.ok(minifig.hipGroup, 'Deve possuir quadril (hipGroup)');
  assert.ok(minifig.leftLegPivot && minifig.rightLegPivot, 'Deve possuir pernas esquerda e direita articuladas');
  assert.ok(minifig.upperBodyGroup, 'Deve possuir tronco superior');
  assert.ok(minifig.leftArmPivot && minifig.rightArmPivot, 'Deve possuir braços esquerdo e direito articulados');
  assert.ok(minifig.headGroup, 'Deve possuir cabeça cilíndrica com pino superior');
  assert.ok(minifig.rifleGroup, 'Comandante Caveira deve segurar o Fuzil Tático 3D na mão direita');
  assert.ok(minifig.muzzleFlashMesh, 'Fuzil Tático deve possuir malha de muzzle flash');

  // Troca para o Solaris e verifica partículas de fogo (a capa saiu no overhaul 'Rei do Sol')
  const solarisPreset = minifig.setHero('solaris');
  assert.equal(solarisPreset, MINIFIG_PRESETS.solaris);
  assert.equal(minifig.currentHeroKey, 'solaris');
  assert.equal(minifig.capeMesh, null, 'Solaris (Rei do Sol) não usa mais capa');
  assert.ok(minifig.flameParticles.length >= 10, `Solaris deve possuir aura de fogo 3D (atual: ${minifig.flameParticles.length} partículas)`);
});

test('Animações procedurais de Idle, Walk, Run, Jump e Fall devem transicionar corretamente', () => {
  const minifig = new Minifigure('caveira');

  minifig.updateAnimation(0.05, 0, 12.8, true, 0);
  assert.equal(minifig.state, 'IDLE');

  minifig.updateAnimation(0.05, 5.5, 12.8, true, 0);
  assert.equal(minifig.state, 'WALK');
  assert.notEqual(minifig.leftLegPivot.rotation.x, 0, 'Pernas devem balançar ao andar');

  minifig.updateAnimation(0.05, 11.5, 12.8, true, 0);
  assert.equal(minifig.state, 'RUN');

  minifig.updateAnimation(0.05, 6.0, 12.8, false, 8.5);
  assert.equal(minifig.state, 'JUMP');

  minifig.updateAnimation(0.05, 6.0, 12.8, false, -7.2);
  assert.equal(minifig.state, 'FALL');
});

test('Animação de Soco deve usar Guarda Alta de Boxe e avanço reto horizontal (sem movimento de bola de boliche)', () => {
  const minifig = new Minifigure('caveira');

  // Golpe 1: Jab Esquerdo
  minifig.triggerPunch();
  assert.equal(minifig.punchComboStep, 1);
  assert.ok(minifig.combatStanceTimer > 0.7, 'Deve ativar timer de guarda alta de combate');

  // Avança 0.05s (pico do Jab)
  minifig.updateAnimation(0.05, 0, 12.8, true, 0);

  // Verifica que AMBOS os braços estão erguidos na linha do peito/queixo (rotation.x < -1.2 rad)
  assert.ok(
    minifig.leftArmPivot.rotation.x < -1.45,
    `Braço esquerdo (${minifig.leftArmPivot.rotation.x}) deve socar reto na linha do ombro`
  );
  assert.ok(
    minifig.rightArmPivot.rotation.x < -1.2,
    `Braço direito (${minifig.rightArmPivot.rotation.x}) deve permanecer erguido na guarda alta protegendo o rosto`
  );
  assert.ok(
    minifig.leftArmPivot.position.z > 0.15,
    `Ombro/punho esquerdo (${minifig.leftArmPivot.position.z}) deve projetar para frente em +Z`
  );

  // Golpe 2: Direto Cruzado de Direita
  minifig.triggerPunch();
  assert.equal(minifig.punchComboStep, 2);
  minifig.updateAnimation(0.05, 0, 12.8, true, 0);

  assert.ok(
    minifig.rightArmPivot.rotation.x < -1.45,
    'Braço direito deve socar reto na linha do ombro no Direto Cruzado'
  );
  assert.ok(
    minifig.rightArmPivot.position.z > 0.15,
    'Punho direito deve avançar em +Z no Direto Cruzado'
  );
  assert.ok(
    minifig.leftArmPivot.rotation.x < -1.2,
    'Braço esquerdo deve ficar recolhido na guarda alta'
  );
});

test('Animação de Rolamento Tático 360° deve girar no centro de massa sem nunca atravessar o chão (y >= 0)', () => {
  const minifig = new Minifigure('caveira');
  minifig.triggerTacticalRoll();

  // Simula todos os frames do rolamento (0.42s em passos de 0.02s)
  for (let step = 0; step < 21; step++) {
    minifig.updateAnimation(0.02, 12.0, 12.8, true, 0);
    const theta = minifig.visualRoot.rotation.x;
    const basePosY = minifig.visualRoot.position.y;

    // Altura mundial do topo da cabeça encolhida (raio ~0.95m do pivô) e dos pés
    const headWorldY = basePosY + 1.95 * Math.cos(theta);
    const feetWorldY = basePosY;

    assert.ok(
      headWorldY >= -0.05,
      `Cabeça não pode entrar na terra durante o rolamento (step=${step}, headWorldY=${headWorldY.toFixed(2)})`
    );
    assert.ok(
      feetWorldY >= -0.05,
      `Pés não podem entrar na terra durante o rolamento (step=${step}, feetWorldY=${feetWorldY.toFixed(2)})`
    );
  }
});
