// === Saves & edge mechanics (SRD 5.2, since 1.14.0) ===
//
// Heroic Inspiration, Halfling Lucky, Indomitable, generic
// reroll-once handlers, group checks, and Working Together (Help
// for skill checks). Each is a small pure helper the host slots
// into its existing check / save flow.

import { rollDie } from './dice.js';

// === Heroic Inspiration (SRD § Character Creation — Heroic Inspiration) ===

/** Predicate: does the actor have a stored Inspiration token? */
export function hasInspiration(actor) {
  return actor.inspiration === true;
}

/** Grant Inspiration. Pure: returns a new actor with the flag set. */
export function grantInspiration(actor) {
  return actor.inspiration === true ? actor : { ...actor, inspiration: true };
}

/**
 * Spend Inspiration. SRD: "you can expend your Heroic Inspiration
 * to reroll any die immediately after rolling it, and you must use
 * the new roll." Returns `{ ok, actor }` — refuses when there's no
 * Inspiration to spend.
 */
export function spendInspiration(actor) {
  if (actor.inspiration !== true) {
    return { ok: false, reason: 'no Heroic Inspiration to spend' };
  }
  const { inspiration: _, ...rest } = actor;
  return { ok: true, actor: rest };
}

// === Reroll-once patterns (Halfling Lucky, Indomitable,
// Diamond Soul, Stillness of Mind, Magic Resistance) ===
//
// Each of these is the same shape mechanically: take a roll, decide
// whether to reroll, return the better outcome. The differences are
// the *trigger* (when the reroll fires) and the *limit* (per-rest
// uses for Indomitable; always-on for Halfling Lucky).

/**
 * Halfling Lucky: when you roll a 1 on a D20 Test, reroll. Returns
 * `{ d20, replaced, original }` where `d20` is the kept value and
 * `replaced: true` indicates the reroll fired.
 *
 * `originalD20` is the host's existing roll; the engine re-rolls if
 * it was a 1. The rerolled value is kept *regardless* of whether
 * it's better (SRD: "you must use the new roll").
 */
export function applyHalflingLucky(originalD20, rng = Math.random) {
  if (originalD20 !== 1) {
    return { d20: originalD20, replaced: false, original: originalD20 };
  }
  const reroll = rollDie(20, rng);
  return { d20: reroll, replaced: true, original: 1 };
}

/**
 * Generic "reroll once per rest" pattern used by Indomitable,
 * Stillness of Mind, etc. The actor carries a resource counter
 * (e.g. `actor.resources.indomitable`); the helper takes the
 * already-rolled save outcome and decides whether to spend a use
 * to reroll.
 *
 * Inputs:
 *   - `actor` — must have a `resources` entry at `resourceId` with
 *     `{ used, max }`.
 *   - `resourceId` — the resource to spend (e.g. `'indomitable'`).
 *   - `failedSaveResult` — the result object from
 *     `Checks.savingThrow`; the helper only fires when `success`
 *     is false.
 *
 * Returns `{ used, actor, newRoll }` — `used: true` if the
 * resource was spent and a new d20 was rolled, with `newRoll`
 * carrying the replacement value; `used: false` returns the actor
 * unchanged.
 */
export function rerollFailedSave({ actor, resourceId }, rng = Math.random) {
  const r = actor.resources?.[resourceId];
  if (!r || r.used >= r.max) {
    return { used: false, actor };
  }
  const newRoll = rollDie(20, rng);
  return {
    used: true,
    newRoll,
    actor: {
      ...actor,
      resources: {
        ...actor.resources,
        [resourceId]: { ...r, used: r.used + 1 }
      }
    }
  };
}

// === Group checks (SRD § Playing the Game — Ability Checks) ===

/**
 * Resolve a group ability check. SRD: "if at least half the group
 * succeeds, the whole group succeeds; otherwise, the group fails."
 *
 * `successes`: integer count of individuals who passed.
 * `total`: integer count of individuals participating.
 *
 * Returns `{ success, threshold, successes, total }` —
 * `threshold` is the SRD's "ceiling of half" (rounded up).
 */
export function groupCheck({ successes, total }) {
  if (!Number.isInteger(successes) || successes < 0) {
    throw new Error('groupCheck: successes must be a non-negative integer');
  }
  if (!Number.isInteger(total) || total < 1) {
    throw new Error('groupCheck: total must be a positive integer');
  }
  const threshold = Math.ceil(total / 2);
  return { success: successes >= threshold, threshold, successes, total };
}

// === Working Together (SRD § Playing the Game — Working Together) ===

/**
 * Help variant for skill checks: if a proficient ally can help,
 * the actor gains advantage on the check. The helper just returns
 * `{ advantage: boolean }` — the host applies the advantage when
 * rolling.
 */
export function workingTogether({ allyProficient }) {
  return { advantage: allyProficient === true };
}
