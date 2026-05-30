// SRD 5.2 Paladin, levels 1–10.
//   L1  Lay on Hands (pool = 5 × level), Spellcasting (half-caster,
//       CHA, prepared).
//   L2  Fighting Style, Divine Smite (now a permanently-prepared
//       spell in 2024; one free cast per Long Rest).
//   L3  Sacred Oath (subclass), Channel Divinity.
//   L5  Extra Attack, Faithful Steed.
//   L6  Aura of Protection.

import { spendResource } from '../mechanics.js';

/** SRD 5.2 § Paladin — Lay on Hands pool size at the given class level. */
export function layOnHandsPoolForLevel(level) {
  if (level < 1) return 0;
  return 5 * level;
}

/**
 * SRD 5.2 § Paladin — Divine Smite (now a spell): extra Radiant
 * damage dice at the given cast level. The base spell is 2d8 at 1st
 * level, +1d8 per slot level above 1st.
 */
export function divineSmiteDice(slotLevel) {
  if (!Number.isInteger(slotLevel) || slotLevel < 1) return 0;
  return 2 + (slotLevel - 1);
}

export default {
  id: 'paladin',
  name: 'Paladin',
  hitDie: 10,
  primaryAbility: 'cha',
  savingThrowProficiencies: ['wis', 'cha'],
  extraAttacks: { 5: 1 },
  spellcasting: {
    ability: 'cha',
    progression: 'half',
    preparation: 'prepared'
  },
  subclasses: {
    'oath-of-devotion': {
      id: 'oath-of-devotion',
      name: 'Oath of Devotion',
      features: {
        3: ['Oath Spells', 'Channel Divinity: Sacred Weapon']
      }
    }
  },
  features: {
    1: ['Lay on Hands', 'Spellcasting'],
    2: ['Fighting Style', 'Divine Smite', 'Channel Divinity'],
    3: ['Sacred Oath'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Faithful Steed'],
    6: ['Aura of Protection'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Abjure Foes'],
    10: ['Aura of Courage']
  },
  // Resource-bearing features (since 1.3.6). Lay on Hands is an HP
  // pool sized to 5 × level; Divine Smite Once gives one free Smite
  // cast per Long Rest (the 2024 SRD change). Both refresh on Long
  // Rest only — Short Rest leaves them alone.
  resources: {
    layOnHands: {
      max: (level) => layOnHandsPoolForLevel(level),
      refreshes: 'long'
    },
    divineSmiteOnce: {
      max: (level) => (level >= 2 ? 1 : 0),
      refreshes: 'long'
    }
  },
  mechanics: {
    /**
     * SRD 5.2 § Paladin — Lay on Hands. As a Bonus Action, touch a
     * creature and restore Hit Points from the pool, up to the
     * remaining amount in the pool. Returns `{ ok, healed, actor }`
     * — `healed` is the amount actually drawn (capped by the
     * remaining pool).
     *
     * `args.amount` is the HP the host wants to draw. Must be a
     * positive integer. The function never silently over-draws — a
     * caller asking for more than the pool has left gets `ok: false`.
     */
    layOnHands: (actor, args = {}, _ctx) => {
      const amount = args.amount;
      if (!Number.isInteger(amount) || amount < 1) {
        return { ok: false, reason: 'args.amount must be a positive integer' };
      }
      const result = spendResource(actor, 'layOnHands', amount);
      if (!result.ok) return result;
      return { ok: true, healed: amount, actor: result.actor };
    },
    /**
     * SRD 5.2 § Paladin — Divine Smite. As a Bonus Action immediately
     * after hitting with an attack, cast the Divine Smite spell on
     * the target.
     *
     * `args.slotLevel`              — slot to consume (1–5).
     * `args.useFreeCast: true`      — consume the once-per-Long-Rest
     *                                 free cast instead of a slot.
     * `args.targetIsFiendOrUndead`  — adds the SRD's +1d8 vs Fiend / Undead.
     *
     * Either a slot consumption OR the free cast is required.
     * Returns `{ ok, dice, damageType, actor }`.
     */
    divineSmite: (actor, args = {}, _ctx) => {
      const level = actor.level ?? 1;
      if (level < 2) {
        return { ok: false, reason: 'requires Paladin level 2 (Divine Smite)' };
      }

      const useFreeCast = args.useFreeCast === true;
      const slotLevel = args.slotLevel;
      // Default smite cast level when using the free cast is 1st.
      const castLevel = useFreeCast ? 1 : slotLevel;

      if (useFreeCast) {
        const result = spendResource(actor, 'divineSmiteOnce');
        if (!result.ok) return result;
        actor = result.actor;
      } else {
        if (!Number.isInteger(slotLevel) || slotLevel < 1) {
          return { ok: false, reason: 'args.slotLevel (1+) or args.useFreeCast required' };
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
        const nextSlots = actor.spellSlots.slice();
        nextSlots[slotIdx] = { ...nextSlots[slotIdx], used: nextSlots[slotIdx].used + 1 };
        actor = { ...actor, spellSlots: nextSlots };
      }

      let dice = divineSmiteDice(castLevel);
      if (args.targetIsFiendOrUndead === true) dice += 1;
      return {
        ok: true,
        dice,
        damageDice: `${dice}d8`,
        damageType: 'radiant',
        castLevel,
        usedFreeCast: useFreeCast,
        actor
      };
    },
    /**
     * Read-only: current Lay on Hands pool snapshot for UI
     * affordances. Returns `{ remaining, max }`.
     */
    layOnHandsPool: (actor) => {
      const pool = actor.resources?.layOnHands;
      if (!pool) return { remaining: 0, max: 0 };
      return { remaining: pool.max - pool.used, max: pool.max };
    }
  }
};
