import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { createObbCollider, createCylinderCollider, createBoxCollider, circleOverlapsColliderXZ } =
  await import('../src/world/collision/CollisionShapes.js');

// Etapa 2.0: a física do jogador/veículos usava o AABB de colisores girados, criando
// barreiras invisíveis entre prédios e casas rotacionados do overhaul orgânico.
describe('Colisão exata de formas giradas (fim das barreiras invisíveis)', () => {
  it('beco diagonal entre dois prédios girados 45° fica livre', () => {
    const a = createObbCollider(-8, 0, 8, 30, Math.PI / 4, 20, 0);
    const b = createObbCollider(8, 0, 8, 30, Math.PI / 4, 20, 0);
    // Ponto no meio do beco: dentro dos dois AABBs, fora das duas caixas reais.
    const x = 0, z = 0;
    assert.ok(x > a.minX && x < a.maxX && z > a.minZ && z < a.maxZ, 'o AABB antigo bloqueava o beco');
    assert.equal(circleOverlapsColliderXZ(x, z, 0.42, a), false);
    assert.equal(circleOverlapsColliderXZ(x, z, 0.42, b), false);
  });

  it('ainda bloqueia ao encostar na parede real do prédio girado', () => {
    const a = createObbCollider(0, 0, 10, 10, Math.PI / 6, 20, 0);
    assert.equal(circleOverlapsColliderXZ(0, 0, 0.42, a), true);
    assert.equal(circleOverlapsColliderXZ(5.2 * Math.cos(Math.PI / 6), -5.2 * Math.sin(Math.PI / 6), 0.42, a), true);
  });

  it('canto do AABB de um cilindro é livre', () => {
    const c = createCylinderCollider(0, 0, 10, 5, 0);
    assert.equal(circleOverlapsColliderXZ(9.5, 9.5, 0.42, c), false);
    assert.equal(circleOverlapsColliderXZ(6, 6, 0.42, c), true);
  });

  it('caixa alinhada mantém o comportamento histórico (AABB + raio)', () => {
    const box = createBoxCollider(0, 0, 4, 4, 3, 0);
    assert.equal(circleOverlapsColliderXZ(2.3, 0, 0.42, box), true);
    assert.equal(circleOverlapsColliderXZ(2.5, 0, 0.42, box), false);
    assert.equal(circleOverlapsColliderXZ(2, 2, 0, box), true, 'ponto na borda conta (teste inclusivo)');
  });
});
