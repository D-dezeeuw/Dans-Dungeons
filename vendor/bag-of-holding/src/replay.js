// Replay verification for roll logs. Lives in its own module rather
// than in dice.js because it has to import from combat.js and
// checks.js too — putting it in dice.js would create an import
// cycle. The engine factory re-exports `verifyLog` as a method on
// each engine instance, so consumers mostly reach it via that path.

import { seededRng, rollDie, roll, rollAdvantage, rollDisadvantage } from './dice.js';
import { abilityCheck, savingThrow } from './checks.js';
import { attackRoll, damageRoll, rollInitiative } from './combat.js';
import { DEFAULT_RULES, buildRules } from './rules.js';

// Mock-actor pair that produces the requested stance when fed into
// attackRoll. The base attackRoll uses these to draw the correct
// number of d20s during replay (advantage → 2 dice keep-max;
// disadvantage → 2 dice keep-min; normal → 1 die).
function stanceActors(stance) {
  if (stance === 'advantage') {
    // invisible attacker gives ownAttackAdvantage.
    return { attacker: { conditions: ['invisible'] }, target: {} };
  }
  if (stance === 'disadvantage') {
    // blinded attacker gives ownAttackDisadvantage.
    return { attacker: { conditions: ['blinded'] }, target: {} };
  }
  return { attacker: undefined, target: undefined };
}

const arraysEqual = (a, b) =>
  Array.isArray(a) && Array.isArray(b)
    && a.length === b.length
    && a.every((v, i) => v === b[i]);

/**
 * Walk a recorded `rollLog` forward from `seed`, re-executing each
 * logged operation with a fresh seeded RNG and comparing the results
 * to the values stored in the log. Returns `{ ok: true }` on a clean
 * replay, or `{ ok: false, divergedAt, expected, actual }` on the
 * first disagreement.
 *
 * **What this catches:**
 *   - Determinism regressions when the Mulberry32 implementation or
 *     any rolling function silently changes between releases.
 *   - AI hallucinations claiming the engine produced an outcome it
 *     never could from the same seed.
 *   - State corruption across saves where a log no longer matches
 *     the engine that produced it.
 *
 * **What this does NOT do:** it doesn't re-execute the *surrounding
 * application logic* (turn loop, AI calls, narration). It only
 * verifies that the engine's stochastic outputs, in the order they
 * were recorded, are reproducible from the given seed and rules.
 *
 * The log entries' `op` field is the dispatch key. Unknown ops throw
 * loudly — a forwards-incompatible log shouldn't silently pass
 * verification.
 *
 * **Rule packs:** if the original session used a custom `rules`
 * object (Phase B), pass the same one in. Replay against the wrong
 * rules will diverge at the first crit/fumble/damage-floor-affected
 * roll — which is correct: a log produced under one rule set
 * isn't reproducible under another.
 */
export function verifyLog({ seed, log, rules: rulesOpt }) {
  const rng = seededRng(seed);
  const rules = rulesOpt === undefined ? DEFAULT_RULES : buildRules(rulesOpt);
  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    let actual;
    switch (entry.op) {
      case 'rollDie':
        actual = rollDie(entry.sides, rng);
        if (actual !== entry.value) {
          return { ok: false, divergedAt: i, expected: entry.value, actual };
        }
        break;
      case 'roll':
        actual = roll(entry.spec, rng);
        if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'rollAdvantage':
        actual = rollAdvantage(entry.spec, rng);
        if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'rollDisadvantage':
        actual = rollDisadvantage(entry.spec, rng);
        if (actual.total !== entry.total || !arraysEqual(actual.rolls, entry.rolls)) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'rollInitiative':
        actual = rollInitiative({ dexterity: entry.dexterity }, rng);
        if (actual !== entry.value) {
          return { ok: false, divergedAt: i, expected: entry.value, actual };
        }
        break;
      case 'attackRoll':
        // A `beforeAttack` hook may have short-circuited this entry
        // (cancelled: true, d20 logged as 0). Skip — no dice were
        // rolled.
        if (entry.cancelled === true) break;
        // The logged entry carries the post-hook `ac` and the
        // resulting `hit`/`critical`/`fumble`. Replay reconstructs
        // those by passing the same ac and rules, drawing the same
        // number of d20s via the synthetic stance actors.
        actual = attackRoll({
          attackBonus: entry.attackBonus, ac: entry.ac,
          ...stanceActors(entry.stance ?? 'normal')
        }, rng, rules);
        if (actual.d20 !== entry.d20 || actual.hit !== entry.hit) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'damageRoll':
        actual = damageRoll({
          damageDice: entry.damageDice,
          damageMod: entry.damageMod,
          critical: entry.critRolls.length > 0
        }, rng, rules);
        // Verify the physical dice (baseRolls + critRolls). `total`
        // may have been transformed by an `afterDamage` hook —
        // that's not part of the determinism contract.
        if (!arraysEqual(actual.baseRolls, entry.baseRolls) || !arraysEqual(actual.critRolls, entry.critRolls)) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'abilityCheck':
        actual = abilityCheck({
          abilityScore: entry.abilityScore,
          proficient: entry.proficient,
          proficiencyBonus: entry.proficiencyBonus,
          dc: entry.dc
        }, rng);
        if (actual.d20 !== entry.d20 || actual.success !== entry.success) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      case 'savingThrow':
        actual = savingThrow({
          abilityScore: entry.abilityScore,
          proficient: entry.proficient,
          proficiencyBonus: entry.proficiencyBonus,
          dc: entry.dc
        }, rng);
        if (actual.d20 !== entry.d20 || actual.success !== entry.success) {
          return { ok: false, divergedAt: i, expected: entry, actual };
        }
        break;
      default:
        throw new Error(`Cannot replay unknown roll op: ${entry.op}`);
    }
  }
  return { ok: true };
}
