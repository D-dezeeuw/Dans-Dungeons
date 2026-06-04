// src/game/bestiary.js — monster registry: vendor SRD monsters + our own.
//
// The vendor (`bag-of-holding`) ships an SRD stat-block set as `SRD.monsters`.
// We use that as the base and extend it with creatures the SRD set doesn't
// cover (a giant rat, a cave spider, a feral cultist). New code reads monsters
// from `BESTIARY` and turns them into combat-ready NPC stats via `statBlockFor`.

import { SRD, Dice } from './rules.js';

// ─── Our own creatures, in the SRD monster shape ──────────────────────────────
// Same field layout as the vendor's `SRD.monsters` entries so the two merge
// cleanly and `statBlockFor` can treat every monster identically.

export const CUSTOM_MONSTERS = Object.freeze({
  'giant-rat': {
    id: 'giant-rat', name: 'Giant Rat',
    cr: 0.125, ac: 12, hp: 7, size: 'small',
    attacks: [{ name: 'Bite', attackBonus: 4, damage: '1d4+2', damageType: 'piercing' }],
  },
  'cave-spider': {
    id: 'cave-spider', name: 'Cave Spider',
    cr: 0.25, ac: 13, hp: 6, size: 'small',
    attacks: [{ name: 'Bite', attackBonus: 5, damage: '1d4+2', damageType: 'piercing' }],
  },
  'cultist': {
    id: 'cultist', name: 'Feral Cultist',
    cr: 0.125, ac: 12, hp: 9, size: 'medium',
    attacks: [{ name: 'Ritual Dagger', attackBonus: 3, damage: '1d4+1', damageType: 'piercing' }],
  },
});

// Vendor SRD monsters first, our own layered on top (and able to override).
export const BESTIARY = Object.freeze({ ...SRD.monsters, ...CUSTOM_MONSTERS });

// ─── Stat-block → NPC combat shape ────────────────────────────────────────────
// The resolver/world expect flat combat fields (toHit, damageDie, damageBonus).
// SRD/custom blocks carry a single `damage` spec like "1d6+2"; split it with the
// vendor dice parser so we never hand-maintain the breakdown.

export function statBlockFor(monsterId) {
  const m = BESTIARY[monsterId];
  if (!m) throw new Error(`Unknown monster: ${monsterId}`);
  const attack = m.attacks?.[0] ?? { attackBonus: 0, damage: '1d4', damageType: 'bludgeoning' };
  const { count, sides, modifier } = Dice.parse(attack.damage);
  return {
    hp:          m.hp,
    maxHp:       m.hp,
    ac:          m.ac,
    toHit:       attack.attackBonus,
    damageDie:   `${count}d${sides}`,
    damageBonus: modifier,
    damageType:  attack.damageType,
  };
}
