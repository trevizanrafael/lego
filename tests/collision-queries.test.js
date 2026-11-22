import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  worldSpatialColliderMethods,
  packColliderCell,
  projectSlideVelocity2D
} from '../src/world/core/WorldSpatialColliderGrid.js';
import {
  syncObbColliderBounds,
  syncCylinderColliderBounds,
  testCircleVsCollider2D,
  testObbVsCollider2D,
  raycastSegmentVsCollider3D
} from '../src/world/collision/CollisionShapes.js';
import {
  AgentSeparationSystem,
  computeDistinctArrivalSlot
} from '../src/world/collision/AgentSeparation.js';

function createMockCollisionWorld() {
  const world = {
    colliders: [],
    _colliderGrid: new Map(),
    _dynamicColliders: [],
    colliderCellSize: 32,
    _colliderQueryId: 0
  };
  Object.assign(world, worldSpatialColliderMethods);
  return world;
}

describe('COLLISION WORLD CORE: Formas Exatas (Box/OBB/Cylinder/Tiered), Sweeps Contínuos & Separação', () => {
  it('1. Anti-tunneling a 200 m/s (dt = 0.016s, passo de 3.2m) contra parede fina de 0.30m (sweepSphere & sweepOrientedBox)', () => {
    const world = createMockCollisionWorld();
    // Parede fina de 0.30m de espessura centrada em Z = 1.65 -> Z in [1.50, 1.80]
    const thinWall = world.addCollider(0, 1.65, 12.0, 0.30, 6.0, 0.0, { tag: 'thin-wall' });

    // 1A. sweepSphere a 200 m/s (0.0 -> 3.2m em um único frame de 16ms)
    const sphereRes = world.sweepSphere({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 1.2, z: 3.2 }, 0.35);
    assert.equal(sphereRes.hit, true, 'sweepSphere não pode atravessar parede fina de 0.30m a 200 m/s');
    assert.equal(sphereRes.collider, thinWall);
    assert.ok(sphereRes.z < 1.50, `Centro da esfera deve parar antes da face frontal (z=${sphereRes.z.toFixed(4)})`);
    assert.ok(Math.abs(sphereRes.z - (1.50 - 0.35)) < 0.015, 'Posição segura deve ficar encostada em 1.50 - r');
    assert.ok(sphereRes.hitNormalZ < -0.99 && Math.abs(sphereRes.hitNormalX) < 1e-6, 'Normal de impacto deve apontar para -Z');

    // Teste também a 250 m/s contra parede ultra-fina de 0.25m (4.0m de deslocamento)
    const ultraThin = world.addCollider(40, 2.0, 10.0, 0.25, 5.0, 0.0);
    const fastSphere = world.sweepSphere({ x: 40, y: 1.0, z: 0 }, { x: 40, y: 1.0, z: 4.0 }, 0.2);
    assert.equal(fastSphere.hit, true, 'sweepSphere deve capturar parede de 0.25m a 250 m/s');
    assert.equal(fastSphere.collider, ultraThin);
    assert.equal(fastSphere.hitNormalZ, -1);

    // 1B. sweepOrientedBox a 200 m/s (passo de 3.2m) contra a mesma parede fina de 0.30m
    // Caixa com halfX=0.95, halfZ=2.10 indo de Z=-0.8 até Z=+2.4 (para-choque dianteiro vai de +1.30 a +4.50, cruzando [1.50, 1.80])
    const obbRes = world.sweepOrientedBox(
      { x: 0, y: 0.4, z: -0.8 },
      { x: 0, y: 0.4, z: 2.4 },
      0.95,
      2.10,
      0,
      0.35,
      2.1
    );
    assert.equal(obbRes.hit, true, 'sweepOrientedBox não pode tunelar parede de 0.30m a 200 m/s');
    assert.equal(obbRes.hitCollider, thinWall);
    assert.ok(obbRes.z + 2.10 <= 1.505, `Para-choque dianteiro deve parar na face Z=1.50 (parou em ${(obbRes.z + 2.10).toFixed(4)})`);
    assert.ok(obbRes.hitNormalZ < -0.99 && Math.abs(obbRes.hitNormalX) < 1e-6, 'Normal da colisão OBB deve ser (0, -1)');
    assert.ok(obbRes.t > 0.04 && obbRes.t < 0.12, `Fração TOI esperada ~0.0625 (recebeu ${obbRes.t.toFixed(4)})`);
  });

  it('2. OBB rotacionada a 45° bloqueia face diagonal, desliza cápsula a 45° e deixa cantos vazios da AABB livres', () => {
    const world = createMockCollisionWorld();
    const yaw45 = Math.PI / 4;
    // Parede longa (width=2.0, depth=14.0) centrada na origem e girada em +45° (eixo longo em (+1,+1)/sqrt(2))
    const diagWall = world.addObbCollider(0, 0, 2.0, 14.0, yaw45, 8.0, 0.0, { tag: 'diag-45' });

    // AABB externa tem meia-extensão ~(1.0 + 7.0) * cos(45°) = 5.6568m em X e Z
    assert.ok(diagWall.maxX > 5.6 && diagWall.maxZ > 5.6, 'AABB externa deve envolver a OBB rotacionada');

    // 2A. Ponto no canto vazio da AABB externa: (-4.2, +4.2) está DENTRO da AABB [-5.65..5.65]^2,
    // mas a distância perpendicular ao eixo (+1,+1) é |-4.2*cos45 + 4.2*sin45| -> lx = -4.2*s2 - 4.2*s2 = -5.94m (> halfX=1.0m)!
    const cornerOverlap = world.overlapCapsule({ x: -4.2, y: 0, z: 4.2 }, 0.45, 1.8);
    assert.equal(cornerOverlap.length, 0, 'Canto vazio da AABB externa NÃO pode bloquear cápsula');

    const cornerRay = world.raycast3D({ x: -4.2, y: 1.5, z: 6.5 }, { x: -4.2, y: 1.5, z: 2.5 });
    assert.equal(cornerRay.hit, false, 'Raycast passando pelo canto vazio da AABB externa NÃO deve colidir');

    // 2B. Impacto direto na face rotacionada a 45°
    const faceRay = world.raycast3D({ x: 3.0, y: 1.5, z: -3.0 }, { x: -1.0, y: 1.5, z: 1.0 });
    assert.equal(faceRay.hit, true, 'Raycast contra face rotacionada da OBB deve colidir');
    assert.equal(faceRay.collider, diagWall);
    const invSqrt2 = Math.SQRT1_2;
    assert.ok(
      Math.abs(faceRay.normal.x - invSqrt2) < 1e-4 && Math.abs(faceRay.normal.z - (-invSqrt2)) < 1e-4,
      `Normal rotacionada deve ser (+0.7071, -0.7071), recebeu (${faceRay.normal.x.toFixed(4)}, ${faceRay.normal.z.toFixed(4)})`
    );

    // 2C. Deslizamento suave da cápsula ao longo da parede diagonal de 45°
    // Cápsula empurrada em (-X) contra a face (+X local -> normal (+s2, -s2)), deslizando ao longo de (-s2, -s2)
    let pos = { x: 1.8, y: 0, z: -0.2 };
    const startProjAlongWall = pos.x * invSqrt2 + pos.z * invSqrt2;
    let hitDiag = false;
    for (let step = 0; step < 30; step++) {
      pos.x -= 0.14;
      const res = world.resolveCapsulePenetration(pos, 0.45, 1.8);
      pos.x = res.x;
      pos.z = res.z;
      if (res.collided) {
        hitDiag = true;
        const slide = projectSlideVelocity2D(-5.0, 0.0, res.hitNormalX, res.hitNormalZ);
        // Velocidade projetada deve ser tangente à normal da OBB (produto escalar ~ 0)
        const dotNormal = slide.vx * res.hitNormalX + slide.vz * res.hitNormalZ;
        assert.ok(Math.abs(dotNormal) < 1e-6, 'Velocidade de slide deve ser ortogonal à normal da OBB');
      }
    }
    assert.equal(hitDiag, true, 'Cápsula deve ter tocado e deslizado pela face diagonal da OBB');
    const endProjAlongWall = pos.x * invSqrt2 + pos.z * invSqrt2;
    assert.ok(endProjAlongWall < startProjAlongWall - 1.2, 'Cápsula deve progredir ao longo da diagonal de 45°');
    // Distância perpendicular final ao centro da OBB deve ser >= halfX + radius = 1.45m
    const perpDist = Math.abs(pos.x * invSqrt2 - pos.z * invSqrt2);
    assert.ok(perpDist >= 1.449, `Cápsula nunca deve penetrar a OBB (perpDist=${perpDist.toFixed(4)})`);
  });

  it('3. Cilindro empurra cápsula radialmente e raycast3D acerta box, obb, cylinder e recuos de tieredCollider', () => {
    const world = createMockCollisionWorld();
    const silo = world.addCylinderCollider(20, 20, 3.0, 12.0, 0.0, { tag: 'silo' });
    const box = world.addCollider(-25, 0, 6.0, 6.0, 10.0, 0.0, { tag: 'box-bldg' });
    const obb = world.addObbCollider(0, 30, 8.0, 4.0, Math.PI / 6, 9.0, 0.0, { tag: 'obb-bldg' });
    const tiers = world.addTieredCollider(50, 0, [
      { width: 16.0, depth: 16.0, minY: 0.0, maxY: 12.0, tag: 'podium' },
      { width: 8.0, depth: 8.0, minY: 12.0, maxY: 28.0, tag: 'crown' }
    ]);
    assert.equal(tiers.length, 2);

    // 3A. Empurrão radial exato no cilindro em um ângulo arbitrário (37°)
    const angle = 0.645;
    const penPos = {
      x: 20 + Math.cos(angle) * 3.15,
      y: 0,
      z: 20 + Math.sin(angle) * 3.15
    };
    const capRes = world.resolveCapsulePenetration(penPos, 0.5, 1.8);
    assert.equal(capRes.collided, true);
    assert.equal(capRes.hitCollider, silo);
    const radialDist = Math.hypot(capRes.x - 20, capRes.z - 20);
    assert.ok(Math.abs(radialDist - 3.5) < 1e-4, `Cápsula deve sair em R+r=3.5m (atual=${radialDist.toFixed(4)})`);
    assert.ok(Math.abs(capRes.hitNormalX - Math.cos(angle)) < 1e-4, 'Normal X radial exata');
    assert.ok(Math.abs(capRes.hitNormalZ - Math.sin(angle)) < 1e-4, 'Normal Z radial exata');

    // 3B. Raycast 3D contra box, obb e cylinder
    const hitBox = world.raycast3D({ x: -35, y: 4, z: 0 }, { x: -20, y: 4, z: 0 });
    assert.equal(hitBox.hit, true);
    assert.equal(hitBox.collider, box);
    assert.equal(hitBox.normal.x, -1);

    const hitObb = world.raycast3D({ x: 0, y: 3, z: 20 }, { x: 0, y: 3, z: 35 });
    assert.equal(hitObb.hit, true);
    assert.equal(hitObb.collider, obb);

    const hitCyl = world.raycast3D({ x: 12, y: 5, z: 20 }, { x: 25, y: 5, z: 20 });
    assert.equal(hitCyl.hit, true);
    assert.equal(hitCyl.collider, silo);
    assert.ok(Math.abs(hitCyl.point.x - 17.0) < 1e-4 && Math.abs(hitCyl.normal.x - (-1)) < 1e-4);

    // 3C. Tiered building setback: raio baixo (Y=6) acerta podium em X=42; raio alto (Y=20) passa livre pelo ar em X=44
    // (fora da coroa [-4..+4] -> [46..54], embora dentro do pódio [42..58]!) e raio central (Y=20, Z=0) acerta coroa em X=46!
    const lowHit = world.raycast3D({ x: 38, y: 6, z: 0 }, { x: 60, y: 6, z: 0 });
    assert.equal(lowHit.hit, true);
    assert.equal(lowHit.collider, tiers[0]);
    assert.ok(Math.abs(lowHit.point.x - 42.0) < 1e-4);

    const airBesideCrown = world.raycast3D({ x: 44, y: 20, z: -12 }, { x: 44, y: 20, z: 12 });
    assert.equal(airBesideCrown.hit, false, 'Ar ao lado da coroa recuada (setback) deve estar 100% livre');

    const crownHit = world.raycast3D({ x: 38, y: 20, z: 0 }, { x: 60, y: 20, z: 0 });
    assert.equal(crownHit.hit, true);
    assert.equal(crownHit.collider, tiers[1]);
    assert.ok(Math.abs(crownHit.point.x - 46.0) < 1e-4);

    // 3D. Promoção dinâmica, update e remoção limpa
    world.updateDynamicCollider(obb, { cx: 0, cz: 80, yaw: 0 });
    assert.equal(obb.isDynamic, true);
    assert.equal(world.raycast3D({ x: 0, y: 3, z: 20 }, { x: 0, y: 3, z: 35 }).hit, false);
    assert.equal(world.raycast3D({ x: 0, y: 3, z: 70 }, { x: 0, y: 3, z: 85 }).collider, obb);
    world.removeCollider(obb);
    assert.equal(world.raycast3D({ x: 0, y: 3, z: 70 }, { x: 0, y: 3, z: 85 }).hit, false);
  });

  it('4. AgentSeparationSystem separa 10 agentes empilhados respeitando peso (Tanque vs Leves) e gera Arrival Slots distintos', () => {
    const sep = new AgentSeparationSystem({ cellSize: 4.0, maxActiveDist: 155 });
    const agents = [];
    // Agente 0: Blindado pesado (weight = 80, radius = 1.2) na origem
    agents.push({ id: 'tank', kind: 'vehicle', x: 0, y: 0, z: 0, radius: 1.2, weight: 80.0 });
    // Agentes 1..9: 9 unidades leves (weight = 1, radius = 0.5) empilhadas exatamente em (0, 0, 0)
    for (let i = 1; i < 10; i++) {
      agents.push({ id: `unit_${i}`, kind: 'npc', x: 0, y: 0, z: 0, radius: 0.5, weight: 1.0 });
    }

    // Roda relaxação (como em 2–3 frames curtos ou chamada direta)
    for (let step = 0; step < 3; step++) {
      sep.separateAgents(agents, { x: 0, y: 0, z: 0 });
    }

    // Blindado pesado quase não deve sair do lugar comparado aos agentes leves
    const tankMove = Math.hypot(agents[0].x, agents[0].z);
    let avgLightMove = 0;
    for (let i = 1; i < 10; i++) {
      avgLightMove += Math.hypot(agents[i].x, agents[i].z);
    }
    avgLightMove /= 9;
    assert.ok(
      tankMove < 0.25 && avgLightMove > 1.5,
      `Blindado pesado deve quase não se mover (tankMove=${tankMove.toFixed(3)}m vs avgLight=${avgLightMove.toFixed(3)}m)`
    );

    // Todos os 10 agentes devem terminar sem sobreposição mútua
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const d = Math.hypot(agents[i].x - agents[j].x, agents[i].z - agents[j].z);
        const minAllowed = agents[i].radius + agents[j].radius - 0.02;
        assert.ok(
          d >= minAllowed,
          `Par (${i}, ${j}) não deve se sobrepor: dist=${d.toFixed(3)}m < min=${minAllowed.toFixed(3)}m`
        );
      }
    }

    // Agentes em andares diferentes (|ay - by| >= 2.6m, ex.: viaduto acima da rua) não devem se empurrar
    const upperLower = [
      { id: 'street', x: 5, y: 0, z: 5, radius: 1.0, weight: 1 },
      { id: 'viaduct', x: 5, y: 12, z: 5, radius: 1.0, weight: 1 }
    ];
    sep.separateAgents(upperLower, { x: 5, y: 0, z: 5 });
    assert.equal(upperLower[0].sepPushX, 0);
    assert.equal(upperLower[1].sepPushX, 0);

    // computeDistinctArrivalSlot deve gerar coordenadas distintas em anéis concêntricos para 12 viaturas
    const slots = [];
    for (let s = 0; s < 12; s++) {
      slots.push(computeDistinctArrivalSlot(100, -50, s, 12, 6.5, 4.5));
    }
    assert.equal(slots.filter((s) => s.ring === 0).length, 6, 'Anel interno deve comportar 6 unidades');
    assert.equal(slots.filter((s) => s.ring === 1).length, 6, 'Segundo anel deve receber as 6 unidades restantes');
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const dist = Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z);
        assert.ok(dist > 2.5, `Slots ${i} e ${j} devem ser bem distintos (dist=${dist.toFixed(2)}m)`);
      }
    }

    // Smoke check de exports auxiliares
    assert.equal(typeof packColliderCell(1, -2), 'number');
    assert.equal(syncObbColliderBounds({ cx: 0, cz: 0, halfX: 2, halfZ: 1, yaw: 0 }).maxX, 2);
    assert.equal(syncCylinderColliderBounds({ cx: 0, cz: 0, radius: 3 }).maxZ, 3);
    assert.equal(testCircleVsCollider2D(0, 0, 1, null).hit, false);
    assert.equal(testObbVsCollider2D(0, 0, 1, 1, 0, null).hit, false);
    assert.equal(raycastSegmentVsCollider3D(0, 0, 0, 1, 0, 0, null, 0).hit, false);
  });
});
