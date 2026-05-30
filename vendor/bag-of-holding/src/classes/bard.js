// SRD 5.2 Bard, levels 1–10.
//   L1 Bardic Inspiration, Spellcasting (full caster, CHA, known list).
//   L2 Expertise (2 skills), Jack of All Trades.
//   L3 Bard College (subclass).
//   L5 Font of Inspiration (BI refreshes on Short Rest; expend a
//      spell slot — no action — to regain one BI use), BI die → d8.
//   L10 Magical Secrets, BI die → d10.
//   L15 BI die → d12.

import { spendResource } from '../mechanics.js';
import { modFromScore } from '../checks.js';

/**
 * SRD 5.2 § Bard — Bardic Inspiration: die size by class level.
 *   L1–L4   → d6
 *   L5–L9   → d8
 *   L10–L14 → d10
 *   L15+    → d12
 */
export function bardicInspirationDieSize(level) {
  if (level >= 15) return 12;
  if (level >= 10) return 10;
  if (level >= 5) return 8;
  return 6;
}

/**
 * SRD 5.2 § Bard — uses per rest equal the Bard's Charisma modifier
 * (minimum of 1). CHA mod 0 (CHA 10–11) still yields one use per
 * rest — the SRD floors at 1 for low-CHA edge cases.
 */
export function bardicInspirationUses(chaScore) {
  return Math.max(1, modFromScore(chaScore ?? 10));
}

export default {
  id: 'bard',
  name: 'Bard',
  hitDie: 8,
  primaryAbility: 'cha',
  savingThrowProficiencies: ['dex', 'cha'],
  spellcasting: {
    ability: 'cha',
    cantripsKnown: { 1: 2, 4: 3 },
    progression: 'full',
    preparation: 'known'
  },
  subclasses: {
    'college-of-lore': {
      id: 'college-of-lore',
      name: 'College of Lore',
      features: {
        3: ['Bonus Proficiencies', 'Cutting Words']
      }
    }
  },
  features: {
    1: ['Bardic Inspiration', 'Spellcasting'],
    2: ['Expertise', 'Jack of All Trades'],
    3: ['Bard College'],
    4: ['Ability Score Improvement'],
    5: ['Font of Inspiration'],
    6: ['Subclass Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: ['Expertise (2 more skills)'],
    10: ['Magical Secrets']
  },
  // Resource-bearing features (since 1.3.2). Uses = CHA mod (min 1);
  // refresh tag flips from 'long' to 'short' at L5 per Font of
  // Inspiration. `freshResources` evaluates both fields against the
  // actor at provisioning time, so re-running `freshResources` on
  // level-up correctly rebuilds the counter with the new refresh
  // contract.
  resources: {
    bardicInspiration: {
      max: (_level, actor) => bardicInspirationUses(actor?.abilityScores?.cha),
      refreshes: (level) => level >= 5 ? 'short' : 'long'
    }
  },
  mechanics: {
    /**
     * SRD 5.2 § Bard — Bardic Inspiration: as a Bonus Action,
     * inspire a creature within 60 ft that can see or hear you.
     * Spends one use, returns the die spec for the target to roll
     * later (within the next hour, once per failed D20 Test).
     *
     * The engine doesn't track *which* creature holds the die — that
     * binding lives on the host as `target.bardicInspirationDie`
     * (or wherever the host stores it). The mechanic just reports
     * what die was conferred.
     */
    bardicInspiration: (actor, _args, _ctx) => {
      const result = spendResource(actor, 'bardicInspiration');
      if (!result.ok) return result;
      const level = actor.level ?? 1;
      const dieSize = bardicInspirationDieSize(level);
      return {
        ok: true,
        die: `1d${dieSize}`,
        dieSize,
        actor: result.actor
      };
    },
    /**
     * SRD 5.2 § Bard — Font of Inspiration (L5): "you can expend a
     * spell slot (no action required) to regain one expended use of
     * Bardic Inspiration". Refunds a use, consumes a slot of the
     * level passed in `args.slotLevel`.
     *
     * Refuses (no state mutation) when:
     *   - Bard is below level 5
     *   - `args.slotLevel` is missing or invalid
     *   - the actor has no spell slots
     *   - no slot of the requested level is available
     *   - BI is already at full uses
     */
    fontOfInspiration: (actor, args = {}, _ctx) => {
      const level = actor.level ?? 1;
      if (level < 5) {
        return { ok: false, reason: 'requires Bard level 5 (Font of Inspiration)' };
      }
      const slotLevel = args.slotLevel;
      if (!Number.isInteger(slotLevel) || slotLevel < 1) {
        return { ok: false, reason: 'args.slotLevel must be a positive integer' };
      }
      if (!Array.isArray(actor.spellSlots)) {
        return { ok: false, reason: 'actor has no spellSlots' };
      }
      const slotIdx = actor.spellSlots.findIndex(
        (s) => s.level === slotLevel && s.used < s.max
      );
      if (slotIdx === -1) {
        return { ok: false, reason: `no spell slot of level ${slotLevel} available` };
      }
      const r = actor.resources?.bardicInspiration;
      if (!r) return { ok: false, reason: 'no bardicInspiration resource' };
      if (r.used === 0) {
        return { ok: false, reason: 'bardicInspiration already at full' };
      }
      const nextSlots = actor.spellSlots.slice();
      nextSlots[slotIdx] = { ...nextSlots[slotIdx], used: nextSlots[slotIdx].used + 1 };
      return {
        ok: true,
        actor: {
          ...actor,
          spellSlots: nextSlots,
          resources: {
            ...actor.resources,
            bardicInspiration: { ...r, used: r.used - 1 }
          }
        }
      };
    },
    /**
     * Read-only: the die size the Bard is currently conferring.
     * Returns `{ dieSize, die }` for chip-state and UI affordances.
     */
    inspirationDie: (actor) => {
      const level = actor.level ?? 1;
      const dieSize = bardicInspirationDieSize(level);
      return { dieSize, die: `1d${dieSize}` };
    }
  }
};
