import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment, resetTestListeners } from './setup-env.js';

setupTestEnvironment();

const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { TestBlockWorld } = await import('../src/world/TestBlockWorld.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const { CollisionDebugOverlay, isCollisionDebugAllowed } = await import('../src/world/collision/CollisionDebugOverlay.js');

function collectIgnoredSubtrees(world) {
  const ignored = new Set();
  const mark = (root) => {
    if (root && typeof root.traverse === 'function') root.traverse((n) => ignored.add(n));
  };
  mark(world.beaconGroup);
  mark(world.atmosphere?.celestialRoot);
  for (const c of world.clouds || []) mark(c);
  if (world.destructibles) {
    mark(world.destructibles.solarBeamGroup);
    mark(world.destructibles.solarMuzzleGroup);
    mark(world.destructibles.beamHitSphere);
    mark(world.destructibles.supernovaChargeGroup);
    for (const s of world.destructibles.ambientStuds || []) mark(s?.mesh);
  }
  return ignored;
}

function isWaterOrSkyMesh(mesh, world) {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mat) return false;
  if (mat.side === THREE.BackSide) return true;
  if (mat.uniforms && (mat.uniforms.uTime || mat.uniforms === world.waterShaderUniforms)) return true;
  return Boolean(mesh.userData?.isWater || mesh.userData?.isOcean);
}

function computeUpperSliceFootprint(meshes, yThreshold) {
  const v = new THREE.Vector3();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, count = 0;
  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m];
    const posAttr = mesh.geometry?.attributes?.position;
    if (!posAttr) continue;
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      if (v.y >= yThreshold) {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.z < minZ) minZ = v.z;
        if (v.z > maxZ) maxZ = v.z;
        count++;
      }
    }
  }
  return count >= 3 ? { spanX: maxX - minX, spanZ: maxZ - minZ } : null;
}

