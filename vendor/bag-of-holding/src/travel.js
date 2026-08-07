// Travel & exploration (SRD 5.2 § Adventuring): travel pace,
// forced march, rest interruption, foraging, navigation. Pure
// helpers; the host owns the per-session bookkeeping.

import { savingThrow, abilityCheck } from './checks.js';
import { exhaustion as Exhaustion } from './conditions.js';

// SRD § Travel Pace table. Per-hour mileage at each pace, plus the
// per-day cap (8 hours = a normal travel day; past that is forced
// march). Fast forfeits passive Perception bonuses.
export const TRAVEL_PACES = Object.freeze({
  slow:   Object.freeze({ milesPerHour: 2, milesPerDay: 16, passivePerceptionBonus: 0,  stealthOk: true,  notes: 'slow' }),
  normal: Object.freeze({ milesPerHour: 3, milesPerDay: 24, passivePerceptionBonus: 0,  stealthOk: false, notes: 'normal' }),
  fast:   Object.freeze({ milesPerHour: 4, milesPerDay: 30, passivePerceptionBonus: -5, stealthOk: false, notes: 'fast' })
});

// Mileage helper: hours * pace. Floors at 0 to keep negative inputs
// from producing surprising negative distances downstream.
export function milesTravelled({ pace, hours }) {
  const entry = TRAVEL_PACES[pace];
  if (!entry) throw new Error(`milesTravelled: unknown pace '${pace}'`);
  return Math.max(0, entry.milesPerHour * Math.max(0, hours));
}

// Forced march per SRD § Forced March. Each hour past 8 forces a
// CON save (DC = 10 + the number of hours past 8). Failure costs 1
// exhaustion. The host calls this for each over-cap hour.
export function forcedMarchCheck(actor, { hoursPast8 }, rng = Math.random, saver = savingThrow) {
  if (!Number.isInteger(hoursPast8) || hoursPast8 < 1) {
    throw new Error('forcedMarchCheck: hoursPast8 must be a positive integer');
  }
  const dc = 10 + hoursPast8;
  const save = saver({ abilityScore: actor.abilityScores?.con ?? 10, dc }, rng);
  if (save.success) return { actor, save };
  return { actor: Exhaustion.gain(actor), save };
}

// Resting in dangerous terrain per SRD § Resting: each hour, an
// interruption check at the host-supplied probability (0..1).
// Returns whether the rest was interrupted plus the d20 roll the
// host can show to the player.
export function checkRestInterruption({ probability }, rng = Math.random) {
  if (!(probability >= 0 && probability <= 1)) {
    throw new Error('checkRestInterruption: probability must be in [0, 1]');
  }
  const roll = rng();
  return { interrupted: roll < probability, roll };
}

// Foraging per SRD § Foraging. WIS (Survival) check; DC depends on
// terrain abundance. Returns the check plus the food / water in
// pounds and gallons rolled when successful.
export function forageCheck({ actor, terrain = 'plentiful' }, rng = Math.random) {
  const DC_FOR_TERRAIN = { plentiful: 10, scarce: 15, barren: 20 };
  const dc = DC_FOR_TERRAIN[terrain];
  if (!Number.isInteger(dc)) {
    throw new Error(`forageCheck: unknown terrain '${terrain}'`);
  }
  const profBonus = actor.proficiencyBonus ?? 2;
  const result = abilityCheck({
    abilityScore: actor.abilityScores?.wis ?? 10,
    proficient: (actor.proficiencies?.skills ?? []).includes('survival'),
    proficiencyBonus: profBonus,
    dc
  }, rng);
  if (!result.success) {
    return { check: result, foundFoodLbs: 0, foundWaterGallons: 0 };
  }
  const surplus = Math.max(0, result.total - dc);
  return {
    check: result,
    foundFoodLbs: 1 + surplus,
    foundWaterGallons: 1 + Math.floor(surplus / 2)
  };
}

// Navigation per SRD § Becoming Lost. WIS (Survival) check against
// a terrain DC. Returns `{ check, lost }`.
export function navigateCheck({ actor, terrain = 'open' }, rng = Math.random) {
  const DC_FOR_TERRAIN = { open: 10, forest: 15, jungle: 15, mountain: 15, swamp: 15, arctic: 20 };
  const dc = DC_FOR_TERRAIN[terrain];
  if (!Number.isInteger(dc)) {
    throw new Error(`navigateCheck: unknown terrain '${terrain}'`);
  }
  const profBonus = actor.proficiencyBonus ?? 2;
  const navigatorTools = (actor.proficiencies?.tools ?? []).includes('navigators-tools');
  const result = abilityCheck({
    abilityScore: actor.abilityScores?.wis ?? 10,
    proficient: navigatorTools || (actor.proficiencies?.skills ?? []).includes('survival'),
    proficiencyBonus: profBonus,
    dc
  }, rng);
  return { check: result, lost: !result.success };
}

export const Travel = Object.freeze({
  TRAVEL_PACES,
  milesTravelled,
  forcedMarchCheck,
  checkRestInterruption,
  forageCheck,
  navigateCheck
});

export default Travel;
