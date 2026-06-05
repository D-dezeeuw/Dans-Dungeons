// src/game/bestiary.js — monster registry: vendor SRD monsters + our own.
//
// The vendor (`bag-of-holding`) ships an SRD stat-block set as `SRD.monsters`
// (66 creatures, CR 0 → 15). We use that as the base and extend it with the
// custom creatures in creatures.js (constructs, mephits, fungal horrors, theme
// bosses). New code reads monsters from `BESTIARY` and turns them into
// combat-ready NPC stats via `statBlockFor`.
//
// Difficulty scales by CR. `tierForCr` (from creatures.js) buckets a creature
// into a depth band so the dungeon generator can place weak minions near the
// entrance and elites / bosses near the vault (see world.js).

import { SRD, Dice } from './rules.js';
import { CUSTOM_MONSTERS, DEFAULT_ENEMY_IDS, TIER_BANDS, tierForCr } from './creatures.js';

export { CUSTOM_MONSTERS, DEFAULT_ENEMY_IDS, TIER_BANDS, tierForCr };

// Vendor SRD monsters first, our own layered on top (and able to override —
// e.g. `cultist` becomes our flavoured "Feral Cultist").
export const BESTIARY = Object.freeze({ ...SRD.monsters, ...CUSTOM_MONSTERS });

// ─── Stat-block → NPC combat shape ────────────────────────────────────────────
// The resolver/world expect flat combat fields (toHit, damageDie, damageBonus).
// SRD/custom blocks carry a single `damage` spec like "1d6+2"; split it with the
// vendor dice parser so we never hand-maintain the breakdown. `cr` and `tier`
// ride along so the dungeon generator can scale placement by depth.

// Split a damage spec into {count, sides, modifier}. Most SRD/custom blocks use
// dice notation ("1d6+2"), but a few low creatures (rat, bat, spider) carry a
// flat "1". Represent flat N as a 1d1 die plus an (N-1) modifier so the combat
// roller — which expects dice + a flat bonus — always totals N.
function parseDamage(spec) {
  if (typeof spec === 'string' && /\d+d\d+/.test(spec)) return Dice.parse(spec);
  const flat = parseInt(spec, 10) || 1;
  return { count: 1, sides: 1, modifier: flat - 1 };
}

export function statBlockFor(monsterId) {
  const m = BESTIARY[monsterId];
  if (!m) throw new Error(`Unknown monster: ${monsterId}`);
  const attack = m.attacks?.[0] ?? { attackBonus: 0, damage: '1d4', damageType: 'bludgeoning' };
  const { count, sides, modifier } = parseDamage(attack.damage);
  return {
    hp:          m.hp,
    maxHp:       m.hp,
    ac:          m.ac,
    toHit:       attack.attackBonus,
    damageDie:   `${count}d${sides}`,
    damageBonus: modifier,
    damageType:  attack.damageType,
    cr:          m.cr ?? 0,
    tier:        tierForCr(m.cr),
  };
}
