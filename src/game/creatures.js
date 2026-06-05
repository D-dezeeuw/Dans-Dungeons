// src/game/creatures.js — pure creature roster data.
//
// Zero imports on purpose: the custom creature stat blocks and the default enemy
// pool live here so they're unit-testable in the node test runner (which can't
// resolve the `bag-of-holding` bare specifier that bestiary.js pulls in).
// bestiary.js merges these with the vendor SRD monsters; the dungeon generator
// scales placement directly off each creature's CR.

// ─── Our own creatures, in the SRD monster shape ──────────────────────────────
// Same field layout as the vendor's `SRD.monsters` entries so the two merge
// cleanly and `statBlockFor` can treat every monster identically. These fill
// thematic gaps the SRD set leaves open (constructs, mephits, fungal creatures,
// theme bosses) so every dungeon theme has a 4–5 creature pool with CR variety.

export const CUSTOM_MONSTERS = Object.freeze({
  // — minions (CR ≤ 0.25) —
  'giant-rat': {
    id: 'giant-rat', name: 'Giant Rat', cr: 0.125, ac: 12, hp: 7, size: 'small',
    attacks: [{ name: 'Bite', attackBonus: 4, damage: '1d4+2', damageType: 'piercing' }],
  },
  'cave-spider': {
    id: 'cave-spider', name: 'Cave Spider', cr: 0.25, ac: 13, hp: 6, size: 'small',
    attacks: [{ name: 'Bite', attackBonus: 5, damage: '1d4+2', damageType: 'piercing' }],
  },
  'cultist': {
    id: 'cultist', name: 'Feral Cultist', cr: 0.125, ac: 12, hp: 9, size: 'medium',
    attacks: [{ name: 'Ritual Dagger', attackBonus: 3, damage: '1d4+1', damageType: 'piercing' }],
  },
  'flying-sword': {
    id: 'flying-sword', name: 'Flying Sword', cr: 0.25, ac: 17, hp: 5, size: 'small',
    attacks: [{ name: 'Slash', attackBonus: 3, damage: '1d8+1', damageType: 'slashing' }],
  },
  'violet-fungus': {
    id: 'violet-fungus', name: 'Violet Fungus', cr: 0.25, ac: 5, hp: 18, size: 'medium',
    attacks: [{ name: 'Rotting Touch', attackBonus: 2, damage: '1d8', damageType: 'necrotic' }],
  },
  'swarm-of-rats': {
    id: 'swarm-of-rats', name: 'Swarm of Rats', cr: 0.25, ac: 10, hp: 24, size: 'medium',
    attacks: [{ name: 'Bites', attackBonus: 2, damage: '2d6', damageType: 'piercing' }],
  },

  // — standard (CR 0.5–1) —
  'magma-mephit': {
    id: 'magma-mephit', name: 'Magma Mephit', cr: 0.5, ac: 11, hp: 9, size: 'small',
    attacks: [{ name: 'Claws', attackBonus: 3, damage: '1d4+2', damageType: 'fire' }],
  },
  'ice-mephit': {
    id: 'ice-mephit', name: 'Ice Mephit', cr: 0.5, ac: 11, hp: 9, size: 'small',
    attacks: [{ name: 'Claws', attackBonus: 3, damage: '1d4+2', damageType: 'cold' }],
  },
  'shadow': {
    id: 'shadow', name: 'Shadow', cr: 0.5, ac: 12, hp: 16, size: 'medium',
    attacks: [{ name: 'Strength Drain', attackBonus: 4, damage: '2d6+2', damageType: 'necrotic' }],
  },
  'fungal-zombie': {
    id: 'fungal-zombie', name: 'Fungal Husk', cr: 0.5, ac: 9, hp: 30, size: 'medium',
    attacks: [{ name: 'Slam', attackBonus: 3, damage: '1d6+1', damageType: 'bludgeoning' }],
  },
  'bugbear': {
    id: 'bugbear', name: 'Bugbear', cr: 1, ac: 16, hp: 27, size: 'medium',
    attacks: [{ name: 'Morningstar', attackBonus: 4, damage: '2d8+2', damageType: 'piercing' }],
  },
  'animated-armor': {
    id: 'animated-armor', name: 'Animated Armor', cr: 1, ac: 18, hp: 33, size: 'medium',
    attacks: [{ name: 'Slam', attackBonus: 4, damage: '1d6+2', damageType: 'bludgeoning' }],
  },

  // — elite / bosses (CR 2–4) —
  'will-o-wisp': {
    id: 'will-o-wisp', name: 'Will-o-Wisp', cr: 2, ac: 19, hp: 22, size: 'tiny',
    attacks: [{ name: 'Shock', attackBonus: 4, damage: '2d8', damageType: 'lightning' }],
  },
  'gibbering-mouther': {
    id: 'gibbering-mouther', name: 'Gibbering Mouther', cr: 2, ac: 9, hp: 39, size: 'medium',
    attacks: [{ name: 'Bites', attackBonus: 2, damage: '1d6+2', damageType: 'piercing' }],
  },
  'myconid-sovereign': {
    id: 'myconid-sovereign', name: 'Myconid Sovereign', cr: 2, ac: 12, hp: 45, size: 'medium',
    attacks: [{ name: 'Fist', attackBonus: 4, damage: '1d8+2', damageType: 'bludgeoning' }],
  },
  'stone-sentinel': {
    id: 'stone-sentinel', name: 'Stone Sentinel', cr: 2, ac: 17, hp: 52, size: 'large',
    attacks: [{ name: 'Stone Fist', attackBonus: 5, damage: '1d10+3', damageType: 'bludgeoning' }],
  },
  'vampire-spawn': {
    id: 'vampire-spawn', name: 'Vampire Spawn', cr: 3, ac: 15, hp: 45, size: 'medium',
    attacks: [{ name: 'Claws', attackBonus: 6, damage: '2d4+3', damageType: 'slashing' }],
  },
  'lesser-demon': {
    id: 'lesser-demon', name: 'Lesser Demon', cr: 3, ac: 14, hp: 52, size: 'medium',
    attacks: [{ name: 'Claws', attackBonus: 5, damage: '2d6+3', damageType: 'slashing' }],
  },
  'young-drake': {
    id: 'young-drake', name: 'Young Drake', cr: 4, ac: 17, hp: 60, size: 'large',
    attacks: [{ name: 'Bite', attackBonus: 6, damage: '2d6+4', damageType: 'fire' }],
  },
});

// Default enemy pool when no theme overlay applies (Quick Dungeon fallback / the
// original six creatures). Every id here must exist in BESTIARY.
export const DEFAULT_ENEMY_IDS = Object.freeze([
  'goblin', 'skeleton', 'cultist', 'giant-rat', 'zombie', 'cave-spider',
]);

// Wilderness creatures for overworld travel encounters (Phase 3). Kept low/mid
// CR so a road ambush is survivable. Every id must exist in BESTIARY.
export const OVERWORLD_ENEMY_IDS = Object.freeze([
  'giant-rat', 'wolf', 'bandit', 'goblin', 'scout', 'worg', 'black-bear', 'dire-wolf',
]);
