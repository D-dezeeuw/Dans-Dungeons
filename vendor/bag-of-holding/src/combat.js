import { rollDie, roll as rollDice, rollExplosive } from './dice.js';
import { modFromScore } from './checks.js';
import { DEFAULT_RULES } from './rules.js';
import { attackStance, apply as applyCondition, remove as removeCondition, effectsFor } from './conditions.js';

/**
 * Initiative is mechanically just `d20 + DEX mod`, but it lives in
 * combat (not checks) because it belongs to the encounter system —
 * the loop calls `rollInitiative` at the start of combat, never as
 * a generic check. Keeping it here means combat code never has to
 * reach into another module to start a turn. The `rng` cascades
 * through `rollDie` so seeded engines produce reproducible turn
 * orders.
 */
export function rollInitiative({ dexterity }, rng = Math.random) {
  return rollDie(20, rng) + modFromScore(dexterity);
}

/**
 * One attack roll, fully decided in one call. We surface `critical`
 * and `fumble` as flags (rather than making the caller re-inspect
 * the d20) because the narrator agent branches on them — "you
 * connect cleanly" vs "the blade scrapes off the plate" — and we
 * don't want every caller redoing the nat-20 / nat-1 comparison.
 *
 * Crit and fumble faces are configurable via `rules.critOn` /
 * `rules.fumbleOn` (Phase B). Defaults follow SRD canon: 20 always
 * crits, 1 always fumbles, regardless of AC and attack bonus.
 * Custom packs (Pathfinder-style 19–20, Champion Fighter's
 * Improved Critical) override the arrays.
 */
export function attackRoll({ attackBonus, ac, attacker, target, attackerDistanceFt }, rng = Math.random, rules = DEFAULT_RULES) {
  // Compute stance from attacker/target conditions, if either is
  // passed. Most callers pass neither (a bare attack roll); only
  // hosts that want SRD-correct advantage/disadvantage from
  // conditions need to provide them.
  let stance = 'normal';
  if (attacker || target) {
    stance = attackStance({
      attacker: attacker ?? {},
      target: target ?? {},
      attackerDistanceFt: attackerDistanceFt ?? 0
    });
  }
  let d20;
  if (stance === 'advantage') {
    d20 = Math.max(rollDie(20, rng), rollDie(20, rng));
  } else if (stance === 'disadvantage') {
    d20 = Math.min(rollDie(20, rng), rollDie(20, rng));
  } else {
    d20 = rollDie(20, rng);
  }
  let critical = rules.critOn.includes(d20);
  const fumble = rules.fumbleOn.includes(d20);
  const total = d20 + attackBonus;
  const hit = critical || (!fumble && total >= ac);
  // SRD § Conditions — Paralyzed / Unconscious / Petrified / Stunned
  // (since 1.5.0): a melee attack that hits a target with the
  // `critIfAttackerWithin5` flag automatically crits when the
  // attacker is within 5 ft. The conditions module already declares
  // these flags; here we honour them.
  if (hit && target && attackerDistanceFt !== undefined && attackerDistanceFt <= 5) {
    const tEffects = effectsFor(target);
    if (tEffects.critIfAttackerWithin5) critical = true;
  }
  return { d20, attackBonus, total, ac, hit, critical, fumble, stance };
}

/**
 * Roll damage, with three rules baked in so callers can't get them
 * wrong:
 *   1. On a crit, the **dice** double but the modifier does not —
 *      SRD § "Critical Hits". A common port-bug is doubling the
 *      whole total; we avoid it by rolling the extra dice
 *      separately and adding the flat modifier once.
 *   2. Total damage floors at `rules.damageFloor` (default `1`).
 *      A creature reduced to a negative result by a debuff
 *      shouldn't heal the target — the floor keeps "tickle for 1"
 *      rather than producing "heals for 3". Set to `0` in custom
 *      rule packs that want "negative modifier fully cancels."
 *   3. `damageMod = 0` and `critical = false` defaults so test
 *      and AI-tool callers that pass only `damageDice` work.
 *
 * When `rules.explodingDamageDice` is on, each die that comes up
 * max rolls again and adds — affects both the base roll and the
 * crit extra dice.
 */
