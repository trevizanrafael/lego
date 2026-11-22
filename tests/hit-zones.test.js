import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestEnvironment } from './setup-env.js';

setupTestEnvironment();

const {
  resolveHumanoidHitZone,
  getEffectiveHumanoidHeight
} = await import('../src/world/npc-health/HumanoidHitZones.js');
const {
  OPERATOR_WEAPONS,
  computeDistanceFalloffMultiplier,
  computeWeaponShotDamage
} = await import('../src/entities/operators/WeaponCatalog.js');
const { HumanoidHealthModel } = await import('../src/world/npc-health/HumanoidHealthModel.js');
const { DestructibleManager } = await import('../src/world/DestructibleManager.js');
const { LegoHud } = await import('../src/ui/LegoHud.js');
const {
  installDamageNumbersHud,
  DAMAGE_NUMBER_POOL_SIZE
} = await import('../src/ui/hud/DamageNumbersHud.js');

installDamageNumbersHud(LegoHud);

function createMockHumanoid({
  hp = 100,
  height = 2.1,
  unitScale = 1.0,
  kind = 'soldier',
  isCivilianPedestrian = false,
  isCombatNpc = true,
  isTankNpc = false,
  isBossNpc = false,
  unitType = null,
  hasArmoredHelmet = false,
  hasShield = false
} = {}) {
  const pos = new THREE.Vector3(0, 0, -25);
  const mesh = new THREE.Group();
  mesh.position.copy(pos);
  const humanoidHealth = new HumanoidHealthModel({ kind, maxHp: hp });
  return {
    destroyed: false,
    type: isCivilianPedestrian ? 'pedestrian' : 'npc_fighter',
    hp,
    maxHp: hp,
    height,
    unitScale,
    radius: 0.75,
    basePos: pos.clone(),
    mesh,
    colliders: [],
    debrisColors: [0xdc2626, 0x1e293b],
    studDrops: { silver: 1, gold: 0, blue: 0, purple: 0 },
    isCivilianPedestrian,
    isCombatNpc,
    isTankNpc,
    isBossNpc,
    unitType,
    hasArmoredHelmet,
    hasShield,
    humanoidHealth
  };
}