export function auditWorldCollisions(world, opts = {}) {
  if (world.scene) world.scene.updateMatrixWorld(true);
  const byRegion = new Map();
  const ensureRegion = (x, y, z) => {
    const reg = typeof world.getRegionAt === 'function' ? world.getRegionAt(x, y, z) : { id: 'default', shortName: 'DEFAULT' };
    const id = reg?.id || 'unknown';
    let entry = byRegion.get(id);
    if (!entry) {
      entry = { id, name: reg?.shortName || reg?.name || id, colliders: 0, dynamic: 0, thin: 0, shaped: 0, scannedMeshes: 0, uncollided: 0, setbackMismatches: 0 };
      byRegion.set(id, entry);
    }
    return entry;
  };

  const invalidColliders = [];
  const nonFiniteColliders = [];
  const invertedBoundsColliders = [];
  let activeColliders = 0, disabledColliders = 0, dynamicColliders = 0, thinColliders = 0, shapedColliders = 0;

  const allColliders = world.colliders || [];
  for (let i = 0; i < allColliders.length; i++) {
    const col = allColliders[i];
    if (!col) {
      const err = { index: i, reason: 'null_collider' };
      nonFiniteColliders.push(err);
      invalidColliders.push(err);
      continue;
    }
    if (col.disabled) {
      disabledColliders++;
      continue;
    }
    activeColliders++;
    const coords = [col.minX, col.maxX, col.minY, col.maxY, col.minZ, col.maxZ];
    if (!coords.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      const err = { index: i, reason: 'non_finite_number', col };
      nonFiniteColliders.push(err);
      invalidColliders.push(err);
      continue;
    }
    if (col.minX > col.maxX || col.minY > col.maxY || col.minZ > col.maxZ) {
      const err = { index: i, reason: 'inverted_bounds', col };
      invertedBoundsColliders.push(err);
      invalidColliders.push(err);
    }

    const w = Math.abs(col.maxX - col.minX), d = Math.abs(col.maxZ - col.minZ);
    const regEntry = ensureRegion((col.minX + col.maxX) * 0.5, (col.minY + col.maxY) * 0.5, (col.minZ + col.maxZ) * 0.5);
    regEntry.colliders++;
    if (col.isDynamic) { dynamicColliders++; regEntry.dynamic++; }
    if (w < 0.6 || d < 0.6) { thinColliders++; regEntry.thin++; }
    if (col.shapeType && col.shapeType !== 'box') { shapedColliders++; regEntry.shaped++; }
  }

  const ignoredNodes = collectIgnoredSubtrees(world);
  const boxScratch = new THREE.Box3();
  const nearScratch = [];
  const uncollidedStructures = [];
  const setbackMismatches = [];
  const auditedGroups = new Set();
  let scannedMeshes = 0;

  const walkScene = (node) => {
    if (!node || !node.visible || ignoredNodes.has(node) || node.name === 'CollisionDebugOverlay') return;
    if (node.isMesh && !node.isInstancedMesh && node.geometry && !isWaterOrSkyMesh(node, world)) {
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      if (node.geometry.boundingBox && !node.geometry.boundingBox.isEmpty()) {
        boxScratch.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
        const spanX = boxScratch.max.x - boxScratch.min.x;
        const height = boxScratch.max.y - boxScratch.min.y;
        const spanZ = boxScratch.max.z - boxScratch.min.z;

        if (height >= 0.45 && spanX <= 145 && spanZ <= 145 && !(spanX < 1.5 && height < 1.5 && spanZ < 1.5) && Number.isFinite(spanX + height + spanZ)) {
          scannedMeshes++;
          const cx = (boxScratch.min.x + boxScratch.max.x) * 0.5;
          const cy = (boxScratch.min.y + boxScratch.max.y) * 0.5;
          const cz = (boxScratch.min.z + boxScratch.max.z) * 0.5;
          const regEntry = ensureRegion(cx, cy, cz);
          regEntry.scannedMeshes++;

          const nearby = typeof world.getCollidersNear === 'function'
            ? world.getCollidersNear(cx, cz, Math.hypot(spanX, spanZ) * 0.5 + 1.0, nearScratch)
            : allColliders;

          if (spanX >= 2.5 && spanZ >= 2.5 && height >= 2.5) {
            let hasOverlap = false;
            for (let i = 0; i < nearby.length; i++) {
              const c = nearby[i];
              if (!c || c.disabled) continue;
              const cMinY = Math.min(c.minY, c.maxY), cMaxY = Math.max(c.minY, c.maxY);
              if (c.maxX > boxScratch.min.x + 0.05 && c.minX < boxScratch.max.x - 0.05 && cMaxY > boxScratch.min.y + 0.05 && cMinY < boxScratch.max.y - 0.05 && c.maxZ > boxScratch.min.z + 0.05 && c.minZ < boxScratch.max.z - 0.05) {
                hasOverlap = true;
                break;
              }
            }
            if (!hasOverlap) {
              regEntry.uncollided++;
              uncollidedStructures.push({ regionId: regEntry.id, cx: Math.round(cx), cy: Math.round(cy), cz: Math.round(cz), spanX: +spanX.toFixed(1), height: +height.toFixed(1), spanZ: +spanZ.toFixed(1) });
            }
          }

          const bGroup = node.parent?.userData?.isDetailedBuilding ? node.parent : null;
          if (bGroup && !auditedGroups.has(bGroup)) {
            auditedGroups.add(bGroup);
            const bH = bGroup.userData.height || height, bW = bGroup.userData.width || spanX, bD = bGroup.userData.depth || spanZ;
            if (bH >= 36 && bW >= 14 && bD >= 14) {
              const upper = computeUpperSliceFootprint(bGroup.children.filter((c) => c.isMesh), bGroup.position.y + bH * 0.78);
              if (upper) {
                const probeY = bGroup.position.y + bH * 0.88, gx = bGroup.position.x, gz = bGroup.position.z;
                const bNear = typeof world.getCollidersNear === 'function' ? world.getCollidersNear(gx, gz, Math.max(bW, bD) * 0.6, nearScratch) : allColliders;
                for (let i = 0; i < bNear.length; i++) {
                  const col = bNear[i];
                  if (col && !col.disabled && gx >= col.minX && gx <= col.maxX && gz >= col.minZ && gz <= col.maxZ && probeY >= col.minY && probeY <= col.maxY) {
                    const colW = col.maxX - col.minX, colD = col.maxZ - col.minZ;
                    if (colW - upper.spanX > 2.2 || colD - upper.spanZ > 2.2) {
                      regEntry.setbackMismatches++;
                      setbackMismatches.push({ regionId: regEntry.id, cx: Math.round(gx), cz: Math.round(gz), height: bH, colW: +colW.toFixed(1), upperW: +upper.spanX.toFixed(1) });
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    for (let i = 0; i < (node.children?.length || 0); i++) walkScene(node.children[i]);
  };

  if (world.scene) walkScene(world.scene);

  const regionRows = Array.from(byRegion.values()).sort((a, b) => b.colliders - a.colliders);
  if (opts.log !== false) {
    const lines = [
      `[CollisionAudit] Total=${allColliders.length} (active=${activeColliders}, dyn=${dynamicColliders}, thin=${thinColliders}, shaped=${shapedColliders}, invalid=${invalidColliders.length}) | Meshes=${scannedMeshes} | UncollidedLarge=${uncollidedStructures.length} | SetbackOverBox=${setbackMismatches.length}`
    ];
    for (const r of regionRows) {
      lines.push(`  - ${r.id.padEnd(22)} | cols=${String(r.colliders).padStart(4)} dyn=${String(r.dynamic).padStart(3)} thin=${String(r.thin).padStart(4)} | meshes=${String(r.scannedMeshes).padStart(4)} uncollided=${String(r.uncollided).padStart(3)} setbackOverBox=${String(r.setbackMismatches).padStart(3)}`);
    }
    if (invertedBoundsColliders.length > 0) {
      lines.push(`  [!] Legacy inverted minY>maxY colliders (${invertedBoundsColliders.length}): indices [${invertedBoundsColliders.map((e) => e.index).join(', ')}]`);
    }
    console.info(lines.join('\n'));
  }

  return {
    totalColliders: allColliders.length,
    activeColliders,
    disabledColliders,
    dynamicColliders,
    thinColliders,
    shapedColliders,
    invalidColliders,
    nonFiniteColliders,
    invertedBoundsColliders,
    scannedMeshes,
    uncollidedStructures,
    setbackMismatches,
    byRegion: Object.fromEntries(regionRows.map((r) => [r.id, r]))
  };
}

function isKnownPreWave2InvertedY(col) {
  const isBankVaultLintel = Math.abs((col.minZ + col.maxZ) * 0.5 - -206) < 0.5 && Math.abs(col.minY - 40.96) < 0.2;
  const isPrisonSkybridge = col.minX >= 1130 && col.maxX <= 1620 && col.minZ >= 1250 && col.maxZ <= 1790 && Math.abs(col.minY - 36.9) < 0.2 && Math.abs(col.maxY - 6.5) < 0.2;
  return isBankVaultLintel || isPrisonSkybridge;
}

describe('Onda 1 — World Collision Integrity Audit & F8 Wireframe CollisionDebugOverlay', () => {
  let sharedScene, sharedWorld;

  before(() => {
    resetTestListeners();
    sharedScene = new THREE.Scene();
    const hud = new LegoHud(35000);
    hud.isTitleScreenActive = false;
    const destructibles = new DestructibleManager(sharedScene, hud);
    sharedWorld = new TestBlockWorld(sharedScene, destructibles);
  });

  it('1. TestBlockWorld possui 0 NaN/limites XZ invertidos e categoriza colisores finos, malhas sem colisor e setbacks por região', () => {
    const report = auditWorldCollisions(sharedWorld, { log: true });

    assert.ok(report.activeColliders >= 500, `Esperava centenas de colisores ativos (atual: ${report.activeColliders})`);
    assert.equal(report.nonFiniteColliders.length, 0, 'Zero colisores com NaN ou Infinity');

    const invertedXZ = report.invertedBoundsColliders.filter(({ col }) => col.minX > col.maxX || col.minZ > col.maxZ);
    assert.equal(invertedXZ.length, 0, 'Zero colisores com limites X ou Z invertidos');

    const unexpectedInvertedY = report.invertedBoundsColliders.filter(({ col }) => !isKnownPreWave2InvertedY(col));
    assert.equal(unexpectedInvertedY.length, 0, `Limites Y invertidos inesperados: ${JSON.stringify(unexpectedInvertedY)}`);

    assert.ok(report.scannedMeshes >= 100 && Object.keys(report.byRegion).length >= 8);
    const mockScene = new THREE.Scene();
    const uncollidedMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), new THREE.MeshBasicMaterial());
    uncollidedMesh.position.set(20, 2.5, 20);
    mockScene.add(uncollidedMesh);
    const synthReport = auditWorldCollisions({
      scene: mockScene,
      colliders: [
        { minX: 0, maxX: 0.4, minY: 0, maxY: 2, minZ: 0, maxZ: 4, disabled: false },
        { minX: NaN, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1, disabled: false },
        { minX: 5, maxX: 2, minY: 0, maxY: 2, minZ: 0, maxZ: 2, disabled: false }
      ]
    }, { log: false });
    assert.equal(synthReport.thinColliders, 1);
    assert.equal(synthReport.nonFiniteColliders.length, 1);
    assert.equal(synthReport.invertedBoundsColliders.length, 1);
    assert.equal(synthReport.uncollidedStructures.length, 1);
  });

  it('2. CollisionDebugOverlay bloqueia sem ?debug=1, ativa via flag/URL, desenha 4 buffers wireframe a 10 Hz e limpa no dispose()', () => {
    delete globalThis.__ENABLE_COLLISION_DEBUG;
    const prevLocation = globalThis.window.location;
    delete globalThis.window.location;

    const overlay = new CollisionDebugOverlay(sharedScene);
    try {
      assert.equal(isCollisionDebugAllowed(), false);
      assert.equal(overlay.toggle(), false);
      assert.equal(overlay.enabled, false);
      assert.equal(overlay.rootGroup.visible, false);
      assert.equal(overlay.rootGroup.name, 'CollisionDebugOverlay');
      assert.equal(overlay.rootGroup.renderOrder, 999);

      globalThis.window.location = { search: '?debug=1' };
      assert.equal(isCollisionDebugAllowed(), true);
      delete globalThis.window.location;

      globalThis.__ENABLE_COLLISION_DEBUG = true;
      assert.equal(overlay.toggle(), true);
      assert.equal(overlay.rootGroup.visible, true);

      const obbCol = { minX: -6, maxX: 6, minY: 0, maxY: 3.2, minZ: -158, maxZ: -146, cx: 0, cz: -152, halfX: 2.4, halfZ: 4.8, yaw: Math.PI / 6, shapeType: 'obb', isDynamic: false, disabled: false };
      const cylCol = { minX: 8, maxX: 12, minY: 0, maxY: 6.0, minZ: -154, maxZ: -150, cx: 10, cz: -152, radius: 2.0, shapeType: 'cylinder', isDynamic: false, disabled: false };
      const dynCol = { minX: -12, maxX: -8, minY: 0, maxY: 2.2, minZ: -154, maxZ: -148, isDynamic: true, disabled: false };
      const farCol = { minX: 700, maxX: 710, minY: 0, maxY: 10, minZ: 700, maxZ: 710, isDynamic: true, disabled: false };
      sharedWorld.colliders.push(obbCol, cylCol, dynCol, farCol);
      sharedWorld._dynamicColliders.push(dynCol, farCol);
      const gridCell = ((Math.floor(0 / 32) & 0xffff) << 16) | (Math.floor(-152 / 32) & 0xffff);
      const bucket = sharedWorld._colliderGrid.get(gridCell) || [];
      bucket.push(obbCol, cylCol);
      sharedWorld._colliderGrid.set(gridCell, bucket);

      const fakeFoot = { mesh: { position: new THREE.Vector3(3, 0, -150), rotation: { y: 0.4 } }, heading: 0.4 };
      sharedWorld.livingCity.wantedSystem.footUnits.push(fakeFoot);

      const playerPos = new THREE.Vector3(0, 1.0, -150);
      assert.equal(overlay.update(0.016, sharedWorld, playerPos, null), true);
      assert.equal(overlay.update(0.02, sharedWorld, playerPos, null), false, 'Cadência de 10 Hz (0.10s)');
      assert.equal(overlay.update(0.10, sharedWorld, playerPos, null), true);

      assert.ok(overlay.lastStats.staticCount > 0 && overlay.lastStats.dynamicCount >= 1);
      assert.ok(overlay.lastStats.shapedCount >= 2 && overlay.lastStats.npcCount >= 1 && overlay.lastStats.coneCount >= 1);
      assert.ok(overlay.staticLines.geometry.drawRange.count >= 24);
      assert.ok(overlay.dynamicLines.geometry.drawRange.count >= 24);
      assert.ok(overlay.shapedLines.geometry.drawRange.count >= 120, 'OBB (24) + Cilindro 16-seg (96)');
      assert.ok(overlay.agentAndRayLines.geometry.drawRange.count > 20);

      sharedWorld.livingCity.wantedSystem.footUnits.pop();
      sharedWorld._dynamicColliders.length -= 2;
      bucket.splice(bucket.indexOf(obbCol), 1);
      bucket.splice(bucket.indexOf(cylCol), 1);
      sharedWorld.colliders.length -= 4;

      assert.equal(overlay.toggle(), false);
      assert.equal(overlay.rootGroup.visible, false);
      assert.equal(overlay.staticLines.geometry.drawRange.count, 0);
      overlay.dispose();
      assert.equal(overlay.rootGroup.parent, null);
    } finally {
      delete globalThis.__ENABLE_COLLISION_DEBUG;
      if (prevLocation === undefined) delete globalThis.window.location;
      else globalThis.window.location = prevLocation;
    }
  });
});
