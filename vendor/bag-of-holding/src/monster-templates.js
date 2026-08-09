/**
 * monster-templates.js — deterministic templates that raise a stat block's tier.
 *
 * The bestiary tops out at CR 15 and not one of its 66 entries carries a
 * structured mechanics block, so the monster-mechanics module (legendary
 * actions, lair actions, multiattack, innate casting) shipped complete and
 * consumed nothing — and a "boss" was a normal monster with more hit points.
 *
 * Rather than transcribe stat blocks from memory (the bestiary already suffers
 * from edition drift, and inventing numbers would deepen it), higher tiers are
 * DERIVED from verified SRD entries by a documented, deterministic template.
 * The arithmetic is explicit, so a reviewer can check it, and every derived
 * monster is clearly marked as such rather than passing itself off as SRD text.
 *
 * The multipliers follow the DMG's own CR-building guidance: offensive and
 * defensive values both scale with CR, so a tier bump raises hit points, AC,
 * attack bonus and damage together and grants the legendary machinery that
 * makes a solo boss survive an action-economy disadvantage.
 */

/** Tier definitions. Each step is roughly +4 CR of threat. */
export const TEMPLATES = Object.freeze({
  elite: {
    label: 'Elite', crBonus: 4, hpMultiplier: 1.8, acBonus: 1,
    attackBonus: 1, damageMultiplier: 1.4, legendaryActions: 3, legendaryResistance: 1,
  },
  champion: {
    label: 'Champion', crBonus: 8, hpMultiplier: 2.8, acBonus: 2,
    attackBonus: 2, damageMultiplier: 1.9, legendaryActions: 3, legendaryResistance: 2,
  },
  ancient: {
    label: 'Ancient', crBonus: 12, hpMultiplier: 4.0, acBonus: 3,
    attackBonus: 3, damageMultiplier: 2.5, legendaryActions: 3, legendaryResistance: 3,
  },
});

/** Scale a damage expression's dice count and flat bonus by `mult`. */
function scaleDamage(spec, mult) {
  if (typeof spec !== 'string') return spec;
  const m = spec.match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/);
  if (!m) return spec;
  const count = Math.max(1, Math.round(Number(m[1]) * mult));
  const bonus = m[3] ? Math.round(Number(m[3]) * mult) : 0;
  return bonus ? `${count}d${m[2]}+${bonus}` : `${count}d${m[2]}`;
}

/**
 * Derive a higher-tier version of a stat block.
 *
 * The result carries `derivedFrom` and `template` so nothing downstream can
 * mistake it for a transcribed SRD monster, and a `multiattack` plus
 * `legendaryActions` block so the monster-mechanics module actually has data
 * to work with — which is what makes a boss fight play differently rather than
 * just last longer.
 */
export function elevate(monster, tierName = 'elite') {
  if (!monster || typeof monster !== 'object') throw new Error('elevate requires a stat block');
  const tier = TEMPLATES[tierName];
  if (!tier) throw new Error(`unknown template '${tierName}'`);

  const attacks = (monster.attacks ?? []).map(a => ({
    ...a,
    attackBonus: (a.attackBonus ?? 0) + tier.attackBonus,
    damage: scaleDamage(a.damage, tier.damageMultiplier),
  }));

  // Two strikes a round is the difference between a solo boss and a punching
  // bag: one creature against a party is already losing the action economy.
  // A base with a single attack strikes with it twice — exactly how the SRD
  // writes single-weapon multiattacks — instead of a one-entry "multi"attack.
  const multiattackRefs = (attacks.length >= 2 ? attacks.slice(0, 2) : [attacks[0], attacks[0]])
    .filter(Boolean)
    .map(a => ({ name: a.name, attackRef: a.name }));

  return {
    ...monster,
    id:   `${monster.id}-${tierName}`,
    name: `${tier.label} ${monster.name}`,
    cr:   (monster.cr ?? 0) + tier.crBonus,
    hp:   Math.round((monster.hp ?? 1) * tier.hpMultiplier),
    ac:   (monster.ac ?? 10) + tier.acBonus,
    attacks,
    multiattack: { attacks: multiattackRefs },
    // `options` with stable ids is the shape `useLegendaryAction` looks up
    // (monsters.js) — the previous `actions`/name-only shape meant a derived
    // boss had legendary actions it could never actually use.
    // Lair actions are deliberately NOT derived: they fire on initiative 20
    // from a host-driven trigger no template can invent data for.
    legendaryActions: {
      uses: tier.legendaryActions,
      options: [
        { id: 'strike', name: 'Strike', cost: 1, attackRef: attacks[0]?.name ?? 'Attack' },
        { id: 'move',   name: 'Move',   cost: 1 },
        { id: 'rally',  name: 'Rally',  cost: 2 },
      ],
    },
    legendaryResistance: { uses: tier.legendaryResistance },
    derivedFrom: monster.id,
    template: tierName,
  };
}

/** Every tier a base monster can be raised to, cheapest first. */
export function tiersFor(monster) {
  return Object.keys(TEMPLATES).map(name => ({ name, cr: (monster?.cr ?? 0) + TEMPLATES[name].crBonus }));
}

/**
 * Pick a template that lands a base monster near a target CR, or null when the
 * base is already close enough. Lets an encounter builder reach CR 16-24 from
 * verified data instead of inventing it.
 */
export function templateForTargetCr(monster, targetCr) {
  const base = monster?.cr ?? 0;
  if (targetCr <= base + 1) return null;
  let best = null;
  for (const [name, t] of Object.entries(TEMPLATES)) {
    const distance = Math.abs((base + t.crBonus) - targetCr);
    if (!best || distance < best.distance) best = { name, distance };
  }
  return best?.name ?? null;
}
