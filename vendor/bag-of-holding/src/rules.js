// === Rule modifications (plugin Phase B) ===
//
// Phase A let plugins contribute content (species, classes, items,
// conditions, mastery handlers). Phase B lets them tune the *math*:
// crit and fumble thresholds, damage floor, exploding dice, the
// XP/proficiency tables. Each knob has a default that preserves the
// SRD 5.2 baseline exactly, so callers opt in per-knob without
// migrating all-or-nothing.
//
// The rules object is per-engine — `createEngine({ rules: {…} })`
// — and threaded through the math functions by the engine factory.
// Module-level `attackRoll`/`damageRoll` accept `rules` as an
// optional third argument for callers using the engine math without
// instantiating an engine.

/**
 * SRD 5.2 baseline. Frozen so consumers can't mutate it
 * accidentally and have their changes leak across engines (the
 * factory clones it before merging plugin extras anyway, but
 * defence in depth is cheap).
 */
export const DEFAULT_RULES = Object.freeze({
  /** d20 faces that count as critical hits. Default `[20]`.
   *  Pathfinder-style would be `[19, 20]`; a Champion Fighter's
   *  Improved Critical would be `[19, 20]` for that engine. */
  critOn: Object.freeze([20]),

  /** d20 faces that count as fumbles. Default `[1]`. */
  fumbleOn: Object.freeze([1]),

  /** Minimum damage on a successful hit. Default `1` (SRD §
   *  "Damage Rolls": you always deal at least 1 damage). Set to
   *  `0` for systems where negative modifiers fully cancel a hit. */
  damageFloor: 1,

  /** When true, every damage die that comes up its maximum value
   *  triggers another roll of the same die, added on. Off by
   *  default (SRD doesn't use exploding dice). On in Savage Worlds-
   *  flavoured packs. */
  explodingDamageDice: false,

  /** Override map of `level → XP threshold`. `null` means use the
   *  SRD 5.2 table from `xp.js`. Gritty packs raise thresholds;
   *  heroic packs lower them. */
  xpThresholds: null,

  /** Override map of `level → proficiency bonus`. `null` means use
   *  the SRD 5.2 table from `xp.js`. */
  proficiencyByLevel: null,

  /** DC of a death saving throw. SRD 5.2 § Death Saving Throws sets
   *  this at 10. Gritty packs raise it; heroic packs lower it. */
  deathSaveDC: 10,

  /** Number of successes / failures required to stabilise / die.
   *  SRD 5.2 uses three of each. */
  deathSaveSuccessesRequired: 3,

  /** How many Hit Dice come back on a Long Rest.
   *  - `'half'` (default) matches SRD 5.2 § Long Rest.
   *  - `'all'`  — heroic packs restore them all.
   *  - `'none'` — gritty packs (DMG Slow Natural Healing). */
  longRestHitDiceRecovery: 'half'
});

const isIntegerInRange = (v, min, max) =>
  Number.isInteger(v) && v >= min && v <= max;

const isPositiveIntegerMap = (m) => {
  if (typeof m !== 'object' || m === null || Array.isArray(m)) return false;
  for (const [k, v] of Object.entries(m)) {
    if (!isIntegerInRange(Number(k), 1, 1000)) return false;
    if (!Number.isInteger(v) || v < 0) return false;
  }
  return true;
};

/**
 * Validate a `rules` object passed to `createEngine` and return the
 * frozen merged result (defaults + caller overrides). Throws with a
 * specific pointer at the first invalid knob so plugin authors see
 * exactly what's wrong rather than discovering it at first roll.
 *
 * Why per-field validation rather than a schema lib: the engine
 * ships zero runtime deps; ~30 lines of explicit checks are
 * cheaper than depending on a validator and read more clearly.
 */
export function buildRules(extras = {}) {
  if (extras === null || typeof extras !== 'object' || Array.isArray(extras)) {
    throw new Error('rules must be an object');
  }

  if (extras.critOn !== undefined) {
    if (!Array.isArray(extras.critOn) || extras.critOn.some(v => !isIntegerInRange(v, 1, 20))) {
      throw new Error('rules.critOn must be an array of integers in [1, 20]');
    }
  }
  if (extras.fumbleOn !== undefined) {
    if (!Array.isArray(extras.fumbleOn) || extras.fumbleOn.some(v => !isIntegerInRange(v, 1, 20))) {
      throw new Error('rules.fumbleOn must be an array of integers in [1, 20]');
    }
  }
  if (extras.damageFloor !== undefined) {
    if (!Number.isInteger(extras.damageFloor) || extras.damageFloor < 0) {
      throw new Error('rules.damageFloor must be a non-negative integer');
    }
  }
  if (extras.explodingDamageDice !== undefined && typeof extras.explodingDamageDice !== 'boolean') {
    throw new Error('rules.explodingDamageDice must be a boolean');
  }
  if (extras.xpThresholds !== undefined && extras.xpThresholds !== null) {
    if (!isPositiveIntegerMap(extras.xpThresholds)) {
      throw new Error('rules.xpThresholds must be a record of positive integer levels → non-negative integer XP');
    }
  }
  if (extras.proficiencyByLevel !== undefined && extras.proficiencyByLevel !== null) {
    if (!isPositiveIntegerMap(extras.proficiencyByLevel)) {
      throw new Error('rules.proficiencyByLevel must be a record of positive integer levels → non-negative integer bonus');
    }
  }
  if (extras.deathSaveDC !== undefined) {
    if (!isIntegerInRange(extras.deathSaveDC, 1, 30)) {
      throw new Error('rules.deathSaveDC must be an integer in [1, 30]');
    }
  }
  if (extras.deathSaveSuccessesRequired !== undefined) {
    if (!Number.isInteger(extras.deathSaveSuccessesRequired) || extras.deathSaveSuccessesRequired < 1) {
      throw new Error('rules.deathSaveSuccessesRequired must be a positive integer');
    }
  }
  if (extras.longRestHitDiceRecovery !== undefined) {
    if (!['half', 'all', 'none'].includes(extras.longRestHitDiceRecovery)) {
      throw new Error("rules.longRestHitDiceRecovery must be 'half', 'all', or 'none'");
    }
  }

  return Object.freeze({
    critOn: Object.freeze([...(extras.critOn ?? DEFAULT_RULES.critOn)]),
    fumbleOn: Object.freeze([...(extras.fumbleOn ?? DEFAULT_RULES.fumbleOn)]),
    damageFloor: extras.damageFloor ?? DEFAULT_RULES.damageFloor,
    explodingDamageDice: extras.explodingDamageDice ?? DEFAULT_RULES.explodingDamageDice,
    xpThresholds: extras.xpThresholds == null ? DEFAULT_RULES.xpThresholds : Object.freeze({ ...extras.xpThresholds }),
    proficiencyByLevel: extras.proficiencyByLevel == null ? DEFAULT_RULES.proficiencyByLevel : Object.freeze({ ...extras.proficiencyByLevel }),
    deathSaveDC: extras.deathSaveDC ?? DEFAULT_RULES.deathSaveDC,
    deathSaveSuccessesRequired: extras.deathSaveSuccessesRequired ?? DEFAULT_RULES.deathSaveSuccessesRequired,
    longRestHitDiceRecovery: extras.longRestHitDiceRecovery ?? DEFAULT_RULES.longRestHitDiceRecovery
  });
}
