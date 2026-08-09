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
  // Extra Attack at L5 / L11: one then two additional attacks per
  // Attack action. Encounter system reads via attacksPerAction.
  extraAttacks: { 5: 1, 11: 2, 20: 3 },
  subclasses: {
    champion: {
      id: 'champion',
      name: 'Champion',
      features: {
        3: ['Improved Critical'],
        7: ['Remarkable Athlete'],
        10: ['Additional Fighting Style'],
        15: ['Superior Critical'],
        18: ['Survivor']
      },
      mechanics: {
        // Improved Critical: 19-20 crits. The host reads
        // engine.rules.critOn or this expanded range when computing
        // the crit threshold.
        improvedCritOn: (_actor, args) => {
          const level = args?.level ?? 3;
          return { critOn: level >= 15 ? [18, 19, 20] : [19, 20] };
        }
      }
    }
  },
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
    10: ['Subclass Feature'],
    11: ['Two Extra Attacks'],
    12: ['Ability Score Improvement'],
    13: ['Indomitable (two uses)', 'Studied Attacks'],
    14: ['Subclass Feature'],
    15: ['Improved Critical (19-20)'],
    16: ['Ability Score Improvement'],
    17: ['Action Surge (two uses)', 'Indomitable (three uses)'],
    18: ['Subclass Feature'],
    19: ['Epic Boon'],
    20: ['Three Extra Attacks']
  },
  // Resource-bearing features (since 1.3.0). Level-scaled maxima use the
  // same `max: (level) => …` form Rage does, so `Mechanics.freshResources`
  // derives the right pool at any level instead of trusting a level-up flow
  // to remember.
  resources: {
    // SRD 5.2 § Fighter — Second Wind: two uses at level 1, three at 4th,
    // four at 10th; ALL return on a Long Rest and ONE on a Short Rest.
    // (The previous `{ max: 2, refreshes: 'short' }` refilled the whole
    // pool every short rest — a rule from neither edition.)
    secondWind: {
      max: (level) => (level >= 10 ? 4 : level >= 4 ? 3 : 2),
      refreshes: 'long',
      shortRestRecovery: 1
    },
    // SRD 5.2 § Fighter — Action Surge: refreshes on a Short or Long
    // Rest; a second use arrives at 17th (the features table always
    // said so; the counter now agrees).
    actionSurge: { max: (level) => (level >= 17 ? 2 : 1), refreshes: 'short' },
    // Indomitable: one use at 9th, two at 13th, three at 17th, per Long Rest.
    indomitable: { max: (level) => (level >= 17 ? 3 : level >= 13 ? 2 : 1), refreshes: 'long' }
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
    },
    /**
     * SRD 5.2 § Fighter § Indomitable: reroll a failed save. Host
     * passes the original save result; if a reroll happens, the
     * second roll replaces the first. Returns the spent resource
     * status plus a `reroll: true` flag so the host re-runs the save.
     */
    indomitable: (actor) => {
      const result = spendResource(actor, 'indomitable');
      if (!result.ok) return result;
      return { ok: true, reroll: true, actor: result.actor };
    }
  }
};
