// SRD 5.2 Fighter, levels 1–10.
//   L1 adds Weapon Mastery (3 weapon slots, rotatable on a Long Rest)
//      and Second Wind (heal 1d10 + Fighter level, per Short Rest).
//   L2 adds Action Surge (extra action, per Short Rest)
//      and Tactical Mind (spend Second Wind to bump a failed check).
//   L5 adds Tactical Shift (Second Wind + half-Speed move w/o OAs).
// `weaponMasterySlots` is the count of weapon kinds whose mastery
// property the fighter can use; the loop tracks which specific
// weapons fill the slots in actor state.

import { spendResource } from '../mechanics.js';

export default {
  id: 'fighter',
  name: 'Fighter',
  hitDie: 10,
  primaryAbility: 'str',
  savingThrowProficiencies: ['str', 'con'],
  weaponMasterySlots: 3,
  // Extra Attack at L5: one additional attack per Attack action.
  // Encounter system reads this via `attacksPerAction(classDef, level)`.
  extraAttacks: { 5: 1 },
  features: {
    1: ['Fighting Style', 'Second Wind', 'Weapon Mastery'],
    2: ['Action Surge', 'Tactical Mind'],
    3: ['Fighter Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Tactical Shift'],
    6: ['Ability Score Improvement', 'Weapon Mastery (4 weapons)'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Indomitable', 'Tactical Master'],
    10: ['Subclass Feature']
  },
  // Resource-bearing features (since 1.3.0). Both refresh on a
  // Short Rest per SRD 5.2 § Fighter.
  resources: {
    secondWind: { max: 1, refreshes: 'short' },
    actionSurge: { max: 1, refreshes: 'short' }
  },
  mechanics: {
    /**
     * SRD 5.2 § Fighter § Second Wind: as a Bonus Action, regain
     * `1d10 + Fighter level` Hit Points. One use per Short Rest.
     * Returns `{ ok, die, healed, hpAfter, actor }` on success or
     * `{ ok: false, reason }` if no uses remain.
     */
    secondWind: (actor, _args, ctx) => {
      const result = spendResource(actor, 'secondWind');
      if (!result.ok) return result;
      const level = actor.level ?? 1;
      const die = ctx.rollDie(10, ctx.rng);
      const raw = die + level;
      const hpBefore = actor.hp ?? 0;
      const hpMax = actor.hpMax ?? Infinity;
      const hpAfter = Math.min(hpBefore + raw, hpMax);
      return {
        ok: true,
        die,
        healed: hpAfter - hpBefore,
        hpAfter,
        actor: { ...result.actor, hp: hpAfter }
      };
    },
    /**
     * SRD 5.2 § Fighter § Action Surge: on your turn, take one
     * additional action. Returns `{ ok, extraAction, actor }`. The
     * host applies the action by topping up the encounter budget;
     * the engine just decrements the use.
     */
    actionSurge: (actor) => {
      const result = spendResource(actor, 'actionSurge');
      if (!result.ok) return result;
      return { ok: true, extraAction: true, actor: result.actor };
    }
  }
};
