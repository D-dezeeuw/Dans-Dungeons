// src/game/bestiary.js — monster registry: vendor SRD monsters + our own.
//
// The vendor (`bag-of-holding`) ships an SRD stat-block set as `SRD.monsters`
// (66 creatures, CR 0 → 15). We use that as the base and extend it with the
// custom creatures in creatures.js (constructs, mephits, fungal horrors, theme
// bosses). New code reads monsters from `BESTIARY` and turns them into
// combat-ready NPC stats via `statBlockFor`.
//
// Difficulty scales by CR: the dungeon generator sorts a theme's pool by `cr`
// and places weaker creatures near the entrance, stronger ones near the vault
// (see world.js / the client lib's generateDungeon).

import { SRD, Dice, elevate } from './rules.js';
import { CUSTOM_MONSTERS, DEFAULT_ENEMY_IDS } from './creatures.js';

export { CUSTOM_MONSTERS, DEFAULT_ENEMY_IDS };

// Vendor SRD monsters first, our own layered on top (and able to override —
// e.g. `cultist` becomes our flavoured "Feral Cultist").
export const BESTIARY = Object.freeze({ ...SRD.monsters, ...CUSTOM_MONSTERS });

// ─── Stat-block → NPC combat shape ────────────────────────────────────────────
// The resolver/world expect flat combat fields (toHit, damageDie, damageBonus).
// SRD/custom blocks carry a single `damage` spec like "1d6+2"; split it with the
// vendor dice parser so we never hand-maintain the breakdown. `cr` rides along so
// the dungeon generator can scale placement by depth.

// Split a damage spec into {count, sides, modifier}. Most SRD/custom blocks use
// dice notation ("1d6+2"), but a few low creatures (rat, bat, spider) carry a
// flat "1". Represent flat N as a 1d1 die plus an (N-1) modifier so the combat
// roller — which expects dice + a flat bonus — always totals N.
function parseDamage(spec) {
  if (typeof spec === 'string' && /\d+d\d+/.test(spec)) return Dice.parse(spec);
  const flat = parseInt(spec, 10) || 1;
  return { count: 1, sides: 1, modifier: flat - 1 };
}

// A boss is not just a bigger monster: the tier template gives it multiattack,
// legendary actions and legendary resistance, so a solo fight plays differently
// instead of merely lasting longer. `tier` picks how far above its base the
// creature is raised (see the engine's monster-templates).
export function bossBlockFor(monsterId, { tier = 'elite' } = {}) {
  const base = BESTIARY[monsterId];
  if (!base) throw new Error(`Unknown monster: ${monsterId}`);
  const raised = elevate({ ...base, id: monsterId }, tier);
  return { ...statBlockFrom(raised), boss: true, template: tier, name: raised.name };
}

// Pick the tier a boss should be raised to for a party of this level, so a
// late-campaign vault is not guarded by something a level-8 party walks over.
export function bossTierForLevel(level = 1) {
  if (level >= 9) return 'ancient';
  if (level >= 5) return 'champion';
  return 'elite';
}

export function statBlockFor(monsterId) {
  const m = BESTIARY[monsterId];
  if (!m) throw new Error(`Unknown monster: ${monsterId}`);
  return statBlockFrom(m);
}

// Shared shaping: the resolver/world expect flat combat fields.
function statBlockFrom(m) {
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
    // Carried through so the encounter layer can use the mechanics module.
    multiattack:         m.multiattack ?? null,
    legendaryActions:    m.legendaryActions ?? null,
    legendaryResistance: m.legendaryResistance ?? null,
  };
}

// Every creature id the engine can actually run a fight with. Canon minting
// (src/game/canon-commit.js) resolves a Game-Master-invented creature name
// against this list, so "a ghoul haunts the privy" becomes a bindable stat
// block rather than prose nothing can act on.
export const KNOWN_CREATURE_IDS = Object.freeze(Object.keys(BESTIARY));
