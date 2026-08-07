// src/game/spells.js — the caster's side of a turn.
//
// The engine has shipped slots, preparation limits, cantrip scaling, upcasting,
// concentration, and the SRD spell records for a long time. The game called
// none of it: a wizard and a fighter played identically, both swinging
// `attacks[0]`, and "I cast fire bolt" reached the classifier as a `skill`
// check against a DC the model invented. This module is the missing adapter —
// it decides what a character can cast, and the resolver turns that into dice.
//
// Pure with respect to Spektrum: everything here reads a record + sheet and
// returns data. The writes live in resolver.js's commit path, same as every
// other mechanical outcome.

import { SRD, Spellcasting, spellsFor, maxSpellLevel, Dice } from './rules.js';

// The classes whose spellcasting the game currently offers. Half casters
// (paladin, ranger) are deliberately absent for now: they get spells at level 2,
// and nothing in the game reaches level 2 with one yet. The list is here rather
// than inferred so adding them is one line, not an archaeology exercise.
export const PLAYABLE_CASTERS = ['cleric', 'wizard'];

// The engine's own progression tag for a class, or null for a non-caster.
export function progressionOf(classId) {
  return SRD.classes?.[classId]?.spellcasting?.progression ?? null;
}

export function isCaster(classId) {
  return PLAYABLE_CASTERS.includes(classId) && progressionOf(classId) != null;
}

// A caster's live profile: the sheet's attack bonus and save DC (already
// derived), plus the slot ceiling and the number of spells they may prepare.
// Returns null for a non-caster, which is what every caller branches on.
export function casterProfile(record, sheet) {
  if (!record || !isCaster(record.classId)) return null;
  const progression = progressionOf(record.classId);
  const sc = sheet?.spellcasting;
  if (!sc) return null;

  const level    = record.level ?? 1;
  const abilityMod = sheet.abilityScores?.mod?.[sc.ability] ?? 0;

  return {
    classId:     record.classId,
    ability:     sc.ability,
    attackBonus: sc.attackBonus,
    saveDC:      sc.saveDC,
    progression,
    casterLevel: level,
    maxLevel:    maxSpellLevel(level, progression),
    cantripsKnown: cantripsKnownAt(record.classId, level),
    preparedMax: Spellcasting.preparedSpellCount({ casterLevel: level, abilityMod, progression }),
  };
}

// How many cantrips this class knows at this level, from the class data's own
// `cantripsKnown` breakpoint table ({ "1": 3, "4": 4, "10": 5 }).
function cantripsKnownAt(classId, level) {
  const table = SRD.classes?.[classId]?.spellcasting?.cantripsKnown ?? {};
  let known = 0;
  for (const [at, n] of Object.entries(table)) {
    if (level >= Number(at)) known = Math.max(known, n);
  }
  return known;
}

// Deterministic default loadout for a fresh character.
//
// Taking the first N off the alphabetised class list looks tidy and produces an
// unplayable character: a cleric's first three cantrips by name are Guidance,
// Light, and Mending, so the cleric walks into the first fight with no way to
// hurt anything. Spells that DO something in a fight — damage, then healing —
// are picked first, and utility fills whatever is left. Still fully
// deterministic: a character sheet that reshuffles between reloads is not a
// character sheet.
function byUsefulness(a, b) {
  const rank = (s) => (s.damage ? 0 : s.healing ? 1 : 2);
  return rank(a) - rank(b) || a.level - b.level || a.name.localeCompare(b.name);
}

export function defaultLoadout(record, sheet) {
  const profile = casterProfile(record, sheet);
  if (!profile) return null;

  const cantrips = spellsFor(profile.classId, { level: 0 })
    .sort(byUsefulness)
    .slice(0, profile.cantripsKnown)
    .map(s => s.id);

  const prepared = spellsFor(profile.classId, { maxLevel: profile.maxLevel })
    .filter(s => s.level > 0)
    .sort(byUsefulness)
    .slice(0, profile.preparedMax)
    .map(s => s.id);

  return {
    cantrips,
    prepared,
    slots: Spellcasting.freshSlots(profile.progression, profile.casterLevel),
  };
}

