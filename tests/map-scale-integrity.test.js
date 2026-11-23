import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment({ search: '' });

const {
  DEFAULT_WORLD_SCALE,
  WORLD_SCALE,
  IS_SCALED_WORLD,
  ROAD,
  resolveWorldScale,
  ws
} = await import('../src/world/core/WorldLayoutScale.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { MAP_REGIONS } = await import('../src/world/MapRegionsData.js');
const { STATIC_MAP_SPAN } = await import('../src/ui/minimap/MinimapTerrainAndRoadsPainter.js');
const { BANK_SPEC } = await import('../src/world/regions/SuperBankBuilder.js');
const { getFavelaElevation } = await import('../src/world/regions/FavelaCDDBuilder.js');

describe('ONDA 3 — Auditoria Completa de Integridade do Mapa 3x, Calçadas de 10m & Pedestres Fora da Rua', () => {
  let scene;
  let hud;
  let destructibles;
  let world;

  before(() => {
    scene = new THREE.Scene();
    hud = new LegoHud();
    destructibles = new DestructibleManager(scene, hud);
    world = new TestBlockWorld(scene, destructibles);
  });

  it('1. Regras centrais de escala: WORLD_SCALE = 3 ativo, ?worldScale=1 preservado, vias 34m/26m + calçadas 10m e alturas Y em 1x', () => {
    assert.equal(DEFAULT_WORLD_SCALE, 3);
    assert.equal(WORLD_SCALE, 3);
    assert.equal(IS_SCALED_WORLD, true);
    assert.equal(resolveWorldScale('?worldScale=1'), 1);
    assert.equal(resolveWorldScale('?worldScale=3'), 3);

    assert.equal(ROAD.mainWidth, 34);
    assert.equal(ROAD.secondaryWidth, 26);
    assert.equal(ROAD.sidewalk, 10);
    assert.equal(ROAD.curbHeight, 0.18);
    assert.ok(STATIC_MAP_SPAN >= 22200, `STATIC_MAP_SPAN=${STATIC_MAP_SPAN} deve cobrir o mapa 3x`);

    // Alturas (Y) e tamanhos de conjuntos rígidos permanecem estritamente 1x
    assert.equal(BANK_SPEC.originZ, ws(-175));
    assert.ok(Math.abs(BANK_SPEC.roofY - 40.96) < 0.05, 'Altura do Super Banco permanece 1x (~40.96m)');
    assert.ok(Math.abs((BANK_SPEC.maxX - BANK_SPEC.minX) - 148) < 1, 'Largura do Super Banco permanece 1x (148m)');

    const towerReg = MAP_REGIONS.find((r) => r.id === 'torre_herois');
    assert.ok(Math.abs(towerReg.spawn.y - 310.85) < 0.2, 'Heliponto da Torre permanece em Y ~ 310.85m (1x)');

    const skyReg = MAP_REGIONS.find((r) => r.id === 'aeroporta_avioes');
    assert.ok(Math.abs(skyReg.spawn.y - 411.5) < 0.2, 'Aeroporta-Aviões permanece em Y ~ 411.5m (1x)');
    assert.equal(skyReg.spawn.z, ws(-50));

    let peakFavelaY = 0;
    for (let x = ws(-980); x <= ws(-550); x += 45) {
      for (let z = ws(-480); z <= ws(380); z += 45) {
        peakFavelaY = Math.max(peakFavelaY, getFavelaElevation(x, z));
      }
    }
    assert.ok(peakFavelaY > 30 && peakFavelaY <= 46, `Pico da Favela CDD permanece 1x (${peakFavelaY.toFixed(2)}m)`);

    // Velocidade dos trens do Metrô aumentada em 2.5x (70 m/s)
    const train = world.metroData?.trains?.[0] || world.metroSystem?.trains?.[0];
    if (train?.cruiseSpeed !== undefined) {
      assert.ok(Math.abs(train.cruiseSpeed - 70) < 0.5, `Velocidade de cruzeiro do Metrô deve ser 70 m/s (2.5x), obtido ${train.cruiseSpeed}`);
    }
  });

  it('2. Zero mapBuildings sobrepondo pistas asfaltadas (world.mapRoads) e calçadas/faixas populadas', () => {
    assert.ok(Array.isArray(world.sidewalkCorridors) && world.sidewalkCorridors.length >= 500, 'Corredores de calçada de 10m gerados');
    assert.ok(Array.isArray(world.crosswalkZones) && world.crosswalkZones.length >= 500, 'Faixas de pedestres nos cruzamentos geradas');

    const groundRoads = (world.mapRoads || []).filter((r) => !r.isElevated && !r.isBridge);
    const overlaps = [];

    for (const b of world.mapBuildings || []) {
      if ((b.minY ?? 0) > 6.0) continue; // ignora passarelas aéreas elevadas
      const bMinX = b.x - b.w * 0.5 + 0.6;
      const bMaxX = b.x + b.w * 0.5 - 0.6;
      const bMinZ = b.z - b.d * 0.5 + 0.6;
      const bMaxZ = b.z + b.d * 0.5 - 0.6;

      for (const r of groundRoads) {
        const rMinX = r.x - r.w * 0.5 + 0.6;
        const rMaxX = r.x + r.w * 0.5 - 0.6;
        const rMinZ = r.z - r.d * 0.5 + 0.6;
        const rMaxZ = r.z + r.d * 0.5 - 0.6;
        if (bMinX < rMaxX && bMaxX > rMinX && bMinZ < rMaxZ && bMaxZ > rMinZ) {
          overlaps.push({ building: { x: b.x, z: b.z, w: b.w, d: b.d, label: b.label }, road: { x: r.x, z: r.z, w: r.w, d: r.d } });
          break;
        }
      }
    }

    assert.equal(overlaps.length, 0, `Prédios invadindo o asfalto das ruas: ${JSON.stringify(overlaps.slice(0, 5))}`);
  });

  it('3. Pedestres permanecem 100% nas calçadas de 10m / faixas de pedestres (inclusive fugindo em PÂNICO)', () => {
    const lc = world.livingCity;
    assert.ok(lc && lc.pedestrians.length > 0, 'Pedestres instanciados na Cidade Viva');

    const countAsphaltViolations = () =>
      lc.pedestrians.filter((p) => {
        if (p.isDeadCorpse || p.crossState === 'CROSSING') return false;
        const pos = p.visual.root.position;
        return Boolean(lc._isInsideAsphaltRoad?.(pos.x, pos.z, -0.6));
      });

    assert.equal(countAsphaltViolations().length, 0, 'Zero pedestres nascem no meio da rua');

    const playerPos = new THREE.Vector3(0, 0.5, -351);
    for (let step = 0; step < 30; step++) {
      lc.update(0.1, playerPos, null);
    }
    assert.equal(countAsphaltViolations().length, 0, 'Zero pedestres caminham fora da calçada/faixa na rotina normal');

    // Dispara pânico próximo aos pedestres e avança mais 30 steps
    for (const p of lc.pedestrians.slice(0, 25)) {
      p.state = 'PANIC';
      p.panicTimer = 6.0;
      // Força direção inicial tentando correr para o meio da rua!
      p.panicDirX = 1.0;
      p.panicDirZ = 1.0;
    }
    for (let step = 0; step < 30; step++) {
      lc.update(0.1, playerPos, null);
    }
    assert.equal(countAsphaltViolations().length, 0, 'Zero pedestres em PÂNICO invadem as faixas de carros');
  });

  it('4. Trânsito e carros estacionados respeitam o meio-fio (zero carros sobre as calçadas de 10m) e frotas válidas', () => {
    const lc = world.livingCity;
    const sidewalks = world.sidewalkCorridors || [];

    const trafficOnSidewalk = [];
    for (const tv of lc.trafficVehicles) {
      if (tv.isViaduct) continue;
      const vx = tv.mesh.position.x;
      const vz = tv.mesh.position.z;
      for (let i = 0; i < sidewalks.length; i++) {
        const s = sidewalks[i];
        if (vx > s.minX + 1.2 && vx < s.maxX - 1.2 && vz > s.minZ + 1.2 && vz < s.maxZ - 1.2) {
          trafficOnSidewalk.push({ x: vx, z: vz, blockId: s.blockId });
          break;
        }
      }
    }
    assert.equal(trafficOnSidewalk.length, 0, `Carros de trânsito invadindo calçada: ${JSON.stringify(trafficOnSidewalk.slice(0, 5))}`);

    const carrierAircraft = destructibles.objects.filter(
      (o) => o.type === 'car' && (o.mesh?.position?.y || 0) >= 400
    );
    assert.ok(carrierAircraft.length >= 4, 'Aeronaves estacionadas no Aeroporta-Aviões');
    for (const air of carrierAircraft) {
      const p = air.mesh.position;
      assert.ok(
        Math.abs(p.x) <= 51 && p.z >= -279 && p.z <= -21,
        `Aeronave do Aeroporta-Aviões dentro do convés rígido 1x: (${p.x}, ${p.y}, ${p.z})`
      );
    }
  });

  it('5. Todos os spawns das 10 regiões e marcos pousam em solo seco ou convés sólido e 0 colisores/vértices inválidos', () => {
    const checkSpawn = (id, s) => {
      assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z), `Spawn finito em ${id}`);
      if (s.y > 250) {
        const cols = world
          .getCollidersNear(s.x, s.z, 3)
          .filter((c) => s.x >= c.minX && s.x <= c.maxX && s.z >= c.minZ && s.z <= c.maxZ && c.maxY >= s.y - 4 && c.maxY <= s.y + 1.5);
        assert.ok(cols.length > 0, `Spawn aéreo ${id} tem convés/heliponto sólido abaixo: ${JSON.stringify(s)}`);
      } else if (s.y > -2) {
        assert.equal(world.isDeepWaterAt(s.x, s.z), false, `Spawn ${id} não pode cair em água profunda: ${JSON.stringify(s)}`);
        const surfY = world.getSurfaceHeightAt(s.x, s.z, s.y);
        assert.ok(Number.isFinite(surfY), `Altura de superfície finita em ${id}`);
      }
    };

    for (const reg of MAP_REGIONS) {
      checkSpawn(`region:${reg.id}`, reg.spawn);
    }
    for (const lm of world.landmarks || []) {
      if (lm.spawn) checkSpawn(`landmark:${lm.id}`, lm.spawn);
    }

    const invalidColliders = world.colliders.filter(
      (c) =>
        !Number.isFinite(c.minX) ||
        !Number.isFinite(c.maxX) ||
        !Number.isFinite(c.minY) ||
        !Number.isFinite(c.maxY) ||
        !Number.isFinite(c.minZ) ||
        !Number.isFinite(c.maxZ) ||
        c.minX > c.maxX ||
        c.minY > c.maxY ||
        c.minZ > c.maxZ
    );
    assert.equal(invalidColliders.length, 0, `Zero colisores inválidos ou invertidos no mapa 3x (encontrados: ${invalidColliders.length})`);

    let nanVerts = 0;
    scene.traverse((obj) => {
      const pos = obj.geometry?.attributes?.position;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) {
          nanVerts++;
        }
      }
    });
    assert.equal(nanVerts, 0, 'Zero vértices NaN em toda a cena 3x');
  });
});
