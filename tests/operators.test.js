import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TACTICAL_ROLE_KEYS,
  ROLE_BASELINES,
  blendRoleBaselines,
  doesRoleUnionCoverAllRoles,
  applyIncomingDamageMitigation
} from '../src/entities/operators/RoleBaselines.js';

import {
  CAVEIRA_RIFLE_BASELINE_DAMAGE,
  OPERATOR_WEAPONS,
  computeDistanceFalloffMultiplier,
  computeChargeDamageMultiplier,
  computeWeaponShotDamage,
  computeWeaponBurstDamage
} from '../src/entities/operators/WeaponCatalog.js';

import {
  FACTION_OPERATORS,
  OPERATOR_KEYS_LIST,
  isFactionOperatorKey,
  getOperatorSpec,
  getFactionPairOperators,
  getDefaultHybridOperatorKey,
  resolveCombatantSheet
} from '../src/entities/operators/OperatorCatalog.js';

import {
  EXTRA_CHARACTER_PRICES,
  EXTRAS_CATALOG,
  HERO_EXTRA_QE_DESCRIPTORS,
  getCharacterAbilityDescriptors,
  getPlayableRosterForFaction,
  isCharacterUnlocked,
  getCharacterPrice,
  purchaseExtraCharacter,
  unlockDefeatedBossExtra,
  migrateSaveSlotRoster,
  resolveFactionSwitchRoster
} from '../src/progression/RosterAndUnlocks.js';

