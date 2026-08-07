// src/srd/spell-lists.js — which classes can learn which spells.
//
// The spell records carry mechanics (level, school, damage, save, components);
// they never said who was allowed to cast them. A host that wants to offer a
// player their actual spell list therefore had to invent one, and inventing it
// from school and level gets a wizard casting Cure Wounds. This is the missing
// half of the SRD spell data: the class lists themselves.
//
// Scope: the SRD 5.2 class lists, restricted to the 104 spells this package
// ships. Subclass-granted spells (Domain, Circle, Patron, Oath) are NOT here —
// they belong to the subclass, and this package models subclasses separately.
// Warlock's list is the Pact Magic list; Eldritch Blast is a warlock cantrip.
//
// Ranger and Paladin are half casters and start at spell level 1 (they have no
// cantrips), which is why neither appears in the level-0 block.

import SPELLS from './spells.js';

// spellId → the classes that have it on their list.
const LISTS = {
  // ── Cantrips ───────────────────────────────────────────────────────────────
  'fire-bolt':        ['sorcerer', 'wizard'],
  'sacred-flame':     ['cleric'],
  'eldritch-blast':   ['warlock'],
  'ray-of-frost':     ['sorcerer', 'wizard'],
  'light':            ['bard', 'cleric', 'sorcerer', 'wizard'],
  'guidance':         ['cleric', 'druid'],
  'mage-hand':        ['bard', 'sorcerer', 'warlock', 'wizard'],
  'prestidigitation': ['bard', 'sorcerer', 'warlock', 'wizard'],
  'acid-splash':      ['sorcerer', 'wizard'],
  'poison-spray':     ['druid', 'sorcerer', 'warlock', 'wizard'],
  'shocking-grasp':   ['sorcerer', 'wizard'],
  'toll-the-dead':    ['cleric', 'warlock', 'wizard'],
  'vicious-mockery':  ['bard'],
  'mending':          ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'],
  'message':          ['bard', 'sorcerer', 'wizard'],
  'minor-illusion':   ['bard', 'sorcerer', 'warlock', 'wizard'],
  'druidcraft':       ['druid'],
  'dancing-lights':   ['bard', 'sorcerer', 'wizard'],

  // ── Level 1 ────────────────────────────────────────────────────────────────
  'cure-wounds':                   ['bard', 'cleric', 'druid', 'paladin', 'ranger'],
  'magic-missile':                 ['sorcerer', 'wizard'],
  'shield':                        ['sorcerer', 'wizard'],
  'mage-armor':                    ['sorcerer', 'wizard'],
  'bless':                         ['cleric', 'paladin'],
  'healing-word':                  ['bard', 'cleric', 'druid'],
  'sleep':                         ['bard', 'sorcerer', 'wizard'],
  'thunderwave':                   ['bard', 'druid', 'sorcerer', 'wizard'],
  'detect-magic':                  ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'wizard'],
  'burning-hands':                 ['sorcerer', 'wizard'],
  'charm-person':                  ['bard', 'druid', 'sorcerer', 'warlock', 'wizard'],
  'feather-fall':                  ['bard', 'sorcerer', 'wizard'],
  'fog-cloud':                     ['druid', 'ranger', 'sorcerer', 'wizard'],
  'identify':                      ['bard', 'wizard'],
  'bane':                          ['bard', 'cleric'],
  'faerie-fire':                   ['bard', 'druid'],
  'protection-from-evil-and-good': ['cleric', 'paladin', 'warlock', 'wizard'],
  'guiding-bolt':                  ['cleric'],
  'hunters-mark':                  ['ranger'],

  // ── Level 2 ────────────────────────────────────────────────────────────────
  'misty-step':         ['sorcerer', 'warlock', 'wizard'],
  'invisibility':       ['bard', 'sorcerer', 'warlock', 'wizard'],
  'hold-person':        ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard'],
  'scorching-ray':      ['sorcerer', 'wizard'],
  'spiritual-weapon':   ['cleric'],
  'aid':                ['bard', 'cleric', 'druid', 'paladin', 'ranger'],
  'blur':               ['sorcerer', 'wizard'],
  'darkness':           ['sorcerer', 'warlock', 'wizard'],
  'detect-thoughts':    ['bard', 'sorcerer', 'wizard'],
  'lesser-restoration': ['bard', 'cleric', 'druid', 'paladin', 'ranger'],
  'see-invisibility':   ['bard', 'sorcerer', 'wizard'],
  'web':                ['sorcerer', 'wizard'],
  'mirror-image':       ['sorcerer', 'warlock', 'wizard'],
  'shatter':            ['bard', 'sorcerer', 'warlock', 'wizard'],

  // ── Level 3 ────────────────────────────────────────────────────────────────
  'fireball':          ['sorcerer', 'wizard'],
  'counterspell':      ['sorcerer', 'warlock', 'wizard'],
  'haste':             ['sorcerer', 'wizard'],
  'fly':               ['sorcerer', 'warlock', 'wizard'],
  'lightning-bolt':    ['sorcerer', 'wizard'],
  'dispel-magic':      ['bard', 'cleric', 'druid', 'paladin', 'sorcerer', 'warlock', 'wizard'],
  'slow':              ['bard', 'sorcerer', 'wizard'],
  'spirit-guardians':  ['cleric'],
  'tongues':           ['bard', 'cleric', 'sorcerer', 'warlock', 'wizard'],
  'water-breathing':   ['druid', 'ranger', 'sorcerer', 'wizard'],
  'revivify':          ['cleric', 'druid', 'paladin', 'ranger'],
  'hypnotic-pattern':  ['bard', 'sorcerer', 'warlock', 'wizard'],

  // ── Level 4 ────────────────────────────────────────────────────────────────
  'banishment':          ['cleric', 'paladin', 'sorcerer', 'warlock', 'wizard'],
  'polymorph':           ['bard', 'druid', 'sorcerer', 'wizard'],
  'fire-shield':         ['druid', 'wizard'],
  'dimension-door':      ['bard', 'sorcerer', 'warlock', 'wizard'],
  'greater-invisibility':['bard', 'sorcerer', 'wizard'],
  'ice-storm':           ['druid', 'sorcerer', 'wizard'],
  'stoneskin':           ['druid', 'ranger', 'sorcerer', 'wizard'],
  'wall-of-fire':        ['druid', 'sorcerer', 'wizard'],
  'confusion':           ['bard', 'druid', 'sorcerer', 'wizard'],

  // ── Level 5 ────────────────────────────────────────────────────────────────
  'cone-of-cold':     ['sorcerer', 'wizard'],
  'hold-monster':     ['bard', 'sorcerer', 'warlock', 'wizard'],
  'wall-of-stone':    ['druid', 'sorcerer', 'wizard'],
  'mass-cure-wounds': ['bard', 'cleric', 'druid'],
  'raise-dead':       ['bard', 'cleric', 'paladin'],
  'telekinesis':      ['sorcerer', 'wizard'],
  'flame-strike':     ['cleric'],
  'scrying':          ['bard', 'cleric', 'druid', 'warlock', 'wizard'],

  // ── Level 6 ────────────────────────────────────────────────────────────────
  'chain-lightning': ['sorcerer', 'wizard'],
  'disintegrate':    ['sorcerer', 'wizard'],
  'heal':            ['cleric', 'druid'],
  'mass-suggestion': ['bard', 'sorcerer', 'warlock', 'wizard'],
  'sunbeam':         ['druid', 'sorcerer', 'wizard'],
  'true-seeing':     ['bard', 'cleric', 'sorcerer', 'warlock', 'wizard'],

  // ── Level 7 ────────────────────────────────────────────────────────────────
  'finger-of-death':  ['sorcerer', 'warlock', 'wizard'],
  'plane-shift':      ['cleric', 'druid', 'sorcerer', 'warlock', 'wizard'],
  'resurrection':     ['bard', 'cleric'],
  'reverse-gravity':  ['druid', 'sorcerer', 'wizard'],
  'teleport':         ['bard', 'sorcerer', 'wizard'],
  'fire-storm':       ['cleric', 'druid', 'sorcerer'],

  // ── Level 8 ────────────────────────────────────────────────────────────────
  'antimagic-field':  ['cleric', 'wizard'],
  'earthquake':       ['cleric', 'druid', 'sorcerer'],
  'mind-blank':       ['bard', 'wizard'],
  'power-word-stun':  ['bard', 'sorcerer', 'warlock', 'wizard'],
  'sunburst':         ['druid', 'sorcerer', 'wizard'],

  // ── Level 9 ────────────────────────────────────────────────────────────────
  'foresight':       ['bard', 'druid', 'warlock', 'wizard'],
  'meteor-swarm':    ['sorcerer', 'wizard'],
  'power-word-kill': ['bard', 'sorcerer', 'warlock', 'wizard'],
  'time-stop':       ['sorcerer', 'wizard'],
  'true-polymorph':  ['bard', 'warlock', 'wizard'],
  'wish':            ['sorcerer', 'wizard'],
  'gate':            ['cleric', 'sorcerer', 'warlock', 'wizard'],
};

