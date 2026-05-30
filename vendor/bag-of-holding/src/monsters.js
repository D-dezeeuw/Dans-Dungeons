// === Monster mechanics (SRD 5.2 § Monsters, since 1.10.0) ===
//
// Monsters previously carried only the data the encounter system
// needed to resolve attacks (AC, HP, abilities, basic damage spec).
// This module adds the structural mechanics: Multiattack,
// Legendary Actions (with Legendary Resistance), Lair Actions,
// Mythic Actions, Innate Spellcasting, senses, save proficiencies,
// languages, and damage / condition immunity arrays (the latter two
// feed the 1.4.0 damage pipeline and 1.5.0 condition immunity).
//
// Pure functions throughout. The host owns the encounter loop and
// the narration; the engine owns the counters and the predicates.

import { rollDie } from './dice.js';

/**
 * Build the multiattack sequence per the monster's stat block.
 * Returns the array of attack references in order. The host resolves
 * each via `Combat.attackRoll`.
 *
 * Stat-block shape:
 *   `monster.multiattack: { attacks: [{ name, attackRef }] }`
 * where `attackRef` is an index into `monster.attacks` or a string
 * matching one of `monster.attacks[].name`. Host-side resolution
 * decides which.
 */
export function multiattackSequence(monster) {
  if (!monster.multiattack || !Array.isArray(monster.multiattack.attacks)) {
    return [];
  }
  return monster.multiattack.attacks.slice();
}

// === Legendary Actions ===

/** Initial state object for a monster's Legendary Action pool. */
export function freshLegendaryState(monster) {
  if (!monster.legendaryActions) return null;
  const max = monster.legendaryActions.uses ?? 3;   // SRD default 3
  return { used: 0, max };
}

/**
 * Spend `cost` (default 1 per 2024 SRD) of a monster's legendary
 * action pool. Returns the new state + the named option (so the
 * host can resolve its effect). Refuses if not enough uses.
 *
 * `actor.legendary` carries the live pool — `{ used, max }`. The
 * host initialises this via `freshLegendaryState` at encounter
 * start.
 */
export function useLegendaryAction(actor, monster, optionId, cost = 1) {
  if (!monster.legendaryActions) {
    return { ok: false, reason: 'monster has no Legendary Actions' };
  }
  if (!Number.isInteger(cost) || cost < 1) {
    throw new Error('useLegendaryAction: cost must be a positive integer');
  }
  const pool = actor.legendary ?? freshLegendaryState(monster);
  if (pool.max - pool.used < cost) {
    return { ok: false, reason: `not enough legendary uses: ${pool.max - pool.used} left` };
  }
  const option = monster.legendaryActions.options?.find((o) => o.id === optionId);
  if (!option) {
    return { ok: false, reason: `unknown legendary option: ${optionId}` };
  }
  return {
    ok: true,
    option,
    actor: {
      ...actor,
      legendary: { ...pool, used: pool.used + cost }
    }
  };
}

/**
 * Refresh the Legendary Action pool at the start of the monster's
 * turn (SRD 2024: "expended uses of Legendary Actions are regained
 * at the start of each of a monster's turns"). Returns the new
 * actor with `used: 0`.
 */
export function refreshLegendaryActions(actor) {
  if (!actor.legendary) return actor;
  if (actor.legendary.used === 0) return actor;
  return { ...actor, legendary: { ...actor.legendary, used: 0 } };
}

// === Legendary Resistance ===

/** Initial state for the Legendary Resistance counter. */
export function freshLegendaryResistance(monster) {
  if (!monster.legendaryResistance) return null;
  const max = monster.legendaryResistance.uses ?? 3;
  return { used: 0, max };
}

/**
 * Burn a Legendary Resistance use to convert a failed save to a
 * success. Returns `{ ok, actor }` — `ok: false` if the monster
 * doesn't have LR or the pool is empty.
 */