export function damageRoll({ damageDice, damageMod = 0, critical = false, damageType }, rng = Math.random, rules = DEFAULT_RULES) {
  const rollFn = rules.explodingDamageDice ? rollExplosive : rollDice;
  const base = rollFn(damageDice, rng);
  const extra = critical ? rollFn(damageDice, rng) : { rolls: [], total: 0 };
  const total = Math.max(rules.damageFloor, base.total + extra.total + damageMod);
  const result = {
    damageDice,
    baseRolls: base.rolls,
    critRolls: extra.rolls,
    damageMod,
    total
  };
  // `damageType` is optional on the result — preserves the existing
  // empty-shape behaviour for callers that don't propagate types yet.
  if (damageType !== undefined) result.damageType = damageType;
  return result;
}

// === Weapon Mastery (SRD 5.2) ===
//
// Each weapon carries one mastery property; the loop resolves its
// rider effect after the attack roll via `applyMastery`. Returns a
// plain rider object describing what happens — no I/O, no narration,
// no state mutation. The loop owns turning that rider into a state
// delta and a piece of prose (see bag-of-holding/docs/boundary.md).
//
// Handlers are looked up by name from a table rather than a switch
// so plugins (Phase A engine extensions) can contribute new mastery
// properties without forking this file.

/**
 * A mastery handler resolves one attack into a rider object. Inputs
 * mirror `applyMastery`'s public arguments (minus the handler table
 * itself). Handlers must be pure — same inputs, same output — so
 * the engine stays replay-deterministic.
 *
 * @callback MasteryHandler
 * @param {object} weapon         The attacker's weapon record.
 * @param {object} target         The defender (for plugin handlers
 *                                that branch on size, type, etc.).
 * @param {object} attackResult   The `attackRoll` return.
 * @param {object} attacker       The attacker (for proficiency,
 *                                ability mods, etc.).
 * @returns {object}              `{ kind, ... }` rider.
 */

/**
 * The eight SRD 5.2 mastery handlers, keyed by mastery name. Frozen
 * at the module level so the default singleton can share it; the
 * engine factory clones it and merges plugin contributions on top.
 *
 * Each handler is gated per SRD: graze fires on miss, every other
 * property fires on hit (with topple also building a save DC from
 * the attacker's modifiers).
 */
export const DEFAULT_MASTERY_HANDLERS = Object.freeze({
  graze: (_w, _t, result, attacker) => {
    if (result?.hit) return { kind: 'none' };
    // SRD 5.2 § Weapon Mastery Properties — Graze: "the target
    // takes damage equal to the ability modifier you used to make
    // the attack roll." `attackResult.attackBonus` is the *total*
    // bonus (abilityMod + proficiencyBonus + situational), so we
    // recover the ability modifier by subtracting the proficiency
    // bonus the attacker was using. Callers that pass neither field
    // land at 0 — keeps an under-specified call quiet rather than
    // fabricating damage.
    const attackBonus = result?.attackBonus ?? 0;
    const proficiencyBonus = attacker?.proficiencyBonus ?? 0;
    return { kind: 'graze', damage: attackBonus - proficiencyBonus };
  },

  cleave: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'cleave', range: 5 };
  },

  nick: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'nick', extraAttack: true };
  },

  push: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'push', distance: 10, sizeCap: 'large' };
  },

  sap: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'sap', disadvantage: true };
  },

  slow: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'slow', speedReduction: 10 };
  },

  topple: (_w, _t, result, attacker) => {
    if (!result?.hit) return { kind: 'none' };
    // SRD 5.2 § Weapon Mastery Properties — Topple: the Constitution
    // save DC is 8 + the attacker's ability modifier + their
    // proficiency bonus. `attackBonus` already folds proficiency in,
    // so we strip it back out to recover the bare ability modifier
    // before re-applying both sides of the SRD formula — the
    // algebraic form keeps the SRD wording auditable from the code
    // even though it simplifies to `8 + attackBonus`.
    const attackBonus = result.attackBonus ?? 0;
    const proficiencyBonus = attacker?.proficiencyBonus ?? 0;
    const attackAbilityMod = attackBonus - proficiencyBonus;
    const saveDC = 8 + attackAbilityMod + proficiencyBonus;
    return { kind: 'topple', saveDC, ability: 'con', onFail: 'prone' };
  },

  vex: (_w, _t, result) => {
    if (!result?.hit) return { kind: 'none' };
    return { kind: 'vex', advantage: true };
  }
});