describe('Wave 1 O1-A — Faction Operators, Weapons, Roles & Roster Progression', () => {
  it('1. RoleBaselines: pure baselines, 2-role hybrid blending, and incoming damage mitigation clamp', () => {
    assert.deepEqual(TACTICAL_ROLE_KEYS, ['tank', 'damage', 'support']);

    assert.equal(ROLE_BASELINES.tank.baseHp, 420);
    assert.equal(ROLE_BASELINES.tank.damageReduction, 0.30);
    assert.equal(ROLE_BASELINES.tank.baseSpeedMult, 0.85);
    assert.equal(ROLE_BASELINES.tank.baseDamageMult, 0.75);

    assert.equal(ROLE_BASELINES.damage.baseHp, 210);
    assert.equal(ROLE_BASELINES.damage.damageReduction, 0.0);
    assert.equal(ROLE_BASELINES.damage.baseSpeedMult, 1.05);
    assert.equal(ROLE_BASELINES.damage.baseDamageMult, 1.15);

    assert.equal(ROLE_BASELINES.support.baseHp, 240);
    assert.equal(ROLE_BASELINES.support.damageReduction, 0.0);
    assert.equal(ROLE_BASELINES.support.baseSpeedMult, 1.00);
    assert.equal(ROLE_BASELINES.support.baseDamageMult, 0.55);

    // Pure single-role returns exact baseline
    assert.equal(blendRoleBaselines(['tank']), ROLE_BASELINES.tank);
    assert.equal(blendRoleBaselines(['damage']), ROLE_BASELINES.damage);
    assert.equal(blendRoleBaselines(['support']), ROLE_BASELINES.support);

    // 2-role hybrids blend damageReduction and format localized role titles
    const tankDamage = blendRoleBaselines(['tank', 'damage']);
    assert.equal(tankDamage.damageReduction, 0.20);
    assert.equal(tankDamage.label['pt-BR'], 'Tanque-Dano');
    assert.equal(tankDamage.label['en-US'], 'Tank-Damage');

    // Order-independent canonical normalization
    assert.equal(blendRoleBaselines(['damage', 'tank']), tankDamage);

    const damageSupport = blendRoleBaselines(['damage', 'support']);
    assert.equal(damageSupport.damageReduction, 0.05);
    assert.equal(damageSupport.label['pt-BR'], 'Dano-Suporte');
    assert.equal(damageSupport.label['en-US'], 'Damage-Support');

    const tankSupport = blendRoleBaselines(['tank', 'support']);
    assert.equal(tankSupport.damageReduction, 0.25);
    assert.equal(tankSupport.label['pt-BR'], 'Tanque-Suporte');
    assert.equal(tankSupport.label['en-US'], 'Tank-Support');

    // Damage mitigation math clamped to [0, 0.65] with minimum 1 damage when rawDamage > 0
    assert.equal(applyIncomingDamageMitigation(0, 0.30), 0);
    assert.equal(applyIncomingDamageMitigation(-15, 0.30), 0);
    assert.equal(applyIncomingDamageMitigation(100, -0.25), 100);
    assert.equal(applyIncomingDamageMitigation(100, 0.30), 70);
    assert.equal(applyIncomingDamageMitigation(100, 0.90), 35); // clamped at 0.65 -> 35
    assert.equal(applyIncomingDamageMitigation(1, 0.65), 1); // minimum 1 when rawDamage > 0
  });

  it('2. Every faction (cv, pcc, ares) has exact 2 operators (1 hybrid + 1 pure) covering all 3 roles', () => {
    assert.equal(OPERATOR_KEYS_LIST.length, 6);

    const expectedDefaults = {
      cv: 'cv_marretao',
      pcc: 'pcc_contador',
      ares: 'ares_bastiao'
    };

    for (const faction of ['cv', 'pcc', 'ares']) {
      const pair = getFactionPairOperators(faction);
      assert.equal(pair.length, 2, `${faction} must have exactly 2 operators`);

      const [primaryHybrid, secondaryPure] = pair;
      assert.equal(primaryHybrid.slotOrder, 1);
      assert.equal(primaryHybrid.roles.length, 2, `${primaryHybrid.key} must be a 2-role hybrid`);
      assert.equal(primaryHybrid.key, getDefaultHybridOperatorKey(faction));
      assert.equal(primaryHybrid.key, expectedDefaults[faction]);

      assert.equal(secondaryPure.slotOrder, 2);
      assert.equal(secondaryPure.roles.length, 1, `${secondaryPure.key} must be a 1-role pure specialist`);

      assert.equal(
        doesRoleUnionCoverAllRoles([primaryHybrid.roles, secondaryPure.roles]),
        true,
        `${faction} pair must cover tank, damage, and support with zero missing roles`
      );
    }
  });

  it('3. Exact approved Operator stats, Q/E cooldowns, and WeaponCatalog falloff/charge/spinup specs', () => {
    assert.equal(CAVEIRA_RIFLE_BASELINE_DAMAGE, 14);
    assert.equal(Object.isFrozen(FACTION_OPERATORS), true);
    assert.equal(Object.isFrozen(OPERATOR_WEAPONS), true);

    const expectedSpecs = [
      { key: 'cv_marretao', faction: 'cv', hp: 380, dmg: 1.00, spd: 0.88, red: 0.20, weapon: 'cv_lmg', qCd: 15, eCd: 20 },
      { key: 'cv_fogueteira', faction: 'cv', hp: 240, dmg: 0.55, spd: 1.00, red: 0.00, weapon: 'cv_pistol', qCd: 14, eCd: 16 },
      { key: 'pcc_contador', faction: 'pcc', hp: 260, dmg: 0.90, spd: 1.00, red: 0.05, weapon: 'pcc_dmr', qCd: 16, eCd: 12 },
      { key: 'pcc_muralha', faction: 'pcc', hp: 420, dmg: 0.75, spd: 0.85, red: 0.30, weapon: 'pcc_shotgun12', qCd: 14, eCd: 12 },
      { key: 'ares_bastiao', faction: 'ares', hp: 400, dmg: 0.70, spd: 0.85, red: 0.25, weapon: 'ares_pulse_minigun', qCd: 18, eCd: 16 },
      { key: 'ares_agulha', faction: 'ares', hp: 200, dmg: 1.20, spd: 1.05, red: 0.00, weapon: 'ares_charge_rifle', qCd: 14, eCd: 13 }
    ];

    for (const exp of expectedSpecs) {
      assert.equal(isFactionOperatorKey(exp.key), true);
      const op = getOperatorSpec(exp.key);
      assert.ok(op);
      assert.equal(op.faction, exp.faction);
      assert.equal(op.hp, exp.hp);
      assert.equal(op.damageMultiplier, exp.dmg);
      assert.equal(op.speedMultiplier, exp.spd);
      assert.equal(op.damageReduction, exp.red);
      assert.equal(op.weaponKey, exp.weapon);
      assert.equal(op.extraPrice, 400000);
      assert.equal(op.abilities.q.cooldownSec, exp.qCd);
      assert.equal(op.abilities.e.cooldownSec, exp.eCd);
      assert.ok(OPERATOR_WEAPONS[op.weaponKey], `Missing weapon ${op.weaponKey}`);
    }

    // Spinup spec check on Bastião-7 pulse minigun
    assert.equal(OPERATOR_WEAPONS.ares_pulse_minigun.fireMode, 'spinup_auto');
    assert.equal(OPERATOR_WEAPONS.ares_pulse_minigun.spinupSec, 0.6);

    // Shotgun point-blank burst math: 7 * 8 = 56 raw -> 42 with Muralha's 0.75 mult at <= 8m
    assert.equal(computeWeaponShotDamage('pcc_shotgun12', 1.0, 5), 7);
    assert.equal(computeWeaponBurstDamage('pcc_shotgun12', 1.0, 5), 56);
    assert.equal(computeWeaponBurstDamage('pcc_shotgun12', 0.75, 5), 42);
    // Shotgun max falloff at >= 24m (minFalloffMult = 0.22)
    assert.equal(computeDistanceFalloffMultiplier('pcc_shotgun12', 24), 0.22);
    assert.equal(computeWeaponBurstDamage('pcc_shotgun12', 0.75, 30), Number((42 * 0.22).toFixed(4)));

    // Linear midpoint falloff check on CV LMG (28m..68m, minFalloffMult 0.55 -> midpoint 48m = 0.775)
    assert.equal(computeDistanceFalloffMultiplier('cv_lmg', 48), 0.775);
    assert.equal(computeWeaponShotDamage('cv_lmg', 1.0, 48), Number((14 * 0.775).toFixed(4)));

    // Charge rifle scaling on Agulha (28 base * 1.20 op mult * [0.42..2.35] charge)
    assert.equal(computeChargeDamageMultiplier('ares_charge_rifle', 0), 0.42);
    assert.equal(computeChargeDamageMultiplier('ares_charge_rifle', 1), 2.35);
    assert.equal(computeWeaponShotDamage('ares_charge_rifle', 1.20, 40, 0), Number((28 * 1.2 * 0.42).toFixed(4)));
    assert.equal(computeWeaponShotDamage('ares_charge_rifle', 1.20, 40, 1), Number((28 * 1.2 * 2.35).toFixed(4)));
  });

  it('4. Deserter allegiance in resolveCombatantSheet sets effectiveFaction to active alliance', () => {
    const deserterSheet = resolveCombatantSheet('pcc_muralha', 'cv');
    assert.equal(deserterSheet.characterKey, 'pcc_muralha');
    assert.equal(deserterSheet.originFaction, 'pcc');
    assert.equal(deserterSheet.effectiveFaction, 'cv');
    assert.equal(deserterSheet.isDeserter, true);
    assert.equal(deserterSheet.hp, 420);
    assert.equal(deserterSheet.weapon.key, 'pcc_shotgun12');

    const nativeSheet = resolveCombatantSheet('cv_marretao', 'cv');
    assert.equal(nativeSheet.originFaction, 'cv');
    assert.equal(nativeSheet.effectiveFaction, 'cv');
    assert.equal(nativeSheet.isDeserter, false);
  });

  it('5. RosterAndUnlocks: free pair, stud purchases, boss unlocks, faction switch, and legacy save migration', () => {
    // Free faction pair vs locked extras
    const cvRoster = getPlayableRosterForFaction('cv', []);
    assert.deepEqual(cvRoster.primaryPair.map((op) => op.key), ['cv_marretao', 'cv_fogueteira']);
    assert.equal(cvRoster.extras.length, 16); // 4 rival ops + op09 + 8 classic heroes + 3 bosses
    assert.equal(isCharacterUnlocked('cv_marretao', 'cv', []), true);
    assert.equal(isCharacterUnlocked('cv_fogueteira', 'cv', []), true);
    assert.equal(isCharacterUnlocked('pcc_muralha', 'cv', []), false);
    assert.equal(isCharacterUnlocked('solaris', 'cv', []), false);

    // Prices
    assert.equal(getCharacterPrice('cv_marretao', 'cv'), 0);
    assert.equal(getCharacterPrice('pcc_muralha', 'cv'), 400_000);
    assert.equal(getCharacterPrice('caveira', 'cv'), 250_000);
    assert.equal(getCharacterPrice('op09', 'cv'), 300_000);
    assert.equal(getCharacterPrice('vortex', 'cv'), 1_000_000);
    assert.equal(getCharacterPrice('boss_ares', 'cv'), 0);
    assert.equal(EXTRA_CHARACTER_PRICES.tita, 900_000);

    // Insufficient studs purchase check
    const failLowStuds = purchaseExtraCharacter({
      charKey: 'pcc_muralha',
      playerFaction: 'cv',
      currentStuds: 150_000,
      unlockedExtras: []
    });
    assert.equal(failLowStuds.ok, false);
    assert.equal(failLowStuds.reason, 'insufficient_studs');
    assert.equal(failLowStuds.missingStuds, 250_000);
    assert.equal(failLowStuds.remainingStuds, 150_000);

    // Successful stud purchase + duplicate prevention
    const buyMuralha = purchaseExtraCharacter({
      charKey: 'pcc_muralha',
      playerFaction: 'cv',
      currentStuds: 500_000,
      unlockedExtras: []
    });
    assert.equal(buyMuralha.ok, true);
    assert.equal(buyMuralha.cost, 400_000);
    assert.equal(buyMuralha.remainingStuds, 100_000);
    assert.deepEqual(buyMuralha.unlockedExtras, ['pcc_muralha']);

    const dupBuy = purchaseExtraCharacter({
      charKey: 'pcc_muralha',
      playerFaction: 'cv',
      currentStuds: 900_000,
      unlockedExtras: buyMuralha.unlockedExtras
    });
    assert.equal(dupBuy.ok, false);
    assert.equal(dupBuy.reason, 'already_unlocked');

    // Bosses cannot be bought with studs; unlocked idempotently via unlockDefeatedBossExtra
    const bossBuyAttempt = purchaseExtraCharacter({
      charKey: 'boss_pcc',
      playerFaction: 'cv',
      currentStuds: 9_000_000,
      unlockedExtras: buyMuralha.unlockedExtras
    });
    assert.equal(bossBuyAttempt.ok, false);
    assert.equal(bossBuyAttempt.reason, 'not_purchasable_with_studs');

    const bossUnlock1 = unlockDefeatedBossExtra('pcc', buyMuralha.unlockedExtras);
    assert.equal(bossUnlock1.ok, true);
    assert.equal(bossUnlock1.bossKey, 'boss_pcc');
    assert.equal(bossUnlock1.newlyUnlocked, true);
    assert.deepEqual(bossUnlock1.unlockedExtras, ['pcc_muralha', 'boss_pcc']);

    const bossUnlock2 = unlockDefeatedBossExtra('pcc', bossUnlock1.unlockedExtras);
    assert.equal(bossUnlock2.newlyUnlocked, false);
    assert.deepEqual(bossUnlock2.unlockedExtras, ['pcc_muralha', 'boss_pcc']);

    // Faction switch in Pause: replaces free pair, keeps bought extras, resets unbought former free op
    const switchedFromFree = resolveFactionSwitchRoster('ares', 'cv_marretao', bossUnlock1.unlockedExtras);
    assert.equal(switchedFromFree.faction, 'ares');
    assert.equal(switchedFromFree.operatorKey, 'ares_bastiao');
    assert.equal(switchedFromFree.switchedOperator, true);
    assert.deepEqual(switchedFromFree.unlockedExtras, ['pcc_muralha', 'boss_pcc']);

    const switchedWhilePlayingBought = resolveFactionSwitchRoster('ares', 'pcc_muralha', bossUnlock1.unlockedExtras);
    assert.equal(switchedWhilePlayingBought.operatorKey, 'pcc_muralha');
    assert.equal(switchedWhilePlayingBought.switchedOperator, false);

    // Legacy save migration: old heroKey: 'solaris' on 'pcc' -> operatorKey: 'pcc_contador', unlockedExtras: []
    const legacySave = {
      slotIndex: 1,
      faction: 'pcc',
      heroKey: 'solaris',
      studs: 184500,
      goldenBricks: 7,
      conqueredTerritories: ['pcc', 'cv'],
      customHero: { isCreated: true, name: 'SENTINELA', primaryPower: 'laser' }
    };
    const migrated = migrateSaveSlotRoster(legacySave);
    assert.equal(migrated.faction, 'pcc');
    assert.deepEqual(migrated.unlockedExtras, []);
    assert.equal(migrated.operatorKey, 'pcc_contador');
    assert.equal(migrated.heroKey, 'pcc_contador');
    assert.equal(migrated.studs, 184500);
    assert.equal(migrated.goldenBricks, 7);
    assert.deepEqual(migrated.conqueredTerritories, ['pcc', 'cv']);
    assert.deepEqual(migrated.customHero, legacySave.customHero);

    // Q/E HUD descriptor mapping covers both classic heroes and operators
    assert.ok(EXTRAS_CATALOG.boss_ares.isBigFig);
    assert.equal(HERO_EXTRA_QE_DESCRIPTORS.caveira.q.name['pt-BR'], 'Rolar');
    assert.equal(getCharacterAbilityDescriptors('ares_agulha').q.id, 'ares_optic_camo');
    assert.equal(getCharacterAbilityDescriptors('vortex').e.name['pt-BR'], 'Laço Abissal');
  });
});