export function useLegendaryResistance(actor, monster) {
  if (!monster.legendaryResistance) {
    return { ok: false, reason: 'monster has no Legendary Resistance' };
  }
  const pool = actor.legendaryResistance ?? freshLegendaryResistance(monster);
  if (pool.used >= pool.max) {
    return { ok: false, reason: 'Legendary Resistance pool exhausted' };
  }
  return {
    ok: true,
    actor: {
      ...actor,
      legendaryResistance: { ...pool, used: pool.used + 1 }
    }
  };
}

// === Lair Actions ===

/**
 * Predicate: does the monster have a Lair Action available right
 * now? Lair actions fire on initiative count 20 (losing all ties)
 * and only when the monster is in its lair.
 */
export function lairActionAvailable(monster, args = {}) {
  if (!monster.lairActions) return false;
  if (args.inLair !== true) return false;
  const trigger = monster.lairActions.triggersOnInitiative ?? 20;
  return args.initiativeCount === trigger;
}

/**
 * Fire a lair action. Returns the option to resolve, or refuses
 * with a debuggable reason. Lair actions don't consume from a
 * counter in the SRD baseline (they fire once per round at init 20),
 * so this is a simple lookup-and-report.
 */
export function fireLairAction(monster, optionId) {
  if (!monster.lairActions) {
    return { ok: false, reason: 'monster has no Lair Actions' };
  }
  const option = monster.lairActions.options?.find((o) => o.id === optionId);
  if (!option) {
    return { ok: false, reason: `unknown lair-action option: ${optionId}` };
  }
  return { ok: true, option };
}

// === Innate Spellcasting ===

/**
 * Build initial per-day counters from the monster's innate spell
 * list. Returns a map keyed by spell id with `{ used, max }`. At-
 * will spells aren't tracked (they don't deplete).
 *
 * Stat-block shape:
 *   `monster.innateSpellcasting: { atWill: [...], 3day: [...], 1day: [...] }`
 */
export function freshInnateState(monster) {
  const innate = monster.innateSpellcasting;
  if (!innate) return null;
  const out = {};
  for (const id of innate['3day'] ?? []) out[id] = { used: 0, max: 3 };
  for (const id of innate['1day'] ?? []) out[id] = { used: 0, max: 1 };
  return out;
}

/**
 * Cast an innate spell. At-will spells succeed without depleting
 * anything; per-day spells decrement the appropriate counter.
 */
export function castInnate(actor, monster, spellId) {
  const innate = monster.innateSpellcasting;
  if (!innate) return { ok: false, reason: 'monster has no innate spellcasting' };
  const atWill = (innate.atWill ?? []).includes(spellId);
  if (atWill) return { ok: true, actor, atWill: true };
  const tracked = actor.innateSpells ?? freshInnateState(monster);
  const counter = tracked?.[spellId];
  if (!counter) return { ok: false, reason: `${spellId} is not in this monster's innate list` };
  if (counter.used >= counter.max) {
    return { ok: false, reason: `${spellId} has no uses remaining today` };
  }
  return {
    ok: true,
    actor: {
      ...actor,
      innateSpells: { ...tracked, [spellId]: { ...counter, used: counter.used + 1 } }
    }
  };
}

/**
 * Refresh per-day innate counters. Called from the engine's
 * `onLongRest` (or the dawn handler for monsters whose lore says
 * "regains all spells at dawn"). Returns the new actor.
 */
export function refreshInnateSpells(actor, monster) {
  if (!monster.innateSpellcasting) return actor;
  const fresh = freshInnateState(monster);
  return { ...actor, innateSpells: fresh };
}

// === Senses + saves accessors ===

/** Return the senses block; defaults to an empty record. */
export function senses(monster) {
  return monster.senses ?? {};
}

/**
 * Get a monster's saving-throw bonus for an ability. Returns the
 * trained bonus from `monster.saves[ability]` when declared,
 * otherwise the bare ability modifier from `abilityScores`.
 */
export function saveBonus(monster, ability) {
  const trained = monster.saves?.[ability];
  if (trained !== undefined) return trained;
  const score = monster.abilityScores?.[ability] ?? 10;
  return Math.floor((score - 10) / 2);
}