/**
 * Frozen canonical list of the SRD 5.2 mastery property names. Kept
 * as a separate constant from the handler table so consumers can
 * iterate names without dereferencing functions (useful for
 * editor autocomplete, schema generation, and registering UI chips).
 */
export const MASTERY_PROPERTIES = Object.freeze(Object.keys(DEFAULT_MASTERY_HANDLERS));

/**
 * Resolve a weapon's mastery rider for one attack. Returns a plain
 * descriptor object the game loop interprets — the engine never
 * mutates target state or generates prose, both of which would
 * violate the AI/engine boundary.
 *
 * The `handlers` table defaults to the SRD 5.2 set. Plugins extend
 * this by passing a merged table (`{ ...DEFAULT_MASTERY_HANDLERS,
 * pin: customHandler }`) — typically constructed once by the engine
 * factory and bound, so callers never thread it explicitly.
 *
 * Unknown masteries throw rather than silently returning `none`:
 * a misspelled weapon record is always a bug, and we want it loud
 * at construction time rather than silently disabling combat math.
 */
export function applyMastery(weapon, target, attackResult, attacker = {}, handlers = DEFAULT_MASTERY_HANDLERS) {
  const mastery = weapon?.mastery;
  if (!mastery) return { kind: 'none' };
  const handler = handlers[mastery];
  if (!handler) throw new Error(`Unknown weapon mastery: ${mastery}`);
  return handler(weapon, target, attackResult, attacker);
}

// === Death saves (SRD 5.2 § Damage and Healing — Death Saving Throws) ===
//
// At 0 HP a creature falls Unconscious and rolls a DC 10 d20 at the
// start of each of its turns. Three successes Stabilise; three
// failures kill. A natural 1 counts as two failures; a natural 20
// restores 1 HP and consciousness. Damage taken while at 0 HP counts
// as a failed save (two if from a critical hit). If damage taken
// while at 0 HP equals or exceeds the actor's HP maximum, the actor
// dies outright (massive damage).
//
// The engine models this as a `deathSaves` tracker on the actor:
//
//   actor.deathSaves = { successes, failures, stable, dead }
//
// All five entry points are pure: same inputs → same outputs, new
// actor returned, original untouched. The host orchestrates *when*
// to call them — typically `dropToZero` on lethal damage,
// `deathSave` at turn start, `applyDamageWhileDown` on each
// subsequent hit, and `reviveTo` / `stabilize` on healing magic or
// a Medicine check.

/** Default DC per SRD 5.2 § Death Saving Throws. Plugin rule packs
 *  can lower it for heroic play or raise it for gritty. */
export const DEFAULT_DEATH_SAVE_DC = 10;

/** Default successes/failures count per SRD 5.2 § Death Saving
 *  Throws. Three of either ends the sequence. */
export const DEFAULT_DEATH_SAVE_THRESHOLD = 3;

/** Fresh tracker. Exported so hosts can initialise the field on
 *  characters created before death saves landed without reaching
 *  into the engine's internals. */
export function freshDeathSaves() {
  return { successes: 0, failures: 0, stable: false, dead: false };
}

/**
 * Drop an actor to 0 HP. Applies Unconscious (the SRD condition
 * accompanying the down state), initialises the death-save tracker,
 * and zeroes `hp`. Use this rather than a raw `hp = 0` assignment so
 * the tracker exists before the first `deathSave` call.
 *
 * Idempotent: dropping an actor that's already at 0 HP just refreshes
 * the tracker. The pre-existing `unconscious` condition (if any) is
 * preserved via the existing `apply` set semantics.
 */
export function dropToZero(actor) {
  const withUnconscious = applyCondition(actor, 'unconscious');
  return { ...withUnconscious, hp: 0, deathSaves: freshDeathSaves() };
}

/**
 * Roll one death save per SRD 5.2 § Death Saving Throws. Returns:
 *
 *   { d20, outcome, actor }
 *
 * where `outcome` is one of:
 *   - `'success'`  → made the DC, not yet at the threshold
 *   - `'failure'`  → missed the DC (or rolled nat 1), not yet dead
 *   - `'stable'`   → third success, actor stabilised
 *   - `'dead'`     → third failure (or two from nat 1), actor dead
 *   - `'revived'`  → nat 20, regains 1 HP and consciousness
 *   - `'noop'`     → tracker already stable or dead; no roll made
 *
 * The `noop` branch returns `d20: 0` so the caller can distinguish
 * "didn't roll" from any legitimate die face. Calling on an actor
 * with no tracker initialised treats it as a fresh tracker — useful
 * for hosts that wire death saves in mid-session.
 */
