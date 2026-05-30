// === Class feature mechanics (SRD 5.2 § Classes) ===
//
// Resource-bearing features (Rage uses, Second Wind, Channel
// Divinity, Wild Shape, Sorcery Points, Bardic Inspiration, etc.)
// live on `actor.resources` as a map of normalised counters, and
// dispatch through a `mechanics` map on each class def.
//
// The shape is deliberately small. The kernel's job is bookkeeping
// (a counter that ticks down, a refresh contract that ties to the
// rest system); the *effect* of spending the resource — heal X HP,
// add Y damage dice, set a flag — is class-specific and lives on
// the class handler.
//
//   actor.resources = {
//     secondWind: { used: 0, max: 1, refreshes: 'short' },
//     actionSurge: { used: 0, max: 1, refreshes: 'short' },
//     ...
//   }
//
// Class defs declare their resource specs alongside their handlers:
//
//   resources: {
//     secondWind: { max: 1, refreshes: 'short' }
//   },
//   mechanics: {
//     secondWind: (actor, args, ctx) => { ... }
//   }
//
// Rest functions (src/rest.js) call `refreshResources(actor, kind)`
// to zero out the matching counters; spending happens via
// `spendResource(actor, id)` which the class handler invokes.

import { rollDie } from './dice.js';
import { modFromScore } from './checks.js';

/**
 * Refresh tags for a resource counter.
 *   - `'short'` — refills on a Short Rest (and Long Rest).
 *   - `'long'`  — refills only on a Long Rest.
 *   - `'day'`   — refills only on a Long Rest, but tracked so a
 *                 future "Slow Natural Healing" / per-day pack can
 *                 split the contract from `'long'` without breaking
 *                 existing classes.
 */
export const REFRESH_KINDS = Object.freeze(['short', 'long', 'day']);

/** Build a fresh resource counter at full capacity.
 *
 * `shortRestRecovery` is an optional partial-recovery amount applied
 * when a `'long'`-tagged resource is touched by a Short Rest. The
 * canonical example is the 2024 Barbarian's Rage: full refresh on
 * Long Rest, recovers one use on a Short Rest. Defaults to 0
 * (no partial recovery), and is ignored entirely for resources whose
 * `refreshes` is already `'short'` (those refresh fully).
 */
export function freshResource({ max, refreshes, shortRestRecovery = 0 }) {
  if (!Number.isInteger(max) || max < 0) {
    throw new Error('freshResource: max must be a non-negative integer');
  }
  if (!REFRESH_KINDS.includes(refreshes)) {
    throw new Error(`freshResource: refreshes must be one of ${REFRESH_KINDS.join(', ')}`);
  }
  if (!Number.isInteger(shortRestRecovery) || shortRestRecovery < 0) {
    throw new Error('freshResource: shortRestRecovery must be a non-negative integer');
  }
  const counter = { used: 0, max, refreshes };
  if (shortRestRecovery > 0) counter.shortRestRecovery = shortRestRecovery;
  return counter;
}

/**
 * Build the resource map for a character of a given class and level.
 * Reads `classDef.resources`, evaluating any field that's a function
 * with `(level, actor)`. The optional `actor` argument is forwarded
 * to spec functions that need it — Bardic Inspiration's `max` reads
 * the actor's CHA modifier, for instance — but classes whose
 * resources are level-only (Fighter Second Wind, Paladin Lay on
 * Hands) ignore the extra argument and work fine without an actor.
 *
 * Returns `{}` for classes without resources — Wizards before Arcane
 * Recovery wires in, for instance, just have an empty map.
 */
export function freshResources(classDef, level, actor) {
  const out = {};
  const table = classDef?.resources;
  if (!table) return out;
  const evaluate = (field, fallback) => {
    if (field === undefined) return fallback;
    return typeof field === 'function' ? field(level, actor) : field;
  };
  for (const [id, spec] of Object.entries(table)) {
    const max = evaluate(spec.max, 0);
    if (max > 0) {
      out[id] = freshResource({
        max,
        refreshes: evaluate(spec.refreshes, 'long'),
        shortRestRecovery: evaluate(spec.shortRestRecovery, 0)
      });
    }
  }
  return out;
}

/**
 * Spend `amount` from `actor.resources[id]`. Returns either
 *   `{ ok: true, actor }` — actor with the counter advanced, or
 *   `{ ok: false, reason }` — string explanation for the host.
 *
 * Throws nothing for the not-enough case because the host typically
 * surfaces that as a "you can't do that yet" affordance, not an
 * exception. An unknown resource id is also `ok: false` rather than
 * a throw — host-side typos and class-feature names that the engine
 * doesn't yet know about should degrade gracefully.
 */
export function spendResource(actor, id, amount = 1) {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error('spendResource: amount must be a positive integer');
  }
  const r = actor.resources?.[id];
  if (!r) return { ok: false, reason: `unknown resource: ${id}` };
  const remaining = r.max - r.used;
  if (remaining < amount) {
    return { ok: false, reason: `not enough ${id}: ${remaining} left, ${amount} needed` };
  }
  return {
    ok: true,
    actor: {
      ...actor,
      resources: { ...actor.resources, [id]: { ...r, used: r.used + amount } }
    }
  };
}

/**
 * Refresh all resources matching the given rest kind. A Long Rest
 * also refreshes Short-Rest resources (Long is a superset of Short
 * per SRD 5.2 § Long Rest — "you regain spent Hit Dice" etc.).
 * 'day' is treated as a separate channel that only resets on
 * 'all'-refresh (debug / new-character).
 */
export function refreshResources(actor, kind) {
  if (!actor.resources) return actor;
  if (!['short', 'long', 'all'].includes(kind)) {
    throw new Error(`refreshResources: kind must be 'short', 'long', or 'all'`);
  }
  let changed = false;
  const next = {};
  for (const [id, r] of Object.entries(actor.resources)) {
    const shouldReset =
      kind === 'all' ||
      (kind === 'short' && r.refreshes === 'short') ||
      (kind === 'long' && (r.refreshes === 'short' || r.refreshes === 'long'));
    if (shouldReset && r.used > 0) {
      next[id] = { ...r, used: 0 };
      changed = true;
      continue;
    }
    // Partial recovery on Short Rest for `'long'`-tagged resources
    // that declare a `shortRestRecovery` count (Barbarian Rage,
    // future Bard Font of Inspiration, etc.).
    if (kind === 'short' && r.refreshes === 'long' && r.shortRestRecovery && r.used > 0) {
      const reduced = Math.max(0, r.used - r.shortRestRecovery);
      if (reduced !== r.used) {
        next[id] = { ...r, used: reduced };
        changed = true;
        continue;
      }
    }
    next[id] = r;
  }
  return changed ? { ...actor, resources: next } : actor;
}

/**
 * Dispatch a class mechanic. Looks up `classDef.mechanics[id]` and
 * invokes it with `(actor, args, ctx)` where `ctx` carries the
 * shared dependencies handlers need (the rng, dice helpers, the
 * ability-mod helper).
 *
 * Throws on an unknown mechanic — a misspelled chip id is always a
 * bug at the host. A class that simply doesn't have the mechanic
 * yet (e.g. Wizard before Arcane Recovery lands) is also a throw
 * because the host shouldn't have offered the chip in the first
 * place.
 */
export function applyMechanic({ actor, classDef, id, args = {} }, rng = Math.random) {
  const handlers = classDef?.mechanics;
  if (!handlers || !handlers[id]) {
    throw new Error(`Unknown class mechanic: ${classDef?.id ?? '?'}.${id}`);
  }
  return handlers[id](actor, args, { rng, rollDie, modFromScore });
}
