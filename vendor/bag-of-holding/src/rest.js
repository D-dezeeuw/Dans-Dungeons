// === Rest mechanics (SRD 5.2 § Short Rest, § Long Rest) ===
//
// Short Rest: spend Hit Dice to recover HP. Each die rolls + the
// actor's Constitution modifier, restoring that much (minimum 1
// HP per the SRD).
//
// Long Rest: HP back to max; half of the actor's total Hit Dice
// recovered (rounded down, minimum 1); the death-save tracker
// clears; one level of Exhaustion drops off; spell slots refill.
//
// Functions are pure: actor in, new actor out. The host orchestrates
// *when* — typically one `spendHitDie` per Hit Die the player spends
// during a short rest, and one `longRest` per full night.

import { rollDie } from './dice.js';
import { modFromScore } from './checks.js';
import { DEFAULT_RULES } from './rules.js';
import { freshDeathSaves } from './combat.js';
import { longRest as longRestSlots, shortRest as shortRestSlots } from './spellcasting.js';
import { exhaustion } from './conditions.js';
import { refreshResources } from './mechanics.js';

/**
 * Spend one Hit Die. SRD 5.2 § Short Rest: "the player rolls that
 * die, adds the character's Constitution modifier to it, and
 * regains a number of Hit Points equal to the total (minimum of 1)."
 *
 * Returns `{ healed, hpAfter, actor }`:
 *   - `healed`  — applied HP delta, capped by hpMax (can be less
 *                 than the raw roll if the actor was near full).
 *   - `hpAfter` — the resulting `hp` field on the new actor.
 *   - `actor`   — new actor with `hp` and `hitDiceUsed` updated.
 *
 * Throws on a misconfigured actor (non-integer `hitDie`) — that's a
 * host bug, not a runtime branch. Returns `healed: 0` when the
 * actor has no Hit Dice left to spend, matching "spent none"
 * semantics rather than throwing on the boundary case.
 */
export function spendHitDie(actor, rng = Math.random) {
  if (!Number.isInteger(actor.hitDie) || actor.hitDie < 1) {
    throw new Error('spendHitDie: actor.hitDie must be a positive integer');
  }
  const total = actor.hitDiceTotal ?? actor.level ?? 0;
  const used = actor.hitDiceUsed ?? 0;
  if (used >= total) return { healed: 0, hpAfter: actor.hp ?? 0, actor };

  const conMod = modFromScore(actor.abilityScores?.con ?? 10);
  const die = rollDie(actor.hitDie, rng);
  // SRD wording: "minimum of 1" — a CON penalty deeper than the
  // die's face shouldn't *cost* HP, it just heals for 1.
  const raw = Math.max(1, die + conMod);

  const hpBefore = actor.hp ?? 0;
  const hpMax = actor.hpMax ?? Infinity;
  const hpAfter = Math.min(hpBefore + raw, hpMax);

  return {
    die,                  // raw face for logging / replay
    conMod,
    healed: hpAfter - hpBefore,
    hpAfter,
    actor: { ...actor, hp: hpAfter, hitDiceUsed: used + 1 }
  };
}

/**
 * Half-rounded-down Hit Dice recovered on a Long Rest, with a
 * minimum of 1. The SRD's exact wording: "the character regains
 * spent Hit Dice, up to a number of dice equal to half of the
 * character's total Hit Dice (minimum of 1 die)."
 */
function halfHitDiceRecovered(total) {
  return Math.max(1, Math.floor(total / 2));
}

/**
 * Apply one Long Rest. SRD 5.2 § Long Rest:
 *   - Hit Points restored to maximum.
 *   - Half the character's total Hit Dice recovered (default).
 *   - The death-save tracker resets.
 *   - One level of Exhaustion removed.
 *   - All spell slots refill.
 *
 * The rule knob `rules.longRestHitDiceRecovery` retunes Hit Dice
 * recovery for variants:
 *   - `'half'` (default) — SRD baseline.
 *   - `'all'`  — heroic packs.
 *   - `'none'` — gritty packs (matches the optional "Slow Natural
 *                Healing" variant in the DMG).
 */
export function longRest(actor, rules = DEFAULT_RULES) {
  const total = actor.hitDiceTotal ?? actor.level ?? 0;
  const used = actor.hitDiceUsed ?? 0;
  const mode = rules.longRestHitDiceRecovery;
  let recovered;
  if (mode === 'all') recovered = used;
  else if (mode === 'none') recovered = 0;
  else recovered = halfHitDiceRecovered(total);   // 'half' default
  const nextUsed = Math.max(0, used - recovered);

  // hpMax falls back to current hp for actors that never went down
  // (a fresh L1 character with `hp: 8` and no `hpMax`); the rest
  // doesn't strand them at a lower value than they started with.
  const hpMax = actor.hpMax ?? actor.hp ?? 0;

  let next = { ...actor, hp: hpMax, hitDiceUsed: nextUsed };

  if (next.deathSaves) next = { ...next, deathSaves: freshDeathSaves() };
  next = exhaustion.reduce(next, 1);
  if (Array.isArray(next.spellSlots)) {
    next = { ...next, spellSlots: longRestSlots(next.spellSlots) };
  }
  // Class-feature resources: long rest restores both short- and
  // long-tagged counters (per SRD wording: a Long Rest IS a Short
  // Rest plus more).
  next = refreshResources(next, 'long');
  return next;
}

/**
 * Apply one Short Rest. SRD 5.2 § Short Rest covers Hit Dice
 * spending (the host calls `spendHitDie` separately for each die)
 * and class-feature refresh — Second Wind, Action Surge, Channel
 * Divinity, etc. Warlock pact slots also refresh on Short Rest.
 * Spell slots from other casters are NOT touched.
 *
 * Hit Dice spending is left to the host because the *choice* of
 * how many dice to spend is a per-player decision the engine can't
 * make on its own.
 */
export function shortRest(actor) {
  let next = actor;
  if (Array.isArray(next.spellSlots)) {
    next = { ...next, spellSlots: shortRestSlots(next.spellSlots) };
  }
  next = refreshResources(next, 'short');
  return next;
}