export function deathSave(actor, rng = Math.random, rules = DEFAULT_RULES) {
  const tracker = actor.deathSaves ?? freshDeathSaves();
  if (tracker.dead || tracker.stable) return { d20: 0, outcome: 'noop', actor };
  // `rules` is authoritative — `DEFAULT_RULES` and `buildRules` both
  // ensure the death-save knobs are populated, so we read them
  // directly without `??` fallbacks (would be dead code).
  const dc = rules.deathSaveDC;
  const threshold = rules.deathSaveSuccessesRequired;
  const d20 = rollDie(20, rng);

  // Nat 20: regain 1 HP, clear tracker, remove Unconscious. The
  // SRD wording is "regain 1 Hit Point" — we delegate the condition
  // removal to the shared `remove` helper so the boolean-list
  // semantics stay in one place.
  if (d20 === 20) {
    const revived = removeCondition(actor, 'unconscious');
    return {
      d20,
      outcome: 'revived',
      actor: { ...revived, hp: 1, deathSaves: freshDeathSaves() }
    };
  }
  // Nat 1: two failures.
  if (d20 === 1) {
    const failures = tracker.failures + 2;
    const dead = failures >= threshold;
    return {
      d20,
      outcome: dead ? 'dead' : 'failure',
      actor: { ...actor, deathSaves: { ...tracker, failures, dead } }
    };
  }
  // Ordinary success.
  if (d20 >= dc) {
    const successes = tracker.successes + 1;
    const stable = successes >= threshold;
    return {
      d20,
      outcome: stable ? 'stable' : 'success',
      actor: { ...actor, deathSaves: { ...tracker, successes, stable } }
    };
  }
  // Ordinary failure.
  const failures = tracker.failures + 1;
  const dead = failures >= threshold;
  return {
    d20,
    outcome: dead ? 'dead' : 'failure',
    actor: { ...actor, deathSaves: { ...tracker, failures, dead } }
  };
}

/**
 * Apply damage to a creature already at 0 HP. Per SRD 5.2 § Damage
 * at 0 Hit Points:
 *   - Each hit counts as one failed death save.
 *   - A critical hit counts as two failed death saves.
 *   - If the damage equals or exceeds the actor's HP maximum, the
 *     actor dies outright (massive damage).
 *
 * `hpMax` defaults to `actor.hpMax` so hosts can omit it for actors
 * whose sheet already carries the field. Omitting it entirely and
 * leaving the actor with no `hpMax` skips the massive-damage check —
 * an under-specified call won't fabricate an instant death.
 */
export function applyDamageWhileDown(actor, damageTaken, { critical = false, hpMax } = {}, rules = DEFAULT_RULES) {
  const tracker = actor.deathSaves ?? freshDeathSaves();
  if (tracker.dead) return { outcome: 'noop', actor };
  const max = hpMax ?? actor.hpMax;
  const threshold = rules.deathSaveSuccessesRequired;
  // Massive damage = instant death. Saturates the failure counter at
  // the threshold so the tracker reads as "dead via 3 failures" and
  // downstream UI doesn't have to special-case the cause.
  if (max !== undefined && damageTaken >= max) {
    return {
      outcome: 'dead',
      actor: { ...actor, deathSaves: { ...tracker, failures: threshold, dead: true } }
    };
  }
  const failureDelta = critical ? 2 : 1;
  const failures = tracker.failures + failureDelta;
  const dead = failures >= threshold;
  // Stabilised actors lose their stable flag when they take damage
  // (per the "your hp drops to 0 again" pathway in the SRD: damage
  // re-triggers the death-save sequence).
  return {
    outcome: dead ? 'dead' : 'failure',
    actor: { ...actor, deathSaves: { ...tracker, failures, stable: false, dead } }
  };
}

/**
 * Stabilise an actor at 0 HP — Medicine check, spare-the-dying, etc.
 * Clears the success/failure counters and sets `stable: true`. The
 * actor stays at 0 HP and Unconscious; the host triggers a wake-up
 * separately when narratively appropriate (e.g. an hour later per the
 * SRD's "regain 1 HP after 1d4 hours" rule, which the host owns).
 */
