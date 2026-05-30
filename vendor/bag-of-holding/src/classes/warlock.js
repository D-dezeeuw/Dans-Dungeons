// SRD 5.2 Warlock, levels 1–10.
//   L1  Eldritch Invocations (1), Pact Magic.
//   L2  Eldritch Invocation slot 2.
//   L3  Patron's Boon, Pact Boon.
//   L5  Eldritch Invocation slot 3.
//   L7  Eldritch Invocation slot 4.
//   L9  Eldritch Invocation slot 5.
//   L10 Subclass feature.

import { modFromScore } from '../checks.js';

/**
 * SRD 5.2 § Warlock — Eldritch Invocations: known count by class
 * level. The PHB Warlock Features table grants more invocation
 * slots over time:
 *   L1     → 1
 *   L2–L4  → 2
 *   L5–L6  → 3
 *   L7–L8  → 4
 *   L9–L11 → 5
 *   L12+   → 6 (and beyond)
 */
export function invocationsKnownForLevel(level) {
  if (level >= 18) return 8;
  if (level >= 15) return 7;
  if (level >= 12) return 6;
  if (level >= 9) return 5;
  if (level >= 7) return 4;
  if (level >= 5) return 3;
  if (level >= 2) return 2;
  return 1;
}

/**
 * SRD 5.2 § Warlock — Eldritch Invocations registry. Each entry
 * declares its prerequisites and a small `effect` schema the host
 * reads to apply the invocation's benefit.
 *
 * The shape is deliberately compact — invocations are passive
 * affordances rather than spendable resources, so the engine
 * validates selection and provides lookups; the host applies the
 * mechanical effects (at-will spells, vision changes, damage
 * boosters) through its existing surfaces.
 *
 * Prereqs supported:
 *   - `warlockLevel` — minimum Warlock level.
 *   - `cantrip` — must know the listed cantrip (e.g. Eldritch
 *                 Blast for Repelling Blast).
 *
 * `repeatable: true` allows the same invocation to be taken more
 * than once (Agonizing Blast in 2024 applies per cantrip pick).
 */
export const ELDRITCH_INVOCATIONS = Object.freeze({
  'agonizing-blast': {
    id: 'agonizing-blast',
    name: 'Agonizing Blast',
    prerequisites: { warlockLevel: 2 },
    repeatable: true,
    effect: Object.freeze({ damageBonus: 'chaMod', targets: 'oneCantrip' })
  },
  'armor-of-shadows': {
    id: 'armor-of-shadows',
    name: 'Armor of Shadows',
    prerequisites: { warlockLevel: 1 },
    effect: Object.freeze({ atWillSpell: 'mage-armor' })
  },
  'devils-sight': {
    id: 'devils-sight',
    name: "Devil's Sight",
    prerequisites: { warlockLevel: 2 },
    effect: Object.freeze({ darkvisionFt: 120, throughMagicalDarkness: true })
  },
  'eldritch-mind': {
    id: 'eldritch-mind',
    name: 'Eldritch Mind',
    prerequisites: { warlockLevel: 1 },
    effect: Object.freeze({ concentrationAdvantage: true })
  },
  'fiendish-vigor': {
    id: 'fiendish-vigor',
    name: 'Fiendish Vigor',
    prerequisites: { warlockLevel: 2 },
    effect: Object.freeze({ atWillSpell: 'false-life' })
  },
  'mask-of-many-faces': {
    id: 'mask-of-many-faces',
    name: 'Mask of Many Faces',
    prerequisites: { warlockLevel: 2 },
    effect: Object.freeze({ atWillSpell: 'disguise-self' })
  },
  'misty-visions': {
    id: 'misty-visions',
    name: 'Misty Visions',
    prerequisites: { warlockLevel: 2 },
    effect: Object.freeze({ atWillSpell: 'silent-image' })
  },
  'repelling-blast': {
    id: 'repelling-blast',
    name: 'Repelling Blast',
    prerequisites: { warlockLevel: 2, cantrip: 'eldritch-blast' },
    effect: Object.freeze({ pushOnEldritchBlastHitFt: 10 })
  },
  'beguiling-influence': {
    id: 'beguiling-influence',
    name: 'Beguiling Influence',
    prerequisites: { warlockLevel: 1 },
    effect: Object.freeze({ skillProficiencies: ['deception', 'persuasion'] })
  },
  'eyes-of-the-rune-keeper': {
    id: 'eyes-of-the-rune-keeper',
    name: 'Eyes of the Rune Keeper',
    prerequisites: { warlockLevel: 1 },
    effect: Object.freeze({ readsAllScripts: true })
  }
});

