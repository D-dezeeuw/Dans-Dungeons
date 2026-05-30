// SRD 5.2 Monk, levels 1–10.
//   L1  Unarmored Defense (WIS), Martial Arts (bonus-action attack;
//       martial-arts die d6 → d8/d10/d12 at L5/L11/L17).
//   L2  Monk's Focus (Focus Points = level), Unarmored Movement +10 ft.
//   L3  Monastic Tradition (subclass), Deflect Attacks.
//   L5  Extra Attack, Stunning Strike.
//   L10 Heightened Focus (Flurry of Blows = 3 strikes; bigger Patient
//       Defense / Step of the Wind effects).

import { spendResource } from '../mechanics.js';

/**
 * SRD 5.2 § Monk — Focus Points pool. Equals the Monk's class level
 * from L2 onward; L1 Monks have no points yet.
 */
export function focusPointsForLevel(level) {
  if (level < 2) return 0;
  return level;
}

/**
 * SRD 5.2 § Monk — Martial Arts die size by class level. Used by
 * Martial Arts unarmed strikes and (separately) by the Patient
 * Defense temp-HP grant.
 *   L1–L4   → d6
 *   L5–L10  → d8
 *   L11–L16 → d10
 *   L17+    → d12
 */
export function martialArtsDieSize(level) {
  if (level >= 17) return 12;
  if (level >= 11) return 10;
  if (level >= 5) return 8;
  return 6;
}

/**
 * SRD 5.2 § Monk — Flurry of Blows strike count: 2 by default, 3
 * from L10 onward via Heightened Focus.
 */
export function flurryStrikeCount(level) {
  return level >= 10 ? 3 : 2;
}

export default {
  id: 'monk',
  name: 'Monk',
  hitDie: 8,
  primaryAbility: 'dex',
  savingThrowProficiencies: ['str', 'dex'],
  extraAttacks: { 5: 1 },
  subclasses: {
    'open-hand': {
      id: 'open-hand',
      name: 'Warrior of the Open Hand',
      features: {
        3: ['Open Hand Technique']
      }
    }
  },
  features: {
    1: ['Unarmored Defense', 'Martial Arts'],
    2: ["Monk's Focus", 'Unarmored Movement'],
    3: ['Monastic Tradition', 'Deflect Attacks'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Stunning Strike'],
    6: ['Empowered Strikes', 'Subclass Feature'],
    7: ['Evasion'],
    8: ['Ability Score Improvement'],
    9: ['Acrobatic Movement'],
    10: ['Heightened Focus']
  },
  // Resource-bearing features (since 1.3.5). Focus Points refresh
  // fully on a Short Rest — the canonical short-rest resource.
  resources: {
    focusPoints: {
      max: (level) => focusPointsForLevel(level),
      refreshes: 'short'
    }
  },
  mechanics: {
    /**
     * Spend `amount` Focus Points without any further effect. Useful
     * for subclass features that consume points outside the three
     * default Focus options. Defaults to 1 point.
     */
    spendFocusPoints: (actor, args = {}, _ctx) => {
      const amount = args.amount ?? 1;
      return spendResource(actor, 'focusPoints', amount);
    },
    /**
     * SRD 5.2 § Monk — Flurry of Blows: 1 Focus Point as a Bonus
     * Action, make two Unarmed Strikes (three at L10+ via Heightened
     * Focus). Returns `{ ok, strikes, actor }`. The host resolves
     * each unarmed strike through its normal attack flow; the engine
     * just reports the count.
     */
    flurryOfBlows: (actor, _args, _ctx) => {
      const result = spendResource(actor, 'focusPoints');
      if (!result.ok) return result;
      const level = actor.level ?? 1;
      return {
        ok: true,
        strikes: flurryStrikeCount(level),
        actor: result.actor
      };
    },
    /**
     * SRD 5.2 § Monk — Patient Defense.
     *   - `args.spendFp: false` — free Disengage as a Bonus Action.
     *   - `args.spendFp: true` (default) — 1 Focus Point: Disengage +
     *     Dodge as a Bonus Action, plus 2 rolls of the Martial Arts
     *     die in Temporary HP.
     *
     * Returns `{ ok, actions, tempHp?, actor }`. The host applies the
     * Disengage + Dodge state and grants the tempHp; the engine
     * resolves the dice and the resource.
     */
    patientDefense: (actor, args = {}, ctx) => {
      const spendFp = args.spendFp !== false;
      if (!spendFp) {
        return { ok: true, actions: ['disengage'], actor };
      }
      const result = spendResource(actor, 'focusPoints');
      if (!result.ok) return result;
      const level = actor.level ?? 1;
      const die = martialArtsDieSize(level);
      const a = ctx.rollDie(die, ctx.rng);
      const b = ctx.rollDie(die, ctx.rng);
      return {
        ok: true,
        actions: ['disengage', 'dodge'],
        tempHp: a + b,
        rolls: [a, b],
        actor: result.actor
      };
    },
    /**
     * SRD 5.2 § Monk — Step of the Wind.
     *   - `args.spendFp: false` — free Dash as a Bonus Action.
     *   - `args.spendFp: true` (default) — 1 Focus Point: Disengage +
     *     Dash as a Bonus Action, jump distance doubled for the
     *     turn, and may move one willing Large-or-smaller ally
     *     within 5 ft along without provoking opportunity attacks.
     */
    stepOfTheWind: (actor, args = {}, _ctx) => {
      const spendFp = args.spendFp !== false;
      if (!spendFp) {
        return { ok: true, actions: ['dash'], actor };
      }
      const result = spendResource(actor, 'focusPoints');
      if (!result.ok) return result;
      return {
        ok: true,
        actions: ['disengage', 'dash'],
        doubledJump: true,
        canCarryAlly: true,
        actor: result.actor
      };
    },
    /**
     * Read-only: current Martial Arts die spec for chip tooltips
     * and the bonus-action Martial Arts attack.
     */
    martialArtsDie: (actor) => {
      const level = actor.level ?? 1;
      const size = martialArtsDieSize(level);
      return { dieSize: size, die: `1d${size}` };
    }
  }
};
