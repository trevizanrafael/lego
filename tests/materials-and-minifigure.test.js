import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const { LEGO_COLORS, getLegoMaterial, createLegoBrick } = await import('../src/materials/LegoMaterials.js');
const { Minifigure, MINIFIG_PRESETS } = await import('../src/entities/Minifigure.js');

test('Materiais PBR Opção 2 (Seção 3.2): MeshStandardMaterial fosco por padrão e MeshPhysicalMaterial apenas em vidros/verniz', () => {
  const mat1 = getLegoMaterial(LEGO_COLORS.red);
  const mat2 = getLegoMaterial(LEGO_COLORS.red, { studs: true, studStep: 0.6, castShadow: false, receiveShadow: false });
  const matMicroVar = getLegoMaterial(0x9e1c21, { roughness: 0.59, metalness: 0.06 });

  assert.equal(mat1, mat2, 'Flags de malha (studs/shadows) devem ser ignoradas na chave do cache');
  assert.equal(mat1, matMicroVar, 'Micro-variações dentro do passo de quantização devem reutilizar o mesmo material');
  assert.ok(mat1 instanceof THREE.MeshStandardMaterial, 'Superfície opaca padrão deve ser MeshStandardMaterial');
  assert.equal(mat1 instanceof THREE.MeshPhysicalMaterial, false, 'Superfície opaca comum não deve alocar MeshPhysicalMaterial');
  assert.ok(mat1.roughness >= 0.45, `Roughness (${mat1.roughness}) deve evitar brilho de plástico infantil`);
  assert.equal(mat1.clearcoat, 0, 'MeshStandardMaterial deve expor clearcoat numérico 0 por compatibilidade');

  const matPhys = getLegoMaterial(LEGO_COLORS.red, { physical: true, clearcoat: 0.6 });
  assert.ok(matPhys instanceof THREE.MeshPhysicalMaterial, 'physical: true / clearcoat >= 0.35 deve retornar MeshPhysicalMaterial');
  assert.ok(matPhys.clearcoat >= 0.35, 'Carenagem automotiva preserva clearcoat brilhante');

  const matGlass = getLegoMaterial(0x38bdf8, { transparent: true, opacity: 0.55 });
  assert.ok(matGlass instanceof THREE.MeshPhysicalMaterial, 'Vidro translúcido real deve retornar MeshPhysicalMaterial');

  const matAlmostOpaque = getLegoMaterial(LEGO_COLORS.blue, { transparent: true, opacity: 0.98 });
  assert.equal(matAlmostOpaque.transparent, false, 'Opacity >= 0.96 deve ser normalizado para opaco');
  assert.equal(matAlmostOpaque instanceof THREE.MeshPhysicalMaterial, false, 'Opaco normalizado deve usar MeshStandardMaterial');
});

test('createLegoBrick é studless por padrão na Opção 2 e suporta studs InstancedMesh quando studs: true', () => {
  const cleanBrick = createLegoBrick(2.4, 1.0, 1.2, LEGO_COLORS.yellow);
  assert.equal(cleanBrick.children.length, 1, 'Bloco padrão Opção 2 deve ser liso/studless');

  const brick = createLegoBrick(2.4, 1.0, 1.2, LEGO_COLORS.yellow, { studs: true, studStep: 0.6 });
  assert.equal(brick.children.length, 2, 'Com studs: true deve conter malha do bloco + InstancedMesh de pinos');

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

test('MaterialRegistry.consolidateSceneMaterials deduplica materiais estáticos, protege dinâmicos e SignBoardHelper reutiliza faceMat', async () => {
  const { consolidateSceneMaterials, quantizeColorHex } = await import('../src/graphics/MaterialRegistry.js');
  const { createSignBoardMesh } = await import('../src/utils/SignBoardHelper.js');

  assert.equal(quantizeColorHex(0x123456, 16), quantizeColorHex(0x113355, 16));

  const s1 = createSignBoardMesh({ width: 8, height: 1.8, title: 'METRO M01', subText: 'LINHA CIRCULAR' });
  const s2 = createSignBoardMesh({ width: 8, height: 1.8, title: 'METRO M01', subText: 'LINHA CIRCULAR' });
  assert.equal(s1.material[4], s2.material[4], 'Placas idênticas devem compartilhar o mesmo faceMat em SIGN_FACE_MAT_CACHE');
  assert.equal(s1.castShadow, false, 'Placa não deve projetar sombra');
  assert.equal(s1.receiveShadow, false, 'Placa não deve receber sombra');

  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mA = new THREE.MeshPhysicalMaterial({ color: 0x334455, roughness: 0.62, metalness: 0.05, clearcoat: 0.08 });
  const mB = new THREE.MeshPhysicalMaterial({ color: 0x344556, roughness: 0.58, metalness: 0.08, clearcoat: 0.1 });
  const mProtected = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.4 });
  const mCarGlass = new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
  mCarGlass.userData.isVehicleGlass = true;

  const meshA = new THREE.Mesh(geo, mA);
  const meshB = new THREE.Mesh(geo, mB);
  const meshDyn = new THREE.Mesh(geo, mProtected);
  const meshGlass = new THREE.Mesh(geo, mCarGlass);
  scene.add(meshA, meshB, meshDyn, meshGlass);

  const stats = consolidateSceneMaterials(scene, {
    atmosphere: { landmarkNeonMaterials: [mProtected] }
  });

  assert.equal(stats.beforeCount, 4);
  assert.equal(stats.afterCount, 3, 'mA e mB devem colapsar em 1 único MeshStandardMaterial compartilhado');
  assert.equal(meshA.material, meshB.material);
  assert.equal(meshA.material instanceof THREE.MeshPhysicalMaterial, false, 'Deve rebaixar para MeshStandardMaterial');
  assert.equal(meshDyn.material, mProtected, 'Material dinâmico da atmosfera deve permanecer intocado');
  assert.equal(meshGlass.material, mCarGlass, 'Vidro automotivo deve permanecer protegido');
});