/**
 * Validate a candidate list of invocation IDs against an actor.
 * Returns `{ ok, reason? }` for use by hosts that want a dry-run
 * check before persisting the selection (e.g. a character builder
 * UI).
 */
export function validateInvocations(invocationIds, actor) {
  if (!Array.isArray(invocationIds)) {
    return { ok: false, reason: 'invocations must be an array' };
  }
  const level = actor.level ?? 1;
  const cantripsKnown = new Set(actor.cantripsKnown ?? []);
  const maxKnown = invocationsKnownForLevel(level);

  if (invocationIds.length > maxKnown) {
    return {
      ok: false,
      reason: `${invocationIds.length} invocations selected; max ${maxKnown} at Warlock level ${level}`
    };
  }
  const seen = new Map();
  for (const id of invocationIds) {
    const inv = ELDRITCH_INVOCATIONS[id];
    if (!inv) return { ok: false, reason: `unknown invocation: ${id}` };
    const count = seen.get(id) ?? 0;
    if (count > 0 && !inv.repeatable) {
      return { ok: false, reason: `cannot repeat invocation: ${id}` };
    }
    seen.set(id, count + 1);
    // Every shipped invocation declares `prerequisites` (even if
    // empty); the lookup is safe to dereference directly.
    const prereqs = inv.prerequisites;
    if (prereqs.warlockLevel && level < prereqs.warlockLevel) {
      return {
        ok: false,
        reason: `${id} requires Warlock level ${prereqs.warlockLevel}`
      };
    }
    if (prereqs.cantrip && !cantripsKnown.has(prereqs.cantrip)) {
      return {
        ok: false,
        reason: `${id} requires the ${prereqs.cantrip} cantrip`
      };
    }
  }
  return { ok: true };
}

export default {
  id: 'warlock',
  name: 'Warlock',
  hitDie: 8,
  primaryAbility: 'cha',
  savingThrowProficiencies: ['wis', 'cha'],
  spellcasting: {
    ability: 'cha',
    cantripsKnown: { 1: 2, 4: 3 },
    progression: 'warlock',
    preparation: 'known'
  },
  subclasses: {
    'fiend-patron': {
      id: 'fiend-patron',
      name: 'Patron: The Fiend',
      features: {
        1: ["Dark One's Blessing", 'Expanded Spell List'],
        3: ["Dark One's Own Luck"]
      }
    }
  },
  features: {
    1: ['Eldritch Invocations', 'Pact Magic'],
    2: ['Eldritch Invocation'],
    3: ["Patron's Boon", 'Pact Boon'],
    4: ['Ability Score Improvement'],
    5: ['Eldritch Invocation (additional)'],
    6: ['Subclass Feature'],
    7: ['Eldritch Invocation (additional)'],
    8: ['Ability Score Improvement'],
    9: ['Eldritch Invocation (additional)'],
    10: ['Subclass Feature']
  },
  mechanics: {
    /**
     * Persist a validated set of Eldritch Invocations on the actor.
     * Refuses (no state mutation) if any prereq fails or the count
     * exceeds the level cap. Returns `{ ok, actor }` on success.
     */
    setInvocations: (actor, args = {}, _ctx) => {
      const ids = args.invocations;
      const check = validateInvocations(ids, actor);
      if (!check.ok) return check;
      return {
        ok: true,
        invocationsKnown: ids.length,
        maxKnown: invocationsKnownForLevel(actor.level ?? 1),
        actor: { ...actor, invocations: [...ids] }
      };
    },
    /**
     * Read-only: does the actor have the named invocation?
     */
    hasInvocation: (actor, args = {}, _ctx) => {
      const list = Array.isArray(actor.invocations) ? actor.invocations : [];
      return { has: list.includes(args.invocationId) };
    },
    /**
     * SRD 5.2 § Agonizing Blast: adds CHA modifier to the damage of
     * one chosen Warlock cantrip. Returns `{ bonus }` — 0 if the
     * Warlock doesn't have Agonizing Blast, otherwise the CHA mod
     * (floored at 0 for CHA 8 — no negative bonus per SRD).
     */
    agonizingBlastBonus: (actor, _args, _ctx) => {
      const list = Array.isArray(actor.invocations) ? actor.invocations : [];
      if (!list.includes('agonizing-blast')) return { bonus: 0 };
      const chaMod = modFromScore(actor.abilityScores?.cha ?? 10);
      return { bonus: Math.max(0, chaMod) };
    },
    /**
     * Read-only: invocation-slot accounting for the UI builder.
     */
    invocationsStatus: (actor, _args, _ctx) => {
      const level = actor.level ?? 1;
      const known = Array.isArray(actor.invocations) ? actor.invocations.length : 0;
      return { known, max: invocationsKnownForLevel(level) };
    }
  }
};