export function stabilize(actor) {
  return {
    ...actor,
    deathSaves: { successes: 0, failures: 0, stable: true, dead: false }
  };
}

/**
 * Revive an actor to a positive HP value. Clears the tracker and
 * removes the Unconscious condition. Throws on non-positive HP
 * because "revive to 0" is a contradiction — use `stabilize` if you
 * want to keep the actor down but stop the dying clock.
 */
export function reviveTo(actor, hp) {
  if (!Number.isInteger(hp) || hp < 1) {
    throw new Error('reviveTo: hp must be a positive integer');
  }
  const withoutUnconscious = removeCondition(actor, 'unconscious');
  return { ...withoutUnconscious, hp, deathSaves: freshDeathSaves() };
}

// === Damage pipeline (SRD 5.2 § Damage and Healing) ===
//
// The pipeline turns a raw damage roll (`damageRoll`'s `total`) plus a
// damage type into an *applied* HP change, threading through:
//
//   1. Immunity check — `actor.damageImmunities: string[]` ⇒ 0 damage.
//   2. Adjustments — already applied by the caller (the SRD's
//      "bonuses, penalties, or multipliers" land before this pipeline
//      reads the amount).
//   3. Resistance — `actor.damageResistances: string[]` ⇒ `floor(/2)`.
//   4. Vulnerability — `actor.damageVulnerabilities: string[]` ⇒ ×2.
//   5. Temporary HP absorbs first (non-stacking — replaced on grant).
//   6. Remaining damage subtracts from `actor.hp`.
//   7. Drop-to-zero (`dropToZero`) when HP crosses below 1.
//   8. Massive damage instant death per SRD § Damage at 0 Hit Points
//      when remaining damage past hpBefore ≥ hpMax.
//   9. Subsequent hits at 0 HP route through `applyDamageWhileDown`.
//
// Per SRD: multiple Resistance / Vulnerability tags for the same
// damage type count as one. We model that by union (an `Array.includes`
// short-circuits at the first match).

/**
 * Apply the SRD damage modifiers (Immunity / Resistance / Vulnerability)
 * to a raw amount. Pure — no actor mutation, returns the post-modifier
 * integer.
 *
 * The `type`-less call returns `amount` unchanged: callers that omit
 * a damage type bypass the modifier layer entirely, which is the
 * pre-1.4 behaviour and keeps existing consumers compatible.
 */
export function applyDamageModifiers(actor, { amount, type } = {}) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('applyDamageModifiers: amount must be a non-negative integer');
  }
  if (!type) return amount;
  if ((actor.damageImmunities ?? []).includes(type)) return 0;
  let result = amount;
  if ((actor.damageResistances ?? []).includes(type)) {
    result = Math.floor(result / 2);
  }
  if ((actor.damageVulnerabilities ?? []).includes(type)) {
    result = result * 2;
  }
  return result;
}

/**
 * Grant Temporary HP per SRD § Damage and Healing — Temporary Hit
 * Points: "Temporary Hit Points can't be added together. If you have
 * Temporary Hit Points and receive more of them, you decide whether
 * to keep the ones you have or to gain the new ones."
 *
 * We model that as the *non-stacking max*: the new amount replaces
 * the old one if and only if it's strictly larger. The host can
 * surface the choice to the player by calling `grantTempHp` with
 * the smaller amount explicitly (which returns the actor unchanged)
 * — the engine's role is to encode the non-stacking invariant.
 */
export function grantTempHp(actor, amount) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('grantTempHp: amount must be a non-negative integer');
  }
  const current = actor.tempHp ?? 0;
  if (amount > current) return { ...actor, tempHp: amount };
  return actor;
}

/**
 * Canonical damage application. Combines `applyDamageModifiers`,
 * temp-HP absorption, HP subtraction, drop-to-zero, massive-damage
 * instant death, and damage-while-down dispatch in one pipeline.
 *
 * Inputs (object form for forward-compat with future tags):
 *   - `amount` — pre-modifier integer (≥0).
 *   - `type`   — damage type string (optional; omitted = bypass mods).
 *   - `critical` — boolean (for damage-while-down: crit = 2 fails).
 *   - `source`   — opaque tag attached to the return for logging.
 *
 * Returns:
 *   `{ amount, finalAmount, tempHpAbsorbed, hpBefore, hpAfter,
 *      outcome, actor, source? }`
 * where `outcome` is one of:
 *   - `'damaged'` — HP went down but didn't cross 0.
 *   - `'downed'`  — HP just crossed to 0; actor is now Unconscious
 *                   with a fresh death-save tracker.
 *   - `'dead'`    — massive damage (instant death) or damage-while-
 *                   down accumulated three failed saves.
 *   - `'absorbed'` — all damage absorbed by temp HP; HP unchanged.
 *   - `'immune'`   — type is in `damageImmunities`, no damage taken.
 */