describe('Wave 1 W1-C — Body-Part Hit Zones, Stronger Sniper, Headshot Hitmarker & Pooled Damage Numbers', () => {
  it('1. resolveHumanoidHitZone resolves head (relY=0.85), torso (relY=0.55), and limbs (relY=0.20) on normal (2.1m) & scaled (3.8m) humanoids', () => {
    const normalNpc = createMockHumanoid({ height: 2.1, unitScale: 1.0 });
    assert.equal(getEffectiveHumanoidHeight(normalNpc), 2.1);

    const headStd = resolveHumanoidHitZone(normalNpc, { x: 0, y: 2.1 * 0.85, z: -25 });
    assert.equal(headStd.zone, 'head');
    assert.equal(headStd.isHeadshot, true);
    assert.equal(headStd.multiplier, 3.0);

    const headPrec = resolveHumanoidHitZone(normalNpc, { x: 0, y: 2.1 * 0.85, z: -25 }, { weaponKey: 'pcc_dmr' });
    assert.equal(headPrec.zone, 'head');
    assert.equal(headPrec.isHeadshot, true);
    assert.equal(headPrec.multiplier, 4.0);

    const torsoHit = resolveHumanoidHitZone(normalNpc, { x: 0, y: 2.1 * 0.55, z: -25 });
    assert.equal(torsoHit.zone, 'torso');
    assert.equal(torsoHit.isHeadshot, false);
    assert.equal(torsoHit.isLimb, false);
    assert.equal(torsoHit.multiplier, 1.0);

    const limbHit = resolveHumanoidHitZone(normalNpc, { x: 0, y: 2.1 * 0.20, z: -25 });
    assert.equal(limbHit.zone, 'limbs');
    assert.equal(limbHit.isLimb, true);
    assert.equal(limbHit.multiplier, 0.65);

    // Scaled 3.8m Big-Fig humanoid (must NOT double-multiply unitScale when height is already 3.8m)
    const scaledNpc = createMockHumanoid({ height: 3.8, unitScale: 1.8 });
    assert.equal(getEffectiveHumanoidHeight(scaledNpc), 3.8);

    const scaledHead = resolveHumanoidHitZone(scaledNpc, { x: 0, y: 3.8 * 0.85, z: -25 }, { weaponKey: 'pcc_dmr' });
    assert.equal(scaledHead.zone, 'head');
    assert.equal(scaledHead.isHeadshot, true);
    assert.equal(scaledHead.multiplier, 4.0);

    const scaledTorso = resolveHumanoidHitZone(scaledNpc, { x: 0, y: 3.8 * 0.55, z: -25 });
    assert.equal(scaledTorso.zone, 'torso');
    assert.equal(scaledTorso.multiplier, 1.0);

    const scaledLimb = resolveHumanoidHitZone(scaledNpc, { x: 0, y: 3.8 * 0.20, z: -25 });
    assert.equal(scaledLimb.zone, 'limbs');
    assert.equal(scaledLimb.multiplier, 0.65);

    // Far-away shooter muzzle falls back to torso so legacy callers don't register unintended limb hits
    const farMuzzleFallback = resolveHumanoidHitZone(normalNpc, { x: 0, y: 0.1, z: 15 });
    assert.equal(farMuzzleFallback.zone, 'torso');
    assert.equal(farMuzzleFallback.multiplier, 1.0);
  });

  it('2. pcc_dmr sniper deals ~70 body, 1-shot headshots 65 HP civ / 110 HP cop / 120 HP soldier / 150 HP riot troop, caps vs 600 HP boss, and has 0 falloff at 350m & 800m', () => {
    assert.equal(OPERATOR_WEAPONS.pcc_dmr.baseDamage, 78);
    assert.equal(OPERATOR_WEAPONS.pcc_dmr.isPrecisionWeapon, true);
    assert.equal(OPERATOR_WEAPONS.pcc_dmr.minFalloffMult, 1.0);
    assert.equal(computeDistanceFalloffMultiplier('pcc_dmr', 350), 1.0);
    assert.equal(computeDistanceFalloffMultiplier('pcc_dmr', 800), 1.0);

    // Contador has 0.90 damageMultiplier -> 78 * 0.90 = 70.2 body shot
    const dmrBodyRaw = computeWeaponShotDamage('pcc_dmr', 0.90, 350);
    assert.equal(dmrBodyRaw, 70.2);

    const scene = new THREE.Scene();
    const hud = new LegoHud();
    const destructibles = new DestructibleManager(scene, hud);
    const dmrOpts = (impactY) => ({
      sourceIsPlayer: true,
      weaponKey: 'pcc_dmr',
      isPrecisionWeapon: true,
      impactPoint: new THREE.Vector3(0, impactY, -25)
    });

    // Body shot deals ~70.2 damage on a 200 HP soldier (not crushed by 0.55!)
    const bodyTarget = createMockHumanoid({ hp: 200, kind: 'soldier' });
    destructibles.damageObject(bodyTarget, dmrBodyRaw, bodyTarget.basePos, false, dmrOpts(2.1 * 0.55));
    assert.ok(Math.abs((200 - bodyTarget.hp) - 70.2) < 0.5, `Expected ~70.2 body damage, got ${200 - bodyTarget.hp}`);
    assert.equal(bodyTarget.destroyed, false);

    // 1-shot headshot kills: 65 HP civilian, 110 HP cop, 120 HP soldier, AND 150 HP helmeted riot shock troop!
    const civ65 = createMockHumanoid({ hp: 65, kind: 'civilian', isCivilianPedestrian: true, isCombatNpc: false });
    destructibles.damageObject(civ65, dmrBodyRaw, civ65.basePos, false, dmrOpts(2.1 * 0.85));
    assert.equal(civ65.destroyed, true, '65 HP civilian dies in 1 sniper headshot');

    const cop110 = createMockHumanoid({ hp: 110, kind: 'police' });
    destructibles.damageObject(cop110, dmrBodyRaw, cop110.basePos, false, dmrOpts(2.1 * 0.85));
    assert.equal(cop110.destroyed, true, '110 HP cop dies in 1 sniper headshot (x4 -> ~280.8)');

    const soldier120 = createMockHumanoid({ hp: 120, kind: 'soldier' });
    destructibles.damageObject(soldier120, dmrBodyRaw, soldier120.basePos, false, dmrOpts(2.1 * 0.85));
    assert.equal(soldier120.destroyed, true, '120 HP soldier dies in 1 sniper headshot (x4 -> ~280.8)');

    const riot150 = createMockHumanoid({
      hp: 150,
      kind: 'police',
      unitType: 'riot',
      isTankNpc: true,
      hasArmoredHelmet: true,
      hasShield: true
    });
    destructibles.damageObject(riot150, dmrBodyRaw, riot150.basePos, false, dmrOpts(2.1 * 0.85));
    assert.equal(riot150.destroyed, true, '150 HP riot shock troop dies in 1 sniper headshot (x2.6 -> ~182.5)');

    // 600 HP Boss survives a sniper headshot with single-shot cap <= 220!
    const boss600 = createMockHumanoid({
      hp: 600,
      height: 3.8,
      kind: 'boss',
      isBossNpc: true,
      hasArmoredHelmet: true
    });
    destructibles.damageObject(boss600, dmrBodyRaw, boss600.basePos, false, dmrOpts(3.8 * 0.85));
    const bossDmgTaken = 600 - boss600.hp;
    assert.ok(bossDmgTaken > 100 && bossDmgTaken <= 220, `Boss headshot damage (${bossDmgTaken}) must be capped <= 220`);
    assert.equal(boss600.destroyed, false, '600 HP boss must survive a single sniper headshot');
    assert.ok(boss600.hp >= 380);
  });

  it('3. HitmarkerHud differentiates normal hit (is-hit), headshot (is-headshot + tink), and kill (is-kill)', () => {
    const hud = new LegoHud();

    hud.triggerHitmarker(false);
    assert.equal(hud.hitmarkerVariant, 'hit');
    assert.equal(hud.hitmarkerEl?.dataset?.variant, 'hit');
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-hit'), true);
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-headshot'), false);
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-kill'), false);

    hud.triggerHitmarker(false, { isHeadshot: true });
    assert.equal(hud.hitmarkerVariant, 'headshot');
    assert.equal(hud.hitmarkerEl?.dataset?.variant, 'headshot');
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-headshot'), true);
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-hit'), false);
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-kill'), false);

    hud.triggerHitmarker(true, { isHeadshot: true });
    assert.equal(hud.hitmarkerVariant, 'kill');
    assert.equal(hud.hitmarkerEl?.dataset?.variant, 'kill');
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-kill'), true);
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-headshot'), false);

    hud.updateHitmarkerHud(0.5);
    assert.equal(hud.isHitmarkerVisible, false);
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-headshot'), false);
    assert.equal(hud.hitmarkerEl?.classList?.contains('is-kill'), false);
  });

  it('4. DamageNumbersHud merges 8 shotgun pellets within 0.25s into 1 slot and keeps fixed 12-node DOM pool after 50+ shots', () => {
    const hud = new LegoHud();
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 1000);
    cam.position.set(0, 2, 10);
    cam.lookAt(0, 1.5, -15);
    cam.updateMatrixWorld(true);
    hud.updateDamageNumbersHud(0.016, cam);

    const target = { id: 'shotgun_victim', basePos: new THREE.Vector3(0, 0, -15) };
    const pelletDmg = 5.25;
    for (let p = 0; p < 8; p++) {
      hud.spawnDamageNumber({
        amount: pelletDmg,
        worldPos: { x: 0, y: 1.4, z: -15 },
        targetObj: target,
        zone: 'torso',
        isHeadshot: false,
        isKill: false
      });
    }

    const layer = hud.damageNumbersLayerEl;
    assert.ok(layer, '#damage-numbers-layer must be initialized');
    assert.equal(layer.children.length, DAMAGE_NUMBER_POOL_SIZE, 'Pool must have exact 12 pre-allocated DOM spans');

    const activeSlots = hud._damageNumberSlots.filter((s) => s.active);
    assert.equal(activeSlots.length, 1, '8 shotgun pellets on same target within 0.25s must merge into 1 active slot');
    assert.equal(activeSlots[0].accumDamage, 8 * pelletDmg);
    assert.equal(activeSlots[0].el.textContent, String(Math.round(8 * pelletDmg)));

    // Fire 55 distinct shots across distinct targets and ensure ZERO extra DOM nodes are ever allocated!
    const origCreateElement = globalThis.document.createElement;
    let extraAllocations = 0;
    globalThis.document.createElement = (...args) => {
      extraAllocations++;
      return origCreateElement.apply(globalThis.document, args);
    };
    try {
      for (let i = 0; i < 55; i++) {
        hud.spawnDamageNumber({
          amount: 24 + i,
          worldPos: { x: (i % 5) - 2, y: 1.8, z: -15 },
          targetObj: { id: `enemy_${i}` },
          zone: i % 3 === 0 ? 'head' : 'torso',
          isHeadshot: i % 3 === 0,
          isKill: i % 7 === 0
        });
        hud.updateDamageNumbersHud(0.02, cam);
      }
    } finally {
      globalThis.document.createElement = origCreateElement;
    }

    assert.equal(extraAllocations, 0, 'Zero document.createElement calls allowed after _initDamageNumbersHud()');
    assert.equal(layer.children.length, 12, 'DOM children count remains strictly 12 after 50+ shots');
  });
});
