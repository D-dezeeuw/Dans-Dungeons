import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  doubleDice,
  resolveAttackOutcome,
  applyDamage,
  resolveSkillOutcome,
} from '../../src/game/combat-math.js';

describe('doubleDice', () => {
  it('doubles the dice count on a crit', () => {
    assert.equal(doubleDice('1d8'), '2d8');
    assert.equal(doubleDice('2d6'), '4d6');
    assert.equal(doubleDice('1d4'), '2d4');
  });

  it('leaves non-standard specs untouched', () => {
    assert.equal(doubleDice('1d8+3'), '1d8+3'); // modifier suffix is not the dice
    assert.equal(doubleDice('greatsword'), 'greatsword');
  });
});

describe('resolveAttackOutcome', () => {
  it('hits when d20 + bonus meets or beats AC', () => {
    const r = resolveAttackOutcome({ d20: 12, attackBonus: 4, targetAc: 15 });
    assert.equal(r.totalHit, 16);
    assert.equal(r.hit, true);
    assert.equal(r.crit, false);
    assert.equal(r.fumble, false);
  });

  it('misses when total is below AC', () => {
    const r = resolveAttackOutcome({ d20: 5, attackBonus: 2, targetAc: 15 });
    assert.equal(r.hit, false);
  });

  it('exactly meeting AC is a hit', () => {
    const r = resolveAttackOutcome({ d20: 11, attackBonus: 4, targetAc: 15 });
    assert.equal(r.hit, true);
  });

  it('natural 20 crits and always hits, even past AC', () => {
    const r = resolveAttackOutcome({ d20: 20, attackBonus: 0, targetAc: 99 });
    assert.equal(r.crit, true);
    assert.equal(r.hit, true);
  });

  it('natural 1 fumbles and always misses, even with huge bonus', () => {
    const r = resolveAttackOutcome({ d20: 1, attackBonus: 50, targetAc: 5 });
    assert.equal(r.fumble, true);
    assert.equal(r.hit, false);
  });

  it('defaults attackBonus to 0', () => {
    const r = resolveAttackOutcome({ d20: 15, targetAc: 15 });
    assert.equal(r.totalHit, 15);
    assert.equal(r.hit, true);
  });
});

describe('applyDamage', () => {
  it('subtracts damage + mod from HP', () => {
    const r = applyDamage({ targetHp: 10, damageTotal: 4, damageMod: 3 });
    assert.equal(r.damage, 7);
    assert.equal(r.newHp, 3);
    assert.equal(r.dead, false);
  });

  it('floors HP at 0 and flags dead', () => {
    const r = applyDamage({ targetHp: 5, damageTotal: 8, damageMod: 2 });
    assert.equal(r.newHp, 0);
    assert.equal(r.dead, true);
  });

  it('exact lethal damage is dead', () => {
    const r = applyDamage({ targetHp: 7, damageTotal: 7, damageMod: 0 });
    assert.equal(r.newHp, 0);
    assert.equal(r.dead, true);
  });

  it('a hit always deals at least 1 damage', () => {
    const r = applyDamage({ targetHp: 10, damageTotal: 1, damageMod: -5 });
    assert.equal(r.damage, 1);
    assert.equal(r.newHp, 9);
  });
});

describe('resolveSkillOutcome', () => {
  it('succeeds when total meets or beats DC', () => {
    const r = resolveSkillOutcome({ d20: 10, abilMod: 3, profBonus: 2, dc: 15 });
    assert.equal(r.total, 15);
    assert.equal(r.success, true);
  });

  it('fails when total is below DC', () => {
    const r = resolveSkillOutcome({ d20: 4, abilMod: 1, profBonus: 0, dc: 12 });
    assert.equal(r.total, 5);
    assert.equal(r.success, false);
  });

  it('adds proficiency only when supplied', () => {
    const without = resolveSkillOutcome({ d20: 10, abilMod: 2, dc: 14 });
    assert.equal(without.total, 12);
    assert.equal(without.success, false);

    const withProf = resolveSkillOutcome({ d20: 10, abilMod: 2, profBonus: 2, dc: 14 });
    assert.equal(withProf.total, 14);
    assert.equal(withProf.success, true);
  });
});
