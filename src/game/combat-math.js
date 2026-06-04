// src/game/combat-math.js — pure D&D combat/skill arithmetic.
//
// No AI, no network, no Spektrum, no browser globals. Every function here is
// deterministic: callers roll the dice (via bag-of-holding) and pass the
// results in, so these helpers can be unit-tested in isolation.
//
// resolver.js owns the impure parts (reading appState, rolling Dice); this
// module owns the rules math those parts depend on.

// "1d8" → "2d8", "2d6" → "4d6" (critical hit doubles the damage dice).
export function doubleDice(spec) {
  return spec.replace(/^(\d+)d(\d+)$/, (_, n, d) => `${Number(n) * 2}d${d}`);
}

// Decide whether an attack lands given the d20 result and the attacker/target.
// Natural 20 always hits (and crits); natural 1 always misses (fumble).
export function resolveAttackOutcome({ d20, attackBonus = 0, targetAc }) {
  const crit     = d20 === 20;
  const fumble   = d20 === 1;
  const totalHit = d20 + attackBonus;
  const hit      = !fumble && (crit || totalHit >= targetAc);
  return { crit, fumble, totalHit, hit };
}

// Apply a damage roll to a target's HP. Damage is at least 1 on a hit; HP
// never drops below 0. `dead` is true once HP hits 0.
export function applyDamage({ targetHp, damageTotal, damageMod = 0 }) {
  const damage = Math.max(1, damageTotal + damageMod);
  const newHp  = Math.max(0, targetHp - damage);
  return { damage, newHp, dead: newHp <= 0 };
}

// Resolve a skill check: d20 + ability mod + (proficiency if proficient) vs DC.
export function resolveSkillOutcome({ d20, abilMod = 0, profBonus = 0, dc }) {
  const total = d20 + abilMod + profBonus;
  return { total, success: total >= dc };
}
