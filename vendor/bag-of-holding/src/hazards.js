// Hazards & environment (SRD 5.2 § Hazards): disease, poison,
// suffocation, starvation, extreme temperature, underwater combat.
// Pure data + pure functions; the host owns actor state between calls.

import { savingThrow } from './checks.js';
import { exhaustion as Exhaustion } from './conditions.js';

const POISON_VECTORS = Object.freeze(['contact', 'ingested', 'inhaled', 'injury']);
export { POISON_VECTORS };

export const DISEASES = Object.freeze({
  'sewer-plague': Object.freeze({
    id: 'sewer-plague', name: 'Sewer Plague',
    onsetSave: Object.freeze({ ability: 'con', dc: 11 }),
    onFailure: Object.freeze({ exhaustionDelta: 1 }),
    incubationDays: 1,
    stages: Object.freeze([
      Object.freeze({ ability: 'con', dc: 11, onFailure: Object.freeze({ exhaustionDelta: 1 }) })
    ]),
    recoveryDc: 11
  }),
  'cackle-fever': Object.freeze({
    id: 'cackle-fever', name: 'Cackle Fever',
    onsetSave: Object.freeze({ ability: 'con', dc: 13 }),
    onFailure: Object.freeze({ conditions: ['incapacitated'] }),
    incubationDays: 1,
    stages: Object.freeze([
      Object.freeze({ ability: 'con', dc: 13, onFailure: Object.freeze({ conditions: ['incapacitated'] }) })
    ]),
    recoveryDc: 13
  })
});

export const POISONS = Object.freeze({
  'serpent-venom': Object.freeze({
    id: 'serpent-venom', name: 'Serpent Venom',
    vector: 'injury',
    save: Object.freeze({ ability: 'con', dc: 11 }),
    onFailure: Object.freeze({ damageDice: '3d6', damageType: 'poison', conditions: ['poisoned'] }),
    onSuccess: Object.freeze({ damageDice: '1d6', damageType: 'poison' }),
    durationRounds: 10
  }),
  'malice-powder': Object.freeze({
    id: 'malice-powder', name: 'Malice Powder',
    vector: 'inhaled',
    save: Object.freeze({ ability: 'con', dc: 15 }),
    onFailure: Object.freeze({ conditions: ['blinded'] }),
    durationRounds: 10
  }),
  'oil-of-taggit': Object.freeze({
    id: 'oil-of-taggit', name: 'Oil of Taggit',
    vector: 'contact',
    save: Object.freeze({ ability: 'con', dc: 13 }),
    onFailure: Object.freeze({ conditions: ['unconscious'] }),
    durationRounds: 600
  }),
  'pale-tincture': Object.freeze({
    id: 'pale-tincture', name: 'Pale Tincture',
    vector: 'ingested',
    save: Object.freeze({ ability: 'con', dc: 16 }),
    onFailure: Object.freeze({ damageDice: '1d6', damageType: 'poison' }),
    durationRounds: 600
  })
});

export const UNDERWATER_OK_MELEE = Object.freeze(['dagger', 'javelin', 'shortsword', 'spear', 'trident']);
export const UNDERWATER_OK_RANGED = Object.freeze(['crossbow-light', 'net', 'spear-thrown', 'trident-thrown']);
export const UNDERWATER_RESISTED_DAMAGE = Object.freeze(['fire']);

// `saver` defaults to Checks.savingThrow; the engine binding overrides
// it with the rng-logging variant so every roll lands in rollLog.
export function exposure({ actor, hazard }, rng = Math.random, saver = savingThrow) {
  if (!hazard || (!hazard.onsetSave && !hazard.save)) {
    throw new Error('Hazards.exposure: hazard must declare onsetSave or save');
  }
  const save = hazard.onsetSave ?? hazard.save;
  const result = saver({
    abilityScore: actor.abilityScores?.[save.ability] ?? 10,
    proficient: false,
    dc: save.dc
  }, rng);
  const effect = result.success ? (hazard.onSuccess ?? null) : (hazard.onFailure ?? null);
  return { save: result, effect, contracted: !result.success };
}