export function applyDamage(actor, args = {}) {
  const { amount = 0, type, critical = false, source } = args;
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('applyDamage: amount must be a non-negative integer');
  }
  const finalAmount = applyDamageModifiers(actor, { amount, type });
  if (finalAmount === 0 && (actor.damageImmunities ?? []).includes(type)) {
    return wrapDamageResult({ actor, amount, finalAmount, tempHpAbsorbed: 0,
      hpBefore: actor.hp ?? 0, hpAfter: actor.hp ?? 0,
      outcome: 'immune', source });
  }

  // Damage at 0 HP routes through the death-save path.
  const hpBefore = actor.hp ?? 0;
  if (hpBefore === 0 && finalAmount > 0) {
    const dwd = applyDamageWhileDown(actor, finalAmount,
      { critical, hpMax: actor.hpMax });
    return wrapDamageResult({
      actor: dwd.actor,
      amount, finalAmount, tempHpAbsorbed: 0,
      hpBefore: 0, hpAfter: 0,
      outcome: dwd.outcome === 'dead' ? 'dead' : 'downed',
      source
    });
  }

  // Temp HP absorbs first; the surplus carries through to HP.
  const tempBefore = actor.tempHp ?? 0;
  const tempAbsorbed = Math.min(tempBefore, finalAmount);
  const remainingDamage = finalAmount - tempAbsorbed;
  const tempAfter = tempBefore - tempAbsorbed;
  let next = { ...actor, tempHp: tempAfter };

  if (remainingDamage === 0) {
    // `absorbed` only when tempHp actually did the work — a no-op
    // call (amount 0, no tempHp) reads cleaner as `damaged` with
    // zero applied damage. The host renders the two the same; the
    // distinction matters for telemetry / audit logs.
    return wrapDamageResult({
      actor: next, amount, finalAmount, tempHpAbsorbed: tempAbsorbed,
      hpBefore, hpAfter: hpBefore,
      outcome: tempAbsorbed > 0 ? 'absorbed' : 'damaged', source
    });
  }

  // Massive damage instant death per SRD § Damage at 0 Hit Points:
  // damage that drops you to 0 with `damageTaken - hpBefore >= hpMax`
  // is instant death.
  const hpMax = actor.hpMax;
  const overkill = remainingDamage - hpBefore;
  if (hpBefore > 0 && remainingDamage >= hpBefore && hpMax !== undefined && overkill >= hpMax) {
    return wrapDamageResult({
      actor: {
        ...next, hp: 0,
        deathSaves: { successes: 0, failures: 3, stable: false, dead: true }
      },
      amount, finalAmount, tempHpAbsorbed: tempAbsorbed,
      hpBefore, hpAfter: 0,
      outcome: 'dead', source
    });
  }

  const hpAfter = Math.max(0, hpBefore - remainingDamage);
  if (hpAfter === 0 && hpBefore > 0) {
    next = dropToZero({ ...next, hp: 0 });
    return wrapDamageResult({
      actor: next, amount, finalAmount, tempHpAbsorbed: tempAbsorbed,
      hpBefore, hpAfter: 0,
      outcome: 'downed', source
    });
  }
  next = { ...next, hp: hpAfter };
  return wrapDamageResult({
    actor: next, amount, finalAmount, tempHpAbsorbed: tempAbsorbed,
    hpBefore, hpAfter,
    outcome: 'damaged', source
  });
}

// Internal: build the standard damage result envelope, omitting
// `source` when the caller didn't pass one (keeps shapes JSON-stable
// for fixture comparisons).
function wrapDamageResult({ actor, amount, finalAmount, tempHpAbsorbed, hpBefore, hpAfter, outcome, source }) {
  const out = { amount, finalAmount, tempHpAbsorbed, hpBefore, hpAfter, outcome, actor };
  if (source !== undefined) out.source = source;
  return out;
}

