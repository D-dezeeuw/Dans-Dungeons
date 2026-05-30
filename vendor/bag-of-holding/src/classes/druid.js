// SRD 5.2 Druid, levels 1–10.
//   L1 Spellcasting (full caster, WIS, prepared), Druidic.
//   L2 Wild Shape, Druid Circle (subclass).
//   L4 Wild Shape CR cap rises to 1/2; swim Beasts unlocked.
//   L7 Elemental Fury.
//   L8 Wild Shape CR cap rises to 1; fly Beasts unlocked.

import { spendResource } from '../mechanics.js';

/**
 * SRD 5.2 § Druid — Wild Shape: uses-per-rest. The PHB Druid
 * Features table lists 2 uses for most of the L2–L10 band; we cover
 * the conservative slice the engine ships and leave higher-tier
 * step-ups to the 1.19+ tier-3/4 rollouts.
 */
export function wildShapeUsesForLevel(level) {
  if (level < 2) return 0;
  return 2;
}

/**
 * SRD 5.2 § Druid — Wild Shape: maximum Challenge Rating of the
 * Beast forms a Druid can assume at the given level.
 *   L1     → 0   (no Wild Shape yet)
 *   L2–L3  → 1/4
 *   L4–L7  → 1/2
 *   L8+    → 1
 */
export function wildShapeMaxCR(level) {
  if (level >= 8) return 1;
  if (level >= 4) return 0.5;
  if (level >= 2) return 0.25;
  return 0;
}

/**
 * SRD 5.2 § Druid — Beast Shapes table: number of *known* Beast
 * forms the Druid can swap among (assignable on a Long Rest).
 */
export function wildShapeKnownForms(level) {
  if (level >= 8) return 8;
  if (level >= 4) return 6;
  if (level >= 2) return 4;
  return 0;
}

/**
 * SRD 5.2 § Druid — Wild Shape movement restrictions:
 *   - Swim speed: unlocked at L4.
 *   - Fly speed:  unlocked at L8.
 *
 * Returns `{ swim: boolean, fly: boolean }` — both flags are true
 * once the Druid is past the level cap, false otherwise. Walking and
 * burrowing Beasts are always allowed.
 */
export function wildShapeAllowedMovement(level) {
  return {
    swim: level >= 4,
    fly: level >= 8
  };
}

export default {
  id: 'druid',
  name: 'Druid',
  hitDie: 8,
  primaryAbility: 'wis',
  savingThrowProficiencies: ['int', 'wis'],
  spellcasting: {
    ability: 'wis',
    cantripsKnown: { 1: 2, 4: 3 },
    progression: 'full',
    preparation: 'prepared'
  },
  subclasses: {
    'circle-of-the-land': {
      id: 'circle-of-the-land',
      name: 'Circle of the Land',
      features: {
        2: ['Cantrip', 'Land Stride'],
        3: ['Circle Spells']
      }
    }
  },
  features: {
    1: ['Druidic', 'Spellcasting'],
    2: ['Wild Shape', 'Druid Circle'],
    3: [],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Subclass Feature'],
    7: ['Elemental Fury'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Subclass Feature']
  },
  // Resource-bearing features (since 1.3.4). Wild Shape refreshes
  // fully on Long Rest with one use back on Short Rest per SRD 5.2.
  resources: {
    wildShape: {
      max: (level) => wildShapeUsesForLevel(level),
      refreshes: 'long',
      shortRestRecovery: 1
    }
  },
  mechanics: {
    /**
     * SRD 5.2 § Druid — Wild Shape. Spend a use to transform into a
     * Beast form the Druid knows. The engine validates the CR cap
     * and movement-mode restrictions, spends the resource, and
     * stamps `actor.wildShape` with the form metadata. The host
     * handles the stat overlay (HP, AC, attacks come from the beast
     * record) — the engine doesn't muddle character-sheet derivation
     * with morph state.
     *
     * `args.beast` is the host's beast record:
     *   `{ id, cr, speeds?: { walk?, swim?, fly?, climb?, burrow? } }`
     *
     * Returns `{ ok: false, reason }` for:
     *   - already wild-shaped
     *   - missing beast
     *   - beast.cr > wildShapeMaxCR(level)
     *   - beast has swim/fly speed and the Druid hasn't unlocked it
     *   - no Wild Shape uses remaining
     */
    wildShape: (actor, args = {}, _ctx) => {
      if (actor.wildShape?.active) {
        return { ok: false, reason: 'already wild-shaped' };
      }
      const beast = args.beast;
      if (!beast || typeof beast !== 'object') {
        return { ok: false, reason: 'args.beast must be a beast record' };
      }
      const level = actor.level ?? 1;
      const maxCR = wildShapeMaxCR(level);
      const beastCR = beast.cr ?? 0;
      if (beastCR > maxCR) {
        return { ok: false, reason: `beast CR ${beastCR} exceeds your max CR ${maxCR}` };
      }
      const movement = wildShapeAllowedMovement(level);
      const speeds = beast.speeds ?? {};
      if (!movement.swim && (speeds.swim ?? 0) > 0) {
        return { ok: false, reason: 'cannot Wild Shape into a swimming Beast below L4' };
      }
      if (!movement.fly && (speeds.fly ?? 0) > 0) {
        return { ok: false, reason: 'cannot Wild Shape into a flying Beast below L8' };
      }
      const result = spendResource(actor, 'wildShape');
      if (!result.ok) return result;
      return {
        ok: true,
        actor: {
          ...result.actor,
          wildShape: {
            active: true,
            beastId: beast.id,
            cr: beastCR
          }
        }
      };
    },
    /**
     * SRD 5.2 § Druid — Wild Shape: revert as a Bonus Action. Clears
     * `actor.wildShape`; doesn't refund the spent use. Refuses when
     * the actor wasn't currently in a Wild Shape form.
     */
    revertWildShape: (actor) => {
      if (!actor.wildShape?.active) {
        return { ok: false, reason: 'not wild-shaped' };
      }
      const { wildShape: _, ...rest } = actor;
      return { ok: true, actor: rest };
    },
    /**
     * Read-only: caps + allowed movement at the Druid's current
     * level. UI affordances and chip tooltips read this to filter
     * the beast picker without dispatching a full transform.
     */
    wildShapeCaps: (actor) => {
      const level = actor.level ?? 1;
      return {
        maxCR: wildShapeMaxCR(level),
        knownForms: wildShapeKnownForms(level),
        allowedMovement: wildShapeAllowedMovement(level)
      };
    }
  }
};