// Every class that casts anything at all.
export const CASTER_CLASSES = Object.freeze(
  [...new Set(Object.values(LISTS).flat())].sort(),
);

// The classes that can learn `spellId` (empty for an unknown id).
export function classesFor(spellId) {
  return LISTS[spellId] ?? [];
}

// True when `classId` has `spellId` on its class list.
export function isOnClassList(classId, spellId) {
  return classesFor(spellId).includes(classId);
}

// Every spell record on a class's list, optionally filtered by level.
//   spellsFor('wizard')                      → the whole wizard list
//   spellsFor('wizard', { maxLevel: 3 })     → everything a level-5 wizard can slot
//   spellsFor('cleric', { level: 0 })        → cleric cantrips
// Sorted by level then name, so a UI built straight off this is stable.
export function spellsFor(classId, { level = null, maxLevel = null } = {}) {
  const out = [];
  for (const spell of Object.values(SPELLS)) {
    if (!isOnClassList(classId, spell.id)) continue;
    if (level != null && spell.level !== level) continue;
    if (maxLevel != null && spell.level > maxLevel) continue;
    out.push(spell);
  }
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

// The highest spell level a caster of `casterLevel` can reach, by progression.
// Derived to agree with the slot tables in spellcasting.js exactly — a UI that
// offers a spell level the character has no slot for is worse than one that
// offers nothing. `spell-lists.test.js` asserts the agreement rather than
// trusting these three expressions.
export function maxSpellLevel(casterLevel, progression = 'full') {
  const lvl = Math.max(1, Math.trunc(casterLevel) || 1);
  if (progression === 'half') return Math.min(5, Math.ceil(lvl / 4));
  if (progression === 'pact') return Math.min(5, Math.ceil(lvl / 2));
  return Math.min(9, Math.ceil(lvl / 2));
}