export function tickPoison(state) {
  const next = Math.max(0, (state.roundsRemaining ?? 0) - 1);
  return { ...state, roundsRemaining: next, expired: next === 0 };
}

// Suffocation per SRD § Holding Your Breath. Host owns the
// breathLeftRounds counter; helper decrements and flags outOfBreath.
export function tickSuffocation(state) {
  const breathLeft = Math.max(0, (state.breathLeftRounds ?? 0) - 1);
  return {
    ...state,
    breathLeftRounds: breathLeft,
    outOfBreath: breathLeft === 0
  };
}

export function holdBreathRounds(conMod) {
  return Math.max(1, Math.max(0, 1 + conMod) * 10);
}

// Daily starvation / thirst tick per SRD § Food and Water. Food
// grace = max(1, 1 + CON mod) days; thirst is DC 15 CON save, +5 per
// extra consecutive dry day.
export function starvationTick(actor, { daysWithoutFood = 0, daysWithoutWater = 0 } = {}, rng = Math.random, saver = savingThrow) {
  let next = actor;
  let reason = null;
  const conMod = actor.abilityScores ? Math.floor((actor.abilityScores.con - 10) / 2) : 0;
  const foodGrace = Math.max(1, 1 + conMod);
  if (daysWithoutFood > foodGrace) {
    next = Exhaustion.gain(next);
    reason = 'starvation';
  }
  if (daysWithoutWater >= 1) {
    const dc = 15 + Math.max(0, (daysWithoutWater - 1) * 5);
    const save = saver({ abilityScore: next.abilityScores?.con ?? 10, dc }, rng);
    if (!save.success) {
      next = Exhaustion.gain(next);
      reason = reason ? 'starvation+thirst' : 'thirst';
    }
  }
  return { actor: next, reason };
}

// Extreme heat / cold per SRD § Environment. DC 5 + (hours-1) CON
// save per hour past the first; failure costs 1 exhaustion.
// gearAcclimatised proxies SRD advantage by lowering DC by 5.
export function extremeTemperatureTick(actor, { hoursExposed = 1, gearAcclimatised = false } = {}, rng = Math.random, saver = savingThrow) {
  if (hoursExposed < 1) return { actor, save: null };
  const baseDc = 5 + (hoursExposed - 1);
  const dc = gearAcclimatised ? Math.max(0, baseDc - 5) : baseDc;
  const save = saver({ abilityScore: actor.abilityScores?.con ?? 10, dc }, rng);
  if (save.success) return { actor, save };
  return { actor: Exhaustion.gain(actor), save };
}

// Underwater attack stance per SRD § Underwater Combat: melee with
// a non-listed weapon, disadvantage; ranged beyond normal range,
// auto-miss; ranged within normal range, disadvantage; fire damage,
// always disadvantage.
export function classifyUnderwaterAttack({ weaponId, attackKind, beyondNormalRange = false, damageType }) {
  if (damageType === 'fire') return { stance: 'disadvantage', autoMiss: false };
  if (attackKind === 'melee') {
    return { stance: UNDERWATER_OK_MELEE.includes(weaponId) ? 'normal' : 'disadvantage', autoMiss: false };
  }
  if (attackKind === 'ranged') {
    if (beyondNormalRange) return { stance: 'normal', autoMiss: true };
    return { stance: UNDERWATER_OK_RANGED.includes(weaponId) ? 'normal' : 'disadvantage', autoMiss: false };
  }
  throw new Error('Hazards.classifyUnderwaterAttack: attackKind must be melee or ranged');
}

export const Hazards = Object.freeze({
  DISEASES,
  POISONS,
  POISON_VECTORS,
  UNDERWATER_OK_MELEE,
  UNDERWATER_OK_RANGED,
  UNDERWATER_RESISTED_DAMAGE,
  exposure,
  tickPoison,
  tickSuffocation,
  holdBreathRounds,
  starvationTick,
  extremeTemperatureTick,
  classifyUnderwaterAttack
});

export default Hazards;
