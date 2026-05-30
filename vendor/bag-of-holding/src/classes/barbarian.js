// SRD 5.2 Barbarian, levels 1–10.
//   L1 Rage, Unarmored Defense, Weapon Mastery.
//   L2 Reckless Attack, Danger Sense.
//   L3 Primal Path (subclass).
//   L5 Extra Attack, Fast Movement.
//   L7 Feral Instinct, Instinctive Pounce.
//   L9 Brutal Strike.

import { spendResource } from '../mechanics.js';

/**
 * SRD 5.2 § Barbarian Features table — Rages column. Number of
 * Rages the Barbarian can enter per Long Rest at each class level.
 *
 * L20 sits at "Unlimited" in the PHB; we model that as 999 because
 * the resource counter is integer-only, and a player isn't going to
 * spend 999 rages in a single session — keeps the math layer
 * compatible without introducing a sentinel value across every
 * resource consumer. Future enhancement: a `max: 'unlimited'`
 * sentinel handled uniformly by `spendResource`.
 */
export const RAGES_BY_LEVEL = Object.freeze({
  1: 2,  2: 2,  3: 3,  4: 3,  5: 3,
  6: 4,  7: 4,  8: 4,  9: 4, 10: 4,
  11: 4, 12: 5, 13: 5, 14: 5, 15: 5,
  16: 5, 17: 6, 18: 6, 19: 6, 20: 999
});

/**
 * SRD 5.2 § Barbarian Features table — Rage Damage column. Flat
 * bonus added to damage dealt with a Strength weapon attack (or
 * Strength-based Unarmed Strike) while raging.
 *
 *   L1–L8  → +2
 *   L9–L15 → +3
 *   L16+   → +4
 */
export function rageDamageForLevel(level) {
  if (level >= 16) return 4;
  if (level >= 9) return 3;
  return 2;
}

/**
 * SRD 5.2 § Barbarian — Rage duration: lasts until the end of the
 * Barbarian's next turn, extensible (by attack, by forcing a save,
 * or as a Bonus Action) for up to a total of 10 minutes. We model
 * 10 minutes as 100 rounds — the engine carries the upper bound;
 * the host (or future v1.6 turn-lifecycle hooks) ticks it down.
 */
export const RAGE_MAX_ROUNDS = 100;

/** Damage types that resistance applies to while raging. */
export const RAGE_RESISTANCES = Object.freeze(['bludgeoning', 'piercing', 'slashing']);

export default {
  id: 'barbarian',
  name: 'Barbarian',
  hitDie: 12,
  primaryAbility: 'str',
  savingThrowProficiencies: ['str', 'con'],
  weaponMasterySlots: 2,
  extraAttacks: { 5: 1 },
  subclasses: {
    berserker: {
      id: 'berserker',
      name: 'Path of the Berserker',
      features: {
        3: ['Frenzy']
      }
    }
  },
  features: {
    1: ['Rage', 'Unarmored Defense'],
    2: ['Reckless Attack', 'Danger Sense'],
    3: ['Primal Path'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Fast Movement'],
    6: ['Subclass Feature'],
    7: ['Feral Instinct', 'Instinctive Pounce'],
    8: ['Ability Score Improvement'],
    9: ['Brutal Strike'],
    10: ['Subclass Feature']
  },
  // Resource-bearing features (since 1.3.1). Rage refreshes on Long
  // Rest with one use recovered on Short Rest per SRD 5.2 § Barbarian
  // — Rage; the partial-recovery field is honoured by
  // `Mechanics.refreshResources` (see src/mechanics.js).
  resources: {
    rage: {
      max: (level) => RAGES_BY_LEVEL[level] ?? 6,
      refreshes: 'long',
      shortRestRecovery: 1
    }
  },
  mechanics: {
    /**
     * SRD 5.2 § Barbarian — Rage: as a Bonus Action, enter Rage.
     * Sets `actor.rage` to a state record the host queries while
     * resolving STR weapon attacks, STR checks/saves, and incoming
     * BPS damage. Returns either `{ ok: true, damageBonus, actor }`
     * or `{ ok: false, reason }`.
     *
     * Raging on an already-raging actor is a host bug — surfaces as
     * `{ ok: false, reason }` rather than a throw so the UI can
     * surface the affordance gracefully.
     */
    rage: (actor, _args, _ctx) => {
      if (actor.rage?.active) {
        return { ok: false, reason: 'already raging' };
      }
      const result = spendResource(actor, 'rage');
      if (!result.ok) return result;
      const level = actor.level ?? 1;
      const damageBonus = rageDamageForLevel(level);
      return {
        ok: true,
        damageBonus,
        actor: {
          ...result.actor,
          rage: {
            active: true,
            roundsRemaining: RAGE_MAX_ROUNDS,
            damageBonus,
            resistances: [...RAGE_RESISTANCES]
          }
        }
      };
    },
    /**
     * End Rage early (Bonus Action per SRD). Clears `actor.rage`.
     * `{ ok: false, reason }` when the actor wasn't raging — same
     * "host should have gated the chip" semantics as `rage()`.
     */
    endRage: (actor) => {
      if (!actor.rage?.active) {
        return { ok: false, reason: 'not raging' };
      }
      const { rage: _, ...rest } = actor;
      return { ok: true, actor: rest };
    },
    /**
     * Read-only: the bonus damage the Barbarian adds to a STR
     * weapon attack right now. Returns 0 if not raging. The host
     * calls this when computing each STR-based weapon damage roll
     * and adds the result to the modifier.
     */
    rageDamageBonus: (actor) => {
      if (!actor.rage?.active) return { bonus: 0 };
      return { bonus: actor.rage.damageBonus };
    },
    /**
     * Read-only: is the actor currently raging? Boolean result for
     * chip-state and UI affordances.
     */
    isRaging: (actor) => ({ raging: Boolean(actor.rage?.active) })
  }
};
