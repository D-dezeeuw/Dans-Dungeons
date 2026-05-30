// SRD 5.2 Sorcerer, levels 1–10.
//   L1  Spellcasting (full caster, CHA, known list), Innate Sorcery.
//   L2  Sorcerous Origin (subclass), Font of Magic — Sorcery Points.
//   L3  Metamagic (pick 2 options).
//   L5  Sorcerous Restoration.
//   L10 Metamagic (third option).

import { spendResource } from '../mechanics.js';

/**
 * SRD 5.2 § Sorcerer — Sorcery Points pool. Equals class level from
 * L2 onward (Font of Magic). L1 Sorcerers have no points yet.
 */
export function sorceryPointsForLevel(level) {
  if (level < 2) return 0;
  return level;
}

/**
 * SRD 5.2 § Sorcerer — Font of Magic — Creating Spell Slots table:
 * Sorcery Point cost to create a spell slot of the given level. The
 * table caps at 5 (no created slots above 5th level).
 */
export const SLOT_CREATION_COSTS = Object.freeze({
  1: 2,
  2: 3,
  3: 5,
  4: 6,
  5: 7
});

/**
 * SRD 5.2 § Sorcerer — Metamagic options. Each entry declares its
 * Sorcery Point cost plus a small `effect` object describing what
 * the option does mechanically. Costs the SRD lists as
 * "1 sorcery point per level of the spell" (Twinned) use the
 * sentinel `'slotLevel'` and resolve via `args.slotLevel`.
 *
 * The `effect` payload is a host-readable schema, not engine
 * automation — the host applies "rangeMultiplier: 2" to the spell's
 * range, "saveDisadvantage: true" to the next save roll, etc. The
 * engine handles the cost and reports what the metamagic does.
 */
export const METAMAGIC_OPTIONS = Object.freeze({
  careful:    { cost: 1,          effect: Object.freeze({ allyAutoPassesAoESave: true }) },
  distant:    { cost: 1,          effect: Object.freeze({ rangeMultiplier: 2, touchBecomesFt: 30 }) },
  empowered:  { cost: 1,          effect: Object.freeze({ rerollDamageDice: 'chaMod' }) },
  extended:   { cost: 1,          effect: Object.freeze({ durationMultiplier: 2 }) },
  heightened: { cost: 2,          effect: Object.freeze({ saveDisadvantage: true }) },
  quickened:  { cost: 2,          effect: Object.freeze({ castingTime: 'bonus' }) },
  seeking:    { cost: 1,          effect: Object.freeze({ rerollAttack: true }) },
  subtle:     { cost: 1,          effect: Object.freeze({ removeComponents: ['v', 's'] }) },
  transmuted: { cost: 1,          effect: Object.freeze({ changeDamageType: true }) },
  twinned:    { cost: 'slotLevel', effect: Object.freeze({ additionalTarget: 1 }) }
});