/**
 * Generic healing per SRD § Damage and Healing — Healing. Caps at
 * `hpMax`, removes Unconscious + clears the death-save tracker when
 * HP rises above 0. Does NOT restore Temporary HP — the SRD is
 * explicit: "healing can't restore them".
 *
 * Returns `{ healed, hpBefore, hpAfter, actor }`. `healed` is the
 * applied delta (can be 0 if at full or hpMax is missing).
 */
// === Turn lifecycle + timers (since 1.6.0) ===
//
// Round-scoped buffs / debuffs / spell durations live on
// `actor.timers: [{ id, kind, remainingRounds, source? }]`. The
// engine's `Combat.turnEnd` (and the host calling
// `Combat.tickTimers` directly) decrements each entry, removes
// expired ones, and returns the list of just-expired entries so the
// host can run side effects (e.g. remove a condition the timer was
// shadowing).
//
// Timers are deliberately a flat array rather than a map keyed by
// id — multiple effects may share an id (two Bless spells stacking
// in plugin packs that allow it; multiple stacks of a custom
// condition). The host owns whether to deduplicate.

/**
 * Decrement every timer on the actor by one round. Returns
 * `{ actor, expired }` — the new actor has only the non-expired
 * timers, and `expired` lists the entries that just dropped to 0.
 *
 * Timers with `remainingRounds` of 0 or below are treated as
 * already expired (defensive — host might queue a timer for
 * immediate expiry); returning them in `expired` lets the host
 * react to ad-hoc additions the same way.
 */
export function tickTimers(actor) {
  if (!Array.isArray(actor.timers) || actor.timers.length === 0) {
    return { actor, expired: [] };
  }
  const expired = [];
  const remaining = [];
  for (const t of actor.timers) {
    const next = (t.remainingRounds ?? 0) - 1;
    if (next <= 0) expired.push(t);
    else remaining.push({ ...t, remainingRounds: next });
  }
  return {
    actor: { ...actor, timers: remaining },
    expired
  };
}

/**
 * Append a fresh timer onto the actor. Pure — returns a new actor.
 * Validates the shape so a misconfigured timer fails at the
 * boundary rather than at the next tick.
 */
export function addTimer(actor, timer) {
  if (!timer || typeof timer !== 'object') {
    throw new Error('addTimer: timer must be an object');
  }
  if (typeof timer.id !== 'string' || timer.id.length === 0) {
    throw new Error('addTimer: timer.id must be a non-empty string');
  }
  if (!Number.isInteger(timer.remainingRounds) || timer.remainingRounds < 1) {
    throw new Error('addTimer: timer.remainingRounds must be a positive integer');
  }
  const existing = Array.isArray(actor.timers) ? actor.timers : [];
  return { ...actor, timers: [...existing, { ...timer }] };
}

/**
 * Turn-start lifecycle hook. Pure on the actor — the engine binding
 * wraps this to also fire the `onTurnStart` hook so plugins can
 * react. The module-level function returns the unchanged actor
 * because the turn start itself is a *signal*, not a state change;
 * any tick-down logic lives at turn end.
 */
export function turnStart(actor) {
  return { actor };
}

/**
 * Turn-end lifecycle. Decrements timers and returns the resulting
 * actor + expired timers. The engine binding wraps this to fire the
 * `onTurnEnd` hook with the expired list as part of the payload.
 */
export function turnEnd(actor) {
  return tickTimers(actor);
}

// === Healing helpers (since 1.4.0) ===

export function heal(actor, amount) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('heal: amount must be a non-negative integer');
  }
  const hpBefore = actor.hp ?? 0;
  if (amount === 0) {
    return { healed: 0, hpBefore, hpAfter: hpBefore, actor };
  }
  const hpMax = actor.hpMax ?? Infinity;
  const hpAfter = Math.min(hpMax, hpBefore + amount);
  const healed = hpAfter - hpBefore;
  let next = { ...actor, hp: hpAfter };
  if (hpBefore <= 0 && hpAfter > 0) {
    if ((actor.conditions ?? []).includes('unconscious')) {
      next = removeCondition(next, 'unconscious');
    }
    if (next.deathSaves) next = { ...next, deathSaves: freshDeathSaves() };
  }
  return { healed, hpBefore, hpAfter, actor: next };
}
