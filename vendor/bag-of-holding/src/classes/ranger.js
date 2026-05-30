// SRD 5.2 Ranger, levels 1–10.
//   L1  Favored Enemy (Hunter's Mark always prepared + PB-many free
//       casts per Long Rest), Spellcasting (half-caster, WIS,
//       prepared).
//   L2  Deft Explorer, Fighting Style.
//   L3  Ranger Subclass, Primal Awareness.
//   L5  Extra Attack.
//   L9  Expertise.

import { spendResource } from '../mechanics.js';

/**
 * SRD 5.2 § Ranger — Favored Enemy: number of free Hunter's Mark
 * casts per Long Rest. Scales with proficiency bonus, which keeps
 * the table compact:
 *   L1–L4   → 2
 *   L5–L8   → 3
 *   L9–L12  → 4
 *   L13–L16 → 5
 *   L17+    → 6
 */
export function huntersMarkFreeCastsForLevel(level) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

export default {
  id: 'ranger',
  name: 'Ranger',
  hitDie: 10,
  primaryAbility: 'dex',
  savingThrowProficiencies: ['str', 'dex'],
  extraAttacks: { 5: 1 },
  spellcasting: {
    ability: 'wis',
    progression: 'half',
    preparation: 'prepared'
  },
  subclasses: {
    'hunter': {
      id: 'hunter',
      name: 'Hunter',
      features: {
        3: ["Hunter's Lore", "Hunter's Prey"]
      }
    }
  },
  features: {
    1: ['Favored Enemy', 'Spellcasting'],
    2: ['Deft Explorer', 'Fighting Style'],
    3: ['Ranger Subclass', 'Primal Awareness'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack'],
    6: ['Roving'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Expertise'],
    10: ['Tireless']
  },
  // Resource-bearing features (since 1.3.7). Free Hunter's Mark
  // casts refresh on Long Rest only.
  resources: {
    huntersMarkFree: {
      max: (level) => huntersMarkFreeCastsForLevel(level),
      refreshes: 'long'
    }
  },
  mechanics: {
    /**
     * SRD 5.2 § Ranger — cast Hunter's Mark. Prefers a free cast
     * (Favored Enemy) when one is available; falls back to a spell
     * slot of at least `args.slotLevel` (default 1) otherwise.
     *
     * Set `args.useFreeCast: false` to force a slot consumption
     * regardless of free uses remaining — useful when the host
     * wants to upcast.
     *
     * Binds the target to `actor.huntersMark = { targetId, castLevel }`.
     * Hunter's Mark is a Concentration spell in the 2024 SRD; the
     * host owns the concentration record (or the 1.5 concentration
     * auto-bind will, once it lands).
     */
    castHuntersMark: (actor, args = {}, _ctx) => {
      const targetId = args.targetId;
      if (typeof targetId !== 'string' || targetId.length === 0) {
        return { ok: false, reason: 'args.targetId required' };
      }

      const allowFree = args.useFreeCast !== false;
      if (allowFree) {
        const r = actor.resources?.huntersMarkFree;
        if (r && r.used < r.max) {
          const result = spendResource(actor, 'huntersMarkFree');
          return {
            ok: true,
            usedFreeCast: true,
            castLevel: 1,
            actor: { ...result.actor, huntersMark: { targetId, castLevel: 1 } }
          };
        }
      }

      const slotLevel = args.slotLevel ?? 1;
      if (!Number.isInteger(slotLevel) || slotLevel < 1) {
        return { ok: false, reason: 'args.slotLevel must be a positive integer' };
      }
      if (!Array.isArray(actor.spellSlots)) {
        return { ok: false, reason: 'no free casts available and no spellSlots on the actor' };
      }
      // Find the lowest-level available slot at or above the requested level.
      const slotIdx = actor.spellSlots.findIndex(
        (s) => s.level >= slotLevel && s.used < s.max
      );
      if (slotIdx === -1) {
        return { ok: false, reason: `no slot of level ${slotLevel} or higher available` };
      }
      const chosenSlot = actor.spellSlots[slotIdx];
      const nextSlots = actor.spellSlots.slice();
      nextSlots[slotIdx] = { ...chosenSlot, used: chosenSlot.used + 1 };
      return {
        ok: true,
        usedFreeCast: false,
        castLevel: chosenSlot.level,
        actor: {
          ...actor,
          spellSlots: nextSlots,
          huntersMark: { targetId, castLevel: chosenSlot.level }
        }
      };
    },
    /**
     * End an active Hunter's Mark (concentration drop, target dies,
     * Ranger chooses to dispel). Refuses when no Hunter's Mark is
     * active.
     */
    endHuntersMark: (actor) => {
      if (!actor.huntersMark) {
        return { ok: false, reason: 'no active Hunters Mark' };
      }
      const { huntersMark: _, ...rest } = actor;
      return { ok: true, actor: rest };
    },
    /**
     * Compute the Hunter's Mark damage rider for an attack against a
     * target. Returns either:
     *   `{ triggers: true, damageDice: '1d6', damageType: 'force' }`
     *   `{ triggers: false, reason }`
     *
     * The host calls this when resolving each weapon attack and adds
     * the rider damage on hit. Hunter's Mark at higher slot levels
     * doesn't increase the damage dice in the 2024 spell — slot
     * level extends duration, not damage — so the rider stays 1d6.
     */
    huntersMarkDamage: (actor, args = {}, _ctx) => {
      if (!actor.huntersMark) {
        return { triggers: false, reason: 'no active Hunters Mark' };
      }
      if (args.targetId !== actor.huntersMark.targetId) {
        return { triggers: false, reason: 'attack is not against the marked target' };
      }
      return {
        triggers: true,
        damageDice: '1d6',
        damageType: 'force'
      };
    },
    /**
     * Read-only: snapshot of the Favored Enemy free-cast pool for UI
     * affordances.
     */
    favoredEnemyStatus: (actor) => {
      const pool = actor.resources?.huntersMarkFree;
      if (!pool) return { remaining: 0, max: 0 };
      return { remaining: pool.max - pool.used, max: pool.max };
    }
  }
};