export default {
  id: 'sorcerer',
  name: 'Sorcerer',
  hitDie: 6,
  primaryAbility: 'cha',
  savingThrowProficiencies: ['con', 'cha'],
  spellcasting: {
    ability: 'cha',
    cantripsKnown: { 1: 4, 4: 5 },
    progression: 'full',
    preparation: 'known'
  },
  subclasses: {
    'draconic-sorcery': {
      id: 'draconic-sorcery',
      name: 'Draconic Sorcery',
      features: {
        1: ['Draconic Resilience', 'Draconic Ancestry'],
        3: ['Elemental Affinity']
      }
    }
  },
  features: {
    1: ['Spellcasting', 'Innate Sorcery'],
    2: ['Font of Magic'],
    3: ['Metamagic'],
    4: ['Ability Score Improvement'],
    5: ['Sorcerous Restoration'],
    6: ['Subclass Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Metamagic (third option)']
  },
  // Resource-bearing features (since 1.3.8). Sorcery Points refresh
  // on Long Rest only.
  resources: {
    sorceryPoints: {
      max: (level) => sorceryPointsForLevel(level),
      refreshes: 'long'
    }
  },
  mechanics: {
    /**
     * SRD 5.2 § Sorcerer — Font of Magic: convert a spent spell slot
     * into Sorcery Points. The points gained equal the slot level
     * (capped at 5). `args.slotLevel` is required.
     *
     * "Spent" means the host has already consumed the slot; this
     * mechanic refunds nothing — it's the reverse: it takes an
     * *unspent* slot, marks it spent, and grants the points. (The
     * SRD wording: "you can transform unexpended Sorcery Points...
     * or a spell slot you have into one of the other".)
     */
    convertSlotToPoints: (actor, args = {}, _ctx) => {
      const slotLevel = args.slotLevel;
      if (!Number.isInteger(slotLevel) || slotLevel < 1 || slotLevel > 5) {
        return { ok: false, reason: 'args.slotLevel must be an integer in [1, 5]' };
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
      const points = slotLevel;
      const pool = actor.resources?.sorceryPoints;
      if (!pool) return { ok: false, reason: 'no sorceryPoints resource' };
      const newUsed = Math.max(0, pool.used - points);
      const nextSlots = actor.spellSlots.slice();
      nextSlots[slotIdx] = { ...nextSlots[slotIdx], used: nextSlots[slotIdx].used + 1 };
      return {
        ok: true,
        pointsGained: pool.used - newUsed,
        actor: {
          ...actor,
          spellSlots: nextSlots,
          resources: { ...actor.resources, sorceryPoints: { ...pool, used: newUsed } }
        }
      };
    },
    /**
     * SRD 5.2 § Sorcerer — Font of Magic: create a spell slot by
     * spending Sorcery Points. Slot level must be 1–5; the cost
     * comes from `SLOT_CREATION_COSTS`. The created slot is tagged
     * `temporary: true` so `Spellcasting.longRest` (which currently
     * just resets `used`) can identify it for removal on Long Rest
     * per the SRD ("the slot vanishes when you finish a Long Rest").
     *
     * Note: the existing `longRest` doesn't yet strip temporary
     * slots — that's a planned tightening, tracked under the
     * 1.6.0 turn-lifecycle + dawn-event work. For now the host can
     * read the `temporary` flag and filter at presentation time, or
     * (worst case) the slot survives the rest as a free use. This
     * is documented in `docs/srd-coverage.md` row 24.
     */
    createSpellSlot: (actor, args = {}, _ctx) => {
      const slotLevel = args.slotLevel;
      if (!Number.isInteger(slotLevel) || slotLevel < 1 || slotLevel > 5) {
        return { ok: false, reason: 'args.slotLevel must be an integer in [1, 5]' };
      }
      const cost = SLOT_CREATION_COSTS[slotLevel];
      const result = spendResource(actor, 'sorceryPoints', cost);
      if (!result.ok) return result;
      const existingSlots = Array.isArray(actor.spellSlots) ? actor.spellSlots : [];
      const newSlot = { level: slotLevel, used: 0, max: 1, temporary: true };
      return {
        ok: true,
        cost,
        slot: newSlot,
        actor: {
          ...result.actor,
          spellSlots: [...existingSlots, newSlot]
        }
      };
    },
    /**
     * SRD 5.2 § Sorcerer — Metamagic. Spend Sorcery Points to alter
     * a spell. `args.metamagic` keys into `METAMAGIC_OPTIONS`;
     * `args.slotLevel` is required when the option's cost is
     * `'slotLevel'` (i.e. Twinned Spell).
     *
     * Returns `{ ok, metamagic, cost, effect, actor }`. The host
     * applies the `effect` payload when casting the spell.
     */
    applyMetamagic: (actor, args = {}, _ctx) => {
      const name = args.metamagic;
      const option = METAMAGIC_OPTIONS[name];
      if (!option) {
        return { ok: false, reason: `unknown metamagic option: ${name}` };
      }
      let cost = option.cost;
      if (cost === 'slotLevel') {
        const slotLevel = args.slotLevel;
        if (!Number.isInteger(slotLevel) || slotLevel < 1) {
          return { ok: false, reason: `${name} requires args.slotLevel` };
        }
        cost = slotLevel;
      }
      const result = spendResource(actor, 'sorceryPoints', cost);
      if (!result.ok) return result;
      return {
        ok: true,
        metamagic: name,
        cost,
        effect: option.effect,
        actor: result.actor
      };
    },
    /**
     * Read-only: current Sorcery Points snapshot for UI.
     */
    sorceryPointsStatus: (actor) => {
      const pool = actor.resources?.sorceryPoints;
      if (!pool) return { remaining: 0, max: 0 };
      return { remaining: pool.max - pool.used, max: pool.max };
    }
  }
};
