// SRD 5.2 Wizard, levels 1–10.
//   L1  Spellcasting (full caster, INT, prepared), Arcane Recovery.
//   L2  Arcane Tradition (subclass).
//   L3+ Standard ASI / subclass-feature progression.

import { spendResource } from '../mechanics.js';

/**
 * SRD 5.2 § Wizard — Arcane Recovery: spell-slot levels recoverable
 * during a Short Rest. The PHB wording: "spell slots can have a
 * combined level equal to no more than half your Wizard level
 * (round up), and none of the slots can be level 6 or higher."
 *
 * Returns the recovery cap at the given level (= ⌈level / 2⌉).
 */
export function arcaneRecoveryCapForLevel(level) {
  return Math.ceil((level ?? 1) / 2);
}

/** Highest slot level a Wizard can recover via Arcane Recovery. */
export const ARCANE_RECOVERY_MAX_SLOT_LEVEL = 5;

export default {
  id: 'wizard',
  name: 'Wizard',
  hitDie: 6,
  primaryAbility: 'int',
  savingThrowProficiencies: ['int', 'wis'],
  spellcasting: { ability: 'int', cantripsKnown: { 1: 3, 4: 4, 10: 5 }, progression: 'full', preparation: 'prepared' },
  subclasses: {
    'evoker': {
      id: 'evoker',
      name: 'Evoker',
      features: {
        3: ['Evocation Savant', 'Sculpt Spells']
      }
    }
  },
  features: {
    1: ['Spellcasting', 'Arcane Recovery'],
    2: ['Arcane Tradition'],
    3: [],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Subclass Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Subclass Feature']
  },
  // Resource-bearing features (since 1.3.10). Arcane Recovery is one
  // use per Long Rest — the use itself refunds slot levels.
  resources: {
    arcaneRecovery: {
      max: 1,
      refreshes: 'long'
    }
  },
  mechanics: {
    /**
     * SRD 5.2 § Wizard — Arcane Recovery. Once per Long Rest, on a
     * Short Rest, recover spent spell slot levels whose combined
     * sum is at most ⌈Wizard level / 2⌉. No individual slot may
     * be 6th level or higher.
     *
     * `args.slotLevels: number[]` — the slot levels to recover (one
     * entry per slot, repeated for multiples). Example: `[1, 1]`
     * recovers two L1 slots (combined sum 2); `[2]` recovers a
     * single L2 (combined sum 2).
     *
     * Validates: per-slot cap, combined-sum cap, availability of
     * each requested slot in the actor's spent pool, and one-use-
     * per-Long-Rest. Refuses cleanly on any failure with no state
     * mutation.
     */
    arcaneRecovery: (actor, args = {}, _ctx) => {
      const slotLevels = args.slotLevels;
      if (!Array.isArray(slotLevels) || slotLevels.length === 0) {
        return { ok: false, reason: 'args.slotLevels must be a non-empty array of slot levels' };
      }
      for (const lvl of slotLevels) {
        if (!Number.isInteger(lvl) || lvl < 1) {
          return { ok: false, reason: 'each slot level must be a positive integer' };
        }
        if (lvl > ARCANE_RECOVERY_MAX_SLOT_LEVEL) {
          return {
            ok: false,
            reason: `Arcane Recovery cannot recover slots above level ${ARCANE_RECOVERY_MAX_SLOT_LEVEL}`
          };
        }
      }
      const sum = slotLevels.reduce((a, b) => a + b, 0);
      const level = actor.level ?? 1;
      const cap = arcaneRecoveryCapForLevel(level);
      if (sum > cap) {
        return {
          ok: false,
          reason: `combined slot levels ${sum} exceed Arcane Recovery cap ${cap}`
        };
      }

      if (!Array.isArray(actor.spellSlots)) {
        return { ok: false, reason: 'actor has no spellSlots to recover' };
      }

      // Plan the recovery before mutating: each requested slot must
      // find a spent slot of that level. Track which slots get
      // decremented and by how much so we apply atomically.
      const need = new Map();
      for (const lvl of slotLevels) need.set(lvl, (need.get(lvl) ?? 0) + 1);

      const nextSlots = actor.spellSlots.map((s) => ({ ...s }));
      for (const [lvl, count] of need.entries()) {
        let toRecover = count;
        for (const s of nextSlots) {
          if (s.level === lvl && s.used > 0 && toRecover > 0) {
            const recoverable = Math.min(toRecover, s.used);
            s.used -= recoverable;
            toRecover -= recoverable;
          }
        }
        if (toRecover > 0) {
          return {
            ok: false,
            reason: `not enough spent level-${lvl} slots to recover ${count}`
          };
        }
      }

      const useResult = spendResource(actor, 'arcaneRecovery');
      if (!useResult.ok) return useResult;

      return {
        ok: true,
        recovered: slotLevels.slice(),
        combinedLevels: sum,
        actor: { ...useResult.actor, spellSlots: nextSlots }
      };
    },
    /**
     * Read-only: Arcane Recovery status for UI affordances. Reports
     * whether the feature is available right now (not yet used this
     * Long Rest cycle) and the recoverable-level cap at this level.
     */
    arcaneRecoveryStatus: (actor) => {
      const r = actor.resources?.arcaneRecovery;
      const level = actor.level ?? 1;
      return {
        available: Boolean(r && r.used < r.max),
        cap: arcaneRecoveryCapForLevel(level)
      };
    }
  }
};
