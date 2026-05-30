// SRD 5.2 Cleric, levels 1–10.
//   L1 Spellcasting (full caster, WIS, prepared), Divine Domain (subclass)
//   L2 Channel Divinity (1/rest in 2014, 2 uses in 2024)
//   L5 Destroy Undead (CR 1/2)
//   L6 Channel Divinity (3 uses), Subclass Feature
//   L7 Blessed Strikes (replaces 2014's Divine Strike)
//   L10 Divine Intervention
//
// In 2024 the Cleric gets Channel Divinity at L2 with 2 uses; the
// count steps to 3 at L6 and 4 at L18. Uses refresh on a Long Rest
// fully and on a Short Rest partially (one use back per short rest).

import { spendResource } from '../mechanics.js';
import { modFromScore } from '../checks.js';

/**
 * SRD 5.2 § Cleric — Channel Divinity uses by class level. Returns
 * `0` before L2 so `freshResources` omits the counter entirely on a
 * pre-Channel-Divinity Cleric.
 */
export function channelDivinityUsesForLevel(level) {
  if (level >= 18) return 4;
  if (level >= 6) return 3;
  if (level >= 2) return 2;
  return 0;
}

/**
 * SRD 5.2 § Cleric — the save DC for a Channel Divinity effect that
 * requires a save equals the Cleric's spell save DC:
 *   `8 + proficiency bonus + Wisdom modifier`.
 * Defaults: proficiencyBonus = 2 (L1–4), WIS = 10 (mod 0) when the
 * actor record is missing the fields, so an under-specified call
 * lands on the SRD's L1-Cleric baseline rather than fabricating one.
 */
export function channelDivinityDC(actor) {
  const proficiencyBonus = actor.proficiencyBonus ?? 2;
  const wisMod = modFromScore(actor.abilityScores?.wis ?? 10);
  return 8 + proficiencyBonus + wisMod;
}

export default {
  id: 'cleric',
  name: 'Cleric',
  hitDie: 8,
  primaryAbility: 'wis',
  savingThrowProficiencies: ['wis', 'cha'],
  spellcasting: { ability: 'wis', cantripsKnown: { 1: 3, 4: 4, 10: 5 }, progression: 'full', preparation: 'prepared' },
  subclasses: {
    'life-domain': {
      id: 'life-domain',
      name: 'Life Domain',
      features: {
        3: ['Disciple of Life', 'Preserve Life']
      }
    }
  },
  features: {
    1: ['Spellcasting', 'Divine Domain'],
    2: ['Channel Divinity'],
    3: [],
    4: ['Ability Score Improvement'],
    5: ['Destroy Undead (CR 1/2)'],
    6: ['Channel Divinity (3 uses)', 'Subclass Feature'],
    7: ['Blessed Strikes'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Divine Intervention']
  },
  // Resource-bearing features (since 1.3.3). Channel Divinity in
  // 2024 SRD: full refresh on Long Rest, one use back on Short Rest.
  resources: {
    channelDivinity: {
      max: (level) => channelDivinityUsesForLevel(level),
      refreshes: 'long',
      shortRestRecovery: 1
    }
  },
  mechanics: {
    /**
     * SRD 5.2 § Cleric — Channel Divinity: Divine Spark. Spend a
     * Channel Divinity use, point your holy symbol at a creature
     * within 30 ft, roll 1d8 + WIS mod, then either:
     *   - mode: 'heal'   — restore that many HP to the target
     *   - mode: 'damage' — target makes a CON save vs the Cleric's
     *                     spell save DC; failure = full, success =
     *                     half. Damage type chosen by the caster
     *                     between necrotic and radiant.
     *
     * The engine resolves the die + DC; the host applies the heal
     * or damage to the chosen target and rolls the save itself.
     */
    divineSpark: (actor, args = {}, ctx) => {
      const result = spendResource(actor, 'channelDivinity');
      if (!result.ok) return result;
      const wisMod = modFromScore(actor.abilityScores?.wis ?? 10);
      const die = ctx.rollDie(8, ctx.rng);
      const value = die + wisMod;
      const mode = args.mode === 'damage' ? 'damage' : 'heal';
      if (mode === 'heal') {
        return { ok: true, mode, die, value, actor: result.actor };
      }
      const damageType = args.damageType === 'necrotic' ? 'necrotic' : 'radiant';
      return {
        ok: true,
        mode,
        die,
        value,
        save: { ability: 'con', dc: channelDivinityDC(actor) },
        damageType,
        halfOnSuccess: true,
        actor: result.actor
      };
    },
    /**
     * SRD 5.2 § Cleric — Channel Divinity: Turn Undead. Spend a
     * Channel Divinity use, every Undead within 30 ft must make a
     * WIS save vs the Cleric's spell save DC. On failure: Frightened
     * + Incapacitated for 1 minute (or until the creature takes any
     * damage). The host iterates targets and rolls saves; the engine
     * surfaces the DC and the on-fail effect.
     */
    turnUndead: (actor, _args, _ctx) => {
      const result = spendResource(actor, 'channelDivinity');
      if (!result.ok) return result;
      return {
        ok: true,
        save: { ability: 'wis', dc: channelDivinityDC(actor) },
        onFail: {
          conditions: ['frightened', 'incapacitated'],
          duration: '1 minute',
          endsOnDamage: true
        },
        rangeFt: 30,
        actor: result.actor
      };
    },
    /**
     * Read-only: the current Channel Divinity DC. For UI chip
     * tooltips and AI-narrator "the DC is N" prose without
     * dispatching a full Channel Divinity action.
     */
    channelDivinityDC: (actor) => ({ dc: channelDivinityDC(actor) })
  }
};