// Everything this character can cast right now, as UI-ready descriptors.
// A leveled spell with no slot left is still listed — greyed out by `castable`
// — because "you are out of second-level slots" is information, and hiding the
// spell just makes the player wonder where it went.
export function castableSpells(record, sheet, magic) {
  const profile = casterProfile(record, sheet);
  if (!profile || !magic) return [];

  const ids = [...(magic.cantrips ?? []), ...(magic.prepared ?? [])];
  const out = [];
  for (const id of ids) {
    const spell = SRD.spells?.[id];
    if (!spell) continue;
    const slot = spell.level === 0 ? null : lowestSlotFor(magic.slots, spell.level);
    out.push({
      id:       spell.id,
      name:     spell.name,
      level:    spell.level,
      school:   spell.school,
      damage:   spell.damage ?? null,
      healing:  spell.healing ?? null,
      save:     spell.save ?? null,
      castable: spell.level === 0 || slot != null,
      slotLevel: slot,
    });
  }
  return out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

// The lowest unspent slot of at least `level`, or null. Mirrors what
// consumeSlot will actually take, so the chip and the cast agree.
export function lowestSlotFor(slots, level) {
  for (const s of (slots ?? [])) {
    if (s.level >= level && s.used < s.max) return s.level;
  }
  return null;
}

// Slots remaining, as a compact "1st ×3 · 2nd ×1" style summary for the UI.
export function slotSummary(slots) {
  return (slots ?? [])
    .filter(s => s.max > 0)
    .map(s => ({ level: s.level, left: Math.max(0, s.max - s.used), max: s.max }));
}

// A cantrip's damage at this character's level (SRD cantrip scaling: 1st, 5th,
// 11th, 17th). Leveled spells keep their printed dice; upcast bonuses are the
// engine's `upcastEffect`, which the resolver reads.
export function cantripDamage(spell, casterLevel) {
  if (!spell?.damage || spell.level !== 0) return spell?.damage ?? null;
  return Spellcasting.scaledDamageSpec(spell.damage, casterLevel);
}

// Split a spec ("2d10", "1d8+3", "1d4+1") into the { damageDice, damageMod }
// pair the engine's replayable damage roller takes. A spec it cannot parse
// comes back with a zero modifier and the spec intact, which the roller then
// rejects loudly rather than silently rolling something else.
export function splitSpec(spec) {
  const text = String(spec ?? '').trim();
  // A few records are a flat number rather than dice (Heal restores 70). No
  // roll to make: it is all modifier.
  if (/^\d+$/.test(text)) return { damageDice: null, damageMod: Number(text) };
  const m = /^\s*(\d*d\d+)\s*([+-]\s*\d+)?\s*$/i.exec(text);
  if (!m) return { damageDice: text, damageMod: 0 };
  return { damageDice: m[1], damageMod: m[2] ? Number(m[2].replace(/\s+/g, '')) : 0 };
}

// Roll a spell's damage or healing spec. `mod` substitutes for the "+mod" the
// SRD healing records carry literally (e.g. Cure Wounds is "1d8+mod").
//
// Routed through the roller's damage path rather than a new one: that path is
// already in verifyLog's replay table, so a caster's dice stay as auditable as
// a fighter's. A spell that drew from an unreplayable op would desync every
// roll after it — the exact failure the engine's correctness pass just fixed.
export function rollSpec(spec, mod, roller) {
  if (!spec) return null;
  const resolved = String(spec).replace(/\+\s*mod/i, mod >= 0 ? `+${mod}` : `${mod}`);
  const { damageDice, damageMod } = splitSpec(resolved);
  // A flat spec has nothing to roll — returning it as a total keeps it out of
  // the dice stream, which is right: an unrolled draw would desync the replay.
  if (!damageDice) return { total: damageMod, rolls: [], modifier: damageMod };
  if (roller?.damage) return roller.damage({ damageDice, damageMod, critical: false });
  return Dice.roll(resolved);
}

// Find a spell record the player named, by id or by (case-insensitive) name,
// restricted to what they can actually cast. Returns null when the name matches
// nothing they have — the narrator then explains, rather than the game
// inventing a spell that is not on the sheet.
export function findCastable(nameOrId, record, sheet, magic) {
  if (!nameOrId) return null;
  const wanted = String(nameOrId).toLowerCase().trim();
  const list = castableSpells(record, sheet, magic);
  return list.find(s => s.id === wanted)
      ?? list.find(s => s.name.toLowerCase() === wanted)
      ?? list.find(s => s.name.toLowerCase().replace(/[^a-z]/g, '') === wanted.replace(/[^a-z]/g, ''))
      ?? null;
}
